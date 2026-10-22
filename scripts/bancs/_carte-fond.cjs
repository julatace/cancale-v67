// ════════════════════════════════════════════════════════════════════════════
//  LE FOND DE CARTE DU BANC — jamais le réseau réel de la carte (§6.3 : la
//  vraie FORME, servie par le banc).
//  · Les styles sont les VRAIS styles d'OpenFreeMap « positron » et « dark »
//    (dépôt hyperknot/openfreemap-styles, commit épinglé ci-dessous), avec
//    `__TILEJSON_DOMAIN__` remplacé comme le fait le service
//    (tiles.openfreemap.org). Rien n'en est retouché : c'est ce que l'app lit.
//  · La TileJSON (/planet) porte l'attribution EXACTE que le README
//    d'OpenFreeMap exige (OpenFreeMap · © OpenMapTiles · OpenStreetMap).
//  · Les tuiles sont de VRAIES tuiles vectorielles au schéma OpenMapTiles
//    (water, boundary, place), fabriquées à la volée depuis Natural Earth
//    (world-atlas 50m, ISC) par geojson-vt + vt-pbf. Les lieux portent
//    `name`, `name_en`, `name:latin` ET `name:fr` (« Deutschland », « Germany »,
//    « Allemagne ») : la règle des noms en français se voit à l'écran.
//  · Polices : les glyphes « Noto Sans » de protomaps/basemaps-assets (commit
//    épinglé) — « Noto Sans Bold » n'y existe pas, le banc sert « Medium » à la
//    place (au banc seulement). Icônes (sprites) : non servies, ce que le fond
//    tolère (une icône manquante ne fait pas tomber la carte).
//  Tout est téléchargé UNE fois dans un dossier temporaire (curl, qui suit le
//  relais réseau du conteneur ; npm pour les paquets). Hors ligne ⇒ `pret:false`
//  et le banc le DIT (il ne peut alors pas juger le rendu réel).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync } = require('child_process');
const PAQUETS = ['world-atlas@2.0.2', 'geojson-vt@4.0.2', 'vt-pbf@3.1.3', 'topojson-client@3.1.0', '@mapbox/geojson-rewind@0.5.2'];
const DOSSIER = process.env.BANC_CARTE_DIR || path.join(os.tmpdir(), 'vrm-carte-banc-v2');
const STYLES_SHA = '6e5361286c3e1eac7b7c89800ff63218297b5cfd'; // hyperknot/openfreemap-styles
const POLICES_SHA = '028c18f713baecad011301ff7a69acc39bcc2ae7'; // protomaps/basemaps-assets
const DOMAINE = 'tiles.openfreemap.org';
const ATTRIBUTION_OFM = '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';
const POLICE_DE = { 'Noto Sans Regular': 'Noto Sans Regular', 'Noto Sans Italic': 'Noto Sans Italic', 'Noto Sans Bold': 'Noto Sans Medium' };

const telecharger = (url, dest) => {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return true;
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    execFileSync('curl', ['-sS', '-f', '-L', '-m', '30', '-o', dest + '.part', url], { stdio: 'ignore' });
    fs.renameSync(dest + '.part', dest);
    return true;
  } catch (_) { try { fs.unlinkSync(dest + '.part'); } catch (__) {} return false; }
};

function installer() {
  const nm = path.join(DOSSIER, 'node_modules');
  if (fs.existsSync(path.join(nm, 'world-atlas')) && fs.existsSync(path.join(nm, 'vt-pbf'))) return nm;
  try {
    fs.mkdirSync(DOSSIER, { recursive: true });
    if (!fs.existsSync(path.join(DOSSIER, 'package.json'))) fs.writeFileSync(path.join(DOSSIER, 'package.json'), '{"name":"vrm-carte-banc","private":true}');
    execFileSync('npm', ['install', '--no-audit', '--no-fund', '--silent', ...PAQUETS], { cwd: DOSSIER, stdio: 'ignore', timeout: 180000 });
  } catch (_) {}
  return fs.existsSync(path.join(nm, 'vt-pbf')) ? nm : null;
}

// Les lieux servis : villes (classe, rang, capitale) et pays (code ISO).
const LIEUX = [
  // [nom local, nom anglais, nom français, lon, lat, classe, rang, capitale, iso]
  ['Paris', 'Paris', 'Paris', 2.35, 48.85, 'city', 1, 2],
  ['Lyon', 'Lyon', 'Lyon', 4.85, 45.76, 'city', 2],
  ['Marseille', 'Marseille', 'Marseille', 5.37, 43.3, 'city', 2],
  ['Nantes', 'Nantes', 'Nantes', -1.55, 47.22, 'city', 3],
  ['Bordeaux', 'Bordeaux', 'Bordeaux', -0.58, 44.84, 'city', 3],
  ['Rennes', 'Rennes', 'Rennes', -1.68, 48.11, 'city', 4],
  ['Saint-Malo', 'Saint-Malo', 'Saint-Malo', -2.0, 48.65, 'town', 8],
  ['Cancale', 'Cancale', 'Cancale', -1.85, 48.68, 'town', 10],
  ['London', 'London', 'Londres', -0.12, 51.5, 'city', 1, 2],
  ['France', 'France', 'France', 2.4, 46.6, 'country', 1, 0, 'FR'],
  ['Deutschland', 'Germany', 'Allemagne', 10.4, 51.1, 'country', 1, 0, 'DE'],
  ['España', 'Spain', 'Espagne', -3.6, 40.3, 'country', 1, 0, 'ES'],
  ['Italia', 'Italy', 'Italie', 12.5, 42.8, 'country', 1, 0, 'IT'],
  ['United Kingdom', 'United Kingdom', 'Royaume-Uni', -1.8, 52.7, 'country', 1, 0, 'GB'],
  ['Schweiz', 'Switzerland', 'Suisse', 8.2, 46.8, 'country', 2, 0, 'CH'],
];

