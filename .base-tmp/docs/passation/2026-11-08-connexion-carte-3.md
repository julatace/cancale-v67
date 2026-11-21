# 8-9 nov. 2026 — Extension 5.330 : code par e-mail, Google / Discord dans le MÊME onglet (carte du logo)

Branche `claude/connexion-carte-3` (depuis `origin/main`, qui sert la 5.329). Pas de PR, pas de merge (consigne).

## Ce que Julien a dit (sur la 5.329)
« Il n'y a pas la connexion Discord et Google, parce que certains ont créé leur compte comme ça » — ces
comptes n'ont PAS de mot de passe. Il refuse qu'un AUTRE onglet s'ouvre (la connexion s'y perdait) et ne
veut pas passer par le site. En 5.329 la carte n'avait que e-mail + mot de passe sur Orion (Google/Discord
seulement en petite fenêtre, qu'Orion n'a pas).

## Ce que la carte montre (pas connecté), dans cet ordre
1. « E-mail de ton compte VRM » ;
2. **« Me connecter avec un code »** (bouton principal, bleu Apple) — « Un code à 6 chiffres arrive sur cet
   e-mail. Marche aussi si tu as créé ton compte avec Google ou Discord. » ;
3. « J'ai un mot de passe » (déplie le champ mot de passe ; l'e-mail est gardé ; « Recevoir un code à la
   place » le replie ; « Mot de passe oublié ? » n'apparaît que là) ;
4. « ou », « Continuer avec Google », « Continuer avec Discord » (seulement si Supabase les dit activés —
   mesuré le 8 nov. : `google: true`, `discord: true`).
