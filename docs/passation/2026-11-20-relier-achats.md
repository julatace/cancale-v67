# 20 nov. 2026 — « Relier achats et ventes » : toutes les paires, plus récentes d'abord, seuls les achats reçus

Branche `claude/relier-achats` (partie de `origin/main` 858ae148e). Aucun fichier de `vinted-sync-extension/`.

## Ce que Julien a demandé
A. Écran « Relier achats et ventes » (`src/RelierGlisser.jsx`, règles `src/relierGlisser.js`) :
1. tri de la date la plus récente à la plus ancienne, des deux côtés ;
2. filtres plateforme d'origine, marque, taille, des deux côtés, en pastilles natives, choix gardés ;
3. ne jamais proposer un achat pas encore livré / au point relais / en route ;
4. « il n'y a même pas toutes les paires, c'est bizarre ».

B. Achats en route / à retirer : le logo du transporteur et le n° de suivi sur chaque achat, comme Ventes.

## Mesure sur sa base (lecture seule, comptes et projections seulement)
- Achats lus (`harvest_*_orders_purchased`, 11 comptes) : 2 689 ; 640 remboursés/annulés ; 19 reliés ;
  ~52 pas encore chez lui (29 « expédiée, en cours d'acheminement », 16 « déposé en point relais », 5 « bordereau
  envoyé », 2 « paiement validé ») — ceux-là étaient PROPOSÉS, et en tête (les plus récents).
- Annonces Vinted lues : 407 ; 52 en ligne (toutes numérotées), 41 sans achat ; 14 masquées par Vinted — absentes.
- Ventes Vinted : 2 588 ; ~2 160 sans achat ; l'écran ne prenait que les 12 derniers mois (~1 390) : ~770 ventes de
  plus d'un an manquaient.
- Leboncoin (194 annonces lues, 16 ventes), eBay (4), Vestiaire (3) : AUCUNE n'était listée (l'écran ne lisait que Vinted).

**Cause des paires manquantes** : pas la pagination (les lectures sont des lignes JSONB par compte) ni une limite
d'affichage (tranches de 60 qui se suivent). L'écran construisait ses cibles avec `fileAchat` (annonces Vinted EN LIGNE
seulement) et `fileVendus` (ventes Vinted des 12 derniers mois — la borne de la liaison proposée). Il manquait donc les
ventes de plus d'un an, les annonces masquées et « à confirmer », et tous les autres sites.

## Ce qui change
- `src/relierGlisser.js` : `plusRecentDabord` (sans date ⇒ à la fin, jamais devinée), `seulementRecus` (la règle de
  l'app passée en `recuDe` : l'étape « Arrivé » de `etapeAchat` — finalisée, livrée, retrait prouvé ; « pas su » ⇒
  écarté), `facettesDe` / `filtrerFacettes` / `choixValides` (égalité exacte, jamais « contient »), choix gardés par
  appareil (`vrm_relier_filtres`, un confort).
- `src/RelierGlisser.jsx` : une rangée de pastilles Plateforme · Marque · Taille de chaque côté, chacune ouvre le
  sélecteur NATIF (un `<select>` posé sur la pastille) ; une facette à une seule valeur n'est pas montrée (les achats
  sont tous Vinted : leur pastille Plateforme n'apparaît pas).
- `src/App.jsx` : `vendusSansAchat(borne)` (la liaison proposée garde ses 12 mois, l'écran prend tout :
  `fileVendusTous`) ; `fileAchatHorsLigne` (masquées présentes + « à confirmer ») ; les articles des autres sites sans
  achat (lecture d'Annonces `lireAnnoncesEgalite` + `construireArticles`, porteur = SON annonce) ; `relierGlisseSite`
  écrit par `opsFait` (`vrm_articles_sites`, la même écriture qu'« Acheté » d'Annonces), en geste annulable ;
  `liensGlisser` compte aussi les liens posés sur une annonce d'un autre site ; « Relier à une vente / annonce » du
  menu ⋯ d'un achat n'est plus offert tant qu'il n'est pas arrivé.
- B : `src/natif/ecrans/AchatsTableau.jsx` — colonne « N° de suivi » (toucher = copier, ↗ = chez le transporteur,
  `ligneSuiviAchat`), logo dans la colonne Transporteur. Au téléphone, la ligne de suivi existante (logo · n° copiable ·
  ↗) reste sous chaque achat.

## Preuves
- Banc `scripts/bancs/relier-achats.cjs` (base inventée : 1 500 achats, 1 200 annonces, 300 ventes dont 150 de plus
  d'un an, 40 annonces Leboncoin ; 390 tactile et 1512, clair et sombre ; tableau 1512) : vert après ; rouge sur
  `origin/main` (1 150 cibles au lieu de 1 440, 1 440 achats au lieu de 1 300, en route en tête, aucun filtre).
- `audit-relier-glisser` (S1 suit `fileVendusTous`), `audit-identite`, `audit-tdz`, `audit-variables`,
  `audit-traduction`, `audit-quoi-de-neuf` verts.

## Geste de Julien
Aucun.
