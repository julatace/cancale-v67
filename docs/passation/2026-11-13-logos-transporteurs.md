# 13 nov. 2026 — Les logos des transporteurs

Julien (13 nov.) : « les logos Chronopost ne sont pas bons, ils ne doivent pas être jaunes ».

Branche `claude/logos-transporteurs`. Une seule source pour toutes les tuiles : `DESSINS_TRANSPORTEURS`
(`src/transporteursVisuels.js`), rendue par `LogoTransporteur` (`src/PastilleTransporteur.jsx`, Ventes, Achats,
Colis, À retirer, E-mails) et `svgMarque` (épingles de `src/CarteRelais.jsx`). Aucun fichier de logo téléchargé :
chaque marque est dessinée en SVG ici (forme, couleur, mot-symbole), comme avant.

## D'où venait le jaune

Le 12 nov. (`2026-11-12-finitions.md`), le cube Chronopost noir sur blanc était pris pour un logo générique ; il a été posé
sur le **jaune du réseau Pickup** (celui de ses e-mails et de ses points). Mais Pickup n'est pas Chronopost : la marque
Chronopost est **bleue**.

## Couleurs vérifiées (13 nov., recherche web ; les sites de logos ne s'ouvrent pas depuis le conteneur)

- **Chronopost** : le logo montre un **cube bleu** et le nom (descriptions publiques du logo ; depuis 2015 Chronopost porte
  le cube de DPDgroup). Nuanciers publics concordants : bleu `#009ADF`/`#009BDE`, bleu soutenu `#006FB1`, gris du mot
  `#414042`. Retenu : cube `#009BDE`, face gauche `#006FB1`, sur blanc.
- **Pickup** : charte 2022 « jaune, bleu, blanc » (communiqué Geopost). C'est le jaune du réseau Pickup, pas de Chronopost
  ⇒ un colis Chronopost Pickup montre le cube Chronopost.
- **Colissimo** : le logo est un **cube** en dégradé de l'orange historique Colissimo au jaune La Poste (charte du groupe
  La Poste) ; relevés `#F25C19`, `#F8A017`, mot gris `#393536`.
- **La Poste** : bleu `#003DA5`, bleu clair `#39A8E5` (brand center du groupe), sur le jaune La Poste.
- **Relais Colis**, **Colis Privé** : aucune charte trouvée. Relais Colis avait deux relevés contradictoires (rouge
  `#E2001A` dans le dessin, prune `#7A1F6B` dans `marque`), tous deux interdits ⇒ variante neutre. Colis Privé garde son
  orange `#EE7203` (non vérifié, autorisé).
