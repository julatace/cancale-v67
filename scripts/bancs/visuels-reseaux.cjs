// ═══════════════════════════════════════════════════════════════════════════
// BANC : VISUELS RÉSEAUX (11 nov., lot visuels-reseaux)
//        npm run build && BANC_PORT=$((20000+RANDOM%20000)) node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/visuels-reseaux.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Le VRAI écran Annonces sur une base INVENTÉE (aucune donnée réelle) ; les photos
// sont DESSINÉES par le banc (formes de couleur), servies par la route photo de VRM
// (`/api/compte?mode=photo`) — la voie de l'app quand l'extension est absente.
//   900001 « Basket test bleue » 80 € · 42 · N°41 · achat 30 € · compte atelier_test
//   900002 « Basket test verte » 65,50 € · 39 · 900003 « Basket test rouge » 120 €
//   900004 « Basket test grise » 50 € — sa photo est REFUSÉE (503) : « pas lisible »
// A. Annonces → « … » → « Visuel réseaux » : UNE image 1080 × 1080, puis Story 1080 × 1920 ;
//    les 3 modèles ; le pixel de la photo est bien dans l'image (canvas lisible, pas
//    souillé) ; jamais le N° ni le prix d'achat ni le pseudo dans la feuille.
// B. Sélectionner → 4 cochées → Actions → « Nouveautés de la semaine » : l'image
//    porte les 3 lisibles, la 4e est DITE « pas lisible » ; boutique posée ⇒ écrite.
// C. Toutes les photos refusées : AUCUNE image, la raison et « Réessayer ».
// D. Partager : au doigt, le partage du téléphone reçoit des FICHIERS PNG ; à la
//    souris, « Télécharger » enregistre le PNG.
// E. 390 tactile et 1512 : aucun débordement, cibles ≥ 44 px, aucune erreur JS.
// Jugé sur des data-* et des nombres. `BANC_CAPTURE=<dossier>` : captures de la feuille
// ET les PNG générés (à REGARDER). `BANC_DIST=<dossier>` : un autre build (preuve §6.1).
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const RACINE = process.env.BANC_RACINE || path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4618;
const CAPT = process.env.BANC_CAPTURE || '';

const auj = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const sec = (j) => Math.floor((auj - j * 86400e3) / 1000);
const PH = (id, k = 1) => `https://images1.vinted.net/t/banc/f800/${id}-${k}.jpeg`;
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: iso(auj), created_at: iso(auj - 400 * 86400e3), owner: null }];
const ann = (id, titre, prix, taille, jours) => ({ id, title: titre, brand: 'MarqueTest', size: taille, status: 'Très bon état', price: { amount: String(prix), currency_code: 'EUR' }, created_at_ts: sec(jours),
  photos: [1, 2, 3].map((k) => ({ url: PH(id, k), full_size_url: PH(id, k) })),
  is_closed: false, is_draft: false, is_hidden: false, promoted: false, view_count: 20, favourite_count: 1, url: 'https://www.vinted.fr/items/' + id + '-basket-test' });
const ITEMS = [ann(900001, 'Basket test bleue', 80, '42', 30), ann(900002, 'Basket test verte', 65.5, '39', 20), ann(900003, 'Basket test rouge', 120, '44', 10), ann(900004, 'Basket test grise', 50, '41', 5)];
const ROWS = [
  { id: 'harvest_111_listings', data: { uid: '111', type: 'listings', nItems: ITEMS.length, capturedAt: iso(auj - 60000), payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(auj - 60000), payload: { my_orders: [] } } },
  { id: 'vinted_listing_dates', data: {} },
];
const NUMEROS = { 900001: { numero: '41', buyPrice: '30', fraisComplets: true } };
const COULEURS = { 900001: '#2f6fd6', 900002: '#2f9e5a', 900003: '#d0453b', 900004: '#888888' };
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

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });

