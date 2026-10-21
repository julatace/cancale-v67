// ════════════════════════════════════════════════════════════════════════════
//  LE FOND DE CARTE — VersaTiles « muted », secours OpenFreeMap (21 octobre)
//  Julien : « une autre carte, beaucoup plus professionnelle, fiable et de
//  qualité » — sans clé d'API, gratuite, usage commercial permis (§2.9).
//
//  1. VersaTiles (tiles.versatiles.org) : pile libre (code MIT, données
//     OpenStreetMap ODbL), « no API keys, no usage fees, does not track your
//     users » (dépôt versatiles-org/versatiles-website). Styles PRÉ-CONSTRUITS
//     de versatiles-org/versatiles-style 7.x, sources déjà résolues en adresses
//     absolues : « muted » (clair : sable doux, eau bleu pâle, verts sourds — le
//     rendu le plus proche d'Apple Plans) et « muted-dark » (un sombre COMPLET,
//     même couches que le clair). Limite publique : 200 requêtes/s par adresse
//     (nginx de versatiles-org/tiles.versatiles.org).
//  2. Secours, d'un AUTRE fournisseur : OpenFreeMap (tiles.openfreemap.org,
//     « no registration, no API keys, no cookies », aucune limite de vues —
//     dépôt hyperknot/openfreemap) : « positron » (clair) et « dark » (sombre,
//     « pas encore complet » selon ses auteurs : c'est un secours, pas le fond).
//  3. Les deux injoignables (ou pas de WebGL) ⇒ l'appelant passe en LISTE :
//     jamais une carte grise.
//  Attributions exigées : « © OpenStreetMap » (ODbL) et le fournisseur.
//  Ce module n'est chargé qu'à l'ouverture d'une carte (jamais au démarrage) :
//  MapLibre GL JS (BSD-3) est un morceau à part.
// ════════════════════════════════════════════════════════════════════════════
export const OSM_ATTR = '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>';
export const FOURNISSEURS = [
  {
    id: 'versatiles', nom: 'VersaTiles',
    style: { clair: 'https://tiles.versatiles.org/assets/styles/muted/style.json', sombre: 'https://tiles.versatiles.org/assets/styles/muted-dark/style.json' },
    attribution: '<a href="https://versatiles.org" target="_blank" rel="noopener">VersaTiles</a>',
  },
  {
    id: 'openfreemap', nom: 'OpenFreeMap',
    style: { clair: 'https://tiles.openfreemap.org/styles/positron', sombre: 'https://tiles.openfreemap.org/styles/dark' },
    attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>',
    exige: ['OpenMapTiles', '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a>'],
  },
];
export const styleCarte = (sombre, i = 0) => FOURNISSEURS[i].style[sombre ? 'sombre' : 'clair'];
export const ATTRIBUTION_TEXTE = 'VersaTiles · © OpenStreetMap (secours : OpenFreeMap · © OpenMapTiles)';

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

// WebGL absent ⇒ MapLibre ne peut rien dessiner : on le sait AVANT d'essayer.
export function webglDispo() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (_) { return false; }
}

export const mouvementReduit = () => {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; }
};

// L'attribution à afficher : le fournisseur, plus ce que les licences exigent
// et que les sources du style ne disent pas déjà (OpenStreetMap, OpenMapTiles) —
// jamais deux fois la même mention.
export function attributionPour(f, style) {
  const deja = Object.values((style && style.sources) || {}).map((x) => String((x && x.attribution) || '')).join(' ');
  const parts = [f.attribution];
  if (f.exige && !deja.includes(f.exige[0])) parts.push(f.exige[1]);
  if (!/OpenStreetMap/i.test(deja)) parts.push(OSM_ATTR);
  return parts.join(' ');
}

// Lit le style d'un fournisseur (délai borné) et le rend PLAT : projection
// mercator (pas de globe), sans ciel — une carte de ville, pas un planétarium.
export async function lireStyle(url, delaiMs = 8000) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(() => { try { ctl && ctl.abort(); } catch (_) {} }, delaiMs);
  try {
    const r = await fetch(url, { signal: ctl ? ctl.signal : undefined, credentials: 'omit' });
    if (!r.ok) throw new Error('style ' + r.status);
    const s = await r.json();
    if (!s || s.version !== 8 || !Array.isArray(s.layers) || !s.sources) throw new Error('style illisible');
    const plat = { ...s, projection: { type: 'mercator' } };
    delete plat.sky; delete plat.terrain;
    return plat;
  } finally { clearTimeout(t); }
}

// Pose le fond sur une carte MapLibre : premier fournisseur, puis le secours.
// « Dessiné » = l'évènement `idle` (style + tuiles du premier écran) arrivé sans
// erreur de source/tuile, en moins de `delaiMs`. Rend l'identifiant du
// fournisseur retenu ({ id, attribution }), ou rejette si aucun n'a pu dessiner (⇒ la liste).
// `annule()` vrai ⇒ on s'arrête (écran fermé, thème changé entre-temps).
export async function poserFond(carte, { sombre, annule = () => false, delaiMs = 10000, fournisseurs = FOURNISSEURS } = {}) {
  for (let i = 0; i < fournisseurs.length; i++) {
    if (annule()) throw new Error('annule');
    const f = fournisseurs[i];
    try {
      const style = await lireStyle(f.style[sombre ? 'sombre' : 'clair']);
      if (annule()) throw new Error('annule');
      await new Promise((ok, ko) => {
        let fini = false;
        const fin = (e) => { if (fini) return; fini = true; clearTimeout(t); carte.off('error', surErreur); carte.off('idle', surIdle); e ? ko(e) : ok(); };
        const surErreur = (e) => {
          if (!e) return;
          // une erreur de SOURCE de ce style (style, TileJSON, tuile) ; une police
          // ou une icône manquante ne fait pas tomber le fond.
          if (e.sourceId ? !!(carte.getSource && carte.getSource(e.sourceId)) : /style/i.test(String(e.error && e.error.message))) fin(new Error('tuiles'));
        };
        const surIdle = () => { if (carte.isStyleLoaded && carte.isStyleLoaded()) fin(); };
        const t = setTimeout(() => fin(new Error('delai')), delaiMs);
        carte.on('error', surErreur);
        carte.on('idle', surIdle);
        carte.setStyle(style, { diff: false });
      });
      return { id: f.id, attribution: attributionPour(f, style) };
    } catch (e) {
      if (String(e && e.message) === 'annule') throw e;
      // ce fournisseur ne répond pas : le suivant
    }
  }
  throw new Error('aucun fond');
}
