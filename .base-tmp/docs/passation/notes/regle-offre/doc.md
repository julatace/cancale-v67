# Offre directe eBay : accepter automatiquement au-dessus d'un seuil, ce que dit la documentation d'eBay

Recherche faite le 9 octobre 2026 pour la demande de Julien : « définir une règle sur
chaque annonce, et accepter chaque offre au-dessus ». Lecture seule. Aucun appel à eBay.

## 0. D'où viennent les affirmations

Les domaines d'eBay sont **bloqués** par le proxy de ce conteneur : `developer.ebay.com`,
`www.edp.ebay.com`, `ebay.fr`, `ebay.com`, `export.ebay.com` et `web.archive.org`
(`EGRESS_BLOCKED`). Aucune page d'eBay n'a donc pu être ouverte. Trois niveaux de preuve
sont utilisés, et chaque affirmation dit le sien.

| repère | ce que c'est | fiabilité |
|---|---|---|
| **[W981]** | Le **WSDL officiel d'eBay** (`eBaySvc.wsdl`, « Version 981 », 2016), lu mot pour mot. Il est embarqué dans `org.tonicsoft.ebay:ebaysdkcore:981.0.0`, un repackaging Maven du « eBay SDK for Java » officiel : https://repo1.maven.org/maven2/org/tonicsoft/ebay/ebaysdkcore/981.0.0/ (sha256 du WSDL `bd2971e8…79450`, copie locale dans `wsdl981/eBaySvc.wsdl`). Ses annotations `<xs:documentation>` et `<CallInfo>` sont celles d'eBay. | Texte primaire **exact**, mais de 2016. VRM appelle en niveau 1149. |
| **[DOC]** | Une page `developer.ebay.com` ou d'aide d'eBay, **lue par le moteur de recherche** (extrait résumé). La page elle-même n'a pas été ouverte. | Primaire et à jour, mais **paraphrasé**. À relire sur la page avant de figer une phrase à l'écran. |
| **[TIERS]** | Une source qui n'est pas d'eBay : éditeur d'outils ou ticket GitHub. Citée seulement quand eBay ne dit rien. | Pas primaire. C'est un **indice à mesurer**, jamais une règle. |
| **[MESURÉ]** | Une lecture de SA base (`app_data`, SELECT projetés, owner `74eea6e7…`). | Fait mesuré. |

---

## 1. Trading API : où vivent les champs, comment les poser, comment les retirer

### 1.1 Les champs

| champ | chemin | ce que c'est |
|---|---|---|
| Activer l'Offre directe | `Item.BestOfferDetails.BestOfferEnabled` (booléen) | Sans lui, aucun seuil n'a d'effet. |
| Seuil d'**acceptation** | `Item.ListingDetails.BestOfferAutoAcceptPrice` (AmountType) | Une offre à ce prix ou au-dessus est acceptée par eBay. |
| Seuil de **refus** (facultatif) | `Item.ListingDetails.MinimumBestOfferPrice` (AmountType) | Une offre sous ce prix est refusée par eBay. |

Ce que dit la documentation :

- **[W981]** `BestOfferAutoAcceptPrice` : « *The price at which Best Offers are
  automatically accepted. […] If a buyer submits a Best Offer that is above this value,
  the offer is automatically accepted by the seller. This applies only to items listed in
  categories that support the BestOfferAutoAcceptPrice feature. Best Offer must be
  enabled for the item, and only the seller who listed the item will see
  BestOfferAutoAcceptPrice in a call response.* » (`ListingDetailsType`, ligne 71287 du
  WSDL).
- **[W981]** `MinimumBestOfferPrice` : « *If a buyer submits a Best Offer that is below
  this value, the offer is automatically declined by the seller. This applies only to
  items listed in categories that support the Best Offer Auto-Decline feature. Best Offer
  must be enabled for the item, and only the seller who listed the item can see this
  value. […] To remove this value when revising or relisting an item, use DeletedField.* »
  (ligne 71115).
- **[DOC]** Le guide actuel dit la même chose. On pose le seuil d'acceptation dans
  `Item.ListingDetails.BestOfferAutoAcceptPrice` d'un appel Add, Revise, Relist ou
  Verify, et « *the first Best Offer that meets or exceeds this value will automatically
  be accepted* ». Même chose pour `MinimumBestOfferPrice`, qui refuse.
  Source : https://developer.ebay.com/api-docs/user-guides/static/trading-user-guide/best-offers-auto.html
- **[DOC]** Pour activer la fonction, on utilise d'abord `BestOfferDetails.BestOfferEnabled`,
  puis le conteneur `ListingDetails`.
  Source : https://developer.ebay.com/api-docs/user-guides/static/trading-user-guide/best-offers-flow.html
