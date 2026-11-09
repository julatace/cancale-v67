require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « UN NOUVEAU COMPTE RELIÉ » (8 nov.) — src/CompteRelie.jsx,
//  src/compteRelie.js, api/_lib/compte-relie.js. Base INVENTÉE (dépôt public),
//  servie par la règle de table du mode exemple (src/exempleBase.js : `select=`
//  projeté, `meta->>`, `id=in./like./eq.`, écritures gardées).
//   S. SERVEUR — la vraie route `api/push.js` (action `comptes`) EXÉCUTÉE contre
//      une fausse base à état et un faux Web Push : un compte neuf ⇒ UNE
//      notification (son nom, rangée « Nouveau compte relié ») ; rappelée ⇒ rien ;
//      deux appels EN MÊME TEMPS ⇒ une seule ; mémoire absente ⇒ rien (le serveur
//      ne pose jamais de point de départ) ; famille coupée ⇒ rien.
//   A. APP — un compte Vinted neuf (222) à côté d'un compte connu (111) : la
//      feuille paraît UNE fois, « shop_neuf est relié à VRM » ; annonces lues ⇒
//      « 12 annonces lues », ventes pas encore ⇒ « En cours » ; la ligne des
//      ventes servie ensuite ⇒ « 3 ventes lues » sans recharger ; `accueilli`
//      ÉCRIT ; le serveur prévenu ; un second chargement ⇒ aucune feuille ;
//      « Revoir l'accueil » (Comptes liés) la rouvre.
//   B. Deux comptes neufs ⇒ UNE feuille qui les liste.
//   C. Un compte vu il y a 10 min, rien de lu ⇒ le geste (« Ouvre une fois Mes
//      commandes… ») ; mouvement réduit ⇒ aucune animation (et animée sinon).
//   D. Aucune mémoire (Julien, inscrit depuis longtemps) ⇒ point de départ écrit,
//      ses comptes « déjà là », aucune feuille.
//   E. Mémoire illisible (503) ⇒ aucune feuille, aucune écriture.
//  390 px tactile et 1512 px, clair et sombre ; captures dans BANC_CAPTURES.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4627;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-compte-relie');
fs.mkdirSync(CAPTURES, { recursive: true });
const UID = '11111111-2222-3333-4444-555555555555';
const SESSION = { access_token: 'aaa.bbb.ccc', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'vendeuse@exemple.test', created_at: '2025-01-10T10:00:00.000Z' } };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const M = 60e3, H = 3600e3;
const iso = (ilYa) => new Date(Date.now() - ilYa).toISOString();

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String((e && e.stack) || e).split('\n').slice(0, 3).join(' ')); } };

let servirTable;
const ligne = (id, data) => ({ id, owner: UID, data, updated_at: iso(0) });
const compte = (uid, login) => ({ id: Number(uid), vinted_user_id: String(uid), login, domain: 'www.vinted.fr', owner: UID, updated_at: iso(0) });
const memo = (connus, bases = { vinted: Date.now() - 30 * 864e5, leboncoin: Date.now() - 30 * 864e5, vestiaire: Date.now() - 30 * 864e5, ebay: Date.now() - 30 * 864e5 }) => ligne('vrm_comptes_relies', { v: 1, bases, connus, rev: 3 });
const lignesCommunes = () => [
  ligne('main', { vrm_bienvenue_vue: { at: iso(30 * 864e5) }, vrm_visite: { at: iso(30 * 864e5), fin: 'fin' } }),
  ligne('harvest_111_listings', { capturedAt: iso(1 * H), nItems: 40, payload: { items: [] } }),
  ligne('harvest_111_orders_sold', { capturedAt: iso(1 * H), nItems: 50, payload: { my_orders: [] } }),
];

