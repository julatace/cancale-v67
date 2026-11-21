# 6 nov. — « Signaler un problème » et la page d'état publique `vrm.center/etat`

Branche `v36-signaler-etat` (partie de `claude/project-review-nsk5su`). Deux fonctions
décidées par Julien le 6 nov.

## 1. « Signaler un problème », en un bouton

**Où** : Paramètres → Réglages → « Besoin d'aide ? » → **Signaler un problème** ; et dans
le garde-fou d'écran (`EcranGardeFou`, « Cet écran n'a pas pu s'afficher »), à côté de
« Recharger l'app ». Le composant est réutilisable :
`<SignalerProbleme ecran={tab} taille="petit"/>` dans App.jsx (le relais fournit le vrai
contexte) — la branche `v36-filets` (garde-fous par écran) n'a qu'à le poser.

**Ce qui part** (une règle, `normaliserSignalement`, `api/_lib/signalement.js`, la MÊME
pour l'aperçu de l'app et pour le serveur, idempotente) :
- le texte tapé (2 000 caractères au plus ; e-mail, jeton, uuid, IBAN, suite de 9
  chiffres ou plus et paramètres d'adresse web **masqués** — l'aperçu montre le texte
  masqué, c'est lui qui part) ;
- l'écran ouvert et celui d'avant (une liste fermée : les `tab` de l'app ; tout autre
  nom devient vide — un pseudo ne peut pas passer pour un écran) ;
- la version de l'app (`BUILD_ID`, celle que `src/plantages.js` note, forme stricte) ;
- la version de l'extension si elle a répondu ICI (`vmrExtVersion()`) ;
- le navigateur (`motsNavigateur()`, liste fermée = `NOM_NAV`, sinon « inconnu ») ;
- la taille d'écran ;
- les 5 derniers plantages de CET appareil : `src/plantages.js` garde désormais à part
  (`vrm_plantages_recents`, appareil seulement) les 5 dernières entrées notées — message
  déjà nettoyé, écran, origine, version, date (pas la pile).

Rien d'autre : le serveur rejoue la règle sur le corps reçu ; un champ inconnu ne passe
pas. S'y ajoutent, côté serveur, l'identifiant du compte VRM **pris dans SA session**
(jamais un champ du corps — ni son e-mail), l'heure, et `traite:false`. La feuille le dit.

**Il voit exactement ce qui part** : l'aperçu (lignes « Écran ouvert », « Version de
l'app »…, les plantages dépliables) et « Le texte exact envoyé » (le JSON posté, mot pour
mot — le banc compare le corps posté à ce texte).

