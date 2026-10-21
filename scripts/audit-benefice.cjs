// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE BÉNÉFICE BRUT ET NET — UNE règle, deux écrans (19 octobre)
//         node scripts/audit-benefice.cjs [--mutation=duplique|zero|cotis|titre|ambigu|fraiszero|port]
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « le bénéfice brut et net ». L'écran Ventes le calculait ; l'écran
// Comptabilité disait « ce n'est donc pas encore ton bénéfice net ». Comptabilité
// l'affiche maintenant — en CONSOMMANT les cumuls que Ventes publie jour par jour
// (`vrm_benefice_jours`), jamais en relisant un prix d'achat (§11).
// Cet audit EXÉCUTE les vraies fonctions extraites d'App.jsx (Babel, dans un vm)
// sur des ventes INVENTÉES et vérifie :
//   1. la somme « façon Ventes » (un cumul sur les ventes de la période) = la
//      somme « façon Comptabilité » (les jours publiés de la période) ;
//   2. brut et net ne portent QUE sur les ventes au prix d'achat connu (un
//      achat inconnu n'est pas un achat à 0 €, §5) ; « 0 » saisi est connu ;
//   3. les bornes de période (jour local entier, comme `dansPeriode`) ;
//   4. le net final : brut − frais − charges − cotisations, et `null` (« — ») si
//      un prix d'achat manque ou si le CA déclaré n'est pas publié ;
//   5. les cotisations portent sur la part VINTED du CA déclaré publié ;
//   6. le code : `totals` (Ventes) passe par la règle, et Comptabilité ne relit
//      aucun prix d'achat (pas de second calcul).
// `--mutation=…` réaffaiblit la règle dans une copie du source : chaque mutation
// doit faire passer au moins un contrôle au rouge.
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..');
let parser;
try { parser = require(path.join(R, 'node_modules', '@babel', 'parser')); }
catch (e) { console.log('❌ l\'analyseur Babel est disponible — ' + e.message); process.exit(1); }

const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let src = require('./_source-app.cjs')(path.join(R, 'src', 'App.jsx'));
const muter = (avant, apres) => { if (!src.includes(avant)) { console.log('❌ mutation impossible : motif absent'); process.exit(2); } src = src.replace(avant, apres); };
if (MUT === 'duplique') {
  // Un SECOND calcul dans Comptabilité, qui diverge : un achat inconnu y vaut 0 €.
  muter('const v = beneficeDesJours(jours, de, a);',
    'const v = (() => { const x = beneficeDesJours(jours, de, a); return { ...x, brut: x.ca - x.cout, net: x.ca - x.cout - x.frais }; })();');
} else if (MUT === 'zero') {
  // La règle elle-même : un achat inconnu compté à 0 €.
  muter("const connu = achat != null && String(achat).trim() !== '' && isFinite(Number(achat));", 'achat = Number(achat) || 0; const connu = true;');
} else if (MUT === 'cotis') {
  // Le net écrit même quand un prix d'achat manque.
  muter('const complet = v.nCout === v.n;', 'const complet = true;');
} else if (MUT === 'titre') {
  // Un rapprochement par TITRE ajouté : le « nXXX » du titre Leboncoin pris pour une identité.
  muter("  if (!ad) return '';\n  const ks = new Set();", "  if (!ad) return '';\n  const ks = new Set(); { const mt = numDeTitreLbc(ad.subject || ad.title); if (mt) return cleNum(mt); }");
} else if (MUT === 'ambigu') {
  // Un N° porté par DEUX fiches accepté : la première prise.
  muter('return fs.length === 1 ? fs[0] : null;', 'return fs.length >= 1 ? fs[0] : null;');
} else if (MUT === 'fraiszero') {
  // (20 oct.) Des frais eBay inconnus comptés à 0 : la commande n'est plus écartée.
  muter("if (!f) return { eur: null, raison: 'frais eBay inconnus' };", "if (!f) return { eur: Number(d.value), raison: '' };");
} else if (MUT === 'port') {
  // (20 oct.) Le total payé par l'acheteur (port compris) au lieu de l'argent reçu.
  muter('const d = lu(o && o.paymentSummary && o.paymentSummary.totalDueSeller);', 'const d = lu(o && o.pricingSummary && o.pricingSummary.total);');
} else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = (nom, f) => { try { f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 200)); } };

