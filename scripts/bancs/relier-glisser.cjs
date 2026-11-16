// ════════════════════════════════════════════════════════════════════════════
// BANC : RELIER EN GLISSANT (16 nov., lot relier-glisser)
//        node scripts/bancs/relier-glisser.cjs
// ════════════════════════════════════════════════════════════════════════════
// Julien : « faire comme quand on reste appuyé sur une app sur iPhone : ça vibre, et après tu places
// [l'achat] sur la vente ou l'annonce ». Jugé sur l'app RENDUE :
//   390 tactile — VRAIS évènements tactiles (CDP `Input.dispatchTouchEvent`, qui produit touch ET
//   pointer et laisse le navigateur défiler) :
//     défile   un doigt qui file sur la liste des achats : la liste DÉFILE, aucun achat ne se lève ;
//     vide     appui long ⇒ l'achat se lève (capture pendant) ; lâché dans le vide ⇒ aucune question, rien écrit ;
//     bord     levé près du bas de la liste cible ⇒ elle défile toute seule ;
//     relier   appui long + glisser sur l'annonce N°2 ⇒ elle s'éclaire (capture), « Relier N°2 à cet
//              achat de 40,00 € ? » ; « Oui » ⇒ le lien est sur la fiche N°2 (son identifiant), aucune autre ;
//     annuler  « Annuler » de la pilule ⇒ le lien est retiré, l'annonce revient dans la liste.
//   1512 souris — glisser à la souris (même jugement), molette sur la liste ⇒ aucun glisser ; clavier :
//   choisir un achat (Entrée), « Relier ici » ⇒ la même question.
// Base INVENTÉE (dépôt PUBLIC). Un banc ne meurt pas, il rapporte. `BANC_DIST=` le build ; `SHOTS=` les captures.
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const sc = require('./_scenario-colis.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (21000 + Math.floor(Math.random() * 18000));
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-relier-glisser');
fs.mkdirSync(SHOTS, { recursive: true });
const J = 86400e3, U = sc.UID[0];
const MODELES = ['Adidas Spezial noir 42', 'Nike Air Force 1 blanc 43', 'Asics Gel Kayano 14 argent 44', 'New Balance 550 blanc vert 41', 'Salomon XT-6 noir 42', 'Puma Suede bleu 40',
  'Nike Dunk Low panda 39', 'Adidas Samba OG 38', 'Vans Old Skool noir 41', 'Converse Chuck 70 beige 42', 'Reebok Club C 43', 'Onitsuka Tiger Mexico 66 jaune 40', 'Asics Gel 1130 blanc 42', 'Nike Air Max 90 gris 44'];
const annonces = MODELES.map((t, i) => ({ ...sc.annonce({ id: 'pa' + i, titre: t, prix: 70 + i, taille: 42, marque: t.split(' ')[0] }), created_at_ts: Math.floor((sc.NOW - (20 + i) * J) / 1000) }));
const fiches = Object.fromEntries(annonces.map((a, i) => ['pa' + i, { numero: String(i + 1), title: a.title, price: 70 + i }]));
const achat = (i, titre, prix = 40) => sc.ordre({ tx: String(7100001 + i), conv: 'c' + i, titre, prix, statut: sc.STATUT_FINAL, dateMs: sc.NOW - (40 + i) * J });
const ACHATS = ['Nike Air Force 1 blanche 43', 'Converse basse', 'Paire running', 'Lot chaussures', 'Baskets cuir', 'Chaussures ville', 'Sneakers montantes', 'Tennis toile',
  'Baskets daim', 'Chaussures sport', 'Mocassins', 'Bottines'].map((t, i) => achat(i, i === 3 ? 'Baskets sans marque' : t, 40 + i));
const vente = sc.ordre({ tx: '7200001', titre: 'Salomon Speedcross gris 43', prix: 90, statut: sc.STATUT_FINAL, dateMs: sc.NOW - 5 * J });
const main = (sombre) => sc.ligneMain({ vinted_dark: sombre, vinted_annonce_numeros: fiches });
const rows = [{ ...sc.ligneListings(U, annonces), data: { capturedAt: new Date(sc.NOW - 60e3).toISOString(), payload: { items: annonces, pagination: null } } }, sc.lignePurch(U, ACHATS), sc.ligneSold(U, [vente])];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const T1 = '7100001';

async function ouvrir(b, nom, ctxOpts, sombre) {
  const ctx = await b.newContext({ locale: 'fr-FR', ...ctxOpts });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (sb) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, sombre);
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(sc.comptes ? sc.comptes() : []);
    if (/id=eq\.main/.test(u)) return j(main(sombre));
    const eq = /id=eq\.([^&]*)/.exec(u); if (eq) return j(rows.filter((r) => r.id === eq[1]));
    const m = /id=like\.([^&]*)/.exec(u); if (m) { const re = new RegExp('^' + m[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=achats&site=vinted`, { waitUntil: 'domcontentloaded' });
  const bouton = pg.locator('[data-glisser-ouvrir="achats"]').first();
  await bouton.waitFor({ timeout: 25000 }).catch(() => {});
  dit(await bouton.count() > 0, `${nom} · Achats : « Relier en glissant » est là`);
  if (!(await bouton.count())) { await pg.screenshot({ path: path.join(SHOTS, `relier-glisser-${nom}-ko.png`), fullPage: true }); return { ctx, pg, errs, ko: true }; }
  await bouton.click();
  await pg.locator(`[data-glisser-achat="${T1}"]`).waitFor({ timeout: 20000 }).catch(() => {});
  await pg.locator('[data-glisser-cible="a:pa1"]').waitFor({ timeout: 10000 }).catch(() => {});
  dit(await pg.locator('[data-relier-glisser]').count() === 1, `${nom} · le mode s'ouvre en plein écran`);
  const nA = Number(await pg.locator('[data-glisser-achats]').getAttribute('data-glisser-achats').catch(() => '0'));
  const nC = Number(await pg.locator('[data-glisser-cibles]').getAttribute('data-glisser-cibles').catch(() => '0'));
  dit(nA === ACHATS.length && nC === MODELES.length + 1, `${nom} · ${ACHATS.length} achats libres, ${MODELES.length} annonces + 1 vente sans achat`, `${nA} / ${nC}`);
  return { ctx, pg, errs };
}
const centre = async (pg, sel) => { const bb = await pg.locator(sel).first().boundingBox(); return bb ? { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, bb } : null; };
const lien = (pg, id) => pg.evaluate((k) => { try { const f = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); return f[k] ? (f[k].buyFromId || '') : null; } catch (_) { return null; } }, id);
const liensTous = (pg) => pg.evaluate(() => { try { const f = JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); return Object.entries(f).filter(([, v]) => v && v.buyFromId).map(([k, v]) => `${k}:${v.buyFromId}`); } catch (_) { return null; } });

async function tactile(b) {
  const nom = '390';
  console.log(`\n── ${nom} (doigt)`);
  const o = await ouvrir(b, nom, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, false);
  if (o.ko) { await o.ctx.close(); return; }
  const { pg, errs } = o;
  const cdp = await o.ctx.newCDPSession(pg);
  const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y), id: 1 }] });
  const pause = (ms) => pg.waitForTimeout(ms);
  await pg.screenshot({ path: path.join(SHOTS, `relier-glisser-${nom}-ouvert.png`) });
  // ── défile : un doigt qui file vers le haut sur la liste des achats ──
  const a3 = await centre(pg, '[data-glisser-achat="7100003"]');
  const sc0 = await pg.evaluate(() => document.querySelector('[data-glisser-achats]').scrollTop);
  let leveVu = false;
  await t('touchStart', a3.x, a3.y + 60);
  for (let i = 1; i <= 6; i++) { await t('touchMove', a3.x, a3.y + 60 - i * 30); await pause(16); if (await pg.locator('[data-glisser-flotte]').count()) leveVu = true; }
  await t('touchEnd'); await pause(500);
  const sc1 = await pg.evaluate(() => document.querySelector('[data-glisser-achats]').scrollTop);
  dit(!leveVu && !(await pg.locator('[data-glisser-flotte]').count()), `${nom} · défilement rapide : aucun achat ne se lève`);
  dit(sc1 > sc0 + 20, `${nom} · …et la liste des achats DÉFILE normalement`, `${sc0} → ${sc1}`);
  dit(!(await pg.locator('[data-glisser-question]').count()), `${nom} · …aucune question posée`);
  await pg.evaluate(() => { document.querySelector('[data-glisser-achats]').scrollTop = 0; }); await pause(200);
  // ── vide : appui long, lâché dans le vide ──
  let a1 = await centre(pg, `[data-glisser-achat="${T1}"]`);
  await t('touchStart', a1.x, a1.y); await pause(650);
  const flotte = await pg.locator(`[data-glisser-flotte="${T1}"]`).count();
  dit(flotte === 1, `${nom} · appui long (650 ms) : l'achat se lève`);
  const tete = await centre(pg, '.vrm-rg-tete');
  for (let i = 1; i <= 8; i++) { await t('touchMove', a1.x, a1.y - (a1.y - tete.y) * i / 8); await pause(16); }
  await pg.screenshot({ path: path.join(SHOTS, `relier-glisser-${nom}-leve-vide.png`) });
  await t('touchEnd'); await pause(400);
  dit(!(await pg.locator('[data-glisser-question]').count()) && !(await pg.locator('[data-glisser-flotte]').count()), `${nom} · lâché dans le vide : rien (aucune question, l'achat retombe)`);
  dit(JSON.stringify(await liensTous(pg)) === '[]', `${nom} · …rien n'est écrit`, JSON.stringify(await liensTous(pg)));
  // ── bord : levé près du bas de la liste cible ⇒ elle défile seule ──
  a1 = await centre(pg, `[data-glisser-achat="${T1}"]`);
  const lc = await pg.evaluate(() => { const r = document.querySelector('[data-glisser-cibles]').getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
  const scC0 = await pg.evaluate(() => document.querySelector('[data-glisser-cibles]').scrollTop);
  await t('touchStart', a1.x, a1.y); await pause(650);
  for (let i = 1; i <= 8; i++) { await t('touchMove', a1.x, a1.y + (lc.bottom - 12 - a1.y) * i / 8); await pause(16); }
  await pause(700);
  const scC1 = await pg.evaluate(() => document.querySelector('[data-glisser-cibles]').scrollTop);
  dit(scC1 > scC0 + 40, `${nom} · près du bord bas de la liste cible : elle défile toute seule`, `${scC0} → ${scC1}`);
  for (let i = 1; i <= 6; i++) { await t('touchMove', a1.x, lc.bottom - 12 - (lc.bottom - 12 - lc.top - 10) * i / 6); await pause(16); }
  await pause(900);   // remonte (bord haut) jusqu'en haut
  await t('touchMove', 20, 30); await t('touchEnd'); await pause(300);
  await pg.evaluate(() => { document.querySelector('[data-glisser-cibles]').scrollTop = 0; }); await pause(200);
  // ── relier : glisser sur l'annonce N°2 ──
  a1 = await centre(pg, `[data-glisser-achat="${T1}"]`);
  const c2 = await centre(pg, '[data-glisser-cible="a:pa1"]');
  await t('touchStart', a1.x, a1.y); await pause(650);
  for (let i = 1; i <= 12; i++) { await t('touchMove', a1.x + (c2.x - a1.x) * i / 12, a1.y + (c2.y - a1.y) * i / 12); await pause(20); }
  await pause(150);
  const eclaire = await pg.locator('[data-glisser-cible="a:pa1"][data-glisser-survol="1"]').count();
  dit(eclaire === 1, `${nom} · au-dessus de l'annonce N°2 : elle s'éclaire`);
  dit(await pg.locator('[data-glisser-survol="1"]').count() === 1, `${nom} · …et elle seule`);
  await pg.screenshot({ path: path.join(SHOTS, `relier-glisser-${nom}-pendant.png`) });
  await t('touchEnd'); await pause(400);
  const q = await pg.locator('[data-glisser-question]').getAttribute('data-glisser-question').catch(() => null);
  const qt = await pg.locator('.vrm-rg-question-texte').innerText().catch(() => '');
  dit(q === `${T1}>a:pa1`, `${nom} · lâché : la question porte CET achat et CETTE annonce`, String(q));
  dit(/^Relier N°2 à cet achat de 40,00\s€ \?$/.test(qt.replace(/\u00a0|\u202f/g, ' ')), `${nom} · « Relier N°2 à cet achat de 40,00 € ? »`, JSON.stringify(qt));
  dit(JSON.stringify(await liensTous(pg)) === '[]', `${nom} · rien n'est écrit avant « Oui »`);
  await pg.screenshot({ path: path.join(SHOTS, `relier-glisser-${nom}-question.png`) });
  await pg.locator('[data-glisser-oui]').tap(); await pause(900);
  dit(await lien(pg, 'pa1') === T1, `${nom} · « Oui » : la fiche N°2 porte le lien vers ${T1}`, String(await lien(pg, 'pa1')));
  dit(JSON.stringify(await liensTous(pg)) === JSON.stringify([`pa1:${T1}`]), `${nom} · …et aucune autre fiche`, JSON.stringify(await liensTous(pg)));
  dit(!(await pg.locator('[data-glisser-cible="a:pa1"]').count()) && !(await pg.locator(`[data-glisser-achat="${T1}"]`).count()), `${nom} · l'annonce et l'achat sortent des listes`);
  await pg.screenshot({ path: path.join(SHOTS, `relier-glisser-${nom}-relie.png`) });
  // ── annuler ──
  const an = pg.locator('[data-pilule-annuler]').first();
  await an.waitFor({ timeout: 3000 }).catch(() => {});
  dit(await an.count() === 1, `${nom} · la pilule « Annuler » est là (5 s)`);
  if (await an.count()) { await an.tap().catch(() => an.click()); await pause(900); }
  dit(!(await lien(pg, 'pa1')), `${nom} · « Annuler » : le lien est retiré`, String(await lien(pg, 'pa1')));
  dit(await pg.locator('[data-glisser-cible="a:pa1"]').count() === 1, `${nom} · …l'annonce revient dans la liste`);
  dit(!(await pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), `${nom} · aucun défilement horizontal`);
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
  await o.ctx.close();
}

async function souris(b) {
  const nom = '1512-sombre';
  console.log(`\n── ${nom} (souris, clavier)`);
  const o = await ouvrir(b, nom, { viewport: { width: 1512, height: 950 }, colorScheme: 'dark' }, true);
  if (o.ko) { await o.ctx.close(); return; }
  const { pg, errs } = o;
  await pg.screenshot({ path: path.join(SHOTS, `relier-glisser-${nom}-ouvert.png`) });
  const cote = await pg.evaluate(() => { const a = document.querySelector('.vrm-rg-achats').getBoundingClientRect(), c = document.querySelector('.vrm-rg-cibles').getBoundingClientRect(); return a.right <= c.left + 1; });
  dit(cote, `${nom} · ordinateur : achats à gauche, annonces et ventes à droite`);
  // molette : aucun glisser
  const a5 = await centre(pg, '[data-glisser-achat="7100005"]');
  await pg.mouse.move(a5.x, a5.y); await pg.mouse.wheel(0, 300); await pg.waitForTimeout(300);
  dit(!(await pg.locator('[data-glisser-flotte]').count()), `${nom} · molette sur la liste : aucun glisser`);
  // lâché dans le vide
  let a1 = await centre(pg, `[data-glisser-achat="${T1}"]`);
  await pg.mouse.move(a1.x, a1.y); await pg.mouse.down(); await pg.mouse.move(a1.x + 40, a1.y + 10, { steps: 4 });
  dit(await pg.locator(`[data-glisser-flotte="${T1}"]`).count() === 1, `${nom} · à la souris, un glisser franc lève l'achat`);
  await pg.mouse.move(a1.x, 20, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(300);
  dit(!(await pg.locator('[data-glisser-question]').count()) && JSON.stringify(await liensTous(pg)) === '[]', `${nom} · lâché dans le vide : rien`);
  // relier sur la VENTE (sans fiche) — puis Annuler
  a1 = await centre(pg, `[data-glisser-achat="${T1}"]`);
  const cv = await centre(pg, '[data-glisser-cible="v:7200001"]');
  await pg.mouse.move(a1.x, a1.y); await pg.mouse.down(); await pg.mouse.move(cv.x, cv.y, { steps: 14 }); await pg.waitForTimeout(150);
  dit(await pg.locator('[data-glisser-cible="v:7200001"][data-glisser-survol="1"]').count() === 1, `${nom} · au-dessus de la vente : elle s'éclaire`);
  await pg.screenshot({ path: path.join(SHOTS, `relier-glisser-${nom}-pendant.png`) });
  await pg.mouse.up(); await pg.waitForTimeout(300);
  dit(/« Salomon Speedcross gris 43 »/.test(await pg.locator('.vrm-rg-question-texte').innerText().catch(() => '')), `${nom} · la question nomme la vente (sans N°)`);
  await pg.locator('[data-glisser-oui]').click(); await pg.waitForTimeout(900);
  const ov = await pg.evaluate(() => { try { const v = JSON.parse(localStorage.getItem('vinted_sale_overrides') || '{}'); return v['7200001'] ? v['7200001'].buyFromId : ''; } catch (_) { return null; } });
  dit(ov === T1, `${nom} · « Oui » : la vente (son n° de transaction) porte le lien`, String(ov));
  const an = pg.locator('[data-pilule-annuler]').first(); await an.waitFor({ timeout: 3000 }).catch(() => {});
  if (await an.count()) { await an.click(); await pg.waitForTimeout(900); }
  const ov2 = await pg.evaluate(() => { try { const v = JSON.parse(localStorage.getItem('vinted_sale_overrides') || '{}'); return v['7200001'] ? (v['7200001'].buyFromId || '') : ''; } catch (_) { return null; } });
  dit(ov2 === '', `${nom} · « Annuler » : le lien de la vente est retiré`, String(ov2));
  // clavier : choisir un achat, « Relier ici »
  await pg.locator(`[data-glisser-achat="${T1}"]`).focus(); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
  dit(await pg.locator(`[data-glisser-achat="${T1}"][aria-pressed="true"]`).count() === 1, `${nom} · clavier : Entrée choisit l'achat`);
  const ici = pg.locator('[data-glisser-ici="a:pa1"]');
  dit(await ici.count() === 1, `${nom} · …chaque cible offre « Relier ici »`);
  if (await ici.count()) { await ici.focus(); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300); }
  dit(await pg.locator('[data-glisser-question]').getAttribute('data-glisser-question').catch(() => null) === `${T1}>a:pa1`, `${nom} · …la même question (rien relié avant « Oui »)`);
  await pg.screenshot({ path: path.join(SHOTS, `relier-glisser-${nom}-clavier.png`) });
  await pg.locator('[data-glisser-non]').click(); await pg.waitForTimeout(200);
  dit(!(await pg.locator('[data-glisser-question]').count()) && JSON.stringify(await liensTous(pg)) === '[]', `${nom} · « Annuler » de la question : rien écrit`);
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
  await o.ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const passes = String(process.env.PASSES || '390,1512').split(',');
  if (passes.includes('390')) await tactile(b);
  if (passes.includes('1512')) await souris(b);
  await b.close(); srv.close();
  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
