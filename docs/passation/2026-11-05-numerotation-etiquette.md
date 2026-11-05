# 5 novembre 2026 — Le N° dans le texte de l'annonce, et le N° changé à la main (branche `v31-numerotation`)

Demande de Julien (pages manuscrites et vocal du 5 nov., `demandes-2026-11-05.md` §3) :
« les numéros sur les annonces Vinted doivent être bien mieux positionnés » ; « plus de choix pour
l'étiquetage, l'app accompagne » ; « plusieurs façons d'étiqueter, des rythmes variés, pas
simplement 1, 2, 3, 4 » ; « attribuer/modifier le N° à la publication et après ».

## Ce qui existait (mesuré avant d'écrire)

- Le **format** des numéros (`vrm_num_prefixe` : chiffres, ou série à lettre B1, C1…) — décide QUEL
  numéro est donné. **Pas touché.** Aucune règle de numérotation automatique n'a changé.
- Une **pastille** « N°12 » posée par l'extension sur vinted.fr (`vinted-capture.js` : carte du
  dressing, à côté du `h1` de la page d'annonce, à côté du bouton « Ajouter » du dépôt où le N° est
  réservé, `reserverNumeroPourOnglet`). Visible dans SON navigateur seulement.
- La **lettre** ajoutée en bas de la description par Republier (`lettreFin`, « \n\nk »).
- **Aucun** réglage qui écrive le N° dans le titre ou la description d'une annonce Vinted.
- Changer un N° : le champ de la carte Annonces (`EnLigne` → `poserNumero`, `manuelAt`) existait, avec
  ses garde-fous (ancien B… refusé, N° porté par une autre paire présente refusé, N° déjà servi
  demandé). Mais l'**ancien** N° n'allait dans aucune liste : seul un doublon réglé par VRM
  (`reattribue`) arrivait dans « nouveaux numéros à écrire sur tes cartons ».

## Ce qui est fait

### 1. « Le N° sur tes annonces Vinted » (Réglages → Numéros de rangement)
- La règle : **`src/etiquetteNumero.js`** (un propriétaire, §11). Réglage synchronisé
  `vrm_num_vinted` = `{ place, forme }`, ajouté à `SYNC_KEYS`.
  - places : `aucune` (défaut — aucun texte ne change), `titre_fin`, `titre_debut`, `desc_debut`,
    `desc_fin` ; chacune avec ce qu'elle implique (visible dans les listes ? vue par l'acheteur ?).
  - formes (« rythmes ») : `N°12`, `#12`, `Réf 12`, `(12)`, `[12]`, `n12` (la forme que Julien
    écrivait déjà dans ses titres, « n20 »). Un N° à lettres s'écrit tel quel (« Réf B125 »).
  - `poserEtiquette({titre, description}, num, reglage, {ancien})` : pose UNE étiquette au bord
    choisi ; retire d'abord l'étiquette de l'**ancien** N° (jamais « N°12 N°40 ») et un doublon du
    même N° ; ne touche que la zone où il écrit (écrire en description ne retouche jamais un titre
    « taille (42) ») ; un nombre nu n'est jamais une étiquette (« Air Max 90 », « brun12 ») ; titre
    > 100 caractères ⇒ **refus dit**, jamais coupé ; la lettre de Republier reste la dernière ligne.
  - **§5 : l'étiquette n'est jamais une identité.** Le module n'exporte aucune lecture de N° dans un
    texte ; l'audit le vérifie.
