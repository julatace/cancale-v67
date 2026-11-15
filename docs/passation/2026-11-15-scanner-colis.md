# 15 nov. — Scanner pour retrouver : le code-barres d'un colis ouvre SA vente, SON achat

Branche `claude/scanner-colis` (partie de `claude/project-review-nsk5su`, avec `claude/verre-app`). Pas de PR.

## La demande
Julien (15 nov.) : « Scanner pour retrouver : tu scannes le code-barres d'un colis reçu ou d'un bordereau,
et VRM ouvre directement la bonne vente ou le bon achat, grâce au numéro de suivi. Zéro recherche. »

## Ce qui existait (et reste)
- Le scanner de **dépôt** (3 nov., lot V du 9 nov. : `src/ScannerColis.jsx`, `candidatsDuScan`/`trouverParScan`) :
  À expédier → rond « Scanner » (la paire attendue, « Colis fait » sur son toucher, la série) ; À retirer → le
  mode retrait. **Inchangé**, à sa place.
- Le disque « + » ⇒ « Scanner » ouvrait ce scanner de dépôt dans Ventes → À expédier.
- La douchette (14 nov.) et la loupe « Tout sur le N° » (cherche aussi un n° de suivi).

## Ce qui change
1. **Le disque « + » ⇒ Scanner** ouvre le scanner **pour retrouver** (`ouvrirRetrouver('disque')`) ; un rond
   « Retrouver un colis » (icône code-barres sous une loupe) en tête de **Ventes** et d'**Achats**
   (`data-scan-retrouver-bouton`). `audit-studio` S7 suit la nouvelle règle (et sa mutation).
2. **Le scanner** (`src/ScannerRetrouver.jsx`, à la demande ; style `src/design/scanner-retrouver.css`) :
   caméra plein écran sous un voile bleu profond, viseur à quatre coins et ligne qui balaie (rien si
   « moins de mouvement »), lecture continue, **lampe** (si la piste dit `torch`), vibration + bip discret à la
   lecture, « Taper le n° » (saisie en secours, `enterKeyHint="search"`, 17 px : pas de zoom iOS), caméra
   refusée ⇒ « Caméra refusée. iPhone : Réglages › Safari › Caméra › Autoriser… Ou tape le n°. », le curseur dans
   la saisie. L'app dessous n'est plus dessinée tant qu'il est ouvert (`html[data-scan-retrouver]`), la caméra
   est coupée en sortant. Rien n'est écrit, rien n'est envoyé.