- **[W981]** `BestOfferDetails` sert, dans les appels Add/Revise/Relist/Verify, à activer
  l'Offre directe. « *The Best Offer feature is not available for auction listings.* »
  (`ItemType.BestOfferDetails` et `BestOfferDetailsType`). VRM ne publie qu'en
  `FixedPriceItem` : c'est compatible.

### 1.2 Les poser à la création (AddFixedPriceItem / VerifyAddFixedPriceItem)

**[W981]** Les deux champs de `ListingDetails` sont des entrées facultatives de
`AddFixedPriceItem`, `AddItem`, `ReviseFixedPriceItem`, `ReviseItem`, `RelistItem`,
`VerifyAddItem` et `VerifyRelistItem` (`<RequiredInput>No</RequiredInput>`).
`BestOfferEnabled` y ajoute `VerifyAddFixedPriceItem`.

⚠️ La liste `CallInfo` de 2016 ne nomme pas `VerifyAddFixedPriceItem` pour les deux
seuils. Le guide **[DOC]** parle pourtant d'« *Add/Revise/Relist/Verify* », et cet appel
prend le même `ItemType`. C'est probablement un oubli de la liste, mais la vérification à
blanc avec seuils n'est **pas prouvée**.

Forme à émettre dans le `<Item>` que construit `itemXml` :

```xml
<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>
<ListingDetails>
  <BestOfferAutoAcceptPrice currencyID="EUR">85.00</BestOfferAutoAcceptPrice>
  <!-- facultatif -->
  <MinimumBestOfferPrice currencyID="EUR">60.00</MinimumBestOfferPrice>
</ListingDetails>
```

**[DOC]** L'article de base de connaissances 527 donne un exemple d'`AddItem` qui pose
les deux seuils dans `ListingDetails`. Il exige une annonce à prix fixe, et dit que
`MinimumBestOfferPrice` « *should be less than the StartPrice but can be equal to
BestOfferAutoAcceptPrice* ».
Sources : https://developer.ebay.com/support/kb-article?KBid=527 et
https://developer.ebay.com/support/knowledge-base/527

### 1.3 Les poser sur une annonce existante (ReviseFixedPriceItem)

- **[DOC]** `Item.ListingDetails.BestOfferAutoAcceptPrice` et
  `Item.ListingDetails.MinimumBestOfferPrice` font partie des entrées propres à
  `ReviseFixedPriceItem`.
  Source : https://developer.ebay.com/devzone/xml/docs/reference/ebay/ReviseFixedPriceItem.html
- **[W981]** « *Only specify Item fields for the details that are changing. Unless
  otherwise specified […], the listing retains its existing values for fields that you
  don't pass in the ReviseFixedPriceItem request.* » (`ReviseFixedPriceItemRequestType.Item`).

Un appel minimal, sur le modèle de `handleSku` (`api/ebay.js`, ligne ~699) :

```xml
<Item><ItemID>…</ItemID>
  <BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>
  <ListingDetails><BestOfferAutoAcceptPrice currencyID="EUR">85.00</BestOfferAutoAcceptPrice></ListingDetails>
</Item>
```

#### ⚠️⚠️ Changer le prix efface les seuils

C'est le point le plus important pour VRM.

- **[W981]**, à la lettre (`ItemType.StartPrice`, « For Revise calls ») : « *If the
  StartPrice value for a fixed-price item is changed with a Revise call, the
  MinimumBestOfferPrice and BestOfferAutoAcceptPrice fields in the ListingDetails
  container will be dropped (if set), basically turning off the Best Offer Auto Accept
  and/or Auto Decline features. If the seller wanted to reintroduce either of these Best
  Offer threshold values in the listing again, an additional Revise call would have to be
  made, passing in the desired threshold values.* » La même phrase figure sous les deux
  champs de `ListingDetailsType`.
- **[DOC]** La page `ItemType` actuelle dit toujours la même chose.
  Source : https://developer.ebay.com/devzone/xml/docs/reference/ebay/types/ItemType.html
- **[DOC]** L'article 880 décrit l'avertissement **21992** (« *AutoDecline has been
  disabled or is no longer available* »). Il apparaît quand un `ReviseItem` baisse le
  `StartPrice` sans renvoyer `ListingDetails.MinimumBestOfferPrice`. L'Offre directe reste
  active, seul le refus automatique saute. Le remède est de renvoyer le seuil **dans le
  même appel**.
  Source : https://developer.ebay.com/support/kb-article?KBid=880
- **[TIERS]** Un ticket GitHub daté du 1er octobre 2026 montre l'**autre issue** possible.
  Une mise à jour de prix poussée à un niveau égal ou inférieur au seuil d'acceptation est
  **refusée** : « *Invalid AutoAccept price. The Best Offer Auto Accept Price must be less
  than the Buy It Now price.* », **erreur 23004**, trois fois en 24 h. L'appel utilisé n'y
  est pas nommé.
  Source : https://github.com/chrisbachmaxwell/product-pipeline/issues/160

