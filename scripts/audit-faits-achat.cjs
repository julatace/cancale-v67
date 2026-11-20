#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  AUDIT — LA TAILLE À CÔTÉ DE CHAQUE ACHAT À RELIER (17 nov., lot relier-taille)
//        node scripts/audit-faits-achat.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « pour relier les achats je veux qu'il y ait la taille ou une description à côté des articles achetés ».
// EXÉCUTE src/faitsAchat.js (avec la taille du titre de src/suggestionsAchat.js) :
//   D  `detailsDeLignes` : la forme PROJETÉE du détail de transaction (t0..t3 / e0..e3 / vendeur / nb), par n° ;
//      une ligne illisible est écartée ; `null` (lecture ratée) reste `null` (« pas su », jamais « rien ») ;
//   T  la taille : lue chez Vinted d'abord, sinon écrite dans le titre (EU, jamais une conversion US), sinon rien ;
//      50 achats au même titre : chacun SA taille, par son n° ;
//   A  l'accord avec l'article visé : « 42 » = « 42,0 » = « EU 42 », « 42,5 » ≠ « 42 », « 42 2/3 » ≠ « 42 » ;
//      article sans taille ⇒ aucun marquage ; un lot : « ✓ » si l'une de ses tailles est la bonne ;
//   M  la marque n'est dite que si le TITRE la nomme ; le vendeur et l'état viennent du détail ;
//   S  le branchement : la lecture est la projection (jamais `select=data`, côté acheteur seulement), lue à
//      l'ouverture d'une feuille de liaison ; les trois feuilles (Relier un achat, Relier achats et ventes, colis à
//      relier) montrent `FaitsAchat` ; aucune écriture n'en dépend.
// Aucune donnée réelle. --prouve : chaque mutation réaffaiblit une règle ⇒ l'audit DOIT rougir.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const MUTS = {
  'details-ignores': ['src/faitsAchat.js', '  const d = details && tx ? details[tx] : null;', '  const d = null;'],
  'accord-entier': ['src/faitsAchat.js', "tailles.includes(visee) ? 'meme' : 'diff'", "tailles.some((t) => parseInt(t, 10) === parseInt(visee, 10)) ? 'meme' : 'diff'"],
  'titre-avant-vinted': ['src/faitsAchat.js', "  if (!tailles.length) { const t = tailleDuTitre(titre); if (t) { tailles = [t]; source = 'titre'; } }", "  { const t = tailleDuTitre(titre); if (t) { tailles = [t]; source = 'titre'; } }"],
  'forme-pas-verifiee': ['src/faitsAchat.js', "const court = (v, max) => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : '');", "const court = (v) => String(v == null ? '' : v);"],
  'echec-vaut-rien': ['src/faitsAchat.js', '  if (!Array.isArray(rows)) return null;', '  if (!Array.isArray(rows)) return {};'],
  'marque-devinee': ['src/faitsAchat.js', "  if (marque && !(' ' + normMots(titre) + ' ').includes(' ' + normMots(marque) + ' ')) marque = '';\n", ''],
  'app-select-data': ['src/faitsAchat.js', "export const SELECT_DETAILS_ACHATS = 'id=like.harvest_%25_txn_%25&data->payload->transaction->>user_side=eq.buyer&select=id,tx:meta->>id,'", "export const SELECT_DETAILS_ACHATS = 'id=like.harvest_%25_txn_%25&select=id,data,tx:meta->>id,'"],
  'feuille-sans-faits': ['src/ecrans/Achats.jsx', '          <FaitsAchat achat={a}', '          <span data-x achat={a}'],
  'glisser-sans-cible': ['src/RelierGlisser.jsx', 'cible={cChoisie || null}', 'cible={null}'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let RACINE = R;
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'faits-achat-'));
  process.on('exit', () => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} });
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true, filter: (s) => !/node_modules/.test(s) });
  try { fs.copyFileSync(path.join(R, 'package.json'), path.join(d, 'package.json')); } catch (_) {}
  const [f, a, b] = MUTS[MUT];
  const p = path.join(d, f); const s = fs.readFileSync(p, 'utf8');
  if (!s.includes(a)) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(p, s.replace(a, b)); RACINE = d;
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || d == null ? '' : ' — ' + d)); };
const lire = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

