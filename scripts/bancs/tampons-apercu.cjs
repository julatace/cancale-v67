// ════════════════════════════════════════════════════════════════════════════
// Banc : L'APERÇU AVANT IMPRESSION ET L'ÉDITEUR DES TAMPONS (16 nov., lot tampons-parametres)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « je sélectionne ce que je veux imprimer, et après ça m'ouvre une vignette […] le N° / le tamponnage je
// peux le régler là où je veux ; et quand je touche Imprimer, les réglages sont appliqués aux bordereaux ».
// L'app CONSTRUITE (dist/), jouée à 1512 (souris) et 390 (tactile, iPhone : glisser au doigt par de vrais
// événements tactiles). Données INVENTÉES (dépôt public) ; chaque vente a un bordereau d'EXEMPLE
// (src/impression/bordereauExemple.js : vrai QR, vrai code-barres, adresse inventée) qui porte « ETIQUETTE <tx> ».
//  P1 « Imprimer (3) » ⇒ l'APERÇU : 3 vignettes, chacune SA page tamponnée par le vrai code ; rien d'ouvert ;
//  P2 « tous de ce type » DÉCOCHÉ, le N° de la 2ᵉ vignette glissé ⇒ redessiné à la nouvelle place ;
//  P3 glissé SUR le QR ⇒ REFUSÉ (il revient, « Refusé : … » dit) ;
//  P4 « Imprimer » ⇒ le PDF : 3 pages, la 2ᵉ tamponnée à la NOUVELLE place (± 4 pt), les 1ʳᵉ et 3ᵉ à la place
//     d'origine ; chaque QR se DÉCODE (jsQR) ; rien n'est retenu pour la suite (`vrm_tampons` sans place) ;
//  P5 « tous de ce type » COCHÉ (par défaut) : glisser sur la 1ʳᵉ ⇒ `vrm_tampons` garde la place de la forme ; le PDF :
//     les 3 (même forme) à cette place ;
//  E1 Paramètres → Imprimante : la galerie (tous les types), toucher Mondial Relay ⇒ l'éditeur ; glisser le N° ⇒
//     `vrm_tampons.formes` ; glisser sur le QR ⇒ refusé ; « Seulement Mondial Relay » + titre décoché ⇒ exception ;
//     « Revenir à l'origine » ⇒ ôtée ;
//  PARTOUT : aucune erreur d'app, rien ne déborde. Captures (SHOTS=dossier), regardées.
// Lancer : construire dist/, puis node scripts/bancs/tampons-apercu.cjs   (TA_VUES=1512,390)
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const { pathToFileURL } = require('url');
const { lancer } = require('./_navigateur.cjs');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const NM = path.join(__dirname, '..', '..', 'node_modules');
const PDFJS = path.join(NM, 'pdfjs-dist');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || (20000 + Math.floor(Math.random() * 20000)));
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.TA_VUES ? process.env.TA_VUES.split(',') : ['1512', '390'];
const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const V = [
  { tx: 9401, titre: 'Alpha Veste en jean', num: '31' },
  { tx: 9402, titre: 'Bravo Sac en toile', num: '32' },
  { tx: 9403, titre: 'Charlie Pull en laine', num: '33' },
];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

