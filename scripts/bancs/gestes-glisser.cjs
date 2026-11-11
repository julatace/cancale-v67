// ═══════════════════════════════════════════════════════════════════════════
// BANC : GLISSER POUR AGIR, COMME MAIL (11 nov., lot « gestes-glisser »)
//        npm run build && BANC_PORT=$((20000+RANDOM%20000)) node scripts/bancs/gestes-glisser.cjs
// ═══════════════════════════════════════════════════════════════════════════
// UN composant (src/LigneGlissable.jsx) sur trois écrans : Ventes, Achats
// (« à retirer »), Annonces (« Qui dorment »). Base INVENTÉE (dépôt public).
// Doigt simulé par de vrais événements tactiles (CDP ⇒ pointeurs `touch`).
//   V. Ventes 390 tactile :
//      V1 la 1ʳᵉ fois, UNE ligne montre ses actions (data-lg-indice), puis plus jamais (rechargée) ;
//      V2 glisser court ⇒ le tiroir reste ouvert, « Imprimer » + « Déposé » visibles, ≥ 44 px, dans l'écran,
//         rien d'écrit, aucun débordement ; un toucher ailleurs le referme ;
//      V3 « Déposé » du tiroir ⇒ la barre « Annuler » (la MÊME que le bouton) ; rien d'écrit pendant 5 s ;
//      V4 un défilement vertical, un appui au bord gauche (retour iOS) : rien ne bouge ;
//      V5 mouvement réduit : la ligne se pose sans ressort (transition 'none').
//   A. À retirer 390 : « Le code » du tiroir ⇒ la ligne s'ouvre, le code est copié (le geste de « Code ») ;
//      glisser long ⇒ « Retiré » (le colis sort, pilule « Annuler ») ; « Annuler » ⇒ il revient.
//   Q. Qui dorment 390 : « Baisser » du tiroir ⇒ la FEUILLE de baisse (1 annonce), AUCUNE commande
//      partie ; glisser long ⇒ la feuille aussi, toujours rien d'envoyé.
//   K. 1512 (souris, clavier) : un glisser à la souris ne bouge rien ; le tiroir fermé est `inert` +
//      `aria-hidden` (jamais une tabulation dans un tiroir caché) ; chaque action du tiroir existe en
//      bouton visible de la ligne (Déposé, Imprimer, J'ai retiré, Agir, Baisser le prix).
// Jugé sur des data-* et l'état stocké. `SHOTS=<dossier>` : captures. `BANC_DIST=<dossier>` : autre build.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData, metaDe, filtreData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4611);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-gestes-glisser');
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

const MAINTENANT = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ilYa = (j) => iso(MAINTENANT - j * 86400000);
const sec = (j) => Math.floor((MAINTENANT - j * 86400e3) / 1000);
const AEXP = 'Le paiement a été validé';
const v = (tx, titre, prix, statut, j, tus) => ({ transaction_id: tx, conversation_id: tx + 1000, title: titre, price: { amount: prix, currency_code: 'EUR' }, status: statut, ...(tus ? { transaction_user_status: tus } : {}), date: ilYa(j) });
const VENTES = [
  v(9201, 'Nike Air Max 90 taille 42', '85.00', AEXP, 1, 'needs_action'),
  v(9202, 'Adidas Samba OG taille 41', '95.00', 'Commande finalisée', 3, 'completed'),
  v(9205, 'Asics Gel-1130 taille 40', '60.00', AEXP, 2, 'needs_action'),
];
const ACHATS = [
  { transaction_id: 9301, conversation_id: 7001, title: 'Nike Air Max 90 blanche taille 43', price: { amount: '38', currency_code: 'EUR' },
    status: 'Colis déposé en point relais', transaction_user_status: 'needs_action', date: ilYa(4) },
];
const RELAIS = { '9301': { code: '012345', lieu: 'Phone Cash, 12 rue du Port, 35260 Cancale', transporteur: 'mondialrelay', at: iso(MAINTENANT) } };
const ann = (id, titre, prix, jours) => ({ id, title: titre, brand: 'Nike', size: '42', price: { amount: String(prix), currency_code: 'EUR' }, created_at_ts: sec(jours),
  is_closed: false, is_draft: false, is_hidden: false, promoted: false, view_count: 20, favourite_count: 1, url: 'https://www.vinted.fr/items/' + id });
