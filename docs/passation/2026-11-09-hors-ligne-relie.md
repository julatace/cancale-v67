# 9 nov. — Ouverture hors ligne à froid + « compte Vinted déjà relié » dans l'app

Branche `claude/hors-ligne-relie` (depuis `origin/main`), poussée à chaque commit, **pas de PR ni de
merge** (consigne). Aucune migration, aucune route ajoutée (12 fonctions inchangées), **extension
inchangée** (pas de 5.340 : rien n'était indispensable côté extension).

Décision de Julien (9 nov., réponse à la proposition 2 « je ne le fais que sur un oui explicite » :
« vas-y, fais absolument tout ») : OUI à l'ouverture hors ligne à froid, et OUI au « compte déjà
relié » dans l'app.

## 1. L'ouverture hors ligne à froid

### Avant
`src/PorteConfidentialite.jsx` échoue fermée : VRM fermé puis rouvert sans réseau restait sur
« Vérification indisponible ». Ma journée hors ligne, les codes, les bordereaux gardés, l'inventaire
hors connexion n'étaient joignables qu'avec l'app DÉJÀ ouverte (et même là, un retour sur l'onglet
après 60 s refaisait la vérification, échouait, et refermait l'app).

### Maintenant (`src/porteHorsLigne.js` = la règle, la garde, le modèle de menace)
- **Quand on consulte le laissez-passer** : seulement quand la vérification n'a pas pu partir — aucune
  réponse HTTP (`fetch` qui lève) ou `navigator.onLine === false`. Un serveur qui RÉPOND non (401,
  séparation non confirmée) ou « pas su » (503) ferme comme avant.
- **Le laissez-passer** `vrm_porte_ok_{uid}` = `{ uid, at, rt }`, écrit UNIQUEMENT après une réponse
  serveur `{ok:true, uid}` égale à la session (`noterVerification`). `rt` = empreinte FNV du jeton de
  renouvellement : il vaut pour LA session vérifiée.
- **Ce qui passe** : session rangée (jeton d'accès + renouvellement + uid) ; `sub` du jeton = uid ;
  drapeau du MÊME uid, MÊME session, daté de moins de **7 jours** (et pas dans le futur > 5 min) ;
  dernier état d'abonnement lu sur cet appareil pour CE compte (`vrm_abo_dernier_{uid}`, écrit par
  `PorteAbonnement` à chaque lecture serveur : acces, lecture, statut, fin de période… aucun prix,
  aucun identifiant Stripe). Raisons d'un refus (dites dans `data-confidentialite-raison`) :
  `session`, `jeton`, `aucun`, `autre-compte`, `perime`, `autre-session`, `abonnement-inconnu`.
- **Pourquoi 7 jours** : une tournée, un week-end, un dépôt sans 4G (au-delà, les données gardées sont
  vieilles : Ma journée hors ligne passe en ambre après un jour) ; c'est la plus courte période qui
  puisse finir sans que l'appareil le sache (l'essai gratuit) ; la même borne que « Plus tard » de la
  double vérification. Au pire, un abonnement fini / un compte supprimé / une session révoquée ailleurs
  laisse REVOIR ses propres données déjà sur l'appareil 7 jours de plus, sans rien pouvoir écrire.
- **« Session expirée »** : hors ligne, un jeton d'accès passé son heure (1 h, Supabase) est normal —
  impossible à renouveler sans réseau, il n'est pas jugé ; ce qui fait foi est la session VÉRIFIÉE
  (empreinte) et la date de la vérification. Un renouvellement REFUSÉ (`authRefresh` → false) efface
  la session (`writeSession(null)`), qui efface maintenant aussi tous les `vrm_porte_ok_*`.
- **Mode hors ligne = lecture seule** (`poserHorsLigne`, `installerGardeHorsLigne` posée au chargement
  d'App.jsx) : toute requête vers la base (REST, stockage, rpc, fonctions — lecture comme écriture) et
  vers nos `/api/` est refusée DANS la page comme une coupure (`TypeError('vrm-hors-ligne')`), sauf
  la vérification (`GET /api/compte?mode=confidentialite`) et le renouvellement de session
  (`POST /auth/v1/token?grant_type=refresh_token`). Les messages de l'app à l'extension (`{__vmr}`)
  sont arrêtés, sauf `ping`. La file d'envoi garde ses saisies (une entrée ne sort que sur une
  écriture ACCEPTÉE) : elles partent après la vérification.
