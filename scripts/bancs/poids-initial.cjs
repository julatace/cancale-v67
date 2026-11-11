// ════════════════════════════════════════════════════════════════════════════
//  POIDS DU JS INITIAL (11 nov., lot « chargement léger »,
//  docs/passation/2026-11-11-chargement-leger.md)
//
//  Ce que le téléphone télécharge et évalue AVANT le premier écran de l'app :
//  le module d'entrée d'index.html, ses `modulepreload`, ce que
//  public/demarrage-app.js précharge (`data-js`, le morceau App), et tout ce que
//  ces morceaux importent EN STATIQUE (`import … from "./x.js"` / `import "./x.js"`),
//  de proche en proche. Les `import("./x.js")` (à la demande) n'en font pas partie.
//
//  Rouge si :
//   P1 le JS initial compressé (gzip) dépasse le PLAFOND mesuré ;
//   P2 une grosse bibliothèque chargée à la demande revient dans le JS initial
//      (pdf-lib, three, maplibre, jsQR, qrcode-generator) — par le NOM du morceau
//      ET par une signature de son code (un morceau renommé ne passe pas) ;
//   P3 le morceau pdf-lib n'existe plus à part (la règle de vite.config.js s'est perdue) ;
//   P4 l'index ne précharge plus le morceau App (le démarrage léger du 8 nov.).
//
//  Lancer : npm run build && node scripts/bancs/poids-initial.cjs
//  `DIST=dossier` mesure un autre build (ex. celui d'origin/main, pour l'avant).
//  `POIDS_PLAFOND_KO=…` change le plafond (pour une mesure, jamais pour verdir).
//
//  Mesuré le 11 nov. : origin/main 1 267 Ko gzip (pdf-lib collé au morceau App) ;
//  après le lot 1 088 Ko. Plafond 1 190 Ko : la place de ~5 % de croissance des
//  autres lots, pas celle d'un pdf-lib (~182 Ko) revenu.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const DIST = process.env.DIST ? path.resolve(process.env.DIST) : path.join(__dirname, '..', '..', 'dist');
const PLAFOND_KO = Number(process.env.POIDS_PLAFOND_KO) || 1190;
const ko = (n) => Math.round(n / 1024);

let rouges = 0;
const verdict = (ok, nom, detail) => { console.log(`${ok ? '  ✓' : '  ✗'} ${nom}${detail ? ' — ' + detail : ''}`); if (!ok) rouges++; };

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const depart = new Set();
for (const m of html.matchAll(/<script[^>]*type="module"[^>]*src="\/([^"]+\.js)"/g)) depart.add(m[1]);
for (const m of html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="\/([^"]+\.js)"/g)) depart.add(m[1]);
const dataJs = /data-js="([^"]*)"/.exec(html);
const prechargeApp = dataJs ? dataJs[1].split(',').map((s) => s.replace(/^\//, '')).filter(Boolean) : [];
for (const f of prechargeApp) depart.add(f);

// fermeture par imports statiques
const initial = new Set();
const pile = [...depart];
while (pile.length) {
  const f = pile.pop();
  if (initial.has(f)) continue;
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { verdict(false, 'morceau introuvable', f); continue; }
  initial.add(f);
  const code = fs.readFileSync(p, 'utf8');
  const dir = path.posix.dirname(f);
  for (const m of code.matchAll(/(?:\bfrom\s*|\bimport\s*)["'](\.\.?\/[^"']+\.js)["']/g)) pile.push(path.posix.normalize(path.posix.join(dir, m[1])));
}

// Les grosses bibliothèques à la demande : nom du morceau + une signature de leur code
// (vérifiée le 11 nov. : présente dans la bibliothèque, absente du code de l'app).
const LOURDES = [
  { nom: 'pdf-lib', fichier: /(^|\/)pdf-lib-/, signature: 'ZapfDingbats' },
  { nom: 'three', fichier: /(^|\/)three\.module-/, signature: 'WebGLRenderer' },
  { nom: 'maplibre-gl', fichier: /(^|\/)maplibre-gl-/, signature: 'maplibregl' },
  { nom: 'jsQR', fichier: /(^|\/)jsQR-/, signature: 'binarize' },
  { nom: 'qrcode-generator', fichier: /(^|\/)qrcode-/, signature: 'illegal char at ' },
];

let gz = 0, br = 0, brut = 0;
const lignes = [];
for (const f of [...initial].sort()) {
  const b = fs.readFileSync(path.join(DIST, f));
  const g = zlib.gzipSync(b, { level: 9 }).length;
  const r = zlib.brotliCompressSync(b).length;
  gz += g; br += r; brut += b.length;
  lignes.push(`    ${f.padEnd(40)} ${String(ko(b.length)).padStart(6)} Ko · gzip ${String(ko(g)).padStart(5)} Ko · brotli ${String(ko(r)).padStart(5)} Ko`);
}
// la feuille de style que le démarrage précharge (pour le rapport, pas jugée ici)
let cssGz = 0;
const dataCss = /data-css="([^"]*)"/.exec(html);
for (const f of (dataCss ? dataCss[1].split(',') : []).map((s) => s.replace(/^\//, '')).filter(Boolean)) {
  const p = path.join(DIST, f); if (fs.existsSync(p)) cssGz += zlib.gzipSync(fs.readFileSync(p), { level: 9 }).length;
}

console.log(`JS initial (${DIST}) : ${initial.size} morceaux`);
console.log(lignes.join('\n'));
console.log(`  TOTAL ${ko(brut)} Ko · gzip ${ko(gz)} Ko · brotli ${ko(br)} Ko   (feuille de style préchargée : gzip ${ko(cssGz)} Ko, non jugée)`);

verdict(ko(gz) <= PLAFOND_KO, `P1 JS initial gzip ≤ ${PLAFOND_KO} Ko`, `${ko(gz)} Ko`);
for (const L of LOURDES) {
  const parNom = [...initial].filter((f) => L.fichier.test(f));
  const parCode = [...initial].filter((f) => fs.readFileSync(path.join(DIST, f), 'utf8').includes(L.signature));
  verdict(!parNom.length && !parCode.length, `P2 ${L.nom} hors du JS initial`, (parNom.concat(parCode)).length ? 'trouvé dans ' + [...new Set(parNom.concat(parCode))].join(', ') : '');
}
const assets = fs.readdirSync(path.join(DIST, 'assets'));
verdict(assets.some((f) => /^pdf-lib-.*\.js$/.test(f)), 'P3 pdf-lib dans son propre morceau');
verdict(prechargeApp.some((f) => /(^|\/)App-[^/]*\.js$/.test(f)), 'P4 index.html précharge le morceau App');

console.log(rouges ? `\n${rouges} rouge(s)` : '\ntout vert');
process.exit(rouges ? 1 : 0);
