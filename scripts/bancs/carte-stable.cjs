// ── BANC : LES ÉPINGLES RESTENT COLLÉES À LA CARTE (2 nov.) ─────────────────
// Julien : « les points relais bougent un tout petit peu dès qu'on bouge un peu
// la caméra ». Ce banc REND la vraie carte (MapLibre du dépôt, WebGL logiciel)
// avec des points INVENTÉS, déplace la caméra de quelques pixels (panBy, petit
// zoom, glisser à la souris, et au doigt pour la carte de la Communauté), et
// compare à CHAQUE image la position à l'écran de chaque épingle (le bas de
// l'épingle, son point d'ancrage) à `map.project([lon, lat])` + son décalage.
//   · Colis → « À retirer » (1512 px, la carte n'est dessinée que sur ordinateur) :
//     trois points relais à Vannes, placés par la Base Adresse servie ici.
//   · Communauté (390 px tactile, 1512 px) : deux revendeurs inventés.
// L'écart toléré est 0,25 px (une épingle arrondie au pixel pendant que le fond
// glisse au sous-pixel tremble de 0,5 px — 1,5 px d'écran sur un iPhone).
// Le banc relie la carte au banc par une seule chose : le JS servi range la carte
// dans `window.__vrmCartes` avant son « load » (même code sinon). Le fond servi est un style raster
// quadrillé (tuiles fabriquées ici), assez texturé pour qu'un décalage se voie à
// la capture. `SHOTS=dossier` y range les captures. `BANC_PORT` change le port.
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData, metaDe, filtreData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4417);
const SEUIL = 0.25;

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const dans = (j) => new Date(MAINTENANT + j * 86400000).toISOString().slice(0, 10);
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
// Trois relais inventés (rues réelles de Vannes, coordonnées de la Base Adresse servies ici).
const POINTS = [
  { rue: '13 Rue Saint-Vincent', nom: 'Tabac du Port', lon: -2.7581, lat: 47.6542, code: 'A11111', tx: 9401 },
  { rue: '4 Place des Lices', nom: 'Presse des Lices', lon: -2.7552, lat: 47.6575, code: 'A22222', tx: 9402 },
  { rue: '21 Avenue Victor Hugo', nom: 'Épicerie Hugo', lon: -2.7629, lat: 47.6528, code: 'A33333', tx: 9403 },
];
const ACHATS = POINTS.map((p, i) => ({ transaction_id: p.tx, conversation_id: 7100 + i, title: ['Adidas Samba noire taille 40', 'Nike Dunk Low taille 42', 'New Balance 550 taille 41'][i], price: { amount: '40', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: ilYa(3) }));
const ROWS = [
  { id: 'main', data: {} },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: ACHATS } } },
  ...POINTS.map((p, i) => ({ id: `email_track_vinted_179000000000000${i}`, data: { type: 'suivi', carrier: 'vinted', suivi: `179000000000000${i}`, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: "Ton colis t'attend", receivedAt: ilYa(1), code: p.code, lieu: `${p.nom}, ${p.rue}, 56000 Vannes`, limite: dans(4) } })),
];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };

// ── Une tuile raster quadrillée (PNG fait à la main, zlib) ──────────────────
const crc = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return (b) => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
const morceau = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const TUILE = (() => {
  const T = 256, lignes = [];
  for (let y = 0; y < T; y++) { const l = Buffer.alloc(1 + T * 3); for (let x = 0; x < T; x++) { const trait = x % 32 === 0 || y % 32 === 0 || x === y; const v = trait ? 150 : 236; l[1 + x * 3] = v; l[2 + x * 3] = v; l[3 + x * 3] = trait ? 170 : 240; } lignes.push(l); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(T, 0); ihdr.writeUInt32BE(T, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), morceau('IHDR', ihdr), morceau('IDAT', zlib.deflateSync(Buffer.concat(lignes))), morceau('IEND', Buffer.alloc(0))]);
})();
const STYLE = { version: 8, sources: { banc: { type: 'raster', tiles: ['https://tiles.openfreemap.org/banc/{z}/{x}/{y}.png'], tileSize: 256, attribution: 'OpenFreeMap © OpenMapTiles © OpenStreetMap' } }, layers: [{ id: 'fond', type: 'background', paint: { 'background-color': '#eef0f2' } }, { id: 'banc', type: 'raster', source: 'banc' }] };

