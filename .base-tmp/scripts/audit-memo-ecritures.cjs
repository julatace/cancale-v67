// ════════════════════════════════════════════════════════════════════════════
//  « Une écriture ne périme que les lectures qui peuvent porter ses lignes »
//  (src/memoEcritures.js, 8 nov., chantier démarrage-lectures) — la VRAIE règle
//  EXÉCUTÉE sur une mémoire remplie comme celle de `fetchMemo` (App.jsx).
//
//  Ce que la règle doit tenir :
//   1. l'upsert de `widget_stats` garde les transactions, retire `widget_stats`,
//      un motif qui l'englobe (`widget_*`), une lecture sans filtre d'id, un `or=` ;
//   2. une écriture de `main` (ou d'un corps illisible, pas en texte, d'une autre
//      table, `rpc/`) vide TOUT ;
//   3. un PATCH/DELETE `id=eq.` / `id=in.(…)` ne retire que ses lignes ;
//   4. un POST vers nos routes `/api/` vide tout… sauf s'il DÉCLARE
//      `vrmInvalideSiChange` (photo, transporteurs) ; une écriture vers la BASE
//      vide toujours, drapeau ou pas ;
//   5. la relecture du nuage (`main`) ne retire que ce qui peut porter `main` ;
//   6. deux sessions (clé `url|Authorization|Range`) : l'adresse est bien lue.
//  Et le câblage dans App.jsx : le filet `window.fetch` de `fetchMemo` passe par
//  `viderMemoPourEcriture`, la relecture du nuage par `viderMemoLignes(['main'])`,
//  la relecture des transporteurs qui CHANGE vide aussi la mémoire.
//  `--prouve` réaffaiblit la règle (mutations) et exige du ROUGE.
//  Lancer : node scripts/audit-memo-ecritures.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const SRC_DIR = path.join(__dirname, '..', 'src');
const BASE = 'https://exemple.supabase.co';
const R = BASE + '/rest/v1/app_data?';

async function charger(texteMemo, texteLp) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'me-'));
  fs.writeFileSync(path.join(dir, 'lecturesPartagees.js'), texteLp);
  fs.writeFileSync(path.join(dir, 'memoEcritures.mjs'), texteMemo.replace("'./lecturesPartagees.js'", "'./lecturesPartagees.js'"));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  return import(pathToFileURL(path.join(dir, 'memoEcritures.mjs')).href);
}

const LECTURES = {
  txn: R + 'id=like.harvest_%25_txn_%25&select=tx:meta->>id&order=id.asc',
  widget: R + 'id=eq.widget_stats&select=data',
  motif: R + 'id=like.widget_*&select=id',
  sansId: R + 'select=owner&limit=1',
  ou: R + 'or=(id.like.email_inconnu_*,id.like.email_achat_*)&select=id',
  panel: R + 'id=eq.panel_colis_collected&select=data',
  inPanel: R + 'id=in.(panel_bords_done,panel_a_confirmer)&select=id,data',
  main: R + 'id=eq.main&select=data,updated_at',
  vc: R + 'id=in.(vc_ventes,vc_listings)&select=id,ventes:data->ventes',
};
const remplir = () => {
  const m = new Map();
  for (const [nom, u] of Object.entries(LECTURES)) {
    m.set(u + '|Bearer A|0-999', nom);
    m.set(u + '|Bearer B|', nom + '·B');
  }
  return m;
};
const reste = (m) => new Set([...m.values()]);

