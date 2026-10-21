// AUDIT « FOND DE CARTE SANS CLÉ » (21 octobre)
// Julien : « trouve autre chose pour la carte, il y a besoin d'une API key ».
// CARTO (basemaps.cartocdn.com) exige une clé ; OpenStreetMap
// (tile.openstreetmap.org) interdit l'usage applicatif lourd. Le fond est
// OpenFreeMap (sans clé, sans inscription, usage commercial permis), dessiné
// par MapLibre chargé À LA DEMANDE. Ce contrôle porte la règle sur le CODE
// (les commentaires sont retirés d'abord : ils citent l'ancien fond) :
//   1. aucune adresse de tuiles CARTO ni tile.openstreetmap.org dans src/ ;
//   2. les styles sont ceux d'OpenFreeMap (liberty en clair, dark en sombre)
//      avec l'attribution exigée (OpenFreeMap · OpenMapTiles · OpenStreetMap) ;
//   3. MapLibre n'est jamais importé au démarrage (import statique interdit
//      ailleurs que dans src/fondCarte.js, lui-même chargé à la demande par
//      App.jsx) ; et, si dist/ existe, aucun morceau chargé par index.html ne
//      le contient.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const fichiers = [];
(function marche(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) marche(p); else if (/\.(jsx?|css|html)$/.test(f)) fichiers.push(p); } })(path.join(R, 'src'));
fichiers.push(path.join(R, 'index.html'));
const fautifs = [];
for (const f of fichiers) {
  const t = sansCommentaires(fs.readFileSync(f, 'utf8'));
  t.split('\n').forEach((l, i) => { if (/cartocdn\.com|tile\.openstreetmap\.org/.test(l)) fautifs.push(path.relative(R, f) + ':' + (i + 1)); });
}
dit(fautifs.length === 0, 'aucune adresse de tuiles CARTO ni tile.openstreetmap.org dans le code de l’app', fautifs.slice(0, 4).join(' '));

const fond = path.join(R, 'src', 'fondCarte.js');
const tf = fs.existsSync(fond) ? fs.readFileSync(fond, 'utf8') : '';
dit(/https:\/\/tiles\.openfreemap\.org\/styles\/liberty/.test(tf) && /https:\/\/tiles\.openfreemap\.org\/styles\/dark/.test(tf), 'les styles sont ceux d’OpenFreeMap (liberty clair, dark sombre)');
dit(/openfreemap\.org/.test(tf) && /OpenMapTiles/.test(tf) && /openstreetmap\.org\/copyright/.test(tf), 'l’attribution exigée est portée (OpenFreeMap · OpenMapTiles · OpenStreetMap)');

const statiques = [];
for (const f of fichiers) {
  if (f === fond) continue;
  const t = sansCommentaires(fs.readFileSync(f, 'utf8'));
  if (/^\s*import\s[^(]*from\s*['"](maplibre-gl|@maplibre\/maplibre-gl-leaflet)['"]/m.test(t)) statiques.push(path.relative(R, f));
}
dit(statiques.length === 0, 'MapLibre n’est importé statiquement nulle part (chargé à la demande)', statiques.join(' '));
const app = sansCommentaires(fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8'));
dit(!/^\s*import\s[^(]*from\s*['"]\.\/fondCarte\.js['"]/m.test(app), 'App.jsx charge src/fondCarte.js à la demande (jamais au démarrage)');

const dist = path.join(R, 'dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  const lourds = refs.filter((r) => { try { return /maplibre|tiles\.openfreemap/.test(fs.readFileSync(path.join(dist, r), 'utf8')); } catch (_) { return false; } });
  dit(refs.length > 0 && lourds.length === 0, 'aucun morceau chargé au démarrage ne contient MapLibre', lourds.join(' '));
} else console.log('(dist/ absent : le contrôle du build est sauté)');
console.log(ko ? `\n${ko} contrôle(s) rouge(s).` : '\nLe fond de carte est sans clé, et chargé à la demande.');
process.exit(ko ? 1 : 0);
