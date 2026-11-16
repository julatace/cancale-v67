# 15 nov. 2026 — Atelier « achat arrivé → en ligne », historique complet, note, taille du texte

Branche `claude/atelier-arrivee` (partie de `origin/claude/project-review-nsk5su`, style « Verre dépoli » en
place). Julien a validé les quatre lots (« vas-y fais tout »). Poussée à chaque commit, pas de PR.

## Ce qui existait (lu avant de coder) et ce qui a été RÉUTILISÉ

| besoin | existait | réutilisé tel quel |
|---|---|---|
| N° et case à l'arrivée | « Ranger cet achat » (11 nov., `src/rangementArrivee.js`, `src/RangerAchat.jsx`, `preparerRangement` / `ecrireRangement`) | toute la règle (prochain N° jamais un trou, case libre, empilement, habitudes, lot, « Rangé » = pool d'abord puis geste annulable) ; le plan (`Plan`, exporté) |
| photos | studio photo (`src/StudioPhoto.jsx`, détourage local U²-Net, `studio_photos_{N°}`) ouvert par `ouvrirAtelier('studio')` | ouverture et relecture (`vrm:studio-range`) |
| prix d'achat | `src/prixAchatPropose.js` (`propositionPrixAchat` : reçu juste ⇒ « Payé sur Vinted », sinon « Article seul ») ; `src/prixAuNumerotage.js` (montant tapé relu) | les deux, sans rien changer |
| fiche « À publier » | `vrm_fiches_neuves` (créée par « Rangé », origine `arrivee`) ; « Créer sur Vinted » (`FeuilleCreerVinted`) ; « Publier partout » (`vrm:publier-partout`) | les trois |
| « fiche prête à l'arrivée d'un achat » | refusée/remplacée le 3 nov. par les suggestions — rien n'avait été construit | l'atelier ne DEVINE rien : la fiche part de l'achat relié PAR IDENTITÉ (n° de transaction), comme « Ranger cet achat » |
| historique | `src/histoireArticle.js` (3 nov.) + `src/paireHistoire/ligneDeTemps.js` (14 nov., « Dans l'ordre ») | la chaîne et son rendu |
| note | `src/notePaire.js`, `NotePaireCoque`, dictée `DicterNote` (navigateur seulement, `src/noteVocale.js`) | tout ; ajoutée à deux endroits |
| taille du texte | `src/grandTexte.js` : la Taille du texte de l'appareil devient une échelle de toute l'app (`applyZoom`), corrections `html[data-grand-texte]` (`src/styles-lisible.css`) | le mécanisme ; le choix de VRM s'y ajoute |

## 1. L'atelier « achat arrivé → en ligne »

`src/atelierArrivee.js` (règle PURE), `src/AtelierArrivee.jsx` (dessin, chargé à la demande),
`src/atelier-arrivee.css`, `AtelierArriveeCoque` dans `src/App.jsx`.

- **Déclencheur** : le MÊME événement que « Ranger cet achat » (`ouvrirRangement` ⇒ `vrm:ranger-achat`) :
  « J'ai retiré » (colis ou commande Vinted), la cloche « Où ranger », la carte « N achats à ranger » de
  Ma journée, les retraits au comptoir (après fermeture du scanner / mode relais). La feuille d'avant n'est
  plus montée (`<RangerAchatCoque/>` remplacé par `<AtelierArriveeCoque/>`) : une seule feuille.
- **Six étapes, une progression** (six traits qu'on touche ; fait = encre, passé = pointillé, courant = accent) :
  1. **N°** — la plaque N° proposée (ou le champ « Je numérote moi-même ») ; lot : le compteur et les N° à la suite ;
     « **Donner ce N°** » = l'écriture de « Ranger cet achat » appelée **SANS case ni prix** : le N° entre au pool,
     la fiche « À publier » de l'ARTICLE est créée (liée à l'achat par son n° de transaction) ;
  2. **Case** — (Julien, via le coordinateur : « on range une ANNONCE, pas un achat ») seulement APRÈS le N° :
     la case libre proposée À L'ARTICLE (`caseProposee`, lue sur les cases ACTUELLES — un lot passe article par
     article, chaque case écrite avant la proposition suivante : jamais la même case pour deux articles), le plan
     pour en toucher une autre ; « **Ranger ici** » (`opsCase` : refusée si la case a été prise entre-temps ou si
     l'article est déjà dans une case) ; « Plus tard » ;
  3. **Photos** — « Prendre les photos » ouvre le studio sur CE N° ; l'étape est faite quand le studio a
     rangé une photo sous ce N° (preuve lue, pas un drapeau) ;
  4. **Prix d'achat** — le prix PAYÉ de CET achat : le reçu juste (« Payé sur Vinted · Article · Port ·
     Frais ») sinon l'article seul (DIT : « sans le port ni les frais ») ; « Garder 41,90 € » (SON tap) ou
     « Corriger » (champ vide) ; un lot ⇒ rien proposé, « ≈ » en indication ; un N° qui a déjà un prix
     n'est jamais réécrit ;
  5. **Fiche** — titre, marque, taille, couleur (une seule couleur nommée dans le titre de l'achat, sinon
     vide), catégorie et état (ses choix), description, et **son** prix de vente — jamais pré-rempli
     (§3 : prix conseillé à la mise en ligne refusé). La note (et sa dictée) en tête ;
  6. **Publier** — « Créer sur Vinted » (le chemin existant, brouillon depuis l'onglet vinted.fr, c'est lui
     qui publie), « Ouvrir le brouillon », puis « Publier partout » une fois en ligne.
  Puis un **bilan** (fait / plus tard, étape par étape) et la note.
