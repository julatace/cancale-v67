# VRM — navigation et interface responsive

Le site conserve une navigation par plateforme. Sur ordinateur, le rail montre
Ma journée, les plateformes et quatre rubriques de gestion : Colis, Stock,
Statistiques, Comptabilité. Les détails Vinted et les outils occasionnels sont
repliables. Toutes les destinations précédentes restent accessibles.

Sur téléphone, les plateformes restent dans la barre du bas ; le menu du haut
regroupe les autres pages par usage, avec des boutons en deux colonnes. Il peut
être fermé avec Échap et garde le focus clavier dans son panneau.

Les raccourcis de période visibles se limitent à la période choisie, « Ce mois »
et « Mois dernier ». Les autres durées sont accessibles dans le sélecteur.

Les pages partagent des titres plus lisibles, des résumés sans cadre supplémentaire
et des onglets de plateforme au trait. L'en-tête eBay suit le thème choisi comme
son contenu. Le statut de synchronisation ouvre les paramètres au toucher.

Les commandes tactiles ont une hauteur minimale de 44 px et les champs une police
minimale de 16 px. Sur petit écran, une vente présente sa photo et son identité,
avec son prix et son action à droite. Sur ordinateur, sa disposition reste
en ligne. Aucun calcul métier ni rapprochement de données n'est modifié.

Les anciens réglages qui réduisaient toute l'app à 65 % sont ignorés en dessous
de 768 px. Leur valeur est conservée pour les écrans plus grands. L'agrandissement
reste disponible et la hauteur de la coque compense le zoom pour garder la
navigation dans l'écran. La hauteur dynamique suit la barre d'adresse mobile.

## Vérification

```bash
npm run build
BANC_CHROMIUM=/usr/bin/chromium node scripts/bancs/mobile.cjs
node scripts/audit-variables.cjs
node scripts/audit-icones.cjs
node scripts/audit-boutons.cjs
```

Le banc mobile sert le build et des données synthétiques (222 contrôles réussis). Il interdit les
requêtes distantes et couvre les écrans à 320, 360, 390 et 430 px, les menus,
la recherche, les champs, les filtres, l'ancien zoom, l'agrandissement, la rotation
et le rail d'ordinateur à 1512 px. `BANC_CAPTURES` peut désigner un dossier hors
checkout pour les captures. Le banc échoue sur le code précédent, sur le zoom
65 % encore appliqué à 320 px.

Le banc de rapport comptable existant complète la vérification des parcours,
des actions et des exports sur téléphone et ordinateur. Dans cette machine,
un preload local corrige ses anciens chemins Playwright/Chromium ; le banc
lui-même reste inchangé.

Ces vérifications utilisent Chromium, pas un iPhone/Safari physique. Les images
générées pendant l'étude ne sont pas intégrées au site et ne représentent pas
l'inventaire du vendeur. Le statut de publication doit être vérifié séparément.

## Version compacte du 13 octobre

Ma journée va directement aux tâches : pas de date, salutation, graphique ou
bilan du mois avant les colis. Les tâches d'expédition affichent le nombre de
colis et « Expédier » à droite. Les rappels de ventes déduites de bordereaux,
ventes masquées, prix d'achat absents et pertes globales sont retirés. Les ventes
masquées restent masquées et les pertes individuelles restent sur les ventes.
La saisie des coûts et la gestion des ventes masquées restent dans les paramètres.
Les totaux et graphiques de Ventes sont accessibles dans Analyse. Sur téléphone,
les chiffres en tête de chaque plateforme sont aussi repliés.

Sur téléphone, les photos font 64 × 84 px. Les informations sont à droite ;
numéro, coût et actions secondaires sont dans Modifier. Leboncoin et eBay
utilisent la même disposition de ligne. Les repères de navigation montrent les
noms abrégés des plateformes. Le sélecteur de période propose un mois natif ou
deux dates, vérifie leur ordre et permet d'effacer le filtre.

La lecture des photos accepte les différentes formes captées et retrouve une
photo d'annonce uniquement par son identifiant exact, sans rapprochement par
titre ni ambiguïté entre comptes. En cas d'échec natif, une session VRM peut
récupérer les octets via POST /api/compte?mode=photo : domaines CDN autorisés,
redirections revérifiées, types raster, plafond 6 Mo, délai et concurrence bornés.
La route exige une session et n'envoie aucun jeton aux CDN. Elle ne recrée pas
une photo absente des captures et ne garantit pas un lien expiré.

Le bouton de facture est réservé aux comptes attestés par un reçu serveur de
type facture_pro portant leur login. Les anciens reçus n'ont pas d'identifiant
de transaction : aucune facture n'est donc associée automatiquement à une vente
par son titre ou prix. Le vendeur choisit le brouillon puis confirme son numéro,
son montant et le destinataire. Seules les métadonnées sont lues au chargement.
Avant la mise en file, le document est relu ; un brouillon modifié, déjà envoyé,
un refus HTTP ou une écriture sans ligne modifiée ne sont jamais annoncés comme
réussis. La confirmation met en file, elle ne prouve pas la livraison de l'email.
Aucun email réel n'est envoyé par les tests.

