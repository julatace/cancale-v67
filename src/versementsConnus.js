// ════════════════════════════════════════════════════════════════════════════
//  UNE DATE DE VERSEMENT CONNUE NE REDEVIENT JAMAIS « PAS LUE » (13 nov., source unique)
//
//  Le CA déclaré est daté au VERSEMENT (§5). Mesuré (banc versements-course) : la date de
//  versement d'une vente, publiée dans le relevé des ventes (`vrm_stats_ventes` [9]), passait
//  de « 2026-11-12… » à « » d'une ouverture d'écran à l'autre. Deux causes :
//   · l'écran publiait PENDANT que les dates étaient encore en cours de lecture (`undefined`),
//     puis, les dates arrivées dans la demi-seconde, comparait au relevé du navigateur PAS
//     ENCORE réécrit (la sauvegarde attend 500 ms) : « identique » ⇒ rien republié, et la
//     sauvegarde en attente (sans dates) l'emportait ;
//  · une relecture ratée ou partielle pouvait remplacer des dates déjà lues.
//  Règles (§5 « une capture partielle n'écrase jamais une complète », « rien lu ne vaut pas rien ») :
//   · `undefined` (en cours) : on ne publie pas ; la publication d'avant reste ;
//   · `null` (pas su) : dit comme tel (« » = pas lue) — sauf une date DÉJÀ publiée, gardée ;
//   · une date lue n'est jamais remplacée par du vide.
// ════════════════════════════════════════════════════════════════════════════

// La relecture des dates (`lu` : map tx → date | null pas su) fusionnée avec ce qu'on savait.
export function fusionnerVersements(avant, lu) {
  const connu = avant && typeof avant === 'object' ? avant : null;
  if (lu == null) return connu || lu;            // pas su : ce qu'on savait reste ; rien su ⇒ null
  if (typeof lu !== 'object') return connu || null;
  if (!connu) return lu;
  let change = false;
  const out = { ...connu };
  for (const [tx, d] of Object.entries(lu)) {
    if (!d) continue;                            // jamais du vide par-dessus une date
    if (out[tx] !== d) { out[tx] = d; change = true; }
  }
  return change ? out : connu;
}

// Le relevé à publier (`lignes` : [plateforme, compte, id, …, [9] date de versement]) : une
// date déjà publiée pour la MÊME vente (plateforme + identifiant) remplace un « » (pas lue).
export function garderDatesConnues(lignes, publiees, col = 9) {
  if (!Array.isArray(lignes) || !Array.isArray(publiees) || !publiees.length) return lignes;
  const connues = new Map();
  for (const l of publiees) if (Array.isArray(l) && l[col]) connues.set(`${l[0]}|${l[2]}`, l[col]);
  if (!connues.size) return lignes;
  return lignes.map((l) => {
    if (!Array.isArray(l) || l[col]) return l;
    const d = connues.get(`${l[0]}|${l[2]}`);
    if (!d) return l;
    const n = l.slice(); n[col] = d; return n;
  });
}
