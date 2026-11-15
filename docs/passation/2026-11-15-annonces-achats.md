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

## Les suggestions d'achat qui violaient §5 (deuxième lot de captures, 16 h 36)

Julien : « Regarde comment c'est arrivé » — « Autry reelwind low rose » ⇒ suggestion « #Adidas Spezial,
dunkelblau, Gr. 36 » (marque différente) ; « nike zoom fly 5 noir et rose » ⇒ « Nike speakers maat 40 »
(aucun mot de modèle commun) ; « nike air max 1 bleu » ⇒ « Nike Air Max 1 Alphabet 43 2007 » (juste).

**Mesuré sur la vraie base (lecture seule)** : l'annonce 10715110806 « Autry reelwind low rose taille 36 »
porte le champ marque **« adidas »** sur Vinted (choisie à la main) ; « Autry » n'est pas dans
`KNOWN_BRANDS` : la règle prenait le champ tel quel, et l'achat « #Adidas » était « de la même marque ».
Sur 691 annonces marquées, 81 ont un champ absent du titre (« Nike SB », « Nike x Sacai » — reconnues
Nike, écrites —, « no marque », vêtements Okaïdi…) : la seule marque RECONNUE absente de son titre était
ce cas (et une faute de frappe « adidias »). Pour « zoom fly » : modèle reconnu d'un côté, inconnu de
l'autre (« speakers ») — l'ancienne règle n'écartait que deux modèles CONNUS et différents.

**La règle (`src/suggestionsAchat.js`, `suggestionsAchat` — la même pour « Sans achat relié », la
saisie en série et « Relier un achat »)** :
- `marqueAnnonce` : la marque de l'annonce se PROUVE par son titre — le champ (ramené à la marque
  reconnue, « Nike SB » ⇒ nike) écrit dans le titre ⇒ lui ; un champ reconnu ABSENT du titre ⇒ pas su
  ⇒ aucune suggestion ; sinon la marque reconnue dans le titre (« no marque » + « adidas … » ⇒ adidas).
- l'achat porte CETTE marque : reconnue (`memeMarque`, « air jordan » = « jordan ») ou écrite dans son
  titre (une marque hors de la liste, « Autry », se lit ainsi) ; une autre ⇒ écartée. Normalisation
  `normMots` : casse, accents, « ß », « # » et ponctuation.
- `motsModeleAchat` : au moins UN mot de modèle commun — hors marque, couleurs (`extractColors`),
  tailles et nombres d'un ou deux chiffres, lettres seules, et `MOTS_VIDES` en six langues (taille,
  maat, gr, größe, taglia, talla, schuhe, sneakers, homme, neuf, low/mid/high…). Aucun mot de modèle
  dans l'annonce ⇒ aucune suggestion (jamais la marque seule). « Adidas baskets 35,5 » n'est donc plus
  proposé à « adidas spezial noir 35,5 » (audit S3b mis à jour : c'est la règle voulue).
- inchangé : deux modèles connus et différents ⇒ écartée (S3c le prouve encore : « air max 90 » /
  « air max 1 ») ; taille obligatoire ; achat antérieur ; couleur contraire écartée ; rien n'est relié
  sans SON toucher (le module n'écrit rien).
- Les nouveautés sont des tableaux littéraux : esbuild ne les embarque pas dans la copie de l'extension
  (`vinted-sync-extension/vrm-regles-achat.js` inchangée — elle était déjà en retard sur main pour
  d'autres règles, `coutVente` : à refabriquer par la session qui les a changées).
- Laissé tel quel : `src/dejaEnStock.js` (« déjà N paires de ce modèle ») a sa propre liste de mots
  vides, plus courte — même idée, autre notion.

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
  - **Après : 56 verts, 0 rouge** (avec la règle §5 ci-dessus).
  - **Mutations** (CSS du build modifié) : barre remise transparente ⇒ colle rouge (Toutes, Sans
    achat, Stock) ; titre à 4 lignes ⇒ debord + hauteur rouges.
- **Audit `audit-suggestions-achat`** : J1 (marque contredite), J1b (marque hors liste lue dans le
  titre ; « #Adidas » ≠ « Autry »), J2 (aucun mot de modèle commun), J3 (le bon cas reste proposé), J4
  (mots vides multilingues, « # »), J5 (la marque d'une annonce) ; **sur le code d'avant : J1, J1b, J2
  rouges, J3 vert** ; 50/50 verts après ; `--prouve` : 16/16 mutations attrapées (dont
  `marque-du-champ-crue`, `mot-modele-ignore`, `mots-vides-comptes` ; S3c ajouté pour que
  `modele-ignore` reste attrapée). `audit-achats-a-relier` G3b (la carte « Autry … » marquée « adidas »).
- Le banc `annonces-achats` juge aussi la règle rendue : « Autry … » marquée « adidas » sans suggestion,
  « Basket Nike 44 » et « #Adidas Spezial, dunkelblau, Gr. 36 » jamais proposés — rouge sur le build d'avant.
- Audits : `traduction`, `tdz`, `variables`, `studio`, `identite` (50 paires identiques), `achats-a-relier`,
  `achats-relier`, `prix-numerotage`, `actions-serie`, `quoi-de-neuf`, `plancher-stock` verts.

- Bancs voisins (build de cette branche) : `annonces-tete`, `studio-paires`, `annonces-grille` (92/92),
  `ergonomie-gestes` (prixachat, relierachat : 2 touchers) **verts** ; `achats-relier` D1-D2 (« Autre
  achat », SON clic relie l'achat choisi) verts. Rouges DÉJÀ rouges sur le build d'avant (70fbef70), à
  l'identique, hors de ce lot : `achats-relier` B0 (reçu sur la vente) puis E5/F1/F2 (icônes),
  `vague2-ventes` M (ambre « sous ton prix d'achat ») et R (remise), `prix-numerotage` scénarios A/B
  (12 rouges, `[data-edition="numero"]` des cartes d'Annonces). `vague2-ventes` A (« aucune suggestion
  (dit) ») : vert — le « Aucune suggestion » est dit sur la ligne du prix (`data-ar-sans-sugg`).

## Geste de Julien

Aucun : fermer et rouvrir l'app, Annonces → « Sans achat relié », faire défiler.