⇒ **Conséquence directe dans VRM.** `handleRevise` change le prix par
**`ReviseInventoryStatus`** (« paires qui dorment », la baisse sur eBay). Ce conteneur
(`InventoryStatusType` : SKU, ItemID, StartPrice, Quantity — **[W981]**) **ne peut pas
porter `ListingDetails`**. Quand une paire a un seuil, une baisse de prix par cette voie
peut donc :

- soit **effacer le seuil en silence** : la paire n'accepte plus rien seule, et Julien
  croit encore que sa règle tourne ;
- soit être **refusée** (23004), si le nouveau prix passe sous le seuil.

La documentation ne dit pas lequel des deux arrive avec `ReviseInventoryStatus`. Les deux
issues doivent être tenues :

1. Sur une paire qui a un seuil, changer le prix avec `ReviseFixedPriceItem` en renvoyant
   `StartPrice` **et** `ListingDetails` (seuils recalculés sous le nouveau prix) dans le
   même appel.
2. Relire l'annonce (`GetItem`) après **tout** changement de prix, pour constater ce qui
   reste. Une règle que l'app croit active, alors qu'eBay l'a retirée, est le pire cas :
   c'est un faux.

### 1.4 Retirer le seuil (DeletedField)

- **[DOC]** Pour couper l'acceptation ou le refus automatique dans un appel Revise ou
  Relist, on passe le chemin complet dans `DeletedField`. Exemple donné :
  `Item.ListingDetails.BestOfferAutoAcceptPrice`.
  Sources : https://developer.ebay.com/devzone/xml/docs/Reference/eBay/RelistFixedPriceItem.html
  et https://developer.ebay.com/devzone/xml/docs/reference/ebay/types/listingdetailstype.html
- **[W981]** La règle de casse : « *Use values that match the case of the schema element
  names […] or make the initial letter of each field name lowercase […]. However, do not
  change the case of letters in the middle of a field name.* » Autres règles : on ne
  supprime jamais un champ obligatoire, et « *some optional fields cannot be deleted if
  the item has bids and/or ends within 12 hours* ».

Forme :

```xml
<Item><ItemID>…</ItemID></Item>
<DeletedField>Item.ListingDetails.BestOfferAutoAcceptPrice</DeletedField>
<DeletedField>Item.ListingDetails.MinimumBestOfferPrice</DeletedField>   <!-- si posé -->
```

`DeletedField` est un **frère** de `<Item>` dans la requête, pas un enfant.

⚠️ **Non prouvé pour `ReviseFixedPriceItem`.** En 2016, la liste blanche des chemins de
`DeletedField` de `ReviseFixedPriceItem` ne contenait **aucun** `Item.ListingDetails.*`.
Celle de `ReviseItem` n'avait que `MinimumBestOfferPrice`, et celle de
`RelistFixedPriceItem` aussi (**[W981]**, lignes 18261 à 18330, 16852 et 18787). Les pages
actuelles **[DOC]** citent le chemin du seuil d'acceptation pour « Revise et Relist ».
**À mesurer sur une annonce de Julien avant de promettre « retirer la règle ».** Si eBay
refuse, l'issue doit être dite (« eBay n'a pas retiré le seuil »), jamais présentée comme
faite.

Repli possible, avec un coût : `BestOfferEnabled=false` coupe toute l'Offre directe.
**[W981]** Ce booléen ne se change que si l'annonce n'a eu aucune vente, n'a aucune offre
ni contre-offre en attente, et ne finit pas dans les 12 h.

### 1.5 Contraintes

