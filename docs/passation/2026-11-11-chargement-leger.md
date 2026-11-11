# 11 nov. 2026 — Chargement léger (le JS du premier écran)

Branche `claude/chargement-leger` (depuis `origin/main`), poussée à chaque commit. Pas de PR ni
de fusion dans `main` (consigne). Pas d'extension, pas de migration, aucune écriture en base.

## 1. Ce qui change pour Julien
Rien à voir. L'app télécharge **~180 Ko compressés de moins** avant le premier écran (−14 %) :
en 4G le premier écran arrive ~1 s plus tôt, sur réseau lent ~3,7 s plus tôt. Et un écran qu'il
ouvre souvent sur CET appareil (Paramètres, Statistiques, eBay…) est téléchargé en fond une fois
l'ouverture terminée : il s'ouvre sans attendre son morceau.

## 2. Mesure d'abord (analyse des morceaux du build, plugin d'analyse temporaire hors dépôt)
`npm run build` sur `origin/main` : le morceau **App pesait 3 651 Ko (1 228 Ko gzip)**, avertissement
de Vite. Dedans, hors `App.jsx` (3,2 Mo de rendu) :

| module | rendu | remarque |
|---|---|---|
| **pdf-lib** + pako + polices + upng | **1 141 Ko** (~183 Ko gzip une fois minifié) | n'était demandé que par des `import('pdf-lib')` (tampon, factures, exports)… |
| tout le reste de `src/` et `api/_lib/` | ~2,9 Mo | ~500 modules, le plus gros 69 Ko (`CarteRelais.jsx`) |

three.js (190 Ko gzip), maplibre-gl (289 Ko), jsQR (47 Ko), qrcode-generator (8 Ko) étaient **déjà**
à la demande (Room3D, fondCarte, lireQrCapture, qrMfa) : vérifié, pas touchés. framer-motion et
pdfjs ne sont pas dans le dépôt (pdf.js vient d'un CDN, chargé au besoin).

**Pourquoi pdf-lib était dans le morceau App** : `api/_lib/texte-pdf.js` (le lecteur de texte des
étiquettes, partagé serveur/app depuis le 9 nov., chargé par `transporteur-pdf.js` à la demande)
l'importait EN STATIQUE. Vite le signalait (« dynamic import will not move module into another
chunk ») et Rollup recollait pdf-lib au morceau App. Avec un `manualChunks` seul, Rollup gardait un
`import "./pdf-lib-….js"` dans App (essayé : même poids initial).

