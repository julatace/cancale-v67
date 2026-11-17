// Base de la maquette H (recopiée telle quelle de claude/maquette-h, scripts/bancs/maquette-h.cjs) — reprise par la maquette J.
'use strict';
const B = require('./_base-messages-stock.cjs');
const J = 86400000, NOW = Date.now();
const iso = (ms) => new Date(NOW - ms).toISOString();
const LOGINS = ['atelier_sneakers_paris', 'second_compte_vintage', 'troisieme_dressing_lyon69'];
function baseH() {
  const b = B.baseVolume();
  b.accounts.forEach((a, i) => { a.login = LOGINS[i]; });
  const m = b.main[0].data;
  const nums = m.vinted_annonce_numeros;
  const couts = m.vinted_buyprice_by_num = {};
  const grille = m.vinted_garage_grid = {};
  const cel = (n, i) => { const c = 'ABCDEF'[Math.floor(i / 24) % 6] + '-' + (1 + (Math.floor(i / 3) % 8)); (grille[c] = grille[c] || []).push(String(n)); };
  let n = 300, k = 0;
  const achatsDe = (uid) => b.rows.find((r) => r.id === `harvest_${uid}_orders_purchased`).data.payload.my_orders;
  b.accounts.forEach((a, ai) => {
    const uid = a.vinted_user_id;
    const sold = b.rows.find((r) => r.id === `harvest_${uid}_orders_sold`).data.payload.my_orders;
    const lst = b.rows.find((r) => r.id === `harvest_${uid}_listings`).data.payload.items;
    const autres = achatsDe(b.accounts[(ai + 1) % 3].vinted_user_id);
    sold.forEach((v, i) => {
      if (n === 124) n++;
      const numero = String(n++);
      const enLigne = Date.parse(v.date) - (8 + (i * 7) % 50) * J;
      lst.push({ id: v.item_id, title: v.title, brand_title: v.title.split(' ')[0], size_title: String(37 + (i % 9)), status: 'Très bon état', price: v.price, is_closed: true, is_hidden: false, is_draft: false,
        favourite_count: (i * 3) % 11, view_count: 40 + (i * 17) % 200, created_at_ts: new Date(enLigne).toISOString(), photo: v.photo });
      const f = { numero, accountId: uid, numberedAt: new Date(enLigne - 2 * J).toISOString(), title: v.title };
      if (i % 3 === 0 && autres[i]) { f.buyFromId = String(autres[i].transaction_id); }
      if (i % 5 !== 4) couts[numero] = String(18 + (i * 7) % 40) + ',00';
      nums[v.item_id] = f;
      cel(numero, k++);
    });
  });
  // Les 1 000 paires en ligne : un coût saisi sur deux, une case pour les 300 premières.
  Object.values(nums).filter((f) => Number(f.numero) >= 1200).forEach((f, i) => { if (i % 2 === 0) couts[f.numero] = String(20 + (i * 3) % 50) + ',00'; if (i < 300) cel(f.numero, k++); });

  // ── LA paire racontée de bout en bout : N° 124 ──
  const a0 = b.accounts[0].vinted_user_id, a1 = b.accounts[1].vinted_user_id;
  const TX = 23999000001, ITEM = 7700000001, ACHAT = 23888000001, CONV = 52999000001;
  const vente = iso(20 * 3600e3), limite = new Date(NOW + 3 * J + 6 * 3600e3).toISOString();
  b.rows.find((r) => r.id === `harvest_${a0}_listings`).data.payload.items.push({ id: ITEM, title: 'Nike Air Max 1 ’86 OG Big Bubble Sport Red', brand_title: 'Nike', size_title: '43', status: 'Très bon état',
    price: { amount: '135.0', currency_code: 'EUR' }, is_closed: true, is_hidden: false, is_draft: false, favourite_count: 7, view_count: 214, created_at_ts: iso(24 * J), photo: { url: 'https://images1.vinted.net/t/heros-124/f800/p.jpeg' } });
  b.rows.find((r) => r.id === `harvest_${a0}_orders_sold`).data.payload.my_orders.unshift({ transaction_id: TX, item_id: ITEM, title: 'Nike Air Max 1 ’86 OG Big Bubble Sport Red', price: { amount: '129.0', currency_code: 'EUR' },
    status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: vente, photo: { url: 'https://images1.vinted.net/t/heros-124/f800/p.jpeg' } });
  achatsDe(a1).unshift({ transaction_id: ACHAT, conversation_id: 17999000001, title: 'Air Max 1 86 big bubble rouge T43', price: { amount: '58.9', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(33 * J) });
  nums[ITEM] = { numero: '124', accountId: a0, numberedAt: iso(30 * J), title: 'Nike Air Max 1 ’86 OG Big Bubble Sport Red', buyFromId: String(ACHAT), buyPrice: '62,40' };
  grille['B-3'] = ['124', '118', '131'];
  b.rows.push({ id: `email_bord_${TX}`, data: { filename: `bordereau-${TX}.pdf`, transaction: String(TX), receivedAt: iso(18 * 3600e3), suivi: 'XW482913307FR', numero: '124', dateLimite: limite, pdfB64: 'JVBERi0x' } });
  b.rows.push({ id: `harvest_${a0}_conv_${CONV}`, data: { capturedAt: vente, payload: { conversation: { id: CONV, opposite_user: { id: 990001, login: 'ines_kicks_collector' }, current_user_side: 'seller',
    transaction: { id: TX, item_id: ITEM, status: 300, item_title: 'Nike Air Max 1 ’86 OG Big Bubble Sport Red' }, allow_reply: true,
    messages: [{ id: 1, entity_type: 'message', created_at_ts: vente, entity: { body: 'Merci ! Hâte de la recevoir', user_id: 990001 } }] } } } });
  // Quatre autres ventes à envoyer « avant demain soir » (date lue sur le bordereau).
  b.rows.filter((r) => /^email_bord_/.test(r.id)).slice(0, 4).forEach((r) => { r.data.dateLimite = new Date(NOW + 30 * 3600e3).toISOString(); });
  // ── Colis à retirer (inventés) ──
  const RELAIS = [['Super U Cleunay', '27 rue de Cleunay\n35000 Rennes'], ['Super U Cleunay', '27 rue de Cleunay\n35000 Rennes'], ['Super U Cleunay', '27 rue de Cleunay\n35000 Rennes'],
    ['Tabac Le Narval', '4 place du Marché\n35000 Rennes'], ['Tabac Le Narval', '4 place du Marché\n35000 Rennes'], ['Consigne Gare Sud', 'Hall 2\n35000 Rennes']];
  RELAIS.forEach(([nom, adr], i) => b.rows.push({ id: `email_track_chronopost_XR${700000100 + i}FR`, data: { type: 'suivi', carrier: i < 3 ? 'chronopost' : 'mondialrelay', suivi: `XR${700000100 + i}FR`, status: 'available',
    code: String(482100 + i * 1379), lieu: `${nom}\n${adr}`, limite: new Date(NOW + (2 + i) * J).toISOString(), artTitle: ['Adidas Samba OG blanche 42', 'New Balance 550 crème 41', 'Salomon XT-6 noire 44', 'Asics Gel-1130 argent 40', 'Nike Dunk Low Panda 38', 'Vans Old Skool 43'][i], receivedAt: iso((i + 1) * 3600e3) } }));

  // ══ (H) L'ATELIER — ce qui manque à la base de F pour que chaque POSTE ait du travail (tout inventé) ══
  const MODELES = ['Nike Air Max 90 blanche', 'Adidas Samba OG noire', 'New Balance 550 crème', 'Salomon XT-6 gris', 'Asics Gel-Kayano 14 argent', 'Nike Dunk Low Panda', 'Adidas Gazelle bleue', 'New Balance 2002R gris', 'Vans Old Skool noire', 'Nike Air Force 1 blanche'];
  // Les paires en ligne (fiches `num`) : une case pour toutes sauf les 14 plus récemment numérotées (⇒ Ranger).
  const dejaRangees = new Set(Object.values(grille).flat());
  const enLigneF = Object.values(nums).filter((f) => f && Number(f.numero) >= 1200 && !dejaRangees.has(String(f.numero)));
  enLigneF.forEach((f, i) => { if (i >= 14) cel(f.numero, k++); f.numberedAt = i < 14 ? iso((i + 1) * 3600e3) : iso((20 + (i % 80)) * J); });
  // Les annonces ouvertes : en ligne depuis 0 à 55 jours ; 14 par compte depuis 70 à 150 jours (⇒ Qui dorment).
  b.rows.filter((r) => /_listings$/.test(r.id)).forEach((r) => r.data.payload.items.filter((it) => !it.is_closed).forEach((it, i) => { it.created_at_ts = i < 14 ? iso((70 + i * 6) * J) : iso(((i * 7) % 55 + 0.5) * J); if (i < 14) it.favourite_count = (i * 5) % 13; }));
  // 9 paires numérotées et RANGÉES, en ligne nulle part (⇒ Publier) : une fiche par N°, l'id d'une annonce qui n'existe plus.
  for (let i = 0; i < 9; i++) { const id = String(7990000000 + i), numero = String(1180 + i); nums[id] = { numero, accountId: a0, numberedAt: iso((2 + i) * J), title: MODELES[i] + ' ' + (38 + i), photo: `https://images1.vinted.net/t/apublier-${i}/f800/p.jpeg` }; if (i % 2 === 0) couts[numero] = String(28 + i * 4) + ',00'; cel(numero, k++); }
  // Les achats : de vrais modèles inventés, les 10 derniers jours ; ceux « finalisés » sans fiche reliée ⇒ arrivés, à numéroter.
  b.accounts.forEach((a, ai) => achatsDe(a.vinted_user_id).forEach((o, i) => {
    o.title = MODELES[(i + ai * 3) % MODELES.length] + ' T' + (38 + (i % 8));
    o.date = iso((0.4 + i * 0.35 + ai * 0.2) * J);
    o.photo = { url: `https://images1.vinted.net/t/achat-${ai}-${i}/f800/p.jpeg` };
  }));
  return b;
}
module.exports = { baseH };
