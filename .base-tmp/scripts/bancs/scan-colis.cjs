// Banc : SCANNER POUR RETROUVER (15 nov.) — src/ScannerRetrouver.jsx, src/scanColis.js
// Julien : « tu scannes le code-barres d'un colis reçu ou d'un bordereau, et VRM ouvre directement
// la bonne vente ou le bon achat, grâce au numéro de suivi. Zéro recherche. »
//
// La caméra est une VRAIE caméra de Chromium nourrie d'une image : chaque code-barres est GÉNÉRÉ
// (bwip-js : Code 128, DataMatrix, QR, EAN-13), posé sur une étiquette blanche, écrit en vidéo
// Y4M et donné au navigateur (`--use-fake-device-for-media-stream`, `--use-file-for-fake-video-capture`).
// L'app le lit avec SON lecteur (ZXing 0.20.0, servi en local à l'adresse que la CSP autorise) :
// rien n'est simulé entre l'image et la règle. Contenus INVENTÉS, à la forme exacte (dépôt public).
// Données INVENTÉES de la forme réelle (ventes `orders_sold`, bordereaux `email_bord_{tx}` champ
// `suivi`, achats `orders_purchased`, e-mail de suivi `email_track_*` relié par `transaction`,
// bordereau de retour `email_bordretour_{tx}` lu en `meta->>`).
// Exige (jugé sur data-*, §6.4) :
//  A. Code 128 « 56… » (26 chiffres Mondial Relay) ⇒ la fiche de LA vente de ce n° (6 ventes au MÊME
//     titre, n° voisins) : photo, N°, état « À expédier · bordereau prêt » ; lu en < 1 s après la caméra ;
//     « Ouvrir la vente » ⇒ Ventes, la ligne de CETTE vente mise en évidence ;
//  B. DataMatrix (S10 Chronopost) ⇒ SA vente (390 : par le disque « + » ⇒ Scanner, depuis Ma journée) ;
//  C. QR (lien de suivi Mondial Relay) depuis Achats ⇒ l'achat de ce n°, son code de retrait et son point ;
//  D. le même n° sur une vente et un retour ⇒ la liste des deux, aucune ouverte ; un toucher ⇒ sa fiche ;
//  E. n° inconnu ⇒ « Ce colis n'est pas dans VRM », le transporteur et le n° lus, « Chercher ce n° » ;
//  F. un EAN-13 (boîte) ⇒ « pas un n° de suivi », la caméra continue, aucune fiche ;
//  G. caméra refusée ⇒ la phrase claire, la saisie a le curseur, le n° tapé ⇒ sa fiche ;
//  PARTOUT : cibles ≥ 44 px, rien ne déborde, aucune erreur, aucune requête avec une image,
//  la caméra coupée en sortant.
// Vues : 390 tactile et 1512 (SCAN_VUES=390-clair,1512-sombre…), scènes (SCAN_LETTRES=ADF). SHOTS=dossier : les captures.
// Modules : bwip-js et @zxing/library@0.20.0 (dans node_modules, ou BANC_MODULES=<dossier>/node_modules).
// Lancer : construire dist/, puis node scripts/bancs/scan-colis.cjs   (BANC_PORT, SHOTS, BANC_DIST)
'use strict';
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

