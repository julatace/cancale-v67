// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE LIVRE DES RECETTES ET LE REGISTRE DES ACHATS CONFORMES (11 nov.)
//         node scripts/audit-livre-registre.cjs [--mutation=<nom>]
//         node scripts/audit-livre-registre.cjs --prouve   (chaque mutation doit rougir)
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE la vraie chaîne (src/registres.js → src/registresConformes.js →
// CSV, XLSX relu par openpyxl, PDF relu par pdf.js) sur des ventes et des
// achats INVENTÉS (le dépôt est public). Exige :
//   M1. chaque mention obligatoire a sa colonne (recettes : date, client,
//       nature, montant, règlement, espèces, pièce ; achats : date,
//       fournisseur, nature, montant, règlement, espèces, pièce) ;
//   M2. client : nom de la FACTURE PRO de CETTE vente › pseudo de l'acheteur
//       (transaction lue CÔTÉ VENDEUR) › « Particulier » ; un avoir, une
//       facture annulée, deux factures pour une vente ⇒ aucune ; jamais le
//       titre (deux ventes au même titre ne partagent pas un client) ;
//   M3. fournisseur Vinted : pseudo lu CÔTÉ ACHETEUR seulement ;
//   M4. pièce d'un achat : facture jointe (photo ⇒ « ticket ») › reçu relié
//       par SON n° de transaction › la référence ; rien ⇒ vide et nommé ;
//   M5. « à dater » : dans aucun mois (somme des mois = lignes de la période),
//       listée à part ; une recette déclarée sans date : la date est nommée ;
//   M6. manques NOMMÉS et comptés (« 2 achats sans prix », règlement absent…) ;
//   M7. totaux par trimestre = total de l'année ; partiel ⇒ « au moins » ;
//   M8. fichiers horodatés (nom et « Établi le JJ/MM/AAAA à HH:MM ») ; jamais
//       « encaissé », jamais « conforme » ; chaque source dite « à vérifier »
//       tant qu'elle n'a pas été ouverte ;
//   M9. XLSX : les montants sont de VRAIS nombres, le total = la somme ;
//   M10. PDF : le total, les mentions et « à vérifier » ;
//   M11. filtres : plateforme, recherche, « à compléter » ;
//   M12. la carte lit les pseudos en PROJECTION (jamais `select=data`) et
//        complète les registres par CE module (aucune règle recopiée).
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R0 = path.join(__dirname, '..');
const NM = fs.realpathSync(path.join(R0, 'node_modules'));
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
const MUTATIONS = {
  // le titre désigne le client (ressemblance)
  'client-titre': ['src/registresConformes.js', "const f = factures && factures.get(String(l.id));", "const f = factures && (factures.get(String(l.id)) || [...factures.values()].find((x) => x.client && String(l.titre || '').length));"],
  // le pseudo lu du mauvais côté
  'cote': ['src/registresConformes.js', "export const pseudoClientTx = (r) => (r && r.side === 'seller' ? pseudoPropre(r.acheteur) : '');", "export const pseudoClientTx = (r) => (r ? pseudoPropre(r.acheteur || r.vendeur) : '');"],
  // un avoir devient la pièce d'une recette
  'avoir': ['src/registresConformes.js', "if (x.type === 'avoir_pro' || /^email_invoice_av/.test(String(x.id || '')) || String(x.annuleePar || '').trim()) continue;", ''],
  // la vente « à dater » glisse dans un mois
  'adater-mois': ['src/registresConformes.js', "for (const l of R.lignes) { const ym = l.ym || ymDe(l.ts) || ''; if (g.has(ym)) g.get(ym).push(l); }", "for (const l of [...R.lignes, ...R.horsPeriode]) { const ym = l.ym || ymDe(l.ts) || moisDePeriode(R.periode)[0]; if (g.has(ym)) g.get(ym).push(l); }"],
  // un manque tu
  'manque-tu': ['src/registresConformes.js', "const sm = R.sansMontant; if (sm) out.push(", "const sm = 0; if (sm) out.push("],
  // un règlement inventé
  'reglement-invente': ['src/registresConformes.js', "const reglementPlateforme = (p) => (PLATEFORMES_PAIEMENT.has(p) ? `Paiement via ${p}` : '');", "const reglementPlateforme = (p) => `Paiement via ${p || 'virement'}`;"],
  // une source dite vérifiée sans avoir été ouverte
  'source-verifiee': ['src/registresConformes.js', "export const etatSource = (s) => (s && s.verifie ? `vérifiée le ${s.verifie}` : 'à vérifier');", "export const etatSource = () => 'vérifiée';"],
  // fichier sans horodatage
  'horodatage': ['src/registresConformes.js', "}-${R.periode}-etabli-${d.getFullYear()}${deux(d.getMonth() + 1)}${deux(d.getDate())}-${deux(d.getHours())}${deux(d.getMinutes())}.${ext}`;", "}-${R.periode}.${ext}`;"],
  // montant en texte dans le classeur
  'xlsx-texte': ['src/registresConformes.js', "return forme === 'xlsx' ? { n: Math.round(Number(v) * 100) / 100 } : forme === 'csv' ? nb2(v) : eurosTexte(v);", "return forme === 'csv' || forme === 'xlsx' ? nb2(v) : eurosTexte(v);"],
  // la pièce d'achat par le reçu d'un AUTRE achat
  'piece-autre': ['src/registresConformes.js', "else if (vinted && l.reference && recuDe(String(l.reference))) {", "else if (vinted && l.reference && (recuDe(String(l.reference)) || A.lignes.some((x) => x.titre === l.titre && recuDe(String(x.reference))))) {"],
  // totaux trimestriels absents
  'trimestres': ['src/registresConformes.js', "if (tri.size > 1 || /^\\d{4}(-T[1-4])?$/.test(R.periode)) for", "if (false) for"],
  // la carte lit les transactions entières
  'select-data': ['src/registresConformes.js', "export const SELECT_PSEUDOS = 'id,tx:data->payload->transaction->>id,", "export const SELECT_PSEUDOS = 'id,data,tx:data->payload->transaction->>id,"],
  // filtre « à compléter » inopérant
  'filtre': ['src/registresConformes.js', "&& (!aCompleter || (l.manques || []).some((m) => m !== 'article'))", ''],
};

if (process.argv.includes('--prouve')) {
  let rouges = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, `--mutation=${m}`], { encoding: 'utf8' });
    const rouge = r.status !== 0;
    if (rouge) rouges += 1;
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ${rouge ? 'attrapée' : 'PAS attrapée'}`);
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(rouges === n ? `\n✅ livre-registre --prouve : ${n}/${n} mutations attrapées` : `\n❌ livre-registre --prouve : ${rouges}/${n}`);
  process.exit(rouges === n ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); };

// Une copie des modules (mutation appliquée dans la copie).
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'livre-registre-'));
for (const f of ['src/registres.js', 'src/registresConformes.js', 'src/factureAchat.js', 'src/prixAchatPropose.js', 'src/xlsxSimple.js', 'src/exportDonnees.js']) {
  let s = fs.readFileSync(path.join(R0, f), 'utf8');
  if (MUT && MUTATIONS[MUT] && MUTATIONS[MUT][0] === f) {
    if (!s.includes(MUTATIONS[MUT][1])) { console.log('❌ mutation impossible : motif absent — ' + MUTATIONS[MUT][1].slice(0, 90)); process.exit(2); }
    s = s.replace(MUTATIONS[MUT][1], MUTATIONS[MUT][2]);
  }
  fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
  fs.writeFileSync(path.join(dir, f), s);
}
fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
try { fs.symlinkSync(NM, path.join(dir, 'node_modules')); } catch (_) {}

(async () => {
  const imp = (f) => import(pathToFileURL(path.join(dir, f)).href);
  const Rg = await imp('src/registres.js'), C = await imp('src/registresConformes.js'), X = await imp('src/xlsxSimple.js');
  const t = (s) => Date.parse(s);
  // ── Les recettes INVENTÉES (année 2026)
  const decl = { lignes: [
    { id: 'vinted:91001', plateforme: 'Vinted', ts: t('2026-11-03T10:00:00'), ym: '2026-11', eur: 48.5, titre: 'Paire inventée', o: { _acc: { vinted_user_id: 111 } }, dateVente: '2026-10-28' },
    { id: 'vinted:91002', plateforme: 'Vinted', ts: t('2026-11-04T10:00:00'), ym: '2026-11', eur: 61, titre: 'Paire inventée', o: { _acc: { vinted_user_id: 111 } }, dateVente: '2026-11-01' },
    { id: 'lbc:55', plateforme: 'Leboncoin', ts: t('2026-02-05T10:00:00'), ym: '2026-02', eur: 30, titre: '' },
    { id: 'importe:z1', plateforme: 'Autre', ts: t('2026-05-07T10:00:00'), ym: '2026-05', eur: 20, titre: 'Importée inventée', importee: true },
    { id: 'vinted:91009', plateforme: 'Vinted', ts: null, ym: '2026-11', eur: 11, titre: 'Déclarée inventée', declaree: true, o: { _acc: { vinted_user_id: 222 } } },
  ], aDater: [{ id: 'vinted:91004', plateforme: 'Vinted', eur: 72.4, titre: 'À dater inventée', o: { _acc: { vinted_user_id: 111 } } }], ecartees: [] };
  const recA = Rg.livreDesRecettes({ decl, periode: '2026' });
  const recN = Rg.livreDesRecettes({ decl, periode: '2026-11' });
  // Projections de transactions (forme `SELECT_PSEUDOS`) : 91001 lue côté vendeur, 91002 lue côté ACHETEUR (achat entre ses comptes).
  const rowsTx = [
    { id: 'harvest_111_txn_91001', tx: '91001', side: 'seller', vendeur: 'moi_inventee', acheteur: 'acheteuse_inventee' },
    { id: 'harvest_111_txn_91002', tx: '91002', side: 'buyer', vendeur: 'moi_autre', acheteur: 'moi_inventee' },
    { id: 'harvest_111_txn_71001', tx: '71001', side: 'buyer', vendeur: 'vendeuse_inventee', acheteur: 'moi_inventee' },
    { id: 'harvest_111_txn_71002', tx: '71002', side: 'seller', vendeur: 'moi_inventee', acheteur: 'x' },
  ];
  const lusSelect = [];
  const lireTout = async (q) => { lusSelect.push(q); const ids = (/id=in\.\(([^)]*)\)/.exec(q) || [])[1].split(','); return rowsTx.filter((r) => ids.includes(r.id)); };
  const factures = C.facturesParVente([
    { id: 'email_invoice_1', numero: 'F2026-0003', transaction: '91001', acheteur: 'Société inventée' },
    { id: 'email_invoice_av1', numero: 'AV2026-0001', type: 'avoir_pro', transaction: '91002', acheteur: 'Avoir inventé' },
    { id: 'email_invoice_lbc_55', numero: 'F2026-0004', plateforme: 'leboncoin', reference: '55', acheteur: '' },
    { id: 'email_invoice_x1', numero: 'F2026-0005', transaction: '91009', acheteur: 'Double A', annuleePar: 'AV2026-0002' },
  ]);
  const ps1 = await C.lirePseudosTx(C.idsTxLignes([...recA.lignes, ...recA.horsPeriode]), { lireTout });
  const R = C.completerRecettes(recA, { pseudos: ps1, factures });
  const RN = C.completerRecettes(recN, { pseudos: ps1, factures });
  const L = (id) => R.lignes.find((l) => l.id === id) || R.horsPeriode.find((l) => l.id === id);

  console.log('── M1 colonnes');
  const cR = C.COLONNES_CONFORMES.recettes.map((c) => c[0]), cA = C.COLONNES_CONFORMES.achats.map((c) => c[0]);
  dit(['date', 'client', 'nature', 'montant', 'reglement', 'especes', 'piece'].every((k) => cR.includes(k)), 'M1 · recettes : date, client, nature, montant, règlement, espèces, pièce');
  dit(['date', 'fournisseur', 'nature', 'montant', 'reglement', 'especes', 'piece'].every((k) => cA.includes(k)), 'M1 · achats : date, fournisseur, nature, montant, règlement, espèces, pièce');

  console.log('── M2 client');
  dit(L('vinted:91001').client === 'Société inventée' && L('vinted:91001').clientSource === 'facture', 'M2 · facture Pro de CETTE vente ⇒ son nom', L('vinted:91001'));
  dit(L('vinted:91002').client === 'Particulier', 'M2 · même titre, sans facture, transaction lue côté acheteur ⇒ « Particulier » (ni le nom de l’autre, ni un avoir)', L('vinted:91002').client);
  dit(L('vinted:91009').client === 'Particulier' && !/Double/.test(L('vinted:91009').piece), 'M2 · facture annulée ⇒ jamais la pièce ni le client', L('vinted:91009').piece);
  dit(L('lbc:55').piece === 'Facture F2026-0004' && L('lbc:55').client === 'Particulier', 'M2 · Leboncoin : facture par plateforme + référence ; facture sans nom ⇒ « Particulier »', L('lbc:55'));
  const R2 = C.completerRecettes(recA, { pseudos: ps1, factures: null });
  dit(R2.lignes.find((l) => l.id === 'vinted:91001').client === 'acheteuse_inventee', 'M2 · sans facture : le pseudo de l’acheteur, transaction lue côté vendeur', R2.lignes.find((l) => l.id === 'vinted:91001').client);
  const dbl = C.facturesParVente([{ id: 'a', numero: 'F1', transaction: '91001', acheteur: 'A' }, { id: 'b', numero: 'F2', transaction: '91001', acheteur: 'B' }]);
  dit(dbl && !dbl.has('vinted:91001'), 'M2 · deux factures pour une vente ⇒ aucune choisie');

  console.log('── M3/M4 achats');
  const achats = [
    { transaction_id: 71001, title: 'Achat inventé', price: { amount: '40', currency_code: 'EUR' }, status: 'Transaction finalisée', date: '2026-11-02T10:00:00Z', _uid: '111', compte: 'compte_a' },
    { transaction_id: 71002, title: 'Achat inventé', price: { amount: '25', currency_code: 'EUR' }, status: 'Transaction finalisée', date: '2026-11-03T10:00:00Z', _uid: '111', compte: 'compte_a' },
    { transaction_id: 71003, title: 'Achat inventé', price: { amount: '33', currency_code: 'USD' }, status: 'Transaction finalisée', date: '2026-08-03T10:00:00Z', _uid: '111', compte: 'compte_a' },
  ];
  const hors = [{ id: 'h1', title: 'Hors inventé', price: '', date: '2026-11-04' }, { id: 'h2', title: 'Hors inventé bis', price: '15', date: '2026-11-05' }];
  const regA = Rg.registreDesAchats({ achats, hors, periode: '2026', montantHors: (b) => (b.price ? Number(b.price) : null), sourceHors: () => 'Brocante inventée' });
  const ps2 = await C.lirePseudosTx(C.idsTxLignes(regA.lignes), { lireTout });
  const A = C.completerAchats(regA, { pseudos: ps2, recuDe: (tx) => tx === '71001', facturesJointes: { hors_h1: { type: 'image', nom: 'ticket.jpg' }, tx_71003: { type: 'pdf', nom: 'facture.pdf' } } });
  const LA = (id) => A.lignes.find((l) => l.id === id);
  dit(LA('vinted:71001').fournisseur === 'vendeuse_inventee', 'M3 · pseudo du vendeur lu côté acheteur', LA('vinted:71001').fournisseur);
  dit(LA('vinted:71002').fournisseur === 'Particulier (Vinted)', 'M3 · transaction lue côté vendeur ⇒ jamais son propre pseudo', LA('vinted:71002').fournisseur);
  dit(LA('vinted:71001').pieceType === 'recu' && LA('vinted:71002').pieceType === 'reference', 'M4 · reçu relié par SON n° (même titre ⇒ pas de reçu prêté)', [LA('vinted:71001').piece, LA('vinted:71002').piece]);
  dit(LA('hors:h1').pieceType === 'ticket' && LA('vinted:71003').pieceType === 'facture', 'M4 · facture jointe : photo ⇒ ticket, PDF ⇒ facture', [LA('hors:h1').piece, LA('vinted:71003').piece]);
  dit(LA('hors:h2').piece === '' && LA('hors:h2').manques.includes('piece') && LA('hors:h2').reglement === '', 'M4 · hors plateforme sans pièce ni mode : vides et nommés (jamais inventés)', LA('hors:h2'));

  console.log('── M5 à dater');
  const mois = C.parMois(R);
  dit(mois.reduce((s, m) => s + m.n, 0) === R.lignes.length && !mois.some((m) => m.lignes.some((l) => l.id === 'vinted:91004')), 'M5 · la vente à dater n’est dans aucun mois');
  dit(R.horsPeriode.some((l) => l.id === 'vinted:91004') && !R.lignes.some((l) => l.id === 'vinted:91004'), 'M5 · listée à part');
  dit(mois.find((m) => m.ym === '2026-11').lignes.some((l) => l.id === 'vinted:91009') && L('vinted:91009').manques.includes('date'), 'M5 · déclarée sans date : dans le mois de sa déclaration, la date nommée');
  dit(mois.find((m) => m.ym === '2026-11').n === 3 && mois.find((m) => m.ym === '2026-10').n === 0, 'M5 · datée au VERSEMENT (vendue en octobre, versée en novembre ⇒ novembre)');

  console.log('── M6 manques nommés');
  const mA = C.manquesNommes(A), mR = C.manquesNommes(R);
  const nM = (ms, k) => (ms.find((m) => m.cle === k) || {}).n || 0;
  dit(nM(mA, 'montant') === regA.sansMontant && regA.sansMontant === 2, 'M6 · « 2 achats sans prix » (hors sans prix + autre devise)', mA);
  dit(nM(mA, 'reglement') === 2, 'M6 · « 2 achats sans mode de paiement » (hors plateforme)', mA);
  dit(nM(mR, 'reglement') === 1 && nM(mR, 'piece') === 1 && nM(mR, 'a-dater') === 1 && nM(mR, 'date') === 1, 'M6 · recettes : règlement, pièce (importée), à dater, déclarée sans date', mR);

  console.log('── M7 totaux');
  const tot = C.totauxPeriodes(R);
  const tri = tot.filter((x) => /-T\d$/.test(x.cle)), an = tot[tot.length - 1];
  dit(tri.length === 4 && Math.round(tri.reduce((s, x) => s + x.total * 100, 0)) === Math.round(an.total * 100) && an.cle === '2026', 'M7 · 4 trimestres dont la somme = l’année', tot);
  const totA = C.totauxPeriodes(A);
  dit(totA[totA.length - 1].partiel === true, 'M7 · achats sans prix ⇒ « au moins »');

  console.log('── M8 fichiers');
  const quand = t('2026-11-11T14:32:00');
  const csv = C.csvConforme(R, { maintenant: quand }), csvA = C.csvConforme(A, { maintenant: quand });
  dit(C.nomFichierConforme(R, 'pdf', quand) === 'Livre-des-recettes-2026-etabli-20261111-1432.pdf', 'M8 · nom horodaté', C.nomFichierConforme(R, 'pdf', quand));
  dit(/Établi le 11\/11\/2026 à 14:32/.test(csv), 'M8 · « Établi le 11/11/2026 à 14:32 »');
  const tous = csv + csvA;
  dit(!/encaiss/i.test(tous) && !/\bconforme/i.test(tous), 'M8 · jamais « encaissé », jamais « conforme »');
  dit(Object.values(C.SOURCES).every((s) => !s.verifie) && (tous.match(/à vérifier\)/g) || []).length >= 10 && !/vérifiée/.test(tous), 'M8 · chaque source « à vérifier » (aucune ouverte)');
  const lc = csv.replace(/^﻿/, '').split('\r\n').map((l) => l.split(';'));
  const iH = lc.findIndex((r) => r[0] === 'Date'), iT = lc.findIndex((r, i) => i > iH && r[0] === 'Total');
  const iM = lc[iH].indexOf('Montant');
  const somme = lc.slice(iH + 1, iT).reduce((s, r) => s + (r[iM] ? Math.round(Number(r[iM].replace(',', '.')) * 100) : 0), 0);
  dit(iT - iH - 1 === R.n && somme === Math.round(R.total * 100) && lc[iT][iM] === (R.total).toFixed(2).replace('.', ','), 'M8 · CSV : lignes et total = le registre', { n: iT - iH - 1, somme, total: lc[iT][iM] });

  console.log('── M9 XLSX');
  const xp = path.join(dir, 'r.xlsx');
  fs.writeFileSync(xp, X.xlsxClasseur(C.feuillesConformes(R, { maintenant: quand }), { quand: new Date(quand) }));
  const py = spawnSync('python3', ['-I', '-c', `import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1])
