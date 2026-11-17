# 17 nov. 2026 — Le scanner en instantané (lot scan-instantane)

Julien (iPhone) : « le scan marche pour les bordereaux, mais il est un peu long et il faut être vraiment très
très proche pour pouvoir scanner… je veux que ce soit beaucoup plus rapide et fluide, un peu en instantané. Et
après quand je vais voir la vente ça prend du temps, ça bug. »

Branche `claude/scan-instantane`. Aucune règle d'identité ne change : le scanner lit un texte, `lireCodeColis` /
`retrouverParSuivi` (src/scanColis.js) décident, par égalité exacte (§5).

## Ce qui a été mesuré (banc `scripts/bancs/scan-instantane.cjs`)

Caméra Chromium nourrie d'une vidéo Y4M portrait 1080×1920 (Chromium la donne en 1080×1080) : étiquette blanche
sur une table, code GÉNÉRÉ (bwip-js) à la forme réelle — Code 128 Mondial Relay (n° de côté à 26 chiffres),
DataMatrix Chronopost (S10), QR (lien de suivi) —, échantillonné à la surface (un module = une fraction de pixel),
flou gaussien, bruit, lignes de « texte ». N° inventés. Chromium sous Linux n'a pas `BarcodeDetector` : l'app y
prend le même chemin que Safari sur iPhone. 390 tactile. Machine partagée très chargée (charge 1,6 à 6,8 par
cœur) : les temps absolus sont gonflés ; les écarts avant/après sont nets.

| mesure | main (avant) | branche (après) |
|---|---|---|
| Code 128 net (2 px/module) : toucher « Scanner » ⇒ fiche | **jamais lu** en 20 s | 1,1 – 1,9 s (caméra comprise) |
| distance, Code 128 26 chiffres : plus petite taille lue | 3,5 px/module | **1,0 – 1,76** px/module |
| distance, DataMatrix | 1,97 px/module | **0,8** (la plus petite servie) |
| distance, QR | 1,57 px/module | **0,8** |
| images analysées / s (étiquette sans code) | 3,7 | 5 – 5,2 (machine chargée) |
| fil de l'écran bloqué pendant la lecture | **418 ms par seconde** (tâches de 482 ms) | **0 – 9 ms/s** |
| « Ouvrir la vente » ⇒ la fiche de la vente à l'écran | 1 582 ms | **455 – 472 ms** |
| la fiche se rouvre (toucher rejoués à 0,7 / 1,6 / 3 s) | **4 ouvertures** | 2 (ouverte, puis devenue celle de la ligne) |

