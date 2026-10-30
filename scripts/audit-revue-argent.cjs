// ⚠️⚠️ CONTRÔLE PERMANENT — REVUE « ARGENT » DU 19 OCTOBRE (app).
//
// Trois défauts reproduits en EXÉCUTANT les vraies règles d'App.jsx dans un
// `vm` (données inventées, la forme des commandes eBay rangées par la route :
// `annulerCommandeRangee` pose `cancelState: 'CANCELED'` et garde `PAID`) :
//
//  A. Une commande eBay ANNULÉE (PAID + CANCELED) comptait dans le CA déclaré
//     (`ventesDeclarables`), dans le « vendu » (`ventesFaites`) et dans le CA
//     eBay payé (`caEbayPayees`) — cotisations URSSAF et seuils DAC7 sur une
//     vente qui n'a rapporté aucun euro.
//  B. Une commande eBay dont eBay a REFUSÉ l'annulation (CANCEL_REJECTED : la
//     vente tient) n'« engageait » pas la paire : `numerosDejaVendus` ne la
//     voyait pas vendue (proposée à la publication ailleurs = double vente) et
//     `doublesVenteEbay` ne disait pas de la retirer de Vinted.
//  C. Une facture manuelle faite AVANT la remise à zéro (013) pour l'ancienne
//     paire « 12 » partait dans le colis de la NOUVELLE N°12 (`invForBord`) —
//     le nom et l'adresse d'un autre acheteur.
//
//  D. (20 oct., revue argent eBay) Le CA déclaré, le vendu, le CA payé et le
//     bénéfice eBay lisaient `pricingSummary.total` — ce que l'ACHETEUR paie,
//     port compris (§2.8 : le port n'est ni une recette ni une charge). La
//     décision du 3 octobre : « l'argent que tu reçois » =
//     `paymentSummary.totalDueSeller` − `totalMarketplaceFee`. Frais inconnus
//     ou autre devise ⇒ commande ÉCARTÉE et dite (`montantRecuEbay`).
//
// `--prouve` réaffaiblit chaque correctif tour à tour : au moins un contrôle
// doit passer au ROUGE à chaque fois.
const fs = require('fs'), vm = require('vm'), path = require('path');
const APP0 = require('./_source-app.cjs').sourceApp(path.join(__dirname, '..'));

function extraire(src, nom) {
  const re = new RegExp(`^( *)(?:async )?function ${nom}\\(|^( *)const ${nom} = `, 'm');
  const m = re.exec(src);
  if (!m) return '';
  let i = m.index, prof = 0, vuCorps = false;
  const estFn = /function/.test(m[0]);
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') {
      prof--;
      if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1);
    } else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}

const NOMS = ['cleNum', 'refVRMDe', 'NUM_OK', 'marqueurNumerotation', 'archiveNumeros', 'coupureNumerotation', 'estArchive', 'numeroExterne',
  'lbcAnnulee', 'lbcFinalisee', 'numDeTitreLbc', 'clesAnnonceLbc', 'numDeSkuEbay', 'skuEbayDe', 'PANNE_NUMEROS', 'ficheAVerifier', 'normTitle',
  'LIENS_EBAY', '_depuisEbay', '_fichesEbayMemo', 'fichesPourEbay', 'lienEbay', 'numEbayLu', 'numLigneEbay', 'commandeEbayEngagee',
  'numerosDejaVendus', 'doublesVenteEbay', 'classifyOrderStatus', 'tsCommande', 'montantCommande', 'venteFinalisee', 'ymDeTs',
  'indexDeclarations', 'moisDeclare', 'montantRecuEbay', 'ventesDeclarables', 'ventesFaites', 'caEbayPayees', 'facturesDuNumero',
  'ficheUniqueDuNumero', 'fraisEbayCommande', 'ventesAutresBenefice'];   // fraisEbayCommande : n'existe plus que dans le code d'avant (§6.1)

