require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « SCANNER UN BORDEREAU DE VENTE » (17 nov., lot scan-bordereau-vente) — src/etiquettesScan.js,
//  src/ScannerRetrouver.jsx. Julien (17 nov., en production) : « le scanner de bordereau ne marche pas, faut
//  retrouver l'article qu'il y a à l'intérieur » — il venait d'imprimer un bordereau de VENTE Vinted et de le scanner.
//
//  Le harnais de scripts/bancs/scan-colis.cjs : une VRAIE caméra de Chromium nourrie d'une image (chaque code est
//  GÉNÉRÉ par bwip-js, lu par le lecteur de l'app, ZXing 0.20.0), et la douchette (une rafale de touches + Entrée).
//  Les ÉTIQUETTES sont des PDF GÉNÉRÉS (pdf-lib), de la forme MESURÉE sur son bordereau Mondial Relay du 16 nov.
//  (lecture seule, rien recopié) : trois fois un grand Code 128 « lettre + 19 chiffres » imprimé en clair par
//  groupes (« H 100452 0249… »), qui ne porte PAS le n° de suivi, et un Code 128 de 26 chiffres « 55… » dont les
//  chiffres 3 à 10 sont le n° de l'e-mail. Contenus INVENTÉS. Chronopost : le S10 ; Vinted Go : « VGS… ».
//  Exige (data-* seulement) :
//   A  le GRAND code d'une étiquette Mondial Relay/InPost (caméra) ⇒ LA vente de CETTE étiquette (50 ventes au même
//      titre, toutes avec leur étiquette) : photo, titre, N°, taille ;
//   B  le même grand code sur une étiquette CAPTÉE par l'extension (aucun n° de suivi rangé) ⇒ sa vente ;
//   C  le code 26 chiffres « 55… » ⇒ sa vente (par son n° de suivi) ;
//   D  Chronopost (S10, DataMatrix) et Vinted Go (VGS…) ⇒ leur vente ;
//   E  la DOUCHETTE (rafale + Entrée sur Ventes) avec le grand code ⇒ le scanner s'ouvre sur LA vente ;
//   F  un code inconnu (sur aucune étiquette) tapé ⇒ « Code pas reconnu », le code lu, ce qu'il faut faire.
//  Partout : cibles ≥ 44 px, rien ne déborde, aucune erreur. Vue : 390 tactile, clair et sombre.
//  Lancer : BANC_DIST=<dist> BANC_MODULES=<dossier>/node_modules node scripts/bancs/scan-bordereau-vente.cjs
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs'), http = require('http'), os = require('os'), zlib = require('zlib');
let PW;
try { PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright')); }
catch (_) { PW = require('playwright'); }
const { lancer } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4719);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.SCAN_VUES ? process.env.SCAN_VUES.split(',') : null;
const MS = Date.now(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const jourDans = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d !== undefined && !c ? ' — ' + d : '')); };
// Le temps de lecture (< 1 s) se juge sur une machine qui respire : la charge par cœur au-delà de 1,5 (bancs
// d'autres sessions en parallèle) rend la mesure fausse — elle est alors DITE (⚠️), pas jugée. Le reste est jugé.
const CHARGE = () => os.loadavg()[0] / Math.max(1, os.cpus().length);
const ditTemps = (c, m, d) => { const ch = CHARGE(); if (!c && ch > 1.5) { console.log(`  ⚠️  ${m} — non jugé : machine chargée (${ch.toFixed(1)} par cœur) — ${d}`); return; } dit(c, m, d); if (c) console.log(`     (${d})`); };
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