Ordre de grandeur de la distance (Code 128 Mondial Relay, module ≈ 0,5 mm, 1 080 px dans la largeur) :
distance ≈ 36 cm ÷ (px par module). Avant : ≈ 10 cm (« très très proche ») ; après : ≈ 20 à 35 cm sans zoom,
le double avec le zoom 2× (non mesurable au banc : la caméra factice n'a pas de zoom).

## Les causes

1. **Safari n'a pas `BarcodeDetector`** : le lecteur était ZXing en JavaScript, sur le fil de l'écran, avec
   `TRY_HARDER` et huit formats. Chaque image figeait l'écran (≈ 0,4 s), ≈ 4 images par seconde ; et son lecteur
   1D ne lit pas un Code 128 dont les barres tombent entre deux pixels (mesuré hors navigateur sur les mêmes
   images : aucun Code 128 lu, même à 3 px/module, dès que l'étiquette est sur un fond sombre avec du texte).
2. Le lecteur ne se chargeait qu'APRÈS la caméra (CDN), et une pause fixe de 90 ms séparait deux lectures.
3. Pas de zoom : la caméra arrière de l'iPhone est un grand-angle, une étiquette à 30 cm y est petite.
4. « Ouvrir la vente » : l'écran Ventes, défiler (animé), puis un toucher SIMULÉ sur la ligne à 120 ms, rejoué
   à 0,7, 1,6 et 3 s tant que la ligne disait `aria-expanded="false"` — or depuis le 14 nov. le toucher ouvre LA
   fiche (FichePaire), la ligne reste « fermée » : la fiche était rouverte trois fois (« ça bug »). Et toute
   l'app (cachée sous le scanner) se redessinait dans la même tâche que la fiche.

## Ce qui a changé

- `src/lecteurCodes.worker.js` (nouveau) : **zxing-cpp en WebAssembly** (paquet `zxing-wasm` 3.1.7, licence MIT ;
  zxing-cpp Apache-2.0) **dans un worker**. Le `.wasm` (≈ 950 Ko, ≈ 380 Ko compressé) est servi par VRM (même
  origine ; la CSP a déjà `'wasm-unsafe-eval'` et `worker-src 'self'`), chargé à l'ouverture du scanner seulement,
  gardé ensuite. Formats : Code 128, DataMatrix, QR, EAN-13 (la boîte : « pas un n° de suivi »), Code 39, ITF.
- `src/ScannerColis.jsx` : `creerLecteur` = `BarcodeDetector` s'il existe (Android, Mac) ; sinon le worker ;
  sinon ZXing JavaScript comme avant. L'image visée est découpée par `createImageBitmap` (aucune copie de
  pixels sur le fil de l'écran ; sans `OffscreenCanvas` dans le worker, découpe par un canvas). Le lecteur se
  prépare EN MÊME TEMPS que la caméra ; boucle sur `requestVideoFrameCallback`, sans pause ; mise au point
  continue quand la caméra la propose ; `frameRate` 30 demandé. Une zone peut porter `k` : **le milieu du
  viseur agrandi ×2** (lissé) — mesuré : un Code 128 à 1,2–1,8 px/module ne se lit pas tel quel, agrandi oui.
- `src/ScannerRetrouver.jsx` : zones à tour de rôle centre · milieu ×2 · large ; **zoom 2× posé à l'ouverture**
  quand la caméra en a un (Safari 17+, Chrome Android), bouton « 2× / 1× » à côté de la lampe ; le viseur
  devient bleu à l'instant où un code est lu ; « Ouvrir la vente » ouvre **LA fiche de la vente tout de suite**
  avec ce que le scanner sait (N°, transaction, photo, titre, état — identités de CETTE vente), puis Ventes se
  place dessous ; la ligne trouvée, la fiche devient celle de la ligne (son récapitulatif et ses gestes la
  remplissent). L'app dessous est rendue au dessin après la première image de la fiche ; le morceau
  `FichePaire` est préchargé dès qu'une vente est trouvée.
- `src/cibleNotif.js` : `fiche=` dans le lien d'une cible `vente` (forme exacte `vente:vinted:scan-<tx>`, la
  même transaction) ⇒ `depuisFiche` (aucun toucher simulé). `src/App.jsx` (CibleNotif) : la fiche de la ligne
  déjà ouverte ⇒ aucun toucher rejoué (vaut pour toutes les notifications) ; sous une fiche, la liste se
  place sans animation.
- `scripts/audit-scan-colis.cjs` 3f : accepte le lien qui porte `fiche=` (toujours `e.lien`, le chemin des
  notifications).

## Preuves

- Banc `scan-instantane` : vert sur la branche (25 conformes) ; rouge sur main (N jamais lu, O 1 582 ms et
  4 ouvertures, D 128 3,5, DM 1,97, QR 1,57, V 418 ms/s) ; rouge par mutation (voir ci-dessous).
- Les temps ne sont jugés que si la machine respire (charge ≤ 1,5 par cœur), sinon dits (⚠️).
- `audit-scan-colis` 52/52 ; `audit-traduction`, `audit-quoi-de-neuf`, `audit-qr-capture-mr`,
  `audit-inventaire-annuel` verts ; bancs `scan-colis`, `scan-bordereau-vente`, `scan-achat` : voir le PR.
- Captures regardées (390) : la feuille de la vente, la fiche ouverte, le viseur.

## Ce que Julien doit essayer

Ouvrir le scanner sur l'iPhone (après le déploiement : recharger VRM une fois). Le « 2× » est posé tout seul :
viser l'étiquette à 30–40 cm, sans s'approcher. Tout près, toucher « 2× » ⇒ « 1× ». Puis « Ouvrir la vente » :
la fiche doit paraître tout de suite, sans se rouvrir.

## Reste

- Mesurer sur un vrai iPhone (le banc est Chromium sur une machine chargée) ; si Safari refuse `zoom`, le
  bouton n'apparaît pas et rien ne change.
- Le premier rendu de FichePaire (≈ 300 ms sur la machine du banc) domine l'ouverture : à alléger dans le lot
  de la fiche, pas ici.
