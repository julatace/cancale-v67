// BANC DE REVUE VISUELLE — rend CHAQUE écran joignable et ses sous-onglets
// (Ma journée, Vinted ×4, Leboncoin ×5, eBay ×6, Colis, Stock, Statistiques,
// Comptabilité, Réglages et chacun de ses sous-écrans téléphone, Mon compte, la
// feuille « Ton espace », la recherche, et quelques feuilles : eBay « Vendre une
// paire », prix d'achat en série, bordereau) à 390 px (isMobile + hasTouch),
// clair ET sombre, et à 1512 px. Demande de Julien (16 octobre) : « ça fait
// encore trop vibe-codé ».
//
// Ce banc ne juge pas : il PRODUIT des captures et des MESURES pour une revue
// humaine (§6.2 : regarder la capture fait partie du test). Il ne sort en
// échec que si un écran tombe (garde-fou, erreur de page).
//
// Données INVENTÉES (aucune donnée réelle : il vit dans le dépôt, public).
// Mesures par écran (JSON) : cibles tactiles < 44 px, éléments qui sortent à
// droite, textes coupés, emojis servant d'icônes, tailles de texte, rayons,
// couleurs saturées, textes répétés, mots d'informaticien, murs de gris,
// dernier contenu sous la barre du bas.
//
// Lancer : npm run build && SHOTS=<dossier> BANC_PORT=56xx node scripts/bancs/revue-ecrans.cjs
//   ECRANS=journee,plat_ebay  ne rend que ces écrans ;  TAILLES=390c,390s,1512c
'use strict';
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 5661;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'revue-ecrans');
const FILTRE = (process.env.ECRANS || '').split(',').filter(Boolean);
const TAILLES = (process.env.TAILLES || '390c,390s,1512c').split(',');

