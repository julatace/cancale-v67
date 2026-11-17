// ════════════════════════════════════════════════════════════════════════════
//  BANC — MAQUETTE L « LE DRESSING » (17 nov., proposition pour Julien, pas livrée).
//  npm run build && SHOTS=/tmp/l node scripts/bancs/maquette-l.cjs
//
//  Le prototype (src/maquettes/l/) n'est monté que si l'appareil porte
//  `vrm_banc_maquette` = 'l' — ce banc le pose ; aucun geste de l'app ne le fait.
//  Base INVENTÉE (aucune donnée réelle, le dépôt est public), une paire par cas de règle
//  (reprise de la maquette G) + des achats au point relais avec leur code de retrait relié
//  par le n° de transaction de l'achat (ligne `vrm_colis_retirer`), dont UN avec un vrai QR
//  (image hébergée, comme Vinted Go / Chronopost ; ici une image inventée servie par le banc).
//  Les « photos » sont des dessins de baskets INVENTÉS (aucune marque, aucun logo).
//  Mesures (rapportées, un banc ne meurt pas) : ≤ 1 bouton plein visible ; cibles ≥ 44 px au
//  téléphone ; aucun texte coupé (scrollWidth > clientWidth) hors titres à 2 lignes ; tailles de
//  police distinctes ; aucun « undefined/NaN » ; les deux N° 57 en rouge dans « À faire ».
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const OUT = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-maquette-l');
const J = 86400000, NOW = Date.now();
const iso = (ms) => new Date(NOW - ms).toISOString();
const MODELES = ['Nike Air Max 1 ’86 OG', 'New Balance 550 crème', 'Adidas Samba OG blanche', 'Asics Gel-1130 argent', 'Nike Dunk Low Panda', 'Salomon XT-6 noire',
  'New Balance 2002R gris', 'Adidas Gazelle Indoor bleue', 'Nike Air Force 1 ’07', 'Asics Gel-Kayano 14', 'Vans Old Skool noire', 'Nike Vomero 5 argent', 'Puma Speedcat rouge', 'Onitsuka Tiger Mexico 66'];
const COMPTES = [{ vinted_user_id: 111001, login: 'atelier_sneakers_paris' }, { vinted_user_id: 222002, login: 'second_compte_vintage' }, { vinted_user_id: 333003, login: 'troisieme_dressing_lyon' }];