3. **Le résultat** (feuille en porcelaine, plaque N° en relief, un seul plein à l'encre) :
   - **un** enregistrement ⇒ **sa fiche tout de suite** : photo, N°, titre, taille, compte, l'état
     (ambre si un geste attend : « À expédier · bordereau prêt », « À retirer · jusqu'au 19 nov. », « À déposer »),
     code de retrait et point (achat), étape (retour), le n° lu ; « Ouvrir la vente / l'achat / le retour » ⇒ le
     chemin des notifications (`?tab=…&cible=vente|achat|retrait|retour|vcvente`) : l'écran s'ouvre sur LA ligne,
     mise en évidence ;
   - **plusieurs** (le même n° sur deux fiches) ⇒ « 2 fiches portent ce n° · Choisis la bonne : VRM n'en ouvre
     aucune à ta place », la liste courte, un toucher ⇒ sa fiche ;
   - **aucun** ⇒ « Ce colis n'est pas dans VRM », transporteur et n° lus, « Chercher ce n° » (la loupe, par
     `vrm:fiche-article`) ; une source pas encore lue ⇒ « VRM n'a pas fini de lire tes colis · Pas encore lu : … »
     (jamais « pas dans VRM » sur une lecture ratée, §5) ;
   - **pas un n° de suivi** (EAN d'une boîte, QR étranger) ⇒ une ligne « vise l'autre code-barres », la caméra
     continue (une étiquette porte souvent plusieurs codes).
   - Accompagnement : `colis.retrouver` (avant · après · pas reconnu · pas trouvé), `data-acc-*`.
4. **Les sources** (`src/retrouverColis.js`, léger) : les écrans qui ont les données s'enregistrent et sont lus
   AU MOMENT du scan. `Comptabilite only="bordereaux"` (Ventes et Achats) : ventes Vinted (n° de SON bordereau :
   `b.suivi` de l'e-mail, `b.suiviPdf` lu sur l'étiquette), Vestiaire (`v.suivi`), achats (le suivi de SA
   transaction — extension 5.372, n° posé à la main — et l'e-mail du transporteur relié par identité,
   `achatDuColis`), colis à retirer sans achat relié, retours (SON bordereau de retour, l'étape prouvée de
   `src/retoursAchat.js`). La coque : Leboncoin (le n° de SON lien de suivi, par la même règle). Sans écran
   Ventes / Achats monté (le disque depuis Ma journée), la coque monte Ventes derrière le scanner, qui attend.
5. **eBay : aucun n° de suivi n'est rangé chez VRM** (le suivi d'une commande n'est lu qu'à la demande, dans la
   fiche de gestion) : un colis eBay répond « pas dans VRM », dit. Leboncoin : seulement les ventes/achats dont
   l'extension a lu le lien de suivi.

## Ce que contient un code-barres — `lireCodeColis` (src/scanColis.js)
Chaque forme est **documentée** (source publique) ou **mesurée** (lecture seule de la base, formes des n°
rangés — chiffres remplacés par 9, jamais une valeur). Ni l'un ni l'autre ⇒ pas reconnue.

| forme lue | ce qu'on en tire | source |
|---|---|---|
| Code 128 / ITF de **26 chiffres** | n° Mondial Relay = chiffres 3 à 10 ; « 55… » ⇒ Vinted, sinon Mondial Relay | spécification des étiquettes Mondial Relay v2.4 (« Longueur : 26 caractères ; code 128 », ITF admis, 2 caractères de marque) ; mesuré le 3 nov. et le 11 nov. sur ses bordereaux (InPost « 56… », Vinted « 55… », 3 sur 3 = le n° de l'e-mail, `api/_lib/transporteur-pdf.js`) |
| **8 chiffres** | Mondial Relay | mesuré : 316 n° rangés (`email_track_mondialrelay`, `transp_mondialrelay`, `harvest_*_suivi`) |
| **S10** (2 lettres, 8 chiffres, 1 clé, 2 lettres), **clé vérifiée** | Chronopost si `[XZ][WU]…(TS\|SP\|JF)`, sinon « envoi postal » | norme UPU S10 (poids 8 6 4 2 3 5 9 7, 11 − reste, 10 ⇒ 0, 11 ⇒ 5 ; exemples publiés 47312482 ⇒ 9, AG018300045CN) ; **mesuré : 187 n° Chronopost rangés sur 187 ont une clé juste** ; préfixes/suffixes mesurés (XW…TS, ZW…TS, XW…SP, XU…JF, ZU…JF, CP…IE) |
| S10 posé dans un code plus long | ce S10, s'il est **le seul** à clé juste | forme du code Chronopost **pas mesurée** (aucun PDF décodé, voir plus bas) : retenu seulement sur la clé |
| **GeoLabel** : « % » + 27 (Code 128 de 28 caractères) | « % » + code postal (7) + n° de colis (14) + service (3) + pays ISO numérique (3) ; n° de colis tout en chiffres ⇒ **DPD / réseau Pickup** (les 14 chiffres) ; « 11 » + produit (chiffre + lettre) + 10 chiffres ⇒ **Colissimo** : l'ID13 **sans sa clé** | spécification GeoLabel DPD (« 28-Digit Code 128 Barcode ») ; note « format GeoLabel national 2.1 » de La Poste (digit 1 = « % », 9-10 = « 11 », 11-12 code produit, 13-22 identifiant, pays 26-28 en ISO 3166 numérique, l'ID13 se reconstitue avec une clé) ; mesuré : DPD et Chronopost Pickup rangés en 14 chiffres |
| **Colissimo ID13** `[6-9][A-Z]` + 11 chiffres | Colissimo | CDC WebService Tracking Colissimo (« un numérique de 6 à 9, un caractère de A à Z, 11 numériques ») |
| **UPS** `1Z` + 16 | UPS | forme publique du n° UPS (clé non vérifiée : l'égalité exacte suffit) |
| **ISO/IEC 15434** (`[)>`, champs séparés par GS — MaxiCode/PDF417/QR/DataMatrix) | le **seul** champ d'une forme distinctive (S10 à clé juste, Colissimo, UPS, Vinted Go) | ISO/IEC 15434 ; un champ de chiffres seuls ne se devine pas |
| `VGS` + 13 chiffres ; `1UW1T3` + 7 | Vinted Go | mesuré (`email_track_vinted`, `transp_vinted`) |
| 12, 14, 15, 16 chiffres ; 14 chiffres + 1 lettre ; 2 lettres + 12 chiffres + 1 lettre | le n°, transporteur **pas deviné** (ou Chronopost pour les deux dernières) | mesuré (Vinted Go 12/16, Chronopost 14 et 15, DPD 14, SEUR 14, BRT 15 ; lien Chronopost des ventes Leboncoin) |
| **lien** Mondial Relay `…tracking.aspx?…&exp=12345678` ; lien Chronopost `…?listeNumerosLT=…` (un seul n°) | le n° du paramètre | mesuré : `lbc_ventes` (`label.trackingUrl`), formes `ens=MRLBCOIN&exp=99999999…`, `listeNumerosLT=AA999999999999A` |
| saisie : espaces, tirets, points, minuscules | ôtés ; **tout autre signe ⇒ pas reconnu** (un « % » mal lu n'est jamais « nettoyé » en 26 chiffres) | — |

**Pas reconnus** : EAN-13 / UPC d'une boîte (13 chiffres), S10 à clé fausse, deux S10 dans un code, liens
d'autres sites, lien Chronopost à deux n°, GeoLabel de longueur fausse, titre, 7 ou 9 chiffres. Formes
**non documentées et non mesurées**, donc pas reconnues autrement qu'en n° seul exact : **GLS** (DataMatrix
« UniQ », n° 11-12 chiffres), **InPost** (24 chiffres), **Relais Colis**, **BRT** au-delà de ses 15 chiffres,
**DHL** (aucun n° rangé). Le DataMatrix / l'Aztec 2D de Colissimo n'est pas lu (son contenu n'est pas publié) :
c'est le 1D enrichi qui porte l'ID13.

**Mesure sur les PDF de bordereaux : pas faite** (la consigne la permettait) : la base n'est lisible qu'à travers
l'outil SQL, qui rend le PDF en base64 dans la conversation — 20 à 500 Ko par bordereau à recopier à la main, sans
décompression possible en SQL. Les formes Chronopost « dans un code plus long » restent donc conditionnées à la clé
S10 (et les 187/187 clés justes mesurées sur les n°). À faire depuis un poste qui a la clé de service : décoder
3 bordereaux par transporteur avec `zxing-cpp` et compléter le tableau.

`retrouverParSuivi(lu, enregistrements)` : égalité **exacte** du n° canonique (`normaliserN`) ; l'ID13 Colissimo
lu sans clé répond seulement à l'ID13 complet dont il est le début exact (12 caractères fixes + 1 clé calculée sur
eux : jamais deux ID13 au même début). Un enregistrement (sorte + clé) compte une fois.

## Deux défauts trouvés en chemin (corrigés, ils touchaient AUSSI le scanner de dépôt sur iPhone)
Le banc fait passer de vraies images par la vraie caméra de Chromium et le vrai ZXing 0.20.0 :
1. **`HTMLCanvasElementLuminanceSource` de ZXing 0.20 ne lit aucun Code 128 ni EAN-13 net** (mesuré : même image,
   même lecteur ; la luminance donnée telle quelle à `RGBLuminanceSource` les lit ; les codes 2D passaient par les
   deux). Or sur iPhone (Safari n'a pas `BarcodeDetector`) c'est ZXing qui lit : le bordereau 26 chiffres pouvait
   ne jamais passer. `creerLecteur` calcule maintenant la luminance (src/ScannerColis.jsx).
2. **Le lecteur 1D de ZXing ne trouve pas un Code 128 net quand l'étiquette blanche est posée sur un fond sombre**
   qui entre dans l'image (mesuré : fond 70, 120, 160 ⇒ rien ; 200, 246 ⇒ lu ; la même image recadrée ⇒ lu). Les deux
   scanners lisent maintenant, à tour de rôle, le centre du viseur puis l'image large (`ZONES_LECTURE`, `opts.zone`).

## Preuves
- `node scripts/audit-scan-colis.cjs` : **52 verts** (un code de chaque forme, inventé à la forme exacte, clés S10
  recalculées par le banc ; 50 ventes au même titre aux n° voisins ⇒ chacune la sienne ; « contient » ≠ égal ; même
  n° sur deux fiches ⇒ liste ; inconnu ⇒ aucun ; l'app : n° LUS jamais un titre, sources, « Ouvrir » sur son
  toucher, rien envoyé). `--prouve` : **10/10 mutations** rougissent (égalité relâchée, saisie « nettoyée », clé S10
  ignorée, 26 chiffres mal placés, plusieurs ⇒ le premier, Colissimo sur un début court, GeoLabel mal placé, deux S10
  ⇒ le premier, lien de tout site, un titre parmi les n°).
- `scripts/bancs/scan-colis.cjs` (390 tactile et 1512 ; `SCAN_VUES`, `SCAN_LETTRES`, `SHOTS`, `BANC_MODULES` pour
  bwip-js et @zxing/library@0.20.0 hors du dépôt) : codes GÉNÉRÉS par bwip-js, posés sur une étiquette blanche sur
  une table sombre, écrits en Y4M et donnés à Chromium comme caméra (`--use-file-for-fake-video-capture`) ; ZXing
  servi en local à l'adresse de la CSP. Scènes A (Code 128 26 chiffres ⇒ SA vente, < 1 s, « Ouvrir » ⇒ la ligne
  mise en évidence), B (DataMatrix S10 ; au téléphone par le disque depuis Ma journée), C (QR lien Mondial Relay
  depuis Achats ⇒ l'achat, son code), D (même n° vente + retour ⇒ liste, un toucher ⇒ le retour), E (inconnu ⇒ dit,
  Chronopost et le n°, « Chercher ce n° »), F (EAN-13 ⇒ « pas un n° de suivi », caméra qui continue), G (caméra
  refusée ⇒ phrase, curseur ; n° tapé ⇒ sa vente ; un titre ⇒ rien). Partout : cibles ≥ 44 px, rien ne déborde,
  aucune erreur, aucune image envoyée, caméra coupée.
  Résultat (15 nov. au soir, machine partagée chargée de 16 à 21 par cœur) : **177 verts, 2 rouges** sur 390 et 1512,
  clair et sombre — les deux rouges sont des captures d'écran qui ont dépassé 30 s (1512-clair G, 1512-sombre A),
  pas une règle. 390-clair : tout vert, **lecture jugée < 1 s**. Au-delà de 1,5 de charge par cœur, le temps de
  lecture est DIT (⚠️ et la mesure), pas jugé : il allait de 5 à 38 s sous cette charge.
- **Rouge sur l'arbre de départ** (94e1391, `git archive`, banc lancé contre son `dist/` avec `BANC_DIST`) :
  **8 rouges** sur 390-clair (aucun bouton « Retrouver » ; le disque ouvre l'ancien scanner de dépôt, dont la
  caméra reste ouverte). Avant les deux corrections de ZXing (même banc, ce code) : Code 128 et EAN-13 jamais lus
  (scènes A, D, E, F rouges), les codes 2D lus.
- Le scanner de dépôt (lot V) après les deux corrections de ZXing : `scanner-colis-achats` 390-clair **49 verts,
  1 rouge** (« sans caméra » : le clic sur Scanner n'aboutit pas en 30 s) — **le même rouge sur l'arbre de départ**
  (94e1391, banc lancé depuis son arbre) : défaut d'avant, pas de ce lot.
- Audits verts : identite, csp, traduction, tdz, variables, studio, quoi-de-neuf, accompagnement, icones,
  coherence, colis-trois, colis-plus ; `npm run build`.
- Captures (scratchpad de la session, hors dépôt) : `scan-colis-{390,1512}-{clair,sombre}-{1-vente,2-ouverte,
  3-disque|3-datamatrix,4-achat,5-plusieurs,6-retour,7-aucun,8-pas-un-suivi,9-refus,10-titre}.png`.

## Ce qui reste
- **iPhone réel non essayé d'ici** (Safari, ZXing) : la lecture < 1 s est mesurée sous Chromium logiciel.
- Mesurer le contenu des codes sur de vrais bordereaux (Chronopost, Colissimo, Vinted Go, DPD) — voir plus haut.
- Le scanner de dépôt garde sa règle (`candidatsDuScan`) ; il pourrait prendre `lireCodeColis` (GeoLabel, liens,
  clé S10) — pas fait ici pour ne pas changer son comportement mesuré (lot V).
- Geste de Julien : aucun (essayer : « + » ⇒ Scanner, viser un bordereau ou l'étiquette d'un colis reçu).
