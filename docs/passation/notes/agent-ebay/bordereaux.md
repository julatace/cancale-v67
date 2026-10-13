# Les bordereaux eBay par API, depuis la France

**Pour :** Julien, et les sessions qui construiront l'« agent eBay autonome ».
**Rédigé le :** 11 octobre 2026.
**Pendant de :** `suivi.md` (dans ce même dossier), qui traite du suivi du colis
et des messages à l'acheteur. Ce document-ci traite de **l'achat du bordereau**.

**Comment lire les sources.** Les sites officiels (`developer.ebay.com`,
`ebay.fr`, `pages.ebay.fr`, `developer.boxtal.com`, `sendcloud.dev`,
`mondialrelay.fr`, `colissimo.entreprise.laposte.fr`, `chronopost.fr`,
`packlink.com`) sont **bloqués** depuis ce conteneur (403 du proxy ou
`ENOTFOUND`, vérifié le 11 octobre). Chaque fait porte donc son origine :

| marque | ce que ça veut dire |
|---|---|
| **(code lu)** | j'ai lu le fichier en entier : code open source téléchargé depuis GitHub ou npm |
| **(extrait officiel)** | extrait d'une page officielle, renvoyé par un moteur de recherche ; la page elle-même n'a pas été lue |
| **(secondaire)** | blog, forum, comparateur, bibliothèque non officielle |
| **[à vérifier]** | pas établi. Une impossibilité non mesurée est une opinion ; une possibilité non sourcée aussi |

**Aucun appel** n'a été fait à eBay, à un transporteur, à un agrégateur ou à
Vinted. Sa base n'a été lue qu'en lecture, projetée (§6).

---

## 0. En une page

**La question :** une paire est vendue sur eBay. VRM peut-il **acheter le
bordereau lui-même**, l'imprimer, et connaître le numéro de suivi sans rien
deviner ?

1. **eBay ne vend aucune étiquette par API en France.** Sa Logistics API est
   réservée à des partenaires approuvés, ne fait que de l'USPS, et seulement
   pour des colis partis des États-Unis. Sur eBay.fr, le bordereau s'achète
   **dans l'interface** d'eBay. Une « Labels API » eBay serait annoncée en bêta
   pour fin 2026, mais pour les transporteurs **britanniques**. Rien pour la
   France aujourd'hui (§1).

2. ⚠️⚠️ **Le point qui décide de tout le reste, et qu'il faut mesurer AVANT de
   construire.** Sur ton compte eBay, **c'est eBay qui gère la livraison**.
   C'est mesuré le 27 septembre : eBay refuse tout mode de livraison que VRM
   lui envoie (commentaire dans `api/ebay.js`, l. 624). Et depuis juin 2026,
   une commande eBay peut porter `ShippingLabelPolicy = EBAY_ONLY`, ce qui veut
   dire : **« cette paire doit partir avec une étiquette fournie par eBay »**
   (extrait officiel, notes de version Trading 1455).
   - Si tes commandes portent ce champ, **VRM ne doit PAS acheter de bordereau
     ailleurs**. Tu paierais deux fois, et le suivi ne serait pas celui
     qu'eBay attend.
   - Or **VRM ne peut pas lire ce champ aujourd'hui**. Ses appels Trading sont
     au niveau de compatibilité **1149** (`api/ebay.js` l. 146), et il en faut
     **1455 ou plus**.
   - ⇒ **Premier chantier, sans aucun risque : lire ce champ sur chaque
     commande.**

3. **Pour une commande où l'étiquette est libre** (compte pro, ou d'autres
   vendeurs de VRM) : **oui, VRM peut acheter le bordereau lui-même.**
   - Il passe par l'API d'un agrégateur, **avec le compte et la clé du
     vendeur**.
   - Il crée l'envoi avec une référence = **le n° de la commande eBay**.
   - Le numéro de suivi qui revient est donc connu **par identité** : c'est VRM
     qui a créé ce bordereau pour CETTE commande.
   - VRM le déclare ensuite à eBay (`createShippingFulfillment`).
   - ⇒ La conclusion du 9 octobre, « envoyer un suivi automatiquement est
     impossible faute d'identité commune », **ne tient plus dans ce cas**. Elle
     restait vraie pour un bordereau acheté hors de VRM.

4. **Prestataire recommandé : Boxtal (API v3) d'abord, Sendcloud ensuite.**
   - **Packlink PRO** marche seulement « à moitié » : VRM crée l'envoi, mais tu
     paies dans Packlink.
   - **Les transporteurs en direct** sont écartés : chacun demande son propre
     contrat, et le web service Colissimo est réservé au contrat Privilège
     (§2, §5).

5. **Le point relais choisi par l'acheteur.**
   - L'API eBay n'a **aucun champ** « identifiant du point relais » pour la
     France (mesuré dans le schéma de `getOrder`, §3).
   - Règle : VRM n'achète un bordereau en point relais que s'il **lit** ce point
     sur la commande, par identité.
   - Si l'acheteur a payé une livraison à domicile, le bordereau part à
     domicile.
   - Jamais un point relais « deviné » à partir d'une adresse.

6. **Le poids.** VRM n'en connaît aucun : mesuré, 0 champ de poids ou de taille
   de colis dans tes ventes et tes annonces captées. Il faut un réglage par
   vendeur (1,5 kg et 36 × 24 × 14 cm par défaut), modifiable annonce par
   annonce, et montré dans chaque confirmation (§4).

7. **Ce que tu fais, une fois** (§5.4) :
   - **rien d'abord**, tant que le champ `EBAY_ONLY` n'est pas lu sur tes
     commandes ;
   - s'il est absent : ouvrir un compte pro Boxtal, choisir le prélèvement
     différé, créer une « application API v3 », coller deux clés dans VRM,
     régler le poids et les plafonds.
   - Tant que tu ne l'allumes pas, VRM n'achète rien. Ensuite, chaque achat a
     un plafond et une ligne dans un journal.

---

## 1. eBay lui-même : existe-t-il une étiquette eBay achetable par API en France ?

