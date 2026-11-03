// Banc : « À FAIRE » EN PHOTOS ET COLIS EN TROIS ONGLETS (3 nov., retour de Julien sur sa capture
// de Ma journée : « pareil pour les couleurs… j'aime pas trop ; il faut que ce soit les PHOTOS en
// tout petit — s'il y en a plusieurs, des photos SUPERPOSÉES pour qu'on voie de quoi il s'agit » ;
// « je veux des colis ENVOYÉS, et dans un autre onglet ; Vestiaire : tout va être ensemble »).
//
// Données INVENTÉES (dépôt public). Il juge la RÈGLE (data-* et nombres rendus, §6.4) :
//   J1. chaque case d'« À faire » porte une vignette (`[data-pile]`) dont les photos sont celles de
//       L'IDENTITÉ de ses articles (la vente, l'achat, la conversation, l'annonce elle-même) —
//       jamais celle d'un JUMEAU au même titre (vente finalisée 8104 et annonce 4001 portent le
//       titre de 8101 avec d'autres photos). MUTATION (JP_MUTATION=titre) : le banc sert une copie
//       de l'app où la photo d'un colis est cherchée PAR TITRE ⇒ il DOIT passer au rouge ;
//   J2. plusieurs articles ⇒ une PILE (2-3 vignettes) et le reste en « +k » (k = n − montrées) ;
//   J3. plus aucune pastille pleine colorée (ni ambre, ni encre) dans « À faire » ; un seul fond
//       de carte ; le bleu seulement sur le geste principal ;
//   C1. Colis : « À envoyer · N » / « Envoyés · N » / « À retirer · N » ; N(à envoyer) =
//       `vrm_colis_aposter.total` = la case de Ma journée ; N(à retirer) = `vrm_colis_retirer.total` ;
//   C2. « À envoyer » : Vinted, Vestiaire et Leboncoin dans LA MÊME liste (rangée par transporteur),
//       plus de bloc « Ventes Vestiaire à envoyer » à part ;
//   C3. « Envoyés » : les colis partis (règle « Partis » existante), chacun avec sa frise
//       Imprimé → Déposé → En route → Livré qui ne coche que le prouvé.
// Jeux (JP_JEU) : base · zero (rien à faire) · un (un colis) · trente (30 colis) · sansphoto.
// Lancer : (construire dist) puis BANC_PORT=45xx node scripts/bancs/journee-photos.cjs
// Captures : SHOTS=<dossier>.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST0 = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 4417);
const SHOTS = process.env.SHOTS || '';
const MUTATION = process.env.JP_MUTATION || '';
const JEU = process.env.JP_JEU || 'base';
const VUES = process.env.JP_VUES ? process.env.JP_VUES.split(',') : null;

// ── La copie mutée : la photo d'un colis à poster cherchée PAR TITRE (la faute que §5 interdit) ──
let DIST = DIST0;
if (MUTATION === 'titre') {
  DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'jp-mut-'));
  fs.cpSync(DIST0, DIST, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(path.join(DIST, 'assets')).filter((x) => x.endsWith('.js'))) {
    const p = path.join(DIST, 'assets', f); const s = fs.readFileSync(p, 'utf8');
    const m = s.replace(/(toShip|presses)\.map\(\(t\) => orderPhoto\(t\.o\)\)/g, (_, v) => { n++; return v + '.map((t) => orderPhoto([...(sales.items || [])].reverse().find((o) => o && t.o && o.title === t.o.title) || t.o))'; });
    if (m !== s) fs.writeFileSync(p, m);
  }
  console.log(`(mutation « par titre » posée ${n} fois)`);
  if (!n) { console.log('❌ mutation introuvable dans la construction'); process.exit(1); }
}