// ── Données inventées ───────────────────────────────────────────────────────
const maintenant = new Date(2026, 9, 15, 15, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const ts = (j) => Math.floor(il(j).getTime() / 1000);
const cap = maintenant.toISOString();
const UID = '111', UID2 = '222';
let nPh = 0;
const ph = (id) => ({ url: `https://images1.vinted.net/t/b${++nPh}/f800/${id}.jpeg?s=x` });
const vente = (id, titre, prix, statut, d, extra = {}) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: d.toISOString(), photo: ph(id), ...extra });
const VENTES = [
  vente(7001, 'Nike Air Max 90 blanche taille 42', 65, 'Le paiement a été validé', il(0, 11), { transaction_user_status: 'needs_action', item_id: 9101 }),
  vente(7002, 'Adidas Samba OG noir taille 40', 72, 'Le paiement a été validé', il(0, 9), { transaction_user_status: 'needs_action' }),
  vente(7003, 'Salomon XT-6 gris taille 43', 110, 'Colis en cours d\'acheminement', il(1), { transaction_user_status: 'waiting' }),
  vente(7004, 'New Balance 550 crème taille 41', 58, 'Commande finalisée', il(3), { transaction_user_status: 'completed' }),
  vente(7005, 'Asics Gel-Kayano 14 argent taille 44', 89, 'Commande finalisée', il(2), { transaction_user_status: 'completed' }),
  vente(7006, 'Nike Dunk Low panda taille 38', 61, 'Commande finalisée', il(8), { transaction_user_status: 'completed' }),
  vente(7007, 'Adidas Spezial bleu taille 39', 54, 'Commande finalisée', il(10), { transaction_user_status: 'completed' }),
  vente(7009, 'Nike Shox TL noir taille 41', 95, 'Commande annulée', il(1)),
];
const VERSE = { 7004: il(1), 7005: il(0, 10), 7006: il(5), 7007: il(7) };
const achat = (id, titre, prix, statut, j, extra = {}) => ({ transaction_id: id, conversation_id: 7000 + id % 1000, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: il(j).toISOString(), photo: ph(id), ...extra });
const ACHATS = [
  achat(9301, 'Nike Air Max 90 blanche taille 43', 38, 'Colis déposé en point relais', 4, { transaction_user_status: 'needs_action' }),
  achat(9303, 'Salomon XT-6 Advanced gris anthracite taille 44 2/3', 112, 'Colis en cours d\'acheminement', 2),
  achat(9304, 'New Balance 550 crème taille 41', 52, 'Bordereau envoyé au vendeur', 1),
  achat(9305, 'Asics Gel-Kayano 14 argent taille 44', 61.9, 'Commande finalisée', 12),
  achat(9307, 'Converse Chuck 70 noir taille 42', 29, 'Commande annulée', 15),
];
const RELAIS = { 9301: { code: '012345', lieu: 'Phone Cash, 12 rue du Port, 35260 Cancale', transporteur: 'mondialrelay', at: cap } };
const ann = (id, titre, prix, o = {}) => Object.assign({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, brand_title: titre.split(' ')[0], size_title: (/taille ([\d,]+)/.exec(titre) || [])[1] || '', status: 'Très bon état', is_closed: false, is_hidden: false, is_draft: false, photo: ph(id), nPhotos: 6, view_count: 40, favourite_count: 3, created_at_ts: ts(6) }, o);
const ITEMS_A = [
  ann(9101, 'Nike Air Max 1 obsidian lilac taille 42', 119, { promoted: true, created_at_ts: ts(45), favourite_count: 12, view_count: 310 }),
  ann(9102, 'Salomon XT-6 Advanced blanc lunar rock taille 40', 145, { created_at_ts: ts(3) }),
  ann(9103, 'Adidas Samba OG noir gomme taille 38,5', 89, { created_at_ts: ts(12), favourite_count: 7 }),
  ann(9104, 'New Balance 550 blanc vert taille 43', 79, { created_at_ts: ts(38), favourite_count: 0, view_count: 18 }),
  ann(9105, 'Asics Gel-Kayano 14 argent crème taille 44', 249.5, { created_at_ts: ts(2) }),
  ann(9106, 'Nike Dunk Low panda taille 41', 72, { created_at_ts: ts(4), favourite_count: 10, view_count: 25 }),
];
const ITEMS_B = [
  ann(9201, 'Converse Chuck 70 high noir taille 42', 58, { created_at_ts: ts(9) }),
  ann(9202, 'Puma Speedcat rouge daim taille 39', 95, { created_at_ts: ts(20) }),
];
const MAIN = {
  vinted_annonce_numeros: {
    '9101': { numero: '41', buyPrice: '45' }, '9102': { numero: '42', buyPrice: '70' }, '9103': { numero: '43' },
    '9104': { numero: '44', buyPrice: '30' }, '9106': { numero: '45' }, '9201': { numero: '46' }, '9202': { numero: '47', buyPrice: '40' },
  },
  vrm_prenom: 'Julien',
  vinted_garage_grid: { 'A-1': ['41', '42', '', '43'], 'A-2': ['44', '', '45'] },
};
const DETAILS = Object.fromEntries([...ITEMS_A, ...ITEMS_B].map((it, k) => [String(it.id), { photos: Array.from({ length: 4 }, (_, i) => `https://images1.vinted.net/t/b${k * 7 + i}/f800/d${it.id}-${i}.jpeg`), description: 'Très bon état, portée quelques fois.' }]));
const conv = (id, login, desc, unread, h) => ({ id, unread, updated_at: new Date(maintenant.getTime() - h * 36e5).toISOString(), description: desc, opposite_user: { id: 5000 + id, login }, item_photos: [ph('c' + id)] });
const ACCS = [
  { id: 1, vinted_user_id: UID, login: 'boutique_demo', domain: 'www.vinted.fr', updated_at: cap },
  { id: 2, vinted_user_id: UID2, login: 'second_compte', domain: 'www.vinted.fr', updated_at: cap },
];
const lbc = (txId, titre, cents, o) => Object.assign({ txId, title: titre, price: cents, isSeller: true, at: il(2).toISOString(), dateVente: il(2).toISOString() }, o);
const LBC_VENTES = { ventes: {
  l1: lbc('l1', 'Nike Air Force 1 blanc taille 42 — très bon état', 6500, { stepStatus: 'done', stepLabel: 'Paiement effectué', parcelColor: 'finished', deliveryLabel: 'Mondial Relay' }),
  l2: lbc('l2', 'Adidas Gazelle bleu taille 40', 7200, { stepLabel: 'Colis à envoyer', deliveryLabel: 'Colissimo' }),
  a1: lbc('a1', 'Lot New Balance 990v5 gris taille 43', 8500, { isSeller: false, stepStatus: 'done', stepLabel: 'Terminé' }),
} };
const LBC_LISTINGS = { items: [
  { id: 'lb1', ref: 'VRM-41', subject: 'Nike Air Max 1 obsidian lilac T42', price: 119, status: 'active', url: 'https://www.leboncoin.fr/ad/1' },
], capturedAt: cap };
const LBC_MSG = { compteurs: { u1: { unread: 3, at: cap } }, comptes: { u1: { name: 'Compte LBC', pro: false, at: cap } } };
const ep = (k) => `https://img.test/e${k}.jpg`;
const EBAY_ANNONCES = [
  { itemId: '110000000041', title: 'Nike Air Max 1 obsidian lilac taille 42', price: '125.0', sku: 'VRM-41', observateurs: 4, currency: 'EUR', photo: ep(1), url: 'https://www.ebay.fr/itm/110000000041', depuis: il(10).toISOString() },
  { itemId: '110000000099', title: 'Asics Gel 1130 argent taille 39', price: '75.0', sku: '', observateurs: 2, currency: 'EUR', photo: ep(3), url: 'https://www.ebay.fr/itm/110000000099' },
];
const EBAY_COMMANDES = [
  { orderId: '07-001', creationDate: il(1).toISOString(), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', lineItems: [{ sku: 'VRM-44', title: 'New Balance 550 blanc vert taille 43', legacyItemId: '110000000044' }], pricingSummary: { total: { value: '89.00', currency: 'EUR' } } },
  { orderId: '07-002', creationDate: il(6).toISOString(), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'FULFILLED', lineItems: [{ sku: '', title: 'Nike Cortez blanc rouge taille 41' }], pricingSummary: { total: { value: '64.00', currency: 'EUR' } } },
];
const PDF_B64 = (() => { try { return fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim(); } catch (_) { return ''; } })();
const LIGNES = [
  { id: 'main', data: MAIN },
  { id: 'panel_colis_relais', data: RELAIS },
  { id: 'email_track_mondialrelay_MR1234567', data: { status: 'available', statusLabel: 'Arrivé au point de retrait', code: '7731', lieu: 'Tabac de la Houle', carrier: 'mondialrelay', suivi: 'MR1234567', receivedAt: il(1).toISOString(), limite: il(-3).toISOString() } },
  { id: 'email_bord_banc_7001', data: { transaction: '7001', filename: 'bordereau-7001.pdf', article: VENTES[0].title, receivedAt: il(0, 10).toISOString(), dateLimite: il(-5).toISOString(), pdfB64: PDF_B64 } },
  { id: `harvest_${UID}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${UID2}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: ACHATS } } },
  { id: `harvest_${UID2}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: `harvest_${UID}_listings`, data: { capturedAt: cap, payload: { items: ITEMS_A, pagination: { total_entries: ITEMS_A.length } } } },
  { id: `harvest_${UID2}_listings`, data: { capturedAt: cap, payload: { items: ITEMS_B, pagination: { total_entries: ITEMS_B.length } } } },
  { id: `harvest_${UID}_inbox`, data: { capturedAt: cap, payload: { conversations: [
    conv(301, 'margaux_lp', 'Super. Vous feriez 45 € ?', true, 5), conv(303, 'kevin.b', 'Merci, bien reçu, nickel !', false, 26),
    conv(305, 'sneakers_addict_du_35', 'Vous pouvez m’envoyer une photo de la semelle de près ?', true, 50),
  ] } } },
  { id: `harvest_${UID2}_inbox`, data: { capturedAt: cap, payload: { conversations: [conv(402, 'lea.m', 'Est-ce que vous faites un lot avec les Samba ?', false, 80)] } } },
  { id: `harvest_${UID}_billing`, data: { capturedAt: cap, payload: { escrow: { amount: '420.00', currency_code: 'EUR' }, main: { amount: '96.50', currency_code: 'EUR' } } } },
  ...Object.entries(VERSE).map(([tx, d]) => ({ id: `harvest_${UID}_txn_${tx}`, data: { capturedAt: cap, payload: { transaction: { id: Number(tx), status: 450, status_title: 'Commande finalisée', status_updated_at: d.toISOString() } } } })),
  { id: 'vinted_item_details', data: DETAILS },
  { id: 'vinted_lbc_posted', data: { ids: ['9101'] } },
  { id: 'lbc_ventes', data: LBC_VENTES },
  { id: 'lbc_listings', data: LBC_LISTINGS },
  { id: 'lbc_messages', data: LBC_MSG },
  { id: 'ebay_listings', data: { items: EBAY_ANNONCES, capturedAt: Date.now() } },
  { id: 'ebay_orders', data: { orders: EBAY_COMMANDES, capturedAt: Date.now() } },
  { id: 'ebay_programmees', data: { items: [], enLigne: [], complet: true, capturedAt: Date.now() } },
  { id: 'ebay_brouillons', data: { items: { 'b-47': { id: 'b-47', numero: '47', pairId: '9202', titre: 'Puma Speedcat rouge daim taille 39', prix: '99', etatBrouillon: 'brouillon' } }, majAt: Date.now() } },
];
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3 * 24 * 400, user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeuse@exemple.test' } };
const ABO = { ok: true, proprietaire: false, configure: true, modeTest: true, obligatoire: false, prix: { montant: 12.99, devise: 'eur', intervalle: 'month' }, prixConforme: true, prixStripe: null, statut: 'active', finPeriode: '2026-11-04T10:00:00.000Z', annuleFinPeriode: false, peutGerer: true, actif: true, acces: true, prixAbonnement: { montant: 12.99, devise: 'eur', intervalle: 'month', texte: '12,99 € / mois' } };
const FACTURES = { ok: true, carte: { marque: 'visa', fin: '4242', mois: 12, annee: 2027 }, factures: [{ id: 'in_1', numero: 'VRM-0001', date: '2026-10-04T10:00:00.000Z', montant: 12.99, devise: 'eur', statut: 'paid', pdf: 'https://pay.stripe.com/invoice/x.pdf', url: 'https://invoice.stripe.com/i/x' }] };

// ── Serveur et réseau simulé ────────────────────────────────────────────────
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
const teintes = ['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf', '#d8d0d6', '#d3d8de', '#ddd8cc', '#cdd2d8', '#d6d1c8'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="${teintes[k % teintes.length]}"/><path d="M90 500 C120 410 210 395 270 425 C330 455 400 432 460 470 C500 492 492 545 432 548 L130 548 C98 548 84 528 90 500 Z" fill="rgba(30,34,40,.55)"/></svg>`;
const projette = (row, sel) => {
  if (!sel || sel === '*') return { ...row, updated_at: cap };
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : (/->>/.test(src) ? String(v) : v));
  }
  return out;
};

const ouvrir = async (b, taille, tab) => {
  const tel = taille.startsWith('390'), sombre = taille.endsWith('s');
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  // Le Stock 3D boucle sur requestAnimationFrame : sous l'horloge simulée la
  // capture n'aboutit jamais. Il garde l'heure réelle.
  if (tab !== 'garage') await pg.clock.install({ time: maintenant });
  await pg.addInitScript(([d, s]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_prenom', JSON.stringify('Julien')); localStorage.setItem('vinted_dark', JSON.stringify(d)); localStorage.setItem('vrm_bascule_mineral_v1', '1'); } catch (_) {} }, [sombre, SESSION]);
  await pg.route(/^https?:\/\/[^/]*(vinted\.net|img\.test)\//i, (r) => { const m = /\/b(\d+)\/|\/e(\d+)\.jpg/.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1] || m[2]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net|img\.test)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user, ...SESSION.user }) }));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, (d.length || 1) - 1)}/${d.length || 0}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([], 201);
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    if (!/\/rest\/v1\/app_data/.test(u)) return j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map((r) => projette(r, sel))); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    const j = (d, st) => r.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (/mode=abonnement/.test(u)) return j(ABO);
    if (/mode=factures/.test(u)) return j(FACTURES);
    if (/\/api\/ebay/.test(u)) {
      if (r.request().method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
      let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (_) {}
      if (body.action === 'status') return j({ ok: true, connected: true });
      if (body.action === 'offreinfo') return j({ ok: true, eligibles: ['110000000041'], complet: true });
      if (body.action === 'agent') return j({ ok: true, sources: [{ ok: true }], journalLisible: true, journal: [], tasks: [{ id: 't1', section: 'ventes', title: 'New Balance 550 blanc vert taille 43', ref: '07-001', label: 'Expédier la commande', entityId: '07-001' }] });
      if (body.action === 'messages') return j({ ok: true, totalPages: 1, messages: [
        { id: 'm1', itemId: '110000000041', titre: 'Nike Air Max 1 obsidian lilac taille 42', subject: 'Question sur la taille', sender: 'acheteur_fr', body: 'Bonjour, elle taille grand ?', date: il(0, 9).toISOString() },
        { id: 'm2', itemId: '110000000099', titre: 'Asics Gel 1130 argent taille 39', subject: 'Envoi', sender: 'collector_de', body: 'Do you ship to Germany?', date: il(1).toISOString() },
      ] });
      if (body.action === 'offresrecues') return j({ ok: true, totalPages: 1, offres: [
        { id: 'o1', itemId: '110000000041', titre: 'Nike Air Max 1 obsidian lilac taille 42', buyer: 'acheteur_fr', quantity: 1, price: '105.00', currency: 'EUR', status: 'Active', expiresAt: new Date(maintenant.getTime() + 20 * 36e5).toISOString(), message: 'Je peux payer tout de suite.' },
      ] });
      return j({ ok: true });
    }
    return j({ pret: true });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('.vrm-main') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(2200);
  return { ctx, pg, errs, tel };
};

// ── Mesures sur ce qui est RENDU ────────────────────────────────────────────
const mesurer = (pg, tel, racineSel) => pg.evaluate(({ tel, racineSel }) => {
  const W = innerWidth;
  const racine = (racineSel && document.querySelector(racineSel)) || document.querySelector('.vrm-main') || document.body;
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; if (e.checkVisibility && !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false; return !e.closest('details:not([open]) > :not(summary)') && !e.closest('[hidden]'); };
  const lib = (e) => (e.getAttribute('aria-label') || e.innerText || e.value || e.placeholder || e.tagName).replace(/\s+/g, ' ').trim().slice(0, 40);
  const res = { petits: [], sortent: [], coupes: [], emojis: [], tailles: {}, rayons: {}, couleurs: {}, repetes: [], jargon: [], gris: [], pistes: [] };
  const all = [...racine.querySelectorAll('*')].filter((e) => !e.closest('svg') && vis(e));
  if (tel) for (const e of all) {
    if (!e.matches('button, a[href], [role="button"], [role="tab"], input:not([type="hidden"]), select, textarea, summary, label:has(input[type="checkbox"])')) continue;
    if (e.matches('input[type="checkbox"], input[type="radio"]') && e.closest('label')) continue;
    const r = e.getBoundingClientRect();
    if (r.height < 43.5) res.petits.push(`${lib(e)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  for (const e of all) {
    const r = e.getBoundingClientRect();
    if (r.right > W + 1 || r.left < -1) {
      let excuse = false;
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflowX === 'hidden' || s.overflowX === 'clip') { excuse = true; break; } }
      if (!excuse && !e.children.length) res.sortent.push(`${lib(e)} →${Math.round(r.right)}`);
    }
    const s = getComputedStyle(e);
    if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && e.scrollWidth > e.clientWidth + 4) {
      res.pistes.push(`${lib(e).slice(0, 30)} : ${e.clientWidth}/${e.scrollWidth}px (masque=${s.maskImage !== 'none' || s.webkitMaskImage !== 'none' ? 'oui' : 'non'})`);
    }
    if (!e.children.length && (e.textContent || '').trim()) {
      const t = e.textContent.trim();
      if (e.scrollWidth > e.clientWidth + 1 && (s.textOverflow === 'ellipsis' || s.overflow === 'hidden' || s.overflowX === 'hidden')) res.coupes.push(t.slice(0, 50));
      res.tailles[s.fontSize] = (res.tailles[s.fontSize] || 0) + 1;
      const c = s.color.match(/\d+(\.\d+)?/g).map(Number); const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]);
      if (mx - mn > 60) { const k = `rgb(${c[0]},${c[1]},${c[2]})`; (res.couleurs[k] = res.couleurs[k] || []).length < 3 && res.couleurs[k].push(t.slice(0, 24)); }
      const em = t.match(/\p{Extended_Pictographic}/gu);
      if (em) res.emojis.push(`${em.join('')} « ${t.slice(0, 36)} »`);
      if (/\b(extension|supabase|api|jeton|token|sync(hro)?|capt(é|ée|er|ure|ées)|moisson|base de données|null|undefined|NaN|JSON|SKU|HTTP|pont|cookie|serveur|cache|requête|webhook|script)\b/i.test(t)) res.jargon.push(t.slice(0, 90));
      const col = s.color; if (t.length > 160) res.gris.push(`${t.length} car. ${col} « ${t.slice(0, 50)}… »`);
    }
    if (s.borderRadius !== '0px' && (s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.borderTopWidth !== '0px') && r.height > 20) res.rayons[s.borderRadius] = (res.rayons[s.borderRadius] || 0) + 1;
  }
  const vus = {};
  for (const e of all) { if (e.children.length) continue; const t = (e.innerText || '').replace(/\s+/g, ' ').trim(); if (t.length >= 18) vus[t] = (vus[t] || 0) + 1; }
  res.repetes = Object.entries(vus).filter(([, n]) => n > 1).map(([t, n]) => `×${n} « ${t.slice(0, 70)} »`);
  const tete = document.querySelector('.vrm-app-header [data-titre-ecran]');
  res.titreTete = tete ? tete.innerText.trim() : '';
  res.h1 = [...racine.querySelectorAll('h1,h2')].filter(vis).map((h) => h.innerText.trim().slice(0, 40)).slice(0, 6);
  res.segActif = [...document.querySelectorAll('[data-segment] [aria-current="page"]')].map((e) => e.innerText.trim());
  res.deb = document.documentElement.scrollWidth - W;
  res.tombe = /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText);
  return res;
}, { tel, racineSel });

