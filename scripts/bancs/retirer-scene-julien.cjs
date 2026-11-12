// ════════════════════════════════════════════════════════════════════════════
//  Banc : LA SCÈNE DE JULIEN, ACHATS → « À RETIRER » (12 nov., captures de production : « rien n'est cohérent »,
//  « c'est moche l'affichage », « tu tournes en rond… fais quelque chose de simple et de parfait »).
//  Base SYNTHÉTIQUE de la même forme (dépôt public, aucune donnée réelle) :
//   · Super U Accueil : 3 achats Vinted sans n° de suivi (un code lu chez Vinted, deux pas encore) et 2 colis
//     Chronopost Pickup avec code et QR (l'un se charge, l'autre ne répond pas) ;
//   · Intermarché : 3 colis Mondial Relay « changé de plan » que VRM vérifie chez le transporteur ;
//   · un Mondial Relay « Où vous livrer en cas de point indisponible ? » : il ROULE (pas à retirer) ;
//   · Maison de la Presse : un Mondial Relay avec son code ; un colis déjà RETIRÉ (pas à retirer).
//  Exige, sur les boîtes rendues : une ligne par colis à retirer (9), chacune de la même forme ; jamais un n° en titre ;
//  le bon logo (Chronopost / Mondial Relay) et le nom écrit ; les 3 « changé de plan » disent « Vérification chez
//  Mondial Relay en cours », neutre ; le roulant et le retiré ne sont pas à retirer ; un QR qui ne répond pas dit
//  « QR pas chargé — Réessayer » (jamais un rond vide) ; le dépli est une fiche. 390 tactile et 1512, clair et sombre.
//  `BANC_PORT`, `BANC_DIST`, `SHOTS=dossier` (les captures de la scène, à regarder).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
let chromium, PW;
try { PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright')); }
catch (_) { PW = require('playwright'); }
({ chromium } = PW);
// (6 nov., filet 6) `NAVIGATEUR=webkit` : le moteur de Safari (_navigateur.cjs).
const { lancer, estWebkit } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4437);
const maintenant = new Date(2026, 10, 3, 10, 19, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J), dans = (j) => iso(MS + j * J);
// Une date limite rangée a la forme d'un JOUR (« 2026-11-07 », la forme réelle des lignes).
const jourDans = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(MS) },
];
const cap = iso(MS);
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const achat = (id, titre, statut, k, extra = {}) => ({ transaction_id: id, conversation_id: 7000 + id % 1000, title: titre, price: { amount: '40', currency_code: 'EUR' }, status: statut, date: ilYa(5), photo: { url: url(k) }, ...extra });
const SHOTS = process.env.SHOTS || '';
const SUPERU = 'SUPER U ACCUEIL, 2 Avenue de la Mer, 35260 Cancale';
const INTER = 'INTERMARCHE, 10 Rue du Moulin, 35400 Saint-Malo';
const PRESSE = 'MAISON DE LA PRESSE, 4 Place de l’Église, 35260 Cancale';
const AU_RELAIS = 'Colis déposé en point relais';
const track = (carrier, suivi, code, lieu, extra = {}) => ({ id: `email_track_${carrier}_${suivi}`, data: Object.assign({ type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, receivedAt: ilYa(1), emailAt: ilYa(1), arriveLe: ilYa(1), code, lieu, limite: jourDans(5), consigne: false, account: 'compte_a' }, extra) });
const ACHATS_A = [
  achat(9301, 'Chemise lin bleue taille M', AU_RELAIS, 9, { transaction_user_status: 'needs_action' }),
  achat(9302, 'Pull marin écru taille L', AU_RELAIS, 10, { transaction_user_status: 'needs_action' }),
  achat(9303, 'Baskets cuir blanches 42', AU_RELAIS, 11, { transaction_user_status: 'needs_action' }),
];
const RELAIS = {
  9301: { code: '166386', lieu: SUPERU, transporteur: 'chronopost', at: ilYa(0) },
  9302: { code: null, lieu: SUPERU, transporteur: 'chronopost', at: ilYa(0) },
  9303: { code: null, lieu: SUPERU, transporteur: 'chronopost', at: ilYa(0) },
};
const QR_OK = 'https://qr.exemple.test/pickup/09447440008085.png', QR_KO = 'https://qr.exemple.test/pickup/07294012928553.png';
const TRACKS = [
  track('chronopost', '09447440008085', '620738', SUPERU, { qrUrl: QR_OK, limite: jourDans(3) }),
  track('chronopost', '07294012928553', '723461', SUPERU, { qrUrl: QR_KO, limite: jourDans(3) }),
  ...['84810905', '80459659', '80380675'].map((n, k) => track('mondialrelay', n, String(510000 + k), INTER, { aVerifierTransporteur: 'Retiré puis « changé de plan » : VRM le vérifie chez le transporteur' })),
  track('mondialrelay', '81112222', null, INTER, { status: 'transit', statusLabel: 'En cours de livraison', subject: 'Où vous livrer en cas de point indisponible ?', arriveLe: null }),
  track('mondialrelay', '88943000', '088943', PRESSE),
  track('mondialrelay', '87776666', '777666', PRESSE, { status: 'delivered', statusLabel: 'Colis retiré', retireLe: ilYa(0.5) }),
];
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Cancale' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: ACHATS_A } } },
  { id: 'harvest_222_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'panel_colis_relais', data: RELAIS },
  ...TRACKS,
];
// Une image de QR inventée (un damier 21×21, PNG fabriqué ici) pour l'adresse qui répond ; l'autre ne répond jamais.
const zlibQ = require('zlib');
const pngQr = (() => { const n = 21, px = 4, W = n * px; const raw = Buffer.alloc((W + 1) * W); for (let y = 0; y < W; y++) { raw[y * (W + 1)] = 0; for (let x = 0; x < W; x++) raw[y * (W + 1) + 1 + x] = ((Math.floor(x / px) * 7 + Math.floor(y / px) * 3) % 5 < 2) ? 0 : 255; }
  const crc = (b) => { let c, t = []; for (let k = 0; k < 256; k++) { c = k; for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[k] = c >>> 0; } let r = 0xffffffff; for (const v of b) r = t[(r ^ v) & 0xff] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const ch = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(W, 4); ih[8] = 8; ih[9] = 0; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlibQ.deflateSync(raw)), ch('IEND', Buffer.alloc(0))]); })();
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

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
const TEINTES = ['#dfe3e8', '#e8e1d8', '#dfe5dd', '#e6dcdc', '#e2dfe8', '#e8e4d6'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${TEINTES[k % 6]}"/><path d="M60 250 C80 190 150 175 190 200 C230 222 285 205 330 232 C352 246 346 282 306 284 L84 284 C62 284 52 268 60 250 Z" fill="rgba(30,34,40,.62)"/><path d="M60 284 L330 284 L326 300 L66 300 Z" fill="rgba(255,255,255,.85)"/><text x="200" y="120" font-size="90" text-anchor="middle" fill="rgba(0,0,0,.35)" font-family="sans-serif">${k}</text></svg>`;
const sacSvg = (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#efe9df"/><rect x="110" y="150" width="180" height="170" rx="18" fill="${c}"/><path d="M150 150 C150 80 250 80 250 150" stroke="${c}" stroke-width="16" fill="none"/></svg>`;

const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const m = /images1\.vinted\.net\/t\/b(\d+)\//.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(Number(m[1])) });
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
    // (12 nov.) le géocodage de l'app retombe sur Nominatim quand l'API Adresse ne trouve rien : servi vide aussi (garde réseau).
    if (/nominatim\.openstreetmap\.org/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    if (/\/favicon\.ico$/i.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="4" y="4" width="24" height="24" rx="5" fill="#8e8e93"/></svg>' });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  // (Playwright prend la DERNIÈRE route posée en premier : celle des QR vient après la garde réseau.)
  await pg.route(/qr\.exemple\.test/, (r) => (r.request().url().includes('09447440008085') ? r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: pngQr }) : r.abort('timedout')));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
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
  return { ctx, pg, errs };
};

const egalTous = (L, k) => new Set(L.map((l) => l[k])).size === 1 && L[0][k] != null;
(async () => {
  const b = await lancer(PW, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch((e) => { if (estWebkit) throw e; return chromium.launch(); });
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      console.log(`\n— La scène de Julien · ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      await essaie(nom, async () => {
        await pg.locator('[data-colis-section]').first().waitFor({ timeout: 30000 });
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' })));
        await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 });
        await pg.waitForFunction(() => document.querySelectorAll('.vrm-rpf .vrm-rpf-ligne[data-cc-carte]').length >= 9, null, { timeout: 30000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const shot = async (k) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `scene-${k}-${nom}.png`), fullPage: false }); };
        const pts = await pg.evaluate(() => [...document.querySelectorAll('.vrm-rpf-point')].map((p) => ({ nom: (p.querySelector('.vrm-rpf-nom') || {}).textContent || '', n: p.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]').length, tete: (p.querySelector('.vrm-rpf-n') || {}).textContent || '' })));
        for (const [i, p] of pts.entries()) { await pg.evaluate((i) => { const e = document.querySelectorAll('.vrm-rpf-point')[i]; if (e) e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -60); }, i); await pg.waitForTimeout(300); await shot(`point${i + 1}`); }
        const L = await pg.evaluate(() => [...document.querySelectorAll('.vrm-rpf .vrm-rpf-ligne[data-cc-carte]')].filter((l) => l.getBoundingClientRect().height > 0).map((l) => {
          const R = (e) => (e ? e.getBoundingClientRect() : null), n = (v) => (v == null ? null : Math.round(v));
          const r0 = R(l), vg = R(l.querySelector('.vrm-rpf-vignette')), bd = R(l.querySelector('.vrm-rpf-vignette .vrm-colis-logo-transp'));
          const t = l.querySelector('.vrm-rpf-titre'), rt = R(t), c = R(l.querySelector('.vrm-rpf-comptoir')), s3 = R(l.querySelector('.vrm-rpf-suivi-ligne')), d = R(l.querySelector('[data-rp-l4] .vrm-rpf-delai'));
          return { cle: l.getAttribute('data-cc-carte'), titre: t ? t.innerText.trim() : '', marque: (l.querySelector('.vrm-rpf-vignette [data-marque]') || { getAttribute: () => null }).getAttribute('data-marque'),
            vignette: vg && [n(vg.left - r0.left), n(vg.width)].join(','), logo: vg ? (() => { const ms = [...l.querySelectorAll('.vrm-rpf-vignette [data-marque]')].filter((e) => e.getBoundingClientRect().height > 0); const r = ms[0] && ms[0].getBoundingClientRect(); return ms.length === 1 && r.left >= vg.left - 6 && r.right <= vg.right + 6 && r.top >= vg.top - 6 && r.bottom <= vg.bottom + 6 ? 'un' : `${ms.length}`; })() : null,
            z2: c && rt ? n(c.top - rt.bottom) : null, z3: s3 && c ? n(s3.top - c.bottom) : null, z4: d && s3 ? n(d.top - s3.bottom) : null,
            verif: (l.querySelector('[data-rp-verif-transporteur] .vrm-rpf-delai-txt') || {}).textContent || '', verifNom: (l.querySelector('[data-rp-verif-transporteur] [role="progressbar"]') || { getAttribute: () => '' }).getAttribute('aria-valuetext') || '', verifAmbre: (l.querySelector('[data-rp-verif-transporteur] [data-rp-delai]') || { getAttribute: () => null }).getAttribute('data-rp-delai-ambre'),
            l3: (l.querySelector('.vrm-rpf-suivi-ligne') || {}).textContent || '', code: (l.querySelector('[data-code-retrait]') || { getAttribute: () => '' }).getAttribute('data-code-retrait') };
        }));
        // §5 (retraitPreuves) : un achat Vinted SANS n° au même point qu'un colis du transporteur est « peut-être le même » —
        // jamais relié par ressemblance, jamais compté deux fois : il garde SA ligne, dans « Comptés avec un autre colis ».
        const tous = await pg.evaluate(() => [...document.querySelectorAll('.vrm-rpf .vrm-rpf-ligne[data-cc-carte]')].map((l) => ({ titre: (l.querySelector('.vrm-rpf-titre') || {}).textContent || '', ou: (l.querySelector('[data-rp-code-ou]') || { getAttribute: () => null }).getAttribute('data-rp-code-ou'), sansCode: (l.querySelector('[data-rp-code-a-venir]') || {}).textContent || '', vu: l.getBoundingClientRect().height > 0 })));
        dit(L.length === 7 && tous.length === 9, `${nom} : 9 colis, une ligne chacun (7 comptés + 2 achats Vinted « peut-être le même »), ni le roulant ni le retiré`, L.map((l) => l.titre + ':' + l.code).join(' | ') + ' // ' + tous.length);
        dit(!L.some((l) => /777666/.test(l.code)) && !L.some((l) => /81112222/.test(l.cle)), `${nom} : le colis retiré et le « Où vous livrer… » (il roule) ne sont pas à retirer`);
        dit(['vignette', 'logo', 'z2', 'z3', 'z4'].every((k) => egalTous(L, k)), `${nom} : chaque ligne a la même forme (vignette, un seul logo par vignette, code, n°, délai aux mêmes places)`, ['vignette', 'logo', 'z2', 'z3', 'z4'].map((k) => k + '=' + [...new Set(L.map((l) => l[k]))].join('/')).join(' · '));
        dit(L.every((l) => !/^(N°\d+ · )?n°/i.test(l.titre)), `${nom} : jamais un n° de suivi en titre`, L.map((l) => l.titre).join(' | '));
        const chrono = L.filter((l) => /620738|723461/.test(l.code)), mr = L.filter((l) => /^5100|088943/.test(l.code));
        dit(chrono.length === 2 && chrono.every((l) => l.marque === 'chronopost' && /Colis Chronopost Pickup/.test(l.titre)) && mr.length === 4 && mr.every((l) => l.marque === 'mondialrelay' && /Colis Mondial Relay/.test(l.titre)), `${nom} : le bon logo et le nom écrit (Chronopost Pickup ≠ Mondial Relay)`, L.map((l) => `${l.titre}=${l.marque}`).join(' | '));
        const v = L.filter((l) => l.verif);
        dit(v.length === 3 && v.every((l) => /^Vérification en cours$/.test(l.verif) && /Vérification chez Mondial Relay en cours/.test(l.verifNom) && l.verifAmbre === '0'), `${nom} : les 3 « changé de plan » : « Vérification en cours » (le transporteur nommé pour le lecteur d'écran), neutre`, JSON.stringify(v.map((l) => [l.code, l.verif, l.verifAmbre])));
        const vinted = tous.filter((l) => /Chemise|Pull marin|Baskets cuir/.test(l.titre));
        dit(vinted.length === 3, `${nom} : les 3 achats Vinted sans n° gardent chacun leur ligne, au nom de l'article`, tous.map((l) => l.titre).join(' | '));
        const vSans = vinted.filter((l) => l.sansCode);
        dit(vSans.length === 2 && vSans.every((l) => l.ou === 'vinted' && /^Code sur Vinted$/.test(l.sansCode)), `${nom} : arrivé sans code ⇒ « Code sur Vinted » (où il est), jamais « Code à venir »`, JSON.stringify(vSans));
        dit(pts.some((p) => /SUPER U|Super U/i.test(p.nom) && p.n === 3 && /^3 colis/.test(p.tete)) && pts.some((p) => /^Intermarché$/.test(p.nom) && p.n === 3) && pts.some((p) => /^Super U\b/.test(p.nom)), `${nom} : Super U 3 colis comptés (2 Chronopost + l'achat au code lu), « Intermarché » (l'orthographe de l'enseigne) 3`, JSON.stringify(pts));
        // Le QR qui ne répond pas : dit, jamais un rond vide.
        const qr = await pg.evaluate(async () => {
          const l = [...document.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]')].find((x) => x.querySelector('[data-code-retrait="723461"]')); if (!l) return null;
          l.querySelector('.vrm-rpf-ouvrir').click(); l.scrollIntoView({ block: 'start' }); window.scrollBy(0, -60);
          for (let i = 0; i < 60 && !l.querySelector('[data-colis-qr-pas-charge]'); i++) await new Promise((r) => setTimeout(r, 250));
          const ko = l.querySelector('[data-colis-qr-pas-charge]'); const vide = [...l.querySelectorAll('[data-colis-qr] img')].filter((i) => i.getBoundingClientRect().height > 0 && !i.naturalWidth);
          return { message: ko ? ko.textContent.trim() : null, h: ko ? Math.round(ko.getBoundingClientRect().height) : 0, vide: vide.length, code: (l.querySelector('.vrm-rpf-code-gros') || {}).textContent || '' };
        });
        await shot('qr-ko-depli');
        dit(!!qr && qr.message === 'QR pas chargé — Réessayer' && qr.h >= 44 && !qr.vide && /723461/.test(qr.code), `${nom} : un QR qui ne répond pas ⇒ « QR pas chargé — Réessayer » (44 px), le code reste en gros, aucun rond vide`, JSON.stringify(qr));
        const qrOk = await pg.evaluate(async () => {
          const l = [...document.querySelectorAll('.vrm-rpf-ligne[data-cc-carte]')].find((x) => x.querySelector('[data-code-retrait="620738"]')); if (!l) return null;
          l.querySelector('.vrm-rpf-ouvrir').click(); l.scrollIntoView({ block: 'start' }); window.scrollBy(0, -60);
          for (let i = 0; i < 40; i++) { const im = l.querySelector('[data-colis-qr] img'); if (im && im.naturalWidth) break; await new Promise((r) => setTimeout(r, 250)); }
          const im = l.querySelector('[data-colis-qr] img'); const d = l.querySelector('[data-rp-detail]');
          return { w: im ? im.naturalWidth : 0, etat: (l.querySelector('[data-colis-qr]') || { getAttribute: () => null }).getAttribute('data-colis-qr-etat'), gestes: d ? [...d.querySelectorAll('.vrm-rp-gestes :is(button, a)')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.innerText.trim()) : [], detail: d ? d.innerText : '' };
        });
        await shot('qr-ok-depli');
        dit(!!qrOk && qrOk.w > 16 && qrOk.etat === 'ok', `${nom} : le QR qui répond s'affiche (pixels lus)`, JSON.stringify(qrOk));
        // La fiche : rien de technique, le code pas redit, une rangée de gestes sans doublon.
        dit(!!qrOk && !/VRM le lit|pas encore lu/.test(qrOk.detail) && qrOk.gestes.includes('Copier le code') && qrOk.gestes.includes('QR en grand') && !qrOk.gestes.some((g) => /620738/.test(g)) && !qrOk.gestes.some((g) => /^(Code )?en grand$/i.test(g)) && /Vérifié\s+e-mail, hier \d\d:\d\d/.test(qrOk.detail), `${nom} : la fiche — « Copier le code » · « QR en grand » · « Suivre », le code pas redit, rien de technique, « Vérifié · e-mail, hier 11:19 »`, JSON.stringify({ g: qrOk && qrOk.gestes, d: qrOk && qrOk.detail.replace(/\n/g, ' | ').slice(0, 300) }));
      });
      dit(!errs.length, `${nom} : aucune erreur`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} retirer-scene-julien : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
