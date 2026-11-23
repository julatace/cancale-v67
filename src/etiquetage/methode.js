// ── LA MÉTHODE D'ÉTIQUETAGE (19 nov. 2026, lot stock-etiquetage) ─────────────────────────────
// Julien : « À la création du compte, et même après, qu'on puisse choisir la méthode d'étiquetage que l'on veut. »
//
// UNE méthode = quatre choix, chacun rangé dans SA clé (rien de neuf quand une clé existe déjà) :
//   qui      'vrm' (VRM numérote) | 'moi' (je numérote moi-même)   ⇒ `vrm_numero_ecrit` { actif } (src/numeroEcrit.js),
//            le MÊME réglage que Paramètres → Numéros et que l'extension (`numerotes`, 5.382 : « je numérote moi-même »
//            ⇒ l'app DEMANDE le N° de chaque nouvel article) ;
//   serie    'chiffres' (1, 2, 3…) | 'lettre' (C1, C2…)            ⇒ `vrm_num_prefixe` (la lettre, '' = chiffres) ;
//   support  'main' (écrite à la main) | 'imprimee'                 ⇒ `vrm_etiquetage` { support, format } (neuve) ;
//   format   le papier d'une étiquette imprimée (FORMATS).
//
// ⚠️ CLAUDE.md §5 — CE MODULE NE TOUCHE AUCUN NUMÉRO. Il n'écrit QUE ces trois clés, et seulement ce qui CHANGE.
// La série ne vaut que pour les PROCHAINS numéros (un N° donné est écrit sur un carton : il ne bouge jamais, rien
// n'est réattribué, le pool reste tel quel). La lettre des anciens numéros (archive de la migration 013) est REFUSÉE
// (« B12 » désignerait deux paires) : rien n'est écrit et la raison est rendue. « Je numérote moi-même » ne donne
// plus aucun N° tout seul ; repasser à « VRM numérote » ne renumérote rien non plus.
// Aucune lecture, aucun drapeau du navigateur : JS pur (scripts/audit-stock-etiquetage.cjs l'EXÉCUTE).

export const CLE_ETIQUETAGE = 'vrm_etiquetage';
export const CLE_PREFIXE = 'vrm_num_prefixe';
export const CLE_QUI = 'vrm_numero_ecrit';
// Les seules clés que ce module peut écrire (l'audit le vérifie, mutation comprise).
export const CLES_METHODE = Object.freeze([CLE_QUI, CLE_PREFIXE, CLE_ETIQUETAGE]);

export const QUI = ['vrm', 'moi'];
export const SERIES = ['chiffres', 'lettre'];
export const SUPPORTS = ['main', 'imprimee'];
// Les papiers : une étiquette thermique 50 × 30 mm, une 62 × 29 mm (rouleau continu), une planche A4 de 24 (3 × 8).
// Aucun QR (refusé par Julien le 11 oct.) : le N° en grand, rien d'autre que ce qu'il choisit d'ajouter.
export const FORMATS = Object.freeze([
  { v: '50x30', l: 50, h: 30, planche: false },
  { v: '62x29', l: 62, h: 29, planche: false },
  { v: 'a4-24', l: 70, h: 37, planche: true, cols: 3, rangs: 8 },
]);
export const FORMAT_DEFAUT = '50x30';
const estObjet = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

// La lettre d'une série, nettoyée comme Paramètres la nettoie (majuscules, 1 à 3 lettres).
export const lettreDe = (v) => String(v == null ? '' : v).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);

// `vrm_etiquetage` lu TOLÉRANT : une valeur inconnue = pas choisie (null), jamais devinée.
export function lireEtiquetage(brut) {
  const o = estObjet(brut) ? brut : {};
  return {
    support: SUPPORTS.includes(o.support) ? o.support : null,
    format: FORMATS.some((f) => f.v === o.format) ? o.format : FORMAT_DEFAUT,
    titre: o.titre === true,
    at: typeof o.at === 'string' ? o.at : null,
  };
}
export const formatDe = (v) => FORMATS.find((f) => f.v === v) || FORMATS[0];

