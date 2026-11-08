// ════════════════════════════════════════════════════════════════════════════
//  LES FEUILLES DE STYLE DE L'APP (8 nov., démarrage léger)
//  Déplacées TELLES QUELLES de src/main.jsx (même liste, même ordre, mêmes
//  commentaires). Importées en TOUT PREMIER par src/App.jsx : elles partent avec
//  le morceau App (chargé dès qu'une session existe, src/main.jsx) au lieu de
//  bloquer l'affichage de index.html. L'ordre de la cascade ne change pas :
//  elles passent toujours APRÈS celles de la page d'accueil et du démarrage
//  (index), et AVANT celles qu'App.jsx importe lui-même.
//  ⚠️ L'ordre ci-dessous EST la cascade : styles-vitrine après styles-boutons,
//  styles-composants en dernier (audit-composants).
// ════════════════════════════════════════════════════════════════════════════
// Direction claire « Minéral » (codex) : chargée après les polices, elle ajuste
// le fond clair, le focus, la sélection et une classe de bouton opt-in.
import './styles-mineral.css';
import './styles-reglages.css';
import './styles-coque.css';
import './styles-atelier.css';
import './styles-plateformes.css';
import './styles-iphone.css';
import './styles-mobile-studio.css';
import './styles-gestion.css';
import './styles-widgets.css';
import './styles-captures.css';
import './styles-annonces-ventes.css';
import './styles-statut.css';
import './styles-annonces-pro.css';
import './styles-mouvement.css';
import './styles-bienvenue.css';
// (2 nov.) La visite en bulles (src/VisiteBulles.jsx) — hors de la coque, ses propres teintes.
import './styles-visite.css';
import './styles-disposition.css';
import './styles-telephone.css';
import './styles-epure.css';
import './styles-annonces-fiche.css';
import './styles-etat-actions.css';
// (29 oct.) Les trois boutons (primaire · secondaire · discret) — EN DERNIER :
// la normalisation des boutons écrits en ligne doit passer après toutes les autres.
import './styles-boutons.css';
// (31 oct.) La direction « Vitrine » (son choix) : chargée EN DERNIER, elle a le dernier
// mot sur la forme (fond, navigation, surfaces, étiquettes). Rien de métier.
import './styles-vitrine.css';
// (31 oct.) Messages en volets (maquettes choisies) — après Vitrine, l'écran Messages seul.
import './styles-messages.css';
// (1er nov.) Les chiffres de Ma journée (Vendu, Cette semaine en barres, Tendances), épurés — après Vitrine.
import './styles-journee-chiffres.css';
// (1er nov.) Le récapitulatif d'une vente (tiroir de Ventes, maquette A) — après Vitrine.
import './styles-recap-vente.css';
// (1er nov.) La finition « premium » (sans nouvelle palette ni dégradé) — en tout dernier.
import './styles-finition.css';
// (1er nov.) Ma journée calme : colonne tenue, listes à filets, une hiérarchie — après la finition.
import './styles-journee-mieux.css';
// (2 nov.) Comptabilité en trois questions (gagné · déclarer · détail) — après la finition.
import './styles-compta-claire.css';
// (2 nov.) Le style « Fusion » (son choix sur les maquettes) : cartes blanches, carte sombre du mois,
// frises de suivi — en tout dernier, il a le dernier mot sur la forme des écrans qui le portent.
import './design/fusion.css';
import './design/favoris.css';
import './design/outils-stats.css';
import './design/argent-offres.css';
import './design/dac7.css';
// (3 nov.) Les jetons Fusion pour TOUTE l'app (échelle fermée, segmentés, cartes) — le tout dernier mot.
import './design/jetons.css';
import './styles-bureau.css';
// (5 nov.) Le bouton « Stream » et son sous-écran (src/modeStream.js).
import './design/mode-stream.css';
// (5 nov.) La barre du bas revue (téléphone seul) : le panneau « Plus » en tuiles au-dessus de la barre — en tout dernier.
import './styles-barre-iphone.css';
// (5 nov., chantier B) Les composants partagés (SheetShell, ChampRecherche, PhotoVide, Numero,
// EtatPanne, bouton « danger » ambre) — après tout le reste : ils portent leur propre forme.
// (6 nov., finition) Lisible pour tous : texte en grand de l'appareil (src/grandTexte.js), cibles de 44 px, contrastes (ses règles portent leur propre poids).
import './styles-lisible.css';
import './styles-composants.css';
