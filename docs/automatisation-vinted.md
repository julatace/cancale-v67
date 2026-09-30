# Dossier « automatisation Vinted » — tout ce que VRM sait (30 septembre 2026)

Julien construit l'automatisation lui-même (republier, messages aux personnes
qui ont mis en favori, offres). Ce dossier rassemble **tout ce qui a été mesuré**
dans ses propres requêtes, pour qu'il n'ait rien à deviner.

- ✅ = **vu** dans ses requêtes réelles (lignes `harvest_{uid}_wreq_*` de la base, ou code
  de l'extension qui tourne déjà).
- ❓ = **jamais vu** : à mesurer avant de s'en servir.

⚠️ Aucune donnée personnelle ici (le dépôt est public). Les exemples de corps sont
réduits à leur **forme**.

---

## 1. Comment une requête part

Toutes les requêtes partent **du navigateur**, avec la session du compte, vers
`https://www.vinted.fr` (le domaine du compte). Jamais depuis un serveur : une
adresse IP de datacenter est un signal de robot.

En-têtes utilisés par l'extension (`vintedGet` / `vintedSend` dans
`vinted-sync-extension/background.js`) :

```
Authorization: Bearer <access_token>
x-anon-id:     <anon_id>
x-csrf-token:  <csrf_token>
Content-Type:  application/json          (requêtes avec corps)
Accept:        application/json, text/plain, */*
Accept-Language: fr-FR,fr;q=0.9
locale: fr-FR                             (lectures)
credentials: 'omit'                       (pour ne pas mélanger les comptes)
```

- Les jetons de chaque compte sont dans la table Supabase **`vinted_accounts`**
  (`vinted_user_id`, `access_token`, `refresh_token`, `csrf_token`, `anon_id`,
  `domain`). L'extension les met à jour à chaque visite.
- **Jeton expiré (401)** : `POST /web/api/auth/refresh`, corps `{}`, avec
  `credentials: 'include'`. **Ça ne marche que pour le compte connecté dans
  l'onglet** (ce sont les cookies du navigateur qui font le travail). Les
  nouveaux jetons se relisent dans les cookies `access_token_web` et
  `refresh_token_web`. L'extension refuse exprès de rafraîchir les autres
  comptes : un rafraîchissement de masse a déjà fait bloquer un compte.
- **Savoir quel compte est connecté dans l'onglet** : décoder le cookie
  `access_token_web` (JWT) → `account_id`. C'est ce que fait la fonction `garde`.

---

## 2. Les lectures ✅

| but | requête |
|---|---|
| compte connecté | `GET /api/v2/users/current` |
| annonces du dressing | `GET /api/v2/wardrobe/{user_id}/items?page=1&per_page=100` |
| détail d'une annonce (description, **toutes** les photos) | `GET /api/v2/items/{item_id}` |
| ventes / achats | `GET /api/v2/my_orders?type=sold` · `type=purchased`, `&page=&per_page=40` |
| boîte de réception | `GET /api/v2/inbox?page=1&per_page=30` |
| une conversation | `GET /api/v2/conversations/{conversation_id}` |
| une transaction | `GET /api/v2/transactions/{transaction_id}` |
| relevé (virements) | `GET /api/v2/users/{user_id}/payouts?year=&month=` |
| notifications (dont « X a mis ton article en favori ») | ❓ `GET /api/v2/notifications` (ou `user_notifications`) — **l'extension 5.117+ la capte passivement dès qu'il ouvre la cloche sur vinted.fr**, dans `harvest_{uid}_notifications`. Aucune n'a encore été vue : la forme exacte (pseudo, id de l'utilisateur, id de l'annonce, pagination) reste à relever. |

⚠️ Pièges de forme déjà payés :
- un prix Vinted est un **objet** `{amount: "42.5", currency_code: "EUR"}`, pas un nombre ;
- dans la base, tout vit sous `data.payload` (`payload.items`, `payload.my_orders`, `payload.conversation`) ;
- la liste du dressing ne donne que la **photo de couverture** + le nombre de photos ; le jeu complet n'est que dans `GET /api/v2/items/{id}`.

---

## 3. Les écritures ✅ (corps relevés sur ses vraies requêtes)

### Messages
| action | requête | corps |
|---|---|---|
| répondre dans une conversation | `POST /api/v2/conversations/{conversation_id}/replies` | `{"reply":{"body":"texte","photo_temp_uuids":null,"is_personal_data_sharing_check_skipped":false}}` |
| **ouvrir une conversation avec quelqu'un sur un article** | `POST /api/v2/conversations` | `{"initiator":"seller_enters_notification","item_id":"<id annonce>","opposite_user_id":"<id de la personne>"}` |
| marquer comme lu | `PUT /api/v2/conversations/{id}/mark_as_read` | vide |
| supprimer un de ses messages | `DELETE /api/v2/conversations/{id}/replies/{reply_id}` | vide |

