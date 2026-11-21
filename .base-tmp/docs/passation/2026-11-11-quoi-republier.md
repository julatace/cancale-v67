# 11 nov. 2026 · « Quelles annonces republier ? » (lot `quoi-republier`)

Demande de Julien (validée) : **« Quelles annonces republier ? »** — une liste triée des
annonces en ligne depuis longtemps avec peu de vues et de favoris (chiffres LUS, âge depuis
la mise en ligne lue, « pas su » dit), chaque ligne avec sa raison en une phrase
(« 45 j en ligne · 2 favoris · 12 vues ») ; seuils réglables ; un toucher ajoute l'annonce
(ou la sélection) dans l'atelier Republier, déjà cochée, et c'est LUI qui lance.

## Ce qui est livré

- **La règle** : `src/quoiRepublier.js` (pure). « Ancienne » = `articlesQuiDorment`
  (`src/quiDorment.js`, seuil 30/60/90 j) — aucune copie ; un compteur lu = `compteurLu`
  (`src/vendrePlus.js`). Plafonds réglables : favoris ≤ 0/1/2/5, vues ≤ 10/25/50/100
  (défaut 30 j · ≤ 1 favori · ≤ 25 vues). Trois issues : un compteur LU au-dessus ⇒ elle
  marche (pas proposée) ; les deux lus sous les plafonds ⇒ `liste` ; un compteur PAS lu ⇒
  `aVerifier` (repli à part, jamais mêlé : pas su ≠ peu). Âge inconnu ⇒ `sansDate`, dit.
  Identité = clé (compte + identifiant Vinted ; identifiant Leboncoin), jamais le titre.
  Tri = celui de quiDorment (le plus ancien d'abord).
- **La carte** `src/design/QuoiRepublier.jsx` (+ `src/design/quoi-republier.css`) : titre et
  nombre, « Tout cocher (N) », réglages repliés (résumé « 30 j · ≤ 1 favori · ≤ 25 vues »),
  5 lignes puis « Voir les N », « N à vérifier » replié, « N sans date… ». Une ligne = un
  bouton (44 px+) : un toucher coche / décoche. Tout le texte en `tr()` (clés `qr.*`, 5
  langues) ; fichier ajouté aux écrans migrés de `audit-traduction` (F1).
- **Vinted** : en tête de la vue Annonces → Republier. Un toucher coche dans `selAnn` (la
  sélection de l'atelier, par compte + identifiant) ; une annonce que la liste refuse
  (`raisonPas`, en vérification…) dit pourquoi. « Par VRM · N » / « À la main · N » restent
  SES gestes. Base = `annBase` (la grille, `<enligne-regle>`) ; pas lue ⇒ « — ».
- **Leboncoin** : l'atelier « Republier sur Leboncoin » existe sur `main`
  (`RepublierLeboncoin`, `src/ecrans/Leboncoin.jsx`) ⇒ la même carte en tête de l'étape
  « Choisir » : âge depuis `publieeLe` LU (`ageDepuis`), vues/favoris relevés (`lbc.vues`,
  `lbc.favoris`). Un toucher coche dans `sel` (plafond `REPUB_LBC_MAX` = 10 respecté, dit).
  Seules les annonces que l'atelier sait recréer (la liste `repub`) sont jugées.
- **Ma journée** : une ligne `quoi-republier` (« 51 annonces anciennes et peu vues »)
  seulement s'il y en a (les « à vérifier » n'y comptent pas ; dates pas lues ⇒ rien) ;
  « Voir » ⇒ Annonces → Republier (`demanderVue('quoirepublier')`). Carte `republier` de
  « Modifier ma journée » (`CARTES_JOURNEE`), cachable, comptée à part dans « N gestes ».
  Choix tranché : visible aussi en mode Simple (pas ajoutée à `CASES_JOURNEE_CONSEIL`).
- Réglage des seuils : `localStorage` `vrm_quoi_republier` (confort de l'appareil, comme le
  seuil « qui dort » ; illisible ⇒ défaut). Le même pour Vinted et Leboncoin.
- « Quoi de neuf » : `quoi-republier`.

## Preuves

- `node scripts/audit-quoi-republier.cjs` : 21 ✅ (règle + branchements) ;
  `--prouve` : 9 mutations toutes rouges (pas lu = peu, favoris ignorés, vues ignorées,
  plafond strict, âge recopié, identité par titre, seuil libre, pas lu = liste vide,
  journée comptant les « à vérifier »).
- Banc `scripts/bancs/quoi-republier.cjs` (390 tactile, 1512, clair et sombre, en français) :
  **84 ✅ · 0 ❌** — carte Vinted (51 + 1 à vérifier, raison « 95 j en ligne · 0 favori · 10 vues »,
  50 annonces au même titre = 50 lignes), toucher ⇒ coché dans l'atelier (« Par VRM · 1 »),
  second toucher ⇒ décoché, « Tout cocher (51) », régler 90 j (gardé), Ma journée (51, « Voir »
  ⇒ Republier), Leboncoin (N°13 cochée, « Continuer (1) ») ; aucune commande envoyée, aucun
  débordement, aucune erreur. Captures 390/1512 regardées. Sur l'arbre d'avant (le `dist` de
  main 76445c04, banc copié dedans) : **10 ❌ · 0 ✅** (aucune carte, aucune ligne de journée).
- Premier passage du banc : 16 rouges, tous de LANGUE (Chromium du banc en anglais ⇒ l'app
  en anglais, la traduction marche) ; le banc pose désormais `vrm_langue = fr` et `fr-FR`.
- Audits du brief verts (variables, tdz, coherence, identite, icones, textes-courts,
  fonctions-api, secrets, quoi-de-neuf, traduction) + qui-dorment, vendre-plus, journee-perso.

## ÉTAT À LA REPRISE

Livré et poussé sur `claude/quoi-republier` (origin/main fusionné). Rien de rouge connu.
- Pas fait (choix) : pas d'entrée dans le menu Outils (le bouton « Republier… » mène déjà à
  la vue où est la carte) ; seuils non synchronisés entre appareils (confort local, comme
  « qui dort ») — à mettre dans SYNC_KEYS si Julien le veut.
- La branche `claude/lbc-plus` touche aussi `src/ecrans/Leboncoin.jsx` (RepublierLeboncoin,
  suivi de travail) : à sa fusion, garder les deux (mon ajout = 3 imports, 5 lignes d'état
  avant `fiche`, le bloc `<QuoiRepublier site="leboncoin"…/>` sous la phrase « Supprimée puis
  remise comme neuve »).
- Non vérifié en vrai : la forme réelle des vues Vinted à 0 (`view_count` 0 est lu `null` par
  l'app ⇒ « vues pas lues », l'annonce va dans « à vérifier », jamais proposée à tort).