// ── Extraction des déclarations de premier niveau ───────────────────────────
let ast;
try { ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] }); }
catch (e) { console.log('❌ App.jsx se lit — ' + e.message); process.exit(1); }
const decl = new Map();
for (const n of ast.program.body) {
  const d = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
  if (!d) continue;
  if (d.type === 'FunctionDeclaration' && d.id) decl.set(d.id.name, src.slice(d.start, d.end));
  if (d.type === 'VariableDeclaration') for (const v of d.declarations) if (v.id && v.id.name) decl.set(v.id.name, `${d.kind} ${src.slice(v.start, v.end)};`);
}
const VOULUS = ['BENEF_CHAMPS', 'beneficeVide', 'ajouterVenteBenefice', 'jourBeneficeEnTableau', 'cumulerBenefice', 'resumeBenefice', 'beneficeDesJours', 'caVintedDuMois', 'beneficePeriode',
  'ventesAutresBenefice', 'numeroLbcIdentite', 'numLigneEbay', 'couvertureBenefice', 'caBeneficeDuMois'];
const manquants = VOULUS.filter((k) => !decl.has(k));
dit(!manquants.length, 'les fonctions du bénéfice existent dans App.jsx', manquants.join(', '));
if (manquants.length) { console.log(`\n❌ audit-benefice : ${ko} rouge(s)`); process.exit(1); }

