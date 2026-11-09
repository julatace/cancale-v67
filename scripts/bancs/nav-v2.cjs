require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA COLONNE DE GAUCHE ET LES BOUTONS » (9 nov., direction artistique 5)
//
//  Julien : « je veux vraiment que tu changes totalement le design des onglets
//  sur la gauche, que ce soit beaucoup plus beau […] les boutons font moins
//  qualitatif ». Ce banc juge des VALEURS RENDUES (jamais un libellé, §6.4),
//  sur le mode exemple (données inventées, src/exempleDonnees.js : aucune donnée
//  réelle, le dépôt est public) :
//   N1  la colonne FLOTTE : rayon ≥ 16, 8 px d'air au moins sur trois côtés,
//       une ombre, aucune bordure droite dure ; le contenu ne passe pas dessous ;
//   N2  cibles : chaque entrée ≥ 36 px à la souris, ≥ 44 au doigt ;
//   N3  UNE seule couleur d'accent visible dans la colonne, et seulement sur
//       l'entrée choisie (le point ambre « nouveau » et la tuile de marque à part) ;
//   N4  contraste AA (4,5:1) des libellés et des titres de groupe sur la matière ;
//   N5  la pastille de sélection GLISSE : un seul indicateur, sous l'entrée
//       choisie ; après un clic, à mi-course il est ENTRE les deux entrées ;
//       sous `prefers-reduced-motion` il saute (aucune transition de transform) ;
//   N6  1100 px : rail d'icônes (≤ 72 px), libellés cachés, chaque entrée garde
//       son nom (`title`/`aria-label`), titres de groupe visibles et entiers ;
//   N7  la logique ne bouge pas : mêmes groupes (`data-nav-groupe`), « VRM »,
//       l'écran ouvert = `aria-current` ;
//   N8  boutons : primaire = accent plein + reflet (dégradé) + ombre intérieure,
//       texte 600 ; secondaire sans bordure ; rayon de l'échelle ; ≥ 36 px.
//  Rouge sur origin/main (080956a8) : N1, N5, N6, N8.
//  `SHOTS=dossier` range les captures (à REGARDER, §6.2). `BANC_DIST`, `BANC_PORT`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10941;
const SHOTS = process.env.SHOTS || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000bb';
const SESSION = { access_token: 'jeton-banc-nav', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeur.banc@exemple.test', totp: [] } };
const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '  ✅ ' : '  ❌ '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, e.message || e); } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, { W, H = 920, sombre = false, reduit = false, toucher = false }) {
  const ctx = await nav.newContext({ viewport: { width: W, height: H }, hasTouch: toucher, deviceScaleFactor: SHOTS ? 2 : 1, colorScheme: sombre ? 'dark' : 'light', reducedMotion: reduit ? 'reduce' : 'no-preference', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript(([s, sombre]) => { try { if (!sessionStorage.getItem('banc_init')) {
    localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id);
    localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
    localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
    sessionStorage.setItem('banc_init', '1'); } } catch (_) {} }, [SESSION, sombre]);
  const lignes = [{ id: 'main', owner: UID, data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) } } }];
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), m = req.method(); const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200, rg) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': rg || `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
    if (!/\/rest\/v1\/app_data/.test(u) || m !== 'GET') return json([]);
    const r = servir(lignes.map((l) => ({ updated_at: iso(0), ...l })), u, req.headers()); return json(r.body, 200, r.range);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-exemple-entrer]', { timeout: 25000 });
  await Promise.all([pg.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}), pg.click('[data-exemple-entrer]')]);
  await pg.waitForSelector('[data-exemple-bandeau]', { timeout: 25000 });
  await pg.waitForSelector('.vrm-sidebar [aria-current="page"]', { timeout: 15000 });
  await pg.waitForTimeout(1500);
  return { ctx, pg, erreurs };
}
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); };

