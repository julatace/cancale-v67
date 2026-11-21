# L'infrastructure d'un agent eBay qui tourne seul, app fermée

**Pour :** Julien, et les sessions qui construiront l'« agent eBay autonome ».
**Rédigé le :** 11 octobre 2026.
**Complète :** `suivi.md` (à côté : suivre le colis, parler au client) et
l'étude des bordereaux achetés par VRM (en cours à côté). Ici, uniquement ce qui
fait **tourner** l'agent : être prévenu, se réveiller, se souvenir, ne jamais
agir deux fois, ne jamais mélanger deux vendeurs, et tenir dans les quotas.

**D'où vient chaque fait (à lire avant le reste).**
- **[mesuré]** : lu moi-même, aujourd'hui, sur ta base Supabase (requêtes
  `SELECT` projetées, aucun jeton lu, aucune donnée d'acheteur), sur ton projet
  Vercel (noms des variables seulement, jamais leurs valeurs), ou dans le code
  de la branche `worktree-wf_30feaf2f-334-8`.
- **[doc lue]** : page officielle lue en entier. Les documentations de
  **Supabase** (par l'outil de recherche officiel de Supabase) et des morceaux de
  celle de **Vercel** (par l'outil de recherche officiel de Vercel) ont pu être
  lus. Le **code officiel d'eBay** pour recevoir ses notifications
  (`github.com/eBay/event-notification-nodejs-sdk`) a été lu en entier.
- **[extrait]** : `developer.ebay.com`, `edp.ebay.com`, `vercel.com/docs` sont
  **bloqués** depuis ce conteneur (`ENOTFOUND` / 403, vérifié aujourd'hui). Ces
  faits viennent d'**extraits de moteur de recherche** qui citent la page.
- **[secondaire]** : forum, blog, bibliothèque open source.
- **[à vérifier]** : non établi. **Rien de ce qui porte cette marque ne doit
  devenir une promesse à l'écran.**

**Aucun appel** n'a été fait à eBay, à un transporteur ou à Vinted. **Aucune
écriture** nulle part.

---

## 0. En une page

Un agent qui « ne dépend de personne » a besoin de **trois organes**, et VRM
n'en a aujourd'hui aucun en état de marche :

| organe | rôle | aujourd'hui | ce que je recommande |
|---|---|---|---|
| **l'oreille** | eBay prévient VRM d'une vente, d'un envoi, d'une révocation | rien (le `POST` de suppression de compte répond « ok » sans rien faire) | l'**API Notification REST** d'eBay : `ORDER_CONFIRMATION` (vente payée), `AUTHORIZATION_REVOCATION`, `ITEM_MARKED_SHIPPED`, signées par eBay |
| **le cœur** | se réveiller toutes les minutes, app fermée | un seul passage par jour (cron Vercel 08:00 UTC, plan Hobby) | **`pg_cron` + `pg_net` dans Supabase** — disponibles sur ta base, pas encore activés **[mesuré]** |
| **la mémoire** | savoir où en est chaque commande, ne jamais agir deux fois | rien | une **machine à états par commande** en base, un **verrou par commande**, un **journal** relisible |

**Les cinq choses qui comptent le plus :**

1. **L'horloge vit dans ta base, pas chez Vercel.** Ton organisation Supabase est
   en **plan Pro** **[mesuré]** : `pg_cron` et `pg_net` y sont inclus, sans
   surcoût. Une ligne SQL réveille l'agent chaque minute — et seulement s'il a
   quelque chose à faire. Aucun cron Vercel ajouté (un cron refusé bloque TOUS
   les déploiements, dossier §6).
2. **L'oreille d'eBay existe en deux versions, et la vieille est bloquée.** Les
   « Platform Notifications » (Trading) avec un jeton OAuth exigent que eBay
   mette VRM **sur liste blanche** **[extrait de la page officielle « OAuth avec
   les API traditionnelles »]**. La nouvelle API Notification REST, elle, ne le
   demande pas, et son évènement `ORDER_CONFIRMATION` (« l'acheteur a payé ») ne
   demande que le droit `sell.fulfillment`, **que VRM a déjà**. Il faudra
   quand même te **reconnecter une fois** à eBay pour le droit d'abonnement
   **[à vérifier]**.
3. **Le vrai mur, ce sont les quotas d'eBay partagés par TOUS les vendeurs.**
   Trading : **5 000 appels par jour pour toute l'application**. Renouvellement
   de jeton : **50 000 par jour**. Aujourd'hui VRM redemande un jeton à **chaque
   action** **[mesuré dans le code]** : sans danger pour toi seul, intenable à
   1 000 vendeurs. Il faut **garder le jeton d'accès 1 h 50** (chiffré) et un
   **compteur de quota global** en base, avec des priorités.
4. **Les clés de transporteur se chiffrent par le serveur**, avec une clé posée
   sur Vercel, jamais dans la base. Et j'ai trouvé un trou du même genre déjà
   ouvert : **ton jeton eBay est en clair dans la base, lisible par ton propre
   navigateur, et recopié dans les deux sauvegardes du 30 septembre et du
   2 octobre** **[mesuré]**. À ranger au même endroit que les clés transporteur.
5. ⚠️ **Initiative, à toi de trancher : Vercel Hobby interdit l'usage
   commercial.** L'API de Vercel confirme que ton équipe est en **Hobby**
   **[mesuré]**, et Vercel écrit que Hobby est « réservé à un usage personnel
   non commercial » ; encaisser des visiteurs est cité comme usage commercial
   **[extrait des « Fair use guidelines »]**. VRM va facturer 12,99 €/mois : il
   faut passer en **Pro** (20 $ par mois et par développeur **[extrait,
   secondaire]**) **avant** d'ouvrir aux abonnés payants. Pro lève aussi les
   freins de cette étude (cron chaque minute, 800 s par fonction). L'architecture
   ci-dessous marche **sur les deux** : rien n'est perdu à attendre.

**Ce que l'agent fera sans toi, une fois allumé :** voir une vente eBay dans la
minute, retrouver la paire par son SKU `VRM-{n°}`, te sonner « Vendu sur eBay —
N°214, carton B12 », retirer la paire des autres plateformes où VRM a le droit
d'agir (eBay), et, **si tu l'as allumé**, acheter le bordereau (plafonné), le
déclarer à eBay, suivre le colis jusqu'au client, et tout écrire dans un journal
que tu relis. **Vinted : rien ne change** (§3 du dossier).

**Tes gestes uniques** sont listés à la fin (section 7) : deux variables
Vercel, deux extensions à activer, une demande gratuite à eBay, une
reconnexion eBay, et la décision Vercel Pro.

---

## 1. Ce que j'ai mesuré aujourd'hui

### 1.1 Supabase

| | valeur |
|---|---|
| plan de l'organisation | **Pro** (`tier_pro`) |
| Postgres | 17.6, région `eu-west-1` (Irlande) |
| `max_connections` | 60 (calcul « Micro ») |
| extensions **installées** | `pgcrypto` 1.3, `supabase_vault` 0.3.1, `pg_stat_statements`, `uuid-ossp` |
| extensions **disponibles, pas installées** | **`pg_cron` 1.6.4**, **`pg_net` 0.20.0**, `pgmq` 1.5.1 (files d'attente), `pgsodium` 3.1.8, `http`, `wrappers` |
| secrets dans le coffre (Vault) | **0** |
| Edge Functions | **0** |
| `app_data` | 82 Mo, 6 322 lignes, 3 propriétaires, 4 comptes de connexion |
| qui peut lire les secrets **déchiffrés** du coffre (`vault.decrypted_secrets`) | `postgres`, `service_role`, `supabase_admin` — **pas** `anon` ni `authenticated` |

- **Les règles d'accès d'`app_data`** : `chacun ses lignes` (tout, `owner =
  auth.uid()`), `tout_select/insert/update` (mêmes conditions, doublons connus
  du dossier), et `abonnement_requis` (restrictive, `vrm_acces_ok()`). Une table
  « serveur seulement » existe déjà comme modèle : **`vrm_reglages`**, règles
  d'accès activées et **aucune** règle ⇒ personne d'autre que le serveur.
- **Deux fonctions « serveur seulement » existent déjà comme modèle** :
  `vrm_acces_pour` et `vrm_detourage_reserver`, `SECURITY DEFINER`, exécutables
  par `postgres` et `service_role` seulement. La seconde **réserve une unité
  d'un plafond en une seule instruction** (insertion, puis `update … where n <
  plafond returning`). C'est **exactement** le motif des plafonds de l'agent.
- **Deux déclencheurs sur `app_data`** : `vrm_meta_maj` (copie les scalaires dans
  `meta`) et `vrm_noter_ecriture`, qui note **chaque écriture** dans
  `sauvegarde.journal_ecritures` : 36 627 écritures depuis le 30 septembre
  (`authenticated` 24 996, `postgres` 9 944, `service_role` 1 165, `anon` 522),
  **sans aucune donnée** (rôle, vendeur, table, identifiant, opération). Le rôle
  y est lu par `coalesce(auth.role(), current_user)` : la garde d'écriture de la
  section 4.5 réutilise exactement cette lecture.
- **Les lignes eBay** : `ebay_tokens` (une ligne : les clés `saved_at`,
  `refresh_expires_days`, et le jeton, que je n'ai pas lu), `ebay_listings`,
  `ebay_orders` (**0 commande**, relue le **10 octobre à 20 h 29 UTC**),
  `ebay_programmees` (écrite le 10 octobre à 17 h 43), `ebay_inventory`. **Pas de
  `ebay_comptes`** : la branche « plusieurs comptes eBay » n'est pas en
  production.
- ⚠️ **Le jeton eBay est en clair, lisible par le navigateur du vendeur, et dans
  les sauvegardes.** La règle `chacun ses lignes` laisse le vendeur lire **ses**
  lignes `ebay_tokens*` avec sa session : un script injecté dans l'app (une
  faille d'affichage) pourrait l'emporter. Et la ligne, jeton compris, est
  recopiée dans `sauvegarde.app_data_20260930` et `…_20261002` (55 et 56 Mo).
  Ces copies ne sont lisibles que par `postgres` **[mesuré : ni `anon`, ni
  `authenticated`, ni `service_role` n'y ont accès]**, mais `postgres`, c'est
  aussi l'éditeur SQL du tableau de bord et l'outil Supabase des sessions
  Claude. **Un vendeur ne peut pas lire le jeton d'un autre** : la fuite est
  « chacun le sien », pas croisée.

### 1.2 Vercel

| | valeur |
|---|---|
| plan de l'équipe | **Hobby** (l'API de journaux répond « The hobby plan does not retain runtime logs… ») |
| journaux d'exécution gardés | **1 heure** ⇒ le journal de l'agent doit vivre dans **notre** base |
| région des fonctions | `dub1` (Dublin) — à côté de Supabase `eu-west-1` |
| fonctions | **12** sur 12 (`ai, compte, ebay, email-inbound, email-rattacher, push, relais, ship-reminders, vinted-connect, vinted-proxy, vinted-refresh, widget`) |
| crons | 1 (`/api/ship-reminders`, `0 8 * * *`) |
| variables eBay présentes (noms seuls) | `EBAY_APP_ID`, `EBAY_CERT_ID`, **`EBAY_DEV_ID`** (la feuille du 9 octobre la disait « non vérifiée » : elle **est** posée), `EBAY_RUNAME`, `EBAY_VERIF_TOKEN`, `EBAY_DELETION_URL` |
| autres variables utiles ici | `CRON_SECRET`, `SUPABASE_SERVICE_KEY`, `VRM_OWNER_UID`, `VAPID_PRIVATE_KEY` |

### 1.3 Le code (branche `worktree-wf_30feaf2f-334-8`)

- `api/ebay.js` route par `?mode=` (`callback`, `deletion`, sinon les actions de
  l'app). **Aucun** `export const config` : le corps de la requête arrive déjà
  décodé, le **corps brut** (indispensable pour vérifier une signature) n'est pas
  lisible. `api/compte.js`, lui, a déjà `bodyParser: false` et `corpsBrut()`
  (pour le webhook Stripe).
- `handleDeletion` : le `GET` (défi SHA-256) est juste ; le **`POST` répond
  200 sans rien faire**.
- `accessToken(owner, suffixe)` (`api/_lib/ebay.js`) **échange le jeton de
  renouvellement à chaque appel**, sans rien garder. Chaque action de l'app =
  un renouvellement.
- `api/ship-reminders.js` sait déjà tourner **par vendeur** (`contexteVendeur`,
  8 à la fois, un vendeur qui plante n'arrête pas les autres) et exige
  `CRON_SECRET`.
- `package.json` n'a pas `@vercel/functions` (donc pas `waitUntil`).

---

## 2. L'oreille : être prévenu par eBay

### 2.1 Deux systèmes de notification chez eBay

| | **API Notification (REST)** | **Platform Notifications (Trading, SOAP)** |
|---|---|---|
| format | JSON, `POST` vers notre adresse | XML SOAP, `POST` vers notre adresse |
| preuve d'origine | en-tête **`X-EBAY-SIGNATURE`** : du base64 d'un JSON `{kid, signature, …}` ; la clé publique se lit par `GET /commerce/notification/v1/public_key/{kid}` avec un **jeton d'application** ; signature ECC **[code officiel eBay lu]** | `NotificationSignature` = base64(MD5(`Timestamp` + DevID + AppID + CertID)) **[extraits des articles 1201 et 780 de la base de connaissances eBay]** |
| ce que prouve la signature | **le contenu** de la notification | seulement que l'expéditeur connaît nos trois identifiants et l'heure. **Le contenu n'est pas couvert** : une notification captée peut être rejouée avec un autre corps tant que l'heure passe. ⇒ **sonnette seulement**, jamais une donnée |
| jeton OAuth | oui | **oui, mais VRM doit être mis sur liste blanche par eBay** **[extrait de la page officielle « Using OAuth with the eBay traditional APIs »]** ; sinon les notifications sont rejetées **[secondaire, forum]**. Le jeton « Auth'n'Auth » n'en a pas besoin, mais c'est un second consentement et un second secret par vendeur |
| évènements utiles | `ORDER_CONFIRMATION` (« l'acheteur a fini de payer », ajouté le 1ᵉʳ décembre 2025, droit **`sell.fulfillment`**), `ITEM_MARKED_SHIPPED` (12 décembre 2025), `AUTHORIZATION_REVOCATION` (un vendeur retire son accord à VRM), `MARKETPLACE_ACCOUNT_DELETION` (déjà traité en `GET`), « Buyer Question » et « New Message » (1.6.5, noms exacts **[à vérifier]**) **[extraits des notes de version et de la page « Notification Topics »]** | `FixedPriceTransaction`, `ItemSold`, `AskSellerQuestion`, `BestOffer`, `ReturnCreated`, `ItemMarkedShipped`, évaluations, annulation demandée — noms exacts **[à vérifier]** dans `NotificationEventTypeCodeType` ; `ItemMarkedPaid` retiré le 22 juin 2026 (`possible.md`) |
| répondre | `200`, `201`, `202` ou `204`, sinon échec ; **3 nouvelles tentatives** **[extraits : blog technique d'eBay et page « Notification Topics »]** | `200` ; une réponse en plus de **3 000 ms** compte comme échec **[extrait d'un article de 2011, à vérifier]** ; eBay **ne renvoie pas** une notification ratée **[extrait]** |
| trop d'échecs | adresse « marquée en panne », un email part à l'adresse d'alerte de l'application **[extrait]** | application marquée en panne (1 000 échecs à la suite d'après un extrait), il faut écrire au support **[extrait]** |
| quota | API Notification : **10 000 appels par jour** (lecture de la clé publique, abonnements) ; **les notifications reçues ne comptent pas** **[extrait de la page officielle des quotas]** | idem |

**Le code officiel d'eBay** (`event-notification-nodejs-sdk`, lu en entier) :
- décode l'en-tête, va chercher la clé publique par son `kid` (cache LRU),
  vérifie avec `crypto.createVerify('ssl3-sha1')` ;
- ⚠️ vérifie la signature sur **`JSON.stringify(message)`**, c'est-à-dire le JSON
  **re-sérialisé**, pas le corps brut. La spécification `socle` du 9 octobre
  disait « sur le corps brut, octet pour octet ». **Les deux coïncident si eBay
  envoie un JSON compact** **[à vérifier sur la première vraie notification]**.
  ⇒ Vérifier d'abord le corps brut, et en repli `JSON.stringify(JSON.parse(brut))`.
  Ne jamais relâcher la vérification si les deux échouent : 412, rien n'est fait.
- répond **204** si la signature est bonne, **412** si elle est fausse, **500**
  sur une panne (eBay réessaie).
- le défi de l'adresse : SHA-256(`challenge_code` + jeton de vérification +
  adresse), en hexadécimal — **c'est déjà ce que fait `handleDeletion`**.

### 2.2 Ce que je recommande

**Étape 1 — l'API Notification REST, tout de suite après la reconnexion.**
C'est elle qui porte l'évènement qui compte le plus (une vente payée), avec une
vraie signature, sans liste blanche.

- **Une adresse de destination** pour toute l'installation :
  `https://vrm.center/api/ebay-notif` → réécrite vers un **mode** d'une fonction
  existante (`vercel.json`), jamais une 13ᵉ fonction. `createDestination` se fait
  avec un **jeton d'application** et un jeton de vérification de 32 à 80
  caractères **[extrait de la page `createDestination`]**. On peut réutiliser
  `EBAY_VERIF_TOKEN` (déjà posé) : le défi inclut l'adresse, donc deux adresses
  ne se confondent pas.
- **Un abonnement par compte eBay et par sujet**, créé avec **le jeton de ce
  compte**. D'après un forum, un abonnement « utilisateur » demande le droit
  `commerce.notification.subscription` **[secondaire, à vérifier]** : VRM ne le
  demande pas aujourd'hui. Il faudra l'ajouter au **jeu de droits `v2`** que la
  feuille de route prévoit déjà (litiges, statistiques) : **une seule
  reconnexion** pour tout.
- **Savoir à quel vendeur appartient une notification.** Deux voies :
  1. si la notification nomme le compte (le message de suppression de compte
     porte `username`, `userId`, `eiasToken` **[secondaire]**), on retrouve le
     compte par la clé dérivée de l'`EIASToken` — **l'identité** que VRM utilise
     déjà pour ses comptes eBay (§5) ;
  2. sinon, **une destination par compte eBay**, avec un identifiant opaque dans
     le chemin (`/api/ebay-notif/k_8f3a…`). eBay ne documente pas de plafond de
     destinations par application **[extrait : aucun trouvé, à vérifier]**.
  Dans les deux cas, **une notification n'est qu'une sonnette** : elle
  **programme une relecture** de CE compte avec SON jeton. Une notification mal
  routée ou forgée ne peut donc rien écrire de faux : au pire, une relecture de
  plus, freinée (pas plus d'une par compte toutes les 2 minutes).
- **Répondre vite, travailler après.** Le gestionnaire fait **quatre choses
  seulement** : lire le corps brut (≤ 200 Ko), vérifier la signature, ranger la
  sonnette par **un seul appel en base** (`vrm_agent_planifier`, section 4.4),
  répondre **204**. Le travail se fait au battement suivant (moins d'une minute).
  - La clé publique d'eBay est **gardée en base**, par `kid`, 24 h (une petite
    table serveur), pas seulement en mémoire : une instance froide de Vercel la
    lit en ~50 ms dans la même région au lieu de demander un jeton d'application
    puis d'appeler eBay. Objectif : **< 1 s à chaud, < 2,5 s à froid**.
  - Le jeton d'application (« client credentials », **1 000 par jour** pour
    toute l'application **[extrait de la page officielle des quotas de
    jetons]**) est lui aussi gardé (1 h 50).
  - Chaque notification porte un `notificationId` et un compteur de tentatives
    (`publishAttemptCount`) **[extrait]** : on dédoublonne sur
    `notificationId`.
- **`AUTHORIZATION_REVOCATION`** (abonnement **d'application**, jeton
  d'application) : quand un vendeur retire son accord à VRM chez eBay, son compte
  passe tout de suite à « refusé » (la spec `socle` le découvrait seulement au
  prochain renouvellement de jeton).
- **Le corps brut** : la spec `socle` prévoit déjà de passer `api/ebay.js` en
  `bodyParser: false` avec `api/_lib/corps.js` partagé (pour la suppression de
  compte). **Une seule bascule sert les deux** ; tous les bancs eBay doivent
  alors servir la requête en flux brut (§6.3 du dossier).

**Étape 2 — les Platform Notifications, plus tard, si on veut les questions, les
offres et les retours en temps réel.** Demander à eBay la liste blanche **dans la
même demande** que la hausse de quota Trading (« Application Growth Check »,
service gratuit **[extrait]**, section 7). Elles resteront des sonnettes (la
signature MD5 ne couvre pas le contenu), et l'heure (`Timestamp`, en GMT) doit
être à moins de 10 minutes de la nôtre.

**Toujours, en plus : la relecture de secours.** Aucune notification n'est
garantie (3 tentatives, puis plus rien). Chaque compte eBay a une tâche
« veille » qui relit ses commandes **par date de modification** (`getOrders`,
filtre `lastmodifieddate`, recouvrement d'1 h — spec `socle`) :
- toutes les **60 min** quand les notifications marchent (une sonnette reçue
  depuis moins de 7 jours, ou un test d'abonnement réussi) ;
- toutes les **15 min** quand elles ne sont pas actives ;
- **tout de suite** après une sonnette.

---

## 3. Le cœur : se réveiller sans cron Vercel

### 3.1 Les contraintes

- **Vercel Hobby** : un cron « une fois par jour au plus », précision **± 59 min** ;
  une expression plus fréquente **fait échouer le déploiement** **[extrait de la
  page « Cron jobs — usage and pricing »]**, et un utilisateur rapporte que
  l'échec arrive **avant même qu'un déploiement soit créé**, invisible dans le
  tableau de bord **[secondaire, forum Vercel]** — c'est exactement l'incident que
  le dossier interdit de rejouer.
- **Durée d'une fonction** : 300 s par défaut et au plus en Hobby avec « Fluid
  compute » (activé par défaut) ; 800 s en Pro **[extrait de la page « Functions
  limitations »]**. ⚠️ Que Fluid soit activé sur **ton** projet n'a pas pu être
  lu par l'API **[à vérifier dans Settings → Functions]** ; le commentaire de
  `ship-reminders.js` (« 300 s ») le suppose.
- **`waitUntil()`** (`@vercel/functions`) prolonge une fonction après la réponse,
  avec le **même** délai maximal **[doc lue]** — pas installé chez nous.

### 3.2 Les options comparées

| | **Supabase `pg_cron` + `pg_net`** | Vercel Pro (cron) | GitHub Actions planifié | service externe (cron-job.org, Upstash QStash…) | Edge Function Supabase planifiée |
|---|---|---|---|---|---|
| disponible chez toi | **oui** (plan Pro, extensions disponibles, à activer) **[mesuré]** | non (Hobby) | oui | oui | oui (0 aujourd'hui) |
| coût | **0** (inclus) | 20 $/mois/dév. **[secondaire]** — à payer de toute façon pour l'usage commercial | 0 sur dépôt public ; payant en minutes si le dépôt passe **privé** (ce que `SECURITE.md` recommande) — un battement toutes les 5 min = ~8 600 exécutions/mois, chacune comptée à la minute **[à vérifier : quota gratuit d'un dépôt privé]** | 0 à quelques € | inclus (2 M d'appels/mois en Pro **[doc lue]**) |
| fréquence | à la minute, voire à la seconde (« 30 seconds ») **[doc lue]** | à la minute | 5 min au mieux **[secondaire]** ; **retards et exécutions abandonnées** en période chargée **[doc GitHub, extrait]** | à la minute | à la minute (déclenchée… par `pg_cron`) |
| s'arrête tout seul | non | non | **oui** : un dépôt public sans activité 60 jours voit ses tâches planifiées **désactivées** **[doc GitHub, extrait]** | si le compte du service expire | non |
| le secret | dans le **coffre** (Vault), mais **lisible en clair** dans la file `net.http_request_queue` le temps de l'envoi par tout rôle qui se connecte à la base **[doc Supabase lue]** | géré par Vercel (`CRON_SECRET`) | secret du dépôt | chez un tiers de plus | idem `pg_cron` |
| dépend de | la base (si elle tombe, l'agent n'a de toute façon plus de mémoire) | Vercel | GitHub | un tiers de plus | la base + Deno |
| code | **aucun code dupliqué** : la logique reste dans Vercel | idem | idem | idem | ⚠️ la logique eBay en Deno = **une seconde copie** (§11) |

**Recommandation : `pg_cron` + `pg_net`**, tout de suite. Le jour où tu passes
Vercel en Pro, on peut ajouter un cron Vercel `* * * * *` sur la **même** route
en second battement (les verrous rendent deux battements inoffensifs), ou
garder seulement `pg_cron`. GitHub Actions est écarté : retards documentés,
désactivation automatique, et coût le jour où le dépôt devient privé. Une Edge
Function est écartée : elle obligerait à réécrire la logique eBay en Deno.

### 3.3 Le battement, concrètement

**Un battement ne part que s'il y a quelque chose à faire.** La tâche SQL regarde
d'abord la file de l'agent (section 4.4) ; si rien n'est dû, **aucun appel** à
Vercel. Une horloge à la minute sur une boutique calme ne coûte donc presque
rien.

```sql
-- (à passer par une migration, avec l'accord de Julien — esquisse)
select cron.schedule('vrm-battement', '* * * * *', $$
  select net.http_post(
    url := 'https://vrm.center/api/ship-reminders?mode=battement',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                     where name = 'vrm_battement_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000)          -- le défaut de pg_net est 2 000 ms [doc lue]
  where exists (select 1 from public.vrm_agent_file
                where prochain <= now() and coalesce(bail_jusqua, '-infinity') < now());
  update public.vrm_agent_horloge set dernier_tic = now() where id = 1;   -- le pouls de l'horloge, sans HTTP
$$);
-- pg_cron ne nettoie pas son historique [doc lue] : une purge quotidienne
select cron.schedule('vrm-purge-cron', '17 3 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '7 days' $$);
```

**La route** : un **mode** de `api/ship-reminders.js` (`?mode=battement`). Elle
a déjà la boucle par vendeur, le contexte par vendeur et la culture « un vendeur
qui plante n'arrête pas les autres ». La logique vit dans une bibliothèque
`api/_lib/agent-ebay.js` (pas une fonction Vercel).

```
?mode=battement   (POST, Authorization: Bearer <VRM_BATTEMENT_SECRET>, comparé en temps constant)
  1. interrupteur de l'installation éteint (vrm_reglages.agent_ebay ≠ '1') → 200 {arrete:true}
  2. anti-rafale : un battement de moins de 20 s → 200 {ignore:true}
  3. jeton = un identifiant aléatoire ; fin = maintenant + 25 s
  4. tant que maintenant < fin :
        tâches = vrm_agent_prendre(8, jeton, bail 120 s)      -- au plus 8, réparties entre vendeurs
        si aucune : sortir
        pour chacune, EN PARALLÈLE (8) :
          contexteVendeur.run({owner}, () => traiter(tâche, {jeton, fin}))
  5. 200 {prises, faites, reportees}  -- des NOMBRES seulement
```

- **Pourquoi 25 s et pas 300 s** : le battement suivant arrive dans une minute ;
  travailler peu à chaque fois garde chaque battement **court**, donc rien ne se
  chevauche longtemps, et un déploiement Vercel au milieu ne coupe presque
  rien. `pg_net` attend 30 s. Pas besoin de `waitUntil` (pas de nouvelle
  dépendance) ; on pourra l'ajouter le jour où le débit manque.
- **La réponse ne contient aucun montant, aucun pseudo, aucun titre** :
  `pg_net` la garde **6 heures** dans `net._http_response`, lisible par
  `postgres` **[doc lue]**.
- **Un secret à part** (`VRM_BATTEMENT_SECRET`), **pas** `CRON_SECRET` : celui
  du battement est lisible dans la file de `pg_net` par tout rôle qui se connecte
  à la base **[doc lue]**. S'il fuit, on peut seulement déclencher des
  battements : ils sont idempotents, freinés (20 s) et ne rendent rien.
- ⚠️ `net` ne doit **jamais** être ajouté aux schémas exposés de l'API (Settings
  → API) : `anon` et `authenticated` liraient alors la file, secret compris
  **[doc lue]**.

### 3.4 Ce qui se passe quand ça casse

| panne | ce qui se passe | ce que l'agent fait |
|---|---|---|
| **Vercel ne répond pas** (déploiement, 5xx, délai) | `pg_net` note l'échec dans `net._http_response` ; ⚠️ `cron.job_run_details` dit pourtant « succeeded » (l'appel SQL a réussi, pas la requête) | **rien n'est perdu** : les tâches restent dans la file, le battement suivant les reprend. Un bail expiré (2 min) libère ce qui était en cours |
| **une tâche plante au milieu** | son bail expire | reprise depuis le **dernier état écrit** ; une étape qui engage de l'argent est notée « en cours » **avant** l'appel, donc jamais refaite en aveugle (section 4.3) |
| **Supabase ne répond pas** | plus d'horloge, plus de mémoire | **rien n'agit** (« pas su n'agit jamais ») ; eBay réessaie 3 fois ses notifications, puis la veille rattrape par date de modification au retour |
| **`pg_cron` s'arrête** (processus mort) | plus de battement | le **cron Vercel du matin** (08:00) fait aussi un battement de secours et lit `vrm_agent_horloge.dernier_tic` : plus de 30 min sans tic ⇒ notification au propriétaire de l'installation (« l'horloge de l'agent est arrêtée — Settings → General → redémarrer ») et une ligne dans l'app. Doc Supabase : vérifier `pg_stat_activity` (`pg_cron scheduler`) et faire un « fast reboot » **[doc lue]** |
| **eBay refuse un jeton** (`invalid_grant`) | — | le compte passe « refusé », ses tâches s'arrêtent, une notification « reconnecte {pseudo} », une fois par 7 jours (spec `veille`) |
| **deux battements en même temps** | — | sans effet : chaque tâche n'a qu'un bail à la fois (section 4.4) |

---

## 4. La mémoire : une machine à états par commande

### 4.1 Les états

Une seule échelle, alignée sur celle de `suivi.md` (§2.4) pour la partie colis.
Le **rang** ne descend jamais ; une branche « problème » peut s'ouvrir à tout
moment ; un évènement inconnu ne change **pas** l'état (il est noté).

| rang | état | entrée (preuve) | ce que l'agent fait | garde |
|---|---|---|---|---|
| 0 | `historique` | commande déjà là à la première relecture d'un compte | **rien** (ni action, ni notification) | sinon « 30 ventes ! » d'un coup (spec `veille`) |
| 1 | `payee` | `ORDER_CONFIRMATION` ou `getOrders` : payée, pas encore expédiée | retrouve la paire par le **SKU `VRM-{n°}`** de la ligne (jamais le titre) ; te sonne « Vendu sur eBay — N°214 » ; programme le retrait des autres annonces eBay de ce N° (retrait automatique existant, s'il est allumé) | SKU absent ⇒ « pas reliée à une paire » ; aucune déduction |
| 2 | `a_expedier` | identité vérifiée, date limite (`shipByDate`) lue | rappels avant la date limite ; **si tu l'as allumé**, passe au bordereau | annulation demandée ⇒ branche `annulation_demandee`, **ne rien acheter** |
| 3 | `bordereau_en_cours` | écrit **avant** l'appel à l'agrégateur, avec la clé `vrm-{orderId}-{lineItemId}` | achète le bordereau (étude « bordereaux ») | plafonds réservés **avant** (4.6) ; abonnement en règle **vrai** (pas « pas su ») |
| 3′ | `bordereau_incertain` | coupure après l'envoi de l'achat | **relit** chez l'agrégateur par la référence (Sendcloud rend ses créations idempotentes par `external_reference_id` **[extrait du support Sendcloud]** ; Boxtal : **[à vérifier]**) ; **jamais un second achat sans preuve qu'il n'y en a pas eu** ; sinon te le demande | |
| 4 | `bordereau_achete` | n° de suivi + transporteur + PDF rangé | déclare l'envoi à eBay (`createShippingFulfillment`, REST) ; te sonne « imprime le bordereau du N°214 » | |
| 4′ | `declaration_incertaine` | coupure | relit `getShippingFulfillments` ; le **n° de suivi** est l'identité | |
| 5 | `declaree` | `fulfillmentId` rendu par eBay, ou bordereau acheté par toi dans eBay (eBay y met le suivi lui-même) | suit le colis (suivi.md) | |
| 6 | `pris_en_charge` | premier scan du transporteur | — | 48 h sans scan ⇒ drapeau `pas_scannee` + alerte |
| 7 | `en_transit` | | | |
| 8 | `au_relais` | + date limite de retrait si connue | message au client avant la date limite (si allumé, suivi.md) | |
| 9 | `livree` | | évaluation (eBay sait le faire seul : suivi.md §4.3) | |
| 10 | `close` | 30 j après livraison sans litige | compacter la ligne (4.3) | |
| — | `annulation_demandee`, `annulee`, `retour_ouvert`, `litige`, `remboursee`, `probleme_livraison`, `retour_expediteur` | Fulfillment (`cancelStatus`, `refunds`), Post-Order **[à vérifier]**, transporteur | **arrêt des gestes automatiques** sur cette commande ; une ligne dans Ma journée avec la date limite et le lien eBay | |

### 4.2 Les règles qui ne bougent pas

- **« Pas su » n'agit jamais.** Une lecture ratée (eBay, base, transporteur)
  rend la tâche avec un délai (1, 2, 4… min, plafonné à 60 min) **sans rien
  écrire**. On ne prévient le vendeur que si ça bloque une obligation (une date
  limite d'envoi qui approche), jamais à chaque hoquet.
- **L'identité, pas la ressemblance** : SKU `VRM-{n°}`, `orderId`, `lineItemId`,
  `fulfillmentId`, n° de suivi. Le titre n'entre dans aucune décision.
- **Le serveur ne croit jamais la base modifiable par le navigateur pour agir** :
  avant toute dépense, l'agent **relit la commande chez eBay** avec le jeton du
  compte (un `orderId` d'un autre vendeur rend une erreur chez eBay).
- **L'adresse de l'acheteur n'est jamais rangée.** Elle est lue chez eBay
  (`getOrder`) au moment d'acheter le bordereau, passée à l'agrégateur, et
  oubliée (spec `socle` : `commandeMinimale`).
- **Un geste qui coûte ou qu'on ne peut pas défaire** : uniquement si
  (a) l'interrupteur de l'installation est allumé, (b) TON réglage est allumé
  (éteint par défaut), (c) ton abonnement est **en règle** (`true` ; `null` =
  pas su ⇒ on attend), (d) les plafonds sont réservés, (e) le compte eBay est
  « relié » (pas « refusé »). Sinon la tâche est reportée et l'écran dit
  pourquoi.
- **Abonnement coupé** (`vrm_acces_pour` = `false`) : l'agent **s'arrête** pour ce
  vendeur — ni appel eBay, ni notification (comme `sendPushToAll` aujourd'hui) —
  et note « arrêté : abonnement » dans son pouls. **Abonnement « pas su »**
  (`null`, la base a hoqueté) : les **lectures** continuent (veille, suivi du
  colis, comme les notifications aujourd'hui : « pas su ne coupe pas ») ; tout ce
  qui **coûte ou ne se défait pas** attend une réponse `true`.
- **Mode répétition (initiative, recommandé)** : pendant les 7 premiers jours
  (ou tant que tu ne l'as pas validé), l'agent **calcule** ce qu'il ferait et
  l'écrit dans le journal (« j'aurais acheté un bordereau Mondial Relay à
  4,90 € pour N°214 ») **sans le faire**. Tu relis, puis tu passes en réel.

### 4.3 Où c'est rangé

**Dans `app_data`** (lisible par l'app, comme le reste), mais **écrit uniquement
par le serveur** (garde de la section 4.5) :

| ligne | contenu | taille | lue par l'app |
|---|---|---|---|
| `ebay_agent_cmd{suffixe}_{orderId}` | une par commande : `etape`, `rang`, `numero`, `orderId`, `compte`, `prochain`, `majAt`, `version` (scalaires de premier niveau ⇒ copiés dans `meta` par la base, donc listables **sans** lire `data`) ; `transitions` (les 20 dernières : de, vers, source, date, preuve), `bordereau` {fournisseur, suivi, idEnvoi, prixCentimes, chemin du PDF}, `ebay` {fulfillmentId}, `colis` {étape, dernier évènement, date limite de retrait}, `messages` {type: date} | **≤ 2 Ko** | `select=id,etape:meta->>etape,numero:meta->>numero,…` (§4.4 : jamais `select=data` en liste) |
| `ebay_agent_journal` | une par vendeur : les **300** derniers gestes faits en son nom (date, compte, orderId, N°, geste, résultat, montant en centimes pour ce qui coûte, référence, **texte exact** d'un message envoyé) | ≤ 60 Ko | à l'ouverture de « Ce que VRM a fait en ton nom » |
| `ebay_agent_pouls` | une par vendeur : dernier passage, dernier succès, dernière erreur (code, pas de texte d'eBay brut), compteurs du jour, `arrete` (raison) | < 1 Ko | sur Compte eBay et Ma journée |

**Hors `app_data`, deux petites tables « serveur seulement »** (règles d'accès
activées, aucune règle, comme `vrm_reglages`) — parce qu'un **verrou** et un
**compteur d'argent** ne doivent jamais être modifiables par un navigateur :

```sql
create table public.vrm_agent_file (       -- la file de travail ET les verrous
  owner uuid not null,
  cle text not null,                       -- 'ebay:{suffixe}:cmd:{orderId}' | 'ebay:{suffixe}:veille' | …
  prochain timestamptz not null,           -- quand la reprendre
  bail_jeton uuid, bail_jusqua timestamptz,
  essais int not null default 0,
  primary key (owner, cle));
create index on public.vrm_agent_file (prochain);

create table public.vrm_agent_compteurs (  -- plafonds d'argent et quotas
  owner uuid not null,                     -- '00000000-…' pour un quota global d'application
  cle text not null,                       -- 'bordereaux:{suffixe}:2026-10-11' | 'trading:2026-10-11' | …
  n int not null default 0, centimes bigint not null default 0,
  primary key (owner, cle));
```

**Taille, à l'échelle** : 1 300 comptes × 1 vente/jour × 2 Ko ≈ 2,6 Mo/jour,
~80 Mo/mois. ⇒ une commande `close` depuis 90 jours est **compactée** (on garde
étape, dates, N°, montant ; le journal détaillé part), jamais supprimée sans
trace.

### 4.4 Le verrou : une seule exécution à la fois par commande

Toutes les fonctions ci-dessous sont `SECURITY DEFINER`, `search_path ''`,
exécutables par `service_role` **seulement** (modèle `vrm_detourage_reserver`).

- **`vrm_agent_prendre(lim, jeton, bail_s)`** : prend au plus `lim` tâches dues
  **dont le bail est libre**, avec `for update skip locked` (deux battements ne
  prennent jamais la même), **au plus 2 par vendeur et par passage** (un vendeur
  à 500 tâches n'affame pas les autres : `row_number() over (partition by
  owner)`), pose le bail (jeton + `now() + bail_s`), et rend `(owner, cle)`.
- **`vrm_agent_ecrire(owner, id, jeton, version_attendue, data)`** : écrit l'état
  d'une commande **seulement si** (a) le bail de la tâche porte encore **ce**
  jeton et n'a pas expiré, (b) la `version` en base est celle qu'on a lue. Sinon
  **0 ligne** ⇒ on relit, on n'écrase jamais. C'est le « lire-fusionner-réécrire
  gardé » du dossier, en mieux : le contrôle est fait **par la base, dans la même
  transaction**, plus par le code.
- **`vrm_agent_rendre(owner, cle, jeton, prochain, echec)`** : libère le bail
  (seulement s'il porte ce jeton) et fixe la prochaine fois ; un échec augmente
  `essais` et le délai.
- **`vrm_agent_planifier(owner, cle, quand)`** : « fais-la au plus tard à
  `quand` » (insertion, ou `least(prochain, quand)`) — c'est ce qu'appelle une
  sonnette, une action de l'app, ou une étape qui en programme une autre.
- **`vrm_agent_journal(owner, entree)`** : ajoute une entrée au journal **en une
  instruction SQL** (concaténation, puis on garde les 300 dernières). Deux
  battements qui écrivent en même temps ne perdent rien — le motif JavaScript
  « lire, ajouter, réécrire » perdrait l'une des deux.

### 4.5 Le navigateur ne peut pas écrire la mémoire de l'agent

Un déclencheur `BEFORE INSERT OR UPDATE OR DELETE` sur `app_data` refuse toute
écriture d'un rôle `authenticated` ou `anon` (lu comme le fait déjà
`sauvegarde.noter_ecriture` : `coalesce(auth.role(), current_user)`) sur les
identifiants `ebay_agent\_%`, `ebay_tokens%`. Précédent dans le projet : les
gardes de la migration 013 (numéros). Sans lui, un vendeur pourrait fabriquer
une ligne `ebay_agent_cmd_…` « bordereau à acheter » ; avec lui, il ne peut que
**lire**.

### 4.6 Plafonds d'argent et réglages

- **Les plafonds** se réservent **avant** la dépense, en une instruction
  (`vrm_agent_reserver(owner, compte, centimes, plafond_geste, plafond_jour,
  plafond_mois)` → oui/non), et se **rendent** si l'achat est refusé — jamais si
  l'issue est incertaine (même règle que le détourage : une coupure après la
  réponse peut avoir été facturée).
- **Tes réglages** (agent allumé ou non, plafonds, textes des messages) passent
  par une **action de la route** (`agent-regler`, `confirme:true`, session
  exigée), pas par la ligne `main` que le navigateur écrit librement. Le serveur
  les **borne** par des maxima écrits dans le code (par exemple 30 bordereaux
  par jour et par compte, 25 € par bordereau) — un réglage au-delà est ramené au
  maximum et l'écran le dit.
- **L'interrupteur de l'installation** : `vrm_reglages.agent_ebay` (table serveur
  seulement), **`'0'` par défaut**. Mis à `'0'`, tout s'arrête à la minute, pour
  tous les vendeurs.
- **Fermer son compte VRM** (`api/compte.js`, `fermerCompte`) doit aussi effacer
  `vrm_agent_file`, `vrm_agent_compteurs` et `vrm_coffre` (filtre `owner=eq.`),
  et supprimer ses abonnements de notification chez eBay (avec son jeton) avant
  d'effacer ses jetons.

### 4.7 Les notifications sur son téléphone

- Toujours dans `contexteVendeur.run({owner})` ⇒ `sendPushToAll` ne lit que
  **ses** appareils, et se tait si l'abonnement est coupé (existant).
- **Une notification par commande et par type, jamais deux** : le mémo est écrit
  **avant** l'envoi, et son écriture est **vérifiée** (motif du bilan de la
  semaine). Le plus simple : le type envoyé est noté dans la ligne de la commande
  (`messages`) par `vrm_agent_ecrire`, donc sous le même verrou.
- Catégories : `vente` (existe), `double` (spec `veille`), **`agent`** (« ce que
  l'agent a fait / attend de toi », allumée par défaut), `suivi` (transit et
  livré, éteinte par défaut comme pour Vinted).

---

## 5. Le budget d'appels

### 5.1 Les plafonds connus

| quoi | plafond | portée | source |
|---|---|---|---|
| API Trading (`GetMyeBaySelling`, `GetItem`, `EndFixedPriceItem`, `AddMemberMessageAAQToPartner`…) | **5 000 / jour** | **toute l'application** (tous les vendeurs de VRM) | **[extrait]** support eBay (« s'applique au niveau de l'application ») ; relevable gratuitement par l'« Application Growth Check » |
| API Fulfillment (commandes, envois) | 100 000 / jour | application | **[extrait de la page officielle des quotas]** |
| API Notification (clé publique, abonnements) | 10 000 / jour ; **les notifications reçues ne comptent pas** | application | **[extrait de la page officielle des quotas]** |
| jetons : `refresh_token` → jeton d'accès | **50 000 / jour** | application | **[extrait de la page officielle « OAuth rate limits »]** |
| jetons : code d'autorisation (connexions) | 10 000 / jour | application | idem |
| jetons : jeton d'application | **1 000 / jour** | application | idem |
| La Poste « Suivi v2 » | **inconnu** | clé | suivi.md **[à vérifier]** |
| Vercel Hobby | fonction ≤ 300 s ; ~1 M d'appels et ~4 h de CPU actif par mois | équipe | **[extraits, secondaires pour les volumes]** |
| `pg_net` | ~200 requêtes/s | base | **[doc lue]** |
| `pg_cron` | 32 tâches simultanées, **≤ 8 recommandées**, chacune < 10 min | base | **[doc lue]** |

### 5.2 Ce que l'agent consomme

Hypothèses : un compte eBay a ~50 annonces, ~1 vente eBay par jour, ~5 colis en
route. Les **notifications** marchent (sinon, voir la dernière ligne).

| | par compte eBay et par jour | **toi aujourd'hui** (1 compte, 3 annonces, 0 vente) | **1 000 vendeurs** (~1 300 comptes) | verdict |
|---|---|---|---|---|
| renouvellements de jeton | **≤ 13** si le jeton d'accès est **gardé 1 h 50** (eBay le donne pour ~2 h) ; des centaines sinon | ≤ 13 | ≤ 17 000 / 50 000 | ✅ **à condition de garder le jeton** ; ❌ sans |
| jetons d'application | ≤ 12 pour toute l'installation (gardé 1 h 50) | 12 | 12 / 1 000 | ✅ |
| Fulfillment | veille toutes les 60 min = 24 ; par vente ~8 (`getOrder`, `getShippingFulfillments`, `createShippingFulfillment`) | ~24 | ~41 000 / 100 000 | ✅ (à 15 min, 125 000 : ❌ — d'où l'importance des notifications) |
| Trading | 1 relecture des annonces par jour + par vente : 1 relecture, ≤ 1 retrait, ≤ 2 messages ≈ **5** | ≤ 10 | **~6 500 / 5 000** | ❌ **dépassé vers 700 à 1 000 comptes** ⇒ demander la hausse **avant** ; priorités en attendant |
| La Poste | ~8 lectures par colis en route (cadence adaptée à l'étape) | 0 | ~52 000 | **[à vérifier]** |
| battements Vercel | ≤ 1 440 (seulement quand une tâche est due) | quelques dizaines | ≤ 1 440 + ~2 000 notifications | ✅ |
| débit de l'agent | — | — | 1 battement/min × 25 s × 8 en parallèle × ~1,5 s par tâche ≈ **130 tâches/min**, ~190 000/jour, pour ~20 000 nécessaires | ✅ ; au-delà, `pg_cron` lance 2 à 4 battements partagés par vendeur (`hash(owner) % 4`) |

⚠️ **Le bouton « ↻ Rafraîchir » d'aujourd'hui coûte jusqu'à ~23 appels Trading**
(`GetMyeBaySelling` + jusqu'à 20 `GetItem`). À 1 000 vendeurs qui ouvrent l'app,
ce bouton seul videra le quota. Il doit passer sous le **même compteur** que
l'agent.

### 5.3 Le garde-quota

- **Un compteur global en base** (`vrm_agent_compteurs`, propriétaire
  `00000000-…`, clé `trading:{jour}` en heure du Pacifique **[à vérifier : l'heure
  de remise à zéro d'eBay]**), réservé **avant** chaque appel Trading.
- **Trois priorités** :
  1. **obligations** (retirer d'eBay une paire vendue ailleurs, déclarer un
     envoi, un message dû) : toujours servies, **20 % du quota leur sont
     réservés** ;
  2. **détection** (relecture après une vente) : jusqu'à 80 % ;
  3. **confort** (statistiques, rafraîchir les annonces) : s'arrête à 60 %.
- **Part équitable** : hors obligations, au plus **1 % du quota par compte et par
  jour** tant que la hausse n'est pas obtenue.
- **Recalage** : une fois par heure, `getRateLimits` (API Analytics, qui couvre
  aussi Trading **[extrait]**) dit ce qu'eBay a compté ; le compteur prend le plus
  grand des deux.
- **Une seule requête en vol par compte eBay** (ordre garanti, aucun pic) — ce
  n'est pas le garde-fou anti-robot de Vinted (§3), c'est de la politesse et du
  quota.

---

## 6. La sécurité entre vendeurs

### 6.1 Où ranger les clés transporteur (et le jeton eBay)

| | **chiffrement par le serveur (AES-256-GCM), clé sur Vercel** — recommandé | Coffre Supabase (Vault) | `pgsodium` |
|---|---|---|---|
| où vit la clé maîtresse | variable Vercel `VRM_COFFRE_CLE`, type **« sensitive »** (illisible une fois posée, comme tes autres secrets **[mesuré]**) | chez Supabase, hors de la base **[doc lue]** | idem |
| qui peut déchiffrer | **seulement** le code serveur qui a **à la fois** la base **et** la variable | **tout rôle qui lit `vault.decrypted_secrets`** : `postgres`, `service_role` **[mesuré]** — donc l'éditeur SQL, l'outil Supabase des sessions Claude, et quiconque a la clé de service et une fonction qui l'expose | — |
| une copie de la base qui fuit (sauvegarde, export) | inutilisable | inutilisable | — |
| la clé de service Supabase qui fuit | **inutilisable seule** | suffit, si une fonction lit le coffre | — |
| rotation | à notre charge (version de clé dans chaque ligne, ancienne clé acceptée en lecture le temps de rechiffrer) | gérée par Supabase | — |
| statut | standard Node (`crypto`) | supporté | « **ne pas utiliser** » : en cours d'abandon **[doc Supabase lue]** |

**Comment** :
- table `vrm_coffre(owner, compte, fournisseur, v, nonce, chiffre, tag, maj)`,
  « serveur seulement » ;
- clé par ligne = HKDF-SHA256(clé maîtresse, sel = `owner`, info =
  `vrm-coffre:v1:{compte}:{fournisseur}`) ; **données associées** (AAD) =
  `owner|compte|fournisseur|v`. ⇒ Une valeur chiffrée **recopiée** dans la ligne
  d'un autre vendeur **ne se déchiffre pas** (l'authentification échoue) ;
- nonce aléatoire de 12 octets à chaque écriture ;
- la valeur déchiffrée ne quitte **jamais** le serveur : l'app voit « clé Boxtal
  posée le 11/10 · testée ✓ », jamais la clé ; l'action `agent-coffre-poser`
  chiffre et range, `agent-coffre-tester` fait un appel de lecture chez le
  transporteur et rend ok/refus ;
- ⚠️ **perdre `VRM_COFFRE_CLE` = toutes les clés transporteur à ressaisir** (pas
  de perte d'argent, pas de fuite). Garde une copie hors ligne (gestionnaire de
  mots de passe).
- **À ranger au même endroit, ensuite** : le **jeton eBay** de chaque compte et le
  **jeton d'accès gardé 1 h 50** (section 5). Aujourd'hui en clair, lisible par
  le navigateur du vendeur, et dans les sauvegardes (section 1.1).

Le **coffre Supabase** reste le bon endroit pour **un seul** secret : celui du
battement, parce que `pg_cron` doit le lire dans la base.

### 6.2 L'agent agit avec la clé de service, mais toujours filtré

- Chaque tâche porte son `owner` (pris en base par `vrm_agent_prendre`, jamais
  reçu d'un navigateur ni d'une notification) ; tout le travail tourne dans
  `contexteVendeur.run({owner})` ; **toute** lecture et écriture passe par
  `portee(owner)` (`owner=eq.`) — l'existant.
- Le compte eBay se tire de la clé de tâche et se **valide contre le registre de
  CE vendeur** (`resoudreCompte`) avant de prendre un jeton. Un jeton n'est
  jamais tiré pour un autre `owner` que celui de la tâche.
- Un audit (sur le modèle de `audit-ebay-route.cjs`) exécute l'agent dans un `vm`
  avec **deux vendeurs** et exige : chaque requête porte `owner=eq.` du bon
  vendeur ; un jeton de A n'est jamais présenté pour une commande de B.

### 6.3 Ce qu'un vendeur malveillant pourrait tenter

| tentative | ce qui l'arrête |
|---|---|
| lire les clés ou jetons d'un autre | tables serveur seulement + `owner=eq.` + données associées du chiffrement |
| fabriquer une commande dans sa base pour faire acheter un bordereau | garde d'écriture (4.5) ; l'agent **relit la commande chez eBay** avec le jeton du compte avant toute dépense |
| monter ses plafonds au-delà du raisonnable | réglages par la route, bornés par le serveur ; et l'argent dépensé est **le sien** (sa clé transporteur, son compte) — VRM ne paie jamais un bordereau avec **son** argent |
| forger une notification eBay | signature ECC vérifiée ; et une notification n'est qu'une sonnette (relecture freinée) |
| rejouer une vraie notification | `notificationId` déjà vu ⇒ ignorée ; sonnette de toute façon |
| forger un webhook transporteur | HMAC-SHA256 du corps avec **la clé de SON abonnement** (Boxtal `x-bxt-signature` **[extrait du guide Boxtal v3]**), sur une adresse propre à chaque vendeur (`/api/ebay-transporteur/{identifiant opaque}`) |
| épuiser le quota eBay de tout le monde | part équitable (1 % par compte), priorités, bouton « Rafraîchir » sous le même compteur |
| se servir de VRM pour écrire en masse aux acheteurs | plafonds de messages (suivi.md : 20 par jour et par compte), textes contrôlés par le serveur (ni lien, ni email, ni téléphone : règles d'eBay) |
| faire télécharger à l'agent une adresse arbitraire (« le PDF est ici ») | l'agent ne télécharge un bordereau **que** chez l'hôte de l'agrégateur, liste blanche par motif (comme `pdfBordereauLbc`) |
| voler le secret du battement | battements idempotents, freinés à 20 s, réponse sans donnée |
| continuer à se servir de l'agent après avoir cessé de payer | `vrm_acces_pour` = `false` ⇒ l'agent s'arrête pour lui ; ses lignes sont déjà fermées par la base (RLS) |

### 6.4 Les journaux

Jamais un pseudo d'acheteur, une adresse, un titre ou un jeton dans
`console.log` : Vercel ne les garde qu'une heure **[mesuré]**, mais ils passent
quand même chez un tiers. Le journal relisible est **le nôtre**
(`ebay_agent_journal`), et il ne contient que ce que tu dois pouvoir relire.

---

## 7. Recommandation : l'architecture minimale robuste

```
eBay ──(ORDER_CONFIRMATION, signée)──▶ /api/ebay-notif ─┐   (mode de api/ebay.js : vérifier, ranger
                                                        │    la sonnette, répondre 204 en < 1 s)
                                                        ▼
            ┌──────────────────── Supabase (plan Pro) ────────────────────┐
            │ vrm_agent_file  (file + baux)   vrm_agent_compteurs (€, quota)│
            │ vrm_coffre (chiffré)            vrm_reglages.agent_ebay ('0') │
            │ app_data : ebay_agent_cmd*_{orderId} · _journal · _pouls      │
            │ pg_cron (chaque minute, seulement s'il y a du travail)        │
            └───────────────┬───────────────────────────────────────────────┘
                            │ pg_net POST + secret du coffre
                            ▼
              /api/ship-reminders?mode=battement  (25 s de travail, 8 en parallèle,
                            │                       un vendeur à la fois dans son contexte)
                            ▼
          api/_lib/agent-ebay.js : veille (getOrders) → machine à états →
          eBay (Fulfillment, Trading sous garde-quota) · agrégateur (plafonds) ·
          transporteur (suivi) · notifications push · journal
                            ▲
            cron Vercel 08:00 : battement de secours + « l'horloge est-elle vivante ? »
```

**Aucune nouvelle fonction Vercel** (toujours 12), **aucun cron Vercel ajouté**,
**une dépendance de moins à craindre** (pas de service externe).

**Dans quel ordre construire** (chaque étape est utile seule) :
1. **Migration** : `vrm_agent_file`, `vrm_agent_compteurs`, `vrm_agent_horloge`,
   `vrm_coffre`, les fonctions de la section 4.4, la garde d'écriture 4.5 ;
   éprouvée sur un Postgres jetable (comme `audit-renum-b.cjs`) : deux battements
   simultanés ne prennent jamais la même tâche ; un bail expiré se reprend ; une
   écriture avec un mauvais jeton ou une mauvaise version rend 0 ligne ; un
   `authenticated` ne peut pas écrire `ebay_agent_…`.
2. **Le jeton d'accès gardé** + le **garde-quota** (utiles même sans agent : ils
   protègent dès aujourd'hui l'app à 1 000 vendeurs).
3. **Le battement** (`pg_cron` + mode `battement`) avec une seule tâche :
   la **veille** (relire les commandes) et l'état `payee` + la sonnette « Vendu sur
   eBay ». Lecture seule : aucun risque.
4. **L'oreille** : `ORDER_CONFIRMATION` + `AUTHORIZATION_REVOCATION` (après ta
   reconnexion).
5. **Le coffre** et les clés transporteur, puis le bordereau en **mode
   répétition**, puis en réel.

**Preuves attendues** (méthode §6.1 : rouge sur le code d'avant, rouge sous
mutation) : un audit qui exécute la vraie route `battement` et la vraie
bibliothèque dans un `vm`, avec un faux Supabase **qui applique les verrous**
(ou un vrai Postgres jetable), un faux eBay qui compte les appels par API, et
deux vendeurs. Mutations à prouver : verrou retiré (⇒ deux achats), version
ignorée (⇒ écrasement), « pas su » traité comme « rien » (⇒ un achat sur une
lecture ratée), filtre `owner` retiré (⇒ fuite), garde-quota retiré (⇒
dépassement), mémo écrit après l'envoi (⇒ deux notifications).

### Les gestes uniques de Julien

| # | geste | où | pourquoi |
|---|---|---|---|
| 1 | **Décider Vercel Pro** avant d'ouvrir VRM à des abonnés payants | vercel.com → Settings → Billing | Hobby = « non commercial » ; Pro donne aussi le cron à la minute et 800 s |
| 2 | **Activer `pg_cron` et `pg_net`** | Supabase → Database → Extensions (ou une migration que je prépare, sur ton oui) | l'horloge de l'agent |
| 3 | **Poser `VRM_BATTEMENT_SECRET`** (64 caractères aléatoires), **type « sensitive », production** | Vercel → Settings → Environment Variables | le battement s'authentifie |
| 4 | Mettre **la même valeur** dans le coffre : `select vault.create_secret('<valeur>', 'vrm_battement_secret');` | Supabase → SQL Editor (ou Vault) | `pg_cron` la lit |
| 5 | **Poser `VRM_COFFRE_CLE`** (32 octets aléatoires en base64), « sensitive », production — **et en garder une copie hors ligne** | Vercel + ton gestionnaire de mots de passe | chiffre les clés transporteur et, ensuite, tes jetons eBay |
| 6 | **Demander à eBay l'« Application Growth Check »** (gratuit) : (a) hausse du quota Trading, (b) liste blanche « Platform Notifications avec OAuth », (c) confirmation des droits `commerce.notification.subscription` et `commerce.message` pour l'application | developer.ebay.com → My Account → Application Growth Check **[à vérifier : chemin exact]** | sans (a), l'agent plafonne vers 700 à 1 000 comptes ; (b) pour les questions/offres en temps réel |
| 7 | **Te reconnecter une fois à eBay** (chaque compte) quand le jeu de droits `v2` sortira | VRM → eBay → Compte eBay → « Reconnecter » | le droit d'abonnement aux notifications (et litiges, statistiques) |
| 8 | **Allumer l'agent** : `vrm_reglages.agent_ebay = '1'`, puis ton réglage, d'abord en **mode répétition** | Supabase (installation) puis VRM → Réglages | rien ne part tant que tu ne l'as pas fait |
| 9 | Ne **jamais** ajouter `net` aux schémas exposés de l'API | Supabase → Settings → API | sinon la file de `pg_net` (secret compris) devient lisible par l'app |

### Ce qui reste à mesurer au premier vrai essai

1. Que `ORDER_CONFIRMATION` arrive bien pour **un vendeur eBay.fr** (le sujet
   est récent), avec quels champs, et en combien de secondes après le paiement.
2. Le nom exact du droit d'abonnement utilisateur et s'il est accordé à
   l'application VRM sans démarche.
3. Si la notification nomme le compte (sinon : une destination par compte, et le
   plafond de destinations).
4. Que la signature se vérifie sur le corps brut (sinon sur le JSON re-sérialisé,
   comme le code officiel).
5. Que « Fluid compute » est activé sur le projet (300 s) — sans quoi la durée par
   défaut serait plus courte et le battement de 25 s reste sûr de toute façon.
6. L'heure de remise à zéro du quota Trading, et le quota de La Poste.
7. Le délai réel d'une requête `pg_net` vers `vrm.center` (même région), et qu'un
   battement de 25 s ne déclenche pas le délai de 30 s.

---

## 8. Sources

**Mesuré aujourd'hui** : base Supabase `lgonxzrzjcqthjtbdpzo` (extensions,
coffre, règles d'accès, fonctions, déclencheurs, lignes `ebay_*` par clés et
tailles, copies `sauvegarde.*`, droits des rôles) ; projet Vercel `cancale-v67`
(plan, région, domaines, noms des variables) ; code de la branche
`worktree-wf_30feaf2f-334-8` (`api/ebay.js`, `api/_lib/ebay.js`,
`api/ship-reminders.js`, `api/_lib/owner.js`, `api/_lib/abonnement.js`,
`api/compte.js`, `vercel.json`, `package.json`).

**Documentation lue** :
- Supabase (outil de recherche officiel) : [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions), [Cron quickstart](https://supabase.com/docs/guides/cron/quickstart), [Cron](https://supabase.com/docs/guides/cron), [pg_cron debugging guide](https://supabase.com/docs/guides/troubleshooting/pgcron-debugging-guide-n1KTaz), [Database roles can read request headers queued by pg_net](https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357), [Revoking access to pg_net objects has no effect](https://supabase.com/docs/guides/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16), [Vault](https://supabase.com/docs/guides/database/vault), [pgsodium (pending deprecation)](https://supabase.com/docs/guides/database/extensions/pgsodium), [Edge Functions limits](https://supabase.com/docs/guides/functions/limits), [Edge Function invocations](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations), [Upgrading (pg_cron records)](https://supabase.com/docs/guides/platform/upgrading).
- Vercel (outil de recherche officiel) : [waitUntil — @vercel/functions](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package), [Configuring duration](https://vercel.com/docs/functions/configuring-functions/duration).
- Code officiel d'eBay : [eBay/event-notification-nodejs-sdk](https://github.com/eBay/event-notification-nodejs-sdk) (`lib/validator.js`, `lib/client.js`, `lib/constants.js`, `lib/index.js`, README).

**Extraits de moteur de recherche** (pages officielles bloquées ici) :
- eBay : [Using OAuth with the eBay traditional APIs](https://developer.ebay.com/api-docs/static/oauth-trad-apis.html) (liste blanche), [Notification API overview](https://developer.ebay.com/api-docs/commerce/notification/overview.html), [Notification API release notes](https://developer.ebay.com/api-docs/commerce/notification/release-notes.html), [Notification Topics](https://developer.ebay.com/develop/api/buy/notification_events), [createDestination](https://edp.ebay.com/api-docs/commerce/notification/resources/destination/methods/createDestination), [createSubscription](https://developer.ebay.com/api-docs/commerce/notification/resources/subscription/methods/createSubscription), [OAuth rate limits](https://developer.ebay.com/api-docs/static/oauth-rate-limits.html), [API call limits](https://developer.ebay.com/develop/get-started/api-call-limits), [KB 1362 (quota Trading)](https://developer.ebay.com/support/kb-article?KBid=1362), [KB 1201](https://developer.ebay.com/support/kb-article?KBid=1201) et [KB 780](https://developer.ebay.com/support/knowledge-base/780) (signature Platform Notifications), [KB 407 (3 000 ms)](https://developer.ebay.com/support/kb-article?KBid=407), [Platform Notifications](https://developer.ebay.com/api-docs/static/platform-notifications-landing.html), [blog technique d'eBay sur les SDK d'écoute](https://tech.ebayinc.com/engineering/ebay-event-notification-platform-listener-sdks/), [NotificationEventTypeCodeType](https://developer.ebay.com/devzone/xml/docs/reference/ebay/types/NotificationEventTypeCodeType.html).
- Vercel : [Cron jobs — usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Functions limitations](https://vercel.com/docs/functions/limitations), [Fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines), [Hobby plan](https://vercel.com/docs/plans/hobby).
- GitHub : [événement `schedule` (retards, abandons, désactivation après 60 jours)](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows).
- Transporteurs : [Boxtal — subscriptions API v3](https://developer.boxtal.com/fr/en/apiv3/guide/subscriptions-api-v3), [Sendcloud — idempotence (`external_reference_id`)](https://support.sendcloud.com/hc/en-us/articles/7789894544276).

**Sources secondaires** : forum eBay ([liste blanche et notifications rejetées](https://community.ebay.com/t5/eBay-APIs-Talk-to-your-fellow/All-event-notifications-are-rejected-due-to-some-token-problem/m-p/33935187), [Whitelist Application for Platform Notifications](https://community.ebay.com/t5/eBay-APIs-Talk-to-your-fellow/Whitelist-Application-for-Platform-Notifications/td-p/34511268)) ; forum Vercel ([déploiements bloqués par un cron Hobby](https://community.vercel.com/t/deployments-not-being-created-despite-successful-trigger-requests-project-stuck-since-2026-07-22/46418)) ; types générés de l'OpenAPI de l'API Notification dans le paquet npm `ebay-api` 10.0.1 (chemins `/destination`, `/subscription`, `/public_key/{id}`, `/topic` ; champs `deliveryConfig.endpoint`, `verificationToken`, `authorizationScopes`) ; [prix de Vercel Pro](https://modelence.com/compare/vercel-pricing).