function baseL() {
  const nums = {}, couts = {};
  const listings = { 111001: [], 222002: [], 333003: [] }, sold = { 111001: [], 222002: [], 333003: [] }, achats = { 111001: [], 222002: [], 333003: [] };
  const rows = [], colis = [];
  let item = 7100000000, tx = 24100000000, num = 101, k = 0;
  const titre = (i) => `${MODELES[i % MODELES.length]} taille ${38 + (i % 8)}`;
  const annonce = (uid, o) => { const id = item++; listings[uid].push({ id, title: o.title, brand_title: o.title.split(' ')[0], size_title: '42', status: 'Très bon état', price: { amount: String(o.prix) + '.0', currency_code: 'EUR' },
    is_closed: !!o.ferme, is_hidden: !!o.cache, is_draft: !!o.brouillon, favourite_count: (id % 13), view_count: 40 + (id % 170), created_at_ts: iso((o.jours || 5) * J), photo: { url: `https://images1.vinted.net/t/${id}/f800/p.jpeg` } }); return id; };
  const fiche = (id, uid, o = {}) => { if (!o.n && num === 157) num++; const n = o.n || String(num++); nums[id] = { numero: n, accountId: String(uid), numberedAt: iso(40 * J), title: o.title, ...(o.buy ? { buyFromId: String(o.buy) } : {}) }; if (o.cout) couts[n] = o.cout; return n; };
  const uids = [111001, 222002];
  for (let i = 0; i < 96; i++) { const uid = uids[i % 2]; const t = titre(i); const id = annonce(uid, { title: t, prix: 45 + (i * 7) % 90, jours: i < 14 ? 61 + i * 3 : 2 + (i % 50) }); fiche(id, uid, { title: t, cout: String(20 + i % 30) + ',00' }); }
  for (let i = 0; i < 2; i++) { const t = titre(i + 3); const id = annonce(333003, { title: t, prix: 60 + i * 5, jours: 12 }); fiche(id, 333003, { title: t }); }
  { const id = annonce(111001, { title: 'Nike Dunk Low Panda taille 41', prix: 85, jours: 9 }); fiche(id, 111001, { n: '157', title: 'Nike Dunk Low Panda taille 41' }); }
  for (let i = 0; i < 2; i++) { const t = titre(i + 30); const id = annonce(uids[i % 2], { title: t, prix: 80, jours: 1, brouillon: true }); fiche(id, uids[i % 2], { title: t }); }
  const A = (o) => { const t = tx++; achats[222002].push({ transaction_id: t, conversation_id: t + 1, title: o.title, price: { amount: String(o.prix) + '.0', currency_code: 'EUR' }, status: o.status, date: iso(o.jours * J), photo: { url: `https://images1.vinted.net/t/a${t}/f800/p.jpeg` } }); return t; };
  // Au point relais, avec leur code relié par le n° de transaction de l'ACHAT
  [{ code: '482107', lieu: 'Relais Tabac du Port, 12 quai Jean Bart', tr: 'mondialrelay', lim: 3 },
    { code: '913556', lieu: 'Locker Vinted Go — Gare Saint-Charles', tr: 'vintedgo', lim: 5, qr: 'https://p.vintedgo.com/banc/qr_codes/1.png' }].forEach((c, i) => {
    const t = A({ title: titre(i + 40), prix: 25 + i * 4, status: 'Colis disponible au point relais', jours: 1 + i });
    colis.push({ tx: String(t), code: c.code, lieu: c.lieu, transporteur: c.tr, suivi: 'XW' + t, limite: new Date(NOW + c.lim * J).toISOString(), ...(c.qr ? { qr: c.qr } : {}) });
  });
  ['Expédié', 'Colis en transit', 'Le paiement a été validé'].forEach((s, i) => A({ title: titre(i + 42), prix: 30 + i * 4, status: s, jours: 1 + i }));
  for (let i = 0; i < 2; i++) A({ title: titre(i + 50), prix: 30 + i, status: 'Commande finalisée', jours: 2 + i });
  A({ title: titre(99), prix: 30, status: 'Commande annulée', jours: 3 });
  const V = (uid, o) => {
    const t = o.title || titre(k++); const id = annonce(uid, { title: t, prix: o.prix || 95, jours: 40, ferme: true });
    const buy = o.relie ? A({ title: t, prix: 40, status: 'Commande finalisée', jours: 60 }) : null;
    fiche(id, uid, { title: t, buy, cout: o.sansCout ? undefined : '42,00' });
    const T = tx++; sold[uid].push({ transaction_id: T, item_id: id, title: t, price: { amount: String(o.prix || 95) + '.0', currency_code: 'EUR' }, status: o.status, transaction_user_status: o.tus, date: iso((o.jours || 1) * J), photo: { url: `https://images1.vinted.net/t/${id}/f800/p.jpeg` } });
    if (o.bord) rows.push({ id: `email_bord_${T}`, data: { filename: `bordereau-${T}.pdf`, transaction: String(T), receivedAt: iso(o.jours * J / 2), suivi: 'XW' + T, dateLimite: new Date(NOW + o.bord * J).toISOString(), pdfB64: 'JVBERi0x' } });
    if (o.verse !== undefined && o.verse !== null) rows.push({ id: `harvest_${uid}_txn_${T}`, data: { capturedAt: iso(J), payload: { transaction: { id: T, item_id: id, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(o.verse * J) } } } });
    return T;
  };
  for (let i = 0; i < 3; i++) V(uids[i % 2], { status: 'Le paiement a été validé', tus: 'needs_action', jours: i * 0.3 + 0.1, prix: 70 + i * 9 });
  [1.2, 1.6, 2.5, 3.4, 4.1, 5].forEach((b, i) => V(uids[i % 2], { status: 'Bordereau envoyé au vendeur', tus: 'needs_action', jours: 1 + i * 0.4, bord: b, prix: 88 + i * 6, relie: i % 2 === 0 }));
  for (let i = 0; i < 5; i++) V(uids[i % 2], { status: i % 3 ? 'Colis en transit' : 'Colis déposé au point relais', tus: 'waiting', jours: 2 + i, prix: 64 + i * 5 });
  V(111001, { status: 'Commande non réclamée - Retournée à l’expéditeur', tus: 'waiting', jours: 12, prix: 110 });
  for (let i = 0; i < 22; i++) V(uids[i % 2], { status: 'Commande finalisée', tus: 'completed', jours: 2 + i * 1.3, prix: 60 + (i * 11) % 80, verse: i < 2 ? null : 1 + i * 1.2, relie: i % 3 === 0, sansCout: i % 4 === 1 });
  { const id = listings[111001][3].id; sold[111001].push({ transaction_id: tx++, item_id: id, title: listings[111001][3].title, price: { amount: '60.0' }, status: '', transaction_user_status: '', date: iso(J) }); }
  { const id = annonce(222002, { title: 'Nike Dunk Low Panda taille 41', prix: 82, jours: 20 }); nums[id] = { numero: '157', accountId: '222002', numberedAt: iso(20 * J), title: 'Nike Dunk Low Panda taille 41' }; }

  for (const a of COMPTES) {
    const uid = a.vinted_user_id; const lu = uid === 333003 ? iso(3 * J) : iso(2 * 60e3);
    rows.push({ id: `harvest_${uid}_listings`, data: { uid, type: 'listings', capturedAt: lu, nItems: listings[uid].length, payload: { items: listings[uid] } } });
    rows.push({ id: `harvest_${uid}_orders_sold`, data: { uid, capturedAt: iso(60e3), payload: { my_orders: sold[uid] } } });
    rows.push({ id: `harvest_${uid}_orders_purchased`, data: { uid, capturedAt: iso(60e3), payload: { my_orders: achats[uid] } } });
  }
  rows.push({ id: 'vrm_colis_retirer', data: { at: iso(60e3), colis } });
  return { accounts: COMPTES, main: [{ id: 'main', data: { vinted_annonce_numeros: nums, vinted_buyprice_by_num: couts } }], rows };
}