| contrainte | source |
|---|---|
| **Le seuil d'acceptation doit être inférieur au prix « Achat immédiat ».** « *Buyers will not know your limits, but the upper limit must be lower than the Buy It Now price in your listing.* » | **[DOC, à confirmer]** Le moteur de recherche cite cette phrase d'une page d'aide vendeur d'eBay, parmi les résultats https://export.ebay.com/en/marketing/promote-listings/best-offer et https://www.ebay.com/help/selling/listings/selling-buy-now/adding-best-offer-listing?id=4144 . Une seconde recherche sur la page 4144 **ne la retrouve pas**. Ce qui la soutient : l'erreur 23004 ci-dessous, observée le 1er octobre 2026. |
| Erreur à l'appui : **23004** « *Invalid AutoAccept price. The Best Offer Auto Accept Price must be less than the Buy It Now price.* » | **[TIERS]** ticket GitHub cité plus haut ; https://ecommerceapi.dev/ebay/error-23004-invalid-autoaccept-price/ ; https://help.m2epro.com/en/support/solutions/articles/9000227601-the-best-offer-auto-accept-price-must-be-less-than-the-buy-it-now-price . La liste officielle des erreurs (https://developer.ebay.com/devzone/XML/docs/Reference/ebay/Errors/ErrorMessages.htm) n'a pas pu être ouverte. |
| **Le seuil de refus doit être inférieur au prix**, et peut **égaler** le seuil d'acceptation. | **[DOC]** article 527 (lien plus haut) |
| Un seuil de refus supérieur au seuil d'acceptation est refusé : « *The price for declining offers can't be higher than the price for accepting offers* » (erreur citée **21919263**). | **[TIERS]** https://www.easychannel.com/listing-errors/ebay-listing-error-21919263-auto-decline-price-must-be-less-than-auto-accept-price — non vérifié chez eBay |
| Seuil de refus supérieur ou égal au prix d'Achat immédiat : refusé. | **[TIERS]** https://help.m2epro.com/en/support/solutions/articles/9000227595-auto-decline-amount-cannot-be-greater-than-or-equal-to-the-buy-it-now-price |
| **Devise** : « *In Add/Revise/Relist calls, the currency can be specified in the Item.Currency field […] instead. If you do specify this attribute […], the value must match the site currency (i.e. the same as Item.Currency)* ». VRM envoie déjà `<Currency>EUR</Currency>` et le site 71 (France) : on met donc `currencyID="EUR"`. | **[W981]** `AmountType.currencyID` |
| **Décimales** : `AmountType` est un `xs:double`. eBay peut renvoyer `85.0` au lieu de `85.00`. VRM formate déjà les prix en `.toFixed(2)` : faire de même pour les seuils, et relire une réponse avec `Number()`, jamais en comparant les chaînes. | **[W981]** `AmountType` |
| Offres envoyées **par le vendeur** (pas les seuils) : au moins 5 % sous le prix d'Achat immédiat sous 200 €, 3 % de 200 à 1 000 €, 2 % au-delà. Frais de port non compris. | **[DOC]** page d'aide eBay.fr 4144, lue via le moteur de recherche : https://www.ebay.fr/help/selling/listings/selling-buy-now/adding-best-offer-listing?id=4144 — ne pas confondre avec la règle du seuil |
| Une annonce peut être révisée **250 fois par jour civil** (`ReviseFixedPriceItem` + `ReviseItem`). | **[DOC]** https://developer.ebay.com/develop/guides/sell/listing-management (et la page de `ReviseFixedPriceItem` ; une version ancienne disait 150) |

Codes à connaître, et leur fiabilité :

- **21992**, avertissement « *AutoDecline has been disabled or is no longer available* »
  — **[DOC]** article 880 ;
- **23004** — **[TIERS]** ;
- **21919263** — **[TIERS]**.

`tradingCall` sépare déjà erreurs et avertissements (`erreurs`, `avertissements`). Un
**avertissement** 21992 sur une révision qui réussit (`Ack Warning`) doit être affiché
comme « le refus automatique a sauté ». Le lire comme un succès serait faux.

---

## 2. Lire le seuil

### 2.1 GetMyeBaySelling (ActiveList / ScheduledList) : NON

- **[W981]** La liste `CallInfo` des deux seuils ne nomme que `GetItem` (et
  `GetSellingManagerTemplates`), avec `DetailLevel` à none, ItemReturnDescription,
  ItemReturnAttributes ou ReturnAll. S'y ajoutent `GetSellerList` (DetailLevel
  ItemReturnDescription ou ReturnAll) et, pour le seuil de refus seulement,
  `GetItemTransactions` et `GetSellerTransactions`. **`GetMyeBaySelling` n'y est pas.**
- **[W981]** `GetMyeBaySelling` rend bien le conteneur `ListingDetails`, pour ActiveList,
  ScheduledList et d'autres. Mais il le rend avec les seuls enfants documentés pour lui :
  dates, URL, etc.
- **[W981]** `BestOfferEnabled` n'est pas non plus rendu par `GetMyeBaySelling`.
  `BestOfferCount` l'est, mais seulement pour ActiveList.
- **[DOC]** La recherche ciblée sur les deux noms ensemble ne trouve **aucune** page qui
  dise que `GetMyeBaySelling` rend le seuil. `GetItem` et `GetSellerList` le listent.
  Sources : https://developer.ebay.com/devzone/xml/docs/reference/ebay/getitem.html et
  https://developer.ebay.com/devzone/xml/docs/reference/ebay/GetSellerList.html
- **[DOC]** Depuis le 31 janvier 2024, `GetItemTransactions` et `GetSellerTransactions` ne
  rendent plus ces champs.
  Source : https://developer.ebay.com/devzone/xml/docs/reference/ebay/types/listingdetailstype.html