// ── Le serveur : dist/, et la carte posée dans window.__vrmCartes ───────────
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const ext = path.extname(p);
  r.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' });
  if (ext === '.js') {
    let s = fs.readFileSync(p, 'utf8');
    // Le seul crochet : la carte construite par l'app est GARDÉE (rien d'autre ne change).
    s = s.replace(/carte\.once\("load", /g, 'window.__vrmPose && window.__vrmPose(carte, ml); carte.once("load", ');
    s = s.replace(/m\.touchZoomRotate\.disableRotation\(\);/g, 'window.__vrmPose && window.__vrmPose(m, lib); m.touchZoomRotate.disableRotation();');
    return r.end(s);
  }
  fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function preparer(b, vp) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => {
    try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {}
    // Le seul crochet du banc : la carte construite par l'app, gardée pour la mesurer.
    window.__vrmCartes = [];
    // Chaque épingle posée par l'app (Marker.addTo) est notée sur SA carte.
    window.__vrmPose = (m, lib) => {
      window.__vrmCartes.push(m);
      const P = lib && lib.Marker && lib.Marker.prototype;
      if (P && !P.__vrmBanc) { const a = P.addTo; P.addTo = function (carte) { (carte.__vrmEpingles = carte.__vrmEpingles || new Set()).add(this); const r = a.apply(this, arguments); const rm = this.remove; this.remove = function () { carte.__vrmEpingles.delete(this); return rm.apply(this, arguments); }; return r; }; P.__vrmBanc = true; }
    };
    window.__vrmCarteMesuree = () => [...window.__vrmCartes].reverse().find((m) => m.__vrmEpingles && m.__vrmEpingles.size && m.getContainer().isConnected);
  });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const j = (d) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/api-adresse\.data\.gouv\.fr/.test(u)) {
      const q = decodeURIComponent(u);
      const p = POINTS.find((x) => q.includes(x.rue));
      return j({ features: p && /postcode=56000/.test(u) ? [{ geometry: { coordinates: [p.lon, p.lat] }, properties: { score: 0.95, type: 'housenumber', postcode: '56000', city: 'Vannes', label: p.rue + ' 56000 Vannes' } }] : [] });
    }
    if (/tiles\.openfreemap\.org\/styles\//.test(u)) return j(STYLE);
    if (/tiles\.openfreemap\.org\/banc\//.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: TUILE });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id) && filtreData(u)(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // La Communauté : trois revendeurs INVENTÉS (Cancale = soi, Rennes, Nantes).
  await pg.route('**/api/compte?mode=communaute', (r) => {
    if (r.request().method() !== 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' });
    const moi = { pid: 'p-moi', pseudo: 'Banc', ville: 'Cancale', pays: 'FR', lat: 48.7, lon: -1.85, depuis: ilYa(10) };
    const profils = [{ ...moi, moi: true, premier: true }, { pid: 'p-2', pseudo: 'Revendeur A', ville: 'Rennes', pays: 'FR', lat: 48.1, lon: -1.7, moi: false, premier: true }, { pid: 'p-3', pseudo: 'Revendeur B', ville: 'Nantes', pays: 'FR', lat: 47.2, lon: -1.55, moi: false, premier: true }];
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, carte: { acces: true, moi, profils, groupes: [] }, conversations: [], discordConnexion: false }) });
  });
  return { ctx, pg, errs };
}

