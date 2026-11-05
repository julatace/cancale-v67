# 5 nov. — Chantier C : Annonces (revue de cohérence 2.5 à 2.10)

Feuille de route : `docs/passation/2026-11-05-revue-coherence.md`. Jetons du chantier A,
composants du chantier B (utilisés sans les modifier). Branche locale `v35-chantier-c`
(depuis `claude/project-review-nsk5su`), rien poussé, rien dans `vinted-sync-extension/`.

## Ce qui change (les points de la revue)

### 2.5 — UNE feuille d'actions
- La feuille « Republier et brouillons » (second chemin vers les mêmes moteurs, d'autres
  mots : « Brouillons → en ligne », « En ligne → brouillon », « Voir mes brouillons ») est
  **retirée**. « Republier… » (barre d'outils) et l'entrée « Republier » du menu
  (`prendreVue('republier')`) mènent à la vue **Sélectionner** ; on coche, puis la feuille
  **« Actions · N annonces »** (`ActionsSelectionFeuille`) est la seule.
- **Quatre tuiles**, dans l'ordre, les mêmes mots partout (`ACTIONS_TUILES`,
  `src/annoncesActions.js`) : **Republier · Modifier prix ou titre · Mettre en brouillon ·
  Mettre en ligne** (2 × 2 à l'ordinateur, une colonne au téléphone). « Republier à la
  main » n'est plus une cinquième tuile : un lien discret dessous (gris quand il ne peut
  pas partir, jamais un bleu éteint).
- **La raison d'indisponibilité est dite UNE fois**, en tête (`raisonCommune`, règle pure) :
  la raison partagée par les tuiles grisées (deux comptes mélangés, compte de l'onglet pas
  su, « Seulement pour les annonces en ligne »…) ; sous une tuile ne reste que SA raison si
  elle diffère (« Mettre en ligne » : « Seulement pour les brouillons… »). Avant : la même
  phrase quatre ou cinq fois.
- « Voir mes brouillons » (publier ou retirer un brouillon un par un) vit dans la vue
  **Brouillons** (lien « Un par un ») ; « N brouillons à refaire » reste dans la barre.
- `SheetShell titre=` (croix partagée 44 px) au lieu du `<h2>` et du « ✕ » faits main.

