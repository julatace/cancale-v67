// ════════════════════════════════════════════════════════════════════════════
//  BANC « MASQUÉES, CARTON À VÉRIFIER, REPUBLIÉE DANS L'APP VINTED » (15 nov.)
//  Données INVENTÉES (dépôt public), formes mesurées (dressing `harvest_{uid}_listings`
//  avec `total_entries`, `panel_num_reserves.items[id]`, `photo_emprunte_{uid}`).
//  M. Une annonce MASQUÉE par Vinted (`is_hidden`) liée par l'extension au N°5 réservé
//     ⇒ sa fiche porte N°5, sans « nouveau » ; Annonces → Masquées la montre avec N°5.
//  V. Une fiche N°7 dont la réservation liée dit N°3 ⇒ Annonces : « N° à vérifier » —
//     « La fiche dit N°7 · l'extension avait réservé N°3 », « C'est bien le N°7 » et
//     « Le carton dit N°3 » ; SON toucher « Le carton dit N°3 » ⇒ la fiche passe à N°3.
//  R. Republiée dans l'app Vinted : N°6 (annonce 9401) a disparu, la nouvelle 9410 a la
//     même photo (empreintes) ⇒ AUCUN N° neuf ; Ma journée en tête : « N°6 republiée ? » ;
//     la feuille AVANT / MAINTENANT ; « Oui, garder N°6 » ⇒ 9410 porte N°6.
//  P. La photo FABRIQUÉE par VRM (registre) ⇒ « N°6 reconnu par sa photo », N°6 repris tout seul.
//  390 tactile et 1512, clair et sombre (COMBOS). BANC_PORT (10490), BANC_DIST, BANC_CAPTURES, SCENARIOS=M,V,R,P.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { routeMain, attendre } = require('./_base-ecritures.cjs');
const { empreinte, voisine } = require('../_numerotation-vm.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10490;
const CAPTURES = process.env.BANC_CAPTURES || path.join(require('os').tmpdir(), 'banc-numeros-masquees');
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}
const auj = new Date();
const ilYa = (h) => new Date(Date.now() - h * 3600e3).toISOString();
// Une photo dessinée (SVG) : une basket de couleur, au même cadrage partout (aucune photo réelle).
const svg = (fond, tige, semelle) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="${fond}"/><ellipse cx="150" cy="300" rx="120" ry="14" fill="rgba(0,0,0,.18)"/><path d="M40 270 Q60 180 150 170 Q200 120 250 150 Q275 200 262 270 Z" fill="${tige}"/><rect x="34" y="262" width="236" height="26" rx="12" fill="${semelle}"/><path d="M90 230 Q150 250 220 200" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round"/></svg>`);
const PH_A = svg('#e9eef6', '#1d3a6b', '#f4f1ea'), PH_B = svg('#eef3ea', '#7a2b2b', '#f4f1ea'), PH_C = svg('#f4efe6', '#2b2b2b', '#ddd');
const ann = (id, title, heures, o = {}) => ({ id, title, price: { amount: '59.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: { url: o.ph || null }, brand_title: 'Adidas', size_title: '42', status: 'Très bon état', view_count: 3, favourite_count: 0, created_at_ts: Math.floor((Date.now() - heures * 3600e3) / 1000), ...o.x });
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${d && !c ? ' — ' + d : ''}`); };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log(`  ❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=…`); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^(data|meta)(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
const BASE_MAIN = (x = {}) => ({
  vinted_annonce_numeros: { '9301': { numero: '1', auto: false, manuelAt: ilYa(300), numberedAt: ilYa(400), buyPrice: '25,00', accountId: '111' }, ...(x.fiches || {}) },
  vinted_used_numeros: [1, 2, 3, 4, 5, 6, 7],
  vrm_numero_ecrit: { actif: false, depuis: ilYa(48), choisi: ilYa(48) },
  vrm_je_vends: { choix: 'sneakers', categories: ['sneakers'], at: ilYa(48) },
  ...(x.main || {}),
});

async function ouvrir(b, { url, largeur, sombre, main, items, lignes = [] }) {
  const base = { main, maj: new Date(Date.now() - 86400e3).toISOString(), ecritures: [] };
  const rows = [
    { id: 'harvest_111_listings', data: { capturedAt: new Date(Date.now() - 60e3).toISOString(), payload: { items, pagination: { total_entries: items.length, total_pages: 1, current_page: 1 } } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: auj.toISOString(), payload: { my_orders: [] } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: [] } } },
    ...lignes,
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
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*').replace(/_/g, '.') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(6000);
  return { pg, ctx, errs, base };
}
const local = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
const fiches = async (pg) => (await local(pg, 'vinted_annonce_numeros')) || {};
const toucher = async (pg, sel, mobile) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {}); if (mobile) await l.tap({ timeout: 8000 }); else await l.click({ timeout: 8000 }); };
const pasDeCote = (pg) => pg.evaluate(() => (document.scrollingElement || document.documentElement).scrollWidth <= window.innerWidth + 1);
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
const petits = (pg, sel) => pg.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43.5).map((e) => (e.innerText || e.getAttribute('aria-label') || '').slice(0, 24)), sel);
const deborde = (pg, sel) => pg.evaluate((sel) => { const r = document.querySelector(sel); if (!r) return ['absent']; const W = window.innerWidth; return [...r.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width && (b.right > W + 1 || b.left < -1); }).map((e) => e.tagName + '.' + (e.className || '').toString().slice(0, 20)).slice(0, 4); }, sel);
const job = (pg, id) => pg.evaluate((id) => { const e = document.querySelector(`[data-job="${id}"]`); return e ? { n: e.getAttribute('data-n'), txt: (e.innerText || '').replace(/\s+/g, ' ').trim(), rang: [...document.querySelectorAll('[data-job]')].indexOf(e) } : null; }, id);

const tagDe = (l, s) => `${l}${s ? ' sombre' : ' clair'}`, capDe = (l, s) => `${l}-${s ? 'sombre' : 'clair'}`;

async function scenarioM(b, largeur, sombre) {
  const mobile = largeur < 700, tag = tagDe(largeur, sombre), cap = capDe(largeur, sombre);
  console.log(`\n── M. Une masquée liée au N°5 réservé (${tag})`);
  const items = [ann(9301, 'Salomon XT-6 noire 41', 400, { ph: PH_C }), ann(9350, 'Adidas Spezial bleu marine 42', 30, { ph: PH_A, x: { is_hidden: true } })];
  const lignes = [{ id: 'panel_num_reserves', data: { attente: {}, items: { 9350: { numero: '5', at: ilYa(30) } } } }];
  const { pg, ctx, errs } = await ouvrir(b, { url: '/?tab=annonces', largeur, sombre, main: BASE_MAIN({ main: { vinted_used_numeros: [1, 2, 3, 4] } }), items, lignes });
  try {
    await attendre(async () => ((await fiches(pg))['9350'] || {}).numero === '5', 40000);
    const f = await fiches(pg);
    dit((f['9350'] || {}).numero === '5' && !(f['9350'] || {}).nouveau, `${tag} : la masquée porte N°5 (le N° réservé lié à son identifiant), pas « nouveau »`, String(JSON.stringify(f['9350'])).slice(0, 200));
    dit(!Object.values(f).some((x) => x && x.numero === '8'), `${tag} : aucun N° neuf brûlé`);
    dit(await pasDeCote(pg), `${tag} : aucune page qui défile de côté`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
    await capture(pg, `M-${cap}-annonces`);
  } catch (e) { dit(false, `${tag} : le scénario M a tourné jusqu'au bout`, String(e && e.message).slice(0, 300)); }
  finally { await ctx.close(); }
}

async function scenarioV(b, largeur, sombre) {
  const mobile = largeur < 700, tag = tagDe(largeur, sombre), cap = capDe(largeur, sombre);
  console.log(`\n── V. Fiche N°7, réservation N°3 : « N° à vérifier sur ton carton » (${tag})`);
  const items = [ann(9301, 'Salomon XT-6 noire 41', 400, { ph: PH_C }), ann(9360, 'Adidas Spezial bleu marine taille 42,5', 50, { ph: PH_A })];
  const lignes = [{ id: 'panel_num_reserves', data: { attente: {}, items: { 9360: { numero: '3', at: ilYa(50) } } } }];
  const main = BASE_MAIN({ fiches: { 9360: { numero: '7', auto: true, numberedAt: ilYa(49), accountId: '111', photo: PH_A } } });
  const { pg, ctx, errs } = await ouvrir(b, { url: '/?tab=annonces', largeur, sombre, main, items, lignes });
  try {
    // (16 nov., intégration vague B) Depuis refonte-journee (« la liste d'abord »), les N° à vérifier vivent dans « À faire »
    // (la feuille, au téléphone) : on l'ouvre quand la ligne y est rangée — le même chemin que lui.
    await pg.waitForSelector('[data-verif-reserve="3"]', { state: 'attached', timeout: 20000 }).catch(() => {});
    if (!(await pg.locator('[data-verif-reserve="3"]').first().isVisible().catch(() => false))) {
      await pg.locator('[data-ui-afaire]').first().click().catch(() => {});
      await pg.waitForSelector('[data-ui-afaire-feuille]', { timeout: 8000 }).catch(() => {});
    }
    const vu = await pg.waitForSelector('[data-verif-reserve="3"]', { timeout: 20000 }).then(() => true).catch(() => false);
    dit(vu, `${tag} : Annonces montre la ligne « N° à vérifier » de cette paire`);
    if (vu) {
      const t = await pg.locator('[data-verif-carton="9360"]').innerText();
      dit(/La fiche dit N°7/.test(t) && /réservé N°3/.test(t), `${tag} : « La fiche dit N°7 · réservé N°3 »`, t.replace(/\s+/g, ' ').slice(0, 160));
      dit(/C'est bien le N°7/.test(t) && /Le carton dit N°3/.test(t), `${tag} : ses deux choix, nommés par les N°`, t.replace(/\s+/g, ' ').slice(0, 200));
      const f0 = await fiches(pg);
      dit((f0['9360'] || {}).numero === '7', `${tag} : rien n'a changé tout seul (N°7)`);
      await pg.locator('[data-verif-carton="9360"]').scrollIntoViewIfNeeded().catch(() => {});
      await capture(pg, `V-${cap}-a-verifier`);
      const d = await deborde(pg, '[data-verif-carton="9360"]');
      dit(d.length === 0, `${tag} : rien ne déborde de la ligne`, d.join(' | '));
      await toucher(pg, '[data-verif-prendre-reserve="3"]', mobile);
      await attendre(async () => ((await fiches(pg))['9360'] || {}).numero === '3', 8000);
      const f = await fiches(pg);
      dit((f['9360'] || {}).numero === '3', `${tag} : SON « Le carton dit N°3 » ⇒ la fiche porte N°3`, JSON.stringify(f['9360']).slice(0, 200));
      await pg.waitForTimeout(900);
      dit(!(await pg.$('[data-verif-reserve="3"]')), `${tag} : la ligne sort (vérifié)`);
    }
    dit(await pasDeCote(pg), `${tag} : aucune page qui défile de côté`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario V a tourné jusqu'au bout`, String(e && e.message).slice(0, 300)); await capture(pg, `V-${cap}-erreur`); }
  finally { await ctx.close(); }
}

const H_ANC = empreinte(4242);
async function scenarioR(b, largeur, sombre) {
  const mobile = largeur < 700, tag = tagDe(largeur, sombre), cap = capDe(largeur, sombre);
  console.log(`\n── R. Republiée dans l'app Vinted : « N°6 republiée ? » (${tag})`);
  const items = [ann(9301, 'Salomon XT-6 noire 41', 400, { ph: PH_C }), ann(9410, 'Adidas Spezial bleu marine taille 42,5', 5, { ph: PH_A })];
  const main = BASE_MAIN({
    fiches: { 9401: { numero: '6', auto: true, numberedAt: ilYa(200), accountId: '111', title: 'Adidas Spezial bleu marine taille 42,5', photo: PH_B } },
    main: { vrm_vus_en_ligne: { 9401: ilYa(48), 9301: ilYa(2) }, vrm_empreintes_fiches: { 9401: { n: '6', h: [H_ANC], uid: '111', at: ilYa(48) } } },
  });
  const lignes = [{ id: 'photo_emprunte_111', data: { payload: { version: 1, annonces: { 9410: { 'p1': voisine(H_ANC, 6, 8, 3) } } } } }];
  const { pg, ctx, errs, base } = await ouvrir(b, { url: '/', largeur, sombre, main, items, lignes });
  try {
    await pg.waitForSelector('[data-job="numeros-republiee"]', { timeout: 25000 }).catch(() => {});
    const f0 = await fiches(pg);
    dit(!(f0['9410'] || {}).numero, `${tag} : AUCUN N° neuf pour la nouvelle annonce`, JSON.stringify(f0['9410']));
    const j = await job(pg, 'numeros-republiee');
    dit(!!j && /N°6 republiée \?/.test(j.txt), `${tag} : Ma journée : « N°6 republiée ? »`, JSON.stringify(j));
    dit(!!j && j.rang <= 1, `${tag} : la ligne est en tête d'« À faire »`, j && String(j.rang));
    dit(!(await job(pg, 'numeros-nouveaux')), `${tag} : pas de « nouveaux articles numérotés » (rien n'a été numéroté)`);
    dit(!(await job(pg, 'sans-numero')), `${tag} : pas de seconde ligne « 1 annonce sans numéro » (la même annonce, une fois)`);
    dit(!(await pg.$('[data-cycle-id="9401"]')), `${tag} : pas de seconde carte « N°6 supprimé de Vinted » (le même sujet, une fois)`);
    await pg.locator('[data-job="numeros-republiee"]').first().scrollIntoViewIfNeeded().catch(() => {});
    await pg.waitForTimeout(1200);
    await capture(pg, `R-${cap}-journee`);
    await toucher(pg, '[data-job="numeros-republiee"] button, button[data-job="numeros-republiee"]', mobile);
    const fe = await pg.waitForSelector('[data-rt-feuille="9410"]', { timeout: 8000 }).then(() => true).catch(() => false);
    dit(fe, `${tag} : la feuille « Republiée dans l'app Vinted ? » s'ouvre`);
    if (fe) {
      await pg.waitForTimeout(700);
      const cadres = await pg.evaluate(() => ['[data-rt-avant]', '[data-rt-maintenant]'].map((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.top)]; }));
      dit(cadres.every(Boolean) && cadres[0][0] === cadres[1][0] && cadres[0][1] === cadres[1][1] && cadres[0][2] === cadres[1][2], `${tag} : AVANT et MAINTENANT côte à côte, au même cadrage`, JSON.stringify(cadres));
      dit(!!(await pg.$('[data-rt-avant] .vrm-num, [data-rt-avant] [data-numero], [data-rt-avant] [class*="num"]')), `${tag} : la plaque N°6 est gravée sur la photo d'avant`);
      const oui = await pg.locator('[data-rt-oui="6"]').innerText().catch(() => '');
      dit(/Oui, garder N°6/.test(oui), `${tag} : « Oui, garder N°6 » (le geste plein)`, oui);
      const p = await petits(pg, '[data-rt-feuille] button');
      dit(!mobile || p.length === 0, `${tag} : boutons de la feuille à 44 px`, p.join(' | '));
      const d = await deborde(pg, '[data-rt-feuille]');
      dit(d.length === 0, `${tag} : rien ne déborde de la feuille`, d.join(' | '));
      await capture(pg, `R-${cap}-feuille`);
      await toucher(pg, '[data-rt-oui="6"]', mobile);
      await attendre(async () => ((await fiches(pg))['9410'] || {}).numero === '6', 15000);
      const f = await fiches(pg);
      dit((f['9410'] || {}).numero === '6' && (f['9410'] || {}).recreeDe === '9401' && !(f['9410'] || {}).nouveau, `${tag} : SON « Oui » ⇒ la nouvelle annonce porte N°6 (le carton ne change pas)`, JSON.stringify(f['9410']).slice(0, 200));
      const pilule = await pg.waitForSelector('[data-acc-apres="numero.republie"]', { timeout: 5000 }).then(() => true).catch(() => false);
      dit(pilule, `${tag} : la pilule dit « N°6 gardé · le carton ne change pas »`);
      await capture(pg, `R-${cap}-apres`);
      await attendre(() => !!(((base.main || {}).vrm_repub_main || {})['9401'] || {}).nouvelId, 10000);
      dit((((base.main || {}).vrm_repub_main || {})['9401'] || {}).nouvelId === '9410', `${tag} : le lien part au nuage (tous ses appareils)`);
    }
    dit(await pasDeCote(pg), `${tag} : aucune page qui défile de côté`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario R a tourné jusqu'au bout`, String(e && e.message).slice(0, 300)); await capture(pg, `R-${cap}-erreur`); }
  finally { await ctx.close(); }
}

async function scenarioP(b, largeur, sombre) {
  const tag = tagDe(largeur, sombre), cap = capDe(largeur, sombre);
  console.log(`\n── P. La photo fabriquée par VRM : « N°6 reconnu par sa photo » (${tag})`);
  const hVrm = empreinte(777);
  const items = [ann(9301, 'Salomon XT-6 noire 41', 400, { ph: PH_C }), ann(9420, 'Adidas Spezial bleu marine taille 42,5', 5, { ph: PH_A })];
  const main = BASE_MAIN({
    fiches: { 9401: { numero: '6', auto: true, numberedAt: ilYa(200), accountId: '111', title: 'Adidas Spezial bleu marine taille 42,5', photo: PH_B } },
    main: { vrm_photos_vrm: { [hVrm]: { n: '6', src: '9401', uid: '111', at: ilYa(30) } }, vrm_vus_en_ligne: { 9401: ilYa(48) } },
  });
  const lignes = [{ id: 'photo_emprunte_111', data: { payload: { version: 1, annonces: { 9420: { 'p1': voisine(hVrm, 3, 4, 9) } } } } }];
  const { pg, ctx, errs } = await ouvrir(b, { url: '/', largeur, sombre, main, items, lignes });
  try {
    await attendre(async () => ((await fiches(pg))['9420'] || {}).numero === '6', 20000);
    const f = await fiches(pg);
    dit((f['9420'] || {}).numero === '6' && (f['9420'] || {}).recreeOrigine === 'photo-vrm' && !(f['9420'] || {}).nouveau, `${tag} : N°6 repris tout seul (la photo que VRM a fabriquée pour N°6)`, JSON.stringify(f['9420']).slice(0, 200));
    const dite = await pg.waitForFunction(() => /N°6 reconnu par sa photo/.test(document.body.innerText), null, { timeout: 6000 }).then(() => true).catch(() => false);
    dit(dite, `${tag} : c'est DIT : « N°6 reconnu par sa photo · republiée dans l'app Vinted, le carton ne change pas »`);
    await capture(pg, `P-${cap}-reconnu`);
    dit(!(await job(pg, 'numeros-republiee')), `${tag} : rien à demander (identité)`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario P a tourné jusqu'au bout`, String(e && e.message).slice(0, 300)); }
  finally { await ctx.close(); }
}

(async () => {
  let b;
  await new Promise((res) => srv.listen(PORT, res));
  const seuls = (process.env.SCENARIOS || 'M,V,R,P').split(',');
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const combos = (process.env.COMBOS || '390:clair,390:sombre,1512:clair').split(',').map((c) => c.split(':')).map(([l, t]) => [Number(l), t === 'sombre']);
    for (const [largeur, sombre] of combos) {
      if (seuls.includes('M')) await scenarioM(b, largeur, sombre);
      if (seuls.includes('V')) await scenarioV(b, largeur, sombre);
      if (seuls.includes('R')) await scenarioR(b, largeur, sombre);
      if (seuls.includes('P')) await scenarioP(b, largeur, sombre);
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\nCaptures : ${CAPTURES}`);
  console.log(ko ? `\n❌ Masquées / republiée : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ Masquées / republiée : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
