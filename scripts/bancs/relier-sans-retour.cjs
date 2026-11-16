// ════════════════════════════════════════════════════════════════════════════
// BANC : UN ACHAT EN RETOUR N'EST PAS PROPOSÉ À RELIER (16 nov., lot achats-retour)
//        node scripts/bancs/relier-sans-retour.cjs
// ════════════════════════════════════════════════════════════════════════════
// Julien (capture de la feuille « Relier » d'une vente) : « j'ai demandé un retour, donc j'ai
// fait un litige : ne me la propose pas, vu que je ne vais pas la mettre en vente ».
// Ventes · une vente sans prix d'achat · « Relier un achat » : la feuille montre ses achats ;
//   · celui dont le BORDEREAU DE RETOUR est arrivé (`email_bordretour_{tx}`, sens achat) : absent ;
//   · celui REMBOURSÉ par e-mail (`email_rembachat_{tx}`, montant = payé) : absent ;
//   · celui dont le litige est CLOS SANS RETOUR (bordereau reçu, commande finalisée) : présent ;
//   · le libre : présent ; aucun ne se distingue par le titre (quatre titres identiques).
// Lignes servies dans leur forme (projection `meta->>`). 390 tactile clair + 1512 sombre.
// Données inventées (scénario synthétique, `_scenario-colis.cjs`). Un banc ne meurt pas, il rapporte.
// `BANC_DIST=` le build jugé ; `SHOTS=` les captures.
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const sc = require('./_scenario-colis.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (21000 + Math.floor(Math.random() * 18000));
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-relier-sans-retour');
fs.mkdirSync(SHOTS, { recursive: true });
const J = 86400e3, U = sc.UID[0];
const T = 'Adidas Spezial noire 42';
const listing = { ...sc.annonce({ id: 'pa0', titre: 'Adidas Spezial noir 42', prix: 70, taille: 42, marque: 'Adidas' }), created_at_ts: Math.floor((sc.NOW - 60 * J) / 1000) };
const achat = (tx, statut, jours = 30) => sc.ordre({ tx, conv: 'c' + tx, titre: T, prix: 40, statut, dateMs: sc.NOW - jours * J });
const LIBRE = '7100001', RETOUR = '7100002', CLOS = '7100003', REMB = '7100004';
const achats = [achat(LIBRE, sc.STATUT_FINAL), achat(RETOUR, 'Colis livré', 28), achat(CLOS, sc.STATUT_FINAL, 26), achat(REMB, 'Colis livré', 24)];
const vente = sc.ordre({ tx: '7200001', titre: 'Adidas Spezial noir 42', prix: 70, statut: sc.STATUT_FINAL, dateMs: sc.NOW - 10 * J, item: 'pa0' });
const main = (sombre) => sc.ligneMain({ vinted_dark: sombre, vinted_annonce_numeros: { pa0: { numero: '1', title: 'Adidas Spezial noir 42', price: 70 } } });
const recu = new Date(sc.NOW - 2 * J).toISOString();
const bord = (tx) => ({ id: `email_bordretour_${tx}`, data: { type: 'bordereau-retour', sens: 'achat', transaction: tx, suivi: '8200' + tx, dateLimite: '', dateLimiteIso: new Date(sc.NOW + 3 * J).toISOString(), article: T, uid: U, account: 'compte_a', receivedAt: recu } });
const rows = [sc.ligneListings(U, [listing]), sc.lignePurch(U, achats), sc.ligneSold(U, [vente]),
  bord(RETOUR), bord(CLOS),
  { id: `email_rembachat_${REMB}`, data: { type: 'remboursement-achat', transaction: REMB, montant: '40.00', receivedAt: recu } },
].map((r) => (r.id.endsWith('_listings') ? { ...r, data: { ...r.data, capturedAt: new Date(sc.NOW - 60e3).toISOString() } } : r));
const projette = (row, sel) => {
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x !== 'object' ? String(x) : x);
  }
  return out;
};
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };

