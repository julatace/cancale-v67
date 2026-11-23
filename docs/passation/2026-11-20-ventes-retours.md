# 20 nov. 2026 — Ventes : retours et litiges, en-tête collant, Relier, étape d'« En route » (branche `claude/ventes-retours`)

Julien (capture Edge 1512) : « on a 4 litiges avec 2 écritures différentes » ; « Tous les comptes » coupé, segmenté caché sous
l'en-tête collant, rangées qui défilent au-dessus de l'en-tête ; « il y a la place pour mettre le bouton relier, fais un beau
logo » ; « En route · vendue il y a 12 j » à côté de l'étiquette « Livrée ».

- **Retours et litiges** (src/natif/ecrans/RetoursVentes.jsx, rangées faites par `retoursNatif`, src/App.jsx) : les deux blocs
  d'avant (`CartesRetourRecu` + `RetoursEnCoursBloc`) ne sont plus montés sur Ventes natif ; UN groupe replié « Retours et
  litiges · N » sous « À régler » (À envoyer et En route). Ordinateur : rangées du tableau (vignette, titre, acheteur · compte,
  N° en plaque standard, étape en étiquette neutre : En route vers toi · Initié · Reçu chez toi · À vérifier · Remis en stock ·
  Remboursé), UNE action en texte (« Reçu » = la remise d'avant sous SON N° ; « Remettre en stock » ; « Remettre en ligne »),
  le reste derrière ⋯ (le site ↗, Ignorer, Pas encore reçu, Annuler la remise). Téléphone : rangée native, toucher ⇒ feuille.
  Anciens (remboursés > 45 j) derrière « Voir les N anciens ». Mêmes lignes, mêmes gestes, aucun chiffre changé.
- **En-tête** : la tête du tableau (compte, fraîcheur, segmenté, outils) est un bloc collant opaque (`.n-tt-colle`) ; la barre
  de titre devient opaque dès que l'écran a défilé et son `::after` couvre la marge haute du défileur (14 px) ; la détection
  du défilement lit le premier ancêtre défilé (`.vrm-main`). Téléphone : le segmenté est collé (`.n-vn-colle`).
- **Relier** : icône `relier` (deux maillons, ICON_PATHS) ; colonne « Achat » entre le titre et le N° (À envoyer, En route,
  Terminées via le registre `RELIER_VENTES`) et une rangée dans la fiche d'une vente au téléphone ; le toucher ouvre l'atelier
  « Relier » sur CETTE vente (`choisirAchatVente`) ; reliée (`buyFromId`) ⇒ gris + « acheté N € ». Jamais de liaison automatique.
  Annonces a déjà sa colonne « Achat » et « Relier » : rien ajouté.
- **Étape d'« En route »** : la méta d'un colis parti (`sousEnvoye`) prend l'étape PROUVÉE (`x.lues`, `preuvesFriseDe` — le
  transporteur tranche, 17 nov.), comme l'étiquette ; l'état de la commande Vinted seul retardait (« En route » vs « Livrée »).
- Preuves : `scripts/bancs/ventes-retours.cjs` (2 en route, 2 initiés, 6 anciens, 1 à remettre en ligne ; 1512/1280/390 clair
  et sombre) 94 verts, 74 rouges sur le build d'avant ; ventes-tableau 180 verts ; natif-ventes 58 verts ; chiffres-volume identique.
