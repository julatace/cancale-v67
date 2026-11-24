// ═══════════════════════════════════════════════════════════
//  BANC — ANNONCES « DRESSING » ET COMPTE BLOQUÉ (21 nov. 2026)
//
//  Julien : « les annonces sont moches » (le Dressing de Bleam, les « Articles » de Vintex) ; « ça fait trop vibe codé sur
//  téléphone » ; « quand un compte est ban je veux quand même pouvoir voir les annonces qu'il y avait dessus ».
//  Construit outils/annonces-dressing/ (esbuild, hors paquet de prod) : l'écran natif nourri par les VRAIES règles
//  (src/articles/sources.js, src/articles/modele.js) sur une base INVENTÉE — dont un compte Vinted BLOQUÉ (en pause).
//  Mesures (data-* et nombres, jamais un libellé) — 390 × 844 tactile (DPR 3), 1512 × 900, clair et sombre :
//   G. téléphone (2e passe du 21 nov., « je n'aime pas du tout l'affichage sur iPhone ») : la LISTE « Articles » par défaut, formes
//      A et B : rangées 64–72, vignette 52 réservée, ≥ 8 rangées par écran, prix, « ⋯ » 44 au doigt, aucun plein, liste pleine
//      largeur, « À régler » sur la ligne de « Mis à jour », pas de capitales, taille non répétée ; CLS ≈ 0 à l'arrivée des
//      photos ; la grille (photo carrée, « ⋯ » à côté du prix) choisissable et mémorisée ;
//   K. compte bloqué : un segment « Bloqués » avec SES 3 annonces ; « En ligne » ne les compte pas ; chaque carte dit sa
//      trace datée ; l'en-tête du compte dit « Compte bloqué » ; « ⋯ » n'offre aucun geste ; « Actions » ne les coche pas ;
//   R. le rouge n'est porté que par la Plaque d'un doublon ; C. contrastes ≥ 4,5:1 ; T. cibles ≥ 44 ; D. aucun débordement ;
//   O. ordinateur : le tableau « Articles » (liste) par défaut, la ligne « Compte bloqué » dedans, la grille de cartes sur
//      la bascule ; V. 1 000 annonces : premier rendu, nœuds, défilement sans saut.
//  `--prouve` : chaque mesure, faussée dans la page, doit rougir. SHOTS : le dossier des captures.
//  Sur l'arbre d'avant (git archive origin/main), il doit ROUGIR (aucune grille, aucun segment « Bloqués »).
// ═══════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const PORT = Number(process.env.BANC_PORT) || 4793;
const PROUVE = process.argv.includes('--prouve');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-annonces-dressing');
const DOSSIER = path.join(os.tmpdir(), 'banc-annonces-dressing-build-' + process.pid);
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(DOSSIER, { recursive: true });
let rouges = 0, verts = 0;
const dit = (ok, quoi, d) => { if (ok) { verts++; if (!PROUVE) console.log('  ✅ ' + quoi); } else { rouges++; if (!PROUVE) console.log('  ❌ ' + quoi + (d !== undefined ? '\n       ' + JSON.stringify(d).slice(0, 600) : '')); } return ok; };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/);
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx');
  fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'annonces-dressing', 'banc.jsx')], bundle: true, outfile: path.join(DOSSIER, 'banc.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file', '.svg': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    external: ['/brands/*'], alias: { 'vrm-icones-app': gen }, nodePaths: [NM], logLevel: 'silent' });
  fs.copyFileSync(path.join(RACINE, 'outils', 'annonces-dressing', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };
let RETARD = 700;   // les photos arrivent en retard : une carte qui ne réserve pas sa place saute
const servir = () => new Promise((ok) => { const s = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const ph = /^\/photo\/(\d+)\.svg$/.exec(u);
  if (ph) { const i = Number(ph[1]); setTimeout(() => { res.writeHead(200, { 'content-type': 'image/svg+xml' });
    res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="375"><rect width="300" height="375" fill="hsl(${(i * 47) % 360},22%,62%)"/><ellipse cx="150" cy="230" rx="110" ry="46" fill="hsl(${(i * 47 + 180) % 360},30%,40%)"/></svg>`); }, RETARD); return; }
  if (/^\/brands\//.test(u)) { res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>'); return; }
  const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }); s.listen(PORT, () => ok(s)); });

const MESURE = () => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const lire = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const sur = (c, f) => ({ r: c.r * c.a + f.r * (1 - c.a), g: c.g * c.a + f.g * (1 - c.a), b: c.b * c.a + f.b * (1 - c.a), a: 1 });
  const fondDe = (el) => { const pile = []; for (let e = el; e; e = e.parentElement) { const c = lire(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break; } } let f = { r: 255, g: 255, b: 255, a: 1 }; if (document.documentElement.getAttribute('data-theme') === 'dark') f = { r: 0, g: 0, b: 0, a: 1 }; for (const c of pile.reverse()) f = sur(c, f); return f; };
  const vis = (b) => b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight;
  const r = { contrastes: [], cibles: [], rouges: [], debord: document.scrollingElement.scrollWidth - innerWidth };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const el = t.parentElement; if (!t.nodeValue.trim() || !el) continue; const cs = getComputedStyle(el); const b = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || !vis(b) || el.closest('[aria-hidden="true"],[hidden],.n-eg-sr')) continue;
    // Un texte posé SUR une photo (bandeau, conseil) se juge sur son propre fond (opaque à 82 %), pas sur l'image.
    const c = lire(cs.color); if (!c) continue; const fd = fondDe(el); const x = sur({ ...c, a: c.a * Number(cs.opacity || 1) }, fd); const L1 = lum(x), L2 = lum(fd); const k = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (k < 4.5) r.contrastes.push({ t: t.nodeValue.trim().slice(0, 24), k: Math.round(k * 100) / 100 });
  }
  for (const el of document.querySelectorAll('button, a[href], [role="button"], input, [role="radio"]')) {
    const b = el.getBoundingClientRect(); if (!vis(b) || el.closest('[hidden],[aria-hidden="true"]')) continue;
    if (b.width < 44 || b.height < 44) r.cibles.push({ q: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 24), w: Math.round(b.width), h: Math.round(b.height) });
  }
  // Le rouge (doublon) : toute couleur rouge vive hors de la Plaque d'un doublon.
  const rouge = (s) => { const c = lire(s); return c && c.a > 0.5 && c.r > 180 && c.g < 90 && c.b < 90; };
  for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el); if ((rouge(cs.color) && el.textContent.trim()) || rouge(cs.backgroundColor)) { if (!el.closest('.n-plaque[data-n-doublon]')) r.rouges.push(el.className || el.tagName); } }
  const cartes = [...document.querySelectorAll('[data-ad-carte]')];
  const rangees = [...document.querySelectorAll('[data-ad-rangee]')];
  const items = cartes.length ? cartes : rangees;
  r.nCartes = cartes.length; r.nRangees = rangees.length; r.nItems = items.length;
  r.colonnes = new Set(cartes.slice(0, 8).map((c) => Math.round(c.getBoundingClientRect().left))).size;
  r.premiere = items.length ? Math.round(items[0].getBoundingClientRect().top) : null;
  r.photos = items.slice(0, 12).map((c) => { const p = c.querySelector('.n-ad-photo, .n-ar-photo'); const b = p ? p.getBoundingClientRect() : { width: 0, height: 0 }; return { w: Math.round(b.width), h: Math.round(b.height) }; });
  r.hauteurs = rangees.slice(0, 30).map((e) => Math.round(e.getBoundingClientRect().height));
  r.prix = items.slice(0, 40).every((c) => /€/.test(c.textContent));
  r.ronds = items.slice(0, 40).map((c) => { const b = c.querySelector('[data-ad-gestes]'); if (!b) return 0; const x = b.getBoundingClientRect(); return x.width >= 44 && x.height >= 44 ? 1 : -1; });
  r.pleinsCarte = document.querySelectorAll('[data-ad-carte] [data-n-variante="plein"], [data-ad-rangee] [data-n-variante="plein"]').length;
  r.pleins = document.querySelectorAll('[data-n-variante="plein"]').length;
  r.vue = document.querySelector('[data-eg-ecran]') ? document.querySelector('[data-eg-ecran]').getAttribute('data-ad-vue') : null;
  r.segBloque = (() => { const s = document.querySelector('[data-eg-segment="bloque"]'); return s ? Number(s.getAttribute('data-eg-segment-n') || (s.querySelector('.n-segmente-n') || {}).textContent || 0) : null; })();
  r.segEnLigne = (() => { const s = document.querySelector('[data-eg-segment="enligne"]'); return s ? Number(s.getAttribute('data-eg-segment-n') || (s.querySelector('.n-segmente-n') || {}).textContent || 0) : null; })();
  r.coupes = [...document.querySelectorAll('.n-segmente-libelle')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent);
  r.traces = document.querySelectorAll('[data-eg-article] [data-ad-trace]').length;
  r.teteBloque = document.querySelectorAll('[data-ad-bloque="1"]').length;
  r.noeuds = document.querySelectorAll('[data-eg-liste] *').length;
  // « À régler » UNE fois, sur la MÊME ligne fine que « Mis à jour » ; aucun intertitre en capitales ; aucun plein « Publier » au
  // téléphone ; la taille déjà dans le titre ne se répète pas ; aucune carte arrondie autour de la liste (pas de carte dans une carte).
  r.aregler = document.querySelectorAll('[data-ad-aregler]').length;
  r.areglerLigne = document.querySelectorAll('.n-ad-maj [data-ad-aregler]').length;
  r.manqueParCompte = document.querySelectorAll('[data-eg-groupe] [data-eg-manque]').length;
  r.capitales = [...document.querySelectorAll('[data-eg-liste] *')].filter((e) => getComputedStyle(e).textTransform === 'uppercase' && e.textContent.trim()).length;
  r.pleinPublier = document.querySelectorAll('[data-n-variante="plein"][data-eg-publier]').length;
  r.tailleRepetee = items.filter((c) => { const t = (c.querySelector('.n-ad-titre, .n-ar-titre') || {}).textContent || ''; const m = /T\. ([0-9]+(?:[.,][0-9])?)/.exec((c.querySelector('.n-ad-ligne, .n-ar-meta') || {}).textContent || ''); return m && new RegExp('taille ' + m[1].replace(/[.,]/, '[.,]')).test(t); }).length;
  r.etiquettesCoupees = [...document.querySelectorAll('[data-ad-rangee] .n-ad-etiquette')].filter((e) => { const p = e.closest('.n-ar-texte'); return p && e.getBoundingClientRect().right > p.getBoundingClientRect().right + 0.5; }).length;
  r.listeArrondie =[...document.querySelectorAll('.n-ar-liste')].filter((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius) > 0 || e.getBoundingClientRect().left > 0.5).length;
  return r;
};
const TEL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true };
const ORDI = { viewport: { width: 1512, height: 900 } };
async function ouvrir(nav, opts, q, { garder = null } = {}) {
  const ctx = garder || await nav.newContext(opts); const pg = await ctx.newPage();
  await pg.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (_) {} });
  const t0 = Date.now();
  await pg.goto(`http://127.0.0.1:${PORT}/${q}`); await pg.waitForSelector('[data-eg-ecran]', { timeout: 20000 });
  const tRendu = Date.now() - t0;
  if (opts.isMobile) await pg.addStyleTag({ content: ':root{--n-zone-haut:47px;--n-zone-bas:34px}' });
  await pg.waitForTimeout(120); return { ctx, pg, tRendu };
}
const MUT = {
  photo: '.n-ar-photo{height:auto !important;min-height:0 !important}.n-ad-photo{aspect-ratio:auto !important}',
  rond: '.n-ar-plus,.n-ad-plus{width:24px !important;height:24px !important;align-self:center !important}',
  rouge: '.n-ar-prix,.n-ad-prix{color:#d70015 !important}',
  contraste: '.n-ar-titre,.n-ad-titre{color:#c8c8c8 !important}',
  carte: '.n-ar-liste{margin:0 16px !important;border-radius:12px !important}',
};
async function juger(nav, mutant = '') {
  for (const forme of ['a', 'b']) for (const sombre of [false, true]) {
    // ── G. le téléphone : la LISTE « Articles » par défaut, forme A ou B ──
    { const { ctx, pg } = await ouvrir(nav, TEL, `?v=tous&forme=${forme}${sombre ? '&theme=dark' : ''}`);
      if (mutant) await pg.addStyleTag({ content: MUT[mutant] });
      const r0 = await pg.evaluate(MESURE);   // AVANT l'arrivée des photos (700 ms de retard)
      await pg.waitForTimeout(1300);
      const r = await pg.evaluate(MESURE); const cls = await pg.evaluate(() => window.__cls);
      const ou = `390 ${forme.toUpperCase()}${sombre ? ' · sombre' : ''}`;
      dit(r.vue === 'liste' && r.nRangees > 0 && r.nCartes === 0, `G ${ou} : la LISTE par défaut, ${r.nRangees} rangées`, { vue: r.vue, n: r.nRangees });
      dit(r0.photos.length > 0 && r0.photos.every((p) => p.w === 52 && p.h === 52), `G ${ou} : vignette 52 × 52 réservée avant son arrivée`, r0.photos.slice(0, 4));
      dit(r.hauteurs.length > 0 && r.hauteurs.every((h) => h >= 64 && h <= 72), `G ${ou} : rangées de ${Math.min(...r.hauteurs)}–${Math.max(...r.hauteurs)} px (64–72)`, r.hauteurs);
      dit(cls < 0.01, `G ${ou} : aucun saut quand les photos arrivent (CLS ${cls.toFixed(4)})`, cls);
      dit(r.prix && r.ronds.length > 0 && r.ronds.every((x) => x === 1) && r.pleinsCarte === 0 && r.pleins === 0, `G ${ou} : chaque rangée dit son prix, un « ⋯ » 44 au doigt, aucun plein à l'écran`, { prix: r.prix, ronds: r.ronds, pleins: r.pleins });
      dit(r.aregler === 1 && r.areglerLigne === 1 && r.manqueParCompte === 0, `G ${ou} : « À régler » une fois, sur la ligne de « Mis à jour »`, { aregler: r.aregler, ligne: r.areglerLigne, parCompte: r.manqueParCompte });
      dit(r.capitales === 0 && r.pleinPublier === 0 && r.tailleRepetee === 0 && r.listeArrondie === 0, `G ${ou} : pas de capitales, pas de plein « Publier », taille du titre jamais répétée, liste pleine largeur`, { cap: r.capitales, publier: r.pleinPublier, taille: r.tailleRepetee, arrondie: r.listeArrondie });
      dit(r.premiere != null && r.premiere <= 422, `G ${ou} : 1re rangée à ${r.premiere} px (≤ 50 % de 844)`, r.premiere);
      dit(r.cibles.length === 0, `T ${ou} : cibles ≥ 44 × 44`, r.cibles.slice(0, 6));
      dit(r.contrastes.length === 0, `C ${ou} : contrastes ≥ 4,5:1`, r.contrastes.slice(0, 6));
      dit(r.rouges.length === 0, `R ${ou} : le rouge seulement sur la Plaque d'un doublon`, r.rouges.slice(0, 6));
      dit(r.debord <= 0 && r.coupes.length === 0 && r.etiquettesCoupees === 0, `D ${ou} : aucun débordement, aucun segment ni état coupé`, { d: r.debord, c: r.coupes, e: r.etiquettesCoupees });
      dit(r.segBloque === 3 && r.segEnLigne != null, `K ${ou} : segment « Bloqués » · ${r.segBloque}, « En ligne » · ${r.segEnLigne}`, { bloque: r.segBloque, enligne: r.segEnLigne });
      if (!mutant) await pg.screenshot({ path: path.join(SHOTS, `liste-${forme}-390${sombre ? '-sombre' : ''}.png`) });
      if (!mutant && !sombre) { await pg.evaluate(() => { const l = document.querySelector('[data-eg-liste]'); if (l) window.scrollTo(0, l.getBoundingClientRect().top + window.scrollY - 100); }); await pg.waitForTimeout(300);
        await pg.screenshot({ path: path.join(SHOTS, `liste-${forme}-390-defile.png`) }); await pg.evaluate(() => window.scrollTo(0, 0)); }
      if (r.segBloque) {
        await pg.click('[data-eg-segment="bloque"]'); await pg.waitForTimeout(1200);
        const k = await pg.evaluate(MESURE);
        const enLigneSansBloque = await pg.evaluate(() => window.__banc.comptes.tous.enligne);
        dit(k.nItems === 3 && k.traces === 3 && k.teteBloque === 1, `K ${ou} : « Bloqués » montre 3 annonces, chacune sa trace datée, l'en-tête « Compte bloqué »`, { n: k.nItems, traces: k.traces, tete: k.teteBloque });
        dit(r.segEnLigne === enLigneSansBloque && enLigneSansBloque === 7, `K ${ou} : « En ligne » ne compte pas le compte bloqué (${r.segEnLigne})`, { seg: r.segEnLigne, regle: enLigneSansBloque });
        if (!mutant) await pg.screenshot({ path: path.join(SHOTS, `bloque-${forme}-390${sombre ? '-sombre' : ''}.png`) });
        await pg.click('[data-eg-article] [data-ad-gestes]'); await pg.waitForTimeout(500);
        const g = await pg.evaluate(() => ({ aucun: !!document.querySelector('[data-ad-aucun-geste]'), gestes: [...document.querySelectorAll('[data-ad-geste]')].map((x) => x.getAttribute('data-ad-geste')) }));
        dit(g.aucun && g.gestes.every((x) => x === 'fiche'), `K ${ou} : « ⋯ » d'une annonce bloquée n'offre aucun geste (seulement ouvrir)`, g);
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
      }
      await ctx.close(); }
  }
  if (mutant) return;
  // ── La grille, choisissable et mémorisée : sobre (photo carrée, une ligne, « ⋯ » discret) ──
  { const ctx = await nav.newContext(TEL);
    let { pg } = await ouvrir(nav, TEL, '?v=tous', { garder: ctx });
    // (24 nov., lot visuel-annonces) l'affichage vit dans « ⋯ » → Affichage (Liste · Détaillé) ; l'ancienne bascule de la barre sinon.
    if (!(await pg.$('[data-ad-bascule]'))) { await pg.click('[data-eg-actions]').catch(() => {}); await pg.waitForTimeout(400); }
    const b = (await pg.$('[data-ad-vue-choix="grille"]')) || (await pg.$('[data-ad-bascule]'));
    if (dit(!!b, 'G 390 : une bascule liste ⇄ grille')) {
      await b.click(); await pg.waitForTimeout(300);
      await pg.close(); ({ pg } = await ouvrir(nav, TEL, '?v=tous', { garder: ctx }));
      const r0 = await pg.evaluate(MESURE); await pg.waitForTimeout(1300);
      const r = await pg.evaluate(MESURE);
      dit(r.vue === 'grille' && r.nCartes > 0 && r.colonnes === 2, `G 390 grille : gardée au rechargement, ${r.nCartes} cartes sur 2 colonnes`, { vue: r.vue, n: r.nCartes, col: r.colonnes });
      dit(r0.photos.length > 0 && r0.photos.every((p) => p.w > 100 && Math.abs(p.h - p.w) <= 1), 'G 390 grille : photo CARRÉE réservée avant son arrivée', r0.photos.slice(0, 4));
      dit(r.prix && r.ronds.every((x) => x === 1) && !(await pg.$('.n-ad-photo [data-ad-gestes]')), 'G 390 grille : prix, « ⋯ » discret à côté du prix (pas sur la photo)', r.ronds);
      dit(r.cibles.length === 0 && r.contrastes.length === 0 && r.debord <= 0, 'T C D 390 grille', { c: r.cibles.slice(0, 4), k: r.contrastes.slice(0, 4), d: r.debord });
      await pg.screenshot({ path: path.join(SHOTS, 'grille-390.png') });
    }
    await ctx.close(); }
  // ── Actions : le compte bloqué ne se coche pas ──
  { const { ctx, pg } = await ouvrir(nav, TEL, '?v=tous');
    await pg.click('[data-eg-actions]'); await pg.waitForSelector('[data-eg-action]'); await pg.click('[data-eg-action]'); await pg.waitForTimeout(400);
    await pg.click('[data-eg-tout]'); await pg.waitForTimeout(200);
    const r = await pg.evaluate(() => ({ coches: [...document.querySelectorAll('[data-eg-coche="1"]')].map((e) => e.getAttribute('data-eg-compte')), n: document.querySelector('[data-eg-lancer]')?.getAttribute('data-eg-n') }));
    dit(r.coches.length > 0 && !r.coches.some((c) => /222/.test(c || '')) && String(r.coches.length) === r.n, `K 390 : « Actions » coche ${r.coches.length} annonces, aucune du compte bloqué`, r);
    await pg.screenshot({ path: path.join(SHOTS, 'actions-390.png') });
    await ctx.close(); }
  // ── O. l'ordinateur : la liste « Articles » par défaut, la grille sur la bascule ──
  for (const sombre of [false, true]) {
    const { ctx, pg } = await ouvrir(nav, ORDI, `?v=tous${sombre ? '&theme=dark' : ''}`); await pg.waitForTimeout(1200);
    const r = await pg.evaluate(() => ({ vue: document.querySelector('[data-tt]')?.getAttribute('data-tt-vue'), lignes: document.querySelectorAll('tr[data-tt-ligne]').length,
      bloque: document.querySelectorAll('tr[data-tt-statut-ligne="bloque"]').length }));
    dit(r.vue === 'liste' && r.lignes > 0 && r.bloque === 3, `O 1512${sombre ? ' · sombre' : ''} : le tableau « Articles » par défaut, ${r.bloque} lignes « Compte bloqué »`, r);
    const m = await pg.evaluate(MESURE);
    dit(m.contrastes.length === 0 && m.debord <= 0 && m.rouges.length === 0, `C D R 1512${sombre ? ' · sombre' : ''} : contrastes, débordement, rouge`, { k: m.contrastes.slice(0, 4), d: m.debord, r: m.rouges.slice(0, 4) });
    await pg.screenshot({ path: path.join(SHOTS, `tableau-1512${sombre ? '-sombre' : ''}.png`) });
    const g = await pg.$('[data-tt-vue="grille"]');
    if (g) { await g.click(); await pg.waitForTimeout(1200); }
    const c = await pg.evaluate(MESURE);
    dit(c.nCartes > 0 && c.colonnes >= 4 && c.prix, `O 1512${sombre ? ' · sombre' : ''} : la grille montre les cartes « Dressing » (${c.nCartes} cartes, ${c.colonnes} colonnes)`, { n: c.nCartes, col: c.colonnes });
    await pg.screenshot({ path: path.join(SHOTS, `grille-1512${sombre ? '-sombre' : ''}.png`) });
    await ctx.close();
  }
  // ── V. 1 000 annonces au téléphone ──
  { RETARD = 0;
    const { ctx, pg, tRendu } = await ouvrir(nav, TEL, '?v=volume'); await pg.waitForTimeout(600);
    const r = await pg.evaluate(MESURE);
    const visibles = await pg.evaluate(() => [...document.querySelectorAll('[data-ad-rangee]')].filter((c) => { const b = c.getBoundingClientRect(); return b.top < innerHeight && b.bottom > 0; }).length);
    await pg.evaluate(async () => { for (let y = 0; y < document.scrollingElement.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((f) => setTimeout(f, 30)); } });
    const cls = await pg.evaluate(() => window.__cls);
    dit(tRendu < 6000 && r.noeuds < 12000, `V 1 000 annonces : premier rendu ${tRendu} ms, ${r.noeuds} nœuds dans la liste (60 par compte, puis « Voir N de plus »)`, { tRendu, noeuds: r.noeuds });
    dit(visibles >= 6, `V 390 : ${visibles} rangées sur le premier écran (sous le titre, la recherche et les segments)`, visibles);
    await pg.evaluate(() => { const l = document.querySelector('[data-ad-rangee]'); window.scrollTo(0, l.getBoundingClientRect().top + window.scrollY - 120); }); await pg.waitForTimeout(300);
    const entieres = await pg.evaluate(() => [...document.querySelectorAll('[data-ad-rangee]')].filter((c) => { const b = c.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight - 83; }).length);
    dit(entieres >= 8, `V 390 : ${entieres} rangées entières sur un écran d'iPhone une fois dans la liste (≥ 8)`, entieres);
    await pg.screenshot({ path: path.join(SHOTS, 'volume-liste-390.png') });
    dit(cls < 0.05, `V défilement jusqu'en bas sans saut (CLS ${cls.toFixed(4)})`, cls);
    await ctx.close(); RETARD = 700; }
}
(async () => {
  construire();
  const s = await servir();
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    if (PROUVE) {
      let pris = 0; const M = Object.keys(MUT);
      for (const m of M) { const avant = rouges; await juger(nav, m); const ok = rouges > avant; if (ok) pris++; console.log(`${ok ? '✅' : '❌'} mutation « ${m} » ⇒ ${ok ? (rouges - avant) + ' rouge(s)' : 'VERTE'}`); }
      console.log(pris === M.length ? `\n✅ ${pris}/${M.length} mutations attrapées` : `\n❌ ${M.length - pris} mutation(s) non vue(s)`);
      process.exitCode = pris === M.length ? 0 : 1;
    } else {
      await juger(nav);
      console.log(rouges ? `\n❌ banc annonces-dressing : ${rouges} rouge(s), ${verts} vert(s) — captures : ${SHOTS}` : `\n✅ banc annonces-dressing : ${verts} verts — captures : ${SHOTS}`);
      process.exitCode = rouges ? 1 : 0;
    }
  } finally { await nav.close(); s.close(); fs.rmSync(DOSSIER, { recursive: true, force: true }); }
})();