// Dernier contenu sous la barre du bas (téléphone).
const finDePage = (pg) => pg.evaluate(async () => {
  const main = document.querySelector('.vrm-main'); const nav = document.querySelector('.vrm-mobile-nav');
  if (!main || !nav) return null;
  main.scrollTop = main.scrollHeight; await new Promise((r) => setTimeout(r, 350));
  const haut = nav.getBoundingClientRect().top; let bas = 0, quoi = '';
  for (const e of main.querySelectorAll('*')) {
    if (e.children.length) continue; if (e.checkVisibility && !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const r = e.getBoundingClientRect(); if (r.height < 4 || getComputedStyle(e).position === 'fixed') continue;
    if (r.bottom > bas && r.top < innerHeight) { bas = r.bottom; quoi = (e.innerText || e.tagName).trim().slice(0, 30); }
  }
  return { sous: bas > haut + 0.5, det: `${Math.round(bas)} / barre ${Math.round(haut)} (${quoi})` };
});

// Captures : le haut, puis des écrans successifs en faisant défiler la zone.
const captures = async (pg, nom, tel, n) => {
  const out = [];
  await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); });
  await pg.waitForTimeout(250);
  for (let i = 0; i < n; i++) {
    const f = path.join(SHOTS, `${nom}-${i}.png`);
    await pg.screenshot({ path: f });
    out.push(f);
    const fini = await pg.evaluate(() => {
      const m = document.querySelector('.vrm-main');
      const el = m && m.scrollHeight > m.clientHeight + 4 ? m : document.scrollingElement;
      const avant = el.scrollTop; el.scrollTop += el.clientHeight * 0.82; return el.scrollTop === avant;
    });
    if (fini) break;
    await pg.waitForTimeout(350);
  }
  return out;
};

