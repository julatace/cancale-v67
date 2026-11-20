// Contrôle de src/comparaisonsRapides.js : le MÊME résultat que la méthode d'origine (signe), sur des mots, des N°,
// des accents, des casses ; et au moins 5× plus rapide sur un tri de 3 000 clés avec options. Rouge sans le module (B).
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = process.env.RACINE || path.join(ici, '..', '..');
const origine = String.prototype.localeCompare;
const mots = []; for (let i = 0; i < 3000; i++) mots.push(['B', 'b', 'é', 'e', 'Z', 'a', '10', '9', 'N°'][i % 9] + (i * 7919 % 1000) + ['', 'x', 'É'][i % 3]);
const opts = [['fr', { numeric: true }], ['fr', { sensitivity: 'base' }], ['fr', undefined], [undefined, { numeric: true }], ['en', {}]];
const ref = opts.map(([l, o]) => mots.slice(0, 400).map((a, i) => Math.sign(origine.call(a, mots[(i * 31) % 400], l, o))));
const t0 = performance.now(); [...mots].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })); const avant = performance.now() - t0;
const { poserComparaisonsRapides } = await import(path.join(racine, 'src', 'comparaisonsRapides.js')).catch(() => ({}));
let ok = 0, ko = 0; const dit = (c, m) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m); } };
dit(typeof poserComparaisonsRapides === 'function' && poserComparaisonsRapides(), 'A : le module se pose');
let diff = 0; opts.forEach(([l, o], j) => mots.slice(0, 400).forEach((a, i) => { if (Math.sign(a.localeCompare(mots[(i * 31) % 400], l, o)) !== ref[j][i]) diff++; }));
dit(diff === 0, `A : mêmes résultats que la méthode d’origine (${opts.length * 400} comparaisons, ${diff} différentes)`);
const t1 = performance.now(); [...mots].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })); const apres = performance.now() - t1;
dit(apres * 5 <= avant, `B : tri de 3 000 clés au moins 5× plus rapide (avant ${Math.round(avant)} ms, après ${Math.round(apres)} ms)`);
console.log(`\n${ko ? '❌' : '✅'} comparaisons-rapides : ${ok} verts, ${ko} rouges`); process.exit(ko ? 1 : 0);