// Tout ce qu'on lit de la colonne, en une passe, DANS la page.
const lireColonne = (pg) => pg.evaluate(() => {
  const rgba = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const sur = (h, f) => ({ r: h.r * h.a + f.r * (1 - h.a), g: h.g * h.a + f.g * (1 - h.a), b: h.b * h.a + f.b * (1 - h.a), a: 1 });
  const lum = (c) => { const t = [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]; };
  const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const teinte = (c) => { const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b); const s = mx === 0 ? 0 : (mx - mn) / mx; return { s, chroma: mx - mn }; };
  const side = document.querySelector('.vrm-sidebar'); if (!side) return null;
  const cs = getComputedStyle(side), sr = side.getBoundingClientRect();
  const fondPage = rgba(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  const fondPageOk = fondPage.a === 0 ? { r: 255, g: 255, b: 255, a: 1 } : fondPage;
  const fondCol = sur(rgba(cs.backgroundColor) || { r: 0, g: 0, b: 0, a: 0 }, fondPageOk);
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none'; };
  const boutons = [...side.querySelectorAll('.vrm-rail-button')].filter(vis);
  const actif = side.querySelector('.vrm-rail-button[aria-current="page"]');
  // N3 : les couleurs vives (chroma) rendues dans la colonne, hors point ambre et tuile de marque.
  const vives = [];
  for (const e of side.querySelectorAll('*')) {
    if (!vis(e) || e.closest('.vrm-nav-badge-point, .vrm-nav-tuile, .vrm-nav-indicateur')) continue;
    const s = getComputedStyle(e);
    const lesCouleurs = [];
    if (e.children.length === 0 || e instanceof SVGElement) lesCouleurs.push(s.color);
    if (e instanceof SVGElement) { lesCouleurs.push(s.stroke, s.fill); }
    lesCouleurs.push(s.backgroundColor);
    for (const c of lesCouleurs) { const x = rgba(c); if (!x || x.a < 0.05) continue; const t = teinte(x); if (t.chroma > 60 && t.s > 0.45) vives.push({ c: `${x.r},${x.g},${x.b}`, dansActif: !!(actif && actif.contains(e)), tag: e.tagName + '.' + String(e.className && e.className.baseVal != null ? e.className.baseVal : e.className).slice(0, 30) }); }
  }
  // N4 : contraste des libellés et titres visibles sur la matière de la colonne.
  const textes = [...side.querySelectorAll('.vrm-rail-lib, .vrm-rail-section-label')].filter(vis).map((e) => {
    let fond = fondCol;
    const b = e.closest('.vrm-rail-button'); if (b && b === actif) { const x = rgba(getComputedStyle(b).backgroundColor); if (x && x.a > 0.05) fond = sur(x, fondCol); const ind = side.querySelector('.vrm-nav-indicateur'); if (ind && +getComputedStyle(ind).opacity > 0.5) { const y = rgba(getComputedStyle(ind).backgroundColor); if (y) fond = sur(y, fondCol); } }
    const pied = e.closest('.vrm-rail-pied'); if (pied && (!b || b !== actif)) { const x = rgba(getComputedStyle(pied).backgroundColor); if (x && x.a > 0.01) fond = sur(x, fondCol); }
    return { t: e.textContent.trim(), ratio: Math.round(contraste(sur(rgba(getComputedStyle(e).color), fond), fond) * 100) / 100 };
  });
  const ind = [...side.querySelectorAll('[data-nav-indicateur]')];
  const ir = ind[0] ? ind[0].getBoundingClientRect() : null, ar = actif ? actif.getBoundingClientRect() : null;
  const main = document.querySelector('.vrm-main'), mr = main ? main.getBoundingClientRect() : null;
  const libs = [...side.querySelectorAll('.vrm-rail-lib')];
  const titres = [...side.querySelectorAll('[data-nav-groupe] > .vrm-rail-section-label')].filter(vis);
  return {
    rayon: parseFloat(cs.borderTopLeftRadius), ombre: cs.boxShadow, bordD: parseFloat(cs.borderRightWidth),
    gauche: Math.round(sr.left), haut: Math.round(sr.top), basAir: Math.round(innerHeight - sr.bottom), largeur: Math.round(sr.width), droite: Math.round(sr.right),
    mainGauche: mr ? Math.round(mr.left) : null,
    hauteurs: boutons.map((b) => Math.round(b.getBoundingClientRect().height)),
    vives, textes,
    nInd: ind.length, indOpacite: ind[0] ? +getComputedStyle(ind[0]).opacity : 0,
    indSurActif: !!(ir && ar && Math.abs(ir.top - ar.top) < 1.5 && Math.abs(ir.height - ar.height) < 1.5),
    actif: actif ? actif.getAttribute('data-nav-entree') : null,
    libsVisibles: libs.filter(vis).length, nLibs: libs.length,
    nomsSansLib: boutons.every((b) => (b.getAttribute('title') || b.getAttribute('aria-label') || '').trim().length > 0),
    titresEntiers: titres.every((e) => { const q = e.getBoundingClientRect(); return e.scrollWidth <= e.clientWidth + 1 && q.left >= sr.left - 1 && q.right <= sr.right + 1; }),
    titresVus: titres.map((e) => e.parentElement.getAttribute('data-nav-groupe')),
    groupes: [...side.querySelectorAll('[data-nav-groupe]')].map((g) => g.getAttribute('data-nav-groupe')),
    mot: (side.querySelector('.vrm-sidebar-mot') || {}).textContent || '',
  };
});

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const sombre of [false, true]) {
      const T = `[1512 ${sombre ? 'sombre' : 'clair'}]`;
      console.log(`── ${T}`);
      await essaie(T, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { W: 1512, sombre });
        const c = await lireColonne(pg);
        await capture(pg, `nav-1512-${sombre ? 'sombre' : 'clair'}`);
        dit(!!c, `${T} la colonne est rendue`);
        dit(c.rayon >= 16, `${T} N1 rayon de la colonne ≥ 16`, c.rayon);
        dit(c.gauche >= 8 && c.haut >= 8 && c.basAir >= 8, `${T} N1 elle flotte : ≥ 8 px d'air à gauche, en haut, en bas`, JSON.stringify({ g: c.gauche, h: c.haut, b: c.basAir }));
        dit(c.bordD < 0.5 && /rgba?\(/.test(c.ombre) && c.ombre !== 'none', `${T} N1 une ombre, aucune bordure droite dure`, JSON.stringify({ bord: c.bordD, ombre: c.ombre }));
        dit(c.mainGauche != null && c.mainGauche >= c.droite + 8, `${T} N1 le contenu ne passe pas sous la colonne`, JSON.stringify({ main: c.mainGauche, col: c.droite }));
        dit(c.hauteurs.length > 8 && c.hauteurs.every((h) => h >= 36), `${T} N2 chaque entrée ≥ 36 px à la souris`, c.hauteurs.join(','));
        const hors = c.vives.filter((v) => !v.dansActif); const teintes = new Set(c.vives.map((v) => v.c));
        dit(hors.length === 0 && teintes.size <= 1 && c.vives.length >= 1, `${T} N3 une seule couleur d'accent, sur l'entrée choisie seulement`, JSON.stringify(c.vives.slice(0, 6)));
        const faibles = c.textes.filter((t) => t.ratio < 4.5);
        dit(c.textes.length > 8 && faibles.length === 0, `${T} N4 libellés et titres de groupe ≥ 4,5:1`, JSON.stringify(faibles.slice(0, 5)));
        dit(c.nInd === 1 && c.indOpacite > 0.5 && c.indSurActif, `${T} N5 une seule pastille, posée sous l'entrée choisie`, JSON.stringify({ n: c.nInd, op: c.indOpacite, sur: c.indSurActif }));
        dit(['Vendre', 'Gérer', 'Argent', 'Moi'].every((g) => c.groupes.includes(g)) && ['Vendre', 'Gérer', 'Argent'].every((g) => c.titresVus.includes(g)) && c.mot === 'VRM' && c.actif === 'journee', `${T} N7 mêmes groupes, « VRM », Ma journée allumée`, JSON.stringify({ g: c.groupes, t: c.titresVus, mot: c.mot, actif: c.actif }));
        // N5 : le glissement. On lit la pastille à mi-course après un clic sur « Ventes ».
        const avant = await pg.evaluate(() => { const i = document.querySelector('[data-nav-indicateur]'); return i ? i.getBoundingClientRect().top : null; });
        const cible = await pg.evaluate(() => { const b = document.querySelector('.vrm-sidebar [data-nav-entree="cat_bord"]'); return b ? b.getBoundingClientRect().top : null; });
        // Le clic part DANS la page, puis la position de la pastille est relevée à chaque image
        // pendant 700 ms : un glissement laisse au moins une position strictement entre les deux.
        const pendant = await pg.evaluate(() => new Promise((ok) => {
          const i = document.querySelector('[data-nav-indicateur]'); const tops = []; let tr = ''; const lances = [];
          // Le compositeur fait glisser la pastille même quand le fil principal monte l'écran
          // demandé (Colis) : la transition LANCÉE sur `transform` (évènement du navigateur) le prouve.
          if (i) i.addEventListener('transitionrun', (e) => lances.push(e.propertyName));
          document.querySelector('.vrm-sidebar [data-nav-entree="cat_bord"]').click();
          const t0 = performance.now();
          const pas = () => { const x = document.querySelector('[data-nav-indicateur]') || i; if (!x) return ok({ tops, tr: 'aucune pastille', lances }); tops.push(Math.round(x.getBoundingClientRect().top)); tr = getComputedStyle(x).transitionProperty + ' ' + getComputedStyle(x).transitionDuration; if (performance.now() - t0 < 700) requestAnimationFrame(pas); else ok({ tops, tr, lances }); };
          requestAnimationFrame(pas);
        }));
        await pg.waitForTimeout(600);
        const apres = await pg.evaluate(() => { const i = document.querySelector('[data-nav-indicateur]'); const a = document.querySelector('.vrm-sidebar [aria-current="page"]'); return i && a ? { top: i.getBoundingClientRect().top, actifTop: a.getBoundingClientRect().top, actif: a.getAttribute('data-nav-entree') } : null; });
        const entre = pendant && avant != null && cible != null && (pendant.tops.some((t) => t > Math.min(avant, cible) + 2 && t < Math.max(avant, cible) - 2) || pendant.lances.includes('transform'));
        dit(!!entre, `${T} N5 la pastille GLISSE de Ma journée à Colis (position intermédiaire vue, ou transition de transform lancée)`, JSON.stringify({ avant, tops: pendant && pendant.tops.slice(0, 40), lances: pendant && pendant.lances, cible }));
        dit(!!(pendant && /transform/.test(pendant.tr) && /0\.2|0\.24|0\.25|200ms|240ms/.test(pendant.tr)), `${T} N5 transition de transform de 200–250 ms`, pendant && pendant.tr);
        dit(!!(apres && apres.actif === 'cat_bord' && Math.abs(apres.top - apres.actifTop) < 1.5), `${T} N5 à l'arrivée, elle est sous Colis`, JSON.stringify(apres));
        await capture(pg, `nav-1512-${sombre ? 'sombre' : 'clair'}-colis`);
        // N8 : les boutons (un primaire et un secondaire posés dans la page, mêmes classes que <Bouton>).
        const b = await pg.evaluate(() => {
          const m = document.querySelector('.vrm-main'); const f = document.createElement('div'); f.setAttribute('data-banc-boutons', '');
          f.innerHTML = '<button type="button" class="vrm-b vrm-b-primaire">Imprimer</button> <button type="button" class="vrm-b vrm-b-secondaire">Plus tard</button>';
          m.prepend(f);
          const lire = (e) => { const s = getComputedStyle(e); return { img: s.backgroundImage, ombre: s.boxShadow, poids: +s.fontWeight, rayon: parseFloat(s.borderTopLeftRadius), h: Math.round(e.getBoundingClientRect().height), bord: parseFloat(s.borderTopWidth), disp: s.display }; };
          const r = { p: lire(f.children[0]), s: lire(f.children[1]) }; f.remove(); return r;
        });
        dit(/gradient/.test(b.p.img) && /inset/.test(b.p.ombre), `${T} N8 primaire : reflet (dégradé) + ombre intérieure fine`, JSON.stringify(b.p));
        dit(b.p.poids >= 600 && b.s.poids >= 600, `${T} N8 texte 600`, `${b.p.poids}/${b.s.poids}`);
        dit(b.s.bord === 0 && !/inset 0 0 0 1px/.test(b.s.ombre), `${T} N8 secondaire sans bordure`, JSON.stringify(b.s));
        // (9 nov., DA 6 — consigne de Julien relayée : « primaire = pilule pleine, secondaire = pilule grise ») :
        // la pilule (rayon ≥ la moitié de la hauteur) rejoint l'échelle fermée.
        const okR = (r, h) => [6, 12, 14, 20, 24].includes(r) || r >= h / 2;
        dit(okR(b.p.rayon, b.p.h) && okR(b.s.rayon, b.s.h), `${T} N8 rayon de l'échelle fermée (6·12·14·20·24) ou pilule`, `${b.p.rayon}/${b.s.rayon}`);
        dit(b.p.h >= 36 && b.s.h >= 36, `${T} N8 ≥ 36 px à la souris`, `${b.p.h}/${b.s.h}`);
        dit(erreurs.length === 0, `${T} aucune erreur de page`, erreurs.join(' | '));
        await ctx.close();
      });
    }
    // N5 sous « réduire les animations » : la pastille saute.
    await essaie('[1512 réduit]', async () => {
      console.log('── [1512 animations réduites]');
      const { ctx, pg } = await ouvrir(nav, { W: 1512, reduit: true });
      const tr = await pg.evaluate(() => { const i = document.querySelector('[data-nav-indicateur]'); if (!i) return null; const s = getComputedStyle(i); return { p: s.transitionProperty, d: s.transitionDuration }; });
      dit(!!tr && !/transform/.test(tr.p), '[1512 réduit] N5 aucune transition de transform (elle saute)', JSON.stringify(tr));
      await ctx.close();
    });
    // N2 au doigt : 44 px.
    await essaie('[1512 doigt]', async () => {
      console.log('── [1512 au doigt]');
      const { ctx, pg } = await ouvrir(nav, { W: 1512, toucher: true });
      const coarse = await pg.evaluate(() => matchMedia('(pointer: coarse)').matches);
      const c = await lireColonne(pg);
      if (coarse) dit(c.hauteurs.every((h) => h >= 44), '[1512 doigt] N2 chaque entrée ≥ 44 px au doigt', c.hauteurs.join(','));
      else console.log('  ·  (ce Chromium ne se dit pas « pointer: coarse » : contrôle 44 px non joué)');
      await ctx.close();
    });
    for (const sombre of [false, true]) {
      const T = `[1100 ${sombre ? 'sombre' : 'clair'}]`;
      console.log(`── ${T}`);
      await essaie(T, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { W: 1100, sombre });
        const c = await lireColonne(pg);
        await capture(pg, `nav-1100-${sombre ? 'sombre' : 'clair'}`);
        dit(c.largeur <= 72 && c.largeur >= 56, `${T} N6 rail d'icônes (56–72 px)`, c.largeur);
        dit(c.libsVisibles === 0 && c.nLibs > 8 && c.nomsSansLib, `${T} N6 libellés cachés, chaque entrée garde son nom (info-bulle)`, JSON.stringify({ vis: c.libsVisibles, n: c.nLibs, noms: c.nomsSansLib }));
        dit(c.titresEntiers && ['Vendre', 'Gérer', 'Argent'].every((g) => c.titresVus.includes(g)), `${T} N6 titres de groupe visibles et entiers`, JSON.stringify(c.titresVus));
        dit(c.mainGauche >= c.droite + 8 && c.gauche >= 8, `${T} N1/N6 le rail flotte et le contenu ne passe pas dessous`, JSON.stringify({ main: c.mainGauche, col: c.droite, g: c.gauche }));
        dit(c.hauteurs.every((h) => h >= 36), `${T} N2 chaque icône ≥ 36 px`, c.hauteurs.join(','));
        dit(c.nInd === 1 && c.indSurActif, `${T} N5 la pastille sous l'icône choisie`, JSON.stringify({ n: c.nInd, sur: c.indSurActif }));
        dit(erreurs.length === 0, `${T} aucune erreur de page`, erreurs.join(' | '));
        await ctx.close();
      });
    }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ok} vérifications OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
