// Banc : UNE VENTE DE PLUSIEURS ARTICLES = UNE VENTE, CHAQUE ARTICLE À SA PLACE (11 nov., lot ventes-lot).
// Ventes (Vinted), au téléphone (390 px tactile) et sur ordinateur (1512 px). Données INVENTÉES.
// Il juge la RÈGLE (data-* et nombres rendus, §6.4) :
//   A. un lot = UNE ligne « Lot · 3 articles », ses N° par identité (124, 131), « 1 non relié » ;
//   B. le récapitulatif : chaque article à SA part (prorata 30/30/40 €), son achat, « Relier » ;
//      « Relier » (son clic, N° tapé) relie l'article, la ligne et la base locale suivent ;
//   C. un prix par article pas lu ⇒ parts égales DITES ; achat du lot = somme si tout est connu ;
//   D. une annonce seule titrée « Lot de 2 paires » n'est pas un lot (sa transaction le dit) ;
//   E. le bénéfice publié (`vrm_benefice_jours`) compte le lot UNE fois, au prix d'achat du LOT ;
//   F. aucun débordement, cibles de 44 px au téléphone, aucune erreur d'app.
// Lancer : npm run build && BANC_PORT=46xx node scripts/bancs/ventes-lot.cjs ; captures : SHOTS=<dossier>
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 4627);
const SHOTS = process.env.SHOTS || '';

const maintenant = new Date(2026, 10, 11, 15, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const A = '111';
const vente = (id, titre, prix, statut, d, tus) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${id % 4}/x.jpg` } });
const VENTES = [
  vente(8001, 'Lot 3 articles', 100, 'Le paiement a été validé', il(0, 11), 'needs_action'),
  vente(8002, 'Lot 2 articles', 50, 'Commande finalisée', il(3, 10), 'completed'),
  vente(8003, 'Nike Air Max 90 blanche taille 42', 65, 'Le paiement a été validé', il(1, 9), 'needs_action'),
  vente(8004, 'Lot de 2 paires Nike Dunk', 70, 'Commande finalisée', il(4, 9), 'completed'),
];
const art = (id, title, prix, size) => ({ id, title, price: prix == null ? null : { amount: String(prix), currency_code: 'EUR' }, size_title: size, photos: [{ url: `https://images1.vinted.net/t/b${id % 4}/a${id}.jpg` }] });
const txn = (id, items, extra = {}) => ({ id: `harvest_${A}_txn_${id}`, data: { capturedAt: maintenant.toISOString(), payload: { transaction: { id, item_id: items[0].id, items_count: items.length, status: extra.status || 230, status_title: extra.st || 'Le paiement a été validé', status_updated_at: il(0).toISOString(), order: { items } } } } });
const FICHES = {
  6101: { numero: '124', buyPrice: '20', title: 'Nike Air Max 90 blanche', size: '42' },
  6102: { numero: '131', buyPrice: '15', title: 'Nike Air Max 90 blanche', size: '42' },
  6201: { numero: '140', buyPrice: '10', title: 'Adidas Samba', size: '40' },
  6202: { numero: '141', buyPrice: '12', title: 'Adidas Gazelle', size: '41' },
  6401: { numero: '150', buyPrice: '30', title: 'Lot de 2 paires Nike Dunk', size: '40' },
};
const cap = maintenant.toISOString();
const LIGNES = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  // 8001 : trois articles AU MÊME TITRE (deux numérotés par leur annonce, un sans fiche), prix lus.
  txn(8001, [art(6101, 'Nike Air Max 90 blanche', 30, '42'), art(6102, 'Nike Air Max 90 blanche', 30, '42'), art(6103, 'Nike Air Max 90 blanche', 40, '42')]),
  // 8002 : deux articles numérotés, un prix PAS lu ⇒ parts égales.
  txn(8002, [art(6201, 'Adidas Samba', 30, '40'), art(6202, 'Adidas Gazelle', null, '41')], { status: 450, st: 'Commande finalisée' }),
  // 8004 : une annonce seule titrée « Lot … » — UN article : pas un lot.
  txn(8004, [art(6401, 'Lot de 2 paires Nike Dunk', 70, '40')], { status: 450, st: 'Commande finalisée' }),
];
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'boutique_banc', domain: 'www.vinted.fr', updated_at: cap }];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf'][k % 4]}"/><path d="M70 250 C90 190 150 180 190 200 C230 220 280 205 320 230 C345 245 340 280 300 282 L90 282 C70 282 62 268 70 250 Z" fill="rgba(30,34,40,.55)"/></svg>`;


