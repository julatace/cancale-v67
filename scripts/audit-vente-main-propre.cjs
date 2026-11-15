// ════════════════════════════════════════════════════════════════════════════
//  160 · LA VENTE EN MAIN PROPRE EN 2 TOUCHERS (14 nov.) — les RÈGLES EXÉCUTÉES :
//   R  le verdict (`verdictVenteMain`, la règle de « Vendu ailleurs » de la fiche ET de la
//      feuille) sur la VRAIE lecture « Tout sur le N° » (`toutSurLeNumero`) et la VRAIE
//      histoire (`histoireArticle`) : N° EXACT (124 = 0124 ≠ 1240 ≠ B124), N° d'archive
//      « B… » proposé jamais pris à la place, N° inconnu dit, 50 paires au même titre,
//      deux paires sous un N° ⇒ LA QUESTION (puis son toucher), deux annonces de la même
//      paire ⇒ refus, déjà vendue (Vinted à envoyer / en route / finie, Leboncoin, eBay),
//      déjà vendue en main propre, marquée vendue, enlevée du stock, compte retiré des
//      totaux, ventes pas lues ⇒ refus ; vente annulée ⇒ possible ;
//   G  le geste (`opsVenteMain` = `opsVenduAilleurs` + paiement) : décision datée, sortie du
//      stock, case libérée, N° jamais touché ; « Annuler » 5 s ⇒ l'état d'avant EXACT ;
//      « Remettre en stock » plus tard ⇒ décision d'avant, case (si libre ; prise ⇒ rien
//      déplacé, dit), marque « vendue » retirée ;
//   T  les totaux : `ventesFaites` (vendu, jour saisi), `ventesDeclarables` (CA URSSAF du
//      mois, encaissé le jour saisi, jamais « à dater »), le bénéfice (`ventesAutresBenefice`
//      d'App.jsx), le bilan serveur (`calculerBilan`), jamais deux fois avec la vente
//      Vinted de la même annonce ;
//   P  le reçu PDF RELU (pdfjs) : titre, date, N°, article, paiement, montant ; ni acheteur
//      ni prix d'achat ;
//   C  le branchement : une règle (fiche ET feuille), verdict RELU au clic, compte exclu,
//      aucune trace de 159 / 161 / 162 (retirés, décision de Julien), 12 fonctions api/.
//  `--prouve` : chaque mutation réaffaiblit une règle ⇒ l'audit doit ROUGIR.
//  Données inventées seulement (dépôt public). Lancer : node scripts/audit-vente-main-propre.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), vm = require('vm');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const VM = 'src/ideesArgent/venteMain.js';