- L'écran (`NumeroSurVinted`, `src/App.jsx`, monté dans `NumerosSetting`) :
  - **« Je t'aide à choisir »** : deux questions (où regardes-tu le N° quand une vente tombe ? tes
    acheteurs peuvent-ils le voir ?) → une proposition avec sa raison (`proposition`), prise
    seulement sur « Prendre ce choix » ;
  - le choix de la place (5 lignes radio avec leur conséquence) et de la forme (puces 44 px) ;
  - **aperçu en direct** sur une annonce INVENTÉE (`ANNONCE_EXEMPLE`) : la carte (prix, titre), la
    description, et le titre « dans une liste étroite » (montre qu'en fin de titre une liste peut
    couper le N°) ; l'étiquette est surlignée ; l'exemple suit SA série (« C12 » s'il numérote en C) ;
  - « pas su ≠ oui » : la phrase dit où le réglage s'applique **aujourd'hui** (les textes que VRM
    prépare à copier) et que les annonces en ligne ne sont pas réécrites ;
  - un mode d'emploi (`GuideReglage`) en trois étapes.
- Appliqué dans l'app : « Rédiger une annonce (IA) » (le titre et la description copiés portent
  l'étiquette, `data-ia-etiquette` ; refus du titre long dit).

### 2. Changer le N° à la mise en ligne et après
- **À la mise en ligne** : bloc « Une mise en ligne numérotée par VRM » en tête d'Annonces
  (`blocNouveaux`, `data-num-neufs`) — les annonces numérotées par VRM depuis moins de 48 h
  (`auto`, ni `manuelAt`, ni `reattribue`, ni `repriseAt`), et publiées depuis moins de 48 h quand
  Vinted donne la date (une vieille annonce numérotée au premier passage n'y est pas). Chaque ligne
  porte le **même champ** que la carte (`EnLigne` → `poserNumero`) ; « C'est bon » range la ligne
  sur CET appareil (`vrm_num_neufs_vus`, commodité locale, try/catch).
- **Après** : le champ N° de la carte, inchangé.
- **L'ancien N° à barrer** : `poserNumero` note maintenant `reattribue: { de, vers, at, main: true }`
  à chaque N° posé à la main sur une annonce qui en avait un (`changeAMain`, les 5 chemins : libre,
  déjà servi « même article », « Prendre le N°x », « Non — N°x », reprise). Il arrive donc dans la
  MÊME liste que les doublons réglés (`reattribueAEcrire`, inchangée) jusqu'à « C'est écrit » :
  « Changé par toi » ou « Doublon réglé par VRM ». Changé deux fois avant d'avoir écrit ⇒ le carton
  porte le PREMIER (12 → 40 → 41 dit « 12 → 41 ») ; revenu au premier ⇒ plus rien à barrer.
  `corrigerCarton` (« le carton dit N°58 ») passe `{ carton: true }` : rien à barrer.
- Avec un endroit choisi, chaque ligne dit « sur Vinted, remplace « N°7 » par « N°40 » à la fin du
  titre » et offre « Copier « N°40 » ».
- Le contrôle d'impression (« As-tu écrit le N° sur le carton ? ») dit « Tu as changé ce numéro »
  au lieu de « doublon réglé » quand c'est son geste.
- Garde-fous §5 inchangés et rejoués au banc : un ancien N° reste brûlé (le pool ne rend rien),
  jamais un ancien B… (`numeroReprenable`), N° porté par une autre paire présente ⇒ demandé
  (« déjà pris »), Annuler ⇒ rien ; le rouge reste réservé aux doublons (`conflitsNum`).
- Base : la garde 017 accepte un changement à la main (`manuelAt` après la coupure) ; aucune fiche ne
  disparaît (`vrm_fiche_perdue`), le pool ne rétrécit pas. Rien n'a été écrit en base.

## Preuves
- `npm run build` vert.
- `node scripts/audit-etiquette-numero.cjs` : **20 verts**. Sur l'arbre d'avant (`git archive HEAD`,
  audit copié dedans) : **5 rouges**. Mutations : `retirerEtiquette` sans effet ⇒ 5 rouges ; retrait
  sur toutes les zones ⇒ 2 rouges ; `changeAMain` retiré du chemin « N° libre » ⇒ 1 rouge.
- Banc `scripts/bancs/numero-etiquette.cjs` (`BANC_PORT` 7963 par défaut, données inventées, 390 px
  tactile et 1512 px, clair et sombre) : **124 verts**. Sur le build d'avant (`BANC_DIST`) :
  **32 rouges** (le réglage et le bloc absents ; « N°7 → N°40 » jamais noté ni listé). Mutation
  `changeAMain` retiré du chemin « N° libre » (build séparé) : **24 rouges**. Captures regardées
  (réglage, aperçu, bloc mise en ligne, ligne « à écrire »).
- Verts : `audit-fusion-nuage`, `audit-conflits-numeros`, `audit-numero-vinted`,
  `audit-numeros-lettres`, `audit-garde-numeros-rapide` (017), `audit-reprise-numero`,
  `audit-coherence`, `audit-icones`, `audit-masquees-numeros`, `audit-recherche-numero`,
  `audit-renum-b`, `audit-numeros-vestiaire` ; bancs `deux-appareils` (33), `numeros-lettres`,
  `numero-vinted`, `numeros-panne`, `numeros-reconnexion`.
- Rouges **déjà rouges avant** ce chantier (mêmes rouges sur le build d'avant, voir plus bas) :
  `audit-numerotation-lecteurs` (1 : `appelEbay`, pas touché), bancs `numeros-doublons` et
  `numeros-remise-a-zero` (« 0 écriture » vers le nuage : le banc sert une base non cloisonnée,
  l'app n'y écrit plus depuis l'isolation des boutiques).

## Ce qui reste — côté extension (une autre session y travaille ; rien n'a été touché)
1. **Écrire l'étiquette dans l'annonce Vinted elle-même.** Le réglage `vrm_num_vinted` est dans
   `main` (synchronisé). À faire dans `vinted-sync-extension/background.js` :
   - `recreerVinted` / `republierVinted` / `publierBrouillon` (Republier, en ligne ↔ brouillon) : au
     moment de composer `titre` et `description` (là où `lettreFin` est ajoutée,
     `descBase`/`description`, ~l. 10600), appliquer la MÊME règle que `poserEtiquette` avec
     `msg.num` (le N° que l'app envoie déjà, `num: b.numero`) et `ancien` (le N° précédent si l'app
     l'envoie). Recopier la règle par script (bloc `<etiquette-num-regle>` identique app/extension,
     comparé par un audit, comme `<enligne-regle>`), jamais à la main. Garder : titre ≤ 100 ⇒ sinon
     refus nommé (« le titre dépasserait 100 caractères ») et l'annonce part SANS étiquette ou pas du
     tout (à décider avec Julien), lettre de Republier toujours en dernière ligne.
   - Changer le N° d'une annonce déjà en ligne : passe par `republiermodif`
     (`corpsAvecPrixBaisse` : le corps d'édition `PUT /api/v2/item_upload/items/{id}`) — la requête
     d'édition observée sert aussi au titre/description ; sur SON clic, dans les 50 actions/h, une à
     la fois, compte de l'onglet (`garde`).
   - Dépôt (`/items/new`, `vinted-capture.js`) : la pastille « N°74 — écris-le sur le carton » peut
     proposer « Copier « N°74 » » selon la forme choisie (lecture seule de la page, rien ne clique).
   - Capacité à ajouter dans `EXT_CAPACITES` (app) une fois publiée : `numtexte` → fonction (par ex.
     `poserEtiquetteVinted`) à la version qui la porte ; alors seulement l'écran pourra dire « écrit
     dans tes annonces » (aujourd'hui il dit le contraire, exprès).
2. **« Mieux positionnée » au sens de la pastille** : si Julien parlait de la pastille de l'extension
   sur vinted.fr (et non du texte), sa position se règle dans `vinted-capture.js`
   (`epingler`, `poserSurPage` : à côté du `h1`, sinon `fixed` en haut à gauche, `top: 76px`). À lui
   demander avec une capture.

## Gestes de Julien
- Paramètres → Numéros de rangement → « Le N° sur tes annonces Vinted » : répondre aux deux
  questions, regarder l'aperçu, choisir.
- Annonces : après une mise en ligne, toucher le N° de la ligne « numérotée par VRM » pour mettre
  celui de son carton ; barrer l'ancien et toucher « C'est écrit ».
