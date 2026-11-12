# Bordereaux pour imprimante thermique, personnalisables (11 nov., branche `claude/thermique`)

Demande de Julien : « bordereaux pour imprimante thermique, PERSONNALISABLES en fonction de
l'imprimante ; prendre en compte le tamponnage ; peut-être pas le titre du produit dessus car
visible ». Partie de `origin/claude/revue-colis` (pas de `main`), comme demandé.

## ÉTAT À LA REPRISE (arrêt demandé par Julien via la session principale) — repris le 11 nov. au soir, voir « Reprise » en fin de fichier

### Fait et poussé
- **Règles pures** `src/impression/thermique.js` : réglage `vrm_impression` (`reglageImpression` :
  format `10x15 | 10x10 | 10x15m | dymo4xl | ql62 (continu) | autre (l × h mm)`, marge, encre
  `noir|tel`, contraste, `tamponA4` (défaut N° + titre), `tamponTh` (défaut **N° seul**), `fiche`) ;
  `placementEtiquette` (orientation auto = sens qui donne la plus grande échelle, une seule échelle,
  jamais rogné, agrandi ≤ 25 %, rouleau continu : hauteur suivie + bande 12 mm pour le N°) ;
  `carteEncre` / `boiteEncre` (recadrage sur l'encre, 3 mm de silence, filets de découpe retirés
  au bord, le cadre gardé s'il a son pendant) ; `decouperFeuille` (A4 à 2 ou 4 étiquettes : coupe au
  milieu sur une gouttière, morceaux avec codes ET identiques — sinon pas de coupe) ;
  `fusionnerProches`, `moduleDuCode` (plus fine barre), `MODULE_MIN_MM = 0,25` ; `seuillerNoir`,
  `tramerNoir` ; `zonesAdresse` ; `contenuTampon`.
- **App.jsx** : `vrm_impression` dans SYNC_KEYS ; `poserBordereau(… impression)` → en thermique
  `analyserZone` (pdf.js, 4 px/pt) + `composerEtiquette` + `noircirPage` (300 dpi, image N&B) + codes
  retrouvés sur la page posée + tampon hors codes (+5 mm) et adresses (`bloques`) ; sans place sûre :
  `ajouterFichePreparation` (même papier : N°, titre, taille, photo tramée, emplacement, « à mettre
  DANS le colis ») ou rien (`mode 'aucun'`) si fiche coupée ; mention « Créé par vrm.center » en noir
  5,5 pt seulement autour de l'étiquette. Zone `zoneEtiquette` trop petite (< 40 % de la feuille) ⇒
  découpe par l'encre de la feuille entière. `extrasImpression` (fiche UNIQUE du N°, taille, photo
  lue seulement si la fiche s'imprime, emplacement `ouEstNumero`), `bilanThermique` ; branché dans
  une vente, Tout imprimer (photo de la ligne), facture+bordereau ; Leboncoin passe par
  `annotateAndDownloadBordereau` (aucune extension touchée). Fenêtre de résultat : papier choisi,
  « code trop fin » (ambre), codes pas retrouvés, fiches, « sans N° ».
- **Générateur inventé** `src/impression/bordereauExemple.js` (ITF lisible + QR réel + adresse
  inventée ; mises a4-notice, a4-colonnes, a4-2, a4-4, 10x15, 10x15-couchee, 10x15-plein).
- **Bancs** : `scripts/bancs/_code-impression.cjs` (vrai code extrait) ; `tampon-bordereau.cjs`
  porté (titre caché en thermique, mention noire) **200 verts / 0** ; nouveau
  `scripts/bancs/thermique.cjs` **392 verts / 0** : codes DÉCODÉS à 203 dpi (ITF + jsQR), bonne
  étiquette, rien de rogné, QR carré, ni notice ni fiche destinataire, tampon ≥ 4 mm des codes,
  hors adresse, N° seul / titre / taille / rien, noir pur jugé sur les octets des images, fiche de
  préparation, fiche coupée ⇒ « aucun ». Captures regardées (planches dans le bloc-notes).
