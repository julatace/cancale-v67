// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : L'ARGENT À VENIR — CE QUE LES SITES DOIVENT ENCORE, UNE SEULE RÈGLE
//         node scripts/audit-argent-a-venir.cjs [--mutation=tx450|versement|holds|vcverse|zero|site|libere|etape-double|bloquee-total|inconnu-zero|devise|estime|frise]
// ═══════════════════════════════════════════════════════════════════════════
// Julien (4 nov.) : « ce que Vinted, eBay, Vestiaire (et Leboncoin) me doivent
// encore », par site et par compte, la date prévue SEULEMENT si elle est lue.
// Mesuré le 4 nov. (lecture seule) : l'ancien « en attente » de Ma journée
// sommait les statuts « en cours » de la LISTE des ventes — 3 ventes d'un compte
// dont la transaction était finalisée (450, argent versé) y étaient comptées.
//
// Cet audit EXÉCUTE src/argentAVenir.js avec les VRAIES règles d'App.jsx
// (extraites dans un vm) et de api/_lib/vestiaire-regle.js, sur des ventes
// INVENTÉES (le dépôt est public) :
//   1. Vinted : liste « en cours » mais transaction 450 / date de versement /
//      retour / annulée ⇒ pas à venir ; vente en cours ⇒ à venir ; prix
//      illisible ⇒ nommée, jamais 0 € ; compte écarté ⇒ rien ;
//   2. Leboncoin : prouvée, ni annulée ni finalisée ⇒ à venir ;
//   3. eBay : seulement un paiement RETENU (pas libéré), au montant retenu, avec
//      la date d'eBay ; sans retenue ⇒ rien ;
//   4. Vestiaire : ni versée ni terminée, montant sûr, date « paiement estimé »
//      lue ; montant pas sûr ⇒ nommé ;
//   5. trois états : pas encore lu ⇒ en cours ; lecture ratée ⇒ nommée, « au
//      moins », jamais « au moins 0 » ; le périmètre (site, compte) filtre ;
//   6. le branchement (lu dans App.jsx et la carte des chiffres) : la coque
//      calcule, Ma journée, Ventes, le résumé Vinted, la carte et le widget
//      consomment — plus aucune somme des statuts de la liste.
//   7. (15 nov.) LES ÉTAPES : chaque vente dans UNE étape ; total = somme des
//      étapes = somme des sites ; bloquée / litige (440) À PART, hors total ;
//      montant inconnu ⇒ nommé (`illisible`), jamais 0 ; autre devise ⇒ écartée,
//      dite (`devise`), jamais convertie ; eBay sans frais lus ⇒ le dû au vendeur,
//      marqué « frais eBay à déduire » (`estime`) ; compte écarté ⇒ hors total ;
//      la frise (semaine · suivante · plus tard · sans date) = le total.
// `--mutation=…` réaffaiblit la règle dans une copie : rouge exigé.
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!c || process.env.BAVARD) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const APP = lire('src/App.jsx');
let MODULE = lire('src/argentAVenir.js');
let CARTE = lire('src/design/carteChiffres.js');
const muter = (avant, apres) => {
  if (!MODULE.includes(avant)) { console.log('❌ mutation impossible : motif absent — ' + avant.slice(0, 90)); process.exit(2); }
  MODULE = MODULE.replace(avant, apres);
};
if (MUT === 'tx450') muter('if (e && (e.s === 450 || e.s === 220 || e.s >= 500)) continue;', 'if (e && (e.s === 220 || e.s >= 500)) continue;');
else if (MUT === 'etape-double') muter("const L = lignes.filter((l) => (l.etape || 'autre') === k);", "const L = lignes.filter((l) => true);");
else if (MUT === 'bloquee-total') muter("if (e && e.s >= 430) { bloquees.push(", "if (e && e.s >= 430 && false) { bloquees.push(");
else if (MUT === 'inconnu-zero') muter("if (eur == null) { nonComptees.push({ id, plateforme: 'Vinted', compte, titre, sorte: 'illisible', raison: 'prix pas lu' }); continue; }", "if (eur == null) { lignes.push({ id, plateforme: 'Vinted', compte, titre, eur: 0, prevu: null, ts: null, etape: 'autre' }); continue; }");
else if (MUT === 'devise') muter("const deviseDe = (p) => (p && typeof p === 'object' && p.currency_code ? String(p.currency_code).toUpperCase() : 'EUR');", "const deviseDe = (p) => 'EUR';");
else if (MUT === 'estime') muter("if (d != null) { eur = d; estime = 'fraisEbay'; }", "if (d != null) { eur = d; }");
else if (MUT === 'frise') muter("if (l.prevu == null || !Number.isFinite(l.prevu)) B.sansDate.push(l);", "if (l.prevu == null || !Number.isFinite(l.prevu)) continue;");
else if (MUT === 'versement') muter('if (versements && versements[String(tx)]) continue;', '');
else if (MUT === 'holds') muter('if (!retenues.length) continue;', '');
else if (MUT === 'libere') muter("const LIBERE = /^(RELEASED|RELEASE_CONFIRMED|NOT_HELD)$/i;", "const LIBERE = /^$/;");
else if (MUT === 'vcverse') muter("if (et === 'versee' || et === 'terminee' || R.dateVersementVc(v)) continue;", "if (et === 'terminee') continue;");
else if (MUT === 'zero') muter("if (partiel && !(valeur > 0)) return { valeur: null, partiel: true, manque: tous, n: lignes.length, raison: 'partiel' };", '');
else if (MUT === 'site') muter("const dans = (x) => (!plateforme || x.plateforme === plateforme)", "const dans = (x) => (true)");
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }

