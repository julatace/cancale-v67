// ════════════════════════════════════════════════════════════════════════════
//  BANC — LES ALERTES DE PRODUCTION (11 nov.)
//         BANC_PORT=… node scripts/bancs/alertes-production.cjs
// ════════════════════════════════════════════════════════════════════════════
//  La VRAIE app (`dist`) et les VRAIES routes : chaque appel `/api/compte`
//  (`mode=mesures`, `mode=alertes`) est servi par api/compte.js exécuté ici,
//  dans node, contre une fausse base de forme PostgREST. Le push est simulé
//  (`_bancAlertes.pousser`).
//   1. Une erreur JavaScript non rattrapée, levée 3 fois dans la page (avec un
//      e-mail et un prix dedans) ⇒ le lot des temps réels part ⇒ UNE alerte
//      au PROPRIÉTAIRE, sans e-mail ni prix ; rangée au journal.
//   2. Paramètres → Tout va bien ? (propriétaire) : « Alertes sur ton iPhone »,
//      un interrupteur par type, la dernière alerte. Couper « Vérification des
//      colis » l'écrit dans la base (sur SON clic).
//   3. Un vendeur qui n'est pas le propriétaire : aucun bloc d'alertes.
//  À 390 px (tactile) et 1512 px, clair et sombre : captures à REGARDER (§6.2).
//  Données inventées (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PG = require('./_minipgrest.cjs');
const R = path.join(__dirname, '..', '..');
const DIST = path.join(R, 'dist');
const PORT = +(process.env.BANC_PORT || 4637);
const CAPT = process.env.BANC_CAPTURES || path.join(__dirname, 'captures');
fs.mkdirSync(CAPT, { recursive: true });

const JULIEN = '11111111-2222-3333-4444-555555555555';
const AUTRE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const sessionDe = (id, jeton) => ({ access_token: jeton, refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id, email: 'banc@exemple.test' } });
const ABO = { ok: true, configure: true, modeTest: true, obligatoire: false, prix: { montant: 16.99, devise: 'eur', intervalle: 'month' }, prixConforme: true, prixStripe: null, statut: null, finPeriode: null, annuleFinPeriode: false, peutGerer: false, actif: true, acces: true, mentionsCompletes: true };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d ? ' — ' + String(d).slice(0, 300) : '')); };
const rep = (c, st = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: st, headers: { 'content-type': 'application/json' } });

// La fausse base (node) que voient les vraies routes.
const base = { rows: [] };
const JETONS = { 'j.julien.x': { id: JULIEN }, 'j.autre.x': { id: AUTRE } };
global.fetch = async (url, o = {}) => {
  const s = String(url); const u = new URL(s); const p = u.pathname; const m = (o.method || 'GET').toUpperCase();
  const h = Object.fromEntries(Object.entries(o.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (p.endsWith('/auth/v1/user')) { const x = JETONS[String(h.authorization || '').replace(/^Bearer /, '')]; return x ? rep(x) : rep({}, 401); }
  if (p.includes('/rpc/')) return rep(true);
  if (p.endsWith('/vrm_reglages')) return rep([{ valeur: JULIEN }]);
  if (!p.endsWith('/rest/v1/app_data')) return rep([]);
  if (m === 'GET') return rep(PG.servir(base.rows, s, h).body);
  const retour = String(h.prefer || '').includes('return=representation');
  if (m === 'POST') {
    const faites = [];
    for (const l of JSON.parse(o.body || '[]')) {
      const i = base.rows.findIndex((r) => r.owner === l.owner && r.id === l.id);
      if (i >= 0 && String(h.prefer || '').includes('ignore-duplicates')) continue;
      const ligne = { owner: l.owner, id: l.id, data: JSON.parse(JSON.stringify(l.data)) };
      if (i >= 0) base.rows[i] = ligne; else base.rows.push(ligne); faites.push(ligne);
    }
    return retour ? rep(faites, 201) : new Response(null, { status: 201 });
  }
  if (m === 'PATCH') { const c = base.rows.filter((r) => PG.servir([r], s, {}).body.length); const maj = JSON.parse(o.body || '{}'); for (const r of c) if (maj.data !== undefined) r.data = JSON.parse(JSON.stringify(maj.data)); return retour ? rep(c.map((r) => ({ id: r.id }))) : new Response(null, { status: 204 }); }
  return rep([]);
};
const ligneAlertes = () => { const r = base.rows.find((x) => x.owner === JULIEN && x.id === 'alertes_production'); return r && r.data; };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});

