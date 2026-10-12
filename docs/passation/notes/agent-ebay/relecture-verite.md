# Relecture adverse de la synthèse : est-ce que chaque appel existe vraiment ?

**Pour :** Julien d'abord (sections 0 et 3), puis la session qui construira.
**Rédigé le :** 11 octobre 2026, en soirée.
**Ce que je relis :** `synthese.md` (la conception retenue de l'agent eBay
autonome), avec ses études (`bordereaux.md`, `suivi.md`, `infra.md`,
`etat.md`) et la feuille de route du 9 octobre (`../agent-ebay/`).
**Mon angle :** les API, les champs, les sujets de notification, les codes
transporteur, les prix et les quotas cités existent-ils vraiment pour eBay.fr et
la France en 2026 ? Et l'infrastructure tient-elle : Vercel Hobby, Supabase
(`pg_cron`, `pg_net`), le budget d'appels eBay pour 1 000 vendeurs, et ce qu'aucun
banc ne peut prouver.

**D'où vient chaque fait :**

| marque | sens |
|---|---|
| **[mesuré]** | lu par moi aujourd'hui : sa base Supabase (lecture seule, projetée : aucun jeton, aucun nom, aucune adresse d'acheteur), son projet Vercel (réglages seulement), le code de la branche `wf_30feaf2f-334-8` |
| **[doc lue]** | documentation officielle lue par l'outil de recherche officiel (Supabase) |
| **(extrait officiel)** | extrait d'une page officielle rendu par un moteur de recherche. `developer.ebay.com` et `developer.boxtal.com` répondent `ENOTFOUND` d'ici (revérifié ce soir) : la page elle-même n'a pas été lue |
| **(code lu)** | dépôt GitHub lu (bibliothèque officielle ou non) |
| **(secondaire)** | presse, blog, forum |
| **[à vérifier]** | pas établi |

**Aucun appel** n'a été fait à eBay, à un transporteur, à un agrégateur ni à
Vinted. **Aucune écriture**, sauf ce fichier.

---

## 0. En une page, pour Julien

**La synthèse tient sur l'essentiel.** Les points porteurs que j'ai revérifiés
sont vrais :
- l'avertissement « une vente eBay est payée » existe bien, et il est envoyé
  **au vendeur** (`ORDER_CONFIRMATION`, ajouté le 1ᵉʳ décembre 2025) ;
- `ITEM_MARKED_SHIPPED` est bien pour l'**acheteur** : la synthèse a raison de
  ne pas s'en servir ;
- la liste officielle des codes transporteur par pays existe
  (`get_shipping_carriers`, 30 octobre 2025) ;
- les quotas de jetons et de commandes sont justes ;
- Supabase sait réveiller VRM chaque minute (`pg_cron` et `pg_net` sont
  disponibles chez toi, pas encore installés).

**Mais j'ai trouvé 18 défauts.** Les cinq qui comptent :

1. **Un appel cité est mort depuis le 30 septembre 2026.**
   `UploadSiteHostedPictures` (mettre tes photos chez eBay) a été retiré par
   eBay. L'étude du 9 octobre le disait déjà, et la synthèse l'a repris tel
   quel. Le remplaçant est la **Media API**.
2. **Le rythme de surveillance ferait exploser les quotas à 1 000 vendeurs.**
   La synthèse ne relit toutes les heures que les comptes qui ont reçu une
   alerte de vente depuis moins de 7 jours. Un vendeur qui vend peu ne reçoit
   rien : il serait relu **toutes les 15 minutes, pour toujours**. Au total,
   125 000 à 250 000 appels par jour, pour un quota de 100 000.
3. **Une panne de ta base peut couper en silence les alertes d'eBay.** Pendant
   une panne comme celle du 9 au 12 septembre, VRM répondrait « erreur » à
   eBay. eBay **marque alors l'adresse en panne** (`MARKED_DOWN`), et c'est à
   VRM de la rallumer. La synthèse n'en parle pas.
4. **L'alarme « l'agent est arrêté » regarde le mauvais signal.** Elle lit le
   tic de l'horloge de ta base, pas la réponse de VRM. Si VRM refuse chaque
   battement (un secret différent entre ta base et Vercel, une adresse cassée),
   l'horloge continue de battre : l'agent est mort et **rien ne sonne**.
5. **La synthèse dit qu'aucune page ne cite `ShippingLabelPolicy = EBAY_ONLY` :
   c'est faux.** Les notes de version Trading 1455 (juin 2026) le documentent.
   Ce champ dit si eBay **t'impose** son bordereau. Ton compte en donne déjà un
   indice fort, mesuré le 27 septembre : eBay refuse tout mode de livraison que
   VRM envoie. Ce champ décide donc si le gros chantier « VRM achète le
   bordereau » (3 à 5 sessions) te servira un jour. **Il faut le lire avant de
   construire ce chantier.**

**Un point qui te concerne tout de suite.** La migration des numéros a été
appliquée aujourd'hui à 14 h 58 UTC, **après** la synthèse.
- La paire que la synthèse appelle « N°553 » est maintenant le **N°1**.
  L'annonce eBay `128127336988` porte toujours le SKU `VRM-553`, que VRM lit
  désormais comme le N°1.
- La « N°559 » est devenue le **N°10** [mesuré].
- ⇒ Cherche le carton par son **nouveau** numéro.

---

## 1. Les défauts

Chaque défaut se lit dans le même ordre : **ce qui casse**, le **scénario**, la
**correction**, la **source**. Gravité : **haute** (argent, perte silencieuse,
ou chantier construit pour rien) · **moyenne** · **basse**.

### D1 — `UploadSiteHostedPictures` est décommissionné depuis le 30 septembre 2026 · **haute**

- **Ce qui casse.** L'initiative I12 (« photos hébergées chez eBay à la
  publication, `UploadSiteHostedPictures` ») et le chantier 14.
