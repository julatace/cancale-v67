// ════════════════════════════════════════════════════════════════════════
//  BANC — « QUOI DE NEUF » (11 nov., src/nouveautes.js, src/QuoiDeNeuf.jsx)
//  Base INVENTÉE (_base-volume, 1 compte) ; rien de réel.
//  Q1  vendeur inscrit le 8 nov. au soir, Sneakers, micro, Complet : une ligne « Nouveau · N
//      nouveautés » en haut de Ma journée (aucune fenêtre ouverte) ; un toucher ⇒
//      la feuille (une ligne par nouveauté, « Voir » ≥ 44 px) ; « Voir » ⇒ l'écran
//      cible, la carte dit N−1 ; « Tout vu » ⇒ la carte part, `vrm_nouveautes_vues`
//      est dans la ligne `main` ; un AUTRE appareil (stockage vide) ne la revoit pas.
//  Q2  compte créé aujourd'hui : aucune carte ; Paramètres → « Quoi de neuf » dit
//      « Rien de neuf depuis ton inscription ».
//  Q3  affichage Simple, statut pas choisi, « Lunettes » : ni écran de Complet, ni
//      nouveauté « pro », ni « sneakers » ; Paramètres → « Quoi de neuf » liste.
//  Chaque fois : aucune erreur JS, rien ne déborde. SHOTS=dossier (à REGARDER).
// ════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { fabriquer } = require(path.join(__dirname, '_base-volume.cjs'));
const { servir } = require('./_minipgrest.cjs');
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || process.argv[2] || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10244;
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SCENARIOS = liste('SCENARIOS', 'Q1,Q2,Q3');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000e7';
let SESSION = null;
const session = (cree) => ({ access_token: 'jeton-qdn', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeur.qdn@exemple.test', created_at: cree, totp: [] } });

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`); };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});


function base({ cree, vend = { choix: 'sneakers', categories: ['sneakers'], at: '2026-11-01T10:00:00.000Z' }, regime = 'micro', affichage = null, vues = null } = {}) {
  const b = fabriquer({ comptes: 1 });
  b.rows = b.rows.filter((r) => !/^email_track_/.test(r.id) && r.id !== 'email_journal');
  const m = b.main[0].data;
  m.vrm_bienvenue_vue = { at: '2026-11-01T10:00:00.000Z' }; m.vrm_visite_vue = { at: '2026-11-01T10:00:00.000Z' };
  m.vrm_configuration = { etat: 'fait', at: '2026-11-01T10:00:00.000Z', statut: null, version: 1 };
  m.vrm_plateformes_affichees = { sites: ['vinted'], at: '2026-11-01T10:00:00.000Z' };
  m.vrm_je_vends = vend; if (regime) m.vinted_regime = regime; else delete m.vinted_regime;
  if (affichage) m.vrm_affichage = { choix: affichage, at: '2026-11-01T10:00:00.000Z' };
  if (vues) m.vrm_nouveautes_vues = vues;
  return b;
}
const ligneMain = (b) => (b.main[0] || {}).data || {};
async function ouvrir(nav, { W, sombre, base, tab = 'journee', proprio = false }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const journal = { erreurs: [] };
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
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request(), m = req.method();
    const u = decodeURIComponent(req.url());
    if (/\/rest\/v1\/rpc\//.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    if (m === 'POST' || m === 'PATCH') {
      if (process.env.BANC_DEBUG) console.log('ECRIT', m, u.slice(0, 160), String(req.postData() || '').slice(0, 300));
      try {
        const b = JSON.parse(req.postData() || 'null');
        const rows = Array.isArray(b) ? b : b && b.id ? [b] : [];
        const eqm = /[?&]id=eq\.([^&]*)/.exec(u);
        if (m === 'PATCH' && eqm && b && b.data) rows.push({ id: eqm[1], data: b.data });
        for (const r of rows) {
          if (!r || !r.id || !/\/app_data/.test(u)) continue;
          if (r.id === 'main') base.main[0] = { id: 'main', data: r.data };
          else { const i = base.rows.findIndex((x) => x.id === r.id); if (i >= 0) base.rows[i] = { id: r.id, data: r.data }; else base.rows.push({ id: r.id, data: r.data }); }
        }
      } catch (_) {}
      return route.fulfill({ status: m === 'POST' ? 201 : 200, contentType: 'application/json', body: m === 'PATCH' ? '[{"id":"main"}]' : '[]' });
    }
    if (m === 'DELETE') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(base.accounts.map((a) => ({ ...a, owner: UID }))) });
    if (!/\/rest\/v1\/app_data/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    const lignes = [...base.main, ...base.rows].map((l) => ({ owner: UID, updated_at: new Date().toISOString(), ...l }));
    const r = servir(lignes, decodeURIComponent(metaVersData(req.url())), req.headers());
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': r.range || '0-0/0' }, body: JSON.stringify(r.body) });
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: proprio, acces: true }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  return { ctx, pg, journal, tel };
}
async function capture(pg, nom, plein = false) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.waitForTimeout(450);
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: plein });
}
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
const attendre = async (pg, f, ms = 9000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await pg.waitForTimeout(200); } return false; };
const nCarte = (pg) => pg.evaluate(() => { const c = document.querySelector('[data-quoi-de-neuf-carte]'); return c ? Number(c.getAttribute('data-n')) : 0; });
const idsFeuille = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-quoi-de-neuf-feuille] [data-nouveaute]')].map((x) => x.getAttribute('data-nouveaute')));
const COMPLET = ['offres-auto-sures', 'republier-main', 'chercher-photo'];
const PRO = ['facture-siret', 'dates-versement', 'export-comptable'];

async function scenario(nav, nom, W, theme) {
  const sombre = theme === 'sombre';
  const T = `[${nom} ${W} ${theme}]`, pref = `${nom}-${W}-${theme}`;
  if (nom === 'Q1') {
    SESSION = session('2026-11-08T20:00:00.000Z');
    const b = base({ affichage: 'complet' });
    const o = await ouvrir(nav, { W, sombre, base: b });
    const vu = await attendre(o.pg, async () => (await nCarte(o.pg)) > 0, 20000);
    const suite = []; for (let i = 0; i < 20; i++) { suite.push(await nCarte(o.pg)); await o.pg.waitForTimeout(250); }
    dit(suite.every((x) => x === suite[suite.length - 1]), `${T} le nombre ne change pas sous ses yeux`, suite.join(' '));
    const n = await nCarte(o.pg);
    dit(vu && n >= 12, `${T} la carte « Nouveau » est en haut de Ma journée (${n})`);
    dit(!(await o.pg.$('[role="dialog"]')), `${T} aucune fenêtre ouverte à l’arrivée`);
    const h = await o.pg.evaluate(() => { const c = document.querySelector('[data-quoi-de-neuf-carte]'); return c ? c.getBoundingClientRect().height : 0; });
    dit(h >= 44 && h <= 72, `${T} une ligne discrète (${Math.round(h)} px)`);
    await capture(o.pg, pref + '-carte');
    if (!vu) { await o.ctx.close(); return; }
    await o.pg.click('[data-quoi-de-neuf-carte]');
    await attendre(o.pg, async () => (await idsFeuille(o.pg)).length > 0);
    const ids = await idsFeuille(o.pg);
    dit(ids.length === n, `${T} la feuille : une ligne par nouveauté (${ids.length})`, ids.join(','));
    dit(ids.includes('facture-siret') && ids.includes('offres-auto-sures') && !ids.includes('ebay-sans-pointure'), `${T} Sneakers + micro + Complet : pro et Complet oui, « pas que des sneakers » non`, ids.join(','));
    dit(!ids.includes('centre-aide'), `${T} rien d’avant son inscription (centre d’aide du 8 nov.)`);
    const voirH = await o.pg.evaluate(() => Math.min(...[...document.querySelectorAll('[data-nouveaute-voir]')].map((a) => a.getBoundingClientRect().height)));
    dit(voirH >= 44, `${T} « Voir » ≥ 44 px (${voirH})`);
    dit(await o.pg.evaluate(() => !!document.querySelector('body > * [data-quoi-de-neuf-feuille], body > [data-quoi-de-neuf-feuille]') && !document.querySelector('.vrm-main [data-quoi-de-neuf-feuille]')), `${T} la feuille est un portail (hors de l’écran)`);
    await capture(o.pg, pref + '-feuille');
    const cible = await o.pg.$eval('[data-quoi-de-neuf-feuille] [data-nouveaute="messages-tous"] [data-nouveaute-voir]', (a) => a.getAttribute('data-nouveaute-voir')).catch(() => null);
    await o.pg.click('[data-quoi-de-neuf-feuille] [data-nouveaute="messages-tous"] [data-nouveaute-voir]').catch(() => {});
    const parti = await attendre(o.pg, async () => !(await o.pg.$('[data-quoi-de-neuf-feuille]')) && !(await o.pg.$('[data-quoi-de-neuf-carte]')));
    dit(cible === 'messages' && parti, `${T} « Voir » ferme la feuille et quitte Ma journée`);
    dit(await attendre(o.pg, async () => !!((ligneMain(b).vrm_nouveautes_vues || {}).vues || {})['messages-tous'], 15000), `${T} « Voir » : cette ligne rangée dans main`);
    await capture(o.pg, pref + '-voir');
    await o.pg.evaluate(() => { history.pushState({}, '', '?tab=journee'); dispatchEvent(new PopStateEvent('popstate')); });
    await o.pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
    await attendre(o.pg, async () => (await nCarte(o.pg)) > 0, 20000);
    dit((await nCarte(o.pg)) === n - 1, `${T} la carte dit une de moins (${await nCarte(o.pg)})`);
    await o.pg.click('[data-quoi-de-neuf-carte]');
    await o.pg.waitForSelector('[data-quoi-de-neuf-vu]', { timeout: 8000 }).catch(() => {});
    await o.pg.click('[data-quoi-de-neuf-vu]').catch(() => {});
    dit(await attendre(o.pg, async () => !(await o.pg.$('[data-quoi-de-neuf-carte]'))), `${T} « Tout vu » : la carte part`);
    const ecrit = await attendre(o.pg, async () => Object.keys((ligneMain(b).vrm_nouveautes_vues || {}).vues || {}).length === n, 15000);
    dit(ecrit, `${T} l’état « vu » est dans la ligne main (${Object.keys((ligneMain(b).vrm_nouveautes_vues || {}).vues || {}).length})`);
    dit(!(await deborde(o.pg)), `${T} rien ne déborde`);
    dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' | '));
    await o.ctx.close();
    // Un autre appareil : stockage vide, la ligne main du nuage seule.
    const o2 = await ouvrir(nav, { W, sombre, base: b });
    await o2.pg.waitForSelector('[data-fu-carte]', { timeout: 20000 }).catch(() => {});
    await o2.pg.waitForTimeout(2500);
    dit(!(await o2.pg.$('[data-quoi-de-neuf-carte]')), `${T} un autre appareil ne la revoit pas (synchronisé)`);
    await o2.ctx.close();
    return;
  }
  if (nom === 'Q2') {
    SESSION = session('2026-11-11T08:00:00.000Z');
    const b = base({});
    const o = await ouvrir(nav, { W, sombre, base: b });
    await o.pg.waitForSelector('[data-fu-carte]', { timeout: 20000 }).catch(() => {});
    await o.pg.waitForTimeout(2500);
    dit(!!(await o.pg.$('[data-fu-carte]')) && !(await o.pg.$('[data-quoi-de-neuf-carte]')), `${T} compte créé aujourd’hui : aucune carte`);
    await o.pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
    await o.pg.waitForSelector('[data-reglage-quoi-de-neuf]', { timeout: 20000 }).catch(() => {});
    await o.pg.click('[data-reglage-quoi-de-neuf]').catch(() => {});
    dit(await attendre(o.pg, async () => !!(await o.pg.$('[data-quoi-de-neuf-vide]'))), `${T} Paramètres → « Quoi de neuf » : rien depuis l’inscription`);
    await capture(o.pg, pref + '-parametres-vide');
    dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' | '));
    await o.ctx.close(); return;
  }
  if (nom === 'Q3') {
    SESSION = session('2026-11-05T09:00:00.000Z');
    const b = base({ vend: { choix: 'autre', categories: ['lunettes'], at: '2026-11-01T10:00:00.000Z' }, regime: null, affichage: 'simple' });
    const o = await ouvrir(nav, { W, sombre, base: b });
    const vu = await attendre(o.pg, async () => (await nCarte(o.pg)) > 0, 20000);
    dit(vu, `${T} la carte est là`);
    if (vu) {
      await o.pg.click('[data-quoi-de-neuf-carte]');
      await attendre(o.pg, async () => (await idsFeuille(o.pg)).length > 0);
      const ids = await idsFeuille(o.pg);
      dit(ids.length > 0 && !ids.some((i) => COMPLET.includes(i)), `${T} Simple : aucun écran de Complet`, ids.join(','));
      dit(!ids.some((i) => PRO.includes(i)), `${T} statut pas choisi : aucune nouveauté « pro »`, ids.join(','));
      dit(ids.includes('ebay-sans-pointure') && ids.includes('tu-vends-quoi'), `${T} Lunettes : « pas que des sneakers » oui`, ids.join(','));
      await capture(o.pg, pref + '-feuille');
      await o.pg.keyboard.press('Escape');
      dit(await attendre(o.pg, async () => !(await o.pg.$('[data-quoi-de-neuf-feuille]'))), `${T} Échap ferme la feuille (FermeAuRetour)`);
      dit((await nCarte(o.pg)) === ids.length, `${T} fermer n’est pas « vu »`);
    }
    await o.pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
    await o.pg.waitForSelector('[data-reglage-quoi-de-neuf]', { timeout: 20000 }).catch(() => {});
    await o.pg.click('[data-reglage-quoi-de-neuf]').catch(() => {});
    dit(await attendre(o.pg, async () => (await o.pg.$$('[data-quoi-de-neuf-liste] [data-nouveaute]')).length > 0), `${T} Paramètres → « Quoi de neuf » : la liste`);
    await o.pg.waitForTimeout(500);
    await o.pg.evaluate(() => { const e = document.querySelector('[data-quoi-de-neuf-liste]'); if (e) e.scrollIntoView({ block: 'center' }); });
    await capture(o.pg, pref + '-parametres');
    dit(!(await deborde(o.pg)), `${T} rien ne déborde`);
    dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' | '));
    await o.ctx.close();
  }
}

(async () => {
  await new Promise((res, rej) => { srv.on('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log(`KO  port ${PORT} pris (${e.code})`); process.exit(1); });
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) for (const s of SCENARIOS) {
      try { await scenario(nav, s, W, th); } catch (e) { dit(false, `[${s} ${W} ${th}] le scénario s’exécute`, e && e.message); }
    }
  } finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n${ko} défaut(s)` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})();
