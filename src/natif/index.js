// ── src/natif/index.js — « VRM natif » : tout ce qu'un écran importe ─────────────────────
// Le contrat : docs/design/NATIF.md. Le mode d'emploi (un exemple par composant, les erreurs à ne pas
// faire) : docs/design/NATIF-composants.md. La galerie : `node scripts/bancs/natif-galerie.cjs`.
//
//   import { Page, Groupe, Rangee, Vignette, Plaque, Bouton } from '../natif/index.js';
//
// Les deux feuilles de style partent avec ce fichier (jetons d'abord) : un écran n'importe aucun CSS natif.
// ⚠️ Après le commit « FONDATION PRÊTE », une API ne se casse plus : on AJOUTE une prop, on ne renomme rien.
import './jetons.css';
import './natif.css';

export { poserIcone, iconePosee, Glyphe, GLYPHES } from './icones.jsx';
export { Bouton, BoutonIcone, useGesteUnique } from './Bouton.jsx';
export { Pastille, comptePastille } from './Pastille.jsx';
export { Plaque } from './Plaque.jsx';
export { Affiche } from './Affiche.jsx';
export { Vide } from './Vide.jsx';
export { Attente } from './Attente.jsx';
export { Faits, Fait } from './Faits.jsx';
export { EnteteArticle, Photos, Herite } from './Article.jsx';
export { Segmente } from './Segmente.jsx';
export { Groupe } from './Groupe.jsx';
export { Rangee, Vignette, Interrupteur } from './Rangee.jsx';
export { Feuille } from './Feuille.jsx';
export { Toast } from './Toast.jsx';
export { Page, TetePage, PagePoussee, ChampRecherche, ContexteCoque } from './Page.jsx';
export { BarreOnglets } from './BarreOnglets.jsx';
export { BarreLaterale } from './BarreLaterale.jsx';
export { Coque, CoqueRacine, CoqueEcran, ActionsCoque, FeuillePlus, Avatar, useOrdinateur, LARGEUR_ORDINATEUR } from './Coque.jsx';
export { TIRET, estVide, cx } from './outils.js';
export { Barres } from './Barres.jsx';
export { Vignettes, CodeRetrait } from './Vignettes.jsx';   // (19 nov.) ajoutés pour « Aujourd'hui » : src/natif/complements.css
export { Colonnes, Colonne } from './Colonnes.jsx';   // (19 nov.) deux colonnes à l'ordinateur, une au téléphone
export { TableauTravail, depuisMaj } from './TableauTravail.jsx';   // (19 nov. soir) le tableau de travail des listes (NATIF.md §2 bis)
export { Carte, Tuiles, Tuile } from './Carte.jsx';   // (19 nov.) carte-tableau à filet et tuiles de chiffres (« entre Vintex et celui-là »)
export { Courbe, Progression, Champ } from './Courbe.jsx';   // (19 nov.) la courbe des 30 jours, la progression de l'objectif, un champ court
export { ListeOrdonnee, Editable } from './ListeOrdonnee.jsx';   // (19 nov.) « Personnaliser » : la liste qu'on réordonne, la grille qu'on modifie
export { LogoSite } from './LogoSite.jsx';   // (20 nov. soir) le logo du site d'une rangée (tout est mélangé)
