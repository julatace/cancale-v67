// ── LE PREMIER COLIS ACCOMPAGNÉ (14 nov., accueil des nouveaux, n° 137) ──────────
// Julien : la 1re fois qu'on imprime un bordereau, VRM montre chaque étape — imprimer,
// coller, déposer, suivre.
//   · UNE FOIS par compte VRM (`vrm_premier_colis`, SYNC_KEYS), passable ;
//   · seulement après un bordereau imprimé SEUL (`annotateAndDownloadBordereau`) :
//     une impression EN SÉRIE (`mergeAndDownloadBordereaux`) n'est jamais interrompue,
//     et ne compte pas comme « vu » (le premier bordereau seul le montrera) ;
//   · jamais par-dessus la visionneuse du bordereau ni une autre fenêtre : il attend
//     qu'aucune feuille ne soit ouverte (`attendreFenetresFermees`) ;
//   · jamais chez un vendeur installé (des bordereaux déjà imprimés, `vinted_bords_printed`
//     non vide avant ce geste) ni en mode exemple ;
//   · rejouable (Paramètres → Aide).
// JS pur : `scripts/audit-accueil-nouveaux.cjs` l'exécute.

export const CLE_PREMIER_COLIS = 'vrm_premier_colis';
export const EVT_BORDEREAU_IMPRIME = 'vrm:bordereau-imprime';
export const ETAPES_COLIS = Object.freeze(['imprimer', 'coller', 'deposer', 'suivre']);

export function lireMarqueurColis(brut) {
  const o = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : null;
  return o && typeof o.vu === 'string' && o.vu ? { vu: o.vu, fin: typeof o.fin === 'string' ? o.fin : null } : null;
}
// Combien de bordereaux étaient DÉJÀ marqués imprimés avant ce geste (`vinted_bords_printed` :
// { [clé]: ts } ou une liste). Illisible ⇒ null (pas su ⇒ on ne montre pas).
export function bordereauxDejaImprimes(brut) {
  if (brut == null) return 0;
  if (Array.isArray(brut)) return brut.length;
  if (typeof brut === 'object') return Object.keys(brut).length;
  return null;
}
// `evt` : le détail de l'évènement ({ serie, avant }) ; `marqueur` : `vrm_premier_colis`.
export function doitAccompagner({ pret, exemple, marqueur, evt } = {}) {
  if (!pret || exemple) return false;
  if (lireMarqueurColis(marqueur)) return false;
  if (!evt || evt.serie !== false) return false;          // une série : jamais
  return evt.avant === 0;                                  // le TOUT premier (pas su ⇒ non)
}
export const marqueurColis = (fin = 'vu', at = new Date().toISOString()) => ({ vu: at, fin });
// Une fenêtre est-elle ouverte (visionneuse, feuille, confirmation) en dehors de la nôtre ?
// `dialogues` : les éléments [role=dialog][aria-modal=true] ; `notre` : la nôtre (ou rien).
export function fenetreOuverte(dialogues, notre = null) {
  return (dialogues || []).some((d) => d && d !== notre && !(d.closest && d.closest('[data-premier-colis]')) && !(d.hasAttribute && d.hasAttribute('data-premier-colis')));
}
