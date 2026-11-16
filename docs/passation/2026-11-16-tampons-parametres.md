# 16 nov. 2026 — Les tampons des bordereaux : un réglage, l'aperçu avant impression, la mention au-dessus du QR

Branche `claude/tampons-parametres` (depuis `origin/main` du 16 nov.).

## Les demandes de Julien (mot pour mot, dans l'ordre ; les dernières priment)

1. « Je veux que tu améliores le processus de tamponnage pour que l'on puisse simplement y modifier tous les
   tamponnages ; je veux que dans un onglet dans les paramètres l'app montre à l'utilisateur tous les différents
   types/formats de bordereaux et où les tamponnages sont placés sur chaque bordereau ; tu dois tout faire parfaitement. »
2. « le Créé par vrm.center, c'est mal placé » ; « mets-le en dessous de l'adresse de livraison, je veux que ça soit au
   milieu sur le bordereau » ; « là où est le QR code » ; **DÉCISION FINALE** : « ou au-dessus du QR code, comme ça même
   si on met du scotch on le voit ».
3. « c'est pas mal, mais je ne peux pas le modifier juste visuellement ; je veux vraiment un visuel avec TOUS les
   bordereaux, que je peux modifier si jamais le tamponnage n'est pas au bon endroit ».
4. **PRÉCISION QUI PRIME** : « quand j'ai des bordereaux à imprimer, je sélectionne ce que je veux imprimer, et après ça
   m'ouvre une vignette avec un visuel un peu éloigné du bordereau, et le N° / le tamponnage je peux le régler là où je
   veux ; et quand je touche Imprimer, les réglages sont appliqués aux bordereaux ».

## 1. Inventaire (avant de coder) — ce que VRM tamponnait, et où

**UN chemin** pour toutes les impressions de l'app : `tamponnerBordereau` (App.jsx, « LE TAMPON DU BORDEREAU »), appelé par
`poserBordereau` (Tout imprimer / « Imprimer (N) », une vente, Leboncoin, Vestiaire, Stock), par le retour d'achat
(« RETOUR · … ») et par l'aide de l'équipe (`imprimerBordereauEquipe`). Le tamponnage serveur des e-mails
(`api/_lib/stamp.js`) n'est lu par personne (récit `2026-11-11-tampon-vrm.md`) ; l'extension ne tamponne pas (le PDF
Leboncoin passe par `pdfBordereauLbc`, lecture seule, puis par l'app). **eBay** : VRM n'imprime pas l'étiquette (eBay la
fournit, §2.8) — dit dans la galerie, rien à tamponner.

| type (le réglage les distingue) | reconnu par | forme d'exemple (inventée) |
|---|---|---|
| Mondial Relay · InPost | `typeBordereau` (mots, créateur) | A4 debout, notice en haut, étiquette 10×15 en bas |
| Relais Colis | « relais colis » | 150×100 couchée |
| Chronopost · Shop2Shop | « chronopost/shop2shop » (avant Colissimo) | A4 couchée, fiche à gauche, étiquette à droite |
| Colissimo | « colissimo » | 10×15 (la page est l'étiquette) |
| Vinted Go | « vinted go » | A4 notice + étiquette |
| UPS · DPD | `\bups\b` · `\bdpd\b` | 10×15 |
| International (Hermes, An Post, GLS) | mots, ou objet 100×150 posé | A4 à deux étiquettes côte à côte |
| Leboncoin | la plateforme (`site`) | A4 notice + étiquette Mondial Relay |
| Vestiaire Collective | la plateforme (`site`) | Chronopost en A4 couchée, /Rotate 270 |
| Retour (achat renvoyé) | le retour (`retour`) | A4 notice + étiquette, « RETOUR · … » |

Supports : **A4** (la page telle quelle), **4 par page** (les étiquettes isolées comme en thermique, rangées par quatre —
`planche4.js`), chaque papier **thermique** (`FORMATS_THERMIQUES` : 10×15, 10×10, 100×150 avec marge, Dymo 4XL,
Brother QL 62 mm continu, « Autre »).

**Placement d'avant** : le cartouche (N°, titre selon `vrm_impression.tamponA4/Th`) dans la PREMIÈRE zone blanche trouvée
sur le rendu (encre < 200, marges 5 × 3,5 mm), en thermique hors codes (+5 mm) et adresses ; sans place : fiche colis
(A4) ou fiche de préparation (thermique). Place à la main par forme (`vrm_tampon_positions`, feuille « Place du tampon »),
posée même sur un code (« rien n'est refusé »). La mention « Créé par vrm.center » : 6,5 pt gris 62 %, depuis le coin
**bas-droit** de la zone libre la plus basse, ≥ 25 mm du N°, **hors de l'étiquette à découper**, jamais sur une page
10×15 ni en thermique sauf dans le blanc AUTOUR de l'étiquette posée — c'est pourquoi elle tombait n'importe où (planche
« avant » ci-dessous), ou nulle part sur les 10×15.

## 2. Ce qui est fait

### Un seul réglage, toutes les impressions — `vrm_tampons` (src/impression/tampons.js, pur)
- `{ a4, th }` : le contenu « pour tous » (cases N° · titre · taille · « Créé par vrm.center ») en A4 et en thermique ;
  `texte` / `texteMention` (S 0,8 · M 1 · L 1,25) ; `place` (auto · coins · haut · bas) ; `placeMention` (`qr` = au-dessus du
  QR, bas, coins) ; `types[type]` : l'exception « seulement Mondial Relay » ; `formes[forme] = { n, m }` : les places
  posées à la main (fractions de la page affichée), par forme (type · format · sens [· tourné] [· thermique]).
- **Migration** : tant que `vrm_tampons` n'a jamais été écrit, `reglageTampons(null, { impression, positions })` reprend
  TELS QUELS `vrm_impression.tamponA4/Th` et `vrm_tampon_positions` (la place Chronopost tourné suit aussi Vestiaire).
- Lu par `reglageTamponsChoisi()` à CHAQUE impression : `poserBordereau` (A4 et thermique, Tout imprimer, une vente,
  Leboncoin, Vestiaire), le retour d'achat, l'aide de l'équipe (`tamponPourPage`) ; écrit par l'onglet, la liste courte
  « Tampon » de Paramètres → Impression (même source), « Toujours ici » de la feuille « Place du tampon », l'aperçu
  avant impression. SYNC_KEYS. L'empreinte d'un PDF préparé d'avance le compte (un changement ⇒ PDF refait).
- **Le RETOUR reste « RETOUR »** : N° et titre forcés, quelles que soient les cases.

### La mention à sa place (décision finale de Julien)
`placerMentionDefaut` : ① juste **au-dessus du QR**, centrée sur son axe, hors de sa zone de silence (4,5 modules mesurés,
3 mm au moins ; la boîte du QR est affinée sur ses vrais pixels) ; ② sinon juste **dessous** ; ③ sans QR : centrée sur
l'étiquette, première bande blanche **sous l'adresse** (blocs `zonesAdresse`), sinon sous la moitié haute ; ④ sinon rien.
Jamais sur l'encre (texte, cadre, trait), un code, une adresse ; posée AVANT le cartouche (qui l'évite de 4 mm) sauf
quand le cartouche est posé à la main. 6,5 pt gris foncé (0,42) en A4, 5,5 pt noir en thermique, × S/M/L.

