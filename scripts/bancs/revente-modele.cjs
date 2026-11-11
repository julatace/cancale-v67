// Banc : LOT AV (10 nov.) — « CE QUE TU AS RÉELLEMENT REVENDU CE MODÈLE ».
//
// Rend le VRAI écran Achats sur des données INVENTÉES (le dépôt est public), en
// 390 px tactile SOMBRE puis 1512 px clair, et exige :
//   Achats → « + Ajouter » (saisie d'un achat hors plateforme)
//   1. taper « Nike Dunk Low noir 43 » ⇒ « Revendu 100 € en médiane, sur 5 ventes »
//      (les 5 Dunk du relevé ; ni les Air Force 1, ni la Samba) ; toucher ⇒ prix
//      médian, bénéfice médian « sur 4 des 5 » (une vente sans prix d'achat), délai,
//      les 5 ventes ; cible ≥ 44 px ;
//   2. « Nike Air Force 1 blanche » ⇒ « Pas assez de ventes de ce modèle (2) » ;
//      « Chaussures blanches » (modèle pas sûr) ⇒ rien ;
//   Achats Vinted → ⋯ d'un achat
//   3. « Revendu combien ? » sur l'achat Dunk ⇒ la feuille, dépliée, mêmes chiffres ;
//      l'achat au modèle pas reconnu n'a pas ce choix ;
//   4. aucune phrase ne dit à quel prix vendre ; aucune écriture vers la base.
// Captures : <tmp>/revente-modele-{390,1512}-{saisie,feuille}.png
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4398;
const CAP = process.env.BANC_CAPTURES || os.tmpdir();

const auj = Date.now();
const iso = (h) => new Date(auj - h * 3600e3).toISOString();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'boutique_test', domain: 'www.vinted.fr', updated_at: iso(0) }];
const achat = (tx, titre, prix, j) => ({ transaction_id: tx, title: titre, price: { amount: String(prix), currency_code: 'EUR' },
  status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: iso(j * 24) });
const ACHATS = [achat(81000001, 'Nike Dunk Low Panda 42', 45, 2), achat(81000002, 'Chaussures blanches 41', 20, 3)];
const LIGNES = [
  { id: 'main', data: {} },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(0), payload: { my_orders: ACHATS } } },
];
// Le relevé de Ventes (`vrm_stats_ventes`) : [plateforme, compte, id, ts, vente €, achat €, frais €, titre, N°, versement]
const v = (i, titre, eur, achatE, frais, j) => ['Vinted', 'boutique_test', 'tx' + i, auj - j * 86400e3, eur, achatE, frais, titre, '', ''];
const RELEVE = { v: 1, at: auj, l: [
  v(1, 'Nike Dunk Low Panda 42', 100, 50, 2, 3), v(2, 'Nike Dunk Low noir 41', 110, 55, 0, 10), v(3, 'Dunk Low Nike blanc 43', 95, null, 0, 20),
  v(4, 'Nike Dunk Low Retro 44', 90, 40, 5, 30), v(5, 'Nike Dunk Low Panda 42', 105, 60, 0, 40),
  v(6, 'Nike Air Force 1 blanche 42', 80, 30, 0, 5), v(7, 'Nike Air Force 1 blanche 43', 85, 30, 0, 6),
  v(8, 'Adidas Samba noire 42', 70, 25, 0, 7),
] };

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : (Array.isArray(x) && /^-?\d+$/.test(seg) ? x[Number(seg) < 0 ? x.length + Number(seg) : Number(seg)] : x[seg]);
    out[alias] = x == null ? null : x;
  }
  return out;
};

