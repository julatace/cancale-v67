# L'agent eBay autonome — conçu à partir de la journée de Julien

**Pour :** Julien d'abord (sections 0, 1, 2, 3, 14, 15), puis les sessions qui
construiront (sections 4 à 13, 16).
**Rédigé le :** 11 octobre 2026.
**Angle :** on part de ce que vit un revendeur — vendre, imprimer, déposer, être
tranquille — et l'architecture suit. Chaque geste de l'agent porte sa garde.

**Ce document s'appuie sur** (lus en entier, dans ce dossier) : `bordereaux.md`,
`suivi.md`, `infra.md`, `etat.md`, et la feuille de route du 9 octobre
(`../agent-ebay/feuille-de-route.md`, `possible.md`, `spec-socle.md`,
`spec-veille.md`, `spec-expedier.md`, `spec-retrait-serveur.md`, `spec-boite.md`,
`spec-annonces-vivantes.md`, `spec-litiges.md`, `spec-publier-lot.md`, et le début
de `spec-argent.md` et `spec-visibilite.md`). Il les **réutilise** et ne les
répète pas : quand un point y est déjà établi, je renvoie à la section.

**D'où vient chaque fait :**

| marque | sens |
|---|---|
| **[mesuré]** | lu moi-même le 11 octobre, en lecture seule projetée, sur ta base Supabase, ou dans le code des arbres `integ-11oct` et `wf_30feaf2f-334-8` |
| **[repris de X]** | établi par le document X de ce dossier, avec sa propre source |
| **(extrait officiel)** | extrait d'une page officielle renvoyé par un moteur de recherche ; la page elle-même n'a pas pu être ouverte (bloquée par le proxy du conteneur) |
| **(secondaire)** | article, forum, bibliothèque non officielle |
| **[à vérifier]** | pas établi. Rien de ce qui porte cette marque ne doit devenir une promesse à l'écran |

**Aucun appel** n'a été fait à eBay, à un transporteur, à un agrégateur ou à
Vinted. Aucune écriture nulle part, sauf ce fichier.

---

## 0. En une page, pour Julien

### Ce que tu vivras

1. **Une vente eBay fait sonner ton téléphone dans la minute**, avec tout ce qu'il
   faut savoir en une ligne : « Vendu sur eBay · N°214 · Air Max 1 · 120 € · à
   poster avant jeudi · bordereau prêt ». Le numéro de carton vient de l'annonce
   (SKU `VRM-214`), jamais d'une ressemblance de titre.
2. **Le bordereau se fait sans toi**, quand c'est possible (voir plus bas). Le soir,
   un bouton **« Imprimer la journée »** sort, une par feuille, tous tes bordereaux
   du jour — Vinted et eBay mélangés — tamponnés du titre et du N°, précédés d'une
   **liste de ramassage** triée par carton.
3. **Au relais, tu n'as plus rien à cocher pour eBay.** Le premier scan du
   transporteur fait passer la vente dans « Partis ». 48 h sans scan : VRM te le dit.
4. **Ton client est suivi jusqu'au bout** : colis au relais, livré, bloqué. Si tu
   l'allumes, VRM prévient l'acheteur deux jours avant que le relais ne renvoie le
   colis. La preuve de livraison est gardée sur la vente, pour un litige.
5. **Rien ne se vend deux fois.** Vendue sur Vinted ⇒ retirée d'eBay (tu l'as déjà
   allumé), **même VRM fermé**. Vendue sur eBay ⇒ « retire-la de Vinted »
   immédiatement (VRM ne touche jamais une annonce Vinted).
6. **Tout ce que VRM fait en ton nom s'écrit dans un journal que tu relis**, et ce
   qui peut se défaire se défait d'un clic (annuler un bordereau pas déposé,
   remettre en vente une annonce retirée).
7. **L'agent commence par répéter** : pendant ses premiers jours, il écrit « voilà
   ce que j'aurais fait » sans le faire. Tu relis, tu valides, il passe en réel.

### Les deux murs, dits franchement

- **Le bordereau eBay ne s'achète par aucune API en France** (la seule API
  d'étiquettes d'eBay ne fait que l'USPS, aux États-Unis) [repris de
  `bordereaux.md` §1]. Et depuis juin 2026, une commande eBay peut exiger
  « une étiquette fournie par eBay » (`ShippingLabelPolicy = EBAY_ONLY`). **On ne
  sait pas encore si tes ventes la portent** : VRM ne lit pas ce champ aujourd'hui,
  et tu n'as encore eu aucune vente eBay [mesuré : `ebay_orders` = 0 commande].
  - Si elle est là : VRM **n'achète rien ailleurs**. Il te laisse **quelques clics
    dans eBay**, sur la page qu'il t'ouvre, et fait **tout le reste** seul (suivi,
    client, alertes, journal). C'est d'ailleurs l'étiquette la moins chère
    (3,58 € Mondial Relay jusqu'à 1 kg, grille du 3 octobre (secondaire)).
  - Si elle n'y est pas (peut-être sur ton compte **professionnel** : à mesurer) : VRM
    **achète lui-même** le bordereau chez un agrégateur (Boxtal), **avec ton compte
    et ta carte bancaire à toi**, plafonné, et déclare le suivi à eBay.
- **Le papier et le relais restent à toi.** Aucun site ne peut imprimer sans que tu
  appuies sur « Imprimer », et personne ne dépose le colis à ta place. « 100 %
  autonome » s'arrête là — tout le reste se fait seul.

### Ce que VRM ne fera jamais

Toucher une annonce Vinted ; accepter une offre autrement que par le seuil natif
d'eBay que tu as posé (décision du 9 octobre) ; acheter un bordereau sans ton
réglage, au-delà de tes plafonds, ou sur un « je ne sais pas » ; deviner un point
relais, un poids, une catégorie, un état ; envoyer un lien ou une coordonnée à un
acheteur ; décider un remboursement, un retour ou un litige ; réutiliser la clé
d'un vendeur pour un autre.

### À faire maintenant, avant tout le reste

- ⚠️ **Ta N°553 est toujours en vente sur eBay alors qu'elle est vendue sur
  Vinted** depuis le 10 octobre à 22 h 25 (heure de Paris). La dernière lecture
  d'eBay par VRM date du 10 octobre 22 h 29 et n'a pas bougé depuis [mesuré :
  `ebay_listings.capturedAt` inchangé, 3 annonces]. **Retire-la d'eBay** (la cause
  et sa correction sont au chantier C1).
- Relie ton annonce eBay sans SKU (`128101592740`) à sa paire : sans SKU, aucune
  protection ne peut la voir.

### En chiffres

- Vinted : **60 ventes en 30 jours** (58 hors annulées et remboursées), **62,59 €**
  en moyenne [mesuré, `orders_sold` dédoublonnées par transaction]. Soit ~2 par
  jour.
- eBay : 3 annonces, **0 vente**, imprimante réglée sur **« normale » (A4)**,
  retrait automatique **allumé** [mesuré, ligne `main`].
- L'agent est donc conçu pour 1 000 vendeurs, mais il démarre sur un flux réel
  faible : d'où la répétition, et des preuves au banc plutôt qu'en vrai.

### Tes gestes, une seule fois (détail section 14)

Décider Vercel Pro (usage commercial) · activer deux extensions Supabase · poser
trois secrets sur Vercel · te reconnecter à eBay une fois · (si ton compte pro le
permet) ouvrir un compte Boxtal pro avec prélèvement · régler ton colis type et tes
plafonds · laisser l'agent répéter, puis l'allumer.

---

## 1. La journée de Julien, avec l'agent

### 1.1 Une vente eBay, du clic de l'acheteur à l'évaluation

Exemple : la N°214 (carton B12), vendue 120 € un mardi à 14 h 02.

| quand | ce qui se passe, sans toi | ce que tu vois | ce que tu fais |
|---|---|---|---|
| mar. 14 h 02 | l'acheteur paie. eBay envoie à VRM la sonnette `ORDER_CONFIRMATION` (signée) | — | — |
| 14 h 03 | l'agent relit la commande **chez eBay, avec le jeton de ce compte**, trouve le SKU `VRM-214`, la date limite d'envoi (`shipByDate`), et lit si l'étiquette est libre ou imposée | notification : « Vendu sur eBay · N°214 (carton B12) · Air Max 1 · 120 € · à poster avant jeu. 16/10 » | rien |
| 14 h 03 | **la N°214 est-elle encore en ligne ailleurs ?** sur un **autre compte eBay** : retrait automatique (si allumé) ; sur **Vinted** : « ⚠️ retire-la de Vinted » + le lien de SON annonce ; sur **Leboncoin** (si VRM sait qu'elle y est) : « retire-la de Leboncoin » | une seconde ligne dans la même notification, seulement s'il y a quelque chose à retirer | retirer l'annonce Vinted (c'est toi, toujours) |
| 14 h 03 → 16 h 03 | **délai de grâce** (réglable, 2 h par défaut) : l'acheteur peut encore changer d'avis ; un bordereau acheté trop tôt serait à annuler | — | — |
| 16 h 03 | **étiquette libre + Boxtal relié + réglage allumé** : devis (prix exact), plafonds réservés, achat, PDF rangé, suivi déclaré à eBay. **Étiquette imposée par eBay** : rien n'est acheté ; la vente attend ton passage dans eBay | « Bordereau Mondial Relay acheté pour le N°214 · 5,40 € · imprime-le ce soir » **ou** « N°214 : achète le bordereau dans eBay (quelques clics) » | rien, ou acheter dans eBay depuis ton téléphone |
| 19 h 30 | — | Ma journée : « Imprimer la journée : 3 bordereaux (2 Vinted, 1 eBay) · poste avant jeudi midi » | « Imprimer la journée » : une liste de ramassage, puis une feuille par bordereau, tamponnée du N° |
| mer. 11 h | tu déposes au relais. Le transporteur scanne | — | déposer |
| mer. 11 h 40 | le scan arrive (webhook Boxtal, ou lecture La Poste, ou relecture eBay). La vente passe « Partie » | Colis : « Partie le 15/10 · Mondial Relay » ; plus rien dans Ma journée | rien |
| jeu. → ven. | en transit : aucune notification (rien à faire) | Colis : l'étape | rien |
| ven. 9 h | « au relais, jusqu'au 25/10 » (si le transporteur donne la date) | Colis | rien |
| 23/10 | **si tu l'as allumé** et que la date limite est connue : message à l'acheteur, dans la messagerie eBay, « votre colis vous attend au relais jusqu'au 25/10 » | journal : le texte exact parti | rien |
| 24/10 | « livré » (le transporteur) : preuve gardée (transporteur, code, date) | la vente : « Livrée le 24/10 · preuve gardée » | rien |
| 24/10 | évaluation positive à l'acheteur : **par le réglage natif d'eBay** (recommandé, voir 10.3), ou par VRM après livraison si tu l'allumes | — | rien |
| fin du mois | l'argent reçu (ce qu'eBay te doit moins ses frais, ta décision du 3 octobre) entre dans ton CA ; le coût exact du bordereau entre dans la marge de la paire | Ventes, rapport | rien |

### 1.2 Le soir : « Imprimer la journée »

C'est le geste que tu fais déjà pour Vinted (« Tout imprimer »), étendu :

1. **Une feuille de ramassage d'abord** : chaque colis du jour, trié par
   **emplacement** quand ton Garage 3D le connaît, sinon par N° :
   « B12 · N°214 · Air Max 1 · eBay · Mondial Relay · avant jeu. midi ». Un bouton
   « Me montrer les cartons » ouvre le Garage 3D avec ces cartons en surbrillance
   (la recherche par N° existe déjà).
2. **Puis un bordereau par feuille**, recto seul (`/Duplex /Simplex`, existant),
   tamponné du titre et du N° par **le même code** que Vinted
   (`annotateAndDownloadBordereau`). En thermique, l'agrégateur fournit
   directement du 10 × 15 quand le transporteur le permet ; sinon la page part
   entière, et l'écran le dit (règle existante : quand on ne sait pas, on ne
   découpe pas).
3. **Un bordereau acheté dans eBay** n'est pas lisible par VRM (eBay ne le donne
   pas par l'API). Si tu glisses son PDF dans VRM, VRM y lit le **numéro de suivi**,
   retrouve **la commande dont eBay porte exactement ce numéro**, et le tamponne du
   bon N°. Numéro introuvable dans le PDF : il part sans tampon, et c'est dit
   (initiative I2).

### 1.3 Au relais, et après

- **Rien à cocher pour eBay** : c'est le scan du transporteur qui dit « parti »,
  pas une case. (La case « Colis fait » reste pour Vinted.)
- **48 h sans scan** après l'achat du bordereau, ou la date limite d'eBay dépassée :
  « N°214 : bordereau acheté il y a 48 h, pas encore scanné — l'as-tu déposé ? »
  (la règle `posteSansDepart` de Vinted, appliquée à eBay).
