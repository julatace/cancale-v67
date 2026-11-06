// ════════════════════════════════════════════════════════════════════════════
//  LE MONDE DES FILMS — un revendeur INVENTÉ, servi sous la vraie forme.
//  Rien ici ne vient de la base de Julien (dépôt public ; et « on retrouverait
//  ses comptes ») : pseudos, adresses, codes, montants sont fabriqués. Les noms
//  de modèles de baskets ne sont que du texte d'annonce.
//  Les formes (clés `app_data`, statuts Vinted, `payload`) sont celles que les
//  bancs servent déjà : nouveau-vendeur, _scenario-colis, plateformes-logo,
//  stock-2d, compta-stats-coherence, retrait-carte.
//  Une seule horloge : 6 novembre 2026, 9 h 41 (l'heure de la barre d'état).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const BORDEREAU_PDF = require('./_bordereau.cjs').bordereauB64();
const MAINTENANT = '2026-11-06T09:41:00+01:00';
const T0 = Date.parse(MAINTENANT);
const H = 3600e3, J = 24 * H;
const iso = (ms) => new Date(ms).toISOString();
const ilYaJ = (j) => iso(T0 - j * J);
const ilYaH = (h) => iso(T0 - h * H);
const ts = (j) => Math.floor((T0 - j * J) / 1000);
const UID = '5f1e0c55-2b1d-4c3e-9f00-00000000f11a';

const STATUT_RELAIS = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const STATUT_AEXP = 'Le paiement a été validé';
const STATUT_BORD = 'Bordereau envoyé au vendeur';
const STATUT_ROUTE = "Colis en cours d'acheminement";
const STATUT_FINAL = 'Commande finalisée';

const COMPTES = [
  { id: 1, vinted_user_id: '4101', login: 'atelier.basket', domain: 'www.vinted.fr' },
  { id: 2, vinted_user_id: '4102', login: 'paires_du_dimanche', domain: 'www.vinted.fr' },
  { id: 3, vinted_user_id: '4103', login: 'semelle.club', domain: 'www.vinted.fr' },
].map((c, i) => ({ ...c, updated_at: ilYaH(0.2 + i * 0.1), created_at: ilYaJ(200 - i * 40) }));
const U = COMPTES.map((c) => c.vinted_user_id);

// Le catalogue : [titre, marque, taille, prix, photo (silhouette_teinte)].
const CATALOGUE = [
  ['Nike Air Max 90 blanche', 'Nike', 42, 85, 'course_blanc'],
  ['Adidas Samba OG noire', 'Adidas', 41, 78, 'basse_noir'],
  ['New Balance 550 crème', 'New Balance', 43, 92, 'basse_creme'],
  ['Asics Gel-1130 argent', 'Asics', 42, 74, 'course_argent'],
  ['Salomon XT-6 grise', 'Salomon', 44, 120, 'course_gris'],
  ['Nike Dunk Low verte', 'Nike', 40, 95, 'basse_vert'],
  ['Puma Suede rouge', 'Puma', 42, 48, 'basse_rouge'],
  ['Converse Chuck 70 noire', 'Converse', 41, 55, 'montante_noir'],
  ['Reebok Club C blanche', 'Reebok', 42, 45, 'basse_blanc'],
  ['New Balance 2002R grise', 'New Balance', 44, 105, 'course_gris'],
  ['Adidas Gazelle bleue', 'Adidas', 40, 62, 'basse_bleu'],
  ['Nike Blazer Mid blanche', 'Nike', 42, 58, 'montante_blanc'],
  ['Asics Gel-Kayano 14 argent', 'Asics', 43, 110, 'course_argent'],
  ['Jordan 1 Mid rouge', 'Jordan', 42, 115, 'montante_rouge'],
  ['Vans Old Skool noire', 'Vans', 43, 42, 'basse_noir'],
  ['New Balance 990v5 sable', 'New Balance', 42, 130, 'course_sable'],
  ['Adidas Spezial bleue', 'Adidas', 42, 70, 'basse_bleu'],
  ['Nike Cortez blanche', 'Nike', 39, 55, 'basse_blanc'],
  ['Onitsuka Mexico 66 crème', 'Onitsuka Tiger', 41, 68, 'basse_creme'],
  ['Hoka Clifton 9 grise', 'Hoka', 43, 82, 'course_gris'],
  ['Nike Air Force 1 blanche', 'Nike', 44, 65, 'basse_blanc'],
  ['Veja V-10 rose', 'Veja', 38, 72, 'basse_rose'],
  ['Asics Japan S blanche', 'Asics', 40, 44, 'basse_blanc'],
  ['New Balance 530 argent', 'New Balance', 41, 76, 'course_argent'],
  ['Adidas Campus 00s grise', 'Adidas', 42, 69, 'basse_gris'],
  ['Nike P-6000 argent', 'Nike', 43, 88, 'course_argent'],
  ['Salomon Speedcross noire', 'Salomon', 42, 79, 'course_noir'],
  ['Puma Palermo verte', 'Puma', 41, 60, 'basse_vert'],
];
// Une adresse PAR ANNONCE (deux fiches au même fichier seraient la même paire, §5).
const PHOTO = (cle, vue = 1, id = 'x') => `https://images1.vinted.net/t/${id}/${cle}_${vue}.jpg`;
const achatDe = (prix) => Math.round(prix * 0.52 / 5) * 5;

