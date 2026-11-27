// ════════════════════════════════════════════════════════════════════════════
// BANC : PARAMÈTRES → « EXPORTER MES DONNÉES » (3 nov.)
//        node scripts/bancs/export-donnees.cjs
// ════════════════════════════════════════════════════════════════════════════
// Le geste existe, sans texte explicatif, à 44 px ; le fichier TÉLÉCHARGÉ est un
// zip de 7 tableaux lisibles ; les achats captés y sont ; aucune requête
// d'écriture ni d'envoi ne part pendant l'export. 390 tactile clair + 1512 sombre.
// (Le reste de l'en-tête vient du banc relier-achat-suggestions : même scénario.)
// ════════════════════════════════════════════════════════════════════════════
// (scénario d'origine :)
// ════════════════════════════════════════════════════════════════════════════
// Ventes · une vente sans prix d'achat · « Relier un achat » : la feuille montre
// LA suggestion juste (même marque, taille, couleur, achat antérieur, libre) et
// aucune autre ; « Voir tous les achats » liste les achats libres (pas celui
// déjà relié ailleurs), le LOT avec « lot · 0/3 reliés » ; rien n'est écrit
// avant SON tap ; « Relier » écrit le lien (buyFromId) ; un lot DEMANDE le prix
// de cet article, champ vide. 390 tactile clair + 1512 sombre. Données inventées
// (scénario synthétique, `_scenario-colis.cjs`).
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const sc = require('./_scenario-colis.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist'), SC = __dirname;
const J = 86400e3, U = sc.UID[0];
const listing = { ...sc.annonce({ id: 'pa0', titre: 'Adidas Spezial noir 42', prix: 70, taille: 42, marque: 'Adidas' }), created_at_ts: Math.floor((sc.NOW - 60 * J) / 1000) };
const autre = sc.annonce({ id: 'pa1', titre: 'Adidas Spezial noir 42', prix: 70, taille: 42, marque: 'Adidas' });
const achat = (tx, titre, jours, prix = 40) => sc.ordre({ tx, titre, prix, statut: sc.STATUT_FINAL, dateMs: sc.NOW - jours * J });
const achats = [
  achat('ac1', 'Adidas Spezial noire 42', 30),         // LA bonne
  achat('ac2', 'Adidas Spezial bleue 42', 30),         // couleur différente
  achat('ac3', 'Nike Air Force 1 noir 42', 30),        // marque différente
  achat('ac4', 'Adidas Spezial noire 42', 2),          // POSTÉRIEUR à la vente (−10 j)
  achat('ac5', 'Lot 3 articles', 40, 90),              // un lot
  achat('ac6', 'Adidas Spezial noire 42', 35),         // déjà relié à pa1
];
const vente = sc.ordre({ tx: 've0', titre: 'Adidas Spezial noir 42', prix: 70, statut: sc.STATUT_FINAL, dateMs: sc.NOW - 10 * J, item: 'pa0' });
const main = (sombre) => sc.ligneMain({ vinted_dark: sombre, vinted_annonce_numeros: { pa0: { numero: '1', title: 'Adidas Spezial noir 42', price: 70 }, pa1: { numero: '2', title: 'Adidas Spezial noir 42', price: 70, buyFromId: 'ac6', buyPrice: '40' } } });
const rows = [sc.ligneListings(U, [listing, autre]), sc.lignePurch(U, achats), sc.ligneSold(U, [vente])].map((r) => (r.id.endsWith('_listings') ? { ...r, data: { ...r.data, capturedAt: new Date(sc.NOW - 60e3).toISOString() } } : r));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
const PORT = Number(process.env.BANC_PORT) || 4392;   // (27 nov.) le port de la CI parallèle (scripts/lancer-bancs.cjs)
srv.listen(PORT);
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
// (27 nov., bancs-compta) Depuis le 12 nov. (RGPD), l'export ajoute TOUTES ses données, rendues par le serveur
// page par page (GET /api/compte?mode=mes-donnees, api/_lib/export-rgpd.js, src/exportRgpd.js). Le banc sert sa
// vraie forme sur DEUX pages (`suite`) — un morceau du même fichier coupé entre elles — et, en panne, une page qui
// ne répond pas : le zip le DIT (INCOMPLET.txt), jamais un export qui a l'air complet. C'est une LECTURE (GET) :
// elle n'entre pas dans « aucune écriture ni envoi » ; toute autre requête vers /api, ou non-GET, y entre.
const DOSSIER_RGPD = 'VRM-mes-donnees-banc';
const PAGES_RGPD = [
  { ok: true, morceaux: [{ nom: `${DOSSIER_RGPD}/lignes/001.json`, texte: '[{"id":"main"' }], suite: 'p2', fini: false, etape: 'lignes' },
  { ok: true, morceaux: [{ nom: `${DOSSIER_RGPD}/lignes/001.json`, texte: ',"data":{}}]' }, { nom: `${DOSSIER_RGPD}/LISEZMOI.txt`, texte: 'banc' }], fini: true, etape: 'compte' },
];
async function passe(b, nom, ctxOpts, sombre, { rgpdKO = false } = {}) {
  console.log(`\n── ${nom}`);
  const E = await import(require('url').pathToFileURL(path.join(__dirname, '..', '..', 'src', 'exportDonnees.js')).href);
  const ctx = await b.newContext({ ...ctxOpts, acceptDownloads: true });
  const pg = await ctx.newPage(); const errs = [], ecrits = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sb) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, sombre);
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = metaVersData(req.url());
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecrits.push(u); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(sc.comptes());
    if (/id=eq\.main/.test(u)) return j(main(sombre));
    const proj = (r) => (/select=id,orders:data->payload->my_orders/.test(decodeURIComponent(u)) ? { id: r.id, orders: r.data.payload.my_orders } : r);
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) { const k = decodeURIComponent(eq[1]); return j(rows.filter((r) => r.id === k)); }
    const m = /id=like\.([^&]*)/.exec(u); if (m) { const re = new RegExp('^' + decodeURIComponent(m[1]).replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(proj)); }
    return j([]);
  });
  const lus = [];
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (r.request().method() === 'GET' && /\/api\/compte\?mode=mes-donnees/.test(u)) {
      lus.push(u);
      if (rgpdKO && /suite=p2/.test(u)) return r.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PAGES_RGPD[/suite=p2/.test(u) ? 1 : 0]) });
    }
    ecrits.push(u); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  const g = pg.locator('[data-exporter-donnees]').first();
  // (27 nov.) Paramètres en catégories (15 nov.) : au téléphone la rangée vit dans « Sécurité des données »,
  // derrière « Réglages avancés » — deux touchers, comme le vendeur (sans effet si elle est déjà là).
  await pg.waitForSelector('.vrm-set[data-parametres]', { timeout: 20000 }).catch(() => {});
  if (!(await g.isVisible().catch(() => false))) {
    const cat = pg.locator('[data-categorie-contient~="donnees"]').first();
    if (await cat.count()) { if (ctxOpts.hasTouch) await cat.tap(); else await cat.click(); }
    const av = pg.locator('details[data-reglages-avances]:not([open]):has([data-exporter-donnees]) > summary').first();
    await av.waitFor({ timeout: 5000 }).catch(() => {});
    if (await av.count()) { if (ctxOpts.hasTouch) await av.tap(); else await av.click(); }
  }
  await g.waitFor({ timeout: 20000 }).catch(() => {});
  dit(await g.count() > 0, `${nom} · Paramètres → « Exporter mes données »`);
  if (!(await g.count())) { await pg.screenshot({ path: path.join(SC, `z-export-${nom}.png`), fullPage: true }); await ctx.close(); return; }
  await g.scrollIntoViewIfNeeded();
  const h = await g.evaluate((e) => Math.round(e.getBoundingClientRect().height));
  const txt = (await g.innerText()).trim();
  const nomGeste = txt.split('\n')[0].trim();
  // (27 nov.) Rangée natif (19 nov.) : le nom du geste, puis au plus UNE ligne courte (règle du 23 nov., tenue
  // en nombre par textes-visibles) ; jamais un paragraphe.
  dit(h >= 44 && nomGeste === 'Exporter mes données' && txt.split('\n').filter((l) => l.trim()).length <= 2, `${nom} · 44 px, le nom du geste, au plus une ligne dessous`, `${h} px · « ${txt} »`);
  await pg.screenshot({ path: path.join(SC, `z-export-${nom}.png`) });
  const n0 = ecrits.length;
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 20000 }).catch(() => null), g.click()]);
  dit(!!dl && /^VRM-donnees-\d{4}-\d{2}-\d{2}\.zip$/.test(dl.suggestedFilename()), `${nom} · un zip est téléchargé`, dl ? dl.suggestedFilename() : 'aucun');
  if (dl) {
    const p = await dl.path(); const z = E.lireZipStocke(new Uint8Array(fs.readFileSync(p)));
    const TABLEAUX = ['ventes.csv', 'achats.csv', 'stock.csv', 'depenses.csv', 'urssaf.csv', 'declarations.csv', 'factures-pro.csv'];
    dit(TABLEAUX.every((t) => z.some((f) => f.nom === t)) && z.every((f) => f.crcOk), `${nom} · 7 tableaux, CRC justes`, z.map((f) => f.nom).join(','));
    const lignes = z.find((f) => f.nom === `${DOSSIER_RGPD}/lignes/001.json`);
    if (!rgpdKO) {
      dit(lus.length === 2 && !!lignes && lignes.texte === '[{"id":"main","data":{}}]' && !z.some((f) => f.nom === 'INCOMPLET.txt'), `${nom} · toutes ses données (2 pages du serveur) recollées dans l'ordre, rien d'ajouté`, `${lus.length} page(s) · ${lignes ? lignes.texte : 'absent'}`);
    } else {
      dit(z.some((f) => f.nom === 'INCOMPLET.txt') && !lignes, `${nom} · une page du serveur ratée ⇒ INCOMPLET.txt, jamais un export qui a l'air complet`, z.map((f) => f.nom).join(','));
    }
    const ach = z.find((f) => f.nom === 'achats.csv'); const L = ach ? E.lireCsv(ach.texte) : [];
    dit(L.length === 7 && L.some((l) => l[2] === 'ac6' && l[6] === '2'), `${nom} · les 6 achats captés, l'achat relié porte son N°`, JSON.stringify(L.slice(0, 2)));
  }
  dit(ecrits.length === n0, `${nom} · aucune écriture ni envoi pendant l'export`, ecrits.slice(n0).join(' | '));
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
  await ctx.close();
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  await passe(b, '390', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, false);
  await passe(b, '1512-sombre', { viewport: { width: 1512, height: 950 }, colorScheme: 'dark' }, true);
  await passe(b, '1512-panne', { viewport: { width: 1512, height: 950 } }, false, { rgpdKO: true });
  await b.close(); srv.close();
  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
