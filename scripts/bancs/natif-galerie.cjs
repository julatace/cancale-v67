// ════════════════════════════════════════════════════════════════════════════
//  BANC — LA GALERIE DE « VRM NATIF » (19 nov. 2026, contrat docs/design/NATIF.md)
//
//  Construit outils/natif-galerie/ (esbuild, pas Vite : la galerie n'est PAS dans le
//  paquet de prod), la sert, et JUGE chaque composant de src/natif/ dans ses états :
//  390 × 844 tactile (zone sûre émulée : 47 en haut, 34 en bas), 1512 × 900 et
//  1280 × 800, clair et sombre. Données INVENTÉES ; les icônes sont les VRAIS tracés
//  de l'app (ICON_PATHS extrait de src/App.jsx à la construction).
//
//  Ce qu'il mesure (des nombres et des data-*, jamais un libellé) :
//   S. la source : UNE couche `vrm-natif`, aucun `!important`, aucun `:has(`, aucun
//      dégradé, une ombre pour la feuille seule, le flou sur les deux barres seules,
//      aucune couleur en dur hors de jetons.css ;
//   C. contrastes ≥ 4,5:1 de CHAQUE texte sur le fond RENDU (fonds et voiles composés,
//      pseudo-éléments compris), placeholders compris ;
//   T. cibles au doigt ≥ 44 × 44 (390 tactile) ;
//   D. aucun débordement (page, cases), aucun texte coupé là où il ne doit pas l'être
//      (prix, plaque, pastille, libellé d'onglet, libellé de bouton) ;
//   G. graisses 400 / 600 / 700 seulement ; tailles 13 15 17 22 34 48 seulement (10 pour
//      le libellé d'onglet, nulle part ailleurs) ; rayons 8 10 12 14 ou rond seulement ;
//   I. les icônes : chaque glyphe dessine un tracé de l'app ;
//   F. les gestes : Segmente au clavier ; destructif en deux touchers ; balayage d'une
//      rangée (glisser, ← / Échap, geste franc, un défilement n'ouvre rien) ; feuille
//      (focus dedans, Tab piégé, détentes, glisser pour fermer, focus rendu) ; toast annulable ;
//   K. la coque : 5 onglets de même largeur, 49 px + zone sûre, rien sous la barre, grand
//      titre qui se réduit, « Plus » complet, page poussée et retour, ⌘K ; à l'ordinateur
//      barre latérale 240, liste 380–520, détail ≤ 760, état vide dessiné ; changer
//      d'onglet ne pose aucun attribut sur <html>, <body> ni la racine de la coque.
//
//  `--prouve` : chaque mutation (BANC_MUTANT, injectée en CSS) doit rendre SA mesure rouge.
//  BANC_PORT (défaut 8911). SHOTS : le dossier des captures (défaut : tmp).
//  `node scripts/bancs/natif-galerie.cjs [--prouve]`
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = process.env.RACINE || path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules'), path.join(__dirname, '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const PORT = Number(process.env.BANC_PORT) || 8911;
const PROUVE = process.argv.includes('--prouve');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-natif-galerie');
const DOSSIER = path.join(os.tmpdir(), 'banc-natif-galerie-build-' + process.pid);
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(DOSSIER, { recursive: true });

let rouges = 0, verts = 0;
const dit = (ok, quoi, detail) => {
  if (ok) { verts++; console.log('  ✅ ' + quoi); }
  else { rouges++; console.log('  ❌ ' + quoi + (detail !== undefined ? '\n       ' + JSON.stringify(detail).slice(0, 900) : '')); }
  return ok;
};

