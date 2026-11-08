# 8 nov. 2026 — Extension 5.325.0 : « Continuer avec Google / Discord », et les refus d'envoi dits

Branche `claude/extension-google-discord` (pas de PR : intégrée par la session principale).

## Ce que Julien a demandé
« Imagine une personne qui a créé son compte avec Google ou Discord et qui veut se connecter à
l'extension, il ne va pas pouvoir. Je veux que tu ajoutes la possibilité de se connecter avec Google
et Discord dans l'extension. Ces personnes vont payer pour ce service. »

Puis (même version) : sur son iPhone, la carte du logo disait « Dernier envoi refusé à l'instant —
la base n'a pas répondu, ça réessaie tout seul » pour TOUT (réseau, 5xx, inconnu) : impossible à
diagnostiquer.

## Ce que voit la personne

**Fenêtre de l'extension (pas connectée)** — sous « Se connecter avec VRM » (qui reste le bouton
principal, bleu) : « Continuer avec Google » et « Continuer avec Discord », boutons neutres avec le
« G » aux quatre couleurs et la manette Discord en blurple (chartes des deux marques). Chaque bouton
n'apparaît QUE si Supabase dit le fournisseur activé (`/auth/v1/settings`, lu par le service worker
avec la clé publique, `fournisseursConnexion`, mémorisé 10 min dans `chrome.storage.local`). Pas su
(réseau, 5xx, forme inattendue, ancien code qui ne répond pas) ⇒ aucun bouton. Le formulaire du mot de
passe dit « Compte créé avec Google ou Discord ? Utilise les boutons au-dessus. » (seulement les noms
des boutons affichés ; rien s'il n'y en a aucun). Orion : les boutons passent AU-DESSUS du formulaire
(qui y est le chemin principal), la phrase reste vraie. La petite carte du logo (iframe) passe de 400 à
460 px de haut pour que tout tienne sans défiler.

**Clic** : exactement le chemin de « Se connecter avec VRM » (`lierAvecVRM`, `demandeAt` noté), avec en
plus `&connexion=google|discord` dans l'adresse de VRM — un nom de la liste, jamais un texte reçu tel
quel ; la carte du logo (`vrm-badge`) ne peut pas le poser. Service worker muet (code périmé) : la
fenêtre ouvre VRM elle-même avec le même `connexion`.

**App (vrm.center)** :
- `lier-extension` valide + `connexion=google|discord` + aucune session rangée ⇒ l'écran de connexion
  part tout de suite chez le fournisseur (`oauthStart`, PKCE s256) — seulement quand les réglages sont
  LUS et le fournisseur ACTIVÉ. Pas activé ⇒ l'écran de connexion normal + « La connexion avec Discord
  n'est pas encore ouverte sur VRM. Connecte-toi ici avec ton e-mail et ton mot de passe VRM :
  l'extension sera connectée en même temps. » Réglages illisibles ⇒ la phrase « Je n'ai pas pu
  vérifier… Réessaie les moyens de connexion ci-dessous » ; « Réessayer » relance le départ. Une seule
  fois, et au plus 2 min après l'arrivée.