function charger(src) {
  const stock = {};
  const ctx = vm.createContext({ console, Date, Math, JSON, Map, Set, Number, String, Array, Object, RegExp, isFinite, isNaN, parseInt, parseFloat,
    load: (k, d) => (k in stock ? stock[k] : d), save: () => {}, __stock: stock });
  for (const n of NOMS) {
    const t = extraire(src, n);
    if (!t) continue;
    try { vm.runInContext(t.replace(/^ *const /, 'var ').replace(/^ *function /, 'function ') + `\n;this.${n} = ${n};`, ctx); } catch (e) { /* absent ou dépendance : le contrôle le dira */ }
  }
  // `invForBord` vit dans le composant : on l'exécute avec ses voisins remplacés.
  const inv = extraire(src, 'invForBord');
  if (inv) {
    try {
      vm.runInContext('var numForBord = (b) => (b && b.num) || ""; var soldByTxn = {};\n' + inv.replace(/^ *const /, 'var ') + '\n;this.invForBord = invForBord;', ctx);
    } catch (_) {}
  }
  return ctx;
}

let ko = 0, ok = 0;
const dit = (cond, txt) => { if (cond) { ok++; console.log('✅ ' + txt); } else { ko++; console.log('❌ ' + txt); } };
const essaie = (nom, f) => { try { f(); } catch (e) { dit(false, `${nom} a levé : ${e && e.message}`); } };

