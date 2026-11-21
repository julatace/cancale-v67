# 6 nov. 2026 — Audit des chiffres (« j'ai pas 20 colis à déposer »)

Branche `v36-audit-chiffres-2` (depuis `claude/project-review-nsk5su`). Julien, le 6 nov. :
« Plus de fiabilité stp, j'ai pas 20 colis à déposer par exemple, audite tout le site. »

## 1. Méthode

- Copie réelle de SA base (lecture seule, projetée, le 6 nov. ~10 h UTC, revérifiée à 17 h :
  ventes, bordereaux, `main` identiques), **hors dépôt** (scratchpad), servie à l'app construite
  (`npm run build`) par un PostgREST minimal ; horloge figée au 6 nov. 17 h (Paris). Rendu à 390
  tactile et 1512 de 24 écrans (Ma journée, Ventes, Annonces par site, Messages, Achats, Colis et
  ses onglets, Tournée, Statistiques, Compta, Stock, E-mails, Comptes liés, eBay, Leboncoin,
  Vestiaire, Paramètres…), relevé de chaque nombre (texte et `data-*`).
- Les routes serveur EXÉCUTÉES sur la même copie : `api/widget.js` (ship, pickup),
  `api/ship-reminders.js` (matin, soir).
- Recalcul indépendant par notion (SQL sur la base, sans le code de l'app).

## 2. Le « 20 »

Mesuré en base (ventes des 30 derniers jours) : 10 « Bordereau envoyé au vendeur » (4 + 4 + 1 + 1),
1 « Le paiement a été validé » (sans bordereau), et la vente Vestiaire du 2 nov. à expédier (lue sur
Vestiaire le 2 nov., jamais relue depuis) : **12 colis à envoyer, dont 11 à déposer** (1 attend
son bordereau). Le compte retiré (2 vieilles ventes « à expédier » de septembre) n'entre nulle part.

Sur la copie, à 17 h, AUCUN écran ne dit 20 à déposer : Ma journée, Colis (carte, onglet,
badge), le widget et le rappel du soir disent **12** colis à envoyer. Les « 20 » visibles :
- l'onglet **« Envoyés · 20 »**, collé à « À envoyer · 12 » : 19 ventes Vinted parties (en route,
  au relais de l'acheteur, livrées) + 1 retour — conforme (c'est la lecture probable de Julien) ;
- « 20 ventes » du mois (Ventes, Statistiques, `widget_stats`) — conforme (19 Vinted + 1 Vestiaire,
  1 514,33 €) ;
- la cloche (20 sur la copie, 25 chez lui) : le journal des notifications, pas des colis.
`push_journal` : le soir du 5 nov. « Demain : 11 colis à poster » (juste à cette heure-là).

Ce qui, en revanche, disait des nombres différents pour la même chose (corrigé ci-dessous) :
« à imprimer » 5 / 4 / 10, « à envoyer » 12 / 11, « à déposer » 12 pour 11 déposables, « à
retirer » 12 / 15.

## 3. Tableau (copie réelle, 6 nov. 17 h)