// ── S. la source ────────────────────────────────────────────────────────────
function source() {
  console.log('── S. la source (src/natif/*.css)');
  const lire = (f) => fs.readFileSync(path.join(RACINE, 'src', 'natif', f), 'utf8');
  const sansCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
  const jetons = sansCom(lire('jetons.css')), css = sansCom(lire('natif.css'));
  for (const [nom, s] of [['jetons.css', jetons], ['natif.css', css]]) {
    const couches = (s.match(/@layer\s+[\w-]+/g) || []);
    dit(couches.length === 1 && couches[0] === '@layer vrm-natif' && /^\s*@layer vrm-natif\s*\{/.test(s), `S ${nom} : UNE couche, vrm-natif, qui enveloppe tout`, couches);
    dit(!/!important/.test(s), `S ${nom} : aucun !important`);
    dit(!/:has\(/.test(s), `S ${nom} : aucun :has()`);
    dit(!/gradient\(/.test(s), `S ${nom} : aucun dégradé`);
  }
  const ombres = (css.match(/[^{}]*\{[^{}]*box-shadow\s*:[^{}]*\}/g) || []).map((b) => b.split('{')[0].trim());
  dit(ombres.length === 1 && /^\.n-feuille$/.test(ombres[0]), 'S une seule ombre : la feuille', ombres);
  const flous = (css.match(/[^{}]*\{[^{}]*[^-]backdrop-filter\s*:\s*var\(--n-flou\)[^{}]*\}/g) || []).map((b) => b.split('{')[0].trim()).sort();
  dit(flous.length === 2 && flous[0] === '.n-barre-titre::before' && flous[1] === '.n-onglets', 'S le flou : la barre de titre et la barre d’onglets, rien d’autre', flous);
  const durs = css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) || [];
  dit(durs.length === 0, 'S natif.css : aucune couleur en dur (tout passe par --n-*)', durs.slice(0, 8));
  const jsx = fs.readdirSync(path.join(RACINE, 'src', 'natif')).filter((f) => /\.jsx?$/.test(f));
  const sansTete = jsx.filter((f) => !/^\/\/ ── src\/natif\//.test(lire(f)));
  dit(sansTete.length === 0, `S chaque fichier (${jsx.length}) commence par son mode d’emploi`, sansTete);
  const fautifs = jsx.filter((f) => /from ['"][^'"]*App\.jsx['"]|fetch\(|localStorage|supabase/i.test(lire(f).replace(/^\s*\/\/.*$/gm, '')));
  dit(fautifs.length === 0, 'S composants présentationnels : ni App.jsx, ni lecture de données, ni stockage', fautifs);
}

// ── la construction ─────────────────────────────────────────────────────────
function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/);
  if (!m) throw new Error('ICON_PATHS introuvable dans src/App.jsx');
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx');
  fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({
    entryPoints: [path.join(RACINE, 'outils', 'natif-galerie', 'galerie.jsx')], bundle: true, outfile: path.join(DOSSIER, 'galerie.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    alias: { 'vrm-icones-app': gen }, nodePaths: [NM], logLevel: 'error',
  });
  fs.copyFileSync(path.join(RACINE, 'outils', 'natif-galerie', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff' };
function servir() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
      if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(fs.readFileSync(f));
    });
    s.listen(PORT, '127.0.0.1', () => ok(s));
  });
}

// ── le juge, DANS la page ───────────────────────────────────────────────────
const JUGE = function (opts) {
  const r = { textes: 0, contrastes: [], cibles: [], nCibles: 0, graisses: [], tailles: [], rayons: [], debords: [], coupes: [], glyphes: [], nGlyphes: 0 };
  const racines = [document.getElementById('r'), document.querySelector('[data-n-portail]')].filter(Boolean);
  const lire = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null;
    const p = m[1].replace(/\//g, ' ').split(/[\s,]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const sur = (h, b) => { const a = h.a; return { r: h.r * a + b.r * (1 - a), g: h.g * a + b.g * (1 - a), b: h.b * a + b.b * (1 - a), a: 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const visible = (el) => {
    if (!el || !el.getClientRects().length) return false;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    const b = el.getBoundingClientRect(); return b.width > 1.5 && b.height > 1.5;
  };
  const opaciteDe = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity || '1'); return o; };
  // Le fond rendu derrière `el` : les fonds de ses ancêtres (et leurs voiles ::before / ::after), composés du plus loin au plus près.
  const fondDe = (el) => {
    const couches = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      for (const ps of ['::after', '::before']) {
        const p = getComputedStyle(n, ps);
        if (p.content && p.content !== 'none' && p.content !== 'normal' && p.position === 'absolute') {
          const c = lire(p.backgroundColor); const o = parseFloat(p.opacity || '1');
          if (c && c.a * o > 0.001 && n !== el) couches.push({ ...c, a: c.a * o });
          else if (c && c.a * o > 0.001 && n === el && ps === '::after') couches.push({ ...c, a: c.a * o });
        }
      }
      const c = lire(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.001) couches.push(c);
    }
    let f = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = couches.length - 1; i >= 0; i--) f = sur(couches[i], f);
    return f;
  };
  const nom = (el) => { const g = el.closest('[data-g]'); return (g ? g.getAttribute('data-g') + ' ' : '') + el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).join('.') : ''); };
  const TAILLES = [13, 15, 17, 22, 34, 48], GRAISSES = ['400', '600', '700'], RAYONS = [0, 8, 10, 12, 14];
  const vus = new Set();
  for (const racine of racines) {
    const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      if (!t.nodeValue || !t.nodeValue.trim()) continue;
      const el = t.parentElement; if (!el || vus.has(el) || !visible(el)) continue;
      if (el.closest('.n-lu-seul, svg, [data-juge-ignore]')) continue;
      vus.add(el);
      const cs = getComputedStyle(el); const o = opaciteDe(el); if (o < 0.05) continue;
      r.textes++;
      const fond = fondDe(el); const c0 = lire(cs.color); if (!c0) continue;
      const c = sur({ ...c0, a: c0.a * o }, fond); const k = ratio(c, fond);
      if (k < 4.5) r.contrastes.push({ ou: nom(el), texte: t.nodeValue.trim().slice(0, 28), ratio: Math.round(k * 100) / 100, fond: [fond.r, fond.g, fond.b].map(Math.round).join(','), encre: [c.r, c.g, c.b].map(Math.round).join(',') });
      if (!GRAISSES.includes(String(cs.fontWeight))) r.graisses.push({ ou: nom(el), graisse: cs.fontWeight });
      const px = Math.round(parseFloat(cs.fontSize) * 100) / 100;
      const okTaille = TAILLES.includes(px) || (px === 10 && el.matches('.n-onglet-libelle'));
      if (!okTaille) r.tailles.push({ ou: nom(el), taille: px });
    }
    for (const el of racine.querySelectorAll('input')) {
      if (!visible(el) || el.type === 'checkbox') continue;
      const fond = fondDe(el); const cs = getComputedStyle(el);
      const c = lire(cs.color); if (c && ratio(sur(c, fond), fond) < 4.5) r.contrastes.push({ ou: nom(el), texte: 'saisie', ratio: Math.round(ratio(sur(c, fond), fond) * 100) / 100 });
      const p = lire(getComputedStyle(el, '::placeholder').color); if (p && ratio(sur(p, fond), fond) < 4.5) r.contrastes.push({ ou: nom(el), texte: 'placeholder', ratio: Math.round(ratio(sur(p, fond), fond) * 100) / 100 });
      const px = parseFloat(cs.fontSize); if (!TAILLES.includes(px)) r.tailles.push({ ou: nom(el), taille: px });
      if (px < 16) r.tailles.push({ ou: nom(el), taille: px, zoom: 'iPhone zoome sous 16 px' });
    }
    // rayons
    for (const el of racine.querySelectorAll('*')) {
      if (el.closest('svg') || !visible(el)) continue;
      const lots = [[getComputedStyle(el), el.getBoundingClientRect()]];
      for (const ps of ['::before', '::after']) { const p = getComputedStyle(el, ps); if (p.content && p.content !== 'none' && p.content !== 'normal') lots.push([p, { width: parseFloat(p.width) || 0, height: parseFloat(p.height) || 0 }]); }
      for (const [cs, b] of lots) {
        for (const coin of ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius']) {
          const v = cs[coin]; if (!v || v === '0px') continue;
          const px = parseFloat(v); const moitie = Math.min(b.width, b.height) / 2;
          if (/%/.test(v) ? px >= 50 : (RAYONS.includes(px) || px >= moitie - 0.6)) continue;
          r.rayons.push({ ou: nom(el), rayon: v }); break;
        }
      }
    }
    // glyphes
    for (const g of racine.querySelectorAll('[data-n-glyphe]')) { r.nGlyphes++; if (!g.querySelector('svg path, svg circle, svg rect')) r.glyphes.push(g.getAttribute('data-n-glyphe')); }
    // cibles
    if (opts.tactile) {
      for (const el of racine.querySelectorAll('button, a[href], input, select, textarea, [role="radio"], [role="switch"], [tabindex="0"], label.n-rangee-corps')) {
        if (el.closest('[aria-hidden="true"]') || el.getAttribute('tabindex') === '-1' && !el.matches('[role="radio"]')) continue;
        let cible = el;
        if (el.matches('input.n-interrupteur')) cible = el.closest('label') || el;
        if (!visible(cible)) continue;
        const b = cible.getBoundingClientRect(); r.nCibles++;
        if (b.width < 43.5 || b.height < 43.5) r.cibles.push({ ou: nom(el), l: Math.round(b.width), h: Math.round(b.height) });
      }
    }
    // texte coupé là où il ne doit pas l'être
    for (const el of racine.querySelectorAll('.n-rangee-valeur, .n-rangee-detail, .n-plaque, .n-pastille, .n-onglet-libelle, .n-affiche-valeur, .n-fait-valeur, .n-bouton-libelle, .n-laterale-libelle, .n-groupe-titre')) {
      if (!visible(el)) continue;
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') r.coupes.push({ ou: nom(el), texte: (el.textContent || '').slice(0, 24) });
    }
  }
  // débordements : la page, puis chaque case
  const de = document.documentElement;
  if (de.scrollWidth > window.innerWidth + 1) r.debords.push({ ou: 'page', l: de.scrollWidth, fenetre: window.innerWidth });
  for (const g of document.querySelectorAll('[data-g]')) {
    const gb = g.getBoundingClientRect();
    for (const el of g.querySelectorAll('*')) {
      if (el.closest('.n-lu-seul, svg, .n-rangee-actions') || !visible(el)) continue;
      const b = el.getBoundingClientRect();
      if (b.right > gb.right + 1 || b.left < gb.left - 1) { r.debords.push({ ou: nom(el), d: Math.round(b.right - gb.right), g: Math.round(gb.left - b.left) }); break; }
    }
  }
  return r;
};

