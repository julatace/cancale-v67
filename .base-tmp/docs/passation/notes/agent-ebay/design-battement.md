# L'agent eBay autonome — « un battement de cœur qui fait tout »

**Pour :** Julien (les sections 0, 2, 15 et 16 sont écrites pour toi), et les
sessions qui construiront.
**Rédigé le :** 11 octobre 2026.
**Construit sur :** les quatre études du jour, dans ce dossier (`bordereaux.md`,
`suivi.md`, `infra.md`, `etat.md`), et la feuille de route du 9 octobre
(`../agent-ebay/feuille-de-route.md`, `spec-*.md`). Ce document ne refait pas
leurs recherches. Il les assemble en **une seule machine**, tranche quand elles
divergent, et en corrige trois points (§1.3).

**D'où vient chaque fait :**

| marque | sens |
|---|---|
| **[mesuré]** | lu par moi aujourd'hui : sa base Supabase (SELECT projetés : aucun jeton, aucun nom ni adresse d'acheteur) ou le code de la branche `worktree-wf_30feaf2f-334-8` |
| **[étude]** | repris d'une étude du jour ; sa propre marque d'origine (code lu, extrait, secondaire) y est donnée |
| **[extrait]** | extrait d'une page officielle renvoyé par un moteur de recherche ; la page elle-même est bloquée depuis ce conteneur (`developer.ebay.com`, `sendcloud.dev` : `ENOTFOUND`, vérifié aujourd'hui) |
| **[secondaire]** | blog, forum, bibliothèque non officielle |
| **[à vérifier]** | non établi. **Rien de ce qui porte cette marque ne devient une promesse à l'écran.** |

**Aucun appel** n'a été fait à eBay, à un transporteur ou à Vinted. **Aucune
écriture** nulle part, hors de ce fichier.

---

## 0. En une page

**Ce que tu as demandé :** un agent qui fait tout, tout seul. Il voit la vente,
prépare le colis, achète et envoie le bordereau, suit le colis jusqu'au client et
parle au client.

**Le principe : un battement de cœur.**
- Toutes les minutes, ta base Supabase regarde s'il y a quelque chose à faire.
- S'il y a quelque chose, elle réveille VRM. VRM fait avancer chaque commande
  d'**un pas**, l'écrit, puis se rendort.
- Une vente eBay, un scan du transporteur ou une vente Vinted captée par
  l'extension ne font qu'**avancer l'heure** du prochain battement.
- Rien ne dépend de ton app ouverte. Rien ne dépend non plus d'un cron Vercel :
  ton plan n'en permet qu'un par jour.

**Ce qui se passera tout seul dès le premier jour.** Ce sont des lectures, sans
aucun risque :
1. Ton téléphone sonne dans la minute : « **Vendu sur eBay — N°214 · à poster
   avant mer. 14/10 · retire-la de Vinted** ».
2. La vente entre dans Colis, Ma journée, le widget et le rappel du matin. Elle
   porte le N° du carton, lu dans le SKU, et la date limite donnée par eBay.
3. Une paire vendue sur Vinted mais encore en vente sur eBay est **sonnée**. Elle
   est aussi **retirée d'eBay**, même app fermée, puisque tu as allumé le retrait
   automatique (`vrm_ebay_retrait_auto = "true"`, relevé par `etat.md`).
4. Le colis est suivi jusqu'au client :
   - « pas encore scanné » au bout de 48 h ;
   - « bloqué » ;
   - « au relais jusqu'au 14/10 » ;
   - « livré le 12/10 ».

   La **preuve de livraison** est gardée, pour le jour où un client dit « pas
   reçu ».
5. Une annulation demandée donne « **ne poste pas** ». Un retour ou une
   réclamation arrive dans Ma journée avec sa date limite.

**Ce qui se fera tout seul si TU l'allumes.** C'est éteint par défaut, avec des
plafonds, et tout est écrit dans un journal. La première semaine se fait en
**« répétition »** : l'agent écrit ce qu'il aurait fait, sans le faire.
- **Acheter le bordereau**, quand eBay te laisse le choix du transporteur. Il est
  ensuite tamponné du N° et du titre, comme ceux de Vinted, et son suivi est
  déclaré à eBay.
- **Écrire au client** : « merci », « votre colis vous attend au relais jusqu'au
  … », « livré ».
- **Laisser une évaluation positive** une fois le colis livré.
- **Baisser le prix d'une paire qui dort**, jamais sous ton plancher. **Envoyer
  une offre à ses observateurs**, jamais sous le seuil de ta règle d'offre.

**Ce qui reste ton geste, et pourquoi :**
- **Emballer et déposer le colis.** Personne ne peut le faire à ta place.
- **Imprimer le bordereau.** C'est un clic (« Tout imprimer », comme pour
  Vinted).
- ⚠️ **Si eBay impose SON bordereau sur ton compte**, il s'achète dans eBay.
  - C'est probable pour un compte particulier. À mesurer à ta première vente
    (§1.3).
  - Aucune API ne permet de l'acheter en France.
  - L'agent prépare tout et te donne **un** bouton qui ouvre la bonne page.
  - Il relit ensuite tout seul le numéro de suivi chez eBay, et fait le reste.