// ── Les écrans ──────────────────────────────────────────────────────────────
const sec = (s) => async (pg) => { await pg.click(`[data-segment] [data-section="${s}"]`, { timeout: 4000 }); await pg.waitForTimeout(1400); };
const ECRANS = [
  { nom: 'journee', tab: 'journee' },
  ...['ventes', 'achats', 'annonces', 'messages'].map((s) => ({ nom: `vinted-${s}`, tab: 'plat_vinted', avant: sec(s) })),
  ...['ventes', 'achats', 'annonces', 'messages', 'colis'].map((s) => ({ nom: `lbc-${s}`, tab: 'plat_leboncoin', avant: sec(s) })),
  ...['ventes', 'annonces', 'messages', 'offres', 'agent', 'compte'].map((s) => ({ nom: `ebay-${s}`, tab: 'plat_ebay', avant: sec(s) })),
  { nom: 'colis', tab: 'cat_bord' },
  { nom: 'stock', tab: 'garage' },
  { nom: 'statistiques', tab: 'dashboard' },
  { nom: 'compta', tab: 'compta' },
  { nom: 'reglages', tab: 'settings' },
  { nom: 'moncompte', tab: 'settings', avant: async (pg) => { await pg.click('[data-onglets-reglages] [data-vue="compte"]', { timeout: 4000 }); await pg.waitForTimeout(1200); } },
  { nom: 'menu', tab: 'journee', tel: true, n: 1, avant: async (pg) => { await pg.locator('.vrm-mobile-nav').getByRole('button', { name: 'Gestion', exact: true }).tap(); await pg.waitForTimeout(700); } },
  { nom: 'recherche', tab: 'journee', n: 1, avant: async (pg) => { await pg.click('[aria-label="Rechercher une paire"]', { timeout: 4000 }); await pg.waitForTimeout(500); await pg.keyboard.type('nike'); await pg.waitForTimeout(900); } },
  { nom: 'ebay-vendre', tab: 'plat_ebay', n: 3, avant: async (pg) => { await sec('annonces')(pg); await pg.click('[data-poster="ebay"]', { timeout: 4000 }); await pg.waitForTimeout(900); } },
  { nom: 'prixachat', tab: 'settings', n: 2, avant: async (pg) => { await pg.getByText("Compléter les prix d'achat", { exact: false }).first().click({ timeout: 4000 }); await pg.waitForTimeout(1800); } },
  { nom: 'bordereau', tab: 'plat_vinted', n: 2, avant: async (pg) => { await sec('ventes')(pg); await pg.click('[data-bouton-bord]', { timeout: 4000 }); await pg.waitForTimeout(1500); } },
];