async function verifier(mod) {
  let ko = 0;
  const dit = (c, msg, d) => { if (!c) ko++; if (!process.env.SILENCE) console.log((c ? '  ✅ ' : '  ❌ ') + msg + (d != null ? ' — ' + d : '')); };
  const { fonctionVidage, viderLignesMemo, urlDeCle } = mod;
  const poser = (url, methode, init) => { const m = remplir(); fonctionVidage(m, url, methode, init, BASE)(); return reste(m); };

  dit(urlDeCle(LECTURES.txn + '|Bearer A|0-999') === LECTURES.txn && urlDeCle(LECTURES.txn + '|Bearer B|') === LECTURES.txn, '6. l\'adresse se lit dans la clé `url|Authorization|Range`');

  let s = poser(BASE + '/rest/v1/app_data?on_conflict=id', 'POST', { body: JSON.stringify({ id: 'widget_stats', data: {} }) });
  dit(s.has('txn') && s.has('txn·B') && s.has('panel') && s.has('vc') && s.has('main'), '1. upsert widget_stats : transactions, panel, Vestiaire, main gardés', [...s].join(' '));
  dit(!s.has('widget') && !s.has('widget·B') && !s.has('motif') && !s.has('sansId') && !s.has('ou'), '1. upsert widget_stats : sa ligne, son motif, sans filtre d\'id, `or=` retirés', [...s].join(' '));

  s = poser(BASE + '/rest/v1/app_data?on_conflict=id', 'POST', { body: JSON.stringify([{ id: 'panel_bords_done' }, { id: 'lbc_a_retirer' }]) });
  dit(!s.has('inPanel') && s.has('panel') && s.has('txn'), '1. upsert de deux lignes : le `in.(…)` qui en porte une est retiré, le reste gardé');

  for (const [nom, init, url, meth] of [
    ['main', { body: JSON.stringify({ id: 'main', data: {} }) }],
    ['corps illisible', { body: '{pas du json' }],
    ['corps pas en texte', { body: new Uint8Array([1, 2]) }],
    ['sans id', { body: JSON.stringify({ data: {} }) }],
    ['autre table', { body: JSON.stringify({ id: 'x' }) }, BASE + '/rest/v1/vinted_accounts', 'POST'],
    ['rpc', { body: '{}' }, BASE + '/rest/v1/rpc/vrm_x', 'POST'],
    ['PATCH like', {}, R + 'id=like.panel_*', 'PATCH'],
  ]) {
    s = poser(url || BASE + '/rest/v1/app_data?on_conflict=id', meth || 'POST', init);
    dit(s.size === 0, `2. écriture « ${nom} » : tout est vidé`, s.size + ' restent');
  }

  s = poser(R + 'id=eq.panel_colis_collected', 'PATCH', {});
  dit(!s.has('panel') && s.has('txn') && s.has('inPanel'), '3. PATCH id=eq.panel_colis_collected : sa lecture seule');
  s = poser(R + 'id=in.(vc_ventes,vc_achats)', 'DELETE', {});
  dit(!s.has('vc') && s.has('panel') && s.has('txn'), '3. DELETE id=in.(vc_ventes,…) : les lectures qui les portent seules');

  s = poser('/api/compte?mode=photo', 'POST', { body: '{}' });
  dit(s.size === 0, '4. POST /api/ sans drapeau : tout est vidé');
  s = poser('https://vrm.center/api/ebay', 'POST', { body: '{}' });
  dit(s.size === 0, '4. POST https://vrm.center/api/ sans drapeau : tout est vidé');
  s = poser('/api/compte?mode=photo', 'POST', { body: '{}', vrmInvalideSiChange: true });
  dit(s.size === 18, '4. POST /api/ qui DÉCLARE `vrmInvalideSiChange` : rien n\'est vidé', s.size);
  s = poser(BASE + '/rest/v1/app_data?on_conflict=id', 'POST', { body: JSON.stringify({ id: 'main' }), vrmInvalideSiChange: true });
  dit(s.size === 0, '4. écriture vers la BASE avec le drapeau : vide quand même');

  const m = remplir(); viderLignesMemo(m, ['main'], BASE); s = reste(m);
  dit(!s.has('main') && !s.has('sansId') && !s.has('ou') && s.has('txn') && s.has('panel') && s.has('vc') && s.has('widget'), '5. relecture du nuage : seules les lectures qui peuvent porter `main`', [...s].join(' '));
  const m2 = remplir(); viderLignesMemo(m2, [], BASE);
  dit(m2.size === 0, '5. aucune ligne nommée : tout est vidé');

  // Câblage dans App.jsx (sans commentaires).
  const app = fs.readFileSync(path.join(SRC_DIR, 'App.jsx'), 'utf8').replace(/\/\/[^\n]*/g, '');
  const filet = /window\.__vrmFetchMemo = true;[\s\S]{0,2500}?window\.addEventListener\('vrm:nuage-relu'[^\n]*/.exec(app);
  dit(!!filet && /const vider = viderMemoPourEcriture\(u, m, init, SUPABASE_URL\);\s*vider\(\);\s*const p = _fetchBrut\(input, init\);\s*p\.then\(vider, vider\);/.test(filet[0]), 'App.jsx : le filet `fetchMemo` vide au départ ET au retour par la règle des lignes');
  dit(!!filet && /'vrm:nuage-relu', \(\) => viderMemoLignes\(\['main'\]\)\)/.test(filet[0]), 'App.jsx : la relecture du nuage ne retire que `main`');
  dit(/const viderMemoPourEcriture = \(url, methode, init, base\) => fonctionVidage\(_memoLectures,/.test(app), 'App.jsx : `viderMemoPourEcriture` porte sur la mémoire de `fetchMemo`');
  dit(/__vrmLecturesPartagees\.invalider\(\); \} catch \(_\) \{\}\s*try \{ viderLecturesMemo\(\); \} catch/.test(app), 'App.jsx : un passage des transporteurs qui CHANGE vide aussi la mémoire');
  return ko;
}