const ANNONCES = [ann(900001, 'Nike Cortez blanche', 80, 95), ann(900003, 'Asics Gel Lyte', 60, 35)];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(MAINTENANT), created_at: iso(MAINTENANT - 400 * 86400e3), owner: null }];
const ROWS = [
  { id: 'harvest_111_listings', data: { uid: '111', type: 'listings', nItems: ANNONCES.length, capturedAt: iso(MAINTENANT - 60000), payload: { items: ANNONCES, pagination: { total_entries: ANNONCES.length } } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MAINTENANT), payload: { my_orders: ACHATS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MAINTENANT), payload: { my_orders: VENTES } } },
  { id: 'panel_colis_relais', data: RELAIS },
  { id: 'email_bord_9201', data: { transaction: '9201', filename: 'bordereau_9201.pdf', suivi: '12345678', receivedAt: ilYa(0.2), uid: '111', account: 'compte_banc', pdfB64: 'JVBERi0xLjQK' } },
  { id: 'vinted_listing_dates', data: {} },
];
const MAIN = { vinted_dark: false, vinted_sale_overrides: { '9201': { numero: '42', buyPrice: '38', fraisComplets: true }, '9205': { numero: '61', buyPrice: '27', fraisComplets: true } },
  vinted_annonce_numeros: { 900001: { numero: '41', buyPrice: '30', fraisComplets: true }, 900003: { numero: '44' } } };

