// Banc : SCANNER — LA PAIRE ATTENDUE DANS LE COLIS (Colis) ET L'ACHAT AU RETRAIT (Achats) — lot V, 9 nov.
// Julien : « vas-y, j'adore Colis, et fais pareil pour les achats » + « quand on scanne le bordereau,
// l'app peut dire la paire qu'il doit y avoir dedans ».
// Données INVENTÉES (dépôt public) de la forme réelle : ventes Vinted à expédier (`orders_sold`, prix
// objet `{amount}`), leurs bordereaux e-mail (`email_bord_{tx}`, champ `suivi`), achats Vinted au
// point relais (`orders_purchased`, `panel_colis_relais` : code de retrait), e-mails de suivi
// (`email_track_*` : n° de suivi, code). La caméra et le détecteur sont FAUX : `getUserMedia` rend le
// flux d'un canvas, `window.BarcodeDetector` rend la valeur posée par le banc (`__scan(valeur)`).
// Exige (jugé sur data-* et sur ce qui est ÉCRIT, §6.4) :
//  COLIS — 8 ventes au MÊME titre, chacune son n° :
//   A. le scan d'un n° montre LA paire de CE n° (clé, N°, photo, titre, taille, compte, acheteur) ;
//   B. RIEN n'est écrit sans son toucher (même 6 s après, même après un second scan) ;
//   C. « C'est la bonne paire · Colis fait » ⇒ `vinted_ship_done` et `vinted_bords_shipped` de CETTE
//      vente seulement (jamais une des 7 autres au même titre) ; « Annuler » offert ;
//   D. la même écriture que le bouton existant de la carte (même clé, même forme de valeur) ;
//   E. n° porté par deux ventes ⇒ « 2 ventes portent ce n° : vérifie », aucun bouton, rien écrit ;
//   F. n° inconnu ⇒ « relié à aucune vente », rien ; un titre tapé n'est jamais une identité ;
//   G. colis déjà coché ⇒ « Déjà noté colis fait » ; la série « Scannés » garde chaque scan ;
//  ACHATS — Colis → À retirer :
//   H. code de retrait ⇒ l'achat de CE code (deux achats au même titre : le bon), prix payé, vendeur ;
//   I. rien sans toucher ; « Retiré » ⇒ `vinted_pickup_done[tx]` de CET achat seulement, de la même
//      forme que « J'ai retiré » de sa carte ; n° de suivi d'un e-mail ⇒ `vrm_colis_collected` ;
//   J. code porté par deux colis ⇒ dit, rien ; code inconnu ⇒ dit, rien ; déjà retiré ⇒ dit ;
//  PARTOUT : la caméra s'ouvre une fois et est COUPÉE en sortant ; cibles ≥ 44 px ; rien ne déborde ;
//   aucune erreur ; aucune requête ne part avec une image (rien n'est envoyé).
// Vues : 390 tactile et 1512, clair et sombre (SCAN_VUES=390-clair,… pour en choisir).
// Lancer : construire dist/, puis node scripts/bancs/scanner-colis-achats.cjs   (BANC_PORT, SHOTS=dossier)
const path = require('path');
let PW;
try { PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright')); }
catch (_) { PW = require('playwright'); }
const { lancer } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4483);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.SCAN_VUES ? process.env.SCAN_VUES.split(',') : null;
const MS = Date.now(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const jourDans = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;

// ── COLIS : 8 ventes au MÊME titre (9201-9208), deux ventes au même n° (9209, 9210). ──
const TITRE = 'Nike Air Max 90 blanche';
const vente = (id, k) => ({ transaction_id: id, title: TITRE, size_title: '42', user_login: `acheteur_${k}`, price: { amount: '50', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: iso(MS - J - k * 60000), photo: { url: url(k) } });
const VENTES = Array.from({ length: 10 }, (_, k) => vente(9201 + k, k + 1));
const SUIVI = Object.fromEntries(VENTES.map((v, k) => [v.transaction_id, `XA${100000001 + k}FR`]));
SUIVI[9209] = 'XD555555555FR'; SUIVI[9210] = 'XD555555555FR';
const NUMS = Object.fromEntries(VENTES.map((v, k) => [String(v.transaction_id), { numero: String(31 + k) }]));
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const bord = (tx) => ({ id: 'email_bord_' + tx, data: { transaction: String(tx), uid: '111', filename: 'bordereau-' + tx + '.pdf', modele: TITRE, article: TITRE, receivedAt: iso(MS - 3600000), pdfB64: PDF_B64, suivi: SUIVI[tx] } });

// ── ACHATS au point relais : deux au MÊME titre (9302, 9303), un autre (9301) ; e-mails de suivi. ──
const AU_RELAIS = 'Colis déposé en point relais';
const achat = (id, titre, k) => ({ transaction_id: id, conversation_id: 7000 + id % 1000, title: titre, size_title: '40', user_login: `vendeur_${k}`, price: { amount: k === 3 ? '37.5' : '40', currency_code: 'EUR' }, status: AU_RELAIS, transaction_user_status: 'needs_action', date: iso(MS - 5 * J), photo: { url: url(20 + k) } });
const ACHATS = [achat(9301, 'Adidas Samba noire', 1), achat(9302, 'New Balance 530 grise', 2), achat(9303, 'New Balance 530 grise', 3)];
const LIEU = 'Phone Cash, 12 rue du Port, 35260 Cancale';
const RELAIS = {
  9301: { code: '012345', lieu: LIEU, transporteur: 'mondialrelay', at: iso(MS) },
  9302: { code: '555001', lieu: LIEU, transporteur: 'mondialrelay', at: iso(MS) },
  9303: { code: '555002', lieu: LIEU, transporteur: 'mondialrelay', at: iso(MS) },
};
const track = (suivi, lieu, code, extra = {}) => ({ id: `email_track_mondialrelay_${suivi}`, data: Object.assign({ type: 'suivi', carrier: 'mondialrelay', suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, receivedAt: iso(MS - 0.3 * J), emailAt: iso(MS - 0.3 * J), arriveLe: iso(MS - 0.3 * J), code, lieu, limite: jourDans(4), consigne: false, account: 'compte_test' }, extra) });
const TRACKS = [
  track('90000021', 'TABAC DU QUAI, 12 Rue des Mouettes, 22000 Saint-Brieuc', '333333', { artTitle: 'Sac seau toile écrue' }),
  track('90000031', 'POINT PRESSE, 3 Rue Haute, 56000 Vannes', '777777'),
  track('90000032', 'POINT PRESSE, 5 Grande Rue, 29200 Brest', '777777'),
];
const LIGNES = [
  ...VENTES.map((v) => bord(v.transaction_id)),
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS), payload: { my_orders: ACHATS } } },
  { id: 'panel_colis_relais', data: RELAIS },
  ...TRACKS,
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
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${TEINTES[k % 6]}"/><path d="M60 250 C80 190 150 175 190 200 C230 222 285 205 330 232 C352 246 346 282 306 284 L84 284 C62 284 52 268 60 250 Z" fill="rgba(30,34,40,.62)"/><path d="M60 284 L330 284 L326 300 L66 300 Z" fill="rgba(255,255,255,.85)"/><text x="200" y="120" font-size="90" text-anchor="middle" fill="rgba(0,0,0,.35)" font-family="sans-serif">${k}</text></svg>`;

