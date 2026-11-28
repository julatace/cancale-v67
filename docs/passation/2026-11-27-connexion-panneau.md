# 27 nov. 2026 (23 h) — Extension 5.456.0 : on se connecte DANS le grand panneau flouté ; mot de passe et code réparés

Branche `claude/ext-connexion-panneau` (depuis `origin/main`, qui servait la 5.455.5). Pas de PR, pas de fusion (consigne).
Code des favoris non touché (`executerMessageFavori`, tableau des favoris, `api/_lib/favoris*`).

## Ce que Julien a dit (27 nov., 23 h), à propos de l'onglet « Connexion » de l'extension
« Je ne veux pas que ce soit un petit module à droite avec connexion à Google dans une autre page ou avec Discord. Je veux
que ce soit le gros panneau directement qui s'affiche avec les données floutées, comme on avait dit. Et on se connecte ici.
Comme ça, on voit un petit peu l'état du compte avant même de se connecter ou de créer un compte. Et pareil, je veux pouvoir
bien se connecter avec l'adresse mail et le mot de passe, parce que là, ça ne marche pas très bien. Pareil, avec le code, ça
ne marche pas. Tout doit être absolument parfait. »

## 1. La cause : la vérification anti-robot (MESURÉE sur le vrai Supabase)
Mesuré le 27 nov. vers 22 h 55, clé publique, adresse inventée `nobody@example.invalid` (rien créé, aucun e-mail envoyé) :

| appel | réponse du vrai Supabase |
|---|---|
| `GET /auth/v1/settings` | `email: true`, `google: true`, `discord: true`, `mailer_autoconfirm: false` |
| `POST /auth/v1/token?grant_type=password` (sans jeton) | **400** `{"code":400,"error_code":"captcha_failed","msg":"captcha protection: request disallowed (no captcha_token found)"}` |
| `POST /auth/v1/otp` (sans jeton) | **400**, la même réponse |
| `POST /auth/v1/verify` (code faux) | 403 `otp_expired` — pas protégé |

La protection Turnstile est allumée dans Supabase (l'app a la clé de site : `VITE_TURNSTILE_SITE_KEY:"0x4AAAAAAGNgOaYgd8NsqNB9"`,
lue dans le paquet servi par vrm.center). L'extension n'envoyait AUCUN jeton : **tout mot de passe et toute demande de code
étaient refusés, quel que soit le compte**. Julien lisait « utilise « Se connecter avec VRM » » ou « vérification que la
carte ne sait pas afficher ». Les bancs ne le voyaient pas : leur faux GoTrue (`scripts/tests/_faux-gotrue.cjs`) n'avait pas
de captcha (il en a un maintenant : `captcha: true`, `formeReelle: true`).

D'après le code de GoTrue (`internal/api/middleware.go`, `verifyCaptcha`) : sont exemptés le renouvellement
(`refresh_token`), le retour OAuth (`pkce`), `id_token`, et les appels à rôle admin. Le mot de passe et `/otp`, non. Aucune
exemption n'est utilisée ici : on ne contourne pas la protection, on lui donne son jeton.