async function fixtureCarte() {
  const minimal = (sombre) => ({ version: 8, sources: {}, layers: [{ id: 'fond', type: 'background', paint: { 'background-color': sombre ? '#222' : '#eee' } }] });
  const nm = installer();
  const styles = {};
  for (const s of ['positron', 'dark']) {
    const f = path.join(DOSSIER, 'styles', STYLES_SHA, s + '.json');
    if (telecharger(`https://raw.githubusercontent.com/hyperknot/openfreemap-styles/${STYLES_SHA}/styles/${s}/style.json`, f)) {
      try { styles[s] = JSON.parse(fs.readFileSync(f, 'utf8').split('__TILEJSON_DOMAIN__').join(DOMAINE)); } catch (_) {}
    }
  }
  // Glyphes : 0-255 (latin, accents français, « ») et 256-511 (Œ, ł…).
  const glyphes = {};
  for (const [demande, servie] of Object.entries(POLICE_DE)) for (const r of ['0-255', '256-511']) {
    const f = path.join(DOSSIER, 'polices', POLICES_SHA, servie, r + '.pbf');
    if (telecharger(`https://raw.githubusercontent.com/protomaps/basemaps-assets/${POLICES_SHA}/fonts/${encodeURIComponent(servie)}/${r}.pbf`, f)) glyphes[demande + '/' + r] = fs.readFileSync(f);
  }
  if (!nm || !styles.positron || !styles.dark) return { pret: false, style: (sombre) => minimal(sombre), tilejson: () => null, tuile: () => null, glyphe: () => null };
  const req = (m) => require(path.join(nm, m));
  const d = (m) => (m && m.default) || m;
  const topo = req('topojson-client'), geojsonvt = d(await import('file://' + path.join(nm, 'geojson-vt', 'src', 'index.js'))), vtpbf = req('vt-pbf'), rewind = d(req('@mapbox/geojson-rewind'));
  const atlas = JSON.parse(fs.readFileSync(path.join(nm, 'world-atlas', 'countries-50m.json'), 'utf8'));
  const terre = topo.feature(atlas, atlas.objects.land);
  const frontieres = topo.mesh(atlas, atlas.objects.countries, (a, b) => a !== b);
  const anneaux = [];
  for (const f of (terre.type === 'FeatureCollection' ? terre.features : [terre])) {
    const g = f.geometry; const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const p of polys) anneaux.push(p[0]);
  }
  const ocean = rewind({ type: 'Feature', properties: { class: 'ocean' }, geometry: { type: 'Polygon', coordinates: [[[-180, -85.05], [180, -85.05], [180, 85.05], [-180, 85.05], [-180, -85.05]], ...anneaux] } });
  const lieux = LIEUX.map(([n, en, fr, x, y, cls, rank, capital, iso]) => {
    const p = { name: n, name_en: en, 'name:latin': n, 'name:fr': fr, class: cls, rank };
    if (capital) p.capital = capital;
    if (iso) p.iso_a2 = iso;
    return { type: 'Feature', properties: p, geometry: { type: 'Point', coordinates: [x, y] } };
  });
  const opt = { maxZoom: 12, indexMaxZoom: 4, tolerance: 2, extent: 4096, buffer: 64 };
  const couches = {
    water: geojsonvt({ type: 'FeatureCollection', features: [ocean] }, opt),
    boundary: geojsonvt({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { admin_level: 2, maritime: 0, disputed: 0 }, geometry: frontieres }] }, opt),
    place: geojsonvt({ type: 'FeatureCollection', features: lieux }, opt),
  };
  const tuile = (z, x, y) => {
    const l = {};
    for (const n of Object.keys(couches)) { const t = couches[n].getTile(z, x, y); if (t) l[n] = t; }
    return Object.keys(l).length ? Buffer.from(vtpbf.fromGeojsonVt(l, { version: 2, extent: 4096 })) : Buffer.alloc(0);
  };
  const tilejson = () => ({ tilejson: '3.0.0', name: 'OpenFreeMap (banc)', attribution: ATTRIBUTION_OFM, minzoom: 0, maxzoom: 14,
    tiles: [`https://${DOMAINE}/planet/banc/{z}/{x}/{y}.pbf`],
    vector_layers: Object.keys(couches).map((id) => ({ id, fields: {} })) });
  const glyphe = (pile, plage) => glyphes[String(pile).split(',')[0].trim() + '/' + plage] || null;
  return { pret: true, style: (sombre) => JSON.parse(JSON.stringify(styles[sombre ? 'dark' : 'positron'])), tilejson, tuile, glyphe, attribution: ATTRIBUTION_OFM };
}
module.exports = { fixtureCarte, ATTRIBUTION_OFM, STYLES_SHA };
