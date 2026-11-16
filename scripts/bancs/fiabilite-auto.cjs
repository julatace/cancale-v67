// ════════════════════════════════════════════════════════════════════════════
//  BANC : LA FIABILITÉ AUTOMATIQUE DANS « TOUT VA BIEN ? » (15 nov., lot fiabilite-auto)
//    npm run build && node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/fiabilite-auto.cjs
//  La VRAIE app (`dist`), une fausse base qui applique la projection `select=` ; les lignes
//  sont FABRIQUÉES par les vraies fonctions (`resultatControle`, `rapportPlantages`). Données
//  inventées (dépôt public).
//   A. « ecart » — l'extension de CE navigateur en 5.329 (pont simulé) : « Ce Chrome a la
//      5.329 : installe la 5.385 » + le zip, en haut de l'app (ligne de fraîcheur) ET dans
//      Tout va bien ? ; le contrôle de cette nuit : N°12 en ROUGE, une vente sans N°, un compte
//      pas relu depuis 24 h — JAMAIS « ventes à dater » ; Ma journée ne porte plus la carte ;
//      « Santé de chaque compte » ouvre la feuille : un compte par carte (vérification Vinted
//      ⇒ « Arrêté », lu par un Chrome en 5.329 ⇒ « Extension en retard »), un état, un geste ;
//      × la ferme.
//   B. « ok » — extension à jour, contrôle tout à 0 : aucune alerte d'extension, « Tout est en
//      ordre », « Tous tes comptes vont bien ».
//   C. « proprio » — le propriétaire : « Plantages chez les autres vendeurs » (personnes,
//      ouverture bloquée, morceaux périmés), servi par `rapportPlantages`.
//  390 tactile et 1512, clair et sombre ; captures dans BANC_CAPTURES (défaut
//  scripts/bancs/captures/) — à REGARDER (§6.2). Jugé sur des data-* et des nombres.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http');
const { pathToFileURL } = require('url');
const { metaVersData } = require('./_meta.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const R = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(R, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4397;
const CAPT = process.env.BANC_CAPTURES || path.join(__dirname, 'captures');
fs.mkdirSync(CAPT, { recursive: true });
const ATTENDUE = (/const EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8')) || [])[1];
// (16 nov., vague C) Le texte « installe la … » se juge sur CETTE version aussi (il était épinglé à 5.385
// et rougissait à chaque version servie).
const ATT_RE = String(ATTENDUE).replace(/\.0$/, '').replace(/\./g, '\\.');   // « 5.393.0 » s'écrit « 5.393 »
const H = 3600e3, M = 60e3;
const iso = (ilYa) => new Date(Date.now() - ilYa).toISOString();
const JULIEN = '11111111-1111-4111-8111-111111111111';
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 2, vinted_user_id: '222', login: 'second_test', domain: 'www.vinted.fr', updated_at: iso(0) },
];
const appareil = (id, ap, ilYa, code, vus) => ({ id: 'ext_appareil_' + id, data: { v: 1, appareil: ap, ver: code, code, at: iso(ilYa), atMs: Date.now() - ilYa, flux: { vinted: { okAt: Date.now() - ilYa, koAt: null, refus: [] } }, vus } });

