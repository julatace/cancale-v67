# 27 nov. 22:42 — Favoris : « Ignoré · acheteur pas encore confirmé » ×5 (jujuf38) — ext. 5.455.6

Branche `claude/favoris-suite`. Données des bancs INVENTÉES (dépôt public).

## Ce que Julien a vu
Compte jujuf38, 5 favoris du N°180 (salomon XT-6 noir 42,5, 55 €), 5 acheteurs, favoris du 08/11 au 22/11 : chaque ligne
« Ignoré · acheteur pas encore confirmé » (`f6_r_non_prouve`). Rien ne pouvait partir. « Pourquoi j'ai ça », puis « comme Vintex ».

## La cause
`api/_lib/favoris-carte.js` n'acceptait un favori que si `resoudreCiblesFavoris` le reliait à une personne — et celle-ci exigeait
une CRÉATION NATIVE apprise (`harvest_{uid}_wreq_api_v2_conversations` : avoir ouvert un favori depuis la cloche sur CE compte),
puis deux ouvertures natives pour « prouver » que `offering_id` est la personne. Sur un compte jamais ouvert ainsi : tout
« non prouvé ». En plus, la carte BLOQUAIT tout sur un dressing de plus de 24 h ou partiel, et `lancer` exigeait la trace.
Or c'est MESURÉ : `offering_id` du lien web `/items/N/want_it/new?offering_id=U` est la personne (28 oct. : 77 favoris, 77
personnes distinctes, messages partis) ; le lien d'application `vintedfr://messaging?item_id=&user_id=` porte l'article et la
personne (23 nov.). Vintex et Bleam s'en servent directement.

## Ce qui change (serveur + panneau)
- `identiteDirecteFavori` (favoris-cibles.js) : une notification qui porte SES deux identités (lien d'application, ou lien web à
  la seule clé `offering_id`) est prouvée seule — clés exactes, chiffres, la personne ≠ le compte, ≠ l'article, ≠ le `user_id`
  de la notification (le même pour toutes : jamais une preuve). L'ancienne preuve apprise reste un chemin en plus ; deux
  preuves qui se contredisent ⇒ rien.
- `raisonSansPreuveFavori` : une notification sans personne dit « notification sans acheteur — ouvre-la une fois sur Vinted »
  (`sans_acheteur`, panneau `fl_e_sans_acheteur` / `f6_r_sans_acheteur`, 5 langues), sans bloquer les autres.
- `lancer` n'exige plus la trace (seulement SES réglages, son message).
- Plus aucun arrêt sur une donnée ancienne (carte ET mode auto) : dressing ancien ou partiel, garde des ventes ailleurs pas lue,
  boîte de réception ancienne ⇒ on continue (l'extension relit annonce, prix et conversation à l'envoi) ; dit en `avertissement`.
  Une annonce PROUVÉE vendue, réservée, en pause ou fermée reste écartée ; « absente » d'un dressing pas sûr ⇒ pas su ⇒ gardée.

## Ce qui peut encore rendre un favori non envoyable (la liste voulue par Julien, 22:50)
| condition | où |
|---|---|
| pas de clic / pas d'autorisation du serveur, pas de message enregistré | carte, file (`consommer`, `verifier`) |
| une AUTRE personne lue dans la conversation | extension (`destinataire_different`) |
| une conversation déjà écrite (message ou offre avec montant), une conversation connue avec cette personne (mode auto) | extension, mode auto |
| déjà envoyé (registre de la file, registre `vrmFavorisFaits`) | serveur, extension |
| annonce vendue, réservée, en pause, fermée (prouvée) | carte, mode auto, extension |
| offre sous le prix mini | extension : sauté (`offre_sous_plancher`, règle existante) |
| plafonds, pause 403/429/captcha, compte de l'onglet | extension (§3, inchangés) |
| notification sans personne | carte : « notification sans acheteur » (précis) |
| prix introuvable par TOUTES les sources (offre demandée) | extension |
| « 30 jours » entre deux messages à la même personne (mode auto) | règle d'avant, gardée (non bloquante pour les autres) |

## Preuves
- `scripts/audit-favoris-jujuf38.cjs` (nouveau) : SON cas de bout en bout sur le vrai code — carte (`apercu`), `lancer`, puis
  les 5 envois par le vrai background.js avec `consommer` / `verifier` / `terminer` par la vraie route : 5 demandes à 5 personnes,
  5 offres à 49,50 €, 5 messages, « 5 envoyés » (J1–J3) ; notification sans personne ⇒ `sans_acheteur`, les autres cochables (J4) ;
  lien d'application, compte lui-même, `user_id` commun (J5). Sur l'arbre d'avant : rouge (J1 « bloque · dressing_ancien », J2
  « Capture ou réglages indisponibles », J3 « 0 envoyés »). `--prouve` : 6 mutations rouges.
- `audit-favoris-auto.cjs` et `audit-favoris-autres-comptes.cjs` portés à la décision (garde / dressing anciens ⇒ on continue ;
  un dressing ancien qui dit « réservée » écarte toujours ; `offering_id` se prouve seul, jamais le `user_id` commun).
- `scripts/tests/favoris-relais-page.cjs` : la course de la CI (création par un `fetch` non attendu de la page ; `creations` et la
  trace lus juste après `ouvertures===1`) attend désormais leur ÉTAT réel ; 5 exécutions en parallèle vertes.

Geste de Julien : installer **5.455.6**, rouvrir l'onglet Favoris : les 5 sont cochables.
