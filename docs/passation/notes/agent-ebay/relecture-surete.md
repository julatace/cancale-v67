# Relecture adverse de la synthèse « agent eBay autonome » — lentille SÛRETÉ

**Relu :** `synthese.md` (11 octobre, fin d'après-midi), avec `bordereaux.md`,
`suivi.md`, `infra.md`, `etat.md` et la feuille de route du 9 octobre.
**Rédigé le :** 11 octobre 2026, au soir.
**Le but :** faire tomber la synthèse là où elle peut coûter de l'argent, abîmer
le compte eBay, vendre deux fois une paire, laisser fuir des données
d'acheteurs, mélanger deux vendeurs, ou agir sur un « pas su ».

**D'où vient chaque fait :**

| marque | sens |
|---|---|
| **[mesuré ici]** | lu par moi ce soir dans sa base, en lecture seule et projetée (aucun jeton, aucun nom, aucune adresse d'acheteur), ou dans le code de `origin/main` |
| **[synthèse §x]** | ce que dit la synthèse, à l'endroit cité |
| **(extrait officiel)** | extrait d'une page officielle, renvoyé par un moteur de recherche ; la page n'a pas été lue en entier |
| **(secondaire)** | forum, blog, presse |
| **[à vérifier]** | non établi |

**Aucun appel** à eBay, à un transporteur ou à Vinted. **Aucune écriture**, sauf
ce fichier.

---

## 0. En une page

**La synthèse tient sur l'essentiel.** Ce qui est solide, je l'ai vérifié et je
le dis en §3 : la voie « eBay » par défaut, le serveur qui relit chez eBay avant
de dépenser, les tables où le vendeur ne peut que lire, le verrou et la version
dans la même instruction SQL, la réservation d'argent en une instruction, les
sonnettes qui ne portent aucune donnée.

**Mais elle a 28 défauts de sûreté. Quatre sont critiques**, et tous les quatre
sont sur le chemin de l'argent et du compte eBay :

1. **L'agent achète un bordereau et déclare l'envoi sans vérifier que la paire
   n'est pas déjà vendue ailleurs.** C'est la N°553 à l'envers : la fenêtre de
   double vente mesurée par la synthèse elle-même (des heures, parfois jamais) est
   ignorée au moment d'acheter.
2. **L'envoi est déclaré à eBay « dès l'achat », avant que le colis existe.**
   eBay dit alors « expédié » à l'acheteur, et ferme son droit de demander
   l'annulation.
3. **Boxtal ne rend pas le numéro de suivi quand on commande** (seulement son
   propre identifiant). La synthèse déclare un « suivi » rangé à la commande :
   au mieux l'étape n'est jamais atteinte, au pire VRM déclare à eBay un numéro
   qui n'est pas un suivi.
4. **Le second essai automatique chez Sendcloud repose sur une idempotence que
   personne n'a lue.** Si elle n'existe pas, c'est un second bordereau payé.

**Et un fait nouveau, mesuré ce soir, change une partie de la synthèse :** la
**migration 013 (anciens numéros en B) a été appliquée aujourd'hui à 14 h 58
UTC**, après l'écriture de la synthèse. `VRM-553` vaut désormais **N°1** et
`VRM-559` vaut **N°10**. La synthèse prévoit de **recopier `numeroExterne` de
l'app vers le serveur** : la version de l'app lit le marqueur dans le navigateur,
donc la copie serveur lirait les SKU **bruts**. Le jour où la nouvelle série
atteindra 559, l'annonce `VRM-559` (qui est la N°10) désignerait une autre paire
(défaut S6).

**Ce que je recommande avant d'écrire une ligne du chantier 11 (bordereaux
achetés par VRM)** : corriger S1 à S4, S6, S7 et S9. Les chantiers 0 à 10 sont
sans argent et peuvent avancer, à condition d'intégrer S5, S6, S8, S11 et S14.

---

## 1. Les défauts, en un tableau

| # | gravité | domaine | le défaut, en une ligne |
|---|---|---|---|
| S1 | **critique** | double vente · argent | acheter le bordereau, déclarer l'envoi, baisser le prix ou faire une offre sans vérifier la double vente ni le gel |
| S2 | **critique** | compte eBay | déclarer l'envoi « dès l'achat » : « expédié » sans colis, annulation fermée à l'acheteur |
| S3 | **critique** | compte eBay · suivi faux | Boxtal ne rend pas le n° de suivi à la commande ; la synthèse le suppose |
| S4 | **critique** | argent | second essai Sendcloud fondé sur une idempotence non établie |
| S5 | haute | multi-vendeurs · argent | le même compte eBay chez deux vendeurs VRM : deux agents, deux bordereaux, deux messages |
| S6 | haute | identité | 013 appliquée ce soir ; `numeroExterne` recopié sans marqueur ; marqueur « pas su » lu « aucune coupure » |
| S7 | haute | données · argent · compte | une faille d'affichage ou une session volée pilote tout l'agent (clés du prestataire, textes, plafonds) |
| S8 | haute | compte eBay (tous les vendeurs) | la suppression de compte dépendrait de la base : 3 jours de panne ⇒ clés eBay de VRM désactivées |
| S9 | haute | argent | les plafonds comptent le devis, pas l'argent prélevé ; aucun garde-fou extérieur au prélèvement différé |
| S10 | moyenne-haute | compte eBay | le contrôle des messages laisse passer « retrouvez-moi sur Vinted » |
| S11 | moyenne | double vente · pas su | le gel tombe tout seul au bout de 72 h, même sans preuve |
| S12 | moyenne | consentement · double vente | le retrait automatique change de portée sans redemander ; contradiction sur « même N° sur deux annonces eBay » |
| S13 | moyenne | double vente | la preuve par bordereau : 4 bordereaux sur 76 sont des ventes remboursées |
| S14 | moyenne | colis | une vente payée non postée, trouvée au branchement d'un compte, devient muette |
| S15 | moyenne | argent · course | aucun délai par appel ; un achat réussi peut être perdu ; le chemin « clic » échappe au verrou |
| S16 | moyenne | argent | Boxtal incertain : « il n'y en a pas, réessaie » rachète sur la foi d'un écran |
| S17 | moyenne | argent · pas su | annulation automatique d'un bordereau sur un « aucun scan » qui peut être un « pas su » |
| S18 | moyenne | suivi faux | le témoin email « au même n° » peut être un vieux colis (n° Mondial Relay courts, une ligne par n°) |
| S19 | moyenne | argent · colis perdu | international, retrait en magasin, plusieurs paires : la voie VRM s'applique quand même |
| S20 | moyenne | argent · données | abonnement coupé : le vendeur ne voit plus ce qui a été acheté en son nom |
| S21 | moyenne | pas su qui agit | `AUTHORIZATION_REVOCATION` traitée comme une donnée, pas comme une sonnette |
| S22 | moyenne | données | le jeton eBay déplacé dans le coffre reste valable là où il a fuité |
| S23 | moyenne | données | les PDF de bordereaux eBay portent nom et adresse, sans durée de vie |
| S24 | basse | course · quota | « un appel en vol par compte eBay » n'est garanti qu'à l'intérieur d'un seul battement |
| S25 | basse | idempotence | `vrm_agent_vus` purgé à 14 jours mélange sonnettes et « déjà fait » |
| S26 | basse | données | journal « jamais réécrit » contre anonymisation exigée par eBay |
| S27 | basse | honnêteté | trois promesses fausses (« se défait d'un clic », « au centime », « N°553 ») |
| S28 | moyenne | double vente | la notification « Vendu sur eBay » se tait quand VRM ne sait pas si la paire est encore sur Vinted |

---

## 2. Le détail, défaut par défaut

### S1 — critique — L'agent achète, déclare, baisse ou offre sans regarder la double vente

**Ce qui casse.** La liste des entrées requises pour **acheter un bordereau**
[synthèse §7.4] ne contient ni la preuve de vente Vinted ou Leboncoin du N°, ni
le **gel** (« une vente Vinted sans preuve sur ce compte ») que la synthèse invente
pourtant en §6.5. Le gel ne bloque que la **publication** [synthèse §6.5,
« Le gel »]. Même trou pour la baisse de prix automatique (I11) et l'offre
automatique aux observateurs (I16) : ces gestes **accélèrent** une vente eBay, et
aucun ne regarde si la paire est déjà partie ailleurs.

**Le scénario.** Mardi 14 h 02, la N°12 se vend sur eBay. À 13 h 40 elle s'était
vendue sur Vinted, sur `tomj683`, que Chrome n'a pas ouvert depuis la veille. La
synthèse mesure elle-même ce délai : la preuve arrive entre 12 minutes et
46 heures, et jamais pour 2 ventes sur 15 [synthèse §2.2]. À 16 h 03, fin du
délai de grâce : l'agent achète le bordereau, déclare l'envoi à eBay (S2), et
l'acheteur eBay reçoit « votre objet a été expédié ». Julien découvre le soir
qu'il n'a plus la paire. Résultat : un bordereau payé pour rien, une commande
« expédiée » à annuler, et un défaut sur son compte.

**La correction.**
- Ajouter à **toute** décision qui engage (`acheter`, `declarer`, `baisser`,
  `offrir`, `messages` à `payee`) deux entrées **lues** :
  - « N° non prouvé vendu ailleurs » (toutes sources, §6.5) ;
  - « aucun gel sur le compte Vinted d'origine du N° ».
- Prouvé vendu ailleurs ⇒ `a_confirmer` avec « vendue aussi sur Vinted —
  annule une des deux ventes », jamais un achat.
- Gel, ou ventes Vinted du compte d'origine plus vieilles que le délai de grâce
  ⇒ `a_confirmer`.
- Scénario de banc à ajouter : « vente eBay à 14 h 02, vente Vinted du même N° à
  13 h 40 prouvée à 15 h 30 » ⇒ 0 achat, 0 déclaration, 1 notification `double`.
- Mutation à prouver : retirer cette entrée ⇒ 1 achat.

**Sources.** [synthèse §2.2, §6.5, §7.4, §13 I11 et I16].

---

### S2 — critique — Déclarer l'envoi « dès l'achat » ment à eBay et ferme l'annulation à l'acheteur

**Ce qui casse.** « Quand : dès l'achat » [synthèse §9.10]. Le rang 4
`etiquette_prete` déclare tout de suite [§6.1]. Trois effets :
1. **eBay notifie l'acheteur « expédié »** pour un colis qui n'existe pas encore
   [étude `suivi.md` §3.1].
2. **L'acheteur ne peut plus demander l'annulation.** Avec la procédure
   d'annulation simplifiée d'eBay, dès que le vendeur a chargé un suivi ou marqué
   l'objet expédié, l'acheteur n'a plus accès à la demande (extrait officiel,
   annonce communautaire d'eBay). Au Royaume-Uni, en Australie et en Europe, la
   demande est possible **jusqu'à** l'expédition (secondaire). Le délai de grâce
   de 2 h [§9.4] ne couvre donc **pas** la période où l'acheteur peut annuler.
   Bloquer ce droit par un suivi chargé d'avance pousse l'acheteur vers « objet
   non reçu » ou un retour, qui coûtent plus cher au vendeur.
3. **Le suivi n'a aucun scan** si le colis ne part pas (S1, carton introuvable,
   oubli) : c'est un suivi « chargé » mais faux.

**Le scénario.** L'acheteur paie à 14 h 02 et veut annuler à 17 h. À 16 h 03 VRM a
déjà déclaré le suivi : la porte d'annulation est fermée. L'acheteur ouvre une
réclamation ; Julien, qui avait la paire, se retrouve à gérer un litige au lieu
d'une annulation.

**La correction.**
- Déclarer au **premier scan** du transporteur (`pris_en_charge`, lu par
  identité).
- Ou, au plus tard, **le jour de `shipByDate` à 18 h (Paris)** si une étiquette
  existe et qu'aucune annulation n'est demandée. Le suivi compte pour la note
  vendeur s'il est chargé dans le délai, pas s'il est chargé tôt.
- Relire `cancelRequests` juste avant de déclarer.
- Ce choix est une **décision de Julien** (déclarer tôt bloque aussi les
  annulations « de confort ») ; la synthèse ne le présente pas.

**Sources.** (extrait officiel) [« We're simplifying order cancellations »,
communauté eBay](https://community.ebay.com/forum/announcements-57928/topic/were-simplifying-order-cancellations-6873/) ;
(secondaire) [valueaddedresource — annulations UK/AU](https://valueaddedresource.net/ebay-expands-cancellation-policy-uk-au) ;
[synthèse §6.1, §9.4, §9.10].

---

### S3 — critique — Boxtal ne rend pas le numéro de suivi à la commande

**Ce qui casse.** L'étape 7 dit : « Succès ⇒ id, suivi, transporteur rangés »
[synthèse §9.3]. Le rang 4 exige « n° de suivi + transporteur + PDF » [§6.1].
Or la documentation de Boxtal v3 ne décrit, dans la réponse de
`POST /v3.1/shipping-order`, que **la référence Boxtal** (`shippingOrder.id`). Le
suivi et les documents s'obtiennent en **s'abonnant** aux évènements
(`TRACKING_CHANGED`, `DOCUMENT_CREATED`) (extrait officiel). Le numéro du
transporteur arrive donc plus tard, peut-être après le premier scan.

**Ce que ça donne.**
- Soit un code qui range `shippingOrder.id` dans `suivi` et le **déclare à eBay**
  (`createShippingFulfillment`) : un suivi **faux**. eBay ne peut pas le
  valider, l'acheteur ne peut pas suivre, et la mesure « suivi valide chargé »
  tombe.
- Soit la commande reste bloquée entre le rang 3 et le rang 4 sans que la
  machine à états le prévoie : pas d'étape « acheté, suivi attendu », donc pas de
  relance, pas de délai, pas d'alerte.

**La correction.**
- Ajouter un état `etiquette_achetee_suivi_attendu`, distinct de
  `etiquette_prete`.
- Le suivi n'est rangé que s'il vient d'un évènement ou d'une lecture du
  prestataire **pour cet envoi**, et qu'il a **la forme** du transporteur
  (Mondial Relay 8 chiffres, Colissimo 13 caractères…).
- Jamais l'identifiant du prestataire comme suivi.
- Même contrôle pour le suivi **tapé** (`expedier`) : forme du transporteur
  vérifiée, et si possible une lecture La Poste qui rend `DR1` avant de
  déclarer.
- Banc : un faux Boxtal **à la forme documentée** (pas de suivi à la commande) ;
  mutation « id Boxtal rangé comme suivi » ⇒ rouge.

**Sources.** (extrait officiel) [Boxtal — order API v3](https://developer.boxtal.com/fr/en/apiv3/guide/order-api-v3),
[tracking events v3](https://developer.boxtal.com/fr/en/apiv3/guide/tracking-events-api-v3) ;
[synthèse §6.1, §9.3].

---

### S4 — critique — Le second essai Sendcloud repose sur une idempotence non établie

**Ce qui casse.** Le tableau §7.3 dit pour Sendcloud : « `external_reference_id`
(idempotence annoncée, extrait officiel) — relire par référence, ou renvoyer le
**même** `POST` — refait seul : **oui, une fois** ». Le scénario de vie n°5
attend « 1 seul envoi chez le faux Sendcloud ».
- Je n'ai trouvé **aucune** page Sendcloud qui décrive `external_reference_id`
  ni son unicité.
- Le seul mécanisme idempotent trouvé est l'**« upsert » de l'API
  d'intégration v2**, sur `external_order_id` et `external_shipment_id`. Il porte
  sur des **commandes** à expédier, pas sur la création d'une étiquette.
- La source citée par `infra.md` est un article du **support**, pas la référence
  de l'API.

**Le scénario.** Coupure réseau juste après le `POST` de création (une étiquette
Sendcloud est créée et facturée). L'agent « renvoie le même `POST` ». Si
Sendcloud ne dédoublonne pas, c'est un **second bordereau payé**. Le faux
Sendcloud du banc, écrit d'après la synthèse, dédoublonnera, et le banc sera
**vert sur le défaut** : un banc qui sert une forme inventée mesure une fiction
(§6.3 du dossier).

**La correction.**
- Sendcloud est traité **comme Boxtal** (`idempotentParRef: false`) tant que le
  **bac à sable** n'a pas montré que deux `POST` identiques donnent un seul colis.
- Un incertain ⇒ arrêt et question, jamais un second `POST`.
- Le faux prestataire du banc ne dédoublonne **que** si la mesure l'a prouvé.

**Sources.** (extrait officiel) [Sendcloud v2 — create a list of shipments (upsert sur `external_order_id`/`external_shipment_id`)](https://sendcloud.dev/api/v2/integrations/create-a-list-of-shipments) ;
aucune page trouvée pour `external_reference_id` ; [synthèse §7.3, §15.2 scénario 5] ; [`infra.md` §4.1].

---

### S5 — haute — Le même compte eBay chez deux vendeurs VRM

**Ce qui casse.** Tous les verrous sont **par vendeur** : bail par `(owner, cle)`,
« ≤ 1 par groupe » dans `vrm_agent_prendre`, version par
`(owner, plateforme, compte, commande)`, mémos par `owner`, plafonds par
`owner` [synthèse §5.1, §5.3]. Rien n'empêche deux comptes VRM de relier **le
même** compte eBay : le retour de consentement range les jetons chez celui qui
a demandé.

**C'est déjà arrivé côté Vinted.** **1 compte Vinted sur 7** est enregistré chez
**deux** propriétaires VRM aujourd'hui [mesuré ici, `vinted_accounts`]. Le
dossier cite aussi `angeled92` et les comptes d'essai du 2 octobre.

**Le scénario.** Julien relie son eBay à son compte VRM d'essai pour voir ce que
voit un abonné. Une vente arrive. **Deux** agents la voient, et à 16 h 03 (même
heure de paiement, même délai de grâce) les deux relisent
`getShippingFulfillments` : vide. Les deux achètent, avec deux comptes Boxtal ou
le même. La référence `vrm-{orderId}` ne protège pas : deux applications Boxtal
différentes ne se voient pas. Ensuite : deux messages « merci », deux
évaluations tentées, deux retraits automatiques.

**La correction.**
- Un **registre serveur des titulaires** : `vrm_ebay_titulaires(ebay_user_id
  unique, owner)`.
- Un compte eBay ne peut être **actif dans l'agent** que chez **un** vendeur.
  Le second voit « ce compte eBay est déjà relié à un autre compte VRM ».
- Les clés d'idempotence des gestes qui engagent sont **globales** par commande
  eBay (`achat:{orderId}`, `msg:{orderId}:{type}`, `eval:{orderLineItemId}`), sous
  un propriétaire neutre, comme les quotas.
- Banc : deux vendeurs, un même compte eBay ⇒ 1 achat, 1 message.

**Sources.** [mesuré ici] `select vinted_user_id, count(distinct owner) from
vinted_accounts` ⇒ 1 sur 7 ; [synthèse §5.1, §5.3, §7.1] ; CLAUDE.md (essais du
2 octobre).

---

### S6 — haute — La numérotation 013 est appliquée depuis ce soir, et la synthèse lit les SKU sans le marqueur

**Ce qui a changé, mesuré ce soir.** Le marqueur `main.vrm_numerotation` existe :
- version 2, coupure au **9 octobre 00:00 UTC**, appliquée le **11 octobre à
  14:58:07 UTC** ;
- 401 numéros en B, 24 nouveaux numéros ;
- `renum` : **553 → 1**, **559 → 10** ;
- `ebayAnnonces` = `{ "128086452103": {"559":"10"}, "128127336988": {"553":"1"} }`.

La synthèse, écrite avant, parle encore de « N°553 » et de « N°559 ».

**Ce qui casse.**
1. **La recopie du mauvais `numeroExterne`.** La synthèse met `numeroExterne`
   dans la recopie exacte de l'app vers `api/_lib/ebay-regle.js` [synthèse
   §8.4]. La version de l'app lit le marqueur par des fonctions **du navigateur**
   (`archiveNumeros()`, `marqueurNumerotation()`, `coupureNumerotation()`)
   [code lu : `src/App.jsx` l. 31646-31655 sur `main`]. Recopiée telle quelle,
   elle ne verrait **aucun** marqueur côté serveur, donc rendrait le numéro
   **brut**.
2. **Le marqueur « pas su ».** La version **serveur**
   (`api/_lib/numerotation.js`) rend aussi le numéro brut quand le marqueur vaut
   `undefined` (« pas su ») : `archiveDe(undefined)` vaut `''` [code lu]. Le
   retrait d'aujourd'hui s'en protège en répondant 503 sur un marqueur
   illisible [code lu : `api/ebay.js` l. 821-829 sur `main`]. La synthèse ne
   reporte cette garde **nulle part** ailleurs : tampon, liste de ramassage,
   notification, doubles, achat.
3. **Le mauvais identifiant.** Pour une **commande**, il faut passer l'identifiant
   **de l'annonce** (`legacyItemId`) et la date de la commande, comme le fait
   `numLigneEbay` dans l'app [code lu : `src/App.jsx` l. 31657], pas l'`orderId`.
   La synthèse dit seulement « lu par `numeroExterne` » [§3.3, §6.2 invariant 5].

**Le scénario.** Dans quelques mois, la nouvelle série atteint 559. La N°10 (SKU
`VRM-559`, annonce `128086452103`) se vend sur eBay. Avec une recopie qui lit le
SKU brut, la liste de ramassage dit « N°559 » : Julien prend **le carton de la
nouvelle 559** et envoie **la mauvaise paire**. C'est le seul risque irréversible
du dossier (§5). Dans l'autre sens, la vente Vinted de la nouvelle 559 ferait
retirer d'eBay l'annonce de la N°10.

**Une confusion de plus.** L'exemple de la synthèse, « N°214 (carton B12) »
[§0, §3.2, §12.3], montre un **emplacement** au format exact d'un **numéro
d'archive** (B12 = l'ancienne 12). Sur la liste de ramassage, c'est la porte
ouverte au mauvais carton.

**La correction.**
- `ebay-regle.js` **n'embarque pas** le `numeroExterne` de l'app : il importe
  `api/_lib/numerotation.js` (la version serveur, qui prend le marqueur en
  paramètre), avec le marqueur relu par vendeur.
- Marqueur `undefined` ⇒ **aucun N°** et **aucune décision par N°** (tampon
  blanc, aucun retrait, aucun achat).
- Pour une ligne de commande : `numeroExterne(numDeSku(sku), legacyItemId,
  'ebayAnnonces', creationDate, mk)`, la règle de `numLigneEbay`.
- **Proposer** (sur son clic) de réécrire chez eBay les SKU traduits par le
  marqueur (`VRM-559` → `VRM-10`) avec `handleSku`. Le marqueur cesse alors de
  porter l'identité. ⚠️ À vérifier sur la règle d'aujourd'hui : une annonce dont
  le SKU est réécrit se lit telle quelle (les annonces passent une date `null`)
  [code lu].
- Un emplacement s'écrit « emplacement : étagère 2 · case 3 », jamais au format
  d'un numéro.
- `audit-numerotation-lecteurs.cjs` étendu à `ebay-regle.js` et à l'agent :
  marqueur `undefined` ⇒ 0 décision ; commande passée par `orderId` au lieu de
  `legacyItemId` ⇒ rouge.

**Sources.** [mesuré ici] `main.vrm_numerotation` (clés, `renum`,
`ebayAnnonces`) ; [code lu] `api/_lib/numerotation.js`, `api/ebay.js`
l. 815-837 et `src/App.jsx` l. 31640-31660 sur `origin/main` (`93e9e0e`) ;
[synthèse §0, §3.3, §6.2, §8.4] ; CLAUDE.md §5 (le seul risque irréversible).

---

### S7 — haute — Une faille d'affichage ou une session volée pilote tout l'agent

**Ce qui casse.** Toutes les actions qui engagent ne demandent que la **session**
et `confirme:true` [synthèse §8.3, §12.2] : `coffreposer`, `agentregler`,
`agentvalider`, `bordereauacheter`, `messageenvoyer`. Un `confirme:true` se pose
d'une ligne de script. Le dossier a déjà connu deux failles d'affichage (les
factures du 5 octobre), et l'app n'a toujours pas de politique `script-src`
(CLAUDE.md, « pas fait, et pourquoi »).

**Le scénario le plus grave : les adresses de tous ses acheteurs partent chez un
inconnu.** Un script injecté :
1. appelle `coffreposer` avec les clés d'un compte Boxtal **à l'attaquant** ;
2. appelle `agentvalider` (famille « bordereaux » en réel) ;
3. monte les plafonds aux maxima.

Chaque vente eBay envoie alors le **nom, l'adresse et le téléphone de l'acheteur**
au compte Boxtal de l'attaquant, et le webhook est réabonné chez lui. Variante :
il change l'adresse d'**expéditeur** (réglage), et les colis renvoyés reviennent
chez lui. Autre variante : il pose un texte de message qui sollicite hors d'eBay
(S10), envoyé 20 fois par jour sous le nom de Julien.

**La correction.**
- Une **re-vérification** (mot de passe, ou code reçu par email) pour :
  - poser ou changer les clés d'un prestataire ;
  - passer une famille en réel ;
  - monter un plafond ;
  - changer l'adresse d'expédition ;
  - changer un texte de message.
- Après un changement de clés : **24 h de répétition forcée** et retour du
  « premier de chaque sorte se confirme ».
- Une **notification sur tous ses appareils** à chaque changement de ces réglages
  (« tes clés Boxtal ont été changées à 03:12 — ce n'est pas toi ? Arrête
  l'agent »).
- Le jeton de session seul ne suffit plus pour ces cinq gestes.

**Sources.** [synthèse §8.3, §12.2] ; CLAUDE.md (« La facture exécutait ce que
l'acheteur écrit dans son nom », « pas fait : une vraie politique `script-src` »).

---

### S8 — haute — La suppression de compte dépendrait de la base : une panne de trois jours ferait désactiver les clés eBay de VRM

**Ce qui casse.** La synthèse déplace la notification
`MARKETPLACE_ACCOUNT_DELETION` vers `api/compte` et lui fait faire comme les
autres sonnettes : clé publique lue **en base**, dédoublonnage **en base**,
anonymisation, puis « **base injoignable ⇒ 500** (l'expéditeur réessaie) »
[synthèse §4.4, §8.1]. Aujourd'hui, le `POST` répond 200 sans dépendre de rien.
- eBay envoie ces notifications pour **les comptes supprimés de tous ses
  utilisateurs**, en volume.
- Une adresse qui échoue est **marquée en panne**, et eBay prévient par email
  (secondaire).
- Une clé d'application dont l'obligation n'est pas remplie a déjà été
  **désactivée pour non-conformité** (secondaire, réponse du support eBay sur le
  forum des développeurs).
- La base de Julien a été injoignable **trois jours** du 9 au 12 septembre
  (CLAUDE.md).

**Le scénario.** Nouvelle panne de la base de deux jours. Toutes les
notifications de suppression reçoivent un 500. eBay marque l'adresse en panne,
puis désactive les clés de l'application VRM. **Tous les vendeurs perdent eBay
d'un coup.**

**Le défaut voisin : épuiser le quota de vérification.** Le champ `kid` de la
signature est choisi par l'expéditeur. Des notifications forgées avec des `kid`
au hasard font demander à eBay une clé publique à chaque fois
(`/public_key/{kid}`, quota de 10 000 par jour [`infra.md` §5.1]). Les vraies
notifications ne se vérifient plus.

**La correction.**
- Pour la suppression de compte, **accuser réception (204) dès que la signature
  est vérifiée**, même base injoignable :
  - les clés publiques sont gardées **aussi en mémoire**, avec une clé de repli
    figée en variable d'environnement ;
  - l'anonymisation est mise en file ; si la base est tombée, elle est perdue et
    on le dit (VRM ne garde presque rien d'un acheteur : le pseudo).
- Le 500 reste pour `ORDER_CONFIRMATION` (la veille rattrape).
- Contre les `kid` au hasard : un `kid` inconnu est gardé « refusé » 1 h, au plus
  10 nouveaux `kid` lus par heure pour toute l'application, et le format du `kid`
  est vérifié.

**Sources.** (secondaire) [forum eBay — clés désactivées « Non Compliant »](https://community.ebay.com/forum/ebay-developers-program-57950/topic/new-keyset-disabled-as-non-compliant-requesting-exemption-474102/),
[forum eBay — adresse « not reachable »](https://community.ebay.com/t5/eBay-APIs-SDKs/Marketplace-account-deletion-notification-endpoint-fails/m-p/34774159) ;
[synthèse §4.4, §8.1] ; [`infra.md` §2.1, §5.1] ; CLAUDE.md (panne du 9 au
12 septembre).

---

### S9 — haute — Les plafonds comptent le devis, pas l'argent prélevé

**Ce qui casse.** `vrm_agent_reserver` réserve le **prix du devis** [synthèse
§5.3, §9.7]. Trois écarts possibles avec ce que le vendeur paie vraiment :
1. **HT ou TTC n'est pas dit.** Un tarif pro est souvent affiché HT, alors
   qu'un micro-entrepreneur en franchise paie le TTC : 20 % d'écart sur tout le
   plafond [à vérifier par prestataire].
2. **La régularisation de poids** arrive après coup [étude `bordereaux.md` §4],
   hors réservation.
3. **Le prélèvement SEPA différé** (la condition de Boxtal pour l'achat par
   l'API) prélève **plus tard, en une fois**. Un emballement ne se voit pas avant
   le relevé, et il n'existe **aucun** garde-fou extérieur à VRM : la seule
   limite de dépense est celle que VRM calcule.

La promesse « sa marge le compte **au centime** » [synthèse §3.5 point 8] et le
« coût réel du port » (I13) reposent sur le même devis.

**Le scénario.** Julien règle 80 € par jour. Les devis sont HT : il paie
96 € TTC par jour. S'y ajoutent trois régularisations de poids (la boîte pesait
2,1 kg et non 1,5). Le relevé du mois dépasse de 25 % le plafond « mensuel » de
300 € que l'écran affichait comme tenu.

**La correction.**
- Les plafonds se comparent au montant **TTC** (ou le prestataire dit qu'il est
  TTC), et l'écran nomme l'unité.
- Une **marge de sécurité** sur la réservation (par exemple +15 %) tant que les
  régularisations ne sont pas mesurées.
- Lire la **facture ou le relevé** du prestataire quand une API l'offre
  [à vérifier], et réconcilier : « réservé 74,20 € · facturé 81,90 € ».
- I13 ne dit « coût réel » qu'après la facture ; avant, « devis ».
- Demander à Julien de régler, **chez le prestataire**, toute limite de
  dépense qui existe [à vérifier] : c'est le seul garde-fou qui ne dépend pas
  de VRM.

**Sources.** [synthèse §3.5, §5.3, §9.7, §13 I13] ; [étude `bordereaux.md` §2.3
(prélèvement différé), §4 (régularisation)].

---

### S10 — moyenne à haute — Le contrôle des messages laisse passer « retrouvez-moi sur Vinted »

**Ce qui casse.** Le texte rendu n'est refusé que pour : adresse web, email,
téléphone, suite de 9 chiffres, accolade, évaluation contre contrepartie
[synthèse §11.2]. Or le règlement d'eBay interdit aussi :
- les **identifiants de réseaux sociaux** et de messagerie ;
- de **mentionner ou promouvoir** un site qui permet de vendre **hors d'eBay**.

Les sanctions vont jusqu'à la **restriction ou la suspension du compte** (extrait
officiel).

**Le scénario.** Julien revend sur Vinted, Leboncoin et eBay. Son texte « merci »
signé « Julien — retrouvez toutes mes paires sur Vinted : julatace3535 » passe
tous les contrôles de la synthèse, et part 20 fois par jour sous son nom.

**La correction.**
- Refuser aussi le texte rendu qui contient :
  - le nom d'une autre place de vente (Vinted, Leboncoin, Vestiaire, Facebook
    Marketplace…) ;
  - un réseau ou une messagerie (Instagram, Snap, WhatsApp, Telegram…) ;
  - un `@pseudo` ;
  - une adresse écrite en toutes lettres (« point com ») ;
  - une formule d'invitation hors plateforme (« en dehors d'eBay », « en
    direct »).
- Juger la **signature** avec le même contrôle.
- Banc : la signature « mes paires sur Vinted » ⇒ refusée.

**Sources.** (extrait officiel) [eBay — Offering to buy or sell outside of eBay](https://www.ebay.com/help/policies/payment-policies/offering-buy-sell-outside-ebay-policy?id=4272),
[eBay UK — Spam policy](https://www.ebay.co.uk/help/policies/member-behavior-policies/spam-policy?id=5033) ;
[synthèse §11.2].

---

### S11 — moyenne — Le gel tombe tout seul au bout de 72 heures, même sans preuve

**Ce qui casse.** Le gel porte sur « une vente Vinted … depuis moins de
**72 h** sans aucune preuve » [synthèse §6.5]. Au bout de 72 h, la vente sort de
la condition, et le gel tombe **sans qu'aucune preuve soit arrivée**. Or la
synthèse mesure **2 ventes sur 15 jamais prouvées** [§2.2]. Pour ces ventes, le
temps transforme un « je ne sais pas laquelle est vendue » en « rien n'est
vendu », et l'écran peut redire « pas vendue ailleurs ».

**Le scénario.** Vendredi, une vente Vinted sur `arthuror2` n'est jamais reliée.
Lundi, le gel tombe. Julien publie sur eBay trois paires d'`arthuror2`, dont celle
qui est déjà partie.

**La correction.**
- Le gel ne tombe que par une **preuve**, ou par **le geste de Julien** : « cette
  vente, c'est la N°… » (relier à la main, le motif de C4).
- Après 72 h, il devient une ligne dans Ma journée : « 1 vente du 10/10 sur
  `arthuror2` n'est reliée à aucune paire — relie-la pour publier les paires de
  ce compte sur eBay ».
- Banc : une vente jamais prouvée ⇒ publication refusée à J+4.

**Sources.** [synthèse §2.2, §6.5].

---

### S12 — moyenne — Le retrait automatique change de portée sans redemander, et la synthèse se contredit sur le « même N° »

**Ce qui casse.**
1. **Le consentement.** Julien a allumé `vrm_ebay_retrait_auto` le 10 octobre
   [étude `etat.md` §3.1] pour une règle précise :
   - **app ouverte** ;
   - preuve par **transaction** Vinted ;
   - exception « annonce publiée après la vente » en place.

   La synthèse le fait tourner **VRM fermé, à toute heure**, l'élargit au
   **bordereau** (S13), à **Leboncoin** (I22) et à **une autre annonce eBay du
   même N°** [§3.1, 14 h 03], et propose de retirer l'exception. Elle le classe
   « réglage (le tien, déjà allumé) » [§3.3]. Dire « allumé » pour une règle
   qu'il n'a pas vue revient à présumer son accord.
2. **La contradiction.** « Une **autre** annonce eBay du même N° (autre compte) :
   retirée » [§3.1] contredit « `deux_annonces` : signalé ; **aucune n'est
   touchée** (règle existante) » [§6.4] et la règle du dossier (« deux annonces
   pour un même N° ⇒ aucune n'est touchée »).
3. **Les numéros partagés.** Aujourd'hui **13 numéros sont portés par 34
   fiches** (B1, B2, B3… sur 2 ou 3 comptes chacun ; 6 seulement par une reprise
   ♻️) [mesuré ici]. Un même N° sur deux annonces peut donc être **deux paires
   différentes**. En retirer une parce que l'autre s'est vendue retire une paire
   que Julien a encore.

**La correction.**
- Le retrait **serveur** est une **nouvelle** famille, qui démarre en
  répétition, et que Julien rallume en lisant la nouvelle portée :
  - VRM fermé ;
  - preuve par bordereau ;
  - Leboncoin ;
  - sans l'exception (si c'est sa décision).
- Jamais de retrait « parce que le même N° s'est vendu sur un autre compte
  eBay » : on **signale** (règle existante).
- Un N° porté par **plusieurs fiches** n'autorise **aucun** geste automatique
  (retrait, « retire-la de Vinted » nommée), seulement « vérifie le carton ».

**Sources.** [mesuré ici] `main.vinted_annonce_numeros` : 404 numéros
distincts, 13 portés par plusieurs fiches (34 fiches) ; [étude `etat.md` §3.1] ;
[synthèse §3.1, §3.3, §6.4, §13 I22, §17 décision 2] ; CLAUDE.md (retrait
automatique eBay, numérotation).

---

### S13 — moyenne — La preuve par bordereau : 5 % des bordereaux captés sont des ventes remboursées

**Ce qui casse.** La preuve élargie compte un bordereau capté
(`harvest_{uid}_label_{tx}.item`) comme une vente [synthèse §6.5]. Elle précise
que l'état se lit dans `orders_sold`, mais ne dit pas quoi faire quand la
transaction **n'y est pas** (liste paginée, compte non relu).
**Mesuré ce soir** : sur **76** bordereaux captés qui portent leur annonce,
**4** (5,3 %) appartiennent à une vente dont l'état est **« Remboursement
effectué »** (août et 22 septembre) ; 0 sont absents d'`orders_sold` aujourd'hui
[mesuré ici].

Avec l'exception « publiée après la vente » retirée [synthèse §17 décision 2],
la seule protection qui reste est « une **autre** annonce Vinted de ce N° en
vente ». Mais :
- Vinted ne remet **pas** l'article en vente tout seul : c'est le vendeur qui
  appuie sur « Republier l'article » (extrait officiel) ;
- et une annonce republiée reçoit un **nouveau** N° sauf geste ♻️ (CLAUDE.md :
  « une annonce sans numéro en reçoit un automatiquement »).

« La paire est revenue » ne se voit donc souvent **pas** par le N°.

**Le scénario.** Vente Vinted, bordereau capté, puis l'acheteur se fait
rembourser (colis perdu puis retrouvé, ou retour). La ligne `orders_sold` du
compte n'est pas relue (compte non ouvert dans Chrome). Julien remet la paire sur
eBay. L'agent voit « bordereau ⇒ vendue » et retire son annonce eBay, toutes les
30 minutes s'il la republie.

**La correction.**
- Un bordereau n'est une preuve **que** si la transaction est **lue** dans
  `orders_sold` dans un état qui n'est pas dans `PAS_UNE_VENTE`.
- Transaction **absente** ou ligne illisible ⇒ « pas su » ⇒ aucun retrait
  (le gel suffit pour la publication).
- Garder une forme de l'exception : une annonce eBay mise en ligne **après** que
  VRM a **lu** la preuve (la date de lecture, l'option `preuveLueA` de B) n'est
  pas retirée automatiquement, seulement signalée. Le cas « déjà couvert »
  ne l'est pas.
- Banc : bordereau d'une vente remboursée ⇒ 0 retrait ; transaction absente ⇒ 0.

**Sources.** [mesuré ici] jointure `harvest_*_label_*` × `orders_sold`
(`my_orders[].transaction_id`, `status`) ; (extrait officiel) [aide Vinted —
annuler une commande](https://www.vinted.fr/help/58-canceling-an-order),
[aide Vinted 209](https://www.vinted.fr/help/209) ; [synthèse §6.5, §17].

---

### S14 — moyenne — Une vente payée et pas postée, trouvée au branchement d'un compte, devient muette

**Ce qui casse.** Rang 0 `historique` : « la commande existait à la **toute
première** lecture du compte — rien, ni geste ni sonnerie » [synthèse §6.1]. La
garde est faite pour éviter « 30 ventes ! » d'un coup, mais elle met aussi en
silence les commandes **payées et pas encore postées** : aucun rappel J-1 ni J,
aucun suivi, aucune alerte « pas scanné ». C'est le cas le jour où l'agent est
allumé, où un second compte eBay est relié, ou après une reconnexion.

**Le scénario.** Julien allume l'agent un jeudi. Deux ventes eBay du mercredi
attendent leur envoi (`shipByDate` vendredi). Elles sont « historique » : pas de
rappel vendredi matin. « Un colis caché est un colis perdu » (§5).

**La correction.**
- `historique` = commande **déjà expédiée, annulée ou close** à la première
  lecture.
- Une commande **payée, non expédiée** à la première lecture entre en `payee`
  sans sonnerie individuelle, avec **une** notification groupée : « 2 ventes eBay
  à poster, trouvées en branchant ce compte — la plus urgente avant ven. 12 h ».
- Banc : allumage avec deux commandes payées non postées ⇒ 2 lignes dans Colis,
  1 notification, les rappels partent.

**Sources.** [synthèse §6.1] ; CLAUDE.md §5 (« un colis caché est un colis
perdu ») ; [`spec-veille.md` l. 149].

---

### S15 — moyenne — Aucun délai par appel : un achat réussi peut être perdu, et le chemin « clic » échappe au verrou

**Ce qui casse.**
1. **Le bail et la durée des appels.** Le bail dure 120 s, le battement travaille
   25 s [synthèse §4.3]. Mais **aucun délai n'est fixé pour un appel sortant**
   (eBay, prestataire). Si un achat met plus de 120 s :
   - un autre battement reprend la tâche, voit `en_cours` et la passe en
     « incertain » ;
   - le premier finit, **réussit**, puis ne peut plus écrire son issue :
     `vrm_agent_ecrire_commande` rend 0 ligne, faute de bail.

   Le numéro et le prix de l'envoi acheté sont **perdus**, et l'ordre de §7.2
   (« écrire l'issue …, journal ») ne garantit pas que le journal soit écrit.

   La synthèse affirme en plus « le battement de 25 s reste sûr de toute façon »
   si « Fluid compute » n'est pas actif [`infra.md` §7]. La durée par défaut
   n'est pas établie [à vérifier] (la documentation de Vercel annonce 300 s, un
   utilisateur a observé un arrêt à 10 s, secondaire) : une fonction coupée au
   milieu d'un achat **n'est pas** « sûre ».
2. **Le chemin « clic ».** `bordereauacheter` (sur son clic) appelle « la même
   fonction que l'agent » [§8.3]. Mais le verrou est un **bail de tâche** pris par
   `vrm_agent_prendre`, et le chemin « clic » ne passe pas par là. Un double clic,
   ou un clic pendant que le battement traite la même commande (après un
   changement de réglage), donne deux achats concurrents.

**La correction.**
- Chaque appel sortant a un délai (`AbortController`) **inférieur à** la fin du
  battement et **bien inférieur au** bail.
- `maxDuration` est posé explicitement pour `api/ship-reminders.js` et
  `api/ebay.js`.
- L'issue d'un geste qui engage s'écrit **d'abord dans le journal**
  (`vrm_agent_noter`, sans bail : on ajoute, on ne réécrit pas), avec la
  référence de l'envoi, **puis** dans l'état. La réconciliation relit le journal
  avant de déclarer « incertain ».
- Le chemin « clic » prend **le même bail** sur la tâche de la commande
  (`vrm_agent_prendre_cle(owner, cle, jeton)`). Pas de bail ⇒ 409 « l'agent
  travaille sur cette commande ».
- Banc : un faux prestataire qui répond en 130 s ⇒ 1 achat, issue retrouvée ;
  double clic ⇒ 1 achat.

**Sources.** [synthèse §4.3, §5.3, §7.2, §8.3] ; [`infra.md` §3.1, §7] ;
[Vercel — functions limitations](https://vercel.com/docs/functions/limitations) ;
(secondaire) [forum Vercel — arrêt à 10 s](https://community.vercel.com/t/max-duration-not-being-used/7837).

---

### S16 — moyenne — « Il n'y en a pas : réessaie » rachète sur la foi d'un écran

**Ce qui casse.** Pour un achat Boxtal incertain, la synthèse demande à Julien
de regarder « Boxtal → Mes envois », avec deux boutons, dont « **il n'y en a
pas : réessaie** » [synthèse §7.3]. L'écran du prestataire peut afficher l'envoi
**avec retard**, la création étant elle-même asynchrone (le document arrive par
un évènement, S3). Le geste humain devient alors un second achat.

**La correction.**
- Une commande passée en « incertain » ne **rachète jamais** par VRM. Les deux
  boutons deviennent :
  - « il y en a un : n° … » (relie l'envoi) ;
  - « achète-le moi-même dans eBay / chez le prestataire » (la voie eBay pour
    cette commande).
- Si l'on garde « réessaie », il n'apparaît qu'**après 24 h**, et ce second achat
  est un nouveau geste confirmé, avec son prix.

**Sources.** [synthèse §7.3] ; S3.

---

### S17 — moyenne — L'annulation automatique d'un bordereau se décide sur un « aucun scan » qui peut être un « pas su »

**Ce qui casse.** L'annulation automatique se fait si la commande est annulée,
**« aucun scan »**, et 24 h passées [synthèse §9.9]. Or « aucun scan » peut venir
de trois choses :
- d'un suivi **lu** sans évènement ;
- d'un suivi **pas lu** : webhook raté, Mondial Relay « pas su » [§10.1] ;
- d'un suivi **pas encore lu** depuis l'annulation.

**Le scénario.** Julien a déposé le colis au relais avant de voir l'annulation.
Le webhook de dépôt s'est perdu. VRM annule le bordereau : le colis est dans le
réseau avec une étiquette annulée, il se bloque ou revient. La paire voyage pour
rien, et le remboursement attendu peut ne jamais venir.

**La correction.**
- « Aucun scan » exige une lecture du suivi **réussie**, faite **après**
  l'annulation et **au moins 24 h** après elle.
- Une lecture ratée ou un transporteur non couvert ⇒ « pas su » ⇒ proposé,
  jamais fait.
- Banc : suivi illisible + commande annulée + 24 h ⇒ 0 annulation.

**Sources.** [synthèse §6.3, §9.9, §10.1].

---

### S18 — moyenne — Le témoin email « au même numéro » peut parler d'un autre colis

**Ce qui casse.** La synthèse prend comme évènement « la ligne `email_track_*`
dont le n° est **exactement** le même » [synthèse §10.1] :
- **sans borne de date** ;
- **sans vérifier** que le transporteur est le même.

Or :
- les numéros Mondial Relay ont **8 chiffres** [étude `suivi.md` §1], un espace
  qui se réutilise vraisemblablement [à vérifier] ;
- la ligne s'appelle `email_track_{transporteur}_{suivi}` : une seule ligne par
  numéro, réécrite au dernier email.

**Le scénario.** Le bordereau eBay porte un numéro Mondial Relay déjà vu dans un
vieil email « livré » de juillet. Le jour du bordereau, VRM lit « livré » :
- le message « livré » part à l'acheteur ;
- l'évaluation est laissée ;
- la commande est close 30 jours plus tard ;
- la « preuve de livraison » qu'il montrera dans un litige « objet non reçu »
  est celle d'**un autre colis**.

**La correction.**
- Un évènement d'email ne compte que si sa **date** est postérieure à la création
  du bordereau (ou à `shippedDate`) et si le **transporteur** de la ligne est
  celui de l'envoi.
- Une étape « livré » qui arrive **avant** `pris_en_charge` est refusée.
- La preuve de livraison garde la **source** de l'évènement (prestataire, La
  Poste ou email).
- Banc : ligne email « livré » datée d'avant le bordereau ⇒ ignorée.

**Sources.** [synthèse §6.3, §10.1, §10.3] ; [étude `suivi.md` §1] ; CLAUDE.md
(familles `email_track_*`).

---

### S19 — moyenne — International, retrait en magasin, plusieurs paires : `voieEtiquette` les envoie quand même en voie VRM

**Ce qui casse.** La règle de la voie [synthèse §9.1] ne regarde ni le **pays**
de livraison, ni `shipToReferenceId`, ni `fulfillmentInstructionsType`, ni
`pickupStep`. Pourtant l'étude bordereaux les nomme [`bordereaux.md` §3.1] :
- `shipToReferenceId` est la référence d'un programme d'expédition
  internationale d'eBay, qui doit figurer sur l'étiquette pour que le centre de
  tri reconnaisse le colis ;
- `pickupStep` est un retrait sur place : il n'y a **rien à expédier**.

Et pour **plusieurs paires dans une commande**, la synthèse dit « un seul
bordereau » [§9.3], sans dire quel **poids** : le colis type (1,5 kg) pour deux
paires sous-déclare.

**Le scénario.** Une vente vers l'Allemagne passe par un centre de tri d'eBay :
le bordereau Boxtal, sans la référence, part au centre, qui ne relie pas le colis
à la commande. Colis perdu, paire perdue, bordereau payé.

**La correction.** Dans `voieEtiquette`, avant la voie VRM :
- pays ≠ France, ou `shipToReferenceId` présent, ou
  `fulfillmentInstructionsType` ≠ expédition simple ⇒ voie eBay ;
- `pickupStep` présent ⇒ aucune étiquette ;
- plusieurs lignes ou quantité > 1 ⇒ poids = **somme** des poids validés, et
  dimensions à confirmer, sinon `attendre` ;
- un fait « pas su » sur l'un d'eux ⇒ voie eBay.

**Sources.** [étude `bordereaux.md` §3.1] ; [synthèse §9.1, §9.3, §9.6].

---

### S20 — moyenne — Abonnement coupé : le vendeur ne voit plus ce qui a été acheté en son nom

**Ce qui casse.** Abonnement coupé ⇒ « rien, aucun appel, aucune notification »
[synthèse §6.6]. De plus, la règle restrictive `abonnement_requis` est posée sur
**les tables de l'agent**, journal compris [§5.1]. Un vendeur qui cesse de payer
pendant que :
- des bordereaux sont achetés mais pas déposés,
- des commandes sont annulées (bordereaux à annuler pour être remboursé),
- un achat est incertain,

ne peut **plus lire** le journal ni les commandes, et VRM ne le prévient plus.
C'est de **son** argent qui reste engagé, sans aucune trace visible pour lui.

**La correction.**
- Le **journal** et les **bordereaux engagés** restent lisibles par leur vendeur
  même sans abonnement : la restrictive ne s'applique qu'aux tables qui
  **agissent**.
- À la coupure, **un** email ou **une** notification de clôture : « VRM s'arrête.
  3 bordereaux achetés en ton nom ne sont pas déposés (24,60 €) ; 1 commande
  annulée a un bordereau à annuler : voici comment ».
- Les annulations de bordereaux **déjà décidées** se terminent (c'est rendre son
  argent, pas un service nouveau) — ta décision.

**Sources.** [synthèse §5.1, §6.6] ; CLAUDE.md (« L'abonnement : 9,99 €/mois, et
qui ne paie plus ne voit plus rien »).

---

### S21 — moyenne — `AUTHORIZATION_REVOCATION` est crue comme une donnée

**Ce qui casse.** « Une sonnette n'est jamais une donnée » [synthèse §4.1, règle
2]. Pourtant `AUTHORIZATION_REVOCATION` met le compte « refusé **tout de
suite** » [§4.4]. La signature d'eBay ne porte **aucune date** à comparer (le
code officiel vérifie le contenu, pas la fraîcheur [`infra.md` §2.1]), et eBay
**réessaie** ses notifications.

**Le scénario.** Julien retire VRM de son compte eBay par erreur, puis se
reconnecte une minute après. Une nouvelle tentative de la notification de
révocation arrive **après** la reconnexion. Le compte repasse « refusé » :
- l'agent s'arrête ;
- une notification lui dit de se reconnecter, alors qu'il vient de le faire.

Même chose pour une révocation rejouée des semaines après, au-delà des 14 jours
du dédoublonnage [§5.3].

**La correction.** La révocation est une **sonnette** : elle déclenche tout de
suite un **renouvellement de jeton**. Seul un `invalid_grant` met le compte
« refusé ». Même règle pour la suppression de compte : elle anonymise ce qui
désigne **exactement** l'utilisateur nommé, mais ne change l'état d'aucun compte
vendeur sans vérification.

**Sources.** [synthèse §4.1, §4.4, §5.3] ; [`infra.md` §2.1].

---

### S22 — moyenne — Le jeton eBay déplacé dans le coffre reste valable là où il a fuité

**Ce qui casse.** La synthèse range « ensuite » le jeton eBay dans le coffre
[§5.1, chantier 4]. Mais ce jeton de renouvellement (valable **548 jours** selon
la ligne [étude `etat.md` §3.1]) a déjà été :
- lisible par **son navigateur** (règle `chacun ses lignes`) ;
- recopié dans **deux sauvegardes** (`sauvegarde.app_data_20260930`,
  `_20261002`) ;
- lisible par tout outil connecté en `postgres`, y compris les sessions Claude
  [`infra.md` §1.1].

Le chiffrer **ne retire pas** les copies en clair, et le même jeton reste
valable.

**La correction.** Le chantier 4 inclut :
1. une **reconnexion** de chaque compte eBay, qui donne un nouveau jeton,
   rangé directement dans le coffre ;
2. la **révocation** de l'ancien jeton chez eBay [à vérifier : appel de
   révocation disponible pour une application] ;
3. le **nettoyage** des champs de jeton dans les sauvegardes (geste de Julien, un
   `DROP` ou un `UPDATE` confirmé à l'écran, comme le dossier l'exige pour un
   `DROP`) ;
4. la garde d'écriture qui empêche une ligne `ebay_tokens` en clair de
   revenir.

**Sources.** [`infra.md` §1.1, §6.1] ; [étude `etat.md` §3.1] ; [synthèse §5.1,
§15 chantier 4] ; CLAUDE.md (sauvegardes du 30 septembre et du 2 octobre, `DROP`
confirmé).

---

### S23 — moyenne — Les PDF de bordereaux eBay portent nom et adresse, sans durée de vie

**Ce qui casse.**
- « Ce qu'on ne garde jamais : l'adresse, le nom… » [synthèse §5.5]. Pourtant le
  PDF du bordereau est rangé **brut** dans le stockage privé [§9.3 étape 8].
  Une étiquette porte **le nom et l'adresse complète** de l'acheteur. Aucune
  purge n'est prévue (`vrm_agent_purger` ne touche pas aux PDF, [§5.3]). Pour
  Vinted, le dossier purge après finalisation (5.146, 5.158).
- `bordereauglisse` lit un PDF déposé, donc un PDF d'acheteur, sans dire s'il
  est gardé [§8.3].
- La **ville** est rangée dans le devis [§6.1, rang 2B].

**La correction.**
- Le PDF d'un bordereau eBay est **purgé** quand la commande est `livree` depuis
  7 jours ou `close`, sur le modèle de `purgeBordereaux`. Seuls restent le
  numéro, le transporteur et le prix.
- `bordereauglisse` ne **garde rien** : il lit le numéro et rend la réponse.
- La politique de confidentialité dit que **le bordereau** (pas seulement
  l'adresse transmise) est gardé jusqu'à la livraison.
- La ville du devis est effacée avec le devis.

**Sources.** [synthèse §5.3, §5.5, §6.1, §8.3, §9.3] ; CLAUDE.md (purge des
bordereaux 5.146 et 5.158).

---

### S24 — basse — « Un appel en vol par compte eBay » ne vaut qu'à l'intérieur d'un battement

**Ce qui casse.** `vrm_agent_prendre` limite à « ≤ 1 par `groupe` » **dans sa
sélection** (`row_number()` au-dessus du `skip locked`) [synthèse §5.3]. Mais il
ne regarde pas les tâches du même groupe **déjà tenues** par un autre battement
(chevauchement, battement de secours de 08:00). La promesse « ordre garanti, pas
de rafale » [§7.1] ne tient pas, et deux gestes du même compte peuvent se croiser
(un retrait et le traitement de la commande de la même annonce).

**La correction.** Exclure les groupes qui ont un bail vivant (`not exists …
bail_jusqua > p_maintenant` sur le même groupe), sous un verrou consultatif par
groupe (`pg_try_advisory_xact_lock(hashtext(owner||groupe))`) pour fermer la
course. Banc SQL : deux sessions, deux tâches du même groupe ⇒ une seule prise.

**Sources.** [synthèse §5.3, §7.1, §15.2 (contrôle « concurrence »)].

---

### S25 — basse — `vrm_agent_vus` purgé à 14 jours mélange sonnettes et « déjà fait »

**Ce qui casse.** `vrm_agent_vus` garde « notificationId, évènement, push,
message » [synthèse §5.1]. `vrm_agent_premiere_fois` y écrit les mémos
« avant l'envoi » [§5.3], et `vrm_agent_purger` vide la table **après 14 jours**.
Or :
- un message est permis jusqu'à **90 jours** ;
- une évaluation jusqu'à **60 jours** [étude `suivi.md` §4.3] ;
- `data.messages` dans la commande garde **aussi** le « déjà envoyé ».

Ce sont deux propriétaires pour une même notion (§11), dont l'un s'efface.

**La correction.** Les mémos de **gestes** (message, évaluation, offre) vivent
dans **une seule** place, gardée au moins la durée de la fenêtre du geste. Seuls
les identifiants de **notifications** entrantes sont purgés à 14 jours.

**Sources.** [synthèse §5.1, §5.3] ; [étude `suivi.md` §4.3, §6.4].

---

### S26 — basse — Le journal « jamais réécrit » contre l'anonymisation exigée par eBay

**Ce qui casse.** Le journal garde le **texte exact** de chaque message, « jamais
réécrit », pendant 13 mois [synthèse §5.1, §5.4]. Un message **préparé** que
Julien modifie peut contenir le **prénom** de l'acheteur. À la notification de
suppression de compte d'eBay, ce texte ne peut pas être effacé.

**La correction.** Le journal accepte **une seule** réécriture : l'effacement du
texte d'une entrée qui vise l'acheteur supprimé (« texte retiré à la demande
d'eBay »). Ou il garde le gabarit et les variables plutôt que le texte libre.

**Sources.** [synthèse §5.1, §5.4, §11.3] ; [étude `suivi.md` §6.6].

---

### S27 — basse — Trois promesses que la conception ne tient pas

1. « **Ce qui se défait se défait d'un clic** » [synthèse §0, point 7]. Un
   message, une évaluation (« irréversible », dit §11.4), un retrait (remettre en
   vente crée une **nouvelle** annonce, avec frais, sans les observateurs) et un
   bordereau déposé ne se défont pas. ⇒ Écrire : « tout ce qui est fait en ton
   nom se relit ; ce qui se défait est marqué ».
2. « **Sa marge le compte au centime** » [§3.5] : voir S9. ⇒ « au prix du devis,
   puis de la facture ».
3. « **Retire la N°553 d'eBay** » [§0, §16] : depuis ce soir, la paire s'appelle
   **N°1** dans VRM [mesuré ici]. Le geste reste juste (l'annonce
   `128127336988`), mais le numéro affiché ne correspond plus. ⇒ Nommer
   l'annonce par son identifiant et son titre.

**Sources.** [synthèse §0, §3.5, §11.4, §16] ; [mesuré ici] `renum`.

---

### S28 — moyenne — « Vendu sur eBay » se tait quand VRM ne sait pas si la paire est encore sur Vinted

**Ce qui casse.** Dans la notification de vente, la mise en garde « ⚠️ encore en
ligne sur Vinted (tomj683) : retire-la » n'apparaît « que s'il y a quelque chose
à retirer » [synthèse §12.3]. Or VRM ne touche jamais Vinted : **le geste de
Julien est la seule protection** contre une double vente dans ce sens.
Si le dressing du compte est vieux (12 h et plus est courant, CLAUDE.md
« fraîcheur ») ou illisible, le silence se lit « rien à retirer ».

**La correction.** Trois états dans la notification :
- « encore en ligne sur Vinted (tomj683) — retire-la » ;
- « hors ligne sur Vinted » (dressing lu après la vente eBay) : rien ;
- « **je ne sais pas** si elle est encore sur Vinted (tomj683 lu il y a
  14 h) — vérifie » : la paire est nommée.

Même règle pour Leboncoin.

**Sources.** [synthèse §12.3] ; CLAUDE.md §3 (« VRM ne touche jamais une annonce
Vinted »), « la fraîcheur, une fois ».

---

## 3. Ce qui tient (vérifié, pas une faute)

- **La voie « eBay » par défaut.** Ne rien acheter tant que Julien n'a pas dit
  « VRM achète » sur ce compte est le bon sens [§9.1].
- **Relire la commande chez eBay, avec le jeton du compte, avant de dépenser**
  [§9.3, §14]. Une commande fabriquée dans la base ne fait rien acheter.
- **Les sonnettes ne portent pas de donnée** (sauf S21) : une notification
  forgée avec une vraie signature d'une autre application ne coûte qu'une
  relecture freinée [§4.1, §4.4].
- **Tables où le vendeur ne peut que lire**, et verrou et version vérifiés dans
  la même instruction SQL [§5.1, §5.3]. C'est meilleur que des lignes `app_data`
  gardées par un déclencheur.
- **La réservation d'argent en une instruction**, rendue seulement sur un refus
  prouvé [§5.3, §7.1].
- **Le coffre** : HKDF par vendeur, données associées, clé maîtresse hors base
  [§5.1]. Une valeur recopiée chez un autre vendeur ne se déchiffre pas.
- **Les messages** : éteints par défaut, mémo avant l'envoi, jamais renvoyés sur
  un incertain, heures décentes, destinataire relu sur la commande [§11]. Seul
  le contrôle du texte est trop étroit (S10).
- **L'évaluation** : positive seulement, `GetItemsAwaitingFeedback` lu d'abord,
  jeton du compte qui porte la commande [§11.4]. Je n'ai pas trouvé de chemin
  vers une évaluation au mauvais acheteur.
- **Aucun point relais deviné** [§9.5], aucune catégorie devinée, aucune
  acceptation d'offre hors du seuil natif [§13 I16].
- **Le battement** : secret à part, réponse sans donnée, schéma `net` jamais
  exposé [§14].

---

## 4. Ce qu'il faut reporter dans la synthèse

1. **§7.4, ligne « acheter un bordereau »** : ajouter « N° non prouvé vendu
   ailleurs » et « aucun gel sur le compte d'origine » (S1). Même ajout aux
   lignes « baisser un prix » et offre automatique.
2. **§9.10 et §6.1** : déclarer au premier scan, ou le jour de `shipByDate`
   (S2). Nouvel état « acheté, suivi attendu » (S3).
3. **§7.3** : Sendcloud passe à « non » tant que le bac à sable n'a pas mesuré
   (S4). Boxtal incertain : plus de « réessaie » (S16).
4. **§5, §14** : le registre des titulaires eBay et les clés d'idempotence
   globales (S5).
5. **§8.4** : `ebay-regle.js` importe `api/_lib/numerotation.js`, jamais le
   `numeroExterne` de l'app ; marqueur « pas su » ⇒ aucun N° (S6). Mettre à jour
   553 → 1 et 559 → 10 partout.
6. **§8.3, §12.2** : la re-vérification pour cinq gestes (S7).
7. **§8.1** : la suppression de compte accuse réception sans dépendre de la base ;
   les `kid` inconnus sont freinés (S8).
8. **§9.7** : plafonds TTC, avec une marge, et réconciliés avec la facture (S9).
9. **§11.2** : les autres plateformes, les réseaux, les `@` (S10).
10. **§6.5** : le gel ne tombe que par une preuve ou le geste de Julien (S11) ;
    un bordereau n'est une preuve qu'avec un état de vente **lu** (S13).
11. **§3.1, §3.3, §6.4** : le retrait serveur est une nouvelle famille à
    rallumer ; plus de retrait « même N° sur un autre compte eBay » (S12).
12. **§6.1** : `historique` = déjà expédiée (S14).
13. **§4.3, §7.2, §8.3** : délais par appel, `maxDuration`, le journal avant
    l'état, le chemin « clic » sous bail (S15).
14. **§9.9** : « aucun scan » exige une lecture réussie (S17).
15. **§10.1** : le témoin email borné par la date et le transporteur (S18).
16. **§9.1** : pays, référence de programme, retrait en magasin, plusieurs
    paires (S19).
17. **§5.1, §6.6** : journal lisible sans abonnement, et un message de clôture
    (S20).
18. **§4.4** : la révocation devient une sonnette (S21).
19. **Chantier 4** : reconnexion, révocation, nettoyage des sauvegardes (S22).
20. **§5.3, §5.5** : purge des PDF eBay (S23).
21. **§5.3** : le verrou par groupe entre battements (S24) ; deux places
    distinctes pour sonnettes et mémos de gestes (S25) ; journal anonymisable
    (S26).
22. **§0, §3.5, §16** : les trois promesses (S27).
23. **§12.3** : la notification à trois états pour Vinted et Leboncoin (S28).

**Scénarios de banc à ajouter** au banc de vie (§15.2), chacun rouge sur la
synthèse telle quelle :

| ce qui est servi | attendu |
|---|---|
| vente eBay + vente Vinted du même N° prouvée 90 min après | 0 achat |
| achat Boxtal à la forme documentée (pas de suivi) | 0 déclaration avant le suivi |
| Sendcloud **non** idempotent + coupure | 1 envoi |
| deux vendeurs, un même compte eBay | 1 achat, 1 message |
| marqueur 013 illisible | 0 N°, 0 retrait |
| SKU `VRM-559` sur `128086452103` + nouvelle 559 | lu N°10 |
| clés du prestataire changées par la seule session | refus |
| base en panne + suppression de compte signée | 204 |
| signature « mes paires sur Vinted » | refusée |
| vente jamais prouvée à J+4 | publication refusée |
| bordereau d'une vente remboursée | 0 retrait |
| allumage avec 2 commandes non postées | 2 rappels |
| prestataire qui répond en 130 s | issue retrouvée, 1 achat |
| suivi illisible + annulation | 0 annulation de bordereau |
| email « livré » antérieur au bordereau | ignoré |
| commande internationale à référence | voie eBay |
| révocation rejouée après reconnexion | compte « ok » |

---

## 5. Sources

**Mesuré ici, le 11 octobre au soir** (base `lgonxzrzjcqthjtbdpzo`, propriétaire
`74eea6e7-…`, lecture seule, projetée) :
- `main.vrm_numerotation` : version 2, coupure `2026-10-09T00:00:00Z`, appliquée
  `2026-10-11T14:58:07Z` ; `renum` 553 → 1, 559 → 10 (24 entrées) ;
  `ebayAnnonces` = `{128086452103: {559: 10}, 128127336988: {553: 1}}` ; 401
  numéros en B, 24 en chiffres.
- `main.vinted_annonce_numeros` : 404 numéros distincts ; 13 portés par
  plusieurs fiches (34 fiches), tous de l'archive B ; aucun doublon dans la
  nouvelle série.
- `harvest_*_label_*` portant `item` : 76 ; joints à `orders_sold`
  (`my_orders[].transaction_id`) : 72 ventes, **4 « Remboursement effectué »**,
  0 absent.
- `vinted_accounts` : 7 comptes Vinted, **1** chez deux propriétaires VRM.
- `ebay_listings` / `ebay_orders` : `capturedAt` inchangé (10 octobre
  20:29:12 UTC) ; `VRM-559`, une annonce sans SKU, `VRM-553`.

**Code lu** (`origin/main`, `93e9e0e`) : `api/_lib/numerotation.js`
(`archiveDe`, `numeroExterne` avec marqueur en paramètre) ; `api/ebay.js`
l. 815-837 (retrait : marqueur relu, illisible ⇒ 503) ; `src/App.jsx`
l. 31640-31660 (`numeroExterne` par globales du navigateur, `numLigneEbay` par
`legacyItemId` + `creationDate`).

**Extraits de moteur (pages officielles non lues en entier) :**
- Boxtal : [order API v3](https://developer.boxtal.com/fr/en/apiv3/guide/order-api-v3),
  [tracking events v3](https://developer.boxtal.com/fr/en/apiv3/guide/tracking-events-api-v3).
- Sendcloud : [v2 integrations — create a list of shipments](https://sendcloud.dev/api/v2/integrations/create-a-list-of-shipments)
  (aucune page trouvée pour `external_reference_id`).
- eBay : [We're simplifying order cancellations](https://community.ebay.com/forum/announcements-57928/topic/were-simplifying-order-cancellations-6873/),
  [Offering to buy or sell outside of eBay](https://www.ebay.com/help/policies/payment-policies/offering-buy-sell-outside-ebay-policy?id=4272),
  [Spam policy (UK)](https://www.ebay.co.uk/help/policies/member-behavior-policies/spam-policy?id=5033).
- Vinted : [annuler une commande](https://www.vinted.fr/help/58-canceling-an-order),
  [aide 209](https://www.vinted.fr/help/209).
- Vercel : [functions limitations](https://vercel.com/docs/functions/limitations).

**Secondaires :**
[valueaddedresource — annulations eBay UK/AU](https://valueaddedresource.net/ebay-expands-cancellation-policy-uk-au) ·
[forum eBay — clés désactivées pour non-conformité](https://community.ebay.com/forum/ebay-developers-program-57950/topic/new-keyset-disabled-as-non-compliant-requesting-exemption-474102/) ·
[forum eBay — adresse de suppression injoignable](https://community.ebay.com/t5/eBay-APIs-SDKs/Marketplace-account-deletion-notification-endpoint-fails/m-p/34774159) ·
[forum Vercel — arrêt à 10 s](https://community.vercel.com/t/max-duration-not-being-used/7837).

**Le reste** : `synthese.md`, `bordereaux.md`, `suivi.md`, `infra.md`, `etat.md`,
`../agent-ebay/spec-veille.md` ; `CLAUDE.md`.
