// Banc : LOTS BA et BF (10 nov.) — LE COÛT RÉEL D'UNE VENTE et LA VALEUR DU STOCK.
//
// Rend les VRAIS écrans Ventes, Annonces, Stock et Statistiques sur des données
// INVENTÉES (le dépôt est public), en 390 px tactile (clair puis sombre) et en
// 1512 px (clair puis sombre), et exige — data-* et nombres rendus, jamais un libellé :
//   Ventes (le récapitulatif d'une vente)
//   1. 7101 : 120 € − 60 € − 5 € (boost 2 + commission 3) − 0,80 € d'emballage
//      = 54,20 € ; la barre porte achat:6000, frais:500, emballage:80, benefice:5420 ;
//   2. 7102 (achat 50 €, pas d'emballage) : « non saisi » NOMMÉ, en ambre (jamais
//      rouge), cible ≥ 44 px ; on le touche, on tape 1,20, OK ⇒ la fiche de CETTE
//      vente porte `emballage: '1.20'`, la ligne dit − 1,20 € et le bénéfice
//      descend de 1,20 € (la règle du bénéfice, pas un second calcul) ;
//   3. 7103 (aucun prix d'achat) : bénéfice « — » (aucun `data-benef-vente`), la
//      porte « Saisir le prix d'achat » ; pas de segment « bénéfice » ;
//   4. 7104 (achat 55 € pour 40 €) : une perte, la barre marquée (ambre) ;
//   Stock et Statistiques
//   5. Annonces publie `vrm_valeur_stock` : 6 paires présentes (en ligne +
//      masquée), 4 prix saisis (dont 0 €) = 145,50 €, 2 sans prix (un vide, un
//      illisible) ; le Stock dit « au moins 145,50 € · sur 6 paires · 2 sans
//      prix » et « 2 sans prix » OUVRE la saisie en série ; Statistiques montre la
//      MÊME valeur (lue, pas recalculée).
//   6. aucun débordement horizontal, aucune erreur d'app.
// Lancer : npm run build && BANC_PORT=$((40000+RANDOM%20000)) node scripts/bancs/cout-vente.cjs
// Captures : <tmp>/cout-vente-{390,1512}-{clair,sombre}-{vente,stock,stats}.png
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4397;
const CAP = process.env.BANC_CAPTURES || os.tmpdir();

const maintenant = new Date(2026, 10, 10, 15, 30, 0);
const iso = (h) => new Date(maintenant.getTime() - h * 3600e3).toISOString();
const A = '111';
let nPhoto = 0;
const vente = (id, titre, prix, statut, h, tus) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: iso(h), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` } });
const VENTES = [
  vente(7101, 'Nike Air Max 90 blanche taille 42', 120, 'Commande finalisée', 30, 'completed'),
  vente(7102, 'Adidas Samba OG noir taille 40', 90, 'Commande finalisée', 50, 'completed'),
  vente(7103, 'New Balance 550 blanc vert taille 43', 70, 'Commande finalisée', 70, 'completed'),
  vente(7104, 'Asics Gel-Lyte III gris taille 41', 40, 'Commande finalisée', 90, 'completed'),
];
const OV = {
  '7101': { buyPrice: '60', fees: '2', commission: '3', emballage: '0.80', fraisComplets: true },
  '7102': { buyPrice: '50', fraisComplets: true },
  '7104': { buyPrice: '55', fraisComplets: true },
};
const annonce = (id, titre, prix, cache = false) => ({ id, url: 'https://www.vinted.fr/items/' + id, title: titre, brand: 'Nike', size: '42', price: { amount: prix, currency_code: 'EUR' },
  photo: { url: `https://images1.vinted.net/t/b${id % 4}/f800/${id}.jpeg` }, created_at_ts: Math.floor((maintenant.getTime() - 5 * 86400e3) / 1000), is_closed: false, is_draft: false, is_hidden: cache, favourite_count: 1, view_count: 12 });
const ITEMS = [annonce(901, 'Nike Dunk Low panda 42', '95.0'), annonce(902, 'Nike Air Force 1 blanche 42', '80.0'), annonce(903, 'Nike Air Max 1 rouge 42', '110.0'),
  annonce(904, 'Nike Cortez blanche 42', '60.0'), annonce(905, 'Nike Blazer Mid 42', '70.0'), annonce(906, 'Nike Air Max 97 argent 42', '130.0', true)];