| voie | ce qui est établi | API ? | source |
|---|---|---|---|
| **Logistics API** (`/sell/logistics/v1`) | « Limited Release », réservée aux développeurs « approuvés ». Elle ne fait que les tarifs et étiquettes **USPS**, pour des colis partis **des États-Unis**, et uniquement pour des commandes eBay. Le vendeur doit avoir un moyen de paiement dans son compte eBay. Routes : `shipping_quote`, `shipment/create_from_shipping_quote`, `download_label_file`, `cancel`. | **non** pour la France | (extrait officiel) Logistics overview + `createFromShippingQuote` ; (code lu) SDK `ebay-api` 10.0.1, août 2026, `dist/api/restful/sell/logistics/index.js` |
| **« Plateforme d'expéditions eBay »** | Conçue avec **Packlink**. Les ventes y arrivent toutes seules, avec le nom et l'adresse de l'acheteur, et le suivi remonte dans Mon eBay. | **non** : c'est une interface web | (extrait officiel) ebay.fr/espacevendeurs/…/plateforme-expeditions ; support-ebay.packlink.com |
| **Acheter le bordereau sur eBay.fr** | Tarifs négociés, payés sur tes fonds eBay. L'adresse et le suivi sont pré-remplis, et un QR code suffit au dépôt. Mondial Relay : **2,78 € TTC** (100–500 g) et **3,58 €** jusqu'à 1 kg, grille relevée le 3 octobre 2026. | **non** | (secondaire) friptadium.com, 3 oct. 2026 ; (extrait officiel) aide eBay.fr « bordereaux » |
| **« eBay by Mondial Relay »** | L'acheteur choisit son Point Relais ou son Locker, en France seulement. C'est **impossible pour un achat de plusieurs objets**. Le vendeur achète le bordereau sur le site de Mondial Relay, **relié à son compte eBay**, et le suivi remonte tout seul dans eBay. | **non** | (extrait officiel) ebay.fr/espacevendeurs/livraison/solutions/mondial-relay ; mondialrelay.fr « eBay by Mondial Relay » |
| **`ShippingLabelPolicy = EBAY_ONLY`** | Champ facultatif sur une ligne de commande, renvoyé **au vendeur seulement** par `GetOrders`, `GetItemTransactions` (1er juin 2026) et `GetSellerTransactions` (24 juin). Il veut dire : **« doit partir avec une étiquette fournie par eBay »**. S'il est absent, aucune règle ne s'applique. Il n'est renvoyé qu'à partir du niveau WSDL **1455**. | lecture seulement | (extrait officiel) notes de version Trading 1455 ; référence `GetOrders` |
| **Royaume-Uni et Australie** | Royaume-Uni : « Simple Delivery » **obligatoire** pour la plupart des particuliers depuis le 15 avril 2025 (étiquettes Royal Mail ou Evri fournies par eBay). Australie : les étiquettes eBay sont obligatoires, d'après la lettre aux développeurs du 2ᵉ trimestre 2026. ⇒ C'est la tendance d'eBay. En France, on ne sait pas si les particuliers y sont obligés depuis le 1ᵉʳ septembre 2026 **[à vérifier]**. | — | (secondaire) valueaddedresource.net, parcel2go ; (extrait officiel) newsletter Q2 2026 |
| **« eBay Labels API »** | Une présentation de la conférence développeurs eBay de juillet 2026 annoncerait une **bêta au 4ᵉ trimestre 2026**, pour les grands vendeurs, les entrepôts et les plateformes, **avec des transporteurs britanniques**. Je n'ai pas lu le document (PDF bloqué) **[à vérifier]**. | pas pour la France à ce jour | (extrait) `developer.ebay.com/cms/files/connect-2026/…keynote…july_2026.pdf` |
| Media API 1.5.0-beta (5 mai 2026) | Ajoute les étiquettes de **retour**. | hors sujet (aller seulement) | (extrait officiel) notes de version Media API |

**Conclusion.** En France, en octobre 2026, **aucune étiquette eBay ne s'achète
par une API ouverte à VRM**. C'est confirmé par la source la plus récente
trouvée (Logistics API : USPS et États-Unis seulement). Les trois façons
d'acheter un bordereau « par eBay » se font toutes **à la main** :
l'interface d'eBay, la Plateforme d'expéditions (Packlink), et le site de
Mondial Relay relié à eBay.

⚠️ **Ce que ça change pour l'agent, et c'est le plus important de ce document.**
Si une commande porte `EBAY_ONLY`, **l'agent n'achète rien ailleurs**. Ce qu'il
fait reste utile :
- il range la vente dans Colis, avec le N° du carton (par le SKU) ;
- il donne **un** bouton qui ouvre la page d'eBay où l'on achète le bordereau ;
- dès que le bordereau est acheté, eBay rattache **lui-même** le suivi à la
  commande. VRM le relit par identité
  (`GET /sell/fulfillment/v1/order/{orderId}/shipping_fulfillment` →
  `shipmentTrackingNumber`, `shippingCarrierCode`), puis suit le colis
  (`suivi.md`).

Ça vaut pour **tout** bordereau acheté hors de VRM (eBay, Packlink, site de
Mondial Relay relié à eBay) : eBay porte le suivi, et VRM le lit **sur la
commande**, jamais par ressemblance.

---

## 2. Les transporteurs et agrégateurs utilisables par API

### 2.1 En un coup d'œil

| | **Boxtal** | **Sendcloud** | **Packlink PRO** | Mondial Relay en direct | Colissimo en direct | Chronopost en direct |
|---|---|---|---|---|---|---|
| Qui peut ouvrir | compte **pro** ; pour commander par l'API, la facturation doit être au nom d'une **entreprise** | e-commerçants, « de l'auto-entreprise aux grands comptes » ; un numéro de TVA ou EORI demandé **[à vérifier]** | e-commerçants **[à vérifier : SIRET ?]** | compte pro en ligne avec SIRET (offre « Start ») | **SIRET** ; le web service est réservé au contrat **Privilège** | contrat Chronopost (n° de compte à 8 chiffres) |
| Abonnement | aucun trouvé **[à vérifier]** | gratuit limité (20 à 50 étiquettes par mois selon les sources), puis payant | aucun frais fixe ; « Premium » en option | sans engagement | Facilité sans engagement ; Privilège : volume | contrat |
| Paiement | **prélèvement différé SEPA**, obligatoire pour commander par l'API | facture ; un moyen de paiement est exigé **[à vérifier]** | **carte ou PayPal, dans Packlink**, ou paiement différé pour certains comptes | prélèvement | prélèvement SEPA mensuel | contrat |
| Achat 100 % par l'API | **oui** (si prélèvement) | **oui** | **non** : l'envoi part « à payer » | oui (API V2) | oui avec Privilège | oui avec contrat |
| Authentification | clé d'accès + clé secrète **par compte** (une « application v3 ») | clé publique + secrète par compte ; **OAuth2 en bêta** | clé API par compte | enseigne + clé privée + identifiants « Connect » API V2 | n° de contrat + mot de passe | n° de compte + mot de passe |
| Bac à sable | **oui** (compte de test, rien n'est facturé, faux suivi) | **[à vérifier]** | oui | enseigne de test `BDTEST13` | `checkGenerateLabel` (vérifie sans générer) | **[à vérifier]** |
| Formats | PDF ; A4 ou 10 × 15 thermique **[à vérifier par transporteur]** | PDF en taille d'origine (souvent A6 = 10 × 15), A4/A5/A6, **ZPL**, PNG | PDF A4 **[10 × 15 à vérifier]** | PDF ; QR code | PDF ; ZPL **[à vérifier]** | PDF **[à vérifier]** |
| Point relais par l'API | **oui** (`parcelPoints`, un code par réseau) | **oui** (`to_service_point`, API des points) | **oui** (`dropoffs/{service}/{pays}/{cp}`, `dropoff_point_id`) | oui (WSI4) | oui (points de retrait) | oui (Chrono Relais) |
| Suivi rendu | oui (`tracking(id)`) | oui (`tracking_number`) | oui (`shipments/{ref}/track`) | oui | oui | oui |
| Webhooks | **oui** : `TRACKING_CHANGED`, `DOCUMENT_CREATED`, signés HMAC (`x-bxt-signature`) | **oui** : `parcel_status_changed`, signé HMAC (`Sendcloud-Signature`) | **oui** : `shipment.label.ready`, `.tracking.update`, `.delivered`… | **[à vérifier]** | non (lecture : API Suivi de La Poste) | **[à vérifier]** |
| Annulation | **par l'API, avant le dépôt, remboursée** | par l'API ; gratuite le jour même, sinon créditée sous 42 jours si le colis n'est pas parti | **par un ticket au support** (pas l'API), 15 jours ; remboursement sous 96 h à 10 jours | **[à vérifier]** | **[à vérifier]** | **[à vérifier]** |
| Logiciel tiers pour ses clients | prévu (applications v3 ; modules tiers comme BordereauFacile) | **prévu et documenté** (« marketplaces » : centralisé, décentralisé, hybride) | **prévu** (modules officiels, enregistrement « integrations ») | intégrateurs (Shopify, WooCommerce) | intégrateurs | intégrateurs |