// Dans la page : à chaque image pendant `geste`, l'écart (px) entre le bas de
// chaque épingle et sa place sur la carte. Rend le pire écart, le nombre
// d'images, et l'écart une fois la carte posée (après `moveend` + 400 ms).
const MESURE = async (pg, geste) => pg.evaluate(async (geste) => {
  const m = window.__vrmCarteMesuree();
  const boite = m.getContainer();
  const ecart = () => {
    const r = boite.getBoundingClientRect();
    let pire = 0, n = 0;
    for (const mk of m.__vrmEpingles || []) {
      const el = mk.getElement();
      const e = el.getBoundingClientRect();
      if (!e.width) continue;
      const anc = mk._anchor || 'center';
      const vu = { x: e.left + e.width / 2, y: anc === 'bottom' ? e.bottom : e.top + e.height / 2 };
      const off = mk.getOffset();
      const p = m.project(mk.getLngLat());
      const voulu = { x: r.left + p.x + off.x, y: r.top + p.y + off.y };
      pire = Math.max(pire, Math.abs(vu.x - voulu.x), Math.abs(vu.y - voulu.y)); n++;
    }
    return { pire, n };
  };
  const avant = ecart();
  let pire = 0, images = 0, fini = false, finA = 0;
  m.once('moveend', () => { fini = true; finA = performance.now(); });
  const boucle = () => new Promise((ok) => {
    const t0 = performance.now();
    const tour = () => {
      const e = ecart(); pire = Math.max(pire, e.pire); images++;
      if ((fini && performance.now() - finA > 400) || performance.now() - t0 > 5000) return ok();
      requestAnimationFrame(tour);
    };
    requestAnimationFrame(tour);
  });
  const attente = boucle();
  if (geste.panBy) m.panBy(geste.panBy, { duration: geste.duree || 500 });
  if (geste.zoom) m.zoomTo(m.getZoom() + geste.zoom, { duration: geste.duree || 500 });
  await attente;
  return { avant: avant.pire, pire, images, apres: ecart().pire, n: avant.n };
}, geste);

// Un glisser réel (souris ou doigt) : on lance la mesure, puis on bouge.
async function glisser(pg, tel, dx, dy) {
  const box = await pg.evaluate(() => { const r = window.__vrmCarteMesuree().getContainer().getBoundingClientRect(); return { x: r.left + r.width / 2 + 30, y: r.top + r.height / 2 + 30 }; });
  const mesure = pg.evaluate(() => new Promise((ok) => {
    const m = window.__vrmCarteMesuree(); const boite = m.getContainer();
    let pire = 0, images = 0, t0 = performance.now(), fin = 0;
    const c0 = m.project(m.getCenter()), l0 = m.getCenter();
    m.on('moveend', () => { fin = performance.now(); });
    const tour = () => {
      const r = boite.getBoundingClientRect();
      for (const mk of m.__vrmEpingles || []) {
        const e = mk.getElement().getBoundingClientRect(); if (!e.width) continue;
        const anc = mk._anchor || 'center';
        const vu = { x: e.left + e.width / 2, y: anc === 'bottom' ? e.bottom : e.top + e.height / 2 };
        const p = m.project(mk.getLngLat()), off = mk.getOffset();
        pire = Math.max(pire, Math.abs(vu.x - (r.left + p.x + off.x)), Math.abs(vu.y - (r.top + p.y + off.y)));
      }
      images++;
      if ((fin && performance.now() - fin > 500) || performance.now() - t0 > 6000) { const p = m.project(l0); return ok({ pire, images, bouge: Math.hypot(p.x - c0.x, p.y - c0.y) }); }
      requestAnimationFrame(tour);
    };
    requestAnimationFrame(tour);
  }));
  if (tel) {
    // Le doigt : des TouchEvent sur le canevas de la carte (le chemin que suit iOS).
    await pg.evaluate(async ({ x, y, dx, dy }) => {
      const cv = window.__vrmCarteMesuree().getCanvas();
      const t = (cx, cy) => new Touch({ identifier: 1, target: cv, clientX: cx, clientY: cy, pageX: cx, pageY: cy, radiusX: 4, radiusY: 4, force: 1 });
      const env = (type, cx, cy) => { const tt = type === 'touchend' ? [] : [t(cx, cy)]; cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: tt, targetTouches: tt, changedTouches: [t(cx, cy)] })); };
      env('touchstart', x, y);
      for (let i = 1; i <= 12; i++) { await new Promise((r) => requestAnimationFrame(r)); env('touchmove', x + dx * i / 12, y + dy * i / 12); }
      await new Promise((r) => requestAnimationFrame(r));
      env('touchend', x + dx, y + dy);
    }, { x: box.x, y: box.y, dx, dy });
  } else {
    await pg.mouse.move(box.x, box.y); await pg.mouse.down();
    for (let i = 1; i <= 12; i++) { await pg.mouse.move(box.x + dx * i / 12, box.y + dy * i / 12); await pg.waitForTimeout(16); }
    await pg.mouse.up();
  }
  return mesure;
}

