# 9 nov. 2026 (soir) — Direction artistique, phase 6 : « Widgets » à la iOS

Branche `claude/direction-artistique-6` (depuis `origin/main` 29f4f240). Poussée à chaque commit. **Pas de
PR, pas de merge** (consigne du coordinateur) : à valider par Julien.

Julien, mot pour mot : « J'aime pas trop l'affichage, il n'y a pas un grand changement », « le design en
général du site tu ne l'as pas énormément modifié, les boutons font moins qualitatif ». Il a refusé les
maquettes sur canevas : le changement est DANS L'APP. Les phases 1 à 5 avaient affiné (rayons, graisses) —
ça ne se voyait pas. Ici, un changement qu'on remarque en une seconde.

## Le fichier

**`src/styles-widgets-ios.css`**, importé EN DERNIER par `src/App.jsx` (après `styles-nav-v2.css`), dans la
même couche que la direction artistique (`@layer vrm-premium`). Jetons `--w-*` en tête. Chaque sélecteur
est préfixé `:root:root body` pour passer devant `styles-premium.css` et `styles-journee-v2.css` (même
couche, sélecteurs en `.vrm-main:is([data-ecran=…])`).
⚠️ Le nom `src/styles-widgets.css` demandé était déjà pris (la grille « Ma journée en widgets » du 21 oct.,
toujours importée par `src/stylesApp.js`) : d'où `styles-widgets-ios.css`.