- **Chaque étape a « Plus tard »**. Passer le N° ferme l'atelier (sans N° la paire n'a pas d'identité :
  photos, prix et fiche s'attachent au N°) — l'achat attend dans Ma journée comme avant.
- **Reprise** : `vrm_atelier_arrivee` (SYNC_KEYS) garde SES « Plus tard » / « C'est fait » par fiche ; le
  reste se PROUVE par les données (fiche rangée, case, photos du studio, coût posé, `completeAt`, en ligne).
  Ma journée : « **N paires à finir** » (`pairesAFinir`, 30 jours, fiches `arrivee` pas retirées) ⇒
  « Reprendre » rouvre l'atelier à la première étape ni faite ni passée.
- **Rien sans son geste** : chaque écriture passe par `gesteVrm` (pilule « Annuler » 5 s) ; l'accompagnement
  dit avant ce qui va se passer et ce qui ne se passera pas (`acc.arrivee.*` : `arrivee.ranger`,
  `arrivee.case`, `arrivee.prix`, `arrivee.fiche` dans `GESTES_ACC`).
- **Le prix payé arrive avec l'achat** : `entreeAvecPaye` (écran Achats) pose sur l'entrée la proposition
  calculée AVEC le reçu de CET achat (`indexRecusAchat`, par n° de transaction) ; `prixPayeArrivee` ne
  l'accepte que si elle porte le MÊME n° de transaction.

### Décisions prises seul
- **Aucun « ranger » sur un achat** : la carte de Ma journée dit « N achats arrivés à numéroter » (« Commencer »),
  l'en-tête de l'atelier « Nouvel article » ; la case n'existe qu'une fois le N° donné. La notification de la
  cloche « Arrivé · Première case libre · Ranger » est retirée par l'autre chantier (`claude/pas-ranger-achat`).
- **Ordre N° → case → photos** (et non photos en premier) : le studio range les photos sous le N°
  (`studio_photos_{N°}`). Photographier avant le N° voudrait une photo sans identité, ou un N° écrit avant
  son geste. Mieux vaut un blanc qu'un faux (§5).
- **« Donner ce N° » n'écrit ni case ni prix d'achat** quand il vient de l'atelier : le prix a sa propre étape, sur
  SON tap (« Garder »), avec la source dite. La feuille d'avant écrivait le prix lu de l'article seul.
- **Catégorie** : l'achat Vinted ne porte pas de catégorie lisible (mesuré dans le code : pas de
  `catalog_id` sur `my_orders`) ⇒ jamais pré-remplie ; cinq choix (Baskets, Vêtements, Sacs, Accessoires,
  Autre), son toucher.
