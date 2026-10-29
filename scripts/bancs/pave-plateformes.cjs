// Banc : PLUS DE SAISIE « N° + Entrée » SUR LEBONCOIN ET eBAY (29 octobre).
// Julien : « enlève N°+entrée sur chaque onglet, il y a déjà la barre de
// recherche ». Aucune saisie N°, un chiffre tapé hors d'un champ ne fait rien,
// aucune écriture, aucune erreur de page. Données INVENTÉES.
// Banc : LE PAVÉ NUMÉRIQUE SUR LEBONCOIN ET eBAY (27 octobre). Données reprises
// de plateformes-premium.cjs (inventées). Julien : « fais pareil pour le pavé
// numérique sur Leboncoin et eBay » (comme le Stock). Il JOUE le clavier :
//   · un chiffre tapé n'importe où ouvre la saisie ; N° + Entrée montre la paire
//     sur ce site (vente, sinon annonce, sinon « à publier ») ;
//   · Verr Num éteint (« ArrowLeft » + code Numpad4) marche aussi ;
//   · un N° qui ne désigne rien le dit, sans changer d'onglet ;
//   · un chiffre tapé DANS un champ ne déclenche rien ; rien n'est écrit ;
//   · au téléphone, pas de saisie (pas de pavé).
// Ce qui suit vient du banc d'origine :
// Banc : Annonces (Vinted), Leboncoin et eBay « premium » sur téléphone (390 px)
// et ordinateur (1512 px). Demande de Julien (16 octobre) : l'app « ne fait pas
// premium et classe » sur iPhone ; Ma journée et Statistiques ont été refaits,
// ces trois écrans doivent suivre.
//
// Données INVENTÉES et réalistes (aucune donnée réelle : ce banc vit dans le
// dépôt, qui est public). Il juge ce qui est RENDU, jamais un libellé (§6.5) :
//   1. chaque écran s'affiche, sans erreur de page ni garde-fou d'écran ;
//   2. aucun débordement horizontal (page, et aucun élément qui sort à droite) ;
//   3. aucun MONTANT coupé (un texte en « € » plus large que sa boîte) ;
//   4. au téléphone, aucune cible tactile (bouton, lien-bouton, champ, liste,
//      repli) de moins de 44 px de haut dans l'écran de la plateforme ;
//   5. les attributs que les autres bancs lisent sont toujours là.
// Captures : SHOTS=<dossier> node scripts/bancs/plateformes-premium.cjs
// Lancer : npm run build && BANC_PORT=51xx node scripts/bancs/plateformes-premium.cjs
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 5146;
const SHOTS = process.env.SHOTS || '';

