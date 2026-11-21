# 5 nov. 2026 — Annonces : sélectionner, puis « Actions possibles »

Branche `v31-annonces-actions` (partie de `claude/project-review-nsk5su`), **pas poussée,
pas de PR**. Demande : `docs/passation/demandes-2026-11-05.md` §2 et « Précisions du vocal ».

## Ce que Julien voit

Annonces (Vinted) → deux nouvelles vues dans la rangée des filtres :

- **Brouillons · N** : ses brouillons Vinted lus, compte par compte ;
- **Sélectionner** : toutes ses annonces Vinted — en ligne, **masquées**, **brouillons** —
  rangées **par compte** (un groupe par compte, « Tout cocher » par groupe). Chaque ligne
  dit son état (`En ligne` · `Masquée` · `Brouillon` · `En vérification par Vinted`).
  Une annonce **en vérification par Vinted** est visible mais ne se coche pas, et dit
  pourquoi (« Vinted la vérifie : rien ne peut partir tant que ce n'est pas fini »).

Dès qu'une annonce est cochée : UN bouton collé en bas, **« Actions possibles · N »**. Il
ouvre un carré qui liste les cinq actions ; celles qui ne peuvent pas partir restent
dans la liste, **grisées, avec leur raison** :

| action | sur | moteur (existant) |
|---|---|---|
| Republier | en ligne | `RepublierVinted` action `recreer` |
| En ligne → en ligne, avec tes modifications | en ligne | action `modifier` |
| En ligne → brouillon | en ligne | action `versBrouillon` |
| Brouillon → en ligne | brouillon | action `enLigne` (`publierBrouillon`) |
| Republier à la main, accompagné | une seule annonce (en ligne, masquée ou brouillon) | rien ne part chez Vinted |

Raisons dites (toutes dans `src/annoncesActions.js`, `actionsPossibles`) : rien de coché ;
**deux comptes mélangés** (« une action se lance sur un seul compte à la fois », les deux
comptes nommés) ; un état qui ne va pas (« Seulement pour les brouillons : ta sélection
contient 2 annonces en ligne ») ; « à la main » une à la fois ; compte de Chrome **pas su**
(rien ne part, pas su ≠ oui), **aucun** (« ouvre vinted.fr sur X »), **autre** (les deux
comptes nommés) ; extension trop ancienne pour CETTE action (`EXT_CAPACITES`). « À la main »
ne dépend ni de Chrome ni de l'extension.

**Avant de lancer**, dans le même carré, paire par paire : ce qui manque pour publier, avec
le geste et « Corriger sur Vinted ↗ » (lien `/items/{id}/edit` de CETTE annonce). Règle :
`problemesAnnonce(…, 'vinted')` de `src/verifAnnonce.js` (la même que « vérifier avant de
publier » du 3 nov.), étendue pour Vinted : sans titre, sans prix, description < 5
caractères (`DESCRIPTION_MIN`), couleur absente, état absent — **jugés seulement s'ils
ont été LUS**. Ce que VRM n'a pas lu est nommé à part (`champsNonJuges`) : « Pas lu par
VRM : la couleur, la catégorie… L'extension les vérifie au lancement et demande ce qui
manque » (c'est `champsManquantsAvant`/`reglerAvant` de l'extension, inchangés).

**Lancer** ouvre le moteur existant (`RepublierVinted`) sur CES annonces, directement à
l'étape d'après « Choisir » (`depart` : `modif` pour republier/modifier/vers brouillon,
`envoi` pour mettre un brouillon en ligne). Rien ne part sans la case « Je confirme » du
moteur : aucune seconde règle, mêmes garde-fous (compte de l'onglet, 50 actions/h…).

## Republier à la main, accompagné

Une feuille en quatre étapes (`RepublierALaMain`) :

1. **Les photos** de l'annonce (coffre `coffre_{uid}_{id}`), avec les réglages choisis
   avant (lumière, contraste, saturation, chaleur, rotation ±15°, zoom ≤ 1,5 — les
   préréglages de Republier `vrm_photo_presets` s'y appliquent ; le dernier réglage est
   gardé dans `vrm_main_reglages`). « Télécharger les photos réglées » : chaque photo passe
   par `chargerPhotoBoite` (extension, sinon `/api/compte?mode=photo`), une toile applique
   les réglages (`ctx.filter`, sinon `appliquerCouleursPixels` pour Safari) ⇒
   `VRM-{N°}-01.jpg`… ;
2. **Le texte à copier** : titre, description, prix, marque, taille, état, chacun avec
   « Copier » ; s'il manque la description, c'est dit ;
3. **« Ouvrir Vinted — nouvelle annonce ↗ »** : ce clic note le début du suivi
   (`vrm_repub_main[ancienId] = { uid, num, titre, at }`, synchronisé) ;
4. **Remettre le N°** : la liste des annonces EN LIGNE **du même compte**, jamais
   l'ancienne, jamais une annonce numérotée à la main, jamais une annonce mise en ligne
   plus de 10 min avant qu'il commence, jamais une annonce déjà désignée pour une autre
   (`candidatsNouvelle`). **C'est SON clic qui désigne** (« C'est celle-ci » + confirmation
   « C'est bien la même paire ? ») — jamais le titre : au banc, une annonce au même titre
   sur l'autre compte n'est pas proposée.

Le N° : le lien `nouvelId → ancienId` (`liensRepubMain`) est **ajouté** à la table des
republications de l'extension (`recreesEff` = `recreesNum` + ses liens) ; c'est donc la
règle existante `repriseNumerosRecreation` (src/repriseNumero.js) qui remet le N° : elle
attend que l'ancienne ne soit plus en ligne (jamais deux annonces sous un N°), garde un N°
posé à la main sur la nouvelle, brûle le N° auto qu'elle avait reçu (`numeroRendu`). Le
suivi s'affiche au-dessus de la liste tant qu'il n'est pas fini (« Reprendre »), et « Ce
n'est pas elle » défait le lien.

## Mesuré (base de production, lecture seule, 5 nov.)

Dressings : 152 annonces en ligne, 12 masquées, 4 brouillons, 383 vendues. Vinted envoie
`is_processing` et `item_alert_type` sur les 2 annonces non allégées (valeurs `false` /
`null`) ; **l'extension ne les garde pas** (`CHAMPS_ARTICLE`, background.js ~l. 4312).
⚠️ Correction de la revue : `catalog_id` et `color1`/`color1_id` SONT dans
`CHAMPS_ARTICLE` depuis la 5.245, et pourtant aucun dressing en base ne les porte (0 sur
~650 annonces, captures du 5 nov.) ; et sur les 2 annonces non allégées, Vinted les envoie
**à `null`** (`color1: null`, `color1_id: null`, `catalog_id: null`) sur des annonces qui
ont une couleur et une catégorie. Le coffre a `catalogId` sur 551 fiches sur 777, **toutes
à `null`**. Donc aujourd'hui : aucune annonce n'est dite « en vérification » (pas su ≠ oui),
et couleur/catégorie sont « pas lues » (nommées à part, jamais jugées).

## Ce qu'il faut côté extension (non touchée, consigne)

1. `CHAMPS_ARTICLE` : garder `is_processing` et `item_alert_type` ⇒ l'état « en
   vérification » apparaît (l'app lit déjà `verifVinted`). ⚠️ Avant de s'y fier, MESURER
   les valeurs de `item_alert_type` d'une annonce réellement en vérification : l'app dit
   aujourd'hui « en vérification » pour toute valeur non vide.
   Couleur et catégorie : le DRESSING ne les donne pas (`null`, mesuré) — les garder ne
   suffit pas. Il faut les lire là où Vinted les remplit (la fiche de l'annonce,
   `/api/v2/item_upload/items/{id}` ou la page de l'annonce) et les ranger au coffre
   (`coffre_{uid}_{id}.catalogId`, `.couleur`), puis brancher la lecture du coffre dans le
   carré. L'app traite un `null` comme « pas lu » (`lusDuDressing`), jamais « absent ».
2. Republier à la main : quand un suivi `vrm_repub_main` est ouvert pour un compte, noter
   l'identifiant de l'annonce créée dans l'onglet `/items/new` (comme la réservation de
   `noterPublication`) et l'écrire en `ancienId` (`vinted_brouillon_{id}.ancienId` ou
   `coffre_….recreeDe`) ⇒ `tableRecrees` le lit déjà, il n'aurait plus à désigner.
3. Rien d'autre : `champsManquantsAvant`, `reglerAvant`, les moteurs et le plafond restent.

## Fichiers

- `src/annoncesActions.js` (neuf, règles pures) · `src/annonces-selection.css` (neuf)
- `src/verifAnnonce.js` : gestes Vinted, `DESCRIPTION_MIN`, `champsNonJuges`
- `src/App.jsx` : `mapWardrobeItem`, vues Brouillons/Sélectionner, `annSelectionnables`,
  `ChoixAnnoncesVinted`, `ActionsSelectionFeuille`, `RepublierALaMain`, `depart` de
  `RepublierVinted`, `recreesEff`, `vrm_repub_main` dans `SYNC_KEYS`
- `scripts/audit-annonces-actions.cjs` (47 contrôles, `--prouve` 13/13 mutations)
- `scripts/bancs/annonces-actions.cjs` (données inventées ; 390 tactile et 1512, clair et
  sombre ; 104 contrôles verts ; rouge sur `claude/project-review-nsk5su` : la vue
  « Sélectionner » n'existe pas)

## Preuves

- `npm run build` vert.
- `node scripts/audit-annonces-actions.cjs` 47/47 ; `--prouve` 13/13 mutations rouges ;
  sur l'arbre d'avant il plante (fichier absent).
- `BANC_PORT=7943 CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/bancs/annonces-actions.cjs`
  : 4 × vert (104 OK) ; sur l'arbre d'avant (git archive + build) : 4 rouges
  « une vue Sélectionner » (capture : écran Annonces normal, pas l'écran de connexion).
- Audits inchangés verts : tdz, variables, coherence, boutons, icones, verif-annonce,
  identite, photos-vinted. `chiffres` et `politique-hotes` sont rouges **à l'identique**
  sur l'arbre d'avant (préexistant).

## Revue adverse (5 nov.) — défauts trouvés et corrigés

Chacun reproduit d'abord (vm sur le commit 670d1fd1 : 6 défauts sur 6 ; banc K rouge),
puis corrigé, puis tenu par l'audit (section G, une mutation chacun) et le banc (K).

1. **« Sans prix » inventé dans Republier existant** : la règle Vinted étendue jugeait
   `prix: null` (prix illisible du dressing, `annoncesR`) comme « Sans prix — Mets un prix
   sur Vinted ». `null` = pas lu, pour le prix, le titre, la couleur, l'état, la
   description (`verifAnnonce.js`).
2. **« Couleur absente » / « Catégorie absente » latents** : `mapWardrobeItem` changeait
   `color1: null` en `''` et `catalog_id: null` en `''` ⇒ absence affichée sur TOUTES les
   annonces dès que l'extension garderait ces champs (le geste qu'on lui recommandait).
   Règle pure `lusDuDressing` : seule une valeur lue compte.
3. **Deux paires présentes sous un N°** : « à la main » est permis sur une masquée ou un
   brouillon, mais la reprise ne regarde que l'« en ligne » ; l'ancienne masquée encore
   chez lui passait pour partie et son N° allait aussitôt sur la nouvelle (prouvé au banc :
   N°45 sur 9110 ET 9121). Le lien posé à la main attend que l'ancienne ne soit plus ni
   en ligne, ni masquée, ni à confirmer, ni en brouillon (`liensRepubMain(…, { presentes })`).
4. **Un clic écrasait une identité prouvée** : `{ ...recreesNum, ...liens }` faisait
   gagner le lien à la main sur la table de l'extension ; c'est l'inverse
   (`fusionLiensRecrees`), et une annonce déjà remplaçante d'une autre n'est plus proposée
   (`candidatsNouvelle(…, recrees)`).
5. **Suivi sans N° ouvert à vie** : sans N° à remettre, rien à suivre (`etatSuiviMain`
   ⇒ « fait », et « Ouvrir Vinted » ne crée plus de suivi).
6. Libellé : « dès que l'ancienne n'est plus du tout sur Vinted — ni en ligne, ni masquée,
   ni en brouillon » (au lieu de « plus en ligne »).
7. **Deux sens pour une phrase** : la pastille de l'en-tête dit déjà « Actions possibles ·
   compte » (l'état de l'extension) ; le bouton de la sélection et le titre du carré disent
   maintenant « Actions · N » (le mot de Julien : « un petit carré Actions »).

Preuves de la revue : `repro` vm sur 670d1fd1 ⇒ 6 défauts / après ⇒ 0 ;
`audit-annonces-actions` 58 contrôles (section G), `--prouve` 20/20 mutations ;
banc `annonces-actions` (contrôles K) : 125 OK après, 10 rouges sur le build de 670d1fd1
(« Catégorie absente, Couleur absente » sur une annonce dont le dressing dit `null` ;
N°45 sur la masquée 9110 ET la nouvelle 9121). Captures regardées (390 sombre, 1512 clair).
Bancs voisins (même build, puis build de 670d1fd1) : `verif-publication` et
`brouillons-avancee` verts ; `republier` (4 rouges) et `annonces-ventes-brouillon`
(20 rouges) rouges À L'IDENTIQUE sur 670d1fd1 — préexistants, rien de nouveau.

Reste ouvert (non corrigé) :
- « En vérification » = toute valeur non vide d'`item_alert_type` : valeurs jamais mesurées.
- La description n'est jamais jugée en pratique (aucun dressing en base n'a `descLen`) ;
  le coffre a une description sur 126 fiches sur 777 — seulement une preuve de PRÉSENCE.
- Une nouvelle annonce republiée à la main reçoit d'abord un N° automatique (brûlé quand
  l'ancien N° passe dessus), comme pour Republier quand l'extension tarde.
- Les brouillons d'un compte masqué dans VRM restent montrés dans « Sélectionner »
  (`brVinted.liste`, la liste de « Voir mes brouillons », n'applique pas `garderAnnonce`).

## Geste de Julien

Annonces → « Sélectionner » : cocher deux annonces du même compte, ouvrir « Actions », lire « Avant de lancer » ; essayer « Republier à la main » sur une paire.
