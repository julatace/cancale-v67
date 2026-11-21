# 8 novembre — « Mot de passe oublié » comme les grands sites, e-mails beaux et bilingues

Branche `claude/recuperation-mails` (depuis `claude/amazing-lovelace-xd7obl`).

## Ce que Julien a vu (8 nov., 23 h 20)

SMTP Brevo branché (VRM <noreply@vrm.center>). « Mot de passe oublié » :
1. e-mail = modèle PAR DÉFAUT de Supabase, en anglais (nos modèles n'étaient pas collés) ;
2. le bouton menait à `/recuperation.html` qui disait « Ce lien est incomplet. Colle le
   lien reçu… » — la page n'acceptait que `#token_hash` (notre modèle) ou
   `#access_token&type=recovery` ; le modèle par défaut passe par
   `/auth/v1/verify` de Supabase, qui CONSOMME le jeton à la première visite (un robot
   d'analyse de lien, le suivi de clics, un e-mail plus ancien) puis renvoie
   `#error=access_denied&error_code=otp_expired` — forme que la page ne connaissait pas ;
3. « Tu as déjà un lien qui ne s'ouvre pas ? Ouvrir la récupération dans VRM, puis colle
   le lien reçu » le déroutait ;
4. il voulait un e-mail plus beau, qui suive la langue.

## Ce qui change

**Page `/recuperation.html`** (`public/recuperation.{html,css,js}`) — même identité que
l'écran de connexion (bande encre, carte blanche, police système, bleu Apple, clair/sombre
selon l'appareil, 390 px et ordinateur en deux colonnes). Titre « Choisis un nouveau mot de
passe », champ + « Afficher » (montre les deux champs), « Confirme-le », règles cochées en
direct (8 caractères, lettres et chiffres — la règle d'avant), « Enregistrer ». Ensuite :
mot de passe changé (`PUT /auth/v1/user`), anciennes sessions fermées
(`logout?scope=global`, comme avant), puis **connexion avec le nouveau mot de passe**
(`token?grant_type=password`) rangée dans `vrm_session` (la clé de l'app) ⇒ « C'est fait —
Tu es connecté » + « Ouvrir VRM ». Connexion refusée (captcha, MFA…) ⇒ « Connecte-toi avec
lui » + « Se connecter ». Le jeton de récupération ne touche jamais le stockage.

Formes de lien acceptées : `#token_hash` / `?token_hash` / `?token` (notre modèle, ou un
lien collé), `#access_token…&type=recovery` (implicite), `?code=` (PKCE : échangé avec le
vérificateur rangé sur CET appareil — clé `vrm_pkce` de l'app ou `sb-…-code-verifier` de
supabase-js — sinon « ouvre-le sur l'appareil où tu as demandé l'e-mail »),
`#error=…&error_code=otp_expired` (« Ce lien a expiré ou a déjà servi »). L'app n'utilise
pas PKCE pour `recover` aujourd'hui ; la forme est servie quand même.

Échec du lien ⇒ la phrase dit quoi faire + **« M'envoyer un nouvel e-mail »** (champ
adresse, `POST /auth/v1/recover?redirect_to=…/recuperation.html`, même réponse que le
compte existe ou non, puis « Renvoyer dans N s » 60 s ; un « after N seconds » de Supabase
est respecté ; captcha exigé ⇒ renvoi vers l'écran de l'app). La voie « coller un lien »
n'existe plus qu'ici, repliée (« J'ai un e-mail plus récent »). Panne / quota ⇒ « Le
service ne répond pas » + « Réessayer » (même lien, gardé en mémoire), jamais « expiré ».
Jargon retiré (« SÉCURITÉ DU COMPTE », « Un nouveau départ », « lien sécurisé »).
Sécurité inchangée : `no-referrer`, aucun script externe (CSP de `vercel.json` intacte),
URL nettoyée avant tout appel, délai sans `AbortSignal.timeout` (vieux Safari).

**App** (`src/App.jsx`, écran de connexion) : la phrase « … colle le lien reçu » est
retirée ; après envoi : « On t'a envoyé un e-mail à X. Ouvre-le sur cet appareil. » et le
bouton devient « Renvoyer dans N s » puis « Renvoyer l'e-mail » (60 s ; changer d'adresse
ou d'écran lève cette attente-là, un refus de Supabase garde la sienne). Un lien de
récupération collé dans « confirmer » dit maintenant de l'ouvrir depuis l'e-mail.

**Langue** (`src/langueCompte.js`) : `data.langue` ('fr' | 'en', du navigateur) envoyé à
l'inscription ; pour un compte existant, posé UNE fois 8 s après le chargement connecté
(relu d'abord, jamais par-dessus une valeur, lecture ratée ⇒ rien écrit ; marque
`vrm_langue_posee` = uid ; rien pendant une récupération).

**Modèles** (`supabase/templates/*.html` + `sujets.json`, fabriqués par
`scripts/modeles-email.cjs`) : confirmation, invite, magic_link, email_change, recovery,
reauthentication. FR par défaut, EN si `.Data.langue` == "en"
(`{{- $en := eq (printf "%v" .Data.langue) "en" -}}`, sûr quand la langue ou `Data`
manquent). Sujet : le même test, dans le champ sujet (GoTrue le passe au moteur de
modèles) ; un sujet « français seul » de secours est donné. `magic_link` porte le CODE
(`{{ .Token }}`, « valable 1 h » = expiration OTP par défaut) en grand, copiable, pour la
connexion par code de l'extension 5.330, ET le bouton ; `reauthentication` le code seul.
Récupération : lien `https://vrm.center/recuperation.html#token_hash={{ .TokenHash }}&amp;type=recovery`
(la page vérifie : un robot qui visite ne consomme rien). `scripts/configurer-auth-production.mjs`
pose les six d'un coup (jeton d'accès Supabase).

## Preuves

- `npm run build` vert.
- `scripts/bancs/recuperation-auth.cjs` (réécrit, 11 cas : formes A–H, 390 clair/sombre et
  1512) — vert ; **rejoué sur l'arbre d'avant** (`git archive origin/claude/amazing-lovelace-xd7obl`,
  `VRM_RECUPERATION_ROOT`) : 11/11 rouges — `?code` (D, E) et `#error=otp_expired` (F) faute
  de formulaire / de renvoi, `#access_token` (C) et `#token_hash` (A, B) sur le titre et le
  jargon, A aussi sans connexion.
- `scripts/tests/recuperation-pannes-interface.cjs` mis à la règle (« Réessayer » au lieu de
  coller) ; `scripts/tests/recuperation-auth.test.mjs` + formes ; `scripts/tests/langue-compte.test.mjs`.
- `scripts/bancs/connexion-claire.cjs` (nouvelle phrase, « Renvoyer dans N s », aucune voie
  « coller ») et `scripts/tests/connexion-actions-interface.cjs` (phrase absente) — verts.
- `scripts/audit-modeles-email.cjs --prouve` : règles + rendu par Go 1.24
  (`html/template` ET `text/template`, `scripts/outils/modeles-email-rendu.go`) pour fr, en,
  langue absente, `Data` absent ; 7 mutations vues.
- Captures regardées : page (formulaire, expiré, renvoyé, fait) et e-mails (6 × FR/EN × 390/600 × clair/sombre).

## Geste de Julien

Coller les six modèles : `docs/supabase-modeles-email.md`.