// ── (19 oct., suite) Leboncoin et eBay : données INVENTÉES ───────────────────
// Les fiches (`vinted_annonce_numeros`), le marqueur de la remise à zéro 013 et
// les liens eBay vivent dans un faux localStorage : `numEbayLu` (la vraie
// règle) les lit là, comme dans l'app.
const NOW_ISO = new Date().toISOString();
const COUPURE = new Date(Date.now() - 30 * 86400000).toISOString();
const FICHES = {
  a12: { numero: '12', buyPrice: '30', title: 'Nike Air Max inventée' },
  a7: { numero: '7', buyPrice: '25', title: 'Adidas Samba inventée' },
  t9: { numero: '9', buyPrice: '18', title: 'Salomon XT-6 inventée' },
  d1: { numero: '40', buyPrice: '10', title: 'Paire A inventée' },
  d2: { numero: '40', buyPrice: '12', title: 'Paire B inventée' },
  m1: { numero: '41', buyPrice: '11', title: 'Même titre inventé' },
  m2: { numero: '41', buyPrice: '13', title: 'Même titre inventé' },
};
const MAGASIN = {
  vinted_annonce_numeros: JSON.stringify(FICHES),
  vrm_numerotation: JSON.stringify({ version: 2, archive: 'B', coupure: COUPURE, ebayAnnonces: { '222': { '553': '12' } }, lbcAnnonces: {} }),
};
const FAUX_LS = { getItem: (k) => (Object.prototype.hasOwnProperty.call(MAGASIN, k) ? MAGASIN[k] : null), setItem: (k, v) => { MAGASIN[k] = String(v); }, removeItem: (k) => { delete MAGASIN[k]; } };
// (20 oct., revue argent eBay) La forme de l'API Fulfillment : l'acheteur paie
// `pricingSummary.total` (port de 6 € compris), le vendeur est dû
// `paymentSummary.totalDueSeller` ; l'argent reçu = dû − `totalMarketplaceFee`.
const ebayCmd = (orderId, du, lignes, extra = {}) => ({ orderId, orderPaymentStatus: 'PAID', creationDate: NOW_ISO, pricingSummary: { total: { value: String(du + 6), currency: 'EUR' }, deliveryCost: { value: '6', currency: 'EUR' } }, paymentSummary: { totalDueSeller: { value: String(du), currency: 'EUR' } }, lineItems: lignes, ...extra });
const EBAY_TEST = [
  ebayCmd('E1', 80, [{ sku: 'VRM-12', legacyItemId: '111', title: 'Nike Air Max inventée' }], { totalMarketplaceFee: { value: '9.60', currency: 'EUR' } }),
  ebayCmd('E2', 60, [{ sku: '', legacyItemId: '112', title: 'Salomon XT-6 inventée' }], { totalMarketplaceFee: { value: '7', currency: 'EUR' } }),
  ebayCmd('E3', 45, [{ sku: 'VRM-41', legacyItemId: '113', title: 'Même titre inventé' }], { totalMarketplaceFee: { value: '5', currency: 'EUR' } }),
  ebayCmd('E4', 70, [{ sku: 'VRM-553', legacyItemId: '222', title: 'Nike Air Max inventée' }], { totalMarketplaceFee: { value: '8', currency: 'EUR' } }),
  ebayCmd('E5', 50, [{ sku: 'VRM-7', legacyItemId: '114', title: 'Adidas Samba inventée' }]),            // frais inconnus
  ebayCmd('E6', 90, [{ sku: 'VRM-12', legacyItemId: '115' }], { orderPaymentStatus: 'FULLY_REFUNDED' }), // pas une vente
];
const lbcVente = (txId, itemId, prix, titre) => ({ txId, itemId, isSeller: true, price: prix * 100, stepStatus: 'done', dateVente: NOW_ISO, title: titre });
const LBC_TEST = [
  lbcVente('L1', '501', 50, 'Adidas Samba inventée'),          // référence VRM-7 sur l'annonce
  lbcVente('L2', '502', 40, 'Salomon n°9 inventée'),           // « n°9 » dans le titre : PAS une identité
  lbcVente('L3', '503', 35, 'Paire A inventée'),               // lien posé à la main vers 40 : deux fiches
  lbcVente('L4', '504', 30, 'Nike Air Max inventée'),          // lien posé à la main vers 12
];
const LBC_ITEMS = {
  '501': { id: '501', subject: 'Adidas Samba inventée', customRef: 'VRM-7' },
  '502': { id: '502', subject: 'Salomon n°9 inventée' },
  '503': { id: '503', subject: 'Paire A inventée' },
  '504': { id: '504', subject: 'Nike Air Max inventée' },
};
const LBC_LIENS = { '503': '40', '504': '12' };
// Charge les fonctions voulues ; une ReferenceError ajoute la déclaration qui
// manque (si elle existe au premier niveau) — jamais une copie à la main.
const charger = () => {
  const noms = new Set(VOULUS);
  for (let essai = 0; essai < 60; essai++) {
    const ordre = [...decl.keys()].filter((k) => noms.has(k));
    const code = ordre.map((k) => decl.get(k)).join('\n') + `\n;({ ${VOULUS.join(', ')} })`;
    const ctx = vm.createContext({ console, Date, Math, Number, String, Object, Array, JSON, isFinite, isNaN, parseFloat, parseInt, RegExp, Set, Map, localStorage: FAUX_LS });
    try {
      const out = vm.runInContext(code, ctx);
      // Un appel « à blanc » pour faire lever ce qui manque à l'exécution.
      out.beneficePeriode({ jours: { '2026-01-02': [1, 100, 0, 1, 50, 100, 0] }, compta: {}, ligneUrssaf: { mois: [] }, taux: 13.5, periode: 'mois' });
      out.ventesAutresBenefice({ lbc: LBC_TEST, ebay: EBAY_TEST, numeros: FICHES, achat: (f) => Number(f.buyPrice), numLbc: (v) => out.numeroLbcIdentite(v, LBC_ITEMS, LBC_LIENS), numEbayLigne: (o, li) => out.numLigneEbay(o, li) });
      return out;
    } catch (e) {
      const m = /([A-Za-z_$][\w$]*) is not defined/.exec(String(e && e.message));
      if (m && decl.has(m[1]) && !noms.has(m[1])) { noms.add(m[1]); continue; }
      throw e;
    }
  }
  throw new Error('dépendances introuvables');
};
let F;
try { F = charger(); dit(true, 'la règle se charge dans un vm (dépendances lues dans App.jsx)'); }
catch (e) { dit(false, 'la règle se charge dans un vm', String(e.message || e).slice(0, 200)); console.log(`\n❌ audit-benefice : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }

// ── Données inventées ───────────────────────────────────────────────────────
const now = new Date();
const Y = now.getFullYear(), M = now.getMonth();
const jour = (k) => new Date(Y, M, Math.min(k, now.getDate()), 12);          // ce mois, jamais dans le futur
const finMoisPasse = new Date(Y, M, 0, 23, 59);                               // dernier jour du mois passé, 23 h 59
const debutMois = new Date(Y, M, 1, 0, 1);                                    // 1er du mois, 0 h 01
// [date, prix, achat (null = inconnu), frais]
const VENTES = [
  [jour(1), 61, 20, 2.5],
  [jour(2), 39.9, 15, 0],
  [debutMois, 48.5, '0', 1],       // « 0 » saisi : un achat CONNU
  [jour(3), 72.4, null, 3],        // inconnu : hors brut/net
  [jour(3), 55, '', 0],            // vide : inconnu
  [finMoisPasse, 44, 10, 0],       // le mois passé : hors période
];
const cents = (x) => Math.round(Number(x) * 100);
const connu = (a) => a != null && String(a).trim() !== '' && isFinite(Number(a));
const duMois = (d) => d.getFullYear() === Y && d.getMonth() === M;

essaie('façon Ventes = façon Comptabilité', () => {
  // Façon Ventes : un cumul sur les ventes de la période (ce que fait `totals`).
  const acc = F.beneficeVide();
  for (const [d, p, a, f] of VENTES) if (duMois(d)) F.ajouterVenteBenefice(acc, p, connu(a) ? Number(a) : null, f);
  const V = F.resumeBenefice(acc);
  // Façon Comptabilité : les jours publiés (tableaux), puis la période.
  const jours = {};
  const clef = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const b = {};
  for (const [d, p, a, f] of VENTES) F.ajouterVenteBenefice(b[clef(d)] || (b[clef(d)] = F.beneficeVide()), p, connu(a) ? Number(a) : null, f);
  for (const k of Object.keys(b)) jours[k] = F.jourBeneficeEnTableau(b[k]);
  const P = F.beneficePeriode({ jours, compta: {}, ligneUrssaf: { mois: [] }, taux: 13.5, periode: 'mois', maintenant: now.getTime() });
  dit(P.brut === V.brut && P.net === V.net && P.n === V.n && P.nCout === V.nCout, 'le brut et le net de Comptabilité = ceux de Ventes sur les mêmes ventes', `Compta brut ${P.brut} net ${P.net} (${P.nCout}/${P.n}) · Ventes brut ${V.brut} net ${V.net} (${V.nCout}/${V.n})`);
  // Attendus calculés ICI, indépendamment de la règle.
  const lm = VENTES.filter(([d]) => duMois(d));
  const lc = lm.filter(([, , a]) => connu(a));
  const brut = lc.reduce((t, [, p, a]) => t + cents(p) - cents(a), 0) / 100;
  const net = lc.reduce((t, [, p, a, f]) => t + cents(p) - cents(a) - cents(f), 0) / 100;
  dit(P.n === lm.length && P.nCout === lc.length, 'la couverture : ventes au prix d’achat connu sur ventes de la période (« 0 » est connu, « » ne l’est pas)', `${P.nCout}/${P.n} · attendu ${lc.length}/${lm.length}`);
  dit(Math.abs(P.brut - brut) < 0.005, 'BRUT = CA − prix d’achat, sur les seules ventes au prix connu', `${P.brut} · attendu ${brut}`);
  dit(Math.abs(P.net - net) < 0.005, 'NET des ventes = brut − boosts et frais des mêmes ventes', `${P.net} · attendu ${net}`);
  dit(!lm.some(([d]) => d === finMoisPasse), 'le dernier jour du mois passé (23 h 59) n’entre pas dans le mois — et le 1er à 0 h 01, si', `${P.n} ventes`);
  dit(P.raison === 'achats' && P.netFinal === null, 'un prix d’achat manque ⇒ le net final vaut « — » (null), raison « achats »', `net ${P.netFinal} · ${P.raison}`);
});

essaie('net final complet', () => {
  const jours = {};
  const k = `${Y}-${String(M + 1).padStart(2, '0')}-01`;
  const b = F.beneficeVide(); F.ajouterVenteBenefice(b, 100, 40, 5); F.ajouterVenteBenefice(b, 50.5, 20.25, 0);
  jours[k] = F.jourBeneficeEnTableau(b);
  const ym = `${Y}-${String(M + 1).padStart(2, '0')}`;
  const compta = { depenses: [{ date: `${ym}-01`, montant: 12.5 }], fixes: [], packs: [], abonnements: [] };
  const ligne = { mois: [{ ym, ca: 300, par: { Vinted: { n: 2, ca: 200 }, Leboncoin: { n: 1, ca: 100 } } }] };
  const P = F.beneficePeriode({ jours, compta, ligneUrssaf: ligne, taux: 13.5, periode: 'mois', maintenant: now.getTime() });
  const cotis = Math.round(cents(200) * 13.5 / 100) / 100;              // 27 €
  const attendu = (cents(100) - cents(40) - cents(5) + cents(50.5) - cents(20.25) - cents(12.5) - cents(cotis)) / 100;
  dit(P.cotis === cotis, 'les cotisations portent sur la part VINTED du CA déclaré publié (pas Leboncoin)', `${P.cotis} · attendu ${cotis}`);
  dit(P.charges === 12.5, 'les charges de la période viennent de la règle des charges de Comptabilité', `${P.charges}`);
  dit(P.netFinal != null && Math.abs(P.netFinal - attendu) < 0.005, 'NET final = brut − frais − charges − cotisations', `${P.netFinal} · attendu ${attendu}`);
  const Q = F.beneficePeriode({ jours, compta, ligneUrssaf: null, taux: 13.5, periode: 'mois', maintenant: now.getTime() });
  dit(Q.netFinal === null && Q.raison === 'cotisations' && Q.cotis === null, 'CA déclaré pas publié ⇒ cotisations et net « — », raison dite', `${Q.netFinal} · ${Q.raison}`);
  const V = F.beneficePeriode({ jours: {}, compta, ligneUrssaf: ligne, taux: 13.5, periode: 'mois', maintenant: now.getTime() });
  dit(V.n === 0 && V.brut === 0 && V.netFinal != null, 'aucune vente sur la période : brut 0 (lu, vide), le net reste calculable', `${V.brut} · ${V.netFinal}`);
});

essaie('Leboncoin et eBay par identité', () => {
  const L = F.ventesAutresBenefice({ lbc: LBC_TEST, ebay: EBAY_TEST, numeros: FICHES,
    achat: (f) => (f && f.buyPrice != null && String(f.buyPrice).trim() !== '' ? Number(f.buyPrice) : null),
    numLbc: (v) => F.numeroLbcIdentite(v, LBC_ITEMS, LBC_LIENS),
    numEbayLigne: (o, li) => F.numLigneEbay(o, li) });
  const par = Object.fromEntries(L.map((x) => [x.id, x]));
  dit(par['ebay:E1'] && par['ebay:E1'].achat === 30 && par['ebay:E1'].eur === 70.4 && par['ebay:E1'].frais === 0, 'eBay : SKU VRM-12 → la fiche 12 → prix d’achat 30 €, l’argent reçu (80 − 9,60 de frais, port non compté), frais déjà retirés', JSON.stringify(par['ebay:E1']));
  dit(par['ebay:E2'] && par['ebay:E2'].achat === null, 'eBay sans SKU, au titre identique à une fiche : AUCUN prix d’achat (jamais par le titre)', JSON.stringify(par['ebay:E2']));
  dit(par['ebay:E3'] && par['ebay:E3'].achat === null, 'eBay : un N° porté par DEUX fiches ⇒ aucun prix d’achat', JSON.stringify(par['ebay:E3']));
  dit(par['ebay:E4'] && par['ebay:E4'].achat === 30, 'eBay : VRM-553 traduit par la carte 013 de SON annonce → la fiche 12', JSON.stringify(par['ebay:E4']));
  dit(!par['ebay:E5'], 'eBay : frais absents de la commande ⇒ commande écartée (montantRecuEbay), jamais le total de l’acheteur', JSON.stringify(par['ebay:E5'] || null));
  dit(!par['ebay:E6'], 'une commande remboursée n’entre pas', JSON.stringify(par['ebay:E6'] || null));
  dit(par['lbc:L1'] && par['lbc:L1'].achat === 25 && par['lbc:L1'].frais === 0, 'Leboncoin : référence VRM-7 de l’annonce → la fiche 7 (prix final, frais 0)', JSON.stringify(par['lbc:L1']));
  dit(par['lbc:L2'] && par['lbc:L2'].achat === null, 'Leboncoin : le « n°9 » d’un TITRE n’est pas une identité ⇒ aucun prix d’achat', JSON.stringify(par['lbc:L2']));
  dit(par['lbc:L3'] && par['lbc:L3'].achat === null, 'Leboncoin : lien vers un N° porté par deux fiches ⇒ aucun prix d’achat', JSON.stringify(par['lbc:L3']));
  dit(par['lbc:L4'] && par['lbc:L4'].achat === 30, 'Leboncoin : le lien posé à la main → la fiche 12', JSON.stringify(par['lbc:L4']));
  // La MÊME règle : cumul, couverture par plateforme, net « pas su » si des frais manquent.
  const acc = F.beneficeVide();
  F.ajouterVenteBenefice(acc, 61, 20, 2.5);                                   // une vente Vinted
  for (const x of L) F.ajouterVenteBenefice(acc, x.eur, x.achat, x.frais, x.plateforme);
  const R = F.resumeBenefice(acc);
  dit(R.par.eBay.n === 4 && R.par.eBay.nCout === 2 && R.par.Leboncoin.n === 4 && R.par.Leboncoin.nCout === 2 && R.par.Vinted.n === 1 && R.par.Vinted.nCout === 1,
    'la couverture par plateforme : eBay 2/4 · Leboncoin 2/4 · Vinted 1/1', F.couvertureBenefice(R));
  const brutAtt = (cents(61) - cents(20) + cents(70.4) - cents(30) + cents(62) - cents(30) + cents(50) - cents(25) + cents(30) - cents(30)) / 100;
  dit(Math.abs(R.brut - brutAtt) < 0.005, 'BRUT = Σ (vente − achat) des seules ventes reliées', `${R.brut} · attendu ${brutAtt}`);
  dit(R.fraisInconnus === 0 && Math.abs(R.net - (brutAtt - 2.5)) < 0.005, 'eBay compte l’argent reçu : aucun frais eBay à soustraire une seconde fois (net = brut − frais Vinted)', `${R.net} · ${R.fraisInconnus}`);
  // Publiée par jour (tableau) puis relue par Comptabilité : mêmes nombres.
  const k = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const P = F.beneficePeriode({ jours: { [k]: F.jourBeneficeEnTableau(acc) }, compta: {}, ligneUrssaf: { mois: [] }, taux: 13.5, periode: 'mois', toutes: true });
  dit(P.brut === R.brut && P.nCout === R.nCout && P.n === R.n && P.net === R.net && F.couvertureBenefice(P) === F.couvertureBenefice(R), 'Comptabilité relit la même couverture et le même brut que Ventes', `${P.brut} ${F.couvertureBenefice(P)}`);
  const ancien = F.beneficeDesJours({ [k]: [1, 6100, 250, 1, 2000, 6100, 250] }, new Date(Date.now() - 86400000 * 40), new Date(Date.now() + 86400000));
  dit(ancien.n === 1 && ancien.net === 38.5 && ancien.par.Vinted.n === 1, 'une publication d’avant (7 nombres) se relit telle quelle', JSON.stringify(ancien.par));
  const ym = k.slice(0, 7);
  const ligne = { mois: [{ ym, ca: 300, par: { Vinted: { n: 2, ca: 200 }, Leboncoin: { n: 1, ca: 60 }, eBay: { n: 1, ca: 40 } } }] };
  const T = F.beneficePeriode({ jours: {}, compta: {}, ligneUrssaf: ligne, taux: 13.5, periode: 'mois', toutes: true });
  dit(T.caDecl === 300, 'publication à trois plateformes : les cotisations portent sur le CA déclaré des trois', `${T.caDecl}`);
});

essaie('le code', () => {
  const corps = (nom) => decl.get(nom) || '';
  const pc = corps('beneficePeriode') + corps('BeneficeCompta');
  dit(!/buyPrice|achatDe|effEntry|chargesVente/.test(pc), 'Comptabilité ne relit aucun prix d’achat (aucun second calcul)', (pc.match(/buyPrice|achatDe|effEntry|chargesVente/) || [''])[0]);
  const i = src.indexOf('const totals = useMemo(');
  const t = i >= 0 ? src.slice(i, src.indexOf('}, [sales.items, numeros, saleOv, buyByNum, hiddenSales, hiddenAccts, periode]);', i)) : '';
  dit(/ajouterVenteBenefice\(acc/.test(t) && /resumeBenefice\(acc\)/.test(t), 'l’écran Ventes (`totals`) passe par la même règle');
  dit(!/benefBrut\s*\+=|benefConnu\s*\+=|sell\s*-\s*buy\s*-\s*fee\s*;/.test(t), 'et ne garde aucun cumul brut/net à part');
  const pubI = src.indexOf("save('vrm_benefice_jours'");
  const pub = pubI >= 0 ? src.slice(Math.max(0, pubI - 1500), pubI) : '';
  dit(/ajouterVenteBenefice\(/.test(pub) && /achatDe\(e\)/.test(pub), 'la publication par jour utilise la même règle et la même lecture du prix d’achat');
  dit(/'vrm_benefice_jours'/.test(src.slice(src.indexOf('const SYNC_KEYS'), src.indexOf('const SYNC_KEYS') + 20000)), 'la publication est synchronisée (elle arrive sur un autre appareil)');
  dit(!/pas encore ton bénéfice net/.test(src), 'la phrase « ce n’est donc pas encore ton bénéfice net » a disparu');
  // (19 oct., suite) Leboncoin et eBay : la même règle, et aucune ressemblance.
  dit(/for \(const x of \(autresBenefice \|\| \[\]\)\)[^\n]*ajouterVenteBenefice\(acc, x\.eur, x\.achat, x\.frais, x\.plateforme\)/.test(t), 'l’écran Ventes ajoute Leboncoin et eBay par la même règle');
  const pubJ = pubI >= 0 ? src.slice(Math.max(0, pubI - 2500), pubI) : '';
  dit(/for \(const x of autresBenefice\)/.test(pubJ) && /ajouterVenteBenefice\(jours\[k\][^\n]*x\.plateforme\)/.test(pubJ), 'la publication par jour aussi');
  dit(/if \(!Array\.isArray\(autresBenefice\)\) return;/.test(pubJ), 'Leboncoin ou eBay pas lus ⇒ rien n’est publié (aucune publication partielle)');
  const va = corps('ventesAutresBenefice') + corps('numeroLbcIdentite') + corps('ficheUniqueDuNumero');
  dit(!/normTitle|motsDeTitre|numDeTitreLbc|\.title\b|\.subject\b|suggestionsPaires/.test(va), 'le rapprochement Leboncoin/eBay ne lit aucun titre', (va.match(/normTitle|motsDeTitre|numDeTitreLbc|\.title\b|\.subject\b|suggestionsPaires/) || [''])[0]);
  dit(!/ne couvre que Vinted|Leboncoin et eBay n'ont pas de prix d'achat reliés/.test(corps('BeneficeCompta')), 'la phrase « Leboncoin et eBay n’ont pas de prix d’achat reliés » a disparu de Comptabilité');
});

console.log(ko ? `\n❌ audit-benefice${MUT ? ' (mutation ' + MUT + ')' : ''} : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-benefice : ${ok} verts, 0 rouge`);
process.exit(ko ? 1 : 0);
