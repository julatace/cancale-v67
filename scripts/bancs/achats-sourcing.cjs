// ════════════════════════════════════════════════════════════════════════════
// BANC : ACHATS — FOURNISSEURS · DÉLAI · LOTS (4 nov., src/AchatsOutils.jsx)
//        node scripts/bancs/achats-sourcing.cjs
// ════════════════════════════════════════════════════════════════════════════
// L'écran Achats RENDU sur un scénario INVENTÉ (aucune donnée réelle) servi par
// le mini PostgREST (projections `select=` comprises : la transaction d'un achat
// est lue en scalaires) :
//   · Fournisseurs (5 nov.) : les personnes QU'IL crée ; aucun vendeur Vinted
//     (pseudo lu dans une transaction) n'y apparaît — détail : fournisseurs.cjs ;
//   · Délai : médiane, mois, exclus comptés ; « Reçus, pas encore en ligne » ;
//     « Relier » un N° (son tap) écrit le lien et le prix ;
//   · Lots : « Répartir » — somme fausse ⇒ « Reste » et Enregistrer grisé ; rien
//     n'est écrit avant SON clic + confirmation ; « Annuler » rend l'état d'avant.
// 390 tactile clair, 390 sombre, 1512 clair, 1512 sombre ; captures z-aso-*.png.
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { servir } = require('./_minipgrest.cjs');
const sc = require('./_scenario-colis.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist'), SC = __dirname, PORT = 4417;
const J = 86400e3, U = sc.UID[0], NOW = Date.now(), iso = (ms) => new Date(ms).toISOString();
const sec = (ms) => Math.floor(ms / 1000);
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'camille.martin@exemple.test' } };

const achat = (tx, titre, prix, jours, statut = sc.STATUT_FINAL) => sc.ordre({ tx, titre, prix, statut, dateMs: NOW - jours * J });
const ACHATS = [
  achat('9100001', 'Nike Dunk Low 43', 40, 25),
  achat('9100002', 'Adidas Samba 42', 30, 18),
  achat('9100003', 'Lot 3 paires', 90, 12),
  achat('9100004', 'Nike Air Max 90 41', 35, 9),
  achat('9100005', 'Asics Gel 40', 25, 30, 'Commande remboursée'),
  achat('9100006', 'Puma Suede 44', 28, 3, sc.STATUT_RELAIS),
];
// Une transaction à la forme de Vinted ; `meta` = ce que la base en tire (vrm_meta).
const txn = (tx, { vendeur, nb = 1, livAt, cote = 'buyer', item = null }) => {
  const t = { id: Number(tx), user_side: cote, seller: { login: vendeur || 'boutique_nord' }, items_count: nb, item_photo: null, item_id: item, status: 450, status_title: 'Commande finalisée', status_updated_at: iso(NOW - J),
    shipment: livAt ? { id: 1, status: 400, status_title: 'Commande livrée ! ', status_updated_at: iso(livAt) } : null };
  return { id: `harvest_${U}_txn_${tx}`, meta: { id: String(tx), item_id: item, status: '450', status_updated_at: t.status_updated_at, ship_status_title: t.shipment ? t.shipment.status_title : null },
    data: { capturedAt: iso(NOW), payload: { code: 0, transaction: t } } };
};
// Mise en ligne une heure APRÈS le jour pile : un délai de 5 j se lit 5 j (jours entiers).
const annonce = (id, titre, joursEnLigne) => ({ ...sc.annonce({ id, titre, prix: 80 }), created_at_ts: sec(NOW - joursEnLigne * J + 3600e3) });
const LISTINGS = [annonce('pa1', 'Nike Dunk Low 43', 15), annonce('pa3', 'Nike Blazer 42', 6)];
const VENTES = [
  sc.ordre({ tx: '9200002', titre: 'Adidas Samba 42', prix: 70, statut: sc.STATUT_FINAL, dateMs: NOW - 5 * J, item: 'pa2' }),
  sc.ordre({ tx: '9200006', titre: 'Jordan 1 Mid 44', prix: 80, statut: sc.STATUT_FINAL, dateMs: NOW - 4 * J, item: 'pa6' }),
];
const FICHES = {
  pa1: { numero: '1', title: 'Nike Dunk Low 43', buyPrice: '40', buyFromId: '9100001' },
  pa2: { numero: '2', title: 'Adidas Samba 42', buyPrice: '30', buyFromId: '9100002' },
  pa3: { numero: '3', title: 'Nike Blazer 42', buyFromId: '9100003' },
  pa4: { numero: '4', title: 'Nike Cortez 41', buyPrice: '12', buyFromId: '9100003' },
  pa5: { numero: '5', title: 'Nike Air Max 90 41' },
  pa6: { numero: '6', title: 'Jordan 1 Mid 44', buyPrice: '60' },
};
const HORS = [{ id: 'ob1', title: 'Jordan 1 Mid 44', price: '60', source: 'Brocante', numero: '6', date: iso(NOW - 40 * J).slice(0, 10) }];
const rows = (sombre) => [
  ...sc.ligneMain({ vinted_dark: sombre, vinted_annonce_numeros: FICHES, vinted_offvinted_buys: HORS }),
  sc.ligneListings(U, LISTINGS), sc.lignePurch(U, ACHATS), sc.ligneSold(U, VENTES),
  txn('9100001', { vendeur: 'vendeuse_x', livAt: NOW - 20 * J }),
  txn('9100002', { vendeur: 'vendeuse_x', livAt: NOW - 12 * J }),
  txn('9100003', { vendeur: 'grossiste_y', nb: 3, livAt: NOW - 8 * J }),
  txn('9200002', { cote: 'seller', item: 'pa2' }), txn('9200006', { cote: 'seller', item: 'pa6' }),
  // Le second compte, lu (une annonce : une liste vide n'est jamais une réponse, §4.1).
  sc.ligneListings(sc.UID[1], [annonce('pb1', 'Vans Old Skool 40', 30)]), sc.lignePurch(sc.UID[1], []), sc.ligneSold(sc.UID[1], []),
].map((r) => ({ meta: {}, ...r, owner: SESSION.user.id, updated_at: iso(NOW) }));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.listen(PORT);
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const capture = (pg, nom) => pg.screenshot({ path: path.join(SC, `z-aso-${nom}.png`) });

