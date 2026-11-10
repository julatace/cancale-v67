# 9-10 nov. 2026 — Textes d'explication : pastilles, phrases courtes, carte visuelle (lot AI)

Branche `claude/popups-propre` (depuis `origin/main` 7867f121, `origin/main` 6f4ea62d — PR #1084 — fusionné par un
vrai `git merge`), poussée à chaque commit. **Pas de PR, pas de merge** (consigne du coordinateur).

## Ce que Julien a dit, dans l'ordre

1. 9 nov., 21 h : « Je veux que tous les textes comme ça soient remplacés par des pop-ups car actuellement ça fait
   très moche » ; « tu peux proposer des pop-ups pour faire des propositions » (+ bouton « Imprimer » en double, carte
   du compte ⇒ Paramètres, point du compte Vinted « pas ouf »).
2. 9 nov., 22 h 37 (Annonces → Brouillons) : « Encore du texte » — « 2 annonces plus en ligne… », la carte « Une
   annonce remise en ligne ? », « Tes brouillons Vinted, compte par compte… », « 4 brouillons à refaire », « 21
   nouveaux N° ».
3. **10 nov. : « Je n'aime pas du tout les pop-up, ça n'a rien changé à ce que c'était avant. »** ⇒ déplacer le MÊME
   paragraphe dans une feuille ne suffit pas. **La règle de ce chantier est devenue :**
   - chaque explication est RÉÉCRITE en **une phrase de 12 mots au plus** (le fait + le geste) ; le détail technique
     (qui lit quoi, à quelle heure, l'extension, Chrome…) ne s'affiche que s'il touche « Pourquoi ? » ;
   - les **propositions** (même paire que N°7 ?) sont une **carte visuelle** : les deux photos côte à côte, « Même
     paire que N°7 ? », [Oui] [Non] — pas de paragraphe ;
   - les **états** (« 2 retirées de Vinted », « 21 nouveaux N° », « 4 brouillons à refaire ») sont des **pastilles
     d'une ligne**, touchables, sans phrase ;
   - une feuille ne s'ouvre que pour du vrai détail : elle dit d'abord la phrase courte, le détail d'avant est
     **replié** sous « Pourquoi ? ».

## La forme : `src/composants/InfoPop.jsx` (+ `info-pop.css`)

- `InfoPop` avec `puces` (`[{ texte, ton }]`) : une rangée de pastilles d'une ligne (pilule grise, ambre si un geste
  est à faire, jamais rouge), chacune ouvre la feuille ; `phrase` = la phrase de 12 mots au plus, en tête de la
  feuille ; `children` = le détail d'avant, **replié** sous « Pourquoi ? » (`<details>`). Sans `puces`, la ligne
  courte + ⓘ (gardée pour les deux lignes de démarrage de Ma journée).
- La feuille est la feuille unique (`SheetShell` : portail, `FermeAuRetour`, Échap, croix 44 px, focus gardé) ;
  relais dans App.jsx (`InfoPop`, `PuceProposition`), exportés pour `src/ecrans/*.jsx`.
- Les `data-*` d'avant restent sur la rangée (cibles d'« À trancher », bancs) ; les morceaux de texte
  (`data-suppr-dit`, `data-vieux-dit`, `data-geste-dit`, `data-stock-*`…) sont dans le détail.

## Inventaire, écran par écran (avant → après)