// ── Les n° et les étiquettes (INVENTÉS, à la forme mesurée) ─────────────────
const cleS10 = (huit) => { const p = [8, 6, 4, 2, 3, 5, 9, 7]; let t = 0; for (let i = 0; i < 8; i++) t += Number(huit[i]) * p[i]; const c = 11 - (t % 11); return c === 10 ? 0 : c === 11 ? 5 : c; };
const s10 = (pre, huit, pays) => `${pre}${huit}${cleS10(huit)}${pays}`;
const N = 50;
const MR = (k) => String(46000000 + k * 13);                     // n° Mondial Relay (8 chiffres)
const GRAND = (k) => 'H' + String(100000 + k) + String(20000000 + k * 7) + '02' + String(700 + k);   // lettre + 19 chiffres
const groupes = (g) => `${g[0]} ${g.slice(1, 7)} ${g.slice(7, 15)} ${g.slice(15, 17)} ${g.slice(17)}`;
const LONG = (k) => '55' + MR(k) + '0' + String(k).padStart(2, '0') + '9' + '000000123456';
const S10_C = s10('XW', '30303031', 'TS'), VGS = 'VGS' + '4712345678901';
const TX_C = 9301, TX_V = 9302, TX_X = 9303;
const INCONNU = 'H9998887776665554443';
const CODES = {
  A: { bcid: 'code128', text: GRAND(23), l: 1 },
  B: { bcid: 'code128', text: GRAND(49), l: 1 },
  C: { bcid: 'code128', text: LONG(7), l: 1 },
  D: { bcid: 'datamatrix', text: S10_C, l: 2 },
  V: { bcid: 'code128', text: VGS, l: 1 },
};
const TITRE = 'Nike Dunk Low panda';
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const vente = (id, k, titre = TITRE) => ({ transaction_id: id, title: titre, size_title: String(36 + (k % 10)), user_login: `acheteur_${k}`, price: { amount: '50', currency_code: 'EUR' },
  status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: iso(MS - J - k * 60000), photo: { url: url(k + 1) } });
const VENTES = [...Array.from({ length: N }, (_, k) => vente(9200 + k, k)), vente(TX_C, 60, 'Adidas Samba noire'), vente(TX_V, 61, 'New Balance 530 grise'), vente(TX_X, 62, 'Asics Gel 1130')];
const NUMS = Object.fromEntries(VENTES.map((v, k) => [String(v.transaction_id), { numero: String(101 + k) }]));
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: iso(MS) }];
// L'étiquette PDF (pdf-lib) : le texte en clair sous chaque code, comme l'étiquette mesurée.
let PDF = null;
async function etiquette(lignes) {
  if (!PDF) PDF = require(path.join(__dirname, '..', '..', 'node_modules', 'pdf-lib'));
  const doc = await PDF.PDFDocument.create(); const page = doc.addPage([425, 283]);
  const f = await doc.embedFont(PDF.StandardFonts.Helvetica);
  lignes.forEach((t, i) => page.drawText(t, { x: 20, y: 250 - i * 22, size: 11, font: f }));
  page.drawText('Adresse de livraison inventée, 35260 Cancale', { x: 20, y: 40, size: 9, font: f });
  return Buffer.from(await doc.save()).toString('base64');
}
async function fabriquerLignes() {
  const L2 = [{ id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS), payload: { my_orders: VENTES } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS), payload: { my_orders: [] } } }];
  for (let k = 0; k < N; k++) {
    const tx = 9200 + k;
    const pdf = await etiquette([groupes(GRAND(k)), groupes(GRAND(k)), groupes(GRAND(k)), LONG(k), 'Mondial Relay']);
    // La vente 49 n'a qu'une étiquette CAPTÉE par l'extension (aucun n° de suivi rangé) ; les autres, l'e-mail.
    if (k === 49) L2.push({ id: `harvest_111_label_${tx}`, data: { tx: String(tx), uid: '111', item: String(tx), capturedAt: iso(MS - 3600e3), url: 'https://www.vinted.fr/x.pdf', _pdf: true, pdfB64: pdf } });
    else L2.push({ id: `email_bord_${tx}`, data: { transaction: String(tx), uid: '111', filename: `b-${tx}.pdf`, modele: TITRE, article: TITRE, receivedAt: iso(MS - 3600e3), suivi: MR(k), transporteur: 'mondialrelay', _pdf: true, pdfB64: pdf } });
  }
  L2.push({ id: `email_bord_${TX_C}`, data: { transaction: String(TX_C), uid: '111', filename: 'c.pdf', receivedAt: iso(MS - 3600e3), suivi: S10_C, transporteur: 'chronopost', _pdf: true, pdfB64: await etiquette(['Chronopost', S10_C]) } });
  L2.push({ id: `email_bord_${TX_V}`, data: { transaction: String(TX_V), uid: '111', filename: 'v.pdf', receivedAt: iso(MS - 3600e3), suivi: VGS, transporteur: 'vinted', _pdf: true, pdfB64: await etiquette(['Vinted Go', VGS]) } });
  return L2;
}
let LIGNES = [];

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
async function videoDuCode(code, fichier) {
  const W = 1280, H = 720, Y = Buffer.alloc(W * H, 70);   // une table grise sous l'étiquette
  const ew = Math.round(W * 0.74), eh = Math.round(H * 0.56), ex = (W - ew) >> 1, ey = (H - eh) >> 1;
  for (let y = ey; y < ey + eh; y++) Y.fill(246, y * W + ex, y * W + ex + ew);
  // L'échelle ENTIÈRE la plus grande qui tient sur l'étiquette (un module = un nombre entier de pixels :
  // une mise à l'échelle fractionnaire « au plus proche » abîme un code 1D comme aucune caméra ne le fait).
  const opts = { bcid: code.bcid, text: code.text, ...(code.l === 1 ? { height: 18 } : {}), includetext: false, paddingwidth: 0, paddingheight: 0 };
  const un = lirePng(await bwipjs.toBuffer({ ...opts, scale: 1 }));
  const echelle = Math.max(1, Math.floor(Math.min((ew * 0.86) / un.w, (eh * 0.8) / un.h)));
  const im = lirePng(await bwipjs.toBuffer({ ...opts, scale: echelle }));
  const k = 1;
  const iw = Math.round(im.w * k), ih = Math.round(im.h * k), ix = (W - iw) >> 1, iy = (H - ih) >> 1;
  for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
    const g = im.gris[Math.min(im.h - 1, Math.floor(y / k)) * im.w + Math.min(im.w - 1, Math.floor(x / k))];
    Y[(iy + y) * W + ix + x] = g < 128 ? 22 : 246;
  }
  const UV = Buffer.alloc((W / 2) * (H / 2), 128);
  const tete = Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`);
  const image = Buffer.concat([Buffer.from('FRAME\n'), Y, UV, UV]);
  fs.writeFileSync(fichier, Buffer.concat([tete, image, image, image]));
}

// ── Le serveur de l'app et de la base ────────────────────────────────────────
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
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
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${TEINTES[k % 6]}"/><path d="M60 250 C80 190 150 175 190 200 C230 222 285 205 330 232 C352 246 346 282 306 284 L84 284 C62 284 52 268 60 250 Z" fill="rgba(30,34,40,.62)"/><path d="M60 284 L330 284 L326 300 L66 300 Z" fill="rgba(255,255,255,.85)"/><text x="200" y="120" font-size="90" text-anchor="middle" fill="rgba(0,0,0,.35)" font-family="sans-serif">${k}</text></svg>`;
const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js';

