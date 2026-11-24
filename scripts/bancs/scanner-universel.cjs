require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « SCANNER UNIVERSEL » (24 nov., lot scanner-universel) — src/scanUniversel.js, src/ScannerRetrouver.jsx.
//  Julien : « UN bouton scanner. Je vise n'importe quoi et VRM ouvre directement la bonne chose. »
//
//  Le harnais de scripts/bancs/scan-bordereau-vente.cjs : une VRAIE caméra de Chromium nourrie d'images (chaque code
//  est GÉNÉRÉ ici par bwip-js — Code 128, QR, EAN-13 —, lu par le lecteur de l'app : zxing-cpp en WebAssembly).
//  Aucune donnée réelle : 50 ventes au MÊME titre, des paires N°100 à N°149, la 230 et l'ancienne B230 (archive 013).
//  Exige (data-* seulement) :
//   A 390 clair · la barre du haut ⇒ Scanner ; le Code 128 « 55… » (26 chiffres) d'UNE vente parmi 50 au même titre ⇒
//     le code lu montré (1 s), SA fiche, puis l'écran Ventes ouvert seul sur CETTE vente ; la caméra coupée ;
//   B 390 sombre · un QR « VRM-124 » (l'étiquette d'un carton) ⇒ la fiche de la paire N°124 s'ouvre seule ;
//   C 1512 clair · la boîte (EAN-13) ⇒ « Code d'une boîte », « Chercher » seulement : RIEN ne s'ouvre (3 s après) ;
//   D 1512 sombre · un Code 128 « 230 » ⇒ les DEUX (230 et B230, remise à zéro du 11 oct.) : le choix, rien d'ouvert ;
//   E 390 clair · la RAFALE : trois codes à la suite (suivi, n° de transaction, code de retrait en QR) ⇒ trois lignes
//     (SA vente, SA vente, SON achat), la caméra reste ouverte, rien ne s'ouvre seul.
//  Partout : cibles ≥ 44 px, rien ne déborde, aucune erreur d'app, aucune image envoyée.
//  Lancer : BANC_DIST=<dist> BANC_MODULES=<dossier>/node_modules node scripts/bancs/scanner-universel.cjs
//           (bwip-js : npm i --prefix <dossier> bwip-js) ; SHOTS=<dossier> pour les captures.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs'), http = require('http'), os = require('os'), zlib = require('zlib');
let PW;
try { PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright')); }
catch (_) { PW = require('playwright'); }
const { lancer } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4731);
const SHOTS = process.env.SHOTS || '';
const LETTRES = process.env.SCAN_LETTRES || '';
const MS = Date.now(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const jourDans = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d !== undefined && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 240)); } };

const chercher = (nom) => {
  for (const base of [path.join(__dirname, '..', '..'), process.env.BANC_MODULES ? path.dirname(process.env.BANC_MODULES) : null].filter(Boolean)) {
    try { return require.resolve(nom, { paths: [base] }); } catch (_) {}
  }
  return null;
};
const BWIP = chercher('bwip-js');
if (!BWIP) { console.log('❌ module du banc absent : bwip-js — npm i --prefix <dossier> bwip-js, puis BANC_MODULES=<dossier>/node_modules'); process.exit(1); }
const bwipjs = require(BWIP);

// ── Les données (INVENTÉES) ──────────────────────────────────────────────────
const N = 50;
const TITRE = 'Nike Dunk Low panda';
const TX = (k) => String(15193000000 + k);                   // n° de transaction (11 chiffres)
const MR = (k) => String(46000000 + k * 13);                  // n° Mondial Relay (8 chiffres)
const LONG = (k) => '55' + MR(k) + '0101' + '000000123456';   // le Code 128 de 26 chiffres de l'étiquette
const gs1 = (d) => { let s = 0; for (let i = d.length - 1, p = 3; i >= 0; i--, p = p === 3 ? 1 : 3) s += Number(d[i]) * p; return d + ((10 - (s % 10)) % 10); };
const EAN = gs1('301234500124');                              // une boîte (finit par… rien de reconnaissable)
const TX_ACHAT = '16000000301', MR_ACHAT = '52718281', CODE_RETRAIT = '012345';
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const vente = (k) => ({ transaction_id: Number(TX(k)), title: TITRE, size_title: String(36 + (k % 10)), user_login: `acheteur_${k}`, price: { amount: '50', currency_code: 'EUR' },
  status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: iso(MS - J - k * 60000), photo: { url: url(k + 1) } });
