# 15 nov. — L'ouverture : plus d'écran d'erreur après une mise en ligne, l'écran de chargement en « Verre dépoli »

Julien : « L'app bug quand je l'ouvre, je veux que tu améliores l'onglet de chargement. »
Branche `claude/ouverture` (partie de `claude/project-review-nsk5su`). Pas de PR.

## Ce qui était mesuré avant de coder

- Journal `app_data` (`plantage_*`, champ `data->>'at'`) : rien depuis le 12 nov. Les derniers :
  « reading 'default' » (`journee:moderation`, 12 nov.), « evaluating 'e.FactureVente' » (11 nov.),
  « evaluating 'e.VintedAccounts' » (10 nov.) — tous sur une page dont la version avait 1 h ou plus.
- Pourquoi le journal se tait : un morceau périmé (`MORCEAU_PERIME` : « Failed to fetch dynamically
  imported module », « Unable to preload CSS »…) est **compté à part sur l'appareil**
  (`vrm_morceaux_perimes`), jamais envoyé en base. Le défaut qu'il voit n'y laisse donc aucune trace.

## Les causes, reproduites (banc `scripts/bancs/ouverture.cjs`, deux builds servis tour à tour)

Le banc sert deux vrais builds du même arbre (A = la mise en ligne d'avant, B = la nouvelle) par un
serveur qui répond **404** à un fichier qu'il n'a plus (Vercel Hobby : pas de « Skew Protection »),
avec le **vrai service worker**, iPhone 390 tactile, et sans aucune route Playwright (une route coupe le
cache HTTP et fausse le mode de cache que voit le service worker).

1. **La boucle de rechargements à l'ouverture (2c)** — l'app rouverte après une mise en ligne démarre
   sur la coquille GARDÉE par le service worker (ouverture instantanée, 14 nov.), voit la nouvelle version,
   se recharge… et le rechargement retombe sur la coquille gardée tant que le service worker n'a pas fini
   de ranger la nouvelle (≈ 40 fichiers un par un, en tâche de fond). Mesuré sur le code de départ, réseau
   à 300 ms par fichier, rechargement que le navigateur ne marque pas « sans cache » (ce que fait le mode
   de cache d'une navigation rechargée n'est pas garanti hors Chrome) : **A ▸ A ▸ B**, l'écran de
   démarrage qui repart deux fois. Avec un réseau plus lent, autant de tours que de secondes de rangement.
2. **L'écran tombé le temps d'un rechargement (3)** — une page restée ouverte (iPhone : des heures en
   arrière-plan) ouvre un écran jamais ouvert : son morceau n'existe plus. `vite:preloadError` relançait la
   page, mais l'import rejeté arrivait d'abord à React : **« Cet écran a un souci — Failed to fetch
   dynamically imported module »** à l'écran, puis le rechargement (qui pouvait retomber sur la coquille
   gardée : même erreur, et dans la minute plus aucun rechargement).
3. **Un morceau qui rate pour de vrai (4)** — « Cet écran a un souci » avec le message technique, et un
   rechargement automatique inutile (même version en ligne).
4. (Déjà corrigé le 14 nov., gardé fermé) `ev.preventDefault()` sur `vite:preloadError` faisait rendre
   `undefined` à la place du module ⇒ « reading 'default' » / « evaluating 'e.FactureVente' ».
   `chargerSur` refuse désormais tout module sans `default` (audit-ouverture).

## Ce qui a changé

