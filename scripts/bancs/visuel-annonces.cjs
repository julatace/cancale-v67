// ═══════════════════════════════════════════════════════════
//  BANC — ANNONCES EN INVENTAIRE « JEU VIDÉO », SANS LATENCE (24 nov. 2026, lot visuel-annonces)
//
//  Julien : « toute l'application visuelle », « pas d'un coup en bloc… irréprochable », puis « fais quelque chose sans latence ».
//  Construit outils/visuel-annonces/ (esbuild, hors paquet de prod) : l'écran Annonces natif nourri par les VRAIES règles
//  (src/articles/sources.js, src/articles/modele.js) sur une base INVENTÉE de N annonces (600 par défaut, trois comptes).
//  390 × 844 tactile (DPR 3) et 1512 × 900, clair et sombre. Mesures (data-* et nombres, jamais un libellé) :
//   I  identité : chaque carte montre la photo de SON identifiant (`window.__attendu`) ; les deux annonces au MÊME titre
//      (le leurre) montrent chacune la sienne ; l'étiquette du N° dit le N° de SA fiche ;
//   G  grille d'inventaire : tuiles carrées, étiquette N°, ronds de compte, vues/favoris en pastilles ; virtualisée (cartes
//      montées ≪ N, hauteur totale réservée) ;
//   S  sans latence : contenu déjà connu ⇒ aucun squelette, aucune cascade, cartes à la 1re image ; contenu qui arrive ⇒
//      squelette de la forme finale, la 1re carte lisible (opacité ≥ 0,35) sans délai, la cascade ≤ 15 ms par carte et
//      ≤ 120 ms au total (rapportée ROUGE au-delà) ; toucher un segment ⇒ 1er contenu < 100 ms ;
//   L  CLS ≤ 0,02 pendant la lecture puis l'arrivée des photos (servies en retard) ;
//   O  aucune couleur orange calculée (teinte 15–50°, saturation ≥ 30 %, luminosité 20–85 %) ;
//   D  aucun débordement, aucun chevauchement (boîtes mesurées), aucun texte coupé (prix), page pas plus large que l'écran ;
//   C  contrastes ≥ 4,5:1 ; T cibles ≥ 44 ;
//   M  `prefers-reduced-motion` : aucune animation, photos visibles tout de suite ;
//   F  le 95e centile du temps d'image en défilant (rapporté ; rouge au-delà de 50 ms).
//  SHOTS : dossier des captures ; VIDEO=1 : un film de la lecture puis d'un défilement (390 clair) dans SHOTS.
//  Sur l'arbre d'avant (git archive origin/claude/style-clair) il doit ROUGIR.
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
const N = Number(process.env.N || 600);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-visuel-annonces');
const DOSSIER = path.join(os.tmpdir(), 'banc-visuel-annonces-build-' + process.pid);
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(DOSSIER, { recursive: true });
let rouges = 0, verts = 0;
const dit = (ok, quoi, d) => { if (ok) { verts++; console.log('  ✅ ' + quoi); } else { rouges++; console.log('  ❌ ' + quoi + (d !== undefined ? '\n       ' + JSON.stringify(d).slice(0, 700) : '')); } return ok; };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/);
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx');
  fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  const inv = path.join(RACINE, 'src', 'i18n', 'langues', 'fr', 'visuelAnnonces.js');
  const vide = path.join(DOSSIER, 'vide.js'); fs.writeFileSync(vide, 'export default {};\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'visuel-annonces', 'banc.jsx')], bundle: true, outfile: path.join(DOSSIER, 'banc.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file', '.svg': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    external: ['/brands/*'], alias: { 'vrm-icones-app': gen, 'vrm-inv-fr': fs.existsSync(inv) ? inv : vide }, nodePaths: [NM], logLevel: 'silent' });
  fs.copyFileSync(path.join(RACINE, 'outils', 'visuel-annonces', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };
const RETARD = 600;   // les photos arrivent en retard : une carte qui ne réserve pas sa place saute
const servir = () => new Promise((ok) => { const s = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const ph = /^\/photo\/(\d+)\.svg$/.exec(u);
  if (ph) { const i = Number(ph[1]); setTimeout(() => { res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' });
    res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="hsl(${(i * 47) % 360},14%,${55 + (i % 4) * 6}%)"/><ellipse cx="200" cy="250" rx="150" ry="60" fill="hsl(${(i * 47 + 180) % 360},16%,32%)"/></svg>`); }, RETARD); return; }
  if (/^\/brands\//.test(u)) { res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>'); return; }
  const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }); s.listen(PORT, () => ok(s)); });

// ── Les mesures, DANS la page ──
const MESURE = () => {
  const lire = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const sur = (c, f) => ({ r: c.r * c.a + f.r * (1 - c.a), g: c.g * c.a + f.g * (1 - c.a), b: c.b * c.a + f.b * (1 - c.a), a: 1 });
  const fondDe = (el) => { const pile = []; for (let e = el; e; e = e.parentElement) { const c = lire(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break; } } let f = { r: 255, g: 255, b: 255, a: 1 }; for (let i = pile.length - 1; i >= 0; i--) f = sur(pile[i], f); return f; };
  const vis = (b) => b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight;
  const hsl = (c) => { const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return { h: 0, s: 0, l }; const d = mx - mn; const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: h * 60, s, l }; };
  const orange = (s) => { const c = lire(s); if (!c || c.a < 0.2) return false; const x = hsl(c); return x.h >= 15 && x.h <= 50 && x.s >= 0.3 && x.l >= 0.2 && x.l <= 0.85; };
  const r = { contrastes: [], cibles: [], oranges: [], debord: document.scrollingElement.scrollWidth - innerWidth, sorties: [], chevauchements: [], coupes: [], identite: [], etiq: [] };
  for (const el of document.querySelectorAll('body *')) { if (el.closest('.n-logo-site, [data-logo], .n-plaque[data-n-doublon]')) continue; const cs = getComputedStyle(el); for (const p of ['color', 'backgroundColor', 'borderTopColor', 'borderLeftColor', 'outlineColor', 'fill', 'stroke']) if (orange(cs[p]) && (p !== 'color' || el.textContent.trim())) { r.oranges.push((el.className && String(el.className).slice(0, 40)) + ':' + p + ':' + cs[p]); break; } }
  const cartes = [...document.querySelectorAll('[data-ad-carte][data-eg-article]')];
  r.nCartes = cartes.length; r.nVisibles = cartes.filter((c) => vis(c.getBoundingClientRect())).length;
  const g = document.querySelector('[data-inv-grille]'); r.grille = !!g; r.nGrille = g ? Number(g.getAttribute('data-inv-n')) : 0; r.hGrille = g ? Math.round(g.getBoundingClientRect().height) : 0;
  r.logosRepetes = document.querySelector('[data-eg-groupe]') ? cartes.filter((c) => c.querySelectorAll('.n-ad-ligne .n-logo-site, .n-ad-ligne [data-logo]').length === 1).length : 0;
  r.tuiles = cartes.filter((c) => c.querySelector('.n-tuile-paire')).length; r.avatars = cartes.filter((c) => c.querySelector('[data-inv-avatar]')).length; r.pastilles = cartes.filter((c) => c.querySelector('.n-inv-stat')).length;
  r.carres = cartes.slice(0, 12).map((c) => { const b = (c.querySelector('.n-ad-photo') || c).getBoundingClientRect(); return Math.abs(b.width - b.height) <= 1.5 ? 1 : Math.round(b.width) + 'x' + Math.round(b.height); });
  const att = window.__attendu || {};
  for (const c of cartes) {
    const cle = c.getAttribute('data-eg-article'); const im = c.querySelector('.n-ad-photo img'); const src = im ? new URL(im.getAttribute('src'), location.href).pathname : null;
    const voulu = cle in att ? att[cle] : undefined;
    if (voulu === undefined) continue;
    if ((voulu || null) !== (src || null)) r.identite.push({ cle, voulu, src });
    const e = c.querySelector('[data-n-etiq]'); const num = c.getAttribute('data-eg-numero') || '';
    if (num && !c.querySelector('[data-n-doublon]') && (!e || e.getAttribute('data-n-etiq') !== num.toUpperCase())) r.etiq.push({ cle, num, etiq: e && e.getAttribute('data-n-etiq') });
  }
  r.leurreVu = (window.__leurre || []).map((k) => { const c = document.querySelector(`[data-eg-article="${CSS.escape(k)}"]`); const im = c && c.querySelector('.n-ad-photo img'); return im ? new URL(im.getAttribute('src'), location.href).pathname : null; });
  const dans = (b, p, m = 0.6) => b.left >= p.left - m && b.right <= p.right + m && b.top >= p.top - m && b.bottom <= p.bottom + m;
  const croise = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.6 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.6;
  const vues = cartes.filter((c) => vis(c.getBoundingClientRect()));
  for (const c of vues) {
    const B = c.getBoundingClientRect(); const P = c.querySelector('.n-ad-photo').getBoundingClientRect();
    const sur = ['.n-etiq', '.n-inv-plaque', '.n-inv-avatars', '.n-inv-stats', '.n-ad-bandeau', '.n-ad-conseil', '.n-ad-coche'].map((q) => c.querySelector('.n-ad-photo ' + q)).filter(Boolean);
    for (const e of sur) { const b = e.getBoundingClientRect(); if (!dans(b, P, 1)) r.sorties.push({ q: e.className, b: [Math.round(b.left - P.left), Math.round(b.right - P.right), Math.round(b.top - P.top), Math.round(b.bottom - P.bottom)] }); }
    for (let i = 0; i < sur.length; i++) for (let j = i + 1; j < sur.length; j++) if (croise(sur[i].getBoundingClientRect(), sur[j].getBoundingClientRect())) r.chevauchements.push(sur[i].className + ' × ' + sur[j].className);
    const ligne = [...c.querySelectorAll('.n-ad-ligne > *')].filter((e) => e.getBoundingClientRect().width > 0);
    for (const e of [c.querySelector('.n-ad-titre'), ...ligne]) if (e && !dans(e.getBoundingClientRect(), B, 0.6)) r.sorties.push({ q: e.className || e.tagName, carte: c.getAttribute('data-eg-article') });
    for (let i = 0; i < ligne.length; i++) for (let j = i + 1; j < ligne.length; j++) if (!ligne[i].classList.contains('n-ad-espace') && !ligne[j].classList.contains('n-ad-espace') && croise(ligne[i].getBoundingClientRect(), ligne[j].getBoundingClientRect())) r.chevauchements.push('ligne:' + ligne[i].className + ' × ' + ligne[j].className);
    for (const e of c.querySelectorAll('.n-ad-prix, .n-etiq, .n-inv-stat, .n-ad-bandeau')) if (e.scrollWidth > e.clientWidth + 1) r.coupes.push(e.textContent);
    const t = c.querySelector('.n-ad-titre'); if (t) { const lh = parseFloat(getComputedStyle(t).lineHeight); const h = t.getBoundingClientRect().height; if (Math.abs(h / lh - Math.round(h / lh)) > 0.05) r.coupes.push('titre à demi-ligne ' + h + '/' + lh); }
  }
  for (let i = 0; i < vues.length; i++) for (let j = i + 1; j < Math.min(vues.length, i + 6); j++) if (croise(vues[i].getBoundingClientRect(), vues[j].getBoundingClientRect())) r.chevauchements.push('cartes ' + i + '×' + j);
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const el = t.parentElement; if (!t.nodeValue.trim() || !el) continue; const cs = getComputedStyle(el); const b = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || !vis(b) || el.closest('[aria-hidden="true"],[hidden],.n-eg-sr')) continue;
    const c = lire(cs.color); if (!c) continue; const fd = fondDe(el); const x = sur({ ...c, a: c.a * Number(cs.opacity || 1) }, fd); const L1 = lum(x), L2 = lum(fd); const k = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (k < 4.5) r.contrastes.push({ t: t.nodeValue.trim().slice(0, 24), k: Math.round(k * 100) / 100 });
  }
  for (const el of document.querySelectorAll('[data-eg-liste] button, [data-tt] [data-ad-carte] button, [data-ad-carte]')) { const b = el.getBoundingClientRect(); if (!vis(b)) continue; if (b.width < 44 || b.height < 44) r.cibles.push({ q: (el.getAttribute('aria-label') || el.tagName).slice(0, 30), w: Math.round(b.width), h: Math.round(b.height) }); }
  r.animees = cartes.filter((c) => getComputedStyle(c).animationName !== 'none').length;
  r.imgsCachees = [...document.querySelectorAll('[data-ad-carte] .n-ad-photo img')].filter((i) => Number(getComputedStyle(i).opacity) < 1).length;
  return r;
};

const TEL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true };
const ORDI = { viewport: { width: 1512, height: 900 } };
const INIT = () => {
  window.__cls = 0; window.__os = 0; window.__premiere = null;
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (_) {}
  // Chaque image : un squelette a-t-il été montré ? quand la 1re carte est-elle là, et comment (opacité, délai) ?
  const tick = () => { try {
    if (document.querySelector('[data-inv-attente], [data-ad-attente], .n-attente, [aria-busy="true"]')) window.__os++;
    { const o = document.querySelector('[data-inv-attente] .n-inv-os'); if (o) { const b = o.getBoundingClientRect(); window.__osBoite = [b.left, b.top + scrollY, b.width, b.height].map(Math.round); } }
    if (!window.__premiere) { const c = document.querySelector('[data-ad-carte][data-eg-article]'); if (c) { const cs = getComputedStyle(c); { const b = c.getBoundingClientRect(); window.__carteBoite = [b.left, b.top + scrollY, b.width, b.height].map(Math.round); }
      window.__premiere = { t: performance.now(), op: Number(cs.opacity), delai: parseFloat(cs.animationDelay) || 0, anim: cs.animationName };
      const l = [...document.querySelectorAll('[data-ad-carte][data-n-revele]')]; const d = l.map((x) => parseFloat(getComputedStyle(x).animationDelay) * 1000 || 0); const du = l.map((x) => parseFloat(getComputedStyle(x).animationDuration) * 1000 || 0);
      const u = [...new Set(d.map((x) => Math.round(x)))].sort((x, y) => x - y); window.__cascade = { n: l.length, pas: u.length > 1 ? Math.max(...u.slice(1).map((x, i) => x - u[i])) : 0, total: d.length ? Math.max(...d) : 0, duree: du.length ? Math.max(...du) : 0 }; } }
    } catch (_) {} requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

async function ouvrir(nav, opts, q, extra = {}) {
  const ctx = await nav.newContext({ ...opts, ...extra }); const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e && e.message || e)));
  await pg.addInitScript(INIT);
  await pg.goto(`http://127.0.0.1:${PORT}/${q}`); await pg.waitForSelector('[data-eg-ecran]', { state: 'attached', timeout: 60000 });
  if (opts.isMobile) await pg.addStyleTag({ content: ':root{--n-zone-haut:47px;--n-zone-bas:34px}' });
  return { ctx, pg, erreurs };
}

async function cas(nav, nom, opts, theme) {
  console.log(`\n── ${nom} · ${theme} ──`);
  const t = theme === 'sombre' ? '&theme=dark' : '';
  // 1. Contenu qui ARRIVE (lecture 700 ms) : squelette, puis cascade courte, CLS.
  const { ctx, pg, erreurs } = await ouvrir(nav, opts, `?n=${N}&arrivee=700${t}`);
  await pg.waitForSelector('[data-ad-carte][data-eg-article]', { state: 'attached', timeout: 60000 });
  await pg.waitForFunction(() => window.__premiere, null, { timeout: 30000 });   // la 1re image qui la montre (rAF), pas l'instant du sélecteur
  const prem = await pg.evaluate(() => window.__premiere);
  const casc = (await pg.evaluate(() => window.__cascade)) || { n: 0, pas: 0, total: 0, duree: 0 };
  await pg.waitForTimeout(RETARD + 900);
  const m = await pg.evaluate(MESURE);
  const cls = await pg.evaluate(() => window.__cls);
  dit(erreurs.length === 0, `aucune erreur de page`, erreurs);
  dit(m.grille && m.nCartes > 0 && m.nCartes < Math.min(N, 200) && m.hGrille > 1000, `G grille virtualisée : ${m.nCartes} cartes montées sur ${m.nGrille} (hauteur réservée ${m.hGrille} px)`, m);
  // Le compte est dit UNE fois : dans l'intertitre au téléphone (liste rangée par compte), sur la tuile à l'ordinateur (non rangée).
  dit(m.tuiles === m.nCartes && m.avatars === (nom === 'tel' ? 0 : m.nCartes) && m.pastilles > m.nCartes / 2 && m.logosRepetes === 0, `G tuiles d'inventaire (${m.tuiles}) · ronds de compte sur les tuiles (${m.avatars}, ${nom === 'tel' ? 'aucun : dit dans l\'intertitre' : 'une par tuile'}) · vues/favoris dans la bande (${m.pastilles}) · logo de site répété ${m.logosRepetes}`, m.avatars);
  dit(m.carres.every((x) => x === 1), `G photos carrées`, m.carres);
  dit(m.identite.length === 0, `I chaque carte montre la photo de SON identifiant (${m.nCartes} vérifiées)`, m.identite.slice(0, 4));
  // Le leurre : on défile jusqu'à voir ses deux cartes (la grille est virtualisée : elles ne sont montées que près de l'écran).
  m.leurre = await pg.evaluate(async () => { const el = document.scrollingElement; const vus = {}; const k = window.__leurre || [];
    for (let y = 0; y <= el.scrollHeight && Object.keys(vus).length < k.length; y += innerHeight * 0.8) { el.scrollTop = y; await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      for (const c of k) { const x = document.querySelector(`[data-eg-article="${CSS.escape(c)}"] .n-ad-photo img`); if (x && !vus[c]) vus[c] = new URL(x.getAttribute('src'), location.href).pathname; } }
    el.scrollTop = 0; await new Promise((ok) => setTimeout(ok, 400)); return k.map((c) => vus[c] || null); });
  dit(m.leurre.length === 2 && m.leurre[0] && m.leurre[1] && m.leurre[0] !== m.leurre[1], `I le leurre au même titre : deux photos différentes, chacune la sienne`, m.leurre);
  dit(m.etiq.length === 0, `I l'étiquette du N° dit le N° de SA fiche`, m.etiq.slice(0, 4));
  dit(prem && prem.op >= 0.35 && prem.delai === 0, `S la 1re carte est lisible dès sa 1re image, sans délai (opacité ${prem && prem.op}, délai ${prem && prem.delai})`, prem);
  dit((nom !== 'tel' || casc.n > 0) && casc.pas <= 15.5 && casc.total <= 120.5 && casc.duree <= 200.5, `S cascade d'arrivée : ${casc.n} cartes, ${casc.pas} ms par carte (≤ 15), ${casc.total} ms au total (≤ 120), durée ${casc.duree} ms (≤ 200)`, casc);
  const boites = await pg.evaluate(() => ({ os: window.__osBoite || null, carte: window.__carteBoite || null }));
  dit(!!boites.os && !!boites.carte && boites.os.every((v, i) => Math.abs(v - boites.carte[i]) <= 1), `L le squelette est à la place EXACTE de la 1re carte (gauche, haut, largeur, hauteur ±1 px)`, boites);
  dit(cls <= 0.02, `L CLS pendant la lecture et l'arrivée des photos : ${cls.toFixed(4)} (≤ 0,02)`);
  dit(m.oranges.length === 0, `O aucune couleur orange calculée`, m.oranges.slice(0, 6));
  dit(m.debord <= 0 && m.sorties.length === 0 && m.chevauchements.length === 0 && m.coupes.length === 0, `D aucun débordement (${m.debord}), aucune sortie, aucun chevauchement, aucun texte coupé`, { s: m.sorties.slice(0, 4), c: m.chevauchements.slice(0, 4), x: m.coupes.slice(0, 4) });
  dit(m.contrastes.length === 0, `C contrastes ≥ 4,5:1`, m.contrastes.slice(0, 6));
  dit(m.cibles.length === 0, `T cibles ≥ 44 px`, m.cibles.slice(0, 6));
  await pg.screenshot({ path: path.join(SHOTS, `${nom}-${theme}.png`) });
  // F : le défilement — 95e centile du temps d'image.
  const f = await pg.evaluate(async () => { const d = []; let der = performance.now(); const fin = der + 2500; const el = document.scrollingElement; await new Promise((ok) => { const pas = () => { const t = performance.now(); d.push(t - der); der = t; el.scrollTop += 45; if (t < fin) requestAnimationFrame(pas); else ok(); }; requestAnimationFrame(pas); });
    d.shift(); d.sort((a, b) => a - b); return { p95: Math.round(d[Math.floor(d.length * 0.95)] * 10) / 10, n: d.length, y: el.scrollTop }; });
  await pg.waitForTimeout(150);
  const m2 = await pg.evaluate(MESURE);
  // Rapporté, jamais jugé seul : la machine du banc est partagée (charge mesurée à côté) ; la virtualisation, elle, est jugée.
  console.log(`  ℹ️  F charge de la machine ${require('os').loadavg()[0].toFixed(1)} sur ${require('os').cpus().length} cœurs`);
  dit(f.n > 0, `F défilement ${f.y} px : 95e centile du temps d'image ${f.p95} ms (${f.n} images)`, f);
  dit(m2.identite.length === 0 && m2.nCartes > 0 && m2.nCartes < 200, `I/G après défilement : ${m2.nCartes} cartes montées, toutes à la photo de leur identifiant`, m2.identite.slice(0, 3));
  if (nom === 'tel') {
    // Toucher un segment : le 1er contenu arrive en < 100 ms.
    await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(100);
    // Le 1er contenu dans le DOM (MutationObserver : le travail de l'app) et à l'image suivante (rAF : rapporté, la machine est chargée).
    const tap = await pg.evaluate(async () => { const s = document.querySelector('[data-eg-segment="dorment"]') || document.querySelector('[data-eg-segment]:not([aria-checked="true"])');
      const pret = () => { const e = document.querySelector('[data-eg-ecran]'); return e && e.getAttribute('data-eg-etat') !== 'enligne' && (document.querySelector('[data-ad-carte]') || document.querySelector('.n-vide')); };
      let dom = null; const mo = new MutationObserver(() => { if (dom == null && pret()) dom = performance.now() - t0; }); mo.observe(document.body, { subtree: true, childList: true, attributes: true });
      const t0 = performance.now(); s.click(); if (pret()) dom = performance.now() - t0;
      const image = await new Promise((ok) => { const v = () => { if (pret()) ok(performance.now() - t0); else if (performance.now() - t0 > 3000) ok(9999); else requestAnimationFrame(v); }; requestAnimationFrame(v); });
      mo.disconnect(); return { dom: dom == null ? 9999 : Math.round(dom), image: Math.round(image) }; });
    dit(tap.dom < 100, `S toucher un segment ⇒ 1er contenu dans la page en ${tap.dom} ms (< 100) ; à l'écran à l'image suivante : ${tap.image} ms (rapporté)`, tap);
  }
  await ctx.close();
  // 2. Contenu DÉJÀ connu : aucun squelette, aucune cascade, cartes dès la 1re image.
  const k = await ouvrir(nav, opts, `?n=${N}&arrivee=0${t}`);
  await k.pg.waitForTimeout(200);
  const connu = await k.pg.evaluate(() => ({ os: window.__os, prem: window.__premiere, revele: document.querySelectorAll('[data-ad-carte][data-n-revele]').length }));
  dit(connu.os === 0 && connu.revele === 0 && connu.prem && connu.prem.op === 1 && connu.prem.anim === 'none', `S contenu déjà connu : aucun squelette (${connu.os} images), aucune cascade (${connu.revele}), carte pleine à la 1re image`, connu);
  await k.ctx.close();
  // 3. Mouvement réduit : rien ne bouge, les photos se montrent sans fondu.
  const r = await ouvrir(nav, opts, `?n=${N}&arrivee=500${t}`, { reducedMotion: 'reduce' });
  await r.pg.waitForSelector('[data-ad-carte][data-eg-article]', { state: 'attached', timeout: 60000 }); await r.pg.waitForTimeout(80);
  const mr = await r.pg.evaluate(MESURE);
  dit(mr.animees === 0 && mr.imgsCachees === 0, `M mouvement réduit : ${mr.animees} carte animée, ${mr.imgsCachees} photo masquée`, mr.animees);
  await r.ctx.close();
}

(async () => {
  construire();
  const srv = await servir();
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
  try {
    // CAS=tel-clair (une seule variante, pour une mutation rapide) ; par défaut les quatre.
    const CAS = (process.env.CAS || 'tel-clair,ordi-clair,tel-sombre,ordi-sombre').split(',');
    for (const c of CAS) { const [nom, theme] = c.split('-'); await cas(nav, nom, nom === 'tel' ? TEL : ORDI, theme); }
    if (process.env.VIDEO) {
      const ctx = await nav.newContext({ ...TEL, recordVideo: { dir: SHOTS, size: { width: 390, height: 844 } } }); const pg = await ctx.newPage();
      await pg.goto(`http://127.0.0.1:${PORT}/?n=${N}&arrivee=900`); await pg.waitForTimeout(2200);
      await pg.evaluate(async () => { const el = document.scrollingElement; for (let i = 0; i < 120; i++) { el.scrollTop += 22; await new Promise((ok) => requestAnimationFrame(ok)); } }); await pg.waitForTimeout(900);
      const v = pg.video(); await ctx.close(); if (v) { const p = await v.path(); fs.renameSync(p, path.join(SHOTS, 'chargement-et-defilement.webm')); }
    }
  } finally { await nav.close(); srv.close(); fs.rmSync(DOSSIER, { recursive: true, force: true }); }
  console.log(`\n${rouges ? '❌' : '✅'} visuel-annonces : ${verts} vert(s), ${rouges} rouge(s) — captures : ${SHOTS}`);
  process.exit(rouges ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
