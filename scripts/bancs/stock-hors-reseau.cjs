require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LE STOCK ET L'INVENTAIRE SANS RÉSEAU » (13 nov., point 45 de Julien :
//  un garage sans connexion).
//
//  Le réseau est VRAIMENT coupé (`context.setOffline(true)` : `navigator.onLine`
//  faux, le service worker sert la coquille) ET la base avorte chaque requête
//  comme un réseau absent. Base à ÉTAT et à la vraie forme : `main` par
//  `routeMain` (PATCH conditionnel sur `data->>rev`, garde-fou 017), la ligne
//  `vrm_inventaire` en comparer-et-échanger sur `data->>rev` (0 ligne = devancé).
//  Un compte et huit paires INVENTÉS (aucune `fx/`, dépôt public).
//   O  en ligne : le Stock lit ses paires (N° 1-6 en ligne, N°7 vendue encore
//      rangée, N°60 numérotée plus en ligne), les photos s'affichent ; le
//      service worker range les morceaux de l'app.
//   A  l'app FERMÉE puis rouverte SANS réseau sur le Stock : le dernier état
//      (N°, titre, emplacement « Étagère du garage », photo DÉJÀ VUE), la ligne
//      « Hors connexion — dernier état du … » ; jamais « Ma journée » à sa place,
//      jamais une liste vide, jamais « pas lu » comme si rien n'existait.
//   B  la recherche par N° : « 3 » ⇒ la N°3 seule (par identité, jamais la 30),
//      avec sa case ; « 99 » ⇒ rien, dit.
//   C  ce qui ne peut pas attendre (changer un N°, publier, ranger dans une case)
//      est DIT une fois (`data-hl-refuse`), jamais grisé en silence.
//   D  l'inventaire en entier hors réseau : « 1 » ⇒ ✓ attendu (neutre) ;
//      « 60 » ⇒ à vérifier (ambre) ; « 7 » ⇒ vendue (ambre) ; « 2 » ⇒ deux paires
//      sous un N° (le SEUL rouge) ; « Terminer » ⇒ le bilan ; AUCUNE requête
//      vers la base pendant la coupure.
//   E  l'app fermée puis rouverte encore hors réseau : les saisies sont là.
//   F  le réseau revient : les saisies arrivent dans `vrm_inventaire` UNE fois
//      (PATCH gardé sur `rev`) ; une écriture DEVANCÉE (un autre appareil a
//      écrit entre-temps) est relue et fusionnée — rien perdu, rien en double ;
//      rejouer ne réécrit rien.
//   G  AUCUN N° changé sur tout le banc (pool, fiches, cases) ; aucune erreur JS.
//  §6.1 : rouge sur le build d'avant (`BANC_DIST=<dist d'avant>`).
//  Lancer : npm run build ; BANC_PORT=19xxx node scripts/bancs/stock-hors-reseau.cjs
//  (BANC_SEUL=A,B… ; BANC_TAILLES=390|1512 ; BANC_THEME=sombre ; captures dans BANC_CAPTURES)
// ════════════════════════════════════════════════════════════════════════════
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { servir } = require('./_minipgrest.cjs');
const { routeMain, cleNum } = require('./_base-ecritures.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));

const DIST = process.env.BANC_DIST ? path.resolve(process.env.BANC_DIST) : path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 19123;
const CAPT = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'vrm-bancs', 'stock-hors-reseau');
fs.mkdirSync(CAPT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.zip': 'application/zip', '.onnx': 'application/octet-stream', '.wasm': 'application/wasm' };

const UID = '33333333-4444-5555-6666-777777777777';
const JETON = (() => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return b({ alg: 'HS256' }) + '.' + b({ sub: UID, aal: 'aal1', role: 'authenticated' }) + '.sig'; })();
const SESSION = { access_token: JETON, refresh_token: 'r', expires_at: Date.now() + 86400e3, user: { id: UID, email: 'garage@exemple.fr' }, totp: [] };
const VID = '900000555';
const COMPTE = { vinted_user_id: VID, login: 'compte-garage', owner: UID, access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString(), created_at: new Date(Date.now() - 60 * 864e5).toISOString() };
const iso = (ms) => new Date(ms).toISOString();
const frais = (ms) => iso(Date.now() - ms);
const meta = (data) => { const m = {}; for (const [k, v] of Object.entries(data || {})) if (v == null || typeof v !== 'object') { if (String(v).length <= 600) m[k] = v; } return m; };
const ligne = (id, data) => ({ id, owner: UID, data, meta: meta(data), updated_at: iso(Date.now()) });

