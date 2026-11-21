# Serveur : les défauts moyens et bas, réglés par FAMILLE (11 nov. 2026, second agent)

Branche `claude/agent2-familles-serveur`, partie de `origin/claude/agent2-robustesse-serveur`
(déjà fusionnée dans `main` par la PR #1135 : la branche la CONTIENT), `origin/main` fusionné.
**Pas de PR, pas de fusion** : l'agent principal intègre. Aucune extension touchée. Toujours
12 fonctions `api/`.

Source : la revue en lecture seule `docs/passation/robustesse/serveur.md` (branche
`claude/agent2-robustesse`), points MOYENS (33-104) et BAS (105-145). Les critiques/hauts déjà
faits sont dans `2026-11-11-robustesse-serveur.md` (pas refaits).

Gardien commun : **`scripts/audit-familles-serveur.cjs`** (34 contrôles, EXÉCUTÉS sur un réseau
suspendu, une fausse base À ÉTAT avec PATCH conditionnel sur `data->>rev`, 409 sur un INSERT
en double). `--prouve` : **25 rouges sur origin/main** (git archive) et **13/13 mutations**
attrapées.

## Famille 1 — un délai sur chaque appel sortant (M33-M49, M57, M96)
- **`api/_lib/fetch-delai.js`** : `fetchAvecDelai(url, options, ms)`, LE seul `fetch` du serveur
  (AbortController, minuterie `unref`, le délai couvre aussi la lecture du corps). Délai par
  service : Supabase 10 s, Stripe 10 s, Anthropic 25 s, eBay 10 s, Vinted 10 s, Overpass 8 s,
  Nominatim 8 s, Photoroom 30 s, sinon 10 s. Un `signal` posé par l'appelant est GARDÉ et
  combiné ; s'il en pose un, le délai par défaut ne le raccourcit pas (filet de 60 s).
  `VRM_DELAI_SORTANT_MAX_MS` : plafond pour les bancs seulement.
- Un remplacement mécanique : 258 `fetch` nus de 64 fichiers d'`api/` (appels ET valeurs par
  défaut `fetcher = fetch`) passent par lui. Cinq audits qui copient des fichiers d'`api/` dans
  un dossier temporaire copient aussi `fetch-delai.js` (atelier, equipe-ecriture-membre,
  litiges, numerotation-lecteurs, questions-ebay).
- Overpass : les trois miroirs en **course** (`Promise.any`), 8 s chacun (M41). Nominatim :
  1 requête/s au plus, cache par ville 24 h dans l'instance, file > 3 s ⇒ « indisponible » (M42).
- `vinted-refresh` : 4 comptes à la fois, budget 40 s (un compte pas commencé est dit
  `skip_budget`), `SUPABASE_URL` lu de l'environnement (M39, M89), détail d'erreur fixe.
- `email-rattacher` : service de connexion en panne ⇒ **503 « réessaie »**, plus « reconnecte-toi »
  (M43) ; un « base non cloisonnée » gardé 60 s (B112).
- `accesVendeur` : 5 s, éviction de la plus ancienne entrée (plus `clear()`), un « oui » gardé
  15 s (M45, M90, B136). Push : appareils par paquets de 5, 20 au plus ; abonnement borné à 20 ;
  panne journalisée (M48, M49, B126).
- Messages : `ai` 502 + détail borné + `no-store` + prix borné (B115-117) ; `vinted-proxy` page
  HTML coupée à 2 Ko, message fixe (B121-122) ; `relais` ville ≤ 80 caractères, panne 502
  `no-store` (B123-125) ; `ebay` `no-store`, panne d'eBay (502) distinguée d'une erreur interne
  (500) (B118, B120).

## Famille 2 — lectures paginées : ordre, fin à 416, « pas su » au plafond (M46, M57, M88)
- `finALaFrontiere` ajouté à `api/_lib/ordre-stable.js` **au même texte** que la branche
  `agent2-limites-client` (pas encore sur main) ; posé dans CHAQUE boucle `Range` : widget, cron,
  étiquettes, transporteurs (mêmes lignes que limites-client), pilotage, mesures (×2), eBay
  suppression (refait sur la règle commune), email-rattacher (×2), lecture des annonces ailleurs.
- Une boucle qui atteint son plafond rend `null` (avant : la demi-liste comme entière) — widget
  50 pages, cron, étiquettes, transporteurs, e-mails.
- `lireCommeVendeur` : 1 000 lignes sans `limit=` posé ⇒ peut-être tronqué ⇒ `null` (M46).
- `listerFinis` (clients partis) et `listerEssais` : pagination **par clé** (`owner=gt.`), plus
  par `offset` (M88) — prouvé : 10 lignes effacées pendant la lecture, 2 490/2 500 sur main.

## Famille 3 — jamais la ligne entière quand quelques champs suffisent
- Widget : les ventes e-mail lues en `receivedAt,uid,prix` (`SELECT_VENTES_EMAIL`), plus
  `select=data` sur chaque e-mail de vente à chaque rafraîchissement (H25).
- eBay : l'action « agent » (arrêtée le 5 nov., plus appelée par l'app) répond 410 sans rien
  lire (relisait `ebay_orders` entière + messages et offres en série) (H27, M87).
- **Pas fait** (une écriture qui réécrit toute la ligne doit la lire toute) : `modifierDonnee`
  eBay (H28), `commandes-leger` (M72 — il faudrait une RPC de fusion côté base), favoris (M82,
  la résolution des cibles lit les captures entières), lecture des annonces ailleurs (M62).

