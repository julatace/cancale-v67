// ════════════════════════════════════════════════════════════════════════════
//  « Une lecture identique ne part qu'une fois » (src/lecturesPartagees.js) —
//  la VRAIE règle EXÉCUTÉE contre un faux `fetch` qui compte ses appels.
//
//  Ce que la règle doit tenir, et que ce contrôle juge sur ce qui SE PASSE
//  (nombre d'appels réels, corps rendus), jamais sur l'orthographe du code :
//   1. deux lectures identiques simultanées = UN appel, deux corps lisibles ;
//   2. une autre session, une autre page (`Range`) = un autre appel (deux
//      vendeurs ne partagent jamais une réponse) ;
//   3. un ÉCHEC (522) n'est pas gardé : la lecture suivante réessaie, et celle
//      qui attendait voit l'échec (« pas su » reste « pas su ») ;
//   4. un réseau coupé : pareil ;
//   5. une écriture vide tout — y compris une lecture partie AVANT l'écriture
//      et revenue APRÈS ;
//   6. `invalider()` (le signal de l'extension) vide tout ;
//   7. passé la fenêtre, on relit ;
//   8. une autre adresse que notre base, une lecture annulable : jamais
//      partagées ;
//   9. un POST vers nos routes `/api/` vaut une écriture ;
//  10. une lecture PENDUE ne se partage plus au-delà de `VOL_MAX_MS` (22 oct.) ;
//  11. une écriture de lignes NOMMÉES ne vide que ce qui peut les porter (31 oct.) ;
//  12. un passage de FOND déclaré accepte une réponse de moins de 15 s (31 oct.).
//  `--prouve` réaffaiblit la règle (cinq mutations) et exige du ROUGE.
//  Lancer : node scripts/audit-lectures-partagees.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const SRC = path.join(__dirname, '..', 'src', 'lecturesPartagees.js');
const BASE = 'https://exemple.supabase.co';

async function charger(texte) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-'));
  const f = path.join(dir, 'lp.mjs');
  fs.writeFileSync(f, texte);
  return import(pathToFileURL(f).href);
}

