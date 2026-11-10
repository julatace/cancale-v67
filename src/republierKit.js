// ══ REPUBLIER À LA MAIN : PRÉPARER PLUSIEURS ANNONCES D'UN COUP (10 nov., lot AP) ══
// Julien (9 nov., demande 17) : « Republication à la main : la conseiller (moins risquée) et la
// rendre attirante ; transmettre les photos retouchées à la galerie du téléphone ; regarder
// comment garder/réattribuer le N° et comment gérer les descriptions en sélection multiple ».
//
// Ce module ne CALCULE rien de neuf : le texte d'une annonce est celui de l'atelier
// (`annonceRepubliee`, src/republierReglages.js — la lettre et le N° posés selon
// Réglages → Numéros). Il ne fait que dire, pour une paire ou pour plusieurs :
//   · le N° à COPIER (l'étiquette telle qu'écrite dans l'annonce, sinon « N°42 ») ;
//   · le bloc « tout copier » (N° + titre + description de chacune, dans l'ordre de ses clics).
// « Pas su » n'est jamais un vide : une description que VRM n'a pas lue est DITE
// (`DESC_PAS_LUE`), jamais collée comme une chaîne vide ; un N° absent n'invente rien.
// Rien ne part chez Vinted d'ici : c'est lui qui publie.

export const DESC_PAS_LUE = 'Description pas lue par VRM : copie-la depuis Vinted.';
export const SEPARATEUR_KIT = '\n\n— — —\n\n';

// Le N° à coller : l'étiquette telle que la règle l'écrit dans l'annonce (« N°42 », « #42 »…),
// sinon « N°42 ». Pas de N° ⇒ '' (rien d'inventé).
export function numeroACopier(numero, etiquette) {
  const n = String(numero == null ? '' : numero).trim();
  if (!n) return '';
  const t = etiquette && etiquette.pose && etiquette.texte ? String(etiquette.texte).trim() : '';
  return t || `N°${n}`;
}

// Une paire du kit : { numero, etiquette, titre, description, lue }.
//   lue === false ⇒ la fiche n'a pas pu être lue (pas su) ; description '' lue ⇒ vraiment vide.
export function blocPaire(p) {
  const x = p || {};
  const num = numeroACopier(x.numero, x.etiquette);
  const tete = [num, String(x.titre || '').trim()].filter(Boolean).join(' · ') || 'Annonce sans titre';
  const desc = String(x.description || '');
  const corps = desc.trim() ? desc : (x.lue === false || x.lue === undefined ? DESC_PAS_LUE : 'Pas de description.');
  return `${tete}\n\n${corps}`;
}

// « Tout copier » : un bloc par paire, dans l'ordre donné (celui de ses clics).
export function texteKit(paires) {
  return (Array.isArray(paires) ? paires : []).map(blocPaire).join(SEPARATEUR_KIT);
}

// Combien de paires ont une description LUE (pour dire « 2 sur 3 » plutôt que « tout est prêt »).
export function couvertureKit(paires) {
  const l = Array.isArray(paires) ? paires : [];
  return { n: l.length, lues: l.filter((p) => p && p.lue === true).length, enCours: l.filter((p) => p && p.lue === undefined).length };
}
