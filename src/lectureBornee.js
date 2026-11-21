// ════════════════════════════════════════════════════════════════════════════
//  UNE LECTURE DE LA BASE FINIT TOUJOURS (21 nov., fluidité — Julien : « les écrans de chargement c'est n'importe quoi,
//  ça charge dans le vide » ; captures iPhone : Annonces en squelette, Achats « Je lis tes colis… » qui restent).
//
//  Mesuré (banc couches-chargement, `PENDRE='id=eq\.lbc_ventes'` : une lecture qui ne répond jamais, le réseau du
//  téléphone qui se perd) : Annonces restait en squelette et Ma journée disait « lecture… » POUR TOUJOURS — une requête
//  `fetch` sans délai n'échoue jamais d'elle-même, et chaque écran l'attendait.
//
//  La règle, posée UNE fois sur `window.fetch` (comme les autres gardes, src/porteHorsLigne.js) : une LECTURE (GET/HEAD)
//  de la base (`<SUPABASE_URL>/rest/v1/…`) qui n'a pas de signal à elle est abandonnée après `BORNE_LECTURE_BASE_MS`.
//  Elle échoue alors comme une coupure (AbortError) : chaque lecteur la traite déjà en « pas su » (« — » avec la
//  raison, « Réessayer »), jamais en « rien ». Rien d'autre n'est touché : une écriture, une route /api, un fichier, une
//  lecture qui porte son propre signal (elle a sa règle) passent tels quels.
// ════════════════════════════════════════════════════════════════════════════
export const BORNE_LECTURE_BASE_MS = 15000;   // jusqu’aux en-têtes : la base les envoie en moins de 2 s, même pour un gros corps

const methodeDe = (input, init) => String((init && init.method) || (input && typeof input === 'object' && input.method) || 'GET').toUpperCase();
const adresseDe = (input) => { try { return typeof input === 'string' ? input : (input && input.url) || String(input || ''); } catch (_) { return ''; } };

export function creerLectureBornee(fetchOrig, base, { borneMs = BORNE_LECTURE_BASE_MS, minuteur = setTimeout, annuler = clearTimeout } = {}) {
  const prefixe = String(base || '').replace(/\/+$/, '') + '/rest/v1/';
  return function (input, init) {
    let m = 'GET';
    try { m = methodeDe(input, init); } catch (_) {}
    const url = adresseDe(input);
    const aSignal = !!((init && init.signal) || (input && typeof input === 'object' && input.signal));
    if (!base || (m !== 'GET' && m !== 'HEAD') || !url.startsWith(prefixe) || aSignal || typeof AbortController === 'undefined') return fetchOrig(input, init);
    const ctrl = new AbortController();
    const t = minuteur(() => { try { ctrl.abort(); } catch (_) {} }, borneMs);
    let p;
    try { p = fetchOrig(input, { ...(init || {}), signal: ctrl.signal }); } catch (e) { annuler(t); throw e; }
    // La borne vaut jusqu'aux EN-TÊTES : un corps long qui arrive (gros envoi au téléphone) n'est pas coupé en route.
    return Promise.resolve(p).then((r) => { annuler(t); return r; }, (e) => { annuler(t); throw e; });
  };
}

export function installerLectureBornee(base) {
  try {
    if (typeof window === 'undefined' || window.__vrmLectureBornee || typeof window.fetch !== 'function') return;
    window.fetch = creerLectureBornee(window.fetch.bind(window), base);
    window.__vrmLectureBornee = true;
  } catch (_) {}
}
