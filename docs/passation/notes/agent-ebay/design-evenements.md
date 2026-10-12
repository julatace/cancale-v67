# L'agent eBay autonome — conception « tout part d'un évènement »

**Pour :** Julien (sections 0, 1, 14 et 15 d'abord), puis les sessions qui
construiront.
**Rédigé le :** 11 octobre 2026, à partir de sa demande du jour : « un agent
100 % autonome qui ne dépend de personne, qui envoie les bordereaux, qui fait
les suivis de colis des clients… n'hésite pas à prendre des initiatives ».

**Ce document s'appuie sur quatre études faites aujourd'hui, à côté**, et ne
les recopie pas :
- `bordereaux.md` : acheter un bordereau par API depuis la France ;
- `suivi.md` : suivre le colis jusqu'au client, et lui parler ;
- `infra.md` : l'horloge, la mémoire, les verrous, les quotas, les clés ;
- `etat.md` : ce qui existe vraiment, et le cas de la **N°553**.

Il s'appuie aussi sur la feuille de route du 9 octobre
(`../agent-ebay/feuille-de-route.md` et ses dix `spec-*.md`) : quand un chantier
de cette feuille tient toujours, il est **réutilisé tel quel** et nommé.

**D'où vient chaque fait :**

| marque | sens |
|---|---|
| **(mesuré)** | lu aujourd'hui sur ta base (requêtes projetées, aucun jeton, aucune donnée d'acheteur) ou dans le code |
| **(code lu)** | code lu en entier (VRM, ou code open source cité par les études) |
| **(extrait officiel)** | extrait d'une page officielle renvoyé par un moteur de recherche ; la page elle-même est bloquée ici |
| **(secondaire)** | forum, blog, bibliothèque non officielle |
| **[à vérifier]** | pas établi. **Rien de ce qui porte cette marque ne devient une promesse à l'écran** |

**Aucun appel** n'a été fait à eBay, à un transporteur, à un agrégateur ni à
Vinted. **Aucune écriture**, sauf ce fichier.

---

## 0. En une page

**Ce que tu demandes est faisable à 90 %, et les 10 % qui restent sont dits.**

1. **Le principe.** L'agent ne « tourne » pas en boucle à vérifier tout et
   n'importe quoi. **Il réagit.** Chaque étape d'une vente est déclenchée par
   un évènement :
   - eBay qui prévient « l'acheteur a payé » ;
   - le transporteur qui prévient « colis scanné », « au relais », « livré » ;
   - ton extension qui voit une vente Vinted ;
   - ou une date que l'agent s'est lui-même donnée (« si rien n'a bougé dans
     48 h, regarde »).

   Un **battement** chaque minute ne sert qu'à exécuter ce qui est dû, et à
   **rattraper** ce qu'un évènement aurait manqué. Ton téléphone, ton
   ordinateur et l'app peuvent être éteints.

2. **Ce qui se fait tout seul dès le premier jour** (rien à allumer, ce sont
   des lectures) :
   - une vente eBay fait sonner ton téléphone en moins d'une minute, avec le N°
     du carton et la date limite d'envoi ;
   - elle entre dans Colis, Ma journée, le widget et le rappel du matin ;
   - le colis est suivi jusqu'au client, et tu es prévenu s'il bloque, s'il
     n'a pas été scanné, ou s'il revient ;
   - tu es prévenu si une paire est en vente sur eBay alors qu'elle est déjà
     vendue ailleurs.