let C = null, RP = null;
function base(scen) {
  const ecart = scen === 'ecart';
  const ctl = ecart
    ? C.resultatControle({ 'numeros-double': ['12'], 'vente-sans-numero': ['600001'], 'versement-30j': 1741, 'comptes-48h': [], 'enligne-24h': ['222'], 'pool-retreci': null, 'totaux-mois': [] }, { 'pool-retreci': 'aucune liste de numéros' }, Date.now() - 2 * H, { 'versement-30j': { datees: 356, cause: 'vinted-detail', total: 1741 } })
    : C.resultatControle({ 'numeros-double': [], 'vente-sans-numero': [], 'versement-30j': 1741, 'comptes-48h': [], 'enligne-24h': [], 'pool-retreci': [], 'totaux-mois': [] }, {}, Date.now() - 2 * H);
  return [
    { id: 'harvest_111_profile', data: { capturedAt: iso(1 * H) } },
    { id: 'harvest_111_listings', data: { capturedAt: iso(1 * H) } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: iso(1 * H) } },
    { id: 'harvest_222_profile', data: { capturedAt: iso(2 * H) } },
    { id: 'harvest_222_listings', data: { capturedAt: iso(2 * H) } },
    { id: 'harvest_222_orders_sold', data: { capturedAt: iso(2 * H) } },
    { id: 'panel_comptes_etat', data: { comptes: {} } },
    { id: 'panel_diag_capture', data: { ver: ATTENDUE, verCode: ATTENDUE, majAt: iso(6 * M), n: {}, rates: {} } },
    appareil('0f1e2d3c4b5a6978', { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, 10 * M, ecart ? '5.329.0' : ATTENDUE, { vinted: { 222: Date.now() - 2 * H } }),
    appareil('a1b2c3d4e5f60718', { paquet: 'chromium', nav: 'edge', systeme: 'windows' }, 5 * M, ATTENDUE, { vinted: { 111: Date.now() - 1 * H } }),
    ...(ecart ? [{ id: 'actions_compte_111_a1b2c3d4e5f60718', data: { ts: [], max: 50, reserve: 5, captcha: Date.now() - 30 * M, arret: 'captcha' } }] : []),
    { id: 'vrm_controle_nuit', data: ctl },
  ];
}
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = null; continue; }
    const texte = /->>[^>]*$/.test(src);
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (texte && v != null && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
};
const PONT = (version) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: 'ext-banc', vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {} } });
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);

const sessionDe = (id, jeton) => ({ access_token: jeton, refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id, email: 'banc@exemple.test' } });
const ABO = { ok: true, configure: true, modeTest: true, obligatoire: false, prix: { montant: 16.99, devise: 'eur', intervalle: 'month' }, prixConforme: true, prixStripe: null, statut: null, finPeriode: null, annuleFinPeriode: false, peutGerer: false, actif: true, acces: true, mentionsCompletes: true };

async function ouvrirToutVaBien(pg) {
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-tout-va-bien]:visible, [data-sous-ouvrir="toutvabien"]:visible').first().waitFor({ timeout: 30000 });
  if (!(await pg.locator('[data-tout-va-bien]').first().isVisible().catch(() => false))) await pg.locator('[data-sous-ouvrir="toutvabien"]').first().click();
  await pg.waitForFunction(() => { const e = document.querySelector('[data-tout-va-bien]'); return e && e.getAttribute('data-tout-va-bien') !== 'lecture'; }, null, { timeout: 30000 }).catch(() => {});
  return pg.locator('[data-tout-va-bien]').first();
}
const cibles = (pg, sel) => pg.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length && e.getBoundingClientRect().height < 43.5).map((e) => (e.className + ':' + e.textContent).slice(0, 60)), sel);

