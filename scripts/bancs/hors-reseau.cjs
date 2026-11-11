require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « HORS RÉSEAU » (6 nov., v36) — au point relais, sans 4G, sur l'iPhone.
//
//  Ce que Julien vit : il arrive au comptoir, plus de réseau. Il rouvre VRM.
//  Ce banc MESURE, à 390 px tactile (et 1512 pour la mise en page) :
//   A. Colis rouvert hors réseau (jeton EXPIRÉ) après une lecture complète :
//      l'app s'ouvre ; l'écran est COLIS (pas Ma journée à sa place) ; UNE ligne
//      « Hors connexion — dernier état du <jour> à <heure> » ; « À retirer »
//      rangé par point relais (un point = une carte, son lieu) avec chaque code
//      et chaque QR ; « En grand » ouvre le code et le QR en grand SANS réseau ;
//      « J'ai retiré » est NOTÉ (en attente d'envoi, gardé sur l'appareil) et
//      rien n'arrive en base tant que le réseau manque ; les gestes qui ne
//      peuvent pas attendre (bordereau) sont refusés et dits ; au retour du
//      réseau, le geste ARRIVE en base (`vrm_colis_collected`).
//   B. Un dernier état VIEUX (30 h) : la date le dit, et une ligne dit qu'il a
//      plus de 12 h — jamais présenté comme frais.
//   C. Ma journée rouverte hors réseau : la même ligne, « Colis fait » noté.
//   D. Le réseau coupe PENDANT que Colis est ouvert (sans recharger) : l'écran
//      hors réseau de Colis prend la place, sans erreur.
//   E. Le service worker : sa réserve de coquille ne garde rien de personnel
//      (ni /api/, ni la base, ni une page qui porterait une donnée du vendeur).
//  Aucune fixture : tout est inventé (le banc vit dans le dépôt, public).
//  Lancer : BANC_PORT=12251 node scripts/bancs/hors-reseau.cjs
//  Rouge sur l'arbre d'avant : BANC_DIST=<dist d'avant> (§6.1).
// ════════════════════════════════════════════════════════════════════════════
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { servir } = require('./_minipgrest.cjs');
const { routeMain } = require('./_base-ecritures.cjs');
const { cspBanc, bilanCsp } = require('./_vercel.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));

const DIST = process.env.BANC_DIST ? path.resolve(process.env.BANC_DIST) : path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 12251;
const CAPT = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'vrm-bancs', 'hors-reseau');
fs.mkdirSync(CAPT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.zip': 'application/zip', '.onnx': 'application/octet-stream', '.wasm': 'application/wasm' };

const UID_A = '11111111-2222-3333-4444-555555555555';
const JETON = (() => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return b({ alg: 'HS256' }) + '.' + b({ sub: UID_A, aal: 'aal1', role: 'authenticated' }) + '.sig'; })();
const SESSION = { access_token: JETON, refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: UID_A, email: 'vendeuse@exemple.fr' }, totp: [] };
const COMPTE = { vinted_user_id: '900000001', login: 'compte-de-banc', owner: UID_A, access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString(), created_at: new Date().toISOString() };
const QR_URL = 'https://qr.exemple.test/api/barcode/AztecCode?d=PICKUPPASS:BANC';
const QR_VG = 'http://p.vintedgo.com/public/v1/qr_codes/BANC0000000000:C49341:BANC0000000000?v=1';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAAAAAA6mKC9AAAAHUlEQVR4nGNgYGD4z8DAwMDAxMDAwMDAwMDAwMAAAxQAAXy7tqQAAAAASUVORK5CYII=', 'base64');

