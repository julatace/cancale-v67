// ════════════════════════════════════════════════════════════════════════════
// BANC : RELIER UN ACHAT — LES FILTRES (prix payé, date de réception, marque,
//        taille) RENDUS À L'ÉCRAN (5 nov., relecture de v31-plateformes-logo)
//        node scripts/bancs/relier-achat-filtres.cjs   (après la construction ;
//        BANC_PORT, 7978 par défaut ; SHOTS=dossier pour garder les captures)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « relier un achat à une annonce ou une vente en sélectionnant par
// prix, par date de reçu… ». La feuille s'ouvre depuis VENTES (une vente sans
// prix d'achat). La date de réception d'un achat Vinted est LUE dans sa
// transaction (`harvest_{uid}_txn_{tx}` : `shipment.status` 400 et
// `status_updated_at`, la règle `dateReception`) — elle doit l'être AUSSI ici,
// pas seulement sur l'écran Achats : sinon le filtre « Reçu du / au » écarte
// tout (« 4 achats sans date de réception lue ») alors que les dates existent.
// Exigé, 390 tactile et 1512, clair et sombre :
//   1. « Filtres » s'ouvre : prix de/à, reçu du/au, marque, taille ;
//   2. reçu du J-25 au J-10 ⇒ SEUL l'achat reçu à J-20 ; l'achat dont la
//      réception n'est PAS lue est compté à part (1), jamais gardé ;
//   3. prix payé 30 → 45 € ⇒ les achats à 35 et 40 € ;
//   4. marque Adidas + taille 42 ⇒ les deux Adidas 42 ;
//   5. rien n'est relié sans SON tap ; aucune erreur ; aucun débordement.
// Données INVENTÉES (scénario synthétique `_scenario-colis.cjs`).
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const sc = require('./_scenario-colis.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7978;
const SHOTS = process.env.SHOTS || '';
const J = 86400e3, U = sc.UID[0];
const iso = (ms) => new Date(ms).toISOString();
const jourIso = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const listing = { ...sc.annonce({ id: '93000', titre: 'Adidas Spezial noir 42', prix: 70, taille: 42, marque: 'Adidas' }), created_at_ts: Math.floor((sc.NOW - 60 * J) / 1000) };
const achat = (tx, titre, jours, prix) => sc.ordre({ tx, titre, prix, statut: sc.STATUT_FINAL, dateMs: sc.NOW - jours * J });
const ACHATS = [
  achat('91001', 'Adidas Spezial noire 42', 25, 40),   // reçu à J-20 (livraison lue)
  achat('91002', 'Nike Air Force 1 blanc 43', 8, 25),  // reçu à J-5
  achat('91003', 'Adidas Gazelle bleue 42', 30, 60),   // réception PAS lue (livraison en cours)
  achat('91004', 'Puma Suede rouge 44', 45, 35),       // reçu à J-40
];
const RECU = { 91001: 20, 91002: 5, 91004: 40 };
// La transaction de l'achat, à la forme de Vinted (`payload.transaction`).
const txn = (tx, recuJ) => ({ id: `harvest_${U}_txn_${tx}`, data: { capturedAt: iso(sc.NOW - 3600e3), payload: { transaction: {
  id: Number(tx), user_side: 'buyer', items_count: 1, item_photo: { url: '' }, seller: { login: 'vendeuse_inventee' },
  shipment: recuJ == null ? { status: 200, status_updated_at: iso(sc.NOW - 2 * J) } : { status: 400, status_updated_at: iso(sc.NOW - recuJ * J) } } } } });
const vente = sc.ordre({ tx: '95000', titre: 'Adidas Spezial noir 42', prix: 70, statut: sc.STATUT_FINAL, dateMs: sc.NOW - 3 * J, item: '93000' });
const main = (sombre) => sc.ligneMain({ vinted_dark: sombre, vinted_annonce_numeros: { 93000: { numero: '1', title: 'Adidas Spezial noir 42', price: 70 } } });
const ROWS = [sc.ligneListings(U, [listing]), sc.lignePurch(U, ACHATS), sc.ligneSold(U, [vente]), ...ACHATS.map((a) => txn(a.transaction_id, RECU[a.transaction_id]))];
// La projection PostgREST (`select=alias:data->a->>b`), comme la base la sert.
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>[^>]*$/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); };

