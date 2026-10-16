// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES PHOTOS LEBONCOIN S'AFFICHENT DANS VRM, MÊME QUAND LE CDN REFUSE
//        (node scripts/bancs/photos-leboncoin.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 15 octobre : « Leboncoin : j'ai beau actualiser la page, les photos
// des annonces n'apparaissent pas ».
//
// MESURÉ sur sa base (lecture seule) avant ce banc :
//   · `lbc_listings.items[].images` = des CHAÎNES, toutes sur
//     `https://img.leboncoin.fr/api/v1/lbcpb1/images/…/<hash>.jpg?rule=ad-image`
//     (1 071 sur 1 071), sans signature ni date : pas des liens périmés ;
//   · `lbc_ventes` : 1 transaction sur 16 porte une `image` ; les 3 ventes
//     prouvées n'en ont aucune, alors que LEUR annonce (même `itemId`) est dans
//     `lbc_listings` avec ses photos ;
//   · l'écran rendait ces photos par un `<img>` ordinaire (référent compris,
//     aucun secours) : un refus du CDN laissait une case VIDE.
// Le refus du CDN de Leboncoin n'est pas mesurable d'ici (aucun appel à
// Leboncoin) : le banc sert donc un VRAI serveur HTTPS résolu sous le nom
// `img.leboncoin.fr` (`--host-resolver-rules`, certificat jetable) qui refuse
// pour de vrai (CORP same-site, ou 403 sur un référent) — un faux CDN servi par
// `page.route()` passe à côté de CORP (mesuré pour le banc photos-vinted).
//
// ⚠️ L'EXTENSION N'EST PAS SIMULÉE PAR UNE RÉPONSE FIGÉE : le pont de la page
//    envoie chaque demande `photo` au VRAI `background.js` de cet arbre (chargé
//    dans un `vm`, `scripts/_fond-vm.cjs`), dont le gestionnaire applique SA
//    liste blanche d'hôtes puis `photoBytes` — qui va chercher les octets au
//    faux CDN, hors de la page (ni CORP, ni référent), comme le service worker.
//    Une extension qui refuse `img.leboncoin.fr` rend donc `dataUrl: null` ici.
//
// Données INVENTÉES, aux FORMES mesurées (aucune fixture : il vit dans le dépôt).
// Il exige, à 1512 px et à 390 px tactile :
//   A. CDN qui refuse (CORP) + extension : Leboncoin → Annonces montre les
//      photos des annonces à relier (3 sur 3, par le secours) ; Ventes montre la
//      photo de la vente SANS image (celle de SON annonce, même identifiant) ;
//      Achats montre l'achat qui a sa photo, et l'achat sans photo garde le
//      pictogramme — JAMAIS la photo d'une autre annonce au MÊME TITRE (§5) ;
//      aucune case cassée ;
//   B. CDN qui refuse, SANS extension : aucune image cassée ni case vide, le
//      pictogramme à la place ;
//   C. CDN qui refuse un RÉFÉRENT : les photos s'affichent sans secours, et le
//      CDN n'a reçu AUCUN référent de VRM.
// On juge les éléments rendus (naturalWidth, source affichée), jamais un texte.
// Ports : PORT_BANC (5821) et PORT_CDN (5822).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const { faireFond } = require('../_fond-vm.cjs');
const fs = require('fs'), http = require('http'), https = require('https'), path = require('path'), os = require('os'), cp = require('child_process');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const FOND = path.join(__dirname, '..', '..', 'vinted-sync-extension', 'background.js');
const PORT = +process.env.PORT_BANC || 5821, PORT_CDN = +process.env.PORT_CDN || 5822;