async function verifier(mod) {
  let ko = 0; const echecs = [];
  const dit = (c, m, d) => { if (!c) { ko++; echecs.push(m); } if (!process.env.SILENCE) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null ? ' — ' + d : '')); };
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 160)); } };
  let t = 1000; const maintenant = () => t;
  const faux = () => {
    const appels = [];
    let suite = () => new Response(JSON.stringify([{ id: 'x', n: appels.length }]), { status: 200, headers: { 'content-type': 'application/json' } });
    const f = (url, init) => { appels.push({ url, init }); const r = suite(url, init); return r instanceof Promise ? r : Promise.resolve(r); };
    return { f, appels, servir: (g) => { suite = g; } };
  };
  const H = (auth, extra = {}) => ({ headers: { apikey: 'k', Authorization: 'Bearer ' + auth, ...extra } });
  const U = BASE + '/rest/v1/app_data?id=eq.main&select=data';

  await essaie('1. simultanées', async () => {
    const F = faux(); const lp = mod.creerLecturesPartagees(F.f, BASE, { maintenant });
    const [a, b] = await Promise.all([lp.fetch(U, H('A')), lp.fetch(U, H('A'))]);
    const [ja, jb] = await Promise.all([a.json(), b.json()]);
    dit(F.appels.length === 1, '1. deux lectures identiques simultanées : un seul appel', F.appels.length);
    dit(ja[0].id === 'x' && jb[0].id === 'x', '1. et chacune lit son corps', JSON.stringify([ja, jb]));
  });
  await essaie('2. clés', async () => {
    const F = faux(); const lp = mod.creerLecturesPartagees(F.f, BASE, { maintenant });
    await Promise.all([lp.fetch(U, H('A')), lp.fetch(U, H('B'))]);
    dit(F.appels.length === 2, '2. deux sessions (deux vendeurs) : deux appels, jamais une réponse partagée', F.appels.length);
    await Promise.all([lp.fetch(U, H('A', { Range: '0-999' })), lp.fetch(U, H('A', { Range: '1000-1999' }))]);
    dit(F.appels.length === 4, '2. deux pages `Range` : deux appels', F.appels.length);
  });
  await essaie('3. échec', async () => {
    const F = faux(); const lp = mod.creerLecturesPartagees(F.f, BASE, { maintenant });
    F.servir(() => new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } }));
    const [a, b] = await Promise.all([lp.fetch(U, H('A')), lp.fetch(U, H('A'))]);
    dit(!a.ok && !b.ok, '3. une lecture qui attendait voit l’ÉCHEC (pas su), pas une réponse inventée', `${a.status}/${b.status}`);
    F.servir(() => new Response('[]', { status: 200 }));
    const c = await lp.fetch(U, H('A'));
    dit(c.ok && F.appels.length === 2, '3. l’échec n’est pas gardé : la lecture suivante réessaie', `appels ${F.appels.length}, statut ${c.status}`);
  });
  await essaie('4. réseau', async () => {
    const F = faux(); const lp = mod.creerLecturesPartagees(F.f, BASE, { maintenant });
    F.servir(() => Promise.reject(new TypeError('Failed to fetch')));
    let rejet = 0; await lp.fetch(U, H('A')).catch(() => { rejet++; });
    F.servir(() => new Response('[]', { status: 200 }));
    const c = await lp.fetch(U, H('A'));
    dit(rejet === 1 && c.ok && F.appels.length === 2, '4. réseau coupé : rejeté, puis relu (jamais figé)', `rejets ${rejet}, appels ${F.appels.length}`);
  });
  await essaie('5. écriture', async () => {
    const F = faux(); const lp = mod.creerLecturesPartagees(F.f, BASE, { maintenant });
    await lp.fetch(U, H('A'));
    await lp.fetch(BASE + '/rest/v1/app_data', { method: 'POST', body: '[]', headers: { Authorization: 'Bearer A' } });
    await lp.fetch(U, H('A'));
    dit(F.appels.filter((x) => !x.init || !x.init.method).length === 2, '5. une écriture vide tout : la lecture d’après relit', F.appels.length);
    // Une lecture partie AVANT une écriture, revenue APRÈS, n'est pas gardée.
    lp.invalider();
    let libere; F.servir(() => new Promise((r) => { libere = () => r(new Response('[1]', { status: 200 })); }));
    const enVol = lp.fetch(U, H('A'));
    const avant = F.appels.length;
    F.servir(() => new Response('[]', { status: 201 }));
    await lp.fetch(BASE + '/rest/v1/app_data', { method: 'PATCH', body: '{}', headers: { Authorization: 'Bearer A' } });
    libere(); await enVol;
    F.servir(() => new Response('[2]', { status: 200 }));
    const apres = await (await lp.fetch(U, H('A'))).json();
    dit(apres[0] === 2 && F.appels.length === avant + 2, '5. une lecture partie avant une écriture n’est pas resservie après', `rendu ${JSON.stringify(apres)}`);
  });
  await essaie('6. signal', async () => {
    const F = faux(); const lp = mod.creerLecturesPartagees(F.f, BASE, { maintenant });
    await lp.fetch(U, H('A')); lp.invalider(); await lp.fetch(U, H('A'));
    dit(F.appels.length === 2, '6. le signal de l’extension (`invalider`) fait relire', F.appels.length);
  });
  await essaie('7. fenêtre', async () => {
    const F = faux(); const lp = mod.creerLecturesPartagees(F.f, BASE, { maintenant });
    await lp.fetch(U, H('A')); t += 500; await lp.fetch(U, H('A'));
    dit(F.appels.length === 1, '7. dans la fenêtre : la même réponse (une lecture évitée)', F.appels.length);
    t += mod.FENETRE_MS + 10; await lp.fetch(U, H('A'));
    dit(F.appels.length === 2, '7. passé la fenêtre : on relit', F.appels.length);
  });
  await essaie('8. hors champ', async () => {
    const F = faux(); const lp = mod.creerLecturesPartagees(F.f, BASE, { maintenant });
    await Promise.all([lp.fetch('https://vrm.center/api/sante'), lp.fetch('https://vrm.center/api/sante')]);
    dit(F.appels.length === 2, '8. une autre adresse que notre base n’est jamais partagée', F.appels.length);
    const ac = { signal: {} };
    await Promise.all([lp.fetch(U, { ...H('A'), ...ac }), lp.fetch(U, { ...H('A'), ...ac })]);
    dit(F.appels.length === 4, '8. une lecture annulable (`signal`) passe telle quelle', F.appels.length);
  });
  // 9. Nos routes serveur (`/api/…`) écrivent en base côté serveur : un POST vers
  //    elles vaut une écriture (banc revendeurs, 16 octobre : « Lire davantage de
  //    commandes » restait affiché sous « Lecture terminée », la relecture de
  //    `ebay_orders` rendait la ligne d'avant). Une lecture GET d'une route, elle,
  //    ne vide rien.
  await essaie('9. route serveur', async () => {
    const F = faux(); const lp = mod.creerLecturesPartagees(F.f, BASE, { maintenant, origine: 'https://vrm.center' });
    await lp.fetch(U, H('A'));
    await lp.fetch('/api/ebay', { method: 'POST', body: '{}' });
    await lp.fetch(U, H('A'));
    dit(F.appels.filter((x) => x.url === U).length === 2, '9. un POST vers /api/ (relatif) vide tout : la lecture d’après relit', F.appels.length);
    await lp.fetch('https://vrm.center/api/ebay', { method: 'POST', body: '{}' });
    await lp.fetch(U, H('A'));
    dit(F.appels.filter((x) => x.url === U).length === 3, '9. un POST vers https://vrm.center/api/ vide tout aussi', F.appels.length);
    await lp.fetch('/api/sante');
    await lp.fetch(U, H('A'));
    dit(F.appels.filter((x) => x.url === U).length === 3, '9. une lecture GET d’une route ne vide rien', F.appels.length);
  });
  // 10. (22 oct., revue) Une lecture PERDUE (réseau qui change, iPhone qui se
  //     réveille) ne répond jamais. Partagée sans limite, elle captait toutes
  //     les lectures identiques jusqu'à une écriture : « ↻ Actualiser » de
  //     l'écran Leboncoin ne relançait plus rien. Elle se partage tant qu'elle
  //     est jeune (deux lectures simultanées = un appel), plus au-delà de
  //     `VOL_MAX_MS` : la suivante repart sur le réseau, et elle répond.
  await essaie('10. lecture pendue', async () => {
    const F = faux(); const lp = mod.creerLecturesPartagees(F.f, BASE, { maintenant });
    const VOL = mod.VOL_MAX_MS || 8000;
    F.servir(() => new Promise(() => {}));          // ne répond jamais
    lp.fetch(U, H('A'));
    t += 100;
    lp.fetch(U, H('A'));
    dit(F.appels.length === 1, '10. une lecture en cours, jeune : partagée (un seul appel)', F.appels.length);
    F.servir(() => new Response('[{"id":"frais"}]', { status: 200 }));
    t += VOL + 10;
    const r = await Promise.race([lp.fetch(U, H('A')), new Promise((ok) => setTimeout(() => ok(null), 300))]);
    const j = r ? await r.json() : null;
    dit(F.appels.length === 2 && !!j && j[0].id === 'frais', '10. une lecture pendue depuis plus longtemps ne capte plus la suivante : elle repart sur le réseau et répond', `appels ${F.appels.length}, rendu ${JSON.stringify(j)}`);
  });
  // 11. (31 oct., banc vitesse) Une écriture de LIGNES NOMMÉES ne vide que les
  //     lectures qui peuvent les porter. Mesuré : la publication de
  //     `widget_stats` au démarrage faisait relire `lbc_ventes`, `ebay_orders`…
  //     Mais toute lecture qui PEUT porter la ligne écrite (même id, motif
  //     `like` qui la couvre, liste `in.`, aucun filtre d'id) est relue — y
  //     compris une lecture partie avant l'écriture et revenue après ; et une
  //     écriture qu'on ne sait pas nommer (`main`, filtre `like`, autre table,
  //     corps illisible) vide tout, comme avant.
  await essaie('11. écriture nommée', async () => {
    const F = faux(); const lp = mod.creerLecturesPartagees(F.f, BASE, { maintenant });
    const R = (q) => BASE + '/rest/v1/app_data?' + q;
    const lect = ['id=eq.lbc_ventes&select=data', 'id=eq.widget_stats&select=data', 'id=like.widget_*&select=id', 'id=in.(a,widget_stats)&select=id', 'select=id&limit=1', 'id=like.harvest_%25_txn_%25&select=id'];
    const lire = () => Promise.all(lect.map((q) => lp.fetch(R(q), H('A'))));
    const n = (q) => F.appels.filter((x) => x.url === R(q)).length;
    await lire();
    await lp.fetch(R('on_conflict=id'), { method: 'POST', body: JSON.stringify([{ id: 'widget_stats', data: {} }]), headers: { Authorization: 'Bearer A' } });
    await lire();
    dit(n(lect[0]) === 1 && n(lect[5]) === 1, '11. une écriture de `widget_stats` ne fait pas relire `lbc_ventes` ni les transactions', `${n(lect[0])}/${n(lect[5])}`);
    dit([1, 2, 3, 4].every((i) => n(lect[i]) === 2), '11. … mais relire tout ce qui peut la porter (même id, `like`, `in.`, sans filtre)', [1, 2, 3, 4].map((i) => n(lect[i])).join('/'));
    // partie AVANT l'écriture, revenue APRÈS : pas resservie
    let libere; F.servir(() => new Promise((r) => { libere = () => r(new Response('[1]', { status: 200 })); }));
    t += mod.FENETRE_MS + 100;
    const enVol = lp.fetch(R(lect[1]), H('A'));
    F.servir(() => new Response('[]', { status: 201 }));
    await lp.fetch(R('id=eq.widget_stats'), { method: 'PATCH', body: '{}', headers: { Authorization: 'Bearer A' } });
    libere(); await enVol;
    F.servir(() => new Response('[2]', { status: 200 }));
    const apres = await (await lp.fetch(R(lect[1]), H('A'))).json();
    dit(apres[0] === 2, '11. une lecture de la ligne partie avant son écriture n’est pas resservie après', JSON.stringify(apres));
    // ce qu'on ne sait pas nommer vide tout
    for (const [q, init] of [['on_conflict=id', { method: 'POST', body: JSON.stringify({ id: 'main', data: {} }) }], ['id=like.widget_*', { method: 'DELETE' }], ['on_conflict=id', { method: 'POST', body: '[]' }]]) {
      const avant = n(lect[0]);
      await lp.fetch(R(lect[0]), H('A'));
      const lu = n(lect[0]);
      await lp.fetch(R(q), { ...init, headers: { Authorization: 'Bearer A' } });
      await lp.fetch(R(lect[0]), H('A'));
      dit(n(lect[0]) === lu + 1, `11. une écriture qu’on ne sait pas nommer vide tout (${init.method} ${q} ${init.body || ''})`, `${avant}→${lu}→${n(lect[0])}`);
    }
    const V = BASE + '/rest/v1/vinted_accounts?select=*';
    await lp.fetch(V, H('A'));
    await lp.fetch(BASE + '/rest/v1/vinted_accounts?id=eq.3', { method: 'DELETE', headers: { Authorization: 'Bearer A' } });
    await lp.fetch(V, H('A'));
    dit(F.appels.filter((x) => x.url === V).length === 2, '11. une écriture d’une autre table vide tout', F.appels.filter((x) => x.url === V).length);
  });
  // 12. (31 oct.) Un passage de FOND déclaré (`vrmFond`) accepte une réponse
  //     réussie de moins de `FENETRE_FOND_MS` ; une lecture ordinaire, non.
  //     Jamais d'avant une écriture de la ligne, ni d'avant un signal.
  await essaie('12. fond', async () => {
    const F = faux(); const lp = mod.creerLecturesPartagees(F.f, BASE, { maintenant });
    const FOND = mod.FENETRE_FOND_MS || 0;
    const fond = (a) => ({ ...H(a), vrmFond: true });
    await lp.fetch(U, H('A'));
    t += mod.FENETRE_MS + 500;
    await lp.fetch(U, fond('A'));
    dit(F.appels.length === 1 && FOND > mod.FENETRE_MS, '12. un passage de fond, 2,5 s après : la même réponse (une lecture évitée)', F.appels.length);
    await lp.fetch(U, H('A'));
    dit(F.appels.length === 2, '12. … une lecture ordinaire au même moment relit', F.appels.length);
    t += 500; await lp.fetch(U, fond('B'));
    dit(F.appels.length === 3, '12. une autre session ne reçoit jamais la réponse d’une autre, même en fond', F.appels.length);
    t += FOND + 10; await lp.fetch(U, fond('A'));
    dit(F.appels.length === 4, '12. passé la fenêtre de fond : on relit', F.appels.length);
    await lp.fetch(BASE + '/rest/v1/app_data?on_conflict=id', { method: 'POST', body: JSON.stringify({ id: 'main', data: {} }), headers: { Authorization: 'Bearer A' } });
    t += 100; await lp.fetch(U, fond('A'));
    dit(F.appels.length === 6, '12. une écriture de la ligne : le fond relit aussi', F.appels.length);
    lp.invalider(); t += 100; await lp.fetch(U, fond('A'));
    dit(F.appels.length === 7, '12. un signal de l’extension : le fond relit aussi', F.appels.length);
    F.servir(() => new Response('<html>522</html>', { status: 522 }));
    t += 100; lp.invalider(); await lp.fetch(U, H('A'));
    F.servir(() => new Response('[]', { status: 200 }));
    t += 100; const r = await lp.fetch(U, fond('A'));
    dit(r.ok && F.appels.length === 9, '12. un échec n’est jamais resservi au fond', `${F.appels.length} · ${r.status}`);
  });
  return { ko, echecs };
}