// ── Les « photos » : une basket de profil DESSINÉE (inventée, sans marque), coloris tiré du n° ──
const COLORIS = [
  ['#F4F1EC', '#1E2A38', '#E9E4DA', '#C8102E'], ['#EDE6D6', '#2F5D3A', '#F6F1E6', '#2F5D3A'], ['#FFFFFF', '#111111', '#F2EFE8', '#111111'],
  ['#C9CED6', '#7B8592', '#EDEDED', '#3E6FB0'], ['#1D1D1F', '#FFFFFF', '#2B2B2D', '#D9D9D9'], ['#E8D9C4', '#8A5A3B', '#C49A6C', '#8A5A3B'],
  ['#D7DCE2', '#9AA3AD', '#F4F4F2', '#5D6670'], ['#2C4A7A', '#FFFFFF', '#E9E1CF', '#FFFFFF'], ['#F7F7F5', '#E8E8E4', '#FFFFFF', '#B9B9B4'],
  ['#BFC6CE', '#2D5BA8', '#ECEEF0', '#2D5BA8'], ['#202124', '#F2F2F2', '#F2F2F2', '#F2F2F2'], ['#D9DDE1', '#A8B0B8', '#F1F1EF', '#6E7A86'],
  ['#B3262D', '#FFFFFF', '#F1ECE3', '#1D1D1F'], ['#F2D24B', '#1D1D1F', '#F3EEE2', '#1D1D1F'],
];
const FONDS = ['#ECE9E4', '#E6EAEE', '#EEE8E1', '#E4E9E6', '#EAE6EC', '#E9ECEF'];
function basket(u) {
  let h = 0; for (const c of String(u)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [corps, bande, semelle, detail] = COLORIS[h % COLORIS.length];
  const fond = FONDS[(h >> 4) % FONDS.length];
  const inv = (h >> 8) % 2 ? '' : ' transform="translate(800 0) scale(-1 1)"';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".55"/><stop offset=".6" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".22"/><stop offset="1" stop-color="#000000" stop-opacity=".10"/></linearGradient></defs>
<rect width="800" height="800" fill="${fond}"/><rect width="800" height="800" fill="url(#f)"/>
<ellipse cx="410" cy="572" rx="300" ry="20" fill="#000" opacity=".13"/>
<g${inv}>
<path d="M118 500 C122 446 168 418 228 402 L318 366 C350 352 372 316 412 312 C446 309 468 334 500 350 C562 380 640 386 688 414 C716 431 724 468 716 506 L118 506 Z" fill="${corps}" stroke="#1F2328" stroke-opacity=".55" stroke-width="3"/>
<path d="M118 500 C122 446 168 418 228 402 L318 366 C350 352 372 316 412 312 C446 309 468 334 500 350 C562 380 640 386 688 414 C716 431 724 468 716 506 L118 506 Z" fill="url(#c)"/>
<path d="M140 470 C190 440 250 430 300 438 C330 444 330 470 300 476 L150 488 Z" fill="${detail}" opacity=".9"/>
<path d="M300 470 C380 420 470 410 560 430 C600 440 610 462 570 466 C480 470 400 478 318 492 Z" fill="${bande}" opacity=".95"/>
<path d="M600 404 C640 410 680 420 700 440 L704 470 C680 452 640 444 606 440 Z" fill="${detail}" opacity=".85"/>
<path d="M372 340 L392 372 M398 330 L418 362 M424 324 L444 356 M450 330 L468 362" stroke="#1F2328" stroke-opacity=".6" stroke-width="5" stroke-linecap="round"/>
<path d="M112 506 L722 506 L718 534 C600 548 300 550 140 540 C120 539 110 526 112 506 Z" fill="${semelle}" stroke="#1F2328" stroke-opacity=".45" stroke-width="3"/>
<path d="M130 522 C300 530 560 530 712 520" stroke="#1F2328" stroke-opacity=".18" stroke-width="3" fill="none"/>
</g></svg>`;
}
// Un QR INVENTÉ (motif de démonstration, ne se lit pas) : l'app n'en fabrique jamais, elle montre l'image reçue.
function qr() {
  let s = '', g = 7; const n = 29, c = 8;
  const fin = (x, y) => `<rect x="${x * c}" y="${y * c}" width="${7 * c}" height="${7 * c}" fill="#0C1D30"/><rect x="${(x + 1) * c}" y="${(y + 1) * c}" width="${5 * c}" height="${5 * c}" fill="#fff"/><rect x="${(x + 2) * c}" y="${(y + 2) * c}" width="${3 * c}" height="${3 * c}" fill="#0C1D30"/>`;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g = (g * 1103515245 + 12345) >>> 0; const coin = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9); if (!coin && (g >> 16) % 2) s += `<rect x="${x * c}" y="${y * c}" width="${c}" height="${c}" fill="#0C1D30"/>`; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n * c}" height="${n * c}" viewBox="0 0 ${n * c} ${n * c}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/>${s}${fin(0, 0)}${fin(n - 7, 0)}${fin(0, n - 7)}</svg>`;
}

async function capture(nav, { W, sombre, hash, nom, b, plein = false }) {
  const o = await P.ouvrir(nav, { W, sombre, b, url: '/', dsf: W < 600 ? 2 : 1, avantChargement: "localStorage.setItem('vrm_banc_maquette', 'l')" });
  const img = (r) => { const u = r.request().url(); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: /vintedgo/.test(u) ? qr() : basket(u) }); };
  await o.ctx.route(/vinted\.net|vintedgo\.com/, img);
  await o.pg.route(/vinted\.net|vintedgo\.com/, img);
  await o.pg.goto(`http://localhost:${P.PORT}/${hash ? '#' + hash : ''}`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('.l-racine:not(.l-attente)', { timeout: 25000 }).catch(() => {});
  await o.pg.waitForTimeout(1300);
  const f = path.join(OUT, `${nom}-${W}-${sombre ? 'sombre' : 'clair'}.png`);
  await o.pg.screenshot({ path: f, fullPage: plein });
  const mes = await o.pg.evaluate(({ tel }) => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight; };
    const pleins = [...document.querySelectorAll('[data-plein]')].filter(vis).length;
    const petites = tel ? [...document.querySelectorAll('.l-racine button')].filter(vis).filter((x) => !x.closest('[inert]')).filter((x) => x.getBoundingClientRect().height < 43.5 && !x.classList.contains('l-tuile')).map((x) => (x.innerText || x.getAttribute('aria-label') || '').slice(0, 24)) : [];
    const coupes = [...document.querySelectorAll('.l-racine *')].filter(vis).filter((x) => !x.closest('[inert]') && x.children.length === 0 && x.innerText && !x.classList.contains('l-nom') && x.scrollWidth > x.clientWidth + 1).map((x) => x.innerText.slice(0, 30));
    const tailles = {}; for (const x of document.querySelectorAll('.l-racine *')) { if (!vis(x) || x.closest('[inert]') || !x.childNodes.length || ![...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue; const t = getComputedStyle(x).fontSize; tailles[t] = (tailles[t] || 0) + 1; }
    const visibles = [...document.querySelectorAll('.l-tuile')].filter((x) => { const r = x.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight - 80; }).length;
    const filtres = Object.fromEntries([...document.querySelectorAll('[data-l-filtre]')].map((x) => [x.getAttribute('data-l-filtre'), x.innerText.replace(/\s+/g, ' ')]));
    const t1 = document.querySelector('.l-tuile');
    return { pleins, petites, coupes: coupes.slice(0, 6), tailles, tuilesEntieres: visibles, tuile1: t1 ? Math.round(t1.getBoundingClientRect().top) : null, filtres,
      doubles: [...document.querySelectorAll('.l-plaque.is-double')].length, mauvais: /\bundefined\b|\bNaN\b|\[object Object\]/.test(document.body.innerText) };
  }, { tel: W < 600 });
  console.log(path.basename(f), JSON.stringify(mes), o.erreurs.length ? 'ERREURS ' + o.erreurs.join(' | ') : '');
  await o.ctx.close();
  return mes;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const b = baseL();
  // La clé de la 1re vente à envoyer, et du 1er achat au point relais (pour ouvrir leur fiche).
  const envoyer = b.rows.find((r) => /^email_bord_/.test(r.id));
  const sold = b.rows.filter((r) => /_orders_sold$/.test(r.id)).flatMap((r) => r.data.payload.my_orders);
  const vEnv = sold.find((o) => String(o.transaction_id) === envoyer.data.transaction);
  const ret = b.rows.find((r) => r.id === 'vrm_colis_retirer').data.colis;
  const ECRANS = [
    ['afaire', ''], ['enligne', 'f=enligne'], ['achats', 'f=achats'], ['argent', 'e=argent'],
    ['fiche-envoyer', 'p=p' + vEnv.item_id], ['fiche-retirer', 'p=a' + ret[1].tx],
  ];
  const voulus = (process.env.ECRANS || '').split(',').filter(Boolean);
  try {
    for (const sombre of [false, true]) for (const [nom, hash] of ECRANS) if (!voulus.length || voulus.includes(nom)) await capture(nav, { W: 390, sombre, hash, nom, b });
    if (process.env.ORDI !== '0') for (const [nom, hash] of [['afaire', ''], ['fiche-envoyer', 'p=p' + vEnv.item_id], ['argent', 'e=argent']]) if (!voulus.length || voulus.includes(nom)) await capture(nav, { W: 1512, sombre: false, hash, nom, b });
  } finally { await nav.close(); P.srv.close(); }
})();