// Six paires en ligne (N° 1 à 6), la N°7 VENDUE encore rangée, la N°60 numérotée plus en ligne.
const N = 6;
const IDS = Array.from({ length: N }, (_, i) => String(7400000001 + i));
const PHOTO = (id) => `https://images1.vinted.net/t/${id}/f800/garage.jpeg`;
const TITRES = ['Asics Gel garage 42', 'Nike Air garage 41', 'Adidas Samba garage 43', 'New Balance garage 40', 'Puma garage 44', 'Vans garage 39'];
const ITEMS = IDS.map((id, i) => ({ id: Number(id), title: TITRES[i], brand_title: TITRES[i].split(' ')[0], size_title: TITRES[i].slice(-2), status: 'Très bon état', price: { amount: String(60 + i) + '.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, favourite_count: 0, view_count: 2, created_at_ts: frais((i + 2) * 864e5), photo: { url: PHOTO(id), thumbnails: [{ type: 'thumb310x430', url: PHOTO(id) }] } }));
const FICHES = {}; IDS.forEach((id, i) => { FICHES[id] = { numero: String(i + 1), numberedAt: frais((i + 2) * 864e5), auto: false, manuelAt: frais((i + 2) * 864e5), title: TITRES[i], accountId: VID, photo: PHOTO(id) }; });
FICHES['7400000007'] = { numero: '7', numberedAt: frais(20 * 864e5), title: 'Reebok vendue garage 42', accountId: VID };
FICHES['7400000060'] = { numero: '60', numberedAt: frais(30 * 864e5), title: 'Converse plus en ligne 41', accountId: VID };
const MEUBLES = [{ id: 'mA', name: 'Étagère du garage', cols: 3, rows: 2 }];
const SLOTS = { '1': { m: 'mA', i: 0 }, '3': { m: 'mA', i: 1 }, '7': { m: 'mA', i: 2 } };
const MAIN0 = {
  vrm_prenom: 'Banc', vinted_dark: false, vinted_buyprice_by_num: {}, vinted_annonce_numeros: FICHES,
  vinted_used_numeros: ['1', '2', '3', '4', '5', '6', '7', '60'], vrm_meubles: MEUBLES, vrm_slots: SLOTS,
  vrm_stock_vendus: { nums: ['7'], at: Date.now() }, vrm_num_doublons: { nums: ['2'], at: Date.now() },
  vinted_nums_physiques: { nums: ['1', '2', '3', '4', '5', '6', '7'], at: Date.now() },
  vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' }, vinted_garage_view: 'meubles', rev: 3,
};
const LOCALES = { vrm_stock_vendus: { nums: ['7'], at: Date.now() }, vrm_num_doublons: { nums: ['2'], at: Date.now() }, vinted_nums_physiques: { nums: ['1', '2', '3', '4', '5', '6', '7'], at: Date.now() } };
const ROWS = [
  ligne(`harvest_${VID}_listings`, { capturedAt: frais(60e3), nItems: N, payload: { items: ITEMS, pagination: { total_entries: N } } }),
  ligne(`harvest_${VID}_enligne`, { capturedAt: frais(60e3), complet: true, n: N, ids: ITEMS.map((x) => x.id), items: ITEMS.map((x) => ({ id: x.id, title: x.title })) }),
  ligne(`harvest_${VID}_profile`, { capturedAt: frais(60e3), payload: { user: { id: Number(VID), login: 'compte-garage' } } }),
  ligne(`harvest_${VID}_orders_sold`, { capturedAt: frais(60e3), nItems: 0, payload: { my_orders: [] } }),
  ligne(`harvest_${VID}_orders_purchased`, { capturedAt: frais(60e3), nItems: 0, payload: { my_orders: [] } }),
  ligne('ebay_listings', { capturedAt: frais(3600e3), items: [] }),
  ligne('vc_listings', { capturedAt: frais(3600e3), items: {}, liens: {}, complet: true }),
];
// Une petite photo (PNG 2×2) servie pour chaque adresse de photo Vinted EN LIGNE.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');

const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});

let ko = 0, ok = 0;
const SEUL = (process.env.BANC_SEUL || '').split(',').filter(Boolean);
const joue = (x) => !SEUL.length || SEUL.includes(x);
const TAILLES = (process.env.BANC_TAILLES || '').split(',').filter(Boolean).map(Number);
const SOMBRE = process.env.BANC_THEME === 'sombre';
const dit = (bon, quoi, detail) => { if (bon) ok++; else ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le scénario a tourné jusqu’au bout', String(e && e.message).split('\n')[0].slice(0, 240)); } };
const attendre = async (pred, ms = 8000, pas = 200) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await pred()) return true; } catch (_) {} await new Promise((r) => setTimeout(r, pas)); } return false; };

