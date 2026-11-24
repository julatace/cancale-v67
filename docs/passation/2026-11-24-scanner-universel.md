# 24 nov. 2026 — Scanner universel (`claude/scanner-universel`)

Julien (choisi le 24 nov.) : « UN bouton scanner. Je vise n'importe quoi (un bordereau, un n° de suivi, le QR d'un
retrait, l'étiquette N° d'un carton) et VRM ouvre directement la bonne chose : la vente, le colis, l'achat, la paire. »

Branche partie de `origin/main`, avec `origin/claude/style-clair` (#1326) et `origin/claude/scan-achat` (#1317, même
moteur : `src/ScannerRetrouver.jsx`) fusionnés. PR à fusionner APRÈS #1326 et #1317.

## Ce qui existait déjà (réutilisé, pas refait)
- La caméra et le lecteur : `useLectureCamera` / `creerLecteur` (src/ScannerColis.jsx) — BarcodeDetector, sinon zxing-cpp
  en WebAssembly dans un worker (#1248), sinon ZXing JS ; lampe, zoom 2×, caméra coupée en sortant. **Aucun 2e moteur.**
- Le scanner « Retrouver un colis » (src/ScannerRetrouver.jsx) : n° de suivi ⇒ vente / achat / retour (#1239 : le grand
  code d'une étiquette cherché dans le texte des étiquettes), fiche d'achat avec son N° et le geste (#1317).
- Ses entrées : loupe (`data-recherche-scanner`), disque, Aujourd'hui, Ventes, Achats, la douchette. Toutes passent par
  `ouvrirRetrouver` ⇒ le MÊME scanner, qui devient universel.

## La règle (src/scanUniversel.js, pure)
`reconnaitre(texte, { enregistrements, regles, camera })` — identités EXACTES seulement (§5), toutes réunies :
1. n° de suivi (`lireCodeColis` + `retrouverParSuivi`, formes déjà connues : Mondial Relay, 26 chiffres « 55/56… »,
   S10/Chronopost à clé, Colissimo, UPS, Vinted Go, GeoLabel, liens de suivi en QR) ;
2. n° de transaction (9 à 13 chiffres) ⇒ `v:{tx}` ou `a:{tx}` à l'égalité ;
3. code de retrait (≥ 4 caractères, sans espaces/casse) ⇒ le colis qui porte CE code ;
4. N° VRM : « 124 », « N°124 », « #124 », « VRM-124 », « B125 » (le texte ENTIER) ⇒ la paire de CETTE clé (`cleNum` DE
   L'APP, donné par la source). **Coupure du 11 oct. (013)** : une étiquette ne dit pas quand elle a été écrite —
   « 230 » propose la 230 ET la B230 quand les deux existent ; « B230 » ne désigne que B230 ; un SKU « VRM-230 » pareil ;
5. EAN-13 / UPC-A (clé GS1 vérifiée) = la boîte : **jamais une identité**. Lu par la caméra ⇒ « Code d'une boîte »,
   rien n'est cherché, seulement « Chercher ». Tapé : seule une transaction EXACTE peut répondre, jamais une paire.
Une ⇒ elle ; plusieurs ⇒ la liste (son toucher) ; aucune ⇒ « inconnu » + le texte lu + « Chercher ».

Changement assumé : avant, la caméra ne cherchait QUE des n° de suivi (et les étiquettes) ; transaction et code de
retrait n'étaient acceptés que tapés. Le scanner universel les accepte aussi lus, toujours à l'égalité exacte.
L'arrivée (`mode: 'arrivee'`) n'a pas changé.

La source des paires (src/App.jsx, `enregistrerSourceColis('paires')`) : un enregistrement par N° SERVI
(`vinted_annonce_numeros`, `vrm_fiches_neuves` non retirées, pool `vinted_used_numeros`), titre et photo pour
l'affichage seulement ; elle passe aussi `regles: { cleNum, archive: archiveNumeros() }`. Nuage pas lu ⇒ pas prête.

## L'écran
- **Entrées** : nouvelle icône Scanner dans la barre du haut du téléphone (`data-n-tete-scanner`), celle du champ de
  recherche (téléphone et ordinateur). Entrées universelles = `tete`, `loupe`, `disque`, `journee`.
- **Retour immédiat** : vibration courte (Android ; l'iPhone n'a pas l'API), bip, le code lu affiché 1 s avec ce qu'il
  est (« Mondial Relay », « Transaction », « N° »…), puis **ouverture directe** (vente ⇒ Ventes sur sa ligne et sa fiche,
  paire ⇒ `vrm:fiche-paire`, colis/retour ⇒ leur lien). Un toucher sur la feuille ou « Rester ici » l'arrête.
  Pas d'ouverture seule pour un ACHAT : la fiche du scanner (#1317 : son N°, sa case, le geste) EST la destination.
  Les boutons « Retrouver » de Ventes/Achats et la douchette gardent la fiche à l'écran (comme avant).
- **Rafale** (bureau de poste) : bouton à gauche de la lampe ; chaque résultat s'ajoute à une liste, la caméra
  continue, un même code une fois ; toucher une ligne l'ouvre. Réglage gardé sur l'appareil (`vrm_scan_rafale`).
- **Inconnu** lu par la caméra : « Inconnu · code » + « Chercher », sans bloquer la caméra (un 2e code d'étiquette ne
  doit pas arrêter le scan). Tapé : la feuille, avec « Chercher ».
- **Couleurs** : plus d'ambre dans le scanner (décision du 23 nov.) — « à faire » = gris clair + ardoise + gras.
  Textes par `tr()` (fr, en, es, it, de : `scan.u.*`, `scan.r.sorte.paire`, `scan.r.ouvrir.paire`).

## Preuves
- `node scripts/audit-scanner-universel.cjs` : 37 verts (50 ventes / 50 achats / 50 paires au même titre ; chaque
  sorte de code ⇒ la bonne fiche ; deux ⇒ la question ; 200 boîtes ⇒ 200 « boîte » ; coupure 230/B230 ; « 12 » ≠ 124 ;
  titre ⇒ rien). `--prouve` : 9 mutations rougissent (N° partiel, titre, première des deux, EAN cherché, fin d'EAN lue
  comme N°, plus de B230, transaction tronquée, morceau de code, scanner sans la règle). Sur `origin/main` : rouge
  (la règle n'existe pas).
- `scripts/bancs/scanner-universel.cjs` (fausse caméra : Code 128, QR, EAN-13 générés par bwip-js, lus par le vrai
  lecteur de l'app) — voir « Résultats du banc » ci-dessous.
- Audits voisins : audit-scan-achat-suite 22/22, audit-scan-colis 52/52 (3e suit désormais `reconnaitre`),
  audit-arrivee-scan 44/44, audit-traduction, audit-icones, audit-quoi-de-neuf verts. `npm run build` vert.

## Résultats du banc
(complété après exécution)

## Geste de Julien
Aucun.