(async () => {
  let F = null;
  try { F = await import(pathToFileURL(path.join(RACINE, 'src', 'faitsAchat.js')).href); } catch (e) { dit(false, 'src/faitsAchat.js se charge', e.message); }
  if (!F) { console.log(`\n${ok} vert(s), ${ko} rouge(s)`); process.exit(1); }
  const marqueDe = (t) => (/adidas/i.test(t) ? 'Adidas' : /nike/i.test(t) ? 'Nike' : /jordan/i.test(t) ? 'Nike' : null);
  const couleursDe = (t) => (/noir/i.test(t) ? ['noir'] : []);

  // ── D · la forme projetée
  const ligne = (tx, t, e, v, extra = {}) => ({ id: `harvest_820001_txn_${tx}`, tx: String(tx), vendeur: v, nb: '1', t0: t, e0: e, t1: null, e1: null, t2: null, e2: null, t3: null, e3: null, ...extra });
  const D = F.detailsDeLignes([ligne(1, '42', 'Très bon état', 'v1'), ligne(2, '42,5', 'Bon état', 'v2'), { id: 'x', tx: 'abc', t0: '42' }, ligne(3, { amount: 1 }, 7, 'v3'), ligne(4, '41', '', '', { t1: '43', e1: 'Neuf' })]);
  dit(D && D['1'] && D['1'].tailles[0] === '42' && D['1'].etats[0] === 'Très bon état' && D['1'].vendeur === 'v1', 'D1 · la taille, l\'état et le vendeur sont rangés par n° de transaction', JSON.stringify(D && D['1']));
  dit(D && !D.abc, 'D2 · une ligne sans n° lisible est écartée');
  dit(D && D['3'] && D['3'].tailles.length === 0 && D['3'].etats.length === 0, 'D3 · une forme inattendue (objet, nombre) n\'est pas rangée comme une taille', JSON.stringify(D && D['3']));
  dit(D && D['4'] && D['4'].tailles.join() === '41,43', 'D4 · un lot garde chaque taille', JSON.stringify(D && D['4']));
  dit(F.detailsDeLignes(null) === null, 'D5 · lecture ratée ⇒ null (« pas su »), jamais une carte vide');

  // ── T · la taille
  const A = (tx, title) => ({ transaction_id: String(tx), title });
  const f1 = F.faitsAchat(A(1, 'Adidas Spezial noire'), { details: D, cible: { titre: 'Adidas Spezial 42' } });
  dit(f1.taille === '42' && f1.tailleSource === 'vinted', 'T1 · la taille LUE chez Vinted est montrée, dite « vinted »', JSON.stringify(f1));
  const f2 = F.faitsAchat(A(99, 'Adidas Spezial noire taille 43'), { details: D, cible: { titre: 'Adidas Spezial 42' } });
  dit(f2.taille === '43' && f2.tailleSource === 'titre', 'T2 · sans détail, la taille écrite dans le titre, dite « titre »', JSON.stringify(f2));
  const f3 = F.faitsAchat(A(98, 'Adidas Spezial noire'), { details: D, cible: { titre: 'Adidas Spezial 42' } });
  dit(!f3.taille && !f3.accord && !f3.etat && !f3.vendeur, 'T3 · rien de lu ni d\'écrit ⇒ rien (jamais deviné)', JSON.stringify(f3));
  const f4 = F.faitsAchat(A(97, 'Nike Air Max US 9'), { details: {}, cible: { titre: 'Nike 42,5' } });
  dit(!f4.taille, 'T4 · une taille US n\'est jamais convertie pour être montrée', JSON.stringify(f4));
  const f5 = F.faitsAchat(A(2, 'Adidas Spezial noire taille 42'), { details: D, cible: { titre: 'x', taille: '42' } });
  dit(f5.taille === '42,5' && f5.tailleSource === 'vinted' && f5.accord === 'diff', 'T5 · la taille lue gagne sur celle du titre (le titre dit 42, Vinted 42,5)', JSON.stringify(f5));
  // 50 achats au même titre, chacun sa taille par son n°.
  const TA = ['40', '41', '42', '42,5', '43'];
  const rows50 = Array.from({ length: 50 }, (_, i) => ligne(7300000 + i, TA[i % 5], 'Bon état', 'v' + i));
  const D50 = F.detailsDeLignes(rows50);
  const f50 = Array.from({ length: 50 }, (_, i) => F.faitsAchat(A(7300000 + i, 'Adidas Spezial noire'), { details: D50, cible: { titre: 'Adidas Spezial noir', taille: '42' } }));
  dit(f50.every((f, i) => f.taille === TA[i % 5]), 'T6 · 50 achats au même titre : chacun montre SA taille (par n°)');
  dit(f50.filter((f) => f.accord === 'meme').length === 10 && f50.every((f, i) => (f.accord === 'meme') === (TA[i % 5] === '42')), 'T7 · les 10 en 42 — et eux seuls — sont « même taille »');

  // ── A · l'accord
  const acc = (taille, visee) => F.faitsAchat(A(5, 'x'), { details: { 5: { tailles: [taille], etats: [], vendeur: '', nb: 1 } }, cible: { taille: visee } }).accord;
  dit(acc('42', '42,0') === 'meme' && acc('EU 42', '42') === 'meme' && acc('42,5', '42.5') === 'meme', 'A1 · « 42 » = « 42,0 » = « EU 42 », « 42,5 » = « 42.5 »');
  dit(acc('42,5', '42') === 'diff' && acc('42 2/3', '42') === 'diff' && acc('42 1/3', '42 2/3') === 'diff', 'A2 · « 42,5 », « 42 2/3 » ne sont PAS « 42 »');
  dit(acc('M', 'm') === 'meme' && acc('M', 'L') === 'diff', 'A3 · une taille en lettres se compare telle quelle');
  dit(F.faitsAchat(A(1, 'x'), { details: D, cible: { titre: 'Adidas Spezial' } }).accord === '', 'A4 · un article sans taille ⇒ aucun marquage');
  dit(F.faitsAchat(A(4, 'x'), { details: D, cible: { taille: '43' } }).accord === 'meme', 'A5 · un lot : « même taille » si l\'une de ses tailles est la bonne');

  // ── M · marque, vendeur, état
  dit(F.faitsAchat(A(1, 'Adidas Spezial noire'), { details: D, marqueDe }).marque === 'Adidas', 'M1 · la marque nommée dans le titre est dite');
  dit(F.faitsAchat(A(1, 'Air Jordan 1 noire'), { details: D, marqueDe }).marque === '', 'M2 · une marque que le titre ne NOMME pas (déduite du modèle) n\'est pas dite');
  const fm = F.faitsAchat(A(1, 'Adidas Spezial noire'), { details: D, marqueDe, couleursDe });
  dit(fm.vendeur === 'v1' && fm.etat === 'Très bon état' && fm.couleurs.join() === 'noir', 'M3 · vendeur et état du détail, couleur écrite dans le titre', JSON.stringify(fm));
  dit(F.sansTailleLue([A(1, 'a'), A(98, 'b'), A(3, 'c')], D) === 2 && F.sansTailleLue([A(1, 'a')], null) === 0, 'M4 · « N achats sans taille lue » compte ceux sans taille LUE ; pas su ⇒ rien dit');

  // ── S · le branchement
  const sel = F.SELECT_DETAILS_ACHATS || '';
  dit(/user_side=eq\.buyer/.test(sel) && !/(select=|,)data(,|&|$)/.test(sel) && /size_title/.test(sel) && /seller->>login/.test(sel), 'S1 · la lecture est une PROJECTION côté acheteur (jamais select=data)', sel.slice(0, 120));
  const app = sansCommentaires(lire('src/App.jsx'));
  dit(/lireTout\(SELECT_DETAILS_ACHATS/.test(app) && /setDetailsAchats\(detailsDeLignes\(rows\)\)/.test(app), 'S2 · App lit les détails par cette projection et les range par `detailsDeLignes`');
  dit(/besoinDetailsAchats = !!\(pickerFor \|\| glisserOuvert \|\| relierColis(?: \|\| only === 'completer')?\)/.test(app), 'S3 · lus à l\'ouverture d\'une des trois feuilles de liaison');
  const nb = (app.match(/details=\{detailsAchats\}/g) || []).length + (app.match(/<FaitsAchat achat=\{o\} details=\{detailsAchats/g) || []).length;
  dit(nb >= 3, 'S4 · les trois feuilles reçoivent les détails (Relier un achat, Relier achats et ventes, colis à relier)', String(nb));
  const ach = sansCommentaires(lire('src/ecrans/Achats.jsx'));
  dit(/<FaitsAchat achat=\{a\}[^>]*cible=\{cible\}/.test(ach), 'S5 · « Relier un achat » : chaque ligne montre `FaitsAchat`, comparée à l\'article visé');
  const gl = sansCommentaires(lire('src/RelierGlisser.jsx'));
  dit(/<FaitsAchat achat=\{a\}[^>]*cible=\{cChoisie \|\| null\}/.test(gl) && /accordCible\(c\)/.test(gl), 'S6 · « Relier achats et ventes » : l\'achat comparé à la vente choisie, et la vente à l\'achat choisi');
  const fj = sansCommentaires(lire('src/FaitsAchat.jsx'));
  dit(!/onClick|onRelier|save\(|fetch\(/.test(fj), 'S7 · la ligne n\'écrit rien et ne relie rien (c\'est son toucher qui relie)');
  dit(!/accent|warn|#[0-9a-f]{3,6}\b/i.test(sansCommentaires(lire('src/styles-faits-achat.css')).replace(/var\(--vrm-[a-z]+, #[0-9a-f]+\)/gi, '')), 'S8 · aucune couleur d\'accent ni d\'alerte dans le marquage (§7)');
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