## Famille 4 — comparer-et-échanger, et « pas su » ≠ « rien »
- **`api/_lib/cas.js`** : `conditionRev` (la version comparée SOUS SA FORME LUE : entier, chaîne
  d'UUID, objet — M70/M71 : un `rev` chaîne donnait `is.null`, 6 essais puis 503 permanent),
  `revSuivant`, `modifierLigneCas` (INSERT simple ⇒ 409 relu ; PATCH conditionnel ; lecture ratée
  n'écrit rien), `reserverMemo` (réserver AVANT d'envoyer). `modifierCas` (suivi-vinted) et
  `modifierNeutre` passent par la même règle.
- Journal des e-mails `logEmail` par comparer-et-échanger (H10) ; son échec n'est plus un 503
  (c'est une trace : l'e-mail est déjà rangé ; comme une lecture ratée avant).
- Cron : mémos « à expédier » et URSSAF (1er du mois et veille d'échéance) RÉSERVÉS avant
  l'envoi ; mémo illisible ⇒ rien n'est envoyé, plus `|| {}` (M80, M81, B130). `ecrireDedup`
  reste l'écriture simple (lignes de travail : PDF transporteurs, compteurs).
- Relances d'essai : l'étape réservée par `reserverMemo` (H15).
- Avoir : la facture marquée « annulée par » relue et réessayée ; échec ⇒ `avertissement` (M74).
- « Pas su » : `detectAccount` ⇒ 503 (jamais rangé sans compte, H11) ; `vintedPris` ⇒ 503
  `pris:null` (M52, l'app se tait déjà sur un non-200) ; `lireVintedIds` ⇒ `null` ⇒ aucun
  essai, parrainage 503 (M51).

## Famille 5 — identifiants
- **`api/_lib/empreinte.js`** : `empreinte` (SHA-256, 16 hex = 64 bits), `ancienneEmpreinte`
  (le hachage 31 bits À L'IDENTIQUE, pour relire), `cleCompatible` (la ligne d'avant garde sa clé
  si elle désigne la même chose, sinon la neuve ; lecture ratée ⇒ rien écrit, 503).
- Vente : clé = `tx{transaction}` quand elle est lue, sinon le Message-ID, sinon l'empreinte
  (H7/H8 : deux paires identiques au même acheteur et au même prix faisaient UNE vente). Achat et
  offre : 64 bits ; offre avec Message-ID (B107). E-mail inconnu : clé stable sans l'heure (M60).
  Quarantaine sans Message-ID : clé déterministe (ni heure, ni hasard).
- Restent au hachage 31 bits (pas des clés de ligne neuves, ou zone Colis) : étiquettes de
  notification, `email_track_*` sans n° de suivi (Colis), carte `vc_email_offres` (porte le
  Message-ID), repli « texte » de `cleFinalisation` (compatibilité).

## Famille 6 — le reste, dans le temps disponible
M55 clé d'idempotence Stripe avec les paramètres · M61 brouillon de facture Pro raté ⇒ 503 ·
M65 `updated_at` sur les lignes e-mail · M67 quarantaine pas vidée ⇒ 503 · B110 rejeu au code du
traitement · M77 stock eBay `complet`/`total` · M93 trop de comptes = 413 nommé · B127 message du
cron borné · B133 `invoice.paid` sans propriétaire journalisé · B142 motifs eBay entre guillemets ·
B145 JSON illisible = 400.

## Pas fait (et pourquoi)
- Hors zone, notés pour l'agent principal : B141 (jeton SMS non encodé, zone Colis — l'audit
  `sms-colis` vise ce texte), M85/M91 (`email_track_*`, Colis), `/api/sante` (B132), jetons
  Vinted renvoyés au navigateur (vinted-proxy), CORS.
- M50 (deux vendeurs relient le même compte Vinted) : il faut une contrainte unique / RPC
  (migration). M54 (frein des sessions d'extension en mémoire) et M79 (`COMPTEUR_BILAN_MOIS`) :
  à ranger en base / dans le contexte. M53 : Vercel coupe déjà à 4,5 Mo. M73 (uid de l'envoi
  léger) : `vinted_accounts` ne liste pas toujours les comptes captés — vérifier avant de bloquer.
  M75 (trou de numérotation si une facture est abandonnée), M78 (verrou d'idempotence des
  actions eBay), M83, M86, M92, M97-M99, M102-M104, B105-B106, B108-B109, B111, B113-B114,
  B119, B128-B131, B134-B135, B137-B140, B143-B144 : pas traités.
- H14 (verrou de passage du cron) : en partie couvert (les mémos d'envoi sont réservés), pas de
  bail global.

## Conflits attendus à l'intégration
`agent2-limites-client` modifie les MÊMES lignes d'import (`ordreStable` ⇒ `ordreStable,
finALaFrontiere`) et ajoute la même fonction ; `widget.js` y ajoute une ligne d'import juste
après : conflit trivial (garder les deux). `pilotage.js` : ma valeur par défaut
`fetcher = fetchAvecDelai` contre `fetch` chez eux (garder la mienne).

## Vérifié
`npm run build` ; `audit-familles-serveur` (34 verts, `--prouve` 25 rouges sur main, 13/13) ;
variables, tdz, coherence, identite, fonctions-api (12), secrets, robustesse-serveur,
pagination-ordre, clients-partis, cron-lots, relances-essai, abonnement (103), rappel-urssaf,
suites-serveur, email-rattacher, ebay-suppression ; les 252 audits qui lisent `api/` : 14 rouges,
**exactement ceux d'origin/main** (app : chrome-en-dur, config-facture, lectures-lourdes…), aucun
nouveau. Bancs corrigés à la vraie forme : `audit-relances-essai` (PATCH conditionnel servi),
`audit-abonnement` (vinted-pris pas su = 503).

Geste de Julien : aucun.