// ═════════════════════════════════ S. SERVEUR ═══════════════════════════════
async function serveur() {
  console.log('\nS · la route /api/push, action « comptes », exécutée');
  process.env.SUPABASE_URL = 'https://banc.supabase.test';
  process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
  process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
  const webpush = require(path.join(RACINE, 'node_modules', 'web-push'));
  const pushes = [];
  webpush.setVapidDetails = () => {};
  webpush.sendNotification = async (sub, body) => { pushes.push(JSON.parse(body)); return { statusCode: 201 }; };
  let tables;
  const remettre = (rows, comptes) => { tables = { app_data: { lignes: rows }, vinted_accounts: { lignes: comptes } }; pushes.length = 0; };
  const fetchAvant = global.fetch;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    const rep = (b, s = 200) => new Response(typeof b === 'string' ? b : JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
    if (u.pathname === '/auth/v1/user') return rep({ id: UID, email: 'vendeuse@exemple.test', created_at: '2025-01-10T10:00:00Z' });
    if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
    const t = u.pathname.replace('/rest/v1/', '');
    if (!tables[t]) return rep([]);
    const h = opts.headers || {};
    let corps = null; try { corps = opts.body ? JSON.parse(opts.body) : null; } catch (_) {}
    const x = servirTable(tables[t], { methode: (opts.method || 'GET').toUpperCase(), url: u.pathname + u.search, entetes: h, corps, owner: UID });
    return new Response(x.status === 204 || x.body == null ? null : JSON.stringify(x.body), { status: x.status, headers: x.headers });
  };
  const { default: handler } = await import('file://' + path.join(RACINE, 'api', 'push.js'));
  const appel = async () => {
    let st = 0, js = null;
    const res = { status(s) { st = s; return this; }, json(j) { js = j; return this; }, setHeader() {}, end() {} };
    await handler({ method: 'POST', headers: { authorization: 'Bearer aaa.bbb.ccc', origin: 'https://vrm.center' }, body: { action: 'comptes' } }, res);
    return { st, js };
  };
  const SUB = ligne('push_subs', { subs: [{ endpoint: 'https://fcm.googleapis.com/fcm/send/banc', keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } }], rev: 1 });
  const ici = () => (tables.app_data.lignes.find((r) => r.id === 'vrm_comptes_relies') || {}).data;
  await essaie('S1', async () => {
    remettre([SUB, memo({ 'vinted:111': { at: Date.now() - 20 * 864e5, base: true } })], [compte(111, 'shop_connu'), compte(222, 'shop_neuf')]);
    const r = await appel();
    dit(r.st === 200 && pushes.length === 1 && /shop_neuf/.test(pushes[0].title) && /relié/.test(pushes[0].title), 'S1 un compte neuf ⇒ UNE notification qui le nomme', JSON.stringify([r, pushes]));
    const d = ici();
    dit(!!(d && d.connus['vinted:222'] && d.connus['vinted:222'].notifie) && !(d.connus['vinted:111'].notifie), 'S1 sa ligne : `notifie` réservé pour 222 seulement', JSON.stringify(d));
    const journal = tables.app_data.lignes.find((x) => /^push_journal/.test(x.id));
    dit(!!journal && /shop_neuf/.test(JSON.stringify(journal.data)), 'S1 rangée dans la cloche (journal des notifications)');
    await appel();
    dit(pushes.length === 1, 'S2 rappelée ⇒ rien de plus', String(pushes.length));
  });
  await essaie('S3', async () => {
    remettre([SUB, memo({ 'vinted:111': { at: Date.now() - 20 * 864e5, base: true } })], [compte(111, 'shop_connu'), compte(222, 'shop_neuf')]);
    await Promise.all([appel(), appel(), appel()]);
    dit(pushes.length === 1, 'S3 trois appels en même temps ⇒ une seule notification', String(pushes.length));
  });
  await essaie('S4', async () => {
    remettre([SUB], [compte(111, 'shop_connu'), compte(222, 'shop_neuf')]);
    await appel();
    dit(pushes.length === 0 && !ici(), 'S4 aucune mémoire ⇒ rien envoyé, rien écrit (le point de départ est à l’app)');
  });
  await essaie('S5', async () => {
    remettre([SUB, memo({ 'vinted:111': { at: Date.now() - 20 * 864e5, base: true } }), ligne('push_prefs', { familles: { comptes: false } })], [compte(111, 'shop_connu'), compte(222, 'shop_neuf')]);
    await appel();
    dit(pushes.length === 0, 'S5 famille « Nouveau compte relié » coupée ⇒ rien', String(pushes.length));
  });
  await essaie('S6', async () => {
    remettre([SUB, memo({ 'vinted:111': { at: Date.now() - 20 * 864e5, base: true } })], [compte(111, 'shop_connu')]);
    await appel();
    dit(pushes.length === 0, 'S6 aucun compte neuf ⇒ rien', String(pushes.length));
  });
  global.fetch = fetchAvant;
}