async function bordereau(tx) {
  const PL = require(path.join(NM, 'pdf-lib')), qr = require(path.join(NM, 'qrcode-generator'));
  const { fabriquerBordereau } = await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'impression', 'bordereauExemple.js')).href);
  const d = await PL.PDFDocument.load(await fabriquerBordereau(PL, qr, 'a4-notice', { suivi: '1234567890' + String(tx) }));
  const f = await d.embedFont(PL.StandardFonts.Helvetica);
  d.getPages()[0].drawText('ETIQUETTE ' + tx, { x: 40, y: 800, size: 12, font: f });
  return Buffer.from(await d.save()).toString('base64');
}
async function lirePdf(b64) {
  const pdfjs = await import(pathToFileURL(path.join(PDFJS, 'legacy', 'build', 'pdf.mjs')).href);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(Buffer.from(b64, 'base64')), verbosity: 0 }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i); const v = p.getViewport({ scale: 1 });
    const items = (await p.getTextContent()).items.map((it) => { const m = pdfjs.Util.transform(v.transform, it.transform); return { s: it.str, x: m[4], y: m[5], t: Math.hypot(m[2], m[3]) }; });
    out.push({ w: v.width, h: v.height, items, texte: items.map((x) => x.s).join(' ') });
  }
  return out;
}
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = f.startsWith('/__pdfjs/') ? path.join(PDFJS, 'build', path.basename(f)) : f === '/__jsqr.js' ? path.join(NM, 'jsqr', 'dist', 'jsQR.js') : path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
async function donnees() {
  return [
    { id: 'main', data: { vinted_used_numeros: [31, 32, 33], vinted_annonce_numeros: Object.fromEntries(V.map((v) => [`i${v.tx}`, { numero: v.num, title: v.titre, auto: false, numberedAt: ilYaH(200) }])) } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: V.map((v, i) => ({ transaction_id: v.tx, title: v.titre, price: { amount: '50', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: ilYaH(20 + i) })) } } },
    ...V.map((v) => ({ id: `harvest_111_txn_${v.tx}`, data: { capturedAt: ilYaH(1), payload: { transaction: { id: v.tx, item_id: `i${v.tx}` } } } })),
    ...await Promise.all(V.map(async (v) => ({ id: 'email_bord_' + v.tx, data: { transaction: String(v.tx), uid: '111', filename: `bordereau-${v.tx}.pdf`, modele: v.titre, article: v.titre, receivedAt: ilYaH(2), pdfB64: await bordereau(v.tx), suivi: '4' + v.tx } }))),
  ];
}
let srvPret;
async function ouvrir(b, { tactile, LIGNES, url = '/?tab=cat_bord', tampons = null }) {
  const vue = tactile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: IPHONE } : { viewport: { width: 1512, height: 950 } };
  const ctx = await b.newContext({ ...vue, locale: 'fr-FR' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const mainData = LIGNES.find((r) => r.id === 'main').data;
  await pg.addInitScript(({ m, t }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', 'true'); localStorage.setItem('vrm_langue', JSON.stringify('fr'));
      if (!sessionStorage.getItem('banc_init')) {
        sessionStorage.setItem('banc_init', '1');
        localStorage.setItem('vinted_annonce_numeros', JSON.stringify(m.vinted_annonce_numeros)); localStorage.setItem('vinted_used_numeros', JSON.stringify(m.vinted_used_numeros));
        localStorage.setItem('vrm_imprimante', JSON.stringify('normale'));
        if (t) localStorage.setItem('vrm_tampons', JSON.stringify(t)); else localStorage.removeItem('vrm_tampons');
      }
    } catch (_) {}
    window.__ouvertures = [];
    const geste = () => (window.event && /^(click|pointerup|touchend|keydown|keyup|mouseup)$/.test(window.event.type)) ? window.event.type : '';
    try { Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d) => !!(d && d.files && d.files.length) }); } catch (_) {}
    try { Object.defineProperty(navigator, 'share', { configurable: true, value: (d) => { window.__ouvertures.push({ voie: 'partage', geste: geste(), blob: d && d.files && d.files[0] }); return Promise.resolve(); } }); } catch (_) {}
    window.open = (u) => { window.__ouvertures.push({ voie: 'onglet', geste: geste(), url: String(u) }); return null; };
    window.print = () => {};
  }, { m: mainData, t: tampons });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**://cdn.jsdelivr.net/npm/pdfjs-dist@*/**', (r) => {
    const n = path.basename(new URL(r.request().url()).pathname);
    const f = path.join(PDFJS, 'build', n.replace(/\.js$/, '.mjs'));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) });
  });
  await pg.addInitScript((port) => { import(`http://localhost:${port}/__pdfjs/pdf.min.mjs`).then((m) => { m.GlobalWorkerOptions.workerSrc = `http://localhost:${port}/__pdfjs/pdf.worker.min.mjs`; window.pdfjsLib = { ...m, GlobalWorkerOptions: { workerSrc: '' }, getDocument: (o) => { const t = m.getDocument(o); return { promise: t.promise.then((d) => { if (typeof d.destroy !== 'function') d.destroy = () => t.destroy(); return d; }), destroy: () => t.destroy() }; } }; }).catch(() => {}); }, PORT);
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)].map((m) => ({ k: m[1], non: !!m[2] }));
    const passe = (r) => filtres.every((f) => (f.non ? r.data[f.k] != null : r.data[f.k] == null));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await srvPret;
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, tactile };
}
let nShot = 0;
const shot = async (pg, nom) => { if (SHOTS) { try { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `tampons-apercu-${String(++nShot).padStart(2, '0')}-${nom}.png`), timeout: 60000 }); } catch (_) {} } };
const attendre = (pg, f, arg, ms = 30000) => pg.waitForFunction(f, arg, { timeout: ms }).then(() => true).catch(() => false);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const toucher = async (o, sel) => { const l = o.pg.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 20000 }); if (o.tactile) await l.tap(); else await l.click(); };
// GLISSER un élément de (dx, dy) pixels : à la souris, ou au DOIGT (vrais événements tactiles, CDP).
async function glisser(o, sel, dx, dy) {
  const l = o.pg.locator(sel).first(); await l.scrollIntoViewIfNeeded(); const b = await l.boundingBox(); if (!b) return false;
  const x0 = b.x + Math.min(b.width / 2, 12), y0 = b.y + b.height / 2;
  if (!o.tactile) { await o.pg.mouse.move(x0, y0); await o.pg.mouse.down(); for (let i = 1; i <= 8; i++) await o.pg.mouse.move(x0 + dx * i / 8, y0 + dy * i / 8); await o.pg.mouse.up(); return true; }
  const c = o.cdp || (o.cdp = await o.ctx.newCDPSession(o.pg));
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= 8; i++) await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / 8, y: y0 + dy * i / 8 }] });
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return true;
}
const boiteEl = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); return e ? { x: +e.getAttribute('data-x'), y: +e.getAttribute('data-y'), w: +e.getAttribute('data-w'), h: +e.getAttribute('data-h') } : null; }, sel);
const pdfOuvert = async (pg) => pg.evaluate(async () => {
  const f = document.querySelector('[data-visionneuse-cadre]'); let blob = null;
  if (f) { const r = await fetch(f.src); blob = await r.blob(); } else { const x = window.__ouvertures[window.__ouvertures.length - 1]; blob = x && x.blob; }
  if (!blob) return null; const u = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let j = 0; j < u.length; j++) s += String.fromCharCode(u[j]); return btoa(s);
});
// Les QR d'un PDF décodés dans la page (jsQR), page par page.
const qrsDe = (pg, b64) => pg.evaluate(async (b) => {
  if (!window.jsQR) await new Promise((ok) => { const s = document.createElement('script'); s.src = '/__jsqr.js'; s.onload = ok; document.head.appendChild(s); });
  const d = await window.pdfjsLib.getDocument({ data: Uint8Array.from(atob(b), (c) => c.charCodeAt(0)), isEvalSupported: false }).promise; const out = [];
  for (let i = 1; i <= d.numPages; i++) { const p = await d.getPage(i), v = p.getViewport({ scale: 3 }); const c = document.createElement('canvas'); c.width = v.width; c.height = v.height; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); await p.render({ canvasContext: x, viewport: v }).promise; const q = window.jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height); out.push(q ? q.data : null); }
  return out;
}, b64);
const numDe = (page) => page.items.find((i) => /^N° 3\d/.test(i.s));
// L'aperçu redessiné après un geste : le PDF refait (« pret ») puis chaque vignette redessinée (`data-pret="1"`).
const apercuStable = async (pg) => { await pg.waitForTimeout(300); await attendre(pg, () => { const e = document.querySelector('[data-impr-apercu]'); return e && e.getAttribute('data-impr-apercu') === 'pret' && document.querySelectorAll('[data-impr-apercu-item] [data-tampons-scene][data-pret="1"] [data-tampon-el="n"]').length === document.querySelectorAll('[data-impr-apercu-item]').length; }, null, 60000); };
// Le centre d'une zone interdite (après avoir amené la vignette à l'écran : les coordonnées sont celles de l'écran).
const centreZone = async (pg, item, quoi) => { await pg.locator(`[data-impr-apercu-item="${item}"] [data-tampons-scene]`).scrollIntoViewIfNeeded(); return pg.evaluate(([c, q]) => { const e = document.querySelector(`[data-impr-apercu-item="${c}"] [data-tampon-interdit="${q}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, [item, quoi]); };

async function apercu(b, vue) {
  const tactile = vue === '390', nom = `${vue}${tactile ? ' tactile' : ''}`;
  const LIGNES = await donnees();
  const o = await ouvrir(b, { tactile, LIGNES });
  const { pg } = o;
  try {
    await attendre(pg, () => { const e = document.querySelector('[data-impr-lot]'); return e && !e.disabled && e.getAttribute('data-impr-lot') === '3'; }, null, 60000);
    await toucher(o, '[data-impr-lot]');
    const vu = await attendre(pg, () => document.querySelectorAll('[data-impr-apercu-item] [data-tampons-scene][data-pret="1"] [data-tampon-el="n"]').length === 3, null, 60000);
    const etat = await pg.evaluate(() => ({ n: document.querySelectorAll('[data-impr-apercu-item]').length, ouv: window.__ouvertures.length, cles: [...document.querySelectorAll('[data-impr-apercu-item]')].map((e) => e.getAttribute('data-cle-forme')) }));
    dit(vu && etat.n === 3 && etat.ouv === 0, `${nom} : P1 « Imprimer (3) » ⇒ l'aperçu : 3 vignettes tamponnées, rien d'ouvert`, JSON.stringify(etat));
    await shot(pg, `${vue}-apercu`);
    // P2 « tous de ce type » décoché, la 2ᵉ glissée
    await toucher(o, '[data-impr-apercu-tous]');
    const items = await pg.evaluate(() => [...document.querySelectorAll('[data-impr-apercu-item]')].map((e) => e.getAttribute('data-impr-apercu-item')));
    const s2 = `[data-impr-apercu-item="${items[1]}"] [data-tampon-el="n"]`;
    const avant = [];
    for (const c of items) avant.push(await boiteEl(pg, `[data-impr-apercu-item="${c}"] [data-tampon-el="n"]`));
    const ppt = await pg.evaluate((c) => +document.querySelector(`[data-impr-apercu-item="${c}"] [data-tampons-scene]`).getAttribute('data-ppt'), items[1]);
    const dxp = Math.round(40 * ppt), dyp = Math.round(220 * ppt);   // ≈ 40 pt à droite, 220 pt plus bas : le blanc entre la notice et l'étiquette
    await glisser(o, s2, dxp, dyp);
    await apercuStable(pg);
    const apres2 = await boiteEl(pg, s2);
    const bouge = apres2 && avant[1] && Math.hypot(apres2.x - avant[1].x, apres2.y - avant[1].y) > 20;
    const diag2 = bouge ? null : await pg.evaluate((c) => ({ refus: (document.querySelector('[data-tampons-refus]') || { getAttribute: () => null }).getAttribute('data-tampons-refus'), interdits: [...document.querySelectorAll(`[data-impr-apercu-item="${c}"] [data-tampon-interdit]`)].map((e) => e.getAttribute('data-tampon-interdit') + ':' + e.style.left + ',' + e.style.top + ',' + e.style.width + ',' + e.style.height) }), items[1]);
    dit(bouge, `${nom} : P2 le N° de la 2ᵉ vignette glissé et redessiné par le vrai code`, JSON.stringify({ avant: avant[1], apres: apres2, diag2 }));
    await shot(pg, `${vue}-glisse`);
    // P3 sur le QR ⇒ refusé
    const zq = await centreZone(pg, items[0], 'qr');
    const b0 = await pg.locator(`[data-impr-apercu-item="${items[0]}"] [data-tampon-el="n"]`).boundingBox();
    if (zq && b0) {
      await glisser(o, `[data-impr-apercu-item="${items[0]}"] [data-tampon-el="n"]`, zq.x - (b0.x + Math.min(b0.width / 2, 12)), zq.y - (b0.y + b0.height / 2));
      const refus = await attendre(pg, () => !!document.querySelector('[data-impr-apercu] [data-tampons-refus]'), null, 5000);
      const apres0 = await boiteEl(pg, `[data-impr-apercu-item="${items[0]}"] [data-tampon-el="n"]`);
      dit(refus && apres0 && Math.abs(apres0.x - avant[0].x) < 1 && Math.abs(apres0.y - avant[0].y) < 1, `${nom} : P3 glissé SUR le QR ⇒ refusé, revenu à sa place, c'est dit`, JSON.stringify(apres0));
      await shot(pg, `${vue}-refus`);
    } else dit(false, `${nom} : P3 la zone du QR est dessinée sur la vignette`);
    // P4 Imprimer
    await toucher(o, '[data-impr-apercu-imprimer]');
    await attendre(pg, () => !!document.querySelector('[data-visionneuse-cadre]') || window.__ouvertures.length > 0, null, 40000);
    await pg.waitForTimeout(1200);
    const b64 = await pdfOuvert(pg);
    const pages = b64 ? await lirePdf(b64) : [];
    const n2 = pages[1] && numDe(pages[1]), n1 = pages[0] && numDe(pages[0]), n3 = pages[2] && numDe(pages[2]);
    const ecart2 = n2 && apres2 ? Math.hypot(n2.x - (apres2.x + 3), (n2.y - n2.t * 0.8) - apres2.y) : 999;
    dit(pages.length === 3 && ecart2 <= 6, `${nom} : P4 le PDF : la 2ᵉ page tamponnée à la NOUVELLE place (écart ${ecart2.toFixed(1)} pt)`, n2 ? `${n2.x.toFixed(1)},${n2.y.toFixed(1)}` : '—');
    const e1 = n1 && avant[0] ? Math.hypot(n1.x - (avant[0].x + 3), (n1.y - n1.t * 0.8) - avant[0].y) : 999, e3 = n3 && avant[2] ? Math.hypot(n3.x - (avant[2].x + 3), (n3.y - n3.t * 0.8) - avant[2].y) : 999;
    dit(e1 <= 6 && e3 <= 6, `${nom} : P4 les 1ʳᵉ et 3ᵉ pages à la place d'origine (« tous de ce type » décoché)`, `${e1.toFixed(1)} · ${e3.toFixed(1)}`);
    const qrs = b64 ? await qrsDe(pg, b64) : [];
    dit(qrs.length === 3 && qrs.every((q) => q && /^VRM-EXEMPLE-/.test(q)), `${nom} : P4 chaque QR du PDF se décode`, JSON.stringify(qrs));
    const garde = await pg.evaluate(() => { try { const t = JSON.parse(localStorage.getItem('vrm_tampons') || 'null'); return t ? Object.keys(t.formes || {}).length : 0; } catch (_) { return -1; } });
    dit(garde === 0, `${nom} : P4 décoché : rien n'est retenu pour les prochains`, String(garde));
    dit(pages.map((p) => (/ETIQUETTE (\d+)/.exec(p.texte) || [])[1]).join(',') === V.map((v) => v.tx).join(','), `${nom} : P4 chaque page SON bordereau, dans l'ordre`);
    await shot(pg, `${vue}-imprime`);
    dit((await deborde(pg)) <= 1, `${nom} : rien ne déborde`);
    dit(o.errs.length === 0, `${nom} : aucune erreur d'app`, o.errs.join(' | ').slice(0, 300));
  } catch (e) { dit(false, `${nom} : l'aperçu s'exécute`, String(e.message).slice(0, 300)); await shot(pg, `${vue}-erreur`); }
  await o.ctx.close();
  // P5 « tous de ce type » coché (par défaut)
  const o2 = await ouvrir(b, { tactile, LIGNES });
  try {
    const pg = o2.pg;
    await attendre(pg, () => { const e = document.querySelector('[data-impr-lot]'); return e && !e.disabled && e.getAttribute('data-impr-lot') === '3'; }, null, 60000);
    await toucher(o2, '[data-impr-lot]');
    await attendre(pg, () => document.querySelectorAll('[data-impr-apercu-item] [data-tampons-scene][data-pret="1"] [data-tampon-el="n"]').length === 3, null, 60000);
    const items = await pg.evaluate(() => [...document.querySelectorAll('[data-impr-apercu-item]')].map((e) => e.getAttribute('data-impr-apercu-item')));
    const ppt = await pg.evaluate((c) => +document.querySelector(`[data-impr-apercu-item="${c}"] [data-tampons-scene]`).getAttribute('data-ppt'), items[0]);
    await glisser(o2, `[data-impr-apercu-item="${items[0]}"] [data-tampon-el="n"]`, Math.round(40 * ppt), Math.round(220 * ppt));
    const garde = await attendre(pg, () => { try { const t = JSON.parse(localStorage.getItem('vrm_tampons') || 'null'); return t && Object.keys(t.formes || {}).length === 1; } catch (_) { return false; } }, null, 10000);
    await apercuStable(pg);
    const bx = await boiteEl(pg, `[data-impr-apercu-item="${items[0]}"] [data-tampon-el="n"]`);
    await toucher(o2, '[data-impr-apercu-imprimer]');
    await attendre(pg, () => !!document.querySelector('[data-visionneuse-cadre]') || window.__ouvertures.length > 0, null, 40000);
    await pg.waitForTimeout(1200);
    const b64 = await pdfOuvert(pg); const pages = b64 ? await lirePdf(b64) : [];
    const ecarts = pages.map((p) => { const n = numDe(p); return n && bx ? Math.hypot(n.x - (bx.x + 3), (n.y - n.t * 0.8) - bx.y) : 999; });
    dit(garde && pages.length === 3 && ecarts.every((e) => e <= 6), `${nom} : P5 « tous de ce type » : la place gardée (\`vrm_tampons\`), les 3 bordereaux de cette forme à cette place`, ecarts.map((e) => e.toFixed(1)).join(' · '));
    dit(o2.errs.length === 0, `${nom} : P5 aucune erreur d'app`, o2.errs.join(' | ').slice(0, 300));
  } catch (e) { dit(false, `${nom} : P5 s'exécute`, String(e.message).slice(0, 300)); }
  await o2.ctx.close();
}

// S · UN bordereau imprimé depuis SA carte (Julien, capture iPhone : « toute la ligne bouge » ; « Bordereau prêt » à
// l'arrache) : la carte et son bouton ne bougent pas (rectangles identiques avant / pendant / après) ; l'aperçu du
// bordereau seul s'ouvre ; « Imprimer » ⇒ « Bordereau prêt » refait : aperçu réel dessiné, aucun émoji, « Imprimer »
// ouvre le partage AVEC le PDF dans le geste (iPhone), « Enregistrer », « Déplacer le tampon ».
async function unSeul(b, vue) {
  const tactile = vue === '390', nom = `${vue}${tactile ? ' tactile' : ''}`;
  const LIGNES = await donnees();
  const o = await ouvrir(b, { tactile, LIGNES });
  const { pg } = o;
  try {
    const sel = '[data-bord-card] button.vrm-colis-primaire[data-imprime]';
    await pg.waitForSelector(sel, { timeout: 60000 });
    await pg.locator(sel).first().scrollIntoViewIfNeeded();
    const rects = () => pg.evaluate((q) => { const bt = document.querySelector(q); if (!bt) return null; const c = bt.closest('[data-bord-card]'); const r = (e) => { const x = e.getBoundingClientRect(); return [Math.round(x.x), Math.round(x.y), Math.round(x.width), Math.round(x.height)].join(','); }; return { carte: r(c), bouton: r(bt), occupe: bt.hasAttribute('data-occupe') }; }, sel);
    const avant = await rects();
    await shot(pg, `${vue}-un-avant`);
    await toucher(o, sel);
    await pg.waitForTimeout(60);
    const pendant = await rects();
    await shot(pg, `${vue}-un-pendant`);
    const ap = await attendre(pg, () => !!document.querySelector('[data-impr-apercu="pret"] [data-impr-apercu-imprimer]:not([disabled])'), null, 60000);
    const pendant2 = await rects();
    dit(avant && pendant && pendant2 && avant.carte === pendant.carte && avant.bouton === pendant.bouton && avant.carte === pendant2.carte && avant.bouton === pendant2.bouton && (pendant.occupe || pendant2.occupe),
      `${nom} : S1 « Imprimer » d'une carte : ni la carte ni le bouton ne bougent (roue DANS le bouton)`, JSON.stringify({ avant, pendant, pendant2 }));
    dit(ap, `${nom} : S2 l'aperçu avant impression du bordereau seul s'ouvre`);
    await shot(pg, `${vue}-un-apercu`);
    await toucher(o, '[data-impr-apercu-imprimer]');
    const pret = await attendre(pg, () => { const f = document.querySelector('[data-bord-pret]'); return f && f.querySelector('[data-bord-pret-apercu="ok"]'); }, null, 60000);
    await pg.evaluate(() => { const f = document.querySelector('[data-visionneuse-fermer]'); if (f) f.click(); });
    await pg.waitForTimeout(400);
    const apres = await rects();
    dit(apres && apres.carte === avant.carte && apres.bouton === avant.bouton && !apres.occupe, `${nom} : S3 après : la carte et le bouton à la même place, la roue partie`, JSON.stringify(apres));
    const feuille = await pg.evaluate(() => { const f = document.querySelector('[data-bord-pret]'); if (!f) return null; return { texte: f.innerText, emoji: /[\u{1F300}-\u{1FAFF}\u{2705}\u{2600}-\u{27BF}]/u.test(f.innerText), imprimer: !!f.querySelector('[data-bord-imprimer]'), enregistrer: !!f.querySelector('[data-bord-enregistrer][download]'), deplacer: !!f.querySelector('[data-tampon-deplacer]') }; });
    dit(pret && feuille && !feuille.emoji && feuille.imprimer && feuille.enregistrer && feuille.deplacer, `${nom} : S4 « Bordereau prêt » : l'aperçu réel dessiné, aucun émoji, Imprimer · Enregistrer · Déplacer le tampon`, JSON.stringify(feuille && { ...feuille, texte: feuille.texte.slice(0, 160) }));
    await shot(pg, `${vue}-un-pret`);
    const n0 = await pg.evaluate(() => window.__ouvertures.length);
    await toucher(o, '[data-bord-pret] [data-bord-imprimer]');
    await attendre(pg, (n) => window.__ouvertures.length > n || !!document.querySelector('[data-visionneuse-cadre]'), n0, 10000);
    const ouv = await pg.evaluate(() => window.__ouvertures.map((x) => ({ voie: x.voie, geste: x.geste, pdf: !!(x.blob && x.blob.type === 'application/pdf') })));
    const vis = await pg.evaluate(() => !!document.querySelector('[data-visionneuse-cadre]'));
    if (tactile) dit(ouv.length > n0 && ouv[ouv.length - 1].voie === 'partage' && ouv[ouv.length - 1].geste === 'click' && ouv[ouv.length - 1].pdf, `${nom} : S5 « Imprimer » ouvre la feuille de partage AVEC le PDF, dans le geste`, JSON.stringify(ouv));
    else dit(vis || ouv.length > n0, `${nom} : S5 « Imprimer » ouvre le PDF (visionneuse)`, JSON.stringify({ vis, ouv }));
    dit((await deborde(pg)) <= 1, `${nom} : S rien ne déborde`);
    dit(o.errs.length === 0, `${nom} : S aucune erreur d'app`, o.errs.join(' | ').slice(0, 300));
  } catch (e) { dit(false, `${nom} : S s'exécute`, String(e.message).slice(0, 300)); await shot(pg, `${vue}-un-erreur`); }
  await o.ctx.close();
}

async function editeur(b, vue) {
  const tactile = vue === '390', nom = `${vue}${tactile ? ' tactile' : ''}`;
  const LIGNES = await donnees();
  const o = await ouvrir(b, { tactile, LIGNES, url: '/?tab=settings&reglage=imprimante' });
  const { pg } = o;
  try {
    // Les vignettes se dessinent quand elles arrivent à l'écran : on fait défiler la galerie, une par une.
    await pg.waitForSelector('[data-tampons-galerie]', { timeout: 60000 }).catch(() => {});
    for (const id of ['mondialrelay', 'relaiscolis', 'chronopost', 'colissimo', 'vintedgo', 'ups', 'dpd', 'international', 'leboncoin', 'vestiaire', 'retour']) {
      await pg.locator(`[data-tampons-vignette="${id}"]`).scrollIntoViewIfNeeded().catch(() => {});
      await attendre(pg, (i) => { const e = document.querySelector(`[data-tampons-vignette="${i}"]`); return e && e.getAttribute('data-etat') !== 'charge'; }, id, 60000);
    }
    const g = await attendre(pg, () => document.querySelectorAll('[data-tampons-vignette][data-etat="ok"]').length >= 11, null, 20000);
    const ids = await pg.evaluate(() => [...document.querySelectorAll('[data-tampons-vignette]')].map((e) => e.getAttribute('data-tampons-vignette') + ':' + e.getAttribute('data-etat')));
    dit(g, `${nom} : E1 la galerie : chaque type dessiné par le vrai code`, ids.join(' '));
    await pg.locator('[data-tampons-galerie]').scrollIntoViewIfNeeded();
    await shot(pg, `${vue}-galerie`);
    await toucher(o, '[data-tampons-vignette="mondialrelay"]');
    await attendre(pg, () => !!document.querySelector('[data-tampons-editeur="mondialrelay"] [data-tampons-scene][data-pret="1"] [data-tampon-el="n"]'), null, 40000);
    const cle = await pg.evaluate(() => document.querySelector('[data-tampons-editeur]').getAttribute('data-cle'));
    const ppt = await pg.evaluate(() => +document.querySelector('[data-tampons-editeur] [data-tampons-scene]').getAttribute('data-ppt'));
    await shot(pg, `${vue}-editeur`);
    await glisser(o, '[data-tampons-editeur] [data-tampon-el="n"]', Math.round(60 * ppt), Math.round(-50 * ppt));
    const garde = await attendre(pg, (c) => { try { const t = JSON.parse(localStorage.getItem('vrm_tampons') || 'null'); return !!(t && t.formes && t.formes[c] && t.formes[c].n); } catch (_) { return false; } }, cle, 10000);
    dit(garde, `${nom} : E1 le N° glissé ⇒ la place est enregistrée pour la forme (${cle})`);
    await attendre(pg, () => document.querySelector('[data-tampons-editeur]').getAttribute('data-etat') === 'ok', null, 30000);
    await pg.locator('[data-tampons-editeur] [data-tampon-el="m"]').scrollIntoViewIfNeeded();
    const zq = await pg.evaluate(() => { const e = document.querySelector('[data-tampons-editeur] [data-tampon-interdit="qr"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const bm = await pg.locator('[data-tampons-editeur] [data-tampon-el="m"]').boundingBox();
    if (zq && bm) {
      await glisser(o, '[data-tampons-editeur] [data-tampon-el="m"]', zq.x - (bm.x + Math.min(bm.width / 2, 12)), zq.y - (bm.y + bm.height / 2));
      dit(await attendre(pg, () => !!document.querySelector('[data-tampons-editeur] [data-tampons-refus="qr"]'), null, 5000), `${nom} : E1 la mention glissée sur le QR ⇒ « Refusé : ça recouvrirait le QR code »`);
      await shot(pg, `${vue}-editeur-refus`);
    } else dit(false, `${nom} : E1 la zone du QR est dessinée`);
    await toucher(o, '[data-tampons-editeur] [data-tampons-portee="mondialrelay"]');
    await toucher(o, '[data-tampons-editeur] [data-tampons-contenu="titre"]');
    const ex = await attendre(pg, () => { try { const t = JSON.parse(localStorage.getItem('vrm_tampons') || 'null'); return t && t.types && t.types.mondialrelay && t.types.mondialrelay.contenu && t.types.mondialrelay.contenu.titre === false; } catch (_) { return false; } }, null, 8000);
    dit(ex, `${nom} : E1 « Seulement Mondial Relay » + titre décoché ⇒ une exception pour ce type`);
    await toucher(o, '[data-tampons-editeur] [data-tampons-origine]');
    const orig = await attendre(pg, (c) => { try { const t = JSON.parse(localStorage.getItem('vrm_tampons') || 'null'); return t && !(t.types || {}).mondialrelay && !(t.formes || {})[c]; } catch (_) { return false; } }, cle, 8000);
    dit(orig, `${nom} : E1 « Revenir à l'origine » : exception et place ôtées`);
    await toucher(o, '[data-tampons-editeur] [data-tampons-fini]');
    dit((await deborde(pg)) <= 1, `${nom} : E1 rien ne déborde`);
    dit(o.errs.length === 0, `${nom} : E1 aucune erreur d'app`, o.errs.join(' | ').slice(0, 300));
  } catch (e) { dit(false, `${nom} : l'éditeur s'exécute`, String(e.message).slice(0, 300)); await shot(pg, `${vue}-editeur-erreur`); }
  await o.ctx.close();
}

(async () => {
  let b;
  try {
    srvPret = new Promise((r) => srv.listen(PORT, r));
    b = await lancer(PW, { executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const v of VUES) { if (!process.env.TA_SEUL || process.env.TA_SEUL.includes('P')) await apercu(b, v); if (!process.env.TA_SEUL || process.env.TA_SEUL.includes('S')) await unSeul(b, v); if (!process.env.TA_SEUL || process.env.TA_SEUL.includes('E')) await editeur(b, v); }
  } catch (e) { dit(false, 'le banc tourne', String(e.stack || e).slice(0, 300)); }
  try { await b.close(); } catch (_) {}
  srv.close();
  console.log(`\n${ko ? 'KO' : 'OK'} tampons-apercu : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
