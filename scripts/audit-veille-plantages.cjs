// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LA VEILLE DES PLANTAGES — node scripts/audit-veille-plantages.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (6 nov., filet 4) Le cron du matin relève les plantages notés depuis la
// dernière veille et prévient le PROPRIÉTAIRE de l'installation d'un type
// JAMAIS VU (api/_lib/veille-plantages.js, branché dans api/ship-reminders.js).
// Cet audit EXÉCUTE la règle et la vraie route (fausse base, faux Web Push) :
//   A. la règle : bruit connu écarté (liste BRUIT de src/plantages.js, morceaux
//      d'un ancien déploiement, signalements CSP), regroupement par message
//      normalisé (noms minifiés et fichiers hachés), fenêtre, texte clair ;
//   B. la route : une notification au propriétaire seulement (jamais à un
//      vendeur), une fois par type, mémo écrit AVANT l'envoi, mémo pas écrit ⇒
//      rien, lecture ratée ⇒ rien, la lecture projette (jamais `select=data`)
//      et pagine, le passage du soir ne la porte pas, l'app n'y gagne aucune
//      lecture (rien dans src/App.jsx ne lit `veille_plantages`).
// `--prouve` : réaffaiblit la règle et la route, une mutation à la fois, et
// exige que l'audit devienne ROUGE (puis remet les fichiers à l'identique).
// Données INVENTÉES. Aucune donnée réelle, aucun réseau.
'use strict';
const path = require('path'), fs = require('fs');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');