async function rendre(b, tel) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true } : {}), colorScheme: tel ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = [];
  await pg.addInitScript(({ rel, sombre }) => { try { if (sessionStorage.getItem('__banc')) return; sessionStorage.setItem('__banc', '1'); localStorage.setItem('vrm_acces_direct', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vrm_stats_ventes', JSON.stringify(rel)); } catch (_) {} }, { rel: RELEVE, sombre: tel });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecrits.push({ m: req.method(), u, corps: req.postData() || '' }); return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_achats&vue=achats`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, ecrits };
}
const CONSEIL = /prix conseill|conseill[eé]|vends?[- ]la\s|mets?[- ]la\s|devrais|recommand/i;
const lireBloc = (pg, racine = 'body') => pg.evaluate((r) => {
  const e = document.querySelector(`${r} [data-revente-modele]`); if (!e) return null;
  const s = e.querySelector('summary');
  const vis = (x) => !!x && x.getBoundingClientRect().height > 0;
  return { etat: e.getAttribute('data-revente-modele'), n: e.getAttribute('data-revente-n'), prix: e.getAttribute('data-revente-prix'), benef: e.getAttribute('data-revente-benef'), nbenef: e.getAttribute('data-revente-nbenef'),
    phrase: (e.querySelector('[data-revente-phrase]') || {}).innerText, t: e.innerText, h: s ? Math.round(s.getBoundingClientRect().height) : null,
    ventes: [...e.querySelectorAll('[data-revente-vente]')].filter(vis).map((x) => x.getAttribute('data-revente-vente')), figs: [...e.querySelectorAll('[data-revente-fig]')].filter(vis).map((x) => x.innerText.replace(/\s+/g, ' ')) };
}, racine);

async function passe(b, tel) {
  const T = tel ? '390 sombre' : '1512';
  const r = await rendre(b, tel);
  const tap = async (sel) => { const l = typeof sel === 'string' ? r.pg.locator(sel).first() : sel; if (tel) await l.tap(); else await l.click(); };
  try {
    await r.pg.locator('[data-achat-hors-ajouter]').first().waitFor({ timeout: 15000 }).catch(() => {});
    await r.pg.waitForTimeout(1500);
    const nEcrits = r.ecrits.length;
    await tap('[data-achat-hors-ajouter]');
    await r.pg.waitForSelector('[data-achat-hors-form] [data-champ="titre"]', { timeout: 8000 });
    const champ = r.pg.locator('[data-achat-hors-form] [data-champ="titre"]');
    await champ.fill('Chaussures blanches 42'); await r.pg.waitForTimeout(300);
    dit(!(await r.pg.locator('[data-achat-hors-form] [data-revente-modele]').count()), `${T} « Chaussures blanches » (modèle pas sûr) ⇒ rien dit`);
    await champ.fill('Nike Air Force 1 blanche'); await r.pg.waitForTimeout(300);
    const af = await lireBloc(r.pg, '[data-achat-hors-form]');
    dit(af && af.etat === 'peu' && af.phrase === 'Pas assez de ventes de ce modèle (2)', `${T} Air Force 1 ⇒ « Pas assez de ventes de ce modèle (2) »`, JSON.stringify(af));
    await champ.fill('Nike Dunk Low noir 43'); await r.pg.waitForTimeout(300);
    const d0 = await lireBloc(r.pg, '[data-achat-hors-form]');
    dit(d0 && d0.etat === 'ok' && d0.n === '5' && d0.phrase.replace(/\u00a0/g, ' ') === 'Revendu 100 € en médiane, sur 5 ventes' && d0.h >= 44, `${T} Dunk ⇒ « Revendu 100 € en médiane, sur 5 ventes » (cible ≥ 44 px)`, JSON.stringify(d0));
    await tap('[data-achat-hors-form] [data-revente-modele] summary');
    await r.pg.waitForTimeout(600);
    const d1 = await lireBloc(r.pg, '[data-achat-hors-form]');
    dit(d1 && d1.prix === '10000' && d1.benef === '4650' && d1.nbenef === '4' && d1.figs.some((f) => /sur 4 des 5/.test(f)), `${T} toucher ⇒ prix médian 100 €, bénéfice médian 46,50 € « sur 4 des 5 »`, JSON.stringify(d1 && d1.figs));
    dit(d1 && d1.ventes.join() === 'tx1,tx2,tx3,tx4,tx5', `${T} les 5 ventes, la plus récente d’abord (ni Air Force 1, ni Samba)`, d1 && d1.ventes.join());
    dit(d1 && !CONSEIL.test(d1.t), `${T} aucune phrase ne dit à quel prix vendre`);
    // (11 nov., décision C6) Le prix médian s'écrit UNE fois : déplié, la phrase se tait sur le prix.
    const fois = (t) => (String(t || '').replace(/\u00a0/g, ' ').match(/en médiane/g) || []).length;
    dit(d1 && !/€/.test(d1.phrase) && fois(d1.t) === 0 && d1.figs.filter((f) => /100\s?€/.test(f.replace(/\u00a0/g, ' '))).length === 1, `${T} (C6) déplié : le prix médian une seule fois (la case), la phrase sans prix`, JSON.stringify(d1 && { phrase: d1.phrase, figs: d1.figs }));
    await r.pg.locator('[data-achat-hors-form] [data-revente-modele]').scrollIntoViewIfNeeded();
    await r.pg.screenshot({ path: path.join(CAP, `revente-modele-${tel ? 390 : 1512}-saisie.png`) });
    dit(await r.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${T} aucun débordement horizontal (saisie)`);

    // La fiche d'un achat Vinted : ⋯ ⇒ « Revendu combien ? »
    const tous = r.pg.locator('button', { hasText: /^Tous$/ });
    if (await tous.count()) { await tap(tous.first()); await r.pg.waitForTimeout(500); }
    const carte = r.pg.locator('[data-achat-tx="81000002"]');
    await carte.waitFor({ timeout: 8000 }).catch(() => {});
    await tap(carte.locator('button.vrm-buy-more'));
    await r.pg.waitForTimeout(250);
    dit(!(await carte.locator('[data-achat-revente]').count()), `${T} achat au modèle pas reconnu : pas de « Revendu combien ? »`);
    await r.pg.evaluate(() => { const m = document.querySelector('[role="menu"].vrm-buy-menu'); if (m && m.previousElementSibling) m.previousElementSibling.click(); });
    await r.pg.waitForTimeout(300);
    const carteD = r.pg.locator('[data-achat-tx="81000001"]');
    await tap(carteD.locator('button.vrm-buy-more'));
    await r.pg.waitForTimeout(250);
    const item = carteD.locator('[data-achat-revente]');
    dit(await item.count() === 1 && /Revendu combien/.test(await item.innerText()), `${T} achat Dunk : « Revendu combien ? » dans ⋯`);
    await tap(item);
    await r.pg.waitForSelector('[data-revente-feuille] [data-revente-modele]', { timeout: 5000 }).catch(() => {});
    await r.pg.waitForTimeout(600);
    const f = await lireBloc(r.pg, '[data-revente-feuille]');
    dit(f && f.etat === 'ok' && f.n === '5' && f.prix === '10000' && f.benef === '4650' && f.ventes.length === 5 && f.figs.length === 3, `${T} la feuille, dépliée : mêmes chiffres, 3 cases, 5 ventes`, JSON.stringify(f && { n: f.n, figs: f.figs }));
    await r.pg.screenshot({ path: path.join(CAP, `revente-modele-${tel ? 390 : 1512}-feuille.png`) });
    dit(f && !/€/.test(f.phrase), `${T} (C6) la feuille : la phrase dépliée ne répète pas le prix médian`, f && f.phrase);
    dit(r.ecrits.length === nEcrits, `${T} aucune écriture vers la base`, JSON.stringify(r.ecrits.slice(nEcrits)).slice(0, 200));
    dit(await r.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${T} aucun débordement horizontal`);
    dit(r.errs.length === 0, `${T} aucune erreur`, r.errs.join(' | '));
  } finally { await r.ctx.close(); }
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const tel of [true, false]) { console.log(tel ? '── 390 px tactile, sombre' : '── 1512 px'); await passe(b, tel); }
  } catch (e) {
    dit(false, 'le banc a tourné jusqu’au bout', e.message);
  } finally {
    if (b) await b.close();
    srv.close();
    console.log(ko ? `\n❌ revente-modele : ${ko} rouge(s)` : '\n✅ revente-modele : tout est vert');
    process.exitCode = ko ? 1 : 0;
  }
})();
