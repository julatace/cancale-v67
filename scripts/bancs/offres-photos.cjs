// ═══════════════════════════════════════════════════════════
//  BANC — OFFRES SANS RÉPONSE ET PHOTO EN DOUBLE, À 390 ET À 1512 (22 nov., choix n° 33 et 35)
//
//  Construit outils/offres-photos/ (esbuild, hors paquet de prod) : les VRAIS écrans natifs nourris par les VRAIES règles
//  (offresVinted, offresVestiaire, offresSansReponse, photoEnDouble + la `photoKey` d'App.jsx) sur une base INVENTÉE :
//  50 annonces au même titre (photos différentes), deux paires au même FICHIER (N°142/N°157, N°160/N°161) ; quatre
//  conversations (une offre en attente, une de la veille, une à laquelle il a répondu, une acceptée) et une offre Vestiaire.
//  Mesures (data-* et nombres, jamais un libellé) — 390 × 844 tactile et 1512 × 900, clair et sombre :
//   J. Aujourd'hui : « N offres sans réponse › » (N = 3) et « N photos sur plusieurs annonces › » (N = 2), 44 px, un toucher
//      mène à l'écran ;
//   O. Offres : 3 rangées (Vinted ×2, Vestiaire), de la plus ancienne à la plus récente, l'offre sous le mini en ambre,
//      jamais celle à laquelle il a répondu ni l'acceptée ; un toucher ouvre le panneau (Vinted : la conversation) ;
//   A. Annonces · « Photo en double » : 2 groupes (jamais les 50 au même titre), N°142 et N°157 ; « Ce n'est pas un
//      doublon » retire le groupe ; le segment existe et porte le nombre ; aucun bouton plein ;
//   E. aucune erreur de page ; pas de débordement horizontal à 390.
//  SHOTS : le dossier des captures. Sur l'arbre d'avant (git archive) : ROUGE (les modules n'existent pas).
// ═══════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = process.env.BANC_RACINE ? path.resolve(process.env.BANC_RACINE) : path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules'), path.join(__dirname, '..', '..', 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const PORT = Number(process.env.BANC_PORT) || 4795;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-offres-photos');
const DOSSIER = path.join(os.tmpdir(), 'banc-offres-photos-build-' + process.pid);
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(DOSSIER, { recursive: true });
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/); if (!m) throw new Error('ICON_PATHS introuvable');
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx'); fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  const d = app.indexOf('const photoKey = (url) => {'); if (d < 0) throw new Error('photoKey introuvable');
  const genPk = path.join(DOSSIER, 'photokey.gen.js'); fs.writeFileSync(genPk, 'export ' + app.slice(d, app.indexOf('\n};\n', d) + 3) + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'offres-photos', 'ecran.jsx')], bundle: true, outfile: path.join(DOSSIER, 'ecran.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    external: ['/brands/*'], alias: { 'vrm-icones-app': gen, 'vrm-photokey-app': genPk }, nodePaths: [NM], logLevel: 'error' });
  fs.copyFileSync(path.join(RACINE, 'outils', 'offres-photos', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const servir = () => new Promise((res) => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]);
  if (/^\/brands\/[a-z]+\.svg$/.test(u) && fs.existsSync(path.join(RACINE, 'public', u))) { r.writeHead(200, { 'content-type': 'image/svg+xml' }); return r.end(fs.readFileSync(path.join(RACINE, 'public', u))); }
  const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); }); s.listen(PORT, () => res(s)); });

(async () => {
  try { construire(); } catch (e) { console.log('❌ construction du banc impossible : ' + String(e.message).slice(0, 400)); process.exit(1); }
  const srv = await servir();
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  for (const W of [390, 1512]) for (const sombre of [false, true]) {
    const tel = W < 600, T = `${W}${sombre ? ' sombre' : ''}`;
    const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1512, height: 900 } }), deviceScaleFactor: tel ? 3 : 1, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    const ouvrir = async (vue) => {
      const pg = await ctx.newPage(); const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
      await pg.goto(`http://localhost:${PORT}/?vue=${vue}${sombre ? '&theme=dark' : ''}`, { waitUntil: 'load' }); await pg.waitForTimeout(900);
      return { pg, erreurs };
    };
    const largeur = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const touche = (pg) => (tel ? pg.tap.bind(pg) : pg.click.bind(pg));
    console.log(`── ${T}`);
    // J — Aujourd'hui
    { const { pg, erreurs } = await ouvrir('journee');
      const osr = await pg.$('[data-osr-journee]'), ph = await pg.$('[data-photo-double-journee]');
      dit(osr && (await osr.getAttribute('data-osr-journee')) === '3', `${T} J Aujourd’hui : « 3 offres sans réponse › »`, osr ? await osr.getAttribute('data-osr-journee') : 'absente');
      dit(ph && (await ph.getAttribute('data-photo-double-journee')) === '2', `${T} J Aujourd’hui : « 2 photos sur plusieurs annonces › »`, ph ? await ph.getAttribute('data-photo-double-journee') : 'absente');
      const h = await pg.evaluate(() => [...document.querySelectorAll('[data-osr-journee],[data-photo-double-journee]')].map((e) => Math.round(e.getBoundingClientRect().height)));
      dit(h.length === 2 && h.every((x) => x >= 44), `${T} J les deux rangées font 44 px au moins`, h);
      if (osr) { await osr.scrollIntoViewIfNeeded(); await pg.screenshot({ path: path.join(SHOTS, `journee-${W}${sombre ? '-sombre' : ''}.png`) }); await touche(pg)('[data-osr-journee]'); }
      dit((await pg.evaluate(() => document.documentElement.getAttribute('data-banc-vers'))) === 'offres', `${T} J un toucher mène aux offres`);
      if (tel) dit((await largeur(pg)) <= 0, `${T} E aucun débordement horizontal`, await largeur(pg));
      dit(!erreurs.length, `${T} E aucune erreur de page (Aujourd’hui)`, erreurs);
      await pg.close(); }
    // O — Offres
    { const { pg, erreurs } = await ouvrir('offres');
      const L = await pg.evaluate(() => [...document.querySelectorAll('[data-osr-ligne]')].map((e) => ({ cle: e.getAttribute('data-osr-ligne'), site: e.getAttribute('data-osr-site'), face: e.getAttribute('data-osr-face'), ts: Number(e.getAttribute('data-osr-ts')), h: Math.round(e.getBoundingClientRect().height) })));
      dit(L.length === 3 && L.filter((l) => l.site === 'vinted').length === 2 && L.some((l) => l.site === 'vestiaire'), `${T} O 3 offres (Vinted ×2, Vestiaire) — jamais celle à laquelle il a répondu ni l’acceptée`, L.map((l) => l.cle));
      dit(L.length && L.every((l, i) => i === 0 || l.ts >= L[i - 1].ts), `${T} O de la plus ancienne à la plus récente`, L.map((l) => l.ts));
      dit(L.filter((l) => l.face === 'sous').length === 2 && L.filter((l) => l.face === 'ok').length === 1, `${T} O deux offres sous le prix mini (étiquette ambre « Sous ton plancher »), une au-dessus (rien)`, L.map((l) => l.face));
      dit(L.every((l) => l.h >= 44), `${T} O rangées de 44 px au moins`, L.map((l) => l.h));
      await pg.screenshot({ path: path.join(SHOTS, `offres-${W}${sombre ? '-sombre' : ''}.png`), fullPage: true });
      const premiere = L.find((l) => l.site === 'vinted');
      if (premiere) await touche(pg)(`[data-osr-ligne="${premiere.cle}"]`);
      const vers = await pg.evaluate(() => document.documentElement.getAttribute('data-banc-panneau'));
      dit(/^vinted:\d+$/.test(String(vers)), `${T} O un toucher ouvre le panneau sur LA conversation`, vers);
      dit(!(await pg.$('.n-bouton[data-n-variante="plein"]')), `${T} O aucun bouton plein`);
      if (tel) dit((await largeur(pg)) <= 0, `${T} E aucun débordement horizontal (Offres)`, await largeur(pg));
      dit(!erreurs.length, `${T} E aucune erreur de page (Offres)`, erreurs);
      await pg.close(); }
    // A — Annonces · Photo en double
    { const { pg, erreurs } = await ouvrir('annonces');
      const G = await pg.evaluate(() => [...document.querySelectorAll('[data-photo-double-groupe]')].map((g) => ({ cle: g.getAttribute('data-photo-double-groupe'), n: g.querySelectorAll('[data-photo-double-annonce]').length, texte: g.textContent })));
      dit(G.length === 2 && G.every((g) => g.n === 2), `${T} A 2 groupes de 2 annonces (le même FICHIER) — jamais les 50 au même titre`, G.map((g) => g.cle));
      dit(G.length && /142/.test(G[0].texte) && /157/.test(G[0].texte), `${T} A « N°142 et N°157 » nommés`, G[0] && G[0].texte.slice(0, 120));
      const seg = await pg.$('[data-eg-segment="photodouble"]');
      dit(!!seg && (await seg.getAttribute('data-eg-segment-n')) === '2', `${T} A le segment « Photo en double » porte 2`, seg ? await seg.getAttribute('data-eg-segment-n') : 'absent');
      dit(!(await pg.$('.n-bouton[data-n-variante="plein"]')), `${T} A aucun bouton plein`);
      await pg.screenshot({ path: path.join(SHOTS, `annonces-photo-double-${W}${sombre ? '-sombre' : ''}.png`), fullPage: true });
      if (G.length) await touche(pg)(`[data-photo-double-non="${G[0].cle}"]`);
      await pg.waitForTimeout(200);
      const n2 = await pg.evaluate(() => document.querySelectorAll('[data-photo-double-groupe]').length);
      dit(n2 === 1, `${T} A « Ce n’est pas un doublon » retire ce groupe`, n2);
      if (tel) dit((await largeur(pg)) <= 0, `${T} E aucun débordement horizontal (Annonces)`, await largeur(pg));
      dit(!erreurs.length, `${T} E aucune erreur de page (Annonces)`, erreurs);
      await pg.close(); }
    await ctx.close();
  }
  await nav.close(); srv.close();
  try { fs.rmSync(DOSSIER, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${ko ? '❌' : '✅'} banc offres-photos : ${ok} vert(s), ${ko} rouge(s) — captures dans ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