⇒ La liste que VRM lit aujourd'hui (`listeVendeur`, `api/ebay.js` ligne ~194) **ne dira
jamais quel seuil a une annonce**. Une annonce lue par ce seul appel a un seuil
**« pas su »**, jamais « aucun ».

### 2.2 GetItem : OUI, et le vendeur seul le voit

- **[W981]** Rendu « *Conditionally* » dès `DetailLevel` none : un `GetItem` sans
  `DetailLevel` suffit (VRM en fait déjà un ligne ~823). Avec `OutputSelector`, la réponse
  se réduit aux champs demandés : « *the output data will only include the fields you
  specified* ». Exemple : `ItemID`, `SKU`, `ListingDetails`, `BestOfferDetails`,
  `SellingStatus`.
- « *Only the seller who listed the item will see BestOfferAutoAcceptPrice in a call
  response* » (**[W981]** et **[DOC]**). Il faut donc le jeton **du compte eBay qui a
  publié**. Avec plusieurs comptes eBay (la branche de la passe en cours), le jeton d'un
  autre compte ne verra pas le seuil : ce sera « pas su », pas « aucun ».

### 2.3 GetSellerList : OUI, par lot

- **[W981]** Le seuil est rendu avec `DetailLevel` ItemReturnDescription ou ReturnAll.
  `Pagination` est obligatoire dès qu'on met un `DetailLevel`, et « *for most Trading API
  calls, the maximum value is 200* » par page.
- **[W981]** Il faut une fenêtre `EndTimeFrom`/`EndTimeTo` ou `StartTimeFrom`/`StartTimeTo`
  « *less than 120 days* ». Les annonces à durée illimitée (GTC) se renouvellent tous les
  30 jours, donc une fenêtre de fin de [maintenant ; +31 j] devrait les couvrir toutes.
  ⚠️ Ce n'est pas mesuré, et le cas des annonces programmées dans `GetSellerList` n'est
  pas documenté.
- **[W981]** `SKUArray` filtre sur des SKU, et ne garde que les annonces actives.
- `OutputSelector` est indispensable, sinon ReturnAll rapatrie les descriptions. C'est la
  leçon §4.4, appliquée à eBay.

### 2.4 Nombre d'appels et quotas

| façon de lire | appels pour N annonces |
|---|---|
| `GetItem` | **N appels** |
| `GetSellerList` | **⌈N/200⌉ appels** (fenêtre de dates plus pages) |

Pour ses 2 annonces actuelles, deux `GetItem` suffisent.

Quotas :

- **[DOC]** Le plafond **par défaut** est de 5 000 appels Trading par jour **et par
  application**, quel que soit le nombre de vendeurs. On l'augmente par l'« Application
  Growth Check ». L'API Analytics (`getRateLimits`) donne la limite du jeu de clés.
  Sources : https://go.developer.ebay.com/api-call-limits et le fil du support
  développeurs https://community.ebay.com/t5/Traditional-APIs-Selling/ReviseInventoryStatus-API-call-limit/td-p/34613411
  (un fil de la communauté, où répond le support eBay).
- **[DOC, même fil]** `ReviseInventoryStatus` a en plus une limite de 6 000 appels par
  15 s et par vendeur.

⇒ Avec mille vendeurs, un `GetItem` par annonce à chaque ouverture **ne tient pas**. On
lit le seuil **quand on le pose** (relecture de contrôle) et quand on l'**affiche sur
demande**, ou par `GetSellerList` en lot. Jamais une boucle de `GetItem` à chaque
rafraîchissement.

---

## 3. Inventory API (`offer.listingPolicies.bestOfferTerms`) : inutile ici

- **[DOC]** Le conteneur `bestOfferTerms` (sous `listingPolicies`) est arrivé en Inventory
  API 1.7.0. Il porte `bestOfferEnabled` (booléen) et `autoAcceptPrice` /
  `autoDeclinePrice` (Amount `{currency, value}`), dans `createOffer`, `updateOffer` et
  `bulkCreateOffer`.
  Sources : https://developer.ebay.com/api-docs/sell/inventory/static/release-notes-archive.html
  et https://developer.ebay.com/api-docs/sell/inventory/types/slr:BestOffer
- **[DOC]** `updateOffer` **remplace l'offre entière** : chaque champ doit être renvoyé,
  même inchangé. Un `publishOffer` est ensuite nécessaire.
  Source : https://developers.ebay.com/api-docs/sell/inventory/resources/offer/methods/createOffer
- Les mêmes noms existent dans le contrat Inventory que porte le paquet npm `ebay-api`
  10.0.1 (`BestOffer: {autoAcceptPrice, autoDeclinePrice, bestOfferEnabled}`, copie dans
  `npm-ebay-api/`).