- **UPS**, **Vinted Go** : tracés `simple-icons` (CC0) déjà en place, couleurs de marque de ce paquet ; inchangés.
- **GLS** : bleu et jaune « affirmés » (communiqué de la nouvelle identité, oct. 2021) ; inchangé.
- **Mondial Relay** (et la clé `inpost`, même réseau en France) : dessin relevé sur un vrai bordereau le 11 nov. ;
  framboise `#C8105F` (334°, hors du rouge de l'audit) ; inchangé.

## Logo par logo, avant → après

| clé | avant | après |
|---|---|---|
| `chronopost` (Chronopost, Chronopost Pickup) | cube encre sur **jaune** `#FFD200` | cube **bleu** `#009BDE`/`#006FB1` sur blanc (même géométrie, celle du bordereau) |
| `shop2shop` | cube encre sur blanc | le même cube bleu sur blanc (même réseau) |
| `colissimo` | mot « colissimo » bleu marine sur jaune (illisible à 20 px, pas son logo) | le cube orange → jaune de Colissimo, trois faces pleines, sur blanc |
| `laposte` | enveloppe + mot « La Poste » à 7,4 (illisible, lu comme un mortier) | l'oiseau qui file, bleu `#003DA5` / `#39A8E5`, sur jaune La Poste, sans mot |
| `dpd` | cube **rouge** `#DC0032` | le même cube en gris DPD `#414042` (variante une couleur : rouge réservé au doublon de N°) |
| `dhl` | lettres **rouges** `#D40511` sur jaune, collées au bord (marge 1) | lettres noires sur jaune (variante une couleur), marge 3 |
| `fedex` | « Fed » **violet** `#4D148C`, marge 1,5 | mot-symbole noir, « Ex » au trait (la version une couleur de FedEx), marge 3 |
| `relaiscolis` | mot blanc sur **rouge** (dessin) / **prune** (`marque`) | mot noir sur blanc (variante neutre, couleurs non vérifiables) |
| `mondialrelay`, `inpost` | — | inchangés (une constante `DESSIN_MONDIAL_RELAY` pour les deux) |
| `ups`, `vinted`, `gls`, `colisprive` | — | inchangés |

## Le gabarit commun

- Une tuile carrée 32 × 32, arrondi 26 %, à toutes les tailles (20, 22, 24, 44…).
- Le dessin dans la marge commune : 2,5 à 7 unités sur 32 (mesuré : 3 à 5,3). Seul Mondial Relay garde son « r » qui
  descend au bord, comme sur l'étiquette.
- **Un liseré commun** (`LISERE_TUILE`) posé dans le dessin : un trait gris à 30 %, d'un pixel quelle que soit la taille
  (`vector-effect: non-scaling-stroke`). Il détache une tuile blanche sur fond clair ET une tuile sombre (UPS) sur fond
  sombre. Avant : un `box-shadow` seulement pour les fonds commençant par « #F », rien en sombre, et rien sur la carte.
- La table `TRANSPORTEURS[*].marque` a désormais le **même fond** que le dessin (une seule vérité), et `CARRIERS` d'App.jsx
  (puces de la recherche de relais, épingles d'`OsmMap`) reprend les mêmes couleurs.

## Les audits resserrés

- `audit-violet` : les trois exceptions de transporteur (FedEx ×2, Relais Colis) et celle de `CARRIERS` sont **retirées** —
  un violet de transporteur rougit désormais.
- `audit-rouge-doublon` : `MARQUES` ne garde que le rouge de Google ; DPD, DHL, Relais Colis, Mondial Relay en sont sortis.
- `audit-logos-bordereaux` (règle jugée sur la teinte calculée) : Chronopost et Shop2Shop sans aucun jaune, cube bleu
  (190–215°) ; aucun dessin ne porte un rouge ni un violet ; `marque.fond` = fond du dessin. **Rouge sur `origin/main`**
  (10 rouges de règle : jaune Chronopost, cubes non bleus, DPD/DHL/Relais Colis rouges, FedEx violet, fonds divergents).
- Banc `logos-bordereaux` : planche à 20/44/110 px, 390 et 1512, clair et sombre ; mesure les tailles, l'arrondi, le liseré
  et la marge du dessin (`getBBox`). **Rouge sur `origin/main`** (DHL marge 1, FedEx 1,5, aucun liseré).
- Banc `retirer-ligne-unique` : « Chronopost Pickup sur le jaune » devient « le cube BLEU sur blanc » (teinte rendue du
  fond et du cube).

## Preuves

Planches regardées : `scratchpad/logos/` de la session (avant.png, apres2.png ; captures du banc `logos-bordereaux-*`),
captures Colis → À retirer et Ventes → À expédier (bancs `colis-retirer-propre`, `colis-propre-logos`). Voir le rapport de
la session pour les chiffres.

## Ce qui reste

- La recherche manuelle de relais (`relayPicker`, App.jsx) n'est ouverte par aucun bouton (`openRelayPicker` jamais
  appelé) : ses puces ont reçu les nouvelles couleurs, rien d'autre.
- Relais Colis et Colis Privé : à comparer à un vrai colis ; un tracé exact se pose à la même clé.
