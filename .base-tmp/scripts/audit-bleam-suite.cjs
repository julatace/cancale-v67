// ════════════════════════════════════════════════════════════════════════════
//  « COMME BLEAM », LA SUITE (20 nov., ext. 5.410.4) — les moteurs EXÉCUTÉS sur le vrai background.js
//  (scripts/_fond-vm.cjs : fausse base à état, faux Vinted qui compte chaque requête). Rien de réel.
//  1. Après-vente : éteint ⇒ aucune requête ; 1er passage ⇒ le passé noté, rien envoyé ; une NOUVELLE vente ⇒
//     UN message à SA conversation, jamais deux ; litige ⇒ rien ; rappel au point relais seulement 24 h après
//     l'arrivée ; demande d'évaluation 24 h après la fin ; évaluation 5 étoiles seulement si le geste est APPRIS ;
//     autre compte dans l'onglet ⇒ rien.
//  2. Bordereau par compte : éteint ⇒ rien ; allumé ⇒ commande ; « boîte aux lettres » pas apprise ⇒ rien ; apprise ⇒
//     la valeur de SA commande.
//  3. Stock auto : identité N° seulement ; quantité 3 ⇒ republication `dupliquer` puis 2 ; sans N° ⇒ rien.
//  4. Cycle de vie : règle pure (anti-stagnation, déstockage, plafond, plancher) ; moteur : créneau fermé ⇒ rien,
//     baisse déposée en `cmd_prix_*` (jamais sous le plancher), quota du jour tenu.
//  5. Favoris : filtres (note, par article, réécrire) et analyse des réponses par version.
//  6. Dressing amélioré : profil d'un autre ⇒ rien ; éteint ⇒ rien ; Supprimer sans confirmation ⇒ rien.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const BG0 = cheminSource();
const MUTATIONS = {
  litige: ["      if (litige) { e[d] = 'litige'; continue; }                      // litige ⇒ RIEN, jamais\n", ''],
  passe: ["      if (premier) { e[d] = 'avant'; continue; }                     // le passé : noté, jamais envoyé\n", ''],
  deuxFois: ["  if (!(await marquer(t))) return { saute: 'stockage' };\n  const r = a.sorte === 'stock'", "  const r = a.sorte === 'stock'"],
  delaiRelais: ["      if (attend) continue;                                          // pas encore l'heure : rien noté, il viendra\n", ''],
  eteint: ["  if (!allume) return { saute: 'eteint' };", "  if (false) return { saute: 'eteint' };"],
  appris: ["  if (!appris) { noterDiag('bleam_eval_pas_appris'); return { ok: false, code: 'pas-appris' }; }", "  const appris0 = appris || { methode: 'POST', chemin: '/api/v2/feedbacks', enveloppe: '', note: 'rating', texte: 'feedback', tx: 'transaction_id' };\n  { const appris = appris0;"],
  boite: ["  return v == null ? { refus:", "  return v == null ? { dropOff: null, r:"],
  plancherCycle: ["      if (v < plancherC) v = plancherC;\n", ''],
  creneau: ["  if (!creneauOuvert(plan.rythme, t)) return { saute: 'creneau' };", ''],
  dupliquer: ["confirme: true, dupliquer: true, methode: 'directe', total: 1,", "confirme: true, methode: 'directe', total: 1,"],
  filtre: ["if (F.reecrireJours > 0 && ach && (c.parAcheteur || {})[ach]", "if (false && ach && (c.parAcheteur || {})[ach]"],
  profil: ["  if (page !== String(uid)) return { ok: true, actif: false, raison: 'autre-profil' };", ''],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
let BG = BG0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut];
  let s = fs.readFileSync(BG0, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  s = s.replace(a, b);
  if (mut === 'appris') s = s.replace("  await noterJournal(uid, 'evaluation', { x: a.tx, auto: true });\n  return { ok: true };\n}", "  await noterJournal(uid, 'evaluation', { x: a.tx, auto: true });\n  return { ok: true };\n  }\n}");
  BG = path.join(path.dirname(BG0), `.mut-bleam-${mut}-${process.pid}.js`);
  fs.writeFileSync(BG, s);
  process.on('exit', () => { try { fs.unlinkSync(BG); } catch (_) {} });
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 500) : '')); } };
const T0 = Date.now(), iso = (t) => new Date(t).toISOString(), H = 3600000, J = 864e5;
const UID = '111';
const bleam = (sections) => ({ v: 1, comptes: { [UID]: sections } });
// La VRAIE forme d'un détail de transaction (§6.3) : data.payload.transaction.{item_id, status, status_title, shipment.status_title}.
const txnRow = ({ status, status_title, ship_status_title, item_id }) => ({ capturedAt: iso(T0), payload: { transaction: { id: 1, status: status != null ? Number(status) : undefined, status_title, item_id, shipment: ship_status_title ? { status_title: ship_status_title } : undefined } } });
const vente = (tx, o = {}) => Object.assign({ transaction_id: Number(tx), conversation_id: Number('9' + tx), status: 'Le paiement a été validé', date: iso(T0 - H), title: 'Paire ' + tx }, o);
function monde({ ventes = [], txn = {}, main = {}, connecte = UID, store = {}, lignes: plus = {}, vinted } = {}) {
  const lignes = Object.assign({
    main: Object.assign({ vinted_annonce_numeros: {}, vinted_buyprice_by_num: {} }, main),
    [`harvest_${UID}_orders_sold`]: { capturedAt: iso(T0 - 60000), nItems: ventes.length, payload: { my_orders: ventes } },
  }, plus);
  for (const [tx, d] of Object.entries(txn)) lignes[`harvest_${UID}_txn_${tx}`] = Object.assign({ capturedAt: iso(T0 - 60000) }, d);
  store.vrmCloisonne = true;
  const f = faireFond({ src: BG, lignes, store, connecte, vinted: vinted || (() => ({ status: 200, body: { code: 0 } })) });
  f.ctx.attendreEcriture = async () => ({ ok: true });
  f.ctx.porteDiscretion = async () => null;
  f.ctx.secuGeste = async () => null;
  return f;
}
const ecrits = (f) => f.j.vinted.filter((x) => String(x.methode || '').toUpperCase() !== 'GET');
const replies = (f) => ecrits(f).filter((x) => /\/conversations\/\d+\/replies$/.test(x.chemin));
const tick = async (f) => { const r = await f.ctx.apresVenteTick('banc'); await f.ctx.chrome.storage.local.set({ vrmBleamProchain: {} }); return r; };
const avancer = async (f, tx, champ, depuis) => { const m = (await f.ctx.chrome.storage.local.get('vrmBleamMemo')).vrmBleamMemo; m[UID].tx[tx][champ] = T0 - depuis; await f.ctx.chrome.storage.local.set({ vrmBleamMemo: m }); };

