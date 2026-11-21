# 21 nov. 2026 — Ventes lisibles : grandes vignettes, nom entier, l'achat en un toucher, « Lier à un achat » façon Bleam

Branche `claude/ventes-lisibles` (repris après une session interrompue : commits 43ce8da33 et 0aed51799, puis la reprise).
Aucun fichier de `vinted-sync-extension/`.

## Ce que Julien a demandé (captures iPhone de Ventes, 05184f6f et 75b9d1f2)
- « les icônes devant […] beaucoup trop petit, on ne voit même pas ce que c'est, il n'y a même pas le nom de la paire en entier
  avec la taille » ;
- « on est obligé d'appuyer sur les points (⋯) pour remplir le prix d'achat ou relier un achat : améliore ça, pour eBay aussi » ;
- la feuille « Lier à un achat » comme Bleam (4c08244f) ; les rangées comme la page Commandes de Vintex (80deea8d), au téléphone
  en version empilée dense ;
- défauts vus : squelette entre la liste et « Imprimer » ; pilule « Où est cet article dans le stock » posée sur la liste ; rangée
  « 56 bordereaux déjà traités · Les voir » bord à bord ; groupe « EBAY » (Tableau, À traiter, Offres) au milieu de Ventes ;
  « Imprimer · Coche un colis » visible sans sélection ; titres coupés ; « À régler · 2 », « Retours et litiges · 10 »,
  « Retours à imprimer » empilés.

## Ce qui change
- **Rangée d'une vente au téléphone** (`src/natif/ecrans/Ventes.jsx`, `VentesListeTel` de `VentesTableau.jsx` pour Terminées) :
  vignette de **64** (place réservée, `Vignette` taille 64, `Rangee` 80), titre **entier** 15/20 fort sur toute la largeur (deux
  lignes), puis « logo du site · N° · marque · taille · date limite » (chaque morceau entier ; ce que le titre dit déjà — la
  marque, « taille 40 » — n'est pas répété : `src/ventes/marqueTaille.js`, affichage seulement, jamais une identité), puis
  « prix · étiquette d'état · logo du transporteur », et au **pied** (nouvelle prop `pied` de `Rangee`, hors du bouton de la
  rangée) l'achat.
- **L'achat en un toucher** (`src/natif/ecrans/celluleAchat.jsx`, `GestesAchat`) : relié ⇒ « Acheté 30 € » ; prix connu sans
  achat ⇒ « Acheté 30 € » (le toucher ouvre Relier) ; rien de connu ⇒ « Relier » ET le champ « Prix d'achat » visibles. Le champ
  écrit par le chemin de la saisie d'avant de CETTE vente, relu juste avant d'écrire, jamais par-dessus un prix connu (§2.5) :
  Vinted `setSaleOverride(tx, { buyPrice })` (lu par `effEntry`, le reçu `prixAchatRecu` reste prioritaire : un prix déjà posé
  ⇒ pas de champ, « refus » si posé entre-temps) ; eBay `vrm_ebay_couts[[compte, commande]]` (la clé de `sauverCouts`, et
  seulement si `bilanCommandeEbay` sait lire la commande) ; Leboncoin / Vestiaire `vinted_buyprice_by_num` (seulement si le N°
  désigne AU PLUS une fiche). Une vente en LOT ou annulée : pas de champ (le prix d'un lot ne se partage pas). Montant illisible ⇒
  dit, rien d'écrit. Toutes plateformes : `achatAutreSiteDe` (src/App.jsx) ; « Relier » d'une vente d'un autre site ouvre
  « Relier achats et ventes » sur SON annonce.
- **Tableau de l'ordinateur** : vignette 56, titre sur deux lignes (jamais « New Balance … »), cellule « Achat » = les maillons +
  le champ « Payé € » ; tableau étroit (détail ouvert, 1280) : titre ≥ 200 px, champ resserré — le tableau tient sans glisser
  sous le détail.
- **« Lier à un achat » façon Bleam** (`src/natif/ecrans/LierAchatGrille.jsx`, monté par la feuille de l'app quand elle est
  ouverte depuis une vente — `_bleam` — et que la vente n'a pas encore d'achat) : la vente en haut (photo 64, titre entier,
  marque · taille, prix), une recherche, les filtres **Marque** et **Prix payé** (tranches), la **grille** des photos des achats
  LIBRES et **ARRIVÉS** (`achatStage(a).step === 4`, la règle de « Relier achats et ventes » ; « pas su » ⇒ pas montré, et le
  nombre est dit), du plus récent ; SON toucher choisit une case (coche, la photo ne zoome pas), « Relier à cet achat ? Non ·
  Oui » ; « Oui » = `relierAchat` d'avant (détacher après confirmation, lot ⇒ prix à saisir, pilule « Achat relié · Bénéfice …
  · Reçu · Annuler », annulable 5 s). « Plus de choix » rend la feuille d'avant (suggestions, déjà reliés, tous les filtres).
