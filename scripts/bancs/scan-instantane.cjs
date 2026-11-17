// Banc : LE SCANNER EN INSTANTANÉ (17 nov., lot scan-instantane) — src/ScannerColis.jsx (`creerLecteur`,
// `useLectureCamera`), src/lecteurCodes.worker.js, src/ScannerRetrouver.jsx, l'ouverture de la vente.
// Julien (iPhone) : « le scan marche pour les bordereaux, mais il est un peu long et il faut être vraiment très
// très proche… je veux que ce soit beaucoup plus rapide et fluide, un peu en instantané. Et après quand je vais
// voir la vente ça prend du temps, ça bug. »
//
// LA CAMÉRA est une vraie caméra de Chromium nourrie d'une vidéo Y4M PORTRAIT 1080×1920 (la forme d'un iPhone) :
// une étiquette blanche sur une table, son code GÉNÉRÉ (bwip-js) à la forme réelle — Code 128 Mondial Relay
// (le n° de côté à 26 chiffres), DataMatrix Chronopost (S10), QR Vinted Go / Mondial Relay (lien de suivi) —,
// échantillonné à la surface (un module = une fraction de pixel, comme un capteur), flou, bruit, lignes de texte
// autour. Chromium sous Linux n'a pas `BarcodeDetector` : l'app prend le même chemin que Safari sur iPhone.
// N° INVENTÉS (dépôt public), données de la forme réelle (reprises du banc scan-colis).
//
// MESURES (jugées sur data-* et sur des nombres, §6.4) :
//  N. NET : Code 128 26 chiffres de LA vente 9201 (module 2 px) ⇒ sa fiche ; temps du toucher « Scanner » à la
//     fiche, et de la caméra active à la fiche ;
//  O. OUVRIR : « Ouvrir la vente » ⇒ LA fiche de CETTE vente (son N°) à l'écran, puis remplie par sa ligne (le
//     récapitulatif, `data-fiche-depuis-ligne`), la ligne marquée dessous ; temps ; la fiche ne se rouvre pas (les
//     toucher rejoués) ; le fil de l'écran bloqué pendant (tâches longues) ;
//  D. DISTANCE : la même étiquette qui s'approche (14 tailles, de 0,8 à 3,5 px par module, 0,6 s chacune) — chaque
//     taille porte un n° DIFFÉRENT : le n° lu dit la PLUS PETITE taille lue (plus petit = de plus loin) ;
//     pour Code 128, DataMatrix et QR ;
//  V. VIDE : une étiquette sans code pendant 4 s : images analysées par seconde et fil de l'écran bloqué.
//  PARTOUT : la fiche est celle de l'identité EXACTE (jamais une voisine), aucune erreur, aucune image envoyée.
// SEUILS (rouges sur main, voir docs/passation/2026-11-17-scan-instantane.md) : SCAN_SEUILS=0 pour mesurer seulement.
// Le temps se juge sur une machine qui respire (charge par cœur ≤ 1,5), sinon il est DIT (⚠️), pas jugé.
// Modules : bwip-js et @zxing/library@0.20.0 (le lecteur d'avant, servi à l'adresse que la CSP autorise) :
//   npm i --prefix <dossier> bwip-js @zxing/library@0.20.0, puis BANC_MODULES=<dossier>/node_modules
// Lancer : construire dist/, puis node scripts/bancs/scan-instantane.cjs   (BANC_PORT, SHOTS, BANC_DIST, SCAN_SCENES=NODV)
'use strict';
const path = require('path');
const fs = require('fs'), http = require('http'), os = require('os'), zlib = require('zlib');
let PW;
try { PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright')); }
catch (_) { PW = require('playwright'); }
const { lancer } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4733);
const SHOTS = process.env.SHOTS || '';
const SCENES = process.env.SCAN_SCENES || 'NODV';
const JUGER = process.env.SCAN_SEUILS !== '0';
const MS = Date.now(), J = 864e5;
const iso = (t) => new Date(t).toISOString();

