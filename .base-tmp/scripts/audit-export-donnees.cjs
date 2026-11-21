#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « EXPORTER MES DONNÉES » DIT LES MÊMES CHIFFRES QUE LES ÉCRANS (3 nov.)
//        node scripts/audit-export-donnees.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// L'export (src/exportDonnees.js) est relu comme Excel le relirait — le zip
// décompressé, chaque CSV parsé — et comparé à ce que l'écran affiche :
//   X1 ventes : chaque mois, le total et le nombre = le récap du mois
//      (`donneesRecapMois`, src/recapMois.js, la même source `vrm_stats_ventes`) ;
//   X2 URSSAF : CA par mois = la ligne publiée ; « à payer » = la règle passée ;
//   X3 stock, achats (N° relié), dépenses, déclarations, factures Pro : chaque ligne ;
//   X4 « pas su » ⇒ « — », jamais une feuille vide ni 0 ;
//   X5 le zip est valide (CRC-32 relus, `unzip -t` si présent) ;
//   X6 l'app : lectures PAGINÉES (`lireTout`), PROJETÉES (jamais `select=data`),
//      aucune écriture ni envoi (rien ne part ailleurs), « Exporter mes données »
//      dans Paramètres, sans texte explicatif.
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const MUTS = {
  'vente-perdue': ['src/exportDonnees.js', "...releve.filter(Array.isArray).slice()", "...releve.filter((l) => Array.isArray(l) && l[8]).slice()"],
  'passu-vide': ['src/exportDonnees.js', "const PAS_SU = [['—']];", 'const PAS_SU = [];'],
  'virgule': ['src/exportDonnees.js', ".toFixed(2).replace('.', ',')", '.toFixed(2)'],
  'crc': ['src/exportDonnees.js', "h.setUint32(14, crc, true);", 'h.setUint32(14, 0, true);'],
  'select-data': ['src/App.jsx', "lireTout('id=like.harvest_*_orders_purchased&select=id,orders:data->payload->my_orders')", "lireTout('id=like.harvest_*_orders_purchased&select=id,data')"],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'export-')); const m = MUTS[MUT];
  for (const f of ['exportDonnees.js', 'recapMois.js', 'App.jsx']) fs.copyFileSync(path.join(R, 'src', f), path.join(d, f));
  const f = path.join(d, path.basename(m[0])); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(m[1])) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(m[1], m[2])); SRC = d; console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const imp = (f) => import(require('url').pathToFileURL(path.join(SRC, f)).href);