const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const envois = [];   // toute requête sortante qui porterait une image (rien ne doit partir)
  pg.on('request', (q) => { const d = q.postData() || ''; if (/data:image|image\/(jpeg|png|webp)|\bblob:/i.test(d) || /multipart\/form-data/i.test(q.headers()['content-type'] || '')) envois.push(q.url()); });
  await pg.addInitScript(({ sombre: s, nums, deja }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
      if (!sessionStorage.getItem('banc_init')) { sessionStorage.setItem('banc_init', '1'); localStorage.setItem('vinted_ship_done', JSON.stringify(deja)); localStorage.setItem('vinted_sale_overrides', JSON.stringify(nums)); }
    } catch (_) {}
    window.__file = []; window.__detections = 0;
    window.__scan = (v) => { window.__file.push(v); };
    window.BarcodeDetector = class { static async getSupportedFormats() { return ['code_128', 'qr_code']; } constructor(o) { this.o = o; }
      async detect() { window.__detections++; const v = window.__file.shift(); return v == null ? [] : [{ rawValue: v, format: 'code_128' }]; } };
    window.__flux = 0; window.__pistes = [];
    const gum = async () => { if (window.__sansCamera) throw new Error('NotFoundError'); window.__flux++; const c = document.createElement('canvas'); c.width = 640; c.height = 480; const x = c.getContext('2d');
      setInterval(() => { x.fillStyle = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); x.fillRect(0, 0, 640, 480); }, 100);
      const st = c.captureStream(10); window.__pistes.push(...st.getTracks()); return st; };
    try { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: gum }, configurable: true }); } catch (_) { navigator.mediaDevices.getUserMedia = gum; }
  }, { sombre: !!sombre, nums: NUMS, deja: { 9208: MS - 3600000 } });
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
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, envois };
};