// LES SEUILS. Avant (main, 17 nov.) → après : voir le récit. Chacun est rouge sur main.
const SEUIL = {
  netMs: 900,           // toucher « Scanner » ⇒ fiche, code net
  ouvrirMs: 300,        // « Ouvrir la vente » ⇒ la fiche de la vente à l'écran
  ouvrirBloqueMs: 150,  // le plus long blocage du fil de l'écran pendant l'ouverture
  module128: 1.4,       // la plus petite taille lue (px par module) — Code 128 26 chiffres
  moduleDM: 1.6,        // DataMatrix
  moduleQR: 1.6,        // QR
  imagesSec: 8,         // images analysées par seconde (étiquette sans code)
  bloqueParSec: 120,    // ms de fil bloqué par seconde de lecture (somme des tâches > 50 ms, au-delà de 50 ms)
};

let ko = 0, ok = 0; const mesures = {};
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d !== undefined && !c ? ' — ' + d : '')); };
const CHARGE = () => os.loadavg()[0] / Math.max(1, os.cpus().length);
const juge = (c, m, d) => {
  console.log(`     ${m} : ${d}`);
  if (!JUGER) return;
  const ch = CHARGE();
  if (!c && ch > 1.5) { console.log(`  ⚠️  ${m} — non jugé : machine chargée (${ch.toFixed(1)} par cœur)`); return; }
  dit(c, m, d);
};
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 240)); } };

// ── Les modules du banc ──────────────────────────────────────────────────────
const chercher = (nom) => {
  for (const base of [path.join(__dirname, '..', '..'), process.env.BANC_MODULES ? path.dirname(process.env.BANC_MODULES) : null].filter(Boolean)) {
    try { return require.resolve(nom, { paths: [base] }); } catch (_) {}
  }
  return null;
};
const BWIP = chercher('bwip-js');
const ZXING = (() => { const p = chercher('@zxing/library/package.json'); return p ? path.join(path.dirname(p), 'umd', 'index.min.js') : null; })();
if (!BWIP || !ZXING || !fs.existsSync(ZXING)) {
  console.log('❌ modules du banc absents : ' + [!BWIP && 'bwip-js', !ZXING && '@zxing/library@0.20.0'].filter(Boolean).join(', '));
  console.log('   npm i --prefix <dossier> bwip-js @zxing/library@0.20.0, puis BANC_MODULES=<dossier>/node_modules');
  process.exit(1);
}
const bwipjs = require(BWIP);
const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js';

// ── Les n° (INVENTÉS, à la forme exacte) ─────────────────────────────────────
const cleS10 = (huit) => { const p = [8, 6, 4, 2, 3, 5, 9, 7]; let t = 0; for (let i = 0; i < 8; i++) t += Number(huit[i]) * p[i]; const c = 11 - (t % 11); return c === 10 ? 0 : c === 11 ? 5 : c; };
const s10 = (pre, huit, pays) => `${pre}${huit}${cleS10(huit)}${pays}`;
const MR_A = '41235813', MR_VOISIN = '41235814';
const cote26 = (huit) => '56' + huit + '0101' + '402623166859';   // le n° de côté Mondial Relay (26 chiffres)
const qrMr = (huit) => `https://www.mondialrelay.com/public/permanent/tracking.aspx?ens=MRVINTED&exp=${huit}&language=FR&CodePostal=35260`;
// La distance : 14 tailles (px par module), de loin à près ; chaque taille a SON n°.
const TAILLES = [0.8, 0.9, 1.0, 1.12, 1.25, 1.4, 1.57, 1.76, 1.97, 2.2, 2.47, 2.77, 3.1, 3.5];
const huitDe = (i) => String(60000000 + i * 1111);
const SWEEPS = {
  '128': { bcid: 'code128', texte: (i) => cote26(huitDe(i)), lu: (s) => { const m = /^6\d{7}$/.exec(s); return m ? TAILLES.findIndex((_, i) => huitDe(i) === s) : -1; } },
  DM: { bcid: 'datamatrix', texte: (i) => s10('XW', huitDe(i), 'TS'), lu: (s) => TAILLES.findIndex((_, i) => s10('XW', huitDe(i), 'TS') === s) },
  QR: { bcid: 'qrcode', texte: (i) => qrMr(huitDe(i)), lu: (s) => TAILLES.findIndex((_, i) => huitDe(i) === s) },
};

