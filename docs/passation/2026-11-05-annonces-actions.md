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
`null`) ; **l'extension ne les garde pas** (`CHAMPS_ARTICLE`, background.js ~l. 4312), ni
`catalog_id` ni `color1`. Donc aujourd'hui : aucune annonce n'est dite « en vérification »
(pas su ≠ oui), et couleur/catégorie sont « pas lues » (nommées à part, jamais jugées).

## Ce qu'il faut côté extension (non touchée, consigne)

1. `CHAMPS_ARTICLE` : garder `is_processing`, `item_alert_type` (« en vérification »),
   `catalog_id`, `color1`/`color1_id` (et `description` en `descLen` si pas déjà) ⇒ le
   carré juge couleur et catégorie, et l'état « en vérification » apparaît. L'app les lit
   déjà (`mapWardrobeItem` : `verifVinted`, `catalogId`, `couleur`, `statusLu`).
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

## Geste de Julien

Annonces → « Sélectionner » : cocher deux annonces du même compte, ouvrir « Actions
possibles », lire « Avant de lancer » ; essayer « Republier à la main » sur une paire.
