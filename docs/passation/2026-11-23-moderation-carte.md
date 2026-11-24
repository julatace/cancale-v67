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
