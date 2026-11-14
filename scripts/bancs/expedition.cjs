// ════════════════════════════════════════════════════════════════════════════
// Banc : L'EXPÉDITION (14 nov., idées 151 152 153 163)
// ════════════════════════════════════════════════════════════════════════════
// Le vrai parcours RENDU (dist/), Ventes → À expédier, données INVENTÉES aux formes réelles (celles
// d'impression-simple.cjs ; chaque bordereau est le vrai PDF de test `bordereau-test.b64`).
//  T  (1512, clair) — l'IMPRIMANTE SIMULÉE : `navigator.usb` remplacé par une fausse Zebra qui garde
//     chaque octet reçu. Jumelage joué comme lui (« Imprimer sans fenêtre » ⇒ « Choisir mon
//     imprimante » ⇒ « Page d'essai » ⇒ « Oui, garder ») ; puis « Imprimer (N) » : AUCUNE fenêtre
//     (ni visionneuse, ni partage), les octets ZPL décodés : une étiquette par page du PDF tamponné,
//     203 dpi (largeur et hauteur de la page), et le tampon « N° x » de CHAQUE bordereau présent en
//     encre dans l'image envoyée, à la place où le PDF l'écrit.
//  U  (1512, sombre) — une fausse TSC déjà jumelée : « Imprimer » envoie du TSPL (SIZE / BITMAP / PRINT),
//     autant de PRINT que de pages.
//  F  (390 tactile, iPhone, sans WebUSB) — papier thermique : une ligne dit « pas dans ce navigateur »,
//     « Imprimer » ouvre le PDF comme avant (le partage, dans le geste), aucune erreur.
//  P  (1512) — l'en-tête SERVI (vercel.json) permet usb=(self) serial=(self) ; une page qui l'interdit
//     (Permissions-Policy simulée) ⇒ la ligne le dit, et le PDF s'ouvre.
//  S  (390 tactile et 1512, clair ET sombre) — le MODE SAMEDI : un seul bouton plein (Imprimer), les
//     colis à emballer (aucune case cochée d'office, une case = SON toucher), « Même acheteur »
//     (2 ventes au même identifiant Vinted parmi des pseudos proches : un groupe, pas plus) et
//     rapprochés après SON choix, consignes par plateforme, points de dépôt dans l'ordre du trajet
//     (vol d'oiseau depuis la ville réglée), heure limite lue chez Vinted ou « horaires inconnus ».
//  PARTOUT : aucune erreur d'app, rien ne déborde, cibles ≥ 44 px (tactile). Captures (SHOTS=dossier).
// Lancer : construire dist/, puis BANC_PORT=… node scripts/bancs/expedition.cjs   (EX_VUES=T,U,F,P,S390,S390-sombre,S1512,S1512-sombre)
'use strict';
const path = require('path');
const fs = require('fs'), http = require('http');
const { pathToFileURL } = require('url');
const { lancer } = require('./_navigateur.cjs');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const NM = path.join(__dirname, '..', '..', 'node_modules');
const PDFJS = fs.existsSync(path.join(NM, 'pdfjs-dist')) ? path.join(NM, 'pdfjs-dist') : '/opt/npm-tools/node_modules/pdfjs-dist';
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4631);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.EX_VUES ? process.env.EX_VUES.split(',') : ['T', 'U', 'F', 'P', 'S390', 'S390-sombre', 'S1512', 'S1512-sombre'];
const MAINTENANT = Date.now(), H = 3600000, J = 24 * H;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
// L'acheteur 777 achète DEUX paires (9301 et 9303) ; les autres ont des pseudos PROCHES et d'autres identifiants.
const V = [
  { tx: 9301, titre: 'Alpha Nike taille 42', suivi: '41234567', num: '21', acheteur: 777, pseudo: 'ana_b' },
  { tx: 9302, titre: 'Bravo Adidas taille 40', suivi: 'XW123456789TS', num: '22', acheteur: 778, pseudo: 'Ana_b' },
  { tx: 9303, titre: 'Charlie Asics taille 41', suivi: '42234567', num: '23', acheteur: 777, pseudo: 'ana_b' },
  { tx: 9304, titre: 'Delta Puma taille 39', suivi: 'XW223456789TS', num: '24', acheteur: 779, pseudo: 'ana_b ' },
];
const TEST_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const CANCALE = { lat: 48.676, lon: -1.852 };
// Les horaires que Vinted donne (`business_hours`) : tous les jours 09:00–12:00 puis 12:00–19:30.
const HEURES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => ({ weekday: d, label: d, hours: [{ opens_at_raw: '09:00', closes_at_raw: '12:00' }, { opens_at_raw: '12:00', closes_at_raw: '19:30' }] }));

