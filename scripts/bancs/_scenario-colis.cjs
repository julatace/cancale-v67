// ── SCÉNARIO SYNTHÉTIQUE « COLIS / RELAIS » (#3 fixtures de scénario) ─────────
// Les `fx/` (copie de SA base) sont gitignorés : les bancs de la famille colis
// mouraient en ENOENT PARTOUT sauf chez Julien, et leurs contrôles vivent sur
// une SITUATION précise (un colis au relais, un bordereau prêt, un colis oublié
// avec son QR) qu'un secours minimal ne porte pas. Ce helper fabrique cette
// situation À LA FORME et aux STATUTS que l'app lit vraiment — mesurés dans
// src/App.jsx (`aExpedier`, `isAtRelayStatus`, `needsBordereau`, `labelsCaptes`,
// `emailBords`/`hasPdf`, `vinted_ship_done`, `panel_colis_relais`) — sans aucune
// donnée réelle : titres de baskets génériques, identifiants inventés. Elle vit
// donc dans le dépôt (public) et les bancs tournent PARTOUT. Sur SA machine
// (fx/ présent) ces builders ne sont pas appelés : on lit la vraie base.
//
// ⚠️ CE N'EST PAS UN VERT-À-VIDE : les statuts sont EXACTEMENT ceux qui
// déclenchent chaque bloc de l'app (vérifiés ligne à ligne). Un banc converti
// reste rouge-avant (§6.1) parce que le CORRECTIF — ici le chargeur fx tolérant
// qui laisse le scénario se monter — n'existe pas sur le code d'avant : sans
// lui, le require du fichier fx/ lève et rien ne se rend.
const fs = require('fs'), path = require('path');

// Deux comptes liés, capturés à l'instant (jamais « pas encore capté »).
const NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const UID = ['820001', '820002'];
function comptes() {
  return UID.map((u, i) => ({
    vinted_user_id: u, login: i ? 'boutique_sud' : 'boutique_nord',
    domain: 'www.vinted.fr', updated_at: iso(NOW),
    created_at: iso(NOW - 600 * 3600e3),
  }));
}
// UUID de conversation déterministe (même forme que Vinted : 232/236 des achats
// finalisés portent un conversation_id en UUID — le banc retrait l'exige entier).
const uuid = (n) => `820000${String(n).padStart(2, '0')}-0000-4000-8000-00000000c01i`.replace('c01i', String(1000 + n));

// Les statuts EXACTS que l'app reconnaît.
const STATUT_RELAIS = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais"; // isAtRelayStatus ✓
const STATUT_AEXP = 'Le paiement a été validé';     // aExpedier ✓ (needs_action) + colis.aEnvoyer ✓
const STATUT_FINAL = 'Commande finalisée';          // classifyOrderStatus → completed
const STATUT_NONRECL = "Commande non réclamée - Retournée à l'expéditeur.rice";

// Un objet `my_orders` (achat OU vente) à la forme de Vinted.
function ordre({ tx, conv, titre, prix, dateMs, statut, tus }) {
  const o = {
    transaction_id: String(tx), title: titre,
    price: { amount: Number(prix).toFixed(2), currency_code: 'EUR' },
    status: statut, date: iso(dateMs == null ? NOW - 2 * 86400e3 : dateMs),
  };
  if (conv != null) o.conversation_id = String(conv);
  if (tus) o.transaction_user_status = tus;
  return o;
}
const lignePurch = (uid, orders) => ({ id: `harvest_${uid}_orders_purchased`, data: { payload: { my_orders: orders } } });
const ligneSold = (uid, orders) => ({ id: `harvest_${uid}_orders_sold`, data: { payload: { my_orders: orders } } });

// La ligne de réglages `main`. Par défaut rien n'est coché ni masqué.
function ligneMain(extra = {}) {
  return [{ id: 'main', data: Object.assign({
    vinted_dark: false, vinted_accounts_hidden: [],
    vinted_pickup_done: {}, vinted_ship_done: {},
    vrm_colis_collected: [], vrm_colis_collected_at: {},
  }, extra) }];
}

// Un bordereau reçu par email : `filename` est le TÉMOIN d'un PDF (l'app ne
// télécharge pas les octets pour savoir qu'il est prêt). `pdfB64` est présent
// pour que le contrôle d'égress soit non-vacant (une régression `select=data`
// le ferait voyager).
function bordereau({ tx, suivi }) {
  return { id: `email_bord_${tx}`, data: {
    transaction: String(tx), filename: `bordereau_${tx}.pdf`,
    suivi: suivi || `TRK${tx}`, receivedAt: iso(NOW - 3 * 3600e3),
    pdfB64: 'JVBERi0xLjQKJ'.repeat(40),
  } };
}
// Le « dernier bordereau capté » d'un compte (sert le bandeau « tamponner en
// 1 clic » de Colis). Les deux lignes partent AVEC leur PDF : colis.cjs choisit
// laquelle garder/vider pour prouver le filtre `data->>pdfB64=not.is.null`.
function labelLatest(uid, { tx, item } = {}) {
  return { id: `harvest_${uid}_label_latest`, data: {
    pdfB64: 'JVBERi0xLjQK', capturedAt: iso(NOW - 20 * 60000),
    tx: String(tx || ''), item: String(item || ''),
  } };
}
// Un email de suivi « colis disponible », vieux, avec son code et/ou son QR —
// la matière du bloc « à vérifier / jamais retirés » (oublies.cjs).
function trackColis({ n, code, qr, ageJ = 30 }) {
  const d = {
    status: 'available', sens: 'entrant',
    subject: 'Ton colis est arrivé en point relais',
    suivi: `SUIVI${n}`, receivedAt: iso(NOW - ageJ * 86400e3),
  };
  if (code) d.code = code;
  if (qr) d.qrUrl = `https://pickup.example/api/barcode/datamatrix/${n}`; // QR_CERTAIN ✓
  return { id: `email_track_relais_${n}`, data: d };
}
// La ligne DÉDIÉE des codes lus en conversation, indexée par transaction_id.
const panelRelais = (map) => ({ id: 'panel_colis_relais', data: map || {} });

// fx/ présent ? (sur SA machine on lit la vraie base, ces builders dorment.)
const present = (SC) => fs.existsSync(path.join(SC, 'fx', 'accounts.json'));

module.exports = {
  present, comptes, ligneMain, ordre, lignePurch, ligneSold,
  bordereau, labelLatest, trackColis, panelRelais, uuid, UID,
  STATUT_RELAIS, STATUT_AEXP, STATUT_FINAL, STATUT_NONRECL, iso, NOW,
};
