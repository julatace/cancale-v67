# 28 nov. — Vitesse et fluidité (branche `claude/vitesse-fluide`)

Julien (28 nov.) : « occupe-toi de la fluidité, la rapidité de l'app ». Lot MOTEUR seulement : aucune règle de calcul
changée, aucun chiffre changé, apparence identique. Pas touché (autres chantiers en même temps) : `src/natif/*`, CSS des
boutons, `src/ecrans/Leboncoin.jsx`, `Vestiaire.jsx`, `Ebay.jsx`, et rien de `vinted-sync-extension/` (consigne de Julien).

## 0. Ce qu'il faut savoir avant de reprendre

- Beaucoup était déjà fait entre le 20 et le 27 nov. : `Comptabilite` découpé AU BUILD en sections à la demande
  (`scripts/_sections-differees.cjs`), écrans montrés seuls calculés, lectures partagées, Annonces virtualisée, ventes et
  achats en paquets (« Voir N de plus »), vignettes `loading=lazy` à taille fixe, copies d'écran instantanées, onglets en
  transition. Ce lot ne refait rien de cela : il prend ce que les PROFILS montrent encore.
- **La machine des bancs était à une charge de 12 à 32 (4 cœurs) pendant tout le chantier** : les temps muraux (INP,
  « écran utile ») varient du simple au double d'une passe à l'autre. Les décisions se prennent sur les **mesures
  contrôlées** (§2 : temps CPU de la fonction visée dans le profil, avant/après sur le MÊME parcours ; tests d'interface à
  charge connue ; micro-mesures), le tableau du banc (§3) en ordre de grandeur.

## 1. Ce qui change (et pourquoi, mesuré)