async function pdfDeTest(code) {
  const { PDFDocument, StandardFonts } = require(path.join(NM, 'pdf-lib'));
  const d = await PDFDocument.load(Buffer.from(TEST_B64, 'base64'));
  const f = await d.embedFont(StandardFonts.Helvetica);
  d.getPages()[0].drawText('ETIQUETTE ' + code, { x: 40, y: 760, size: 14, font: f });
  return Buffer.from(await d.save()).toString('base64');
}
let _pdfjs = null;
const pdfjs = async () => _pdfjs || (_pdfjs = await import(pathToFileURL(path.join(PDFJS, 'legacy', 'build', 'pdf.mjs')).href));
// Les pages d'un PDF : taille (points), texte, et la place de chaque « N° x » (boîte en points, origine en haut).
async function lirePdf(b64) {
  const L = await pdfjs();
  const doc = await L.getDocument({ data: new Uint8Array(Buffer.from(b64, 'base64')), verbosity: 0 }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i); const v = p.getViewport({ scale: 1 });
    const items = (await p.getTextContent()).items;
    const nums = [];
    items.forEach((it, k) => {
      const s = String(it.str || ''); const suite = s + ' ' + String((items[k + 1] || {}).str || '');
      const m = /^N°\s*(\d+)/.exec(s) || (/^N°\s*$/.test(s) ? /^N°\s*(\d+)/.exec(suite.replace(/\s+/, '')) : null);
      if (!m) return;
      const t = it.transform; const taille = Math.hypot(t[2], t[3]) || it.height || 10;
      const [x, y] = v.convertToViewportPoint(t[4], t[5]);
      nums.push({ num: m[1], x, y: y - taille, l: Math.max(it.width || 0, taille * 2.5), h: taille * 1.25 });
    });
    out.push({ w: v.width, h: v.height, texte: items.map((x) => x.str).join(' ').replace(/\s+/g, ' '), nums });
  }
  return out;
}
// Les étiquettes ZPL reçues par la fausse imprimante ⇒ [{ pw, ll, rb, bits }].
const etiquettesZpl = (buf) => {
  const s = buf.toString('latin1'); const out = [];
  const re = /\^XA\^PW(\d+)\^LL(\d+)\^LH0,0\^FO0,0\^GFA,(\d+),(\d+),(\d+),([0-9A-F]+)\^FS\^PQ1\^XZ/g; let m;
  while ((m = re.exec(s))) out.push({ pw: +m[1], ll: +m[2], total: +m[3], rb: +m[5], bits: Buffer.from(m[6], 'hex') });
  return out;
};
const encre = (e, { x, y, l, h }) => { let n = 0, tot = 0; for (let j = Math.max(0, Math.floor(y)); j < Math.min(e.ll, Math.ceil(y + h)); j++) for (let i = Math.max(0, Math.floor(x)); i < Math.min(e.rb * 8, Math.ceil(x + l)); i++) { tot++; if (e.bits[j * e.rb + (i >> 3)] & (0x80 >> (i & 7))) n++; } return { n, tot }; };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = f.startsWith('/__pdfjs/') ? path.join(PDFJS, 'build', path.basename(f)) : path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
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
    { id: 'main', data: { vinted_used_numeros: [21, 22, 23, 24], vinted_annonce_numeros: Object.fromEntries(V.map((v) => [`i${v.tx}`, { numero: v.num, title: v.titre, auto: false, numberedAt: ilYaH(200) }])) } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: V.map((v, i) => ({ transaction_id: v.tx, title: v.titre, price: { amount: '50', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: ilYaH(20 + i) })) } } },
    // La FORME mesurée du détail de transaction (14 nov.) : `user_side`, `buyer_id`, `buyer.login`, `items_count`.
    ...V.map((v) => ({ id: `harvest_111_txn_${v.tx}`, data: { capturedAt: ilYaH(1), payload: { transaction: { id: v.tx, item_id: `i${v.tx}`, user_side: 'seller', buyer_id: v.acheteur, buyer: { id: v.acheteur, login: v.pseudo }, items_count: 1 } } } })),
    ...await Promise.all(V.map(async (v) => ({ id: 'email_bord_' + v.tx, data: { transaction: String(v.tx), uid: '111', filename: `bordereau-${v.tx}.pdf`, modele: v.titre, article: v.titre, receivedAt: ilYaH(2), pdfB64: await pdfDeTest(String(v.tx)), suivi: v.suivi } }))),
    // Les points de dépôt que Vinted liste (forme mesurée : `nearby_drop_off_points`, `business_hours`).
    { id: 'harvest_111_pickup_points', data: { capturedAt: ilYaH(3), payload: { nearby_drop_off_points: { carrier: { name: 'Mondial Relay' }, drop_off_points: [
      { code: 'MR-LOIN', name: 'Tabac de la Houle', drop_off_point_address: '12 Quai Gambetta, 35260 Cancale', distance: 2.1, distance_unit: 'km', latitude: 48.672, longitude: -1.840, business_hours: HEURES, opening_status: { text: 'Lundi 09:00–19:30' } },
      { code: 'MR-PRES', name: 'Épicerie du Bourg', drop_off_point_address: '3 Place de l’Église, 35260 Cancale', distance: 0.2, distance_unit: 'km', latitude: 48.6762, longitude: -1.8515, opening_status: { text: '' } },
    ] } } } },
  ];
}

