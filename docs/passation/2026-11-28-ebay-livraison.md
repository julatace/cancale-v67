# 28 nov. 2026 — La livraison eBay dans VRM (branche `claude/ebay-livraison`)

Julien a dit « oui, fais tout » aux cinq points (colis eBay dans À envoyer, étiquette depuis VRM, suivi
automatique, livraison préréglée à la mise en ligne, port pour info). §2.8 tient partout : **sur eBay
c'est l'acheteur qui paie le bordereau** (livraison gérée par eBay) ; VRM n'achète jamais d'étiquette,
ne pose jamais « livraison gratuite », et le port n'est ni une recette ni une charge.

## Mesuré avant de coder (lecture seule, sa base)
- **0 commande eBay** dans `ebay_orders` (la ligne existe, `orders: []`).
- **Aucun e-mail d'étiquette eBay** : 34 e-mails d'expéditeur eBay, tous de la publicité, des « L'objet …
  a été mis en vente », « Un nouvel appareil », des e-mails du programme développeurs. Aucun PDF.
- Donc **rien n'est mesuré sur une vraie commande** : les noms des champs viennent de la documentation
  de l'API Fulfillment (`lineItemFulfillmentInstructions.shipByDate`, `shippingStep.shippingCarrierCode`,
  `fulfillmentHrefs`, `shipping_fulfillment` → `shipmentTrackingNumber`, `pricingSummary.deliveryCost`).

## Ce qui marche (une règle : `api/_lib/ebay-livraison.js`, pure, app + serveur)
1. **Colis eBay dans Ventes › À envoyer** — ils y étaient déjà par `colisEbay` (une commande = une rangée,
   le même compteur). Ajouté : la **date limite LUE** (`limiteEbay` : `shipByDate` en jour et heure de
   Paris, `limite: 'ebay'`, dépassée = retard, 23 h 59 = jour seul — `limiteDepuisInstant` dans
   `api/_lib/limite-envoi.js`) et le **transporteur LU** chez eBay (`transporteurEbay` → la table de l'app,
   son logo). Le logo eBay de la rangée existait (`LogoSite`).
2. **Étiquette** :
   - (a) « Étiquette sur eBay » ouvre `https://{site eBay}/ship/single/{orderId}` (`lienEtiquette`,
     `api/_lib/ebay-marches-table.js`) — l'adresse que la documentation de l'API Logistics d'eBay donne pour
     imprimer l'étiquette d'une commande. ⚠️ **Non mesurée sur son compte** : un message de la communauté eBay
     (2020) dit que l'id de ce lien peut différer du n° de commande. « Ouvrir la commande sur eBay »
     (`/sh/ord/details?orderid=`) reste à côté dans le détail, en repli.
   - (b) **Étiquette reçue par e-mail** (`api/email-inbound.js`, branche « 00 ») : expéditeur eBay + UN PDF +
     un sujet qui parle d'étiquette ⇒ rangée `email_bordebay_{n° de commande}` (n° `12-34567-89012` lu dans le
     sujet puis le corps, exactement UN ; sinon gardée « à vérifier », jamais par le titre) ; écriture ratée ⇒
     503. L'app la pose sur la commande (`_etiquetteEbay`) : la rangée devient cochable, « Imprimer N
     bordereaux » l'imprime avec Vinted (`ligneLotAutre`, `lireOctetsLigne` site `ebay`), tamponnée de son N°.
     ⚠️ La forme réelle de cet e-mail n'est pas connue (aucun reçu) : à vérifier au premier vrai.
   - **API Logistics : NON.** `createFromShippingQuote` ACHÈTE l'étiquette ; `downloadLabelFile` ne sert que
     les étiquettes achetées par l'API (son `shipmentId`) ; l'API est en diffusion restreinte. Il n'existe pas
     d'appel qui rende l'étiquette déjà payée par l'acheteur sans en acheter une. **`fetchAvecDelai` (le seul
     `fetch` du serveur) refuse toute adresse `/sell/logistics/…`, `shipping_quote`, `download_label_file`,
     `createShippingLabel`** (`estAchatEtiquette`).