const MUTATIONS = {
  'ventes pas lues prises pour « pas vendue »': [[VM, "  if (!eV || eV.etat === 'passu') return { etat: 'passu', cle, manques: rn.manques || [] };\n", '']],
  'vente lue ignorée': [[VM, "  if (eV.etat === 'fait') return { etat: 'vendue',", "  if (false) return { etat: 'vendue',"]],
  'doublon : la première choisie': [[VM, "    if (!c) return { etat: 'plusieurs', cle, cartes: encore.map((x) => carteDeAnnonce(x, numero)) };\n    a = c;", '    a = c || encore[0];']],
  'deux annonces de la même paire : une choisie': [[VM, "    if (!rn.double) return { etat: 'deux-annonces', cle };\n", '']],
  'compte retiré des totaux ignoré': [[VM, "  if (a.accountId != null && ecarte(String(a.accountId))) return", '  if (false) return']],
  'déjà vendue en main propre revendue': [[VM, "  if (dej) return { etat: 'deja-main',", "  if (false) return { etat: 'deja-main',"]],
  'vente Vestiaire ignorée': [[VM, "  if (vc) return { etat: 'vendue',", "  if (false) return { etat: 'vendue',"]],
  'Vestiaire pas lu pris pour « rien »': [[VM, "  if (!Array.isArray(ventesVc)) return", "  if (false) return"]],
  'marquée vendue ignorée': [[VM, "  if (encore.some((a) => V.has(String(a.id)))) return { etat: 'marquee', cle };\n", '']],
  'archive prise à la place': [[VM, "    if (rn.ancien) return { etat: 'archive', cle, ancien: str(rn.ancien) };", "    if (rn.ancien) return { etat: 'possible', cle, carte: { id: 'archive', numero: str(rn.ancien) } };"]],
  'remettre en stock : case écrasée': [[VM, '    if (!prise) { ops.push(', '    if (true) { ops.push(']],
  'remettre en stock : décision d’avant perdue': [[VM, 'apres: d.prec && d.prec.choix !== CHOIX_MAIN ? d.prec : undefined, avant: d }];', 'apres: undefined, avant: d }];']],
  'paiement jamais rangé': [['src/venteAilleurs.js', '...(paiement ? { paiement } : {})', '...{}']],
  'paire vendue restée au stock': [['src/venteAilleurs.js', '  if (!dedans) ops.push(', '  if (false) ops.push(']],
  'feuille : verdict pas relu au clic': [['src/ideesArgent/Feuilles.jsx', "    if (!v2 || v2.etat !== 'possible' || v2.carte.id !== carte.id) { setFaux('change'); setTick((t) => t + 1); return; }\n", '']],
  'fiche : ancienne règle (sans le verdict commun)': [['src/App.jsx', "    const v=verdictVenteMain({ rn, p, decisions:lireObjet(CYCLE_DECISIONS), vendues:load('vinted_annonces_vendues',[])||[], ventesVc:ventesVcCoque, cle:cleNum, ecarte:(uid)=>compteEcarte(uid,hAcc,panelOffCoque) });", "    const v=verdictVenteMain({ rn, p, decisions:lireObjet(CYCLE_DECISIONS) });"]],
  'reçu : paiement absent': [['src/ideesArgent/recuPdf.js', '  ligne(mots.paiement, mots.modes[recu.paiement] || recu.paiement);\n', '']],
};
if (process.argv.includes('--prouve')) { prouver(__filename, R, MUTATIONS); return; }

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d != null ? ' — ' + String(d).slice(0, 400) : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — a levé', String(e && e.stack || e).split('\n').slice(0, 3).join(' ')); } };
const imp = (f) => import('file://' + path.join(R, f));
function declaration(src, nom) {
  const i = src.indexOf(`const ${nom} = `);
  if (i < 0) throw new Error(nom + ' absent d’App.jsx');
  return src.slice(i, src.indexOf('\n};\n', i) + 3);
}

