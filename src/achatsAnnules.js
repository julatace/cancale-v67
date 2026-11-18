// ════════════════════════════════════════════════════════════════════════════
//  LES ACHATS ANNULÉS, CACHÉS DE LA LISTE PAR DÉFAUT (17 nov., chasse-bugs)
//  Julien (capture d'Achats) : « Je veux pas voir les achats annulés sauf si je les sélectionne ».
//  UNE règle, celle de l'app : `achatAnnule` de src/registres.js (annulé / remboursé / refusé), la même que
//  le registre des achats, les chiffres d'Achats et « Annulé » écrit sur la ligne (`etapeAchat`) — jamais
//  une nouvelle. Un retour en cours (« Retour initié ») n'y entre pas : il reste un geste à faire, visible.
//  Affichage seulement : aucun total ni compte ailleurs (Argent, registre des achats, chiffres d'Achats)
//  ne passe par ici. Le filtre « Annulés · N » les montre, seuls ; N est toujours écrit (rien caché en silence).
// ════════════════════════════════════════════════════════════════════════════
import { achatAnnule } from './registres.js';

export const FILTRE_ANNULES = 'annules';
// La liste montrée : sous « Annulés », eux seuls ; partout ailleurs, sans eux.
export const garderSelonAnnules = (o, filtre) => (filtre === FILTRE_ANNULES ? achatAnnule(o) : !achatAnnule(o));
export const nombreAnnules = (liste) => (Array.isArray(liste) ? liste.filter(achatAnnule).length : 0);
