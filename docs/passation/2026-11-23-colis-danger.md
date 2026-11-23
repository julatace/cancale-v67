# 23 nov. · Lot B — « Colis en danger » : mesuré, puis CODÉ (point 1 + notification) sur la décision de Julien

Julien (validé le 23 nov.) : « alerte colis en danger : une VENTE dont le colis approche du retour à l'expéditeur ou de
la fin de garde au point relais côté acheteur (dates LUES dans le suivi/e-mails), et un ACHAT qui attend au point
relais près de sa date limite de retrait (règle retraitPreuves/limite lue) ; notification push sur son réglage ».
Vérifié contre les refus du 11 oct. : « alerte achat jamais arrivé » est refusée — ici ce n'est PAS ça (un colis
ARRIVÉ au relais, avec une date limite LUE).

## Ce qui existe déjà — le côté ACHAT est fait
- Ma journée / À régler : le groupe `retrait-dernier-jour` (achats au point relais dont la date limite LUE est
  aujourd'hui), la carte des retraits, « à vérifier » au-delà ;
- les notifications (famille « Codes de retrait », réglable) : « 📍 Dernier jour pour retirer … » le matin du dernier
  jour, « 📍 Demain dernier jour » la veille (api/ship-reminders.js `rappelsColisRetrait`, `retraitsDuJour`, une fois
  par colis, mémo `colis_retrait_dedup`) ; le widget relit les colis publiés (`vrm_colis_retirer`).
- Mesuré : `email_track_*` « available » 222, dont **109 avec une date limite lue** — c'est ce qui sonne déjà.
⇒ Refaire une « alerte achat » doublerait ces notifications et ce nombre (§7 : un nombre une fois par écran). Rien
  n'est ajouté côté achat.

## Le côté VENTE — aucune date lisible aujourd'hui (mesures du 23 nov., lecture seule, projections scalaires)
- `transp_*` (lectures chez le transporteur) : 158 lignes, **0 pour un n° de VENTE** (aucune n'a son n° dans un
  `email_bord_*`) — le serveur ne lit chez le transporteur que les colis ENTRANTS (« jamais un n° SORTANT »,
  api/_lib/transporteurs-lecture.js) ;
- `depart_*` (le départ d'un colis vendu, 8 nov.) : 33 lignes — Chronopost et Mondial Relay, états inconnu / en_route /
  livré / retiré, **aucun « disponible », aucun champ de date limite** ; une fois la prise en charge prouvée, le n°
  n'est plus relu (`fini`) : l'arrivée chez le relais de l'acheteur n'est jamais lue ;
- e-mails : `email_track_*` sortants : 37 « transit », 5 « delivered », **aucun « available » ni date limite** ;
- statuts des ventes Vinted (`orders_sold`) : « La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste
  ou point relais » (2) — AMBIGU (dépôt du vendeur OU attente de l'acheteur ?), sans date ; la transaction captée
  (`status_updated_at`) est celle du bordereau (230), plus ancienne ; « Commande non réclamée - Retournée à
  l'expéditeur » (2) — le retour, déjà arrivé (il vit dans Retours / annulées).
⇒ Une alerte « approche du retour à l'expéditeur » ne peut s'appuyer sur AUCUNE date lue ; une garde estimée (vente +
  N jours) sur un statut ambigu serait un chiffre inventé (§2.3, §5 « mieux vaut un blanc qu'un faux »). **Rien n'est
  codé.**

## Ce qu'il faudrait pour le faire honnêtement (à décider par Julien)
1. **Relire le colis vendu jusqu'à sa remise** (aujourd'hui la lecture s'arrête à la prise en charge) : Vinted Go donne
   `expiration_time` (mesuré sur un colis entrant : `limite` + `limiteAt` + `limiteSure`) ; Chronopost et Mondial Relay
   ne donnent pas de date limite dans ce qu'on lit (0 sur 129 lignes) ⇒ seul Vinted Go serait couvert. Coût : des
   lectures en plus chez le transporteur (rythme et pauses déjà en place, `transp_pause`).
2. **Mesurer une forme** : un e-mail Vinted au VENDEUR « ton acheteur n'a pas encore récupéré son colis » (jamais vu dans
   sa base au 23 nov.) — s'il en arrive un, il est gardé (`email_inconnu_*`) et la règle pourra être écrite sur lui.
3. Ensuite seulement : une famille de notifications « Colis en danger » (api/_lib/notif-textes.js `FAMILLES`), une fois
   par colis, sur SON réglage.

## Décision de Julien (23 nov., soir) : OUI au point 1
« pour tes ventes, VRM relit le colis jusqu'à ce que l'acheteur le récupère et te prévient avant qu'il reparte (au point
relais Vinted Go seulement pour commencer) ».

## Mesures du soir (lecture seule, formes seulement, aucune donnée copiée)
- `depart_*` : 33 lignes — **0 `depart_vinted_*`** (Chronopost 9, Mondial Relay 25 ; états inconnu / en_route / livré /
  retiré ; aucun « disponible »). Le code d'avant relisait DÉJÀ un colis vendu pris en charge toutes les 6 h jusqu'à la fin
  (`RYTHME_SUIVI_MS`, 11 nov.) — le récit du matin disait « plus relu » : c'est `fini` qui ne bouge plus, pas `clos`.
- Bordereaux de vente `email_bord_*` (254) : formes des n° `XW…TS` 55, `XU…JF` 45 (Chrono Relais Europe), 8 chiffres
  (Mondial Relay) 10, `ZW…TS` 4, vides 139 — **aucun `VGS…` (Vinted Go)**. Les 13 n° `VGS…` de la base sont tous des
  ACHATS (`email_track_vinted_*` « available » avec code, `transp_vinted_*`).
- La date de départ Vinted Go est lisible : `transp_vinted_*` « disponible » lu par le serveur porte `limiteSure: true` +
  `limiteAt` (la réponse `carrier.vintedgo.com/public/v3/tracking_events/{n}` a `meta.expiration_time`). Même route, même
  analyseur pour un colis vendu.
- E-mail au VENDEUR « ton acheteur n'a pas encore récupéré son colis » (point 2) : **aucun** sujet de cette forme parmi
  `email_*` (2 235 inconnus, 1 959 réceptions…). Seul vu côté vendeur : « Votre colis a été retiré par le destinataire »
  (2). Rien n'est codé sur un e-mail : s'il en arrive un, il est gardé (`email_inconnu_*`).
⇒ Le code est prêt, mais **aujourd'hui aucune vente ne passe par Vinted Go** : la notification ne sonnera qu'au premier
  colis vendu dont le bordereau porte un n° `VGS…`. Chronopost et Mondial Relay ne donnent pas de date (« pas su » ⇒ rien).

## Ce qui est codé (aucune extension : c'est le serveur qui lit Vinted Go — pas de 5.446)
- `api/_lib/depart-colis.js` : `ligneDepartApresEssai` garde `limite` / `limiteAt` / `limiteSure` sur la ligne
  `depart_vinted_{n°}` **seulement** si Vinted Go est « disponible » ET `expiration_time` lu (`limiteSure`) ; tout autre
  état ou date estimée l'efface ; une lecture ratée ne touche rien. `SELECT_DEPART_META` / `departDeMeta` les relisent
  (`meta->>`). `prochainEssaiDepart` : un colis au point avec une date lue est relu toutes les **2 h**
  (`RYTHME_DANGER_MS`) au lieu de 6 h.
- `api/_lib/colis-frequent.js` : le passage de 15 min (GitHub, 6 h → 23 h) visite aussi le vendeur d'un
  `depart_vinted_*` disponible avec date lue et dernier essai de plus de 2 h (projeté sur `owner`).
- `api/_lib/colis-danger.js` (pur) : `colisEnDanger` — Vinted Go, « disponible », date LUE, lecture de moins de 8 h,
  n° porté par UN bordereau de vente (une transaction, pas annulée), ni retour (`email_bordretour_*`) ni achat
  (`transp_*`) ; seuils `veille` (repart demain, Paris) et `jour` (aujourd'hui, pas passé). `passeColisDanger` :
  réglage coupé ⇒ rien ; une lecture ratée ⇒ rien ; réservée dans `push_dedup` (`colis-danger-{seuil}-{n°}`) ⇒ une
  fois par colis et par seuil.
- `api/ship-reminders.js` : la passe tourne au cron du matin ET après chaque visite du passage « colis » (la lecture
  vient d'avoir lieu). Envoi par `sendPushToAll` (cat `colisdanger`, `echeance` = la date lue, `urgent` le jour même,
  `redaction` ⇒ texte refait dans la langue du compte). Lien : Ventes → la vente (par SON n° de transaction).
- Textes (`api/_lib/notif-redaction.js`, sorte `colisDanger`, 5 langues) : « Colis pas encore retiré · <article> » /
  « Préviens ton acheteur : son colis repart le mer. 25 nov. 11 h 34 ».
- Famille `colisdanger` « Colis en danger » (`api/_lib/notif-textes.js`, allumée par défaut), icône, geste, aperçu
  (`api/_lib/notif-apercus.js`), rangée dans le groupe « Colis » de Paramètres → Notifications.
- `src/nouveautes.js` : « Colis pas retiré : VRM te prévient ».

## Preuves
- `scripts/audit-colis-danger.cjs` : 35 verts — L (lecture sur la FORME Vinted Go réelle, par le vrai analyseur), R (la
  règle, 50 ventes au même titre), T (textes 5 langues ≤ 40/90, famille, aperçu), C (la VRAIE route
  `ship-reminders?moment=colis` sur une fausse base PostgREST : relu chez Vinted Go, notification sur le téléphone, une
  seule fois ; cron du matin, réglage coupé ⇒ rien). `--prouve` : **16/16 mutations attrapées**. Sur `origin/main` :
  rouge (module et date absents).
- Voisins verts : colis-sortants, suivi-commandes, retour-parfait, retours-suivi, statut-transporteurs, transp-depenses,
  suivi-ventes-mr, colis-frequent, notifications (F5 : treize familles), notifs-redaction, notifs-belles, notifs-centre,
  transp-notif, fonctions-api (12, aucune ajoutée), traduction, quoi-de-neuf, identite, suivi-cles, statuts, frise-source.
  `cle-verifier` déjà rouge sans ce lot. `npm run build` vert.

## Ce qui ne peut pas être vérifié sans un vrai colis
- Qu'un bordereau de vente Vinted Go porte bien un n° `VGS…` dans `email_bord_*` (jamais vu : 0 sur 254).
- Que `expiration_time` d'un colis VENDU est la date où il repart vers le vendeur (mesuré seulement sur des achats).
- L'heure réelle d'arrivée de la notification (cron 6 h, passage de 15 min de 6 h à 23 h, heures calmes 22 h → 8 h sauf
  échéance avant 10 h).

## ÉTAT À LA REPRISE
- Branche `claude/colis-danger`, PR #1338 : code + audit, pas fusionné (le train fusionne). Aucune extension changée.
- Geste de Julien : aucun (la famille est allumée par défaut ; elle se coupe dans Paramètres → Notifications → Colis).
