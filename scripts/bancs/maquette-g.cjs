// ════════════════════════════════════════════════════════════════════════════
//  BANC — MAQUETTE G « LE TABLEAU » (17 nov., proposition pour Julien, pas livrée).
//  npm run build && SHOTS=/tmp/g node scripts/bancs/maquette-g.cjs
//
//  Le prototype (src/maquettes/g/) n'est monté que si l'appareil porte
//  `vrm_banc_maquette` = 'g' — ce banc le pose ; aucun geste de l'app ne le fait.
//  Base INVENTÉE (aucune donnée réelle, le dépôt est public), une paire par cas de règle :
//    en ligne (dont qui dorment), un dressing lu il y a 3 j (⇒ À vérifier), masquées,
//    deux paires sous le N° 57 (le seul rouge), brouillons avec ou sans case, achats en route
//    / au point relais / arrivés sans N° / anciens jamais reliés, ventes sans bordereau,
//    à envoyer (date limite LUE sur le bordereau), en route, retournée, annulée, payées
//    (date de versement lue sur la transaction 450, ou pas lue), une conversation (état vide).
//  Mesures (rapportées, un banc ne meurt pas) : ≤ 1 bouton plein visible ; cibles ≥ 44 px au
//  téléphone ; 1re carte ≤ 50 % de 844 ; aucun « undefined/NaN » ; les cas de règle à leur place.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const OUT = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-maquette-g');
const J = 86400000, NOW = Date.now();
const iso = (ms) => new Date(NOW - ms).toISOString();
const MODELES = ['Nike Air Max 1 ’86 OG', 'New Balance 550 crème', 'Adidas Samba OG blanche', 'Asics Gel-1130 argent', 'Nike Dunk Low Panda', 'Salomon XT-6 noire',
  'New Balance 2002R gris', 'Adidas Gazelle Indoor bleue', 'Nike Air Force 1 ’07', 'Asics Gel-Kayano 14', 'Vans Old Skool noire', 'Nike Vomero 5 argent', 'Puma Speedcat rouge', 'Onitsuka Tiger Mexico 66'];
const COMPTES = [{ vinted_user_id: 111001, login: 'atelier_sneakers_paris' }, { vinted_user_id: 222002, login: 'second_compte_vintage' }, { vinted_user_id: 333003, login: 'troisieme_dressing_lyon' }];