const NUMEROS = {
  '901': { numero: '11', buyPrice: '45' }, '902': { numero: '12', buyPrice: '30,50' }, '903': { numero: '13', buyPrice: '70' },
  '904': { numero: '14', buyPrice: '0' }, '905': { numero: '15' }, '906': { numero: '16', buyPrice: 'beaucoup' },
};
const cap = maintenant.toISOString();
const LIGNES = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${A}_orders_purchased`, data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: `harvest_${A}_listings`, data: { uid: A, type: 'listings', nItems: ITEMS.length, capturedAt: cap, payload: { items: ITEMS, pagination: { total_entries: ITEMS.length } } } },
];
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'boutique_test', domain: 'www.vinted.fr', updated_at: cap }];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 220)); } };
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
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : (Array.isArray(v) && /^-?\d+$/.test(seg) ? v[Number(seg) < 0 ? v.length + Number(seg) : Number(seg)] : v[seg]);
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${['#d9d4cc', '#c9ced6', '#e2ddd4', '#cfd6cf'][k % 4]}"/><path d="M70 250 C90 190 150 180 190 200 C230 220 280 205 320 230 C345 245 340 280 300 282 L90 282 C70 282 62 268 70 250 Z" fill="rgba(30,34,40,.55)"/></svg>`;

const ouvrir = async (b, tel, sombre, url) => {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(({ s, ov, n }) => { try {
    if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1');
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    localStorage.setItem('vinted_sale_overrides', JSON.stringify(ov)); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(n));
    localStorage.setItem('vrm_stats_replis', JSON.stringify({ argent: true }));
  } catch (_) {} }, { s: !!sombre, ov: OV, n: NUMEROS });
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
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/${url}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};
const toucher = async (pg, tel, loc) => { if (tel) await loc.tap(); else await loc.click(); };
const ouvrirVente = async (pg, tx) => {
  const t = pg.locator(`.vrm-sale-row[data-tx="${tx}"] .vrm-ledger-sale-toggle`).first();
  if (await t.getAttribute('aria-expanded') !== 'true') {
    const croix = pg.locator('.vrm-ledger-drawer-host:not([hidden]) .vrm-recap-fermer');
    if (await croix.count()) { await croix.first().click(); await pg.locator('.vrm-ledger-drawer-host:not([hidden])').first().waitFor({ state: 'detached', timeout: 4000 }).catch(() => {}); await pg.waitForTimeout(150); }
  }
  await t.scrollIntoViewIfNeeded();
  if (await t.getAttribute('aria-expanded') !== 'true') await t.click();
  const id = await t.getAttribute('aria-controls');
  await pg.locator(`[id="${id}"]`).waitFor({ state: 'visible', timeout: 8000 });
  await pg.waitForTimeout(400);
  return id;
};
const lireVente = (pg, id) => pg.evaluate((id) => {
  const d = document.getElementById(id); if (!d) return null;
  const at = (sel, a) => { const e = d.querySelector(sel); return e ? e.getAttribute(a) : null; };
  const porte = d.querySelector('[data-cv-emballage-saisir]');
  const pr = porte ? porte.getBoundingClientRect() : null;
  return {
    barre: at('[data-cv-barre]', 'data-cv-barre'), perte: at('[data-cv-barre]', 'data-cv-perte'),
    emb: at('[data-recap-emballage]', 'data-recap-emballage'), embTxt: (d.querySelector('[data-recap-emballage] dd') || {}).innerText || '',
    benef: at('[data-recap-benef-etat]', 'data-benef-vente'), benefEtat: at('[data-recap-benef-etat]', 'data-recap-benef-etat'),
    frais: at('[data-recap-frais]', 'data-recap-frais'), achat: at('[data-recap-achat]', 'data-recap-achat'),
    porte: porte ? { c: getComputedStyle(porte).color, h: Math.round(pr.height), t: porte.innerText } : null,
    saisirAchat: !!d.querySelector('[data-cout-vente-saisir]'),
    deb: d.scrollWidth - d.clientWidth,
  };
}, id);
const AMBRES = ['rgb(178, 80, 0)', 'rgb(255, 179, 64)', 'rgb(255, 159, 10)', 'rgb(201, 52, 0)'];
const ROUGES = ['rgb(215, 0, 21)', 'rgb(255, 59, 48)', 'rgb(255, 69, 58)', 'rgb(255, 105, 97)'];