**Aucun JSX touché.** Aucun texte, chiffre, règle, `data-*` ni geste ne change ; rien de lisible n'est
masqué (le mot « Voir » reste dans le DOM, lu par les lecteurs d'écran et les bancs).

## Ce qui change, écran par écran

| écran | avant | après |
|---|---|---|
| **toutes les cartes sombres** (Ma journée, Ventes, Colis, Annonces, Achats, Compta : le même composant `CarteMois`) | une carte sombre qui porte le grand chiffre ET trois cases translucides | la carte sombre ne porte plus que son grand chiffre (44/800, 52 à l'ordinateur) ; ses cases en SORTENT et deviennent des **widgets** blancs (#1C1C1E la nuit), rayon 24, sans bordure, ombre très douce le jour : libellé 13/600 gris en haut, chiffre 34/800 tabulaire, note en bas, chevron dans le coin d'un widget qui s'ouvre. **Bento** : nombre impair de cases ⇒ la première est large (2×1), les autres carrées ; à l'ordinateur, une rangée [large·carré·carré] |
| **Ma journée** | la tête sombre bord à bord avec trois cases dedans ; « Ensuite » : chaque rangée avec un petit bouton gris « Voir » | téléphone : la tête reste bord à bord (sa forme du 2 nov.), trois widgets carrés sur UNE ligne dessous (pas de bento sur deux rangées : la règle du 27 oct. veut la 1re carte de « Ensuite » entière au-dessus de la barre du bas, banc `journee-premium`) ; ordinateur : tête en carte arrondie, widgets en bento dessous ; « Ensuite » 22/800 ; plus de bouton « Voir » : la rangée entière se touche, un chevron › gris le dit ; le geste principal de la tête (« Imprimer ») garde sa pilule bleue |
| **Ventes** | rangées dans un groupe rayon 18 | groupe rayon 24, rangée 64 px, titre 16/600, **chevron ›** calé à droite de chaque vente |
| **Colis** | boutons carrés gris (scanner, ⋯), « Tout imprimer » rectangle bleu | scanner et ⋯ en **ronds** de 44, « Tout imprimer » **pilule** bleue, « Imprimer » pilule grise ; widgets [À imprimer large · Déposé · À retirer] ; « Transporteur inconnu » 20/700 |
| **Annonces** | cartes rayon 18, N° en étiquette carrée, titre qui débordait de la carte | cartes rayon 24, N° en **pastille ronde** ombrée sur la photo, titre coupé proprement en « … » dans la carte (il débordait avant, défaut d'origine) ; widgets [Qui dorment large · Ventes · Vendu] |
| **Achats** | idem cartes | widgets [En route large · À retirer · Arrivés] ; groupe rayon 24 |
| **Messages** | rangées sans chevron, espace de travail cerné | chevron › sur chaque conversation ; espace de travail sans cadre ; « Réponses rapides » avec l'air d'une rangée |
| **Compta** | carte sombre « bénéfice » + 3 cases dedans | carte sombre (bénéfice + sa phrase) puis widgets [À déclarer large · URSSAF · Finalisées] ; replis et groupes rayon 24 |
| **Réglages** | groupes rayon 20 | groupes rayon 24 sans bordure (la rangée de Réglages d'iOS de la DA3 reste) |
| **partout** | titres 34/700 | **titre d'écran 34/800 serré** (40 à l'ordinateur) ; sol gris système #F2F2F7 / #000 ; boutons `.vrm-b` en **pilules** (primaire bleu plein 44, secondaire gris rempli, tertiaire texte bleu) ; boutons d'icône en ronds ; contrôle segmenté iOS plein (segment choisi blanc ombré le jour, #636366 la nuit) ; appui `scale(.97)` 160 ms (rien sous « réduire les animations ») |

Accent bleu toujours rare (le geste principal, la recherche, l'icône active) ; ambre = un geste à faire ;
aucun rouge ajouté ; aucun violet.

### Comment la carte « sort » ses cases sans toucher au JSX
La carte sombre devient une grille d'une colonne au fond transparent. Son fond (le dégradé bleu nuit) est
peint par un `::before` **absolu placé par la grille** sur les rangées 1 à 30 (un élément absolu ne prend
aucune case de la grille), `::after` est l'air du bas (rangée 30), et les cases sont posées rangée 31 :
sous le fond, sans changer de parent. Ma journée et Compta posent la carte réglable « nue » dans leur
tête : elle passe en `display: contents` pour que ses cases rejoignent la grille de la tête. Résultat : les
bancs qui lisent `.vrm-fu-tete .vrm-fu-case` (journee-coherence) trouvent toujours les cases au même endroit
du DOM.

## Preuves

- **`scripts/bancs/direction-artistique-6.cjs`** (nouveau ; mode exemple, données inventées ; 390 tactile et
  1512, clair et sombre ; Ma journée, Ventes, Colis) juge des valeurs rendues : sol, titre 34/800, widgets
  SOUS le fond sombre (bas du `::before` mesuré), fond de carte ≠ sol, rayon ≥ 22, chiffre ≥ 28/800
  tabulaire, libellé au-dessus, bento, cibles ≥ 44, groupes rayon ≥ 22, « Voir » devenu chevron (mot gardé),
  chevron calé à droite, pilules, ronds, segmenté plein, ni violet ni rouge, une seule teinte d'accent.
  - cette branche : **184 verts, 0 rouge** ;
  - `origin/main` (29f4f240, son `dist`) : **116 rouges** (W2 à W9) ;
  - mutation : `grid-row: 31` retiré du CSS construit ⇒ W3 rouge (12 fois).
- `npm run build` vert ; audits `variables`, `tdz`, `coherence`, `icones`, `boutons`, `violet`,
  `rouge-doublon` verts.
- Bancs existants, un à la fois (résultats ci-dessous, section « Bancs »).

## Bancs existants

Après un vrai merge de `origin/main` (PR #1074 à #1078 : retraits frais, scanner, plancher, Ma journée
instantanée…), `npm run build`, un banc à la fois :

| banc | résultat |
|---|---|
| `direction-artistique-6` | 184 verts |
| `journee-premium` | 15 verts — d'abord ROUGE (« le premier geste entier au-dessus de la barre du bas », 844 px : 1re carte de « Ensuite » à 926 px avec le bento sur deux rangées). Corrigé par le DESSIN, pas par le banc : Ma journée au téléphone garde sa tête bord à bord et pose trois widgets sur une ligne (778 ≤ 784 px) |
| `journee-instantanee` | 0 rouge (`BANC_PORT=4593` : le port par défaut était pris par une autre session) |
| `beaute` | vert |
| `journee-v2` | 0 rouge |
| `ventes-colis-premium` | 32 verts |
| `direction-artistique-4` | 168 OK |
| `nav-v2` | 54 verts — **N8 mis à la règle changée** : « primaire = pilule pleine, secondaire = pilule grise » (consigne de Julien relayée par le coordinateur, 9 nov. soir) ; le rayon accepté est l'échelle fermée 6·12·14·20·24 **ou** une pilule (rayon ≥ moitié de la hauteur) |
| `onglets-a` | 29 verts |
| `journee-coherence` | rien à signaler — E4 (« la tête sombre se détache des cartes », la nuit) mesurait le bas du rectangle de la tête, qui contient maintenant les widgets : il mesure le bas du fond sombre PEINT (`::before`) ; la règle ne change pas (sans `::before`, la mesure d'avant). E6 (« Modifier ne chevauche rien ») a trouvé un vrai défaut (Modifier sur la courbe de Ventes au téléphone) : corrigé dans le CSS |
| `iphone-reprise` | 139 verts |

## Planches (mode exemple, données inventées)

`docs/passation/planches-da6/` — AVANT (`origin/main`) à gauche, APRÈS à droite :
`{390-sombre,390-clair,1512-clair,1512-sombre}-{journee,ventes,cat_bord,annonces,achats,messages,compta,settings}.png`.

## Ce qui reste

- Julien regarde les planches ; s'il valide, PR depuis la branche.
- Ma journée au téléphone : les trois widgets sont sur une ligne (pas de bento) pour tenir la règle du
  27 oct. (1re carte de « Ensuite » au-dessus de la barre du bas). Si Julien préfère le bento (une large +
  deux carrées) au téléphone, il faut lever cette règle : la carte « Ensuite » passerait ~110 px plus bas.
- L'anneau d'objectif (« Objectif en anneau ») n'est pas dessiné : la barre d'objectif existante
  (`.vrm-fu-objectif`) n'est rendue que si un objectif est posé ; un anneau demanderait du JSX (SVG).
- Les écrans Leboncoin / eBay / Vestiaire, Stock, Statistiques, E-mails héritent des pilules, du sol et des
  rayons, mais n'ont pas été capturés un par un (base inventée sans comptes reliés).
- Nettoyage des anciennes couches (fusion, finition, visuel…) toujours à faire.