| quoi | où | la cause mesurée | le remède |
|---|---|---|---|
| **La molette / le pavé tactile** | `src/App.jsx`, `DefilementPartout` | à CHAQUE cran de molette, `peutDefiler` lisait le style ET la hauteur de chaque ancêtre de la cible (une mise en page forcée par événement pendant le défilement) — pour finir, sous `<main>`, par ne RIEN faire | sous `<main>` la boucle rendait toujours la main au navigateur : on le sait d'un `main.contains(cible)`, sans rien lire. Même décision. |
| **Une lettre dans la recherche** | `src/composants/saisieDifferee.jsx` (nouveau), `ChampRecherche`, Achats (`InputDiffere`) | chaque lettre re-rendait l'écran entier (`Comptabilite` pour Achats) AVANT d'être peinte | le champ garde la lettre tapée (mise à jour urgente d'un petit composant) et l'écran la reçoit dans une **transition** (`useTransition`) : peinte tout de suite, l'écran se calcule en tâche interruptible. Hors transition, la valeur de l'écran fait foi (champ contrôlé : « Effacer », dictée, valeur bornée). |
| **Annonces : nombres et liste** | `src/ecrans/AnnoncesEgalite.jsx` | `compterArticles` (30 passes de `filtrerArticles` sur tous les articles) et la liste filtrée + triée refaits à CHAQUE rendu (chaque lettre, chaque case, chaque lecture) | gardés (`useMemo`) tant que les articles, le seuil, le filtre et la recherche sont les mêmes ; la liste suit la recherche en arrière-plan (`useDeferredValue`). L'heure de la règle « Dorment » est reprise à la minute (une paire qui passe le seuil y entre à la minute suivante, comme à un rendu suivant). |
| **Les nombres et les dates traduits** | `src/i18n/index.js` (`nombre`, `monnaie`, `date`, `heure`, `dateRelative`) | un formateur `Intl` neuf à CHAQUE appel (~70 µs ×1) | gardé par (constructeur, langue, options), comme `src/formatsRapides.js` pour `toLocaleString` ; une construction qui échoue n'est pas gardée (le repli reste). |

Le banc `iphone-rapide` gagne (§4) : `LARGEUR=1512` (l'ordinateur), `ETAPES=…,gestes` (INP d'une frappe dans la recherche
d'Annonces, Ventes, Achats et d'une case cochée), l'INP de chaque changement d'onglet, `PROFIL_DEFIL=` (profil du
défilement) ; sa sonde de texte (`innerText` de tout `<main>` toutes les 100 ms tant que « Vendu · mois » n'est pas lu)
est bornée à 30 s — elle tournait jusqu'à la fin du banc et pesait sur TOUTES les mesures (avant ET après).
`vite.config.js` : `VRM_SANS_NOMS=1` (avec `--minify false`) livre un build lisible pour les profils.

## 2. Mesures contrôlées (une seule chose change)

**Profils CPU, même parcours, build lisible avant / après** (banc `iphone-rapide`, 390 ×4, base de volume ; temps
inclusif de la fonction dans le profil, ms) :

| parcours | fonction | avant | après |
|---|---|---|---|
| défilement Annonces (6 balayages) | `onWheel` (dont `peutDefiler`) | **2 010** (1 906) | **40** (0) |
| défilement Ventes | `onWheel` | **3 836** (3 789) | **21** (0) |
| défilement Achats | `onWheel` | **6 258** (6 012) | **27** (0) |
| taper « nike » · Annonces | `compterArticles` · `filtrerArticles` · `nombre` · `AnnoncesEgalite` | 189 · 209 · 121 · 265 | 22 · 37 · 4 · 82 |
| effacer · Annonces | idem | 218 · 228 · 105 · 262 | 0 · 47 · 2 · 188 |

(Les profils « taper » de Ventes et d'Achats de cette passe tapaient en fait dans le champ d'Annonces, gardé caché :
corrigé dans le banc ensuite — §4. Les chiffres d'Annonces ci-dessus, eux, sont bien ceux de son champ.)

**Test d'interface** (`node scripts/tests/saisie-differee-interface.cjs`, écran qui occupe le fil 150 ms à chaque rendu) :
de la frappe à l'image où la lettre est peinte, **~300 ms par lettre → 1 à 10 ms** pour `ChampRecherche` et `InputDiffere` ;
au bout, le champ et l'écran disent exactement ce qui a été tapé ; l'écran qui vide le champ l'emporte ; sans `onValeur`,
champ contrôlé. `MUTATION=1` (lettre envoyée en mise à jour urgente, l'ancien chemin) : **rouge** (8/8 et 6/8 lettres > 120 ms).

**Micro-mesure** (node, ×1) : 15 000 `nombre()` 860–1 580 ms → 23–183 ms. Exactitude :
`node scripts/tests/formats-i18n-gardes.test.mjs` — 2 220 comparaisons (5 langues × options × valeurs limites, 2 tours)
identiques à un formateur neuf ; `MUTATION=1` (formateur gardé sans ses options) rouge.

## 3. Le banc `iphone-rapide` avant / après (une passe chacun, charge 12 à 32 : ordre de grandeur)

`avant` = `origin/main` 9f083ef71 ; `après` = cette branche avant la fusion de main (même base). 390 × 844 @3 tactile,
CPU ×4, 4G, service worker, base de volume. INP = Event Timing (du geste à l'image suivante, durée la plus longue).

**390 (iPhone)**, passe du 28 nov. 14 h 48 – 15 h 18 (charge 12 → 32) :

| mesure | avant | après |
|---|---|---|
| froid · coque · écran utile | 8 011 · 10 744 ms | 7 607 · 10 938 ms |
| chaud 2 · coque · écran utile | 6 036 · 19 235 ms | 5 326 · 20 253 ms |
| 1re visite · Annonces (INP · CPU) | 2 904 · 3 233 ms | 3 696 · 3 515 ms |
| 1re visite · Ventes | 4 376 · 3 803 | 4 560 · 3 902 |
| 1re visite · Achats | 4 232 · 4 419 | 3 160 · 4 230 |
| 1re visite · Argent | 736 · 5 342 | 2 472 · 6 425 |
| 1re visite · Aujourd'hui | 3 328 · 4 171 | 3 160 · 2 373 |
| une fiche · ouvrir (INP · CPU) | 1 112 · 9 383 | 1 848 · 3 529 |
| **taper « nike » · Annonces (INP médian · pire)** | **336 · 1 240 ms** | **136 · 512 ms** |
| effacer · Annonces | 240 · 1 048 | 152 · 968 |
| défilement Annonces · Ventes · Achats (images/s · plus longue tâche) | 18 · 710 / 15 · 1 414 / 18 · 1 597 | 18 · 1 022 / 18 · 966 / 20 · 2 360 |

2e passe des gestes (banc corrigé : le champ de l'écran MONTRÉ), 16 h 40 – 17 h, charge ~20 — médiane · pire (ms) :

| geste | avant | après |
|---|---|---|
| taper « nike » · Annonces · Ventes · Achats | 368 · 1 272 / 232 · 632 / 208 · 616 | 440 · 560 / 328 · 728 / 360 · 488 |
| effacer · Annonces · Ventes · Achats | 128 · 672 / 200 · 664 / 144 · 736 | 72 · 632 / 104 · 688 / 96 · 880 |

Lecture : dans le bruit. Pour Achats, la transition n'aide que si le calcul est réparti sur plusieurs composants : le
corps de `Comptabilite` est UN composant (non interruptible) — c'est lui qui reste le coût (§5).

Lecture : à cette charge, seuls les écarts nets comptent — la frappe dans Annonces (médiane −60 %). Le reste est dans le
bruit (le MÊME code donne ±50 % d'une passe à l'autre). Le défilement du banc est synthétisé à la molette (`GESTE=mouse`) :
le gain de `onWheel` (§2, 2 à 6 s de CPU en moins) ne se voit pas dans les images/s quand la machine est à 25–30.
(Cette passe tapait la recherche de Ventes et d'Achats dans le champ d'Annonces gardé caché : leurs lignes sont retirées ;
corrigé dans le banc, §1.)

**1512 (ordinateur, souris)**, passe du 28 nov. 16 h 07 – 16 h 33 (charge 25 → 31) :

| mesure | avant | après |
|---|---|---|
| froid · coque · écran utile | — · 16 185 ms | 7 933 · 14 243 ms |
| chaud 2 · coque · écran utile | 3 064 · 23 433 | 2 339 · 22 501 |
| 1re visite · Annonces (INP · CPU) | 3 376 · 5 377 | 2 176 · 2 030 |
| 1re visite · Ventes | 8 064 · 13 336 | 6 640 · 8 463 |
| 1re visite · Achats | 6 792 · 4 893 | 5 072 · 6 704 |
| 1re visite · Argent | 1 848 · 3 858 | 3 272 · 4 574 |
| 1re visite · Aujourd'hui | 2 576 · 3 774 | 4 504 · 5 555 |
| taper « nike » · Annonces (le tableau de travail, `src/natif/TableauTravail.jsx`, code INCHANGÉ) | 344 · 744 | 1 568 · 2 056 |
| cocher une case · Annonces · Ventes (INP) | 1 416 · 1 080 | 2 088 · 776 |
| défilement Annonces · Ventes · Achats (images/s) | 10 · 10 · 9 | 5 · 3 · 4 |

Lecture : à 25–31 de charge, l'ordinateur ne se mesure pas à l'horloge. Preuve du bruit : la frappe dans le tableau
d'Annonces suit un chemin que ce lot ne touche PAS (l'état local du tableau natif) et passe de 344 à 1 568 ms de médiane
d'une passe à l'autre. À refaire sur une machine calme (`LARGEUR=1512 ETAPES=demarrage,onglets,gestes,defilement`,
passes alternées).

## 4. Preuves que rien ne change à l'écran ni dans les chiffres

Bancs (un build de la branche après fusion de main, `dist-final`, sauf `styles-identiques` qui compare avant / après sur
la MÊME base 9f083ef71) :

| contrôle | résultat | sur `main` (le même banc, le build d'avant) |
|---|---|---|
| `styles-identiques` 390 clair + sombre, 8 écrans | 14 verts ; Annonces et Achats clair rouges au 1er passage : « 0 propriété différente » sur les 400 éléments détaillés (empreintes toutes changées = instabilité) → **relancés seuls : verts** (Annonces 1 315 éléments, Achats 1 729) ; A/A avant/avant des deux : vert | — |
| `styles-identiques` 1512 | 12 verts ; 4 rouges qui ne sont PAS des règles : hauteur de contenu (2 224 / 2 160 px : une donnée arrivée plus tard), couleur en pleine transition (`color(srgb …)`), variables `--mb-*` d'une feuille chargée à la demande pas encore posée, marge d'un élément en cours de mise en page. Ce lot n'ajoute ni ne change AUCUNE règle CSS (diff : 0 fichier .css). | — |
| `natif-ventes` | **58 verts, 0 rouge** | |
| `drapeaux-justes` | **66 vérifications, 0 drapeau faux** | |
| `natif-coque` | 127 verts, 15 rouges (K4, K6 : « Plus » au téléphone ; K7 : « santé » dans la barre latérale ; K8b au téléphone, connu depuis le 20 nov.) | **les MÊMES 15 rouges** sur `main` 9f083ef71 : pas ce lot |
| `ouverture-instantanee` (« instantané ») | 15 verts, 5 rouges (coquille rangée à la 1re ouverture, 2e ouverture < 1 s, date de l'instantané, hors ligne) | **les MÊMES 5 rouges** sur `main` |
| `iphone-rapide` | rapporte (§3) | |

Audits verts (après la fusion de main) : `audit-tdz`, `audit-variables`, `audit-traduction` (45), `audit-coherence`,
`audit-quoi-de-neuf`, `audit-identite`, `audit-urssaf`, `audit-sections-differees` (35), `audit-composants`,
`audit-parler-loupe`, `audit-poids-demarrage` (1 487 Ko ≤ 2 008). Tests : `saisie-differee-interface` (9, mutation rouge),
`formats-i18n-gardes` (2 220, mutation rouge), `recherche-interactions` (24), `espace-emails-interface` (57 — il lit la
liste filtrée JUSTE après la frappe : c'est pourquoi un écran LÉGER reçoit toujours la lettre de façon synchrone).
Build : `NODE_OPTIONS=--max-old-space-size=8192 npm run build` vert.

Aucune règle de calcul n'est touchée : la molette rend la même décision (sans lecture), les formateurs rendent le même
texte (2 220 comparaisons), Annonces calcule les mêmes listes avec la même fonction (seulement moins souvent ; l'heure
de la règle « Dorment » à la minute), la recherche donne la même valeur au bout (test).

⚠️ Mesurés sur le build d'avant le dernier ajustement : la saisie différée est devenue ADAPTATIVE en fin de lot (un écran
léger, rendu ≤ 50 ms, reçoit la lettre de façon synchrone, comme avant — pour `espace-emails-interface`). Les écrans
lourds gardent la transition ; seule la 1re lettre d'un champ, qui mesure l'écran, reste synchrone.

## 5. Ce qui reste (le plus gros d'abord)

1. **Ventes : la lettre tapée.** La recherche de Ventes est un état LOCAL de l'écran natif (`src/natif/ecrans/Ventes.jsx`,
   `ChampRecherche` de `src/natif/Page.jsx`, contrôlé) : chaque lettre re-rend l'écran natif entier (INP médian 140 à
   390 ms au ×4). Hors de ce lot (`src/natif/*` tenu par un autre chantier) : y poser `useSaisieDifferee`
   (src/composants/saisieDifferee.jsx) — une ligne dans `Page.jsx` couvre aussi Annonces et le tableau de travail.
2. **L'ouverture au chaud (« écran utile » 15 à 20 s au banc, plus que l'ouverture à froid, ~10 s)** : 40 à 60 tâches
   longues, dont `SectionJournee` → `journeeGelee` (1,7 s) et `UneLigne` (`src/UneLigne.jsx`, `vider` / `tient` : 0,9 s de
   mises en page forcées), `Comptabilite` (4 s inclusif), le préchargement des morceaux de Vite (`querySelector` du
   `<link>` de chaque dépendance : 0,5 s sur un grand DOM). Profil : `PROFIL=… PROFIL_QUAND='chaud 2'` sur un build
   `VRM_SANS_NOMS=1 npx vite build --minify false`. Pas touché ici (risque sur l'apparence de Ma journée).
3. **La 1re visite d'un onglet** (2 à 6 s de CPU au ×4) : le montage d'un écran de 3 000 à 13 000 éléments et les calculs
   de `Comptabilite` ; voir `2026-11-24-vitesse.md` §5 et `-vitesse-ecran-montre.md` §5 (pré-rendre au repos demande un
   rendu sans effets publieurs).
4. **Achats : la lettre tapée.** `InputDiffere` y passe la lettre en transition, mais le corps de `Comptabilite` est UN
   composant (non interruptible) : la lettre suivante attend la fin de son calcul. Gain non mesurable au banc chargé ; le
   vrai remède est de sortir la recherche d'Achats et sa liste filtrée de `Comptabilite` (un composant à part).
5. **`src/rangeesDefilantes.js`** : un `MutationObserver` sur tout `<body>` relit `scrollWidth` des rangées défilantes
   toutes les 300 ms pendant un défilement qui pose des rangées (0,3 s sur Annonces au profil) — à n'observer que les
   rangées elles-mêmes (`ResizeObserver`).

## 6. Gestes de Julien

Aucun.
