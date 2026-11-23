# 23 nov. · Lot B — « Colis en danger » : MESURÉ, PAS CODÉ (`claude/colis-danger`, récit seul)

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

## ÉTAT À LA REPRISE
- Branche `claude/colis-danger` : ce récit seul (aucun code). Geste de Julien : dire s'il veut le point 1 (Vinted Go
  relu jusqu'à la remise, ventes seulement).
