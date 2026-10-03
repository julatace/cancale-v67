// Banc : le cache du service worker ne garde QU'UNE version, et ne fige jamais
// un fichier au nom stable (le zip de l'extension).
//
// Mesuré le 3 octobre : le cache `vrm-shell-v4` passait de 1,4 à 3,3 Mo en trois
// déploiements — chaque version y laissait son bundle, rien n'était purgé, avec
// 13 à 21 déploiements par jour. Et tout fichier même-origine était servi
// « cache d'abord » : `/VRM-extension.zip` (même nom à chaque version) restait
// figé sur le premier zip téléchargé.
//
// Aucune fixture : trois « déploiements » synthétiques servis l'un après l'autre
// sur la même origine, avec le VRAI public/sw.js (lu depuis l'arbre du banc,
// jamais un chemin absolu — §6.1).
// Lancer : node scripts/bancs/sw-cache.cjs
const http = require('http'), fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..', '..');
const SW = fs.readFileSync(path.join(RACINE, 'public', 'sw.js'), 'utf8');
let chromium;
try { ({ chromium } = require(path.join(RACINE, 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }

let ko = 0;
const ok = (m) => console.log('OK  ' + m);
const nok = (m, d) => { ko++; console.log('KO  ' + m + (d ? ' — ' + d : '')); };

let version = 'A';
const page = (v) => `<!doctype html><html><head><meta charset="utf-8"><title>VRM</title>
<script type="module" crossorigin src="/assets/index-${v}111.js"></script></head>
<body><div id="root"></div>
<script>if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');</script></body></html>`;
const servir = (q, r) => {
  const p = decodeURIComponent(q.url.split('?')[0]);
  const v = version;
  const env = (type, corps) => { r.writeHead(200, { 'content-type': type, 'cache-control': 'public, max-age=0, must-revalidate' }); r.end(corps); };
  if (p === '/' || p === '/index.html') return env('text/html', page(v));
  if (p === '/sw.js') return env('application/javascript', SW);
  if (p === `/assets/index-${v}111.js`) return env('application/javascript', `window.__principal='${v}';fetch('/assets/lazy-${v}222.js').then(r=>r.text()).then(t=>{window.__lazy=t;});`);
  if (p === `/assets/lazy-${v}222.js`) return env('application/javascript', `/* lazy ${v} */`);
  if (p === '/VRM-extension.zip') return env('application/zip', 'zip-' + v);
  r.writeHead(404); r.end();
};

const srv = http.createServer(servir);
srv.on('error', (e) => { console.log('KO  le banc n\'a pas pu démarrer — ' + e.message); process.exit(1); });
srv.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    const ctx = await b.newContext();
    const pg = await ctx.newPage();
    const contenu = () => pg.evaluate(async () => {
      const out = [];
      for (const nom of await caches.keys()) {
        const c = await caches.open(nom);
        for (const k of await c.keys()) out.push(new URL(k.url).pathname);
      }
      return out;
    });
    const visiter = async () => {
      await pg.goto(base, { waitUntil: 'load' });
      await pg.evaluate(() => navigator.serviceWorker.ready);
      if (!(await pg.evaluate(() => !!navigator.serviceWorker.controller))) await pg.reload({ waitUntil: 'load' });
      await pg.waitForFunction(() => typeof window.__lazy === 'string', null, { timeout: 8000 }).catch(() => {});
      await pg.waitForTimeout(600);   // laisse le service worker finir sa purge
    };
    const zip = () => pg.evaluate(() => fetch('/VRM-extension.zip').then(r => r.text()));

    version = 'A'; await visiter();
    const zipA = await zip();
    version = 'B'; await visiter();
    const zipB = await zip();
    version = 'C'; await visiter();
    const apresC = (await contenu()).filter(p => p.startsWith('/assets/'));
    const vieux = apresC.filter(p => /-(A|B)\d+\.js$/.test(p));
    vieux.length === 0
      ? ok('après trois déploiements, le cache ne garde que la version servie (' + apresC.join(', ') + ')')
      : nok('le cache garde les anciennes versions', vieux.join(', '));
    apresC.includes('/assets/index-C111.js')
      ? ok('l\'autre sens : la version servie reste en cache (hors-ligne)')
      : nok('la version servie est en cache', apresC.join(', ') || 'rien');

    // Même version rouverte : le morceau chargé à la demande n'est PAS jeté.
    await visiter();
    const apresC2 = (await contenu()).filter(p => p.startsWith('/assets/'));
    apresC2.includes('/assets/lazy-C222.js')
      ? ok('rouvrir la même version ne jette pas ce qui a été chargé à la demande')
      : nok('rouvrir la même version garde le morceau chargé à la demande', apresC2.join(', '));

    zipA === 'zip-A' && zipB === 'zip-B'
      ? ok('le zip de l\'extension suit le déploiement (jamais figé sur le premier téléchargé)')
      : nok('le zip suit le déploiement', `A=${zipA} puis B=${zipB}`);
  } catch (e) {
    nok('le banc s\'exécute', e.message);
  } finally {
    await b.close(); srv.close();
    console.log(ko ? `\n❌ sw-cache : ${ko} contrôle(s) en échec` : '\n✅ sw-cache : tout est vert');
    process.exit(ko ? 1 : 0);
  }
});