const iso = (ms) => new Date(ms).toISOString();
const jour = (d) => { const x = new Date(Date.now() + d * 864e5); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const meta = (data) => { const m = {}; for (const [k, v] of Object.entries(data || {})) if (v == null || typeof v !== 'object') { if (String(v).length <= 600) m[k] = v; } return m; };
const ligne = (id, data) => ({ id, owner: UID_A, data, meta: meta(data), updated_at: iso(Date.now()) });

const VENTE = { transaction_id: 70001, title: 'Nike Air Max 1 banc', status: 'Le paiement a été validé', transaction_user_status: 'needs_action',
  price: { amount: '60.0', currency_code: 'EUR' }, date: iso(Date.now() - 2 * 864e5) };
const LIEU_MR = 'Tabac du Port Cancale', LIEU_VG = 'Consigne Vinted Go Laverie du Port';
const TRACK = { status: 'available', statusLabel: 'Arrivé au point de retrait', code: '4321', lieu: LIEU_MR, carrier: 'mondial_relay',
  suivi: 'MR999000111', artTitle: '', qrUrl: QR_URL, receivedAt: iso(Date.now() - 3600e3), limite: jour(5) };
const TRACK_VG = { status: 'available', statusLabel: 'Arrivé au point de retrait', code: 'C49341', lieu: LIEU_VG, carrier: 'vinted',
  suivi: 'VGSBANC000001', artTitle: '', qrUrl: QR_VG, receivedAt: iso(Date.now() - 2 * 3600e3), limite: jour(4) };
const ROWS = [
  ligne(`harvest_${COMPTE.vinted_user_id}_orders_sold`, { capturedAt: iso(Date.now()), payload: { my_orders: [VENTE] } }),
  ligne(`harvest_${COMPTE.vinted_user_id}_orders_purchased`, { capturedAt: iso(Date.now()), payload: { my_orders: [] } }),
  ligne('email_track_mondial_relay_MR999000111', TRACK),
  ligne('email_track_vinted_VGSBANC000001', TRACK_VG),
  ligne('panel_colis_relais', {}),
];
// Ce qui ne doit JAMAIS se trouver dans la réserve de coquille du service worker.
const PERSONNEL = ['Nike Air Max 1 banc', 'C49341', 'MR999000111', LIEU_MR, 'compte-de-banc', 'vendeuse@exemple.fr'];

const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});

let ko = 0;
// BANC_SEUL=A,E : seulement ces scénarios ; BANC_TAILLES=390 : seulement cette largeur.
const SEUL = (process.env.BANC_SEUL || '').split(',').filter(Boolean);
const joue = (x) => !SEUL.length || SEUL.includes(x);
const TAILLES = (process.env.BANC_TAILLES || '').split(',').filter(Boolean).map(Number);
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const attendre = async (pred, ms = 8000, pas = 200) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await pred()) return true; } catch (_) {} await new Promise((r) => setTimeout(r, pas)); } return false; };

