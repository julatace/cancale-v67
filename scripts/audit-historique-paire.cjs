// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : L'HISTORIQUE DE LA PAIRE — « RANGÉE » (23 nov., lot historique-paire)
// La ligne de temps de la fiche (src/paireHistoire/ligneDeTemps.js, 14-15 nov. : achetée, reçue, numérotée, photos,
// publiée par site, prix, offres, masquée, vendue, bordereau, partie, relais, livrée, versement, retours) gagne
// l'étape qui manquait : RANGÉE dans le Stock. Il EXÉCUTE la vraie règle sur des fiches INVENTÉES :
//   H1 la case posée sur LA fiche de ce N° (`vrm_fiches_neuves` : `case` + `caseAt`, sinon `rangeAt`) ⇒ « Rangée »,
//      à SA date, dans l'ordre (après « Numérotée », avant la publication) ;
//   H2 identité : 50 fiches au MÊME titre sous 50 N° — seule la fiche de CE N° compte (la clé du N° : « 007 » = « 7 »),
//      jamais un titre ;
//   H3 deux fiches sous ce N° ⇒ aucun événement (on ne choisit pas) ;
//   H4 « pas su » : les fiches pas lues ⇒ nommé (« la case du Stock »), jamais « rien » ;
//   H5 une case du Stock (`vrm_slots`) sans fiche datée ⇒ « date inconnue » (jamais une date déduite) ; pas de case ⇒ rien ;
//   H6 le branchement : la fiche passe `vrm_fiches_neuves`, `vrm_slots` et `cleNum` ; la vue calcule par la règle ;
//      chaque texte dans les cinq langues.
// Lancer : node scripts/audit-historique-paire.cjs [--mutation=<nom>]  (chaque mutation doit rougir)
//   mutations : titre double passu date-deduite ordre branche
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-histo-'));
for (const f of ['src/paireHistoire/ligneDeTemps.js', 'src/paireHistoire/LigneDeTemps.jsx', 'src/App.jsx', ...['fr', 'en', 'es', 'it', 'de'].map((l) => `src/i18n/langues/${l}/idees.js`)]) {
  fs.mkdirSync(path.dirname(path.join(T, f)), { recursive: true }); fs.copyFileSync(path.join(R, f), path.join(T, f));
}
fs.writeFileSync(path.join(T, 'package.json'), '{"type":"module"}');
const MUTS = {
  titre: ['src/paireHistoire/ligneDeTemps.js', "const l = Object.values(fiches).filter((f) => f && typeof f === 'object' && str(f.numero) && cn(f.numero) === k);", "const l = Object.values(fiches).filter((f) => f && typeof f === 'object' && str(f.numero) && cn(f.numero) === k).slice(0, 1).concat(Object.values(fiches).filter((f) => f && f.title === 'Nike Dunk Low Panda 42' && cn(f.numero) !== k).slice(0, 0));\n  if (!l.length) { const t = Object.values(fiches).find((f) => f && f.case); if (t) return { at: isoDe(t.caseAt) }; }"],
  double: ['src/paireHistoire/ligneDeTemps.js', '  if (l.length > 1) return false;\n', ''],
  passu: ['src/paireHistoire/ligneDeTemps.js', "  if (x.rangement === null) pasSu.push('rangement');\n  else if", '  if'],
  'date-deduite': ['src/paireHistoire/ligneDeTemps.js', "    if (cles.length === 1) return { at: null };", "    if (cles.length === 1) return { at: new Date().toISOString() };"],
  ordre: ['src/paireHistoire/ligneDeTemps.js', "export const QUOI = ['achetee', 'recue', 'numerotee', 'renumerotee', 'rangee', 'photographiee',", "export const QUOI = ['rangee', 'achetee', 'recue', 'numerotee', 'renumerotee', 'photographiee',"],
  branche: ['src/App.jsx', "fichesNeuves: load('vrm_fiches_neuves', {}), slots: load('vrm_slots', {}), cleNum }}", "cleNum }}"],
};
if (MUT) {
  const m = MUTS[MUT];
  if (!m) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
  const f = path.join(T, m[0]); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(m[1])) { console.log('❌ mutation impossible : motif absent — ' + m[1].slice(0, 90)); process.exit(2); }
  fs.writeFileSync(f, s.replace(m[1], m[2]));
  console.log('… mutation « ' + MUT + ' » posée');
}
const sansCommentaires = (f) => fs.readFileSync(path.join(T, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

(async () => {
  let L;
  try { L = await import(pathToFileURL(path.join(T, 'src/paireHistoire/ligneDeTemps.js')).href); } catch (e) { dit(false, 'ligneDeTemps.js se charge', String(e.message).slice(0, 200)); return fin(); }
  if (typeof L.rangementDuNumero !== 'function') { dit(false, 'ligneDeTemps.js exporte rangementDuNumero'); return fin(); }
  const cleNum = (x) => String(x).toUpperCase().replace(/\s+/g, '').replace(/^([A-Z]*)0+(?=\d)/, '$1');
  // 50 fiches au MÊME titre, N° 1 à 50 ; seules certaines ont une case.
  const fiches = {};
  for (let i = 1; i <= 50; i++) fiches['f' + i] = { id: 'f' + i, numero: String(i), title: 'Nike Dunk Low Panda 42', ...(i % 5 === 0 ? { case: { m: 'm1', i }, caseAt: `2026-10-${String(10 + (i % 18)).padStart(2, '0')}T09:00:00.000Z` } : {}) };
  fiches.f7.case = { m: 'm1', i: 70 }; fiches.f7.rangeAt = '2026-10-03T08:00:00.000Z';   // rangée à l'arrivée (`rangeAt`)
  const h = { num: '7', etapes: [
    { cle: 'numero', etat: 'fait', evenements: [{ at: '2026-10-02T10:00:00.000Z', preuve: 'fiche' }] },
    { cle: 'annonces', etat: 'fait', evenements: [{ cle: 'ebay', at: '2026-10-05T10:00:00.000Z', preuve: 'SKU VRM-7' }] },
  ] };
  console.log('── H1-H2. Rangée, par la clé du N°');
  const r7 = L.rangementDuNumero(fiches, '007', cleNum);
  dit(r7 && r7.at === '2026-10-03T08:00:00.000Z', 'H2 « 007 » = « 7 » : la fiche de CE N° seulement, à SA date (`rangeAt`)', r7);
  const r10 = L.rangementDuNumero(fiches, '10', cleNum);
  dit(r10 && r10.at === fiches.f10.caseAt, 'H1 `caseAt` passe devant `rangeAt`', r10);
  dit(L.rangementDuNumero(fiches, '11', cleNum) === false && L.rangementDuNumero(fiches, '51', cleNum) === false, 'H2b même titre, pas de case pour CE N° (ou N° inconnu) ⇒ rien, jamais la case d’une autre', [L.rangementDuNumero(fiches, '11', cleNum), L.rangementDuNumero(fiches, '51', cleNum)]);
  const lt = L.ligneDeTemps(h, { rangement: r7 });
  const ordre = (lt && lt.evenements || []).map((e) => e.quoi);
  dit(ordre.join() === 'numerotee,rangee,publiee', 'H1b dans l’ordre des dates : numérotée → rangée → publiée', ordre);
  const lt2 = L.ligneDeTemps({ num: '7', etapes: [{ cle: 'numero', etat: 'fait', evenements: [{ at: '2026-10-03T08:00:00.000Z', preuve: 'fiche' }] }] }, { rangement: r7 });
  dit((lt2 && lt2.evenements || []).map((e) => e.quoi).join() === 'numerotee,rangee', 'H1c à la même minute : « numérotée » avant « rangée » (l’ordre du cycle)', lt2 && lt2.evenements);
  console.log('── H3. Deux fiches sous ce N°');
  const dbl = { ...fiches, g: { numero: '7', title: 'autre', case: { m: 'm2', i: 1 }, caseAt: '2026-10-04T08:00:00.000Z' } };
  dit(L.rangementDuNumero(dbl, '7', cleNum) === false, 'H3 deux fiches sous ce N° ⇒ aucun événement (on ne choisit pas)');
  console.log('── H4-H5. Pas su, date inconnue');
  dit(L.rangementDuNumero(null, '7', cleNum) === null, 'H4 fiches pas lues ⇒ null');
  const lt3 = L.ligneDeTemps(h, { rangement: null });
  dit(lt3 && lt3.pasSu.includes('rangement') && !lt3.evenements.some((e) => e.quoi === 'rangee'), 'H4b « pas su » est NOMMÉ (« la case du Stock »), jamais « rien »', lt3 && lt3.pasSu);
  const s = L.rangementDuNumero({}, '0012', cleNum, { 12: { m: 'm1', i: 3 }, 13: { m: 'm1', i: 4 } });
  dit(s && s.at === null, 'H5 une case du Stock sans fiche datée ⇒ « date inconnue »', s);
  const lt4 = L.ligneDeTemps(h, { rangement: s });
  dit(lt4 && lt4.sansDate.some((e) => e.quoi === 'rangee') && !lt4.evenements.some((e) => e.quoi === 'rangee'), 'H5b rangée dans « date inconnue » (jamais une date déduite)', lt4 && lt4.sansDate);
  dit(L.rangementDuNumero({}, '14', cleNum, { 12: { m: 'm1', i: 3 } }) === false, 'H5c pas de case ⇒ rien');
  console.log('── H6. Le branchement');
  const app = sansCommentaires('src/App.jsx');
  dit(/fichesNeuves: load\('vrm_fiches_neuves', \{\}\), slots: load\('vrm_slots', \{\}\), cleNum \}\}/.test(app), 'H6 la fiche passe `vrm_fiches_neuves`, `vrm_slots` et `cleNum` à la ligne de temps');
  const vue = sansCommentaires('src/paireHistoire/LigneDeTemps.jsx');
  dit(/rangementDuNumero\(extra\.fichesNeuves, cle, extra\.cleNum, extra\.slots\)/.test(vue) && /retours: extra\.retours, rangement \}/.test(vue), 'H6b la vue calcule par la règle et la passe à `ligneDeTemps`');
  const manque = [];
  for (const l of ['fr', 'en', 'es', 'it', 'de']) { const t = fs.readFileSync(path.join(T, `src/i18n/langues/${l}/idees.js`), 'utf8'); for (const k of ['lt.quoi.rangee', 'lt.src.rangement', 'lt.pasSu.rangement']) if (!t.includes(JSON.stringify(k))) manque.push(l + ':' + k); }
  dit(manque.length === 0, 'H6c « Rangée dans le Stock », sa preuve et son « pas su » dans les cinq langues', manque);
  fin();
})().catch((e) => { dit(false, 'exécution', String(e && e.stack || e).slice(0, 400)); fin(); });

function fin() {
  try { fs.rmSync(T, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${ko ? '❌' : '✅'} audit-historique-paire : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
}
