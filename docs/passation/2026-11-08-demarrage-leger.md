# 8 nov. 2026 — Démarrage léger (Julien : « c'est encore beaucoup trop long à charger »)

Branche `claude/demarrage-leger` (depuis `origin/main` b700b4b2). Rien de métier, aucune
lecture réseau touchée (un autre chantier s'en occupe) : seulement ce que le téléphone
TÉLÉCHARGE et COMPILE avant le premier écran.

## Ce qui a été fait

### 1. App.jsx découpé : 14 écrans chargés à la demande (`src/ecrans/*.jsx`)
| module | racines (rendues par App.jsx) | source |
|---|---|---|
| `Stock.jsx` | Garage, StockVinted, Inventory | 126 Ko |
| `Ebay.jsx` | EbayAnnonces, EbayConnexion, EbayVentes | 411 Ko |
| `Leboncoin.jsx` | LeboncoinScreen, LeboncoinColis | 187 Ko |
| `Reglages.jsx` | SettingsScreen, VintedAccounts, EmailsSetting | 313 Ko |
| `Compta.jsx` | ComptaPro, Invoices, Catalog, Sales | 309 Ko |
| `Stats.jsx` | Dashboard | 145 Ko |
| `Vestiaire.jsx` | PublierVestiaire, AnnoncesVestiaire, MessagesVestiaire, VentesVestiaire, ClePhotoroom | 76 Ko |
| `Republier.jsx` | RepublierVinted, AtelierFile, AtelierLots, AtelierBrouillon, RepublierALaMain, BrouillonsVinted, BrouillonsARefaire | 169 Ko |
| `Achats.jsx` | AchatsHorsPlateforme, FeuilleRecuAchat, RelierAchatCorps | 43 Ko |
| `MessagesLeboncoin.jsx`, `Loupe.jsx` (ToutSurLeNumero), `PhotoEditor.jsx` (feuille), `Masques.jsx`, `PrixMarche.jsx` | | 4–24 Ko |

- **Découpe MÉCANIQUE** par `scripts/decouper-app.cjs` (documenté en tête) : une racine
  part avec tout ce que SEULES ses fonctions utilisent (graphe des liaisons de Babel) ; le
  code n'est pas réécrit. Ce qu'un écran emprunte à App.jsx est exporté tout en bas
  d'App.jsx (`export { … }`, ~400 noms). Les racines deviennent
  `aLaDemande(() => import('./ecrans/X.jsx'))` (le même mécanisme que les 15 morceaux du
  6 nov. : squelette, ou pastille « Ouverture… » pour une feuille).
- Garde-fous de l'outil : une instruction qui **réaffecte** une variable restée dans App
  reste dans App (deux poseurs ajoutés à la main : `poserReglesStreamEnAttente`,
  `poserRepubVivant`) ; un **bloc balisé** `// <nom>` … `// </nom>` (règle partagée
  app = extension, ex. `<annonce-lbc-regle>`) ne se coupe jamais ; un import qui ne sert
  plus qu'à l'écran part avec lui mais **ses feuilles de style restent importées dans
  App.jsx à sa place** (cascade inchangée).
- Chaque suite d'instructions partie laisse dans App.jsx `// ⟦→ ecrans/X.jsx #k⟧` et
  commence dans l'écran par `// ⟦← App.jsx #k⟧` (174 balises). **Ne pas les effacer** :
  c'est par elles que les audits relisent le texte d'origine (ci-dessous).
- Ce qui reste dans App.jsx et pèse : `Comptabilite` (1,6 Mo de source, ~40 %) — le moteur
  de Ma journée, Ventes, Colis, Annonces, Messages, Achats : il EST le premier écran, on
  ne peut pas le charger plus tard sans le découper lui-même (vrai refactor, pas fait) ;
  `AppCoeur` (285 Ko) ; ~2 Mo de fonctions partagées.

### 2. Les audits lisent toujours « l'app entière »
`scripts/_source-app.cjs` : `sourceApp()` / `sourceAppDe(cheminApp)` rendent App.jsx avec
chaque morceau **recollé à sa place d'origine** (vérifié : le texte recollé = l'App.jsx
d'avant, aux deux poseurs, aux balises et aux imports de style près) ; `brancher()` fait
rendre ce texte à toute lecture TEXTE d'un `…/src/App.jsx` (`fs.readFileSync`, aussi pour
un script ESM). Branché mécaniquement dans les 268 scripts (audits, bancs, tests) qui
lisaient App.jsx. Exceptions voulues :
- `audit-variables` et `audit-tdz` lisent **chaque fichier réel** (App.jsx et chaque
  écran) : un écran qui oublie d'importer un nom d'App.jsx rougit (mutation faite :
  `Bouton` retiré de l'import de Stock.jsx ⇒ rouge, « Bouton (ligne 1249) ») ;
  `audit-commandes` compte aussi `src/ecrans/`.
- `audit-rouge-doublon` : un rouge en dur d'un écran découpé compte dans la dette d'App.jsx.

### 3. Les feuilles de style de l'app ne bloquent plus index.html
Les 45 `import './styles-….css'` de `src/main.jsx` sont déplacés TELS QUELS (même ordre,
mêmes commentaires) dans `src/stylesApp.js`, importé en tout premier par App.jsx.
`index-*.css` : **668 → 18 Ko** (101 → 4 Ko compressés) ; la page d'accueil et l'écran de
démarrage ne les attendent plus. Preuve que la cascade de l'app ne bouge pas :
`index.css + App.css` concaténés ont la **même empreinte md5** avant/après. Captures de
l'accueil, `?connexion`, `?inscription` (390/1512, clair/sombre) : seules différences =
animations (même écart en comparant le build d'avant à lui-même).
Les bancs `composants`, `favoris-ecran`, `signaler-etat` et `audit-composants` lisent la
liste dans `main.jsx` + `stylesApp.js`.

### 4. Le morceau App demandé dès index.html
`public/demarrage-app.js` (un fichier : la CSP refuse les scripts en ligne) pose
`modulepreload` (JS) et `preload` (sa feuille, `crossOrigin=''` comme le chargeur de
Vite, sinon double téléchargement) quand l'app va s'ouvrir — même règle que `versApp`
de main.jsx (⚠️ à garder identiques). `vite.config.js` (`prechargerApp`) écrit les noms
du build dans `data-js` / `data-css`. Un visiteur de l'accueil ne télécharge rien de plus.

## Mesures
Outil : `mesure.cjs` de la passation (390 px, 4G 9 Mb/s 60 ms, CPU ×4, base inventée
`_base-volume`), signal « prêt » corrigé (`[data-attente]` = pret/plafond, plus de
squelette, écran de démarrage parti). ⚠️ Conteneur partagé et chargé (charge 8–12 sur
4 cœurs : un autre agent lançait des bancs) : temps très bruités, comparer les médianes.

| | avant (main b700b4b2) | après |
|---|---|---|
| morceau App (JS) | 3 921 Ko / **1 223 Ko gz** | 2 500 Ko / **808 Ko gz** (−415 Ko gz, −34 %) |
| JS téléchargé au démarrage | 1 272 Ko gz | 867 Ko gz |
| CSS bloquant index.html | 668 Ko / 101 Ko gz | 18 Ko / 4 Ko gz |
| morceaux à la demande au démarrage (journée, colis, ventes, messages) | 0 | 0 |
| requête App partie à (médiane, 3 tirages) | 639 ms | 425 ms |
| 1er affichage (fcp, médiane journée / colis / ventes) | 1 120 / 968 / 832 ms | 816 / 680 / 796 ms |
| écran prêt (médiane journée / colis / ventes) | 8,8 / 8,3 / 7,7 s | 8,1 / 8,1 / 7,2 s |

Les « tâches longues » (≈ 6–8 s au banc chargé) ne baissent pas nettement : au démarrage
le processeur passe surtout son temps à CALCULER les écrans (`Comptabilite`, voir
`2026-11-07-vitesse.md`), pas à compiler le code.

## Vérifications
- `npm run build` ; captures avant/après des 32 onglets ouvrables par `?tab=` à 390 et
  1512 (texte identique ; écarts de pixels = animations, retrouvés en comparant un build
  à lui-même) ; §4.11 : `tab===` 43/43, 25 écrans distincts, 501 composants rendus au
  même nombre d'endroits (App.jsx + écrans).
- Audits sans navigateur (340) avant/après : mêmes rouges que main, aucun nouveau
  (rouges déjà rouges sur main : argent-a-venir, chemin-json-guillemets, export-donnees,
  journee-coherence, photos-vinted, politique-hotes, registres ; coherence, extension-zip
  et preuve-vente sont rouges dans un arbre `git archive` et verts dans le dépôt).
  Tests `.mjs` qui lisent App.jsx : mêmes résultats (connexion-session et
  isolation-comptes rouges avant et après).
- Bancs (un à la fois, build de la branche ; chaque rouge relancé sur `origin/main`) :
  - verts : `iphone-reprise` (139/139), `fluidite`, `ebay-annonces`, `ebay-inactives`,
    `leboncoin`, `inventaire`, `connexions-reglages`, `parametres-guides`,
    `republier-main`, `achats-hors-plateforme`, `vc-publier`, `prixmarche`,
    `recherche-numero`, `garde-ecrans` ;
  - rouges IDENTIQUES sur main (même nombre, mêmes lignes) : `lbc-messages` (2, panne lue
    pendant « Lecture en cours… »), `rangement` (7, l'assistant de `RoomPlan`, code mort),
    `compta-claire` (4) et `compta-simple` (4) (7,44 € redit), `outils-stats` (2),
    `coque-parametres` (« e-mails », 212 px), `republier` (2), `onglets-d` (8, « Pas
    encore calculé ») ;
  - `chargement` : 1 rouge sur la branche (Messages 390 4G, CLS 0,248 sur UN passage),
    1 autre sur main (Stock 390 lent, CLS 0,038) ; Messages 390 4G relancé 3 fois de
    chaque côté : CLS 0,001 / 0,001 / 0,006 (branche) et 0,001 ×3 (main) — passager.
    Au passage : contenu de Messages à 390 4G en **11,9 / 14,1 / 12,7 s** (branche)
    contre **15,8 / 15,9 / 17,8 s** (main).
  - `tous-boutons` (complet, 390 + 1512) : 2 défauts, tous deux E2 « écran blanc dès
    l'ouverture » (Ventes · Vinted 390, Colis 1512 — la zone principale encore vide au
    premier relevé) ; aucune erreur JS, aucun garde-fou. Relancé sur Ventes et Colis
    seuls : branche **0 défaut**, `origin/main` **les mêmes 2 E2** (Ventes · Vinted 390,
    Colis 390) — un relevé trop tôt, déjà sur main, pas une régression.

## Ce qui reste
1. **Découper `Comptabilite`** (1,6 Mo, ~40 % du morceau App) : les vues `only=…` qui ne
   sont pas le premier écran (achats, messages, annonces…) en composants à part — un vrai
   refactor (ses `useMemo` partagés), pas une découpe mécanique.
2. Le CSS de l'app (1 Mo / 152 Ko gz) : ~75 Ko de règles dont une classe n'existe nulle
   part dans le code (mesure statique) — pas retiré (gain ~10 Ko gz, chaque fichier à
   reprendre à la main, captures à refaire). Les feuilles des écrans découpés restent
   dans le morceau App (les déplacer change l'ordre de la cascade).
3. D'autres écrans peuvent partir avec le même outil (AuthScreen + PorteMfa ~52 Ko,
   JourneeHorsLigne 19 Ko, SuivisManuels/ReceptionEmails 25 Ko) — petits gains.
