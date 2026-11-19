require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « VINTED A BLOQUÉ {COMPTE} » (19 nov., lot compte-bloque, ext. 5.409) —
//  src/CompteBloque.jsx, règle src/compteBloque.js. Base INVENTÉE (dépôt public),
//  servie par la règle de table du mode exemple (src/exempleBase.js : `select=`
//  projeté, `meta->>`, `id=like.`, écritures gardées).
//   A. compte bloqué (profil lu `banni`), aucun choix : LA carte sur la coque,
//      « Vinted a bloqué shop_cancale · Mettre ses 3 annonces en pause ? »,
//      Oui / Garder / Plus tard ; « Oui » ⇒ son choix rangé (`vrm_comptes_bloques`,
//      épisode du blocage), la carte s'en va. 390 tactile et 1512, clair et sombre.
//   B. débloqué (profil relu « actif ») après SA pause : « shop_cancale est
//      débloqué : 3 annonces remises » ; « OK » ⇒ clos, plus de carte.
//   C. état illisible (503) ⇒ aucune carte, aucune erreur (pas su ≠ bloqué).
//   D. Annonces : en pause ⇒ ses annonces hors de la liste, « 2 annonces en pause ·
//      compte bloqué (shop_cancale) » ; l'autre compte reste.
//   E. « Garder » ⇒ plus de question, ses annonces restent.
//  Captures dans BANC_CAPTURES (à regarder : §6.2).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4659;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-compte-bloque');
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
const ligne = (id, data, meta) => ({ id, owner: UID, data, updated_at: iso(0), ...(meta ? { meta } : {}) });
const compte = (uid, login) => ({ id: Number(uid), vinted_user_id: String(uid), login, domain: 'www.vinted.fr', owner: UID, updated_at: iso(0) });
const DEPUIS = iso(5 * H);
const BANNI = { etat: 'banni', at: iso(H), preuve: 'champ profil is_account_banned', depuis: DEPUIS };
const ACTIF = { etat: 'actif', at: iso(60e3), preuve: 'champ profil is_account_banned', depuis: iso(60e3) };
const article = (id, titre) => ({ id, title: titre, price: { amount: '65.0', currency_code: 'EUR' }, url: `https://www.vinted.fr/items/${id}`, photo: null, status: 'Très bon état', is_closed: false, is_hidden: false, is_reserved: false, is_draft: false, created_at_ts: iso(10 * 864e5) });
const dressing = (uid, items) => { const cap = iso(10 * 60e3); return ligne(`harvest_${uid}_listings`, { capturedAt: cap, nItems: items.length, complet: true, payload: { items, pagination: { total_entries: items.length, total_pages: 1, current_page: 1 } } }, { capturedAt: cap, nItems: String(items.length) }); };
const base = ({ etat111 = BANNI, choix = null, panne = false } = {}) => ({ app_data: { lignes: [
  ligne('main', { vrm_bienvenue_vue: { at: iso(30 * 864e5) }, vrm_visite: { at: iso(30 * 864e5), fin: 'fin' }, ...(choix ? { vrm_comptes_bloques: choix } : {}) }),
  ligne('panel_comptes_etat', { comptes: { 111: etat111, 222: { etat: 'actif', at: iso(H), preuve: 'champ profil is_account_banned' } } }),
  dressing(111, [article(1000041, 'Nike Air Max 90 blanche'), article(1000042, 'Adidas Samba noire'), article(1000043, 'New Balance 550')]),
  dressing(222, [article(2000051, 'Asics Gel-Kayano 14')]),
] }, vinted_accounts: { lignes: [compte(111, 'shop_cancale'), compte(222, 'autre_compte')] } });

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, { b, largeur = 390, sombre = false, panne = false, tab = 'journee' }) {
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
    if (/panel_comptes_etat/.test(brut)) { etat.lectures++; if (panne) return r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); }
    let corps = null; try { corps = r.request().postData() ? JSON.parse(r.request().postData()) : null; } catch (_) {}
    const x = servirTable(table, { methode: m, url: url.pathname + url.search, entetes: r.request().headers(), corps, owner: UID });
    return r.fulfill({ status: x.status, headers: x.headers, body: x.status === 204 || x.body == null ? '' : JSON.stringify(x.body) });
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, actif: true, acces: true, statut: 'active', configure: false, obligatoire: false }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, etat };
}
const CARTE = '[data-compte-bloque]';
const attendre = (pg, sel = CARTE, ms = 25000) => pg.locator(sel).first().waitFor({ timeout: ms }).then(() => true).catch(() => false);
const capture = (pg, nom) => pg.screenshot({ path: path.join(CAPTURES, `compte-bloque-${nom}.png`) }).catch(() => {});
const cibles44 = (pg) => pg.evaluate((sel) => [...document.querySelectorAll(`${sel} button, ${sel} a`)].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect()).filter((r) => r.height < 43.5).length, CARTE);
const choixLu = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_comptes_bloques') || 'null'); } catch (_) { return null; } });