async function juger(pg, nom, opts = {}) {
  const r = await pg.evaluate(`(${JUGE.toString()})(${JSON.stringify({ tactile: !!opts.tactile })})`);
  dit(r.textes > (opts.minTextes || 20) && r.contrastes.length === 0, `C ${nom} : ${r.textes} textes, contraste ≥ 4,5:1 sur le fond rendu`, r.contrastes.slice(0, 6));
  if (opts.tactile) dit(r.nCibles > (opts.minCibles || 5) && r.cibles.length === 0, `T ${nom} : ${r.nCibles} cibles ≥ 44 × 44`, r.cibles.slice(0, 6));
  dit(r.debords.length === 0, `D ${nom} : aucun débordement`, r.debords.slice(0, 6));
  dit(r.coupes.length === 0, `D ${nom} : aucun prix, N°, pastille, libellé de bouton ou d’onglet coupé`, r.coupes.slice(0, 6));
  dit(r.graisses.length === 0, `G ${nom} : graisses 400 / 600 / 700 seulement`, r.graisses.slice(0, 6));
  dit(r.tailles.length === 0, `G ${nom} : tailles du contrat seulement`, r.tailles.slice(0, 6));
  dit(r.rayons.length === 0, `G ${nom} : rayons 8 / 10 / 12 / 14 / rond seulement`, r.rayons.slice(0, 6));
  dit(r.nGlyphes > 0 && r.glyphes.length === 0, `I ${nom} : ${r.nGlyphes} glyphes, tous dessinés par un tracé de l’app`, r.glyphes.slice(0, 6));
  return r;
}

const URL0 = `http://127.0.0.1:${PORT}/`;
const TEL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
async function page(nav, ctxOpts, requete, { zoneSure = false, css = '' } = {}) {
  const ctx = await nav.newContext(ctxOpts);
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e))); pg.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  if (zoneSure) {
    try { const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } }); pg.__zoneSure = true; } catch (_) { pg.__zoneSure = false; }
  }
  await pg.goto(URL0 + requete, { waitUntil: 'load' });
  await pg.waitForSelector('#r > *');
  if (css) await pg.addStyleTag({ content: css });
  try { await pg.evaluate(() => document.fonts.ready); } catch (_) {}
  await pg.waitForTimeout(250);
  pg.__erreurs = erreurs;
  return { ctx, pg };
}
// La feuille est POSÉE (son bas touche le bas de l'écran, ou elle est centrée et opaque) / PARTIE : on attend l'état, pas un délai.
const feuillePosee = (pg) => pg.evaluate(() => new Promise((fini) => {
  const debut = performance.now(); let avant = '', egales = 0;
  const tour = () => {
    const f = document.querySelector('.n-feuille'); const c = f && f.closest('.n-feuille-couche');
    const lu = f ? (() => { const b = f.getBoundingClientRect(); return [b.top, b.bottom, getComputedStyle(f).opacity, c.getAttribute('data-n-etat')].join(':'); })() : '';
    if (f && lu === avant && /:1:ouverte$/.test(lu)) egales++; else egales = 0;
    avant = lu;
    if (egales >= 10 || performance.now() - debut > 8000) fini(egales >= 10); else requestAnimationFrame(tour);
  };
  requestAnimationFrame(tour);
}));
const feuillePartie = (pg) => pg.waitForFunction(() => !document.querySelector('.n-feuille'), null, { timeout: 8000 });
const glisser = async (pg, x0, y0, x1, y1, pas = 8, pause = 12) => {
  await pg.mouse.move(x0, y0); await pg.mouse.down();
  for (let i = 1; i <= pas; i++) { await pg.mouse.move(x0 + (x1 - x0) * i / pas, y0 + (y1 - y0) * i / pas); await pg.waitForTimeout(pause); }
  await pg.mouse.up();
};

// ── la galerie ──────────────────────────────────────────────────────────────
async function galerie(nav) {
  for (const sombre of [false, true]) {
    const th = sombre ? 'sombre' : 'clair';
    console.log(`\n── galerie 390 × 844 tactile, ${th}`);
    let { ctx, pg } = await page(nav, TEL, `?vue=galerie${sombre ? '&theme=dark' : ''}`);
    const n = await pg.evaluate(() => document.querySelectorAll('[data-g]').length);
    dit(n >= 30, `la galerie rend ${n} cases`);
    await juger(pg, `galerie 390 ${th}`, { tactile: true });
    // Une capture par section (une page de 10 000 px à DSF 2 dépasse la plus grande image que Chromium sait rendre d'un trait).
    const sections = await pg.locator('[data-g-section]').all();
    for (let i = 0; i < sections.length; i++) { await sections[i].scrollIntoViewIfNeeded(); await pg.waitForTimeout(120); await sections[i].screenshot({ path: path.join(SHOTS, `galerie-390-${th}-${String(i + 1).padStart(2, '0')}.png`) }); }
    dit(pg.__erreurs.length === 0, `aucune erreur JS (galerie 390 ${th})`, pg.__erreurs.slice(0, 3));
    await ctx.close();

    console.log(`\n── galerie 1512 × 900, ${th}`);
    ({ ctx, pg } = await page(nav, { viewport: { width: 1512, height: 900 }, deviceScaleFactor: 1 }, `?vue=galerie${sombre ? '&theme=dark' : ''}`));
    await juger(pg, `galerie 1512 ${th}`);
    await pg.screenshot({ path: path.join(SHOTS, `galerie-1512-${th}.png`), fullPage: true });
    dit(pg.__erreurs.length === 0, `aucune erreur JS (galerie 1512 ${th})`, pg.__erreurs.slice(0, 3));
    await ctx.close();
  }
}