async function passe(b, nom, ctxOpts, sombre) {
  console.log(`\n── ${nom}`);
  const ctx = await b.newContext({ locale: 'fr-FR', ...ctxOpts });
  const pg = await ctx.newPage();
  const errs = [], lus = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sb) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, sombre);
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(sc.comptes ? sc.comptes() : []);
    if (/id=eq\.main/.test(u)) return j(main(sombre));
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => (/^email_/.test(r.id) && sel && sel !== 'data' ? projette(r, sel) : r);
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) { const k = eq[1]; return j(rows.filter((r) => r.id === k).map(forme)); }
    const m = /id=like\.([^&]*)/.exec(u); if (m) { if (/email_(bordretour|rembachat)/.test(m[1])) lus.push(m[1]); const re = new RegExp('^' + m[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=ventes&site=vinted`, { waitUntil: 'domcontentloaded' });
  const bouton = pg.locator('[data-cout-vente-relier]').first();
  await bouton.waitFor({ timeout: 25000 }).catch(() => {});
  dit(await bouton.count() > 0, `${nom} · « Relier un achat » visible sur la vente sans prix`);
  if (!(await bouton.count())) { await pg.screenshot({ path: path.join(SHOTS, `relier-sans-retour-${nom}-ko.png`), fullPage: true }); await ctx.close(); return; }
  // Les preuves sont lues (bordereaux et remboursements) avant d'ouvrir la feuille.
  for (let i = 0; i < 40 && lus.length < 2; i++) await pg.waitForTimeout(250);
  dit(lus.some((x) => /bordretour/.test(x)) && lus.some((x) => /rembachat/.test(x)), `${nom} · les bordereaux de retour et remboursements sont lus`, lus.join(' '));
  await pg.waitForTimeout(600);
  await bouton.evaluate((e) => e.click());
  await pg.locator('[data-relier-feuille] [data-suggestions-achat], [data-relier-feuille] [data-tous-achats]').first().waitFor({ timeout: 15000 }).catch(() => {});
  const voir = pg.locator('[data-relier-feuille] [data-voir-tous-achats]');
  if (await voir.count()) { await voir.first().click().catch(() => {}); await pg.locator('[data-tous-achats]').waitFor({ timeout: 5000 }).catch(() => {}); }
  await pg.waitForTimeout(400);
  // Tout identifiant d'achat présent dans la feuille, quel que soit son rôle (libre, suggestion, piste, déjà relié).
  const vus = await pg.evaluate(() => { const f = document.querySelector('[data-relier-feuille]'); if (!f) return null; const s = new Set(); for (const e of f.querySelectorAll('*')) for (const a of e.attributes) if (/^data-/.test(a.name) && /^71000\d\d$/.test(a.value)) s.add(a.value); return [...s].sort(); });
  dit(Array.isArray(vus), `${nom} · la feuille « Relier » s'ouvre`);
  const V = vus || [];
  dit(!V.includes(RETOUR), `${nom} · l'achat au BORDEREAU DE RETOUR reçu n'est pas proposé`, JSON.stringify(V));
  dit(!V.includes(REMB), `${nom} · l'achat REMBOURSÉ (e-mail, même n°) n'est pas proposé`, JSON.stringify(V));
  dit(V.includes(CLOS), `${nom} · litige clos sans retour (commande finalisée) : de nouveau proposé`, JSON.stringify(V));
  dit(V.includes(LIBRE), `${nom} · l'achat libre (même titre) est proposé`, JSON.stringify(V));
  const deborde = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  dit(!deborde, `${nom} · aucun défilement horizontal`);
  await pg.screenshot({ path: path.join(SHOTS, `relier-sans-retour-${nom}.png`) });
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  await passe(b, '390', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, false);
  await passe(b, '1512-sombre', { viewport: { width: 1512, height: 950 }, colorScheme: 'dark' }, true);
  await b.close(); srv.close();
  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
