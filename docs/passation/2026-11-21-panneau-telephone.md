# 21 nov. 2026 — Le panneau de l'extension au téléphone (ext. 5.413.0, branche `claude/panneau-telephone`)

Julien, 21 nov., avec trois photos du panneau d'un outil concurrent à l'ordinateur (Articles, Commandes, Notifications —
regardées, jamais copiées dans le dépôt) : « je veux que ce soit dans ce style-là, surtout sur le téléphone ; fais ça
pour l'extension déjà, que ce soit comme ça pour téléphone ». Il utilise **Orion** (navigateur iPhone qui fait tourner
les extensions Chrome) : le grand panneau doit être parfait sur 390 × 844, au doigt.

**Seulement la présentation** : aucun geste, aucune règle, aucun garde-fou ne change (`audit-actions-gardees` vert,
aucune ligne des moteurs de `background.js` touchée — seule `CODE_VERSION` monte).

## Ce qui change (téléphone et Orion, ≤ 760 px)

- **Barre du bas = cinq onglets égaux** : Accueil · Articles · Commandes · Messagerie · **Plus**. Avant : huit entrées
  dans une rangée qui défilait, « Notifications » et la suite coupées hors de l'écran. « Plus » ouvre une **feuille du
  bas** (Favoris · Notifications · Automatisations · Paramètres), un voile derrière ; toucher le voile, Échap ou une
  page la referme. « Plus » s'allume quand la page ouverte est l'une des quatre. Fonction : `barreTelephone6`
  (`vrm-badge.js`), état `vxPlus` (jamais rangé : la feuille se referme à chaque page).