- **Pourquoi c'est inutile pour VRM :** VRM publie par **Trading**
  (`AddFixedPriceItem`), et ses annonces lues viennent de `GetMyeBaySelling`. L'Inventory
  API ne gère que les offres qu'elle a créées. Pour une annonce Trading, il faudrait
  d'abord une migration (`bulkMigrateListing`, à prix fixe seulement), qui crée Inventory
  Item, Offer et Location.
  Source **[DOC]** : https://developer.ebay.com/api-docs/sell/inventory/resources/listing/methods/bulkMigrateListing
  Le guide dit par ailleurs que les annonces actives se révisent en Trading
  (`ReviseItem` / `ReviseFixedPriceItem`) :
  https://developer.ebay.com/develop/guides-v2/listing-management
  **Rester en Trading.** Deux voies d'écriture pour une même règle, ce serait §11 violé.
- **Ce qui sert en REST : savoir si la catégorie accepte la règle.** **[DOC]** Le guide
  renvoie à la Sell Metadata API `getNegotiatedPricePolicies`
  (`/sell/metadata/v1/marketplace/EBAY_FR/get_negotiated_price_policies?filter=categoryIds:{…}`).
  Sa réponse porte, par catégorie, `bestOfferAutoAcceptEnabled`,
  `bestOfferAutoDeclineEnabled` et `bestOfferCounterEnabled`. Les noms sont vérifiés dans
  le contrat du paquet `ebay-api`.
  Source : https://developer.ebay.com/api-docs/user-guides/static/trading-user-guide/best-offers-auto.html
  VRM appelle déjà `get_item_condition_policies` de la même API dans `handlePubInfo` :
  c'est la même forme d'appel. En Trading, l'équivalent est `GetCategoryFeatures` avec les
  FeatureID `BestOfferEnabled`, `BestOfferAutoAcceptEnabled` et
  `BestOfferAutoDeclineEnabled` (**[W981]**).

---

## 4. Restrictions, ce que voit l'acheteur, frais

### 4.1 La catégorie

- **[MESURÉ]** Ses **2** annonces eBay en ligne (`ebay_listings`, capture du 8 octobre)
  sont toutes deux dans la catégorie **15709** (« Vêtements, accessoires > Homme :
  chaussures > **Baskets** », eBay.fr). Aucune n'a de SKU aujourd'hui.
- **[W981]** et **[DOC]** : les seuils ne s'appliquent que dans les catégories qui
  supportent l'acceptation ou le refus automatique.
- **Non mesuré :** si la catégorie 15709 sur EBAY_FR a `bestOfferAutoAcceptEnabled=true`.
  On ne peut le savoir qu'en appelant `getNegotiatedPricePolicies` ou
  `GetCategoryFeatures`. La réponse peut être « non », et l'écran doit savoir le dire.
- **[DOC, aide eBay.fr]** L'Offre directe est proposée sur les annonces à prix fixe, pas
  sur les enchères.
  Source : https://www.ebay.fr/help/buying/buy-now/faire-une-offre-directe?id=4019
- Programme d'authenticité des baskets sur eBay.fr : son effet sur l'Offre directe n'a pas
  été trouvé dans une source d'eBay. **Inconnu.**

### 4.2 Les offres en attente, les ventes, les 12 dernières heures

- **[W981]** Le **booléen** `BestOfferEnabled` ne se change pas si l'annonce a eu des
  ventes, a des offres ou contre-offres **en attente**, ou finit dans les 12 h.
- **[DOC]** La page `ItemType` décrit un réglage verrouillé si l'annonce a « *any pending
  bids, any pending best offers, previous sales […], or if the listing will end within 12
  hours* ». L'extrait ne nomme pas lequel : il faut le relire sur la page.
  Source : https://developer.ebay.com/devzone/xml/docs/reference/ebay/types/ItemType.html
- **Pour les seuils eux-mêmes**, aucune source ne dit qu'ils sont verrouillés dans les
  12 dernières heures ou quand des offres sont en attente. **Non documenté, à mesurer.**
- Une annonce GTC a une `EndTime` tous les 30 jours (son renouvellement). VRM la lit déjà
  (`fin`). Que la règle des 12 h joue avant chaque renouvellement est **probable mais non
  documenté**.

### 4.3 Les annonces programmées (ScheduledList)

- On peut poser les seuils **dans l'`AddFixedPriceItem` qui programme** : même `<Item>`,
  avec son `<ScheduleTime>`. C'est la voie la plus sûre pour une programmée.
