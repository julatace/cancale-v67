// Banc : LOT L (10 nov.) — CALCULETTE D'ACHAT · STOCK D'EMBALLAGES · HISTORIQUE DE PRIX.
//
// Rend les VRAIS écrans sur des données INVENTÉES (le dépôt est public), en 390 px tactile
// (clair puis sombre) et 1512 px (clair puis sombre), et exige — data-* et nombres rendus :
//   S1 Stock : « Emballages » → Ajouter (Boîte, 3, 0,80 €, seuil 2) ⇒ reste 3, pas d'alerte,
//      `vrm_emballages` écrit par SON clic ;
//   C1 Colis → « Préparer mes colis » → « Colis fait » (5 s) ⇒ `vinted_ship_done` de CETTE vente ;
//      le 2e « Colis fait » puis « Annuler » ⇒ rien d'écrit ;
//   S2 Stock : reste 2 = au seuil ⇒ AMBRE (jamais rouge), « Plus que 2 » ; l'emballage annulé
//      n'est pas décompté ;
//   V1 Ventes → récap d'une vente → « Emballage · non saisi » : la puce « Boîte · 0,80 € »
//      remplit le champ (rien n'est écrit avant « OK ») ; « OK » ⇒ `emballage: '0.80'` ;
//   K1 Achats → « Calculette » : 60 € / 120 € / Vinted / 0,80 € ⇒ 59,20 € exact ; Vestiaire ⇒
//      « au plus » ; la puce de SES emballages est là ; rien n'est écrit ;
//   K2 ⌘K « calculette » ouvre la même feuille ;
//   F1 fiche paire du N°11 : l'escalier des prix (110 → 100 lus, puis 95 lu par cette lecture),
//      les prix lus datés dans l'étape Prix ;
//   partout : aucun débordement horizontal, cibles ≥ 44 px, aucune erreur.
// Lancer : npm run build && BANC_PORT=$((40000+RANDOM%20000)) node scripts/bancs/calculette-emballages.cjs
// Captures : <tmp>/calc-emb-{390,1512}-{clair,sombre}-{stock,calculette,fiche,vente,preparer}.png
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4398;
const CAP = process.env.BANC_CAPTURES || os.tmpdir();

const MS = Date.now(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const A = '111';
const img = (k) => ({ url: `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x` });
const TITRE = 'Nike Air Max 90 blanche';
const aEnvoyer = (id, k) => ({ transaction_id: id, title: TITRE, size_title: '42', user_login: `acheteur_${k}`, price: { amount: '50', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: iso(MS - J - k * 60000), photo: img(k) });
const VENTES = [aEnvoyer(9201, 1), aEnvoyer(9202, 2),
  { transaction_id: 7102, title: 'Adidas Samba OG noir', price: { amount: '90', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(MS - 3 * J), photo: img(3) }];
const OV = { 9201: { numero: '31' }, 9202: { numero: '32' }, 7102: { buyPrice: '50', fraisComplets: true } };
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const bord = (tx, suivi) => ({ id: 'email_bord_' + tx, data: { transaction: String(tx), uid: A, filename: 'bordereau-' + tx + '.pdf', modele: TITRE, article: TITRE, receivedAt: iso(MS - 3600000), pdfB64: PDF_B64, suivi } });
const ITEM = { id: 901, url: 'https://www.vinted.fr/items/901', title: 'Nike Dunk Low panda 42', brand: 'Nike', size: '42', price: { amount: '95.0', currency_code: 'EUR' }, photo: img(4),
  created_at_ts: Math.floor((MS - 20 * J) / 1000), is_closed: false, is_draft: false, is_hidden: false, favourite_count: 1, view_count: 12 };
const NUMEROS = { 901: { numero: '11', buyPrice: '45' } };
// L'historique déjà noté (inventé) : 110 € lu il y a 12 j, 100 € lu il y a 6 j.
const PRIX_LUS = { v: 1, debut: iso(MS - 14 * J).slice(0, 10), a: { 901: [[MS - 12 * J, 11000], [MS - 6 * J, 10000]] } };
const LIGNES = [
  bord(9201, 'XA100000001FR'), bord(9202, 'XA100000002FR'),
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: iso(MS), payload: { my_orders: VENTES } } },
  { id: `harvest_${A}_orders_purchased`, data: { capturedAt: iso(MS), payload: { my_orders: [] } } },
  { id: `harvest_${A}_listings`, data: { uid: A, type: 'listings', nItems: 1, capturedAt: iso(MS), payload: { items: [ITEM], pagination: { total_entries: 1 } } } },
];
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'boutique_test', domain: 'www.vinted.fr', updated_at: iso(MS) }];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 220)); } };
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = iso(MS); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${['#dfe3e8', '#e8e1d8', '#dfe5dd', '#e6dcdc', '#e2dfe8'][k % 5]}"/><path d="M60 250 C80 190 150 175 190 200 C230 222 285 205 330 232 C352 246 346 282 306 284 L84 284 C62 284 52 268 60 250 Z" fill="rgba(30,34,40,.62)"/></svg>`;
const AMBRES = ['rgb(178, 80, 0)', 'rgb(255, 179, 64)', 'rgb(255, 159, 10)', 'rgb(201, 52, 0)'];
const ROUGES = ['rgb(215, 0, 21)', 'rgb(255, 59, 48)', 'rgb(255, 69, 58)', 'rgb(255, 105, 97)'];