### 2.6 — La carte à l'ordinateur : deux gestes + « … »
- Neuf boutons → **« Changer le prix » · « Voir / Ranger au stock » · « … »**. « … » ouvre
  une feuille (`SheetShell`, titre = l'article, sous-titre = sa pastille N°) avec : la file
  Leboncoin (bascule, la feuille reste ouverte), Relier un achat, Passeport, Relier à
  Vestiaire, Histoire · Dupliquer, Marquer vendue — **les mêmes gestes, les mêmes
  écritures** (`updatePair`, `openPicker`, `markSold`…), lignes de 48 px.
- **« Changer le prix » et « Baisser à X € ↗ » ne font plus qu'un** : le prix conseillé
  (−15 %, même règle `sugg`) s'écrit DANS le geste (« 102 € conseillé »), sans bleu. Sans N°,
  le geste ouvre l'édition de l'annonce sur Vinted (avant : aucun geste de prix).
- Les cases chiffrées en mots : « mini · refuse < · boost · marge » → **« Accepter dès ·
  Refuser sous · Boost payé · Marge »** (en entier, sur deux lignes si la carte est étroite ;
  la marge par `montant(…, {signe:true})`). Les offres automatiques parlent des mêmes mots.
- Au téléphone, « Plus d'actions » devient **« Détails et gestes »** (il contient « … »).

### 2.7 — Le prix d'achat
- **Une ligne d'avis** en tête de la liste (`data-ann-avis`) : « **Prix d'achat 2/6** connus
  · **Compléter** » (`data-ann-achats`, compté sur la même base que la grille, `annBase` ;
  absent quand tout est connu ; « Compléter » ouvre la saisie en série existante) et, à
  côté, « **4 nouveaux N° · Vérifier** » (`data-num-neufs-ouvrir`) qui déplie dessous la
  liste des N° posés par VRM (avant : un bloc de quatre lignes toujours ouvert). Une ligne,
  pas deux blocs : au téléphone le premier article reste dans le premier écran (banc
  `fusion-app` F4 : y = 904 sur l'état intégré, sous 600 après). L'entrée « Compléter les prix
  d'achat » du menu Outils (le même nombre une seconde fois) est retirée.
- La case « Prix d'achat » de la carte est **grise** (plus de bord ni de libellé ambre sur
  chaque carte) ; au téléphone, fermée, elle ne s'affiche plus (le bandeau le dit une fois).

### 2.8 — `PhotoVide` et `Numero` partout
- Carte : la pastille N° sur la photo est `Numero taille="grand"` (encre en clair, gris
  élevé #48484A en sombre — **plus de pilule blanche la nuit**) ; « + N° » sans numéro, une
  pastille translucide neutre. Photo absente : `PhotoVide remplir`.
- Sélectionner : `Numero` + `PhotoVide` (avant : « N°42 » en texte, un carré vide).
- Feuille Actions (« Avant de lancer »), suivi « à la main », feuille « … », panneau des
  doublons (`Numero etat="doublon"`, le seul rouge), reprises de N° : `Numero`.
- Panne de lecture : `EtatPanne` (« Tes annonces Vinted : pas su pour l'instant. » +
  Réessayer) au lieu de `LoadError`.

### 2.9 — « sélection » ne nomme plus que les cases cochées
- Le filtre : « N annonces dans cette sélection · Réinitialiser les annonces » →
  **« N annonces affichées · Tout afficher »** ; absent des vues à cocher (Sélectionner,
  Brouillons), dont la tête dit déjà quoi faire.

### 2.10 — La barre d'outils au téléphone
- Recherche : `ChampRecherche` (micro intégré, 17 px au doigt : iOS ne zoome plus).
- **Trier · Republier… · ⋯ Outils : UN dessin** (fond teinté des boutons secondaires,
  rayon 12, 36 px souris / 44 px doigt ; appuyé = teinte forte, jamais l'accent). Le tri
  est un bouton qui porte la liste native et dit le tri courant (« Les plus anciennes »).
  Au téléphone, une rangée : la recherche puis les trois en icône (nom dans aria-label).
- Filtres : **« Sélectionner » en deuxième** (au téléphone la rangée défile et le coupait
  au bord : « Séle… »), « Tout le stock » → « Toutes » (le Stock est un autre écran).

## Les petites améliorations (avant → après)
1. Feuille Actions : 5 boutons dont « à la main » → 4 tuiles + un lien discret.
2. La même raison sous chaque action (4-5 fois) → une fois, en tête.
3. « En ligne → en ligne, avec tes modifications » → « Modifier prix ou titre ».
4. « En ligne → brouillon » / « Brouillon → en ligne » → « Mettre en brouillon » / « Mettre en ligne ».
5. Croix « ✕ » texte + `<h2>` faits main → `SheetShell titre` (croix icône 44 px).
6. « ✓ Rien ne manque dans ce que VRM a lu. » sur chaque paire → une coche discrète au bout de la ligne.
7. « Pas lu par VRM : … L'extension les vérifie… » répété par paire → une fois sous la liste quand c'est le même.
8. « Avant de lancer : 1 annonce sur 2 a un manque » → « Avant de lancer · 1 sur 2 à corriger ».
9. « Republier à la main » grisé en bleu éteint (illisible la nuit) → gris ; sa raison n'est pas répétée si c'est la raison commune.
10. Tuiles d'actions : 1 colonne de 5 → grille 2 × 2 à l'ordinateur ; retour au toucher (scale .98).
11. Feuille « Republier et brouillons » → retirée (un seul chemin).
12. Entrée de menu « Republier » → vue Sélectionner (même destination que la barre).
13. Bouton « Republier… · 2 brouillons » (un nombre dans un libellé) → « Republier… » (le nombre est sur le filtre « Brouillons »).
14. Recherche faite main (bordure, 13 px, micro et croix à part) → `ChampRecherche`.
15. Tri : `<select>` à bordure → bouton du même dessin, icône + tri courant.
16. Tri « Prix ↓ / Prix ↑ » → « Prix décroissant / Prix croissant ».
17. « ⋯ Outils » ouvert en texte bleu (`C.accent`) → état appuyé neutre.
18. Les quatre boutons de la barre au téléphone (gris, blanc, contour) → un dessin, 44 px.
19. Anneau de focus bleu après un tap → au clavier seulement (`:focus-visible`).
20. Menu Outils : lignes de 38 px → 44 px, nom seul (le détail dans l'infobulle).
21. « Compléter les prix d'achat » en double dans Outils → retiré (le bandeau).
22. « N brouillons à refaire » au bord ambre fait main → `Bouton` secondaire.
23. « Tout le stock » → « Toutes ».
24. « Sélectionner » en dernier (coupé au téléphone) → en deuxième.
25. « Sans numéro » → « Sans numéro · N » (le nombre à rattraper).
26. « N annonces dans cette sélection » → « N annonces affichées ».
27. « Réinitialiser les annonces » → « Tout afficher ».
28. Ligne de filtre dans les vues à cocher → retirée (la tête dit quoi faire).
29. « Prix d'achat » ambre sur chaque carte → un bandeau « 2/6 · Compléter », case grise.
30. Pastille N° blanche (même en sombre), pilule 999 → `Numero` rayon 6, gris élevé la nuit.
31. « + N° » pilule pleine → pastille translucide neutre.
32. Photo absente : icône 28 px à 55 % → `PhotoVide` (un dessin pour l'app).
33. Neuf gestes sur la carte d'ordinateur → deux + « … ».
34. « Baisser à 94 € ↗ » bleu → dans « Changer le prix » : « 94 € conseillé ».
35. Sans N° : aucun geste de prix → « Changer le prix ↗ » (édition sur Vinted).
36. « mini » → « Accepter dès ».
37. « refuse < » → « Refuser sous ».
38. « boost » / « marge » → « Boost payé » / « Marge » (majuscule en tête).
39. Libellés coupés « Accepter … » au téléphone → en entier sur deux lignes.
40. Marge écrite à la main (`+19 €`) → `montant(…, {signe:true})`.
41. « Plus d'actions » → « Détails et gestes » (le « … » est dedans).
42. Carte étroite (2 colonnes au téléphone) : gestes écrasés hors de la carte → « Changer le prix » sur sa ligne, stock + « … » dessous ; icône du stock qui rétrécissait en point → taille fixe.
43. Retour au toucher sur les gestes de la carte et les boutons de la barre (scale .97), survol seulement à la souris.
44. Offres automatiques : « Pose un « mini » » → « Remplis « Accepter dès » » ; « Sous ton « refuse < » » → « Sous « Refuser sous » ».
45. Statut des offres auto « aucun mini posé » → « aucun « Accepter dès » rempli ».
46. Sélectionner : « Coche des annonces, puis Actions. » → dit « d'un même compte » et les quatre actions.
47. « Tout décocher (2) » → « Tout décocher » (le nombre est sur « Actions · 2 »).
48. Sélection vide « Aucune annonce à sélectionner. » → dit quoi faire (ouvrir vinted.fr).
49. Brouillons vides → dit quand ils apparaissent.
50. « Lecture de tes annonces… » / « Lecture de tes brouillons… » → `PAS_SU.enCours` (un mot).
51. Vue Brouillons : lien « Un par un » (le détail qui vivait dans la feuille retirée).
52. Sélectionner : N° en texte → `Numero` ; carré vide → `PhotoVide` ; titre tronqué sans couper la pastille.
53. Ligne de Sélectionner : retour au toucher (scale .985).
54. Doublons : « N°12 » gras → `Numero etat="doublon"` (le seul rouge légitime).
55. Doublons : « → N°13 » bordure bleue faite main → `Bouton` « Passer au N°13 ».
56. Doublons : « Elle n'est plus là » fait main → `Bouton`.
57. Panne de lecture `LoadError` → `EtatPanne` (« pas su » + Réessayer).
58. Aucune annonce : lien « Ouvrir Vinted ↗ » peint à la main → `Bouton` primaire.
59. Reprises de N° : fond et titre bleus + « ♻️ » → carte neutre, sans emoji.
60. Reprises : « N°901 (neuf) → N°42 » texte bleu → deux `Numero`.
61. Reprises : « Remettre N°42 » aplat bleu fait main → `Bouton` secondaire ; « ⚠️ » retiré.
62. Reprises : vignette vide icône 20 px → `PhotoVide`.
63. « Aide à la vente » bordure + texte bleus faits main → `Bouton` secondaire.
64. « 4 mises en ligne numérotées par VRM », bloc de 4 lignes toujours ouvert → « 4 nouveaux N° · Vérifier » dans la ligne d'avis, la liste se déplie dessous.
65. N° de ces lignes « N°2 » en bleu (#0071E3, 3,6:1 la nuit — fusion-app F6) → `Numero` ; vignette vide noire → `PhotoVide` ; « C'est bon » / « Tout est bon » → `Bouton`.
66. Bandeau prix d'achat + bloc des N° neufs (deux blocs) → une ligne à deux cases.
67. Au téléphone : « Vérifier » devient un chevron, la phrase du prix d'achat passe dans l'infobulle — la ligne reste une ligne.
68. Boutons discrets bleus en aplat (#0A84FF sur la carte sombre, 3,6:1) → bleu « lien » (`--vrm-accent-texte`) dans l'écran et ses feuilles.
69. Rayons 10 px (vignettes de Sélectionner, photos « à la main ») → 12 (échelle fermée : `annonces-selection.css` sort de la liste des fichiers hors échelle).
70. Au téléphone, l'air entre la carte du haut et la barre d'outils : 33 → 23 px (premier article dans le premier écran).

## Preuves
- `npm run build` vert.
- **Banc** `scripts/bancs/annonces-coherence.cjs` (données INVENTÉES, 2 comptes, 7 annonces
  dont un titre très long, 2 prix d'achat connus sur 6 ; `BANC_PORT` 9017 par défaut ; 390
  tactile et 1512, clair et sombre). Il mesure U (une feuille, 4 tuiles dans l'ordre, la
  raison une fois en tête, « Republier… » et l'entrée de menu → Sélectionner), G (≤ 2
  gestes + « … », pas de « Baisser à », aucun texte bleu sur la carte, cases en mots, feuille
  « … » ≥ 44 px), P (bandeau « 2/6 », case grise), N (Numero jamais clair, PhotoVide), B
  (ChampRecherche, un dessin pour les boutons, 44 px au doigt, une rangée au téléphone,
  « Sélectionner » entièrement visible), S (« affichées »), F (débordement, erreurs).
  **Base (`claude/project-review-nsk5su`, git archive + build à part, banc copié dedans) :
  48 rouges / 22 verts** ; **après : 127 verts, 0 rouge** (voir « Bancs voisins » pour la
  dernière passe).
- **Audit** `scripts/audit-annonces-coherence.cjs` (29 contrôles : `raisonCommune`, tuiles,
  branchements, zone sans « Baisser à », sans `C.accent` en texte, sans mot écarté de
  `libelles.js`, Numero/PhotoVide/ChampRecherche/SheetShell, rangée de la carte, bandeau,
  case grise) : vert ; **base : 24 rouges sur 29** ; `--prouve` : **15/15 mutations rouges**.
- Audits demandés, verts : `audit-rouge-doublon`, `audit-composants`, `audit-coherence`,
  `audit-identite`, `audit-icones`, `audit-fonctions-api` ; et `audit-annonces-actions` (58),
  `audit-verif-annonce`, `audit-boutons`, `audit-tdz`, `audit-variables`.

## Bancs voisins
(voir la section « Résultats » ajoutée en fin de chantier)

## Captures (hors dépôt, regardées)
- Après : `scratchpad/c-apres/ac-{390,1512}-{clair,sombre}-{haut,carte,carte-menu,filtre,selection,actions,actions-raison}.png`.
- Avant : `scratchpad/c-avant/ac-*-haut.png` (pilule N° blanche en sombre, quatre dessins de
  boutons, « Séle… » coupé) et la revue `scratchpad/coherence/shots/02-annonces-*`,
  `03b-annonces-actions-selection-*`, `04-annonces-republier-*`.

## Ce qui reste
- Composant partagé manquant : aucun pour un **bouton-liste natif** (Trier) — fait ici en
  CSS de zone (`.vrm-annbar-tri`) ; à remonter dans `src/composants/` si un autre écran trie.
- `QuiDorment`, `AnnoncesMasquees`, `FraicheurAnnonces`, `RepublierVinted` (le moteur) et
  `RepublierALaMain` n'ont pas été repris (hors des points 2.5-2.10).
- Le moteur `RepublierVinted` garde son étape « Choisir » (atteinte seulement par une
  reprise d'opération) ; depuis l'écran on y entre toujours après « Sélectionner ».
- La carte sombre du haut (« — Qui dorment ») est hors zone (chantier E1/F).

## Geste de Julien
Annonces : cocher deux annonces d'un même compte → « Actions » ; sur une carte, toucher
« … » ; toucher « Compléter » dans le bandeau « Prix d'achat ».
