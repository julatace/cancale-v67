// ════════════════════════════════════════════════════════════════════════════
//  LE FOND DE CARTE — OpenFreeMap, « positron » (clair) et « dark » (sombre)
//  21 octobre : « trouve autre chose pour la carte, il y a besoin d'une API
//  key » ⇒ OpenFreeMap (instance publique : « no registration, no user
//  database, no API keys, and no cookies », aucune limite de vues, usage
//  commercial permis — README de hyperknot/openfreemap). Tuiles VECTORIELLES :
//  MapLibre GL JS (BSD-3), chargé à la demande, jamais au démarrage.
//  22 octobre : « une carte plus professionnelle » ⇒ les deux styles SOBRES
//  d'OpenFreeMap (hyperknot/openfreemap-styles) : « positron » (gris clair,
//  sans points d'intérêt) et « dark » (Dark Matter). Presque aucune couleur :
//  la seule couleur d'accent de l'écran reste l'épingle de la personne (§7).
//  « liberty » (couleurs d'OpenStreetMap) est retiré.
//  UN seul fournisseur, UN seul domaine (tiles.openfreemap.org : style, tuiles,
//  polices, icônes) — c'est celui que la CSP prépare et que la politique de
//  confidentialité nomme. Aucun autre domaine n'est appelé pour le fond.
//  Noms des lieux EN FRANÇAIS quand la tuile porte `name:fr` (« Allemagne »,
//  pas « Germany ») ; sinon le nom d'origine du style, inchangé.
//  Attribution exigée (OpenFreeMap · © OpenMapTiles · © OpenStreetMap) : la
//  TileJSON du service la porte ; ce qui manquerait est ajouté, jamais doublé.
//  Repli : MapLibre absent, pas de WebGL, style ou TileJSON injoignables, ou
//  AUCUNE tuile arrivée à temps ⇒ l'appelant le sait (promesse rejetée) et ne
//  laisse jamais une carte grise (la communauté passe en liste). Une tuile
//  isolée en erreur, ou LENTE (relecture du 22 oct. : une tuile tenue faisait
//  tomber en liste, au bout de 12 s, une carte qui dessinait déjà le reste), ne
//  fait PAS tomber une carte qui dessine : le fond est « dessiné » dès qu'une
//  tuile est arrivée et que la carte s'est repeinte, sans attendre les autres.
// ════════════════════════════════════════════════════════════════════════════
export const FOURNISSEUR = {
  id: 'openfreemap',
  style: {
    clair: 'https://tiles.openfreemap.org/styles/positron',
    sombre: 'https://tiles.openfreemap.org/styles/dark',
  },
};
export const styleCarte = (sombre) => FOURNISSEUR.style[sombre ? 'sombre' : 'clair'];
// Ce que les licences exigent : [mot qui le reconnaît, mention à ajouter s'il manque].
export const ATTRIBUTIONS_EXIGEES = [
  ['OpenFreeMap', '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>'],
  ['OpenMapTiles', '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">&copy; OpenMapTiles</a>'],
  ['OpenStreetMap', 'Données <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">&copy; OpenStreetMap</a>'],
];
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

// Les mentions exigées que le texte déjà affiché (attributions des sources)
// ne porte pas — jamais deux fois la même.
export function attributionManquante(deja) {
  const t = String(deja || '');
  return ATTRIBUTIONS_EXIGEES.filter(([mot]) => !t.includes(mot)).map(([, html]) => html).join(' ');
}

// Une expression de texte qui affiche un NOM (name, name_en, name:latin…) est
// enveloppée : le nom français d'abord, s'il existe dans la tuile ; sinon
// l'expression d'origine, telle quelle. Les numéros de route (`ref`), eux, ne
// sont pas touchés.
const litUnNom = (e) => JSON.stringify(e).includes('"name');
export function enFrancais(style) {
  if (!style || !Array.isArray(style.layers)) return style;
  const layers = style.layers.map((l) => {
    const tf = l && l.layout && l.layout['text-field'];
    if (!Array.isArray(tf) || !litUnNom(tf)) return l;
    return { ...l, layout: { ...l.layout, 'text-field': ['coalesce', ['get', 'name:fr'], tf] } };
  });
  return { ...style, layers };
}