- **Retirer une paire de Vinted.** VRM ne touche jamais une annonce Vinted (§3 du
  dossier : c'est ce qui a fait bloquer le compte `vanessa5723`). Il te sonne,
  c'est tout.
- **Un problème de transport, une réclamation, un retour.** L'agent prépare le
  message et la décision ; c'est toi qui les envoies.

⚠️ **Tout de suite, avant tout le reste : la N°553 est vendue sur Vinted et
toujours en vente sur eBay** (annonce `128127336988`, 120 €). VRM l'a relue pour
la dernière fois le 10 octobre à 22 h 29, et elle n'a pas bougé depuis
**[mesuré]**. Retire-la d'eBay. Le premier chantier corrige ce qui l'a laissée
passer (§13, chantier 1).

---

## 1. D'où on part

### 1.1 L'état réel (repris d'`etat.md`, et revérifié aujourd'hui sur sa base)

- **La production** (`main`, `61ef35a`) n'a qu'un compte eBay.
  - Elle sait publier, programmer, relier une annonce à une paire, baisser un
    prix, faire une offre aux observateurs et retirer une annonce. Le retrait
    automatique, lui, ne tourne que **l'app ouverte**.
  - **Après une vente eBay, rien ne se passe** : pas de N° de carton, pas de date
    limite, pas de bordereau, pas de suivi, pas de message, rien dans Colis.
- **Deux chantiers sont prouvés mais pas fusionnés** : plusieurs comptes eBay, et
  la règle d'offre. Ils vivent sur la branche `worktree-wf_30feaf2f-334-8`
  (23 commits), qui a 32 commits de retard sur `main` **[étude]**.
- **Dans sa base [mesuré]** :
  - Les lignes `ebay_*` sont inchangées depuis le 10 octobre à 20:29:12 UTC
    (`capturedAt` = 1791664152309) : **0 commande** et **3 annonces**
    (`VRM-559`, une sans SKU, et `VRM-553`, déjà vendue sur Vinted).
  - Aucune ligne `ebay_comptes`, `ebay_offres`, `ebay_brouillons` ni
    `ebay_finances`.
  - **`pg_cron` 1.6.4 et `pg_net` 0.20.0 sont disponibles, mais pas installés.**
    `pgcrypto` et `supabase_vault` sont installés.
  - Les tables publiques sont : `abonnements`, `app_data`, `detourage_usage`,
    `vinted_accounts` et `vrm_reglages` (colonnes `cle`, `valeur`).
  - Les modèles de fonction « serveur seulement » existent déjà :
    `vrm_detourage_reserver` / `_rendre` (réserver une unité d'un plafond en une
    instruction) et `vrm_acces_pour`.
  - Aucune fonction `vrm_numerotation_*` : **la migration 013 n'est pas
    appliquée**.
- **Code [mesuré]** :
  - 12 fonctions Vercel sur 12 permises ;
  - un seul cron (`/api/ship-reminders`, 08:00 UTC) ;
  - Trading au niveau de compatibilité **1149** (`api/ebay.js:146`).

### 1.2 Ce que les études du jour établissent (l'essentiel)

| sujet | conclusion | source |
|---|---|---|
| Acheter une étiquette **eBay** par API en France | **impossible** : la Logistics API ne fait que l'USPS, depuis les États-Unis | `bordereaux.md` §1 (code lu du SDK + extraits) |
| Acheter un bordereau **chez un agrégateur** pour CETTE commande | **possible**, et le n° de suivi est alors connu **par identité** (VRM l'a créé pour cet `orderId`). La conclusion du 9 octobre (« aucune identité commune ») ne tient plus dans ce cas | `bordereaux.md` §0 |
| Prestataire | Boxtal v3 d'abord (compte pro, prélèvement SEPA différé, bac à sable) ; Sendcloud ensuite ; Packlink seulement « à moitié » (on paie dans Packlink) | `bordereaux.md` §2 |
| Point relais choisi par l'acheteur | **aucun champ documenté** dans `getOrder` pour la France ⇒ on n'achète jamais un relais « deviné » | `bordereaux.md` §3 (schéma lu dans le SDK) |
| « Livré » | eBay ne le dit **jamais** au vendeur par API ; il faut lire le transporteur | `suivi.md` §3.2 (extraits) |
| Suivi transporteur | La Poste « Suivi v2 » (Colissimo, Chronopost) avec une clé gratuite ; webhooks Boxtal et Sendcloud ; **Mondial Relay : pas d'API publique sans contrat** | `suivi.md` §2 |
| Écrire au client | `AddMemberMessageAAQToPartner`, jusqu'à 90 jours après la commande. **Aucun lien**, jamais exiger une évaluation. eBay prévient déjà l'acheteur de l'envoi | `suivi.md` §4 (extraits) |
| L'horloge | `pg_cron` + `pg_net` dans Supabase (plan Pro, inclus) ; aucun cron Vercel ajouté | `infra.md` §3 |
| L'oreille | Notification API REST : `ORDER_CONFIRMATION` (vente payée), `AUTHORIZATION_REVOCATION` | `infra.md` §2 |
| Quotas | Trading : **5 000 appels/jour pour toute l'application** ; renouvellement de jeton : 50 000/jour. Il faut **garder le jeton d'accès** (aujourd'hui un renouvellement par action) et un garde-quota | `infra.md` §5 |
| Sécurité | le jeton eBay est en clair, lisible par le navigateur du vendeur, et recopié dans deux sauvegardes ⇒ à chiffrer | `infra.md` §1.1, §6.1 |
| Vercel Hobby | « usage personnel non commercial » ⇒ il faut passer en Pro **avant** les abonnés payants | `infra.md` §0 (extrait des Fair use guidelines) |
| Le défaut de la 553 | la preuve de vente ne lit que `harvest_*_txn_*` : elle rate **7 ventes récentes sur 14** ; avec le bordereau capté (`label.item`), elle en voit **12 sur 14** | `etat.md` §3.3 (mesuré) |

### 1.3 Trois corrections, après mes propres recherches d'aujourd'hui

1. **`ITEM_MARKED_SHIPPED` n'est pas une sonnette pour le vendeur.**
   - `infra.md` et `suivi.md` le proposaient pour savoir quand tu achètes le
     bordereau dans eBay.
   - Les notes de version de la Notification API (1.6.7, 12 décembre 2025) le
     décrivent ainsi : « notifies a **buyer** when the associated seller marks
     the item as shipped » **[extrait]**.
   - ⇒ L'agent ne s'appuie pas dessus. Il **relit** `getShippingFulfillments`
     sur un calendrier (§3.5). Si une mesure réelle montre un jour que le vendeur
     le reçoit aussi, ce sera un accélérateur de plus, rien d'autre.
   - Ce qui est confirmé, en revanche : `ORDER_CONFIRMATION` part « quand un
     acheteur termine le paiement », **une notification par ligne de
     commande**, et le vendeur relit ensuite la commande **[extrait du contrat
     AsyncAPI]**.
2. **`ShippingLabelPolicy = EBAY_ONLY` n'est pas confirmé.**
   - `bordereaux.md` le tire des notes de version Trading 1455.
   - Ma recherche ne le retrouve pas. Le résumé des notes 1455 (4 juin 2026)
     parle de « multileg shipments », d'un nouveau message d'erreur et de la
     standardisation des tailles **[extrait]**, pas de ce champ.
   - ⇒ **L'agent ne dépend pas de ce champ** (§8.1) :
     - s'il est lu, il fait foi ;
     - s'il ne l'est pas, c'est **ta déclaration**, par compte eBay, qui décide :
       « mes bordereaux, je les achète dans eBay » ou « VRM les achète ». Elle
       vaut **« dans eBay » par défaut** ;
     - ta première vente eBay dira ce qu'eBay t'impose.
3. **Le prestataire doit protéger contre un double achat, et Boxtal ne le
   documente pas.**
   - Boxtal : l'annulation est documentée (`DELETE /v3.1/shipping-order/{id}`,
     400 quand elle n'est plus possible) **[extrait]**. En revanche, je n'ai
     trouvé ni recherche par notre référence, ni idempotence.
   - Sendcloud : ses `POST` de création d'envoi « tentent d'être idempotents »
     avec `external_reference_id` **[extrait du support Sendcloud]**.
   - ⇒ Sur Boxtal, un achat **incertain** (coupure après l'envoi) **arrête
     l'agent pour cette commande** et te demande de regarder. On ne rachète
     jamais en aveugle (§6.3).
   - C'est un argument pour Sendcloud le jour où un vendeur y a droit. Le choix
     reste Boxtal d'abord, pour les raisons de `bordereaux.md`.

Au passage **[secondaire]** : eBay.fr ne prélève plus de frais de vente aux
particuliers de l'EEE depuis le 1ᵉʳ septembre 2026. C'est l'acheteur qui paie des
frais de protection. ⇒ Pour toi, le « reçu » d'une vente eBay sera proche du prix
de la paire. La règle « l'argent que tu reçois » (chantier `argent`) doit rendre
`frais = 0` sans tomber en « frais inconnus ».

---

## 2. Ce que tu vis, de la mise en ligne à l'évaluation

Légende du « mode » :
- **auto** : l'agent le fait seul ;
- **réglage** : il le fait seul **si tu l'as allumé**. C'est éteint par défaut,
  plafonné, et passe par la répétition d'abord ;
- **clic** : c'est ton geste, préparé par l'agent.

| moment | ce que l'agent fait seul | réglage (éteint) | ton clic | ce que tu vois |
|---|---|---|---|---|
| **Mise en ligne** | avant d'accepter « Publier » ou « Programmer », il revérifie que la paire n'est vendue nulle part, **et que tes ventes Vinted de ce compte ont été lues récemment** (garde de fraîcheur, §12-1). Après chaque publication, il revérifie à +10 min, +1 h et +6 h | — | publier / programmer (existant) | « Publiée · revérifiée il y a 8 min : pas vendue ailleurs » |
| **L'annonce vit** | relit tes annonces une fois par jour ; compte jours en ligne et observateurs ; lit offres et questions (chantier `boite`) | baisse de prix des paires qui dorment ; offre automatique aux observateurs (§12) | trancher une offre ; répondre à une question (réponse préparée) | Messages : « 2 offres eBay à trancher » ; carte : « en ligne depuis 21 j · 3 observateurs » |
| **Vendue ailleurs** (Vinted, Leboncoin) | prouve la vente **par identité** (transaction → annonce, ou bordereau → annonce) ; sonne « N°214 vendue sur Vinted, encore en vente sur eBay » | **retrait d'eBay** (existant, allumé chez toi) ; « mettre en pause » au lieu de terminer | — | « Retirée d'eBay automatiquement : N°214 (vendue sur Vinted) », dans le journal |
| **Vendue sur eBay** | dans la minute (sonnette `ORDER_CONFIRMATION`, sinon relecture toutes les 15 min) : N° par le SKU, date limite `shipByDate`, sonnerie ; retire les **autres** annonces eBay du même N° | — | **retirer la paire de Vinted** (VRM n'y touche jamais) | 📱 « Vendu sur eBay — N°214 · 89 € · à poster avant mer. 14/10 · retire-la de Vinted » |
| **Préparer l'envoi** | choisit la **voie** du bordereau (§8.1) : dans eBay, par VRM, ou à toi | voie VRM : achat (§8) | voie eBay : **un** bouton « Acheter le bordereau dans eBay » | Colis, groupe « Bordereau dans eBay » ou « Prêt à imprimer » |
| **Le bordereau** | voie VRM : devis, achat sous plafond, PDF tamponné, **suivi déclaré à eBay**. Voie eBay : relit le suivi qu'eBay a rattaché à la commande | — | imprimer (ou montrer le QR, si le transporteur en donne un) | « Bordereau prêt — Chronopost XW… · 8,40 € », N° tamponné |
| **Le dépôt** | attend le premier scan ; **rappel** la veille de la date limite à 18 h et le jour même à 9 h, s'il n'y a pas d'étiquette | — | **emballer, déposer** | Ma journée : « 1 colis eBay à poster avant demain » |
| **Le transport** | suit l'étape ; ne sonne pas pour « en transit » (rien à faire) ; alerte si aucun scan à 48 h, ou aucun mouvement pendant 5 jours ouvrés | — | réclamer au transporteur, si alerte | Colis, « Partis » : « en transit · dernier scan hier » |
| **Au relais** | lit la date limite de retrait **si** le transporteur la donne | message au client 2 jours avant la limite, une fois | — | « attend au relais jusqu'au 14/10 » |
| **Livré** | garde la **preuve** (transporteur, code, date de l'évènement), sans adresse ; la vente sort de Colis | message « livré » ; évaluation positive après livraison (ou le réglage natif d'eBay, §10.5) | — | sur la vente : « livré le 12/10 · preuve gardée » |
| **Évaluation reçue** | la lit ; une négative ou une neutre arrive dans Ma journée | — | y répondre dans eBay (jamais automatique) | « Évaluation neutre reçue — tu peux y répondre » |
| **Clôture** | 30 jours après la livraison sans incident : la commande est rangée | — | — | — |
| **Accidents** | annulation demandée ⇒ « ne poste pas » ; retour, réclamation, litige ⇒ date limite dans Ma journée ; colis renvoyé chez toi ⇒ « la paire revient » | annuler seul un bordereau VRM non utilisé (§8.8) | approuver ou refuser, rembourser, contester : **dans eBay** (lien) ; remettre en vente une paire revenue | Ma journée : « Retour demandé — N°214 · réponds avant jeudi » |

### 2.1 Et pour un autre revendeur (VRM à 12,99 €/mois)

| profil | ce qui change pour lui |
|---|---|
| **Particulier, étiquette eBay imposée** (sans doute ton cas) | Tout sauf l'achat du bordereau : un bouton par vente l'ouvre dans eBay. Le suivi est ensuite relu chez eBay, puis suivi jusqu'au client. **Il n'a aucune clé à coller.** |
| **Pro avec SIRET** | Il ouvre son compte Boxtal (ou Sendcloud), active le prélèvement, colle ses clés dans VRM, règle son colis type et ses plafonds. L'agent achète **avec son compte**. **VRM ne paie jamais un bordereau** et n'avance aucun argent. |
| **Particulier sans SIRET** | Pas de prélèvement Boxtal possible ⇒ la voie eBay (ou Packlink « à moitié » : VRM prépare, il paie dans Packlink). |
| **Revendeuse de vêtements ou de livres** | Son colis type (500 g, enveloppe) remplace le tien. Rien n'est supposé « chaussures » : pas de pointure exigée, catégorie jamais devinée. |
| **Deux comptes eBay** | Chaque compte a son jeton, ses plafonds, ses bordereaux. Le compte est nommé une fois quand tout est sur le même, sur chaque ligne sinon (§7 du dossier). |
| **Il cesse de payer** | L'agent s'arrête pour lui à la minute : plus aucun appel eBay, plus aucune notification. Ses données restent intactes. Il reprend tout seul quand il paie de nouveau. |
| **Sa base ou eBay hoquette** | Rien n'agit sur « pas su ». Les lectures reprennent au battement suivant. Il n'est prévenu que si une **date limite** approche. |

---

## 3. Le battement de cœur

### 3.1 Le principe

```
                    ┌───────────── accélérateurs (sonnettes) ─────────────┐
 eBay ORDER_CONFIRMATION · webhook transporteur · extension « vente Vinted rangée »
 · clic dans l'app · fin d'une étape qui en programme une autre
                    │   (chacun ne fait QU'UNE chose : vrm_agent_planifier(owner, tâche, maintenant))
                    ▼
 Supabase ── vrm_agent_file (tâches datées, baux) ── pg_cron chaque minute ──┐
                                                       (seulement si une tâche est due)
                                                                            ▼
            pg_net POST → https://vrm.center/api/ebay?mode=battement (secret du coffre)
                                                                            ▼
     25 s de travail : prendre ≤ 8 tâches (≤ 2 par vendeur, 1 par compte eBay),
     pour chacune : relire → décider (fonction pure) → agir (si permis) → écrire → reprogrammer
                                                                            ▼
                   journal relisible · notifications · état de chaque commande
     + 08:00 UTC (cron Vercel existant) : battement de secours + « l'horloge vit-elle ? »
```

**Trois idées qui font tout :**
1. **Un passage fait UN pas par commande.** Un pas est petit : il se reprend s'il
   est coupé, et deux passages ne font jamais le même pas, grâce aux baux (§6).
2. **Les évènements ne sont que des sonnettes.** Ils ne portent jamais de
   données. Ils avancent l'heure d'une tâche, et c'est la tâche qui **relit** chez
   eBay ou chez le transporteur, avec le jeton du bon compte. Une notification
   forgée coûte au pire une relecture freinée.
3. **Tout ce qui agit est décidé par une fonction PURE** (`decider`, §5.2) : on
   lui passe l'état, les faits relus et tes réglages, elle rend le geste. C'est
   ce qui permet de la prouver sur une matrice de cas, dans un `vm`, sans eBay.

### 3.2 Qui bat

**`pg_cron` + `pg_net`, dans ta base** (recommandation d'`infra.md`, reprise
telle quelle) :
- c'est inclus dans le plan Pro de Supabase ;
- il bat à la minute, et seulement s'il y a du travail ;
- **aucun cron Vercel ajouté** : un cron refusé bloque TOUS les déploiements.

Esquisse de migration, à passer **sur ton oui** :

```sql
-- supabase/migrations/014-agent.sql (esquisse)
create extension if not exists pg_cron;
create extension if not exists pg_net;   -- ⚠️ le schéma `net` ne doit JAMAIS être exposé à l'API

select cron.schedule('vrm-battement', '* * * * *', $$
  select net.http_post(
    url := 'https://vrm.center/api/ebay?mode=battement',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                     where name = 'vrm_battement_secret')),
    body := jsonb_build_object('tic', extract(epoch from now())::bigint),
    timeout_milliseconds := 30000)
  where (select valeur from public.vrm_reglages where cle = 'agent_ebay') = '1'   -- interrupteur d'installation
    and exists (select 1 from public.vrm_agent_file
                where prochain <= now() and coalesce(bail_jusqua, '-infinity') < now());
  update public.vrm_agent_horloge set dernier_tic = now() where id = 1;          -- le pouls, sans HTTP
$$);
select cron.schedule('vrm-purge-agent', '17 3 * * *', $$ select public.vrm_agent_purger() $$);
```

**Le secours** : le cron Vercel du matin (08:00 UTC, existant) appelle aussi la
même bibliothèque (`battementDeSecours`, 60 s). Il lit
`vrm_agent_horloge.dernier_tic` :
- **plus de 30 min** sans tic ⇒ une notification au propriétaire de
  l'installation (« l'horloge de l'agent est arrêtée — Supabase → Settings →
  General → redémarrer »), une ligne dans l'app, et la tâche est **recréée** ;
- toute tâche `veille` manquante pour un compte eBay actif est recréée aussi.
  L'agent **se répare** au moins une fois par jour.

### 3.3 Un battement, pas à pas

```
POST /api/ebay?mode=battement      (Authorization: Bearer <VRM_BATTEMENT_SECRET>, comparé en temps constant)
 1. vrm_reglages.agent_ebay ≠ '1' (ou illisible) ............................. 200 {arrete:true}
 2. anti-rafale, en UNE instruction :
      update vrm_agent_horloge set dernier_battement = now()
      where id = 1 and dernier_battement < now() - interval '20 seconds' returning 1
    aucune ligne ............................................................ 200 {ignore:true}
 3. jeton = uuid aléatoire ; fin = maintenant + 25 s
 4. tant que maintenant < fin :
      taches = vrm_agent_prendre(8, jeton, 120)        -- §4.4
      vide ⇒ sortir
      en parallèle (≤ 8), chacune dans contexteVendeur.run({owner}, …) :
         r = executerTache(tache, {jeton, fin})        -- ne lève jamais : rend {fait|reporte|erreur}
         vrm_agent_rendre(owner, cle, jeton, r.prochain, r.echec, r.raison)
 5. 200 {prises, faites, reportees, erreurs}           -- des NOMBRES : pg_net garde la réponse 6 h
```

`executerTache` dispatche sur le type de la clé :

| clé | travail | §  |
|---|---|---|
| `ebay:{s}:veille` | relit les commandes du compte (Fulfillment, `lastmodifieddate`, incrémental) ; crée et avance les tâches `cmd` | 3.5 |
| `ebay:{s}:annonces` | relit les annonces une fois par jour ; garde « une paire, une annonce » ; paires qui dorment (réglages prix) | 12 |
| `ebay:{s}:cmd:{orderId}` | avance la machine de CETTE commande | 5.1 |
| `vendeur:doubles` | croise les ventes Vinted / Leboncoin prouvées avec les annonces eBay (base seulement, aucun appel eBay) ; retrait si réglage | 12-1 |
| `ebay:{s}:boite` | offres et questions (chantier `boite`) | — |
| `ebay:{s}:apresvente` | annulations, retours, réclamations (chantier `litiges`) | — |
| `install:quota` | recale le compteur Trading sur `getRateLimits`, une fois par heure | 14 |

**Avant chaque tâche, trois portes, dans cet ordre.** Chacune a trois états :
1. **Abonnement** (`vrm_acces_pour`) :
   - `false` ⇒ la tâche est rendue +6 h, et le pouls dit « arrêté :
     abonnement » ;
   - `null` (pas su) ⇒ les **lectures** continuent, mais aucun geste qui coûte
     ou qui ne se défait pas.
2. **Interrupteur du vendeur** (`vrm_agent_vendeurs.actif`) : éteint ⇒ la tâche
   est rendue +1 h, sans aucun appel.
3. **Compte eBay** :
   - « refusé » (`invalid_grant`) ⇒ arrêt, et une notification « reconnecte
     {pseudo} » une fois par 7 jours ;
   - « pas su » ⇒ la tâche est rendue avec un délai qui grandit (1, 2, 4… min,
     plafonné à 60).

### 3.4 Les accélérateurs (sonnettes)

Aucun ne range de donnée. Tous se résument à `vrm_agent_planifier(owner, cle,
now())`, freiné à une fois par 2 minutes et par cible.

| source | preuve d'origine | qui est réveillé | route |
|---|---|---|---|
| eBay `ORDER_CONFIRMATION` | signature ECC `X-EBAY-SIGNATURE` (clé publique par `kid`, gardée 24 h en base) ; doublon écarté par `notificationId` (`vrm_agent_premiere_fois`) | `ebay:{s}:veille` du compte nommé, retrouvé par l'identité eBay du registre (`ebay_comptes`) | `?mode=notif` |
| eBay `AUTHORIZATION_REVOCATION` | idem | le compte passe « refusé » tout de suite | `?mode=notif` |
| eBay `MARKETPLACE_ACCOUNT_DELETION` | idem (spec `socle` §3.4) | anonymisation | `?mode=deletion` (existant, POST à finir) |
| webhook Boxtal `TRACKING_CHANGED` / `DOCUMENT_CREATED`, Sendcloud `parcel_status_changed` | HMAC-SHA256 du corps brut avec **le secret de l'abonnement de CE vendeur** ; adresse avec un identifiant opaque par vendeur | `ebay:{s}:cmd:{orderId}` retrouvé par **notre référence** (`vrm-{orderId}`) ou l'identifiant d'envoi rangé | `?mode=transporteur&k=` |
| extension : `orders_sold` Vinted **écrit avec succès**, et au moins une transaction nouvelle | session VRM de l'extension (5.160) ; au plus une fois par 10 min (`chrome.storage.local`) | `vendeur:doubles` | action `veiller` (spec `retrait-serveur` §3.3) |
| un clic dans l'app (« ↻ », publier, relier, acheter) | session du vendeur | la tâche concernée | actions de `api/ebay.js` |
| la fin d'une étape | — | l'étape suivante, à son heure | interne |

**Le filet, toujours** : aucune sonnette n'est garantie. eBay réessaie 3 fois,
puis plus rien **[étude : infra §2.1, extraits]**. Chaque compte garde donc sa
tâche `veille` (§3.5), même quand les sonnettes marchent.

### 3.5 Les cadences

| quoi | quand | appels |
|---|---|---|
| `veille` (commandes) | toutes les **15 min** si les sonnettes eBay ne sont pas actives ; toutes les **60 min** si elles le sont (une reçue depuis moins de 7 jours, ou un test d'abonnement réussi) ; **tout de suite** après une sonnette | 1 à 2 Fulfillment (quota 100 000/jour) |
| `annonces` | **1 fois par jour** ; et juste après une publication, une vente ou un retrait | 1 Trading `GetMyeBaySelling` (léger, sans `GetItem` en masse) |
| `vendeur:doubles` | à chaque sonnette de l'extension ; toutes les **30 min** tant qu'une annonce eBay avec SKU est en ligne (sinon jamais) ; **+10 min, +1 h, +6 h après chaque publication eBay** | 0 appel eBay ; lectures **projetées** de la base (`meta->>`) |
| commande `payee` → `a_expedier` | tout de suite | 1 `getOrder` + 1 Trading `GetOrders` (la politique d'étiquette, §8.1), une seule fois |
| `a_expedier`, voie eBay | `getShippingFulfillments` toutes les **2 h**, jusqu'à `shipByDate` + 1 jour ; rappels à **J-1 18 h** et **J 9 h** (heure de Paris) | Fulfillment |
| étiquette sans scan | transporteur toutes les **6 h** ; alerte à **48 h** ou à `shipByDate` | 1 lecture transporteur |
| en transit | toutes les **12 h** ; « bloqué » après 5 jours ouvrés sans évènement | 1 lecture transporteur |
| au relais | toutes les **12 h** ; message J-2 à **10 h** (si réglage et si la limite est connue) | 1 lecture + au plus 1 message |
| livré | arrêt des lectures ; évaluation (réglage) dans la fenêtre des messages ; `close` à +30 jours | — |
| `apresvente` | toutes les **6 h** s'il existe une commande de moins de 60 jours ; sinon une fois par jour | Post-Order (chantier `litiges`) |
| `install:quota` | toutes les heures | 1 `getRateLimits` |

**Les heures décentes** : un message au client ne part qu'entre **9 h et 20 h,
heure de Paris** (calcul par `Intl`, comme `partsParis`). En dehors, il est
reprogrammé à 9 h.

### 3.6 Quand ça casse

| panne | ce qui se passe | ce que fait l'agent |
|---|---|---|
| Vercel ne répond pas (déploiement, 5xx, délai) | `pg_net` note l'échec ; `cron.job_run_details` dit pourtant « succeeded » | **rien n'est perdu** : les tâches restent dues ; un bail expiré (2 min) les libère |
| une tâche plante en plein milieu | son bail expire | reprise depuis le **dernier état écrit**. Un geste noté `en_cours` est lu comme **incertain**, jamais refait en aveugle (§6.3) |
| Supabase ne répond pas | plus d'horloge, plus de mémoire | **rien n'agit**. Au retour, la veille rattrape tout par date de modification (recouvrement d'1 h) |
| `pg_cron` s'arrête | plus de tic | le cron Vercel de 08:00 le voit (> 30 min), sonne le propriétaire, fait un battement de secours |
| eBay refuse le jeton (`invalid_grant`) | — | compte « refusé », ses tâches s'arrêtent, une notification par 7 jours |
| quota Trading presque épuisé | — | priorités (§14) : les **obligations** passent, le confort attend demain |
| deux battements en même temps | — | sans effet : une tâche n'a qu'un bail à la fois |
| un déploiement coupe un battement au milieu d'un achat | — | `en_cours` + bail expiré ⇒ **incertain** ⇒ réconciliation par référence (§6.3) |

---

## 4. La mémoire

### 4.1 Pourquoi des tables à part, et pas des lignes `app_data`

`infra.md` proposait des lignes `app_data` (`ebay_agent_cmd…`) protégées par un
déclencheur. Je recommande **des tables dédiées**, pour quatre raisons :

1. **Le verrou et la version se vérifient dans la même instruction SQL que
   l'écriture** (`update … where version = $v and <bail tenu>`). Avec
   `app_data`, il faudrait les recoller à un JSON.
2. **« Le serveur écrit, le vendeur lit » se dit par construction** : une règle
   RLS de lecture seulement, et aucune règle d'écriture. On n'a pas besoin de
   déclencheur-garde, que l'on peut oublier ou contourner.
3. **Le journal est une table où l'on ajoute** une ligne par geste. Ce n'est plus
   un JSON de 60 Ko qu'on relit et réécrit, où deux battements simultanés
   perdraient une entrée.
4. **L'app lit des colonnes** (`etape`, `numero`, `limite`…). La loi « jamais
   `select=data` sur une ligne lourde » (§4.4) est tenue d'office.

**Le prix de ce choix, à ne pas oublier :**
- la règle restrictive `abonnement_requis` doit être posée sur ces tables aussi ;
- « Fermer mon compte » doit les effacer (`owner=eq.`), et retirer ses
  abonnements de notification chez eBay ;
- la « sauvegarde complète » doit les exporter (lecture RLS) ;
- `sauvegarde.journal_ecritures` ne les trace pas, puisque son déclencheur ne vit
  que sur `app_data`. Un déclencheur jumeau est à ajouter si on veut la trace.

### 4.2 Les tables

```sql
-- Lisibles par leur vendeur (RLS : select own + abonnement_requis restrictive), AUCUNE règle d'écriture
create table public.vrm_agent_vendeurs (       -- une ligne par vendeur
  owner uuid primary key,
  actif boolean not null default false,        -- son interrupteur (arrêt d'urgence)
  reglages jsonb not null default '{}',        -- bornés par le serveur (§11.2) ; version ci-dessous
  reglages_version int not null default 0,
  repetition_jusqua timestamptz,               -- « répétition » (§6.5)
  pouls jsonb not null default '{}',           -- dernier passage, dernier succès, dernière erreur (code), arrêt (raison)
  maj timestamptz not null default now());

create table public.vrm_agent_commandes (      -- ce que l'AGENT sait d'une commande, au-delà du miroir eBay
  owner uuid not null, plateforme text not null default 'ebay', compte text not null, commande text not null,
  etape text not null, rang int not null, branche text,          -- §5.1
  numero text, voie text, limite timestamptz,                    -- N° (SKU), voie du bordereau, shipByDate
  transporteur text, suivi text, etape_colis text, colis_le timestamptz,
  en_cours jsonb,                                                -- {geste, cle, depuis} : écrit AVANT d'agir
  version int not null default 0, maj timestamptz not null default now(),
  data jsonb not null default '{}',                              -- ≤ 2 Ko : 20 transitions, bordereau{prestataire,id,prixCentimes,pdf},
                                                                 --   preuve{transporteur,code,date}, messages{type: date}, notifs{type: date}
  primary key (owner, plateforme, compte, commande));

create table public.vrm_agent_journal (         -- ce qui a été fait EN SON NOM — une ligne par geste, jamais réécrite
  id bigint generated always as identity primary key,
  owner uuid not null, compte text, at timestamptz not null default now(),
  geste text not null,                          -- 'retrait' | 'bordereau' | 'declaration' | 'message' | 'evaluation' | 'prix' | 'offre' | 'annulation-bordereau' …
  cible text, numero text,                      -- orderId / itemId, N°
  resultat text not null,                       -- 'fait' | 'refuse' | 'incertain' | 'aurait-fait' (répétition) | 'ecarte'
  centimes int, texte text, ref text, source text);   -- texte EXACT d'un message envoyé ; ref = id prestataire / fulfillmentId
create index on public.vrm_agent_journal (owner, at desc);

-- Serveur seulement (RLS activé, AUCUNE règle) — modèle : vrm_reglages
create table public.vrm_agent_file (owner uuid not null, cle text not null, groupe text not null,  -- groupe = compte eBay (1 par passage)
  prochain timestamptz not null, bail_jeton uuid, bail_jusqua timestamptz, essais int not null default 0,
  raison text, primary key (owner, cle));
create index on public.vrm_agent_file (prochain);
create table public.vrm_agent_compteurs (owner uuid not null, cle text not null,   -- '0000…' = global (quotas)
  n int not null default 0, centimes bigint not null default 0, primary key (owner, cle));
create table public.vrm_agent_vus (owner uuid not null, cle text not null, at timestamptz not null default now(),
  primary key (owner, cle));                    -- « déjà vu / déjà fait » : notificationId, évènement webhook, push, message
create table public.vrm_agent_horloge (id int primary key check (id = 1),
  dernier_tic timestamptz, dernier_battement timestamptz, dernier_succes timestamptz);
create table public.vrm_coffre (owner uuid not null, compte text not null, fournisseur text not null,
  v int not null, nonce bytea not null, chiffre bytea not null, tag bytea not null,
  etat text, teste_le timestamptz, maj timestamptz not null default now(), primary key (owner, compte, fournisseur));
```

**Le coffre** suit `infra.md` §6.1 :
- AES-256-GCM, avec une clé maîtresse sur Vercel (`VRM_COFFRE_CLE`, de type
  « sensitive ») ;
- une clé par ligne, dérivée par HKDF à partir de `owner` ;
- des données associées `owner|compte|fournisseur|v`. ⇒ Une valeur recopiée
  dans la ligne d'un autre vendeur ne se déchiffre pas.

Le coffre range les clés du transporteur, le secret du webhook, puis le jeton
eBay et le **jeton d'accès gardé 1 h 50**.

### 4.3 Ce qui reste dans `app_data`

Les **miroirs** de ce que dit eBay ne bougent pas, et restent leur propriétaire
(§11 du dossier) :
- `ebay_orders{s}`, devenu paginé, fusionné et **minimisé** (spec `socle`
  §3.3 : plus aucune adresse d'acheteur) ;
- `ebay_listings{s}`, `ebay_programmees{s}` ;
- `ebay_comptes`, `ebay_offres{s}` ;
- `ebay_retraits_auto{s}` (le journal du retrait existant ; il rejoindra
  `vrm_agent_journal`, puis restera lu en repli pendant un mois).

**Règle** : `vrm_agent_commandes` ne recopie jamais ce que le miroir porte. Elle
porte **seulement** ce que l'agent a ajouté : voie, bordereau, suivi transporteur,
messages envoyés, preuve de livraison.

### 4.4 Les fonctions SQL

Toutes sont `SECURITY DEFINER`, `search_path ''`, exécutables par `service_role`
**seulement**. ⚠️ **Le temps est un paramètre** (`p_maintenant timestamptz
default now()`) : c'est ce qui permet de faire tourner un audit sur une horloge
simulée (§13.2).

| fonction | rôle | garantie |
|---|---|---|
| `vrm_agent_prendre(lim, jeton, bail_s, p_maintenant)` | prend les tâches dues au bail libre ; **≤ 2 par vendeur, ≤ 1 par `groupe`** (un compte eBay n'a jamais deux appels en vol) | `for update skip locked` dans une sous-requête, puis le tri par `row_number()` dans la requête du dessus (les fonctions de fenêtre ne se mêlent pas à `FOR UPDATE` au même niveau) ; les lignes verrouillées mais non choisies sont relâchées en fin de transaction |
| `vrm_agent_ecrire_commande(…, jeton, version_lue, colonnes)` | écrit l'état d'une commande | **0 ligne** si la version a bougé **ou** si le bail n'est plus tenu par ce jeton ⇒ on relit, on n'écrase jamais |
| `vrm_agent_rendre(owner, cle, jeton, prochain, echec, raison)` | libère le bail et fixe la prochaine fois | seulement si le bail porte ce jeton ; un échec fait monter `essais` et le délai |
| `vrm_agent_planifier(owner, cle, groupe, quand)` | « fais-la au plus tard à `quand` » | `insert … on conflict do update set prochain = least(prochain, quand)` ; ne vole jamais un bail tenu |
| `vrm_agent_premiere_fois(owner, cle)` | rend `true` une seule fois | `insert … on conflict do nothing returning true` : c'est le mémo de dédoublonnage, écrit **avant** l'envoi |
| `vrm_agent_reserver(owner, compte, centimes, plafonds…)` | réserve un achat contre les plafonds du geste, du jour et du mois | une instruction ; tout ou rien |
| `vrm_agent_rendre_reservation(…)` | rend une réservation | seulement sur un **refus** prouvé, jamais sur un incertain |
| `vrm_agent_quota(cle, priorite, n)` | réserve des appels Trading (compteur global) | seuils par priorité (§14) |
| `vrm_agent_noter(owner, entree)` | ajoute une ligne au journal | — |
| `vrm_agent_purger()` | vide `vus` (> 14 j), `cron.job_run_details` (> 7 j), compacte les commandes `close` depuis 90 jours, et le journal (> 13 mois) | — |

### 4.5 Les tailles

- Une commande pèse au plus 2 Ko. À 1 300 comptes eBay vendant chacun une
  paire par jour, ça fait environ **80 Mo par mois** avant compaction.
- Une commande close depuis 90 jours ne garde que ses scalaires : étape, dates,
  N°, montant du bordereau, preuve. Elle n'est **jamais** supprimée sans trace.
- Le journal compte environ 5 lignes par vente ; il est gardé 13 mois. Ce qui
  fait foi en comptabilité, ce sont les factures du transporteur.

---

## 5. Les machines à états

### 5.1 La commande

Le **rang ne descend jamais**. Une **branche** peut s'ouvrir à tout moment ;
quand elle se ferme, la commande reprend son rang. Un évènement inconnu ne change
**rien** (il est noté dans `data.transitions`).

| rang | étape | on y entre quand (preuve, par identité) | l'agent fait | garde · « pas su » | mode |
|---|---|---|---|---|---|
| 0 | `historique` | la commande existait déjà à la **toute première** lecture du compte | rien : ni geste, ni sonnerie (sinon « 30 ventes ! » d'un coup) | — | — |
| 1 | `payee` | `getOrder` : `PAID`, pas `FULFILLED` | sonne « Vendu sur eBay » (mémo avant) ; N° par le SKU de la ligne ; programme `vendeur:doubles` ; programme le retrait des **autres** annonces eBay du même N° ; lit la politique d'étiquette | SKU absent ⇒ « pas reliée à une paire », le reste continue ; aucun N° tiré du titre | auto |
| 2 | `a_expedier` | voie décidée (§8.1) : `ebay` · `vrm` · `toi` · `attendre` | rappels J-1 et J ; voie `vrm` ⇒ rang 3 si le réglage le permet ; voie `ebay` ⇒ bouton + relecture des envois toutes les 2 h | une annulation demandée ouvre la branche ; une politique pas lue ⇒ voie `ebay` | auto / réglage |
| 3 | `etiquette_en_cours` | écrite **avant** l'achat : `en_cours = {geste:'acheter', cle:'vrm-{orderId}', prix}` | achète (§8.3) | plafonds réservés avant ; abonnement **`true`** exigé | réglage |
| 3′ | `etiquette_incertaine` | coupure, ou `en_cours` trouvé avec un bail expiré | **réconciliation** par référence chez le prestataire (§6.3) ; sans preuve ⇒ **arrêt**, et « regarde dans Boxtal si un bordereau existe pour la commande … » | **jamais un second achat sans preuve qu'il n'y a pas eu de premier** | clic |
| 4 | `etiquette_prete` | n° de suivi + transporteur + PDF rangé (stockage privé), tamponné | sonne « Bordereau prêt à imprimer — N°214 » ; déclare le suivi à eBay | transporteur absent de la table d'eBay ⇒ pas de déclaration, et c'est dit | auto (dans le réglage) |
| 4′ | `declaration_incertaine` | coupure pendant `createShippingFulfillment` | relit `getShippingFulfillments` : notre n° de suivi présent = fait | — | auto |
| 5 | `declaree` | `fulfillmentId` rendu par eBay (voie VRM) **ou** suivi lu chez eBay (voie eBay, ou toi) | suit le colis | — | auto |
| 6 | `pris_en_charge` | premier scan (transporteur, webhook, ou email au **même** n°) | — | 48 h sans scan ⇒ drapeau `pas_scannee` + alerte | auto |
| 7 | `en_transit` | | rien, aucune sonnerie | 5 jours ouvrés sans évènement ⇒ branche `probleme` | auto |
| 8 | `au_relais` | évènement « disponible », + date limite **si lue** | programme le message J-2 | date inconnue ⇒ aucun message | réglage |
| 9 | `livree` | « distribué » au même n° | garde la preuve (sans adresse) ; message « livré » ; évaluation | authentification ⇒ « livré à l'authentificateur », jamais « au client » | auto / réglage |
| 10 | `close` | livrée + 30 jours, aucune branche ouverte | compaction | — | auto |

**Branches** (hors rang, chacune avec sa date limite si eBay la donne) :

| branche | conséquence |
|---|---|
| `annulation_demandee` | « ne poste pas ». Si une étiquette VRM est prête et non scannée, l'annulation du bordereau est **proposée** (§8.8) |
| `annulee` | fin. Bordereau annulé si c'est possible et permis |
| `retour_ouvert` | « retour en cours » sur la vente |
| `reclamation` (objet non reçu) | la **preuve de livraison** est prête, la réponse est préparée ; tu l'envoies |
| `litige_paiement` | date limite dans Ma journée ; lien eBay |
| `probleme` | message « problème » préparé ; tu l'envoies |
| `retour_expediteur` | « la paire te revient » ⇒ proposition de remise en vente (§12-7) |
| `authentification` | aucun message de transport au client |

**Arrêt de tout geste automatique** sur une commande dès qu'une branche est
ouverte. Seules les lectures continuent.

### 5.2 La décision est une fonction pure

```
decider(etat, faits, reglages, maintenant) → {
  geste:   'rien' | 'attendre' | 'sonner' | 'acheter' | 'declarer' | 'message' | 'evaluer'
           | 'proposer' | 'annuler-etiquette' | 'retirer' | 'baisser' | 'offrir',
  pourquoi: code (lisible à l'écran, jamais un texte d'eBay brut),
  engage:  booléen (coûte ou ne se défait pas),
  centimes: montant engagé (0 sinon),
  cle:     clé d'idempotence du geste,
  suivant: { etape, rang, branche, prochain },
  notif:   { categorie, type, texte } | null,
  journal: { geste, resultat:'aurait-fait'|…, texte } | null
}
```

`faits` porte chaque fait sous **trois états** : la valeur, `null` (pas su, la
lecture a échoué), ou `undefined` (pas demandé). La fonction vit dans
`api/_lib/agent-ebay-regle.js`. Elle n'a aucun appel réseau et aucune horloge :
le temps est un paramètre.

**Les invariants, que l'audit exécute sur une matrice :**
1. Un fait **requis** par un geste vaut `null` ⇒ `geste ∈ {rien, attendre}`.
2. `engage` ⇒ tout est vrai à la fois :
   - le réglage de ce geste est allumé ;
   - l'abonnement vaut `true` ;
   - le compte est `ok` ;
   - aucune branche n'est ouverte ;
   - on n'est pas en répétition.

   Sinon, `resultat: 'aurait-fait'` ou `rien`.
3. `rang(suivant) ≥ rang(etat)`.
4. Aucune décision ne lit un titre (§5 du dossier) : l'audit **mute** le titre
   sur toute la matrice, et la sortie doit rester identique.
5. Un N° n'existe que par `numDeSkuEbay(sku)`. Sinon il vaut `''`.

### 5.3 L'annonce (dérivée, pas stockée)

L'état d'une annonce eBay se **recalcule** à chaque passage, à partir des
miroirs : `ebay_listings`, `ebay_programmees`, la preuve de vente multi-sources
et tes réglages. Il n'y a rien à garder, donc rien à désynchroniser.

| état | règle | gestes possibles |
|---|---|---|
| `en_ligne` | active, avec SKU | — |
| `non_reliee` | active, sans SKU | « relier » (clic) ; **aucun geste automatique** |
| `dort` | en ligne depuis ≥ `SLEEP_DAYS` (la règle de Vinted, §11 du dossier) | baisse de prix et offre aux observateurs (réglages, §12) |
| `vendue_ailleurs` | N° prouvé vendu sur Vinted ou Leboncoin (preuve multi-sources, §12-1), et aucune AUTRE annonce Vinted de ce N° en vente | retrait (réglage existant) ou pause (réglage `annonces-vivantes`) |
| `vendue_ici` | une commande eBay engagée porte ce SKU | « retire-la de Vinted / Leboncoin » (message) |
| `deux_annonces` | le même N° est en vente sur deux annonces eBay | signalé ; **aucune** n'est touchée (règle existante) |
| `programmee` | dans `ebay_programmees`, et vendue ailleurs | « annule sa programmation » (proposé ; l'annulation par l'API n'est pas prouvée) |
| `revenue` | sa vente revient (remboursée, retournée, renvoyée à l'expéditeur) | « remettre en vente » (clic) |

Les **mémos** (« déjà retiré », « déjà baissé ce jour ») passent par
`vrm_agent_premiere_fois` et des clés datées.

### 5.4 Le compte eBay et le vendeur

| état | entrée | effet sur l'agent |
|---|---|---|
| `ok` | le renouvellement du jeton rend un `access_token` | tout |
| `refuse` | `invalid_grant` ou `AUTHORIZATION_REVOCATION` | arrêt pour ce compte, notification une fois par 7 jours, bouton « Reconnecter » |
| `pas_su` | réseau, 5xx, 429 | lectures reportées ; aucun geste |
| vendeur `arrete` | son interrupteur | rien, aucun appel |
| vendeur `abonnement` | `vrm_acces_pour = false` | rien, aucun appel, aucune notification |
| installation `arretee` | `vrm_reglages.agent_ebay ≠ '1'` | aucun battement, pour personne |

---

## 6. Verrous, idempotence, « pas su », « incertain »

### 6.1 Quatre verrous, chacun pour une raison

1. **Un bail par tâche** (`vrm_agent_prendre`, 120 s) : deux battements ne
   prennent jamais la même tâche.
2. **Un seul appel en vol par compte eBay** (`groupe`) : ordre garanti, pas de
   rafale chez eBay. C'est de la politesse et du quota. **Ce n'est pas le
   garde-fou anti-robot de Vinted**, qui ne bouge pas.
3. **La version** de chaque commande : une écriture sur une version périmée rend
   0 ligne.
4. **La réservation d'argent** : faite avant l'achat, en une instruction, et
   rendue seulement sur un refus prouvé.

### 6.2 Écrire avant d'agir

Pour tout geste qui coûte, qui ne se défait pas, ou qui parle au client :

```
1. écrire en_cours = {geste, cle, depuis}            (version + bail)   ── échoue ⇒ ne PAS agir
2. (argent) vrm_agent_reserver                                            ── refusé ⇒ « plafond », ne pas agir
3. (message, notification) vrm_agent_premiere_fois(cle) — VÉRIFIÉ          ── false ⇒ déjà fait, ne pas agir
4. appeler (eBay, prestataire)                  → ok | refus | incertain
5. écrire l'issue (version + bail), effacer en_cours, journal, prochain
```

Une reprise qui trouve `en_cours` avec un bail expiré **ne sait pas** si l'étape 4
a eu lieu : elle passe en **incertain**, jamais en « à refaire ».

### 6.3 Geste par geste

| geste | clé d'idempotence | si incertain | refait seul ? |
|---|---|---|---|
| acheter un bordereau (Sendcloud) | `external_reference_id = vrm-{orderId}` (idempotence annoncée **[extrait]**) | relire par référence, ou renvoyer le même `POST` (mêmes champs) | oui, **une fois**, puis arrêt |
| acheter un bordereau (Boxtal) | notre référence dans la commande **[champ à vérifier]** | aucune recherche par référence documentée ⇒ **arrêt**, et ton clic : « Regarde dans Boxtal → Mes envois s'il y en a un pour la commande … » avec deux boutons (« il y en a un : n° de suivi … » / « il n'y en a pas : réessaie ») | **non** |
| déclarer le suivi à eBay | le n° de suivi (une identité) | `getShippingFulfillments(orderId)` : présent ⇒ fait | oui, après relecture |
| retirer une annonce eBay | SKU attendu, relu par `GetItem` (existant) | `GetItem` : terminée ⇒ fait | oui, après relecture (règle existante) |
| baisser un prix | `prix:{itemId}:{jour}` | `GetItem` : prix visé ⇒ fait | oui, après relecture |
| message au client | `msg:{orderId}:{type}` (mémo écrit **avant**) | **jamais renvoyé** ; le journal dit « incertain — regarde ta messagerie eBay » | **non** |
| évaluation | `eval:{orderId}:{lineItemId}` (mémo avant) ; vérifié dans `GetItemsAwaitingFeedback` | relu dans `GetItemsAwaitingFeedback` : absente ⇒ faite | non, sans relecture |
| annuler un bordereau | id d'envoi du prestataire | relire l'envoi chez le prestataire | oui, après relecture |
| offre aux observateurs | `offre:{itemId}:{mois}` (mémo avant) | relire `find_eligible_items` ne prouve rien ⇒ **jamais renvoyée** | **non** |
| notification sur ton téléphone | `push:{type}:{cible}` (mémo avant) | — | non |

### 6.4 Les trois états, partout

- Une lecture rend **la valeur**, ou **`null`** (pas su). Jamais `[]` ni `0` à la
  place d'un échec (§4.1 du dossier, retourné).
- « Pas su » **n'agit jamais** ; il **reporte**, et il est **dit une fois**
  (« je n'ai pas pu relire tes ventes eBay depuis 3 h »).
- Tu n'es prévenu d'un « pas su » que s'il bloque une **obligation** : une date
  limite d'envoi à moins de 24 h, ou une date limite de réponse. Jamais à chaque
  hoquet.
- Une liste lue **en partie** n'est jamais présentée comme complète. On écrit
  « au moins », et on dit ce qui manque.

### 6.5 Trois interrupteurs, et la répétition

1. **L'installation** : `vrm_reglages.agent_ebay`, à `'0'` par défaut. Pas de
   battement du tout.
2. **Toi** : « Agent eBay : actif / arrêté », un bouton, sans confirmation pour
   **arrêter**, avec confirmation pour reprendre.
3. **Chaque geste qui engage** : son propre réglage, éteint, avec ses plafonds.

**La répétition** :
- tant que `repetition_jusqua` est dans le futur (7 jours à l'allumage d'un
  geste), `decider` rend le même geste, mais l'agent **ne l'exécute pas** ;
- il écrit au journal « **aurait fait** » : « aurait acheté Colissimo domicile,
  8,40 €, pour N°214 », « aurait écrit au client : … » ;
- en même temps, il **lit** ce que tu as fait toi-même (le bordereau acheté dans
  eBay, par exemple), et le journal met les deux côte à côte ;
- tu passes en réel **toi-même** (« ça me va »), ou automatiquement au bout de
  7 jours **seulement si** tu as cliqué « passer en réel à la fin ».

**Le premier de chaque sorte se confirme toujours**, même en réel : le premier
bordereau d'un compte, et le premier message de chaque type. La confirmation
montre le geste exact (prix, transporteur, texte rendu). C'est ce qui te fait
voir l'agent travailler une fois, sur une vraie commande, avant de le laisser
faire.

---

## 7. Les routes : aucune nouvelle fonction Vercel

Tout est un **mode** ou une **action** de `api/ebay.js` (le plafond reste
12/12). Il faut deux réécritures dans `vercel.json`, et `bodyParser: false` sur
`api/ebay.js` (spec `socle` §3.4, un seul passage pour les signatures eBay et
transporteur).

**Les modes** (sans session ; chacun a sa propre preuve d'origine) :

| mode | preuve | fait |
|---|---|---|
| `battement` | `Bearer VRM_BATTEMENT_SECRET` (temps constant) | §3.3 |
| `notif` (`/api/ebay-notif`) | signature ECC eBay (corps brut ; repli `JSON.stringify(JSON.parse(brut))`, comme le code officiel d'eBay ; si les deux échouent ⇒ 412) | planifie, puis 204 en moins d'1 s |
| `transporteur` (`/api/ebay-transporteur/:k`) | `k` opaque ⇒ vendeur + prestataire ; HMAC avec SON secret (coffre) | `vrm_agent_premiere_fois(évènement)`, planifie, puis 2xx en moins de 2 s (exigence Boxtal) |
| `deletion`, `callback` | existants | `deletion` : finir le POST signé (spec `socle`) |

**Les actions** (session ; `vendeurExige` ; `resoudreCompte` ; ce qui engage
exige `confirme:true` **avant** tout appel) :

| action | rôle |
|---|---|
| `agent-etat` | pouls, réglages, compteurs du jour, état du coffre (« clé posée le 11/10 · testée ✓ », jamais la clé) |
| `agent-regler` `{reglages, version, confirme}` | **bornés par le serveur** (§11.2) ; une version périmée ⇒ 409, rien n'est écrasé |
| `agent-arreter` / `agent-reprendre` | son interrupteur |
| `agent-relire` `{cible}` | « ↻ » : planifie maintenant, au plus une fois par minute |
| `coffre-poser` · `coffre-tester` · `coffre-retirer` | clés du transporteur. Le test est une **lecture inoffensive** (profil, ou points relais de son code postal) |
| `bordereau-devis` `{orderId}` | lecture : prix, transporteur, poids utilisé |
| `bordereau-acheter` `{orderId, prixVu, confirme}` | le mode « préparer, je confirme » ; refusé si le devis a monté au-delà du `prixVu` |
| `bordereau-annuler` `{orderId, confirme}` | §8.8 |
| `bordereau-pdf` `{orderId}` | les octets, **seulement** pour le vendeur propriétaire de la commande |
| `bordereau-incertain` `{orderId, constat:'existe'\|'absent', suivi?}` | ta réponse au cas Boxtal incertain (§6.3) |
| `expedier` | un suivi **tapé** (spec `expedier` §4.3) |
| `message-preparer` · `message-envoyer` `{orderId, type, texte, confirme}` | les messages préparés (problème, réponses) |
| `abonner-notif` `{compte, confirme}` | `createSubscription` (REST) pour CE compte, avec son jeton |
| `veiller` | la sonnette de l'extension (spec `retrait-serveur`) |
| (chantiers du 9 octobre) | `offres`, `offre-reponse`, `questions`, `question-reponse`, `apresvente`, `evaluations`, `pause`, `reprendre`, `relist`… |

**`api/ship-reminders.js`** garde son rôle. Il ajoute :
- les ventes eBay au rappel du matin (`aExpedierEbay`, **recopiée**) ;
- le **battement de secours** ;
- le **contrôle du pouls**.

**La bibliothèque** se répartit ainsi :
- `api/_lib/agent-ebay.js` : `executerTache`, et les gestes avec leurs effets ;
- `api/_lib/agent-ebay-regle.js` : `decider` et `etapeColis`, purs ;
- `api/_lib/ebay-regle.js` : **recopié** depuis `App.jsx` par `--recopie`, jamais
  modifié à la main. Il porte `doublesVenteEbay`, `preuvesVentesVinted`,
  `aExpedierEbay`, `cleNum`, `numDeSkuEbay`, `PAS_UNE_VENTE`… ;
- `api/_lib/transport/{boxtal,sendcloud}.js`, avec une interface commune (§8.2) ;
- `api/_lib/coffre.js`.

---

## 8. Les bordereaux

### 8.1 Quelle voie pour CETTE commande

```
voieEtiquette(cmd, faits, reglages) :
  faits.authentification            ⇒ 'ebay'    (vers l'authentificateur ; qui fournit l'étiquette : [à vérifier])
  faits.politiqueEtiquette === 'EBAY_ONLY'                    ⇒ 'ebay'
  reglages.compte.etiquettes !== 'vrm'   (DÉFAUT : 'ebay')     ⇒ 'ebay'
  faits.politiqueEtiquette === null  (lecture ratée)         ⇒ 'ebay', raison 'pas-su'
  service payé = relais  et  !faits.pointRelaisId (identité) ⇒ 'ebay', raison 'relais-illisible'
  !coffre.ok                                                ⇒ 'toi'   (pas de prestataire relié)
  faits.poids === null                                       ⇒ 'attendre' (« règle ton colis type »)
  sinon                                                      ⇒ 'vrm'
```

**Le sens sûr est toujours « eBay ».** Dans le pire cas, tu cliques une fois de
trop : le bordereau d'eBay est même le moins cher (3,58 € pour un Mondial Relay
jusqu'à 1 kg **[étude : secondaire]**). L'autre sens serait un bordereau payé
deux fois, ou un suivi qu'eBay n'attend pas.

**La politique d'étiquette se lit une fois par commande**, par un appel Trading
`GetOrders` **dédié**, au niveau de compatibilité ≥ 1455 **[à vérifier]**.
⚠️ On ne monte **pas** le niveau de tous les appels Trading : ça changerait les
réponses de l'existant sans preuve. L'en-tête est posé appel par appel.

### 8.2 Le prestataire

Tous les prestataires passent par une seule interface :

```
transport = {
  nom, idempotentParRef: bool,
  devis({depart, arrivee, poids, dims, service}) → {prixCentimes, offre} | refus | null,
  points({cp, reseau}) → [...] | null,
  acheter({ref, offre, expediteur, destinataire, colis, point?}) → {id, suivi, transporteur} | refus | incertain,
  relireParRef(ref) → envoi | 'absent' | null,       // null = pas su ; absent n'est permis QUE si l'API le garantit
  etiquette(id, format) → octets %PDF | 'pas-pret' | null,
  suivi(id) → [évènements] | null,
  annuler(id) → ok | refus | incertain,
  verifierWebhook(corpsBrut, entetes, secret) → évènement | false
}
```

1. **Boxtal v3 d'abord** (`bordereaux.md` §2.3).
   - Pas d'abonnement connu, prélèvement SEPA différé (requis pour commander par
     l'API), bac à sable `api.boxtal.build`, webhooks signés.
   - L'annulation est documentée **[extrait]**.
   - `idempotentParRef: false` **[à vérifier]**.
   - Les devis passent par la v1 **[étude : code lu]** ; il faut peut-être une
     seconde paire de clés **[à vérifier]**.
2. **Sendcloud ensuite.**
   - Son modèle « décentralisé » prévoit que chaque vendeur ait son compte.
   - Idempotence annoncée par `external_reference_id` **[extrait]** ; annulation
     par `POST /v3/shipments/{id}/cancel`, sans garantie, et plus possible après
     42 jours **[extrait]**.
   - Un plan gratuit plafonné, puis payant **[étude : secondaire]**.
3. **Packlink « à moitié »** : VRM crée l'envoi, le vendeur paie dans Packlink.
   C'est le geste du vendeur, pas un agent.
4. **Aucun transporteur en direct** : un contrat par transporteur, et le web
   service Colissimo est réservé au contrat Privilège **[étude]**.

**VRM ne paie jamais un bordereau.** C'est le compte du vendeur chez le
prestataire, son prélèvement, sa facture. VRM n'est pas revendeur de transport :
pas de TVA sur le port, pas de trésorerie, pas de litige de facture.

### 8.3 L'achat, pas à pas (voie `vrm`)

1. **Relire la commande chez eBay** avec le jeton du compte (`getOrder`). Il faut
   tout à la fois :
   - `PAID`, pas `FULFILLED` ;
   - **aucun envoi déjà déclaré** (`getShippingFulfillments` vide) ;
   - aucune demande d'annulation ;
   - une adresse complète. Elle est lue, **jamais rangée**, et oubliée après
     l'appel.

   Un seul « pas su » ⇒ on n'achète pas.
2. **Le devis** : poids et dimensions (§8.5), service mappé (domicile : Colissimo
   ou Chronopost ; relais : seulement avec un `pointRelaisId` lu). On obtient un
   **prix exact**. ⇒ C'est le devis qui fait foi, jamais un prix calculé par VRM.
3. **Le plafond par geste** : un devis au-dessus fait passer la commande en
   « à confirmer » (push + Ma journée).
4. **Le mode** :
   - répétition ⇒ « aurait acheté … », et rien d'autre ;
   - « préparer, je confirme » ⇒ état `a_confirmer` + push « 1 bordereau eBay à
     confirmer : 8,40 € » ;
   - auto ⇒ on continue. **Le premier achat d'un compte se confirme toujours.**
5. **Écrire `en_cours`, réserver le prix** (§6.2).
6. **Commander** chez le prestataire :
   - référence `vrm-{orderId}` ;
   - contenu « chaussures d'occasion » (ou la famille réglée par le vendeur) ;
   - expéditeur = l'adresse d'expédition du vendeur (réglage) ;
   - destinataire = l'adresse lue à l'étape 1.
7. **L'issue** :
   - succès ⇒ id, suivi et transporteur rangés ;
   - refus ⇒ réservation rendue, raison du prestataire **telle quelle** au
     journal, retour à `a_expedier`, et push seulement si la date limite
     approche ;
   - incertain ⇒ 3′.
8. **Le PDF** : `etiquette(id)` ou le webhook `DOCUMENT_CREATED`.
   - Chez Boxtal, un `422` juste après la commande veut dire « pas prêt »
     **[étude : code lu]** : on réessaie à 30 s, 2 min et 10 min, sans l'afficher
     comme un échec.
   - On vérifie que les octets commencent par `%PDF`.
   - On tamponne (§8.7), puis on range dans le stockage privé
     `bordereaux/{owner}/ebay/{sha256}.pdf` (le chantier « PDF → stockage » en
     cours). **Jamais dans un JSON.**
9. **Déclarer** à eBay (§8.9).
10. **Sonner** (catégorie `agent`) ; Colis affiche « Prêt à imprimer ».

### 8.4 Le point relais

- **Service payé à domicile** ⇒ bordereau à domicile. L'agent ne passe **jamais**
  à un relais « plus proche » : c'est un service moins bon que celui payé, donc
  une réclamation possible.
- **Service payé en relais** ⇒ l'agent n'achète que s'il **lit** l'identifiant
  du point sur la commande. Aujourd'hui aucun champ n'est documenté
  **[étude : schéma lu]**. ⇒ Voie `ebay`, avec la raison.
- **Rapprocher une adresse de commerce d'un code de point relais**, ce serait
  une ressemblance (§5 du dossier). **Un colis envoyé au mauvais relais est un
  colis perdu.**
- **À la première vraie commande en relais**, l'agent note les **noms des clés**
  de `shipTo` (jamais les valeurs), comme la recon Leboncoin. On saura alors si
  un identifiant existe.

### 8.5 Le poids

Trois niveaux, montrés dans chaque confirmation et gardés au journal :
1. **Le colis type du vendeur**, réglage synchronisé : 1,5 kg et 36 × 24 × 14 cm
   par défaut, **à confirmer par ta balance** **[étude]**.
2. **La correction d'une paire** (bottes, XXL), rangée dans sa fiche
   (`vinted_annonce_numeros[id]`, comme le prix d'achat).
3. **Rien de réglé ⇒ pas su ⇒ on n'achète pas.**

⚠️ **Un poids sous-déclaré** est refacturé après coup par le transporteur
**[montants à vérifier]**, et certains facturent le volume (36 × 24 × 14 / 5000
≈ 2,4 kg) **[à vérifier]**. Le devis fait foi, et le journal garde le poids
déclaré.

### 8.6 Le paiement et les plafonds

**Les plafonds par défaut** (à toi de les fixer) :

| plafond | défaut | **maximum imposé par le serveur** |
|---|---|---|
| par bordereau | 12 € | 25 € |
| par jour et par compte | 10 bordereaux, 80 € | 30 bordereaux, 250 € |
| par mois et par vendeur | 300 € | 2 000 € |

Un réglage au-delà d'un maximum est ramené au maximum, et l'écran le dit.

**Les règles de la réservation :**
- elle se fait **avant** l'achat ;
- elle est **rendue** sur un refus prouvé ;
- elle est **gardée** sur un incertain (la règle du détourage : une coupure après
  la réponse a pu être facturée).

**Les conditions pour acheter**, toutes relues au moment d'acheter :
- l'installation, ton interrupteur et le réglage « VRM achète mes bordereaux »
  sur **ce** compte ;
- le coffre testé ;
- l'abonnement à `true` ;
- les plafonds réservés ;
- la commande relue (§8.3-1) ;
- aucune branche ouverte.

### 8.7 L'impression

- **Le format suit ton réglage `vrm_imprimante`** (existant, synchronisé) :
  - « thermique » ⇒ on demande au prestataire le format **10 × 15** natif
    (souvent A6), et le N° est tamponné **en petit, en bas**, comme tu l'as
    demandé le 15 septembre ;
  - « classique » ⇒ A4, avec le tampon titre + N° de Vinted.
  - Si le transporteur n'a pas de 10 × 15, le prestataire retombe sur A4
    **[étude : extrait Boxtal]**, et l'écran le dit.
- **Le tampon** : `stampBordereau` (`api/_lib/stamp.js`, existant), même
  géométrie que l'app, mêmes positions par format (`vinted_bordereau_formats`).
  Il n'y a **pas de second code de tampon**.
- **L'impression reste ton geste** : « Imprimer » sur la carte, « Tout
  imprimer » dans Colis. Les bordereaux eBay entrent dans le même lot que ceux
  de Vinted : une page par bordereau, `/Duplex /Simplex`.
- Si le transporteur donne un **QR de dépôt** (Mondial Relay le fait sur ses
  propres bordereaux **[étude : secondaire]**), la carte le montre. Tu peux alors
  déposer sans imprimer **[à vérifier par prestataire]**.

### 8.8 Annuler un bordereau inutilisé

Il est **proposé** (un bouton) quand tout est vrai :
- la commande est annulée ou remboursée en entier, **relue chez eBay** ;
- le bordereau a été acheté **par VRM** ;
- le transporteur ne donne **aucun scan** (« pas su » ⇒ on ne propose pas) ;
- le délai du prestataire le permet.

Un réglage, **éteint**, permet « annule seul un bordereau non scanné 24 h après
l'annulation de la vente ».
- Pourquoi 24 h : si tu as déposé le colis juste avant l'annulation, le scan
  arrive souvent dans la journée. Annuler une étiquette déjà dans le circuit
  ferait voyager un colis sans bordereau valide.
- Le remboursement attendu est noté au journal. Packlink ne s'annule que par un
  ticket : le bouton le **dit**.

### 8.9 Déclarer le suivi à eBay, par identité

- **L'appel** : `POST /sell/fulfillment/v1/order/{orderId}/shipping_fulfillment`
  `{lineItems: [toutes les lignes non expédiées, quantité], shippedDate,
  shippingCarrierCode, trackingNumber}`.
  - Réponse 201 et `Location` **[étude : extrait]**.
  - Le suivi s'envoie en majuscules, sans espace ni tiret.
- **Le code transporteur** vient de la table lue **une fois par place de
  marché** (`GET /sell/metadata/v1/shipping/marketplace/EBAY_FR/get_shipping_carriers`
  **[étude : code lu dans le SDK]**), rangée côté installation, relue une fois par
  mois.
  - **Un transporteur absent ⇒ pas de déclaration** (jamais `Other`), et c'est
    dit.
  - Rien n'est écrit en dur : les sources se contredisent sur `Colissimo` en
    France **[étude]**.
- **Quand** : dès l'achat. C'est le bordereau de CETTE commande, et eBay compte
  « suivi valide chargé dans le délai » **[étude : extrait]**. Si le colis n'est
  pas scanné en 48 h, l'alerte « pas scanné » le rattrape.
- **Voie eBay** : rien à déclarer. eBay rattache le suivi lui-même ; l'agent le
  **relit** (`getShippingFulfillments`) pour suivre le colis.

---

## 9. Le suivi jusqu'au client

### 9.1 Les sources

| bordereau | le n° de suivi vient de | les étapes viennent de |
|---|---|---|
| acheté **par VRM** | la réponse d'achat (identité) | webhook du prestataire, plus une relecture `suivi(id)` en secours au calendrier (§3.5) |
| acheté **dans eBay** (par toi) | `getShippingFulfillments(orderId)` (identité : eBay l'a rattaché à cette commande) | Colissimo et Chronopost : **La Poste Suivi v2**, avec une clé de l'installation (`LAPOSTE_OKAPI_KEY`) ; Mondial Relay : la ligne `email_track_*` **au même n°**, si le transporteur t'écrit en tant qu'expéditeur. Sinon « suivi pas lu (Mondial Relay : pas d'accès direct) », dit une fois |
| **tapé par toi** (`expedier`) | ta saisie | comme ci-dessus, selon le transporteur |

**Le n° de suivi est la seule clé.** Il est normalisé comme l'existant (`trim`,
majuscules). Jamais une date, un titre ou un point relais.

### 9.2 Une échelle, une fonction

`etapeColis(source, évènement)` est **pure**, côté serveur (`suivi.md` §2.4).
- Elle range dans l'ordre `etiquette` < `pris_en_charge` < `en_transit` <
  `au_relais` < `livre`, avec à part `probleme`, `retour` et `pas_su`.
- **Un code inconnu ne vaut jamais « livré »** : il vaut `en_transit` après un
  scan, `pas_su` avant.
- Le serveur est le **seul propriétaire** de l'étape rangée. L'app la lit (§11).

### 9.3 Les alertes

| alerte | règle | où |
|---|---|---|
| **pas scanné** | bordereau prêt (ou suivi chargé) et aucun `pris_en_charge` **48 h** après, ou `shipByDate` dépassée — même seuil que `posteSansDepart` (`POSTE_SANS_DEPART_H`) | Ma journée + push `expedier` |
| **bloqué** | en transit, aucun évènement depuis **5 jours ouvrés** ; ou date de livraison maximale estimée + 3 jours ouvrés dépassée | Ma journée + push `livraison` + message « problème » préparé |
| **au relais, pas retiré** | limite de retrait **connue** et à moins de 2 jours | message J-2 (réglage) ; sinon une ligne dans Colis |
| **renvoyé chez toi** | `RE1` / « Returned to sender » | Ma journée + push `livraison` ; « la paire revient » |

### 9.4 La preuve de livraison

Pour une commande `livree`, on garde dans `data.preuve` : le transporteur, le
code de l'évènement, sa date et le n° de suivi. **Aucune adresse, aucun nom, pas
même celui du relais.**

La vente affiche « livré le 12/10 · preuve gardée ». En cas de réclamation
« objet non reçu », la réponse préparée la cite. Tu l'envoies.

---

## 10. Parler au client, et l'évaluation

### 10.1 Le canal

- **Trading `AddMemberMessageAAQToPartner`**, avec le jeton existant, et
  **aucune nouvelle portée** **[étude : extraits]**.
- Il écrit à l'acheteur pendant **90 jours** après la ligne de commande
  **[extrait]**.
- **Le texte** : pas de HTML (refusé) ; les guillemets s'écrivent `&quot;` dans
  le XML **[extrait KB]**.
- **La limite d'envoi** par utilisateur et par objet n'est pas publiée ; au-delà,
  eBay répond « Service is not available » **[extrait KB]**. ⇒ C'est un refus, il
  n'est jamais réessayé dans l'heure.
- **Le destinataire** est toujours relu **sur la commande**. Il ne vient jamais
  du navigateur.

### 10.2 Les règles d'eBay, appliquées au texte RENDU

On contrôle le texte une fois les variables remplies, c'est-à-dire ce qui part
vraiment, pas le gabarit. Il est **refusé** s'il contient :
- une adresse web ;
- un email ;
- un numéro de téléphone ;
- une suite de 9 chiffres ou plus qui n'est pas le n° de suivi de **cette**
  commande ;
- une variable non remplie (`{`) ;
- une demande d'évaluation **assortie** d'une contrepartie (« remise », « code »,
  « cadeau ») **[étude : règlement d'eBay]**.

Le message n'apporte **aucun N° de rangement** (c'est ton carton, pas l'affaire
du client), et **aucune promesse** de date ni de remboursement.

### 10.3 Les messages

| message | quand | mode | garde |
|---|---|---|---|
| merci | à la vente, dans la fenêtre 9 h–20 h | réglage | `{délai}` inconnu ⇒ la phrase du délai est **retirée**, jamais un chiffre inventé |
| colis expédié + suivi | — | **jamais** | eBay le fait déjà, ce serait un doublon **[étude]** |
| au relais jusqu'au {date} | J-2 avant la limite, à 10 h, une seule fois | réglage | **seulement si la date limite est lue** chez le transporteur |
| livré | le jour de la livraison, dans la fenêtre | réglage | une phrase facultative sur l'évaluation, sans contrepartie (second interrupteur) |
| problème de transport | à l'alerte | **préparé, ton clic** | ce qu'on y dit t'engage |
| réponse à une question | à la réception | **préparé (IA), ton clic** | l'IA serveur est éteinte aujourd'hui (`ia:false`) ⇒ bouton grisé, champ libre |
| authentification en cours | — | **jamais** de message de transport | — |

**Les plafonds** :
- **20 messages par jour** et par compte eBay ;
- **3 par commande**, tous types confondus ;
- **un message par type et par commande**, mémo écrit **avant** l'envoi et
  vérifié (§6.2).

**« Pas su » n'envoie rien** :
- étape lue avant un échec ;
- commande annulée ;
- branche ouverte ;
- plus de 90 jours ;
- réglage pas encore arrivé du nuage.

**Le journal garde le texte exact** de chaque message parti, le type, l'`orderId`
et la réponse d'eBay. *Un message envoyé en ton nom que tu ne peux pas relire
serait le pire de tout.*

### 10.4 Les textes proposés (modifiables, au vouvoiement)

Ils sont repris de `suivi.md` §4.4, sans changement :
- *merci* ;
- *au relais* ;
- *livré* ;
- *problème*.

### 10.5 L'évaluation

1. **Recommandé : le réglage natif d'eBay**, « Automatiser les évaluations »
   (Préférences de vente → toutes les annonces et commandes).
   - Deux déclencheurs : après le paiement, ou après le paiement **et** une
     évaluation positive de l'acheteur **[extrait de l'aide eBay UK et AU ;
     eBay.fr à vérifier]**.
   - Aucune ligne de code, aucun appel, aucun risque d'API.
2. **La version VRM**, seulement si tu veux le déclencheur que l'agent est le
   seul à avoir : « **après livraison confirmée par le transporteur** ».
   - Réglage `vrm_ebay_eval_auto` (spec `litiges` §2.4), éteint.
   - Elle lit d'abord `GetItemsAwaitingFeedback`, ce qui évite un doublon avec le
     réglage natif.
   - `LeaveFeedback`, **Positive seulement**.
   - Une évaluation **ne se retire pas** : c'est dit à l'allumage.
3. **Jamais** une réponse automatique à une évaluation, et jamais une évaluation
   négative ou neutre.

---

## 11. Ce que tu vois

### 11.1 Les écrans

- **eBay, un cinquième onglet « Agent »**, à côté de Ventes, Achats, Annonces et
  Compte eBay. Il porte trois choses :
  1. **Le pouls**, une seule ligne : « Agent actif · dernier passage il y a 40 s ·
     prochain : relire tes ventes à 14 h 15 ». Ou bien « arrêté (ton choix) »,
     « arrêté : abonnement », « horloge arrêtée depuis 2 h — VRM s'en occupe »,
     « en répétition jusqu'au 18/10 ». **Gris par défaut, ambre seulement s'il y
     a un geste à faire** (§7 du dossier).
  2. **« Ce que VRM fait seul »**, les interrupteurs groupés par risque :
     - *Toujours* (lecture, alertes) : sans interrupteur, c'est dit ;
     - *Gestes réversibles* : retrait d'eBay (existant), pause, baisse de prix ;
     - *Gestes qui coûtent* : bordereaux, avec plafonds, poids et transporteurs ;
     - *Paroles au client* : messages, avec tes textes ;
     - *Évaluations*.

     Chacun montre ses plafonds, sa consommation du jour (« 2 bordereaux · 16,80 €
     aujourd'hui »), et « répétition / réel ». Un gros bouton **« Arrêter
     l'agent »**.
  3. **« Ce que VRM a fait en ton nom »**, le journal, par jour :
     - chaque geste avec son résultat (`fait`, `refusé` avec la raison d'eBay ou
       du transporteur, `incertain` avec le geste à faire, `aurait fait`) ;
     - le texte exact des messages ;
     - le montant de chaque bordereau ;
     - un filtre par compte et par N°.
- **« Brancher l'agent », en 5 étapes**, pour un nouveau revendeur. Chaque étape
  porte son état, sur le modèle de `PremiersPas` : eBay relié ✓ · sonnettes eBay ✓ ·
  transporteur ✗ (facultatif) · colis type ✗ · répétition 3/7 jours.
- **Colis.** Les ventes eBay sont mêlées aux ventes Vinted, dans les groupes
  existants : « Prêts à imprimer », « Bordereau dans eBay » (un nouveau groupe,
  la phrase commune dite une fois), « En attente », « Partis ».
  - « Ne poste pas » est un bloc en tête.
  - Le compte eBay est nommé une fois quand ils sont tous sur le même.
- **Ma journée.** Seulement ce qui demande un geste :
  - colis à poster, avec la date limite ;
  - bordereaux eBay à acheter (« 1 tap chacun ») ;
  - bordereaux à confirmer ;
  - pas scanné, bloqué, retour ;
  - réponses dues ;
  - « l'agent attend ta réponse : 1 achat incertain ».

  S'il y en a, une ligne : « 2 messages envoyés en ton nom aujourd'hui — les
  relire ».
- **eBay → Ventes** : sur chaque vente, une frise (payée · bordereau · parti ·
  au relais · livré) et « preuve de livraison ».
- **Le bilan de la semaine** (existant) ajoute une ligne eBay : « l'agent a acheté
  3 bordereaux (24,60 €), suivi 5 colis, écrit 2 messages ».

### 11.2 Les réglages, bornés par le serveur

Ils passent **par la route** (`agent-regler`), jamais par la ligne `main` que le
navigateur écrit librement :
- une **version** (la dernière écriture gagne, jamais en silence : 409, puis
  relecture) ;
- des **maxima dans le code** (§8.6) ;
- un geste qui engage s'allume avec `confirme:true` **et** la phrase de
  confirmation affichée (« une offre acceptée vend la paire », « une évaluation
  ne se retire pas », « VRM achètera avec TON compte Boxtal, jusqu'à 80 € par
  jour »).

### 11.3 Les notifications

| catégorie | défaut | quoi |
|---|---|---|
| `vente` | allumée (existe) | « Vendu sur eBay — N°214 … » |
| `double` | **allumée** (nouvelle, spec `veille`) | vendue ici, encore en vente là-bas |
| `expedier` | allumée (existe) | à poster, pas scanné |
| `agent` | **allumée** (nouvelle) | « bordereau prêt », « à confirmer », « incertain : regarde », « horloge arrêtée » |
| `livraison` | **allumée** (nouvelle) | bloqué, renvoyé chez toi |
| `suivi` | éteinte (existe) | en transit, livré : rien à faire |

`PUSH_DEFAUT` (serveur) et `PUSH_CATS` (app) restent identiques, et l'audit les
compare. Toutes les notifications passent par `contexteVendeur.run({owner})` : un
vendeur ne sonne jamais chez un autre, et un abonnement coupé se tait (existant).
**Une notification par cible et par type**, avec le mémo écrit avant l'envoi.

---

## 12. Les initiatives (au-delà de la demande)

Chacune a sa garde. **Aucune ne touche Vinted.**

| # | initiative | pourquoi | garde | mode | chantier |
|---|---|---|---|---|---|
| 1 | **Fermer le trou de la 553**, en quatre parties (détail sous le tableau) | **rate 7 ventes récentes sur 14** aujourd'hui | toute source « pas su » ⇒ aucune action ; un retrait reste derrière son réglage | auto (lecture) ; retrait = réglage existant | 1 |
| 2 | **Répétition** puis « premier de chaque sorte confirmé » | tu vois l'agent travailler avant de le laisser faire | `decider` rend le même geste, l'exécution est coupée | — | 5 |
| 3 | **Rappels de délai d'expédition** (J-1 18 h, J 9 h) | protège ta note de vendeur (livraisons en retard) | `shipByDate` lu, jamais estimé | auto | 6 |
| 4 | **Colis pas scanné / bloqué / non retiré / renvoyé** | « un colis caché est un colis perdu » (§5 du dossier) | seuils fixes ; jamais sur « pas su » | auto | 9 |
| 5 | **Preuve de livraison + réponse préparée à « objet non reçu »** | c'est la preuve n°1 d'un litige | sans adresse ; ton clic | clic | 9, 13 |
| 6 | **Rappel au client J-2 au relais** | évite un colis non réclamé, qui revient et finit en remboursement | seulement si la limite est **lue** | réglage | 12 |
| 7 | **La paire revient** (renvoyée, remboursée, retournée) ⇒ « remettre en vente ? » ; si l'annonce est en pause : « reprendre », sans frais | ne pas oublier une paire dans un carton | `numerosDejaVendus` (toutes plateformes) : pas vendue ailleurs ; jamais automatique | clic | 14 |
| 8 | **Pause plutôt que terminer** dans le retrait automatique | une paire qui revient retrouve son annonce et ses observateurs | réglage « hors stock » d'eBay **lu** actif, sinon on termine (ton geste d'origine) ; défaut : terminer | réglage | 14 |
| 9 | **Baisser le prix d'une paire qui dort** (détail sous le tableau) | tes deux annonces faites à la main sont en ligne depuis le 18 et le 27 septembre **[étude]** ; la baisse existe déjà, mais au clic | prix lu chez eBay avant ; « pas su » ⇒ rien ; quota Trading en « confort » | réglage | 14 |
| 10 | **Offre automatique aux observateurs** (détail sous le tableau) | l'équivalent eBay de la remise aux favoris de Vinted, que §3 permet | une offre acceptée **vend la paire** : c'est dit à l'allumage ; **à trancher par toi** | réglage | 14 |
| 11 | **Garde de publication** : « une paire, une annonce » sur **tous** tes comptes eBay, et pas vendue ailleurs (existant), **plus la fraîcheur** (initiative 1) | la 553 | — | auto | 1 |
| 12 | **Photos hébergées chez eBay** à la publication (`UploadSiteHostedPictures`) | la N°553 pointe vers `images1.vinted.net`, des liens signés qui peuvent expirer **[étude : à vérifier]** | jamais un mélange ; échec ⇒ on le dit, on ne publie pas d'annonce sans photo | auto (à la publication) | 14 (`publier-lot` §4.3) |
| 13 | **Tes chiffres de vendeur eBay**, une fois par mois avant le 20 (`getSellerStandardsProfile`) | savoir avant eBay qu'un taux de retard monte | nouvelle portée `sell.analytics.readonly` (reconnexion `v2`) | auto (lecture) | 13 |
| 14 | **Une vente eBay ⇒ « retire-la de Leboncoin »** (par N°), et une vente Leboncoin prouvée ⇒ retrait d'eBay (règle `doublesVenteLbc`) | l'anti double vente sur les trois places | identités existantes ; VRM ne touche jamais une annonce Leboncoin seul | auto (message) / réglage (eBay) | 7 |
| 15 | **Arrêt d'urgence** en un geste, et l'installation coupable par toi seul | la confiance | — | — | 5 |
| 16 | **Le garde-quota équitable** (§14) | qu'un vendeur ne vide pas eBay pour les 999 autres | — | auto | 4 |
| 17 | **Heures décentes** pour les messages (9 h–20 h, heure de Paris) | un message à 3 h du matin trahit un robot | — | — | 12 |
| 18 | **« Brancher l'agent » en 5 étapes** pour un nouveau revendeur | le premier jour d'un abonné | trois états par étape (« pas su » n'est pas « fait ») | — | 15 |
| 19 | **Le bilan de la semaine** compte ce que l'agent a fait | relire sans ouvrir l'app | — | auto | 15 |

**1 — Fermer le trou de la 553.**
- **(a)** La preuve de vente lit aussi le **bordereau capté**
  (`harvest_{uid}_label_{tx}.item/items`, une identité posée par l'extension).
  Mesuré : **12 ventes récentes sur 14** sont couvertes au lieu de 7.
- **(b)** La règle « annonce eBay publiée après la vente ⇒ remise en vente
  voulue » se juge sur `preuveLueA`, la date de la preuve Vinted la plus
  fraîche **au moment où VRM a publié**, rangée avec la publication. Une vente
  postérieure à cette lecture ⇒ VRM ne savait pas ⇒ le retrait est permis.
  ⚠️ C'est **ta décision** : `audit-ebay-retrait-auto.cjs` protège la règle
  d'aujourd'hui.
- **(c)** « Publier » refuse ou demande confirmation si tes ventes Vinted de ce
  compte n'ont pas été lues depuis plus de 30 min : « je ne sais pas si elle est
  vendue depuis 18 h 02 ».
- **(d)** Une revérification à +10 min, +1 h et +6 h après chaque publication.

**9 — Baisser le prix d'une paire qui dort.**
- **−5 % tous les 14 jours, 3 baisses au plus.**
- Jamais sous **ton plancher** (`minPrice`) **ni** sous le prix d'achat + ta
  marge minimale.
- Ni plancher ni prix d'achat connus ⇒ **rien**.
- Une baisse par paire et par jour, au journal.

**10 — Offre automatique aux observateurs.**
- Seulement pour une annonce éligible (lue chez eBay), avec **≥ 2
  observateurs**, qui dort depuis **≥ 14 jours**.
- Remise ≤ ton réglage (10 %).
- Prix résultant **≥ le seuil de ta règle d'offre** s'il existe, sinon ≥ ton
  plancher ; ni l'un ni l'autre ⇒ rien.
- Une par annonce et par mois.

**Écarté exprès :**
- **Masquer ou mettre en pause une annonce Vinted automatiquement**, même pour
  éviter une double vente. VRM ne touche pas Vinted (§3 du dossier et la règle
  de ce chantier). Une action d'extension sur Vinted, c'est le signal de robot
  qui a fait bloquer `vanessa5723`.
- **Répondre seul aux questions eBay** : la décision « elle répond à tout » vaut
  pour Vinted (18 septembre), pas pour eBay ; et l'IA serveur est éteinte
  aujourd'hui. À proposer plus tard, sur ta demande.
- **Une remise en vente automatique** : elle peut coûter des frais d'insertion.
- **La mise en avant payante** : seulement sur ta demande (spec `visibilite`
  partie B).

---

## 13. Les chantiers, dans l'ordre

### 13.1 La liste

Effort, en sessions de travail : **S** ≤ 1 · **M** 1 à 2 · **L** 3 à 5.
Chaque chantier est **utile seul**, et ne casse rien de ce qui marche.

| # | chantier | ce que ça change pour toi | reprend | effort | dépend de |
|---|---|---|---|---|---|
| 0 | **Fusion** de la branche multi-comptes + règle d'offre avec `main` (conflits connus : `handleRetirer` × numérotation, `App.jsx`) | rien de visible ; toutes les specs sont écrites sur cette forme | `etat.md` §5.5 | M | — |
| 1 | **La 553** : preuve par bordereau, règle `preuveLueA` (ta décision), garde de fraîcheur, revérification | plus de paire vendue sur Vinted qui reste en vente sur eBay sans un mot (app ouverte d'abord ; le serveur recopiera la même règle) | `etat.md` §3.3, §5.4 | S–M | 0 |
| 2 | **Socle** : trois états de connexion, commandes paginées / fusionnées / **sans adresse**, POST de suppression signé, état exigé, portées rangées, `bodyParser:false` ; **lecture de la politique d'étiquette** (Trading ≥ 1455, un appel dédié) | l'écran eBay dit vrai ; aucune vente eBay ne sort du CA ; on saura si eBay t'impose son bordereau | `spec-socle.md` | M–L | 0 |
| 3 | **Migration 014** : tables §4.2, fonctions §4.4 (temps en paramètre), RLS lecture seule, restrictive abonnement ; extensions installées, **tâche `pg_cron` pas encore posée** | rien de visible | `infra.md` §4 | M | ton oui |
| 4 | **Coffre + jeton gardé 1 h 50 + garde-quota** (le bouton « ↻ » d'aujourd'hui y passe aussi) | ton jeton eBay n'est plus lisible par le navigateur ; VRM tient à 1 000 vendeurs | `infra.md` §5–6 | M | 3 |
| 5 | **Le battement** : mode `battement`, tâche `pg_cron`, secours de 08:00, horloge, interrupteurs, répétition, journal, onglet « Agent » (pouls + journal) ; tâches `veille` + commande rangs 0 à 2 ; **« Vendu sur eBay » sur ton téléphone** ; recopie `ebay-regle.js` | **VRM fermé**, une vente eBay sonne dans les 15 minutes | `spec-veille.md` (sans les Platform Notifications), `infra.md` §3 | L | 2, 3, 4 |
| 6 | **Expédier** : `aExpedierEbay` (app + serveur), Colis / Ma journée / widget / rappel, « ne poste pas », voie eBay (bouton + relecture des envois), rappels J-1 et J | la vente eBay est dans Colis avec son N° et sa date limite | `spec-expedier.md` | M | 5 |
| 6b | **Argent** : « l'argent que tu reçois » (`frais = 0` particulier), signature numérique, solde | ton CA eBay est juste — **à livrer avant ta première vente eBay** | `spec-argent.md` | L | 2 |
| 7 | **Retrait serveur + doubles** sous le battement (`vendeur:doubles`), sonnette de l'extension (`veiller`, bump + zip), publication `vrm_comptes_bloques_vinted` | le retrait automatique tourne **VRM fermé** | `spec-retrait-serveur.md` | M | 1, 5 |
| 8 | **L'oreille** : Notification API REST (`ORDER_CONFIRMATION`, `AUTHORIZATION_REVOCATION`), `?mode=notif`, et une **reconnexion `v2`** (abonnement aux notifications + `sell.analytics.readonly` + `sell.payment.dispute`) | une vente eBay sonne **dans la minute** ; la veille passe à 60 min | `infra.md` §2 | M | 5 |
| 9 | **Suivi** : `etapeColis`, La Poste Suivi v2, témoin email au même n°, alertes, preuve de livraison | « pas scanné », « bloqué », « livré le … » | `suivi.md` §2, §6 | M | 6 |
| 10 | **Bordereaux VRM** : interface prestataire, Boxtal (bac à sable), `voieEtiquette`, achat (répétition → préparer → auto), PDF tamponné en stockage privé, déclaration du suivi, webhooks, annulation | si eBay te laisse le choix : le bordereau s'achète tout seul, sous plafond | `bordereaux.md` §5 | L | 4, 6, 9 |
| 11 | **Messages au client + évaluation** (réglages) | « au relais jusqu'au … », « livré » | `suivi.md` §4 ; `spec-litiges.md` §2.4 | M | 9 |
| 12 | **Boîte** (offres, questions ; réponses préparées) + **Litiges** (lecture, dates limites, liens eBay) | tout l'après-vente dans VRM | `spec-boite.md`, `spec-litiges.md` | L | 8 |
| 13 | **Initiatives prix et vie des annonces** : pause, remise en vente, paire revenue, baisse auto, offre auto (ta décision), photos chez eBay, statistiques | tes annonces eBay se gèrent seules, dans tes bornes | `spec-annonces-vivantes.md`, `spec-publier-lot.md`, `spec-visibilite.md` | L | 7, 8 |
| 14 | **« Brancher l'agent »** pour un nouveau revendeur, bilan de la semaine | le premier jour d'un abonné | — | S–M | 5, 10 |

**L'ordre a une raison.**
- **1 avant tout** : la 553 est le seul défaut qui coûte **aujourd'hui**.
- **5 avant 10** : on n'achète rien tant que l'agent ne sait pas veiller,
  reprendre et se taire sur « pas su ».
- **6b avant ta première vente eBay** (une déclaration URSSAF juste).
- **10 après 9** : un bordereau acheté sans suivi serait un argent dépensé sans
  surveillance.

### 13.2 Les preuves (méthode §6.1 du dossier)

Pour **chaque** chantier :
- un **audit** qui **exécute** la vraie route et la vraie bibliothèque dans un
  `vm` ;
- **rouge sur le code d'avant** : `git archive` dans `/tmp/avN`, le script copié
  dedans et lancé depuis là ;
- **rouge sous mutation** : la règle réaffaiblie doit refaire passer l'audit au
  rouge. « La fonction n'existait pas avant » n'est pas une preuve.

Il faut aussi un **banc de rendu** :
- données inventées, ports **4841 à 4850** (4831 à 4840 sont réservés par les
  specs du 9 octobre) ;
- rendu à 390 et 1 512 px ;
- jugement sur les `data-*` et sur le corps exact qui part vers `/api/ebay`,
  jamais sur un libellé.

Au-delà des audits par chantier, deux **preuves transversales** :

1. **`scripts/audit-agent-sql.cjs`** : la migration 014 **exécutée** sur un
   Postgres jetable. On réutilise la méthode et le socle minimal de
   `audit-renum-b.cjs` (`scripts/renum-b/supabase-min.sql`).

   | contrôle | ce qui est vérifié |
   |---|---|
   | concurrence | deux sessions appellent `vrm_agent_prendre` **en même temps** : jamais la même tâche, jamais deux tâches d'un même `groupe` |
   | bail | un bail expiré se reprend |
   | version | une écriture avec une version périmée ou un mauvais jeton ⇒ 0 ligne |
   | réservation | atomique : 50 réservations parallèles ne dépassent jamais le plafond |
   | « première fois » | `vrm_agent_premiere_fois` rend `true` une seule fois sur 50 appels parallèles |
   | lecture | `authenticated` lit **ses** commandes et son journal, jamais ceux d'un autre |
   | écriture | `authenticated` **ne peut rien écrire**, ni lire la file, les compteurs ou le coffre |
   | `anon` | ne lit rien |

   Mutations : `skip locked` retiré · condition de version retirée · condition
   de bail retirée · règle d'écriture ajoutée pour `authenticated` ⇒ chacune
   rouge.

2. **`scripts/audit-agent-vie.cjs`, le « banc de vie ».** Il fait vivre des
   commandes **de la vente à la clôture**, sur une **horloge simulée**.
   - Le vrai `api/ebay.js` (`mode=battement`) et la vraie bibliothèque tournent
     dans un `vm`.
   - Les appels `rpc/` et les lectures des tables de l'agent sont servis par le
     **même Postgres jetable**, pas par une imitation en JavaScript (§6.3 du
     dossier : un banc qui sert une fausse forme mesure une fiction).
   - Un faux eBay, un faux Boxtal, un faux Sendcloud et une fausse La Poste
     **comptent** chaque appel et chaque achat.
   - Un faux Web Push compte les sonneries.
   - Deux vendeurs, deux comptes eBay chez l'un.

   **Les scénarios, chacun avec son attendu chiffré :**

   | # | scénario | attendu |
   |---|---|---|
   | 1 | une vente, la voie eBay, le suivi rattaché par eBay 6 h plus tard, La Poste « livré » à J+2 | `close` à J+32 ; 1 sonnerie de vente, 0 achat, 0 message (éteints) |
   | 2 | la voie VRM en répétition | 0 achat, 1 ligne « aurait acheté » ; tu achètes dans eBay, l'agent le lit |
   | 3 | la voie VRM en réel, premier achat | état « à confirmer » ; ton clic ⇒ **1** achat, 1 déclaration, PDF `%PDF` tamponné |
   | 4 | **coupure juste après le `POST` d'achat Boxtal** | `etiquette_incertaine`, **0 second achat** pendant 7 jours simulés, 1 notification `agent`, la réservation gardée |
   | 5 | même chose avec Sendcloud | relecture par référence, **1 seul envoi** chez le faux Sendcloud |
   | 6 | **deux battements simultanés** | chaque geste une fois |
   | 7 | base en 522 pendant l'écriture de l'issue | aucun geste refait ; reprise en incertain |
   | 8 | notification eBay **forgée** (signature fausse) | 412, 0 relecture ; **vraie** notification rejouée ⇒ 1 seule relecture |
   | 9 | webhook transporteur avec le secret d'un **autre** vendeur | refusé, 0 écriture |
   | 10 | jeton `invalid_grant` | compte refusé, 1 notification, 0 appel ensuite |
   | 11 | abonnement coupé en plein transit | 0 appel, 0 notification ; reprise à la réactivation |
   | 12 | plafond du jour atteint au 11ᵉ bordereau | 10 achats, le 11ᵉ « à confirmer » |
   | 13 | transporteur absent de la table d'eBay | 0 déclaration, dit |
   | 14 | Mondial Relay sans email | « suivi pas lu », dit une fois, aucune étape inventée |
   | 15 | annulation après achat, aucun scan | annulation **proposée** ; avec le réglage, annulée à +24 h ; avec un scan, **jamais** |
   | 16 | colis renvoyé à l'expéditeur | « la paire revient », aucune remise en vente automatique |
   | 17 | la paire de la commande est vendue sur Vinted pendant le transit | aucun retrait de l'annonce eBay (elle est déjà vendue ici), « retire-la de Vinted » une fois |
   | 18 | le titre de la commande est remplacé par celui d'une autre paire sur toute la vie | **sorties identiques** (identité seule) |
   | 19 | au relais, limite connue | 1 message J-2 à 10 h ; limite inconnue ⇒ 0 |
   | 20 | 25 commandes d'un vendeur et 1 d'un autre | le second n'attend pas plus d'un battement (≤ 2 par vendeur et par passage) |

   **Mutations à prouver**, chacune rouge :
   - mémo écrit après l'envoi (⇒ 2 messages) ;
   - incertain traité comme « à refaire » (⇒ 2 achats) ;
   - « pas su » traité comme « rien » (⇒ achat sur une lecture ratée) ;
   - filtre `owner` retiré (⇒ fuite) ;
   - `groupe` ignoré (⇒ deux appels en vol sur un compte) ;
   - fenêtre horaire retirée (⇒ message à 3 h) ;
   - plafond lu dans le navigateur (⇒ 300 € dépassés).

3. **Les règles pures** (`decider`, `etapeColis`, `voieEtiquette`) sont exécutées
   sur une matrice dans un `vm`. Leurs invariants (§5.2) sont vérifiés sur
   **chaque** cas, y compris la mutation du titre.

---

## 14. Plusieurs vendeurs, sécurité, quotas (l'essentiel)

L'étude `infra.md` §5 et §6 porte le détail. Ce qui compte pour la conception :

- **Chaque tâche porte son `owner`.** Il est pris en base par
  `vrm_agent_prendre`, **jamais** reçu d'un navigateur ni d'une notification.
  - Tout tourne dans `contexteVendeur.run({owner})`.
  - Toute lecture et toute écriture passent par `portee(owner)` (`owner=eq.`).
  - Le compte eBay se valide contre **son** registre (`resoudreCompte`) avant de
    tirer un jeton.
  - **Un jeton n'est jamais tiré pour un autre `owner`** que celui de la tâche.
    L'audit le vérifie sur **chaque** appel sortant.
- **Le serveur ne croit pas sa propre base pour dépenser.** Avant tout achat ou
  tout geste irréversible, il **relit chez eBay** avec le jeton du compte. Un
  `orderId` d'un autre vendeur rend une erreur chez eBay.
- **Les clés du transporteur** :
  - chiffrées, et liées à leur `owner` (données associées) ;
  - leur valeur déchiffrée ne quitte jamais le serveur ;
  - un webhook n'est vérifié qu'avec le secret de **ce** vendeur ;
  - un PDF ne se télécharge que **chez l'hôte du prestataire** (liste blanche par
    motif, comme `pdfBordereauLbc`).
- **Le garde-quota Trading** (5 000 appels par jour pour toute l'application) :
  - un compteur global, réservé **avant** chaque appel ;
  - trois priorités : **obligations** (retrait d'une paire vendue ailleurs,
    message dû) avec 20 % réservés ; **détection** jusqu'à 80 % ; **confort**
    (statistiques, baisses de prix, « ↻ ») qui s'arrête à 60 % ;
  - au plus **1 % par compte et par jour** hors obligations ;
  - un recalage chaque heure sur `getRateLimits`.

  À environ 700 à 1 000 comptes eBay, **la hausse de quota (« Application Growth
  Check ») est nécessaire** **[étude]**.
- **Les journaux du serveur** (`console.log`) : jamais un pseudo, une adresse, un
  titre, un montant ni un jeton. Le journal relisible est **le nôtre**.
- **Fermer son compte VRM** efface ses lignes d'agent, retire ses abonnements de
  notification chez eBay (avec son jeton, **avant** d'effacer le jeton) et vide
  son coffre.

---

## 15. Tes gestes uniques

Dans l'ordre où ils servent. **Aucun n'est à faire avant que le chantier
correspondant soit livré**, sauf les deux premiers.

| quand | geste | où | pourquoi |
|---|---|---|---|
| **maintenant** | **Retirer la N°553 d'eBay** (annonce `128127336988`) | eBay → Mes annonces | elle est vendue sur Vinted |
| maintenant | Relier l'annonce sans SKU (`128101592740`) à sa paire | VRM → eBay → Annonces → « Relier à une paire » | sans SKU, aucune protection ne la voit |
| avant les abonnés payants | **Décider Vercel Pro** (environ 20 $/mois) | vercel.com → Settings → Billing | Hobby = « non commercial » **[étude : extrait]** ; Pro donne aussi le cron à la minute et 800 s |
| chantier 1 | **Trancher la règle « publiée après la vente »** (`preuveLueA`, §12-1) | une réponse | `audit-ebay-retrait-auto.cjs` protège la règle d'aujourd'hui |
| chantier 3 | **Dire oui à la migration 014** (elle installe `pg_cron` et `pg_net`) | une réponse | l'horloge de l'agent |
| chantier 4–5 | Poser **`VRM_COFFRE_CLE`** (32 octets aléatoires, « sensitive ») — **et en garder une copie hors ligne** | Vercel + ton gestionnaire de mots de passe | la perdre = clés transporteur à ressaisir (sans perte d'argent) |
| chantier 5 | Poser **`VRM_BATTEMENT_SECRET`** (64 caractères, « sensitive »), puis la même valeur dans le coffre : `select vault.create_secret('<valeur>', 'vrm_battement_secret');` | Vercel, puis Supabase → SQL Editor | le battement s'authentifie |
| chantier 5 | **Ne jamais ajouter `net` aux schémas exposés** | Supabase → Settings → API | sinon la file de `pg_net`, secret compris, devient lisible par l'app |
| chantier 5 | **Allumer l'agent** : l'installation (`agent_ebay = '1'`), puis ton interrupteur. **La répétition démarre toute seule** | VRM → eBay → Agent | rien ne part avant |
| chantier 8 | **Te reconnecter une fois à eBay** (chaque compte) | VRM → eBay → Compte eBay → « Reconnecter » | notifications, litiges, statistiques |
| chantier 8 | **Demander à eBay l'« Application Growth Check »** (gratuit) : hausse du quota Trading | developer.ebay.com **[chemin exact à vérifier]** | sans elle, l'agent plafonne vers 700 à 1 000 comptes |
| chantier 9 | Créer une clé **« Suivi »** sur developer.laposte.fr, puis `LAPOSTE_OKAPI_KEY` sur Vercel | La Poste, puis Vercel | Colissimo et Chronopost suivis jusqu'au client |
| **à ta première vente eBay** | Regarder si eBay t'**impose** son bordereau, puis le dire à VRM : « sur ce compte, j'achète mes bordereaux dans eBay » (défaut) **ou** « VRM les achète » | VRM → eBay → Agent | la voie (§8.1) |
| si « VRM les achète » | Compte **pro Boxtal** (SIRET) · **prélèvement différé** · application **API v3** · coller les clés dans VRM · **peser une boîte** et régler ton colis type · plafonds · **bac à sable** d'abord · 7 jours de répétition · puis « préparer, je confirme » · puis auto | Boxtal, puis VRM | l'agent achète avec **ton** compte |
| quand tu veux | Allumer « **Automatiser les évaluations** » dans eBay | eBay → Préférences de vente | l'évaluation positive, sans code |
| quand tu veux | Choisir les messages (conseil : le **rappel J-2 au relais** d'abord) | VRM → eBay → Agent | — |
| quand tu veux | **Trancher** l'offre automatique aux observateurs et la baisse automatique (§12-9, 12-10) | une réponse | elles vendent moins cher sans ton clic, dans tes bornes |

---

## 16. Ce qui est impossible ou risqué, dit franchement

**Impossible aujourd'hui :**
1. **Acheter un bordereau eBay par API en France.** La Logistics API ne fait que
   l'USPS, depuis les États-Unis **[étude : code lu + extraits]**. Une « Labels
   API » serait en bêta fin 2026, avec des transporteurs **britanniques**
   **[étude : à vérifier]**. ⇒ Si eBay t'impose son bordereau, il reste **un
   clic par vente**.
2. **Emballer et déposer un colis.** Un enlèvement à domicile existe chez
   certains transporteurs, payant **[à vérifier chez Boxtal]**. Ce n'est pas
   conçu ici.
3. **Retirer une paire de Vinted.** C'est une règle, pas une limite technique
   (§3 du dossier). ⇒ Entre une vente eBay et ton geste sur Vinted, **la double
   vente reste possible**. L'agent la réduit (sonnerie dans la minute, en tête
   de Ma journée) mais ne la supprime pas.
4. **Savoir quel point relais l'acheteur a choisi** : aucun champ documenté
   **[étude]**. ⇒ Pas d'achat de bordereau en relais par VRM tant que la
   première vraie commande ne l'a pas montré.
5. **Suivre un Mondial Relay acheté dans eBay** : pas d'API publique sans contrat
   **[étude]**. Seul le témoin par email est gratuit.
6. **« Livré » vu par eBay** : jamais donné au vendeur **[étude : extrait]**.

**Risqué, avec la garde posée :**

| risque | garde |
|---|---|
| **un achat en double** (une coupure au mauvais moment) | écrire avant, réconcilier par référence ; **Boxtal : arrêt + ton regard** |
| **un poids sous-déclaré** ⇒ une régularisation | le devis fait foi, le poids est montré, le colis type se règle à la balance |
| **un message qui déplaît à eBay** | aucun lien, aucune coordonnée, plafonds, heures décentes, éteint par défaut. Les limites d'envoi ne sont pas publiées **[extrait KB]** ⇒ un refus n'est pas réessayé |
| **le pseudo de l'acheteur bientôt remplacé** par un identifiant fixe **[étude : extrait]** | chaque refus d'eBay est rendu tel quel, jamais compté comme envoyé |
| **une notification pas reçue** | la veille tourne toujours (15 ou 60 min) ; une notification n'est qu'une sonnette |
| **`ShippingLabelPolicy` introuvable** (§1.3) | la voie vaut « eBay » par défaut ; on ne dépend pas de ce champ |
| **le secret du battement** est lisible par les rôles qui se connectent à la base (file de `pg_net`) **[étude : doc Supabase lue]** | un secret à part, inoffensif (battements idempotents, freinés, réponse sans donnée) |
| **Vercel Hobby** est non commercial | décision « Pro » avant les abonnés payants |
| **le quota Trading** | garde-quota, priorités, hausse demandée tôt |
| **la preuve de vente Vinted arrive par l'extension** : si tu ne passes pas sur un compte, ses ventes arrivent tard | `vendeur:doubles` se relance à chaque capture ; la fraîcheur est dite ; « Publier » vérifie la fraîcheur (§12-1) |
| **les comptes d'essai** (deux propriétaires pour `angeled92`) | rien de l'agent ne lit au-delà de son `owner` |

**Ce qui dépend d'APIs que personne n'a encore appelées** (non mesuré, voir
§17) : la Notification API pour un vendeur eBay.fr, la Post-Order API sur
`EBAY_FR`, le champ de politique d'étiquette, les codes transporteur d'eBay.fr,
les messages par jeton OAuth.

---

## 17. Ce qui reste à mesurer, au premier vrai essai

1. **Ta première vente eBay** :
   - eBay t'impose-t-il son bordereau ?
   - la politique d'étiquette est-elle lue ?
   - les **noms des clés** de `shipTo`, pour savoir s'il y a un identifiant de
     point relais ;
   - `shipByDate` ;
   - `totalMarketplaceFee`, qui doit valoir 0 et non être absent pour un
     particulier.
2. **`ORDER_CONFIRMATION`** : arrive-t-elle pour un vendeur eBay.fr, en combien
   de secondes, et avec quelle portée d'abonnement ? La signature se
   vérifie-t-elle sur le corps brut ?
3. **`getShippingFulfillments`** après un bordereau acheté dans eBay : le numéro
   (et sa forme pour Mondial Relay), le code transporteur.
4. **`get_shipping_carriers`** pour `EBAY_FR` : les codes exacts.
5. **Boxtal** :
   - le champ de référence et une éventuelle recherche par référence ;
   - le format 10 × 15 par transporteur ;
   - les grilles 1–2 kg ;
   - les régularisations de poids ;
   - les clés v1 pour les devis ;
   - l'éligibilité d'un micro-entrepreneur.
6. **La Poste Suivi v2** : les codes « au point de retrait » et la **date limite
   de retrait** ; le quota de la clé gratuite.
7. **`AddMemberMessageAAQToPartner`** avec le jeton OAuth sur eBay.fr : la
   longueur maximale ; ce que voit l'acheteur.
8. **`pg_net` → `vrm.center`** : le délai réel dans la même région, et un
   battement de 25 s qui ne touche pas le délai de 30 s.
9. **« Fluid compute »** activé sur le projet (300 s).

---

## 18. Sources

**Mesuré aujourd'hui** :
- la base `lgonxzrzjcqthjtbdpzo` (lecture seule, projetée) : les lignes `ebay_*`
  (identifiants, `capturedAt`, nombre d'éléments, tailles), les extensions
  disponibles et installées, les tables publiques, les colonnes de
  `vrm_reglages`, les fonctions `vrm_*`, les clés de `meta` des `email_bord_*` ;
- le code de la branche `worktree-wf_30feaf2f-334-8` : `api/ebay.js` (dispatch,
  niveau 1149), `api/ship-reminders.js`, `api/_lib/push.js` (`PUSH_DEFAUT`),
  `api/_lib/stamp.js`, `vercel.json` ;
- `scripts/audit-renum-b.cjs` (la méthode du Postgres jetable).

**Les études du jour** (ce dossier) : `bordereaux.md`, `suivi.md`, `infra.md`,
`etat.md`, avec leurs sources propres. **La feuille de route du 9 octobre** :
`../agent-ebay/feuille-de-route.md`, `spec-socle.md`, `spec-veille.md`,
`spec-expedier.md`, `spec-retrait-serveur.md`, `spec-argent.md`,
`spec-boite.md`, `spec-litiges.md`, `spec-annonces-vivantes.md`,
`spec-publier-lot.md`, `spec-visibilite.md`.

**Mes recherches d'aujourd'hui** (extraits de moteur ; les pages officielles sont
bloquées depuis ce conteneur) :
- eBay Notification API :
  [overview](https://www.developer.ebay.com/api-docs/commerce/notification/overview.html),
  [release notes](https://developer.ebay.com/develop/api/notification-api/release-notes),
  [contrat `order_confirmation`](https://developer.ebay.com/api-docs/master/commerce/notification/asyncapi/order_confirmation.yaml),
  [contrat `item_marked_shipped`](https://developer.ebay.com/api-docs/master/commerce/notification/asyncapi/item_marked_shipped.yaml)
  — `ORDER_CONFIRMATION` : une notification par ligne de commande, au paiement ;
  `ITEM_MARKED_SHIPPED` (1.6.7, 12 décembre 2025) : « notifies a buyer ».
- eBay Trading :
  [release notes](https://developer.ebay.com/Devzone/XML/docs/ReleaseNotes.html),
  [Traditional Order Management release notes](https://developer.ebay.com/develop/api/traditional-order-management-apis/release-notes)
  — résumé de la 1455 (4 juin 2026) sans `ShippingLabelPolicy`.
- eBay messages :
  [AddMemberMessageAAQToPartner](https://developer.ebay.com/DevZone/XML/docs/Reference/ebay/AddMemberMessageAAQToPartner.html),
  [MemberMessageType](https://developer.ebay.com/Devzone/xml/docs/Reference/eBay/types/MemberMessageType.html),
  [KB 666](https://developer.ebay.com/support/knowledge-base/666),
  [KB 659](https://developer.ebay.com/support/knowledge-base/659),
  [KB 1508](https://developer.ebay.com/support/knowledge-base/1508)
  — 90 jours, pas de HTML, `&quot;`, limites d'envoi non publiées.
- eBay, évaluations automatiques :
  [eBay UK](https://www.ebay.co.uk/help/selling/leaving-feedback-buyers/automatic-feedback-settings?id=4101),
  [eBay AU](https://www.ebay.com.au/help/selling/leaving-feedback-buyers/automatic-feedback-settings?id=4101).
- Boxtal v3 :
  [annuler une commande](https://developer.boxtal.com/fr/en/apiv3/guide/cancelling-order-api-v3),
  [commander](https://developer.boxtal.com/fr/en/apiv3/guide/order-api-v3),
  [bac à sable](https://developer.boxtal.com/fr/en/apiv3/guide/sandbox-api-v3)
  — `DELETE /v3.1/shipping-order/{id}`, 400 quand c'est trop tard ; aucune
  idempotence trouvée.
- Sendcloud :
  [idempotence (`external_reference_id`)](https://support.sendcloud.com/hc/en-us/articles/7789894544276),
  [annuler un envoi (v3)](https://sendcloud.dev/api/v3/shipments/cancel-a-shipment),
  [créer un envoi](https://sendcloud.dev/docs/shipments/create-a-shipment).
- Mondial Relay :
  [CGV Offre Start 2026](https://www.mondialrelay.fr/media/126216/20260107-france-offre-start-conditions-generales-de-vente-fr-2.pdf)
  — réservée aux personnes morales et aux entrepreneurs.
- Source secondaire :
  [justgeek — eBay supprime les frais de vente pour les particuliers](https://www.justgeek.fr/ebay-supprime-frais-vente-particuliers-157677/)
  — depuis le 1ᵉʳ septembre 2026.
- **Non trouvé** : aucune source sur une obligation de bordereau eBay pour les
  particuliers en France ; aucune page qui cite `ShippingLabelPolicy`.