- **Bloqué** (aucun évènement depuis 5 jours ouvrés, un incident, ou la date de
  livraison estimée par eBay dépassée de 3 jours ouvrés) : alerte + **un message à
  l'acheteur préparé**, que tu envoies d'un clic. Jamais seul : ce qu'on y dit
  t'engage.
- **Retour à l'expéditeur** : « la N°214 revient » ; rien n'est remis en vente seul.

### 1.4 Le reste de la semaine

- **Les paires qui dorment** (même seuil que Vinted) : VRM propose une baisse,
  jamais sous ton plancher ni sous ton prix d'achat ; si tu l'allumes, il la fait
  lui-même, une fois par semaine au plus (I7).
- **Une question d'acheteur** : la réponse est **prête** quand tu ouvres l'app ;
  tu l'envoies d'un clic (I9).
- **Des observateurs, pas de vente** : VRM propose l'offre aux observateurs (le
  pendant eBay de la remise aux favoris de Vinted ; c'est eBay qui choisit les
  destinataires) (I10).
- **Ton solde eBay** : depuis le 1ᵉʳ septembre 2026, eBay ne vire plus tout seul
  l'argent d'un particulier, il faut le **demander** (extrait officiel de l'aide
  eBay.fr). VRM te dit combien attend, et où cliquer (I12).
- **Ton niveau de vendeur eBay**, évalué le 20 de chaque mois : VRM te prévient
  avant, s'il voit un retard ou un litige qui pèse (I13).

### 1.5 Un autre revendeur

| revendeur | ce qui change |
|---|---|
| **particulier sans SIRET** | pas de prélèvement Boxtal possible (réservé aux entreprises) [repris de `bordereaux.md` §2.3] ⇒ toujours le bordereau eBay, en quelques clics ; **tout le reste** de l'agent est identique. ⚠️ eBay.fr écrit qu'on doit être **professionnel** si l'on revend des objets achetés pour être revendus (extrait officiel, [repris de `possible.md` §2.D]) : VRM le **dit** une fois à la connexion, il ne décide pas pour lui |
| **pro avec SIRET** (Julien sur son compte pro) | bordereau acheté par VRM possible (Boxtal), plafonné |
| **vendeur de vêtements, de livres** | son « colis type » (poids, dimensions) se règle à la mise en route ; aucune règle de l'agent ne suppose une chaussure (la pointure n'entre nulle part) |
| **plusieurs comptes eBay** | chaque compte son jeton, ses lignes, son compte nommé dans chaque notification ; une paire en vente sur deux comptes : la vente sur l'un retire l'autre (si allumé) |
| **le premier jour** | « Allumer ton agent eBay », une étape à la fois, comme les premiers pas de l'accueil : (1) relier eBay (et les droits nouveaux) ; (2) dire comment tu expédies (bordereau eBay, ou relier Boxtal) ; (3) ton colis type et ton imprimante ; (4) tes plafonds ; (5) la répétition démarre. Chaque étape dit ce qui est mesuré, jamais « c'est prêt » à l'avance |

---

## 2. Tout seul · réglage · ton clic

**Tout seul** = une lecture, ou un geste qui ne coûte rien et se défait.
**Réglage** = tu l'allumes toi-même, **éteint par défaut**, avec ses plafonds.
**Ton clic** = jamais sans toi, avec une confirmation qui nomme la paire, le prix
et le compte.

| geste | mode | garde |
|---|---|---|
| savoir qu'une vente eBay a eu lieu ; relire la commande | tout seul | sonnette signée, ou relecture de rattrapage ; relue avec le jeton du compte |
| retrouver le N° et le carton | tout seul | SKU `VRM-{n°}` lu par `numeroExterne` (numérotation 013) ; sans SKU : « pas reliée » |
| te notifier (vente, à poster, pas scanné, bloqué, double vente) | tout seul | une notification par commande et par type, mémo écrit **avant** |
| retirer d'eBay une paire prouvée vendue ailleurs | **réglage** (le tien, déjà allumé) | la règle stricte existante, côté serveur ; 5 par passage ; tentative notée avant |
| mettre en pause au lieu de terminer | réglage (« terminer » par défaut) | seulement si le réglage « hors stock » d'eBay est actif |
| « retire-la de Vinted / Leboncoin » | tout seul (un message) | VRM ne touche jamais Vinted |
| acheter un bordereau | **réglage** à trois positions : éteint · « prépare, je confirme » · « achète tout seul » | étiquette libre lue chez eBay ; plafonds par bordereau, jour, mois ; délai de grâce ; répétition validée ; abonnement en règle ; jamais deux pour une commande |
| déclarer le suivi à eBay | tout seul **quand VRM a acheté le bordereau** (identité) | sinon : ton clic, avec un suivi tapé (rare) |
| annuler un bordereau inutile (commande annulée par eBay, colis jamais scanné) | tout seul **si VRM l'a acheté seul** ; sinon ton clic | commande **annulée** prouvée chez eBay ; une simple *demande* d'annulation ne suffit pas |
| suivre le colis | tout seul | numéro connu par identité ; étape inconnue ⇒ « pas su » |
| message « merci » | réglage | 1 par commande ; plafond 20/jour/compte |
| message « au relais, jusqu'au … » (J-2) | réglage | **seulement si la date limite est connue** |
| message « livré » (+ phrase d'évaluation, second interrupteur) | réglage | sans exigence ni contrepartie (règle d'eBay) |
| message « problème de transport » | ton clic (préparé) | ce qu'on y dit t'engage |
| évaluation positive | **réglage natif d'eBay** recommandé ; celui de VRM « après livraison » éteint par défaut | irréversible ; mémo écrit avant |
| répondre à une question | ton clic (réponse préparée) ; réglage « répondre seul aux questions simples » éteint par défaut | même garde que Vinted : rien sous 55 de confiance, aucun prix inventé |
| offre reçue | le **seuil natif** que tu as posé (eBay accepte ou refuse, décision du 9 octobre) ; sinon ton clic | aucune acceptation par VRM |
| baisser le prix d'une paire qui dort | ton clic ; réglage « baisser tout seul » éteint par défaut | jamais sous ton plancher ni ton prix d'achat ; −10 % au plus par fois, une fois par 7 jours |
| offre aux observateurs | ton clic ; proposée quand ≥ 2 observateurs et 14 j sans vente | une seule fois par 14 jours et par annonce |
| remettre en vente une paire revenue | ton clic | jamais seul (frais possibles, vente ferme) |
| mettre tes paires prêtes en vente sur eBay | ton clic ; réglage « publier tout seul » éteint, proposé seulement quand le délai de preuve mesuré le permet (I18) | frais vus = 0 €, plafond par jour |
| retours, remboursements, litiges | dans eBay (lien) | signature numérique exigée et argent engagé |

---

## 3. Ce qu'aucun revendeur n'a vu ailleurs

Ce ne sont pas des fonctions en plus ; ce sont huit façons dont l'agent se
**comporte**, et qu'on ne trouve pas dans un outil d'expédition ordinaire :

1. **Une paire, un carton, toutes tes plateformes.** L'agent raisonne sur la
   **paire** (le N° de ton carton), pas sur l'annonce. Une vente n'importe où
   déclenche ce qu'il faut partout où VRM a le droit d'agir, et dit le reste.
2. **La notification qui dit tout** : plateforme, N°, carton, prix, date limite,
   ce qui reste en ligne ailleurs, l'état du bordereau. Pas besoin d'ouvrir l'app
   pour savoir quoi faire.
3. **Imprimer la journée, en une fois, dans l'ordre de tes étagères**, Vinted et
   eBay mélangés, tamponnés de ton N°.
4. **Le dépôt sans case à cocher** : le transporteur dit « parti », VRM l'entend.
5. **Le client prévenu au bon moment** — et seulement quand ça sert (J-2 au relais,
   un problème) — jamais le doublon de ce qu'eBay envoie déjà.
6. **Un journal qui se relit et se défait** : chaque geste fait en ton nom, son
   montant, son texte exact, et le bouton pour revenir en arrière quand c'est
   possible.
7. **La répétition avant d'agir** : l'agent prouve qu'il a raison sur tes vraies
   ventes avant d'avoir le droit de dépenser un centime.
8. **Le vrai bénéfice d'une paire** : quand VRM a acheté le bordereau, il en
   connaît le prix exact. Ta marge le compte, au centime (le reste dit « — »).

---

## 4. Les machines à états

### 4.1 La commande eBay (clé : `orderId`, compte `{s}`)

Le **rang** ne descend jamais. Une **branche de gel** peut s'ouvrir à tout moment
et arrête tout geste qui engage. Un évènement inconnu **ne change pas** l'état (il
est noté dans `transitions`).

| rang | état | on y entre quand (preuve) | ce que l'agent fait | ce qu'il attend |
|---|---|---|---|---|
| 0 | `historique` | commande déjà là à la première relecture d'un compte | rien, ni notification (sinon « 30 ventes ! » d'un coup) | — |
| 1 | `payee` | `ORDER_CONFIRMATION`, ou `getOrders` : `PAID`, pas `FULFILLED` | lit SKU → N°, `shipByDate`, `ShippingLabelPolicy`, `program.authenticityVerification`, service d'expédition ; notifie ; planifie la double vente (4.4) | — |
| 2 | `a_expedier` | identité lue | choisit le **mode de bordereau** (9.1) ; programme les rappels avant la date limite | — |
| 2A | `attente_ebay` | mode A (étiquette imposée, authentification, point relais non lu, ou aucun agrégateur) | relit `getShippingFulfillments` à chaque sonnette `ITEM_MARKED_SHIPPED` et au rattrapage | ton achat dans eBay |
| 2B | `devis_a_confirmer` | mode B « prépare, je confirme » | devis rangé (prix, transporteur, point ou ville, poids, valable jusqu'à) | ton clic |
| 3 | `achat_en_cours` | écrit **avant** l'appel d'achat, avec la référence `vrm-{orderId}` et la réservation des plafonds | achète | — |
| 3′ | `achat_incertain` | coupure après l'envoi de l'achat | **cherche chez l'agrégateur par la référence** ; trouvé ⇒ 4 ; absent ⇒ prouvé absent ⇒ 2 ; pas su ⇒ reste, et te le dit après 2 essais | — |
| 4 | `etiquette_prete` | n° de suivi + transporteur + PDF rangés | déclare l'envoi chez eBay | — |
| 4′ | `declaration_incertaine` | coupure | relit `getShippingFulfillments` : le n° de suivi présent ⇒ 5 | — |
| 5 | `declaree` | `fulfillmentId` rendu par eBay, **ou** suivi posé par eBay lui-même (mode A) | suit le colis (4.2) | — |
| 6–9 | sous-machine colis | voir 4.2 | — | — |
| 10 | `close` | 30 j après « livré » sans litige ouvert | compacte la ligne | — |

**Branches de gel** (aucun achat, aucun message automatique sauf indication) :

| branche | preuve | ce que l'agent fait |
|---|---|---|
| `annulation_demandee` | `cancelStatus.cancelRequests[]` dans un état ≠ refusé/clos (inconnu ⇒ traité « demandée », le sens sûr [repris de `spec-expedier.md` §3]) | « **Ne poste pas** — réponds dans eBay » en tête de Colis et de Ma journée ; aucun achat ; si une étiquette existe, rien n'est annulé tant que la commande n'est pas **annulée** |
| `annulee` | `cancelState = CANCELED` | annule l'étiquette achetée par VRM si elle n'a jamais été scannée (9.9) ; « la N°214 reste chez toi » ; aucune remise en vente seule |
| `authentification` | `program.authenticityVerification` présent et ≠ `INELIGIBLE` | mode A ; suit le colis jusqu'à l'authentificateur, puis lit `status` ; **aucun message transport à l'acheteur** ; jamais « livré au client » |
| `retour`, `litige`, `remboursee` | Post-Order / Fulfillment (lecture ; `EBAY_FR` pas garanti [repris de `spec-litiges.md` §9]) | une ligne dans Ma journée avec la date limite et le lien eBay |
| `probleme_livraison`, `retour_expediteur` | transporteur (4.2) | alerte, message préparé (ton clic) |

### 4.2 Le colis (sous-machine d'une commande)

Une **seule** traduction, pure, côté serveur : `etapeColis(source, evenement)`
[repris de `suivi.md` §2.4]. Le serveur est le seul propriétaire de l'étape rangée ;
l'app la lit.

```
etiquette ──scan──▶ pris_en_charge ──▶ en_transit ──▶ au_relais(dateLimite?) ──▶ livre
    │                                      │                │
    │ 48 h ou shipByDate dépassée          │ 5 j ouvrés sans évènement, incident,
    ▼                                      ▼ ou maxEstimatedDelivery + 3 j ouvrés
 pas_scanne (drapeau)                  probleme ──────────────────────────▶ retour_expediteur
```

- Un code inconnu vaut `en_transit` s'il arrive **après** un scan, sinon `pas_su`.
  Il ne monte jamais vers `livre`.
- `pas_scanne` et `probleme` sont des **drapeaux**, pas des rangs : un scan tardif
  les efface.
- Sources, dans l'ordre (10.1) : webhook de l'agrégateur où le bordereau a été
  acheté ; La Poste « Suivi v2 » (Colissimo, Chronopost) ; la ligne d'email du
  transporteur portant **exactement** le même numéro (existant, gratuit) ; la
  relecture eBay (`getShippingFulfillments`, qui ne dit jamais « livré »).

### 4.3 L'annonce eBay (clé : `itemId`, SKU)

```
brouillon ─▶ programmee ─▶ en_ligne ─┬─▶ vendue (commande)
                                      ├─▶ en_pause (quantité 0, « hors stock ») ─▶ en_ligne
                                      └─▶ terminee (retrait auto ou main) ─▶ remise_en_vente (nouvel itemId)
```

L'agent n'y fait que quatre gestes, tous déjà existants ou spécifiés : retirer
(retrait automatique), mettre en pause (si allumé), baisser le prix (si allumé),
publier/programmer (ton clic, ou I18). Chaque geste **relit l'annonce chez eBay**
et exige le SKU attendu (`GetItem`, existant).

### 4.4 La paire, entre les plateformes (calculée, jamais rangée)

C'est la machine qui manquait pour la N°553. Elle **se calcule** à chaque passage,
à partir des sources (une seule règle, recopiée côté serveur — §11) :

```
en_stock ─▶ en_vente{vinted, ebay[comptes], lbc} ─▶ vendue{où, preuve, quand} ─▶ à_retirer_ailleurs
                                                         │
                                                         └─(annulée, remboursée, retour)─▶ revenue
```

- **Preuve de vente Vinted**, par identité seulement : transaction → `item_id`
  (lignes `harvest_*_txn_*`) **et désormais** bordereau capté → `item`/`items`
  (lignes `harvest_{uid}_label_{tx}`) [repris de `etat.md` §3.3 : avec cette source,
  la 553 était prouvée vendue le 10 octobre au soir]. L'état de la vente (annulée,
  remboursée) se lit dans `orders_sold` par `transaction_id`.
