# 9 nov. 2026 — Direction artistique, phase 5 : la colonne de gauche et les boutons

Branche `claude/direction-artistique-5` (depuis `origin/main` 080956a8, après la PR #1069). Pas de PR,
pas de merge : à valider par Julien.

Demande de Julien, mot pour mot : « je veux vraiment que tu changes totalement le design des onglets
sur la gauche, que ce soit beaucoup plus beau ; le design est vraiment pas ouf ; le design en général
du site tu ne l'as pas énormément modifié ; les boutons font moins qualitatif. »

## Ce qui change (visible au premier coup d'œil)

Tout le dessin est dans **`src/styles-nav-v2.css`**, importé EN DERNIER par `src/App.jsx`, dans la
même couche que la direction artistique (`@layer vrm-premium` : un `!important` dans la couche gagne
contre tous ceux hors couche, sans surenchère de sélecteurs). Jetons `--n2-*` en tête du fichier.

### La colonne de gauche (ordinateur)

| avant | après |
|---|---|
| colonne collée au bord, bordure droite grise | un **panneau qui flotte** : 12 px d'air autour, rayon 20, ombre très douce, aucune bordure ; matière un cran plus soutenue que le contenu (`#E5E5EA`, `#1C1C1E` la nuit), translucide `saturate(180%) blur(20px)` là où le navigateur sait flouter (repli opaque, opaque aussi sous `prefers-reduced-transparency`, cerné sous `prefers-contrast: more`) |
| « VRM » en texte | une **marque** : tuile 32 px rayon 9, monogramme « V » blanc sur le dégradé bleu nuit de la carte sombre, reflet fin ; puis « VRM » 17/700 |
| pastille bleu pâle, libellé et icône bleus | **pastille surélevée** (blanc + ombre fine ; `#2C2C2E` + liseré la nuit), libellé 600 à l'encre, **icône seule à l'accent** — le seul endroit coloré de la colonne |
| la pastille saute | elle **glisse** d'une entrée à l'autre (`transform`, 240 ms, `cubic-bezier(.32,.72,0,1)`) ; immobile sous `prefers-reduced-motion` |
| rangées 38 px, 15 px, libellés gris | rangées 38 px (44 au doigt), icône 19 px, libellé 14/500 à l'encre secondaire (12,6:1) ; survol : un remplissage neutre très léger, seulement à la souris |
| titres 12/500 | titres 11/600, espacement de lettres léger, `#636366` (4,9:1 sur le panneau ; `#98989D` la nuit, 6:1), 18 px d'air entre groupes |
| compteurs ambre cerclés hors des trois écrans premium | **pilule neutre tabulaire** partout (le point ambre « nouveau » de Messages reste : un geste attend, §7) |
| Communauté et Paramètres sous un filet | une **carte du compte** au pied : initiale, nom de l'entreprise s'il est connu sinon l'e-mail du compte VRM, l'offre (Pro / Solo) SEULEMENT si le serveur l'a dite (`reglePlanCourante`) — rien d'inventé ; puis Communauté et Paramètres. Floutée en mode stream (`vrm-sensible`) |
| 236 px dès 1024 px | **rail d'icônes de 64 px entre 1024 et 1199 px** (et pour les petites fenêtres à la souris) : libellés cachés, info-bulle native (`title`), titres de groupe en 10 px centrés (le banc `iphone-reprise` exige qu'ils restent visibles), compteur en pastille pleine neutre sur l'icône, carte du compte réduite à l'initiale ; le contenu se décale (`margin-left: 96px`) |

Fenêtre basse : la colonne se resserre toujours (`data-rail-densite` 1 à 4, posé par SideBar) — les
rangées descendent à 34/32/30 px, la carte du compte se replie à la densité 3 ; jamais Paramètres
coupé (banc `iphone-reprise` O, zoom 1,25).

### Les boutons (toute l'app)

`.vrm-b` seulement (aucune règle sur `button` en général, jamais `display` — §7) :
- **primaire** : l'accent plein + un reflet en haut (dégradé blanc 14 % → 0 sur la moitié haute) +
  une ombre intérieure fine (liseré clair en haut, contour 0,5 px) + une ombre de contact bleutée ;
  survol `brightness(1.06)` à la souris, appui `scale(.97)` 120 ms et `brightness(.94)` ;