async function ventes(b, tel, sombre) {
  const T = `${tel ? 390 : 1512} ${sombre ? 'sombre' : 'clair'}`;
  const r = await ouvrir(b, tel, sombre, '?tab=cat_ventes');
  try {
    await r.pg.locator('.vrm-sale-row[data-tx] .vrm-ledger-sale-toggle').first().waitFor({ timeout: 30000 });
    await r.pg.waitForTimeout(1200);
    await essaie(`${T} 7101`, async () => {
      const id = await ouvrirVente(r.pg, 7101); const v = await lireVente(r.pg, id);
      dit(v.barre === 'achat:6000,frais:500,emballage:80,benefice:5420' && v.benef === '54.20' && v.emb === '80' && v.frais === '5.00' && v.benefEtat === 'ok',
        `${T} 7101 : 120 − 60 − 5 − 0,80 = 54,20 €, la barre empilée dans le même ordre`, JSON.stringify(v));
      await r.pg.screenshot({ path: path.join(CAP, `cout-vente-${tel ? 390 : 1512}-${sombre ? 'sombre' : 'clair'}-vente.png`) });
    });
    await essaie(`${T} 7102`, async () => {
      const id = await ouvrirVente(r.pg, 7102); const v = await lireVente(r.pg, id);
      dit(v.emb === 'non-saisi' && v.porte && /non saisi/.test(v.porte.t) && AMBRES.includes(v.porte.c) && !ROUGES.includes(v.porte.c) && v.porte.h >= 44 && v.benef === '40.00',
        `${T} 7102 : « non saisi » nommé, en ambre, cible ≥ 44 px ; bénéfice 40 € (rien deviné)`, JSON.stringify(v));
      await r.pg.screenshot({ path: path.join(CAP, `cout-vente-${tel ? 390 : 1512}-${sombre ? 'sombre' : 'clair'}-emballage.png`) });
      await toucher(r.pg, tel, r.pg.locator(`[id="${id}"] [data-cv-emballage-saisir]`));
      await r.pg.locator(`[id="${id}"] [data-cv-emballage-champ]`).fill('1,20');
      await toucher(r.pg, tel, r.pg.locator(`[id="${id}"] [data-cv-emballage-ok]`));
      await r.pg.waitForTimeout(700);
      const v2 = await lireVente(r.pg, id);
      const ov = await r.pg.evaluate(() => JSON.parse(localStorage.getItem('vinted_sale_overrides') || '{}')['7102'] || null);
      dit(ov && ov.emballage === '1.20' && ov.fraisComplets === true && ov.buyPrice === '50', `${T} la porte écrit la fiche de CETTE vente (emballage 1.20, le reste intact)`, JSON.stringify(ov));
      dit(v2.emb === '120' && v2.benef === '38.80' && v2.barre === 'achat:5000,emballage:120,benefice:3880', `${T} 7102 après saisie : − 1,20 €, bénéfice 38,80 € (la règle du bénéfice)`, JSON.stringify(v2));
    });
    await essaie(`${T} 7103`, async () => {
      const id = await ouvrirVente(r.pg, 7103); const v = await lireVente(r.pg, id);
      dit(v.benef == null && v.benefEtat === 'achat' && v.saisirAchat && !/benefice/.test(v.barre || ''), `${T} 7103 sans prix d’achat : bénéfice « — », la porte « Saisir le prix d’achat »`, JSON.stringify(v));
    });
    await essaie(`${T} 7104`, async () => {
      const id = await ouvrirVente(r.pg, 7104); const v = await lireVente(r.pg, id);
      dit(v.perte === '1' && v.benef === '-15.00' && v.barre === 'achat:5500', `${T} 7104 : une perte de 15 €, la barre la montre`, JSON.stringify(v));
    });
    dit(await r.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${T} Ventes : aucun débordement horizontal`);
    dit(r.errs.length === 0, `${T} Ventes : aucune erreur`, r.errs.join(' | '));
  } finally { await r.ctx.close(); }
}

async function stock(b, tel, sombre) {
  const T = `${tel ? 390 : 1512} ${sombre ? 'sombre' : 'clair'}`;
  const r = await ouvrir(b, tel, sombre, '?tab=cat_annonces');
  const aller = (q) => r.pg.evaluate((q) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: q })), q);
  try {
    await r.pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_valeur_stock') || 'null'); } catch (_) { return false; } }, null, { timeout: 30000 }).catch(() => {});
    const pub = await r.pg.evaluate(() => JSON.parse(localStorage.getItem('vrm_valeur_stock') || 'null'));
    dit(pub && pub.c === 14550 && pub.n === 6 && pub.nPrix === 4 && pub.nSans === 2, `${T} Annonces publie la valeur : 145,50 € sur 6 paires présentes, 2 sans prix`, JSON.stringify(pub));
    await aller('?tab=garage');
    await r.pg.waitForSelector('[data-valeur-stock]', { timeout: 20000 }).catch(() => {});
    await r.pg.waitForTimeout(800);
    const w = await r.pg.evaluate(() => { const e = document.querySelector('[data-valeur-stock]'); if (!e) return null; const p = e.querySelector('[data-valeur-stock-saisir]'); const pr = p && p.getBoundingClientRect();
      return { v: e.getAttribute('data-valeur-stock'), n: e.getAttribute('data-valeur-stock-n'), sans: e.getAttribute('data-valeur-stock-sans'), auMoins: e.getAttribute('data-valeur-stock-au-moins'), t: e.innerText.replace(/\s+/g, ' '), porte: p ? { c: getComputedStyle(p).color, h: Math.round(pr.height) } : null }; });
    dit(w && w.v === '14550' && w.n === '6' && w.sans === '2' && w.auMoins === '1' && /au moins 145,50\s€/.test(w.t) && /sur 6 paires/.test(w.t) && /2 sans prix/.test(w.t),
      `${T} Stock : « au moins 145,50 € · sur 6 paires · 2 sans prix »`, JSON.stringify(w));
    dit(w && w.porte && AMBRES.includes(w.porte.c) && w.porte.h >= 44, `${T} « 2 sans prix » est une porte ambre de 44 px`, JSON.stringify(w && w.porte));
    await r.pg.locator('[data-valeur-stock]').first().scrollIntoViewIfNeeded().catch(() => {});
    await r.pg.screenshot({ path: path.join(CAP, `cout-vente-${tel ? 390 : 1512}-${sombre ? 'sombre' : 'clair'}-stock.png`) });
    dit(await r.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${T} Stock : aucun débordement horizontal`);
    await toucher(r.pg, tel, r.pg.locator('[data-valeur-stock-saisir]').first());
    const feuille = await r.pg.waitForSelector('[data-fillbuy-feuille]', { timeout: 15000 }).then(() => true).catch(() => false);
    dit(feuille, `${T} « 2 sans prix » ouvre la saisie en série des prix d’achat`);
    await r.pg.keyboard.press('Escape').catch(() => {});
    await r.pg.waitForTimeout(300);
    await aller('?tab=dashboard');
    await r.pg.waitForSelector('[data-stats-valeur-stock]', { timeout: 20000 }).catch(() => {});
    await r.pg.waitForTimeout(600);
    const s = await r.pg.evaluate(() => { const e = document.querySelector('[data-stats-valeur-stock]'); return e ? { v: e.getAttribute('data-stats-valeur-stock'), sans: e.getAttribute('data-stats-valeur-sans'), t: e.textContent.replace(/\s+/g, ' ') } : null; });
    dit(s && s.v === '14550' && s.sans === '2' && /145,50\s€/.test(s.t) && /au moins · sur 6 paires · 2 sans prix/.test(s.t), `${T} Statistiques : la MÊME valeur, lue (145,50 € · au moins · sur 6 paires · 2 sans prix)`, JSON.stringify(s));
    await r.pg.evaluate(() => { const e = document.querySelector('[data-stats-valeur-stock] .vrm-finance-metric'); const d = e && e.closest('details'); if (d) d.open = true; if (e) e.scrollIntoView({ block: 'center' }); });
    await r.pg.waitForTimeout(300);
    await r.pg.locator('[data-stats-valeur-stock] .vrm-finance-metric').first().screenshot({ path: path.join(CAP, `cout-vente-${tel ? 390 : 1512}-${sombre ? 'sombre' : 'clair'}-stats-carte.png`) }).catch(() => {});
    await r.pg.waitForTimeout(300);
    await r.pg.screenshot({ path: path.join(CAP, `cout-vente-${tel ? 390 : 1512}-${sombre ? 'sombre' : 'clair'}-stats.png`) });
    dit(r.errs.length === 0, `${T} Stock/Statistiques : aucune erreur`, r.errs.join(' | '));
  } finally { await r.ctx.close(); }
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [tel, sombre] of [[true, false], [true, true], [false, false], [false, true]]) {
      console.log(`── ${tel ? '390 px tactile' : '1512 px'}, ${sombre ? 'sombre' : 'clair'}`);
      await ventes(b, tel, sombre); await stock(b, tel, sombre);
    }
  } catch (e) {
    dit(false, 'le banc a tourné jusqu’au bout', e.message);
  } finally {
    if (b) await b.close(); srv.close();
  }
  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