// ── Les n° (INVENTÉS, à la forme exacte) ─────────────────────────────────────
const cleS10 = (huit) => { const p = [8, 6, 4, 2, 3, 5, 9, 7]; let t = 0; for (let i = 0; i < 8; i++) t += Number(huit[i]) * p[i]; const c = 11 - (t % 11); return c === 10 ? 0 : c === 11 ? 5 : c; };
const s10 = (pre, huit, pays) => `${pre}${huit}${cleS10(huit)}${pays}`;
const MR_A = '41235813', MR_VOISIN = '41235814';
const S10_A = s10('XW', '20262031', 'TS'), S10_VOISIN = s10('XW', '20262032', 'TS'), S10_B = s10('XW', '20262040', 'TS'), S10_INCONNU = s10('XW', '77777777', 'TS');
const MR_ACHAT = '52718281';
const CODES = {
  A: { bcid: 'code128', text: '56' + MR_A + '0101' + '402623166859', l: 1 },
  B: { bcid: 'datamatrix', text: S10_A, l: 2 },
  C: { bcid: 'qrcode', text: `https://www.mondialrelay.com/public/permanent/tracking.aspx?ens=MRLBCOIN&exp=${MR_ACHAT}&language=FR&CodePostal=35260`, l: 2 },
  D: { bcid: 'code128', text: S10_B, l: 1 },
  E: { bcid: 'code128', text: S10_INCONNU, l: 1 },
  F: { bcid: 'ean13', text: '361427222571', l: 1 },
};

// ── Les données (INVENTÉES) ──────────────────────────────────────────────────
const TITRE = 'Nike Air Max 90 blanche';
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const vente = (id, k, aExp) => ({ transaction_id: id, title: TITRE, size_title: '42', user_login: `acheteur_${k}`, price: { amount: '50', currency_code: 'EUR' },
  status: aExp ? 'Le paiement a été validé' : 'Colis livré', transaction_user_status: aExp ? 'needs_action' : 'completed', date: iso(MS - J - k * 60000), photo: { url: url(k) } });
const VENTES = [vente(9201, 1, true), vente(9202, 2, true), vente(9203, 3, true), vente(9204, 4, true), vente(9205, 5, true), vente(9206, 6, false)];
const SUIVI = { 9201: MR_A, 9202: MR_VOISIN, 9203: S10_A, 9204: S10_B, 9205: S10_VOISIN, 9206: '' };
const NUMS = Object.fromEntries(VENTES.map((v, k) => [String(v.transaction_id), { numero: String(31 + k) }]));
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const bord = (tx) => ({ id: 'email_bord_' + tx, data: { transaction: String(tx), uid: '111', filename: 'bordereau-' + tx + '.pdf', modele: TITRE, article: TITRE, receivedAt: iso(MS - 3600000), pdfB64: PDF_B64, suivi: SUIVI[tx] } });
const achat = (id, titre, k, status) => ({ transaction_id: id, conversation_id: 7000 + id % 1000, title: titre, size_title: '40', user_login: `vendeur_${k}`, price: { amount: '40', currency_code: 'EUR' }, status, transaction_user_status: 'needs_action', date: iso(MS - 5 * J), photo: { url: url(20 + k) } });
const ACHATS = [achat(9301, 'Adidas Samba noire', 1, 'Colis déposé en point relais'), achat(9302, 'New Balance 530 grise', 2, 'Retour en cours')];
const TRACK = { id: `email_track_mondialrelay_${MR_ACHAT}`, data: { type: 'suivi', carrier: 'mondialrelay', suivi: MR_ACHAT, transaction: '9301', status: 'available', statusLabel: 'Arrivé au point de retrait',
  subject: `Votre colis ${MR_ACHAT} est disponible`, receivedAt: iso(MS - 0.3 * J), emailAt: iso(MS - 0.3 * J), arriveLe: iso(MS - 0.3 * J), code: '012345',
  lieu: 'TABAC DU PORT, 12 Rue du Port, 35260 Cancale', limite: jourDans(4), consigne: false, account: 'compte_test' } };
