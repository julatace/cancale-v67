// ════════════════════════════════════════════════════════════════════════════
//  BANC — « VOIR TOUS LES POP-UPS » (23 nov., Julien ; compte PROPRIÉTAIRE de l'installation seulement)
//  P1 le propriétaire voit l'entrée dans Paramètres ; « Voir tous les pop-ups » ouvre la barre de la galerie ;
//  P2 la galerie passe CHAQUE exemple du registre des notifications (api/_lib/notif-apercus.js via src/galeriePops.js —
//     le nombre attendu est relu dans le registre, pas recopié) puis les 3 messages courts ; chacun s'affiche (une carte
//     `.n-pop` avec un titre, ou un message court) ;
//  P3 rien n'est écrit en base pendant toute la galerie ; aucune erreur ;
//  P4 un vendeur ordinaire ne voit pas l'entrée, et l'événement `vrm:galerie-pops` n'ouvre rien chez lui.
//  `SHOTS=dossier` (à REGARDER), `LARGEURS`, `BANC_PORT`. Données d'exemple seulement.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);

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


async function attenduDuRegistre() {
  const m = await import(path.join(__dirname, '..', '..', 'src', 'galeriePops.js'));
  return m.exemplesPops().length + 3;
}

async function proprietaire(nav, W, attendu) {
  const T = `[propriétaire ${W}px]`;
  const o = await ouvrir(nav, { W, sombre: false, base: { lignes: [MAIN], comptes: COMPTE }, tab: 'settings', proprio: true });
  await attendre(o.pg, () => visible(o.pg, '[data-reglage-galerie-pops]'), 15000);
  dit(await visible(o.pg, '[data-reglage-galerie-pops]'), `${T} P1 Paramètres porte « Voir tous les pop-ups »`);
  await cliquerVisible(o.pg, '[data-reglage-galerie-pops]');
  await attendre(o.pg, () => visible(o.pg, '[data-galerie-ouvrir]'), 8000);
  const avant = o.journal.ecrits.length;
  await cliquerVisible(o.pg, '[data-galerie-ouvrir]');
  await attendre(o.pg, () => visible(o.pg, '.n-galerie'), 8000);
  const n = Number(await o.pg.getAttribute('.n-galerie', 'data-galerie-pops'));
  dit(n === attendu, `${T} P2 la galerie compte ${attendu} exemples (registre + 3 messages courts)`, String(n));
  // Pause, puis chaque exemple au bouton « Suivant ».
  await o.pg.click('[data-galerie-lecture="1"]').catch(() => {});
  const vus = []; let manques = [];
  for (let k = 0; k < n; k++) {
    await o.pg.waitForTimeout(450);
    const r = await o.pg.evaluate(() => {
      const g = document.querySelector('.n-galerie'); const pop = [...document.querySelectorAll('.n-pop')].find((x) => x.getBoundingClientRect().height > 0);
      const toast = [...document.querySelectorAll('.vrm-toast')].find((x) => x.getBoundingClientRect().height > 0);
      return { i: g && g.getAttribute('data-galerie-i'), famille: g && g.getAttribute('data-galerie-famille'), titre: pop ? (pop.querySelector('.n-pop-titre') || {}).textContent : '', toast: toast ? toast.textContent : '' };
    });
    vus.push(r.famille);
    if (!(r.titre || r.toast)) manques.push(`${r.i}:${r.famille}`);
    if (SHOTS && (k === 0 || r.famille !== vus[k - 1])) await capture(o.pg, `galerie-${W}-${String(k).padStart(2, '0')}-${r.famille}`);
    await o.pg.click('.n-galerie [aria-label="Suivant"]');
  }
  dit(!manques.length, `${T} P2 chaque exemple s'affiche (${n})`, manques.join(', '));
  dit(new Set(vus).size >= 5, `${T} P2 plusieurs familles passent (${[...new Set(vus)].join(',')})`);
  dit(o.journal.ecrits.length === avant, `${T} P3 rien n'est écrit en base pendant la galerie`, JSON.stringify(o.journal.ecrits.slice(avant).map((x) => x.id)));
  await o.pg.click('.n-galerie [aria-label="Fermer"]');
  await o.pg.waitForTimeout(400);
  dit(!(await visible(o.pg, '.n-galerie')), `${T} Fermer retire la barre`);
  dit(!(await deborde(o.pg)), `${T} rien ne déborde`);
  dit(!o.journal.erreurs.length, `${T} P3 aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}
async function vendeur(nav, W) {
  const T = `[vendeur ${W}px]`;
  const o = await ouvrir(nav, { W, sombre: false, base: { lignes: [MAIN], comptes: COMPTE }, tab: 'settings', proprio: false });
  await attendre(o.pg, () => visible(o.pg, '[data-reglage-signaler]'), 15000);
  await o.pg.waitForTimeout(1200);
  dit(await visible(o.pg, '[data-reglage-signaler]') && !(await o.pg.$('[data-reglage-galerie-pops]')), `${T} P4 un vendeur ne voit pas « Voir tous les pop-ups »`);
  await o.pg.evaluate(() => window.dispatchEvent(new Event('vrm:galerie-pops')));
  await o.pg.waitForTimeout(800);
  dit(!(await o.pg.$('.n-galerie')), `${T} P4 l'événement n'ouvre rien chez un vendeur`);
  await o.ctx.close();
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    const attendu = await attenduDuRegistre();
    for (const W of LARGEURS) { await proprietaire(nav, W, attendu); await vendeur(nav, W); }
  } catch (e) { dit(false, 'le banc a pu aller au bout', String(e && e.stack || e).slice(0, 400)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n❌ galerie des pop-ups : ${ko} défaut(s)` : '\n✅ galerie des pop-ups : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