- **Ce qui était posé sur la liste** est rangé dans le menu « ⋯ » de Ventes (les mêmes fonctions) : « Où sont ces articles dans
  le stock », « N bordereaux déjà traités · Les voir », et les sections eBay (Tableau, À traiter, Offres…) — `sectionsAutres`.
- **« Imprimer »** n'apparaît qu'avec une sélection (ou pendant l'impression), au téléphone comme à l'ordinateur.
- **« À régler » + « Retours et litiges »** au téléphone : UNE ligne d'accès discrète qui ouvre une feuille avec les deux blocs
  (ouverts) ; les étiquettes retour à imprimer sont des rangées cochables de la liste des colis.
- **Plus de second squelette** sous la liste de Ventes natif (son propre chargement suffit).
- Textes : `tr()` en 5 langues (`vt.*`, `vn.acces.*`, `vn.o.*`, `la.*`) ; « Quoi de neuf » : `ventes-lisibles`.

## Preuves
- Banc `scripts/bancs/ventes-lisibles.cjs` (390 tactile et 1512, clair et sombre, base inventée de design-passe + photos
  inventées sur les achats) : **94 verts, 0 rouge**. Sur le build d'`origin/main` : **20 rouges** (vignette 56/48, titres rognés,
  aucun « Relier »/champ sur la rangée, pilule stock et rangée bordereaux sur la liste, « Imprimer » sans sélection au
  téléphone, aucune grille). Mutation : remettre « Imprimer » sans sélection ⇒ « I » rouge.
- `ventes-tableau` 180 verts (seuil de hauteur ≤ 180 pour une rangée qui porte l'achat au pied ; le détail ouvert à 1512 était
  rouge après la 1re passe — tableau trop large — vert après le resserrement en requêtes de conteneur) ; `ventes-retours`
  102 verts (au téléphone : la ligne d'accès puis la feuille, ouverte ; Échap la referme) ; `natif-ventes` 58 verts (le prix
  lu sur la ligne sous le titre, hauteur ≤ 180 avec le pied) ; `relier-achats` 68 verts.
- `relier-achat-filtres`, `relier-tout-achat`, `relier-taille` : rouges ET sur `origin/main` (ils cherchent
  `[data-cout-vente-relier]`, l'ancien écran Ventes, plus rendu par Ventes natif) — pas touchés ici.
- `audit-traduction`, `audit-identite`, `audit-quoi-de-neuf`, `audit-tdz`, `audit-variables` verts ; build vert.
- Captures regardées : liste 390 (clair, sombre), Terminées 390, grille, case choisie + « Non · Oui », reliée + pilule
  « Annuler », tableau 1512 et détail ouvert.

## Ce qui reste
- La hauteur d'une rangée au téléphone : 136 px (titre sur une ligne) à 174 px (deux lignes + « sans bordereau ») — le pied
  de 44 px (cibles au doigt) en est la cause. Plus dense demanderait de cacher le champ derrière un toucher : refusé ici.
- Les photos réelles : une autre session corrige leur chargement ; les places sont réservées.

## Geste de Julien
Aucun.
