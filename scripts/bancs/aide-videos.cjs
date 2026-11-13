// ── BANC : LES VIDÉOS DU « ? » (13 nov., lot 49) ─────────────────────────────────
// Données INVENTÉES (le monde des films, scripts/films/_monde.cjs ; aucune fx/), 390 px
// tactile, servies sous la VRAIE forme. Ce qu'il exige, écran par écran (les 10 écrans
// principaux), en relevant CHAQUE requête de la page :
//  A. au démarrage de l'écran : aucune requête vers /aide/videos/ (ni vidéo, ni aperçu,
//     ni piste), aucun <video> dans la page ; le service worker ne range rien de /aide/ ;
//  B. le « ? » de l'écran ouvre la feuille, dont la PREMIÈRE vidéo est la sienne
//     (Achats propose aussi « Retirer un colis ») ; feuille ouverte : toujours aucune
//     requête .mp4 ni .vtt, aucun <video> (seul l'aperçu .jpg peut venir) ;
//  C. le toucher de « Regarder » : un <video> sans son, en ligne, avec commandes, sur
//     /aide/videos/<id>.mp4 ; la requête .mp4 part (et seulement celle de cette vidéo) ;
//     le fichier servi est un MP4 ≤ 1,5 Mo, sa piste .vtt existe ;
//  D. le colis hors onglet : `vrm:aide` { ecran: 'colis' } ouvre la feuille sur « Retirer un colis ».
// `BANC_PORT` (défaut : au hasard 22000-22499), `BANC_DIST` (défaut dist/), `BANC_CAPTURES=dossier`,
// `BANC_ECRANS=journee,ventes` (quelques écrans seulement).
// `BANC_MUTATION=` (le JS ou la page servis sont réécrits, la règle doit rougir) :
//    mauvaise-video  : le « ? » de Ventes propose la vidéo de Ma journée ;
//    demarrage       : la page précharge une vidéo au démarrage ;
//    apercu-video    : l'aperçu de la feuille pointe sur le .mp4 (chargé avant le toucher).
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { servirBase } = require(path.join(RACINE, 'scripts', 'films', '_commun.cjs'));
const { monde } = require(path.join(RACINE, 'scripts', 'films', '_monde.cjs'));
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || (22000 + Math.floor(Math.random() * 500));
const CAPTURES = process.env.BANC_CAPTURES || '';
const MUTATION = process.env.BANC_MUTATION || '';
const POIDS_MAX = 1.5 * 1024 * 1024;

// L'écran (onglet) → la clé de son « ? » → la vidéo attendue EN PREMIER.
const ECRANS = [
  ['journee', 'journee', 'journee'], ['ventes', 'ventes', 'ventes'], ['achats', 'achats', 'achats'],
  ['annonces', 'annonces', 'annonces'], ['garage', 'garage', 'garage'], ['compta', 'compta', 'compta'],
  ['messages', 'messages', 'messages'], ['emails', 'emails', 'emails'], ['settings', 'settings', 'settings'],
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).split('\n')[0].slice(0, 200)); } };

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8' };
const muter = (p, corps) => {
  if (!MUTATION) return corps;
  if (MUTATION === 'demarrage' && p.endsWith('index.html')) return Buffer.from(String(corps).replace('</head>', '<link rel="preload" as="fetch" crossorigin href="/aide/videos/journee.mp4"></head>'));
  if (!p.endsWith('.js')) return corps;
  let s = String(corps);
  if (MUTATION === 'mauvaise-video') s = s.replace(/ventes:\["ventes"\]/g, 'ventes:["journee"]');
  if (MUTATION === 'apercu-video') s = s.replace(/,"jpg"\)/g, ',"mp4")');
  return Buffer.from(s);
};
const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(muter(p, fs.readFileSync(p)));
});
srv.on('error', (e) => { console.log(`  ❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=…`); process.exit(1); });

