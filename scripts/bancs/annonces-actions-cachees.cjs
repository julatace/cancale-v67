// ════════════════════════════════════════════════════════════════════════════
//  BANC « LES ATELIERS D'ANNONCES MARCHENT SANS LA GRILLE CACHÉE » (23 nov., latence-2)
//    node scripts/bancs/annonces-actions-cachees.cjs [dist] [port]     JSON=<fichier> : le résultat (pour comparer avant / après)
//  L'écran Annonces Vinted d'hier reste monté, caché, sous la liste à égalité : il porte les ateliers que « Actions » ouvre
//  (`demanderActionAnnonces` → `lancerActionSel`). Depuis le 23 nov., il ne rend plus ses vignettes (src/annoncesCachees.js).
//  Sur la vraie app (base INVENTÉE au volume de la sienne, `_base-volume`), 390 tactile et 1512, il JUGE :
//    A. chaque action de « Actions » qui passe par l'écran d'hier, toutes les annonces cochées, « Lancer » ⇒ l'écran d'hier
//       RÉPOND : un atelier s'ouvre (une feuille) ou SA raison est dite (un message) — jamais « Coche au moins une annonce »
//       (sa liste vide) ni le silence (écran absent) ;
//    G. RAPPORTE le nombre de vignettes rendues dans l'écran caché (0 attendu après le 23 nov.) et le nombre d'éléments.
//  Mutation (prouvée le 23 nov.) : l'écran d'hier non monté (App.jsx, `<CacheSiV2 si>{null}`) ⇒ G et A rouges.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, ventes: 1500, achats: 800, annonces: 1200 });
const DIST = path.resolve(process.argv[2] || path.join(RACINE, 'dist'));
const PORT = +(process.argv[3] || process.env.BANC_PORT || 20000 + Math.floor(Math.random() * 9000));
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); }).listen(PORT);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, ko = 0; const sortie = {};
const dit = (bon, quoi, d) => { if (bon) ok++; else ko++; console.log((bon ? '  ✅ ' : '  ❌ ') + quoi + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 400) : '')); };
// `baisser` ouvre le PANNEAU de l'extension (`FeuilleAnnoncesExtension`, décision du 20 nov.) : sans extension dans le banc,
// rien ne s'affiche, avant comme après — rapporté, pas jugé.
const PAR_ECRAN_HIER = (k) => !['prixSites', 'pauseLbc', 'agent', 'partout'].includes(k);
const SANS_EXTENSION_MUET = new Set(['baisser']);
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const fmt of ['tel', 'ordi']) {
      const tel = fmt === 'tel';
      const ctx = await nav.newContext(tel ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR' } : { viewport: { width: 1512, height: 945 }, locale: 'fr-FR' });
      await ctx.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); } catch (_) {} });
      await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
      await ctx.route('**/rest/v1/**', async (route) => { const rq = route.request(); if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base); return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) }); });
      await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
      const pg = await ctx.newPage(); const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));
      const ouvrir = async () => { await pg.goto(`http://localhost:${PORT}/?tab=annonces`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await pg.waitForSelector('[data-eg-ecran]', { timeout: 90000, state: 'visible' }); await attendre(5000); };
      await ouvrir();
      const g = await pg.evaluate(() => ({ vignettesCachees: document.querySelectorAll('.v2-cache [data-carte-annonce]').length, ecranHier: !!document.querySelector('.v2-cache .vrm-ann-grid'), noeuds: document.getElementsByTagName('*').length }));
      console.log(`  · ${fmt} : écran d'hier monté ${g.ecranHier ? 'oui' : 'non'} · vignettes rendues dans l'écran caché : ${g.vignettesCachees} · ${g.noeuds} éléments`);
      dit(g.ecranHier, `${fmt} G l'écran d'hier (ses ateliers) est monté, caché`);
      sortie[fmt] = { ...g, actions: {} };
      // À l'ordinateur, « Actions » est la barre d'outils du tableau de travail (src/natif/TableauTravail.jsx) : même chemin
      // (`onAction` → `demanderActionAnnonces`) ; le banc y relève G seulement.
      if (!tel) { dit(!erreurs.length, `${fmt} aucune erreur de page`, erreurs.slice(0, 3)); await ctx.close(); continue; }
      await pg.click('[data-eg-actions]'); await pg.waitForSelector('[data-eg-action]', { timeout: 10000 });
      const cles = (await pg.$$eval('[data-eg-action]', (L) => L.map((x) => x.getAttribute('data-eg-action')))).filter(PAR_ECRAN_HIER);
      await pg.keyboard.press('Escape'); await attendre(500);
      if (!cles.length) dit(false, `${fmt} A au moins une action passe par l'écran d'hier`, cles);
      for (const k of cles) {
        await ouvrir();
        await pg.click('[data-eg-actions]'); await pg.waitForSelector(`[data-eg-action="${k}"]`, { timeout: 10000 }); await pg.click(`[data-eg-action="${k}"]`); await attendre(500);
        const tout = pg.locator('[data-eg-tout]').first(); if (await tout.count()) { await tout.click(); await attendre(300); }
        const lancer = pg.locator('[data-eg-lancer]').first();
        const dispo = await lancer.count() ? await lancer.evaluate((b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true') : false;
        if (!dispo) { console.log(`    ${fmt} « ${k} » : « Lancer » indisponible ici (sa règle) — pas jugé`); sortie[fmt].actions[k] = 'indisponible'; continue; }
        const avantDialogues = await pg.evaluate(() => [...document.querySelectorAll('[role="dialog"], .n-feuille')].filter((x) => x.getClientRects().length).length);
        await lancer.click();
        let rep = null;
        for (let i = 0; i < 30 && !rep; i++) { await attendre(200); rep = await pg.evaluate((n0) => { const t = [...document.querySelectorAll('.vrm-toast')].map((x) => x.innerText.trim()).filter(Boolean); const d = [...document.querySelectorAll('[role="dialog"], .n-feuille')].filter((x) => x.getClientRects().length);
          if (t.length) return { sorte: 'message', texte: t.join(' | ').slice(0, 160) };
          const fe = document.querySelector('[data-feuille-annonces-ext]'); if (fe) return { sorte: 'feuille-extension', n: fe.getAttribute('data-feuille-annonces-ext'), visible: !!fe.getClientRects().length }; if (d.length > n0) return { sorte: 'atelier', attrs: [...d[d.length - 1].attributes].filter((a) => a.name.startsWith('data-')).map((a) => a.name).slice(0, 4).join(' ') }; return null; }, avantDialogues); }
        sortie[fmt].actions[k] = rep;
        if (SANS_EXTENSION_MUET.has(k)) { console.log(`    ${fmt} « ${k} » : ${JSON.stringify(rep)} (panneau de l'extension — pas jugé)`); continue; }
        dit(!!rep && !(rep.sorte === 'message' && /Coche au moins une annonce/.test(rep.texte)), `${fmt} A « ${k} » : l'écran d'hier répond (atelier ouvert ou sa raison)`, rep);
        await pg.screenshot({ path: path.join(process.env.SHOTS || require('os').tmpdir(), `actions-cachees-${fmt}-${k}.png`) }).catch(() => {});
      }
      // R. (23 nov. soir) Annonces est un écran GARDÉ : Annonces → Ventes → Annonces par la barre (l'écran revient tel quel),
      //    puis « Actions » → « Republier à la main » ⇒ l'atelier s'ouvre encore (l'écran d'hier, gelé puis dégelé, répond).
      if (cles.includes('main')) {
        await ouvrir();
        const marque = await pg.evaluate(() => { const e = document.querySelector('[data-eg-ecran]'); if (e) e.__vrmBanc = 1; return !!e; });
        const onglet = (o) => pg.locator(`[data-n-onglet="${o}"]:visible, [data-nav-entree="${o}"]:visible`).first().tap();
        await onglet('ventes'); await attendre(3000); await onglet('annonces'); await pg.waitForSelector('[data-eg-ecran]', { timeout: 30000, state: 'visible' }); await attendre(1500);
        const revenu = await pg.evaluate(() => { const e = document.querySelector('[data-eg-ecran]'); return !!(e && e.__vrmBanc); });
        dit(marque && revenu, `${fmt} R Annonces revient TELLE QUELLE après Ventes (écran gardé)`, { marque, revenu });
        await pg.click('[data-eg-actions]'); await pg.waitForSelector('[data-eg-action="main"]', { timeout: 10000 }); await pg.click('[data-eg-action="main"]'); await attendre(500);
        const tout = pg.locator('[data-eg-tout]').first(); if (await tout.count()) { await tout.click(); await attendre(300); }
        await pg.locator('[data-eg-lancer]').first().click();
        let rep = null; for (let i = 0; i < 30 && !rep; i++) { await attendre(200); rep = await pg.evaluate(() => { const d = [...document.querySelectorAll('[data-repub-main]')].filter((x) => x.getClientRects().length); return d.length ? 'atelier' : null; }); }
        dit(rep === 'atelier', `${fmt} R après le retour, « Republier à la main » ouvre encore son atelier`, rep);
      }
      dit(!erreurs.length, `${fmt} aucune erreur de page`, erreurs.slice(0, 3));
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(sortie, null, 1));
  console.log(ko ? `\n❌ banc annonces-actions-cachees : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ banc annonces-actions-cachees : ${ok} verts`);
  process.exitCode = ko ? 1 : 0;
})();
