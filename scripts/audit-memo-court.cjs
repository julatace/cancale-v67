// ════════════════════════════════════════════════════════════════════════════
//  UNE LECTURE LOURDE SERVIE QUELQUES SECONDES À SES VOISINES (20 nov., lectures-legeres)
//  EXÉCUTE src/memoCourt.js et src/lecturesPartagees.js (`abonner`) :
//   1. même vendeur dans la fenêtre ⇒ servie sans relire ; en cours ⇒ partagée ;
//   2. un AUTRE vendeur ⇒ relue (jamais la réponse d'un autre compte) ;
//   3. `null` / `undefined` / une erreur ⇒ jamais gardés ;
//   4. `oublier()` pendant une lecture en cours ⇒ sa réponse n'est pas gardée ;
//   5. `force` ⇒ relue ; fenêtre passée ⇒ relue ;
//   6. une écriture vers la base qui peut toucher `harvest_*` (ou tout vider : une ligne non
//      nommée, un signal) prévient l'abonné ; l'écriture d'une AUTRE ligne (`widget_stats`) non ;
//   7. App.jsx : `lireCapturesDetail` et la lecture des transactions des preuves passent par un
//      memo, abonné aux vidages, oublié à `onCloudReady`, et « Réessayer » force.
//  `--mutation` : chaque mutation doit rougir.
//  Usage : node scripts/audit-memo-court.cjs [--mutation]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const MEMO = path.join(RACINE, 'src', 'memoCourt.js');
const LP = path.join(RACINE, 'src', 'lecturesPartagees.js');
const APP = path.join(RACINE, 'src', 'App.jsx');