const lire = (pg, k) => pg.evaluate((cle) => { try { return JSON.parse(localStorage.getItem(cle) || 'null'); } catch (_) { return 'illisible'; } }, k);
const res = (pg) => pg.evaluate(() => {
  const e = document.querySelector('[data-scan-resultat]'); if (!e) return null;
  const p = document.querySelector('[data-scan-paire]'); const img = p && p.querySelector('.vrm-scan-photo img');
  const t = (s) => { const x = document.querySelector(s); return x ? x.textContent : null; };
  return { etat: e.getAttribute('data-scan-resultat'), cle: e.getAttribute('data-scan-cle'), n: Number(e.getAttribute('data-scan-n')),
    paire: p ? p.getAttribute('data-scan-paire') : null, num: p ? p.getAttribute('data-scan-paire-num') : null, titre: t('[data-scan-titre]'), taille: (document.querySelector('[data-scan-taille]') || { getAttribute: () => null }).getAttribute('data-scan-taille'),
    compte: t('[data-scan-compte]'), personne: t('[data-scan-personne]'), prix: (document.querySelector('[data-scan-prix]') || { getAttribute: () => null }).getAttribute('data-scan-prix'),
    photo: img ? { src: img.getAttribute('src'), ok: img.complete && img.naturalWidth > 0 } : null,
    bouton: (document.querySelector('[data-scan-confirmer]') || { getAttribute: () => null }).getAttribute('data-scan-confirmer'),
    message: t('[data-scan-message]'), annuler: !!document.querySelector('[data-scan-sheet] [data-depose-annuler]') };
});
const attendre = async (pg, n) => { for (let i = 0; i < 50; i++) { const r = await res(pg); if (r && r.n >= n) return r; await pg.waitForTimeout(100); } return res(pg); };
const scanner = async (pg, v, n) => { await pg.evaluate((x) => window.__scan(x), v); return attendre(pg, n); };
const cles = (o) => Object.keys(o || {}).sort();
const cliquer = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const cibles = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-scan-sheet] button, [data-scan-sheet] summary')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ q: e.getAttribute('data-scan-confirmer') != null ? 'confirmer' : (e.className || e.tagName), h: Math.round(e.getBoundingClientRect().height) })));
const deborde = (pg) => pg.evaluate(() => { const s = document.querySelector('[data-scan-sheet]'); const w = window.innerWidth; const hors = s ? [...s.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > w + 1 || r.left < -1); }).map((e) => String(e.className).slice(0, 30)) : []; return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, hors: hors.slice(0, 4) }; });