Le détail et les sources de chaque case sont dans les fiches ci-dessous.

### 2.2 Les prix d'un colis de 1 kg — ordres de grandeur

Aucun agrégateur ne publie de grille lisible depuis ce conteneur. Voici les
**prix publics** connus, pour se repérer :

| | point relais | domicile | source |
|---|---|---|---|
| Mondial Relay, guichet public | **5,99 € TTC** (depuis le 15 juin 2026) | **9,49 €** | (secondaire) margeoapp.com, ShippyPro ; (extrait officiel) mondialrelay.fr/…/tarifs-expeditions |
| Mondial Relay pro, offre « Start » | « dès **3,09 € HT** » (le petit colis) | — | (extrait officiel) mondialrelay.fr/…/offre-start |
| Colissimo, guichet public | 8,89 € (point de retrait) | **9,59 €** | (secondaire) ShippyPro, tarifs 2026 |
| Mondial Relay acheté **dans eBay** | **3,58 €** jusqu'à 1 kg | — | (secondaire) friptadium, 3 oct. 2026 |
| Agrégateur, point relais ≤ 1 kg | environ 4,50 à 5,50 € | — | (secondaire) bordereaufacile.fr — pas propre à Boxtal |

⚠️ **Une paire de baskets dans sa boîte pèse plutôt 1 à 2 kg** (ordre de
grandeur, rien de mesuré) : c'est la **tranche 1–2 kg** qui s'appliquera, plus
chère que les prix ci-dessus **[à vérifier sur le premier devis]**. Et l'étiquette
achetée **dans eBay** semble moins chère que chez un agrégateur. C'est un
argument de plus pour ne pas acheter ailleurs quand eBay fournit l'étiquette.

### 2.3 Boxtal — le meilleur candidat pour VRM

- **Accès.**
  - On crée une « application API v3 » dans l'espace développeur de Boxtal :
    elle donne une **clé d'accès** et une **clé secrète**, utilisées en
    authentification Basic (code lu : README `ErnadoO/boxtal`).
  - Une authentification par jeton existe aussi (`/iam/account-app/token`)
    **[à vérifier]**.
- **⚠️ Payer sans clic.** « Pour passer commande, votre compte doit être
  configuré avec le mode de paiement différé par prélèvement » (extrait
  officiel, `developer.boxtal.com/…/getting-started-api-v3`). Le contact de
  facturation doit être enregistré comme **entreprise**, puis on choisit
  *Préférences de facturation › Mode de paiement* (code lu : README
  `ErnadoO/boxtal`).
  - ⇒ Un **micro-entrepreneur** (SIRET) peut. Un **particulier sans SIRET, non**.
- **Commander.**
  - `POST /v3.1/shipping-order`, avec le code de l'offre (par exemple
    `MONR-CpourToi`, `CHRP-ChronoShoptoShop`, `POFR-ColissimoAccess`).
  - Le code du point relais est obligatoire pour une offre en relais
    (`pickupPointCode`).
  - On peut y mettre **notre référence** (`externalId`) : ce sera le n° de
    commande eBay.
  - Sources : (extrait officiel) guide « order » v3 ; (code lu) README ErnadoO.
- **Les devis** passent par l'API **v1** : la v3 n'a pas encore de devis
  (code lu ; (secondaire) dawap.fr : « clés v1 pour les tarifs, clés v3 pour
  l'affranchissement »).
- **Les points relais.**
  - On cherche par réseau, ou bien les points qui acceptent une offre donnée.
  - Au plus **30 points tous réseaux confondus** : il faut chercher réseau par
    réseau.
  - Un même commerce a **un code différent dans chaque réseau** : il faut
    commander avec le code du réseau de l'offre.
  - Source : code lu, « Things learnt on the real API ».
- **L'étiquette.**
  - Elle arrive quelques secondes après la commande, par
    `shippingDocuments(id)` ou par le webhook `DOCUMENT_CREATED`.
  - Juste après la commande, la lecture répond `422 UnexpectedException` au
    lieu de « pas encore prête » : ce n'est **pas** un échec à afficher.
  - Le format A4 ou 10 × 15 thermique se règle, avec un repli sur A4 si le
    transporteur n'a pas de format thermique (extrait officiel :
    help.boxtal.com « changing-printing-format ») **[liste par transporteur à
    vérifier]**.
- **Les webhooks.**
  - On s'abonne à `TRACKING_CHANGED` et `DOCUMENT_CREATED` ; la signature est
    `x-bxt-signature`, un HMAC SHA-256 du corps brut.
  - Il faut répondre 2xx **en moins de 2 s**, sinon Boxtal réessaie 10 fois en
    24 h, puis abandonne.
  - **Un abonnement ne reçoit que les envois créés par la même application**
    (extrait officiel, guide « subscriptions ») : pour VRM, ce sont les clés du
    vendeur, donc ça tombe juste.
  - On choisit soi-même le secret à l'abonnement, et Boxtal ne le renvoie
    jamais.
- **Annuler.** Avant le dépôt, c'est **remboursé** (code lu). Le délai n'est pas
  connu **[à vérifier]**.
- **Bac à sable.** `https://api.boxtal.build/shipping` : les commandes ne sont
  pas facturées, les étiquettes sont générées, et un faux suivi avance toutes
  les quelques minutes (extrait officiel, guide « sandbox » ; code lu).
- **Transporteurs.** Colissimo, Mondial Relay, Chronopost, Relais Colis, Colis
  Privé… (code lu).
- **Tarifs 2026.** Point relais : encore en négociation, et « ne devraient pas
  augmenter ». Domicile : en baisse (extrait officiel : blog Boxtal,
  décembre 2025). Pas de grille lue.

### 2.4 Sendcloud — le second candidat, le plus « plateforme »

- **Le modèle multi-vendeurs est documenté** (extrait officiel :
  `sendcloud.dev/docs/marketplaces/*`). Il y en a trois :
  - **centralisé** : UN compte, celui de la plateforme, achète pour tous les
    vendeurs et les refacture. Prévu pour la vente entre particuliers.
    ⇒ **VRM deviendrait revendeur de transport** (il avance l'argent, refacture,
    gère la TVA). **Écarté.**
  - **décentralisé** : chaque vendeur a son compte. On le redirige vers une page
    où il **autorise** la plateforme. Sendcloud facture le vendeur directement.
    **C'est le bon modèle pour VRM.**
  - **hybride** : un mélange des deux.
- **Authentification.**
  - Basic : clé publique + clé privée d'une intégration « Sendcloud API » créée
    dans le panneau.
  - **OAuth2 en bêta** pour quelques clients, déploiement général prévu, date
    inconnue (extrait officiel : `sendcloud.dev/docs/getting-started/authentication`).
- **Versions.** Un compte créé **après le 13 avril 2026 doit utiliser l'API
  v3**. La v2 est en maintenance (extrait officiel).
