# 11 nov. · Lot `tampon-vrm` — la mention « Créé par VRM » sur les bordereaux

## La demande
Julien : sur les bordereaux imprimés par VRM, en plus du N° + titre, une toute
petite mention publicitaire, PAS à côté du N°/titre, seulement s'il y a un
espace libre ; sinon rien.

## Tranché (consigne « tranche le reste toi-même »)
- Texte : **« Créé par VRM »** (la plus courte des deux proposées).
- 6,5 pt, Helvetica, gris 62 %, coin **bas-droit** de la zone libre la plus basse.
- Seulement quand le tampon est posé sur la page (`blanc` : zone libre auto, ou
  `libre` : place choisie à la main). Pas de mention sur une fiche colis, ni
  quand rien n'est tamponné.
- Étiquette introuvable par `zoneEtiquette` ⇒ **aucune mention** (on ne sait pas
  où est l'étiquette à découper : pas de place sûre).
- Thermique (page 100×150 = l'étiquette) ⇒ jamais de mention.
- Le tamponnage serveur des emails (`api/_lib/stamp.js`) n'a pas de recherche
  d'espace libre (pas de rendu) : **inchangé, aucune mention** ici.
- L'extension ne tamponne pas : **aucune nouvelle version d'extension**.

## Le code (`src/App.jsx`, région « LE TAMPON DU BORDEREAU »)
- `trouverZoneBlanche` : deux options, `bloques` (rectangles comptés comme de
  l'encre) et `depuisBas` (recherche depuis le coin bas-droit). Comportement
  par défaut inchangé.
- `MENTION`, `versAffiche`, `placeMentionVrm` (pur), `poserMentionVrm` :
  interdits = étiquette(s) à découper (+ 4 mm), tampon (+ 25 mm), codes-barres
  et QR repérés par `zonesCodesTampon` (+ 5 mm), bordure 6 mm ; plus les marges
  du tampon autour de toute encre (5 mm × 3,5 mm). Ne lève jamais.
- `tamponnerBordereau` rend `mention: true|false`.

## Preuves
- `scripts/bancs/tampon-bordereau.cjs` : **207 verts, 0 rouge**. Nouvelle forme
  `a4-moitie` (comme Chronopost Shop2Shop : étiquette pleine largeur en bas, 2ᵉ
  code-barres tout en bas). Contrôles : mention posée sur a4-quart et a4-moitie,
  absente sur 10×15 / pleine / thermique / fiche, 6–7 pt à l'endroit, ≥ 20 mm du
  N°/titre, hors étiquette à découper, ≥ 5 mm du bord, et le contrôle « zone
  libre » (aucun pixel changé sur une zone gardée : code, QR, adresse, suivi)
  inclut la mention. L7 : tampon libre en bas à droite ⇒ mention ailleurs.
- Code d'avant (`git archive origin/main`) : **4 rouges** (mention absente).
- Mutations : `mentionAveugle` 5 rouges · `mentionDansEtiquette` 2 rouges ·
  `mentionCollee` 1 rouge.
- `scripts/tests/bordereau-zone-protegee.cjs` : vert (placeMentionVrm : hors
  QR + marge, hors interdits, hors bordure, null sans place sûre) ; rouge sur
  le code d'avant.
- `scripts/tests/bordereau-qr-lecture.cjs` (pdf.js 3.11.174) : 9 cas verts, dont
  2 étiquettes encadrées (0° et /Rotate 270) avec mention : **le QR se lit
  toujours après tampon + mention** ; jamais de mention sur une page 10×15.
- `scripts/bancs/tampon-libre.cjs` (app construite) : 38 verts.
- `audit-impression`, `audit-colis-trois` verts ; `npm run build` vert ; audits
  variables, tdz, coherence, identite, icones, textes-courts, fonctions-api,
  secrets verts.
- Rendus PDF→PNG regardés : A4 étiquette en quart (Mondial Relay/InPost), A4
  moitié basse (Chronopost Shop2Shop), A4 /Rotate 270 (Vestiaire) — mention
  minuscule en bas à droite, à l'endroit, loin du N°, hors étiquette.

## Reste / geste de Julien
- Imprimer un vrai bordereau Mondial Relay et un Chronopost pour voir la
  mention en vrai (aucun vrai PDF dans ce dépôt public).
- L'aperçu « Placer le tampon » ne dessine pas la mention (elle est minuscule
  et posée seulement à l'impression).
