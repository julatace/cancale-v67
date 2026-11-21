# 15 nov. 2026 — La liaison achat ⇄ article (branche `claude/achats-liaison`)

## Ce que Julien a dit

« Je veux que tu améliores la liaison entre les achats et les articles en vente ou vendus, avec les
titres, dates de retrait, couleur de l'article, etc. »

## La mesure (vraie base, LECTURE SEULE, 15 nov.)

Rien de réel n'est dans le dépôt : les chiffres ci-dessous sont des comptes et des pourcentages.

- **Achats Vinted captés** : 2 666 (15 comptes), dont 638 remboursés ⇒ ~2 028 achats valables ;
  **11** reliés à un article par lui (n° de transaction posé sur la fiche) ⇒ ~2 017 achats sans article.
- **Fiches numérotées** : 572 ; 11 reliées à un achat, 3 avec un prix tapé sans achat ⇒ **518 sans achat
  relié** (220 encore en ligne). **Ventes** : 2 580 (2 313 non annulées), **aucune** reliée à un achat ;
  165 portent un prix tapé à la main.
- **Les champs, côté achat** (`my_orders`) : titre, prix, date de COMMANDE, statut, photo (608 sur 2 666,
  23 %) — **ni marque, ni taille, ni couleur, ni catégorie**. Le détail de transaction (livraison, nombre
  d'articles) n'existe que pour **43** achats ; la date de livraison/retrait n'est donc lue que rarement
  (`dateReception` : livraison lue ou « Je l'ai retiré » touché).
- **Côté annonce** : titre, marque (champ), taille, prix, photo, id ; le détail (`vinted_item_details`,
  329 annonces) porte `codes.catalog_id` (91) et `codes.color_ids` (49), mais le libellé `couleur` y est
  **vide 151 fois sur 151** et aucune table id → couleur n'existe dans la base (elle vit dans
  l'extension). La couleur se lit donc dans le TITRE (des deux côtés). `catalog_id` est absent côté
  achat : inutilisable pour rapprocher.
- **La vérité terrain** : ses 11 liaisons. Leurs titres d'achat sont typiques : « Salomon xt-6 vert
  kaki », « Salomon XT 6 Noir », « Nike shox », « Nike Schuhe Gr 39 », « Nike Air Max 1 Lemonade (yellow
  and green) » — **6 sur 11 sans taille**. Mise en ligne : 8 à 16 jours après la commande (3 fois ~5 mois).

### L'ancienne règle rejouée (`suggestionsAchat`, taille OBLIGATOIRE dans le titre de l'achat)

| sur ses 11 liaisons | top-1 | top-3 | rien proposé |
|---|---|---|---|
| ancienne règle | **45 %** (5) | **45 %** | 5 |
| nouvelle règle, article seul | **82 %** (9) | **91 %** (10) | 0 |
| nouvelle règle, affectation globale (2 516 articles : fiches + ventes) | **73 %** (8) | **91 %** (10) | 0 |

« Très probables » sur toute la base : **24** (1 parmi les 11 de la vérité, juste ; les 23 autres lus
un par un : même modèle, même taille, mise en ligne 1 à 20 j après la commande — aucune fausse vue).
Achats « très probables » distincts : oui (un achat = un article). Sur ses 518 fiches sans achat :
119 recevaient une suggestion avant, **281** une proposition maintenant.

Ce qui reste faux sur la vérité : « Nike Schuhe Gr 39 » (aucun mot de modèle : il ne peut être que
« possible », jamais premier devant un vrai « P-6000 ») ; « Nike shox » devant « Nike Shox TL » (le
titre de l'achat ne dit pas lequel) ; « Nike dunk low 42,5 verte » / « Nike SB Dunk Low St. Patrick's
Day » (deux achats aussi plausibles) — ils restent « possible », dans les 3 premiers.

**Mesuré aussi, et écarté** : peser chaque mot par sa RARETÉ parmi ses achats (IDF) donnait top-1 73 % /
top-3 73 % (article seul) et 64 % / 73 % (global) — moins bien que le poids plat. Chaque mot pèse 1
(`poidsMots` reste dans le module pour une mesure future).

## La règle (`src/liaisonAchat.js`, pure, exécutée par `scripts/audit-liaison-achat.cjs`)

- **Écarté** (jamais proposé) : autre marque (la marque de l'annonce se prouve par son titre,
  `marqueAnnonce`) ; taille de l'article pas sue ; tailles écrites des deux côtés et différentes ; deux
  modèles reconnus différents ; **deux VERSIONS différentes** (« novablast 4 » / « 3 », « mexico 66 » / « 68 »
  — mesuré sur ses « très probables » d'un premier essai) ; aucun mot du modèle en commun ; couleurs
  écrites des deux côtés et sans couleur commune ; achat commandé APRÈS la mise en ligne (ou la vente) ;
  remboursé / annulé ; déjà relié (un lot jusqu'à son nombre) ; « Ce n'est pas lui ».
- **Pesé** : part des mots du modèle retrouvés, dans les DEUX sens (« Nike shox » retrouve tous ses mots)
  + leur nombre ; « xt-6 » = « xt 6 » = « xt6 » ; taille identique (+3) ou US écrite convertie par la
  table de SA marque (+2) ; couleur commune (+2 ; titre en 7 langues + « kaki », « dunkelblau »,
  « schwarz », pluriels) ; **chronologie** : 2,5 × e^(−jours/25) entre le retrait / la livraison LUS
  (sinon la commande) et la mise en ligne ; prix vendu ≥ prix payé (+0,5), < 60 % (−1) ; même photo
  (+6, si les deux empreintes sont connues — aucune empreinte d'ACHAT n'est captée aujourd'hui : le
  signal est prêt, pas branché). Un achat sans aucun mot de modèle (« Nike Schuhe Gr 39 ») ne se propose
  que sur la taille ET une mise en ligne ≤ 60 j — jamais « très probable ».
- **Le niveau** : « très probable » seulement si score ≥ 8, assez de mots communs, taille ou couleur
  confirmée, pas un lot, ET **dominance mutuelle** : l'achat devance de 2,5 le 2e achat de CET article,
  et CET article devance de 2,5 le 2e article de CET achat (par tours : un couple confirmé sort du jeu,
  un achat sert une fois). Jamais glouton : deux candidats proches restent proches (« possible »,
  `ambigu` ⇒ « plusieurs achats se ressemblent : à toi de choisir »). 50 paires identiques ⇒ 0 « très probable ».
- **Pourquoi** (`morceauxPourquoi`) : « même marque · « xt 6 » · même taille 42 · vert · mise en ligne
  10 j après la commande » (ou « … après le retrait », « vendue N j après … »), traduit (5 langues).

Une seule règle : Annonces → « Sans achat relié », la meilleure suggestion d'une annonce
(`meilleureSuggestion`, numérotage) et la feuille « Relier un achat » (`RelierAchatCorps`) passent par
elle. **Laissé tel quel** : la saisie en série (« Prix d'achat à compléter », `suggestionsSaisieSerie`)
garde l'ancienne règle (ses audits portent sur son texte) — à basculer par une session suivante.

## L'écran

- **Annonces → « Sans achat relié »** (`AchatsARelier`, src/App.jsx ; styles
  `src/design/studio-achats-relier.css`) : onglets « En vente · N » / « Vendus · N » (ventes des 12 derniers
  mois, ni annulées ni masquées, sans prix ni achat) ; chaque carte montre **l'article et l'achat côte à
  côte** (photo 64, titre 2 lignes, taille · couleur · « en ligne le » / « vendu le » ; côté achat :
  taille · couleur · « retiré le / livré le / commandé le » · « payé X € » · compte), puis la plaque du
  niveau et POURQUOI ; gestes : « Relier · 40,73 € » (le prix du REÇU, l'écriture de « Relier un achat »,
  un lot demande le prix de l'article), « Ce n'est pas lui », « ⋯ » (Autre achat, Saisir le prix, Plus
  tard, « N autres achats possibles »).
- **« Valider les N très probables »** (le seul bouton plein) : ouvre une feuille qui MONTRE chaque couple
  (deux vignettes, titres, prix), coché, décochable ; seul « Relier ces N paires » écrit — par la même
  écriture, une à une. Les lots n'y sont jamais.
- **« Ce n'est pas lui »** : `vrm_liaison_refus` (`{ 'a:<id>>' + tx | 'v:<tx>>' + tx: at }`), dans
  SYNC_KEYS, relu quand le nuage arrive, posé par `gesteVrm` (annulable) ; la carte passe à la suite.
- **Achats** : sous un achat sans article relié, une rangée fine « Annonce proposée · Très probable ·
  N°209 New Balance 550… » avec « Relier » et ✕ (« Ce n'est pas lui ») — la même affectation.
- L'affectation est calculée après le rendu (setTimeout) et seulement sur ces deux écrans : 2 516
  articles × 2 666 achats ≈ 2-4 s sous Node sur sa vraie volumétrie ; 1 000 × 1 000 ≈ 0,7 s.

## Les preuves

- `node scripts/audit-liaison-achat.cjs` : **36 verts** — P (précision sur un jeu inventé à la forme de
  sa vérité, 20 cas : ancienne règle top-1 60 % / top-3 65 %, nouvelle **95 % / 100 %**, 17 « très
  probables », aucune fausse), I (50 identiques, marque différente, unicité dans les deux sens, versions,
  postérieur, refus, lot, pourquoi, retrait lu, US, couleurs, taille/couleur contraires, mot commun,
  chronologie, deux sens), R (le module n'écrit rien ; entrées gelées ; aucun effet ne relie ; la feuille
  montre avant SON toucher), S (branchement), V (1 000 × 1 000).
  - **Sur l'arbre de départ** (`git archive origin/claude/project-review-nsk5su`) : **rouge** (module
    absent ; la règle d'avant fait 12/20 et 13/20 sur le même jeu).
  - `--prouve` : **16/16 mutations attrapées** (marque, unicité article, unicité achat, version, taille,
    couleur, postérieur, refus, lot, un seul sens, chronologie, mot commun, effet qui relie, valider sans
    feuille, refus local, vendus oubliés). Les copies de mutation sont effacées à la sortie (le disque du
    conteneur est partagé : 50 copies de `src/` l'avaient rempli, bancs « Page crashed »).
- Audits voisins verts : `identite`, `suggestions-achat` (50), `achats-a-relier` (30), `achats-relier`,
  `traduction` (45), `tdz`, `variables`, `studio`, `quoi-de-neuf`.
- Banc `scripts/bancs/achats-liaison.cjs` (390 tactile ×2, 1512, clair et sombre) — **70 verts, 0 rouge** : côte à côte,
  niveaux (5 très probables attendus, 3 identiques « possible »), marque contredite et autre version
  jamais proposées, pourquoi, rien d'écrit avant son toucher, la feuille, « Relier ces 4 » écrit
  exactement les 4 cochés, « Ce n'est pas lui », Vendus, Achats, forme (débord, 1 plein, 44 px).
- Banc `annonces-achats` (390, 1512-sombre) : **28 verts, 0 rouge** après deux retouches. L'achat inventé « … nere … » (noir) proposé à « … Brown … » est devenu
  « … marroni … » (la règle pondérée écarte une couleur contraire écrite) ; ses hauteurs de carte (≤ 136 /
  188 px) dataient de la carte d'une ligne : la carte côte à côte est plus haute par construction (≤ 310 px
  avec un achat proposé ; sans, l'article tient en une rangée, ≤ 200 px).
- Note banc : le bouton plein du studio « respire » (jamais « stable » pour Playwright) — le banc lui donne
  le clic par l'élément ; les liens se lisent dans la copie de l'appareil (`vinted_annonce_numeros`,
  `vinted_sale_overrides`), l'écriture vers la base partant groupée plus tard.
- Pas rejoué : le banc sur un build de l'arbre de départ (disque presque plein) ; ses sélecteurs
  (`data-ar-cote`, `data-ar-valider`, `data-achat-propose`) n'existent pas avant ce lot.

## Geste de Julien

Aucun : fermer et rouvrir l'app, Annonces → « Sans achat relié » (onglets En vente / Vendus), et Achats.