- **Bandeau** (classes existantes `vrm-bandeau-abo*`, `data-hors-ligne-froid`) : « Hors ligne · lecture
  seule. Tu vois ce qui est déjà sur cet appareil (vérifié le …). Rien n'est envoyé ni enregistré sur
  VRM avant le retour du réseau. » + « Réessayer ».
- **Retour du réseau** : l'évènement `online` (et le réveil habituel) refait la vérification tout de
  suite ; jeton expiré ⇒ renouvelé d'abord (un 401 sur un jeton simplement vieux n'est pas un refus).
  Oui ⇒ drapeau redaté, garde levée, et l'app se REMONTE si elle avait été ouverte à froid (tout est
  relu du serveur). Non (401 session refusée, séparation non confirmée) ⇒ refermée aussitôt, drapeau
  effacé. L'abonnement relu reprend la main (aperçu, porte).
- **Sans abonnement** : hors ligne, `PorteAbonnement` publie le dernier état gardé (jamais réécrit
  depuis une supposition) ; « sans abonnement » ⇒ l'APERÇU (extrait net, reste flouté, `inert`) ;
  base sans la 027 ⇒ la porte d'abonnement. Un essai/abonnement résilié dont la fin est passée devient
  « sans abonnement » hors ligne (`abonnementHorsLigne`).
- **Effet de bord voulu** : l'app ouverte qui perd le réseau ne se referme plus au retour sur l'onglet
  (elle passe en hors ligne, sans se remonter : la feuille d'inventaire reste au même point).

### ⚠️ Modèle de menace
Le drapeau vit dans `localStorage` : quiconque tient l'appareil déverrouillé (ou exécute du code dans
la page) peut l'écrire, le dater, le recopier. Ce que ça lui donne : **exactement ce qui est déjà sur
l'appareil** (localStorage, réserves `vrm-hl-*` des QR et bordereaux, cache de l'app) — ce qu'il lirait
de toute façon dans les outils du navigateur. Ce que ça ne lui donne JAMAIS :
- aucune donnée du serveur : en mode hors ligne, la garde refuse toute lecture vers la base et nos
  routes (et le serveur ne voit jamais le drapeau ; RLS reste la seule autorité) ;
- aucune écriture vers la base ni action par l'extension (garde + aucune session envoyée à l'extension) ;
- rien d'un AUTRE compte : le drapeau est lié à l'uid de la session ET à SA session (empreinte), le
  `sub` du jeton doit dire le même compte ; un changement de compte efface tout `vrm_*`
  (`ensureLocalOwner`).
Qui contourne la garde (outils du navigateur) n'obtient rien de plus que ce qu'il aurait avec la
session déjà rangée — c'est-à-dire un jeton que le serveur juge seul. Le laissez-passer n'est donc
pas une protection : c'est une **commodité d'affichage hors ligne**, bornée pour que l'app ne se
présente pas ouverte sur la foi d'une vérification ancienne ou d'un autre compte. La protection de
l'appareil reste son verrouillage et « Se déconnecter » (qui efface `vrm_*`).
Résiduel accepté : pendant 7 jours au plus, un compte fermé/révoqué voit encore ses propres données
déjà gardées sur l'appareil, en lecture seule.

## 2. « Ce compte Vinted est déjà relié à un autre compte VRM »

