// ════════════════════════════════════════════════════════════════════════════
//  « LA MÊME VALEUR, LA MÊME VERSION » (16 nov., lot vitesse-moteur)
//
//  Mesuré à 20 000 ventes (Ma journée, 390 px, processeur ×4, crochet RENDUS) : le moteur
//  `Comptabilite` était redessiné par des états reposés à l'IDENTIQUE — les N° d'annonces
//  (`vinted_annonce_numeros`), les N° utilisés, les liens vente ⇒ annonce relus du nuage
//  (`onCleRelue`), le n° de transaction ⇒ annonce relu à chaque arrivée de ventes. Un objet
//  neuf au même contenu change l'IDENTITÉ de la donnée : chaque `useMemo` et chaque mémoire
//  par version (`memoVersion`, src/indexVentes.js) qui la lit recalcule les 20 000 ventes,
//  pour la même réponse.
//
//  `gardeSiMeme(avant, apres)` rend `avant` quand les deux valeurs ont le MÊME contenu, sinon
//  `apres`. Le lecteur reçoit donc toujours une valeur au contenu exact de `apres` : aucun
//  chiffre ne peut changer ; seule l'identité est gardée, et avec elle les calculs déjà faits.
//
//  `memeValeur` est stricte : primitives par `Object.is` ; tableaux, objets SIMPLES (prototype
//  Object ou null), `Set` et `Map` comparés élément par élément (clés dans n'importe quel ordre
//  pour les objets, comme le lit l'app : par clé). Tout le reste (Date, classes, fonctions…)
//  n'est égal qu'à lui-même : dans le doute, la valeur neuve gagne (« pas su » ≠ « oui »).
//  ⚠️ Jamais `JSON.stringify` : un `Set` s'y écrit « {} » — deux ensembles différents y seraient égaux.
// ════════════════════════════════════════════════════════════════════════════

const simple = (x) => { const p = Object.getPrototypeOf(x); return p === Object.prototype || p === null; };

export function memeValeur(a, b, profondeur = 0) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (profondeur > 40) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!memeValeur(a[i], b[i], profondeur + 1)) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set) || !(b instanceof Set) || a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;   // éléments par identité (N°, ids : des textes)
    return true;
  }
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map) || !(b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of a) { if (!b.has(k) || !memeValeur(v, b.get(k), profondeur + 1)) return false; }
    return true;
  }
  if (!simple(a) || !simple(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!memeValeur(a[k], b[k], profondeur + 1)) return false;
  }
  return true;
}

export const gardeSiMeme = (avant, apres) => (memeValeur(avant, apres) ? avant : apres);