- **L'étiquette.**
  - Un endpoint **synchrone** « créer et annoncer » (un seul colis) rend le
    fichier dans la réponse.
  - Le PDF est dans la taille d'origine du transporteur (souvent **A6 =
    10 × 15**), en A4/A5/A6, **ZPL** ou PNG (extrait officiel :
    `sendcloud.dev/docs/shipments/print-your-labels`).
- **Les points relais.** Champ `to_service_point`, et une API des points
  (extrait officiel : « create a parcel », « servicepoints for marketplaces »).
- **Les webhooks.**
  - `parcel_status_changed`, signé HMAC-SHA256 (`Sendcloud-Signature`).
  - 10 nouveaux essais, et les évènements peuvent arriver **dans le désordre**
    (il faut se fier à `timestamp`).
  - Le colis porte `label.normal_printer` (A4) et `label.label_printer` (A6).
  - Source : extrait officiel, `sendcloud.dev/api/v3/webhooks/parcel-status-changed`.
- **Annuler.** `POST /parcels/{id}/cancel`, sans garantie : chaque transporteur
  a ses délais. C'est **gratuit avant 23 h 59 le jour de la création**, sinon
  crédité sur la facture suivante si le colis n'est pas parti dans les
  **42 jours**. Le traitement peut prendre deux semaines (extrait officiel :
  sendcloud.dev « cancel a label » ; support.sendcloud.com).
- **Prix.**
  - Un plan gratuit limité (20 ou 50 étiquettes par mois selon les sources).
  - Lite : 26 à 40 €/mois ; Growth : 79 à 109 €.
  - Plus des frais **par étiquette**, de 0,08 à 0,15 €.
  - Les sources se contredisent (secondaires : getapp, saask, authencio).
- **Qui peut ouvrir.**
  - Un numéro de TVA ou EORI serait demandé (secondaire : doc Odoo).
  - Un micro-entrepreneur en franchise de TVA n'a pas de numéro de TVA
    **[à vérifier : SIRET accepté ?]**.

### 2.5 Packlink PRO — automatique à moitié

- **Ce qui est lu dans du code officiel** : le cœur des modules de Packlink,
  `packlink-dev/ecommerce_module_core`, `src/BusinessLogic/Http/Proxy.php`
  (code lu).
  - Adresse de base : `https://api.packlink.com/v1/`.
  - Routes : `shipments` (envoi en brouillon), `shipments/{ref}/labels`,
    `shipments/{ref}/track`, `shipments/callback` (webhook),
    `dropoffs/{service}/{pays}/{cp}` (points relais), `register`,
    `users/api/keys`.
  - **Une intégration doit maintenant s'enregistrer** (`integrations`), avec
    un en-tête secret pour ses webhooks (`X-Packlink-Webhook-Secret`).
  - Champs d'un envoi : `dropoff_point_id`, `shipment_custom_reference` (**notre
    identité** : le n° de commande eBay) et `content_second_hand` (« produit
    d'occasion »).
  - Évènements de webhook : `shipment.label.ready`, `shipment.tracking.update`,
    `shipment.delivered`… (code lu : README `wout/packlink.cr`).
- **⚠️ Le paiement se fait DANS Packlink.**
  - L'envoi créé par l'API arrive en « brouillon » ou « prêt pour le paiement »,
    et se paie par **carte ou PayPal**, éventuellement plusieurs d'un coup
    (« Pay all »).
  - Le module officiel pour WooCommerce le dit : on ne va sur Packlink PRO
    « **que pour le paiement** ».
  - Un « paiement différé » existe pour certains comptes ; qu'il paie seul les
    envois créés par l'API n'est **pas établi** **[à vérifier]**.
  - Sources : (extrait officiel) support-pro.packlink.com « statut des envois »,
    « compléter un envoi » ; (secondaire) page du plugin WooCommerce.
- **Annuler** : seulement **par un ticket** au support, dans les 15 jours,
  gratuit avant la prise en charge ; remboursement sous 96 h à 10 jours
  (extrait officiel : support-pro.packlink.com). **Pas par l'API.**
- **Clé** : générée dans les réglages du compte, valable pour toutes les
  intégrations (extrait officiel).
- **Format** : PDF **A4** d'après une bibliothèque tierce **[10 × 15 à
  vérifier]**.
- ⇒ **Une option de repli** : VRM prépare l'envoi (bon point relais, bonne
  adresse, référence = commande), tu cliques « tout payer » dans Packlink, puis
  le webhook ramène l'étiquette et le suivi. Ce n'est pas « autonome ».

### 2.6 Les transporteurs en direct — écartés pour VRM

- **Mondial Relay.**
  - Compte pro en ligne, « en totale autonomie », offre **Start** sans
    engagement, jusqu'à 5 000 colis par an, « dès 3,09 € HT », dégressif dès
    10 colis par mois (extrait officiel : mondialrelay.fr/…/offre-start).
  - SIRET et prélèvement exigés (secondaire : jpi-conseil). Une caution de 50 €
    est citée (secondaire) **[à vérifier]**.
  - **Les nouveaux comptes n'ont que l'API V2.** L'ancien
    `WSI2_CreationEtiquette` leur est fermé. Il faut **quatre secrets** :
    l'enseigne, la clé privée, et les identifiants « Connect » (identifiant en
    `@business-api.mondialrelay.com` et mot de passe). Sources : (secondaire)
    intégrateurs ; (extrait officiel) PDF « Solution Web Service » v5.14,
    janvier 2025.
  - ⇒ C'est possible, mais **pour un seul transporteur**, avec quatre secrets
    par vendeur. C'est cher en saisie pour 1 000 vendeurs, et ça ne couvre pas
    le domicile chez Colissimo.
- **Colissimo.**
  - Le contrat « **Facilité** » (sans engagement, SIRET, prélèvement SEPA
    mensuel) donne une **interface web (ColiShip)**.
  - **L'accès au Web Service est réservé au contrat Privilège** (extrait
    officiel : colissimo.entreprise.laposte.fr « Contrat Facilité ou contrat
    Privilège ? »).
  - Le web service SLS (`generateLabel`, `checkGenerateLabel`) se pilote avec
    un n° de contrat et un mot de passe (extrait officiel : redoc SLS).
  - ⇒ Pas pour un petit vendeur.
- **Chronopost.** Contrat préalable, n° de compte à 8 chiffres ; Chrono Relais
  et Shop2Shop limités à 20 kg (extrait officiel : guides et CGV Chronopost).
  ⇒ Par un agrégateur.
- **InPost.** En France, les Lockers passent par le réseau Mondial Relay
  (InPost est maison mère). L'API ShipX documentée est polonaise ou italienne,
  avec un **solde prépayé** et un bac à sable (secondaire) **[France à
  vérifier]**. ⇒ Par un agrégateur.
- **Relais Colis.** Une API officielle sert au moins aux points et au suivi
  (secondaire : plugin WooCommerce mis à jour le 12 janvier 2026) ; les
  conditions ne sont pas trouvées. ⇒ Par un agrégateur (Boxtal le propose).
- **Shippingbo** (logiciel de gestion des commandes) et **Cubyn** (entrepôt
  externalisé, « 500 à 50 000 commandes par mois » en 2019) : **hors sujet**
  pour un revendeur qui expédie lui-même. Aucune source tarifaire trouvée.
- **Non étudiés faute de source** : Upela, MyFlyingBox, Eurosender, ShippyPro,
  Easyship (cité comme partenaire d'expédition d'eBay).

---

