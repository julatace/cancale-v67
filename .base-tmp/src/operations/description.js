// (29 oct., revue) La phrase qui dit à quoi sert Organisation : UNE source,
// lue par l'entrée de Réglages (App.jsx) et par l'en-tête de l'écran lui-même
// (Operations.jsx). L'écran gardait l'ancienne accroche (« Une équipe qui sait
// quoi faire. »), celle que Julien ne comprenait pas.
// (10 nov., textes courts 4) Raccourcie (125 → 72 caractères) : même liste, sans la phrase autour.
import { motsVendeur } from '../profilVendeur.js';
export const descriptionOrganisation = () => `À plusieurs : tâches, ${motsVendeur().noms} mis${motsVendeur().e}s de côté, achats en lot, emballages.`;
export const DESCRIPTION_ORGANISATION = 'À plusieurs : tâches, paires mises de côté, achats en lot, emballages.';