// LA BASE. `app.hors` coupe l'appareil : chaque requête avorte ET est COMPTÉE (il
// ne doit en partir aucune vers la base). `inv` = la ligne `vrm_inventaire`.
const nouvelleBase = () => ({ main: { main: JSON.parse(JSON.stringify(MAIN0)), maj: frais(864e5), ecritures: [] }, inv: null, invEcritures: [], horsTentatives: [], photosServies: 0, devancer: null });
async function brancher(ctx, base, app) {
  const json = (route, d, extra, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: Object.assign({ 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, extra || {}), body: typeof d === 'string' ? d : JSON.stringify(d) }).catch(() => {});
  await ctx.route(/supabase\.co\/rest\/v1\//, async (route) => {
    const req = route.request(); const u = decodeURIComponent(req.url()); const meth = req.method();
    if (app.hors) { if (meth !== 'OPTIONS') base.horsTentatives.push(meth + ' ' + u.replace(/^.*\/rest\/v1\//, '').slice(0, 80)); return route.abort('internetdisconnected').catch(() => {}); }
    if (meth === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const surMain = /[?&]id=eq\.main(&|$)/.test(u);
    // La ligne de l'inventaire : GET, POST (409 si elle existe), PATCH gardé sur `data->>rev`.
    const corps = req.postData() || '';
    if (/id=eq\.vrm_inventaire/.test(u) || (meth === 'POST' && /"vrm_inventaire"/.test(corps))) {
      if (meth === 'GET') return json(route, base.inv ? [{ data: base.inv }] : []);
      if (meth === 'POST') {
        const rows = JSON.parse(corps || '[]'); const d = rows[0] && rows[0].data;
        if (base.inv) { base.invEcritures.push({ meth, resultat: 409 }); return json(route, { code: '23505' }, {}, 409); }
        base.inv = d; base.invEcritures.push({ meth, resultat: 201, data: d }); return json(route, '', {}, 201);
      }
      if (meth === 'PATCH') {
        // Un AUTRE appareil écrit juste avant (une fois) : l'écriture de celui-ci est devancée.
        if (base.devancer) { const f = base.devancer; base.devancer = null; f(base); }
        const attendu = /data->>rev=is\.null/.test(u) ? null : Number((/data->>rev=eq\.(\d+)/.exec(u) || [])[1]);
        const revL = base.inv && Number.isSafeInteger(base.inv.rev) ? base.inv.rev : null;
        if (!base.inv || attendu !== revL) { base.invEcritures.push({ meth, resultat: 0 }); return json(route, []); }
        const d = JSON.parse(corps || '{}').data; base.inv = d; base.invEcritures.push({ meth, resultat: 1, data: d });
        return json(route, [{ id: 'vrm_inventaire' }]);
      }
    }
    if (/select=owner/.test(u) && !/rpc/.test(u) && !surMain) return json(route, []);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return meth === 'GET' ? json(route, [COMPTE]) : json(route, []);
    if (/\/rest\/v1\/rpc\//.test(u)) return json(route, null);
    if (!/\/rest\/v1\/app_data/.test(u)) return json(route, [], { 'content-range': '*/0' });
    const m = routeMain(req, base.main);
    if (m) return json(route, m.body, {}, m.status);
    if (meth !== 'GET') return json(route, []);
    const r = servir(ROWS, req.url(), req.headers());
    return json(route, r.body, { 'content-range': r.range });
  });
  await ctx.route(/supabase\.co\/(auth|storage|functions)\/v1\//, (route) => (app.hors ? route.abort('internetdisconnected') : route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(/\/user/.test(route.request().url()) ? SESSION.user : { access_token: JETON, refresh_token: 'r', expires_in: 86400, user: SESSION.user }) })));
  await ctx.route(/\/api\//, (route) => (app.hors ? route.abort('internetdisconnected') : route.fulfill({ status: 200, contentType: 'application/json', body: /mode=confidentialite/.test(route.request().url()) ? JSON.stringify({ ok: true, uid: UID }) : /mode=abonnement/.test(route.request().url()) ? JSON.stringify({ ok: true, acces: true, statut: 'active', configure: true }) : '{"ok":true}' })));
  // Les photos Vinted : servies EN LIGNE (comme le CDN), rien hors ligne.
  await ctx.route(/vinted\.net\//, (route) => { if (app.hors) return route.abort('internetdisconnected').catch(() => {}); base.photosServies++; return route.fulfill({ status: 200, contentType: 'image/png', headers: { 'cache-control': 'public, max-age=31536000' }, body: PNG }).catch(() => {}); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|jsdelivr|cdnjs|openfreemap/, (route) => route.abort().catch(() => {}));
}
async function appareil(nav, base, vp, nom) {
  const ctx = await nav.newContext(Object.assign({ viewport: vp, timezoneId: 'Europe/Paris', locale: 'fr-FR', colorScheme: SOMBRE ? 'dark' : 'light' }, vp.width < 600 ? { isMobile: true, hasTouch: true } : {}));
  const app = { nom, hors: false, ctx, erreurs: [] };
  await brancher(ctx, base, app);
  await ctx.addInitScript(([s, uid, sombre, loc]) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', uid); localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.setItem('vinted_garage_view', JSON.stringify('meubles'));
    // Les clés LOCALES que publie l'écran Ventes (`vrm_stock_vendus`, `vrm_num_doublons`, `vinted_nums_physiques`) :
    // comme s'il avait ouvert Ventes la veille (la N°7 prouvée vendue, la N°2 portée par deux paires présentes).
    for (const [k, v] of Object.entries(loc)) if (localStorage.getItem(k) == null) localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }, [SESSION, UID, SOMBRE, LOCALES]);
  app.page = async () => { const pg = await ctx.newPage(); pg.on('pageerror', (e) => app.erreurs.push(String(e).slice(0, 200))); app.pg = pg; return pg; };
  app.couper = async () => { app.hors = true; await ctx.setOffline(true); };
  app.rebrancher = async () => { app.hors = false; await ctx.setOffline(false); };
  return app;
}
const URL0 = () => `http://localhost:${PORT}`;
const toucher = async (pg, tel, sel) => { const l = pg.locator(sel).first(); if (tel) await l.tap({ timeout: 8000 }); else await l.click({ timeout: 8000 }); };

// Ce que l'écran MONTRE d'une paire : par N° (identité), son emplacement, sa photo chargée.
// Jugé sur les data-* (§6.4) : `data-stock-annonce` / `data-stock-hl-num` = la clé du N°,
// `data-stock-annonce-place` / `data-stock-hl-place` = « meuble|rangée|colonne ».
const vue = (pg) => pg.evaluate(() => {
  const lignes = [...document.querySelectorAll('[data-stock-hl-num], [data-stock-annonce]')].filter((el) => el.getClientRects().length);
  const parNum = {};
  for (const el of lignes) {
    const k = el.getAttribute('data-stock-hl-num') || el.getAttribute('data-stock-annonce');
    const place = el.getAttribute('data-stock-hl-place') || el.getAttribute('data-stock-annonce-place') || '';
    const img = el.querySelector('img');
    parNum[k] = { place, photo: !!(img && img.complete && img.naturalWidth > 0), texte: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 120) };
  }
  const etat = document.querySelector('[data-stock-hl-etat]');
  const corps = (document.querySelector('main') || document.body).innerText || '';
  return { parNum, etat: etat ? { at: etat.getAttribute('data-stock-hl-etat'), texte: (etat.innerText || '').replace(/\s+/g, ' ') } : null,
    journee: document.querySelectorAll('[data-hors-ligne="journee"], [data-journee-hors-ligne]').length,
    horsConnexion: /Hors connexion[^.]*dernier état du \d{1,2}/i.test(corps), refus: [...document.querySelectorAll('[data-hl-refuse]')].filter((e) => e.getClientRects().length).map((e) => (e.innerText || '').replace(/\s+/g, ' ').slice(0, 160)),
    vide: /Aucune? (paire|annonce|article)|Je n'ai pas pu lire|pas lu/i.test(corps.slice(0, 2500)), extrait: corps.replace(/\s+/g, ' ').slice(0, 400) };
}).catch((e) => ({ erreur: String(e) }));
const lireRetour = (pg) => pg.evaluate(() => {
  const el = document.querySelector('[data-inv-retour]'); if (!el) return null;
  const t = el.querySelector('.vrm-inv-retour-t');
  return { etat: el.getAttribute('data-inv-retour'), couleur: t ? getComputedStyle(t).color : '', texte: el.innerText.replace(/\s+/g, ' ') };
}).catch(() => null);
const famille = (rgb) => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || ''); if (!m) return 'neutre';
  let [r, g, b] = [m[1], m[2], m[3]].map((x) => Number(x) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; }
  return s < 0.3 ? 'neutre' : (h >= 20 && h <= 50 ? 'ambre' : ((h >= 345 || h <= 12) ? 'rouge' : (h >= 195 && h <= 225 ? 'bleu' : 'autre')));
};
async function taper(pg, txt) { await pg.fill('[data-inv-champ]', txt); await pg.press('[data-inv-champ]', 'Enter'); await pg.waitForTimeout(300); }
// Les N° saisis (clé `k`) d'une ligne d'inventaire `{ courant, anciens }`, annulées exclues — une entrée par saisie.
const saisiesDe = (inv) => { const out = []; if (!inv || typeof inv !== 'object') return out; for (const s of [inv.courant, ...(Array.isArray(inv.anciens) ? inv.anciens : [])]) { if (!s || !s.saisies) continue; const mortes = s.annulees || {}; for (const [sid, x] of Object.entries(s.saisies)) if (x && x.k && !mortes[sid]) out.push(String(x.k)); } return out; };
const saisiesLocales = (pg) => pg.evaluate((uid) => { try { return JSON.parse(localStorage.getItem('vrm_inventaire_local_' + uid) || 'null'); } catch (_) { return null; } }, UID).then((l) => (l ? saisiesDe(l) : null)).catch(() => null);
const saisiesBase = (inv) => saisiesDe(inv);
const numerosIntacts = (d) => {
  const pa = new Set(MAIN0.vinted_used_numeros.map(cleNum)), pb = new Set((d.vinted_used_numeros || []).map(cleNum));
  const perdus = [...pa].filter((c) => !pb.has(c));
  const fb = d.vinted_annonce_numeros || {};
  const changes = Object.keys(FICHES).filter((id) => cleNum(FICHES[id].numero) !== cleNum((fb[id] || {}).numero));
  const cases = JSON.stringify(d.vrm_slots || {}) === JSON.stringify(SLOTS) ? [] : ['vrm_slots'];
  return { perdus, changes, cases };
};

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('dist absent : npm run build'); process.exit(2); }
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); });
  const nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const erreurs = [];
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }].filter((v) => !TAILLES.length || TAILLES.includes(v.width))) {
      const T = (vp.width < 600 ? '390' : '1512') + (SOMBRE ? '-sombre' : '');
      const tel = vp.width < 600;
      const base = nouvelleBase();
      const A = await appareil(nav, base, vp, 'A');
      let pg = await A.page();

      // ── O. en ligne ───────────────────────────────────────────────────────
      console.log(`\n── ${T} · O. en ligne`);
      await pg.goto(URL0() + '/?tab=garage', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await pg.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready).catch(() => {});
      await pg.goto(URL0() + '/?tab=garage', { waitUntil: 'domcontentloaded' }).catch(() => {});
      const lu = await attendre(async () => { const n = await pg.getAttribute('[data-stock-actuelles]', 'data-stock-actuelles').catch(() => null); return n != null && /^\d+$/.test(n); }, 40000);
      dit(lu && Number(await pg.getAttribute('[data-stock-actuelles]', 'data-stock-actuelles')) === N, `${T} O : en ligne, le Stock lit ses ${N} paires en ligne`, String(await pg.getAttribute('[data-stock-actuelles]', 'data-stock-actuelles').catch(() => '?')));
      await attendre(async () => { const v = await vue(pg); return Object.values(v.parNum || {}).filter((x) => x.photo).length >= 3; }, 15000);
      const v0 = await vue(pg);
      dit(Object.values(v0.parNum || {}).filter((x) => x.photo).length >= 3, `${T} O : en ligne, les photos s'affichent`, String(Object.values(v0.parNum || {}).filter((x) => x.photo).length));
      const rang = async () => pg.evaluate(async () => { try { const c = await caches.open('vrm-shell-v6'); const r = await c.match('/hors-ligne-assets.json'); if (!r) return { n: 0, sur: -1 }; const l = (await r.json()).fichiers || []; let n = 0; for (const f of l) if (await c.match(f)) n++; return { n, sur: l.length }; } catch (e) { return { n: 0, sur: -1 }; } }).catch(() => ({ n: 0, sur: -1 }));
      await attendre(async () => { const r = await rang(); return r.sur > 0 && r.n === r.sur; }, 120000, 500);
      const rr = await rang();
      dit(rr.sur > 10 && rr.n === rr.sur, `${T} O : les morceaux de l'app sont rangés pour le hors ligne`, `${rr.n}/${rr.sur}`);
      await pg.waitForTimeout(2500);   // le temps de garder le dernier état (et ses photos)
      await pg.screenshot({ path: path.join(CAPT, `O-en-ligne-${T}.png`) });

      // ── A. rouvert SANS réseau ────────────────────────────────────────────
      if (joue('A')) await essaie(`${T} A`, async () => {
        console.log(`\n── ${T} · A. l'app fermée, rouverte sans réseau`);
        await A.couper();
        await pg.close(); pg = await A.page();
        await pg.goto(URL0() + '/?tab=garage', { waitUntil: 'domcontentloaded' }).catch(() => {});
        await attendre(async () => Object.keys((await vue(pg)).parNum || {}).length >= N, 15000);
        await pg.waitForTimeout(1500);
        const v = await vue(pg);
        const nums = Object.keys(v.parNum || {}).map(cleNum);
        const manquent = ['1', '2', '3', '4', '5', '6'].filter((k) => !nums.includes(k));
        dit(!manquent.length, `${T} A : hors réseau, le Stock montre ses paires par N° (1 à 6)`, manquent.length ? 'manquent ' + manquent.join(',') + ' · ' + (v.extrait || v.erreur || '').slice(0, 200) : '');
        dit(!v.journee, `${T} A : le Stock, pas « Ma journée » à sa place`);
        dit(!!v.etat && /Hors connexion/.test(v.etat.texte) && /dernier état du \d{1,2}/.test(v.etat.texte) && Number.isFinite(Date.parse(v.etat.at)), `${T} A : « Hors connexion — dernier état du … » (daté)`, JSON.stringify(v.etat));
        const p1 = (v.parNum || {})['1'] || {}, p3 = (v.parNum || {})['3'] || {};
        dit(/^Étagère du garage\|/.test(p1.place) && /^Étagère du garage\|/.test(p3.place), `${T} A : l'emplacement de chaque paire rangée (Étagère du garage)`, JSON.stringify([p1.place, p3.place]));
        dit(/Étagère du garage/.test(p1.texte || ''), `${T} A : l'emplacement est écrit sur la ligne`, p1.texte);
        const avecPhoto = Object.entries(v.parNum || {}).filter(([, x]) => x.photo).map(([k]) => k);
        dit(avecPhoto.length >= 3, `${T} A : les photos déjà vues s'affichent hors réseau`, avecPhoto.join(','));
        dit(!v.vide, `${T} A : jamais « aucune paire » ni « pas lu » à la place du dernier état`, v.vide ? v.extrait.slice(0, 200) : '');
        await pg.screenshot({ path: path.join(CAPT, `A-stock-hors-reseau-${T}.png`) });
        await pg.screenshot({ path: path.join(CAPT, `A-stock-hors-reseau-plein-${T}.png`), fullPage: true }).catch(() => {});
      });

      // ── B. recherche par N° ───────────────────────────────────────────────
      if (joue('B')) await essaie(`${T} B`, async () => {
        console.log(`\n── ${T} · B. recherche par N° hors réseau`);
        const champ = pg.locator('[data-stock-hl-cherche], [data-stock-recherche] input').first();
        await champ.fill('3');
        await pg.waitForTimeout(500);
        const r = await pg.evaluate(() => [...document.querySelectorAll('[data-stock-hl-res], [data-stock-res]')].filter((e) => e.getClientRects().length).map((e) => ({ k: e.getAttribute('data-stock-hl-res') || e.getAttribute('data-stock-res'), t: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 100) }))).catch(() => []);
        dit(r.length === 1 && cleNum(r[0].k) === '3', `${T} B : « 3 » ⇒ la N°3 seule (par identité)`, JSON.stringify(r));
        dit(r.length === 1 && /Étagère du garage/.test(r[0].t), `${T} B : avec sa case`, r[0] && r[0].t);
        await pg.screenshot({ path: path.join(CAPT, `B-recherche-${T}.png`) });
        await champ.fill('99');
        await pg.waitForTimeout(400);
        const r2 = await pg.evaluate(() => ({ n: [...document.querySelectorAll('[data-stock-hl-res], [data-stock-res]')].filter((e) => e.getClientRects().length).length, rien: !!document.querySelector('[data-stock-hl-rien], [data-stock-rien]') })).catch(() => ({}));
        dit(r2.n === 0 && r2.rien, `${T} B : « 99 » ⇒ rien, et c'est dit`, JSON.stringify(r2));
        await champ.fill('');
      });

      // ── C. ce qui ne peut pas attendre ────────────────────────────────────
      if (joue('C')) await essaie(`${T} C`, async () => {
        console.log(`\n── ${T} · C. ce qui demande le réseau`);
        const v = await vue(pg);
        dit(v.refus.length === 1 && /N°/.test(v.refus[0]) && /(publi|mettre en ligne)/i.test(v.refus[0]), `${T} C : changer un N°, publier : dit UNE fois`, JSON.stringify(v.refus));
        const gris = await pg.evaluate(() => [...document.querySelectorAll('main button[disabled], main [aria-disabled="true"]')].filter((e) => e.getClientRects().length && !e.closest('[data-inventaire]')).map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40))).catch(() => ['?']);
        dit(!gris.length, `${T} C : aucun bouton grisé en silence`, JSON.stringify(gris));
      });

      // ── D. l'inventaire hors réseau ───────────────────────────────────────
      if (joue('D')) await essaie(`${T} D`, async () => {
        console.log(`\n── ${T} · D. l'inventaire en entier hors réseau`);
        const t0 = base.horsTentatives.length;
        await toucher(pg, tel, '[data-hl-inventaire-ouvrir], [data-stock-inventaire-ouvrir]');
        await pg.waitForSelector('[data-inventaire]', { timeout: 10000 });
        const deb = pg.locator('[data-inv-commencer]:not([disabled])');
        if (await deb.count()) await deb.first().click().catch(() => {});
        if (tel && (await pg.locator('[data-inv-pave-abc], [data-inv-clavier]').count())) await pg.locator('[data-inv-pave-abc], [data-inv-clavier]').first().click().catch(() => {});
        await pg.waitForSelector('[data-inv-champ]', { timeout: 8000 });
        const attendus = { '1': 'attendu', '60': 'trop', '7': 'vendu', '2': 'doublon' };
        for (const [n, e] of Object.entries(attendus)) {
          await taper(pg, n);
          const r = await lireRetour(pg);
          const fam = famille(r && r.couleur);
          const couleurJuste = e === 'attendu' ? fam === 'neutre' : e === 'doublon' ? fam === 'rouge' : fam === 'ambre';
          dit(r && r.etat === e && couleurJuste, `${T} D : « ${n} » ⇒ ${e} (${e === 'attendu' ? 'neutre' : e === 'doublon' ? 'rouge, le seul' : 'ambre'})`, JSON.stringify(r));
          if (e === 'doublon') await pg.screenshot({ path: path.join(CAPT, `D-doublon-${T}.png`) });
        }
        const hl = await pg.evaluate(() => { const e = document.querySelector('[data-inv-hors-ligne]'); return e ? (e.innerText || '').replace(/\s+/g, ' ') : null; }).catch(() => null);
        dit(!!hl && /Hors connexion/.test(hl) && /\d{1,2} \S+ à \d{2}:\d{2}/.test(hl), `${T} D : la feuille dit qu'elle juge contre la liste du … (hors connexion)`, hl);
        const l = await saisiesLocales(pg);
        dit(Array.isArray(l) && ['1', '60', '7', '2'].every((n) => l.includes(n)), `${T} D : les 4 saisies sont sur l'appareil`, JSON.stringify(l));
        await pg.screenshot({ path: path.join(CAPT, `D-inventaire-${T}.png`) });
        dit(base.horsTentatives.length === t0, `${T} D : aucune requête vers la base pendant la coupure`, base.horsTentatives.slice(t0, t0 + 3).join(' | '));
      });

      // ── E. rouvert encore hors réseau ─────────────────────────────────────
      if (joue('E')) await essaie(`${T} E`, async () => {
        console.log(`\n── ${T} · E. fermée puis rouverte hors réseau`);
        await pg.close(); pg = await A.page();
        await pg.goto(URL0() + '/?tab=garage', { waitUntil: 'domcontentloaded' }).catch(() => {});
        await attendre(async () => Object.keys((await vue(pg)).parNum || {}).length >= N, 15000);
        const l = await saisiesLocales(pg);
        dit(Array.isArray(l) && ['1', '60', '7', '2'].every((n) => l.includes(n)), `${T} E : les saisies attendent toujours sur l'appareil`, JSON.stringify(l));
        await toucher(pg, tel, '[data-hl-inventaire-ouvrir], [data-stock-inventaire-ouvrir]').catch(() => {});
        await pg.waitForSelector('[data-inventaire]', { timeout: 10000 }).catch(() => {});
        const deb = pg.locator('[data-inv-reprendre], [data-inv-commencer]:not([disabled])');
        if (await deb.count()) await deb.first().click().catch(() => {});
        if (tel && (await pg.locator('[data-inv-pave-abc], [data-inv-clavier]').count())) await pg.locator('[data-inv-pave-abc], [data-inv-clavier]').first().click().catch(() => {});
        await pg.waitForSelector('[data-inv-champ]', { timeout: 8000 });
        await taper(pg, '4');
        const r = await lireRetour(pg);
        dit(r && r.etat === 'attendu', `${T} E : la saisie reprend (« 4 » ⇒ attendu)`, JSON.stringify(r));
        // « Terminer » ⇒ le bilan, hors réseau.
        const fin = pg.locator('[data-inv-terminer]');
        if (await fin.count()) { await fin.first().click().catch(() => {}); await pg.waitForTimeout(600); const conf = pg.locator('.vrm-confirm button, [data-confirm-ok]'); if (await conf.count()) await conf.last().click().catch(() => {}); }
        await pg.waitForTimeout(800);
        const bilan = await pg.evaluate(() => { const el = document.querySelector('[data-inv-bilan]'); return el ? (el.innerText || '').replace(/\s+/g, ' ').slice(0, 300) : null; }).catch(() => null);
        dit(!!bilan, `${T} E : « Terminer » donne le bilan hors réseau`, bilan);
        await pg.screenshot({ path: path.join(CAPT, `E-bilan-${T}.png`) });
      });

      // ── F. le réseau revient ──────────────────────────────────────────────
      if (joue('F')) await essaie(`${T} F`, async () => {
        console.log(`\n── ${T} · F. le réseau revient`);
        // Un AUTRE appareil a sa ligne (sa session, N°5) ; il réécrit JUSTE AVANT le PATCH de
        // celui-ci (N°6 en plus) : la première écriture est DEVANCÉE (0 ligne) — relire, fusionner.
        const autre = { id: 'invautre', debut: Date.now() - 600e3, finAt: 0, reprisAt: 0, n: 1, saisies: { sz1: { k: '5', s: '5', at: Date.now() - 500e3 } }, annulees: {} };
        base.inv = { rev: 4, courant: autre, anciens: [] };
        base.devancer = (b) => { const a = JSON.parse(JSON.stringify(b.inv)); const s0 = [a.courant, ...(a.anciens || [])].find((x) => x && x.id === 'invautre'); if (s0) s0.saisies.sz2 = { k: '6', s: '6', at: Date.now() - 1000 }; a.rev = 5; b.inv = a; };
        const e0 = base.invEcritures.length;
        await pg.keyboard.press('Escape').catch(() => {});
        await A.rebrancher();
        await attendre(() => base.invEcritures.slice(e0).some((e) => e.resultat === 1 || e.resultat === 201), 30000);
        await pg.waitForTimeout(2500);
        const s = saisiesBase(base.inv);
        const fois = (n) => s.filter((x) => x === n).length;
        dit(['1', '60', '7', '2', '4'].every((n) => fois(n) === 1), `${T} F : les 5 saisies faites hors réseau arrivent, chacune UNE fois`, JSON.stringify(s));
        dit(fois('5') === 1 && fois('6') === 1, `${T} F : les saisies de l'autre appareil restent, même celle écrite pendant (rien perdu)`, JSON.stringify(s));
        dit(base.invEcritures.slice(e0).some((e) => e.resultat === 0), `${T} F : la première écriture a bien été devancée (comparer-et-échanger)`, JSON.stringify(base.invEcritures.slice(e0).map((e) => e.meth + ':' + e.resultat)));
        const acceptees = base.invEcritures.slice(e0).filter((e) => e.resultat === 1 || e.resultat === 201);
        dit(acceptees.length >= 1 && base.invEcritures.slice(e0).every((e) => e.meth === 'PATCH' || e.resultat === 409), `${T} F : écrit par PATCH gardé sur rev`, JSON.stringify(base.invEcritures.slice(e0).map((e) => e.meth + ':' + e.resultat)));
        const nAvant = base.invEcritures.length;
        await pg.evaluate(() => window.dispatchEvent(new Event('online'))).catch(() => {});
        await pg.waitForTimeout(3500);
        dit(base.invEcritures.slice(nAvant).filter((e) => e.resultat === 1).length === 0, `${T} F : rejouer ne réécrit rien`, JSON.stringify(base.invEcritures.slice(nAvant).map((e) => e.meth + ':' + e.resultat)));
        await pg.screenshot({ path: path.join(CAPT, `F-retour-${T}.png`) });
      });

      // ── G ──────────────────────────────────────────────────────────────────
      {
        const r = numerosIntacts(base.main.main || {});
        dit(!r.perdus.length && !r.changes.length && !r.cases.length, `${T} G : pool intact, aucun N° changé, cases intactes`, JSON.stringify(r));
      }
      erreurs.push(...A.erreurs);
      await A.ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  const js = erreurs.filter((m) => !/ResizeObserver|Failed to fetch|NetworkError|internet|vrm-hors-ligne/i.test(m));
  dit(js.length === 0, 'aucune erreur JS', js.slice(0, 3).join(' | '));
  console.log(`\n${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
