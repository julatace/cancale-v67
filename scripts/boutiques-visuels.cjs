#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LES IMAGES DES FICHES DE BOUTIQUE (8 nov.) — Chrome Web Store, Edge, Firefox
//
//  Fabrique dans `docs/boutiques/visuels/` :
//   · capture-1…5 (1280 × 800, PNG) : l'app en MODE EXEMPLE (données inventées
//     par src/exempleDonnees.js, rien de réel, aucune requête vers la base — la
//     porte de src/modeExemple.js répond sur place) et la fenêtre de
//     l'extension (vraie popup.html + popup.js, un faux `chrome` qui répond
//     « connecté à vendeur@exemple.test ») ;
//   · tuile-440x280.png (petite tuile, Chrome et Edge), tuile-1400x560.png
//     (grande tuile, facultative), logo-300x300.png (logo Edge, 300 conseillé).
//  Style Apple de VRM (§7) : fond #F5F5F7, encre #1D1D1F, police système,
//  aucun violet, l'accent bleu seulement dans l'app elle-même.
//
//  Prérequis : `npm run build` (le dossier dist/). Chromium du banc :
//  /opt/pw-browsers/chromium (ou CHROMIUM=…). Toute requête vers un autre site
//  que localhost est COUPÉE et comptée : le script s'arrête en rouge si la
//  base de VRM (supabase.co) ou vrm.center est seulement approchée.
//    node scripts/boutiques-visuels.cjs
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const RACINE = path.join(__dirname, '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const EXT = path.join(RACINE, 'vinted-sync-extension');
const SORTIE = path.join(RACINE, 'docs', 'boutiques', 'visuels');
const PORT = Number(process.env.PORT_VISUELS) || 10178;
const CHROMIUM = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const POLICE = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Inter, system-ui, sans-serif`;
const ENCRE = '#1D1D1F', GRIS = '#6E6E73', FOND = '#F5F5F7';

// Les écrans montrés, dans l'ordre de la fiche. Le titre dit ce que l'EXTENSION
// apporte à cet écran — rien que le code ne fasse.
const ECRANS = [
  { tab: 'journee', titre: 'Ta journée de revendeur, en un coup d’œil.', sous: 'Ventes, colis, messages : ce que l’extension relève sur tes comptes arrive ici.' },
  { tab: 'cat_bord', titre: 'Les bordereaux de tes ventes, prêts à imprimer.', sous: 'Avec le numéro de rangement de la paire, pour ne jamais envoyer la mauvaise.' },
  { tab: 'ventes', titre: 'Toutes tes ventes, de tous tes comptes.', sous: 'Vinted, Leboncoin, eBay, Vestiaire Collective — et l’argent qui arrive.' },
  { tab: 'annonces', titre: 'Tes annonces en ligne, avec leur numéro.', sous: 'Prix d’achat, paires qui dorment, offres : rangés par compte.' },
];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const servir = () => http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const dataPng = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');

async function capturesApp(nav, externes) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: 'light' });
  const pg = await ctx.newPage();
  // Le mode exemple s'installe AVANT l'app, seulement si l'onglet le demande.
  await pg.addInitScript(() => { try { sessionStorage.setItem('vrm_mode_exemple', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost)/i, (r) => { externes.push(r.request().url().replace(/^https?:\/\//, '').slice(0, 90)); return r.abort(); });
  const brutes = [];
  for (const e of ECRANS) {
    await pg.goto(`http://localhost:${PORT}/?tab=${e.tab}`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-exemple-bandeau]', { timeout: 25000 });
    await pg.waitForTimeout(3000);
    brutes.push({ ...e, png: await pg.screenshot({ type: 'png' }) });
  }
  await ctx.close();
  return brutes;
}

// La vraie fenêtre de l'extension (popup.html + popup.js du dossier servi), en
// mode « carte » (celle que le logo VRM ouvre sur les sites), connectée.
async function capturePopup(nav) {
  const ctx = await nav.newContext({ viewport: { width: 300, height: 290 }, deviceScaleFactor: 2, colorScheme: 'light' });
  const pg = await ctx.newPage();
  const html = fs.readFileSync(path.join(EXT, 'popup.html'), 'utf8')
    .replace(/<script src="popup\.js"><\/script>/, '').replace(/<script src="parcours-popup\.js"><\/script>/, '');
  await pg.route('**/*', (r) => {
    const u = r.request().url();
    const png = (u.match(/\/([a-z0-9-]+\.png)$/i) || [])[1];
    if (png && fs.existsSync(path.join(EXT, png))) return r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(path.join(EXT, png)) });
    return r.fulfill({ status: 200, contentType: 'text/html', body: html });
  });
  await pg.goto('https://ext.test/popup.html?mode=carte');
  await pg.evaluate(() => {
    const etat = { ok: true, connecte: true, email: 'vendeur@exemple.test', cloisonne: true };
    window.chrome = {
      runtime: {
        id: 'exemple', lastError: null, getManifest: () => ({ version: 'exemple' }), reload: () => {},
        sendMessage: (msg, cb) => {
          const r = msg.action === 'authEtat' ? etat
            : msg.action === 'freshness' ? { ok: true, fresh: [] }
            : msg.action === 'transpPermis' ? { ok: true, permis: true }
            : msg.action === 'fournisseursConnexion' ? { ok: false }
            : { ok: true };
          setTimeout(() => cb && cb(r), 0);
        },
      },
      storage: { local: { get: (k, cb) => { if (cb) { setTimeout(() => cb({}), 0); return; } return Promise.resolve({}); }, set: (o, cb) => { if (cb) { setTimeout(cb, 0); return; } return Promise.resolve(); } } },
      tabs: { query: (q, cb) => setTimeout(() => cb([]), 0), create: () => {}, update: () => {} },
      windows: { update: () => {} },
      permissions: { request: (q, cb) => cb && cb(true) },
    };
    window.close = () => {};
  });
  await pg.addScriptTag({ content: fs.readFileSync(path.join(EXT, 'popup.js'), 'utf8') });
  await pg.waitForTimeout(600);
  const png = await pg.screenshot({ type: 'png' });
  await ctx.close();
  return png;
}