async function jugerCarte(pg, T, tel, quoi) {
  const gestes = [
    { nom: 'panBy de 3 × 2 px', panBy: [3, 2], duree: 400 },
    { nom: 'panBy de −37,3 × 11,7 px', panBy: [-37.3, 11.7], duree: 600 },
    { nom: 'petit zoom (+0,3)', zoom: 0.3, duree: 500 },
  ];
  for (const g of gestes) {
    const r = await MESURE(pg, g);
    dit(r.n > 0 && r.images > 5 && r.pire <= SEUIL && r.apres <= SEUIL, `${T} ${quoi} : ${g.nom} — chaque épingle reste à sa place à chaque image (écart ≤ ${SEUIL} px)`, `pire ${r.pire.toFixed(2)} px sur ${r.images} images, posée ${r.apres.toFixed(2)} px, ${r.n} épingle(s)`);
    await pg.waitForTimeout(150);
  }
  const d = await glisser(pg, tel, -7, 4);
  dit(d.images > 5 && d.bouge >= 3 && d.pire <= SEUIL, `${T} ${quoi} : glisser de quelques pixels ${tel ? 'au doigt' : 'à la souris'} — la carte bouge et les épingles suivent le fond`, `carte déplacée de ${d.bouge.toFixed(1)} px, pire ${d.pire.toFixed(2)} px sur ${d.images} images`);
}

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--enable-unsafe-swiftshader'] });
    // ── Colis → « À retirer » : la carte des points relais (ordinateur) ──────
    await essaie('1512px Colis', async () => {
      const T = '1512px';
      const { ctx, pg, errs } = await preparer(b, { width: 1512, height: 950 });
      await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
      await pg.locator('[data-colis-section]').first().waitFor({ timeout: 25000 });
      await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' }))); /* (11 nov., lot DJ3) « À retirer » est en tête d'Achats */ await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 });
      await pg.waitForSelector('[data-relais-fond="pret"]', { timeout: 30000 });
      await pg.waitForFunction(() => document.querySelectorAll('[data-relais-epingle]').length >= 3 && !!window.__vrmCarteMesuree(), null, { timeout: 15000 });
      await pg.evaluate(() => { const f = document.querySelector('[data-relais-fond]'); f.scrollIntoView({ block: 'center' }); });
      await pg.waitForTimeout(800);
      const n = await pg.evaluate(() => document.querySelectorAll('[data-relais-epingle]').length);
      dit(n === 3, `${T} Colis : les trois points relais ont leur épingle`, String(n));
      if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await pg.locator('[data-relais-fond]').screenshot({ path: path.join(process.env.SHOTS, 'carte-stable-colis-1512.png') }); }
      await jugerCarte(pg, T, false, 'Colis');
      // L'épingle choisie (entourée) ne change pas de place non plus.
      await pg.evaluate(() => document.querySelector('[data-relais-epingle]').click());
      await pg.waitForTimeout(500);
      const r = await MESURE(pg, { panBy: [2.4, -1.6], duree: 400 });
      dit(r.pire <= SEUIL && r.apres <= SEUIL, `${T} Colis : l'épingle choisie reste à sa place quand la carte bouge`, `pire ${r.pire.toFixed(2)} px, posée ${r.apres.toFixed(2)} px`);
      dit(!errs.length, `${T} Colis : aucune erreur d'app`, errs[0]);
      await ctx.close();
    });
    // ── Communauté : la carte des revendeurs (au doigt à 390 px, à la souris) ─
    for (const vp of [{ width: 390, height: 780 }, { width: 1512, height: 950 }]) {
      const T = vp.width + 'px', tel = vp.width < 600;
      await essaie(T + ' Communauté', async () => {
        const { ctx, pg, errs } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=communaute`, { waitUntil: 'domcontentloaded' });
        await pg.waitForFunction(() => !!window.__vrmCarteMesuree && !!window.__vrmCarteMesuree() && document.querySelectorAll('.vrm-cm-pin').length >= 3, null, { timeout: 40000 });
        await pg.evaluate(() => window.__vrmCarteMesuree().getContainer().scrollIntoView({ block: 'center' }));
        await pg.waitForTimeout(800);
        if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, `carte-stable-communaute-${vp.width}.png`) });
        await jugerCarte(pg, T, tel, 'Communauté');
        dit(!errs.length, `${T} Communauté : aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ carte stable : ${ko} rouge(s).` : `\n✅ carte stable : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