- `npm run build` vert (avant les derniers ajustements du module ; à relancer).

### Reste (prochaines étapes exactes)
1. Relancer `npx vite build`, `node scripts/bancs/thermique.cjs`, `tampon-bordereau.cjs`,
   `node scripts/audit-impression.cjs` (il extrait `poserBordereau` & co : ajouter
   `require('./bancs/_code-impression.cjs')` comme dans tampon-bordereau, sinon ReferenceError),
   `audit-colis-trois.cjs`.
2. **Preuves rouges** : `BANC_MUTATION=sansDecoupe|deforme|rogne|gris|titre|sansBloques|sansRecadrage`
   sur `thermique.cjs` (pas encore lancées) ; banc sur l'arbre d'avant (`git archive 74f68fdf`).
3. **UI Paramètres** (PAS FAITE) : `src/ecrans/Reglages.jsx` `ImprimanteSetting` → « Impression des
   bordereaux » : papier (liste `FORMATS_THERMIQUES`, Autre l × h), marges (0–10 mm), encre
   Noir pur/Tel quel + contraste, tampon (`NOMS_TAMPON`, phrase `POURQUOI_TITRE_CACHE`), fiche
   (case) ; écrire `save(CLE_IMPRESSION, …)` ; libellé de ligne `libellePapier`. Aperçu :
   `fabriquerBordereau(PL, qrcode, 'a4-notice')` → `poserBordereau` avec le réglage → `ApercuPdf`.
4. Raccourci dans la feuille Tout imprimer (section « Aperçu … A4 » vers 47848 d'App.jsx) : dire le
   papier et un lien `DEMANDE_REGLAGE_SOUS.id='imprimante'` + `vrm:reglage-sous` + `setTab('settings')`.
5. `choisirTampon` (aperçu de placement) reçoit encore le titre complet : lui passer `contenuTampon`.
6. Fusions : `git merge origin/claude/revue-colis` puis `origin/main` (conflits attendus) ; après
   main, passer les nouveaux textes par `tr()` (`src/i18n/`, 5 langues), ligne `src/nouveautes.js`,
   ligne §9 de CLAUDE.md.

### Pièges
- `_source-app.cjs` remplace les repères `⟦→ ecrans/…⟧` : ne jamais s'en servir comme borne
  d'extraction (d'où la fin = fin du bloc `poserBordereau`).
- En noir pur l'étiquette est une IMAGE : pas de texte à lire ; juger le gris sur les octets, pas
  sur un rendu (le lissage invente du gris).
- Un titre en gras ressemble à un code pour `zonesCodesTampon` : filtre ≥ 8 × 15 mm.
- Une grande étiquette a des bandes blanches en travers : ne la couper que si les morceaux sont
  identiques (taille + codes aux mêmes places).
- Le module mesuré à 4 px/pt est approché (± 1 px) : seuil 0,25 mm prudent, l'écran le DIT.

## Reprise (11 nov., soir) — ce qui a été fait