### Le garde-fou inviolable
`zonesInterditesTampon` : chaque code-barres + 5 mm, chaque QR + sa zone de silence, chaque adresse repérée. Une place
posée à la main qui les chevauche est **repoussée** à la place libre la plus proche (`repousserHorsInterdits`, pur),
`repousse: true`, et l'éditeur le dit ; dans l'éditeur, un tampon lâché dessus est **refusé** (il revient, « Refusé :
ça recouvrirait le QR code »).

### L'APERÇU AVANT IMPRESSION (le cœur, demande 4)
« Imprimer (N) » (ou « Choisir » puis Imprimer, ou une série) ⇒ `lancerImpression` compose le lot (vrai code, vrais PDF) et
ouvre `ApercuAvantImpression` : une vignette par bordereau (`SceneTampons`), le N° et la mention se **glissent** (doigt,
souris, clavier), s'agrandissent (poignée, pincement), s'aimantent (centre, axe du QR, au-dessus du QR, bords) ; zones
interdites hachurées pendant le geste ; « N° / Mention à sa place d'origine » ; **« Appliquer à tous les bordereaux de ce
type »** (coché : la place est gardée pour la forme dans `vrm_tampons` ; décoché : pour CE bordereau, cette fois). Chaque
geste refait le PDF du lot (`composerLot(…, { places })`). **Rien ne s'imprime avant « Imprimer »** de l'aperçu
(`imprimerApercu`) : le PDF ouvert est celui de ces placements (signature `sigAvecPlaces`), dans le geste s'il est prêt,
la question §5 des N° « à vérifier » toujours AVANT (`numerosDemandent` / `attendrePuisOuvrir`).

### Paramètres → Imprimante et bordereaux → « Tampons des bordereaux »
`src/parametres/TamponsBordereaux.jsx` : la **galerie** de tous les types (eBay dit pourquoi il n'y est pas) sur le support
choisi (A4 · 4 par page · thermique + son papier), chaque vignette passée par `poserBordereau` avec le réglage ; toucher une
vignette ⇒ **le même éditeur** (`SceneTampons`) en grand, enregistré tout de suite, « Annuler », « Revenir à l'origine » ;
en complément les réglages en formulaire (cases, tailles S/M/L, places, « Tous » / « Seulement {type} ») et « Revenir au
réglage d'origine ». La raison de la place par défaut est écrite : « Au-dessus du QR code : visible même quand le scotch
recouvre le bas et les bords. »

Textes par `tr()` (src/i18n/langues/*/tampons.js, 5 langues). Quoi de neuf : `tampons-apercu`, `tampons-mention-qr`.

## 3. Preuves
(complétées ci-dessous au fil des passages)

## Non fait, dit
- **Rotation du tampon** : pas proposée. Le cartouche s'écrit toujours dans le sens de lecture de la page (rotation /Rotate
  comprise) ; un tampon tourné à part serait moins lisible et compliquerait le garde-fou. À rouvrir sur sa demande.
- **Un bordereau imprimé seul** depuis sa carte (Ventes « Imprimer », Vestiaire, Leboncoin) garde la feuille « Place du
  tampon » d'avant (ouverte quand la forme n'a pas de place gardée) ; elle lit et écrit désormais `vrm_tampons`, et
  l'impression repousse un tampon posé sur un code. L'aperçu à vignettes est celui de la sélection (« Imprimer (N) »,
  « Choisir » ⇒ un seul coché).
- Sur un vrai PDF dont la police n'a pas de table ToUnicode, l'adresse n'est pas lisible : la mention « sous l'adresse »
  retombe alors sur « au-dessus du QR » ou la bande blanche du milieu (les codes restent protégés sur l'image).
- WebKit absent du conteneur : l'iPhone est simulé (agent, `window.event`).

## ÉTAT À LA REPRISE
(voir la fin du fichier)
