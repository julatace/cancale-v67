# Lot 89 — Suivi transporteurs : Colissimo / La Poste, UPS, DPD, GLS (13 nov. 2026)

Branche `claude/lot89-suivi-transporteurs` (part de `origin/main` 1fd4c452). Points 8 et 9 de Julien.
Décision rappelée : **« on ne fait pas avec l'extension »** pour lire les sites des transporteurs ⇒
serveur seulement.

## 1. Ce qui est lu, transporteur par transporteur (après ce lot)

| transporteur | lu par le serveur ? | comment | reconnu par la forme du n° |
|---|---|---|---|
| Mondial Relay (InPost) | oui (inchangé) | route `_mvc` + code postal | 8 chiffres |
| Chronopost / Shop2Shop / Pickup | oui (inchangé) | `trackSkybillV2` | XW/ZW + 9 chiffres + TS/SP |
| Vinted Go | oui (inchangé) | `tracking_events` v3 | VGS…, 16 chiffres… |
| **Colissimo / La Poste** | **prêt, s'allume avec `LAPOSTE_OKAPI_KEY`** | API officielle « Suivi v2 » (Okapi) | **chiffre + lettre + 11 chiffres** (6A…, 8R…) ; un S10 « …FR » seulement si l'e-mail nomme Colissimo |
| **UPS** | **prêt, s'allume avec `UPS_CLIENT_ID` + `UPS_CLIENT_SECRET`** | API officielle « Tracking » v1, jeton OAuth client_credentials gardé ~4 h | **1Z + 16** |
| DPD | non — e-mails et SMS | réponse publique jamais mesurée (voir §3) | **jamais par la forme** (14 chiffres = aussi Chronopost) |
| GLS | non — e-mails et SMS | réponse publique jamais mesurée (voir §3) | **jamais par la forme** (11-12 chiffres = aussi Vinted Go) |
| Relais Colis | non — e-mails et SMS | aucun service public documenté | — |

Sans clé, l'app écrit « **Colissimo : suivi lu par e-mail seulement** » (idem UPS, DPD, GLS, Relais
Colis) avec le geste « Regarde ses e-mails ou le site de … » — plus « VRM ne lit pas ce transporteur »,
plus jamais « transporteur pas reconnu » pour GLS.

Mesuré sur la vraie base (lecture seule, 13 nov.) : 0 n° Colissimo / UPS rangé aujourd'hui (5 lignes
`colissimo` sans n°), 2 lignes DPD (14 chiffres). Les n° Vinted Go à 13 caractères ont la forme
« chiffre + DEUX lettres… » (9AA9A…) : la forme Colissimo « chiffre + lettre + 11 chiffres » ne les
touche jamais (et un n° de forme Colissimo n'est plus envoyé à Vinted Go, même sous l'expéditeur par
défaut « vinted »).

## 2. Comment c'est fait (pour la session suivante)

