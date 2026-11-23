// ════════════════════════════════════════════════════════════════════════════
//  BANC — STATISTIQUES · TRANSPORTEURS SUR 4 SITES ET ARGENT · « + DÉPENSE » (21 nov., lot transp-depenses).
//  Les VRAIS écrans et les VRAIES règles montés par outils/natif-transp-depenses/ecran.jsx (esbuild, hors du paquet de
//  prod) sur des données INVENTÉES. 390 × 844 tactile et 1512 × 900 ; clair et sombre.
//    T1 les colis des QUATRE sites dans la même règle : total et nombre par transporteur recomptés ICI (code à part) ;
//    T2 chaque transporteur dit ses sites (data-pt-sites) recomptés ici ; les quatre logos de site sont dessinés ;
//    T3 ordinateur : colonne « Sites » et filtre Site (Tous + les sites présents) ; « Leboncoin » ne garde que ses colis ;
//       téléphone : aucun filtre (décision du 20 nov.), le détail d'une rangée montre ses sites ;
//    T4 un site pas publié (base `partiel`) est NOMMÉ (« pas encore lus ici : Vestiaire »), jamais compté à zéro ;
//    T5 aucun montant dans Transporteurs (le port eBay n'est ni recette ni charge) ;
//    D1 « + Dépense » en DEUX touchers : « + Dépense », (montant tapé), la catégorie ⇒ la dépense est écrite UNE fois,
//       la liste et le total du mois la montrent ;
//    D2 toucher une dépense ⇒ la modifier (Enregistrer) ; D3 la mettre à la corbeille ;
//    D4 montant nul ⇒ rien n'est écrit, la raison est dite ; D5 nuage pas arrivé (`pret=0`) ⇒ « + Dépense » indisponible,
//       rien n'est écrit ;
//    N  natif : jamais une carte dans une carte, aucun débordement, cibles ≥ 44 px, ni NaN ni undefined.
//  Mutations (`MUTATION=sites|ecrit2`) injectées dans la page : chacune rougit SA mesure. `SHOTS=dossier`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number), THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-transp-depenses'); fs.mkdirSync(SHOTS, { recursive: true });
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'natif-transp-depenses-'));
const MUT = process.env.MUTATION || '';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/); if (!m) throw new Error('ICON_PATHS introuvable');
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx'); fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'natif-transp-depenses', 'ecran.jsx')], bundle: true, outfile: path.join(DOSSIER, 'ecran.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, alias: { 'vrm-icones-app': gen }, external: ['/brands/*'], nodePaths: [NM], logLevel: 'error' });
  fs.copyFileSync(path.join(RACINE, 'outils', 'natif-transp-depenses', 'index.html'), path.join(DOSSIER, 'index.html'));
  fs.mkdirSync(path.join(DOSSIER, 'brands'), { recursive: true });
  for (const f of fs.readdirSync(path.join(RACINE, 'public', 'brands'))) if (f.endsWith('.svg')) fs.copyFileSync(path.join(RACINE, 'public', 'brands', f), path.join(DOSSIER, 'brands', f));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };
const servir = () => new Promise((res) => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); }); s.listen(Number(process.env.BANC_PORT) || 0, () => res(s)); });

async function ouvrir(nav, port, { W, sombre, vue, extra = '' }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: W, height: 900 } }), deviceScaleFactor: 1, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage(); const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.goto(`http://localhost:${port}/?vue=${vue}${sombre ? '&theme=dark' : ''}${extra}`, { waitUntil: 'load' });
  await pg.waitForSelector(vue === 'transp' ? '[data-pt-bloc="ventes"]' : '[data-dep-mois]', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(400);
  if (MUT === 'sites') await pg.evaluate(() => { const x = document.querySelector('[data-pt-bloc="ventes"] [data-pt-ligne="mondialrelay"] [data-pt-sites]') || document.querySelector('[data-pt-bloc="ventes"] [data-pt-sites]'); if (x) x.setAttribute('data-pt-sites', 'vinted:99'); });
  return { ctx, pg, erreurs };
}
const NATIF = (sel) => {
  const vis = (x) => x.getClientRects().length > 0;
  const cartes = [...document.querySelectorAll('.n-carte')].filter(vis);
  const empilees = cartes.filter((c) => c.parentElement && c.parentElement.closest('.n-carte')).length;
  const deborde = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  const petites = [...document.querySelectorAll(sel)].filter(vis).map((x) => x.getBoundingClientRect().height).filter((h) => h > 0 && h < 44).length;
  return { empilees, deborde, petites, nan: /NaN|undefined|Infinity/.test(document.body.innerText) };
};