**« Envoyé » ne se dit que sur la confirmation du serveur** (`ok:true` + l'id rangé) ;
réseau coupé, 5xx, réponse sans id ⇒ « Pas envoyé : … » avec la raison, le texte reste
dans le champ (`posterSignalement`, `phraseRefus`).

**Où c'est rangé — et pourquoi pas chez le neutre.** Les plantages d'un client sont
rangés dans SA base (RLS) : Julien ne les voit jamais. Un signalement doit arriver à
l'éditeur : la route (`/api/compte?mode=signalement`, clé de service) le range dans
`app_data` du **propriétaire de l'installation** = `VRM_OWNER_UID` (la variable que toutes
les routes serveur lisent pour « l'installation »), sinon `vrm_reglages.proprietaire`
(migration 006, la règle de `vrm_acces`). Pas su ⇒ 503, **rien n'est rangé nulle part**
(le propriétaire NEUTRE est une quarantaine d'e-mails que personne ne lit).
Ligne : `signalement_<AAAAMMJJHH UTC>_<12 premiers caractères du compte>_<1..5>`.

**Anti-abus : 5 par heure et par compte, tenu par la base.** Cinq places par heure ;
chacune se réserve par une écriture « si absente » (`resolution=ignore-duplicates`,
`return=representation` : `[]` = place prise). 8 envois simultanés ⇒ 5 rangés, 3 × 429.
La 6ᵉ ⇒ 429 « 5 signalements par heure au plus. Réessaie dans N min. », rien d'écrit.
(Plage horaire calendaire UTC.)

**La notification** : à chaque signalement, `sendPushToAll` (le chemin push existant)
dans le contexte du PROPRIÉTAIRE (ses appareils, son centre de notifications), catégorie
`signalement` (hors familles : comme l'essai, elle n'a pas d'interrupteur), « 🛟 Problème
signalé · <écran> · « extrait » », étiquette propre à chaque signalement. **Plus de 3 dans
l'heure** (toute l'installation) ⇒ regroupées : étiquette commune `vrm-signalements` (la
nouvelle remplace l'ancienne sur le téléphone), « 🛟 N problèmes signalés depuis une
heure · Dernier : … ». Le toucher mène à `?tab=settings&section=signalements` (la liste
s'ouvre). Une notification ratée ne rend jamais le signalement « pas envoyé » : il est rangé.

**La liste du propriétaire** : Paramètres → Réglages → « Besoin d'aide ? » →
**Signalements reçus** (ligne visible au propriétaire seul — `useEstProprietaire` ; le
serveur refuse tout autre compte, 403). « À traiter · N » / « Tous », chaque
signalement : écran (et celui d'avant), texte, versions, navigateur, taille, 8 premiers
caractères du compte, plantages dépliables, **Traité** / **Rouvrir** (lire puis réécrire
la ligne ; lecture ratée ⇒ rien d'écrit, 503).

## 2. La page d'état publique `vrm.center/etat`

`public/etat.html` + `public/etat.js` (pas l'app, pas React ; aucun script en ligne — la
CSP n'en permet aucun), réécriture `/etat → /etat.html` dans `vercel.json`. Le service
worker la laisse au réseau (sinon la navigation la rangeait sous « / » à la place de
l'app, comme les pages légales).

Elle lit `/api/sante` et `/etat-version.json` et dit : **« Tout fonctionne »**,
**« Panne en cours sur … »** (ambre), **« Rien ne signale de panne — pas vérifié pour
l'instant : … »** (une sonde muette n'est ni une panne ni un feu vert), ou, si
`/api/sante` ne répond pas, **« VRM ne répond pas — nous sommes prévenus »**. Lignes :
base de données, réception des e-mails, notifications, extension (version servie),
heure de la dernière vérification. Rafraîchie toutes les 60 s **seulement si la page est
visible** (et tout de suite au retour si plus de 60 s ont passé). Palette Apple (blanc,
encre, bleu rare = le point « Tout fonctionne » et les liens, ambre = panne), police
système, clair/sombre (le choix fait dans l'app, `vinted_dark`, sinon le système).

**`/api/sante`** (api/compte.js) garde ses oui/non (le contrôle quotidien
`verifier-production.mjs` les lit) et ajoute `etat` (`api/_lib/etat-public.js`) :
- `base` : UNE requête courte (deux scalaires `at`/`etat` des lignes du collecteur,
  propriétaire NEUTRE ; 4 s au plus) — `ok` si elle répond, sinon `panne` ;
- `emails` : clé `EMAIL_INBOUND_SECRET` absente ⇒ `panne` (la route refuse alors tout
  e-mail) ; sinon le collecteur Gmail (il passe chaque minute) : passé il y a moins de
  30 min ⇒ `ok` ; plus ⇒ `panne` ; plus de 7 jours ⇒ `inconnu` (outil retiré, la
  réception passe peut-être par le Worker) ; erreur sans succès depuis 15 min ⇒ `panne` ;
  base tombée ⇒ `inconnu` ;
- `notifications` : clé VAPID lisible ET clé de service ⇒ `ok`, sinon `panne` ;
- `verifieA` : l'heure de la mesure.
Gardé **30 s en mémoire** par instance et `Cache-Control: public, max-age=0, s-maxage=30`.
Aucune donnée d'un vendeur. `verifier-production.mjs` échoue aussi quand `etat` dit une
panne (c'est ce qui rend « nous sommes prévenus » vrai : e-mail de GitHub, toutes les 6 h).

**La version de l'extension servie** : posée au build par `vite.config.js`
(`etat-version.json`, lue dans `vinted-sync-extension/manifest.json` — le dossier que le
zip publié contient, `audit-extension-zip` tient zip = dossier). Rien à tenir à la main.

## Preuves

- `node scripts/audit-signalement.cjs` — 62 contrôles, EXÉCUTE `api/compte.js`
  (`mode=signalement`, `mode=sante`) contre une fausse base de forme PostgREST
  (`scripts/bancs/_minipgrest.cjs` : filtres, `data->>`, `order`, `on_conflict` +
  `resolution`, PATCH). Jeu inventé riche (pseudos, e-mails du corps, du texte et de la
  session, IBAN, jeton, n° de transaction, téléphone, titre, prix, adresse, code de
  retrait, uuid d'un autre) : aucune valeur dans la base, le centre de notifications, la
  liste, ni `/api/sante`. Anti-abus (6ᵉ, rafale de 8, autre compte, heure suivante),
  écriture ratée / destinataire pas su / clé absente ⇒ 503 et la vraie
  `posterSignalement` dit « Pas envoyé ». `--prouve` : **12/12 mutations rouges**.
  Sur l'arbre d'avant (`git archive 46f18482`) : rouge (module absent).
- `node scripts/bancs/signaler-etat.cjs` — la feuille et la liste (esbuild, vraies
  feuilles de style, CSP de vercel.json) et `/etat` servie comme Vercel
  (`_vercel.servir`), 390 tactile et 1512, clair et sombre, horloge tenue
  (`page.clock`) — 82 contrôles, zéro violation de CSP ; captures regardées.
- `audit-abonnement` : le contrôle « santé ne rend que des oui/non » accepte `etat` (trois
  mots permis + une date), toujours aucun secret.
- Verts : `npm run build`, `audit-fonctions-api` (12), `audit-coherence`, `audit-secrets`,
  `audit-csp`, `audit-verifier-production`, `audit-coque-parametres`, `audit-cibles-notif`,
  `audit-notifications`, `audit-notifs-centre`, `audit-icones`, `audit-relances-essai`,
  `audit-lancement`, `audit-vapid`, `audit-journee-hors-ligne`.

## Ce qui reste / gestes

- Rien à poser : la route utilise `SUPABASE_SERVICE_KEY` et `VRM_OWNER_UID` (ou
  `vrm_reglages`), déjà en place. Sans `VAPID_PRIVATE_KEY`, le signalement est rangé
  mais ne sonne pas (et `/etat` dit « Notifications : en panne »).
- Si `EMAIL_INBOUND_SECRET` n'est pas posée sur Vercel (voir « Gestes attendus »),
  `/etat` affichera « Panne en cours sur la réception des e-mails » — c'est la vérité :
  la route refuse alors tout e-mail.
- La plage anti-abus est l'heure calendaire UTC (5 à 10 h 59, puis 5 à 11 h) — pas une
  fenêtre glissante.
- Geste de Julien : Paramètres → « Signaler un problème », s'envoyer un essai ; ouvrir
  `vrm.center/etat`.