const VENTES = Array.from({ length: N }, (_, k) => vente(k));
const NUMS = Object.fromEntries(VENTES.map((v, k) => [String(v.transaction_id), { numero: String(100 + k) }]));
const FICHES = Object.fromEntries([
  ...Array.from({ length: N }, (_, k) => [`it${k}`, { numero: String(100 + k), title: TITRE, photo: url(k + 1), accountId: '111' }]),
  ['it230', { numero: '230', title: 'Adidas Samba noire', accountId: '111' }], ['itB230', { numero: 'B230', title: 'Asics Gel 1130', accountId: '111' }],
]);
const ACHATS = [{ transaction_id: Number(TX_ACHAT), conversation_id: 7301, title: 'New Balance 530 grise', size_title: '40', user_login: 'vendeur_1', price: { amount: '40', currency_code: 'EUR' },
  status: 'Colis déposé en point relais', transaction_user_status: 'needs_action', date: iso(MS - 5 * J), photo: { url: url(90) } }];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const LIGNES = [
  ...VENTES.map((v, k) => ({ id: 'email_bord_' + v.transaction_id, data: { transaction: String(v.transaction_id), uid: '111', filename: `b-${k}.pdf`, modele: TITRE, article: TITRE, receivedAt: iso(MS - 3600e3), suivi: MR(k), transporteur: 'mondialrelay', pdfB64: PDF_B64 } })),
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS), payload: { my_orders: ACHATS } } },
  { id: `email_track_mondialrelay_${MR_ACHAT}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi: MR_ACHAT, transaction: TX_ACHAT, status: 'available', statusLabel: 'Arrivé au point de retrait',
    subject: `Votre colis ${MR_ACHAT} est disponible`, receivedAt: iso(MS - 0.3 * J), emailAt: iso(MS - 0.3 * J), arriveLe: iso(MS - 0.3 * J), code: CODE_RETRAIT,
    lieu: 'Point relais inventé, 35260 Cancale', limite: jourDans(4), consigne: false, account: 'compte_test' } },
];

// Les codes filmés (une scène = une vidéo ; la rafale = trois codes à la suite).
const CODES = {
  A: [{ bcid: 'code128', text: LONG(23), l: 1 }],
  B: [{ bcid: 'qrcode', text: 'VRM-124', l: 2 }],
  C: [{ bcid: 'ean13', text: EAN.slice(0, 12), l: 1 }],
  D: [{ bcid: 'code128', text: '230', l: 1 }],
  E: [{ bcid: 'code128', text: MR(5), l: 1 }, { bcid: 'code128', text: TX(7), l: 1 }, { bcid: 'qrcode', text: CODE_RETRAIT, l: 2 }],
};

// ── Une image ⇒ une vidéo Y4M (la « caméra ») ────────────────────────────────
function lirePng(buf) {
  let p = 8, w = 0, h = 0, bd = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const n = buf.readUInt32BE(p), t = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; if (d[12]) throw new Error('PNG entrelacé'); }
    else if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break;
    p += 12 + n;
  }
  if (bd !== 8) throw new Error('PNG profondeur ' + bd);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct]; if (!ch) throw new Error('PNG type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)), ligne = w * ch, out = Buffer.alloc(w * h), prec = Buffer.alloc(ligne), cour = Buffer.alloc(ligne);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (ligne + 1)], src = raw.subarray(y * (ligne + 1) + 1, (y + 1) * (ligne + 1));
    for (let i = 0; i < ligne; i++) {
      const a = i >= ch ? cour[i - ch] : 0, b = prec[i], c = i >= ch ? prec[i - ch] : 0;
      let v = src[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cour[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = x * ch; let g = ch >= 3 ? Math.round(0.299 * cour[o] + 0.587 * cour[o + 1] + 0.114 * cour[o + 2]) : cour[o];
      if (ch === 4 || ch === 2) { const al = cour[o + ch - 1] / 255; g = Math.round(g * al + 255 * (1 - al)); }
      out[y * w + x] = g;
    }
    cour.copy(prec);
  }
  return { w, h, gris: out };
}
const W = 1280, H = 720;
async function imageDuCode(code) {
  const Y = Buffer.alloc(W * H, 70);   // une table grise sous l'étiquette
  const ew = Math.round(W * 0.74), eh = Math.round(H * 0.56), ex = (W - ew) >> 1, ey = (H - eh) >> 1;
  for (let y = ey; y < ey + eh; y++) Y.fill(246, y * W + ex, y * W + ex + ew);
  const opts = { bcid: code.bcid, text: code.text, ...(code.l === 1 ? { height: 18 } : {}), includetext: false, paddingwidth: 0, paddingheight: 0 };
  const un = lirePng(await bwipjs.toBuffer({ ...opts, scale: 1 }));
  // L'échelle ENTIÈRE la plus grande qui tient (un module = un nombre entier de pixels), plafonnée pour un code court.
  const echelle = Math.max(1, Math.min(code.l === 1 ? 6 : 12, Math.floor(Math.min((ew * 0.86) / un.w, (eh * 0.8) / un.h))));
  const im = lirePng(await bwipjs.toBuffer({ ...opts, scale: echelle }));
  const ix = (W - im.w) >> 1, iy = (H - im.h) >> 1;
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) Y[(iy + y) * W + ix + x] = im.gris[y * im.w + x] < 128 ? 22 : 246;
  return Y;
}
async function videoDesCodes(codes, fichier) {
  const UV = Buffer.alloc((W / 2) * (H / 2), 128);
  const parts = [Buffer.from(`YUV4MPEG2 W${W} H${H} F2:1 Ip A1:1 C420jpeg\n`)];
  for (const c of codes) { const Y = await imageDuCode(c); const im = Buffer.concat([Buffer.from('FRAME\n'), Y, UV, UV]); for (let i = 0; i < 4; i++) parts.push(im); }
  fs.writeFileSync(fichier, Buffer.concat(parts));
}

// ── Le serveur de l'app et de la base ────────────────────────────────────────
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
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
    if (src === 'updated_at') { out[alias] = iso(MS); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const TEINTES = ['#dfe3e8', '#e8e1d8', '#dfe5dd', '#e6dcdc', '#e2dfe8', '#e8e4d6'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${TEINTES[k % 6]}"/><path d="M60 250 C80 190 150 175 190 200 C230 222 285 205 330 232 C352 246 346 282 306 284 L84 284 C62 284 52 268 60 250 Z" fill="rgba(30,34,40,.62)"/><text x="200" y="120" font-size="90" text-anchor="middle" fill="rgba(0,0,0,.35)" font-family="sans-serif">${k}</text></svg>`;

async function ouvrir(b, vp, sombre, debut) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.grantPermissions(['camera'], { origin: `http://localhost:${PORT}` }).catch(() => {});
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const envois = [];
  pg.on('request', (q) => { const d = q.postData() || ''; if (/data:image|image\/(jpeg|png|webp)|\bblob:/i.test(d) || /multipart\/form-data/i.test(q.headers()['content-type'] || '')) envois.push(q.url()); });
  await pg.addInitScript(({ sombre: s, nums, fiches }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
      if (!sessionStorage.getItem('banc_init')) {
        sessionStorage.setItem('banc_init', '1');
        localStorage.setItem('vinted_sale_overrides', JSON.stringify(nums));
        localStorage.setItem('vinted_annonce_numeros', JSON.stringify(fiches));
        localStorage.setItem('vinted_used_numeros', JSON.stringify([...Object.values(fiches).map((f) => (/^\d+$/.test(f.numero) ? Number(f.numero) : f.numero))]));
        localStorage.setItem('vrm_numerotation', JSON.stringify({ archive: 'B', coupure: '2026-10-09T00:00:00Z' }));
        localStorage.removeItem('vrm_scan_rafale');
      }
    } catch (_) {}
    window.__pistes = [];
    const md = navigator.mediaDevices;
    if (md && md.getUserMedia) { const g0 = md.getUserMedia.bind(md); md.getUserMedia = async (c) => { const st = await g0(c); window.__pistes.push(...st.getTracks()); return st; }; }
    // Le retour au toucher : chaque vibration demandée est notée (Chromium de bureau n'en fait rien).
    window.__vibre = []; try { navigator.vibrate = (m) => { window.__vibre.push(m); return true; }; } catch (_) {}
  }, { sombre: !!sombre, nums: NUMS, fiches: FICHES });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const m = /images1\.vinted\.net\/t\/b(\d+)\//.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(Number(m[1])) });
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
    return ['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(MS), cap: r.data.capturedAt });
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
  await pg.goto(`http://localhost:${PORT}/?tab=${debut}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, envois };
}

// L'état du scanner, lu sur ses data-* seulement.
const etat = (pg) => pg.evaluate(() => {
  const s = document.querySelector('[data-scan-r]');
  const a = (q, k) => { const e = document.querySelector(q); return e ? e.getAttribute(k) : null; };
  return { ouvert: !!s, camera: s ? s.getAttribute('data-scan-r-camera') : null, resultat: a('[data-scan-r-resultat]', 'data-scan-r-resultat') || '',
    fiche: a('[data-scan-r-fiche]', 'data-scan-r-fiche'), num: a('[data-scan-r-fiche]', 'data-scan-r-num'), auto: a('[data-scan-u-auto]', 'data-scan-u-auto'),
    par: a('[data-scan-u-par]', 'data-scan-u-par'), lu: a('[data-scan-u-lu]', 'data-scan-u-lu'), genre: (document.querySelector('[data-scan-u-genre]') || {}).textContent || '',
    choix: [...document.querySelectorAll('[data-scan-r-choix]')].map((e) => e.getAttribute('data-scan-r-choix')).sort(),
    ean: a('[data-scan-u-ean]', 'data-scan-u-ean'), chercher: a('[data-scan-u-chercher]', 'data-scan-u-chercher'), ouvrir: [...document.querySelectorAll('[data-scan-r-ouvrir]')].length,
    rafale: [...document.querySelectorAll('[data-scan-u-ligne]')].map((e) => e.getAttribute('data-scan-u-ligne') + '|' + e.getAttribute('data-scan-u-ligne-etat')),
    fichePaire: a('[data-fiche-paire]', 'data-fiche-paire'), vibre: (window.__vibre || []).length };
});
const cibles = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-scan-r] button, [data-scan-r] input')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
  .map((e) => ({ q: e.getAttribute('aria-label') || e.textContent.trim().slice(0, 24) || e.tagName, h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) })));
const deborde = (pg) => pg.evaluate(() => { const s = document.querySelector('[data-scan-r]'); const w = window.innerWidth;
  const hors = s ? [...s.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > w + 1 || r.left < -1) && !e.closest('.vrm-rtv-vue'); }).map((e) => String(e.className).slice(0, 30)) : [];
  return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, hors: hors.slice(0, 4) }; });
// Aucune couleur orange/ambre dans le scanner (décision du 23 nov.) : teinte HSL des fonds, bords et textes rendus.
const sansOrange = (pg) => pg.evaluate(() => {
  const hsl = (c) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c || ''); if (!m || (m[4] != null && Number(m[4]) < 0.05)) return null; const [r, g, b] = [m[1], m[2], m[3]].map((x) => x / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2, d = mx - mn; if (d < 0.08) return null; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return { h, s }; };
  const out = [];
  for (const e of document.querySelectorAll('[data-scan-r] *')) { const st = getComputedStyle(e); for (const k of ['color', 'backgroundColor', 'borderTopColor']) { const x = hsl(st[k]); if (x && x.s > 0.35 && x.h >= 20 && x.h <= 50) out.push(k + ':' + st[k] + ' ' + String(e.className).slice(0, 24)); } }
  return out.slice(0, 4);
});
const communs = async (pg, nom) => {
  const c = await cibles(pg);
  dit(c.length > 0 && c.every((x) => x.h >= 44), `${nom} : cibles ≥ 44 px`, JSON.stringify(c.filter((x) => x.h < 44)));
  const d = await deborde(pg);
  dit(d.page <= 1 && !d.hors.length, `${nom} : rien ne déborde`, JSON.stringify(d));
  const o = await sansOrange(pg);
  dit(!o.length, `${nom} : aucun orange`, JSON.stringify(o));
};
// Ouvre le scanner par l'entrée universelle : la barre du haut (téléphone) ou le champ de recherche (ordinateur).
const ouvrirScanner = async (pg, tel) => {
  if (tel) { await pg.waitForSelector('[data-n-tete-scanner]', { timeout: 30000 }); await pg.waitForTimeout(1500); await pg.click('[data-n-tete-scanner]'); }
  else {
    // À l'ordinateur : l'icône Scanner des outils de la barre latérale (sur chaque écran).
    await pg.waitForSelector('[data-n-outils] [data-n-tete-scanner]', { timeout: 30000 }); await pg.waitForTimeout(1500);
    await pg.click('[data-n-outils] [data-n-tete-scanner]');
  }
  await pg.waitForSelector('[data-scan-r]', { timeout: 10000 });
};
const attendreResultat = (pg, ms = 40000) => pg.waitForFunction(() => { const r = document.querySelector('[data-scan-r-resultat]'); return r && r.getAttribute('data-scan-r-resultat') !== 'attente'; }, null, { timeout: ms }).then(() => true, () => false);

async function scene(lettre, nom, vp, sombre, debut, fn) {
  if (LETTRES && !LETTRES.includes(lettre)) return;
  console.log(`\n— ${lettre} · ${nom}`);
  const fichier = path.join(os.tmpdir(), `banc-scan-univ-${process.pid}-${lettre}.y4m`);
  await videoDesCodes(CODES[lettre], fichier);
  const args = ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${fichier}`];
  const b = await lancer(PW, { executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args });
  const shot = async (pg, q) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `scanner-universel-${lettre}-${nom}-${q}.png`) }).catch(() => {}); };
  try {
    const o = await ouvrir(b, vp, sombre, debut);
    await essaie(`${lettre} ${nom}`, () => fn(o, shot));
    dit(o.envois.length === 0, `${lettre} : aucune image envoyée`, o.envois.slice(0, 2).join(' '));
    dit(o.errs.length === 0, `${lettre} : aucune erreur d’app`, o.errs.join(' | ').slice(0, 300));
    await o.ctx.close();
  } finally { await b.close(); try { fs.unlinkSync(fichier); } catch (_) {} }
}

