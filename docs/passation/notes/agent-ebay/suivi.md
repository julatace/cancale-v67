# Suivre les colis eBay jusqu'au client, et parler au client

**Pour :** Julien, et les sessions qui construiront l'« agent eBay autonome ».
**Rédigé le :** 11 octobre 2026.
**Sources :** la feuille de route du 9 octobre (`../agent-ebay/feuille-de-route.md`,
`possible.md`, `spec-expedier.md`, `spec-veille.md`, `spec-litiges.md`), le code de
la branche `worktree-wf_30feaf2f-334-8` (règle d'offre, plusieurs comptes eBay),
`CLAUDE.md`, des lectures projetées de ta base (aucun jeton, aucun nom, aucune
adresse d'acheteur), et des recherches web.

**Comment lire les sources de ce document.** Les sites officiels
(`developer.ebay.com`, `developer.laposte.fr`, `sendcloud.dev`,
`developer.boxtal.com`) sont **bloqués** depuis ce conteneur : `getaddrinfo
ENOTFOUND` ou 403 du proxy, vérifié le 11 octobre. **Aucune page officielle n'a
donc été lue en entier.** Chaque fait vient d'un **extrait de moteur de
recherche** qui cite la page (je le dis « extrait de [la page] »), ou d'une
**source secondaire** (bibliothèque open source, blog, forum : je le dis aussi).
Ce qui n'est pas établi porte **[à vérifier]**. **Aucun appel** n'a été fait à
eBay, à un transporteur ou à Vinted.

---

## 0. En une page

**La question :** une vente eBay est payée. Est-ce que VRM peut suivre le colis
**jusqu'à l'acheteur**, savoir quand il est livré, et **parler à l'acheteur tout
seul** (merci, colis au point relais, livré, problème) ?

**La réponse courte :**

1. **Oui, on peut suivre le colis jusqu'au bout, PAR IDENTITÉ.** Il y a deux
   façons d'avoir le numéro de suivi, et toutes les deux sont des identités :
   - le numéro du bordereau que **VRM achète lui-même** pour CETTE commande
     (c'est l'étude « bordereaux », à côté de celle-ci) ;
   - ou le numéro qu'**eBay rattache lui-même à la commande** quand tu achètes
     le bordereau dans eBay. VRM le relit chez eBay (`getShippingFulfillments`).

   Dans les deux cas, on ne devine rien : ni date, ni titre, ni point relais.
   ⚠️ La feuille du 9 octobre disait « envoyer un suivi automatiquement est
   impossible faute d'identité commune ». **C'était vrai pour un bordereau
   capté dans un email, et ça ne l'est plus** quand c'est VRM ou eBay qui
   fabrique le bordereau de cette commande-là.

2. **eBay ne dit JAMAIS au vendeur « livré » par son API**, pour une commande
   normale. Le seul champ prévu pour ça (`ActualDeliveryTime`) est « no longer
   applicable » (extrait de la page de référence Trading). Pour savoir « livré »
   ou « au point relais », il faut donc lire **le transporteur**. C'est
   exactement ce que l'agent ajoute.

3. **Le transporteur se lit ainsi, du plus simple au plus difficile :**

   | transporteur | comment |
   |---|---|
   | **Colissimo, Chronopost, Lettre suivie** | **une** API de La Poste, gratuite avec une clé (« Suivi v2 ») |
   | **colis acheté chez Boxtal ou Sendcloud** | leur webhook pousse chaque étape (seulement pour les bordereaux achetés chez eux) |
   | **Mondial Relay** (ton transporteur n°1, 110 emails de suivi sur 200) | ⚠️ **pas d'API publique sans contrat pro** : par l'agrégateur où le bordereau a été acheté, sinon par un service de suivi payant |

4. **Parler à l'acheteur par l'API officielle : oui.** L'appel Trading
   `AddMemberMessageAAQToPartner` écrit à l'acheteur d'une commande pendant
   90 jours, avec le jeton que VRM a déjà. Mais les règles d'eBay sont strictes :
   - **aucun lien**, aucune adresse email, aucun téléphone, rien qui mène hors
     d'eBay ;
   - **ne jamais exiger une évaluation positive**, ni rien offrir en échange ;
   - et **eBay prévient déjà l'acheteur** de l'envoi, avec le suivi.

   ⇒ Un message qui répète ce qu'eBay dit déjà est du bruit. L'agent n'envoie
   que ce qui **ajoute** quelque chose (section 4.4).

5. **L'évaluation positive à l'acheteur existe déjà dans eBay**, sans une ligne
   de code : « Automatiser les évaluations », dans tes préférences de vente.
   Ma recommandation est de l'allumer là. VRM ne propose sa propre version que
   si tu veux le déclencheur « après la livraison ».

**Ce que tu gagnes, concrètement :**
- chaque colis eBay affiché dans Colis avec son étape réelle (« au relais
  jusqu'au 14/10 », « livré le 12/10 ») ;
- une alerte quand un colis **n'a pas été scanné** 48 h après le bordereau ;
- une alerte quand un colis **bloque ou repart chez toi** ;
- un rappel à l'acheteur **deux jours avant** que le point relais ne renvoie le
  colis (si tu l'allumes) ;
- la **preuve de livraison** gardée sur la vente, pour un litige « objet non
  reçu ».

**Ce que l'agent ne fera jamais :**
- envoyer un message que tu n'as pas allumé ;
- envoyer un message sur un « pas su » ;
- envoyer un message à l'acheteur d'une paire partie à l'authentification
  d'eBay ;
- mettre un lien dans un message ;
- promettre un remboursement ;
- répondre tout seul à un problème de transport. Là, c'est **un message
  préparé**, que tu envoies d'un clic.

---

## 1. Ce que j'ai mesuré dans ta base (lecture seule, 11 octobre)

- **eBay.** La ligne `ebay_orders` relue le **10 octobre à 20 h 29 UTC** contient
  **0 commande**. `ebay_listings` porte 3 annonces, dont **2 avec un SKU
  `VRM-…`**. Aucune ligne `ebay_comptes` : un seul compte eBay. Aucun
  bordereau, aucun suivi eBay en base.
  ⇒ La vente du 10 octobre (tâche #78) n'est pas dans cette capture. La
  prochaine relecture dira si elle est sur ce compte. Tout ce qui suit est donc
  **conçu sur la documentation, pas mesuré sur une vente réelle.**
- **Aucun email d'eBay n'arrive à VRM.** Il y a **0** email venant d'eBay parmi
  les **1 159** emails « non reconnus » conservés. L'agent ne peut donc pas
  compter sur les emails d'eBay. Il doit lire eBay par l'API, comme prévu.
- **Les emails de suivi que tu reçois déjà (Vinted)** : **200** lignes
  `email_track_*`.

  | transporteur | lignes | dont « colis déposé (ta vente) » |
  |---|---|---|
  | Mondial Relay | 110 | 23 |
  | Chronopost | 54 | 7 |
  | Vinted Go | 11 | — |
  | Colissimo | 4 | — |
  | DPD | 1 | — |
  | Shop2Shop | 1 | — |
  | non identifié (`autre`) | 19 | — |

  Les **30** lignes « colis déposé (ta vente) » sont des colis que **tu ENVOIES** :
  le transporteur écrit aussi à l'**expéditeur**.
- **Le pont « bordereau ↔ email du transporteur » par n° de suivi (une
  identité)** :
  - **188** bordereaux Vinted en base, dont **81** portent un n° de suivi ;
  - ces 81 numéros ont tous la forme internationale à 13 caractères (2 lettres,
    9 chiffres, 2 lettres) ;
  - **27** d'entre eux se retrouvent dans un email de transporteur, **tous chez
    Chronopost**, dont **15 « livré »**.

  Les numéros Mondial Relay (8 chiffres) ne sont jamais lus sur un bordereau.
  ⇒ **L'email seul couvre environ un tiers des colis Chronopost, et zéro colis
  Mondial Relay.** Il ne suffit pas pour suivre un colis jusqu'au client : il
  faut une API du transporteur. Mais c'est un **complément gratuit**, à
  réutiliser (section 5).
- **Les extensions de la base.** `pgcrypto` et `supabase_vault` sont
  installées : elles peuvent ranger des clés de transporteur par vendeur,
  chiffrées. `pg_cron` et `pg_net` ne le sont **pas** (section 6.3).

---

## 2. Suivre un colis par API depuis la France

### 2.1 Transporteur par transporteur

| | accès | quotas | ce qu'on lit | push ou sondage |
|---|---|---|---|---|
| **La Poste « Suivi v2 »** (Colissimo, Lettre suivie, Chronopost) | REST `GET https://api.laposte.fr/suivi/v2/idships/{numéro}`, en-tête `X-Okapi-Key`. Clé obtenue avec un **compte développeur gratuit** sur developer.laposte.fr (extrait d'un catalogue d'API, et forum : « l'abonnement est gratuit »). | **Non trouvés.** Un forum de 2022 parle de « 100 appels par seconde » : c'est le commentaire d'un utilisateur **[à vérifier]**. Le portail dit seulement « offres gratuites ou payantes selon le besoin » (extrait de developer.laposte.fr). | la chronologie des évènements, chacun avec un code et une étape | **sondage** (aucun webhook trouvé) |
| **Chronopost** (direct) | Service SOAP `ws.chronopost.fr/tracking-cxf/TrackingServiceWS?wsdl` (la page d'une bibliothèque PHP le cite). Accès et identifiants **[à vérifier]**. **Inutile si La Poste Suivi v2 couvre Chronopost**, comme le disent les bibliothèques. | ? | ? | sondage |
| **Mondial Relay** | « API1 » en **SOAP** (points relais + suivi, opération `WSI2_TracingColisDetaille`) ; « API2 » en REST pour créer expéditions et étiquettes (extrait du document officiel « Présentation des WebServices », avril 2025). Identifiants = **code enseigne + clé privée**, donnés par ton contact Mondial Relay (extrait d'un guide d'intégration tiers, et SDK open source). ⇒ **Il faut un contrat professionnel Mondial Relay.** | ? | statut, libellés, n° du point relais, évènements datés avec lieu (exemple de réponse dans un guide tiers) | sondage. Le document de 2025 parle d'« autres solutions (EDI, Webhook) pour transmettre les tracings au fil de la journée », sans détail **[à vérifier]** |
| **InPost France** | Aucune documentation officielle trouvée **[à vérifier]**. Seuls des agrégateurs tiers apparaissent. | ? | ? | ? |
| **UPS** | REST Tracking API (`/api/track/v1/details`), jeton OAuth « client credentials » obtenu sur developer.ups.com (sources tierces). Un compte UPS serait exigé **[à vérifier]**. | ? | statut, livraison | sondage |
| **DPD France** | Non recherché en détail : **1 seul** email DPD dans ta base. **[à vérifier]** | ? | ? | ? |

**Les codes d'évènement de La Poste Suivi v2.** Ils viennent d'un projet GitHub
qui code cette API, pas de la page officielle **[à vérifier]** :

| code | sens | étape |
|---|---|---|
| `DR1` | déclaratif reçu (étiquette créée) | 1 |
| `PC1` | pris en charge | 2 |
| `ET1` | en cours de traitement | 3 |
| `MD2` | mis en distribution | 4 |
| `DI1` | distribué | 5 |
| `PB1` | problème en cours | — |
| `RE1` | retourné à l'expéditeur | — |

Restent **inconnus** :
- le code « en attente au point de retrait / au guichet » ;
- la **date limite de retrait** : est-elle dans la réponse ? Le document
  Colissimo (ancien service SOAP « TimeLine ») dit renvoyer « la description du
  point de retrait pour une livraison hors domicile ». La v2, je ne sais pas
  **[à vérifier]**.

### 2.2 Les agrégateurs, là où on ACHÈTE le bordereau

- **Boxtal, API v3.** Les étapes du colis arrivent par un abonnement aux
  évènements `TRACKING_CHANGED`. Boxtal envoie une requête à l'adresse donnée,
  avec un en-tête `x-bxt-signature` : un HMAC-SHA256 du corps JSON, à vérifier
  avec la clé de l'abonnement. ⚠️ **Un abonnement ne reçoit que les évènements
  des envois créés par la MÊME application** (extraits du guide Boxtal v3,
  pages « tracking events » et « subscriptions »).
  ⇒ Le suivi Boxtal ne vaut que pour un bordereau **acheté chez Boxtal**.
  Liste exacte des statuts : **[à vérifier]**.
- **Sendcloud.** Webhook `parcel_status_changed` (API v2 et v3). Il porte :
  - le statut normalisé (identifiant et message) ;
  - `carrier_status_change_timestamp`, l'heure de l'évènement chez le
    transporteur, qui peut valoir `null`.

  Parmi ses statuts : « Ready for collection » (à retirer). La liste complète se
  lit par `GET /parcels/statuses` (v3). La v2 est en maintenance (extraits de
  sendcloud.dev). Pour un colis non créé chez Sendcloud : **[à vérifier]**.
- **Packlink PRO.** Pas de documentation officielle trouvée. Zapier liste un
  déclencheur « Shipment Status Updated » **[à vérifier]**.

### 2.3 Les services de suivi seul (17TRACK, AfterShip, TrackingMore, Ship24)

Ils couvrent des milliers de transporteurs, avec des webhooks. **Mondial Relay**
est annoncé chez AfterShip et TrackingMore (leurs pages).

C'est **payant** :
- 17TRACK : 5 000 suivis pour 119 $ par an, selon deux sources tierces,
  **[à vérifier]** ;
- Ship24 : une offre gratuite de 10 appels.

⚠️ **Confier un numéro de suivi à un tiers de plus**, c'est un sous-traitant de
données de plus. Le numéro mène à une partie de l'adresse sur le site du
transporteur. Il faudrait alors **mettre à jour la politique de
confidentialité**. À ne choisir que pour Mondial Relay, et seulement si
l'agrégateur où le bordereau est acheté ne donne pas le suivi.

### 2.4 Les étapes que VRM retient (une seule échelle pour toutes les sources)

| étape VRM | La Poste v2 **[à vérifier]** | Sendcloud | eBay | email transporteur (existant) |
|---|---|---|---|---|
| `a_poster` | — | — | payée, pas de fulfillment | — |
| `etiquette` (bordereau créé, pas scanné) | `DR1` | « Announced » / « Ready to send » **[à vérifier]** | fulfillment présent, n° connu | — |
| `pris_en_charge` (1er scan = preuve d'envoi) | `PC1`, `PC2` | « En route to sorting center » **[à vérifier]** | — | « Colis déposé (ta vente) » |
| `en_transit` | `ET*`, `MD2` | « Being sorted », « Driver en route » | — | `transit` |
| `au_relais` (+ date limite si connue) | code « en attente au point de retrait » **[à vérifier]** | « Ready for collection » | — | `available` |
| `livre` | `DI1` | « Delivered » | — | `delivered` |
| `probleme` | `PB1`, « non distribuable » | « Delivery attempt failed », exception | — | — |
| `retour` | `RE1`, « distribué à l'expéditeur » | « Returned to sender » | — | — |
| `pas_su` | lecture ratée, numéro inconnu | — | lecture ratée | — |

**Une seule fonction pure, `etapeColis(source, évènement)`, côté serveur**, fait
cette traduction. Le serveur est le **seul propriétaire** de l'étape rangée ;
l'app la lit (§11).
**Un code inconnu ne vaut pas « livré »** : il vaut `en_transit` s'il arrive
après un scan, sinon `pas_su`. On ne monte jamais d'étape sur un évènement qu'on
ne connaît pas.

---

## 3. Côté eBay : déclarer l'envoi, ce que voit l'acheteur, ce qui te protège

### 3.1 Déclarer l'envoi

- **REST** `POST /sell/fulfillment/v1/order/{orderId}/shipping_fulfillment`
  avec `{lineItems:[{lineItemId, quantity}], shippedDate, shippingCarrierCode,
  trackingNumber}`.
  - La réponse est **201** avec l'en-tête `Location`.
  - Le transporteur et le numéro vont **ensemble ou pas du tout**.
  - Le numéro est alphanumérique, sans espace ni tiret.
  - Portée `sell.fulfillment`, **déjà accordée**.

  (extrait de la page `createShippingFulfillment` et du guide « Managing
  fulfillments », repris de `possible.md`)
- **Trading.** `CompleteSale` fait la même chose (`Shipped`,
  `ShipmentTrackingDetails`). Le même appel peut aussi laisser une évaluation
  (`FeedbackInfo`).
- **Les codes transporteur français** (`Colissimo`, `MondialRelay`,
  `Chronopost`) **[à vérifier]**. La liste à jour vient de `GeteBayDetails`,
  retiré le 15 mars 2027.
- **Un bordereau acheté DANS eBay** : la commande passe toute seule en
  « expédiée », le suivi est chargé automatiquement, et **eBay envoie une
  notification à l'acheteur** (extraits de l'aide eBay.fr « Imprimer et annuler
  des bordereaux » et « Effectuer le suivi des objets vendus »).
- **Un suivi chargé à la main** : l'acheteur est aussi prévenu (extrait d'une
  aide eBay en anglais, et d'un site non officiel).
  ⇒ **Le message « ton colis est parti + suivi » existe DÉJÀ, envoyé par eBay.**
  VRM ne le refait pas.

### 3.2 Ce qu'eBay dit au vendeur, et ce qu'il ne dit pas

**Ce qu'il dit :**
- `getOrder` donne :
  - `orderFulfillmentStatus` (`NOT_STARTED`, `IN_PROGRESS`, `FULFILLED`) ;
  - `lineItemFulfillmentStatus` ;
  - `fulfillmentHrefs` ;
  - `lineItems[].lineItemFulfillmentInstructions` : `shipByDate`, et les dates
    de livraison estimées min et max **[à vérifier, noms exacts]** ;
  - `buyer.username` : le socle le garde ; c'est ce qui permet d'écrire.
- `getShippingFulfillments` donne, pour chaque envoi, `shipmentTrackingNumber`
  (seulement quand il existe), `shippingCarrierCode` et `shippedDate` (extrait
  de la page `ShippingFulfillment`). ⇒ **C'est là que VRM prend le n° de suivi
  d'un bordereau acheté dans eBay, par identité.**

**Ce qu'il ne dit pas :**
- ⛔ **« Livré »** :
  - la Fulfillment API n'a **aucun** champ de livraison réelle (recherche faite,
    rien trouvé **[à vérifier sur la page de référence]**) ;
  - en Trading, `ShippingPackageInfo` (`ActualDeliveryTime`) est « **no longer
    applicable** » : il ne servait qu'à eBay Now et eBay On Demand, qui
    n'existent plus (extrait de la page `ShippingPackageInfoType`) ;
  - la Post-Order API porte `deliveryStatus` et `actualDeliveryDate`, mais
    **seulement dans un retour ou une réclamation**.

  ⇒ **La livraison se lit chez le transporteur.**
- **Les notifications.** La Notification API a ajouté `ITEM_MARKED_SHIPPED`
  (12 décembre 2025) et `ORDER_CONFIRMATION` (1er décembre 2025), d'après les
  notes de version. Leur portée et leur contenu : **[à vérifier]**.
  `ITEM_MARKED_SHIPPED` est la sonnette idéale : « il vient d'acheter le
  bordereau dans eBay ⇒ relis les envois de cette commande ».

### 3.3 Ce qui protège le vendeur

- **La performance vendeur sur eBay.fr** est évaluée **le 20 de chaque mois** :
  - le niveau se calcule sur le **taux de défauts**, les **litiges clôturés
    sans résolution**, les **livraisons en retard** et la **validation des
    informations de suivi** ;
  - « Performance insuffisante » arrive au-delà de **2 %** de défauts, ou de
    **0,3 %** de litiges clôturés sans résolution ;
  - **un taux de retard élevé ne suffit pas seul** à faire tomber ce statut ;
  - eBay corrige le taux si un suivi chargé prouve un envoi dans les délais.

  (extraits de l'aide eBay.fr « Statuts des vendeurs et normes de performance »
  et du règlement sur les défauts)
- **Les retards se comptent sur le suivi.** Les envois en retard sont comptés
  selon le chargement, ou non, du suivi d'un **transporteur intégré**. Sans
  suivi, eBay demande à l'acheteur, quand il évalue, si l'objet est arrivé à
  temps (extrait de l'aide eBay.ca en français).
  ⇒ **Charger un suivi valide avant la date limite d'envoi (`shipByDate`), c'est
  la protection n°1.**
- **Les mesures par API.** `getSellerStandardsProfile` (dont le taux de retard
  et `VALID_TRACKING_UPLOADED_WITHIN_HANDLING_RATE`) et
  `getCustomerServiceMetric` (objets non reçus) demandent la portée
  `sell.analytics.readonly`. **VRM ne l'a pas**. Elle est prévue dans la
  reconnexion du chantier `visibilite` (extraits de la doc Analytics).
- **« Objet non reçu ».** Selon des sources tierces **[à vérifier]** :
  - l'acheteur peut ouvrir la demande 3 jours ouvrés après la date de livraison
    estimée ;
  - le vendeur a environ 3 jours ouvrés pour répondre ;
  - la preuve principale est le suivi « livré ».

  ⇒ **Garder la preuve de livraison** (code, date et transporteur du dernier
  évènement) sur la vente, pour la montrer d'un clic.
- **La vérification d'authenticité** (baskets à partir de 200 € sur eBay.fr,
  selon `possible.md`) : la paire part **chez l'authentificateur**, pas chez
  l'acheteur. « Livré », c'est livré à l'authentificateur. La suite se lit dans
  `program.authenticityVerification.status`.
  ⇒ **Aucun message de transport à l'acheteur** dans ce cas, et jamais
  « livré à l'acheteur ».

---

## 4. Parler au client automatiquement, par l'API officielle

### 4.1 Les canaux

| canal | ce qu'il fait | portée | état |
|---|---|---|---|
| **Trading `AddMemberMessageAAQToPartner`** | écrit à l'autre partie d'une commande, **jusqu'à 90 jours** après la création de la ligne de commande. Champs : `RecipientID` (le pseudo de l'acheteur, obligatoire), `ItemID`, `QuestionType` (`General`, `Shipping` ; `CustomizedSubject` évite l'en-tête « a une question »), `Subject`, `Body` | jeton utilisateur, **aucune nouvelle portée** (avec OAuth : **[à vérifier]**) | documenté (extraits de la page de référence et de l'article 1508 de la base de connaissances) ; longueur maximale du texte **[à vérifier]** (2 000 caractères pour l'appel voisin `RTQ`) |
| **Message API (REST)** `https://api.ebay.com/commerce/message/v1` | `getConversations`, `getConversation`, `sendMessage` (`conversationId` ou `otherPartyUsername` + `messageText` ; un `reference` peut viser une annonce), `updateConversation` | `commerce.message` ⇒ **reconnexion** | version 1.0.0 du 3 novembre 2025 ; **EBAY_FR non confirmé** ; eBay annonce que les pseudos seront remplacés par des identifiants fixes (extraits du guide des communications et de la doc japonaise d'eBay) |
| Post-Order `send_message` | seulement à l'intérieur d'un retour ou d'une réclamation | — | chantier `litiges` |

⇒ **On commence par `AddMemberMessageAAQToPartner`** : rien à reconnecter, et le
message apparaît dans la messagerie eBay de l'acheteur. Le jour où la Message API
est confirmée sur eBay.fr, on la lit (messages reçus) avec la même reconnexion
que `litiges` et `visibilite`.
⚠️ **Le passage « pseudo → identifiant fixe »** annoncé par eBay peut casser
`RecipientID`. Chaque envoi rend l'erreur d'eBay telle quelle, et un refus
n'est jamais compté comme envoyé.

### 4.2 Les règles d'eBay qui bornent les messages

- **Règlement sur les contacts entre membres.** Aucune coordonnée, aucune
  adresse, **aucune adresse web ni aucun lien** dans un message. eBay surveille
  les messages et en garde une copie (extrait de la page « Member-to-member
  contact policy »).
- **Règlement anti-spam.** Un vendeur ne peut pas envoyer d'email, de téléphone,
  de réseau social ni d'URL externe. Seule exception : un téléphone dans « Poser
  une question », pour conclure une vente sur eBay (extrait de la page « Spam
  policy »).
  ⇒ **Pas même le lien de suivi de La Poste.** On donne le transporteur et le
  numéro (ils sont déjà sur la commande), et « le suivi est sur ta commande
  eBay ».
- **Les évaluations.**
  - Un vendeur **peut** demander une évaluation à un acheteur qui n'en a pas
    laissé.
  - Il ne peut **pas exiger** une évaluation positive, ni rien offrir en échange
    (remise, cadeau).
  - Exiger, c'est de l'**extorsion d'évaluation**.

  (extraits de la FAQ « Seller performance manipulation » et du « Feedback
  manipulation policy »)
- **eBay rappelle déjà lui-même aux acheteurs de laisser une évaluation**, par
  un email qu'on ne peut pas personnaliser. C'est le cas depuis 2009 (ChannelX,
  source ancienne **[à vérifier]** pour 2026).
  ⇒ VRM **ne fait pas** de rappel d'évaluation par défaut.
- **eBay notifie déjà l'expédition, avec le suivi** (section 3.1).

### 4.3 L'évaluation positive à l'acheteur

- **Par l'API :**
  - `LeaveFeedback` : une évaluation par ligne de commande, dans les
    **60 jours** ;
  - `CompleteSale` avec `FeedbackInfo` ;
  - la **Feedback API** REST (version 1.0.0 du 15 octobre 2025 :
    `getItemsAwaitingFeedback`, `leaveFeedback`), dont la portée **n'a pas été
    trouvée**.

  Un vendeur ne laisse **que du positif** à un acheteur, et **une évaluation ne
  se retire pas** : c'est irréversible (`possible.md`, extraits de la page
  `LeaveFeedback`).
- **Sans une ligne de code, dans eBay.** « Automatiser les évaluations », dans
  les préférences de vente (« Toutes les annonces et commandes »). Deux
  déclencheurs :
  - « après paiement » ;
  - « après paiement **et** évaluation positive de l'acheteur ».

  Jusqu'à 10 commentaires enregistrés, tirés au hasard (extrait de l'aide
  eBay.co.uk « Automatic feedback », et d'eBay Canada en 2022, qui l'a ouvert à
  tous les vendeurs).
- **Recommandation.**
  - **Allume le réglage natif d'eBay** : eBay le fait, et VRM n'a ni appel à
    payer, ni risque d'API.
  - VRM ne propose sa propre version que si tu veux le déclencheur **« après
    livraison confirmée par le transporteur »**, qu'eBay n'a pas. C'est le
    réglage déjà spécifié dans `spec-litiges.md` (éteint par défaut, mémo écrit
    avant l'appel). Il lit d'abord `GetItemsAwaitingFeedback`, ce qui évite un
    doublon avec le réglage natif.

### 4.4 Les messages d'un vendeur pro, et ce que l'agent en fait

Règles communes à tous les messages :
- **vouvoiement** ;
- **aucun lien** ;
- **aucun numéro de rangement** : le N°, c'est ton carton, pas l'affaire de
  l'acheteur ;
- **aucune promesse** de remboursement ni de date que VRM ne connaît pas ;
- **ton texte** : modifiable dans Réglages, avec les variables entre accolades.

Ce que fait l'agent, message par message :

| message | il apporte quoi ? | mode |
|---|---|---|
| **Merci pour votre achat** | une touche humaine (eBay a déjà confirmé la commande) | **réglage éteint par défaut** |
| **Colis expédié + suivi** | **rien** : eBay l'envoie déjà | **jamais** (ce serait un doublon) |
| **Votre colis vous attend au point relais, jusqu'au {date}** (envoyé **2 jours avant** la date limite, s'il n'est pas retiré) | **évite un colis non réclamé**, qui revient et finit en remboursement | **réglage éteint par défaut**, envoyé **seulement si la date limite est CONNUE** par le transporteur |
| **Le transporteur indique une livraison le {date}** (+ une phrase neutre et facultative sur l'évaluation) | un contact rassurant ; aide à recevoir une évaluation | **réglage éteint par défaut** ; la phrase sur l'évaluation est un second interrupteur |
| **Problème de transport** (bloqué, non distribuable, retour) | évite que l'acheteur ouvre une demande « objet non reçu » | **message préparé, envoyé sur ton clic**, jamais automatique : ce qu'on y dit t'engage (attendre, renvoyer, rembourser) |
| **Paire à l'authentification** | — | **aucun message de transport** |

**Les textes proposés** (modifiables) :

- *Merci* : « Bonjour, merci pour votre achat ! Votre paire part dans les
  {délai} jours ouvrés ; le numéro de suivi apparaîtra sur votre commande eBay
  dès l'envoi. Belle journée, {signature} »
  `{délai}` = le délai d'expédition de l'annonce. **S'il est inconnu, cette
  phrase est retirée**, jamais remplacée par un chiffre inventé.
- *Point relais* : « Bonjour, votre colis {transporteur} vous attend au point
  relais. Il peut y être retiré jusqu'au {date limite} ; passé cette date, il me
  sera renvoyé automatiquement. Le suivi est sur votre commande eBay. Merci !
  {signature} »
- *Livré* : « Bonjour, {transporteur} indique que votre colis a été livré le
  {date}. J'espère que la paire vous plaît ! Si quelque chose ne va pas,
  écrivez-moi ici, je réponds vite. {signature} »
  Phrase facultative, sans exigence et sans contrepartie : « Si tout vous
  convient, une évaluation est toujours appréciée. »
- *Problème* (préparé, à relire) : « Bonjour, le suivi {transporteur} signale
  {incident en clair} depuis le {date}. Je m'en occupe auprès du transporteur et
  je reviens vers vous au plus vite. {signature} »

**Un contrôle avant chaque envoi** : le texte RENDU (variables remplies) est
refusé s'il contient :
- une adresse web ;
- un email ;
- une suite de 9 chiffres ou plus qui n'est pas le numéro de suivi de la
  commande ;
- une variable non remplie (`{`).

On juge la règle sur ce qui part, pas l'orthographe du gabarit (§6.5).

---

## 5. Ce que VRM fait déjà pour Vinted, et que l'agent eBay réutilise

**Une notion, une règle, un propriétaire (§11).** L'agent eBay n'écrit pas un
second système de colis : il branche eBay sur celui qui existe.

| existant (Vinted) | où | ce que l'agent en fait |
|---|---|---|
| `aExpedier`, `toShip`, publication `vrm_colis_aposter`, consommés par Ma journée, la cloche, le widget et le rappel du matin | `src/App.jsx`, `api/widget.js`, `api/ship-reminders.js` | eBay y entre par **`aExpedierEbay`** (`spec-expedier.md`, recopiée côté serveur), à côté de `aExpedier`. Jamais une seconde liste « à poster ». |
| `limiteExpedition` (la date limite d'un envoi) | `src/App.jsx` | pour eBay, la date limite est `shipByDate` (donnée par eBay, jamais estimée) ; la carte la montre de la même façon |
| **`posteSansDepart`** (« coché posté, jamais vu partir » : statut lu APRÈS la coche, 48 h ou date limite dépassée) | `src/App.jsx` | **la même idée** pour eBay : `etiquetteSansScan` = bordereau ou suivi chargé, aucun évènement `pris_en_charge` 48 h après, ou `shipByDate` dépassée. Même seuil `POSTE_SANS_DEPART_H`, même bloc dans Colis, même ligne dans Ma journée. |
| `parseCarrierEmail` + `detecterTransporteur` ⇒ lignes `email_track_{transporteur}_{suivi}` (`delivered` · `available` · `transit`) | `api/email-inbound.js` | **un second témoin, gratuit, par n° de suivi** : quand le transporteur t'écrit en tant qu'expéditeur (mesuré : 15 « livrés » Chronopost reliés à des bordereaux), la ligne d'email dont le suivi **est exactement** celui de la commande eBay vaut un évènement. Jamais sans numéro, jamais par titre. |
| normalisation `String(suivi).trim().toUpperCase()` (`suivisRetires`, `colisRetireAilleurs`) | `src/App.jsx` | la même clé pour comparer un suivi eBay, un suivi d'email et un suivi d'agrégateur |
| `CARRIERS` (nom, couleur, mode de retrait) et `trackUrl` | `src/App.jsx` | affichage dans Colis ; `trackUrl` **pour toi seulement** (jamais dans un message à l'acheteur : un lien y est interdit). On y ajoute la correspondance avec les codes transporteur d'eBay. |
| catégories de notifications : `expedier` (allumée), `colis` (allumée), `suivi` (**éteinte** : « en transit, livré : rien à faire ») ; `pushOnce` (dédoublonnage) | `api/_lib/push.js` | « à poster » et « pas scanné » ⇒ `expedier` ; transit et livré ⇒ `suivi` (éteinte, comme Vinted) ; problème ou retour ⇒ **nouvelle catégorie `livraison`, allumée**. `PUSH_CATS` doit rester identique dans l'app et sur le serveur (l'audit le compare). |
| la boucle par vendeur du matin (`traiterVendeur`, `contexteVendeur`, `scoped()`) | `api/ship-reminders.js` | une étape `suiviEbayVendeur()` dans `veilleEbayVendeur()` (chantier `veille`) |
| journal relisible de ce qui est parti en ton nom (`panel_msg_repondus`, `ebay_retraits_auto`) | extension, `api/ebay.js` | **même forme** pour les messages eBay : `ebay_messages_auto{suffixe}`, les 50 derniers, écrit seulement si sa lecture a réussi |
| mémo écrit **AVANT** l'envoi, écriture **vérifiée** (bilan de la semaine) | `api/_lib/bilan-semaine.js` | même motif : un message n'est jamais envoyé deux fois |

**Ce qui ne se réutilise PAS :**
- `isAtRelayStatus`, `codeRetrait` et `panel_colis_relais` : c'est le côté
  **acheteur** (tes achats Vinted). Sur une vente eBay, c'est **ton client** qui
  retire le colis, pas toi.
- Le sens Vinted de `needs_action` (« à expédier » sur une vente, « à retirer »
  sur un achat).

---

## 6. Recommandation : la boucle complète d'une vente eBay

### 6.1 La chaîne d'identité (rien d'autre ne relie quoi que ce soit)

```
orderId (eBay) ─► lineItemId ─► SKU VRM-{n°} ─► ta paire, ton carton
      │
      └─► n° de suivi :  (a) bordereau acheté par VRM pour CET orderId (rangé à l'achat)
                         (b) getShippingFulfillments(orderId) chez eBay
                              │
                              └─► évènements : API du transporteur, ou webhook de l'agrégateur
                                   (identifiant d'envoi chez lui), ou ligne email_track au MÊME numéro
```

- Une commande **sans SKU** ne désigne pas de carton : le suivi marche quand
  même, mais la carte dit « annonce pas reliée à une paire ».
- Un **numéro absent** vaut `pas_su`. On ne cherche jamais un colis « qui
  ressemble ».

### 6.2 État par état

| # | étape | comment VRM le sait | ce que l'agent fait seul | réglage (éteint par défaut) | ton clic | ce que tu vois |
|---|---|---|---|---|---|---|
| E0 | **payée, à poster** | `getOrder` : `PAID`, pas d'envoi ; sonnette de vente (`veille`) | met la vente dans Colis et Ma journée avec le N° du carton et `shipByDate` ; « ne poste pas » si l'acheteur demande l'annulation (`spec-expedier`) | message « merci » | acheter le bordereau dans eBay **ou** par VRM (étude « bordereaux ») | Colis : groupe « à poster » ; Ma journée : « 1 colis eBay avant le 14/10 » ; notification « Vendu sur eBay : N°214 » |
| E1 | **bordereau créé** | (a) VRM l'a acheté : numéro et identifiant d'envoi rangés **avec l'orderId** ; (b) eBay : `ITEM_MARKED_SHIPPED` **[à vérifier]**, ou relecture de `getShippingFulfillments` | (a) **déclare l'envoi chez eBay** (`createShippingFulfillment`), car le numéro vient du bordereau acheté pour cette commande ; (b) rien : eBay l'a déjà déclaré | — | (c) un suivi **tapé par toi** ⇒ envoi sur ton clic (`spec-expedier`, action `expedier`) | Colis : « bordereau prêt · Chronopost XW… » |
| E2 | **pris en charge** (1er scan) | transporteur / agrégateur / email « déposé » au même numéro | range l'évènement ; la vente passe dans « Partis » | — | — | Colis : « parti le 11/10 » ; rien dans Ma journée |
| E2' | **⚠ pas scanné** | `etiquetteSansScan` : 48 h sans scan, ou `shipByDate` dépassée | alerte | — | ouvrir la vente sur eBay ; réclamer au transporteur | Ma journée : « 1 colis eBay pas encore scanné » ; notification (`expedier`) |
| E3 | **en transit** | idem | range ; **aucune notification** (§7, rien à faire) | — | — | Colis : « en transit » |
| E4 | **au point relais** (date limite si connue) | idem | range ; programme le rappel J-2 si la date limite est connue | **rappel à l'acheteur 2 jours avant**, une seule fois | — | Colis : « attend au relais jusqu'au 14/10 » |
| E5 | **livré** | `DI1` / « Delivered » / email `delivered` au même numéro | range **la preuve de livraison** (transporteur, code, date de l'évènement), sans adresse ; la vente sort de Colis | message « livré » (+ phrase d'évaluation, second interrupteur) ; évaluation « après livraison » (`spec-litiges`) — ou le réglage natif d'eBay | — | la vente porte « livré le 12/10 · preuve gardée » ; rien dans Ma journée |
| E6 | **⚠ problème** | `PB1`, non distribuable, échec de livraison ; ou **aucun évènement depuis 5 jours ouvrés** en transit ; ou date de livraison estimée maximale + 3 jours ouvrés dépassée sans livraison | alerte ; prépare le message « problème » | — | **envoyer le message préparé** (relu) ; réclamation au transporteur | Ma journée : « 1 colis eBay bloqué depuis le 9/10 » ; notification (`livraison`) |
| E7 | **retour à l'expéditeur** | `RE1` / « Returned » | alerte : « la paire revient » ; **ne la remet jamais en vente toute seule** (chantier `annonces-vivantes`) | — | décider avec l'acheteur dans eBay (renvoi ou remboursement) | Ma journée + notification (`livraison`) |
| A | **chez l'authentificateur** | `program.authenticityVerification` présent | suit le colis jusqu'à l'authentificateur, puis lit `status` (`PASSED`, `FAILED`) ; **aucun message à l'acheteur** | — | — | Colis : « livré à l'authentificateur d'eBay » |
| ? | **pas su** | lecture ratée, transporteur non couvert, pas de numéro | **ne fait rien** : aucun message, aucune étape inventée | — | — | une ligne, dite **une fois** : « suivi pas lu pour 2 colis (Mondial Relay : pas d'accès direct) » |

### 6.3 Quand l'agent regarde (sans nouvelle fonction ni nouveau cron Vercel)

1. **Chaque matin** (cron existant `ship-reminders`, 08:00 UTC, par vendeur)
   - étape `suiviEbayVendeur()` ;
   - relit les envois des commandes « en vol » (pas encore livrées, de moins de
     45 jours), puis le transporteur de chacun ;
   - envoie les messages dus (rappel J-2, livré) si allumés.
2. **À l'ouverture de Colis ou de Ma journée** : relit les colis en vol de plus
   de 6 h (borné, 10 au plus).
3. **Les sonnettes**, qui ne sont jamais des données : elles **réveillent** une
   relecture faite avec le jeton du vendeur.
   - webhook de l'agrégateur (Boxtal `TRACKING_CHANGED`, signature
     `x-bxt-signature` vérifiée sur le corps brut ; Sendcloud
     `parcel_status_changed`). Ce serait un **mode** d'une fonction existante :
     `api/ebay.js?mode=transporteur`. Le plafond est de 12 fonctions ;
   - eBay `ITEM_MARKED_SHIPPED` (chantier `veille`).
4. **Option, ton geste : un relevé toutes les heures**
   - activer `pg_cron` + `pg_net` dans Supabase, absents aujourd'hui ;
   - appeler la route du matin chaque heure, avec la clé `CRON_SECRET` rangée
     dans le coffre (`supabase_vault`, installé) ;
   - aucun cron Vercel ajouté (un cron refusé bloquerait tous les
     déploiements).

   Disponibilité de ces extensions sur ton projet : **[à vérifier]**.
   Sans ça, le **rappel J-2** reste fiable : une fois par jour suffit pour un
   délai qui se compte en jours.

**Les bornes :**
- 1 lecture du transporteur par colis et par passage ;
- on arrête dès une étape finale (`livre`, `retour`) ;
- `getShippingFulfillments` est en REST Fulfillment (100 000 appels par jour) :
  il ne consomme **pas** le quota Trading (5 000 par jour pour **toute**
  l'application) ;
- seuls les messages consomment le quota Trading : au plus quelques-uns par
  vente.

### 6.4 Les messages : plafonds, mémo, journal

- **Un message par type et par commande, jamais deux.** Le mémo
  `ebay_messages_dedup{suffixe}` est écrit **avant** l'appel, et son écriture
  est **vérifiée**. Mémo illisible ⇒ rien. Mémo non écrit ⇒ rien.
- **Les plafonds** (dans Réglages, avec des défauts prudents) :
  - **20 messages par jour** et par compte eBay ;
  - **3 par commande**, tous types confondus.
- **« Pas su » n'envoie rien.** Les cas :
  - étape lue avant un échec ;
  - date limite inconnue (pas de rappel J-2) ;
  - réglage pas encore arrivé du nuage ;
  - commande annulée, ou annulation demandée ;
  - authentification en cours ;
  - plus de 90 jours après la commande (limite d'`AAQToPartner`).
- **Avec le jeton du compte eBay qui porte la commande** (`resoudreCompte`).
  Jamais le jeton d'un autre compte ni d'un autre vendeur.
- **Le journal** `ebay_messages_auto{suffixe}` garde les 50 derniers :
  - le texte exact parti ;
  - le type ;
  - l'orderId ;
  - la date ;
  - la réponse d'eBay.

  Il est affiché dans eBay → Compte, sous « Ce que VRM a fait en ton nom ».
  ⚠️ **Un message envoyé à ta place que tu ne peux pas relire serait le pire de
  tout.**
- **Une réponse incertaine** (coupure après l'envoi) est notée « incertain —
  regarde ta messagerie eBay ». Elle **n'est jamais renvoyée** toute seule.

### 6.5 Ce que tu vois

- **Colis.** Les ventes eBay sont mêlées aux Vinted, dans les groupes
  existants :
  - « à poster » ;
  - « Partis — suivi transporteur » : une ligne d'étape par colis.

  Le compte eBay est nommé une fois quand ils sont tous sur le même (§7).
- **Ma journée.** Seulement ce qui demande un geste : à poster (avec la date
  limite), pas scanné, bloqué, retour. Plus, s'il y en a, « 2 messages envoyés
  en ton nom aujourd'hui — les relire ».
- **Notifications :**
  - vente (existe) ;
  - à poster et pas scanné (`expedier`, allumée) ;
  - problème et retour (`livraison`, allumée) ;
  - transit et livré (`suivi`, éteinte, comme pour Vinted).
- **Sur la vente** (eBay → Ventes) : la frise des étapes, et **« preuve de
  livraison »**, à montrer en cas de litige « objet non reçu ».
- **Réglages → eBay → « Ce que VRM fait seul »** : les interrupteurs (tous
  éteints par défaut), tes textes, les plafonds, et le journal.

### 6.6 Plusieurs vendeurs, données, clés

- **Les clés de suivi « public »** (La Poste Suivi v2) : une clé **de VRM**
  (installation), car elle ne lit que des numéros de suivi, pas un compte
  vendeur. Elle est rangée sur Vercel (`LAPOSTE_OKAPI_KEY`), jamais dans le
  dépôt. Les résultats sont rangés **par vendeur** (`owner`), lus sous RLS.
  ⚠️ Quota partagé par tous les vendeurs, et conditions d'utilisation de la clé
  **[à vérifier]**. **À trancher par Julien** : une clé VRM, ou une clé par
  vendeur.
- **Les clés qui achètent ou qui sont liées à un contrat** (Boxtal, Sendcloud,
  Mondial Relay pro) : **une par vendeur**, rangées **chiffrées** côté serveur
  (`supabase_vault`). Jamais dans `app_data`, jamais renvoyées au navigateur.
  Une clé d'un vendeur ne sert jamais pour un autre.
- **Ce qu'on garde d'un colis :**
  - orderId, ligne de commande, SKU ou N° ;
  - transporteur, numéro, étape ;
  - évènements (code, date, étape) ;
  - date limite, date de relecture.

  **Aucune adresse, aucun nom.** Le nom du point relais n'est pas gardé non
  plus : il dit où vit l'acheteur.
- **Le pseudo de l'acheteur** (nécessaire pour écrire) : déjà gardé par
  `commandeMinimale` (`buyer.username`), jamais copié ailleurs. À la
  notification de suppression de compte eBay, il est anonymisé (`socle`), et
  plus aucun message ne part.
- Rien n'est écrit dans un journal du serveur au-delà de l'orderId et de
  l'étape.

### 6.7 Les preuves attendues (pour la session qui construit)

Méthode §6.1 : chaque contrôle doit être rouge sur le code d'avant **et** rouge
sous mutation.

- **`scripts/audit-ebay-suivi.cjs`.** Il exécute `etapeColis` dans un `vm` :
  - une matrice La Poste, Sendcloud, eBay et email ;
  - un code inconnu ne vaut jamais `livre` ;
  - une étape ne recule pas ;
  - l'authentification ne donne jamais « livré à l'acheteur ».
- **`etiquetteSansScan`.** Il ne se déclenche qu'avec un envoi daté et un
  statut lu après. Il est silencieux sur « pas su ».
- **La route.** Elle tourne dans un `vm`, avec un faux eBay et un faux
  transporteur :
  - le numéro est pris dans `getShippingFulfillments` **de cette commande**
    seulement ;
  - une commande d'un autre compte ou d'un autre vendeur donne 404 et aucune
    lecture ;
  - une lecture ratée n'écrit rien (lecture KO, écriture OK : le cas qui
    détruit) ;
  - le webhook sans signature valide ne réveille rien.
- **Les messages :**
  - éteint ⇒ 0 envoi ;
  - mémo illisible ⇒ 0 ;
  - mémo non écrit ⇒ 0 ;
  - deux passages ⇒ 1 envoi ;
  - date limite inconnue ⇒ pas de rappel J-2 ;
  - authentification ⇒ 0 ;
  - un texte rendu avec une URL, un email ou un `{` ⇒ refusé ;
  - plafond atteint ⇒ 0 ;
  - au-delà de 90 jours ⇒ 0 ;
  - coupure ⇒ « incertain », jamais renvoyé.

  Mutations : mémo écrit après l'envoi · contrôle d'URL retiré · « pas su »
  traité comme un échec à réessayer.
- **Banc de rendu `scripts/bancs/ebay-suivi.cjs`** (données inventées, port
  réservé, 390 et 1 512 px) :
  - Colis montre chaque étape ;
  - « pas scanné » et « bloqué » apparaissent dans Ma journée, avec le même
    nombre que dans Colis ;
  - « pas su » est dit une fois, jamais « tout est à jour » ;
  - le journal des messages se relit.

---

## 7. Ce qui reste à mesurer, et tes premiers gestes

**À vérifier au premier vrai essai** (rien n'a été appelé d'ici) :

1. La forme de la réponse de La Poste Suivi v2 :
   - le code « au point de retrait » ;
   - la **date limite de retrait** ;
   - les quotas de la clé gratuite.
2. Que `getShippingFulfillments` rende bien le numéro et le transporteur d'un
   bordereau **acheté dans eBay**, et sous quelle forme pour Mondial Relay (le
   numéro à 8 chiffres ?).
3. `AddMemberMessageAAQToPartner` avec le jeton OAuth de VRM, sur eBay.fr :
   - la longueur maximale du texte ;
   - l'effet du passage « pseudo → identifiant fixe ».
4. La portée et le contenu de `ITEM_MARKED_SHIPPED`.
5. Mondial Relay :
   - as-tu un compte pro (« Connect ») avec code enseigne et clé privée ?
   - sinon, l'agrégateur retenu par l'étude « bordereaux » donne-t-il le suivi ?
6. Si les transporteurs t'écrivent aussi, en tant qu'expéditeur, pour un
   bordereau acheté **dans eBay** (le témoin email gratuit).
7. La disponibilité de `pg_cron` et `pg_net` sur ton projet Supabase.

**Tes gestes (aucun n'est urgent avant ta première vente eBay) :**

1. **Relier ton annonce eBay sans SKU à sa paire** : 2 sur 3 le sont. Sans SKU,
   le suivi marche, mais VRM ne sait pas de quel carton sort la paire.
2. **Allumer « Automatiser les évaluations » dans eBay** (préférences de vente),
   si tu veux l'évaluation positive automatique. Rien à faire dans VRM.
3. Le propriétaire de VRM (toi) :
   - crée **une clé « Suivi » sur developer.laposte.fr** ;
   - la pose sur Vercel (`LAPOSTE_OKAPI_KEY`).
4. **Choisir les messages** que VRM envoie en ton nom (tous éteints par
   défaut). Mon conseil : le **rappel J-2 au point relais** d'abord, c'est
   celui qui évite des retours. Le « merci » et le « livré », si tu aimes ce
   contact.
5. **À ta première vente eBay** :
   - regarder Colis : la vente avec son N°, puis les étapes après le
     bordereau ;
   - comparer avec ce qu'eBay affiche ;
   - relire le journal si un message est parti.

---

## 8. Sources

Aucune page officielle n'a pu être ouverte (bloquée depuis le conteneur). La
provenance est indiquée pour chaque lien.

**eBay — expédition, commandes, livraison**
- [createShippingFulfillment](https://developer.ebay.com/api-docs/sell/fulfillment/resources/order/shipping_fulfillment/methods/createShippingFulfillment) — repris de `possible.md`, déjà sourcé le 9 octobre.
- [ShippingFulfillment (type)](https://developer.ebay.com/api-docs/sell/fulfillment/types/sel:ShippingFulfillment) et [Managing fulfillments](https://developer.ebay.com/api-docs/sell/static/orders/managing-fulfillments.html) — extraits de moteur.
- [ShippingPackageInfoType (Trading)](https://developer.ebay.com/devzone/xml/docs/reference/ebay/types/ShippingPackageInfoType.html) et [GetOrders](https://developer.ebay.com/devzone/xml/docs/reference/ebay/getorders.html) — extraits de moteur : « no longer applicable ».
- [ShipmentTrackingType (Post-Order)](https://developer.ebay.com/devzone/post-order/types/ShipmentTrackingType.html) — extrait de moteur.
- [getTopics / Notification API](https://developer.ebay.com/api-docs/commerce/notification/resources/topic/methods/getTopics), [Notification release notes](https://developer.ebay.com/develop/api/buy/release_notes) et [Newsletter T2 2026](https://developer.ebay.com/updates/newsletter/q2_2026) — extraits de moteur : `ITEM_MARKED_SHIPPED`, `ORDER_CONFIRMATION`.
- [Aide eBay.fr — Imprimer et annuler des bordereaux](https://www.ebay.fr/help/selling/shipping-items/labels-packaging-tips/buying-printing-shipping-labels?id=4157), [Effectuer le suivi des objets vendus](https://www.ebay.fr/help/selling/shipping-items/effectuer-le-suivi-des-objets-que-vous-avez-vendus?id=4088), [Livraison pour les particuliers](https://pages.ebay.fr/frais-expedition/) — extraits de moteur.

**eBay — performance et protection**
- [Statuts des vendeurs et normes de performance (eBay.fr)](https://www.ebay.fr/help/selling/selling/statuts-des-vendeurs-et-normes-de-performance?id=4080), [Règlement sur les défauts (eBay.fr)](https://www.ebay.fr/help/policies/selling-policies/seller-performance-policy/seller-performance-defect-removal-policy?id=4352) et [Règlement (eBay.ca, en français)](https://www.cafr.ebay.ca/help/policies/selling-policies/seller-standards-policy?id=4347) — extraits de moteur.
- [getSellerStandardsProfile](https://developer.ebay.com/api-docs/sell/analytics/resources/seller_standards_profile/methods/getSellerStandardsProfile) et [Analyzing seller performance](https://developer.ebay.com/api-docs/sell/static/performance/analyzing-performance.html) — extraits de moteur.
- [edesk.com (litiges eBay)](https://www.edesk.com/fr/blog/comment-resoudre-les-litiges-avec-les-acheteurs-sur-ebay-avant-quils-ne-saggravent-guide-a-lintention-des-vendeurs/) — source secondaire : délais « objet non reçu » **[à vérifier]**.

**eBay — messages et évaluations**
- [AddMemberMessageAAQToPartner](https://developer.ebay.com/devzone/xml/docs/reference/ebay/AddMemberMessageAAQToPartner.html), [MemberMessageType](https://developer.ebay.com/devzone/xml/docs/reference/ebay/types/MemberMessageType.html) et [Base de connaissances 1508](https://developer.ebay.com/support/knowledge-base/1508) — extraits de moteur.
- [Message API — sendMessage](https://developer.ebay.com/api-docs/commerce/message/resources/conversation/methods/sendMessage), [Sell communications guide](https://developer.ebay.com/develop/guides-v2/sell-communications-guide) et [Message API (doc japonaise d'eBay)](https://ebay.co.jp/developer/api/message_api/documentation) — extraits de moteur.
- [Member-to-member contact policy](https://www.ebay.com/help/policies/member-behavior-policies/membertomember-contact-policy?id=4262), [Spam policy](https://www.ebay.com/help/policies/member-behavior-policies/spam-policy?id=5033) et [Offering to buy or sell outside of eBay](https://www.ebay.com/help/policies/payment-policies/offers-buy-sell-outside-ebay-policy?id=4272) — extraits de moteur.
- [Feedback manipulation policy](https://www.ebay.com/help/policies/feedback-policies/feedback-manipulation-policy?id=4231) et [Seller performance manipulation policy](https://www.ebay.com/help/policies/prohibited-restricted-items/seller-performance-manipulation-policy?id=4629) — extraits de moteur.
- [Automatic feedback (eBay.co.uk)](https://wwww.ebay.co.uk/help/selling/selling-seller-performance/automatic-feedback?id=4101) et [eBay Canada, 2022](https://www.ebay.ca/sellercentre/resources/seller-updates/2022-winter/listing) — extraits de moteur.
- [ChannelX 2011 (courriels automatiques retirés)](https://channelx.world/2011/05/smp-auto-emails-retired-new-auto-emails-to-be-sent/) et [ChannelX 2009 (rappel d'évaluation)](https://channelx.world/2009/11/why-you-need-to-update-your-smp-auto-emails/) — source secondaire ancienne **[à vérifier]**.
- [LeaveFeedback](https://developer.ebay.com/devzone/xml/docs/reference/ebay/LeaveFeedback.html) et [GetItemsAwaitingFeedback](https://developer.ebay.com/devzone/xml/docs/reference/ebay/GetItemsAwaitingFeedback.html) — extraits de moteur.

**Transporteurs**
- [Okapi — developer.laposte.fr](https://developer.laposte.fr/) — extrait de moteur.
- [debuss/lapostesuivi (GitHub)](https://github.com/debuss/lapostesuivi), [e-amzallag/laposte-suivi-api — codes d'évènement](https://github.com/e-amzallag/laposte-suivi-api/blob/master/src/main/java/org/dajlab/laposte/domaine/LPCodeEvenement.java), [rigwild/suivi-poste](https://github.com/rigwild/suivi-poste/blob/master/index.ts) et [apis.io — La Poste Groupe](https://apis.io/providers/la-poste-groupe/) — sources secondaires.
- [Forum developpez.net (Okapi)](https://www.developpez.net/forums/d2132356/php/edi-cms-outils-scripts-api/authentification-l-api-suivie-poste-okapi/) — forum : « 100 appels/s » **[à vérifier]**.
- [Colissimo — CDC WebService TimeLine v2.1](https://www.colissimo.entreprise.laposte.fr/sites/default/files/2021-08/CDC_WebServiceTrackingTL-v2.1_FR.pdf) — extrait de moteur.
- [Mondial Relay — Présentation des WebServices (avril 2025)](https://storage.mondialrelay.fr/Pr%C3%83%C2%A9sentation%20des%20WebServices.pdf), [Web Service V-5.11](https://www.mondialrelay.fr/media/124122/solution-web-service-v511.pdf) et [Connect V-1.2](https://www.mondialrelay.fr/media/124728/fr-documentation-utilisateur-connect-v-12.pdf) — extraits de moteur, documents officiels.
- [DigitalGenius — Mondial Relay Track & Trace](https://docs.digitalgenius.com/docs/mondial-relay-track-trace) et [smart-dato/mondial-relay-sdk](https://packagist.org/packages/smart-dato/mondial-relay-sdk) — sources secondaires.
- [kwaadpepper/chronopost-tracking](https://root.packagist.org/packages/kwaadpepper/chronopost-tracking) — source secondaire.
- [UPS API (guide tiers)](https://atoship.com/blog/ups-shipping-api-integration-developer-guide) — source secondaire.

**Agrégateurs**
- [Boxtal v3 — tracking events](https://developer.boxtal.com/fr/en/apiv3/guide/tracking-events-api-v3) et [Boxtal v3 — subscriptions](https://developer.boxtal.com/fr/en/apiv3/guide/subscriptions-api-v3) — extraits de moteur.
- [Sendcloud — parcel_status_changed v3](https://sendcloud.dev/api/v3/webhooks/parcel-status-changed), [v2](https://sendcloud.dev/api/v2/webhooks/parcel-status-changed) et [parcel statuses](https://sendcloud.dev/api/v2/parcel-statuses) — extraits de moteur.
- [Zapier — Packlink PRO](https://zapier.com/apps/packlink-pro) — source secondaire.
- [Track123 vs 17TRACK](https://www.track123.com/blog/track123-vs-17track), [Ship24 — 17TRACK](https://www.ship24.com/fr/boutiques/suivi-colis-17track), [AfterShip — Mondial Relay](https://www.aftership.com/carriers/mondialrelay/api) et [TrackingMore — Mondial Relay](https://www.trackingmore.com/mondialrelay-tracking.html) — sources secondaires.

**Déjà établi dans ce projet**
- `../agent-ebay/possible.md` §3.4 à 3.7 et 3.13, `spec-expedier.md`,
  `spec-veille.md`, `spec-litiges.md`, `spec-socle.md`.
- `CLAUDE.md` : §5 (retrait, codes, emails), §11, « rien lu ne vaut pas
  rien », plan Hobby.
