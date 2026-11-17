# Scanner un bordereau de VENTE — 17 novembre 2026 (branche `claude/scan-bordereau-vente`, sur `claude/scan-achat`)

Julien (17 nov. au matin, en production) : « le scanner de bordereau ne marche pas, faut retrouver l'article qu'il
y a à l'intérieur ». Il venait d'imprimer un bordereau de VENTE Vinted et de le scanner avec « Retrouver un colis ».

## Ce qui a été mesuré (lecture seule, rien recopié dans le dépôt)

Son dernier bordereau Mondial Relay (reçu le 16 nov., `email_bord_*`), PDF décompressé et ses codes-barres DÉCODÉS
(les barres des images de l'étiquette, Code 128 ; le texte imprimé dessous identique) — fichiers effacés ensuite :

| code sur l'étiquette | combien | contenu | identité chez VRM ? |
|---|---|---|---|
| grand Code 128 (2 tournés, 1 droit) | **3** | une lettre + 19 chiffres, imprimé « H 999999 99999999 99 999 » | **aucune** : ni le n° de suivi, ni rangé nulle part (cherché dans toute la base des 30 jours) |
| Code 128 sur le bord, plus petit, tourné | 1 | 26 chiffres « 55… » | chiffres 3 à 10 = le n° de suivi de l'e-mail |

Donc :
1. **Le téléphone lit d'abord le grand code** (trois fois sur l'étiquette, le plus gros) ⇒ « Ce code n'est pas un n°
   de suivi : vise l'autre code-barres », qui s'effaçait en 2,6 s : « le scanner ne marche pas ».
2. Les étiquettes CAPTÉES par l'extension (`harvest_{uid}_label_{tx}`, vues ce matin) ne portent **aucun n° de suivi**
   rangé : même le bon code ne pouvait pas les retrouver.
3. `RE_CODE_MR` (lecture du PDF par le serveur) n'acceptait que « 56… » : sur cette étiquette « 55… », `suiviPdf`
   restait vide. Et le scanner nommait « 55… » « Vinted Go » alors que l'e-mail et l'étiquette disent Mondial Relay.
4. Formes des n° rangés (`email_bord_*`, depuis le 8 nov.) : Mondial Relay 8 chiffres, Chronopost `AA999999999AA`,
   Colissimo sans n° ; pas de `label_*` (les étiquettes captées sont `harvest_*_label_*`).

## Ce qui change

- **Un code lu qui n'est pas un n° de suivi connu est cherché dans le texte des étiquettes de SES ventes**
  (`src/etiquettesScan.js`) : chaque code-barres de transporteur est imprimé en clair sous lui, sur l'étiquette rangée
  pour SA transaction. Lettres et chiffres seulement (le texte est imprimé par groupes) ; ≥ 10 signes ; une étiquette
  le porte ⇒ sa vente ; deux ⇒ la liste ; aucune ⇒ dit. Identité exacte (l'étiquette de CETTE transaction), jamais une
  ressemblance. Étiquettes candidates : ventes à expédier, puis 21 derniers jours, 60 au plus, 4 à la fois, le PDF lu
  sans copie hors ligne, le texte gardé en mémoire pour la séance (jamais rangé : il porte une adresse).
- Marche aussi pour un n° reconnu mais absent (« aucun ») : ex. le 26 chiffres d'une étiquette captée.
- **Douchette** : un code qui n'est pas une vente ouvre le scanner, qui le cherche dans les étiquettes.
- **Code inconnu** : « Code pas reconnu », la ligne « Code lu », et quoi faire (viser le code long sur le bord, ou
  taper le n° de suivi) ; « pas su » si une étiquette n'a pas pu être lue.
- `RE_CODE_MR` accepte « 55… » et « 56… » ; « 55… » lu par le scanner = Mondial Relay.

## Preuves
- Banc **`scripts/bancs/scan-bordereau-vente.cjs`** (caméra réelle de Chromium nourrie de codes générés par bwip-js,
  lus par ZXing ; étiquettes PDF générées par pdf-lib à la forme mesurée ; 390 tactile, clair et sombre) : **54/54**
  — A grand code ⇒ LA vente parmi 50 au même titre (photo, N°, titre, taille) ; B étiquette captée sans n° ;
  C 26 chiffres « 55… » ; D Chronopost DataMatrix ; V Vinted Go ; E douchette ; F code inconnu tapé. Captures regardées.
- Code de `main` : voir le rapport (rouge attendu sur A, B, E, F) ; mutation (texte non « collé ») ⇒ rouge.
- Audits : scan-colis 52/52 (1b porté : « 55… » = Mondial Relay, mesuré), transporteur-pdf 34/34,
  transporteurs-parfaits, traduction, tdz, variables, identite verts.

## ÉTAT À LA REPRISE
- Branche poussée ; PR ouverte (voir rapport). Elle part de `claude/scan-achat` (#1230) : à fusionner APRÈS #1230.
- Pour lancer le banc : `npm i --prefix <dossier> bwip-js @zxing/library@0.20.0` puis `BANC_MODULES=<dossier>/node_modules`.