const ouvrir = async (b, vp) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((f) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(f)); } catch (_) {} }, FICHES);
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    // ⚠️ La vraie forme de la lecture des lots : `id=in.(…)` + projection (jamais `select=data`).
    const dans = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { if (/[?&]select=data(&|$)/.test(u)) lectureLourde.push(u); const ids = dans[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.locator('.vrm-sale-row[data-tx] .vrm-ledger-sale-toggle').first().waitFor({ timeout: 30000 });
  await pg.locator('.vrm-sale-row[data-tx="8001"] [data-vente-lot="3"]').first().waitFor({ timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(800);
  return { ctx, pg, errs };
};
const lectureLourde = [];
const ligne = (pg, tx) => pg.evaluate((tx) => {
  const rows = [...document.querySelectorAll(`.vrm-sale-row[data-tx="${tx}"]`)];
  const l = rows[0] && rows[0].querySelector('[data-vente-lot]');
  const a = rows[0] && rows[0].querySelector('[data-achat-ligne]');
  return { n: rows.length, lot: l ? l.getAttribute('data-vente-lot') : null, nums: l ? l.getAttribute('data-lot-nums') : null, sans: l ? l.getAttribute('data-lot-non-relies') : null,
    achat: a ? a.getAttribute('data-achat-ligne') : null, achatEtat: a ? a.getAttribute('data-achat-etat') : null };
}, tx);
const ouvrirVente = async (pg, tx) => {
  const croix = pg.locator('.vrm-ledger-drawer-host:not([hidden]) .vrm-recap-fermer');
  if (await croix.count()) { await croix.first().click(); await pg.waitForTimeout(250); }
  const t = pg.locator(`.vrm-sale-row[data-tx="${tx}"] .vrm-ledger-sale-toggle`).first();
  await t.scrollIntoViewIfNeeded();
  if (await t.getAttribute('aria-expanded') !== 'true') await t.click();
  const id = await t.getAttribute('aria-controls');
  await pg.locator(`[id="${id}"]`).waitFor({ state: 'visible', timeout: 8000 });
  await pg.waitForTimeout(300);
  return id;
};
const recap = (pg, id) => pg.evaluate((id) => {
  const d = document.getElementById(id); const s = d && d.querySelector('[data-recap-lot]');
  const vw = window.innerWidth;
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const petites = s ? [...s.querySelectorAll('button, input')].filter(vis).filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 20)) : [];
  return s ? { n: s.getAttribute('data-recap-lot'), mode: s.getAttribute('data-lot-mode'), sans: s.getAttribute('data-lot-non-relies'),
    phrase: (s.querySelector('[data-lot-phrase]') || {}).textContent || '', manque: (s.querySelector('[data-lot-manque]') || {}).textContent || '',
    articles: [...s.querySelectorAll('[data-lot-article]')].map((li) => ({ item: li.getAttribute('data-lot-article'), num: li.getAttribute('data-lot-num'), par: li.getAttribute('data-lot-par'), part: li.getAttribute('data-lot-part'), achat: li.getAttribute('data-lot-achat') })),
    relier: [...s.querySelectorAll('[data-lot-relier]')].map((b) => b.getAttribute('data-lot-relier')), petites,
    achatRecap: (d.querySelector('[data-recap-achat]') || {}).getAttribute ? d.querySelector('[data-recap-achat]').getAttribute('data-recap-achat') : null,
    hors: [...d.querySelectorAll('*')].filter((e) => vis(e) && !e.closest('svg') && e.getBoundingClientRect().right > vw + 1).length,
    deb: document.documentElement.scrollWidth - vw } : null;
}, id);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, nom] of [[{ width: 390, height: 844 }, '390'], [{ width: 1512, height: 982 }, '1512']]) {
      console.log(`\n— ${nom}`);
      const { ctx, pg, errs } = await ouvrir(b, vp);
      const tel = vp.width < 600;
      await essaie('A. la ligne du lot', async () => {
        const l = await ligne(pg, '8001');
        dit(l.n === 1, 'A1 un lot = UNE ligne de vente', `${l.n} lignes`);
        dit(l.lot === '3' && l.nums === '124,131' && l.sans === '1', 'A2 « Lot · 3 articles », N° 124 et 131 par identité, 1 non relié', JSON.stringify(l));
        dit(l.achatEtat === 'manque', 'A3 un article sans prix d’achat ⇒ achat du lot « pas su » (jamais l’achat d’un seul)', JSON.stringify(l));
        if (SHOTS) { await pg.locator('.vrm-sale-row[data-tx="8001"]').first().scrollIntoViewIfNeeded(); await pg.screenshot({ path: path.join(SHOTS, `lot-ligne-${nom}.png`) }); }
      });
      await essaie('B. le récapitulatif du lot', async () => {
        const id = await ouvrirVente(pg, '8001');
        const r = await recap(pg, id);
        dit(r && r.n === '3' && r.mode === 'prorata' && r.articles.map((a) => a.part).join() === '3000,3000,4000', 'B1 trois articles, au prorata des prix affichés (30/30/40 €)', JSON.stringify(r && r.articles));
        dit(r.articles.map((a) => a.num).join() === '124,131,' && r.articles[0].par === 'annonce' && /1 article non relié/.test(r.manque), 'B2 relié par l’annonce ; le 3e (même titre) n’est PAS deviné, « 1 article non relié »', JSON.stringify(r.articles));
        dit(r.relier.join() === '6103', 'B3 « Relier » seulement sur l’article non relié', r.relier.join());
        dit(r.deb <= 1 && r.hors === 0, 'B4 aucun débordement', `${r.deb} px, ${r.hors} éléments`);
        if (tel) dit(r.petites.length === 0, 'B5 cibles de 44 px au téléphone', r.petites.join(' | '));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `lot-recap-${nom}.png`) });
        await pg.locator(`[id="${id}"] [data-lot-relier="6103"]`).click();
        await pg.locator(`[id="${id}"] [data-lot-saisie="6103"] input`).fill('160');
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `lot-relier-${nom}.png`) });
        await pg.locator(`[id="${id}"] [data-lot-valider="6103"]`).click();
        await pg.waitForTimeout(500);
        const r2 = await recap(pg, id);
        const liens = await pg.evaluate(() => JSON.parse(localStorage.getItem('vrm_lot_liens') || '{}'));
        dit(r2.articles[2].num === '160' && r2.articles[2].par === 'main' && r2.sans === '0', 'B6 « Relier » (son N° tapé) relie l’article', JSON.stringify(r2.articles[2]));
        dit(liens['8001'] && liens['8001']['6103'] === '160', 'B7 rangé dans vrm_lot_liens par n° de transaction et identifiant d’annonce', JSON.stringify(liens));
        await pg.locator(`[id="${id}"] .vrm-recap-fermer`).click(); await pg.waitForTimeout(300);
        const l = await ligne(pg, '8001');
        dit(l.nums === '124,131,160' && l.sans === '0', 'B8 la ligne suit : N° 124 · 131 · 160', JSON.stringify(l));
      });
      await essaie('C. parts égales dites, achat du lot', async () => {
        const id = await ouvrirVente(pg, '8002');
        const r = await recap(pg, id);
        dit(r && r.mode === 'egal' && r.articles.map((a) => a.part).join() === '2500,2500' && /réparti également, prix par article pas lu/.test(r.phrase), 'C1 un prix pas lu ⇒ parts égales, DIT', JSON.stringify(r && { mode: r.mode, phrase: r.phrase }));
        dit(r.achatRecap === '22.00', 'C2 prix d’achat du lot = 10 + 12 € (les deux connus)', r.achatRecap);
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `lot-egal-${nom}.png`) });
      });
      await essaie('D. une annonce titrée « Lot » n’est pas un lot', async () => {
        const l = await ligne(pg, '8004'), s = await ligne(pg, '8003');
        dit(l.n === 1 && l.lot === null && l.achat === '3000', 'D1 « Lot de 2 paires » (un article) : vente ordinaire, N°150, achat 30 €', JSON.stringify(l));
        dit(s.lot === null, 'D2 une vente d’un article n’a pas d’étiquette de lot');
      });
      await essaie('E. le bénéfice publié', async () => {
        const pub = await pg.evaluate(() => JSON.parse(localStorage.getItem('vrm_benefice_jours') || 'null'));
        const jours = pub && pub.jours ? Object.values(pub.jours) : [];
        const somme = (i) => jours.reduce((s, j) => s + (Number(j[i]) || 0), 0);
        // finalisées : 8002 (lot, achat 22 €) et 8004 (achat 30 €) — n = 2 ventes, coût 52 €.
        dit(pub && somme(0) === 2 && somme(3) === 2 && somme(4) === 5200 && somme(1) === 12000, 'E1 le lot compte UNE vente, au prix d’achat du LOT (n 2, coût 52 €, CA 120 €)', JSON.stringify(pub && pub.jours));
      });
      dit(lectureLourde.length === 0, 'F1 les lots se lisent en projection, jamais select=data', lectureLourde[0]);
      dit(errs.length === 0, 'F2 aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
