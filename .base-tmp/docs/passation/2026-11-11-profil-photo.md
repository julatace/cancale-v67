# Lot DJ6 « Profil » — 11 nov. 2026 (branche `claude/profil-photo`)

Demande de Julien (`2026-11-11-demandes-julien.md`, ligne DJ6) : photo de profil =
celle de Discord/Google si le compte est relié ; téléverser sa photo ; masquer son
nom ; Paramètres caché derrière le profil (clic sur la photo ⇒ le menu) ; vérifier
la connexion Discord (un NOUVEAU compte avait été créé avec l'adresse de Discord au
lieu de relier le sien).

## Ce qui est fait (et prouvé)

| demande | où | preuve |
|---|---|---|
| Photo : téléversée > Discord relié > Google relié > initiale | `src/profil/identiteProfil.js` (`choisirAvatar`, hôtes permis : `cdn.discordapp.com`, `media.discordapp.net`, `*.googleusercontent.com`, https seulement), `src/profil/AvatarPersonnel.jsx` | banc R1 (`data-avatar-source`), audit `profil-oauth` |
| Téléverser : recadrage carré, PNG ≤ 256 px, < 110 000 car., retirer | `AvatarPersonnel.jsx` (`Recadrage`, `rendreCarre`), serveur `api/_lib/profil-avatar.js` (`pngProfilValide`, quota 12/h) | banc R4, test `profil-avatar.test.mjs` |
| Masquer mon nom (colonne « Mon compte », e-mail masqué, en-tête sans nom d'entreprise) | même ligne privée, champ `nomMasque` seul | banc R3, test unitaire |
| Paramètres derrière le profil | `GROUPES_PLUS` sans `settings` ; la pastille (colonne / en-tête du téléphone) ouvre `src/profil/MenuProfil.jsx` : **Paramètres en tête**, Appareils connectés, Masquer mon nom, Se déconnecter ; « g p », ⌘K et `?tab=settings` mènent toujours à Paramètres | banc R2, audit (mutation `parametres`) |
| « Relier Discord / Google » d'un vendeur DÉJÀ connecté = **liaison** | `ConnexionsCompte.jsx` (Google ET Discord, « Délier » confirmé, jamais la dernière façon de se connecter) → `preparerLiaisonOAuth` = `GET /auth/v1/user/identities/authorize` avec SA session (linkIdentity), retour vérifié même propriétaire (`resultatLiaisonPermis`) | **banc R6 (neuf)** + test `liaison-oauth.test.mjs` |
| « Continuer avec Discord » sans compte VRM ne crée plus un compte en silence | l'intention du clic (`connexion` / `inscription`, `src/auth/compteNeuf.js`) ; au retour, compte neuf (1 identité, < 10 min, jamais reconnecté) + clic « connexion » ⇒ `PorteSansCompte` ⇒ `POST /api/compte?mode=oauth-sans-compte` qui refait tout (fiche GoTrue clé de service, inventaire VIDE, pas de Stripe) et l'efface ; l'écran dit « Aucun compte VRM relié à ce Discord. Connecte-toi d'abord, puis relie Discord dans ton profil. » + « Créer un nouveau compte avec Discord » (explicite) | banc R5, audit `profil-oauth --prouve` |

### Ajouts de cette reprise (l'agent précédent s'était arrêté « en cours »)
1. **R6 « Relier Discord » exécuté dans la vraie app** (rien ne le prouvait) : la
   requête part vers `identities/authorize` avec `Bearer <sa session>`, PKCE,
   retour `?tab=settings` ; **aucun** `/auth/v1/authorize` (la connexion qui crée un
   compte) ; « manual linking » éteint ⇒ dit, on reste sur VRM ; retour de Discord ⇒
   le MÊME compte, « Ton compte Discord est associé », ligne `data-connexion-etat="relie"`.
2. **« Manual linking » éteint chez Supabase** : avant, message générique (« pas
   disponible ») ; maintenant « La liaison n'est pas encore activée sur VRM. Ton
   compte reste inchangé. » (`liaisonOAuth.js`, `error_code manual_linking_disabled`).
3. **Discord déjà pris par l'autre compte** (le cas de Julien : son Discord a son
   propre compte VRM, ancien) : le message renvoyait à « J'ai déjà un compte VRM »,
   une porte qui ne s'ouvre que sur un compte de moins de 10 min. Maintenant :
   « Ce Discord a déjà son propre compte VRM. Connecte-toi avec Discord, puis
   supprime cet autre compte (Paramètres → Supprimer mon compte). Reviens ensuite ici
   le relier. » (`erreurRetourOAuth`, App.jsx).