// ── F. les gestes ───────────────────────────────────────────────────────────
async function gestes(nav) {
  console.log('\n── F. les gestes (390 × 844 tactile, clair)');
  const { ctx, pg } = await page(nav, TEL, '?vue=galerie');
  const journal = () => pg.evaluate(() => (document.querySelector('[data-g-journal]').getAttribute('data-g-journal') || '').split(',').filter(Boolean));

  // Segmente
  const seg = pg.locator('[data-g="segmente:trois"] [role="radiogroup"]');
  await seg.locator('[role="radio"][aria-checked="true"]').focus();
  await pg.keyboard.press('ArrowRight');
  let etat = await seg.evaluate((el) => ({ i: [...el.querySelectorAll('[role="radio"]')].findIndex((b) => b.getAttribute('aria-checked') === 'true'), focus: [...el.querySelectorAll('[role="radio"]')].indexOf(document.activeElement), tab: [...el.querySelectorAll('[role="radio"]')].map((b) => b.tabIndex) }));
  dit(etat.i === 1 && etat.focus === 1 && etat.tab.join() === '-1,0,-1', 'F Segmente : → choisit le suivant, le focus le suit, un seul arrêt de tabulation', etat);
  await pg.keyboard.press('End');
  etat = await seg.evaluate((el) => [...el.querySelectorAll('[role="radio"]')].findIndex((b) => b.getAttribute('aria-checked') === 'true'));
  dit(etat === 2, 'F Segmente : Fin va au dernier', etat);
  const curseur = await seg.evaluate((el) => { const c = el.querySelector('.n-segmente-curseur').getBoundingClientRect(), b = el.querySelectorAll('[role="radio"]')[2].getBoundingClientRect(); return Math.abs((c.left + c.width / 2) - (b.left + b.width / 2)); });
  await pg.waitForTimeout(350);
  const curseur2 = await seg.evaluate((el) => { const c = el.querySelector('.n-segmente-curseur').getBoundingClientRect(), b = el.querySelectorAll('[role="radio"]')[2].getBoundingClientRect(); return Math.abs((c.left + c.width / 2) - (b.left + b.width / 2)); });
  dit(curseur2 < 1.5, 'F Segmente : le curseur est sous le choix', { pendant: Math.round(curseur), apres: curseur2 });

  // destructif : deux touchers
  const des = pg.locator('[data-g-destructif]');
  await des.scrollIntoViewIfNeeded(); await des.click();
  let j = await journal(); const arme = await des.getAttribute('data-n-arme');
  dit(!j.includes('supprime') && arme === '1', 'F destructif : le 1er toucher ne fait RIEN, il demande', { j, arme });
  await des.click(); j = await journal();
  dit(j.includes('supprime') && (await des.getAttribute('data-n-arme')) == null, 'F destructif : le 2e toucher agit, et il se désarme', j);

  // une valeur « — » se touche
  await pg.locator('[data-g-fait-vide]').click(); j = await journal();
  dit(j.includes('achat'), 'F Faits : la valeur « — » ouvre sa saisie', j);

  // interrupteur : toute la rangée le bascule
  const inter = pg.locator('[data-g="rangee:44"] [data-g-interrupteur]');
  const avant = await inter.isChecked();
  await pg.locator('[data-g="rangee:44"] label.n-rangee-corps').click({ position: { x: 60, y: 20 } });
  dit((await inter.isChecked()) === !avant, 'F interrupteur : toucher la rangée le bascule');

  // balayage d'une rangée
  const ligne = pg.locator('[data-g-balayage="a"]');
  await ligne.scrollIntoViewIfNeeded();
  const mes = () => ligne.evaluate((el) => { const c = el.querySelector('.n-rangee-corps').getBoundingClientRect(), r = el.getBoundingClientRect(), a = el.querySelector('.n-rangee-actions'); return { ouverte: el.getAttribute('data-n-ouverte') === '1', dx: Math.round(r.left - c.left), w: a.offsetWidth, vis: getComputedStyle(a).visibility, y: r.top + r.height / 2, x: r.left, l: r.width, tab: [...a.querySelectorAll('button')].map((b) => b.tabIndex) }; });
  let m = await mes();
  dit(!m.ouverte && m.vis === 'hidden' && m.tab.every((t) => t === -1), 'F balayage : fermée, les actions sont cachées et hors tabulation', m);
  await glisser(pg, m.x + m.l - 40, m.y, m.x + m.l - 40, m.y + 60); await pg.waitForTimeout(350);
  m = await mes();
  dit(!m.ouverte && m.dx === 0, 'F balayage : un défilement vertical n’ouvre rien', m);
  await ligne.scrollIntoViewIfNeeded(); m = await mes();
  await glisser(pg, m.x + m.l - 40, m.y, m.x + m.l - 180, m.y + 4); await pg.waitForTimeout(400);
  m = await mes();
  dit(m.ouverte && m.dx === m.w && m.w >= 150 && m.vis === 'visible', 'F balayage : glisser vers la gauche ouvre les actions, la rangée s’arrête à leur largeur', m);
  // une autre rangée s'ouvre ⇒ celle-ci se referme
  const ligneB = pg.locator('[data-g-balayage="b"]');
  const mb = await ligneB.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.left, l: r.width, y: r.top + r.height / 2 }; });
  await glisser(pg, mb.x + mb.l - 40, mb.y, mb.x + mb.l - 160, mb.y); await pg.waitForTimeout(400);
  m = await mes();
  dit(!m.ouverte && (await ligneB.getAttribute('data-n-ouverte')) === '1', 'F balayage : une seule rangée ouverte à la fois', m);
  await pg.mouse.click(200, 30); await pg.waitForTimeout(350);
  dit((await ligneB.getAttribute('data-n-ouverte')) == null, 'F balayage : toucher ailleurs referme');
  // clavier
  await ligne.locator('.n-rangee-corps').focus(); await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(350);
  let foc = await pg.evaluate(() => ({ cls: document.activeElement.className, txt: document.activeElement.textContent }));
  m = await mes();
  dit(m.ouverte && /n-rangee-action/.test(foc.cls) && m.tab.every((t) => t === 0), 'F balayage au clavier : ← ouvre, le focus est sur la première action', { foc, m });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(350);
  foc = await pg.evaluate(() => document.activeElement.className); m = await mes();
  dit(!m.ouverte && /n-rangee-corps/.test(foc), 'F balayage au clavier : Échap referme, le focus revient sur la rangée', { foc, m });
  await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(300); await pg.keyboard.press('Tab'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
  j = await journal(); m = await mes();
  dit(j.filter((x) => x === 'envoye').length === 1 && !m.ouverte, 'F balayage au clavier : Entrée sur une action la fait, la rangée se referme', j);
  // geste franc
  await ligne.scrollIntoViewIfNeeded(); m = await mes();
  await glisser(pg, m.x + m.l - 30, m.y, m.x + 20, m.y, 10, 14); await pg.waitForTimeout(400);
  j = await journal(); m = await mes();
  dit(j.filter((x) => x === 'envoye').length === 2 && !m.ouverte, 'F balayage franc : jusqu’au bout fait le geste principal', j);
  // le clic qui suit un balayage n'ouvre pas la rangée
  dit(pg.__erreurs.length === 0, 'F aucune erreur JS pendant les balayages', pg.__erreurs.slice(0, 3));

  // feuille
  const ouvre = pg.locator('[data-g-ouvrir-feuille]'); await ouvre.scrollIntoViewIfNeeded(); await ouvre.click(); await feuillePosee(pg);
  const mf = () => pg.evaluate(() => { const f = document.querySelector('.n-feuille'); if (!f) return null; const b = f.getBoundingClientRect(); return { h: Math.round(b.height), bas: Math.round(window.innerHeight - b.bottom), haut: Math.round(b.top), dedans: f.contains(document.activeElement), detente: f.getAttribute('data-n-detente'), modal: f.getAttribute('aria-modal'), nomme: !!f.getAttribute('aria-labelledby') && !!document.getElementById(f.getAttribute('aria-labelledby')), parent: f.parentElement.parentElement.hasAttribute('data-n-portail'), body: document.body.children.length }; });
  let f = await mf();
  dit(f && f.detente === 'moitie' && Math.abs(f.h - 422) <= 2 && f.bas === 0 && f.dedans && f.modal === 'true' && f.nomme && f.parent, 'F Feuille : ouverte à la moitié, collée en bas, nommée, focus dedans, dans le portail gardé', f);
  for (let i = 0; i < 14; i++) await pg.keyboard.press('Tab');
  dit((await mf()).dedans, 'F Feuille : Tab reste dans la feuille (14 fois)');
  for (let i = 0; i < 5; i++) await pg.keyboard.press('Shift+Tab');
  dit((await mf()).dedans, 'F Feuille : Maj+Tab aussi');
  await pg.locator('.n-feuille-poignee').focus(); await pg.keyboard.press('Enter'); await feuillePosee(pg);
  f = await mf();
  dit(f.detente === 'pleine' && Math.abs(f.h - (844 - 12)) <= 2, 'F Feuille : la poignée passe à la détente pleine (Entrée)', f);
  await glisser(pg, 195, f.haut + 30, 195, f.haut + 30 + 340, 12, 30); await feuillePosee(pg);   // lent et long : la distance décide, pas l'horloge
  f = await mf();
  dit(f && f.detente === 'moitie', 'F Feuille : glisser vers le bas depuis « pleine » revient à la moitié', f);
  await glisser(pg, 195, f.haut + 30, 195, f.haut + 30 + 220, 12, 30); await feuillePartie(pg).catch(() => {});
  f = await mf();
  const rendu = await pg.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-g-ouvrir-feuille'));
  dit(f === null && rendu, 'F Feuille : glisser vers le bas la ferme, le focus revient au bouton qui l’a ouverte', { f, rendu });
  const corps0 = await pg.evaluate(() => document.body.children.length);
  await ouvre.click(); await feuillePosee(pg);
  const corps1 = await pg.evaluate(() => document.body.children.length);
  dit(corps0 === corps1, 'F Feuille : rouvrir n’insère rien sous <body> (le portail est gardé)', { corps0, corps1 });
  await pg.keyboard.press('Escape'); await feuillePartie(pg).catch(() => {});
  dit((await mf()) === null, 'F Feuille : Échap la ferme');
  await ouvre.click(); await feuillePosee(pg);
  await pg.mouse.click(195, 60); await feuillePartie(pg).catch(() => {});
  dit((await mf()) === null, 'F Feuille : le voile la ferme');
  await ouvre.click(); await feuillePosee(pg);
  await juger(pg, 'feuille ouverte 390', { tactile: true, minTextes: 5 });
  await pg.screenshot({ path: path.join(SHOTS, 'feuille-390-clair.png') });
  await pg.locator('.n-feuille-croix').click(); await feuillePartie(pg).catch(() => {});
  dit((await mf()) === null, 'F Feuille : la croix la ferme');

  // toast
  await pg.locator('[data-g-ouvrir-toast]').click(); await pg.waitForTimeout(350);
  const t = await pg.evaluate(() => { const x = [...document.querySelectorAll('.n-toast')].find((e) => !e.closest('.g-toast-fige')); if (!x) return null; const b = x.getBoundingClientRect(); return { bas: Math.round(window.innerHeight - b.bottom), role: x.getAttribute('role'), h: Math.round(b.height) }; });
  dit(t && t.bas >= 8 && t.role === 'status', 'F Toast : au-dessus du bas de l’écran, annoncé (role=status)', t);
  await pg.locator('.n-toast:not(.g-toast-fige .n-toast) .n-toast-action').click(); await pg.waitForTimeout(200);
  j = await journal();
  dit(j.includes('annule') && (await pg.evaluate(() => [...document.querySelectorAll('.n-toast')].filter((e) => !e.closest('.g-toast-fige')).length)) === 0, 'F Toast : « Annuler » défait et le retire', j);
  dit(pg.__erreurs.length === 0, 'F aucune erreur JS pendant les gestes', pg.__erreurs.slice(0, 3));
  await ctx.close();
}