const FAUSSE_IMPRIMANTE = ({ vendorId, nom, produit }) => {
  window.__usb = []; window.__usbDemandes = 0; window.__usbAutorise = !!window.__usbDejaAutorisee;
  const dev = { vendorId, productId: 0x0100, serialNumber: 'BANC1', manufacturerName: nom, productName: produit, opened: false, configuration: null,
    async open() { this.opened = true; }, async close() { this.opened = false; },
    async selectConfiguration() { this.configuration = { interfaces: [{ interfaceNumber: 0, claimed: false, alternates: [{ alternateSetting: 0, interfaceClass: 7, endpoints: [{ endpointNumber: 2, direction: 'in', type: 'bulk' }, { endpointNumber: 1, direction: 'out', type: 'bulk' }] }] }] }; },
    async claimInterface() { this.configuration.interfaces[0].claimed = true; }, async releaseInterface() { this.configuration.interfaces[0].claimed = false; },
    async transferOut(ep, data) { const u = new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)); window.__usb.push({ ep, u }); return { status: 'ok', bytesWritten: u.length }; } };
  Object.defineProperty(navigator, 'usb', { configurable: true, value: { requestDevice: async (o) => { window.__usbDemandes++; window.__usbFiltres = o && o.filters; window.__usbAutorise = true; return dev; }, getDevices: async () => (window.__usbAutorise ? [dev] : []) } });
};