➡️ `initiator: "seller_enters_notification"` est **exactement** le geste « le
vendeur ouvre une conversation depuis une notification » — c'est le point
d'entrée d'un message à une personne qui a mis l'article en favori. La réponse
contient l'id de la conversation créée ; on y envoie ensuite le message avec
`/replies`.

⚠️ Correction faite le 30 septembre : l'extension (5.77 → 5.118) envoyait
`{"reply":"texte"}` pour les réponses automatiques. La vraie forme est l'objet
ci-dessus. Corrigé en **5.119.0**.

### Offres
| action | requête | corps |
|---|---|---|
| **le vendeur propose un prix** (dans une conversation liée à une transaction) | `POST /api/v2/transactions/{transaction_id}/offers` | `{"offer":{"price":"90","currency":"EUR"}}` |
| accepter une offre reçue | `PUT /api/v2/transactions/{tx}/offer_requests/{offer_id}/accept` | vide |
| refuser une offre reçue | `PUT /api/v2/transactions/{tx}/offer_requests/{offer_id}/reject` | vide |
| (acheteur) demander un prix | `POST /api/v2/transactions/{tx}/offer_requests` | `{"offer_request":{"price":"72","currency":"EUR"}}` |
| options de prix avant l'offre | `POST /api/v2/offers/request_options` | `{"price":{"amount":"74","currency_code":"EUR"},"item_ids":[…],"seller_id":…}` |
| estimation avec frais | `POST /api/v2/offer…estimate_with_fees` (chemin exact ❓ : la clé relevée est `api_v2_offer_estimate_with_fees`) | `{"item_ids":["…"],"offer_price":{"amount":"35","currency_code":"EUR"},"fees":["buyer_protection"]}` |

➡️ Pour une offre à un favori : la conversation créée par
`POST /api/v2/conversations` porte une `transaction` (lire
`GET /api/v2/conversations/{id}` → `conversation.transaction.id`) ; c'est cet id
qui sert à `…/transactions/{id}/offers`. ❓ Pas encore vu de bout en bout.

### Annonces (créer, modifier, supprimer = « republier »)
| action | requête | corps (forme) |
|---|---|---|
| envoyer une photo | `POST /api/v2/photos` | `FormData` (fichier image) → rend un id de photo |
| suggérer la catégorie | `POST /api/v2/item_upload/suggestions/categories` | `{"image_metadata":[{"image_id":"…","orientation":"0"}],"upload_session_id":"<uuid>"}` |
| attributs d'une catégorie | `POST /api/v2/item_upload/attributes` | `{"attributes":[{"code":"category","value":[2686]}]}` |
| **créer l'annonce** | `POST /api/v2/item_upload/items` | voir ci-dessous |
| **modifier l'annonce** (dont le prix) | `PUT /api/v2/item_upload/items/{item_id}` | le même objet complet, avec `"id": item_id` |
| **supprimer l'annonce** | `POST /api/v2/items/{item_id}/delete` | vide |
| brouillon | `POST /api/v2/item_upload/drafts` puis `POST /api/v2/item_upload/drafts/{id}/completion` | `{"draft":{…même forme…}}` |

