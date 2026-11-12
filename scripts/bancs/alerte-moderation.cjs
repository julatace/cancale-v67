require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « VINTED A AGI » EN TÊTE DE MA JOURNÉE (11 nov., ext. 5.350) —
//  src/AlerteModeration.jsx, règle src/moderationVinted.js. Base INVENTÉE (dépôt
//  public), servie par la règle de table du mode exemple (src/exempleBase.js :
//  `select=` projeté, `meta->>`, `id=like.`, écritures gardées).
//   A. trois alertes (masquée N°42, disparue, compte limité avec la raison de
//      Vinted) : la carte est EN TÊTE de Ma journée, nomme l'annonce par son N°
//      (fiche de CET identifiant), dit quand, le geste est un lien Vinted ;
//      cibles 44 px, aucun débordement ; « C'est vu » la range (synchronisé) et
//      elle ne revient pas au rechargement. 390 tactile et 1512, clair et sombre.
//   B. la « disparue » dont la vente est PROUVÉE (transaction finalisée de cette
//      annonce) ⇒ pas de carte pour elle ; la masquée reste.
//   C. lignes illisibles (503) ⇒ aucune carte, aucune erreur (pas su ≠ alerte).
//   D. rien à dire ⇒ rien (aucune place prise).
//   E. compte retiré ⇒ on ne lui en parle plus.
//  Captures dans BANC_CAPTURES (à regarder : §6.2).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4641;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-alerte-moderation');
fs.mkdirSync(CAPTURES, { recursive: true });
const UID = '11111111-2222-3333-4444-555555555555';
const SESSION = { access_token: 'aaa.bbb.ccc', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'vendeuse@exemple.test', created_at: '2025-01-10T10:00:00.000Z' } };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const H = 3600e3;
const iso = (ilYa) => new Date(Date.now() - ilYa).toISOString();
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String((e && e.stack) || e).split('\n').slice(0, 3).join(' ')); } };
let servirTable;
const ligne = (id, data) => ({ id, owner: UID, data, updated_at: iso(0) });
const compte = (uid, login) => ({ id: Number(uid), vinted_user_id: String(uid), login, domain: 'www.vinted.fr', owner: UID, updated_at: iso(0) });
const T = Date.now() - 2 * H;
const MOD = (e) => ligne('moderation_vinted_111', { uid: '111', v: '5.350.0', e });
const E_MASQ = { k: `masquee:1000042:${T}`, s: 'masquee', t: T, a: '1000042', av: T - 3 * H };
const E_DISP = { k: `disparue:1000077:${T}`, s: 'disparue', t: T, a: '1000077', av: T - 3 * H };
const E_RESTR = { k: `restreint:${T}`, s: 'restreint', t: T, j: T + 24 * H, r: 'Listing restricted' };
const base = (lignes, comptes = [compte(111, 'shop_cancale')]) => ({ app_data: { lignes: [
  ligne('main', { vrm_bienvenue_vue: { at: iso(30 * 864e5) }, vrm_visite: { at: iso(30 * 864e5), fin: 'fin' }, vinted_annonce_numeros: { 1000042: { numero: '42', numberedAt: iso(20 * 864e5) } } }),
  ligne('harvest_111_listings', { capturedAt: iso(1 * H), nItems: 2, payload: { items: [] } }),
  ...lignes] }, vinted_accounts: { lignes: comptes } });

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, { b, largeur = 390, sombre = false, panne = false }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light', deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  const etat = { erreurs: [], lectures: 0 };
  pg.on('pageerror', (e) => etat.erreurs.push(e.message));
  await pg.addInitScript(({ s, sombre }) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_mfa_plus_tard_' + s.user.id, String(Date.now())); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: new Date().toISOString() })); localStorage.setItem('vrm_parcours_plus_tard', JSON.stringify({ at: Date.now() })); } catch (_) {} }, { s: SESSION, sombre });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...SESSION, expires_in: 3600, id: UID, email: SESSION.user.email, created_at: SESSION.user.created_at }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const url = new URL(r.request().url()), m = r.request().method();
    if (/\/rpc\//.test(url.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', body: 'true' });
    const t = url.pathname.slice('/rest/v1/'.length).split('/')[0];
    const table = b[t] || { lignes: [] };
    const brut = decodeURIComponent(url.search);
    if (/moderation_vinted_/.test(brut)) { etat.lectures++; if (panne) return r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); }
    let corps = null; try { corps = r.request().postData() ? JSON.parse(r.request().postData()) : null; } catch (_) {}
    const x = servirTable(table, { methode: m, url: url.pathname + url.search, entetes: r.request().headers(), corps, owner: UID });
    return r.fulfill({ status: x.status, headers: x.headers, body: x.status === 204 || x.body == null ? '' : JSON.stringify(x.body) });
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, actif: true, acces: true, statut: 'active', configure: false, obligatoire: false }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, etat };
}
const CARTE = '[data-moderation]';
const attendre = (pg, ms = 25000) => pg.locator(CARTE).first().waitFor({ timeout: ms }).then(() => true).catch(() => false);
const capture = (pg, nom) => pg.screenshot({ path: path.join(CAPTURES, `alerte-moderation-${nom}.png`) }).catch(() => {});
const cibles44 = (pg) => pg.evaluate((sel) => [...document.querySelectorAll(`${sel} button, ${sel} a`)].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect()).filter((r) => r.height < 43.5).length, CARTE);