ws=wb[wb.sheetnames[0]]
rows=[[c.value for c in r] for r in ws.iter_rows()]
h=rows[0]; im=h.index('Montant')
corps=[r for r in rows[1:] if r[0]!='Total']
tot=[r for r in rows if r[0]=='Total'][0][im]
print(json.dumps({'feuilles':wb.sheetnames,'types':sorted(set(type(r[im]).__name__ for r in corps)),'somme':round(sum(r[im] or 0 for r in corps),2),'total':tot,'n':len(corps)}))`, xp], { encoding: 'utf8' });
  let xo = null; try { xo = JSON.parse(py.stdout); } catch (_) { xo = null; }
  dit(xo && xo.types.every((x) => x === 'float' || x === 'int') && Math.round(xo.somme * 100) === Math.round(R.total * 100) && Math.round(xo.total * 100) === Math.round(R.total * 100) && xo.n === R.n, 'M9 · montants en vrais nombres, total = somme', xo || py.stderr);
  dit(xo && xo.feuilles.includes('À dater') && xo.feuilles.includes('Sources') && xo.feuilles.includes('Totaux'), 'M9 · feuilles « À dater », « Totaux », « Sources »', xo && xo.feuilles);

  console.log('── M10 PDF');
  let txt = '';
  try {
    const pdfjs = await import(pathToFileURL(path.join(NM, 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs')).href);
    const oct = await C.pdfConforme(A, { maintenant: quand, entreprise: { nom: 'Entreprise inventée', siret: '00000000000000' } });
    if (process.env.BANC_CAPTURE) fs.writeFileSync(path.join(process.env.BANC_CAPTURE, 'audit-registre-achats.pdf'), oct);
    const doc = await pdfjs.getDocument({ data: new Uint8Array(oct), isEvalSupported: false, standardFontDataUrl: path.join(NM, 'pdfjs-dist', 'standard_fonts') + '/' }).promise;
    for (let i = 1; i <= doc.numPages; i++) { const p = await doc.getPage(i); const tc = await p.getTextContent(); txt += tc.items.map((x) => x.str).join(' ') + '\n'; }
  } catch (e) { txt = ''; dit(false, 'M10 · le PDF se crée et se relit', e.message); }
  const tp = txt.replace(/[  ]/g, ' ');
  dit(/Registre des achats/.test(tp) && /Mentions obligatoires/.test(tp) && /à vérifier/.test(tp) && /établi le 11\/11\/2026 à 14:32/.test(tp), 'M10 · titre, mentions, « à vérifier », horodatage');
  dit(tp.includes(Rg.eurosTexte(A.total).replace(/[  ]/g, ' ').replace('−', '-')) && /au moins/.test(tp) && /achats sans prix/.test(tp), 'M10 · total « au moins » et manques nommés');

  console.log('── M11 filtres');
  dit(C.filtrerLignes(R.lignes, { plateforme: 'Leboncoin' }).length === 1, 'M11 · plateforme');
  dit(C.filtrerLignes(R.lignes, { q: 'importee' }).length === 1, 'M11 · recherche sans accents');
  dit(C.filtrerLignes(A.lignes, { aCompleter: true }).every((l) => l.manques.some((m) => m !== 'article')) && C.filtrerLignes(A.lignes, { aCompleter: true }).length < A.lignes.length, 'M11 · « à compléter » ne garde que les lignes incomplètes');

  console.log('── M12 lecture et montage');
  dit(lusSelect.length > 0 && lusSelect.every((q) => !/select=[^&]*\bdata\b(?!->)/.test(q) && /select=id,tx:data->payload/.test(q)), 'M12 · pseudos lus en projection, jamais select=data', lusSelect[0]);
  const COMPTA = fs.readFileSync(path.join(R0, 'src/ecrans/Compta.jsx'), 'utf8');
  dit(/completerRecettes\(recettes/.test(COMPTA) && /completerAchats\(registreAchats/.test(COMPTA) && /<RegistresVue /.test(COMPTA), 'M12 · la carte complète les registres par ce module et monte la feuille');
  dit(!/csvRegistre\(|pdfRegistre\(/.test(COMPTA), 'M12 · la carte n’exporte plus l’ancienne mise en page (sans les mentions)');

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  console.log(ko ? `\n❌ livre-registre : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ livre-registre : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