// La base (faux Supabase) posée sur le CONTEXTE (elle voit aussi le service
// worker). `etat.hors` : tout échoue comme hors ligne. La ligne `main` est à
// ÉTAT et à la vraie forme (PATCH conditionnel sur `data.rev`, `routeMain`) :
// le banc juge ce que l'app ÉCRIT au retour du réseau.
async function brancher(ctx, etat) {
  const json = (route, d, extra, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: Object.assign({ 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, extra || {}), body: typeof d === 'string' ? d : JSON.stringify(d) });
  await ctx.route(/supabase\.co\/rest\/v1\//, (route) => {
    const req = route.request(); const u = req.url(); const h = req.headers();
    if (etat.hors) { if (req.method() !== 'GET' && req.method() !== 'OPTIONS') etat.tentativesHors = (etat.tentativesHors || 0) + 1; return route.abort('internetdisconnected'); }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (/select=owner/.test(u) && !/rpc/.test(u) && !/id=eq\.main/.test(decodeURIComponent(u))) return json(route, []);
    if (!String(h.authorization || '').includes(JETON)) return json(route, []);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return req.method() === 'GET' ? json(route, [COMPTE]) : json(route, []);
    if (/\/rest\/v1\/rpc\//.test(u)) return json(route, null);
    if (!/\/rest\/v1\/app_data/.test(u)) return json(route, [], { 'content-range': '*/0' });
    const m = routeMain(req, etat.main);
    if (m) return json(route, m.body, {}, m.status);
    if (req.method() !== 'GET') return json(route, []);
    const r = servir(ROWS, u, h);
    return json(route, r.body, { 'content-range': r.range });
  });
  await ctx.route(/supabase\.co\/auth\/v1\//, (route) => {
    if (etat.hors) return route.abort('internetdisconnected');
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ access_token: JETON, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) });
  });
  // (11 nov.) L'état de l'abonnement est servi : la porte « hors ligne à froid » (9 nov.) ne laisse
  // rouvrir sans réseau qu'un appareil qui CONNAÎT l'abonnement (`vrm_abo_dernier_{uid}`) ; `{}` la fermait.
  await ctx.route(/\/api\//, (route) => etat.hors ? route.abort('internetdisconnected') : route.fulfill({ status: 200, contentType: 'application/json', body: /mode=abonnement/.test(route.request().url()) ? JSON.stringify({ ok: true, acces: true, statut: 'active', configure: true }) : '{}' }));
  await ctx.route(/qr\.exemple\.test/, (route) => etat.hors ? route.abort('internetdisconnected') : route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await ctx.route(/^https?:\/\/p\.vintedgo\.com\//, (route) => etat.hors ? route.abort('internetdisconnected') : route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await ctx.route(/vinted\.net|fonts\.(googleapis|gstatic)\.com|jsdelivr|cdnjs/, (route) => route.abort());
}
const collectesEnBase = (etat) => { const d = etat.main.main || {}; return Array.isArray(d.vrm_colis_collected) ? d.vrm_colis_collected.map(String) : []; };
const faitsEnBase = (etat) => { const d = etat.main.main || {}; return d.vinted_ship_done && typeof d.vinted_ship_done === 'object' ? Object.keys(d.vinted_ship_done) : []; };

async function nouvelAppareil(nav, opts, nom) {
  const ctx = await nav.newContext(Object.assign({ timezoneId: 'Europe/Paris', locale: 'fr-FR' }, opts));
  await cspBanc(ctx, `http://localhost:${PORT}`, nom);
  const etat = { hors: false, main: { main: { rev: 1 }, maj: iso(Date.now() - 864e5), ecritures: [] } };
  await brancher(ctx, etat);
  await ctx.addInitScript(([s, uid]) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', uid); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' })); } catch (_) {} }, [SESSION, UID_A]);
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
  return { ctx, etat, pg, erreurs };
}
async function ouvrirEnLigne(pg, tab) {
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready).catch(() => {});
  if (!(await pg.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)))) await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1500);
}
const photoDe = (pg) => pg.evaluate((u) => { try { return JSON.parse(localStorage.getItem('vrm_hl_photo_' + u) || 'null'); } catch (_) { return null; } }, UID_A);
async function attendrePhotoEtQr(pg) {
  let photo = null;
  for (let i = 0; i < 40 && !(photo = await photoDe(pg)); i++) await pg.waitForTimeout(500);
  await attendre(async () => (await pg.evaluate(async () => (await (await caches.open('vrm-hl-qr')).keys()).length).catch(() => 0)) >= 2, 10000, 300);
  return photo;
}
async function couperEtRouvrir(c, tab, { expirer = true } = {}) {
  if (expirer) await c.pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('vrm_session')); s.expires_at = Date.now() - 3600e3; localStorage.setItem('vrm_session', JSON.stringify(s)); });
  c.etat.hors = true; await c.ctx.setOffline(true);
  await c.pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await c.pg.waitForSelector('[data-hors-ligne]', { timeout: 15000 }).catch(() => {});
  await c.pg.waitForTimeout(1200);
}
const RE_LIGNE = /^Hors connexion — dernier état du \d{1,2} [^\s]+ à \d{2}:\d{2}\b/;

