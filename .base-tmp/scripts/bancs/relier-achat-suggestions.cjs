// ════════════════════════════════════════════════════════════════════════════
// BANC : RELIER UN ACHAT — SUGGESTIONS ET « VOIR TOUS LES ACHATS » (3 nov.)
//        node scripts/bancs/relier-achat-suggestions.cjs
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
srv.listen(4391);
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

async function passe(b, nom, ctxOpts, sombre) {
  console.log(`\n── ${nom}`);
  const ctx = await b.newContext(ctxOpts);
  const pg = await ctx.newPage();
  const errs = [], ecrits = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sb) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, sombre);
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = metaVersData(req.url());
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecrits.push(String(req.postData() || '')); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(sc.comptes ? sc.comptes() : []);
    if (/id=eq\.main/.test(u)) return j(main(sombre));
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) { const k = decodeURIComponent(eq[1]); return j(rows.filter((r) => r.id === k)); }
    const m = /id=like\.([^&]*)/.exec(u); if (m) { const re = new RegExp('^' + decodeURIComponent(m[1]).replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  await pg.goto('http://localhost:4391/?tab=ventes&site=vinted', { waitUntil: 'domcontentloaded' });
  const bouton = pg.locator('[data-cout-vente-relier]').first();
  await bouton.waitFor({ timeout: 20000 }).catch(() => {});
  dit(await bouton.count() > 0, `${nom} · « Relier un achat » visible sur la vente sans prix`);
  if (!(await bouton.count())) { await pg.screenshot({ path: path.join(SC, `z-relier-${nom}.png`), fullPage: true }); await ctx.close(); return; }
  await bouton.evaluate((e) => e.click());
  await pg.locator('[data-relier-feuille] [data-suggestions-achat], [data-relier-feuille] [data-tous-achats]').first().waitFor({ timeout: 15000 }).catch(() => {});
  const sugg = await pg.$$eval('[data-suggestion-achat]', (els) => els.map((e) => e.getAttribute('data-suggestion-achat')));
  dit(sugg.join() === 'ac1', `${nom} · une seule suggestion, la bonne (marque, taille, couleur, antérieure, libre)`, JSON.stringify(sugg));
  const portail = await pg.evaluate(() => { const f = document.querySelector('[data-relier-feuille]'); return !!f && f.parentElement === document.body; });
  dit(portail, `${nom} · la feuille passe par un portail (enfant de body)`);
  await pg.screenshot({ path: path.join(SC, `z-relier-${nom}-suggestions.png`) });
  const avant = await pg.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const v = localStorage.getItem(localStorage.key(i)) || ''; if (/"buyFromId":"ac[1-5]"/.test(v)) return true; } return false; });
  dit(!avant && !ecrits.some((x) => /"buyFromId":"ac[1-5]"/.test(x)), `${nom} · rien n'est écrit avant son tap`);
  await pg.locator('[data-voir-tous-achats]').click();
  await pg.locator('[data-tous-achats]').waitFor({ timeout: 5000 }).catch(() => {});
  const tous = await pg.$$eval('[data-achat-libre]', (els) => els.map((e) => e.getAttribute('data-achat-libre')));
  dit(!tous.includes('ac6') && ['ac1', 'ac2', 'ac3', 'ac4', 'ac5'].every((t) => tous.includes(t)), `${nom} · « Voir tous les achats » : les libres, pas celui déjà relié`, JSON.stringify(tous));
  const lot = await pg.locator('[data-achat-libre="ac5"]').innerText().catch(() => '');
  dit(/lot · 0\/3 reliés/.test(lot), `${nom} · le lot porte « lot · 0/3 reliés »`, JSON.stringify(lot.slice(0, 120)));
  const cibles = await pg.$$eval('[data-relier-achat]', (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  dit(cibles.length && cibles.every((h) => h >= 44), `${nom} · « Relier » fait 44 px au doigt`, JSON.stringify(cibles.slice(0, 3)));
  const deborde = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  dit(!deborde, `${nom} · aucun défilement horizontal`);
  await pg.screenshot({ path: path.join(SC, `z-relier-${nom}-tous.png`) });
  // Un lot : le prix de CET article est demandé, champ vide ; Annuler n'écrit rien.
  await pg.locator('[data-achat-libre="ac5"] [data-relier-achat]').click();
  await pg.waitForTimeout(400);
  const champ = await pg.evaluate(() => { const i = [...document.querySelectorAll('input')].find((x) => x.offsetParent && x.closest('[role="dialog"], [data-ask], body') && x.getAttribute('data-tous-achats-recherche') == null); return i ? { v: i.value } : null; });
  dit(champ && champ.v === '', `${nom} · lot : le prix est DEMANDÉ, champ vide (jamais pré-rempli)`, JSON.stringify(champ));
  await pg.screenshot({ path: path.join(SC, `z-relier-${nom}-lot.png`) });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  const annuler = pg.locator('button', { hasText: /^Annuler$/ }); if (await annuler.count()) await annuler.first().click().catch(() => {});
  await pg.waitForTimeout(300);
  const lotEcrit = await pg.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { if (/"buyFromId":"ac5"/.test(localStorage.getItem(localStorage.key(i)) || '')) return true; } return false; });
  dit(!lotEcrit && !ecrits.some((x) => /"buyFromId":"ac5"/.test(x)), `${nom} · lot annulé : aucun prix de lot écrit`);
  dit(await pg.locator('[data-cout-vente-relier]').count() === 1, `${nom} · après suggestions, liste et lot annulé : la vente n'a toujours AUCUN achat relié`);
  // SON tap sur la bonne suggestion : le lien est écrit.
  if (!(await pg.locator('[data-relier-feuille]').count())) await bouton.evaluate((e) => e.click());
  await pg.locator('[data-suggestion-achat="ac1"] [data-relier-achat]').click();
  await pg.waitForTimeout(1500);
  // L'écriture est l'état de l'app (la sauvegarde vers la base est différée et
  // exige une session) : la vente n'a plus de coût manquant, son geste disparaît.
  await pg.waitForTimeout(300);
  const restant = await pg.locator('[data-cout-vente-relier]').count();
  dit(restant === 0, `${nom} · « Relier » écrit le lien : la vente a son coût, « Relier un achat » disparaît`, `${restant} restant(s)`);
  dit(!(await pg.locator('[data-relier-feuille]').count()), `${nom} · la feuille se ferme après le lien`);
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