let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const TAILLES = [{ nom: '390', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, { nom: '1512', vp: { width: 1512, height: 950 } }]
  .filter((t) => !process.env.BANC_TAILLE || t.nom === process.env.BANC_TAILLE);

// Les photos INVENTÉES : une forme de basket stylisée sur fond clair, une couleur par annonce.
async function dessinerPhotos(b) {
  const pg = await b.newPage();
  const res = await pg.evaluate((COULEURS) => {
    const o = {};
    for (const [id, c] of Object.entries(COULEURS)) for (const k of [1, 2, 3]) {
      const cv = document.createElement('canvas'); cv.width = 800; cv.height = 1000; const x = cv.getContext('2d');
      x.fillStyle = k === 1 ? '#efeee9' : k === 2 ? '#e6e9ee' : '#f3ece4'; x.fillRect(0, 0, 800, 1000);
      x.fillStyle = 'rgba(0,0,0,.08)'; x.beginPath(); x.ellipse(400, 720, 300, 40, 0, 0, 7); x.fill();
      x.fillStyle = c; x.beginPath(); x.moveTo(130, 690); x.quadraticCurveTo(140, 470, 300, 430); x.lineTo(430, 400); x.quadraticCurveTo(520, 520, 690, 580); x.quadraticCurveTo(720, 640, 690, 690); x.closePath(); x.fill();
      x.fillStyle = '#fff'; x.fillRect(120, 680, 590, 34); x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.arc(330, 520, 26, 0, 7); x.fill();
      o[`${id}-${k}`] = cv.toDataURL('image/jpeg', 0.9).split(',')[1];
    }
    return o;
  }, COULEURS);
  await pg.close();
  return res;
}

async function page(b, T, photos, { refuse = new Set(), vue = 'vinted_annonces' } = {}) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, colorScheme: 'light', locale: 'fr-FR', acceptDownloads: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ n, tactile }) => { try {
    if (!sessionStorage.getItem('__banc')) { sessionStorage.setItem('__banc', '1'); localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_langue', JSON.stringify('fr')); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); }
    window.__partages = [];
    if (tactile) {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d) => !!(d && Array.isArray(d.files) && d.files.length) });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => { window.__partages.push({ title: d.title, files: (d.files || []).map((f) => ({ name: f.name, type: f.type, size: f.size })) }); } });
    } else { try { delete Navigator.prototype.share; delete Navigator.prototype.canShare; } catch (_) {} }
  } catch (_) {} }, { n: NUMEROS, tactile: !!T.hasTouch });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  const cdn = { n: 0 };
  await pg.route(/^https:\/\/images1\.vinted\.net\//, (r) => { cdn.n++; const m = /\/(\d+)-(\d)\.jpeg/.exec(r.request().url()); const k = m && `${m[1]}-${m[2]}`; if (!k || !photos[k] || refuse.has(m[1])) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from(photos[k], 'base64') }); });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: { vinted_annonce_numeros: NUMEROS } }, sel)]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // La route photo de VRM : APRÈS la générale (Playwright prend la dernière en premier, §6.6).
  const route = { n: 0 };
  await pg.route(/\/api\/compte\?mode=photo$/, async (r) => {
    route.n++;
    let url = ''; try { url = JSON.parse(r.request().postData() || '{}').url || ''; } catch (_) {}
    const m = /\/(\d+)-(\d)\.jpeg/.exec(url); const k = m && `${m[1]}-${m[2]}`;
    if (!k || !photos[k] || refuse.has(m[1])) return r.fulfill({ status: 503, contentType: 'application/json', body: '{"erreur":"photo indisponible"}' });
    return r.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from(photos[k], 'base64') });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${vue}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, route, cdn };
}
const clic = async (pg, sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.click({ timeout: 5000 }).catch(async () => { await pg.$eval(sel, (x) => x.click()); }); };
const capture = async (pg, nom) => { if (!CAPT) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.waitForTimeout(350); await pg.screenshot({ path: path.join(CAPT, nom + '.png') }).catch(() => {}); };
// Les images générées : dimensions, pixel au centre de la 1re photo, et (capture) le PNG lui-même.
const lireImages = (pg) => pg.evaluate(async () => {
  const s = document.querySelector('[data-visuels]'); if (!s) return null;
  const ap = s.querySelector('[data-visuels-apercu]');
  const imgs = [...s.querySelectorAll('[data-visuels-image]')];
  const out = [];
  for (const im of imgs) {
    if (!im.complete) await new Promise((ok) => { im.onload = ok; im.onerror = ok; });
    const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
    // la couleur la plus saturée de l'image (la basket dessinée doit y être)
    const d = x.getImageData(0, 0, cv.width, cv.height).data; let sat = 0, coul = '';
    for (let i = 0; i < d.length; i += 4 * 97) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mx - mn > sat) { sat = mx - mn; coul = `${d[i]},${d[i + 1]},${d[i + 2]}`; } }
    const b64 = cv.toDataURL('image/png').split(',')[1];
    out.push({ w: im.naturalWidth, h: im.naturalHeight, sat, coul, b64 });
  }
  return { etat: ap && ap.getAttribute('data-visuels-apercu'), imgs: out, texte: s.innerText,
    pasLisibles: [...s.querySelectorAll('[data-visuels-pas-lisible]')].map((x) => x.getAttribute('data-visuels-pas-lisible')),
    vide: (s.querySelector('[data-visuels-vide]') || { getAttribute: () => null }).getAttribute('data-visuels-vide'),
    partager: !!s.querySelector('[data-visuels-partager]'),
    deb: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    petites: [...s.querySelectorAll('button, input')].filter((x) => !x.disabled && x.getBoundingClientRect().width > 0).map((x) => { const r = x.getBoundingClientRect(); return Math.min(r.width, r.height); }).filter((h) => h < 43.5).length };
});
const attendreImages = (pg, n = 1) => pg.waitForFunction((n) => { const a = document.querySelector('[data-visuels-apercu]'); const v = a && a.getAttribute('data-visuels-apercu'); return v && v !== 'lecture' && v !== 'dessin' && (v === 'aucun' || v === 'refus' || Number(v) >= n) && [...document.querySelectorAll('[data-visuels-image]')].every((i) => i.complete); }, n, { timeout: 20000 });
const ranger = (nom, im) => { if (!CAPT || !im) return; fs.mkdirSync(CAPT, { recursive: true }); fs.writeFileSync(path.join(CAPT, nom + '.png'), Buffer.from(im.b64, 'base64')); };

