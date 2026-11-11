# Lot `connexions-oauth` — 11 nov. 2026 (branche `claude/connexions-oauth`)

Demande de Julien : « je veux qu'il n'y ait aucun bug sur les connexions Google ou
Discord ». Audit complet de l'app (ordinateur, iPhone Safari/PWA) et de l'extension
(fenêtre, carte du logo, Orion), puis correction de chaque défaut trouvé.

## ⚠️ En tête : le bug MESURÉ en production (11 nov., signalé par une autre session)
Journaux d'auth Supabase (lus en lecture seule), Edge macOS : liaison Discord réussie
(11:56:34 `identities/authorize` → 11:56:40 `/token` PKCE 200) ; déconnexion ;
« Continuer avec Discord » (11:57:03 `/authorize`, `redirect_to=https://vrm.center/`) →
11:57:08 `/token` PKCE **400 « code challenge does not match previously saved code
verifier »**, envoyé PAR LA PAGE vrm.center (referer `https://vrm.center/`, pas
l'extension) ; le 2e essai passe.

**Cause dans le code** : au retour, l'app prenait UN vérificateur à l'aveugle —
celui de la liaison, sinon celui de l'onglet (`sessionStorage`), et seulement en
dernier celui de l'appareil — sans savoir à quelle tentative le code appartenait.
Un retour qui arrive dans un autre contexte que le départ (fenêtre de l'app installée
qui capte le lien, onglet dupliqué, autre onglet) garde un VIEUX vérificateur d'onglet,
qui passe devant le bon. Supabase garde le code après ce refus (`token.go` : le flux
n'est pas effacé), mais l'app n'essayait pas l'autre.

**Correctif** (`src/auth/essaisPkce.js`) : chaque départ (connexion ET « Relier »)
reçoit un identifiant `vrm_essai`, porté par l'adresse de retour, et SON vérificateur
rangé 10 min sous cet identifiant (onglet + appareil). Au retour : le vérificateur de
CETTE tentative d'abord ; sans identifiant (Supabase retombé sur la Site URL), les
autres dans l'ordre ; nouvel essai **seulement** sur `bad_code_verifier`, 3 au plus ;
tout est effacé après l'échange ; une vieille liaison ne transforme plus une connexion
en liaison (elle n'est en jeu que si SON vérificateur est celui qui marche).

**Preuve** : banc P14. Sur `origin/main` compilé : « retour dans une autre fenêtre avec
un vieux vérificateur » ⇒ **1 échange, refusé `bad_code_verifier`, pas connecté** —
exactement l'erreur de production (rouge, avec et sans identifiant). Ici : connecté du
1er coup avec l'identifiant ; sans identifiant, le bon trouvé au 2e échange. Mutation
« pas de nouvel essai » ⇒ rouge. Audit K1–K2 (ordre, durée, effacement, liaison).
⚠️ Honnête : la suite « liaison → Se déconnecter → Continuer avec Discord » DANS LE
MÊME onglet passait déjà sur `origin/main` au banc ; la production avait donc un
contexte en plus (le plus probable : la fenêtre de l'app installée sur Edge, ou un
second onglet vrm.center). Le banc la joue quand même (verte), 390 et 1512.

## Comment j'ai audité
Le comportement de Supabase n'a pas été supposé : j'ai lu son code (dépôt public
`supabase/auth`, fichiers `internal/models/linking.go`, `internal/api/external.go`,
`identity.go`, `token.go`, `errors.go`, `models/user.go`, lus le 11 nov.). Ce qu'il fait
vraiment, et qui commande tout le reste :

| situation | ce que fait Supabase | ce que l'écran recevait AVANT |
|---|---|---|
| Google/Discord, adresse VÉRIFIÉE = celle d'un compte VRM | **relie** l'identité à ce compte (aucun second compte) | rien : il entrait sans savoir pourquoi |
| adresse NON vérifiée = celle d'un compte VRM | crée un compte **sans e-mail** puis refuse : `error=access_denied`, `error_code=provider_email_needs_verification`, « Verify the email with discord in order to sign in » | le texte anglais brut |
| inscription, adresse non vérifiée, confirmation allumée | crée le compte, envoie un e-mail de confirmation, refuse (`provider_email_needs_verification`, « A confirmation email has been sent… ») | le texte anglais ; l'extension disait « **annulée** » (elle lisait `access_denied`) |
| aucune adresse (« sans e-mail » éteint) | `server_error`, « Error getting user email from external provider » | l'anglais |
| annulé chez Google/Discord | `error=access_denied` **sans** `error_code` | « Discord » nommé même pour Google |
| code déjà servi (double retour, retour arrière) | `/token` 404 `flow_state_not_found` ; expiré 422 `flow_state_expired` ; autre vérificateur 400 `bad_code_verifier` | « invalid flow state, no valid flow state found » ; l'extension « code 404 » |
| Relier : identité déjà à un autre compte | `identity_already_exists`, « Identity is already linked to another user » | bon message |
| Relier : identité déjà à CE compte | même code, « Identity is already linked » | « a déjà son propre compte VRM » (faux) |
| Délier la dernière identité | 422 `single_identity_not_deletable` | message correct, mais sur une liste pas relue |
| Délier l'identité qui porte l'e-mail du compte | Supabase **remplace l'e-mail du compte** par celui d'une identité restante (vérifiée d'abord, puis la plus ancienne) | rien dit : son e-mail de connexion changeait sans prévenir |
| erreurs au retour | dans `?…` ET dans `#…` (avec `sb`) | `#` déjà effacé par `cleanAuthUrl` (OK) |
| lien e-mail expiré | `error=access_denied`, `error_code=otp_expired` | l'anglais |

## Ce qui est corrigé

1. **Une seule règle des refus** : `src/auth/erreursOAuth.js` (`messageErreurOAuth`) lit le
   **code** d'abord, l'anglais seulement en repli, et ne rend jamais de texte anglais.
   `access_denied` + un code n'est jamais « annulée ». Le fournisseur nommé est celui du
   clic (liaison en cours, sinon l'intention posée au clic) ; « pas su » ⇒ aucun nom.
   La règle est **recopiée par script** dans l'extension (`background.js`, bloc
   `<regle-erreurs-oauth>`, `node scripts/audit-connexions-oauth.cjs --recopie`).
2. **App, retour OAuth** (`consumeAuthRedirect`) : lit `error_code` (query ou `#`) ; consomme
   le vérificateur et l'intention sur un refus ; l'échange du code refusé est traduit
   (`authCall` rend maintenant `code`) ; retour sans vérificateur ⇒ phrase qui nomme le
   bouton à recliquer.
3. **Même adresse, compte non relié** : Supabase relie ; l'app le **dit** une fois
   (« Google est maintenant relié à ton compte VRM (même adresse e-mail). »,
   `identiteRelieeAuto` : compte > 10 min, identité < 10 min).
4. **Délier** (`src/auth/delierOAuth.js`) : la fiche est **relue au clic** ; dernière
   identité ⇒ refusé sans appel ; si l'e-mail du compte va changer, le dialogue le dit
   (« Ton e-mail de connexion deviendra x ») ; refus de Supabase traduits
   (`single_identity_not_deletable`, `identity_not_found`, `email_conflict_identity_not_deletable`).
5. **Extension 5.346.0** : refus traduits par code (`oauth-retour.js` remet `error_code`) ;
   échange refusé traduit. **« Continuer avec … » qui vient de CRÉER un compte** (aucun
   compte VRM relié à ce Google/Discord) : même règle que l'app (lot DJ6) — vrm.center
   l'annule (`?mode=oauth-sans-compte`, toutes les preuves côté serveur), **la session
   n'est pas rangée**, la carte dit « Aucun compte VRM n'est relié à ce Discord. Rien n'a
   été créé. Connecte-toi sur vrm.center avec ton e-mail. Puis relie Discord dans ton
   profil. » Serveur qui refuse (compte pas vide) ou injoignable ⇒ comme avant (session
   rangée, « compte neuf » dit) — rien deviné. Avant, l'extension écrivait les captures
   dans ce compte vide.
6. Phrase « déjà son propre compte VRM » alignée mot pour mot sur celle du lot
   `suppression-oauth` (« 1. Déconnecte-toi… 2. Paramètres → Supprimer mon compte : tape
   SUPPRIMER. 3. Reconnecte-toi ici, puis relie … »).
7. Test `connexion-session.test.mjs` : 2 rouges déjà sur `main` (dépendances de
   `consumeAuthRedirect` absentes du bac à sable depuis DJ6) réparés ; le cas « texte
   brut affiché » suit la nouvelle règle (phrase française, jamais le texte du fournisseur).

## Parcours × résultat × preuve

Banc `scripts/bancs/connexions-oauth.cjs` : vraie app (`dist`), faux Supabase fidèle
(302 de `/authorize` vers `redirect_to` avec `?code=` ou `?error=&error_code=&error_description=` + `#…&sb=`,
`/token` PKCE, `/user`, `/user/identities/authorize?skip_http_redirect=true`, `DELETE /user/identities/{id}`
avec sa règle d'e-mail), chaque parcours joué au doigt (390 tactile) et à la souris (1512).

| parcours | résultat | preuve |
|---|---|---|
| Inscription Google, compte neuf | un départ PKCE s256, code échangé une fois, porte « J'ai déjà un compte VRM ? », rien annulé | banc P1 |
| Inscription Discord, adresse non vérifiée, confirmation allumée | « Un e-mail de confirmation est parti vers ton adresse Discord. Ouvre-le, puis reviens te connecter. » ; ni anglais ni « annulée » ; départ consommé | banc P2, audit M1, X1 (extension) |
| Discord sans adresse (« sans e-mail » éteint) | « Discord n'a pas donné d'adresse e-mail… » | banc P3, audit M1 |
| Connexion Google, compte relié | boutique ouverte, même compte, adresse propre | banc P4, audit X1 |
| Connexion Google, même adresse, pas relié | le MÊME compte (Supabase relie), et c'est dit | banc P5 |
| Connexion Discord, adresse différente | compte neuf annulé (app ET extension), aucune session, « relie Discord dans ton profil » | banc P6, profil-photo R5, audit X1 |
| Adresse non vérifiée = compte VRM | phrase « pas vérifiée… Ou connecte-toi avec ton e-mail VRM » | audit M1 |
| Annulé chez Google | « Connexion avec Google annulée. Rien n'a changé. » (plus « Discord ») | banc P7, audit M1 |
| Code déjà servi / expiré / autre vérificateur | « Cette connexion a expiré ou a déjà servi. Reclique « Continuer avec Google ». » | banc P8, audit M1, X1 |
| Retour dans un autre onglet sans vérificateur | rien échangé, la phrase nomme le bouton | banc P9 |
| Liaison Discord → Se déconnecter → Continuer avec Discord | connecté du 1er coup, un seul échange | banc P14 |
| Retour dans une autre fenêtre qui garde un vieux vérificateur (bug de prod) | connecté (avec l'identifiant : 1er coup ; sans : 2e échange) ; rouge sur `origin/main` | banc P14, audit K1–K2 |
| Relier Discord (manual linking allumé) | liaison avec SA session, jamais `/authorize`, même compte, « relié » | banc P10, profil-photo R6 |
| Relier, manual linking éteint | « La liaison n'est pas encore activée sur VRM » | profil-photo R6, audit M1 |
| Relier, Discord pris par un autre compte VRM | le chemin en 3 gestes ; reste connecté à SON compte | banc P11, audit M2 |
| Relier, déjà relié à CE compte | « Google est déjà relié à ton compte VRM. Rien à faire. » | audit M2 |
| Délier la seule façon de se connecter | refusé, aucune requête | banc P12, audit D1 |
| Délier quand l'e-mail du compte change | dit AVANT ; délié sur son clic ; ligne « Relier » ; photo Google → Discord | banc P13, audit D1 |
| Lien e-mail expiré | « Ce lien e-mail a expiré ou a déjà servi… » (aucun fournisseur nommé) | audit M1 |
| Nettoyage de l'adresse | aucun `code`, `error*`, `sb`, jeton laissé (query et `#`) après chaque parcours | banc (tous) |
| Déconnexion | `wipeLocalData` efface `vrm_pkce`, `vrm_oauth_*`, `vrm_lier_extension_oauth` (préfixe `vrm_`) | lu dans le code, inchangé |
| Extension reliée au bon compte après Google/Discord | inchangé, vert | audit-liaison-visite 10, pont-session 87, session-extension 29, extension-oauth |

Lu dans le code, sans changement nécessaire : Safari iPhone ne voit **aucune** fenêtre
surgissante (l'app part chez Google par la page entière ; la carte Orion dans le même
onglet) ; PWA installée : même chemin (pages hors de l'app ouvertes par iOS dans la
vue intégrée, puis retour sur vrm.center, stockage commun) ; mode privé : `localStorage`
marche (Safari ≥ 11) ; double clic : verrou `demandeEnCours` (connexion) et `busy` (Relier).

## Preuves
- `npm run build` vert.
- `node scripts/audit-connexions-oauth.cjs` : **43 verts**. Sur l'arbre d'`origin/main` : 10
  rouges. Mutations (chacune rouge) : « annulée » testé avant le code (3 rouges) ; annulation
  de l'extension retirée (2) ; e-mail qui change non dit (2) ; `error_code` ignoré par l'app
  (1) ; « déjà relié à soi » confondu (1).
- Banc `connexions-oauth.cjs` : **96 verts, 0 échec** (P1–P14, 390 tactile + 1512). P14 rouge sur `origin/main` (4) et par mutation « pas de nouvel essai » (1).
- Bancs existants : extension-oauth-app 21, carte-orion-sans-onglet 67, liaison-pont-orion 4, discord-nouveau-compte, session-reveil, connexion-claire, inscription-fiable, recuperation-auth 11 : verts. `profil-photo` : 111 verts au lot DJ6, non relancé ici. Rouges NON liés à ce lot : `connexions-reglages` 2 KO (« la version historique ne certifie pas cet appareil »), les mêmes sur `origin/main` ; `session.cjs` ne tourne pas ici (commit `cdc9c1d` absent du clone).
- Audit `connexions-oauth` : **53 verts** (K1–K2 : un vérificateur par tentative).
- Audits verts : variables, tdz, coherence, identite, icones, textes-courts (47),
  fonctions-api, secrets, csp, extension-zip, profil-oauth (41), discord-oauth (32),
  extension-oauth, extension-navigateurs, liaison-visite, pont-session, session-extension,
  sans-session-envoi, lbc-session.
- Tests : connexion-session 15/15 (13/15 sur `main`), connexion-moyens 5, deconnexion-proprietaire 3,
  etat-connexions 5, inscription-parcours 6, liaison-oauth 3, recuperation-auth 6,
  session-renouvellement 7, lbc-session-privee 2.
- Captures regardées (390 et 1512) : refus Discord non vérifié, annulé Google, code déjà
  servi, même adresse (bulle), relier/déjà pris, dialogue « Délier » avec l'e-mail qui change.

## ⚠️ Pour la fusion avec `claude/suppression-oauth`
Les deux lots touchent `erreurRetourOAuth` et la branche `if (err)` de `consumeAuthRedirect`.
Garder : sa branche `lireReconnexion` EN PREMIER (retour de « Me reconnecter avec … »), puis
la mienne (code d'erreur, intention, vérificateur consommé). `erreurRetourOAuth` reste
celle-ci (elle appelle `messageErreurOAuth`, dont la phrase est déjà la sienne).

## Gestes de Julien (rien changé par VRM)
1. **Supabase → Authentication → URL Configuration** : Site URL `https://vrm.center` ;
   Redirect URLs : `https://vrm.center/**` et `https://vrm.center/extension-retour.html`.
   (Sans elles, le retour retombe sur la Site URL : la connexion marche, Relier aussi,
   mais l'extension en petite fenêtre revient sur l'accueil.)
2. **Supabase → Authentication → Sign In / Providers** : Google et Discord activés ;
   « Allow manual linking » ON (déjà fait selon lui) ; « Allow users without an email »
   OFF (déjà). Confirmation d'e-mail ON (déjà).
3. **Google Cloud Console → Identifiants → client OAuth** : URI de redirection autorisée
   `https://lgonxzrzjcqthjtbdpzo.supabase.co/auth/v1/callback` ; origine JavaScript
   `https://vrm.center`. Écran de consentement « En production » (sinon seuls les testeurs
   entrent : refus `access_denied` dit « annulée »).
4. **Discord Developer Portal → OAuth2 → Redirects** : la même adresse
   `…supabase.co/auth/v1/callback`. Les portées `identify email` suffisent.
5. Les comptes « sans e-mail » que Supabase a pu créer avant ce lot (adresse non vérifiée
   = un compte VRM) : Supabase → Authentication → Users, filtrer « Email » vide, provider
   discord ; les supprimer à la main si vides (je n'ai rien supprimé).
6. Installer l'extension **5.346.0**.

## Ajout de Julien : « Appareils connectés » (même lot)
Sa capture de production : 8 lignes, dont 5 « Mac · Chrome », chacune avec « Déconnecter ».

**Pourquoi 5 Mac · Chrome** (lu dans le code ; la mesure en base de `auth.sessions` n'a pas
pu être faite : l'outil SQL attendait une autorisation que personne ne pouvait donner) :
une session Supabase naît à CHAQUE connexion — app, fenêtre ou carte de l'extension
(5.328+ : e-mail, code, Google/Discord), retour Google/Discord — et ne meurt que sur
« Se déconnecter » (`logout`). Une connexion abandonnée (stockage effacé, jeton refusé,
extension réinstallée, l'échec PKCE ci-dessus suivi d'un 2e essai) reste dans
`auth.sessions` : aucune expiration n'est réglée sur le projet. Ce n'est pas un intrus,
ni une session par onglet (les onglets partagent la même session) ni par renouvellement
(un renouvellement garde la session). Rien n'est supprimé en silence ; les vieilles sont
désormais à part et fermées sur son clic.

**L'alerte « nouvel appareil »** (lot H, 10 nov.) : vérifiée, elle part UNE fois par
appareil + navigateur (« Mac · Edge »), jamais au renouvellement ni à une 2e connexion du
même navigateur (audit `appareils-groupes` A1, banc `agenda-appareil` G). Son toucher
ouvre l'écran avec le groupe de CETTE connexion déplié et « Déconnecter » en évidence.
Limite connue, dite : un 2e Mac avec Chrome a la même signature, il ne déclenche pas
d'alerte (aucun identifiant d'appareil fiable sans empreinte, refusée).

**L'écran** (`src/appareilsGroupes.js`, `AppareilsConnectes`) :
- un groupe par appareil + navigateur : « Mac · Chrome · Cet appareil · 5 connexions ·
  dernière il y a 2 min », en tête ;
- les autres derrière « Voir les appareils (3) » ; le détail par connexion (et son
  « Déconnecter ») seulement en dépliant un groupe ;
- « Déconnecter les autres appareils » : UN bouton, confirmé, `logout?scope=others`
  (Supabase garde la session d'ici) ; « Se déconnecter partout » reste en lien discret ;
- connexions inactives depuis plus de 30 jours : « N connexions anciennes », hors des
  groupes, « Fermer » sur son clic (confirmé) ; une date illisible n'est jamais « ancienne ».

**Preuves** : audit `appareils-groupes` 15 verts (rouge sur `origin/main` : 4 ; mutation
« plus d'anciennes » : 2 rouges) ; banc `connexions-oauth` P15 14 verts (390 + 1512,
données de sa capture) ; bancs `comptes-securite` et `agenda-appareil` mis à jour pour
l'écran regroupé : verts. (`comptes-securite` comptait aussi l'appel `verifier` de
l'alerte comme un « Déconnecter » : corrigé dans le banc.) Captures regardées : bordure
grise du lien « Se déconnecter partout » et résumé coupé à 390 vus et corrigés.

## État final (après le dernier `git merge origin/main`)
- `main` servait la 5.344 (import de départ) : la **5.346.0** contient la 5.344 + ce lot (conflits de version seulement) ; zips régénérés.
- Banc `connexions-oauth` (P1–P15) : **110 verts, 0 échec**, 390 tactile + 1512, sur la compilation fusionnée.
- `audit-coherence` : vert après `git fetch --unshallow` (le clone de session était superficiel ; `main` refuse désormais de conclure sur un tel clone).