- **`src/chargementSur.js`** (nouveau) — une règle pour tous :
  - `lazySur(charger)` remplace **tous** les `React.lazy` de `src/` (36 usages ; App.jsx, main.jsx,
    écrans découpés, Accueil, ConfortCoque, idées argent). Un morceau raté est relancé une fois ; raté
    encore, la version du serveur est relue : **une autre version en ligne ⇒ rechargement propre, la
    promesse reste en attente** (l'écran garde son attente, jamais un écran tombé) ; sinon une erreur
    **marquée** que les garde-fous montrent comme « Mettre à jour VRM ». Un module vide n'est jamais rendu.
  - `rechargerVersNouvelle` : avant de relire la page, **oublie la coquille gardée** (`/` des réserves
    `vrm-shell*` — jamais les fichiers `/assets/` ni les réserves `vrm-hl-*` du hors ligne), en ligne
    seulement. Le rechargement passe donc par le réseau et arrive sur la nouvelle version quel que soit
    le navigateur. **Une fois par version cible et par onglet, trois en dix minutes au plus**
    (`sessionStorage` `vrm_recharge_version`) : jamais une boucle ; refusé ⇒ la pilule « Mettre à jour ».
- **`src/main.jsx`** : `vite:preloadError` ne recharge plus à l'aveugle (il relit la version, jamais
  `preventDefault`) ; la vérification de version part **tout de suite** (plus à l'événement `load`) et
  recharge par `rechargerVersNouvelle` pendant que l'écran de démarrage couvre encore ; le dernier filet
  montre « Mettre à jour VRM » pour un morceau. La pilule « Mettre à jour » passe par la même voie.
- **`src/composants/MettreAJourVRM.jsx`** (nouveau) : une phrase, UN bouton (« Mettre à jour »), un texte
  hors ligne. Clés `maj.*` et `demarrage.*` dans les `*-accueil.js` (5 langues : elles s'affichent sans
  l'app). `GardeEcran` le montre pour une erreur de morceau.
- **L'écran de démarrage (`#vrm-demarrage`, index.html)** en « Verre dépoli » : le dégradé EXACT de la
  proposition 9 (`.d9`), jeton `--vrm-verre-fond` (et `--vrm-verre-fond-nuit`, bleu-nuit, en sombre) posé
  sur `:root` — **la coque en verre (`claude/verre-app`) doit lire ce même jeton** ; logo au centre ; une
  progression fine et **honnête** : le rail avance à de vrais jalons (page lue 0,12 · app lancée 0,3 ·
  morceau téléchargé 0,6 · coque qui attend ses données 0,82 · prêt 1 — `etapeDemarrage`,
  src/demarrage.js), aucun nombre écrit ; au-delà de **8 s**, « Ça prend plus de temps que d'habitude. La
  connexion est peut-être lente. » et UN geste « Recharger » (44 px, verre), qui oublie la coquille gardée
  (public/demarrage-theme.js, avant tout JavaScript de l'app). Sortie en fondu (340 ms) ; pendant le
  démarrage la racine porte `data-vrm-boot` : le fond du document est le même bleu, rien de blanc entre
  l'icône, un rechargement et l'app. `prefers-reduced-motion` : ni reflet, ni glissade, ni fondu, le mot
  « Ouverture de VRM… » en clair. Traduit au lancement (main.jsx).
- **Barre d'état** : `theme-color` = le haut du dégradé pendant le démarrage (#5E96D1 clair, #1E406A
  bleu-nuit), l'app pose la sienne à la sortie de l'écran de démarrage (App.jsx, `vrm:demarrage-fin`).
  `apple-mobile-web-app-status-bar-style` reste `default` (`black-translucent` écrit en blanc toujours :
  illisible sur la coque claire actuelle — à revoir quand la coque en verre sera en ligne).
- **Manifeste** : `background_color` #1D5A9C, `theme_color` #5E96D1. **Images de lancement iOS**
  (`public/demarrage/`) rendues depuis l'écran de démarrage lui-même (`scripts/demarrage-images.cjs`),
  en **JPEG** (un dégradé en PNG : 23 Mo les 24 ; en JPEG 2,4 Mo) ; `audit-app-installable` lit leurs
  dimensions en PNG ou JPEG.

## Preuves

- `node scripts/bancs/ouverture.cjs <dist-A> <dist-B>` : **59 verts** sur deux builds de la branche ;
  **18 rouges** sur deux builds de l'arbre de départ (3ac51daf, banc copié dans `git archive`) : boucle
  A ▸ A ▸ B (2c), écran tombé un instant (3), « Cet écran a un souci » + rechargement inutile (4), écran
  de démarrage gris, fond blanc/noir, barre d'état Studio pendant le démarrage, phrase lente à 20 s.
  **Mutations** : `oublierCoquille` retiré ⇒ 2c rouge (3 chargements) ; `chargerSur` réduit à
  `return charger()` (React.lazy nu) ⇒ 3 rouge (écran tombé).
- `node scripts/audit-ouverture.cjs` : 32 verts (règles exécutées) ; rouge sur l'arbre de départ.
- Audits : csp, tdz, variables, traduction, studio, apparence (contrôle de la barre d'état mis à jour :
  pendant le démarrage elle suit l'écran de démarrage, le thème suivi est inchangé), app-installable,
  quoi-de-neuf — verts. Bancs garde-ecrans (vert), studio-coque (78 verts). accueil-reste : E2/E3 (la
  bulle du glossaire) et D3 rouges par intermittence, **autant sur l'arbre de départ** (relancé seul,
  `SCENARIOS=E LARGEURS=390`, deux fois chaque build : rouge 1 fois sur 2 des deux côtés) — machine à
  charge 40-50 et disque à 99 % (navigateur qui plante en fin de banc complet) ; pas lié à ce lot.
- Captures (390, à regarder) : `6-chargement-clair.png`, `6-chargement-sombre.png`, `6-lent-*.png`,
  `8-transition-claire.png` / `-sombre.png` (le fondu, ralenti ×30 pour être saisi), `4-mettre-a-jour.png`.

## Limites connues

- Chromium garde l'échec d'un import de module pour la page : la relance n'y repart pas au serveur (elle
  sert aux navigateurs qui relancent). C'est la relecture de la version qui décide.
- Le banc tourne sous Chromium (pas de WebKit installé). La cause 1 est jouée en forçant le cas « un
  rechargement non marqué sans cache » dans le vrai `sw.js` servi (une ligne) — le comportement exact de
  Safari n'a pas été observé ; le correctif (oublier la coquille avant de relire) ne dépend plus de lui.
- iOS choisit l'image de lancement claire/sombre selon le thème du SYSTÈME (pas `vinted_dark`).
- Quand l'instantané de Ma journée est peint dans l'écran de démarrage (ouverture instantanée), la barre
  d'état garde le bleu du démarrage jusqu'à la sortie de cet écran (~1 s), au-dessus de l'instantané clair.
- La coque de l'app est encore « Studio bleu clair » : le fondu passe du dégradé à la coque claire (aucun
  blanc pur, jugé image par image). Quand `claude/verre-app` posera le même jeton `--vrm-verre-fond` sur la
  coque, le fondu ira d'un dégradé au même dégradé.