// ── Les données (INVENTÉES, forme réelle : banc scan-colis) ──────────────────
const TITRE = 'Nike Air Max 90 blanche';
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const vente = (id, k, aExp) => ({ transaction_id: id, title: TITRE, size_title: '42', user_login: `acheteur_${k}`, price: { amount: '50', currency_code: 'EUR' },
  status: aExp ? 'Le paiement a été validé' : 'Colis livré', transaction_user_status: aExp ? 'needs_action' : 'completed', date: iso(MS - J - k * 60000), photo: { url: url(k) } });
// Une liste de ventes longue (la vraie forme d'un compte actif) : 6 au même titre, puis 140 autres.
const VENTES = [vente(9201, 1, true), vente(9202, 2, true), vente(9203, 3, true), vente(9204, 4, true), vente(9205, 5, true), vente(9206, 6, false)];
for (let k = 0; k < 140; k++) VENTES.push({ ...vente(9400 + k, 7 + (k % 30), false), title: `Paire ${k} ${['Adidas Samba', 'New Balance 530', 'Asics Gel'][k % 3]}`, date: iso(MS - (2 + k) * J) });
const SUIVI = { 9201: MR_A, 9202: MR_VOISIN, 9203: s10('XW', '20262031', 'TS'), 9204: s10('XW', '20262040', 'TS'), 9205: s10('XW', '20262032', 'TS') };
const NUMS = Object.fromEntries(VENTES.map((v, k) => [String(v.transaction_id), { numero: String(31 + k) }]));
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const bord = (tx) => ({ id: 'email_bord_' + tx, data: { transaction: String(tx), uid: '111', filename: 'bordereau-' + tx + '.pdf', modele: TITRE, article: TITRE, receivedAt: iso(MS - 3600000), pdfB64: PDF_B64, suivi: SUIVI[tx] } });
const LIGNES = [
  ...Object.keys(SUIVI).map((tx) => bord(tx)),
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS), payload: { my_orders: [] } } },
];