- **Fusions** : `origin/claude/revue-colis` (propre) puis `origin/main` (un conflit, `historique-divers.md` : les deux côtés gardés). `audit-traduction` C2 : la barre a 9 entrées depuis revue-colis (Colis dans Ventes/Achats) — plancher descendu de 10 à 9 (il ne sert qu'à voir une lecture cassée).
- **Paramètres → Imprimante et bordereaux → « Impression des bordereaux »** (`ImpressionBordereaux`, src/ecrans/Reglages.jsx) : en thermique papier (liste `FORMATS_THERMIQUES`, « Autre » largeur × hauteur bornées 25–300 mm), marge (vide = celle du papier, ≤ 10 mm), encre Noir pur / Tel quel + contraste, tampon (`TAMPONS`, « N° seul » proposé + la phrase « visible par le transporteur »), fiche de préparation (case) ; en A4 le tampon A4 seul. Écrit `vrm_impression` (`save`, SYNC_KEYS). Aperçu : `fabriquerBordereau(…'a4-notice')` (inventé) → `poserBordereau` avec le réglage → `ApercuPdf` par page, + ce qui a été fait (page entière, fiche, rien, code trop fin). Le choix d'imprimante, la ligne de la liste et les aperçus de ses bordereaux nomment le papier choisi.
- **Tout imprimer** : l'aperçu dit « N pages · papier » et le tampon CHOISI (titre seulement s'il l'écrit, « sans tampon » pour Rien) ; « Changer le papier ou le tampon » ferme la feuille et ouvre le réglage (`vrm:aller` `?tab=settings&reglage=imprimante`).
- `choisirTampon` reçoit `thermique` et montre ce que le tampon ÉCRIRA (`contenuTampon`).
- **Textes** par `tr()` : clés `impression.*` (+ `reglages.imprimante.thermique` avec `{papier}`) dans les 5 langues ; `ImpressionBordereaux` et `nomPapier` ajoutés à MIGRES d'`audit-traduction`.
- **audit-impression** : exécute le vrai bloc (`_code-impression.cjs`) + les règles + `typeBordereau` ; seul pdf.js est neutre ; mutation 3 bis (la page garde la taille de l'étiquette).
- **Banc thermique** : cas « blanc collé au QR » (`fabriquerBordereau(…, { blancQr: 30 })`) — un blanc assez grand pour le tampon seulement sans la garde de 5 mm autour des codes : c'est lui qui fait rougir `sansBloques` (sans lui, la mutation restait verte : sur les autres formes le blanc cherché évite déjà les codes).
- **Banc imprimante** : la section (N° seul par défaut, Dymo 4XL écrit, aperçu dessiné au format 104 × 159, tampon thermique réglé à part de l'A4, A4 sans papier thermique), 390 et 1512 px.
- Quoi de neuf : `impression-thermique`.
- **Audits corrigés par ce lot** : `audit-secrets` (l'adresse inventée « 12 rue Imaginaire » ⇒ « 12 allée Imaginaire »), `audit-variables` (`globalThis.createImageBitmap`), `audit-vendeur-generaliste` (titre d'exemple « Veste en jean bleue », taille M), `audit-selection-bordereaux` (juge `deja` partagé, accepte le paramètre `thermique`).
- **Banc imprimante** : rouge AVANT ce lot (le Chromium du banc parle anglais ⇒ l'app en anglais depuis la traduction, « Imprimante et bordereaux » introuvable) — le banc pose `vrm_langue = fr` et ouvre `?reglage=imprimante`. Tampon en LISTE (4 pastilles coupées à 390 px, vu sur la capture).

### Preuves (11 nov., soir)
- `thermique.cjs` 403 verts / 0 ; mutations : sansDecoupe 9 rouges, deforme 34, rogne 13, gris 23, titre 17, sansBloques 1 (le cas « blanc collé au QR »), sansRecadrage 3.
- `tampon-bordereau.cjs` 199 / 0 ; `colis-a-leur-place.cjs` 184 / 0 ; `imprimante.cjs` 52 / 0 (390 et 1512 px, captures regardées).
- `audit-impression` 36 verts, `--prouve` 7 rouges ; `audit-traduction` 44 / 0, `--prouve` 12/12.
- Passe complète (`lancer-audits`, 2 en parallèle) : 498 audits, 27 rouges dont 4 corrigés ici ; les 23 autres sont rouges aussi sur `origin/main` ou `origin/claude/revue-colis` (ex. `audit-signalement` « colis », `audit-vente-verification` V4, `audit-benefice` `MeilleuresSources` déclaré deux fois, `audit-safari` `navigator.share` ligne 3384, `audit-chrome-en-dur` App.jsx:42054) — pas de ce lot.
- Planches des PDF rendus (10×15, Dymo, Brother 62 continu, 10×10, Autre, 4 par page, N° + titre / + taille / rien, encre telle quelle, fiche de préparation) : regardées.
