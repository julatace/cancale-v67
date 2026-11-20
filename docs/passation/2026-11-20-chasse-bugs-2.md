# 20 nov. — Chasse aux bugs, deuxième passe (branche `claude/chasse-bugs-2`, partie de `claude/chasse-bugs`)

Julien : « continue à trouver des bugs ». Même méthode : rouge avant / vert après, mutation quand la règle est pure.
Aucun fichier de `vinted-sync-extension/` touché (5.410 en cours ailleurs).

## Nouveau banc : `scripts/bancs/parcours-chasse.cjs`
Julien au téléphone (390 tactile) et à l'ordinateur (1512) : chaque onglet, sa première rangée (la fiche), et avec
`CLICS=1` chaque bouton visible (25 au plus par onglet), dans six conditions — `volume` (base inventée au poids de la
sienne + 1 000 annonces), `vide`, `lente` (chaque lecture tenue 8 s), `panne` (503 partout), `longs` (titres de 180
caractères), `grand` (texte à 135 %, sombre). Il rapporte : erreurs JS / console, garde-fou, débordement,
« undefined / NaN », cibles < 44 px, texte coupé sans « … », la même lecture plus de 3 fois en 12 s, minuteries qui
s'accumulent au second passage. Pièges évités (ils faisaient juger une page vide) : `goBack` sans entrée poussée
quitte l'app ; l'écran de démarrage couvre la 1re seconde ; un titre pour lecteur d'écran (1 px) n'est pas « coupé ».
Dernier passage complet (6 conditions × 2 tailles × 14 onglets) : 1 347 OK ; le reste est corrigé ci-dessous ou noté.

## Défauts corrigés (contrôle rouge avant, vert après)
| défaut | où | cause | correctif | preuve |
|---|---|---|---|---|
| Paliers d'Automatisations : vider le champ posait 1 (« 5 » devenait « 15 ») ; un champ à minimum 5 ramenait « 1 » à 5 pendant qu'on tapait « 10 » | `src/natif/ecrans/Automatisations.jsx` `ChampNombre` | chaque frappe ramenée dans [min, max] | saisie libre, validation à la sortie (blur / Entrée), `videPermis` | banc `champ-nombre` : 14 rouges → 0 |
| Pastille de Messages figée après « Retirer » (ou lire) une conversation sur Messages | `src/App.jsx`, `src/designV2/aRegler.js` `pastilleMessages` | le nombre publié par Aujourd'hui (gardé 12 h, monté seul sur son onglet) l'emportait sur le compte vivant | part Vinted vivante (retirées écartées) + part eBay publiée | `audit-pastille-messages` (rouge avant, 2 mutations) |
| « Bénéfice brut 0 € » à côté de « Ventes 1 · CA 60 € » | `src/aujourdhui/modele.js`, `src/design/carteChiffres.js` | 0 sur AUCUNE vente comptée (publication des jours en retard) dit comme un bénéfice | « — · pas calculé » ; moins de ventes comptées que vendues ⇒ dit (k/n) | `audit-aujourdhui` E8 (rouge avant) ; mode exemple |
| « 2 colis · 1 points » (Aujourd'hui, À retirer) ; « en vente depuis 1 jours » (fiche) ; « en 1 jours sur 30 » (prévision) | i18n (5 langues), `src/natif/ecrans/Aujourdhui.jsx`, `src/ficheProduit.js` | une clé accordait un nombre au pluriel d'un autre, ou n'avait pas de pluriel | chaque nombre a sa forme | nouvel `audit-pluriels-croises` (rouge avant) |
| Cibles < 44 px : recherche du Stock (40), « 30 j / 90 j » des comptes Vinted (40 de large), « ⋯ » d'Achats (32), « Itinéraire » (40 de haut) | CSS | règles de hauteur/largeur fixes ; règle des segments d'Argent dans une couche antérieure (aucune spécificité ne la bat) | 44 px ; le segment prend la place de trois cibles ; zone de toucher centrée de 44 | banc `parcours-chasse` (rouge avant) |
| Points de restauration : liste lue deux fois à chaque ouverture | `src/App.jsx` | `onCloudReady` rappelle tout de suite quand le nuage est prêt | lecture directe seulement si le nuage n'est pas prêt | banc `parcours-chasse` (lectures répétées) |
| Paramètres à l'ordinateur : `lireCapturesDetail` 4 fois en 12 s | `src/App.jsx` | aucun partage | la lecture EN COURS est partagée | idem |

## Bancs remis sur la vraie forme
- `hors-ligne` (54 rouges → 0) : `/api/compte?mode=abonnement` servi (sinon la porte hors ligne restait fermée) ; QR Vinted Go à la vraie forme (n° + code + 64 hex : un QR qui ne porte pas CE colis n'est plus montré depuis le 16 nov.) ; bordereau ouvert depuis Ventes natif ; « Je dépose » hors ligne = gestes en file ; C : la porte passée en ligne d'abord.
- `hors-ligne-froid` D : locale `fr-FR` (la page d'accueil disait « Sign in »).
- `reseau-instable` : la réponse « perdue » est coupée en `connectionaborted` (la garde réseau prenait `ERR_CONNECTION_RESET` pour une requête vers la production) — `_base-ecritures.cjs`, partagé par 28 bancs.

## Vus, laissés (à qui)
- Statistiques (Argent, chantier argent-natif) : deux pleins bleus (« Commencer », « Continuer ») sous « Configure VRM » / « Démarrer avec VRM » ; texte agrandi : un bouton de 42 px.
- Annonces (chantier minimaliste) : rien de rouge au parcours.
- Paramètres : la lecture des points de restauration part encore 4 fois en 12 s au banc — c'est le point du jour qui réessaie parce que le banc répond `[]` à l'écriture (forme du banc, pas de l'app).
- Pas couvert : session expirée en ligne (le jeton expiré hors ligne l'est par `hors-ligne`), contraste mesuré (`lisible-partout` le fait, non relancé ici).
- Extension : rien de neuf relevé (aucun parcours n'y entre).

## Suite (même jour) — décision « 4 oui » appliquée, fiche cohérente avec la liste
- **Gestes d'envoi retirés** (§3) : « Je dépose » (hors ligne, feuille « ⋯ », série, ligne, balayage, fiche, volet, carte de colis),
  la tournée de dépôt, « Préparer mes colis », « Emballer » (feuille, tâche d'Aujourd'hui, fiche), le scanner d'envoi qui cochait
  « Colis fait », « Colis fait » Leboncoin et Vestiaire. Les marques notées avant restent lues (« Noté déposé » hors ligne) ; une
  marque hors ligne pas encore envoyée se synchronise (donnée déjà notée, aucune action sur un site). Gardé : « Déposé » d'un
  RETOUR d'achat. Garde-fou : `scripts/audit-depose-retire.cjs` (rouge avant, 4 mutations).
- **Fiche « À envoyer » qui cochait « En route · Livrée »** : mesuré sur la vraie base, 1 vente sur 12 en attente d'envoi (la
  ligne du transporteur disait « en route » sans prise en charge lue ; la liste exige la prise en charge). La fiche juge par la
  règle de la liste : une vente gardée « à envoyer » n'a rien de coché après « Bordereau prêt ». Banc `fiche-envoyer-coherente`
  (rouge avant). `frise-transporteur` remis sur la fiche native (vert, `MUTER=1` rouge) — il a attrapé une première version
  trop stricte (la preuve du transporteur écartée aussi pour une vente déjà partie chez Vinted), corrigée.
