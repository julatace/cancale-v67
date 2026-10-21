// ════════════════════════════════════════════════════════════════════════════
//  LE FOND DE CARTE DU BANC — jamais le réseau réel (§6.3 : la vraie FORME).
//  · Les styles VersaTiles « muted » / « muted-dark » sont FABRIQUÉS par la
//    vraie bibliothèque @versatiles/style 7.0.1 (MIT) — les mêmes 257 couches
//    que tiles.versatiles.org sert — puis rendus « autonomes » comme ses styles
//    pré-construits (tuiles en adresse absolue, attribution OSM).
//  · Les tuiles sont de VRAIES tuiles vectorielles (schéma Shortbread : ocean,
//    boundaries, place_labels), fabriquées à la volée depuis Natural Earth
//    (world-atlas 50m, ISC) par geojson-vt + vt-pbf. Les mêmes tuiles servent
//    le secours OpenFreeMap (couches OpenMapTiles : water, boundary).
//  · Polices et icônes : non servies (le banc les refuse) — les noms de villes
//    ne s'affichent donc pas au banc ; le fond, l'eau et les frontières, si.
//  Les paquets s'installent une fois dans le dossier temporaire (comme Leaflet
//  avant). Hors ligne ⇒ `pret:false` et un style minimal (le banc le dit).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync } = require('child_process');
const PAQUETS = ['@versatiles/style@7.0.1', 'world-atlas@2.0.2', 'geojson-vt@4.0.2', 'vt-pbf@3.1.3', 'topojson-client@3.1.0', '@mapbox/geojson-rewind@0.5.2'];
const DOSSIER = process.env.BANC_CARTE_DIR || path.join(os.tmpdir(), 'vrm-carte-banc-v1');

function installer() {
  const nm = path.join(DOSSIER, 'node_modules');
  if (fs.existsSync(path.join(nm, '@versatiles', 'style')) && fs.existsSync(path.join(nm, 'vt-pbf'))) return nm;
  try {
    fs.mkdirSync(DOSSIER, { recursive: true });
    if (!fs.existsSync(path.join(DOSSIER, 'package.json'))) fs.writeFileSync(path.join(DOSSIER, 'package.json'), '{"name":"vrm-carte-banc","private":true}');
    execFileSync('npm', ['install', '--no-audit', '--no-fund', '--silent', ...PAQUETS], { cwd: DOSSIER, stdio: 'ignore', timeout: 180000 });
  } catch (_) {}
  return fs.existsSync(path.join(nm, 'vt-pbf')) ? nm : null;
}

const VILLES = [['Paris', 2.35, 48.85, 'capital'], ['Rennes', -1.68, 48.11, 'city'], ['Lyon', 4.85, 45.76, 'city'], ['Nantes', -1.55, 47.22, 'city'],
  ['Marseille', 5.37, 43.3, 'city'], ['Bordeaux', -0.58, 44.84, 'city'], ['Saint-Malo', -2.0, 48.65, 'town'], ['Cancale', -1.85, 48.68, 'town']];

async function fixtureCarte() {
  const nm = installer();
  const minimal = (fond) => ({ version: 8, sources: {}, layers: [{ id: 'fond', type: 'background', paint: { 'background-color': fond } }] });
  if (!nm) return { pret: false, style: (id, sombre) => minimal(sombre ? '#222' : '#eee'), tuile: () => null };
  const req = (m) => require(path.join(nm, m));
  const vs = await import('file://' + path.join(nm, '@versatiles', 'style', 'dist', 'index.js')).catch(() => import(path.join(nm, '@versatiles', 'style')));
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
  const ocean = rewind({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85.05], [180, -85.05], [180, 85.05], [-180, 85.05], [-180, -85.05]], ...anneaux] } });
  const ligne = (props) => ({ type: 'Feature', properties: props, geometry: frontieres });
  const villes = VILLES.map(([n, x, y, k]) => ({ type: 'Feature', properties: { name: n, name_fr: n, name_en: n, kind: k, population: 100000, class: k === 'town' ? 'town' : 'city', rank: 1 }, geometry: { type: 'Point', coordinates: [x, y] } }));
  const opt = { maxZoom: 12, indexMaxZoom: 4, tolerance: 2, extent: 4096, buffer: 64 };
  const couches = {
    ocean: geojsonvt({ type: 'FeatureCollection', features: [ocean] }, opt),
    boundaries: geojsonvt({ type: 'FeatureCollection', features: [ligne({ admin_level: 2, maritime: false, disputed: false })] }, opt),
    place_labels: geojsonvt({ type: 'FeatureCollection', features: villes }, opt),
    boundary: geojsonvt({ type: 'FeatureCollection', features: [ligne({ admin_level: 2, maritime: 0, disputed: 0 })] }, opt),
    place: geojsonvt({ type: 'FeatureCollection', features: villes }, opt),
  };
  const shortbread = ['ocean', 'boundaries', 'place_labels'], omt = ['ocean', 'boundary', 'place'];
  const tuile = (schema, z, x, y) => {
    const noms = schema === 'omt' ? omt : shortbread, l = {};
    for (const n of noms) { const t = couches[n].getTile(z, x, y); if (t) l[n === 'ocean' && schema === 'omt' ? 'water' : n] = t; }
    return Object.keys(l).length ? Buffer.from(vtpbf.fromGeojsonVt(l, { version: 2, extent: 4096 })) : Buffer.alloc(0);
  };
  const versatiles = (sombre) => {
    const s = vs.osm({ theme: sombre ? 'muted-dark' : 'muted' });
    for (const k of Object.keys(s.sources)) s.sources[k] = { type: 'vector', tiles: ['https://tiles.versatiles.org/tiles/osm/{z}/{x}/{y}'], minzoom: 0, maxzoom: 14, attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>' };
    return s;
  };
  const ofm = (sombre) => ({ version: 8, name: sombre ? 'dark' : 'positron', glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { openmaptiles: { type: 'vector', tiles: ['https://tiles.openfreemap.org/planet/banc/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14, attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> © OpenMapTiles Data from OpenStreetMap' } },
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': sombre ? '#0e0e0e' : '#f2f3f0' } },
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': sombre ? '#0a1a2a' : '#c2c8ca' } },
      { id: 'boundary', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary', paint: { 'line-color': '#9e9cab', 'line-width': 1 } }] });
  return { pret: true, style: (id, sombre) => (id === 'versatiles' ? versatiles(sombre) : ofm(sombre)), tuile };
}
module.exports = { fixtureCarte };