- **Le scénario.** Une session code I12 tel qu'écrit.
  - L'appel échoue à chaque fois.
  - La garde d'I12 dit « échec ⇒ on ne publie pas ».
  - ⇒ Plus **aucune** publication avec des photos hébergées par eBay.
  - Pire si on « assouplit » la garde : on publie avec les liens Vinted signés,
    c'est-à-dire exactement le défaut qu'I12 voulait corriger.
- **La correction.** Passer par la **Media API** :
  1. `createImageFromUrl` (adresse publique) ou `createImageFromFile` (les
     octets), sur `apim.ebay.com/commerce/media/v1_beta/…` ;
  2. l'identifiant revient dans l'en-tête `Location` ;
  3. `getImage` rend l'adresse eBay (EPS) et sa date d'expiration ;
  4. cette adresse va dans `<PictureURL>`.
  - **À mesurer** :
    - les serveurs d'eBay savent-ils lire une adresse `images1.vinted.net`
      signée ?
    - sinon, ce sont les octets qui partent : il faut les avoir côté serveur,
      et le corps d'une requête Vercel est limité (4,5 Mo par requête,
      [à vérifier]) ;
    - le plafond de la Media API (« 50 envois par 5 s et par utilisateur », d'après
      la feuille du 9 octobre).
- **Source.**
  - (Extrait officiel) Référence Trading `UploadSiteHostedPictures`, versions
    1451, 1455 et 1475 : « will be decommissioned on September 30th, 2026 ».
  - Déjà écrit dans `../agent-ebay/possible.md` §B et dans la feuille du
    9 octobre (« Media API à vérifier »).

### D2 — Le rythme « 60 min si une sonnette depuis 7 jours » fait relire toutes les 15 min ceux qui vendent peu · **haute**

- **Ce qui casse.** Le quota Fulfillment (commandes) et la charge Vercel, dès
  qu'il y a beaucoup de vendeurs.
- **Le scénario** (synthèse §4.5).
  - La veille relit toutes les 15 min, et ne passe à 60 min que si « une
    [sonnette] reçue depuis moins de 7 jours ».
  - Un compte qui vend une paire par semaine, ou moins, ne reçoit jamais de
    sonnette : il reste à 15 min **en permanence**. Or c'est la majorité des
    comptes d'un service à 12,99 €.
  - 1 300 comptes × 96 relectures × 1 à 2 appels = **125 000 à 250 000 appels
    Fulfillment par jour**, pour un quota par défaut de **100 000**.
  - En plus, le battement devient continu (voir D7).
- **La correction.**
  - Prouver le canal **sans attendre une vente** : `POST
    /subscription/{id}/test`, une fois par semaine et par compte (réponse 202
    attendue). La notification de test arrive signée sur l'adresse du compte.
  - Ajouter une lecture quotidienne de `getDestination` (statut, voir D3).
  - Passer à 60 min dès que le test est revenu. Ne garder 15 min que si le test
    échoue ou si l'adresse est `MARKED_DOWN`.
  - L'étude `infra.md` §2.2 prévoyait exactement « ou un test d'abonnement
    réussi » : la synthèse l'a perdu.
- **Source.**
  - (Extrait officiel) Quota Fulfillment, ressource commandes : « 100,000 API
    calls per day ».
  - La route `test` de l'abonnement (référence `subscription/test`) ; une
    implémentation tierce attend `202` (code lu : PR `nexus-commerce` #382).

### D3 — Répondre 500 à eBay pendant une panne de la base peut faire marquer l'adresse « en panne » · **haute**

- **Ce qui casse.** Les sonnettes d'eBay, après chaque panne longue.
- **Le scénario.**
  - La synthèse (§8.1) répond **500** quand la base est injoignable, « pour
    que l'expéditeur réessaie ».
  - eBay réessaie 3 fois, puis abandonne. Il peut aussi passer l'adresse en
    **`MARKED_DOWN`** : un statut posé **par eBay**, que l'application doit
    remettre elle-même à `ENABLED` (`updateDestination`).
  - Après une panne comme celle du 9 au 12 septembre (3 jours), les sonnettes
    peuvent ne jamais revenir.
  - Et la synthèse ne s'en apercevrait qu'au bout de 7 jours, par « sonnettes
    muettes » (I20). Pendant ce temps, la veille reste à 60 min, puisqu'une
    sonnette était arrivée avant la panne.
- **La correction.**
  1. Une fois la signature vérifiée, répondre **204 même si la base hoquette**.
     La sonnette ne porte aucune donnée qu'on croit, et la veille rattrape par
     date de modification. Seule une **signature fausse** reçoit 412.
  2. Lire chaque jour `getDestination` pour chaque adresse (1 300 appels pour
     1 300 comptes, sur un quota Notification de 10 000).
  3. `MARKED_DOWN` ⇒ `updateDestination {status: ENABLED}`, veille repassée à
     15 min, alerte I20.
  4. Le seuil qui déclenche `MARKED_DOWN` n'est pas documenté [à vérifier].
- **Source.** (Extrait officiel) `DestinationStatusEnum` : `ENABLED`,
  `DISABLED`, `MARKED_DOWN` (« set by eBay systems and cannot be used in a
  create or update call ») ; `updateDestination`.

### D4 — L'alarme de l'horloge lit le tic de la base, pas la réponse de VRM · **haute**

- **Ce qui casse.** La garantie « l'agent se répare et prévient ».
- **Le scénario.**
  - La tâche `pg_cron` fait le `net.http_post` **puis** `update
    vrm_agent_horloge set dernier_tic = now()`, dans tous les cas.
  - Le secours de 08:00 alerte sur « plus de 30 min sans **tic** » (§4.2,
    §4.6).
  - Or plusieurs pannes laissent le tic avancer pendant que VRM refuse chaque
    battement :
    - le secret du coffre et `VRM_BATTEMENT_SECRET` qui ne sont plus les mêmes
      après une rotation ;
    - une réécriture `vercel.json` cassée par un déploiement ;
    - le mode « défi » du pare-feu Vercel allumé ;
    - une fonction qui plante au chargement.
  - Dans tous ces cas, les tâches restent dues et rien ne part. `pg_net` note
    l'échec, et `cron.job_run_details` affiche quand même « succeeded » (la
    synthèse le dit elle-même, §4.6). **L'agent est mort et aucune alarme ne
    sonne.**
