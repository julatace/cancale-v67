// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : « TÉLÉCHARGER TOUTES MES DONNÉES », LES TABLEAUX (23 nov., lot mes-donnees)
// Le zip de la sauvegarde (src/sauvegardeDonnees.js, 15 nov.) porte maintenant TOUS les tableaux d'« Exporter mes
// données » (src/exportDonnees.js `feuillesExport`, aucune règle neuve), en plus du JSON par catégorie (réglages compris) :
//   M1 tableaux/ ventes, achats, numeros (le stock et ses N°), factures (métadonnées), depenses, urssaf, declarations,
//      annonces — chacun relu (CSV « ; »), le N° et la facture inventés s'y retrouvent ;
//   M2 une source pas lue ⇒ la feuille dit « — », jamais un tableau vide pris pour « rien » ;
//   M3 seulement SES lignes : les lectures des sources de l'export portent `owner=eq.<lui>` (factures, achats), en plus
//      du cloisonnement de la base ;
//   M4 rien n'est envoyé : l'écran ne fait que télécharger sur l'appareil (aucun envoi, rien avant SON clic) ;
//   M5 le LISEZMOI nomme chaque tableau ; le texte de la carte le dit dans les cinq langues.
// Lancer : node scripts/audit-mes-donnees.cjs [--mutation=<nom>]  (chaque mutation doit rougir)
//   mutations : numeros vide owner-factures owner-achats envoi
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-mesdon-'));
for (const f of ['src/sauvegardeDonnees.js', 'src/exportDonnees.js', 'src/dateParis.js', 'src/SauvegardeDonnees.jsx', 'src/ecrans/Reglages.jsx', 'src/App.jsx', 'src/i18n/langues/fr/argentPlus.js', 'src/i18n/langues/en/argentPlus.js', 'src/i18n/langues/es/argentPlus.js', 'src/i18n/langues/it/argentPlus.js', 'src/i18n/langues/de/argentPlus.js']) {
  fs.mkdirSync(path.dirname(path.join(T, f)), { recursive: true }); fs.copyFileSync(path.join(R, f), path.join(T, f));
}
fs.writeFileSync(path.join(T, 'package.json'), '{"type":"module"}');
const MUTS = {
  numeros: ['src/sauvegardeDonnees.js', "['stock', 'numeros'], ", ''],
  vide: ['src/sauvegardeDonnees.js', "const f = (n) => (feuilles.find((x) => x.nom === n) || { lignes: [['—']] }).lignes;", "const f = (n) => { const l = (feuilles.find((x) => x.nom === n) || { lignes: [] }).lignes; return l.length === 1 && l[0][0] === '—' ? [] : l; };"],
  'owner-factures': ['src/ecrans/Reglages.jsx', 'lireTout(`${moiQ}id=like.email_invoice_*', 'lireTout(`id=like.email_invoice_*'],
  'owner-achats': ['src/ecrans/Reglages.jsx', 'lireAchatsLies(Array.isArray(c) ? uidsLies(c) : null, moi)', 'lireAchatsLies(Array.isArray(c) ? uidsLies(c) : null)'],
  envoi: ['src/SauvegardeDonnees.jsx', "      telecharger(new Blob([z.octets], { type: 'application/zip' }), z.nom, 'application/zip');", "      telecharger(new Blob([z.octets], { type: 'application/zip' }), z.nom, 'application/zip'); fetch('/api/compte?mode=sauvegarde', { method: 'POST', body: z.octets });"],
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
  let SV, ED;
  try { SV = await import(pathToFileURL(path.join(T, 'src/sauvegardeDonnees.js')).href); ED = await import(pathToFileURL(path.join(T, 'src/exportDonnees.js')).href); }
  catch (e) { dit(false, 'les modules se chargent', String(e.message).slice(0, 200)); return fin(); }
  const lu = { legeres: [{ id: 'main', updated_at: '2026-11-01', data: { vrm_theme: 'clair' } }, { id: 'harvest_9_listings', data: { capturedAt: '2026-11-20', payload: { items: [{ id: 77, title: 'Titre inventé', price: { amount: '42' } }] } } }],
    lourdes: [], pdfs: [], pdfAbsents: 0, pdfRates: 0, manques: [] };
  const src = {
    releve: [['Vinted', 'vendeuse', '1', Date.parse('2026-10-01T12:00:00Z'), 50, 20, 3, 'Titre inventé', '12', null]],
    achats: [{ date: '2026-09-01', compte: 'vendeuse', transaction_id: 5551, title: 'Achat inventé', price: { amount: '20' }, status: 'Terminée' }],
    fiches: { 77: { numero: 'B124', title: 'Titre inventé', buyPrice: '20', buyFromId: '5551' } },
    factures: [{ id: 'email_invoice_x', number: 'VRM-2026-0007', tx: '1', status: 'emise', emiseLe: '2026-10-02' }],
    compta: { depenses: [{ date: '2026-10-03', libelle: 'Cartons', cat: 'emballage', montant: 12.5 }] },
    urssaf: [{ ym: '2026-10', n: 1, ca: 50 }], aPayer: (ca) => ca * 0.124, declarations: { '2026-10': { at: Date.parse('2026-11-01'), ca: 50, montant: 6.2 } },
  };
  const z = SV.zipSauvegarde({ lu, sources: src, quand: new Date('2026-11-23T10:00:00Z'), nomCompte: (u) => (u === '9' ? 'vendeuse' : u) });
  const F = ED.lireZipStocke(z.octets);
  const csv = (n) => { const x = F.find((f) => f.nom.endsWith('/tableaux/' + n + '.csv')); return x ? ED.lireCsv(x.texte) : null; };
  console.log('── M1. Les tableaux');
  const noms = ['ventes', 'achats', 'numeros', 'factures', 'depenses', 'urssaf', 'declarations', 'annonces'];
  dit(noms.every((n) => csv(n)), 'M1 tableaux/ : ' + noms.join(', '), F.map((f) => f.nom));
  dit((csv('numeros') || []).some((l) => l[0] === 'B124' && l[3] === '5551'), 'M1b numeros.csv : le N° et l’achat relié (par SA transaction)', csv('numeros'));
  dit((csv('factures') || []).some((l) => l[0] === 'VRM-2026-0007'), 'M1c factures.csv : le numéro de facture (métadonnées, jamais le PDF)', csv('factures'));
  dit((csv('depenses') || []).some((l) => l[2] === 'Cartons' && l[4] === '12,50') && (csv('urssaf') || []).some((l) => l[0] === '2026-10'), 'M1d dépenses et URSSAF recopiées', [csv('depenses'), csv('urssaf')]);
  dit(F.some((f) => /donnees\/reglages\.json$/.test(f.nom) && /vrm_theme/.test(f.texte)), 'M1e les réglages en JSON (donnees/reglages.json)');
  console.log('── M2. « Pas su »');
  const z2 = SV.zipSauvegarde({ lu, sources: null, quand: new Date('2026-11-23T10:00:00Z') });
  const F2 = ED.lireZipStocke(z2.octets);
  const vides = noms.filter((n) => n !== 'annonces').filter((n) => { const x = F2.find((f) => f.nom.endsWith('/tableaux/' + n + '.csv')); const l = x ? ED.lireCsv(x.texte) : []; return !(l.length === 1 && l[0][0] === '—'); });
  dit(vides.length === 0, 'M2 une source pas lue ⇒ « — » (jamais un tableau vide)', vides);
  console.log('── M3. Seulement SES lignes');
  const reg = sansCommentaires('src/ecrans/Reglages.jsx');
  const se = reg.split('async function sourcesExportDonnees()')[1] || '';
  const corps = se.slice(0, se.indexOf('\n}\n'));
  dit(/lireTout\(`\$\{moiQ\}id=like\.email_invoice_\*/.test(corps) && /moiQ = \/\^\[\\w-\]\{8,64\}\$\/\.test\(moi\) \? `owner=eq\.\$\{encodeURIComponent\(moi\)\}&`/.test(corps), 'M3 les factures lues avec `owner=eq.<lui>`');
  dit(/lireAchatsLies\(Array\.isArray\(c\) \? uidsLies\(c\) : null, moi\)/.test(corps), 'M3b les achats lus avec `owner=eq.<lui>`');
  const app = sansCommentaires('src/App.jsx');
  const la = (app.split('async function lireAchatsLies(')[1] || '').slice(0, 900);
  dit(/^uids, owner = ''\)/.test(la) && /owner=eq\.\$\{encodeURIComponent\(owner\)\}&/.test(la) && (la.match(/\$\{sel\}/g) || []).length === 2, 'M3c `lireAchatsLies(uids, owner)` porte le filtre sur ses DEUX lectures');
  console.log('── M4-M5. Rien envoyé, tout nommé');
  const ecran = sansCommentaires('src/SauvegardeDonnees.jsx');
  dit(!/fetch\(|XMLHttpRequest|sendBeacon/.test(ecran) && /onClick=\{lancer\}/.test(ecran) && /telecharger\(/.test(ecran), 'M4 l’écran ne fait que télécharger, sur SON clic (aucun envoi)');
  const lis = (F.find((f) => /LISEZMOI/.test(f.nom)) || {}).texte || '';
  dit(noms.every((n) => lis.includes(n + '.csv')), 'M5 le LISEZMOI nomme chaque tableau', lis.split('\r\n').find((l) => /^tableaux/.test(l)));
  const manque = ['fr', 'en', 'es', 'it', 'de'].filter((l) => { const t = fs.readFileSync(path.join(T, `src/i18n/langues/${l}/argentPlus.js`), 'utf8'); const m = /"argentPlus\.svg\.desc": "([^"]+)"/.exec(t); return !m || !/URSSAF/.test(m[1]); });
  dit(manque.length === 0, 'M5b la carte dit les tableaux (numéros, factures, dépenses, URSSAF) dans les cinq langues', manque);
  fin();
})().catch((e) => { dit(false, 'exécution', String(e && e.stack || e).slice(0, 400)); fin(); });

function fin() {
  try { fs.rmSync(T, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${ko ? '❌' : '✅'} audit-mes-donnees : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
}