## 2. La correction à la racine : le jeton vient de vrm.center
- **`public/verif-extension.html` + `.js`** : une petite page de VRM qui pose le widget Turnstile (clé de site de vrm.center ;
  elle ne vaut que sur ce domaine) et rend le jeton, par `postMessage`, à la page qui l'a posée — seulement si ce parent est
  permis (origine d'extension `chrome-/moz-/safari-web-/webkit-extension://…`, ou un site du panneau : Vinted, Leboncoin,
  Vestiaire), à SON origine exacte (jamais `*`), avec le nonce du cadre. Elle ne reçoit ni e-mail, ni mot de passe, ni code.
  `reset` en refait un (un jeton ne sert qu'une fois). ⚠️ La clé de site y est écrite : si elle change dans Vercel, la changer ici.
- **`vercel.json`** : `/verif-extension.html` se laisse encadrer par l'extension et les sites du panneau ; toute autre page
  reste `frame-ancestors 'none'` + `X-Frame-Options: DENY` (audit-entetes, audit-parcours-nouveau verts).
- **Le formulaire** (vrm-badge.js, carte et cadre ; popup.js, fenêtre de l'icône) pose ce cadre au-dessus du bouton ; la
  demande attend le jeton (12 s au plus), l'envoie UNE fois, le cadre en refait un. Case à cocher demandée ⇒ « Coche la case
  de la vérification, puis réessaie ». Cadre muet 3 s après son chargement (bloqué, refusé) ⇒ la demande part sans jeton et
  la réponse de VRM est dite (« désactive un bloqueur pour vrm.center, ou touche « Relier par vrm.center » »).
- **background.js** : `authLogin(email, password, captcha)` et `authCodeDemande(email, captcha, creer)` mettent le jeton dans
  `gotrue_meta_security.captcha_token` (comme src/captcha.js) ; jamais rangé. Les refus sont lus dans les DEUX formes
  (`{error_code, msg}` d'aujourd'hui, `{error, error_description}` d'avant) et dits avec un geste : `invalid_credentials` ⇒
  « E-mail ou mot de passe incorrect. Vérifie le mot de passe de vrm.center (pas celui de Vinted), ou touche « Recevoir un
  code » » ; `email_not_confirmed` ⇒ « …pas encore confirmée… le code confirme aussi l'adresse » ; 429 ⇒ « Trop de
  tentatives… » ; captcha ⇒ la vérification, puis réessayer.
- **Le code** : `/otp` (`create_user:false`) puis `/verify` type `email` (le bon type pour `signInWithOtp`) — c'était juste ;
  seul le jeton manquait. Un code de plus d'une heure ⇒ « Ce code a expiré : demande un nouveau code », retour à la demande.
- **Créer un compte**, au même endroit : par le code (`/otp`, `create_user:true`, `data.langue`), sur SON toucher « Créer mon
  compte » ; le code crée le compte, le confirme et connecte. Une adresse inconnue sans « Créer » n'ouvre jamais de compte.
- **La session** : rangée par `saveSession` (relu, vérifié, `chrome.storage.local`) ; elle survit au redémarrage (audit R1).

## 3. Le panneau flouté, la connexion dedans (vrm-badge.js, background.js)
- **Pas connecté** (Vinted, Leboncoin, Vestiaire) : le logo, l'icône de l'extension et « Connexion à VRM » (clic droit)
  ouvrent **le grand panneau** (`data-grand`, plein écran au téléphone), sa vraie structure (barre, Accueil, Comptes,
  Aujourd'hui, ce qui est capté) **flouté** (`filter: blur`), `inert`, `aria-hidden`, aucun clic possible (règle « Sans
  abonnement » de l'app). Seul vrai nom (flouté) : le compte du site lu par l'extension ; le reste est une forme grise —
  aucun chiffre inventé.
- **La connexion est une feuille DANS le panneau** (centrée à l'ordinateur, en bas au téléphone : le haut du panneau reste
  visible) : logo, « Connecte VRM », une ligne, son ×. Chrome/Edge/Firefox : le formulaire vit dans le cadre de l'extension
  (`popup.html?mode=carte`, la page du site n'entend aucune touche) et commence par **e-mail + mot de passe**, puis Google,
  Discord, « Recevoir un code par e-mail », « Créer un compte », « Mot de passe oublié ? », « Relier par vrm.center ». Orion
  (carte dessinée) : le code d'abord, Google, Discord, Créer — **pas de mot de passe** (règle du 5.362, inchangée).
- Le cadre se dit prêt dès que son formulaire est posé (sans attendre l'état du service worker) et la carte lui laisse 4 s
  (1,5 s avant : mesuré 1,3–1,6 s sur une machine chargée, il retombait sur la carte dessinée — sans mot de passe).
- Le formulaire (cadre, vérification) n'est posé que panneau OUVERT : rien ne se charge en douce à chaque page vue.
- **L'icône, pas connecté** : `ouvrirPanneauConnexion` envoie `panneauConnexion` à l'onglet du site (panneau ouvert SANS
  recharger) ; page sans le script ⇒ le lien `?vrm=panneau` dans cet onglet ; ailleurs ⇒ un onglet vinted.fr sur le panneau.
  Plus jamais vrm.center par défaut. Orion (pas de menu) : la fenêtre de l'icône, comme avant (mot de passe + vérification).
- **Google / Discord** : le fournisseur exige sa page ; petite fenêtre qui se ferme seule (ordinateur) ou cet onglet qui
  revient (Orion). Au retour, la session arrive et le panneau se dé-floute.
- **Après la connexion** : la session rangée déclenche `rafraichir` ⇒ le panneau se dé-floute SUR PLACE, sans rechargement ni
  boucle. Depuis la fenêtre de l'icône, `ouvrirPanneauAccueil` demande d'abord à l'onglet d'ouvrir son panneau.
- Textes neufs : `cx_*` dans vrm-ui.js, cinq langues (audit-extension-feuille).

## 4. Preuves
- **`scripts/audit-connexion-panneau.cjs`** (vrai background.js par `_fond-vm.cjs`, faux GoTrue À CAPTCHA à la forme réelle,
  vraie `public/verif-extension.js` exécutée) : **41 verts**. Sur origin/main (`git archive`, l'audit et le faux GoTrue copiés
  dedans) : **18 rouges**. Mutations : jeton jamais mis dans le corps ⇒ 14 rouges ; message `panneauConnexion` changé ⇒ 2 ;
  `create_user:true` retiré ⇒ 4.
- **`scripts/bancs/panneau-connexion.cjs`** (vrai Chromium, vrais vrm-ui.js + vrm-badge.js dans une page vinted.fr, vrai cadre
  popup.html servi sous une autre origine, vraie page de vérification sous vrm.center + faux Turnstile `_faux-turnstile.cjs`,
  vrai background.js derrière `sendMessage`, faux GoTrue à captcha) : **97 verts**, 390 tactile et 1512, clair et sombre,
  Chrome et Orion. Sur l'extension d'origin/main (`--ext`) : rouge en masse. Mutation (flou et `inert` retirés) : 6 rouges.
- Captures regardées : `panneau-connexion-chrome-{1512,390}-{light,dark}.png` (+ `-erreur`, `-connecte`, `-code`,
  `-code-expire`), `panneau-connexion-orion-390-{light,dark}.png` (+ `-code`, `-creer`) — dans `scripts/bancs/captures/`
  (non versionnées).
- `audit-extension-captcha` mis à jour (le refus dit le geste « la vérification, puis réessaie »). `carte-orion-sans-onglet` :
  vrm-ui.js et `storage.local` comme Chrome (rouges déjà sur main : textes en clés, bouton sans style), la vérification
  servie, le cadre qui commence par le mot de passe, délai du cadre 4 s ; ses rouges restants sont ceux d'origin/main (style
  « plein d'encre », phrases de la petite carte après connexion remplacées par le grand panneau, cadre détourné visible
  ~200 ms avant d'être caché — mesuré aussi sur main).
- Verts : `audit-coherence` (`connexionpanneau` → `ouvrirPanneauConnexion`), `audit-extension-zip`, `audit-traduction`,
  `audit-quoi-de-neuf`, `audit-extension-feuille`, `audit-connexion-simple`, `audit-ext-boutique`, `audit-fonctions-api`,
  `audit-paquets-boutiques`, `audit-extension-navigateurs`, `audit-pont-session`, `audit-extension-oauth`,
  `audit-sans-session-envoi`, `audit-extension-ui`, `audit-robustesse-extension`, `audit-csp`, `audit-entetes`,
  `audit-parcours-nouveau`, `extension-reste-connecte`.

## 5. Pas vérifié
- Le vrai Turnstile de Cloudflare dans un cadre posé par une page d'extension (et sur Orion) n'a pas pu être joué ici : le banc
  sert un faux Turnstile. La clé ne regarde que le domaine du cadre (vrm.center) ; si Cloudflare refusait, l'extension le DIT
  (cadre en panne ⇒ « désactive un bloqueur… ou « Relier par vrm.center » »), jamais un bouton muet.
- `verif-extension.html` n'existe en production qu'après la fusion : avant, le cadre est muet ⇒ message dit.
- Le modèle d'e-mail « Confirm signup » de Supabase doit contenir `{{ .Token }}` pour que « Créer un compte » porte un code.

## 6. Geste de Julien
Après la fusion : installer la **5.456.0** (remplacer le dossier, ⟳ dans CHAQUE Chrome ; Orion : `VRM-Orion-dossier.zip`).
Sur vinted.fr, déconnecté : clic sur l'icône VRM ⇒ le panneau flouté ; e-mail + mot de passe ⇒ connecté sur place. Essayer
aussi « Recevoir un code par e-mail ».
