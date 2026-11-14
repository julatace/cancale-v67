# VRM — le système de design (référence courte)

13 nov. 2026. **Une page, une règle par fonction.** Les valeurs vivent dans
`src/styles-systeme.css` (jetons `--d-*`) ; toutes les autres familles de jetons
(`--w-*`, `--p-*`, `--fu-*`, `--n2-*`, `--vrm-*`, `--t-*`, `--r-*`, `--o-*`) les LISENT.
Changer une valeur = changer `--d-*`, nulle part ailleurs. Le pourquoi :
`docs/passation/2026-11-13-design-systeme.md`. Le détail des composants (carte de colis,
frise, rangée de liste…) : `DESIGN.md` à la racine.

Les règles de CLAUDE.md passent avant tout : **une couleur d'accent, rare** ; **ambre** =
un geste à faire ; **rouge** = deux paires sous un même N°, nulle part ailleurs ;
**violet interdit** ; cibles de **44 px au doigt** ; une forme par fonction ;
`-webkit-overflow-scrolling` jamais sur un conteneur qui peut porter une feuille.

---

## 1. La règle en une phrase

| ce que fait l'élément | sa forme |
|---|---|
| il **contient** (carte, groupe de rangées, carte sombre, tuile, feuille) | rayon **20** |
| il **se touche** (bouton, bouton d'icône, filtre, segmenté, recherche, pastille) | **capsule** (999) |
| il **montre** (photo, case dans une carte, champ de saisie, tuile d’icône 30 px → 6) | rayon **12** |
| le **N° de rangement** | rayon **6** |

Rien d'autre : pas de 10, 14, 16, 18, 22, 24, 26. Un rayon écrit à la main hors de
l'échelle est ramené par `styles-systeme.css` §2.8.

## 2. Espaces — grille de 4 px

`--d-e-1…` : **4 · 8 · 12 · 16 · 20 · 24 · 32 · 48**.

| où | valeur |
|---|---|
| bord de page | 16 au téléphone, 32 à l'ordinateur |
| intérieur d'une carte | 16 (téléphone), 20 (ordinateur) |
| entre deux cartes d'une pile | 12 |
| entre deux rangées d'un groupe | 0 — un filet .5 px qui commence après la photo |
| titre de section → son contenu | 8 |
| entre deux sections | 32 |
| au-dessus du contenu | l'en-tête, UNE rangée d'outils, au plus une bande de chiffres |

Serré dans un groupe, large entre deux groupes : c'est l'espace qui groupe, pas un cadre.

## 3. Typographie — la police du système, 8 tailles, 3 graisses

Police : `--vrm-police` (SF Pro sur Apple, aucune police téléchargée).

| rôle | taille / graisse | approche |
|---|---|---|
| grand titre d'écran | **34 / 700** au téléphone · **28 / 700** à l'ordinateur | −0,024 em |
| LE chiffre de la carte sombre | **40 / 700** · 44 à l'ordinateur, tabulaire | −0,03 em |
| chiffre d'une tuile | **28 / 700** (34 pour la tuile large), tabulaire | −0,02 em |
| titre de section | **20 / 700** | −0,016 em |
| titre de feuille | **20 / 700** | |
| corps iOS (rangée de Réglages) | **17 / 400** ; titre de rangée **17 / 600** | −0,012 em |
| texte, titre d'une rangée de liste | **15 / 400** ; **15 / 600** | −0,006 em |
| note (la ligne grise) | **13 / 400** gris | 0 |
| légende (sous un chiffre) | **12 / 400** ou **12 / 600** | 0 |
| pastille, compteur | **11 / 600** — jamais une phrase | 0 |

- **Trois graisses : 400 · 600 · 700.** Jamais 800 ni 900 : les feuilles ont été ramenées
  à 700 (13 nov.) et `styles-systeme.css` §2.1 ramène les styles en ligne. Le 500 qui
  reste (≈ 40 textes par écran, surtout des notes) est un reste à résorber : un neuf
  s'écrit 400 ou 600.
- **Chiffres** : `tabular-nums` partout où ils se comparent (colonnes, tuiles, montants).
- Un **chiffre pas su** (« — ») s'écrit à la taille du texte (20 / 400 dans une tuile),
  jamais en grand ; un zéro s'écrit « 0 », jamais à la taille d'un héros.
- La hiérarchie vient de la taille ET de la graisse, jamais d'une couleur.

## 4. Couleurs — clair / sombre

| jeton | clair | sombre | rôle |
|---|---|---|---|
| `--d-fond` | `#F2F2F7` | `#000000` | le sol de chaque écran |
| `--d-carte` | `#FFFFFF` | `#1C1C1E` | carte, groupe, feuille |
| `--d-case` | `#F2F2F7` | `#2C2C2E` | une zone DANS une carte |
| `--d-remplir` | `rgba(118,118,128,.12)` | `.24` | fond d'un bouton secondaire, d'un segmenté, d'un filtre |
| `--d-remplir-fort` | `.20` | `.32` | survol, appui |
| `--d-filet` | `rgba(60,60,67,.18)` | `rgba(84,84,88,.6)` | séparateur .5 px |
| `--d-filet-fort` | `rgba(60,60,67,.29)` | `rgba(84,84,88,.9)` | bord d'un champ |
| `--d-encre` | `#1D1D1F` | `#F5F5F7` | le texte |
| `--d-gris` | `#6E6E73` | `#98989D` | LE seul gris de texte (5,1:1 sur blanc, 4,6:1 sur le fond ; 6,0:1 sur `#1C1C1E`) |
| `--d-glyphe` | `#AEAEB2` | `#5A5A5E` | chevrons, poignées — un dessin, jamais un texte |
| `--d-accent` | `#0071E3` | `#0071E3` | l'aplat du bouton principal (texte blanc 4,7:1) |
| `--d-accent-texte` | `#0066CC` | `#409CFF` | tout TEXTE bleu (lien, bouton discret) |
| `--d-ambre` / `--d-point-ambre` / `--d-ambre-fond` | `#B25000` / `#FF9F0A` / `#FFF4E5` | `#FFB340` / `#FF9F0A` / `#2E2412` | un geste à faire : un point de 7 px devant la phrase, ou le mot |
| `--vrm-doublon` (themeMineral.js, seule source) | `#D70015` | `#FF6961` | deux paires présentes sous un même N° — **nulle part ailleurs** |

- **Un gris de texte, pas trois.** Toutes les familles de jetons (`--w-gris`, `--p-gris`,
  `--p-gris-2`, `--fu-gris`, `--fu-gris2`…) lisent `--d-gris` ; un gris écrit en dur dans
  une feuille (`#8E8E93`, `#86868B`…) est une dette : jamais pour un texte neuf.
- **Le bleu est rare** : un aplat bleu par écran (l'action groupée de l'en-tête), jamais
  par ligne ; un texte bleu = un lien.
- **La carte sombre** (dégradé radial bleu nuit, `--vrm-carte-sombre`) est la seule
  surface colorée : la signature choisie par Julien (2 nov.). Rayon 20 comme toute carte.

## 5. Ombres — deux niveaux

| niveau | clair | sombre | pour |
|---|---|---|---|
| **posée** `--d-ombre-carte` | `0 0 0 .5px rgba(0,0,0,.035), 0 1px 3px rgba(0,0,0,.05)` | **aucune** (`#1C1C1E` sur `#000` suffit) | carte, groupe, tuile |
| **flottante** `--d-ombre-flottant` | `0 0 0 .5px rgba(0,0,0,.04), 0 8px 24px -6px rgba(0,0,0,.14), 0 24px 56px -12px rgba(0,0,0,.16)` | liseré `.09` blanc + `0 24px 56px rgba(0,0,0,.6)` | menu, feuille, fenêtre, élément tenu |

Une carte n'a **jamais** de bordure ET d'ombre ; une carte dans une carte devient une
case (pas d'ombre, rayon 12). `prefers-contrast: more` rend un cadre net.

## 6. Boutons — trois variantes, une forme, une hauteur

| variante | fond | texte | quand |
|---|---|---|---|
| **principal** `.vrm-b-primaire` | `--d-accent` | blanc | l'action groupée de l'écran — **une** |
| **secondaire** `.vrm-b-secondaire` | `--d-remplir` | encre | toute autre action, une action répétée sur chaque ligne |
| **discret** `.vrm-b-discret` | rien | `--d-accent-texte` | « Annuler », « Plus tard », un lien d'action |

- `.vrm-b-danger` (Supprimer, Délier) n'est pas une 4e forme : la forme du secondaire,
  le texte **ambre** (jamais rouge).
- **Forme** : capsule. Un bouton d'icône seule est un **rond** de la même hauteur,
  remplissage gris.
- **Hauteur** : **44 au doigt** (téléphone, iPad), **36 à la souris** (ordinateur) —
  `--d-h-ctrl`. Texte 15/600 au doigt, 13/600 à la souris ; la taille `petit` (rangée
  serrée) garde la hauteur et passe le texte à 13. Icône 17 px (15 en `petit`).
- **États** : survol (souris seulement, `hover: hover`) = remplissage plus fort ;
  appui = `scale(.97)` en 100 ms ; désactivé = 40 % ; focus clavier = anneau bleu 2 px
  décollé de 2 px ; occupé = l'indicateur à la place de l'icône (`aria-busy`).
- Composant : `<Bouton variante="primaire|secondaire|discret|danger" taille? icone?>`
  (`src/composants/Bouton.jsx`). Jamais un `<button style={{…}}>` neuf.

## 7. Contrôles

- **Segmenté** (`Segmente`, `.vrm-seg`) : une piste capsule `--d-remplir`, 2 px
  d'intérieur ; le segment choisi = capsule blanche (nuit `#636366`) à ombre fine ; un
  seul niveau par écran ; le compte après « · ».
- **Filtres** (`.vrm-filtres`, puces de compte) : capsules, **44 au doigt, 36 à la souris** (14 nov. : une seule hauteur de contrôle par pointeur)
  (`--d-h-filtre`) ; l'actif à l'encre pleine, texte fond.
- **Recherche** (`ChampRecherche`) : la capsule remplie d'iOS, sans cadre ; l'anneau
  bleu au focus seulement.
- **Champ de saisie** : rayon 12 (`--d-r-case`) ; un champ neuf prend le bord
  `--d-filet-fort` ; l'erreur se dit sous le champ, en ambre, après un essai.
- **Interrupteur** (`Interrupteur`, `src/composants/Ios.jsx`) : celui d'iOS. Jamais une
  case à cocher, un `<select>` ou un `<details>` natif nus (règle 3 de la revue du 11 nov.).

## 8. Cartes et rangées

- **Carte** : `--d-carte`, rayon 20, ombre posée, pas de bordure ; intérieur 16/20.
- **Groupe à rangées** (Réglages, Rappels, Mail) : UNE carte, des rangées séparées par
  un filet .5 px qui commence après la photo ou l'icône. Jamais une carte par ligne.
- **Rangée** : 44 de haut au moins (au doigt) ; photo 56 rayon 12 (44 ronde pour une
  personne) ; titre 15/600 sur deux lignes au plus ; une note 13 grise ; le montant à
  droite 15/600 tabulaire ; un chevron `--d-glyphe` si la rangée s'ouvre.
- **Rangée de Réglages** (`RangeeIos`) : tuile d'icône neutre 30 px rayon 6
  (`--d-remplir-fort`, jamais colorée) · libellé 17 · valeur grise · chevron ou interrupteur.
- **Tuile** (chiffres sous la carte sombre) : une carte, libellé 13/600 gris au-dessus,
  chiffre 28/700, une note 13 grise en bas.

## 9. Pastilles

- **État d'une rangée** : un mot gris 13 sur sa ligne — pas une pastille répétée sur
  chaque ligne. Un geste à faire : le mot à l'encre 600 et un point ambre de 7 px.
- **Pastille** (`.vrm-badge`) : capsule 22 px, 12/600, fond `--d-remplir`, encre ; ambre
  sur fond ambre pâle pour un geste à faire.
- **Compteur** (barre d'onglets, rail) : capsule 18 px, 11/700.
- **N° de rangement** (`Numero`) : encre pleine, texte fond, 12–13/700, rayon 6 ; posé sur
  une photo, l'encre à 86 %, sans ombre.

## 10. Icônes

- Un seul dessin : `Icon` / `ICON_PATHS` (24 × 24, **trait 1,7**, bouts ronds), couleur
  `currentColor`. Un nom absent de `ICON_PATHS` ne dessine rien (`audit-icones`).
- Tailles : **17** dans un bouton · **20** dans la colonne et l'en-tête · **22** dans la
  barre d'onglets · **16** devant une note.
- Jamais dans un rond coloré ; une tuile, si besoin, est neutre (Réglages).

## 11. États vides, zéro, chargement

- **Vide** : le cadre et le titre restent ; UNE phrase qui dit pourquoi et UN geste.
  Un dessin au trait (`Illustration`) seulement sur un écran entier vide.
- **Zéro** : « 0 » à la taille du texte ; **pas su** : « — » avec sa raison (§5 de
  CLAUDE.md : `null` ≠ `0`).
- **Chargement** : le squelette à la place exacte (`AttenteEcran`), jamais « pas lu »
  pendant la lecture, jamais un saut de mise en page à l'arrivée.

## 12. Mouvement

| quoi | durée | courbe |
|---|---|---|
| appui (bouton, rangée) | 100 ms, `scale(.97)` | `--d-sortie` `cubic-bezier(.23,1,.32,1)` |
| survol, couleur | 150 ms | `ease` |
| menu, bulle | 200 ms, de `scale(.97)` + opacité | `--d-sortie` |
| feuille, tiroir | 250 ms | `--d-tiroir` `cubic-bezier(.32,.72,0,1)` |

- Rien ne dépasse 250 ms dans l'interface ; aucune entrée ne bloque un geste.
- Jamais d'animation sur un geste au clavier.
- `prefers-reduced-motion: reduce` : plus aucun déplacement ni échelle, des fondus
  seulement. `prefers-reduced-transparency` : les barres floutées deviennent des aplats.

---

## Comment s'en servir

1. Une valeur ? Un jeton `--d-*` (`var(--d-r-carte)`, `var(--d-gris)`…), jamais un nombre
   à la main.
2. Un bouton ? `<Bouton>`. Un choix ? `Segmente`. Une liste ? un groupe à rangées.
3. Une nouvelle feuille de style se range **avant** `styles-systeme.css` dans
   `src/App.jsx` ; `styles-tablette.css` reste la dernière.
4. Regarder la capture à 390 (tactile) ET 1512, clair ET sombre.
