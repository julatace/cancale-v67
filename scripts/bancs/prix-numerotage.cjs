// ════════════════════════════════════════════════════════════════════════════
//  BANC « LE PRIX D'ACHAT AU NUMÉROTAGE » (6 nov., sa décision).
//  Constat : aucune des 56 annonces en ligne n'avait de prix d'achat. Le prix est
//  demandé au moment où la paire reçoit son N°, sans jamais bloquer ni deviner.
//
//  A. Un N° posé à la main (carte) ⇒ la feuille « Prix d'achat de la N°… » :
//     champ VIDE (jamais pré-rempli), suggestion d'achat PROPOSÉE à côté
//     (« Relier · 28,00 € » : marque + taille + achat antérieur) ;
//     « 25 € env. » ⇒ illisible, RIEN n'est écrit ; « Plus tard » ⇒ rien ;
//     « 18 » ⇒ buyPrice « 18,00 », lien vide, miroir par N° ; « Relier » ⇒ le lien
//     vers l'achat (buyFromId) et son prix, par l'écriture de « Relier un achat ».
//  B. « Mise en ligne numérotée par VRM » : chaque ligne porte un champ prix vide
//     et la suggestion ; « 32,5 » ⇒ « 32,50 » dans la fiche et dans le nuage.
//  C. Annonces → « Sans achat relié » → « Saisie en série » : un champ vidé
//     n'écrit rien, « 40 » ⇒ « 40,00 ».
//  D. Ma journée : UNE carte « N annonces numérotées sans prix d'achat ».
//  390 px tactile et 1512 px, clair et sombre. Données inventées, rien de réel.
//  BANC_PORT (10160 par défaut), BANC_DIST (dist par défaut), BANC_CAPTURES.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { routeMain, ecritesMain, attendre } = require('./_base-ecritures.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10160;
const CAPTURES = process.env.BANC_CAPTURES || path.join(require('os').tmpdir(), 'banc-prix-numerotage');
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}
const auj = new Date();
const ilYa = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const ann = (id, title, heures, brand, size) => ({ id, title, price: { amount: '59.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: brand, size_title: size, status: 'Très bon état', view_count: 3, favourite_count: 0, created_at_ts: Math.floor((Date.now() - heures * 3600e3) / 1000) });
const achat = (tx, title, prix, jours) => ({ transaction_id: tx, conversation_id: 8400000 + tx % 1000, title, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYa(jours * 24), photo: null });
// 9201 : publiée il y a 1 h, N°7 posé par VRM, sans prix (la ligne « mise en ligne »).
// 9210, 9211, 9212 : sans N°, sans prix — on les numérote à la main sur la carte.
// 9202 : N°5 avec un prix (25) — jamais redemandé.
const ITEMS = [
  ann(9201, 'Nike Air Max 90 blanche taille 42', 1, 'Nike', '42'),
  ann(9210, 'Adidas Samba noire taille 40', 72, 'Adidas', '40'),
  ann(9211, 'Asics Gel-Lyte III grise taille 43', 72, 'Asics', '43'),
  ann(9212, 'Puma Suede rouge taille 41', 72, 'Puma', '41'),
  ann(9202, 'Salomon XT-6 noire taille 41', 400, 'Salomon', '41'),
];
const ACHATS = [
  achat(7400001, 'Nike Air Max 90 blanche 42', 30, 20),     // antérieur à 9201 : LA suggestion
  achat(7400002, 'Adidas Samba noire 40', 28, 20),           // antérieur à 9210
  achat(7400003, 'Asics Gel-Lyte III grise 43', 35, 20),     // antérieur à 9211
];
const MAIN = () => ({
  vinted_annonce_numeros: {
    '9201': { numero: '7', auto: true, numberedAt: ilYa(1) },
    '9202': { numero: '5', auto: false, manuelAt: ilYa(300), numberedAt: ilYa(400), buyPrice: '25,00' },
  },
  vinted_buyprice_by_num: { 5: '25,00' },
  vinted_used_numeros: [1, 2, 3, 4, 5, 6, 7],
});
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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function ouvrir(b, { url, largeur, sombre }) {
  const base = { main: MAIN(), maj: new Date(Date.now() - 86400e3).toISOString(), ecritures: [] };
  const rows = [
    { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: auj.toISOString(), payload: { my_orders: ACHATS } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: [] } } },
  ];
  const mobile = largeur < 700;
  const ctx = await b.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
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
const fiche = async (pg, id) => (((await local(pg, 'vinted_annonce_numeros')) || {})[id] || {});
const toucher = async (pg, sel, mobile) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {}); if (mobile) await l.tap({ timeout: 8000 }); else await l.click({ timeout: 8000 }); };
const pasDeCote = (pg) => pg.evaluate(() => (document.scrollingElement || document.documentElement).scrollWidth <= window.innerWidth + 1);
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
const feuille = (pg) => pg.waitForSelector('[data-ask-champ="prix-numerotage"]', { timeout: 6000 }).then(() => true).catch(() => false);
const fermee = (pg) => pg.waitForSelector('[data-ask-champ="prix-numerotage"]', { state: 'detached', timeout: 6000 }).then(() => true).catch(() => false);
// Le bouton est cherché DANS la feuille (le bloc qui porte le champ) : sur ordinateur,
// un autre « Enregistrer » visible ailleurs dans la page prenait le clic.
const cliquerFeuille = async (pg, libelle) => {
  const bt = pg.locator('div:has(> form [data-ask-champ="prix-numerotage"])').last().locator('button', { hasText: libelle }).first();
  for (let k = 0; k < 2; k++) { await bt.click({ timeout: 4000 }).catch(() => {}); if (await fermee(pg)) return true; }
  // 1512 px sous swiftshader : le fond flouté de la feuille ralentit tant les images que
  // Playwright n'obtient jamais « stable » (le bouton, mesuré, ne bouge pas : top 888,
  // 44 px). Le geste du clavier d'ordinateur — Tab jusqu'au bouton, Entrée — est le même.
  await bt.focus().catch(() => {}); await pg.keyboard.press('Enter');
  return fermee(pg);
};
const numeroter = async (pg, id, n, mobile) => {
  await toucher(pg, `[data-carte-annonce="${id}"] [data-edition="numero"]`, mobile);
  await pg.keyboard.press('Control+A'); await pg.keyboard.type(String(n)); await pg.keyboard.press('Enter');
};