(async () => {
  const E = await imp('exportDonnees.js'), RM = await imp('recapMois.js');
  const t = (s) => Date.parse(s);
  // Le relevé de Ventes (forme publiée : [site, compte, tx, ts, vendu, achat, frais, titre, N°, reçu le]).
  const releve = [
    ['Vinted', 'boutique_nord', '9001', t('2026-09-03T10:00:00Z'), 60, 30, 2.5, 'Nike Air Max 1; noir "42"', '12', '2026-09-08T09:00:00Z'],
    ['Leboncoin', '', 'L1', t('2026-09-20T10:00:00Z'), 45.5, null, 0, 'Adidas Samba 40', '', '2026-09-20T10:00:00.000Z'],
    ['eBay', '', 'E1', t('2026-10-02T10:00:00Z'), 99.99, 50, 12.1, 'Asics Gel 43', '7', ''],
    ['Vestiaire', '', 'V1', t('2026-10-15T10:00:00Z'), 150, 80, null, 'Sac', 'B12', '2026-10-25T10:00:00Z'],
    ['Vinted', 'boutique_sud', '9002', t('2026-10-30T22:30:00Z'), 30, null, 1, 'Puma Suede 41', '', ''],
  ];
  const urssaf = [{ ym: '2026-09', n: 2, ca: 105.5 }, { ym: '2026-10', n: 1, ca: 150 }];
  const aPayer = (ca) => Math.round(ca * 0.124 * 100) / 100;
  const fiches = { a1: { numero: '12', title: 'Nike Air Max 1', buyPrice: '30', buyFromId: '7001' }, a2: { numero: '7', title: 'Asics', buyPrice: '' }, a3: { title: 'sans N°' } };
  const achats = [{ transaction_id: 7001, title: 'Nike Air Max 1', date: '2026-08-01T10:00:00Z', price: { amount: '30.0' }, status: 'Commande finalisée', compte: 'boutique_nord' }, { transaction_id: 7002, title: 'Lot 3 articles', date: '2026-08-05T10:00:00Z', price: { amount: '90.0' }, status: 'Commande finalisée', compte: 'boutique_sud' }];
  const compta = { fixes: [{ label: 'Box', montant: 20 }], depenses: [{ date: '2026-10-03', libelle: 'Cartons', cat: 'Emballage', montant: 12.4 }], packs: [], abonnements: [{ libelle: 'VRM', montant: 16.99 }] };
  const declarations = { '2026-09': { at: t('2026-10-05T10:00:00Z'), ca: 105.5, montant: 13.08, paye: 13.08, regle: 'versement', n: 2 } };
  const factures = [{ id: 'email_invoice_tx9001', number: 'F-2026-0002', status: 'emise', emiseLe: '2026-09-04T10:00:00Z', tx: '9001' }, { id: 'email_invoice_tx9002', number: 'F-2026-0001', status: 'emise', emiseLe: '2026-09-01T10:00:00Z', tx: '9002' }];
  const zip = E.zipStocke(E.fichiersExport(E.feuillesExport({ releve, urssaf, aPayer, declarations, fiches, achats, compta, factures })));
  const lu = E.lireZipStocke(zip);
  const F = Object.fromEntries(lu.map((f) => [f.nom.replace(/\.csv$/, ''), E.lireCsv(f.texte)]));
  const num = (s) => (s === '' ? null : Number(String(s).replace(',', '.')));

  console.log('\n── X5. Le zip');
  dit(lu.length === 7 && lu.every((f) => f.crcOk), 'X5 7 tableaux, CRC-32 justes', JSON.stringify(lu.map((f) => [f.nom, f.crcOk])));
  const tmp = path.join(os.tmpdir(), 'vrm-export-audit.zip'); fs.writeFileSync(tmp, zip);
  let unzipOk = null; try { execFileSync('unzip', ['-t', tmp], { stdio: 'pipe' }); unzipOk = true; } catch (e) { unzipOk = e.code === 'ENOENT' ? null : false; }
  dit(unzipOk !== false, 'X5 `unzip -t` accepte l’archive' + (unzipOk === null ? ' (unzip absent ici)' : ''));
  if (typeof require('zlib').crc32 === 'function') dit(lu.length && E.crc32(new TextEncoder().encode('VRM')) === require('zlib').crc32('VRM'), 'X5 CRC-32 = celui de zlib');

  console.log('\n── X1. Ventes = le récap du mois');
  const V = F.ventes || [];
  for (const ym of ['2026-09', '2026-10']) {
    const d = RM.donneesRecapMois({ ym, releve });
    const lignes = V.slice(1).filter((l) => {
      const ts = releve.find((r) => String(r[2]) === l[3])[3]; const x = new Date(ts); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` === ym;
    });
    const tot = Math.round(lignes.reduce((s, l) => s + num(l[6]) * 100, 0)) / 100;
    dit(lignes.length === d.n && tot === d.vendu, `X1 ${ym} : ${lignes.length} ventes, ${tot} € = récap (${d.n}, ${d.vendu} €)`);
  }
  dit(V.length === releve.length + 1 && /Nike Air Max 1; noir "42"/.test(V.map((l) => l[5]).join('|')), 'X1 chaque vente, titre avec « ; » et guillemets relu intact');
  dit(V[2] && V[2][7] === '' && V[1][7] === '30,00', 'X1 prix d’achat inconnu ⇒ cellule vide, jamais 0');

  console.log('\n── X2. URSSAF = la ligne publiée');
  const U = F.urssaf || [];
  dit(U.length === 3 && U[1][2] === '105,50' && U[2][2] === '150,00' && U[1][3] === '13,08', 'X2 CA par mois daté au versement, à payer de la règle', JSON.stringify(U));

  console.log('\n── X3. Les autres tableaux');
  const S = F.stock || [], A = F.achats || [], D = F.depenses || [], DE = F.declarations || [], FP = F['factures-pro'] || [];
  dit(S.length === 3 && S[1][0] === '7' && S[2][0] === '12' && S[2][3] === '7001', 'X3 stock : les fiches numérotées (sans la fiche sans N°), achat relié');
  dit(A.length === 3 && A.find((l) => l[2] === '7001')[6] === '12' && A.find((l) => l[2] === '7002')[4] === '90,00', 'X3 achats : N° relié, prix payé');
  dit(D.length === 4 && D.some((l) => l[2] === 'Cartons' && l[4] === '12,40'), 'X3 dépenses : fixes, dépenses, abonnements');
  dit(DE.length === 2 && DE[1][0] === '2026-09' && DE[1][4] === '13,08', 'X3 déclarations : le registre');
  dit(FP.length === 3 && FP[1][0] === 'F-2026-0001' && !FP.flat().some((c) => /pdf|base64/i.test(c)), 'X3 factures Pro : métadonnées, dans l’ordre des numéros, aucun PDF');

  console.log('\n── X4. Pas su');
  const vide = E.feuillesExport({});
  dit(vide.length === 7 && vide.every((f) => f.lignes.length === 1 && f.lignes[0][0] === '—'), 'X4 toute source ratée ⇒ « — » (jamais une feuille vide ni 0)');

  console.log('\n── X6. Le branchement dans l’app');
  const APP = fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8');
  const a = APP.indexOf('async function sourcesExportDonnees()'), b = APP.indexOf('const telechargerFichier = (contenu, nom, type) =>', a);
  const bloc = a > 0 && b > a ? APP.slice(a, b).replace(/\/\/.*$/gm, '') : '';
  dit(!!bloc, 'X6 la lecture des sources existe');
  // (6 nov., vitesse 2) Les achats : ceux des comptes liés, par `lireAchatsLies` (paginée, projetée) — on juge SA lecture.
  const la = (() => { const i = APP.indexOf('async function lireAchatsLies('); const j = APP.indexOf('\n}', i); return i >= 0 && j > i ? APP.slice(i, j) : ''; })();
  const achatsLus = /lireTout\('id=like\.harvest_\*_orders_purchased&select=id,orders:data->payload->my_orders'\)/.test(bloc)
    || (/lireAchatsLies\(/.test(bloc) && /select=id,orders:data->payload->my_orders/.test(la) && /lireTout\(`id=in\./.test(la) && /lireTout\(`id=like\.harvest_\*_orders_purchased/.test(la));
  dit(achatsLus && /lireTout\('id=like\.email_invoice_\*&select=id,number:/.test(bloc), 'X6 achats et factures lus PAGINÉS (lireTout) et PROJETÉS');
  dit(!/select=(id,)?data\b(?!->)/.test(bloc), 'X6 jamais `select=data`');
  dit(!/method:\s*'(POST|PATCH|PUT|DELETE)'|save\(|modifierDonnee|\/api\//.test(bloc), 'X6 aucune écriture, aucun envoi : le zip est seulement téléchargé');
  // (8 nov.) Depuis le 6 nov. (Onglets D, « Paramètres par intention ») chaque réglage porte UNE
  // phrase (`desc`) — la règle du visuel : « une ligne d'explication au plus, le reste en feuille ».
  // « Sans texte explicatif » se juge donc ainsi : au plus une phrase courte (≤ 90 signes, un seul
  // point final au plus), jamais un paragraphe ni un bloc d'aide.
  // (11 nov., traduction) La ligne vit dans src/ecrans/Reglages.jsx et ses textes passent par tr() :
  // ils se lisent dans le français (src/i18n/langues/fr.js, la source), par la clé posée.
  const REG = APP + '\n' + fs.readFileSync(path.join(SRC, 'ecrans', 'Reglages.jsx'), 'utf8');
  const FR = fs.readFileSync(path.join(SRC, 'i18n', 'langues', 'fr.js'), 'utf8');
  const frDe = (cle) => { const m = new RegExp('"' + cle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '":\\s*"([^"]*)"').exec(FR); return m ? m[1] : null; };
  const txt = (lit, cle) => (lit != null ? lit : cle != null ? frDe(cle) : null);
  const mExport = /\{ id:'donnees', type:'action', ic:'[a-z-]+', lib:(?:'([^'\n]*)'|tr\('([^']+)'\)),(?: desc:(?:'([^'\n]*)'|tr\('([^']+)'\)),)? onClick:exporterMesDonnees, data:\{ 'data-exporter-donnees':'' \} \}/.exec(REG);
  const ligneExport = mExport && txt(mExport[1], mExport[2]) === 'Exporter mes données' ? mExport : null;
  const descExport = ligneExport ? (txt(ligneExport[3], ligneExport[4]) || '') : '';
  dit(!!ligneExport && descExport.length <= 90 && (descExport.match(/[.!?](\s|$)/g) || []).length <= 1, 'X6 Paramètres → « Exporter mes données », sans texte explicatif (une phrase au plus)', descExport ? `« ${descExport} » (${descExport.length} signes)` : '');
  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