// Le recompte À PART (pas le code de l'app) : les publications inventées, la fenêtre de 30 jours.
const RECOMPTE = () => {
  const fin = new Date(); fin.setHours(0, 0, 0, 0); fin.setDate(fin.getDate() + 1); const de = new Date(fin); de.setDate(de.getDate() - 30);
  const V = []; for (const [k, L] of Object.entries(window.__PUB)) if (/_ventes/.test(k)) for (const x of L) if (x.venteAt >= de.getTime() && x.venteAt < fin.getTime()) V.push(x);
  const par = {}; for (const x of V) { const t = x.t || 'pas-lu'; par[t] = par[t] || {}; par[t][x.site] = (par[t][x.site] || 0) + 1; }
  return { n: V.length, par, lbc: V.filter((x) => x.site === 'leboncoin').length };
};

async function transp(nav, port, W, sombre) {
  const th = sombre ? 'sombre' : 'clair', ou = `Transporteurs · ${W} · ${th}`;
  console.log(`\n── ${ou}`);
  const A = await ouvrir(nav, port, { W, sombre, vue: 'transp' });
  try {
    await A.pg.screenshot({ path: path.join(SHOTS, `transporteurs-4sites-${W}-${th}.png`), fullPage: true });
    const r = await A.pg.evaluate((src) => {
      const R = eval(src)();
      const b = document.querySelector('[data-pt-bloc="ventes"]');
      const lignes = [...b.querySelectorAll('[data-pt-ligne]')].map((x) => ({ cle: x.getAttribute('data-pt-ligne'), n: x.getAttribute('data-pt-n'), sites: (x.querySelector('[data-pt-sites]') || {}).getAttribute ? x.querySelector('[data-pt-sites]').getAttribute('data-pt-sites') : null }));
      const logos = Object.fromEntries(['vinted', 'leboncoin', 'ebay', 'vestiaire'].map((s) => [s, [...document.querySelectorAll(`[data-pt-bloc] .n-logo-site[data-site="${s}"]`)].filter((x) => x.getBoundingClientRect().width > 0).length]));
      return { R, total: b.getAttribute('data-pt-total'), lignes, logos, filtre: !!document.querySelector('[data-pt-filtre]'), options: [...document.querySelectorAll('[data-pt-filtre] [role="radio"], [data-pt-filtre] button')].map((x) => x.textContent.trim()),
        euro: /€/.test([...document.querySelectorAll('[data-pt-bloc]')].map((x) => x.innerText).join(' ')), sitesCol: /Sites/.test((document.querySelector('.n-pt-tete') || {}).textContent || '') };
    }, RECOMPTE.toString());
    dit(r.total === String(r.R.n), `T1 ${ou} : ${r.R.n} colis des quatre sites dans la même règle (recomptés à part)`, { vue: r.total, attendu: r.R.n });
    const attendu = Object.fromEntries(Object.entries(r.R.par).map(([t, o]) => [t, ['vinted', 'leboncoin', 'ebay', 'vestiaire'].filter((s) => o[s]).map((s) => s + ':' + o[s]).join(',')]));
    const vus = Object.fromEntries(r.lignes.map((x) => [x.cle, x.sites]));
    if (W >= 900) dit(Object.keys(attendu).every((t) => vus[t] === attendu[t]), `T2 ${ou} : chaque transporteur dit ses sites (recomptés à part)`, { vus, attendu });
    dit(Object.values(r.logos).every((n) => n > 0) || W < 900, `T2b ${ou} : les quatre logos de site sont dessinés`, r.logos);
    dit(!r.euro, `T5 ${ou} : aucun montant dans Transporteurs (ni port, ni prix)`);
    if (W >= 900) {
      dit(r.filtre && r.sitesCol && r.options.join('|') === 'Tous|Vinted|Leboncoin|eBay|Vestiaire', `T3 ${ou} : colonne « Sites » et filtre Site (Tous + 4 sites)`, r.options);
      await A.pg.locator('[data-pt-filtre] button, [data-pt-filtre] [role="radio"]').filter({ hasText: 'Leboncoin' }).first().click();
      await A.pg.waitForTimeout(200);
      const t2 = await A.pg.evaluate(() => ({ total: document.querySelector('[data-pt-bloc="ventes"]').getAttribute('data-pt-total'), site: document.querySelector('[data-pt-bloc="ventes"]').getAttribute('data-pt-site') }));
      await A.pg.screenshot({ path: path.join(SHOTS, `transporteurs-filtre-lbc-${W}-${th}.png`), fullPage: true });
      dit(t2.total === String(r.R.lbc) && t2.site === 'leboncoin', `T3b ${ou} : « Leboncoin » ne garde que ses ${r.R.lbc} colis`, t2);
    } else {
      dit(!r.filtre, `T3 ${ou} : téléphone, aucun sélecteur de site (logos sur les rangées)`);
      await A.pg.locator('[data-pt-bloc="ventes"] [data-pt-ligne="colissimo"]').first().click();
      await A.pg.waitForTimeout(200);
      const s = await A.pg.evaluate(() => { const d = document.querySelector('[data-pt-detail="colissimo"] [data-pt-sites]'); return d ? d.getAttribute('data-pt-sites') : null; });
      await A.pg.screenshot({ path: path.join(SHOTS, `transporteurs-detail-colissimo-${W}-${th}.png`), fullPage: true });
      dit(s === attendu.colissimo, `T3b ${ou} : le détail de Colissimo dit ses sites (${attendu.colissimo})`, s);
    }
    const n = await A.pg.evaluate(NATIF, '[data-pt-bloc] .n-rangee, [data-pt-filtre] button');
    dit(!n.empilees && !n.deborde && !n.petites && !n.nan, `N ${ou} : aucune carte dans une carte, aucun débordement, cibles ≥ 44, ni NaN`, n);
    dit(!A.erreurs.length, `${ou} : aucune erreur de page`, A.erreurs);
  } finally { await A.ctx.close(); }
  const B = await ouvrir(nav, port, { W, sombre, vue: 'transp', extra: '&base=partiel' });
  try {
    const p = await B.pg.evaluate(() => { const b = document.querySelector('[data-pt-bloc="ventes"]'); return { pas: b.getAttribute('data-pt-pas-lus'), txt: b.innerText }; });
    dit(p.pas === 'vestiaire' && /pas encore lus ici : Vestiaire/.test(p.txt), `T4 ${ou} : Vestiaire pas publié ⇒ NOMMÉ, jamais compté à zéro`, p.pas);
  } finally { await B.ctx.close(); }
}