function controler(src) {
  ko = 0; ok = 0;
  const c = charger(src);
  // L'acheteur paie le total (port compris) ; le vendeur reçoit dû − frais.
  const eurM = (v) => ({ value: v, currency: 'EUR' });
  const cmd = (id, total, du, frais, plus) => ({ orderId: id, orderPaymentStatus: 'PAID', creationDate: '2026-10-05T10:00:00Z', pricingSummary: { total: eurM(total), deliveryCost: eurM('6.50') }, paymentSummary: { totalDueSeller: eurM(du) }, totalMarketplaceFee: eurM(frais), lineItems: [{ sku: 'VRM-31', title: 'Nike' }], ...plus });
  const paye = cmd('o1', '86.50', '80.00', '10.00', {});                                                          // reçu 70
  const annulee = cmd('o2', '126.50', '120.00', '15.00', { cancelStatus: { cancelState: 'CANCELED' }, lineItems: [{ sku: 'VRM-32' }] });
  const refusee = cmd('o3', '66.50', '60.00', '7.50', { cancelStatus: { cancelState: 'CANCEL_REJECTED' }, lineItems: [{ sku: 'VRM-33' }] }); // reçu 52,50
  const commandes = [paye, annulee, refusee];

  essaie('ventesDeclarables', () => {
    const r = c.ventesDeclarables({ vinted: [], lbc: [], ebay: commandes });
    const ids = [...r.lignes, ...r.aDater].map(l => l.id).sort();
    dit(!ids.includes('ebay:o2'), `A. CA déclaré : une commande eBay ANNULÉE (PAID + CANCELED) n'y entre pas — lignes ${JSON.stringify(ids)}`);
    dit(ids.includes('ebay:o1') && ids.includes('ebay:o3'), 'A. CA déclaré (autre sens) : une payée et une à annulation REFUSÉE y restent');
    const tot = r.lignes.reduce((s, l) => s + l.eur, 0);
    dit(Math.abs(tot - 122.5) < 1e-9, `A/D. CA déclaré eBay = 122,50 € (reçu : 70 + 52,50) — obtenu ${tot}`);
  });
  essaie('ventesFaites', () => {
    const r = c.ventesFaites({ vinted: [], lbc: [], ebay: commandes });
    const eur = r.lignes.reduce((s, l) => s + l.eur, 0);
    dit(Math.abs(eur - 122.5) < 1e-9, `A/D. « Vendu » eBay = 122,50 € (reçu) sans la commande annulée — obtenu ${eur}`);
  });
  essaie('caEbayPayees', () => {
    const v = c.caEbayPayees(commandes);
    dit(v === 122.5, `A/D. CA eBay payé (Collectif, écran eBay) = 122,50 (reçu) — obtenu ${v}`);
    dit(c.caEbayPayees([annulee]) === 0, 'A. une seule commande payée, annulée : 0 (lu), jamais null ni 120');
    dit(c.caEbayPayees([]) === null, 'A. aucune commande payée : null (pas de vente), comme avant');
  });
  // ── D. le port n'entre jamais ; frais inconnus ou autre devise ⇒ écartée et dite
  const sansFrais = cmd('o4', '56.50', '50.00', '0', { totalMarketplaceFee: undefined, lineItems: [{ sku: 'VRM-34' }] });
  const dollars = cmd('o5', '56.50', '50.00', '5.00', { paymentSummary: { totalDueSeller: { value: '50.00', currency: 'USD' } }, lineItems: [{ sku: 'VRM-35' }] });
  essaie('montantRecuEbay', () => {
    const r = c.montantRecuEbay(paye);
    dit(r && r.eur === 70, `D. argent reçu = dû au vendeur − frais eBay = 70 (pas 86,50 port compris) — obtenu ${r && r.eur}`);
    dit(c.montantRecuEbay(sansFrais).eur === null && /frais/.test(c.montantRecuEbay(sansFrais).raison), 'D. frais eBay inconnus ⇒ pas de montant, et la raison le dit');
    dit(c.montantRecuEbay(dollars).eur === null && /USD/.test(c.montantRecuEbay(dollars).raison), 'D. autre devise ⇒ pas de montant, jamais converti');
  });
  essaie('ventesDeclarables (D)', () => {
    const r = c.ventesDeclarables({ vinted: [], lbc: [], ebay: [paye, sansFrais, dollars] });
    const ids = [...r.lignes, ...r.aDater].map(l => l.id);
    const ec = (r.ecartees || []).map(e => e.id + ':' + e.raison);
    dit(!ids.includes('ebay:o4') && !ids.includes('ebay:o5'), `D. CA déclaré : frais inconnus et dollars n'y entrent pas — ${JSON.stringify(ids)}`);
    dit(ec.some(x => x.startsWith('ebay:o4:') && /frais/.test(x)) && ec.some(x => x.startsWith('ebay:o5:') && /USD/.test(x)), `D. … et ils sont DITS (écartées, avec la raison) — ${JSON.stringify(ec)}`);
  });
  essaie('ventesFaites (D)', () => {
    const r = c.ventesFaites({ vinted: [], lbc: [], ebay: [paye, sansFrais, dollars] });
    dit(r.lignes.length === 1 && r.lignes[0].eur === 70 && r.ecartees === 2, `D. vendu : 70 € et 2 commandes écartées dites — ${JSON.stringify({ l: r.lignes.map(l => l.eur), ec: r.ecartees })}`);
  });
  essaie('caEbayPayees (D)', () => {
    dit(c.caEbayPayees([paye, sansFrais]) === null, 'D. CA payé : une commande illisible ⇒ « pas su » (null), jamais un total partiel présenté comme complet');
  });
  essaie('ventesAutresBenefice', () => {
    const numeros = { a31: { numero: '31', buy: 40 } };
    const out = c.ventesAutresBenefice({ lbc: [], ebay: [paye, sansFrais], numeros, achat: (fi) => fi.buy, numLbc: () => '', numEbayLigne: () => '31' });
    const e = out.find(x => x.id === 'ebay:o1');
    dit(e && e.eur === 70 && e.frais === 0, `D. bénéfice : la vente eBay compte l'argent reçu (70), frais déjà retirés (0) — ${JSON.stringify(e)}`);
    dit(!out.some(x => x.id === 'ebay:o4'), 'D. bénéfice : frais inconnus ⇒ commande écartée (jamais le total acheteur)');
  });
  essaie('numerosDejaVendus', () => {
    const numeros = { a31: { numero: '31' }, a32: { numero: '32' }, a33: { numero: '33' } };
    const r = c.numerosDejaVendus({ numeros, vendusVinted: new Set(), enLigne: new Set(['a31', 'a32', 'a33']), commandes, ventesLbc: {}, itemsLbc: {}, liensLbc: {} });
    const v = r && r.vendus;
    dit(v && v.get('33') === 'eBay', `B. une commande à annulation REFUSÉE vend la paire (N°33 vendue sur eBay) — obtenu ${v && JSON.stringify([...v])}`);
    dit(v && !v.has('32'), 'B. (autre sens) une commande ANNULÉE ne vend rien (N°32)');
    dit(v && v.get('31') === 'eBay', 'B. une commande payée vend la paire (N°31)');
  });
  essaie('doublesVenteEbay', () => {
    const numeros = { a31: { numero: '31' }, a33: { numero: '33' } };
    const r = c.doublesVenteEbay({ annonces: [], commandes, numeros, enLigne: new Set(['a31', 'a33']), vendusVinted: new Set(), programmees: [] });
    const nums = (r.aRetirerVinted || []).map(x => x.numero).sort();
    dit(nums.includes('33'), `B. « vendue sur eBay → retire-la de Vinted » vaut aussi pour l'annulation refusée — N° ${JSON.stringify(nums)}`);
  });
  essaie('invForBord', () => {
    const stock = c.__stock;
    stock['vrm_numerotation'] = { version: 2, coupure: '2026-10-09T00:00:00Z', appliqueLe: '2026-10-11T14:58:07Z', archive: 'B' };
    stock['vinted_invoices'] = [{ id: 'inv_old', productId: '12', number: 'FA-1', buyerName: 'Ancien acheteur', createdAt: '2026-09-02T10:00:00Z' }];
    dit(typeof c.invForBord === 'function' && c.invForBord({ num: '12' }) == null, 'C. une facture faite AVANT la remise à zéro pour « 12 » ne part pas avec le bordereau de la nouvelle N°12');
    stock['vinted_invoices'] = [{ id: 'inv_new', productId: '12', number: 'FA-2', createdAt: '2026-10-15T10:00:00Z' }];
    const r = c.invForBord({ num: '12' });
    dit(r && r.id === 'inv_new', 'C. (autre sens) une facture faite APRÈS la remise à zéro se joint toujours');
    stock['vinted_invoices'] = [{ id: 'inv_sans', productId: '12', number: 'FA-3' }];
    dit(c.invForBord({ num: '12' }) == null, 'C. une facture sans date de création ne désigne rien après la remise à zéro');
    delete stock['vrm_numerotation'];
    stock['vinted_invoices'] = [{ id: 'inv_old', productId: '12', createdAt: '2026-09-02T10:00:00Z' }];
    const s = c.invForBord({ num: '12' });
    dit(s && s.id === 'inv_old', 'C. sans remise à zéro, rien ne change (la facture se joint comme avant)');
  });
  return ko;
}

