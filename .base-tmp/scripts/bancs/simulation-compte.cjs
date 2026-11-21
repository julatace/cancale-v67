// ════════════════════════════════════════════════════════════════════════════
//  BANC — « SIMULER UNE CRÉATION DE COMPTE » (11 nov., agent2-cloisonnement)
//  Réglages du PROPRIÉTAIRE : l'entrée existe, « Lancer » joue les scénarios de
//  src/simulationCompte.js, une carte par scénario, six étapes avec la miniature
//  du vrai écran du parcours, ✓/✗ et ce qui a accroché ; toucher agrandit.
//  La simulation n'écrit RIEN (aucune écriture vers la base pendant le jeu).
//  Un vendeur ordinaire ne voit pas l'entrée. Données INVENTÉES.
//  `SHOTS=dossier` (à REGARDER), `LARGEURS`, `THEMES`, `BANC_PORT` (10137).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10137;
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000dd';
const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();
const jour = (j) => iso(j).slice(0, 10);

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, { W, sombre, base, tab, proprio, stripe = false, creeIlYa = 30, statut = null }) {
  const tel = W < 600;
  const user = { id: UID, email: 'vendeur.banc@exemple.test', created_at: iso(creeIlYa), totp: [] };
  const SESSION = { access_token: 'jeton-banc', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user };
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const journal = { erreurs: [], ecrits: [] };
  pg.on('pageerror', (e) => journal.erreurs.push(String(e.message || e).slice(0, 240)));
  await pg.addInitScript(([s, sombre]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        localStorage.setItem('vrm_session', JSON.stringify(s));
        localStorage.setItem('vrm_local_owner', s.user.id);
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
  }, [SESSION, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user }) }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), m = req.method();
    const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200, rg) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': rg || `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(m === 'GET' ? base.comptes : []);
    if (!/\/rest\/v1\/app_data/.test(u)) return json([]);
    if (m === 'POST' || m === 'PATCH') {
      let rendu = [];
      try {
        const b = JSON.parse(req.postData() || 'null');
        const rows = Array.isArray(b) ? b : b && b.id ? [b] : [];
        const eqm = /[?&]id=eq\.([^&]*)/.exec(u);
        if (m === 'PATCH' && eqm && b && b.data) rows.push({ id: eqm[1], data: b.data });
        for (const r of rows) { if (!r || !r.id) continue; journal.ecrits.push(r); const i = base.lignes.findIndex((x) => x.id === r.id); const l = { id: r.id, owner: UID, updated_at: iso(0), data: r.data }; if (i >= 0) base.lignes[i] = l; else base.lignes.push(l); rendu.push(l); }
      } catch (_) {}
      return json(m === 'PATCH' ? [{ id: 'main' }] : rendu, m === 'POST' ? 201 : 200);
    }
    if (m === 'DELETE') return json([]);
    const lignes = base.lignes.map((l) => ({ owner: UID, updated_at: iso(0), ...l }));
    const r = servir(lignes, u, req.headers());
    return json(r.body, 200, r.range);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: proprio, actif: proprio || statut === 'active', acces: true, configure: stripe, statut, finPeriode: null }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  return { ctx, pg, journal, tel };
}
async function capture(pg, nom, plein = false) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: plein });
}
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
const attendre = async (pg, f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await pg.waitForTimeout(250); } return false; };
const MAIN = { id: 'main', owner: UID, data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, vrm_guide_masque: { at: iso(0) } } };
const COMPTE = [{ id: 1, vinted_user_id: '9001', login: 'compte_banc', domain: 'www.vinted.fr', owner: UID, updated_at: iso(0), created_at: iso(30) }];
const visible = (pg, sel) => pg.evaluate((s) => [...document.querySelectorAll(s)].some((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }), sel);
const cliquerVisible = (pg, sel) => pg.evaluate((s) => { const e = [...document.querySelectorAll(s)].find((x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.height > 0; }); if (!e) return false; e.scrollIntoView({ block: 'center' }); e.click(); return true; }, sel);