// ── K. la coque ─────────────────────────────────────────────────────────────
async function coque(nav) {
  for (const sombre of [false, true]) {
    const th = sombre ? 'sombre' : 'clair';
    console.log(`\n── K. la coque 390 × 844 tactile (zone sûre), ${th}`);
    const { ctx, pg } = await page(nav, TEL, `?vue=coque${sombre ? '&theme=dark' : ''}`, { zoneSure: true });
    const zs = pg.__zoneSure; const basSur = zs ? 34 : 0, hautSur = zs ? 47 : 0;
    if (!zs) console.log('  (la zone sûre n’a pas pu être émulée par ce Chromium : jugé sans)');
    const k = await pg.evaluate(() => {
      const nav = document.querySelector('.n-onglets'); const b = nav.getBoundingClientRect();
      const o = [...nav.querySelectorAll('.n-onglet')].map((x) => { const r = x.getBoundingClientRect(); const l = x.querySelector('.n-onglet-libelle'); const lr = l.getBoundingClientRect(); const cs = getComputedStyle(l); const ic = x.querySelector('.n-onglet-icone').getBoundingClientRect(); return { l: Math.round(r.width * 10) / 10, h: Math.round(r.height), lib: lr.width > 4 && lr.height > 4, t: cs.fontSize, g: cs.fontWeight, ic: Math.round(ic.width), actif: x.getAttribute('aria-current') === 'page', couleur: getComputedStyle(x).color }; });
      const bar = document.querySelector('.n-barre-titre'); const h1 = document.querySelector('.n-grand-titre');
      return { o, navH: Math.round(b.height), navBas: Math.round(window.innerHeight - b.bottom), barH: Math.round(bar.getBoundingClientRect().height), reduit: bar.hasAttribute('data-n-reduit'), h1: getComputedStyle(h1).fontSize, h1Haut: Math.round(h1.getBoundingClientRect().top), icones: document.querySelectorAll('.n-barre-droite > button').length, pleins: [...document.querySelectorAll('[data-n-variante="plein"]')].filter((x) => x.getClientRects().length).length, pad: Math.round(parseFloat(getComputedStyle(document.querySelector('.n-coque-ecran')).paddingBottom)), accent: getComputedStyle(document.documentElement).getPropertyValue('--n-accent').trim() };
    });
    const larg = k.o.map((x) => x.l);
    dit(k.o.length === 5 && Math.max(...larg) - Math.min(...larg) <= 0.6 && k.o.every((x) => x.lib && x.t === '10px' && x.g === '600' && x.ic === 24 && x.h === 49), 'K 5 onglets de MÊME largeur, icône 24 + libellé 10/600 visible, 49 px', k.o);
    dit(k.navH === 49 + basSur && k.navBas === 0, `K la barre d’onglets fait 49 px + la zone sûre (${basSur}) et touche le bas`, { navH: k.navH, navBas: k.navBas });
    dit(k.o.filter((x) => x.actif).length === 1 && k.o.filter((x) => x.actif)[0].couleur !== k.o.filter((x) => !x.actif)[0].couleur, 'K un seul onglet actif, d’une autre couleur que les autres');
    dit(k.barH === 44 + hautSur && !k.reduit && k.h1 === '34px', `K en haut de page : barre de titre 44 + ${hautSur}, grand titre 34, non réduit`, { barH: k.barH, reduit: k.reduit, h1: k.h1 });
    dit(k.icones === 2, 'K DEUX icônes à droite de la barre de titre (Messages, avatar)', k.icones);
    dit(k.pleins === 1, 'K un seul bouton plein à l’écran', k.pleins);
    dit(k.pad === 49 + basSur, 'K l’écran réserve la place de la barre d’onglets', k.pad);
    await juger(pg, `coque 390 ${th}`, { tactile: true });
    await pg.screenshot({ path: path.join(SHOTS, `coque-390-ventes-${th}.png`) });

    // rien sous la barre : tout en bas, le dernier groupe finit au-dessus du plein, le plein au-dessus de la barre
    await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await pg.waitForTimeout(250);
    const bas = await pg.evaluate(() => { const nav = document.querySelector('.n-onglets').getBoundingClientRect(); const pl = document.querySelector('.n-page-plein').getBoundingClientRect(); const gs = [...document.querySelectorAll('.n-coque-ecran .n-groupe')]; const g = gs[gs.length - 1].getBoundingClientRect(); const bar = document.querySelector('.n-barre-titre'); return { groupe: Math.round(g.bottom), pleinHaut: Math.round(pl.top), pleinBas: Math.round(pl.bottom), nav: Math.round(nav.top), reduit: bar.hasAttribute('data-n-reduit'), centre: getComputedStyle(bar.querySelector('.n-barre-centre')).opacity, fond: getComputedStyle(bar, '::before').opacity }; });
    dit(bas.groupe <= bas.pleinHaut + 1 && bas.pleinBas <= bas.nav + 1, 'K tout en bas : rien sous la barre d’onglets, le plein est collé au-dessus', bas);
    await pg.waitForTimeout(300);
    const red = await pg.evaluate(() => { const bar = document.querySelector('.n-barre-titre'); return { reduit: bar.hasAttribute('data-n-reduit'), centre: getComputedStyle(bar.querySelector('.n-barre-centre')).opacity, fond: getComputedStyle(bar, '::before').opacity, haut: Math.round(bar.getBoundingClientRect().top) }; });
    dit(red.reduit && red.centre === '1' && red.fond === '1' && red.haut === 0, 'K au défilement : le grand titre se réduit dans la barre (17/600 centré), la barre reste collée', red);
    await pg.screenshot({ path: path.join(SHOTS, `coque-390-defile-${th}.png`) });
    await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(350);
    dit(!(await pg.evaluate(() => document.querySelector('.n-barre-titre').hasAttribute('data-n-reduit'))), 'K revenu en haut : le grand titre revient');

    // changer d'onglet : rien ne change sur <html>, <body>, #r ni la racine de la coque
    await pg.evaluate(() => {
      window.__mut = [];
      const o = new MutationObserver((l) => { for (const m of l) window.__mut.push(m.target.nodeName + ':' + m.type + ':' + (m.attributeName || '')); });
      for (const n of [document.documentElement, document.body, document.getElementById('r'), document.querySelector('.n-coque')]) o.observe(n, { attributes: true, childList: n === document.body || n === document.documentElement });
    });
    await pg.locator('.n-onglet[data-n-onglet="achats"]').click(); await pg.waitForTimeout(200);
    const apres = await pg.evaluate(() => ({ mut: window.__mut, titre: document.querySelector('.n-grand-titre').textContent, actif: document.querySelector('.n-onglet[aria-current="page"]').getAttribute('data-n-onglet') }));
    dit(apres.mut.length === 0 && apres.actif === 'achats' && apres.titre === 'Achats', 'K changer d’onglet : aucun attribut ni nœud posé sur <html>, <body>, #r, la coque', apres);
    await pg.locator('.n-onglet[data-n-onglet="ventes"]').click(); await pg.waitForTimeout(150);

    // « Plus »
    await pg.locator('.n-barre-droite [data-n-coque-plus]').click(); await feuillePosee(pg);
    const plus = await pg.evaluate(() => { const f = document.querySelector('[data-n-feuille-plus]'); if (!f) return null; return { entrees: [...f.querySelectorAll('[data-n-plus-entree]')].map((x) => x.getAttribute('data-n-plus-entree')), h: Math.round(f.getBoundingClientRect().height), extra: f.querySelectorAll('.n-rangee').length }; });
    dit(plus && plus.entrees.join() === 'stock,messages,emails,sante,reglages,communaute' && plus.extra === 8 && plus.h >= 844 - 12 - hautSur - 2, 'K « Plus » : feuille pleine hauteur, les 6 écrans + le pied (aide, déconnexion)', plus);
    await juger(pg, `« Plus » 390 ${th}`, { tactile: true, minTextes: 6 });
    await pg.screenshot({ path: path.join(SHOTS, `coque-390-plus-${th}.png`) });
    await pg.locator('[data-n-plus-entree="stock"] .n-rangee-corps').click(); await feuillePartie(pg).catch(() => {});
    const st = await pg.evaluate(() => ({ titre: document.querySelector('.n-grand-titre').textContent, feuille: !!document.querySelector('[data-n-feuille-plus]'), actifs: document.querySelectorAll('.n-onglet[aria-current="page"]').length }));
    dit(st.titre === 'Stock' && !st.feuille && st.actifs === 0, 'K choisir « Stock » : la feuille se ferme, l’écran s’ouvre, aucun onglet n’est actif', st);
    await pg.locator('[data-n-coque-messages]').click(); await pg.waitForTimeout(150);
    dit((await pg.evaluate(() => document.querySelector('.n-grand-titre').textContent)) === 'Messages', 'K l’icône Messages ouvre Messages');
    await pg.locator('.n-onglet[data-n-onglet="ventes"]').click(); await pg.waitForTimeout(150);

    // ⌘K
    await pg.keyboard.press('Control+k');
    dit(await pg.evaluate(() => !!document.activeElement && document.activeElement.matches('.n-recherche-champ')), 'K Ctrl/⌘+K : le focus va dans la recherche');
    await pg.evaluate(() => document.activeElement.blur());

    // page poussée
    await pg.locator('[data-g-vente="a"] .n-rangee-corps').click(); await pg.waitForTimeout(450);
    const po = await pg.evaluate(() => { const p = document.querySelector('.n-poussee'); if (!p) return null; const b = p.getBoundingClientRect(); const r = p.querySelector('.n-barre-retour').getBoundingClientRect(); return { x: Math.round(b.left), l: Math.round(b.width), h: Math.round(b.height), retour: [Math.round(r.width), Math.round(r.height)], dedans: p.contains(document.activeElement), pleins: [...p.querySelectorAll('[data-n-variante="plein"]')].length }; });
    dit(po && po.x === 0 && po.l === 390 && po.h === 844 && po.retour[0] >= 44 && po.retour[1] >= 44 && po.dedans && po.pleins === 1, 'K la fiche est une page poussée : elle couvre l’écran, retour ‹ ≥ 44, focus dedans, un plein', po);
    await juger(pg, `page poussée 390 ${th}`, { tactile: true, minTextes: 8 });
    await pg.screenshot({ path: path.join(SHOTS, `coque-390-fiche-${th}.png`) });
    await pg.locator('.n-barre-retour').click(); await pg.waitForTimeout(450);
    dit((await pg.evaluate(() => !document.querySelector('.n-poussee'))), 'K retour ‹ : la page poussée repart');
    dit(pg.__erreurs.length === 0, `K aucune erreur JS (coque 390 ${th})`, pg.__erreurs.slice(0, 3));
    await ctx.close();
  }

  // base vide
  {
    console.log('\n── K. la coque 390, base vide');
    const { ctx, pg } = await page(nav, TEL, '?vue=coque&vide=1', { zoneSure: true });
    const v = await pg.evaluate(() => ({ vide: !!document.querySelector('.n-vide'), pleins: [...document.querySelectorAll('[data-n-variante="plein"]')].length, onglets: document.querySelectorAll('.n-onglet').length }));
    dit(v.vide && v.pleins === 0 && v.onglets === 5, 'K base vide : l’état vide est dessiné, aucun plein orphelin, les 5 onglets restent', v);
    await juger(pg, 'coque 390 base vide', { tactile: true, minTextes: 8 });
    await pg.screenshot({ path: path.join(SHOTS, 'coque-390-vide-clair.png') });
    await ctx.close();
  }

  for (const [l, h] of [[1512, 900], [1280, 800]]) {
    for (const sombre of [false, true]) {
      const th = sombre ? 'sombre' : 'clair';
      console.log(`\n── K. la coque ${l} × ${h}, trois volets, ${th}`);
      const { ctx, pg } = await page(nav, { viewport: { width: l, height: h }, deviceScaleFactor: l === 1512 ? 2 : 1 }, `?vue=coque3${sombre ? '&theme=dark' : ''}`);
      const m = () => pg.evaluate(() => {
        const b = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
        const lat = b('.n-laterale'), ec = b('.n-coque-ecran'), de = b('.n-coque-detail');
        const actif = document.querySelector('.n-laterale-entree[aria-current="page"]');
        const po = document.querySelector('.n-coque-detail .n-poussee'); const pc = po ? po.querySelector('.n-page-contenu').getBoundingClientRect() : null;
        return { lat: lat && Math.round(lat.width), liste: ec && Math.round(ec.width), detail: de && Math.round(de.width), somme: lat && ec && de ? Math.round(lat.width + ec.width + de.width) : 0,
          onglets: document.querySelectorAll('.n-onglets').length, entrees: document.querySelectorAll('.n-laterale-entree').length, actif: actif && actif.getAttribute('data-n-entree'),
          vide: (() => { const v = document.querySelector('.n-coque-detail-vide'); return !!v && getComputedStyle(v).display !== 'none' && !!v.querySelector('.n-vide'); })(),
          poussee: !!po, contenu: pc && Math.round(pc.width), retourCache: po ? getComputedStyle(po.querySelector('.n-barre-retour')).display === 'none' : null,
          selection: document.querySelectorAll('.n-rangee[data-n-selection]').length, recherches: document.querySelectorAll('[data-n-recherche]').length, pageDefile: document.documentElement.scrollHeight > window.innerHeight + 1 };
      });
      let x = await m();
      dit(x.lat === 240 && x.liste >= 380 && x.liste <= 520 && x.somme === l && x.onglets === 0, `K trois volets : barre latérale 240, liste ${x.liste} (380–520), détail ${x.detail} ; pas de barre d’onglets`, x);
      dit(x.entrees === 11 && x.actif === 'ventes', 'K la barre latérale porte les 5 onglets + les 6 écrans de « Plus », l’entrée active est marquée', { n: x.entrees, actif: x.actif });
      dit(x.vide && !x.poussee, 'K sans sélection : l’état vide du détail est dessiné');
      dit(x.recherches === 1 && !x.pageDefile, 'K UNE recherche (en tête de la liste) ; la page ne défile pas, chaque volet défile seul', { r: x.recherches, d: x.pageDefile });
      await pg.locator('[data-g-vente="b"] .n-rangee-corps').click(); await pg.waitForTimeout(300);
      x = await m();
      dit(x.poussee && !x.vide && x.contenu <= 760 && x.retourCache && x.selection === 1, 'K choisir une vente : la fiche s’ouvre DANS le volet de détail (≤ 760), sans retour ‹, la rangée est sélectionnée', x);
      // ↑ ↓ dans la liste
      await pg.locator('[data-g-vente="b"] .n-rangee-corps').focus(); await pg.keyboard.press('ArrowDown');
      const foc = await pg.evaluate(() => { const r = document.activeElement.closest('.n-rangee'); return r ? r.getAttribute('data-g-vente') : null; });
      dit(foc === 'c', 'K clavier : ↓ passe à la rangée suivante', foc);
      await pg.keyboard.press('Enter'); await pg.waitForTimeout(250);
      dit((await pg.evaluate(() => document.querySelector('.n-rangee[data-n-selection]').getAttribute('data-g-vente'))) === 'c', 'K clavier : Entrée ouvre sa fiche');
      await pg.mouse.move(4, 4); await pg.waitForTimeout(200);   // ni survol ni appui en cours : on juge l'état de repos
      await juger(pg, `coque ${l} ${th}`);
      await pg.screenshot({ path: path.join(SHOTS, `coque-${l}-${th}.png`) });
      await pg.keyboard.press('/');
      dit(await pg.evaluate(() => !!document.activeElement && document.activeElement.matches('.n-recherche-champ')), 'K « / » : le focus va dans la recherche');
      // « Plus » depuis le compte, en carte centrée
      await pg.locator('.n-laterale-compte').click(); await feuillePosee(pg);
      const fp = await pg.evaluate(() => { const f = document.querySelector('[data-n-feuille-plus]'); if (!f) return null; const b = f.getBoundingClientRect(); return { l: Math.round(b.width), centre: Math.abs(Math.round(b.left + b.width / 2 - window.innerWidth / 2)), poignee: getComputedStyle(f.querySelector('.n-feuille-poignee')).display }; });
      dit(fp && fp.l === 560 && fp.centre <= 1 && fp.poignee === 'none', 'K à l’ordinateur la feuille est une carte centrée de 560, sans poignée', fp);
      await pg.keyboard.press('Escape'); await feuillePartie(pg).catch(() => {});
      dit(pg.__erreurs.length === 0, `K aucune erreur JS (coque ${l} ${th})`, pg.__erreurs.slice(0, 3));
      await ctx.close();
    }
  }
  {
    console.log('\n── K. la coque 1512, deux volets (les écrans d’avant)');
    const { ctx, pg } = await page(nav, { viewport: { width: 1512, height: 900 }, deviceScaleFactor: 1 }, '?vue=coque');
    const x = await pg.evaluate(() => { const lat = document.querySelector('.n-laterale').getBoundingClientRect(), ec = document.querySelector('.n-coque-ecran').getBoundingClientRect(); return { lat: Math.round(lat.width), ecran: Math.round(ec.width), detail: !!document.querySelector('.n-coque-detail'), defile: document.documentElement.scrollHeight > window.innerHeight + 1 }; });
    dit(x.lat === 240 && x.ecran === 1512 - 240 && !x.detail && x.defile, 'K deux volets : barre latérale 240 + l’écran sur tout le reste, c’est la PAGE qui défile', x);
    await pg.evaluate(() => window.scrollTo(0, 600)); await pg.waitForTimeout(250);
    const lat = await pg.evaluate(() => Math.round(document.querySelector('.n-laterale').getBoundingClientRect().top));
    dit(lat === 0, 'K deux volets : la barre latérale reste collée quand la page défile', lat);
    await juger(pg, 'coque 1512 deux volets');
    await pg.screenshot({ path: path.join(SHOTS, 'coque-1512-deux-clair.png') });
    await ctx.close();
  }
}