// ── Une étiquette ⇒ une vidéo Y4M portrait (la « caméra ») ────────────────────
function lirePng(buf) {
  let p = 8, w = 0, h = 0, bd = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const n = buf.readUInt32BE(p), t = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; }
    else if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break;
    p += 12 + n;
  }
  if (bd !== 8) throw new Error('PNG profondeur ' + bd);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct]; if (!ch) throw new Error('PNG type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)), ligne = w * ch, out = new Uint8Array(w * h), prec = Buffer.alloc(ligne), cour = Buffer.alloc(ligne);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (ligne + 1)], src = raw.subarray(y * (ligne + 1) + 1, (y + 1) * (ligne + 1));
    for (let i = 0; i < ligne; i++) {
      const a = i >= ch ? cour[i - ch] : 0, b = prec[i], c = i >= ch ? prec[i - ch] : 0;
      let v = src[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cour[i] = v & 255;
    }
    for (let x = 0; x < w; x++) { const o = x * ch; let g = ch >= 3 ? Math.round(0.299 * cour[o] + 0.587 * cour[o + 1] + 0.114 * cour[o + 2]) : cour[o]; if (ch === 4 || ch === 2) { const al = cour[o + ch - 1] / 255; g = Math.round(g * al + 255 * (1 - al)); } out[y * w + x] = g; }
    cour.copy(prec);
  }
  return { w, h, gris: out };
}
// La grille des modules (1 = noir) : un code 1D est une rangée de modules, haute de `haut` modules.
async function grille(bcid, texte) {
  const im = lirePng(await bwipjs.toBuffer({ bcid, text: texte, scale: 1, ...(bcid === 'code128' ? { height: 4 } : {}), includetext: false, paddingwidth: 0, paddingheight: 0 }));
  if (bcid === 'code128') { const l = im.w, h = Math.round(l * 0.2); const g = new Uint8Array(l * h); for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) g[y * l + x] = im.gris[x] < 128 ? 1 : 0; return { w: l, h, g, calme: 12 }; }
  const g = new Uint8Array(im.w * im.h); for (let i = 0; i < g.length; i++) g[i] = im.gris[i] < 128 ? 1 : 0; return { w: im.w, h: im.h, g, calme: 4 };
}
const W = 1080, H = 1920;
let graine = 7; const alea = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff; };
// Une image : la table, l'étiquette, le code (couverture de surface ⇒ gris), du « texte », flou, bruit.
function image(G, m, { flou = 0.6, bruit = 5 } = {}) {
  const Y = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) Y[y * W + x] = 78 + 30 * (y / H) + 10 * Math.sin(x / 170);
  const cw = G.w * m, chh = G.h * m, marge = G.calme * m;
  const lw = Math.max(cw + 2 * marge, cw * 1.25), lh = chh + 2 * marge + chh * 1.3;
  const lx = (W - lw) / 2, ly = (H - lh) / 2;
  for (let y = Math.max(0, Math.floor(ly)); y < Math.min(H, ly + lh); y++) for (let x = Math.max(0, Math.floor(lx)); x < Math.min(W, lx + lw); x++) Y[y * W + x] = 236;
  // Des lignes de « texte » sur l'étiquette (au-dessus et au-dessous du code), comme sur un vrai bordereau.
  const cx0 = (W - cw) / 2, cy0 = (H - chh) / 2;
  for (const [ty, n] of [[ly + marge * 0.4, 3], [cy0 + chh + marge * 0.6, 2]]) {
    for (let r = 0; r < n; r++) {
      const yy = Math.round(ty + r * Math.max(3, chh * 0.18)), hh = Math.max(1, Math.round(chh * 0.08));
      let x = lx + marge * 0.6; while (x < lx + lw - marge * 0.6) { const ll = Math.min((3 + alea() * 9) * Math.max(1, m), lx + lw - marge * 0.6 - x); for (let y = yy; y < yy + hh && y < H; y++) for (let xx = Math.round(x); xx < Math.min(W, x + ll); xx++) if (y >= 0 && xx >= 0) Y[y * W + xx] = 40; x += ll + 2 * Math.max(1, m); }
    }
  }
  // Le code : chaque pixel prend la part de NOIR qu'il couvre (un capteur moyenne la surface).
  const NOIR = 28, BLANC = 236;
  for (let py = Math.floor(cy0); py < Math.ceil(cy0 + chh); py++) {
    const v0 = (py - cy0) / m, v1 = (py + 1 - cy0) / m;
    for (let px = Math.floor(cx0); px < Math.ceil(cx0 + cw); px++) {
      const u0 = (px - cx0) / m, u1 = (px + 1 - cx0) / m;
      let noir = 0, aire = 0;
      for (let gy = Math.max(0, Math.floor(v0)); gy < Math.min(G.h, Math.ceil(v1)); gy++) {
        const oy = Math.min(v1, gy + 1) - Math.max(v0, gy); if (oy <= 0) continue;
        for (let gx = Math.max(0, Math.floor(u0)); gx < Math.min(G.w, Math.ceil(u1)); gx++) {
          const ox = Math.min(u1, gx + 1) - Math.max(u0, gx); if (ox <= 0) continue;
          aire += ox * oy; if (G.g[gy * G.w + gx]) noir += ox * oy;
        }
      }
      const tot = (u1 - u0) * (v1 - v0);   // la part hors du code est blanche (l'étiquette)
      if (py >= 0 && py < H && px >= 0 && px < W) Y[py * W + px] = BLANC - (BLANC - NOIR) * (noir / tot);
      void aire;
    }
  }
  // Flou gaussien σ (séparable) sur la zone de l'étiquette, puis bruit du capteur.
  if (flou > 0) {
    const r = Math.ceil(3 * flou), k = []; let sk = 0; for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * flou * flou)); k.push(v); sk += v; }
    for (let i = 0; i < k.length; i++) k[i] /= sk;
    const x0 = Math.max(r, Math.floor(lx) - 8), x1 = Math.min(W - r, Math.ceil(lx + lw) + 8), y0 = Math.max(r, Math.floor(ly) - 8), y1 = Math.min(H - r, Math.ceil(ly + lh) + 8);
    const tmp = Float32Array.from(Y);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { let s = 0; for (let i = -r; i <= r; i++) s += Y[y * W + x + i] * k[i + r]; tmp[y * W + x] = s; }
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { let s = 0; for (let i = -r; i <= r; i++) s += tmp[(y + i) * W + x] * k[i + r]; Y[y * W + x] = s; }
  }
  const out = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) out[i] = Math.max(0, Math.min(255, Math.round(Y[i] + (alea() - 0.5) * 2 * bruit)));
  return out;
}
const UV = Buffer.alloc((W / 2) * (H / 2), 128);
function ecrireY4m(fichier, images, fps) {
  const fd = fs.openSync(fichier, 'w');
  fs.writeSync(fd, Buffer.from(`YUV4MPEG2 W${W} H${H} F${fps}:1 Ip A1:1 C420jpeg\n`));
  for (const [Y, n] of images) for (let k = 0; k < n; k++) { fs.writeSync(fd, Buffer.from('FRAME\n')); fs.writeSync(fd, Y); fs.writeSync(fd, UV); fs.writeSync(fd, UV); }
  fs.closeSync(fd);
}
async function videoNet(fichier) { const G = await grille('code128', cote26(MR_A)); ecrireY4m(fichier, [[image(G, 2.0), 6]], 10); }
async function videoVide(fichier) { const G = { w: 120, h: 24, g: new Uint8Array(120 * 24), calme: 12 }; ecrireY4m(fichier, [[image(G, 2.0), 6]], 30); }
async function videoDistance(cle, fichier) {
  const S = SWEEPS[cle]; const imgs = [];
  for (let i = 0; i < TAILLES.length; i++) imgs.push([image(await grille(S.bcid, S.texte(i)), TAILLES[i], { flou: 0.45 + 0.1 * TAILLES[i] }), 6]);
  ecrireY4m(fichier, imgs, 10);
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
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#e2e4e8"/><text x="200" y="220" font-size="90" text-anchor="middle" fill="rgba(0,0,0,.35)" font-family="sans-serif">${k}</text></svg>`;

async function ouvrir(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.grantPermissions(['camera'], { origin: `http://localhost:${PORT}` }).catch(() => {});
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const envois = [], lourdes = [];
  pg.on('request', (q) => {
    const d = q.postData() || ''; if (/data:image|image\/(jpeg|png|webp)|\bblob:/i.test(d) || /multipart\/form-data/i.test(q.headers()['content-type'] || '')) envois.push(q.url());
    const u = decodeURIComponent(q.url()); if (/\/rest\/v1\/app_data/.test(u) && /[?&]select=(\*|data)(&|,updated|$)/.test(u) && /email_bord|orders_sold|id=like/.test(u)) lourdes.push(u.slice(0, 160));
  });
  await pg.addInitScript(({ sombre: s, nums }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
      if (!sessionStorage.getItem('banc_init')) { sessionStorage.setItem('banc_init', '1'); localStorage.setItem('vinted_sale_overrides', JSON.stringify(nums)); }
    } catch (_) {}
    // Les mesures : images lues (getImageData sur une image de caméra), tâches longues du fil de l'écran.
    window.__images = 0; window.__longues = [];
    const gid = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...a) { if (a[2] >= 200 && a[3] >= 200) window.__images++; return gid.apply(this, a); };
    // Le lecteur hors du fil de l'écran : une image envoyée au worker = une image analysée.
    const pm = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (m, ...a) { if (m && m.bitmap) window.__images++; return pm.call(this, m, ...a); };
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longues.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
    window.__pistes = [];
    const md = navigator.mediaDevices;
    if (md && md.getUserMedia) { const g0 = md.getUserMedia.bind(md); md.getUserMedia = async (c) => { const st = await g0(c); window.__pistes.push(...st.getTracks()); return st; }; }
  }, { sombre: !!sombre, nums: NUMS });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (u === ZXING_URL) return r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(ZXING, 'utf8') });
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
  await pg.goto(`http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-scan-retrouver-bouton="ventes"]', { timeout: 30000 });
  await pg.waitForFunction(() => document.querySelectorAll('[data-tx-colis], .vrm-sale-row, [data-cc-carte]').length >= 2, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  return { ctx, pg, errs, envois, lourdes };
}

// Ouvre le scanner et mesure : toucher ⇒ caméra active ⇒ premier résultat (data-*).
const ouvrirEtLire = (pg, attendreMs = 20000) => pg.evaluate(async ({ att }) => {
  const t = { clic: performance.now(), active: null, res: null };
  const mo = new MutationObserver(() => {
    const s = document.querySelector('[data-scan-r]');
    if (s && t.active == null && s.getAttribute('data-scan-r-camera') === 'active') t.active = performance.now();
    const r = document.querySelector('[data-scan-r-resultat]');
    if (r && t.res == null && r.getAttribute('data-scan-r-resultat') !== 'attente') t.res = performance.now();
  });
  mo.observe(document.body, { subtree: true, childList: true, attributes: true });
  document.querySelector('[data-scan-retrouver-bouton="ventes"]').click();
  const fin = performance.now() + att;
  while (t.res == null && performance.now() < fin) await new Promise((ok) => setTimeout(ok, 20));
  mo.disconnect();
  const v = document.querySelector('[data-scan-r] video');
  return { total: t.res != null ? Math.round(t.res - t.clic) : null, lecture: t.active != null && t.res != null ? Math.round(t.res - t.active) : null, clic: t.clic,
    video: v ? `${v.videoWidth}×${v.videoHeight}` : '' };
}, { att: attendreMs });
const etat = (pg) => pg.evaluate(() => {
  const r = document.querySelector('[data-scan-r-resultat]'), f = document.querySelector('[data-scan-r-fiche]');
  const a = (q, k) => { const e = document.querySelector(q); return e ? e.getAttribute(k) : null; };
  return { resultat: r ? r.getAttribute('data-scan-r-resultat') : '', fiche: f ? f.getAttribute('data-scan-r-fiche') : null, suivi: a('[data-scan-r-suivi]', 'data-scan-r-suivi') || a('[data-scan-r-lu]', 'data-scan-r-lu'),
    camera: a('[data-scan-r]', 'data-scan-r-camera') };
});
const bloque = (L, de, a) => { const x = L.filter(([s, d]) => s + d > de && s < a); return { total: x.reduce((n, [, d]) => n + Math.max(0, d - 50), 0), max: x.reduce((n, [, d]) => Math.max(n, d), 0), n: x.length }; };

async function scene(lettre, fabriquer, fn) {
  if (!SCENES.includes(lettre)) return;
  const fichier = path.join(os.tmpdir(), `banc-scan-inst-${process.pid}-${lettre}.y4m`);
  await fabriquer(fichier);
  const args = ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${fichier}`];
  const b = await lancer(PW, { executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args });
  try {
    const o = await ouvrir(b, { width: 390, height: 844 }, false);
    await essaie(lettre, () => fn(o));
    dit(o.envois.length === 0, `${lettre} : aucune image envoyée`, o.envois.slice(0, 2).join(' '));
    dit(o.errs.length === 0, `${lettre} : aucune erreur d’app`, o.errs.join(' | ').slice(0, 300));
    await o.ctx.close();
  } finally { await b.close(); try { fs.unlinkSync(fichier); } catch (_) {} }
}
const shot = async (pg, q) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `scan-instantane-${q}.png`) }); };

