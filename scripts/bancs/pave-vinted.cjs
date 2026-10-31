// Banc : PLUS DE SAISIE « N° + Entrée » SUR VENTES, COLIS, ACHATS, ANNONCES (29 octobre).
// Julien : « enlève N°+entrée sur chaque onglet, il y a déjà la barre de
// recherche ». Il vérifie : aucune saisie N° rendue, un chiffre tapé hors d'un
// champ ne déplace pas le focus et ne change pas d'onglet, un chiffre tapé dans
// la recherche y reste, aucune écriture, aucune erreur de page. Données INVENTÉES.
// (Avant le 29 oct. : banc du pavé numérique, ajouté le 27.)
// Banc : LE PAVÉ NUMÉRIQUE SUR VENTES ET COLIS (Vinted, 27 octobre). Julien :
// « fais pareil pour le pavé numérique sur Colis et Ventes ». Données INVENTÉES.
// Il JOUE le clavier, sur ordinateur :
//   · Ventes : N° + Entrée montre SA vente — même cachée par un filtre, une
//     recherche, ou au-delà des 60 premières (« Voir plus ») ; une vente annulée
//     ouvre « Annulées » ; un N° sans vente le dit ;
//   · Colis : N° + Entrée montre SON colis (un colis marqué « posté » est
//     remontré), un colis eBay à poster aussi ; une vente finalisée dit qu'elle
//     n'est pas à envoyer ; Verr Num éteint marche ;
//   · rien n'est écrit ; au téléphone, pas de saisie.
// Lancer : npm run build && BANC_PORT=51xx node scripts/bancs/pave-vinted.cjs
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 5147;
const maintenant = new Date(2026, 9, 15, 15, 30, 0);
const ilYaJ = (j, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - j); return d; };
const ts = (j) => Math.floor(ilYaJ(j).getTime() / 1000);
const cap = maintenant.toISOString();
let nPhoto = 0;
const iso = (j, h = 12) => ilYaJ(j, h).toISOString();
const photo = (id) => ({ url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` });
const ann = (id, titre, prix, o = {}) => Object.assign({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, brand_title: titre.split(' ')[0], size_title: (/taille ([\d,]+)/.exec(titre) || [])[1] || '', status: 'Très bon état', is_closed: false, is_hidden: false, is_draft: false, photo: photo(id), nPhotos: 6, view_count: 40, favourite_count: 3, created_at_ts: ts(6) }, o);

const vente = (tx, titre, prix, j, statut, tus, o = {}) => Object.assign({ transaction_id: tx, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: iso(j), photo: photo('v' + tx) }, o);
const VENTES = [
  vente(501, 'Nike Dunk Low panda taille 41', 72, 1, 'Le paiement a été validé', 'needs_action'),
  vente(503, 'Puma Speedcat rouge daim taille 39', 95, 2, 'Commande annulée', 'failed'),
  vente(504, 'Converse Chuck 70 high noir taille 42', 58, 1, 'Le paiement a été validé', 'needs_action'),
  vente(502, 'Adidas Samba OG noir gomme taille 38,5', 89, 30, 'Commande finalisée', 'completed'),
];
for (let k = 0; k < 70; k++) VENTES.push(vente(600 + k, `Paire de remplissage ${k} taille 40`, 40 + k, 3 + (k % 20) / 10, 'Commande finalisée', 'completed'));
const MAIN = {
  vinted_annonce_numeros: { '9101': { numero: '41', buyFromId: '801' }, '9102': { numero: '42' }, '9104': { numero: '44' } },
  vinted_sale_overrides: { '501': { numero: '51' }, '502': { numero: '52', buyFromId: '802' }, '503': { numero: '53' }, '504': { numero: '54' } },
  vinted_ship_done: { '504': Date.now() },
};
const annonce = (id, titre, prix, j) => ({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, brand_title: titre.split(' ')[0], size_title: '42', status: 'Très bon état', is_closed: false, is_hidden: false, is_draft: false, photo: photo('a' + id), nPhotos: 4, view_count: 30, favourite_count: 2, created_at_ts: Math.floor(ilYaJ(j).getTime() / 1000) });
const ANNONCES = [annonce(9101, 'Nike Air Max 1 obsidian lilac taille 42', 119, 20), annonce(9102, 'Salomon XT-6 Advanced blanc taille 40', 145, 5), annonce(9103, 'New Balance 550 blanc vert taille 43', 79, 8)];
const achat = (tx, titre, prix, j, statut) => ({ transaction_id: tx, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: 'completed', date: iso(j), photo: photo('b' + tx) });
const ACHATS = [achat(801, 'Nike Air Max 1 lilac taille 42', 45, 25, 'Commande finalisée'), achat(802, 'Adidas Samba noir taille 38,5', 30, 40, 'Commande finalisée')];
for (let k = 0; k < 70; k++) ACHATS.push(achat(900 + k, `Achat de remplissage ${k}`, 20, 1 + (k % 20) / 10, 'Commande finalisée'));
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'julatace35260', domain: 'www.vinted.fr', updated_at: cap }];
const EBAY_COMMANDES = [
  { orderId: '07-001', creationDate: iso(1), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', lineItems: [{ sku: 'VRM-44', title: 'New Balance 550 blanc vert taille 43', legacyItemId: '110000000044', lineItemFulfillmentInstructions: { shipByDate: new Date(maintenant.getTime() + 2 * 86400000).toISOString() } }], fulfillmentStartInstructions: [{ fulfillmentInstructionsType: 'SHIP_TO' }], paymentSummary: { totalDueSeller: { value: '80.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '9.00', currency: 'EUR' }, pricingSummary: { total: { value: '89.00', currency: 'EUR' } } },
];
const ROWS = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: cap, payload: { items: ANNONCES, pagination: { total_entries: ANNONCES.length } } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: ACHATS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: 'ebay_orders', data: { orders: EBAY_COMMANDES, capturedAt: Date.now() } },
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
  const LIGNES = ROWS;
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
const allerA = async (pg, tab, quoi) => { await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' }); await pg.waitForSelector(quoi, { timeout: 15000 }); await pg.waitForTimeout(1500); await pg.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); };
const etat = (pg) => pg.evaluate(() => ({ sec: (document.querySelector('[data-section][aria-current="page"],[data-section][aria-pressed="true"],[data-section][aria-selected="true"]') || {}).getAttribute ? document.querySelector('[data-section][aria-current="page"],[data-section][aria-pressed="true"],[data-section][aria-selected="true"]').getAttribute('data-section') : '', trouve: [...document.querySelectorAll('[data-num-trouve]')].map((e) => e.getAttribute('data-tx-colis') || e.getAttribute('data-achat-tx') || e.getAttribute('data-carte-annonce') || e.getAttribute('data-colis-ebay-cmd') || e.getAttribute('data-tx') || e.tagName), msg: (document.querySelector('[data-num-plat] [role=status]') || {}).textContent || '', ton: (document.querySelector('[data-num-plat-msg]') || {}).getAttribute ? (document.querySelector('[data-num-plat-msg]') || { getAttribute: () => '' }).getAttribute('data-num-plat-msg') : '', valeur: (document.querySelector('[data-num-plat-saisie]') || {}).value, focus: !!(document.activeElement && document.activeElement.matches('[data-num-plat-saisie]')) }));
const attendTrouve = async (pg) => { for (let i = 0; i < 30; i++) { const e = await etat(pg); if (!/Je cherche/.test(e.msg) && e.ton) return e; await pg.waitForTimeout(200); } return etat(pg); };

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    {
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 });
      console.log('\n── Ventes, 1512 px');
      await allerA(pg, 'cat_ventes', '.vrm-ventes-liste .vrm-sale-row[data-tx="501"]');
      await essaie('Ventes', async () => {
        dit(!(await pg.$('[data-num-plat]')) && !(await pg.$('[data-num-plat-saisie]')), 'plus de saisie « N° + Entrée » sur Ventes');
        const avant = await pg.evaluate(() => ({ url: location.search, sec: (document.querySelector('[data-section][aria-current="page"],[data-section][aria-pressed="true"]') || { getAttribute: () => '' }).getAttribute('data-section') }));
        await tape(pg, '51'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
        const apres = await pg.evaluate(() => ({ url: location.search, sec: (document.querySelector('[data-section][aria-current="page"],[data-section][aria-pressed="true"]') || { getAttribute: () => '' }).getAttribute('data-section'), focus: document.activeElement ? document.activeElement.tagName : '' }));
        dit(apres.url === avant.url && apres.sec === avant.sec && !/INPUT|TEXTAREA/.test(apres.focus), 'un N° tapé hors d’un champ ne fait rien (ni focus, ni onglet)', JSON.stringify({ avant, apres }));
        await pg.click('input[aria-label="Rechercher dans les ventes Vinted"]'); await pg.keyboard.press('7');
        const v = await pg.$eval('input[aria-label="Rechercher dans les ventes Vinted"]', (x) => x.value);
        dit(v === '7', 'un chiffre tapé dans la recherche y reste (c’est elle qui cherche un N°)', v);
        await pg.fill('input[aria-label="Rechercher dans les ventes Vinted"]', '');
      });
      console.log('\n── Colis, 1512 px');
      await allerA(pg, 'cat_bord', '[data-bord-card][data-tx-colis="501"]');
      await essaie('Colis', async () => {
        dit(!(await pg.$('[data-num-plat]')) && !(await pg.$('[data-num-plat-saisie]')), 'plus de saisie « N° + Entrée » sur Colis');
        const avant = await pg.evaluate(() => ({ url: location.search, sec: (document.querySelector('[data-section][aria-current="page"],[data-section][aria-pressed="true"]') || { getAttribute: () => '' }).getAttribute('data-section') }));
        await tape(pg, '51'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
        const apres = await pg.evaluate(() => ({ url: location.search, sec: (document.querySelector('[data-section][aria-current="page"],[data-section][aria-pressed="true"]') || { getAttribute: () => '' }).getAttribute('data-section'), focus: document.activeElement ? document.activeElement.tagName : '' }));
        dit(apres.url === avant.url && apres.sec === avant.sec && !/INPUT|TEXTAREA/.test(apres.focus), 'un N° tapé hors d’un champ ne fait rien (ni focus, ni onglet)', JSON.stringify({ avant, apres }));
      });
      console.log('\n── Achats, 1512 px');
      await allerA(pg, 'cat_achats', '[data-achats-onglet]');
      await essaie('Achats', async () => {
        dit(!(await pg.$('[data-num-plat]')) && !(await pg.$('[data-num-plat-saisie]')), 'plus de saisie « N° + Entrée » sur Achats');
        const avant = await pg.evaluate(() => ({ url: location.search, sec: (document.querySelector('[data-section][aria-current="page"],[data-section][aria-pressed="true"]') || { getAttribute: () => '' }).getAttribute('data-section') }));
        await tape(pg, '51'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
        const apres = await pg.evaluate(() => ({ url: location.search, sec: (document.querySelector('[data-section][aria-current="page"],[data-section][aria-pressed="true"]') || { getAttribute: () => '' }).getAttribute('data-section'), focus: document.activeElement ? document.activeElement.tagName : '' }));
        dit(apres.url === avant.url && apres.sec === avant.sec && !/INPUT|TEXTAREA/.test(apres.focus), 'un N° tapé hors d’un champ ne fait rien (ni focus, ni onglet)', JSON.stringify({ avant, apres }));
      });
      console.log('\n── Annonces, 1512 px');
      await allerA(pg, 'cat_annonces', '[data-carte-annonce="9101"]');
      await essaie('Annonces', async () => {
        dit(!(await pg.$('[data-num-plat]')) && !(await pg.$('[data-num-plat-saisie]')), 'plus de saisie « N° + Entrée » sur Annonces');
        const avant = await pg.evaluate(() => ({ url: location.search, sec: (document.querySelector('[data-section][aria-current="page"],[data-section][aria-pressed="true"]') || { getAttribute: () => '' }).getAttribute('data-section') }));
        await tape(pg, '51'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
        const apres = await pg.evaluate(() => ({ url: location.search, sec: (document.querySelector('[data-section][aria-current="page"],[data-section][aria-pressed="true"]') || { getAttribute: () => '' }).getAttribute('data-section'), focus: document.activeElement ? document.activeElement.tagName : '' }));
        dit(apres.url === avant.url && apres.sec === avant.sec && !/INPUT|TEXTAREA/.test(apres.focus), 'un N° tapé hors d’un champ ne fait rien (ni focus, ni onglet)', JSON.stringify({ avant, apres }));
        await pg.click('input[aria-label="Rechercher une annonce"]'); await pg.keyboard.press('7');
        const v = await pg.$eval('input[aria-label="Rechercher une annonce"]', (x) => x.value);
        dit(v === '7', 'un chiffre tapé dans la recherche y reste (c’est elle qui cherche un N°)', v);
        await pg.fill('input[aria-label="Rechercher une annonce"]', '');
      });
      // Les lignes PUBLIÉES par un écran (§11 : widget_stats, vrm_colis_*, et
      // depuis le 29 oct. `lbc_a_retirer`, le résumé pour le logo VRM sur
      // leboncoin.fr) partent au chargement, pas du clavier.
      dit(!ECRITURES.filter((x) => !/^POST (widget_stats|vinted_urssaf_mois|vrm_colis_\w+|vrm_benefice_jours|plantage_\w+|main|relais_ext|diag_photos|vrm_hl_\w+|vrm_paires_dorment|lbc_a_retirer)(,|$)/.test(x)).length, 'aucune écriture en base venue du clavier', ECRITURES.join(' | ').slice(0, 300));
      dit(!errs.length, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'banc', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