const maintenant = new Date(2026, 10, 3, 9, 49, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const A = '111';
const SANS = JEU === 'sansphoto';
const ph = (k) => SANS ? null : { url: `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x` };
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const vente = (id, titre, prix, statut, d, tus, k, extra = {}) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: d.toISOString(), photo: ph(k), ...extra });
const MAX90 = 'Nike Air Max 90 blanche taille 43';
const BASE = [
  vente(8101, MAX90, 70, 'Le paiement a été validé', il(0, 8), 'needs_action', 1),
  vente(8102, 'Adidas Samba OG noir taille 40', 72, 'Le paiement a été validé', il(1, 9), 'needs_action', 2),
  vente(8103, 'Salomon XT-6 noir taille 38,5', 88, 'Le paiement a été validé', il(2, 10), 'needs_action', 3),
  vente(8104, MAX90, 65, 'Commande finalisée', il(20), 'completed', 4),           // LE JUMEAU (même titre que 8101, autre photo)
  vente(8105, 'New Balance 550 vert taille 42', 88, 'Le colis est en route', il(3, 10), 'waiting', 5),
  vente(8106, 'Asics Gel-Kayano 14 argent taille 44', 89, 'Le colis a été livré', il(4, 10), 'waiting', 6),
];
const VENTES = JEU === 'zero' ? [BASE[3]]
  : JEU === 'un' ? [BASE[0], BASE[3]]
  : JEU === 'trente' ? [...Array.from({ length: 30 }, (_, k) => vente(8200 + k, `Article ${k + 1} taille ${36 + (k % 10)}`, 30 + k, 'Le paiement a été validé', il(k % 5, 9), 'needs_action', 100 + k)), BASE[3]]
  : BASE;