const RETOUR = { id: 'email_bordretour_9302', data: { transaction: '9302', suivi: S10_B, dateLimite: '', dateLimiteIso: iso(MS + 3 * J), article: 'New Balance 530 grise', uid: '111', account: 'compte_test', receivedAt: iso(MS - J), pdfB64: PDF_B64 } };
const LIGNES = [
  ...VENTES.map((v) => bord(v.transaction_id)).filter((r) => r.data.suivi),
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS), payload: { my_orders: ACHATS } } },
  TRACK, RETOUR,
];

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
  const shot = async (pg, q) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `scan-colis-${nom}-${q}.png`) }); };
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
  console.log(`\n— Scanner pour retrouver · ${nom}`);
  const tel = vp.width < 600;
  // A — Code 128 Mondial Relay ⇒ SA vente ; lu en < 1 s ; « Ouvrir » ⇒ la ligne de Ventes.
  await scene(nom, vp, sombre, 'A', async ({ pg }, shot) => {
    await pret(pg, 'ventes');
    const bb = await (await pg.$('[data-scan-retrouver-bouton="ventes"]')).boundingBox();
    dit(bb && bb.height >= 44 && bb.width >= 44, `${nom} A : le bouton du scanner dans Ventes (≥ 44 px)`, bb && JSON.stringify(bb));
    const m = await ouvrirEtLire(pg, ['[data-scan-retrouver-bouton="ventes"]']);
    const e = await etat(pg);
    dit(e && e.resultat === 'un' && e.fiche === 'vente:v:9201', `${nom} A : Code 128 « 56… » (Mondial Relay) ⇒ la fiche de LA vente de ce n° (pas la voisine au même titre)`, JSON.stringify(e && { r: e.resultat, f: e.fiche, m }));
    ditTemps(m.lecture != null && m.lecture < 1000, `${nom} A : lu en moins d’1 s après l’ouverture de la caméra`, JSON.stringify(m));
    dit(e && e.num === '31' && e.etat === 'afaire' && e.lu === MR_A, `${nom} A : son N°, « à expédier » (ambre), le n° lu`, JSON.stringify(e && { num: e.num, etat: e.etat, lu: e.lu }));
    await pg.waitForTimeout(400);
    const e2 = await etat(pg);
    dit(e2 && e2.photo && /\/b1\//.test(e2.photo.src) && e2.photo.ok, `${nom} A : la photo de CETTE annonce`, JSON.stringify(e2 && e2.photo));
    await communs(pg, nom, 'A'); await shot(pg, '1-vente');
    await pg.click('[data-scan-r-ouvrir="vente:v:9201"]');
    const vise = await pg.waitForFunction(() => !document.querySelector('[data-scan-r]') && !!document.querySelector('[data-cible-notif="vente"]:is([data-tx="9201"], [data-cible~="vente:9201"])'), null, { timeout: 9000 }).then(() => true).catch(() => false);
    dit(vise, `${nom} A : « Ouvrir la vente » ⇒ Ventes, la ligne de CETTE vente ouverte et mise en évidence`);
    await shot(pg, '2-ouverte');
    const p = await pg.evaluate(() => window.__pistes.map((t) => t.readyState));
    dit(p.length >= 1 && p.every((x) => x === 'ended'), `${nom} A : la caméra coupée en partant`, JSON.stringify(p));
  });
  // B — DataMatrix (S10) ⇒ SA vente ; au téléphone par l'icône Scanner du champ de recherche, depuis Ma journée.
  await scene(nom, vp, sombre, 'B', async ({ pg }, shot) => {
    if (tel) {
      // (17 nov.) Plus de disque « + » : le Scanner est l'icône DANS le champ de recherche (loupe ⇒ champ ⇒ scanner).
      await pg.waitForSelector('button[data-recherche-loupe]', { timeout: 30000 });
      await pg.waitForTimeout(1200);
      const m = await ouvrirEtLire(pg, ['button[data-recherche-loupe]', '[data-recherche-scanner]']);
      const e = await etat(pg);
      dit(e && e.resultat === 'un' && e.fiche === 'vente:v:9203', `${nom} B : loupe ⇒ Scanner (dans le champ), depuis Ma journée : DataMatrix (S10) ⇒ SA vente (pas la voisine)`, JSON.stringify(e && { r: e.resultat, f: e.fiche, m }));
      await shot(pg, '3-disque');
    } else {
      await pret(pg, 'ventes');
      const m = await ouvrirEtLire(pg, ['[data-scan-retrouver-bouton="ventes"]']);
      const e = await etat(pg);
      dit(e && e.resultat === 'un' && e.fiche === 'vente:v:9203', `${nom} B : DataMatrix (S10 Chronopost) ⇒ SA vente (pas la voisine)`, JSON.stringify(e && { r: e.resultat, f: e.fiche, m }));
      ditTemps(m.lecture != null && m.lecture < 1000, `${nom} B : lu en moins d’1 s`, JSON.stringify(m));
      await shot(pg, '3-datamatrix');
    }
    await fermerEtCouper(pg, nom, 'B');
  }, { debut: tel ? 'journee' : 'ventes' });
  // C — QR (lien de suivi) depuis Achats ⇒ l'achat, son code et son point.
  await scene(nom, vp, sombre, 'C', async ({ pg }, shot) => {
    await pret(pg, 'achats');
    const m = await ouvrirEtLire(pg, ['[data-scan-retrouver-bouton="achats"]']);
    const e = await etat(pg);
    dit(e && e.resultat === 'un' && e.fiche === 'achat:a:9301', `${nom} C : QR (lien Mondial Relay) depuis Achats ⇒ l’achat de ce n°`, JSON.stringify(e && { r: e.resultat, f: e.fiche, m }));
    dit(e && e.code === '012345' && e.etat === 'afaire', `${nom} C : son code de retrait et « à retirer »`, JSON.stringify(e && { code: e.code, etat: e.etat }));
    await communs(pg, nom, 'C'); await shot(pg, '4-achat');
    await fermerEtCouper(pg, nom, 'C');
  }, { debut: 'achats' });
  // D — le même n° sur une vente et un retour ⇒ la liste ; un toucher ⇒ sa fiche.
  await scene(nom, vp, sombre, 'D', async ({ pg }, shot) => {
    await pret(pg, 'ventes');
    await ouvrirEtLire(pg, ['[data-scan-retrouver-bouton="ventes"]']);
    let e = await etat(pg);
    dit(e && e.resultat === 'plusieurs' && !e.fiche && JSON.stringify(e.choix) === JSON.stringify(['retour:r:9302', 'vente:v:9204']), `${nom} D : le même n° sur une vente et un retour ⇒ les deux, aucune ouverte`, JSON.stringify(e && { r: e.resultat, c: e.choix, f: e.fiche }));
    await communs(pg, nom, 'D'); await shot(pg, '5-plusieurs');
    await pg.click('[data-scan-r-choix="retour:r:9302"]');
    e = await etat(pg);
    dit(e && e.fiche === 'retour:r:9302' && e.ouvrir === 'retour:r:9302', `${nom} D : son toucher ⇒ la fiche du retour`, JSON.stringify(e && { f: e.fiche }));
    await shot(pg, '6-retour');
    await fermerEtCouper(pg, nom, 'D');
  });
  // E — n° inconnu ⇒ dit, avec ce qui a été lu.
  await scene(nom, vp, sombre, 'E', async ({ pg }, shot) => {
    await pret(pg, 'ventes');
    await ouvrirEtLire(pg, ['[data-scan-retrouver-bouton="ventes"]']);
    const e = await etat(pg);
    dit(e && e.resultat === 'aucun' && !e.fiche && e.transporteur === 'chronopost' && e.suivi === S10_INCONNU && e.chercher === S10_INCONNU && /pas dans VRM/.test(e.texte), `${nom} E : inconnu ⇒ « Ce colis n’est pas dans VRM », Chronopost et le n° lus, « Chercher ce n° »`, JSON.stringify(e && { r: e.resultat, t: e.transporteur, s: e.suivi, x: e.texte }));
    await communs(pg, nom, 'E'); await shot(pg, '7-aucun');
    await fermerEtCouper(pg, nom, 'E');
  });
  // F — un EAN-13 ⇒ pas un n° de suivi : la caméra continue, aucune fiche.
  await scene(nom, vp, sombre, 'F', async ({ pg }, shot) => {
    await pret(pg, 'ventes');
    await ouvrirEtLire(pg, ['[data-scan-retrouver-bouton="ventes"]'], false);
    const vu = await pg.waitForSelector('[data-scan-r-indice]', { timeout: 45000, state: 'attached' }).then(() => true).catch(() => false);
    await shot(pg, '8-pas-un-suivi');
    await pg.waitForTimeout(2500);
    const e = await etat(pg);
    dit(vu && e && !e.resultat && !e.fiche && e.camera === 'active', `${nom} F : EAN-13 ⇒ « pas un n° de suivi », aucune fiche, la caméra continue`, JSON.stringify(e && { vu, r: e.resultat, cam: e.camera }));
    await fermerEtCouper(pg, nom, 'F');
  });
  // G — caméra refusée ⇒ la phrase, la saisie ; le n° tapé ⇒ sa fiche.
  await scene(nom, vp, sombre, 'G', async ({ pg }, shot) => {
    await pret(pg, 'ventes');
    await ouvrirEtLire(pg, ['[data-scan-retrouver-bouton="ventes"]'], false);
    await pg.waitForSelector('[data-scan-r][data-scan-r-camera="sans"]', { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(300);
    let e = await etat(pg);
    dit(e && e.camera === 'sans' && e.sansCam === 'refus' && /Caméra refusée/.test(e.aide) && e.focus, `${nom} G : caméra refusée ⇒ la phrase claire, la saisie a le curseur`, JSON.stringify(e && { cam: e.camera, r: e.sansCam, aide: e.aide, focus: e.focus }));
    await shot(pg, '9-refus');
    await pg.fill('[data-scan-r-saisie]', ' ' + S10_VOISIN.toLowerCase().replace(/(\d{4})/, '$1 ') + ' ');
    await pg.click('[data-scan-r-ok]');
    await pg.waitForSelector('[data-scan-r-resultat]', { timeout: 15000 }).catch(() => {});
    e = await etat(pg);
    dit(e && e.resultat === 'un' && e.fiche === 'vente:v:9205', `${nom} G : le n° tapé (espaces, minuscules) ⇒ SA vente`, JSON.stringify(e && { r: e.resultat, f: e.fiche }));
    await pg.fill('[data-scan-r-saisie]', 'Nike Air Max 90').catch(() => {});
    await pg.click('[data-scan-r-autre]').catch(() => {});
    await pg.fill('[data-scan-r-saisie]', TITRE); await pg.click('[data-scan-r-ok]');
    await pg.waitForSelector('[data-scan-r-resultat]', { timeout: 8000 }).catch(() => {});
    e = await etat(pg);
    dit(e && e.resultat === 'pasReconnu' && !e.fiche, `${nom} G : un titre tapé n’est jamais une identité`, JSON.stringify(e && { r: e.resultat }));
    await communs(pg, nom, 'G'); await shot(pg, '10-titre');
  }, { refus: true });
}

(async () => {
  // SCAN_VIDEO=A:fichier.y4m — écrit seulement la vidéo d'un code (pour la regarder ou la décoder ailleurs).
  if (process.env.SCAN_VIDEO) { const [l, f] = process.env.SCAN_VIDEO.split(':'); await videoDuCode(CODES[l], f); srv.close(); console.log('vidéo écrite : ' + f); return; }
  try {
    if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/ absent : npm run build');
    for (const [nom, vp, sombre] of [['390-clair', { width: 390, height: 844 }, false], ['390-sombre', { width: 390, height: 844 }, true], ['1512-clair', { width: 1512, height: 950 }, false], ['1512-sombre', { width: 1512, height: 950 }, true]]) {
      if (VUES ? !VUES.includes(nom) : /sombre/.test(nom)) continue;   // par défaut : 390 et 1512 en clair
      await vue(nom, vp, sombre);
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    srv.close();
    console.log(ko ? `\nKO scan-colis : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK scan-colis : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