## Mesures — temps jusqu'à Ma journée

`TABS=journee ANNONCES=1000 node scripts/bancs/_mesure-demarrage.cjs <dist>` : ouverture à FROID (sans
service worker), 390 tactile, 4G (9 Mb/s, 60 ms), processeur ×4, base inventée au poids réel + 1 000
annonces. Machine partagée très chargée (charge 45-50 sur 4 cœurs) : à lire comme « pas de régression ».

| build | prêt (ms) | tâches longues (ms) | plus longue (ms) | JS (Ko compressés) |
|---|---|---|---|---|
| départ (3ac51daf) | 12 726 · 14 417 | 14 565 · 16 744 | 2 091 · 2 273 | 2 249 |
| ouverture | 12 889 · 13 990 | 17 262 · 16 227 | 2 146 · 2 170 | 2 252 |

Après une mise en ligne (banc ouverture, 2c, réseau à 300 ms par fichier) : départ = 3 chargements,
Ma journée à ~8,2 s ; ouverture = 2 chargements, Ma journée à ~7,3 s, et le seul rechargement a lieu sous
l'écran de démarrage (l'ancienne Ma journée n'est jamais montrée).

**Le gros morceau qui bloque l'ouverture (dit, pas entrepris)** : `App-*.js` = 5,2 Mo (1,7 Mo
compressés) analysé et exécuté d'un bloc avant le premier écran — ~15 s de tâches longues au processeur ×4,
la plus longue ≈ 2,1 s ; et `App-*.css` = 1,98 Mo (287 Ko compressés), une feuille énorme pour chaque
recalcul de styles. C'est là qu'est le temps, pas dans le réseau ni dans l'écran de chargement.