(async () => {
  let G, M, RN, H, RG, Va;
  try {
    G = await imp('src/gesteAnnulable.js'); M = await imp(VM); RN = await imp('src/rechercheNumero.js');
    H = await imp('src/histoireArticle.js'); RG = await imp('api/_lib/ventes-regle.js'); Va = await imp('src/venteAilleurs.js');
  } catch (e) { dit(false, 'les modules de la vente en main propre se chargent', String(e && e.message)); console.log(`\n❌ audit-vente-main-propre : ${ok} verts, ${ko} rouge(s)`); process.exit(1); }
  const cleNum = M.cleNumDefaut;
  // La lecture « Tout sur le N° » et l'histoire, comme la coque les fait (règles de l'app passées).
  const lecture = (q, d = {}) => {
    const D = { fiches: d.fiches || {}, pool: null, enLigne: d.enLigne === undefined ? new Set(Object.keys(d.fiches || {})) : d.enLigne, aConfirmer: new Set(), masquees: new Set(),
      comptesOk: null, ventes: d.ventes === undefined ? [] : d.ventes, txnItem: d.txnItem || {}, saleOv: {}, bordereaux: [], imprimes: {}, postes: {},
      lbcVentes: d.lbcVentes === undefined ? [] : d.lbcVentes, ebayCommandes: d.ebay === undefined ? [] : d.ebay, ebayAnnonces: [], plan: {}, archive: 'B' };
    const o = { cleNum, ouStock: () => null, numLbc: (v) => v.num || null, numEbayLigne: (c, li) => li.num || null, numEbayAnnonce: () => null,
      aPoster: (v) => /envoyer|bordereau/i.test(v.status || ''), expediee: () => false, revenue: (v) => /annul/i.test(v.status || ''),
      conflits: (m) => Object.entries(m).filter(([, l]) => l.filter((x) => x.type === 'annonce').length > 1 && d.double !== false) };
    const rn = RN.toutSurLeNumero(q, D, o, ['', 'B']);
    const p = rn && rn.etat !== 'invalide' ? H.histoireArticle(rn, { fiches: D.fiches }, { venteAnnulee: (v) => /annul/i.test(v.status || ''), commandeEbayEngagee: () => true, lbcAnnulee: (v) => !!v.annulee, montantRecuEbay: () => ({ eur: 50 }) }) : null;
    return { rn, p };
  };
  const verdict = (q, d = {}, x = {}) => { const { rn, p } = lecture(q, d); return M.verdictVenteMain({ rn, p, decisions: x.decisions || {}, vendues: x.vendues || [], ventesVc: Object.prototype.hasOwnProperty.call(x, 'vc') ? x.vc : [], cle: cleNum, ecarte: x.ecarte || (() => false), choisie: x.choisie || null }); };
  const F = {
    '9124': { numero: '124', title: 'Asics Gel-Kayano 14 argent', size: '43', price: '90', accountId: '111', buyPrice: '37', buyFrom: 'vendeur_x' },
    '9240': { numero: '1240', title: 'Nike Dunk Low Panda', price: '80', accountId: '111' },
    '9b24': { numero: 'B124', title: 'Adidas Samba OG', price: '70', accountId: '111' },
    '9b25': { numero: 'B125', title: 'Puma Speedcat', price: '75', accountId: '111' },
  };

  // ── R · le verdict ──────────────────────────────────────────────────────
  await essaie('R', async () => {
    const r1 = verdict('124', { fiches: F }), r2 = verdict('0124', { fiches: F }), r3 = verdict('N°124', { fiches: F });
    dit(r1.etat === 'possible' && r1.carte.id === '9124' && r1.carte.numero === '124' && r2.etat === 'possible' && r2.carte.id === '9124' && r3.etat === 'possible' && r3.carte.id === '9124', 'R1 « 124 », « 0124 », « N°124 » ⇒ LA paire 9124 (identité par le N° exact)', JSON.stringify([r1, r2.etat, r3.etat]));
    const r4 = verdict('1240', { fiches: F }), r5 = verdict('B124', { fiches: F });
    dit(r4.carte && r4.carte.id === '9240' && r5.carte && r5.carte.id === '9b24', 'R2 « 1240 » ≠ « 124 » ; « B124 » (archive) ≠ « 124 » — chacun SA paire', JSON.stringify([r4, r5]));
    const r6 = verdict('125', { fiches: F });
    dit(r6.etat === 'archive' && r6.ancien === 'B125', 'R3 « 125 » sans paire mais « B125 » existe ⇒ proposé (« C’est le N°B125 »), jamais pris à sa place', JSON.stringify(r6));
    const r7 = verdict('999', { fiches: F });
    dit(r7.etat === 'aucune' && r7.cle === '999', 'R4 N° inconnu ⇒ « Aucune paire au N°999 »', JSON.stringify(r7));
    dit(M.verdictVenteMain({ rn: RN.toutSurLeNumero('dunk', { fiches: F }, { cleNum }, []) }).etat === 'invalide' && !M.estUnNumero('dunk 42') && M.estUnNumero('N°37') && M.estUnNumero('b 125'), 'R5 des mots ne sont pas un N° (la feuille ne fait que proposer)');
    const cinquante = {}; for (let i = 1; i <= 50; i++) cinquante['8' + String(i).padStart(3, '0')] = { numero: String(i), title: 'Nike Dunk Low Panda', size: '42', accountId: '111' };
    const r37 = verdict('37', { fiches: cinquante });
    dit(r37.etat === 'possible' && r37.carte.id === '8037' && M.chercherParMots('dunk 42', cinquante).length === 8, 'R6 50 paires au MÊME titre : le N°37 désigne la n°37 ; le titre ne fait que proposer (8)');
    const vinted = (status) => ({ fiches: F, ventes: [{ transaction_id: 700, status, title: 'Asics', price: { amount: '95.0' }, date: '2026-11-13T10:00:00Z', _uid: '111' }], txnItem: { '700': '9124' } });
    const aEnv = verdict('124', vinted('Bordereau envoyé')), enRoute = verdict('124', vinted('Colis en route')), fini = verdict('124', vinted('Commande finalisée'));
    dit(aEnv.etat === 'vendue' && enRoute.etat === 'vendue' && fini.etat === 'vendue' && /Vinted/.test(aEnv.lignes.join(' ')), 'R7 vendue sur Vinted (à envoyer, en route, finie) ⇒ refus clair, la vente dite', JSON.stringify([aEnv, enRoute.etat, fini.etat]));
    const annulee = verdict('124', vinted('Commande annulée'));
    dit(annulee.etat === 'possible', 'R8 une vente Vinted ANNULÉE ⇒ la paire est revenue : possible', annulee.etat);
    const lbc = verdict('124', { fiches: F, lbcVentes: [{ id: 'l1', num: '124', price: 9000, date: '2026-11-12T10:00:00Z' }] });
    const ebay = verdict('124', { fiches: F, ebay: [{ orderId: 'e1', creationDate: '2026-11-12T10:00:00Z', lineItems: [{ num: '124' }] }] });
    const vcV = verdict('124', { fiches: F }, { vc: [{ id: 'v1', num: '124' }] }), vcAutre = verdict('124', { fiches: F }, { vc: [{ id: 'v2', num: '1240' }] });
    dit(lbc.etat === 'vendue' && ebay.etat === 'vendue' && vcV.etat === 'vendue' && /Vestiaire/.test(vcV.ou) && vcAutre.etat === 'possible', 'R9 vendue sur Leboncoin, eBay, Vestiaire (par leur identité, N° exact) ⇒ refus', JSON.stringify([lbc.etat, ebay.etat, vcV, vcAutre.etat]));
    dit(verdict('124', { fiches: F }, { vc: null }).etat === 'passu' && verdict('124', { fiches: F }, { vc: undefined }).etat === 'passu', 'R9b ventes Vestiaire pas lues (null) ou en cours ⇒ « pas su »');
    const passu = verdict('124', { fiches: F, ventes: null });
    dit(passu.etat === 'passu', 'R10 ventes Vinted pas lues ⇒ refus (« pas su » ne vaut pas « pas vendue »)', JSON.stringify(passu));
    const sansFiches = M.verdictVenteMain({ rn: RN.toutSurLeNumero('124', { fiches: null }, { cleNum }, []) });
    const dressing = verdict('88', { fiches: { a: { numero: '88', title: 'x' }, b: { numero: '88', title: 'y' } }, enLigne: null });
    dit(sansFiches.etat === 'passu' && dressing.etat === 'passu', 'R10b fiches pas lues, ou deux annonces sans savoir laquelle est en ligne ⇒ refus (« pas su »)', JSON.stringify([sansFiches, dressing]));
    const deux = { '7001': { numero: '88', title: 'Air Max 90 blanche', accountId: '111' }, '7002': { numero: '88', title: 'Air Max 90 noire', accountId: '111' } };
    const q1 = verdict('88', { fiches: deux });
    dit(q1.etat === 'plusieurs' && q1.cartes.length === 2, 'R11 deux paires PRÉSENTES sous le N°88 ⇒ LA QUESTION (les deux, aucune choisie)', JSON.stringify(q1));
    const q2 = verdict('88', { fiches: deux }, { choisie: '7002' });
    dit(q2.etat === 'possible' && q2.carte.id === '7002' && q2.double === true, 'R12 SON toucher (7002) ⇒ celle-là, et seulement elle', JSON.stringify(q2));
    const q3 = verdict('88', { fiches: deux, double: false });
    dit(q3.etat === 'deux-annonces', 'R13 deux annonces de la MÊME paire (en ligne deux fois) ⇒ refus, rien deviné', q3.etat);
    const dm = verdict('124', { fiches: F }, { decisions: { '9124': { choix: 'vendu-main', montant: 45, date: '2026-11-14', numero: '124' } } });
    dit(dm.etat === 'deja-main' && dm.decision.montant === 45 && verdict('124', { fiches: F }, { decisions: { '9124': { choix: 'separe' } } }).etat === 'sortie'
      && verdict('124', { fiches: F }, { vendues: ['9124'] }).etat === 'marquee', 'R14 déjà vendue en main propre, enlevée du stock, marquée vendue ⇒ refus');
    const ec = verdict('124', { fiches: F }, { ecarte: (u) => u === '111' });
    dit(ec.etat === 'compte-ecarte', 'R15 la paire d’un compte retiré des totaux ⇒ refus (elle ne compterait pas)', JSON.stringify(ec));
    dit(!JSON.stringify(r1.carte).includes('37') && !JSON.stringify(r1.carte).includes('vendeur_x'), 'R16 la carte de la feuille ne porte ni prix d’achat ni fournisseur', JSON.stringify(r1.carte));
  });

  // ── G · le geste ────────────────────────────────────────────────────────
  const MAINT = Date.parse('2026-11-14T15:00:00');
  const carte = { id: '9124', numero: '124', titre: 'Asics Gel-Kayano 14 argent' };
  const D0 = { '9124': { choix: 'chez-moi', at: '2026-11-01T10:00:00Z' }, '5000': { choix: 'chez-moi' } }, V0 = ['4000'], S0 = { '124': { meuble: 'm1', i: 3 }, '7': { meuble: 'm1', i: 4 } };
  let ap = { vrm_cycle_decisions: {}, vinted_annonces_vendues: [], vrm_slots: {} };
  await essaie('G', async () => {
    dit(M.opsVenteMain({ carte, montant: 45, date: '2026-11-14', paiement: 'cheque', maintenant: MAINT }) === null && M.opsVenteMain({ carte, montant: 0, date: '2026-11-14', paiement: 'especes', maintenant: MAINT }) === null
      && M.opsVenteMain({ carte, montant: 45, date: '2026-12-01', paiement: 'especes', maintenant: MAINT }) === null, 'G1 paiement inconnu, prix nul, date future ⇒ rien n’est écrit');
    const op = M.opsVenteMain({ carte, montant: 45, date: '2026-11-14', paiement: 'virement', decisions: D0, vendues: V0, slots: S0, cle: cleNum, maintenant: MAINT });
    const d = { vrm_cycle_decisions: D0, vinted_annonces_vendues: V0, vrm_slots: S0 };
    ap = {}; for (const k of Object.keys(d)) ap[k] = G.appliquerOps(d[k], op.ops.filter((o) => o.k === k), 'apres');
    const dec = ap.vrm_cycle_decisions['9124'];
    dit(dec && dec.choix === 'vendu-main' && dec.montant === 45 && dec.date === '2026-11-14' && dec.paiement === 'virement' && dec.numero === '124' && dec.ailleurs === true, 'G2 LA décision de « Vendu ailleurs » : 45 €, le 14/11, virement, N° gardé', JSON.stringify(dec));
    dit(ap.vinted_annonces_vendues.includes('9124') && !ap.vrm_slots['124'] && ap.vrm_slots['7'] && !op.ops.some((o) => /numeros/.test(o.k)), 'G3 sortie du stock (marquée vendue, SA case libérée, les autres gardées), le N° jamais touché');
    dit(JSON.stringify(dec.prec) === JSON.stringify(D0['9124']) && JSON.stringify(dec.caseAvant) === JSON.stringify(S0['124']), 'G4 la décision garde de quoi la défaire plus tard (décision d’avant, case)');
    const df = {}; for (const k of Object.keys(d)) df[k] = G.appliquerOps(ap[k], op.ops.filter((o) => o.k === k), 'avant');
    dit(JSON.stringify(df) === JSON.stringify(d), 'G5 « Annuler » (5 s) ⇒ l’état d’avant, EXACT (décision, marque, case)', JSON.stringify(df));
    dit(verdict('124', { fiches: F }, { decisions: ap.vrm_cycle_decisions, vendues: ap.vinted_annonces_vendues }).etat === 'deja-main', 'G6 vendue ⇒ le même N° retapé est refusé (« déjà vendu en main propre »)');
    const an = M.opsAnnulerVenteMain({ id: '9124', decisions: ap.vrm_cycle_decisions, vendues: ap.vinted_annonces_vendues, slots: ap.vrm_slots, cle: cleNum });
    const re = {}; for (const k of Object.keys(d)) re[k] = G.appliquerOps(ap[k], an.ops.filter((o) => o.k === k), 'apres');
    dit(an.caseRendue === true && JSON.stringify(re.vrm_cycle_decisions) === JSON.stringify(d.vrm_cycle_decisions) && JSON.stringify(re.vinted_annonces_vendues) === JSON.stringify(d.vinted_annonces_vendues)
      && JSON.stringify(re.vrm_slots['124']) === JSON.stringify(S0['124']) && JSON.stringify(re.vrm_slots['7']) === JSON.stringify(S0['7']), 'G7 « Remettre en stock » plus tard ⇒ décision d’avant, case, marque : l’état d’avant', JSON.stringify(re));
    const prise = { ...ap.vrm_slots, '200': S0['124'] };
    const an2 = M.opsAnnulerVenteMain({ id: '9124', decisions: ap.vrm_cycle_decisions, vendues: ap.vinted_annonces_vendues, slots: prise, cle: cleNum });
    dit(an2.caseRendue === false && !an2.ops.some((o) => o.k === 'vrm_slots'), 'G8 sa case reprise par une autre paire ⇒ rien n’est déplacé, et c’est dit');
    dit(M.opsAnnulerVenteMain({ id: '5000', decisions: ap.vrm_cycle_decisions }) === null, 'G9 seule une vente en main propre se remet en stock');
  });

  // ── T · les totaux ──────────────────────────────────────────────────────
  await essaie('T', async () => {
    const main = Va.ventesMainPropre(ap.vrm_cycle_decisions);
    const vf = RG.ventesFaites({ vinted: [], main });
    const l = vf.lignes.find((x) => x.plateforme === 'Ailleurs');
    dit(l && l.eur === 45 && new Date(l.ts).toDateString() === new Date('2026-11-14T12:00:00').toDateString() && vf.lignes.length === 1, 'T1 « vendu » : 45 € au jour saisi (le 14/11), une fois', JSON.stringify(vf.lignes));
    const decl = RG.ventesDeclarables({ vinted: [], versements: {}, declare: {}, main });
    const nov = decl.lignes.filter((x) => x.ym === '2026-11');
    dit(nov.length === 1 && nov[0].eur === 45 && nov[0].plateforme === 'Ailleurs' && !decl.aDater.length, 'T2 CA déclaré (URSSAF) : novembre, encaissée le jour saisi — jamais « à dater »', JSON.stringify(decl.lignes));
    const vinted = [{ transaction_id: 900, status: 'Commande finalisée', price: { amount: '70.0' }, date: '2026-11-14T10:00:00Z', _acc: { vinted_user_id: '111' } }];
    dit(Va.ventesAilleursPour(ap.vrm_cycle_decisions, vinted, { '900': '9124' }, RG.classifyOrderStatus).length === 0, 'T3 la même annonce vendue aussi sur Vinted ⇒ la main propre n’est pas comptée une 2ᵉ fois');
    const BS = await imp('api/_lib/bilan-semaine.js');
    const debut = Date.parse('2026-11-10T00:00:00Z'), fin = Date.parse('2026-11-17T00:00:00Z');
    const b = BS.calculerBilan({ debut, fin, maintenant: Date.parse('2026-11-17T08:00:00Z'), seuilCapture: debut, comptes: [{ uid: '111', login: 'compte_a' }],
      commandes: { '111': { cap: '2026-11-16T06:00:00Z', orders: [] } }, masquesTx: new Set(), masquesComptes: new Set(), panneau: {}, lbc: [], ebay: [], versements: {}, regle: null,
      decisions: ap.vrm_cycle_decisions, txItem: {} });
    dit(b.vendu.eur === 45 && b.vendu.n === 1 && b.recu.eur === 45, 'T4 le bilan serveur : vendu 45 €, reçu 45 € (la même règle)', JSON.stringify([b.vendu, b.recu]));
    const appSrc = require('./_source-app.cjs').sourceApp(R);
    const ctx = vm.createContext({ ventesMainPropre: Va.ventesMainPropre, ventesAilleursPour: Va.ventesAilleursPour, classifyOrderStatus: RG.classifyOrderStatus, lbcAnnulee: RG.lbcAnnulee, lbcFinalisee: RG.lbcFinalisee,
      commandeEbayEngagee: RG.commandeEbayEngagee, montantRecuEbay: RG.montantRecuEbay, vcVenteAnnulee: () => false, etapeMotVc: () => '', montantRecuVc: () => ({ eur: null }), dateVenteVc: () => null,
      cleNum, _txnItemConnu: {}, CYCLE_DECISIONS: 'vrm_cycle_decisions', Set, Object, Number, Date, isFinite, Math, String, Array });
    vm.runInContext(declaration(appSrc, 'ficheUniqueDuNumero') + '\n' + declaration(appSrc, 'ventesAutresBenefice') + '\nthis.VAB = ventesAutresBenefice;', ctx);
    const ben = ctx.VAB({ lbc: [], ebay: [], vestiaire: [], numeros: { '9124': { numero: '124', buyPrice: '37' } }, achat: (f) => Number(f.buyPrice), numLbc: () => null, numEbayLigne: () => null, main });
    dit(ben.length === 1 && ben[0].eur === 45 && ben[0].achat === 37, 'T5 le bénéfice : 45 € vendus − 37 € d’achat (son N°)', JSON.stringify(ben));
  });

  // ── P · le reçu PDF, relu ───────────────────────────────────────────────
  await essaie('P', async () => {
    const recu = M.lignesRecu({ carte, montant: 45, date: '2026-11-14', paiement: 'virement', vendeur: 'Boutique Essai', numeroRecu: 'MP-20261114-124' });
    dit(recu && Object.keys(recu).sort().join() === 'article,date,montant,numero,numeroRecu,paiement,vendeur', 'P1 le reçu : liste fermée (ni acheteur, ni prix d’achat)', JSON.stringify(recu));
    const { recuPdf } = await imp('src/ideesArgent/recuPdf.js');
    const fr = (await imp('src/i18n/langues/fr/idees.js')).default;
    const mots = { titre: fr['ia.recu.titre'], sousTitre: fr['ia.recu.sous'], numero: fr['ia.recu.numero'], date: fr['ia.recu.date'], vendeur: fr['ia.recu.vendeur'], article: fr['ia.recu.article'], rangement: fr['ia.recu.rangement'],
      paiement: fr['ia.recu.paiement'], montant: fr['ia.recu.montant'], pied: fr['ia.recu.pied'], signature: fr['ia.recu.signature'], modes: { especes: fr['ia.vm.paiement.especes'], virement: fr['ia.vm.paiement.virement'], autre: fr['ia.vm.paiement.autre'] } };
    const pj = await import('file://' + path.join(R, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'));
    const texte = async (octets) => { const doc = await pj.getDocument({ data: new Uint8Array(octets), isEvalSupported: false, verbosity: 0 }).promise; const pg = await doc.getPage(1); return { n: doc.numPages, t: (await pg.getTextContent()).items.map((i) => i.str).join(' ').replace(/\s+/g, ' ') }; };
    const { n, t } = await texte(await recuPdf(recu, mots));
    dit(n === 1 && /Reçu de vente/.test(t) && /14\/11\/2026/.test(t) && /MP-20261114-124/.test(t) && /N°124/.test(t) && /Asics Gel-Kayano 14 argent/.test(t) && /Virement/.test(t) && /45 €/.test(t) && /Boutique Essai/.test(t),
      'P2 le PDF RELU : titre, date, n° de reçu, N°, article, paiement, montant, vendeur', t);
    dit(!/\b37\b/.test(t) && !/vendeur_x/.test(t) && !/acheteur/i.test(t), 'P3 aucun prix d’achat, aucun fournisseur, aucun acheteur dans le PDF');
    const t2 = (await texte(await recuPdf(M.lignesRecu({ carte, montant: 12.5, date: '2026-11-14', paiement: 'especes' }), mots))).t;
    dit(/12,50 €/.test(t2) && /Espèces/.test(t2) && /____/.test(t2), 'P4 12,50 € espèces ; sans nom de facture, une ligne « Vendu par » à remplir', t2);
  });

  // ── C · le branchement ──────────────────────────────────────────────────
  await essaie('C', async () => {
    const app = require('./_source-app.cjs').sourceApp(R);
    const f = sansCommentaires(lire('src/ideesArgent/Feuilles.jsx'));
    dit(app.includes("const v=verdictVenteMain({ rn, p, decisions:lireObjet(CYCLE_DECISIONS), vendues:load('vinted_annonces_vendues',[])||[], ventesVc:ventesVcCoque, cle:cleNum, ecarte:(uid)=>compteEcarte(uid,hAcc,panelOffCoque) });")
      && app.includes("return verdictVenteMain({ rn, p, decisions:lireObjet(CYCLE_DECISIONS), vendues:load('vinted_annonces_vendues',[])||[], ventesVc:ventesVcCoque, cle:cleNum, choisie, ecarte:(uid)=>compteEcarte(uid,hAcc,panelOffCoque) });"),
      'C1 UNE règle : « Vendu ailleurs » de la fiche ET la feuille passent par `verdictVenteMain` (même histoire, même compte exclu)');
    dit(app.includes("const { rn, p } = histoirePaire(String(q||''), false);") && app.includes('const { rn, numeros, nomCompte, ex, p, etat, neuve } = histoirePaire(numF);'), 'C2 la feuille lit l’histoire du N° comme la fiche (`histoirePaire`)');
    const valider = f.slice(f.indexOf('const valider = '), f.indexOf('const remettre = '));
    dit(/refVerdict\.current\(brut, choisie\)/.test(valider) && /v2\.etat !== 'possible'/.test(valider) && valider.indexOf('v2.etat') > 0 && valider.indexOf('v2.etat') < valider.indexOf('gesteVrm('), 'C3 au clic « Vendue », le verdict est RELU avant toute écriture');
    dit((f.match(/gesteVrm\(/g) || []).length === 2 && !/\bsave\(/.test(f) && !/fetch\(/.test(f), 'C4 la feuille n’écrit que par le geste annulable (vendre, remettre en stock)');
    dit(app.includes('const besoinNumData=venteMainOuverte||') && app.includes('<IdeesArgentRacine pret={!!numData} verdict={verdictVenteMainCoque} surOuverture={setVenteMainOuverte}/>'), 'C5 la coque lit ventes et annonces tant que la feuille est ouverte ; pas lu ⇒ « lecture »');
    const fichiers = []; const marche = (x) => { for (const e of fs.readdirSync(path.join(R, x), { withFileTypes: true })) { const p = path.join(x, e.name); if (e.isDirectory()) marche(p); else if (/\.(js|jsx|css)$/.test(e.name)) fichiers.push(p); } };
    marche('src'); marche('api');
    const traces = fichiers.filter((p) => /mode=siri|siri-jeton|siri-reponses|vrm_siri|siri_retrait|'depense-photo'|'partage-image'|depensePhoto|carteImage|SiriJeton|ia\.siri\.|ia\.dep\.|ia\.img\./.test(lire(p)));
    dit(!traces.length, 'C6 aucune trace de 159 / 161 / 162 (route, jeton, feuilles, textes)', traces.join(', '));
    dit(fs.readdirSync(path.join(R, 'api')).filter((x) => /\.js$/.test(x)).length <= 12, 'C7 aucune fonction api/ neuve');
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-vente-main-propre : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