// Une image composée : une page HTML rendue à la taille exacte demandée.
async function composer(nav, largeur, hauteur, corps, fichier) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  await pg.route(/^https?:\/\//i, (r) => r.abort());
  await pg.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0} html,body{width:${largeur}px;height:${hauteur}px;overflow:hidden}
    body{font-family:${POLICE};color:${ENCRE};background:${FOND};-webkit-font-smoothing:antialiased}
  </style></head><body>${corps}</body></html>`);
  await pg.waitForTimeout(150);
  await pg.screenshot({ path: path.join(SORTIE, fichier), type: 'png' });
  await ctx.close();
  console.log('✓ docs/boutiques/visuels/' + fichier);
}

const cadreEcran = (e) => `
  <div style="position:absolute;left:0;right:0;top:46px;text-align:center">
    <div style="font-size:38px;font-weight:600;letter-spacing:-0.02em">${e.titre}</div>
    <div style="margin-top:10px;font-size:19px;color:${GRIS}">${e.sous}</div>
  </div>
  <img src="data:image/png;base64,${e.png.toString('base64')}" style="position:absolute;left:120px;top:166px;width:1040px;height:650px;border-radius:14px 14px 0 0;box-shadow:0 18px 50px rgba(0,0,0,.14),0 0 0 1px rgba(0,0,0,.06)">`;

const cadrePopup = (png) => `
  <div style="position:absolute;left:120px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center">
    <div style="font-size:40px;font-weight:600;letter-spacing:-0.02em;line-height:1.15">L’extension dit à quel<br>compte VRM elle envoie.</div>
    <div style="margin-top:18px;font-size:19px;line-height:1.5;color:${GRIS}">Touche le logo VRM sur Vinted, Leboncoin, eBay ou Vestiaire Collective : la carte nomme le compte VRM où partent tes données. L’extension n’agit que pour le compte connecté dans l’onglet du site, au plus 50 actions par heure, une requête à la fois.</div>
  </div>
  <img src="data:image/png;base64,${png.toString('base64')}" style="position:absolute;right:150px;top:${(800 - 406) / 2}px;width:420px;height:406px;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.16),0 0 0 1px rgba(0,0,0,.06);background:#fff">`;

const icone = (taille, rayon) => `<img src="${dataPng(path.join(RACINE, 'public', 'vrm-icon-v4-512.png'))}" style="width:${taille}px;height:${taille}px;border-radius:${rayon}px;box-shadow:0 6px 18px rgba(0,0,0,.12)">`;
const tuile = (l, h, t, ti, st) => `
  <div style="width:${l}px;height:${h}px;display:flex;align-items:center;justify-content:center;gap:${Math.round(t * 0.3)}px">
    ${icone(t, Math.round(t * 0.225))}
    <div><div style="font-size:${ti}px;font-weight:600;letter-spacing:-0.02em">VRM</div>
    <div style="margin-top:${Math.round(st * 0.35)}px;font-size:${st}px;line-height:1.35;color:${GRIS}">L’outil du revendeur.<br>Vinted, Leboncoin, eBay,<br>Vestiaire Collective.</div></div>
  </div>`;

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('✗ dist/ absent : lance d’abord npm run build'); process.exit(1); }
  fs.mkdirSync(SORTIE, { recursive: true });
  const srv = servir(); await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const externes = [];
  try {
    const brutes = await capturesApp(nav, externes);
    // Aucune approche de la base de VRM ni du site : l'exemple répond sur place.
    const interdits = externes.filter((u) => /supabase\.co|vrm\.center|vercel\.app/.test(u));
    if (interdits.length) { console.error('✗ le mode exemple a tenté de joindre VRM :', interdits); process.exitCode = 1; return; }
    for (let i = 0; i < brutes.length; i++) await composer(nav, 1280, 800, cadreEcran(brutes[i]), `capture-${i + 1}-${brutes[i].tab}.png`);
    await composer(nav, 1280, 800, cadrePopup(await capturePopup(nav)), `capture-${brutes.length + 1}-extension.png`);
    await composer(nav, 440, 280, tuile(440, 280, 96, 34, 14), 'tuile-440x280.png');
    await composer(nav, 1400, 560, tuile(1400, 560, 220, 76, 28), 'tuile-1400x560.png');
    await composer(nav, 300, 300, `<img src="${dataPng(path.join(RACINE, 'public', 'vrm-icon-v4-512.png'))}" style="width:300px;height:300px;display:block">`, 'logo-300x300.png');
    console.log(`(requêtes coupées vers d’autres sites publics : ${externes.length} — géocodage des points relais inventés, rien envoyé)`);
  } finally { await nav.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