function monde() {
  const lignes = [];
  const num = {};               // vinted_annonce_numeros
  const details = {};           // vinted_item_details
  const parCompte = { [U[0]]: [], [U[1]]: [], [U[2]]: [] };
  // Les annonces EN LIGNE : N° 1 à 22 (les autres sont vendues, plus bas).
  const annonce = (i, id, compte, n) => {
    const [titre, marque, taille, prix, ph] = CATALOGUE[i];
    const t = `${titre} T${taille}`;
    num[id] = { numero: String(n), title: t, price: prix, buyPrice: achatDe(prix), photo: PHOTO(ph, 1, id), numberedAt: ilYaJ(1 + i * 0.75), accountId: compte };
    details[id] = { description: 'Très bon état, portées quelques fois. Envoi soigné sous 24 h.', photos: [PHOTO(ph, 1, id), PHOTO(ph, 2, id), PHOTO(ph, 3, id)] };
    return { id: Number(id), title: t, price: { amount: prix.toFixed(1), currency_code: 'EUR' }, brand_title: marque, size_title: String(taille), status: i % 3 ? 'Très bon état' : 'Neuf sans étiquette',
      is_closed: false, is_hidden: false, is_draft: false, photo: { url: PHOTO(ph, 1, id), thumbnails: [{ type: 'thumb310x430', url: PHOTO(ph, 1, id) }] }, photos: [{ url: PHOTO(ph, 1, id) }],
      view_count: 30 + ((i * 37) % 160), favourite_count: (i * 7) % 13, created_at_ts: ts(2 + i * 1.5) };
  };
  const enLigne = [];
  for (let i = 0; i < 22; i++) {
    const compte = U[i % 3], id = String(7100 + i);
    const a = annonce(i, id, compte, i + 1);
    parCompte[compte].push(a); enLigne.push(a);
  }
  // Les ventes. Deux à expédier ce matin (bordereaux prêts), trois en route, et
  // un mois d'octobre complet (finalisées et versées) pour la Compta.
  const ventes = { [U[0]]: [], [U[1]]: [], [U[2]]: [] };
  const txns = [];
  const vente = ({ tx, i, compte, statut, tus, jours, n, item, code = 230, verse = null }) => {
    const [titre, , taille, prix, ph] = CATALOGUE[i];
    const t = `${titre} T${taille}`;
    if (item && !num[item]) { num[item] = { numero: String(n), title: t, price: prix, buyPrice: achatDe(prix), photo: PHOTO(ph, 1, item), numberedAt: ilYaJ(Math.min(jours + 1.5, 18.2)), accountId: compte }; }
    const o = { transaction_id: tx, id: tx, title: t, price: { amount: prix.toFixed(2), currency_code: 'EUR' }, status: statut, date: ilYaJ(jours), photo: { url: PHOTO(ph, 1, item) } };
    // La transaction lue (preuve de vente et identité : son item_id).
    txns.push({ id: `harvest_${compte}_txn_${tx}`, data: { capturedAt: ilYaH(1), payload: { transaction: { id: tx, item_id: Number(item), status: verse != null ? 450 : code, status_title: statut, status_updated_at: ilYaJ(verse != null ? verse : jours) } } } });
    if (tus) o.transaction_user_status = tus;
    if (item) o.item_id = String(item);
    ventes[compte].push(o);
    return o;
  };
  // À expédier : N°23 et N°24 (vendues cette nuit).
  vente({ tx: 81001, i: 22, compte: U[0], statut: STATUT_BORD, tus: 'needs_action', jours: 0.35, n: 23, item: '7122' });
  vente({ tx: 81002, i: 23, compte: U[1], statut: STATUT_AEXP, tus: 'needs_action', jours: 0.6, n: 24, item: '7123' });
  // En route.
  vente({ tx: 81003, i: 24, compte: U[0], statut: STATUT_ROUTE, tus: 'waiting', jours: 2, n: 25, item: '7124', code: 320 });
  vente({ tx: 81004, i: 25, compte: U[2], statut: STATUT_ROUTE, tus: 'waiting', jours: 3, n: 26, item: '7125', code: 320 });
  vente({ tx: 81005, i: 26, compte: U[1], statut: STATUT_ROUTE, tus: 'waiting', jours: 2.5, n: 27, item: '7126', code: 320 });
  // Octobre : finalisées, versées en octobre (date de versement = transaction 450).
  const OCT = [[4, 0], [6, 1], [9, 2], [11, 0], [13, 1], [15, 0], [17, 2], [19, 1], [21, 0], [23, 2], [25, 0], [27, 1], [29, 2], [31, 0], [33, 1]];
  OCT.forEach(([j, c], k) => {
    const i = (k * 5 + 3) % CATALOGUE.length, tx = 80100 + k;
    // Vendue entre le 20 et le 30 octobre (après la panne des numéros du 11 au 18), versée en octobre.
    const jours = 7 + j * 0.31;
    const verse = Math.max(6.6, jours - 2.5);
    vente({ tx, i, compte: U[c], statut: STATUT_FINAL, tus: 'completed', jours, n: 28 + k, item: String(7200 + k), verse });
  });
  // Début novembre : deux finalisées, versées.
  [[2.2, 0, 12], [4.5, 2, 16]].forEach(([jours, c, i], k) => {
    const tx = 80200 + k;
    vente({ tx, i, compte: U[c], statut: STATUT_FINAL, tus: 'completed', jours, n: 43 + k, item: String(7300 + k), verse: jours - 1.5 });
  });
  // Les achats : deux au point relais (codes lus), deux en route.
  const achats = [
    { transaction_id: 92001, conversation_id: 93001, title: 'Nike Air Max 1 blanche T42', price: { amount: '38.00', currency_code: 'EUR' }, status: STATUT_RELAIS, transaction_user_status: 'needs_action', date: ilYaJ(4), photo: { url: PHOTO('course_blanc', 2, 'a1') } },
    { transaction_id: 92002, conversation_id: 93002, title: 'Adidas Handball Spezial T41', price: { amount: '41.00', currency_code: 'EUR' }, status: STATUT_RELAIS, transaction_user_status: 'needs_action', date: ilYaJ(3), photo: { url: PHOTO('basse_vert', 2, 'a2') } },
    { transaction_id: 92003, conversation_id: 93003, title: 'New Balance 1906R argent T43', price: { amount: '55.00', currency_code: 'EUR' }, status: 'Le vendeur a expédié la commande', transaction_user_status: 'waiting', date: ilYaJ(2), photo: { url: PHOTO('course_argent', 2, 'a3') } },
    { transaction_id: 92004, conversation_id: 93004, title: 'Asics GT-2160 grise T42', price: { amount: '47.00', currency_code: 'EUR' }, status: 'Le vendeur a expédié la commande', transaction_user_status: 'waiting', date: ilYaJ(1), photo: { url: PHOTO('course_gris', 2, 'a4') } },
  ];
  const dateLimite = (j) => new Date(T0 + j * J).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) + ' 23 h 59';
  // Les meubles du Stock (2D) et les cases : N°1 à 12 rangés.
  const meubles = [
    { id: 'm1', name: 'Couloir', cols: 4, rows: 3, planches: [1, 2] },
    { id: 'm2', name: 'Entrée', cols: 3, rows: 2, planches: [1] },
  ];
  const slots = {};
  for (let n = 1; n <= 12; n++) slots[String(n)] = { m: 'm1', i: n - 1 };
  [13, 14, 15, 23].forEach((n, k) => { slots[String(n)] = { m: 'm2', i: k }; });
  slots['24'] = { m: 'm1', i: 11 }; delete slots['12'];

  lignes.push({ id: 'main', data: {
    vinted_dark: false, vinted_accounts_hidden: [], vinted_pickup_done: {}, vinted_ship_done: {},
    vrm_colis_collected: [], vrm_colis_collected_at: {},
    vinted_annonce_numeros: num, vinted_used_numeros: Array.from({ length: 44 }, (_, k) => k + 1),
    vrm_meubles: meubles, vrm_slots: slots,
    vinted_regime: 'micro', vinted_urssaf_freq: 'mensuel', vrm_urssaf_declare: {},
    vrm_bienvenue_vue: { at: ilYaJ(60) }, vrm_visite_vue: { at: ilYaJ(60) },
  } });
  for (const u of U) {
    lignes.push({ id: `harvest_${u}_listings`, data: { capturedAt: ilYaH(0.15), nItems: parCompte[u].length, payload: { items: parCompte[u], pagination: null } } });
    lignes.push({ id: `harvest_${u}_orders_sold`, data: { capturedAt: ilYaH(0.15), payload: { my_orders: ventes[u] } } });
  }
  lignes.push({ id: `harvest_${U[0]}_orders_purchased`, data: { capturedAt: ilYaH(0.15), payload: { my_orders: achats } } });
  lignes.push(...txns);
  lignes.push({ id: 'vinted_item_details', data: details });
  // Les bordereaux reçus par e-mail (prêts à imprimer).
  for (const [tx, compte, titre, j] of [[81001, 'atelier.basket', 'Asics Japan S blanche T40', 2], [81002, 'paires_du_dimanche', 'New Balance 530 argent T41', 3]]) {
    lignes.push({ id: `email_bord_${tx}`, data: { transaction: String(tx), filename: `bordereau-${tx}.pdf`, pdfB64: BORDEREAU_PDF, suivi: String(61840000 + tx % 1000 * 7), modele: titre, account: compte, receivedAt: ilYaH(6), dateLimite: dateLimite(j), type: 'vinted', transporteur: 'mondialrelay' } });
  }
  // Les codes de retrait (lus dans les conversations par l'extension).
  lignes.push({ id: 'panel_colis_relais', data: {
    92001: { code: '480215', lieu: 'Relais du Marché, 14 rue des Halles, 35000 Rennes', transporteur: 'mondialrelay', at: ilYaH(20), url: 'https://www.vinted.fr/inbox/93001' },
    92002: { code: '731904', lieu: 'Tabac Presse Saint-Hélier, 61 rue Saint-Hélier, 35000 Rennes', transporteur: 'relaiscolis', at: ilYaH(30), url: 'https://www.vinted.fr/inbox/93002' },
  } });
  // Un colis Mondial Relay hors Vinted (e-mail du transporteur), au même point.
  lignes.push({ id: 'email_track_mondialrelay_57203318', data: { carrier: 'mondialrelay', status: 'disponible', suivi: '57203318', code: '259036', lieu: 'Relais du Marché\n14 rue des Halles\n35000 Rennes', subject: 'Votre colis est disponible', receivedAt: ilYaH(26), arriveLe: ilYaH(26), dateLimite: iso(T0 + 6 * J) } });
  // Le porte-monnaie.
  lignes.push({ id: `harvest_${U[0]}_billing`, data: { capturedAt: ilYaH(0.15), payload: { user_balance: { available_amount: { amount: '186.40' }, escrow_amount: { amount: '233.00' } } } } });
  // Messages.
  const conv = (id, login, desc, unread, h) => ({ id, unread, updated_at: ilYaH(h), description: desc, opposite_user: { id: 6000 + id, login } });
  lignes.push({ id: `harvest_${U[0]}_inbox`, data: { capturedAt: ilYaH(0.15), payload: { conversations: [conv(501, 'lucie_r', 'Bonjour, vous feriez 70 € ?', true, 0.6), conv(502, 'tom.vintage', 'Super, bien reçues, merci !', false, 20)] } } });
  lignes.push({ id: `harvest_${U[1]}_inbox`, data: { capturedAt: ilYaH(0.2), payload: { conversations: [conv(601, 'maxime_44', 'Elle taille normalement ?', true, 1.4)] } } });
  // Leboncoin.
  const LBC = '6b1c0a00-0000-4000-8000-0000000001bc';
  lignes.push({ id: 'lbc_accounts', data: { accounts: { ['lbc-account:' + LBC]: { id: 'lbc-account:' + LBC, name: 'Atelier Basket', type: 'particulier', sessionAt: ilYaH(3) } }, updatedAt: ilYaH(1) } });
  lignes.push({ id: 'lbc_listings', data: { items: {
    3100000101: { id: '3100000101', ref: '3', customRef: 'VRM-3', subject: 'New Balance 550 crème T43', status: 'active', account: LBC, seenAt: ilYaH(3), price: 90 },
    3100000102: { id: '3100000102', ref: '5', customRef: 'VRM-5', subject: 'Salomon XT-6 grise T44', status: 'active', account: LBC, seenAt: ilYaH(3), price: 118 },
  }, lectures: { [LBC]: { at: ilYaH(3), total: 2, n: 2 } } } });
  lignes.push({ id: 'lbc_ventes', data: { maj: ilYaH(3), ventes: {
    L1: { txId: 'L1', isSeller: true, price: 6400, dateVente: ilYaJ(12), parcelColor: 'finished', account: LBC, title: 'Adidas Samba OG blanche T42', at: ilYaJ(12) },
    L2: { txId: 'L2', isSeller: true, price: 8800, dateVente: ilYaJ(19), parcelColor: 'finished', account: LBC, title: 'Nike Air Max 95 grise T43', at: ilYaJ(19) },
  } } });
  // eBay.
  const K1 = 'e1b2c3d4e5f60001';
  const cmd = (orderId, titre, total, frais, j) => ({ orderId, orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'FULFILLED', creationDate: ilYaJ(j), cancelStatus: { cancelState: 'NONE_REQUESTED' }, lineItems: [{ sku: '', title: titre }],
    pricingSummary: { total: { value: (total + 6.5).toFixed(2), currency: 'EUR' }, priceSubtotal: { value: total.toFixed(2), currency: 'EUR' } }, paymentSummary: { totalDueSeller: { value: total.toFixed(2), currency: 'EUR' }, payments: [{ paymentStatus: 'PAID' }] }, totalMarketplaceFee: { value: frais.toFixed(2), currency: 'EUR' } });
  lignes.push({ id: 'ebay_comptes', data: { comptes: [{ cle: K1, pseudo: 'atelier-basket-fr', principal: true, ajouteLe: 1 }] } });
  lignes.push({ id: 'ebay_listings', data: { items: [], capturedAt: T0 - H } });
  lignes.push({ id: 'ebay_orders', data: { capturedAt: T0 - H, orders: [cmd('14-0381-22017', 'Nike Air Max Plus noire T42', 120, 11.4, 9), cmd('14-0381-22988', 'Asics Gel-Lyte III crème T41', 84, 8.1, 16)] } });
  // Vestiaire Collective.
  lignes.push({ id: 'vc_listings', data: { capturedAt: ilYaH(4), complet: true, liens: { 71000016: '16' }, items: { 71000016: { titre: 'New Balance 990v5 sable', statut: 'published', vuAt: ilYaH(4), prix: { valeur: 135, devise: 'EUR', cle: 'price' } } } } });
  lignes.push({ id: 'vc_ventes', data: { lectures: { ventes: { at: ilYaH(4) } }, ventes: { V1: { productId: '71000044', compte: '8812001', aExpedier: false, date: ilYaJ(40), titre: 'Nike Dunk Low grise T42', prix: { valeur: 110, devise: 'EUR' }, montant: { valeur: 92.4, devise: 'EUR', cle: 'payout' }, verseLe: ilYaJ(33), etat: '', etapesVc: { sellerSale: 'done', sellerShipment: 'done', sellerConformity: 'done', sellerDelivery: 'done', sellerPayment: 'done' } } } } });
  lignes.push({ id: 'panel_comptes_etat', data: { comptes: Object.fromEntries(U.map((u) => [u, { etat: 'actif', at: ilYaH(1) }])) } });
  for (const r of lignes) r.updated_at = ilYaH(0.1);
  return { maintenant: MAINTENANT, uid: UID, email: 'demo@vrm.center', jeton: 'jeton-film-demo', lignes, comptes: COMPTES };
}

module.exports = { monde, MAINTENANT, T0, UID, COMPTES, CATALOGUE, PHOTO };
