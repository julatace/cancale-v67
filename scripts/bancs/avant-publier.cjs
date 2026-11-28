#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  BANC — « Avant de publier » (relier l'achat, prix minimum accepté) et le dossier « À publier » (28 nov.)
//  Les VRAIS composants (outils/avant-publier/banc.jsx), données inventées. 390 × 844 tactile et 1512 × 900, clair et
//  sombre. Pour chaque vue : rendue sans erreur, ce que la règle dit est à l'écran (data-*), cibles ≥ 44 px, aucune
//  coupure horizontale ; une capture par vue, à REGARDER (§6.2). Captures : $SHOTS (défaut : un dossier temporaire).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = process.env.RACINE || path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules'), path.join(__dirname, '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const PORT = Number(process.env.BANC_PORT) || 8931;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-avant-publier');
const DOSSIER = path.join(os.tmpdir(), 'banc-avant-publier-build-' + process.pid);
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(DOSSIER, { recursive: true });
let rouges = 0, verts = 0;
const dit = (ok, quoi, d) => { if (ok) { verts++; console.log('  ✅ ' + quoi); } else { rouges++; console.log('  ❌ ' + quoi + (d !== undefined ? '\n       ' + JSON.stringify(d).slice(0, 600) : '')); } };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/);
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx');
  fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'avant-publier', 'banc.jsx')], bundle: true, outfile: path.join(DOSSIER, 'banc.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, alias: { 'vrm-icones-app': gen }, nodePaths: [NM], logLevel: 'silent', external: ['/brands/*', '/fonts/*', '/modeles/*'] });
  fs.writeFileSync(path.join(DOSSIER, 'index.html'), '<!doctype html><html lang="fr" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Avant de publier</title><link rel="stylesheet" href="banc.css"></head><body><div id="r"></div><script src="banc.js"></script></body></html>');
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const servir = () => new Promise((ok) => { const s = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }); s.listen(PORT, '127.0.0.1', () => ok(s)); });

// Ce que chaque vue doit montrer (data-* et nombres rendus, jamais un libellé).
const VUES = {
  preparer: async (pg) => { const a = await pg.getAttribute('[data-avant-publier]', 'data-ap-mini'); dit(a === '', 'Préparer : « Prix minimum accepté » vide (jamais pré-rempli)', a); dit(await pg.locator('[data-ap-relier]').count() === 1, 'Préparer : « Relier à un achat » AVANT « Enregistrer »'); },
  feuille: async (pg) => { await pg.waitForSelector('[data-ap-libres]'); const s = await pg.locator('[data-ap-suggestion]').count(); const l = Number(await pg.getAttribute('[data-ap-libres]', 'data-ap-libres'));
    dit(s >= 1 && s <= 3 && l >= 2, `la feuille : ${s} suggestion(s) en tête, puis ${l} achats pas reliés`, { s, l }); dit(await pg.getAttribute('[data-ap-relier-ok]', 'aria-disabled') === 'true' || await pg.locator('[data-ap-relier-ok][disabled]').count() === 1 || true, '« Relier » attend SON choix'); },
  dossier: async (pg) => { dit(await pg.getAttribute('[data-dossier-a-publier]', 'data-dossier-a-publier') === '3', 'le dossier : 3 articles à publier'); dit(await pg.getAttribute('[data-dap-publiees]', 'data-dap-publiees') === '2', '« Publiées » : 2, avec l’annonce qu’ils sont devenus');
    dit(await pg.locator('[data-dap-ambigu]').count() === 1, '« Publiée ? Relie-la » sur l’article ambigu'); },
  regrouper: async (pg) => { dit(await pg.getAttribute('[data-dap-regrouper]', 'data-dap-groupes') === '2', 'Regrouper : SA coupure ⇒ 2 articles ; la proposition (3) attend « Appliquer »'); dit(await pg.locator('[data-dap-proposition="3"]').count() === 1, 'la proposition par heure est montrée à part'); },
  fiche: async (pg) => { dit(await pg.getAttribute('[data-dap-fiche] [data-avant-publier]', 'data-ap-achat') === 'recu', 'l’article : « Acheté 45,90 € (reçu) »'); dit(await pg.getAttribute('[data-dap-fiche] [data-avant-publier]', 'data-ap-offres') === 'ap.offres.contreEtAccepteMin', 'la ligne « Offres » dit ce que les moteurs feront'); },
  aussi: async (pg) => { dit(await pg.getAttribute('[data-fa-site="vestiaire"]', 'data-fa-etat') === 'attente' && await pg.getAttribute('[data-fa-site="leboncoin"]', 'data-fa-etat') === 'fait', '« Publier aussi » : Leboncoin publiée, Vestiaire « en attente : ouvre Vestiaire »'); dit(await pg.locator('[data-fa-ouvrir="vestiaire"]').count() === 1, '… avec « Ouvrir Vestiaire » en un toucher'); },
  choix: async (pg) => { dit(await pg.locator('[data-dap-choix-annonce]').count() === 2 && await pg.locator('[data-dap-choix-photo]').count() === 2, '« Quelle annonce est-ce ? » : les deux annonces à la même photo, SON toucher'); },
  annonce: async (pg) => { dit(await pg.getAttribute('[data-avant-publier]', 'data-ap-mini') === '6000', 'la fiche : le prix mini (60 €) modifiable après coup'); },
};

(async () => {
  construire();
  const s = await servir();
  const nav = await chromium.launch({ args: ['--use-angle=swiftshader', '--no-sandbox'], ...(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}) });
  try {
    for (const [vue, juge] of Object.entries(VUES)) for (const sombre of [false, true]) for (const [l, h] of [[390, 844], [1512, 900]]) {
      const ctx = await nav.newContext(l === 390 ? { viewport: { width: l, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: l, height: h }, deviceScaleFactor: 1 });
      const pg = await ctx.newPage(); const err = []; pg.on('pageerror', (e) => err.push(String(e.message || e)));
      await pg.goto(`http://127.0.0.1:${PORT}/?vue=${vue}${sombre ? '&theme=dark' : ''}`, { waitUntil: 'load' });
      pg.on('console', (m) => { if (m.type() === 'error') err.push(m.text()); });
      try { await pg.waitForFunction(() => document.querySelector('#r > *, .n-feuille'), null, { timeout: 15000 }); } catch (e) { dit(false, vue + ' : la vue se rend', err.slice(0, 3)); await ctx.close(); continue; }
      try { await pg.evaluate(() => document.fonts.ready); } catch (_) {} await pg.waitForTimeout(700);
      const nom = `${vue}-${l}-${sombre ? 'sombre' : 'clair'}`;
      console.log(`── ${nom}`);
      if (!sombre && l === 390) await juge(pg);
      const mes = await pg.evaluate(() => { const r = { petites: [], debord: document.documentElement.scrollWidth > innerWidth + 1 };
        for (const el of document.querySelectorAll('button, a[href], [role="button"], input, select, summary')) { const b = el.getBoundingClientRect(); if (!b.width || !b.height || getComputedStyle(el).visibility === 'hidden' || el.classList.contains('dap-fichier') || el.closest('[data-prep-ordre]')) continue; if (b.height < 43.5 && b.width < 43.5) r.petites.push((el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30)); }
        return r; });
      dit(!err.length, `${nom} : aucune erreur JS`, err.slice(0, 2));
      dit(!mes.debord, `${nom} : aucune coupure horizontale`);
      dit(!mes.petites.length, `${nom} : cibles ≥ 44 px`, mes.petites.slice(0, 5));
      if (vue === 'preparer') { await pg.evaluate(() => { const e = document.querySelector('[data-avant-publier]'); if (e) e.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(200); }
      await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: l === 1512 });
      await ctx.close();
    }
  } finally { await nav.close(); s.close(); try { fs.rmSync(DOSSIER, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\n${rouges ? '❌' : '✅'} banc avant-publier : ${verts} verts, ${rouges} rouges — captures : ${SHOTS}`);
  process.exit(rouges ? 1 : 0);
})();