- **secondaire** : l'encre à 6 % (blanc à 10 % la nuit), aucune bordure, texte à l'encre ;
- **tertiaire** (`vrm-b-discret`) : texte bleu, rien d'autre ;
- rayon 12, texte 600, au moins 36 px à la souris (44 au doigt, inchangé), focus visible 2 px.
Le rouge n'est posé nulle part (destructif = rouge seulement pour l'irréversible : aucun bouton de ce
genre n'est touché ici).

### La recherche du haut (ordinateur)

Le champ de macOS : remplissage neutre (plus une carte blanche posée sur le gris), 38 px, rayon 12 ;
au focus il s'éclaire (fond de carte) et prend un halo d'accent doux ; la touche « / » en capsule neutre.

## Le code

`src/App.jsx`, `SideBar` seulement (mêmes entrées, mêmes groupes, même ordre, mêmes
`data-nav-groupe` / `data-nav-entree` / `data-nav-taches` / `aria-current`, `.vrm-sidebar-mot` =
« VRM ») :
- `<span data-nav-indicateur aria-hidden>` : la pastille, placée sous l'entrée `aria-current` par un
  `useLayoutEffect` (mesure, `translate3d`, suit le défilement de la zone et de la colonne, se cache
  si l'entrée est hors de la zone visible) ; `data-indicateur` sur la colonne ôte alors le fond de
  l'entrée elle-même (sans mesure, l'entrée garde sa pastille) ;
- la tuile de marque (`.vrm-nav-tuile`, `aria-hidden`) ;
- la carte du compte (`data-nav-compte`), rafraîchie sur `suivreAbonnement`. `NomEntreprise` y
  passe (`data-nom-entreprise`, que `reglages.cjs` retire exprès du texte lu).
Aucun texte de règle, aucun calcul, aucune donnée ne change. Le téléphone ne change pas (la barre du
bas, les feuilles, confirmations, toasts et états vides sont au chantier `claude/direction-artistique-4`).

## Vérifications

- `npm run build` vert ; `audit-variables`, `audit-tdz`, `audit-coherence`, `audit-icones`,
  `audit-boutons`, `audit-violet` verts.
- **`scripts/bancs/nav-v2.cjs`** (nouveau, mode exemple, aucune donnée réelle) : **54 verts** ici,
  **27 rouges sur `origin/main`** (080956a8 : rayon, flottement, ombre, contraste de l'entrée
  choisie 4,21:1, pastille absente, rail absent à 1100 px, primaire sans reflet). Mutation : la
  transition de la pastille retirée du CSS construit ⇒ 4 rouges (N5).
- Bancs existants, un à la fois : `iphone-reprise` 139 verts (deux rouges trouvés et corrigés en
  route : « VRM » coupé à 1008 px dans le rail, Paramètres sous le bord au zoom 1,25 faute de densité),
  `navigation-tache` 163, `onglets-a` 29, `beaute` vert, `journee-premium` 15, `ventes-colis-premium` 32,
  `tous-boutons` (1512, Ma journée/Ventes/Colis) : 1 rouge E4 « Relier ma boîte » — le même sur
  `origin/main`, pas de cette branche.

## Planches (mode exemple, données inventées)

`docs/passation/planches-da5/` — AVANT (origin/main) à gauche, APRÈS à droite :
- `colonne-gros-plan-clair.png`, `colonne-gros-plan-sombre.png` (la colonne en grand, 1512 px) ;
- `1512-{clair,sombre}-{journee,ventes,cat_bord,annonces,settings}.png` ;
- `1100-{clair,sombre}-{journee,annonces}.png` (le rail d'icônes) ;
- `390-{clair,sombre}-cat_bord.png` (téléphone : seuls les boutons changent).

## Ce qui reste

- Julien regarde les planches ; s'il valide, PR depuis la branche.
- Info-bulle du rail : native (`title`). Une bulle dessinée demanderait un portail hors de la colonne
  (elle a `overflow: hidden`) — à faire si le natif ne lui plaît pas.
- Les boutons écrits en ligne sans classe (`Voir`, filtres d'Annonces…) gardent leurs formes
  actuelles : seule la base `.vrm-b` est montée d'un cran.
- Fenêtre très basse : les rangées descendent sous 36 px (34/32/30, comme avant) pour que rien ne
  soit coupé.
