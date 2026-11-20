# 20 nov. (nuit) — Vérification visible, envois « comme Bleam » (extension 5.410.5)

Branche `claude/captcha-visible`. Point de départ : capture de Julien, 20 nov. 22:29 — messages aux favoris (15 cochés,
séquence `sequenceFavoriBleam`), au premier : « 0 sur 15 envoyés · 14 en attente · 1 pas envoyé », « Vinted demande une
vérification (anti-robot). Fais-la ici sur la page », et le grand panneau VRM ouvert par-dessus. Julien : **aucune
vérification n'était visible sur la page**.

## 1. Diagnostic (mesuré, lecture seule)

- Ligne `securite_etat_{navigateur}` publiée à 21:29:11 UTC : compte `robot: null`, `prudence: null` — aucun 403/429,
  aucun contrôle DataDome vu par `secuObserver`.
- File des favoris : la tentative de 21:29:17 UTC est `refuse`, raison `vinted_robot`, `ecrits: 1` (seule la
  conversation était ouverte).
- La transaction relue à 21:29:17.049 UTC (`harvest_*_txn_*`, capturée par l'extension à cet instant) contient
  `"is_suspicious": false` sur chaque photo.
- `freinFavoriAuto` cherchait les mots `captcha|datadome|automat|robot|bots?|…|suspicious` dans le JSON de TOUTE
  réponse, même `200`. ⇒ **faux positif** : une réponse normale a été prise pour un contrôle anti-robot. Le même
  `vinted_robot` avec `ecrits: 1` figure dans des files du 7 et 8 nov. (ancienne séquence) : le défaut existait avant
  Bleam ; il touche les annonces dont Vinted renvoie désormais `is_suspicious`.
- Aucune requête de la séquence ne partait hors de la page : toutes passaient par `vintedPage` (fetch de la page,
  `credentials: 'include'`, `x-csrf-token` et `x-anon-id` de la page, aucun `Authorization`).

**Corrigé** : une réponse 2xx/3xx n'est jamais un frein ; les mots ne se lisent que dans un refus, avec bord de mot
(`\bsuspicious` : une clé `is_suspicious` n'est pas le mot). Un vrai refus 403 + `captcha-delivery` reste un arrêt.

## 2. Bleam contre VRM, requête par requête (export de l'Observateur du 20 nov., 21:23 — formes et délais seulement)

Les en-têtes ne sont pas dans l'export (noms ni valeurs) : non comparables. Les requêtes de Bleam n'ont aucune pile de
page (elles ne passent pas par le `fetch` de la page, enveloppé par DataDome) ; elles partent de SES onglets vinted.fr
(`initiator` www.vinted.fr) : l'onglet 1 pour les messages et favoris (sur `/inbox/…`), un onglet ouvert à 197 s puis
fermé à 388 s pour la republication.

### Favori (Bleam à 453,6 s)

| # | Bleam | VRM avant (5.410.4) | VRM 5.410.5 |
|---|---|---|---|
| 1 | `POST /api/v2/conversations` `{initiator: seller_enters_notification, item_id, opposite_user_id}` — t = 0 | idem | idem, depuis l'onglet de travail |
| 2 | `GET /api/v2/conversations/{id}` — 0,76 s | relu seulement si la réponse de création ne suffisait pas | **toujours relu**, 0,8–1,6 s au hasard (jamais avant 0,76 s) |
| – | (pas de lecture de la transaction) | `GET /api/v2/transactions/{tx}` (prix, annonce indisponible) | **retiré** quand le fil dit le prix ou sans offre ; lu seulement pour une offre dont le prix n'est pas dans le fil |
| – | (pas de `mark_as_read`) | `PUT …/mark_as_read` | **retiré** |
| 3 | `POST …/replies` `{reply: {body, photo_temp_uuids: null}}` — 6,0 s | après 3,2–6 s + temps d'écriture | temps d'écriture VRM (5–45 s, au hasard) : jamais avant 6 s |
| 4 | `POST /api/v2/transactions/{tx}/offers` `{offer: {currency, price: "48"}}` — 11,0 s après le message | 8–15 s, `price: "45.00"` | **11–18 s** (plancher 11 s, au hasard), `price` sans `.00` |
| – | lectures de son interface (`/inbox`, `/conversations/{id}` toutes les 1–2 s) | — | non copiées (aucune utilité, des lectures en plus) |

### Répondre à un acheteur (Bleam à 102 s et 115 s)

| Bleam | VRM 5.410.5 |
|---|---|
| `PUT /api/v2/conversations/{id}/mark_as_read` (sans corps) puis, 6,7 s après, `POST …/replies` | `marquerLuCommeBleam` puis la réponse au moins 6,7 s après (+ 0–1,5 s au hasard) : réponse sur son clic (app, carte), message d'un refus d'offre |

### Republication (Bleam de 197 s à 388 s)

| Bleam | VRM |
|---|---|
| Onglet ouvert pour l'occasion ; page « Modifier » ; formulaire de vente rempli ; `POST /api/v2/item_upload/drafts` `{draft, parcel, upload_session_id}` ; `POST /api/v2/items/{id}/delete` (sans corps) ~33 s après ; `POST …/drafts/{id}/completion` `{draft, push_up, parcel, upload_session_id}` ~27 s après | Méthode « formulaire » (défaut, 5.410.3) : les requêtes sont envoyées PAR LA PAGE de Vinted elle-même ⇒ mêmes URL, corps et en-têtes par construction ; pauses VRM 5–15 s entre champs, 15–40 s entre suppression et « Ajouter » (au hasard). La méthode « Directe » (choisie à la main seulement) garde la forme mesurée chez Vintex (`feedback_id: null` en plus) : non copiée de Bleam. |

### Gestes VRM non observés chez Bleam

Contre-offre et acceptation d'offre du moteur, baisse de prix, masquer/afficher, bordereau, évaluation, après-vente :
**pas observés chez Bleam** (l'export ne les montre pas). Ils partent tous par `vintedPage` (page, cookies, jeton csrf
et `x-anon-id` de la page, aucun `Authorization`), donc depuis l'onglet de travail en 5.410.5 pour toute écriture.
Exception connue, gardée : la réponse à un message tapée dans l'app SANS aucun onglet vinted.fr ouvert (téléphone) part
encore du service worker (`vintedSend`, 5.342) — c'est son clic, un à la fois.

## 3. L'onglet de travail VRM (« comme Bleam : un petit onglet à lui »)

- `ongletTravailVinted` : une petite fenêtre à part (`chrome.windows.create`, type `popup`, 440 × 680, sans focus ;
  repli : onglet en arrière-plan), marquée en bas « Onglet de travail VRM — ne le ferme pas pendant les envois » et
  titre « VRM · … », réutilisée tant qu'elle est ouverte. Ouverte sur `/inbox` pour un favori.
- `vintedPage` : toute écriture (et les lectures d'une séquence d'envoi, `travail: true`) part de cet onglet ; les
  autres lectures restent sur SON onglet. SON onglet vinted.fr connecté sur ce compte reste exigé (sinon rien ne part),
  compte revérifié à chaque requête, une requête à la fois.
- Fermé pendant une série (vu par `chrome.tabs.onRemoved`) ⇒ arrêt dit une fois (`travail-ferme`), la suite en rouvre un.
- Délais : ceux de VRM, tirés au hasard (sa décision : « les délais aléatoires de VRM sont bien »), jamais plus courts
  que l'écart mesuré chez Bleam dans une séquence.

## 4. La vérification visible

- `vrm-badge.js` : dès qu'une vérification est PRÉSENTE (iframe `captcha-delivery`, `datadome`, reCAPTCHA, hCaptcha,
  Cloudflare), quel que soit le moteur, le panneau (grand ou petit), le rond VRM et les cartes se replient en une
  pastille en haut à droite (44 px, sous le bandeau de l'écran d'action au téléphone). Disparue ⇒ « Vérification faite —
  Reprendre ? ». La pastille rouvre le panneau. Rien n'est relancé seul.
- `vrm-action.js` : « fais-la sur la page, puis touche Reprendre » seulement si l'iframe est vue ; un refus anti-robot
  d'une requête sans rien sur la page dit « Vinted a refusé l'envoi (protection anti-robot) : le message n'est pas parti,
  on attend » ; « Reprendre » reste SON toucher, quand Vinted a répondu normalement depuis.
- Le texte de la file côté serveur (`api/_lib/favoris-file.js`) dit pareil.
- Aucun contournement : rien n'est cliqué ni lu dans la vérification, pas d'`isTrusted`, pas de CDP.

## 5. Preuves

- `scripts/audit-comme-bleam.cjs` (vrai `background.js`) : 38 verts ; F12 exactement les 4 requêtes de Bleam dans son
  ordre, F13 la vraie forme `is_suspicious: false` ⇒ envoyé, F14 un vrai 403 captcha reste un arrêt, F15 tout part de
  l'onglet de travail, F16 onglet fermé ⇒ arrêt dit ; `--prouve` : rouge sur `origin/main` et par 14 mutations.
- `scripts/bancs/captcha-visible.cjs` (Playwright, fausse page vinted.fr, iframe captcha plein écran SOUS le z-index
  de VRM) : 1280 et 390 px, 20 verts ; `elementFromPoint` au centre et en 4 points = l'iframe ; rien ne repart ;
  rouge sur l'extension de `origin/main` ; `--prouve` 3/3 mutations. Captures (exemple inventé) :
  `scripts/bancs/captures/captcha-visible/` (non versionnées).
- Verts : coherence, extension-zip, actions-gardees, discretion, traduction (5 langues), bleam-suite, action-continu,
  recreer, favoris-liste, favori-offre-message, messages-malins, moteur-offres, republication-parfaite, quoi-de-neuf.
  `audit-offres-auto` : 1 rouge déjà présent sur `origin/main` (non touché).

## 6. Geste de Julien

Installer la 5.410.5 (⟳ dans chaque Chrome). Au premier envoi, une petite fenêtre « VRM · Vinted » s'ouvre : la laisser
ouverte pendant les envois. Puis relancer les messages aux favoris (« Reprendre » sur la carte).