async function ouvrir(b, vp, sombre, debut, { refus = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  if (!refus) await ctx.grantPermissions(['camera'], { origin: `http://localhost:${PORT}` }).catch(() => {});
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const envois = [];
  pg.on('request', (q) => { const d = q.postData() || ''; if (/data:image|image\/(jpeg|png|webp)|\bblob:/i.test(d) || /multipart\/form-data/i.test(q.headers()['content-type'] || '')) envois.push(q.url()); });
  await pg.addInitScript(({ sombre: s, nums, refus: rf }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
      if (!sessionStorage.getItem('banc_init')) { sessionStorage.setItem('banc_init', '1'); localStorage.setItem('vinted_sale_overrides', JSON.stringify(nums)); }
    } catch (_) {}
    // Les pistes ouvertes (pour vérifier qu'elles sont coupées en sortant), et la caméra refusée (G).
    window.__pistes = [];
    const md = navigator.mediaDevices;
    if (md && md.getUserMedia) {
      const g0 = md.getUserMedia.bind(md);
      md.getUserMedia = async (c) => {
        if (rf) throw new DOMException('Permission refusée', 'NotAllowedError');
        const st = await g0(c); window.__pistes.push(...st.getTracks()); return st;
      };
    }
  }, { sombre: !!sombre, nums: NUMS, refus });
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
  await pg.goto(`http://localhost:${PORT}/?tab=${debut}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, envois };
}

// L'état du scanner, lu sur ses data-* seulement.
const etat = (pg) => pg.evaluate(() => {
  const s = document.querySelector('[data-scan-r]'); if (!s) return null;
  const r = document.querySelector('[data-scan-r-resultat]');
  const f = document.querySelector('[data-scan-r-fiche]');
  const img = f && f.querySelector('.vrm-rtv-photo img');
  const a = (q, k) => { const e = document.querySelector(q); return e ? e.getAttribute(k) : null; };
  return { camera: s.getAttribute('data-scan-r-camera'), resultat: r ? r.getAttribute('data-scan-r-resultat') : '', fiche: f ? f.getAttribute('data-scan-r-fiche') : null,
    num: f ? f.getAttribute('data-scan-r-num') : null, photo: img ? { src: img.getAttribute('src'), ok: img.complete && img.naturalWidth > 0 } : null,
    etat: a('[data-scan-r-bandeau]', 'data-scan-r-bandeau'), code: a('[data-scan-r-code]', 'data-scan-r-code'), lu: a('[data-scan-r-lu]', 'data-scan-r-lu'),
    choix: [...document.querySelectorAll('[data-scan-r-choix]')].map((e) => e.getAttribute('data-scan-r-choix')).sort(),
    transporteur: a('[data-scan-r-transporteur]', 'data-scan-r-transporteur'), suivi: a('[data-scan-r-suivi]', 'data-scan-r-suivi'), chercher: a('[data-scan-r-chercher]', 'data-scan-r-chercher'),
    indice: a('[data-scan-r-indice]', 'data-scan-r-indice'), sansCam: a('[data-scan-r-sans-camera]', 'data-scan-r-sans-camera'), ouvrir: a('[data-scan-r-ouvrir]', 'data-scan-r-ouvrir'),
    texte: (document.querySelector('[data-scan-r-message]') || {}).textContent || '', aide: (document.querySelector('.vrm-rtv-aide') || {}).textContent || '',
    focus: !!(document.activeElement && document.activeElement.hasAttribute('data-scan-r-saisie')) };
});
// Ouvre le scanner par le bouton de l'écran (ou le disque) et mesure : caméra active ⇒ résultat.
const ouvrirEtLire = (pg, ouvrirSel, attendre = true) => pg.evaluate(async ({ sel, att }) => {
  const t = { clic: performance.now(), active: null, res: null, att: null };
  const mo = new MutationObserver(() => {
    const s = document.querySelector('[data-scan-r]');
    if (s && t.active == null && s.getAttribute('data-scan-r-camera') === 'active') t.active = performance.now();
    const r = document.querySelector('[data-scan-r-resultat]');
    if (r && t.att == null && r.getAttribute('data-scan-r-resultat') === 'attente') t.att = performance.now();
    if (r && t.res == null && r.getAttribute('data-scan-r-resultat') !== 'attente') t.res = performance.now();
  });
  mo.observe(document.body, { subtree: true, childList: true, attributes: true });
  for (const q of sel) { const e = document.querySelector(q); if (!e) { mo.disconnect(); return { manque: q }; } e.click(); await new Promise((ok) => setTimeout(ok, 350)); }
  const fin = performance.now() + 45000;
  while (att && t.res == null && performance.now() < fin) await new Promise((ok) => setTimeout(ok, 40));
  mo.disconnect();
  return { lecture: t.active != null && t.res != null ? Math.round((t.att != null ? t.att : t.res) - t.active) : null, attente: t.att != null && t.res != null ? Math.round(t.res - t.att) : null, total: t.res != null ? Math.round(t.res - t.clic) : null };
}, { sel: ouvrirSel, att: attendre });
const cibles = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-scan-r] button, [data-scan-r] input')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
  .map((e) => ({ q: e.getAttribute('aria-label') || e.textContent.trim().slice(0, 24) || e.tagName, h: Math.round(e.getBoundingClientRect().height) })));
const deborde = (pg) => pg.evaluate(() => { const s = document.querySelector('[data-scan-r]'); const w = window.innerWidth;
  const hors = s ? [...s.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > w + 1 || r.left < -1) && !e.closest('.vrm-rtv-vue'); }).map((e) => String(e.className).slice(0, 30)) : [];
  return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, hors: hors.slice(0, 4) }; });

async function scene(nom, vp, sombre, lettre, fn, { refus = false, debut = 'ventes' } = {}) {
  if (process.env.SCAN_LETTRES && !process.env.SCAN_LETTRES.includes(lettre)) return;
  const fichier = path.join(os.tmpdir(), `banc-scan-${process.pid}-${lettre}.y4m`);
  if (!refus) await videoDuCode(CODES[lettre], fichier);
  const args = ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'];
  if (!refus) args.push('--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${fichier}`);
  const b = await lancer(PW, { executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args });
  const shot = async (pg, q) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `scan-bordereau-vente-${nom}-${q}.png`) }); };
  try {
    const o = await ouvrir(b, vp, sombre, debut, { refus });
    await essaie(`${nom} ${lettre}`, () => fn(o, shot));
    dit(o.envois.length === 0, `${nom} ${lettre} : aucune image envoyée`, o.envois.slice(0, 2).join(' '));
    dit(o.errs.length === 0, `${nom} ${lettre} : aucune erreur d’app`, o.errs.join(' | ').slice(0, 300));
    await o.ctx.close();
  } finally { await b.close(); try { fs.unlinkSync(fichier); } catch (_) {} }
}
// L'écran Ventes / Achats est lu (le bouton du scanner est là, et les lignes).
const pret = async (pg, ecran) => {
  await pg.waitForSelector(`[data-scan-retrouver-bouton="${ecran}"]`, { timeout: 30000 });
  await pg.waitForFunction(() => document.querySelectorAll('[data-tx-colis], .vrm-sale-row, .vrm-buy-row, [data-cc-carte]').length >= 2, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1500);
};
const communs = async (pg, nom, q) => {
  const c = await cibles(pg);
  dit(c.length > 0 && c.every((x) => x.h >= 44), `${nom} ${q} : cibles ≥ 44 px`, JSON.stringify(c.filter((x) => x.h < 44)));
  const d = await deborde(pg);
  dit(d.page <= 1 && !d.hors.length, `${nom} ${q} : rien ne déborde`, JSON.stringify(d));
};
const fermerEtCouper = async (pg, nom, q) => {
  await pg.click('[data-scan-r-fermer]').catch(() => {});
  await pg.waitForTimeout(500);
  const p = await pg.evaluate(() => ({ ouvert: !!document.querySelector('[data-scan-r]'), pistes: window.__pistes.map((t) => t.readyState) }));
  dit(!p.ouvert && p.pistes.length >= 1 && p.pistes.every((x) => x === 'ended'), `${nom} ${q} : fermé, la caméra coupée`, JSON.stringify(p));
};

