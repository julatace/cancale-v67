# 17 nov. 2026 — Fiabilité et vitesse (branche `claude/fiabilite-vitesse`)

Julien : « la fiabilité, la fluidité, l'affichage beaucoup plus rapide, tout doit être vraiment parfait ».
Aucune règle métier touchée (N°, preuve de vente, compta, colis). Aucun style changé. Base de
production : lecture seule (projections scalaires). Tout est mesuré sur la base INVENTÉE des bancs
(`scripts/bancs/_base-volume.cjs`), jamais sur la vraie.

## 1. La mesure d'avant (main `1a4eb65`)

### Le JavaScript du démarrage
`budget-vitesse` (Ma journée, appareil neuf, 390 px) : **2 344 Ko** de JS+CSS compressés, budget 1 966 ⇒ rouge (+19 %).
Le morceau `App` seul : **1 892 Ko** compressés (5,7 Mo minifiés). Composition (sourcemap, `attrib.cjs` du scratchpad) :

| part | minifié | remarque |
|---|---|---|
| `Comptabilite` (App.jsx) | 979 Ko | le moteur de Ma journée, Ventes, Achats, Annonces : nécessaire au premier écran |
| `AppCoeur` (App.jsx) | 201 Ko | la coque : nécessaire |
| **pdf-lib + pako + polices** | ≈ 1,1 Mo rendus, **≈ 183 Ko compressés** | **importé partout `await import('pdf-lib')`… et pourtant DANS App** |
| français (`i18n/langues/fr*.js`) | ≈ 330 Ko | voir « ce qui reste » |
| ~1 000 petits modules | le reste | dont ~30 blocs et feuilles rares importés en statique |

**Pourquoi pdf-lib était dans App** : un seul chemin statique suffit à Rollup —
`App.jsx → api/_lib/transporteur-anciens.js (constantes) → transporteur-pdf.js → texte-pdf.js → pdf-lib`.
Le module n'utilisait pdf-lib que dans `transporteurDuPdf` (async).

La feuille de style App : 331 Ko compressés (2,3 Mo) — domaine du chantier design (`claude/design-v2`), pas touchée.

### Le temps jusqu'au premier écran utile
- `vitesse.cjs VITESSE_PREMIER` (390 tactile, processeur ×4, 4G lente 1,6 Mb/s) : coque dessinée
  **16,1 – 17,7 s**, premier écran utile **21,9 – 27,5 s** (5 passages, deux séries).
- `vitesse-volume.cjs` (390, ×4, 4G rapide 9 Mb/s, 20 000 ventes, médiane de 3, A/B alternés) :
  Ma journée prête **9 977 ms** (tâches longues 5 470 ms), Ventes **10 775 ms**.

### Le défilement d'une liste de 1 000 ventes (Ventes, 390, ×4)
Banc `_mesure-demarrage.cjs` + `EVAL` (script `defil.js`/`loaf.js` du scratchpad), 40–80 pas de défilement :
- **aucune ligne de la liste n'est re-rendue en défilant** (mesure par fibre, à la manière des outils React :
  seules les `PhotoVinted` qui entrent à l'écran — 353 rendus — et `PhotosBloquees`) ; une première mesure
  disait l'inverse : elle comptait les drapeaux restés sur des fibres non touchées (piège noté) ;
- mais 49–61 « longues images » (LoAF) pour ~22 s au ×4 : scripts 13–15 s (dont le travail React des photos,
  ≈ 4–8 s), mise en page 6–7 s (7 400 nœuds, CSS de verre), et `MAIN.onscroll` 2,5–5,5 s qui n'est que la
  mise en page forcée par la lecture de `scrollTop` (MemoireDefilement) après chaque changement d'image.
  Le banc refuse les photos (hôtes externes coupés) : chaque vignette échoue, ce qui gonfle ce chiffre.

### Les lectures de la base
`budget-vitesse` Ma journée : 149 lectures, 2 913 Ko, 15 en double, 0 entière ; **une NOUVELLE lecture en double** :
`app_data?id=eq.vrm_avis_bas&select=a:data->alertes` (×2) — Ma journée (`lireAvisBas`) et la santé des comptes
(`SanteComptes.jsx`) lisaient la même adresse à quelques secondes d'écart (hors de la fenêtre de 2 s du partage).
Aucun `select=data` sur une ligne lourde.

### Les erreurs de production (lecture seule)
- Vercel : **aucune erreur d'exécution sur 7 jours** (`get_runtime_errors`) ; journaux d'une heure vides (plan Hobby).
- Journal des plantages de l'app (`app_data` `plantage_*`, 24 lignes en tout, projections) — depuis le 13 nov. :
  - **16 nov. ×2** : « CSP connect-src ← https://p.vintedgo.com » et « … ← https://avisageng-colis-webexternal.pickup-services.com »
    (Achats). Cause : `garderQrLocal` copiait le QR d'un colis par `fetch` vers l'hôte du transporteur ; la
    politique de la page le refuse à CHAQUE affichage, rien n'était jamais gardé. **Corrigé.**
  - 12 nov. « Cannot read properties of undefined (reading 'default') », 11 et 10 nov. `e.FactureVente` /
    `e.VintedAccounts` : la panne des morceaux périmés, corrigée les 14-15 nov. (`chargementSur.js`) — plus revue depuis.
  - 5 nov. `kagi.executeCallback` ×9 : extension du navigateur Kagi/Orion, pas VRM.