let ko = 0, okN = 0;
const dit = (c, m, d) => { if (c) okN++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 180)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'meta') { out[alias] = metaDe(row.data); continue; }
    if (src === 'updated_at') { out[alias] = iso(MAINTENANT); continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    out[alias] = x == null ? null : (/->>[^>]*$/.test(src) && typeof x !== 'object' ? String(x) : x);
  }
  return out;
};
// Le faux pont : prêt, onglet sur 111 ; chaque commande est NOTÉE (aucune ne doit partir au glisser).
const PONT = () => {
  const post = (m) => window.postMessage(m, '*');
  window.__cmds = [];
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: '5.342.0' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: '5.342.0', code: '5.342.0', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_banc' }, cmds: {} } });
    if (d.__vmr === 'cmd') { window.__cmds.push(d.cmd); post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'banc', raison: 'banc' } }); }
  });
  post({ __vmr: 'ready', version: '5.342.0' });
};
async function preparer(b, vp, { indiceVu = true, reduit = false } = {}) {
  const tactile = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tactile ? { isMobile: true, hasTouch: true } : {}), reducedMotion: reduit ? 'reduce' : 'no-preference' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ indiceVu }) => { try { if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1'); localStorage.setItem('vrm_acces_direct', '1'); if (indiceVu) localStorage.setItem('vrm_glisse_indice_vu', '1'); } catch (_) {} }, { indiceVu });
  await pg.addInitScript(PONT);
  // L'indice est noté au moment où il se pose (il ne dure que 0,9 s) : un observateur, posé avant l'app.
  await pg.addInitScript(() => { window.__indices = []; const t0 = performance.now(); new MutationObserver((ms) => { for (const m of ms) if (m.target.getAttribute('data-lg-indice') === '1') window.__indices.push([Math.round(performance.now() - t0), m.target.getAttribute('data-lg-id')]); }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-lg-indice'] }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: MAIN }, sel)]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(ROWS.filter((r) => ids.includes(r.id)).map((r) => projette(r, sel))); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id) && filtreData(u)(r)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
const ouvrirVentes = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-tx="9201"]').first().waitFor({ timeout: 25000 });
  await pg.waitForTimeout(400);
};
const SEL_RETRAIT = '.vrm-rpf-ligne[data-lg]';
const ouvrirAchats = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
  await pg.locator(SEL_RETRAIT).first().waitFor({ timeout: 25000 });
  await pg.waitForTimeout(400);
};
const ouvrirQD = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=vinted_annonces`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-vue-relancer]', { timeout: 30000 }).catch(() => {});
  await pg.locator('[data-vue-relancer]').first().click().catch(() => {});
  await pg.waitForSelector('[data-qui-dorment]', { timeout: 15000 }).catch(() => {});
  if (await pg.locator('[data-qd-mode-choix="dort"]').count()) await pg.locator('[data-qd-mode-choix="dort"]').first().click();
  await pg.waitForSelector('[data-qd-ligne][data-lg]', { timeout: 15000 });
  await pg.waitForTimeout(400);
};
// Un vrai doigt. `part` : la part de la largeur à glisser vers la gauche ; `x0` : le point de départ (part de la largeur, ou px absolus si > 1).
async function glisser(pg, sel, { part = 0.6, dy = 0, x0 = 0.8, n = 12 } = {}) {
  const r = await pg.evaluate((s) => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { l: b.left, y: b.top + Math.min(36, b.height / 2), w: b.width }; }, sel);
  await pg.waitForTimeout(200);
  const x = x0 > 1 ? x0 : r.l + r.w * x0;
  const cdp = await pg.context().newCDPSession(pg);
  const pt = (px, py) => [{ x: px, y: py, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x, r.y) });
  for (let k = 1; k <= n; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x - (r.w * part) * k / n, r.y + dy * k / n) }); await pg.waitForTimeout(24); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await pg.waitForTimeout(500);
}
async function toucher(pg, sel) {
  const r = await pg.evaluate((s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
  await pg.touchscreen.tap(r.x, r.y);
  await pg.waitForTimeout(400);
}
const etatLigne = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const t = e.querySelector(':scope > [data-lg-tiroir]');
  const vw = document.documentElement.clientWidth;
  const acts = t ? [...t.querySelectorAll('[data-lg-action]')].map((a) => { const b = a.getBoundingClientRect(); return { k: a.getAttribute('data-lg-action'), w: Math.round(b.width), h: Math.round(b.height), dedans: b.left >= -1 && b.right <= vw + 1, href: a.getAttribute('href') || '' }; }) : [];
  return { lg: e.getAttribute('data-lg'), ouvert: e.getAttribute('data-lg-ouvert'), actif: e.getAttribute('data-lg-actif'), indice: e.getAttribute('data-lg-indice'), translate: e.style.translate || '', transition: e.style.transition || '',
    inert: t ? t.hasAttribute('inert') : null, cache: t ? t.getAttribute('aria-hidden') : null, acts, deb: document.documentElement.scrollWidth - vw }; }, sel);
const lireStock = (pg) => pg.evaluate(() => { const L = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }; return { ship: L('vinted_ship_done') || {}, bords: L('vinted_bords_shipped') || {} }; });
const shot = (pg, nom) => pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {});

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const T = { width: 390, height: 844 };
    // ── V1. L'indice, une fois ─────────────────────────────────────────────────
    await essaie('V1', async () => {
      const { ctx, pg, errs } = await preparer(b, T, { indiceVu: false });
      await ouvrirVentes(pg);
      await pg.waitForFunction(() => window.__indices.length > 0, null, { timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(200); await shot(pg, 'v1-indice-390');
      await pg.waitForTimeout(1200);
      const ind = await pg.evaluate(() => window.__indices.slice());
      dit(ind.length === 1, 'V1 la première fois, UNE seule ligne montre ses actions (data-lg-indice), une fois', JSON.stringify(ind));
      await pg.waitForTimeout(1400);
      const apres = await etatLigne(pg, '[data-tx="9201"]');
      dit(apres && !apres.indice && !apres.actif, 'V1 puis elle revient en place toute seule', JSON.stringify(apres && { i: apres.indice, a: apres.actif, t: apres.translate }));
      dit(await pg.evaluate(() => localStorage.getItem('vrm_glisse_indice_vu')) === '1', 'V1 l’indice est noté vu sur cet appareil');
      await pg.reload({ waitUntil: 'domcontentloaded' });
      await pg.locator('[data-tx="9201"]').first().waitFor({ timeout: 25000 });
      await pg.waitForTimeout(2200);
      const encore = await pg.evaluate(() => window.__indices.length);
      dit(encore === 0, 'V1 rechargée : plus jamais d’indice', String(encore));
      dit(!errs.length, 'V1 aucune erreur d’app', errs[0]);
      await ctx.close();
    });
    // ── V2-V4. Ventes au doigt ─────────────────────────────────────────────────
    await essaie('V2', async () => {
      const { ctx, pg, errs } = await preparer(b, T);
      await ouvrirVentes(pg);
      const avant = await lireStock(pg);
      await glisser(pg, '[data-tx="9201"]', { part: 0.3 });
      let e = await etatLigne(pg, '[data-tx="9201"]');
      await shot(pg, 'v2-tiroir-ouvert-390');
      dit(e && e.ouvert === '1' && e.inert === false && e.cache === null, 'V2 glisser court ⇒ le tiroir reste ouvert, accessible', JSON.stringify(e && { o: e.ouvert, inert: e.inert, cache: e.cache }));
      dit(e && e.acts.map((a) => a.k).join(',') === 'imprimer,depose', 'V2 deux actions : « Imprimer » puis « Déposé » au bord droit', e && e.acts.map((a) => a.k).join(','));
      dit(e && e.acts.every((a) => a.w >= 44 && a.h >= 44 && a.dedans), 'V2 chaque action ≥ 44 px, dans l’écran', e && JSON.stringify(e.acts));
      dit(e && e.deb <= 0, 'V2 aucun défilement horizontal de la page', e && String(e.deb));
      dit(JSON.stringify(await lireStock(pg)) === JSON.stringify(avant) && !(await pg.$('[data-depose-barre]')), 'V2 ouvrir le tiroir n’écrit rien');
      // Un toucher ailleurs le referme.
      await toucher(pg, '[data-tx="9205"] .vrm-ledger-sale-toggle');
      e = await etatLigne(pg, '[data-tx="9201"]');
      dit(e && !e.ouvert && e.inert === true && e.cache === 'true', 'V2 un toucher ailleurs le referme (inert + aria-hidden)', JSON.stringify(e && { o: e.ouvert, inert: e.inert }));
      await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(300);
      // ── V3 « Déposé » du tiroir ⇒ la barre « Annuler », rien d'écrit pendant le délai
      await glisser(pg, '[data-tx="9201"]', { part: 0.3 });
      await toucher(pg, '[data-tx="9201"] [data-lg-action="depose"]');
      const barre = await pg.locator('[data-depose-barre="9201"]').waitFor({ timeout: 3000 }).then(() => true).catch(() => false);
      await shot(pg, 'v3-depose-annuler-390');
      dit(barre, 'V3 « Déposé » du tiroir ⇒ la barre « Déposé · Annuler » (la même que le bouton)');
      e = await etatLigne(pg, '[data-tx="9201"]');
      dit(e && !e.ouvert, 'V3 le tiroir se referme après l’action', JSON.stringify(e && e.ouvert));
      dit(!(await lireStock(pg)).ship['9201'], 'V3 pendant le délai : rien n’est écrit');
      await pg.click('[data-depose-annuler="9201"]'); await pg.waitForTimeout(6000);
      dit(JSON.stringify(await lireStock(pg)) === JSON.stringify(avant), 'V3 « Annuler » ⇒ RIEN écrit');
      // ── V4 défilement vertical, bord gauche
      await glisser(pg, '[data-tx="9205"]', { part: 0.05, dy: -220 });
      e = await etatLigne(pg, '[data-tx="9205"]');
      dit(e && !e.ouvert && !e.actif && !(await pg.$('[data-depose-barre]')), 'V4 un défilement vertical : la ligne ne bouge pas', JSON.stringify(e && { o: e.ouvert, a: e.actif }));
      await glisser(pg, '[data-tx="9205"]', { part: 0.6, x0: 12 });
      e = await etatLigne(pg, '[data-tx="9205"]');
      dit(e && !e.ouvert && !e.actif && !(await pg.$('[data-depose-barre]')), 'V4 un appui au bord gauche (retour iOS) : rien ne bouge', JSON.stringify(e && { o: e.ouvert, a: e.actif }));
      // Une vente finalisée ne se glisse pas.
      e = await etatLigne(pg, '[data-tx="9202"]');
      dit(e && !e.lg, 'V4 une vente finalisée ne se glisse pas (aucun geste à proposer)', JSON.stringify(e && e.lg));
      dit(!errs.length, 'V2-V4 aucune erreur d’app', errs[0]);
      await ctx.close();
    });
    // ── V5. Mouvement réduit ───────────────────────────────────────────────────
    await essaie('V5', async () => {
      const { ctx, pg, errs } = await preparer(b, T, { reduit: true });
      await ouvrirVentes(pg);
      await glisser(pg, '[data-tx="9201"]', { part: 0.3 });
      const e = await etatLigne(pg, '[data-tx="9201"]');
      dit(e && e.ouvert === '1' && e.transition === 'none', 'V5 mouvement réduit : le tiroir s’ouvre sans ressort', JSON.stringify(e && { o: e.ouvert, tr: e.transition }));
      dit(!errs.length, 'V5 aucune erreur d’app', errs[0]);
      await ctx.close();
    });
    // ── A. À retirer : « Le code » et « Retiré » au glisser ───────────────────
    await essaie('A', async () => {
      const { ctx, pg, errs } = await preparer(b, T);
      await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
      await ouvrirAchats(pg);
      const sel = SEL_RETRAIT;
      await glisser(pg, sel, { part: 0.3 });
      let e = await etatLigne(pg, sel);
      await shot(pg, 'a-tiroir-390');
      dit(e && e.ouvert === '1' && e.acts.map((a) => a.k).join(',') === 'code,retire', 'A1 glisser court : « Le code » puis « Retiré » au bord droit', JSON.stringify(e && e.acts));
      dit(e && e.acts.every((a) => a.w >= 44 && a.h >= 44 && a.dedans) && e.deb <= 0, 'A1 actions ≥ 44 px, dans l’écran, aucun débordement', e && JSON.stringify(e.acts));
      await toucher(pg, `${sel} [data-lg-action="code"]`);
      const ouverte = await pg.evaluate((s) => { const l = document.querySelector(s); return { o: l && l.getAttribute('data-ouvert'), lg: l && l.getAttribute('data-lg-ouvert') }; }, sel);
      let presse = ''; try { presse = await pg.evaluate(() => navigator.clipboard.readText()); } catch (_) {}
      dit(ouverte.o === '1' && !ouverte.lg, 'A2 « Le code » ⇒ la ligne s’ouvre sur le code (le même geste que « Code »), le tiroir se referme', JSON.stringify(ouverte));
      dit(presse === '012345', 'A2 … et le code est copié tel quel (zéro de tête)', presse);
      await shot(pg, 'a-code-390');
      await glisser(pg, sel, { part: 0.8 });
      const pilule = await pg.waitForFunction(() => /retiré/i.test(document.body.innerText) && [...document.querySelectorAll('button')].some((b) => /^Annuler$/.test(b.textContent.trim())), null, { timeout: 4000 }).then(() => true).catch(() => false);
      await shot(pg, 'a-retire-annuler-390');
      const parti = (await pg.locator(sel).count()) === 0;
      dit(pilule && parti, 'A3 glisser long ⇒ « Retiré » : le colis sort de la liste, la pilule offre « Annuler »', JSON.stringify({ pilule, parti }));
      const btnAnn = pg.locator('button', { hasText: /^Annuler$/ }).last();
      if (await btnAnn.count()) await btnAnn.click();
      await pg.waitForTimeout(1500);
      dit((await pg.locator(sel).count()) > 0, 'A4 « Annuler » ⇒ le colis revient dans « à retirer »');
      dit(!errs.length, 'A aucune erreur d’app', errs[0]);
      await ctx.close();
    });
    // ── Q. Qui dorment : « Baisser » ouvre la feuille, rien ne part ───────────
    await essaie('Q', async () => {
      const { ctx, pg, errs } = await preparer(b, T);
      await ouvrirQD(pg);
      const sel = '[data-qd-ligne="900001"]';
      await glisser(pg, sel, { part: 0.3 });
      let e = await etatLigne(pg, sel);
      await shot(pg, 'q-tiroir-390');
      dit(e && e.ouvert === '1' && e.acts.map((a) => a.k).join(',') === 'agir,baisser', 'Q1 glisser court : « Agir » puis « Baisser »', JSON.stringify(e && e.acts));
      dit(e && e.acts.every((a) => a.w >= 44 && a.h >= 44 && a.dedans) && e.deb <= 0, 'Q1 actions ≥ 44 px, dans l’écran', e && JSON.stringify(e.acts));
      await toucher(pg, `${sel} [data-lg-action="baisser"]`);
      await pg.waitForSelector('[data-baisse-serie]', { timeout: 8000 }).catch(() => {});
      const s = await pg.evaluate(() => { const f = document.querySelector('[data-baisse-serie]'); return f ? [...f.querySelectorAll('[data-bp-ligne]')].map((x) => x.getAttribute('data-bp-ligne')) : null; });
      await shot(pg, 'q-feuille-390');
      dit(s && s.join(',') === '900001', 'Q2 « Baisser » ⇒ la feuille de baisse, pour CETTE annonce seulement', JSON.stringify(s));
      dit((await pg.evaluate(() => window.__cmds.length)) === 0, 'Q2 aucune commande partie : la feuille demande d’abord', JSON.stringify(await pg.evaluate(() => window.__cmds)));
      await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
      if (await pg.locator('[data-baisse-serie]').count()) { const f = pg.locator('[data-baisse-serie] button', { hasText: /Fermer|Annuler|Retour/ }).first(); if (await f.count()) await f.click(); await pg.waitForTimeout(400); }
      if (!(await pg.locator('[data-baisse-serie]').count())) {
        await glisser(pg, '[data-qd-ligne="900003"]', { part: 0.8 });
        await pg.waitForSelector('[data-baisse-serie]', { timeout: 8000 }).catch(() => {});
        const s2 = await pg.evaluate(() => { const f = document.querySelector('[data-baisse-serie]'); return f ? [...f.querySelectorAll('[data-bp-ligne]')].map((x) => x.getAttribute('data-bp-ligne')) : null; });
        dit(s2 && s2.join(',') === '900003', 'Q3 glisser long ⇒ la feuille (900003), jamais une baisse directe', JSON.stringify(s2));
        dit((await pg.evaluate(() => window.__cmds.length)) === 0, 'Q3 toujours aucune commande partie');
      } else dit(false, 'Q3 la feuille se referme (Échap ou « Fermer »)');
      dit(!errs.length, 'Q aucune erreur d’app', errs[0]);
      await ctx.close();
    });
    // ── K. Ordinateur : souris et clavier ──────────────────────────────────────
    await essaie('K', async () => {
      const { ctx, pg, errs } = await preparer(b, { width: 1512, height: 950 });
      await ouvrirVentes(pg);
      const r = await pg.evaluate(() => { const b = document.querySelector('[data-tx="9201"]').getBoundingClientRect(); return { x: b.left + b.width * 0.8, y: b.top + 30 }; });
      await pg.mouse.move(r.x, r.y); await pg.mouse.down(); await pg.mouse.move(r.x - 400, r.y, { steps: 10 }); await pg.mouse.up(); await pg.waitForTimeout(400);
      let e = await etatLigne(pg, '[data-tx="9201"]');
      dit(e && !e.ouvert && !e.actif, 'K1 à la souris, la ligne ne glisse pas (le clic a ses boutons)', JSON.stringify(e && { o: e.ouvert, a: e.actif }));
      dit(e && e.inert === true && e.cache === 'true', 'K2 tiroir fermé : inert + aria-hidden (jamais une tabulation cachée)', JSON.stringify(e && { i: e.inert, c: e.cache }));
      // Au clavier : Tab ne tombe jamais dans un tiroir.
      let dansTiroir = false;
      for (let k = 0; k < 40; k++) { await pg.keyboard.press('Tab'); if (await pg.evaluate(() => !!(document.activeElement && document.activeElement.closest('[data-lg-tiroir]')))) { dansTiroir = true; break; } }
      dit(!dansTiroir, 'K2 au clavier, 40 tabulations : aucune ne tombe dans un tiroir fermé');
      await pg.evaluate(() => { for (const x of document.querySelectorAll('[data-vente-plus]')) x.click(); }); await pg.waitForTimeout(300);
      const b9201 = await pg.evaluate(() => ({ depose: !!document.querySelector('[data-depose-vente="9201"]'), imprimer: !!document.querySelector('[data-fu-imprimer="9201"]') }));
      dit(b9201.depose && b9201.imprimer, 'K3 Ventes : « Déposé » et « Imprimer » existent en boutons de la ligne', JSON.stringify(b9201));
      await shot(pg, 'k-ventes-1512');
      await ouvrirAchats(pg);
      const rt = await pg.evaluate((s) => { const l = document.querySelector(s); return { retire: !!(l && l.querySelector('[data-colis-retire]')), code: !!(l && l.querySelector('[data-rp-code]')) }; }, SEL_RETRAIT);
      dit(rt.retire && rt.code, 'K3 À retirer : « J’ai retiré » et « Code » existent en boutons de la ligne', JSON.stringify(rt));
      await shot(pg, 'k-achats-1512');
      await ouvrirQD(pg);
      const qd = await pg.evaluate(() => ({ agir: !!document.querySelector('[data-qd-agir="900001"]'), cases: !!document.querySelector('[data-qd-case="900001"]'), baisser: !!document.querySelector('[data-qd-baisser]') }));
      dit(qd.agir && qd.cases && qd.baisser, 'K3 Qui dorment : « Agir », la case et « Baisser le prix » existent en boutons', JSON.stringify(qd));
      await shot(pg, 'k-qd-1512');
      dit(!errs.length, 'K aucune erreur d’app', errs[0]);
      await ctx.close();
    });
  } finally { if (b) await b.close(); srv.close(); }
  console.log(`\ncaptures : ${SHOTS}`);
  console.log(ko ? `\n❌ gestes glisser : ${ko} rouge(s) sur ${ko + okN}.` : `\n✅ gestes glisser : tout est vert (${okN} contrôles)`);
  process.exit(ko ? 1 : 0);
}
main();
