# 11 novembre — Alertes d'achat sur SES recherches eBay (lot `alertes-ebay`)

Demande validée par Julien, **pour eBay SEULEMENT** (ni Vinted, ni Leboncoin, ni Vestiaire) :
être prévenu quand une NOUVELLE annonce eBay correspond à ses recherches, avec la marge
POSSIBLE calculée avec SES chiffres. Aucun achat automatique, aucun verdict (« bonne
affaire » reste refusé, CLAUDE.md §3), aucune fonction payante sur sa clé (§2.9).

## Ce qui est livré

- **Ses recherches = les recherches enregistrées du fil** (les « veilles », `src/operations/metier.js`,
  §11 : la même liste que le fil d'eBay → Achats et l'espace Organisation). Les critères
  demandés y sont déjà : mots (marque, modèle), pointure, état, **budget maximum port compris**,
  pays du vendeur (France ou tous), livrable en France, achat immédiat, catégorie eBay, mots exclus.
- **« Me prévenir »** sur chaque recherche du fil (eBay → Achats, carte de la recherche) :
  SON clic, opération `veille.alerte` (alerte oui/non, **son prix de revente facultatif**, le site
  de revente). Jamais sur une recherche archivée. « Arrêter l'alerte » et « Prix de revente »
  ensuite ; l'historique de la recherche le dit.
- **Le serveur relit** : `api/ship-reminders.js?moment=alertes`, appelé **chaque heure** par
  GitHub (`.github/workflows/alertes-ebay.yml`, `CRON_SECRET`) — aucune nouvelle fonction `api/`
  (toujours 12). Règle : `api/_lib/ebay-alertes.js`. API Browse d'eBay (gratuite), **jeton
  d'APPLICATION** de VRM (client_credentials), jamais le jeton du vendeur ; la même adresse et la
  même réduction que « Chercher » (`requeteBrowse`, `reduireResultats` : budget port compris,
  port « calculé » = inconnu, jamais gratuit ; photo `i.ebayimg.com`, lien `www.ebay.*` seulement).
- **Quotas (dits à l'écran, « Pourquoi ? »)** : 4 recherches par vendeur et par heure au plus,
  chacune relue au plus une fois par heure (les plus anciennes d'abord, les autres attendent) ;
  chaque appel compte dans SES 200 recherches du jour, dans la **part automatique** (fil + alertes
  ≤ 150 : les 50 dernières restent à « Chercher ») ; 60 appels à eBay au plus par passage pour
  toute l'application ; **deux vendeurs aux mêmes critères = UN appel** (cache du passage) ;
  3 pannes d'eBay de suite ⇒ le passage s'arrête (500 : GitHub prévient) ; une lecture ratée
  attend une heure comme une réussie ; compteur illisible ⇒ rien ne part.
- **Identité** : l'`itemId` d'eBay, jamais un titre. Une annonce n'est signalée **qu'une fois**,
  toutes recherches confondues (`dits`) ; la **première** lecture d'une recherche (ou de critères
  modifiés) ne signale rien ; une annonce « Retirée » ne revient jamais ; elle n'est signalée
  qu'une fois l'état **rangé** (écriture ratée ⇒ retrouvée au passage suivant, jamais perdue).
- **Notification** : une par vendeur et par passage (« Nouvelle annonce eBay · Samba 42 » /
  « 3 nouvelles annonces eBay », prix port compris), catégorie `alerteebay`, famille
  **« Alertes d'achat eBay »** (Paramètres → Notifications, groupe « Achats », allumée par défaut —
  rien ne part tant qu'aucune alerte n'est allumée). Le canal est celui de toutes les notifications
  (`sendPushToAll`) : son réglage, les **heures calmes** (rangée « calme » dans la cloche, rien ne
  sonne), le regroupement, jamais deux fois le même objet le même jour. Lien : eBay → Achats.
- **La liste** « Nouvelles annonces pour tes recherches » en tête d'eBay → Achats
  (`src/AlertesEbay.jsx`, à la demande) : photo, titre, prix, port (inconnu dit), la recherche,
  « Voir sur eBay ↗ », « Retirer », « Tout retirer » ; « Tes N alertes » repliées avec l'état de
  chaque recherche (relue à hh:mm · N annonces / première lecture / eBay n'a pas répondu / critères
  refusés). Lue par la route `alertes` d'`api/ebay.js` (projection, jamais `vus` ni `dits`) ; route
  muette ⇒ « — », la raison, « Réessayer ». 14 jours, 60 annonces au plus.