// ═══════════════════════════════════ APP ════════════════════════════════════
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, { base, largeur = 390, sombre = false, reduit = false, panneMemo = false, tab = 'journee' }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light', reducedMotion: reduit ? 'reduce' : 'no-preference' });
  const pg = await ctx.newPage();
  const etat = { erreurs: [], ecritures: [], push: 0 };
  pg.on('pageerror', (e) => etat.erreurs.push(e.message));
  await pg.addInitScript(({ s, sombre }) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_mfa_plus_tard_' + s.user.id, String(Date.now())); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: new Date().toISOString() })); localStorage.setItem('vrm_parcours_plus_tard', JSON.stringify({ at: Date.now() })); } catch (_) {} }, { s: SESSION, sombre });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...SESSION, expires_in: 3600, id: UID, email: SESSION.user.email, created_at: SESSION.user.created_at }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const url = new URL(r.request().url()), m = r.request().method();
    if (/\/rpc\//.test(url.pathname)) return r.fulfill({ status: 200, contentType: 'application/json', body: 'true' });
    const t = url.pathname.slice('/rest/v1/'.length).split('/')[0];
    const table = base[t] || { lignes: [] };
    const brut = decodeURIComponent(url.search);
    if (panneMemo && /vrm_comptes_relies/.test(brut)) { if (m !== 'GET') etat.ecritures.push({ m, brut }); return r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); }
    let corps = null; try { corps = r.request().postData() ? JSON.parse(r.request().postData()) : null; } catch (_) {}
    if (m !== 'GET' && /vrm_comptes_relies/.test(brut + JSON.stringify(corps || ''))) etat.ecritures.push({ m, brut });
    const x = servirTable(table, { methode: m, url: url.pathname + url.search, entetes: r.request().headers(), corps, owner: UID });
    return r.fulfill({ status: x.status, headers: x.headers, body: x.status === 204 || x.body == null ? '' : JSON.stringify(x.body) });
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/\/api\/push/.test(u) && r.request().method() === 'POST' && /"comptes"/.test(r.request().postData() || '')) etat.push++;
    if (/mode=confidentialite/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, uid: UID }) });
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, actif: true, acces: true, statut: 'active', configure: false, obligatoire: false }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, etat };
}
const FEUILLE = '[data-compte-relie-feuille]';
const attendreFeuille = (pg, ms = 25000) => pg.locator(FEUILLE).first().waitFor({ timeout: ms }).then(() => true).catch(() => false);
// La feuille est-elle VRAIMENT au premier plan (rien ne la couvre : ni l'écran d'ouverture, ni une autre couche) ?
const auPremierPlan = (pg) => pg.waitForFunction(() => {
  const t = document.querySelector('[data-cr-titre]'); if (!t) return false;
  const r = t.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!(e && e.closest('[data-compte-relie-feuille]'));
}, null, { timeout: 8000 }).then(() => true).catch(() => false);
const memoDe = (base) => ((base.app_data.lignes.find((r) => r.id === 'vrm_comptes_relies') || {}).data) || null;
const capture = (pg, nom) => pg.screenshot({ path: path.join(CAPTURES, `compte-relie-${nom}.png`) }).catch(() => {});
const cibles44 = (pg) => pg.evaluate((sel) => [...document.querySelectorAll(`${sel} button, ${sel} a, ${sel} input`)].filter((e) => e.getClientRects().length && e.type !== 'checkbox').map((e) => e.getBoundingClientRect()).filter((r) => r.height < 43.5).length, FEUILLE);