async function scenarioA(b, largeur, sombre) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'}`, cap = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\n── A. Un N° posé à la main ⇒ le prix d'achat demandé (${tag})`);
  const { pg, ctx, errs, base } = await ouvrir(b, { url: '/?tab=cat_annonces', largeur, sombre });
  try {
    await pg.waitForSelector('[data-carte-annonce="9210"]', { timeout: 20000 });
    // A1 : 9210 ← N°60 ; la feuille s'ouvre, champ vide, suggestion Adidas proposée.
    await numeroter(pg, 9210, 60, mobile);
    dit(await feuille(pg), `${tag} : poser N°60 ouvre « Prix d'achat de la N°60 ? »`);
    const etat = await pg.evaluate(() => { const i = document.querySelector('[data-ask-champ="prix-numerotage"]'); const s = document.querySelector('[data-ask-suggestion] [data-ask-relier]'); return { v: i ? i.value : null, im: i ? i.getAttribute('inputmode') : null, s: s ? s.innerText.trim() : null }; });
    dit(etat.v === '', `${tag} : le champ est VIDE (jamais pré-rempli)`, JSON.stringify(etat));
    dit(etat.im === 'decimal', `${tag} : clavier décimal (la virgule) au téléphone`, String(etat.im));
    dit(/^Relier · 28(,00)?\s€$/.test(etat.s || ''), `${tag} : la suggestion est PROPOSÉE à côté : « Relier · 28,00 € » (même marque, même taille, achetée avant)`, String(etat.s));
    await pg.locator('[data-ask-suggestion]').scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, `A-${cap}-feuille`);
    const petits = await pg.evaluate(() => [...document.querySelectorAll('[data-ask-suggestion] button, [role="dialog"] button, [data-ask-champ]')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43.5).map((e) => (e.innerText || e.placeholder || '').slice(0, 20)));
    dit(!mobile || petits.length === 0, `${tag} : boutons et champ de la feuille à 44 px`, petits.join(' | '));
    // Illisible : « 25 € env. » ⇒ rien n'est écrit.
    await pg.fill('[data-ask-champ="prix-numerotage"]', '25 € env.');
    const partie = await cliquerFeuille(pg, /^Enregistrer$/);
    await pg.waitForTimeout(700);
    let f = await fiche(pg, '9210');
    dit(partie && String(f.numero) === '60' && (f.buyPrice == null || f.buyPrice === '') && !f.buyFromId, `${tag} : « 25 € env. » + Enregistrer ⇒ illisible, la feuille se ferme, AUCUN prix écrit (le N° reste posé)`, JSON.stringify({ partie, f }));
    // A2 : 9212 ← N°61 ; « Plus tard » ⇒ rien.
    await numeroter(pg, 9212, 61, mobile);
    dit(await feuille(pg), `${tag} : N°61 ⇒ la feuille`);
    dit(await pg.locator('[data-ask-suggestion]').count() === 0, `${tag} : aucun achat Puma ⇒ aucune suggestion (jamais la marque d'à côté)`);
    await cliquerFeuille(pg, /^Plus tard$/);
    f = await fiche(pg, '9212');
    dit(String(f.numero) === '61' && !f.buyPrice && !f.buyFromId, `${tag} : « Plus tard » ⇒ rien n'est écrit, jamais bloquant`, JSON.stringify(f));
    // A3 : 9212 renuméroté N°62, on tape « 18 ».
    await numeroter(pg, 9212, 62, mobile);
    if (await feuille(pg)) { await pg.fill('[data-ask-champ="prix-numerotage"]', '18'); await cliquerFeuille(pg, /^Enregistrer$/); }
    await pg.waitForTimeout(900);
    f = await fiche(pg, '9212');
    const bbn = (await local(pg, 'vinted_buyprice_by_num')) || {};
    dit(f.buyPrice === '18,00' && f.buyFromId == null && f.buyFrom == null, `${tag} : « 18 » ⇒ buyPrice « 18,00 », aucun achat relié (l'écriture de la saisie en série)`, JSON.stringify(f));
    dit(bbn['62'] === '18,00', `${tag} : … et le miroir par N° (survit à la vente)`, JSON.stringify(bbn));
    // A4 : 9211 ← N°63, « Relier · 35,00 € ».
    await numeroter(pg, 9211, 63, mobile);
    if (await feuille(pg)) await cliquerFeuille(pg, /^Relier · 35/);
    await pg.waitForTimeout(900);
    f = await fiche(pg, '9211');
    dit(String(f.buyFromId) === '7400003' && /^35/.test(String(f.buyPrice)), `${tag} : « Relier » (SON tap) ⇒ l'achat 7400003 relié, son prix`, JSON.stringify({ n: f.numero, p: f.buyPrice, id: f.buyFromId }));
    f = await fiche(pg, '9202');
    dit(f.buyPrice === '25,00', `${tag} : la paire qui avait un prix n'est pas touchée`);
    await attendre(() => { const n = (base.main && base.main.vinted_annonce_numeros) || {}; return (n['9212'] || {}).buyPrice === '18,00' && String((n['9211'] || {}).buyFromId) === '7400003'; }, 10000);
    { const n = (base.main && base.main.vinted_annonce_numeros) || {};
      dit(ecritesMain(base).length > 0 && (n['9212'] || {}).buyPrice === '18,00' && !(n['9210'] || {}).buyPrice && String((n['9211'] || {}).buyFromId) === '7400003', `${tag} : le nuage garde 18,00 (tapé), le lien relié, et RIEN pour l'illisible`, JSON.stringify({ a: n['9210'] && n['9210'].buyPrice, b: n['9212'] && n['9212'].buyPrice, c: n['9211'] && n['9211'].buyFromId })); }
    dit(await pasDeCote(pg), `${tag} : aucune page qui défile de côté`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario A a tourné jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 600)); await capture(pg, `A-${cap}-erreur`); }
  finally { await ctx.close(); }
}

