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
// `--prouve` réaffaiblit chaque correctif tour à tour : au moins un contrôle
// doit passer au ROUGE à chaque fois.
const fs = require('fs'), vm = require('vm'), path = require('path');
const APP0 = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');

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
  'indexDeclarations', 'moisDeclare', 'ventesDeclarables', 'ventesFaites', 'caEbayPayees', 'facturesDuNumero'];

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
  const paye = { orderId: 'o1', orderPaymentStatus: 'PAID', creationDate: '2026-10-05T10:00:00Z', pricingSummary: { total: { value: '80.00', currency: 'EUR' } }, lineItems: [{ sku: 'VRM-31', title: 'Nike' }] };
  const annulee = { ...paye, orderId: 'o2', pricingSummary: { total: { value: '120.00', currency: 'EUR' } }, cancelStatus: { cancelState: 'CANCELED' }, lineItems: [{ sku: 'VRM-32' }] };
  const refusee = { ...paye, orderId: 'o3', pricingSummary: { total: { value: '60.00', currency: 'EUR' } }, cancelStatus: { cancelState: 'CANCEL_REJECTED' }, lineItems: [{ sku: 'VRM-33' }] };
  const commandes = [paye, annulee, refusee];

  essaie('ventesDeclarables', () => {
    const r = c.ventesDeclarables({ vinted: [], lbc: [], ebay: commandes });
    const ids = [...r.lignes, ...r.aDater].map(l => l.id).sort();
    dit(!ids.includes('ebay:o2'), `A. CA déclaré : une commande eBay ANNULÉE (PAID + CANCELED) n'y entre pas — lignes ${JSON.stringify(ids)}`);
    dit(ids.includes('ebay:o1') && ids.includes('ebay:o3'), 'A. CA déclaré (autre sens) : une payée et une à annulation REFUSÉE y restent');
    const tot = r.lignes.reduce((s, l) => s + l.eur, 0);
    dit(Math.abs(tot - 140) < 1e-9, `A. CA déclaré eBay = 140,00 € (80 + 60) — obtenu ${tot}`);
  });
  essaie('ventesFaites', () => {
    const r = c.ventesFaites({ vinted: [], lbc: [], ebay: commandes });
    const eur = r.lignes.reduce((s, l) => s + l.eur, 0);
    dit(Math.abs(eur - 140) < 1e-9, `A. « Vendu » eBay = 140,00 € sans la commande annulée — obtenu ${eur}`);
  });
  essaie('caEbayPayees', () => {
    const v = c.caEbayPayees(commandes);
    dit(v === 140, `A. CA eBay payé (Collectif, écran eBay) = 140 — obtenu ${v}`);
    dit(c.caEbayPayees([annulee]) === 0, 'A. une seule commande payée, annulée : 0 (lu), jamais null ni 120');
    dit(c.caEbayPayees([]) === null, 'A. aucune commande payée : null (pas de vente), comme avant');
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
  'declare-sans-annulee': (s) => s.replace("    if (!commandeEbayEngagee(e)) continue;\n    const tot = (e.pricingSummary && e.pricingSummary.total) || {};\n    const id = 'ebay:'", "    const tot = (e.pricingSummary && e.pricingSummary.total) || {};\n    const id = 'ebay:'"),
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