4. **Photo relue en projection (§4.4)** : la photo (≤ 110 Ko) était relue entière à
   chaque retour sur l'onglet (> 60 s). Le client envoie `si=<empreinte>` ; le serveur
   lit TROIS scalaires (`hash`, `nomMasque`, `partageCarte`) et répond `inchange`
   sans la photo. Elle n'est jamais dans `main` ni dans une ligne lourde : une ligne
   privée par compte (`profil_avatar_*`, propriétaire neutre, clé de service), lue
   seulement par son propriétaire.
5. **Menu du profil : Paramètres en premier** (le geste le plus fréquent).
6. La photo Discord/Google dans Paramètres → Mon compte était carrée (vue sur la
   capture 390) : ronde.

## Gestes comptés (principe de Julien : gagner du temps)
| parcours | avant | après |
|---|---|---|
| Ouvrir Paramètres, ordinateur | 1 (entrée de colonne) | 2 (photo → Paramètres), ou « g p » ; **sa demande** de le cacher |
| Ouvrir Paramètres, téléphone | 2 (Plus → Paramètres) | 2 (photo → Paramètres) |
| Changer sa photo | 3 (Paramètres → Mon compte → Ajouter) + Enregistrer | 3 (photo → photo → Ajouter) + Enregistrer |
| Masquer son nom | impossible | 2 (photo → bascule) |
| Relier Discord pour se connecter | 3, mais le bouton reliait le **pseudo de la carte**, pas la connexion (d'où le compte en trop) | 4 (photo → Paramètres → Mon compte → Relier Discord), et c'est une vraie liaison |
| Connexion Discord sans compte | 1 clic ⇒ compte vide créé en silence, app vide | 1 clic ⇒ rien créé, la phrase dit quoi faire |

## Décisions tranchées (« tranche le reste toi-même »)
- Pas de « Relier Discord » dans le menu du profil : geste rare (une fois), il reste
  dans Mon compte ; le menu garde quatre lignes.
- Le compte Discord ANCIEN de Julien n'est pas supprimé automatiquement (il a peut-être
  des données) : c'est elle qui le supprime, le message le dit.

## Preuves (11 nov.)
- `npm run build` vert (après `git merge origin/main`).
- Audits verts : variables, tdz, coherence, identite, icones, textes-courts (47),
  fonctions-api, secrets, csp (images Discord/Google : `img-src https:` déjà permis),
  profil-oauth (41 verts) ; `audit-profil-oauth --prouve` : ROUGE sur origin/main (20)
  et sur chaque mutation (ecart, vide, identites, intention, parametres), VERT ici.
- Tests : `profil-avatar.test.mjs` 5/5 (le neuf ROUGE sur le code d'avant ET par
  mutation `&&false`) ; `liaison-oauth.test.mjs` 3/3 (le neuf ROUGE sur le code d'avant).
- Banc `scripts/bancs/profil-photo.cjs` : **111 verts, 0 en échec** (390 et 1512, clair et sombre ; R1–R6, dont « Paramètres en tête du menu ») ; après l'arrondi de la photo dans Mon compte, 390 clair relancé : 36 verts. R6 ROUGE par mutation
  (liaison remplacée par `/auth/v1/authorize`) : 4 échecs ; sur origin/main le bouton
  « Relier Discord » n'existait pas (la ligne Discord était le pseudo de la carte).
- Captures regardées à 390 et 1512 (menu, coque, relier, relié, sans compte).

## Geste de Julien (Supabase, rien changé par VRM)
1. Supabase → **Authentication → Sign In / Providers** → **Discord** : activé, Client
   ID + Client Secret de l'app Discord (Discord Developer Portal → OAuth2), redirect
   `https://lgonxzrzjcqthjtbdpzo.supabase.co/auth/v1/callback`. (État actuel : pas su,
   la lecture de `/auth/v1/settings` est bloquée depuis cette machine ; « Bientôt » à
   l'écran tant qu'il est éteint.)
2. Même page, section **User Signups** (ou Authentication → Settings selon la
   version) : **« Allow manual linking »** → ON, Save. Sans lui, « Relier Discord » dit
   « La liaison n'est pas encore activée sur VRM ».
3. Pour le compte en trop de Julien : se connecter avec Discord, Photo → Paramètres →
   Mon compte → Supprimer mon compte ; se reconnecter avec son e-mail, Photo →
   Paramètres → Mon compte → « Relier Discord ».

## Reste
- Rien de rouge connu. La vraie liaison n'a pas été jouée contre le vrai Supabase
  (aucune écriture dans la vraie base) : à essayer par Julien après le geste 2.