async function scenarioA(nav, largeur, sombre) {
  const nom = `A-${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\nA · compte bloqué, la question · ${nom}`);
  const { ctx, pg, etat } = await ouvrir(nav, { b: base(), largeur, sombre });
  try {
    dit(await attendre(pg), `${nom} : la carte paraît`);
    await pg.waitForFunction(() => { const c = document.querySelector('[data-compte-bloque]'); return c && c.getAttribute('data-compte-bloque-n') === '3'; }, null, { timeout: 12000 }).catch(() => {});
    const c = pg.locator(CARTE).first();
    const txt = await c.innerText();
    dit(await c.getAttribute('data-compte-bloque') === '111' && await c.getAttribute('data-compte-bloque-phase') === 'question', `${nom} : une carte, le compte bloqué seulement`);
    dit(/Vinted a bloqué shop_cancale/.test(txt) && /Mettre ses 3 annonces en pause/.test(txt), `${nom} : « Vinted a bloqué shop_cancale · Mettre ses 3 annonces en pause ? »`, txt);
    dit((await pg.locator(CARTE).count()) === 1, `${nom} : l’autre compte (actif) ⇒ aucune carte`);
    dit((await c.locator('button').count()) === 3 && (await c.locator('.vrm-cb-plein').count()) === 1, `${nom} : Oui / Garder / Plus tard, un seul plein`);
    dit((await cibles44(pg)) === 0, `${nom} : cibles de 44 px`);
    dit(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${nom} : pas de débordement horizontal`);
    const coupe = await pg.evaluate((sel) => [...document.querySelectorAll(`${sel} *`)].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').length, CARTE);
    dit(coupe === 0, `${nom} : aucun texte coupé`);
    const couleurs = await pg.evaluate((sel) => [...document.querySelectorAll(`${sel}, ${sel} *`)].map((e) => getComputedStyle(e).color + '|' + getComputedStyle(e).backgroundColor).join(' '), CARTE);
    dit(!/rgb\(2[0-5]\d, [0-6]\d, [0-6]\d\)/.test(couleurs), `${nom} : aucun rouge (§7)`);
    // Contraste du texte principal sur le fond de la carte.
    const contraste = await pg.evaluate((sel) => {
      const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
      const carte = document.querySelector(sel + ' .vrm-cb-carte') || document.querySelector(sel);
      const fond = getComputedStyle(carte).backgroundColor;
      return [...carte.querySelectorAll('p')].map((p) => { const a = lum(getComputedStyle(p).color), b = lum(fond); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }).reduce((m, x) => Math.min(m, x), 99);
    }, '.vrm-cb');
    dit(contraste >= 4.5, `${nom} : contraste ≥ 4,5:1 (${contraste.toFixed(2)})`);
    await capture(pg, `${nom}-1`);
    await c.locator('[data-compte-bloque-geste="pause"]').click();
    await pg.waitForTimeout(700);
    dit((await pg.locator(CARTE).count()) === 0, `${nom} : « Oui, en pause » ⇒ la carte s’en va`);
    const ch = await choixLu(pg);
    dit(!!ch && ch['111'] && ch['111'].choix === 'pause' && ch['111'].episode === DEPUIS && ch['111'].n === 3, `${nom} : son choix rangé (pause, épisode du blocage, 3)`, JSON.stringify(ch));
    await capture(pg, `${nom}-2`);
    dit(!etat.erreurs.length, `${nom} : aucune erreur d’app`, etat.erreurs.join(' | ').slice(0, 300));
  } finally { await ctx.close(); }
}

async function scenarioB(nav, largeur) {
  const nom = `B-${largeur}`;
  console.log(`\nB · débloqué après sa pause · ${nom}`);
  const { ctx, pg, etat } = await ouvrir(nav, { b: base({ etat111: ACTIF, choix: { 111: { choix: 'pause', at: iso(2 * H), episode: DEPUIS, n: 3 } } }), largeur });
  try {
    dit(await attendre(pg), `${nom} : la carte paraît`);
    const c = pg.locator(CARTE).first();
    const txt = await c.innerText();
    dit(await c.getAttribute('data-compte-bloque-phase') === 'remis' && /shop_cancale est débloqué : 3 annonces remises/.test(txt), `${nom} : « shop_cancale est débloqué : 3 annonces remises »`, txt);
    dit((await cibles44(pg)) === 0, `${nom} : cibles de 44 px`);
    await capture(pg, nom);
    await c.locator('[data-compte-bloque-geste="ok"]').click();
    await pg.waitForTimeout(600);
    const ch = await choixLu(pg);
    dit((await pg.locator(CARTE).count()) === 0 && ch && ch['111'] && !!ch['111'].fin, `${nom} : « OK » ⇒ clos (jamais effacé), plus de carte`, JSON.stringify(ch));
    dit(!etat.erreurs.length, `${nom} : aucune erreur d’app`, etat.erreurs.join(' | ').slice(0, 300));
  } finally { await ctx.close(); }
}

async function scenarioC(nav) {
  console.log('\nC · état illisible (503)');
  const { ctx, pg, etat } = await ouvrir(nav, { b: base(), largeur: 1512, panne: true });
  try {
    await pg.waitForTimeout(7000);
    dit(etat.lectures > 0 && (await pg.locator(CARTE).count()) === 0, 'C : lu, illisible ⇒ aucune carte (pas su ≠ bloqué)', String(etat.lectures));
    dit(!etat.erreurs.length, 'C : aucune erreur d’app', etat.erreurs.join(' | ').slice(0, 300));
    await capture(pg, 'C');
  } finally { await ctx.close(); }
}

async function scenarioD(nav, largeur, choix, attendu) {
  const nom = `D-${largeur}-${attendu}`;
  console.log(`\nD · Annonces, compte bloqué · ${nom}`);
  const { ctx, pg, etat } = await ouvrir(nav, { b: base({ choix: { 111: { choix, at: iso(30 * 60e3), episode: DEPUIS, n: 3 } } }), largeur, tab: 'annonces' });
  try {
    await pg.waitForTimeout(9000);
    const enPause = await pg.locator('[data-annonces-en-pause]').first().getAttribute('data-annonces-en-pause').catch(() => null);
    const txt = await pg.locator('[data-annonces-en-pause]').first().innerText().catch(() => '');
    const page = await pg.evaluate(() => document.body.innerText);
    if (attendu === 'pause') {
      dit(enPause === '3' && /3 annonces en pause · compte bloqué \(shop_cancale\)/.test(txt), `${nom} : « 3 annonces en pause · compte bloqué (shop_cancale) »`, String(enPause) + ' ' + txt);
      dit(!/Adidas Samba noire/.test(page) && /Asics Gel-Kayano 14/.test(page), `${nom} : ses annonces hors de la liste, l’autre compte reste`);
    } else {
      dit(enPause === null, `${nom} : « garder » ⇒ aucune ligne « en pause »`, String(enPause));
      dit((await pg.locator(CARTE).count()) === 0, `${nom} : « garder » ⇒ plus de question`);
    }
    await capture(pg, nom);
    dit(!etat.erreurs.length, `${nom} : aucune erreur d’app`, etat.erreurs.join(' | ').slice(0, 300));
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
    if (veut('B')) for (const l of [390, 1512]) await essaie(`B-${l}`, () => scenarioB(nav, l));
    if (veut('C')) await essaie('C', () => scenarioC(nav));
    if (veut('D')) { await essaie('D-pause', () => scenarioD(nav, 390, 'pause', 'pause')); await essaie('D-garder', () => scenarioD(nav, 1512, 'garder', 'garder')); }
  } finally {
    if (nav) await nav.close();
    srv.close();
    console.log(`\n${ok} vert(s), ${ko} rouge(s) · captures : ${CAPTURES}`);
    process.exit(ko ? 1 : 0);
  }
})();
