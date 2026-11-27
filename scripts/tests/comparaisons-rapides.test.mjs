// Contrôle de src/comparaisonsRapides.js : le MÊME résultat que la méthode d'origine (signe), sur des mots, des N°,
// des accents, des casses ; et au moins 5× plus rapide sur un tri de 3 000 clés avec options. Rouge sans le module (B).
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = process.env.RACINE || path.join(ici, '..', '..');
const origine = String.prototype.localeCompare;
const mots = []; for (let i = 0; i < 3000; i++) mots.push(['B', 'b', 'é', 'e', 'Z', 'a', '10', '9', 'N°'][i % 9] + (i * 7919 % 1000) + ['', 'x', 'É'][i % 3]);
const opts = [['fr', { numeric: true }], ['fr', { sensitivity: 'base' }], ['fr', undefined], [undefined, { numeric: true }], ['en', {}]];
const ref = opts.map(([l, o]) => mots.slice(0, 400).map((a, i) => Math.sign(origine.call(a, mots[(i * 31) % 400], l, o))));
// (27 nov.) Un seul chronométrage de chaque côté était à la merci de la charge de la machine (rouge 4 fois sur 6 sous
// une charge de 40 sur 4 cœurs, vert seul) : la mesure est maintenant ENTRELACÉE (avant, après, avant, après…) et on compare
// le MEILLEUR temps de chaque méthode — l'estimateur que le bruit ne fait que dégrader. Le seuil (5×) ne change pas.
const TOURS = 9;
const chrono = (cmp) => { const t = performance.now(); [...mots].sort(cmp); return performance.now() - t; };
const parOrigine = (a, b) => origine.call(a, b, 'fr', { numeric: true });
const parMethode = (a, b) => a.localeCompare(b, 'fr', { numeric: true });
const { poserComparaisonsRapides } = await import(path.join(racine, 'src', 'comparaisonsRapides.js')).catch(() => ({}));
let ok = 0, ko = 0; const dit = (c, m) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m); } };
dit(typeof poserComparaisonsRapides === 'function' && poserComparaisonsRapides(), 'A : le module se pose');
let diff = 0; opts.forEach(([l, o], j) => mots.slice(0, 400).forEach((a, i) => { if (Math.sign(a.localeCompare(mots[(i * 31) % 400], l, o)) !== ref[j][i]) diff++; }));
dit(diff === 0, `A : mêmes résultats que la méthode d’origine (${opts.length * 400} comparaisons, ${diff} différentes)`);
const tAvant = [], tApres = [];
for (let k = 0; k < TOURS; k++) { tAvant.push(chrono(parOrigine)); tApres.push(chrono(parMethode)); }
const avant = Math.min(...tAvant), apres = Math.min(...tApres);
dit(apres * 5 <= avant, `B : tri de 3 000 clés au moins 5× plus rapide (meilleur de ${TOURS} : avant ${Math.round(avant)} ms, après ${Math.round(apres)} ms)`);
console.log(`\n${ko ? '❌' : '✅'} comparaisons-rapides : ${ok} verts, ${ko} rouges`); process.exit(ko ? 1 : 0);