const MAINTENANT = Date.now();
const hex = (n, l) => (n * 2654435761 >>> 0).toString(16).padStart(8, '0').repeat(Math.ceil(l / 8)).slice(0, l);
// La forme mesurée : /api/v1/lbcpb1/images/xx/xx/xx/<hash 40>.jpg?rule=ad-image
const IMG = (k, rule = 'ad-image') => `https://img.leboncoin.fr/api/v1/lbcpb1/images/${hex(k, 2)}/${hex(k + 1, 2)}/${hex(k + 2, 2)}/${hex(k, 40)}.jpg?rule=${rule}`;
const AD = (id, sujet, imgs, extra) => ({ id, subject: sujet, price: 40, status: 'active', images: imgs, url: 'https://www.leboncoin.fr/ad/chaussures/' + id, seenAt: new Date(MAINTENANT).toISOString(), ...extra });
const ITEMS = {
  '9100000001': AD('9100000001', 'Banc annonce à relier A', [IMG(1), IMG(2)], { lbcUser: 'u_banc' }),
  '9100000002': AD('9100000002', 'Banc annonce à relier B', [IMG(3)], { lbcUser: 'u_banc' }),
  // Vendue (la vente la désigne) : à relier, avec sa photo.
  '9100000003': AD('9100000003', 'Banc paire vendue', [IMG(5), IMG(6)], { account: 'acc_banc' }),
  // Le PIÈGE (§5) : une autre annonce, d'un autre compte, au MÊME TITRE qu'un
  // achat sans photo. Sa photo ne doit JAMAIS servir à cet achat.
  '9100000009': AD('9100000009', 'Banc achat sans photo', [IMG(9)], { account: 'autre_compte' }),
};
const VENTES = {
  // Mesuré : les ventes prouvées n'ont pas d'`image` ; leur annonce, si.
  '7100001': { txId: '7100001', itemId: '9100000003', isSeller: true, title: 'Banc paire vendue', price: 6000, stepStatus: 'validation', stepLabel: 'Paiement effectué', at: new Date(MAINTENANT).toISOString() },
  // Mesuré : un achat porte son image (`?rule=ad-thumb`).
  '7100002': { txId: '7100002', itemId: '9200000001', isSeller: false, title: 'Banc achat avec photo', price: 3000, stepStatus: 'validation', image: IMG(11, 'ad-thumb'), at: new Date(MAINTENANT).toISOString() },
  // Sans image, et son annonce n'est pas captée : un pictogramme, jamais la
  // photo de l'annonce 9100000009 (même titre, autre identifiant).
  '7100003': { txId: '7100003', itemId: '9200000002', isSeller: false, title: 'Banc achat sans photo', price: 2500, stepStatus: 'validation', at: new Date(MAINTENANT).toISOString() },
};
const HASH = { a1: hex(1, 40), a2: hex(3, 40), vendue: hex(5, 40), piege: hex(9, 40), achat: hex(11, 40) };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const ROWS = [
  { id: 'main', data: { vinted_annonce_numeros: { '8100': { numero: '12', title: 'Paire numérotée du banc' } } } },
  { id: 'harvest_111_listings', data: { uid: '111', capturedAt: new Date(MAINTENANT).toISOString(), nItems: 0, payload: { items: [], pagination: { total_entries: 0, total_pages: 1 } } } },
  { id: 'lbc_listings', data: { items: ITEMS } },
  { id: 'lbc_ventes', data: { ventes: VENTES } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const SEUL = process.env.SEUL || '';
const essaie = async (nom, f) => { if (SEUL && !nom.startsWith(SEUL)) return; try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 180)); } };

// ── Le faux CDN : un VRAI serveur HTTPS, certificat jetable ──
const PNG_CDN = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
const dirCert = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-lbc-cdn-'));
cp.execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dirCert, 'k.pem'), '-out', path.join(dirCert, 'c.pem'),
  '-days', '1', '-subj', '/CN=img.leboncoin.fr', '-addext', 'subjectAltName=DNS:img.leboncoin.fr'], { stdio: 'ignore' });