(async () => {
  // SCAN_PGM=cle:px:fichier.pgm — écrit seulement UNE image (pour la regarder ou la décoder ailleurs).
  if (process.env.SCAN_PGM) { const [c, px, f] = process.env.SCAN_PGM.split(':'); const S = SWEEPS[c]; const Y = image(await grille(S.bcid, S.texte(0)), Number(px), { flou: 0.45 + 0.1 * Number(px) }); fs.writeFileSync(f, Buffer.concat([Buffer.from(`P5 ${W} ${H} 255\n`), Y])); srv.close(); return; }
  try {
    if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/ absent : npm run build');
    console.log(`— Scanner en instantané (390 tactile, caméra portrait ${W}×${H}) · charge ${CHARGE().toFixed(1)} par cœur`);
    // N + O — le code net de LA vente, puis « Ouvrir la vente ».
    await scene('N', videoNet, async ({ pg, lourdes }) => {
      const m = await ouvrirEtLire(pg);
      const e = await etat(pg);
      mesures.net = m;
      dit(e.resultat === 'un' && e.fiche === 'vente:v:9201', 'N : Code 128 26 chiffres ⇒ la fiche de LA vente de ce n° (pas la voisine au même titre)', JSON.stringify({ e, m }));
      juge(m.total != null && m.total <= SEUIL.netMs, `N : toucher « Scanner » ⇒ fiche ≤ ${SEUIL.netMs} ms`, `${m.total} ms (caméra active ⇒ fiche : ${m.lecture} ms ; vidéo ${m.video})`);
      await pg.waitForTimeout(300); await shot(pg, '1-fiche');
      if (!SCENES.includes('O')) return;
      const n0 = lourdes.length;
      const o = await pg.evaluate(async () => {
        let ouvertures = 0; const f = () => { ouvertures++; }; window.addEventListener('vrm:fiche-ligne', f);
        const t0 = performance.now();
        document.querySelector('[data-scan-r-ouvrir="vente:v:9201"]').click();
        let fiche = null, remplie = null, marque = null, parti = null;
        const vis = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden'; };
        while (performance.now() - t0 < 9000) {
          const n = performance.now();
          if (parti == null && !document.querySelector('[data-scan-r]')) parti = n;
          const fp = document.querySelector('[data-fiche-paire]');
          if (fiche == null && parti != null && vis(fp) && fp.getAttribute('data-fiche-paire') === '31') fiche = n;
          if (remplie == null && fp && fp.querySelector('[data-fiche-depuis-ligne]')) remplie = n;
          if (marque == null && document.querySelector('[data-cible-notif="vente"]:is([data-tx="9201"], [data-cible~="vente:9201"])')) marque = n;
          if (fiche != null && remplie != null && marque != null) break;
          await new Promise((ok) => requestAnimationFrame(() => ok()));
        }
        // Les toucher rejoués (0,7 · 1,6 · 3 s) : la fiche ne doit plus se rouvrir.
        await new Promise((ok) => setTimeout(ok, 3600));
        window.removeEventListener('vrm:fiche-ligne', f);
        const d = (x) => (x != null ? Math.round(x - t0) : null);
        const fp = document.querySelector('[data-fiche-paire]');
        return { t0, fiche: d(fiche), remplie: d(remplie), marque: d(marque), parti: d(parti), ouvertures, encore: !!(fp && fp.getClientRects().length && fp.getAttribute('data-fiche-paire') === '31' && fp.querySelector('[data-fiche-depuis-ligne]')) };
      });
      const L = await pg.evaluate(() => window.__longues);
      const bl = bloque(L, o.t0, o.t0 + 1500);
      mesures.ouvrir = { ...o, t0: undefined, bloque: bl, longues: L.filter(([st, du]) => st + du > o.t0 && st < o.t0 + 1500).map(([st, du]) => [Math.round(st - o.t0), du]) };
      dit(o.fiche != null && o.remplie != null && o.marque != null && o.encore, 'O : « Ouvrir la vente » ⇒ LA fiche de CETTE vente (N° 31), remplie par sa ligne, la ligne marquée dessous', JSON.stringify(o));
      juge(o.fiche != null && o.fiche <= SEUIL.ouvrirMs, `O : la fiche de la vente à l’écran ≤ ${SEUIL.ouvrirMs} ms`, `${o.fiche} ms (remplie : ${o.remplie} ms ; ligne marquée : ${o.marque} ms)`);
      juge(o.ouvertures <= 2, 'O : la fiche ne se rouvre pas (au plus : ouverte, puis devenue celle de la ligne)', `${o.ouvertures} ouverture(s) en 3,6 s`);
      juge(bl.max <= SEUIL.ouvrirBloqueMs, `O : le plus long blocage de l’écran pendant l’ouverture ≤ ${SEUIL.ouvrirBloqueMs} ms`, `${bl.max} ms (${bl.n} tâches longues, ${bl.total} ms au-delà de 50 ms)`);
      dit(lourdes.length === n0, 'O : aucune lecture lourde (select=data sur ventes ou bordereaux) en ouvrant', lourdes.slice(n0, n0 + 2).join(' '));
      await shot(pg, '2-vente-ouverte');
    });
    // D — la distance, pour chaque forme de code.
    for (const [cle, seuil] of [['128', SEUIL.module128], ['DM', SEUIL.moduleDM], ['QR', SEUIL.moduleQR]]) {
      await scene('D', (f) => videoDistance(cle, f), async ({ pg }) => {
        const m = await ouvrirEtLire(pg, 30000);
        const e = await etat(pg);
        const i = e.suivi ? SWEEPS[cle].lu(e.suivi) : -1;
        const px = i >= 0 ? TAILLES[i] : null;
        mesures['distance' + cle] = { px, ms: m.lecture, suivi: e.suivi };
        dit(e.resultat === 'aucun' && i >= 0, `D ${cle} : un n° de la vidéo lu, jamais une vente (aucun de ces n° n’est dans VRM)`, JSON.stringify({ e, m }));
        juge(px != null && px <= seuil, `D ${cle} : lu dès ${seuil} px par module (de plus loin)`, `${px} px par module (caméra active ⇒ lu : ${m.lecture} ms)`);
        if (cle === '128') await shot(pg, '3-distance');
      });
    }
    // V — l'étiquette sans code : le rythme de lecture et l'écran.
    await scene('V', videoVide, async ({ pg }) => {
      await pg.evaluate(() => document.querySelector('[data-scan-retrouver-bouton="ventes"]').click());
      await pg.waitForSelector('[data-scan-r][data-scan-r-camera="active"]', { timeout: 20000 });
      await pg.waitForTimeout(1500);
      const r = await pg.evaluate(async () => { const i0 = window.__images, t0 = performance.now(); await new Promise((ok) => setTimeout(ok, 4000)); return { n: window.__images - i0, t0, t1: performance.now() }; });
      const L = await pg.evaluate(() => window.__longues);
      const bl = bloque(L, r.t0, r.t1); const s = (r.t1 - r.t0) / 1000;
      const ips = Math.round((r.n / s) * 10) / 10, bps = Math.round(bl.total / s);
      mesures.vide = { ips, bloqueParSec: bps, max: bl.max };
      juge(ips >= SEUIL.imagesSec, `V : images analysées par seconde ≥ ${SEUIL.imagesSec}`, `${ips} /s`);
      juge(bps <= SEUIL.bloqueParSec, `V : fil de l’écran bloqué ≤ ${SEUIL.bloqueParSec} ms par seconde`, `${bps} ms/s (plus longue tâche ${bl.max} ms)`);
      const e = await etat(pg);
      dit(!e.resultat && e.camera === 'active', 'V : sans code, aucune fiche, la caméra continue', JSON.stringify(e));
      await shot(pg, '4-vise');
    });
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    srv.close();
    console.log('\nMESURES ' + JSON.stringify(mesures));
    console.log(ko ? `\nKO scan-instantane : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK scan-instantane : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
