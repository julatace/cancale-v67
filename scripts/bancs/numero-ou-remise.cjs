// ════════════════════════════════════════════════════════════════════════════
//  BANC « OÙ EST TON NUMÉRO ? » ET « REMISE EN LIGNE » (9 nov., extension 5.334).
//  A. Réglages → Numéros, « je l'écris » allumé : « Où est ton numéro ? » montre
//     trois cases (44 px) ; décocher « titre » puis « référence » part au NUAGE
//     (`vrm_numero_ecrit.ou`) ; la dernière case ne se décoche pas ; l'essai
//     « Colle une description » lit « N° 125 » et ne lit rien dans « pointure 42 ».
//  B. Annonces, seulement « fin de la description » coché : le dressing porte la
//     lecture rangée par l'extension 5.334 (`numEcrit`, jamais le texte). 9301
//     (titre « N°12 », description « N° 40 ») reçoit 40 — le titre n'est plus lu ;
//     9302 (description lue sans N°) ne reçoit RIEN.
//  C. VRM numérote (éteint) : 9100 (N°7) a été SUPPRIMÉE par lui (preuve de
//     l'extension), 9303 — même marque, même modèle, même taille — vient d'être
//     mise en ligne : « Une annonce remise en ligne ? … N°7 » ; « Oui, N°7 » ⇒ 9303
//     porte 7 (sur SON clic, la fiche de 9100 revient avec), rien à barrer ;
//     « Non » sur une autre ⇒ plus proposé, synchronisé (`vrm_remise_refus`).
//     (10 nov.) La proposition est une carte visuelle : deux photos, « Même paire ? », [Oui] [Non].
//  390 px tactile et 1512 px, clair et sombre. Aucune fixture : tout est inventé.
//  BANC_PORT (7972 par défaut), BANC_DIST (dist par défaut), BANC_CAPTURES.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { routeMain, ecritesMain, attendre } = require('./_base-ecritures.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7972;
const CAPTURES = process.env.BANC_CAPTURES || path.join(require('os').tmpdir(), 'banc-numero-ou-remise');
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}
const auj = new Date();
const ilYa = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const ann = (id, title, heures, extra = {}) => ({ id, title, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', size: '42', status: 'Très bon état', view_count: 3, favourite_count: 0, created_at_ts: Math.floor((Date.now() - heures * 3600e3) / 1000), ...extra });
const ITEMS_B = [
  ann(9301, 'Nike Air Max 90 blanc taille 42 N°12', 3, { descLen: 40, numEcrit: { etat: 'lu', cle: '40', brut: 'N° 40' } }),
  ann(9302, 'Nike Air Max 90 blanc taille 42', 2, { descLen: 30, numEcrit: { etat: 'rien', raison: 'aucun N° écrit' } }),
];
const ITEMS_C = [
  ann(9303, 'Nike Dunk Low Panda taille 42', 2),
  ann(9304, 'Nike Dunk Low Panda taille 42', 1),
  ann(9202, 'Salomon XT-6 noir taille 41', 40, { brand_title: 'Salomon', size_title: '41', size: '41' }),
];
const MAIN = (extra = {}) => ({
  vinted_annonce_numeros: {
    '9202': { numero: '5', auto: false, manuelAt: ilYa(30), numberedAt: ilYa(40) },
    // L'ancienne annonce, SUPPRIMÉE par lui il y a 20 h (son carton dit N°7).
    '9100': { numero: '7', title: 'Nike Dunk Low Panda taille 42', size: '42', accountId: '111', buyPrice: 35, auto: true, numberedAt: ilYa(400) },
  },
  vinted_used_numeros: [1, 2, 3, 4, 5, 6, 7], ...extra,
});
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log(`  ❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=… ou relance le banc seul`); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop().replace(/"/g, '');
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/"/g, '')];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function ouvrir(b, { main, url, largeur, sombre, items, supprimees }) {
  const base = { main, maj: new Date(Date.now() - 86400e3).toISOString(), ecritures: [] };
  const rows = [
    { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: items || [] } } },
    { id: 'vinted_item_details', data: {} },
    ...(supprimees ? [{ id: 'harvest_111_supprimees', data: { ids: supprimees } }] : []),
  ];
  const mobile = largeur < 700;
  const ctx = await b.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof d === 'string' ? d : JSON.stringify(d) });
    if (/select=owner&limit=1/.test(u)) return j([{ owner: 'banc' }]);
    const mm = routeMain(req, base); if (mm) return j(mm.body, mm.status);
    if (req.method() !== 'GET') return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(5500);
  return { pg, ctx, errs, base };
}
const local = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
const toucher = async (pg, sel, mobile) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {}); if (mobile) await l.tap({ timeout: 8000 }); else await l.click({ timeout: 8000 }); };
const pasDeCote = (pg) => pg.evaluate(() => (document.scrollingElement || document.documentElement).scrollWidth <= window.innerWidth + 1);
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
const fiches = async (pg) => (await local(pg, 'vinted_annonce_numeros')) || {};
const ouCoche = (base) => JSON.stringify(((base.main || {}).vrm_numero_ecrit || {}).ou || null);