async function scenarioA(nav, largeur, sombre) {
  const nom = `A-${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\nA · un compte neuf · ${nom}`);
  const base = { app_data: { lignes: [...lignesCommunes(), memo({ 'vinted:111': { at: Date.now() - 20 * 864e5, base: true } }),
    ligne('harvest_222_listings', { capturedAt: iso(1 * M), nItems: 12, payload: { items: [] } }),
    ligne('harvest_222_profile', { capturedAt: iso(1 * M), payload: { user: { login: 'shop_neuf' } } })] },
  vinted_accounts: { lignes: [compte(111, 'shop_connu'), compte(222, 'shop_neuf')] } };
  const { ctx, pg, etat } = await ouvrir(nav, { base, largeur, sombre });
  try {
    dit(await attendreFeuille(pg), `${nom} : la feuille paraît`);
    dit(await auPremierPlan(pg), `${nom} : au premier plan (rien ne la couvre)`);
    const f = pg.locator(FEUILLE).first();
    dit(/shop_neuf est relié à VRM/.test(await f.locator('[data-cr-titre]').innerText().catch(() => '')), `${nom} : « shop_neuf est relié à VRM »`);
    dit(await f.getAttribute('data-compte-relie-feuille') === '1' && (await f.locator('[data-cr-compte="vinted:111"]').count()) === 0, `${nom} : seul le compte neuf, jamais le compte déjà là`);
    await pg.waitForFunction(() => { const e = document.querySelector('[data-cr-etape="annonces"]'); return e && e.getAttribute('data-cr-etat') === 'lu'; }, null, { timeout: 15000 }).catch(() => {});
    const ann = f.locator('[data-cr-etape="annonces"]');
    dit(await ann.getAttribute('data-cr-etat') === 'lu' && await ann.getAttribute('data-cr-n') === '12' && /12 annonces lues/.test(await ann.innerText()), `${nom} : annonces lues ⇒ « 12 annonces lues » (le nombre servi)`, await ann.innerText().catch(() => ''));
    const ven = f.locator('[data-cr-etape="ventes"]');
    dit(await ven.getAttribute('data-cr-etat') === 'en-cours' && await ven.getAttribute('data-cr-n') === '' && !/\d/.test(await ven.innerText()), `${nom} : ventes pas encore lues ⇒ « En cours », aucun nombre`, await ven.innerText().catch(() => ''));
    dit(await f.getAttribute('data-cr-mouvement') === 'plein' && await pg.evaluate(() => getComputedStyle(document.querySelector('.vrm-cr-avatar-pos')).animationName) === 'vrm-cr-pop', `${nom} : l’avatar entre en mouvement`);
    const m1 = memoDe(base);
    dit(!!(m1 && m1.connus['vinted:222'] && m1.connus['vinted:222'].accueilli) && !m1.connus['vinted:111'].accueilli, `${nom} : \`accueilli\` ÉCRIT dans sa ligne avant d’être montré`, JSON.stringify(m1));
    dit(etat.push === 1, `${nom} : le serveur est prévenu une fois (/api/push · comptes)`, String(etat.push));
    await pg.waitForTimeout(900);
    await capture(pg, `${nom}-1-en-cours`);
    // La ligne des ventes arrive : l'étape se coche sans recharger.
    base.app_data.lignes.push(ligne('harvest_222_orders_sold', { capturedAt: iso(0), nItems: 3, payload: { my_orders: [] } }));
    await pg.waitForFunction(() => { const e = document.querySelector('[data-cr-etape="ventes"]'); return e && e.getAttribute('data-cr-etat') === 'lu'; }, null, { timeout: 20000 }).catch(() => {});
    dit(/3 ventes lues/.test(await ven.innerText().catch(() => '')) && await ven.getAttribute('data-cr-n') === '3', `${nom} : la ligne des ventes servie ⇒ « 3 ventes lues », sans recharger`, await ven.innerText().catch(() => ''));
    dit((await cibles44(pg)) === 0, `${nom} : cibles de 44 px`);
    dit(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${nom} : pas de débordement horizontal`);
    await pg.waitForTimeout(500);
    await capture(pg, `${nom}-2-ventes-lues`);
    await f.locator('[data-cr-fermer]').click();
    await pg.waitForTimeout(600);
    // Second chargement : plus de feuille.
    await pg.reload({ waitUntil: 'domcontentloaded' });
    dit(!(await attendreFeuille(pg, 9000)), `${nom} : second chargement ⇒ aucune feuille`);
    dit(etat.push === 1, `${nom} : ni de second appel au serveur`, String(etat.push));
    if (largeur === 390 && !sombre) {
      await pg.goto(`http://localhost:${PORT}/?tab=vintedaccounts`, { waitUntil: 'domcontentloaded' });
      const b = pg.locator('[data-comptes-relies-revoir]').first();
      await b.waitFor({ timeout: 20000 }).catch(() => {});
      await b.click().catch(() => {});
      dit(await attendreFeuille(pg, 10000) && await pg.locator(FEUILLE).first().getAttribute('data-cr-revoir') === '1' && (await pg.locator('[data-cr-compte="vinted:222"]').count()) === 1, `${nom} : « Revoir l’accueil » (Comptes liés) rouvre la feuille du compte relié`);
    }
    dit(!etat.erreurs.length, `${nom} : aucune erreur d’app`, etat.erreurs.join(' | ').slice(0, 300));
  } finally { await ctx.close(); }
}