| écran | avant (à l'écran) | après (à l'écran) | phrase de la feuille (≤ 12 mots) · détail sous « Pourquoi ? » |
|---|---|---|---|
| Annonces Vinted / Toutes / Brouillons / Statistiques (`FraicheurAnnonces`) | 2 à 6 lignes : « 3 annonces plus en ligne sur Vinted (supprimées ou retirées) : enlevées d'ici automatiquement. shop_x : annonces lues aujourd'hui à 14 h 50 — ce que tu as supprimé… Avec l'extension VRM à jour… Une suppression faite sur vinted.fr dans ce Chrome… » | pastilles `3 retirées de Vinted` · `2 à confirmer` (ambre) · `Lu hier à 15 h 44` · `Relecture pas lue` (ambre) | « Ouvre Vinted sur shop_x pour les relire. » / « À confirmer : VRM les vérifie à ta prochaine visite sur Vinted. »… · tout le texte d'avant + la liste « à confirmer » |
| Annonces | carte « Une annonce remise en ligne ? Tu as supprimé… C'est la même paire que N°11 « … » ? Même marque, même taille : vérifie l'étiquette… [Oui, N°11] [Non, une autre paire] » | **carte visuelle** : photo de l'ancienne (pastille N°11) = photo de la nouvelle ; « Même paire que N°11 ? » ⓘ ; [Oui] [Non] (plusieurs anciennes ⇒ [Oui, N°x] chacune) ; cartes côte à côte en défilement | ⓘ : la question, la règle (photo / ressemblance, vérifier l'étiquette), « rien à réécrire là où elle est rangée » |
| Annonces (« je numérote moi-même ») | carte « N numéros écrits à vérifier · Tu numérotes toi-même… » + lignes | pastille « [2] numéros écrits à vérifier › » | la feuille porte les lignes et « Garder N°X » / « Prendre N°Y » |
| Annonces · Sélectionner / Brouillons | « Coche des annonces d'un même compte, puis Actions : republier, modifier prix ou titre, mettre en brouillon ou en ligne. » / « Tes brouillons Vinted, compte par compte. Coche-les, puis Actions : mettre en ligne. » | réécrit, sans feuille : « Coche des annonces d'un compte, puis **Actions**. » / « Coche tes brouillons, puis **Actions**. » (les tuiles d'Actions disent les gestes) | — |
| Annonces · barre d'outils | gros bouton gris pleine largeur « 4 brouillons à refaire » | pastille « [4] brouillons à refaire » (compteur ambre) | ouvre la même liste qu'avant |
| Annonces | bloc pleine largeur « 21 nouveaux N° ⌄ » | pastille « 21 nouveaux N° ⌄ » (même bouton, même liste) | — |
| Annonces · Vestiaire | « 3 annonces (au moins), lues sur Vestiaire il y a 7 j. À confirmer : la lecture a plus de 24 h — ouvre « Mes articles »… » | pastilles `Au moins 3 annonces` · `Lu il y a 7 j` · `À confirmer` (ambre) · `Fiches à venir` (ambre) | « Ouvre « Mes articles » sur Vestiaire pour les relire. » · la phrase d'avant |
| Stock (résumé) | « 3 rangées · 42 pas encore rangées · dont 3 à confirmer (Vestiaire, lu il y a 7 j — ouvre…) · dont 8 masquées par Vinted… · 1 sans N° (donne-leur…) · 4 annonces eBay sans N° pas comptées… » | pastilles `3 rangées` · `42 à ranger` · `3 à confirmer` (ambre) · `Pas tout lu` (ambre) · `5 sans N°` ; le grand chiffre garde « au moins » | « Une lecture manque : ouvre ce site avec l'extension. »… · la ligne entière d'avant (mêmes `data-stock-*`) |
| Stock | « 3 paires rangées pas vérifiées (N°5, N°27, N°B153) : une lecture manque… Je ne dis ni qu'elles sont en ligne, ni qu'elles sont parties. » | pastille `3 pas vérifiées` | « Une lecture manque : ni « en ligne », ni « partie » n'est dit. » · la phrase entière |
| Stock · Plus en ligne | « Rangées, mais plus en annonce nulle part : retire-les du carton… » | « Retire-les de leur case, ou garde-les ⓘ » | la phrase entière |
| Stock · « Comment marche le Stock » | étapes de 2 lignes | « Crée ton meuble, puis glisse chaque article dans sa case. » · « Colis parti : la case se libère, le numéro reste. » | — |
| Ma journée (1er lancement) | « Ce que tu vends, tes plateformes, ton statut, ton numéro : deux minutes… » ; « pourquoi » du guide (≈ 95 car.) | « Deux minutes, et VRM s'adapte à toi ⓘ » ; « Pourquoi cette étape ? ⓘ » | la phrase d'avant |
| Colis | « 1 bordereau à imprimer — à envoyer avant … [Imprimer] » ET « Tout imprimer » | la phrase seule ; « Tout imprimer » reste le seul bouton | — |
| Colis « Peut-être en double » | déjà retiré sur `main` (« Retraits frais ») | — | — |

**Rien de métier ne change, aucune information n'est perdue** : les phrases d'avant sont sous « Pourquoi ? » ;
« au moins », « à confirmer », « pas tout lu », « sans N° » sont des pastilles (ambre quand un geste est à faire) ;
un colis ou une annonce douteux reste visible ; « carton » remplacé par « là où elle est rangée » / « leur case »
(règle de `main`, 9 nov.).

### Bouton en double (demande 2)
Le « Imprimer » de la ligne « Prochain geste » de Colis appelait `ouvrirLot()` avec la même garde
(`batchBusy || nLot === 0`) que « Tout imprimer » (même lot `lignesLot`, même compte `nLot`) ; sur un autre onglet il
changeait d'onglet puis ouvrait le MÊME lot. ⇒ la phrase reste, « Tout imprimer » est le seul bouton.

### Carte du compte (demande 13)
`.vrm-nav-compte` est un `<button>` qui ouvre Paramètres (`setTab('settings')`), `aria-label` « nom · offre — ouvrir
Paramètres », anneau clavier. « Plus » au téléphone n'a pas de carte du compte (rien à câbler).

### Compte Vinted en haut à droite (demande 14)
L'**avatar** du compte (son initiale) ; sans compte lu un « V » ; en vérification l'icône qui tourne. Le point
devient un **badge** de 9 px sur son bord (encre / ambre / gris, jamais rouge), même `.vrm-etat-point`, même
`aria-label`, même menu (`src/styles-popups.css`).

## Caractères visibles par écran (banc `popups-propre`, mêmes données inventées)

« phrases » = texte des blocs de plus de 30 caractères hors boutons et pastilles (le mur de texte) ; « total » =
tout le texte de l'écran (titres, chiffres, cartes, boutons compris).

| écran (390 clair) | avant total | après total | avant phrases | après phrases |
|---|---|---|---|---|
| Annonces · Vinted | 1 448 | 829 | 734 | **141 (÷ 5,2)** |
| Annonces · Toutes | 1 448 | 830 | 734 | **141 (÷ 5,2)** |
| Annonces · Vestiaire | 934 | 729 | 467 | 217 (÷ 2,2) |
| Stock | 1 233 | 974 | 819 | 505 (÷ 1,6) |
| Colis | 517 | 507 | 208 | 207 |
| Ma journée | 1 025 | 926 | 379 | 189 (÷ 2) |
(1512 : Annonces 1 781 → 1 162 total, 734 → 141 phrases ; Stock 1 265 → 1 006, 849 → 535.)

**Stock n'atteint pas ÷ 3** : ce qui reste (relevé `PHRASES=1`) est la LISTE des annonces actuelles — « N°6 · Asics
Gel-1130 argent taille 43 », « Vinted · compte_test pas encore rangée »… — des données, pas de l'explication ; et
« Comment marche le Stock » (3 étapes raccourcies, carte d'accueil d'un stock sans meuble). L'explication du Stock
(résumé 260 car. + « pas vérifiées » 190 car.) est passée à 5 pastilles.

## Preuves (§6)

- **`scripts/bancs/popups-propre.cjs`** (données inventées ; 390 tactile sombre + clair, 1512 ; Annonces Vinted /
  Toutes / Vestiaire, Stock, Colis, Ma journée, carte du compte) : P1 aucun bloc visible > 90 caractères sur 2 lignes
  et plus hors feuille (à 390 px une ligne de 13 px tient ~48 caractères) ; P2 pastilles ou ligne + ⓘ, d'une ligne ;
  la feuille dit une phrase de **12 mots au plus**, le détail d'avant est sous « Pourquoi ? » (ouvert, il contient le
  texte d'avant) ; croix et Échap ferment ; P3 la remise en ligne est une carte (2 photos, « Même paire que N°7 ? »,
  [Oui] [Non], ≤ 60 caractères de texte), rien relié avant SON clic, « Oui » relie 9303 au N°7 ; P4 un seul bouton
  d'impression ; P5 carte du compte ⇒ Paramètres ; P6 avatar + badge, aucun rouge rendu ; CARACTÈRES par écran.
  - cette branche : **140 verts, 0 rouge** ;
  - `origin/main` (git archive, son build, le banc copié dedans) : **39 rouges** ;
  - mutation (`InfoPop` qui recopie son texte à l'écran) : **24 rouges**.
- `npm run build` vert ; audits `variables`, `tdz`, `coherence`, `identite`, `statuts`, `icones`, `boutons` verts.

## Bancs existants (un à la fois, après le merge de `main`)

| banc | résultat |
|---|---|
| annonces-coherence, cycle-supprime, colis-retirer-propre, iphone-reprise, direction-artistique-6, beaute, numero-ecrit, republier, a-trancher | verts |
| numero-ou-remise | vert — mis à la carte (plus de pop-up : la carte est à l'écran ; « vérifie l'étiquette » lu derrière ⓘ) |
| numero-ecrit | vert — ouvre la pastille « numéros écrits à vérifier » |
| enligne, supprimees, stock-annonces | mis à la forme : le banc ouvre la feuille, déplie « Pourquoi ? », lit, referme. Restent rouges les contrôles **déjà rouges sur `origin/main`** (mesuré dans l'arbre `git archive`) : enligne (« la republiée 7003 apparaît une fois », tableau de bord « à confirmer », file Leboncoin…), supprimees (3 du tableau de bord), stock-annonces (A « compte nommé », V2, V3) |
| vestiaire-fiches | P1 et « à expédier en tête » déjà rouges sur `origin/main` ; la fraîcheur lue sur la pastille (« lu il y a 2 h », sans « à confirmer ») |
| indicateur-pro | A, B, C déjà rouges sur `origin/main` ; le badge n'a plus d'anneau quand tout va bien |
| nav-v2 | port pris par une autre session au moment du passage (EADDRINUSE) — à relancer avec `BANC_PORT` |

## Planches

`docs/passation/planches-popups/` (données inventées) : `avant-apres-*` (gauche `origin/main`, droite cette branche)
`{390-sombre,390-clair,1512-clair}-{annonces-vinted,annonces-toutes,annonces-vestiaire,stock,colis,journee}` et
`-zone` (la zone changée au milieu de l'écran) ; `apres-*-popup` (la feuille : la phrase + « Pourquoi ? » déplié par
le banc) ; `apres-*-remise-carte` (la carte « Même paire ? ») ; `apres-*-entete-compte` (avatar, carte ⇒ Paramètres).

## Ce qui reste

- Le reste de l'app : ~390 chaînes JSX de plus de 90 caractères (relevé statique : App.jsx 136, Réglages 40, Compta
  36, eBay 24, Leboncoin 23, Republier 15, Accueil 15, Vestiaire 12, Stats 8…) à passer à la même règle (pastilles,
  phrase ≤ 12 mots, « Pourquoi ? »), écran par écran — le banc se prolonge en ajoutant un écran à `ECRANS`.
- Stock : la liste des annonces actuelles reste en lignes de texte (données) ; si Julien veut ÷ 3, la passer en
  grille de cartes (photo, N°, place) comme Annonces.
- « Prix d'achat 0/3 connus : ton bénéfice n'est qu'un minimum. » (Annonces) : 2 lignes au téléphone, ≤ 90 car. —
  candidate à une pastille « Prix d'achat 0/3 ».
- Les bancs enligne / supprimees / stock-annonces / vestiaire-fiches / indicateur-pro ont des rouges hérités de
  `main` (pas de ce chantier) : à remettre à la règle par leur propriétaire.