Après « Me connecter avec un code » : « Code envoyé à x@y. Regarde ta boîte mail (et les indésirables). »,
6 cases (un vrai champ `inputmode=numeric`, `autocomplete=one-time-code` posé dessus : l'iPhone peut proposer
le code, coller un code complet le valide tout seul), « Valider le code », « Renvoyer le code (dans 58 s) »,
« Changer d'e-mail ». Connecté : « Connecté à VRM : x@y » puis « C'est fait : l'extension est connectée. »
(l'adresse dite une fois). Champs 44 px, 16 px, clair/sombre suivent le système.

## Le code par e-mail (`background.js`)
- `authCodeDemande` : `POST /auth/v1/otp` `{ email, create_user:false }` — **jamais de compte créé depuis la
  carte** ; 422 (`otp_disabled`, adresse inconnue) ⇒ « Aucun compte VRM avec cet e-mail… » ; 429 / « only
  request this after N seconds » ⇒ « Trop de demandes de code : réessaie dans N s » ; captcha ⇒ dit. Un second
  envoi à la même adresse < 60 s est refusé sans appel (le bouton « Renvoyer » compte aussi les 60 s).
- `authCodeVerif` : `POST /auth/v1/verify` `{ type:'email', email, token }` ⇒ la session passe par
  `adopterSessionAuth` — **le même chemin que le mot de passe** (`saveSession` ⇒ `rangerSession` relu et
  vérifié, `visiteApresSession`). GoTrue répond `otp_expired` pour un code faux ET expiré : on dit « Ce code
  n'est pas le bon (ou il a expiré)… », et « Ce code a expiré » seulement si NOTRE envoi a plus d'1 h.
- Le **code n'est rangé nulle part** et ne passe dans aucune adresse ; on garde seulement `vrmCodeEnvoi`
  `{ email, at }` pour que la carte reprenne aux cases si iOS a rechargé Vinted pendant qu'il lisait Mail
  (15 min), effacé dès la connexion. `authCodeEtat` le lit.
- Messages acceptés seulement d'un onglet (`from:'vrm-badge'`, `sender.tab`), comme `authLogin`.
- Longueur du code : **pas lisible** depuis `/auth/v1/settings` (mesuré le 8 nov. : le champ n'y est pas). 6
  par défaut chez Supabase ; on accepte 6 à 10 chiffres (les cases s'allongent ; pas de validation
  automatique sur la frappe, seulement sur un code collé/proposé d'un coup).
- Le bouclier de la 5.329 arrêtait la saisie sur `window` en capture — y compris pour NOS champs : la saisie
  du champ du code lui est remise par le bouclier lui-même avant l'arrêt (`surSaisieCode`, lu via
  `ombre.activeElement` car une racine fermée cache sa cible vue de `window`). La page n'entend toujours rien.

## ⚠️ Le modèle d'e-mail Supabase « Magic Link » DOIT contenir le code
`/auth/v1/otp` envoie le modèle **Magic Link** (compte existant). Sans `{{ .Token }}` dedans, l'e-mail n'a
qu'un lien, aucun code. L'autre agent refait `supabase/templates/*.html` sur `claude/recuperation-mails` (pas
touché ici). Ligne à exiger dans `supabase/templates/magic_link.html` :

```html
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">{{ .Token }}</p>
```
(et une phrase : « Ton code de connexion VRM : … — il marche une fois, pendant 1 heure. ») Puis le recoller
dans Supabase → Authentication → Email Templates → Magic Link. SMTP Brevo (noreply@vrm.center) déjà branché ;
limite Supabase 100 e-mails/h.

## Google / Discord sans petite fenêtre (Orion) : le MÊME onglet
- La carte demande `oauthDepart` (`{ carte:true }` côté service worker) ; si `chrome.windows.create` existe
  (ordinateur) : petite fenêtre, inchangé. Sinon (`__vrmOrionCompat`) : le service worker range le
  vérificateur PKCE ET la page de départ (`retour`, lue sur `sender.tab.url`, jamais sur le message, seulement
  https vinted/leboncoin/ebay.fr/vestiaire : `retourOAuthPermis`) dans `vrmOAuthDepart` (relu avant de partir),
  et rend l'adresse `…/auth/v1/authorize?provider=…&redirect_to=https://vrm.center/extension-retour.html&code_challenge=…&code_challenge_method=s256`.
  La carte fait `location.assign(url)` dans CET onglet (adresse revérifiée : `*.supabase.co/auth/v1/authorize?provider=google|discord&`).
- Retour : `extension-retour.html` (page fixe, sans script) ; le script de contenu `oauth-retour.js`
  (document_start, vrm.center ; présent dans le paquet Orion MV2 avec `compat-orion.js` devant — **aucun
  `externally_connectable`, donc le bug 13767 ne joue pas** : c'est `chrome.runtime.sendMessage` d'un script
  de contenu vers sa propre extension) remet le code ; `oauthRetour` échange avec SON vérificateur, range la
  session (`saveSession`), ne ferme AUCUN onglet en mode même-onglet et rend `retour` ; `oauth-retour.js`
  revérifie l'adresse et fait `location.replace(retour)`.
- Sur la page Vinted, `etatSite` rend `oauthRevenu` UNE fois (`vrmOAuthEtat.vu`, 5 min, même onglet) : la carte
  s'ouvre seule et dit « Connecté à VRM : x@y », ou l'erreur (« Connexion avec Discord annulée : rien n'a
  changé. ») au-dessus du formulaire.
- AUCUN `chrome.tabs.create`, `tabs.update`, `tabs.remove`, `window.open` sur ce chemin. La fenêtre de l'icône
  (popup.js) est inchangée.

## Preuves (§6)
- `scripts/bancs/carte-orion-sans-onglet.cjs` (vrai `vrm-badge.js`, vrai `oauth-retour.js` sur la vraie
  `public/extension-retour.html`, vrai `background.js`, faux GoTrue étendu : /otp, /verify, PKCE) : **45
  verts**. Juge : ordre des moyens, un seul champ, 44 px, bleu Apple clair/sombre ; adresse inconnue ⇒ dit,
  `create_user:false`, rien rangé ; 6 cases `one-time-code` ; renvoi à 60 s ; reprise après rechargement ;
  mauvais code ⇒ dit, rien rangé, cases vidées ; bon code ⇒ session rangée ; code et mot de passe nulle
  part (stockage, adresses visitées, adresses appelées) ; Google sans fenêtre ⇒ CET onglet va à authorize
  (PKCE s256), revient sur la page Vinted d'ORIGINE (même adresse, `?vue=bas#photo` compris), carte
  « Connecté à VRM : google@… », aucune ouverture ; vérificateur jamais dans une adresse, une fois ; carte
  pas rouverte au rechargement suivant ; Discord annulé ⇒ retour, « annulée », rien rangé ; ordinateur ⇒
  petite fenêtre, la page ne bouge pas.
- Sur la 5.329 (fichiers de `origin/main` passés par `--badge/--src/--retour`) : **15 rouges**.
- Mutations : `oauthDepart` même-onglet qui ouvre `chrome.tabs.create` ⇒ 6 rouges ; `create_user:false`
  retiré ⇒ 6 rouges.
- `scripts/bancs/badge.cjs` : remis à la règle (un seul champ, bouton `[data-principal]`) ; 2 rouges
  restants **de chronologie** (« il y a 2 min » lu « il y a 3/4 min » : le banc fige ses âges au départ et
  tourne plusieurs minutes ici) — sans lien avec la carte.
- Verts : `audit-extension-zip`, `audit-paquets-boutiques`, `audit-extension-oauth`,
  `audit-sans-session-envoi`, `audit-extension-ui`, `audit-coherence`, `audit-pont-session`,
  `audit-extension-navigateurs`, `audit-violet`, `tests/extension-reste-connecte` (12), `tests/orion-auth-autonome`.
- Captures regardées (390 tactile) : `carte-orion-formulaire-light/dark`, `carte-orion-code-light/dark`,
  `carte-orion-google-retour-light`, `carte-orion-google-annule-dark`, `carte-orion-connecte-light/dark`.

## Version
5.330.0 : `CODE_VERSION`, manifeste, `lbc-inject.js`, `lbc-relay.js`, `EXT_ATTENDUE`,
`EXT_CAPACITES.cartecode` (→ `authCodeVerif`, audit-coherence), table §8, paquets régénérés. Aucune permission ajoutée.

## Pas fait / pas vérifié
- Rien sur un vrai iPhone : que la navigation de l'onglet Orion vers Supabase/Google puis le retour gardent le
  service worker de l'extension (MV2 non persistant) est au banc, pas mesuré.
- La longueur réelle du code du projet n'a pas pu être lue (6 par défaut).
- L'e-mail avec code dépend du modèle Magic Link (ci-dessus) : tant qu'il n'a pas `{{ .Token }}`, le code
  n'arrive pas (le lien de l'e-mail, lui, connecterait le SITE, pas l'extension).

## Gestes de Julien
1. Supabase → Email Templates → Magic Link : y mettre `{{ .Token }}` (ligne ci-dessus).
2. Supabase → Redirect URLs : `https://vrm.center/extension-retour.html` (déjà demandé en 5.328).
3. Installer la 5.330 (`VRM-Orion-dossier.zip` sur l'iPhone, zip sur ordinateur).