- **Preuve de vente eBay** : commande engagée dont la ligne porte le SKU.
- **Preuve de vente Leboncoin** : la règle existante (`doublesVenteLbc`).
- Ce que l'agent **range** n'est pas l'état de la paire mais ses **décisions** :
  dans la ligne de la commande et dans le journal.

### 4.5 Les règles qui ne bougent pas

- **« Pas su » n'agit jamais.** Toute entrée d'une décision a trois états :
  en cours · pas su · lu (7.4).
- **L'identité, jamais la ressemblance** : SKU, `orderId`, `lineItemId`,
  `fulfillmentId`, n° de suivi, référence chez l'agrégateur. Le titre n'entre dans
  aucune décision.
- **Le serveur relit chez eBay avant toute dépense**, avec le jeton du compte de la
  commande : une ligne fabriquée dans la base ne fait rien acheter.
- **L'adresse de l'acheteur n'est jamais rangée** : lue chez eBay au moment
  d'acheter, passée à l'agrégateur, oubliée (`commandeMinimale`, [repris de
  `spec-socle.md` §3.3]).

---

## 5. Les données

### 5.1 Dans `app_data`, par vendeur (`owner`) et par compte eBay (`{s}`)

| ligne | écrite par | contenu | lue par l'app |
|---|---|---|---|
| `ebay_agent_cmd{s}_{orderId}` | **serveur seulement** (garde 5.3) | scalaires de premier niveau (copiés dans `meta` par la base, donc listables sans `data`) : `etat`, `rang`, `numero`, `compte`, `mode` (A/B), `limite`, `prochain`, `version`, `majAt` ; objets : `transitions` (20 dernières), `bordereau` {fournisseur, idEnvoi, transporteur, suivi, prixCentimes, poidsG, format, cheminPdf, achete, annule}, `ebay` {fulfillmentId}, `colis` {etape, drapeaux, dernierEvenement {code, date}, dateLimiteRetrait, preuveLivraison {transporteur, code, date}}, `messages` {type: date}, `gel` | **≤ 2 Ko** | projections `meta->>` uniquement en liste (§4.4) ; la ligne entière à l'ouverture d'une vente |
| `ebay_agent_journal` | serveur, par une fonction SQL (une instruction) | les **300** derniers gestes : `{at, compte, orderId, numero, geste, resultat, centimes, reference, texte, repetition, defaire}` | à l'ouverture de « Ce que VRM a fait en ton nom » |
| `ebay_agent_pouls` | serveur | dernier passage, dernier succès, dernière erreur (code, jamais le texte brut d'eBay), compteurs du jour, `arrete` (raison), `repetition` {depuis, decisions} | eBay → Compte eBay, et une ligne de Ma journée si arrêté |
| `ebay_agent_reglages` | serveur, par l'action `agentregler` (bornée) | interrupteurs, plafonds, délai de grâce, heure d'achat, textes des messages, colis type, transporteurs préférés, format d'impression demandé | réglages de l'agent |
| `ebay_bord{s}_{orderId}` | serveur | le PDF du bordereau acheté par VRM (`pdfB64`, la base pose `meta._pdf`) — ou, si le chantier « PDF dans le stockage » est livré, l'objet `{owner}/ebay/{sha256}.pdf` du compartiment privé `bordereaux` | **jamais en liste** ; les octets au clic d'impression, par le lecteur unique `lirePdfLigne` (trois états) |
| `ebay_orders{s}` | serveur (synchro) | commandes **minimisées, fusionnées, jamais remplacées** [repris de `spec-socle.md` §3.3] | existant |
| `ebay_listings{s}`, `ebay_programmees{s}` | existant | — | existant |
| `vrm_paires_poids` *(clé de `main`, synchronisée)* | **l'app**, sur ton clic | les poids que **tu** as validés : par N° (`{214: 1350}`) et par modèle (`{"air max 1": 1300}`, I16) | réglages et confirmations |

### 5.2 Hors `app_data` : des tables « serveur seulement »

Règles d'accès activées, **aucune** règle ⇒ personne d'autre que le serveur (le
modèle `vrm_reglages`, [repris de `infra.md` §1.1]).

| table | rôle |
|---|---|
| `vrm_agent_file (owner, cle, prochain, bail_jeton, bail_jusqua, essais)` | la file de travail **et** les verrous. Clés : `ebay:{s}:cmd:{orderId}`, `ebay:{s}:veille`, `ebay:{s}:annonce:{itemId}`, `vendeur:repricing`… |
| `vrm_agent_compteurs (owner, cle, n, centimes)` | plafonds d'argent (`bordereaux:{s}:2026-10-11`, `bordereaux:{s}:2026-10`), plafonds de messages, quota Trading global (`owner` neutre `00000000-…`) |
| `vrm_agent_horloge (id, dernier_tic)` | le pouls de l'horloge |
| `vrm_agent_vus (source, id, vu_le)` | dédoublonnage des sonnettes (`notificationId` d'eBay, identifiant d'évènement de l'agrégateur), purgé après 7 jours |
| `vrm_agent_crochets (cle_opaque, owner, fournisseur, cree)` | l'adresse de webhook **de chaque vendeur** chez l'agrégateur, par un identifiant opaque (jamais l'`owner` dans l'adresse) |
| `vrm_coffre (owner, compte, fournisseur, v, nonce, chiffre, tag, maj)` | clés d'agrégateur (et, ensuite, jetons eBay), chiffrées AES-256-GCM par le serveur, clé maîtresse `VRM_COFFRE_CLE` sur Vercel, données associées `owner|compte|fournisseur|v` [repris de `infra.md` §6.1] |
| `vrm_ebay_cles_publiques (kid, pem, lu)` | clés publiques d'eBay pour vérifier les notifications, gardées 24 h (une instance froide ne redemande pas) |

Fonctions `SECURITY DEFINER`, `search_path ''`, exécutables par `service_role`
seulement : `vrm_agent_prendre`, `vrm_agent_ecrire` (bail + version, sinon 0
ligne), `vrm_agent_rendre`, `vrm_agent_planifier`, `vrm_agent_journal`,
`vrm_agent_reserver` (plafonds, sur le modèle de `vrm_detourage_reserver`) et
`vrm_agent_rendre_reserve` [repris de `infra.md` §4.4, §4.6].

### 5.3 Le navigateur ne peut pas écrire la mémoire de l'agent

Un déclencheur `BEFORE INSERT OR UPDATE OR DELETE` sur `app_data` refuse toute
écriture d'un rôle `authenticated` ou `anon` sur `ebay_agent\_%`, `ebay_bord%` et
`ebay_tokens%` (la lecture du rôle par `coalesce(auth.role(), current_user)`,
comme le journal des écritures existant). Sans lui, un vendeur pourrait fabriquer
une commande « à acheter » ; avec lui, il ne peut que **lire** [repris de
`infra.md` §4.5].

### 5.4 Ce qu'on ne garde jamais

Adresse, nom, téléphone, email de l'acheteur ; nom du point relais (il dit où vit
l'acheteur) ; texte brut des réponses d'eBay ou de l'agrégateur ; tout cela dans
aucun `console.log` non plus (Vercel garde les journaux une heure, mais ils passent
chez un tiers). Le **pseudo** de l'acheteur reste là où il est déjà
(`commandeMinimale`, `buyer.username`) : il sert à lui écrire, et il est anonymisé
sur la notification de suppression de compte d'eBay.

---

## 6. Les routes : aucune nouvelle fonction (12 sur 12)

### 6.1 Actions de l'app — `api/ebay.js` (session exigée, abonnement vérifié)

Elles passent par le dispatch existant `ACTIONS` ; celles qui portent sur le
vendeur (et pas sur un compte) sont traitées avant `resoudreCompte`, comme
`deconnecter` aujourd'hui.

| action | corps | ce qu'elle fait | garde |
|---|---|---|---|
| `agentetat` | — | pouls, réglages, compteurs du jour, 50 dernières entrées du journal | lecture |
| `agentregler` | `{reglages, confirme:true}` | range les réglages **bornés par le serveur** (maxima écrits dans le code : 25 € par bordereau, 30 par jour et par compte, 600 € par mois, 20 messages par jour…) ; un réglage au-delà est ramené au maximum et la réponse le dit | `confirme`, session |
| `agentjournal` | `{avant?}` | une page de journal | lecture |
| `agentvalider` | `{famille, confirme:true}` | fait sortir une famille (bordereaux, messages, retraits, prix) du mode répétition | `confirme` |
| `agentdefaire` | `{entree, confirme:true}` | défait un geste quand c'est possible (annuler l'étiquette, reprendre une annonce en pause) | relit l'état réel avant |
| `expeditionposer` | `{fournisseur, cles, bacASable, confirme:true}` | teste les clés par une **lecture** inoffensive chez l'agrégateur, puis les chiffre dans `vrm_coffre` ; crée l'abonnement webhook avec un secret tiré par le serveur | les clés ne reviennent **jamais** au navigateur |
| `expeditiontester` | `{fournisseur}` | relecture inoffensive ; rend ok / refusé / pas su | lecture |
| `expeditionretirer` | `{fournisseur, confirme:true}` | supprime l'abonnement chez l'agrégateur, puis la ligne du coffre | `confirme` |
| `bordereaudevis` | `{compte, orderId}` | relit la commande chez eBay, lit l'adresse, demande le devis ; range le devis (pas l'adresse) | lecture |
| `bordereauacheter` | `{compte, orderId, devis, prixVu, confirme:true}` | **la même fonction que l'agent** (`acheterBordereau`, 9.3), déclenchée par ton clic | prix plus cher que vu ⇒ 409 ; plafonds |
| `bordereauannuler` | `{compte, orderId, confirme:true}` | annule chez l'agrégateur si jamais scanné | relit le suivi avant |
| `bordereaupdf` | `{compte, orderId}` | rend les octets du PDF de CE vendeur | `owner=eq.` |
| `suivirelire` | `{compte, orderId}` | relit fulfillment + transporteur, une fois | frein : 1 par 2 min |
| `messageacheteur` | `{compte, orderId, type, texte, confirme:true}` | `AddMemberMessageAAQToPartner`, après le contrôle 10.2 | le destinataire vient de la commande relue, jamais du corps |
| `veiller` | — (session de l'extension) | appelée par l'extension juste après avoir **écrit** une vente Vinted : planifie tout de suite la vérification de double vente de ce vendeur | frein : 1 par 5 min ; aucune requête à Vinted |

Plus les actions déjà spécifiées le 9 octobre, inchangées : `expedier` (suivi tapé,
[`spec-expedier.md` §4.3]), `offres`, `offre-reponse`, `questions`,
`question-reponse` [`spec-boite.md`], `pause`, `reprendre`, `relist`, `modifier`
[`spec-annonces-vivantes.md`], `apresvente` [`spec-litiges.md`].

### 6.2 Modes sans session — `api/ebay.js` (signature exigée)

`api/ebay.js` passe en `bodyParser: false` (corps brut, `api/_lib/corps.js`
partagé avec `api/compte.js`) [repris de `spec-socle.md` §3.4] : une seule
bascule sert la suppression de compte, les notifications et les webhooks.

| mode | réécriture (`vercel.json`) | ce qu'il fait, en **moins d'une seconde** |
|---|---|---|
| `?mode=notif` | `/api/ebay-notif` → `/api/ebay?mode=notif` | API Notification REST d'eBay : vérifie `X-EBAY-SIGNATURE` (ECC, clé publique par `kid`, gardée en base ; corps brut d'abord, JSON re-sérialisé en repli, jamais relâché), dédoublonne `notificationId`, **planifie** la relecture du compte concerné (`vrm_agent_planifier`), répond 204. Sujets : `ORDER_CONFIRMATION`, `ITEM_MARKED_SHIPPED`, `AUTHORIZATION_REVOCATION`, `MARKETPLACE_ACCOUNT_DELETION` (repris de `deletion`), puis `BUYER_QUESTION`/`NEW_MESSAGE` [noms à vérifier] |
| `?mode=expedition&k=…` | `/api/expedition/:k` → `/api/ebay?mode=expedition&k=:k` | webhook de l'agrégateur : `k` désigne le vendeur (table `vrm_agent_crochets`) ; vérifie le HMAC du corps brut avec **le secret de CE vendeur** (Boxtal `x-bxt-signature`), dédoublonne, planifie la tâche de la commande (par la **référence** `vrm-{orderId}` portée par l'envoi), répond 2xx en < 2 s (Boxtal réessaie 10 fois puis abandonne [repris de `bordereaux.md` §2.3]) |
| `deletion`, `callback` | existants | inchangés (la suppression devient un sujet de `notif`) |

