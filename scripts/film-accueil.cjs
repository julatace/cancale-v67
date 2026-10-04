// Exporte la démonstration animée de la page d'accueil en vidéo MP4.
//
// C'est LA MÊME animation que sur vrm.center (src/Accueil.jsx, `?film`) : une
// fonction pure du temps, rendue image par image — aucune image ne dépend de la
// vitesse de la machine, la vidéo est fluide même rendue lentement.
//
// Lancer (après `npm run build`) :
//   OUT=/un/dossier node scripts/film-accueil.cjs            → 16:9 et 9:16
//   OUT=/un/dossier FORMATS=paysage node scripts/film-accueil.cjs
// Produit vrm-demo-1920x1080.mp4 et vrm-demo-1080x1920.mp4 dans OUT.
// Les vidéos ne montent PAS dans le dépôt (poids) : elles se publient à part.
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const DIST = path.join(RACINE, 'dist');
const OUT = process.env.OUT;
if (!OUT) { console.log('Indique le dossier de sortie : OUT=/chemin node scripts/film-accueil.cjs'); process.exit(1); }
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('Lance d\'abord npm run build.'); process.exit(1); }
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const IPS = Number(process.env.IPS) || 30;
const FORMATS = { paysage: { w: 1920, h: 1080 }, portrait: { w: 1080, h: 1920 } };
const voulus = (process.env.FORMATS || 'paysage,portrait').split(',').filter((f) => FORMATS[f]);

const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(DIST, p);
  if (f.startsWith(DIST) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); return r.end(fs.readFileSync(f)); }
  r.writeHead(200, { 'content-type': 'text/html' }); r.end(fs.readFileSync(path.join(DIST, 'index.html')));
});
srv.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + srv.address().port + '/?film';
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--hide-scrollbars'] });
  try {
    fs.mkdirSync(OUT, { recursive: true });
    for (const nom of voulus) {
      const { w, h } = FORMATS[nom];
      // Un contexte neuf par format, sans service worker : installé au premier
      // format, il rechargeait la page au milieu du second (« context destroyed »).
      const ctx = await nav.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
      const pg = await ctx.newPage();
      // Aucune requête vers la base ni vers un service : la page `?film` n'en fait pas.
      await pg.route('**/rest/v1/**', (r) => r.abort());
      await pg.goto(base, { waitUntil: 'networkidle' });
      await pg.waitForFunction(() => typeof window.__filmT === 'function' && window.__filmDuree > 0);
      await pg.evaluate(() => document.fonts && document.fonts.ready);
      const duree = await pg.evaluate(() => window.__filmDuree);
      const n = Math.round(duree * IPS);
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'film-'));
      process.stdout.write(`${nom} ${w}×${h} : ${n} images `);
      for (let i = 0; i < n; i++) {
        await pg.evaluate((s) => new Promise((res) => { window.__filmT(s); requestAnimationFrame(() => requestAnimationFrame(res)); }), i / IPS);
        await pg.screenshot({ path: path.join(tmp, String(i).padStart(5, '0') + '.png') });
        if (i % 60 === 0) process.stdout.write('.');
      }
      const sortie = path.join(OUT, `vrm-demo-${w}x${h}.mp4`);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(IPS), '-i', path.join(tmp, '%05d.png'),
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', sortie]);
      fs.rmSync(tmp, { recursive: true, force: true });
      console.log(` → ${sortie} (${Math.round(fs.statSync(sortie).size / 1024)} Ko)`);
      await ctx.close();
    }
  } catch (e) {
    console.log('\nÉchec : ' + e.message); process.exitCode = 1;
  } finally { await nav.close(); srv.close(); }
});