// La méthode telle qu'ENREGISTRÉE. `numeroEcrit` (brut), `prefixe` (brut), `etiquetage` (brut).
// `qui` vaut null tant que le vendeur n'a jamais choisi (même règle que src/configurationDepart.js).
export function methodeDe({ numeroEcrit = null, prefixe = '', etiquetage = null } = {}) {
  const ne = estObjet(numeroEcrit) ? numeroEcrit : null;
  const choisi = !!(ne && (typeof ne.depuis === 'string' || typeof ne.choisi === 'string'));
  const actif = !!(ne && ne.actif === true);
  const lettre = lettreDe(prefixe);
  const e = lireEtiquetage(etiquetage);
  return { qui: actif ? 'moi' : (choisi ? 'vrm' : null), serie: lettre ? 'lettre' : 'chiffres', lettre, support: e.support, format: e.format, titre: e.titre };
}

// LES ÉCRITURES d'un choix, par rapport à ce qui est enregistré (`avant`, les mêmes trois valeurs brutes).
// `choix` : { qui, serie, lettre, support, format, titre } — un champ absent (undefined) n'est pas touché.
// `archive` : la lettre des anciens numéros (refusée). `at` : la date ISO du geste.
// Rend { ecritures: [{ cle, valeur }], refus: null | 'archive' | 'lettreVide' }. Un refus n'écrit RIEN de la série
// (le reste du choix, s'il est valide, s'écrit) ; une série « lettre » sans lettre tapée n'écrit rien (Paramètres :
// « Avec une lettre » n'enregistre rien tout seul, la lettre se TAPE).
export function ecrituresMethode(avant = {}, choix = {}, { archive = '', at = new Date().toISOString() } = {}) {
  const out = [];
  let refus = null;
  const m = methodeDe(avant);
  const ne = estObjet(avant.numeroEcrit) ? avant.numeroEcrit : null;
  // 1. Qui numérote : `vrm_numero_ecrit`, seulement s'il change (ou n'a jamais été choisi). Les endroits gardés.
  if (QUI.includes(choix.qui) && (choix.qui !== m.qui)) {
    const actif = choix.qui === 'moi';
    const ou = ne && Array.isArray(ne.ou) && ne.ou.length ? ne.ou.slice() : ['description', 'titre', 'ref'];
    out.push({ cle: CLE_QUI, valeur: { ...(ne || {}), actif, depuis: !!(ne && ne.actif === true) !== actif || !(ne && ne.depuis) ? at : ne.depuis,
      choisi: (ne && ne.choisi) || at, ...(actif ? { ou } : {}) } });
  }
  // 2. La série des PROCHAINS numéros : `vrm_num_prefixe`.
  if (SERIES.includes(choix.serie)) {
    const arch = lettreDe(archive);
    const voulue = choix.serie === 'chiffres' ? '' : lettreDe(choix.lettre);
    if (choix.serie === 'lettre' && !voulue) refus = 'lettreVide';
    else if (voulue && arch && voulue === arch) refus = 'archive';
    else if (voulue !== m.lettre) out.push({ cle: CLE_PREFIXE, valeur: voulue });
  }
  // 3. L'étiquette : `vrm_etiquetage` (support, format, titre), seulement si quelque chose change.
  const e = lireEtiquetage(avant.etiquetage);
  const support = SUPPORTS.includes(choix.support) ? choix.support : e.support;
  const format = FORMATS.some((f) => f.v === choix.format) ? choix.format : e.format;
  const titre = typeof choix.titre === 'boolean' ? choix.titre : e.titre;
  if (support && (support !== e.support || format !== e.format || titre !== e.titre)) out.push({ cle: CLE_ETIQUETAGE, valeur: { support, format, titre, at } });
  return { ecritures: out, refus };
}

// La phrase d'une méthode, en clés de traduction (l'écran les passe à `tr`) : ce que Paramètres affiche à droite.
export function resumeMethode(m) {
  if (!m || !m.qui) return null;
  return { qui: m.qui, serie: m.qui === 'vrm' ? m.serie : null, lettre: m.qui === 'vrm' && m.serie === 'lettre' ? m.lettre : '', support: m.support, format: m.support === 'imprimee' ? m.format : null };
}