(async () => {
  const texte = fs.readFileSync(SRC, 'utf8');
  console.log('── src/lecturesPartagees.js');
  const r = await verifier(await charger(texte));
  let ko = r.ko;
  if (process.argv.includes('--prouve')) {
    const MUT = {
      'echec-garde': [/if \(!r \|\| !r\.ok \|\| monGen !== gen\) \{ cache\.delete\(cle\); return; \}/, 'if (monGen !== gen) { cache.delete(cle); return; }'],
      'sans-session': [/const cle = url \+ '\\n' \+ ENTETES_CLE\.map\(\(n\) => lireEntete\(h, n\)\)\.join\('\\n'\);/, "const cle = url;"],
      'route-ignoree': [/const versRoute = [^;]+;/, 'const versRoute = false;'],
      'vol-sans-fin': [/date - v\.debut >= volMax|maintenant\(\) - e\.debut < volMax/g, m => m.startsWith('date') ? 'false' : 'true'],
      'ligne-jamais-touchee': [/return ids\.includes\(v\.slice\(3\)\);/, 'return false;'],
      'tout-precis': [/if \(!ids\.length \|\| ids\.some\(\(x\) => !x \|\| PAS_PRECIS\.has\(x\)\)\) return null;/, ''],
      'like-ignore': [/return ids\.some\(\(x\) => re\.test\(x\)\);/, 'return false;'],
      'fond-partout': [/const accepte = init && init\.vrmFond === true \? fenetreFond : fenetre;/, 'const accepte = fenetreFond;'],
      'fond-sans-fenetre': [/maintenant\(\) - e\.fin < accepte/, 'true'],
      'ecriture-ignoree': [/      vider\(\);\n      const p = fetchOrig\(input, init\);\n      Promise\.resolve\(p\)\.then\(vider, vider\);\n      return p;/, '      return fetchOrig(input, init);'],
    };
    for (const [nom, [re, rep]] of Object.entries(MUT)) {
      if (!re.test(texte)) { console.log(`  ❌ mutation ${nom} : motif introuvable`); ko++; continue; }
      process.env.SILENCE = '1';
      const m = await verifier(await charger(texte.replace(re, rep)));
      delete process.env.SILENCE;
      const rouge = m.ko > 0;
      console.log(`  ${rouge ? '✅' : '❌'} mutation « ${nom} » : ${m.ko} rouge(s)${rouge ? ' — ' + m.echecs.slice(0, 2).join(' | ') : ' — LE CONTRÔLE NE MORD PAS'}`);
      if (!rouge) ko++;
    }
  }
  console.log(ko ? `\n❌ ${ko} échec(s)` : '\n✅ tout est vert');
  process.exit(ko ? 1 : 0);
})();