let ko = 0;
(async () => {
  let b; const rapport = {};
  try {
    await new Promise((res) => srv.listen(PORT, res));
    fs.mkdirSync(SHOTS, { recursive: true });
    // Un navigateur neuf par écran : le Stock 3D (WebGL logiciel) peut laisser
    // le navigateur à genoux, et les captures suivantes expiraient.
    const lancer = () => chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const taille of TAILLES) {
      for (const e of ECRANS) {
        if (FILTRE.length && !FILTRE.includes(e.nom)) continue;
        if (e.tel && !taille.startsWith('390')) continue;
        const cle = `${e.nom}-${taille}`;
        for (let essai = 0; essai < 2; essai++) {
        if (b) await b.close().catch(() => {});
        b = await lancer();
        try {
          const { ctx, pg, errs, tel } = await ouvrir(b, taille, e.tab);
          if (e.avant) await e.avant(pg);
          const m = await mesurer(pg, tel);
          m.shots = await captures(pg, cle, tel, e.n || (tel ? 4 : 2));
          if (tel && !e.n) m.fin = await finDePage(pg);
          m.erreurs = errs;
          if (m.tombe || errs.length) { ko++; console.log(`❌ ${cle} : ${m.tombe ? 'garde-fou' : errs.join(' | ').slice(0, 160)}`); }
          else console.log(`✅ ${cle} · ${m.shots.length} capture(s) · ${m.petits.length} petites cibles · ${m.coupes.length} coupés · ${m.emojis.length} emojis`);
          rapport[cle] = m;
          // Sous-écrans de Réglages (téléphone) : un par ligne qui ouvre.
          if (e.nom === 'reglages' && tel) {
            const ids = await pg.evaluate(() => [...document.querySelectorAll('[data-sous-ouvrir]')].map((x) => x.getAttribute('data-sous-ouvrir')));
            for (const id of ids) {
              await pg.evaluate(() => { const r = document.querySelector('[data-sous-retour]'); if (r) r.click(); });
              await pg.waitForTimeout(300);
              await pg.evaluate((id) => { const x = document.querySelector(`[data-sous-ouvrir="${id}"]`); if (x) x.click(); }, id);
              await pg.waitForTimeout(900);
              const ms = await mesurer(pg, tel);
              ms.shots = await captures(pg, `reglages_${id}-${taille}`, tel, 3);
              rapport[`reglages_${id}-${taille}`] = ms;
              console.log(`   ↳ sous-écran ${id} · ${ms.petits.length} petites cibles`);
            }
          }
          await ctx.close();
          break;
        } catch (err) {
          if (essai === 0 && /closed|Failed to open/.test(String(err.message || err))) continue;
          ko++; console.log(`❌ ${cle} : ${String(err.message || err).split('\n')[0].slice(0, 200)}`); rapport[cle] = { echec: String(err.message || err).slice(0, 300) }; }
        }
      }
    }
  } catch (err) { ko++; console.log('❌ banc : ' + String(err.message || err).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  let avant = {}; try { avant = JSON.parse(fs.readFileSync(path.join(SHOTS, 'mesures.json'), 'utf8')); } catch (_) {}
  fs.writeFileSync(path.join(SHOTS, 'mesures.json'), JSON.stringify(Object.assign(avant, rapport), null, 1));
  console.log(`\nCaptures et mesures : ${SHOTS} · ${ko} écran(s) en erreur`);
  process.exit(ko ? 1 : 0);
})();
