# 15 nov. 2026 — Annonces → « Sans achat relié » au propre (branche `claude/annonces-achats`)

## Ce que Julien a dit

Trois captures iPhone d'Annonces (Vinted), la file des prix d'achat (« 34 annonces · 18 avec une
suggestion », « Saisie en série des prix d'achat », cartes « N°B188 · 3 manuels… · Aucune
suggestion · Choisir un achat · Saisir · Plus tard ») : « Regarde ici aussi c'est moche et il y a
des bugs, je veux que tout soit parfait ».

Vu sur les captures : la recherche collée en haut est **transparente** (les cartes passent dessous
et se mélangent à « Rechercher », au filtre, à « Toutes · Sélectionner · Republier ») ; les cartes
**débordent** (N° et photo coupés au bord gauche, titres sous le bord droit, la page glisse) ; la
carte est **haute et vide** (« Aucune suggestion » seul au milieu), trois gestes empilés, l'achat
suggéré dans un bloc gris avec une vignette vide.

## Les causes (mesurées sur l'app rendue, banc `annonces-achats`)

1. **La barre collée transparente** — `src/design/studio-paires.css` §16 posait le voile de la barre
   par une animation pilotée par le défilement (`animation-timeline`), mais la MÊME règle posait
   `background: transparent !important; box-shadow: none !important`. Une déclaration `!important`
   passe devant une animation : sur un navigateur qui sait piloter l'animation (Safari 26 de son
   iPhone, Chrome), la barre restait transparente pour toujours. Même panne sur la recherche du
   Stock (`[data-stock-recherche]`, même règle) et, dans « Toutes », les en-têtes de compte
   (« boutique_nord · 12 annonces ») restaient collés (styles-listes.css, `top: 112px`) et
   transparents, posés sur les rangées.
2. **Le débordement et les titres énormes** — la carte s'appelait `vrm-ar-*`, comme l'accueil des
   nouveaux (`src/accueilReste/accueil-reste.css`) et « Ton adresse VRM » (`src/adresse-reception.css`).
   Elle héritait de leurs règles : `.vrm-ar-liste li { display:flex; align-items:center }` (le contenu
   centré, plus large que la carte, sortait des deux côtés : −200 → 590 px pour une carte de 14 → 376),
   `.vrm-ar-titre` en 20 px gras, `.vrm-ar-gestes` avec 16 px de marge, `.vrm-ar` en grille à 20 px.
   À l'ordinateur, `.vrm-main` glissait de côté (1337 > 1240 px).
3. **La carte vide** — « Aucune suggestion » était un bloc à part (centré par la règle ci-dessus),
   et les gestes passaient à la ligne (« Plus tard » seul dessous).

## Ce qui a changé

- **La carte** (`AchatsARelier`, src/App.jsx ; styles : `src/design/studio-achats-relier.css`, classes
  `vrm-aar-*` qu'aucun autre écran n'emploie) : porcelaine compacte — vignette 52 · plaque N° + titre
  (2 lignes au plus) · prix ; dessous, s'il y a une suggestion, UNE pastille creusée « SUGGESTION ·
  titre / date · compte · prix du reçu », avec la photo de l'achat seulement si on la connaît (jamais
  une vignette vide) ; puis UNE ligne de gestes : la touche principale (« Relier · 43,67 € », ou
  « Saisir le prix » sans suggestion), le lien « Autre achat » (ou « Choisir un achat »), et « ⋯ » qui
  montre sous la ligne les gestes rares (« Saisir le prix » quand une suggestion tient la place,
  « Plus tard »). 44 px au doigt. Aucune fonction perdue : mêmes `data-ar-*` (`data-ar-relier`,
  `-autre`, `-choisir`, `-saisir`, `-plus-tard-geste`, `-serie`, `-ligne`, `-sugg-tx`, `-reportee`) ;
  nouveaux : `data-ar-plus` (« ⋯ »), `data-ar-titre`, `data-ar-sous`.
- **La tête** : « 12 annonces · 3 avec une suggestion ⓘ » — la règle (« même marque, même taille,
  achetée avant la mise en ligne ; rien n'est relié sans ton toucher ») vit derrière le ⓘ
  (`Pourquoi`) ; « Saisie en série des prix d'achat » devient un lien (`sb-lien`), à droite à
  l'ordinateur, sous le nombre au téléphone.
- **Les barres collées** (studio-paires.css §16) : le voile est porté par la barre elle-même, TOUJOURS
  — l'aplat du fond, opaque (à 96 % la liste se devinait encore dessous), une ombre de séparation,
  `z-index: 30` (au-dessus de la liste ; la barre de titre est hors de `.vrm-main`). Recherche
  d'Annonces : au téléphone seulement (elle n'est collée qu'au téléphone). Recherche du Stock :
  partout. Aucun `backdrop-filter` (il ferait de la barre le cadre des `fixed` qu'elle contient : le
  voile du menu « ⋯ Outils »). Les en-têtes de compte de la liste ne collent plus.
  ⚠️ L'animation pilotée par le défilement, reposée sur un `::before` de la barre, fait **tomber
  l'onglet de Chromium** (« Target crashed », mesuré : sans elle rien ne tombe) — ne pas la remettre.
- §5 inchangé : une suggestion reste une SUGGESTION, c'est son toucher sur « Relier » qui relie ;
  « Autre achat » reste à côté (lot DJ5).
- i18n : `annonces.saisirPrix`, `annonces.suggestion`, `annonces.suggestionQuoi`,
  `annonces.suggestionRegle` dans les cinq langues.
- Le banc `vague2-ventes` lit la ligne « reportée le … » par `[data-ar-sous]` (la classe a changé).
- Laissé tel quel (hors du lot) : les règles `.vrm-ar-*` de `src/vague2-ventes.css`, qui ne servent
  plus cette carte mais touchent encore l'accueil des nouveaux par collision de noms.

## Les preuves

- **Banc `scripts/bancs/annonces-achats.cjs`** (390 tactile + 1512, clair + sombre ; base INVENTÉE,
  12 annonces numérotées sans achat, 4 achats dont 3 rapprochables et un sans photo) : barres collées
  (« Toutes », « Sans achat relié », Stock) lisibles (alpha ≥ .98), ombrées, au-dessus de la liste
  (`elementFromPoint` au centre et aux bords), jamais sur la barre de titre ; aucun débordement
  (document, `.vrm-main`, chaque élément visible dans sa carte, titres ≤ 2 lignes) ; cartes ≤ 136 px
  sans suggestion, ≤ 188 px avec ; chaque geste présent, visible ou derrière « ⋯ » qui le montre ;
  tête (règle derrière ⓘ, « Saisie en série » en lien) ; aucune écriture n'emporte un achat proposé
  sans son clic.
  - **Avant (build de 70fbef70) : 26 verts, 22 rouges** (colle ×6, debord ×8, hauteur ×4, tete ×4) —
    les captures reproduisent celles de Julien à l'identique.
  - **Après : 52 verts, 0 rouge.**
  - **Mutations** (CSS du build modifié) : barre remise transparente ⇒ colle rouge (Toutes, Sans
    achat, Stock) ; titre à 4 lignes ⇒ debord + hauteur rouges.
- Audits : `traduction`, `tdz`, `variables`, `studio`, `identite`, `achats-a-relier`, `achats-relier`,
  `prix-numerotage`, `actions-serie`, `quoi-de-neuf` verts.

## Geste de Julien

Aucun : fermer et rouvrir l'app, Annonces → « Sans achat relié », faire défiler.
