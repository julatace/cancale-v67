// ── BANC : LE FOCUS DANS UNE FEUILLE (9 nov., DA4 suite) ─────────────────────────
//        npm run build && node scripts/bancs/feuille-focus.cjs [dist] [port]
// Données INVENTÉES (le jeu de `republier.cjs`), 390 tactile et 1512, clair. Juge :
//  · la zone `aria-live` des messages (`.vrm-toasts`) existe AVANT tout message ;
//  · dans une confirmation (Annonces → Brouillons → « Mettre en ligne »), Tab et
//    Maj+Tab ne sortent jamais de la feuille du dessus ;
//  · Échap la ferme et rend le focus au bouton qui l'avait ouverte.
// 6 rouges sur origin/main 1087f9fd, 0 sur claude/direction-artistique-4.
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const DIST = process.argv[2] || path.join(RACINE, 'dist'), PORT = +(process.argv[3] || process.env.BANC_PORT || 4855);
let ko = 0;
const auj = new Date();
const ann = (id, o) => Object.assign({ id, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 10, favourite_count: 1 }, o);
const ITEMS = [
  ann(9102, { title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', favourite_count: 6, created_at_ts: Math.floor(auj / 1000) - 30 * 86400 }),
  ann(9103, { title: 'Adidas Spezial noir taille 38', brand_title: 'Adidas', favourite_count: 0, created_at_ts: Math.floor(auj / 1000) - 60 * 86400 }),
  ann(9106, { title: 'Nike Dunk low panda taille 41', created_at_ts: Math.floor(auj / 1000) - 5 * 86400 }),
  ann(9107, { title: 'Asics Gel-Kayano 14 taille 43', brand_title: 'Asics', favourite_count: 0, created_at_ts: Math.floor(auj / 1000) - 2 * 86400 }),
  ann(9201, { title: 'Nike Air Max 1 dark teal', is_draft: true, price: { amount: '0.0', currency_code: 'EUR' } }),
  ann(9202, { title: '', is_draft: true }),
];
const MAIN = { vinted_annonce_numeros: { '9102': { numero: '42' }, '9103': { numero: '43' }, '9106': { numero: '45', buyPrice: '47' }, '9107': { numero: '46' } } };
const rows = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } },
  { id: 'vinted_brouillon_9201', data: { id: '9201', uid: '111', titre: 'Nike Air Max 1 dark teal', prix: 65, nPhotos: 4, etat: 'brouillon' } },
];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8')) || [])[1];
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'banc-ext', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_test' }, cmds: {} } });
    if (d.__vmr === 'cmd' && d.cmd === 'publierBrouillon') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'couleur-absente', couleurs: { 1: 'Noir', 12: 'Blanc', 27: 'Beige' }, raison: "ce brouillon n'a pas de couleur" } });
    else if (d.__vmr === 'cmd') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
  });
  post({ __vmr: 'ready', version: o.version });
};
const projette = (row, sel) => { if (!sel || sel === '*') return row; const out = {}; for (const part of sel.split(',')) { const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue; const src = m[2], alias = m[1] || src.split(/->>|->/).pop(); if (src === 'id') { out[alias] = row.id; continue; } if (src === 'data') { out[alias] = row.data; continue; } let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/^"|"$/g, '')]; out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v); } return out; };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
srv.listen(PORT);
const SEUL = process.env.SEUL ? process.env.SEUL.split(',') : null;
const MOUV = process.env.MOUV === '1';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const theme of ['clair']) {
    const tag = `${vp.width}-${theme}`;
    if (SEUL && !SEUL.includes(tag)) continue;
    const ctx = await b.newContext({ viewport: vp, reducedMotion: MOUV ? 'no-preference' : 'reduce', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.addInitScript((dark) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); localStorage.setItem('vinted_dark', JSON.stringify(dark)); } catch (_) {} }, theme === 'sombre');
    await pg.addInitScript(PONT, { version: VERSION });
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
    await pg.route('**/rest/v1/**', (route) => {
      const u = decodeURIComponent(metaVersData(route.request().url()));
      const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
      if (route.request().method() !== 'GET') return j([]);
      if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
      if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
      const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
      const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
      const eq = /id=eq\.([^&]*)/.exec(u); if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
      const lk = /id=like\.([^&]*)/.exec(u); if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
      return j([]);
    });
    await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
    const etape = async (nom, f) => { try { await f(); } catch (e) { console.log(tag, nom, 'ÉCHEC', String(e.message).split('\n')[0]); } };
    try {
      await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
      await pg.locator('[data-vue-brouillons]').first().waitFor({ timeout: 15000 });
      const zone = await pg.evaluate(() => !!document.querySelector('.vrm-toasts[aria-live]'));
      if (!zone) ko++; console.log(tag, zone ? 'OK ' : 'KO ', 'la zone aria-live des messages existe avant tout message');
      await pg.locator('[data-vue-brouillons]').first().click(); await pg.waitForSelector('[data-selection-vue="brouillon"]', { timeout: 6000 });
      await pg.locator('[data-brouillons-detail]').first().click();
      await pg.locator('[data-brouillons-vinted]').waitFor({ state: 'visible', timeout: 4000 });
      const declencheur = pg.locator('[data-brouillon="9201"] [data-brouillon-publier]');
      await declencheur.focus(); await pg.keyboard.press('Enter');
      await pg.locator('.vrm-confirmation').waitFor({ timeout: 4000 });
      let dehors = 0;
      for (let i = 0; i < 8; i++) { await pg.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab'); const dans = await pg.evaluate(() => { const f = [...document.querySelectorAll('[data-feuille]')].pop(); return !!(f && f.contains(document.activeElement)); }); if (!dans) dehors++; }
      if (dehors) ko++; console.log(tag, dehors === 0 ? 'OK ' : 'KO ', 'Tab reste dans la confirmation', dehors);
      await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
      const rendu = await pg.evaluate(() => { const a = document.activeElement; return a && a.hasAttribute('data-brouillon-publier'); });
      if (!rendu) ko++; console.log(tag, rendu ? 'OK ' : 'KO ', 'Échap rend le focus au bouton qui avait ouvert la confirmation');
    } catch (e) { ko++; console.log(tag, 'KO  ÉCHEC', e.message.split('\n')[0]); }
    if (errs.length) console.log(tag, 'erreurs JS', errs.slice(0, 3));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(ko ? `${ko} contrôle(s) rouge(s)` : 'tout est vert'); process.exitCode = ko ? 1 : 0;
})();
