// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : L'ARGENT À VENIR — CE QUE LES SITES DOIVENT ENCORE, UNE SEULE RÈGLE
//         node scripts/audit-argent-a-venir.cjs [--mutation=tx450|versement|holds|vcverse|zero|site|libere]
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
// `--mutation=…` réaffaiblit la règle dans une copie : rouge exigé.
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
if (MUT === 'tx450') muter('if (e && (e.s === 450 || e.s === 220 || e.s >= 430)) continue;', 'if (e && (e.s === 220 || (e.s >= 430 && e.s !== 450))) continue;');
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
    dit(!ids.includes('vinted:3'), 'Vinted : la liste dit « colis déposé » mais la transaction est finalisée (450) ⇒ pas à venir');
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

    console.log('── La carte des chiffres lit la même règle');
    const carteTxt = CARTE.replace("from '../argentAVenir.js'", `from 'file://${tmpM}'`);
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
  dit(/<ArgentAVenirCarte A=\{liveStats && liveStats\.aVenir\}\/>/.test(A0), 'Ventes monte la carte « À venir »');
  dit(!/Argent en attente \(estimation\)/.test(A0), 'plus d’« estimation » sur les statuts de la liste dans Ventes');
  dit(/const attV = aVenirPour\(liveStats && liveStats\.aVenir, \{ plateforme: 'Vinted' \}\);/.test(A0), 'le résumé Vinted lit la part Vinted de la règle');
  dit(/const aV = aVenirPour\(liveStatsVus\.aVenir\);\s*if \(aV\.valeur != null && !aV\.partiel\) base0\.enAttente/.test(A0), 'le widget prend la règle, seulement complète');
  dit(/aVenirPour\(L\.aVenir \|\| null, \{ plateforme, login \}\)/.test(sansCommentaires(CARTE)) && !/L\.walletAttente/.test(sansCommentaires(CARTE)), 'la carte des chiffres lit la règle, plus le seul porte-monnaie');

  console.log(`\n${ko ? '❌' : '✅'} audit-argent-a-venir : ${ok} vert(s), ${ko} rouge(s)${MUT ? ' [mutation ' + MUT + ']' : ''}`);
  process.exit(ko ? 1 : 0);
})();
