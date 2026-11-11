# Bordereaux pour imprimante thermique, personnalisables (11 nov., branche `claude/thermique`)

Demande de Julien : « bordereaux pour imprimante thermique, PERSONNALISABLES en fonction de
l'imprimante ; prendre en compte le tamponnage ; peut-être pas le titre du produit dessus car
visible ». Partie de `origin/claude/revue-colis` (pas de `main`), comme demandé.

## ÉTAT À LA REPRISE (arrêt demandé par Julien via la session principale)

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
