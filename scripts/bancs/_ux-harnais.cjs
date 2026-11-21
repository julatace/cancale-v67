// ════════════════════════════════════════════════════════════════════════════
//  LE HARNAIS DU BANC « ux-reglages » (21 nov.) — le même que `etats-vides.cjs` (base INVENTÉE servie par
//  _minipgrest, garde réseau : rien ne sort), avec trois choses en plus :
//    · `tenir` : une expression régulière sur l'URL — ces lectures `app_data` sont TENUES (jamais servies) tant
//      que `relacher()` n'est pas appelé : l'état « en cours » (`undefined`) se joue sur une requête tenue, jamais
//      sur un délai (CLAUDE.md §6.5) ;
//    · `api(route, url)` : la réponse des routes /api (défaut : {}) ;
//    · `local` : des clés posées dans le localStorage avant le premier rendu.
//  Données INVENTÉES (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.webp': 'image/webp' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000f4';
const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();
const session = (creeLe) => ({ access_token: 'jeton-ux', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeuse.ux@exemple.test', totp: [], created_at: creeLe || iso(1) } });

function serveur(DIST) {
  return http.createServer((q, r) => {
    let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
    const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
  });
}

const MAIN = (extra) => ({ id: 'main', owner: UID, data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, ...extra } });
const COMPTE = [{ id: 1, vinted_user_id: '9001', login: 'compte_essai', domain: 'www.vinted.fr', owner: UID, updated_at: iso(0), created_at: iso(3) }];

async function ouvrir(nav, { PORT, W, sombre = false, base, tab, local = {}, tenir = null, api = null, creeLe = null, query = '' }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const S = session(creeLe);
  const journal = { erreurs: [], ecritures: [], lectures: 0, tenues: [] };
  pg.on('pageerror', (e) => journal.erreurs.push(String(e.message || e).slice(0, 240)));
  await pg.addInitScript(([s, sombre, local]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        localStorage.setItem('vrm_session', JSON.stringify(s));
        localStorage.setItem('vrm_local_owner', s.user.id);
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_design_v2', '1');   // le design que voit Julien (sans cela _garde-reseau sert le DOM d'avant le 17 nov.)
        for (const [k, v] of Object.entries(local || {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        sessionStorage.setItem('banc_init', '1');
      }
      if (localStorage.getItem('vrm_design_v2') === '1') localStorage.removeItem('vrm_banc_dom_ancien');
    } catch (_) {}
  }, [S, sombre, local]);
  let relache = false; const enAttente = [];
  const relacher = () => { relache = true; for (const f of enAttente.splice(0)) f(); };
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: S.access_token, refresh_token: 'r', expires_in: 3600, user: S.user }) }));
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request(), m = req.method();
    const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200, rg) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': rg || `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) }).catch(() => {});
    if (m !== 'GET' && m !== 'HEAD') journal.ecritures.push(m + ' ' + u.replace(/^.*\/rest\/v1\//, '').slice(0, 80));
    if (base.panne === 'base') return json({ message: 'Service Unavailable' }, 503);
    if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json(m === 'GET' ? base.comptes : []);
    if (!/\/rest\/v1\/app_data/.test(u)) return json([]);
    if (m === 'GET') journal.lectures++;
    const surMain = /id=eq\.main(&|$)/.test(u);
    if (m === 'GET' && !surMain && tenir && tenir.test(u) && !relache) { journal.tenues.push(u.slice(0, 120)); await new Promise((res) => enAttente.push(res)); }
    if (base.panne === 'lectures' && m === 'GET' && !surMain) return json({ message: 'panne de lecture' }, 500);
    if (m === 'POST' || m === 'PATCH') {
      if (base.lent) await new Promise((res) => setTimeout(res, base.lent));
      try {
        const b = JSON.parse(req.postData() || 'null');
        const rows = Array.isArray(b) ? b : b && b.id ? [b] : [];
        for (const r of rows) { if (!r || !r.id) continue; const i = base.lignes.findIndex((x) => x.id === r.id); const l = { id: r.id, owner: UID, updated_at: iso(0), data: r.data }; if (i >= 0) base.lignes[i] = { ...base.lignes[i], ...l }; else base.lignes.push(l); }
      } catch (_) {}
      return json(m === 'PATCH' ? [{ id: 'main' }] : (() => { try { const b = JSON.parse(req.postData() || 'null'); return Array.isArray(b) ? b : [b]; } catch (_) { return []; } })(), m === 'POST' ? 201 : 200);
    }
    if (m === 'DELETE') return json([]);
    const lignes = base.lignes.map((l) => ({ owner: UID, updated_at: iso(0), ...l }));
    const r = servir(lignes, u, req.headers());
    return json(r.body, 200, r.range);
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    const rep = api ? api(u) : null;
    if (rep) return r.fulfill({ status: rep.status || 200, contentType: 'application/json', body: JSON.stringify(rep.body == null ? {} : rep.body) });
    return r.fulfill({ status: base.panne === 'base' ? 503 : 200, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}${query}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  return { ctx, pg, journal, tel, relacher };
}
const attendre = async (pg, f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await pg.waitForTimeout(200); } return false; };

module.exports = { serveur, ouvrir, attendre, MAIN, COMPTE, UID, iso };
