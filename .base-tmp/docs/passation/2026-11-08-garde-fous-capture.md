# 8 nov. — Garde-fous de la capture (extension 5.327.0)

Branche `claude/garde-fous-capture` (partie de `claude/amazing-lovelace-xd7obl`). Pas de PR : intégrée par la
session principale.

## Pourquoi
L'extension Orion (iPhone) n'a rien envoyé pendant deux jours : d'abord la 5.322 (envoi de 1 Mo coupé), puis
le préalable CORS refusé par vrm.center (corrigé dans `api/_lib/cors-extension.js`). Personne ne l'a vu : la
carte du logo le disait, mais seulement sur le téléphone, à qui l'ouvrait. Julien : « ce problème ne doit plus
jamais se produire ». Cinq garde-fous.

## 1. L'appareil se déclare (extension)
`publierAppareil` (background.js) écrit `app_data` `ext_appareil_{id}` — `id` tiré au hasard, gardé dans
`chrome.storage.local` (`vrmAppareilId`), jamais l'agent utilisateur ni un jeton :
`{ appareil: {paquet, nav, systeme}, ver, code, atMs, flux: {vinted|leboncoin|vestiaire: {okAt, koAt, koStatut,
refus[5], secours}}, vus: {vinted: {uid: at}} }` (≈ 2 Ko).
- Paquet Orion reconnu par `__vrmOrionCompat` (posé par compat-orion.js) ; Orion sur Mac (paquet Chrome, agent
  Safari) ⇒ « Orion » ; Edge/Opera par leur marqueur ; sinon Chrome. Un repère pour NOMMER, jamais une capacité.
- `vus` : un compte Vinted dont une lecture est arrivée dans un onglet (passive `storeHarvest`, types
  profile/listings/orders/inbox/billing), 48 h, 30 au plus.
- Quand : au plus une fois par 30 min (`noterFlux` et `surAlarme`), tout de suite après un refus NEUF (2 min au
  moins entre deux). Sans session : rien, aucun réseau. Son propre échec ne remplace pas « le dernier refus ».
- Une extension < 5.327 ne publie rien : la page la dit par `panel_diag_capture` (« un navigateur pas encore
  inscrit », sa version, les deux paquets).