const APOSTER = VENTES.filter((v) => v.transaction_user_status === 'needs_action');
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'boutique_test', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const AVEC_AUTRES = JEU === 'base' || JEU === 'sansphoto';
// Achats au point relais (photo = celle de l'achat lui-même).
const achat = (id, titre, k) => ({ transaction_id: id, conversation_id: 7000 + id % 1000, title: titre, price: { amount: '40', currency_code: 'EUR' }, status: 'Colis déposé en point relais', transaction_user_status: 'needs_action', date: il(3).toISOString(), photo: ph(k) });
const ACHATS = AVEC_AUTRES ? [achat(9301, 'Nike Dunk Low panda taille 38', 9), achat(9302, 'Converse Chuck 70 noir taille 42', 10)] : [];
const RELAIS = { 9301: { code: '012345', lieu: 'Phone Cash, 12 rue du Port, 35260 Cancale', transporteur: 'mondialrelay', at: il(0).toISOString() }, 9302: { code: '481207', lieu: 'Phone Cash, 12 rue du Port, 35260 Cancale', transporteur: 'mondialrelay', at: il(0).toISOString() } };
const conv = (id, unread, k, avatar) => ({ id, unread, updated_at: il(0, 8).toISOString(), description: 'Bonjour', opposite_user: { id: 5000 + id, login: 'acheteur' + id, photo: avatar && !SANS ? { url: url(avatar) } : null }, item_photos: k && !SANS ? [{ url: url(k) }] : [] });
const CONVS = AVEC_AUTRES ? [conv(301, true, 11), conv(302, true, 12), conv(303, true, null, 13), conv(304, false, 14)] : [];
const sec = (j) => Math.floor((maintenant.getTime() - j * 864e5) / 1000);
const LISTINGS = AVEC_AUTRES ? [
  { id: 4001, title: MAX90, price: { amount: '80.0', currency_code: 'EUR' }, photo: ph(7), created_at_ts: sec(100), view_count: 80, favourite_count: 0 },   // annonce au MÊME titre que 8101
  { id: 4002, title: 'Veste Carhartt Detroit marron M', price: { amount: '120.0', currency_code: 'EUR' }, photo: ph(8), created_at_ts: sec(70), view_count: 90, favourite_count: 1 },
] : [];
const VC_PHOTO = SANS ? null : 'https://images.vestiairecollective.com/produit/71000001-1_3.jpg';
const LBC_PHOTO = SANS ? null : 'https://img.leboncoin.fr/ad-image/lbc1.jpg';
const LIGNES = [
  { id: 'main', data: { vinted_ship_done: {}, vinted_used_numeros: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } },
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${A}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: ACHATS } } },
  { id: `harvest_${A}_listings`, data: { capturedAt: cap, payload: { items: LISTINGS, pagination: { total_pages: 1, current_page: 1 } } } },
  { id: `harvest_${A}_inbox`, data: { capturedAt: cap, payload: { conversations: CONVS } } },
  { id: 'panel_colis_relais', data: AVEC_AUTRES ? RELAIS : {} },
  ...(APOSTER.some((v) => v.transaction_id === 8101) ? [{ id: 'email_bord_8101', data: { transaction: '8101', uid: A, filename: 'b1.pdf', modele: 'Air Max', transporteur: 'Mondial Relay', suivi: '24813377', dateLimite: il(-1, 12).toISOString(), receivedAt: il(0, 9).toISOString(), pdfB64: PDF_B64 } }] : []),
  ...(APOSTER.some((v) => v.transaction_id === 8102) ? [{ id: 'email_bord_8102', data: { transaction: '8102', uid: A, filename: 'b2.pdf', modele: 'Samba', transporteur: 'Chronopost', suivi: 'XW000000002FR', receivedAt: il(1, 12).toISOString(), pdfB64: PDF_B64 } }] : []),
  ...(VENTES.some((v) => v.transaction_id === 8105) ? [{ id: 'email_bord_8105', data: { transaction: '8105', uid: A, filename: 'b5.pdf', modele: 'NB', transporteur: 'Chronopost', suivi: 'XW000000005FR', receivedAt: il(3, 12).toISOString(), pdfB64: PDF_B64 } }] : []),
  ...(AVEC_AUTRES ? [
    { id: 'vc_listings', data: { capturedAt: cap, complet: true, liens: {}, items: { 71000001: { titre: 'Cabas toile beige', photo: VC_PHOTO, statut: 'sold', vuAt: cap } } } },
    { id: 'vc_ventes', data: { lectures: { 'a-expedier': { at: cap, complet: true }, ventes: { at: cap } }, ventes: {
      V1: { productId: '71000001', aExpedier: true, limite: il(-3).toISOString(), date: il(1).toISOString(), titre: 'Cabas toile beige', photo: VC_PHOTO, etat: 'ACTION_NEEDED', montant: { valeur: 180.5, devise: 'EUR', cle: 'sellerEarning' }, transporteur: 'Chronopost', suivi: 'XW000000009FR', etiquette: true },
    } } },
    { id: 'lbc_ventes', data: { ventes: {
      T1: { txId: 'T1', itemId: 'L1', isSeller: true, title: 'Sac besace cuir camel', price: 4500, images: LBC_PHOTO ? [LBC_PHOTO] : [], label: { voucherUrl: 'https://www.leboncoin.fr/x/bordereau.pdf', reference: 'R1' }, deliveryMethod: 'mondial_relay', stepLabel: 'À envoyer', at: il(1).toISOString() },
      T2: { txId: 'T2', itemId: 'L2', isSeller: true, title: 'Ceinture cuir noir', price: 2500, images: [], deliveryMethod: 'colissimo', stepLabel: 'Colis en cours de livraison', parcelStatus: 'in_transit', at: il(4).toISOString() },
    } } },
  ] : []),
];
// Ce que chaque case DOIT montrer (les photos de l'identité, dans l'ordre de la liste).
// Base : l'ordre de Colis (`toShip`, le plus pressé d'abord ; limite estimée = vente + 7 j) — 8103
// (vendue avant-hier), 8102 (hier), 8101 (aujourd'hui) ; puis Vestiaire, puis Leboncoin.
const PHOTOS_ENVOYER = SANS ? [] : JEU === 'base' ? [url(3), url(2), url(1), VC_PHOTO, LBC_PHOTO] : APOSTER.map((v) => v.photo && v.photo.url).filter(Boolean);
const JUMEAUX = [url(4), url(7)];  // la vente finalisée et l'annonce au même titre que 8101

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const TEINTES = ['#dfe3e8', '#e8e1d8', '#dfe5dd', '#e6dcdc', '#e2dfe8', '#e8e4d6'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${TEINTES[k % 6]}"/><path d="M60 250 C80 190 150 175 190 200 C230 222 285 205 330 232 C352 246 346 282 306 284 L84 284 C62 284 52 268 60 250 Z" fill="rgba(30,34,40,.62)"/><path d="M60 284 L330 284 L326 300 L66 300 Z" fill="rgba(255,255,255,.85)"/><text x="200" y="120" font-size="90" text-anchor="middle" fill="rgba(0,0,0,.35)" font-family="sans-serif">${k}</text></svg>`;
const sacSvg = (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#efe9df"/><rect x="110" y="150" width="180" height="170" rx="18" fill="${c}"/><path d="M150 150 C150 80 250 80 250 150" stroke="${c}" stroke-width="16" fill="none"/></svg>`;

const ouvrir = async (b, vp, sombre, tab) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
    localStorage.setItem('vinted_sale_overrides', JSON.stringify({ '8101': { numero: '18' }, '8102': { numero: '23' }, '8105': { numero: '7' }, '8106': { numero: '9' } }));
    localStorage.setItem('vinted_ship_done', JSON.stringify({}));
  } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const m = /images1\.vinted\.net\/t\/b(\d+)\//.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(Number(m[1])) });
    if (/vestiairecollective/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: sacSvg('#c8b08a') });
    if (/img\.leboncoin\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: sacSvg('#a8693a') });
    if (/\/favicon\.ico$/i.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="4" y="4" width="24" height="24" rx="5" fill="#8e8e93"/></svg>' });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => (r.data[k] == null) === !non);
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};