Corps de création (relevé, valeurs d'exemple) :
```json
{
  "item": {
    "id": null,
    "currency": "EUR",
    "temp_uuid": "<uuid>",
    "title": "nike air max 1 blanc et noir taille 44,5",
    "description": "…",
    "brand_id": 53, "brand": "Nike",
    "catalog_id": 1242,
    "isbn": null, "is_unisex": false, "ai_photo": false,
    "price": 55,
    "package_size_id": 1,
    "shipment_prices": { "domestic": null, "international": null },
    "color_ids": [1, 3],
    "assigned_photos": [ { "id": 34059237746, "orientation": 0 } ],
    "measurement_length": null, "measurement_width": null,
    "item_attributes": [
      { "code": "size", "ids": [789] },
      { "code": "condition", "ids": [2] },
      { "code": "material", "ids": [] }
    ],
    "manufacturer": null, "manufacturer_labelling": null
  },
  "push_up": false,
  "parcel": null,
  "upload_session_id": "<le même uuid que temp_uuid>"
}
```
Notes :
- `assigned_photos` prend les **ids renvoyés par `POST /api/v2/photos`** (on ne
  peut pas réutiliser les URL des anciennes photos directement : il faut
  renvoyer les fichiers).
- `condition` : `2` = « Très bon état » (vu). Les autres codes ❓.
- `size`, `catalog_id`, `brand_id`, `color_ids` : des **codes** Vinted ; les
  reprendre de l'annonce d'origine (`GET /api/v2/items/{id}` les donne).
- `push_up: false` = pas de mise en avant payante.

### Republier proprement (ordre retenu, jamais l'inverse)
1. Lire l'annonce d'origine en entier (`GET /api/v2/items/{id}` — titre,
   description, prix, codes, photos). Le « coffre » de VRM en garde une copie :
   `vinted_item_details` et `harvest_{uid}_item_{id}`.
2. Télécharger ses photos et les renvoyer (`POST /api/v2/photos`).
3. **Créer** la nouvelle (`POST /api/v2/item_upload/items`) et vérifier qu'elle
   est en ligne.
4. **Seulement ensuite**, supprimer l'ancienne (`POST /api/v2/items/{id}/delete`),
   ciblée par son **id** (jamais par son titre).
5. Relire l'ancienne pour vérifier qu'elle a disparu.

En cas d'échec entre 3 et 4 : deux annonces en ligne, rien de perdu. L'inverse
(supprimer d'abord) peut faire perdre l'annonce.

⚠️ **Le N° de rangement** : les numéros vivent dans `vinted_annonce_numeros`
(ligne `main`), **rangés par id d'annonce**. Une annonce republiée a un **nouvel
id** → il faut reporter le N° sur le nouvel id, sinon la paire perd son numéro
(et le numéro ne doit jamais être redonné à une autre paire). L'extension note
déjà ce qu'elle republie dans `panel_repub_pending` (`{ancien_id: {numero, title, t}}`).

### Autres
| action | requête | corps |
|---|---|---|
| mettre/retirer un favori | `POST /api/v2/user_favourites/toggle` | `{"type":"item","user_favourites":[<item_id>]}` |
| générer le bordereau | `PUT /api/v2/transactions/{tx}/shipment/order` | `{"seller_address_id":…,"drop_off_type":null,"label_type":null}` |
| URL du PDF du bordereau | `GET /api/v2/shipments/{id}/label_url` (puis `/shipments/{id}`, `/label_options`) | — |

---

## 4. Où sont les données dans Supabase (table `app_data`, colonne `data`)

| ligne | contenu |
|---|---|
| `harvest_{uid}_listings` | annonces du dressing (`payload.items`) |
| `harvest_{uid}_orders_sold` / `_orders_purchased` | ventes / achats (`payload.my_orders`) |
| `harvest_{uid}_inbox` | boîte de réception |
| `harvest_{uid}_conv_{id}` | une conversation (`payload.conversation` : `opposite_user {id, login}`, `transaction {id, item_id}`, `messages`, `allow_reply`) |
| `harvest_{uid}_txn_{tx}` | une transaction (`status_title` non vide = vraie commande) |
| `harvest_{uid}_notifications` | ❓ notifications (dès qu'il ouvre la cloche) |
| `harvest_{uid}_wreq_*` | la dernière requête d'écriture vue, par type d'action (méthode, chemin, corps) |
| `harvest_{uid}_seen_urls` | tous les chemins d'API vus + leur dernier code de réponse |
| `vinted_item_details` | le détail des annonces (description, photos) |
| `main` → `vinted_annonce_numeros` | N° de rangement, prix plancher (`minPrice`), plateformes cochées, par id d'annonce |
| `panel_msg_repondus` | ce que l'extension a déjà répondu (pour ne jamais répondre deux fois) |
| `panel_repub_pending` | annonces en cours de republication |

Les favoris par annonce : `favourite_count` dans les annonces (un **nombre**).
Les emails « X a ajouté ton article à ses favoris » arrivent aussi par
`api/email-inbound` (33 depuis le 22 septembre, 9 avec le pseudo) — le serveur
les reconnaît mais ne les range pas encore.

Les personnes qui ont **déjà écrit** sur une annonce sans acheter sont nommées
par identité dans les conversations (`opposite_user` + `transaction.item_id`) :
mesuré le 17 septembre, 57 personnes sur 26 paires encore en ligne.

---

## 5. Ce qui fait bloquer un compte (à garder en tête)

Le compte `vanessa5723` a été bloqué. Ce que l'extension s'impose, et pourquoi :
- **agir seulement au nom du compte connecté dans l'onglet** — utiliser les
  jetons d'un autre compte depuis le même navigateur relie les comptes entre eux ;
- **une requête à la fois**, en attendant la réponse ;
- **plafond** : 20 actions par heure et par compte, 3 par visite ;
- **jamais deux fois la même personne** (repérer par l'id de la personne et
  l'id de l'annonce, pas par le texte) ;
- un 401/403 → on s'arrête, on n'insiste pas.

VRM ne fournit pas de mécanisme pour « paraître humain » (délais aléatoires,
etc.) : c'est ce qui sert à contourner la détection de Vinted, et c'est ce qui
a coûté `vanessa5723`.

---

## 6. Ce qui reste à mesurer ❓
- la forme des **notifications** (ouvrir la cloche sur vinted.fr avec l'extension ≥ 5.117) ;
- une **offre du vendeur à un favori** de bout en bout (création de conversation → transaction → offre) ;
- la liste complète des codes `condition` ;
- la réponse de `POST /api/v2/conversations` (où se trouve l'id créé).

---

## 7. Comment fonctionne VRM (le chemin d'une donnée)

```
vinted.fr (ton onglet Chrome)
  └─ inject.js      écoute les réponses que Vinted envoie à la page (lecture seule)
  └─ content.js     relaie ces réponses à l'extension
       └─ background.js (service worker)
            · range chaque réponse dans Supabase (table app_data, lignes harvest_{uid}_…)
            · lit aussi Vinted directement, avec les jetons du compte connecté
              (annonces, ventes, achats, conversations, bordereaux)
            · agit quand c'est autorisé : bordereau, réponses auto, offres auto
              au-dessus du plancher — toujours via `garde` (compte de l'onglet,
              20 actions/heure, une requête à la fois)
emails Vinted / transporteurs
  └─ Cloudflare Email Worker → api/email-inbound.js (Vercel) → app_data (email_*)
vrm.center (l'app, src/App.jsx)
  └─ lit app_data + vinted_accounts et affiche ; écrit ses réglages dans la ligne `main`
api/push · api/ship-reminders (cron)  →  notifications téléphone
api/widget                            →  widget iPhone
```

Trois choses à retenir si tu branches ton automatisation dessus :
1. **Les jetons de tous tes comptes sont déjà dans `vinted_accounts`**, tenus à jour par l'extension.
2. **Les données sont déjà captées** : pas besoin de relire Vinted pour savoir ce qui est en ligne, vendu ou en conversation — lis `app_data`.
3. **L'extension n'écrit jamais la ligne `main`** (c'est l'app qui en est propriétaire) ; elle écrit ses propres lignes `panel_*`. Fais pareil : une ligne à toi (par ex. `auto_*`), en lire-fusionner-réécrire, et **n'écris rien si la lecture a échoué** (sinon tu effaces la ligne).

---

## 8. Tout ce que fait Vintex (observé le 30 septembre, compte angeled92)

Observation faite avec Claude in Chrome, en lecture seule. **Aucune capture
réseau n'a abouti** : les chemins d'API de Vintex restent inconnus. Ce qui suit
vient de l'écran et de leur documentation.

### 8.1 L'architecture
- Une extension Chrome (« pont » v2.7.0) injecte dans vinted.fr un panneau
  `div#vintex-proxy-panel` (contenu dans un shadow DOM fermé, illisible pour la page).
- **L'onglet Vinted sert de relais** : tout se pilote depuis le site
  `vintex.app/dashboard` (« Vintex Neo »), et les actions s'exécutent dans ton
  onglet Vinted, avec ta session. C'est le même principe que VRM (tout part du
  navigateur), mais piloté depuis leur serveur.
- Le panneau affiche : compte Vintex connecté, compte Vinted lié, relais
  « Chrome – macOS connecté », nombre d'automatisations actives et « dernier
  cycle : il y a 3 min » (il tourne en boucle), bouton « Ouvrir en fenêtre ».
- Un compte sans onglet Vinted ouvert affiche « Ouvrez un onglet de la
  plateforme pour utiliser ce compte » → **Vintex ne peut agir que sur un compte
  dont l'onglet est ouvert**, comme VRM.
- Il garde les données en cache 10 minutes.

### 8.2 Le menu du tableau de bord
Accueil · Journal · Sauvegardes cloud · Articles · Commandes · Comptabilité ·
Messagerie · **Notifications** · Abonnements · **Automatisations** · Nouveautés ·
Paramètres.

### 8.3 Notifications → « qui a mis en favori »
- Table filtrable : texte libre, type **Favoris**, période (7 jours par défaut),
  statut Traitée / Non traitée. Colonnes : Notification, Compte, Statut.
- Chaque ligne : « **[pseudo] a marqué ton article [titre] comme favori** ».
- Action groupée unique : **« Répondre aux notifications »** (sur les lignes cochées).
- Leur documentation prévient « certains favoris manquent » si la période est
  trop longue → ils lisent **le flux paginé des notifications Vinted**, pas une
  liste de favoris par annonce. (Confirmé par toi : ça vient de l'app Vinted.)
- ➡️ Pour VRM : l'extension ≥ 5.117 capte ce même flux (`harvest_{uid}_notifications`)
  dès que tu ouvres la cloche sur vinted.fr. Il reste à voir sa forme.

### 8.4 Automatisation « Messages aux favoris »
- Écrit automatiquement aux personnes qui mettent un article en favori.
- **Règles** : un texte, et/ou une **offre de prix** jointe ; condition « seulement
  si la personne a mis au moins 2 articles en favori » ; jours de la semaine ;
  créneau horaire. Si plusieurs règles collent, une est tirée au hasard.
- **Ciblage** : période de recherche (aujourd'hui → 7 jours) ; délai avant de
  traiter un favori : 15 min ; délai avant de réécrire à la même personne : 1 jour ;
  plafond par article : illimité ; note minimale de l'acheteur : aucune.
- **Anti-doublon** : relit la liste des conversations pour ne pas écrire deux fois.
- **Quotas** : 10 messages/jour (gratuit), 60 (Starter), illimité (Advanced, Pro).
- En manuel : même moteur, sur les lignes cochées, avec quelques secondes entre
  chaque message.

➡️ La chaîne équivalente avec ce qui est mesuré chez toi :
notification (pseudo + id personne + id annonce) → `POST /api/v2/conversations`
`{initiator:"seller_enters_notification", item_id, opposite_user_id}` →
`POST /api/v2/conversations/{id}/replies` (texte) et/ou
`POST /api/v2/transactions/{tx}/offers` (offre).

### 8.5 Autres automatisations
- **Conversations auto** (désactivée sur ton compte, non détaillée).
- **Boost favoris** : échange de favoris entre membres — ton compte met des
  favoris sur les annonces d'autres membres, et en reçoit en retour sur les
  tiennes (2 à 32 par article selon le forfait) ; coupe tes notifications de
  favoris pendant qu'il tourne. C'est du gonflage artificiel, a priori contraire
  aux règles de Vinted : à ne pas reproduire.

### 8.6 Articles et republication
- Actions : Republier · Publier les brouillons · Modifier · Masquer · Afficher ·
  Dupliquer · Sauvegarder dans le cloud · Supprimer.
- **Republication Vintex** : crée un brouillon, **supprime l'annonce d'origine**
  (favoris, vues, ancienneté perdus), puis publie le brouillon après le délai
  réglé ; pauses irrégulières entre chaque écriture ; déroulé dans le Journal.
- Dialogue « Republication » : avertissement « chaque annonce sera supprimée puis
  recréée » ; retouche des photos (incliner, recadrer 1:1 · 4:5 · 3:4 · 16:9,
  zoom, retourner) ; texte ajouté avant/après le titre ; prix augmenté / diminué
  / fixé, en % ou en €, avec arrondi ; sauvegarde cloud ; publier
  automatiquement ou laisser en brouillon ; délai avant publication.
- ➡️ Différence avec l'ordre conseillé au §3 : Vintex supprime **avant** de
  publier ; créer d'abord puis supprimer ne perd jamais l'annonce.
  Et retoucher les photos ne protège de rien : Vinted relie les comptes par
  appareil, navigateur, adresse et moyen de paiement, pas par les images.

### 8.7 Forfaits Vintex (page publique)
| forfait | prix HT/mois | republications | messages aux favoris | favoris boostés/article |
|---|---|---|---|---|
| Gratuit | 0 € | 50 | 10/jour | 2 |
| Starter | 5,99 € | 1 000 | 60/jour | 8 |
| Advanced | 11,99 € | 3 000 | illimités | 16 |
| Professional | 19,99 € | illimitées | illimités | 32 |

### 8.8 Ce qu'on ne sait pas de Vintex
- Les chemins d'API exacts qu'il appelle (la capture réseau n'a rien relevé).
- Le contenu de son code.
- Si tu veux les relever : DevTools de la page vinted.fr → onglet Network →
  cocher « Preserve log » → lancer UNE action depuis vintex.app → clic droit →
  « Save all as HAR ». (Mets « Messages aux favoris » en pause avant, sinon ses
  envois se mélangent à ta capture.)
