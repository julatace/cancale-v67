# 13 nov. — Design système : une seule source, une forme par fonction

Julien (13 nov. soir) : « l'appli est pas très belle, tout doit être revu » ; « je veux que tu
re-regardes toute la shape, les couleurs, le design, les formes, les boutons de l'app » ; « je
veux que tout soit beau, cohérent, simple ». Branche `claude/design-systeme` (depuis `origin/main`
1fd4c452), poussée à chaque commit. Pas de PR. Aucune donnée réelle : captures et bancs sur la
base INVENTÉE de `scripts/bancs/_base-volume.cjs` (3 comptes, vignettes SVG inventées).

⚠️ Session d'agent sans outil de question : la direction vient de ses mots, de CLAUDE.md §3/§7,
de `DESIGN.md`, des récits du 6, 11 et 12 nov. et de la revue du 11 nov. — pas d'une question
posée à Julien. Skills suivis : `impeccable` (mode *Operate* : précision et retenue),
`apple-design`, `design-system`, `design-critique`, `emil-design-eng`, `taste-skill` (écrans
d'app). Là où un skill contredit un choix de Julien (taste-skill refuse le dégradé : la carte
sombre est SA signature), le choix de Julien gagne.

## 1. La critique (mesurée sur l'app rendue, avant)

Relevé automatique sur chaque écran (19 écrans + 10 feuilles, 390 tactile et 1512, clair et
sombre — `recensement.json` des captures) puis REGARDÉ. Les dix défauts principaux :

1. **Six familles de jetons qui se contredisent.** `--d-*` (design-2026), `--w-*` (DA 6),
   `--p-*` (premium), `--fu-*` (Fusion), `--n2-*` (colonne), `--vrm-*` : 471 propriétés
   personnalisées, 10 226 `!important`, chacune avec SON rayon de carte (18, 20, 22, 24, 26) et
   SA graisse. Chaque « direction » a eu le dernier mot sur son morceau : c'est la cause de tout
   le reste.
2. **Les rayons.** Surfaces rendues : 6 rayons au téléphone (12, 14, 16, 18, 20, 24), 10 à
   l'ordinateur ; boutons : 10 à 12 rayons (0, 6, 7, 11, 12, 14, 16, 20, 22, 24, 50 %, 999) —
   la même app dessinait rectangle, coin doux et pilule côte à côte.
3. **Le 800.** Titres d'écran 34/800 (40/800 à l'ordinateur), chiffres 44/800, sections
   22/800 : 27 à 31 textes en 800 par écran ; cinq graisses rendues (400/500/600/700/800). Un
   outil calme criait.
4. **Sept hauteurs de bouton à l'ordinateur** (26, 30, 34, 36, 38, 40, 44) pour des boutons
   d'une ligne ; à la souris l'échelle du téléphone (44) dominait — un écran d'ordinateur était
   un téléphone agrandi.
5. **Trois ou quatre ombres de carte** à l'écran (la diffuse de la DA 1, celle de la DA 6, le
   contact du premium), et des cartes à bord ET ombre (Paramètres, sombre).
6. **L'ambre en encadré** sur chaque colis (« Choisir la vente » : 14 encadrés ambre visibles à
   la fois, 570 px de large à l'ordinateur) — contraire à §7 (un geste = un point, pas un fond).
7. **Une carte flottante par colis** (Ventes · À expédier) : 15 cartes à ombre empilées au
   téléphone, des cartes de 1 100 px séparées par du gris à l'ordinateur, au lieu d'UN groupe.
8. **Messages : trois signaux pour un non-lu** — barre bleue à gauche, fond gris, point bleu —
   plus un chevron : l'accent n'était plus rare.
9. **Argent : tuiles grises sur fond gris** (remplissage `.12` sur `#F2F2F7`), seules de l'app ;
   un « — » de 40 px dans une tuile (un « pas su » écrit en héros).
10. **À l'ordinateur, un titre de page d'accueil** (40/800) et **Paramètres centré** (le titre
    sautait de 200 px d'un écran à l'autre), segmentés à coins de 14/11 à côté de filtres en
    pilule.

