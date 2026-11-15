# 15 nov. 2026 — « Verre dépoli » sur toute l'app

## La décision
Julien, parmi 30 propositions de disposition : **« J'aime la 9 »** — *Verre dépoli* : « des panneaux de
verre dépoli superposés sur un bleu profond dégradé : le chiffre du jour flotte en blanc, tout le reste
se lit sur le verre, aérien mais serré ». Avant, l'app lui semblait « trop chargée, trop grosse, formes
pas belles », mais il **aimait les couleurs** : l'encre, l'accent `#0060CC` rare, l'ambre pour un geste,
Inter — tout cela est gardé.

## Comment : une couche, pas une réécriture
`src/design/studio-verre.css`, importée la dernière par `src/App.jsx`, toutes ses règles dans la couche
`@layer vrm-verre`, nommée **la première** dans `index.html` (`@layer vrm-verre, vrm-finition, sj-studio,
vrm-studio, vrm-premium;`) : pour une déclaration `!important`, la couche nommée la première gagne. Aucun
composant n'est réécrit ; d'autres chantiers (Stock, Paramètres, Argent, retours, extension) peuvent
continuer sans conflit. Le seul JSX touché : aucun (la tête de Ma journée suit la maquette par CSS seul :
le mois passe en premier verre au téléphone par `order`, l'ordre du DOM ne change pas).

1. **Le fond** : un `::before` fixe (`inset:0; z-index:-1`) sur la coque `.vrm-app-shell[data-espace]`
   (pas `background-attachment: fixed`, cassé sur iOS). Le corps de la page prend le bas du dégradé
   (aucun blanc au rebond).
2. **La matière** : les jetons `--sb-porcelaine*` deviennent le verre (translucide) ; toutes les familles
   qui les lisent (`--d-*`, `--fu-*`, `--p-*`, `--w-*`) suivent d'un coup. Les barres (`--sb-verre`) sont un
   verre plus clair ; le champ (`--sb-puits`) un verre presque opaque.
3. **La porcelaine opaque** revient là où l'on lit de près et où l'on tape : feuilles (`.vrm-fs`),
   confirmations et dialogues, menus, champs.
4. **L'encre claire** sur ce qui est posé directement sur le fond (titres d'écran, chiffre du jour, bande
   de chiffres, en-têtes de groupe, lignes de fraîcheur…). Les jetons d'encre ET leurs alias de toutes les
   familles sont redéclarés sur ces conteneurs (un alias calculé sur `:root` ne suivrait pas) ; une surface
   à l'intérieur (touche, rond, carte, champ) remet l'encre sombre. Les couleurs EN LIGNE du thème JS
   (`style={{color: C.muted}}`) posées sur le fond passent aussi à l'encre claire.
5. **« Le fond à plat »** (`--d-fond`, `--vrm-bg`… : une case, un cache sous une barre) devient la *brume*
   (le verre posé sur le bleu, opaque) : l'encre sombre y reste lisible.
