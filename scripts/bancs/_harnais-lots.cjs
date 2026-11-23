// ════════════════════════════════════════════════════════════════════════════
//  HARNAIS COMMUN DES BANCS DU 23 NOV. (lots rentabilite-source, calendrier-semaine, appareils-connectes,
//  photos-un-geste, historique-paire). Il monte un VRAI composant de l'app, seul, hors du paquet de prod
//  (`outils/<lot>/ecran.jsx`, données INVENTÉES : le dépôt est public), le sert, et ouvre 390 × 844 tactile et 1512,
//  clair et sombre (`LARGEURS`, `THEMES`), `locale: 'fr-FR'`, heure de Paris. Même méthode que
//  scripts/bancs/rentabilite.cjs (esbuild, ICON_PATHS de l'app recopiés).
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
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };

function construire(lot) {
  const dos = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-' + lot + '-'));
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/); if (!m) throw new Error('ICON_PATHS introuvable');
  const gen = path.join(dos, 'icones-app.gen.jsx'); fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', lot, 'ecran.jsx')], bundle: true, outfile: path.join(dos, 'ecran.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file', '.png': 'file', '.svg': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    alias: { 'vrm-icones-app': gen }, external: ['/brands/*', '/modeles/*'], nodePaths: [NM], logLevel: 'error' });
  fs.writeFileSync(path.join(dos, 'index.html'), '<!doctype html><html lang="fr" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Banc</title><link rel="stylesheet" href="ecran.css"></head><body><div id="r"></div><script src="ecran.js"></script></body></html>');
  return dos;
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const servir = (racine, port) => new Promise((res, rej) => { const s = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/' || !path.extname(u)) u = '/index.html';
  const f = path.join(racine, u.replace(/^\/+/, '')); if (!f.startsWith(racine) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  s.on('error', rej); s.listen(port, () => res(s)); });

// Ce que la direction visuelle interdit et qu'un banc voit : débordement horizontal, NaN, cibles < 44 (sur `sel`).
const REGLES_PAGE = (sel) => {
  const vis = (x) => x.getClientRects().length > 0;
  const deborde = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  const petites = sel ? [...document.querySelectorAll(sel)].filter(vis).map((x) => x.getBoundingClientRect().height).filter((h) => h > 0 && h < 44).length : 0;
  return { deborde, petites, nan: /NaN|undefined|Infinity|\[object Object\]/.test(document.body.innerText) };
};

// Lance le banc : `parcours(pg, { W, th, tel, url })` pour chaque largeur × thème ; captures dans SHOTS.
async function lancer({ lot, url = '/', parcours, mutation = null }) {
  const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-' + lot); fs.mkdirSync(SHOTS, { recursive: true });
  let dos;
  try { dos = construire(lot); } catch (e) { dit(false, 'le harnais se construit', String(e.message || e).slice(0, 400)); return fin(); }
  if (mutation) { try { mutation(dos); } catch (_) {} }
  const port = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
  const srv = await servir(dos, port);
  const nav = await chromium.launch({ args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) {
      const tel = W < 600, sombre = th === 'sombre';
      console.log(`\n── ${lot} · ${W} · ${th}`);
      const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: W, height: 900 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
      const pg = await ctx.newPage(); const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
      try {
        const u = `http://localhost:${port}${url}${url.includes('?') ? '&' : '?'}theme=${sombre ? 'dark' : 'light'}`;
        await pg.goto(u, { waitUntil: 'load' });
        await parcours(pg, { W, th, tel, SHOTS, dit });
      } catch (e) { dit(false, `${W} ${th} : le parcours`, String(e.message || e).slice(0, 300)); }
      dit(!erreurs.length, `${W} ${th} : aucune erreur dans la page`, erreurs);
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); try { fs.rmSync(dos, { recursive: true, force: true }); } catch (_) {} }
  return fin();
}
function fin() { console.log(`\n${ko ? '❌' : '✅'} ${ok} verts, ${ko} rouges`); process.exitCode = ko ? 1 : 0; return { ok, ko }; }
module.exports = { lancer, dit, REGLES_PAGE, RACINE };