- **La correction.**
  - Le secours alerte sur **`dernier_succes`** : écrit **par la route** après
    un battement réussi, et vieux de plus de 30 min **alors qu'une tâche est
    due**.
  - Il lit aussi `net._http_response` (6 h d'historique) : la part de codes
    différents de 2xx, et le dernier code.
  - Le pouls de l'app dit « l'horloge bat, mais VRM refuse les battements
    (code 401) » : c'est une cause, avec son geste.
- **Source.**
  - [doc lue] `pg_net` : les réponses sont gardées 6 h dans
    `net._http_response`, et les requêtes ne partent qu'à la validation de la
    transaction.
  - La colonne `dernier_succes` existe déjà dans l'esquisse §5.1 ; personne ne
    la lit.

### D5 — `ShippingLabelPolicy = EBAY_ONLY` EST documenté · **haute** (un chantier « L » peut-être pour rien)

- **Ce qui casse.** L'ordre des chantiers, et la confiance dans une sortie que
  la synthèse croit sans source.
- **Ce que dit la synthèse** (§1.2, §1.4, §20) : « deux recherches ne trouvent
  aucune page qui le cite [0 résultat] ». Elle en fait « un bonus », et décide
  la voie du bordereau d'après **ta déclaration**.
- **Ce que j'ai trouvé** (extrait officiel, notes de version Trading) :
  - la version **1455** (4 juin 2026 ; le comportement est daté du 1ᵉʳ juin)
    renvoie `ShippingLabelPolicy` dans `GetOrders` et `GetItemTransactions` ;
  - `EBAY_ONLY` veut dire « the item must be shipped using an eBay-provided
    shipping label » ;
  - « **If not returned, no shipping label policy is enforced** » ;
  - le champ n'est renvoyé **qu'au vendeur**, et seulement au niveau 1455 ou
    plus (on peut le demander par l'en-tête `X-EBAY-API-COMPATIBILITY-LEVEL`).
- **L'indice mesuré sur ton compte** [mesuré : `api/ebay.js` l. 629-636].
  - Le 27 septembre, eBay a refusé tout bloc `<ShippingDetails>` envoyé par
    VRM, transporteur seul compris.
  - Seule une annonce **sans** livraison passe, et eBay choisit alors le
    transporteur **et** le prix.
  - C'est le mode « livraison gérée par eBay ». Le plus probable est donc
    `EBAY_ONLY` sur tes commandes. Dans ce cas, la voie « VRM achète » (le
    chantier 11, 3 à 5 sessions) **ne s'appliquerait jamais à toi**.
- **La correction.**
  - Lire le champ au niveau 1455 dès le chantier 2, sur chaque commande, avec
    trois états :
    - `EBAY_ONLY` ⇒ voie eBay ;
    - **lu au niveau 1455 et absent** ⇒ étiquette libre (c'est ce que dit la
      doc) ;
    - **pas lu** ⇒ « pas su » ⇒ voie eBay.
  - Ta déclaration reste un filet, jamais au-dessus du champ.
  - **Ne lancer le chantier 11 qu'après au moins une commande lue « libre »**,
    sur ton compte ou celui d'un autre vendeur.
- **Une nuance sur « probable sur un compte particulier ».** La presse
  (secondaire) décrit l'étiquette eBay comme une **option** pour les
  particuliers français depuis le 1ᵉʳ septembre 2026, pas comme une
  obligation. Ce qui pointe vers `EBAY_ONLY`, c'est l'indice mesuré sur
  **ton** compte, pas une règle générale.
- **Source.**
  - (Extrait officiel) Release Notes — Trading API (version 1455) ; référence
    `GetOrders`.
  - (Secondaire) ebayinc.com/fr, ecommercemag, justgeek (septembre 2026).

### D6 — Le budget Trading est sous-estimé, et la boîte (chantier 13) le viderait · **moyenne**

- **Ce qui casse.** Le quota Trading, qui est de **5 000 appels par jour pour
  toute l'application**, tous vendeurs confondus. Le chiffre vient de réponses
  du support eBay sur son forum (secondaire), pas de KB 1362 (voir D17).
- **Le scénario.**
  - `infra.md` comptait environ 5 appels Trading par compte et par jour.
    Recompté sur la liste d'appels **de la synthèse**, à une vente par jour :

    | quoi | appels Trading par compte et par jour |
    |---|---|
    | relire les annonces (une fois par jour, plus après chaque vente) | ~2 (et plus si plusieurs pages) |
    | `GetOrders` dédié à la politique d'étiquette | 1 |
    | messages au client (« merci », J-2 au relais) | ~2 |
    | évaluation (`GetItemsAwaitingFeedback` puis `LeaveFeedback`) | 2 |
    | baisses de prix (`GetItem` puis la révision) | ~2 |
    | le bouton « ↻ » de l'app (jusqu'à ~23 appels), une fois tous les deux jours | ~12 |
    | **total** | **~20** |

  - ⇒ 5 000 ÷ 20 ≈ **250 comptes** (moins de 200 vendeurs), pas « ~700 ».
  - Et le chantier 13 (« boîte » : offres, questions) n'a ni cadence ni budget
    dans la synthèse. S'il interroge `GetBestOffers` et `GetMemberMessages`
    toutes les 30 min, c'est 96 appels par compte et par jour : **le quota
    tomberait vers 50 comptes**.
- **La correction.**
  1. Refaire le budget §14 sur cette liste réelle, et demander
     l'« Application Growth Check » (gratuite) **avant d'ouvrir
     l'abonnement**, pas « avant ~700 comptes ».
  2. **Faire tourner la boîte par notifications, sans interroger eBay à
     intervalles réguliers.** Les sujets **`BUYER_QUESTION`** et
     **`NEW_MESSAGE`** existent : version 1.6.5 du 17 novembre 2025, envoyés au
     vendeur. Les abonner **dans la même reconnexion** que
     `ORDER_CONFIRMATION`, sur la même adresse par compte.
  3. Pour lire et répondre, la **Message API** REST (sortie au 4ᵉ trimestre
     2025) remplace les appels de messagerie de Trading. Il reste à vérifier
     qu'elle marche sur eBay.fr et quel est son quota [à vérifier].
  4. Pour les offres, seules les relectures que tu demandes, ou le seuil natif
     d'eBay, que tu as déjà.
- **Source.**
  - (Extrait officiel) Notification API release notes 1.6.5 ; newsletter
    développeurs eBay du 4ᵉ trimestre 2025 (Message API comme alternative à
    `AddMemberMessageAAQToPartner`, `GetMemberMessages`, `GetMyMessages`…).
  - (Secondaire) forum du support eBay : 5 000 par jour, au niveau de
    l'application.

### D7 — Sur Vercel Hobby, dépasser l'inclus met en pause **tout VRM**, pas seulement l'agent · **moyenne**

- **Ce qui casse.** Les emails entrants, les notifications, le widget, l'app :
  tout ce qui passe par les fonctions Vercel.
- **Les chiffres.**
  - Le plan Hobby inclut **4 h de CPU actif**, **360 Go-heures de mémoire** et
    **1 million d'appels** par mois (extrait officiel, page Hobby).
  - Au-delà, le projet est **mis en pause**, jusqu'à 30 jours d'après des
    copies de la doc (secondaire). Un utilisateur Hobby rapporte la pause après
    avoir dépassé les 4 h de CPU (forum Vercel).
- **Le scénario.**
  - Un battement qui travaille 25 s chaque minute, c'est environ 300 heures
    d'instance par mois. À 2 Go, ça fait **~600 Go-h, au-dessus des 360**.
  - Ça arrive dès que la file n'est jamais vide, c'est-à-dire avec quelques
    dizaines de vendeurs actifs (voir D2).
  - **Pour toi seul, aucun danger** : environ 150 battements courts par jour,
    ~10 Go-h par mois.
- **La correction.**
  - Faire de **Vercel Pro un prérequis du battement dès qu'il sert un autre
    vendeur que toi**, pas seulement « avant les abonnés payants » (la
    synthèse le présente comme une question de conditions d'utilisation).
  - D'ici là, l'interrupteur d'installation n'allume l'agent **que pour le
    propriétaire** de l'installation.
  - Regarder l'onglet « Usage » de Vercel une semaine après l'allumage.
- **Source.**
  - (Extrait officiel) vercel.com/docs/plans/hobby (4 CPU-hrs, 360 GB-hrs,
    1 000 000 invocations).
  - (Secondaire) pause de 30 jours ; forum community.vercel.com,
    « Hobby Plan Account Paused ».

### D8 — La durée maximale d'une fonction n'est ni lue ni fixée · **moyenne**

- **Ce qui casse.** La boucle de 25 s du battement.
- **Le scénario.**
  - La synthèse suppose « Fluid compute » allumé (300 s). L'API Vercel ne l'a
    pas montré [mesuré : `get_project` ne rend pas `resourceConfig`], et
    `vercel.json` ne fixe aucune `maxDuration`.
  - Sans Fluid, la durée par défaut d'une fonction Hobby est **10 s**
    (comportement historique, [à vérifier] sur ton projet).
  - Un battement coupé à 10 s **au milieu d'un achat de bordereau** laisse
    `en_cours` avec un bail qui expire. La commande passe en
    `etiquette_incertaine` : arrêt, et une question posée à toi. Chaque coupure
    fabrique un « incertain » de plus.
- **La correction.**
  - Poser `"functions": { "api/ship-reminders.js": { "maxDuration": 60 } }`
    dans `vercel.json`. Ça ne crée **aucune** fonction : le plafond de 12
    tient.
  - Ou borner la boucle à 8 s tant que Fluid n'est pas vérifié dans Settings
    → Functions.
- **Source.**
  - [mesuré] projet `cancale-v67`.
  - (Extrait officiel) « Functions limitations » : 300 s avec Fluid en Hobby,
    800 s en Pro.

### D9 — Boxtal : le devis, le prix et la signature ne sont pas acquis · **moyenne**

- **Ce qui casse.** « Devis → réserver le plafond → acheter » (§9.3, étapes 4
  à 7) chez le prestataire classé premier.
- **Ce qui est établi** (code lu) :
  1. **La v3 n'a pas de devis.** Il passe par la v1 (ErnadoO : « the v3 API
     has no quote yet »).
  2. **Les deux sources se contredisent sur la clé de la v1.**
     - La bibliothèque **officielle** `boxtal/php-library` (v1) s'authentifie
       avec l'**identifiant et le mot de passe du compte Boxtal**.
     - ErnadoO (testé sur la vraie API) dit que les clés d'application v3
       servent « en basic auth sur les deux API ».
  3. **La commande v3 ne documente pas son prix** : seul l'identifiant est
     rendu. Le prix vient du devis, pas de ce qui est facturé.
  4. **Les codes d'offre ne s'écrivent pas pareil** : `MONRCpourToi` en devis,
     `MONR-CpourToi` en commande.
  5. **L'encodage de `x-bxt-signature` n'est pas documenté par Boxtal** (ErnadoO
     accepte hexadécimal minuscule, majuscule, base64 et `sha256=`).
- **Le scénario.**
  - Si la v1 exige le mot de passe, VRM devrait **ranger le mot de passe Boxtal
    du vendeur**, ce qui est inacceptable.
  - Sans devis, le plafond « avant l'achat » ne se vérifie pas.
  - Et une signature vérifiée dans le mauvais encodage rejette (412) **tous**
    les webhooks Boxtal : le suivi par webhook ne marche jamais, en silence.
    Seul le calendrier rattrape.
- **La correction.**
  - **Mesurer au bac à sable de Boxtal, avant de classer Boxtal premier** :
    - la clé qui marche sur la cotation v1 ;
    - le prix rendu par la commande ;
    - le format de la signature ;
    - la correspondance entre les codes d'offre.
  - **Jamais de mot de passe dans le coffre.** Si la v1 l'exige, passer
    **Sendcloud premier** : sa v3 donne un devis avec une clé d'API
    (`POST /shipping-options`, `calculate_quotes: true`).
- **Source.**
  - (Code lu) github.com/boxtal/php-library ; github.com/ErnadoO/boxtal (dont
    « Things learnt on the real API »).
  - (Secondaire) l'issue `boxtal/php-library` #12 : un 500 sur le suivi v3.1
    au bac à sable.

### D10 — Sendcloud : un doublon répond 409, le webhook se règle chez le vendeur · **moyenne**

- **Ce qui casse.** L'étape 7 de §9.3 et le tableau §7.3 pour Sendcloud.
- **Le scénario.**
  - Le changelog v3 dit qu'un `external_reference_id` déjà vu fait répondre
    **409, avec l'envoi existant**.
  - La synthèse traite un « refus net » ainsi : réservation **rendue**, retour
    à `a_expedier`.
  - Après une coupure, le second essai (prévu « une fois ») reçoit donc 409, lu
    comme un refus. **Le bordereau déjà payé est oublié** : le suivi n'est
    jamais déclaré à eBay, et l'essai suivant reprend 409.
- **Les corrections.**
  1. Un 409 Sendcloud qui porte l'envoi existant = **« déjà acheté »**. On le
     lit, puis on passe à l'étape 8. La relecture par
     `external_reference_id` est documentée.
  2. Le webhook Sendcloud se règle **dans les réglages de l'intégration, chez
     le vendeur** (`webhook_url`). Il est signé avec la clé secrète de
     l'intégration (ou une clé de signature). VRM **ne crée pas**
     l'abonnement avec un secret tiré par lui : `coffreposer` (§8.3) n'est
     vrai que pour Boxtal. C'est un geste de plus pour le vendeur (coller
     l'adresse `/api/transporteur/{k}`).
  3. Le devis : `fetch-shipping-options` est **déprécié depuis le 14 janvier
     2026**. Il faut `POST /shipping-options` avec `calculate_quotes`.
  4. **Une piste que personne n'a vue** :
     - Sendcloud sait suivre un **colis acheté ailleurs**
       (`POST /parcels/tracking`, à partir du transporteur et du n° de suivi).
     - Ça pourrait suivre un Mondial Relay acheté dans eBay, le trou de §10.1.
     - [à vérifier] : les transporteurs couverts, le plan Sendcloud exigé, et
       la politique de confidentialité.
- **Source.** (Extrait officiel) sendcloud.dev : changelog v3, « Retrieve
  shipments », webhooks, « shipping options and quotes », « create an external
  parcel for tracking » ; support Sendcloud FAQ (idempotence).

### D11 — La valeur `INELIGIBLE` n'existe pas dans l'API qu'utilise l'agent · **basse**

- **Ce qui casse.** La branche `authentification` (§6.1 : « présent et ≠
  `INELIGIBLE` »), et le banc qui la servirait.
- **Le scénario.**
  - L'API **Fulfillment** (celle de `getOrder`) rend `PENDING`, `PASSED`,
    `FAILED` et `PASSED_WITH_EXCEPTION`.
  - `INELIGIBLE` vient de l'API **Buy Order**, celle des acheteurs.
  - La règle ne casse rien (la valeur n'arrive jamais). Mais un audit qui
    servirait `INELIGIBLE` mesurerait une forme qui n'existe pas (§6.3 du
    dossier).
- **La correction.**
  - « `program.authenticityVerification` présent ⇒ branche authentification ».
  - `FAILED` ⇒ « la paire revient », avec la raison
    (`AuthenticityVerificationReasonEnum`).
- **Source.** (Extrait officiel) `sel:AuthenticityVerificationStatusEnum` ;
  `gct:AuthenticityVerificationProgram` (Buy).

### D12 — Post-Order : des méthodes ont été retirées en janvier-février 2026, et son quota n'est pas compté · **basse**

- **Ce qui casse.** Les chantiers 13 (`apresvente`) et §14.
- **Ce qui a été retiré.**
  - Le **20 janvier 2026** : Create et Close Inquiry, Confirm Inquiry Refund,
    Create Return Draft, Cancel Return Request, Check Return Eligibility…
  - Le **2 février 2026** : Get Return Estimate, Get Return Shipping Label,
    Check Inquiry Eligibility…
- **Ce qui n'est pas compté.** La spec `litiges` n'utilise que des
  **recherches** (`…/search`) : elles sont à revérifier une par une. Et la
  tâche `apresvente`, toutes les 6 h avec 3 recherches pour 1 300 comptes,
  fait ~15 600 appels par jour, sans quota connu.
- **La correction.**
  - Revérifier chaque route Post-Order contre la page des retraits avant le
    chantier 13.
  - Ajouter son quota au budget (§14) [à vérifier].
  - Préférer les notifications quand un sujet existe.
- **Source.** (Extrait officiel) Post-Order API release notes 2.8.0.

### D13 — Les adresses de notification : le jeton, le défi, et une identité plus simple · **basse**

- **Le jeton.** `abonnernotif` « avec son jeton » (§8.3) n'est qu'à moitié
  vrai :
  - `createDestination` se fait avec un **jeton d'application** ;
  - seul `createSubscription` prend le jeton **du compte**, avec le droit
    `commerce.notification.subscription` (absent aujourd'hui : il faut la
    reconnexion `v2`).
- **Le défi de l'adresse.** Il se calcule par SHA-256 de `challenge_code` + le
  jeton de vérification + **l'adresse exacte** que l'on a déclarée.
  - Avec une adresse par compte (`/api/ebay-notif/{k}`, réécrite vers
    `compte.js`), l'adresse doit être **reconstruite depuis une base fixe**
    (`https://vrm.center/api/ebay-notif/` + `k`).
  - Jamais depuis `req.url` réécrite, ni depuis l'en-tête `Host`. Sinon le défi
    échoue et l'adresse n'est jamais créée.
- **Une identité plus simple.**
  - D'après le contrat publié, la notification `ORDER_CONFIRMATION` porte, par
    ligne, `orderLineItemId`, `listingId` et `quantity` (extrait officiel du
    contrat `order_confirmation.yaml`).
  - Le **`listingId` est une identité** : VRM sait à quel compte appartient
    chaque annonce (son miroir d'annonces).
  - ⇒ Une seule adresse pour l'installation, avec un routage par `listingId`,
    évite de dépendre d'un plafond d'adresses non documenté.
  - Une annonce encore absente du miroir retombe sur la veille, comme le repli
    déjà prévu.
- **Source.**
  - (Extrait officiel) overview de la Notification API, `createDestination`,
    `createSubscription`, contrat `order_confirmation.yaml`.
  - (Code lu) PR `nexus-commerce` #382 : sujet « utilisateur », droit
    `commerce.notification.subscription`, erreur 195011.

### D14 — L'esquisse SQL ignorerait tous les battements · **basse**, mais bloquante

- **Ce qui casse.** Le battement, au tout premier jour.
- **Le scénario.**
  - §5.1 déclare `dernier_battement timestamptz`, qui peut être vide et n'a pas
    de valeur par défaut.
  - L'anti-rafale de §4.3 compare `where id = 1 and dernier_battement < now() -
    interval '20 seconds'`. En SQL, `NULL < …` ne vaut ni vrai ni faux : aucune
    ligne n'est rendue.
  - ⇒ **Chaque battement répond `{ignore:true}`, pour toujours.**
  - Pareil, `update … where id = 1` ne touche rien si la ligne `id = 1` n'a
    jamais été insérée.
- **La correction.** La migration insère la ligne `id = 1` avec `'-infinity'`,
  ou bien on compare `coalesce(dernier_battement, '-infinity')`. Le contrôle
  doit aller dans `audit-agent-sql.cjs`.
- **Source.** [mesuré] l'esquisse §4.3 et §5.1 de la synthèse.

### D15 — « Un appel en vol par compte eBay » n'est pas garanti entre deux battements · **basse**

- **Le scénario.** `vrm_agent_prendre` ne garde qu'une tâche par `groupe`
  **parmi les tâches dues et libres**.
  - Une tâche du même compte peut encore tourner : un battement précédent qui a
    dépassé ses 25 s, sur un appel eBay lent.
  - Celle-là n'est pas comptée ⇒ **deux appels en vol** sur le même compte.
- **La correction.** Ajouter `and not exists (select 1 from vrm_agent_file f2
  where f2.groupe = f.groupe and f2.bail_jusqua > p_maintenant)`. L'audit doit
  servir une tâche en vol **dans un autre battement**, pas seulement deux
  sessions qui prennent en même temps.
- **Source.** [mesuré] §5.3 et §7.1 de la synthèse.

### D16 — Les numéros cités sont périmés depuis la migration 013 · **info, pour Julien**

- La migration a été appliquée le 11 octobre à 14 h 58 UTC [mesuré :
  `main.vrm_numerotation.appliqueLe`].
- La table des renumérotations dit `553 → 1` et `559 → 10`.
- La table des annonces eBay de la migration dit `128127336988 → {553: 1}` et
  `128086452103 → {559: 10}`.
- ⇒ « Retire la N°553 » (§0 et §16, geste 1) doit dire **« N°1 (ancienne
  553) »**. Les exemples du chantier 1 et le scénario 21 du banc de vie doivent
  passer par `numeroExterne` et la table des annonces eBay de la migration, et
  non plus par un SKU lu tel quel.

### D17 — Une source mal attribuée · **info**

- `infra.md` cite **KB 1362** pour le quota Trading (5 000 par jour). Or cet
  article parle de l'API **Shopping**.
- Le chiffre tient, mais par des réponses du support eBay sur le forum
  (secondaire). La page « API call limits » n'a pas pu être lue.

### D18 — Le « aucun cron Vercel » est plus strict que la règle · **info**

- La doc officielle des crons (mise à jour le 28 janvier 2026) permet en Hobby
  **jusqu'à 100 crons par projet**, chacun **une fois par jour**, à ± 59 min.
  Une expression plus fréquente fait toujours échouer le déploiement.
- ⇒ Un second cron quotidien (secours du soir, ou bilan du dimanche) est
  **permis**.
- Garder la prudence du dossier quand même : un cron refusé bloque **tous** les
  déploiements. Il faut l'essayer sur un déploiement qui ne soit pas la
  production avant de toucher `main`.
- **Source.** (Extrait officiel) vercel.com/docs/cron-jobs/usage-and-pricing.

---

## 2. Ce qui tient (revérifié ce soir)

| point de la synthèse | verdict | source |
|---|---|---|
| `ORDER_CONFIRMATION` = l'acheteur a payé, notification **au vendeur** ; version 1.6.6, 1ᵉʳ décembre 2025 ; abonnement « utilisateur » avec `commerce.notification.subscription` | ✅ | extrait officiel (release notes, overview, contrat yaml) ; code lu (PR #382) |
| `ITEM_MARKED_SHIPPED` = pour l'**acheteur** (1.6.7, 12 décembre 2025) | ✅ la synthèse a raison de l'écarter | extrait officiel |
| `get_shipping_carriers` / `get_shipping_services` (Metadata API) | ✅ version 1.12.0, 30 octobre 2025 ; quota Metadata 5 000 par jour : une lecture par mois suffit | extrait officiel |
| Fulfillment 100 000 appels par jour (commandes) | ✅ | extrait officiel |
| Jetons : refresh 50 000 · autorisation 10 000 · application 1 000 par jour | ✅ | extrait officiel (« OAuth rate limits ») |
| `getRateLimits` couvre aussi Trading (jeton d'application) | ✅ | extrait officiel |
| Signatures numériques UE : Finances (toutes), `issueRefund`, `GetAccount`, quelques Post-Order ⇒ **pas** `createShippingFulfillment` ; I14 (solde) passe par Finances, donc signé | ✅ | extrait officiel (« Digital Signatures for APIs ») |
| `AddMemberMessageAAQToPartner` existe toujours ; la Message API REST est l'alternative (4ᵉ trimestre 2025) ; aucune date de retrait trouvée | ✅, mais à surveiller (page des retraits non lue) | extrait officiel (newsletter T4 2025) |
| Particuliers eBay.fr : plus de frais de vente ; solde eBay versé **à la demande** depuis le 1ᵉʳ septembre 2026 | ✅ (I14) | aide eBay.fr (extrait) ; presse (secondaire) |
| Sendcloud : idempotence par `external_reference_id` | ✅, avec la réserve du 409 (D10) | extrait officiel |
| Boxtal : prélèvement SEPA différé obligatoire ; `DOCUMENT_CREATED` / `TRACKING_CHANGED` ; 2 s pour répondre, puis 10 essais en 24 h ; `422` juste après la commande ; 30 points relais au plus | ✅ | code lu (ErnadoO) |
| `pg_net` : délai par défaut **2 000 ms** ; ~200 requêtes par seconde ; réponses gardées 6 h | ✅ | doc lue (Supabase) |
| `pg_cron` 1.6.4 et `pg_net` 0.20.0 disponibles, pas installés ; `vrm_reglages(cle, valeur)` existe (l'esquisse SQL vise les bonnes colonnes) | ✅ | mesuré |
| Vercel Hobby : « non commercial », 1 h de journaux, un cron par jour | ✅ | mesuré + extrait officiel |
| Plafond de 12 fonctions en Hobby | ✅ encore signalé en mars 2026 (la doc dit désormais « selon le framework ») | secondaire (forum Vercel) |
| `GetOrders` Trading accepte les deux formats de n° de commande en entrée | ✅ (formats acceptés depuis 2019-2020) ; que ce soit exactement l'`orderId` REST : [à vérifier], très probable | extrait officiel (KB 1788, `OrderIDArrayType`) |

---

## 3. Ce qu'aucun banc ne prouvera, et comment le mesurer sans risque

Les bancs prouvent **la logique** (faux eBay, faux Boxtal, faux Sendcloud,
Postgres jetable). Ils ne prouvent jamais **la forme réelle**. Voici la liste
complète, avec le geste le moins risqué pour chaque point. La synthèse (§19) en
avait une partie ; ce qui est **en gras** manquait.

| à mesurer | le geste le moins risqué |
|---|---|
| `ShippingLabelPolicy` sur **tes** commandes (D5) | une lecture `GetOrders` au niveau 1455 sur ta première vente eBay. **Ça décide du chantier 11** |
| `ORDER_CONFIRMATION` pour un vendeur eBay.fr : délai, champs, signature sur le corps brut | un abonnement, puis **`POST /subscription/{id}/test`** : on voit une vraie notification **sans attendre une vente** |
| **ce qui déclenche `MARKED_DOWN` et comment on en sort** (D3) | `getDestination` une fois par jour, et noter le statut |
| `getShippingFulfillments` après une étiquette achetée dans eBay : la forme du n° Mondial Relay, et le code transporteur | ta première vente eBay (lecture seule) |
| les codes de `get_shipping_carriers` pour `EBAY_FR` | une lecture, au premier branchement |
| **Media API : eBay lit-il une adresse Vinted signée ?** (D1) | un `createImageFromUrl` sur une photo d'une annonce, sans rien publier |
| **Boxtal : la clé de la v1, le prix de la commande, l'encodage de la signature, les codes d'offre** (D9) | le **bac à sable** de Boxtal (rien n'est facturé) |
| **Sendcloud : le 409 sur un doublon** (D10) | le compte d'essai |
| La Poste « Suivi v2 » : le quota, le code « au point de retrait », la date limite de retrait | une clé gratuite, sur un n° Colissimo déjà livré |
| `AddMemberMessageAAQToPartner` : ce que voit l'acheteur, la longueur maximale | un seul message, sur ta prochaine vente, avec ton clic |
| **Fluid compute et la durée réelle d'une fonction** (D8) | Vercel → Settings → Functions, et un `maxDuration` posé |
| **la consommation Vercel du battement** (D7) | l'onglet « Usage », une semaine après l'allumage |
| **l'heure de remise à zéro du quota Trading** | `getRateLimits` (champ `reset`) |
| **les routes Post-Order encore vivantes sur eBay.fr** (D12) | une recherche en lecture seule |
| la fenêtre de double vente après le chantier 1 | la requête de §2.2 de la synthèse, relancée |

---

## 4. Sources

**Mesuré ce soir.**
- Base `lgonxzrzjcqthjtbdpzo`, propriétaire `74eea6e7-…` :
  - `pg_available_extensions` (`pg_cron` 1.6.4, `pg_net` 0.20.0, `pgmq`,
    `pgsodium` : pas installés ; `supabase_vault` 0.3.1 installé) ;
  - colonnes de `vrm_reglages` (`cle`, `valeur`) et d'`abonnements` ;
  - `main.vrm_numerotation` : version, coupure, `appliqueLe`, renumérotations
    `553` et `559`, table des annonces eBay.
- Vercel : équipe `team_bhqBIM90w8Awkmhb2KFgOJ6Y`, projet `cancale-v67`
  (domaines, protection, aucun `resourceConfig` rendu).
- Code `wf_30feaf2f-334-8` : `api/ebay.js` l. 146 (niveau 1149) et l. 629-636
  (livraison gérée par eBay) ; `api/_lib/ebay.js` l. 22-26 (droits demandés).

**Documentation lue** (outil officiel Supabase) :
[pg_net](https://supabase.com/docs/guides/database/extensions/pg_net).

**Extraits officiels** (moteur de recherche ; pages bloquées d'ici) :
- **eBay — notifications** :
  - [Notification API release notes](https://developer.ebay.com/api-docs/commerce/notification/release-notes.html) (1.6.5 `BUYER_QUESTION`/`NEW_MESSAGE`, 1.6.6 `ORDER_CONFIRMATION`, 1.6.7 `ITEM_MARKED_SHIPPED`) ;
  - [contrat `order_confirmation.yaml`](https://developer.ebay.com/api-docs/master/commerce/notification/asyncapi/order_confirmation.yaml) ;
  - [Notification API overview](https://edp.ebay.com/api-docs/commerce/notification/overview.html) ;
  - [`DestinationStatusEnum`](https://developer.ebay.com/api-docs/sell/notification/types/api:DestinationStatusEnum) ;
  - [`updateDestination`](https://developer.ebay.com/api-docs/commerce/notification/resources/destination/methods/updateDestination) ;
  - [`getDestinations`](https://developer.ebay.com/api-docs/commerce/notification/resources/destination/methods/getDestinations) ;
  - [`test`](https://developer.ebay.com/api-docs/commerce/notification/resources/subscription/methods/test).
- **eBay — Trading** :
  - [Release Notes Trading (1455, `ShippingLabelPolicy`)](https://developer.ebay.com/devzone/xml/docs/releasenotes.html) ;
  - [GetOrders](https://developer.ebay.com/devzone/xml/docs/reference/ebay/getorders.html) ;
  - [UploadSiteHostedPictures (décommission le 30 septembre 2026)](https://developer.ebay.com/devzone/xml/docs/reference/ebay/UploadSiteHostedPictures.html) ;
  - [KB 1788 (n° de commande)](https://developer.ebay.com/support/kb-article?KBid=1788) ;
  - [KB 1362 (Shopping, pas Trading)](https://developer.ebay.com/support/kb-article?KBid=1362).
- **eBay — autres API** :
  - [Media API overview](https://developer.ebay.com/api-docs/commerce/media/overview.html) ;
  - [Metadata API release notes (1.12.0)](https://developer.ebay.com/develop/api/metadata-api/release-notes) ;
  - [API call limits](https://developer.ebay.com/develop/get-started/api-call-limits) ;
  - [OAuth rate limits](https://developer.ebay.com/api-docs/static/oauth-rate-limits.html) ;
  - [getRateLimits](https://developer.ebay.com/api-docs/developer/analytics/resources/rate_limit/methods/getRateLimits) ;
  - [Digital Signatures for APIs](https://developer.ebay.com/develop/guides/digital-signatures-for-apis) ;
  - [Newsletter T4 2025 (Message API)](https://developer.ebay.com/updates/newsletter/q4_2025) ;
  - [AuthenticityVerificationStatusEnum (Fulfillment)](https://developer.ebay.com/api-docs/sell/fulfillment/types/sel:AuthenticityVerificationStatusEnum) ;
  - [AuthenticityVerificationProgram (Buy)](https://developer.ebay.com/api-docs/buy/order/types/gct:AuthenticityVerificationProgram) ;
  - [Post-Order release notes](https://developer.ebay.com/develop/api/post-order-api/release-notes).
- **eBay.fr — aide** : [commencer à recevoir des paiements](https://www.ebay.fr/help/selling/getting-paid/commencer-recevoir-des-paiements-sur-ebay?id=4795).
- **Sendcloud** :
  - [changelog v3](https://sendcloud.dev/api/v3/changelog) ;
  - [Retrieve shipments](https://sendcloud.dev/api/v3/shipments/retrieve-shipments) ;
  - [webhooks v3](https://sendcloud.dev/api/v3/webhooks) ;
  - [shipping options and quotes](https://sendcloud.dev/docs/shipments/shipping-options-and-quotes) ;
  - [external parcel for tracking](https://sendcloud.dev/docs/parcel-tracking/create-an-external-tracking-parcel) ;
  - [FAQ](https://support.sendcloud.com/hc/en-us/articles/7789894544276-Sendcloud-APIs-FAQ).
- **Vercel** :
  - [Hobby plan](https://vercel.com/docs/plans/hobby) ;
  - [Cron jobs — usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) ;
  - [Limits](https://vercel.com/docs/limits).

**Code lu** :
- [boxtal/php-library](https://github.com/boxtal/php-library) (v1 : identifiant et mot de passe) ;
- [ErnadoO/boxtal](https://github.com/ErnadoO/boxtal) (devis v1, clés, 422, signature, points relais) ;
- [nexus-commerce PR #382](https://github.com/awaissulhry/nexus-commerce/pull/382) (abonnement `ORDER_CONFIRMATION` par compte).

**Secondaire** :
- [forum Vercel, pause Hobby](https://community.vercel.com/t/hobby-plan-account-paused-unexpected-high-cpu-usage-on-inactive-portfolio-project/31486) ;
- [forum Vercel, 12 fonctions (mars 2026)](https://community.vercel.com/t/vercel-deployment-fails-with-12-serverless-functions-limit-error-despite-having-11-functions/35397) ;
- [forum eBay, quota Trading](https://community.ebay.com/t5/eBay-APIs-Talk-to-your-fellow/About-API-limit-calls/m-p/34673055) ;
- [issue boxtal/php-library #12](https://github.com/boxtal/php-library/issues/12) ;
- [eBay Inc. (presse, septembre 2026)](https://www.ebayinc.com/stories/press-room/fr/ebay-supprime-les-frais-de-vente/) ;
- [justgeek](https://www.justgeek.fr/ebay-supprime-frais-vente-particuliers-157677/).