async function scenarioB(b, largeur, sombre) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'}`, cap = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\n── B. « Mise en ligne numérotée par VRM » et saisie en série (${tag})`);
  const { pg, ctx, errs, base } = await ouvrir(b, { url: '/?tab=cat_annonces', largeur, sombre });
  try {
    await pg.waitForSelector('[data-num-neufs-ouvrir]', { timeout: 20000 }).then(() => pg.click('[data-num-neufs-ouvrir]')).catch(() => {});
    const bloc = await pg.waitForSelector('[data-num-neuf="9201"] [data-num-neuf-prix]', { timeout: 8000 }).then(() => true).catch(() => false);
    dit(bloc, `${tag} : la ligne de la N°7 (numérotée par VRM) porte un champ « Prix d'achat »`);
    const champ = await pg.evaluate(() => { const i = document.querySelector('[data-prix-neuf="9201"]'); return i ? { v: i.value, ph: i.placeholder } : null; });
    dit(champ && champ.v === '' && /facultatif/.test(champ.ph), `${tag} : champ vide, « facultatif »`, JSON.stringify(champ));
    const rel = await pg.waitForSelector('[data-num-neuf="9201"] [data-num-neuf-relier]', { timeout: 8000 }).then((e) => e.innerText()).catch(() => '');
    dit(/^Relier · 30(,00)?\s€$/.test(rel.trim()), `${tag} : la suggestion Nike y est proposée : « Relier · 30,00 € »`, rel);
    await pg.locator('[data-num-neufs]').scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, `B-${cap}-mise-en-ligne`);
    const petits = await pg.evaluate(() => [...document.querySelectorAll('[data-num-neuf] button, [data-num-neuf-prix] label')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43.5).map((e) => (e.innerText || '').slice(0, 20)));
    dit(!mobile || petits.length === 0, `${tag} : 44 px au doigt sur la ligne`, petits.join(' | '));
    dit(await pasDeCote(pg), `${tag} : aucune page qui défile de côté (ligne à deux rangées)`);
    await toucher(pg, '[data-prix-neuf="9201"]', mobile);
    await pg.keyboard.type('32,5'); await pg.keyboard.press('Enter');
    await pg.waitForTimeout(900);
    const f = await fiche(pg, '9201');
    dit(f.buyPrice === '32,50' && f.buyFromId == null && String(f.numero) === '7', `${tag} : « 32,5 » ⇒ « 32,50 » dans la fiche, le N° inchangé`, JSON.stringify(f));
    dit(await pg.getAttribute('[data-num-neuf="9201"] [data-num-neuf-prix]', 'data-num-neuf-prix').catch(() => null) === 'connu', `${tag} : la ligne dit le prix connu`);
    await attendre(() => ((((base.main || {}).vinted_annonce_numeros) || {})['9201'] || {}).buyPrice === '32,50', 10000);
    dit(((((base.main || {}).vinted_annonce_numeros) || {})['9201'] || {}).buyPrice === '32,50', `${tag} : le nuage garde 32,50`);
    await capture(pg, `B-${cap}-prix-pose`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario B a tourné jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 600)); await capture(pg, `B-${cap}-erreur`); }
  finally { await ctx.close(); }
}