const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
function extraire(src, nom) {
  const m = new RegExp(`^(?:export )?(?:async )?function ${nom}\\(|^(?:export )?const ${nom}\\s*=\\s*`, 'm').exec(src);
  if (!m) return '';
  const estFn = /function/.test(m[0]); let prof = 0, vuCorps = false;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}
const charger = async (texte, nom) => {
  const tmp = path.join(os.tmpdir(), `${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, texte);
  return { mod: await import('file://' + tmp), tmp };
};

(async () => {
  console.log('── Les règles d’App.jsx et le module');
  const noms = ['classifyOrderStatus', 'montantCommandeLu', 'lbcAnnulee', 'lbcFinalisee', 'commandeEbayEngagee', 'montantRecuEbay'];
  const ctx = {}; vm.createContext(ctx);
  for (const n of noms) {
    const t = extraire(APP, n);
    dit(!!t, `App.jsx porte \`${n}\``);
    if (t) vm.runInContext(t.replace(/^const /, 'var '), ctx);
  }
  const VC = (await charger(lire('api/_lib/vestiaire-regle.js').replace(/from '\.\.?\/[^']*'/g, (m) => `from 'file://${path.join(R, 'api/_lib', m.slice(6, -1).replace(/^\.\//, ''))}'`), 'vc')).mod;
  let M = null, tmpM = '';
  try { const r = await charger(MODULE, 'avenir'); M = r.mod && typeof r.mod.argentAVenir === 'function' ? r.mod : null; tmpM = r.tmp; } catch (e) { M = null; }
  dit(!!(M && typeof M.argentAVenir === 'function' && typeof M.aVenirPour === 'function'), 'src/argentAVenir.js exporte `argentAVenir` et `aVenirPour`');

  // L'ancienne somme de Ma journée, telle qu'elle était écrite (si elle existe
  // encore dans ce code) : les statuts « en cours » de la liste.
  const ancienne = /const inRoute = \(sales\.items\|\|\[\]\)\.filter\(o=>!isHidden\(o\) && classifyOrderStatus\(o\.status\)==='pending'\);\s*let inRouteSum=0;/.test(APP);

  const RG = {
    classer: (s) => ctx.classifyOrderStatus(s), montantVinted: (o) => ctx.montantCommandeLu(o), lbcAnnulee: (v) => ctx.lbcAnnulee(v), lbcFinalisee: (v) => ctx.lbcFinalisee(v),
    commandeEbayEngagee: (o) => ctx.commandeEbayEngagee(o), montantRecuEbay: (o) => ctx.montantRecuEbay(o), etapeVc: VC.etapeMotVc, vcAnnulee: VC.vcVenteAnnulee,
    montantRecuVc: VC.montantRecuVc, dateVersementVc: VC.dateVersementVc,
  };
  // ── Les ventes inventées ──
  const accA = { vinted_user_id: '111', login: 'vendeuse_a' }, accB = { vinted_user_id: '222', login: 'vendeur_b' }, accX = { vinted_user_id: '999', login: 'ecarte_x' };
  const vv = (tx, status, eur, acc, extra = {}) => ({ transaction_id: tx, status, price: eur == null ? null : { amount: String(eur), currency_code: 'EUR' }, date: '2026-10-28T10:00:00Z', _acc: acc, ...extra });
  const vinted = [
    vv(1, "Commande expédiée et en cours d'acheminement ! ", 70, accA),          // à venir
    vv(2, 'Commande livrée ! ', 45.5, accA),                                      // à venir
    vv(3, 'La livraison n’a pas encore eu lieu - colis déposé en bureau de Poste ou point relais', 82, accA), // liste en retard : transaction 450
    vv(4, 'Bordereau envoyé au vendeur', 63, accB),                                // versement daté ⇒ versée
    vv(5, 'Bordereau envoyé au vendeur', 99, accB),                                // transaction 440 : retour
    vv(6, 'Commande finalisée', 30, accB),                                         // finalisée
    vv(7, 'Commande annulée', 40, accB),                                           // annulée
    vv(8, 'Bordereau envoyé au vendeur', 120, accX),                               // compte écarté
    vv(9, 'Le paiement a été validé', null, accB),                                 // prix illisible
    vv(10, 'Le paiement a été validé', 25, accB),                                  // à venir
  ];
  const etats = { 3: { s: 450 }, 5: { s: 440 }, 1: { s: 230 } };
  const versements = { 4: '2026-11-01T10:00:00+01:00' };
  const lbc = [
    { txId: 'L1', isSeller: true, price: 2500, stepStatus: 'in_progress', account: 'lbc-account:1', accountName: 'Toto' },   // à venir
    { txId: 'L2', isSeller: true, price: 3000, stepStatus: 'done' },                     // finalisée
    { txId: 'L3', isSeller: false, price: 1000, stepStatus: 'in_progress' },             // pas prouvée
    { txId: 'L4', isSeller: true, price: 1500, stepStatus: 'cancelled' },                // annulée
  ];
  const eur = (v) => ({ value: String(v), currency: 'EUR' });
  const cmd = (id, holds, extra = {}) => ({ orderId: id, orderPaymentStatus: 'PAID', creationDate: '2026-10-30T10:00:00Z', paymentSummary: { totalDueSeller: eur(110), payments: [{ paymentStatus: 'PAID', paymentHolds: holds }] }, totalMarketplaceFee: eur(14.3), _pseudo: 'ebay_moi', ...extra });
  const ebay = [
    cmd('E1', []),                                                                           // pas de retenue ⇒ parti
    cmd('E2', [{ holdState: 'HELD', holdAmount: eur(95.7), expectedReleaseDate: '2026-11-12T08:00:00.000Z' }]), // retenu, daté
    cmd('E3', [{ holdState: 'RELEASED', holdAmount: eur(50), releaseDate: '2026-11-01T08:00:00.000Z' }]),     // libéré
    cmd('E4', [{ holdState: 'HELD', holdAmount: eur(40) }], { cancelStatus: { cancelState: 'CANCELED' } }),    // annulée
    cmd('E5', [{ holdState: 'HELD_PENDING', holdAmount: eur(20) }]),                         // retenu, sans date
  ];
  const vestiaire = [
    { id: 'V1', etat: 'ACTION_NEEDED', montant: { cle: 'sellerEarning', devise: 'EUR', valeur: 203.23 }, etapesVc: { sellerPayment: 'upcoming' }, paiementEstime: '24 novembre 2026', aExpedier: true },
    { id: 'V2', etat: 'PAYOUT_DONE', montant: { cle: 'sellerEarning', devise: 'EUR', valeur: 80 } },             // versée
    { id: 'V3', etat: 'IN_TRANSIT', montant: { cle: 'sellerEarning', devise: 'EUR', valeur: 60 }, etapesVc: { sellerPayment: 'done' } }, // paiement fait
    { id: 'V4', etat: 'CANCELLED', montant: { cle: 'sellerEarning', devise: 'EUR', valeur: 70 } },               // annulée
    { id: 'V5', etat: 'IN_TRANSIT', montant: { cle: 'productPrice', devise: 'EUR', valeur: 90 } },               // montant pas sûr
  ];
  const cachee = (o) => String(o && o._acc && o._acc.vinted_user_id) === '999';
  const base = { vinted, lbc, ebay, vestiaire, versements, etatTx: (tx) => etats[String(tx)] || null, cachee, excluAutre: () => false, R: RG };

  if (ancienne) {
    // Le code d'avant : ce que Ma journée affichait sur ces ventes (statuts « en cours » de la liste).
    const vieux = vinted.filter((o) => !cachee(o) && ctx.classifyOrderStatus(o.status) === 'pending').reduce((t, o) => t + (o.price && o.price.amount != null ? Number(o.price.amount) : 0), 0);
    dit(false, `l’« en attente » de Ma journée compte ${vieux} € : la vente finalisée (450), la vente versée et le retour y sont`, 'attendu 140,50 € pour Vinted');
  }
  if (M) {
    console.log('── 1-4. Chaque site, par sa règle');
    const A = M.argentAVenir(base);
    const ids = A.lignes.map((l) => l.id).sort();
    const attendus = ['ebay:E2', 'ebay:E5', 'lbc:L1', 'vestiaire:V1', 'vinted:1', 'vinted:10', 'vinted:2'];
    dit(JSON.stringify(ids) === JSON.stringify(attendus), 'les ventes à venir sont exactement celles attendues', ids.join(' '));
    dit(!ids.includes('vinted:3') && !((A.bloquees && A.bloquees.lignes) || []).some((l) => l.id === 'vinted:3'), 'Vinted : la liste dit « colis déposé » mais la transaction est finalisée (450) ⇒ pas à venir, ni « bloquée »');
    dit(!ids.includes('vinted:4'), 'Vinted : une date de versement lue ⇒ pas à venir');
    dit(!ids.includes('vinted:5'), 'Vinted : transaction en retour (440) ⇒ pas à venir');
    dit(!ids.includes('vinted:8'), 'Vinted : un compte écarté n’entre pas');
    dit(A.nonComptees.some((x) => x.id === 'vinted:9') && !ids.includes('vinted:9'), 'Vinted : prix illisible ⇒ nommé, jamais 0 €');
    dit(!ids.includes('ebay:E1') && !ids.includes('ebay:E3'), 'eBay : sans retenue, ou retenue libérée ⇒ pas à venir');
    dit(!ids.includes('ebay:E4'), 'eBay : commande annulée ⇒ pas à venir');
    const e2 = A.lignes.find((l) => l.id === 'ebay:E2');
    dit(e2 && e2.eur === 95.7, 'eBay : le montant RETENU (95,70 €), pas le prix', e2 && String(e2.eur));
    dit(e2 && new Date(e2.prevu).toISOString().slice(0, 10) === '2026-11-12', 'eBay : la date de libération écrite par eBay');
    const e5 = A.lignes.find((l) => l.id === 'ebay:E5');
    dit(e5 && e5.prevu == null, 'eBay : sans date écrite ⇒ aucune date (jamais estimée)');
    const v1 = A.lignes.find((l) => l.id === 'vestiaire:V1');
    dit(v1 && v1.eur === 203.23 && v1.prevu != null && new Date(v1.prevu).getDate() === 24 && new Date(v1.prevu).getMonth() === 10, 'Vestiaire : le versé (203,23 €) et « paiement estimé » lu (24 nov.)');
    dit(!ids.includes('vestiaire:V2') && !ids.includes('vestiaire:V3') && !ids.includes('vestiaire:V4'), 'Vestiaire : versée, paiement fait, annulée ⇒ pas à venir');
    dit(A.nonComptees.some((x) => x.id === 'vestiaire:V5'), 'Vestiaire : montant pas sûr ⇒ nommé');
    dit(!ids.includes('lbc:L2') && !ids.includes('lbc:L3') && !ids.includes('lbc:L4'), 'Leboncoin : finalisée, pas prouvée, annulée ⇒ pas à venir');
    const total = 70 + 45.5 + 25 + 25 + 95.7 + 20 + 203.23;
    dit(Math.abs(A.total - total) < 0.005, 'le total = la somme à la main', `${A.total} / ${total}`);
    const gA = A.parCompte.find((g) => g.plateforme === 'Vinted' && g.compte === 'vendeuse_a');
    dit(gA && gA.n === 2 && gA.eur === 115.5, 'par compte : vendeuse_a = 2 ventes, 115,50 €');
    const gE = A.parCompte.find((g) => g.plateforme === 'eBay');
    dit(gE && gE.prevu == null, 'par compte : une vente sans date ⇒ le groupe n’a pas de date');
    dit(A.partiel === true, 'des ventes nommées (montant illisible) ⇒ partiel');

    // Ce que disait l'ANCIENNE somme (statuts « en cours » de la liste), sur les mêmes ventes Vinted.
    const vieux = vinted.filter((o) => !cachee(o) && ctx.classifyOrderStatus(o.status) === 'pending').reduce((t, o) => t + (o.price && o.price.amount != null ? Number(o.price.amount) : 0), 0);
    const neuf = A.lignes.filter((l) => l.plateforme === 'Vinted').reduce((t, l) => t + l.eur, 0);
    dit(vieux - neuf >= 82 + 63 + 99, `l’ancienne somme (liste « en cours ») comptait ${vieux} € contre ${neuf} € : 450, versement et retour inclus`);

    console.log('── 5. Trois états et le périmètre');
    const P = M.argentAVenir({ ...base, ebay: null });
    dit(P.manque.includes('eBay') && P.partiel, 'eBay illisible ⇒ nommé, partiel');
    const pE = M.aVenirPour(P, { plateforme: 'eBay' });
    dit(pE.valeur == null && pE.partiel, 'sur eBay seul illisible : « — », jamais « au moins 0 »');
    const pV = M.aVenirPour(P, { plateforme: 'Vinted' });
    dit(pV.valeur === 140.5 && pV.partiel === true && pV.manque.join() === 'Vinted', 'sur Vinted : 140,50 € au moins (le prix illisible nommé), eBay pas nommé', JSON.stringify(pV));
    const pa = M.aVenirPour(M.argentAVenir(base), { plateforme: 'Vinted', login: 'vendeuse_a' });
    dit(pa.valeur === 115.5 && !pa.partiel, 'un compte : vendeuse_a seule, 115,50 €', JSON.stringify(pa));
    const pL = M.aVenirPour(M.argentAVenir(base), { plateforme: 'Leboncoin' });
    dit(pL.valeur === 25 && !pL.partiel, 'Leboncoin seul : 25 €');
    const enc = M.argentAVenir({ ...base, vinted: undefined });
    dit(enc.enCours === true && M.aVenirPour(enc).valeur == null, 'ventes pas encore lues ⇒ en cours, aucun chiffre');
    const vs = M.argentAVenir({ ...base, versements: null });
    dit(vs.manque.includes('Vinted') && !vs.lignes.some((l) => l.plateforme === 'Vinted'), 'dates de versement pas lues ⇒ Vinted nommé, aucune vente Vinted comptée (un versé ne doit pas passer pour à venir)');
    const ko2 = M.argentAVenir({ ...base, manqueVinted: ['vendeur_b'] });
    dit(ko2.manque.includes('vendeur_b') && M.aVenirPour(ko2, { plateforme: 'Vinted', login: 'vendeuse_a' }).partiel === false, 'un compte Vinted pas lu ⇒ nommé ; il ne rend pas partiel un AUTRE compte');
    dit(M.dateEcriteLue('3 juil. 2026') != null && M.dateEcriteLue('jui 2026') == null && M.dateEcriteLue('32 novembre 2026') == null && M.dateEcriteLue('bientôt') == null, 'date écrite : « 3 juil. 2026 » lue ; ambiguë ou impossible ⇒ rien');


    console.log('── 7. Les étapes (15 nov.)');
    // Le parcours Vestiaire (src/parcoursVestiaire.js), la vraie règle.
    const PV = (await charger(lire('src/parcoursVestiaire.js').replace("from '../api/_lib/vestiaire-regle.js'", `from 'file://${path.join(R, 'api/_lib/vestiaire-regle.js')}'`), 'parcours')).mod;
    // L'étape Vinted : la traduction de l'étiquette (`etapeVintedAVenir` dans App.jsx) est jugée au banc
    // (scripts/bancs/argent-a-venir.cjs) ; ici une table sur le statut, pour juger la RÈGLE du module.
    const etV = (o) => /Bordereau|paiement a été validé/i.test(o.status) ? 'envoyer' : /livrée/i.test(o.status) ? 'livree' : /expédiée|déposé/i.test(o.status) ? 'route' : 'autre';
    const R7 = { ...RG, etapeVinted: etV, parcoursVc: (v) => PV.parcoursVenteVc(v) };
    const vinted7 = [
      vv(21, 'Bordereau envoyé au vendeur', 64, accA), vv(22, "Commande expédiée et en cours d'acheminement ! ", 72, accA),
      vv(23, 'Commande livrée ! ', 95, accB), vv(24, 'Le paiement a été validé', 85, accB),
      vv(25, "Commande expédiée et en cours d'acheminement ! ", 110, accA),        // transaction 440 : retour ⇒ à part
      vv(26, "Commande expédiée et en cours d'acheminement ! ", 99, accA),         // transaction 430 : suspendue ⇒ à part
      vv(27, 'Commande livrée ! ', null, accA),                                    // prix illisible
      { ...vv(28, 'Commande livrée ! ', 40, accA), price: { amount: '40', currency_code: 'GBP' } },   // autre devise
      vv(29, 'Commande livrée ! ', 77, accX),                                      // compte écarté
    ];
    const etats7 = { 25: { s: 440 }, 26: { s: 430 } };
    const cmd7 = (id, extra) => ({ orderId: id, orderPaymentStatus: 'PAID', creationDate: '2026-11-10T10:00:00Z', _pseudo: 'ebay_moi', lineItems: [{ title: 'Paire eBay ' + id }], ...extra });
    const ebay7 = [
      cmd7('E21', { orderFulfillmentStatus: 'FULFILLED', paymentSummary: { totalDueSeller: eur(110), payments: [{ paymentHolds: [{ holdState: 'HELD', holdAmount: eur(95.7), expectedReleaseDate: '2026-11-18T08:00:00.000Z' }] }] }, totalMarketplaceFee: eur(14.3) }),
      cmd7('E22', { orderFulfillmentStatus: 'NOT_STARTED', paymentSummary: { totalDueSeller: eur(80), payments: [{ paymentHolds: [{ holdState: 'HELD' }] }] }, totalMarketplaceFee: eur(10) }),       // retenue sans montant ⇒ dû − frais
      cmd7('E23', { orderFulfillmentStatus: 'FULFILLED', paymentSummary: { totalDueSeller: eur(60), payments: [{ paymentHolds: [{ holdState: 'HELD' }] }] } }),                                        // frais pas lus ⇒ dû, « à déduire »
      cmd7('E24', { orderFulfillmentStatus: 'FULFILLED', paymentSummary: { totalDueSeller: { value: '50', currency: 'GBP' }, payments: [{ paymentHolds: [{ holdState: 'HELD', holdAmount: { value: '45', currency: 'GBP' } }] }] } }),   // GBP
    ];
    const vest7 = [
      { id: 'V21', etat: 'IN_PROGRESS', montant: { cle: 'sellerEarning', devise: 'EUR', valeur: 203.23 }, etapesVc: { sellerSale: 'done', sellerShipment: 'done', sellerDelivery: 'ongoing', sellerPayment: 'upcoming' }, paiementEstime: '19 novembre 2026', compte: 'vc_moi' },
      { id: 'V22', etat: 'ACTION_NEEDED', aExpedier: true, montant: { cle: 'sellerEarning', devise: 'EUR', valeur: 150 }, etapesVc: { sellerSale: 'done', sellerShipment: 'pending' }, paiementEstime: '2 décembre 2026', compte: 'vc_moi' },
      { id: 'V23', etat: 'IN_PROGRESS', montant: { cle: 'sellerEarning', devise: 'EUR', valeur: 88 }, etapesVc: { sellerDelivery: 'done', sellerPayment: 'ongoing' }, compte: 'vc_moi' },
      { id: 'V24', etat: 'IN_PROGRESS', montant: { cle: 'sellerEarning', devise: 'EUR', valeur: 70 }, etapesVc: { sellerConformity: 'refused' }, statutVc: 'item rejected', compte: 'vc_moi' },   // refusée ⇒ à part
      { id: 'V25', etat: 'IN_PROGRESS', montant: { cle: 'sellerEarning', devise: 'USD', valeur: 90 }, compte: 'vc_moi' },                                                                         // USD
      { id: 'V26', etat: 'IN_PROGRESS', montant: { cle: 'sellerEarning', devise: 'EUR', valeur: 33 }, compte: 'autre_vc' },                                                                       // compte écarté
    ];
    const lbc7 = [{ txId: 'L21', isSeller: true, price: 4500, stepStatus: 'validation', parcelStatus: 'in_transit', accountName: 'Toto' }];
    const exclu7 = (site, v) => site === 'vestiaire' && v.compte === 'autre_vc';
    const A7 = M.argentAVenir({ vinted: vinted7, lbc: lbc7, ebay: ebay7, vestiaire: vest7, versements: {}, etatTx: (tx) => etats7[String(tx)] || null, cachee, excluAutre: exclu7, R: R7 });
    const parE = Object.fromEntries((A7.parEtape || []).map((g) => [g.etape, g]));
    const C = (x) => Math.round(x * 100);
    const sommeE = (A7.parEtape || []).reduce((t, g) => t + C(g.eur), 0), sommeS = (A7.parSite || []).reduce((t, g) => t + C(g.eur), 0);
    dit(A7.lignes.every((l) => (M.ETAPES_A_VENIR || []).includes(l.etape)) && (A7.parEtape || []).reduce((t, g) => t + g.n, 0) === A7.n, 'chaque vente est dans UNE étape (le nombre des étapes = le nombre de ventes)', JSON.stringify((A7.parEtape || []).map((g) => g.etape + ':' + g.n)));
    dit(sommeE === C(A7.total) && sommeS === C(A7.total), `le total (${A7.total} €) = la somme des étapes = la somme des sites, au centime`, `${sommeE / 100} / ${sommeS / 100}`);
    // À la main : envoyer 64 + 85 + 150 + 70 (E22 : 80 − 10) = 369 ; route 72 + 203,23 + 45 (Leboncoin) = 320,23 ;
    // livree 95 ; versement 95,70 (E21) + 60 (E23, avant frais) + 88 (V23) = 243,70 ⇒ 1 027,93 €.
    dit(parE.envoyer && C(parE.envoyer.eur) === 36900 && parE.envoyer.n === 4, 'à envoyer : 64 + 85 + 150 + 70 (eBay pas expédiée, dû − frais) = 369 €', JSON.stringify(parE.envoyer));
    dit(parE.route && C(parE.route.eur) === 32023 && parE.route.n === 3, 'en route : 72 + 203,23 (Vestiaire envoyée) + 45 (Leboncoin en transit) = 320,23 €', JSON.stringify(parE.route));
    dit(parE.livree && C(parE.livree.eur) === 9500 && parE.livree.n === 1, 'livrée : 95 € (le prix illisible, la devise et le compte écarté n’y sont pas)', JSON.stringify(parE.livree));
    dit(parE.versement && C(parE.versement.eur) === 24370 && parE.versement.n === 3, 'versement en cours : 95,70 (retenue eBay) + 60 (avant frais) + 88 (Vestiaire paie) = 243,70 €', JSON.stringify(parE.versement));
    dit(C(A7.total) === 102793 && A7.n === 11, 'le total à la main : 1 027,93 € pour 11 ventes', `${A7.total} / ${A7.n}`);
    const bl = A7.bloquees || { n: 0, lignes: [] };
    dit(bl.n === 3 && C(bl.eur) === 27900 && ['vinted:25', 'vinted:26', 'vestiaire:V24'].every((id) => bl.lignes.some((l) => l.id === id)) && !A7.lignes.some((l) => ['vinted:25', 'vinted:26', 'vestiaire:V24'].includes(l.id)), 'bloquées : retour (440), suspendue (430), refusée au contrôle — 279 € À PART, hors total', JSON.stringify(bl.lignes.map((l) => l.id + ':' + l.eur)));
    const nc7 = Object.fromEntries((A7.nonComptees || []).map((x) => [x.id, x]));
    dit(nc7['vinted:27'] && nc7['vinted:27'].sorte === 'illisible' && !A7.lignes.some((l) => l.id === 'vinted:27'), 'montant inconnu ⇒ nommé (« illisible »), jamais 0 € dans une étape', JSON.stringify(nc7['vinted:27']));
    dit(nc7['vinted:28'] && nc7['vinted:28'].sorte === 'devise' && nc7['vinted:28'].devise === 'GBP', 'Vinted en GBP ⇒ écartée et dite (« devise GBP »), jamais convertie', JSON.stringify(nc7['vinted:28']));
    dit(nc7['ebay:E24'] && nc7['ebay:E24'].sorte === 'devise' && nc7['vestiaire:V25'] && nc7['vestiaire:V25'].sorte === 'devise', 'eBay en GBP, Vestiaire en USD ⇒ écartées et dites', JSON.stringify([nc7['ebay:E24'], nc7['vestiaire:V25']]));
    const e23 = A7.lignes.find((l) => l.id === 'ebay:E23'), e22 = A7.lignes.find((l) => l.id === 'ebay:E22');
    dit(e23 && e23.eur === 60 && e23.estime === 'fraisEbay' && A7.estimes && A7.estimes.n === 1 && C(A7.estimes.eur) === 6000, 'eBay sans frais lus ⇒ le dû au vendeur (60 €), « frais eBay à déduire » dit — un montant connu, jamais « inconnu »', JSON.stringify({ e23, est: A7.estimes }));
    dit(e22 && e22.eur === 70 && !e22.estime, 'eBay, retenue sans montant ⇒ l’argent reçu (`montantRecuEbay` : 80 − 10 = 70 €)', JSON.stringify(e22));
    dit(!A7.lignes.some((l) => l.id === 'vinted:29' || l.id === 'vestiaire:V26') && !bl.lignes.some((l) => l.id === 'vinted:29'), 'un compte écarté (Vinted, Vestiaire) n’entre dans aucune étape ni dans le total');
    const v21 = A7.lignes.find((l) => l.id === 'vestiaire:V21');
    dit(v21 && v21.prevu != null && new Date(v21.prevu).getDate() === 19 && !A7.lignes.filter((l) => l.plateforme === 'Vinted').some((l) => l.prevu != null), 'la date : Vestiaire « 19 novembre 2026 » lue ; Vinted n’en a aucune (jamais estimée)');
    const F = typeof M.friseAVenir === 'function' ? M.friseAVenir(A7, new Date(2026, 10, 15, 10, 0, 0).getTime()) : null;   // dimanche 15 nov.
    const sF = F ? C(F.semaine.eur) + C(F.suivante.eur) + C(F.plusTard.eur) + C(F.sansDate.eur) : -1;
    dit(!!F && sF === C(A7.total) && F.semaine.n + F.suivante.n + F.plusTard.n + F.sansDate.n === A7.n, 'la frise : cette semaine + la suivante + plus tard + sans date = le total, chaque vente une fois', JSON.stringify(F));
    dit(F && F.semaine.n === 0 && F.suivante.n === 2 && F.plusTard.n === 1 && F.datees === 3, 'la frise (dimanche 15 nov.) : 18 et 19 nov. ⇒ la semaine suivante ; 2 déc. ⇒ plus tard', JSON.stringify(F));
    console.log('── La carte des chiffres lit la même règle');
    const carteTxt = CARTE.replace("from '../argentAVenir.js'", `from 'file://${tmpM}'`)
      // (11 nov.) la carte importe aussi src/formatsDate.js (un format créé une fois) : le vrai fichier
      .replace("from '../formatsDate.js'", `from 'file://${path.join(R, 'src', 'formatsDate.js')}'`)
      .replace("from '../profilVendeur.js'", `from 'file://${path.join(R, 'src', 'profilVendeur.js')}'`);   // (11 nov., 5.355) vocabulaire
    let K = null; try { K = (await charger(carteTxt, 'carte')).mod; } catch (e) { K = null; }
    dit(!!K, 'src/design/carteChiffres.js se charge');
    if (K) {
      const live = { aVenir: M.argentAVenir(base) };
      const v = (sel) => K.valeurChiffre('attente', { id: 'attente' }, { live }, sel, {}, Date.parse('2026-11-04T10:00:00Z'));
      const tous = v({ site: 'toutes', compte: null, periode: null });
      dit(tous.valeur != null && Math.abs(tous.valeur - total) < 0.005 && tous.partiel, 'carte « tous les sites » = le total de la règle, « au moins »', JSON.stringify(tous.valeur));
      const ve = v({ site: 'vestiaire', compte: null, periode: null });
      dit(ve.valeur === 203.23, 'carte « Vestiaire » = la part Vestiaire', JSON.stringify(ve.valeur));
      const vc = v({ site: 'vinted', compte: { uid: '111', login: 'vendeuse_a' }, periode: null });
      dit(vc.valeur === 115.5, 'carte « Vinted · vendeuse_a » = son compte', JSON.stringify(vc.valeur));
      dit(!K.horsSelection('attente', { site: 'ebay' }), 'le chiffre est proposé sur eBay (il ne l’était que sur Vinted)');
    }
  }

  console.log('── 6. Le branchement');
  const A0 = sansCommentaires(APP);
  dit(!ancienne, 'Ma journée ne somme plus les statuts « en cours » de la liste (`inRouteSum`)');
  dit(/aVenir: aVenirCoque\(\{/.test(A0), 'la coque calcule `liveStats.aVenir` (une fois)');
  dit(/const aVenirCoque = \(x\) => argentAVenir\(/.test(A0) && /etatTx: TXN_ETATS_LU === false \? null : etatTxn/.test(A0), 'avec les règles d’App.jsx et l’état des transactions');
  dit(/fetchVersementsVinted\(\)\.then\(\(m\) => \{ if \(!mort\) setVersementsCoque\(m\)/.test(A0), 'la coque lit les dates de versement (450)');
  dit(/const aVenirJ = aVenirPour\(liveStats && liveStats\.aVenir\);/.test(A0), 'Ma journée (carte et tendance) lit la règle');
  // (5 nov., chantier E2) Sur Ventes · Vinted la carte passe SOUS la carte du mois, dans l'écran
  // (Comptabilite, `dansPlateforme`, le `liveStats` de la coque) : le même ordre que « Tous ».
  // Ce contrôle juge qu'elle est montée sur les deux écrans, avec la règle de la coque — plus sa ligne.
  // (8 nov.) `reserve` (6 nov., banc chargement : la carte garde sa place pendant la lecture) est
  // une présentation, pas une règle : il est admis ; le `A=` de la coque reste exigé. (16 nov., stabilite-iphone)
  // Ventes · Vinted le porte aussi (la carte arrivait en poussant la liste de ~124 px). (16 nov., ventes-clair)
  // `sansEtapes` aussi : une présentation (la ligne des étapes, déjà dite par le segment au-dessus), pas une règle.
  dit(/dansPlateforme && !baseKO && (?:<CacheSiV2 si=\{designV2\}>)?<div className="vrm-a-venir-hote"[^\n]*<ArgentAVenirCarte A=\{liveStats && liveStats\.aVenir\} plateforme="Vinted"(?: reserve)?(?: sansEtapes)?\/>/.test(A0) && /site==='toutes' && t==='ventes' && !baseKO && (?:<CacheSiV2 si=\{designV2App\}>)?<div className="vrm-a-venir-hote"[^\n]*<ArgentAVenirCarte A=\{liveStatsVus && liveStatsVus\.aVenir\}(?: reserve)?\/>/.test(A0), 'Ventes (Vinted, et tous les sites) monte la carte « À venir » sous la carte du mois');
  dit(!/Argent en attente \(estimation\)/.test(A0), 'plus d’« estimation » sur les statuts de la liste dans Ventes');
  dit(/const attV = aVenirPour\(liveStats && liveStats\.aVenir, \{ plateforme: 'Vinted' \}\);/.test(A0), 'le résumé Vinted lit la part Vinted de la règle');
  dit(/const aV = aVenirPour\(liveStatsVus\.aVenir\);\s*if \(aV\.valeur != null && !aV\.partiel\) base0\.enAttente/.test(A0), 'le widget prend la règle, seulement complète');
  dit(/aVenirPour\(L\.aVenir \|\| null, \{ plateforme, login \}\)/.test(sansCommentaires(CARTE)) && !/L\.walletAttente/.test(sansCommentaires(CARTE)), 'la carte des chiffres lit la règle, plus le seul porte-monnaie');
  // (15 nov.) L'étape Vinted vient de l'étiquette de la vente (`etapeVente`), celle de Vestiaire du parcours : jamais une seconde lecture.
  dit(/etapeVinted: \(o\) => etapeVintedAVenir\(o\), parcoursVc: \(v\) => parcoursVenteVc\(v\)/.test(A0) && /const etapeVintedAVenir = \(o\) => \{\s*const e = etapeVente\(o\);/.test(A0), 'les étapes : Vinted par `etapeVente`, Vestiaire par `parcoursVenteVc` (les règles propriétaires)');
  const ECRAN = sansCommentaires(lire('src/ArgentAVenirEcran.jsx'));
  dit(!!ECRAN && !/\.reduce\(/.test(ECRAN.replace(/export function resumeEtapes[\s\S]*$/, '')) && /friseAVenir\(A, maintenant\)/.test(ECRAN), 'l’écran « Argent à venir » n’additionne rien lui-même (les sommes viennent de la règle)');
  dit(/<ArgentAVenirHote\/>/.test(A0) && /window\.addEventListener\('vrm:argent-a-venir'/.test(A0), 'la coque monte l’écran et l’ouvre sur `vrm:argent-a-venir`');

  console.log(`\n${ko ? '❌' : '✅'} audit-argent-a-venir : ${ok} vert(s), ${ko} rouge(s)${MUT ? ' [mutation ' + MUT + ']' : ''}`);
  process.exit(ko ? 1 : 0);
})();
