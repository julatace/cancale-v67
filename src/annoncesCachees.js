// (23 nov., latence-2) L'écran Annonces Vinted d'hier reste MONTÉ, CACHÉ, sous la liste à égalité (src/ecrans/AnnoncesEgalite.jsx) :
// il porte les ateliers que le bouton « Actions » ouvre (`demanderActionAnnonces` → `lancerActionSel`, par IDENTITÉ { uid, id },
// sur ses données — jamais sur ses vignettes). Ses vignettes, elles, ne servaient plus à personne : 6 880 éléments rendus à
// chaque visite d'Annonces, jamais vus (banc fluidite-generale, 390 ×4 : ~1 s de contenu). Caché ainsi, il ne les rend plus.
import React from 'react';
export const AnnoncesCacheesCtx = React.createContext(false);