const maintenant = new Date(2026, 9, 15, 15, 30, 0);
const ilYaJ = (j, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - j); return d; };
const ts = (j) => Math.floor(ilYaJ(j).getTime() / 1000);
const cap = maintenant.toISOString();
let nPhoto = 0;
const photo = (id) => ({ url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` });
const ann = (id, titre, prix, o = {}) => Object.assign({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, brand_title: titre.split(' ')[0], size_title: (/taille ([\d,]+)/.exec(titre) || [])[1] || '', status: 'Très bon état', is_closed: false, is_hidden: false, is_draft: false, photo: photo(id), nPhotos: 6, view_count: 40, favourite_count: 3, created_at_ts: ts(6) }, o);
const ITEMS_A = [
  ann(9101, 'Nike Air Max 1 obsidian lilac taille 42', 119, { promoted: true, created_at_ts: ts(45), favourite_count: 12, view_count: 310 }),
  ann(9102, 'Salomon XT-6 Advanced blanc lunar rock taille 40', 145, { created_at_ts: ts(3) }),
  ann(9103, 'Adidas Samba OG noir gomme taille 38,5', 89, { created_at_ts: ts(12), favourite_count: 7 }),
  ann(9104, 'New Balance 550 blanc vert taille 43', 79, { created_at_ts: ts(38), favourite_count: 0, view_count: 18 }),
  ann(9105, 'Asics Gel-Kayano 14 argent crème taille 44', 1249.5, { created_at_ts: ts(2) }),
  ann(9106, 'Nike Dunk Low panda taille 41', 72, { created_at_ts: ts(4), favourite_count: 10, view_count: 25 }),
];
const ITEMS_B = [
  ann(9201, 'Converse Chuck 70 high noir taille 42', 58, { created_at_ts: ts(9) }),
  ann(9202, 'Puma Speedcat rouge daim taille 39', 95, { created_at_ts: ts(20) }),
];
const MAIN = { vinted_annonce_numeros: {
  '9101': { numero: '41', buyPrice: '45', fees: '1.95' },
  '9102': { numero: '42', buyPrice: '70' },
  '9103': { numero: '43' },
  '9104': { numero: '44', buyPrice: '30' },
  '9106': { numero: '45', buyPrice: '35' },
  '9201': { numero: '46' },
  '9202': { numero: '47', buyPrice: '40' },
} };
const DETAILS = Object.fromEntries([...ITEMS_A, ...ITEMS_B].map((it, k) => [String(it.id), { photos: Array.from({ length: k % 3 === 0 ? 3 : 6 }, (_, i) => `https://images1.vinted.net/t/b${k * 7 + i}/f800/d${it.id}-${i}.jpeg`), description: 'Très bon état, portée quelques fois.' }]));
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'julatace35260', domain: 'www.vinted.fr', updated_at: cap },
  { id: 2, vinted_user_id: '222', login: 'tomj606', domain: 'www.vinted.fr', updated_at: cap },
];
// Leboncoin : trois ventes, un achat ; des annonces portant la référence VRM.
const lbc = (txId, titre, cents, o) => Object.assign({ txId, title: titre, price: cents, isSeller: true, at: ilYaJ(2).toISOString(), image: `https://images1.vinted.net/t/b${++nPhoto}/f800/lbc${txId}.jpeg`, photo: `https://images1.vinted.net/t/b${nPhoto}/f800/lbc${txId}.jpeg` }, o);
const LBC_VENTES = { ventes: {
  l1: lbc('l1', 'Nike Air Force 1 blanc taille 42 — très bon état', 6500, { stepStatus: 'done', stepLabel: 'Paiement effectué', deliveryLabel: 'Mondial Relay' }),
  l2: lbc('l2', 'Adidas Gazelle bleu taille 40', 7200, { itemId: 'lb2', stepLabel: 'Colis à envoyer', deliveryLabel: 'Colissimo' }),
  l3: lbc('l3', 'Salomon Speedcross 5 noir taille 44', 11000, { stepLabel: 'En cours de livraison', deliveryLabel: 'Shop2Shop' }),
  a1: lbc('a1', 'Lot New Balance 990v5 gris taille 43', 8500, { isSeller: false, stepStatus: 'done', stepLabel: 'Terminé' }),
  a2: lbc('a2', 'Asics Gel-Kayano 14 argent taille 42', 6000, { isSeller: false, stepLabel: 'En cours de livraison', deliveryLabel: 'Mondial Relay', label: { qrUrl: 'https://img.test/qr-a2.png', trackingUrl: 'https://suivi.test/a2' } }),
} };
const LBC_LISTINGS = { items: [
  { id: 'lb1', ref: '41', subject: 'Nike Air Max 1 obsidian lilac T42', price: 119, status: 'active', url: 'https://www.leboncoin.fr/ad/1' },
  { id: 'lb2', ref: '43', subject: 'Adidas Samba OG noir T38,5', price: 89, status: 'active', url: 'https://www.leboncoin.fr/ad/2' },
], capturedAt: cap };
const LBC_MSG = { compteurs: { u1: { unread: 3, at: cap } }, comptes: { u1: { name: 'Julien F.', pro: false, at: cap } } };
// eBay : des annonces reliées par SKU, une non reliée, une programmée, un brouillon.
const ep = (k) => `https://img.test/e${k}.jpg`;
const EBAY_ANNONCES = [
  { itemId: '110000000041', title: 'Nike Air Max 1 obsidian lilac taille 42', price: '125.0', sku: 'VRM-41', observateurs: 4, currency: 'EUR', photo: ep(1), url: 'https://www.ebay.fr/itm/110000000041', depuis: ilYaJ(10).toISOString() },
  { itemId: '110000000042', title: 'Salomon XT-6 Advanced blanc lunar rock taille 40 — boîte d\'origine', price: '1499.0', sku: 'VRM-42', observateurs: 0, currency: 'EUR', photo: ep(2), url: 'https://www.ebay.fr/itm/110000000042' },
  { itemId: '110000000099', title: 'Asics Gel 1130 argent taille 39', price: '75.0', sku: '', observateurs: 2, currency: 'EUR', photo: ep(3), url: 'https://www.ebay.fr/itm/110000000099' },
];
const EBAY_COMMANDES = [
  { orderId: '07-001', creationDate: ilYaJ(1).toISOString(), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', lineItems: [{ sku: 'VRM-44', title: 'New Balance 550 blanc vert taille 43', legacyItemId: '110000000044' }], pricingSummary: { total: { value: '89.00', currency: 'EUR' } } },
  { orderId: '07-002', creationDate: ilYaJ(6).toISOString(), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'FULFILLED', lineItems: [{ sku: '', title: 'Nike Cortez blanc rouge taille 41' }], pricingSummary: { total: { value: '64.00', currency: 'EUR' } } },
];
const ROWS = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: cap, payload: { items: ITEMS_A, pagination: { total_entries: ITEMS_A.length } } } },
  { id: 'harvest_222_listings', data: { capturedAt: cap, payload: { items: ITEMS_B, pagination: { total_entries: ITEMS_B.length } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'vinted_item_details', data: DETAILS },
  { id: 'vinted_lbc_posted', data: { ids: ['9101', '9103'] } },
  { id: 'lbc_ventes', data: LBC_VENTES },
  { id: 'lbc_listings', data: LBC_LISTINGS },
  { id: 'lbc_messages', data: LBC_MSG },
  { id: 'ebay_listings', data: { items: EBAY_ANNONCES, capturedAt: Date.now() } },
  { id: 'ebay_orders', data: { orders: EBAY_COMMANDES, capturedAt: Date.now() } },
  { id: 'ebay_programmees', data: { items: [
    { itemId: '110000000945', sku: 'VRM-45', title: 'Nike Dunk Low panda taille 41', price: '79.0', debut: new Date(maintenant.getTime() + 2 * 86400000).toISOString(), photo: '' },
  ], enLigne: [], complet: true, capturedAt: Date.now() } },
  { id: 'ebay_brouillons', data: { items: {
    'b-47': { id: 'b-47', numero: '47', pairId: '9202', titre: 'Puma Speedcat rouge daim taille 39', prix: '99', etatBrouillon: 'brouillon' },
  }, majAt: Date.now() } },
];

let ko = 0, ok = 0;
const envoisEval = [], ACTIONS = [], ECRITURES = [];
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).split('\n')[0].slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const teintes = ['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf', '#d8d0d6', '#d3d8de', '#ddd8cc', '#cdd2d8', '#d6d1c8'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="${teintes[k % teintes.length]}"/><ellipse cx="300" cy="560" rx="220" ry="28" fill="rgba(0,0,0,.08)"/><path d="M90 500 C120 410 210 395 270 425 C330 455 400 432 460 470 C500 492 492 545 432 548 L130 548 C98 548 84 528 90 500 Z" fill="rgba(30,34,40,.55)"/></svg>`;

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
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

// (pavé) La forme réelle d'une annonce captée : `ref` = le numéro nu (refVRMDe, background.js).
const ouvrir = async (b, vp, opts = {}) => {
  // (17 oct.) `vide` : AUCUNE vente captée (Leboncoin jamais lu, eBay relié sans vente).
  const LIGNES = opts.vide ? ROWS.filter((r) => !['lbc_ventes', 'ebay_orders'].includes(r.id)).concat([{ id: 'ebay_orders', data: { orders: [], capturedAt: Date.now() } }]) : ROWS;
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/[^/]*(vinted\.net|img\.test)\//i, (r) => { const m = /\/b(\d+)\/|\/e(\d+)\.jpg/.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1] || m[2]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net|img\.test)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, (d.length || 1) - 1)}/${d.length || 0}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') { let ids = ''; try { const d = JSON.parse(route.request().postData() || 'null'); ids = (Array.isArray(d) ? d : [d]).map((x) => x && x.id).join(','); } catch (_) {} ECRITURES.push(route.request().method() + ' ' + ids); return j([], 201); }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.route('**/api/ebay**', (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    ACTIONS.push(body.action);
    if (body.action === 'status') return j({ ok: true, connected: true });
    if (body.action === 'offreinfo') return j({ ok: true, eligibles: ['110000000041'], complet: true });
    if (body.action === 'finances') return j({ ok: false, reason: 'scope', error: 'x' });
    // (17 oct.) Évaluations à laisser : une vente, puis l'évaluation positive.
    if (body.action === 'evaluations') return j({ ok: true, evaluations: [{ itemId: '110000000044', transactionId: '5550', titre: 'New Balance 550 blanc vert taille 43', buyer: 'acheteur_exemple' }] });
    if (body.action === 'evaluer') { envoisEval.push(body); return j({ ok: true }); }
    return j({ ok: true });
  });
  return { ctx, pg, errs };
};


const tape = async (pg, txt) => { for (const c of txt) await pg.keyboard.press(c); };
const verrNumEteint = (pg, chiffres) => pg.evaluate((cs) => {
  const sans = { '0': 'Insert', '1': 'End', '2': 'ArrowDown', '3': 'PageDown', '4': 'ArrowLeft', '5': 'Clear', '6': 'ArrowRight', '7': 'Home', '8': 'ArrowUp', '9': 'PageUp' };
  for (const c of cs) { const t = document.activeElement || document.body; t.dispatchEvent(new KeyboardEvent('keydown', { key: sans[c], code: 'Numpad' + c, bubbles: true, cancelable: true })); }
}, chiffres);
const allerA = async (pg, tab) => { await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('[data-section="ventes"]', { timeout: 15000 }); await pg.waitForTimeout(1500); await pg.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); };
const etat = (pg) => pg.evaluate(() => ({ sec: (document.querySelector('[data-section][aria-current="page"],[data-section][aria-pressed="true"],[data-section][aria-selected="true"]') || {}).getAttribute ? document.querySelector('[data-section][aria-current="page"],[data-section][aria-pressed="true"],[data-section][aria-selected="true"]').getAttribute('data-section') : '', trouve: [...document.querySelectorAll('[data-num-trouve]')].map((e) => e.getAttribute('data-lbc-vente') || e.getAttribute('data-lbc-catalog-id') || e.getAttribute('data-apub') || e.getAttribute('data-ebay-vente') || e.getAttribute('data-ebay-annonce') || e.tagName), msg: (document.querySelector('[data-num-plat] [role=status]') || {}).textContent || '', ton: (document.querySelector('[data-num-plat-msg]') || {}).getAttribute ? (document.querySelector('[data-num-plat-msg]') || { getAttribute: () => '' }).getAttribute('data-num-plat-msg') : '', valeur: (document.querySelector('[data-num-plat-saisie]') || {}).value, focus: !!(document.activeElement && document.activeElement.matches('[data-num-plat-saisie]')) }));
const attendTrouve = async (pg) => { for (let i = 0; i < 30; i++) { const e = await etat(pg); if (!/Je cherche/.test(e.msg) && e.ton) return e; await pg.waitForTimeout(200); } return etat(pg); };

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 });
      console.log('\n── Leboncoin, 1512 px');
      await allerA(pg, 'plat_leboncoin');
      await essaie('Leboncoin', async () => {
        dit(!(await pg.$('[data-num-plat]')) && !(await pg.$('[data-num-plat-saisie]')), 'plus de saisie « N° + Entrée » sur Leboncoin');
        const avant = await pg.evaluate(() => ({ url: location.search, sec: (document.querySelector('[data-section][aria-current="page"],[data-section][aria-pressed="true"]') || { getAttribute: () => '' }).getAttribute('data-section') }));
        await tape(pg, '51'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
        const apres = await pg.evaluate(() => ({ url: location.search, sec: (document.querySelector('[data-section][aria-current="page"],[data-section][aria-pressed="true"]') || { getAttribute: () => '' }).getAttribute('data-section'), focus: document.activeElement ? document.activeElement.tagName : '' }));
        dit(apres.url === avant.url && apres.sec === avant.sec && !/INPUT|TEXTAREA/.test(apres.focus), 'un N° tapé hors d’un champ ne fait rien (ni focus, ni onglet)', JSON.stringify({ avant, apres }));
      });
      console.log('\n── eBay, 1512 px');
      await allerA(pg, 'plat_ebay');
      await essaie('eBay', async () => {
        dit(!(await pg.$('[data-num-plat]')) && !(await pg.$('[data-num-plat-saisie]')), 'plus de saisie « N° + Entrée » sur eBay');
        const avant = await pg.evaluate(() => ({ url: location.search, sec: (document.querySelector('[data-section][aria-current="page"],[data-section][aria-pressed="true"]') || { getAttribute: () => '' }).getAttribute('data-section') }));
        await tape(pg, '51'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
        const apres = await pg.evaluate(() => ({ url: location.search, sec: (document.querySelector('[data-section][aria-current="page"],[data-section][aria-pressed="true"]') || { getAttribute: () => '' }).getAttribute('data-section'), focus: document.activeElement ? document.activeElement.tagName : '' }));
        dit(apres.url === avant.url && apres.sec === avant.sec && !/INPUT|TEXTAREA/.test(apres.focus), 'un N° tapé hors d’un champ ne fait rien (ni focus, ni onglet)', JSON.stringify({ avant, apres }));
      });
      dit(!ECRITURES.filter((x) => !/^POST (widget_stats|vinted_urssaf_mois|vrm_colis_\w+|vrm_benefice_jours|plantage_\w+|main|relais_ext|diag_photos|vrm_hl_\w+|vrm_paires_dorment)(,|$)/.test(x)).length, 'aucune écriture en base venue du clavier', ECRITURES.join(' | ').slice(0, 300));
      dit(!errs.length, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'banc', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