async function passe(b, nom, ctxOpts, sombre) {
  console.log(`\n── ${nom}`);
  const ctx = await b.newContext({ ...ctxOpts, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = [], ecrits = [];
  const ROWS = rows(sombre);
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(([s, sb]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); if (sb) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, [SESSION, sombre]);

  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  // GoTrue APRÈS le fourre-tout (Playwright prend la DERNIÈRE route en premier) ;
  // `GET /user` rend la fiche utilisateur (sans facteur), pas une session.
  await pg.route('**/auth/v1/**', (r) => {
    const chemin = new URL(r.request().url()).pathname.replace(/^.*\/auth\/v1\//, '');
    const corps = chemin === 'user' ? { id: SESSION.user.id, email: SESSION.user.email, aud: 'authenticated' } : { ...SESSION, expires_in: 3600 };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = req.url();
    const j = (d, h = {}) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...h }, body: JSON.stringify(d) });
    if (req.method() !== 'GET' && req.method() !== 'HEAD') { ecrits.push(String(req.postData() || '')); return j([]); }
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(sc.comptes().map((c) => ({ ...c, owner: SESSION.user.id })), { 'content-range': '0-1/2' });
    if (!/\/rest\/v1\/app_data/.test(u)) return j([]);
    const s = servir(ROWS, decodeURIComponent(u).replace(/\+/g, ' ').replace(/#/g, '%23'), req.headers());
    return j(s.body, { 'content-range': s.range });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: /mode=confidentialite/.test(r.request().url()) ? JSON.stringify({ ok: true, uid: SESSION.user.id }) : '{"pret":true,"devices":1}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=achats&site=vinted`, { waitUntil: 'domcontentloaded' });
  // (5 nov., revue 2.16) Fournisseurs · Délai · Lots sont rangés derrière « … » (barre des étapes) :
  // fermés à l'arrivée, ouverts d'un geste.
  const plus = pg.locator('[data-achats-plus]');
  await plus.first().waitFor({ timeout: 25000 }).catch(() => {});
  dit(await pg.locator('[data-aso-outils]').count() === 0, `${nom} · Fournisseurs · Délai · Lots fermés derrière « … »`);
  await plus.first().click().catch(() => {});
  const outils = pg.locator('[data-aso-outils]');
  await outils.waitFor({ timeout: 25000 }).catch(() => {});
  dit(await outils.count() === 1, `${nom} · « … » ouvre les trois entrées sous la carte d'Achats`);
  if (!(await outils.count())) { await pg.screenshot({ path: path.join(SC, `z-aso-${nom}-ko.png`), fullPage: true }); console.log(errs.slice(0, 3).join('\n')); await ctx.close(); return; }
  const cibles = await pg.$$eval('[data-aso-ouvrir]', (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  dit(cibles.length === 3 && cibles.every((h) => h >= 44), `${nom} · entrées à 44 px au doigt`, JSON.stringify(cibles));
  await capture(pg, `${nom}-ecran`);

  // ── Fournisseurs (5 nov.) : les personnes QU'IL crée — aucun vendeur Vinted
  //    (vendeuse_x, grossiste_y : pseudos lus dans les transactions) n'y entre.
  //    Le détail (création, achat en gros, N° reliés) : scripts/bancs/fournisseurs.cjs.
  await pg.locator('[data-aso-ouvrir="fournisseurs"]').click();
  await pg.locator('[data-aso-feuille="fournisseurs"][data-aso-etat="lu"]').waitFor({ timeout: 20000 }).catch(() => {});
  const fTexte = await pg.locator('[data-aso-feuille="fournisseurs"]').innerText().catch(() => '');
  dit(await pg.locator('[data-fo-vide]').count() === 1 && !(await pg.locator('[data-fo-fournisseur]').count()), `${nom} · aucun fournisseur créé : la liste est vide et dit le geste`);
  dit(!/vendeuse_x|grossiste_y|boutique_nord/i.test(fTexte), `${nom} · aucun vendeur Vinted n'apparaît dans Fournisseurs`, fTexte.slice(0, 120));
  const portail = await pg.evaluate(() => { const f = document.querySelector('[data-aso-feuille]'); return !!f && f.parentElement === document.body; });
  dit(portail, `${nom} · la feuille passe par un portail`);
  await capture(pg, `${nom}-fournisseurs`);
  const deborde = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  dit(!deborde, `${nom} · aucun défilement horizontal`);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  dit(!(await pg.locator('[data-aso-feuille]').count()), `${nom} · Échap ferme la feuille`);

  // ── Délai
  await pg.locator('[data-aso-ouvrir="delai"]').click();
  await pg.locator('[data-aso-feuille="delai"] [data-aso-pas-en-ligne]').waitFor({ timeout: 20000 }).catch(() => {});
  const d = await pg.evaluate(() => { const c = document.querySelector('[data-aso-mediane]'); const e = document.querySelector('[data-aso-exclus]'); return { n: c && c.dataset.asoN, med: c && c.dataset.asoMediane, sansMel: e && e.dataset.asoSansMel, pel: [...document.querySelectorAll('[data-aso-pel]')].map((x) => x.getAttribute('data-aso-pel')) }; });
  dit(d.n === '2' && d.med === '3.5', `${nom} · médiane 3,5 j sur 2 achats (5 j et 2 j, dates LUES)`, JSON.stringify(d));
  dit(d.sansMel === '1', `${nom} · l'achat vendu sans date de mise en ligne : exclu ET compté`, JSON.stringify(d));
  dit(d.pel.join() === '9100004', `${nom} · « Reçus, pas encore en ligne » : le seul reçu sans article en ligne (pas l'en-route, pas le remboursé)`, JSON.stringify(d.pel));
  await capture(pg, `${nom}-delai`);
  const avant = await pg.evaluate(() => /"buyFromId":"9100004"/.test(localStorage.getItem('vinted_annonce_numeros') || ''));
  dit(!avant && !ecrits.some((w) => /9100004/.test(w)), `${nom} · rien n'est relié avant son tap`);
  await pg.locator('[data-aso-relier="9100004"]').click();
  await pg.locator('[data-aso-relier-numero="5"]').waitFor({ timeout: 5000 }).catch(() => {});
  const libres = await pg.$$eval('[data-aso-relier-numero]', (els) => els.map((e) => e.getAttribute('data-aso-relier-numero')));
  dit(libres.join() === '7,5', `${nom} · seuls les N° sans achat relié sont proposés (ni N°6, relié à un achat hors plateforme)`, JSON.stringify(libres));
  await capture(pg, `${nom}-relier`);
  await pg.locator('[data-aso-relier-numero="5"]').click();
  await pg.waitForTimeout(600);
  const pa5 = await pg.evaluate(() => { try { return (JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}') || {}).pa5 || null; } catch (_) { return null; } });
  dit(pa5 && pa5.buyFromId === '9100004' && pa5.buyPrice === '35,00', `${nom} · son tap écrit le lien et le prix payé`, JSON.stringify(pa5));
  const apres = await pg.$$eval('[data-aso-pel="9100004"]', (els) => els.map((e) => e.dataset.asoRelie));
  dit(apres.join() === '1' && await pg.locator('[data-aso-publier="9100004"]').count() === 1, `${nom} · relié mais pas en ligne : reste, avec « Mettre en ligne »`);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);

  // ── Lots
  await pg.locator('[data-aso-ouvrir="lots"]').click();
  await pg.locator('[data-aso-lot]').first().waitFor({ timeout: 20000 }).catch(() => {});
  const lots = await pg.$$eval('[data-aso-lot]', (els) => els.map((e) => e.getAttribute('data-aso-lot') + ':' + e.dataset.asoLotN));
  dit(lots.join() === '9100003:2', `${nom} · le lot (items_count 3 dans SA transaction) avec ses 2 N° reliés`, JSON.stringify(lots));
  await capture(pg, `${nom}-lots`);
  await pg.locator('[data-aso-repartir="9100003"]').click();
  await pg.locator('[data-aso-feuille="repartir"]').waitFor({ timeout: 5000 }).catch(() => {});
  const pre = await pg.$$eval('[data-aso-saisie]', (els) => els.map((e) => e.value));
  dit(pre.join('|') === '45,00|45,00', `${nom} · parts égales PROPOSÉES dans les cases`, pre.join('|'));
  const ecritAvant = await pg.evaluate(() => { const f = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); return [f.pa3 && f.pa3.buyPrice, f.pa4 && f.pa4.buyPrice]; });
  dit(ecritAvant[0] == null && ecritAvant[1] === '12', `${nom} · la proposition n'écrit rien`, JSON.stringify(ecritAvant));
  await pg.locator('[data-aso-saisie="0"]').fill('50');
  await pg.locator('[data-aso-saisie="1"]').fill('30');
  const reste = await pg.evaluate(() => { const f = document.querySelector('[data-aso-feuille="repartir"]'); return { reste: f.dataset.asoReste, juste: f.dataset.asoJuste, txt: document.querySelector('[data-aso-reste-txt]').innerText, dis: document.querySelector('[data-aso-enregistrer]').disabled }; });
  dit(reste.reste === '1000' && reste.juste === '' && /Reste 10/.test(reste.txt) && reste.dis, `${nom} · somme fausse : « Reste 10 € », Enregistrer grisé`, JSON.stringify(reste));
  await capture(pg, `${nom}-reste`);
  await pg.locator('[data-aso-saisie="1"]').fill('40');
  const juste = await pg.evaluate(() => ({ juste: document.querySelector('[data-aso-feuille="repartir"]').dataset.asoJuste, dis: document.querySelector('[data-aso-enregistrer]').disabled }));
  dit(juste.juste === '1' && !juste.dis, `${nom} · 50 + 40 = 90 : juste, Enregistrer actif`);
  await pg.locator('[data-aso-enregistrer]').click();
  await pg.waitForTimeout(400);
  await capture(pg, `${nom}-confirmer`);
  const ok2 = pg.locator('button:not([data-aso-enregistrer])', { hasText: /^Enregistrer$/ });
  dit(await ok2.count() >= 1, `${nom} · une confirmation liste les montants avant d'écrire`);
  await ok2.last().click().catch(() => {});
  await pg.waitForTimeout(700);
  const ecr = await pg.evaluate(() => { const f = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); const j = JSON.parse(localStorage.getItem('vrm_repartitions_lots') || '{}'); return { a: f.pa3 && f.pa3.buyPrice, b: f.pa4 && f.pa4.buyPrice, lot: f.pa3 && f.pa3.buyFrom && f.pa3.buyFrom.lot, j: !!j['9100003'] }; });
  dit(ecr.a === '50,00' && ecr.b === '40,00' && ecr.lot === true && ecr.j, `${nom} · enregistré : N°3 50 €, N°4 40 €, journal gardé`, JSON.stringify(ecr));
  await pg.locator('[data-aso-repartir="9100003"]').waitFor({ timeout: 5000 }).catch(() => {});
  dit(await pg.locator('[data-aso-lot="9100003"][data-aso-reparti="1"]').count() === 1, `${nom} · le lot dit « réparti »`);
  await pg.locator('[data-aso-repartir="9100003"]').click();
  await pg.locator('[data-aso-annuler-repartition]').waitFor({ timeout: 5000 }).catch(() => {});
  const relu = await pg.$$eval('[data-aso-saisie]', (els) => els.map((e) => e.value));
  dit(relu.join('|') === '50,00|40,00', `${nom} · la feuille rouverte montre SES parts`, relu.join('|'));
  await pg.locator('[data-aso-annuler-repartition]').click();
  await pg.waitForTimeout(300);
  await pg.locator('button', { hasText: /^Annuler la répartition$/ }).last().click().catch(() => {});
  await pg.waitForTimeout(700);
  const rendu = await pg.evaluate(() => { const f = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); const j = JSON.parse(localStorage.getItem('vrm_repartitions_lots') || '{}'); return { a: f.pa3 && f.pa3.buyPrice, b: f.pa4 && f.pa4.buyPrice, j: !!j['9100003'] }; });
  dit(rendu.a === '' && rendu.b === '12' && !rendu.j, `${nom} · « Annuler » rend l'état d'avant (N°3 vide, N°4 12 €)`, JSON.stringify(rendu));
  const deborde2 = await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  dit(!deborde2, `${nom} · aucun défilement horizontal`);
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  await passe(b, '390', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, false);
  await passe(b, '390-sombre', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, true);
  await passe(b, '1512', { viewport: { width: 1512, height: 950 } }, false);
  await passe(b, '1512-sombre', { viewport: { width: 1512, height: 950 } }, true);
  await b.close(); srv.close();
  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
