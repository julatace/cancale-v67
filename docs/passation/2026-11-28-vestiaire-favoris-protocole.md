# Vestiaire Collective — messages et offres aux « j'aime » : le protocole observé (28 nov. 2026)

Source : deux exports de **VRM Observateur Vestiaire 2.1.0** (branche `claude/observateur-vestiaire`), faits par
Julien sur SON compte le 28 nov. (exploration automatique + ses propres gestes : un message et une offre envoyés
à la main). Les exports restent hors du dépôt (données réelles). Ici : seulement les routes, les formes et
l'ordre — aucune valeur réelle (identifiants remplacés par `{…}`).

**Statut : SPÉCIFICATION pour l'extension.** Julien a demandé de ne pas toucher l'extension dans cette session
(une autre personne s'en occupe) : rien n'est implémenté. À faire dans `vinted-sync-extension/vc*.js` en suivant
les garde-fous de CLAUDE.md §3 (compte de l'onglet, une requête à la fois, plafonds, arrêt au captcha, 403/429).

## 1. Qui a aimé quoi : la cloche de Vestiaire

`GET https://apiv2.vestiairecollective.com/notification-feed/v2?offset=0&limit=60&category=updates&isoCountry=FR&x-siteid=1&x-language=fr&x-currency=EUR`

- Réponse `data[]` d'objets `notificationFeed`. Un « j'aime » = `eventType: "custom_community"`,
  `textBody: "{pseudo} vient d’aimer votre pièce, envoyez lui un message !"`, `category: "updates"`,
  `status` (`seen`/`read`), `date` (ISO).
- `productLink.meta.data.id` (et `profileLink.mobile` : `…type=buyerSellerChat&productId={produit}&channelId={acheteur}-{produit}`)
  donne **l'identifiant de conversation = `{idAcheteur}-{idProduit}`** ⇒ l'acheteur et l'article par IDENTITÉ
  (jamais par le pseudo affiché). `productPicture.path` = `/produit/{idProduit}-1_2.jpg`.
- Autres `eventType` vus : `chat_message_new` (catégorie `messages`), `custom_alerts` (pub), `custom_activity`
  (« votre article est en vente »).
- Compteur : `GET /notification-feed-counter/v2` ; marquer lu : `PATCH /notification-feed/{idNotif}` `{"status":"read"}` ;
  remise à zéro : `PATCH /notification-feed/reset-counters` `{"category":["updates"]}` (fait par la page au clic).

## 2. Ouvrir la conversation (ce que fait la page au clic sur la notification)

1. `POST https://apiv2.vestiairecollective.com/chat/channel/` corps `{"buyerId":"{acheteur}","sellerId":"{vendeur}","productId":"{produit}"}`
   ⇒ `data.id = "{acheteur}-{produit}"`, `type: "chat_channel"`, `buyer`/`seller` (username, picture.path, profile.path,
   `channelBlock`, `globalBlock`, country), `activity`. (À lire : `globalBlock`/`channelBlock` ⇒ ne pas écrire.)
2. (sur une fiche produit, la page appelle aussi) `POST /chat/eligibility` `{"sellerId","buyerId","sellerSegment":"C2C","productId"}` ⇒ `data.eligibility` (bool).
3. `GET https://apiv2.vestiairecollective.com/chat/user/token` ⇒ `data.userToken` (jeton Stream, MASQUÉ dans l'export).
4. Messagerie = **Stream Chat** (`chat.stream-chat.com`), WebSocket `wss://chat.stream-chat.com/connect` +
   REST avec en-têtes `authorization` (le jeton), `stream-auth-type`, `x-stream-client`, `x-client-request-id`,
   et paramètres `user_id={vendeur}&connection_id=…&api_key=…` :
   - `POST /channels/messaging/{acheteur}-{produit}/query` `{"data":{},"state":true,"watch":true,"presence":false}`
   - `POST /channels/messaging/{acheteur}-{produit}/query` `{"data":{},"state":true,"messages":{"limit":25,"id_lt":null}}`
   - `POST /channels/messaging/{acheteur}-{produit}/read` `{}`
   Les en-têtes apiv2 : cookie de session (`__session`), aucun `Authorization` ; toutes les requêtes sont des
   XHR de la page `https://fr.vestiairecollective.com` (`initiator`), donc **depuis l'onglet**, comme Vinted.

## 3. Envoyer le message

`POST https://chat.stream-chat.com/channels/messaging/{acheteur}-{produit}/message?user_id={vendeur}&connection_id=…&api_key=…`
corps `{"message":{"text":"…"}}` ⇒ 201, `message.id`, `type:"regular"`, `user` (le vendeur).
Observé : ~7 s entre l'ouverture du fil et l'envoi (frappe humaine). (La page peut aussi appeler
`POST /messages/{id}/translate {"language":"fr"}` sur un message reçu : lecture seulement.)

## 4. Faire une offre (le vendeur propose un prix à l'acheteur)

`POST https://apiv2.vestiairecollective.com/products/{produit}/negotiations?isoCountry=FR&x-siteid=1&x-language=fr&x-currency=EUR`
corps `{"offerInWholeNumber":{prix entier en €},"buyerId":"{acheteur}","sellerCurrency":"EUR"}` ⇒ 200,
`data` : `type:"negotiation"`, `price`, `initialPrice`, **`minOffer`** et **`maxOffer`** (bornes imposées par
Vestiaire), `buyerRemainingOffers`, `sellerRemainingOffers`, `userMessage:"Votre offre a été envoyée."`,
`userSubMessage:"Se termine dans 24 heures"`, `isAccepted`, `isClosed`, `lastEvent.action:"offer"`.
Observé : ~3,4 s après le message. Bornes à lire AVANT : `GET /products/{produit}/negotiation-initial-conditions-view`
(lu par la page) ; négociation en cours : `GET /products/{produit}/active-negotiation` (404 = aucune) ;
liste : `GET /negotiations`.

## 5. Séquence « message aux j'aime » proposée (à valider par Julien, comme Vinted)

1. Lire la cloche (§1), garder les `custom_community` récents, non encore traités (clé = `{acheteur}-{produit}`),
   article encore en vente chez lui, acheteur non exclu (`vrm_crm_exclus`).
2. `POST /chat/channel/` (§2.1) ; si `globalBlock`/`channelBlock` ⇒ sauter et dire.
3. `GET /chat/user/token` puis Stream `query` (watch) + `query` (messages) : si le fil contient déjà un message
   du vendeur ⇒ « déjà contacté », sauter.
4. Délai au hasard (≥ 7 s, rythme VRM 40–90 s entre deux personnes), `POST …/message` (versions de texte au hasard).
5. Si une offre est réglée : prix = % réglé, remonté au plancher (prix mini, sinon achat + 10 %), BORNÉ par
   `minOffer`/`maxOffer` de Vestiaire (lus au §4), entier ; délai ≥ 3,4 s ; `POST /products/{produit}/negotiations`.
   Si le texte annonce l'offre, envoyer l'offre AVANT le message (même règle que Vinted 5.410.8).
6. Journal + plafonds (15/h favoris, 50 actions/h), arrêt au captcha/403/429, compte de l'onglet = vendeur.

## 6. Ce qui reste inconnu

- La forme exacte des bornes de `negotiation-initial-conditions-view` (réponse non dépliée ici) — à relire dans l'export.
- Le comportement si l'acheteur a désactivé les messages, ou après N messages sans réponse (limite Vestiaire ?).
- Le jeton Stream : durée de vie ; il est demandé par la page à chaque ouverture du chat.
