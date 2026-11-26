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

3. **Banc `repub-formulaire` B7/B8 (rouges sur main et #1350)** : artefact de banc, pas un défaut de `vrm-action.js`. Le
   bouton « Sauvegarder le brouillon » est à y≈950 dans une fenêtre de 860 px : le vrai clic tombait HORS de l'écran (cible
   `HTML`, `elementFromPoint` nul), ni sur le voile ni sur Vinted ; B8 comptait ce clic parmi ceux de VRM. Le bouton est
   amené dans l'écran avant le clic ⇒ 14 verts ; un voile en `pointer-events:none` ⇒ B7 rouge (la règle mord toujours).

## Résultats (vraie extension, sites simulés)
| scénario | 5.440.1 (corrigée, en ligne) | main 5.440.0 | #1348 5.446.0 |
|---|---|---|---|
| F1 3 favoris, liens d'application | 3/3 (avant correction : 1/3, 2/3) | — (lien refusé avant tout clic, cas de Julien) | idem main |
| F1W liens web `/items/N/want_it/new?offering_id=N` | 3/3 | 2/3 (même course `conv`) | 1/3 puis plus de service worker joignable (voir plus bas) |
| F1M liens mêlés | 3/3 | — | — |
| F1E ancienne relecture refusée ⇒ identité par la commande | 3/3 | — | — |
| F1P idem avec `{pseudo}` | 0/3, « article ou destinataire pas confirmé », file en pause (le pseudo n'est pas lu de la nouvelle messagerie) | — | — |
| F2/F3/F4 commande : autre acheteur / article / conversation | rien tapé pour lui, « pas envoyé », le suivant part | — | — |
| F5 429 | pause posée, rien écrit, carte « pause » | — | — |
| F6 captcha | arrêt (`arret_captcha`), rien de plus ; le favori dit « à vérifier » (conversation déjà ouverte) au lieu de « vérification » | — | — |
| F7 autre compte dans l'onglet | rien ne part (`autre_compte`) | — | — |
| F8 onglet de travail fermé | la file s'arrête chez VRM, rien de plus | — | — |
| F9 extension rechargée | pas simulable ici (Chromium du banc ne rend pas une extension dépaquetée après `runtime.reload`) | — | — |
| L1 Leboncoin compte + annonce + photo | rangés | — | rangés |
| V1 Vestiaire compte de l'onglet (canal de la page) | `vc_session` rangé | — | rangé |
| C1 carte du logo | posée ; « Oui, capter » ; compte lié, VRM 5.440.1, santé 100, 0/50 | — | posée, compte capté |
| Republication (gestes dans la page) | `repub-formulaire` 14 verts ; audits recreer 149, parfaite 43, verifier 17 | — | — |

## Ce que seul un vrai compte peut confirmer
- L'adresse WEB de la ligne d'un favori dans la cloche quand la notification porte le lien d'application (jamais relevée) ;
  la sous-forme de `escrow_order.items[]` ; qu'une conversation de favori soit « à commande » (mesuré : `data.subject`).
- Que l'ancienne relecture `GET /api/v2/conversations/{id}` reste servie (200 le 21 nov.) — sinon le cas F1P ({pseudo}).
- Le relancement du service worker après ⟳ (F9) dans un vrai Chrome.
- La forme exacte d'une expédition AVEC point (`pickup_type` non nul) : acceptée par la règle d'avant (point lu).