async function reglages(b, largeur, sombre) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'}`, nom = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\n── A. Réglages → « Où est ton numéro ? » (${tag})`);
  const { pg, ctx, errs, base } = await ouvrir(b, { main: MAIN({ vrm_numero_ecrit: { actif: true, depuis: ilYa(1) } }), url: '/?tab=settings', largeur, sombre, items: [] });
  try {
    await pg.waitForSelector('[data-sous-ouvrir="numeros"]', { timeout: 20000 });
    await toucher(pg, '[data-sous-ouvrir="numeros"]', mobile);
    const vu = await pg.waitForSelector('[data-numero-ou]', { timeout: 8000 }).then(() => true).catch(() => false);
    dit(vu, `${tag} : « Où est ton numéro ? » est là quand « je l'écris » est allumé`);
    if (!vu) { await capture(pg, `A-${nom}-absent`); return; }
    dit(await pg.getAttribute('[data-numero-ou]', 'data-numero-ou') === 'description,titre,ref', `${tag} : par défaut, les trois endroits sont cochés`);
    const hs = await pg.evaluate(() => [...document.querySelectorAll('[data-numero-ou-case]')].map((e) => Math.round(e.getBoundingClientRect().height)));
    dit(hs.length === 3 && hs.every((h) => h >= 44), `${tag} : trois cases de 44 px au moins`, JSON.stringify(hs));
    await pg.locator('[data-numero-ou]').scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, `A-${nom}-ou`);
    await toucher(pg, '[data-numero-ou-case="titre"] input', mobile);
    await attendre(() => ouCoche(base) === '["description","ref"]', 8000);
    dit(ouCoche(base) === '["description","ref"]', `${tag} : décocher « titre » part au nuage`, ouCoche(base));
    await toucher(pg, '[data-numero-ou-case="ref"] input', mobile);
    await attendre(() => ouCoche(base) === '["description"]', 8000);
    dit(ouCoche(base) === '["description"]', `${tag} : décocher « référence »`, ouCoche(base));
    await toucher(pg, '[data-numero-ou-case="description"] input', mobile);
    await pg.waitForTimeout(900);
    dit(await pg.getAttribute('[data-numero-ou]', 'data-numero-ou') === 'description' && await pg.locator('[data-numero-ou-case="description"] input').isChecked(), `${tag} : la dernière case ne se décoche pas (VRM saurait pas où lire)`);
    await pg.locator('#vrm-numero-essai').fill('Très bon état, pointure 42, 45 €.\nN° 125');
    dit(await pg.getAttribute('[data-numero-essai]', 'data-numero-essai') === 'lu' && await pg.getAttribute('[data-numero-essai-cle]', 'data-numero-essai-cle') === '125', `${tag} : l'essai lit N°125 (ni la pointure, ni le prix)`);
    await pg.locator('[data-numero-essai]').scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, `A-${nom}-essai`);
    await pg.locator('#vrm-numero-essai').fill('Pointure 42, achetées en 2024');
    dit(await pg.getAttribute('[data-numero-essai]', 'data-numero-essai') === 'rien', `${tag} : « pointure 42, 2024 » ⇒ aucun numéro lu`);
    await pg.locator('#vrm-numero-essai').fill('N° 12\nN° 40');
    dit(await pg.getAttribute('[data-numero-essai]', 'data-numero-essai') === 'ambigu', `${tag} : deux numéros ⇒ « VRM ne choisit pas »`);
    dit(await pasDeCote(pg), `${tag} : aucune page qui défile de côté`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario A a tourné jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 300)); await capture(pg, `A-${nom}-erreur`); }
  finally { await ctx.close(); }
}

