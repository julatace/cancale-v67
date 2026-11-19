// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE POIDS DU DÉMARRAGE NE REMONTE PAS
//         npm run build && node scripts/audit-poids-demarrage.cjs [--prouve] [dist]
// ═══════════════════════════════════════════════════════════════════════════
// (17 nov., lot vitesse-poids — docs/passation/2026-11-17-vitesse-poids.md)
// Le JavaScript et la CSS que le téléphone télécharge AVANT Ma journée, lus dans le
// build lui-même (dist/index.html : le script d'entrée, ses `modulepreload`, et ce que
// public/demarrage-app.js précharge — `data-js` / `data-css`, c.-à-d. le morceau App
// et ses imports statiques), compressés comme les sert Vercel (gzip -9 ici).
// Sans navigateur ni base : quelques secondes, après un build. (Le banc
// budget-vitesse mesure la même chose dans un vrai Chrome — plus lent.)
//   1. le total ≤ 1 966 Ko (le budget de budget-vitesse.json, Ma journée appareil neuf) ;
//   2. le français des écrans à la demande (fr-reste) existe et n'est PAS au démarrage ;
//   3. le démarrage se lit (le morceau App est trouvé, ≥ 1 Mo).
// `--prouve` : le reste remis au démarrage ⇒ rouge ; le morceau App alourdi de 130 Ko ⇒ rouge.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const R = path.join(__dirname, '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const DIST = path.resolve(args[0] || path.join(R, 'dist'));
const BUDGET_KO = (() => { try { return JSON.parse(fs.readFileSync(path.join(R, 'scripts', 'budget-vitesse.json'), 'utf8')).ecrans.journee.neuf.js; } catch (_) { return 1966; } })();

function demarrage() {
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const fichiers = new Set();
  for (const m of html.matchAll(/<script[^>]*type="module"[^>]*src="\/([^"]+)"/g)) fichiers.add(m[1]);
  for (const m of html.matchAll(/<link[^>]*rel="(?:modulepreload|stylesheet)"[^>]*href="\/([^"]+)"/g)) fichiers.add(m[1]);
  for (const m of html.matchAll(/data-(?:js|css)="([^"]*)"/g)) for (const f of m[1].split(',').filter(Boolean)) fichiers.add(f.replace(/^\//, ''));
  return [...fichiers].filter((f) => /^assets\/.+\.(js|css)$/.test(f));
}
const poids = (f, extra) => zlib.gzipSync(Buffer.concat([fs.readFileSync(path.join(DIST, f)), extra || Buffer.alloc(0)]), { level: 9 }).length;

function juger(mut, dire) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (dire) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
  const liste = demarrage();
  const reste = fs.readdirSync(path.join(DIST, 'assets')).filter((f) => /^fr-reste-.*\.js$/.test(f)).map((f) => 'assets/' + f);
  if (mut === 'reste') liste.push(...reste);
  const app = liste.find((f) => /^assets\/App-[^/]+\.js$/.test(f));
  const lourd = mut === 'lourd' ? require('crypto').randomBytes(130 * 1024) : null;
  const detail = liste.map((f) => [f, poids(f, f === app ? lourd : null)]).sort((a, b) => b[1] - a[1]);
  const total = detail.reduce((s, x) => s + x[1], 0);
  dit(!!app && fs.statSync(path.join(DIST, app)).size > 1e6, `le démarrage se lit (${liste.length} fichiers, morceau App trouvé)`);
  if (dire) for (const [f, o] of detail.slice(0, 8)) console.log(`       ${String(Math.round(o / 1024)).padStart(5)} Ko  ${f}`);
  dit(total <= BUDGET_KO * 1024, `JavaScript + CSS du démarrage ≤ ${BUDGET_KO} Ko compressés`, `${Math.round(total / 1024)} Ko`);
  dit(reste.length === 1 && !liste.some((f) => reste.includes(f)), 'le français des écrans à la demande (fr-reste) existe et ne part pas au démarrage', reste.join(', ') || 'absent');
  return ko;
}

if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log(`❌ audit-poids-demarrage : pas de build dans ${DIST} (npm run build d'abord)`); process.exit(2); }
if (process.argv.includes('--prouve')) {
  let rouges = 0;
  for (const [mut, nom] of [['reste', 'le français des écrans remis au démarrage'], ['lourd', 'le morceau App alourdi de 130 Ko']]) {
    const ko = juger(mut, false);
    console.log((ko ? '  ✅ ' : '  ❌ ') + `mutation « ${nom} » ⇒ ${ko ? 'rouge' : 'VERT'}`);
    if (ko) rouges++;
  }
  console.log(rouges === 2 ? '\n✅ audit-poids-demarrage --prouve : 2/2 mutations rouges' : '\n❌ audit-poids-demarrage --prouve : une mutation reste verte');
  process.exit(rouges === 2 ? 0 : 1);
}
const ko = juger('', true);
console.log(ko ? `\n❌ audit-poids-demarrage : ${ko} rouge(s)` : '\n✅ audit-poids-demarrage : le démarrage tient dans son budget');
process.exit(ko ? 1 : 0);