(async () => {
  const memo = fs.readFileSync(path.join(SRC_DIR, 'memoEcritures.js'), 'utf8');
  const lp = fs.readFileSync(path.join(SRC_DIR, 'lecturesPartagees.js'), 'utf8');
  const ko = await verifier(await charger(memo, lp));
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ audit-memo-ecritures : vert');
  if (!process.argv.includes('--prouve')) process.exit(ko ? 1 : 0);
  if (ko) process.exit(1);
  const mutations = [
    ['ne retire jamais rien', memo.replace('if (u.indexOf(prefixe) !== 0 || lecturePeutPorter(u.slice(prefixe.length), ids)) memo.delete(cle);', 'void 0;'), lp],
    ['le drapeau vaut aussi pour la base', memo.replace('if (init && init.vrmInvalideSiChange === true && estRouteApi(url)) return () => {};', 'if (init && init.vrmInvalideSiChange === true) return () => {};'), lp],
    ['pas sûr ⇒ rien vidé', memo.replace('if (!ids) return () => memo.clear();', 'if (!ids) return () => {};'), lp],
    ['l\'adresse = toute la clé', memo.replace("return a >= 0 ? k.slice(0, a) : k;", "return k;"), lp],
    ['`main` traitée comme une ligne précise', memo, lp.replace("const PAS_PRECIS = new Set(['main']);", 'const PAS_PRECIS = new Set([]);')],
    ['`like` jamais retiré', memo, lp.replace("if (v.startsWith('like.')) {", "if (v.startsWith('like.') && false) {")],
    ['aucune ligne ⇒ rien vidé', memo.replace("if (!base || !Array.isArray(ids) || !ids.length) { memo.clear(); return; }", "if (!base || !Array.isArray(ids) || !ids.length) { return; }"), lp],
  ];
  let verts = 0;
  for (const [nom, m, l] of mutations) {
    process.env.SILENCE = '1';
    const k = await verifier(await charger(m, l)).catch(() => 1);
    delete process.env.SILENCE;
    if (m === memo && l === lp) { console.log('  ⚠️ mutation sans effet : ' + nom); verts++; continue; }
    console.log((k ? '  🔴 ' : '  🟢 ') + 'mutation « ' + nom + ' » ' + (k ? `rouge (${k})` : 'VERTE — le contrôle ne la voit pas'));
    if (!k) verts++;
  }
  console.log(verts ? `\n❌ ${verts} mutation(s) non vue(s)` : `\n✅ ${mutations.length}/${mutations.length} mutations rouges`);
  process.exit(verts ? 1 : 0);
})();