6. **Les barres collées** (recherche d'Annonces, du Stock) : **100 % opaques**, à la couleur du haut du fond
   (`--sv-colle`), le champ dedans en verre presque opaque.

## Les valeurs (à reprendre à l'identique par l'écran d'ouverture, `claude/ouverture`)
Le dégradé (le `::before` de la coque) :
```
radial-gradient(120% 60% at 15% 0%,  var(--sv-reflet)   0%, transparent 55%),
radial-gradient(70% 45% at 100% 38%, var(--sv-reflet-2) 0%, transparent 70%),
radial-gradient(80% 50% at 0% 78%,   var(--sv-reflet-2) 0%, transparent 70%),
linear-gradient(170deg, var(--sv-haut) 0%, var(--sv-milieu) 45%, var(--sv-bas) 100%)
```
| jeton | clair | sombre (choisi, `vinted_dark`) |
|---|---|---|
| `--sv-haut` | `#2563A8` | `#133460` |
| `--sv-milieu` | `#174C88` | `#0C2240` |
| `--sv-bas` | `#0E2C52` | `#050E1D` |
| `--sv-reflet` | `rgb(120 175 235 / .10)` | `rgb(90 140 210 / .08)` |
| `--sv-reflet-2` | `rgb(80 150 230 / .08)` | `rgb(60 110 190 / .06)` |
| `--sv-verre` (panneau) | `rgb(247 250 253 / .80)` | `rgb(16 30 50 / .62)` |
| `--sv-verre-barre` | `rgb(247 250 253 / .80)` | `rgb(16 30 50 / .72)` |
| `--sv-colle` (barre collée) | `#21599B` | `#142F55` |
| `--sv-brume` (fond à plat) | `#D3DFEC` | `#0F2038` |
| encre sur verre / gris / lien / ambre | `#0C1D30` / `#3F5468` / `#004A9F` / `#764300` | `#EAF2FB` / `#9CB0C6` / `#6CB4FF` / `#F2B65E` |
| encre sur fond / gris / lien / ambre | `#FFFFFF` / `#EDF4FC` / `#FFFFFF` / `#FFE0A8` | `#F2F7FD` / `#B9CADD` / `#8CC4FF` / `#F2B65E` |

## Le contraste (non négociable)
Mesuré par le banc sur les couleurs CALCULÉES, chaque texte recomposé couche par couche jusqu'au fond, et
sur le fond **le PIRE des deux bouts** : le bas (le plus sombre) pour l'encre sombre sur le verre, le haut
éclairé du reflet (le plus clair) pour l'encre claire sur le fond. Choix qui en découlent :
- le verre de la maquette (`.74`) passe à **`.80`** : le gris `#3F5468` y tenait **4,46:1** au-dessus du bas
  du dégradé ; à `.80`, **5,07:1** ;
- le lien `#0055B8` tombait à **3,99:1** sur ce verre : **`#004A9F`** (**5,48:1**) ;
- l'ambre `#764300` : **5,28:1** sur le verre au-dessus du bas ;
- les reflets de la maquette (`#9CC8F2` plein) rendaient le titre blanc illisible (**1,8:1**) : reflets
  ramenés à 10 % et 8 % ; le blanc sur le haut éclairé : **≈ 5,2:1**, le gris clair `#EDF4FC` **≈ 4,6:1** ;
- la nuit : le haut éclairci de la maquette tenait le gris `#9CB0C6` à 4,28:1 : haut ramené à `#133460`.

## La vitesse (iPhone, 1 000 articles)
Le flou (`backdrop-filter`) n'est que sur la barre du bas, la tête au défilement, la navigation de
l'ordinateur et la barre de recherche de l'ordinateur : **1 à 4 éléments floutés par écran** (mesuré).
Les tuiles et les cartes sont du verre SANS flou : sur un fond en dégradé lisse, le verre sans flou est le
même à l'œil ; le flou ne sert que là où le contenu passe dessous. Jamais une rangée. Sans
`backdrop-filter` (`@supports not`) ou avec `prefers-reduced-transparency: reduce` : verre opaque.

## La preuve
`scripts/bancs/verre.cjs` (base inventée : 1 000 paires, 1 000 conversations, 1 000 e-mails ; 390 tactile
et 1512 ; clair et sombre) : V1 fond, V2 verre et opaques, V3 contraste sur le fond réel, V4 flou borné,
V5 un plein, V6 aucun débordement, V7 le « ? » d'un titre à 8 px au moins de tout texte de sa ligne, V8 aucun
texte coupé au milieu d'un mot hors d'une rangée de liste, V9 la pastille « Mis à jour à … » ne recouvre aucun
texte. Une icône seule dans un bouton est jugée comme un élément graphique (3:1). Rouge sur l'arbre de départ
(aucun fond, aucun verre).

Deux bancs figeaient la matière d'hier et ont été réécrits sur la RÈGLE (dit ici, comme le veut §6) :
- `studio-journee.cjs` (A) jugeait l'encre sur `--sb-porcelaine` lue comme un hexadécimal opaque, et l'encre
  sombre sur le haut/l'aplat/le bas du fond : la porcelaine est maintenant recomposée sur le haut ET le bas du
  fond quand c'est un verre ; l'encre sombre n'est jugée sur le fond que si le fond est clair, sinon c'est
  l'encre CLAIRE (`--sv-clair*`) qui y est jugée ;
- `studio-coque.cjs` (F) exigeait le dégradé sur la coque elle-même : il l'accepte sur son `::before` fixe.

Retouches demandées après le premier rapport (Julien, via le coordinateur) : le « ? » collait au titre
« Ma journée » (marge portée à 2 px + 11 px de padding ⇒ 13 px) ; « prix d'achat man… » coupé dans le mois
(passe à la ligne) ; « Mis à jour à 18:11 » posé sur les tuiles au-dessus de la barre du bas (au téléphone il
va dans la tête, à gauche ; le titre de la tête s'efface le temps qu'il est là). La barre collée du Stock suit
la classe réelle du nouveau Stock (`[data-stock-recherche]`, claude/stock-etageres).

## Les codes de la maquette (deuxième passe, Julien : « ça doit être beau, pas designé simplement »)
Repris de la maquette 9 et de la maquette du Stock en verre (`scratchpad/stock-verre/style.cjs`), §10 de la feuille :
- **plaque N°** en relief partout (`.sb-plaque`, `.vrm-num`, `.vrm-fp-num`, `.vrm-emb-num`) : dégradé blanc → #EDF2F7,
  filet `rgb(12 29 48 / .18)`, ombre portée, encre 750 ; le doublon garde le seul rouge (#B42020) ; « à vérifier » l'ambre ;
- **feuilles** (`.vrm-fs`) : verre `rgb(247 250 253 / .95)` (nuit `rgb(16 30 50 / .92)`), flou 30 px, bord blanc en haut,
  ombre qui monte, rayon 30 ; voile `rgb(4 12 26 / .46)` ; la croix est un rond de verre ;
- **moments d'accompagnement** (`.vrm-acc` pendant · après · échec) et **messages** (`.vrm-toast`) : un bandeau de verre
  (bord blanc, rayon 22, ombre de la maquette), l'icône dans une pastille teintée `rgb(0 96 204 / .12)`, encre sombre ;
- **pastilles fumées** `rgb(10 38 76 / .24)` + bord blanc .32 + icône blanche : les ronds de la tête du téléphone au repos ;
- **barre du bas** à .80 (nuit .72), onglets #34495E au repos (nuit #AFC0D3), l'actif à l'encre en 700 ;
- **une seule couche de verre** sur les cartes : la couleur ET le dégradé translucides se superposaient (verre réel ≈ .96,
  presque de la porcelaine) — mesuré par le banc (mutation « verre .55 » : verte tant que les deux couches s'additionnaient).

## Pièges trouvés en route (à ne pas refaire)
- `isolation: isolate` sur la coque : la barre du bas (z-index 9402 quand l'éventail est ouvert) passait sous le voile de
  l'éventail (9400, porté dans <body>) — le clic qui suit le toucher du disque refermait l'éventail (studio-coque E rouge).
- un fond opaque sur `<body>` se peint PAR-DESSUS un `::before` à z-index -1 d'un descendant (la coque n'est pas un contexte
  d'empilement) : tout l'écran devenait bleu foncé uni. `<body>` transparent, le document porte le bas du dégradé.
- `.vrm-colis-recap-nu` est replié à 0 px (`overflow: hidden`) : un texte rogné par un ancêtre n'est pas jugé (banc).

## Écrans
Ma journée (chiffre blanc, le mois en premier verre au téléphone), Annonces (barre collée opaque, icônes claires),
Ventes (tête « À expédier » posée sur le fond à toute largeur, « bordereaux déjà traités » sur un verre), Stock (recherche
collée `[data-stock-recherche]`), Achats (pastille « Tous », ambre des pastilles), Argent, Paramètres, Messages, E-mails
(nombres des rubriques pleins), Communauté, Leboncoin/eBay/Vestiaire, loupe, fiche, éventail du disque : passés au banc
(390 clair/sombre ; 1512 clair pour les six écrans principaux). Les DISPOSITIONS ne changent pas dans ce lot : la refonte de
Ma journée et d'Annonces « comme la proposition 9 » (carte « À envoyer » avec photo et Imprimer en barre, tuiles À retirer /
Messages, liste d'Annonces en un verre) est le lot suivant.
