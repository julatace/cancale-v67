# 11 novembre 2026 — « Supprimer mon compte » dit la vérité selon le compte (lot suppression-oauth)

Branche `claude/suppression-oauth`, poussée à chaque commit, **pas mergée** (aucune PR).

## Le bug vécu
Julien, connecté avec un compte créé par Discord (AUCUN mot de passe) : l'écran
demandait « Ton mot de passe VRM ». Il ne l'a pas tapé, et la suppression est passée.
Le serveur avait raison : une connexion de moins de 10 minutes (`amr` du jeton) est
une preuve voulue (`api/_lib/suppression-compte.js`). C'est l'ÉCRAN qui mentait :
`aMotDePasse()` lisait `AUTH.user.identities`, que la session ne porte jamais
(`sessionFrom` ne garde que `id` et `email`) ⇒ toujours « pas su » ⇒ champ affiché.

## Ce qui a été fait
- **Une règle, deux lecteurs** : `api/_lib/preuve-connexion.js` (isomorphe).
  `derniereConnexion` (amr), `connexionRecente` (≤ 10 min, ≤ 1 min dans le futur —
  mot pour mot la règle d'avant), `fournisseursDu` (fiche `/auth/v1/user` d'abord,
  sinon `app_metadata.providers` du jeton), `preuveSuppression` ⇒ un cas :
  `oauth-recent` · `oauth-ancien` · `mdp` · `mdp-recent` · `recent` · `pas-su`.
  `suppression-compte.js` importe le calcul : **règle inchangée** (ni affaiblie ni durcie).
- **Le serveur** reste juge. Seule sa phrase change pour un compte SANS mot de passe
  dont la connexion est ancienne : « Ta connexion date de plus de 10 minutes.
  Reconnecte-toi avec Discord, puis reviens ici. Rien n'a été effacé. »
- **L'écran** (`FermerCompte`, `src/ecrans/Reglages.jsx`, `data-supprimer-preuve`) :
  - Discord récent ⇒ « Tu viens de te connecter avec Discord. Tape SUPPRIMER pour
    confirmer. » + « Encore N min. » ; aucun champ mot de passe ;
  - Discord ancien ⇒ « Ton compte n'a pas de mot de passe. » + **« Me reconnecter
    avec Discord »** (un bouton par fournisseur relié) ; ni « SUPPRIMER » ni bouton de
    suppression tant que la preuve manque ;
  - mot de passe ⇒ le champ (+ la reconnexion Discord/Google si reliée) ; le bouton
    s'allume avec « SUPPRIMER » + le mot de passe ;
  - mot de passe récent ⇒ « Tu viens de te connecter. » ; « SUPPRIMER » suffit ;
  - pas su ⇒ le champ, comme avant (« pas su » ne vaut pas « sans mot de passe »).
  La fenêtre se referme pendant qu'il lit : l'écran suit (minuterie).
- **La reconnexion** (`oauthStart(p,'reconnexion')`, `src/auth/reconnexion.js`) :
  contexte `vrm_oauth_reconnexion` (ce compte, ce fournisseur, 10 min) ; **aucune
  intention** de connexion posée (et l'ancienne effacée) ⇒ `PorteSansCompte` n'annule
  rien ; jamais pris pour un « compte neuf » ; retour sur
  `/?tab=settings&vue=compte&section=supprimer` (panneau rouvert, déplié). Retour d'un
  AUTRE compte ⇒ refusé **avant** d'écrire la session (« Ce Discord ouvre un autre
  compte VRM. Ta session est gardée. Rien n'a été effacé. »).
- **Le message de liaison** (`erreurRetourOAuth`, App.jsx) : 3 gestes, ceux de l'écran —
  « 1. Déconnecte-toi, puis « Continuer avec Discord ». 2. Paramètres → Supprimer mon
  compte : tape SUPPRIMER. 3. Reconnecte-toi ici, puis relie Discord. »

## Preuves
- `node scripts/audit-suppression-oauth.cjs --prouve` : 28 contrôles verts ; 5 mutations
  rouges (champ réaffiché pour OAuth · « pas su » = OAuth · fenêtre à 15 min ·
  intention posée à la reconnexion · ancien message de liaison).
- Banc `scripts/bancs/supprimer-oauth.cjs` (390 tactile / 1512, clair / sombre ; serveur
  simulé = la VRAIE `verifierConfirmation` sur le jeton reçu) : **120 OK, 0 échec** ;
  rouge sur un build d'`origin/main` (A et B montrent le champ mot de passe).
- `scripts/bancs/supprimer-compte.cjs` : 50 OK (adapté : sans connexion récente,
  « SUPPRIMER » seul laisse le bouton éteint ; + mot de passe ⇒ allumé).
- Audits verts : variables, tdz, coherence, identite, icones, textes-courts,
  fonctions-api, secrets, csp, supprimer-compte (34), fermer-compte, suppr-compte,
  profil-oauth (41). `npm run build` vert.

## Geste de Julien
Aucun. (Supabase : `…/?tab=settings…` doit rester dans les Redirect URLs — déjà le cas
pour la liaison.) Un « Discord ouvre un autre compte » au retour peut avoir créé ce
compte chez Supabase (OAuth le fait seul) : l'écran le dit, rien n'est écrit chez lui.