async function ouvrir(b, { tactile, sombre = false, imprimante = null, LIGNES, init = null, initArg = null, jumelage = null, ville = 'Cancale', url = '?tab=cat_bord' }) {
  const vue = tactile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: IPHONE } : { viewport: { width: 1512, height: 950 } };
  const ctx = await b.newContext({ ...vue, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const mainData = LIGNES.find((r) => r.id === 'main').data;
  await pg.addInitScript(({ m, sombre: s, impr, jum, ville: vi }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', 'true'); localStorage.setItem('vinted_dark', JSON.stringify(s));
      if (!sessionStorage.getItem('banc_init')) {
        sessionStorage.setItem('banc_init', '1');
        localStorage.setItem('vinted_annonce_numeros', JSON.stringify(m.vinted_annonce_numeros)); localStorage.setItem('vinted_used_numeros', JSON.stringify(m.vinted_used_numeros));
        if (impr) localStorage.setItem('vrm_imprimante', JSON.stringify(impr)); else localStorage.removeItem('vrm_imprimante');
        if (jum) { localStorage.setItem('vrm_imprimante_directe', JSON.stringify(jum)); window.__usbDejaAutorisee = true; }
        if (vi) localStorage.setItem('vrm_ville', JSON.stringify(vi));
      }
    } catch (_) {}
    window.__ouvertures = []; window.__pdfs = [];
    const o = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { const u = o(blob); try { if (blob && blob.type === 'application/pdf') window.__pdfs.push({ u, blob }); } catch (_) {} return u; };
    const geste = () => (window.event && /^(click|pointerup|touchend|keydown|keyup|mouseup)$/.test(window.event.type)) ? window.event.type : '';
    try { Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d) => !!(d && d.files && d.files.length) }); } catch (_) {}
    try { Object.defineProperty(navigator, 'share', { configurable: true, value: (d) => { window.__ouvertures.push({ voie: 'partage', geste: geste(), blob: d && d.files && d.files[0] }); return Promise.resolve(); } }); } catch (_) {}
    window.open = (u) => { window.__ouvertures.push({ voie: 'onglet', geste: geste(), url: String(u) }); return null; };
    window.print = () => {};
  }, { m: mainData, sombre, impr: imprimante, jum: jumelage, ville });
  if (init) await pg.addInitScript(init, initArg);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**://cdn.jsdelivr.net/npm/pdfjs-dist@*/**', (r) => {
    const n = path.basename(new URL(r.request().url()).pathname);
    const f = path.join(PDFJS, 'build', n.replace(/\.js$/, '.mjs'));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(f) });
  });
  await pg.addInitScript((port) => { import(`http://localhost:${port}/__pdfjs/pdf.min.mjs`).then((m) => { m.GlobalWorkerOptions.workerSrc = `http://localhost:${port}/__pdfjs/pdf.worker.min.mjs`; window.pdfjsLib = { ...m, GlobalWorkerOptions: { workerSrc: '' }, getDocument: (o) => { const t = m.getDocument(o); return { promise: t.promise.then((d) => { if (typeof d.destroy !== 'function') d.destroy = () => t.destroy(); return d; }), destroy: () => t.destroy() }; } }; }).catch(() => {}); }, PORT);
  // La Base Adresse Nationale : la ville réglée (Cancale) seulement.
  await pg.route('**://api-adresse.data.gouv.fr/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(/q=Cancale/i.test(r.request().url()) ? { features: [{ geometry: { coordinates: [CANCALE.lon, CANCALE.lat] }, properties: { score: 0.97, city: 'Cancale' } }] } : { features: [] }) }));
  const lus = []; pg.__lus = lus;
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    lus.push(u);
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
  await pg.goto(`http://localhost:${PORT}/${url}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction((n) => { const t = document.body.innerText; return n.every((x) => t.includes('N°' + x)); }, V.map((v) => v.num), { timeout: 45000 }).catch(() => {});
  return { ctx, pg, errs, tactile };
}
let nShot = 0;
const shot = async (pg, nom) => { if (SHOTS) { try { await pg.screenshot({ path: path.join(SHOTS, `expedition-${String(++nShot).padStart(2, '0')}-${nom}.png`), timeout: 60000 }); } catch (_) {} } };
const toucher = async (o, sel) => { const l = o.pg.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 15000 }); if (o.tactile) await l.tap(); else await l.click(); };
const attendre = (pg, f, arg, ms = 20000) => pg.waitForFunction(f, arg, { timeout: ms }).then(() => true).catch(() => false);
const deborde = (pg, sel = null) => pg.evaluate((s) => { const e = s ? document.querySelector(s) : document.documentElement; return e ? e.scrollWidth - e.clientWidth : 0; }, sel);
const petitesDans = (pg, racine) => pg.evaluate((r) => [...document.querySelectorAll(`${r} button, ${r} a`)].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !e.disabled; }).map((e) => ({ q: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) })).filter((x) => x.h < 44 || x.w < 44), racine);
const octetsUsb = async (pg, depuis = 0) => Buffer.from(await pg.evaluate((d) => { const L = window.__usb.slice(d); let n = 0; for (const x of L) n += x.u.length; const out = new Uint8Array(n); let o = 0; for (const x of L) { out.set(x.u, o); o += x.u.length; } let s = ''; for (let i = 0; i < out.length; i += 8192) s += String.fromCharCode.apply(null, out.subarray(i, i + 8192)); return btoa(s); }, depuis), 'base64');
const dernierPdf = (pg) => pg.evaluate(async () => { const x = window.__pdfs[window.__pdfs.length - 1]; if (!x) return null; const u = new Uint8Array(await x.blob.arrayBuffer()); let s = ''; for (let j = 0; j < u.length; j += 8192) s += String.fromCharCode.apply(null, u.subarray(j, j + 8192)); return btoa(s); });
const ouvertures = (pg) => pg.evaluate(() => window.__ouvertures.map((x) => ({ voie: x.voie, geste: x.geste })));

// ── T · la fausse Zebra : jumelage joué, puis « Imprimer » en ZPL ─────────────
async function scenarioT(b) {
  const nom = '1512-zebra';
  const LIGNES = await donnees();
  const o = await ouvrir(b, { tactile: false, imprimante: 'thermique', LIGNES, init: FAUSSE_IMPRIMANTE, initArg: { vendorId: 0x0a5f, nom: 'Zebra Technologies', produit: 'ZTC ZD420-203dpi ZPL' } });
  const { pg } = o;
  try {
    const pret = await attendre(pg, () => { const e = document.querySelector('[data-impr-lot]'); return e && e.getAttribute('data-impr-pret') === '1'; }, null, 45000);
    const lien = await pg.evaluate(() => { const e = document.querySelector('[data-impr-directe]'); return e ? e.getAttribute('data-impr-directe') : null; });
    dit(pret && lien === 'jumeler', `${nom} : T1 papier thermique + WebUSB : « Imprimer sans fenêtre » à côté du papier`, JSON.stringify({ pret, lien }));
    await shot(pg, `${nom}-ecran`);
    await toucher(o, '[data-impr-directe]');
    await attendre(pg, () => !!document.querySelector('[data-impr-jumelage="depart"]'), null, 5000);
    await shot(pg, `${nom}-jumelage`);
    await toucher(o, '[data-impr-choisir="usb"]');
    const essai = await attendre(pg, () => !!document.querySelector('[data-impr-jumelage="essai"]'), null, 5000);
    const fiche = await pg.evaluate(() => { const e = document.querySelector('[data-impr-fiche-langage]'); return e ? { nom: e.getAttribute('data-impr-fiche-nom'), langage: e.getAttribute('data-impr-fiche-langage'), filtres: window.__usbFiltres, n: window.__usbDemandes } : null; });
    dit(essai && fiche && fiche.langage === 'zpl' && /Zebra/.test(fiche.nom) && fiche.n === 1 && JSON.stringify(fiche.filtres).includes('"classCode":7'), `${nom} : T2 la fenêtre du navigateur (filtre « imprimante », classe 7) ⇒ Zebra reconnue, ZPL proposé`, JSON.stringify(fiche));
    await toucher(o, '[data-impr-essai]');
    await attendre(pg, () => !!document.querySelector('[data-impr-jumelage="question"]'), null, 15000);
    const e0 = etiquettesZpl(await octetsUsb(pg));
    dit(e0.length === 1 && e0[0].pw === 800 && e0[0].ll === 1200 && e0[0].bits.length === e0[0].total, `${nom} : T3 la page d'essai : UNE étiquette ZPL 800 × 1200 points (100 × 150 mm à 203 dpi)`, JSON.stringify(e0.map((e) => [e.pw, e.ll, e.total])));
    const avant = await pg.evaluate(() => localStorage.getItem('vrm_imprimante_directe'));
    await shot(pg, `${nom}-essai`);
    await toucher(o, '[data-impr-essai-oui]');
    await attendre(pg, () => !!document.querySelector('[data-impr-jumelage="retenue"]'), null, 5000);
    const garde = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_imprimante_directe')); } catch (_) { return null; } });
    dit(!avant && garde && garde.langage === 'zpl' && garde.vendorId === 0x0a5f && garde.essaiOk === true, `${nom} : T4 rien n'est retenu avant SON « Oui » ; après : retenue (sur cet appareil)`, JSON.stringify({ avant, garde }));
    await toucher(o, '[data-impr-fermer]');
    const n0 = await pg.evaluate(() => window.__usb.length);
    const lien2 = await pg.evaluate(() => { const e = document.querySelector('[data-impr-directe]'); return e ? e.getAttribute('data-impr-directe') : null; });
    await toucher(o, '[data-impr-lot]');
    const fini = await attendre(pg, (n) => window.__usb.length > n && !!document.querySelector('[data-impr-feuille="question"]'), n0, 30000);
    await pg.waitForTimeout(800);
    const buf = await octetsUsb(pg, n0);
    const ets = etiquettesZpl(buf);
    const ouv = await ouvertures(pg), vis = !!(await pg.$('[data-visionneuse-pdf]'));
    const voie = await pg.evaluate(() => { const f = document.querySelector('[data-impr-feuille]'); return f ? f.getAttribute('data-impr-voie') : null; });
    dit(fini && lien2 === 'jumelee' && voie === 'directe' && !ouv.length && !vis, `${nom} : T5 « Imprimer » : les étiquettes partent au câble, AUCUNE fenêtre (ni visionneuse, ni partage) ; « Tout est sorti ? » après`, JSON.stringify({ fini, lien2, voie, ouv, vis }));
    const b64 = await dernierPdf(pg);
    const pages = b64 ? await lirePdf(b64) : [];
    const dots = (pt) => Math.round(pt / 72 * 203);
    dit(ets.length > 0 && ets.length === pages.length && ets.every((e, i) => Math.abs(e.ll - dots(pages[i].h)) <= 1 && Math.abs(e.rb * 8 - Math.ceil(dots(pages[i].w) / 8) * 8) <= 8), `${nom} : T6 une étiquette par page du PDF tamponné, à sa taille (203 dpi)`, JSON.stringify({ etiquettes: ets.map((e) => [e.rb * 8, e.ll]), pages: pages.map((p) => [Math.round(p.w), Math.round(p.h)]) }));
    const codes = pages.map((p) => (/ETIQUETTE (\d+)/.exec(p.texte) || [])[1]).filter(Boolean);
    dit(new Set(codes).size === 4, `${nom} : T7 les 4 bordereaux sont dans le lot envoyé`, JSON.stringify(codes));
    // Le tampon : chaque « N° x » écrit dans le PDF est de l'encre dans l'image envoyée, à SA place.
    const attendus = Object.fromEntries(V.map((v) => [String(v.tx), v.num]));
    const tampons = [];
    pages.forEach((p, i) => { const sc = (ets[i] ? ets[i].rb * 8 : 0) && dots(p.w) / p.w; for (const n of p.nums) { const r = encre(ets[i], { x: n.x * sc - 3, y: n.y * sc - 3, l: n.l * sc + 6, h: n.h * sc + 6 }); tampons.push({ page: i + 1, num: n.num, n: r.n, part: r.tot ? Math.round(100 * r.n / r.tot) : 0 }); } });
    const parBord = V.map((v) => ({ num: v.num, vu: tampons.some((t) => t.num === v.num && t.n >= 25 && t.part >= 3) }));
    dit(parBord.every((x) => x.vu) && pages.every((p) => !p.nums.some((n) => !Object.values(attendus).includes(n.num))), `${nom} : T8 le tampon du N° de CHAQUE bordereau est dans l'image envoyée (encre à sa place) — et aucun autre N°`, JSON.stringify(tampons.slice(0, 8)));
    await shot(pg, `${nom}-apres`);
    dit(o.errs.length === 0, `${nom} : aucune erreur d'app`, o.errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${nom} : le scénario T s'exécute`, String(e.message).slice(0, 200)); await shot(pg, `${nom}-erreur`); }
  await o.ctx.close();
}

// ── U · une fausse TSC déjà jumelée : TSPL ───────────────────────────────────
async function scenarioU(b) {
  const nom = '1512-sombre-tsc';
  const LIGNES = await donnees();
  const jumelage = { voie: 'usb', vendorId: 0x1203, productId: 0x0100, serie: 'BANC1', nom: 'TSC TE200', langage: 'tspl', essaiOk: true, at: 1 };
  const o = await ouvrir(b, { tactile: false, sombre: true, imprimante: 'thermique', LIGNES, jumelage, init: FAUSSE_IMPRIMANTE, initArg: { vendorId: 0x1203, nom: 'TSC', produit: 'TE200' } });
  const { pg } = o;
  try {
    await attendre(pg, () => { const e = document.querySelector('[data-impr-lot]'); return e && e.getAttribute('data-impr-pret') === '1'; }, null, 45000);
    const lien = await pg.evaluate(() => { const e = document.querySelector('[data-impr-directe]'); return e ? [e.getAttribute('data-impr-directe'), e.textContent] : null; });
    await toucher(o, '[data-impr-lot]');
    const fini = await attendre(pg, () => window.__usb.length > 0 && !!document.querySelector('[data-impr-feuille="question"]'), null, 30000);
    await pg.waitForTimeout(800);
    const s = (await octetsUsb(pg)).toString('latin1');
    const b64 = await dernierPdf(pg); const pages = b64 ? await lirePdf(b64) : [];
    const n = (s.match(/\r\nPRINT 1,1\r\n/g) || []).length, sizes = (s.match(/SIZE \d+ mm,\d+ mm/g) || []);
    dit(fini && lien && lien[0] === 'jumelee' && /TSC/.test(lien[1]) && n === pages.length && n > 0 && sizes.length === n && /BITMAP 0,0,\d+,\d+,0,/.test(s) && !(await ouvertures(pg)).length, `${nom} : U1 TSC jumelée : TSPL (SIZE / BITMAP / PRINT), ${n} étiquette(s) pour ${pages.length} page(s), aucune fenêtre`, JSON.stringify({ fini, lien, n, sizes: sizes.slice(0, 2) }));
    await shot(pg, `${nom}-apres`);
    dit(o.errs.length === 0, `${nom} : aucune erreur d'app`, o.errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${nom} : le scénario U s'exécute`, String(e.message).slice(0, 200)); await shot(pg, `${nom}-erreur`); }
  await o.ctx.close();
}

// ── F · iPhone, sans WebUSB : le PDF comme avant ──────────────────────────────
async function scenarioF(b) {
  const nom = '390-sans-webusb';
  const LIGNES = await donnees();
  const o = await ouvrir(b, { tactile: true, imprimante: 'thermique', LIGNES, init: () => { try { delete Navigator.prototype.usb; delete Navigator.prototype.serial; } catch (_) {} try { Object.defineProperty(navigator, 'usb', { configurable: true, value: undefined }); Object.defineProperty(navigator, 'serial', { configurable: true, value: undefined }); } catch (_) {} } });
  const { pg } = o;
  try {
    await attendre(pg, () => { const e = document.querySelector('[data-impr-lot]'); return e && e.getAttribute('data-impr-pret') === '1'; }, null, 45000);
    const ligne = await pg.evaluate(() => { const e = document.querySelector('[data-impr-directe]'); return e ? { etat: e.getAttribute('data-impr-directe'), raison: e.getAttribute('data-impr-directe-raison'), bouton: e.tagName === 'BUTTON', t: e.textContent } : null; });
    dit(ligne && ligne.etat === 'indispo' && ligne.raison === 'navigateur' && !ligne.bouton, `${nom} : F1 sans WebUSB : une LIGNE (pas un bouton) dit que le PDF s'ouvre`, JSON.stringify(ligne));
    await shot(pg, `${nom}-ecran`);
    await toucher(o, '[data-impr-lot]');
    await attendre(pg, () => window.__ouvertures.length > 0, null, 8000);
    const ouv = await ouvertures(pg);
    dit(ouv.length === 1 && ouv[0].voie === 'partage' && ouv[0].geste === 'click', `${nom} : F2 « Imprimer » ouvre le PDF comme avant (le partage, dans le geste)`, JSON.stringify(ouv));
    dit(o.errs.length === 0, `${nom} : aucune erreur d'app`, o.errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${nom} : le scénario F s'exécute`, String(e.message).slice(0, 200)); await shot(pg, `${nom}-erreur`); }
  await o.ctx.close();
}

// ── P · l'en-tête servi, et une page qui interdit WebUSB ─────────────────────
async function scenarioP(b) {
  const nom = '1512-politique';
  const V2 = require('./_vercel.cjs');
  const e = V2.entetesPour('/', { brut: true });
  const pp = String((Object.entries(e).find(([k]) => k.toLowerCase() === 'permissions-policy') || [])[1] || '');
  dit(/(^|,\s*)usb=\(self\)(\s*,|$)/.test(pp) && /(^|,\s*)serial=\(self\)(\s*,|$)/.test(pp) && /bluetooth=\(\)/.test(pp) && /hid=\(\)/.test(pp), `${nom} : P1 l'en-tête SERVI (vercel.json) : usb=(self), serial=(self) — bluetooth et hid restent fermés`, pp);
  const LIGNES = await donnees();
  const o = await ouvrir(b, { tactile: false, imprimante: 'thermique', LIGNES, init: FAUSSE_IMPRIMANTE, initArg: { vendorId: 0x0a5f, nom: 'Zebra', produit: 'ZD' } });
  const { pg } = o;
  await pg.addInitScript(() => { const faux = { allowsFeature: (f) => !(f === 'usb' || f === 'serial') }; try { Object.defineProperty(Document.prototype, 'permissionsPolicy', { configurable: true, get: () => faux }); Object.defineProperty(Document.prototype, 'featurePolicy', { configurable: true, get: () => faux }); } catch (_) {} });
  try {
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await attendre(pg, () => { const e = document.querySelector('[data-impr-lot]'); return e && e.getAttribute('data-impr-pret') === '1'; }, null, 45000);
    const ligne = await pg.evaluate(() => { const e = document.querySelector('[data-impr-directe]'); return e ? { etat: e.getAttribute('data-impr-directe'), raison: e.getAttribute('data-impr-directe-raison') } : null; });
    dit(ligne && ligne.etat === 'indispo' && ligne.raison === 'politique', `${nom} : P2 page qui interdit WebUSB (Permissions-Policy) : la ligne le DIT`, JSON.stringify(ligne));
    await toucher(o, '[data-impr-lot]');
    const vis = await attendre(pg, () => !!document.querySelector('[data-visionneuse-pdf="pret"]'), null, 8000);
    dit(vis && !(await pg.evaluate(() => window.__usb.length)), `${nom} : P3 … et le PDF s'ouvre (visionneuse), rien n'est envoyé au câble`);
    dit(o.errs.length === 0, `${nom} : aucune erreur d'app`, o.errs.join(' | ').slice(0, 200));
  } catch (err) { dit(false, `${nom} : le scénario P s'exécute`, String(err.message).slice(0, 200)); await shot(pg, `${nom}-erreur`); }
  await o.ctx.close();
}

// ── S · le mode samedi ───────────────────────────────────────────────────────
async function scenarioS(b, nom, { tactile, sombre }) {
  const LIGNES = await donnees();
  const o = await ouvrir(b, { tactile, sombre, imprimante: 'normale', LIGNES });
  const { pg } = o;
  try {
    // Même acheteur : un groupe (9301 + 9303, identifiant 777), jamais les pseudos proches.
    const g = await attendre(pg, () => !!document.querySelector('[data-meme-groupe]'), null, 30000);
    const groupes = await pg.evaluate(() => [...document.querySelectorAll('[data-meme-groupe]')].map((e) => ({ n: e.getAttribute('data-meme-n'), colis: [...e.querySelectorAll('[data-meme-colis]')].map((x) => x.getAttribute('data-meme-colis')) })));
    dit(g && groupes.length === 1 && groupes[0].n === '2' && JSON.stringify(groupes[0].colis.sort()) === '["v:9301","v:9303"]', `${nom} : S1 « Même acheteur » : UN groupe (même identifiant Vinted, même compte) ; « Ana_b », « ana_b␠ » (autres identifiants) jamais regroupés`, JSON.stringify(groupes));
    const lus = pg.__lus.filter((u) => /_txn_9301/.test(u) && /buyer_id/.test(u));
    dit(lus.length >= 1 && lus.every((u) => !/select=data(,|&|$)/.test(u)), `${nom} : S2 les identités sont lues PROJETÉES (jamais select=data)`, lus[0] && lus[0].slice(-160));
    const honnete = await pg.evaluate(() => (document.querySelector('[data-meme-groupe]') || {}).innerText || '');
    dit(/un bordereau par vente/i.test(honnete) && /2 bordereaux restent 2 colis/.test(honnete), `${nom} : S3 le bandeau dit honnêtement : deux bordereaux restent deux colis`, honnete.replace(/\s+/g, ' ').slice(0, 160));
    await shot(pg, `${nom}-colis`);
    await toucher(o, '[data-samedi-ouvrir]');
    await attendre(pg, () => !!document.querySelector('[data-mode-samedi]'), null, 8000);
    await attendre(pg, () => document.querySelectorAll('[data-samedi-point]').length > 0 && !!document.querySelector('[data-samedi-depart="ok"]'), null, 15000);
    await pg.waitForTimeout(600);
    const avant = await pg.evaluate(() => ({ ordre: [...document.querySelectorAll('[data-samedi-colis]')].map((e) => e.getAttribute('data-samedi-colis')), coches: document.querySelectorAll('[data-samedi-emballe="1"]').length, pleins: [...document.querySelectorAll('[data-mode-samedi] .sb-btn-plein')].filter((e) => e.getBoundingClientRect().width > 0).length }));
    dit(avant.ordre.length === 4 && avant.coches === 0, `${nom} : S4 les 4 colis à emballer, AUCUNE case cochée d'office`, JSON.stringify(avant));
    dit(avant.pleins === 1, `${nom} : S5 UN seul bouton plein (Imprimer)`, String(avant.pleins));
    const pts = await pg.evaluate(() => [...document.querySelectorAll('[data-samedi-point]')].map((e) => ({ cle: e.getAttribute('data-samedi-point'), rang: +e.getAttribute('data-samedi-rang'), heure: e.getAttribute('data-samedi-heure'), km: e.getAttribute('data-samedi-km'), nom: (e.querySelector('.vrm-samedi-point-nom') || {}).textContent, colis: e.querySelectorAll('[data-samedi-depot]').length })));
    const mr = pts.find((p) => p.cle === 'depot:mondialrelay');
    dit(mr && /Épicerie du Bourg/.test(mr.nom) && pts.every((p, i) => p.rang === i + 1), `${nom} : S6 trajet : le point Mondial Relay le PLUS PROCHE de la ville (Épicerie du Bourg, pas le tabac à 2 km) ; rangs dans l'ordre`, JSON.stringify(pts));
    dit(mr && mr.heure === 'inconnu' && pts.filter((p) => p.cle !== 'depot:mondialrelay').every((p) => ['inconnu', 'ouvert', 'passe', 'ferme'].includes(p.heure)), `${nom} : S7 heure limite : le point sans horaires lus ⇒ « horaires inconnus » (jamais inventée)`, JSON.stringify(pts.map((p) => [p.cle, p.heure])));
    dit(pts.reduce((n, p) => n + p.colis, 0) === 4, `${nom} : S8 chaque colis est à UN point de dépôt (4 au total)`);
    const cons = await pg.evaluate(() => [...document.querySelectorAll('[data-consignes]')].map((e) => e.getAttribute('data-consignes')));
    dit(cons.length === 1 && cons[0] === 'vinted', `${nom} : S9 « Ce que demande Vinted » UNE fois, en tête du groupe (pas sur chaque ligne)`, JSON.stringify(cons));
    await toucher(o, '[data-consignes="vinted"] button');
    const lignesC = await pg.evaluate(() => [...document.querySelectorAll('[data-consignes="vinted"] li')].map((e) => e.textContent));
    dit(lignesC.length === 4 && lignesC.some((t) => /bordereau Vinted/.test(t)), `${nom} : S10 les consignes s'ouvrent d'un toucher (bordereau, emballage, dépôt, délai)`, JSON.stringify(lignesC).slice(0, 200));
    await shot(pg, `${nom}-samedi`);
    // Une case = SON toucher.
    await toucher(o, '[data-samedi-case="v:9302"]');
    const c1 = await pg.evaluate(() => ({ coches: [...document.querySelectorAll('[data-samedi-emballe="1"]')].map((e) => e.getAttribute('data-samedi-colis')), aria: document.querySelector('[data-samedi-case="v:9302"]').getAttribute('aria-checked') }));
    dit(JSON.stringify(c1.coches) === '["v:9302"]' && c1.aria === 'true', `${nom} : S11 toucher une case ⇒ CE colis seul coché`, JSON.stringify(c1));
    // Fermer, choisir « Préparer ensemble », rouvrir : 9301 et 9303 côte à côte, et le rappel à l'emballage.
    await toucher(o, '[data-samedi-fermer]');
    await attendre(pg, () => !document.querySelector('[data-mode-samedi]'), null, 5000);
    await toucher(o, '[data-meme-ensemble]');
    const presse = await pg.evaluate(() => document.querySelector('[data-meme-ensemble]').getAttribute('aria-pressed'));
    await toucher(o, '[data-samedi-ouvrir]');
    await attendre(pg, () => document.querySelectorAll('[data-samedi-colis]').length === 4, null, 8000);
    const apres = await pg.evaluate(() => ({ ordre: [...document.querySelectorAll('[data-samedi-colis]')].map((e) => e.getAttribute('data-samedi-colis')), rappels: [...document.querySelectorAll('[data-samedi-colis] [data-meme-rappel]')].map((e) => e.closest('[data-samedi-colis]').getAttribute('data-samedi-colis')), coches: [...document.querySelectorAll('[data-samedi-emballe="1"]')].map((e) => e.getAttribute('data-samedi-colis')) }));
    const i1 = apres.ordre.indexOf('v:9301'), i3 = apres.ordre.indexOf('v:9303');
    dit(presse === 'true' && Math.abs(i1 - i3) === 1 && Math.abs(avant.ordre.indexOf('v:9301') - avant.ordre.indexOf('v:9303')) > 1, `${nom} : S12 « Préparer ensemble » (SON toucher) ⇒ les deux colis du même acheteur côte à côte (avant : séparés)`, JSON.stringify({ avant: avant.ordre, apres: apres.ordre }));
    dit(JSON.stringify(apres.rappels.sort()) === '["v:9301","v:9303"]' && JSON.stringify(apres.coches) === '["v:9302"]', `${nom} : S13 le rappel à l'emballage sur ces deux-là seulement ; la case cochée est gardée pour la journée`, JSON.stringify(apres));
    await pg.waitForTimeout(400);
    await shot(pg, `${nom}-ensemble`);
    if (tactile) { const p44 = await petitesDans(pg, '[data-mode-samedi]'); dit(!p44.length, `${nom} : S14 cibles ≥ 44 px dans le mode samedi`, JSON.stringify(p44.slice(0, 5))); }
    dit((await deborde(pg)) <= 1 && (await deborde(pg, '.vrm-samedi-defile')) <= 1, `${nom} : rien ne déborde`);
    // Imprimer depuis le samedi : le parcours simple (le PDF au-dessus du samedi).
    await toucher(o, '[data-samedi-imprimer-btn]');
    const imp = tactile ? await attendre(pg, () => window.__ouvertures.length > 0, null, 10000) : await attendre(pg, () => !!document.querySelector('[data-visionneuse-pdf="pret"]'), null, 10000);
    const dessus = await pg.evaluate(() => { const v = document.querySelector('[data-visionneuse-pdf]') || document.querySelector('[data-impr-feuille]'); const s = document.querySelector('[data-mode-samedi]'); if (!v || !s) return null; const z = (e) => { let x = e, m = 0; while (x && x !== document.body) { const zz = parseInt(getComputedStyle(x).zIndex, 10); if (Number.isFinite(zz)) m = Math.max(m, zz); x = x.parentElement; } return m; }; return { v: z(v), s: z(s) }; });
    dit(imp && (!dessus || dessus.v > dessus.s), `${nom} : S15 « Imprimer » du samedi = le parcours simple (${tactile ? 'partage dans le geste' : 'visionneuse'}), AU-DESSUS du samedi`, JSON.stringify(dessus));
    await pg.waitForTimeout(500);
    await shot(pg, `${nom}-imprimer`);
    dit(o.errs.length === 0, `${nom} : aucune erreur d'app`, o.errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${nom} : le scénario S s'exécute`, String(e.message).slice(0, 200)); await shot(pg, `${nom}-erreur`); }
  await o.ctx.close();
}

let srvPret;
(async () => {
  let b;
  try {
    srvPret = new Promise((r) => srv.listen(PORT, r));
    b = await lancer(PW, { executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const v of VUES) {
      console.log('\n— ' + v);
      if (v === 'T') await scenarioT(b);
      else if (v === 'U') await scenarioU(b);
      else if (v === 'F') await scenarioF(b);
      else if (v === 'P') await scenarioP(b);
      else if (v === 'S390') await scenarioS(b, '390-samedi', { tactile: true, sombre: false });
      else if (v === 'S390-sombre') await scenarioS(b, '390-samedi-sombre', { tactile: true, sombre: true });
      else if (v === 'S1512') await scenarioS(b, '1512-samedi', { tactile: false, sombre: false });
      else if (v === 'S1512-sombre') await scenarioS(b, '1512-samedi-sombre', { tactile: false, sombre: true });
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.stack || e.message || e).slice(0, 300)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\nKO expedition : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK expedition : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
