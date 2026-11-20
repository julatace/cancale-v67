# 2026-11-20 · Argent au style convenu + barre du haut (lot `argent-natif`, branche `claude/argent-natif`)

Julien (20 nov., captures iPhone de l'écran Argent) : « Améliore le visuel, tu n'as pas respecté ce qu'on avait dit ».
Référence visuelle donnée par le coordinateur : la feuille « Plus » (listes groupées iOS, rangées sobres, rien de chargé).
AUCUNE règle de calcul ne change (mêmes fonctions, mêmes data-*).

## Barre du haut (tous les écrans)
- Cause réelle des icônes qui flottaient SUR le contenu : `useTitreReduit` (src/natif/Page.jsx) gardait les éléments du
  MONTAGE. La tête de la coque naît sur Aujourd'hui (grand titre), puis l'écran change : l'ancien titre, détaché, n'était
  plus « vu » ⇒ la barre ne prenait JAMAIS son fond (mesuré : aucune mutation `data-n-reduit` après défilement de 500 px).
  Les refs sont relues à chaque image ; nouveau drapeau `data-n-fond` : la barre prend son fond (flou + filet) dès que le
  contenu passe dessous, le petit titre au passage du grand titre.
- Argent (`compta`, `dashboard`) a le GRAND TITRE de la coque au téléphone ; l'écran ne redit plus « Argent »
  (`ScreenHead titreCoque`, Factures : le plein « Facture » passe dans la ligne d'outils).

## Argent
- Mois : `src/natif/ecrans/ArgentMois.jsx` (remplace src/designV2/ArgentMois.jsx) — carte « 1 841 € reçus en novembre »
  + 6 barres ; tuiles Vendu · Bénéfice · Argent à venir · Disponible (le Reçu est l'affiche : un nombre une fois, §7) ;
  versements en rangées compactes, 8 puis « Voir les 25 » ; à l'ordinateur deux colonnes (la grille verre à trois colonnes
  de verre-ecrans.css est devenue une pile).
- Déclarer : `PrevisionUrssafCarte` en carte native (montant en grand + petit « Copier », cotisations en ligne, « Ce qui
  manque » en une ligne ambre, UN plein « J'ai déclaré », « Ouvrir l'URSSAF ↗ » en lien) ; Mois bouclé (src/MoisBoucle.jsx)
  et Révision du mois (src/ArgentPrix.jsx) en tableaux de rangées (5 puis « Voir les N ») ; récap en trois rangées.
- Statistiques : « Les offres » (src/design/CarteOffres.jsx) ne montre que les colonnes lues, un compte sans rien de lu =
  une ligne grise ; Santé des comptes (src/SanteComptes.jsx) : une rangée par compte, « Pourquoi ? » = le toucher de la
  rangée (dépli en place, pas de feuille : le panneau Réglages et le banc discretion lisent les indicateurs DANS le compte) ;
  Modèle et taille, Tes meilleures sources, D'où viennent mes achats en cartes natives ; « Comment c'est calculé » = « ? »
  (`src/natif/ecrans/AideArgent.jsx`, une feuille). Les titres des cartes d'avant passent en petites capitales grises
  (`src/natif/ecrans/argent-pont.css`, sans couche, Argent seulement).
- Sélecteur de plateforme (décision du coordinateur) : `src/natif/SelecteurSite.jsx` CRÉÉ ici (la branche
  `claude/minimaliste` ne l'avait pas poussé) — props `{ valeur, onChange, sites }`, `useSiteCourant()`, clé
  `vrm_site_courant`, sites reliés seulement ; remplace « Toutes les plateformes · N comptes » ; « Comptes · N › » reste
  une ligne discrète (mène aux comptes, comme hier — pas de feuille). Sur Mois, un site choisi passe à `valeurChiffre`
  (son filtre de site d'hier), filtre l'affichage des versements et cache les barres (la ligne publiée n'est pas par site).
  Les autres segments restent « Tous ». À réconcilier avec la version de `claude/minimaliste` à la fusion.

## Preuves
- `scripts/bancs/argent-natif.cjs` : G grand titre, B barre (défilé 120/400/900 sur Argent, Aujourd'hui, Ventes,
  Annonces, Achats ; ROUGE sur le build d'avant), P un plein, S style (soulignés, boutons pleine largeur, ombres, colonnes
  vides, « Pourquoi ? »), T 44, X coupé, C 4,5:1, N chiffres portés = avant (rouge par mutation). Vert : volume et vide,
  390 tactile zone sûre, 390×664, 1512, 1280, clair et sombre.
- `chiffres-volume` avant/après : publiés identiques (12) ; les data-* de chaque écran identiques en multiensemble hors
  mise en page (`data-n-*`) et horodatages ; les montants rendus d'Argent diffèrent par le NOMBRE de rangées montrées.
- Audits verts : traduction, tdz, variables, urssaf, coherence, onglets-d (regex adaptée à la forme `attrs`), argent-plus,
  quoi-de-neuf, icones, poids-demarrage (sélecteur chargé avec Argent, styles d'Argent hors du démarrage).

## Restes (honnêtes)
- Les cartes d'avant de Statistiques (vitrine, Vendu et reçu, records, comparer, comptes Vinted, Ce qui rapporte, etc.)
  ne sont pas réécrites : seulement leurs titres, cibles et contrastes. Factures : la facturation électronique garde ses
  boutons « Facture » par ligne.
- Bancs d'avant à relire : design-v2-argent (structure du Mois), offres-objectif, argent-plus (source des seuils dans la
  rangée), sante-comptes (« Voir » visible après le dépli), meilleures-sources.