Ce qui marche et n'a pas été refait : la palette d'iOS (fond groupé, cartes blanches, encre,
bleu d'Apple rare), la carte sombre de Julien, les rangées de Réglages (`Ios.jsx`), la grille
d'Annonces, les feuilles (`SheetShell`), la frise fine du 11 nov.

## 2. Le système

`docs/design/DESIGN.md` (la référence courte) — en une phrase : **ce qui contient → 20 ; ce
qui se touche → capsule ; ce qui montre → 12 ; le N° → 6** ; trois graisses (400/600/700) ;
huit tailles (11 · 12 · 13 · 15 · 17 · 20 · 28 · 34, + le chiffre de la carte sombre 40/44) ;
deux ombres (posée, flottante ; aucune ombre posée la nuit) ; une hauteur de contrôle par
pointeur (44 au doigt, 36 à la souris ; filtres 44/32) ; un seul gris de texte.

## 3. Ce qui change (forme seulement — aucun texte, chiffre, `data-*` ni geste)

- **`src/styles-systeme.css`** (neuf), importé par `src/App.jsx` juste AVANT
  `styles-tablette.css` (qui reste la dernière) :
  1. les **jetons hors couche** sous `:root:root` : `--d-*` fixés une fois ; `--w-*`, `--p-*`,
     `--fu-*`, `--t-*`, `--r-*`, `--o-*`, `--vrm-t*`, `--vrm-b-h`… les LISENT (plus aucune
     valeur à elles). Le rouge garde sa seule source (`--vrm-doublon`, `audit-rouge-doublon`).
  2. les **formes** dans `@layer vrm-premium` (la couche qui a le dernier mot) : titre d'écran
     34/700 (28/700 à l'ordinateur), sections 20/700 ; surfaces mesurées ramenées à 20 + ombre
     posée, carte dans une carte = case 12 ; tuiles 28/700, « — » au texte ; boutons
     `.vrm-b-*` en capsule, 44/36, 15/13, icône seule = rond ; segmentés, filtres de site et
     vues en capsule ; filtres 44/32 ; N° rayon 6 (sur photo : encre 86 %, sans ombre) ; champ
     de saisie 12, recherche capsule ; rangées 15/600 + note 13/400 ; feuilles : ombre
     flottante, titre 20/700 ; rayons écrits à la main hors échelle (10/14/16 → 12 ;
     18/22/24/26 → 20) ; graisses en ligne 800/900 → 700.
  3. **quatre corrections d'écran par la forme** : une pile de colis = UN groupe à filets ;
     l'ambre n'est jamais un encadré (fonds `${C.warn}14` effacés, le texte reste ambre ; le
     bandeau « à envoyer en priorité » garde sa rangée) ; Messages sans barre, fond ni chevron
     (le pseudo en 600 et le point bleu) ; Argent en tuiles blanches ; Paramètres sur la
     colonne de gauche à l'ordinateur.
- **151 feuilles ramenées à l'échelle** (script, à la source — les contradictions
  disparaissent au lieu d'être recouvertes) : 138 graisses 800/900 → 700 ; 459 rayons 9–15 px
  → 12 et 18–28 px → 20. 6, 8, 12, 16, 20, 999, 50 % et les petits rayons (1–5, 7) ne bougent
  pas. Aucune taille de police touchée à la source (risque de débordement).
- **`DESIGN.md`** (racine) renvoie à `docs/design/DESIGN.md` ; ses jetons de rayon et de
  graisse suivent le système.
- `src/App.jsx` : une ligne (l'import).

## 4. Après (mesuré de la même façon)

RESULTATS_MESURES

## 5. Les preuves

PREUVES

## 6. Ce qui reste (hors de la forme partagée)

- **Le 500** (≈ 40 textes par écran, surtout des notes en ligne dans App.jsx) et les tailles de
  police hors échelle à la source (14, 16, 22 px : 193 + 68 + 87 déclarations) : à résorber
  écran par écran, chacun avec son banc de débordement — un remplacement aveugle casserait des
  rangées serrées.
- Les gris écrits en dur dans les feuilles (`#8E8E93`, `#86868B`…) : les jetons sont unifiés,
  pas encore les valeurs littérales.
- Les gestes de la fiche « Tout sur le N° » (« Changer le prix / Publier ailleurs /
  Dupliquer ») passent sur deux lignes dans leur capsule au téléphone : une mise en page
  d'écran (zone Annonces), pas une forme partagée.
- Le liseré bleu d'une feuille ouverte par un clic SIMULÉ (le corps défilant reçoit le focus,
  `:focus-visible` s'allume sans pointeur) : invisible au doigt et à la souris réels ; à
  vérifier sur iPhone avant d'y toucher (l'anneau sert au clavier).
- Les points du lot B de la revue du 11 nov. (étages de contrôles au-dessus du premier colis,
  « 15 à imprimer » flottant) : ce sont des choix de mise en page de Colis, pas de forme.
