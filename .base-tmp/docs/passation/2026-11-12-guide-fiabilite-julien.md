# Guide de Julien : sauvegardes, base d'essai, surveillance, retour arrière (12 nov. 2026)

Ce guide est fait pour toi. Une phrase = un geste.
Le récit technique est dans `docs/passation/2026-11-12-fiabilite-prod.md`.

---

## 0. Ce qui marche déjà, sans rien faire

- **Supabase Pro** garde une copie de toute la base chaque jour, 7 jours.
- **Nouveau** : chaque soir, VRM range une copie chiffrée des lignes de chaque vendeur.
  Elle est dans Supabase → **Storage** → seau **`sauvegardes`** (privé). Gardée 14 jours.
- **Nouveau** : GitHub regarde vrm.center toutes les 5 minutes (au mieux, voir §3).
- Tu n'as rien à faire pour ces trois-là.

---

## 1. Les sauvegardes

### 1a. Poser les deux secrets de la copie hors de Supabase (10 min, une fois)

Pourquoi ? Cette copie-là survit même si le projet Supabase disparaît.
Mesuré le 12 nov. : elle n'a **jamais tourné**, les deux secrets manquent.

1. Choisis une phrase de 5 ou 6 mots (plus de 20 lettres).
2. Note-la dans ton gestionnaire de mots de passe **et** sur papier.
   ⚠️ Phrase perdue = copies illisibles pour toujours.
3. Ouvre **supabase.com** → ton projet.
4. En haut, clique **Connect**.
5. Choisis l'onglet **Session pooler** (pas « Direct », pas « Transaction »).
6. Copie l'adresse qui commence par `postgresql://postgres.lgonxzrzjcqthjtbdpzo:`.
7. Remplace `[YOUR-PASSWORD]` (crochets compris) par le mot de passe de la base.
   Oublié ? Project Settings → Database → **Reset database password**.
8. Ouvre **github.com/julatace/cancale-v67** → **Settings** (onglet du haut).
9. À gauche : **Secrets and variables** → **Actions**.
10. Bouton vert **New repository secret**.
11. Name : `SUPABASE_DB_URL`. Secret : l'adresse de l'étape 7. **Add secret**.
12. Encore **New repository secret**. Name : `SAUVEGARDE_PHRASE`. Secret : ta phrase.
13. Onglet **Actions** → à gauche **Sauvegarde quotidienne de la base** → **Run workflow** → **Run workflow**.
14. Attends 5 à 10 minutes : trois coches vertes = c'est bon.

### 1b. (Facultatif) Une clé à toi pour la copie du soir

Sans rien faire, la copie du soir est chiffrée avec la clé de service de Supabase.
Si tu préfères une clé à toi :

1. Vercel → projet **cancale-v67** → **Settings** → **Environment Variables**.
2. **Add New** : Key `SAUVEGARDE_CLE`, Value : une phrase de 20 lettres ou plus.
3. Coche **Production** seulement → **Save**.
4. Note la phrase avec l'autre (papier + gestionnaire).

### 1c. Je veux récupérer des données perdues

Ne touche à rien d'autre. Ouvre une session Claude et dis :
« Restaure l'export du JJ/MM de mon compte, en suivant le guide fiabilité ».

Ce qu'elle fera avec toi :
1. Toi : Supabase → **Storage** → **sauvegardes** → le dossier du jour d'avant le problème.
2. Toi : clique le fichier qui porte ton identifiant → **Download**.
3. Elle : le remet dans une base jetable sur sa machine, et compare.
4. Elle : recopie **seulement** ce qui manque. Jamais d'écrasement.
5. La clé se tape dans le terminal, **jamais dans le chat**.

### 1d. Tout le projet est cassé (le pire cas)

1. Supabase → **Database** → **Backups**.
2. Choisis le jour → **Restore**.
⚠️ Tout ce qui a été écrit depuis ce jour est perdu. Le site est coupé pendant l'opération.

---

## 2. La base d'essai « vrm-essai » (20 min, une fois)

Pourquoi ? Essayer une nouvelle version sans toucher à tes vraies données.

### 2a. Créer le projet

1. **supabase.com** → en haut à gauche, ton organisation **cancale**.
2. Bouton **New project**.
3. Name : `vrm-essai`.
4. Database Password : clique **Generate a password**, puis **Copy**. Garde-le.
5. Region : **West EU (Ireland)**.
6. Plan : **Free** (gratuit).
   ⚠️ Si Supabase propose seulement un projet payant dans **cancale** : crée d'abord une
   organisation gratuite (**New organization**, plan **Free**), puis le projet dedans.
7. **Create new project**. Attends 2 minutes.

### 2b. Copier trois choses

1. Dans **vrm-essai** : en haut, **Connect**.
2. Onglet **Session pooler** : copie l'adresse. Remplace `[YOUR-PASSWORD]` par le mot de passe de 2a.4.
   → c'est l'**adresse de la base d'essai**.
3. À gauche : **Project Settings** → **API** (ou **Data API**).
4. Copie **Project URL** (`https://xxxx.supabase.co`). → c'est l'**URL d'essai**.
5. Copie la clé **anon** / **publishable**. → c'est la **clé publique d'essai**.
6. Copie la clé **service_role** / **secret** (bouton **Reveal**). → c'est la **clé de service d'essai**.

### 2c. Préparer la base d'essai (GitHub fait tout)

1. GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Name : `ESSAI_DB_URL`. Secret : l'**adresse de la base d'essai**. **Add secret**.
3. **Actions** → à gauche **Préparer la base d'essai (vrm-essai)** → **Run workflow**.
4. Coche verte = toutes les migrations sont posées, dans l'ordre. Aucune donnée.
5. Après chaque nouvelle migration : relance-le. Seules les nouvelles passent.

### 2d. Brancher les versions d'essai de Vercel dessus

1. Vercel → **cancale-v67** → **Settings** → **Environment Variables**.
2. Pour chacune des 4 lignes ci-dessous : **Add New**, coche **Preview** SEULEMENT.
   ⚠️ Ne coche **jamais** Production : sinon vrm.center perdrait tes données.

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | l'URL d'essai |
| `VITE_SUPABASE_ANON_KEY` | la clé publique d'essai |
| `SUPABASE_URL` | l'URL d'essai |
| `SUPABASE_SERVICE_KEY` | la clé de service d'essai |

3. Dernier geste, à faire faire par une session Claude :
   « Ajoute l'URL d'essai `https://xxxx.supabase.co` aux adresses permises (connect-src) ».
   (Sans ça, le navigateur refuse de parler à la base d'essai.)

⚠️ Sur une version d'essai, **ne connecte pas l'extension** : elle écrit toujours dans la vraie base.
⚠️ Crée un compte d'essai dans la version d'essai : ton vrai compte n'existe pas là-bas.

---

## 3. Être prévenu si vrm.center tombe

### 3a. Déjà en place

- Toutes les 5 minutes, GitHub ouvre vrm.center et `/api/sante`.
- Deux ratés de suite ⇒ une « issue » **vrm.center ne répond pas** ⇒ **un e-mail de GitHub**.
- Revenu ⇒ un second e-mail « C'est revenu », l'issue se ferme seule.
- ⚠️ Mesuré : GitHub ne tient pas toujours « toutes les 5 minutes » (parfois des heures).
  D'où le service ci-dessous, vraiment toutes les 5 minutes.

### 3b. UptimeRobot (gratuit, 10 min, une fois)

1. Va sur **uptimerobot.com** → **Register for FREE**. Confirme ton e-mail.
2. **+ New monitor**.
3. Monitor type : **HTTP(s) - Keyword**.
4. Friendly name : `VRM`.
5. URL : `https://vrm.center/api/sante`.
6. Keyword : `"ok":true` — Alert when : **keyword does not exist**.
7. Monitoring interval : **5 minutes**.
8. Alert contacts : coche ton e-mail.
9. **Create monitor**.
10. Recommence avec un 2e monitor : type **HTTP(s)**, URL `https://vrm.center`, nom `VRM accueil`.
11. Sur ton iPhone : installe l'app **UptimeRobot**, connecte-toi → notifications poussées.

UptimeRobot vérifie avant d'alerter : une seconde de lenteur ne te réveille pas.

---

## 4. Revenir à la version d'avant

Quand ? Juste après une mise en ligne, l'app est cassée.

### 4a. Le plus simple : depuis Vercel (30 s)

1. **vercel.com** → projet **cancale-v67** → onglet **Deployments**.
2. La ligne du haut avec le badge **Current** = la version cassée.
3. Descends à la ligne **Production** juste en dessous, avec un point vert **Ready**.
4. À droite de cette ligne : les **trois points ⋯** → **Instant Rollback**.
5. Confirme. vrm.center revient en quelques secondes.
6. ⚠️ Ensuite, les nouvelles fusions ne partent plus seules.
   Quand c'est réparé : **Deployments** → la nouvelle ligne → **⋯** → **Promote**.

### 4b. Depuis GitHub, en un clic

1. **Actions** → à gauche **Revenir à la version d'avant** → **Run workflow**.
2. Façon :
   - **vercel** : instantané. Il faut d'abord le secret `VERCEL_TOKEN` (ci-dessous).
   - **git** : rien à poser. Il prépare une « demande de fusion ».
3. Case « Écris OUI » : vide = il **dit** seulement ce qu'il ferait. `OUI` = il le fait.
4. Façon **git** : ouvre le lien donné → bouton vert **Merge pull request**. Vercel remet l'ancienne version en ~2 min.

Poser `VERCEL_TOKEN` (une fois, facultatif) :
1. vercel.com → ta photo → **Account Settings** → **Tokens**.
2. **Create** : nom `retour-arriere`, Scope : ton équipe, Expiration : 1 an → **Create** → copie.
3. GitHub → Settings → Secrets and variables → Actions → **New repository secret** : `VERCEL_TOKEN`.

### 4c. Et l'extension ?

Un retour arrière de l'app **ne change pas** l'extension.
L'extension a ses propres numéros (le zip). Si c'est elle qui casse : réinstalle le zip
précédent (dossier gardé sur ton ordinateur), puis **⟳** dans Chrome.

---

## Résumé des gestes

| geste | temps | obligatoire ? |
|---|---|---|
| 1a. Secrets `SUPABASE_DB_URL` + `SAUVEGARDE_PHRASE` | 10 min | **oui** |
| 3b. UptimeRobot | 10 min | **oui** |
| 2. Projet vrm-essai + `ESSAI_DB_URL` + 4 variables Preview | 20 min | conseillé |
| 4b. `VERCEL_TOKEN` | 3 min | facultatif |
| 1b. `SAUVEGARDE_CLE` | 2 min | facultatif |
| Migration 033 (garde des points de restauration) | 2 min | facultatif |