// Ce que montre « À faire » : la vignette de chaque ligne, les fonds, les couleurs — mesuré.
const mesureJournee = (pg) => pg.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const rgb = (x) => { const m = /rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?/.exec(x || ''); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] } : null; };
  const liste = document.querySelector('.vrm-fu-afaire');
  const taches = liste ? [...liste.querySelectorAll('.vrm-day-task')].filter(vis) : [];
  const lignes = taches.map((t) => {
    const p = t.querySelector('[data-pile]');
    return { cas: t.getAttribute('data-case') || t.getAttribute('data-job') || '', n: t.getAttribute('data-n'), pile: p ? { n: p.getAttribute('data-pile-n'), photos: Number(p.getAttribute('data-pile-photos')), plus: Number(p.getAttribute('data-pile-plus')), estPile: p.classList.contains('is-pile'), srcs: [...p.querySelectorAll('[data-vignette-src]')].map((v) => v.getAttribute('data-vignette-src')), imgs: [...p.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth > 0).length, w: Math.round(p.querySelector('.vrm-pile-v').getBoundingClientRect().width), rayon: getComputedStyle(p.querySelector('.vrm-pile-v')).borderTopLeftRadius } : null,
      fond: getComputedStyle(t).backgroundColor, titre: (t.querySelector('.vrm-day-task-title') || {}).textContent || '' };
  });
  // Une « pastille pleine colorée » : un élément de 20 px ou plus, fond plein ambre ou encre/noir.
  const pleines = liste ? [...liste.querySelectorAll('*')].filter(vis).filter((e) => {
    const b = e.getBoundingClientRect(); if (b.width < 20 || b.height < 20) return false;
    if (e.closest('[data-fu-principal]')) return false;
    const c = rgb(getComputedStyle(e).backgroundColor); if (!c || c.a < 0.5) return false;
    const ambre = c.r > 200 && c.g > 120 && c.g < 190 && c.b < 60;
    const encre = c.r < 60 && c.g < 60 && c.b < 60 && !document.documentElement.getAttribute('data-theme')?.includes('dark');
    const encreClaire = document.documentElement.getAttribute('data-theme') === 'dark' && c.r > 235 && c.g > 235 && c.b > 235;
    return ambre || encre || encreClaire;
  }).map((e) => `${e.className} ${getComputedStyle(e).backgroundColor}`) : [];
  const bleus = liste ? [...liste.querySelectorAll('*')].filter(vis).filter((e) => { const c = rgb(getComputedStyle(e).backgroundColor); return c && c.a > 0.5 && c.b > 200 && c.r < 40 && c.g > 90 && c.g < 150; }) : [];
  return { lignes, pleines, bleus: bleus.length, bleuPrincipal: bleus.every((e) => e.closest('[data-fu-principal]')), pastilles: liste ? [...liste.querySelectorAll('.vrm-fu-pastille')].filter(vis).length : 0,
    pubEnv: (() => { try { return JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null'); } catch (_) { return null; } })(),
    deb: document.documentElement.scrollWidth - window.innerWidth };
});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  let nJourneeEnv = null;
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair']]) {
      if (VUES && !VUES.includes(nom)) continue;
      // ── MA JOURNÉE ──
      console.log(`\n— Ma journée · ${nom} · jeu ${JEU}${MUTATION ? ' · MUTATION ' + MUTATION : ''}`);
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'journee');
        await essaie('journee', async () => {
          await pg.locator('.vrm-day-layout').first().waitFor({ timeout: 30000 });
          if (JEU !== 'zero') await pg.locator('.vrm-fu-afaire [data-case="envoyer"]').first().waitFor({ timeout: 20000 });
          await pg.waitForTimeout(2200);
          const m = await mesureJournee(pg);
          const env = m.lignes.find((l) => l.cas === 'envoyer');
          if (JEU === 'zero') {
            dit(!env, 'jeu « zero » : aucune carte « Colis à poster »', JSON.stringify(m.lignes.map((l) => l.cas)));
          } else {
            dit(!!env && !!env.pile, 'J1 · la carte « Colis à poster » porte une vignette', env ? JSON.stringify(env.pile) : 'pas de carte');
            if (env && env.pile) {
              nJourneeEnv = env.n;
              dit(env.pile.n === env.n, 'J1 · la vignette parle du MÊME nombre que la carte (data-n)', `${env.pile.n} / ${env.n}`);
              const attendus = PHOTOS_ENVOYER.slice(0, 3);
              if (JEU === 'base' || SANS) dit(JSON.stringify(env.pile.srcs) === JSON.stringify(attendus), 'J1 · photos = celles des colis eux-mêmes (identité), le plus pressé d’abord', `${env.pile.srcs.join(' | ')} ≠ ${attendus.join(' | ')}`);
              else dit(env.pile.srcs.length === Math.min(3, PHOTOS_ENVOYER.length) && env.pile.srcs.every((s) => PHOTOS_ENVOYER.includes(s)), 'J1 · photos = celles des colis à poster eux-mêmes (identité)', env.pile.srcs.join(' | '));
              dit(!env.pile.srcs.some((s) => JUMEAUX.includes(s)), 'J1 · jamais la photo du JUMEAU au même titre (vente finalisée 8104, annonce 4001)', env.pile.srcs.join(' | '));
              const nn = Number(env.n);
              if (SANS) dit(env.pile.photos === 0 && env.pile.plus === 0, 'sans photo : tuile neutre, pas de « +k »', JSON.stringify(env.pile));
              else if (nn > 1) {
                dit(env.pile.estPile && env.pile.photos === Math.min(3, attendus.length), 'J2 · plusieurs colis ⇒ une PILE de 2-3 vignettes', JSON.stringify(env.pile));
                dit(env.pile.plus === Math.max(0, nn - env.pile.photos), 'J2 · le reste en « +k » (k = n − montrées)', `${env.pile.plus} pour n=${nn}, ${env.pile.photos} montrées`);
              } else dit(!env.pile.estPile && env.pile.photos === 1 && env.pile.plus === 0, 'J2 · un seul colis ⇒ une vignette, pas de pile ni de « +k »', JSON.stringify(env.pile));
              if (!SANS) dit(env.pile.imgs === env.pile.photos, 'les photos se chargent (pas de cadre vide)', `${env.pile.imgs}/${env.pile.photos}`);
              // (échelle fermée, 3 nov.) Le rayon 10 n'est pas sur l'échelle Fusion (6·12·14·20·24) : 12.
              dit(env.pile.w === 44 && env.pile.rayon === '12px', 'vignette 44 px, rayon 12 (échelle fermée, 3 nov.)', `${env.pile.w}px ${env.pile.rayon}`);
              dit(/^\d+ colis à poster/.test(env.titre.trim()), 'le titre dit le nombre (« 3 colis à poster »)', env.titre);
            }
            if (JEU === 'base' || SANS) {
              const ret = m.lignes.find((l) => l.cas === 'retirer'), msg = m.lignes.find((l) => l.cas === 'messages'), prix = m.lignes.find((l) => l.cas === 'prix');
              dit(!!ret && !!ret.pile && (SANS ? ret.pile.photos === 0 : JSON.stringify(ret.pile.srcs) === JSON.stringify([url(9), url(10)])), 'J1 · « à retirer » : les photos des ACHATS au relais', ret && JSON.stringify(ret.pile));
              dit(!!msg && !!msg.pile && (SANS ? msg.pile.photos === 0 : JSON.stringify(msg.pile.srcs) === JSON.stringify([url(11), url(12), url(13)])), 'J1 · « messages » : les photos des conversations non lues (article, sinon avatar), jamais la lue', msg && JSON.stringify(msg.pile));
              dit(!!prix && !!prix.pile && (SANS ? prix.pile.photos === 0 : JSON.stringify(prix.pile.srcs) === JSON.stringify([url(7), url(8)])), 'J1 · « prix à baisser » : les photos des ANNONCES elles-mêmes', prix && JSON.stringify(prix.pile));
            }
          }
          dit(m.pastilles === 0 && !m.pleines.length, 'J3 · aucune pastille pleine colorée (ni ambre, ni encre)', m.pleines.slice(0, 3).join(' | '));
          dit(new Set(m.lignes.map((l) => l.fond)).size <= 1, 'J3 · un seul fond de carte (pas de carte grisée)', [...new Set(m.lignes.map((l) => l.fond))].join(' | '));
          dit(m.bleus <= 1 && m.bleuPrincipal, 'J3 · le bleu seulement sur le geste principal', `${m.bleus} bleu(s)`);
          dit(m.deb <= 1, 'aucun débordement horizontal', `${m.deb}px`);
          if (SHOTS) {
            const suf = `${nom}${JEU === 'base' ? '' : '-' + JEU}${MUTATION ? '-mut' : ''}`;
            await pg.screenshot({ path: path.join(SHOTS, `journee-${suf}.png`) });
            const l = pg.locator('.vrm-fu-afaire'); if (await l.count()) await l.first().screenshot({ path: path.join(SHOTS, `afaire-${suf}.png`) });
          }
        });
        dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
        await ctx.close(); }
      if (MUTATION) continue;
      // ── COLIS ──
      console.log(`\n— Colis · ${nom} · jeu ${JEU}`);
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, 'cat_bord');
        await essaie('colis', async () => {
          await pg.locator('.vrm-colis-onglets').first().waitFor({ timeout: 30000 });
          await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null') && !!JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return false; } }, null, { timeout: 20000 }).catch(() => {});
          await pg.waitForTimeout(1500);
          if (process.env.JP_DBG) console.log('LBC', await pg.evaluate(() => [...document.querySelectorAll('[data-plateforme-colis="leboncoin"] img')].map((i) => [i.src, i.complete, i.naturalWidth])));
          const o = await pg.evaluate(() => ({
            choix: [...document.querySelectorAll('[data-colis-onglet-choix]')].map((e) => ({ v: e.getAttribute('data-colis-onglet-choix'), n: e.getAttribute('data-colis-onglet-n'), txt: e.innerText.replace(/\s+/g, ' ').trim() })),
            pubEnv: JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null'), pubRet: JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'),
          }));
          dit(o.choix.map((c) => c.v).join(',') === 'envoyer,envoyes,retirer', 'C1 · trois onglets : À envoyer · Envoyés · À retirer', o.choix.map((c) => c.txt).join(' / '));
          const cE = o.choix.find((c) => c.v === 'envoyer'), cR = o.choix.find((c) => c.v === 'retirer');
          dit(cE && o.pubEnv && cE.n === String(o.pubEnv.total), 'C1 · « À envoyer · N » = vrm_colis_aposter', `${cE && cE.n} / ${o.pubEnv && o.pubEnv.total}`);
          if (nJourneeEnv != null) dit(cE && cE.n === nJourneeEnv, 'C1 · le même N que la carte de Ma journée', `${cE && cE.n} / ${nJourneeEnv}`);
          dit(cR && o.pubRet && cR.n === String(o.pubRet.total), 'C1 · « À retirer · N » = vrm_colis_retirer', `${cR && cR.n} / ${o.pubRet && o.pubRet.total}`);
          const env = await pg.evaluate(() => {
            const cartes = [...document.querySelectorAll('[data-colis-lignes] [data-colis-ident]')];
            return { cartes: cartes.map((c) => ({ id: c.getAttribute('data-colis-ident'), site: c.getAttribute('data-plateforme-colis') || 'vinted', groupe: (() => { let p = c.previousElementSibling; while (p && !p.hasAttribute('data-groupe-transp')) p = p.previousElementSibling; return p ? p.getAttribute('data-groupe-transp') : ''; })() })),
              listes: document.querySelectorAll('[data-colis-lignes]').length, blocVc: !!document.querySelector('[data-colis-vestiaire]:not([data-colis-vestiaire="0"])'), groupes: [...document.querySelectorAll('[data-groupe-transp]')].map((g) => g.getAttribute('data-groupe-transp')) };
          });
          if (JEU === 'base') {
            const sites = new Set(env.cartes.map((c) => c.site));
            dit(sites.has('vinted') && sites.has('vestiaire') && sites.has('leboncoin'), 'C2 · Vinted, Vestiaire et Leboncoin dans LA MÊME liste', [...sites].join(', '));
            dit(env.listes === 1, 'C2 · une seule liste de colis', String(env.listes));
            dit(!env.blocVc, 'C2 · plus de bloc « Ventes Vestiaire à envoyer » à part');
            dit(new Set(env.groupes).size === env.groupes.length && env.groupes.length > 1, 'C2 · rangés par transporteur, un en-tête chacun', env.groupes.join(' | '));
            const vcC = env.cartes.find((c) => c.site === 'vestiaire');
            dit(vcC && vcC.groupe === 'Chronopost', 'C2 · la vente Vestiaire est sous SON transporteur (Chronopost)', vcC && vcC.groupe);
          }
          const nCartes = env.cartes.length;
          if (o.pubEnv) dit(nCartes === o.pubEnv.total, 'C2 · autant de cartes que « À envoyer · N »', `${nCartes} / ${o.pubEnv.total}`);
          if (SHOTS) { const suf = `${nom}${JEU === 'base' ? '' : '-' + JEU}`; await pg.screenshot({ path: path.join(SHOTS, `colis-envoyer-${suf}.png`) });
            if (vp.width < 600) { await pg.setViewportSize({ width: vp.width, height: 2600 }); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(SHOTS, `colis-envoyer-${suf}-long.png`) }); await pg.setViewportSize(vp); } }
          // « Envoyés »
          await pg.locator('[data-colis-onglet-choix="envoyes"]').first().click();
          await pg.waitForTimeout(900);
          if (process.env.JP_DBG) console.log(await pg.evaluate(() => [...document.querySelectorAll('[data-plateforme-colis="leboncoin"] img')].map((i) => [i.src, i.complete, i.naturalWidth])));
          if (process.env.JP_DBG) console.log(await pg.evaluate(() => ({ sec: !!document.querySelector('[data-colis-envoyes]'), lect: (document.querySelector('[data-colis-lecture]') || {}).textContent, onglet: (document.querySelector('[data-colis-onglet]') || { getAttribute: () => '' }).getAttribute('data-colis-onglet'), txt: document.querySelector('.vrm-main').innerText.slice(0, 600) })));
          const ev = await pg.evaluate(() => ({
            n: (document.querySelector('[data-colis-onglet-choix="envoyes"]') || { getAttribute: () => null }).getAttribute('data-colis-onglet-n'),
            cartes: [...document.querySelectorAll('[data-colis-envoyes] [data-colis-envoye]')].map((c) => ({ id: c.getAttribute('data-colis-envoye'), site: c.getAttribute('data-plateforme-colis'), frise: c.querySelector('[data-fu-frise]') ? [...c.querySelectorAll('[data-fu-etape]')].filter((s) => s.getAttribute('data-fait') === '1').map((s) => s.getAttribute('data-fu-etape')).join(',') : null })),
            aEnvoyerVisibles: [...document.querySelectorAll('[data-colis-lignes] [data-colis-ident]')].length,
          }));
          dit(ev.n === String(ev.cartes.length), 'C3 · « Envoyés · N » = le nombre de cartes de l’onglet', `${ev.n} / ${ev.cartes.length}`);
          dit(ev.aEnvoyerVisibles === 0, 'C3 · l’onglet « Envoyés » ne redit aucun colis à envoyer', String(ev.aEnvoyerVisibles));
          if (JEU === 'base') {
            const f5 = ev.cartes.find((c) => c.id === 'v:8105'), f6 = ev.cartes.find((c) => c.id === 'v:8106');
            dit(!!f5 && f5.frise === 'imprime,depose,enroute', 'C3 · 8105 « en route » : Imprimé · Déposé · En route (pas Livré)', f5 && f5.frise);
            dit(!!f6 && f6.frise === 'imprime,depose,enroute,livre', 'C3 · 8106 « livré » : les quatre étapes', f6 && f6.frise);
            dit(ev.cartes.some((c) => c.site === 'leboncoin'), 'C3 · le colis Leboncoin parti est dans « Envoyés »', JSON.stringify(ev.cartes.map((c) => c.id)));
            dit(!ev.cartes.some((c) => /8101|8102|8103/.test(c.id)), 'C3 · aucun colis à poster dans « Envoyés »');
          }
          if (SHOTS) { const suf = `${nom}${JEU === 'base' ? '' : '-' + JEU}`; await pg.screenshot({ path: path.join(SHOTS, `colis-envoyes-${suf}.png`) }); }
          const deb = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          dit(deb <= 1, 'Colis : aucun débordement horizontal', `${deb}px`);
          await pg.locator('[data-colis-onglet-choix="retirer"]').first().click();
          await pg.waitForTimeout(700);
          if (SHOTS) { const suf = `${nom}${JEU === 'base' ? '' : '-' + JEU}`; await pg.screenshot({ path: path.join(SHOTS, `colis-retirer-${suf}.png`) }); }
        });
        dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
        await ctx.close(); }
    }
  } finally { await b.close(); srv.close(); if (DIST !== DIST0) fs.rmSync(DIST, { recursive: true, force: true }); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
