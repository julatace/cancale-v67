# 21 nov. 2026 — « Relier » plus facile, et la carte du code de retrait en billet

Branche `claude/relier-code`, partie de `claude/integration-21nov` (d1f5bf41a) + fusion de `claude/ventes-lisibles`
(56795cc24, pas encore dans l'intégration : la feuille `LierAchatGrille.jsx` en vient ; mêmes commits, l'intégrateur n'aura
rien à refaire). Aucun fichier de `vinted-sync-extension/`.

## A. « Rends relier les achats à la vente / à l'annonce plus facile »

Règle intouchable gardée (§5) : c'est TOUJOURS son toucher qui relie (« Relier » choisit, « Oui » écrit). AUCUNE règle neuve
de ressemblance : tout vient de la règle pondérée existante (`src/liaisonAchat.js` : `propositionsArticle` = la « très
probable », `pistesArticle` = les autres, l'affectation globale `affecterPropositions`). Les écritures sont celles d'avant
(`relierAchat`, `relierAchatVente`, `relierAchatAnnonce`, `ecritureRelierAchat`, `refuserLiaison`).

- **`src/relierPropositions.js`** (pur, n'écrit rien) :
  - `rangerPropositions` : LA meilleure = la très probable ; sinon la 1re piste SEULEMENT si le moteur ne l'a pas dite
    ambiguë, qu'elle devance la suivante de `ECART_TRES_PROBABLE` (le même écart que l'affectation) ET qu'aucun achat CACHÉ
    (pas encore arrivé, pris) ne lui ressemble autant — la vraie cachée ne fait jamais « promouvoir » la suivante.
    Égalité ⇒ aucune meilleure, « À égalité : regarde la photo avant de relier ». « Pas celle-ci » (refus) écarté.
  - `raisonsProposition` : la raison en morceaux (même modèle « … » · taille · couleur · même photo · arrivé / retiré le … ·
    payé moins que vendu — jamais pour un lot).
  - `propositionsPourAchat` : l'affectation globale lue dans l'autre sens (depuis un achat), mêmes gardes.
  - `etatLot` : « Lot · k/n reliés ».
- **Feuille « Lier à un achat »** (`src/natif/ecrans/LierAchatGrille.jsx`, ouverte par « Relier » d'une vente) : en tête la
  carte « Meilleure proposition » (photo 72, titre, raison en petit gris, prix, date de commande, étiquette « Très probable »
  vert pastel ou « À vérifier » gris), « Pas celle-ci » et « Relier » (≥ 44 px) ; puis « Autres suggestions » (2–3 rangées
  fines avec leur raison) ; puis « Tous tes achats arrivés » (la grille d'avant). Un toucher sur une proposition = la même
  confirmation « Relier à cet achat ? Non · Oui » que la grille.
- **Relier en série** : Ventes ▸ « ⋯ » ▸ « Relier en série · N sans achat » (file `fileVendus`, 12 mois) ; Annonces ▸
  Actions ▸ « Relier mes achats en série » (file `fileAchat`, ouvre l'instance « Compléter » avec le sujet `relier-serie`).
  La MÊME feuille, enchaînée : « 3 sur 18 » + barre, « Passer » (rien écrit), « Pas celle-ci », « Relier » + « Oui » ⇒ la
  suivante tout de suite, le geste reste annulable par sa pilule (« Annuler »). Fermer la feuille arrête la série.
- **Le geste inverse** (`src/natif/ecrans/LierArticleGrille.jsx`) : Achats ▸ « ⋯ » d'un achat arrivé (liste du téléphone) et
  menu de rangée du tableau de l'ordinateur ▸ « Relier à une vente / annonce » : l'achat en haut, la meilleure vente /
  annonce proposée, les autres, puis la grille de ses ventes (toutes, sans borne) et annonces en ligne SANS achat, vendues ou
  mises en ligne APRÈS l'achat (date inconnue ⇒ gardée), segments Tout · Ventes · Annonces, recherche. « Relier achats et
  ventes » (le mode glisser) reste en lien dans l'en-tête.
- **Un lot** : il reste proposé jusqu'à son nombre (`achatDisponible`) ; le menu d'un achat lot partiellement relié offre
  encore « Relier à… » ; la feuille inverse reste ouverte après un lien (« Lot · 1 sur 3 relié(s) : choisis l'article
  suivant ») ; le prix de CHAQUE article est demandé par l'écriture d'avant, jamais divisé (§2.5).
- `audit-relier-glisser` T4 suit la feuille inverse (qui porte « Glisser » vers le mode d'avant).

## B. Le colis à retirer : un billet compact (trois passes le 21 nov.)

Julien : « améliore le design du carré où il y a le code de retrait », puis « enlève Copier sur les retraits », puis « tu peux faire
mieux sur le visuel du colis à retirer ». `src/natif/RetraitsPoints.jsx` + `src/natif/retraits.css` (fin du fichier). Aucune règle
des colis touchée.
- **Bandeau du point, une fois** : la teinte douce de son transporteur (`data-rp-teinte`), logo sur pastille blanche, nom du point,
  « Chronopost · comptoir » (la phrase « Comptoir · code à donner… » reste pour le lecteur d'écran), l'échéance à droite « à retirer
  avant le 25 nov. » (neutre ; AMBRE à moins de 2 j ; date tirée de la limite LUE seulement ; « délai dépassé » sinon), dessous
  adresse · horaires et « Itinéraire ».
- **Un billet par colis**, compact (188–2xx px au téléphone, banc ≤ 240), UN seul niveau de carte : vignette 48 (la PHOTO de la paire,
  place réservée ; « Contenu pas encore lu » devient une petite ligne), titre complet sur 2 lignes, N° en plaque, prix ; la zone du
  CODE sur BLANC même en sombre : « Code de retrait », le code en chasse fixe 32–38 px, encre noire, groupé (« 978 216 », texte
  entier dans le DOM), le QR à droite (112 px, 160 à l'ordinateur), une petite icône « plein écran » (44 px) dans son coin ; toucher
  la zone = plein écran pour le guichet (`openQrView`, le geste d'avant) ; la frise COMPACTE au pied : cinq traits (franchis en encre,
  courant en vert sapin, jamais de bleu) + « Au point · 21 nov. » ; le nom et la date de chaque étape restent pour le lecteur d'écran.
- **Plus de « Copier »** (retiré à sa demande ; `retraits-visuel` K exige de nouveau son absence ; `retrait-billet` le vérifie aussi
  au guichet).
- **Deux dessins** : B (défaut) une carte par point, billets séparés par une ligne de coupe à encoches ; A le bandeau posé sur la
  page, chaque billet sa carte (`localStorage.vrm_banc_retrait_variante = 'a'`, réservé aux captures de comparaison). B est gardé :
  plus « billet / Wallet », l'en-tête et ses colis forment un seul objet.
- ⚠️ Le code est rendu en `<code>` : la règle globale `n-anciens` (`html body :where(*):not(code, pre…) { font-family … !important }`)
  écrase toute police sur les autres balises.
- **Bug corrigé** : le lien d'évitement « Aller au contenu » se montrait en haut de l'écran après un focus donné par le code (il
  s'affichait sur `:focus`) ; il ne paraît plus qu'au focus CLAVIER (`:focus-visible`), sinon rogné et transparent
  (`src/design/accessibilite.css`).

## Preuves

- `node scripts/audit-relier-facile.cjs` : 24 verts (meilleure + raisons ; 50 achats identiques ⇒ aucune meilleure,
  égalité dite ; la vraie cachée ne promeut pas la suivante ; « Pas celle-ci » ; 50 ventes identiques vues d'un achat ⇒ aucune
  meilleure ; lot k/n ; `onRelier` n'est appelé que par « Oui » dans les deux feuilles ; la série n'avance qu'après
  l'écriture ; entrées Ventes / Annonces / Achats ; écritures d'avant). `--prouve` : 9/9 mutations rouges.
- Banc `scripts/bancs/relier-facile.cjs` (base inventée : un titre de modèle distinct par vente et SON achat arrivé, une vente
  sur cinq à 3 achats identiques, une sur sept servie par un lot de 2) : 390/1512 clair/sombre **84 verts** ; sur le build
  d'avant (`BANC_DIST`, 390) : rouge (aucune meilleure, aucun « Relier »).
- Banc `scripts/bancs/retrait-billet.cjs` (3 colis inventés reliés à leurs achats, 2 au même point, un VRAI QR du code par
  qrcode-generator) : code, QR, bandeau, photo, un seul niveau, hauteur ≤ 240, aucun bleu, aucun « Copier », plein écran — voir le
  compte rendu de fin pour les chiffres ; sur le build d'avant : rouge.
- `audit-identite`, `audit-traduction`, `audit-quoi-de-neuf`, `audit-icones`, `audit-tdz`, `audit-variables`,
  `audit-relier-glisser` (75), `audit-liaison-achat` (37), `audit-retraits-visuel`, `audit-retraits-parfaits`,
  `audit-pluriels-croises` verts. `audit-boutons-natifs` rouge AUSSI avant (AchatsTableau ligne 30, Reglages) : pas touché.
- Bancs existants : `ventes-lisibles` 47 verts, `relier-achats` 68, `annonces-dressing` 80, `relais-prevision` 52,
  `retraits-visuel` 240 (après le QR porté à 160 px à l'ordinateur : il exige ≥ 150).
- Build vert. Captures regardées (390 d'abord) : scratchpad de la session, `rc/shots`, `rc/billet`, `rc/relais`.

## Pas fait / limites

- La série depuis Annonces passe par l'instance « Compléter » (l'écran Annonces n'a pas la feuille) ; la file est celle des
  annonces Vinted numérotées en ligne sans achat (`fileAchat`), pas les autres sites.
- La feuille inverse ne propose pas les ventes Leboncoin / eBay / Vestiaire (leur lien passe par « Relier achats et ventes »).
- Au mode « Plus de choix » (feuille d'avant), la tête de série « 3 sur 18 » n'est pas montrée (la série continue au lien).

## Geste de Julien
Aucun.