- **La marge POSSIBLE** (`src/alertesEbayMarge.js` → la calculette `calculer`, une règle) :
  revente = SON prix (sur le site qu'il a choisi), sinon la **médiane** de ses ventes Vinted du
  modèle de la recherche (≥ 3, la règle du repère : jamais une clé générique ni un accessoire) ;
  achat = prix port compris ; port inconnu ⇒ « au plus » ; ventes pas lues ⇒ « — tes ventes ne
  sont pas encore lues » ; aucune base ⇒ « — indique ton prix de revente ». L'emballage n'est
  pas compté (dit une fois, sous la liste). Aucun tri par marge, aucune couleur.
- L'état serveur vit sous **`ebay_tokens_alertes`** : la garde de la base (`vrm_garde_ebay_tokens`,
  migration 014, en production) interdit à un navigateur de le créer, réécrire ou effacer.
- Textes en 5 langues (`alertesEbay.*`), « Quoi de neuf » (`alertes-ebay`).

## Preuves

- `node scripts/audit-alertes-ebay.cjs` : **44 verts** — la règle (R1-R18), le VRAI passage
  `ship-reminders?moment=alertes` contre une fausse base (filtre `cs`, projections, PATCH `rev`) et
  un faux eBay (P1-P17, dont heures calmes, plafond, panne, sélection muette, regroupement), la
  VRAIE route `api/ebay.js` action `alertes` (W1-W6). **Rouge sur origin/main** (module absent).
  `--prouve` : **10/10 mutations rouges** (première lecture bavarde, sans `dits`, sans plafond par
  heure, relue à chaque passage, sans regroupement, alertes hors part auto, notifiée avant d'être
  rangée, retirée qui revient, route qui rend `vus`, port inconnu gratuit).
- Banc `scripts/bancs/alertes-ebay.cjs` (390 tactile clair, 1512 sombre) : liste, marges (son prix,
  médiane, port inconnu), 44 px, « Retirer », « Me prévenir » ⇒ `veille.alerte`, pas su, aucune
  erreur ni débordement, gestes dans la ligne et sur une seule ligne de texte (ce dernier contrôle
  ROUGE sur le build d'avant — « Reti/rer » coupé à 1512 px par la grille à quatre colonnes de la
  couche premium ; les gestes passent désormais sous le contenu à toutes les largeurs). Captures regardées.
- Audits voisins verts : `ebay-recherche` (59), `notifications` (F5 passé à neuf types),
  `cibles-notif` (aperçu de la nouvelle famille), `notifs-belles`, `notifs-centre`, `notifs-groupees`,
  `traduction`, `quoi-de-neuf`, `variables`, `tdz`, `coherence`, `identite`, `icones`,
  `textes-courts`, `fonctions-api`, `secrets`.

- Passe complète d'audits (496) : 22 rouges, **les 22 déjà rouges sur origin/main** (même arbre,
  rejoués un à un : annuler-commandes, benefice, centre-aide, chrome-en-dur, colis-envoi,
  config-facture, coque-parametres, coque-tablette, donnees-ecrans, export-donnees,
  frein-relais-vinted, label-latest, lancement, lbc-plus-vue-pause, lectures-lourdes,
  lus-deux-appareils, onglets-d, photos-vinted, politique-hotes, relier-compte, rouge-doublon, safari).
  Deux contrôles voisins passés à neuf familles (`audit-compte-pas-relu` A26, banc `configuration-depart`).
- Banc voisin `ebay-achats-recherche` : 36 rouges, **les mêmes sur le build de main** (le bouton
  « Achats » qu'il cherche n'existe plus sous ce nom) — pas de ce lot.

## ⚠️ Non mesuré
- Aucun appel réel à eBay d'ici (formes de la documentation Browse/OAuth, servies par un faux eBay).
- Le filtre PostgREST `data->veilles=cs.[{"alerte":true}]` sur la vraie base (forme documentée ;
  s'il était refusé, le passage répondrait 503 et le workflow GitHub échouerait — dit, rien de faux).

## Gestes de Julien
- Aucun pour le code. Le secret `CRON_SECRET` est déjà dans GitHub (mêmes workflows que
  colis-frais) : sans lui, le journal du workflow le dit et rien n'est relu.
- Pour s'en servir : eBay → Achats, sur une recherche enregistrée, « Me prévenir ».

## ÉTAT À LA REPRISE
Livré et poussé sur `claude/alertes-ebay`. Rien en cours.