## 2. Ce qui a changé

1. **pdf-lib hors du morceau App** — `api/_lib/transporteur-pdf.js` charge `texte-pdf.js` à la demande dans
   `transporteurDuPdf` (même décision, même « illisible » si le chargement échoue ; le serveur faisait déjà
   ainsi dans `transporteurs-lecture.js`). App : 1 892 → 1 709 Ko compressés. Audits transporteur-pdf,
   transporteurs-parfaits, logos-bordereaux, retour-parfait : verts.
2. **30 blocs et feuilles rares à la demande** (App.jsx, une ligne chacun, à la place de leur `import`) :
   `aLaDemandeFeuille` (pastille « Ouverture… ») pour les feuilles (configuration de départ, bienvenue,
   calculette, coller les prix, impression, aperçu, lien Vestiaire, baisses conseillées, créer sur Vinted,
   parcours d'arrivée), `aLaDemandeDiscret` (rien pendant le chargement) pour les blocs posés dans un écran
   (litiges, Mondial Relay, comparaison des comptes, historique d'un article, revente du modèle, où vendre,
   modèles de description, Leboncoin diagnostic, SMS, autres versions, achats en double, reçus, à compléter,
   synchronisation, qui dort, quoi republier, vues de ventes, photo du carton), et l'écran Ma semaine.
   **Aucun bloc de Ma journée au démarrage** (vérifié usage par usage). App : 1 709 → **1 636 Ko**.
3. **`vrm_avis_bas` lue une fois** pour Ma journée et la santé des comptes (`src/lectureAvisBas.js` : copie de
   60 s au plus, jamais un échec gardé, oubliée sur `vrm:ext`).
4. **QR et CSP** : `garderQrLocal` ne lit plus qu'une adresse permise par `connect-src` (même origine, base).

## 3. Après (même bancs, même machine)

| mesure | avant (main) | après |
|---|---|---|
| JS+CSS au démarrage (budget-vitesse, Ma journée neuf) | 2 344 Ko | **2 087 Ko** (−257 Ko, −11 %) ; budget 1 966 : encore +6 % |
| morceau App compressé | 1 892 Ko | **1 636 Ko** (−13,5 %) |
| coque dessinée, 4G lente ×4 (VITESSE_PREMIER) | 16,1 / 16,5 / 17,4 / 16,9 / 17,7 s | **15,4 / 15,1 / 15,2 s** (≈ −1 à −2 s) |
| premier écran utile, 4G lente ×4 | 21,9 – 27,5 s | 21,8 – 22,9 s (dans le bruit : ce sont les lectures qui dominent) |
| Ma journée prête, 4G rapide ×4, 20 000 ventes (médiane) | 9 977 ms | 10 246 ms (bruit : 250 Ko à 9 Mb/s ≈ 0,2 s) |
| lectures en double nouvelles (budget-vitesse) | `vrm_avis_bas` ×2 | aucune |
| QR de colis refusés par la CSP | à chaque affichage | 0 |

## 4. Les preuves
- `scripts/audit-morceau-app.cjs` : suit le graphe des imports STATIQUES de src/App.jsx (Babel, sans build) —
  ni pdf-lib/pako/three/maplibre/jsqr, ni les 25 modules rendus à la demande. Rouge sur main (2), vert ici,
  `--prouve` 4/4 mutations rouges.
- `scripts/audit-avis-bas-partage.cjs` : exécute la lecture partagée (une lecture pour deux, échec jamais
  gardé, `vrm:ext`, durée) — rouge sur main (3), `--prouve` 5/5.
- `scripts/audit-qr-csp.cjs` : exécute la garde des QR — rouge sur main (3), `--prouve` 3/3.
- `budget-vitesse` (Ma journée) : la lecture en double a disparu ; le JS reste rouge de 121 Ko.
- 47 audits touchés ou voisins : aucun rouge nouveau par rapport à main (vendeur-generaliste et
  vocabulaire-article rouges des deux côtés, à l'identique).

## 5. Ce qui reste (par gain attendu)
1. **Le JS du démarrage : 121 Ko pour passer sous 1 966.** Pistes mesurées : le français des écrans à la
   demande (`fr/compta.js` 48 Ko bruts — 2 clés seulement lues hors de Compta —, `fr/stats.js` 17 Ko,
   `fr/stock.js` 12 Ko, `fr/ebaytableau.js` 13 Ko : ≈ 30 Ko compressés) — demande de toucher `fr.js`, que
   22 audits lisent comme dictionnaire complet ; la feuille de style App (331 Ko compressés), au chantier design ;
   `Comptabilite` (295 Ko compressés) ne se découpe pas mécaniquement.
2. **Le défilement** : pas de re-rendu des lignes ; le coût est la mise en page et la peinture (7 400 nœuds,
   verre). `content-visibility: auto` sur les lignes hors écran est la piste la plus forte — c'est du CSS :
   à faire avec le chantier design. Servir de vraies vignettes au banc avant de conclure.
3. Les lectures : 149 au démarrage d'un appareil neuf, 15 en double permises (budget), à réduire une par une.
