// ═══════════════════════════════════════════════════════════════════════════
// BANC : « PARTAGER » UNE FICHE (11 nov., lot partage-fiche)
//        npm run build && BANC_PORT=$((20000+RANDOM%20000)) node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/partage-fiche.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Le VRAI écran Annonces sur une base INVENTÉE (aucune donnée réelle) et la VRAIE
// route du partage (api/_lib/partage-fiche.js, exécutée ici contre une base en
// mémoire) : la page publique servie est celle de la production.
//   900001 Nike Cortez blanche 80 € · taille 42 · N°41 · achat 30 € · compte atelier_test
// A. Annonces → « … » → « Partager » : la feuille montre l'aperçu (titre, taille, prix),
//    jamais le N° ni le prix d'achat ; « Voir sur Vinted » coché ; durée 7 jours.
// B. « Créer le lien et partager » : UN lien créé, 7 j ; au doigt le partage du
//    téléphone reçoit l'adresse ; à la souris elle est copiée. 3 gestes.
// C. La page /p/<jeton> : sans script, photo, titre, taille, état, prix, « Voir sur Vinted »,
//    datée ; ni « 41 », ni « 30 € », ni le pseudo ; aucun débordement ; Open Graph.
// D. « Arrêter le partage » : la page dit « plus actif » (404).
// Jugé sur des data-* et des nombres. `BANC_CAPTURE=<dossier>` : captures (feuille et page).
// `BANC_DIST=<dossier>` : un autre build (preuve §6.1).
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const RACINE = process.env.BANC_RACINE || path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4617;
const CAPT = process.env.BANC_CAPTURE || '';
const UID = '11111111-1111-4111-8111-111111111111';

const auj = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const sec = (j) => Math.floor((auj - j * 86400e3) / 1000);
// Une photo SERVIE par le banc sous un hôte Vinted (le navigateur la demande à `images1.vinted.net`).
const PHOTO = 'https://images1.vinted.net/t/banc/f800/1.jpeg';
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 400 * 86400e3), owner: null }];
const ann = (id, titre, marque, prix, jours) => ({ id, title: titre, brand: marque, size: '42', status: 'Très bon état', price: { amount: String(prix), currency_code: 'EUR' }, created_at_ts: sec(jours),
  photos: [{ url: PHOTO, full_size_url: PHOTO }, { url: PHOTO.replace('1.jpeg', '2.jpeg'), full_size_url: PHOTO.replace('1.jpeg', '2.jpeg') }],
  is_closed: false, is_draft: false, is_hidden: false, promoted: false, view_count: 20, favourite_count: 1, url: 'https://www.vinted.fr/items/' + id + '-nike-cortez' });
