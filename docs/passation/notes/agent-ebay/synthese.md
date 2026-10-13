# L'agent eBay autonome — la conception retenue

**Pour :** Julien d'abord (sections 0, 1, 3, 16, 17, 18), puis les sessions qui
construiront (sections 4 à 15, 19).
**Rédigé le :** 11 octobre 2026, en fin d'après-midi.
**Ce que c'est :** le jugement des trois conceptions du jour, puis **une seule
conception**, complète, qui prend la meilleure base et y greffe le meilleur des
deux autres. Quand les trois se contredisaient, j'ai tranché, et je dis pourquoi.

**Les trois conceptions jugées** (dans ce dossier) :
- **É** = `design-evenements.md`, « tout part d'un évènement » ;
- **B** = `design-battement.md`, « un battement de cœur qui fait tout » ;
- **V** = `design-vendeur.md`, « conçu à partir de la journée de Julien ».

Elles s'appuient toutes sur les quatre études du jour (`bordereaux.md`,
`suivi.md`, `infra.md`, `etat.md`) et sur la feuille de route du 9 octobre
(`../agent-ebay/feuille-de-route.md` et ses `spec-*.md`). Ce document ne refait
pas leurs recherches : il renvoie à la section qui porte la preuve.

**D'où vient chaque fait :**

| marque | sens |
|---|---|
| **[mesuré ici]** | mesuré par moi pendant cette synthèse, le 11 octobre : sa base Supabase en lecture seule et projetée (aucun jeton, aucun nom, aucune adresse d'acheteur), ou le code des arbres `integ-11oct` et `wf_30feaf2f-334-8` |
| **[É]**, **[B]**, **[V]** | repris de cette conception, avec la marque d'origine qu'elle donne |
| **[étude X]** | repris d'une étude du jour, avec sa propre source |
| **(extrait officiel)** | extrait d'une page officielle renvoyé par un moteur de recherche ; la page elle-même est bloquée ici (`developer.ebay.com` : `ENOTFOUND`, revérifié aujourd'hui) |
| **(secondaire)** | blog, forum, bibliothèque non officielle |
| **[à vérifier]** | non établi. **Rien de ce qui porte cette marque ne devient une promesse à l'écran.** |

**Aucun appel** n'a été fait à eBay, à un transporteur, à un agrégateur ni à
Vinted. **Aucune écriture** nulle part, sauf ce fichier.

---

## 0. En une page, pour Julien

### Le verdict

Les trois conceptions sont sérieuses, et elles s'accordent sur l'essentiel. Deux
sortent devant, à égalité de points (section 1) :
- **B** a le meilleur **moteur** : il tourne seul, il se répare, il ne dépense
  jamais deux fois, et ses preuves sont les plus fortes. C'est ce qui sera le plus
  dur à changer plus tard : **c'est la base.**
- **V** a la meilleure **vie quotidienne** : « Imprimer la journée » avec la liste
  de ramassage triée par carton, la notification qui dit tout, le dépôt sans case
  à cocher. **C'est greffé tel quel.**
- **É** apporte deux choses que les autres n'avaient pas : la **porte** des
  notifications par `api/compte.js` (qui lit déjà le corps brut), et **une
  adresse de notification par compte eBay** (on sait à qui elle appartient sans
  rien deviner). **Greffé aussi.**

### Ce que tu vivras

1. **Une vente eBay fait sonner ton téléphone**, en une ligne qui dit tout :
   « Vendu sur eBay · N°214 (carton B12) · Air Max 1 · 120 € · à poster avant
   jeu. 16/10 — ⚠️ encore en ligne sur Vinted (tomj683) : retire-la ». Le N° vient
   du SKU `VRM-214` de l'annonce, jamais du titre. Dans les 15 minutes dès que
   l'agent est allumé, dans la minute une fois les notifications d'eBay branchées.
2. **Elle entre dans Colis, Ma journée, le widget et le rappel du matin**, avec la
   date limite donnée par eBay. Une annulation demandée par l'acheteur donne
   « **Ne poste pas** ».
3. **Le soir, un seul bouton : « Imprimer la journée ».** D'abord une liste de
   ramassage triée par emplacement (ton Garage 3D), puis un bordereau par
   feuille, Vinted et eBay mélangés, tamponnés du titre et du N°.
4. **Le bordereau eBay :**
   - si eBay **impose** son étiquette (probable sur un compte particulier) :
     l'agent prépare tout et te laisse **un** bouton qui ouvre la bonne page
     d'eBay. Il relit ensuite tout seul le numéro de suivi qu'eBay rattache à la
     commande ;
   - si eBay te **laisse le choix** (peut-être ton compte pro) : l'agent
     **achète lui-même** le bordereau chez Boxtal, **avec ton compte et ton
     argent**, sous tes plafonds, et déclare le suivi à eBay. C'est un réglage
     que tu allumes, éteint par défaut.
5. **Le colis est suivi jusqu'au client.** Rien à cocher au relais : le premier
   scan du transporteur dit « parti ». 48 h sans scan, colis bloqué, colis qui
   revient : tu es prévenu. La **preuve de livraison** est gardée pour un litige.
6. **Si tu les allumes** (tous éteints par défaut) : un mot au client deux jours
   avant que le relais ne renvoie le colis, « merci », « livré » ; une évaluation
   positive après la livraison ; une baisse de prix des paires qui dorment, jamais
   sous ton plancher.
7. **Tout ce que VRM fait en ton nom s'écrit dans un journal** que tu relis, avec
   le texte exact de chaque message et le prix de chaque bordereau. Ce qui se
   défait se défait d'un clic.
8. **L'agent commence par répéter** : il écrit « voilà ce que j'aurais fait »
   sans le faire. Tu passes chaque famille de gestes en réel toi-même.

### Les trois murs, dits franchement

1. **Le bordereau eBay ne s'achète par aucune API en France** (la seule API
   d'étiquettes d'eBay fait de l'USPS, aux États-Unis) [étude `bordereaux.md`
   §1]. Si eBay t'impose son étiquette, il reste **un clic par vente**.
2. **Le papier et le relais restent à toi.** Personne n'imprime sans ton clic,
   personne ne dépose à ta place.
3. ⚠️ **Nouveau, mesuré pendant cette synthèse : VRM apprend tes ventes Vinted
   en retard.** Sur tes **15 ventes Vinted** du 1ᵉʳ au 11 octobre, la preuve qui
   relie la vente à son annonce est arrivée en VRM après 12, 18, 23, 50, 75, 90
   et 93 minutes pour **7** d'entre elles ; entre 2 h 56 et 46 h pour **6** ; et
   **jamais** pour **2** [mesuré ici, section 2.2]. C'est la vraie cause de la
   N°553 : pendant ce temps, une paire vendue sur Vinted reste en vente sur eBay.
   - L'agent **réduit** ce trou (chantier 1 : l'extension lit le détail d'une
     vente dès qu'elle la voit, et la vente sans preuve **gèle** la publication
     des paires de ce compte).
   - Il ne peut pas le **fermer** : VRM ne lit Vinted que par ton extension, et
     ton extension ne lit que le compte ouvert dans ton Chrome. **Aucune
     conception ne pouvait promettre « rien ne se vend deux fois »** (V le
     promettait en tête de page, puis l'admettait en fin de document).

### Ce que VRM ne fera jamais

Toucher une annonce Vinted. Accepter une offre autrement que par le seuil natif
d'eBay que tu as posé (9 octobre). Acheter un bordereau sans ton réglage,
au-delà de tes plafonds, ou sur un « je ne sais pas ». Deviner un point relais,
un poids, une catégorie, un état. Mettre un lien ou une coordonnée dans un
message à un acheteur. Rembourser, accepter un retour, contester un litige.
Utiliser la clé d'un vendeur pour un autre.

### À faire maintenant

- ⚠️ **Retire la N°553 d'eBay** (annonce `128127336988`, 120 €). Elle est vendue
  sur Vinted depuis le 10 octobre à 22 h 25. **Revérifié pendant cette
  synthèse** : VRM n'a pas relu eBay depuis le 10 octobre à 22 h 29 (heure de
  Paris), et la ligne porte toujours `VRM-553` [mesuré ici].
- **Relie ton annonce eBay sans SKU** (`128101592740`) à sa paire : sans SKU,
  aucune protection ne la voit.

### Ce que tu dois trancher (détail section 17)

Six décisions, aucune urgente, chacune avec ma recommandation : Vercel Pro avant
les abonnés payants · retirer l'exception « annonce eBay publiée après la
vente » · l'offre automatique aux observateurs · les réponses automatiques aux
questions · le suivi Mondial Relay payant · une clé La Poste pour tous ou par
vendeur.

---

## 1. Le jugement des trois conceptions

### 1.1 Les notes (sur 10)

| critère | É — évènements | B — battement | V — vendeur |
|---|---|---|---|
| **Valeur pour Julien** (ventes, temps, tranquillité) | **8** — complète, l'histoire de « Sarah » parle ; peu sur le geste du soir | **8,5** — tout le cycle, évaluations reçues comprises, 19 initiatives | **9,5** — « Imprimer la journée », liste de ramassage par carton, notification qui dit tout, coût réel du port, solde eBay à demander |
| **Autonomie réelle** (app fermée, sans lui) | **7,5** — compte sur `ITEM_MARKED_SHIPPED` pour la voie eBay, or ce sujet est destiné à l'**acheteur** ; le filet de veille rattrape | **9** — tirée par un calendrier explicite ; les notifications ne font qu'accélérer ; se répare chaque matin ; a corrigé `ITEM_MARKED_SHIPPED` | **8** — même moteur qu'É ; même dépendance à `ITEM_MARKED_SHIPPED` ; promet « rien ne se vend deux fois » |
| **Sûreté** (argent, compte eBay, double vente, données d'acheteurs, multi-vendeurs) | **8,5** — idempotence geste par geste, Boxtal incertain jamais racheté ; mais la mémoire dans `app_data` dépend d'un déclencheur-garde | **9** — tables où le vendeur ne peut que lire, verrou et version vérifiés dans la même instruction SQL, temps en paramètre, « le premier de chaque sorte se confirme », heures décentes ; propose une offre automatique aux observateurs (garde à durcir) | **8** — validation famille par famille après ≥ 3 vraies commandes, plafonds bas ; mais mémoire dans `app_data` + déclencheur, et suppose une recherche Boxtal par référence non documentée |
| **Faisabilité prouvée** (API en France, quotas, Vercel Hobby, 12 fonctions) | **7,5** — porte `api/compte.js` vérifiée ; mais sa première marche est `ShippingLabelPolicy`, introuvable par deux recherches ; surestime le coût du corps brut sur `api/ebay.js` | **8,5** — ses deux corrections sont confirmées par mes recherches ; coûts des tables listés ; place le battement et les signatures sur `api/ebay.js`, ce qui oblige tous les bancs eBay à servir un flux brut | **7,5** — ports de bancs vérifiés ; mêmes dépendances non mesurées qu'É ; `GetOrders` Trading par un `orderId` REST signalé [à vérifier] |
| **Simplicité d'usage** (non-développeur) | **7,5** — réglages dans Réglages et Compte eBay ; 14 gestes | **7** — un nouvel onglet, trois interrupteurs, beaucoup de mécanique à expliquer | **9** — les gestes vivent là où ils se font ; quatre familles claires (Vendre · Expédier · Parler au client · Protéger) |
| **Total / 50** | **39** | **42** | **42** |

**Égalité B et V.** Je prends **B comme base**, parce que ce qui coûte cher à
changer plus tard, c'est le moteur (la mémoire, les verrous, l'horloge, les
preuves), pas les écrans. L'expérience de **V** se greffe sur ce moteur sans rien
changer à sa structure.

### 1.2 Les points où elles divergeaient, et ce qui est retenu