- **Où le refus est connu** : `api/vinted-connect.js` (5.332/029), 409 `deja_relie` → `noterLitige`
  écrit chez le DEMANDEUR `app_data` `vrm_vinted_litige_{id Vinted}` = `{ vinted_user_id, at, source }`
  (jamais l'autre propriétaire, aucun jeton). Rien à changer côté serveur ni extension.
- **Ce que l'app lit** (`lireLitigesVinted`, App.jsx) : SA ligne, sous sa session, projetée
  (`id,vid:data->>vinted_user_id,at:data->>at`), puis le pseudo que SON navigateur a lu
  (`harvest_{id}_profile`, `login` projeté) ; sinon « n° {id} ». Aucune route de plus.
- **La règle** `src/vintedDejaRelie.js` : ligne qui dit un autre compte que son nom ⇒ écartée ;
  compte depuis relié chez soi ⇒ plus rien ; comptes pas lus ⇒ rien (pas su) ; « Masquer » vaut pour
  CE refus (date) sur cet appareil (`vrm_deja_relie_vu`), un refus plus récent revient.
- **La carte** `src/AlerteDejaRelie.jsx` (classe existante `vrm-cl-alerte`) : « Le compte Vinted
  « pseudo » est déjà relié à un autre compte VRM » · ce que ça veut dire (un seul compte VRM par compte
  Vinted ; rien de ce compte n'arrive ici) · le geste : se reconnecter avec l'autre compte VRM
  (« Changer de compte VRM », confirmé ⇒ déconnexion) ou « Écrire au support » (mailto `contact.js`,
  sujet avec le n° Vinted). Jamais l'autre compte VRM ni son e-mail (le serveur ne les donne pas).
- **Où** : Paramètres → Comptes liés (en tête ; l'ancienne ligne « en direct » `vinted-pris` se tait
  pour un compte que la carte dit déjà) et le guide de démarrage de Ma journée (là où il attend son
  nouveau compte).

## 3. Preuves
- **Banc `scripts/bancs/hors-ligne-froid.cjs`** (vraie porte, `BANC_PORTE_STRICTE`, base et `/api/`
  coupées comme un réseau absent ; 390 tactile + 1512) : **80/80 verts**. A : même uid ⇒ ouvert,
  bandeau, cœur monté, aucune requête de boutique, écriture/lecture/`/api/` tentées dans la page
  refusées par la garde, aucun message `__vmr` hors `ping`, aucune erreur ; B autre uid, C drapeau
  d'un autre écrit sous cet uid, E > 7 j, F autre session, G jeton d'un autre compte, H abonnement
  jamais lu ⇒ fermé, cœur pas monté, aucune lecture ; D sans session ⇒ écran de connexion ; I dernier
  état « sans abonnement » ⇒ carte de l'aperçu + écran marqué ; J retour réseau, serveur 401 ⇒ refermé,
  drapeau effacé ; K retour réseau, oui ⇒ bandeau parti, drapeau redaté, lectures reparties.
  - **Sur `origin/main`** (git archive + build, `BANC_DIST`) : **44 rouges**.
  - **Mutations** : contrôle de l'uid du drapeau retiré ⇒ rouge (C) ; garde jamais posée ⇒ rouge (A).
  - Captures regardées : `captures/hors-ligne-froid-390.png` (bandeau en haut, recouvre le haut de la
    carte « Je n'arrive pas à joindre tes données » au téléphone — lisible, à revoir par
    `claude/direction-artistique-6`), `-apercu-1512.png` (aperçu + carte « Ton abonnement a pris fin »).
- **`scripts/audit-deja-relie.cjs`** : route EXÉCUTÉE (409, Vinted pas appelé, litige chez le
  demandeur avec 3 champs, ni uid ni e-mail de l'autre compte dans la réponse ou une écriture), règle,
  branchement : **21/21** ; `--prouve` : **5/5 mutations rouges**. Sur `origin/main` : rouge (module absent).
- Verts : `npm run build`, audits variables, tdz, coherence, identite, statuts, fonctions-api,
  abonnement, abonnement-propre, comptes-securite, confidentialite-sql, inventaire-hors-ligne,
  journee-hors-ligne, sans-session-envoi ; tests confidentialite + securite-routes.
  `audit-garde-ecrans` : 1 rouge DÉJÀ sur `origin/main` (`CaptureJournee`, pas de ce chantier).

## 4. Risques restants / pas fait
- Pas mesuré sur un vrai iPhone en mode avion (le banc coupe les requêtes, pas la radio) ; iOS peut
  dire `navigator.onLine === true` sans réseau : on retombe alors sur l'échec du `fetch` (jusqu'à 15 s
  d'attente sur un réseau qui pend).
- Le service worker doit avoir l'app en cache pour l'ouvrir sans réseau (déjà le cas, `vrm-shell-v6`).
- La carte « déjà relié » n'a pas de banc de RENDU (l'audit juge règle, route et branchement).
- Un litige reste dans sa ligne après résolution par le support s'il ne relie jamais le compte : il
  peut le masquer.

## 5. Geste de Julien
Aucun. (Ouvrir VRM une fois avec du réseau après la mise en ligne : le laissez-passer et le dernier
état de l'abonnement s'écrivent alors.)
