// ════════════════════════════════════════════════════════════════════════════
//  UN CLIENT ÉNORME, INVENTÉ (11 nov., lot « limites-client »)
//
//  Julien : « un client qui a 5 000 annonces ne doit pas ralentir l'app pour
//  les autres ». Ce module fabrique, à la VRAIE forme des lignes (`harvest_*`,
//  `email_*`, `main`), un vendeur de :
//    · 10 comptes Vinted ;
//    · 5 000 annonces en ligne (500 par compte), chacune numérotée ;
//    · 20 000 ventes (2 000 par compte, dont 2 000 transactions lues) ;
//    · 3 000 e-mails (1 000 ventes, 1 000 bordereaux à petit PDF, 1 000 suivis).
//  Aucune donnée réelle (le dépôt est public) ; générateur déterministe (deux
//  passages servent les mêmes lignes). Les tailles sont paramétrables
//  (`echelle`) pour comparer un petit vendeur et le gros.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const J = 864e5;
const MARQUES = ['Nike', 'Adidas', 'Salomon', 'New Balance', 'Asics', 'Vans'];
const MODELES = ['samba', 'spezial', 'air max 1', 'xt-6', 'gazelle', '550', 'gel-1130', 'old skool'];

function fabriquerGros({ comptes = 10, annonces = 5000, ventes = 20000, emails = 3000, txn = 2000, maintenant = Date.now() } = {}) {
  const iso = (ms) => new Date(maintenant - ms).toISOString();
  const accounts = [], lignes = [], numeros = {};
  let num = 1, tx = 22000000000, item = 7000000000;
  const parCompte = Math.ceil(annonces / comptes), ventesParCompte = Math.ceil(ventes / comptes), txnParCompte = Math.ceil(txn / comptes);
  for (let a = 0; a < comptes; a++) {
    const uid = String(3150000000 + a * 1111);
    const login = 'gros_' + (a + 1);
    accounts.push({ id: 1000 + a, vinted_user_id: uid, login, domain: 'www.vinted.fr', updated_at: iso(3600e3), created_at: iso(60 * J) });
    lignes.push({ id: `harvest_${uid}_profile`, data: { capturedAt: iso(60e3), payload: { user: { id: Number(uid), login, feedback_reputation: 1 } } } });
    const items = [];
    for (let i = 0; i < parCompte && a * parCompte + i < annonces; i++) {
      const id = item++;
      items.push({ id, title: `${MARQUES[i % 6]} ${MODELES[(i + a) % 8]} taille ${36 + (i % 10)}`, brand_title: MARQUES[i % 6], size_title: String(36 + (i % 10)), status: 'Très bon état',
        price: { amount: String(30 + (i * 7) % 90) + '.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false,
        favourite_count: i % 5, view_count: 10 + (i % 40), created_at_ts: iso((i % 300 + 1) * 3600e3),
        photo: { url: `https://images1.vinted.net/t/${id}/f800/p.jpeg?s=abc`, high_resolution: { timestamp: Math.floor((maintenant - (i + 1) * 3600e3) / 1000) } } });
      numeros[id] = { numero: String(num++), numberedAt: iso((i + 1) * 3600e3), auto: false };
    }
    lignes.push({ id: `harvest_${uid}_listings`, data: { capturedAt: iso(60e3), nItems: items.length, payload: { items, pagination: { total_entries: items.length } } } });
    lignes.push({ id: `harvest_${uid}_enligne`, data: { capturedAt: iso(60e3), complet: true, n: items.length, ids: items.map((x) => x.id), items: items.map((x) => ({ id: x.id, title: x.title })) } });
    const sold = [];
    for (let i = 0; i < ventesParCompte && a * ventesParCompte + i < ventes; i++) {
      const t = tx++;
      const st = i < 2 ? 'Le paiement a été validé' : 'Commande finalisée';
      const d = iso((i * 0.18 + a * 0.01) * J);
      sold.push({ transaction_id: t, title: `${MARQUES[i % 6]} ${MODELES[i % 8]} taille ${37 + (i % 9)}`, price: { amount: String(25 + (i * 11) % 80) + '.0', currency_code: 'EUR' },
        status: st, date: d, item_id: 8000000000 + a * 100000 + i, transaction_user_status: i < 2 ? 'needs_action' : 'completed', photo: { url: `https://images1.vinted.net/t/${t}/f800/v.jpeg` } });
      if (i < txnParCompte) lignes.push({ id: `harvest_${uid}_txn_${t}`, data: { capturedAt: d, payload: { transaction: { id: t, item_id: 8000000000 + a * 100000 + i, status: i < 2 ? 300 : 450, status_title: st, status_updated_at: d } } } });
    }
    // Le résumé que pose l'extension (`resumeCommandes` : { n, txns, at, dates }) — la forme réelle.
    const ae = sold.filter((o) => o.transaction_user_status === 'needs_action');
    lignes.push({ id: `harvest_${uid}_orders_sold`, data: { capturedAt: iso(120e3), nItems: sold.length, payload: { my_orders: sold },
      resume: { n: sold.length, at: maintenant - 120e3, txns: ae.map((o) => String(o.transaction_id)), dates: Object.fromEntries(ae.map((o) => [String(o.transaction_id), o.date])) } } });
    lignes.push({ id: `harvest_${uid}_orders_purchased`, data: { capturedAt: iso(120e3), nItems: 0, payload: { my_orders: [] }, resume: { n: 0, at: maintenant - 120e3, txns: [] } } });
  }
  const tiers = Math.floor(emails / 3);
  for (let i = 0; i < tiers; i++) lignes.push({ id: `email_sale_${(i * 2654435761 >>> 0).toString(16).padStart(8, '0')}`, data: { type: 'vente', designation: 'Adidas Samba ' + i, prix: 40, account: 'gros_1', receivedAt: iso(i * 0.2 * J) } });
  for (let i = 0; i < tiers; i++) lignes.push({ id: `email_bord_${22000000000 + i}`, data: { filename: `b-${i}.pdf`, transaction: String(22000000000 + i), receivedAt: iso(i * 0.2 * J), suivi: 'XW' + i, account: 'gros_1', dateLimite: iso(-3 * J), pdfB64: 'JVBERi0xxxx' } });
  for (let i = 0; i < emails - 2 * tiers; i++) lignes.push({ id: `email_track_mondialrelay_${100000 + i}`, data: { carrier: 'mondialrelay', tracking: String(100000 + i), status: 'livre', receivedAt: iso((i + 30) * J) } });
  lignes.push({ id: 'main', data: { vinted_annonce_numeros: numeros, vinted_used_numeros: Object.values(numeros).map((x) => x.numero), vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' } } });
  return { accounts, lignes };
}

module.exports = { fabriquerGros };
