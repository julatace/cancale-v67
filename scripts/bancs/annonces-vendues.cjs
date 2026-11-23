// ═══════════════════════════════════════════════════════════
//  BANC — ANNONCES · « VENDUE » ET LE FILTRE SITE, À L'ORDINATEUR (22 nov. 2026)
//
//  Julien (production, Annonces à l'ordinateur) : « j'ai fait 3 ventes mais pas que sur Leboncoin : applique un filtre par
//  plateforme, les filtres ne sont pas précis » — « Vendue · 3 » ne montrait que 3 annonces Leboncoin.
//  Construit outils/annonces-vendues/ (esbuild, hors paquet de prod) : le TABLEAU Annonces nourri par les VRAIES règles sur une
//  base INVENTÉE multi-sites (Vinted 2 comptes dont 3 ventes PROUVÉES sorties du dressing, Leboncoin, eBay).
//  Mesures (data-* et nombres, jamais un libellé) — 1512 × 900 et 1280 × 800, clair et sombre :
//   S. Statut « Vendue » = 7 (Vinted 3 + Leboncoin 3 + eBay 1) ; chaque statut coché SEUL ⇒ autant de rangées que son nombre ;
//   F. le filtre « Site » est dans la barre, à côté de Statut, chaque site avec son nombre = ses rangées ; Site ∩ Vendue juste ;
//   P. « Publier un article » est une touche de la barre (pas un plein seul sous le tableau) ; aucun bleu vif ;
//   N. aucune note des limites des sites en pied du tableau.
//  SHOTS : le dossier des captures. Sur l'arbre d'avant (git archive origin/main) : ROUGE (la règle n'existe pas).
// ═══════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = process.env.BANC_RACINE ? path.resolve(process.env.BANC_RACINE) : path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules'), path.join(__dirname, '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const PORT = Number(process.env.BANC_PORT) || 4797;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-annonces-vendues');
const DOSSIER = path.join(os.tmpdir(), 'banc-annonces-vendues-build-' + process.pid);
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(DOSSIER, { recursive: true });
let rouges = 0, verts = 0;
const dit = (ok, quoi, d) => { if (ok) { verts++; console.log('  ✅ ' + quoi); } else { rouges++; console.log('  ❌ ' + quoi + (d !== undefined ? '\n       ' + JSON.stringify(d).slice(0, 600) : '')); } };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/);
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx');
  fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'annonces-vendues', 'banc.jsx')], bundle: true, outfile: path.join(DOSSIER, 'banc.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file', '.svg': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    external: ['/brands/*'], alias: { 'vrm-icones-app': gen }, nodePaths: [NM], logLevel: 'silent' });
  fs.copyFileSync(path.join(RACINE, 'outils', 'annonces-vendues', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };
const servir = () => new Promise((ok) => { const s = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (/^\/brands\//.test(u)) { res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>'); return; }
  const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }); s.listen(PORT, () => ok(s)); });

