# Contrôle quotidien de la prod en navigateur — 9 novembre 2026

Branche `claude/controle-prod-quotidien` (depuis `origin/main`), **pas fusionnée**.
Demande : chaque matin, ouvrir https://vrm.center comme un client, en lecture seule,
et prévenir Julien UNE fois quand quelque chose casse — sans recréer le bruit des
« run failed » (`2026-11-08-ci-verte.md`).

## Ce qui est livré

| fichier | rôle |
|---|---|
| `scripts/controle-prod-quotidien.cjs` | le contrôle : un Chromium ouvre vrm.center en iPhone (390 px, tactile) et en ordinateur (1512 px) |
| `.github/workflows/controle-prod-quotidien.yml` | 7 h 10 heure de Paris + bouton « Run workflow » ; second essai, issue, captures |
| `scripts/controle-prod-issue.cjs` | ouvre / met à jour / ferme UNE issue GitHub au titre stable |
| `scripts/audit-controle-prod-quotidien.cjs` | la preuve : copie locale saine puis cassée exprès, faux GitHub, `--prouve` (mutations) |

### Ce que le contrôle regarde (118 contrôles verts + 1 sauté sur la vraie prod le 9 nov.)
- **Accueil** : HTTP 200, rendu (plus de 200 caractères), **rendu sous 8 s** (`SEUIL_RENDU_MS` ;
  mesuré ici : 0,8 s), titre « VRM… », bouton « Créer mon compte » (`data-cta="inscription"`)
  visible vers `/?inscription`, « Se connecter » vers `/?connexion`.