// Modes : ok · corp (CORP same-site : refusé hors de leboncoin.fr) · referent (403 sur tout référent).
const cdnEtat = { mode: 'corp', vues: [] };
const cdn = https.createServer({ key: fs.readFileSync(path.join(dirCert, 'k.pem')), cert: fs.readFileSync(path.join(dirCert, 'c.pem')) }, (q, r) => {
  cdnEtat.vues.push({ url: q.url, ref: q.headers.referer || '', ua: q.headers['user-agent'] || '' });
  if (cdnEtat.mode === 'referent' && q.headers.referer) { r.writeHead(403, { 'content-type': 'text/plain' }); return r.end('hotlink'); }
  const h = { 'content-type': 'image/png', 'cache-control': 'no-store' };
  if (cdnEtat.mode === 'corp') h['cross-origin-resource-policy'] = 'same-site';
  r.writeHead(200, h); r.end(PNG_CDN);
});
cdn.on('error', (e) => { console.log('KO  le port ' + PORT_CDN + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });

// ── Le VRAI fond de l'extension, dans un vm : son gestionnaire `photo` ──
// `photoBytes` va chercher les octets au faux CDN, hors de la page (Node).
const cdnFetch = (u) => new Promise((ok) => {
  let cible; try { cible = new URL(u); } catch (_) { ok({ ok: false, status: 0, headers: { get: () => '' }, arrayBuffer: async () => new ArrayBuffer(0) }); return; }
  const rq = https.request({ host: '127.0.0.1', port: PORT_CDN, servername: cible.hostname, path: cible.pathname + cible.search, method: 'GET', rejectUnauthorized: false, headers: { host: cible.hostname } }, (rs) => {
    const ch = []; rs.on('data', (c) => ch.push(c)); rs.on('end', () => {
      const buf = Buffer.concat(ch);
      ok({ ok: rs.statusCode >= 200 && rs.statusCode < 300, status: rs.statusCode, headers: { get: (k) => rs.headers[String(k).toLowerCase()] || null },
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });
    });
  });
  rq.on('error', () => ok({ ok: false, status: 0, headers: { get: () => '' }, arrayBuffer: async () => new ArrayBuffer(0) }));
  rq.end();
});
let fond = null;
const FOND_VU = { n: 0, ok: 0, refus: 0, hotes: {} };
function chargerFond() {
  fond = faireFond({ src: FOND });
  const orig = fond.ctx.fetch;
  fond.ctx.fetch = async (u, o) => {
    if (/^https:\/\/img\.leboncoin\.fr\//.test(String(u))) return cdnFetch(String(u));
    return orig(u, o);
  };
}

// ── L'application ──
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer(async (q, r) => {
  if (q.url === '/__banc-vide') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><title>banc</title>'); }
  if (q.url.startsWith('/__fond?')) {
    const u = new URL('http://x' + q.url).searchParams.get('u');
    FOND_VU.n++; try { FOND_VU.hotes[new URL(u).hostname] = (FOND_VU.hotes[new URL(u).hostname] || 0) + 1; } catch (_) {}
    let resp = null;
    try { resp = await fond.envoyer({ from: 'vmr-bridge', action: 'photo', url: u }); } catch (_) { resp = null; }
    // Le pont (bridge.js) ne relaie que `dataUrl` quand `ok`.
    const dataUrl = resp && resp.ok ? (resp.dataUrl || resp.data || null) : null;
    if (dataUrl) FOND_VU.ok++; else FOND_VU.refus++;
    r.writeHead(200, { 'content-type': 'application/json' }); return r.end(JSON.stringify({ dataUrl }));
  }
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

// Le pont de l'extension : le VRAI dialogue de vmrPhoto (`photo` → `photo:result`),
// chaque demande servie par le VRAI fond (`/__fond`).
const PONT = () => {
  window.__pont = { total: 0, rendues: 0, refusees: 0, urls: [] };
  const version = '5.177.0';
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: 'vendeur@exemple.test', user_id: 'u1' }, vinted: null, cmds: {} } });
    if (d.__vmr === 'photo') {
      const p = window.__pont; p.total++; p.urls.push(String(d.url));
      fetch('/__fond?u=' + encodeURIComponent(d.url)).then((r) => r.json()).catch(() => ({ dataUrl: null })).then((j) => {
        if (j.dataUrl) p.rendues++; else p.refusees++;
        post({ __vmr: 'photo:result', reqId: d.reqId, dataUrl: j.dataUrl || null });
      });
    }
  });
  post({ __vmr: 'ready', version, id: 'banc' });
};

async function preparer(b, vp, { pont = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, ignoreHTTPSErrors: true, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  if (pont) await pg.addInitScript(PONT);
  // Tout le reste d'Internet est coupé — sauf le faux CDN, qui passe par le VRAI
  // réseau de Chromium (c'est là que CORP s'applique).
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|img\.leboncoin\.fr)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, s = 200) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString() });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  // ⚠️ Les photos de Leboncoin vivent sous `/api/v1/…` : un `**/api/**` (la
  //    forme des autres bancs) les AVALAIT et leur servait du JSON — une image
  //    « cassée » fabriquée par le banc. Seules les routes de l'APP sont servies.
  await pg.route(`http://localhost:${PORT}/api/**`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}