- Retour en arrière sur le N° une fois donné : non (un N° servi ne se reprend pas ici). Une case « Plus tard »
  se reprend ; une case posée se change dans le Stock.

## 2. L'historique complet sur la fiche

`src/paireHistoire/ligneDeTemps.js`, `src/paireHistoire/LigneDeTemps.jsx`, `src/histoireArticle.js`,
`lireExtraFiche` (App.jsx). La frise datée (« Dans l'ordre ») est désormais la **vue par défaut** de la fiche.
Ajouté, chaque fois **par identité** :
- **offres** reçues / faites, avec leur **état lu** (`etatOffreVinted` : acceptée, refusée, en attente,
  terminée) — par l'`item_id` de la transaction de la conversation ; la date ISO de Vinted est lue (avant :
  « date inconnue », et une date absente donnait 1970) ;
- **masquée / de nouveau visible / disparue** — les événements que l'extension a constatés sur deux
  lectures COMPLÈTES (`moderation_vinted_{uid}`, projetés), par identifiant d'annonce ; pas lus ⇒ nommés ;
- **retour reçu / remise en stock** — SES clics (Ventes → Retours), par n° de transaction d'une vente de CE N° ;
- **republiée · même N°** (la paire garde son N°, `repriseNumero`) ;
- **le vendeur de l'achat** — seulement pour l'achat RELIÉ (`buyFrom.seller` de la fiche qui porte ce
  `buyFromId`), jamais pris sur une autre fiche, jamais inventé.
Ce qui existait reste : achat, réception, numérotage, photos, mise en ligne, prix (baisse/hausse), vente,
colis, versement, annulation ; « date inconnue » ; « pas encore lu » ; N° en double ⇒ aucune histoire.

## 3. La note

Déjà synchronisée (`vrm_notes_paires`), sur la fiche avec dictée. Ajoutée :
- dans l'**atelier** (étape fiche et bilan), avec la dictée du navigateur (Safari/Chrome ; sinon le bouton dit
  pourquoi, le clavier reste) ;