3. **Ce qui se fait tout seul si tu l'allumes** (éteint par défaut, avec des
   plafonds, et tout est écrit dans un journal que tu relis) :
   - **acheter le bordereau** chez un agrégateur (Boxtal d'abord), avec ton
     compte et ton argent ;
   - **déclarer le numéro de suivi à eBay** : il est connu par identité, c'est
     VRM qui a acheté ce bordereau pour CETTE commande ;
   - **annuler un bordereau devenu inutile** (commande annulée, colis pas
     déposé) ;
   - **retirer d'eBay** une paire prouvée vendue sur Vinted, VRM fermé ;
   - **écrire à l'acheteur** au bon moment (« votre colis vous attend au relais
     jusqu'au 14/10 ») ;
   - **baisser le prix** d'une paire qui dort, jamais sous ton plancher.

   Au début, l'agent tourne **7 jours en « répétition »** : il écrit ce qu'il
   **aurait** fait, sans le faire. Tu relis, puis tu passes en réel.

4. **Ce qui reste ton clic, et pourquoi.**
   - **Imprimer et déposer le colis.** Aucun serveur ne peut appuyer sur ton
     imprimante.
   - **Retirer une annonce Vinted.** C'est ta règle (§3) : VRM te prévient, ne
     touche à rien.
   - **Le bordereau d'une commande où eBay impose SON étiquette.** ⚠️ C'est
     probablement le cas de ton compte **particulier** : eBay gère la livraison
     sur ton compte (mesuré le 27 septembre), et aucune étiquette eBay ne
     s'achète par API en France (`bordereaux.md` §1). Là, l'agent prépare tout
     et te laisse **un** bouton « acheter le bordereau dans eBay ». Ensuite il
     reprend la main : suivi, alertes, messages.
   - **Ce qui t'engage** : répondre à un problème de livraison, rembourser,
     accepter une offre autrement que par ta règle d'offre.

5. **⚠️ Avant toute chose, un geste urgent.** La **N°553** est en vente sur eBay
   (annonce `128127336988`, 120 €) alors qu'elle est **vendue sur Vinted**
   depuis le 10 octobre à 22 h 25 (`etat.md` §3.3). **Retire-la d'eBay
   maintenant.** Le premier chantier de ce plan (section 13, chantier A) fait que
   ça ne puisse plus arriver.

6. **Le plan : 11 chantiers** (A à J, plus « argent »), environ
   **17 sessions de travail**, dont une partie en parallèle. Chaque chantier est
   utile seul et prouvé seul. Les **14 gestes** que toi seul peux faire sont
   dans la section 14, chacun avec le chantier qui l'attend : deux sont des
   décisions d'argent (Vercel Pro, compte Boxtal). Aucun n'est urgent, sauf le
   retrait de la N°553. Et **cinq décisions** te reviennent (fin de la
   section 14).

---

## 1. Ce que vit Julien — et ce que vit un autre revendeur

### 1.1 Une vente eBay, du début à la fin, une fois l'agent en place

**Julien** (compte eBay particulier, où eBay impose probablement son étiquette)
et **Sarah**, une revendeuse abonnée à VRM (compte pro, compte Boxtal relié).
Mêmes heures, mêmes paires.

| quand | Julien | Sarah | ce que fait l'agent, et ce qui le déclenche |
|---|---|---|---|
| **lun. 10 h** | Il choisit 12 paires « prêtes pour eBay » et les **programme** pour 20 h. | Pareil. | **Son clic.** La programmation existe (5 oct.). L'agent pose une échéance à 20 h 01 : « vérifier qu'elles sont parties ». |
| **lun. 20 h 01** | Rien à faire. | Rien. | **Évènement daté.** L'agent relit les programmées. Une n'est pas partie : une ligne dans Ma journée (« pas partie à l'heure, regarde-la »). |
| **mar. 9 h** | Il vend la N°214 **sur Vinted**. | Elle vend sa N°88 sur Vinted. | **Évènement : l'extension range la vente** et sonne le serveur (`veiller`). Si la paire est sur eBay et que le retrait est allumé : **annonce eBay retirée dans les minutes qui suivent** (le délai, c'est celui que met l'extension à voir la vente sur Vinted), notification « Retirée d'eBay : N°214 (vendue sur Vinted) ». Sinon : notification « retire-la d'eBay » avec le bouton. |
| **mar. 21 h 40** | L'acheteur eBay paie la N°301. | Pareil pour sa N°412. | **Évènement eBay `ORDER_CONFIRMATION`**, signé. En moins d'une minute : la commande est relue avec le jeton de CE compte, la paire retrouvée par son SKU `VRM-301`, et le téléphone sonne : « Vendu sur eBay — N°301 · 89 € · à poster avant jeudi ». Si la N°301 est encore en ligne sur Vinted : « — **retire-la de Vinted** ». |
| **mar. 21 h 41** | — | — | **L'agent qualifie la commande** : étiquette imposée par eBay ? vérification d'authenticité ? livraison au relais ou à domicile ? point relais connu ? poids connu ? |
| **mar. 22 h 40** (1 h après le paiement, pour laisser passer les annulations de dernière minute) | **Étiquette eBay imposée** ⇒ l'agent n'achète rien. Il prépare la carte Colis : N°301, carton, date limite, bouton **« Acheter le bordereau dans eBay »**. | **Étiquette libre, achat allumé** ⇒ l'agent demande un **devis** à Boxtal (4,90 €), vérifie ses plafonds, **achète**, range le PDF, **déclare le suivi à eBay**. Journal : « Bordereau Mondial Relay acheté 4,90 € pour N°412 · suivi déclaré à eBay ». | **Évènement daté** (posé à 21 h 41). Sarah, si elle a choisi « préparer, je confirme », reçoit au lieu de ça « Bordereau prêt à acheter : N°412 · 4,90 € · Confirmer ». |
| **mer. 7 h 30** | Il ouvre Colis, appuie sur le bouton, achète l'étiquette dans eBay (30 s), l'imprime. | Elle ouvre Colis : **« 3 bordereaux prêts à imprimer »**, tamponnés du titre et du N°, un par feuille ou en 10 × 15 thermique. | **Son clic.** Pour Julien : eBay prévient VRM (`ITEM_MARKED_SHIPPED`), l'agent relit le suivi **sur la commande**, par identité. |
| **mer. 10 h** | Il dépose le colis. | Pareil. | **Évènement transporteur** (webhook de l'agrégateur, ou relecture de La Poste) : « pris en charge ». La vente passe dans « Partis ». **Aucune notification** : rien à faire. |
| **jeu. 10 h** (si le colis n'a **pas** été scanné 48 h après le bordereau) | Notification « N°301 : bordereau sans scan depuis 48 h — l'as-tu déposé ? ». | Pareil. | **Évènement daté** posé à l'achat. Annulé tout seul si le scan arrive avant. |
| **ven. 15 h** | — | — | **Évènement transporteur** : « au relais, retrait jusqu'au 14/10 ». Si le rappel est allumé, échéance posée au 12/10. |
| **dim. 12/10, 10 h** (colis toujours au relais) | — | — | **Évènement daté** : si le rappel est allumé, message à l'acheteur par la messagerie eBay : « votre colis vous attend au point relais jusqu'au 14/10 ». Une fois, jamais deux. Journal : le texte exact. |
| **lun. 13/10** | — | — | **Évènement transporteur** : « livré ». La **preuve de livraison** est gardée sur la vente (transporteur, date, code d'évènement). Si allumé : message « livré » ; évaluation positive « après livraison ». |
| **13/11** | — | — | **Évènement daté** : 30 jours sans litige ⇒ commande « close », ligne compactée. |
| **le 15 du mois** | Une fois la reconnexion `v2` faite : « Ton niveau vendeur eBay : au-dessus des normes · 0 retard ce mois ». | Pareil. | **Évènement daté**, mensuel, cinq jours avant l'évaluation d'eBay (le 20). |

### 1.2 Ce qui est automatique, réglable, ou ton clic

| geste | mode par défaut | réglage | plafonds |
|---|---|---|---|
| Relire une vente, la relier au carton (SKU), la mettre dans Colis, Ma journée, le widget, le rappel | **automatique** (lecture) | — | quota eBay (section 12) |
| Te prévenir : vente, double vente, date limite proche, colis bloqué, retour | **automatique** | chaque catégorie se coupe dans Réglages → Notifications | 1 par commande et par type |
| Retirer d'eBay une paire prouvée vendue sur Vinted | **réglage, éteint par défaut** (tu l'as allumé le 10 oct.) — désormais aussi VRM fermé | `vrm_ebay_retrait_auto` (existe) | 5 par passage ; jamais sur « pas su » |
| Acheter le bordereau | **réglage, éteint** ; trois positions : *non* · *préparer, je confirme* · *acheter seul* | `bordereaux` | par étiquette, par jour (nombre et €), par mois |
| Déclarer le numéro de suivi à eBay | **automatique** quand c'est VRM qui a acheté ce bordereau (identité) ; **ton clic** pour un numéro tapé | — | 1 par commande |
| Annuler un bordereau acheté par VRM devenu inutile | **automatique si l'achat seul est allumé**, et seulement sur une annulation **définitive** chez eBay et sans scan ; sinon proposé | — | — |
| Écrire à l'acheteur : « merci », « au relais jusqu'au… », « livré » | **réglage, éteint**, un interrupteur par message | `messages` | 20 par jour et par compte eBay, 3 par commande |
| Message « problème de livraison » | **ton clic** (préparé, à relire) | — | — |
| Répondre à une question d'acheteur | **préparé tout seul**, envoyé sur **ton clic** ; envoi seul possible plus tard (réglage éteint) | `questions` | 20 par jour et par compte |
| Évaluation positive « après livraison » | **réglage, éteint** (ou le réglage natif d'eBay, que je recommande) | `evaluation` | 10 par passage |
| Baisser le prix d'une paire qui dort | **réglage, éteint** | `repricing` | jamais sous ton plancher ; −5 % par semaine au plus |
| Remettre en vente une paire revenue | **proposé** (ton clic) | — | frais vérifiés à blanc d'abord |
| Offre aux observateurs | **ton clic** (proposée par l'agent) — voir 11.7 | — | — |
| Accepter une offre | **par ta règle d'offre seulement** (seuil natif d'eBay, 9 oct.) — l'agent n'accepte jamais | — | — |
| Tout arrêter | **un bouton** « Mettre l'agent en pause » ; et un interrupteur d'installation | — | effet à la minute |

### 1.3 Pour un nouveau revendeur, le premier jour

1. Il relie son compte eBay (existe).
2. VRM lui dit ce que l'agent **sait faire pour lui**, mesuré sur son compte :
   « étiquettes imposées par eBay sur tes ventes » ou « étiquettes libres :
   relie un compte Boxtal pour que VRM les achète ». (Lu sur sa première vente,
   jamais supposé.)
3. S'il veut l'achat automatique : il ouvre un compte Boxtal pro (SIRET,
   prélèvement différé), colle **deux clés** dans VRM (Réglages → Expédition),
   VRM les teste (« ✓ ») ; il règle son colis type et ses plafonds.
4. L'agent tourne **7 jours en répétition**, puis il le passe en réel.
5. Sans SIRET : pas d'achat par Boxtal. L'agent fait tout le reste, et l'achat
   reste « un bouton dans eBay ».

---

## 2. Le principe : évènements, battement, rattrapage

```
  ÉVÈNEMENTS (ils ne portent jamais de données qu'on croit : ce sont des SONNETTES)
  ─────────────────────────────────────────────────────────────────────────────
  eBay (REST, signé)        ORDER_CONFIRMATION · ITEM_MARKED_SHIPPED ·
                            AUTHORIZATION_REVOCATION · MARKETPLACE_ACCOUNT_DELETION
  Transporteur (HMAC)       Boxtal TRACKING_CHANGED · DOCUMENT_CREATED ;
                            Sendcloud parcel_status_changed
  Ton extension (session)   « une vente Vinted vient d'être rangée »  (veiller)
  Tes emails (serveur)      un email de transporteur au MÊME n° de suivi
  L'app (ton clic)          acheter, confirmer, envoyer, relier, régler
  L'agent lui-même          « dans 48 h », « à 20 h 01 », « le 12/10 à 10 h »
              │
              ▼   vérifier (signature / session) → retrouver le vendeur → dédoublonner
  ┌───────────────────────────── Supabase (ta base) ─────────────────────────────┐
  │ vrm_agent_file : UNE ligne par tâche (« commande 12-34567-89012 de Sarah »), │
  │   avec sa prochaine échéance et son bail (verrou)                            │
  │ pg_cron, chaque minute : « y a-t-il une tâche due ? » — sinon AUCUN appel    │
  └───────────────────────────────┬──────────────────────────────────────────────┘
                                  │ pg_net (POST signé)
                                  ▼
       /api/ship-reminders?mode=battement : prend ≤ 8 tâches, 25 s de travail,
       chacune dans le contexte de SON vendeur → la machine à états avance d'une
       ou plusieurs étapes → elle écrit son état ET sa prochaine échéance
                                  │
                 RATTRAPAGE (au cas où une sonnette n'a pas sonné)
       veille par compte eBay (commandes modifiées depuis la dernière lecture) :
       60 min si eBay prévient, 15 à 30 min sinon ; suivi des colis selon l'étape ;
       cron Vercel de 08:00 : battement de secours + « l'horloge est-elle vivante ? »
```

**Trois règles qui découlent de ce schéma :**

1. **Une sonnette ne sert qu'à réveiller.** Une notification d'eBay ou d'un
   transporteur n'est jamais rangée comme une donnée. Elle **programme une
   relecture**, faite avec le jeton de CE vendeur, chez la source. Une sonnette
   forgée, rejouée ou mal routée ne peut donc rien écrire de faux : au pire, une
   relecture de plus, freinée.
2. **Le temps est un évènement comme un autre.** Chaque transition d'état écrit
   **sa prochaine échéance** (« si pas de scan, regarde dans 48 h »). Il n'y a
   pas de balayage « toutes les commandes toutes les 5 minutes ». Une commande
   calme ne coûte rien.
3. **Le battement est bête.** Il exécute ce qui est dû. Toute l'intelligence est
   dans la machine à états, qui est une **fonction pure** (même entrée, même
   sortie) : c'est ce qui la rend prouvable dans un `vm`.

---

## 3. Les évènements

### 3.1 La liste

| # | évènement | source et preuve d'origine | à qui il appartient | ce qu'il programme |
|---|---|---|---|---|
| E1 | **vente payée** (`ORDER_CONFIRMATION`) | eBay, API Notification REST ; en-tête `X-EBAY-SIGNATURE`, clé publique par `kid` (code officiel d'eBay lu, `infra.md` §2.1). Le schéma AsyncAPI du sujet porte un objet `order` avec `orderId` (extrait officiel, `order_confirmation.yaml`) | par l'adresse de destination **propre à chaque compte eBay** (identifiant opaque dans le chemin, voir 3.3) | `cmd:{orderId}` **tout de suite** ; veille du compte |
| E2 | **marquée expédiée** (`ITEM_MARKED_SHIPPED`) — un bordereau acheté dans eBay, ou un suivi chargé à la main | idem (sujet ajouté le 12 déc. 2025, extrait officiel des notes de version) | idem | `cmd:{orderId}` : relire `getShippingFulfillments` |
| E3 | **accord retiré** (`AUTHORIZATION_REVOCATION`) | idem, sujet **d'application** | par l'`eiasToken` → clé du compte (identité existante) | compte « refusé », ses tâches s'arrêtent, notification « reconnecte » |
| E4 | **compte eBay supprimé** (`MARKETPLACE_ACCOUNT_DELETION`) | idem (le défi GET existe ; le POST est à écrire, spec `socle` §3.4) | transversal (registres seulement) | anonymiser, déconnecter |
| E5 | **question, offre, retour, litige** | **plus tard** : Platform Notifications (Trading), après la liste blanche d'eBay ; signature MD5 qui ne couvre pas le contenu ⇒ sonnette pure (`infra.md` §2.2) | par `RecipientUserID` dans le registre | relecture des questions, offres, litiges du compte |
| E6 | **étape du colis** | Boxtal `TRACKING_CHANGED` (`x-bxt-signature`, HMAC SHA-256 du corps brut) ; Sendcloud `parcel_status_changed` (`Sendcloud-Signature`) (extraits officiels, `bordereaux.md` §2.3-2.4) | par l'adresse propre au vendeur **et** la référence d'envoi = l'`orderId` que VRM a lui-même posé | `cmd:{orderId}` : relire l'envoi chez l'agrégateur |
| E7 | **étiquette prête** | Boxtal `DOCUMENT_CREATED` | idem | `cmd:{orderId}` : télécharger le PDF |
| E8 | **vente Vinted rangée** | ton extension, avec **sa** session VRM (action `veiller`, spec `retrait-serveur` §3.3) — ce n'est pas une requête à Vinted | la session | `vendeur:doubles` tout de suite |
| E9 | **email d'un transporteur** au n° de suivi d'une commande eBay | `api/email-inbound` (l'adresse de réception décide du vendeur, règle existante) | idem | `cmd:{orderId}` si le n° est **exactement** celui de la commande (identité) |
| E10 | **ton clic** dans l'app | ta session (`vendeurExige`) | la session | le geste tout de suite, dans la requête ; puis `cmd:…` |
| E11 | **une écriture de VRM chez eBay** (publication, programmation, retrait, prix) | VRM lui-même | le vendeur de la requête | `ann:{itemId}` à l'heure de départ ; veille du compte |
| E12 | **une échéance** (48 h sans scan, J−2 au relais, `shipByDate` − 24 h, J+30 après livraison, le 15 du mois) | la machine à états, à la transition | celui de la tâche | la tâche elle-même |

### 3.2 Ce qu'on fait d'un évènement entrant, en moins d'une seconde

1. **Lire le corps brut** (≤ 200 Ko, sinon 413).
2. **Vérifier la preuve d'origine** : signature eBay, HMAC du transporteur avec
   le secret de **ce** vendeur, session. Fausse ⇒ **412**, rien n'est fait.
   La vérification n'est **jamais** relâchée : si elle échoue sur une vraie
   notification, on répond 500 (l'expéditeur réessaie) et on cherche pourquoi.
3. **Retrouver le vendeur et le compte** (3.3). Inconnu ⇒ **204** (rien à
   faire ; c'est le conseil de Boxtal pour qu'il ne réessaie pas).
4. **Dédoublonner** : l'identifiant de l'évènement (`notificationId` chez eBay,
   identifiant de l'évènement chez l'agrégateur) est inscrit dans
   `vrm_agent_vus` ; déjà vu ⇒ 204.
5. **Programmer** la tâche : `vrm_agent_planifier(owner, cle, quand)` — « au plus
   tard à `quand` ». Un seul appel en base.
6. **Répondre 204.** Le travail se fait au battement suivant (moins d'une
   minute). Base injoignable à l'étape 4 ou 5 ⇒ **500** : l'expéditeur
   réessaie, et la veille rattrape de toute façon.

Objectif mesurable : **< 1 s à chaud, < 2,5 s à froid** (Boxtal exige une
réponse en moins de 2 s, `bordereaux.md` §2.3). D'où la clé publique d'eBay
gardée **en base** par `kid` (24 h), pas seulement en mémoire.

### 3.3 Retrouver le vendeur d'un évènement, sans jamais se tromper

- **eBay (E1, E2)** : je n'ai pas trouvé si une notification `ORDER_CONFIRMATION`
  nomme le vendeur **[à vérifier]**. Et eBay remplace progressivement le pseudo
  par un identifiant fixe pour les utilisateurs américains depuis le 26 septembre
  2025 (extrait officiel, page d'aperçu de l'API Notification) : un routage par
  pseudo serait fragile.
  ⇒ **Une adresse de destination par compte eBay** :
  `https://vrm.center/api/ebay-notif/{k}`, où `k` est un identifiant **opaque**
  (32 caractères aléatoires), rangé dans une table serveur
  `vrm_agent_routes(k → owner, compte, cree)`. Il ne révèle rien, ne se devine
  pas, et se révoque (on change `k`).
  Si eBay limite le nombre de destinations d'une application **[à vérifier]**,
  repli : une destination unique, et le vendeur retrouvé par le champ vendeur de
  la notification s'il existe — sinon par l'`orderId`, **seulement** s'il est
  déjà dans une ligne `ebay_agent_cmd*` (la veille l'a déjà vu). Une commande
  jamais vue reste à la veille. On n'essaie **jamais** tous les comptes « pour
  voir ».
- **Transporteur (E6, E7)** : une adresse par vendeur et par fournisseur,
  `https://vrm.center/api/transporteur/{k}`. La signature se vérifie avec le
  secret de **ce** vendeur. Puis la référence de l'envoi doit être un `orderId`
  qui figure **dans une commande de ce vendeur** dont VRM a acheté le bordereau.
  Les deux à la fois, sinon rien.
- **Extension (E8), app (E10)** : la session, jamais un paramètre.
- **Email (E9)** : l'adresse de réception (la règle d'arrivée existante).

### 3.4 Sans évènement : le rattrapage

Aucune notification n'est garantie : eBay fait 3 tentatives, puis plus rien ;
Boxtal 10 en 24 h (extraits officiels, `infra.md` §2.1, `bordereaux.md` §2.3).

| filet | rythme | ce qu'il relit |
|---|---|---|
| **veille d'un compte eBay** | **60 min** quand eBay prévient (une notification reçue depuis moins de 7 jours) ; **15 min** sinon, **30 min** au-delà de 500 comptes (quota) ; **tout de suite** après une sonnette | `getOrders` filtré par date de modification (recouvrement 1 h) : **un seul appel** quand rien n'a bougé |
| **suivi d'un colis en vol** | selon l'étape : `etiquette` toutes les 6 h ; `en_transit` toutes les 12 h ; `au_relais` chaque jour ; jamais après `livre` ou `retour` | l'agrégateur, ou La Poste, ou eBay |
| **horloge de secours** | cron Vercel de **08:00** (le seul, il existe) | un battement, puis « l'horloge `pg_cron` a-t-elle battu depuis 30 min ? » — sinon une notification au propriétaire de l'installation |

---

## 4. Les machines à états

Une **fonction pure** par machine : `avancer(etat, faits, maintenant, reglages)
→ { etat', gestes[], prochain }`. Elle ne fait **aucun** appel : la tâche lit
les faits, appelle `avancer`, exécute les gestes autorisés, écrit l'état. C'est
ce qui permet de la prouver sur des milliers de cas inventés.

### 4.1 La commande eBay

Le **rang** ne descend jamais. Une branche « problème » peut s'ouvrir à tout
moment. Un fait inconnu **ne change pas** l'état (il est noté).

| rang | état | on y entre quand (preuve) | ce que l'agent fait | échéance posée |
|---|---|---|---|---|
| 0 | `historique` | la commande existait à la première veille du compte | **rien** (ni geste, ni notification : sinon « 30 ventes ! » d'un coup) | aucune |
| 1 | `payee` | E1, ou veille : `orderPaymentStatus = PAID`, pas d'envoi | retrouve la paire par le **SKU** de chaque ligne (jamais le titre) ; notifie « Vendu sur eBay » ; programme `vendeur:doubles` | qualification **tout de suite** |
| 2 | `a_qualifier` → `a_expedier` | la commande relue chez eBay avec le jeton du compte | lit, **pour décider seulement** : la politique d'étiquette (`ShippingLabelPolicy`), l'authentification, le service payé (relais ou domicile), le point relais **s'il est lisible par identité**, `shipByDate`, une demande d'annulation, le poids de la paire. Range `etiquette: ebay \| libre \| auth \| pas_su` | achat du bordereau à `max(paiement + 1 h, ouverture de ta fenêtre)` ; rappel à `shipByDate − 24 h` |
| 3 | `bordereau_en_cours` | **écrit AVANT l'appel d'achat**, avec la clé d'idempotence | achète (section 9) | relecture dans 2 min |
| 3′ | `bordereau_incertain` | coupure après l'envoi de l'achat | **relit chez l'agrégateur par la référence** ; **jamais un second achat sans la preuve qu'il n'y en a pas eu** ; sinon te le demande | relecture dans 5, 15, 60 min |
| 4 | `bordereau_achete` | suivi + transporteur + identifiant d'envoi rendus | télécharge le PDF (E7, ou relecture) ; déclare le suivi à eBay ; notifie « bordereau prêt » | « pas de scan » à achat + 48 h |
| 4′ | `declaration_incertaine` | coupure pendant `createShippingFulfillment` | relit `getShippingFulfillments` : le **n° de suivi** est l'identité | 5, 15, 60 min |
| 5 | `declaree` | `fulfillmentId` rendu par eBay ; ou E2 + un envoi lu sur la commande (bordereau acheté dans eBay) | suit le colis (4.3) | selon l'étape du colis |
| 6–9 | `pris_en_charge`, `en_transit`, `au_relais`, `livree` | étape du colis (4.3) | alertes, messages (si allumés), preuve de livraison | voir 4.3 |
| 10 | `close` | 30 jours après la livraison sans litige | compacte la ligne | aucune |
| — | `annulation_demandee` | `cancelRequests` ouverte | **arrêt de tout achat** ; « Ne poste pas » dans Colis ; si un bordereau VRM existe et n'est pas scanné : proposé à l'annulation | relecture toutes les 6 h |
| — | `annulee` | `cancelState = CANCELED` (définitif) | si bordereau VRM sans scan **et** achat seul allumé : **annulé** (remboursé) ; sinon proposé | aucune |
| — | `retour_ouvert`, `litige`, `remboursee` | Post-Order, Fulfillment (chantier `litiges`) | arrêt des gestes automatiques sur cette commande ; ligne dans Ma journée avec la date limite et le lien eBay | selon la date limite |
| — | `probleme_livraison`, `retour_expediteur` | étape du colis | alerte ; message **préparé** (ton clic) | 24 h |
| — | `pas_su` | n'importe quelle lecture ratée | **aucun geste** ; la tâche revient plus tard (1, 2, 4… min, plafonné à 60) | repli |

⚠️ **« Pas su » ne fait pas avancer.** Une étape est franchie sur une **preuve
lue**, jamais sur une absence (une commande absente de la réponse d'eBay est
sortie de la fenêtre, pas annulée — spec `socle` §3.3).

### 4.2 L'annonce eBay

| état | on y entre quand | ce que l'agent fait | déclencheur |
|---|---|---|---|
| `brouillon` | « Enregistrer en brouillon » (existe) | rien | ton clic |
| `programmee` | `programmer` a rendu un `ItemID` et une heure (existe) | à l'heure + 1 min : relire ; une paire **prouvée vendue ailleurs** avant son heure ⇒ « à annuler » (et annulée si le retrait automatique est allumé et que l'annulation d'une programmée est mesurée possible) | E11, E12 |
| `en_ligne` | relue dans `ActiveList` | veille ; « dort » après `SLEEP_DAYS` (30, la règle de Vinted) | E12 |
| `a_retirer` | la paire est **prouvée vendue** sur une autre plateforme (règle `doublesVenteEbay`, élargie au bordereau, chantier A) | retrait si allumé, sinon notification `double` | E8, E9, veille |
| `retiree` / `en_pause` | `EndFixedPriceItem` rendu, ou quantité 0 avec « hors stock » (spec `annonces-vivantes`) | journal ; sortie de `ebay_listings` | — |
| `vendue` | une commande porte son `ItemID` | la commande prend la main | E1 |
| `terminee_invendue` | relue dans `UnsoldList` | proposer la remise en vente si la paire est en stock | veille |
| `incertaine` | une écriture chez eBay sans `<Ack>` (`sansAck`, existe) | relire chez eBay par SKU avant tout nouvel essai | relecture 5 min |

### 4.3 Le colis (sous-machine d'une commande)

L'échelle est celle de `suivi.md` §2.4, **une seule** pour toutes les sources :
`etiquette → pris_en_charge → en_transit → au_relais → livre`, plus `probleme`,
`retour`, `pas_su`. Une seule fonction pure `etapeColis(source, évènement)`. Un
code inconnu ne vaut **jamais** `livre`.

| étape | échéance posée | alerte |
|---|---|---|
| `etiquette` | + 48 h | « bordereau sans scan depuis 48 h » (notification `expedier`) |
| `pris_en_charge`, `en_transit` | + 5 jours ouvrés sans nouvel évènement ; et date de livraison estimée maximale + 3 jours ouvrés | « colis bloqué depuis le … » (notification `livraison`) |
| `au_relais` | date limite − 2 jours (si connue) ; date limite + 1 jour | rappel à l'acheteur (si allumé) ; « pas retiré, il va revenir » |
| `livre` | + 30 jours | aucune ; la preuve est gardée |
| `retour` | — | « la paire revient » (notification `livraison`) |

### 4.4 La paire, entre les plateformes (la machine qui manquait pour la N°553)

Ce n'est pas une nouvelle notion : c'est `doublesVenteEbay` (existe), exécutée
**côté serveur** et **à chaque évènement de vente**, quelle que soit la
plateforme. Entrées, toutes par identité :
- vendue sur Vinted : transaction → `item_id`, **et désormais aussi** la ligne
  de bordereau `harvest_{uid}_label_{tx}.item` (chantier A) ;
- vendue sur eBay : commande → SKU `VRM-{n°}` ;
- vendue sur Leboncoin : la règle `doublesVenteLbc` (existe).

Sorties : « à retirer d'eBay » (geste si allumé), « retire-la de Vinted »
(notification seulement, §3), « vendue deux fois — annule une des ventes »
(notification). « Pas su » sur une seule source ⇒ **aucune** sortie à ce
passage.

---

## 5. Les données

### 5.1 Dans `app_data`, par vendeur et par compte eBay (`{s}` = suffixe du compte)

Lisibles par l'app (règles d'accès existantes), **écrites par le serveur
seulement** (garde de 5.3).

| ligne | contenu | taille | lue par l'app |
|---|---|---|---|
| `ebay_agent_cmd{s}_{orderId}` | une par commande. Scalaires de premier niveau (copiés dans `meta` par la base, donc listables sans lire `data`) : `etat`, `rang`, `numero`, `orderId`, `etiquette`, `limite` (`shipByDate`), `prochain`, `majAt`, `version`. En dessous : `transitions` (les 20 dernières : de, vers, source, date, preuve), `bordereau` {fournisseur, idEnvoi, suivi, transporteur, prixCentimes, chemin du PDF, achete, annule}, `ebay` {fulfillmentId}, `colis` {étape, dernier évènement (code, date), date limite de retrait}, `preuveLivraison`, `messages` {type: date}, `notifie` {type: date} | **≤ 2 Ko** | `select=id,etat:meta->>etat,numero:meta->>numero,…` (§4.4 : jamais `select=data` en liste), par `lireTout` (§4.5 : au-delà de 1 000 lignes Supabase coupe sans le dire) |
| `ebay_agent_journal` | une par vendeur : les **300** derniers gestes faits en son nom (section 8.1) | ≤ 60 Ko | à l'ouverture de « Ce que VRM a fait en ton nom » |
| `ebay_agent_pouls` | une par vendeur : dernier passage, dernier succès, dernière erreur (un code, jamais un texte brut d'eBay), compteurs du jour, `arrete` (raison), mode (`repetition` jusqu'au …) | < 1 Ko | Compte eBay, Ma journée |
| `ebay_agent_reglages` | une par vendeur : les interrupteurs, plafonds, textes des messages, fenêtre d'achat, colis type — **écrite par la route** `agent-regler`, bornée par le serveur | < 4 Ko | Réglages → eBay |

**Ce qui n'est jamais rangé** : l'adresse, le nom, le téléphone, l'email de
l'acheteur. L'adresse est lue chez eBay **au moment d'acheter**, passée à
l'agrégateur, et oubliée. Le pseudo de l'acheteur reste là où il est déjà
(`commandeMinimale`, spec `socle` §3.3), parce qu'il faut pour lui écrire.
Le nom du point relais n'est pas gardé non plus : il dit où vit l'acheteur.

**À l'échelle** : 1 300 comptes × 1 vente par jour × 2 Ko ≈ 80 Mo par mois. Une
commande `close` depuis 90 jours est compactée (état, dates, N°, montant ;
transitions retirées), jamais supprimée sans trace.

### 5.2 Six petites tables « serveur seulement »

Règles d'accès activées et **aucune** règle, comme `vrm_reglages` (mesuré :
c'est le modèle existant). Un verrou, un compteur d'argent et une clé ne
doivent jamais être modifiables par un navigateur.

| table | rôle |
|---|---|
| `vrm_agent_file (owner, cle, prochain, bail_jeton, bail_jusqua, essais)` | la file de travail **et** les verrous |
| `vrm_agent_compteurs (owner, cle, n, centimes)` | plafonds d'argent, plafonds de messages, quota eBay global (`owner = 00000000-…`) |
| `vrm_agent_vus (cle, vu_le)` | les évènements déjà reçus (`notificationId`, identifiant d'évènement de l'agrégateur), purgés après 7 jours |
| `vrm_agent_routes (k, owner, compte, fournisseur, secret_chiffre, cree, revoque)` | les adresses opaques des destinations (eBay, transporteurs) |
| `vrm_agent_horloge (id, dernier_tic)` | le pouls de `pg_cron` |
| `vrm_coffre (owner, compte, fournisseur, v, nonce, chiffre, tag, maj)` | les clés de l'agrégateur, **puis** les jetons eBay et le jeton d'accès gardé 1 h 50 — chiffrés par le serveur (AES-256-GCM, clé `VRM_COFFRE_CLE` sur Vercel, données associées `owner\|compte\|fournisseur\|v` : une valeur recopiée chez un autre vendeur ne se déchiffre pas) — `infra.md` §6.1 |

### 5.3 Le navigateur ne peut pas écrire la mémoire de l'agent

Un déclencheur `BEFORE INSERT OR UPDATE OR DELETE` sur `app_data` refuse toute
écriture d'un rôle `authenticated` ou `anon` sur les identifiants
`ebay_agent\_%` et `ebay_tokens%`. Le rôle se lit comme le fait déjà
`sauvegarde.noter_ecriture` (`coalesce(auth.role(), current_user)`, mesuré).
Précédent : les gardes de la migration 013. Sans lui, un vendeur pourrait
fabriquer une commande « bordereau à acheter » ; avec lui, il ne peut que lire.

---

## 6. Les routes : aucune nouvelle fonction

Le plafond est de 12 fonctions, et il est atteint (mesuré). Tout est un
**mode** ou une **action** d'une fonction existante.

### 6.1 La porte des sonnettes : `api/compte.js` (initiative)

`api/compte.js` lit déjà le **corps brut** (`bodyParser: false`, `corpsBrut()`,
pour le webhook Stripe — code lu). Or vérifier une signature exige le corps
brut. Plutôt que de basculer `api/ebay.js` en corps brut (ce qui obligerait à
réécrire la lecture de ses 20 actions et de tous ses bancs, spec `socle` §8),
**toutes les sonnettes signées arrivent par `api/compte.js`** :

| adresse publique (`vercel.json`) | réécrite vers | rôle |
|---|---|---|
| `/api/ebay-notif/:k` | `/api/compte?mode=ebay-notif&k=:k` | E1–E3 |
| `/api/ebay-deletion` | `/api/compte?mode=ebay-deletion` (**déplacée** ; l'adresse publique ne change pas, donc rien à refaire chez eBay ni dans `EBAY_DELETION_URL`) | E4 |
| `/api/transporteur/:k` | `/api/compte?mode=transporteur&k=:k` | E6, E7 |
| `/api/stripe-webhook` | `/api/compte?mode=webhook` (existe) | — |

La logique vit dans des bibliothèques (`api/_lib/agent-ebay.js`,
`api/_lib/agent-evenements.js`), pas dans `compte.js`.

### 6.2 Le battement : `api/ship-reminders.js?mode=battement`

`POST`, `Authorization: Bearer <VRM_BATTEMENT_SECRET>` comparé en temps
constant. Il a déjà la boucle par vendeur et `contexteVendeur` (code lu).
Déroulé (`infra.md` §3.3) : interrupteur d'installation · anti-rafale 20 s ·
`vrm_agent_prendre(8, jeton, bail 120 s)` · 8 tâches en parallèle, au plus 2
par vendeur · 25 s de travail · réponse avec des **nombres seulement**.

### 6.3 Les actions de l'app : `api/ebay.js` (session exigée)

| action | portée | geste | garde avant tout appel |
|---|---|---|---|
| `agent-etat` | vendeur | lit pouls, réglages, compteurs du jour, ce que l'agent sait faire pour lui | — |
| `agent-regler` | vendeur | écrit `ebay_agent_reglages` | `confirme:true` pour tout ce qui allume un geste ; bornes du serveur ; « pas su » de l'abonnement ⇒ on range, on n'allume pas |
| `agent-pause` / `agent-reprendre` | vendeur | le gros bouton | effet au battement suivant |
| `agent-journal` | vendeur | lit le journal | — |
| `coffre-poser` / `coffre-tester` / `coffre-retirer` | vendeur + fournisseur | range une clé chiffrée ; teste par une **lecture** inoffensive chez l'agrégateur | la clé ne revient **jamais** au navigateur |
| `devis` | compte | demande un prix pour une commande | relit la commande chez eBay |
| `bordereau-acheter` | compte | le bouton « confirmer » du mode *préparer, je confirme* | `confirme:true`, `prixVu` ; un devis plus cher que vu ⇒ 409 |
| `bordereau-annuler` | compte | annule une étiquette VRM | `confirme:true` ; relit l'envoi |
| `bordereau-pdf` | compte | rend le PDF (ou une adresse signée du stockage, 60 s) | la commande est à ce vendeur |
| `expedier` | compte | un suivi **tapé** (spec `expedier` §4.3) | `confirme:true` |
| `message-preparer` / `message-envoyer` | compte | prépare / envoie un message à l'acheteur | contrôle du texte rendu (10.3) |
| `veiller` | vendeur | appelée par l'extension (E8) | session de l'extension ; 1 passage / 5 min |

Toutes passent par le `resoudreCompte` existant : un compte d'un autre vendeur
ne désigne rien.

---

## 7. Verrous, idempotence, trois états

### 7.1 Le verrou

- **Une tâche, un bail.** `vrm_agent_prendre` pose le bail (`for update skip
  locked` : deux battements ne prennent jamais la même tâche). Un bail expiré
  (2 min) se reprend **depuis le dernier état écrit**.
- **Une écriture d'état, une version.** `vrm_agent_ecrire(owner, id, jeton,
  version_attendue, data)` n'écrit que si le bail porte encore ce jeton et si la
  version est celle qu'on a lue ; sinon **0 ligne**, et on relit. Le contrôle est
  fait **par la base**, dans la même transaction (`infra.md` §4.4).
- **Une requête en vol par compte eBay**, par politesse et pour le quota.
- **Le journal s'écrit en une instruction SQL** (concaténation, puis on garde
  les 300 dernières) : deux battements ne perdent jamais une entrée.

### 7.2 L'idempotence, geste par geste

| geste | ce qui empêche de le faire deux fois | coupure en plein milieu |
|---|---|---|
| **acheter un bordereau** | état `bordereau_en_cours` écrit **avant** l'appel, sous le bail ; référence chez l'agrégateur = `orderId` (`externalId` chez Boxtal ; Sendcloud rend ses créations idempotentes par `external_reference_id` — extrait du support Sendcloud) ; plafond réservé avant | `bordereau_incertain` : relire chez l'agrégateur par la référence. Boxtal : une recherche par `externalId` n'est **pas** établie **[à vérifier]** ⇒ tant qu'elle n'est pas mesurée, un incertain chez Boxtal **ne se rachète jamais seul** : notification « je ne sais pas si le bordereau de la N°412 a été acheté — regarde dans Boxtal » |
| **déclarer le suivi à eBay** | `getShippingFulfillments` relu avant : un envoi au **même** numéro ⇒ c'est fait ; un envoi à un **autre** numéro ⇒ on ne déclare pas, on alerte (deux bordereaux pour une commande) | `declaration_incertaine` : relire ; le numéro est l'identité |
| **annuler un bordereau** | l'état porte `annule` ; relire l'envoi avant | relire ; un 400 de Boxtal veut dire « plus annulable » (extrait officiel du guide « cancelling order v3 ») |
| **retirer une annonce eBay** | mémo `ebay_retraits_tentes` écrit **avant**, vérifié (spec `retrait-serveur` §3.1) ; SKU relu chez eBay | `incertain`, dit dans le journal ; jamais retenté dans les 24 h |
| **écrire à l'acheteur** | `messages[type]` écrit **avant** l'envoi, sous le bail, écriture vérifiée | « incertain — regarde ta messagerie eBay » ; **jamais renvoyé** |
| **notifier ton téléphone** | `notifie[type]` écrit avant, sous le bail | au pire une notification manquée, jamais deux |
| **baisser un prix** | l'ancien prix et la date sont dans l'état de l'annonce ; −5 % par semaine au plus | relire le prix chez eBay |

### 7.3 Les trois états de chaque entrée d'une décision

`undefined` = en cours · `null` = **pas su** · une valeur = lu. **« Pas su »
n'agit jamais**, et ne prévient que s'il bloque une obligation (une date limite
d'envoi qui approche), jamais à chaque hoquet.

| entrée | si « pas su » |
|---|---|
| la commande chez eBay | rien ; repli |
| la politique d'étiquette (`ShippingLabelPolicy`) | **pas d'achat** (on ne sait pas si eBay impose la sienne) ; la carte dit « achète le bordereau dans eBay » |
| le point relais choisi par l'acheteur | **pas d'achat** en relais ; jamais un relais « deviné » à partir d'une adresse |
| le poids | pas d'achat |
| ton abonnement (`vrm_acces_pour`) | les **lectures** continuent ; tout ce qui coûte ou ne se défait pas attend un `true` |
| tes réglages | éteint |
| tes plafonds (réservation) | pas d'achat |
| la preuve de vente Vinted (une source illisible) | aucun retrait, aucune alerte de double vente à ce passage |
| le mémo d'un message | aucun message |
| l'étape du colis | aucune alerte « bloqué », aucun message |
| le quota eBay du jour | les obligations passent, le reste attend |

---

## 8. Le journal, le pouls, les notifications

### 8.1 « Ce que VRM a fait en ton nom »

Chaque entrée : **quand**, **compte eBay**, **commande ou annonce**, **N°**,
**geste**, **résultat** (`fait` · `incertain` · `refusé par eBay` ·
`répétition — j'aurais…`), **montant** en centimes pour ce qui coûte,
**référence** (identifiant d'envoi, `fulfillmentId`), **texte exact** d'un
message envoyé, et un **bouton** quand le geste se défait (« annuler ce
bordereau », « remettre l'ancien prix »).

Où : eBay → Compte (la liste complète), et **une ligne** dans Ma journée quand
quelque chose est parti aujourd'hui (« 3 gestes faits en ton nom aujourd'hui —
les relire »). Un geste fait à ta place que tu ne peux pas relire serait le pire
de tout.

### 8.2 Le pouls

« L'agent a tourné il y a 2 min · 4 commandes en cours · mode réel depuis le
18/10 ». Ou, en gris : « en pause (ton choix) », « arrêté : abonnement »,
« arrêté : reconnecte {pseudo} », « l'horloge ne bat plus depuis 40 min ». Jamais
un faux vert : « pas su » est gris.

### 8.3 Les notifications sur ton téléphone

Toujours dans `contexteVendeur.run({owner})` : `sendPushToAll` ne lit que
**ses** appareils, et se tait si l'abonnement est coupé (existe).

| catégorie | par défaut | ce qu'elle porte |
|---|---|---|
| `vente` (existe) | allumée | « Vendu sur eBay — N°301 · 89 € · à poster avant jeudi » |
| `double` (nouvelle) | **allumée** | vendue ailleurs et encore en vente ici ; retirée automatiquement ; vendue deux fois |
| `expedier` (existe) | allumée | date limite demain ; bordereau prêt à imprimer ; sans scan depuis 48 h |
| `livraison` (nouvelle) | **allumée** | colis bloqué, problème, retour, pas retiré au relais |
| `agent` (nouvelle) | **allumée** | ce que l'agent attend de toi (« confirme ce bordereau », « je ne sais pas si… ») et son état (horloge arrêtée, compte refusé) |
| `suivi` (existe) | **éteinte** | en transit, livré (rien à faire, comme pour Vinted) |

`PUSH_CATS` (app) et `PUSH_DEFAUT` (serveur) restent identiques :
`audit-bilan-semaine.cjs` les compare déjà.

---

## 9. Les bordereaux

### 9.1 Ce qui a changé depuis le 9 octobre, et ce qui n'a pas changé

- **Toujours vrai : eBay ne vend aucune étiquette par API en France.** Sa
  Logistics API ne fait que l'USPS, depuis les États-Unis, pour des
  partenaires approuvés (extrait officiel, code du SDK lu ; `bordereaux.md` §1).
  Une « Labels API » annoncée pour fin 2026 viserait des transporteurs
  britanniques **[à vérifier]**.
- **Ce qui ne tient plus : « envoyer un suivi automatiquement est impossible
  faute d'identité commune ».** C'était vrai d'un bordereau capté dans un email.
  **Quand c'est VRM qui achète le bordereau pour CETTE commande**, la référence
  posée chez l'agrégateur **est** l'`orderId` : le numéro de suivi rendu est
  connu par identité, et se déclare à eBay sans rien deviner.
- **Le point qui décide de tout, et qui n'est pas mesuré** : depuis juin 2026
  une ligne de commande peut porter `ShippingLabelPolicy = EBAY_ONLY` (« doit
  partir avec une étiquette fournie par eBay »), renvoyé à partir du niveau
  Trading **1455** (extrait officiel, notes de version). VRM appelle Trading au
  niveau **1149** (mesuré, `api/ebay.js:146`). ⇒ **Le premier pas est de lire ce
  champ**, sur `GetOrders` seulement : monter le niveau de **tous** les appels
  pourrait changer la forme d'autres réponses (`GetMyeBaySelling`, `GetItem`)
  que VRM lit déjà — on ne change que l'appel qui en a besoin.

### 9.2 L'arbre de décision, par commande

```
commande payée, qualifiée
├─ authentification d'eBay (program.authenticityVerification)      → AUCUN achat : la paire part chez
│                                                                     l'authentificateur, l'adresse est dans eBay
├─ ShippingLabelPolicy = EBAY_ONLY                                 → AUCUN achat ailleurs (tu paierais deux fois)
│                                                                     → « Acheter le bordereau dans eBay » (1 bouton)
├─ ShippingLabelPolicy « pas su » (lecture ratée, ou niveau < 1455) → comme EBAY_ONLY (le sens sûr)
│    (lue au niveau 1455 et ABSENTE ⇒ aucune règle ne s'applique : étiquette libre — extrait officiel)
├─ annulation demandée                                             → AUCUN achat ; « Ne poste pas »
└─ étiquette libre
   ├─ réglage « bordereaux » = non                                 → 1 bouton « acheter dans eBay »
   ├─ pas de clé agrégateur valide pour CE vendeur                 → idem, + « relie Boxtal pour que VRM l'achète »
   ├─ service payé en RELAIS et point lisible par identité ? non   → AUCUN achat ; « achète-le dans eBay, le point
   │                                                                  y est déjà » (un colis au mauvais relais est perdu)
   ├─ poids pas su                                                 → AUCUN achat ; « règle ton colis type »
   ├─ devis > plafond par étiquette, ou plafond du jour/mois atteint → « à confirmer », avec le prix
   └─ tout est su
      ├─ mode « préparer, je confirme »                            → notification + 1 bouton qui montre prix, transporteur,
      │                                                               ville (jamais l'adresse), poids, N° du carton
      └─ mode « acheter seul »                                     → achat (ou « j'aurais acheté » en répétition)
```

⚠️ **Ce que ça veut dire pour toi, franchement** : ton compte particulier est
celui où eBay refuse tout mode de livraison venant de VRM (mesuré le 27
septembre). Il est **probable** que tes ventes portent `EBAY_ONLY`. Si c'est le
cas, l'agent fera **tout sauf l'achat du bordereau**, qui restera un bouton
d'eBay — et c'est aussi le moins cher (Mondial Relay acheté dans eBay : 3,58 €
jusqu'à 1 kg, grille relevée le 3 octobre, secondaire). L'achat par VRM servira
à ton compte pro et aux autres revendeurs. **Ta prochaine vente eBay le dira.**

### 9.3 Le prestataire

| | décision | pourquoi |
|---|---|---|
| **Boxtal (API v3)** | **le premier** | achat 100 % par l'API avec prélèvement différé ; une application par vendeur (ses clés) ; webhooks signés `TRACKING_CHANGED` / `DOCUMENT_CREATED` qui ne reçoivent que les envois créés par la même application ; bac à sable qui ne facture rien ; annulation par `DELETE /v3.1/shipping-order/{id}`, refusée par un 400 quand ce n'est plus possible (extraits officiels ; `bordereaux.md` §2.3). Exige une facturation au nom d'une **entreprise** (SIRET) |
| **Sendcloud** | **le second** | modèle « décentralisé » documenté (chaque vendeur autorise VRM, Sendcloud le facture) ; OAuth2 en bêta ; idempotence par `external_reference_id` (extraits officiels). Numéro de TVA peut-être exigé **[à vérifier]** |
| Packlink PRO | repli « à moitié » | l'envoi se paie **dans** Packlink ; annulation par ticket au support (extraits officiels) |
| transporteurs en direct | écartés | un contrat et plusieurs secrets par transporteur et par vendeur ; le web service Colissimo est réservé au contrat Privilège |

⚠️ **Un piège à éviter** : Sendcloud a sa **propre** intégration eBay, qui
importe les commandes et renvoie le numéro de suivi à eBay (extrait de la page
Sendcloud « intégration eBay », qui précise aussi que ses emails de suivi sont
**désactivés pour eBay** « en raison de la politique d'eBay »). Un vendeur qui
brancherait cette intégration **et** l'agent de VRM aurait deux systèmes qui
achètent et déclarent. ⇒ Avant d'acheter, l'agent relit
`getShippingFulfillments` : un envoi déjà déclaré ⇒ il n'achète pas. Et la page
d'onboarding le dit.

### 9.4 L'achat, pas à pas (tâche `cmd:{orderId}`, sous le bail)

1. **Relire la commande chez eBay**, avec le jeton du compte : `PAID`, pas
   `FULFILLED`, `getShippingFulfillments` **vide**, aucune demande
   d'annulation, politique d'étiquette lue et ≠ `EBAY_ONLY`, pas
   d'authentification. Un `orderId` d'un autre vendeur rend une erreur chez eBay :
   le serveur ne croit jamais la base modifiable par un navigateur.
2. **Lire l'adresse** (`fulfillmentStartInstructions.shippingStep.shipTo`) en
   mémoire seulement. Le service payé par l'acheteur dit relais ou domicile.
3. **Devis** chez l'agrégateur (Boxtal : les devis passent par l'API v1, la v3
   n'en a pas encore — code lu, secondaire) avec le poids et les dimensions.
   Le transporteur est **ton** choix par mode (Réglages : « en relais, Mondial
   Relay ; à domicile, Colissimo »), jamais « le moins cher » en silence : un
   relais d'un autre réseau ne correspond pas au point choisi.
4. **Réserver le plafond** en une instruction (`vrm_agent_reserver` : par
   étiquette, par jour en nombre et en euros, par mois). Refus ⇒ « à confirmer ».
5. **Écrire `bordereau_en_cours`** (avec le prix du devis), **puis** acheter
   (`POST /v3.1/shipping-order`, `externalId = orderId`, code du point relais si
   relais, format d'impression selon ton imprimante).
6. **Ranger** suivi, transporteur, identifiant d'envoi, prix ; **rendre** la
   réservation si l'agrégateur a **refusé** (jamais si l'issue est incertaine :
   une coupure après sa réponse a pu être facturée — même règle que le
   détourage).
7. **PDF** : au webhook `DOCUMENT_CREATED`, ou relu (juste après la commande,
   Boxtal répond `422 UnexpectedException` au lieu de « pas encore prête » : ce
   n'est **pas** un échec, code lu). Téléchargé **seulement** chez l'hôte de
   l'agrégateur (liste blanche, comme `pdfBordereauLbc`), vérifié `%PDF`, rangé
   dans le stockage de fichiers (chantier « PDF dans le stockage », en cours ;
   à défaut une ligne `ebay_bord{s}_{orderId}` lue par `lirePdfLigne`, le lecteur
   à trois états qui existe).
8. **Déclarer le suivi à eBay** (9.7).
9. **Notifier** « bordereau prêt à imprimer : N°412 » ; **journal** ;
   échéance « sans scan » à + 48 h.

### 9.5 Quand acheter : la fenêtre (initiative)

Acheter à 21 h 41 une étiquette que l'acheteur annule à 21 h 50, c'est de
l'argent bloqué et un remboursement à attendre. Deux réglages :
- **au plus tôt 1 h après le paiement** (les annulations de dernière minute)
  **[à vérifier : le délai d'annulation par l'acheteur sur eBay.fr]** ;
- **ta fenêtre** : « dès que possible » (de 7 h à 21 h) ou « par lots, à 7 h et à
  13 h » — tes étiquettes arrivent ensemble, quand tu prépares tes colis.

Et toujours **au plus tard** `shipByDate − 24 h` : si l'achat n'a pas pu se
faire (plafond, « pas su »), la notification « date limite demain » part avec la
raison.

### 9.6 Imprimer : comme les bordereaux Vinted

- Le PDF est rangé **brut**. Il est tamponné **au moment d'imprimer**, dans le
  navigateur, par **le même code** que Vinted (`annotateAndDownloadBordereau`,
  titre + N° en petit en bas ; mesuré dans `main`). Une seule règle (§11).
- **A4 classique** : une feuille par bordereau, recto-verso coupé
  (`posePrefsImpression`, existe).
- **Thermique 10 × 15** : l'agent demande à l'agrégateur le format thermique
  quand ton réglage `vrm_imprimante` vaut « thermique » (le format thermique
  existe chez Boxtal, avec un repli A4 si le transporteur n'en a pas — extrait
  officiel, liste par transporteur **[à vérifier]**). Un PDF qui n'est pas déjà
  en 10 × 15 passe par `zoneEtiquette` (existe), et **quand on ne sait pas
  découper, la page part entière** (la règle existante : une zone devinée de
  travers coupe le code-barres).
- Les étiquettes eBay entrent dans **Colis** par les groupes qui existent :
  **Prêts à imprimer** (le `pret` est porté par la ligne, propriétaire unique,
  §5) · **En attente de leur bordereau** · **Bordereau dans eBay** (nouveau,
  spec `expedier` §4.1) · **Ne poste pas**.
- **Pour une étiquette achetée dans eBay** (que VRM ne voit pas) : VRM imprime à
  côté une **fiche carton** (N°, titre, photo, n° de commande), en A6 ou 10 × 15,
  à glisser dans le colis ou à coller sur le carton. Et, plus tard, « dépose ici
  le PDF d'eBay » : VRM le tamponne **seulement si** le numéro de suivi lu dans
  le PDF est exactement celui qu'eBay a mis sur la commande — sinon il refuse.
  Le numéro est l'identité ; un PDF déposé par erreur ne reçoit jamais le N°
  d'une autre paire.

### 9.7 Le suivi poussé à eBay, par identité

- `POST /sell/fulfillment/v1/order/{orderId}/shipping_fulfillment` avec
  `{ lineItems:[{lineItemId, quantity}], shippedDate, shippingCarrierCode,
  trackingNumber }` (extrait officiel ; portée `sell.fulfillment`, déjà accordée).
  Le numéro est en majuscules, sans espace ni tiret.
- **Quand** : tout de suite après l'achat. La « validation des informations de
  suivi » d'eBay compte un suivi chargé dans le délai d'expédition (extraits
  officiels, aide eBay.fr) ; le charger tôt est la protection n°1.
- **Le code transporteur n'est jamais écrit en dur** : la liste vient de
  `get_shipping_carriers` (Metadata API, `EBAY_FR`), lue au premier branchement
  et gardée. Les sources se contredisent sur Colissimo et Mondial Relay
  (`bordereaux.md` §3.3). Transporteur absent de la liste ⇒ **on ne déclare
  pas** (jamais `Other`) et on le dit.
- **Jamais deux déclarations** : 7.2.

### 9.8 Annuler une étiquette inutile

| cas | ce que fait l'agent |
|---|---|
| commande **définitivement** annulée (`CANCELED`), étiquette VRM, aucun scan, achat seul allumé | **annule** (`DELETE …/shipping-order/{id}`) ; journal « remboursement attendu » ; un 400 ⇒ « plus annulable », dit |
| annulation **demandée** (pas tranchée) | **propose** l'annulation (ton clic) ; « Ne poste pas » |
| deux bordereaux pour une commande (le tien acheté dans eBay, et celui de VRM) | **propose** (ton clic) : VRM ne sait pas lequel tu as collé sur le carton |
| colis déjà scanné | jamais |

### 9.9 Le poids

VRM n'en connaît aucun (mesuré : 0 champ de poids ou de taille de colis,
`bordereaux.md` §4). Trois niveaux, jamais deviné en silence :
1. **ton colis type** (réglage) : 1,5 kg et 36 × 24 × 14 cm par défaut — un
   ordre de grandeur pour une boîte de baskets, à confirmer par ta balance ;
2. **une correction par paire** (« bottes : 2,2 kg »), rangée avec la paire
   comme le prix d'achat ;
3. rien de réglé ⇒ **pas d'achat**.

Le devis fait foi, jamais un prix calculé par VRM (poids volumétrique,
régularisations après coup **[à vérifier chez Boxtal]**). La confirmation et le
journal montrent le poids utilisé.

### 9.10 L'argent du bordereau

- **VRM ne paie jamais un bordereau.** C'est **ton** compte Boxtal, **ton**
  prélèvement. VRM n'avance rien, ne refacture rien, n'est pas revendeur de
  transport.
- Les plafonds par défaut (à confirmer avec toi) : **12 € par étiquette ;
  10 étiquettes et 80 € par jour ; 300 € par mois**. Le serveur borne ce que tu
  règles : **25 € par étiquette, 40 par jour, 2 000 € par mois** au plus (un
  réglage au-delà est ramené au maximum, et l'écran le dit).
- Le coût du bordereau entre dans la marge de la vente (il apparaît sur la vente
  eBay, à côté des frais d'eBay).

---

## 10. Le suivi jusqu'au client, les messages, l'évaluation

### 10.1 Qui dit où est le colis

| bordereau acheté… | numéro connu par | étapes lues chez |
|---|---|---|
| par VRM (agrégateur) | la réponse de l'achat (identité) | le **webhook** de l'agrégateur (E6) ; relecture selon l'étape (3.4) |
| dans eBay | `getShippingFulfillments` de **cette** commande, après E2 (identité) | **La Poste « Suivi v2 »** pour Colissimo, Chronopost et Lettre suivie (une clé gratuite, une seule pour l'installation : elle ne lit que des numéros, pas un compte — `suivi.md` §2.1) ; **Mondial Relay** : pas d'API publique sans contrat pro ⇒ « pas su » tant qu'aucun accès n'existe |
| les deux | + un **témoin gratuit** : la ligne `email_track_*` dont le numéro est **exactement** le même (mesuré : les transporteurs t'écrivent aussi en tant qu'expéditeur ; 15 « livrés » Chronopost reliés ainsi à des bordereaux Vinted, `suivi.md` §1) | |

⚠️ **eBay ne dit jamais « livré » au vendeur** par son API, pour une commande
normale (`ActualDeliveryTime` « no longer applicable », extrait officiel,
`suivi.md` §3.2). La livraison se lit chez le transporteur.

⚠️ **Mondial Relay est ton transporteur n°1** (110 emails de suivi sur 200,
mesuré) et le seul sans API publique. Pour un bordereau Mondial Relay acheté
**dans eBay**, l'agent ne saura que ce que dit l'email du transporteur (au même
numéro), ou rien. Il le dit (« suivi pas lu : Mondial Relay, pas d'accès
direct ») ; il n'invente jamais une étape. Un service de suivi payant (AfterShip,
TrackingMore) le couvrirait, au prix d'un sous-traitant de données de plus et
d'une mise à jour de la politique de confidentialité — **à toi de décider**.

### 10.2 Les messages à l'acheteur

**Canal** : Trading `AddMemberMessageAAQToPartner`, jusqu'à **90 jours** après
la commande, avec le jeton que VRM a déjà ; le message arrive dans la messagerie
eBay de l'acheteur (extraits officiels, `suivi.md` §4.1). La Message API REST
demanderait une reconnexion, et sa disponibilité sur eBay.fr n'est pas confirmée.

**Les règles d'eBay qui bornent tout** (extraits officiels) : aucun lien, aucune
adresse email, aucun téléphone, rien qui mène hors d'eBay ; ne jamais exiger
une évaluation positive ni rien offrir en échange. Et eBay prévient **déjà**
l'acheteur de l'envoi, avec le suivi : un message qui le répète est du bruit.

| message | moment | mode |
|---|---|---|
| « Merci pour votre achat » | à `payee`, si le délai d'expédition est connu (sinon la phrase du délai est retirée, jamais inventée) | réglage **éteint** |
| « Votre colis est parti » | — | **jamais** (eBay le fait) |
| « Votre colis vous attend au point relais jusqu'au {date} » | **2 jours avant** la date limite, s'il n'est pas retiré, **seulement si la date limite est connue** par le transporteur | réglage **éteint** — c'est celui que je te conseille d'allumer en premier : il évite des colis non réclamés, donc des remboursements |
| « {Transporteur} indique une livraison le {date} » (+ une phrase facultative et neutre sur l'évaluation, second interrupteur) | à `livre` | réglage **éteint** |
| « Problème de transport » | à `probleme` | **préparé**, envoyé sur **ton clic** : ce qu'on y dit t'engage |
| Paire à l'authentification | — | **aucun** message de transport |

Textes : ceux de `suivi.md` §4.4, vouvoiement, modifiables, sans N° de carton.

### 10.3 Le contrôle avant chaque envoi

Sur le texte **rendu** (variables remplies), pas sur le gabarit : refusé s'il
contient une adresse web, un email, une suite de 9 chiffres ou plus qui n'est pas
le numéro de suivi de la commande, ou une accolade `{` (variable non remplie).
Puis : réglage relu, plafond réservé (20 par jour et par compte eBay, 3 par
commande), mémo écrit **avant** et vérifié, jeton **du compte de la commande**,
moins de 90 jours. Coupure ⇒ « incertain », jamais renvoyé.

### 10.4 L'évaluation

- **Ma recommandation : le réglage natif d'eBay** (« Automatiser les
  évaluations », dans tes préférences de vente) : eBay le fait, sans appel ni
  risque (extrait officiel, aide eBay.co.uk ; `suivi.md` §4.3).
- La version VRM n'a qu'un intérêt : le déclencheur **« après livraison
  confirmée par le transporteur »**, qu'eBay n'a pas. Réglage éteint, ton texte,
  `LeaveFeedback` en **positif seulement** (une évaluation ne se retire pas),
  mémo avant, `GetItemsAwaitingFeedback` lu d'abord (pas de doublon avec le
  réglage natif) — spec `litiges` §2.4.
- **Jamais** de rappel d'évaluation à l'acheteur (eBay en envoie déjà un), jamais
  de réponse automatique à une évaluation.

---

## 11. Les initiatives (au-delà de la demande)

Chacune dit **ce qu'elle fait**, **ce qui la déclenche**, **sa garde**, et **son
mode par défaut**. Je les classe par ce qu'elles t'évitent de perdre.

### 11.1 « La N°553 ne peut plus arriver » — l'anti double vente en temps réel

- **Le problème mesuré** : la preuve de vente Vinted ne lit que les lignes de
  transaction. Sur tes ventes des 7 derniers jours, **7 sur 14** en ont une ; la
  ligne de **bordereau** (`harvest_{uid}_label_{tx}.item`, l'identité
  transaction → annonce) en couvre **10 sur 14** ; **2** n'ont aucune identité
  (`etat.md` §3.3). La 553 a été publiée sur eBay **3 min 40 s après** sa vente
  Vinted, et rien ne l'a vue.
- **Ce que fait l'agent** :
  1. la preuve de vente lit **aussi** la ligne de bordereau (une règle, recopiée
     côté serveur, §11 du dossier) ;
  2. l'extension sonne le serveur dès qu'une vente Vinted est **rangée** (E8),
     et l'email de bordereau Vinted aussi (E9) ⇒ `vendeur:doubles` tourne dans
     la minute, VRM fermé ;
  3. **« Publier sur eBay » vérifie la fraîcheur** : si les ventes Vinted du
     compte de la paire ont été relues il y a plus de 15 minutes, le bouton le
     dit (« vérifie d'abord sur Vinted : je n'ai pas relu tes ventes depuis
     2 h ») ; une paire vendue **pas su** ne se publie pas.
- **Une décision à te faire prendre** : le retrait automatique écarte exprès une
  annonce eBay **plus récente** que la vente (« remise en vente voulue »,
  `ebay-apres-vente`). C'est exactement le cas de la 553, mais à l'envers. Le
  cas « la paire est revenue » est déjà couvert autrement (une **autre** annonce
  Vinted de ce N° en vente et pas vendue). **Je propose de retirer cette
  exception.** `audit-ebay-retrait-auto.cjs` passera au rouge sur ce contrôle :
  c'est une décision, pas un oubli.
- **Mode** : la preuve et l'alerte sont automatiques ; le retrait suit ton
  interrupteur (allumé chez toi depuis le 10 octobre).

### 11.2 « Date limite d'envoi » — ne jamais être en retard

- Échéances posées à la qualification : `shipByDate − 24 h` (« à poster demain »)
  et `shipByDate` 8 h (« à poster aujourd'hui »). Annulées toutes seules si le
  colis est scanné avant.
- Dans le rappel du matin, le widget et Ma journée, avec les ventes Vinted (une
  règle « à expédier », `aExpedierEbay` à côté d'`aExpedier`, spec `expedier`).
- **Automatique** (lecture).

### 11.3 « Colis bloqué » — avant que l'acheteur n'ouvre un litige

- Sans scan 48 h après le bordereau ; aucun évènement depuis 5 jours ouvrés en
  transit ; date de livraison estimée maximale + 3 jours ouvrés dépassée ; pas
  retiré au relais à la date limite.
- Alerte (`livraison`), message « problème » **préparé** (ton clic), et la
  **preuve de livraison** gardée sur la vente pour un litige « objet non reçu ».
- **Automatique** (lecture) ; le message, ton clic.

### 11.4 « Les paires qui dorment » — baisser le prix, jamais sous ton plancher

- **Déclencheur** : échéance hebdomadaire par annonce eBay en ligne depuis plus
  de `SLEEP_DAYS` (30) jours, sans vente.
- **Geste** : −5 % (réglable de 2 à 10 %), une fois par semaine au plus, par
  `ReviseInventoryStatus` (existe).
- **Gardes** :
  - jamais sous ton **plancher**, qui vaut le plus haut de : ton prix d'achat ×
    (1 + ta marge minimale), le plancher que tu as saisi sur la paire ;
  - **pas de plancher connu ⇒ pas de baisse.** ⚠️ Aujourd'hui **8 de tes 401
    paires** ont un prix d'achat (mesuré le 9 octobre) : ce réglage n'agira
    presque sur rien tant que tu ne les saisis pas — et l'écran le dira ;
  - jamais sous ou au niveau d'un **seuil de ta règle d'offre** (accepter
    au-dessus de X, refuser sous Y) : eBay refuserait, ou ta règle changerait de
    sens. L'agent **ne touche jamais** à ta règle d'offre ; il s'arrête et te le
    dit ;
  - une annonce avec des **observateurs** : l'agent propose plutôt l'offre aux
    observateurs (11.7), ton clic ;
  - le quota Trading passe après les obligations (section 12).
- **Défaire** : « remettre l'ancien prix » dans le journal.
- **Mode** : réglage **éteint**.

### 11.5 « La paire te revient » — la remettre en vente

- **Déclencheur** : une vente Vinted ou eBay de ce N° passe à un état qui la
  fait **revenir** (annulée avant envoi, remboursée, retour reçu — la règle
  `etatRevient` existe) **et** une annonce eBay de ce N° est en pause ou terminée
  sans vente.
- **Geste proposé** : « N°214 est revenue — remettre son annonce eBay en
  vente ? » ; vérification à blanc des frais d'abord (`VerifyRelistItem`).
- **Gardes** : la paire n'est en vente nulle part ailleurs ; aucune autre vente
  prouvée ; les frais lus (jamais supposés à 0).
- **Mode** : **ton clic**. Une remise en vente toute seule pourrait coûter des
  frais d'insertion ; et « revenue » sur Vinted ne dit pas toujours que la paire
  est physiquement dans ton carton.

### 11.6 « Une question d'un acheteur » — la réponse est prête quand tu ouvres l'app

- **Déclencheur** : E5 (après la liste blanche), sinon la veille.
- **Geste** : l'IA prépare une réponse (le mode `reply` de `/api/ai` existe, avec
  `plateforme:'ebay'`, spec `boite` §4.3) ; tu relis, tu envoies.
- **Gardes** : aucune réponse ne cite un prix ou une caractéristique que la
  fiche ne porte pas ; IA indisponible ⇒ « préparer » grisé avec la raison
  (⚠️ mesuré : aucune clé d'IA côté serveur aujourd'hui).
- **Mode** : **préparé tout seul, envoyé sur ton clic.** L'envoi automatique
  (comme ta décision « elle répond à tout » du 18 septembre pour **Vinted**) est
  un réglage à part, éteint, que je ne construirais qu'à ta demande — il
  porterait les mêmes gardes que Vinted (confiance de l'IA, jamais deux fois,
  plafond, journal).

### 11.7 « Des gens regardent ta paire » — l'offre aux observateurs

- **Déclencheur** : une paire qui dort avec au moins un observateur (le nombre
  est déjà lu).
- **Geste proposé** : « 3 personnes suivent la N°88 depuis 21 jours — leur
  proposer −10 % ? » (l'action `offre` existe).
- **Pourquoi ce n'est PAS automatique** : une offre envoyée, si un acheteur
  l'accepte, **vend la paire** à ce prix. C'est VRM qui fixerait un prix de
  vente ferme sans toi. Sur eBay, tu as permis **une seule** forme
  d'acceptation sans clic : le seuil natif, posé par toi (§3, 9 octobre). Je ne
  l'étends pas sans ta décision.
- **Mode** : **ton clic**.

### 11.8 « Ton niveau de vendeur eBay » — avant l'évaluation du 20

- **Déclencheur** : échéance mensuelle, le 15.
- **Geste** : lire `getSellerStandardsProfile` (taux de défauts, retards, suivi
  validé) et le dire en une ligne ; une alerte si un taux s'approche du seuil
  « insuffisant » (2 % de défauts, 0,3 % de litiges clos sans résolution —
  extraits officiels, aide eBay.fr).
- **Garde** : il faut la portée `sell.analytics.readonly` ⇒ la reconnexion `v2`
  (chantiers `litiges` + `visibilite`).
- **Mode** : automatique (lecture), après ta reconnexion.

### 11.9 « Mode répétition » — l'agent prouve qu'il a raison avant d'agir

- Pendant **7 jours** (ou tant que tu ne l'as pas validé), tout geste qui coûte
  ou ne se défait pas est **calculé et écrit** (« j'aurais acheté un bordereau
  Mondial Relay à 4,90 € pour N°214 »), **pas fait**. Les lectures, alertes et
  notifications marchent pour de vrai.
- **Mode** : **allumé par défaut** pour tout nouveau vendeur et tout nouveau
  geste.

### 11.10 « L'agent veille sur lui-même »

- L'horloge (`pg_cron`) qui ne bat plus depuis 30 min ⇒ notification au
  propriétaire de l'installation (le cron de 08:00 la vérifie).
- Un compte eBay refusé par eBay ⇒ notification « reconnecte {pseudo} », une fois
  par 7 jours.
- Un webhook transporteur muet alors que des colis sont en vol depuis 24 h ⇒
  passage en relecture (le filet), et une ligne dans le pouls.
- Le quota eBay du jour à 80 % ⇒ le « confort » s'arrête, les obligations
  continuent ; une ligne dans le pouls.

### 11.11 Les photos hébergées chez eBay

- **Le problème mesuré** : la N°553, publiée par VRM, a ses **16 photos** sur des
  adresses `images1.vinted.net` signées ; tes annonces faites à la main sont sur
  `i.ebayimg.com` (`etat.md` §2). Un lien Vinted qui expire laisserait une
  annonce eBay sans photo **[à vérifier]**.
- **Geste** : à la publication, copier les photos chez eBay
  (`UploadSiteHostedPictures`, spec `publier-lot` §4.3) ; l'agent repasse sur les
  annonces existantes dont une photo ne charge plus.
- **Mode** : automatique pour les nouvelles publications ; les anciennes, ton
  clic (une révision par annonce).

### 11.12 Ce que je n'ajoute pas, exprès

- **Les annonces sponsorisées** (mise en avant payante) : elles coûtent ; seulement
  si tu le demandes (spec `visibilite`, partie B).
- **Répondre à une évaluation négative** : jamais automatique.
- **Toucher Vinted** : jamais (§3).
- **Acheter une étiquette eBay en simulant des clics sur ebay.fr** : interdit
  (seulement l'API officielle), et un clic aveugle agit à côté quand la page
  bouge.

---

## 12. Plusieurs vendeurs, et la sécurité

Repris de `infra.md` §6 ; ce qui est **propre à cette conception** est en gras.

- **Chaque tâche porte son `owner`**, pris en base par `vrm_agent_prendre`,
  jamais reçu d'un navigateur ni d'une sonnette. Tout le travail tourne dans
  `contexteVendeur.run({owner})` ; toute lecture et écriture porte
  `owner=eq.` (`portee(owner)`, existe).
- Le compte eBay se valide contre le registre de **ce** vendeur
  (`resoudreCompte`) avant de prendre un jeton.
- **Chaque vendeur a ses clés d'agrégateur, chiffrées** (`vrm_coffre`), et ses
  **adresses de webhook opaques** (`vrm_agent_routes`). Un webhook signé avec le
  secret de A ne peut réveiller qu'une commande de A.
- **Le quota eBay est partagé par tous** (Trading : 5 000 appels par jour pour
  toute l'application, extrait officiel) : part équitable de 1 % par compte et
  par jour tant que la hausse n'est pas obtenue ; trois priorités
  (obligations · détection · confort) ; le bouton « ↻ Rafraîchir » passe sous le
  même compteur (`infra.md` §5).
- **Le jeton d'accès eBay est gardé 1 h 50, chiffré** — aujourd'hui VRM en
  redemande un à chaque action (mesuré), intenable à 1 000 vendeurs (50 000
  renouvellements par jour pour l'application, extrait officiel).
- **Abonnement coupé ⇒ l'agent s'arrête pour ce vendeur** (ni appel eBay, ni
  notification) ; « pas su » ⇒ les lectures continuent, rien ne coûte.
- **Fermer son compte VRM** efface aussi ses tâches, compteurs, routes et clés,
  et supprime ses abonnements de notification chez eBay **avant** d'effacer ses
  jetons.
- **Aucune donnée d'acheteur** dans `console.log`, dans le journal au-delà du
  texte d'un message que tu as allumé, ni dans les réponses du battement (que
  `pg_net` garde 6 h).
- **Le secret du battement** est à part (`VRM_BATTEMENT_SECRET`, pas
  `CRON_SECRET`) : il est lisible dans la file de `pg_net` par tout rôle qui se
  connecte à la base (doc Supabase lue). S'il fuit, on peut seulement déclencher
  des battements : idempotents, freinés, sans réponse utile.

---

## 13. Les chantiers, dans l'ordre

Chaque chantier est **utile seul**, livré et prouvé seul, et ne promet à l'écran
que ce qui est construit. Effort : **S** ≈ une demi-session, **M** ≈ une
session, **L** ≈ deux à trois sessions. Quand un chantier du 9 octobre tient
toujours, il est repris **tel quel** (sa spec fait foi) ; ce qui change est dit.

```
A (fusion + N°553) ──┬── B (socle + forme des commandes) ──┐
                     └── C (fondations de l'agent) ────────┴── D (oreille + veille)
                                                                ├── E (à expédier)   ┐
                                                                ├── F (retrait VRM fermé)
                                                                ├── argent (avant ta 1re vente eBay)
                                                                └── G (suivi du colis) ── H (bordereaux) ── I (messages)
                                                                                          J (litiges, visibilité,
                                                                                             annonces vivantes, initiatives)
```

| | chantier | ce que tu y gagnes | reprend | effort |
|---|---|---|---|---|
| **A** | **Fusion, puis « la 553 ne peut plus arriver »** | la branche « plusieurs comptes + règle d'offre » rejoint `main` (32 commits de retard, conflits connus dans `src/App.jsx` et `handleRetirer`) ; la preuve de vente lit aussi le bordereau ; « Publier sur eBay » vérifie la fraîcheur des ventes Vinted ; ta décision sur `ebay-apres-vente` | `etat.md` §5.5 ; 11.1 | M |
| **B** | **Socle**, plus la **forme des commandes** | la spec `socle` entière (trois états de connexion, commandes paginées, fusionnées et **sans adresse**, suppression de compte vérifiée, état exigé, portées rangées) ; **plus** : `GetOrders` au niveau 1455 **pour cet appel seulement**, qui range `ShippingLabelPolicy`, le service payé, l'authentification, et les **noms** des clés de l'adresse (jamais les valeurs) ; `get_shipping_carriers` et `get_shipping_services` pour `EBAY_FR` | spec `socle` | M–L |
| **C** | **Fondations de l'agent** | la migration (tables de 5.2, fonctions SQL de 7.1, garde d'écriture de 5.3, tâches `pg_cron`) ; le mode `battement` ; le pouls, le journal, les réglages par la route, les deux interrupteurs, le mode répétition ; le **jeton d'accès gardé 1 h 50** et le coffre ; le garde-quota | `infra.md` §3 à §6 | L |
| **D** | **L'oreille et la veille** | les sonnettes eBay par `api/compte.js` (E1 à E4, adresse par compte) ; la veille par date de modification ; les états 0 à 2 de la commande ; « Vendu sur eBay » sur ton téléphone ; la catégorie `double`. La veille marche **seule** (15 min) tant que l'abonnement aux notifications n'est pas possible | spec `veille`, **avec l'API Notification REST au lieu des Platform Notifications** (pas de liste blanche, vraie signature, `infra.md` §2.2) | M–L |
| **E** | **À expédier** | la vente eBay dans Colis, Ma journée, le widget, le rappel du matin ; « Ne poste pas » ; les échéances de la date limite (11.2) ; la fiche carton (9.6) | spec `expedier` | M |
| **F** | **Le retrait d'eBay, VRM fermé** | la même règle côté serveur ; l'extension sonne le serveur après une vente Vinted (E8) ; l'email de bordereau aussi (E9) | spec `retrait-serveur` | M |
| **argent** | **CA eBay = l'argent reçu** | à livrer **avant ta première vente eBay** (aujourd'hui : 0, mesuré) ; peut avancer en parallèle de E | spec `argent` | L |
| **G** | **Le suivi du colis** | `etapeColis`, une échelle ; relecture de l'envoi sur E2 ; La Poste « Suivi v2 » ; le témoin email au même numéro ; les échéances et alertes de 4.3 ; la preuve de livraison | `suivi.md` §6 | M–L |
| **H** | **Les bordereaux par l'agrégateur** | le coffre Boxtal (poser, tester) ; devis ; achat en mode « préparer, je confirme » ; webhook transporteur ; PDF ; déclaration du suivi à eBay ; annulation ; impression A4 et thermique ; **puis** « acheter seul », en répétition puis en réel | `bordereaux.md` §5, section 9 | L |
| **I** | **Les messages, les questions, l'évaluation** | les trois messages réglables, le message préparé, le contrôle du texte, les plafonds, le journal ; les réponses préparées aux questions ; l'évaluation « après livraison » | `suivi.md` §4 et §6.4, spec `boite` §4, spec `litiges` §2.4 | M |
| **J** | **Le reste de la feuille du 9 octobre, et les initiatives** | `litiges` + `visibilite` (une seule reconnexion `v2` ; 11.8) ; `annonces-vivantes` (pause, remise en vente, 11.5) ; les paires qui dorment (11.4) ; les photos chez eBay (11.11) ; `boite` (offres et questions) | specs du 9 oct. | L × 2 |

**Au total : environ 17 sessions**, dont une partie en parallèle (B et C ; puis
E, F, argent et G). **Ce qui change pour toi, chantier par chantier** :
après A, plus de double vente silencieuse ; après D, ton téléphone sonne VRM
fermé ; après E, tes ventes eBay sont dans ta journée ; après G, tu sais où est
chaque colis ; après H, Sarah n'a plus rien à faire entre la vente et
l'impression.

### 13.1 Les preuves (la méthode, pour chaque chantier)

Méthode §6.1 du dossier : l'arbre d'avant par `git archive HEAD | tar -x -C
/tmp/avN`, le script **copié dedans** et lancé **depuis** cet arbre ; rouge sur
le code d'avant ; vert après ; **et rouge sous mutation** du code d'après (« la
fonction n'existait pas » ne prouve rien). Un audit ne meurt pas, il rapporte
(`essaie()`).

| chantier | audit (le vrai code exécuté) | banc de rendu (données inventées, port réservé, 390 et 1 512 px, juge des `data-*` et ce qui part vers la route) | mutations qui doivent repasser au rouge |
|---|---|---|---|
| A | `audit-ebay-retrait-auto.cjs` étendu au **cas 553** (vente prouvée par le **bordereau seul**, annonce eBay créée 3 min après, aucune autre annonce Vinted du N°) | `ebay-annonces.cjs` : la 553 dans « à retirer », « Publier » grisé sur une paire aux ventes pas relues | la lecture du bordereau retirée |
| B | `audit-ebay-socle.cjs` (spec) + : seul `GetOrders` part au niveau 1455 ; aucune valeur d'adresse servie ne se retrouve dans une écriture | `ebay-socle.cjs` (4831) | `commandeMinimale` qui garde l'adresse ; niveau 1455 sur tous les appels |
| C | `audit-agent-base.cjs` sur un **vrai Postgres jetable** (comme `audit-renum-b.cjs`) : deux battements ne prennent jamais la même tâche ; un bail expiré se reprend ; une écriture au mauvais jeton ou à la mauvaise version rend 0 ligne ; un `authenticated` ne peut pas écrire `ebay_agent_…` ; 50 réservations simultanées ne dépassent jamais le plafond. `audit-agent-battement.cjs` (route dans un `vm`, deux vendeurs) | `ebay-agent-pouls.cjs` (**4841**) : pouls, pause, répétition, « pas su » gris | `skip locked` retiré (⇒ deux achats) ; version ignorée (⇒ écrasement) ; filtre `owner` retiré ; garde-quota retiré |
| D | `audit-agent-evenements.cjs` : paire ECDSA générée par l'audit, clé publique servie par un faux eBay ; signature fausse ⇒ 412 et 0 écriture ; même `notificationId` deux fois ⇒ 1 tâche ; le corps porte un faux titre, prix, acheteur ⇒ aucune de ces chaînes n'est écrite ; `k` inconnu ⇒ 204 ; première veille ⇒ `historique`, 0 notification ; nouvelle commande ⇒ 1 notification, mémo écrit **avant** | `ebay-veille.cjs` (4832) | vérification de signature retirée ; contenu de la sonnette cru ; mémo écrit après l'envoi |
| E | `audit-ebay-expedier.cjs` (spec) + : les échéances de date limite s'annulent au scan | `ebay-expedier.cjs` (4834) : Colis, Ma journée, la cloche et le widget disent **le même nombre** | annulation demandée comptée « à poster » |
| F | `audit-ebay-retrait-serveur.cjs` (spec) + la sonnette par l'email de bordereau | `ebay-retrait-serveur.cjs` (4835) | comptes bloqués `null` lus « aucun » |
| argent | `audit-urssaf.cjs` étendu, `audit-ebay-signature.cjs` (spec) | `ebay-argent.cjs` (4836) | total acheteur remis |
| G | `audit-ebay-suivi.cjs` (`suivi.md` §6.7) : un code inconnu ne vaut jamais `livre` ; une étape ne recule pas ; « sans scan » ne se déclenche que sur un achat daté et un statut lu après | `ebay-suivi.cjs` (**4842**) | « pas su » traité comme « en transit » |
| H | `audit-agent-bordereau.cjs` (route dans un `vm`, faux Boxtal à la forme du bac à sable, faux eBay) : `EBAY_ONLY` ⇒ 0 achat ; politique « pas su » ⇒ 0 ; relais sans point lisible ⇒ 0 ; poids « pas su » ⇒ 0 ; au-dessus du plafond ⇒ 0 et « à confirmer » ; achat ⇒ **un** `POST shipping-order` avec `externalId = orderId` ; coupure après l'envoi ⇒ `incertain` et **0 second achat sur 10 battements** ; deux battements simultanés ⇒ 1 achat ; annulation définitive ⇒ 1 `DELETE`, demande d'annulation ⇒ 0 ; envoi déjà déclaré au même numéro ⇒ 0 déclaration, à un autre numéro ⇒ 0 déclaration et une alerte ; webhook à la mauvaise signature ⇒ 412 ; webhook de A pour une commande de B ⇒ rien ; PDF d'un autre hôte ⇒ refusé ; répétition ⇒ 0 appel payant et une entrée « j'aurais » | `ebay-bordereau.cjs` (**4843**) : la confirmation montre prix, ville, poids, N° et **Annuler n'envoie rien** ; le PDF ouvert **porte** le titre et le N° (flux décompressés, comme `lbc-bordereau.cjs`) ; une feuille par bordereau | état écrit **après** l'achat (⇒ deux achats) ; plafond rendu sur un incertain ; `EBAY_ONLY` ignoré ; HMAC non vérifié |
| I | `audit-agent-messages.cjs` (`suivi.md` §6.7) : éteint ⇒ 0 ; mémo illisible ou non écrit ⇒ 0 ; deux passages ⇒ 1 ; date limite inconnue ⇒ pas de rappel ; authentification ⇒ 0 ; texte rendu avec une adresse web, un email ou `{` ⇒ refusé ; plafond ⇒ 0 ; au-delà de 90 jours ⇒ 0 ; coupure ⇒ jamais renvoyé | `ebay-messages.cjs` (**4844**) : le journal se relit, texte exact | mémo après l'envoi ; contrôle d'adresse web retiré |
| J | les audits des specs du 9 oct. ; `audit-agent-repricing.cjs` : jamais sous le plancher, jamais sans plancher, jamais au niveau d'un seuil de la règle d'offre, une fois par semaine | `ebay-vivantes.cjs` (4838), `ebay-repricing.cjs` (**4845**) | plancher ignoré ; seuil de la règle d'offre ignoré |

Et toujours : `audit-fonctions-api.cjs` (12 fonctions), `audit-secrets.cjs`
(aucune clé dans le dépôt public), `audit-offres-auto.cjs` (aucune acceptation
hors du seuil natif), `audit-bilan-semaine.cjs` (`PUSH_CATS` = `PUSH_DEFAUT`).

---

## 14. Tes gestes, une seule fois

| # | quand | geste | où | pourquoi |
|---|---|---|---|---|
| 1 | **maintenant** | **retirer la N°553 d'eBay** (annonce `128127336988`) | VRM → eBay → Annonces → « Retirer », ou le Hub vendeur | elle est vendue sur Vinted depuis le 10 oct. |
| 2 | quand tu veux | relier l'annonce eBay `128101592740` à sa paire | VRM → eBay → Annonces → « Relier à une paire » | sans SKU, rien ne la protège d'une double vente |
| 3 | avant d'ouvrir VRM à des abonnés payants | **décider Vercel Pro** (environ 20 $ par mois, secondaire) | vercel.com → Settings → Billing | le plan gratuit est « non commercial » (extrait officiel des « fair use guidelines ») ; Pro donne aussi le cron à la minute et 800 s par fonction |
| 4 | chantier C | dire **oui** à la migration de l'agent (elle active `pg_cron` et `pg_net`, inclus dans ton plan Supabase Pro, mesuré) | je la prépare ; tu l'appliques ou tu me dis « vas-y » | l'horloge de l'agent |
| 5 | chantier C | poser **`VRM_BATTEMENT_SECRET`** (64 caractères aléatoires, « sensitive ») sur Vercel, et **la même valeur** dans le coffre Supabase | Vercel → Settings → Environment Variables ; Supabase → SQL Editor | le battement s'authentifie |
| 6 | chantier C | poser **`VRM_COFFRE_CLE`** (32 octets aléatoires), et **en garder une copie hors ligne** | Vercel + ton gestionnaire de mots de passe | chiffre tes clés Boxtal et tes jetons eBay ; la perdre = les ressaisir (aucune fuite, aucune perte d'argent) |
| 7 | chantier D | demander à eBay l'**« Application Growth Check »** (gratuit) : hausse du quota Trading, liste blanche des Platform Notifications, droits d'abonnement aux notifications et de messagerie | developer.ebay.com → ton application **[chemin exact à vérifier]** | sans la hausse, l'agent plafonne vers 700 à 1 000 comptes eBay |
| 8 | chantier D ou J | **te reconnecter une fois** à chaque compte eBay | VRM → eBay → Compte → « Reconnecter » | le droit d'abonnement aux notifications, puis litiges et statistiques |
| 9 | chantier G | créer une **clé « Suivi » La Poste** et la poser sur Vercel (`LAPOSTE_OKAPI_KEY`) | developer.laposte.fr (compte gratuit, secondaire) | suivre Colissimo et Chronopost |
| 10 | chantier H, **seulement** si tes ventes ne portent pas `EBAY_ONLY` (ton compte pro) | ouvrir un **compte Boxtal pro** (SIRET), choisir le **prélèvement différé**, créer une **application API v3**, d'abord **en bac à sable** ; coller les clés dans VRM | boxtal.com, puis VRM → Réglages → Expédition | VRM achète avec **ton** compte, jamais avec le sien |
| 11 | chantier H | régler ton **colis type** (pèse une boîte !), tes **transporteurs préférés**, ta **fenêtre d'achat**, tes **plafonds** | VRM → Réglages → eBay → « Ce que VRM fait seul » | rien n'est acheté sans eux |
| 12 | après C | **allumer l'agent** : l'interrupteur d'installation, puis tes réglages ; 7 jours en **répétition** ; relire le journal ; passer en réel | VRM (bouton du propriétaire) | rien ne part tant que tu ne l'as pas fait |
| 13 | quand tu veux | (facultatif) **« Automatiser les évaluations »** dans tes préférences de vente eBay | ebay.fr → Préférences de vente | l'évaluation positive, sans VRM |
| 14 | pour la baisse de prix automatique | saisir tes **prix d'achat** ou des **planchers** | VRM → Annonces (saisie en série) | sans plancher, l'agent ne baisse rien |

**Et cinq décisions** que je ne prends pas à ta place :
1. retirer l'exception `ebay-apres-vente` du retrait automatique (11.1) — je le
   recommande ;
2. un suivi Mondial Relay payant (AfterShip, TrackingMore), ou « pas su » pour
   les bordereaux Mondial Relay achetés dans eBay (10.1) ;
3. une clé La Poste de VRM pour tous les vendeurs, ou une par vendeur (quota
   partagé **[à vérifier]**) ;
4. les réponses **automatiques** aux questions eBay (11.6) ;
5. l'offre aux observateurs **automatique** sur les paires qui dorment (11.7) —
   ce serait une nouvelle forme d'acceptation sans ton clic.

---

## 15. Ce qui est impossible ou risqué, dit franchement

### 15.1 Impossible aujourd'hui

- **Acheter une étiquette eBay par API en France.** La seule API d'étiquettes
  d'eBay est américaine (USPS). Pour une commande `EBAY_ONLY`, l'agent ne fera
  jamais mieux qu'**un** bouton. **Si c'est le cas de ton compte particulier, le
  « 100 % autonome » s'arrête là pour toi** — tout le reste, oui.
- **Connaître le point relais choisi par l'acheteur** : aucun champ documenté de
  l'API ne le porte pour la France (`bordereaux.md` §3.1). Sans le lire par
  identité sur une vraie commande, l'agent n'achète **aucune** étiquette en
  relais.
- **Savoir « livré » par eBay** : il faut le transporteur. **Mondial Relay** sans
  contrat pro ne s'interroge pas : pour un Mondial Relay acheté dans eBay,
  l'agent ne saura que ce que dit l'email du transporteur.
- **Retirer une annonce Vinted** : ta règle (§3). Une paire vendue sur eBay reste
  en ligne sur Vinted jusqu'à ton geste ; l'agent te prévient en moins d'une
  minute, c'est tout.
- **Imprimer et déposer** : un serveur n'appuie pas sur ton imprimante et ne va
  pas au relais.
- **Écrire un lien de suivi à l'acheteur** : interdit par eBay (aucune adresse
  web dans un message).

### 15.2 Risqué, et ce qui le borne

| risque | ce qui le borne |
|---|---|
| **un bordereau acheté pour rien** (commande annulée après l'achat) | la fenêtre d'achat (1 h après le paiement) ; l'annulation automatique sur une annulation définitive et sans scan ; le remboursement est suivi dans le journal |
| **deux bordereaux pour une commande** (tu en achètes un dans eBay pendant que l'agent achète le sien) | relecture de `getShippingFulfillments` juste avant l'achat ; la carte Colis dit « acheté par VRM — n'en achète pas dans eBay » dès l'état `bordereau_en_cours` ; l'annulation t'est proposée |
| **deux systèmes qui déclarent** (l'intégration eBay native de Sendcloud ou Boxtal, branchée en plus) | même relecture ; l'onboarding le dit |
| **un poids sous-déclaré**, facturé après coup | le devis fait foi ; le poids est montré dans la confirmation et le journal ; ton colis type se règle en pesant une boîte |
| **un message de trop** (eBay et le spam) | trois messages seulement, éteints par défaut ; 20 par jour et par compte, 3 par commande ; contrôle du texte rendu ; mémo avant l'envoi |
| **un défaut de l'agent** | 7 jours de répétition ; plafonds réservés par la base ; deux interrupteurs (le tien, celui de l'installation) ; un journal relisible ; chaque geste prouvé rouge sur l'avant et sous mutation |
| **un agrégateur qui change sa réponse** | la forme est relevée et vérifiée (comme la sentinelle de forme de l'extension, 5.141) ; une réponse inconnue vaut « pas su » |
| **les quotas d'eBay partagés par tous les vendeurs** | part équitable, priorités, demande de hausse (geste 7) avant 700 comptes |
| **l'abonnement aux notifications d'eBay qui ne marche pas** (des développeurs rapportent des difficultés à s'abonner aux sujets de commandes, secondaire, forum eBay) | la veille marche seule, à 15 minutes ; la notification n'est qu'une accélération |
| **le plan Vercel gratuit** : usage commercial interdit, journaux gardés 1 h | geste 3 ; le journal de l'agent vit dans **ta** base |
| **le secret du battement lisible dans la file de `pg_net`** | secret à part, battements idempotents et freinés ; le schéma `net` jamais exposé à l'API (Supabase → Settings → API) |
| **l'adresse de l'acheteur transmise à l'agrégateur** | lue au moment d'acheter, jamais rangée ; **la politique de confidentialité doit le dire** avant le chantier H |
| **un particulier sans SIRET** (un autre revendeur) | pas de Boxtal pour lui ; l'agent fait tout sauf l'achat |

---

## 16. Ce qui reste à mesurer, au premier vrai essai

1. **`ShippingLabelPolicy` sur tes commandes** — le point qui décide de 9.2.
2. Où le **point relais** de l'acheteur apparaît dans `getOrder` (noms des clés
   seulement).
3. Si une notification `ORDER_CONFIRMATION` **nomme le vendeur**, combien
   d'adresses de destination une application peut créer, et le nom du droit
   d'abonnement d'un utilisateur.
4. Que la signature d'eBay se vérifie sur le corps brut (sinon sur le JSON
   re-sérialisé, comme le code officiel d'eBay).
5. **Boxtal** : la recherche d'un envoi par `externalId` ; le délai d'une
   annulation remboursée ; le format thermique par transporteur ; les devis en
   v1 ; les frais de régularisation de poids.
6. Les **codes transporteur** d'eBay.fr (`get_shipping_carriers`).
7. La réponse de **La Poste « Suivi v2 »** : le code « au point de retrait », la
   date limite de retrait, le quota.
8. `AddMemberMessageAAQToPartner` avec ton jeton, sur eBay.fr : longueur
   maximale, effet du passage des pseudos aux identifiants fixes.
9. Le délai réel d'un battement `pg_net` → vrm.center, et que « Fluid compute »
   est actif (300 s).
10. Le délai pendant lequel un acheteur eBay.fr peut annuler seul après l'achat
    (la fenêtre d'1 h de 9.5).

---

## 17. Sources

**Les quatre études du jour, dans ce dossier** (chacune porte ses propres
sources, mesurées ou citées) : `bordereaux.md`, `suivi.md`, `infra.md`,
`etat.md`. **La feuille du 9 octobre** : `../agent-ebay/feuille-de-route.md`,
`spec-socle.md`, `spec-veille.md`, `spec-expedier.md`,
`spec-retrait-serveur.md`, `spec-argent.md`, `spec-boite.md`,
`spec-litiges.md`, `spec-annonces-vivantes.md`, `spec-publier-lot.md`,
`spec-visibilite.md`.

**Mesuré aujourd'hui, pour ce document** :
- ta base (lecture seule, projetée) : `ebay_orders`, `ebay_listings`,
  `ebay_programmees`, `ebay_inventory` toujours relues le **10 octobre à
  20 h 29 UTC**, **0 commande**, 3 annonces ;
- le code de la branche `worktree-wf_30feaf2f-334-8` : `api/ebay.js` (dispatch
  `ACTIONS`, modes `deletion` et `callback`, Trading au niveau **1149**,
  l. 146), `vercel.json` (un cron, cinq réécritures) ;
- le code de `main` (`61ef35a`) : `annotateAndDownloadBordereau`,
  `zoneEtiquette`, `posePrefsImpression`, `vrm_imprimante`, `aExpedier`,
  `limiteExpedition`, `posteSansDepart` (48 h), `numerosDejaVendus`,
  `doublesVenteEbay`, `PUSH_CATS`, `CARRIERS`, `trackUrl`.

**Recherches du jour (en plus de celles des études)** :
- eBay, schéma AsyncAPI du sujet « Order Confirmation » (un objet `order` avec
  `orderId`, l'en-tête `X-EBAY-SIGNATURE`) — extrait officiel :
  [order_confirmation.yaml](https://developer.ebay.com/api-docs/master/commerce/notification/asyncapi/order_confirmation.yaml) ;
  [aperçu de l'API Notification](https://www.developer.ebay.com/api-docs/commerce/notification/overview.html)
  (identifiant fixe à la place du pseudo pour les utilisateurs américains depuis
  le 26 septembre 2025) ; [notes de version](https://developer.ebay.com/develop/api/notification-api/release-notes)
  (« Order Confirmation » ajouté en 1.6.6, 1ᵉʳ décembre 2025).
- Difficultés d'abonnement aux sujets de commandes — secondaire, forum eBay :
  [ITEM_SOLD non pris en charge par l'API REST](https://community.ebay.com/forum/fulfillment-57961/topic/inquiry-regarding-production-topic-id-for-new-order-notifications-replacing-legacy-itemsold-468420/),
  [`order_created` refusé (195014)](https://community.ebay.com/t5/RESTful-Buy-APIs-Order-Offer/Notification-Subscription-for-a-created-order/m-p/34952754),
  [abonnement aux commandes par l'API REST](https://community.ebay.com/t5/eBay-APIs-Talk-to-your-fellow/issue-Subscribing-to-Order-Checkout-Notifications-via-RESTful/m-p/35117466).
- Boxtal, annulation d'une commande v3 (`DELETE /v3.1/shipping-order/{id}`, 400
  quand ce n'est plus possible ; la v1 n'a pas d'annulation par l'API) — extrait
  officiel : [cancelling order v3](https://developer.boxtal.com/fr/en/apiv3/guide/cancelling-order-api-v3),
  [cancelling order v1](https://developer.boxtal.com/fr/en/apiv1/guide/cancelling-order-api-v1).
- Sendcloud, intégration eBay native (renvoie le suivi à eBay ; emails de suivi
  Sendcloud désactivés pour eBay « en raison de la politique d'eBay ») — extrait
  de la page commerciale : [Sendcloud — intégration eBay](https://www.sendcloud.com/fr/nos-integrations/ebay/).
- eBay.fr, vendeurs particuliers sans frais de vente depuis le 1ᵉʳ septembre
  2026 (sauf plus de 150 annonces par mois, ou un acheteur hors zone euro) —
  secondaire : [JustGeek](https://www.justgeek.fr/ebay-supprime-frais-vente-particuliers-157677/).
  **Aucune source trouvée** sur une étiquette eBay obligatoire pour les
  particuliers en France : le point reste **[à vérifier]**, et c'est la lecture
  de `ShippingLabelPolicy` (chantier B) qui tranchera, sur tes vraies ventes.