- Les **réviser** avant le départ n'est pas prouvé :
  - **[DOC]** L'article 484 dit que `ReviseItem` peut modifier `Item.ScheduleTime` tant
    que le départ est dans le futur :
    https://developer.ebay.com/support/kb-article?KBid=484
  - `ReviseFixedPriceItem` se décrit pour « *a currently active fixed-price listing* »
    (**[W981]** et **[DOC]**).
  - Le dossier note déjà « ReviseFixedPriceItem + ScheduleTime » comme **non mesuré**.
    Poser un seuil sur une programmée par Revise : **non mesuré**.
- **[W981]** `VerifyOnly` (révision à blanc) n'existe que pour **`ReviseItem`**, pas pour
  `ReviseFixedPriceItem`. **[DOC]** le confirme pour `ReviseItem`.

### 4.4 Le format

Prix fixe uniquement (**[W981]**). Pour une annonce à variantes, l'Offre directe n'a pas
été recherchée. VRM publie à l'unité, sans variantes.

### 4.5 Les frais

- **[DOC, eBay.fr]** Pour l'envoi d'offres et l'Offre directe : « *en dehors des frais
  standard pour les annonces au format Prix fixe, aucun coût supplémentaire n'est associé
  à l'utilisation de ces options* ». Source :
  https://www.ebay.fr/espacevendeurs/developper-ventes/outils-promotionnels/envoyer-offre-ou-recevoir-offre-directe
- **[DOC, eBay.fr]** Particulier dans l'Espace économique européen : pas de frais de
  transaction. Professionnel : la commission habituelle, sur le prix **final** (le prix
  accepté). Sources :
  https://www.ebay.fr/help/selling/fees-credits-invoices/services-de-paiement-frais-pour-les-vendeurs-particuliers?id=4822
  et …?id=4809
- La vérification à blanc fait foi pour SON compte : VRM lit déjà les frais par nom.

### 4.6 Ce que voit l'acheteur

- **[DOC, eBay.fr]** L'acheteur ne voit **pas** les seuils (« Les acheteurs ne voient pas
  ces seuils », aide 4144).
- **[DOC, eBay.fr]** Si le vendeur accepte, l'achat est conclu : l'acheteur doit payer le
  montant offert, comme pour tout achat. Une offre non traitée expire au bout de 24 h, ou
  à la fin de l'annonce. Source : aide 4019 (lien en 4.1).
- **[DOC, ebay.com]** L'aide acheteur américaine ajoute deux points. Si le paiement
  automatique est activé, eBay encaisse dès l'acceptation et l'objet est réservé. Sinon,
  l'objet **peut rester disponible pour d'autres acheteurs jusqu'au paiement**.
  Source : https://www.ebay.com/help/buying/buy-now/making-best-offer?id=4019
  **Non confirmé pour eBay.fr.** C'est pourtant ce qui compte pour la double vente.
- **[DOC]** Une offre acceptée crée une **ligne de commande** : « *When a Best Offer has
  been accepted, check on the status of the order line item* ».
  Source : https://developer.ebay.com/api-docs/user-guides/static/trading-user-guide/best-offers-flow.html
  ⇒ Elle arrivera dans `ebay_orders` comme toute vente. Si l'annonce porte son SKU
  `VRM-{n°}`, l'anti double vente existant (`doublesVenteEbay`) la voit.
  ⚠️ Sans SKU, l'offre acceptée ne désigne **aucune** paire (§5). Ses deux annonces
  actuelles n'ont **pas** de SKU. Poser une règle sur une annonce non reliée, c'est
  vendre une paire que VRM ne saura pas retirer de Vinted.

### 4.7 Une offre pile au seuil : acceptée (≥)

Trois textes d'eBay sur quatre disent **« égal ou au-dessus »** :

- le guide (**[DOC]**) : « *meets or exceeds* » ;
- la définition du FeatureID `BestOfferAutoAcceptEnabled` (**[W981]**) : « *all Best
  Offers and counter offers at or above this price value are automatically accepted* » ;
- la page `ListingDetailsType` actuelle (**[DOC]**, extrait) : « *at or above* ».

Seule la définition du champ en 2016 disait « *above* ». **Règle à retenir : ≥.** Et le
refus porte sur ce qui est **strictement en dessous** du minimum (« *below* »).

⚠️ Toujours d'après la même définition **[W981]**, la règle s'applique aussi aux
**contre-offres** de l'acheteur, et le refus aussi (« *all Best Offers and counter
offers below this price value are automatically declined* »).

### 4.8 Le moment de l'acceptation

« *Automatically accepted without any seller action* » (**[W981]**, FeatureID).
L'aide eBay.fr dit : « nous pouvons accepter ou refuser pour vous ». **Aucun délai n'est
documenté.** On ne promet pas « instantané ».

### 4.9 Ce que règle eBay.fr à l'écran (repère pour Julien)

Dans le Seller Hub, il s'agit de « Autoriser les offres », puis d'un montant minimum
et/ou d'un montant d'acceptation automatique, tous deux facultatifs (**[DOC]** aide 4144).
Il peut donc les changer **lui-même** sur eBay, sans passer par VRM. VRM doit **relire**,
jamais supposer que son dernier envoi est toujours en place.