// Une carte de VILLES, pas un planétarium : projection plate, ni ciel ni relief.
export function aplatir(style) {
  const plat = { ...style, projection: { type: 'mercator' } };
  delete plat.sky; delete plat.terrain;
  return plat;
}

// Lit le style (délai borné), refuse une forme qui n'est pas un style.
export async function lireStyle(url, delaiMs = 8000) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(() => { try { ctl && ctl.abort(); } catch (_) {} }, delaiMs);
  try {
    const r = await fetch(url, { signal: ctl ? ctl.signal : undefined, credentials: 'omit' });
    if (!r.ok) throw new Error('style ' + r.status);
    const s = await r.json();
    if (!s || s.version !== 8 || !Array.isArray(s.layers) || !s.sources || typeof s.sources !== 'object') throw new Error('style illisible');
    return enFrancais(aplatir(s));
  } finally { clearTimeout(t); }
}

// L'attribution affichée par les sources du style (TileJSON chargée).
function attributionsDesSources(carte, style) {
  return Object.keys(style.sources || {}).map((k) => {
    try { const s = carte.getSource && carte.getSource(k); return String((s && s.attribution) || ''); } catch (_) { return ''; }
  }).join(' ');
}

// Pose le fond sur une carte MapLibre.
// « Dessiné » = au moins une tuile d'une source du style est ARRIVÉE, puis la
// carte s'est repeinte (`render`) ou s'est posée (`idle`). On n'attend PAS les
// autres tuiles : MapLibre n'émet `idle` qu'une fois TOUTES les tuiles visibles
// chargées et la carte immobile — une seule tuile lente, ou la personne qui
// glisse la carte, retenait la carte entière. Un `idle` ou un `render` sans
// aucune tuile ne prouve rien (ce serait une carte grise). Une source qui ne se
// charge pas (TileJSON injoignable) ⇒ échec tout de suite ; des tuiles en
// erreur sans qu'AUCUNE n'arrive ⇒ échec au premier `idle` ; au bout de
// `delaiMs`, une tuile arrivée (onglet en arrière-plan : pas de repeinte) ⇒
// dessiné, aucune ⇒ échec. Rend { id, attribution } (la mention à AJOUTER, ''
// si la source porte déjà tout) — l'appelant la pose donc dès que la carte
// dessine. `annule()` vrai ⇒ on s'arrête (écran fermé, thème changé).
export async function poserFond(carte, { sombre, annule = () => false, delaiMs = 12000, url = styleCarte(sombre) } = {}) {
  if (annule()) throw new Error('annule');
  const style = await lireStyle(url);
  if (annule()) throw new Error('annule');
  const sources = new Set(Object.keys(style.sources || {}));
  await new Promise((ok, ko) => {
    let fini = false, tuilesOk = 0, tuilesKo = 0;
    const fin = (e) => {
      if (fini) return; fini = true; clearTimeout(t);
      carte.off('error', surErreur); carte.off('idle', surIdle); carte.off('render', surRendu); carte.off('sourcedata', surDonnee);
      e ? ko(e) : ok();
    };
    const surDonnee = (e) => { if (e && e.tile && sources.has(e.sourceId)) tuilesOk++; };
    const surErreur = (e) => {
      if (!e || !sources.has(e.sourceId)) return; // police, icône : le fond tient sans
      if (e.tile) tuilesKo++; else fin(new Error('source'));
    };
    // Une tuile arrivée et la carte repeinte : elle DESSINE — les autres tuiles
    // (lentes, ou demandées par un glisser) suivent sans retenir le fond.
    const surRendu = () => {
      if (tuilesOk === 0) return;
      if (annule()) return fin(new Error('annule'));
      fin();
    };
    const surIdle = () => {
      if (annule()) return fin(new Error('annule'));
      if (tuilesOk > 0) fin();
      else if (tuilesKo > 0) fin(new Error('tuiles'));
    };
    const t = setTimeout(() => fin(annule() ? new Error('annule') : (tuilesOk > 0 ? undefined : new Error('delai'))), delaiMs);
    carte.on('sourcedata', surDonnee);
    carte.on('error', surErreur);
    carte.on('render', surRendu);
    carte.on('idle', surIdle);
    carte.setStyle(style, { diff: false });
  });
  if (annule()) throw new Error('annule');
  return { id: FOURNISSEUR.id, attribution: attributionManquante(attributionsDesSources(carte, style)) };
}