async function ouvrir(nav, { largeur, sombre, jeton, uid, proprio }) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: 900 }, hasTouch: largeur < 600, isMobile: largeur < 600, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(e.message));
  const session = sessionDe(uid, jeton);
  await pg.addInitScript(([s, so]) => {
    try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vinted_dark', so ? 'true' : 'false'); } catch (_) {}
    // Le lot part par sendBeacon : rejoué en fetch pour que la route du banc le voie.
    try { navigator.sendBeacon = (u, b) => { fetch(u, { method: 'POST', body: b, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }).catch(() => {}); return true; }; } catch (_) {}
  }, [session, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: jeton, refresh_token: 'r', expires_in: 3600, user: session.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = r.request().url();
    if (/select=owner/.test(u) && !/vinted_accounts/.test(u)) return r.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: r.request().method() === 'GET' ? '[]' : '[]' });
  });
  const compte = (await import('file://' + path.join(R, 'api', 'compte.js'))).default;
  const appels = [];
  await pg.route('**/api/**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const mode = u.searchParams.get('mode') || '';
    if (u.pathname === '/api/compte' && mode === 'abonnement') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...ABO, proprietaire: !!proprio }) });
    if (u.pathname === '/api/compte' && (mode === 'mesures' || mode === 'alertes')) {
      appels.push({ mode, methode: req.method() });
      const res = { code: 200, corps: null, status(c) { this.code = c; return this; }, json(b) { this.corps = b; return this; }, send(b) { this.corps = b; return this; }, setHeader() {}, end() { return this; } };
      const corps = req.postData();
      await compte({ method: req.method(), query: Object.fromEntries(u.searchParams), headers: Object.fromEntries(Object.entries(req.headers())), body: mode === 'mesures' ? corps : (corps ? JSON.parse(corps) : undefined) }, res);
      if (process.env.BANC_DEBUG) console.log('   [route]', mode, req.method(), res.code, JSON.stringify(res.corps).slice(0, 300));
      return route.fulfill({ status: res.code || 200, contentType: 'application/json', body: JSON.stringify(res.corps || {}) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  return { ctx, pg, erreurs, appels };
}

async function ouvrirToutVaBien(pg) {
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  // Un vendeur neuf voit d'abord la présentation : « Plus tard ».
  const plusTard = pg.getByText('Plus tard', { exact: true });
  await plusTard.first().waitFor({ timeout: 4000 }).then(() => plusTard.first().click()).catch(() => {});
  await pg.locator('[data-tout-va-bien]:visible, [data-sous-ouvrir="toutvabien"]:visible').first().waitFor({ timeout: 25000 });
  if (!(await pg.locator('[data-tout-va-bien]').first().isVisible().catch(() => false))) await pg.locator('[data-sous-ouvrir="toutvabien"]').first().click();
  await pg.locator('[data-tout-va-bien]').first().waitFor({ timeout: 20000 });
}

(async () => {
  let nav;
  try {
    await new Promise((ok2, ko2) => { srv.once('error', ko2); srv.listen(PORT, ok2); });
    process.env.SUPABASE_SERVICE_KEY = 'cle-service-banc';
    process.env.VRM_OWNER_UID = JULIEN;
    delete process.env.VAPID_PRIVATE_KEY;
    const AP = await import('file://' + path.join(R, 'api', '_lib', 'alertes-production.js'));
    const pushs = [];
    AP._bancAlertes.pousser = async (n, proprio) => { pushs.push({ n, proprio }); return { sent: 1 }; };
    nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

    // ── 1. une erreur JavaScript non rattrapée, trois fois ──────────────────
    {
      const { ctx, pg, appels } = await ouvrir(nav, { largeur: 390, sombre: false, jeton: 'j.julien.x', uid: JULIEN, proprio: true });
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(4000);
      await pg.evaluate(() => { for (let i = 0; i < 3; i++) setTimeout(() => { throw new Error("Cannot read properties of undefined (reading 'n') pour sophie@exemple.fr 87,50 €"); }, 50 * i); });
      // Le lot part au prochain passage (toutes les 15 s, une minute au plus entre deux).
      const t0 = Date.now();
      while (Date.now() - t0 < 40000 && !pushs.length) await pg.waitForTimeout(500);
      dit(appels.some((a) => a.mode === 'mesures' && a.methode === 'POST'), '1 le lot des temps réels part vers la vraie route', JSON.stringify(appels));
      dit(pushs.length === 1, '1 UNE notification (push simulé) après 3 erreurs', pushs.length);
      dit(pushs.every((x) => x.proprio === JULIEN), '1 au PROPRIÉTAIRE seul');
      const txt = JSON.stringify(pushs) + JSON.stringify(ligneAlertes() || {});
      dit(!/sophie@exemple|87,50/.test(txt), '1 ni e-mail ni prix dans la notification ni dans le journal', txt.slice(0, 300));
      const a = (ligneAlertes() || { alertes: {} }).alertes.plantage;
      dit(a && a.type === 'plantage' && a.notifieA && a.n >= 3, '1 rangée au journal des alertes, marquée « envoyée »', JSON.stringify(a));
      await ctx.close();
    }

    // ── 2. le panneau du propriétaire ───────────────────────────────────────
    for (const [largeur, sombre] of [[390, false], [1512, false], [390, true], [1512, true]]) {
      const nom = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
      const { ctx, pg, erreurs } = await ouvrir(nav, { largeur, sombre, jeton: 'j.julien.x', uid: JULIEN, proprio: true });
      await ouvrirToutVaBien(pg);
      const bloc = pg.locator('[data-alertes-prod]');
      await pg.waitForFunction(() => { const e = document.querySelector('[data-alertes-prod]'); return e && e.getAttribute('data-alertes-prod') !== 'lecture'; }, null, { timeout: 20000 }).catch(() => {});
      dit(await bloc.count() === 1 && (await bloc.getAttribute('data-alertes-prod')) !== 'pas-su', `${nom} : « Alertes sur ton iPhone » chez le propriétaire`, await bloc.getAttribute('data-alertes-prod').catch(() => 'absent'));
      dit((await pg.locator('[data-alerte-interrupteur]').count()) === 4, `${nom} : un interrupteur par type (4)`);
      dit((await pg.locator('[data-alerte="plantage"]').count()) === 1, `${nom} : la dernière alerte est listée`);
      const t = await bloc.innerText().catch(() => '');
      dit(!/sophie@exemple|87,50/.test(t), `${nom} : rien d’un vendeur à l’écran`);
      if (largeur === 390 && !sombre) {
        const sw = pg.locator('[data-alerte-interrupteur="colis"]');
        await sw.scrollIntoViewIfNeeded();
        await sw.click();
        const t0 = Date.now();
        while (Date.now() - t0 < 8000 && !((ligneAlertes() || {}).reglages || {}).hasOwnProperty('colis')) await pg.waitForTimeout(200);
        dit(((ligneAlertes() || {}).reglages || {}).colis === false && (await sw.getAttribute('data-on')) === '0', `${nom} : couper « Vérification des colis » l’écrit dans la base`, JSON.stringify((ligneAlertes() || {}).reglages));
        await sw.click();
        await pg.waitForTimeout(800);
      }
      const petites = await pg.evaluate(() => [...document.querySelectorAll('[data-alertes-prod] button')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().height < 30).length);
      dit(petites === 0, `${nom} : interrupteurs à taille de doigt`, petites);
      dit(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${nom} : pas de débordement horizontal`);
      await pg.evaluate(() => { const e = document.querySelector('[data-alertes-prod]'); if (e) e.scrollIntoView({ block: 'start' }); });
      await pg.waitForTimeout(400);
      await pg.screenshot({ path: path.join(CAPT, `alertes-production-${nom}.png`) });
      dit(!erreurs.length, `${nom} : aucune erreur d’app`, erreurs.join(' | '));
      await ctx.close();
    }

    // ── 3. un autre vendeur ─────────────────────────────────────────────────
    {
      const { ctx, pg, appels } = await ouvrir(nav, { largeur: 390, sombre: false, jeton: 'j.autre.x', uid: AUTRE, proprio: false });
      try { await ouvrirToutVaBien(pg); } finally { await pg.screenshot({ path: path.join(CAPT, 'alertes-production-autre-390.png') }).catch(() => {}); }
      await pg.waitForTimeout(2500);
      dit((await pg.locator('[data-alertes-prod]').count()) === 0 && !appels.some((a) => a.mode === 'alertes'), '3 un autre vendeur : aucun bloc d’alertes, aucune lecture');
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc s’exécute', (e && e.stack) || e); }
  finally {
    if (nav) await nav.close(); srv.close();
    console.log(ko ? `\n❌ alertes-production : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ alertes-production : ${ok} verts`);
    process.exit(ko ? 1 : 0);
  }
})();
