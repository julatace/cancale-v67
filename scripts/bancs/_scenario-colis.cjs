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
function ordre({ tx, conv, titre, prix, dateMs, statut, tus, item }) {
  const o = {
    transaction_id: String(tx), title: titre,
    price: { amount: Number(prix).toFixed(2), currency_code: 'EUR' },
    status: statut, date: iso(dateMs == null ? NOW - 2 * 86400e3 : dateMs),
  };
  if (conv != null) o.conversation_id = String(conv);
  if (tus) o.transaction_user_status = tus;
  if (item != null) o.item_id = String(item);   // relie la vente à une annonce numérotée (identiteAnnonce)
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
// L'état actif/banni que l'extension (5.181) lit dans le profil Vinted
// (`panel_comptes_etat.comptes[uid] = {etat, at}`). Sans lui, un compte reste
// « État non vérifié » et ne compte ni actif ni banni.
const panelComptesEtat = (uids, etat = 'actif') => ({ id: 'panel_comptes_etat',
  data: { comptes: Object.fromEntries((uids || []).map((u) => [String(u), { etat, at: iso(NOW - 3600e3) }])) } });

// Une annonce EN LIGNE du dressing (forme `payload.items` de Vinted).
function annonce({ id, titre, prix, taille, marque }) {
  return {
    id: String(id), title: titre || 'Nike Air Force 1', brand_title: marque || 'Nike',
    size_title: taille == null ? '42' : String(taille),
    price: { amount: Number(prix == null ? 45 : prix).toFixed(2), currency_code: 'EUR' },
    is_closed: false, is_hidden: false, is_draft: false, photo: { url: '' },
  };
}
// La ligne `harvest_{uid}_listings`, DATÉE à l'instant (dressingsDuJour la lit
// « il y a 1 min » → la règle « en ligne ≤ 24 h » passe).
const ligneListings = (uid, items) => ({ id: `harvest_${uid}_listings`, data: { capturedAt: iso(NOW), payload: { items, pagination: null } } });

// ── SCÉNARIO « PRIX D'ACHAT » (serie, prixachat) ────────────────────────────
// 60 paires numérotées SANS prix d'achat + leurs achats, pour exercer le moteur
// de suggestion (§5.23, `scoreAchatPrep`). Marque+4, taille+4, titre exact+6 :
// 18 achats au titre IDENTIQUE → score ≥12 → « C'est ça » ; 42 achats « {marque}
// baskets {taille} » (même marque+taille, pas de modèle/couleur, moins cher) →
// score 6 → « à vérifier ». Marque×taille uniques sur les 60 → aucune collision
// (une taille qui diffère = −10 → jamais candidat). Ce n'est PAS une fiction du
// jugement : les achats ressemblent VRAIMENT aux paires, le barème fait son
// travail — c'est ce que l'agent SKIP attendait comme fixtures ciblées.
function achatsScenario() {
  const BRANDS = ['Nike', 'Adidas', 'Puma', 'New Balance', 'Asics', 'Reebok'];
  const MODELS = ['Air Force', 'Gazelle', 'Suede', '550', 'Gel Lyte', 'Club C'];
  const COLORS = ['rouge', 'bleu', 'noir', 'blanc', 'gris'];
  const paires = [], achats = [], soldOrders = [], num = {};
  for (let i = 0; i < 60; i++) {
    const brand = BRANDS[i % 6], model = MODELS[i % 6], size = 36 + Math.floor(i / 6), color = COLORS[i % 5];
    const id = 'pa' + i, titre = `${brand} ${model} ${color} ${size}`;
    paires.push(annonce({ id, titre, prix: 60 + (i % 10), taille: size, marque: brand }));
    // ⚠️ L'entrée `vinted_annonce_numeros` PORTE le titre et le prix : c'est elle
    // que le barème lit (`refAchat({title:e.title, price:e.price})`), pas
    // l'annonce. Sans eux, la référence est vide → aucune suggestion.
    num[id] = { numero: String(i + 1), title: titre, price: 60 + (i % 10) };
    if (i % 10 < 3) achats.push(ordre({ tx: 'ac' + i, titre, prix: 50, statut: STATUT_FINAL, dateMs: NOW - 30 * 86400e3 }));      // fort : titre identique → « C'est ça »
    else achats.push(ordre({ tx: 'ac' + i, titre: `${brand} baskets ${size}`, prix: 40, statut: STATUT_FINAL, dateMs: NOW - 30 * 86400e3 })); // faible : marque+taille → « à vérifier »
    // Les 20 premières sont AUSSI vendues (identité item_id → la paire), pour que
    // l'écran Ventes ait du contenu et sa case « Bénéfice/Coût d'achat ».
    if (i < 20) { const o = ordre({ tx: 've' + i, titre, prix: 60 + (i % 10), statut: STATUT_FINAL, dateMs: NOW - 10 * 86400e3 }); o.item_id = id; soldOrders.push(o); }
  }
  return {
    accounts: comptes(), main: ligneMain({ vinted_annonce_numeros: num }),
    listings: [ligneListings(UID[0], paires)], purch: [lignePurch(UID[0], achats)],
    sold: [ligneSold(UID[0], soldOrders)],
  };
}

// Une conversation moissonnée (`harvest_{uid}_conv_{cid}`), à la forme profonde
// que lit la messagerie (`payload.conversation.transaction/opposite_user/messages`).
function ligneConv({ uid, cid, titre, oppId, oppLogin, itemId }) {
  return { id: `harvest_${uid}_conv_${cid}`, data: { payload: { conversation: {
    id: String(cid),
    transaction: { id: String(cid), item_id: String(itemId || ''), status: 1, item_title: titre, current_user_side: 'buyer', item_photo: { url: '' } },
    opposite_user: { id: String(oppId), login: oppLogin },
    messages: [{ entity: { user_id: String(oppId) }, created_at_ts: iso(NOW - 2 * 3600e3), body: 'Bonjour, est-ce encore disponible ?' }],
    allow_reply: true, unread: true,
  } } } };
}

// ── SCÉNARIO « COQUE » (feuilles-coque) : une base RICHE et cohérente ─────────
// Le banc des feuilles (layout/empilement) ouvre 14 feuilles de tout l'app : il
// lui faut des annonces en ligne numérotées (⋯ Outils, Gérer l'annonce), des
// ventes dont UNE en LOT de 2 articles (tiroir + « Paires du lot »), des
// bordereaux prêts (« Tout imprimer »), une conversation (Messages) et des
// comptes (Réglages). Tout synthétique, aux formes mesurées — vit dans le dépôt.
function coqueScenario() {
  const U = UID[0], BR = ['Nike', 'Adidas', 'Puma', 'New Balance'];
  const ann = [], num = {};
  for (let i = 0; i < 8; i++) {
    const id = 'an' + i, titre = `${BR[i % 4]} modèle ${i} ${34 + i}`;
    ann.push(annonce({ id, titre, prix: 50 + i, taille: 34 + i, marque: BR[i % 4] }));
    num[id] = { numero: String(i + 1), title: titre, price: 50 + i };
  }
  const sold = [
    ordre({ tx: '70001', titre: 'Lot 2 articles Nike + Adidas', prix: 90, statut: STATUT_FINAL, dateMs: NOW - 10 * 86400e3 }),
    ordre({ tx: '70002', titre: 'Nike Air Max finalisée',  prix: 40, statut: STATUT_FINAL, dateMs: NOW - 12 * 86400e3 }),
    ordre({ tx: '70003', titre: 'Adidas Samba finalisée',  prix: 45, statut: STATUT_FINAL, dateMs: NOW - 14 * 86400e3 }),
    ordre({ tx: '70004', titre: 'Puma Suede finalisée',    prix: 38, statut: STATUT_FINAL, dateMs: NOW - 16 * 86400e3 }),
    ordre({ tx: '70010', titre: 'Reebok Club à expédier',  prix: 42, statut: STATUT_AEXP, tus: 'needs_action', dateMs: NOW - 2 * 86400e3, item: 'an4' }),
    ordre({ tx: '70011', titre: 'Asics Gel à expédier',    prix: 44, statut: STATUT_AEXP, tus: 'needs_action', dateMs: NOW - 3 * 86400e3, item: 'an5' }),
  ];
  // Quelques achats (section Achats « Tous » → carte → ⋯ → « note interne »).
  const achats = [
    ordre({ tx: '80001', conv: uuid(31), titre: 'Nike Air Max achetée', prix: 28, statut: STATUT_FINAL, dateMs: NOW - 20 * 86400e3 }),
    ordre({ tx: '80002', conv: uuid(32), titre: 'Adidas Gazelle achetée', prix: 22, statut: STATUT_FINAL, dateMs: NOW - 22 * 86400e3 }),
    ordre({ tx: '80003', conv: uuid(33), titre: 'Puma Suede achetée', prix: 18, statut: STATUT_FINAL, dateMs: NOW - 24 * 86400e3 }),
  ];
  return {
    accounts: comptes(), main: ligneMain({ vinted_annonce_numeros: num }),
    listings: [ligneListings(U, ann)], sold: [ligneSold(U, sold)], purch: [lignePurch(U, achats)],
    bord: [bordereau({ tx: '70010' }), bordereau({ tx: '70011' })],
    label: [labelLatest(U, { tx: '70010' })],
    conv: [ligneConv({ uid: U, cid: '5001', titre: 'Nike modèle 0 34', oppId: '44001', oppLogin: 'acheteur_test', itemId: 'an0' })],
  };
}

// fx/ présent ? (sur SA machine on lit la vraie base, ces builders dorment.)
const present = (SC) => fs.existsSync(path.join(SC, 'fx', 'accounts.json'));

module.exports = {
  present, comptes, ligneMain, ordre, lignePurch, ligneSold,
  bordereau, labelLatest, trackColis, panelRelais, panelComptesEtat, annonce, ligneListings, achatsScenario, ligneConv, coqueScenario, uuid, UID,
  STATUT_RELAIS, STATUT_AEXP, STATUT_FINAL, STATUT_NONRECL, iso, NOW,
};
