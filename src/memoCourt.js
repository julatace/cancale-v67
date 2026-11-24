// ════════════════════════════════════════════════════════════════════════════
//  UNE LECTURE LOURDE RÉUSSIE SERT QUELQUES SECONDES À SES VOISINES (20 nov., lectures-legeres)
// ════════════════════════════════════════════════════════════════════════════
//  Mesuré au banc `iphone-rapide` (SESSION=1, 4G lente) : à l'ouverture, les dates de capture
//  (`harvest_*`, ~124 Ko) partaient TROIS fois en 3 s, et la liste des transactions (~144 Ko)
//  deux fois — chaque lecteur arrive juste APRÈS la fin de la précédente, hors du partage des
//  lectures en cours (`lecturesPartagees`, 2 s) et de `_capturesEnVol`.
//  ⇒ `creerMemoCourt({ dureeMs })` : la réponse RÉUSSIE (un tableau ou un objet, jamais `null`)
//    d'un lecteur sert `dureeMs` aux appels suivants, pour le MÊME vendeur seulement.
//  CE QUI N'EST JAMAIS SERVI :
//   · un « pas su » (`null`, `undefined`, une erreur) : jamais gardé, le suivant relit ;
//   · la réponse d'un autre vendeur : la clé est l'uid de la session (`qui`), comparée à chaque appel ;
//   · une réponse d'avant une écriture : `oublier()` est appelé à TOUTE écriture vers notre base ou
//     nos routes (abonnement à `lecturesPartagees`), à tout signal de l'extension (`vrm:ext`), au
//     retour du réseau et à `onCloudReady` ; une lecture EN COURS pendant un `oublier()` n'est
//     pas gardée (génération) ;
//   · un appel `force` (« Réessayer », « relire ») : il relit et remplace.
//  Le résultat rendu est le MÊME objet pour les voisins : les lecteurs servis ici ne le modifient
//  pas (ils en dérivent leurs propres objets) — tenu par le banc `lectures-legeres`.
// ════════════════════════════════════════════════════════════════════════════
export function creerMemoCourt({ dureeMs = 20000, maintenant = () => Date.now() } = {}) {
  let entree = null;   // { qui, gen, at, v } (réponse lue) ou { qui, gen, p } (en cours)
  let gen = 0;
  const stats = { servies: 0, lues: 0 };
  const oublier = () => { gen++; entree = null; };
  const lire = (qui, fn, { force = false } = {}) => {
    const q = String(qui || '');
    const e = entree;
    if (!force && e && e.qui === q && e.gen === gen) {
      if (e.p) { stats.servies++; return e.p; }
      if (maintenant() - e.at < dureeMs) { stats.servies++; return Promise.resolve(e.v); }
    }
    const monGen = gen;
    stats.lues++;
    const p = Promise.resolve().then(fn);
    const enVol = { qui: q, gen: monGen, p };
    entree = enVol;
    p.then((v) => {
      if (entree !== enVol) return;
      if (v === null || v === undefined || monGen !== gen) { entree = null; return; }
      entree = { qui: q, gen: monGen, at: maintenant(), v };
    }, () => { if (entree === enVol) entree = null; });
    return p;
  };
  return { lire, oublier, stats };
}