## 3. Le point relais choisi par l'acheteur, et les codes eBay

### 3.1 Ce que porte une commande eBay (schéma lu)

Il vient du SDK `ebay-api` 10.0.1 (août 2026), dont les types sont générés à
partir des contrats OpenAPI d'eBay (code lu,
`dist/types/restful/specs/sell_fulfillment_v1_oas3.d.ts`) :

```
FulfillmentStartInstruction {
  appointment, ebaySupportedFulfillment, finalDestinationAddress,
  fulfillmentInstructionsType, minEstimatedDeliveryDate, maxEstimatedDeliveryDate,
  pickupStep   { merchantLocationKey },
  shippingStep { shippingCarrierCode, shippingServiceCode, shipTo, shipToReferenceId }
}
ShippingFulfillment { fulfillmentId, lineItems, shipmentTrackingNumber,
                      shippedDate, shippingCarrierCode }
```

- `pickupStep.merchantLocationKey` = un **magasin du vendeur** (retrait sur
  place). Ce n'est pas un point relais.
- `shipToReferenceId` = la référence du **Global Shipping Program**
  (international) ; elle vaut la `ReferenceID` de Trading (extrait officiel :
  type `ShippingStep`). Ce n'est pas un point relais.
- Côté Trading, `AddressAttribute` / `ReferenceID` ne sert qu'au « Click and
  Collect » du **Royaume-Uni et de l'Australie** (extrait officiel :
  `AddressAttributeType`).

⇒ **Aucun champ documenté ne porte l'identifiant du point relais choisi par
l'acheteur en France.**

Pourtant, le partenariat « eBay by Mondial Relay » transmet ce point au site de
Mondial Relay. L'information existe donc chez eBay, mais par un canal qui n'est
pas public **[à vérifier]**.

L'hypothèse la plus probable reste à mesurer sur la première vraie commande en
relais : `shipTo` porte l'**adresse du point** (nom du commerce dans
`companyName` ou une ligne d'adresse) **[à vérifier]**.

**Règle pour l'agent (§5, jamais de ressemblance) :**

- **Service payé à domicile** : le bordereau part à domicile, à l'adresse
  `shipTo`. L'agent ne passe **jamais** à un point relais « plus proche ». Ce
  serait un service moins bon que celui que l'acheteur a payé, donc un litige
  « non reçu » possible.
- **Service payé en point relais :**
  - l'agent n'achète que s'il **lit** l'identifiant du point sur la commande ;
  - si la commande ne donne qu'une adresse, l'agent **n'achète pas** et dit :
    « achète ce bordereau dans eBay (le point relais y est déjà) » ;
  - faire correspondre une adresse de commerce à un code de point relais, ce
    serait un rapprochement. **Un colis envoyé au mauvais relais est un colis
    perdu.**
- **Plusieurs objets dans la commande** : eBay ne laisse pas l'acheteur choisir
  son point (extrait officiel). C'est donc le cas « domicile » ou « contacte
  l'acheteur ».

### 3.2 Les codes de service d'expédition eBay.fr

- Trouvés dans la référence Trading (extrait officiel :
  `ShippingServiceCodeType`) : `FR_ColiposteColissimo`,
  `FR_ColiposteColissimoDirect`, `FR_ColiposteColissimoRecommended`,
  `FR_Chronopost`, `FR_ChronopostChronoRelais`.
- **Mondial Relay : aucun code trouvé.** `FR_MondialRelay` n'apparaît nulle
  part.
- VRM écrit `FR_ColissimoLabelPointRetrait` en repli (`api/ebay.js` l. 635).
  Ce code n'est **pas vérifié** et ne sert pas sur son compte (`ebayGere`).
- eBay prévient : il ne faut pas se fier à la complétude de cette liste.
  - La liste à jour se lit par la **Metadata API** :
    `GET /sell/metadata/v1/shipping/marketplace/EBAY_FR/get_shipping_services`.
    Elle rend `shippingService`, `shippingCarrier`, `shippingCategory`,
    `validForSellingFlow`… (code lu : SDK `ebay-api`,
    `sell/metadata/index.js` ; types `ShippingServiceResponse`).
  - Elle remplace `GeteBayDetails`, **retiré le 15 mars 2027** (feuille du
    9 octobre).
  - **C'est une simple lecture, à faire au premier branchement.**

### 3.3 Les codes transporteur pour déclarer l'envoi à eBay

- **L'appel.**
  - `POST /sell/fulfillment/v1/order/{orderId}/shipping_fulfillment`, avec
    `{lineItems:[{lineItemId, quantity}], shippedDate, shippingCarrierCode,
    trackingNumber}`.
  - Réponse 201 et `Location`.
  - Le transporteur et le suivi vont **ensemble** ; le suivi est alphanumérique,
    **sans espace ni tiret**.
  - Sources : feuille du 9 octobre (extrait officiel) ; (code lu) SDK
    `createShippingFulfillment`.
- **La liste `ShippingCarrierCodeType`** (code lu : SDK,
  `gete-bay-details-response.d.ts`). Codes utiles en France :
  - `Colissimo`, `ColiposteDomestic`, `ColiposteInternational` ;
  - `Chronopost`, `MondialRelay`, `LAPOSTE` ;
  - `DPD`, `Exapaq`, `GLS`, `UPS`, `TNT`, `KIALA` ;
  - `Other`, `CustomCode`.
  - **Absents : InPost, Relais Colis, Colis Privé.**
- **La Post-Order API** (retours) parle en majuscules : `COLISSIMO`,
  `MONDIAL_RELAY`, `LA_POSTE` (extrait officiel : `ShippingCarrierEnum`).
- ⚠️ **Une contradiction** : la page `GeteBayDetails / ShippingCarrierDetails`
  montrerait `MondialRelay` disponible en France, mais **pas `Colissimo`**
  (extrait officiel).
  - ⇒ **Ne rien écrire en dur.** Au premier branchement, l'agent lit
    `GET /sell/metadata/v1/shipping/marketplace/EBAY_FR/get_shipping_carriers`
    (code lu : SDK) et garde la correspondance (Colissimo, Mondial Relay,
    Chronopost…) → code eBay.
  - Un transporteur absent de la liste : **on ne déclare pas l'envoi** (pas de
    `Other`). On le dit.
- **`CompleteSale`** (Trading, avec `ShipmentTrackingDetails`) est l'autre
  porte. Il vaut mieux le REST, qui rend un identifiant d'envoi **[à vérifier]**.

---

## 4. Poids et dimensions