// Ce que montre chaque case photo : affichée (et par quelle source), cassée,
// vide, ou le pictogramme. Une case = le premier conteneur photo d'un bloc.
const cases = (pg, quoi) => pg.evaluate(({ quoi, HASH }) => {
  const blocs = quoi === 'annonces'
    ? [...document.querySelectorAll('[data-lbc-relier]')]
    : [...document.querySelectorAll('.vrm-sale-row')];
  return blocs.map((bl) => {
    const titre = (bl.innerText || '').split('\n')[0].slice(0, 60);
    const zone = quoi === 'annonces' ? (bl.firstElementChild && bl.firstElementChild.firstElementChild) : (bl.querySelector('.vrm-sale-photo') || bl);
    const img = zone ? zone.querySelector('img') : null;
    const svg = zone ? zone.querySelector('svg') : null;
    const src = img ? (img.currentSrc || img.src || '') : '';
    const affichee = !!(img && img.complete && img.naturalWidth > 0);
    const cassee = !!(img && img.complete && img.naturalWidth === 0);
    const cle = Object.keys(HASH).find((k) => src.includes(HASH[k])) || (/^data:/.test(src) ? 'data' : (src ? 'autre' : ''));
    return { titre, img: !!img, affichee, cassee, picto: !img && !!svg, vide: !img && !svg, src: src.slice(0, 60), cle, parSecours: /^data:|^blob:/.test(src) };
  });
}, { quoi, HASH });
const ouvrir = async (pg, ms = 5000) => { await pg.goto(`http://localhost:${PORT}/?tab=plat_leboncoin`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(ms); };
const section = async (pg, id, ms = 4500) => { await pg.click(`[data-section="${id}"]`, { timeout: 8000 }); await pg.waitForTimeout(ms); };
const versBas = (pg, sel) => pg.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.scrollIntoView({ block: 'center' }); }, sel);
// Fait défiler bloc par bloc (les images paresseuses ne se chargent qu'à l'écran).
const parcourir = async (pg, sel) => {
  const n = await pg.evaluate((sel) => document.querySelectorAll(sel).length, sel);
  for (let i = 0; i < n; i++) { await pg.evaluate(({ sel, i }) => { const el = document.querySelectorAll(sel)[i]; if (el) el.scrollIntoView({ block: 'center' }); }, { sel, i }); await pg.waitForTimeout(700); }
  await pg.waitForTimeout(2500);
};
const capture = (pg, nom) => pg.screenshot({ path: path.join(os.tmpdir(), `photos-leboncoin-${nom}.png`), fullPage: false }).catch(() => {});
const garde = (pg) => pg.evaluate(() => (/n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(document.body.innerText) || [null])[0]);

