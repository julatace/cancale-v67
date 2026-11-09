require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « WIDGETS À LA iOS » (9 nov., direction artistique 6)
//
//  Julien : « J'aime pas trop l'affichage, il n'y a pas un grand changement » ;
//  « les boutons font moins qualitatif ». Ce banc juge des VALEURS RENDUES
//  (jamais un libellé, §6.4) sur le mode exemple (données inventées,
//  src/exempleDonnees.js : aucune donnée réelle, le dépôt est public), à 390 px
//  tactile et 1512 px, clair et sombre, sur Ma journée, Ventes et Colis :
//   W1  le sol : gris système (#F2F2F7 le jour, #000 la nuit) ;
//   W2  le titre d'écran : ≥ 34 px, graisse ≥ 800 ;
//   W3  les cases de la carte sombre sont des WIDGETS posés SOUS elle : leur haut
//       est sous le bas du fond sombre, leur fond est celui d'une carte (blanc le
//       jour, #1C1C1E la nuit), distinct du sol, rayon ≥ 22, aucune bordure ;
//   W4  le chiffre d'un widget : ≥ 28 px, graisse ≥ 800, tabulaire ; le libellé
//       au-dessus du chiffre, 13 px, graisse ≥ 600 ;
//   W5  bento : un nombre impair de cases ⇒ la première est large (≥ 1,8 × une
//       autre) — sauf Ma journée au téléphone : trois widgets sur une ligne (règle
//       du 27 oct., premier geste au-dessus de la barre) ; chaque widget ≥ 44 px ;
//   W6  les groupes de rangées (Ventes, Ma journée) : rayon ≥ 22, fond de carte,
//       aucune bordure ;
//   W7  chevrons : « Voir » n'est plus un petit bouton gris dans les rangées de
//       Ma journée (fond transparent, le mot gardé pour les lecteurs d'écran, un
//       chevron dessiné) ; une rangée de Ventes porte un chevron calé à DROITE ;
//   W8  boutons : primaire = pilule bleue pleine ≥ 44 au doigt ; secondaire =
//       pilule grise remplie, sans bordure ; bouton d'icône = rond (largeur = hauteur) ;
//   W9  contrôle segmenté : rail rempli, segment choisi à fond de carte (ou
//       #636366 la nuit) avec une ombre ;
//   W10 couleurs : aucune teinte violette ni rouge rendue (§7 : le rouge est
//       réservé à deux paires sous un N° — le mode exemple n'en a pas), et une
//       seule teinte d'accent (bleu) hors ambre (geste) et marques.
//  Rouge sur origin/main (29f4f240) : W2, W3, W4, W5, W6, W7, W8.
//  `SHOTS=dossier` range les captures (à REGARDER, §6.2). `BANC_DIST`, `BANC_PORT`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || process.argv[2] || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10966;
const SHOTS = process.env.SHOTS || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000cc';
const SESSION = { access_token: 'jeton-banc-da6', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeur.banc@exemple.test', totp: [] } };
const iso = (j) => new Date(Date.now() - j * 86400000).toISOString();

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? '  ✅ ' : '  ❌ '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, e.message || e); } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, { W, sombre }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ viewport: { width: W, height: tel ? 1400 : 1100 }, hasTouch: tel, isMobile: tel, deviceScaleFactor: SHOTS ? 2 : 1, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
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
  await pg.waitForTimeout(1500);
  return { ctx, pg, erreurs };
}
async function aller(pg, ecran) {
  await pg.evaluate((e) => { const b = document.querySelector(`.vrm-sidebar [data-nav-entree="${e}"], .vrm-tab[data-nav-entree="${e}"]`); if (b) b.click(); }, ecran);
  await pg.waitForFunction((e) => { const m = document.querySelector(`.vrm-main[data-ecran="${e}"]`); return !!(m && m.querySelector('.vrm-fu-cases > .vrm-fu-case')); }, ecran, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => window.scrollTo(0, 0));
}
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); };