async function main() {
  await new Promise((res, rej) => { srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est pris — relance ce banc seul`) : e)); srv.listen(PORT, res); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }].filter((v) => !TAILLES.length || TAILLES.includes(v.width))) {
      const T = vp.width < 600 ? '📱 390' : '🖥️ 1512';
      const opts = { viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) };

      // ── A. Colis rouvert hors réseau ──────────────────────────────────────
      console.log(`\n── ${T} · A. Colis rouvert hors réseau, au comptoir`);
      if (joue('A')) await essaie(`${T} A`, async () => {
        const c = await nouvelAppareil(nav, opts, `hors-reseau ${vp.width} A`);
        await ouvrirEnLigne(c.pg, 'cat_bord');
        const photo = await attendrePhotoEtQr(c.pg);
        dit(!!photo && photo.nRetirer === 2, 'en ligne, Colis ouvert : le dernier état est gardé sur l\'appareil', photo ? `${photo.nRetirer} à retirer` : 'aucun');
        await couperEtRouvrir(c, 'cat_bord');
        const r = await c.pg.evaluate(() => {
          const v = document.querySelector('[data-hors-ligne]');
          return {
            ouverte: !!document.querySelector('#root') && document.querySelector('#root').children.length > 0 && !/Connexion en cours/.test(document.body.innerText),
            vue: v && v.getAttribute('data-hors-ligne'),
            titre: (() => { const t = document.querySelector('[data-hl-titre]'); return t ? t.innerText.trim() : null; })(),
            lignes: [...document.querySelectorAll('[data-hors-ligne-ligne]')].map((x) => x.innerText.trim()),
            points: [...document.querySelectorAll('[data-hl-point]')].map((x) => ({ lieu: x.getAttribute('data-hl-point'), n: x.querySelectorAll('[data-hl-retrait]').length, txt: x.innerText })),
            codes: ['4321', 'C49341'].filter((k) => !!document.querySelector(`[data-hl-code="${k}"]`)),
            qr: [...document.querySelectorAll('[data-hl-qr]')].map((q) => ({ etat: q.getAttribute('data-hl-qr'), w: q.naturalWidth || 0 })),
            grand: document.querySelectorAll('[data-hl-en-grand-ouvrir]').length,
            refuse: [...document.querySelectorAll('[data-hl-refuse]')].map((x) => x.innerText.trim()),
            texte: document.body.innerText,
            debordement: document.documentElement.scrollWidth > window.innerWidth + 1,
            mdp: !!document.querySelector('input[type="password"]'),
          };
        });
        dit(r.ouverte && !r.mdp, 'hors réseau, l\'app s\'ouvre (ni page d\'erreur, ni écran de connexion)', `ouverte ${r.ouverte} · connexion ${r.mdp}`);
        dit(r.vue === 'colis' && r.titre === 'Colis', 'l\'écran est COLIS (pas Ma journée à sa place)', `vue ${r.vue} · titre ${JSON.stringify(r.titre)}`);
        dit(r.lignes.length === 1 && RE_LIGNE.test(r.lignes[0]), 'UNE ligne « Hors connexion — dernier état du <jour> à <heure> »', JSON.stringify(r.lignes));
        dit(!/Tout est à jour/i.test(r.texte), 'jamais « Tout est à jour » hors réseau');
        // Le lieu tel que la règle de l'app le nettoie (`cleanLieu` retire « Consigne Vinted Go »).
        const mr = r.points.find((p) => p.lieu === 'Tabac du Port Cancale'), vg = r.points.find((p) => p.lieu === 'Laverie du Port');
        dit(r.points.length === 2 && !!mr && !!vg && mr.n === 1 && vg.n === 1, 'À retirer : une carte par point relais, avec son lieu', JSON.stringify(r.points.map((p) => [p.lieu, p.n])));
        dit(r.codes.length === 2, 'les deux codes de retrait sont là', r.codes.join(','));
        dit(r.qr.length >= 2 && r.qr.every((q) => q.etat === 'ok' && q.w > 0), 'les QR s\'affichent sans réseau (réserve du service worker)', JSON.stringify(r.qr));
        dit(r.grand >= 2, '« En grand » est offert sur chaque colis qui a un code ou un QR', String(r.grand));
        // « En grand » SANS réseau.
        await c.pg.locator('[data-hl-en-grand-ouvrir]').first().click().catch(() => {});
        await c.pg.waitForSelector('[data-hl-en-grand]', { timeout: 4000 }).catch(() => {});
        await c.pg.waitForTimeout(600);
        const g = await c.pg.evaluate(() => {
          const s = document.querySelector('[data-hl-en-grand]'); if (!s) return null;
          const code = s.querySelector('[data-hl-en-grand-code]'); const img = s.querySelector('img[data-hl-en-grand-qr]');
          return { code: code ? code.innerText.replace(/\s/g, '') : '', taille: code ? parseFloat(getComputedStyle(code).fontSize) : 0, qr: img ? (img.complete && img.naturalWidth > 0) : null, qrL: img ? img.getBoundingClientRect().width : 0, txt: s.innerText };
        });
        await c.pg.screenshot({ path: path.join(CAPT, `A-en-grand-${vp.width}.png`) }).catch(() => {});
        dit(!!g && g.code === '4321' && g.taille >= 30 && g.qr === true && g.qrL >= 200, '« En grand » montre le code en très gros et le QR (≥ 200 px) hors réseau', g ? JSON.stringify({ code: g.code, taille: g.taille, qr: g.qr, qrL: Math.round(g.qrL) }) : 'rien ne s\'ouvre');
        dit(!!g && /Tabac du Port Cancale/.test(g.txt), 'et le lieu du point relais', g ? g.txt.replace(/\n/g, ' ¦ ').slice(0, 140) : '');
        await c.pg.keyboard.press('Escape').catch(() => {});
        await c.pg.waitForTimeout(500);
        if (await c.pg.locator('[data-hl-en-grand]').count()) await c.pg.locator('[data-hl-en-grand] button[aria-label="Fermer"]').first().click().catch(() => {});
        await c.pg.waitForTimeout(400);
        // « J'ai retiré » noté hors réseau.
        const avantTent = c.etat.tentativesHors || 0;
        const ecrAvant = c.etat.main.ecritures.length;
        await c.pg.locator('[data-hl-point="Tabac du Port Cancale"] [data-hl-retire-btn]').first().click().catch(() => {});
        await c.pg.waitForTimeout(1500);
        const n = await c.pg.evaluate(() => ({
          ligne: (() => { const x = document.querySelector('[data-hl-point="Tabac du Port Cancale"] [data-hl-retrait]'); return x ? x.getAttribute('data-hl-retire') : null; })(),
          // (11 nov.) Hors ligne, les gestes ont UNE pastille (« Hors ligne · N gestes en attente », src/gestesHorsLigne.js) :
          // la mention de la file se tait alors (le même nombre une fois). L'une ou l'autre dit l'attente.
          file: (() => { const e = document.querySelector('[data-file-envoi]'); if (e) return Number(e.getAttribute('data-file-envoi')); const g = document.querySelector('[data-gestes-attente]'); return g ? Number(g.getAttribute('data-gestes-attente')) : 0; })(),
          local: (() => { try { return JSON.parse(localStorage.getItem('vrm_colis_collected') || '[]'); } catch (_) { return null; } })(),
          enFile: (() => { try { return Object.keys((JSON.parse(localStorage.getItem('vrm_file_envoi') || '{}').cles) || {}); } catch (_) { return []; } })(),
        }));
        dit(n.ligne === 'attente', '« J\'ai retiré » hors réseau : le colis est noté « en attente d\'envoi »', String(n.ligne));
        dit(Array.isArray(n.local) && n.local.includes('MR999000111') && n.enFile.includes('vrm_colis_collected'), 'le geste est gardé sur l\'appareil et mis en file', JSON.stringify({ local: n.local, file: n.enFile }));
        dit(n.file >= 1, '« N changement(s) en attente d\'envoi » est dit', String(n.file));
        dit(c.etat.main.ecritures.length === ecrAvant && !collectesEnBase(c.etat).includes('MR999000111'), 'rien n\'arrive en base tant que le réseau manque', `${c.etat.main.ecritures.length - ecrAvant} écriture(s) · ${(c.etat.tentativesHors || 0) - avantTent} tentative(s) avortée(s)`);
        dit(r.refuse.length === 1 && /réseau/.test(r.refuse[0]), 'ce qui ne peut pas attendre (le bordereau) est refusé et dit, une fois', JSON.stringify(r.refuse));
        dit(!r.debordement, 'aucun débordement horizontal');
        await c.pg.screenshot({ path: path.join(CAPT, `A-colis-${vp.width}.png`), fullPage: true }).catch(() => {});
        // Le réseau revient : le geste part.
        c.etat.hors = false; await c.ctx.setOffline(false);
        await attendre(() => collectesEnBase(c.etat).includes('MR999000111'), 30000, 300);
        dit(collectesEnBase(c.etat).includes('MR999000111'), 'au retour du réseau, « J\'ai retiré » ARRIVE en base', JSON.stringify(collectesEnBase(c.etat)));
        await attendre(async () => (await c.pg.evaluate(() => !document.querySelector('[data-hors-ligne]') && !!document.querySelector('main')).catch(() => false)), 20000);
        await c.pg.waitForTimeout(2500);
        const apres = await c.pg.evaluate(() => ({ hl: document.querySelectorAll('[data-hors-ligne-ligne]').length, file: document.querySelectorAll('[data-file-envoi]').length, f: localStorage.getItem('vrm_file_envoi') })).catch(() => ({ hl: -1 }));
        dit(apres.hl === 0 && apres.file === 0 && !apres.f, 'puis la ligne hors réseau et la file disparaissent', JSON.stringify(apres));
        dit(c.erreurs.length === 0, 'aucune erreur d\'app', c.erreurs.join(' | '));
        await c.ctx.close();
      });

      // ── B. un dernier état vieux ──────────────────────────────────────────
      console.log(`\n── ${T} · B. un dernier état de 30 h n'est jamais présenté comme frais`);
      if (joue('B')) await essaie(`${T} B`, async () => {
        const c = await nouvelAppareil(nav, opts, `hors-reseau ${vp.width} B`);
        await ouvrirEnLigne(c.pg, 'cat_bord');
        await attendrePhotoEtQr(c.pg);
        await couperEtRouvrir(c, 'cat_bord');
        const vieux = Date.now() - 30 * 3600e3;
        await c.pg.evaluate(([u, at]) => { const p = JSON.parse(localStorage.getItem('vrm_hl_photo_' + u)); p.at = at; localStorage.setItem('vrm_hl_photo_' + u, JSON.stringify(p)); }, [UID_A, vieux]);
        await c.pg.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await c.pg.waitForSelector('[data-hors-ligne]', { timeout: 15000 }).catch(() => {});
        await c.pg.waitForTimeout(800);
        const r = await c.pg.evaluate(() => ({ lignes: [...document.querySelectorAll('[data-hors-ligne-ligne]')].map((x) => x.innerText.trim()), date: (document.querySelector('[data-hors-ligne-ligne]') || { getAttribute: () => null }).getAttribute('data-hors-ligne-date'), vieux: (document.querySelector('[data-hors-ligne-vieux]') || { innerText: null }).innerText }));
        const d = new Date(vieux); const attendu = `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'Europe/Paris' })}`;
        dit(r.lignes.length === 1 && r.lignes[0].includes(`dernier état du ${attendu} à`), 'la ligne dit le JOUR du dernier état (pas seulement une heure)', JSON.stringify(r.lignes) + ' · attendu ' + attendu);
        dit(r.date && Math.abs(Date.parse(r.date) - vieux) < 1000, 'sa date machine est celle du dernier état', String(r.date));
        dit(!!r.vieux && /plus de 12 h|plus d.un jour/.test(r.vieux), 'et une ligne dit qu\'il a plus de 12 h (à vérifier au comptoir)', JSON.stringify(r.vieux));
        await c.ctx.close();
      });

      // ── C. Ma journée rouverte hors réseau ───────────────────────────────
      console.log(`\n── ${T} · C. Ma journée rouverte hors réseau`);
      if (joue('C')) await essaie(`${T} C`, async () => {
        const c = await nouvelAppareil(nav, opts, `hors-reseau ${vp.width} C`);
        await ouvrirEnLigne(c.pg, 'journee');
        await attendrePhotoEtQr(c.pg);
        await couperEtRouvrir(c, 'journee');
        const r = await c.pg.evaluate(() => ({ vue: (document.querySelector('[data-hors-ligne]') || { getAttribute: () => null }).getAttribute('data-hors-ligne'), lignes: [...document.querySelectorAll('[data-hors-ligne-ligne]')].map((x) => x.innerText.trim()), codes: document.querySelectorAll('[data-hl-code]').length, colis: document.querySelectorAll('[data-hl-colis]').length }));
        dit(r.vue === 'photo' && r.codes === 2 && r.colis === 1, 'Ma journée : le dernier état (1 à envoyer, 2 codes)', JSON.stringify(r));
        dit(r.lignes.length === 1 && RE_LIGNE.test(r.lignes[0]), 'la même ligne « Hors connexion — dernier état du … »', JSON.stringify(r.lignes));
        await c.pg.locator('[data-hl-fait-btn]').first().click().catch(() => {});
        await c.pg.waitForTimeout(1500);
        const f = await c.pg.evaluate(() => ({ etat: (document.querySelector('[data-hl-colis]') || { getAttribute: () => null }).getAttribute('data-hl-fait'), local: (() => { try { return Object.keys(JSON.parse(localStorage.getItem('vinted_ship_done') || '{}')); } catch (_) { return null; } })() }));
        dit(f.etat === 'attente' && Array.isArray(f.local) && f.local.includes('70001'), '« Colis fait » hors réseau : noté, en attente d\'envoi', JSON.stringify(f));
        c.etat.hors = false; await c.ctx.setOffline(false);
        await attendre(() => faitsEnBase(c.etat).includes('70001'), 30000, 300);
        dit(faitsEnBase(c.etat).includes('70001'), 'au retour du réseau, « Colis fait » arrive en base', JSON.stringify(faitsEnBase(c.etat)));
        dit(c.erreurs.length === 0, 'aucune erreur d\'app', c.erreurs.join(' | '));
        await c.ctx.close();
      });

      // ── D. le réseau coupe pendant que Colis est ouvert ───────────────────
      console.log(`\n── ${T} · D. le réseau coupe pendant que Colis est ouvert`);
      if (joue('D')) await essaie(`${T} D`, async () => {
        const c = await nouvelAppareil(nav, opts, `hors-reseau ${vp.width} D`);
        await ouvrirEnLigne(c.pg, 'cat_bord');
        await attendrePhotoEtQr(c.pg);
        c.etat.hors = true; await c.ctx.setOffline(true);
        await c.pg.waitForSelector('[data-hors-ligne]', { timeout: 8000 }).catch(() => {});
        await c.pg.waitForTimeout(800);
        const r = await c.pg.evaluate(() => ({ vue: (document.querySelector('[data-hors-ligne]') || { getAttribute: () => null }).getAttribute('data-hors-ligne'), codes: document.querySelectorAll('[data-hl-code]').length }));
        dit(r.vue === 'colis' && r.codes === 2, 'Colis passe à son dernier état, sans recharger', JSON.stringify(r));
        dit(c.erreurs.length === 0, 'aucune erreur d\'app', c.erreurs.join(' | '));
        await c.ctx.close();
      });

      // ── E. la réserve du service worker ──────────────────────────────────
      if (vp.width < 600) {
        console.log(`\n── ${T} · E. ce que le service worker garde`);
        if (joue('E')) await essaie(`${T} E`, async () => {
          const c = await nouvelAppareil(nav, opts, `hors-reseau ${vp.width} E`);
          await ouvrirEnLigne(c.pg, 'cat_bord');
          await attendrePhotoEtQr(c.pg);
          await c.pg.reload({ waitUntil: 'domcontentloaded' }); await c.pg.waitForTimeout(2500);
          const r = await c.pg.evaluate(async (perso) => {
            const out = { caches: {}, perso: [] };
            for (const n of await caches.keys()) {
              const ca = await caches.open(n); const ks = await ca.keys();
              out.caches[n] = ks.map((k) => new URL(k.url).pathname + (new URL(k.url).search ? '?…' : ''));
              if (n === 'vrm-hl-qr') continue;
              for (const k of ks) { const t = await (await ca.match(k)).text().catch(() => ''); for (const p of perso) if (t.includes(p)) out.perso.push(new URL(k.url).pathname + ' ⊃ ' + p); }
            }
            return out;
          }, PERSONNEL);
          const coquille = Object.entries(r.caches).filter(([n]) => n !== 'vrm-hl-qr').flatMap(([, v]) => v);
          dit(coquille.length > 0 && coquille.every((p) => p === '/' || p === '/__vrm_build' || /^\/assets\//.test(p) || /^\/(brands\/)?[\w.-]+\.(png|svg|webmanifest|json|ico|woff2|js|css)$/.test(p)), 'la coquille ne garde que la page et les fichiers du build', JSON.stringify(coquille.filter((p) => !(p === '/' || p === '/__vrm_build' || /^\/assets\//.test(p)))));
          dit(!coquille.some((p) => /\/api\/|rest\/v1|auth\/v1/.test(p)), 'jamais une réponse de /api/ ni de la base');
          dit(r.perso.length === 0, 'aucune donnée du vendeur dans la coquille', r.perso.join(' | '));
          dit(Object.values(r.caches['vrm-hl-qr'] || []).every((p) => p === '/hl-qr?…'), 'la réserve des QR ne garde que des QR (adresses /hl-qr)', JSON.stringify(r.caches['vrm-hl-qr']));
          await c.ctx.close();
        });
      }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { await nav.close(); srv.close(); }
  ko += bilanCsp();
  console.log(ko ? `\n❌ hors-reseau : ${ko} rouge(s)` : '\n✅ hors-reseau : tout est vert');
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.log('❌ ' + e.message); process.exit(1); });
