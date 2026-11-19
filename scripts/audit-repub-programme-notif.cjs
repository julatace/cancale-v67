// ════════════════════════════════════════════════════════════════════════════
//  « REPUBLICATION PROGRAMMÉE PAS PARTIE » QUAND AUCUN APPAREIL N'A LANCÉ
//  (16 nov., lot extension-restes) — api/_lib/repub-programme-notif.js, l'index
//  `indexAttentes` de src/repubProgramme.js, et LA VRAIE ROUTE
//  `api/ship-reminders.js?moment=groupe` sur une fausse base à la vraie forme
//  (projection `select=`, filtre `and=(data->>prochaineFin.lt…,…gt…)`, owner).
//  Données inventées (le dépôt est public).
//   A  l'index : les programmations EN ATTENTE en bref (jamais les réglages ni
//      les paires), `prochaineFin` = la plus proche heure + 10 min ; écrit par
//      `modifierProgrammes` à chaque écriture de la ligne.
//   B  la règle : avant l'heure + 15 min ⇒ rien ; après ⇒ due ; plus de 24 h ⇒
//      rien ; déjà dite ⇒ rien ; fenêtre = celle de l'app.
//   C  la route : UNE notification (famille Rappels, Annonces → Republier),
//      mémo écrit AVANT l'envoi ; mémo pas écrit / illisible ⇒ rien ; ligne lue
//      PROJETÉE sur `attentes` (jamais select=data) ; vendeur sans retard ⇒ pas
//      lu ; « Rappels » coupée ⇒ rien ; la ligne `vrm_repub_programme` n'est
//      JAMAIS écrite par le serveur ; la réponse ne porte que des nombres.
//  `--prouve` : mutations ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const iSur = process.argv.indexOf('--sur');
const R = iSur > 0 ? path.resolve(process.argv[iSur + 1]) : RACINE;
const NM = path.join(RACINE, 'node_modules');

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['la marge de l’appareil oubliée', 'api/_lib/repub-programme-notif.js', 'if (maintenant < at + FENETRE_DEPART_MS + MARGE_APPAREIL_MS) continue;', 'if (maintenant < at) continue;'],
    ['dite deux fois', 'api/_lib/repub-programme-notif.js', '    if (vus[cleManque(a)]) continue;\n', ''],
    ['mémo illisible pris pour vide', 'api/ship-reminders.js', "    if (memo === undefined) return { etat: 'memo-illisible' };\n    const envoyes = memo && memo.envoyes;\n    const dus = programmesManques(", "    const envoyes = memo && memo.envoyes;\n    const dus = programmesManques("],
    ['l’index n’est plus posé', 'src/repubProgramme.js', "return out && typeof out === 'object' ? { ...out, ...indexAttentes(out) } : out;", 'return out;'],
    ['famille ignorée', 'api/ship-reminders.js', "    if (!(await pushCategorieActive('rappel'))) return { etat: 'coupe', n: dus.length };\n    if (!(await ecrireDedup(MEMO_REPUB_PROG", "    if (!(await ecrireDedup(MEMO_REPUB_PROG"],
  ];
  let rouges = 0;
  for (const [nom, fichier, avant, apres] of MUT) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'repubprog-mut-'));
    for (const x of ['api', 'src', 'scripts']) fs.cpSync(path.join(RACINE, x), path.join(d, x), { recursive: true });
    fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(d, 'package.json'));
    const f = path.join(d, fichier); const t = fs.readFileSync(f, 'utf8');
    if (!t.includes(avant)) { console.log(`❌ mutation « ${nom} » : texte introuvable`); rouges = -999; fs.rmSync(d, { recursive: true, force: true }); continue; }
    fs.writeFileSync(f, t.replace(avant, apres));
    let code = 0;
    try { execFileSync(process.execPath, [path.join(d, 'scripts', 'audit-repub-programme-notif.cjs'), '--sur', d], { stdio: 'pipe', env: { ...process.env, NODE_PATH: NM } }); } catch (e) { code = e.status || 1; }
    console.log(`${code ? '✅' : '❌'} mutation « ${nom} » ⇒ ${code ? 'rouge (attendu)' : 'VERT : l’audit ne la voit pas'}`);
    if (code) rouges++;
    fs.rmSync(d, { recursive: true, force: true });
  }
  console.log(`\n${rouges}/${MUT.length} mutations rouges`);
  process.exit(rouges === MUT.length ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + String(det).slice(0, 600) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${String((e && e.stack) || e).slice(0, 500)}`); return null; } };
const charge = (f) => import('file://' + path.join(R, f));

(async () => {
  let P = null, N = null;
  await essaie('A. l’index', async () => {
    P = await charge('src/repubProgramme.js'); N = await charge('api/_lib/repub-programme-notif.js');
    const t0 = Date.parse('2026-11-16T17:00:00Z');
    const a = P.creerProgramme({ uid: '111', compte: 'shop_a', action: 'recreer', ids: ['1', '2', '3'], at: t0, reglages: { titre: 'SECRET-TITRE' }, maintenant: t0 - 3600e3, alea: () => 0.5 });
    const b = P.creerProgramme({ uid: '222', compte: 'shop_b', action: 'enLigne', ids: ['9'], at: t0 + 3600e3, reglages: {}, maintenant: t0 - 3600e3, alea: () => 0.5 });
    let d = P.poserProgramme({}, a.prog).data; d = P.poserProgramme(d, b.prog).data;
    d = { ...d, programmes: { ...d.programmes, 333: { ...b.prog, uid: '333', id: 'x', etat: 'finie' } } };
    const ix = P.indexAttentes(d);
    dit(ix.attentes.length === 2 && ix.prochaineFin === new Date(t0 + P.FENETRE_DEPART_MS).toISOString(), 'A1 index : les 2 en attente (pas la finie), `prochaineFin` = la plus proche heure + 10 min', JSON.stringify(ix));
    dit(!/SECRET-TITRE|"ids"|reglages/.test(JSON.stringify(ix)) && ix.attentes.find((x) => x.uid === '111').n === 3, 'A2 index : ni réglages ni paires — le compte, l’heure, le nombre', JSON.stringify(ix.attentes));
    dit(P.indexAttentes({}).prochaineFin === null && P.indexAttentes({}).attentes.length === 0, 'A3 rien en attente ⇒ `prochaineFin` null (la base ne le sélectionne plus)');
    // modifierProgrammes pose l'index à chaque écriture (ligne de cas inventée).
    let ecrit = null;
    const ctx = { url: 'https://base.invalid', entetes: () => ({}), avecOwner: (x) => x, owner: 'o', cloisonne: true };
    const fetch0 = global.fetch;
    global.fetch = async (u, o = {}) => {
      const m = (o.method || 'GET').toUpperCase();
      if (m === 'GET') return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
      try { const b0 = JSON.parse(o.body || 'null'); ecrit = Array.isArray(b0) ? b0[0] : b0; } catch (_) {}
      return new Response(JSON.stringify([{ id: P.LIGNE_PROGRAMME, data: ecrit && ecrit.data }]), { status: 201, headers: { 'content-type': 'application/json' } });
    };
    try { await P.modifierProgrammes((dd) => P.poserProgramme(dd, a.prog), ctx); } finally { global.fetch = fetch0; }
    const dataE = ecrit && (ecrit.data || ecrit);
    dit(!!dataE && dataE.prochaineFin === new Date(t0 + P.FENETRE_DEPART_MS).toISOString() && Array.isArray(dataE.attentes) && dataE.attentes.length === 1, 'A4 `modifierProgrammes` écrit l’index avec la ligne', JSON.stringify(dataE && { f: dataE.prochaineFin, a: dataE.attentes }));
    dit(N.FENETRE_DEPART_MS === P.FENETRE_DEPART_MS, 'A5 la fenêtre du serveur = celle de l’app (10 min)');
  });

  await essaie('B. la règle', async () => {
    const at = '2026-11-16T17:00:00.000Z', t = Date.parse(at);
    const L = [{ uid: '111', id: 'p1', at, compte: 'shop_a', n: 3 }];
    dit(N.programmesManques(L, {}, t + 12 * 60000).length === 0, 'B1 à 17 h 12 (fenêtre + marge pas finies) : rien');
    const dus = N.programmesManques(L, {}, t + 16 * 60000);
    dit(dus.length === 1 && dus[0].id === 'p1', 'B2 à 17 h 16 : due');
    dit(N.programmesManques(L, {}, t + 25 * 3600e3).length === 0, 'B3 plus de 24 h après : rien');
    dit(N.programmesManques(L, N.memoApres({}, dus, t), t + 30 * 60000).length === 0, 'B4 déjà dite : rien');
    dit(N.programmesManques(null, {}, t) === null, 'B5 index illisible ⇒ `null` (pas su), jamais « rien »');
    const tx = N.texteManque(dus);
    dit(tx && /pas partie/.test(tx.title) && /shop_a/.test(tx.body) && /3 annonces/.test(tx.body) && /18 h 00/.test(tx.body), 'B6 le texte : l’heure de Paris, le compte, le nombre', JSON.stringify(tx));
  });

  await essaie('C. api/ship-reminders.js?moment=groupe', async () => {
    const J = '11111111-1111-4111-8111-111111111111', K = '22222222-2222-4222-8222-222222222222';
    let base = new Map(), panne = new Set(), journal = [], ordreE = [], ecritsProg = 0;
    const k = (o, i) => o + '|' + i;
    const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': status >= 500 ? 'text/html' : 'application/json' } });
    const projeter = (sel, id, owner, d) => {
      if (!sel || sel === 'data') return { id, owner, data: d };
      const out = {};
      for (const part of sel.split(',')) {
        if (part === 'owner') { out.owner = owner; continue; }
        if (part === 'id') { out.id = id; continue; }
        if (part === 'data') { out.data = d; continue; }
        const m = /^([a-zA-Z0-9_]+):data(->>?)(.+)$/.exec(part);
        if (!m) continue;
        let v = d; for (const seg of m[3].split(/->>?/)) v = v == null ? undefined : v[seg];
        out[m[1]] = m[2] === '->>' && v != null && typeof v === 'object' ? JSON.stringify(v) : (v === undefined ? null : v);
      }
      return out;
    };
    const filtreOk = (q, d) => {
      const et = q.get('and');
      if (et) {
        for (const m of String(et).replace(/^\(|\)$/g, '').split(',')) {
          const f = /^data->>(\w+)\.(lt|gt)\.(.+)$/.exec(m); if (!f) return false;
          const v = d[f[1]], w = decodeURIComponent(f[3]);
          if (v == null || (f[2] === 'lt' && !(String(v) < w)) || (f[2] === 'gt' && !(String(v) > w))) return false;
        }
      }
      return true;
    };
    global.fetch = async (url, o = {}) => {
      const u = new URL(String(url)); const q = u.searchParams; const m = (o.method || 'GET').toUpperCase();
      journal.push(`${m} ${decodeURIComponent(u.pathname + u.search)}`);
      if (u.pathname.endsWith('/rpc/vrm_acces_pour')) return rep(true);
      if (!u.pathname.endsWith('/rest/v1/app_data')) return rep([]);
      const id = (q.get('id') || '').replace(/^eq\./, ''); const owner = (q.get('owner') || '').replace(/^eq\./, '');
      const sel = q.get('select') || '';
      if (m === 'GET') {
        if (sel === 'owner' && q.get('limit') === '1') return rep([{ owner: J }]);
        if (panne.has(id)) return rep('<html>522</html>', 522);
        if (!id) return rep([]);
        const rows = [];
        for (const [kk, d] of base) { const [ow, i] = kk.split('|'); if (i !== id || (owner && ow !== owner)) continue; if (filtreOk(q, d)) rows.push(projeter(sel, i, ow, d)); }
        return rep(rows);
      }
      if (m === 'POST') {
        const ls = JSON.parse(o.body || '[]'); const out = [];
        for (const l of (Array.isArray(ls) ? ls : [ls])) {
          if (panne.has('ecrire:' + l.id)) return rep('<html>503</html>', 503);
          if (l.id === N.MEMO_PROGRAMME) ordreE.push('memo');
          if (l.id === N.LIGNE_PROGRAMME) ecritsProg++;
          base.set(k(l.owner || J, l.id), JSON.parse(JSON.stringify(l.data))); out.push({ id: l.id });
        }
        return rep(out, 201);
      }
      if (m === 'PATCH') { if (id === N.LIGNE_PROGRAMME) ecritsProg++; const kk = k(owner || J, id); if (!base.has(kk)) return rep([]); base.set(kk, JSON.parse(o.body).data); return rep([{ id }]); }
      return rep([]);
    };
    process.env.CRON_SECRET = 'secret-banc'; process.env.SUPABASE_SERVICE_KEY = 'cle-de-service-de-banc';
    process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
    const webpush = require(path.join(NM, 'web-push'));
    const pushes = [];
    webpush.sendNotification = async (sub, body) => { ordreE.push('push'); pushes.push(JSON.parse(body)); return { statusCode: 201 }; };
    const route = (await charge('api/ship-reminders.js')).default;
    const PushL = await charge('api/_lib/push.js');
    const aHeure = (iso) => { process.env.VRM_NOTIF_HORLOGE = iso; };
    const appel = async () => {
      if (PushL.oublierPrefsVues) PushL.oublierPrefsVues();
      const r = { code: 0, corps: null, setHeader() {}, status(c) { r.code = c; return r; }, json(b) { r.corps = b; return r; }, send(b) { r.corps = b; return r; }, end() { return r; } };
      await route({ method: 'GET', headers: { authorization: 'Bearer secret-banc' }, query: { moment: 'groupe' } }, r);
      return r;
    };
    const t0 = Date.parse('2026-11-16T17:00:00Z');
    const prog = P.creerProgramme({ uid: '111', compte: 'shop_a', action: 'recreer', ids: ['1', '2', '3'], at: t0, reglages: { titre: 'SECRET-TITRE', lourd: 'x'.repeat(2000) }, maintenant: t0 - 3600e3, alea: () => 0.5 }).prog;
    const prepare = ({ prefs = {}, avecProg = true } = {}) => {
      base = new Map(); panne = new Set(); pushes.length = 0; ordreE = []; journal = []; ecritsProg = 0;
      if (avecProg) { const d = P.poserProgramme({}, prog).data; base.set(k(J, N.LIGNE_PROGRAMME), { ...d, ...P.indexAttentes(d), rev: 2 }); }
      // Un autre vendeur, programmation à venir : jamais lu.
      { const p2 = { ...prog, uid: '999', id: 'autre', at: t0 + 3 * 3600e3 }; const d2 = P.poserProgramme({}, p2).data; base.set(k(K, N.LIGNE_PROGRAMME), { ...d2, ...P.indexAttentes(d2), rev: 1 }); }
      base.set(k(J, 'main'), { rev: 3 });
      base.set(k(J, 'push_subs'), { subs: [{ endpoint: 'https://web.push.apple.com/iphone-banc', keys: { p256dh: 'x', auth: 'y' } }] });
      base.set(k(J, 'push_prefs'), prefs);
      base.set(k(J, 'push_journal_lu'), {});
    };
    prepare(); aHeure('2026-11-16T17:08:00Z');
    let r = await appel();
    dit(pushes.length === 0 && r.corps && r.corps.repubProg && r.corps.repubProg.fait === true && r.corps.repubProg.vendeurs === 0, 'C1 à 18 h 08 Paris (dans la fenêtre) : rien, personne n’est lu', JSON.stringify(r.corps && r.corps.repubProg));
    aHeure('2026-11-16T17:20:00Z');
    r = await appel();
    const p = pushes[0] || {};
    dit(pushes.length === 1 && /pas partie/.test(p.title || '') && /shop_a/.test(p.body || '') && /18 h 00/.test(p.body || ''), 'C2 à 18 h 20 : UNE notification « Republication programmée pas partie »', JSON.stringify(pushes.map((x) => [x.title, x.body])));
    dit(/tab=annonces/.test(p.url || '') && /vue=republier/.test(p.url || ''), 'C3 elle ouvre Annonces → Republier', p.url);
    dit(ordreE.indexOf('memo') >= 0 && ordreE.indexOf('memo') < ordreE.indexOf('push'), 'C4 le mémo est écrit AVANT l’envoi', ordreE.join(','));
    const reqP = journal.filter((x) => x.includes('id=eq.' + N.LIGNE_PROGRAMME));
    dit(reqP.some((x) => /and=\(data->>prochaineFin\.lt\./.test(x) && /select=owner/.test(x)) && reqP.some((x) => /select=attentes:data->attentes/.test(x)) && !reqP.some((x) => /select=data(&|$)/.test(x)), 'C5 la ligne : vendeurs choisis par la base (`prochaineFin`), lue PROJETÉE sur `attentes` (jamais select=data)', reqP.join(' ; '));
    dit(!reqP.some((x) => x.includes('owner=eq.' + K) && /attentes/.test(x)), 'C6 le vendeur sans retard n’est pas lu');
    dit(ecritsProg === 0, 'C7 le serveur n’écrit JAMAIS `vrm_repub_programme` (le départ reste à l’appareil)');
    dit(!/SECRET|shop_a|"111"/.test(JSON.stringify(r.corps && r.corps.repubProg)), 'C8 la réponse du cron ne porte que des nombres', JSON.stringify(r.corps && r.corps.repubProg));
    aHeure('2026-11-16T17:35:00Z'); pushes.length = 0;
    r = await appel();
    dit(pushes.length === 0, 'C9 le passage suivant : rien deux fois');
    prepare(); aHeure('2026-11-16T17:20:00Z'); panne.add('ecrire:' + N.MEMO_PROGRAMME);
    r = await appel();
    dit(pushes.length === 0, 'C10 mémo pas écrit ⇒ rien ne part');
    prepare(); aHeure('2026-11-16T17:20:00Z'); panne.add(N.MEMO_PROGRAMME);
    r = await appel();
    dit(pushes.length === 0, 'C11 mémo illisible ⇒ rien (« pas su » ≠ « jamais dit »)');
    prepare({ prefs: { familles: { rappels: false } } }); aHeure('2026-11-16T17:20:00Z');
    r = await appel();
    dit(pushes.length === 0, 'C12 famille « Rappels » coupée ⇒ rien');
    prepare(); aHeure('2026-11-17T18:00:00Z');
    r = await appel();
    dit(pushes.length === 0, 'C13 plus de 24 h après l’heure ⇒ rien');
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