const MUTATIONS = {
  'port-compris': (s) => s.replace("const d = lu(o && o.paymentSummary && o.paymentSummary.totalDueSeller);", "const d = lu(o && o.pricingSummary && o.pricingSummary.total);"),
  'frais-ignores': (s) => s.replace("if (!f) return { eur: null, raison: 'frais eBay inconnus' };", "if (!f) return { eur: Number(d.value), raison: '' };"),
  'faites-ecartees-tues': (s) => s.replace("if (eur == null) { if (garde('ebay:' + e.orderId)) ecartees += 1; continue; }", "if (eur == null) continue;"),
  'declare-sans-annulee': (s) => s.replace("    if (!commandeEbayEngagee(e)) continue;\n    const id = 'ebay:'", "    const id = 'ebay:'"),
  'faites-sans-annulee': (s) => s.replace("    if (!commandeEbayEngagee(e)) continue;   // annulée : rien de vendu", '    // muté'),
  'payees-sans-annulee': (s) => s.replace('const paid = payees.filter(commandeEbayEngagee);', 'const paid = payees;'),
  'rejet-annulation': (s) => s.replace("&& !/REJECT/i.test(String((o.cancelStatus && o.cancelStatus.cancelState) || ''))", ''),
  'facture-sans-date': (s) => s.replace('return isFinite(t) && t >= depuis;', 'return true;'),
};

if (process.argv.includes('--prouve')) {
  let tous = true;
  for (const [nom, f] of Object.entries(MUTATIONS)) {
    const mute = f(APP0);
    if (mute === APP0) { console.log(`❌ mutation ${nom} : ancre introuvable`); tous = false; continue; }
    const n = controler(mute);
    console.log(`${n > 0 ? '✅' : '❌'} mutation ${nom} : ${n} contrôle(s) au rouge`);
    if (!n) tous = false;
  }
  process.exit(tous ? 0 : 1);
}
const n = controler(APP0);
console.log(`\n${ok} contrôle(s) OK, ${n} en échec`);
process.exit(n ? 1 : 0);