**Mesuré (lecture seule, §6)** : aucun poids ni taille de colis n'est connu
dans VRM.
- Les transactions Vinted captées n'ont, sous `shipment`, que `id, status,
  status_title, status_updated_at`.
- Les annonces captées n'ont que la **pointure** (`size`), sur 598 fiches.
- Les annonces eBay (`detail`) n'ont rien de tel.

**Proposition — trois niveaux, du plus général au plus précis, et jamais
deviné en silence :**

1. **Un réglage du vendeur** (synchronisé, rattrapé par `onCloudReady`) :
   - « mon colis type » = **1,5 kg** et **36 × 24 × 14 cm** (une boîte de
     baskets avec son carton). C'est un ordre de grandeur, à confirmer par ta
     balance ;
   - un vendeur de vêtements ou de livres met le sien.
2. **Une correction par annonce** : « ce colis-ci pèse 2,2 kg » (bottes,
   paires XXL), rangée dans la fiche de la paire (`vinted_annonce_numeros[id]`,
   comme le prix d'achat).
3. **Demandé à la première vente** si rien n'est réglé : **pas su ⇒ on
   n'achète pas.**

**Les risques à dire, pas à cacher :**
- **Un poids sous-déclaré** est facturé après coup par le transporteur ou
  l'agrégateur (« régularisation ») **[montants à vérifier chez Boxtal et
  Sendcloud]**.
  - ⇒ La confirmation **montre** le poids et les dimensions utilisés.
  - Le journal les garde.
- **Le poids volumétrique** : certains transporteurs (express surtout)
  facturent `L × l × h / 5000`. Une boîte de 36 × 24 × 14 vaut alors environ
  **2,4 kg**, pas 1,5. Je ne sais pas qui l'applique pour un relais ou un
  domicile en France **[à vérifier]**.
  - ⇒ Le **devis** (prix exact rendu par l'agrégateur avant l'achat) fait foi,
    jamais un prix calculé par VRM.

---

## 5. Recommandation

### 5.1 L'ordre de construction

1. **Lire ce que dit eBay de chaque commande, sans rien acheter.** Ça se fait
   avec les jetons existants, pour **tous les vendeurs** :
   - `GetOrders` au niveau **≥ 1455**, pour avoir `ShippingLabelPolicy` ;
   - `shippingServiceCode`, `shippingCarrierCode`, `fulfillmentInstructionsType`,
     `program.authenticityVerification` ;
   - **les noms des clés** de `shipTo.contactAddress` (jamais les valeurs) ;
   - `get_shipping_services` et `get_shipping_carriers` pour `EBAY_FR`.

   ⇒ On saura enfin, sur une vraie vente, si l'étiquette est libre et où vit le
   point relais.
2. **Commande `EBAY_ONLY`, ou vérification d'authenticité** : **aucun achat
   ailleurs.**
   - Pour l'authenticité, la paire part chez l'authentificateur d'eBay ; qui
     fournit l'étiquette en France n'est pas établi **[à vérifier]**.
   - Dans ces cas : Colis + N° du carton + bouton « acheter dans eBay ».
   - Puis le suivi est relu par identité (`getShippingFulfillments`), et le
     colis est suivi (`suivi.md`).
3. **Commande à étiquette libre, vendeur relié à Boxtal** : l'agent achète
   (§5.3).
4. **Sendcloud** quand un vendeur ne peut pas avoir le prélèvement de Boxtal,
   ou si l'OAuth de Sendcloud sort de bêta (une autorisation au lieu de deux
   clés à coller).
5. **Packlink** en repli « à moitié » : VRM prépare l'envoi, le vendeur paie.

### 5.2 Un vendeur seul et 1 000 vendeurs : le même modèle

- **Chaque vendeur a SON compte et SA clé chez l'agrégateur**, c'est le modèle
  « décentralisé ».
  - **VRM ne paie jamais un bordereau, n'avance pas d'argent, ne refacture
    rien.** Il n'est pas revendeur de transport : pas de TVA sur le port, pas de
    trésorerie, pas de litige de facture.
- **Les clés sont rangées côté serveur et ne sont jamais relues par le
  navigateur.**
  - Le navigateur les envoie une fois.
  - Le serveur les vérifie par une lecture inoffensive (le profil, les points
    relais du code postal du vendeur), puis les range dans une ligne écrite par
    la clé de service seulement.
  - L'écran ne voit que « clé posée ✓ / refusée ».
  - (Aujourd'hui `ebay_tokens` est lisible par la session du vendeur : à
    resserrer en même temps.)
  - **Jamais une clé d'un vendeur pour un autre** : toute lecture et toute
    écriture portent `owner=eq.{vendeur de la session}`, comme `api/ebay.js`.
- **Les webhooks, un par vendeur.**
  - L'adresse porte un identifiant **opaque** propre au vendeur, jamais son
    `owner`.
  - La signature est vérifiée sur le corps brut, avec le secret de **ce**
    vendeur.
  - Un évènement inconnu reçoit un 2xx et on n'en fait rien ; c'est le conseil
    de Boxtal, pour éviter qu'il réessaie.
- **Plafond de 12 fonctions (Vercel Hobby).**
  - Pas de nouvelle fonction : des **modes** dans `api/ebay.js` (`devis`,
    `acheter`, `annuler`, `etiquette`) et un webhook par réécriture vers un mode
    existant, comme `/api/stripe-webhook`.
  - Le suivi arrive par **webhook**, pas par un cron : il n'y a qu'**un** cron
    par jour sur le plan Hobby, et un cron refusé bloque tous les déploiements
    (CLAUDE.md).
- **Données personnelles.** L'adresse de l'acheteur part chez l'agrégateur, sur
  l'ordre du vendeur.
  - ⇒ La politique de confidentialité doit le dire (VRM transmet l'adresse de
    livraison au transporteur choisi par le vendeur).
  - Dans `ebay_orders`, ne garder que le nécessaire. Aujourd'hui la commande
    entière y serait rangée telle qu'eBay la rend (`api/ebay.js` l. 1369).

### 5.3 Les garde-fous de l'agent qui achète (un geste qui coûte de l'argent)

- **Éteint par défaut.** Réglage `vrm_ebay_bordereau_auto`, que le vendeur
  allume lui-même, avec une confirmation qui dit le prix type et les plafonds.
- **Mode intermédiaire, conseillé au début** : « préparer, je confirme ».
  - L'agent fait le devis et prépare l'envoi.
  - Le vendeur appuie sur **un** bouton qui montre le prix exact, le
    transporteur, le point ou l'adresse (ville seulement), le poids, et le N° du
    carton.
- **Des plafonds**, réglables et bas par défaut (valeurs à décider avec toi) :
  - par étiquette (exemple : 12 €) ;
  - par jour (exemple : 10 étiquettes et 80 €) ;
  - par mois (exemple : 300 €).
  - Un devis au-dessus du plafond ⇒ rien n'est acheté, et la vente passe en
    « à confirmer ».
- **Les conditions, toutes vraies, relues chez eBay au moment d'acheter** (et
  « pas su » à n'importe laquelle ⇒ on n'achète pas) :
  - commande `PAID` ;
  - pas `FULFILLED`, et **aucun envoi déjà déclaré** (`getShippingFulfillments`
    vide) ;
  - aucune demande d'annulation ;
  - `ShippingLabelPolicy` **absent** ;
  - pas de vérification d'authenticité ;
  - N° de la paire connu par le SKU ;
  - adresse complète ;
  - si le service est en relais : le point est connu par identité ;
  - poids connu ;
  - transporteur présent dans la liste lue par `get_shipping_carriers`.
- **Jamais deux bordereaux pour une commande.**
  - La référence chez l'agrégateur = le n° de commande eBay (`externalId`
    chez Boxtal, `shipment_custom_reference` chez Packlink,
    `order_number`/référence chez Sendcloud **[champ à vérifier]**).
  - Avant d'acheter, on cherche un envoi existant pour cette référence ;
    illisible ⇒ on n'achète pas.
  - Une coupure après l'achat = « incertain » : on relit chez l'agrégateur
    **avant** tout nouvel essai, comme pour la programmation eBay.
- **Après l'achat.**
  1. On récupère le PDF et on le tamponne du N° du carton, avec le même code
     que les bordereaux Vinted (`annotateAndDownloadBordereau`).
  2. On déclare le suivi à eBay (`createShippingFulfillment`).
  3. On relit la commande.
  4. On note tout dans un **journal relisible** : qui, quoi, combien, quand,
     quelle commande.
- **Commande annulée après l'achat** : l'agent **annule le bordereau** s'il
  n'est pas déposé (Boxtal et Sendcloud par l'API ; Packlink par un ticket, donc
  il le **dit**). Le journal garde le remboursement attendu.
- **Vinted : rien ne change.** Tout ceci ne concerne que les commandes eBay.

### 5.4 Ce que Julien fait, une fois

1. **Rien d'abord.** On construit la lecture de §5.1-1 ; ta prochaine vente
   eBay dira si ton compte est en « étiquette eBay obligatoire ».
   - Si oui, **tu ne t'abonnes à rien** : l'étiquette eBay est même la moins
     chère (3,58 € pour un Mondial Relay jusqu'à 1 kg, selon la grille du
     3 octobre).
   - L'agent te la prépare en un clic et suit le colis tout seul.
2. **Si l'étiquette est libre** (ton compte pro, par exemple) :
   1. **Créer un compte professionnel Boxtal**, avec ton SIRET et ton adresse
      d'expédition.
   2. Dans *Préférences de facturation › Mode de paiement* : **prélèvement
      différé** (mandat SEPA, avec ton IBAN). C'est la condition pour que VRM
      puisse commander sans toi.
   3. Dans l'espace développeur de Boxtal : **créer une application API v3**,
      et copier la **clé d'accès** et la **clé secrète**. Pour les devis, il
      faut peut-être aussi les clés **v1** **[à vérifier]**.
   4. Les **coller dans VRM** (Réglages → Expédition) : VRM les vérifie et dit
      « ✓ ».
   5. Régler ton **colis type** (poids, dimensions), ton **transporteur
      préféré** par mode (relais, domicile), ton **format d'impression**
      (classique ou thermique : c'est le réglage `vrm_imprimante`, qui existe
      déjà), et les **plafonds**.
   6. **Essayer d'abord en bac à sable** : un compte Boxtal de test, avec
      d'autres clés. Rien n'est facturé, et tout le chemin tourne pour de vrai :
      devis → étiquette → suivi → déclaration (sur une commande de test).
   7. **Allumer.**
3. **Les autres vendeurs** suivent les mêmes étapes, chacun avec ses clés.
   - Un **particulier sans SIRET** ne peut pas avoir le prélèvement de Boxtal.
   - Pour lui : l'étiquette eBay (sans doute obligatoire de toute façon pour un
     particulier) ou Packlink « à moitié ».

---

## 6. Ce que porte sa base (lecture seule, 11 octobre)

Lu avec des `SELECT` projetés : aucun jeton, aucun nom ni adresse.

- **`ebay_orders`** : **une seule ligne** (celle de l'installation), relevée le
  **10 octobre 2026 à 20:29 UTC**, statut 200, **0 commande**.
  - Il n'y a donc encore **aucun champ d'expédition ou de point relais à
    observer**.
  - Le code range la réponse de `getOrders` **telle quelle**
    (`orders: orders.data.orders`, `api/ebay.js` l. 1369) : la première
    commande y portera tout, adresse de l'acheteur comprise.
  - Aucune ligne `ebay_orders_{compte}` : la branche « plusieurs comptes »
    n'est pas en production.
  - ⚠️ Si une vente a eu lieu le 10 octobre, elle est arrivée **après** ce
    relevé, ou `getOrders?limit=50` ne l'a pas rendue. C'est un sujet à part
    (tâche « vente du 10 oct. »).
- **`ebay_listings`** : 3 annonces actives.
  - `VRM-559` est en ligne depuis le 18 septembre.
  - Une annonce **n'a pas de SKU** (en ligne depuis le 27 septembre).
  - `VRM-553` est en ligne depuis le **10 octobre à 20:29**.
  - Aucune ne porte d'information de livraison (`detail` = `categoryId,
    categoryName, condition, description, photos, specifics`).
- Lignes `ebay_*` présentes : `ebay_inventory` (vide), `ebay_programmees`,
  `ebay_tokens` (non lue).
- **Aucun email venant d'eBay** dans sa base : `meta` ne contient « ebay » sur
  aucune des 3 148 lignes `email_*`.
- **Poids et colis** : 0 champ (voir §4).
- **Code** :
  - Trading au niveau de compatibilité **1149** (`api/ebay.js` l. 146 ;
    `api/_lib/ebay.js` l. 158). `ShippingLabelPolicy` n'est donc **pas** rendu.
  - `<ShippingDetails>` est retiré quand `ebayGere` est vrai (l. 624-637) : la
    mesure du 27 septembre.

---

## 7. Non mesuré — à vérifier avant de construire

1. **Ses commandes portent-elles `ShippingLabelPolicy = EBAY_ONLY` ?** Son
   compte connecté est-il particulier ou pro ? Et les particuliers sont-ils
   obligés de prendre l'étiquette eBay en France depuis le 1ᵉʳ septembre 2026 ?
2. **Où le point relais choisi par l'acheteur apparaît-il** dans `getOrder`
   (`shipTo` ? une autre clé ?) et dans Trading `GetOrders` ?
3. Les **codes eBay** : la liste `get_shipping_carriers` et
   `get_shipping_services` pour `EBAY_FR` ; le code exact de Mondial Relay et
   de Colissimo pour `createShippingFulfillment`.
4. La **vérification d'authenticité** sur eBay.fr (100 € ou 200 €, sources
   contradictoires) : qui fournit l'étiquette vers l'authentificateur ?
5. **Boxtal** :
   - le format thermique par transporteur ;
   - le délai de remboursement d'une annulation ;
   - les frais de régularisation de poids ;
   - si les clés v1 sont nécessaires pour les devis ;
   - une grille 1–2 kg en relais et à domicile ;
   - un programme « partenaire » ou OAuth (pour éviter de copier des clés).
6. **Sendcloud** : un micro-entrepreneur sans TVA est-il accepté ? Le champ de
   référence d'envoi en v3 ? La date de l'OAuth2 général ? Le bac à sable ?
7. **Packlink** : le paiement différé paie-t-il seul les envois créés par
   l'API ? Le format 10 × 15 ? L'inscription demande-t-elle un SIRET ?
8. **eBay Labels API** (bêta fin 2026) : la France en fera-t-elle partie ?
9. **L'adresse email de l'acheteur** rendue par eBay est-elle utilisable par un
   transporteur ? Elle est souvent masquée. Et le **téléphone** : Boxtal en
   demande un pour l'avis de passage ou le SMS.

---

## 8. Sources

**Code lu (fichiers téléchargés et lus) :**
- SDK `ebay-api` 10.0.1 (npm, 11 août 2026) :
  - `dist/types/restful/specs/sell_fulfillment_v1_oas3.d.ts` (schéma de
    commande) ;
  - `…/sell_metadata_v1_oas3.d.ts` et `dist/api/restful/sell/metadata/index.js`
    (`get_shipping_carriers`, `get_shipping_services`) ;
  - `dist/api/restful/sell/logistics/index.js` et `…/fulfillment/index.js` ;
  - `dist/types/traditional/gete-bay-details-response.d.ts`
    (`ShippingCarrierCodeType`).
- Packlink, code officiel :
  [`packlink-dev/ecommerce_module_core` — Proxy.php](https://github.com/packlink-dev/ecommerce_module_core/blob/master/src/BusinessLogic/Http/Proxy.php),
  [Draft.php](https://github.com/packlink-dev/ecommerce_module_core/blob/master/src/BusinessLogic/Http/DTO/Draft.php).
- Bibliothèques non officielles :
  [`ErnadoO/boxtal` README](https://github.com/ErnadoO/boxtal) (« Things learnt
  on the real API ») et
  [`wout/packlink.cr` README](https://github.com/wout/packlink.cr).
- VRM : `api/ebay.js` (l. 146, 624-637, 1324, 1369), `api/_lib/ebay.js` l. 158.

**Pages officielles (extraits de moteur, pas lues en entier) :**
- eBay :
  - [Logistics API overview](https://developer.ebay.com/api-docs/sell/logistics/overview.html),
    [createFromShippingQuote](https://developer.ebay.com/api-docs/sell/logistics/resources/shipment/methods/createFromShippingQuote) ;
  - [Trading release notes](https://developer.ebay.com/devzone/xml/docs/releasenotes.html)
    (1455, `ShippingLabelPolicy`), [GetOrders](https://developer.ebay.com/devzone/xml/docs/reference/ebay/getorders.html) ;
  - [ShippingStep](https://developer.ebay.com/api-docs/sell/fulfillment/types/sel:ShippingStep),
    [AddressAttributeType](https://developer.ebay.com/DevZone/XML/docs/reference/ebay/types/AddressAttributeType.html),
    [ShippingServiceCodeType](https://developer.ebay.com/devzone/xml/docs/reference/ebay/types/ShippingServiceCodeType.html),
    [ShippingCarrierCodeType](https://developer.ebay.com/devzone/xml/docs/reference/ebay/types/ShippingCarrierCodeType.html),
    [GeteBayDetails ShippingCarrierDetails](https://developer.ebay.com/Devzone/XML/Docs/Reference/eBay/extra/gtbydtls.rspns.shppngsrvcdtls.shppngcrrr.html),
    [Post-Order ShippingCarrierEnum](https://developer.ebay.com/Devzone/post-order/types/ShippingCarrierEnum.html) ;
  - [Newsletter Q2 2026](https://developer.ebay.com/updates/newsletter/q2_2026),
    [Media API release notes](https://developer.ebay.com/develop/api/sell/release_notes),
    [présentation Connect 2026](https://developer.ebay.com/cms/files/connect-2026/ebay_developer_conference_keynote_alex_july_2026.pdf) ;
  - [Plateforme d'expéditions eBay](https://www.ebay.fr/espacevendeurs/livraison/solutions/plateforme-expeditions),
    [Livraison par Mondial Relay](https://www.ebay.fr/espacevendeurs/livraison/solutions/mondial-relay),
    [eBay by Mondial Relay](https://www.mondialrelay.fr/solutions-professionnels/nos-services-ecommercants/partenaires-techniques/ebay-by-mondial-relay),
    [support Packlink eBay](https://support-ebay.packlink.com/hc/fr-fr).
- Boxtal :
  [getting started v3](https://developer.boxtal.com/fr/fr/apiv3/guide/getting-started-api-v3),
  [order v3](https://developer.boxtal.com/fr/en/apiv3/guide/order-api-v3),
  [subscriptions v3](https://developer.boxtal.com/fr/en/apiv3/guide/subscriptions-api-v3),
  [sandbox v3](https://developer.boxtal.com/fr/en/apiv3/guide/sandbox-api-v3),
  [format d'impression](https://help.boxtal.com/fr/en/article/changing-printing-format),
  [offres 2026](https://www.boxtal.com/fr/fr/blog/2025/12/offres-transporteurs-ce-qui-change-en-2026).
- Sendcloud :
  [marketplaces](https://sendcloud.dev/docs/marketplaces/overview),
  [centralisé](https://www.sendcloud.dev/docs/marketplaces/centralized-integration/),
  [décentralisé](https://sendcloud.dev/docs/marketplaces/decentralized-integration-guidelines),
  [authentification](https://sendcloud.dev/docs/getting-started/authentication),
  [imprimer les étiquettes](https://sendcloud.dev/docs/shipments/print-your-labels),
  [créer un colis](https://sendcloud.dev/docs/shipping/create-a-parcel),
  [annuler](https://sendcloud.dev/docs/archive/shipping/cancel-a-label),
  [parcel_status_changed v3](https://sendcloud.dev/api/v3/webhooks/parcel-status-changed).
- Packlink :
  [statut des envois](https://support-pro.packlink.com/hc/fr-fr/articles/213894305-Statut-des-envois),
  [compléter un envoi](https://support-pro.packlink.com/hc/en-gb/articles/214125845-How-can-I-complete-a-shipment),
  [coût d'une annulation](https://support-pro.packlink.com/hc/en-gb/articles/210236165-How-much-does-it-cost-to-cancel-a-shipment),
  [clé API](https://support-pro.packlink.com/hc/en-gb/articles/213431749-How-do-I-generate-an-API-key-on-Packlink-PRO).
- Transporteurs :
  - [Mondial Relay offre Start](https://www.mondialrelay.fr/solutions-professionnels/nos-offres-ecommercants/offre-start),
    [tarifs](https://www.mondialrelay.fr/envoi-de-colis/tarifs-expeditions/),
    [Web Service v5.14](https://storage.mondialrelay.fr/solution-web-service-v514-FR.pdf) ;
  - [Colissimo Facilité / Privilège](https://www.colissimo.entreprise.laposte.fr/fr/page-contrats),
    [SLS](https://www.colissimo.fr/doc-colissimo/redoc-sls/en) ;
  - [CGV Chronopost Pro](https://www.chronopost.fr/sites/chronopost/files/CGV_E-CHRONO_PRO_2023_2024_FR.pdf).

**Sources secondaires :**
[friptadium — Mondial Relay eBay](https://friptadium.com/blogs/actualites/mondial-relay-ebay-envoi-tarifs) ·
[justgeek — eBay sans frais](https://www.justgeek.fr/ebay-supprime-frais-vente-particuliers-157677/) ·
[margeoapp — Mondial Relay 2026](https://margeoapp.com/blog/tarifs-mondial-relay-2026) ·
[ShippyPro — tarifs 2026](https://www.shippypro.com/blog/fr/envoyer-un-colis-prix-et-tarifs-2026-des-transporteurs-en-france) ·
[valueaddedresource — Simple Delivery](https://www.valueaddedresource.net/ebay-uk-simple-delivery-mandate-april-2025/) ·
[dawap — Boxtal API](https://dawap.fr/integration-api/logistique-shipping/integrateur-boxtal) ·
[bordereaufacile — compte Boxtal](https://www.bordereaufacile.fr/tuto/creer-compte-boxtal) ·
[saask — Sendcloud prix](https://saask.fr/softwares/sendcloud/prix/) ·
[Odoo — Sendcloud](https://www.odoo.com/documentation/17.0/fr/applications/inventory_and_mrp/inventory/shipping_receiving/setup_configuration/sendcloud_shipping.html) ·
[jpi-conseil — Mondial Relay Wix](https://jpi-conseil.fr/comment-integrer-mondial-relay-sur-votre-boutique-wix-en-quelques-etapes/) ·
[plugin WooCommerce Packlink](https://scn.wordpress.org/plugins/?p=50305).
