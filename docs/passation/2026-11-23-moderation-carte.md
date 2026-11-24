# 23 nov. — « Vinted a agi » regroupée (`claude/moderation-carte`)

**Demande** : Julien envoie une capture iPhone d'« Aujourd'hui » : « c'est moche ». La carte « Vinted a agi 5 fois »
répétait sur CHAQUE ligne « N°132 a disparu · shop_cancale », la fenêtre « vue entre le … et le … », le même paragraphe
de trois lignes et une grosse pilule ambre « Vérifie tes messages Vinted » ; un trait orange sur le bord gauche.

**Fait** (`src/AlerteModeration.jsx`, `src/styles-alerte-moderation.css`, clés `modc.*` dans `src/i18n/langues/*/moderationCarte.js`) :
- les « disparues » d'un compte forment UN groupe : en-tête « 5 annonces disparues · shop_cancale » (le titre de la carte
  quand il n'y a que lui), la fenêtre une fois (« entre le 21 nov et le 23 nov »), l'explication une fois sous
  « Pourquoi ? » (`Pourquoi`, src/natif/Actions.jsx), UN bouton « Vérifier sur Vinted » (`Actions`, ouvre vinted.fr/inbox) ;
  plusieurs comptes ⇒ un groupe par compte, chacun avec « Tout est vu » ;
- chaque ligne : la photo de SA fiche (`vinted_annonce_numeros[id].photo`, par identifiant — jamais par titre), le N°,
  un titre court (ellipse), « Vu » (44 px) ; au-delà de 5 lignes « Voir les N autres » ;
- plus d'ambre ni d'orange : `--n-accent` / `--n-teinte` (ardoise ; la nuit `--n-ambre` et `--vrm-warn` restent orangés,
  ne pas les reprendre ici) ; plus de trait de bord ;
- masquée / limitée / « à nouveau visible » : inchangées, sauf les couleurs.
- Inchangé : la règle (`src/moderationVinted.js`), la vente prouvée, `vrm_moderation_vu`, `texteEvenement` (notification, journal).

**Preuves** : `scripts/bancs/moderation-carte.cjs` (1, 5, 30 disparues, deux comptes ; 390 tactile et 1512 ; clair et
sombre ; 397 verts) — rouge sur la tête de #1326 (76 rouges : groupes absents, ambre #FFC266 la nuit, trait de 3 px) et
par mutation (explication par ligne, ambre remis, photo prise par titre). `alerte-moderation.cjs` 92 verts (assertion de
la disparue déplacée sur le groupe). `textes-visibles` journee 2/2, `audit-traduction`, `audit-quoi-de-neuf`,
`audit-alerte-moderation`, `audit-icones`, `audit-coherence` verts.

**À fusionner APRÈS #1326** (`claude/style-clair`) : la branche part de sa tête.

## 24 nov. — réconciliée avec la revue UX (#1321, déjà sur main) : UNE carte

**Pourquoi** : #1321 (sur main) et ce lot refaisaient la même carte autrement ; le train butait sur le fond. Rendus
côte à côte (même base inventée, 390/1512, clair/sombre) : #1321 était plus VISUEL (une ligne par compte, photos
empilées, feuille aux grandes photos — le style « pop-up » qu'il a validé) mais la ligne ne disait pas QUAND, l'explication
était un « ⓘ », le N° se perdait sous le titre, le bouton tombait sous le pli à 390, le « ⋯ » faisait 36 px, et le reste
de la carte gardait l'ambre et des textes en dur ; ce lot était plus CLAIR mais une liste de lignes grises.

**Gardé de #1321 (base)** : la ligne compacte par compte (photos empilées), la feuille aux photos, « ⋯ » par annonce
(« Je l'ai supprimée moi-même » / « C'est vu »), « Ouvrir mes messages Vinted » (`data-href` vinted.fr/inbox),
« Tout est vu » du compte, `ArretModerationCompte` et `src/moderationFeuille.js` (une explication, pas deux).

**Pris de ce lot** : la fenêtre « entre le … et le … » une fois sur la ligne (et en tête de la feuille, même source
`fenetreGroupe`) ; l'explication une fois sous « Pourquoi ? » (`modc.pourquoiDisparue`) ; le N° en pastille SUR la
photo de SA fiche (identifiant) ; 6 photos puis « Voir les N autres » ; ni ambre ni trait de bord sur toute la carte
(masquée, limitée, « à nouveau visible ») ; tous les textes par `tr()` (`modc.titre`, `modc.titreUn`, `modc.toutVu`,
`modc.aria`) ; cibles 44 px (« ⋯ » 44). Nouveau : la pastille du nombre sur la pile (à l'encre), la pile légèrement
inclinée, le geste au PIED de la feuille (toujours visible). « Tout est vu » de la carte range tout ce qu'elle montre,
disparues comprises (sinon la carte restait). Clés retirées : `modc.disparues`, `modc.disparuesSansCompte`,
`modc.verifier`, `modc.vu`, `modc.vuDe`, `ru.mod.court`, `ru.mod.phrase`.

**Bancs** : `moderation-carte` adapté (les mêmes règles jugées sur la ligne PUIS dans la feuille ; 30 ⇒ 6 + « Voir les
24 autres ») 493 verts, rouge par mutation (« ⋯ » à 36 px ; compte répété sur chaque case) ; `alerte-moderation` 92
verts (la disparue jugée dans la feuille) ; `revue-ux` 45 verts.
