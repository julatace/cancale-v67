// ═══════════════════════════════════════════════════════════
//  BANC — LES TABLEAUX TIENNENT DANS LEUR LARGEUR (21 nov. 2026)
//
//  Julien (production, Chrome sur Mac, barre latérale ouverte) : « On doit glisser de gauche à droite pour pouvoir tout voir,
//  tu peux tout étendre. » Le tableau Annonces débordait de sa zone (défilement horizontal, colonne Article coupée à gauche,
//  intertitre « onces »), et « 82 articles » / « Colonnes » passaient sous la barre d'outils collante.
//  Construit outils/tableaux-largeur/ (les VRAIES vues dans la VRAIE coque, données inventées de la forme de production :
//  titres longs, Prix mini / Acheté vides partout, Liaison avec propositions).
//  Mesures — Annonces, Ventes, Achats ; 1180, 1280, 1440, 1512, 1920 px ; barre latérale ouverte et fermée :
//   L1 aucun défilement horizontal : scrollWidth ≤ clientWidth du cadre du tableau, et de la page ;
//   L2 le titre de l'article visible : la colonne Article ≥ 200 px, son titre ≥ 200 px (Annonces), commence DANS le cadre ;
//   L3 rien sous la barre collante : le compteur « N articles » et « Colonnes » sont DANS la barre collante, après défilement ;
//   L4 Annonces : une colonne vide partout (Prix mini, Acheté) n'est pas montrée ; la colonne N° et le Statut restent.
//  Rouge sur l'arbre d'avant (origin/main). SHOTS : les captures (à REGARDER).
// ═══════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const VUES = liste('VUES', 'annonces,ventes,achats'), LARGEURS = liste('LARGEURS', '1180,1280,1440,1512,1920').map(Number);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-tableaux-largeur'); fs.mkdirSync(SHOTS, { recursive: true });
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'tableaux-largeur-'));
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 400) : '')); } return c; };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/);
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx'); fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'tableaux-largeur', 'ecran.jsx')], bundle: true, outfile: path.join(DOSSIER, 'ecran.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file', '.svg': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    external: ['/brands/*'], alias: { 'vrm-icones-app': gen }, nodePaths: [NM], logLevel: 'silent' });
  fs.copyFileSync(path.join(RACINE, 'outils', 'tableaux-largeur', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };
const servir = () => new Promise((res) => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
  if (/^\/brands\//.test(u)) { r.writeHead(200, { 'content-type': 'image/svg+xml' }); return r.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>'); }
  const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); });
  s.listen(Number(process.env.BANC_PORT) || 0, () => res(s)); });

const MESURE = () => {
  const cadre = document.querySelector('[data-tt-tableau]');
  const th = document.querySelector('[data-tt-th="article"]');
  const titres = [...document.querySelectorAll('tr[data-tt-ligne] .n-tt-article-titre')].slice(0, 20).map((e) => Math.round(e.getBoundingClientRect().width));
  const cb = cadre ? cadre.getBoundingClientRect() : null;
  const premier = document.querySelector('tr[data-tt-ligne] [data-tt-col="article"]');
  const colle = document.querySelector('[data-tt-colle]');
  const nombre = document.querySelector('[data-tt-nombre]');
  return {
    cadre: cadre ? { sw: cadre.scrollWidth, cw: cadre.clientWidth } : null,
    page: document.documentElement.scrollWidth - innerWidth,
    article: th ? Math.round(th.getBoundingClientRect().width) : 0,
    titres, titreMin: titres.length ? Math.min(...titres) : 0,
    articleDedans: premier && cb ? premier.getBoundingClientRect().left >= cb.left - 1 : false,
    nombreDansColle: !!(colle && nombre && colle.contains(nombre)),
    colonnes: [...document.querySelectorAll('[data-tt-th]')].map((e) => e.getAttribute('data-tt-th')),
  };
};
(async () => {
  construire();
  const s = await servir(); const port = s.address().port;
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const vue of VUES) for (const W of LARGEURS) for (const lat of ['1', '0']) {
      const ou = `${vue} · ${W} · barre latérale ${lat === '1' ? 'ouverte' : 'fermée'}`;
      const ctx = await nav.newContext({ viewport: { width: W, height: 900 } });
      const pg = await ctx.newPage(); const err = []; pg.on('pageerror', (e) => err.push(String(e.message).slice(0, 160)));
      await pg.goto(`http://localhost:${port}/?vue=${vue}&laterale=${lat}`); await pg.waitForSelector('[data-tt-tableau]', { timeout: 20000 }).catch(() => {});
      await pg.waitForTimeout(600);
      const r = await pg.evaluate(MESURE);
      dit(!err.length && r.cadre && r.cadre.sw <= r.cadre.cw + 1 && r.page <= 1, `L1 ${ou} : aucun défilement horizontal (tableau ${r.cadre ? r.cadre.sw + ' / ' + r.cadre.cw : '?'} px)`, { err, cadre: r.cadre, page: r.page, colonnes: r.colonnes });
      dit(r.article >= 200 && r.articleDedans && (vue !== 'annonces' || r.titreMin >= 200), `L2 ${ou} : colonne Article ${r.article} px, titre ≥ ${r.titreMin} px, visible dans le cadre`, { article: r.article, titreMin: r.titreMin, dedans: r.articleDedans });
      if (vue === 'annonces') dit(!r.colonnes.includes('prixMini') && !r.colonnes.includes('achat') && r.colonnes.includes('numero') && r.colonnes.includes('statut'), `L4 ${ou} : Prix mini / Acheté vides partout ⇒ repliées ; N° et Statut gardés`, r.colonnes);
      await pg.evaluate(() => window.scrollTo(0, 260)); await pg.evaluate(() => { const e = document.querySelector('.n-coque-ecran'); if (e) e.scrollTop = 260; }); await pg.waitForTimeout(200);
      const r2 = await pg.evaluate(MESURE);
      dit(r2.nombreDansColle, `L3 ${ou} : « N articles » et « Colonnes » dans la barre collante (rien dessous)`, r2.nombreDansColle);
      if (W === 1440 || W === 1180) { await pg.evaluate(() => { window.scrollTo(0, 0); const e = document.querySelector('.n-coque-ecran'); if (e) e.scrollTop = 0; }); await pg.screenshot({ path: path.join(SHOTS, `${vue}-${W}-lat${lat}.png`) }); }
      await ctx.close();
    }
  } finally { await nav.close(); s.close(); fs.rmSync(DOSSIER, { recursive: true, force: true }); }
  console.log(ko ? `\n❌ banc tableaux-largeur : ${ko} rouge(s), ${ok} vert(s) — captures : ${SHOTS}` : `\n✅ banc tableaux-largeur : ${ok} verts — captures : ${SHOTS}`);
  process.exitCode = ko ? 1 : 0;
})();