async function vue(nom, vp, sombre) {
  console.log(`\n— Scanner un bordereau de vente · ${nom}`);
  const fiche = async (pg, attendu, q, lettre, shot) => {
    const e = await etat(pg);
    dit(e && e.resultat === 'un' && e.fiche === attendu, `${nom} ${lettre} : ${q} ⇒ LA vente ${attendu}`, JSON.stringify(e && { r: e.resultat, f: e.fiche, aide: e.aide, t: e.texte }));
    return e;
  };
  for (const [lettre, attendu, q] of [['A', 'vente:v:9223', 'le GRAND code Mondial Relay/InPost (lettre + 19 chiffres, pas le n° de suivi)'], ['B', 'vente:v:9249', 'le grand code d’une étiquette CAPTÉE par l’extension (aucun n° rangé)'], ['C', 'vente:v:9207', 'le code 26 chiffres « 55… »'], ['D', `vente:v:${TX_C}`, 'Chronopost (S10, DataMatrix)'], ['V', `vente:v:${TX_V}`, 'Vinted Go (VGS…)']]) {
    await scene(nom, vp, sombre, lettre, async ({ pg }, shot) => {
      await pret(pg, 'ventes');
      await ouvrirEtLire(pg, ['[data-scan-retrouver-bouton="ventes"]']);
      await pg.waitForFunction(() => { const r = document.querySelector('[data-scan-r-resultat]'); return r && r.getAttribute('data-scan-r-resultat') !== 'attente'; }, null, { timeout: 30000 }).catch(() => {});
      await pg.waitForTimeout(500);
      const e = await fiche(pg, attendu, q, lettre, shot);
      if (lettre === 'A') {
        dit(e && e.num === '124' && e.photo && /\/b24\//.test(e.photo.src), `${nom} A : la photo, le N° de rangement de CETTE paire`, JSON.stringify(e && { num: e.num, photo: e.photo }));
        const t = await pg.evaluate(() => ({ titre: (document.querySelector('[data-scan-r-titre]') || {}).textContent || '', sous: (document.querySelector('.vrm-rtv-fiche .vrm-rtv-sous') || {}).textContent || '', par: (document.querySelector('[data-scan-r-par]') || {}).getAttribute ? document.querySelector('[data-scan-r-par]').getAttribute('data-scan-r-par') : '' }));
        dit(/Nike Dunk Low panda/.test(t.titre) && /39/.test(t.sous) && t.par === 'etiquette', `${nom} A : le titre et la taille de la paire qui va dedans ; trouvée par SON étiquette`, JSON.stringify(t));
        await communs(pg, nom, 'A');
      }
      await shot(pg, `${lettre}-fiche`);
    });
  }
  // E — la douchette sur Ventes (une rafale de touches + Entrée) avec le grand code ⇒ la fiche.
  await scene(nom, vp, sombre, 'E', async ({ pg }, shot) => {
    await pret(pg, 'ventes');
    await pg.evaluate(() => { try { document.activeElement && document.activeElement.blur(); } catch (_) {} });
    await pg.keyboard.type(GRAND(11), { delay: 8 }); await pg.keyboard.press('Enter');
    await pg.waitForSelector('[data-scan-r-fiche]', { timeout: 30000 }).catch(() => {});
    await pg.waitForTimeout(600);
    await fiche(pg, 'vente:v:9211', 'la douchette (grand code)', 'E', shot);
    await shot(pg, 'E-douchette');
  }, { refus: true });
  // F — un code sur AUCUNE étiquette, tapé ⇒ ce qui a été lu, et quoi faire.
  await scene(nom, vp, sombre, 'F', async ({ pg }, shot) => {
    await pret(pg, 'ventes');
    await ouvrirEtLire(pg, ['[data-scan-retrouver-bouton="ventes"]'], false);
    await pg.waitForSelector('[data-scan-r-saisie]', { timeout: 8000 }).catch(() => {});
    await pg.fill('[data-scan-r-saisie]', INCONNU); await pg.click('[data-scan-r-ok]');
    await pg.waitForFunction(() => { const r = document.querySelector('[data-scan-r-resultat]'); return r && r.getAttribute('data-scan-r-resultat') !== 'attente'; }, null, { timeout: 40000 }).catch(() => {});
    await pg.waitForTimeout(400);
    const f = await pg.evaluate(() => ({ r: (document.querySelector('[data-scan-r-resultat]') || {}).getAttribute ? document.querySelector('[data-scan-r-resultat]').getAttribute('data-scan-r-resultat') : '', lu: (document.querySelector('[data-scan-b-code-lu]') || { getAttribute: () => '' }).getAttribute('data-scan-b-code-lu'), quoi: (document.querySelector('[data-scan-b-quoi-faire]') || { getAttribute: () => '' }).getAttribute('data-scan-b-quoi-faire'), fiche: !!document.querySelector('[data-scan-r-fiche]') }));
    dit(f.r === 'pasReconnu' && f.lu === INCONNU && f.quoi === 'cherche' && !f.fiche, `${nom} F : code sur aucune étiquette ⇒ « pas reconnu », le code lu, quoi faire ; aucune fiche`, JSON.stringify(f));
    await communs(pg, nom, 'F'); await shot(pg, 'F-inconnu');
  }, { refus: true });
}

(async () => {
  try {
    if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/ absent : npm run build');
    LIGNES = await fabriquerLignes();
    for (const [nom, vp, sombre] of [['390-clair', { width: 390, height: 844 }, false], ['390-sombre', { width: 390, height: 844 }, true]]) {
      if (VUES && !VUES.includes(nom)) continue;
      await vue(nom, vp, sombre);
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    srv.close();
    console.log(ko ? `\nKO scan-bordereau-vente : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK scan-bordereau-vente : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