- **à côté de la conversation** d'un acheteur, sous la carte de la paire du fil : la paire par SON identité
  (N°, sinon l'annonce de la transaction), une note seulement si elle existe. Jamais insérée dans un message.

## 4. La taille du texte

`src/tailleTexte.js`, Paramètres → Affichage → **Taille du texte** (juste sous Apparence) : Normal ·
Grand (1,12) · Plus grand (1,24) · Très grand (1,36), chaque ligne écrite à sa taille. Rangée sur CET
appareil (`vrm_taille_texte`). Elle passe par le mécanisme du texte en grand de l'appareil : appareil ×
choix, borné à 1,6, `html[data-grand-texte]` posé ⇒ les corrections de `styles-lisible.css` s'appliquent.
**Pourquoi pas seulement les jetons de taille du studio** : mesuré, ~3 160 `fontSize` en ligne dans le JSX
et ~3 130 tailles en px dans les CSS ; les jetons (`--d-t-*`) n'en portent qu'une petite part — changer
les jetons seuls aurait grossi un tiers des textes et laissé le reste petit. L'échelle grossit textes,
marges, cibles et photos ensemble ; la mise en page se refait sur une largeur plus étroite.
Au téléphone, l'ancien réglage « Taille de l'affichage » (densité) ne s'affiche plus que s'il porte une
valeur à défaire ; sur ordinateur il reste (densité Minus → Grand).

## Les preuves

- `node scripts/audit-atelier-arrivee.cjs` — **38 verts** : A1 prix payé par identité sur 50 achats au même
  titre (sans n°, lot, remboursé, autre devise, prix pas lu ⇒ rien ; reçu d'un autre achat refusé), A2 écriture
  du prix (jamais par-dessus), A3 étapes et reprise (« pas lu » ≠ fait), A4 fiches par identité sur 50 fiches
  au même titre, A5 fiche pré-remplie (prix de vente vide), A6 « Enregistrer », A7 Ma journée, A8
  branchements ; H1–H4 historique sur 50 paires identiques (offres, masquages, retours, vendeur, même N°,
  date ISO) ; N1–N2 note à côté du fil ; T1–T3 taille du texte.
- `node scripts/audit-atelier-arrivee.cjs --prouve` — **16/16 mutations rouges**.
- Sur l'arbre de départ (`git archive origin/claude/project-review-nsk5su`, `--src`) : **rouge** (C0).
- Audits verts : traduction (AtelierArrivee.jsx ajouté aux écrans migrés), tdz, variables, quoi-de-neuf,
  accompagnement, icones, identite, numeros-lettres, numeros-nouvelles, numeros-vestiaire, studio, csp,
  coherence, idees-paires, note-achat-double, rangement-guide, annonces-outils, finitions-v36.
  `numeros-clenum` : 1 rouge (`src/aRetirerAilleurs.js`), **le même sur l'arbre de départ**, hors lot.
- Deux audits jugeaient l'orthographe d'hier, réécrits sur la RÈGLE (dit ici, §6) :
  `audit-idees-paires` B2 accepte des sources ajoutées après `lireStudio` ; `audit-rangement-guide` A3/A5
  acceptent `entreeAvecPaye` et `<AtelierArriveeCoque/>`.
- Audit après la demande « on range une ANNONCE, pas un achat » : **42 verts**, `--prouve` **19/19 mutations
  rouges** (dont : « Donner ce N° » qui écrirait une case ou un prix, un article rangé deux fois, une case prise
  donnée à un autre article, la case proposée avant le N°). A9 : un lot de 5 articles, 4 cases libres ⇒ 4 cases
  différentes, la 5e « plus de case ».

### Bancs (build de la branche, base inventée, `BANC_DIST` pour un autre arbre)
- `scripts/bancs/atelier-arrivee.cjs` (390 tactile clair + 1512 sombre, dsf 2 au téléphone) : **121 verts** —
  « J'ai retiré » ⇒ l'atelier, N°13 (jamais un trou), rien d'écrit ; « Donner ce N° » ⇒ fiche + pool, ni case ni
  prix, pilule « N°13 donné » ; la case de l'ARTICLE (première libre, une prise ne réagit pas) ; « Ranger ici » ;
  photos « Plus tard » ; le prix LU « 38 € · Article seul » ; fermer ; Ma journée « 1 paire à finir » ⇒ reprise
  au prix ; « Garder » ⇒ 38,00 ; la fiche (titre, marque, couleur de l'achat, prix de vente vide, la note) ;
  « Enregistrer » ; « Créer sur Vinted » ; le bilan ; Ma journée ne rappelle plus. À chaque étape : un plein,
  44 px, rien ne déborde, aucune clé brute, ni violet, et **le corps de l'étape se voit** (une animation
  d'entrée figeait le contenu à l'opacité 0 en 1512 sombre : trouvé par la capture, corrigé, contrôle ajouté —
  6 rouges sur le build d'avant la correction). **Rouge sur l'arbre de départ** (`dist-avant` : W1).
  Le banc `rangement-guide.cjs` (feuille d'avant) est remplacé par celui-ci.
- `scripts/bancs/taille-historique.cjs` : **12 verts** — Paramètres → Taille du texte (quatre choix ≥ 44 px),
  « Très grand » ⇒ échelle 1,36 et `data-grand-texte="tres"`, rangée sur l'appareil, rien ne déborde ;
  au rechargement Ma journée est en « Très grand » ; la fiche d'une paire ouvre sur l'historique.
- `scripts/bancs/finition.cjs` (`VUES=390-clair,390-taille136`, nouvelle vue : la taille de VRM, jugée G1–G3 comme
  le grand texte de l'appareil) sur Ma journée, Annonces, Ventes, Stock, Argent : **Ma journée, Ventes, Stock,
  Argent verts** (G1 le texte grandit ×1,33 à ×1,38, G2 rien ne sort, G3 rien de coupé ni recouvert).
  **Annonces : G1, G2 verts, G3 1 rouge restant** — la BOÎTE du titre d'une rangée (déjà coupé par « … ») touche
  celle du prix ; le texte lui-même ne se recouvre pas (capture). Avant les corrections de `styles-lisible.css`,
  à 1,36 : 7 défauts (« ⋯ Modifier » hors de l'écran sur Annonces et Ventes, « Annon/ces » coupé, titres de
  rangée sur la ligne de la taille, colonne de texte du Stock à 28 px — « N… », « Vint|ed » —, filtres du Stock
  sous « Tous », onglets d'Argent l'un sur l'autre) ; ils existaient AUSSI avec la Taille du texte de l'iPhone
  (même mécanisme). Les rouges de la vue `390-clair` (espace avant « € », cibles du N° et de la recherche du
  Stock, « à expédier », contraste d'un compteur de Ventes) ne viennent pas de ce lot.
  Deux retouches du banc, dites ici (§6) : la barre du bas est nommée comme barre fixe (sous zoom, sa position
  se lisait mal et chaque rangée passant dessous comptait comme « recouverte ») ; `CSS_ESSAI=` (outil de mise au
  point) injecte une feuille d'essai.

### Captures (base inventée)
Atelier : `atelier-390-clair-{1-numero,2-case,3-photos,4-prix,5-journee,6-fiche,7-publier,8-fin}.png` et
`atelier-1512-sombre-*.png` ; taille du texte et historique : `reglages-taille-*.png`, `journee-tres-grand-*.png`,
`fiche-historique-*.png` ; finition : `finition-<écran>-390-taille136.png` (dossier des captures du rapport).

## Ce qui reste / limites
- Le banc `scripts/bancs/rangement-guide.cjs` attend la feuille d'avant (`[data-ranger-feuille]`) : il est
  remplacé par `scripts/bancs/atelier-arrivee.cjs` (mêmes données, mêmes exigences R1–R3, plus les étapes).
- « Publier partout » ne sait publier qu'une paire déjà en ligne sur Vinted (sa source) : l'atelier propose
  donc d'abord « Créer sur Vinted ».
- Les photos du studio ne sont pas encore reprises automatiquement par « Créer sur Vinted » (la feuille
  laisse les choisir) — chantier à part.
- Geste de Julien : aucun (essayer « J'ai retiré » sur un achat, et Paramètres → Taille du texte).

## Intégration avec `claude/pas-ranger-achat` (16 nov., vague B)

Décision de Julien (« on range une ANNONCE, pas un achat »), appliquée à la fusion :
- La feuille « Ranger cet achat » n'est plus montée ni importée (`RangerAchatCoque`, `proposerRangement`,
  `ouvrirRangement`, `entreeRangementVinted/Colis`, `preparerRangement`, `ecrireRangement` n'existent plus).
- Le N° de l'atelier : `preparerNumero` / `ecrireNumero` (App.jsx) — le prochain N° libre ou le sien tapé,
  **aucune case calculée pour un achat** (`cases: []`) ; `ecrireNumero` écrit le pool puis la fiche, sans case ni prix.
- La case vient APRÈS le N°, sur la fiche de l'article : `caseProposee` (src/atelierArrivee.js) appelle la règle
  du Stock `casesProposees` (src/ouRanger.js) pour CE N° (empilement compris ; les cases écrites ou réservées
  comptent comme prises ⇒ jamais la même pour deux articles). L'« habitude » de case n'est plus utilisée ici.
- « J'ai retiré » ouvre l'atelier sur le N° (`ouvrirAtelierArrivee`, événement `vrm:atelier-numeroter`) ; au
  comptoir (scanner, mode relais), après leur fermeture. Les achats notés attendent dans Ma journée
  (`id: 'achats-a-numeroter'`, « N achats arrivés à numéroter »).
- Clé neuve sur l'appareil : `vrm_arrivees_a_numeroter`. Les anciennes propositions `vrm_ranger_proposes` (qui
  proposaient une case à un achat ; certaines paires sont en ligne depuis sous leur N°) ne sont plus lues, rien
  n'est effacé.
- Le rattrapage du pool reste porté par `RattrapageNumerosRanges` seul.
- Audits réécrits sur la règle : `audit-pas-ranger-achat` A1/A1c/A2 (8/8 mutations), `audit-rangement-guide`
  A1–A5 (14/14), `audit-atelier-arrivee` A8b, A9a (une case par N°).