// Tout ce qu'on lit d'un écran, en une passe, DANS la page.
const lire = (pg) => pg.evaluate(() => {
  const rgba = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const hex = (c) => c ? '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase() : null;
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const teinte = (c) => { const r = c.r / 255, g = c.g / 255, b = c.b / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return { h, s: mx ? d / mx : 0, chroma: d * 255 }; };
  const main = [...document.querySelectorAll('.vrm-main')].filter(vis)[0];
  if (!main) return null;
  const out = { ecran: main.getAttribute('data-ecran') };
  out.sol = hex(rgba(getComputedStyle(main).backgroundColor));
  out.solBody = hex(rgba(getComputedStyle(document.body).backgroundColor));
  const titre = [...main.querySelectorAll('.vrm-screen-head .vrm-display, .vrm-tache-tete h1, .vrm-market-heading h1, .vrm-fu-titre-tete')].filter(vis)[0];
  out.titre = titre ? { t: parseFloat(getComputedStyle(titre).fontSize), g: +getComputedStyle(titre).fontWeight } : null;
  // La carte sombre et ses cases.
  const carte = [...main.querySelectorAll('.vrm-fu-carte, .vrm-fu-tete')].filter(vis).find((c) => c.querySelector('.vrm-fu-cases > .vrm-fu-case'));
  if (carte) {
    const cr = carte.getBoundingClientRect();
    const av = getComputedStyle(carte, '::before');
    const fondCarte = rgba(getComputedStyle(carte).backgroundColor);
    // Bas du fond sombre : le `::before` peint (s'il existe), sinon la carte entière.
    const avPeint = av.content !== 'none' && av.display !== 'none' && /gradient|rgb/.test(av.backgroundImage + av.backgroundColor) && parseFloat(av.height) > 40;
    const basSombre = avPeint ? cr.top + parseFloat(av.height) + (parseFloat(av.top) || 0) + (parseFloat(getComputedStyle(carte).paddingTop) || 0) : cr.bottom;
    const cases = [...carte.querySelectorAll('.vrm-fu-cases > .vrm-fu-case')].filter(vis);
    out.carte = { fondCarte: fondCarte && fondCarte.a > 0.05 ? hex(fondCarte) : null, avPeint, basSombre: Math.round(basSombre), bas: Math.round(cr.bottom) };
    out.cases = cases.map((c) => {
      const r = c.getBoundingClientRect(), s = getComputedStyle(c);
      const b = c.querySelector(':scope > b'), l = c.querySelector(':scope > span');
      const bs = b ? getComputedStyle(b) : null, ls = l ? getComputedStyle(l) : null;
      return { haut: Math.round(r.top), larg: Math.round(r.width), h: Math.round(r.height), fond: hex(rgba(s.backgroundColor)), alpha: (rgba(s.backgroundColor) || {}).a, rayon: parseFloat(s.borderTopLeftRadius), bord: parseFloat(s.borderTopWidth),
        chiffre: bs ? { t: parseFloat(bs.fontSize), g: +bs.fontWeight, tab: /tabular/.test(bs.fontVariantNumeric), vide: b.classList.contains('is-vide') } : null,
        libDessus: !!(b && l && l.getBoundingClientRect().bottom <= b.getBoundingClientRect().top + 2), lib: ls ? { t: parseFloat(ls.fontSize), g: +ls.fontWeight } : null };
    });
  }
  // Les groupes de rangées.
  out.groupes = [...main.querySelectorAll('.vrm-toutes-liste, .vrm-day-task-list')].filter(vis).map((g) => { const s = getComputedStyle(g); return { c: g.className.split(' ')[0], rayon: parseFloat(s.borderTopLeftRadius), fond: hex(rgba(s.backgroundColor)), bord: parseFloat(s.borderTopWidth) + parseFloat(s.borderLeftWidth) }; });
  // Les « Voir » de Ma journée.
  out.voir = [...main.querySelectorAll('.vrm-day-task-list .vrm-day-task-action:not(.is-principal)')].filter(vis).map((a) => {
    const s = getComputedStyle(a), m = a.querySelector('.vrm-day-task-action-mot'), af = getComputedStyle(a, '::after');
    const mr = m ? m.getBoundingClientRect() : null;
    return { fond: (rgba(s.backgroundColor) || { a: 0 }).a, motCache: !!(m && mr.width <= 1.5 && mr.height <= 1.5), motLu: !!(m && m.textContent.trim()), chevron: af.content !== 'none' && /url|svg/.test(af.maskImage + af.webkitMaskImage) };
  });
  // Le chevron des rangées de Ventes.
  out.lignes = [...main.querySelectorAll('.vrm-toutes-ligne')].filter(vis).slice(0, 4).map((l) => { const af = getComputedStyle(l, '::after'); const lw = l.getBoundingClientRect().width; return { chevron: af.content !== 'none' && /url|svg/.test(af.maskImage + af.webkitMaskImage), droite: parseFloat(af.right), finX: parseFloat(af.left) + parseFloat(af.width), larg: Math.round(lw) }; });
  // Les boutons.
  const btn = (sel) => [...main.querySelectorAll(sel)].filter(vis).map((b) => { const s = getComputedStyle(b), r = b.getBoundingClientRect(); return { txt: (b.innerText || '').trim().length, h: Math.round(r.height), w: Math.round(r.width), rayon: parseFloat(s.borderTopLeftRadius), fond: rgba(s.backgroundColor), bord: parseFloat(s.borderTopWidth) }; });
  out.primaires = btn('.vrm-b.vrm-b-primaire');
  out.secondaires = btn('.vrm-b.vrm-b-secondaire:not(.vrm-b-icone):not(.vrm-colis-scanner)');
  out.icones = btn('.vrm-b.vrm-b-icone, .vrm-colis-scanner');
  // Le contrôle segmenté.
  out.segs = [...main.querySelectorAll('.vrm-seg, .vrm-sel-sites')].filter(vis).map((g) => {
    const on = g.querySelector(':scope > button[aria-pressed="true"], :scope > button[aria-current="page"]');
    const so = on ? getComputedStyle(on) : null;
    return { rail: (rgba(getComputedStyle(g).backgroundColor) || { a: 0 }).a, on: so ? hex(rgba(so.backgroundColor)) : null, ombre: so ? so.boxShadow : 'none' };
  });
  // Les couleurs vives rendues.
  const vives = [];
  for (const e of main.querySelectorAll('*')) {
    if (!vis(e) || e.closest('svg, img, picture, [class*="logo"], .vrm-num, .vrm-pile, .vrm-fu-courbe, [data-marque]')) continue;
    const s = getComputedStyle(e);
    for (const c of [s.color, s.backgroundColor]) { const x = rgba(c); if (!x || x.a < 0.3) continue; const t = teinte(x); if (t.chroma > 60 && t.s > 0.45) vives.push({ h: Math.round(t.h), c: hex(x), tag: e.tagName + '.' + String(e.className).slice(0, 30) }); }
  }
  out.vives = vives;
  return out;
});