async function passe(memoPath, lpPath, appTexte, silencieux) {
  let ok = 0, ko = 0; const rouges = [];
  const dit = (b, q, d) => { if (b) { ok++; if (!silencieux) console.log(`✅ ${q}`); } else { ko++; rouges.push(q); if (!silencieux) console.log(`❌ ${q}${d ? ' — ' + d : ''}`); } };
  const { creerMemoCourt } = await import(pathToFileURL(memoPath).href + '?t=' + Math.random());
  const { creerLecturesPartagees } = await import(pathToFileURL(lpPath).href + '?t=' + Math.random());
  let t = 1000; const maintenant = () => t;
  const m = creerMemoCourt({ dureeMs: 20000, maintenant });
  let lus = 0; const lire = (v) => () => { lus++; return Promise.resolve(v); };
  const A = 'vendeur-a', B = 'vendeur-b';
  // 1.
  const r1 = await m.lire(A, lire({ x: 1 })); const r2 = await m.lire(A, lire({ x: 2 }));
  dit(r1.x === 1 && r2.x === 1 && lus === 1, '1. même vendeur dans la fenêtre ⇒ servie sans relire');
  lus = 0; m.oublier();
  let lacher; const tenue = new Promise((r) => { lacher = r; });
  const p1 = m.lire(A, () => { lus++; return tenue; }); const p2 = m.lire(A, lire({ x: 9 }));
  lacher({ x: 3 }); const [q1, q2] = await Promise.all([p1, p2]);
  dit(q1.x === 3 && q2.x === 3 && lus === 1, '1. une lecture en cours est partagée');
  // 2.
  lus = 0; const rb = await m.lire(B, lire({ x: 'b' }));
  dit(rb.x === 'b' && lus === 1, '2. un autre vendeur ⇒ relue');
  const ra = await m.lire(A, lire({ x: 'a2' }));
  dit(ra.x === 'a2', '2. puis le premier ⇒ relue aussi (une seule entrée, jamais croisée)');
  // 3.
  m.oublier(); lus = 0;
  await m.lire(A, lire(null)); await m.lire(A, lire(undefined));
  await m.lire(A, () => { lus++; return Promise.reject(new Error('panne')); }).catch(() => {});
  const r3 = await m.lire(A, lire({ x: 'ok' }));
  dit(lus === 4 && r3.x === 'ok', '3. null / undefined / erreur jamais gardés', `lus=${lus}`);
  // 4.
  m.oublier(); lus = 0; let l2; const t2 = new Promise((r) => { l2 = r; });
  const p4 = m.lire(A, () => { lus++; return t2; }); m.oublier(); l2({ x: 'vieux' }); await p4;
  const r4 = await m.lire(A, lire({ x: 'neuf' }));
  dit(r4.x === 'neuf' && lus === 2, '4. oubliée pendant la lecture ⇒ pas gardée');
  // 5.
  lus = 0; const r5 = await m.lire(A, lire({ x: 'force' }), { force: true });
  dit(r5.x === 'force' && lus === 1, '5. force ⇒ relue');
  t += 20001; lus = 0; const r6 = await m.lire(A, lire({ x: 'tard' }));
  dit(r6.x === 'tard' && lus === 1, '5. fenêtre passée ⇒ relue');
  // 6.
  const BASE = 'https://base.exemple';
  const fx = async () => ({ ok: true, status: 201, clone() { return this; }, json: async () => [] });
  const lp = creerLecturesPartagees(fx, BASE, { origine: 'https://vrm.exemple' });
  let nCap = 0, nTxn = 0;
  lp.abonner('app_data?id=like.harvest_*', () => nCap++);
  lp.abonner('app_data?id=like.harvest_%25_txn_%25', () => nTxn++);
  await lp.fetch(`${BASE}/rest/v1/app_data`, { method: 'POST', body: JSON.stringify({ id: 'widget_stats', data: {} }) });
  dit(nCap === 0 && nTxn === 0, '6. écrire widget_stats ne fait rien oublier', `${nCap}/${nTxn}`);
  await lp.fetch(`${BASE}/rest/v1/app_data`, { method: 'POST', body: JSON.stringify({ id: 'harvest_12_txn_34', data: {} }) });
  dit(nCap > 0 && nTxn > 0, '6. écrire une transaction fait oublier les deux');
  nCap = 0; nTxn = 0;
  await lp.fetch(`${BASE}/rest/v1/app_data?id=eq.harvest_12_listings`, { method: 'PATCH', body: '{}' });
  dit(nCap > 0 && nTxn === 0, '6. écrire un dressing fait oublier les dates de capture seulement', `${nCap}/${nTxn}`);
  nCap = 0; nTxn = 0; lp.invalider();
  dit(nCap === 1 && nTxn === 1, '6. un vidage complet (signal, ligne non nommée) fait tout oublier');
  nCap = 0; await lp.fetch('/api/ebay', { method: 'POST', body: '{}' });
  dit(nCap > 0, '6. un appel d\'écriture à une route fait oublier');
  // 7.
  const app = appTexte;
  dit(/function lireCapturesDetail\(opts\) \{\s*return _memoCaptures\.lire\(\(AUTH\.user && AUTH\.user\.id\) \|\| '', lireCapturesDetailUne, \{ force: !!\(opts && opts\.force\) \}\);/.test(app), '7. lireCapturesDetail passe par le memo, par vendeur');
  dit(/_memoPreuvesTxn\.lire\(\(AUTH\.user && AUTH\.user\.id\) \|\| '', \(\) => lireTout\('id=like\.harvest_%25_txn_%25&select=id,tx:meta->>id,it:meta->>item_id,ti:meta->>status_title/.test(app), '7. les transactions des preuves passent par le memo, par vendeur');
  dit(/lp\.abonner\('app_data\?id=like\.harvest_\*', \(\) => _memoCaptures\.oublier\(\)\)/.test(app) && /lp\.abonner\('app_data\?id=like\.harvest_%25_txn_%25', \(\) => _memoPreuvesTxn\.oublier\(\)\)/.test(app), '7. les deux memos abonnés aux vidages');
  dit(/onCloudReady\(oublierMemosLectures\)/.test(app) && /addEventListener\('vrm:ext', oublierMemosLectures\)/.test(app), '7. oubliés à onCloudReady et au signal de l\'extension');
  dit(/lireCapturesDetail\(\{ force: !aLaCoque \}\)/.test(app) && /lireCapturesDetail\(\{ force: true \}\)/.test(app), '7. « Réessayer » et le retour du réseau forcent la relecture');
  return { ok, ko, rouges };
}

const MUT = [
  ['memo sans vendeur', MEMO, (s) => s.replace("if (!force && e && e.qui === q && e.gen === gen)", "if (!force && e && e.gen === gen)")],
  ['memo garde null', MEMO, (s) => s.replace("if (v === null || v === undefined || monGen !== gen) { entree = null; return; }", "if (monGen !== gen) { entree = null; return; }")],
  ['memo garde une lecture oubliée', MEMO, (s) => s.replace("if (entree !== enVol) return;", "").replace("e.qui === q && e.gen === gen", "e.qui === q").replace("if (v === null || v === undefined || monGen !== gen)", "if (v === null || v === undefined)")],
  ['memo force ignoré', MEMO, (s) => s.replace("if (!force && e &&", "if (e &&")],
  ['abonné pas prévenu des lignes', LP, (s) => s.replace("cache.delete(k); prevenir((c) => lecturePeutPorter(c, ids)); };", "cache.delete(k); };")],
  ['abonné prévenu de tout', LP, (s) => s.replace("prevenir((c) => lecturePeutPorter(c, ids))", "prevenir(null)")],
];

(async () => {
  const app = fs.readFileSync(APP, 'utf8');
  const r = await passe(MEMO, LP, app, false);
  console.log(`\n${r.ok} verts, ${r.ko} rouges`);
  let ko = r.ko;
  if (process.argv.includes('--mutation')) {
    for (const [nom, fichier, f] of MUT) {
      const src = fs.readFileSync(fichier, 'utf8'); const mt = f(src);
      if (mt === src) { console.log(`❌ mutation « ${nom} » : rien remplacé`); ko++; continue; }
      const p = path.join(path.dirname(fichier), `.mutation-${process.pid}-${path.basename(fichier)}`);
      fs.writeFileSync(p, mt);
      try { const x = await passe(fichier === MEMO ? p : MEMO, fichier === LP ? p : LP, app, true); if (x.ko) console.log(`✅ mutation « ${nom} » ⇒ rouge (${x.rouges[0]})`); else { console.log(`❌ mutation « ${nom} » : tout vert`); ko++; } }
      finally { fs.unlinkSync(p); }
    }
  }
  process.exit(ko ? 1 : 0);
})();
