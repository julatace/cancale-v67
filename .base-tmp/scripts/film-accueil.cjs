// Exporte le film « Une journée avec VRM » (src/AccueilFilm.jsx) en MP4.
//
// C'est le MÊME code que la page d'accueil : la carte « Aujourd'hui » et les
// écrans dessinés reçoivent le temps du film. Une fonction pure du temps, rendue
// image par image — aucune image ne dépend de la vitesse de la machine.
//
// Lancer (après `npm run build`) :
//   OUT=/un/dossier node scripts/film-accueil.cjs
//     → vrm-film-1920x1080.mp4 et vrm-film-1080x1920.mp4 (35 s)
//       + vrm-film-court-1080x1920.mp4 (15 s, pour les « stories »)
//   FILMS=long|court|long,court        (défaut : les deux)
//   FORMATS_LONG=paysage,portrait      (défaut : les deux)
//   FORMATS_COURT=portrait             (défaut : portrait seulement)
//   IPS=60                             (défaut 60 : les avancées de caméra saccadent à 30)
// ⚠️ Les vidéos ne montent JAMAIS dans le dépôt (poids) : elles se régénèrent
//    après chaque changement de la démo, et se publient à part.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const DIST = path.join(RACINE, 'dist');
const OUT = process.env.OUT;
if (!OUT) { console.log('Indique le dossier de sortie : OUT=/chemin node scripts/film-accueil.cjs'); process.exit(1); }
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('Lance d\'abord npm run build.'); process.exit(1); }
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const IPS = Number(process.env.IPS) || 60;
const FORMATS = { paysage: { w: 1920, h: 1080 }, portrait: { w: 1080, h: 1920 } };
const films = (process.env.FILMS || 'long,court').split(',').map((x) => x.trim()).filter((x) => x === 'long' || x === 'court');
const formatsDe = (film) => (process.env[film === 'long' ? 'FORMATS_LONG' : 'FORMATS_COURT'] || (film === 'long' ? 'paysage,portrait' : 'portrait'))
  .split(',').map((x) => x.trim()).filter((f) => FORMATS[f]);

const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(DIST, p);
  if (f.startsWith(DIST) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); return r.end(fs.readFileSync(f)); }
  r.writeHead(200, { 'content-type': 'text/html' }); r.end(fs.readFileSync(path.join(DIST, 'index.html')));
});
srv.listen(0, '127.0.0.1', async () => {
  const racine = 'http://127.0.0.1:' + srv.address().port;
  // `--disable-gpu-compositing` : composé par le processeur, une image de
  //    1920×1080 sort en 0,7 s au lieu de 1,2 s sur ce conteneur, et c'est la même
  //    image (mesuré le 11 octobre : PSNR 56 dB entre les deux).
  // ⚠️ Chromium range son profil dans TMPDIR : un chemin trop long (plus de
  //    ~100 caractères) l'empêche d'ouvrir sa prise et il meurt (SIGTRAP, vu le
  //    11 octobre). Laisser TMPDIR par défaut ; OUT peut être n'importe où.
  let nav;
  try { nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--hide-scrollbars', '--disable-gpu-compositing'] }); }
  catch (e) { console.log('Chromium ne démarre pas : ' + String(e.message).split('\n')[0]); srv.close(); process.exitCode = 1; return; }
  try {
    fs.mkdirSync(OUT, { recursive: true });
    for (const film of films) {
      for (const nom of formatsDe(film)) {
        const { w, h } = FORMATS[nom];
        // Un contexte neuf par vidéo, sans service worker (il rechargeait la page
        // au milieu du second format : « context destroyed »).
        const ctx = await nav.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
        const pg = await ctx.newPage();
        // Le film ne lit rien en base et n'appelle aucun service.
        await pg.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
        await pg.route('**/rest/v1/**', (r) => r.abort());
        await pg.goto(`${racine}/?film${film === 'court' ? '=court' : ''}`, { waitUntil: 'networkidle' });
        await pg.waitForFunction(() => typeof window.__filmT === 'function' && window.__filmDuree > 0);
        await pg.evaluate(() => document.fonts && document.fonts.ready);
        const duree = await pg.evaluate(() => window.__filmDuree);
        const n = Math.round(duree * IPS);
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'film-'));
        process.stdout.write(`${film} ${nom} ${w}×${h} : ${n} images `);
        for (let i = 0; i < n; i++) {
          await pg.evaluate((s) => new Promise((res) => { window.__filmT(s); requestAnimationFrame(() => requestAnimationFrame(res)); }), i / IPS);
          await pg.screenshot({ path: path.join(tmp, String(i).padStart(5, '0') + '.png') });
          if (i % 120 === 0) process.stdout.write('.');
        }
        const sortie = path.join(OUT, `vrm-film${film === 'court' ? '-court' : ''}-${w}x${h}.mp4`);
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(IPS), '-i', path.join(tmp, '%05d.png'),
          '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', sortie]);
        fs.rmSync(tmp, { recursive: true, force: true });
        console.log(` → ${sortie} (${Math.round(fs.statSync(sortie).size / 1024)} Ko, ${duree} s)`);
        await ctx.close();
      }
    }
  } catch (e) {
    console.log('\nÉchec : ' + e.message); process.exitCode = 1;
  } finally { await nav.close(); srv.close(); }
});