---

## 5. Ce que l'API ne permet PAS, à ne jamais promettre

1. **Lire la règle depuis la liste d'annonces.** `GetMyeBaySelling` ne rend ni le seuil
   ni `BestOfferEnabled`. Sans `GetItem` ou `GetSellerList`, la règle d'une annonce est
   « pas su ».
2. **Garder la règle quand le prix change**, sauf à la renvoyer dans le même appel. Une
   baisse par `ReviseInventoryStatus` ne peut pas la porter : elle l'efface (21992) ou est
   refusée (23004).
3. **Une règle globale par compte**, du type « accepte tout à −10 % ». Rien de tel dans
   Trading : le seuil est **par annonce**, en **montant**, pas en pourcentage. Une règle
   « −10 % » de VRM se traduit en montant au moment de l'envoi, et devient fausse dès que
   le prix bouge (point 2).
4. **Un seuil égal ou supérieur au prix d'Achat immédiat**, donc « accepter toute offre » :
   refusé (aide eBay, 23004). Pour vendre au prix, c'est l'Achat immédiat.
5. **Garantir que la catégorie le permet.** Ça dépend de la catégorie et du site
   (`getNegotiatedPricePolicies` ou `GetCategoryFeatures`). Non mesuré pour 15709 /
   EBAY_FR.
6. **Retirer le seuil par `ReviseFixedPriceItem` + `DeletedField`** : documenté
   aujourd'hui, absent de la liste blanche de 2016, **non mesuré**.
7. **Réviser à blanc** avec `ReviseFixedPriceItem` : `VerifyOnly` n'existe que pour
   `ReviseItem`.
8. **Savoir quand eBay a accepté.** Rien dans ces champs ne prévient. Ça se voit après
   coup, par la commande (`ebay_orders`) ou par `GetBestOffers`.
9. **Choisir l'acheteur, ou refuser après coup.** Une offre acceptée automatiquement est
   une vente conclue. Revenir dessus, c'est une annulation, avec ses conséquences pour le
   vendeur.
10. **Toucher Vinted.** Rien de tout cela ne s'applique à Vinted, où l'acceptation
    automatique reste retirée (§3).
11. **Promettre que l'objet est réservé dès l'acceptation sur eBay.fr.** Seule l'aide
    américaine en parle, et elle dit le contraire quand le paiement automatique n'est pas
    actif.

---

## 6. Ce que ça change pour la conception dans VRM (à décider ailleurs)

- **Poser.** `ReviseFixedPriceItem` (ou l'ajout à la publication) avec `BestOfferEnabled`
  + `BestOfferAutoAcceptPrice` en EUR, deux décimales. Seuil < prix, refus ≤ seuil.
  Refuser **côté serveur** avant tout appel eBay (même motif que `confirme:true`). Puis
  `GetItem` (`OutputSelector`) pour constater ce qu'eBay a gardé.
- **Afficher : trois états, jamais deux.** Seuil lu chez eBay (avec la date de lecture) ·
  aucun seuil (lu) · « pas su » (jamais lu, ou annonce d'un autre compte eBay).
- **Changer le prix d'une paire qui a un seuil.** Pas par `ReviseInventoryStatus`.
  Renvoyer les seuils dans le même `ReviseFixedPriceItem` et relire. Sinon, l'écran doit
  dire que la règle a sauté.
- **Exiger le SKU `VRM-{n°}`** avant de poser une règle : une vente sans identité ne
  sortirait la paire d'aucune autre plateforme (§5).
- **Premiers gestes à mesurer sur SON compte**, une annonce, rien en masse :
  1. `getNegotiatedPricePolicies` sur 15709 / EBAY_FR ;
  2. poser un seuil, puis le relire par `GetItem` ;
  3. le retirer par `DeletedField` ;
  4. baisser le prix par `ReviseInventoryStatus` sur une annonce **avec** seuil, et
     regarder lequel des deux comportements arrive (21992 ou 23004).

## Annexe : fichiers dans ce dossier

- `wsdl981/eBaySvc.wsdl` : le WSDL officiel version 981, extrait du jar Maven (lignes
  utiles : 35174 `BestOfferDetailsType`, 56177–56516 FeatureID, 66184 `ItemType.StartPrice`,
  66806 `ItemType.BestOfferDetails`, 71115 et 71287 les deux seuils, 18261 `DeletedField`
  de `ReviseFixedPriceItem`) ;
- `npm-ebay-api/` : contrats Inventory et Metadata (noms de champs seulement, sans
  description) ;
- `ItemType.php` : définitions DTS du SDK PHP (noms de champs).
