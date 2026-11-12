// ════════════════════════════════════════════════════════════════════════════
//  « TOUT VA BIEN ? » ET LA LIGNE AMBRE (8 nov., garde-fous de la capture)
//  La VRAIE app (`dist`), une fausse base qui applique la projection `select=`.
//  Données inventées (dépôt public).
//   1. Panne : le compte « second_compte » pas relu depuis 20 h, alors qu'Orion ·
//      iPhone l'a VU il y a 10 min et que son dernier envoi Vinted a été REFUSÉ
//      (réseau, ventes, 1 Mo) ⇒ la ligne ambre en haut de Ma journée (cause,
//      appareil, geste), « Voir » ouvre Paramètres → Tout va bien ?, la rangée
//      du compte est « Bloqué » avec la cause et le geste ; le compte relu il y
//      a 1 h est « À jour » ; une extension 5.322 qui a écrit en dernier sans
//      appareil ⇒ « Installer la 5.327 » et les trois gestes, les deux paquets.
//   2. Tout relu, appareils à jour ⇒ « Tout est à jour », aucune ligne ambre.
//   3. La liste des appareils illisible (503) ⇒ « Je n’ai pas pu tout vérifier »,
//      jamais « Tout est à jour ».
//  À 390 et 1512 px, clair et sombre : captures dans BANC_CAPTURES (défaut :
//  scripts/bancs/captures/), à REGARDER (§6.2).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http');
const { metaVersData } = require('./_meta.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4391;
const CAPT = process.env.BANC_CAPTURES || path.join(__dirname, 'captures');
fs.mkdirSync(CAPT, { recursive: true });
const ATTENDUE = (/const EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1];

const H = 3600e3, M = 60e3;
const iso = (ilYa) => new Date(Date.now() - ilYa).toISOString();
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'shop_test', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 2, vinted_user_id: '222', login: 'second_compte', domain: 'www.vinted.fr', updated_at: iso(0) },
];
const appareil = (id, ap, ilYa, flux, vus, code = ATTENDUE) => ({ id: 'ext_appareil_' + id, data: { v: 1, appareil: ap, ver: code, code, at: iso(ilYa), atMs: Date.now() - ilYa, flux, vus } });
function base(scen) {
  const panne = scen === 'panne';
  const rows = [
    { id: 'harvest_111_profile', data: { capturedAt: iso(1 * H) } },
    { id: 'harvest_111_listings', data: { capturedAt: iso(1 * H) } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: iso(1 * H) } },
    { id: 'harvest_222_profile', data: { capturedAt: iso(panne ? 20 * H : 2 * H) } },
    { id: 'harvest_222_orders_sold', data: { capturedAt: iso(panne ? 20 * H : 2 * H) } },
    { id: 'panel_comptes_etat', data: { comptes: {} } },
    { id: 'lbc_accounts', data: { accounts: { 'lbc-account:abc123': { id: 'lbc-account:abc123', name: 'Boutique LBC', type: 'particulier', sessionAt: Date.now() - 3 * H } } } },
    { id: 'lbc_listings', data: { lectures: { abc123: { at: Date.now() - 3 * H } } } },
    appareil('a1b2c3d4e5f60718', { paquet: 'orion', nav: 'orion', systeme: 'iphone' }, 5 * M,
      panne ? { vinted: { okAt: Date.now() - 3 * H, koAt: Date.now() - 4 * M, koStatut: 'reseau', refus: [{ at: Date.now() - 4 * M, statut: 'reseau', famille: 'harvest_orders_sold', octets: 1100000 }] } }
        : { vinted: { okAt: Date.now() - 6 * M, koAt: null, koStatut: null, refus: [] } },
      panne ? { vinted: { 222: Date.now() - 10 * M } } : { vinted: { 111: Date.now() - 6 * M } }),
    appareil('0f1e2d3c4b5a6978', { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, 20 * M, { vinted: { okAt: Date.now() - 1 * H, koAt: null, refus: [] } }, {}),
  ];
  if (panne) rows.push({ id: 'panel_diag_capture', data: { ver: '5.322.0', verCode: '5.322.0', majAt: iso(1 * M), n: {}, rates: {} } });
  else rows.push({ id: 'panel_diag_capture', data: { ver: ATTENDUE, verCode: ATTENDUE, majAt: iso(6 * M), n: {}, rates: {} } });
  return rows;
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
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

async function scenario(b, scen, largeur, sombre) {
  const rows = base(scen === 'passu' ? 'ok' : scen);
  const ctx = await b.newContext({ viewport: { width: largeur, height: 900 }, hasTouch: largeur < 600, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u) && !/vinted_accounts/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (scen === 'passu' && /ext_appareil_/.test(u)) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const nom = `${scen}-${largeur}-${sombre ? 'sombre' : 'clair'}`;
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  const alerte = pg.locator('[data-alerte-capture]');
  if (scen === 'panne') {
    await alerte.waitFor({ timeout: 20000 }).catch(() => {});
    const t = (await alerte.count()) ? await alerte.innerText() : '';
    dit(/second_compte/.test(t) && /réseau coupé/.test(t) && /Orion · iPhone/.test(t), `${nom} : la ligne ambre nomme le compte, la cause lue et l’appareil`, t.slice(0, 200));
    dit(!/shop_test/.test(t), `${nom} : le compte relu il y a 1 h n’est pas en alerte`);
    await pg.waitForTimeout(1500);
    await pg.screenshot({ path: path.join(CAPT, `tout-va-bien-alerte-${nom}.png`) });
    if (await alerte.count()) await alerte.locator('[data-alerte-voir]').click();
  } else {
    await pg.waitForTimeout(2500);
    dit(!(await alerte.count()), `${nom} : aucune ligne ambre`);
    await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  }
  // « Voir » ouvre le sous-écran lui-même ; sinon on touche la ligne de Paramètres.
  await pg.locator('[data-tout-va-bien]:visible, [data-sous-ouvrir="toutvabien"]:visible').first().waitFor({ timeout: 20000 });
  if (scen === 'panne') dit(await pg.locator('[data-tout-va-bien]').first().isVisible().catch(() => false), `${nom} : « Voir » mène à Tout va bien ?`);
  if (!(await pg.locator('[data-tout-va-bien]').first().isVisible().catch(() => false))) await pg.locator('[data-sous-ouvrir="toutvabien"]').first().click();
  const page = pg.locator('[data-tout-va-bien]').first();
  await pg.waitForFunction(() => { const e = document.querySelector('[data-tout-va-bien]'); return e && e.getAttribute('data-tout-va-bien') !== 'lecture'; }, null, { timeout: 20000 }).catch(() => {});
  await page.scrollIntoViewIfNeeded().catch(() => {});
  const resume = await page.locator('[data-tvb-resume]').innerText().catch(() => '');
  if (scen === 'panne') {
    const r222 = page.locator('[data-tvb-compte="vinted:222"]');
    dit(await r222.getAttribute('data-tvb-etat') === 'panne', `${nom} : second_compte est en panne sur la page`);
    const t222 = await r222.innerText().catch(() => '');
    dit(/réseau coupé/.test(t222) && /1,0 Mo/.test(t222) && /tes ventes/.test(t222), `${nom} : cause lue (code, famille, taille)`, t222);
    dit((await r222.locator('[data-tvb-geste]').count()) === 1, `${nom} : UN geste sur la rangée`);
    dit(await page.locator('[data-tvb-compte="vinted:111"]').getAttribute('data-tvb-etat') === 'ok', `${nom} : shop_test « À jour »`);
    dit(/choses? à voir/.test(resume) && !/Tout est à jour/.test(resume), `${nom} : le résumé dit ce qu’il y a à voir`, resume);
    dit(/Orion · iPhone/.test(await page.innerText()) && /Chrome · Mac/.test(await page.innerText()), `${nom} : chaque appareil nommé`);
    const inconnu = page.locator('[data-tvb-appareil="inconnu"]');
    dit((await inconnu.count()) === 1, `${nom} : l’extension 5.322 sans appareil est dite`);
    if (await inconnu.count()) {
      await inconnu.locator('button').click();
      dit((await inconnu.locator('a[href="/VRM-extension.zip"]').count()) === 1 && (await inconnu.locator('a[href="/VRM-Orion.xpi"]').count()) === 1 && (await inconnu.locator('li').count()) === 6, `${nom} : les deux paquets et leurs gestes`);
    }
  } else if (scen === 'ok') {
    dit(resume === 'Tout est à jour', `${nom} : « Tout est à jour »`, resume);
  } else {
    dit(/pas pu tout vérifier/.test(resume) && !/Tout est à jour/.test(resume), `${nom} : pas su ⇒ jamais « Tout est à jour »`, resume);
  }
  const petites = await page.evaluate(() => [...document.querySelectorAll('[data-tout-va-bien] button, [data-tout-va-bien] a, [data-alerte-capture] button')].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect()).map((r, i) => r).filter((r) => r.height < 43.5).length);
  const quoi = await page.evaluate(() => [...document.querySelectorAll('[data-tout-va-bien] button, [data-tout-va-bien] a, [data-alerte-capture] button')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().height < 43.5).map((e) => (e.className + ':' + e.textContent).slice(0, 60)).join(' | '));
  dit(petites === 0, `${nom} : cibles de 44 px`, `${petites} trop petites : ${quoi}`);
  dit(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${nom} : pas de débordement horizontal`);
  await pg.evaluate(() => { const e = document.querySelector('[data-tout-va-bien]'); if (e) e.scrollIntoView({ block: 'start' }); });
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: path.join(CAPT, `tout-va-bien-${nom}.png`) }).catch(() => {});
  dit(!errs.length, `${nom} : aucune erreur d’app`, errs.join(' | ').slice(0, 200));
  await ctx.close();
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [scen, l, s] of [['panne', 390, false], ['panne', 1512, false], ['panne', 390, true], ['panne', 1512, true], ['ok', 390, false], ['ok', 1512, true], ['passu', 390, false]]) {
      try { await scenario(b, scen, l, s); } catch (e) { dit(false, `${scen}-${l} s’exécute`, String(e.message || e).slice(0, 200)); }
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\n❌ tout-va-bien : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ tout-va-bien : ${ok} verts`);
    process.exit(ko ? 1 : 0);
  }
})();