- `api/_lib/transporteurs.js` (règle pure, app + serveur) :
  - `CARRIERS_CLE = ['colissimo','ups']`, `CARRIERS_SERVEUR` (les 3 lus + ces 2), `VARIABLES_CLE` ;
  - `lecturesCle()` : sur le serveur, l'environnement (`lecturesCleDeEnv`) ; dans l'app (qui ne voit
    pas l'environnement), ce que la réponse du passage a dit (`noterLecturesServeur`), sinon `null`
    (pas su) ; `lectureServeurActive(c)` ;
  - `carrierLisible` reconnaît Colissimo / UPS **seulement si** `lectureServeurActive` — sans clé,
    aucune ligne n'est choisie, aucune requête ne part, rien de « pas encore lu » n'est promis ;
  - `FORME_SUIVI.colissimo|ups`, `FORME_COLISSIMO_PROPRE`, `FORME_UPS`, `transporteurDeFormeT` ;
  - `lireReponseLaPoste` (codes officiels DR1…DI2 : AG1 = au point, DI1 = retiré si AG1 avant ou point
    nommé, sinon livré ; RE1/DI2 = retour/rendu ; ND1/PB1/DO3 = incident ; écho `idShip` exigé ;
    401/429/HTML = refus ⇒ pause ; 404/400 = introuvable ; code inconnu ⇒ « inconnu ») ;
  - `lireReponseUps` (activités triées par date GMT ; point d'accès « awaiting pickup » / « en attente
    de retrait » ou codes ZP/5E = disponible, limite = `accessPointInformation.pickupByDate`
    (sûre) ; D = retiré après le point, sinon livré ; RS = retour ; X = incident ; M = étiquette ;
    écho `trackingNumber` exigé ; 404 / avertissement sans colis = introuvable ; 401/403/429 = refus) ;
  - `ligneTranspDeMeta` lit `transp_colissimo_…` / `transp_ups_…` (app, widget, cron) ;
  - `aLireParNavigateur` ne rend **jamais** Colissimo / UPS (C3), et la route C4 les refuse (400).
- `api/_lib/transporteurs-lecture.js` : URL officielles, `X-Okapi-Key` (La Poste), jeton UPS
  (`POST /security/v1/oauth/token`, Basic id:secret, gardé jusqu'à `expires_in` −1 min, redemandé UNE
  fois sur 401 puis la requête rejouée, identifiants refusés ⇒ 30 min de repos), `transId` unique et
  `transactionSrc: VRM-suivi` ; même file par transporteur, même User-Agent honnête, même pause ; le
  passage répond `lecture: { colissimo, ups }` (jamais la clé).
- `src/App.jsx` : la réponse du passage pose `noterLecturesServeur` (retenu sur l'appareil,
  `vrm_transp_lecture`, une commodité) ; `src/retraitSuivi.js` : la phrase « suivi lu par e-mail
  seulement ».
- `api/_lib/suivi-public.js` (`VOIES_A_OUVRIR`) et `public/legal/confidentialite.html` (une ligne La
  Poste / UPS) à jour ; `audit-politique-hotes` connaît `api.laposte.fr` et `onlinetools.ups.com`.
- **Aucune nouvelle fonction `api/`** (12/12 tenu).

### Formes vérifiées dans la documentation officielle
- **La Poste Suivi v2** (developer.laposte.fr bloqué depuis le conteneur ; recoupé sur deux clients
  publics qui la consomment, e-amzallag/laposte-suivi-api — classes `LPSuivi`, `LPShipment`,
  `LPEvent`, `LPRemovalPoint`, `LPCodeEvenement` — et rigwild/suivi-poste) :
  `GET https://api.laposte.fr/suivi/v2/idships/{n}?lang=fr_FR`, en-têtes `Accept: application/json`,
  `X-Okapi-Key`. Réponse `{ lang, scope, returnCode, shipment: { idShip, holder, product, isFinal,
  entryDate, deliveryDate, url, timeline[], event[{code,label,date,order}] (anti-chronologique),
  contextData: { deliveryChoice, originCountry, arrivalCountry, removalPoint: { name, type } } } }`,
  erreur `{ returnCode, returnMessage, idShip }`. 19 codes : DR1, PC1, PC2, ET1–ET4, EP1, DO1–DO3,
  PB1, PB2, MD2, ND1, AG1, RE1, DI1, DI2.
- **UPS Tracking v1** (spécification OpenAPI publiée par UPS, `UPS-API/api-documentation/Tracking.yaml`) :
  `GET https://onlinetools.ups.com/api/track/v1/details/{n}` (`locale`, `returnSignature`,
  `returnMilestones`, `returnPOD`), en-têtes `transId`, `transactionSrc`, OAuth2 client_credentials ;
  `trackResponse.shipment[].package[]` avec `trackingNumber`, `activity[]` (le plus récent d'abord ;
  `date` AAAAMMJJ, `time` HHMMSS, `gmtDate`, `gmtTime`, `gmtOffset`, `location.address`, `status
  {type, code, statusCode, description, simplifiedTextDescription}`), `accessPointInformation
  .pickupByDate`, `deliveryInformation`, `warnings[]` ; erreurs `response.errors[{code,message}]`
  (400, 403 « Blocked Merchant », 404, 500, 503). La spécification ne liste pas les valeurs de
  `status.type` : D/I/P/M/X/RS sont celles publiées par UPS ailleurs ; un type inconnu ⇒ « inconnu ».
  ⚠️ **À relire au premier appel réel** : le libellé exact du « point d'accès, en attente de retrait »
  (VRM le reconnaît en français et en anglais, ou par ZP/5E) — un libellé différent donnera « en
  route » (jamais « disponible » deviné). La forme d'une réponse inattendue est rangée (`forme`).

## 3. DPD et GLS : pas branchés — pourquoi

- La mission demandait de MESURER la vraie réponse depuis un bac à sable Vercel. **Impossible ce
  13 nov.** : la création renvoie **402 « Hobby plan usage limit exceeded … reset on 2026-12-01 »**.
  Le conteneur ne joint pas `tracking.dpd.de` ni `gls-group.eu` (refus du proxy, 403), ni WebFetch.
- Règle du projet (§6, et l'en-tête de `suivi-public.js`) : **aucun lecteur de page inventé**. Rien
  n'est branché ; DPD et GLS restent lus par **e-mails et SMS**, et l'app le dit (« suivi lu par
  e-mail seulement »).
- Pour reprendre (après le 1er déc. ou avec un plan Pro) : bac à sable `dub1`, User-Agent honnête
  `VRM-suivi/1.0 (+https://vrm.center)`, un n° de forme valide inventé :
  `curl -sS -i -A 'VRM-suivi/1.0 (+https://vrm.center)' https://tracking.dpd.de/rest/plc/fr_FR/<14 chiffres>`
  et `curl -sS -i -A '…' 'https://gls-group.eu/app/service/open/rest/FR/fr/rstt001?match=<11 chiffres>'`
  — noter statut, `content-type`, défi (Cloudflare, captcha), forme du JSON ; lire les conditions
  d'utilisation des deux pages. Si exploitable : un analyseur de plus dans `transporteurs.js`, ajouté
  à `CARRIERS_SERVEUR` (pas à `CARRIERS_LUS`, qui est la liste de l'extension), reconnu seulement
  quand l'e-mail nomme le transporteur.

## 4. Preuves

- `scripts/audit-suivi-cles.cjs` — **EXÉCUTE** les analyseurs sur des réponses de la forme officielle
  (inventées) et le VRAI passage (`passageTransporteurs`) sur une fausse base PostgREST et de faux
  La Poste / UPS qui comptent ce qu'on leur envoie : **64 verts** ; **17 rouges sur origin/main**
  (arbre `git archive origin/main`, audit copié dedans) ; `--prouve` : **18/18 mutations attrapées**
  (clé ignorée, extension, Vinted Go qui vole un n° Colissimo, ordre de la page, écho, livré pris
  pour retiré, AG1 oublié, 401 en rafale, retour ignoré, point d'accès UPS, limite UPS, jeton jamais
  gardé, 401 sans nouveau jeton, clé absente appelée, `transp_colissimo` illisible, `lecture` pas
  dite, texte d'erreur).
- Sans régression : audit-statut-transporteurs, audit-mondialrelay-serveur, audit-transp-ext,
  audit-suivi-public (+ `--mutations`), audit-transporteur-lu, audit-retraits-suivi,
  audit-politique-hotes, audit-fonctions-api (12/12), audit-colis-sortants, audit-transp-notif,
  audit-vintedgo-adresse, audit-suivi-commandes, audit-retraits-irreprochables,
  audit-fraicheur-unique, audit-finitions-v36, audit-colis-frequent, audit-familles-serveur — verts.
  Banc `retraits-suivi` 39/0 (R5 dit « Colissimo : suivi lu par e-mail seulement »), capture 390
  regardée.
- Rouges d'avant, pas de ce lot : `audit-politique-hotes --prouve` « ligne des logos retirée »
  (rouge aussi sur origin/main) ; banc `transporteurs.cjs` (hors CI, 16 KO `data-n=null` sur des
  colis Mondial Relay / Chronopost, aucun Colissimo dedans).

## 5. Le geste de Julien (pas-à-pas complet : `2026-11-13-guide-cles-transporteurs.md`)

**Jamais une clé collée dans une conversation** — elle va seulement dans Vercel.

**Colissimo / La Poste**
1. <https://developer.laposte.fr> → Se connecter / Créer un compte → valider l'e-mail.
2. Mes applications → Créer une application « VRM ».
3. Catalogue → **Suivi v2** (<https://developer.laposte.fr/products/suivi/2>) → Souscrire (offre gratuite, application VRM).
4. Mes applications → VRM → **Copier** la clé d'API.
5. <https://vercel.com> → cancale-v67 → **Settings → Environment Variables** → Key `LAPOSTE_OKAPI_KEY`, Value = la clé, Production → **Save**.
6. **Deployments** → « … » sur la dernière Production → **Redeploy**.
7. Achats : « Confirmé chez Colissimo … » sous un colis Colissimo.

**UPS**
1. <https://developer.ups.com> → Log In (ou Sign Up, gratuit).
2. Apps → Add Apps / Create Application « VRM » (callback `https://vrm.center` si demandé ; si un n° de compte UPS est exigé, compte gratuit sur ups.com).
3. Ajouter le produit **Tracking**.
4. Copier **Client ID** et **Client Secret**.
5. Vercel → Settings → Environment Variables → `UPS_CLIENT_ID` puis `UPS_CLIENT_SECRET` (Production) → Save.
6. Deployments → Redeploy.
7. Achats : « Confirmé chez UPS … » sous un colis 1Z….