(async () => {
  try {
    if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/ absent : npm run build');
    const TEL = { width: 390, height: 844 }, ORDI = { width: 1512, height: 900 };

    // A — la barre du haut ⇒ le Code 128 d'UNE vente parmi 50 au même titre ⇒ sa fiche, puis Ventes ouvert seul.
    await scene('A', '390-clair', TEL, false, 'journee', async ({ pg }, shot) => {
      await ouvrirScanner(pg, true);
      dit(await attendreResultat(pg), 'A : un résultat');
      const e = await etat(pg);
      dit(e.resultat === 'un' && e.fiche === 'vente:v:' + TX(23) && e.num === '123', 'A : le Code 128 « 55… » ⇒ LA vente (N°123) parmi 50 au même titre', JSON.stringify(e));
      dit(e.lu === LONG(23) && e.genre.length > 0, 'A : le code lu est montré (et ce qu’il est)', JSON.stringify({ lu: e.lu, genre: e.genre }));
      dit(e.auto === 'vente:v:' + TX(23) && e.vibre >= 1, 'A : ouverture directe annoncée ; une vibration courte demandée', JSON.stringify({ auto: e.auto, vibre: e.vibre }));
      await shot(pg, '1-lu');   // (les cibles et débords se jugent en C, D, E : ici la fiche part au bout d'1 s)
      const parti = await pg.waitForFunction((tx) => !document.querySelector('[data-scan-r]') && !!document.querySelector(`[data-cible-notif="vente"]:is([data-tx="${tx}"], [data-cible~="vente:${tx}"]), [data-fiche-ligne-cle*="${tx}"]`), TX(23), { timeout: 9000 }).then(() => true, () => false);
      dit(parti, 'A : 1 s plus tard, Ventes ouvert sur CETTE vente, sans un toucher');
      await pg.waitForTimeout(600); await shot(pg, '2-ouverte');
      const p = await pg.evaluate(() => window.__pistes.map((t) => t.readyState));
      dit(p.length >= 1 && p.every((x) => x === 'ended'), 'A : la caméra coupée en partant', JSON.stringify(p));
    });

    // B — l'étiquette d'un carton (QR « VRM-124 ») ⇒ la fiche de la paire N°124, ouverte seule.
    await scene('B', '390-sombre', TEL, true, 'journee', async ({ pg }, shot) => {
      await ouvrirScanner(pg, true);
      dit(await attendreResultat(pg), 'B : un résultat');
      const e = await etat(pg);
      dit(e.resultat === 'un' && e.fiche === 'paire:n:124' && e.par === 'numero' && e.auto === 'paire:n:124', 'B : « VRM-124 » ⇒ LA paire N°124 (parmi 50 au même titre), ouverture directe', JSON.stringify(e));
      await shot(pg, '1-lu');
      const ouverte = await pg.waitForFunction(() => !document.querySelector('[data-scan-r]') && !!document.querySelector('[data-fiche-paire]'), null, { timeout: 9000 }).then(() => true, () => false);
      const f = await etat(pg);
      dit(ouverte && /124/.test(f.fichePaire || ''), 'B : la fiche de la paire N°124 ouverte, sans un toucher', JSON.stringify(f.fichePaire));
      await pg.waitForTimeout(800); await shot(pg, '2-fiche');
    });

    // C — la boîte (EAN-13) ⇒ « Chercher » seulement, jamais une paire ouverte.
    await scene('C', '1512-clair', ORDI, false, 'journee', async ({ pg }, shot) => {
      await ouvrirScanner(pg, false);
      dit(await attendreResultat(pg), 'C : un résultat');
      let e = await etat(pg);
      dit(e.resultat === 'ean' && e.ean === EAN && !e.fiche && e.ouvrir === 0 && e.chercher === EAN, 'C : la boîte (EAN-13) ⇒ « Code d’une boîte », « Chercher » seulement', JSON.stringify(e));
      await communs(pg, 'C'); await shot(pg, '1-boite');
      await pg.waitForTimeout(3000);
      e = await etat(pg);
      dit(e.ouvert && e.resultat === 'ean' && !e.fichePaire, 'C : 3 s plus tard, rien ne s’est ouvert', JSON.stringify({ ouvert: e.ouvert, r: e.resultat, fp: e.fichePaire }));
    });

    // D — « 230 » sur un carton ⇒ la 230 ET la B230 : la question, rien d'ouvert.
    await scene('D', '1512-sombre', ORDI, true, 'journee', async ({ pg }, shot) => {
      await ouvrirScanner(pg, false);
      dit(await attendreResultat(pg), 'D : un résultat');
      await pg.waitForTimeout(1500);
      const e = await etat(pg);
      dit(e.ouvert && e.resultat === 'plusieurs' && JSON.stringify(e.choix) === JSON.stringify(['paire:n:230', 'paire:n:B230']) && !e.fiche && !e.auto, 'D : « 230 » ⇒ 230 et B230 proposées (remise à zéro du 11 oct.), aucune ouverte', JSON.stringify(e));
      await communs(pg, 'D'); await shot(pg, '1-choix');
    });

    // E — la rafale : trois codes à la suite ⇒ trois lignes, la caméra reste ouverte.
    await scene('E', '390-clair', TEL, false, 'journee', async ({ pg }, shot) => {
      // La rafale est un réglage de CET appareil (`vrm_scan_rafale`) : posé avant d'ouvrir (sinon la 1re lecture s'ouvrirait
      // seule avant le toucher) ; le bouton le dit, et un toucher l'éteint puis le rallume.
      await pg.waitForSelector('[data-n-tete-scanner]', { timeout: 30000 });
      await pg.evaluate(() => localStorage.setItem('vrm_scan_rafale', '1'));
      await ouvrirScanner(pg, true);
      dit(await pg.getAttribute('[data-scan-u-rafale-bouton]', 'data-scan-u-rafale-bouton') === '1', 'E : le bouton Rafale dit « allumé »');
      const trois = await pg.waitForFunction(() => document.querySelectorAll('[data-scan-u-ligne]').length >= 3, null, { timeout: 45000 }).then(() => true, () => false);
      const e = await etat(pg);
      const attendu = ['vente:v:' + TX(5) + '|un', 'vente:v:' + TX(7) + '|un', 'achat:a:' + TX_ACHAT + '|un'].sort();
      dit(trois && JSON.stringify([...e.rafale].sort()) === JSON.stringify(attendu), 'E : suivi, n° de transaction, code de retrait (QR) ⇒ SA vente, SA vente, SON achat', JSON.stringify(e.rafale));
      dit(e.ouvert && e.camera === 'active' && !e.fiche && !e.auto, 'E : la caméra reste ouverte, rien ne s’ouvre seul', JSON.stringify({ o: e.ouvert, c: e.camera, f: e.fiche }));
      await communs(pg, 'E'); await shot(pg, '1-rafale');
      await pg.waitForTimeout(3000);
      const e2 = await etat(pg);
      dit(e2.rafale.length === 3, 'E : un code relu ne s’ajoute pas deux fois', JSON.stringify(e2.rafale));
    });
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    srv.close();
    console.log(ko ? `\nKO scanner-universel : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK scanner-universel : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
