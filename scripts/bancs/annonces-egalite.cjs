// ═══════════════════════════════════════════════════════════
//  BANC — ANNONCES À ÉGALITÉ (19 nov. 2026)
//
//  Julien : « je veux que tout soit comme Vinted, avec toutes les informations à côté ».
//  Construit outils/annonces-egalite/ (esbuild, hors paquet de prod) : l'écran natif
//  src/natif/ecrans/Annonces.jsx nourri par les VRAIES règles (src/articles/modele.js)
//  sur une base INVENTÉE — un vendeur Leboncoin seul, eBay seul, Vestiaire seul,
//  Vinted + les trois, une base de volume (400), une base vide.
//  Mesures (data-* et nombres, jamais un libellé) — 390 × 844 tactile (zone sûre),
//  1512 × 900 et 1280 × 800, clair et sombre :
//   P. parité : les MÊMES colonnes du tableau pour chaque vendeur ; chaque cellule
//      porte une valeur ou « — » (rien de vide) ; au téléphone chaque rangée dit
//      son prix, jamais « mini — » / « acheté — » répétés (20 nov. : le manque est dit UNE fois, en tête du groupe du compte) ;
//   B. aucun bouton plein dans une rangée ni dans le tableau ; un plein au plus par écran ;
//      aucun « Relier à Vinted » ;
//   C. contrastes ≥ 4,5:1 de chaque texte sur son fond rendu ;
//   T. cibles ≥ 44 × 44 au doigt (390) ;
//   D. aucun débordement horizontal ;
//   A. « Actions » ⇒ la liste passe en sélection (cases), le plein « {Action} · N » ;
//   V. vide ⇒ l'état vide dessiné ; volume ⇒ 60 rangées puis « Voir N de plus ».
//  `--prouve` : chaque mesure, faussée dans la page (un plein posé dans une rangée, une
//  cellule vidée, une colonne retirée), doit rougir. SHOTS : le dossier des captures.
// ═══════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const PORT = Number(process.env.BANC_PORT) || 8931;
const PROUVE = process.argv.includes('--prouve');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-annonces-egalite');
const DOSSIER = path.join(os.tmpdir(), 'banc-annonces-egalite-build-' + process.pid);
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(DOSSIER, { recursive: true });
let rouges = 0, verts = 0;
const dit = (ok, quoi, d) => { if (ok) { verts++; if (!PROUVE) console.log('  ✅ ' + quoi); } else { rouges++; if (!PROUVE) console.log('  ❌ ' + quoi + (d !== undefined ? '\n       ' + JSON.stringify(d).slice(0, 700) : '')); } return ok; };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/);
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx');
  fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'annonces-egalite', 'banc.jsx')], bundle: true, outfile: path.join(DOSSIER, 'banc.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    alias: { 'vrm-icones-app': gen }, nodePaths: [NM], logLevel: 'error' });
  fs.copyFileSync(path.join(RACINE, 'outils', 'annonces-egalite', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const servir = () => new Promise((ok) => { const s = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }); s.listen(PORT, () => ok(s)); });

// Ce que la page mesure d'elle-même.
const MESURE = () => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const lire = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const sur = (c, f) => ({ r: c.r * c.a + f.r * (1 - c.a), g: c.g * c.a + f.g * (1 - c.a), b: c.b * c.a + f.b * (1 - c.a), a: 1 });
  const fondDe = (el) => { const pile = []; for (let e = el; e; e = e.parentElement) { const c = lire(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break; } } let f = { r: 255, g: 255, b: 255, a: 1 }; if (document.documentElement.getAttribute('data-theme') === 'dark') f = { r: 0, g: 0, b: 0, a: 1 }; for (const c of pile.reverse()) f = sur(c, f); return f; };
  const r = { contrastes: [], cibles: [], debord: document.scrollingElement.scrollWidth - innerWidth, pleinsRangee: 0, pleins: 0, relier: 0, th: [], lignes: [], rangees: [], vide: !!document.querySelector('.n-vide'), plus: !!document.querySelector('[data-eg-plus]'), selection: document.querySelector('[data-eg-ecran]')?.getAttribute('data-eg-selection') || '' };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const el = t.parentElement; if (!t.nodeValue.trim() || !el) continue; const cs = getComputedStyle(el); const b = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || b.width === 0 || b.height === 0 || el.closest('[aria-hidden="true"],[hidden]') || b.bottom < 0 || b.top > innerHeight) continue;
    const c = lire(cs.color); if (!c) continue; const fd = fondDe(el); const x = sur({ ...c, a: c.a * Number(cs.opacity || 1) }, fd); const L1 = lum(x), L2 = lum(fd); const k = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (k < 4.5) r.contrastes.push({ t: t.nodeValue.trim().slice(0, 24), k: Math.round(k * 100) / 100 });
  }
  for (const el of document.querySelectorAll('button, a[href], [role="button"], input, .n-rangee[tabindex], tr[tabindex]')) {
    const b = el.getBoundingClientRect(); if (!b.width || !b.height || b.bottom < 0 || b.top > innerHeight || el.closest('[hidden],[aria-hidden="true"]')) continue;
    if (b.width < 44 || b.height < 44) r.cibles.push({ q: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 24), w: Math.round(b.width), h: Math.round(b.height) });
  }
  r.pleins = document.querySelectorAll('[data-n-variante="plein"]').length;
  r.pleinsRangee = document.querySelectorAll('[data-eg-article] [data-n-variante="plein"], [data-eg-tableau] [data-n-variante="plein"]').length;
  r.relier = [...document.querySelectorAll('[data-eg-article]')].filter((e) => /Relier à Vinted/.test(e.textContent)).length;
  r.th = [...document.querySelectorAll('[data-eg-th]')].map((e) => e.getAttribute('data-eg-th'));
  r.lignes = [...document.querySelectorAll('tr[data-eg-article]')].slice(0, 40).map((tr) => [...tr.querySelectorAll('[data-eg-col]')].map((td) => ({ c: td.getAttribute('data-eg-col'), v: td.textContent.trim().length > 0 })));
  r.rangees = [...document.querySelectorAll('.n-rangee[data-eg-article], [data-eg-article].n-rangee, [data-eg-liste] [data-eg-article]')].slice(0, 40).map((e) => ({ faits: !/mini —|acheté —/.test(e.textContent), prix: /€|—/.test(e.textContent) }));
  r.nRangees = document.querySelectorAll('[data-eg-article]').length;
  return r;
};
const COLS = ['article', 'numero', 'sites', 'prix', 'prixMini', 'achat', 'benefice', 'depuis'];
const TEL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
async function ouvrir(nav, opts, q) {
  const ctx = await nav.newContext(opts); const pg = await ctx.newPage();
  await pg.goto(`http://127.0.0.1:${PORT}/${q}`); await pg.waitForSelector('[data-eg-ecran]', { timeout: 15000 });
  if (opts.isMobile) await pg.addStyleTag({ content: ':root{--n-zone-haut:47px;--n-zone-bas:34px}' });
  await pg.waitForTimeout(150); return { ctx, pg };
}
async function juger(nav, mutant = '') {
  const parSite = {};
  for (const sombre of [false, true]) for (const [nomV, opts] of [['390', TEL], ['1512', { viewport: { width: 1512, height: 900 } }], ['1280', { viewport: { width: 1280, height: 800 } }]]) {
    for (const v of ['lbc', 'ebay', 'vc', 'tous', 'volume', 'vide']) {
      if (sombre && nomV === '1280' && v !== 'tous') continue;
      const { ctx, pg } = await ouvrir(nav, opts, `?v=${v}${sombre ? '&theme=dark' : ''}`);
      if (mutant === 'plein') await pg.evaluate(() => { const r = document.querySelector('[data-eg-article]'); if (r) { const b = document.createElement('button'); b.setAttribute('data-n-variante', 'plein'); b.textContent = 'Relier à Vinted'; r.appendChild(b); } });
      if (mutant === 'cellule') await pg.evaluate(() => { const td = document.querySelector('tr[data-eg-article] [data-eg-col="prixMini"]'); if (td) td.textContent = ''; const r = document.querySelector('[data-eg-liste] [data-eg-article]'); if (r) r.textContent = 'x'; });
      if (mutant === 'colonne') await pg.evaluate(() => { const th = document.querySelector('[data-eg-th="achat"]'); if (th && location.search.includes('v=lbc')) th.remove(); });
      if (mutant === 'contraste') await pg.addStyleTag({ content: '.n-rangee-titre,.n-eg-article-titre{color:#bbb !important}' });
      const r = await pg.evaluate(MESURE);
      const ou = `${v} · ${nomV}${sombre ? ' · sombre' : ''}`;
      if (v === 'vide') dit(r.vide && r.nRangees === 0, `V ${ou} : l'état vide est dessiné, aucune rangée`);
      else {
        dit(r.nRangees > 0, `P ${ou} : ${r.nRangees} annonces rendues`);
        dit(r.pleinsRangee === 0 && r.relier === 0 && r.pleins <= 1, `B ${ou} : aucun plein ni « Relier à Vinted » dans une rangée (${r.pleins} plein à l'écran)`, r);
        if (nomV !== '390') {
          dit(JSON.stringify(r.th) === JSON.stringify(COLS), `P ${ou} : les 8 colonnes du tableau`, r.th);
          dit(r.lignes.length > 0 && r.lignes.every((l) => l.length === 8 && l.every((c) => c.v)), `P ${ou} : chaque cellule porte une valeur ou « — »`, r.lignes.find((l) => l.length !== 8 || l.some((c) => !c.v)));
          parSite[v] = parSite[v] || r.th.join(',');
        } else {
          dit(r.rangees.length > 0 && r.rangees.every((x) => x.faits && x.prix), `P ${ou} : chaque rangée dit son prix, et jamais « mini — » / « acheté — » (un manque est dit une fois, en tête du compte — 20 nov.)`, r.rangees.find((x) => !x.faits || !x.prix));
          dit(r.cibles.length === 0, `T ${ou} : cibles ≥ 44 × 44`, r.cibles.slice(0, 6));
        }
        if (v === 'volume') dit(r.nRangees === 60 && r.plus, `V ${ou} : 60 rangées puis « Voir N de plus »`, r.nRangees);
      }
      dit(r.contrastes.length === 0, `C ${ou} : contrastes ≥ 4,5:1`, r.contrastes.slice(0, 6));
      dit(r.debord <= 0, `D ${ou} : aucun débordement horizontal`, r.debord);
      if (!mutant) await pg.screenshot({ path: path.join(SHOTS, `${v}-${nomV}${sombre ? '-sombre' : ''}.png`), fullPage: false });
      await ctx.close();
    }
  }
  const formes = new Set(Object.values(parSite));
  dit(formes.size === 1, 'P les mêmes colonnes pour le vendeur Leboncoin seul, eBay seul, Vestiaire seul et Vinted + les trois', parSite);
  if (mutant) return;
  // A. « Actions » ⇒ sélection.
  for (const [nomV, opts] of [['390', TEL], ['1512', { viewport: { width: 1512, height: 900 } }]]) {
    const { ctx, pg } = await ouvrir(nav, opts, '?v=lbc');
    await pg.click('[data-eg-actions]'); await pg.waitForSelector('[data-eg-action]'); await pg.click('[data-eg-action]');
    await pg.waitForTimeout(400);
    await pg.click('[data-eg-tout]'); await pg.waitForTimeout(200);
    const r = await pg.evaluate(() => ({ sel: document.querySelector('[data-eg-ecran]').getAttribute('data-eg-selection'), coches: document.querySelectorAll('[data-eg-coche="1"]').length, n: document.querySelector('[data-eg-lancer]')?.getAttribute('data-eg-n'), phrase: !!document.querySelector('[data-eg-phrase]') }));
    dit(r.sel && r.coches > 0 && String(r.coches) === r.n && r.phrase, `A ${nomV} : « Actions » ⇒ sélection, « tout sélectionner » coche ${r.coches}, le plein dit ${r.n}, une phrase d'explication`, r);
    await pg.screenshot({ path: path.join(SHOTS, `actions-${nomV}.png`) });
    await ctx.close();
  }
}
(async () => {
  construire();
  const s = await servir();
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    if (PROUVE) {
      let pris = 0; const M = ['plein', 'cellule', 'colonne', 'contraste'];
      for (const m of M) { const avant = rouges; await juger(nav, m); const ok = rouges > avant; if (ok) pris++; console.log(`${ok ? '✅' : '❌'} mutation « ${m} » ⇒ ${ok ? (rouges - avant) + ' rouge(s)' : 'VERTE'}`); }
      console.log(pris === M.length ? `\n✅ ${pris}/${M.length} mutations attrapées` : `\n❌ ${M.length - pris} mutation(s) non vue(s)`);
      process.exitCode = pris === M.length ? 0 : 1;
    } else {
      await juger(nav);
      console.log(rouges ? `\n❌ banc annonces-egalite : ${rouges} rouge(s), ${verts} vert(s) — captures : ${SHOTS}` : `\n✅ banc annonces-egalite : ${verts} verts — captures : ${SHOTS}`);
      process.exitCode = rouges ? 1 : 0;
    }
  } finally { await nav.close(); s.close(); fs.rmSync(DOSSIER, { recursive: true, force: true }); }
})();
