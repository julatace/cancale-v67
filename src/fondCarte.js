// ════════════════════════════════════════════════════════════════════════════
//  LE FOND DE CARTE — OpenFreeMap (21 octobre)
//  Julien : « trouve autre chose pour la carte, il y a besoin d'une API key ».
//  CARTO (basemaps.cartocdn.com) demande désormais une clé, et OpenStreetMap
//  (tile.openstreetmap.org) interdit l'usage applicatif lourd. OpenFreeMap :
//  instance publique gratuite, « no registration, no user database, no API
//  keys, and no cookies », usage commercial permis (FAQ « Is commercial usage
//  allowed? Yes. »), aucune limite de vues (README du dépôt hyperknot/openfreemap,
//  conditions du 14 octobre 2026). Tuiles VECTORIELLES : il faut MapLibre GL JS
//  (BSD-3), chargé à la demande, jamais au démarrage.
//  Styles : « liberty » (clair) et « dark » (sombre — documenté dans le README de
//  hyperknot/openfreemap-styles, pas encore sur leur page d'accueil).
//  Attribution exigée : OpenFreeMap · © OpenMapTiles · données OpenStreetMap.
//  Repli : MapLibre ou le style injoignable (ou pas de WebGL) ⇒ l'appelant le
//  sait (promesse rejetée / évènement d'erreur) et ne laisse jamais une carte
//  grise (la communauté passe en liste, la mini-carte garde ses épingles).
// ════════════════════════════════════════════════════════════════════════════
export const OFM_STYLE = {
  clair: 'https://tiles.openfreemap.org/styles/liberty',
  sombre: 'https://tiles.openfreemap.org/styles/dark',
};
export const styleCarte = (sombre) => (sombre ? OFM_STYLE.sombre : OFM_STYLE.clair);
export const ATTRIBUTION_CARTE = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">&copy; OpenMapTiles</a> Données <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
export const ATTRIBUTION_TEXTE = 'OpenFreeMap · © OpenMapTiles · © OpenStreetMap';

let promesseMl = null;
// MapLibre + sa feuille de style + son « worker » (module à part, servi par VRM).
export function chargerMaplibre() {
  if (promesseMl) return promesseMl;
  promesseMl = Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl.css'),
    import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
  ]).then(([m, , w]) => {
    const ml = (m && m.Map) ? m : (m && m.default);
    if (!ml || !ml.Map) throw new Error('vide');
    const url = w && (w.default || w);
    if (url && typeof ml.setWorkerUrl === 'function') ml.setWorkerUrl(url);
    return ml;
  }).catch((e) => { promesseMl = null; throw e; });
  return promesseMl;
}

let promessePlugin = null;
// Le calque MapLibre DANS une carte Leaflet (épingles, regroupement, clics
// restent du Leaflet). Le greffon importe « leaflet » et « maplibre-gl » : ce
// sont les mêmes modules que ceux déjà chargés.
export function chargerCalqueMaplibre() {
  if (promessePlugin) return promessePlugin;
  promessePlugin = chargerMaplibre()
    .then(() => import('@maplibre/maplibre-gl-leaflet'))
    .then((p) => {
      const f = p.maplibreGL || (p.default && p.default.maplibreGL);
      if (typeof f !== 'function') throw new Error('greffon');
      return f;
    }).catch((e) => { promessePlugin = null; throw e; });
  return promessePlugin;
}

// WebGL absent ⇒ MapLibre ne peut rien dessiner : on le sait AVANT d'essayer.
export function webglDispo() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (_) { return false; }
}