async function scenario(b, scen, largeur, sombre) {
  const rows = base(scen);
  const ctx = await b.newContext({ viewport: { width: largeur, height: 900 }, hasTouch: largeur < 600, isMobile: largeur < 600, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const proprio = scen === 'proprio';
  const session = proprio ? sessionDe(JULIEN, 'j.julien.x') : null;
  // Le parcours de premier lancement (« Tu vends quoi ? ») est déjà fait : il couvrirait l'écran.
  await pg.addInitScript(([s, so, sess]) => { try { if (sess) { localStorage.setItem('vrm_session', JSON.stringify(sess)); localStorage.setItem('vrm_mfa_plus_tard_' + sess.user.id, String(Date.now())); } else localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', so ? 'true' : 'false');
    localStorage.setItem('vrm_je_vends', JSON.stringify({ choix: 'sneakers', at: '2026-11-01T10:00:00Z', vu: 'banc' })); localStorage.setItem('vrm_configuration', JSON.stringify({ etat: 'fait', at: '2026-11-01T10:00:00.000Z', statut: null, version: 1 }));
    localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: new Date().toISOString() }));
    const t = new Date().toISOString(); localStorage.setItem('vrm_parcours_plus_tard', JSON.stringify({ extension: t, emails: t, vinted: t, premiere: t, configuration: t, at: Date.now() })); } catch (_) {} }, [null, sombre, session]);
  await pg.addInitScript(PONT, scen === 'ecart' ? '5.329.0' : ATTENDUE);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  if (proprio) await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'j.julien.x', refresh_token: 'r', expires_in: 3600, user: session.user }) }));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u) && !/vinted_accounts/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  const rapport = RP.rapportPlantages({
    comptes: [{ cle: 'erreur-x', message: "Cannot read properties of undefined (reading 'n')", comptes: 4, fois: 11, ecrans: ['Colis'], appareils: ['iPhone', 'Mac'], versions: ['15 novembre à 10:00'], bloque: 0, dernier: iso(H) },
      { cle: 'erreur-y', message: 'Minified React error #31', comptes: 1, fois: 1, ecrans: ['Ventes'], appareils: ['Mac'], versions: [], bloque: 0, dernier: iso(3 * H) }],
    terrain: [{ jour: '2026-11-15', types: [{ cle: 'morceau', message: 'Failed to fetch dynamically imported module: https://vrm.center/assets/App-a.js', ecrans: [{ e: 'journee', nom: 'Ma journée' }], n: 2, appareils: 1, bloque: 2, navigateurs: { 'iOS Safari': 2 }, versions: [], dernier: iso(30 * M) }] }],
    mesures: [{ jour: '2026-11-14', lignes: [{ ecran: 'ventes', appareil: 'telephone', metrique: 'morceau', n: 6 }] }],
  });
  await pg.route('**/api/**', (route) => {
    const u = new URL(route.request().url());
    const mode = u.searchParams.get('mode');
    if (u.pathname === '/api/compte' && mode === 'abonnement') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...ABO, proprietaire: proprio }) });
    if (u.pathname === '/api/compte' && mode === 'mesures' && u.searchParams.get('quoi') === 'rapport-plantages') return route.fulfill({ status: proprio ? 200 : 403, contentType: 'application/json', body: JSON.stringify(proprio ? { ok: true, ...rapport } : { ok: false }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  const nom = `${scen}-${largeur}-${sombre ? 'sombre' : 'clair'}`;
  // Ma journée : la ligne du haut dit l'extension d'ici ; la carte du contrôle n'y est plus.
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4500);
  if (scen === 'ecart') {
    await pg.waitForTimeout(3000);
    dit(!(await pg.locator('[data-controle], [data-controle-ok], [data-fia-controle]').count()), `${nom} : Ma journée ne porte pas la carte du contrôle de nuit`);
    dit(!/à dater/i.test(await pg.locator('main').innerText().catch(() => '')), `${nom} : « ventes à dater » n’est écrit nulle part dans Ma journée`);
    if (largeur === 390 && !sombre) await pg.screenshot({ path: path.join(CAPT, `fiabilite-journee-${nom}.png`) });
  }
  const page = await ouvrirToutVaBien(pg);
  await pg.waitForTimeout(2500);
  const texte = await page.innerText().catch(() => '');
  if (scen === 'ecart') {
    const ext = page.locator('[data-fia-ext-ici]');
    dit((await ext.count()) === 1 && (await ext.getAttribute('data-fia-ext-ici')) === '5.329', `${nom} : l’extension de CE navigateur en retard est dite`, await ext.count());
    const t = (await ext.count()) ? await ext.innerText() : '';
    dit(new RegExp(`Ce (Chrome|navigateur) a la 5\\.329 : installe la ${ATT_RE}`).test(t) && (await ext.locator('a[href="/VRM-extension.zip"][download]').count()) === 1, `${nom} : « Ce Chrome a la 5.329 : installe la ${ATTENDUE} » + le zip`, t);
    const ctl = page.locator('[data-fia-controle]');
    dit(await ctl.getAttribute('data-fia-controle') === 'probleme' && Number(await ctl.getAttribute('data-fia-controle-n')) === 3, `${nom} : le contrôle de cette nuit : 3 écarts`, await ctl.getAttribute('data-fia-controle-n'));
    dit(await page.locator('[data-fia-controle-ligne="numeros-double"]').getAttribute('data-ton') === 'rouge', `${nom} : le N° porté par deux paires en ROUGE (le seul)`);
    dit((await page.locator('[data-fia-controle-ligne="vente-sans-numero"]').count()) === 1 && (await page.locator('[data-fia-controle-ligne="enligne-24h"]').count()) === 1, `${nom} : la vente sans N° et le compte pas relu, chacun avec son geste`);
    dit(!(await page.locator('[data-fia-controle-ligne="versement-30j"]').count()) && !/à dater|1741|1 741/.test(texte), `${nom} : JAMAIS « ventes à dater »`);
    dit((await page.locator('[data-fia-controle-passu]').count()) === 1, `${nom} : le contrôle pas lu est dit à part, jamais compté 0`);
    const ouvrir = page.locator('[data-fia-sante-ouvrir]');
    dit((await ouvrir.count()) === 1 && Number(await ouvrir.getAttribute('data-fia-sante-ouvrir')) >= 2, `${nom} : « Santé de chaque compte » dit combien sont à voir`, await ouvrir.getAttribute('data-fia-sante-ouvrir').catch(() => ''));
    await pg.evaluate(() => { const e = document.querySelector('[data-fiabilite]'); if (e) e.scrollIntoView({ block: 'start' }); });
    await pg.waitForTimeout(300);
    await pg.screenshot({ path: path.join(CAPT, `fiabilite-toutvabien-${nom}.png`) });
    await ouvrir.click();
    const f = pg.locator('[data-fia-feuille="sante"]');
    await f.waitFor({ timeout: 10000 }).catch(() => {});
    const c111 = f.locator('[data-fia-sante="vinted:111"]'), c222 = f.locator('[data-fia-sante="vinted:222"]');
    dit(await c111.getAttribute('data-fia-sante-etat').catch(() => '') === 'arret' && /Arrêté/.test(await c111.innerText().catch(() => '')) && /vérification/.test(await c111.innerText().catch(() => '')), `${nom} : la feuille — atelier_test « Arrêté », le geste de la vérification`);
    dit(await c222.getAttribute('data-fia-sante-etat').catch(() => '') === 'extension' && /5\.329/.test(await c222.innerText().catch(() => '')) && new RegExp(`Installe la ${ATT_RE}`).test(await c222.innerText().catch(() => '')), `${nom} : second_test lu par un Chrome en 5.329 ⇒ « Extension en retard », installe la 5.385`, await c222.innerText().catch(() => ''));
    dit((await f.locator('[data-fia-sante]').count()) === 2 && (await f.locator('[data-fia-sante-geste]').count()) === 2, `${nom} : un compte par carte, UN geste chacun`);
    dit(!/à dater/i.test(await f.innerText().catch(() => '')), `${nom} : la feuille ne parle jamais de ventes à dater`);
    const petites = await cibles(pg, '[data-fia-feuille] button, [data-fia-feuille] a');
    dit(!petites.length, `${nom} : cibles de 44 px dans la feuille`, petites.join(' | '));
    dit(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${nom} : pas de débordement horizontal`);
    await pg.waitForTimeout(400);
    await pg.screenshot({ path: path.join(CAPT, `fiabilite-feuille-${nom}.png`) });
    await f.locator('[data-fia-fermer]').click();
    await pg.waitForTimeout(400);
    dit(!(await pg.locator('[data-fia-feuille]').count()), `${nom} : × ferme la feuille`);
    // La ligne de fraîcheur (en haut de l'app, et sa copie dans la feuille de la cloche) : l'extension d'ICI,
    // avec le paquet à portée de doigt.
    await pg.waitForFunction(() => [...document.querySelectorAll('[data-fraicheur-unique]')].some((e) => e.getAttribute('data-fraicheur-unique') === 'retard'), null, { timeout: 60000 }).catch(() => {});
    const titres = await pg.evaluate(() => [...document.querySelectorAll('[data-fraicheur-unique]')].map((e) => (e.getAttribute('title') || e.textContent || '')).join(' | '));
    dit(new RegExp(`a la 5\\.329 : installe la ${ATT_RE}`).test(titres), `${nom} : la ligne de fraîcheur dit « … a la 5.329 : installe la ${ATTENDUE} »`, titres);
  } else if (scen === 'ok') {
    dit(!(await page.locator('[data-fia-ext-ici]').count()), `${nom} : extension à jour ⇒ aucune alerte d’extension (jamais pour une version publiée à jour)`);
    dit((await page.locator('[data-fia-controle-ok]').count()) === 1, `${nom} : « Tout est en ordre · vérifié cette nuit »`);
    dit(Number(await page.locator('[data-fia-sante-ouvrir]').getAttribute('data-fia-sante-ouvrir').catch(() => '-1')) === 0, `${nom} : « Tous tes comptes vont bien »`);
    dit(!/à dater/i.test(texte), `${nom} : pas un mot des ventes à dater (1 741 dans la ligne)`);
    await pg.evaluate(() => { const e = document.querySelector('[data-fiabilite]'); if (e) e.scrollIntoView({ block: 'start' }); });
    await pg.waitForTimeout(300);
    await pg.screenshot({ path: path.join(CAPT, `fiabilite-toutvabien-${nom}.png`) });
  } else {
    const pl = page.locator('[data-fia-plantages]');
    await pl.waitFor({ timeout: 15000 }).catch(() => {});
    await pg.waitForFunction(() => { const e = document.querySelector('[data-fia-plantages]'); return e && e.getAttribute('data-fia-plantages') !== 'lecture'; }, null, { timeout: 15000 }).catch(() => {});
    dit(await pl.getAttribute('data-fia-plantages').catch(() => '') === '3', `${nom} : le propriétaire lit 3 types de plantages`, await pl.getAttribute('data-fia-plantages').catch(() => ''));
    dit(await page.locator('[data-fia-plantage="morceau"]').getAttribute('data-fia-plantage-bloque').catch(() => '') === '2' && await page.locator('[data-fia-plantage]').first().getAttribute('data-fia-plantage') === 'morceau', `${nom} : l’ouverture bloquée (morceau périmé) en tête`);
    dit(await page.locator('[data-fia-plantage="erreur-x"]').getAttribute('data-fia-plantage-personnes').catch(() => '') === '4' && await page.locator('[data-fia-plantage="erreur-y"]').getAttribute('data-ton').catch(() => '') === 'neutre', `${nom} : 4 personnes ⇒ à dire ; 1 personne ⇒ neutre`);
    dit(await page.locator('[data-fia-morceaux]').getAttribute('data-fia-morceaux').catch(() => '') === '6', `${nom} : les morceaux périmés comptés par les appareils`);
    dit(!/banc@exemple|JULIEN|1111/.test(await pl.innerText().catch(() => '')), `${nom} : aucune identité dans le rapport`);
    await pl.scrollIntoViewIfNeeded().catch(() => {});
    await pg.waitForTimeout(300);
    await pg.screenshot({ path: path.join(CAPT, `fiabilite-plantages-${nom}.png`) });
  }
  const petites = await cibles(pg, '[data-fiabilite] button, [data-fiabilite] a, [data-fia-plantages] button');
  dit(!petites.length, `${nom} : cibles de 44 px`, petites.join(' | '));
  dit(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${nom} : pas de débordement horizontal`);
  dit(!errs.length, `${nom} : aucune erreur d’app`, errs.join(' | ').slice(0, 300));
  await ctx.close();
}

(async () => {
  let b;
  try {
    C = await import(pathToFileURL(path.join(R, 'src', 'controleNuit.js')).href);
    RP = await import(pathToFileURL(path.join(R, 'api', '_lib', 'rapport-plantages.js')).href);
    b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const liste = [['ecart', 390, false], ['ecart', 1512, false], ['ecart', 390, true], ['ecart', 1512, true], ['ok', 390, false], ['ok', 1512, true], ['proprio', 390, false], ['proprio', 1512, true]]
      .filter(([s, l]) => (!process.env.BANC_SCEN || s === process.env.BANC_SCEN) && (!process.env.BANC_TAILLE || String(l) === process.env.BANC_TAILLE));
    for (const [scen, l, s] of liste) {
      try { await scenario(b, scen, l, s); } catch (e) { dit(false, `${scen}-${l}-${s ? 'sombre' : 'clair'} s’exécute`, String(e.message || e).slice(0, 300)); }
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 300)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\n❌ fiabilite-auto : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ fiabilite-auto : ${ok} verts`);
    process.exit(ko ? 1 : 0);
  }
})();
