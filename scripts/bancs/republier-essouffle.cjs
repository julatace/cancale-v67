// ═══════════════════════════════════════════════════════════
//  BANC — « S'ESSOUFFLE » EN TÊTE DE « À REPUBLIER » (28 nov., choix de Julien)
//
//  Construit outils/republier-essouffle/ (esbuild, hors paquet de prod) : l'écran Annonces natif sur « À republier »,
//  nourri par les VRAIES règles (src/articles/, src/republierPriorite.js, src/essoufflement.js) sur une base et des
//  courbes INVENTÉES (2 comptes ; le 111 a 3 republications passées mesurées, le 444 aucune).
//  Mesures (data-* et nombres, jamais un libellé) — 390 × 844 tactile (DPR 3) et 1512 × 900, clair et sombre :
//   T  les essoufflées en TÊTE (la jeune de 12 j comprise), dans l'ordre de la règle ; une réservée, une à trou : jamais ;
//   P  chaque essoufflée : sa phrase (≤ 8 mots), le gain dessous (« +21 vues en 3 j · d'après 3 ») ou « — » (compte 444) ;
//   G  RIEN NE PART SANS SON TOUCHER : à l'arrivée et 2 s après, aucune ouverture ; « Republier » d'une ligne ⇒ l'atelier
//      avec CETTE annonce seule ;
//   S  courbes pas lues ⇒ aucune essoufflée, le pied dit « — » ;
//   D  cibles ≥ 44, contrastes ≥ 4,5:1, aucun débordement, aucun rouge ni orange/ambre.
//  SHOTS : le dossier des captures. BANC_PORT (4797 par défaut).
// ═══════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const PORT = Number(process.env.BANC_PORT) || 4797;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-republier-essouffle');
const DOSSIER = path.join(os.tmpdir(), 'banc-republier-essouffle-build-' + process.pid);
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(DOSSIER, { recursive: true });
let rouges = 0, verts = 0;
const dit = (ok, quoi, d) => { if (ok) { verts++; console.log('  ✅ ' + quoi); } else { rouges++; console.log('  ❌ ' + quoi + (d !== undefined ? '\n       ' + JSON.stringify(d).slice(0, 600) : '')); } return ok; };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/);
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx');
  fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'republier-essouffle', 'banc.jsx')], bundle: true, outfile: path.join(DOSSIER, 'banc.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file', '.svg': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    external: ['/brands/*'], alias: { 'vrm-icones-app': gen }, nodePaths: [NM], logLevel: 'silent' });
  fs.copyFileSync(path.join(RACINE, 'outils', 'republier-essouffle', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };
const servir = () => new Promise((ok) => { const s = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const ph = /^\/photo\/(\d+)\.svg$/.exec(u);
  if (ph) { const i = Number(ph[1]); res.writeHead(200, { 'content-type': 'image/svg+xml' });
    res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="hsl(${(i * 47) % 360},22%,62%)"/><ellipse cx="150" cy="190" rx="110" ry="46" fill="hsl(${(i * 47 + 180) % 360},30%,40%)"/></svg>`); return; }
  if (/^\/brands\//.test(u)) { const f = path.join(RACINE, 'public', u); res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end(fs.existsSync(f) ? fs.readFileSync(f) : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>'); return; }
  const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }); s.listen(PORT, () => ok(s)); });

const MESURE = () => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const lire = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const sur = (c, f) => ({ r: c.r * c.a + f.r * (1 - c.a), g: c.g * c.a + f.g * (1 - c.a), b: c.b * c.a + f.b * (1 - c.a), a: 1 });
  const fondDe = (el) => { const pile = []; for (let e = el; e; e = e.parentElement) { const c = lire(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break; } } let f = { r: 255, g: 255, b: 255, a: 1 }; if (document.documentElement.getAttribute('data-theme') === 'dark') f = { r: 0, g: 0, b: 0, a: 1 }; for (const c of pile.reverse()) f = sur(c, f); return f; };
  const vis = (b) => b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight;
  const zone = document.querySelector('[data-prio-ecran]') || document.body;
  const r = { contrastes: [], cibles: [], couleurs: [], debord: document.scrollingElement.scrollWidth - innerWidth };
  const w = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const el = t.parentElement; if (!t.nodeValue.trim() || !el) continue; const cs = getComputedStyle(el); const b = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || !vis(b) || el.closest('[aria-hidden="true"],[hidden],.n-eg-sr')) continue;
    const c = lire(cs.color); if (!c) continue; const fd = fondDe(el); const x = sur({ ...c, a: c.a * Number(cs.opacity || 1) }, fd); const L1 = lum(x), L2 = lum(fd); const k = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (k < 4.5) r.contrastes.push({ t: t.nodeValue.trim().slice(0, 24), k: Math.round(k * 100) / 100 });
  }
  for (const el of document.querySelectorAll('[data-prio-ecran] button, [data-prio-ecran] [role="checkbox"], [data-prio-ecran] summary, [data-prio-lancer]')) {
    const b = el.getBoundingClientRect(); if (!vis(b) || el.closest('[hidden],[aria-hidden="true"]')) continue;
    if (b.width < 44 || b.height < 44) r.cibles.push({ q: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 24), w: Math.round(b.width), h: Math.round(b.height) });
  }
  // Rouge (réservé au doublon de N°) et orange / ambre (refusés) : teinte entre 10° et 50°, saturée.
  const teinte = (c) => { const R = c.r / 255, G = c.g / 255, B = c.b / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn; if (d < 0.25) return null; let h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4; h *= 60; if (h < 0) h += 360; return h; };
  for (const el of zone.querySelectorAll('*')) { const cs = getComputedStyle(el); for (const s of [el.textContent.trim() ? cs.color : '', cs.backgroundColor]) { const c = lire(s); if (!c || c.a < 0.5) continue; const h = teinte(c); if (h != null && (h < 50 || h > 340) && !el.closest('.n-plaque[data-n-doublon]')) r.couleurs.push((el.className || el.tagName) + ':' + s); } }
  const L = [...document.querySelectorAll('[data-prio-ligne]')];
  r.lignes = L.map((e) => ({ id: e.getAttribute('data-prio-annonce'), rang: Number(e.getAttribute('data-prio-rang')), ess: e.getAttribute('data-ess-jours'), gain: e.getAttribute('data-ess-gain'), gainN: e.getAttribute('data-ess-gain-n'),
    texte: (e.closest('.n-rangee, [data-prio-ligne]') || e).textContent.slice(0, 200) }));
  // Le texte de la ligne (rangée + son pied) : la rangée et son pied sont frères.
  r.pieds = [...document.querySelectorAll('[data-ess-pied]')].map((p) => ({ txt: (p.closest('[data-prio-ligne]') || p.parentElement).textContent.slice(0, 240), bouton: !!p.querySelector('[data-ess-republier]') }));
  const pied = document.querySelector('[data-prio-pied]');
  r.pied = pied ? { etat: pied.getAttribute('data-ess-etat'), n: pied.getAttribute('data-ess-n'), txt: pied.textContent } : null;
  r.ouvertures = (window.__ouvertures || []).slice();
  return r;
};
const TEL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true };
const ORDI = { viewport: { width: 1512, height: 900 } };
async function ouvrir(nav, opts, q) {
  const ctx = await nav.newContext(opts); const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.goto(`http://127.0.0.1:${PORT}/${q}`);
  try { await pg.waitForSelector('[data-prio-ecran]', { timeout: 20000 }); } catch (_) {}
  if (opts.isMobile) await pg.addStyleTag({ content: ':root{--n-zone-haut:47px;--n-zone-bas:34px}' });
  await pg.waitForTimeout(400); return { ctx, pg, erreurs };
}

(async () => {
  try { construire(); } catch (e) { dit(false, 'la page du banc se construit', String(e.message).slice(0, 300)); console.log(`\n${verts} verts, ${rouges} rouges`); process.exit(1); }
  const srv = await servir();
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const [nomV, V] of [['390', TEL], ['1512', ORDI]]) for (const sombre of [false, true]) {
      const ou = nomV + (sombre ? ' · sombre' : '');
      console.log('── ' + ou);
      const { ctx, pg, erreurs } = await ouvrir(nav, V, `?x=1${sombre ? '&theme=dark' : ''}`);
      const r0 = await pg.evaluate(MESURE);
      const regle = await pg.evaluate(() => window.__banc.prio);
      const ess = r0.lignes.filter((l) => l.ess);
      dit(regle && regle.ess.join() === '10002,10010,10001,10003,10020' && ess.map((l) => l.id).join() === regle.ess.join(),
        `T ${ou} : 5 essoufflées, celles de la règle (le gain connu d'abord, la plus longue à plat), la jeune de 12 j comprise`, { regle: regle && regle.ess, vu: ess.map((l) => l.id) });
      dit(r0.lignes.slice(0, 4).every((l) => l.ess) && r0.lignes.findIndex((l) => !l.ess) > r0.lignes.findIndex((l) => l.id === '10003'),
        `T ${ou} : en TÊTE de « À republier » (dans chaque compte, devant les paires qui dorment)`, r0.lignes.map((l) => l.id + (l.ess ? '*' : '')));
      dit(!r0.lignes.some((l) => l.id === '10005' || l.id === '10011') && regle.exclues.reservee === 1 && regle.etat.passu === 1, `T ${ou} : réservée (comptée) et courbe à trou (pas su) jamais proposées`, { ex: regle.exclues, etat: regle.etat });
      const l2 = r0.lignes.find((l) => l.id === '10002'), l20 = r0.lignes.find((l) => l.id === '10020');
      dit(l2 && l2.ess === '7' && l2.gain === '21' && l2.gainN === '3' && /Presque aucune vue depuis 7 jours/.test(l2.texte) && /\+21 vues en 3 j · d’après 3 republications/.test(l2.texte),
        `P ${ou} : « Presque aucune vue depuis 7 jours », puis « +21 vues en 3 j · d’après 3 republications »`, l2);
      dit(l20 && l20.gain === '' && l20.gainN === '0' && /Relancée : — · aucune republication relue sur ce compte/.test(l20.texte), `P ${ou} : compte sans republication ⇒ « — » et pourquoi (jamais un chiffre)`, l20);
      dit(r0.pieds.length === 5 && r0.pieds.every((p) => p.bouton), `P ${ou} : chaque essoufflée porte « Republier »`, r0.pieds.length);
      await pg.waitForTimeout(2000);
      dit((await pg.evaluate(() => window.__ouvertures.length)) === 0, `G ${ou} : RIEN n'est ouvert sans son toucher (à l'arrivée et 2 s après)`);
      dit(r0.cibles.length === 0, `D ${ou} : cibles ≥ 44 × 44`, r0.cibles.slice(0, 6));
      dit(r0.contrastes.length === 0, `D ${ou} : contrastes ≥ 4,5:1`, r0.contrastes.slice(0, 6));
      dit(r0.couleurs.length === 0 && r0.debord <= 0, `D ${ou} : ni rouge, ni orange, ni ambre ; aucun débordement`, { c: r0.couleurs.slice(0, 4), d: r0.debord });
      await pg.screenshot({ path: path.join(SHOTS, `essouffle-${nomV}${sombre ? '-sombre' : ''}.png`) });
      if (!sombre) { await pg.screenshot({ path: path.join(SHOTS, `essouffle-${nomV}-page.png`), fullPage: true }); }
      // Le geste d'UNE ligne : l'atelier avec CETTE annonce seule.
      const b = pg.locator('[data-ess-republier="10001"]').first();
      await b.evaluate((e) => e.scrollIntoView({ block: 'center' })); await pg.waitForTimeout(200);
      await b.click(); await pg.waitForTimeout(300);
      const ouv = await pg.evaluate(() => window.__ouvertures.slice());
      dit(ouv.length === 1 && ouv[0] === 'https://www.vinted.fr/?vrm=panneau&page=republier&ids=10001&action=republier', `G ${ou} : « Republier » ⇒ l'atelier, cette annonce seule`, ouv);
      if (!sombre && nomV === '390') {
        await pg.locator('[data-prio-ligne="' + (await pg.getAttribute('[data-prio-annonce="10002"]', 'data-prio-ligne')) + '"] ~ * [data-ess-pourquoi] summary, [data-ess-pourquoi] summary').first().click().catch(() => {});
        await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SHOTS, 'essouffle-390-pourquoi.png') });
      }
      dit(erreurs.length === 0, `${ou} : aucune erreur de page`, erreurs.slice(0, 2));
      await ctx.close();
    }
    for (const [etat, attendu] of [['passu', 'passu'], ['lecture', 'lecture']]) {
      const { ctx, pg, erreurs } = await ouvrir(nav, TEL, `?courbes=${etat}`);
      const r = await pg.evaluate(MESURE);
      dit(r.lignes.every((l) => !l.ess) && r.pied && r.pied.etat === attendu && r.pied.n === '0' && (etat === 'passu' ? /S’essouffle : —/.test(r.pied.txt) : /Lecture des courbes/.test(r.pied.txt)),
        `S courbes ${etat} : aucune essoufflée, le pied le dit`, r.pied);
      if (etat === 'passu') await pg.screenshot({ path: path.join(SHOTS, 'essouffle-390-passu.png'), fullPage: true });
      dit(erreurs.length === 0, `S ${etat} : aucune erreur de page`, erreurs.slice(0, 2));
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${verts} verts, ${rouges} rouges — captures : ${SHOTS}`);
  process.exit(rouges ? 1 : 0);
})();
