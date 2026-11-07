# 6 nov. — Hors réseau (Colis au point relais) et les temps réels des vendeurs

Branche `v36-hors-reseau`, partie de `claude/project-review-nsk5su` (fusionnée dedans à
`9198fc84`). Rien n'est poussé par cette session. Aucune donnée réelle : bancs et audits
inventent tout.

## 1. Hors réseau : ce qui marchait, ce qui marche

### Mesuré AVANT (banc `scripts/bancs/hors-reseau.cjs` sur le build d'avant, `BANC_DIST`)

iPhone 390 tactile et 1512, après une première ouverture en ligne, puis
`context.setOffline(true)` et la page rouverte (jeton expiré) :

| | avant | après |
|---|---|---|
| l'app s'ouvre sans réseau (service worker : page en cache, `/assets/` en cache) | ✅ | ✅ |
| Colis → À retirer rouvert hors réseau | ❌ l'écran « Ma journée » à la place de Colis | ✅ l'écran **Colis** |
| codes de retrait et QR (réserve `vrm-hl-qr` du service worker) | ✅ (dans Ma journée) | ✅ |
| un point relais = une carte, avec son lieu | ❌ une liste plate | ✅ |
| « En grand » (code en très gros + QR ≥ 200 px, écran gardé allumé) | ❌ absent | ✅ |
| la ligne de l'état | « Hors ligne — ce que tu vois date de 18:46 ; rien ne peut être envoyé. » | « **Hors connexion — dernier état du 6 nov. à 18:46.** Ce que tu notes ici part au retour du réseau. » |
| un état de plus de 12 h | rien de plus (« hier 12:46 ») | une ligne ambre « Ce dernier état a plus d’un jour… vérifie au comptoir » |
| « J'ai retiré » / « Colis fait » hors réseau | ❌ boutons grisés | ✅ notés, « en attente d'envoi », partent au retour |
| ce qui ne peut pas attendre (bordereau, répondre) | non dit | dit une fois (`data-hl-refuse`) |
| le réseau coupe pendant que Colis est ouvert | Ma journée remplace Colis | Colis passe à son dernier état |
| la coquille du service worker ne garde rien de personnel | ✅ (mesuré, pas changé) | ✅ |

Avant : 34 rouges sur 2 tailles (dont 2 du banc lui-même, corrigés : le lieu tel que
`cleanLieu` le nettoie, et les logos `/brands/*.svg` dans la coquille). Après : tout vert.

### Ce qui a été fait

- **`src/journeeHorsLigne.js`** (la photo par vendeur, 21 oct.) : chaque colis à retirer
  garde son **identité** (`cle` = `colisKey`, la clé de `vrm_colis_collected` ; `tx`
  pour un colis vu par Vinted seulement, `vinted_pickup_done`) et chaque colis à envoyer
  Vinted sa transaction (`tx`, `vinted_ship_done`). Une photo d'avant (sans identité)
  reste lisible ; son geste est refusé, jamais deviné par le titre (§5).
  Nouveaux : `quandEtat` (« 6 nov. à 17:36 »), `ETAT_VIEUX_H` = 12, `pointsDeRetrait`
  (un point = une carte), et les nouvelles valeurs des gestes (`colisRetireApres`…).
- **`src/App.jsx`** (bloc « MA JOURNÉE HORS LIGNE », chirurgical) : `JourneeHorsLigne`
  rend **Colis** sur `cat_bord` (et `retraits`, `cat_achats`, `cat_expedition`) :
  à retirer par point relais → à vérifier → à envoyer ; `EnGrandHorsLigne` (la même
  feuille lumineuse `vrm-eg-*` qu'en ligne, `GardeEcranAllume`) ; `LigneEtatHorsLigne`.
  Les gestes (`useGestesHorsLigne`) passent par **`save`** comme en ligne : la **file
  d'envoi** (`src/fileEnvoi.js`, 2 nov.) les garde et les rejoue au retour (fusion clé
  par clé, comparer-et-échanger sur `data.rev`). « Annuler » à côté.
- **Service worker non modifié** (`public/sw.js`) : la règle reste — navigation
  **réseau d'abord** (la page en cache seulement sans réseau, jamais un `index.html`
  figé), `/assets/` hachés en cache d'abord, purge de l'ancienne version à l'arrivée
  d'une nouvelle (`purgerAncienneVersion`), rien de `/api/` ni de la base en cache.
  Les données du vendeur restent dans l'APP (localStorage par vendeur, `vrm_hl_photo_*`,
  effacé à la déconnexion), les QR dans la réserve `vrm-hl-qr` (vidée à la déconnexion).