async function scenarioB(nav, largeur, sombre) {
  const nom = `B-${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\nB · deux comptes neufs · ${nom}`);
  const base = { app_data: { lignes: [...lignesCommunes(), memo({ 'vinted:111': { at: Date.now() - 20 * 864e5, base: true } }),
    ligne('harvest_222_listings', { capturedAt: iso(1 * M), nItems: 12, payload: {} }), ligne('harvest_333_listings', { capturedAt: iso(1 * M), nItems: 1, payload: {} })] },
  vinted_accounts: { lignes: [compte(111, 'shop_connu'), compte(222, 'shop_neuf'), compte(333, 'boutique_deux')] } };
  const { ctx, pg, etat } = await ouvrir(nav, { base, largeur, sombre });
  try {
    dit(await attendreFeuille(pg), `${nom} : la feuille paraît`);
    dit(await auPremierPlan(pg), `${nom} : au premier plan (rien ne la couvre)`);
    await pg.waitForTimeout(1500);
    dit((await pg.locator(FEUILLE).count()) === 1 && await pg.locator(FEUILLE).first().getAttribute('data-compte-relie-feuille') === '2', `${nom} : UNE feuille pour les deux`);
    dit((await pg.locator('[data-cr-compte="vinted:222"]').count()) === 1 && (await pg.locator('[data-cr-compte="vinted:333"]').count()) === 1, `${nom} : chacun sa carte`);
    dit(/2 comptes reliés à VRM/.test(await pg.locator('[data-cr-titre]').innerText()), `${nom} : « 2 comptes reliés à VRM »`);
    dit(/1 annonce lue\b/.test(await pg.locator('[data-cr-compte="vinted:333"] [data-cr-etape="annonces"]').innerText()), `${nom} : « 1 annonce lue » (singulier)`);
    dit((await cibles44(pg)) === 0, `${nom} : cibles de 44 px`);
    await capture(pg, nom);
    dit(!etat.erreurs.length, `${nom} : aucune erreur d’app`, etat.erreurs.join(' | ').slice(0, 300));
  } finally { await ctx.close(); }
}

async function scenarioC(nav, reduit) {
  const nom = `C-${reduit ? 'reduit' : 'plein'}`;
  console.log(`\nC · vu il y a 10 min, rien de lu · ${nom}`);
  const base = { app_data: { lignes: [...lignesCommunes(), memo({ 'vinted:111': { at: Date.now() - 20 * 864e5, base: true }, 'vinted:222': { at: Date.now() - 10 * M, notifie: Date.now() - 10 * M } })] },
    vinted_accounts: { lignes: [compte(111, 'shop_connu'), compte(222, 'shop_neuf')] } };
  const { ctx, pg, etat } = await ouvrir(nav, { base, largeur: 390, reduit });
  try {
    dit(await attendreFeuille(pg), `${nom} : la feuille paraît (le serveur l’avait vu le premier)`);
    dit(await auPremierPlan(pg), `${nom} : au premier plan (rien ne la couvre)`);
    await pg.waitForTimeout(1500);
    const g = pg.locator('[data-cr-etape="ventes"] [data-cr-geste]');
    dit((await g.count()) === 1 && /Mes commandes/.test(await g.innerText()), `${nom} : rien ne vient ⇒ le geste est dit`);
    dit((await pg.locator('[data-cr-etat="lu"]').count()) === 0 && (await pg.locator('[data-cr-etat="pas-su"]').count()) === 0, `${nom} : rien de lu ⇒ aucune étape cochée, aucun nombre`);
    dit(etat.push === 0, `${nom} : déjà notifié ⇒ le serveur n’est pas rappelé`, String(etat.push));
    const anim = await pg.evaluate(() => [...document.querySelectorAll('.vrm-cr *')].map((e) => getComputedStyle(e).animationName).filter((a) => a && a !== 'none'));
    if (reduit) dit(anim.length === 0 && await pg.locator(FEUILLE).first().getAttribute('data-cr-mouvement') === 'reduit', `${nom} : mouvement réduit ⇒ aucune animation`, anim.join(','));
    else dit(anim.length > 0, `${nom} : sinon, animée`);
    await capture(pg, nom);
    dit(!etat.erreurs.length, `${nom} : aucune erreur d’app`, etat.erreurs.join(' | ').slice(0, 300));
  } finally { await ctx.close(); }
}