const ouvrir = async (b, tel, sombre) => {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ s, ov, n, pl }) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
    if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1');
    localStorage.setItem('vinted_sale_overrides', JSON.stringify(ov)); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n)); localStorage.setItem('vrm_prix_lus', JSON.stringify(pl));
  } catch (_) {} }, { s: !!sombre, ov: OV, n: NUMEROS, pl: PRIX_LUS });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const m = /images1\.vinted\.net\/t\/b(\d+)\//.exec(r.request().url());
    if (m) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(Number(m[1])) });
    return ['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(MS), cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => (r.data[k] == null) === !non);
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};
const lire = (pg, k) => pg.evaluate((cle) => { try { return JSON.parse(localStorage.getItem(cle) || 'null'); } catch (_) { return 'illisible'; } }, k);
const toucher = async (pg, tel, loc) => { await loc.scrollIntoViewIfNeeded().catch(() => {}); if (tel) await loc.tap(); else await loc.click(); };
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const petites = (pg, racine) => pg.evaluate((r) => { const s = document.querySelector(r); return s ? [...s.querySelectorAll('button, input')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().height < 43.5).map((e) => (e.getAttribute('data-calc-site-choix') || e.getAttribute('data-emb-type') || e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().height)) : ['absent']; }, racine);
const etatEmb = (pg) => pg.evaluate(() => { const l = document.querySelector('[data-emb-type]'); if (!l) return null; const n = l.querySelector('.vrm-emb2-n'); const a = document.querySelector('[data-emb-alerte-txt]');
  return { restant: l.getAttribute('data-emb-restant'), alerte: l.getAttribute('data-emb-alerte'), couleur: n ? getComputedStyle(n).color : '', alerteTxt: a ? a.textContent : '', alerteCouleur: a ? getComputedStyle(a).color : '' }; });

