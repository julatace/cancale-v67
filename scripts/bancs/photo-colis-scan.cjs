// Banc : VÉRIFICATION AU SCAN + PHOTO DU CARTON (lot AZ, fusionné avec le lot M « photos d'emballage ») — 10 nov.
// Julien (validé) : « quand il scanne un bordereau, la photo de la paire attendue et son N° EN TRÈS GRAND
// (impossible à rater, plein écran au téléphone) » ; puis « Photo du carton » facultative, rangée AVEC la
// vente (par n° de transaction), visible sur la fiche de la vente. Rien n'est publié vers Vinted.
// Données INVENTÉES (dépôt public) de la forme réelle : ventes Vinted à expédier (`orders_sold`, prix objet
// `{amount}`), bordereaux e-mail (`email_bord_{tx}`, champ `suivi`). Caméra et détecteur FAUX (comme
// scanner-colis-achats) ; la photo du carton est une capture d'écran du banc (aucune vraie photo).
// Exige (jugé sur data-*, tailles rendues et ce qui est ÉCRIT, §6.4) :
//  V1 le scan d'un n° ⇒ la feuille passe en vérification (`data-scan-verif`) : la photo de CETTE vente
//     (8 ventes au même titre) occupe la feuille (≥ 90 % de sa largeur, ≥ 35 % de la hauteur d'écran),
//     son N° en très grand (police ≥ 60 px), visibles, au-dessus de tout (rien ne les couvre) ;
//  V2 chaque n° ⇒ SA paire (photo b{k}, N° de SA fiche), jamais une autre au même titre ;
//  V3 deux ventes au même n° / n° inconnu ⇒ PAS de vérification, le message de toujours, aucun bouton ;
//  V4 rien n'est écrit au scan ; pas de « Photo du carton » avant « Colis fait » ;
//  P1 « C'est la bonne paire · Colis fait » ⇒ « Photo du carton » (facultatif, ≥ 44 px) pour CETTE vente ;
//  P2 la photo ⇒ UNE écriture `app_data` `colis_photo_v_{tx}` (JPEG compressé ≤ 480 Ko, tx de la vente) ;
//     aucune autre ligne ne reçoit d'image (ni `main`, ni une ligne lue souvent), rien vers un autre hôte ;
//  P3 relire le même bordereau pendant la photo ne remplace pas l'écran (« Annuler » et la photo restent) ;
//  P4 écriture refusée par la base ⇒ dit en ambre, jamais « rangée » ;
//  P5 l'aperçu de la photo rangée ⇒ LA visionneuse de l'app (une seule, lot AN), devant le scanner ;
//     Échap ferme la photo seule ;
//  F1 fiche de la vente : « Photo du carton » ⇒ « Voir » ⇒ la photo, lue par SON id, en projection
//     (`data->>b64`), jamais `select=data` ; une vente sans photo ⇒ « Ajouter » ; lecture ratée ⇒ « — » ;
//  E1 « Préparer mes colis » : après « Colis fait », le même geste, pour la vente de l'étape ;
//  PARTOUT : cibles ≥ 44 px, rien ne déborde, aucune erreur. Vues : 390 tactile et 1512, clair et sombre.
// Lancer : construire dist/, puis node scripts/bancs/photo-colis-scan.cjs   (BANC_PORT, SHOTS=dossier, PCS_VUES=390-clair,…)
const path = require('path');
let PW;
try { PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright')); }
catch (_) { PW = require('playwright'); }
const { lancer } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4491);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.PCS_VUES ? process.env.PCS_VUES.split(',') : null;
const MS = Date.now(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;

const TITRE = 'Nike Air Max 90 blanche';
const vente = (id, k) => ({ transaction_id: id, title: TITRE, size_title: '42', user_login: `acheteur_${k}`, price: { amount: '50', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: iso(MS - J - k * 60000), photo: { url: url(k) } });
const VENTES = Array.from({ length: 10 }, (_, k) => vente(9201 + k, k + 1));
const SUIVI = Object.fromEntries(VENTES.map((v, k) => [v.transaction_id, `XA${100000001 + k}FR`]));
SUIVI[9209] = 'XD555555555FR'; SUIVI[9210] = 'XD555555555FR';
const NUMS = Object.fromEntries(VENTES.map((v, k) => [String(v.transaction_id), { numero: String(31 + k) }]));
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const bord = (tx) => ({ id: 'email_bord_' + tx, data: { transaction: String(tx), uid: '111', filename: 'bordereau-' + tx + '.pdf', modele: TITRE, article: TITRE, receivedAt: iso(MS - 3600000), pdfB64: PDF_B64, suivi: SUIVI[tx] } });
const BASE_LIGNES = () => [
  ...VENTES.map((v) => bord(v.transaction_id)),
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS), payload: { my_orders: VENTES } } },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 220)); } };
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
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="${TEINTES[k % 6]}"/><path d="M90 470 C120 380 225 355 285 395 C345 430 430 400 495 440 C528 462 519 516 459 519 L126 519 C93 519 78 495 90 470 Z" fill="rgba(30,34,40,.62)"/><path d="M90 519 L495 519 L489 543 L99 543 Z" fill="rgba(255,255,255,.85)"/><text x="300" y="230" font-size="130" text-anchor="middle" fill="rgba(0,0,0,.35)" font-family="sans-serif">${k}</text></svg>`;

const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const LIGNES = BASE_LIGNES();
  const ecrits = [];          // { id, taille, image } : chaque ligne POSTée qui porte une image
  const lectures = [];        // chaque GET d'une ligne colis_photo_* (sa projection)
  const ailleurs = [];        // toute requête vers un AUTRE hôte qui porterait une image
  const panne = { ecrire: new Set(['colis_photo_v_9207']), lire: new Set(['colis_photo_v_9206']) };
  pg.on('request', (q) => {
    const u = q.url(), d = q.postData() || '';
    if (/\/rest\/v1\//.test(u) || /^http:\/\/localhost/.test(u)) return;
    if (/data:image|image\/(jpeg|png|webp)|\bblob:/i.test(d) || /multipart\/form-data/i.test(q.headers()['content-type'] || '')) ailleurs.push(u);
  });
  await pg.addInitScript(({ sombre: s, nums }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
      if (!sessionStorage.getItem('banc_init')) { sessionStorage.setItem('banc_init', '1'); localStorage.setItem('vinted_sale_overrides', JSON.stringify(nums)); }
    } catch (_) {}
    window.__file = [];
    window.__scan = (v) => { window.__file.push(v); };
    window.BarcodeDetector = class { static async getSupportedFormats() { return ['code_128', 'qr_code']; } constructor(o) { this.o = o; }
      async detect() { const v = window.__file.shift(); return v == null ? [] : [{ rawValue: v, format: 'code_128' }]; } };
    window.__flux = 0;
    const gum = async () => { window.__flux++; const c = document.createElement('canvas'); c.width = 640; c.height = 480; const x = c.getContext('2d');
      setInterval(() => { x.fillStyle = '#333'; x.fillRect(0, 0, 640, 480); }, 200); return c.captureStream(5); };
    try { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: gum }, configurable: true }); } catch (_) { navigator.mediaDevices.getUserMedia = gum; }
  }, { sombre: !!sombre, nums: NUMS });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const m = /images1\.vinted\.net\/t\/b(\d+)\//.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(Number(m[1])) });
    return ['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const q = route.request();
    const u = decodeURIComponent(metaVersData(q.url()));
    const h = { 'access-control-allow-origin': '*' };
    if (q.method() === 'POST' && /\/rest\/v1\/app_data/.test(u)) {
      let rows = []; try { rows = JSON.parse(q.postData() || '[]'); } catch (_) {}
      if (!Array.isArray(rows)) rows = [rows];
      let refus = false;
      for (const r of rows) {
        const txt = JSON.stringify(r && r.data);
        if (/data:image/.test(txt)) ecrits.push({ id: r.id, taille: (r.data && r.data.b64 || '').length, jpeg: /^data:image\/jpeg;base64,/.test((r.data && r.data.b64) || ''), tx: r.data && r.data.tx, site: r.data && r.data.site, at: r.data && r.data.at });
        if (r && panne.ecrire.has(r.id)) { refus = true; continue; }
        if (r && /^colis_photo_/.test(r.id)) { const i = LIGNES.findIndex((x) => x.id === r.id); if (i >= 0) LIGNES[i] = { id: r.id, data: r.data }; else LIGNES.push({ id: r.id, data: r.data }); }
      }
      return route.fulfill({ status: refus ? 500 : 201, contentType: 'application/json', headers: h, body: refus ? '{"message":"panne"}' : '[]' });
    }
    if (q.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { ...h, 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: h, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq && /^colis_photo_/.test(eq[1])) {
      lectures.push({ id: eq[1], sel });
      if (panne.lire.has(eq[1])) return route.fulfill({ status: 503, contentType: 'application/json', headers: h, body: '{"message":"panne"}' });
      return j(LIGNES.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    }
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(MS), cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => (r.data[k] == null) === !non);
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => !/^colis_photo_/.test(r.id) && re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, ecrits, lectures, ailleurs };
};

const lireLS = (pg, k) => pg.evaluate((cle) => { try { return JSON.parse(localStorage.getItem(cle) || 'null'); } catch (_) { return 'illisible'; } }, k);
const cles = (o) => Object.keys(o || {}).sort();
const etat = (pg) => pg.evaluate(() => {
  const s = document.querySelector('[data-scan-sheet]'); const e = document.querySelector('[data-scan-resultat]'); if (!s || !e) return null;
  const p = document.querySelector('[data-scan-paire]'); const ph = p && p.querySelector('.vrm-scan-photo'); const img = ph && ph.querySelector('img');
  const num = document.querySelector('[data-scan-num]');
  const sr = s.getBoundingClientRect();
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom > innerHeight + 1 || r.top < -1) return false;
    const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!x && (x === el || el.contains(x)); };
  const pr = ph ? ph.getBoundingClientRect() : null;
  return { verif: s.getAttribute('data-scan-verif'), etat: e.getAttribute('data-scan-resultat'), cle: e.getAttribute('data-scan-cle'), n: Number(e.getAttribute('data-scan-n')),
    sheetW: Math.round(sr.width), photoW: pr ? Math.round(pr.width) : 0, photoH: pr ? Math.round(pr.height) : 0, vh: innerHeight,
    src: img ? img.getAttribute('src') : null, photoOk: !!(img && img.complete && img.naturalWidth > 0), photoVisible: visible(img || ph),
    num: num ? num.textContent : null, numPx: num ? parseFloat(getComputedStyle(num).fontSize) : 0, numVisible: visible(num),
    bouton: (document.querySelector('[data-scan-confirmer]') || { getAttribute: () => null }).getAttribute('data-scan-confirmer'),
    photoCarton: (document.querySelector('[data-scan-sheet] [data-photo-carton]') || { getAttribute: () => null }).getAttribute('data-photo-carton'),
    photoCartonEtat: (document.querySelector('[data-scan-sheet] [data-photo-carton]') || { getAttribute: () => null }).getAttribute('data-photo-carton-etat'),
    annuler: !!document.querySelector('[data-scan-sheet] [data-depose-annuler]'), message: (document.querySelector('[data-scan-message]') || {}).textContent || '',
    echec: !!document.querySelector('[data-scan-sheet] [data-photo-carton-echec]') };
});
const attendre = async (pg, n) => { for (let i = 0; i < 60; i++) { const r = await etat(pg); if (r && r.n >= n) { await pg.waitForTimeout(250); return etat(pg); } await pg.waitForTimeout(100); } return etat(pg); };
const scanner = async (pg, v, n) => { await pg.evaluate((x) => window.__scan(x), v); return attendre(pg, n); };
const cibles = (pg, racine) => pg.evaluate((s) => [...document.querySelectorAll(`${s} button, ${s} summary`)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map((e) => ({ q: (e.getAttribute('data-photo-carton-prendre') != null ? 'photo' : String(e.className || e.tagName).slice(0, 24)), h: Math.round(e.getBoundingClientRect().height) })), racine);
const deborde = (pg) => pg.evaluate(() => { const w = window.innerWidth; const hors = [...document.querySelectorAll('[data-scan-sheet] *, .vrm-prep-feuille *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > w + 1 || r.left < -1); }).map((e) => String(e.className).slice(0, 30)); return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, hors: hors.slice(0, 4) }; });
// Une « photo du carton » inventée : la capture d'un rectangle de la page (aucune vraie photo).
const fauxCarton = async (pg) => ({ name: 'carton.png', mimeType: 'image/png', buffer: await pg.screenshot({ clip: { x: 0, y: 0, width: 300, height: 220 } }) });

async function vue(b, nom, vp, sombre) {
  console.log(`\n— Photo du carton · ${nom}`);
  const { ctx, pg, errs, ecrits, lectures, ailleurs } = await ouvrir(b, vp, sombre);
  const shot = async (q) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `photo-colis-${nom}-${q}.png`) }); };
  await essaie(`${nom} scan`, async () => {
    await pg.waitForSelector('[data-colis-scanner]', { timeout: 30000 });
    await pg.waitForFunction(() => document.querySelectorAll('[data-bord-card][data-tx-colis]').length >= 8, null, { timeout: 20000 }).catch(() => {});
    await pg.waitForTimeout(1000);
    await pg.click('[data-colis-scanner]');
    await pg.waitForSelector('[data-scan-sheet][data-scan-camera="active"]', { timeout: 8000 }).catch(() => {});
    // V1 : le 5ᵉ des 8 « Nike Air Max 90 blanche ».
    let r = await scanner(pg, 'XA100000005FR', 1);
    dit(r && r.verif === 'trouve' && r.cle === 'v:9205', `${nom} : V1 le scan passe la feuille en vérification, pour CETTE vente (v:9205)`, JSON.stringify(r && { verif: r.verif, cle: r.cle }));
    dit(r && /\/b5\//.test(r.src || '') && r.photoOk && r.photoVisible, `${nom} : V1 la photo de CETTE annonce (b5), chargée, visible, rien ne la couvre`, JSON.stringify(r && { src: r.src, ok: r.photoOk, vis: r.photoVisible }));
    dit(r && r.photoW >= r.sheetW * 0.85 && r.photoH >= r.vh * 0.3, `${nom} : V1 la photo en très grand (largeur de la feuille, ≥ 30 % de l'écran en hauteur)`, JSON.stringify(r && { w: r.photoW, sheet: r.sheetW, h: r.photoH, vh: r.vh }));
    dit(r && r.num === 'N°35' && r.numPx >= 60 && r.numVisible, `${nom} : V1 le N° de SA fiche (35) en très grand (≥ 60 px), visible`, JSON.stringify(r && { num: r.num, px: r.numPx, vis: r.numVisible }));
    dit(r && r.bouton === 'v:9205' && !r.photoCarton, `${nom} : V4 « C'est la bonne paire · Colis fait » offert ; pas encore de « Photo du carton »`, JSON.stringify(r && { b: r.bouton, pc: r.photoCarton }));
    await shot('1-verif');
    // V2 : un autre n° ⇒ SA paire.
    r = await scanner(pg, 'XA100000002FR', 2);
    dit(r && r.cle === 'v:9202' && /\/b2\//.test(r.src || '') && r.num === 'N°32', `${nom} : V2 un autre n° ⇒ SA paire (b2, N°32), jamais une autre au même titre`, JSON.stringify(r && { cle: r.cle, src: r.src, num: r.num }));
    // V3 : deux ventes au même n°, puis inconnu.
    r = await scanner(pg, 'XD555555555FR', 3);
    dit(r && r.etat === 'ambigu' && !r.verif && !r.bouton && /2 ventes portent ce n°/.test(r.message), `${nom} : V3 deux ventes au même n° ⇒ pas de vérification, le message, aucun bouton`, JSON.stringify(r && { etat: r.etat, verif: r.verif, m: r.message }));
    await shot('2-deux-ventes');
    r = await scanner(pg, 'XZ999999999FR', 4);
    dit(r && r.etat === 'inconnu' && !r.verif && !r.bouton && /aucune vente/.test(r.message), `${nom} : V3 n° inconnu ⇒ « relié à aucune vente », rien`, JSON.stringify(r && { etat: r.etat, verif: r.verif }));
    dit(cles(await lireLS(pg, 'vinted_ship_done')).length === 0 && ecrits.length === 0, `${nom} : V4 rien n'est écrit au scan`, JSON.stringify(ecrits));
    // P1 : son toucher sur 9203, puis « Photo du carton ».
    r = await scanner(pg, 'XA100000003FR', 5); const tScanP1 = Date.now();
    await pg.click('[data-scan-confirmer="v:9203"]');
    await pg.waitForTimeout(400);
    r = await etat(pg);
    dit(r && r.verif === 'fait' && r.photoCarton === 'colis_photo_v_9203' && r.annuler, `${nom} : P1 « Colis fait » ⇒ « Photo du carton » pour CETTE vente (colis_photo_v_9203), « Annuler » gardé`, JSON.stringify(r && { verif: r.verif, pc: r.photoCarton, a: r.annuler }));
    const c = await cibles(pg, '[data-scan-sheet]');
    dit(c.length && c.every((x) => x.h >= 44) && c.some((x) => x.q === 'photo'), `${nom} : P1 cibles ≥ 44 px (dont « Photo du carton »)`, JSON.stringify(c));
    await shot('3-fait');
    const fichier = await pg.$('[data-scan-sheet] [data-photo-carton-fichier]');
    dit(fichier && (await fichier.getAttribute('capture')) === 'environment' && /image/.test(await fichier.getAttribute('accept')), `${nom} : P1 l'appareil photo du téléphone (capture arrière)`);
    await fichier.setInputFiles(await fauxCarton(pg));
    await pg.waitForFunction(() => { const x = document.querySelector('[data-scan-sheet] [data-photo-carton]'); return x && /range|echec/.test(x.getAttribute('data-photo-carton-etat') || ''); }, null, { timeout: 8000 }).catch(() => {});
    r = await etat(pg);
    dit(r && r.photoCartonEtat === 'range', `${nom} : P2 « Photo du carton rangée ✓ »`, r && r.photoCartonEtat);
    const e1 = ecrits.filter((x) => x.id === 'colis_photo_v_9203');
    dit(ecrits.length === 1 && e1.length === 1 && e1[0].jpeg && e1[0].taille <= 480 * 1024 && e1[0].tx === '9203' && e1[0].site === 'v', `${nom} : P2 UNE écriture, SA ligne colis_photo_v_9203 (JPEG ≤ 480 Ko, tx 9203)`, JSON.stringify(ecrits.map((x) => ({ id: x.id, t: x.taille, j: x.jpeg, tx: x.tx }))));
    // P3 : le bordereau relu pendant qu'il photographie (après la fenêtre anti-répétition de 2,5 s du scanner,
    // comptée depuis SON scan, et DANS les 5 s d'« Annuler » : sous charge, une capture prise avant faisait
    // dépasser ces 5 s — le banc jugeait alors un autre état ; la capture « 4 » est prise après).
    await pg.waitForTimeout(Math.max(0, 2700 - (Date.now() - tScanP1)));
    r = await scanner(pg, 'XA100000003FR', 99).catch(() => null);
    await pg.waitForTimeout(800);
    r = await etat(pg);
    dit(r && r.verif === 'fait' && r.n === 5 && r.photoCartonEtat === 'range', `${nom} : P3 relire SON bordereau ne remplace pas l'écran (fait, photo rangée)`, JSON.stringify(r && { verif: r.verif, n: r.n, pc: r.photoCartonEtat }));
    await shot('4-photo-rangee');
    // P5 (10 nov., visionneuse unique) : toucher l'aperçu ouvre LA visionneuse de l'app (plus de vue à part),
    // DEVANT le scanner, légende « Photo du carton · N°… » ; Échap ferme la photo SEULE (le scanner reste).
    await pg.click('[data-scan-sheet] [data-photo-carton-voir]');
    await pg.waitForSelector('[data-visionneuse] [data-visionneuse-img]', { timeout: 6000 }).catch(() => {});
    await pg.waitForTimeout(300);
    const pv = await pg.evaluate(() => {
      const v = document.querySelector('[data-visionneuse]'); if (!v) return null;
      const i = v.querySelector('[data-visionneuse-img]'); const r = i.getBoundingClientRect();
      const dessus = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return { n: document.querySelectorAll('[data-visionneuse]').length, jpeg: /^data:image\/jpeg;base64,/.test(i.getAttribute('src') || ''), ok: i.complete && i.naturalWidth > 0,
        devant: !!(dessus && dessus.closest('[data-visionneuse]')), legende: (v.querySelector('[data-visionneuse-legende]') || {}).textContent || '', large: r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.8,
        autreVue: !!document.querySelector('[data-photo-carton-vue]') };
    });
    dit(pv && pv.n === 1 && pv.jpeg && pv.ok && pv.devant && !pv.autreVue, `${nom} : P5 l'aperçu ⇒ LA visionneuse (une seule), devant le scanner, la photo chargée`, JSON.stringify(pv));
    dit(pv && /Photo du carton/.test(pv.legende) && /N°33/.test(pv.legende) && pv.large, `${nom} : P5 légende « Photo du carton · N°33 », photo en grand`, JSON.stringify(pv));
    await shot('4b-visionneuse-scan');
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(350);
    const apres = await pg.evaluate(() => ({ vis: !!document.querySelector('[data-visionneuse]'), scan: !!document.querySelector('[data-scan-sheet]') }));
    dit(!apres.vis && apres.scan, `${nom} : P5 Échap ferme la photo seule, le scanner reste ouvert`, JSON.stringify(apres));
    await pg.waitForTimeout(5200);
    dit(JSON.stringify(cles(await lireLS(pg, 'vinted_ship_done'))) === '["9203"]', `${nom} : P1 « Colis fait » : 9203 seulement`, JSON.stringify(await lireLS(pg, 'vinted_ship_done')));
    // P4 : la base refuse l'écriture (9207).
    await pg.click('[data-scan-suivant]');
    r = await scanner(pg, 'XA100000007FR', 6);
    await pg.click('[data-scan-confirmer="v:9207"]'); await pg.waitForTimeout(300);
    await (await pg.$('[data-scan-sheet] [data-photo-carton-fichier]')).setInputFiles(await fauxCarton(pg));
    await pg.waitForFunction(() => !!document.querySelector('[data-scan-sheet] [data-photo-carton-echec]'), null, { timeout: 8000 }).catch(() => {});
    r = await etat(pg);
    dit(r && r.echec && r.photoCartonEtat !== 'range', `${nom} : P4 écriture refusée ⇒ dit en ambre, jamais « rangée »`, JSON.stringify(r && { e: r.echec, pc: r.photoCartonEtat }));
    await shot('5-echec');
    const d = await deborde(pg);
    dit(d.page <= 1 && !d.hors.length, `${nom} : rien ne déborde (scanner)`, JSON.stringify(d));
    await pg.click('[data-scan-fermer]'); await pg.waitForTimeout(5600);
  });
  // E1 : « Préparer mes colis » — le même geste après « Colis fait ».
  await essaie(`${nom} préparer`, async () => {
    await pg.waitForSelector('[data-preparer-ouvrir]', { timeout: 10000 });
    await pg.click('[data-preparer-ouvrir]'); await pg.waitForSelector('[data-preparer-cle]', { timeout: 8000 });
    const cle = await pg.getAttribute('[data-preparer-cle]', 'data-preparer-cle');
    const avant = await pg.$('.vrm-prep-feuille [data-photo-carton]');
    await pg.click('[data-preparer-fait]'); await pg.waitForTimeout(500);
    const pc = await pg.getAttribute('.vrm-prep-feuille [data-photo-carton]', 'data-photo-carton').catch(() => null);
    dit(!avant && /^v:\d+$/.test(cle || '') && pc === 'colis_photo_v_' + cle.slice(2), `${nom} : E1 « Préparer mes colis » : « Photo du carton » après « Colis fait », pour la vente de l'étape`, JSON.stringify({ cle, pc, avant: !!avant }));
    const c = await cibles(pg, '.vrm-prep-feuille');
    dit(c.length && c.every((x) => x.h >= 44), `${nom} : E1 cibles ≥ 44 px`, JSON.stringify(c));
    await shot('6-preparer');
    await pg.click('[data-preparer-annuler]').catch(() => {});
    await pg.click('[data-preparer-fermer]'); await pg.waitForTimeout(300);
  });
  // F1 : la fiche de la vente.
  await essaie(`${nom} fiche`, async () => {
    await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
    const ouvrirVente = async (tx) => {
      const t = pg.locator(`.vrm-sale-row[data-tx="${tx}"] .vrm-ledger-sale-toggle`).first();
      await t.waitFor({ state: 'attached', timeout: 20000 });
      const croix = pg.locator('.vrm-ledger-drawer-host:not([hidden]) .vrm-recap-fermer');
      if (await croix.count()) { await croix.first().click(); await pg.waitForTimeout(400); }
      await t.scrollIntoViewIfNeeded(); if (await t.getAttribute('aria-expanded') !== 'true') await t.click();
      const id = await t.getAttribute('aria-controls');
      await pg.locator(`[id="${id}"]`).waitFor({ state: 'visible', timeout: 8000 });
      await pg.waitForFunction((i) => { const x = document.querySelector(`[id="${i}"] [data-photo-carton-vente]`); return x && x.getAttribute('data-photo-carton-vente-etat') !== 'lecture'; }, id, { timeout: 8000 }).catch(() => {});
      return id;
    };
    let id = await ouvrirVente(9203);
    const ligne = (i) => pg.evaluate((i) => { const x = document.querySelector(`[id="${i}"] [data-photo-carton-vente]`); return x ? { id: x.getAttribute('data-photo-carton-vente'), etat: x.getAttribute('data-photo-carton-vente-etat'), voir: !!x.querySelector('[data-photo-carton-vente-voir]'), ajouter: !!x.querySelector('[data-photo-carton-prendre]'), texte: x.textContent } : null; }, i);
    let l = await ligne(id);
    dit(l && l.id === 'colis_photo_v_9203' && l.etat === 'oui' && l.voir, `${nom} : F1 la fiche de la vente 9203 : « Photo du carton · Voir »`, JSON.stringify(l));
    await pg.locator(`[id="${id}"] [data-photo-carton-vente-voir]`).scrollIntoViewIfNeeded();
    await shot('7-fiche');
    await pg.click(`[id="${id}"] [data-photo-carton-vente-voir]`);
    await pg.waitForSelector('[data-visionneuse] [data-visionneuse-img]', { timeout: 6000 }).catch(() => {});
    const v = await pg.evaluate(() => { const x = document.querySelector('[data-visionneuse]'); const i = x && x.querySelector('[data-visionneuse-img]'); return i ? { jpeg: /^data:image\/jpeg;base64,/.test(i.getAttribute('src') || ''), ok: i.complete && i.naturalWidth > 0, legende: (x.querySelector('[data-visionneuse-legende]') || {}).textContent || '' } : null; });
    dit(v && v.jpeg && v.ok && /Photo du carton/.test(v.legende), `${nom} : F1 « Voir » ⇒ la photo du carton en grand, dans LA visionneuse de l'app`, JSON.stringify(v));
    const lu = lectures.filter((x) => x.id === 'colis_photo_v_9203');
    dit(lectures.length && lectures.every((x) => x.sel && !/(^|,)data(,|$)/.test(x.sel)) && lu.some((x) => /data->>b64/.test(x.sel)), `${nom} : F1 lue par SON id, en projection (data->>b64), jamais select=data`, JSON.stringify(lectures.map((x) => x.id + '?' + x.sel)));
    await shot('8-vue');
    await pg.click('[data-visionneuse-fermer]'); await pg.waitForTimeout(300);
    id = await ouvrirVente(9205);
    l = await ligne(id);
    dit(l && l.etat === 'non' && l.ajouter && !l.voir, `${nom} : F1 une vente sans photo (9205) ⇒ « Ajouter »`, JSON.stringify(l));
    id = await ouvrirVente(9206);
    l = await ligne(id);
    dit(l && l.etat === 'pas-su' && /—/.test(l.texte) && !l.ajouter, `${nom} : F1 lecture ratée (9206) ⇒ « — », jamais « aucune »`, JSON.stringify(l));
  });
  dit(ailleurs.length === 0, `${nom} : aucune image vers un autre hôte (rien publié vers Vinted)`, ailleurs.slice(0, 3).join(' '));
  dit(ecrits.every((x) => /^colis_photo_v_\d+$/.test(x.id)), `${nom} : seules les lignes colis_photo_* reçoivent une image (jamais main)`, JSON.stringify(ecrits.map((x) => x.id)));
  dit(errs.length === 0, `${nom} : aucune erreur d'app`, errs.join(' | ').slice(0, 300));
  await ctx.close();
}

(async () => {
  let b;
  try {
    b = await lancer(PW, { executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
    for (const [nom, vp, sombre] of [['390-clair', { width: 390, height: 844 }, false], ['390-sombre', { width: 390, height: 844 }, true], ['1512-clair', { width: 1512, height: 950 }, false], ['1512-sombre', { width: 1512, height: 950 }, true]]) {
      if (VUES && !VUES.includes(nom)) continue;
      await vue(b, nom, vp, sombre);
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\nKO photo-colis-scan : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK photo-colis-scan : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