function baseG() {
  const nums = {}, couts = {}, grille = {};
  const listings = { 111001: [], 222002: [], 333003: [] }, sold = { 111001: [], 222002: [], 333003: [] }, achats = { 111001: [], 222002: [], 333003: [] };
  const rows = [];
  let item = 7100000000, tx = 24100000000, num = 1, k = 0;
  const titre = (i) => `${MODELES[i % MODELES.length]} taille ${38 + (i % 8)}`;
  const annonce = (uid, o) => { const id = item++; listings[uid].push({ id, title: o.title, brand_title: o.title.split(' ')[0], size_title: '42', status: 'Très bon état', price: { amount: String(o.prix) + '.0', currency_code: 'EUR' },
    is_closed: !!o.ferme, is_hidden: !!o.cache, is_draft: !!o.brouillon, favourite_count: (id % 13), view_count: 40 + (id % 170), created_at_ts: iso((o.jours || 5) * J), photo: { url: `https://images1.vinted.net/t/${id}/f800/p.jpeg` } }); return id; };
  const fiche = (id, uid, o = {}) => { if (!o.n && num === 57) num++; const n = o.n || String(num++); nums[id] = { numero: n, accountId: String(uid), numberedAt: iso(40 * J), title: o.title, ...(o.buy ? { buyFromId: String(o.buy) } : {}) }; if (o.cout) couts[n] = o.cout; return n; };
  const uids = [111001, 222002];
  // En ligne : 96 paires (14 qui dorment > 60 j)
  for (let i = 0; i < 96; i++) { const uid = uids[i % 2]; const t = titre(i); const id = annonce(uid, { title: t, prix: 45 + (i * 7) % 90, jours: i < 14 ? 61 + i * 3 : 2 + (i % 50) }); fiche(id, uid, { title: t, cout: String(20 + i % 30) + ',00' }); }
  // Le 3e compte : son dressing lu il y a 3 jours ⇒ « en ligne » n'est plus prouvé (À vérifier)
  for (let i = 0; i < 4; i++) { const t = titre(i + 3); const id = annonce(333003, { title: t, prix: 60 + i * 5, jours: 12 }); fiche(id, 333003, { title: t }); }
  // Deux paires présentes sous le N° 57 (le seul rouge)
  { const id = annonce(111001, { title: 'Nike Dunk Low Panda taille 41', prix: 85, jours: 9 }); fiche(id, 111001, { n: '57', title: 'Nike Dunk Low Panda taille 41' }); }
  // Masquées par Vinted : toujours chez lui, pas « en ligne »
  for (let i = 0; i < 2; i++) { const t = titre(i + 20); const id = annonce(222002, { title: t, prix: 70, jours: 30, cache: true }); fiche(id, 222002, { title: t }); }
  // À ranger : brouillons, avec ou sans case
  for (let i = 0; i < 5; i++) { const t = titre(i + 30); const id = annonce(uids[i % 2], { title: t, prix: 80, jours: 1, brouillon: true }); const n = fiche(id, uids[i % 2], { title: t }); if (i < 2) grille['C-' + (i + 2)] = [n]; }
  // Achats (sur le compte 222002) : en route, au point relais, arrivés sans N°, anciens jamais reliés
  const A = (o) => { const t = tx++; achats[222002].push({ transaction_id: t, conversation_id: t + 1, title: o.title, price: { amount: String(o.prix) + '.0', currency_code: 'EUR' }, status: o.status, date: iso(o.jours * J), photo: { url: `https://images1.vinted.net/t/a${t}/f800/p.jpeg` } }); return t; };
  ['Colis disponible au point relais', 'Colis disponible au point relais', 'Expédié', 'Colis en transit', 'Le paiement a été validé', 'Bordereau envoyé au vendeur'].forEach((s, i) => A({ title: titre(i + 40), prix: 25 + i * 4, status: s, jours: 1 + i }));
  for (let i = 0; i < 3; i++) A({ title: titre(i + 50), prix: 30 + i, status: 'Commande finalisée', jours: 2 + i });
  for (let i = 0; i < 37; i++) A({ title: titre(i + 60), prix: 22, status: 'Commande finalisée', jours: 45 + i });
  A({ title: titre(99), prix: 30, status: 'Commande annulée', jours: 3 });   // annulé : pas une paire
  // Ventes (chaque vendue : son annonce fermée + sa fiche ; l'achat relié par son n° de transaction pour quelques-unes)
  const V = (uid, o) => {
    const t = o.title || titre(k++); const id = annonce(uid, { title: t, prix: o.prix || 95, jours: 40, ferme: true });
    const buy = o.relie ? A({ title: t, prix: 40, status: 'Commande finalisée', jours: 60 }) : null;
    fiche(id, uid, { title: t, buy, cout: '42,00' });
    const T = tx++; sold[uid].push({ transaction_id: T, item_id: id, title: t, price: { amount: String(o.prix || 95) + '.0', currency_code: 'EUR' }, status: o.status, transaction_user_status: o.tus, date: iso((o.jours || 1) * J), photo: { url: `https://images1.vinted.net/t/${id}/f800/p.jpeg` } });
    if (o.bord) rows.push({ id: `email_bord_${T}`, data: { filename: `bordereau-${T}.pdf`, transaction: String(T), receivedAt: iso(o.jours * J / 2), suivi: 'XW' + T, dateLimite: new Date(NOW + o.bord * J).toISOString(), pdfB64: 'JVBERi0x' } });
    if (o.verse !== undefined && o.verse !== null) rows.push({ id: `harvest_${uid}_txn_${T}`, data: { capturedAt: iso(J), payload: { transaction: { id: T, item_id: id, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(o.verse * J) } } } });
    return T;
  };
  for (let i = 0; i < 4; i++) V(uids[i % 2], { status: 'Le paiement a été validé', tus: 'needs_action', jours: i * 0.3 + 0.1, prix: 70 + i * 9 });
  [1.2, 1.6, 2.5, 3.4, 4.1, 5].forEach((b, i) => V(uids[i % 2], { status: 'Bordereau envoyé au vendeur', tus: 'needs_action', jours: 1 + i * 0.4, bord: b, prix: 88 + i * 6, relie: i % 2 === 0 }));
  for (let i = 0; i < 9; i++) V(uids[i % 2], { status: i % 3 ? 'Colis en transit' : 'Colis déposé au point relais', tus: 'waiting', jours: 2 + i, prix: 64 + i * 5 });
  V(111001, { status: 'Commande non réclamée - Retournée à l’expéditeur', tus: 'waiting', jours: 12, prix: 110 });
  V(222002, { status: 'Commande annulée', tus: 'failed', jours: 6, prix: 75 });
  for (let i = 0; i < 22; i++) V(uids[i % 2], { status: 'Commande finalisée', tus: 'completed', jours: 4 + i * 2, prix: 60 + (i * 11) % 80, verse: i < 2 ? null : (i < 18 ? 2 + i * 1.5 : 40 + i), relie: i % 3 === 0 });
  // Une CONVERSATION sur une annonce en ligne (état vide) : pas une vente — la paire reste « En ligne ».
  { const id = listings[111001][3].id; sold[111001].push({ transaction_id: tx++, item_id: id, title: listings[111001][3].title, price: { amount: '60.0' }, status: '', transaction_user_status: '', date: iso(J) }); }
  // Le N° 57 porté aussi par une paire en ligne d'un autre compte
  { const id = annonce(222002, { title: 'Nike Dunk Low Panda taille 41', prix: 82, jours: 20 }); nums[id] = { numero: '57', accountId: '222002', numberedAt: iso(20 * J), title: 'Nike Dunk Low Panda taille 41' }; }

  for (const a of COMPTES) {
    const uid = a.vinted_user_id; const lu = uid === 333003 ? iso(3 * J) : iso(2 * 60e3);
    rows.push({ id: `harvest_${uid}_listings`, data: { uid, type: 'listings', capturedAt: lu, nItems: listings[uid].length, payload: { items: listings[uid] } } });
    rows.push({ id: `harvest_${uid}_orders_sold`, data: { uid, capturedAt: iso(60e3), payload: { my_orders: sold[uid] } } });
    rows.push({ id: `harvest_${uid}_orders_purchased`, data: { uid, capturedAt: iso(60e3), payload: { my_orders: achats[uid] } } });
  }
  return { accounts: COMPTES, main: [{ id: 'main', data: { vinted_annonce_numeros: nums, vinted_buyprice_by_num: couts, vinted_garage_grid: grille } }], rows };
}