async function scenario(b, tel, sombre) {
  const T = `${tel ? 390 : 1512} ${sombre ? 'sombre' : 'clair'}`, C = (n) => path.join(CAP, `calc-emb-${tel ? 390 : 1512}-${sombre ? 'sombre' : 'clair'}-${n}.png`);
  const r = await ouvrir(b, tel, sombre); const pg = r.pg;
  const aller = (q) => pg.evaluate((q) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: q })), q);
  try {
    await pg.waitForSelector('[data-vrm-ready], .vrm-annonce, [data-annonce-id], main', { timeout: 30000 }).catch(() => {});
    await pg.waitForTimeout(2500);

    await essaie(`${T} S1`, async () => {
      await aller('?tab=garage');
      await pg.waitForSelector('[data-emb-ajouter]', { timeout: 20000 });
      await toucher(pg, tel, pg.locator('[data-emb-ajouter]').first());
      await pg.waitForSelector('[data-emballage-feuille="nouveau"]', { timeout: 8000 });
      await pg.fill('[data-emb-champ="nom"]', 'Boîte'); await pg.fill('[data-emb-champ="n"]', '3'); await pg.fill('[data-emb-champ="cout"]', '0,80'); await pg.fill('[data-emb-champ="seuil"]', '2');
      dit(!(await petites(pg, '[data-emballage-feuille]')).length, `${T} S1 la feuille : champs et boutons ≥ 44 px`, JSON.stringify(await petites(pg, '[data-emballage-feuille]')));
      await pg.screenshot({ path: C('emballage-feuille') });
      await toucher(pg, tel, pg.locator('[data-emb-enregistrer]').first());
      await pg.waitForTimeout(900);
      const e = await etatEmb(pg); const reg = await lire(pg, 'vrm_emballages');
      dit(e && e.restant === '3' && e.alerte === '0' && reg && reg.types && reg.types[0].nom === 'Boîte' && reg.types[0].compte.n === 3 && reg.types[0].cout === '0,80' && reg.types[0].seuil === 2,
        `${T} S1 Ajouter : Boîte, reste 3, pas d’alerte, écrit par SON clic`, JSON.stringify({ e, reg }));
    });

    await essaie(`${T} C1`, async () => {
      await aller('?tab=cat_bord');
      await pg.waitForSelector('[data-preparer-ouvrir]', { timeout: 20000 });
      await toucher(pg, tel, pg.locator('[data-preparer-ouvrir]').first());
      await pg.waitForSelector('[data-preparer-cle]', { timeout: 8000 });
      const cle1 = await pg.getAttribute('[data-preparer-cle]', 'data-preparer-cle');
      await pg.screenshot({ path: C('preparer') });
      await toucher(pg, tel, pg.locator('[data-preparer-fait]').first());
      await pg.waitForFunction((k) => { try { return !!(JSON.parse(localStorage.getItem('vinted_ship_done') || '{}') || {})[k]; } catch (_) { return false; } }, cle1.slice(2), { timeout: 12000 });
      await toucher(pg, tel, pg.locator('[data-preparer-suivant]').first());
      await pg.waitForTimeout(300);
      const cle2 = await pg.getAttribute('[data-preparer-cle]', 'data-preparer-cle');
      await toucher(pg, tel, pg.locator('[data-preparer-fait]').first());
      await pg.waitForTimeout(500);
      await toucher(pg, tel, pg.locator('[data-preparer-annuler]').first());
      await pg.waitForTimeout(6000);
      const sd = await lire(pg, 'vinted_ship_done') || {};
      dit(cle1 !== cle2 && !!sd[cle1.slice(2)] && !sd[cle2.slice(2)], `${T} C1 « Colis fait » écrit SA vente ; « Colis fait » + « Annuler » n’écrit rien`, JSON.stringify({ cle1, cle2, sd }));
      await pg.keyboard.press('Escape').catch(() => {});
      const f = pg.locator('[data-preparer-fermer]'); if (await f.count()) await f.first().click().catch(() => {});
      await pg.waitForTimeout(300);
    });

    await essaie(`${T} S2`, async () => {
      await aller('?tab=garage');
      await pg.waitForSelector('[data-emb-type]', { timeout: 20000 });
      await pg.waitForTimeout(600);
      const e = await etatEmb(pg);
      dit(e && e.restant === '2' && e.alerte === '1' && AMBRES.includes(e.couleur) && AMBRES.includes(e.alerteCouleur) && !ROUGES.includes(e.couleur) && /racheter/.test(e.alerteTxt),
        `${T} S2 un « Colis fait » décompté (3 → 2), l’annulé non ; au seuil ⇒ ambre, jamais rouge`, JSON.stringify(e));
      await pg.locator('[data-emballages]').first().scrollIntoViewIfNeeded().catch(() => {});
      await pg.screenshot({ path: C('stock') });
      dit((await deborde(pg)) <= 0, `${T} Stock : aucun débordement`);
    });

    await essaie(`${T} V1`, async () => {
      await aller('?tab=cat_ventes');
      const t = pg.locator('.vrm-sale-row[data-tx="7102"] .vrm-ledger-sale-toggle').first();
      await t.waitFor({ timeout: 30000 }); await pg.waitForTimeout(800);
      await t.scrollIntoViewIfNeeded(); if (await t.getAttribute('aria-expanded') !== 'true') await t.click();
      const id = await t.getAttribute('aria-controls');
      await pg.locator(`[id="${id}"] [data-cv-emballage-saisir]`).waitFor({ timeout: 8000 });
      await toucher(pg, tel, pg.locator(`[id="${id}"] [data-cv-emballage-saisir]`));
      const puce = pg.locator(`[id="${id}"] [data-cv-emballage-type]`).first();
      await puce.waitFor({ timeout: 5000 });
      await toucher(pg, tel, puce);
      const champ = await pg.inputValue(`[id="${id}"] [data-cv-emballage-champ]`);
      const avant = ((await lire(pg, 'vinted_sale_overrides')) || {})['7102'] || {};
      await pg.screenshot({ path: C('vente') });
      dit(champ === '0,80' && avant.emballage == null, `${T} V1 la puce « Boîte · 0,80 € » remplit le champ ; rien n’est écrit avant « OK »`, JSON.stringify({ champ, avant }));
      await toucher(pg, tel, pg.locator(`[id="${id}"] [data-cv-emballage-ok]`));
      await pg.waitForTimeout(800);
      const ov = ((await lire(pg, 'vinted_sale_overrides')) || {})['7102'] || {};
      dit(ov.emballage === '0.80' && ov.buyPrice === '50', `${T} V1 « OK » ⇒ l’emballage de CETTE vente (0.80), le reste intact`, JSON.stringify(ov));
    });

    await essaie(`${T} K1`, async () => {
      await aller('?tab=achats');
      await pg.waitForSelector('[data-achats-calculette]', { timeout: 20000 });
      const avant = await pg.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]).filter(([k]) => !/^vrm_parcours|^sb-|instantane|vrm_fraicheur|file_envoi|vrm_rythme/.test(k))));
      await toucher(pg, tel, pg.locator('[data-achats-calculette]').first());
      await pg.waitForSelector('[data-calculette]', { timeout: 8000 });
      await pg.fill('[data-calc-champ="calc-achat"]', '60'); await pg.fill('[data-calc-champ="calc-revente"]', '120'); await pg.fill('[data-calc-champ="calc-emballage"]', '0,80');
      await pg.waitForTimeout(300);
      const k = await pg.evaluate(() => { const e = document.querySelector('[data-calculette]'); return { b: e.getAttribute('data-calc-benefice'), borne: e.getAttribute('data-calc-borne'), puce: !!e.querySelector('[data-calc-emb-choix]'), barre: (e.querySelector('[data-cv-barre]') || {}).getAttribute && e.querySelector('[data-cv-barre]').getAttribute('data-cv-barre') }; });
      dit(k.b === '5920' && k.borne === 'exact' && k.puce && k.barre === 'achat:6000,emballage:80,benefice:5920', `${T} K1 60 € → 120 € sur Vinted, 0,80 € d’emballage ⇒ 59,20 € exact ; SES emballages proposés`, JSON.stringify(k));
      dit(!(await petites(pg, '[data-calculette]')).length, `${T} K1 cibles ≥ 44 px`, JSON.stringify(await petites(pg, '[data-calculette]')));
      await pg.screenshot({ path: C('calculette') });
      await toucher(pg, tel, pg.locator('[data-calc-site-choix="vestiaire"]').first());
      await pg.waitForTimeout(250);
      const v = await pg.evaluate(() => { const e = document.querySelector('[data-calculette]'); return { borne: e.getAttribute('data-calc-borne'), auPlus: !!e.querySelector('[data-calc-au-plus]') }; });
      dit(v.borne === 'au-plus' && v.auPlus, `${T} K1 Vestiaire (commission pas lue) ⇒ « au plus »`, JSON.stringify(v));
      await pg.screenshot({ path: C('calculette-vestiaire') });
      dit((await deborde(pg)) <= 0, `${T} K1 aucun débordement`);
      await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
      const apres = await pg.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]).filter(([k]) => !/^vrm_parcours|^sb-|instantane|vrm_fraicheur|file_envoi|vrm_rythme/.test(k))));
      const cles = (s) => JSON.parse(s).filter(([k]) => /calc/i.test(k)).length;
      dit(cles(apres) === 0 && (await pg.locator('[data-calculette]').count()) === 0, `${T} K1 la calculette fermée, rien d’écrit (aucune clé « calc »)`, String(cles(apres)) + ' ' + (avant.length === apres.length));
    });

    await essaie(`${T} K2`, async () => {
      if (tel) { const bt = pg.locator('button[aria-label="Rechercher une paire"]').first(); if (await bt.count()) await bt.tap(); }
      else { await pg.mouse.click(5, 300); await pg.keyboard.press('Control+K'); }
      await pg.waitForSelector('[data-recherche-champ]', { timeout: 8000 });
      await pg.evaluate(() => { const el = document.querySelector('[data-recherche-champ]'); const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; poser.call(el, 'calculette'); el.dispatchEvent(new Event('input', { bubbles: true })); el.focus(); });
      await pg.waitForSelector('[data-recherche-action="calculette"]', { timeout: 8000 });
      await toucher(pg, tel, pg.locator('[data-recherche-action="calculette"]').first());
      const vu = await pg.waitForSelector('[data-calculette]', { timeout: 8000 }).then(() => true).catch(() => false);
      dit(vu, `${T} K2 ⌘K « calculette » ouvre la calculette`);
      await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
    });

    await essaie(`${T} F1`, async () => {
      await pg.waitForFunction(() => { try { const j = JSON.parse(localStorage.getItem('vrm_prix_lus') || 'null'); return j && j.a && j.a['901'] && j.a['901'].length >= 3; } catch (_) { return false; } }, null, { timeout: 15000 }).catch(() => {});
      const pl = await lire(pg, 'vrm_prix_lus');
      const pts = pl && pl.a && pl.a['901'] ? pl.a['901'].map((p) => p[1]) : [];
      dit(pts.join(',') === '11000,10000,9500', `${T} F1 la lecture des annonces AJOUTE le prix changé (95 €) au journal des prix lus`, JSON.stringify(pl && pl.a));
      await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: '11' })));
      await pg.waitForSelector('[data-fiche-prix-serie]', { timeout: 15000 });
      await pg.locator('[data-fiche-etape="prix"]').first().scrollIntoViewIfNeeded().catch(() => {});
      await pg.waitForTimeout(400);
      const f = await pg.evaluate(() => { const s = document.querySelector('[data-fiche-prix-serie]'); const e = document.querySelector('[data-fiche-etape="prix"]');
        return { n: s.getAttribute('data-fiche-prix-serie'), premier: s.getAttribute('data-prix-premier'), dernier: s.getAttribute('data-prix-dernier'),
          lus: e ? e.querySelectorAll('[data-fiche-ev="prix-lu"]').length : 0, dates: e ? [...e.querySelectorAll('[data-fiche-ev="prix-lu"]')].map((x) => x.getAttribute('data-fiche-ev-date')).filter(Boolean).length : 0, w: Math.round(s.getBoundingClientRect().width) }; });
      dit(f.n === '3' && f.premier === '11000' && f.dernier === '9500' && f.lus === 3 && f.dates === 3 && f.w > 100, `${T} F1 la fiche : escalier 110 € → 95 €, 3 prix lus datés`, JSON.stringify(f));
      await pg.screenshot({ path: C('fiche') });
      dit((await deborde(pg)) <= 0, `${T} F1 aucun débordement`);
    });
    dit(r.errs.length === 0, `${T} aucune erreur`, r.errs.join(' | ').slice(0, 300));
  } finally { await r.ctx.close(); }
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const vues = [[true, false], [true, true], [false, false], [false, true]].filter(([t, s]) => !process.env.VUES || process.env.VUES.split(',').includes(`${t ? 390 : 1512}-${s ? 'sombre' : 'clair'}`));
    for (const [tel, sombre] of vues) {
      console.log(`── ${tel ? '390 px tactile' : '1512 px'}, ${sombre ? 'sombre' : 'clair'}`);
      await scenario(b, tel, sombre);
    }
  } catch (e) {
    dit(false, 'le banc a tourné jusqu’au bout', e.message);
  } finally {
    if (b) await b.close(); srv.close();
  }
  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