| sujet | É | B | V | **retenu** | pourquoi |
|---|---|---|---|---|---|
| **où bat le cœur** | `ship-reminders?mode=battement` | `ebay?mode=battement` | `ship-reminders?mode=battement` | **`api/ship-reminders.js?mode=battement`** | c'est déjà la fonction « serveur, sans app » : boucle par vendeur, `contexteVendeur`, clé `CRON_SECRET` lue dans l'en-tête [mesuré ici : `api/ship-reminders.js` l. 366-371]. `api/ebay.js` reste la route des gestes de l'app. La logique vit dans `api/_lib/`, donc rien n'est dupliqué |
| **par où entrent les notifications signées** | `api/compte.js` | `api/ebay.js` (`bodyParser:false`) | `api/ebay.js` (`bodyParser:false`) | **`api/compte.js`** (É) | `compte.js` lit déjà le corps brut (`bodyParser:false` l. 32, `corpsBrut()` l. 92) et vérifie déjà une signature (Stripe) [mesuré ici]. É exagérait le coût de l'autre voie : `api/ebay.js` ne lit le corps qu'**à un seul endroit** (l. 1522) [mesuré ici]. Mais basculer `api/ebay.js` en corps brut obligerait ses ~10 bancs et son audit de 354 contrôles à servir un flux brut (§6.3 du dossier) : la porte de `compte.js` ne touche à rien de ce qui marche |
| **la mémoire** | lignes `app_data` + déclencheur-garde | **tables dédiées** | lignes `app_data` + déclencheur-garde | **tables dédiées** (B) | le verrou et la version se vérifient dans la même instruction que l'écriture ; « le vendeur lit, le serveur écrit » se dit par construction (aucune règle d'écriture), sans déclencheur qu'on peut oublier ; le journal est une table où l'on ajoute, jamais un JSON relu et réécrit. Les coûts (B §4.1) sont repris dans les chantiers |
| **`ITEM_MARKED_SHIPPED`** | sonnette de la voie eBay | **n'est pas pour le vendeur** | sonnette du mode A | **pas utilisé** (B) | confirmé par ma recherche : le sujet « notifies a **buyer** when the associated seller marks the item as shipped », ajouté en 1.6.7 le 12 décembre 2025 (extrait officiel : notes de version et contrat `item_marked_shipped.yaml`). L'agent **relit** `getShippingFulfillments` sur un calendrier |
| **`ShippingLabelPolicy = EBAY_ONLY`** | le premier pas | **pas confirmé** | lu, sinon mode A | **on n'en dépend pas** (B) | deux recherches (B, puis moi) ne trouvent **aucune** page qui le cite [mesuré ici : 0 résultat] ; seule l'étude `bordereaux.md` l'avait tiré d'un extrait. ⇒ S'il est lu sur une vraie commande, il fait foi. Sinon, c'est **ta déclaration par compte eBay** qui décide, et elle vaut « **dans eBay** » par défaut (le sens sûr) |
| **retrouver à qui appartient une notification eBay** | **une adresse opaque par compte eBay** | par l'identité eBay nommée dans la notification | une adresse, compte « concerné » | **une adresse par compte** (É) | rien n'établit que `ORDER_CONFIRMATION` nomme le vendeur [à vérifier ; ma recherche ne l'a pas trouvé]. Une adresse par compte, c'est une identité par construction. Repli si eBay limite le nombre d'adresses [à vérifier] : une seule adresse, et seulement une commande **déjà vue** par la veille |
| **l'exception « annonce eBay publiée après la vente »** (qui a écarté la 553) | la retirer | la juger sur `preuveLueA` | la remplacer par « la paire est revenue » | **la retirer** (É, V), ta décision | une vente annulée ou remboursée ne compte déjà pas comme preuve (`PAS_UNE_VENTE`), et « la paire est revenue » est déjà couvert (une **autre** annonce Vinted de ce N° en vente). `preuveLueA` ajouterait une date à ranger avec chaque publication, pour un cas que les deux règles couvrent déjà. L'audit protège la règle d'aujourd'hui : c'est **ta décision** (section 17) |
| **le délai avant d'acheter un bordereau** | 1 h + ta fenêtre | — | **2 h** réglable 0-24 h + heure d'achat | **2 h** (V), jamais après `shipByDate − 24 h` | la durée pendant laquelle un acheteur eBay.fr peut annuler seul n'est pas établie [à vérifier] ; 2 h couvre l'heure souvent citée ailleurs (secondaire) |
| **les plafonds d'argent** | 12 € · 10 et 80 €/j · 300 €/mois | idem, maxima 25 € · 30 et 250 €/j · 2 000 €/mois | 10 € puis « le plus cher vu + 20 % » · 5 et 40 €/j · 200 €/mois, maximum 600 € | **12 € · 10 et 80 €/j · 300 €/mois**, maxima **25 € · 30 et 250 €/j · 2 000 €/mois** (B) ; **plus** la proposition de V à la fin de la répétition | un revendeur pro qui expédie 300 colis par mois dépasse 600 € ; la proposition « le plus cher vu + 20 % » arrive quand tu valides, sur tes vrais devis |
| **la répétition** | 7 jours, puis réel | 7 jours, réel sur ton clic, premier de chaque sorte confirmé | par famille, après ≥ 3 vraies commandes, sur ton clic | **par famille** (V) **+ ton clic** (B, V) **+ le premier de chaque sorte confirmé** (B) | jamais de passage en réel tout seul au bout d'un délai |
| **l'offre automatique aux observateurs** | non, sans ta décision | réglage | ton clic | **ton clic** ; l'automatique est **ta décision**, avec une garde plus forte (section 13, I16) | une offre acceptée **vend la paire**. La seule forme d'acceptation que tu as permise sur eBay est le seuil natif (§3 du dossier) |
| **où vivent les réglages et le journal** | Réglages → eBay + Compte eBay | un onglet « Agent » | un bloc dans Compte eBay | **un sous-onglet « Agent »** dans eBay (B), rangé en **quatre familles** (V) ; le **travail à faire** n'y est jamais : il est dans Ma journée et Colis (V) | une seule porte évidente pour « ce que fait l'agent » ; et Achats eBay ne s'affiche que s'il y a des achats eBay, comme pour Leboncoin (dossier, « Leboncoin et eBay rangés comme Vinted »), donc toujours quatre sous-onglets pour toi |
| **le tampon du bordereau** | à l'impression, dans l'app | `stampBordereau` côté serveur | à l'impression, dans l'app | **à l'impression, dans l'app** (`annotateAndDownloadBordereau`) | une seule règle (§11). `api/_lib/stamp.js` existe [mesuré ici], mais la copie tamponnée par le serveur n'est plus lue depuis l'étape 0 des PDF (dossier, « PDF de bordereaux — étape 0 ») |

### 1.3 Ce qui a été greffé, et d'où

| élément | vient de | où ici |
|---|---|---|
| le moteur : `pg_cron` + `pg_net`, baux, version, `groupe` (un appel en vol par compte eBay), temps en paramètre des fonctions SQL | B (sur `infra.md`) | §4, §5 |
| les tables dédiées, lecture seule pour le vendeur | B | §5.1 |
| `decider` pur, ses invariants (dont « muter le titre ne change rien ») | B | §6.2 |
| les cadences (veille 15/60 min, `getShippingFulfillments` toutes les 2 h, colis selon l'étape) | B | §4.5 |
| le battement de secours qui **recrée** les tâches manquantes chaque matin | B | §4.2 |
| « le premier de chaque sorte se confirme », heures décentes 9 h-20 h | B | §7.5, §11 |
| le banc de vie sur horloge simulée et Postgres jetable, 20 scénarios | B | §15.2 |
| la porte `api/compte.js` pour tout ce qui est signé | É | §8.1 |
| une adresse de notification opaque **par compte eBay** | É | §4.4 |
| le piège de l'intégration eBay native de Sendcloud (deux systèmes qui déclarent) | É | §9.3 |
| la fiche carton pour une étiquette achetée dans eBay | É | §9.8 |
| « Imprimer la journée » + liste de ramassage triée par emplacement (Garage 3D) | V | §3.2, §9.8 |
| la notification qui dit tout, en une ligne | V | §12.3 |
| le dépôt sans case à cocher (le scan dit « parti ») | V | §3.1, §10 |
| la répétition validée famille par famille, après ≥ 3 vraies commandes | V | §7.5 |
| le PDF eBay glissé dans VRM, tamponné **seulement** si son n° de suivi est exactement celui d'une commande | V (et É) | §9.8 |
| le poids appris par modèle, sur ta validation | V | §9.6 |
| le coût réel du port dans la marge | V | §13 |
| le solde eBay à **demander** (particuliers, depuis le 1ᵉʳ septembre 2026) | V (extrait officiel, aide eBay.fr) | §13 |
| les emails d'eBay comme sonnette de secours | V | §4.4 |
| **mesurer** la fenêtre de double vente, et ne proposer la publication en lot qu'à cette lumière | V (I18), **mesurée ici** | §2.2, §13 |
| **nouveau** : l'extension lit le détail d'une vente dès qu'elle la voit ; la vente sans preuve gèle le compte | **cette synthèse**, à partir de la mesure | §6.5, §13 (I1) |

### 1.4 Ce que la synthèse corrige chez les trois

1. **« Rien ne se vend deux fois »** (V §0.5) : faux tant que la preuve Vinted
   arrive par l'extension (mesuré ici, §2.2). Retiré de toute promesse.
2. **`ITEM_MARKED_SHIPPED`** (É, V) : sujet pour l'acheteur. Retiré.
3. **`ShippingLabelPolicy`** (É : « le premier pas ») : pas une marche, un
   bonus. La voie du bordereau ne dépend que de ta déclaration tant que le champ
   n'est pas lu sur une vraie commande.
4. **Le coût du corps brut sur `api/ebay.js`** (É) : surestimé (une seule
   lecture), mais la décision d'É tient pour une autre raison (les bancs).
5. **« La sonnette de l'extension après `orders_sold` »** (les trois) : une
   ligne `orders_sold` **ne porte pas** l'annonce vendue (champs mesurés ici :
   `date, photo, price, title, status, transaction_id, conversation_id,
   transaction_user_status`). La sonnette doit partir **aussi** quand une
   **preuve** est rangée (`label_{tx}` avec son `item`, `txn_{tx}` avec un état
   de vente), sinon elle réveille une vérification qui ne trouve rien.
6. **La photo comme identité de secours** (§5 du dossier) : impossible
   aujourd'hui, les ventes Vinted d'octobre ne portent **aucune** photo dans
   `orders_sold` (0 sur 11 vérifiées) [mesuré ici]. Pas de chemin par là.

---

## 2. D'où on part

### 2.1 L'état (repris d'`etat.md`, revérifié ici)

- **En production** (`main`) : un seul compte eBay ; publier, programmer,
  relier, baisser, offre aux observateurs, retirer — **toujours l'app
  ouverte**. **Après une vente eBay, rien** : ni N°, ni date limite, ni
  bordereau, ni suivi, ni message, rien dans Colis.
- **Sur une branche jamais fusionnée** (`wf_30feaf2f-334-8`, 32 commits de
  retard sur `main`) : plusieurs comptes eBay et la règle d'offre, prouvés.
- **Dans ta base, revérifié pendant cette synthèse** [mesuré ici] :
  - `ebay_listings`, `ebay_orders`, `ebay_programmees` : `capturedAt`
    inchangé depuis le **10 octobre à 20 h 29 min 12 s UTC** ; 3 annonces
    (`VRM-559`, une sans SKU, `VRM-553`) ; 0 commande ;
  - `pg_cron` et `pg_net` **pas installés** (`pgcrypto` et `supabase_vault`,
    si) ;
  - ports de bancs 4841 à 4850 libres ; 4831 à 4840 réservés par les specs du
    9 octobre.
- **Code** : 12 fonctions Vercel sur 12 ; un cron (08:00 UTC) ; Trading au
  niveau 1149 [étude `etat.md`].

### 2.2 La fenêtre de double vente, mesurée

**Méthode** [mesuré ici] : pour chaque vente Vinted du 1ᵉʳ octobre au
11 octobre midi (UTC), non annulée ni remboursée, l'heure de la **première
écriture** (journal `sauvegarde.journal_ecritures`) d'une ligne qui prouve
l'annonce vendue par identité :
- `harvest_{uid}_label_{tx}` portant son `item` (bordereau capté) ;
- ou `harvest_{uid}_txn_{tx}` portant un état de vente (`status_title` non
  vide).

| vente | délai jusqu'à la preuve | preuve par |
|---|---|---|
| 1 | 12 min | bordereau + transaction |
| 2 | 18 min | transaction |
| 3 | 23 min | bordereau |
| 4 | 50 min | bordereau + transaction |
| 5 | 1 h 15 | transaction |
| 6 | 1 h 30 | bordereau |
| 7 | 1 h 33 | bordereau |
| 8 | 2 h 56 | bordereau + transaction |
| 9 | 12 h 15 | bordereau |
| 10 | 18 h 21 | bordereau |
| 11 | 20 h 47 | bordereau + transaction |
| 12 | 24 h 47 | bordereau + transaction |
| 13 | 46 h 07 | bordereau + transaction |
| 14 | **jamais** | — |
| 15 | **jamais** | — |

- **La transaction seule** (la preuve d'aujourd'hui) en couvre **8 sur 15** ;
  **avec le bordereau**, **13 sur 15**. C'est le chantier 1, et c'est ce qui
  aurait vu la 553 le soir même.
- ⚠️ **Limite de la mesure** : pour une ligne de transaction, la première
  écriture après la vente peut être une mise à jour de **conversation** avant
  que l'état de vente n'y soit posé ; le délai mesuré est alors **trop
  court**, jamais trop long. Les lignes de bordereau, elles, n'existent qu'après
  la vente : leurs délais sont justes.
- **Pourquoi c'est si long** [mesuré ici, `background.js` l. 3637-3650] :
  l'extension relit toute seule, toutes les 20 minutes, **le seul compte
  connecté dans ton Chrome** ; tes autres comptes ne sont relus que quand tu
  passes dessus. Et la ligne de bordereau n'arrive qu'au moment où le bordereau
  est capté.
- ⇒ **La double vente ne peut pas être fermée à zéro.** Elle se réduit de deux
  façons (chantier 1) : l'extension lit le détail d'une vente **dès qu'elle la
  voit** (une lecture sur tes propres données, bornée, comme la lecture des
  dates de versement), et **une vente sans preuve gèle** la publication eBay
  des paires de ce compte.

### 2.3 Ce que les études établissent (l'essentiel, sans le refaire)

| sujet | conclusion | source |
|---|---|---|
| étiquette **eBay** par API en France | impossible (Logistics API : USPS, États-Unis) | `bordereaux.md` §1 |
| bordereau **acheté par VRM** chez un agrégateur, pour CETTE commande | possible ; le n° de suivi est alors connu **par identité** | `bordereaux.md` §0 |
| prestataire | Boxtal v3 (prélèvement SEPA différé, réservé aux entreprises), puis Sendcloud, Packlink « à moitié » | `bordereaux.md` §2 |
| point relais choisi par l'acheteur | aucun champ documenté pour la France | `bordereaux.md` §3.1 |
| « livré » | eBay ne le dit jamais au vendeur ; il faut le transporteur | `suivi.md` §3.2 |
| suivi transporteur | La Poste « Suivi v2 » (clé gratuite) ; webhooks Boxtal et Sendcloud ; **Mondial Relay sans API publique** | `suivi.md` §2 |
| écrire au client | `AddMemberMessageAAQToPartner`, 90 jours, aucun lien | `suivi.md` §4 |
| horloge | `pg_cron` + `pg_net` (Supabase Pro, inclus) | `infra.md` §3 |
| quotas | Trading 5 000 appels/jour **pour toute l'application** ; garder le jeton d'accès 1 h 50 | `infra.md` §5 |
| sécurité | ton jeton eBay est en clair, lisible par ton navigateur, et dans deux sauvegardes | `infra.md` §1.1 |
| Vercel Hobby | « non commercial » : Pro avant les abonnés payants | `infra.md` §0 |

---

## 3. Ce que tu vis

### 3.1 Une vente eBay, du paiement à la clôture

Exemple : la N°214 (carton B12), vendue 120 € un mardi à 14 h 02. Légende :
**auto** = l'agent seul · **réglage** = seul si tu l'as allumé (éteint par
défaut, plafonné, en répétition d'abord) · **clic** = ton geste, préparé.

| quand | ce qui se passe sans toi | mode | ce que tu vois | ce que tu fais |
|---|---|---|---|---|
| mar. 14 h 02 | l'acheteur paie ; eBay sonne sur l'adresse de **ce** compte (`ORDER_CONFIRMATION`, signée) | auto | — | — |
| 14 h 03 | relecture de la commande **chez eBay avec le jeton de ce compte** ; N° par le SKU ; `shipByDate` ; voie du bordereau (§9.1) ; la N°214 est-elle encore en vente ailleurs ? | auto | 📱 « Vendu sur eBay · N°214 (carton B12) · 120 € · à poster avant jeu. 16/10 — ⚠️ encore en ligne sur Vinted (tomj683) : retire-la » | retirer l'annonce Vinted (toujours toi) |
| 14 h 03 | une **autre** annonce eBay du même N° (autre compte) : retirée | réglage (allumé chez toi) | journal | — |
| 14 h 03 → 16 h 03 | délai de grâce (l'acheteur peut changer d'avis) | auto | — | — |
| 16 h 03 | **voie eBay** : rien n'est acheté, un bouton t'attend. **Voie VRM** : devis, plafonds réservés, achat, PDF rangé, suivi déclaré à eBay | auto / réglage | « N°214 : achète le bordereau dans eBay (un clic) » **ou** « Bordereau acheté pour le N°214 · 5,40 € » | voie eBay : un clic dans eBay |
| 19 h 30 | — | — | Ma journée : « Imprimer la journée : 3 bordereaux (2 Vinted, 1 eBay) » | **Imprimer la journée** |
| mer. 11 h | — | — | — | **déposer** |
| mer. 11 h 40 | le scan arrive (webhook, La Poste, ou ligne d'email au **même** n°) ; la vente passe « Partie » | auto | Colis : « partie le 15/10 · Mondial Relay » ; plus rien dans Ma journée | — |
| jeu. → ven. | en transit : aucune notification (rien à faire) | auto | Colis : l'étape | — |
| ven. | « au relais, jusqu'au 25/10 » (si le transporteur donne la date) | auto | Colis | — |
| 23/10, 10 h | message à l'acheteur : « votre colis vous attend au relais jusqu'au 25/10 » | réglage | journal : le texte exact | — |
| 24/10 | « livré » : **preuve** gardée (transporteur, code, date, n°), sans adresse | auto | sur la vente : « Livrée le 24/10 · preuve gardée » | — |
| 24/10 | évaluation positive : par le réglage **natif** d'eBay (recommandé), ou par VRM « après livraison » | réglage | — | — |
| 23/11 | 30 jours sans incident : commande close, ligne compactée | auto | — | — |

**Si ça se passe mal :** annulation demandée ⇒ « **Ne poste pas** — réponds
dans eBay », aucun achat ; 48 h sans scan ⇒ « l'as-tu déposé ? » ; bloqué 5
jours ouvrés ⇒ alerte + message **préparé** (ton clic) ; colis renvoyé ⇒ « la
N°214 revient », rien n'est remis en vente seul.

### 3.2 Le soir : « Imprimer la journée » (greffé de V)

C'est ton « Tout imprimer » de Vinted, étendu :
1. **Une liste de ramassage d'abord** : chaque colis du jour, trié par
   **emplacement** quand ton Garage 3D le connaît, sinon par N° : « B12 · N°214
   · Air Max 1 · eBay · Mondial Relay · avant jeu. midi ». Un bouton « Me montrer
   les cartons » ouvre le Garage 3D avec ces cartons surlignés (la recherche par
   N° existe).
2. **Puis un bordereau par feuille**, recto seul (`/Duplex /Simplex`, existant),
   tamponné du titre et du N° par **le même code** que Vinted.
3. **Une étiquette achetée dans eBay** n'est pas lisible par l'API. Deux
   façons de l'avoir dans le lot :
   - tu glisses son PDF dans VRM : VRM y lit le **numéro de suivi** et ne le
     tamponne que si ce numéro est **exactement** celui qu'eBay porte sur une de
     tes commandes ; sinon il l'imprime sans tampon, et le dit ;
   - sinon, VRM imprime à la place une **fiche carton** (N°, titre, n° de
     commande, en A6) à glisser dans le colis (greffé d'É).

**Aucun argent n'est engagé** par ce geste : il arrive dès le chantier 6,
avant tout achat de bordereau, et sert aussi tes ventes Vinted.

### 3.3 Tout seul, réglage, ton clic

| geste | mode | garde |
|---|---|---|
| voir une vente eBay, relire la commande | auto | sonnette signée, ou veille de rattrapage ; jeton du compte |
| retrouver le N° et le carton | auto | SKU `VRM-{n°}` lu par `numeroExterne` (la numérotation 013) ; sans SKU : « pas reliée à une paire » |
| te notifier (vente, à poster, pas scanné, bloqué, double vente) | auto | une notification par cible et par type, mémo écrit **avant** |
| retirer d'eBay une paire prouvée vendue ailleurs | **réglage** (le tien, déjà allumé) — désormais **VRM fermé** | la règle stricte existante, côté serveur ; 5 par passage |
| mettre en pause au lieu de terminer | réglage (« terminer » par défaut) | seulement si le « hors stock » d'eBay est lu actif |
| « retire-la de Vinted / Leboncoin » | auto (un message) | VRM ne touche jamais Vinted |
| acheter un bordereau | **réglage** à trois positions : éteint · prépare, je confirme · achète seul | voie VRM ; plafonds ; délai de grâce ; répétition validée ; abonnement `true` ; jamais deux par commande |
| déclarer le suivi à eBay | auto **quand VRM a acheté le bordereau** (identité) | sinon ton clic, suivi tapé |
| annuler un bordereau inutile | auto si **VRM l'a acheté seul** et la commande est **annulée** (pas seulement demandée), jamais scanné ; sinon proposé | relu chez eBay et chez le prestataire |
| suivre le colis | auto | n° connu par identité ; étape inconnue ⇒ « pas su » |
| message « merci », « au relais J-2 », « livré » | réglage, un par message | plafonds, heures décentes, texte contrôlé |
| message « problème de transport » | clic (préparé) | ce qu'on y dit t'engage |
| évaluation positive | réglage natif d'eBay (recommandé) ; celui de VRM « après livraison », éteint | irréversible, dit à l'allumage |
| répondre à une question | clic (réponse préparée) ; l'automatique est ta décision | — |
| offre reçue | le **seuil natif** que tu as posé ; sinon ton clic | aucune acceptation par VRM |
| baisser le prix d'une paire qui dort | proposé ; réglage pour le faire seul | jamais sous ton plancher |
| offre aux observateurs | proposée, ton clic ; l'automatique est ta décision | — |
| remettre en vente une paire revenue | clic | frais vérifiés à blanc |
| publier tes paires prêtes | clic (existant) ; « publier seul » n'est **pas proposé** tant que la fenêtre de double vente mesurée est longue (§2.2) | — |
| retours, remboursements, litiges | dans eBay (lien) | argent et signature |

### 3.4 Un autre revendeur (VRM à 12,99 €/mois)

| revendeur | ce qui change |
|---|---|
| **particulier, étiquette eBay imposée** (sans doute ton cas) | tout, sauf l'achat du bordereau : un clic par vente dans eBay. **Aucune clé à coller.** ⚠️ eBay.fr écrit qu'on doit être professionnel si l'on revend des objets achetés pour être revendus (extrait officiel, [étude `possible.md` §2.D]) : VRM le dit une fois, il ne décide pas |
| **pro avec SIRET** | il relie son compte Boxtal (prélèvement différé), règle son colis type et ses plafonds ; l'agent achète **avec son compte**. VRM ne paie jamais un bordereau |
| **particulier sans SIRET** | pas de prélèvement Boxtal ⇒ voie eBay, ou Packlink « à moitié » |
| **vêtements, livres** | son colis type (500 g, enveloppe) ; rien ne suppose une chaussure |
| **plusieurs comptes eBay** | chaque compte son jeton, ses plafonds, son adresse de notification ; le compte est nommé une fois quand tout est sur le même, sur chaque ligne sinon |
| **il cesse de payer** | l'agent s'arrête pour lui à la minute : aucun appel eBay, aucune notification ; ses données restent ; tout reprend quand il paie |
| **sa base ou eBay hoquette** | rien n'agit sur « pas su » ; il n'est prévenu que si une date limite approche |
| **le premier jour** | « Brancher ton agent eBay », une étape à la fois (§12.1) |

### 3.5 Ce qu'aucun revendeur n'a vu ailleurs (greffé de V)

1. **Une paire, un carton, toutes tes plateformes** : l'agent raisonne sur ta
   **paire**, pas sur l'annonce.
2. **La notification qui dit tout** : tu sais quoi faire sans ouvrir l'app.
3. **Imprimer la journée, dans l'ordre de tes étagères**, Vinted et eBay
   mélangés, tamponnés de ton N°.
4. **Le dépôt sans case à cocher** : le transporteur dit « parti ».
5. **Le client prévenu quand ça sert**, jamais en doublon de ce qu'eBay envoie.
6. **Un journal qui se relit et se défait.**
7. **La répétition** : l'agent prouve sur tes vraies ventes qu'il a raison avant
   de dépenser un centime.
8. **Le vrai bénéfice** : quand VRM a acheté le bordereau, sa marge le compte au
   centime.

---

## 4. Le principe : un battement, des sonnettes, un filet

### 4.1 Le schéma

```
  SONNETTES (elles ne portent jamais une donnée qu'on croit ; elles avancent l'heure d'une tâche)
  ─────────────────────────────────────────────────────────────────────────────────────────────
  eBay, signé (une adresse par compte)   ORDER_CONFIRMATION · AUTHORIZATION_REVOCATION ·
                                         MARKETPLACE_ACCOUNT_DELETION
  prestataire, HMAC (une adresse par vendeur)   Boxtal TRACKING_CHANGED · DOCUMENT_CREATED ;
                                                Sendcloud parcel_status_changed
  ton extension (sa session VRM)         une vente Vinted, ou une PREUVE de vente, vient d'être rangée
  tes emails (adresse de réception)      email d'un transporteur au MÊME n° de suivi ; email d'eBay
  l'app (ta session)                     ↻, publier, relier, acheter, confirmer, régler
  l'agent lui-même                       « dans 48 h », « à 16 h 03 », « le 23/10 à 10 h »
              │  vérifier (signature / session) → retrouver le vendeur → dédoublonner
              ▼  → vrm_agent_planifier(owner, tâche, maintenant)           (§4.4, en < 1 s)
  ┌──────────────────────────── Supabase (ta base, plan Pro) ────────────────────────────┐
  │ vrm_agent_file : une ligne par tâche, sa prochaine heure, son bail (le verrou)        │
  │ pg_cron, chaque minute : « une tâche est-elle due ? » — sinon AUCUN appel             │
  └────────────────────────────────────┬─────────────────────────────────────────────────┘
                                       │ pg_net POST (secret lu dans le coffre de la base)
                                       ▼
        /api/ship-reminders?mode=battement : ≤ 8 tâches, 25 s, chacune dans le contexte de SON
        vendeur : relire → decider (fonction pure) → agir si permis → écrire → reprogrammer
                                       │
        FILET : la veille de chaque compte eBay (15 min, ou 60 min quand les sonnettes marchent),
        le suivi des colis selon l'étape, et le cron de 08:00 qui vérifie l'horloge et RECRÉE
        les tâches manquantes.
```

**Trois règles qui découlent du schéma :**
1. **Un passage fait UN pas par commande.** Un pas est petit : il se reprend s'il
   est coupé, et deux passages ne font jamais le même pas (les baux, §7).
2. **Une sonnette n'est jamais une donnée.** Elle réveille une relecture faite
   **chez la source**, avec le jeton de **ce** vendeur. Une sonnette forgée,
   rejouée ou mal routée coûte au pire une relecture freinée.
3. **Tout ce qui agit est décidé par une fonction pure** (`decider`, §6.2). C'est
   ce qui la rend prouvable sur des milliers de cas, dans un `vm`, sans eBay.

### 4.2 Qui bat

**`pg_cron` + `pg_net`, dans ta base** [étude `infra.md` §3, recommandé par les
trois] : inclus dans ton plan Supabase Pro, à la minute, **seulement s'il y a du
travail**, et **aucun cron Vercel ajouté** (un cron refusé bloque tous les
déploiements, dossier). Esquisse de migration, **sur ton oui** :

```sql
-- supabase/migrations/014-agent.sql (esquisse)
create extension if not exists pg_cron;
create extension if not exists pg_net;   -- ⚠️ le schéma `net` ne doit JAMAIS être exposé à l'API

select cron.schedule('vrm-battement', '* * * * *', $$
  select net.http_post(
    url := 'https://vrm.center/api/ship-reminders?mode=battement',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                     where name = 'vrm_battement_secret')),
    body := jsonb_build_object('tic', extract(epoch from now())::bigint),
    timeout_milliseconds := 30000)                     -- le défaut de pg_net est 2 000 ms
  where (select valeur from public.vrm_reglages where cle = 'agent_ebay') = '1'   -- interrupteur d'installation
    and exists (select 1 from public.vrm_agent_file
                where prochain <= now() and coalesce(bail_jusqua, '-infinity') < now());
  update public.vrm_agent_horloge set dernier_tic = now() where id = 1;          -- le pouls, sans HTTP
$$);
select cron.schedule('vrm-purge-agent', '17 3 * * *', $$ select public.vrm_agent_purger() $$);
```

**Le secours (B)** : le cron Vercel du matin (08:00 UTC, existant) appelle aussi
la même bibliothèque (`battementDeSecours`, 60 s). Il lit
`vrm_agent_horloge.dernier_tic` :
- **plus de 30 min** sans tic ⇒ une notification au propriétaire de
  l'installation (« l'horloge de l'agent est arrêtée — Supabase → Settings →
  General → redémarrer ») et une ligne dans l'app ;
- toute tâche `veille` manquante pour un compte eBay actif est **recréée**.
  L'agent se répare au moins une fois par jour.

### 4.3 Un battement, pas à pas

```
POST /api/ship-reminders?mode=battement   (Authorization: Bearer <VRM_BATTEMENT_SECRET>, temps constant)
 1. vrm_reglages.agent_ebay ≠ '1' ou illisible ................................. 200 {arrete:true}
 2. anti-rafale en UNE instruction :
      update vrm_agent_horloge set dernier_battement = now()
      where id = 1 and dernier_battement < now() - interval '20 seconds' returning 1
    aucune ligne ............................................................... 200 {ignore:true}
 3. jeton = uuid aléatoire ; fin = maintenant + 25 s
 4. tant que maintenant < fin :
      taches = vrm_agent_prendre(8, jeton, 120)        -- ≤ 2 par vendeur, ≤ 1 par compte eBay
      vide ⇒ sortir
      en parallèle, chacune dans contexteVendeur.run({owner}, …) :
         r = executerTache(tache, {jeton, fin})        -- ne lève jamais : {fait | reporte | erreur}
         vrm_agent_rendre(owner, cle, jeton, r.prochain, r.echec, r.raison)
 5. 200 {prises, faites, reportees, erreurs}           -- des NOMBRES : pg_net garde la réponse 6 h
```

| clé de tâche | travail | § |
|---|---|---|
| `ebay:{s}:veille` | relit les commandes du compte (Fulfillment, `lastmodifieddate`, recouvrement 1 h) ; crée et avance les tâches `cmd` | 4.5 |
| `ebay:{s}:annonces` | relit les annonces une fois par jour ; « une paire, une annonce » ; paires qui dorment | 13 |
| `ebay:{s}:cmd:{orderId}` | avance la machine de CETTE commande | 6.1 |
| `vendeur:doubles` | croise les ventes prouvées (Vinted, Leboncoin, eBay) avec les annonces eBay ; **aucun appel eBay** pour décider ; retrait si réglage | 6.5 |
| `ebay:{s}:boite` | offres et questions (chantier 13) | — |
| `ebay:{s}:apresvente` | annulations, retours, réclamations (chantier 13) | — |
| `install:quota` | recale le compteur Trading sur `getRateLimits`, chaque heure | 14 |

**Trois portes avant chaque tâche, dans cet ordre, chacune à trois états** :
1. **abonnement** (`vrm_acces_pour`) : `false` ⇒ rendue +6 h, pouls « arrêté :
   abonnement » ; `null` ⇒ les **lectures** continuent, aucun geste qui coûte ou
   ne se défait pas ;
2. **ton interrupteur** (`vrm_agent_vendeurs.actif`) : éteint ⇒ rendue +1 h,
   aucun appel ;
3. **le compte eBay** : « refusé » (`invalid_grant`) ⇒ arrêt, notification
   « reconnecte {pseudo} » une fois par 7 jours ; « pas su » ⇒ délai qui grandit
   (1, 2, 4… min, plafonné à 60).

### 4.4 Les sonnettes

Toutes se résument à `vrm_agent_planifier(owner, cle, maintenant)`, freiné à une
fois par 2 minutes et par cible.

| source | preuve d'origine | à qui elle appartient | ce qu'elle réveille | route |
|---|---|---|---|---|
| eBay `ORDER_CONFIRMATION` | signature ECC `X-EBAY-SIGNATURE`, clé publique par `kid` gardée 24 h **en base** (une instance froide ne redemande pas) ; vérifiée sur le corps brut, puis sur `JSON.stringify(JSON.parse(brut))` comme le code officiel d'eBay ; jamais relâchée [étude `infra.md` §2.1] | **par l'adresse** `/api/ebay-notif/{k}`, `k` opaque **propre à chaque compte eBay** (É) | `ebay:{s}:veille` de ce compte | `api/compte?mode=ebay-notif&k=` |
| eBay `AUTHORIZATION_REVOCATION` | idem (sujet d'application) | `eiasToken` → clé du compte (identité existante) | le compte passe « refusé » tout de suite | idem |
| eBay `MARKETPLACE_ACCOUNT_DELETION` | idem (POST à finir, spec `socle` §3.4) | registres | anonymisation | `api/compte?mode=ebay-deletion` (déplacé ; **l'adresse publique ne change pas**) |
| Boxtal `TRACKING_CHANGED` / `DOCUMENT_CREATED`, Sendcloud `parcel_status_changed` | HMAC-SHA256 du corps brut avec **le secret de CE vendeur** | par `/api/transporteur/{k}` (vendeur) **et** la référence de l'envoi `vrm-{orderId}`, qui doit être une commande **de ce vendeur** dont VRM a acheté le bordereau | `ebay:{s}:cmd:{orderId}` | `api/compte?mode=transporteur&k=` |
| ton extension | sa session VRM ; au plus une sonnette par 2 min, la dernière jamais perdue (`chrome.storage.local`) | la session | `vendeur:doubles` | action `veiller` de `api/ebay.js` |
| un email de transporteur au **même** n° de suivi | adresse de réception (règle existante) | idem | `ebay:{s}:cmd:{orderId}` | `api/email-inbound` |
| un email d'eBay (« vous avez vendu »), si ton script Gmail le fait suivre (V, I17) | idem | idem | `ebay:{s}:veille` — **sonnette seulement**, jamais une donnée ; aucun email d'eBay n'arrive aujourd'hui [étude `etat.md`] | `api/email-inbound` |
| un clic dans l'app | ta session | la session | la tâche concernée | actions de `api/ebay.js` |
| la fin d'une étape | — | — | l'étape suivante, à son heure | interne |

**Si eBay limite le nombre d'adresses de notification d'une application**
[à vérifier ; la documentation de `getDestinations` pagine par 10 à 100, sans
plafond trouvé (extrait officiel)] : une adresse unique, et une notification n'est
rattachée qu'à une commande **déjà vue** par la veille. Une commande jamais vue
reste à la veille. On n'essaie **jamais** tous les comptes « pour voir ».

**`ITEM_MARKED_SHIPPED` n'est pas utilisé** : c'est un sujet pour l'acheteur
(extrait officiel, §1.2). L'achat d'une étiquette dans eBay se voit par la
relecture de `getShippingFulfillments` (§4.5).

### 4.5 Les cadences (B, ajustées)

| quoi | quand | appels |
|---|---|---|
| `veille` (commandes) | toutes les **15 min** tant que les sonnettes eBay ne marchent pas ; **60 min** quand elles marchent (une reçue depuis moins de 7 jours) ; **tout de suite** après une sonnette | 1 à 2 Fulfillment (quota 100 000/jour) |
| `annonces` | **1 fois par jour**, et juste après une publication, une vente ou un retrait | 1 Trading `GetMyeBaySelling`, sans `GetItem` en masse |
| `vendeur:doubles` | à chaque sonnette de l'extension ; toutes les **30 min** tant qu'une annonce eBay avec SKU est en ligne ; **+10 min, +1 h, +6 h, +24 h** après chaque publication eBay | 0 appel eBay ; lectures projetées (`meta->>`) |
| commande `payee` → voie | tout de suite | 1 `getOrder` + 1 Trading `GetOrders` dédié (politique d'étiquette, une fois) |
| voie eBay, en attente du bordereau | `getShippingFulfillments` toutes les **2 h**, jusqu'à `shipByDate` + 1 jour ; rappels **J-1 18 h** et **J 9 h** (Paris) s'il n'y a pas d'étiquette | Fulfillment |
| étiquette sans scan | transporteur toutes les **6 h** ; alerte à **48 h** ou à `shipByDate` | 1 lecture transporteur |
| en transit | toutes les **12 h** ; « bloqué » après 5 jours ouvrés sans évènement | 1 lecture |
| au relais | toutes les **12 h** ; message J-2 à **10 h** (si réglage et date connue) | 1 lecture + au plus 1 message |
| livré | plus aucune lecture ; évaluation (réglage) ; close à +30 jours | — |
| `apresvente` | toutes les **6 h** s'il existe une commande de moins de 60 jours, sinon une fois par jour | Post-Order (chantier 13) |
| `install:quota` | chaque heure | 1 `getRateLimits` |

**Heures décentes (B)** : un message au client ne part qu'entre **9 h et 20 h,
heure de Paris** (calcul par `Intl`, comme `partsParis`). En dehors, il attend
9 h. Un message à 3 h du matin trahit un robot.

### 4.6 Quand ça casse

| panne | ce qui se passe | ce que fait l'agent |
|---|---|---|
| Vercel ne répond pas (déploiement, 5xx, délai) | `pg_net` note l'échec ; ⚠️ `cron.job_run_details` dit pourtant « succeeded » | rien n'est perdu : les tâches restent dues ; un bail expiré (2 min) les libère |
| une tâche plante au milieu | son bail expire | reprise depuis le **dernier état écrit** ; un geste noté `en_cours` est lu comme **incertain**, jamais refait en aveugle |
| Supabase ne répond pas | plus d'horloge, plus de mémoire | **rien n'agit** ; au retour, la veille rattrape par date de modification |
| `pg_cron` s'arrête | plus de tic | le cron de 08:00 le voit (> 30 min), sonne le propriétaire, bat en secours, recrée les tâches |
| eBay refuse le jeton | — | compte « refusé », tâches arrêtées, une notification par 7 jours |
| quota Trading presque épuisé | — | les **obligations** passent, le confort attend demain (§14) |
| deux battements en même temps | — | sans effet : une tâche n'a qu'un bail |
| un déploiement coupe un achat au milieu | — | `en_cours` + bail expiré ⇒ **incertain** ⇒ §7.3 |

---

## 5. La mémoire

### 5.1 Des tables dédiées (B), pas des lignes `app_data`

**Pourquoi** (§1.2) : verrou et version vérifiés dans la même instruction ;
« le vendeur lit, le serveur écrit » par construction ; un journal où l'on
ajoute ; des colonnes que l'app lit sans jamais `select=data`.

```sql
-- Lisibles par LEUR vendeur (RLS : select owner = (select auth.uid()) + la restrictive abonnement_requis),
-- AUCUNE règle d'écriture.
create table public.vrm_agent_vendeurs (       -- une ligne par vendeur
  owner uuid primary key,
  actif boolean not null default false,        -- son interrupteur (arrêt d'urgence)
  reglages jsonb not null default '{}',        -- écrits par la route, bornés par le serveur (§12.2)
  reglages_version int not null default 0,
  repetition jsonb not null default '{}',      -- par famille : {bordereaux:{depuis, decisions, valide_le}, …}
  pouls jsonb not null default '{}',           -- dernier passage, dernier succès, dernière erreur (code), arrêt (raison)
  maj timestamptz not null default now());

create table public.vrm_agent_commandes (      -- ce que l'AGENT ajoute au miroir eBay, rien de plus
  owner uuid not null, plateforme text not null default 'ebay', compte text not null, commande text not null,
  etape text not null, rang int not null, branche text,
  numero text, voie text, limite timestamptz,                    -- N° (SKU), voie du bordereau, shipByDate
  transporteur text, suivi text, etape_colis text, colis_le timestamptz,
  en_cours jsonb,                                                -- {geste, cle, depuis} : écrit AVANT d'agir
  version int not null default 0, maj timestamptz not null default now(),
  data jsonb not null default '{}',   -- ≤ 2 Ko : 20 transitions ; bordereau{prestataire,id,prixCentimes,poidsG,format,pdf} ;
                                      --   preuve{transporteur,code,date,suivi} ; messages{type: date} ; notifs{type: date}
  primary key (owner, plateforme, compte, commande));

create table public.vrm_agent_journal (         -- ce qui a été fait EN SON NOM : une ligne par geste, jamais réécrite
  id bigint generated always as identity primary key,
  owner uuid not null, compte text, at timestamptz not null default now(),
  geste text not null,                          -- retrait | bordereau | declaration | message | evaluation | prix | offre | annulation-bordereau …
  cible text, numero text,                      -- orderId ou itemId, N°
  resultat text not null,                       -- fait | refuse | incertain | aurait-fait | ecarte
  centimes int, texte text, ref text, source text, defaire jsonb);
create index on public.vrm_agent_journal (owner, at desc);

-- Serveur seulement (RLS activé, AUCUNE règle) — le modèle de vrm_reglages.
create table public.vrm_agent_file (owner uuid not null, cle text not null, groupe text not null,   -- groupe = compte eBay
  prochain timestamptz not null, bail_jeton uuid, bail_jusqua timestamptz, essais int not null default 0,
  raison text, primary key (owner, cle));
create index on public.vrm_agent_file (prochain);
create table public.vrm_agent_compteurs (owner uuid not null, cle text not null,    -- owner neutre '0000…' = quotas globaux
  n int not null default 0, centimes bigint not null default 0, primary key (owner, cle));
create table public.vrm_agent_vus (owner uuid not null, cle text not null, at timestamptz not null default now(),
  primary key (owner, cle));                    -- « déjà vu / déjà fait » : notificationId, évènement, push, message
create table public.vrm_agent_routes (k text primary key, owner uuid not null, compte text,   -- adresses opaques (É)
  fournisseur text not null, cree timestamptz not null default now(), revoque timestamptz);
create table public.vrm_agent_horloge (id int primary key check (id = 1),
  dernier_tic timestamptz, dernier_battement timestamptz, dernier_succes timestamptz);
create table public.vrm_ebay_cles_publiques (kid text primary key, pem text not null, lu timestamptz not null);
create table public.vrm_coffre (owner uuid not null, compte text not null, fournisseur text not null,
  v int not null, nonce bytea not null, chiffre bytea not null, tag bytea not null,
  etat text, teste_le timestamptz, maj timestamptz not null default now(), primary key (owner, compte, fournisseur));
```

**Le coffre** [étude `infra.md` §6.1] : AES-256-GCM ; clé maîtresse sur Vercel
(`VRM_COFFRE_CLE`, type « sensitive ») ; une clé par ligne dérivée par HKDF de
l'`owner` ; données associées `owner|compte|fournisseur|v` ⇒ une valeur recopiée
chez un autre vendeur **ne se déchiffre pas**. Il range : les clés du
prestataire, le secret de son webhook, puis **ton jeton eBay** et le **jeton
d'accès gardé 1 h 50** (aujourd'hui en clair et lisibles par ton navigateur).

**Le prix de ce choix, dans les chantiers** (B §4.1) :
- la règle restrictive `abonnement_requis` posée sur les tables lisibles ;
- « Fermer mon compte » les efface (`owner=eq.`), et retire d'abord ses
  abonnements de notification chez eBay et chez le prestataire, avec ses clés ;
- la « sauvegarde complète » exporte commandes et journal (lecture RLS) ;
- un déclencheur jumeau de `sauvegarde.noter_ecriture`, pour garder la trace des
  écritures ;
- les bancs : un Postgres jetable (méthode d'`audit-renum-b.cjs`), pas une
  imitation en JavaScript (§6.3 du dossier).

### 5.2 Ce qui reste dans `app_data`

Les **miroirs** de ce que dit eBay restent leurs propres propriétaires (§11) :
`ebay_orders{s}` (devenu paginé, fusionné et **sans adresse** : spec `socle`
§3.3), `ebay_listings{s}`, `ebay_programmees{s}`, `ebay_comptes`, `ebay_offres{s}`,
`ebay_retraits_auto{s}` (lu en repli un mois, puis remplacé par
`vrm_agent_journal`). **`vrm_agent_commandes` ne recopie jamais ce que le miroir
porte** : seulement la voie, le bordereau, le suivi, les messages, la preuve.

Les poids que **tu** as validés vivent dans la ligne `main`, comme le prix
d'achat : `vrm_paires_poids` (par N° et par modèle), synchronisé, rattrapé par
`onCloudReady`.

### 5.3 Les fonctions SQL

Toutes `SECURITY DEFINER`, `search_path ''`, exécutables par `service_role`
seulement. **Le temps est un paramètre** (`p_maintenant timestamptz default
now()`) : c'est ce qui permet le banc de vie sur horloge simulée (§15.2).

| fonction | rôle | garantie |
|---|---|---|
| `vrm_agent_prendre(lim, jeton, bail_s, p_maintenant)` | prend les tâches dues au bail libre ; **≤ 2 par vendeur, ≤ 1 par `groupe`** | `for update skip locked` dans une sous-requête, puis `row_number()` au-dessus |
| `vrm_agent_ecrire_commande(…, jeton, version_lue, colonnes)` | écrit l'état d'une commande | **0 ligne** si la version a bougé **ou** si le bail n'est plus tenu ⇒ on relit, on n'écrase jamais |
| `vrm_agent_rendre(owner, cle, jeton, prochain, echec, raison)` | libère le bail, fixe la prochaine fois | seulement si le bail porte ce jeton |
| `vrm_agent_planifier(owner, cle, groupe, quand)` | « au plus tard à `quand` » | `on conflict do update set prochain = least(prochain, quand)` ; ne vole jamais un bail |
| `vrm_agent_premiere_fois(owner, cle)` | `true` une seule fois | `insert … on conflict do nothing returning true` : le mémo écrit **avant** l'envoi |
| `vrm_agent_reserver(owner, compte, centimes, plafonds…)` | réserve un achat contre les plafonds du geste, du jour, du mois | une instruction, tout ou rien (modèle `vrm_detourage_reserver`) |
| `vrm_agent_rendre_reservation(…)` | rend une réservation | seulement sur un **refus prouvé**, jamais sur un incertain |
| `vrm_agent_quota(cle, priorite, n)` | réserve des appels Trading (compteur global) | seuils par priorité (§14) |
| `vrm_agent_noter(owner, entree)` | ajoute une ligne au journal | — |
| `vrm_agent_purger()` | vide `vus` (> 14 j), `cron.job_run_details` (> 7 j), compacte les commandes closes depuis 90 j, le journal (> 13 mois) | — |

### 5.4 Les tailles

Une commande ≤ 2 Ko ; à 1 300 comptes eBay vendant une paire par jour, environ
**80 Mo par mois** avant compaction. Une commande close depuis 90 jours ne garde
que ses scalaires (étape, dates, N°, prix du bordereau, preuve), jamais
supprimée sans trace. Le journal : ~5 lignes par vente, gardé 13 mois (ce qui
fait foi en comptabilité, ce sont les factures du prestataire).

### 5.5 Ce qu'on ne garde jamais

L'adresse, le nom, le téléphone, l'email de l'acheteur (lus chez eBay **au
moment d'acheter**, passés au prestataire, oubliés) ; le nom du point relais (il
dit où vit l'acheteur) ; le texte brut des réponses d'eBay ou du prestataire ;
tout cela dans aucun `console.log` non plus. Le **pseudo** de l'acheteur reste
là où il est (`commandeMinimale`, `buyer.username`) : il sert à lui écrire, et il
est anonymisé sur la notification de suppression de compte.

---

## 6. Les machines à états

### 6.1 La commande eBay

Le **rang ne descend jamais**. Une **branche** peut s'ouvrir à tout moment et
**arrête tout geste automatique** sur la commande (les lectures continuent). Un
évènement inconnu ne change **rien** (il est noté dans `data.transitions`).

| rang | étape | on y entre quand (preuve, par identité) | l'agent fait | mode |
|---|---|---|---|---|
| 0 | `historique` | la commande existait à la **toute première** lecture du compte | rien, ni geste ni sonnerie (sinon « 30 ventes ! » d'un coup) | — |
| 1 | `payee` | `getOrder` : `PAID`, pas `FULFILLED` | sonne « Vendu sur eBay » (mémo avant) ; N° par le SKU de chaque ligne ; programme `vendeur:doubles` et le retrait des **autres** annonces eBay du même N° ; lit la politique d'étiquette | auto |
| 2 | `a_expedier` | voie décidée (§9.1) : `ebay` · `vrm` · `attendre` | rappels J-1 et J ; voie `ebay` ⇒ bouton + relecture des envois toutes les 2 h ; voie `vrm` ⇒ rang 3 à la fin du délai de grâce | auto / réglage |
| 2B | `a_confirmer` | voie `vrm`, réglage « prépare, je confirme », ou premier achat du compte, ou plafond refusé | devis rangé (prix, transporteur, ville, poids, valable jusqu'à) | **clic** |
| 3 | `etiquette_en_cours` | écrite **avant** l'achat : `en_cours = {geste:'acheter', cle:'vrm-{orderId}', prix}` + réservation | achète (§9.3) | réglage |
| 3′ | `etiquette_incertaine` | coupure, ou `en_cours` trouvé avec un bail expiré | réconciliation par référence (§7.3) ; sans preuve ⇒ **arrêt** et ta question | clic |
| 4 | `etiquette_prete` | n° de suivi + transporteur + PDF rangé | sonne « bordereau prêt » ; déclare le suivi à eBay | auto |
| 4′ | `declaration_incertaine` | coupure pendant `createShippingFulfillment` | relit `getShippingFulfillments` : notre n° présent = fait | auto |
| 5 | `declaree` | `fulfillmentId` rendu (voie VRM) **ou** suivi lu chez eBay (voie eBay, ou toi) | suit le colis (§6.3) | auto |
| 6 | `pris_en_charge` | premier scan (transporteur, webhook, ou email au **même** n°) | — | auto |
| 7 | `en_transit` | | rien, aucune sonnerie | auto |
| 8 | `au_relais` | évènement « disponible », + date limite **si lue** | programme le message J-2 | réglage |
| 9 | `livree` | « distribué » au même n° | garde la preuve ; message « livré » ; évaluation | auto / réglage |
| 10 | `close` | livrée + 30 jours, aucune branche ouverte | compaction | auto |

| branche | preuve | conséquence |
|---|---|---|
| `annulation_demandee` | `cancelRequests` dans un état ≠ refusé ou clos (inconnu ⇒ « demandée », le sens sûr) [spec `expedier` §3] | « **Ne poste pas** — réponds dans eBay » en tête de Colis et de Ma journée ; aucun achat ; une étiquette VRM existante n'est **pas** annulée tant que la commande n'est pas annulée |
| `annulee` | `cancelState = CANCELED` | annulation du bordereau VRM si permis (§9.9) ; « la N°214 reste chez toi » |
| `authentification` | `program.authenticityVerification` présent et ≠ `INELIGIBLE` | voie eBay ; suivi jusqu'à l'authentificateur, puis `status` ; **aucun message de transport** ; jamais « livré au client » |
| `retour_ouvert`, `reclamation`, `litige_paiement`, `remboursee` | Post-Order / Fulfillment (lecture ; `EBAY_FR` pas garanti) | une ligne dans Ma journée avec la date limite et le lien eBay ; pour « objet non reçu », la preuve de livraison est prête et la réponse préparée |
| `probleme`, `retour_expediteur` | étape du colis | alerte ; message préparé (ton clic) ; « la paire revient » |

### 6.2 La décision est une fonction pure (B)

```
decider(etat, faits, reglages, maintenant) → {
  geste:    'rien' | 'attendre' | 'sonner' | 'acheter' | 'declarer' | 'message' | 'evaluer'
            | 'proposer' | 'annuler-etiquette' | 'retirer' | 'baisser' | 'offrir',
  pourquoi: code (lisible à l'écran, jamais un texte brut d'eBay),
  engage:   booléen (coûte, ou ne se défait pas),
  centimes: montant engagé (0 sinon),
  cle:      clé d'idempotence du geste,
  suivant:  { etape, rang, branche, prochain },
  notif:    { categorie, type, texte } | null,
  journal:  { geste, resultat, texte } | null
}
```

Chaque fait a **trois états** : la valeur, `null` (pas su : la lecture a
échoué), `undefined` (pas demandé). La fonction vit dans
`api/_lib/agent-ebay-regle.js`, sans réseau ni horloge.

**Les invariants, vérifiés par l'audit sur une matrice :**
1. un fait **requis** par un geste vaut `null` ⇒ `geste ∈ {rien, attendre}` ;
2. `engage` ⇒ à la fois : réglage de ce geste allumé · abonnement `true` ·
   compte `ok` · aucune branche · famille sortie de la répétition ; sinon
   `aurait-fait` ou `rien` ;
3. `rang(suivant) ≥ rang(etat)` ;
4. **aucune décision ne lit un titre** : l'audit mute le titre sur toute la
   matrice, la sortie doit rester identique ;
5. un N° n'existe que par `numDeSkuEbay(sku)` lu par `numeroExterne` ; sinon `''`.

### 6.3 Le colis (sous-machine)

Une **seule** traduction, pure, côté serveur : `etapeColis(source, évènement)`
[étude `suivi.md` §2.4]. Le serveur est le seul propriétaire de l'étape rangée ;
l'app la lit.

```
etiquette ──scan──▶ pris_en_charge ──▶ en_transit ──▶ au_relais(dateLimite?) ──▶ livre
    │                                      │
    │ 48 h ou shipByDate dépassée          │ 5 j ouvrés sans évènement, incident,
    ▼                                      ▼ ou livraison estimée max + 3 j ouvrés
 pas_scanne (drapeau)                  probleme (drapeau) ─────────────────────▶ retour
```

- Un code inconnu vaut `en_transit` après un scan, `pas_su` avant. **Jamais
  `livre`.**
- `pas_scanne` et `probleme` sont des **drapeaux** : un scan tardif les efface.

### 6.4 L'annonce eBay (recalculée, jamais rangée)

| état | règle | gestes possibles |
|---|---|---|
| `en_ligne` | active, avec SKU | — |
| `non_reliee` | active, sans SKU | « relier » (clic) ; **aucun** geste automatique |
| `dort` | en ligne depuis ≥ `SLEEP_DAYS` (30, la règle de Vinted) | baisse proposée ou réglée ; offre aux observateurs proposée (§13) |
| `vendue_ailleurs` | N° prouvé vendu ailleurs (§6.5) et aucune **autre** annonce Vinted de ce N° en vente | retrait (réglage existant) ou pause (réglage) |
| `vendue_ici` | une commande eBay engagée porte ce SKU | « retire-la de Vinted / Leboncoin » (message) |
| `deux_annonces` | le même N° sur deux annonces eBay | signalé ; aucune n'est touchée (règle existante) |
| `programmee_vendue` | programmée, et N° vendu ailleurs | « annule sa programmation » (proposé : l'annulation par l'API n'est pas prouvée) |
| `revenue` | sa vente revient (annulée, remboursée, renvoyée) | « remettre en vente ? » (clic, frais vérifiés à blanc) |
| `gelee` | **une vente Vinted sans preuve** sur le compte d'origine de la paire (§6.5) | ni publication, ni « pas vendue ailleurs » affiché |

### 6.5 La paire, entre les plateformes (la machine qui manquait pour la N°553)

C'est `doublesVenteEbay` (existe), exécutée **côté serveur** à chaque évènement
de vente, avec **une preuve élargie** et **un gel**. Une seule règle, recopiée
de l'app (`api/_lib/ebay-regle.js`, §8.4).

**La preuve de vente, par identité seulement :**
- **Vinted** : transaction → `item_id` **avec un état de vente** (lignes
  `harvest_*_txn_*`, `status_title` non vide, `PAS_UNE_VENTE` écarte annulées,
  retours, suspendues) **et désormais** bordereau capté → `item` / `items`
  (lignes `harvest_{uid}_label_{tx}`) ; l'état de la vente (annulée,
  remboursée) se lit dans `orders_sold` par `transaction_id`. Mesuré : **13
  ventes d'octobre sur 15** prouvées au lieu de 8 (§2.2).
- **eBay** : une commande engagée dont une ligne porte le SKU.
- **Leboncoin** : la règle existante (`doublesVenteLbc`).

**Le gel (nouveau, cette synthèse)** : une vente Vinted rangée dans
`orders_sold` depuis moins de 72 h **sans aucune preuve** (ni transaction en
état de vente, ni bordereau) veut dire « une paire de ce compte est vendue, je
ne sais pas laquelle ». C'est un « pas su », et il agit comme tel :
- **aucune** paire de ce compte ne peut être publiée ni programmée sur eBay
  (le bouton le dit : « une vente du 11/10 sur tomj683 n'est pas encore reliée à
  son annonce — publie dès que VRM l'a reliée ») ;
- si des paires de ce compte **sont** en vente sur eBay : une notification
  `double`, **sans nommer de paire** (« 1 vente Vinted sur tomj683 n'est pas
  encore reliée à une paire ; 2 paires de ce compte sont en vente sur eBay —
  ouvre Vinted sur ce compte pour que VRM la relie ») ; aucun retrait ;
- le gel tombe dès que la preuve arrive. Il ne vaut **que** pour le compte de
  la vente.

**Sorties** : « à retirer d'eBay » (geste si allumé), « retire-la de Vinted »
(message seulement), « vendue deux fois — annule une des ventes » (message).
« Pas su » sur une seule source ⇒ **aucune** sortie à ce passage.

### 6.6 Le compte eBay et le vendeur

| état | entrée | effet |
|---|---|---|
| `ok` | le renouvellement rend un `access_token` | tout |
| `refuse` | `invalid_grant` ou `AUTHORIZATION_REVOCATION` | arrêt pour ce compte, notification une fois par 7 jours, « Reconnecter » |
| `pas_su` | réseau, 5xx, 429 | lectures reportées ; aucun geste |
| vendeur `arrete` | son interrupteur | rien, aucun appel |
| vendeur `abonnement` | `vrm_acces_pour = false` | rien, aucun appel, aucune notification |
| installation `arretee` | `vrm_reglages.agent_ebay ≠ '1'` | aucun battement, pour personne |

---

## 7. Verrous, idempotence, « pas su », répétition

### 7.1 Quatre verrous

1. **Un bail par tâche** (120 s) : deux battements ne prennent jamais la même.
2. **Un appel en vol par compte eBay** (`groupe`) : ordre garanti, pas de rafale.
   C'est de la politesse et du quota, **pas** le garde-fou anti-robot de Vinted,
   qui ne bouge pas.
3. **La version** de chaque commande : une écriture périmée rend 0 ligne.
4. **La réservation d'argent** : avant l'achat, en une instruction, rendue
   seulement sur un refus prouvé.

### 7.2 Écrire avant d'agir

```
1. écrire en_cours = {geste, cle, depuis}        (version + bail)   ── échoue ⇒ ne PAS agir
2. (argent) vrm_agent_reserver                                        ── refusé ⇒ « à confirmer », ne pas agir
3. (message, notification) vrm_agent_premiere_fois(cle) — VÉRIFIÉ     ── false ⇒ déjà fait
4. appeler (eBay, prestataire)                 → ok | refus | incertain
5. écrire l'issue (version + bail), effacer en_cours, journal, prochain
```

Une reprise qui trouve `en_cours` avec un bail expiré **ne sait pas** si
l'étape 4 a eu lieu : elle passe en **incertain**, jamais en « à refaire ».

### 7.3 Geste par geste

| geste | clé d'idempotence | si incertain | refait seul ? |
|---|---|---|---|
| acheter (Sendcloud) | `external_reference_id = vrm-{orderId}` (idempotence annoncée, extrait officiel) | relire par référence, ou renvoyer le **même** `POST` | oui, **une fois**, puis arrêt |
| acheter (Boxtal) | `externalId = vrm-{orderId}` [champ à vérifier] | **aucune recherche par référence documentée** ⇒ arrêt, et ta question : « Regarde dans Boxtal → Mes envois s'il y en a un pour la commande … », deux boutons (« il y en a un : n° … » / « il n'y en a pas : réessaie ») | **non** |
| déclarer le suivi | le n° de suivi | `getShippingFulfillments` : notre n° présent ⇒ fait ; un **autre** n° ⇒ on ne déclare pas, alerte (deux bordereaux) | oui, après relecture |
| retirer une annonce eBay | SKU attendu, relu par `GetItem` (existe) ; tentative notée avant | `GetItem` : terminée ⇒ fait | oui, après relecture ; jamais dans les 24 h sans relecture |
| baisser un prix | `prix:{itemId}:{semaine}` | `GetItem` : prix visé ⇒ fait | oui, après relecture |
| message au client | `msg:{orderId}:{type}` (mémo **avant**) | **jamais renvoyé** ; journal « incertain — regarde ta messagerie eBay » | **non** |
| évaluation | `eval:{orderId}:{lineItemId}` (mémo avant) ; `GetItemsAwaitingFeedback` lu d'abord | relu : absente de la liste ⇒ faite | non sans relecture |
| annuler un bordereau | id d'envoi | relire l'envoi chez le prestataire | oui, après relecture |
| offre aux observateurs | `offre:{itemId}:{quinzaine}` (mémo avant) | rien ne la prouve ⇒ **jamais renvoyée** | **non** |
| notification | `push:{type}:{cible}` (mémo avant) | — | non |

### 7.4 « Pas su », décision par décision (V)

Chaque entrée est **lue**, **pas sue**, ou **en cours**. « Pas su » sur une seule
entrée ⇒ la décision attend (1, 2, 4… min, plafonné à 60), et l'écran ne le dit
que si ça bloque une **obligation** (une date limite à moins de 24 h).

| décision | entrées qui doivent être **lues** |
|---|---|
| acheter un bordereau | commande relue chez eBay (`PAID`, pas `FULFILLED`, aucun envoi déclaré, aucune annulation) · voie `vrm` · N° par SKU · adresse complète · point relais lu par identité si le service payé est en relais · poids validé · transporteur dans la table lue chez eBay · réglage allumé · famille sortie de la répétition · plafonds réservés · abonnement `true` · interrupteurs |
| retirer une annonce eBay | réglage relu chez le vendeur · preuve de vente (toutes sources) · annonces Vinted de **tous** ses comptes · comptes bloqués publiés depuis < 7 jours · annonces eBay de ses comptes |
| envoyer un message | réglage · étape lue après la dernière tentative · date limite connue (J-2) · aucune branche · < 90 jours · heure décente · plafonds |
| baisser un prix | réglage · plancher connu · prix relu chez eBay · aucune offre en attente · règle d'offre relue |
| dire « pas vendue ailleurs » à la publication | ventes du compte d'origine lues · **aucune vente sans preuve** (le gel) |

Une liste lue **en partie** n'est jamais présentée comme complète : « au
moins », et ce qui manque est nommé.

### 7.5 Les interrupteurs et la répétition

**Trois interrupteurs :**
1. **l'installation** (`vrm_reglages.agent_ebay`, `'0'` par défaut) : pas de
   battement du tout, pour personne ;
2. **toi** : « Agent eBay : actif / arrêté » — arrêter sans confirmation,
   reprendre avec ;
3. **chaque geste qui engage** : son propre réglage, éteint, avec ses plafonds.

**La répétition, famille par famille (V + B)** — les familles : bordereaux ·
messages · retraits · prix · évaluations :
- quand tu allumes une famille, elle **répète** : `decider` rend le même geste,
  l'agent **ne l'exécute pas** et écrit « **aurait fait** » au journal (« aurait
  acheté Colissimo domicile, 8,40 €, pour N°214 ») ;
- il **lit** en même temps ce que tu as fait toi-même (le bordereau acheté dans
  eBay) et le journal met les deux **côte à côte** ;
- l'écran dit combien de décisions ont été répétées, et lesquelles auraient été
  **différentes** de ce que tu as fait ;
- tu passes une famille en réel **toi-même** (`agentvalider`) ; on te le
  conseille après **au moins 3 vraies commandes** de cette famille. **Jamais**
  de passage en réel tout seul au bout d'un délai ;
- à la validation des bordereaux, VRM te **propose** un plafond par bordereau :
  le plus cher des devis vus + 20 %, arrondi à l'euro (V) ;
- **même en réel, le premier de chaque sorte se confirme** (B) : le premier
  bordereau d'un compte, le premier message de chaque type. La confirmation
  montre le geste exact (prix, transporteur, texte rendu).
- La lecture, les alertes et les notifications, elles, marchent pour de vrai
  dès le premier jour : elles n'engagent rien.

---

## 8. Les routes : aucune nouvelle fonction (12 sur 12)

### 8.1 La porte du signé : `api/compte.js` (É)

| adresse publique (`vercel.json`) | réécrite vers | rôle |
|---|---|---|
| `/api/ebay-notif/:k` | `/api/compte?mode=ebay-notif&k=:k` | sonnettes eBay (§4.4) |
| `/api/ebay-deletion` | `/api/compte?mode=ebay-deletion` (**déplacée** au chantier 2 ; l'adresse publique, donc `EBAY_DELETION_URL` et le réglage chez eBay, ne changent pas) | suppression de compte : défi GET existant + POST signé |
| `/api/transporteur/:k` | `/api/compte?mode=transporteur&k=:k` | webhooks du prestataire |
| `/api/stripe-webhook` | `/api/compte?mode=webhook` (existe) | — |

Chaque mode fait **quatre choses seulement** : lire le corps brut (≤ 200 Ko,
sinon 413), vérifier la preuve d'origine (fausse ⇒ 412, rien n'est fait),
dédoublonner (`vrm_agent_vus`), planifier — puis répondre **204** en moins
d'une seconde (Boxtal exige moins de 2 s). Adresse `k` inconnue ⇒ 204 (pour que
l'expéditeur ne réessaie pas). Base injoignable ⇒ 500 (l'expéditeur réessaie, et
la veille rattrape). La logique vit dans `api/_lib/agent-evenements.js`, pas dans
`compte.js`.

### 8.2 Le battement : `api/ship-reminders.js`

| mode | appelé par | ce qu'il fait |
|---|---|---|
| `?mode=battement` (POST, `Bearer VRM_BATTEMENT_SECRET`, temps constant ; **pas** `CRON_SECRET`, lisible dans la file de `pg_net`) | `pg_cron` + `pg_net` | §4.3 |
| (sans mode) cron 08:00 UTC, existant | Vercel | le rappel du matin existant, **plus** les ventes eBay (`aExpedierEbay`, recopiée), **plus** le battement de secours et le contrôle de l'horloge |

### 8.3 Les actions de l'app : `api/ebay.js` (session exigée, abonnement vérifié)

Elles passent par le dispatch `ACTIONS` existant ; celles qui portent sur le
vendeur (pas sur un compte) sont traitées avant `resoudreCompte`, comme
`deconnecter` aujourd'hui. Ce qui engage exige `confirme:true` **avant** tout
appel.

| action | rôle | garde |
|---|---|---|
| `agentetat` | pouls, réglages, compteurs du jour, état du coffre (« clé posée le 11/10 · testée ✓ », jamais la clé), 50 dernières entrées du journal | lecture |
| `agentregler` `{reglages, version, confirme}` | écrit les réglages, **bornés par le serveur** (§12.2) | version périmée ⇒ 409, rien n'est écrasé |
| `agentarreter` / `agentreprendre` | ton interrupteur | effet au battement suivant |
| `agentvalider` `{famille, confirme}` | sort une famille de la répétition | — |
| `agentdefaire` `{entree, confirme}` | défait un geste quand c'est vraiment possible | relit l'état réel avant |
| `agentrelire` `{cible}` | « ↻ » : planifie maintenant | 1 par minute |
| `agentjournal` `{avant?}` | une page du journal | lecture |
| `coffreposer` `{fournisseur, cles, bacASable, confirme}` | teste les clés par une **lecture inoffensive**, les chiffre, crée l'abonnement webhook avec un secret tiré par le serveur | les clés ne reviennent **jamais** au navigateur |
| `coffretester` · `coffreretirer` | relecture inoffensive ; retrait (abonnement chez le prestataire supprimé d'abord) | — |
| `bordereaudevis` `{compte, orderId}` | relit la commande chez eBay, lit l'adresse, demande le devis ; range le devis, **pas** l'adresse | lecture |
| `bordereauacheter` `{compte, orderId, prixVu, confirme}` | **la même fonction que l'agent** (`acheterBordereau`), sur ton clic | devis plus cher que vu ⇒ 409 ; plafonds |
| `bordereauannuler` `{compte, orderId, confirme}` | §9.9 | suivi relu avant |
| `bordereauincertain` `{orderId, constat, suivi?}` | ta réponse au cas Boxtal incertain | — |
| `bordereaupdf` `{compte, orderId}` | les octets, pour le vendeur propriétaire seulement | `owner=eq.` |
| `bordereauglisse` `{pdf}` | lit le n° de suivi dans un PDF acheté dans eBay ; rend la commande qui porte **exactement** ce n°, ou rien | rien n'est rangé si aucune commande ne correspond |
| `suivirelire` `{compte, orderId}` | relit envoi et transporteur, une fois | 1 par 2 min |
| `expedier` | un suivi **tapé** [spec `expedier` §4.3] | `confirme` |
| `messagepreparer` · `messageenvoyer` `{orderId, type, texte, confirme}` | messages préparés (problème, réponses) | contrôle du texte rendu (§11.2) ; le destinataire vient de la commande relue |
| `abonnernotif` `{compte, confirme}` | crée l'adresse `k` et l'abonnement REST de CE compte, avec son jeton | — |
| `veiller` | la sonnette de l'extension | session de l'extension ; 1 par 2 min |
| (specs du 9 octobre) | `offres`, `offre-reponse`, `questions`, `question-reponse`, `apresvente`, `evaluations`, `pause`, `reprendre`, `relist`, `modifier` | leurs specs |

Toutes passent par `resoudreCompte` : un compte d'un autre vendeur ne désigne rien.

### 8.4 Les bibliothèques (`api/_lib/`, pas des fonctions Vercel)

| fichier | contenu |
|---|---|
| `agent-ebay.js` | `executerTache`, `acheterBordereau`, `declarerEnvoi`, `envoyerMessage`, `passageRetrait`, `verifierDoubles`, `battementDeSecours` |
| `agent-ebay-regle.js` | `decider`, `voieEtiquette`, `etapeColis` — **purs**, exportés pour les audits |
| `agent-evenements.js` | vérification des signatures eBay et prestataire, routage par `k`, dédoublonnage |
| `ebay-regle.js` | **recopie exacte** des règles de l'app (`doublesVenteEbay`, `numerosDejaVendus`, `retraitsEbayAutoPermis`, `preuvesVentesVinted`, `aExpedierEbay`, `commandeEbayEngagee`, `numDeSkuEbay`, `skuEbayDe`, `cleNum`, `numeroExterne`, `PAS_UNE_VENTE`, `limiteExpedition`…), refabriquée par `--recopie`, **jamais modifiée à la main** (méthode de `audit-bilan-semaine.cjs`) |
| `transport/boxtal.js`, `transport/sendcloud.js` | une interface commune (§9.2) |
| `coffre.js` | chiffrer, déchiffrer (HKDF, AES-256-GCM, données associées) |
| `ebay.js` (existe) | + jeton d'accès gardé 1 h 50 (dans le coffre) ; + garde-quota Trading |

### 8.5 L'extension

Deux choses nouvelles (bump, zip, `EXT_ATTENDUE`), **aucune** requête à Vinted
de plus que des lectures sur tes propres ventes :
1. **La sonnette** : après l'écriture **réussie** d'une vente nouvelle
   (`orders_sold`) **ou d'une preuve** (`label_{tx}` avec son `item`,
   `txn_{tx}` avec un état de vente), un `POST /api/ebay {action:'veiller'}`
   avec **sa** session VRM ; au plus un par 2 minutes, le dernier jamais perdu
   (`chrome.storage.local`, §4.9 du dossier).
2. **`capterPreuveVente(uid)`** (nouveau, cette synthèse) : pour chaque vente
   de `orders_sold` de moins de 72 h **sans preuve**, une lecture
   `/api/v2/transactions/{tx}`, rangée en `harvest_{uid}_txn_{tx}` ; au plus 3
   par visite, `gardeLecture` en classe prioritaire (comme `argent` et `colis`,
   jamais derrière les photos), pas de nouvel essai avant 30 min, dans la file
   Vinted, uniquement pour le compte connecté dans l'onglet (`garde`). C'est la
   **même forme** que `capterDatesVersement` (une lecture de tes propres
   transactions) : §3 l'autorise. Effet attendu : pour le compte ouvert dans
   Chrome, la preuve arrive avec la vente (moisson à la visite, ou toutes les
   20 min) au lieu d'attendre le bordereau [à mesurer après livraison, avec la
   même requête qu'en §2.2].

Entrée `EXT_CAPACITES.veilleebay` : l'app ne promet « tes ventes Vinted retirent
tes annonces eBay dans les minutes » qu'à une extension qui le sait.

---

## 9. Les bordereaux

### 9.1 Quelle voie pour CETTE commande

Deux voies, nommées comme V les nomme, décidées par une règle pure (B) :
- **voie eBay** (« eBay fournit l'étiquette ») : VRM n'achète rien, il te donne
  un bouton, puis relit le suivi qu'eBay rattache à la commande ;
- **voie VRM** (« VRM achète ») : VRM achète chez ton prestataire, déclare le
  suivi, suit le colis.

```
voieEtiquette(cmd, faits, reglages) :
  branche ouverte (annulation demandée, annulée, litige)       ⇒ aucune : « Ne poste pas »
  faits.authentification                                        ⇒ 'ebay' (vers l'authentificateur)
  faits.politiqueEtiquette === 'EBAY_ONLY'                      ⇒ 'ebay'
  reglages.compte.etiquettes !== 'vrm'   (DÉFAUT : 'ebay')       ⇒ 'ebay'
  faits.politiqueEtiquette === null (lecture ratée)             ⇒ 'ebay', raison 'pas-su'
  service payé = relais  et  !faits.pointRelaisId (identité)    ⇒ 'ebay', raison 'relais-illisible'
  coffre du prestataire absent, refusé ou pas su                ⇒ 'ebay', « relie Boxtal pour que VRM l'achète »
  transporteur absent de la table lue chez eBay                 ⇒ 'ebay' (jamais « Other »)
  faits.poids === null                                          ⇒ 'attendre' (« règle ton colis type »)
  sinon                                                          ⇒ 'vrm'
```

**Le sens sûr est toujours « eBay »** : au pire tu cliques une fois de trop, et
c'est même le bordereau le moins cher (3,58 € pour un Mondial Relay jusqu'à 1 kg,
grille relevée le 3 octobre, secondaire [étude `bordereaux.md` §1]). L'autre
sens serait un bordereau payé deux fois, ou un suivi qu'eBay n'attend pas.

**La politique d'étiquette (`ShippingLabelPolicy`)** se lit une fois par
commande, par un appel Trading `GetOrders` **dédié**, au niveau de compatibilité
≥ 1455 — **sans** monter le niveau des autres appels (ça changerait des réponses
que VRM lit déjà, sans preuve). Que le champ existe n'est **pas** établi (§1.2) :
on ne bâtit rien dessus. Que `GetOrders` accepte l'`orderId` REST tel quel est
[à vérifier] ; sinon par `ItemID` + transaction de la ligne. Au même passage, on
range les **noms** des clés de `shipTo` (jamais les valeurs) : la première vente
en relais dira s'il existe un identifiant de point.

**Ta déclaration par compte eBay** (Agent → Expédier) : « sur ce compte,
j'achète mes bordereaux dans eBay » (défaut) ou « VRM les achète ». Le jour où le
champ de politique est lu, il **prime** sur ta déclaration dans le sens sûr
(`EBAY_ONLY` ⇒ voie eBay, même si tu as dit « VRM »).

### 9.2 Le prestataire (une interface, plusieurs adaptateurs)

```
transport = {
  nom, idempotentParRef: bool,
  devis({depart, arrivee, poids, dims, service}) → {prixCentimes, offre} | refus | null,
  points({cp, reseau}) → [...] | null,
  acheter({ref, offre, expediteur, destinataire, colis, point?}) → {id, suivi, transporteur} | refus | incertain,
  relireParRef(ref) → envoi | 'absent' | null,   // null = pas su ; 'absent' n'est permis QUE si l'API le garantit
  etiquette(id, format) → octets %PDF | 'pas-pret' | null,
  suivi(id) → [évènements] | null,
  annuler(id) → ok | refus | incertain,
  verifierWebhook(corpsBrut, entetes, secret) → évènement | false
}
```

| prestataire | rang | pourquoi |
|---|---|---|
| **Boxtal (API v3)** | premier | achat 100 % par l'API **si** le compte est en prélèvement différé (réservé aux entreprises) ; points relais ; webhooks signés qui ne reçoivent que les envois de **la même application** (donc les clés du vendeur) ; annulation remboursée avant dépôt ; bac à sable qui ne facture rien [étude `bordereaux.md` §2.3]. `idempotentParRef: false` tant qu'une recherche par référence n'est pas mesurée. Devis par l'API v1, peut-être avec d'autres clés [à vérifier] |
| **Sendcloud (API v3)** | second | modèle « décentralisé » (chaque vendeur autorise VRM, Sendcloud le facture) ; idempotence par `external_reference_id` (extrait officiel) ; annulation par l'API, sans garantie ; abonnement et frais par étiquette [étude `bordereaux.md` §2.4] |
| **Packlink PRO** | repli « à moitié » | VRM prépare l'envoi (bon point, bonne adresse, référence = commande), le vendeur paie chez Packlink ; annulation par ticket seulement |
| transporteurs en direct | écartés | un contrat et des secrets par transporteur et par vendeur ; web service Colissimo réservé au contrat Privilège |

**VRM ne paie jamais un bordereau** : chaque vendeur a son compte et sa clé chez
le prestataire, qui le facture directement. VRM n'avance rien, ne refacture rien,
n'est pas revendeur de transport.

### 9.3 L'achat, pas à pas (voie VRM, tâche `ebay:{s}:cmd:{orderId}`, sous le bail)

1. **Relire chez eBay** (`getOrder`, jeton du compte) : `PAID`, pas `FULFILLED`,
   **aucun envoi déjà déclaré** (`getShippingFulfillments` vide), aucune
   annulation, adresse complète. Un seul « pas su » ⇒ on n'achète pas.
   ⚠️ **Un envoi déjà déclaré arrête tout** : c'est aussi ce qui protège d'un
   vendeur qui aurait branché **en plus** l'intégration eBay native de Sendcloud
   ou de Boxtal (deux systèmes qui achètent et déclarent) (É). Le premier jour le
   dit.
2. **Relire la politique d'étiquette** (§9.1). Présente ou illisible ⇒ voie eBay.
3. **Relire chez le prestataire** par la référence `vrm-{orderId}` **si
   l'adaptateur le sait** : un envoi trouvé ⇒ on le reprend (étape 8).
4. **Devis** : adresse lue maintenant (jamais rangée), point relais (§9.5),
   poids et dimensions (§9.6), **ton** transporteur préféré pour ce mode (relais,
   domicile) — jamais « le moins cher » en silence, un relais d'un autre réseau
   ne correspond pas au point choisi. Le devis fait foi.
5. **Le mode** : famille en répétition ⇒ « aurait acheté … » et rien d'autre ;
   « prépare, je confirme » ou **premier achat du compte** ⇒ `a_confirmer` +
   notification « 1 bordereau eBay à confirmer : 8,40 € » ; « achète seul » ⇒
   on continue.
6. **Réserver** les plafonds (refus ⇒ `a_confirmer`) et **écrire**
   `etiquette_en_cours` (§7.2).
7. **Commander** : référence `vrm-{orderId}` ; contenu « chaussures d'occasion »
   (ou la famille réglée par le vendeur) ; expéditeur = ton adresse d'expédition
   (réglage) ; destinataire = l'adresse de l'étape 4 ; format selon ton
   imprimante. Succès ⇒ id, suivi, transporteur rangés. Refus net ⇒ réservation
   rendue, raison du prestataire **telle quelle** au journal, retour à
   `a_expedier`. Coupure ⇒ `etiquette_incertaine`.
8. **Le PDF** : au webhook `DOCUMENT_CREATED`, ou relu (chez Boxtal, un `422`
   juste après la commande veut dire « pas prêt » : on réessaie à 30 s, 2 min,
   10 min, sans l'afficher comme un échec). Téléchargé **seulement chez l'hôte
   du prestataire** (liste blanche par motif, comme `pdfBordereauLbc`), vérifié
   `%PDF`, rangé **brut** dans le stockage privé
   (`bordereaux/{owner}/ebay/{sha256}.pdf`, chantier « PDF → stockage » ; à
   défaut une ligne `ebay_bord{s}_{orderId}` lue par `lirePdfLigne`).
9. **Déclarer** le suivi à eBay (§9.10).
10. **Sonner** (catégorie `agent`) et noter au journal (prix, transporteur, poids
    utilisé, référence). Colis affiche « Prêt à imprimer ».

**Plusieurs paires dans une commande** : un seul bordereau, tous les N° sur la
liste de ramassage et sur le tampon (« N°214 + N°220 »). eBay ne laisse pas
choisir un relais pour un achat de plusieurs objets : c'est le cas « domicile »
(extrait officiel [étude `bordereaux.md` §3.1]).

### 9.4 Quand acheter

- **Délai de grâce** après le paiement : **2 h** par défaut, réglable de 0 à 24 h
  (la durée pendant laquelle un acheteur eBay.fr peut annuler seul est
  [à vérifier]).
- **Jamais trop tard** : si la date limite tombe avant la fin du délai + 24 h,
  on achète tout de suite ; et au plus tard à `shipByDate − 24 h`, la
  notification « date limite demain » part avec la raison si l'achat n'a pas pu
  se faire.
- **Une heure d'achat**, au choix : « dès la fin du délai » (défaut) ou « à 17 h,
  en une fois » (tes bordereaux du jour arrivent ensemble pour le soir) (V).

### 9.5 Le point relais

- **Service payé à domicile** ⇒ bordereau à domicile. Jamais un relais « plus
  proche » : c'est un service moins bon que celui payé, donc une réclamation
  possible.
- **Service payé en relais** ⇒ VRM n'achète **que s'il lit l'identifiant du
  point** sur la commande. Aucun champ n'est documenté aujourd'hui ⇒ voie eBay.
- Faire correspondre une adresse de commerce à un code de point serait un
  rapprochement (§5 du dossier). **Un colis au mauvais relais est un colis
  perdu.**

### 9.6 Le poids (trois niveaux, plus un)

VRM ne connaît aucun poids (0 champ de poids ni de taille dans tes ventes et
annonces captées [étude `bordereaux.md` §4]). Jamais deviné en silence :
1. **ton colis type** (réglage) : proposé à 1,5 kg et 36 × 24 × 14 cm, **à
   confirmer sur ta balance** ; un vendeur de vêtements met le sien ;
2. **une correction par paire** (`vrm_paires_poids`, avec la fiche) ;
3. **un poids par modèle, que tu valides** (V) : quand tu corriges le poids d'une
   Air Max 1, VRM propose « utiliser 1,3 kg pour toutes les Air Max 1 ? ». Le
   modèle vient d'`extractModel` : **pour proposer un poids, jamais pour une
   identité** ;
4. rien de réglé ⇒ **pas d'achat**.

Le poids et les dimensions sont **montrés** dans chaque confirmation et **gardés**
au journal : un poids sous-déclaré est refacturé [montants à vérifier], et
certains transporteurs facturent le volume (36 × 24 × 14 / 5 000 ≈ 2,4 kg)
[à vérifier]. Le devis fait foi.

### 9.7 Les plafonds

| plafond | défaut | maximum imposé par le serveur |
|---|---|---|
| par bordereau | **12 €** (à la fin de la répétition, VRM propose « le plus cher vu + 20 % ») | 25 € |
| par jour et par compte eBay | **10 bordereaux · 80 €** | 30 · 250 € |
| par mois et par vendeur | **300 €** | 2 000 € |

Un réglage au-delà d'un maximum est ramené au maximum, et l'écran le dit. Un devis
au-dessus du plafond ⇒ rien n'est acheté, la vente passe « à confirmer » avec le
prix. Ces valeurs sont des **propositions**, à valider avec toi.

### 9.8 L'impression

- **Une seule règle de tampon** : le PDF est rangé **brut** et tamponné **au
  moment d'imprimer**, dans l'app, par `annotateAndDownloadBordereau` (titre + N°,
  le même code que Vinted). Ouvert dans l'onglet réservé au clic, jamais un
  téléchargement (existant).
- **A4** (ton réglage actuel, `vrm_imprimante = normale` [étude, V]) : la page
  entière. **Thermique** : VRM **demande** le 10 × 15 au prestataire quand le
  transporteur le permet (repli A4 sinon) ; `zoneEtiquette` ne connaît que les
  mises en page de Vinted : une mise en page inconnue part **entière** (règle
  existante), et l'écran le dit.
- **« Imprimer la journée »** (§3.2) : liste de ramassage, puis Vinted et eBay
  dans un seul document, un bordereau par feuille, `/Duplex /Simplex`. Un
  bordereau dont les octets ne sont pas revenus ⇒ « 7 sur 9 imprimés — 2 que la
  base n'a pas rendus » (règle existante).
- **Un PDF acheté dans eBay, glissé dans VRM** (`bordereauglisse`) : VRM lit son
  texte (`relevePage`, existant), y cherche un n° de suivi, et ne tamponne que si
  ce numéro est **exactement** celui qu'eBay porte sur une de tes commandes
  (relu chez eBay). Sinon : imprimé sans tampon, et c'est dit. Un PDF déposé par
  erreur ne reçoit jamais le N° d'une autre paire.
- **La fiche carton** (É) : pour une étiquette eBay que VRM ne voit pas, une
  fiche A6 (N°, titre, n° de commande) dans le lot du soir.
- Si le transporteur donne un **QR de dépôt** (Mondial Relay le fait sur ses
  propres bordereaux, secondaire), la carte le montre [à vérifier par
  prestataire].

### 9.9 Annuler un bordereau inutile

| cas | ce que fait l'agent |
|---|---|
| commande **annulée** (prouvée chez eBay), bordereau acheté **par l'agent seul**, aucun scan, et **24 h** passées depuis l'annulation | l'annule (réglage « annuler seul », éteint) ; sinon le **propose** ; journal « remboursement attendu X € ». Les 24 h : si tu as déposé juste avant l'annulation, le scan arrive souvent dans la journée (B) |
| même cas, bordereau acheté **sur ton clic** | te propose « Annuler le bordereau (remboursé) » |
| annulation seulement **demandée** | n'annule rien : « Ne poste pas — réponds dans eBay » |
| deux bordereaux pour une commande (le tien dans eBay, celui de VRM) | **propose** : VRM ne sait pas lequel est collé sur le carton |
| Packlink | ne peut pas l'annuler par l'API : le **dit**, avec le chemin (ticket) |
| 7 jours sans scan, commande active | n'annule pas : « N°214 jamais déposée — poste-la, ou annule le bordereau » |
| colis déjà scanné | jamais |

### 9.10 Déclarer le suivi à eBay, par identité

- **L'appel** : `POST /sell/fulfillment/v1/order/{orderId}/shipping_fulfillment`
  `{lineItems: [lignes non expédiées, quantité], shippedDate, shippingCarrierCode,
  trackingNumber}` ; réponse 201 et `Location` ; le n° en majuscules, sans espace
  ni tiret [étude `bordereaux.md` §3.3].
- **Le code transporteur** vient d'une table lue une fois par place de marché
  (`get_shipping_carriers` pour `EBAY_FR`), relue chaque mois. **Absent ⇒ pas
  de déclaration** (jamais `Other`), et c'est dit.
- **Quand** : dès l'achat. Un suivi valide chargé dans le délai, c'est ta
  protection n°1 sur la note de vendeur [étude `suivi.md` §3.3].
- **Voie eBay** : rien à déclarer ; eBay rattache le suivi, l'agent le **lit**.
- **Un bordereau acheté ailleurs, à la main** : seulement sur ton clic, n° tapé
  (`expedier`).

---

## 10. Le suivi jusqu'au client

### 10.1 Qui dit où est le colis

| bordereau | le n° de suivi vient de | les étapes viennent de |
|---|---|---|
| acheté **par VRM** | la réponse d'achat (identité) | le webhook du prestataire (sonnette) puis `suivi(id)` avec la clé du vendeur ; relecture au calendrier en secours |
| acheté **dans eBay** | `getShippingFulfillments(orderId)` (identité : eBay l'a rattaché à cette commande) | **La Poste « Suivi v2 »** pour Colissimo, Chronopost, Lettre suivie (clé `LAPOSTE_OKAPI_KEY`) ; **Mondial Relay** : la ligne `email_track_*` **au même n°** si le transporteur t'écrit en expéditeur ; sinon « suivi pas lu (Mondial Relay : pas d'accès direct) », dit **une fois** |
| **tapé** par toi | ta saisie | comme ci-dessus |
| tous | — | **un témoin gratuit** : la ligne `email_track_*` dont le n° est **exactement** le même (mesuré : 27 bordereaux Vinted reliés ainsi, tous Chronopost, dont 15 « livrés » [étude `suivi.md` §1]) |

⚠️ **eBay ne dit jamais « livré »** au vendeur (`ActualDeliveryTime` « no longer
applicable », extrait officiel [étude `suivi.md` §3.2]). ⚠️ **Mondial Relay est
ton transporteur n°1** (110 emails de suivi sur 200) et le seul sans API
publique : en voie eBay + Mondial Relay, l'étape peut rester « pas su » après
« déclaré ». Jamais « tout va bien » à la place.

**Le n° de suivi est la seule clé**, normalisé comme l'existant (`trim`,
majuscules). Jamais une date, un titre ou un point relais.

### 10.2 Les alertes

| alerte | règle | où |
|---|---|---|
| **pas scanné** | étiquette prête (ou suivi chargé) et aucun `pris_en_charge` **48 h** après, ou `shipByDate` dépassée — même seuil que `posteSansDepart` (`POSTE_SANS_DEPART_H`) | Ma journée + `expedier` |
| **bloqué** | en transit sans évènement depuis **5 jours ouvrés** ; ou livraison estimée maximale + 3 jours ouvrés dépassée | Ma journée + `livraison` + message « problème » préparé |
| **au relais, pas retiré** | date limite **connue**, à moins de 2 jours | message J-2 (réglage) ; sinon une ligne dans Colis |
| **renvoyé chez toi** | `RE1` / « Returned to sender » | Ma journée + `livraison` ; « la N°214 revient » |

### 10.3 La preuve de livraison

Pour une commande `livree` : transporteur, code de l'évènement, date, n° de
suivi. **Aucune adresse, aucun nom, pas même celui du relais.** La vente affiche
« livré le 24/10 · preuve gardée » ; en cas de réclamation « objet non reçu », la
réponse préparée la cite, et tu l'envoies.

---

## 11. Parler au client, et l'évaluation

### 11.1 Le canal

Trading `AddMemberMessageAAQToPartner`, avec le jeton existant, **aucune
nouvelle portée** ; jusqu'à **90 jours** après la ligne de commande ; pas de HTML
(refusé) ; la limite d'envoi n'est pas publiée, et au-delà eBay répond « Service
is not available » ⇒ un refus n'est **jamais** réessayé dans l'heure (extraits
officiels [étude `suivi.md` §4.1, B §10.1]). **Le destinataire est toujours relu
sur la commande**, jamais reçu du navigateur. La Message API REST viendra quand
`EBAY_FR` sera confirmé, avec la reconnexion `v2`.

### 11.2 Le contrôle du texte RENDU (ce qui part, pas le gabarit)

Refusé s'il contient : une adresse web · un email · un numéro de téléphone · une
suite de 9 chiffres ou plus qui n'est pas le n° de suivi de **cette** commande ·
une accolade restante (`{`) · une demande d'évaluation **assortie** d'une
contrepartie (« remise », « code », « cadeau ») (règlements d'eBay, extraits
officiels). Jamais le N° de rangement (ton carton n'est pas l'affaire du client),
jamais une promesse de date ou de remboursement. Une variable inconnue (le délai,
la date) retire **la phrase**, jamais un chiffre inventé.

### 11.3 Les messages

| message | quand | mode |
|---|---|---|
| « Merci pour votre achat » | à `payee`, entre 9 h et 20 h | réglage, éteint |
| « Colis expédié + suivi » | — | **jamais** (eBay le fait déjà) |
| « Votre colis vous attend au relais jusqu'au {date} » | **J-2** avant la limite, à 10 h, une seule fois, **seulement si la date est lue** | réglage, éteint — **le premier que je te conseille d'allumer** : il évite des colis non réclamés |
| « {Transporteur} indique une livraison le {date} » (+ une phrase facultative sur l'évaluation, sans exigence ni contrepartie, second interrupteur) | à `livre`, dans la fenêtre horaire | réglage, éteint |
| « Le suivi signale {incident} depuis le {date} » | à `probleme` | **préparé, ton clic** |
| réponse à une question | à la réception | **préparée (IA), ton clic** ; l'IA serveur est éteinte aujourd'hui (`ia:false`, dossier) ⇒ bouton grisé, champ libre |
| paire à l'authentification | — | **aucun** message de transport |

**Plafonds** : 20 messages par jour et par compte eBay ; 3 par commande, tous
types confondus ; un par type et par commande (mémo **avant**, vérifié). **Les
textes** sont ceux de `suivi.md` §4.4, au vouvoiement, modifiables. **Le
journal** garde le texte exact, le type, l'`orderId` et la réponse d'eBay.

### 11.4 L'évaluation

1. **Recommandé : le réglage natif d'eBay** « Automatiser les évaluations »
   (Préférences de vente) : eBay le fait, sans appel ni risque (extraits
   officiels, aides eBay UK et AU ; eBay.fr [à vérifier]).
2. **La version VRM**, seulement pour le déclencheur qu'eBay n'a pas : **« après
   livraison confirmée par le transporteur »**. Réglage éteint ;
   `GetItemsAwaitingFeedback` lu d'abord (pas de doublon avec le natif) ;
   `LeaveFeedback` **positive seulement** ; irréversible, dit à l'allumage.
3. **Jamais** de réponse automatique à une évaluation reçue. Une neutre ou une
   négative arrive dans Ma journée avec le lien.

---

## 12. Ce que tu vois

### 12.1 Les écrans

| écran | ce qui change |
|---|---|
| **Ma journée** | seulement ce qui demande un geste : « Imprimer la journée : 3 bordereaux » · « 1 colis eBay à poster avant demain » · « 1 bordereau eBay à acheter dans eBay (un clic) » · « 2 bordereaux à confirmer » · « Ne poste pas : annulation demandée (N°198) » · « 1 colis pas encore scanné » · « 1 réponse due » · « l'agent attend ta réponse : 1 achat incertain » ; et, s'il y en a, une ligne : « Hier, VRM a fait 4 choses en ton nom — les relire » |
| **Colis** | les ventes eBay **dans les groupes existants** (règle « l'écran Colis se range sur ce qu'il peut faire ») : « Ne poste pas » (en tête) · « Prêts à imprimer » · « Bordereau dans eBay » (nouveau : la phrase commune dite une fois, un bouton par colis) · « À confirmer » · « En attente » · « Partis — suivi transporteur » (une ligne d'étape par colis). Le compte eBay nommé une fois quand tout est sur le même |
| **eBay → Ventes** | par vente : la frise (payée · bordereau · parti · au relais · livré), « preuve de livraison », le prix du bordereau, le N° du carton |
| **eBay → Annonces** | sur une paire **gelée** (§6.5), le bouton « Publier » grisé avec la raison ; sur chaque carte, « tes ventes Vinted de ce compte : lues il y a 3 h » quand c'est vieux (I24) |
| **eBay → Agent** (nouveau sous-onglet ; **Achats** ne s'affiche que s'il y a des achats eBay, comme pour Leboncoin) | (1) **le pouls** en une ligne ; (2) **« Ce que VRM fait seul »**, en quatre familles (V) : **Vendre** (retrait d'eBay, pause, prix, offres) · **Expédier** (voie du bordereau par compte, prestataire relié ✓/refusé/pas su, colis type, imprimante, délai de grâce, plafonds et leur consommation du jour) · **Parler au client** (les messages, tes textes) · **Protéger** (évaluations, alertes) — chaque réglage dit « répétition » ou « réel » ; un gros bouton **« Arrêter l'agent »** ; (3) **« Ce que VRM a fait en ton nom »**, le journal par jour, filtrable par compte et par N° |
| **le premier jour** | « Brancher ton agent eBay », une étape à la fois (modèle `PremiersPas`), chacune avec son état mesuré : eBay relié ✓ · sonnettes eBay ✓ · comment tu expédies (eBay, ou relier Boxtal) · colis type et imprimante · plafonds · répétition 3/7. Jamais « c'est prêt » à l'avance |
| **le bilan de la semaine** (existe) | une ligne de plus : « l'agent a acheté 3 bordereaux (24,60 €), suivi 5 colis, écrit 2 messages » |

**Une seule couleur d'accent, rare** (§7 du dossier) : l'ambre seulement pour ce
qui demande un geste ; le rouge reste réservé aux deux paires sous un même
numéro.

### 12.2 Le pouls et les réglages

- **Le pouls** : « Agent actif · dernier passage il y a 40 s · rien n'attend ton
  clic » ; ou « en répétition (bordereaux) depuis 3 jours · 12 décisions à
  relire » ; ou « arrêté (ton choix) » ; « arrêté : abonnement » ; « arrêté : eBay
  a refusé la connexion de {pseudo} — Reconnecter » ; « l'horloge ne bat plus
  depuis 2 h » (propriétaire de l'installation seulement). **« Pas su » est gris,
  sans diagnostic.** Jamais un faux vert.
- **Les réglages passent par la route** (`agentregler`), jamais par la ligne
  `main` que le navigateur écrit librement : une **version** (une écriture
  périmée ⇒ 409, puis relecture), des **maxima dans le code** (§9.7 ; messages :
  20 par jour), et un geste qui engage s'allume avec `confirme:true` **et** la
  phrase affichée (« VRM achètera avec TON compte Boxtal, jusqu'à 80 € par jour »,
  « une évaluation ne se retire pas », « une offre acceptée vend la paire »).

### 12.3 Les notifications

Toujours dans `contexteVendeur.run({owner})` : ses appareils seulement, et
silence si l'abonnement est coupé (existant). **Une notification par cible et
par type**, mémo avant l'envoi. **Plusieurs ventes à la même minute ⇒ une seule
notification.**

| catégorie | défaut | ce qu'elle porte |
|---|---|---|
| `vente` (existe) | allumée | **la ligne qui dit tout** (V) : « Vendu sur eBay · N°214 (carton B12) · Air Max 1 · 120 € · à poster avant jeu. 16/10 — ⚠️ encore en ligne sur Vinted (tomj683) : retire-la » ; la seconde partie n'apparaît que s'il y a quelque chose à retirer |
| `double` (nouvelle) | **allumée** | vendue ailleurs et encore en vente ici ; retirée automatiquement ; vendue deux fois ; une vente Vinted sans preuve sur un compte qui a des paires sur eBay (le gel) |
| `expedier` (existe) | allumée | date limite demain ; pas scanné |
| `agent` (nouvelle) | **allumée** | ce que l'agent attend de toi (« 2 bordereaux à confirmer · 11,30 € », « je ne sais pas si le bordereau de la N°412 a été acheté — regarde dans Boxtal ») et son état (horloge, compte refusé, plafond atteint) |
| `livraison` (nouvelle) | **allumée** | bloqué, renvoyé chez toi, litige ouvert |
| `suivi` (existe) | **éteinte** | en transit, livré (rien à faire, comme pour Vinted) |

`PUSH_CATS` (app) et `PUSH_DEFAUT` (serveur) restent identiques :
`audit-bilan-semaine.cjs` les compare déjà.

---

## 13. Les initiatives, chacune avec sa garde

**Aucune ne touche Vinted.**

| # | initiative | ce qu'elle t'évite ou te rapporte | garde | mode | chantier | vient de |
|---|---|---|---|---|---|---|
| **I1** | **« La N°553 ne peut plus arriver »** : (a) preuve élargie au bordereau ; (b) l'extension lit le détail d'une vente dès qu'elle la voit (`capterPreuveVente`) ; (c) **une vente sans preuve gèle** la publication des paires de son compte ; (d) « Publier » demande confirmation si les ventes de ce compte n'ont pas été relues depuis 30 min ; (e) revérification +10 min, +1 h, +6 h, +24 h après chaque publication ; (f) l'exception `ebay-apres-vente` retirée (ta décision) | la double vente par manque de source | identité seulement ; « pas su » ⇒ aucun retrait, et le gel ne nomme aucune paire | auto (lecture) ; retrait = ton réglage | 1, 7 | B, É, V ; (b) et (c) cette synthèse |
| **I2** | **La fenêtre de double vente, mesurée et dite** par compte Vinted (« VRM apprend tes ventes de tomj683 en 4 h en médiane ») ; « publier seul tes paires prêtes » n'est proposé que si elle est courte | savoir si mettre 40 paires sur eBay est sûr | le chiffre, jamais la promesse | auto (lecture) | 1, 14 | V (I18), mesurée ici |
| **I3** | **Imprimer la journée** + liste de ramassage + Garage 3D | un seul tour d'étagères, un seul lot | N° par SKU ; emplacement seulement s'il est dans ton Garage | clic | 6 | V |
| **I4** | **Le PDF eBay glissé, tamponné** ; fiche carton sinon | le N° sur tes étiquettes eBay aussi | tamponné seulement sur un n° de suivi **exact** | clic | 6 | V, É |
| **I5** | **Ne jamais être en retard** : rappels J-1 18 h et J 9 h, seulement s'il n'y a ni étiquette ni scan | ton taux de retard (évalué par eBay) | `shipByDate` donné par eBay, jamais estimé | auto | 6 | B, É, V |
| **I6** | **Pas scanné / bloqué / non retiré / renvoyé** | « un colis caché est un colis perdu » | seuils écrits ; jamais sur « pas su » | auto | 10 | les trois |
| **I7** | **Preuve de livraison + réponse préparée à « objet non reçu »** | la preuve n°1 d'un litige | sans adresse ; ton clic | clic | 10, 13 | B |
| **I8** | **Rappel J-2 au relais** | moins de colis non réclamés, donc de remboursements | date limite **lue** seulement | réglage | 12 | les trois |
| **I9** | **La paire revient** ⇒ « remettre en vente ? » (ou « reprendre », sans frais, si l'annonce est en pause) | ne pas oublier une paire dans un carton | pas vendue ailleurs ; frais vérifiés à blanc ; jamais automatique | clic | 14 | les trois |
| **I10** | **Pause plutôt que fin** dans le retrait automatique | une paire qui revient retrouve son annonce et ses observateurs | « hors stock » d'eBay **lu** actif ; défaut : terminer | réglage | 14 | B, V |
| **I11** | **Baisser le prix d'une paire qui dort** | des ventes | −5 % par palier, au plus une fois par 7 jours, −20 % au total depuis le prix de mise en ligne ; jamais sous ton **plancher** (le plus haut de : ton plancher saisi, ton prix d'achat × (1 + ta marge minimale)) ; **pas de plancher ⇒ rien** (⚠️ 8 de tes 401 paires ont un prix d'achat, mesuré le 9 octobre) ; jamais au niveau ou sous le seuil de ta **règle d'offre** (l'agent ne touche jamais ta règle : il s'arrête et le dit) ; aucune offre en attente ; ≥ 2 observateurs ⇒ propose plutôt I16 ; « remettre l'ancien prix » au journal | réglage | 14 | les trois |
| **I12** | **Photos hébergées chez eBay** à la publication (`UploadSiteHostedPictures`) | la N°553 pointait vers `images1.vinted.net`, des liens signés qui peuvent expirer [à vérifier] | échec ⇒ on ne publie pas sans photo, on le dit ; anciennes annonces : ton clic | auto (à la publication) | 14 | É, B |
| **I13** | **Le coût réel du port dans la marge** | le vrai bénéfice par paire | seulement pour les bordereaux achetés par VRM ; les autres « — » | auto | 11 | V |
| **I14** | **Ton solde eBay attend** : depuis le 1ᵉʳ septembre 2026, eBay garde l'argent d'un particulier jusqu'à ce qu'il **demande** un versement (extrait officiel, aide eBay.fr [V]) ⇒ « 182 € disponibles sur eBay — demande ton virement » | ton argent ne dort pas | lecture signée (chantier `argent`) ; aucune API connue pour demander le virement [à vérifier] ⇒ un lien, jamais un geste | auto (lecture) | 8 | V |
| **I15** | **Ton niveau vendeur, avant le 20** (`getSellerStandardsProfile`) | éviter « Performance insuffisante » | portée `sell.analytics.readonly` (reconnexion `v2`) ; une lecture par jour au plus | auto (lecture) | 13 | les trois |
| **I16** | **Offre aux observateurs** : proposée quand ≥ 2 observateurs et 14 jours sans vente (ton clic) | des ventes | eBay choisit les destinataires ; une par 14 jours et par annonce. **L'automatique est ta décision** (section 17) et n'existerait **que** sur une annonce qui porte ta règle d'offre, à un prix **≥ ton seuil d'acceptation** — un prix auquel tu as déjà dit oui | clic | 14 | V ; garde de B durcie |
| **I17** | **Questions : réponse prête** quand tu ouvres l'app | des ventes conclues plus vite | identité par l'annonce ; aucun prix ni caractéristique que la fiche ne porte pas ; IA serveur absente aujourd'hui ⇒ grisé et dit. L'automatique est ta décision | clic | 13 | les trois |
| **I18** | **Le poids appris par modèle** | moins de saisie | proposé après ta correction ; utilisé seulement validé | clic | 11 | V |
| **I19** | **Les emails d'eBay comme sonnette de secours** | une vente vue même si la notification d'eBay se perd | sonnette seulement ; l'adresse de réception décide du vendeur | auto | 9 | V |
| **I20** | **L'agent veille sur lui-même** : horloge, quota, jetons, clés du prestataire, sonnettes muettes depuis 7 jours | une panne ne passe pas inaperçue | une alerte par cause et par 24 h ; jamais « tout va bien » sur une mesure absente | auto | 5 | les trois |
| **I21** | **Le garde-quota équitable** | qu'un vendeur ne vide pas eBay pour les 999 autres | §14 | auto | 4 | les trois |
| **I22** | **Les trois places** : une vente eBay ⇒ « retire-la de Leboncoin » (par N°) ; une vente Leboncoin prouvée ⇒ retrait d'eBay (règle `doublesVenteLbc`) | l'anti double vente partout | identités existantes ; VRM ne touche jamais une annonce Leboncoin seul | auto (message) / réglage (eBay) | 7 | B |
| **I23** | **« Brancher ton agent »** en étapes, et **le bilan de la semaine** qui compte ce que l'agent a fait | le premier jour d'un abonné ; relire sans ouvrir l'app | trois états par étape | — | 15 | B, V |
| **I24** | **La fraîcheur des ventes Vinted** sur les cartes eBay, par compte d'origine | savoir quelles paires eBay sont exposées | lue sur `capturedAt`, jamais `updated_at` (§4.3 du dossier) | auto | 7 | cette synthèse |

### Écarté exprès

- **Mettre en pause sur eBay toutes les paires d'un compte Vinted non relu** :
  ça couperait tes ventes eBay chaque fois que tu n'es pas sur ce compte. Le gel
  (I1-c) borne la **publication** ; il ne retire rien.
- **Acheter l'étiquette eBay en pilotant la page** : interdit (clic simulé, §3)
  et impossible par l'API.
- **Annuler une commande eBay** quand la paire est vendue ailleurs : ça crée un
  défaut sur ton compte ; ton clic, dans eBay.
- **Rembourser, accepter un retour, contester** : ton clic, dans eBay.
- **Remise en vente automatique** : frais possibles ; « revenue » sur Vinted ne
  dit pas toujours que la paire est dans ton carton.
- **Annonces sponsorisées** : seulement sur ta demande (spec `visibilite`
  partie B).
- **Un message « expédié »** : doublon d'eBay. **Un rappel d'évaluation** : eBay
  en envoie déjà un.
- **Masquer ou mettre en pause une annonce Vinted**, même pour éviter une double
  vente : §3, et c'est le signal qui a fait bloquer `vanessa5723`.

---

## 14. Plusieurs vendeurs, sécurité, quotas

- **Chaque tâche porte son `owner`**, pris en base par `vrm_agent_prendre`,
  **jamais** reçu d'un navigateur ni d'une sonnette. Tout tourne dans
  `contexteVendeur.run({owner})` ; toute lecture et écriture passe par
  `portee(owner)` (`owner=eq.`). Le compte eBay se valide contre **son** registre
  (`resoudreCompte`) avant de tirer un jeton. **Un jeton n'est jamais tiré pour
  un autre `owner`** : l'audit le vérifie sur chaque appel sortant.
- **Le serveur ne croit pas sa base pour dépenser** : avant tout achat ou geste
  irréversible, il **relit chez eBay** avec le jeton du compte (un `orderId` d'un
  autre vendeur rend une erreur chez eBay).
- **Les clés du prestataire et le jeton eBay** : chiffrés, liés à leur `owner`
  (données associées), jamais renvoyés au navigateur. Un webhook n'est vérifié
  qu'avec le secret de **ce** vendeur, sur **son** adresse opaque. Un PDF ne se
  télécharge que chez l'hôte du prestataire.
- **Le quota Trading** (5 000 appels par jour pour **toute** l'application,
  extrait officiel [étude `infra.md` §5]) : un compteur global réservé avant
  chaque appel ; **obligations** (retrait d'une paire vendue ailleurs, message
  dû, déclaration) avec 20 % réservés ; **détection** jusqu'à 80 % ; **confort**
  (statistiques, baisses, « ↻ ») arrêté à 60 % ; au plus 1 % par compte et par
  jour hors obligations ; recalage chaque heure sur `getRateLimits`. Le bouton
  « ↻ Rafraîchir » d'aujourd'hui (jusqu'à ~23 appels) passe sous le même
  compteur. ⇒ « Application Growth Check » avant ~700 comptes eBay.
- **Le jeton d'accès gardé 1 h 50**, chiffré : aujourd'hui VRM en redemande un à
  chaque action [étude `infra.md` §1.3], intenable à 1 000 vendeurs (50 000
  renouvellements par jour pour l'application).
- **Abonnement VRM coupé** ⇒ l'agent s'arrête pour lui ; « pas su » ⇒ les
  lectures continuent, rien ne coûte.
- **Fermer son compte VRM** efface ses tables d'agent, retire ses abonnements de
  notification chez eBay et chez le prestataire (avec ses clés, **avant** de les
  effacer), et vide son coffre.
- **Les journaux du serveur** : jamais un pseudo, une adresse, un titre, un
  montant ni un jeton (Vercel les garde 1 h, mais ils passent chez un tiers). Le
  journal relisible est **le nôtre**.
- **Le secret du battement** (`VRM_BATTEMENT_SECRET`, distinct de `CRON_SECRET`)
  est lisible dans la file de `pg_net` par les rôles qui se connectent à la base
  (doc Supabase lue [étude `infra.md` §3.3]) : il ne permet que des battements
  idempotents, freinés, à la réponse sans donnée. Le schéma `net` n'est **jamais**
  exposé à l'API.
- **Données personnelles** : l'adresse de l'acheteur part chez le prestataire
  **sur l'ordre du vendeur** ⇒ la politique de confidentialité le dit **avant**
  le chantier 11.

| tentative d'un vendeur malveillant | ce qui l'arrête |
|---|---|
| lire les clés ou les jetons d'un autre | tables serveur seulement, `owner=eq.`, données associées du chiffrement |
| fabriquer une commande pour faire acheter un bordereau | il ne peut pas écrire les tables de l'agent ; l'agent relit la commande chez eBay avant toute dépense |
| monter ses plafonds sans limite | réglages par la route, bornés par le serveur ; et c'est **son** argent, jamais celui de VRM |
| forger ou rejouer une notification | signature vérifiée ; `notificationId` déjà vu ignoré ; une sonnette ne fait que relire |
| épuiser le quota de tout le monde | part équitable, priorités |
| écrire en masse aux acheteurs | plafonds de messages, texte contrôlé par le serveur |
| faire télécharger une adresse arbitraire | liste blanche par motif de l'hôte du prestataire |
| se servir de l'agent sans payer | `vrm_acces_pour = false` ⇒ arrêt ; ses lignes fermées par la base |

---

## 15. Les chantiers, dans l'ordre

### 15.1 La liste

Effort, en sessions de travail : **S** ≤ 1 · **M** 1 à 2 · **L** 3 à 5. Chaque
chantier est **utile seul**, livré prouvé, et ne promet à l'écran que ce qui est
construit. Quand une spec du 9 octobre tient, elle fait foi.

| # | chantier | ce que ça change pour toi | reprend | effort | dépend de |
|---|---|---|---|---|---|
| **0** | **Fusion** de la branche « plusieurs comptes + règle d'offre » avec `main` (conflits connus : `handleRetirer` × numérotation, `App.jsx`) | rien de visible ; tout le reste est écrit sur cette forme | `etat.md` §5.5 | M | — |
| **1** | **La 553** (I1 a, b, c, d, e ; I2 mesure) — côté app d'abord (app ouverte), le serveur recopiera la même règle ; extension `capterPreuveVente` (bump, zip) | plus de paire vendue sur Vinted qui reste sur eBay **sans un mot** ; la publication refusée sur un compte qui a une vente pas encore reliée | `etat.md` §3.3 ; §6.5 | M | 0 |
| **2** | **Socle** (spec `socle` entière) + suppression de compte signée par la porte `compte.js` + politique d'étiquette (`GetOrders` dédié ≥ 1455) + noms des clés de `shipTo` + `get_shipping_carriers` / `get_shipping_services` pour `EBAY_FR` | l'écran eBay dit vrai ; aucune vente eBay ne sort du CA ; plus d'adresse d'acheteur rangée | `spec-socle.md` | M–L | 0 |
| **3** | **Migration 014** : tables §5.1, fonctions §5.3, RLS lecture seule, restrictive abonnement ; extensions installées, **tâche `pg_cron` pas encore posée** | rien de visible | `infra.md` §4 | M | ton oui |
| **4** | **Coffre + jeton gardé + garde-quota** ; ton jeton eBay déplacé dans le coffre (I21) | ton jeton eBay n'est plus lisible par le navigateur ; VRM tient à 1 000 vendeurs | `infra.md` §5-6 | M | 3 |
| **5** | **Le battement** : mode, tâche `pg_cron`, secours de 08:00, horloge, interrupteurs, répétition, journal, sous-onglet **Agent** (pouls + journal + interrupteurs) ; veille et rangs 0 à 2 ; **« Vendu sur eBay » sur ton téléphone** ; recopie `ebay-regle.js` (I20) | **VRM fermé**, une vente eBay sonne en 15 min | `spec-veille.md` (canal REST), `infra.md` §3 | L | 2, 3, 4 |
| **6** | **Expédier** : `aExpedierEbay` (app + serveur) dans Colis, Ma journée, widget, rappel ; « Ne poste pas » ; voie eBay (bouton + relecture des envois toutes les 2 h) ; rappels I5 ; **Imprimer la journée** (I3) ; PDF glissé et fiche carton (I4) | la vente eBay est dans ta journée avec son N°, sa date limite et son bordereau dans le lot du soir — **Vinted en profite aussi** | `spec-expedier.md` | M–L | 5 |
| **7** | **Retrait serveur + doubles** : `vendeur:doubles`, gel côté serveur, sonnette `veiller` (extension : bump, zip, `EXT_CAPACITES.veilleebay`), publication des comptes bloqués, Leboncoin (I22), fraîcheur par compte (I24) | ton retrait automatique tourne **VRM fermé** | `spec-retrait-serveur.md` | M | 1, 5 |
| **8** | **Argent** : « l'argent que tu reçois » (frais 0 pour un particulier sans tomber en « inconnu »), signature RFC 9421, solde (I14) — **avant ta première vente eBay** ; en parallèle dès 2 | ton CA eBay est juste | `spec-argent.md` | L | 2 |
| **9** | **L'oreille** : Notification API REST par la porte `compte.js`, une adresse par compte, `ORDER_CONFIRMATION` + `AUTHORIZATION_REVOCATION` ; **une seule reconnexion `v2`** (abonnement aux notifications, `sell.analytics.readonly`, `sell.payment.dispute`, et la messagerie si eBay l'accorde) ; emails d'eBay en sonnette (I19) | une vente eBay sonne **dans la minute** ; la veille passe à 60 min | `infra.md` §2 | M | 5 |
| **10** | **Suivi** : `etapeColis`, La Poste Suivi v2, témoin email, alertes (I6), preuve de livraison (I7) | « pas scanné », « bloqué », « livré le … » | `suivi.md` §2, §6 | M | 6 |
| **11** | **Bordereaux achetés par VRM** : interface prestataire, Boxtal (bac à sable), `voieEtiquette` et ta déclaration par compte, achat (répétition → prépare → seul), PDF en stockage, déclaration, webhooks, annulation, poids (I18), coût du port (I13), **politique de confidentialité** | si eBay te laisse le choix : le bordereau s'achète seul, sous plafond | `bordereaux.md` §5 | L | 4, 6, 10 |
| **12** | **Messages + évaluation** (I8) | « au relais jusqu'au … », « livré » | `suivi.md` §4 ; `spec-litiges.md` §2.4 | M | 10 |
| **13** | **Boîte + litiges** : offres et questions (réponses préparées, I17) ; annulations, retours, réclamations avec leurs dates limites ; niveau vendeur (I15) | tout l'après-vente dans VRM | `spec-boite.md`, `spec-litiges.md`, `spec-visibilite.md` | L | 9 |
| **14** | **Annonces vivantes et prix** : pause (I10), remise en vente (I9), baisse (I11), offre aux observateurs (I16), photos chez eBay (I12), mise en vente en lot **si** la fenêtre mesurée le permet (I2) | tes annonces eBay se gèrent dans tes bornes | `spec-annonces-vivantes.md`, `spec-publier-lot.md` | L | 7, 9 |
| **15** | **« Brancher ton agent »** et le bilan de la semaine (I23) | le premier jour d'un abonné | — | S–M | 5, 11 |

**Pourquoi cet ordre :**
- **1 avant tout** : la 553 est le seul défaut qui coûte **aujourd'hui**.
- **5 avant 11** : on n'achète rien tant que l'agent ne sait pas veiller,
  reprendre et se taire sur « pas su ».
- **6 avant 11** : « Imprimer la journée » et la voie eBay servent **sans
  argent**, et probablement ton cas réel.
- **8 avant ta première vente eBay** (une déclaration URSSAF juste).
- **11 après 10** : un bordereau acheté sans suivi serait de l'argent dépensé
  sans surveillance.
- **14 en dernier** : publier plus de paires sur eBay n'a de sens qu'une fois la
  fenêtre de double vente réduite et mesurée.

**Au total** : environ **25 à 35 sessions**, dont une partie en parallèle (2 et
3 ; puis 6, 7, 8 et 10). Ce que tu gagnes, dans l'ordre : après 1, plus de double
vente silencieuse ; après 5, ton téléphone sonne VRM fermé ; après 6, ta journée
et ton impression du soir incluent eBay ; après 10, tu sais où est chaque colis ;
après 11, un revendeur à étiquette libre n'a plus rien à faire entre la vente et
l'impression.

### 15.2 Les preuves

**La méthode du dossier (§6.1)**, pour chaque chantier : l'arbre d'avant par
`git archive HEAD | tar -x -C /tmp/avN`, le script **copié dedans** et lancé
**depuis** cet arbre, `DIST` déduit de `__dirname` ; rouge sur l'avant, vert
après, **et rouge sous mutation** du code d'après (« la fonction n'existait pas »
ne prouve rien). Tout passe par `essaie()` : un audit ne meurt pas, il rapporte.

**Trois preuves transversales (B) :**

1. **`scripts/audit-agent-sql.cjs`** — la migration 014 **exécutée** sur un
   Postgres jetable (méthode et socle d'`audit-renum-b.cjs`) :

   | contrôle | ce qui est vérifié |
   |---|---|
   | concurrence | deux sessions appellent `vrm_agent_prendre` en même temps : jamais la même tâche, jamais deux d'un même `groupe` |
   | bail | un bail expiré se reprend |
   | version | version périmée ou mauvais jeton ⇒ 0 ligne |
   | réservation | 50 réservations parallèles ne dépassent jamais le plafond |
   | première fois | `true` une seule fois sur 50 appels parallèles |
   | lecture | `authenticated` lit **ses** commandes et son journal, jamais ceux d'un autre |
   | écriture | `authenticated` ne peut **rien** écrire, ni lire la file, les compteurs, les routes ou le coffre ; `anon` ne lit rien |

   Mutations, chacune rouge : `skip locked` retiré · condition de version retirée
   · condition de bail retirée · règle d'écriture ajoutée pour `authenticated`.

2. **`scripts/audit-agent-vie.cjs`, le banc de vie** : des commandes vécues **de
   la vente à la clôture** sur une **horloge simulée** ; le vrai
   `api/ship-reminders.js` (`mode=battement`) et la vraie porte `api/compte.js`
   dans un `vm` ; les tables servies par **le même Postgres jetable** ; un faux
   eBay, un faux Boxtal, un faux Sendcloud, une fausse La Poste et un faux Web
   Push qui **comptent** chaque appel ; deux vendeurs, deux comptes eBay chez l'un.

   | # | scénario | attendu |
   |---|---|---|
   | 1 | une vente, voie eBay, suivi rattaché par eBay 6 h plus tard, La Poste « livré » à J+2 | close à J+32 ; 1 sonnerie de vente, 0 achat, 0 message (éteints) |
   | 2 | voie VRM en répétition | 0 achat ; 1 ligne « aurait acheté » ; ton achat dans eBay est lu et mis à côté |
   | 3 | voie VRM en réel, premier achat | « à confirmer » ; ton clic ⇒ **1** achat, 1 déclaration, PDF `%PDF` |
   | 4 | **coupure juste après le `POST` d'achat Boxtal** | `etiquette_incertaine`, **0 second achat** sur 7 jours simulés, 1 notification `agent`, réservation gardée |
   | 5 | même chose avec Sendcloud | relecture par référence, **1 seul envoi** chez le faux Sendcloud |
   | 6 | deux battements simultanés | chaque geste une fois |
   | 7 | base en 522 pendant l'écriture de l'issue | aucun geste refait ; reprise en incertain |
   | 8 | notification eBay forgée ; vraie notification rejouée | 412 et 0 relecture ; 1 seule relecture |
   | 9 | webhook prestataire avec le secret d'un autre vendeur | refusé, 0 écriture |
   | 10 | jeton `invalid_grant` | compte refusé, 1 notification, 0 appel ensuite |
   | 11 | abonnement coupé en plein transit | 0 appel, 0 notification ; reprise à la réactivation |
   | 12 | plafond du jour au 11ᵉ bordereau | 10 achats, le 11ᵉ « à confirmer » |
   | 13 | transporteur absent de la table d'eBay | 0 déclaration, dit |
   | 14 | Mondial Relay sans email | « suivi pas lu », dit une fois, aucune étape inventée |
   | 15 | annulation après achat, aucun scan | proposée ; avec le réglage, annulée à +24 h ; avec un scan, **jamais** |
   | 16 | colis renvoyé à l'expéditeur | « la paire revient », aucune remise en vente automatique |
   | 17 | la paire de la commande est vendue sur Vinted pendant le transit | aucun retrait (vendue ici), « retire-la de Vinted » une fois |
   | 18 | le titre de chaque commande remplacé par celui d'une autre paire | **sorties identiques** |
   | 19 | au relais, limite connue ; limite inconnue | 1 message J-2 à 10 h ; 0 |
   | 20 | 25 commandes d'un vendeur, 1 d'un autre | le second n'attend pas plus d'un battement |
   | 21 | **le cas 553** : vente Vinted prouvée **par bordereau seul**, annonce eBay créée 4 min après, aucune autre annonce Vinted du N° | retrait (réglage allumé) **et** publication refusée |
   | 22 | **le gel** : une vente Vinted rangée sans preuve sur le compte A | publication des paires de A refusée ; 1 notification `double` sans nom de paire ; 0 retrait ; le gel tombe dès la preuve |
   | 23 | un message dû à 3 h du matin | parti à 9 h |

   Mutations, chacune rouge : mémo écrit après l'envoi (⇒ 2 messages) · incertain
   traité comme « à refaire » (⇒ 2 achats) · « pas su » traité comme « rien »
   (⇒ achat sur une lecture ratée) · filtre `owner` retiré (⇒ fuite) · `groupe`
   ignoré (⇒ deux appels en vol sur un compte) · fenêtre horaire retirée · plafond
   lu dans le navigateur · source bordereau retirée de la preuve (⇒ scénario 21
   rouge) · gel retiré (⇒ scénario 22 rouge).

3. **Les règles pures** (`decider`, `etapeColis`, `voieEtiquette`) exécutées sur
   une matrice, avec les invariants de §6.2 sur **chaque** cas, titre muté
   compris.

**Par chantier** (bancs de rendu : données inventées, 390 et 1 512 px, jugement
sur les `data-*` et sur le corps exact qui part vers la route ; ports **4841 à
4850**, libres [mesuré ici] ; 4831 à 4840 restent aux specs du 9 octobre) :

| chantier | audit (le vrai code exécuté) | banc de rendu | mutations qui doivent rougir |
|---|---|---|---|
| 1 | `audit-ebay-preuve-bordereau.cjs` : bordereau seul ⇒ prouvée ; conversation (état vide) ⇒ rien ; vente annulée ⇒ rien ; vente sans preuve ⇒ gel ; et `audit-preuve-vente-ext.cjs` (le vrai `background.js` dans un `vm`) : 3 lectures au plus, `gardeLecture`, rien pendant une pause Vinted, rien pour un autre compte | `ebay-doubles.cjs` (**4847**) : la 553 dans « à retirer », « Publier » gelé avec la raison | source bordereau retirée ; exception remise ; gel retiré ; `capterPreuveVente` hors `garde` |
| 2 | `audit-ebay-socle.cjs` (spec) + seul `GetOrders` part au niveau 1455 ; aucune valeur d'adresse servie ne se retrouve dans une écriture ; la suppression par `compte.js` garde son défi | `ebay-socle.cjs` (4831, spec) | `commandeMinimale` qui garde l'adresse ; 1455 sur tous les appels |
| 3 | `audit-agent-sql.cjs` (ci-dessus) | — | ci-dessus |
| 4 | `audit-coffre.cjs` : une valeur recopiée chez un autre vendeur ne se déchiffre pas ; le jeton gardé n'est jamais renvoyé ; le quota réserve avant l'appel | — | données associées retirées ; garde-quota retiré |
| 5 | `audit-agent-battement.cjs` (route dans un `vm`, deux vendeurs) + `audit-agent-vie.cjs` scénarios 1, 6, 10, 11, 20 | `ebay-agent.cjs` (**4841**) : pouls (actif, répétition, arrêté, pas su gris) | filtre `owner` retiré ; installation ignorée |
| 6 | `audit-ebay-expedier.cjs` (spec) + rappels annulés au scan + PDF glissé tamponné **seulement** sur un n° exact | `ebay-colis.cjs` (**4843**) : même nombre dans Colis, Ma journée, cloche et widget ; « Ne poste pas » en tête ; « Imprimer la journée » rend la liste de ramassage puis un bordereau par feuille, **tamponné** (flux décompressés, comme `lbc-bordereau.cjs`) | annulation demandée comptée « à poster » ; tampon sur un n° approchant |
| 7 | `audit-ebay-retrait-serveur.cjs` (spec) + sonnette sur **preuve** rangée (pas seulement `orders_sold`) | `ebay-retrait-serveur.cjs` (4835, spec) | comptes bloqués `null` lus « aucun » |
| 8 | `audit-urssaf.cjs` étendu, `audit-ebay-signature.cjs` (spec) | `ebay-argent.cjs` (4836, spec) | total acheteur remis |
| 9 | `audit-agent-evenements.cjs` : paire ECDSA générée par l'audit ; signature fausse ⇒ 412 et 0 écriture ; même `notificationId` deux fois ⇒ 1 tâche ; faux titre, prix, acheteur dans le corps ⇒ aucune de ces chaînes écrite ; `k` inconnu ⇒ 204 | `ebay-veille.cjs` (**4842**) | signature non vérifiée ; contenu de la sonnette cru |
| 10 | `audit-ebay-suivi.cjs` : code inconnu jamais `livre` ; étape qui ne recule pas ; authentification jamais « livré au client » ; « pas scanné » seulement avec un statut lu après | `ebay-suivi.cjs` (**4844**) | « pas su » traité comme « en transit » |
| 11 | `audit-agent-bordereau.cjs` (faux Boxtal à la forme du bac à sable) : `EBAY_ONLY` ⇒ 0 ; politique pas sue ⇒ 0 ; relais sans point ⇒ 0 ; poids pas su ⇒ 0 ; au-dessus du plafond ⇒ 0 et « à confirmer » ; un seul `POST` avec la référence ; envoi déjà déclaré ⇒ 0 ; PDF d'un autre hôte ⇒ refusé ; répétition ⇒ 0 appel payant | `ebay-bordereau.cjs` (**4845**) : la confirmation montre prix, ville, poids, N° ; **Annuler n'envoie rien** | état écrit après l'achat ; plafond rendu sur un incertain ; HMAC non vérifié |
| 12 | `audit-agent-messages.cjs` : éteint ⇒ 0 ; mémo illisible ou non écrit ⇒ 0 ; deux passages ⇒ 1 ; date inconnue ⇒ pas de J-2 ; URL, email, téléphone, `{` ⇒ refusé ; plafond ; > 90 j ; coupure ⇒ jamais renvoyé | `ebay-messages.cjs` (**4846**) : le texte exact se relit | contrôle d'URL retiré ; mémo après l'envoi |
| 13 | audits des specs `boite` et `litiges` | ports des specs | les leurs |
| 14 | `audit-agent-prix.cjs` : jamais sous le plancher, jamais sans plancher, jamais au seuil de la règle d'offre, une fois par 7 jours ; offre automatique (si tu la décides) jamais sans règle d'offre | `ebay-vivantes.cjs` (**4848**) | plancher ignoré ; seuil de la règle d'offre ignoré |
| 15 | — | `ebay-brancher.cjs` (**4849**) : chaque étape à trois états | « pas su » affiché fait |

Et toujours : `audit-fonctions-api.cjs` (12 fonctions), `audit-secrets.cjs`
(aucune clé dans le dépôt public), `audit-offres-auto.cjs` (aucune acceptation
hors du seuil natif), `audit-bilan-semaine.cjs` (`PUSH_CATS` = `PUSH_DEFAUT`).
Les bancs eBay existants n'ont **rien** à changer de leur façon de servir le
corps : la porte du signé est `compte.js`.

---

## 16. Tes gestes, une seule fois

Dans l'ordre où ils servent. **Aucun n'est à faire avant que son chantier soit
livré**, sauf les deux premiers.

| # | quand | geste | où | pourquoi |
|---|---|---|---|---|
| 1 | **maintenant** | **retirer la N°553 d'eBay** (annonce `128127336988`) | eBay → Mes annonces, ou VRM → eBay → Annonces → « Retirer » | vendue sur Vinted depuis le 10 octobre |
| 2 | maintenant | **relier** l'annonce `128101592740` à sa paire | VRM → eBay → Annonces → « Relier à une paire » | sans SKU, aucune protection ne la voit |
| 3 | avant les abonnés payants | **décider Vercel Pro** (environ 20 $ par mois et par développeur, secondaire) | vercel.com → Settings → Billing | Hobby = « non commercial » (extrait officiel [étude `infra.md` §0]) ; Pro donne aussi le cron à la minute et 800 s |
| 4 | chantier 1 | **trancher** l'exception « publiée après la vente » (section 17) | une réponse | l'audit protège la règle d'aujourd'hui |
| 5 | chantier 1 | **installer l'extension** livrée (un seul dossier VRM dans Chrome) | `chrome://extensions` | la lecture des ventes dès qu'elles apparaissent |
| 6 | chantier 3 | **dire oui à la migration 014** (elle installe `pg_cron` et `pg_net`) | une réponse | l'horloge de l'agent |
| 7 | chantier 4 | poser **`VRM_COFFRE_CLE`** (32 octets aléatoires, « sensitive ») **et en garder une copie hors ligne** | Vercel + ton gestionnaire de mots de passe | la perdre = ressaisir les clés (aucune fuite, aucune perte d'argent) |
| 8 | chantier 5 | poser **`VRM_BATTEMENT_SECRET`** (64 caractères, « sensitive »), puis la même valeur dans le coffre : `select vault.create_secret('<valeur>', 'vrm_battement_secret');` | Vercel, puis Supabase → SQL Editor | le battement s'authentifie |
| 9 | toujours | **ne jamais** ajouter le schéma `net` aux schémas exposés | Supabase → Settings → API | sinon le secret du battement devient lisible par l'app |
| 10 | chantier 5 | **allumer l'agent** : l'installation (`agent_ebay = '1'`), puis ton interrupteur. Les familles qui engagent démarrent en répétition | VRM → eBay → Agent | rien ne part avant |
| 11 | chantier 9 | **te reconnecter une fois** à chaque compte eBay | VRM → eBay → Compte eBay → « Reconnecter » | notifications, statistiques, litiges |
| 12 | chantier 9 | demander à eBay l'**« Application Growth Check »** (gratuit) : hausse du quota Trading | developer.ebay.com [chemin exact à vérifier] | sans elle, l'agent plafonne vers 700 à 1 000 comptes |
| 13 | chantier 10 | créer une **clé « Suivi » La Poste**, puis `LAPOSTE_OKAPI_KEY` sur Vercel | developer.laposte.fr (compte gratuit, secondaire), puis Vercel | Colissimo et Chronopost suivis jusqu'au client |
| 14 | **à ta première vente eBay** | regarder ce qu'eBay t'impose, puis le dire à VRM par compte : « j'achète dans eBay » (défaut) ou « VRM achète » | VRM → eBay → Agent → Expédier | la voie du bordereau |
| 15 | si « VRM achète » | compte **pro Boxtal** (SIRET) · **prélèvement différé** · application **API v3** · coller les clés dans VRM · **bac à sable** d'abord · **peser une boîte** · plafonds · répétition · puis « prépare, je confirme » · puis seul | Boxtal, puis VRM | l'agent achète avec **ton** compte |
| 16 | quand tu veux | allumer **« Automatiser les évaluations »** dans eBay | eBay → Préférences de vente | l'évaluation positive, sans VRM |
| 17 | quand tu veux | choisir tes messages (conseil : le **rappel J-2 au relais** d'abord) | VRM → eBay → Agent → Parler au client | — |
| 18 | pour la baisse automatique | saisir des **prix d'achat** ou des **planchers** | VRM → Annonces (saisie en série) | sans plancher, l'agent ne baisse rien |

---

## 17. Ce que tu dois trancher

Aucune n'est urgente. Chacune porte ma recommandation, et la raison.

| # | décision | ma recommandation | pourquoi |
|---|---|---|---|
| 1 | **Vercel Pro** avant d'ouvrir VRM à des abonnés payants | **oui** | Hobby est « non commercial » ; l'architecture marche sur les deux plans, rien n'est perdu à attendre |
| 2 | **Retirer l'exception « annonce eBay publiée après la vente »** du retrait automatique | **oui** | c'est elle qui aurait écarté la 553 même avec la preuve ; « la paire est revenue » est déjà couvert (vente annulée = pas une preuve ; autre annonce Vinted du N° en vente). Alternative de B : la juger sur la date de la preuve connue à la publication (`preuveLueA`) — plus complexe, pour un cas déjà couvert |
| 3 | **L'offre automatique aux observateurs** sur les paires qui dorment | **non pour l'instant** ; si oui, **seulement** sur une annonce qui porte ta règle d'offre, à un prix ≥ ton seuil d'acceptation, ≥ 2 observateurs, 14 jours sans vente, une par 14 jours | une offre acceptée vend la paire ; sur eBay tu n'as permis qu'une forme : le seuil natif. Avec cette garde, elle ne vendrait qu'à un prix auquel tu as déjà dit oui |
| 4 | **Les réponses automatiques aux questions** eBay | **d'abord des réponses préparées** ; l'automatique seulement après **20 réponses préparées envoyées telles quelles**, avec les gardes de Vinted (rien sous 55 de confiance, aucun prix inventé, jamais deux fois) | ta décision « elle répond à tout » (18 septembre) vaut pour Vinted ; eBay surveille les messages. Il faut aussi une clé d'IA côté serveur (absente aujourd'hui) |
| 5 | **Le suivi Mondial Relay** d'une étiquette achetée dans eBay | **« pas su » + le témoin email** pour commencer ; décider un service payant (AfterShip, TrackingMore) après tes 10 premières ventes eBay | un sous-traitant de données de plus (politique de confidentialité à changer) ; on ne sait pas encore combien de tes ventes eBay partiront en Mondial Relay |
| 6 | **Une clé La Poste** pour toute l'installation, ou une par vendeur | **une clé VRM**, résultats rangés par vendeur | elle ne lit que des numéros de suivi ; quota et conditions [à vérifier] |

Et une question qui n'est pas de code, mais qui décide de la voie du bordereau
et des frais (V) : ton compte eBay **particulier** revend-il des paires achetées
pour être revendues ? eBay.fr écrit qu'il faut alors être professionnel (extrait
officiel [étude `possible.md` §2.D]).

---

## 18. Ce qui est impossible ou risqué, dit franchement

### 18.1 Impossible aujourd'hui

1. **Acheter un bordereau eBay par l'API en France** : la Logistics API ne fait
   que l'USPS ; une « Labels API » serait en bêta fin 2026, avec des
   transporteurs britanniques [étude `bordereaux.md` §1, à vérifier]. Voie eBay :
   un clic par vente.
2. **Fermer la fenêtre de double vente** : VRM apprend tes ventes Vinted par ton
   extension, compte par compte (§2.2). L'agent la réduit (I1), la mesure (I2),
   ne la supprime pas. Et entre une vente eBay et ton geste sur Vinted, la paire
   reste en vente sur Vinted : VRM n'y touche jamais.
3. **Imprimer sans ton clic, déposer sans toi.**
4. **Connaître le point relais choisi par l'acheteur** par un champ documenté :
   à mesurer sur la première vente en relais.
5. **Savoir « livré » par eBay** : seulement par le transporteur. **Suivre un
   Mondial Relay acheté dans eBay** sans contrat ni service payant : « pas su »
   possible.
6. **Écrire un lien de suivi au client** : interdit par eBay.
7. **Demander ton virement eBay par l'API** : aucune voie connue [à vérifier].

### 18.2 Risqué, et ce qui le borne

| risque | ce qui le borne |
|---|---|
| un bordereau acheté pour une commande annulée | délai de grâce ; « Ne poste pas » sur une demande ; annulation du bordereau sur une annulation **prouvée** et sans scan |
| deux bordereaux pour une commande | envoi déjà déclaré ⇒ aucun achat ; écrire avant d'agir ; **Boxtal incertain ⇒ arrêt et ta question**, jamais un second achat sans preuve |
| deux systèmes qui déclarent (intégration eBay native d'un prestataire) | même relecture ; le premier jour le dit |
| un poids sous-déclaré | poids validé par toi, montré, gardé ; le devis fait foi |
| le mauvais relais | aucun achat en relais sans le point lu par identité |
| une dépense qui s'emballe | plafonds réservés en base, bornés par le serveur ; interrupteur d'installation qui arrête tout à la minute ; répétition par famille |
| un message qui déplaît à eBay | aucun lien ni coordonnée, plafonds, heures décentes, éteint par défaut ; un refus n'est jamais réessayé dans l'heure |
| le pseudo de l'acheteur remplacé par un identifiant fixe (annoncé pour les États-Unis) | chaque refus d'eBay rendu tel quel, jamais compté comme envoyé |
| une notification qui n'arrive pas | la veille tourne toujours (15 ou 60 min) ; une notification n'est qu'une sonnette |
| `ShippingLabelPolicy` introuvable | la voie vaut « eBay » par défaut ; rien n'en dépend |
| le quota Trading | garde-quota, priorités, hausse demandée tôt |
| le secret du battement lisible dans la file `pg_net` | un secret à part, inoffensif |
| Vercel Hobby, usage commercial | ta décision 1 |
| l'adresse d'un acheteur chez un prestataire | sur l'ordre du vendeur ; jamais rangée par VRM ; politique de confidentialité avant le chantier 11 |
| la numérotation 013 qui change le sens d'un SKU | le SKU se lit par `numeroExterne` (un SKU posé avant la coupure désigne l'ancienne paire) |
| un défaut de l'agent | répétition, premier de chaque sorte confirmé, deux interrupteurs, journal relisible, chaque geste prouvé rouge sur l'avant et sous mutation |

---

## 19. Ce qui reste à mesurer, au premier vrai essai

1. **Ta première vente eBay** : eBay t'impose-t-il son bordereau ? la politique
   d'étiquette est-elle lue ? les **noms des clés** de `shipTo` (un identifiant
   de point relais ?) ; `shipByDate` ; `totalMarketplaceFee` (doit valoir 0, pas
   être absent, pour un particulier).
2. **`ORDER_CONFIRMATION`** pour un vendeur eBay.fr : arrive-t-elle, en combien
   de secondes, avec quel droit d'abonnement ? nomme-t-elle le compte ? combien
   d'adresses une application peut-elle créer ? la signature se vérifie-t-elle
   sur le corps brut ?
3. **`getShippingFulfillments`** après une étiquette achetée dans eBay : le
   numéro (et sa forme pour Mondial Relay), le code transporteur ; et si
   `lastmodifieddate` de la commande bouge à ce moment-là.
4. **`get_shipping_carriers`** pour `EBAY_FR` : les codes exacts.
5. **Boxtal** : le champ de référence, une recherche par référence, le format
   10 × 15 par transporteur, les grilles 1-2 kg, les régularisations de poids,
   les clés v1 pour les devis, un micro-entrepreneur accepté.
6. **La Poste Suivi v2** : le code « au point de retrait », la **date limite de
   retrait**, le quota.
7. **`AddMemberMessageAAQToPartner`** avec le jeton OAuth sur eBay.fr : longueur
   maximale, ce que voit l'acheteur.
8. **La fenêtre de double vente après le chantier 1**, avec la même requête
   qu'en §2.2 : combien de minutes entre une vente Vinted et sa preuve, compte
   par compte.
9. **`pg_net` → vrm.center** : le délai réel ; et « Fluid compute » actif (300 s).
10. **Le délai d'annulation** d'un acheteur eBay.fr (pour régler le délai de
    grâce).
11. **Si eBay garde les photos Vinted** d'une annonce dans le temps.

---

## 20. Sources

**Les trois conceptions jugées** (ce dossier) : `design-evenements.md`,
`design-battement.md`, `design-vendeur.md`. **Les études du jour** :
`bordereaux.md`, `suivi.md`, `infra.md`, `etat.md`, avec leurs propres sources.
**La feuille de route du 9 octobre** : `../agent-ebay/feuille-de-route.md`,
`possible.md`, `spec-socle.md`, `spec-veille.md`, `spec-expedier.md`,
`spec-retrait-serveur.md`, `spec-argent.md`, `spec-boite.md`, `spec-litiges.md`,
`spec-annonces-vivantes.md`, `spec-publier-lot.md`, `spec-visibilite.md`.
**Le dossier** : `CLAUDE.md` (§3, §4, §5, §6, §7, §11, retrait automatique eBay,
numérotation 013, PDF étape 0, abonnement, plan Hobby).

**Mesuré pendant cette synthèse, le 11 octobre** (lecture seule, projetée) :
- base `lgonxzrzjcqthjtbdpzo`, propriétaire `74eea6e7-…` :
  - `ebay_listings`, `ebay_orders`, `ebay_programmees` : `capturedAt` =
    1791664152309 (10 octobre, 20 h 29 min 12 s UTC), 3 annonces (`VRM-559`,
    sans SKU, `VRM-553`), 0 commande ;
  - extensions installées : `pgcrypto`, `supabase_vault` ; **pas** `pg_cron`,
    `pg_net` ;
  - la fenêtre de double vente (§2.2) : ventes de `harvest_*_orders_sold`
    datées du 1ᵉʳ au 11 octobre 12 h UTC, hors annulées et remboursées (15) ;
    première écriture après la vente dans `sauvegarde.journal_ecritures` des
    lignes `harvest_{uid}_label_{tx}` (avec `item`) et `harvest_{uid}_txn_{tx}`
    (avec `status_title`) ;
  - champs d'une vente `orders_sold` : `date, photo, price, title, status,
    transaction_id, conversation_id, transaction_user_status` ; aucune photo sur
    les ventes d'octobre vérifiées (0 sur 11) ;
  - familles `email_*` : `email_sale` ne porte ni transaction ni annonce ;
    `email_bord` porte `transaction` ; aucun email d'eBay.
- code :
  - `wf_30feaf2f-334-8` : `api/compte.js` (`bodyParser:false` l. 32,
    `corpsBrut()` l. 92) ; `api/ebay.js` (une seule lecture de `req.body`,
    l. 1522 ; `ACTIONS` l. 1586-1605 ; modes `deletion` et `callback`
    l. 1617-1619) ; `vercel.json` (un cron, cinq réécritures, aucune
    `maxDuration`) ;
  - `integ-11oct` : `api/ship-reminders.js` (`CRON_SECRET` l. 366-371) ;
    `api/_lib/stamp.js` (`stampBordereau`, utilisé par `api/email-inbound.js`) ;
    `vinted-sync-extension/background.js` (alarmes l. 3637-3650 : `runActive`
    toutes les 20 min pour le compte du cookie) ;
  - ports des bancs : 4801, 4802, 4812 pris ; 4841 à 4850 libres.

**Recherches pendant cette synthèse** (extraits de moteur ; `developer.ebay.com`
renvoie `ENOTFOUND` depuis ce conteneur) :
- `ITEM_MARKED_SHIPPED` « sends notifications to the buyer when the associated
  seller marks the item as shipped », ajouté en 1.6.7 le 12 décembre 2025 :
  [notes de version de la Notification API](https://developer.ebay.com/develop/api/notification-api/release-notes),
  [contrat `item_marked_shipped.yaml`](https://developer.ebay.com/api-docs/master/commerce/notification/asyncapi/item_marked_shipped.yaml),
  [aperçu de la Notification API](https://www.developer.ebay.com/api-docs/commerce/notification/overview.html).
- `ShippingLabelPolicy` / `EBAY_ONLY` : **aucun résultat** sur deux recherches
  (référence `OrderType` des versions 1451 et 1477, `GetOrders`, guide de gestion
  des commandes) :
  [OrderType (1477)](https://developer.ebay.com/Devzone/XML/Docs/Reference/eBay/types/OrderType.html),
  [GetOrders](https://developer.ebay.com/devzone/xml/docs/reference/ebay/GetOrders.html),
  [Order Management Guide](https://developer.ebay.com/develop/guides-v2/order-management-guide).
- Plafond d'adresses de notification : **non trouvé** ; `getDestinations` pagine
  de 10 à 100 :
  [getDestinations](https://developer.ebay.com/api-docs/commerce/notification/resources/destination/methods/getDestinations).