async function depenses(nav, port, W, sombre) {
  const th = sombre ? 'sombre' : 'clair', ou = `Dépenses · ${W} · ${th}`;
  console.log(`\n── ${ou}`);
  const A = await ouvrir(nav, port, { W, sombre, vue: 'depenses' });
  try {
    await A.pg.screenshot({ path: path.join(SHOTS, `depenses-mois-${W}-${th}.png`), fullPage: true });
    const avant = await A.pg.evaluate(() => ({ n: document.querySelectorAll('[data-dep-ligne]').length, c: Number(document.querySelector('[data-dep-mois]').getAttribute('data-dep-charges')), e: window.__ECRITURES }));
    let touchers = 0;
    await A.pg.locator('[data-dep-plus]').click(); touchers++;
    await A.pg.waitForSelector('[data-dep-feuille="ajouter"]', { timeout: 5000 }).catch(() => {});
    await A.pg.waitForTimeout(350);
    const focus = await A.pg.evaluate(() => !!(document.activeElement && document.activeElement.matches('[data-dep-montant-rapide]')));
    await A.pg.keyboard.type('12,50');
    await A.pg.screenshot({ path: path.join(SHOTS, `depenses-feuille-${W}-${th}.png`), fullPage: false });
    const cibles = await A.pg.evaluate(() => [...document.querySelectorAll('[data-dep-cat-rapide]')].map((x) => Math.round(x.getBoundingClientRect().height)));
    await A.pg.locator('[data-dep-cat-rapide="emballage"]').click(); touchers++;
    if (MUT === 'ecrit2') await A.pg.evaluate(() => { window.__ECRITURES += 1; });
    await A.pg.waitForTimeout(500);
    const apres = await A.pg.evaluate(() => ({ n: document.querySelectorAll('[data-dep-ligne]').length, c: Number(document.querySelector('[data-dep-mois]').getAttribute('data-dep-charges')), e: window.__ECRITURES, feuille: !!document.querySelector('[data-dep-feuille]'),
      d: (window.__COMPTA.depenses || [])[0], auj: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })() }));
    await A.pg.screenshot({ path: path.join(SHOTS, `depenses-ajoutee-${W}-${th}.png`), fullPage: true });
    dit(touchers === 2 && focus && apres.n === avant.n + 1 && apres.c === avant.c + 1250 && apres.e === avant.e + 1 && !apres.feuille && apres.d && apres.d.cat === 'Emballage' && apres.d.montant === 12.5 && apres.d.date === apres.auj,
      `D1 ${ou} : deux touchers (le montant prêt à taper) ⇒ 12,50 € Emballage aujourd’hui, écrite UNE fois, liste et total à jour`, { touchers, focus, avant, apres });
    dit(cibles.length === 6 && cibles.every((h) => h >= 44), `D1b ${ou} : six catégories, chacune ≥ 44 px`, cibles);
    // D2 modifier
    await A.pg.locator('[data-dep-ligne="ex1"]').click();
    await A.pg.waitForSelector('[data-dep-feuille="modifier"]', { timeout: 5000 }).catch(() => {});
    await A.pg.waitForTimeout(350);
    await A.pg.locator('[data-dep-montant-rapide]').fill('10');
    await A.pg.locator('[data-dep-enregistrer]').click();
    await A.pg.waitForTimeout(500);
    const m = await A.pg.evaluate(() => (document.querySelector('[data-dep-ligne="ex1"]') || {}).getAttribute ? document.querySelector('[data-dep-ligne="ex1"]').getAttribute('data-dep-cents') : null);
    dit(m === '1000', `D2 ${ou} : toucher une dépense ⇒ la modifier (8,40 → 10 €)`, m);
    // D4 montant nul
    await A.pg.locator('[data-dep-plus]').click(); await A.pg.waitForTimeout(350);
    const e0 = await A.pg.evaluate(() => window.__ECRITURES);
    await A.pg.keyboard.type('0');
    await A.pg.locator('[data-dep-cat-rapide="materiel"]').click(); await A.pg.waitForTimeout(250);
    const z = await A.pg.evaluate(() => ({ e: window.__ECRITURES, err: (document.querySelector('[data-dep-erreur-rapide]') || {}).textContent || '' }));
    dit(z.e === e0 && /plus grand que 0/.test(z.err), `D4 ${ou} : montant nul ⇒ rien n’est écrit, la raison est dite`, z);
    await A.pg.keyboard.press('Escape'); await A.pg.waitForTimeout(400);
    // D3 corbeille
    await A.pg.locator('[data-dep-ligne="ex1"]').click(); await A.pg.waitForTimeout(350);
    await A.pg.locator('[data-dep-retirer]').click(); await A.pg.waitForTimeout(500);
    const g = await A.pg.evaluate(() => !!document.querySelector('[data-dep-ligne="ex1"]'));
    dit(!g, `D3 ${ou} : « Mettre à la corbeille » la retire de la liste`);
    const n = await A.pg.evaluate(NATIF, '[data-dep-mois] .n-rangee, [data-dep-plus]');
    dit(!n.empilees && !n.deborde && !n.petites && !n.nan, `N ${ou} : aucune carte dans une carte, aucun débordement, cibles ≥ 44, ni NaN`, n);
    dit(!A.erreurs.length, `${ou} : aucune erreur de page`, A.erreurs);
  } finally { await A.ctx.close(); }
  const B = await ouvrir(nav, port, { W, sombre, vue: 'depenses', extra: '&pret=0' });
  try {
    const p = await B.pg.evaluate(() => ({ dis: (document.querySelector('[data-dep-plus]') || {}).getAttribute ? document.querySelector('[data-dep-plus]').getAttribute('aria-disabled') : null }));
    await B.pg.locator('[data-dep-plus]').click({ force: true }).catch(() => {}); await B.pg.waitForTimeout(300);
    const q = await B.pg.evaluate(() => ({ feuille: !!document.querySelector('[data-dep-feuille]'), e: window.__ECRITURES }));
    await B.pg.screenshot({ path: path.join(SHOTS, `depenses-pas-lu-${W}-${th}.png`), fullPage: true });
    dit(p.dis === 'true' && !q.feuille && q.e === 0, `D5 ${ou} : nuage pas arrivé ⇒ « + Dépense » indisponible, rien n’est écrit`, { p, q });
  } finally { await B.ctx.close(); }
}

(async () => {
  try { construire(); } catch (e) { dit(false, 'les écrans se construisent (esbuild)', String(e.message || e).slice(0, 600)); process.exit(1); }
  const s = await servir(); const port = s.address().port;
  const nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) { await transp(nav, port, W, th === 'sombre'); await depenses(nav, port, W, th === 'sombre'); }
  } finally { await nav.close(); s.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc transp-depenses${MUT ? ' [MUTATION=' + MUT + ']' : ''} : ${ok} verts, ${ko} rouge(s) · captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