(async () => {
  let b;
  await new Promise((ok) => srv.listen(PORT, ok));
  await new Promise((ok) => cdn.listen(PORT_CDN, '127.0.0.1', ok));
  try {
    chargerFond();
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', `--host-resolver-rules=MAP img.leboncoin.fr 127.0.0.1:${PORT_CDN}`] });

    // ── 0. Le banc mesure-t-il ce qu'il croit mesurer ? ──
    await essaie('0', async () => {
      const ctx = await b.newContext({ ignoreHTTPSErrors: true }); const pg = await ctx.newPage();
      await pg.goto(`http://localhost:${PORT}/__banc-vide`);
      const essai = (mode) => { cdnEtat.mode = mode; return pg.evaluate((u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth); i.onerror = () => ok(0); i.src = u + '&t=' + Math.random(); }), IMG(77)); };
      dit((await essai('corp')) === 0, '0. le faux CDN BLOQUE une image en CORP (sinon le banc mesurerait une fiction)');
      dit((await essai('ok')) > 0, '0. le faux CDN SERT une image sans CORP');
      const r = await fond.envoyer({ from: 'vmr-bridge', action: 'photo', url: 'https://images1.vinted.net/t/x/f800/1.jpeg' });
      dit(!!r, '0. le VRAI fond de l’extension répond au pont « photo »');
      await ctx.close();
    });

    for (const vp of [{ width: 1512, height: 900 }, { width: 390, height: 844 }]) {
      const T = vp.width;
      // ── A. CORP + extension ──
      await essaie(`A ${T}`, async () => {
        cdnEtat.mode = 'corp'; FOND_VU.n = 0; FOND_VU.ok = 0; FOND_VU.refus = 0; FOND_VU.hotes = {};
        const { ctx, pg, errs } = await preparer(b, vp, { pont: true });
        await ouvrir(pg);
        await parcourir(pg, '.vrm-sale-row');
        const v = await cases(pg, 'ventes');
        const vente = v.find((c) => /Banc paire vendue/.test(c.titre));
        dit(!!vente, `A ${T} : Leboncoin → Ventes montre la vente`, JSON.stringify(v));
        dit(!!(vente && vente.affichee && vente.cle !== 'piege'), `A ${T} : la vente SANS image montre une photo (celle de SON annonce)`, JSON.stringify(vente));
        await section(pg, 'achats');
        await parcourir(pg, '.vrm-sale-row');
        const a = await cases(pg, 'ventes');
        const aAvec = a.find((c) => /Banc achat avec photo/.test(c.titre));
        const aSans = a.find((c) => /Banc achat sans photo/.test(c.titre));
        dit(!!(aAvec && aAvec.affichee), `A ${T} : l’achat qui a sa photo l’affiche (CDN refusé → secours)`, JSON.stringify(aAvec));
        dit(!!(aSans && !aSans.img && aSans.picto), `A ${T} : l’achat sans photo garde le pictogramme`, JSON.stringify(aSans));
        dit(!a.some((c) => c.cle === 'piege') && !v.some((c) => c.cle === 'piege'), `A ${T} : aucune photo prise à une annonce au même titre (§5)`, JSON.stringify(a.map((c) => c.cle)));
        await section(pg, 'annonces', 6000);
        await parcourir(pg, '[data-lbc-relier]');
        const an = await cases(pg, 'annonces');
        await capture(pg, `A-${T}`);
        dit(an.length === 3, `A ${T} : 3 annonces Leboncoin à relier rendues`, JSON.stringify(an.map((c) => c.titre)));
        dit(an.length > 0 && an.every((c) => c.affichee), `A ${T} : leurs photos s’affichent (${an.filter((c) => c.affichee).length}/${an.length})`, JSON.stringify(an));
        dit(!an.some((c) => c.cassee || c.vide) && !a.some((c) => c.cassee || c.vide) && !v.some((c) => c.cassee || c.vide), `A ${T} : aucune case cassée ni vide`);
        const p = await pg.evaluate(() => window.__pont);
        dit(FOND_VU.ok > 0 && Object.keys(FOND_VU.hotes).every((h) => h === 'img.leboncoin.fr'), `A ${T} : le secours de l’extension (vrai fond) a rendu des photos Leboncoin, et rien d’autre ne lui a été demandé`, JSON.stringify({ FOND_VU, pont: p && { total: p.total, rendues: p.rendues } }));
        dit(!errs.length && !(await garde(pg)), `A ${T} : aucune erreur de page`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      // ── B. CORP, sans extension ──
      await essaie(`B ${T}`, async () => {
        cdnEtat.mode = 'corp';
        const { ctx, pg, errs } = await preparer(b, vp, { pont: false });
        await ouvrir(pg);
        await section(pg, 'annonces', 6000);
        await parcourir(pg, '[data-lbc-relier]');
        await pg.waitForTimeout(8000);   // au-delà de la grâce de l’extension (7 s)
        const an = await cases(pg, 'annonces');
        await capture(pg, `B-${T}`);
        dit(an.length === 3, `B ${T} : 3 annonces à relier rendues`);
        dit(an.every((c) => !c.cassee && !c.vide), `B ${T} : aucune case cassée ni vide (le CDN refuse, aucun secours)`, JSON.stringify(an));
        dit(an.every((c) => c.picto), `B ${T} : le pictogramme à la place de chaque photo`, JSON.stringify(an));
        dit(!errs.length && !(await garde(pg)), `B ${T} : aucune erreur de page`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      // ── C. Le CDN refuse un référent ──
      await essaie(`C ${T}`, async () => {
        cdnEtat.mode = 'referent'; cdnEtat.vues = [];
        const { ctx, pg, errs } = await preparer(b, vp, { pont: false });
        await ouvrir(pg);
        await parcourir(pg, '.vrm-sale-row');
        const v = await cases(pg, 'ventes');
        await section(pg, 'annonces', 6000);
        await parcourir(pg, '[data-lbc-relier]');
        const an = await cases(pg, 'annonces');
        dit(an.length === 3 && an.every((c) => c.affichee && !c.parSecours), `C ${T} : les photos des annonces s’affichent sans secours`, JSON.stringify(an));
        const vente = v.find((c) => /Banc paire vendue/.test(c.titre));
        dit(!!(vente && vente.affichee), `C ${T} : la vente montre la photo de son annonce`, JSON.stringify(vente));
        const avecRef = cdnEtat.vues.filter((x) => x.ref);
        dit(cdnEtat.vues.length > 0 && avecRef.length === 0, `C ${T} : le CDN n’a reçu aucun référent de VRM (${cdnEtat.vues.length} demandes)`, JSON.stringify(avecRef.slice(0, 2)));
        dit(!errs.length && !(await garde(pg)), `C ${T} : aucune erreur de page`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
    }
  } catch (e) {
    dit(false, 'le banc a pu s’exécuter', String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
  } finally {
    if (b) await b.close().catch(() => {});
    srv.close(); cdn.close();
    try { fs.rmSync(dirCert, { recursive: true, force: true }); } catch (_) {}
    console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTout est vert');
    process.exit(ko ? 1 : 0);
  }
})();