## 3. Ce qui a changé
1. **`api/_lib/texte-pdf.js`** : pdf-lib chargé au premier appel de `texteDuPdf` (`chargerPdfLib`,
   une promesse partagée, rejouée si l'import échoue). Mêmes classes, même lecteur : seul le moment
   du chargement change. Le serveur (Vercel, ESM) fait le même `import()`.
   `audit-transporteurs-parfaits` 19/19 (dont T1 : l'étiquette lue sans `Buffer`, comme dans le
   navigateur) ; `audit-dac7-comptes` 43/43.
2. **`vite.config.js`** : `manualChunks` en fonction — `react` (react, react-dom, scheduler) comme
   avant, et **`pdf-lib`** (pdf-lib, @pdf-lib/*, pako) dans un morceau nommé.
3. **Préchargement de l'écran le plus probable** (`src/prechargeEcrans.js`, branché dans `AppCoeur`
   à côté de `siteCourant`) : chaque écran ouvert est compté par FAMILLE de morceau
   (`vrm_ecrans_frequents`, `localStorage` de l'appareil, une commodité — aucune donnée du vendeur ;
   une visite par famille et par page). Ma journée, Colis, Ventes et Annonces Vinted sont dans le
   morceau App : pas de famille. Quand l'écran d'ouverture est **stable** (plus aucune attente,
   squelette, pastille « Ouverture… » ni écran de démarrage depuis 3 s) et le navigateur libre
   (`requestIdleCallback`), les **deux** familles les plus ouvertes ici (au moins 2 fois, jamais
   celle de l'écran courant) sont téléchargées, **une à la fois**, par les MÊMES `import()` que les
   écrans (`CHARGEURS_ECRANS`, App.jsx) — le navigateur ne télécharge chaque morceau qu'une fois.
   Jamais en « économie de données », en 2G, page cachée ; on renonce après 60 s sans écran stable.
   Un échec ne dit rien : l'écran se charge à son ouverture, comme avant. Vérifié : aucun module
   des morceaux d'écran n'a d'instruction de tête (rien ne s'exécute au simple chargement).
   Appareil neuf : rien n'est préchargé (pas de devinette qui prendrait la 4G pour rien).

## 4. Ce qui n'a PAS été fait, et pourquoi
- **`App.jsx` lui-même** (3,2 Mo de rendu, ~1 Mo gzip) : `Comptabilite` (Ma journée, Colis, Ventes,
  Annonces, Litiges) en fait 1,77 Mo de source, `AppCoeur` 0,32 Mo — tout ce qui sert à l'ouverture.
  Le découper n'est pas mécanique (une seule fonction de 21 000 lignes) : chantier à part.
  Les gros écrans sont déjà à la demande depuis le 8 nov.
- Petits composants encore statiques (`ConfigurationDepart` 33 Ko, `ModeDepot`/`ModeRelais`,
  `ScannerColis`…) : ~15 Ko gzip au mieux ; `ModeDepot`/`ModeRelais` servent HORS LIGNE (codes de
  retrait) — à la demande, ils ne seraient pas là sans réseau. Pas touchés.
- **La feuille de style App** (1,35 Mo, 194 Ko gzip) bloque aussi le premier écran : chantier style.

## 5. Preuves
**Contrôle neuf `scripts/bancs/poids-initial.cjs`** (statique, sur `dist/`) : le JS initial =
module d'entrée + `modulepreload` + `data-js` du démarrage + leurs imports statiques de proche en
proche. P1 gzip ≤ **1 190 Ko** (plafond mesuré : 1 088 Ko après, ~5 % de place pour les autres lots,
pas pour un pdf-lib revenu) ; P2 pdf-lib, three, maplibre-gl, jsQR, qrcode-generator hors du JS
initial (nom du morceau ET signature de son code) ; P3 pdf-lib dans son morceau ; P4 index.html
précharge App.
- `origin/main` : **3 rouges** (1 267 Ko ; pdf-lib dans App ; pas de morceau pdf-lib).
- Mutations : import statique remis dans `texte-pdf.js` ⇒ P1 (1 266 Ko) et P2 rouges ;
  règle `manualChunks` pdf-lib retirée ⇒ P3 rouge.

| JS initial | avant (`origin/main`) | après |
|---|---|---|
| morceau App | 3 566 Ko · gzip 1 197 Ko | 3 136 Ko · gzip 1 018 Ko |
| + index + react | gzip 70 Ko | gzip 70 Ko |
| **total** | **gzip 1 267 Ko · brotli 998 Ko** | **gzip 1 088 Ko · brotli 834 Ko (−14 % / −16 %)** |

**Banc `chargement.cjs`** (base inventée au poids réel, 390 px tactile, CPU ×4, 8 écrans à froid),
AVANT (`origin/main` dans un arbre à part, `git worktree`, le banc copié dedans) / APRÈS :

| premier contenu → écran stable | 4G avant | 4G après | lent avant | lent après |
|---|---|---|---|---|
| Ma journée | 13,0 → 15,5 s | **12,0 → 14,4 s** | 36,1 → 46,3 s | **32,4 → 47,1 s** (voir ci-dessous) |
| Ventes | 11,8 → 13,0 | 11,8 → 13,0 | 36,5 → 43,7 | **32,5 → 39,4** |
| Annonces | 14,7 → 23,5 | **13,8 → 22,8** | 36,6 → 52,1 | **32,6 → 47,9** |
| Colis | 16,1 → 24,2 | **14,6 → 17,7** | 36,5 → 52,4 | **32,6 → 48,4** |
| Achats | 13,4 → 16,2 | **12,2 → 15,2** | 36,6 → 46,0 | **32,7 → 42,0** |
| Messages | 13,2 → 14,7 | **12,0 → 14,0** | 36,4 → 50,9 | **33,2 → 47,7** |
| Stock | 11,3 → 13,0 | **10,3 → 11,9** | 36,5 → 41,9 | **32,9 → 38,5** |
| Argent | 11,7 → 12,7 | **11,0 → 12,0** | 36,1 → 43,0 | **32,4 → 39,3** |

- Mêmes **8 rouges** des deux côtés (« pas su » transitoires de Ma journée/Annonces/Colis/Achats,
  CLS 0,022 de Ventes en lent) : préexistants, identiques ligne à ligne.
- **Ma journée en lent, « stable » 46,3 → 47,1 s** : reproduit (4 passages alternés avant/après :
  avant 45,5–51,0 s, après 46,8–47,1 s). Le journal (`CHARGEMENT_DEBUG=1`) montre la MÊME suite de
  changements, chacun ~3,5 s plus tôt (dernier changement venu des données : avant 45,5/46,7 s,
  après 42,9/42,5 s). Ce qui fixe « stable » ensuite, c'est la DISPARITION du toast « Numéros en
  double réglés » (minuterie fixe, ~9 s, base du banc) : apparu plus tôt, il disparaît dans la
  fenêtre de mesure ; avant, la mesure s'arrêtait souvent avant qu'il disparaisse. Pas un recul.
- **Banc `vitesse.cjs`** : voir §5 bis (rempli après la mesure).

**Banc neuf `scripts/bancs/precharge-ecrans.cjs`** (390 tactile, CPU ×4, 4G simulée par le serveur
du banc — l'émulation de Chrome ne freinait pas les morceaux demandés après l'ouverture : 22 ms pour
106 Ko) : B appareil neuf ⇒ rien en fond ; A historique `{reglages: 5}` ⇒ A1 le morceau Réglages
téléchargé, une seule famille ; A2 requête APRÈS le dernier changement de l'ouverture (15,3 s / 13,5 s) ;
A3 Paramètres ouvert sans pastille, sans redemander le morceau, **0,78 s au lieu de 1,19 s** (D,
appareil neuf, morceau téléchargé au geste en 0,7 s) ; C « économie de données » ⇒ rien. **Vert.**
- `origin/main` : **5 rouges** (A1 ×2, A2, A3 redemandé, A3 pas plus vite).
- Mutations : `ecranStable` toujours vrai + `reseauPermet` toujours vrai ⇒ **A2 et C rouges**.
- Le texte de Ma journée A/B est imprimé en information, pas jugé : sur cette base le réglage
  automatique des doublons tombe à des moments différents d'un passage à l'autre, dans les deux
  sens (vu sans préchargement aussi). Le texte identique est jugé par `vitesse.cjs`.
- `scripts/tests/precharge-ecrans.test.mjs` 5/5 (familles, choix, réseau, stockage refusé).

**Audits** : variables, tdz, coherence, identite, icones, textes-courts, fonctions-api, secrets,
csp — verts. `npm run build` vert (l'avertissement de taille reste : App fait toujours 3,1 Mo).
**Captures regardées** (fin de chaque écran, 390, 4G et lent) : Ma journée, Colis, Argent… rendus,
rien de blanc, rien de changé.

## 6. Ce qui reste
- Découper `Comptabilite` (le vrai poids de l'ouverture) ; la feuille de style App.
- `ScannerColis` est importé en statique par `ModeDepot`/`InventaireStock` : son `import()` ne
  sépare rien (avertissement Vite) — sortir `useLectureCamera`/`creerBip` dans un module à part.

## 7. Geste de Julien
Aucun.