3. **Suivi automatique** : la relecture eBay (à l'ouverture, ~10 min, cron du matin) lit, pour les commandes
   PARTIES (≤ 45 j, au plus 6 par relecture, jamais relues une fois leur n° rangé), `GET …/order/{id}/
   shipping_fulfillment` (lecture seule) et range les n° (scalaires) dans `ebay_suivis{suffixe}`
   (`relireSuivisCompte`, `api/_lib/ebay-relecture.js`, comparer-et-échanger ; eBay muet ⇒ rien écrit).
   Ventes › En route montre les commandes eBay parties (`etatEnvoiEbay`) : n° lu ⇒ « En route » ; le
   TRANSPORTEUR dit livré par CE n° (e-mail de suivi `delivered`, ligne `transp_` finie) ⇒ « Livrée ».
   Sans n° : « expédiée » seulement. ⚠️ Un n° eBay n'est lu chez le transporteur que si un e-mail de suivi de
   ce n° arrive (la relève `transp_` du serveur ne le lit pas encore).
4. **Livraison préréglée** : Paramètres › eBay (« Tous les réglages eBay », défauts) a « Poids et taille du
   colis » — boîte à chaussures par défaut 1 200 g, 35 × 24 × 13 cm, réglable, éteignable. Part dans
   `<ShippingPackageDetails>` (unités métriques), jamais `<ShippingDetails>` (son compte le refuse, mesuré le
   27 sept.) ; serveur : `optionsPublication` borne (50–30 000 g, 1–150 cm). `livraisonDe` inchangé (gérée par
   eBay, jamais gratuite). ⚠️ **Non essayé à blanc sur son compte** : si eBay refuse ce bloc, le message
   d'eBay s'affiche ; éteindre l'interrupteur rend l'annonce d'avant au caractère près.
5. **Port pour info** : le détail d'une vente eBay dit « Port payé par l'acheteur · 6,50 € · pour info · ni
   recette ni charge » (`portAcheteurEbay`). Compta : `montantRecuEbay` retire désormais le port du dû quand
   le dû le PORTE (plus proche de « articles + port » que des articles seuls, mêmes montants de la même
   commande) ; sinon inchangé. Miroir `api/_lib/ventes-regle.js` refabriqué (`--recopie`). Aucune règle de
   compta, d'URSSAF, de bénéfice ne lit `portAcheteurEbay`.

## Preuves
- `scripts/audit-ebay-livraison.cjs` : **43 verts** (vraies routes `email-inbound`, relecture, `ebay.js
  pubverify`) — une commande comptée une fois, shipByDate juste (Paris, heure d'hiver), 50 commandes au même
  titre ⇒ 50 étiquettes sous leur n°, sans n° ⇒ gardée, panne ⇒ 503, suivi ⇒ En route / Livrée, eBay muet ⇒
  rien écrit, API Logistics refusée, colis dans le XML, port à 0 refusé, port hors compta. **Rouge sur
  origin/main** (7 rouges). Mutations rouges : `achat` (une route appelle `create_from_shipping_quote`, garde
  retirée) 2, `titre` (étiquette rangée par le titre) 4, `port` (port plus retiré) 1.
- Banc `scripts/bancs/ebay-livraison.cjs` (390 tactile, 1512) : À envoyer avec E-1/E-2 et Vinted, limite lue,
  case de l'étiquette, lien `/ship/single/`, port pour info, En route E-3/E-4. Captures dans `SHOTS`.
- Audits verts : fonctions-api (12), coherence, traduction (5 langues), tdz, variables, quoi-de-neuf,
  identite, urssaf, benefice, ventes-modele, ebay-colis, ebay-destination, familles-serveur, revue-argent.

## Ce qui dépend d'eBay ou de Julien
- **Une vraie vente eBay** : vérifier que « Étiquette sur eBay » ouvre bien la page d'expédition (sinon,
  repli « Ouvrir la commande ») ; regarder si eBay envoie l'étiquette par e-mail (et sa forme) ; vérifier que
  `totalDueSeller` contient ou non le port.
- **Une publication** avec le colis par défaut (vérification à blanc) : si eBay refuse `ShippingPackageDetails`,
  éteindre « Poids et taille du colis ».
- Le droit OAuth `sell.fulfillment` est déjà demandé par la connexion eBay existante (lecture des commandes).