async function capture(nav, { W, sombre, col, nom, b }) {
  const o = await P.ouvrir(nav, { W, sombre, b, url: '/', dsf: W < 600 ? 2 : 1, avantChargement: "localStorage.setItem('vrm_banc_maquette', 'g')" });
  await o.pg.goto(`http://localhost:${P.PORT}/${col ? '#col=' + col : ''}`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('.g-racine:not(.g-attente)', { timeout: 25000 }).catch(() => {});
  await o.pg.waitForTimeout(900);
  const f = path.join(OUT, `${nom}-${W}-${sombre ? 'sombre' : 'clair'}.png`);
  await o.pg.screenshot({ path: f });
  const mes = await o.pg.evaluate(({ tel }) => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight; };
    const pleins = [...document.querySelectorAll('[data-plein]')].filter(vis).length;
    const petites = tel ? [...document.querySelectorAll('.g-racine button')].filter(vis).filter((x) => x.getBoundingClientRect().height < 43.5).map((x) => (x.innerText || x.getAttribute('aria-label') || '').slice(0, 24)) : [];
    const c1 = document.querySelector('.g-carte');
    const n = {}; for (const b of document.querySelectorAll('[data-g-etape], .g-ord-col')) { const k = b.getAttribute('data-g-etape') || b.getAttribute('data-g-col'); const x = b.querySelector('.g-rail-n, .g-col-n'); n[k] = x ? Number(x.innerText) : null; }
    const doubles = [...document.querySelectorAll('.g-carte.is-double')].map((c) => (c.closest('[data-g-col]') || {}).getAttribute ? c.closest('[data-g-col]').getAttribute('data-g-col') : '');
    return { pleins, petites, carte1: c1 ? Math.round(c1.getBoundingClientRect().top) : null, mauvais: /\bundefined\b|\bNaN\b|\[object Object\]/.test(document.body.innerText), n, doubles };
  }, { tel: W < 600 });
  console.log(path.basename(f), JSON.stringify(mes), o.erreurs.length ? 'ERREURS ' + o.erreurs.join(' | ') : '');
  await o.ctx.close();
  return mes;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const b = baseG();
  const COLS = (process.env.COLS || 'envoyer,enligne,achetees').split(',');
  try {
    for (const sombre of [false, true]) for (const col of COLS) await capture(nav, { W: 390, sombre, col, nom: 'tel-' + col, b });
    if (process.env.ORDI !== '0') await capture(nav, { W: 1512, sombre: false, col: '', nom: 'ordinateur', b });
    if (process.env.VERIFIER !== '0') await capture(nav, { W: 390, sombre: false, col: 'verifier', nom: 'tel-verifier', b });
  } finally { await nav.close(); P.srv.close(); }
})();
