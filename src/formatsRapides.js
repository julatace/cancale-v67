// ════════════════════════════════════════════════════════════════════════════
//  LES DATES ET LES NOMBRES MIS EN FORME SANS REFAIRE LE FORMATEUR (20 nov., chantier iphone-rapide —
//  docs/passation/2026-11-20-iphone-rapide.md).
//
//  Mesuré (banc iphone-rapide, profil CPU ×4) : `d.toLocaleDateString('fr-FR', { … })`, `toLocaleTimeString`,
//  `toLocaleString` et `n.toLocaleString('fr-FR', { … })` construisent À CHAQUE APPEL un formateur Intl complet (lecture
//  des données de la langue, du fuseau) — des milliers d'appels par écran (une date par ligne de vente, d'achat, de
//  colis) : 0,5 à 1 s de calcul au changement d'onglet (dateFr, jourDe, texteVerifie…). Ici, le formateur d'une
//  (langue, options) donnée est construit UNE fois et gardé.
//
//  Le RÉSULTAT est exactement celui du navigateur : la spécification définit ces méthodes comme « un formateur
//  Intl construit avec les options COMPLÉTÉES » (ECMA-402, ToDateTimeOptions : une date seule ⇒ année/mois/jour par
//  défaut ; une heure seule ⇒ heure/minute/seconde ; `toLocaleString` ⇒ les deux) — ce module complète les options de
//  la même façon avant de construire. Tout ce qui sort du cas courant passe par la méthode d'origine, telle quelle :
//  une date invalide (« Invalid Date »), `dateStyle`/`timeStyle`, des options qui ne sont pas un objet simple, une
//  erreur (un fuseau inconnu lève la MÊME erreur par la méthode d'origine). Contrôle : scripts/tests/formats-rapides.test.mjs.
// ════════════════════════════════════════════════════════════════════════════

const CHAMPS_DATE = ['weekday', 'year', 'month', 'day'];
const CHAMPS_HEURE = ['dayPeriod', 'hour', 'minute', 'second', 'fractionalSecondDigits'];
const MAX = 400;   // formateurs gardés au plus (une app en utilise quelques dizaines)

const simple = (o) => o === undefined || (o !== null && typeof o === 'object' && Object.getPrototypeOf(o) === Object.prototype);
const cleDe = (locales, options) => {
  if (!simple(options)) return null;
  if (!(locales === undefined || typeof locales === 'string' || (Array.isArray(locales) && locales.every((x) => typeof x === 'string')))) return null;
  if (options) for (const k of Object.keys(options)) { const v = options[k]; if (v !== undefined && typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') return null; }
  return JSON.stringify([locales === undefined ? null : locales, options || null]);
};

// ECMA-402 ToDateTimeOptions(options, required, defaults) — la partie qui compte ici.
function completer(options, requis, defauts) {
  const o = Object.assign({}, options || {});
  if (o.dateStyle !== undefined || o.timeStyle !== undefined) return null;   // laissé à la méthode d'origine
  let besoin = true;
  if (requis === 'date' || requis === 'any') for (const k of CHAMPS_DATE) if (o[k] !== undefined) besoin = false;
  if (requis === 'time' || requis === 'any') for (const k of CHAMPS_HEURE) if (o[k] !== undefined) besoin = false;
  if (besoin && (defauts === 'date' || defauts === 'all')) { o.year = 'numeric'; o.month = 'numeric'; o.day = 'numeric'; }
  if (besoin && (defauts === 'time' || defauts === 'all')) { o.hour = 'numeric'; o.minute = 'numeric'; o.second = 'numeric'; }
  return o;
}

export function poserFormatsRapides(racine = (typeof globalThis !== 'undefined' ? globalThis : null)) {
  if (!racine || !racine.Intl || !racine.Date || racine.__vrmFormatsRapides) return false;
  const I = racine.Intl, D = racine.Date.prototype, N = racine.Number.prototype;
  const cache = new Map();
  const garder = (cle, faire) => { let f = cache.get(cle); if (f === undefined) { f = faire(); if (cache.size >= MAX) cache.clear(); cache.set(cle, f); } return f; };
  const dateVers = (origine, requis, defauts, nom) => function (locales, options) {
    let t = NaN; try { t = D.getTime.call(this); } catch (_) { /* pas une date : la méthode d'origine dit l'erreur */ }
    const cle = arguments.length > 2 || !Number.isFinite(t) ? null : cleDe(locales, options);
    if (cle == null) return origine.apply(this, arguments);
    try {
      const f = garder(nom + cle, () => { const o = racine.__vrmFormatsMutation === 'sans-completer' ? Object.assign({}, options) : completer(options, requis, defauts); return o ? new I.DateTimeFormat(locales, o) : null; });
      if (f) return f.format(t);
    } catch (_) { /* la méthode d'origine dit la vraie erreur */ }
    return origine.apply(this, arguments);
  };
  const oDate = D.toLocaleDateString, oHeure = D.toLocaleTimeString, oTout = D.toLocaleString, oNombre = N.toLocaleString;
  D.toLocaleDateString = dateVers(oDate, 'date', 'date', 'd');
  D.toLocaleTimeString = dateVers(oHeure, 'time', 'time', 't');
  D.toLocaleString = dateVers(oTout, 'any', 'all', 'a');
  N.toLocaleString = function (locales, options) {
    const x = typeof this === 'number' ? this : (this instanceof racine.Number ? N.valueOf.call(this) : null);
    const cle = x == null || arguments.length > 2 ? null : cleDe(locales, options);
    if (cle == null) return oNombre.apply(this, arguments);
    try { const f = garder('n' + cle, () => new I.NumberFormat(locales, options)); return f.format(x); } catch (_) { /* idem */ }
    return oNombre.apply(this, arguments);
  };
  racine.__vrmFormatsRapides = { cache, origines: { oDate, oHeure, oTout, oNombre } };
  return true;
}
