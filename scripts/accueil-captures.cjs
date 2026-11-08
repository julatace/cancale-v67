// ════════════════════════════════════════════════════════════════════════════
//  LES CAPTURES DE LA PAGE D'ACCUEIL (8 nov.) — la VRAIE app, en MODE EXEMPLE.
//
//  Les images de vrm.center sont des captures de l'app construite (`dist/`),
//  ouverte en mode exemple (src/modeExemple.js : données INVENTÉES,
//  src/exempleDonnees.js) — jamais une donnée d'un vendeur (§2.3, dépôt public).
//  Le mode exemple répond lui-même à la base et à `/api` ; ce script coupe en
//  plus TOUT le réseau hors de localhost : aucune requête ne sort.
//
//  Sortie : public/accueil/{nom}-{clair|sombre}.webp + captures.json (empreintes) (WebP, qualité 72), au
//  double de la taille affichée (écran Retina), métadonnées retirées.
//    npm run build && node scripts/accueil-captures.cjs
//    SEUL=journee,colis  THEMES=clair  SORTIE=/tmp/x  (pour essayer)
//  ⚠️ Linux n'a pas SF Pro : la police de l'app est remplacée par Inter (la plus
//     proche) le temps de la capture — sur iPhone, l'app s'affiche en SF Pro.
//  ⚠️ Le bandeau « Exemple — rien n'est à toi » est retiré DE LA CAPTURE : la
//     page d'accueil écrit « Données d'exemple » sous chaque image.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'));

const RACINE = path.join(__dirname, '..');
const DIST = path.join(RACINE, 'dist');
const SORTIE = process.env.SORTIE || path.join(RACINE, 'public', 'accueil');
const PORT = Number(process.env.PORT) || 10931;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const THEMES = liste('THEMES', 'clair,sombre');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

// Les écrans montrés par la page. `w` × `h` : la taille AFFICHÉE (CSS px).
const ECRANS = [
  { nom: 'journee', tab: 'journee', w: 390, h: 844 },
  { nom: 'retirer', tab: 'cat_bord', w: 390, h: 844, gestes: [/^\s*À retirer/, /^\s*Code\s*$/], defile: 560 },
  { nom: 'numeros', tab: process.env.TAB_NUMEROS || 'annonces', w: 390, h: 844, defile: 620 },
  { nom: 'compta', tab: 'compta', w: 390, h: 844, gestes: [/Micro-entrepreneur/, /^\s*Par mois\s*$/] },
  { nom: 'bureau', tab: 'journee', w: 1440, h: 900 },
];
const SEUL = liste('SEUL', ECRANS.map((e) => e.nom).join(','));

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

const CSS_CAPTURE = `
  *{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif!important}
  [data-mode-exemple-bandeau],[data-exemple-bandeau],.vrm-exemple-bandeau{display:none!important}
  *{caret-color:transparent!important}
`;

async function capturer(nav, e, theme) {
  const sombre = theme === 'sombre', tel = e.w < 600;
  const ctx = await nav.newContext({ viewport: { width: e.w, height: e.h }, isMobile: tel, hasTouch: tel, deviceScaleFactor: 2, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris', reducedMotion: 'reduce', serviceWorkers: 'block' });
  const sorties = [];
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => { sorties.push(r.request().url().slice(0, 80)); return r.abort(); });
  await ctx.addInitScript((sombre) => {
    try { sessionStorage.setItem('vrm_mode_exemple', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); } catch (_) {}
  }, sombre);
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (x) => erreurs.push(String(x.message || x).slice(0, 200)));
  await pg.goto(`http://localhost:${PORT}/?tab=${e.tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  await pg.addStyleTag({ content: CSS_CAPTURE });
  await pg.waitForTimeout(3500);
  // Les gestes RÉELS qui amènent l'écran montré (un bouton, par son texte).
  for (const g of e.gestes || []) {
    const b = pg.locator('button, [role="tab"], [role="button"], a').filter({ hasText: g }).first();
    if (await b.count()) { await b.click().catch(() => {}); await pg.waitForTimeout(1500); }
    else console.log(`  (geste ${g} introuvable sur ${e.nom})`);
  }
  if (e.defile) { await pg.evaluate((y) => { const m = document.querySelector('.vrm-main'); window.scrollTo(0, y); if (m) m.scrollTop = y; }, e.defile); await pg.waitForTimeout(800); }
  const exemple = await pg.evaluate(() => { try { return sessionStorage.getItem('vrm_mode_exemple') === '1'; } catch (_) { return false; } });
  const png = path.join(os.tmpdir(), `vrm-acc-${process.pid}-${e.nom}-${theme}.png`);
  await pg.screenshot({ path: png });
  await ctx.close();
  if (!exemple) throw new Error(`${e.nom} ${theme} : le mode exemple n'est pas actif — capture refusée`);
  fs.mkdirSync(SORTIE, { recursive: true });
  const webp = path.join(SORTIE, `${e.nom}-${theme}.webp`);
  // Qualité 72, métadonnées retirées. Le bureau est réduit à 1 200 px de large (affiché ≤ 760 px).
  const args = [png, ...(e.w > 600 ? ['-resize', '1600x'] : []), '-strip', '-quality', '72', '-define', 'webp:method=6', webp];
  execFileSync('convert', args);
  fs.unlinkSync(png);
  // Le registre : chaque fichier servi par la page porte l'empreinte de ce que CE
  // script a produit en mode exemple. Le banc (scripts/bancs/accueil.cjs) refuse
  // une image de la page qui n'y est pas (une capture posée à la main, peut-être
  // d'une vraie base, ne passerait pas).
  const reg = path.join(SORTIE, 'captures.json');
  let r = {}; try { r = JSON.parse(fs.readFileSync(reg, 'utf8')); } catch (_) { r = {}; }
  r[`${e.nom}-${theme}.webp`] = { sha256: crypto.createHash('sha256').update(fs.readFileSync(webp)).digest('hex'), ecran: e.tab, largeur: e.w, modeExemple: true };
  fs.writeFileSync(reg, JSON.stringify(Object.fromEntries(Object.entries(r).sort()), null, 1) + '\n');
  console.log(`${e.nom}-${theme}.webp`, Math.round(fs.statSync(webp).size / 1024) + ' Ko', erreurs.length ? 'erreurs : ' + erreurs.join(' | ') : '', sorties.length ? `(${sorties.length} requête(s) externe(s) coupée(s))` : '');
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('dist/ absent — npm run build'); process.exit(1); }
  await new Promise((res) => srv.listen(PORT, res));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const e of ECRANS.filter((x) => SEUL.includes(x.nom))) for (const t of THEMES) await capturer(nav, e, t);
  } finally { await nav.close(); srv.close(); }
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
