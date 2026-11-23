// ════════════════════════════════════════════════════════════════════════════
//  `a.localeCompare(b, 'fr', { numeric: true })` SANS REFAIRE UN COMPARATEUR (20 nov., bugs-terrain —
//  docs/passation/2026-11-20-bugs-terrain.md). Même principe que src/formatsRapides.js (les dates).
//
//  ECMA-402 : `String.prototype.localeCompare(that, locales, options)` = `new Intl.Collator(locales, options).compare(S, that)`.
//  Avec des options, le moteur reconstruit ce comparateur À CHAQUE APPEL : un tri de 2 700 achats en fait ~30 000
//  (profil d'Achats au volume de sa base, processeur ×4 : `tri` des « pas en ligne », ~1 s). Ici le comparateur d'une
//  (langue, options) donnée est construit une fois et gardé. Sans langue ni options : la méthode d'origine, telle
//  quelle (rapide, et son résultat n'est pas celui d'un Collator dans tous les moteurs). Ce qui sort du cas courant
//  (options qui ne sont pas un objet simple, erreur) passe aussi par la méthode d'origine.
//  Contrôle : scripts/tests/comparaisons-rapides.test.mjs.
// ════════════════════════════════════════════════════════════════════════════
const MAX = 200;
const simple = (o) => o === undefined || (o !== null && typeof o === 'object' && Object.getPrototypeOf(o) === Object.prototype);
export function poserComparaisonsRapides(racine = (typeof globalThis !== 'undefined' ? globalThis : null)) {
  if (!racine || !racine.Intl || !racine.String || racine.__vrmComparaisonsRapides) return false;
  const S = racine.String.prototype, I = racine.Intl;
  const origine = S.localeCompare;
  const cache = new Map();
  S.localeCompare = function (that, locales, options) {
    if (arguments.length < 2 || arguments.length > 3 || (locales === undefined && options === undefined) || typeof this !== 'string' || !simple(options)
      || !(locales === undefined || typeof locales === 'string' || (Array.isArray(locales) && locales.every((x) => typeof x === 'string')))) return origine.apply(this, arguments);
    let cle;
    try {
      if (options) for (const k of Object.keys(options)) { const v = options[k]; if (v !== undefined && typeof v !== 'string' && typeof v !== 'boolean' && typeof v !== 'number') return origine.apply(this, arguments); }
      cle = JSON.stringify([locales === undefined ? null : locales, options || null]);
      let c = cache.get(cle);
      if (c === undefined) { c = new I.Collator(locales, options); if (cache.size >= MAX) cache.clear(); cache.set(cle, c); }
      return c.compare(this, String(that));
    } catch (_) { return origine.apply(this, arguments); }
  };
  racine.__vrmComparaisonsRapides = { cache, origine };
  return true;
}