async function scenarioD(nav) {
  console.log('\nD · aucune mémoire, vendeur de longue date');
  const base = { app_data: { lignes: lignesCommunes() }, vinted_accounts: { lignes: [compte(111, 'shop_connu'), compte(222, 'shop_neuf')] } };
  const { ctx, pg, etat } = await ouvrir(nav, { base, largeur: 1512 });
  try {
    dit(!(await attendreFeuille(pg, 10000)), 'D : aucune feuille');
    const m = memoDe(base);
    dit(!!(m && m.bases && m.bases.vinted && m.connus['vinted:111'].base && m.connus['vinted:222'].base), 'D : point de départ écrit, ses comptes « déjà là »', JSON.stringify(m));
    dit(etat.push === 0, 'D : le serveur n’est pas appelé');
    dit(!etat.erreurs.length, 'D : aucune erreur d’app', etat.erreurs.join(' | ').slice(0, 300));
  } finally { await ctx.close(); }
}

async function scenarioE(nav) {
  console.log('\nE · mémoire illisible (503)');
  const base = { app_data: { lignes: [...lignesCommunes(), memo({ 'vinted:111': { at: Date.now() - 20 * 864e5, base: true } })] }, vinted_accounts: { lignes: [compte(111, 'shop_connu'), compte(222, 'shop_neuf')] } };
  const { ctx, pg, etat } = await ouvrir(nav, { base, largeur: 390, panneMemo: true });
  try {
    dit(!(await attendreFeuille(pg, 10000)), 'E : aucune feuille');
    dit(etat.ecritures.length === 0 && etat.push === 0, 'E : aucune écriture, aucun appel au serveur', JSON.stringify(etat.ecritures).slice(0, 200));
  } finally { await ctx.close(); }
}

(async () => {
  let nav;
  try {
    ({ servirTable } = await import('file://' + path.join(RACINE, 'src', 'exempleBase.js')));
    await serveur();
    await new Promise((ok) => srv.listen(PORT, ok));
    nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const seul = (process.env.BANC_SEUL || '').split(',').filter(Boolean);
    const veut = (x) => !seul.length || seul.includes(x);
    if (veut('A')) for (const [l, s] of [[390, false], [1512, false], [390, true], [1512, true]]) await essaie(`A-${l}`, () => scenarioA(nav, l, s));
    if (veut('B')) for (const [l, s] of [[390, false], [1512, true]]) await essaie(`B-${l}`, () => scenarioB(nav, l, s));
    if (veut('C')) { await essaie('C-plein', () => scenarioC(nav, false)); await essaie('C-reduit', () => scenarioC(nav, true)); }
    if (veut('D')) await essaie('D', () => scenarioD(nav));
    if (veut('E')) await essaie('E', () => scenarioE(nav));
  } catch (e) { dit(false, 'le banc s’exécute', String((e && e.stack) || e).slice(0, 300)); }
  finally {
    if (nav) await nav.close(); srv.close();
    console.log(`\n${ko ? '❌' : '✅'} compte-relie : ${ok} vert(s), ${ko} rouge(s) — captures : ${CAPTURES}`);
    process.exit(ko ? 1 : 0);
  }
})();
