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

RESULTATS_390

RESULTATS_1512

## 4. Preuves que rien ne change à l'écran ni dans les chiffres

PREUVES

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
4. **`src/rangeesDefilantes.js`** : un `MutationObserver` sur tout `<body>` relit `scrollWidth` des rangées défilantes
   toutes les 300 ms pendant un défilement qui pose des rangées (0,3 s sur Annonces au profil) — à n'observer que les
   rangées elles-mêmes (`ResizeObserver`).

## 6. Gestes de Julien

Aucun.