## 2. La règle (une seule, `api/_lib/garde-capture.js`)
Panne d'un compte Vinted / Leboncoin / Vestiaire = pas relu depuis > 12 h ALORS QU'un appareil a travaillé depuis
< 12 h ET : l'a VU ouvert après sa dernière relecture (+10 min), OU son dernier envoi sur ce site est un REFUS
(< 12 h, après la relecture, pas suivi d'un succès). « Pas su » ≠ panne : aucun appareil, appareils endormis,
« jamais relu » pas vu, refus caduc ⇒ rien. eBay (relu par le serveur) hors de cette alerte.
Cause = la LUE (code, famille, taille, appareil) ; geste : appareil en retard ⇒ « installe la 5.327 sur … » ;
401/sans session ⇒ reconnecter ; 403 ⇒ abonnement ; sinon recharger l'onglet + signaler si ça revient.
Clé d'une panne = site:compte:dernière relecture (relu puis bloqué de nouveau = autre panne).

## 3. Alerte
- **App** : `AlerteCapture` (src/ToutVaBien.jsx, chargée à part) sous `BandeauLiaison` : compte, cause, appareil,
  geste ; « Voir » ⇒ Paramètres → Tout va bien ? ; « × » masque CETTE panne sur cet appareil. Lit d'abord les
  seules lignes d'appareils ; les comptes seulement si un appareil actif porte une preuve.
- **Notification** : `rappelPannesCapture` (api/ship-reminders.js, matin et soir, par vendeur), catégorie
  `capture` (famille « Rappels », heures calmes et plafond de `sendPushToAll`), mémo `capture_panne_dedup` écrit
  et confirmé AVANT l'envoi ; toute lecture ratée ⇒ rien. Le rappel « pas relu depuis 24 h » se tait pour les
  comptes Vinted qu'elle vient de nommer. Lien : `?tab=settings&section=toutvabien`.

## 4. Paramètres → « Tout va bien ? » (en tête de « Mes comptes »)
Résumé (« Tout est à jour » seulement si tout est lu, aucun geste, appareils à jour — jamais sur un « pas su ») ;
une rangée par compte groupée par site (relecture, appareil, refus en français, UN geste) ; « Où tourne
l'extension » : chaque appareil, sa version, « À jour » ou « Installer la 5.327 » ⇒ trois gestes et le lien du bon
paquet (zip / xpi). Rangées iOS, jetons `--d-*`, pastille neutre/ambre/creuse, 44 px, clair/sombre.

## 5. Voie de secours (extension)
`commandesParServeur` : 3 échecs « réseau »/5xx DE SUITE vers vrm.center (`vrmSecoursCmd` ; un 4xx remet à zéro)
⇒ `'secours'` ⇒ `commandesSecours` : la taille se juge AVANT relecture sur `nItems` (scalaire) ; ≤ 256 Ko ⇒
la fusion par n° de la 5.323 (`commandesARanger`) et UN envoi direct ; sinon RIEN relu ni écrit (`trop_lourd`), la
ligne complète reste entière. La carte du logo le dit (`data-secours`). Un succès de vrm.center efface tout.
⚠️ Limite assumée : une ligne JSONB unique ne s'écrit pas « en morceaux » chez PostgREST sans serveur ; le
secours est donc BORNÉ (jamais 1 Mo d'un coup), pas découpé : un gros compte attend vrm.center (dit).

## 6. Test « comme Orion »
`scripts/tests/orion-cors-reel.cjs` (CI : parcours-critiques, étape Orion) : pas de WebKit dans le conteneur ⇒ un
faux `fetch` qui applique les règles d'un navigateur (préalable OPTIONS pour Authorization/JSON, 2xx, origine,
méthode et en-têtes permis, ACAO sur la réponse) entre le VRAI `background.js` et les VRAIS `api/compte.js`,
`relais.js`, `push.js`. 15 verts ; avec `--racine` = arbre de `4f5c3e94^` (avant la correction CORS) : 9 rouges
(« préalable 405/401 · ACAO=∅ », ventes non rangées).

## Preuves
- `scripts/audit-garde-fous-capture.cjs` : 46 verts ; `--prouve` 8 mutations ⇒ rouges ; sur le `background.js`
  de départ (`2fb6058f`) : 11 rouges.
- `scripts/bancs/tout-va-bien.cjs` : 71 verts (panne / tout à jour / pas su ; 390 et 1512 ; clair et sombre ;
  44 px ; pas de débordement). Captures regardées.
- Verts : build, audit-coherence, -extension-zip, -identite, -fonctions-api, -variables, -tdz, -violet,
  -ventes-envoi-leger, -cors-extension, -chrome-en-dur, -cron-lots, -evt-extension, -export-donnees,
  -extension-navigateurs, -extension-ui, -fiabilite-fond, -fusion, -icones, -notifications, -notifs-centre,
  -push, -ventes-fusion, -notif-colis ; banc badge (114).

## Version
5.327.0 : manifeste (+ « Vestiaire Collective » dans le résumé, et dans docs/boutiques-extension.md), `CODE_VERSION`,
lbc-inject.js, lbc-relay.js, `EXT_ATTENDUE`, `EXT_CAPACITES.appareil` / `.secoursenvoi`, audit-coherence, table §8,
paquets régénérés (`node scripts/zip-extension.cjs`). Aucune permission ni site ajouté.

## Gestes de Julien
1. Installer la 5.327 sur l'ordinateur (zip, ⟳) ET dans Orion sur l'iPhone (`VRM-Orion.xpi`).
2. Ouvrir Paramètres → Tout va bien ? : chaque navigateur doit y apparaître après sa première visite.