// ── --prouve : chaque mutation rend SA mesure rouge ─────────────────────────
const MUTANTS = [
  ['contraste', ':root{--n-encre-2:#9A9AA0}', 'galerie', (r) => r.contrastes.length > 0],
  ['contraste-sombre', ':root[data-theme="dark"]{--n-sur-teinte:#2F6FB8}', 'galerie&theme=dark', (r) => r.contrastes.length > 0],
  ['cible', '.n-bouton{min-height:36px}', 'galerie', (r) => r.cibles.length > 0],
  ['cible-segmente', '.n-segmente-choix{height:38px;margin:0}', 'galerie', (r) => r.cibles.length > 0],
  ['graisse', '.n-rangee-titre{font-weight:500}', 'galerie', (r) => r.graisses.length > 0],
  ['taille', '.n-rangee-sous{font-size:14px}', 'galerie', (r) => r.tailles.length > 0],
  ['taille-12', '.n-groupe-pied{font-size:12px}', 'galerie', (r) => r.tailles.length > 0],
  ['rayon', '.n-groupe-carte{border-radius:16px}', 'galerie', (r) => r.rayons.length > 0],
  ['deborde', '.n-rangee-valeurs{min-width:420px}', 'galerie', (r) => r.debords.length > 0],
  ['coupe', '.n-rangee-valeur{max-width:30px;overflow:hidden}', 'galerie', (r) => r.coupes.length > 0],
  ['glyphe', '.n-glyphe svg{display:none}', 'galerie', (r) => r.contrastes.length >= 0 && false],
];
async function prouve(nav) {
  console.log('\n── --prouve : chaque mutation doit rendre sa mesure rouge');
  for (const [nom, css, requete, rouge] of MUTANTS) {
    if (nom === 'glyphe') continue;
    const { ctx, pg } = await page(nav, TEL, '?vue=' + requete, { css });
    const r = await pg.evaluate(`(${JUGE.toString()})({"tactile":true})`);
    dit(rouge(r), `mutation « ${nom} » ⇒ rouge`, { c: r.contrastes.length, t: r.cibles.length, g: r.graisses.length, ta: r.tailles.length, ra: r.rayons.length, d: r.debords.length, co: r.coupes.length });
    await ctx.close();
  }
  // les mutations de structure de la coque
  const k = async (nom, css, mesure) => {
    const { ctx, pg } = await page(nav, TEL, '?vue=coque', { css, zoneSure: true });
    const v = await pg.evaluate(mesure);
    dit(v.rouge, `mutation « ${nom} » ⇒ rouge`, v);
    await ctx.close();
  };
  await k('onglets-inegaux', '.n-onglets{grid-template-columns:2fr 1fr 1fr 1fr 1fr}', () => { const l = [...document.querySelectorAll('.n-onglet')].map((x) => x.getBoundingClientRect().width); return { rouge: Math.max(...l) - Math.min(...l) > 0.6, l }; });
  await k('sous-la-barre', '.n-coque{--n-bas:0px}', async () => { window.scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => setTimeout(r, 200)); const nav = document.querySelector('.n-onglets').getBoundingClientRect(); const pl = document.querySelector('.n-page-plein').getBoundingClientRect(); return { rouge: pl.bottom > nav.top + 1, plein: pl.bottom, nav: nav.top }; });
  await k('titre-fige', '.n-barre-titre[data-n-reduit] .n-barre-centre{opacity:0}', async () => { window.scrollTo(0, 600); await new Promise((r) => setTimeout(r, 500)); const o = getComputedStyle(document.querySelector('.n-barre-centre')).opacity; return { rouge: o !== '1', o }; });
  // la source : un !important, un :has, une 2e ombre seraient vus (le motif est jugé sur un texte muté)
  const css = fs.readFileSync(path.join(RACINE, 'src', 'natif', 'natif.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  dit(/!important/.test(css + '.x{color:red !important}') && /:has\(/.test(css + 'html:has(.x){}') && ((css + '.n-groupe-carte{box-shadow:0 1px 2px #000}').match(/box-shadow\s*:/g) || []).length === 2, 'mutations de source (!important, :has, 2e ombre) ⇒ vues');
}

(async () => {
  const debut = Date.now();
  source();
  try { construire(); } catch (e) { dit(false, 'la galerie se construit (esbuild)', String(e.message || e).slice(0, 600)); console.log(`\n${rouges} rouge(s)`); process.exit(1); }
  dit(true, 'la galerie se construit (esbuild)');
  const serveur = await servir();
  const nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    if (PROUVE) await prouve(nav);
    else { await galerie(nav); await gestes(nav); await coque(nav); }
  } catch (e) { dit(false, 'le banc va au bout', String(e && e.stack || e).slice(0, 900)); }
  await nav.close(); serveur.close();
  try { fs.rmSync(DOSSIER, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${rouges === 0 ? '✅' : '❌'} natif-galerie${PROUVE ? ' --prouve' : ''} : ${verts} verts, ${rouges} rouge(s) — ${Math.round((Date.now() - debut) / 1000)} s — captures : ${SHOTS}`);
  process.exit(rouges ? 1 : 0);
})();
