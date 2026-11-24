# 24 nov. 2026 — Simulations de bout en bout de la vraie extension (branche `claude/ext-simulations`, 5.449.0)

Julien : « regarde tout, fais des simulations ». La vraie extension est chargée dans Chromium (`--load-extension`,
service worker MV3, scripts de contenu), contre des sites SIMULÉS sous leurs vrais noms, aux formes MESURÉES en base
(lecture seule, formes seulement). On juge ce que l'extension FAIT : requêtes envoyées par la page après les clics de VRM,
lignes écrites, état de la file chez VRM, état de la fenêtre, captures.

## L'outil
- `scripts/bancs/sim-extension.cjs` : le banc (scénarios `--seul F1,F1W,…`, `--mutation`, `BANC_EXT=<dossier>` pour une
  autre copie de l'extension, `SIM_RACINE=<arbre>` pour la file du serveur de cet arbre, `BANC_CAPTURE`, `SIM_REQ=1` le
  journal des requêtes Vinted, `SIM_DIAG=1` les derniers diagnostics de l'extension).
- `scripts/bancs/_sim-vinted.cjs` : le faux Vinted (cloche `api.vinted.fr/inbox-notifications`, liens d'application
  `vintedfr://messaging?item_id=&user_id=&portal=fr` ou web `/items/N/want_it/new?offering_id=N`, `POST …/inquiries`,
  `/inbox/{uuid}`, nouvelle messagerie sans `data.items`, commande escrow, offre, message, captcha DataDome, 429).
- `/api/compte?mode=favoris` est servi par la VRAIE file (`api/_lib/favoris-file.js`) et le vrai résumé de la carte.

## Ce qui a été trouvé et corrigé
1. **Suivi des achats (production, chaque appareil, 5.410 → 5.440)** : `suivi_forme_inattendue_escrow` = `suivi_vu_escrow`.
   La forme réelle de `GET /api/v2/escrow_orders/{id}/shipment` (mesurée sur 4 comptes, hôtes www et core) est un objet
   PLAT sans point (`pickup_point_name` null) ; la 5.411 ne l'acceptait qu'avec un point. **5.449.0** : cette forme exacte
   (`formeEscrowMesuree`, mêmes clés, mêmes types, rien de plus) est reconnue ; le transporteur d'un achat PROUVÉ
   (destinataire = compte de l'onglet ; transaction par `order.id`) est rangé ; une vente n'est plus comptée « inattendue »
   (`suivi_escrow_pas_le_destinataire`) ; toute autre forme reste inattendue. Preuve : `audit-suivi-escrow-forme.cjs`
   19 verts, 8 rouges sur la 5.440 de `main` (les mêmes compteurs qu'en production), `--prouve` 6/6.
   `audit-relais-dest` P4 porté (le transporteur seul, aucun point inventé).
2. **Favoris (sur `claude/favoris-identite`, 5.440.1)** : la conversation de l'envoi PRÉCÉDENT appariée au nouvel uuid
   (`favoriOuvrir`) ⇒ 1 ou 2 favoris sur 3. Corrigé là-bas (voir `2026-11-23-favoris-identite.md`, dernière section).

## Ce que seul un vrai compte peut confirmer
Voir le rapport final de la session (table scénario × résultat) et la suite de ce fichier.