async function annonces(b, largeur, sombre) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'}`;
  console.log(`\n── B. Seulement « fin de la description » : la lecture de l'extension (${tag})`);
  const { pg, ctx, errs } = await ouvrir(b, { main: MAIN({ vrm_numero_ecrit: { actif: true, depuis: ilYa(1), ou: ['description'] } }), url: '/?tab=cat_annonces', largeur, sombre, items: ITEMS_B });
  try {
    await attendre(async () => String(((await fiches(pg))['9301'] || {}).numero || '') === '40', 15000);
    const f = await fiches(pg);
    dit(String((f['9301'] || {}).numero) === '40' && (f['9301'] || {}).ecrit === 'description', `${tag} : titre « N°12 », fin de description « N° 40 » (lue par l'extension) ⇒ 40 — le titre n'est plus lu`, JSON.stringify(f['9301'] || null));
    dit(!String((f['9302'] || {}).numero || '').trim(), `${tag} : description lue sans N° ⇒ AUCUN numéro donné`, JSON.stringify(f['9302'] || null));
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
    void mobile;
  } catch (e) { dit(false, `${tag} : le scénario B a tourné jusqu'au bout`, String(e && e.message).slice(0, 300)); }
  finally { await ctx.close(); }
}

async function remise(b, largeur, sombre) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'}`, nom = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\n── C. Remise en ligne (${tag})`);
  const { pg, ctx, errs, base } = await ouvrir(b, { main: MAIN(), url: '/?tab=cat_annonces', largeur, sombre, items: ITEMS_C, supprimees: { 9100: ilYa(20) } });
  try {
    const bloc = await pg.waitForSelector('[data-remise-bloc]', { timeout: 15000 }).then(() => true).catch(() => false);
    dit(bloc, `${tag} : « Une annonce remise en ligne ? » apparaît`);
    if (!bloc) { await capture(pg, `C-${nom}-absent`); return; }
    // (10 nov.) La proposition est une carte visuelle (deux photos, « Même paire ? », [Oui] [Non]) ; la règle derrière ⓘ.
    const lignes = await pg.evaluate(() => [...document.querySelectorAll('[data-remise-ligne]')].map((e) => [e.getAttribute('data-remise-ligne'), e.getAttribute('data-remise-force')]));
    dit(lignes.length === 2 && lignes.every(([id, f]) => ['9303', '9304'].includes(id) && f === 'simple') && !lignes.some(([id]) => id === '9202'), `${tag} : 9303 et 9304 (même marque, modèle, taille) proposées en « simple » ; la Salomon non`, JSON.stringify(lignes));
    dit(/N°7/.test(await pg.locator('[data-remise-ligne="9303"]').innerText()) && /vérifie l’étiquette/.test(await pg.locator('[data-remise-ligne="9303"]').evaluate((e) => e.textContent)), `${tag} : « Même paire que N°7 ? » et (derrière ⓘ) « vérifie l'étiquette »`);
    let f = await fiches(pg);
    const avant = String((f['9303'] || {}).numero || '');
    dit(avant !== '7', `${tag} : rien n'est relié tout seul (9303 ne porte pas 7 avant son clic)`, avant);
    await pg.locator('[data-remise-bloc]').scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, `C-${nom}-proposition`);
    const hs = await pg.evaluate(() => [...document.querySelectorAll('[data-remise-oui],[data-remise-non]')].map((e) => Math.round(e.getBoundingClientRect().height)));
    dit(hs.length >= 4 && hs.every((h) => h >= 44), `${tag} : boutons de 44 px au moins`, JSON.stringify(hs));
    await toucher(pg, '[data-remise-ligne="9303"] [data-remise-oui="7"]', mobile);
    await attendre(async () => String(((await fiches(pg))['9303'] || {}).numero) === '7', 8000);
    f = await fiches(pg);
    const x = f['9303'] || {};
    dit(String(x.numero) === '7' && !!x.manuelAt && x.repriseDe === '9100' && Number(x.buyPrice) === 35 && !f['9100'], `${tag} : « Oui, N°7 » ⇒ 9303 porte 7, la fiche de l'ancienne revient (prix d'achat 35)`, JSON.stringify(x));
    dit(!x.reattribue, `${tag} : le carton dit déjà N°7 : rien à barrer`, JSON.stringify(x.reattribue || null));
    await pg.waitForTimeout(800);
    dit(await pg.locator('[data-remise-ligne="9304"]').count() === 0, `${tag} : N°7 porté par une paire présente ⇒ plus proposé à 9304`);
    const pool = ((await local(pg, 'vinted_used_numeros')) || []).map(String);
    dit(pool.includes('7') && pool.includes(avant || '7'), `${tag} : le pool ne rend rien (append-only)`, pool.join(','));
    await attendre(() => !!(base.main && base.main.vinted_annonce_numeros && base.main.vinted_annonce_numeros['9303'] && String(base.main.vinted_annonce_numeros['9303'].numero) === '7'), 10000);
    dit(ecritesMain(base).length > 0 && String(((base.main.vinted_annonce_numeros || {})['9303'] || {}).numero) === '7', `${tag} : la reprise part au nuage`);
    await capture(pg, `C-${nom}-repris`);
    dit(await pasDeCote(pg), `${tag} : aucune page qui défile de côté`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario C a tourné jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 300)); await capture(pg, `C-${nom}-erreur`); }
  finally { await ctx.close(); }
}