- **/statut** et **/aide** (la liste des articles, puis le premier s'ouvre).
- **/recuperation.html ouverte par un lien expiré**, sous les deux formes que Supabase envoie
  (`#error=…&error_code=otp_expired` et la même en `?`) : la page dit « expiré », montre
  « M'envoyer un nouvel e-mail » et pas le formulaire du mot de passe, **et aucun appel à
  Supabase ne part** (le renvoi n'est jamais soumis : aucun e-mail).
- **Mode exemple** (la clé d'onglet `vrm_mode_exemple`, comme `scripts/accueil-captures.cjs`) :
  Ma journée, Colis, Ventes se rendent avec le bandeau « Exemple — rien n'est à toi », et
  **zéro requête vers la base, lecture comprise**, zéro écriture.
- Sur chaque page : aucune erreur JavaScript, aucune erreur de console (hors `BRUIT` de
  `src/plantages.js`), aucun `/assets/` en erreur, aucune requête vers la base.
- **/api/sante** : `ok`, chaque clé oui/non de `sante()` (lues dans `api/compte.js` du dépôt,
  pas recopiées), `etat` lisible et sans « panne ».
- **Extension servie** : `/VRM-extension.zip` lisible, **un seul dossier**, version =
  `EXT_ATTENDUE` du dépôt (5.330.0 aujourd'hui).
- **Manifeste** et chacune de ses icônes (des images).
- **En-têtes de sécurité** : les 7 que `vercel.json` pose sur « / », valeur exacte.
- **Compte de démo** : seulement si les secrets `PROD_DEMO_EMAIL` et `PROD_DEMO_MDP` existent
  (aucun n'existe aujourd'hui ⇒ « SAUTÉ … secrets absents », dit dans le journal). Aucun compte
  n'a été créé. S'ils sont posés : connexion, Ma journée doit se rendre ; la seule requête
  non-lecture permise est `/auth/v1/token` (la connexion) ; la capture de ce compte n'est
  **pas** gardée (artefacts d'un dépôt public).

### Lecture seule (§2.3)
Toute requête autre que GET/HEAD/OPTIONS est **coupée avant de partir** et comptée ; toute
requête vers Supabase (même une lecture) est comptée, jugée et coupée hors compte de démo ;
le service worker est bloqué. Sur la vraie prod : **0 requête d'écriture tentée**.

### Contre le bruit
- Premier essai rouge ⇒ **rejoué une fois, 5 minutes plus tard** (une panne passagère ne fait
  rien d'autre qu'un avertissement dans le journal).
- Deux essais rouges ⇒ **UNE issue** « Contrôle quotidien de vrm.center : en échec » :
  ouverte si aucune ne l'est, sinon son **texte est remplacé** (aucun commentaire ⇒ aucune
  notification de plus chaque matin), avec chaque contrôle rouge, le lien du run et quoi faire
  (Instant Rollback, à la main). Et le run est rouge.
- Retour au vert ⇒ l'issue reçoit « De nouveau vert le … » et **se ferme toute seule**.
- 7 h 10 à Paris : GitHub ne connaît que l'UTC ⇒ deux créneaux (`10 5` et `10 6`), un seul
  joue selon que Paris est en UTC+2 ou UTC+1 (`github.event.schedule` : un créneau en retard
  joue quand même, sans doublon). L'autre run se termine vert en quelques secondes, sans e-mail.
- Captures : artefact « captures » du run (14 jours) — `essai-1/` et, s'il a eu lieu,
  `essai-2/`, plus le bilan JSON de chaque essai.

### Pas de doublon avec les autres filets
`disponibilite.yml` (sonde curl toutes les 6 h), `controle-prod.yml` (après chaque mise en
ligne) et `sondes-statut.yml` de la branche `claude/statut-auto` (sondes serveur, `/statut`)
restent tels quels. Ce workflow ne touche aucune route serveur ; il regarde ce que voit un
client, une fois par jour.

## Preuves

- **Vraie prod, lecture seule** (9 nov., 7 h 45) : `node scripts/controle-prod-quotidien.cjs`
  ⇒ 118 verts, 1 sauté (compte de démo), 0 écriture bloquée, 0 requête vers la base. Captures regardées
  (Colis en exemple, récupération expirée en ordinateur) : écrans réels, bandeau d'exemple.
- **Copie locale cassée exprès** (`node scripts/audit-controle-prod-quotidien.cjs`, après
  `npm run build`) : saine ⇒ vert ; puis UNE panne à la fois ⇒ rouge et nommée : zip à
  deux dossiers, autre version, clé de `/api/sante` absente, panne affichée, X-Frame-Options
  absent, icône morte, `/statut` en 404, récupération qui ne dit plus « expiré », erreur
  JavaScript sur l'accueil, bouton « Créer mon compte » disparu, mode exemple qui lit la
  base, rendu trop lent. Issue : 5 cas contre un faux GitHub. Workflow : 10 règles.
- **`--prouve`** : 13 mutations du contrôle (chaque règle réaffaiblie, et « échec sans code
  d'erreur ») ⇒ chacune rouge.
- `actionlint` 1.7.7 : aucun défaut sur le nouveau workflow.

## Ce qui ne se vérifie qu'en CI
Le premier vrai run planifié (créneau, `npm ci`, Chromium du runner), l'API GitHub réelle
pour l'issue (permission `issues: write` du `GITHUB_TOKEN`), l'envoi de l'artefact. À
regarder après la fusion : Actions → « Contrôle quotidien de vrm.center (navigateur) » →
« Run workflow ».

## Gestes de Julien (aucun n'est obligatoire)
1. **Rien à faire pour que ça tourne** : après fusion, il tourne chaque matin.
2. **Compte de démo (facultatif)** : créer LUI-MÊME un compte VRM dédié, vide, qui ne sert
   qu'à ça, puis GitHub → dépôt → Settings → Secrets and variables → Actions → New repository
   secret : `PROD_DEMO_EMAIL` et `PROD_DEMO_MDP`. Sans eux, la connexion est sautée et dite.
3. **Les e-mails « run failed » de GitHub** (on n'a rien changé chez lui) : sur github.com,
   photo de profil → **Settings → Notifications** → section **System → Actions** :
   - cocher **« Only notify for failed workflows »** (plus d'e-mail pour un run réussi) ;
   - ou décocher **Email** (garder seulement « On GitHub ») pour ne plus recevoir aucun e-mail
     de workflow : l'issue « Contrôle quotidien de vrm.center : en échec » suffit à prévenir
     (une issue ouverte envoie, elle, sa propre notification, une seule fois).
   GitHub envoie l'e-mail d'un workflow planifié au compte qui a posé (ou modifié en dernier)
   la ligne `cron` : après la fusion, c'est le compte qui a fusionné.