**Une sonnette n'est jamais une donnée** : rien de ce qu'eBay ou l'agrégateur
envoient n'est rangé tel quel. La sonnette **réveille** une relecture faite avec le
jeton ou la clé du vendeur. Une sonnette forgée ou mal routée ne peut rien écrire de
faux : au pire, une relecture de plus, freinée.

### 6.3 Le battement — `api/ship-reminders.js`

| mode | appelé par | ce qu'il fait |
|---|---|---|
| `?mode=battement` (POST, `Authorization: Bearer VRM_BATTEMENT_SECRET`, comparé en temps constant) | `pg_cron` + `pg_net`, chaque minute, **seulement si une tâche est due** | interrupteur d'installation (`vrm_reglages.agent_ebay`) éteint ⇒ rien ; anti-rafale 20 s ; puis 25 s de travail : `vrm_agent_prendre(8, jeton, bail 120 s)`, au plus 2 tâches par vendeur et par passage, chacune dans `contexteVendeur.run({owner})` ; réponse = des **nombres** seulement (`pg_net` la garde 6 h) |
| (sans mode) cron 08:00 UTC existant | Vercel | le rappel du matin existant, **plus** un battement de secours, **plus** le contrôle de l'horloge (`dernier_tic` > 30 min ⇒ notification au propriétaire de l'installation : « l'horloge de l'agent est arrêtée ») |

Aucun cron Vercel ajouté (un cron refusé bloque tous les déploiements) [repris de
`infra.md` §3].

### 6.4 Les bibliothèques (`api/_lib/`, pas des fonctions Vercel)