const ECRANS = ['journee', 'ventes', 'cat_bord'];
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const W of [390, 1512]) for (const sombre of [false, true]) {
      const M = `${W} ${sombre ? 'sombre' : 'clair'}`;
      await essaie(`[${M}]`, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre });
        const CARTE = sombre ? '#1C1C1E' : '#FFFFFF', SOL = sombre ? '#000000' : '#F2F2F7';
        for (const e of ECRANS) {
          const T = `[${M} ${e}]`;
          console.log(`── ${T}`);
          await aller(pg, e);
          await capture(pg, `da6-${W}-${sombre ? 'sombre' : 'clair'}-${e}`);
          const m = await lire(pg);
          if (!m || m.ecran !== e) { dit(false, `${T} écran ouvert`, JSON.stringify(m && m.ecran)); continue; }
          dit(m.sol === SOL && m.solBody === SOL, `${T} W1 sol gris système ${SOL}`, `${m.sol}/${m.solBody}`);
          dit(!!(m.titre && m.titre.t >= 34 && m.titre.g >= 800), `${T} W2 titre d'écran ≥ 34/800`, JSON.stringify(m.titre));
          const C = m.cases || [];
          dit(C.length >= 2, `${T} les cases de la carte sont rendues`, C.length);
          if (C.length) {
            dit(C.every((c) => c.haut >= m.carte.basSombre + 4), `${T} W3 les widgets sont SOUS le fond sombre`, JSON.stringify({ basSombre: m.carte.basSombre, hauts: C.map((c) => c.haut), peint: m.carte.avPeint }));
            dit(C.every((c) => c.fond === CARTE && c.alpha > 0.95 && c.fond !== SOL), `${T} W3 fond de carte ${CARTE}, distinct du sol`, C.map((c) => c.fond + '/' + c.alpha).join(' '));
            dit(C.every((c) => c.rayon >= 22 && c.bord === 0), `${T} W3 rayon ≥ 22, sans bordure`, C.map((c) => c.rayon + '/' + c.bord).join(' '));
            dit(C.every((c) => c.chiffre && c.chiffre.t >= 28 && (c.chiffre.vide || c.chiffre.g >= 800) && c.chiffre.tab), `${T} W4 chiffre ≥ 28/800 tabulaire (le « — » d'un pas-su reste léger)`, JSON.stringify(C.map((c) => c.chiffre)));
            dit(C.every((c) => c.libDessus && c.lib && c.lib.t >= (e === 'journee' && W < 600 ? 12 : 13) && c.lib.g >= 600), `${T} W4 libellé 13/600 au-dessus du chiffre (12 dans les trois widgets étroits de Ma journée au téléphone)`, JSON.stringify(C.map((c) => [c.libDessus, c.lib])));
            // Ma journée au téléphone : trois widgets sur UNE ligne (règle du 27 oct. : le premier geste
            // de « Ensuite » au-dessus de la barre du bas, banc journee-premium) ; ailleurs, le bento.
            if (e === 'journee' && W < 600) dit(C.every((c) => Math.abs(c.haut - C[0].haut) <= 1), `${T} W5 trois widgets sur une ligne (le premier geste reste au-dessus de la barre)`, C.map((c) => c.haut).join(','));
            else if (C.length % 2 === 1 && C.length > 1) dit(C[0].larg >= 1.8 * C[1].larg, `${T} W5 bento : la première case est large`, C.map((c) => c.larg).join(','));
            dit(C.every((c) => c.h >= 44), `${T} W5 chaque widget ≥ 44 px`, C.map((c) => c.h).join(','));
          }
          if (m.groupes.length) dit(m.groupes.every((g) => g.rayon >= 22 && g.fond === CARTE && g.bord === 0), `${T} W6 groupes : rayon ≥ 22, fond ${CARTE}, sans bordure`, JSON.stringify(m.groupes));
          if (e === 'journee') dit(m.voir.length > 0 && m.voir.every((v) => v.fond < 0.05 && v.motCache && v.motLu && v.chevron), `${T} W7 « Voir » devient un chevron (mot gardé, lu)`, JSON.stringify(m.voir.slice(0, 3)));
          if (e === 'ventes') dit(m.lignes.length > 0 && m.lignes.every((l) => l.chevron && l.droite <= 24 && Math.abs(l.finX + l.droite - l.larg) <= 2), `${T} W7 chevron calé à droite sur chaque vente`, JSON.stringify(m.lignes));
          const pil = (b) => b.rayon >= b.h / 2 - 0.5;
          if (m.primaires.length) dit(m.primaires.every((b) => pil(b) && b.fond && b.fond.a > 0.9 && b.fond.b > 200 && b.fond.r < 40 && (W > 600 ? b.h >= 36 : b.h >= 44)), `${T} W8 primaire : pilule bleue pleine`, JSON.stringify(m.primaires));
          if (m.secondaires.length) dit(m.secondaires.every((b) => pil(b) && b.fond && b.fond.a > 0.05 && b.bord === 0), `${T} W8 secondaire : pilule grise remplie, sans bordure`, JSON.stringify(m.secondaires));
          if (m.icones.length) dit(m.icones.every((b) => pil(b) && (b.txt > 0 || Math.abs(b.w - b.h) <= 1)), `${T} W8 bouton d'icône rond (pilule s'il porte un mot)`, JSON.stringify(m.icones));
          if (m.segs.length) dit(m.segs.every((s) => s.rail > 0.05 && (s.on === CARTE || s.on === '#636366') && s.ombre !== 'none'), `${T} W9 contrôle segmenté plein`, JSON.stringify(m.segs));
          const interdites = m.vives.filter((v) => (v.h >= 255 && v.h <= 330) || v.h >= 345 || v.h <= 12);
          dit(!interdites.length, `${T} W10 ni violet ni rouge`, JSON.stringify(interdites.slice(0, 4)));
          const autres = m.vives.filter((v) => !(v.h >= 195 && v.h <= 225) && !(v.h >= 20 && v.h <= 50) && !(v.h >= 170 && v.h < 195));
          dit(!autres.length, `${T} W10 une seule teinte d'accent (bleu ; ambre = geste)`, JSON.stringify(autres.slice(0, 4)));
        }
        dit(erreurs.length === 0, `[${M}] aucune erreur de page`, erreurs.join(' | '));
        await ctx.close();
      });
    }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ok} vérifications OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