async function proprietaire(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[propriétaire ${W}px ${theme}]`;
  const base = { lignes: [MAIN], comptes: COMPTE };
  const o = await ouvrir(nav, { W, sombre, base, tab: 'settings', proprio: true });
  await attendre(o.pg, () => visible(o.pg, '[data-reglage-simulation-compte]'), 15000);
  dit(await visible(o.pg, '[data-reglage-simulation-compte]'), `${T} S1 Réglages porte « Simuler une création de compte »`);
  await cliquerVisible(o.pg, '[data-reglage-simulation-compte]');
  await attendre(o.pg, () => visible(o.pg, '[data-sim-lancer]'), 8000);
  // Le clic joue TOUT de façon synchrone (aucun effet, aucune attente) : on compte, DANS la
  // page, chaque fetch / XHR / sendBeacon / écriture de stockage partis PENDANT ce clic
  // (rendu React compris — un événement discret se rend avant de rendre la main).
  const pendant = await o.pg.evaluate(() => {
    const vus = [];
    const f0 = window.fetch, x0 = XMLHttpRequest.prototype.open, b0 = navigator.sendBeacon, s0 = Storage.prototype.setItem;
    window.fetch = function (u) { vus.push('fetch ' + String(u && u.url || u).slice(0, 80)); return f0.apply(this, arguments); };
    XMLHttpRequest.prototype.open = function (m, u) { vus.push('xhr ' + m + ' ' + String(u).slice(0, 80)); return x0.apply(this, arguments); };
    if (b0) navigator.sendBeacon = function (u) { vus.push('beacon ' + u); return b0.apply(this, arguments); };
    Storage.prototype.setItem = function (k) { vus.push('stockage ' + k); return s0.apply(this, arguments); };
    try {
      const btn = [...document.querySelectorAll('[data-sim-lancer]')].find((e) => e.getBoundingClientRect().height > 0);
      if (btn) btn.click();
    } finally { window.fetch = f0; XMLHttpRequest.prototype.open = x0; if (b0) navigator.sendBeacon = b0; Storage.prototype.setItem = s0; }
    return vus;
  });
  dit(pendant.length === 0, `${T} S3 la simulation ne touche ni le réseau ni le stockage (pendant le clic)`, pendant.join(' ¦ '));
  await attendre(o.pg, () => visible(o.pg, '[data-sim-bilan]'), 8000);
  await o.pg.waitForTimeout(500);
  const r = await o.pg.evaluate(() => {
    const p = [...document.querySelectorAll('[data-simulation-compte]')].find((e) => e.getBoundingClientRect().height > 0);
    if (!p) return null;
    const cartes = [...p.querySelectorAll('[data-sim-scenario]')].map((c) => ({ id: c.getAttribute('data-sim-scenario'), conforme: c.getAttribute('data-sim-conforme'),
      etapes: [...c.querySelectorAll('[data-sim-etape]')].map((e) => ({ cle: e.getAttribute('data-sim-etape'), ok: e.getAttribute('data-sim-ok'), mini: !!e.querySelector('.vrm-sim-ecran [data-parcours]'), quoi: (e.querySelector('.vrm-sim-etape-quoi') || {}).textContent || '' })) }));
    return { bilan: (p.querySelector('[data-sim-bilan]') || {}).getAttribute?.('data-sim-bilan'), cartes };
  });
  dit(!!r && r.cartes.length >= 6, `${T} S2 une carte par scénario`, JSON.stringify(r && r.cartes.length));
  if (r) {
    dit(r.cartes.every((c) => c.conforme === '1'), `${T} S2 chaque scénario se passe comme attendu (${r.bilan})`, JSON.stringify(r.cartes.filter((c) => c.conforme !== '1').map((c) => c.id)));
    dit(r.cartes.every((c) => c.etapes.length === 3 && c.etapes.every((e) => e.mini)), `${T} S2 trois étapes, chacune avec sa miniature (le vrai écran du parcours)`);
    const sans = r.cartes.find((c) => c.id === 'sans-extension');
    const ext = sans && sans.etapes.find((e) => e.cle === 'extension');
    dit(ext && ext.ok === '0' && /extension/i.test(ext.quoi), `${T} S2 « sans extension » : ✗ et ce qui a accroché`, JSON.stringify(ext));
  }
  // Agrandir une miniature.
  await cliquerVisible(o.pg, '[data-sim-scenario="sans-extension"] [data-sim-etape="extension"] button');
  await o.pg.waitForTimeout(500);
  dit(await visible(o.pg, '.vrm-sim-loupe .vrm-sim-ecran-grand [data-parcours]'), `${T} S4 toucher une miniature l'agrandit`);
  await capture(o.pg, `sim-${W}-${theme}-loupe`);
  await o.pg.keyboard.press('Escape'); await cliquerVisible(o.pg, '.vrm-sim-loupe-fermer');
  dit(!(await deborde(o.pg)), `${T} rien ne déborde`);
  await o.pg.evaluate(() => { const e = [...document.querySelectorAll('[data-simulation-compte]')].find((x) => x.getBoundingClientRect().height > 0); if (e) e.scrollIntoView({ block: 'start' }); });
  await capture(o.pg, `sim-${W}-${theme}`, true);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}
async function vendeur(nav, W, theme) {
  const T = `[vendeur ${W}px ${theme}]`;
  const o = await ouvrir(nav, { W, sombre: theme === 'sombre', base: { lignes: [MAIN], comptes: COMPTE }, tab: 'settings', proprio: false });
  await attendre(o.pg, () => visible(o.pg, '[data-reglage-signaler]'), 15000);
  await o.pg.waitForTimeout(1200);
  dit(await visible(o.pg, '[data-reglage-signaler]') && !(await o.pg.$('[data-reglage-simulation-compte]')), `${T} un vendeur ne voit pas « Simuler une création de compte »`);
  await o.ctx.close();
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) { await proprietaire(nav, W, theme); await vendeur(nav, W, theme); }
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e && e.stack || e).slice(0, 400)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n❌ simulation de création de compte : ${ko} défaut(s)` : '\n✅ simulation de création de compte : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