### Preuves
- `BANC_PORT=12251 node scripts/bancs/hors-reseau.cjs` — vert après (2 tailles, A–E) ;
  rouge sur le build d'avant (`BANC_DIST=<dist d'avant>`). `BANC_SEUL=A,B`,
  `BANC_TAILLES=390` pour en jouer une partie.
- `scripts/bancs/hors-ligne.cjs` mis à jour (même contrat : la nouvelle ligne ; seuls les
  gestes mis en file et « En grand » sont actifs) — vert ; `codes-hors-ligne`, `sw-cache`
  verts ; `audit-journee-hors-ligne` vert.
- ⚠️ `scripts/bancs/file-envoi.cjs` est **rouge AVANT ce chantier aussi** (mesuré sur le
  build d'avant) : il n'arrive plus à ouvrir « Compléter les prix d'achat » (chantier C,
  la feuille Actions). La file elle-même est prouvée par `audit-file-envoi` (vert) et par
  `hors-reseau` (A, C : le geste arrive en base au retour).

### Pas fait (à décider)
- Réseau « faible » (`navigator.onLine` vrai, requêtes qui échouent) : la coque montre
  `BaseInjoignable` + les codes gardés (G9), pas la vue Colis hors réseau.
- La photo n'est écrite qu'après une lecture COMPLÈTE (règle du 21 oct.) : un vendeur dont
  une source échoue toujours n'a pas de dernier état (on le dit, les codes G9 restent).

## 2. Les temps réels des vendeurs (Web Vitals, anonymes, agrégés)

- **La règle** `src/mesuresTerrain.js` (app ET serveur, §11) : 4 mesures — premier écran
  utile `peu` (ouverture ou changement d'écran → `<main>` montre du contenu sans
  squelette ni démarrage ; 30 s ou plus comptés tels quels ; page cachée = pas mesurée ;
  ouverture avec connexion tapée = pas mesurée), interaction `inp` (Event Timing, la
  plus lente de la visite), décalage `cls` (fenêtres de session), `morceau` (un morceau
  pas chargé). Des **cases fixes** ; trois clés fermées (écran de la liste `ECRANS` de
  « Signaler un problème », `telephone|tablette|ordinateur`, mesure). `normaliserLot`
  jette tout le reste, idempotent. Safari ne mesure ni `inp` ni `cls` : rien n'est envoyé
  pour elles (jamais un 0).
- **La collecte** `src/mesuresCollecte.js`, démarrée dans `AppCoeur` (après la session,
  pas en mode exemple) : `sendBeacon` (corps `text/plain` : `{v, h, jeton}`) vers
  **`/api/compte?mode=mesures`** — pas de 13ᵉ fonction —, au plus **une fois par minute**
  (horodatage sur l'appareil, commun aux onglets), rien hors réseau ni sans session ; le
  lot attend sur l'appareil (`vrm_mesures_lot`).
- **Le serveur** `api/_lib/mesures-terrain.js` : jeton vérifié auprès de Supabase
  (jamais rangé), lot refiltré, additionné dans `app_data` `mesures_jour_AAAA-MM-JJ`
  (jour de Paris) **du propriétaire de l'installation** (`proprietaireInstallation`).
  Anti-abus sans identifiant en clair : une **empreinte du jour** (HMAC du vendeur + du
  jour, secret serveur, 12 hex) — un lot/min, 600/jour. Écriture en comparer-et-échanger
  sur `data.rev` (4 essais) ; lecture ratée ⇒ rien d'écrit. GET : propriétaire seul
  (403 sinon), agrégats p50/p75/p95 seulement (ni histogramme, ni empreinte).
- **Le panneau** `src/composants/MesuresTerrain.jsx`, dans Réglages → Sécurité des données
  (`proprio` seulement) : un jour à la fois (‹ ›), par écran × appareil : mesures, 1er
  écran p50/p75/p95, toucher p75, décalage p75 ; ambre = p75 +30 % sur la veille.
- **La veille** `passageVeilleLenteurs` (api/_lib/veille-plantages.js), branchée au cron du
  matin (`api/ship-reminders.js`, `veilleDesLenteurs`, réponse `lenteurs`) : hier contre
  avant-hier, p75 du premier écran ou du toucher +30 %, ≥ 20 mesures chaque jour ⇒ une
  notification au propriétaire (mémo `veille_lenteurs` écrit AVANT, une fois par jour).
- La politique de confidentialité dit la mesure (une ligne, §2 du tableau). Aucun hôte
  nouveau (même origine) : CSP et `audit-politique-hotes` inchangés pour ça.
- Les lignes `mesures_jour_*` s'accumulent (≈ quelques Ko par jour) : aucune purge n'est
  posée (DELETE = geste humain) — à décider. **Décidé le 6 nov., codé le 7 nov. : voir
  « Purge à 90 jours » ci-dessous.**

### Purge à 90 jours (7 nov., intégration `claude/integ-hors-reseau`)
- `purgerMesuresAnciennes` (`api/_lib/mesures-terrain.js`), appelée par le cron du MATIN
  seulement (`api/ship-reminders.js`, ni le soir ni au réveil), avec le propriétaire de
  l'installation (`proprietaireInstallation`) ; sans propriétaire connu, aucune requête.
- Lecture PROJETÉE `app_data?owner=eq.<proprio>&id=like.mesures_jour_*&select=id`,
  paginée par `Range` (1 000/page). Une page ratée (statut, réseau, JSON illisible, page 2
  après une page 1 pleine) ⇒ **rien n'est supprimé**.
- Le jour se lit dans l'IDENTIFIANT (`jourDeId`, vraie date vérifiée ; sinon la ligne est
  gardée) ; supprimé = jour STRICTEMENT avant « aujourd'hui de Paris − 90 j » (le jour du
  seuil est gardé). Suppression `owner=eq.<proprio>&id=in.(…)`, lots de 100 ; une
  suppression ratée est dite dans la réponse du cron (`purgeMesures`), jamais levée.
- Preuve : `node scripts/audit-purge-mesures.cjs` (28 verts, faux PostgREST qui sert la
  forme réelle : projection, `Range`, plafond 1 000, filtres) et `--prouve` : **12/12
  mutations rouges** (lecture ratée qui supprime, `select=data`, sans pagination, jour du
  seuil supprimé, 30 j, date non vérifiée, tous les vendeurs, cron qui ne purge pas ou
  purge le soir…). Aucune ligne de test dans la base.

### Preuves
- `node scripts/audit-mesures-terrain.cjs --prouve` : R1–R13 (jeu riche : e-mail, pseudo,
  n° de transaction, IBAN, prix, URL, jeton, uuid, adresse — rien ne passe ; quantiles
  à ±1 case de 5 000 valeurs tirées), C1–C14 (faux navigateur : corps `{v,h,jeton}`, rien
  de la page ni du stockage, 1 envoi/min, hors réseau, sans session, Safari), S1–S12
  (serveur à état : 401/503, lecture KO ⇒ rien d'écrit, aucun uid/jeton/e-mail rangé,
  429 à la minute, deux vendeurs, devancé ⇒ rejoué, sommes exactes, 403, 600/jour),
  V1–V5 (veille). **9 mutations, toutes rouges.**
- `npm run build`, `audit-csp`, `audit-fonctions-api` (12), `audit-secrets`,
  `audit-coherence`, `audit-tdz`, `audit-morceau-perime`, `audit-vapid`,
  `audit-veille-plantages`, `audit-file-envoi`, `audit-icones`, `audit-signalement` : verts.
  `audit-politique-hotes` : 1 rouge **préexistant** (`src/enLigneLbc.js` →
  www.leboncoin.fr, pas touché ici ; rouge aussi sur l'arbre d'avant).
- `BANC_PORT=12255 node scripts/bancs/mesures-terrain.cjs` (la vraie app, 390 tactile) :
  un lot `{v,h,jeton}` part en `text/plain` vers `compte?mode=mesures`, aucune donnée
  affichée dedans, rien d'autre dans la minute, la visite de Colis attend sur
  l'appareil ; le panneau du propriétaire lit les agrégats, p75 +50 % marqué — vert.
- Notifications : `centre-notifs` vert (98), `audit-notifications` vert, `sw-cache` vert ;
  `notifs-destination` : 9 rouges **préexistants** (« ni écran blanc ni garde-fou »,
  les mêmes 9 sur la pointe de `claude/project-review-nsk5su` bâtie sans ce chantier).

## Gestes de Julien
- Rien à poser pour le hors réseau : ouvrir Colis une fois avec du réseau suffit.
- Les temps réels n'apparaissent qu'avec `SUPABASE_SERVICE_KEY` et `VRM_OWNER_UID` (déjà
  exigés par la veille des plantages). Regarder Réglages → Sécurité des données → « Temps
  réels des vendeurs » au bout d'un jour.
