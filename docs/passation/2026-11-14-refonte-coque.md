# 14 nov. — Refonte VISIBLE de la coque (barre du haut, barre du bas, menu du haut, alertes de tête)

Branche `claude/refonte-coque`. Brief commun : Julien sur son iPhone (« c'est moche, rien n'a changé »,
« sortir des classiques », « imagine si j'ai 1000 articles », captures d'Achats puis d'Annonces), choix n° 61
(quatre onglets + menu du haut). Formes et navigation seulement : aucune règle métier, aucun chiffre, aucun
écran retiré (§4.11 : `tab===` 28 identifiants / 44 occurrences, avant = après).

## Ce qui change à l'écran

**Barre du haut (téléphone)** — avant : petit titre + cinq ronds (« V » état Vinted, œil, cloche « 99+ » bleue,
loupe, logo/profil). Après :
- à gauche le ☰ (« Tous les écrans », choix n° 61) ; un point ambre quand un écran du menu a un geste ;
- à droite TROIS icônes : cloche · loupe · compte ;
- la pastille de la cloche plafonnée « 9+ », à l'ENCRE (plus l'accent ; claire sur la barre encre de Ma journée) ;
- l'état « Actions Vinted » (l'ancienne pastille « V ») : un point sur la photo du compte (ambre = geste,
  gris = lecture seule, rien quand tout va bien) ; son panneau ENTIER s'ouvre depuis le menu du compte
  (« Actions Vinted · Lecture seule › », événement `vrm:etat-actions-ouvrir`) ;
- l'œil « Cacher les montants » : interrupteur dans le menu du compte ; tant que les montants SONT cachés,
  l'œil revient dans la barre (un mode allumé garde son interrupteur sous le pouce). Le bouton « Stream »
  reste dans la barre s'il est choisi dans Réglages (opt-in de Julien) ;
- grand titre 34/700 dans la page ; le petit titre (17/600) n'arrive dans la barre qu'au défilement, CENTRÉ
  (colonnes latérales égales) ; matériau translucide (§4) une fois défilé ; Ma journée garde sa barre encre.
- Ordinateur : l'île garde ses trois éléments (état, œil, cloche) ; la barre de recherche et la ligne d'alerte
  partent du bord du contenu (+16 px, la grille des titres) ; la colonne est une carte de l'atelier.

**Barre du bas** — quatre onglets : Aujourd'hui · Paires · Ventes · Argent (« Plus » quitte la barre).
L'onglet actif = icône + libellé à l'accent, plus de capsule grise ; pastilles ambre nettes cerclées du fond.
- « Paires » (`src/navPaires.js`) n'est PAS un écran : il ouvre le dernier de Annonces / Stock / Achats
  (`vrm_paires_dernier`, appareil). Au téléphone, un sélecteur segmenté Annonces | Stock | Achats en tête
  des trois écrans (`SelecteurPaires`, `data-paires-segment`, `data-nav-entree`), chaque segment avec SON
  nombre ; l'onglet Paires porte la somme, et se tait sur un écran de Paires (un nombre une fois, §7).
  Mêmes identifiants d'onglet : liens profonds, ⌘K, reprise, notifications inchangés ; `setTab('paires')`
  est un alias.
- Le menu du haut (☰, `MenuEcrans`, feuille par portail depuis le haut, `FermeAuRetour`) porte tout ce que
  « Plus » portait, groupé : Paires (Annonces, Stock, Achats) · Gérer (Messages, E-mails) · Moi (Communauté,
  Parrainer si ouvert). Il ne répète pas la barre (Julien, 21 sept.). Paramètres reste derrière la photo du
  compte (décision DJ6 du 11 nov.) ; Organisation et les raccourcis par plateforme restent hors menu
  (décisions du 29 oct. et du 8 nov.).
- Ordinateur : la colonne suit le regroupement (Aujourd'hui, Ventes, Argent · Paires · Gérer · pied Moi).

**Alertes de tête de page**
- « Tout est à jour · vérifié à l'instant » ne prend plus de place (lu par les lecteurs d'écran, data-* gardés).
- AJOUT 3 : « N choses à revoir » n'est JAMAIS au-dessus du titre : la ligne de fraîcheur quitte la page
  (tous états), la cloche porte un point ambre (`data-cn-alerte`), la feuille de la cloche porte la ligne
  entière (détail et geste, `data-centre-fraicheur`). La copie de la feuille ne publie pas (`publier={false}`) :
  une seule voix publie `publierFraicheur`. `BaseInjoignable` est inchangé (la panne se dit une fois).
- « Mis à jour à 08:19 » : 2 s puis se tait au moins une minute (la veille relit toutes les 5 à 30 s : elle
  rallumait la pastille sans fin).
- « Nouvelle version de VRM · Mettre à jour » : au téléphone, une ligne fine (36 px, matériau) sous la barre du
  haut, qui POUSSE la page (`html:has(.vrm-maj) .vrm-main { padding-top }`) — plus de bulle sur la liste.
- Le titre : la phrase d'explication n'est plus écrite (gardée en `vrm-sr-seul`), le « ? » est à côté du titre.

**Système** — `src/styles-systeme.css` : §3 Coque (formes) et §4 Atelier (jetons communs aux trois chantiers :
fond chaud `--d-fond-atelier`, ombres douces, héros encre→bleu nuit, rayons, affiche 48–64, matériau, ressorts,
pastilles teintées, rangée dense SANS ombre ni flou `.vrm-at-rangee`, apparition limitée aux 12 premières).
Le fond clair de l'app passe à `--d-fond-atelier` (#F4F3EF ; gris 4,6:1 dessus) ; la nuit reste #000.

## Preuves
- `scripts/bancs/refonte-coque.cjs` : sur origin/main **16 ✅ · 34 ❌** (H1 cinq ronds, H2 petit titre visible
  et à gauche, H3 pastille encore là après 3 s, H4 « 99+ » bleu, F/N…) ; ici **59 ✅ · 0 ❌** (règles + AJOUT 3).
  Section P (1 000 annonces, `BANC_DIST_AVANT=`) : nœuds DOM 2447 → 2450, CLS 0 → 0, premier rendu et
  défilement dans le bruit. ⚠️ La base à 1 000 annonces n'affiche pas les annonces inventées (24 en ligne : la
  ligne `listings` gonflée n'est pas prise par l'écran) — la mesure compare donc l'écran Annonces réel de la
  base de banc, pas 1 000 rangées : à reprendre avec la base du chantier « listes ».
- Audits verts : traduction, tdz, icones, coherence, variables, composants, violet, rouge-doublon,
  quoi-de-neuf, onglets-a, onglets-d, garde-ecrans. `npm run build` vert.
- Captures 390 × dsf 2 : `docs/design/avant-apres/coque-*.png`.

## Restes / à savoir
- Bancs qui touchaient la pastille « V » ou l'onglet « Annonces » de la barre au téléphone : ils passent
  désormais par le menu du compte (`[data-profil-menu="etat-actions"]`) ou le segment
  (`[data-paires-segment]`) — voir la liste du rapport.
- `fraicheur-unique.cjs` déplie la ligne DANS la page : il faut désormais ouvrir la cloche.
- Le contenu ne passe pas SOUS les barres (elles sont des sœurs de `<main>`, décision du 7 nov. : les barres
  collantes des listes restent justes) : le matériau se voit sur le fond, pas sur la liste.
