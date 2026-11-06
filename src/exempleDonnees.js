// ── LES DONNÉES DU MODE EXEMPLE (6 nov.) ─────────────────────────────────────
// ⚠️ TOUT EST INVENTÉ (§2.3, dépôt public). C'est le jeu du banc « nouveau
//    vendeur » (scripts/bancs/nouveau-vendeur.cjs, 2 nov.) : deux comptes Vinted
//    fictifs, douze annonces, des ventes (dont une à expédier avec son
//    bordereau), un achat au relais avec son code, deux achats en route, un
//    compte Leboncoin. Aucun pseudo, nom, adresse ni identifiant réel : les
//    logins sont des libellés (« vendeuse_a »), le relais est une adresse
//    générique, les numéros de transaction sont hors de la plage de Vinted.
// ⚠️ Ces lignes ne vivent qu'EN MÉMOIRE dans la page (src/modeExemple.js) :
//    elles ne sont jamais écrites dans la base, ni dans le stockage de
//    l'appareil. Quitter le mode exemple = recharger la page = tout disparaît.
// JS pur, sans React : le banc l'importe aussi.

export const UID_EXEMPLE = 'e0e0e0e0-0000-4000-8000-00000000e0e0';
export const EMAIL_EXEMPLE = 'exemple@vrm.invalid';
// Les marques qu'un banc cherche pour dire « ceci vient de l'exemple » : elles
// ne doivent JAMAIS apparaître dans la vraie base ni dans le stockage réel.
export const TRACES_EXEMPLE = ['vendeuse_a', 'vendeuse_b', 'acheteuse_lyon', EMAIL_EXEMPLE];

export function jeuExemple(now = Date.now()) {
  const iso = (j) => new Date(now - j * 86400000).toISOString();
  const ts = (j) => Math.floor((now - j * 86400000) / 1000);
  const MARQUES = ['Nike', 'Adidas', 'New Balance', 'Asics', 'Salomon'];
  const MODELES = ['Air Max 90 blanche', 'Samba OG noire', '550 crème', 'Gel-1130 argent', 'XT-6 grise', 'Dunk Low panda'];
  const annonce = (i) => ({ id: 51000 + i, title: `${MARQUES[i % 5]} ${MODELES[i % 6]} taille ${38 + (i % 7)}`, price: { amount: String(45 + i * 5) + '.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: MARQUES[i % 5], size_title: String(38 + (i % 7)), status: i % 3 ? 'Très bon état' : 'Bon état', view_count: 12 + i * 7, favourite_count: i % 4, created_at_ts: ts(1 + i * 3) });
  const A1 = Array.from({ length: 8 }, (_, i) => annonce(i));
  const A2 = Array.from({ length: 4 }, (_, i) => annonce(10 + i));
  const vente = (i, statut, tus, jours) => ({ transaction_id: 62000 + i, title: `${MARQUES[(i + 1) % 5]} ${MODELES[(i + 2) % 6]} taille ${40 + (i % 4)}`, price: { amount: String(60 + i * 4), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: iso(jours), photo: null });
  const V1 = [vente(0, 'Bordereau envoyé au vendeur', 'needs_action', 0.3), vente(1, "Colis en cours d'acheminement", 'waiting', 2), vente(2, 'Commande finalisée', 'completed', 6)];
  const V2 = [vente(5, 'Commande finalisée', 'completed', 9)];
  const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
  const achat = (i, statut, tus, jours) => ({ transaction_id: 73000 + i, conversation_id: 84000 + i, title: `${MARQUES[(i + 3) % 5]} ${MODELES[(i + 4) % 6]} taille ${41 + (i % 3)}`, price: { amount: String(35 + i * 6), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: iso(jours), photo: null });
  const B1 = [achat(0, RELAIS_ST, 'needs_action', 4), achat(1, 'Le vendeur a expédié la commande', 'waiting', 2), achat(2, 'Le vendeur a expédié la commande', 'waiting', 1)];
  const conv = (id, login, desc, unread, h) => ({ id, unread, updated_at: iso(h / 24), description: desc, opposite_user: { id: 5000 + id, login } });
  const vu = { at: iso(0) };
  const lignes = [
    { id: 'main', data: { vrm_bienvenue_vue: vu, vrm_visite_vue: vu, vinted_annonce_numeros: Object.fromEntries([...A1, ...A2].slice(0, 9).map((a, i) => [a.id, { numero: String(i + 1) }])) } },
    { id: 'harvest_111_listings', data: { capturedAt: iso(0.01), payload: { items: A1 } } },
    { id: 'harvest_222_listings', data: { capturedAt: iso(0.02), payload: { items: A2 } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: iso(0.01), payload: { my_orders: V1 } } },
    { id: 'harvest_222_orders_sold', data: { capturedAt: iso(0.02), payload: { my_orders: V2 } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(0.01), payload: { my_orders: B1 } } },
    { id: 'harvest_111_inbox', data: { capturedAt: iso(0.01), payload: { conversations: [conv(301, 'acheteuse_lyon', 'Vous feriez 50 € ?', true, 3), conv(302, 'marc.b', 'Merci, bien reçu !', false, 30)] } } },
    { id: 'harvest_222_inbox', data: { capturedAt: iso(0.02), payload: { conversations: [conv(401, 'sneaker_fan', 'Toujours disponible en 42 ?', true, 6)] } } },
    { id: 'email_bord_62000', data: { transaction: '62000', filename: 'bordereau-62000.pdf', pdfB64: 'JVBERi0x', modele: V1[0].title, account: 'vendeuse_a', receivedAt: iso(0.2), dateLimite: new Date(now + 3 * 86400000).toLocaleDateString('fr-FR') + ' 10 h 00', type: 'vinted' } },
    { id: 'panel_colis_relais', data: { 73000: { code: 'K48291', lieu: 'Le Fournil, 8 Rue de la Paix, 35000 Rennes, France', at: iso(0.5), url: 'https://www.vinted.fr/inbox/84000' } } },
    { id: 'email_track_mondialrelay_40817263', data: { carrier: 'mondialrelay', status: 'disponible', suivi: '40817263', code: '582913', lieu: 'Le Fournil\n8 Rue de la Paix\n35000 Rennes', subject: 'Votre colis est disponible', receivedAt: iso(1), arriveLe: iso(1), dateLimite: new Date(now + 5 * 86400000).toISOString() } },
    { id: 'harvest_111_billing', data: { capturedAt: iso(0.01), payload: { user_balance: { available_amount: { amount: '64.0' }, escrow_amount: { amount: '120.0' } } } } },
    { id: 'lbc_accounts', data: { accounts: { lbcA: { id: 'lbcA', name: 'Ma boutique', sessionAt: iso(1) } } } },
    { id: 'lbc_listings', data: { items: { 3100000001: { id: '3100000001', ref: '2', customRef: 'VRM-2', subject: 'Adidas Samba OG noire T39', status: 'active', account: 'lbcA', seenAt: iso(0.5), price: 55 } } } },
    { id: 'lbc_ventes', data: { ventes: {} } },
  ].map((l) => ({ ...l, owner: UID_EXEMPLE, updated_at: iso(0), created_at: iso(30) }));
  const comptes = [
    { id: 1, vinted_user_id: '111', login: 'vendeuse_a', domain: 'www.vinted.fr', owner: UID_EXEMPLE, updated_at: iso(0), created_at: iso(30) },
    { id: 2, vinted_user_id: '222', login: 'vendeuse_b', domain: 'www.vinted.fr', owner: UID_EXEMPLE, updated_at: iso(0), created_at: iso(20) },
  ];
  return { lignes, comptes };
}
