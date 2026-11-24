# 23 nov. — Photos nettes (lot `claude/photos-nettes`)

Julien (capture iPhone) : « toutes les photos sont floues » — en plein écran (visionneuse
d'un achat), l'image était une petite vignette agrandie, pixelisée.

## La mesure (vraie base, lecture seule, projections scalaires)

| source | ce qui est rangé |
|---|---|
| `harvest_*_orders_purchased` / `_sold` (`my_orders[].photo.url`) | **uniquement** `150x210` (727 achats et 772 ventes ont une photo ; 2 625 / 2 777 n'en ont pas) |
| `harvest_*_listings` (`items[].photo.url`) | la pleine taille `/tc/…` |
| `coffre_*` (`photos[]`) | la pleine taille `/tc/…` (chaînes) |
| `harvest_*_txn_*` (`transaction.order.items[].photos[]`) | `url` f800, `full_size_url` /tc/, `thumbnails[]` 70x100 · 150x210 · 310x430 · f800 (`width`, `height`) |
| Leboncoin (`lbc_listings`) | `img.leboncoin.fr/…?rule=ad-image` (grande) |
| Vestiaire (`vc_ventes`) | `images.vestiairecollective.com/produit/…-1_2.jpg` |

- ⚠️ **Chaque taille Vinted a SA signature** (`?s=…` différent pour 150x210, 310x430, f800,
  /tc/) : réécrire le répertoire de taille fabriquerait une adresse que Vinted n'a jamais
  donnée. Rien n'est fabriqué.
- Même fichier, autre taille, déjà connue ailleurs dans la base (clé `clePhoto`) :
  **498 ventes sur 772** (dressing 451, détail 396, coffre 249) ; **34 achats sur 727**
  (détail de transaction seulement).
- Trouvé en passant : la lecture des photos de vente depuis le détail de transaction
  projetait `transaction.item_photo` et `transaction.item.photo`, **qui n'existent pas**
  (mesuré) — la photo est sous `order.items[0].photos[0]`. Ajouté (`photoOrdre`, un seul
  article : un lot n'a pas UNE photo).

## La règle — `src/photoTaille.js`

- Un registre « clé de fichier → adresses connues + largeur » (largeur lue dans le chemin :
  `150x210` ⇒ 150, `f800` ⇒ 800, `/tc/` ⇒ pleine). Nourri par ce que l'app lit déjà :
  `photosDeLArticle` (dressing, galeries), chaque `PhotoVinted` rendu, le détail de
  transaction des ventes (`photosTransactionsLues`) et des achats (`detailsDeLignes`, lu
  maintenant aussi sur l'écran Achats, scalaires).
- `photoPour(url, besoin)` : la plus PETITE taille connue ≥ besoin, sinon la plus grande ;
  jamais plus petite que l'actuelle. Besoin = 2 px réels par point (`FACTEUR_RETINA`).
- `PhotoVinted` (App.jsx) : largeur connue d'avance ⇒ choisie tout de suite ; sinon, une
  fois la petite chargée, mesure (cover / contain) ; la plus grande est **préchargée à
  côté** et ne remplace la petite qu'une fois chargée (jamais un trou ; échec ⇒ la petite
  reste). L'ancien corps s'appelle `PhotoVintedBase` (secours, pictogramme inchangés).
- Visionneuse : `mieux={pleineTaille(src)}` ⇒ chargement progressif (petite tout de suite,
  pleine taille dès qu'elle est là).
- CSP : `img-src … https:` autorise déjà ces adresses. Aucune requête vers Vinted de plus
  que les photos elles-mêmes (adresses lues), chargées comme les autres.

## Preuves

- `scripts/audit-photo-taille.cjs` : 10 contrôles ; 3 mutations (`jamais-plus-grand`,
  `toujours-pleine`, `facteur-1`) le rougissent.
- `scripts/bancs/photos-nettes.cjs` (390 px, deviceScaleFactor 3, CDN simulé avec une
  signature par taille, adresse inventée ⇒ 403) : N1 visionneuse d'un achat ≥ 2× ; N2 une
  image dès l'ouverture ; N3 cartes d'Annonces ≥ 2× ; N4 aucune adresse fabriquée ; N5 un
  achat sans plus grande taille garde la sienne. Voir « résultats » plus bas.

## Ce qui reste

- **La plupart des achats n'ont QUE la vignette 150x210** (693 sur 727) : « Mes achats »
  ne donne rien de plus, et le détail de la transaction n'est rangé que quand la commande
  (ou sa conversation) est ouverte sur vinted.fr. Pour mieux, il faudrait que l'extension
  range une plus grande taille de la photo d'achat — une lecture Vinted NEUVE (budget de
  lecture 20/h) : pas fait ici, à décider avec Julien.

## Résultats (23 nov., ~13 h UTC)

- `audit-photo-taille` vert (10) ; mutations `jamais-plus-grand` (3 rouges), `toujours-pleine` (2),
  `facteur-1` (1). `audit-visionneuse` 19 verts, `audit-photos-vinted` vert (PERMIS : `PhotoVintedBase`),
  `audit-quoi-de-neuf` vert.
- Banc `photos-nettes` : 11/11 vert ; sur l'arbre de `main` (git archive) : N1 ROUGE — visionneuse
  150 px pour 390 pt (×0,38) ; après : 800 px (×2,05). Captures regardées (N1 avant/après, N3).
- Banc `photos-achats` (V) : 13 rouges AVANT et APRÈS, identiques (préexistants, machine chargée).
- Erreur préexistante vue sur Achats avant ET après : « Failed to read the 'localStorage' property… »
  (pas de ce lot ; le banc l'écarte en le disant).

## ÉTAT À LA REPRISE

PR #1323 (`claude/photos-nettes`). Si elle n'est pas fusionnée : comparer sa CI à celle du dernier
commit de main, vrai `git merge origin/main`, fusionner. Ensuite, à décider avec Julien : faire ranger
par l'extension une plus grande taille de la photo d'achat (lecture Vinted neuve, budget 20/h).