| notion | écran | affiché avant | recalculé | écart | cause | correction |
|---|---|---|---|---|---|---|
| à envoyer | Ma journée, Colis carte/onglet, badge, widget, soir | 12 | 12 | 0 | — | — |
| à envoyer | Colis, récapitulatif (lu) | 11 | 12 | −1 | le total oubliait Leboncoin et Vestiaire | même total que la carte (`colisAutres`) |
| à imprimer | Ma journée | 5 (10 après une visite de Colis) | 4 | +1 / +6 | comptait les PRÊTS (imprimés compris), e-mails seuls, sans « au moins » | `compteAImprimer` : pas encore imprimés, bordereaux captés lus ici aussi (lecture scalaire), publication `vrm_colis_prets.aImprimer` |
| à imprimer | Colis, case | 4 | 4 | 0 | — | — |
| à imprimer | Colis, récapitulatif (lu) | 10 | 4 | +6 | « prêts » au lieu de « à imprimer » | « 4 à imprimer · 6 déjà imprimés · 1 en attente de bordereau » |
| à déposer | Tournée de dépôt | 12 | 11 | +1 | comptait la vente qui attend son bordereau | « 11 colis à déposer · 1 attend son bordereau » |
| à retirer | Ma journée, Colis | 12 | 12 | 0 | — | — |
| à retirer | widget | 15 | 12 | +3 | 3 e-mails Vinted « Commande mise à jour » SANS n° de suivi reçus après la photo de l'app, comptés chacun comme un colis neuf | sans identité ⇒ pas compté, le nombre dit « au moins » |
| envoyés | Colis | 20 | 20 | 0 | — | — |
| ventes du mois | Ma journée, Ventes, Statistiques | 20 · 1 514,33 € | 20 · 1 514,33 € | 0 | — | — |
| ventes du mois | Annonces (« Aujourd'hui · Vinted ») | 19 · 1 311 € | 19 · 1 311,10 € (Vinted) | 0 | site choisi, nommé sur la carte | — |
| semaine du 26 oct. | Ma journée | 11 ventes · 653 € | 11 · 652,50 € | 0 | — | — |
| colis envoyés (semaine) | Ma journée | — « envois pas notés » | pas su | 0 | aucune date d'envoi prouvée hors « Colis fait » (0 geste ; aucune ligne transporteur pour ses bordereaux de vente : 94 n° de suivi, 0 `transp_`) | — (le « 0 » d'avant est déjà un « — » depuis les onglets A) |

## 4. Ce qui est fait (commits)

1. `03485b6f` — « à imprimer » une notion (`compteAImprimer`, `src/prochainGesteColis.js`) ;
   récapitulatif de Colis au total de la carte ; Tournée : « à déposer » = colis qui ont leur bordereau.
2. `a9535dec` — Ma journée lit les bordereaux captés (`rechargerLabels`, `meta->>`, une lecture par
   compte) : « 4 à imprimer » exact sans passer par Colis.
3. `4b7bde38` — widget : une ligne de suivi sans n° reçue après la photo ⇒ « au moins », jamais +1.
4. Banc permanent `scripts/bancs/chiffres-coherents.cjs` (données inventées, forme réelle ; widget
   exécuté), au lot CI (`lancer-bancs.cjs`, part 3 de `verifier.yml`) ; `audit-colis-prochain` §6.

Preuves : banc vert (26), ROUGE sur l'arbre d'avant (`08d95ff7`, 9 rouges : récap 5/6, à imprimer,
Tournée 6, widget 2) et sur mutation (« à imprimer » = prêts, Tournée = tous, widget sans le
filtre d'identité : 5 rouges). `audit-coherence`, `-identite`, `-chiffres`, `-colis-envoi`,
`-colis-prochain`, `-tdz`, `-variables`, `-retrait-fiable`, `-colis-heure`, `-flux-divers`,
`-lectures` verts ; bancs `colis-envoi`, `colis-retirer-propre`, `onglets-a`, `navigation-tache`.

## 5. Ce qui reste

- **Fraîcheur** : à 17 h, la plupart des listes de ventes dataient de 8 h 40 (Paris) ; un colis
  déposé dans la journée reste « à envoyer » jusqu'à la relecture (l'état lu de Vinted gagne
  déjà ; rien n'est déduit d'une absence). La vente Vestiaire n'a pas été relue depuis le 2 nov.
- « Envoyés · 20 » collé à « À envoyer · 12 » se lit vite de travers : le nom de l'onglet est à
  revoir avec Julien (session visuel / statut des colis), pas de règle à changer.
- La carte « À envoyer » de Ventes dit « — · ouvre Colis » tant que Colis n'a pas publié sur
  l'appareil (pas su, dit) — à brancher sur `toShip` si Julien le veut.
- Extension : rien à changer (`A_EXPEDIER` = `aExpedier`, inchangé).