| fichier | contenu |
|---|---|
| `agent-ebay.js` | la machine (4.1), `traiterTache(tache, {jeton, fin})`, `acheterBordereau`, `declarerEnvoi`, `envoyerMessage`, `passageRetrait` (retrait serveur), `verifierDouble` |
| `expedition.js` | **une interface, plusieurs adaptateurs** : `devis`, `acheter`, `chercherParReference`, `document`, `annuler`, `suivi`, `abonner`, `verifierSignature`. Boxtal v3 d'abord ; Sendcloud ensuite ; Packlink « à moitié » (crée l'envoi, tu paies chez eux) |
| `colis-etape.js` | `etapeColis` (pure, exportée pour l'audit) |
| `coffre.js` | chiffrer / déchiffrer (HKDF par ligne, AES-256-GCM, données associées) |
| `ebay-regle.js` | **recopie exacte** des règles de l'app (`doublesVenteEbay`, `numerosDejaVendus`, `retraitsEbayAutoPermis`, `preuvesVentesVinted`, `aExpedierEbay`, `commandeEbayEngagee`, `numDeSkuEbay`, `cleNum`, `numeroExterne`, `PAS_UNE_VENTE`…), refabriquée par un script `--recopie`, **jamais modifiée à la main** [méthode de `audit-bilan-semaine.cjs`] |
| `ebay.js` (existant) | + jeton d'accès gardé 1 h 50, chiffré ; + garde-quota Trading global [repris de `infra.md` §5.3] |

### 6.5 L'extension

Une seule chose nouvelle côté extension : après une écriture **réussie**
d'`orders_sold` contenant une transaction nouvelle, un `POST /api/ebay
{action:'veiller'}` avec **sa** session VRM (garde 10 min dans
`chrome.storage.local`) [repris de `spec-retrait-serveur.md` §3.3]. Ce n'est pas
une requête à Vinted : les garde-fous du §3 ne bougent pas. Entrée
`EXT_CAPACITES.veilleebay` : l'app ne promet « dans les minutes » qu'à une
extension qui le sait.

---

## 7. Déclenchement, verrous, idempotence, trois états

### 7.1 Qui réveille l'agent

| déclencheur | délai | rôle |
|---|---|---|
| sonnette eBay (`ORDER_CONFIRMATION`, `ITEM_MARKED_SHIPPED`) | < 1 min | le cas normal |
| webhook de l'agrégateur (`DOCUMENT_CREATED`, `TRACKING_CHANGED`) | < 1 min | bordereau prêt, colis qui bouge |
| l'extension (`veiller`) | dès que la vente Vinted est **écrite** | double vente dans l'autre sens |
| une étape qui en programme une autre (`prochain`) | à l'heure dite | délai de grâce, rappels, relectures du colis |
| **rattrapage** : tâche `ebay:{s}:veille` par compte | 60 min si les notifications marchent, 15 min sinon | aucune sonnette n'est garantie (3 essais, puis plus rien) |
| l'ouverture de Colis / Ma journée | à l'ouverture | planifie la relecture des colis en vol de plus de 6 h (10 au plus) |
| le cron du matin | 08:00 UTC ± 59 min | battement de secours et contrôle de l'horloge |

Le battement (`pg_cron`, chaque minute) ne fait **que** prendre ce qui est dû :
une boutique calme ne coûte presque rien.

### 7.2 Le verrou

Une seule exécution à la fois par commande : `vrm_agent_prendre` pose un bail
(`for update skip locked`), `vrm_agent_ecrire` n'écrit que si le bail porte encore
ce jeton **et** que la `version` est celle qu'on a lue (sinon 0 ligne : on relit, on
n'écrase jamais). Deux battements simultanés sont inoffensifs. En plus : **une
requête en vol par compte eBay** (politesse et quota, pas le garde-fou de Vinted).

### 7.3 L'idempotence, geste par geste

| geste | clé d'identité | avant | si la réponse se perd |
|---|---|---|---|
| notification « vendu » | `(orderId, 'vente')` dans `messages` de la commande | écrite sous le bail, **vérifiée**, puis envoi | jamais renvoyée |
| retrait d'une annonce eBay | `itemId` | tentative notée (24 h), `GetItem` + SKU attendu | `sansAck` ⇒ « incertain », journal ; jamais retenté avant relecture |
| achat d'un bordereau | référence `vrm-{orderId}` chez l'agrégateur | état `achat_en_cours` écrit + plafonds réservés ; **recherche par la référence** : déjà un envoi ⇒ on le reprend, on n'achète pas | `achat_incertain` ⇒ recherche par la référence ; **jamais un second achat sans la preuve qu'il n'y en a pas eu** ; plafond gardé (pas rendu) |
| déclaration du suivi | n° de suivi sur la commande | `getShippingFulfillments` : déjà là ⇒ fait | relecture ; le n° de suivi est l'identité |
| message à l'acheteur | `(orderId, type)` | mémo écrit et vérifié avant | « incertain — regarde ta messagerie eBay », jamais renvoyé |
| évaluation | `lineItemId` | `GetItemsAwaitingFeedback` + mémo avant | jamais relaissée |
| baisse de prix | `(itemId, semaine)` | prix relu chez eBay ; plancher | relecture du prix |
| annulation d'étiquette | `idEnvoi` | suivi relu : jamais scanné | relecture chez l'agrégateur |

### 7.4 Les trois états de chaque décision

Chaque entrée d'une décision est **lue**, **pas sue**, ou **en cours**. « Pas su »
sur une seule entrée ⇒ la décision attend (délai 1, 2, 4… min, plafonné à 60), et
l'écran ne le dit que si ça bloque une obligation (une date limite qui approche).

| décision | entrées qui doivent être **lues** |
|---|---|
| acheter un bordereau | commande relue chez eBay (`PAID`, pas `FULFILLED`, aucune annulation) · `ShippingLabelPolicy` lu **absent** (Trading ≥ 1455) · pas d'authentification · N° par SKU · adresse complète · point relais lu par identité si le service est en relais · poids validé · transporteur dans la liste lue chez eBay (`get_shipping_carriers`) · réglage allumé · répétition validée · plafonds réservés · abonnement **`true`** (pas `null`) · interrupteur d'installation |
| retirer une annonce eBay | réglage relu chez le vendeur · preuve de vente (toutes sources, dont le bordereau) · annonces Vinted de **tous** ses comptes · comptes bloqués publiés depuis < 7 j · annonces eBay de ses comptes |
| envoyer un message | réglage · étape lue après la dernière tentative · date limite connue (J-2) · aucune branche de gel · < 90 jours · plafonds |
| baisser un prix | réglage · plancher ou prix d'achat connu · prix relu chez eBay · aucune offre en attente (25019) |
| notifier « retire-la de Vinted » | annonces Vinted lues (un compte illisible ⇒ pas de « elle n'est plus en ligne ») |

**Abonnement VRM** : `false` ⇒ l'agent s'arrête pour ce vendeur (ni appel eBay, ni
notification) ; `null` (la base a hoqueté) ⇒ les **lectures** continuent, tout ce
qui coûte ou ne se défait pas attend un `true`.

### 7.5 Les budgets

- **Quota Trading : 5 000 appels par jour pour toute l'application.** Compteur
  global réservé avant chaque appel ; trois priorités (obligations 20 % réservés,
  détection, confort) ; part équitable 1 % par compte hors obligations ; le bouton
  « ↻ Rafraîchir » de l'app passe sous le même compteur [repris de `infra.md`
  §5.3]. ⇒ « Application Growth Check » à demander avant ~700 comptes.
- **Jeton d'accès gardé 1 h 50** (chiffré) : sans lui, 1 000 vendeurs dépassent le
  quota de renouvellement [repris de `infra.md` §5.2].
- **Plafonds d'argent** : par bordereau, par jour, par mois, par compte eBay,
  réservés **avant**, rendus seulement sur un refus net (jamais sur un incertain).

---

## 8. Le journal, le pouls, les notifications, les écrans

### 8.1 « Ce que VRM a fait en ton nom »

Une liste, la plus récente en haut, une ligne par geste :

> mar. 15/10 16:03 · **compte ton_compte_pro** · N°214 · Bordereau Mondial Relay acheté
> **5,40 €** · réf. vrm-12-34567-89012 · [Annuler (pas encore déposé)]
>
> mar. 15/10 16:03 · N°214 · Suivi déclaré à eBay (Mondial Relay 12345678)
>
> jeu. 23/10 09:00 · N°214 · Message envoyé à l'acheteur : « Bonjour, votre colis
> Mondial Relay vous attend au point relais… » [texte complet]
>
> *(répétition)* lun. 13/10 18:20 · N°198 · **J'aurais acheté** un bordereau
> Colissimo point retrait 6,10 € — pas fait, l'agent répète

- Gardé : les 300 derniers gestes. Les montants en centimes, jamais arrondis
  d'un seul côté.
- Le bouton **Défaire** n'apparaît que quand le geste se défait **vraiment** :
  annuler une étiquette jamais scannée ; reprendre une annonce mise en pause. Une
  annonce **terminée** ne se défait pas (elle se remet en vente, avec des frais
  possibles) : le bouton dit « Remettre en vente… », avec la vérification à blanc.
- Une ligne dans Ma journée, une fois par jour : « Hier, VRM a fait 4 choses en ton
  nom — les relire ». Rien quand il n'a rien fait.

### 8.2 Le pouls

Sur eBay → Compte eBay, une ligne : « Ton agent eBay · **allumé** · dernier passage
il y a 1 min · rien n'attend ton clic » ; ou « **en répétition** depuis 3 jours ·
12 décisions à relire » ; ou « **arrêté** : eBay a refusé la connexion de
ton_compte_pro — Reconnecter » ; ou « arrêté : l'horloge ne bat plus depuis 2 h »
(propriétaire de l'installation seulement). « Pas su » (pouls illisible) : gris,
sans diagnostic.

### 8.3 Les notifications sur ton téléphone

Toujours dans `contexteVendeur.run({owner})` (ses appareils seulement ; abonnement
coupé ⇒ rien).

| catégorie | défaut | quoi |
|---|---|---|
| `vente` (existe) | allumée | « Vendu sur eBay · N°214 (carton B12) · Air Max 1 · 120 € · à poster avant jeu. 16/10 · bordereau prêt » |
| `double` (nouvelle, [`spec-veille.md` §3.5]) | allumée | « N°214 vendue sur eBay — ⚠️ encore en ligne sur Vinted (tomj683) : retire-la » ; « N°187 vendue sur Vinted — retirée d'eBay automatiquement » |
| `expedier` (existe) | allumée | « N°214 : à poster avant demain midi » ; « N°214 : bordereau acheté il y a 48 h, pas encore scanné » |
| `agent` (nouvelle) | allumée | ce qu'il a fait de notable, ou ce qu'il attend de toi : « 2 bordereaux à confirmer (11,30 €) » ; « plafond du jour atteint : 1 bordereau attend ton clic » ; « eBay a refusé la connexion de ton_compte_pro » |
| `livraison` (nouvelle) | allumée | problème, retour à l'expéditeur, litige ouvert |
| `suivi` (existe) | éteinte | en transit, livré (rien à faire, comme pour Vinted) |

`PUSH_CATS` (app) et `PUSH_DEFAUT` (serveur) restent identiques (l'audit du bilan
les compare). Plusieurs ventes à la même minute ⇒ une seule notification.

### 8.4 Les écrans (aucun nouvel onglet)

| écran | ce qui change |
|---|---|
| **Ma journée** | seulement ce qui demande un geste : « Imprimer la journée : 3 bordereaux » · « 1 colis eBay pas encore scanné » · « Ne poste pas : annulation demandée (N°198) » · « 2 bordereaux à confirmer » · « 1 question eBay, réponse prête » · « Hier, VRM a fait 4 choses en ton nom » |
| **Colis** | les ventes eBay **dans les groupes existants** (§ « l'écran Colis se range sur ce qu'il peut faire ») : « Prêts à imprimer » (bordereau acheté par VRM) · « Bordereau dans eBay » (mode A, un lien par colis, la phrase commune dite une fois) · « À confirmer » (mode B prépare) · « Ne poste pas » (en tête) · « Partis — suivi transporteur » (une ligne d'étape par colis). Le compte eBay nommé une fois si tous sont sur le même |
| **eBay → Ventes** | la frise d'étapes par vente, « Preuve de livraison », le coût du bordereau |
| **eBay → Compte eBay** | le bloc **« Ton agent eBay »** : pouls, les interrupteurs groupés en quatre familles (**Vendre** · **Expédier** · **Parler au client** · **Protéger**), les plafonds, la répétition, le journal, et « Expédition » (agrégateur relié ✓ / refusé / pas su, colis type, imprimante) |
| **la carte d'une paire (Annonces)** | « en vente aussi sur eBay (ton_compte_pro) » quand le SKU le prouve |

Une seule couleur d'accent, rare (§7 du dossier) : l'ambre seulement pour ce qui
demande un geste ; le rouge reste réservé aux deux paires sous un même numéro.

---

## 9. Les bordereaux

### 9.1 L'arbre de décision, par commande

```
commande relue chez eBay (jeton du compte)
├─ gel (annulation demandée / annulée / litige) ............... rien n'est acheté — « Ne poste pas »
├─ authentification d'eBay ...................................... mode A (vers l'authentificateur)
├─ ShippingLabelPolicy = EBAY_ONLY .............................. mode A
├─ ShippingLabelPolicy PAS SU (Trading < 1455, lecture ratée) .. mode A — jamais d'achat ailleurs
├─ étiquette libre
│   ├─ aucun agrégateur relié (ou clé refusée / pas sue) ......... mode A + « relie Boxtal pour que VRM l'achète »
│   ├─ service payé en point relais, point NON lu par identité ... mode A (le point est déjà dans eBay)
│   ├─ poids non validé ......................................... « à confirmer » : on demande le poids
│   ├─ transporteur absent de la liste lue chez eBay ............ mode A (on ne déclare pas en « Other »)
│   ├─ réglage = prépare, je confirme ........................... devis → carte « Acheter 5,40 € »
│   └─ réglage = achète tout seul
│        ├─ répétition non validée ............................. « j'aurais acheté… » au journal
│        ├─ plafond refusé ...................................... « à confirmer » + notification agent
│        └─ sinon ........................................... achat (9.3)
```

**Mode A** (« eBay fournit l'étiquette ») : VRM range la vente dans Colis avec
son N° et sa date limite, te donne **un lien** vers la page de la commande dans
eBay (adresse à relever au premier essai ; repli : la liste des commandes
[repris de `spec-expedier.md` §4.1]), puis **relit le suivi qu'eBay rattache
lui-même** (`getShippingFulfillments` → `shipmentTrackingNumber`,
`shippingCarrierCode`) et suit le colis. Avec Mondial Relay acheté dans eBay, un QR
code suffirait au dépôt, sans imprimante (secondaire, [repris de `bordereaux.md`
§1]) [à vérifier] : le mode A peut alors se faire entièrement depuis ton téléphone.

**Mode B** (« VRM achète ») : la suite de cette section.

### 9.2 Le prestataire

| | rôle | pourquoi |
|---|---|---|
| **Boxtal (API v3)** | premier adaptateur | achat 100 % par l'API **si** le compte est en prélèvement différé (réservé aux entreprises) ; point relais par l'API ; webhooks signés ; annulation remboursée avant dépôt ; bac à sable qui génère de vraies étiquettes et un faux suivi [repris de `bordereaux.md` §2.3]. Les devis passent par l'API v1 (clés v1 peut-être nécessaires) [à vérifier] |
| **Sendcloud (API v3)** | second | modèle « décentralisé » documenté ; idempotence par `external_reference_id` (extrait officiel, [repris de `infra.md` §4.1]) ; abonnement payant, frais par étiquette [repris de `bordereaux.md` §2.4] |
| **Packlink PRO** | repli « à moitié » | VRM prépare l'envoi (bon point, bonne adresse, référence = commande), tu cliques « tout payer » chez Packlink ; annulation par ticket seulement [repris de `bordereaux.md` §2.5] |
| transporteurs en direct | écartés | un contrat et des secrets par transporteur ; web service Colissimo réservé au contrat Privilège [repris de `bordereaux.md` §2.6] |

**VRM ne paie jamais un bordereau** : chaque vendeur a **son** compte et **sa**
clé chez l'agrégateur, qui le facture directement. VRM n'avance pas d'argent, ne
refacture rien, n'est pas revendeur de transport.

### 9.3 L'achat, pas à pas (tâche `ebay:{s}:cmd:{orderId}`, sous le bail)

1. **Relire** la commande chez eBay (`getOrder`, jeton du compte) : `PAID`, pas
   `FULFILLED`, **aucun envoi déjà déclaré** (`getShippingFulfillments` vide),
   aucune annulation. Toute différence avec la ligne rangée ⇒ on suit eBay.
2. **Relire** `ShippingLabelPolicy` (Trading `GetOrders`, niveau ≥ 1455, par
   `orderId` — que l'identifiant REST soit accepté tel quel par Trading est
   [à vérifier] ; sinon par la ligne `legacyItemId` + transaction) : présent ou
   illisible ⇒ mode A, fin.
3. **Chercher chez l'agrégateur un envoi portant la référence `vrm-{orderId}`**
   (lecture) : trouvé ⇒ on le reprend (étape 7). Lecture ratée ⇒ on n'achète pas.
4. **Devis** : adresse (lue maintenant, jamais rangée), point relais (9.5), poids et
   dimensions (9.6), transporteur préféré du vendeur pour ce mode (relais,
   domicile). Le devis fait foi, jamais un prix calculé par VRM.
5. **Réserver les plafonds** (`vrm_agent_reserver`, une instruction) : refusé ⇒
   « à confirmer » + notification `agent`.
6. **Écrire** `achat_en_cours` (avec le devis, la référence, la réservation), puis
   **acheter** (`POST /v3.1/shipping-order` chez Boxtal, `externalId = vrm-{orderId}`).
   Refus net ⇒ plafonds rendus, raison au journal, « à confirmer ». Coupure ⇒
   `achat_incertain`.
7. **Document** : le PDF arrive en quelques secondes (`DOCUMENT_CREATED`, ou lecture
   `shippingDocuments` ; un 422 juste après la commande veut dire « pas encore prêt »,
   pas « échec » [repris de `bordereaux.md` §2.3]). Il n'est téléchargé que **chez
   l'hôte de l'agrégateur** (liste blanche par motif), vérifié `%PDF`, rangé
   (`ebay_bord{s}_{orderId}`).
8. **Déclarer le suivi à eBay** : `POST /sell/fulfillment/v1/order/{orderId}/shipping_fulfillment`
   `{lineItems, shippedDate, shippingCarrierCode, trackingNumber}` avec le code
   transporteur **lu** chez eBay (`get_shipping_carriers`), le suivi sans espace ni
   tiret. 201 ⇒ `declaree`.
9. **Journal** (prix, transporteur, poids utilisé, référence), notification `agent`
   (« Bordereau acheté pour le N°214 · 5,40 € · imprime-le ce soir »).

⚠️ **Plusieurs paires dans une commande** : un seul bordereau, tous les N° sur la
liste de ramassage et sur le tampon (« N°214 + N°220 »). Une commande à plusieurs
objets ne permet pas de choisir un point relais chez eBay (extrait officiel,
[repris de `bordereaux.md` §3.1]) : c'est le cas « domicile ».

### 9.4 Quand acheter

- **Délai de grâce** après le paiement : **2 h par défaut**, réglable de 0 à 24 h.
  Il évite d'acheter une étiquette pour une commande que l'acheteur annule tout de
  suite. (Sur eBay, un acheteur peut demander l'annulation peu après l'achat ; la
  durée exacte sur eBay.fr est [à vérifier].)
- **Mais jamais trop tard** : si la date limite d'envoi tombe avant la fin du délai
  de grâce plus 24 h, on achète tout de suite.
- **Une heure d'achat**, au choix : « dès la fin du délai de grâce » (défaut) ou
  « à 17 h, en une fois » (les bordereaux du jour sont prêts pour l'impression du
  soir, et les annulations de l'après-midi n'ont rien coûté).

### 9.5 Le point relais

- L'API d'eBay **n'a aucun champ documenté** portant l'identifiant du point relais
  choisi par l'acheteur en France [repris de `bordereaux.md` §3.1].
- **Règle** : VRM n'achète un bordereau en point relais **que s'il lit le point
  par identité** sur la commande. S'il ne lit qu'une adresse de commerce ⇒ mode A
  (le point est dans eBay). Faire correspondre une adresse à un code de point
  serait un rapprochement : **un colis envoyé au mauvais relais est un colis perdu**.
- Service payé **à domicile** ⇒ bordereau à domicile, jamais « un relais plus
  proche » (un service moins bon que celui payé = un litige « non reçu » possible).
- La forme réelle de `shipTo` sur une vente en relais est **la première mesure** à
  faire (16).

### 9.6 Le poids

VRM ne connaît aucun poids [repris de `bordereaux.md` §4 : 0 champ de poids ni de
taille dans tes ventes et annonces captées]. Trois niveaux, jamais deviné en
silence :

1. **Ton colis type** (réglage de l'agent) : proposé à 1,5 kg et 36 × 24 × 14 cm
   pour une paire dans sa boîte — un ordre de grandeur, à confirmer sur ta balance ;
   un vendeur de vêtements met le sien.
2. **Une correction par paire** (`vrm_paires_poids`) : « celle-ci pèse 2,2 kg ».
3. **Un poids par modèle, validé par toi** (I16) : quand tu corriges le poids d'une
   Air Max 1, VRM te propose « utiliser 1,3 kg pour toutes les Air Max 1 ? ». Le
   modèle vient de `extractModel` (existant) — **pour un poids proposé, jamais pour
   une identité**.

Le poids et les dimensions utilisés sont **montrés** dans chaque confirmation et
**gardés** dans le journal : un poids sous-déclaré est refacturé par l'agrégateur
[montants à vérifier], et certains transporteurs facturent le poids volumétrique
(36 × 24 × 14 / 5 000 ≈ 2,4 kg) [à vérifier qui l'applique]. Le devis fait foi.

### 9.7 Le paiement et les plafonds

- **Chez l'agrégateur, au nom du vendeur** (Boxtal : prélèvement différé SEPA).
- **Plafonds par compte eBay**, réglables, **bornés par le serveur** :

  | plafond | défaut proposé | maximum du serveur |
  |---|---|---|
  | par bordereau | fixé **après la répétition** : le plus cher des devis observés + 20 %, arrondi à l'euro (sans répétition : 10 €) | 25 € |
  | par jour | 5 bordereaux et 40 € | 30 et 300 € |
  | par mois | 200 € | 600 € |

  Ces valeurs sont des **propositions à valider avec toi**, pas des mesures.
- Un devis au-dessus ⇒ rien n'est acheté, la vente passe « à confirmer », et la
  confirmation montre le prix.

### 9.8 L'impression

- **Le même chemin que Vinted** : le PDF est tamponné **au moment d'imprimer**, dans
  l'app, par `annotateAndDownloadBordereau` (titre + N°) ; une feuille par
  bordereau ; ouvert dans l'onglet réservé au clic (pas un téléchargement).
- **A4** (ton réglage actuel, « normale ») : la page entière.
- **Thermique** : l'agent **demande** le format 10 × 15 à l'agrégateur quand le
  transporteur l'offre (repli A4 sinon) [liste par transporteur à vérifier] ;
  `zoneEtiquette` ne connaît que les mises en page de Vinted : une mise en page
  inconnue part **entière** (règle existante), et l'écran le dit.
- **« Imprimer la journée »** (1.2) : liste de ramassage + Vinted + eBay, triés par
  emplacement, en un seul document. Un bordereau dont les octets ne sont pas
  revenus ⇒ « 7 sur 9 imprimés — 2 que la base n'a pas rendus » (règle existante).
- **Un PDF acheté dans eBay, glissé dans VRM** (I2) : VRM lit son texte
  (`relevePage`, existant), y cherche un n° de suivi, et ne tamponne que si ce
  numéro est **exactement** celui d'un envoi d'une de tes commandes eBay (relu chez
  eBay). Sinon : imprimé sans tampon, et c'est dit.

### 9.9 Annuler une étiquette inutile

| cas | ce que fait l'agent |
|---|---|
| commande **annulée** (prouvée chez eBay), étiquette achetée **par l'agent tout seul**, jamais scannée | l'annule chez l'agrégateur (remboursée avant dépôt chez Boxtal ; Sendcloud gratuit avant 23 h 59 le jour même, sinon crédit sous 42 j) ; journal « remboursement attendu X € » |
| même cas, étiquette achetée **sur ton clic** | te propose « Annuler le bordereau (remboursé) » |
| annulation seulement **demandée** | n'annule rien : « Ne poste pas — réponds dans eBay » |
| Packlink | ne peut pas l'annuler par l'API : le **dit**, avec le chemin (ticket au support) |
| 7 jours sans scan, commande toujours active | ne l'annule pas seul : « N°214 jamais déposée — poste-la, ou annule le bordereau » |

### 9.10 Le suivi poussé à eBay, par identité

- **Mode B** : le numéro vient du bordereau **que VRM a acheté pour CETTE
  commande** (référence `vrm-{orderId}`) : c'est une identité, la conclusion du
  9 octobre (« impossible faute d'identité commune ») ne s'applique plus [repris de
  `bordereaux.md` §0.3].
- **Mode A** : eBay rattache le suivi lui-même ; VRM ne déclare rien, il **lit**.
- **Bordereau acheté ailleurs, à la main** : seulement sur ton clic, numéro tapé
  (action `expedier`, existante dans la spec).
- Un transporteur absent de la liste lue chez eBay ⇒ on ne déclare pas (jamais
  `Other` en silence) et on le dit.

---

## 10. Le suivi jusqu'au client, les messages, l'évaluation

### 10.1 Qui dit où est le colis

| source | quels colis | comment |
|---|---|---|
| webhook de l'agrégateur | les bordereaux achetés chez lui | `TRACKING_CHANGED` (Boxtal) ou `parcel_status_changed` (Sendcloud) : une sonnette, puis lecture de l'envoi avec la clé du vendeur |
| La Poste « Suivi v2 » | Colissimo, Chronopost, Lettre suivie | une clé gratuite de l'installation (`LAPOSTE_OKAPI_KEY`) ; sondage adapté à l'étape ; quotas [à vérifier] |
| email du transporteur | ceux pour lesquels le transporteur t'écrit en expéditeur | la ligne `email_track_*` dont le n° est **exactement** celui de la commande (mesuré : 27 bordereaux Vinted reliés ainsi, tous Chronopost [repris de `suivi.md` §1]) |
| eBay | tous | `getShippingFulfillments` donne le numéro, **jamais « livré »** (`ActualDeliveryTime` « no longer applicable », extrait officiel) |
| ⚠️ Mondial Relay acheté **dans eBay** | — | pas d'API publique sans contrat pro ; seulement par l'agrégateur où il a été acheté, ou un service de suivi payant (un sous-traitant de données de plus) [repris de `suivi.md` §2] ⇒ en mode A + Mondial Relay, l'étape peut rester « pas su » après « déclaré » : c'est dit une fois, jamais « tout va bien » |

### 10.2 Les messages à l'acheteur

**Canal** : Trading `AddMemberMessageAAQToPartner` (jusqu'à 90 jours après la
commande, jeton existant). La Message API REST viendra quand `EBAY_FR` sera
confirmé [repris de `suivi.md` §4.1].

**Les règles d'eBay** : aucun lien, aucune adresse email, aucun téléphone ;
jamais exiger une évaluation, rien offrir en échange ; et eBay **prévient déjà**
l'acheteur de l'envoi avec le suivi (extraits officiels). ⇒ VRM n'envoie que ce
qui **ajoute** quelque chose.

| message | moment | mode |
|---|---|---|
| « Merci pour votre achat » | à `payee` | réglage, éteint |
| « Colis expédié + suivi » | — | **jamais** (eBay l'envoie déjà) |
| « Votre colis vous attend au relais jusqu'au {date} » | J-2 avant la date limite, s'il n'est pas retiré | réglage, éteint ; **seulement si la date est connue** |
| « {transporteur} indique une livraison le {date} » (+ phrase d'évaluation, second interrupteur) | à `livre` | réglage, éteint |
| « Le suivi signale {incident} depuis le {date} » | à `probleme` | préparé, **ton clic** |
| tout message | paire à l'authentification | **aucun** |

Vouvoiement ; jamais le N° de rangement (ton carton n'est pas l'affaire du
client) ; tes textes, modifiables, avec des variables ; une variable inconnue
(le délai, la date) retire **la phrase**, jamais un chiffre inventé.

**Contrôle avant chaque envoi**, sur le texte **rendu** : refusé s'il contient une
adresse web, un email, une suite de 9 chiffres ou plus qui n'est pas le suivi de
la commande, ou une accolade restante. On juge ce qui part, pas le gabarit.

**Plafonds** : 3 messages par commande, 20 par jour et par compte eBay ; jeton du
compte de la commande, jamais d'un autre.

### 10.3 L'évaluation

- **Recommandation : allume « Automatiser les évaluations » dans eBay**
  (préférences de vente ; déclencheur « après paiement » ou « après paiement et
  évaluation positive de l'acheteur ») (extraits officiels). eBay le fait, VRM n'a
  ni appel à payer, ni risque.
- VRM ne propose **sa** version que pour le déclencheur « après livraison
  confirmée par le transporteur », qu'eBay n'a pas : réglage éteint, texte à toi,
  `GetItemsAwaitingFeedback` d'abord (pas de doublon avec le réglage natif),
  mémo écrit avant, **positive seulement**, irréversible (dit à l'allumage).
- Une évaluation **négative** reçue : une ligne dans Ma journée, avec le lien ;
  **jamais** de réponse automatique (règle d'eBay).

---

## 11. Les initiatives — au-delà de la demande, chacune avec sa garde

| # | initiative | ce que ça te rapporte | garde |
|---|---|---|---|
| **I1** | **« La N°553 ne peut plus arriver »** : la preuve de vente Vinted lit aussi le **bordereau capté** (`label.item`) ; le retrait part **côté serveur** ; la publication eBay est refusée sur une paire prouvée vendue ; et 10 min **après** chaque publication, l'agent revérifie | aucune double vente par manque de source | identité seulement ; la règle `ebay-apres-vente` (qui a écarté la 553) est **remplacée** par la preuve « la paire est revenue » (une autre annonce Vinted de ce N° en vente) — décision à te faire valider, l'audit la protège aujourd'hui |
| **I2** | **Le PDF eBay glissé → tamponné** | le N° sur tes étiquettes eBay aussi | tamponné seulement si le n° de suivi lu dans le PDF est **exactement** celui d'un envoi d'une de tes commandes (relu chez eBay) |
| **I3** | **Liste de ramassage + Garage 3D** | tu fais le tour des étagères une fois | N° par SKU ; emplacement seulement s'il est dans ton Garage ; sinon tri par N° |
| **I4** | **Ne jamais être en retard** : rappel la veille de la date limite d'envoi, puis 4 h avant, seulement si rien n'est scanné | ton taux de retard (évalué par eBay) | `shipByDate` donné par eBay, jamais estimé |
| **I5** | **Colis pas scanné / bloqué** avant que l'acheteur n'ouvre « objet non reçu » | moins de litiges, preuve prête | seuils écrits (48 h ; 5 j ouvrés ; date estimée + 3 j) ; message préparé, ton clic |
| **I6** | **Rappel J-2 au relais** | moins de colis non réclamés (qui reviennent et finissent remboursés) | date limite **connue** seulement |
| **I7** | **Les paires qui dorment** : proposition chaque semaine, ou baisse automatique si tu l'allumes | des ventes | jamais sous ton prix plancher VRM (la fiche de la paire) ni sous ton prix d'achat — l'un des deux **exigé** pour la baisse automatique ; −10 % au plus, une fois par 7 j, −25 % au total ; aucune offre en attente ; la **règle d'offre** existante est relue (une baisse sous son seuil d'acceptation le rendrait incohérent : on le dit) |
| **I8** | **Pause plutôt que fin** quand la paire est vendue ailleurs, si le réglage « hors stock » d'eBay est actif ; et « la paire te revient » ⇒ « remettre en vente ? » | la vente Vinted annulée ne te coûte plus ton annonce eBay | ton clic pour remettre en vente ; la pause est le choix du réglage **spécifié** (`vrm_ebay_retrait_mode`, « terminer » par défaut) [`spec-annonces-vivantes.md` §2.3] |
| **I9** | **Questions : réponse prête** quand tu ouvres l'app (IA) ; « répondre seul aux questions simples » si tu l'allumes, avec les gardes de Vinted | des ventes conclues plus vite | identité par l'annonce ; rien sous 55 de confiance ; aucun prix ni caractéristique inventés ; IA serveur absente aujourd'hui (`ia:false` [repris de CLAUDE.md]) ⇒ grisé et dit |
| **I10** | **Offre aux observateurs proposée** (≥ 2 observateurs, 14 j sans vente) | des ventes | eBay choisit les destinataires ; une fois par 14 j ; ton clic ; durée d'offre sur `EBAY_FR` [à vérifier] |
| **I11** | **Le coût réel du port dans ta marge** | le vrai bénéfice par paire | seulement pour les bordereaux achetés par VRM ; les autres « — » |
| **I12** | **Ton solde eBay attend** : « 182 € disponibles sur eBay — demande ton virement » | ton argent ne dort pas | lecture signée (RFC 9421, chantier `argent`) ; **aucune API connue pour demander le virement** [à vérifier] ⇒ un lien, jamais un geste |
| **I13** | **Ton niveau vendeur, avant le 20** | éviter « Performance insuffisante » | portée `sell.analytics.readonly` (reconnexion) ; une lecture par jour au plus |
| **I14** | **La répétition** : chaque famille de gestes (bordereaux, messages, retraits, prix) répète avant d'agir ; l'écran dit combien de décisions ont été répétées et lesquelles auraient été différentes de ce que tu as fait | la confiance, mesurée | aucune famille ne passe en réel sans ton clic (`agentvalider`) ; on te conseille ≥ 3 vraies commandes par famille |
| **I15** | **L'agent veille sur lui-même** : horloge, quota, jetons, clés d'agrégateur, notifications qui n'arrivent plus | une panne ne passe pas inaperçue | une alerte par cause et par 24 h ; jamais « tout va bien » sur une mesure absente |
| **I16** | **Le poids appris par modèle** | moins de saisie | proposé après ta correction ; utilisé seulement si tu l'as validé |
| **I17** | **Les emails d'eBay comme sonnette de secours** : si ton script Gmail fait suivre les emails d'eBay (« vous avez vendu »), `email-inbound` les traite comme une **sonnette** (relecture du compte), jamais comme une donnée | une vente vue même quand la notification d'eBay se perd | aucun email d'eBay n'arrive aujourd'hui [mesuré par `etat.md`] ; sonnette seulement ; l'adresse de réception décide du vendeur (règle existante) |
| **I18** | **Mesurer la fenêtre de double vente** : pour chaque vente Vinted, l'écart entre l'heure de vente et l'heure où VRM en a eu la **preuve** ; « publier tout seul les paires prêtes » n'est proposé que si cette fenêtre est courte (médiane < 1 h, par exemple) | savoir si mettre 40 paires sur eBay est sûr | le chiffre, jamais la promesse ; publication automatique éteinte, frais vus = 0 €, plafond par jour, catégories et états de **ta** table [`spec-publier-lot.md`] |

### Ce que je n'ajoute pas, exprès

- **Acheter le bordereau dans eBay à ta place** en pilotant la page : interdit
  (clic simulé, §3 du dossier) et impossible par l'API.
- **Annuler une commande eBay** quand la paire est vendue ailleurs : ça crée un
  défaut sur ton compte et demande une signature ; c'est ton clic, dans eBay.
- **Rembourser, accepter un retour, contester un litige** : argent et signature,
  ton clic, dans eBay (`spec-litiges.md` §6, sur ta demande).
- **Annonces sponsorisées** : coûtent de l'argent ; seulement sur ta demande
  (`spec-visibilite.md`, partie B), jamais au clic.
- **Un message « expédié »** : doublon de celui d'eBay.
- **Un « mode vacances »** qui couperait toutes tes annonces : la voie API n'est pas
  établie [à vérifier] ; la pause (I8) en est la brique, annonce par annonce.

---

## 12. Plusieurs vendeurs, et la sécurité (le résumé ; le détail est dans `infra.md` §6)

- Chaque tâche porte son `owner`, pris **en base** (jamais d'un navigateur ni d'une
  notification) ; tout tourne dans `contexteVendeur.run({owner})` ; toute lecture et
  écriture porte `owner=eq.`.
- Chaque compte eBay se valide contre le registre **de ce vendeur**
  (`resoudreCompte`) avant de prendre un jeton ; chaque clé d'agrégateur se
  déchiffre avec des données associées qui portent l'`owner` (recopiée chez un
  autre, elle ne se déchiffre pas).
- Les webhooks d'agrégateur arrivent sur une adresse **propre à chaque vendeur**
  (identifiant opaque), signés avec **son** secret.
- Le jeton eBay est aujourd'hui **en clair, lisible par le navigateur du vendeur**,
  et recopié dans deux sauvegardes [repris de `infra.md` §1.1] : il rejoint le
  coffre au même chantier que les clés d'agrégateur.
- Fermer son compte VRM efface aussi la file, les compteurs, le coffre, les
  crochets, et supprime ses abonnements chez eBay et chez l'agrégateur (avec ses
  clés) avant d'effacer ses jetons.
- **Données personnelles** : l'adresse de l'acheteur part chez l'agrégateur **sur
  l'ordre du vendeur** ⇒ la politique de confidentialité doit le dire avant le
  chantier C7.

---

## 13. Les chantiers, dans l'ordre

Effort : **S** ≈ une session · **M** ≈ deux ou trois · **L** ≈ quatre à six.
Chaque chantier est **utile seul** et livré prouvé.

| # | chantier | contenu | effort | dépend de | réutilise |
|---|---|---|---|---|---|
| **C0** | **Fusion** | branche `wf_30feaf2f-334-8` (plusieurs comptes, règle d'offre) + `main` (numérotation 013, suppressions, 12,99 €) ; conflits dans `api/ebay.js` (`handleRetirer` × numérotation) et `src/App.jsx` | M | — | `etat.md` §5.5 |
| **C1** | **La 553** | preuve de vente par bordereau (`label.item`) dans `preuvesVentesVinted` ; garde de publication qui l'utilise ; règle `ebay-apres-vente` remplacée (décision de Julien) ; contrôle « 553 » | S | C0 | `etat.md` §3.3, §5.4 |
| **C2** | **Socle** | trois états de connexion, commandes paginées/fusionnées/minimisées, suppression signée, état exigé, portées rangées, `bodyParser:false` + **Trading ≥ 1455** (lire `ShippingLabelPolicy`) | M | C0 | `spec-socle.md` |
| **C3** | **Le cœur** | migration (tables 5.2, fonctions, garde 5.3), éprouvée sur un Postgres jetable ; `pg_cron` + `pg_net` ; mode `battement` ; jeton gardé ; garde-quota ; pouls, journal | L | C2 + gestes 2–4 de Julien | `infra.md` §3–§5 |
| **C4** | **Veille + double vente serveur** | API Notification REST (`notif`), rattrapage, « Vendu sur eBay » avec N° et carton, double vente poussée (`double`), retrait serveur, action `veiller` de l'extension (bump, zip, `EXT_CAPACITES`) | L | C1, C3 + reconnexion | `spec-veille.md` (canal REST au lieu de Trading), `spec-retrait-serveur.md` |
| **C5** | **À expédier** | `aExpedierEbay` dans Colis, Ma journée, cloche, widget, rappel ; mode A (lien eBay, relecture du suivi) ; « Ne poste pas » ; la machine de commande jusqu'à `declaree` en mode A | M | C3, C4 | `spec-expedier.md` |
| **C6** | **Suivi du colis** | `etapeColis`, La Poste Suivi v2, témoin email, `pas_scanne`, `probleme`, preuve de livraison, I4, I5 | M | C5 + clé La Poste | `suivi.md` |
| **C7** | **Bordereau acheté par VRM** | coffre ; adaptateur Boxtal (bac à sable) ; poids ; plafonds ; « prépare, je confirme » puis « tout seul » ; répétition ; impression et « Imprimer la journée » ; annulation ; déclaration ; I2, I3, I11 ; politique de confidentialité | L | C5, C6 + compte Boxtal | `bordereaux.md` |
| **C8** | **Messages et évaluation** | quatre messages, contrôle du texte rendu, plafonds, journal ; I6 ; évaluation « après livraison » | M | C6 | `suivi.md` §4, `spec-litiges.md` §2.4 |
| **C9** | **Argent** | `montantRecuEbay` (ce que tu reçois), signature RFC 9421, solde, I12, coût du port dans la marge | L | C2 | `spec-argent.md` |
| **C10** | **Offres et questions** | `spec-boite.md` (la règle d'offre posée par son chantier, lue ici) ; I9 | L | C4 | `spec-boite.md` |
| **C11** | **Annonces vivantes** | pause, remise en vente, modifier ; I7, I8, I10 | M | C4 | `spec-annonces-vivantes.md` |
| **C12** | **Mise en vente en lot** | « prêtes pour eBay », brouillons en lot, photos copiées chez eBay ; I18 | L | C4, C11 | `spec-publier-lot.md` |
| **C13** | **Litiges, visibilité, niveau vendeur** | jeu de portées `v2`, une reconnexion ; I13 | L | C5, C9 | `spec-litiges.md`, `spec-visibilite.md` |

**Pourquoi cet ordre** : on ferme d'abord le trou qui coûte aujourd'hui (C1, la
553) ; puis la mémoire et l'horloge (C3), sans lesquelles rien ne tourne VRM
fermé ; puis tout ce qui **lit** (C4–C6, aucun risque d'argent) ; l'achat de
bordereau (C7) seulement quand la veille, l'expédition et le suivi sont prouvés ;
la mise en vente en lot (C12) seulement quand la fenêtre de double vente est
mesurée (I18). **La reconnexion eBay** se fait **une fois**, avant C4, avec tout le
jeu de droits utile (notifications, et si possible messages, statistiques, litiges).

### 13.1 Les preuves, pour chaque chantier

Méthode du dossier (§6.1) : l'arbre d'avant par `git archive HEAD | tar -x -C
/tmp/avN`, le script **copié dedans** et lancé **depuis** cet arbre ; `DIST` déduit
de `__dirname` ; rouge sur l'avant, vert après ; puis **une mutation** sur le code
d'après qui repasse au rouge (« la fonction n'existait pas avant » ne prouve rien).
Tout passe par `essaie()` : un audit ne meurt pas, il rapporte.

| chantier | audit (exécute le vrai code dans un `vm`) | banc de rendu (données inventées, 390 et 1 512 px) | mutations qui doivent rougir |
|---|---|---|---|
| C1 | `audit-ebay-preuve-bordereau.cjs` : vente prouvée **par bordereau seul**, annonce eBay créée 4 min après, aucune autre annonce Vinted ⇒ retrait permis + publication refusée ; une **conversation** (état vide) ne prouve rien ; une vente annulée ne prouve rien | `ebay-annonces.cjs` étendu (la 553 dans « à retirer ») | source bordereau retirée ; exception `ebay-apres-vente` remise |
| C3 | `audit-agent-file.cjs` sur un **Postgres jetable** (comme `audit-renum-b.cjs`) : deux battements ne prennent jamais la même tâche ; bail expiré repris ; mauvais jeton ou mauvaise version ⇒ 0 ligne ; `authenticated` ne peut pas écrire `ebay_agent_%` ; deux journaux simultanés ne perdent rien ; plafond réservé en une instruction | `ebay-agent.cjs` (port **4851**) : pouls (allumé, répétition, arrêté, pas su) | `skip locked` retiré ; version ignorée ; garde d'écriture retirée |
| C4 | `audit-ebay-agent-veille.cjs` : signature ECC (paire générée par l'audit) bonne ⇒ planifiée, fausse ⇒ 412 et 0 lecture ; `notificationId` rejoué ⇒ rien ; faux titre dans la notification ⇒ absent de toute écriture ; mémo « vendu » écrit avant, vérifié ; mémo illisible ⇒ 0 envoi ; première relecture ⇒ 0 envoi ; double vente « pas su » ⇒ 0 ; deux vendeurs, filtre `owner=eq.` partout | `ebay-agent-veille.cjs` (4852) : la ligne « eBay prévient VRM », Réglages → « Double vente » | signature non vérifiée ; mémo après l'envoi ; « pas su » lu « rien » |
| C5 | `audit-ebay-expedier.cjs` [`spec-expedier.md` §8] + `ShippingLabelPolicy` lu ⇒ mode A, illisible ⇒ mode A | `ebay-colis.cjs` (4853) : même nombre dans Colis, Ma journée, cloche ; « Ne poste pas » en tête ; le lien eBay | annulation demandée comptée « à poster » ; `EBAY_ONLY` illisible ⇒ mode B |
| C6 | `audit-ebay-suivi.cjs` : `etapeColis` (code inconnu jamais `livre`, rang qui ne descend pas, authentification jamais « livré au client ») ; `pas_scanne` seulement avec un statut lu après | `ebay-suivi.cjs` (4854) : frise d'étapes, « pas su » dit une fois, jamais « tout est à jour » | un code inconnu ⇒ `livre` ; seuil 48 h retiré |
| C7 | `audit-expedition.cjs` (faux Boxtal à la forme du bac à sable) : référence `vrm-{orderId}` cherchée avant ; coupure ⇒ incertain ⇒ **un seul achat** ; plafond dépassé ⇒ 0 achat ; `EBAY_ONLY` ⇒ 0 ; point non lu ⇒ 0 ; abonnement `null` ⇒ 0 ; répétition ⇒ 0 achat et une ligne « j'aurais » ; clé d'un autre vendeur ⇒ ne se déchiffre pas ; webhook signé avec le secret d'un autre ⇒ refusé ; PDF hors liste blanche ⇒ pas téléchargé ; annulation seulement si jamais scanné | `ebay-imprimer.cjs` (4855) : « Imprimer la journée » rend la liste de ramassage puis un bordereau par feuille, **tamponné** (texte décompressé) ; l'onglet réservé au clic ; aucun téléchargement ; le PDF eBay glissé tamponné seulement sur suivi exact | verrou retiré (⇒ deux achats) ; recherche par référence retirée ; plafond non réservé ; « pas su » traité comme « libre » |
| C8 | `audit-ebay-messages.cjs` [`suivi.md` §6.7] : éteint ⇒ 0 ; deux passages ⇒ 1 ; date inconnue ⇒ pas de J-2 ; URL, email, `{` ⇒ refusé ; plafond ; > 90 j ; coupure ⇒ jamais renvoyé | `ebay-agent-journal.cjs` (4856) : le texte exact se relit | contrôle d'URL retiré ; mémo après l'envoi |
| C9–C13 | les audits des specs du 9 octobre | ports **4857–4860** (au lieu de 4833–4840, déjà réservés par ces specs : à aligner avec le README des bancs) | celles des specs |

Les bancs eBay existants (`ebay-api`, `ebay-write`, `ebay-callback`,
`ebay-deletion`, `ebay-programmer`, `ebay-annonces`, `ebay-comptes`,
`ebay-regle-offre`) servent la requête **en flux brut** dès C2 (§6.3 : un banc qui
sert un corps déjà décodé mesure une fiction).

---

## 14. Tes gestes, une seule fois

| # | geste | où | quand | pourquoi |
|---|---|---|---|---|
| 1 | **Retirer la N°553 d'eBay**, relier `128101592740` | eBay → Annonces | **maintenant** | elle est vendue sur Vinted |
| 2 | **Décider Vercel Pro** (20 $/mois/développeur (secondaire)) | vercel.com → Settings → Billing | avant d'ouvrir VRM à des abonnés payants | le plan gratuit est « non commercial » (extrait officiel) [repris de `infra.md` §0] |
| 3 | **Activer `pg_cron` et `pg_net`** | Supabase → Database → Extensions (ou une migration préparée, sur ton oui) | avant C3 | l'horloge de l'agent [mesuré : disponibles, pas installées] |
| 4 | **Poser `VRM_BATTEMENT_SECRET`** sur Vercel (« sensitive ») **et** la même valeur dans le coffre Supabase | Vercel, puis SQL Editor | avant C3 | le battement s'authentifie |
| 5 | **Poser `VRM_COFFRE_CLE`** (« sensitive ») et en garder une copie hors ligne | Vercel + ton gestionnaire de mots de passe | avant C7 | chiffre tes clés Boxtal (puis tes jetons eBay) |
| 6 | **Te reconnecter une fois à eBay** (chaque compte) | VRM → eBay → Compte eBay → Reconnecter | avant C4 | le droit d'abonnement aux notifications (et litiges, statistiques) |
| 7 | **Demander l'« Application Growth Check »** (gratuit) | developer.ebay.com [chemin exact à vérifier] | avant ~700 comptes | hausse du quota Trading |
| 8 | **Poser `LAPOSTE_OKAPI_KEY`** (compte développeur gratuit) | developer.laposte.fr, puis Vercel | avant C6 | le suivi Colissimo / Chronopost |
| 9 | **À ta première vente eBay**, regarder ce que VRM dit du mode (eBay impose-t-il l'étiquette ?) | Colis | la première vente | décide si Boxtal vaut la peine |
| 10 | **Si l'étiquette est libre** : compte **pro** Boxtal (SIRET), **prélèvement différé**, une « application API v3 », coller les clés dans VRM, d'abord **en bac à sable** | boxtal.com, puis VRM → Compte eBay → Expédition | avant C7 en réel | VRM achète avec **ton** compte |
| 11 | Régler ton **colis type**, tes **plafonds**, ton **délai de grâce** | VRM → Compte eBay → Ton agent | avant C7 | — |
| 12 | Allumer **« Automatiser les évaluations »** dans eBay | eBay → préférences de vente | quand tu veux | l'évaluation positive, sans VRM |
| 13 | **Relire la répétition**, puis valider famille par famille | VRM → Ton agent | après ≥ 3 vraies commandes par famille | l'agent ne dépense rien avant |
| 14 | **Allumer l'agent** (installation, puis toi) | Supabase `vrm_reglages.agent_ebay = '1'`, puis VRM | à la fin | rien ne part avant |
| 15 | Ne **jamais** exposer le schéma `net` dans l'API | Supabase → Settings → API | toujours | sinon le secret du battement devient lisible par l'app |

Et une question à trancher, une fois : ton compte eBay **particulier**
revend-il des paires achetées pour être revendues ? eBay.fr écrit qu'il faut alors
être professionnel (extrait officiel). Ce n'est pas une décision de code, mais elle
décide du mode de bordereau (et des frais).

---

## 15. Ce qui est impossible ou risqué, dit franchement

### 15.1 Impossible aujourd'hui

1. **Acheter un bordereau eBay par l'API en France.** Seule l'interface d'eBay le
   fait.
2. **Acheter un bordereau ailleurs pour une commande qui exige l'étiquette eBay**
   (`EBAY_ONLY`) : tu paierais deux fois, et le suivi ne serait pas celui qu'eBay
   attend.
3. **Imprimer sans ton clic, déposer sans toi.** Le papier et le relais restent
   humains.
4. **Savoir « livré » par eBay** : seulement par le transporteur.
5. **Suivre un Mondial Relay acheté dans eBay** sans contrat pro Mondial Relay ni
   service payant : l'étape peut rester « pas su ».
6. **Connaître le point relais choisi par l'acheteur** par un champ documenté : à
   mesurer sur la première vente en relais.
7. **Demander ton virement eBay par l'API** : aucune voie connue [à vérifier] ;
   VRM te le rappelle, tu cliques dans eBay.
8. **Décider un retour, rembourser, contester** sans signature numérique : et
   même avec, c'est ton clic.
9. **Savoir tout de suite qu'une paire est vendue sur Vinted** : VRM le sait quand
   l'extension capte la vente (ou son bordereau). Entre les deux, la paire peut
   être vendue sur eBay. I18 mesure cette fenêtre ; elle ne se ferme pas à zéro.

### 15.2 Risqué, et ce qui le borne

| risque | ce qui le borne |
|---|---|
| un bordereau acheté pour une commande annulée | délai de grâce ; gel sur demande d'annulation ; annulation automatique de l'étiquette si la commande est annulée et le colis jamais scanné |
| deux bordereaux pour une commande | référence `vrm-{orderId}` cherchée avant ; état écrit avant ; incertain ⇒ recherche, jamais un second achat sans preuve |
| un poids sous-déclaré refacturé | poids validé par toi, montré, gardé ; le devis fait foi |
| le mauvais relais | aucun achat en relais sans le point lu par identité |
| une dépense qui s'emballe | plafonds réservés en base avant l'achat, bornés par le serveur ; interrupteur d'installation à `'0'` arrête tout à la minute |
| un message qui viole les règles d'eBay | contrôle du texte rendu ; plafonds ; aucun lien ; jamais d'exigence d'évaluation |
| le quota Trading (5 000 par jour pour tous les vendeurs) | garde-quota global, priorités, part équitable ; Growth Check |
| une notification forgée | signature vérifiée ; une notification n'est qu'une sonnette |
| la clé d'un vendeur utilisée pour un autre | coffre chiffré avec données associées ; `owner` pris en base ; crochets par vendeur |
| l'horloge qui s'arrête | contrôle du matin ; notification au propriétaire de l'installation |
| le secret du battement lisible dans la file `pg_net` | un secret à part, qui ne permet que de déclencher des battements idempotents et freinés |
| la numérotation 013 qui change le sens d'un SKU | le SKU se lit par `numeroExterne` (un SKU posé avant la coupure désigne l'ancienne paire) [repris de CLAUDE.md « Anciens numéros en B »] |
| l'adresse d'un acheteur chez un tiers | sur l'ordre du vendeur ; jamais rangée par VRM ; politique de confidentialité à mettre à jour avant C7 |
| Vercel Hobby et usage commercial | décision de Julien (geste 2) |

---

## 16. Ce qui reste à mesurer, au premier vrai essai

1. **`ShippingLabelPolicy` sur tes commandes** (compte particulier et compte pro).
2. **La forme de `shipTo`** sur une vente en point relais : y a-t-il un identifiant
   de point ?
3. Les listes `get_shipping_carriers` et `get_shipping_services` pour `EBAY_FR`
   (codes de Mondial Relay et de Colissimo).
4. Que `ORDER_CONFIRMATION` arrive pour un vendeur eBay.fr, avec quels champs, en
   combien de temps ; le droit d'abonnement exact ; si la notification nomme le
   compte.
5. La signature des notifications : corps brut ou JSON re-sérialisé.
6. Boxtal : clés v1 pour les devis ; format thermique par transporteur ; délai de
   remboursement d'une annulation ; frais de régularisation de poids ; une grille
   1–2 kg ; si un **QR sans impression** existe pour Mondial Relay par l'API.
7. La date limite de retrait dans La Poste Suivi v2 et dans les évènements Boxtal.
8. `AddMemberMessageAAQToPartner` avec le jeton OAuth sur eBay.fr ; longueur
   maximale ; effet du passage des pseudos à des identifiants fixes.
9. Le délai réel entre une vente Vinted et sa preuve dans VRM (I18).
10. La durée pendant laquelle un acheteur eBay.fr peut annuler seul après l'achat
    (pour régler le délai de grâce).
11. Si une API permet de demander un virement du solde eBay d'un particulier.
12. Que le script Gmail puisse faire suivre les emails d'eBay (I17), et leur forme.

---

## 17. Sources

**Mesuré le 11 octobre** (lecture seule, projetée, aucun jeton ni donnée
d'acheteur) : `app_data` du propriétaire `74eea6e7-…` — lignes `ebay_*`
(`capturedAt` du 10 octobre 20:29 UTC, 3 annonces, 0 commande),
`harvest_*_orders_sold` (60 ventes en 30 jours, 58 non annulées, 62,59 € en
moyenne, dédoublonnées par `transaction_id`), `main` (`vrm_imprimante = normale`,
`vrm_ebay_retrait_auto = true`, 425 fiches numérotées, `vrm_numerotation`
absent) ; extensions (`pg_cron`, `pg_net`, `pgmq` disponibles et non installées ;
`pgcrypto`, `supabase_vault` installées). Code : `api/ebay.js` (dispatch
`ACTIONS`, modes `deletion`/`callback`), `vercel.json` (1 cron, 5 réécritures) de
`wf_30feaf2f-334-8` ; `api/_lib/push.js` (`PUSH_DEFAUT`), `api/_lib/stamp.js`,
`src/App.jsx` (`annotateAndDownloadBordereau`, `zoneEtiquette`,
`posePrefsImpression`, `POSTE_SANS_DEPART_H`, « Prêts à imprimer »),
`api/vinted-proxy.js` (`LECTURES_PERMISES`) de `integ-11oct` ; ports déjà pris par
les bancs (aucun entre 4851 et 4860).

**Documents de ce dossier** : `bordereaux.md`, `suivi.md`, `infra.md`, `etat.md`
(11 octobre) ; `../agent-ebay/feuille-de-route.md`, `possible.md` et les spec du
9 octobre. Leurs propres sources y sont listées.

**Recherches du 11 octobre (extraits de moteur ; pages non ouvertes, le proxy
bloque les domaines officiels et `justgeek.fr`)** :
- Aide eBay.fr, « Commencer à recevoir des paiements » : depuis le 1ᵉʳ septembre
  2026, les fonds des particuliers restent sur le solde eBay, versements à la
  demande ; versement automatique après 365 jours sans activité (extrait officiel,
  via le moteur) — [ebay.fr/help/…?id=4795](https://www.ebay.fr/help/selling/getting-paid/commencer-recevoir-des-paiements-sur-ebay?id=4795).
- JustGeek, « eBay supprime les frais de vente pour les particuliers, oui, mais… » :
  frais « Protection acheteurs » payés par l'acheteur (0,10 € + 2 à 7 %),
  exceptions au-delà de 150 annonces par mois ou hors zone euro (secondaire) —
  [justgeek.fr](https://www.justgeek.fr/ebay-supprime-frais-vente-particuliers-157677/).
- Communiqué Mondial Relay / eBay (impression du bordereau en point relais)
  (secondaire, date non lue) —
  [static.ebayinc.com](https://static.ebayinc.com/static/assets/Uploads/PressRoom/Local/Imported/Mondial%20Relay%20et%20eBay%20renforcent%20leur%20partenariat%20et%20proposent%20un%20service%20d%E2%80%99exp%C3%A9dition%20in%C3%A9dit%20d%C3%A9di%C3%A9%20aux%20vendeurs%20eBay.pdf).
- Aucune source trouvée établissant qu'un bordereau eBay soit **obligatoire**
  pour les particuliers en France en 2026 : la question reste [à vérifier] sur la
  première commande (`ShippingLabelPolicy`).
- Aucune documentation Boxtal v3 renvoyée par le moteur ce jour ; les faits Boxtal
  viennent de `bordereaux.md` (README `ErnadoO/boxtal`, code lu ; extraits du guide
  v3).