async function passe(b, nom, ctxOpts, sombre) {
  console.log(`── ${nom}`);
  const ctx = await b.newContext(ctxOpts);
  const pg = await ctx.newPage();
  const errs = [], ecrits = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(!!sb)); } catch (_) {} }, sombre);
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecrits.push(String(req.postData() || '')); return j([], 201); }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(sc.comptes());
    if (/id=eq\.main/.test(u)) return j(main(sombre));
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data' && !/^id,data/.test(sel) && !/^data,/.test(sel)) ? projette(r, sel) : r;
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const m = /id=like\.([^&]*)/.exec(u); if (m) { const re = new RegExp('^' + m[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=ventes&site=vinted`, { waitUntil: 'domcontentloaded' });
  const bouton = pg.locator('[data-cout-vente-relier]').first();
  await bouton.waitFor({ timeout: 25000 }).catch(() => {});
  dit(await bouton.count() > 0, `${nom} · « Relier un achat » sur la vente sans prix`);
  if (!(await bouton.count())) { await capture(pg, `relier-filtres-${nom}-ko`); await ctx.close(); return; }
  await bouton.evaluate((e) => e.click());
  await pg.locator('[data-relier-feuille] [data-suggestions-achat], [data-relier-feuille] [data-tous-achats]').first().waitFor({ timeout: 15000 }).catch(() => {});
  if (await pg.locator('[data-voir-tous-achats]').count()) await pg.locator('[data-voir-tous-achats]').click();
  await pg.locator('[data-tous-achats]').waitFor({ timeout: 8000 }).catch(() => {});
  const libres = () => pg.$$eval('[data-achat-libre]', (els) => els.map((e) => e.getAttribute('data-achat-libre')).sort().join());
  dit((await libres()) === '91001,91002,91003,91004', `${nom} · « Voir tous les achats » : les quatre achats libres`, await libres());
  // 1. Les filtres.
  await pg.locator('[data-filtres-plus]').click();
  await pg.locator('[data-filtres-achat]').waitFor({ timeout: 5000 }).catch(() => {});
  const champs = await pg.evaluate(() => ['[data-filtre-prix-min]', '[data-filtre-prix-max]', '[data-filtre-recu-du]', '[data-filtre-recu-au]', '[data-filtre-marque]', '[data-filtre-taille]'].map((s) => !!document.querySelector(s)));
  dit(champs.every(Boolean), `${nom} · 1 · Filtres : prix de/à, reçu du/au, marque, taille`, JSON.stringify(champs));
  await capture(pg, `relier-filtres-${nom}-ouverts`);
  // 2. La date de RÉCEPTION lue (la transaction de l'achat), même depuis Ventes.
  if (champs[2] && champs[3]) {
    await pg.fill('[data-filtre-recu-du]', jourIso(sc.NOW - 25 * J));
    await pg.fill('[data-filtre-recu-au]', jourIso(sc.NOW - 10 * J));
    await pg.waitForFunction(() => { const l = [...document.querySelectorAll('[data-achat-libre]')].map((e) => e.getAttribute('data-achat-libre')); return l.length === 1 && l[0] === '91001'; }, null, { timeout: 15000 }).catch(() => {});
    const r = await pg.evaluate(() => ({ l: [...document.querySelectorAll('[data-achat-libre]')].map((e) => e.getAttribute('data-achat-libre')).join(), sans: (document.querySelector('[data-achats-sans-reception]') || { getAttribute: () => '0' }).getAttribute('data-achats-sans-reception') }));
    dit(r.l === '91001', `${nom} · 2 · reçu du J-25 au J-10 ⇒ l'achat reçu à J-20 seul (date LUE dans sa transaction)`, JSON.stringify(r));
    dit(r.sans === '1', `${nom} · 2 · l'achat sans réception lue est COMPTÉ à part (1), jamais gardé`, JSON.stringify(r));
    await capture(pg, `relier-filtres-${nom}-date`);
    await pg.locator('[data-filtres-effacer]').click();
  }
  // 3. Le prix payé.
  await pg.fill('[data-filtre-prix-min]', '30');
  await pg.fill('[data-filtre-prix-max]', '45');
  await pg.waitForTimeout(250);
  dit((await libres()) === '91001,91004', `${nom} · 3 · prix payé 30 → 45 € ⇒ les achats à 40 et 35 €`, await libres());
  await pg.locator('[data-filtres-effacer]').click();
  // 4. Marque et taille.
  if (await pg.locator('[data-filtre-marque]').count()) await pg.selectOption('[data-filtre-marque]', 'Adidas');
  if (await pg.locator('[data-filtre-taille]').count()) await pg.selectOption('[data-filtre-taille]', '42');
  await pg.waitForTimeout(250);
  dit((await libres()) === '91001,91003', `${nom} · 4 · marque Adidas + taille 42 ⇒ les deux Adidas 42`, await libres());
  // 5. Rien n'est relié sans son tap ; pas de débordement ; cibles au doigt.
  dit(!ecrits.some((x) => /"buyFromId":"9100\d"/.test(x)), `${nom} · 5 · rien n'est relié sans SON tap`);
  const deborde = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  dit(!deborde, `${nom} · 5 · aucun défilement horizontal`);
  if (ctxOpts.hasTouch) {
    const petits = await pg.evaluate(() => [...document.querySelectorAll('[data-filtres-achat] input, [data-filtres-achat] select, [data-filtres-achat] button, [data-filtres-plus]')].filter((x) => { const bb = x.getBoundingClientRect(); return bb.width && bb.height < 43.5; }).map((x) => x.outerHTML.slice(0, 60)));
    dit(!petits.length, `${nom} · 5 · champs des filtres ≥ 44 px au doigt`, petits.join(' | '));
  }
  await capture(pg, `relier-filtres-${nom}-marque`);
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

(async () => {
  srv.listen(PORT);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    await passe(b, '390', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'fr-FR' }, false);
    await passe(b, '390-sombre', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark', locale: 'fr-FR' }, true);
    await passe(b, '1512', { viewport: { width: 1512, height: 950 }, locale: 'fr-FR' }, false);
    await passe(b, '1512-sombre', { viewport: { width: 1512, height: 950 }, colorScheme: 'dark', locale: 'fr-FR' }, true);
  } catch (e) { ko++; console.log('❌ le banc a levé — ' + (e && e.message)); }
  await b.close(); srv.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge' : '✅ Relier un achat : filtres prix, réception lue, marque, taille'} (${ok} verts)`);
  process.exit(ko ? 1 : 0);
})();