if (process.argv.includes('--prouve')) {
  const LIB = path.join(R, 'api', '_lib', 'veille-plantages.js');
  const CRON = path.join(R, 'api', 'ship-reminders.js');
  const PL = path.join(R, 'src', 'plantages.js');
  const MUTS = [
    ['bruit connu compté', LIB, '  if (BRUIT.test(m)) return true;\n', ''],
    ['morceau périmé compté', LIB, '  if (estMorceauPerime(m)) return true;\n', ''],
    ['CSP compté', LIB, "  if (String((l && l.origine) || '') === 'csp' || /^CSP /.test(m)) return true;\n", ''],
    ['noms minifiés gardés (un type par déploiement)', LIB, ".replace(/(['\"`])[A-Za-z_$][\\w$]{0,2}\\1/g, '$1?$1')", ''],
    ['fichiers hachés gardés', LIB, ".replace(/\\/assets\\/([A-Za-z0-9_]+)-[A-Za-z0-9_-]{6,}\\.(js|css)/g, '/assets/$1.$2')", ''],
    ['déjà vu renvoyé', LIB, '  return (groupes || []).filter((g) => !vus[g.cle]);', '  return (groupes || []);'],
    ['mémo illisible pris pour vide', LIB, "  if (memo === undefined) return { fait: false, raison: 'mémo illisible : rien envoyé' };\n", ''],
    ['lecture ratée prise pour vide (le mémo avance, la fenêtre est perdue)', LIB, "  if (!Array.isArray(lignes)) return { fait: false, raison: 'plantages illisibles : rien envoyé' };\n", ''],
    ['envoi sans mémo confirmé', LIB, "  if (!(await ecrireMemo(suite))) return { fait: false, raison: 'mémo pas écrit : rien envoyé (sinon chaque matin)', nouveaux: nouveaux.length };\n", '  await ecrireMemo(suite);\n'],
    ['envoi au vendeur au lieu du propriétaire', CRON, "  const proprietaire = process.env.VRM_OWNER_UID || '';\n  return contexteVendeur.run", "  const proprietaire = ((await ownersActifs()) || []).slice(-1)[0] || '';\n  return contexteVendeur.run"],
    ['lecture complète (select=data)', CRON, "&select=${SELECT_VEILLE}", '&select=owner,id,data'],
    ['le soir aussi', CRON, 'if (!soir && !reveil) { try { veille = await', 'if (true) { try { veille = await'],
    ['BRUIT vidé dans l’app', PL, 'export const BRUIT = /ResizeObserver loop|', 'export const BRUIT = /^$/; const BRUIT_ANCIEN = /ResizeObserver loop|'],
  ];
  let rouges = 0;
  const origines = new Map();
  const remettre = () => { for (const [f, t] of origines) fs.writeFileSync(f, t); };
  process.on('exit', remettre);
  for (const [nom, f, avant, apres] of MUTS) {
    const src = origines.get(f) || fs.readFileSync(f, 'utf8');
    origines.set(f, src);
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : le motif n'existe plus (la mutation ne prouve rien)`); rouges = -999; continue; }
    try {
      fs.writeFileSync(f, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 300000 });
      const rouge = r.status !== 0;
      if (rouge) rouges++;
      console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(f, src); }
  }
  remettre();
  const ok = rouges === MUTS.length;
  console.log(`\n${ok ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(ok ? 0 : 1);
}

process.env.CRON_SECRET = 'cle-banc-veille';
const PROPRIO = '11111111-2222-3333-4444-555555555555';
const VENDEUR = '66666666-7777-8888-9999-000000000000';
process.env.VRM_OWNER_UID = PROPRIO;
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String((e && e.stack) || e).slice(0, 400)); } };
const H = 3600e3;
const iso = (ms) => new Date(ms).toISOString();

(async () => {
  let L = null;
  // ── A. la règle ──────────────────────────────────────────────────────────
  console.log('── A. la règle (api/_lib/veille-plantages.js)');
  await essaie('A', async () => {
    L = await import('file://' + path.join(R, 'api', '_lib', 'veille-plantages.js'));
    const P = await import('file://' + path.join(R, 'src', 'plantages.js'));
    const now = Date.parse('2026-11-06T05:00:00Z');
    const l = (message, extra = {}) => Object.assign({ message, ecran: 'cat_bord', navigateur: 'iOS Safari', at: iso(now - 2 * H), owner: VENDEUR }, extra);
    dit(L.estBruit(l('ResizeObserver loop limit exceeded')) && L.estBruit(l('Failed to fetch')) && L.estBruit(l('Load failed')), 'A1 le bruit connu (BRUIT de src/plantages.js) est écarté');
    dit(P.BRUIT && P.BRUIT.test('kagi.executeCallback is not a function'), 'A2 la liste BRUIT est celle de l’app (exportée, importée, jamais recopiée)');
    dit(L.estBruit(l('Unable to preload CSS for /assets/App-CM2cYfGZ.css')) && L.estBruit(l('Failed to fetch dynamically imported module: https://vrm.center/assets/Communaute-x.js')), 'A3 un morceau d’un ancien déploiement (rattrapé par rechargement) n’est pas un plantage');
    dit(L.estBruit(l('CSP connect-src ← https://exemple.test (report-only)', { origine: 'csp' })), 'A4 un signalement de la politique de contenu n’est pas un plantage');
    dit(!L.estBruit(l("Cannot access 'xe' before initialization")), 'A5 une vraie erreur de l’app compte');
    dit(L.cleType("Cannot access 'xe' before initialization") === L.cleType("Cannot access 'Qb' before initialization"), 'A6 un nom minifié qui change d’un déploiement à l’autre garde le même type');
    dit(L.cleType('ab is not defined') === L.cleType('Zq is not defined') && L.cleType('e.map is not a function') === L.cleType('t.map is not a function'), 'A7 « x is not defined » / « x.map is not a function » : un type quel que soit le nom minifié');
    dit(L.cleType("Cannot read properties of undefined (reading 'title')") !== L.cleType("Cannot read properties of undefined (reading 'numero')"), 'A8 deux propriétés du code (« title », « numero ») = deux types');
    dit(L.cleType('Erreur dans /assets/App-AAAAAAAA.js') === L.cleType('Erreur dans /assets/App-BBBBBBBB.js'), 'A9 un fichier haché change à chaque déploiement : même type');
    const groupes = L.regrouper([
      l("Cannot access 'xe' before initialization"),
      l("Cannot access 'Qb' before initialization", { ecran: 'ventes', navigateur: 'Mac Chrome' }),
      l('ResizeObserver loop limit exceeded'),
      l('ancienne erreur', { at: iso(now - 72 * H) }),
      l('sans date', { at: '' }),
    ], now - 48 * H);
    dit(groupes.length === 1 && groupes[0].n === 2, 'A10 regroupées par type : deux fois la même erreur = un groupe ; bruit, hors fenêtre et sans date écartés', JSON.stringify(groupes.map((g) => [g.message, g.n])));
    const t1 = L.texteVeille([L.regrouper([l("Cannot access 'xe' before initialization")], 0)[0]]);
    console.log('     téléphone : « ' + t1.body + ' »');
    dit(t1.body === 'VRM : un écran a planté (Colis, iPhone) — c’est noté, on corrige.', 'A11 le texte dit l’écran et l’appareil, en clair', t1.body);
    const t2 = L.texteVeille(L.regrouper([l('a is not defined'), l("Cannot read properties of undefined (reading 'title')", { ecran: 'ventes', navigateur: 'Windows Edge' })], 0));
    dit(/^VRM : 2 nouveaux plantages \(Colis, iPhone · Ventes, Windows\)/.test(t2.body), 'A12 plusieurs types : un seul message qui les compte', t2.body);
    dit(!/\d{6,}|@/.test(t1.body + t2.body) && !/[0-9a-f]{8}-/.test(t1.body + t2.body), 'A13 aucune donnée de vendeur dans le texte (ni identifiant, ni e-mail)');
    const memo = L.memoApres({ vus: { ancien: { at: iso(now - 9 * 864e5) } } }, groupes, now);
    dit(memo.vus.ancien && memo.vus[groupes[0].cle] && memo.derniere === iso(now), 'A14 le mémo garde les types connus et ajoute les nouveaux');
    dit(L.nouveauxGroupes(groupes, memo).length === 0 && L.nouveauxGroupes(groupes, null).length === 1, 'A15 un type déjà dans le mémo n’est plus nouveau');
  });

  // ── B. la vraie route du cron ─────────────────────────────────────────────
  console.log('\n── B. la route du cron (fausse base, faux Web Push)');
  const webpush = require(path.join(R, 'node_modules', 'web-push'));
  const journal = [];
  const pushes = [];
  webpush.setVapidDetails = () => {};
  webpush.sendNotification = async (sub, body) => { const p = JSON.parse(body); pushes.push({ ...p, endpoint: sub.endpoint }); journal.push('push:' + (p.body || '')); return { statusCode: 201 }; };
  let CFG, lectures;
  const reset = (cfg) => {
    pushes.length = 0; journal.length = 0; lectures = [];
    CFG = Object.assign({
      plantages: [
        { owner: VENDEUR, id: 'plantage_abc', message: "Cannot access 'xe' before initialization", ecran: 'cat_bord', navigateur: 'iOS Safari', at: iso(Date.now() - 2 * H), origine: 'ecran' },
        { owner: PROPRIO, id: 'plantage_def', message: 'ResizeObserver loop limit exceeded', ecran: 'ventes', navigateur: 'Mac Chrome', at: iso(Date.now() - 3 * H), origine: 'page' },
      ],
      memo: null, ko: {}, memoEcritKO: false,
    }, cfg);
  };
  const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
  const KO = () => new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
  global.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    const meth = (opts.method || 'GET').toUpperCase();
    if (/\/rpc\/vrm_acces_pour/.test(u)) return J(true);
    if (meth !== 'GET') {
      let corps = null; try { corps = JSON.parse(opts.body); } catch (_) {}
      const row = Array.isArray(corps) && corps[0];
      if (row && row.id === 'veille_plantages') { journal.push('memo:' + row.owner + ':' + Object.keys((row.data && row.data.vus) || {}).length); if (CFG.memoEcritKO) return new Response('', { status: 500 }); }
      return new Response('', { status: 201 });
    }
    if (/select=owner&limit=1/.test(u)) return J([{ owner: PROPRIO }]);
    if (/id=eq\.main/.test(u) && /select=owner(&|$)/.test(u)) return J([{ owner: PROPRIO }, { owner: VENDEUR }]);
    if (/id=like\.plantage_/.test(u)) {
      lectures.push({ u, range: (opts.headers || {}).Range || null });
      return CFG.ko.plantages ? KO() : J(CFG.plantages);
    }
    if (/id=eq\.veille_plantages/.test(u)) {
      lectures.push({ memo: u });
      return CFG.ko.memo ? KO() : J(CFG.memo ? [{ data: CFG.memo }] : []);
    }
    if (/id=eq\.push_subs/.test(u)) {
      const o = (/owner=eq\.([0-9a-f-]+)/.exec(u) || [])[1] || '';
      return J([{ data: { subs: [{ endpoint: 'https://web.push.apple.com/appareil-' + (o === PROPRIO ? 'proprio' : 'vendeur') }] } }]);
    }
    return J([]);
  };
  let mod;
  try { mod = await import('file://' + path.join(R, 'api', 'ship-reminders.js')); } catch (e) { dit(false, 'api/ship-reminders.js se charge', String(e && e.message)); }
  let libPush = {}, libAbo = {};
  try { libPush = await import('file://' + path.join(R, 'api', '_lib', 'push.js')); } catch (_) {}
  try { libAbo = await import('file://' + path.join(R, 'api', '_lib', 'abonnement.js')); } catch (_) {}
  const lancer = async (query = {}) => {
    if (typeof libPush.oublierPrefsVues === 'function') libPush.oublierPrefsVues();
    if (typeof libAbo.oublierAcces === 'function') libAbo.oublierAcces();
    const res = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } };
    await mod.default({ method: 'GET', headers: { authorization: 'Bearer cle-banc-veille' }, query }, res);
    return res;
  };
  const veilles = () => pushes.filter((p) => /plant/.test(p.body || ''));

  await essaie('B1', async () => {
    if (!mod) throw new Error('route absente');
    reset();
    const res = await lancer();
    const v = veilles();
    console.log('     téléphone : « ' + ((v[0] || {}).body) + ' » → ' + ((v[0] || {}).endpoint));
    dit(v.length === 1, 'B1 un type nouveau ⇒ UNE notification', String(v.length));
    dit(v.length && v.every((p) => /appareil-proprio/.test(p.endpoint)), 'B2 au propriétaire de l’installation seulement (jamais aux appareils d’un vendeur)', v.map((p) => p.endpoint).join(', '));
    dit(v[0] && v[0].body === 'VRM : un écran a planté (Colis, iPhone) — c’est noté, on corrige.', 'B3 le texte clair, le bruit écarté', v[0] && v[0].body);
    const iMemo = journal.findIndex((x) => x.startsWith('memo:')), iPush = journal.findIndex((x) => x.startsWith('push:') && /plant/.test(x));
    dit(iMemo >= 0 && iPush > iMemo && journal[iMemo].startsWith('memo:' + PROPRIO + ':'), 'B4 le mémo (au nom du propriétaire) est écrit AVANT l’envoi', journal.join(' | '));
    const lp = lectures.filter((x) => x.u);
    dit(lp.length >= 1 && lp.every((x) => !/select=[^&]*\bdata(,|&|$)/.test(x.u) && /meta->>at=gte\./.test(x.u) && x.range), 'B5 la lecture projette (jamais `select=data`), filtre par date côté base et pagine (`Range`)', lp.map((x) => x.u + ' ' + x.range).join(' | '));
    dit(lp.length && lp.every((x) => !/owner=eq\./.test(x.u)), 'B6 elle lit les plantages de TOUS les vendeurs (un écran mort chez un autre vendeur se voit)', lp.map((x) => x.u).join(' | '));
    dit(res.corps && res.corps.veille && res.corps.veille.nouveaux === 1 && !/Cannot access/.test(JSON.stringify(res.corps.bilans || [])), 'B7 la réponse du cron dit la veille', JSON.stringify(res.corps && res.corps.veille));
  });

  await essaie('B8', async () => {
    const L2 = await import('file://' + path.join(R, 'api', '_lib', 'veille-plantages.js'));
    const cle = L2.cleType("Cannot access 'xe' before initialization");
    reset({ memo: { vus: { [cle]: { at: iso(Date.now() - 864e5) } }, derniere: iso(Date.now() - 24 * H) } });
    await lancer();
    dit(veilles().length === 0, 'B8 un type déjà signalé ⇒ rien (une fois par type)', String(veilles().length));
    reset({ plantages: [{ owner: VENDEUR, id: 'plantage_q', message: "Cannot access 'Qz' before initialization", ecran: 'cat_bord', navigateur: 'iOS Safari', at: iso(Date.now() - H) }], memo: { vus: { [cle]: { at: iso(Date.now() - 864e5) } } } });
    await lancer();
    dit(veilles().length === 0, 'B9 le même type sous un autre nom minifié (nouveau déploiement) ⇒ rien', String(veilles().length));
  });

  await essaie('B10', async () => {
    reset({ ko: { plantages: true } });
    await lancer();
    dit(veilles().length === 0 && !journal.some((x) => x.startsWith('memo:')), 'B10 plantages illisibles (522) ⇒ rien envoyé, rien écrit', journal.join(' | '));
    reset({ ko: { memo: true } });
    await lancer();
    dit(veilles().length === 0, 'B11 mémo illisible ⇒ rien (pas su)', String(veilles().length));
    reset({ memoEcritKO: true });
    await lancer();
    dit(veilles().length === 0, 'B12 mémo pas écrit ⇒ rien (sinon la même chaque matin)', String(veilles().length));
    reset({ plantages: [{ owner: VENDEUR, id: 'plantage_r', message: 'Unable to preload CSS for /assets/App-CM2cYfGZ.css', ecran: '', navigateur: 'iOS Safari', at: iso(Date.now() - H) }] });
    await lancer();
    dit(veilles().length === 0, 'B13 un morceau d’un ancien déploiement seul ⇒ rien', String(veilles().length));
    reset();
    await lancer({ moment: 'soir' });
    dit(veilles().length === 0, 'B14 le passage du soir ne la porte pas (le matin seulement)', String(veilles().length));
    reset();
    delete process.env.VRM_OWNER_UID;
    await lancer();
    process.env.VRM_OWNER_UID = PROPRIO;
    dit(veilles().length === 0, 'B15 sans propriétaire déclaré (VRM_OWNER_UID) ⇒ personne n’est prévenu', String(veilles().length));
  });

  // ── C. l'app n'y gagne aucune lecture, et pas de 13ᵉ fonction ──────────────
  const app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
  dit(!/veille_plantages/.test(app), 'C1 l’app ne lit pas la veille (aucune lecture de plus côté app)');
  dit(!fs.existsSync(path.join(R, 'api', 'veille-plantages.js')), 'C2 aucune nouvelle fonction dans api/ (la veille vit dans le cron du matin)');

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l’audit a levé : ' + ((e && e.stack) || e)); process.exit(1); });