async function scenarioA(nav, largeur, sombre) {
  const nom = `A-${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\nA · trois alertes · ${nom}`);
  const b = base([MOD([E_MASQ, E_DISP, E_RESTR])]);
  const { ctx, pg, etat } = await ouvrir(nav, { b, largeur, sombre });
  try {
    dit(await attendre(pg), `${nom} : la carte paraît`);
    await pg.waitForTimeout(1200);
    const c = pg.locator(CARTE).first();
    dit(await c.getAttribute('data-moderation') === '3', `${nom} : trois alertes`, await c.getAttribute('data-moderation'));
    // En tête : rien de Ma journée au-dessus d'elle dans la zone de contenu.
    const enTete = await pg.evaluate((sel) => {
      const carte = document.querySelector(sel); if (!carte) return false;
      const main = document.querySelector('main') || document.body;
      const autres = [...main.querySelectorAll('[data-garde-ecran], section, .vrm-carte, [data-journee]')].filter((e) => !carte.contains(e) && !e.contains(carte) && e.getClientRects().length);
      const y = carte.getBoundingClientRect().top;
      return autres.every((e) => e.getBoundingClientRect().top >= y - 1 || e.getBoundingClientRect().bottom <= y + 1);
    }, CARTE);
    dit(enTete, `${nom} : en tête de Ma journée`);
    const masq = c.locator('[data-moderation-sorte="masquee"]');
    dit(/Vinted a masqué N°42/.test(await masq.innerText()) && /shop_cancale/.test(await masq.innerText()), `${nom} : « Vinted a masqué N°42 · shop_cancale » (le N° de LA fiche de cet identifiant)`, await masq.innerText());
    dit(await masq.locator('a[data-moderation-geste]').getAttribute('href') === 'https://www.vinted.fr/items/1000042' && /Ouvre l’annonce sur Vinted/.test(await masq.locator('a').innerText()), `${nom} : le geste ouvre l’annonce sur Vinted`);
    const disp = c.locator('[data-moderation-sorte="disparue"]');
    dit(/a disparu/.test(await disp.innerText()) && /Peut-être retirée par Vinted/.test(await disp.innerText()) && /1000077/.test(await disp.innerText()) && !/N°/.test(await disp.innerText()), `${nom} : disparue, formulé prudemment, sans fiche ⇒ l’identifiant (jamais un N° deviné)`, await disp.innerText());
    const lim = c.locator('[data-moderation-sorte="restreint"]');
    dit(/Vinted limite le compte/.test(await lim.innerText()) && /Listing restricted/.test(await lim.innerText()) && /Pause conseillée/.test(await lim.innerText()) && /Vérifie tes messages Vinted/.test(await lim.innerText()), `${nom} : compte limité : la raison de Vinted, la pause, le geste`, await lim.innerText());
    dit(/vue (le .* )?entre/.test(await masq.innerText()), `${nom} : quand (entre deux lectures)`);
    dit((await cibles44(pg)) === 0, `${nom} : cibles de 44 px`);
    dit(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${nom} : pas de débordement horizontal`);
    const couleurs = await pg.evaluate((sel) => [...document.querySelectorAll(`${sel} *`)].map((e) => getComputedStyle(e).color + '|' + getComputedStyle(e).backgroundColor).join(' '), CARTE);
    dit(!/rgb\(2[0-5]\d, [0-6]\d, [0-6]\d\)/.test(couleurs), `${nom} : aucun rouge (§7)`);
    await c.scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, `${nom}-1`);
    await masq.locator('[data-moderation-vu]').click();
    await pg.waitForTimeout(700);
    dit(await c.getAttribute('data-moderation') === '2' && (await c.locator('[data-moderation-sorte="masquee"]').count()) === 0, `${nom} : « C’est vu » ⇒ elle sort`);
    const vu = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_moderation_vu') || '{}'); } catch (_) { return {}; } });
    dit(Object.keys(vu).some((k) => k === `111|${E_MASQ.k}`), `${nom} : rangé dans vrm_moderation_vu (synchronisé)`, JSON.stringify(vu));
    if (largeur === 390 && !sombre) {
      await pg.waitForTimeout(2500);
      await pg.reload({ waitUntil: 'domcontentloaded' });
      await attendre(pg);
      await pg.waitForTimeout(1500);
      dit(await pg.locator(CARTE).first().getAttribute('data-moderation') === '2', `${nom} : rechargée ⇒ la vue ne revient pas`);
      await pg.locator('[data-moderation-tout-vu]').click();
      await pg.waitForTimeout(600);
      dit((await pg.locator(CARTE).count()) === 0, `${nom} : « Tout est vu » ⇒ plus de carte`);
    }
    dit(!etat.erreurs.length, `${nom} : aucune erreur d’app`, etat.erreurs.join(' | ').slice(0, 300));
  } finally { await ctx.close(); }
}

async function scenarioB(nav) {
  console.log('\nB · disparue dont la vente est prouvée');
  const txn = ligne('harvest_111_txn_555', { capturedAt: iso(H), payload: { transaction: { id: 555, item_id: 1000077, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(H) } } });
  const b = base([MOD([E_MASQ, E_DISP]), txn]);
  const { ctx, pg, etat } = await ouvrir(nav, { b, largeur: 390 });
  try {
    dit(await attendre(pg), 'B : la carte paraît (la masquée)');
    await pg.waitForFunction(() => { const c = document.querySelector('[data-moderation]'); return c && c.getAttribute('data-moderation') === '1'; }, null, { timeout: 15000 }).catch(() => {});
    const c = pg.locator(CARTE).first();
    dit(await c.getAttribute('data-moderation') === '1' && (await c.locator('[data-moderation-sorte="disparue"]').count()) === 0, 'B : la disparue VENDUE (transaction finalisée de cette annonce) n’est pas une alerte', await c.getAttribute('data-moderation'));
    await capture(pg, 'B');
    dit(!etat.erreurs.length, 'B : aucune erreur d’app', etat.erreurs.join(' | ').slice(0, 300));
  } finally { await ctx.close(); }
}

async function scenarioC(nav) {
  console.log('\nC · lignes illisibles (503)');
  const { ctx, pg, etat } = await ouvrir(nav, { b: base([MOD([E_MASQ])]), largeur: 1512, panne: true });
  try {
    await pg.waitForTimeout(6000);
    dit(etat.lectures > 0 && (await pg.locator(CARTE).count()) === 0, 'C : lue, illisible ⇒ aucune carte (pas su ≠ alerte)', String(etat.lectures));
    dit(!etat.erreurs.length, 'C : aucune erreur d’app', etat.erreurs.join(' | ').slice(0, 300));
    await capture(pg, 'C');
  } finally { await ctx.close(); }
}

async function scenarioD(nav) {
  console.log('\nD · rien à dire');
  const { ctx, pg, etat } = await ouvrir(nav, { b: base([MOD([{ ...E_MASQ, f: T + H }])]), largeur: 390 });
  try {
    await pg.waitForTimeout(6000);
    dit(etat.lectures > 0 && (await pg.locator(CARTE).count()) === 0, 'D : alerte fermée (annonce revenue) ⇒ aucune carte');
    dit(!etat.erreurs.length, 'D : aucune erreur d’app', etat.erreurs.join(' | ').slice(0, 300));
  } finally { await ctx.close(); }
}

async function scenarioE(nav) {
  console.log('\nE · compte retiré');
  const { ctx, pg, etat } = await ouvrir(nav, { b: base([MOD([E_MASQ])], [compte(222, 'autre_compte')]), largeur: 390 });
  try {
    await pg.waitForTimeout(6000);
    dit((await pg.locator(CARTE).count()) === 0, 'E : l’alerte d’un compte qu’il n’a plus ⇒ rien');
    dit(!etat.erreurs.length, 'E : aucune erreur d’app', etat.erreurs.join(' | ').slice(0, 300));
  } finally { await ctx.close(); }
}

(async () => {
  let nav;
  try {
    ({ servirTable } = await import('file://' + path.join(RACINE, 'src', 'exempleBase.js')));
    await new Promise((ok) => srv.listen(PORT, ok));
    nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const seul = (process.env.BANC_SEUL || '').split(',').filter(Boolean);
    const veut = (x) => !seul.length || seul.includes(x);
    if (veut('A')) for (const [l, s] of [[390, false], [1512, false], [390, true], [1512, true]]) await essaie(`A-${l}`, () => scenarioA(nav, l, s));
    if (veut('B')) await essaie('B', () => scenarioB(nav));
    if (veut('C')) await essaie('C', () => scenarioC(nav));
    if (veut('D')) await essaie('D', () => scenarioD(nav));
    if (veut('E')) await essaie('E', () => scenarioE(nav));
  } finally {
    if (nav) await nav.close();
    srv.close();
    console.log(`\n${ok} vert(s), ${ko} rouge(s) · captures : ${CAPTURES}`);
    process.exit(ko ? 1 : 0);
  }
})();
