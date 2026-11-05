// Banc : COLIS → « À RETIRER » — LE CODE ET LE QR RELIÉS, LES COMPTES MONDIAL RELAY (5 nov.).
// Julien (5 nov.) : « relier le code de retrait et le QR code » ; « plusieurs comptes Mondial Relay, et des
// colis arrivés par e-mail qui ne sont dans aucun compte » ; et (mot pour mot) « je ne peux pas avoir les qr
// code dans le navigateur c'est que dans l'app » : le QR Mondial Relay n'existe QUE dans l'app Mondial Relay.
// Les lignes `mr_colis_*` de ce banc portent EXPRÈS un champ `qr` : il doit être IGNORÉ (codes seulement).
// Le QR entre par « Ajouter le QR (capture) » : le banc FABRIQUE ses captures (PNG inventés : un QR dont le
// contenu est inventé, une capture sans QR) et les donne au vrai sélecteur de fichier. Données INVENTÉES :
//  · 81000001 : e-mail Mondial Relay (code) ET lu dans le compte « compte-mr-1 » (même code) ⇒ « QR dans l'app
//    Mondial Relay » ; sa capture (contenu « MRQR;81000001;100001 ») ⇒ QR posé, relu, « Retirer ce QR » ;
//  · 81000002 : e-mail Mondial Relay seul, reçu sur une autre adresse ⇒ « QR dans l'app », « dans aucun compte » ;
//  · 81000003 : lu dans « compte-mr-1 » seulement (aucun e-mail) ; 81000004 : lu dans « compte-mr-2 » seulement ;
//  · 81000005 : e-mail Mondial Relay d'un ACHAT LEBONCOIN (relié par le n° d'expédition de son lien de suivi) ;
//  · Chronopost avec code sans QR ⇒ « QR pas reçu » (Chronopost) ; Vinted Go code + QR hébergé.
//  · une vente Leboncoin à envoyer avec son QR de dépôt.
//  (revue adverse du 5 nov.) · 81000001 : l'e-mail porte le compte Vinted et la date d'arrivée ⇒ la ligne
//    fusionnée les GARDE (avant : la ligne du compte Mondial Relay gagnait et les effaçait) ;
//  · 81000006 : e-mail reçu APRÈS la dernière lecture des comptes ⇒ jamais « dans aucun de tes comptes » ;
//  · 81000007 : e-mail plus récent que la lecture, code DIFFÉRENT ⇒ le code montré est celui de l'e-mail, et
//    la phrase le dit (avant : « celui de ton compte Mondial Relay fait foi » sous le code de l'e-mail).
// Exige (data-* et nombres, §6.4) : 9 colis, chacun une fois (= vrm_colis_retirer) ; AUCUN QR venu d'un compte
// (81000001, 81000003 : « QR dans l'app Mondial Relay ») ; l'accord « confirmé », le compte nommé ; « QR pas
// reçu » + où le trouver sur le Chronopost ; « dans aucun de tes comptes » ; deux comptes Mondial Relay avec la
// fraîcheur de leurs codes ; l'explication animée (capture de l'app) ; aucune promesse d'un QR du navigateur ;
// « Ajouter le QR » : posé sur SON colis, relu à l'identique (jsQR dans Node sur les pixels affichés), un QR qui
// porte un AUTRE colis et une capture sans QR ⇒ rien posé et dit ; « En grand » : code ET QR, « Retirer ce QR » ;
// le QR de dépôt Leboncoin dans « À envoyer ».
// 390 tactile et 1512, clair et sombre. `SHOTS=dossier` garde les captures.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), zlib = require('zlib');
let qrcode, jsQR;
try { qrcode = require(path.join(__dirname, '..', '..', 'node_modules', 'qrcode-generator')); jsQR = require(path.join(__dirname, '..', '..', 'node_modules', 'jsqr')); }
catch (_) { qrcode = require('qrcode-generator'); jsQR = require('jsqr'); }
jsQR = jsQR.default || jsQR;
// ── LES CAPTURES DU BANC (PNG en niveaux de gris, écrits ici) : une « app » inventée avec, ou sans, un QR. ──
const crc = (b) => { if (zlib.crc32) return zlib.crc32(b) >>> 0; let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
const morceau = (type, data) => { const t = Buffer.from(type), l = Buffer.alloc(4), c = Buffer.alloc(4); l.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([l, t, data, c]); };
const ecrirePng = (w, h, gris) => {
  const brut = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) { brut[y * (w + 1)] = 0; gris.copy(brut, y * (w + 1) + 1, y * w, (y + 1) * w); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), morceau('IHDR', ihdr), morceau('IDAT', zlib.deflateSync(brut)), morceau('IEND', Buffer.alloc(0))]);
};
const capture = (contenu) => {
  const w = 590, h = 1280, g = Buffer.alloc(w * h, 255);
  const rect = (x0, y0, x1, y1, v) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g[y * w + x] = v; };
  rect(0, 0, w, 110, 230); rect(40, 150, 420, 180, 200); rect(40, 200, 300, 222, 215);   // barres de l'« app » inventée
  if (contenu) {
    const q = qrcode(0, 'M'); q.addData(contenu, 'Byte'); q.make();
    const n = q.getModuleCount(), cell = 10, x0 = Math.round((w - n * cell) / 2), y0 = 320;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) rect(x0 + c * cell, y0 + r * cell, x0 + (c + 1) * cell, y0 + (r + 1) * cell, 0);
  }
  rect(40, 1050, 550, 1110, 225);
  return ecrirePng(w, h, g);
};
const CAPTURE_ICI = 'MRQR;81000001;100001', CAPTURE_AUTRE = 'MRQR;81000002;100002';
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 7961);
const SHOTS = process.env.SHOTS || '';
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const maintenant = new Date(2026, 10, 5, 11, 0, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const jourDans = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const cap = iso(MS);
// Un QR INVENTÉ (un carré noir et blanc en SVG : il ne contient rien).
const QR = { type: 'image/svg+xml', b64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="#fff"/><rect width="2" height="2" fill="#000"/><rect x="2" y="2" width="2" height="2" fill="#000"/></svg>').toString('base64') };
const track = (carrier, suivi, lieu, code, extra = {}) => ({ id: `email_track_${carrier}_${suivi}`, data: Object.assign({ type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, receivedAt: ilYa(0.3), emailAt: ilYa(0.3), arriveLe: ilYa(0.3), code, lieu, limite: jourDans(5), consigne: false, account: '' }, extra) });
const LIEU = 'MAISON DU QUAI, 40 RUE DU QUAI, 35260 CANCALE';
const TRACKS = [
  track('mondialrelay', '81000001', LIEU, '100001', { recuSur: ['boite-a@exemple.fr'], account: 'compte_a', arriveLe: ilYa(1.2), receivedAt: ilYa(0.3), emailAt: ilYa(0.3) }),
  track('mondialrelay', '81000006', LIEU, '100006', { recuSur: ['boite-b@exemple.fr'], receivedAt: iso(MS - 60e3), emailAt: iso(MS - 60e3), arriveLe: iso(MS - 60e3) }),
  track('mondialrelay', '81000007', LIEU, '200007', { recuSur: ['boite-a@exemple.fr'], receivedAt: iso(MS - 60e3), emailAt: iso(MS - 60e3), arriveLe: iso(MS - 60e3) }),
  track('mondialrelay', '81000002', LIEU, '100002', { recuSur: ['boite-b@exemple.fr'] }),
  track('mondialrelay', '81000005', LIEU, '100005', { recuSur: ['boite-a@exemple.fr'] }),
  track('chronopost', 'XW100000001JB', 'RELAIS PICKUP DU PORT, 2 QUAI GAMBETTA, 35260 CANCALE', '700001'),
  track('vinted', 'VGS0000000000201', 'Consigne Vinted Go, Thé Bleu, 13 Rue Saint-Vincent, 56000 Vannes', 'A10201', { consigne: true, qrUrl: 'https://p.vintedgo.com/public/v1/qr_codes/exemple201' }),
];
const MR = [
  { id: 'mr_colis_a1', data: { v: 1, compte: { libelle: 'compte-mr-1' }, luAt: iso(MS - 3 * 60e3), complet: true, colis: [
    { suivi: '81000001', etat: 'disponible', code: '100001', qr: QR, lieu: LIEU, limite: jourDans(5), sens: 'entrant' },
    { suivi: '81000003', etat: 'disponible', code: '100003', qr: QR, lieu: LIEU, limite: jourDans(6), sens: 'entrant' },
    { suivi: '81000007', etat: 'disponible', code: '100007', qr: QR, lieu: LIEU, limite: jourDans(6), sens: 'entrant' },
    { suivi: '81000099', etat: 'disponible', code: '100099', qr: QR, lieu: LIEU, sens: 'sortant' },
  ] } },
  { id: 'mr_colis_b2', data: { v: 1, compte: { libelle: 'compte-mr-2' }, luAt: iso(MS - 2 * 3600e3), complet: true, colis: [
    { suivi: '81000004', etat: 'disponible', code: '100004', qr: QR, lieu: 'TABAC DE LA HOULE, 3 RUE HAUTE, 35260 CANCALE', limite: jourDans(3), sens: 'entrant' },
  ] } },
];
const LBC = { id: 'lbc_ventes', data: { ventes: {
  9001: { txId: 9001, isSeller: true, title: 'Exemple vendu sur Leboncoin', stepStatus: 'paid', stepLabel: 'Vente confirmée', at: ilYa(1), label: { voucherUrl: 'https://exemple.invalid/bordereau.pdf', qrUrl: 'https://api.leboncoin.fr/api/shippingproxy/exemple/qr' } },
  9002: { txId: 9002, isSeller: false, title: 'Exemple acheté sur Leboncoin', stepStatus: 'validation', at: ilYa(3), label: { trackingUrl: 'https://www.mondialrelay.com/public/permanent/tracking.aspx?ens=MRLBCOIN&exp=81000005&language=FR&CodePostal=35260' } },
} } };
const TOTAL = 9;
const lignes = (sombre) => [
  { id: 'main', data: { vinted_dark: sombre, vrm_ville: '' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'panel_colis_relais', data: {} },
  LBC, ...TRACKS, ...MR,
];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
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
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const LIGNES = lignes(sombre);
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); localStorage.setItem('vinted_dark', JSON.stringify(s)); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"type":"FeatureCollection","features":[]}' });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};
const carte = (pg, suivi) => pg.evaluate((k) => {
  const c = document.querySelector(`[data-cc-carte="r:e:${k}"]`); if (!c) return null;
  const a = (sel, at) => { const e = c.querySelector(sel); return e ? (at ? e.getAttribute(at) : e.textContent.trim()) : null; };
  return { site: c.getAttribute('data-site'), qrSource: a('[data-colis-qr]', 'data-colis-qr-source'), qrAbsent: a('[data-colis-qr-absent]', 'data-colis-qr-absent'), qrAbsentTxt: a('[data-colis-qr-absent]'),
    accord: a('[data-colis-code-accord]', 'data-colis-code-accord'), compteMr: a('[data-colis-compte-mr]', 'data-colis-compte-mr'), horsComptes: a('[data-colis-hors-comptes-mr]', 'data-colis-hors-comptes-mr'),
    achatSite: a('[data-colis-achat-site]', 'data-colis-achat-site'), plein: !!c.querySelector('[data-colis-plein-ecran]'), code: a('[data-code-retrait]', 'data-code-retrait'),
    compteSource: a('[data-colis-compte-source]', 'data-colis-compte-source'), accordTxt: a('[data-colis-code-accord]'), accordFoi: a('[data-colis-code-accord]', 'data-colis-code-foi'),
    compteVinted: a('[data-rp-suivi]', 'data-colis-compte'), arriveSur: a('[data-arrive-sur]', 'data-arrive-sur'), arriveLe: a('[data-arrive-le]', 'data-arrive-le'),
    ajouter: !!c.querySelector('[data-colis-qr-ajouter]'), ajout: a('[data-colis-qr-ajout]', 'data-colis-qr-ajout'), ajoutTxt: a('[data-colis-qr-ajout]') };
}, suivi);

(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, nom] of [[{ width: 390, height: 844 }, '390'], [{ width: 1512, height: 982 }, '1512']]) for (const sombre of [false, true]) {
      const tag = `${nom}-${sombre ? 'sombre' : 'clair'}`;
      console.log(`\n— Colis → À retirer · code et QR · ${tag}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      try {
        await pg.locator('[data-colis-onglet-choix="retirer"]').first().waitFor({ timeout: 30000 });
        await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return false; } }, null, { timeout: 20000 }).catch(() => {});
        // « À envoyer » d'abord : le QR de dépôt Leboncoin.
        await pg.locator('[data-colis-onglet-choix="envoyer"]').first().click();
        await pg.waitForTimeout(500);
        const lbc = await pg.evaluate(() => { const c = document.querySelector('[data-lbc-colis="9001"]'); return c ? { qr: !!c.querySelector('[data-lbc-qr-depot]') } : null; });
        dit(lbc && lbc.qr, '« À envoyer » : la vente Leboncoin porte son QR de dépôt', JSON.stringify(lbc));
        if (SHOTS && lbc) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.locator('[data-lbc-colis="9001"]').first().scrollIntoViewIfNeeded().catch(() => {}); await pg.screenshot({ path: path.join(SHOTS, `qr-lbc-${tag}.png`) }); }
        await pg.locator('[data-colis-onglet-choix="retirer"]').first().click();
        await pg.waitForFunction((n) => document.querySelectorAll('.vrm-colis-retirer [data-cc-carte]').length >= n, TOTAL, { timeout: 10000 }).catch(() => {});
        await pg.waitForTimeout(400);
        const base = await pg.evaluate(() => ({
          cles: [...document.querySelectorAll('.vrm-colis-retirer [data-cc-carte]:not([data-hors-compte])')].map((c) => c.getAttribute('data-cc-carte')),
          pub: (() => { try { return JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return null; } })(),
          comptes: [...document.querySelectorAll('[data-mr-comptes] [data-mr-compte]')].map((l) => ({ cle: l.getAttribute('data-mr-compte'), n: l.getAttribute('data-mr-compte-n'), txt: l.textContent })),
          explique: !!document.querySelector('[data-mr-explique] [data-explique-mr]'),
          pasEncore: !!document.querySelector('[data-mr-pas-encore]'),
        }));
        const pub = base.pub && Number.isFinite(base.pub.total) ? base.pub.total : null;
        dit(base.cles.length === TOTAL && new Set(base.cles).size === TOTAL && pub === TOTAL, `les ${TOTAL} colis, chacun une fois (e-mails + comptes Mondial Relay, = vrm_colis_retirer)`, `${base.cles.join(',')} · pub ${pub}`);
        dit(base.cles.includes('r:e:81000003') && base.cles.includes('r:e:81000004') && !base.cles.includes('r:e:81000099'), 'les colis lus dans les comptes sans e-mail sont là ; un colis ENVOYÉ (sortant) n’entre pas');
        dit(base.comptes.length === 2 && /codes relus il y a 3 min/.test((base.comptes.find((c) => c.cle === 'a1') || {}).txt || '') && /codes relus il y a 2 h/.test((base.comptes.find((c) => c.cle === 'b2') || {}).txt || ''), 'deux comptes Mondial Relay, la fraîcheur de leurs CODES (« relus il y a 3 min », « il y a 2 h »)', JSON.stringify(base.comptes));
        dit(base.explique && !base.pasEncore, 'l’explication animée est là ; plus de « ne relève pas encore… le QR est dans ton compte »');
        // Ouvre chaque ligne (le détail porte le code, le QR et les gestes).
        for (const k of base.cles) { const o = pg.locator(`[data-cc-carte="${k}"] .vrm-rpf-ouvrir`).first(); if (await o.count()) { const e = await o.getAttribute('aria-expanded'); if (e !== 'true') await o.click(); } }
        await pg.waitForTimeout(300);
        const c1 = await carte(pg, '81000001'), c2 = await carte(pg, '81000002'), c3 = await carte(pg, '81000003'), c4 = await carte(pg, '81000004'), c5 = await carte(pg, '81000005'), ch = await carte(pg, 'XW100000001JB');
        const MR_APP = /^QR dans l’app Mondial Relay/;
        dit(c1 && c1.qrSource == null && c1.qrAbsent === 'mondialrelay' && MR_APP.test(c1.qrAbsentTxt || '') && c1.ajouter && c1.accord === 'confirme' && c1.compteMr === 'compte-mr-1' && c1.code === '100001',
          '81000001 : le « QR » de la ligne du compte est IGNORÉ ⇒ « QR dans l’app Mondial Relay », « Ajouter le QR » ; code « confirmé », compte nommé', JSON.stringify(c1));
        dit(c1 && c1.compteVinted === 'compte_a' && c1 && c1.arriveSur === 'oui' && c1.arriveLe === jourDans(-1.2).slice(0, 10), '81000001 : la ligne fusionnée garde le compte Vinted et la date d’arrivée de l’e-mail', JSON.stringify({ compte: c1 && c1.compteVinted, sur: c1 && c1.arriveSur, le: c1 && c1.arriveLe }));
        const c6 = await carte(pg, '81000006'), c7 = await carte(pg, '81000007');
        dit(c6 && c6.horsComptes == null && c6.compteSource === 'email', '81000006 : e-mail reçu après la dernière lecture des comptes ⇒ jamais « dans aucun de tes comptes »', JSON.stringify(c6));
        dit(c7 && c7.code === '200007' && c7.accordFoi === 'email' && !/compte Mondial Relay[^:]*fait foi/.test(c7.accordTxt || '') , '81000007 : code de l’e-mail plus récent montré, et la phrase dit que c’est lui qui fait foi', JSON.stringify(c7));
        dit(c2 && c2.qrAbsent === 'mondialrelay' && MR_APP.test(c2.qrAbsentTxt || '') && !/compte|site|mondialrelay\.fr/i.test(c2.qrAbsentTxt || '') && c2.horsComptes === '1' && c2.plein && c2.ajouter, '81000002 : « QR dans l’app Mondial Relay » (ni compte ni site), « dans aucun de tes comptes », le code en grand, « Ajouter le QR »', JSON.stringify(c2));
        dit(c3 && c3.qrSource == null && MR_APP.test(c3.qrAbsentTxt || '') && c3.compteMr === 'compte-mr-1' && c3.code === '100003', '81000003 (compte seul) : son code, et aucun QR (le compte n’en a pas)', JSON.stringify(c3));
        dit(c4 && c4.compteMr === 'compte-mr-2', '81000004 : le second compte Mondial Relay nommé', JSON.stringify(c4));
        dit(c5 && c5.site === 'leboncoin' && c5.achatSite === 'leboncoin', '81000005 : l’achat Leboncoin, relié par le n° de suivi', JSON.stringify(c5));
        dit(ch && ch.qrAbsent === 'chronopost' && /^QR pas reçu/.test(ch.qrAbsentTxt || '') && /Chronopost/.test(ch.qrAbsentTxt || '') && !ch.ajouter, 'Chronopost sans QR : « QR pas reçu » + l’e-mail Pickup Pass (pas de capture proposée)', JSON.stringify(ch));
        if (SHOTS) { await pg.locator('[data-cc-carte="r:e:81000001"]').first().scrollIntoViewIfNeeded().catch(() => {}); await pg.screenshot({ path: path.join(SHOTS, `qr-cartes-${tag}.png`) }); }
        // L'explication, ouverte : le seul chemin du QR (une capture de l'app).
        await pg.locator('[data-mr-explique] > summary').first().click().catch(() => {});
        await pg.waitForTimeout(400);
        const exp = await pg.evaluate(() => { const e = document.querySelector('[data-explique-mr]'); return e ? { chemin: e.getAttribute('data-explique-mr-chemin'), txt: e.textContent } : null; });
        const page = await pg.evaluate(() => document.body.innerText);
        dit(exp && exp.chemin === 'capture' && /App Mondial Relay/.test(exp.txt) && /Ajouter le QR/.test(exp.txt) && !/mondialrelay\.fr/.test(exp.txt), 'l’explication : app Mondial Relay ⇒ capture ⇒ « Ajouter le QR »', exp && exp.txt.slice(0, 120));
        dit(!/colis et leurs QR|Ouvrir Mondial Relay \(QR\)|site ou application|QR[^\n]{0,60}mondialrelay\.fr/i.test(page), 'aucun texte de l’écran ne promet un QR Mondial Relay lu par le navigateur');
        if (SHOTS) { await pg.locator('[data-mr-bloc]').first().scrollIntoViewIfNeeded().catch(() => {}); await pg.screenshot({ path: path.join(SHOTS, `qr-explique-${tag}.png`) }); }
        const debExp = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        // « En grand » sans QR (81000001) : le code en gros, « QR dans l’app », « Ajouter le QR » ; le lien suit le colis.
        await pg.locator('[data-cc-carte="r:e:81000001"] [data-colis-plein-ecran]').first().click();
        await pg.waitForSelector('[data-qr-plein]', { timeout: 5000 }).catch(() => {});
        const v0 = await pg.evaluate(() => { const v = document.querySelector('[data-qr-plein]'); return v ? { code: v.getAttribute('data-qr-plein-code'), img: v.getAttribute('data-qr-plein-img'), absent: v.querySelector('[data-qr-plein-absent]') ? v.querySelector('[data-qr-plein-absent]').textContent : null, ajouter: !!v.querySelector('[data-qr-plein-ajouter]'), txt: v.textContent } : null; });
        dit(v0 && v0.code === '100001' && v0.img === '0' && /^QR dans l’app Mondial Relay/.test(v0.absent || '') && v0.ajouter && !/Ouvrir Mondial Relay \(QR\)/.test(v0.txt) && /Suivre le colis/.test(v0.txt), '« En grand » sans QR : le code, « QR dans l’app Mondial Relay », « Ajouter le QR » ; plus de « Ouvrir Mondial Relay (QR) »', JSON.stringify(v0 && { ...v0, txt: undefined }));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `qr-plein-sans-${tag}.png`) });
        // « Ajouter le QR » DANS la vue : le vrai sélecteur de fichier reçoit la capture du banc.
        const [ch1] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 5000 }), pg.locator('[data-qr-plein-ajouter]').first().click()]);
        await ch1.setFiles({ name: 'capture-app-mondial-relay.png', mimeType: 'image/png', buffer: capture(CAPTURE_ICI) });
        await pg.waitForFunction(() => { const v = document.querySelector('[data-qr-plein]'); return v && v.getAttribute('data-qr-plein-img') === '1'; }, null, { timeout: 15000 }).catch(() => {});
        await pg.waitForFunction(() => { try { const p = JSON.parse(localStorage.getItem('vrm_colis_qr_poses') || 'null'); return !!(p && p['81000001']); } catch (_) { return false; } }, null, { timeout: 5000 }).catch(() => {});
        await pg.waitForTimeout(200);
        const v1 = await pg.evaluate(() => { const v = document.querySelector('[data-qr-plein]'); if (!v) return null; const im = v.querySelector('img[alt="QR de retrait"]');
          let px = null; if (im && im.complete && im.naturalWidth) { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0); px = { w: c.width, h: c.height, d: Array.from(x.getImageData(0, 0, c.width, c.height).data) }; }
          let poses = null; try { poses = JSON.parse(localStorage.getItem('vrm_colis_qr_poses') || 'null'); } catch (_) {}
          return { code: v.getAttribute('data-qr-plein-code'), img: v.getAttribute('data-qr-plein-img'), src: v.getAttribute('data-qr-plein-source'), lum: !!v.querySelector('[data-qr-plein-luminosite]'), retirer: !!v.querySelector('[data-qr-plein-retirer]'),
            ajout: (v.querySelector('[data-qr-plein-ajout]') || { getAttribute: () => null }).getAttribute('data-qr-plein-ajout'), px, poses }; });
        const reluPage = v1 && v1.px ? jsQR(Uint8ClampedArray.from(v1.px.d), v1.px.w, v1.px.h) : null;
        const pose = v1 && v1.poses && v1.poses['81000001'];
        dit(v1 && v1.code === '100001' && v1.img === '1' && v1.src === 'capture' && v1.lum && v1.retirer && v1.ajout === 'pose', '« Ajouter le QR » : la capture lue DANS la page, le QR posé sur CE colis, montré avec le code, « Retirer ce QR »', JSON.stringify(v1 && { ...v1, px: v1.px ? `${v1.px.w}×${v1.px.h}` : null, poses: v1.poses ? Object.keys(v1.poses) : null }));
        dit(reluPage && reluPage.data === CAPTURE_ICI && pose && pose.contenu === CAPTURE_ICI && Object.keys(v1.poses).length === 1, 'le QR affiché, relu par jsQR (Node) sur ses PIXELS, rend exactement le contenu de la capture ; rangé sous SON n° seulement', reluPage ? reluPage.data : 'illisible');
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `qr-plein-${tag}.png`) });
        await pg.locator('[data-qr-plein] [data-feuille-croix], [data-qr-plein] button:has-text("Fermer")').first().click();  // (5 nov., chantier D) la croix de la SheetShell
        await pg.waitForTimeout(300);
        const c1b = await carte(pg, '81000001');
        dit(c1b && c1b.qrSource === 'capture' && !c1b.qrAbsent && !c1b.ajouter, 'la carte de 81000001 porte maintenant le QR de sa capture', JSON.stringify(c1b && { s: c1b.qrSource, a: c1b.qrAbsent }));
        // Un QR qui porte un AUTRE colis (81000002), choisi sur 81000006 ⇒ rien posé, dit.
        const [ch2] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 5000 }), pg.locator('[data-cc-carte="r:e:81000006"] [data-colis-qr-ajouter]').first().click()]);
        await ch2.setFiles({ name: 'capture-autre.png', mimeType: 'image/png', buffer: capture(CAPTURE_AUTRE) });
        await pg.waitForFunction(() => { const e = document.querySelector('[data-cc-carte="r:e:81000006"] [data-colis-qr-ajout]'); return e && e.getAttribute('data-colis-qr-ajout') !== 'lecture'; }, null, { timeout: 15000 }).catch(() => {});
        const c6b = await carte(pg, '81000006');
        const poses2 = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_colis_qr_poses') || 'null'); } catch (_) { return null; } });
        dit(c6b && c6b.ajout === 'autre' && /81000002/.test(c6b.ajoutTxt || '') && /rien/.test(c6b.ajoutTxt || '') && c6b.qrSource == null && poses2 && !poses2['81000006'], 'un QR qui porte le n° d’un AUTRE colis ⇒ rien n’est posé, et c’est dit', JSON.stringify(c6b && { e: c6b.ajout, t: c6b.ajoutTxt }));
        if (SHOTS) { await pg.locator('[data-cc-carte="r:e:81000006"]').first().scrollIntoViewIfNeeded().catch(() => {}); await pg.screenshot({ path: path.join(SHOTS, `qr-refus-${tag}.png`) }); }
        // Une capture sans QR, sur 81000002 ⇒ rien posé, dit.
        const [ch3] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 5000 }), pg.locator('[data-cc-carte="r:e:81000002"] [data-colis-qr-ajouter]').first().click()]);
        await ch3.setFiles({ name: 'capture-vide.png', mimeType: 'image/png', buffer: capture('') });
        await pg.waitForFunction(() => { const e = document.querySelector('[data-cc-carte="r:e:81000002"] [data-colis-qr-ajout]'); return e && e.getAttribute('data-colis-qr-ajout') !== 'lecture'; }, null, { timeout: 15000 }).catch(() => {});
        const c2b = await carte(pg, '81000002');
        dit(c2b && c2b.ajout === 'aucun' && c2b.qrSource == null, 'une capture sans QR lisible ⇒ rien n’est posé, et c’est dit', JSON.stringify(c2b && { e: c2b.ajout, t: c2b.ajoutTxt }));
        // « Retirer ce QR » (81000001) ⇒ la pose part, la carte redit « QR dans l’app Mondial Relay ».
        await pg.locator('[data-cc-carte="r:e:81000001"] [data-colis-plein-ecran]').first().click();
        await pg.waitForSelector('[data-qr-plein-retirer]', { timeout: 5000 }).catch(() => {});
        await pg.locator('[data-qr-plein-retirer]').first().click().catch(() => {});
        // `save` range la clé après 500 ms (anti-rebond) : on attend l'écriture, pas un délai fixe.
        await pg.waitForFunction(() => { try { const p = JSON.parse(localStorage.getItem('vrm_colis_qr_poses') || 'null'); return !!p && !p['81000001']; } catch (_) { return false; } }, null, { timeout: 5000 }).catch(() => {});
        const v3 = await pg.evaluate(() => { const v = document.querySelector('[data-qr-plein]'); let p = null; try { p = JSON.parse(localStorage.getItem('vrm_colis_qr_poses') || 'null'); } catch (_) {} return v ? { img: v.getAttribute('data-qr-plein-img'), ajouter: !!v.querySelector('[data-qr-plein-ajouter]'), poses: p } : null; });
        dit(v3 && v3.img === '0' && v3.ajouter && v3.poses && !v3.poses['81000001'], '« Retirer ce QR » : retiré sur son clic, « Ajouter le QR » revient', JSON.stringify(v3));
        await pg.locator('[data-qr-plein] [data-feuille-croix], [data-qr-plein] button:has-text("Fermer")').first().click();  // (5 nov., chantier D) la croix de la SheetShell
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        dit(deb <= 1 && debExp <= 1, 'rien ne déborde', `${deb} / ${debExp}`);
        dit(!errs.length, 'aucune erreur de page', errs.join(' | ').slice(0, 300));
      } catch (e) { dit(false, 'le banc a pu s’exécuter', String(e.message || e).slice(0, 200)); }
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