async function refus(b) {
  console.log('\n── C bis. « Non, une autre paire » (390 clair)');
  const { pg, ctx, errs, base } = await ouvrir(b, { main: MAIN(), url: '/?tab=cat_annonces', largeur: 390, sombre: false, items: ITEMS_C.slice(0, 1).concat(ITEMS_C.slice(2)), supprimees: { 9100: ilYa(20) } });
  try {
    const bloc = await pg.waitForSelector('[data-remise-non="9303"]', { timeout: 15000 }).then(() => true).catch(() => false);
    dit(bloc, '« Non, une autre paire » est proposé');
    if (bloc) {
      await toucher(pg, '[data-remise-non="9303"]', true);
      await attendre(() => !!(base.main && base.main.vrm_remise_refus && base.main.vrm_remise_refus['9303']), 8000);
      dit(JSON.stringify(((base.main || {}).vrm_remise_refus || {})['9303'] || null) === '["9100"]', '« Non » ⇒ écarté, synchronisé (vrm_remise_refus)', JSON.stringify((base.main || {}).vrm_remise_refus || null));
      dit(await pg.locator('[data-remise-bloc]').count() === 0, 'plus proposé');
      const f = await fiches(pg);
      dit(String((f['9303'] || {}).numero || '') !== '7' && !!f['9100'], 'rien n’a changé de numéro', JSON.stringify(f['9303'] || null));
    }
    dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, 'le scénario C bis a tourné jusqu’au bout', String(e && e.message).slice(0, 300)); }
  finally { await ctx.close(); }
}

(async () => {
  let b;
  await new Promise((res) => srv.listen(PORT, res));
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [largeur, sombre] of [[390, false], [1512, true], [390, true], [1512, false]]) {
      await reglages(b, largeur, sombre);
      await remise(b, largeur, sombre);
    }
    await annonces(b, 390, false);
    await annonces(b, 1512, true);
    await refus(b);
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\nCaptures : ${CAPTURES}`);
  console.log(ko ? `\n❌ N° où + remise : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ N° où + remise : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