- Déjà connecté ⇒ `connexion` ignoré, la liaison part comme avant (session adressée à CETTE extension).
- Un autre nom (`connexion=facebook`), ou `connexion=` sans `lier-extension` ⇒ rien.
- `connexion=<nom>` quitte l'adresse aussitôt ; `?connexion` NU (boutons de la page d'accueil) reste.
- Retour de Google dans le MÊME onglet : la liaison est dans `sessionStorage` (15 min), rien de neuf.
  Dans un NOUVEL onglet (téléphone) : `oauthStart` pose une marque `vrm_lier_extension_oauth`
  ({id d'extension, date}, aucun jeton) ; au retour (`?code=`/`?error=` seulement), elle est relue UNE
  fois et effacée ; ≤ 10 min (la durée du vérificateur PKCE) ⇒ la liaison repart ; plus vieille ⇒
  « La connexion a pris plus de 10 minutes : l'extension n'a pas été connectée. Connecte-toi ici, puis
  reclique « Continuer avec Google » ou « Continuer avec Discord » dans la fenêtre de l'extension VRM. »
- Bandeaux « Si ça ne vient pas : clique l'icône VRM, puis … » : à un compte CRÉÉ avec Google/Discord
  (`app_metadata.provider`) et une extension qui l'a (`extSait('lieroauth') === 'ok'`), le bouton nommé
  est « Continuer avec Google » ; sinon « Se connecter avec VRM » (`boutonLierExt`).

Garde-fous inchangés : session fabriquée par le serveur et ADRESSÉE à l'extension qui a demandé (nonce
2 min, une fois), deux extensions ⇒ rien, double vérification non passée ⇒ rien (`mfaPasse`), code
périmé ⇒ le geste ⟳. Aucun jeton dans une adresse, aucun secret dans le dépôt (la clé publique était
déjà dans `background.js`).

⚠️ À savoir : un compte NEUF créé par Google depuis l'extension passe par la porte
`PorteNouveauOAuth` (« J'ai déjà un compte VRM ? ») ; la liaison, elle, part dès la session (comme
quand on cliquait déjà « Continuer avec Google » sur l'écran de connexion avec `lier-extension`). Si la
personne choisit ensuite « j'ai déjà un compte », l'extension doit être reconnectée (son bouton).

## Les refus d'envoi (carte du logo, même version)
- `supabaseUpsert` garde, en plus du code (`_statutDernierRefus`), la FAMILLE de la ligne (sans
  identifiant, `familleEcriture`) et la TAILLE du corps envoyé ; `noterFlux` range les 5 derniers refus
  datés dans `vrmFlux.<plateforme>.refus` (un succès ne les efface pas).
- `vrm-badge.js` : `reseau` ⇒ « réseau coupé (le navigateur a interrompu l'envoi), ça réessaie tout
  seul » ; 5xx ⇒ « la base a répondu une erreur (code 503), ça réessaie tout seul » ; inconnu/absent ⇒
  « code inconnu, ça réessaie tout seul » (4xx, 401, 403, `sans_session` : phrases d'avant). Dessous, en
  repli fermé : « Les 5 derniers refus » — date, cause, famille, taille (« 3,2 Mo »).

### iOS : un envoi qui échoue en boucle ? (lu dans le code, pas mesuré sur l'appareil)
- Sa carte vient d'une **5.322** : elle n'a ni la fusion des ventes (5.323) ni ces nouvelles lignes.
- Cause plausible : la ligne `harvest_{uid}_orders_sold` d'un gros compte porte jusqu'à 2 000 ventes
  (mesuré le 6 nov. : 2 000 `nItems` sur 199082413) ; au banc de volume, ~96 Ko pour ~60 ventes, soit
  ~1,6 Ko par vente ⇒ **~3 Mo d'un seul `POST`**. Sur iOS, le service worker d'une extension Safari/Orion
  est suspendu vite ; un envoi de plusieurs Mo en 4G peut être coupé au milieu ⇒ `reseau`, et la même
  ligne repart à la visite suivante ⇒ boucle. Rien n'est perdu (la ligne en base reste l'ancienne,
  `listePlusRiche`), mais la carte reste ambre.
- **Pas corrigé ici** : découper ou alléger `orders_sold` touche la règle « une capture partielle
  n'écrase jamais une complète » et l'identité des ventes (§4.2, §5) — pas une correction « sûre » à
  faire à l'aveugle. La 5.325 dit maintenant la taille de chaque envoi refusé : **le prochain relevé
  sur son iPhone tranche** (si « réseau coupé · harvest_orders_sold · 3 Mo » revient, c'est ça ; si
  c'est un 5xx ou une petite ligne, c'est autre chose). Piste si confirmé : n'envoyer que les ventes
  changées (fusion côté serveur) ou alléger chaque vente (champs lus par l'app seulement).

## Preuves
- `scripts/audit-extension-oauth.cjs` (VRAI `background.js` dans `_fond-vm.cjs`) : 26 verts ; sur le
  `background.js` d'`origin/main` : rouge (`fournisseursConnexion` absent). Mutations : liste blanche de
  `connexion` retirée ⇒ F3 rouge ; historique gardé à 10 ⇒ R1/R2 rouges ; forme non vérifiée ⇒ F2 rouge.
- `scripts/bancs/popup.cjs` (+ 21 contrôles « Continuer avec Google / Discord ») : 146 verts ; copié dans
  l'arbre d'`origin/main` : 11 rouges. Mutation « boutons montrés quand pas su » ⇒ 4 rouges. Captures
  regardées : clair, sombre, carte.
- `scripts/bancs/extension-oauth-app.cjs` (vraie app `dist`, faux Supabase, faux canal d'extension) :
  21 verts (départ direct PKCE, Discord fermé, pas su, inconnu, connecté ⇒ liaison directe, retour dans
  un nouvel onglet frais/périmé) ; sur le build d'`origin/main` : 10 rouges. Mutations « départ même
  non activé » ⇒ A2 rouge ; « marque sans limite de 10 min » ⇒ A5 rouge.
- `scripts/bancs/badge.cjs` : 114 verts (+12 : cause réseau/inconnu/absent, code 503, repli des 5 refus).
- `audit-coherence` (capacité `lieroauth` → `fournisseursConnexion`), `audit-extension-zip`,
  `audit-identite`, `audit-discord-oauth`, `audit-extension-captcha`, `audit-extension-navigateurs`,
  `audit-extension-ui`, `audit-fournisseurs`, `audit-liaison-visite`, `audit-pont-session`,
  `audit-relier-compte`, `audit-icone-extension`, `audit-fiabilite-fond` : verts ; `npm run build` OK.
  (`audit-politique-hotes` : 1 rouge déjà sur main, `src/enLigneLbc.js`, pas de ce chantier.)

## Version
Extension **5.325.0** (neuve : aucune branche ni `main` ne la portait) : manifeste, `CODE_VERSION`,
`lbc-inject.js`/`lbc-relay.js`, `EXT_ATTENDUE`, `EXT_CAPACITES.lieroauth`, table §8, zips régénérés
(`public/VRM-extension.zip`, un dossier ; et les paquets Orion).

## Gestes de Julien
1. Supabase → Authentication → Providers : **activer Discord** (Client ID/secret de l'application
   Discord, redirection `https://lgonxzrzjcqthjtbdpzo.supabase.co/auth/v1/callback`) — tant qu'il est
   éteint, le bouton Discord n'apparaît nulle part (c'est voulu). Google : vérifier qu'il est activé.
2. Installer l'extension 5.325.0 (remplacer le dossier, ⟳ dans chaque Chrome).
3. Sur l'iPhone, après mise à jour : ouvrir la carte du logo sur vinted.fr, déplier « Les derniers
   refus » et envoyer une capture.