async function scenarioC(b, largeur, sombre) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'}`, cap = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
  console.log(`\n── C. Ma journée, « Sans achat relié » et la saisie en série (${tag})`);
  const { pg, ctx, errs } = await ouvrir(b, { url: '/', largeur, sombre });
  try {
    const job = await pg.waitForSelector('[data-job="achat-a-relier"]', { timeout: 20000 }).then(() => true).catch(() => false);
    const j = await pg.evaluate(() => { const e = document.querySelectorAll('[data-job="achat-a-relier"]'); const autres = [...document.querySelectorAll('[data-job]')].filter((x) => /prix d.achat/i.test(x.innerText) && x.getAttribute('data-job') !== 'achat-a-relier').length; return { n: e.length, val: e[0] ? e[0].getAttribute('data-n') : null, txt: e[0] ? e[0].innerText.replace(/\s+/g, ' ') : '', autres }; });
    dit(job && j.n === 1 && j.val === '4' && /4 annonces numérotées sans prix d.achat/.test(j.txt), `${tag} : Ma journée : UNE carte « 4 annonces numérotées sans prix d’achat » (la N°7 et les 3 numérotées toutes seules au chargement)`, JSON.stringify(j));
    dit(j.autres === 0, `${tag} : aucune seconde carte sur le même sujet`);
    await pg.locator('[data-job="achat-a-relier"]').first().scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, `C-${cap}-journee`);
    await toucher(pg, '[data-job="achat-a-relier"]', mobile);
    const file = await pg.waitForSelector('[data-ar-serie]', { timeout: 15000 }).then(() => true).catch(() => false);
    dit(file, `${tag} : « Voir » ⇒ la file « Sans achat relié », qui porte « Saisie en série »`);
    await capture(pg, `C-${cap}-file`);
    await toucher(pg, '[data-ar-serie]', mobile);
    const serie = await pg.waitForSelector('[data-fillbuy-feuille] [data-fillbuy="0"]', { timeout: 8000 }).then(() => true).catch(() => false);
    dit(serie, `${tag} : « Saisie en série » ouvre la saisie en série`);
    if (serie) {
      const cle = '9201';
      // Un champ tapé puis vidé : rien.
      await toucher(pg, '[data-fillbuy="0"]', mobile); await pg.keyboard.type('12'); await pg.keyboard.press('Backspace'); await pg.keyboard.press('Backspace'); await pg.keyboard.press('Tab');
      await pg.waitForTimeout(500);
      let f = await fiche(pg, cle);
      dit(f.buyPrice == null || f.buyPrice === '', `${tag} : un champ vidé n'écrit rien`, JSON.stringify(f));
      await toucher(pg, '[data-fillbuy="0"]', mobile); await pg.keyboard.type('40'); await pg.keyboard.press('Enter');
      await pg.waitForTimeout(800);
      f = await fiche(pg, cle);
      dit(f.buyPrice === '40,00' && f.buyFromId == null, `${tag} : « 40 » ⇒ « 40,00 » (la même écriture que le numérotage)`, JSON.stringify(f));
      await capture(pg, `C-${cap}-serie`);
    }
    dit(await pasDeCote(pg), `${tag} : aucune page qui défile de côté`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${tag} : le scénario C a tourné jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 600)); await capture(pg, `C-${cap}-erreur`); }
  finally { await ctx.close(); }
}

(async () => {
  let b;
  await new Promise((res) => srv.listen(PORT, res));
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [largeur, sombre] of [[390, false], [1512, false], [390, true], [1512, true]]) {
      await scenarioA(b, largeur, sombre);
      await scenarioB(b, largeur, sombre);
      await scenarioC(b, largeur, sombre);
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\nCaptures : ${CAPTURES}`);
  console.log(ko ? `\n❌ Prix d'achat au numérotage : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ Prix d'achat au numérotage : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
