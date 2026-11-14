// src/ui — les briques communes des écrans de liste (14 nov., refonte des listes ;
// récit docs/passation/2026-11-14-refonte-listes.md). Chaque fichier dit en tête ce qu'il
// fait et pourquoi (règles de Julien, AJOUT 3 : « liste d'abord »). Les styles : ui.css.
//   BandeChiffres  la bande de 2–4 chiffres (≤ 72 px) qui remplace la carte sombre d'un écran de liste
//   MenuCompte     « compte_1 ▾ » / « Tous les comptes ▾ » + la feuille des comptes
//   BarreOutils    un vrai champ de recherche + 1–2 BoutonIcone (36 px dessinés)
//   Filtres        de petites capsules (34 px dessinées, 44 touchées), la choisie à l'encre
//   LigneAFaire    « • À faire · N › » qui ouvre une feuille avec chaque alerte et son geste
//   Ligne          la rangée d'une liste longue (64–72 px, vignette 52)
//   Feuille        la petite feuille (portail) des deux menus ci-dessus
// Textes : `listes.*` dans src/i18n/langues/<l>/listes.js (5 langues).
export { BandeChiffres } from './BandeChiffres.jsx';
export { MenuCompte } from './MenuCompte.jsx';
export { BarreOutils, BoutonIcone } from './BarreOutils.jsx';
export { Filtres } from './Filtres.jsx';
export { LigneAFaire } from './LigneAFaire.jsx';
export { Ligne } from './Ligne.jsx';
export { Feuille } from './Feuille.jsx';