- **En-tête** « Titre · pastille du compte · × », puis **« Mis à jour il y a … ⟳ »** en gris sous le titre (avant :
  l'icône seule, le texte caché au téléphone). Le toucher relit, comme avant.
- **Barre d'outils** : la recherche sur toute la largeur, puis « Choisir une action ▾ » et « Statut ▾ » sur une ligne.
  Notifications : le type sur une ligne, Tous / Nouveau / Vu en dessous (avant : « No… » coupé).
- **Les menus Statut et Colonnes deviennent des feuilles du bas** (pleine largeur, rangées de 52 px, zone sûre), avec un
  voile : le toucher sur le voile les referme (c'est le `summary` du `details`, aucun nouvel écouteur).
- **Les rangées empilées** (Articles, Commandes, Favoris) : case 44 · vignette 48 · **titre complet** (plus de coupe à
  deux lignes : la phrase d'état de Vinted, « Envoie le colis avant le 23 nov. », était cachée par la coupe) · ⋯ ; dessous
  la **ligne méta sans libellés** « 55 € · 21/11/2026 14:51 · [En vente] », puis « Vues 30  Favoris 0 ♥ » ; Commandes :
  le transporteur avec son logo sur sa ligne, puis « Imprimer » ; une cellule vide (« — ») ne s'écrit plus au téléphone.
- **Champs à 16 px** dans tout le panneau (recherche, « Choisir une action », prix, textes) : Safari / Orion ne zooment
  plus à la saisie (avant : 15 px pour les listes et les prix).
- Accueil : « Nouvelle vente · <titre> » en entier, le bouton d'impression dessous.
- Défilement natif inchangé (`overflow-y: auto`, `overscroll-behavior: contain`, jamais `-webkit-overflow-scrolling`).

**À l'ordinateur (1512 px) : rien ne change** — la feuille « Plus » s'y fond dans la barre latérale (`display: contents`),
le bouton « Plus » ne s'y montre pas. Mesuré : les captures 1512 des huit pages sont identiques octet pour octet entre la
5.410.8 et la 5.413.0 (sept sur huit ; Articles ne diffère que par le survol de la souris sur la dernière rangée, regardé).

Langues : deux clés, `v6_plus` et `v6_plus_titre`, en cinq langues dans `vrm-ui.js` (`audit-traduction` vert).

## Preuves

- **Banc neuf `scripts/bancs/panneau-telephone.cjs`** : le vrai `vrm-badge.js` + `vrm-ui.js`, le faux `chrome` et les
  données inventées de `grand-panneau.cjs` (titres longs en plus). Chaque page du panneau (8) à 390 × 844 au doigt
  (agent d'Orion), 390 sombre, et 1512. Mesures : aucun débordement horizontal (page, panneau, corps, chaque rangée :
  `scrollWidth ≤ clientWidth`), chaque cible visible ≥ 44 px (une case par son label), titres jamais coupés
  (`scrollHeight ≤ clientHeight`), champs ≥ 16 px, barre du bas = 5 onglets égaux dans l'écran, « Plus » ⇒ feuille
  pleine largeur avec les 4 autres, feuille refermée en arrivant, « Mis à jour » dit, ligne méta sans libellés sur une
  ligne (prix, date, étiquette à la même hauteur ; le « · » lu dans `::before`), menu Statut en feuille du bas ;
  à 1512 : barre latérale 232 px et 8 entrées, pas de « Plus », en-têtes de colonnes.
  **Nouveau code : 179 verts, 0 rouge.** **Ancien code** (`BANC_EXT=<git archive origin/main>/vinted-sync-extension`) :
  rouge partout au téléphone (barre qui défile, champs 15 px, libellés, titres coupés, menus en liste déroulante,
  « Mis à jour » caché, « × » de 43 px), **zéro rouge à 1512** (rien n'a régressé).
- **WebKit** : `npx playwright install webkit` refusé ici (téléchargement bloqué) ; le banc le joue s'il est installé
  (`playwright.webkit.launch()`), sinon il le dit et joue Chromium avec l'agent d'Orion.
- `grand-panneau.cjs` adapté (deux contrôles) : au téléphone la barre montre les 4 premières pages + « Plus », et « Plus »
  montre les 4 autres. Résultat : **6 rouges, les mêmes que sur `main` avant ce lot** (le contrôle « Voir l'onglet,
  Directe, message lot, offre 10–20 s » de la 5.410.3, rouge sur `main`, pas touché ici).
- `grand-panneau-sites` 112 verts · `panneau-favoris-tableau` 134 verts · `panneau-persistant` 43 verts / 6 rouges, **les
  mêmes 6 sur l'ancien code** (1512 : hôte retiré, worker tué, impression « les 2 ») — pas de ce lot.
- `audit-coherence` vert (après `git fetch --unshallow` : l'historique de `main` doit être lisible), capacité
  `panneautelephone` (`vrm-badge.js:barreTelephone6`) à 5.413.0 ; `audit-traduction` 45 verts ;
  `audit-actions-gardees` 12 verts ; `audit-quoi-de-neuf` vert ; `audit-extension-zip` : seulement les 5 rouges du zip
  non régénéré (voulu : l'intégrateur le fera) ; `npm run build` vert.

## Version et ce qui reste

- **5.413.0** posée partout (`CODE_VERSION`, manifeste, `lbc-inject.js`, `lbc-relay.js`, `EXT_ATTENDUE`,
  `public/extension-version.json`). En parallèle : 5.411.0 (relais, `background.js`) et 5.412.0 (Vestiaire) — ce lot ne
  touche que `vrm-badge.js` (présentation), `vrm-ui.js` (deux clés) et la ligne de version de `background.js` ; à
  l'intégration, garder 5.413.0 (la plus haute) et **régénérer les zips** (`node scripts/zip-extension.cjs`).
- Pas fait : les notifications n'ont pas de vignette ni la phrase « x a marqué ton article … comme favori » des photos
  (le fond ne fournit que le type, l'identifiant et l'heure — il faudrait le lire dans `background.js`, hors de ce lot) ;
  à l'ordinateur, un titre long coupe encore à deux lignes la phrase d'état de Commandes (inchangé exprès : « rien ne
  doit régresser »).
- Geste de Julien : après l'intégration, installer la 5.413 dans Orion (`VRM-Orion-dossier.zip`) et ouvrir le panneau.