const ITEMS = [ann(900001, 'Nike Cortez blanche', 'Nike', 80, 30)];
const ROWS = [
  { id: 'harvest_111_listings', data: { uid: '111', type: 'listings', nItems: 1, capturedAt: iso(auj - 60000), payload: { items: ITEMS, pagination: { total_entries: 1 } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(auj - 60000), payload: { my_orders: [] } } },
  { id: 'vinted_listing_dates', data: {} },
];
const NUMEROS = { 900001: { numero: '41', buyPrice: '30', fraisComplets: true } };
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id' || src === 'updated_at') { out[alias] = row[src]; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>[^>]*$/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};

// ── La base du PARTAGE (en mémoire), servie à la vraie route ─────────────────
const DB = [];
const chemin = (data, p) => { const m = /^data((?:->>?[A-Za-z0-9_"%-]+)*)$/.exec(p); if (!m) return undefined; let v = data; for (const s of (m[1].match(/->>?[^-]+/g) || [])) { const k = s.replace(/^->>?/, ''); v = v && typeof v === 'object' ? v[k] : undefined; if (s.startsWith('->>') && v != null && typeof v === 'object') v = JSON.stringify(v); } return v === undefined ? null : v; };
async function fetchBase(url, init = {}) {
  const u = new URL(String(url)); const meth = (init.method || 'GET').toUpperCase();
  const rep = (status, corps) => ({ ok: status < 300, status, json: async () => corps });
  const filt = () => DB.filter((r) => [...u.searchParams].every(([k, v]) => { if (['select', 'limit', 'on_conflict'].includes(k)) return true; const m = /^(eq|like)\.(.*)$/.exec(v); if (!m) return true; const val = String(r[k]); return m[1] === 'eq' ? val === m[2] : new RegExp('^' + m[2].replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$').test(val); }));
  if (meth === 'GET') { const sel = u.searchParams.get('select'); return rep(200, filt().map((r) => { if (!sel) return r; const o = {}; for (const it of sel.split(',')) { const [al, p] = it.includes(':') ? it.split(':') : [it, it]; o[al] = p === 'data' ? r.data : (p === 'id' || p === 'owner') ? r[p] : chemin(r.data, p); } return o; })); }
  if (meth === 'POST') { for (const l of JSON.parse(init.body)) { const ex = DB.find((r) => r.owner === l.owner && r.id === l.id); if (ex) ex.data = l.data; else DB.push({ owner: l.owner, id: l.id, data: l.data }); } return rep(201, null); }
  if (meth === 'DELETE') { for (const r of filt()) DB.splice(DB.indexOf(r), 1); return rep(204, null); }
  return rep(405, {});
}
let traiterPartage;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer(async (q, r) => {
  const f0 = q.url.split('?')[0];
  const mp = /^\/p\/([^/?#]*)$/.exec(f0);
  if (mp) {   // la PAGE PUBLIQUE : la vraie route, la vraie réponse
    const x = await traiterPartage({ base: 'http://base.banc', cle: 'cle-banc', fetch: fetchBase, methode: 'GET', p: decodeURIComponent(mp[1]), origine: `http://localhost:${PORT}` });
    r.writeHead(x.status, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
    return r.end(x.body);
  }
  let f = f0; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });

let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const TAILLES = [{ nom: '390', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { nom: '1512', vp: { width: 1512, height: 950 } }]
  .filter((t) => !process.env.BANC_TAILLE || t.nom === process.env.BANC_TAILLE);
// Une image JPEG minuscule (gris), servie pour toute photo Vinted.
const JPEG = fs.existsSync(path.join(RACINE, 'public', 'icon-512.png')) ? fs.readFileSync(path.join(RACINE, 'public', 'icon-512.png')) : Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');

async function page(b, T, { sombre = false } = {}) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, colorScheme: sombre ? 'dark' : 'light', permissions: ['clipboard-read', 'clipboard-write'] });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ n, sombre, tactile }) => { try {
    if (!sessionStorage.getItem('__banc')) { sessionStorage.setItem('__banc', '1'); localStorage.setItem('vrm_acces_direct', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); }
    window.__partages = [];
    // Au doigt : le partage du téléphone (il reçoit l'adresse). À la souris : aucun (copie).
    if (tactile) Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => { window.__partages.push(d); } });
    else { try { delete Navigator.prototype.share; } catch (_) {} }
  } catch (_) {} }, { n: NUMEROS, sombre, tactile: !!T.hasTouch });
  // ⚠️ Playwright prend la DERNIÈRE route d'abord (§6.6) : la photo Vinted après le filtre général.
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route(/^https:\/\/images1\.vinted\.net\//, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: JPEG }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: { vinted_annonce_numeros: NUMEROS, ...(sombre ? { vinted_dark: true } : {}) } }, sel)]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  // La route du partage : la VRAIE (session du banc = UID).
  const appels = [];
  await pg.route('**/api/compte?mode=partage*', async (route) => {
    const req = route.request();
    const corps = req.method() === 'POST' ? JSON.parse(req.postData() || '{}') : null;
    appels.push({ m: req.method(), action: corps && corps.action, corps });
    const x = await traiterPartage({ base: 'http://base.banc', cle: 'cle-banc', fetch: fetchBase, methode: req.method(), p: null, user: { id: UID }, corps, origine: `http://localhost:${PORT}` });
    return route.fulfill({ status: x.status, contentType: 'application/json', body: JSON.stringify(x.body) });
  });
  await pg.route(/\/api\/(?!compte\?mode=partage)/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, appels };
}
const capture = async (pg, nom, loc) => { if (!CAPT) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.waitForTimeout(350); await (loc || pg).screenshot({ path: path.join(CAPT, nom + '.png') }).catch(() => {}); };
const lireFeuille = (pg) => pg.evaluate(() => { const s = document.querySelector('[data-partage-feuille]'); if (!s) return null;
  const ap = s.querySelector('[data-partage-apercu]');
  return { etat: s.getAttribute('data-partage-feuille'), apercu: ap ? ap.innerText.replace(/\s+/g, ' ') : '', prix: (s.querySelector('[data-partage-apercu-prix]') || { getAttribute: () => null }).getAttribute('data-partage-apercu-prix'),
    sites: [...s.querySelectorAll('[data-partage-site]')].map((x) => x.getAttribute('data-partage-site') + ':' + (x.checked ? '1' : '0')),
    duree: (s.querySelector('[data-partage-duree][aria-pressed="true"]') || { getAttribute: () => null }).getAttribute('data-partage-duree'),
    url: (s.querySelector('[data-partage-url]') || {}).value || '', texte: s.innerText,
    deb: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    petites: [...s.querySelectorAll('button, input[type=checkbox], summary')].filter((x) => !x.disabled && x.getBoundingClientRect().width > 0).map((x) => { const z = x.closest('label') || x; const r = z.getBoundingClientRect(); return Math.min(r.width, r.height); }).filter((h) => h < 44).length }; });

(async () => {
  traiterPartage = (await import(pathToFileURL(path.join(RACINE, 'api/_lib/partage-fiche.js')).href)).traiterPartage;
  srv.listen(PORT);
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const T of TAILLES) {
      for (const sombre of [false, true]) {
        const suf = `${T.nom}${sombre ? '-sombre' : '-clair'}`;
        console.log(`\n══ ${T.nom} px${T.hasTouch ? ' (tactile)' : ''}${sombre ? ' · sombre' : ' · clair'}`);
        DB.length = 0;
        await essaie('ABCD ' + suf, async () => {
          const { ctx, pg, errs, appels } = await page(b, T, { sombre });
          await pg.goto(`http://localhost:${PORT}/?tab=vinted_annonces`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('[data-fiche-menu-ouvrir="900001"]', { state: 'attached', timeout: 40000 });
          await pg.waitForFunction(() => !document.getElementById('vrm-demarrage'), null, { timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(800);
          let gestes = 0;
          const plus = pg.locator('[data-fiche-plus-bouton]').first();
          if (await plus.isVisible().catch(() => false)) { await plus.click(); await pg.waitForTimeout(250); }   // le repli du téléphone (déjà là avant ce lot)
          await pg.locator('[data-fiche-menu-ouvrir="900001"]').first().click(); gestes++;
          await pg.waitForSelector('[data-fiche-partager="900001"]', { timeout: 8000 });
          await pg.locator('[data-fiche-partager="900001"]').click(); gestes++;
          await pg.waitForSelector('[data-partage-feuille]', { timeout: 15000 });
          await pg.waitForFunction(() => !document.querySelector('[data-partage-cherche]') && !document.querySelector('[data-partage-creer][disabled]'), null, { timeout: 15000 }).catch(() => {});
          let s = await lireFeuille(pg);
          dit(s && /Nike Cortez blanche/.test(s.apercu) && /Taille 42/.test(s.apercu) && /Très bon état/.test(s.apercu) && s.prix === '80', 'A1 l’aperçu : titre, taille, état, prix 80 €', s && s.apercu);
          dit(s && !/\b41\b|30\s?€|atelier_test/.test(s.apercu), 'A2 l’aperçu ne montre ni le N°, ni le prix d’achat, ni le pseudo', s && s.apercu);
          dit(s && s.sites.join(',') === 'vinted:1' && s.duree === '7', 'A3 « Voir sur Vinted » coché, lien valable 7 jours', s && JSON.stringify({ sites: s.sites, duree: s.duree }));
          dit(s && s.deb <= 0 && (!T.hasTouch || s.petites === 0), 'A4 aucun débordement ; au doigt, cibles ≥ 44 px', s && JSON.stringify({ deb: s.deb, petites: s.petites }));
          await capture(pg, `feuille-${suf}`);
          await pg.locator('[data-partage-creer]').click(); gestes++;
          await pg.waitForSelector('[data-partage-actuel]', { timeout: 15000 });
          s = await lireFeuille(pg);
          const jeton = (/\/p\/([A-Za-z0-9_-]{43})$/.exec(s.url) || [])[1];
          const creer = appels.filter((a) => a.action === 'creer');
          dit(jeton && creer.length === 1 && creer[0].corps.duree === 7 && !/"buyPrice"|"numero"|"41"/.test(JSON.stringify(creer[0].corps.fiche)), 'B1 UN lien créé (7 j), la fiche envoyée sans N° ni prix d’achat', s && s.url);
          if (T.hasTouch) {
            const p = await pg.evaluate(() => window.__partages);
            dit(p.length === 1 && p[0].url === s.url, 'B2 au doigt : le partage du téléphone reçoit l’adresse', JSON.stringify(p));
          } else {
            const clip = await pg.evaluate(() => navigator.clipboard.readText().catch(() => ''));
            dit(clip === s.url, 'B2 à la souris : l’adresse est copiée', clip);
          }
          dit(gestes === 3, 'B3 3 gestes : « … », « Partager », « Créer le lien et partager »', gestes);
          await capture(pg, `feuille-creee-${suf}`);
          // C. La page publique
          const ctx2 = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, colorScheme: sombre ? 'dark' : 'light', javaScriptEnabled: false });
          const pub = await ctx2.newPage();
          await pub.route(/^https:\/\/images1\.vinted\.net\//, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: JPEG }));
          const resp = await pub.goto(`http://localhost:${PORT}/p/${jeton}`);
          const html = await resp.text();
          const v = await pub.evaluate(() => ({ h1: (document.querySelector('h1') || {}).textContent || '', texte: document.body.innerText, deb: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            imgs: document.querySelectorAll('img').length, liens: [...document.querySelectorAll('[data-site]')].map((a) => a.getAttribute('data-site') + ' ' + Math.round(a.getBoundingClientRect().height)),
            fond: getComputedStyle(document.body).backgroundColor }));
          dit(resp.status() === 200 && v.h1 === 'Nike Cortez blanche' && /Taille 42 · Très bon état/.test(v.texte) && /80\s€/.test(v.texte) && v.imgs === 2, 'C1 la page : titre, taille · état, 80 €, 2 photos', v.texte.replace(/\s+/g, ' ').slice(0, 200));
          dit(v.liens.length === 1 && /^vinted (4[4-9]|[5-9]\d)$/.test(v.liens[0]) && /Infos vérifiées le/.test(v.texte), 'C2 « Voir sur Vinted » (≥ 44 px), page datée', JSON.stringify(v.liens));
          dit(!/\b41\b|30\s?€|atelier_test|Prix d’achat/.test(v.texte) && !/<script/i.test(html), 'C3 ni N°, ni prix d’achat, ni pseudo, aucun script');
          dit(/og:title" content="Nike Cortez blanche · 80\s€"/.test(html) && /og:image" content="https:\/\/images1\.vinted\.net\//.test(html), 'C4 Open Graph : titre · prix et photo (aperçu des messageries)');
          dit(v.deb <= 0 && (sombre ? /rgb\(0, 0, 0\)/.test(v.fond) : /rgb\(255, 255, 255\)/.test(v.fond)), 'C5 aucun débordement ; fond ' + (sombre ? 'noir' : 'blanc') + ' (thème du téléphone)', JSON.stringify({ deb: v.deb, fond: v.fond }));
          if (CAPT) { fs.mkdirSync(CAPT, { recursive: true }); await pub.screenshot({ path: path.join(CAPT, `page-${suf}.png`), fullPage: true }).catch(() => {}); }
          // D. Arrêter
          await pg.locator('[data-partage-arreter]').click();
          await pg.waitForFunction(() => !document.querySelector('[data-partage-actuel]'), null, { timeout: 10000 }).catch(() => {});
          const r2 = await pub.goto(`http://localhost:${PORT}/p/${jeton}`);
          dit(r2.status() === 404 && /plus actif/.test(await r2.text()), 'D1 « Arrêter le partage » : la page dit « plus actif » (404)', r2.status());
          dit(errs.length === 0, 'E1 aucune erreur JS', errs.join(' | ').slice(0, 200));
          await ctx2.close(); await ctx.close();
        });
      }
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} ${ok} contrôle(s) vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