const STATUTS = ['enligne', 'masquee', 'pause', 'aconfirmer', 'bloque', 'brouillon', 'vendue', 'retiree'];
(async () => {
  try { construire(); } catch (e) { console.log('❌ construction du banc impossible : ' + String(e.message).slice(0, 300)); process.exit(1); }
  const srv = await servir();
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  for (const [w, h] of [[1512, 900], [1280, 800]]) for (const theme of ['light', 'dark']) {
    const T = `${w} ${theme}`;
    const pg = await nav.newPage({ viewport: { width: w, height: h } });
    const err = []; pg.on('pageerror', (e) => err.push(String(e.message).slice(0, 160)));
    try {
      await pg.goto(`http://localhost:${PORT}/?theme=${theme}`); await pg.waitForSelector('[data-tt-ligne]', { timeout: 15000 });
      const attendu = await pg.evaluate(() => window.__banc.attendu);
      const menu = async (cle) => { await pg.click(`[data-tt-ouvre="${cle}"]`); await pg.waitForTimeout(120); };
      const fermer = async () => { await pg.keyboard.press('Escape'); await pg.waitForTimeout(80); };
      const lignes = () => pg.evaluate(() => [...document.querySelectorAll('[data-tt-ligne]')].map((e) => ({ s: e.getAttribute('data-tt-statut-ligne'), sites: (e.querySelector('[data-eg-logos]') || {}).getAttribute ? e.querySelector('[data-eg-logos]').getAttribute('data-eg-logos') : '' })));
      const nombres = () => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-tt-statut]')].map((e) => [e.getAttribute('data-tt-statut'), Number((e.querySelector('[data-tt-n]') || {}).getAttribute ? e.querySelector('[data-tt-n]').getAttribute('data-tt-n') : NaN)])));
      // S — Statut
      await menu('statut');
      const N = await nombres();
      await pg.screenshot({ path: path.join(SHOTS, `statut-menu-${w}-${theme}.png`) });
      dit(N.vendue === attendu.vendue, `${T} : « Vendue » = ${attendu.vendue} (tous sites)`, N);
      // chaque statut coché SEUL
      const faux = [];
      for (const s of STATUTS) {
        if (!(s in N)) continue;
        await pg.evaluate(() => { const b = document.querySelector('[data-tt-statuts-tous]'); if (b) b.click(); });
        await pg.waitForTimeout(60);
        // décocher les statuts par défaut, cocher le seul s
        await pg.evaluate((s) => { for (const e of document.querySelectorAll('[data-tt-statut]')) { const i = e.querySelector('input'); const veut = e.getAttribute('data-tt-statut') === s; if (i.checked !== veut) i.click(); } }, s);
        await pg.waitForTimeout(100);
        const L = await lignes();
        if (L.length !== N[s] || L.some((l) => l.s !== s)) faux.push({ s, n: N[s], rangees: L.length });
        if (s === 'vendue') {
          const sites = new Set(L.flatMap((l) => (l.sites || '').split(',').filter(Boolean)));
          dit(['vinted', 'leboncoin', 'ebay'].every((x) => sites.has(x)), `${T} : « Vendue » coché seul ⇒ des rangées Vinted, Leboncoin ET eBay`, [...sites]);
          await fermer(); await pg.screenshot({ path: path.join(SHOTS, `vendue-${w}-${theme}.png`), fullPage: true }); await menu('statut');
        }
      }
      dit(!faux.length, `${T} : chaque statut coché seul ⇒ autant de rangées que son nombre`, faux);
      await fermer();
      // F — Site
      const barre = await pg.evaluate(() => { const o = [...document.querySelectorAll('[data-tt-outils] [data-tt-ouvre]')].map((b) => b.getAttribute('data-tt-ouvre')); return o; });
      const iS = barre.indexOf('statut'), iF = barre.indexOf('filtre:site');
      dit(iF >= 0 && iF === iS + 1, `${T} : le filtre « Site » est dans la barre, juste après Statut`, barre);
      await menu('filtre:site');
      const parSite = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-tt-filtre-choix^="site:"]')].map((e) => [e.getAttribute('data-tt-filtre-choix').slice(5), Number(((e.textContent.match(/\d+/g) || []).pop()))])));
      await pg.screenshot({ path: path.join(SHOTS, `site-menu-${w}-${theme}.png`) });
      dit(Object.keys(attendu.parSite).every((s) => parSite[s] === attendu.parSite[s]), `${T} : chaque site dit son nombre de rangées`, { parSite, attendu: attendu.parSite });
      await pg.click('[data-tt-filtre-choix="site:leboncoin"]'); await pg.waitForTimeout(150);
      await menu('statut'); await pg.evaluate(() => { const b = document.querySelector('[data-tt-statuts-tous]'); if (b) b.click(); }); await pg.waitForTimeout(80);
      const NL = await nombres();
      await pg.evaluate(() => { for (const e of document.querySelectorAll('[data-tt-statut]')) { const i = e.querySelector('input'); const veut = e.getAttribute('data-tt-statut') === 'vendue'; if (i.checked !== veut) i.click(); } }); await pg.waitForTimeout(100);
      const LL = await lignes(); await fermer();
      dit(NL.vendue === 3 && LL.length === 3 && LL.every((l) => l.sites === 'leboncoin'), `${T} : Site Leboncoin ∩ Vendue = 3 rangées Leboncoin`, { NL, LL });
      await pg.screenshot({ path: path.join(SHOTS, `leboncoin-vendue-${w}-${theme}.png`), fullPage: true });
      // P / N
      const pn = await pg.evaluate(() => {
        const pub = document.querySelector('[data-eg-publier]');
        const dansBarre = !!(pub && pub.closest('[data-tt-outils]'));
        const bleu = pub ? getComputedStyle(pub).backgroundColor : '';
        const pied = document.querySelector('[data-tt-pied]');
        return { dansBarre, bleu, pied: pied ? pied.textContent : '' };
      });
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(pn.bleu || '');
      const estBleu = m && Number(m[3]) > 150 && Number(m[3]) > Number(m[1]) + 60;
      dit(pn.dansBarre && !estBleu, `${T} : « Publier un article » est une touche de la barre, pas un bouton bleu seul`, pn);
      dit(!/acceptation automatique/.test(pn.pied), `${T} : aucune note des limites des sites sous le tableau`, pn.pied);
      dit(!err.length, `${T} : aucune erreur dans la page`, err);
    } catch (e) { dit(false, `${T} — a levé : ${String(e.message).slice(0, 200)}`); }
    await pg.close();
  }
  await nav.close(); srv.close();
  console.log(`\n${rouges ? '❌' : '✅'} banc annonces-vendues : ${verts} vert(s), ${rouges} rouge(s) · captures : ${SHOTS}`);
  process.exit(rouges ? 1 : 0);
})();