(async () => {
  const msgOn = { msgVente: { actif: true, textes: ['Merci pour ton achat !', 'Merci beaucoup, je prépare ton colis.'] } };
  // ── 1. APRÈS-VENTE ─────────────────────────────────────────────────────────
  try {
    const f0 = monde({ ventes: [vente(501)] });
    const e0 = await tick(f0); await tick(f0);
    const memo0 = (await f0.ctx.chrome.storage.local.get('vrmBleamMemo')).vrmBleamMemo;
    dit(ecrits(f0).length === 0 && f0.j.vinted.length === 0 && e0 && e0.saute === 'eteint' && !memo0, 'après-vente ÉTEINT par défaut ⇒ aucune requête Vinted, rien lu ni noté', JSON.stringify([e0, memo0]));
    const f = monde({ ventes: [vente(501)], main: { vinted_bleam: bleam(msgOn) } });
    await tick(f);
    dit(replies(f).length === 0, '1er passage : la vente d’AVANT est notée, aucun message aux acheteurs du passé', JSON.stringify(replies(f)));
    f.lignes[`harvest_${UID}_orders_sold`].payload.my_orders.unshift(vente(502));
    await tick(f);
    const r1 = replies(f);
    dit(r1.length === 1 && /\/conversations\/9502\/replies$/.test(r1[0].chemin), 'une NOUVELLE vente ⇒ UN message, dans SA conversation', JSON.stringify(r1));
    let corps = ''; try { corps = JSON.parse(r1[0].corps).reply.body; } catch (_) {}
    dit(['Merci pour ton achat !', 'Merci beaucoup, je prépare ton colis.'].some((t) => corps.includes(t.replace(/^Merci/, '').trim()) || corps === t), 'le texte est une de SES versions', corps);
    await tick(f); await tick(f);
    dit(replies(f).length === 1, 'jamais deux fois le même message pour la même vente');
    const jr = Object.keys(f.lignes).filter((k) => /^journal_vrm_111_/.test(k)).flatMap((k) => f.lignes[k].e || []);
    dit(jr.some((x) => x.s === 'message_acheteur'), 'le message est au journal « Ce que VRM a fait »', JSON.stringify(jr));
    // Litige.
    f.lignes[`harvest_${UID}_orders_sold`].payload.my_orders.unshift(vente(503, { status: 'Réclamation ouverte par l’acheteur' }));
    await tick(f);
    dit(replies(f).length === 1, 'vente en LITIGE ⇒ aucun message');
    // Rappel au point relais.
    const g = monde({ ventes: [vente(601)], main: { vinted_bleam: bleam({ msgRelais: { actif: true, textes: ['Ton colis t’attend au point relais.'], heures: 24 } }) } });
    await tick(g);
    g.lignes[`harvest_${UID}_orders_sold`].payload.my_orders.unshift(vente(602));
    g.lignes[`harvest_${UID}_txn_602`] = txnRow({ status: '230', status_title: 'Colis livré au point relais', ship_status_title: 'Disponible au point relais' });
    await tick(g);
    dit(replies(g).length === 0, 'rappel au point relais : rien AVANT 24 h', JSON.stringify(replies(g)));
    await avancer(g, '602', 'relaisVu', 25 * H);
    await tick(g);
    dit(replies(g).length === 1 && /9602/.test(replies(g)[0].chemin), 'rappel au point relais : envoyé 24 h après l’arrivée (et une seule fois)', JSON.stringify(replies(g)));
    await tick(g);
    dit(replies(g).length === 1, 'rappel : jamais deux fois');
    // Demande d'évaluation + évaluation 5 étoiles (apprise ou non).
    const h = monde({ ventes: [vente(701)], main: { vinted_bleam: bleam({ msgEvaluation: { actif: true, textes: ['Si tout va bien, une évaluation me ferait plaisir.'], heures: 24 }, eval5: { actif: true, textes: ['Acheteur parfait, merci !'] } }) } });
    await tick(h);
    h.lignes[`harvest_${UID}_orders_sold`].payload.my_orders.unshift(vente(702, { status: 'Commande finalisée' }));
    h.lignes[`harvest_${UID}_txn_702`] = txnRow({ status: '450', status_title: 'Commande finalisée' });
    await tick(h); await tick(h);
    dit(ecrits(h).length === 0, 'évaluation 5 étoiles : geste jamais APPRIS ⇒ rien ne part', JSON.stringify(ecrits(h)));
    await avancer(h, '702', 'finVu', 25 * H);
    await tick(h);
    dit(replies(h).length === 1, 'demande d’évaluation : 24 h après la fin', JSON.stringify(replies(h)));
    const k = monde({ ventes: [vente(801)], main: { vinted_bleam: bleam({ eval5: { actif: true, textes: ['Acheteur parfait, merci !'] } }) },
      lignes: { [`harvest_${UID}_wreq_api_v2_transactions_id_feedbacks`]: { uid: UID, method: 'POST', path: '/api/v2/transactions/123/feedback', body: '{"feedback":{"rating":4,"feedback":"Bien","transaction_id":123}}', capturedAt: iso(T0 - 5 * J) } } });
    await tick(k);
    k.lignes[`harvest_${UID}_orders_sold`].payload.my_orders.unshift(vente(802, { status: 'Commande finalisée' }));
    k.lignes[`harvest_${UID}_txn_802`] = txnRow({ status: '450', status_title: 'Commande finalisée' });
    await tick(k); await tick(k);
    const ev = ecrits(k).filter((x) => /feedback/.test(x.chemin));
    let cev = {}; try { cev = JSON.parse(ev[0].corps); } catch (_) {}
    dit(ev.length === 1 && /\/transactions\/802\/feedback$/.test(ev[0].chemin) && cev.feedback && cev.feedback.rating === 5 && cev.feedback.transaction_id === 802 && /parfait/.test(cev.feedback.feedback), 'évaluation 5 étoiles APPRISE : SA forme, note 5, SON texte, une seule fois', JSON.stringify(ev));
    const kl = monde({ ventes: [vente(803)], main: { vinted_bleam: bleam({ eval5: { actif: true, textes: ['Merci !'] } }) }, lignes: k.lignes ? { [`harvest_${UID}_wreq_api_v2_transactions_id_feedbacks`]: k.lignes[`harvest_${UID}_wreq_api_v2_transactions_id_feedbacks`] } : {} });
    await tick(kl);
    kl.lignes[`harvest_${UID}_orders_sold`].payload.my_orders.unshift(vente(804, { status: 'Commande finalisée' }));
    kl.lignes[`harvest_${UID}_txn_804`] = txnRow({ status: '450', status_title: 'Commande finalisée' });
    kl.lignes[`harvest_${UID}_litige_804`] = { payload: { transaction_id: 804 } };
    await tick(kl); await tick(kl);
    dit(ecrits(kl).length === 0, 'évaluation : litige ouvert sur la vente ⇒ rien', JSON.stringify(ecrits(kl)));
    // Autre compte dans l'onglet.
    const z = monde({ ventes: [vente(901)], main: { vinted_bleam: bleam(msgOn) }, connecte: '222' });
    await tick(z); z.lignes[`harvest_${UID}_orders_sold`].payload.my_orders.unshift(vente(902)); await tick(z);
    dit(ecrits(z).length === 0, 'un AUTRE compte connecté dans l’onglet ⇒ rien au nom de celui-ci');
  } catch (e) { dit(false, 'après-vente — exception', e && e.stack); }

  // ── 2. BORDEREAU PAR COMPTE ─────────────────────────────────────────────────
  try {
    const shipOrder = (f) => ecrits(f).filter((x) => /\/shipment\/order$/.test(x.chemin));
    const ad = { [`harvest_${UID}_wreq_api_v2_transactions_id_shipment_order`]: { body: JSON.stringify({ seller_address_id: 42, drop_off_type: null, label_type: null }) } };
    const b0 = monde({ ventes: [vente(1001)], lignes: ad });
    await b0.ctx.genererBordereauxEnAttente(UID);
    dit(shipOrder(b0).length === 0, 'bordereau : éteint (ni VRM ni le compte) ⇒ aucune commande');
    const b1 = monde({ ventes: [vente(1002)], lignes: ad, main: { vinted_bleam: bleam({ bordereau: { actif: true } }) } });
    await b1.ctx.genererBordereauxEnAttente(UID);
    let c1 = {}; try { c1 = JSON.parse(shipOrder(b1)[0].corps); } catch (_) {}
    dit(shipOrder(b1).length === 1 && c1.drop_off_type === null, 'bordereau allumé sur CE compte ⇒ commandé, point relais = le choix de Vinted (rien forcé)', JSON.stringify(shipOrder(b1)));
    const b2 = monde({ ventes: [vente(1003)], lignes: ad, main: { vinted_bleam: bleam({ bordereau: { actif: true, colissimo: 'boite' } }) } });
    await b2.ctx.genererBordereauxEnAttente(UID);
    dit(shipOrder(b2).length === 0, 'Colissimo « boîte aux lettres » pas APPRISE ⇒ rien n’est commandé (dit)', JSON.stringify(shipOrder(b2)));
    const ad3 = { [`harvest_${UID}_wreq_api_v2_transactions_id_shipment_order`]: { body: JSON.stringify({ seller_address_id: 42, drop_off_type: 2, label_type: null }) } };
    const b3 = monde({ ventes: [vente(1004)], lignes: ad3, main: { vinted_bleam: bleam({ bordereau: { actif: true, colissimo: 'boite' } }) } });
    await b3.ctx.genererBordereauxEnAttente(UID);
    let c3 = {}; try { c3 = JSON.parse(shipOrder(b3)[0].corps); } catch (_) {}
    dit(shipOrder(b3).length === 1 && c3.drop_off_type === 2, '« boîte aux lettres » apprise ⇒ la valeur de SA commande à la main', JSON.stringify(shipOrder(b3)));
  } catch (e) { dit(false, 'bordereau — exception', e && e.stack); }

  // ── 3. STOCK AUTO ───────────────────────────────────────────────────────────
  try {
    const st = { stockAuto: { actif: true, stock: { 12: 3 } } };
    const s = monde({ ventes: [vente(1101)], main: { vinted_bleam: bleam(st), vinted_annonce_numeros: { 4242: { numero: '12', accountId: UID }, 4343: { accountId: UID } } } });
    const appels = []; s.ctx.executerCommande = async (m) => { appels.push(m); return { accepte: true, etape: 'fait' }; };
    await tick(s);
    s.lignes[`harvest_${UID}_orders_sold`].payload.my_orders.unshift(vente(1102, { status: 'Commande finalisée' }));
    s.lignes[`harvest_${UID}_txn_1102`] = txnRow({ status: '450', status_title: 'Commande finalisée', item_id: 4242 });
    s.lignes[`harvest_${UID}_orders_sold`].payload.my_orders.unshift(vente(1103, { status: 'Commande finalisée' }));
    s.lignes[`harvest_${UID}_txn_1103`] = txnRow({ status: '450', status_title: 'Commande finalisée', item_id: 4343 });
    const tks = []; for (let i = 0; i < 4; i++) tks.push(await tick(s));
    const reste = (((s.lignes.vrm_reglages_auto || {}).cles || {}).vinted_bleam || {}).comptes;
    dit(appels.length === 1 && appels[0].cmd === 'recreerVinted' && appels[0].id === '4242' && appels[0].dupliquer === true && appels[0].methode === 'directe', 'stock auto : la paire vendue (identité annonce ⇒ N° 12, quantité 3) remise en ligne SANS supprimer la vendue', JSON.stringify(appels) + JSON.stringify(tks));
    dit(reste && reste[UID] && reste[UID].stockAuto.stock['12'] === 2, 'stock auto : quantité 3 ⇒ 2', JSON.stringify(reste));
    dit(!appels.some((a) => a.id === '4343'), 'stock auto : une annonce SANS N° n’est jamais remise (jamais par ressemblance)');
  } catch (e) { dit(false, 'stock auto — exception', e && e.stack); }

  // ── 4. CYCLE DE VIE ─────────────────────────────────────────────────────────
  try {
    const f = monde({});
    const C = f.ctx;
    const plan = (s) => Object.assign(C.bleamSection('cycle', { actif: true, strategie: s }));
    const anti = plan('anti'), des = plan('destock');
    const it = (prixC, joursDepuis) => ({ id: '4242', prixC, misLe: T0 - joursDepuis * J });
    let r = C.cycleAction({ plan: anti, etat: null, item: it(10000, 3), plancherC: 6000, maintenant: T0 });
    dit(r.rien === 'attente', 'anti-stagnation : rien avant 7 jours', JSON.stringify(r));
    r = C.cycleAction({ plan: anti, etat: null, item: it(10000, 7.1), plancherC: 6000, maintenant: T0 });
    dit(r.action === 'baisse' && r.vouluC === 9000, 'anti-stagnation : 7 j sans vente ⇒ −10 % (100 → 90)', JSON.stringify(r));
    r.etat.faits.push(0);
    const r2 = C.cycleAction({ plan: anti, etat: r.etat, item: it(9000, 7.1), plancherC: 6000, maintenant: T0 + 3.1 * J });
    dit(r2.action === 'republier', 'anti-stagnation : republie 3 j plus tard', JSON.stringify(r2));
    const r3 = C.cycleAction({ plan: anti, etat: r.etat, item: { id: '5555', prixC: 9000, misLe: T0 - 7.2 * J }, plancherC: 6000, maintenant: T0 });
    dit(r3.action === 'baisse' && r3.vouluC === 8100 && r3.etat.origineC === 10000 && r3.etat.faits.length === 0, 'anti-stagnation : republiée ⇒ nouveau cycle (le prix d’origine gardé), −10 % encore (90 → 81)', JSON.stringify(r3));
    const r3b = C.cycleAction({ plan: anti, etat: Object.assign({}, r3.etat, { item: '0' }), item: { id: '5556', prixC: 8100, misLe: T0 - 7.2 * J }, plancherC: 6000, maintenant: T0 });
    dit(r3b.action === 'baisse' && r3b.vouluC === 8000, 'plafond −20 % depuis le prix d’ORIGINE : 81 → 80 (pas 72)', JSON.stringify(r3b));
    const r4 = C.cycleAction({ plan: anti, etat: Object.assign({}, r3.etat, { item: '1' }), item: { id: '6666', prixC: 8000, misLe: T0 - 10.5 * J }, plancherC: 6000, maintenant: T0 });
    dit(r4.rien === 'fini', 'anti-stagnation : −20 % au total atteint ⇒ plus rien', JSON.stringify(r4));
    const r5 = C.cycleAction({ plan: anti, etat: null, item: it(10000, 8), plancherC: 9500, maintenant: T0 });
    dit(r5.action === 'baisse' && r5.vouluC === 9500, 'jamais sous le plancher (prix mini / achat + 10 %)', JSON.stringify(r5));
    const r6 = C.cycleAction({ plan: anti, etat: null, item: it(10000, 8), plancherC: null, maintenant: T0 });
    dit(r6.action !== 'baisse', 'sans plancher ⇒ aucune baisse (§3)', JSON.stringify(r6));
    let d = C.cycleAction({ plan: des, etat: null, item: it(10000, 3.1), plancherC: 5000, maintenant: T0 });
    dit(d.action === 'baisse' && d.vouluC === 9000, 'déstockage : après 3 j −10 %', JSON.stringify(d));
    d.etat.faits.push(0);
    d = C.cycleAction({ plan: des, etat: d.etat, item: it(9000, 3.1), plancherC: 5000, maintenant: T0 + 3 * J });
    dit(d.action === 'baisse' && d.vouluC === 8100, 'déstockage : encore −10 % 3 j plus tard', JSON.stringify(d));
    const dE = C.cycleAction({ plan: des, etat: Object.assign({}, d.etat, { item: '1', origineC: 10000 }), item: { id: '7777', prixC: 8000, misLe: T0 - 7.1 * J }, plancherC: 5000, maintenant: T0 });
    dit(dE.action === 'republier', 'déstockage : au plafond ⇒ republie tous les 7 j', JSON.stringify(dE));
    dit(C.creneauOuvert({ jours: [0, 1, 2, 3, 4, 5, 6], heureDebut: 0, heureFin: 24 }, T0) === true && C.creneauOuvert({ jours: [], heureDebut: 0, heureFin: 24 }, T0) === false, 'créneau : jours cochés et plage horaire (heure de Paris)');
    // Moteur.
    const cy = (ouvert) => monde({ main: { vinted_bleam: bleam({ cycle: { actif: true, strategie: 'anti', rythme: { jours: ouvert ? [0, 1, 2, 3, 4, 5, 6] : [], heureDebut: 0, heureFin: 24, prix: { min: 1, max: 1 }, repub: { min: 0, max: 0 } } } }), vinted_annonce_numeros: { 4242: { numero: '12', accountId: UID, min: 70 }, 4343: { numero: '13', accountId: UID, min: 70 } } },
      lignes: { [`harvest_${UID}_listings`]: { capturedAt: iso(T0 - 60000), payload: { items: [{ id: 4242, title: 'A', price: { amount: '100.0', currency_code: 'EUR' }, created_at_ts: Math.floor((T0 - 8 * J) / 1000) }, { id: 4343, title: 'B', price: { amount: '100.0', currency_code: 'EUR' }, created_at_ts: Math.floor((T0 - 8 * J) / 1000) }] } } } });
    const ferme = cy(false); await ferme.ctx.cycleVieTick('banc');
    const cmdsDe = (x) => Object.keys(x.lignes).filter((k) => /^cmd_prix_/.test(k)).map((k) => x.lignes[k]);
    dit(cmdsDe(ferme).length === 0, 'cycle : hors créneau ⇒ l’action prête attend, rien n’est déposé');
    const o2 = cy(true); await o2.ctx.cycleVieTick('banc'); await o2.ctx.chrome.storage.local.set({ vrmBleamProchain: {} }); await o2.ctx.cycleVieTick('banc');
    const cm = cmdsDe(o2);
    dit(cm.length === 1 && cm[0].prix === 90 && cm[0].source === 'regle' && cm[0].confirme === true, 'cycle : UNE baisse déposée (100 → 90), quota du jour (1) tenu au 2e passage', JSON.stringify(cm));
    const off = monde({}); const ro = await off.ctx.cycleVieTick('banc');
    dit(ro && ro.saute === 'eteint', 'cycle : éteint par défaut', JSON.stringify(ro));
  } catch (e) { dit(false, 'cycle — exception', e && e.stack); }

  // ── 5. FAVORIS ──────────────────────────────────────────────────────────────
  try {
    const C = monde({}).ctx;
    const F = C.bleamSection('favoris', { actif: true, noteMin: 4, parArticle: 2, reecrireJours: 1 });
    dit(C.favoriFiltre({ note: 3 }, F, {}, T0) === 'note' && C.favoriFiltre({}, F, {}, T0) === 'note' && C.favoriFiltre({ note: 4.5 }, F, {}, T0) === null, 'filtre : note sous 4 ⇒ écarté, sans note ⇒ écarté aussi');
    dit(C.favoriFiltre({ note: 5, item: '1' }, F, { parArticle: { 1: 2 } }, T0) === 'par-article', 'filtre : limite de messages par article');
    dit(C.favoriFiltre({ note: 5, acheteur: '77' }, F, { parAcheteur: { 77: T0 - 3 * H } }, T0) === 'reecrire' && C.favoriFiltre({ note: 5, acheteur: '77' }, F, { parAcheteur: { 77: T0 - 2 * J } }, T0) === null, 'filtre : même acheteur réécrit avant 1 j ⇒ attend');
    dit(C.favoriFiltre({ note: 1 }, C.bleamSection('favoris', {}), {}, T0) === null, 'filtres éteints par défaut');
    const a = C.analyseFavoris([{ c: '1', v: 1, t: T0 - J }, { c: '2', v: 1, t: T0 - J }, { c: '3', v: 2, t: T0 - J }, { c: '4', v: 2, t: T0 - J }],
      [{ cid: '1', opp: '9', msgs: [{ entity_type: 'message', entity: { user_id: 9 }, created_at_ts: (T0 - 1000) / 1000 }] }, { cid: '2', opp: '9', msgs: [] }, { cid: '3', opp: '8', msgs: [{ entity_type: 'message', entity: { user_id: 8 }, created_at_ts: (T0 - 2 * J) / 1000 }] }]);
    dit(a[0].version === 1 && a[0].taux === 50 && a[1].relues === 1 && a[1].reponses === 0 && a[1].envoyes === 2, 'analyse : taux de réponse par version (une réponse d’AVANT l’envoi ne compte pas ; pas relue ≠ pas de réponse)', JSON.stringify(a));
  } catch (e) { dit(false, 'favoris — exception', e && e.stack); }

  // ── 6. DRESSING AMÉLIORÉ ────────────────────────────────────────────────────
  try {
    const sender = { tab: { id: 7, url: 'https://www.vinted.fr/member/111' } };
    const d0 = monde({ main: { vinted_bleam: bleam({ dressing: { actif: true } }) } });
    const r0 = await d0.ctx.dressingPlus({ membre: '222' }, sender);
    dit(r0 && r0.actif === false, 'dressing d’un AUTRE profil ⇒ rien (ni plaque ni barre)', JSON.stringify(r0));
    const r1 = await monde({}).ctx.dressingPlus({ membre: UID }, sender);
    dit(r1 && r1.actif === false, 'dressing amélioré éteint par défaut', JSON.stringify(r1));
    const r2 = await d0.ctx.dressingPlus({ membre: UID }, sender);
    dit(r2 && r2.actif === true && r2.uid === UID, 'dressing du compte de l’onglet, allumé ⇒ actif', JSON.stringify(r2));
    const r3 = await d0.ctx.dressingAction({ membre: UID, quoi: 'supprimer', ids: ['4242'] }, sender);
    dit(r3 && r3.ok === false && r3.code === 'confirmation' && ecrits(d0).length === 0, 'Supprimer sans SA confirmation ⇒ rien ne part', JSON.stringify(r3));
  } catch (e) { dit(false, 'dressing — exception', e && e.stack); }

  // ── 7. RÔLE DES COMPTES (app) : un compte PERSONNEL est hors des totaux déclarés, comme un compte écarté ──
  try {
    const R = await import(require('url').pathToFileURL(path.join(__dirname, '..', 'src', 'rolesComptes.js')).href);
    const h = R.comptesHorsTotaux(['111'], { 222: 'perso', 333: 'achats', x: 'perso' });
    dit(h.has('111') && h.has('222') && !h.has('333') && h.size === 2, 'compte personnel ⇒ hors des totaux déclarés (avec les écartés) ; compte d’achats ⇒ compté', JSON.stringify([...h]));
    dit(R.roleCompte({}, '444') === 'vente' && R.roleCompte({ 444: 'bizarre' }, '444') === 'vente', 'rôle absent ou illisible ⇒ « vente » (rien n’est retiré des totaux sans SON choix)');
    const v = R.avecRole({ 1: 'perso' }, '2', 'achats'); const v2 = R.avecRole(v, '1', 'vente');
    dit(v[1] === 'perso' && v[2] === 'achats' && !('1' in v2), 'SON choix ne touche que CE compte ; « vente » retire la clé');
    const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
    dit(/const venteOffDeclareOf = \(o\) => venteOffOf\(o\) \|\| comptePersoOf\(o\);/.test(app) && (app.match(/ventesDeclarables\(\{[^\n]*exclu: venteOffDeclareOf/g) || []).length === 2, 'le CA déclaré de l’app écarte les comptes personnels (les deux appels)');
  } catch (e) { dit(false, 'rôles — exception', e && e.stack); }

  console.log(`\n${ko ? '❌' : '✅'} audit-bleam-suite : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