async function vue(b, nom, vp, sombre) {
  console.log(`\n— Scanner · ${nom}`);
  const { ctx, pg, errs, envois } = await ouvrir(b, vp, sombre);
  const shot = async (q) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `scanner-${nom}-${q}.png`) }); };
  // ════════════ COLIS ════════════
  await essaie(`${nom} colis`, async () => {
    await pg.waitForSelector('[data-colis-scanner]', { timeout: 30000 });
    await pg.waitForFunction(() => document.querySelectorAll('[data-bord-card][data-tx-colis]').length >= 8, null, { timeout: 20000 }).catch(() => {});
    await pg.waitForTimeout(1200);
    const nCartes = await pg.evaluate(() => document.querySelectorAll('[data-bord-card][data-tx-colis]').length);
    dit(nCartes >= 9, `${nom} : les colis à envoyer sont là (8 au même titre + 2)`, String(nCartes));
    const bb = await (await pg.$('[data-colis-scanner]')).boundingBox();
    dit(bb && bb.height >= 44, `${nom} : « Scanner » fait au moins 44 px`, bb ? String(Math.round(bb.height)) : '');
    dit((await pg.getAttribute('[data-colis-scanner]', 'data-scan-mode-bouton')) === 'envoi', `${nom} : sur « À envoyer », Scanner lit un bordereau`);
    await pg.click('[data-colis-scanner]');
    await pg.waitForSelector('[data-scan-sheet][data-scan-camera="active"]', { timeout: 8000 }).catch(() => {});
    dit((await pg.getAttribute('[data-scan-sheet]', 'data-scan-camera').catch(() => null)) === 'active', `${nom} : la caméra s'ouvre sur SON geste, le détecteur du navigateur lit`);
    dit((await pg.getAttribute('[data-scan-sheet]', 'data-scan-mode')) === 'envoi', `${nom} : feuille en mode bordereau`);
    const portail = await pg.evaluate(() => { const s = document.querySelector('[data-scan-sheet]'); return s && s.parentElement === document.body && getComputedStyle(s).position === 'fixed'; });
    dit(portail, `${nom} : feuille plein écran, en portail sur <body>`);
    dit(JSON.stringify(cles(await lire(pg, 'vinted_ship_done'))) === '["9208"]', `${nom} : avant tout scan, seul le colis déjà coché est écrit`);
    // A : le 5ᵉ des 8 « Nike Air Max 90 blanche ».
    let r = await scanner(pg, 'XA100000005FR', 1);
    dit(r && r.etat === 'trouve' && r.cle === 'v:9205' && r.paire === 'v:9205', `${nom} : A le n° montre la paire de CE n° (v:9205), pas une autre au même titre`, JSON.stringify(r && { etat: r.etat, cle: r.cle }));
    dit(r && r.num === '35', `${nom} : A le N° de SA fiche (35)`, r && r.num);
    dit(r && r.titre === TITRE && r.taille === '42' && r.compte === 'compte_test' && r.personne === 'acheteur_5', `${nom} : A titre, taille, compte, acheteur de CETTE vente`, JSON.stringify(r && [r.titre, r.taille, r.compte, r.personne]));
    await pg.waitForTimeout(500);
    r = await res(pg);
    dit(r && r.photo && /\/b5\//.test(r.photo.src) && r.photo.ok, `${nom} : A la photo de CETTE annonce (b5), chargée`, JSON.stringify(r && r.photo));
    dit(r && r.bouton === 'v:9205', `${nom} : A le geste « C'est la bonne paire · Colis fait » est offert`);
    const hg = await pg.evaluate(() => Math.round(document.querySelector('[data-scan-confirmer]').getBoundingClientRect().height));
    dit(hg >= 44, `${nom} : A le geste fait au moins 44 px`, String(hg));
    await shot('1-paire');
    // B : rien sans geste — un second scan, puis 6 s.
    r = await scanner(pg, 'XA100000003FR', 2);
    dit(r && r.etat === 'trouve' && r.cle === 'v:9203', `${nom} : B un second scan montre SA paire (v:9203)`, r && r.cle);
    await pg.waitForTimeout(6000);
    dit(JSON.stringify(cles(await lire(pg, 'vinted_ship_done'))) === '["9208"]' && cles(await lire(pg, 'vinted_bords_shipped')).length === 0, `${nom} : B rien n'est écrit sans son toucher (6 s, deux scans)`, JSON.stringify([await lire(pg, 'vinted_ship_done'), await lire(pg, 'vinted_bords_shipped')]));
    // C : son toucher sur 9203.
    await pg.click('[data-scan-confirmer="v:9203"]');
    r = await res(pg);
    dit(r && r.etat === 'fait' && r.annuler, `${nom} : C « Colis fait ✓ » et « Annuler » (5 s) dans la feuille`, JSON.stringify(r && { etat: r.etat, annuler: r.annuler }));
    await shot('2-fait');
    await pg.waitForTimeout(6000);
    const sd = await lire(pg, 'vinted_ship_done'), bs = await lire(pg, 'vinted_bords_shipped');
    dit(JSON.stringify(cles(sd)) === '["9203","9208"]', `${nom} : C vinted_ship_done : 9203 seulement (aucune des 7 autres au même titre)`, JSON.stringify(cles(sd)));
    dit(cles(bs).length === 1 && /9203/.test(cles(bs)[0]), `${nom} : C vinted_bords_shipped : le bordereau de 9203 seulement`, JSON.stringify(bs));
    // E : deux ventes au même n°.
    r = await scanner(pg, 'XD555555555FR', 3);
    dit(r && r.etat === 'ambigu' && !r.cle && !r.bouton && /2 ventes portent ce n°/.test(r.message || ''), `${nom} : E deux ventes au même n° ⇒ dit, aucun bouton`, JSON.stringify(r && { etat: r.etat, m: r.message }));
    await shot('3-deux-ventes');
    // F : inconnu ; un titre tapé.
    r = await scanner(pg, 'XZ999999999FR', 4);
    dit(r && r.etat === 'inconnu' && !r.bouton && /aucune vente/.test(r.message || ''), `${nom} : F n° inconnu ⇒ « relié à aucune vente », rien`, JSON.stringify(r && { etat: r.etat, m: r.message }));
    await shot('4-inconnu');
    await pg.fill('[data-scan-saisie]', TITRE); await pg.click('[data-scan-ok]');
    r = await attendre(pg, 5);
    dit(r && r.etat !== 'trouve' && !r.cle && !r.bouton, `${nom} : F un titre tapé n'est jamais une identité`, JSON.stringify(r && r.etat));
    // G : déjà coché ; clavier (espaces, minuscules) ; la série.
    await pg.fill('[data-scan-saisie]', 'xa 100 000 008 fr'); await pg.click('[data-scan-ok]');
    r = await attendre(pg, 6);
    dit(r && r.etat === 'deja' && r.cle === 'v:9208' && !r.bouton, `${nom} : G colis déjà coché ⇒ « Déjà noté colis fait », sans bouton`, JSON.stringify(r && { etat: r.etat, cle: r.cle }));
    await pg.waitForTimeout(5800);
    dit(JSON.stringify(cles(await lire(pg, 'vinted_ship_done'))) === '["9203","9208"]', `${nom} : E/F/G rien de plus n'est écrit`);
    const serie = await pg.evaluate(() => [...document.querySelectorAll('[data-scan-serie-cle]')].map((x) => [x.getAttribute('data-scan-serie-cle'), x.getAttribute('data-scan-serie-etat')]));
    const s = Object.fromEntries(serie.filter((x) => x[0]));
    dit(s['v:9203'] === 'fait' && s['v:9205'] === 'trouve' && s['v:9208'] === 'fait' && serie.length >= 5, `${nom} : G la série « Scannés » garde chaque scan (9203 fait, 9205 pas coché)`, JSON.stringify(serie));
    dit((await pg.evaluate(() => window.__flux)) === 1, `${nom} : scans en série, caméra ouverte UNE fois`);
    const c = await cibles(pg);
    dit(c.length && c.every((x) => x.h >= 44), `${nom} : cibles ≥ 44 px dans la feuille`, JSON.stringify(c));
    const d = await deborde(pg);
    dit(d.page <= 1 && !d.hors.length, `${nom} : rien ne déborde`, JSON.stringify(d));
    await pg.evaluate(() => { const x = document.querySelector('.vrm-scan-serie'); if (x) x.open = true; });
    await shot('5-serie');
    await pg.click('[data-scan-fermer]');
    await pg.waitForTimeout(400);
    dit(!(await pg.$('[data-scan-sheet]')), `${nom} : la feuille se ferme`);
    const pistes = await pg.evaluate(() => window.__pistes.map((t) => t.readyState));
    dit(pistes.length === 1 && pistes.every((x) => x === 'ended'), `${nom} : la caméra est COUPÉE en sortant`, JSON.stringify(pistes));
    // D : la même écriture que le bouton existant de la carte (« Déposé », 9206).
    const clic = await cliquer(pg, '[data-bord-card][data-tx-colis="9206"] [data-geste="fait"]');
    await pg.waitForTimeout(1500);
    const sd2 = await lire(pg, 'vinted_ship_done'), bs2 = await lire(pg, 'vinted_bords_shipped');
    const k03 = cles(bs2).find((k) => /9203/.test(k)), k06 = cles(bs2).find((k) => /9206/.test(k));
    dit(clic && typeof sd2['9206'] === typeof sd2['9203'] && typeof sd2['9203'] === 'number' && k03 && k06 && bs2[k03] === bs2[k06] && k06.replace('9206', 'X') === k03.replace('9203', 'X'),
      `${nom} : D la même écriture que le bouton de la carte (mêmes clés, même forme)`, JSON.stringify({ clic, sd: [sd2['9203'], sd2['9206']].map((x) => typeof x), bs: [k03, k06, bs2[k03], bs2[k06]] }));
  });
  // ════════════ ACHATS (Colis → À retirer) ════════════
  await essaie(`${nom} achats`, async () => {
    await pg.locator('[data-colis-onglet-choix="retirer"]').first().click();
    await pg.waitForTimeout(1500);
    dit((await pg.getAttribute('[data-colis-scanner]', 'data-scan-mode-bouton')) === 'retrait', `${nom} : sur « À retirer », Scanner lit un colis à retirer`);
    await pg.click('[data-colis-scanner]');
    await pg.waitForSelector('[data-scan-sheet][data-scan-camera="active"]', { timeout: 8000 }).catch(() => {});
    dit((await pg.getAttribute('[data-scan-sheet]', 'data-scan-mode')) === 'retrait', `${nom} : feuille en mode retrait`);
    const avant = await lire(pg, 'vinted_pickup_done');
    // H : le code de 9303 (deux achats « New Balance 530 grise »).
    let r = await scanner(pg, '555002', 1);
    dit(r && r.etat === 'trouve' && r.cle === 'r:v:9303', `${nom} : H le code de retrait montre l'achat de CE code (9303), pas l'autre au même titre`, JSON.stringify(r && { etat: r.etat, cle: r.cle }));
    dit(r && r.titre === 'New Balance 530 grise' && r.personne === 'vendeur_3' && r.prix === '37.5', `${nom} : H titre, vendeur, prix payé de CET achat`, JSON.stringify(r && [r.titre, r.personne, r.prix]));
    await pg.waitForTimeout(500); r = await res(pg);
    dit(r && r.photo && /\/b23\//.test(r.photo.src), `${nom} : H la photo de CET achat`, JSON.stringify(r && r.photo));
    await shot('6-achat');
    await pg.waitForTimeout(2500);
    dit(JSON.stringify(await lire(pg, 'vinted_pickup_done')) === JSON.stringify(avant), `${nom} : I rien n'est écrit sans son toucher`, JSON.stringify(await lire(pg, 'vinted_pickup_done')));
    await pg.click('[data-scan-confirmer="r:v:9303"]');
    await pg.waitForTimeout(1500);
    let pd = await lire(pg, 'vinted_pickup_done');
    dit(JSON.stringify(cles(pd)) === '["9303"]' && typeof pd['9303'] === 'string' && !Number.isNaN(Date.parse(pd['9303'])), `${nom} : I « Retiré » ⇒ vinted_pickup_done[9303] seulement (jamais 9302)`, JSON.stringify(pd));
    await shot('7-retire');
    // I' : un e-mail de suivi, par SON n°.
    r = await scanner(pg, '90000021', 2);
    dit(r && r.etat === 'trouve' && /^r:e:/.test(r.cle || ''), `${nom} : I le n° de suivi d'un e-mail montre CE colis`, JSON.stringify(r && { etat: r.etat, cle: r.cle, t: r.titre }));
    await pg.click('[data-scan-confirmer]');
    await pg.waitForTimeout(1500);
    const coll = await lire(pg, 'vrm_colis_collected');
    dit(Array.isArray(coll) && coll.length === 1, `${nom} : I « Retiré » ⇒ vrm_colis_collected (le geste « J'ai retiré » d'un e-mail)`, JSON.stringify(coll));
    // J : deux colis au même code ; inconnu ; déjà retiré.
    r = await scanner(pg, '777777', 3);
    dit(r && r.etat === 'ambigu' && !r.bouton && /2 achats portent ce code/.test(r.message || ''), `${nom} : J deux colis au même code ⇒ dit, aucun bouton`, JSON.stringify(r && { etat: r.etat, m: r.message }));
    r = await scanner(pg, '999999', 4);
    dit(r && r.etat === 'inconnu' && !r.bouton && /Aucun achat/.test(r.message || ''), `${nom} : J code inconnu ⇒ dit, rien`, JSON.stringify(r && { etat: r.etat, m: r.message }));
    await shot('8-achat-inconnu');
    await pg.waitForTimeout(2600);
    r = await scanner(pg, '555002', 5);
    dit(r && r.etat === 'deja' && r.cle === 'r:v:9303' && !r.bouton, `${nom} : J un retiré reste retiré (« Déjà noté retiré »)`, JSON.stringify(r && { etat: r.etat, cle: r.cle }));
    pd = await lire(pg, 'vinted_pickup_done');
    dit(JSON.stringify(cles(pd)) === '["9303"]' && (await lire(pg, 'vrm_colis_collected') || []).length === 1, `${nom} : J rien de plus n'est écrit`, JSON.stringify(pd));
    const c = await cibles(pg);
    dit(c.length && c.every((x) => x.h >= 44), `${nom} : cibles ≥ 44 px (retrait)`, JSON.stringify(c));
    const d = await deborde(pg);
    dit(d.page <= 1 && !d.hors.length, `${nom} : rien ne déborde (retrait)`, JSON.stringify(d));
    await pg.click('[data-scan-fermer]');
    await pg.waitForTimeout(400);
    const pistes = await pg.evaluate(() => window.__pistes.map((t) => t.readyState));
    dit(pistes.length === 2 && pistes.every((x) => x === 'ended'), `${nom} : la caméra est coupée en sortant (retrait)`, JSON.stringify(pistes));
    // I'' : la même forme que « J'ai retiré » de la carte (9302).
    const clic = await cliquer(pg, '[data-cc-carte="r:v:9302"] [data-colis-retire]');
    await pg.waitForTimeout(1500);
    pd = await lire(pg, 'vinted_pickup_done');
    dit(clic && typeof pd['9302'] === typeof pd['9303'] && JSON.stringify(cles(pd)) === '["9302","9303"]', `${nom} : I la même écriture que « J'ai retiré » de la carte (même clé, même forme)`, JSON.stringify({ clic, pd }));
  });
  // SANS CAMÉRA (ordinateur sans webcam, ou refus) : le clavier prend la main.
  await essaie(`${nom} sans caméra`, async () => {
    await pg.evaluate(() => { window.__sansCamera = true; });
    await pg.click('[data-colis-scanner]');
    await pg.waitForSelector('[data-scan-sheet][data-scan-camera="sans"]', { timeout: 8000 }).catch(() => {});
    const m = await pg.evaluate(() => ({ cam: (document.querySelector('[data-scan-sheet]') || { getAttribute: () => null }).getAttribute('data-scan-camera'), dit: !!document.querySelector('[data-scan-sans-camera]'), focus: document.activeElement && document.activeElement.hasAttribute('data-scan-saisie') }));
    dit(m.cam === 'sans' && m.dit && m.focus, `${nom} : sans caméra ⇒ dit, et la saisie du n° a le curseur`, JSON.stringify(m));
    await pg.fill('[data-scan-saisie]', '012 345'); await pg.click('[data-scan-ok]');
    const r = await attendre(pg, 1);
    dit(r && r.etat === 'trouve' && r.cle === 'r:v:9301', `${nom} : sans caméra, le code tapé montre l'achat de CE code`, JSON.stringify(r && { etat: r.etat, cle: r.cle }));
    await shot('9-sans-camera');
    await pg.click('[data-scan-fermer]');
  });
  dit(envois.length === 0, `${nom} : aucune image envoyée (tout reste sur l'appareil)`, envois.slice(0, 3).join(' '));
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
    console.log(ko ? `\nKO scanner-colis-achats : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK scanner-colis-achats : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
