# 17 nov. 2026 — Vitesse : le POIDS du démarrage (branche `claude/vitesse-poids`)

Julien : « je veux que tu améliores la vitesse de l'app ». Ce lot attaque le poids et le réseau ; le
cache des données par onglet, Annonces gardé monté, Comptabilite mémoïsée et la stabilité de Ma
journée sont au lot `claude/vitesse-cache` (pas touchés ici). Aucune règle métier touchée, aucun style
changé. Mesures sur la base INVENTÉE des bancs (`scripts/bancs/_base-volume.cjs`), jamais sur la vraie.

## 1. La mesure d'avant (origin/main `fb408cb`)

| quoi | mesure |
|---|---|
| `budget-vitesse` Ma journée, appareil neuf (390 px) | **2 087 Ko** de JS+CSS compressés — budget 1 966 ⇒ rouge (+121 Ko) |
| morceau App (JS) | 5,09 Mo minifiés, **1 632 Ko** gzip |
| feuille App (CSS) | 2,25 Mo, **313 Ko** gzip |
| dont le français (fr.js + fr/*.js) | ≈ 567 Ko avant minification, ≈ 150 Ko gzip |
| fichiers au démarrage (index.html → entrée, préchargements) | 14 |
| polices | une : Inter VRM 48 Ko woff2, `font-display: swap` (décision de Julien du 15 nov., gardée) |
| photos | `loading="lazy"` + `decoding="async"` déjà posés (PhotoVinted) ; le banc coupe les hôtes externes |
| cache HTTP | `/assets/*` déjà `max-age=31536000, immutable` (vercel.json) |
| service worker | `public/sw.js` range déjà TOUS les morceaux d'un déploiement (`rechaufferMorceaux`, liste `hors-ligne-assets.json`) |
| préconnexion | `<link rel="preconnect">` vers Supabase déjà dans index.html ; App + sa CSS préchargés par `demarrage-app.js` (Ma journée est DANS App) |

## 2. Ce qui a été cherché et NE marche PAS (mesuré, ne pas refaire)

- **CSS morte** : un élagueur à preuve STATIQUE (une règle qui exige une classe qu'aucun fichier de
  src/, public/, l'extension ne nomme — ni tel quel, ni par préfixe `'x-' + t`, ni par suffixe) ne
  retire que **0,3 Ko** sur 313 (21 sélecteurs, dont 3 de maplibre posés par la bibliothèque — ils
  auraient cassé la carte). Les 7 300 classes de la feuille sont toutes nommées quelque part.
- **Découper la CSS par écran** : presque toutes les classes sont posées par App.jsx lui-même
  (Comptabilite rend tous les écrans) : 2 Ko seulement seraient déplaçables sans changer l'ordre de la cascade.
- **Minifier autrement la CSS** : lightningcss 311,7 Ko, csso 313 Ko — rien.
- **Vignettes Vinted** : l'extension range une miniature (`photo.mini`, 150×210) seulement sur une
  partie des comptes (mesuré : 2 comptes sur 8 relus) ; à 150 px de large elle serait floue sur les
  tuiles d'Annonces (DPR 3). Les URL sont signées (`?s=`) : impossible de réécrire la taille. Pas fait.

## 3. Ce qui a changé

1. **Le français des écrans à la demande arrive avec eux** (`vite.config.js` `francaisDiffere`,
   analyse `scripts/_francais-differe.cjs`). Au BUILD seulement, le `fr.js` qu'importe App.jsx devient
   la part que le démarrage PEUT lire (3 720 clés, 66 Ko gzip) ; les 5 030 autres remplissent
   `src/i18n/langues/fr-reste.js` (87 Ko gzip), importé EN PREMIER par les 69 modules à la demande qui
   peuvent en lire une (Stats, Compta, eBay, Réglages, Republier…). Le dépôt garde `fr.js` complet
   (les 22 audits qui le lisent ne changent pas) ; `vite dev` charge tout comme avant.
   « Peut lire » est large : un littéral, un PRÉFIXE (`'compta.' + x`, `` `rg.mot.${k}` ``), un
   SUFFIXE (`x + '.titre'`), un mot d'une phrase, tout fichier de api/, public/, l'extension, et les
   modules que main.jsx ouvre avant l'app. Filet : une clé absente demandée dans l'app avant le reste
   est notée (`window.__vrmClesEnAttente`) et le reste est chargé (src/i18n/index.js).
2. **Noms courts par fréquence** (`nomsCourts`) : terser `mangle` SEUL (aucune réécriture du code,
   seulement les noms locaux) sur les morceaux de l'app ; gzip compresse mieux. App −3 %. Build : 46 s → ~100 s.
   `terser` ajouté aux devDependencies (le paquet-lock suit).
3. **Le générateur de QR** (`qrcode-generator`, ≈ 50 Ko) chargé au clic « Montrer le QR »
   (src/ConnexionQr.jsx) ; `audit-morceau-app` le refuse désormais en statique.

## 4. Après (mêmes bancs, même machine)

| mesure | avant | après |
|---|---|---|
| `budget-vitesse` Ma journée neuf, JS+CSS | 2 087 Ko ❌ | **1 945 Ko ✅** (−142 Ko, −6,8 %) |
| morceau App gzip | 1 632 Ko | **1 496 Ko** (−136 Ko) |
| `audit-poids-demarrage` (index.html du build) | 2 058 Ko ❌ | **1 916 Ko ✅** |
| fichiers au démarrage | 14 | 11 |
| lectures de la base au démarrage | 148 | 148 (inchangé) |
| fr-reste au démarrage | — | 0 (seulement au réchauffage du service worker, après) |

## 5. Les preuves
- `scripts/audit-francais-differe.cjs` : exécute la vraie analyse + 7 clés témoins en mémoire —
  `--prouve` 8/8 (préfixes, suffixes, api/, modules de main.jsx, aucune injection, tout au démarrage,
  Stats/Compta/eBay réimportés dans App, App.jsx qui importe autre chose que fr.js). Rouge sur main (absent).
- `scripts/audit-poids-demarrage.cjs` : le démarrage lu dans dist/index.html ≤ budget de
  budget-vitesse.json, fr-reste hors démarrage. Rouge sur main (2 058 Ko, pas de fr-reste) ; `--prouve` 2/2.
- `scripts/bancs/francais-differe.cjs` : 14 écrans rendus (Ma journée, Ventes, Bordereaux, Annonces,
  Achats, Messages, Tableau, Stock, Argent, eBay, Republier, E-mails, Factures, Paramètres) : aucun mot du
  texte n'est une clé de fr.js, fr-reste pas téléchargé par Ma journée. `--prouve` (fr-reste servi vide) :
  128 clés brutes vues ⇒ rouge. `CAPTURES=dossier` : captures regardées (Ma journée, Ventes, Argent, Paramètres).
- `audit-morceau-app` : qrcode-generator refusé — rouge sur l'avant (ConnexionQr d'avant), vert ici.
- Audits : passe complète comparée à main (voir le corps de la PR).

## 6. Ce qui reste
1. **La marge sous le budget est mince (21 Ko)** : le prochain gros lot qui grossit App la mangera.
2. **La CSS (313 Ko gzip, 15 % du démarrage)** ne se réduit qu'en découpant App.jsx (les écrans y vivent) —
   chantier `decoupe` / design, pas mécanique.
3. **App.jsx lui-même** (4 Mo avant minification, 42 % du morceau) : les composants rares encore
   statiques (CarteRelais 83 Ko, ModeRelais/ModeDepot — utilisés HORS LIGNE au point relais, donc
   laissés dans App exprès —, PlansSoloPro, SignalerProbleme, AccueilNouveaux…).
4. Vignettes : demander à l'extension une miniature ≥ 310 px (`thumbnails` de Vinted) pour les tuiles.