(async () => {
  srv.listen(PORT);
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const photos = await dessinerPhotos(b);
    for (const T of TAILLES) {
      console.log(`\n══ ${T.nom} px${T.hasTouch ? ' (tactile)' : ''}`);
      await essaie('A ' + T.nom, async () => {
        const { ctx, pg, errs, route } = await page(b, T, photos, { refuse: new Set(['900004']) });
        await pg.waitForSelector('[data-fiche-menu-ouvrir="900001"]', { state: 'attached', timeout: 40000 });
        await pg.waitForFunction(() => !document.getElementById('vrm-demarrage'), null, { timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(800);
        const plus = pg.locator('[data-fiche-plus-bouton]').first();
        if (await plus.isVisible().catch(() => false)) { await plus.click(); await pg.waitForTimeout(250); }
        await clic(pg, '[data-fiche-menu-ouvrir="900001"]');
        await pg.waitForSelector('[data-fiche-visuels="900001"]', { timeout: 8000 });
        await clic(pg, '[data-fiche-visuels="900001"]');
        await pg.waitForSelector('[data-visuels]', { timeout: 15000 });
        await attendreImages(pg);
        let s = await lireImages(pg);
        dit(s && s.etat === '1' && s.imgs.length === 1 && s.imgs[0].w === 1080 && s.imgs[0].h === 1080, 'A1 une image carrée 1080 × 1080', s && JSON.stringify({ etat: s.etat, dims: s.imgs.map((i) => i.w + 'x' + i.h) }));
        dit(s && s.imgs[0] && s.imgs[0].sat > 90, 'A2 la photo est DANS l’image (canvas lisible, pas souillé)', s && s.imgs[0] && s.imgs[0].coul + ' sat=' + s.imgs[0].sat);
        dit(route.n >= 1, 'A3 la photo est passée par la route photo de VRM', String(route.n));
        dit(s && !/\b41\b|30\s?€|atelier_test/.test(s.texte), 'A4 la feuille ne montre ni le N°, ni le prix d’achat, ni le pseudo');
        dit(s && s.deb <= 0 && (!T.hasTouch || s.petites === 0), 'E1 aucun débordement ; au doigt, cibles ≥ 44 px', s && JSON.stringify({ deb: s.deb, petites: s.petites }));
        await capture(pg, `feuille-seule-${T.nom}`);
        if (T.nom === '1512') ranger('png-carre-epure', s.imgs[0]);
        for (const modele of ['plein', 'carte']) {
          await clic(pg, `[data-visuels-modele="${modele}"]`); await pg.waitForTimeout(300); await attendreImages(pg);
          const t = await lireImages(pg);
          dit(t && t.imgs.length === 1 && t.imgs[0].w === 1080 && t.imgs[0].sat > 90, `A5 modèle ${modele} : 1080 × 1080, photo dedans`, t && t.imgs.map((i) => i.w + 'x' + i.h + ' sat' + i.sat).join(','));
          if (T.nom === '1512') ranger(`png-carre-${modele}`, t.imgs[0]);
        }
        await clic(pg, '[data-visuels-format="story"]'); await pg.waitForTimeout(300);
        for (const modele of ['epure', 'plein', 'carte']) {
          await clic(pg, `[data-visuels-modele="${modele}"]`); await pg.waitForTimeout(300); await attendreImages(pg);
          const t = await lireImages(pg);
          dit(t && t.imgs.length === 1 && t.imgs[0].w === 1080 && t.imgs[0].h === 1920 && t.imgs[0].sat > 90, `A6 story ${modele} : 1080 × 1920, photo dedans`, t && t.imgs.map((i) => i.w + 'x' + i.h).join(','));
          if (T.nom === '1512') ranger(`png-story-${modele}`, t.imgs[0]);
        }
        await capture(pg, `feuille-story-${T.nom}`);
        // D. Partager / Télécharger
        if (T.hasTouch) {
          s = await lireImages(pg);
          dit(s.partager, 'D1 au doigt : « Partager » est là');
          await clic(pg, '[data-visuels-partager]'); await pg.waitForTimeout(400);
          const p = await pg.evaluate(() => window.__partages);
          dit(p.length === 1 && p[0].files.length === 1 && p[0].files[0].type === 'image/png' && p[0].files[0].name === 'vrm-story.png' && p[0].files[0].size > 20000, 'D2 le partage du téléphone reçoit le PNG', JSON.stringify(p));
        } else {
          s = await lireImages(pg);
          dit(!s.partager, 'D1 sans partage de fichiers : pas de « Partager »');
          const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 8000 }), clic(pg, '[data-visuels-telecharger]')]);
          dit(dl && dl.suggestedFilename() === 'vrm-story.png', 'D2 « Télécharger » enregistre vrm-story.png', dl && dl.suggestedFilename());
        }
        dit(errs.length === 0, 'E2 aucune erreur JS', errs.join(' | ').slice(0, 200));
        await ctx.close();
      });

      await essaie('B ' + T.nom, async () => {
        const { ctx, pg, errs } = await page(b, T, photos, { refuse: new Set(['900004']) });
        await pg.waitForSelector('[data-vue-selection]', { state: 'attached', timeout: 40000 });
        await pg.waitForFunction(() => !document.getElementById('vrm-demarrage'), null, { timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(600);
        await clic(pg, '[data-vue-selection]');
        await pg.waitForSelector('[data-selection-annonce="900004"]', { timeout: 10000 });
        for (const id of ['900001', '900002', '900003', '900004']) await clic(pg, `[data-selection-annonce="${id}"] input`);
        await clic(pg, '[data-actions-possibles]');
        await pg.waitForSelector('[data-action-sel="visuels"][data-action-sel-ok="oui"] button', { timeout: 8000 });
        await clic(pg, '[data-action-sel="visuels"] button');
        await pg.waitForSelector('[data-visuels-lot="1"]', { timeout: 15000 });
        await clic(pg, '[data-visuels-format="carre"]'); await clic(pg, '[data-visuels-modele="epure"]');
        await pg.fill('[data-visuels-boutique]', 'Atelier Test'); await pg.locator('[data-visuels-boutique]').blur();
        await pg.waitForTimeout(400); await attendreImages(pg);
        const s = await lireImages(pg);
        dit(s && s.imgs.length === 1 && s.imgs[0].w === 1080 && s.imgs[0].h === 1080, 'B1 « Nouveautés de la semaine » : une image carrée', s && JSON.stringify({ n: s.imgs.length, etat: s.etat }));
        dit(s && s.pasLisibles.length === 1 && /900004/.test(s.pasLisibles[0]) && /Basket test grise/.test(s.texte), 'B2 la photo refusée est DITE « pas lisible », l’annonce sort du visuel', s && JSON.stringify(s.pasLisibles));
        const reg = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_visuels_reglages') || 'null'); } catch (_) { return null; } });
        dit(reg && reg.boutique === 'Atelier Test', 'B3 le nom de boutique est rangé (réglage synchronisé)', JSON.stringify(reg));
        dit(s && s.deb <= 0 && (!T.hasTouch || s.petites === 0), 'E1 aucun débordement ; au doigt, cibles ≥ 44 px', s && JSON.stringify({ deb: s.deb, petites: s.petites }));
        await capture(pg, `feuille-lot-${T.nom}`);
        if (T.nom === '1512') {
          ranger('png-lot-carre-epure', s.imgs[0]);
          for (const [f, m] of [['carre', 'plein'], ['story', 'carte'], ['story', 'plein']]) {
            await clic(pg, `[data-visuels-format="${f}"]`); await clic(pg, `[data-visuels-modele="${m}"]`); await pg.waitForTimeout(400); await attendreImages(pg);
            const t = await lireImages(pg); ranger(`png-lot-${f}-${m}`, t.imgs[0]);
            dit(t && t.imgs.length === 1 && t.imgs[0].w === 1080 && t.imgs[0].h === (f === 'story' ? 1920 : 1080), `B4 lot ${f} ${m} : dimensions`, t && t.imgs.map((i) => i.w + 'x' + i.h).join(','));
          }
        }
        dit(errs.length === 0, 'E2 aucune erreur JS', errs.join(' | ').slice(0, 200));
        await ctx.close();
      });

      await essaie('C ' + T.nom, async () => {
        const { ctx, pg, errs } = await page(b, T, photos, { refuse: new Set(['900001', '900002', '900003', '900004']) });
        await pg.waitForSelector('[data-fiche-menu-ouvrir="900001"]', { state: 'attached', timeout: 40000 });
        await pg.waitForFunction(() => !document.getElementById('vrm-demarrage'), null, { timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(600);
        const plus = pg.locator('[data-fiche-plus-bouton]').first();
        if (await plus.isVisible().catch(() => false)) { await plus.click(); await pg.waitForTimeout(250); }
        await clic(pg, '[data-fiche-menu-ouvrir="900001"]');
        await clic(pg, '[data-fiche-visuels="900001"]');
        await pg.waitForSelector('[data-visuels]', { timeout: 15000 });
        await attendreImages(pg, 99);
        const s = await lireImages(pg);
        dit(s && s.imgs.length === 0 && s.vide === 'aucune' && /Aucune photo lisible/.test(s.texte) && !!(await pg.$('[data-visuels-reessayer]')), 'C1 aucune photo lisible ⇒ AUCUNE image, la raison et « Réessayer »', s && JSON.stringify({ n: s.imgs.length, vide: s.vide }));
        const tel = await pg.$('[data-visuels-telecharger]');
        dit(tel && await tel.isDisabled(), 'C2 rien à télécharger');
        await capture(pg, `feuille-vide-${T.nom}`);
        dit(errs.length === 0, 'E2 aucune erreur JS', errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} ${ok} contrôle(s) vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