Le compte eBay reste indiqué comme relié même lorsque seul le droit aux paiements
manque. Solde et paramètres sont repliés ; les erreurs de synchronisation gardent
les dernières données et indiquent l'échec ou une actualisation partielle.

```bash
node scripts/bancs/compact.cjs
node scripts/bancs/compact-services.mjs
node scripts/audit-photos-vinted.cjs
node scripts/audit-fonctions-api.cjs
```

Ces bancs couvrent notamment les photos sur téléphone sans extension, les liens
par identité, les redirections et limites du secours, les dates inversées, les
comptes Pro, l'annulation d'envoi, les refus serveur et le statut NOT_FULFILLED
d'eBay. Les données et sessions sont synthétiques ; les appels distants sont
interceptés. La livraison réelle des factures et les comptes de production ne
sont pas exercés.

### Messageries et gestion des revendeurs — 13 octobre 2026

Les statistiques donnent la priorité au CA finalisé, au bénéfice et à la marge.
Le stock devient secondaire ; les calculs existants et les coûts inconnus restent
inchangés. Les logos sont des fichiers SVG locaux avec provenance dans brands.
Les annonces placent la recherche et le tri avant les cartes et replient les
outils de stock. Les échanges Vinted remplacent les cartes de notifications
email, avec historique capté, photos, événements et actualisation par extension.
Les réponses requièrent la capacité messagerie et le bon compte connecté.
Les conversations sont portées hors du conteneur défilant sur téléphone pour
que la navigation ne recouvre ni l'en-tête ni le bouton d'envoi.

Leboncoin sépare les colis à expédier du suivi : un statut d'expédition attesté
retire le bordereau de la préparation, et la finalisation retire le colis actif.
Les captures et l'historique ne sont pas supprimés.

eBay ajoute les échanges remontés sur 90 jours, les réponses, les offres reçues
(accepter, refuser, contre-proposer), le contact de l'acheteur, l'adresse et le
suivi de commande, l'enregistrement d'une expédition, la modification du titre,
de la description, du prix et du stock, et la fermeture des annonces à prix fixe.
Les variantes et enchères sont refusées par cette nouvelle édition. Les droits
eBay restent nécessaires ; une reconnexion peut être imposée par eBay.
Les échanges sans annonce identifiée ne sont pas répondus via RTQ : le contact
acheteur reste disponible depuis la commande.

Toutes les écritures exigent un clic confirmé. Le serveur relit les identités,
prix et états engageants ; une erreur de transport n'entraîne pas de nouvelle
écriture automatique. Le suivi utilise les lignes et quantités réellement
restantes, et reconnaît le même suivi déjà enregistré. Les schémas ont été
vérifiés dans les définitions Trading de Nogrod/ebay-sdk-php et le schéma public
Sell Fulfillment de hendt/ebay-api. Aucun envoi client réel n'est exécuté par les
bancs : toutes les écritures et données sont simulées.

```bash
node scripts/bancs/ebay-gestion.mjs
node scripts/bancs/revendeurs.cjs
```

### Composition des espaces — suite du 13 octobre

Vinted, Leboncoin et eBay partagent un espace identifié, une navigation groupée
et des chiffres secondaires accessibles depuis un dépliant sur téléphone.
Les cartes d'annonces donnent l'ordre nom → prix → coût/marge → activité ; les
photos prennent plus de place sur ordinateur et gardent le format portrait sur
mobile. Le bouton « Gérer l'annonce » regroupe les actions secondaires. La
recherche, son effacement et le tri restent au-dessus de la liste.
L'objectif mensuel existant est remonté près des résultats, avec progression
accessible au lecteur d'écran ; aucun calcul de ventes ou bénéfices ne change.
Le banc annonces-carte ouvre explicitement les outils de stock pour vérifier
les actions qui y sont rangées, et peut enregistrer le premier écran replié.
Le banc revendeurs vérifie les trois plateformes à 320, 390 et 1512 px, les
logos locaux, l'accès aux chiffres et la saisie d'un objectif réel.
La jauge précise « Vinted, ventes finalisées et en cours du mois » : son montant
historique `liveStats.caMois` ne mesure pas le seul CA finalisé de la carte.

La suite eBay conserve ces espaces de travail avec plusieurs comptes : les
ventes mélangées nomment leur compte, et les actions de messages/offres choisissent
un compte explicitement. Les règles d'offre natives sont opt-in ; les états
incertains restent visibles. Les totaux eBay en euros refusent les montants ou
devises inconnus, et les cartes gardent la devise captée. L'édition prix/stock
omet les champs inchangés et garde les contrôles de concurrence et de quantité.
Voir `../passation/notes/agent-ebay/suite-2026-10-13.md` pour le périmètre de l'agent.
