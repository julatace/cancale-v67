# 11 nov. 2026 — Statistiques par catégorie (lot `stats-categories`)

Julien : « des statistiques par catégorie (lunettes, vêtements…) pour les vendeurs
qui ne font pas que des sneakers ». Branche `claude/stats-categories`.

## Ce qui est livré

Argent → Statistiques, carte **« Par catégorie »** (après « Marge par plateforme »).
Une ligne par famille : ventes, chiffre vendu, brut, jours pour vendre, en ligne.
En bas : « Sans catégorie (N) · X € » et le bouton **« Poser la catégorie »**.

La feuille liste les ventes sans catégorie de la période. On coche, on touche une
famille : c'est rangé. « Tout cocher » paraît dès deux lignes. Cibles 44 px.

Règle unique : `src/statsCategories.js`. Propriétaire unique : Statistiques.

## D'où vient la catégorie (jamais du titre, §5)

1. **Vinted** : `catalog_id` de l'annonce, reliée à la vente par SA transaction
   (`item_id`). Lu dans le dressing (`harvest_*_listings`, champ `cat` ajouté à
   `lireExtrasRepartition`). Quand le dressing dit `null` (mesuré le 5 nov. : un
   dressing non allégé l'envoie à `null`), lu sur la fiche de la page
   (`vinted_item_details[id].catalogId`), projeté en scalaire, par lots de 80.
2. Le numéro est traduit par le **catalogue de Vinted** (`vinted_catalogue`) :
   « Femmes > Accessoires > Lunettes de soleil » ⇒ Lunettes. Le plus précis gagne
   (des lunettes sous « Accessoires » sont des Lunettes). Chemin inconnu ⇒ « Autre ».
   Le catalogue (~550 Ko) n'est lu que si la carte paraît ET si sa version
   (`data->>at`, scalaire) a changé ; la table `{ catalog_id: famille }` est
   gardée sur l'appareil (`vrm_cat_familles`, quelques Ko).
3. Sinon **son choix** : `vrm_categories_main` (synchronisée, SYNC_KEYS),
   `{ 'vinted:tx' | 'lbc:id' | 'ebay:id' | 'vestiaire:id': { f, at } }`.
   Une catégorie LUE gagne toujours ; son clic ne l'écrase jamais.

`familleArticle` (qui devine par le titre) n'est PAS utilisé. L'audit le vérifie.

## Les chiffres (chacun chez son propriétaire, §11)

- **Ventes, chiffre vendu** : lignes du VENDU (`ventesFaites`, date de la vente,
  annulées exclues), filtrées sur la période — les mêmes que la tuile « Vendu ».
  Catégories + « Sans catégorie » = la tuile (banc).
- **Brut** : relevé finalisé `vrm_stats_ventes`, `classementRapporte` (la règle de
  « Ce qui rapporte » et de « Par compte »), seulement au prix d'achat connu.
- **Jours pour vendre** : médiane mise en ligne → vente (Vinted), comme l'écran.
- **En ligne** : `vrm_stats_stock.parCatalogue`, publié par l'écran Annonces
  (même garde « lecture complète » que le reste de `vrm_stats_stock`).
- Mêmes comptes sélectionnés : les lignes viennent déjà filtrées (vendu, relevé).

Pour relier Leboncoin, eBay, Vestiaire, chaque ligne du vendu porte désormais
`tx` (n° de transaction, de commande, de vente) — une identité, rien d'autre.

## Ce que j'ai tranché

- **« au moins » refusé pour le brut** : la mission disait « au moins … · sur N ».
  Or l'écran a décidé le 3 nov. qu'un brut partiel n'est pas un plancher (une vente
  au prix inconnu peut être à perte). J'écris donc « brut 40 € · 1 sans prix
  d'achat » : le manque nommé, comme « Par compte ».
- **Médiane plutôt que moyenne** pour le délai : tout l'écran parle en médiane.
- **Familles** : Chaussures, Vêtements, Sacs, Lunettes, Montres, Bijoux,
  Accessoires, Beauté, Enfants, Jouets, Jeux vidéo, High-tech, Livres, Musique,
  Cartes, Maison, Sport, Autre. Chacune correspond à une tuile de « Tu vends
  quoi ? » (Lunettes : lot DJ2, pas encore dans `main` au moment du lot ;
  Montres et Bijoux → la tuile « Montres & bijoux »). Luxe et Vintage n'ont pas
  de famille : Vinted ne range jamais une annonce en « luxe ».
- **Enfants** : « Enfants > Chaussures » compte en Chaussures, « Enfants > Jouets »
  en Jouets ; le reste d'« Enfants » en Enfants.
- **Quand le bloc paraît** : dès DEUX familles connues (ventes de la période ou
  stock). Ou s'il a dit vendre « autre chose » et qu'il reste des ventes sans
  catégorie. Un vendeur d'une seule catégorie (Julien) ne le voit pas.
- **Leboncoin, eBay, Vestiaire** : aucune catégorie lue sur leurs VENTES
  (Leboncoin la lit sur l'annonce, pas sur la vente : il faudrait relier
  l'annonce par sa référence — pas fait). Elles passent par « Poser la catégorie ».
- **Stock** : seulement la catégorie du dressing (pas la fiche de page). Le reste
  est dit : « N annonces en ligne sans catégorie lue ».
- Catalogue illisible : la table gardée sert (les numéros de Vinted ne changent
  pas de sens) ; aucune table ⇒ catégories Vinted « pas sues », rien deviné.

## Preuves

- `npm run build` vert.
- `node scripts/audit-stats-categories.cjs --prouve` : 44 contrôles verts, 8
  mutations toutes rouges (lue avant main, lunettes oubliées, chemin vide deviné,
  sans catégorie rangée d'office, une famille montrée, main écrase lue,
  couverture perdue, famille inventée acceptée). 50 ventes au même titre :
  20 rangées par catégorie lue, 30 sans catégorie.
- Banc `scripts/bancs/stats-categories.cjs` : 64 verts (390 tactile et 1512,
  clair et sombre) ; ROUGE sur l'arbre `origin/main` (carte absente).
- Audits communs verts (variables, tdz, coherence, identite, icones,
  textes-courts, fonctions-api, secrets). Banc `stats-vitrine` : 112 verts.
- `audit-qui-dorment` : 1 rouge, **déjà rouge sur `main`** (« la liste remplace
  la grille »), sans lien avec ce lot.

## Geste de Julien

Aucun. (Pour un vendeur généraliste : ouvrir Statistiques ; s'il reste des ventes
« Sans catégorie », toucher « Poser la catégorie ».)