async function ouvrir(nav, tab) {
  const m = monde();
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
  await ctx.clock.install({ time: new Date(m.maintenant) });
  await servirBase(ctx, m);
  const session = { access_token: m.jeton, refresh_token: 'r', expires_at: Date.parse(m.maintenant) + 864e5, user: { id: m.uid, email: m.email } };
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('banc_init')) { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); localStorage.setItem('vrm_bienvenue_vue', '{"at":"banc"}'); localStorage.setItem('vrm_visite_vue', '{"at":"banc"}'); sessionStorage.setItem('banc_init', '1'); } } catch (_) {} }, session);
  const pg = await ctx.newPage(); pg.setDefaultTimeout(30000);
  const requetes = [];
  pg.on('request', (q) => { const u = q.url(); if (/\/aide\/videos\//.test(u)) requetes.push({ u: new URL(u).pathname, t: q.resourceType() }); });
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message).slice(0, 160)));
  await pg.goto(`http://127.0.0.1:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.locator('.vrm-main').first().waitFor({ timeout: 60000 });
  await pg.waitForTimeout(2500);
  return { ctx, pg, requetes, erreurs };
}
const videos = (pg) => pg.evaluate(() => [...document.querySelectorAll('video')].map((v) => ({ src: v.getAttribute('src') || v.currentSrc || '', muted: v.muted, inline: v.playsInline, controls: v.controls, pistes: [...v.querySelectorAll('track')].map((t) => t.getAttribute('src')) })));

(async () => {
  await new Promise((ok) => srv.listen(PORT, '127.0.0.1', ok));
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    console.log(`Banc vidéos du « ? » — ${DIST}${MUTATION ? ' — MUTATION ' + MUTATION : ''}`);
    // Le service worker laisse /aide/ au réseau, et ne nomme aucune vidéo.
    await essaie('service worker', async () => {
      const sw = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');
      dit(/url\.pathname\.startsWith\('\/aide\/'\)\) return;/.test(sw) || /startsWith\('\/aide\/'\)/.test(sw), 'sw.js : /aide/ va au réseau (rien en réserve)');
      dit(!/\.mp4|aide\/videos/.test(sw), 'sw.js ne nomme aucune vidéo');
    });
    const seuls = (process.env.BANC_ECRANS || '').split(',').filter(Boolean);
    for (const [tab, cle, attendue] of ECRANS.filter(([t]) => !seuls.length || seuls.includes(t))) {
      console.log(`· ${tab}`);
      await essaie(tab, async () => {
        const { ctx, pg, requetes, erreurs } = await ouvrir(nav, tab);
        try {
          dit(requetes.length === 0, `${tab} : aucune requête /aide/videos/ au démarrage`, requetes.map((r) => r.u).join(', '));
          dit((await videos(pg)).length === 0, `${tab} : aucun <video> au démarrage`);
          const q = pg.locator(`[data-aide-ouvrir="${cle}"]`).first();
          await q.waitFor({ state: 'attached', timeout: 20000 });
          await q.scrollIntoViewIfNeeded(); await q.tap();
          const feuille = pg.locator(`[data-aide-feuille="${cle}"]`).first();
          await feuille.waitFor({ timeout: 15000 });
          const tuiles = await feuille.locator('[data-aide-video]').evaluateAll((l) => l.map((e) => e.getAttribute('data-aide-video')));
          dit(tuiles[0] === attendue, `${tab} : le « ? » propose d'abord SA vidéo (« ${attendue} »)`, `tuiles : ${tuiles.join(', ') || 'aucune'}`);
          if (cle === 'achats') dit(tuiles.includes('colis'), 'achats : « Retirer un colis » proposé aussi');
          await pg.waitForTimeout(800);
          if (CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(CAPTURES, `${tab}-feuille.png`) }); }
          const avant = requetes.filter((r) => /\.(mp4|vtt)$/.test(r.u));
          dit(avant.length === 0, `${tab} : feuille ouverte, aucune vidéo ni piste demandée avant le toucher`, avant.map((r) => r.u).join(', '));
          dit((await videos(pg)).length === 0, `${tab} : feuille ouverte, aucun <video> avant le toucher`);
          if (!tuiles.length) return;
          const n0 = requetes.length;
          await feuille.locator(`[data-aide-video="${tuiles[0]}"]`).first().tap();
          await pg.locator(`[data-aide-video-lecteur="${tuiles[0]}"] video`).first().waitFor({ timeout: 10000 });
          await pg.waitForTimeout(1500);
          // Elle se LIT : des images décodées, une durée, le temps qui avance (Chromium du banc lit le H.264).
          let lu = null;
          for (let k = 0; k < 40; k++) {
            lu = await pg.evaluate(() => { const x = document.querySelector('[data-aide-video-lecteur] video'); return x ? { rs: x.readyState, d: x.duration, t: x.currentTime, err: x.error ? x.error.code : 0 } : null; });
            if (lu && (lu.err || (lu.rs >= 2 && lu.t > 0.3))) break;
            await pg.waitForTimeout(250);
          }
          dit(lu && !lu.err && lu.rs >= 2 && lu.t > 0.3 && lu.d > 5 && lu.d <= 30.05, `${tab} : la vidéo se lit (durée ${lu && lu.d ? lu.d.toFixed(1) : '?'} s, lue jusqu'à ${lu ? lu.t.toFixed(1) : '?'} s)`, lu && lu.err ? 'erreur média ' + lu.err : '');
          dit(!(await pg.locator('[data-aide-video-panne]').count()), `${tab} : aucune panne de lecture affichée`);
          const v = (await videos(pg))[0] || {};
          dit(v.src === `/aide/videos/${tuiles[0]}.mp4`, `${tab} : le lecteur lit /aide/videos/${tuiles[0]}.mp4`, v.src);
          dit(v.muted && v.inline && v.controls, `${tab} : sans son, en ligne, avec ses commandes`);
          dit((v.pistes || []).includes(`/aide/videos/${tuiles[0]}.vtt`), `${tab} : piste de sous-titres .vtt`);
          const apres = requetes.slice(n0).filter((r) => /\.mp4$/.test(r.u));
          dit(apres.length > 0 && apres.every((r) => r.u === `/aide/videos/${tuiles[0]}.mp4`), `${tab} : au toucher, la requête part — celle de CETTE vidéo seulement`, apres.map((r) => r.u).join(', ') || 'aucune');
          const fichier = path.join(DIST, 'aide', 'videos', `${tuiles[0]}.mp4`);
          const taille = fs.existsSync(fichier) ? fs.statSync(fichier).size : -1;
          const tete = taille > 0 ? fs.readFileSync(fichier).subarray(4, 8).toString('latin1') : '';
          dit(taille > 0 && taille <= POIDS_MAX && tete === 'ftyp', `${tab} : le fichier est un MP4 ≤ 1,5 Mo`, `${taille} octets`);
          dit(fs.existsSync(path.join(DIST, 'aide', 'videos', `${tuiles[0]}.vtt`)) && fs.existsSync(path.join(DIST, 'aide', 'videos', `${tuiles[0]}.jpg`)), `${tab} : sa piste .vtt et son aperçu .jpg existent`);
          if (CAPTURES) { fs.mkdirSync(CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(CAPTURES, `${tab}-lecteur.png`) }); }
          dit(!erreurs.length, `${tab} : aucune erreur de page`, erreurs.join(' | '));
        } finally { await ctx.close(); }
      });
    }
    // D. Colis n'est plus un onglet : la feuille « colis » (loupe, liens) mène à « Retirer un colis ».
    console.log('· colis (vrm:aide)');
    await essaie('colis', async () => {
      const { ctx, pg, requetes } = await ouvrir(nav, 'achats');
      try {
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aide', { detail: { ecran: 'colis' } })));
        const feuille = pg.locator('[data-aide-feuille="colis"]').first();
        await feuille.waitFor({ timeout: 15000 });
        const tuiles = await feuille.locator('[data-aide-video]').evaluateAll((l) => l.map((e) => e.getAttribute('data-aide-video')));
        dit(tuiles[0] === 'colis', 'colis : la feuille propose d\'abord « Retirer un colis »', tuiles.join(', '));
        dit(!requetes.some((r) => /\.mp4$/.test(r.u)), 'colis : rien de lu avant le toucher');
      } finally { await ctx.close(); }
    });
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
