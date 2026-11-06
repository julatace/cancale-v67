# 6 nov. 2026 — Sauvegarde quotidienne chiffrée · Prix d'achat au numérotage

Branche locale `v36-sauvegarde-prix` (partie de `claude/project-review-nsk5su`). Deux sujets
décidés par Julien le 6 nov.

---

## 1. La sauvegarde quotidienne, avec un essai de restauration

### 1.1 Ce qu'on a mesuré (lecture seule, SELECT, 6 nov.)

| mesure | valeur |
|---|---|
| plan Supabase (organisation « cancale ») | **Pro** |
| serveur | Postgres **17.6**, eu-west-1 |
| `app_data` (`pg_total_relation_size`) | **82 Mo** (85 852 160 octets), **10 516 lignes**, 34 Mo de JSON brut |
| base entière (`pg_database_size`) | 236 Mo |
| schéma `public` | 29 tables, 27 politiques RLS, 25 déclencheurs, 61 fonctions, 4 séquences |
| schéma `sauvegarde` | `app_data_20260930` (55 Mo), `app_data_20261002` (56 Mo), `vinted_accounts_*`, `journal_ecritures` (28 Mo, 154 000 lignes), `numerotation_013` — **rien depuis le 2 oct.** |
| familles d'id dans `app_data` (les plus grosses) | harvest 3 543 · email_inconnu 1 799 · email_offer 937 · email_reception 927 · coffre 780 · … · main 7 |

Particularités qui comptent pour une restauration :
- 5 déclencheurs du `public` appellent des fonctions du schéma **`sauvegarde`**
  (`noter_ecriture` sur `app_data` et `vinted_accounts`, `noter_ecriture_agent` sur
  `vrm_agent_commandes`, `_journal`, `_vendeurs`) ;
- `abonnements.owner` a une clé étrangère vers **`auth.users`** ;
- `app_data.owner` vaut par défaut `auth.uid()`, les politiques visent `authenticated`/`anon` ;
- aucune publication, aucune extension dans `public` (pgcrypto, uuid-ossp dans `extensions`).

### 1.2 Ce que le plan Pro offre déjà (doc Supabase « Database Backups », lue le 6 nov.)

- Une sauvegarde **quotidienne automatique**, les **7 derniers jours**, dans Dashboard →
  Database → Backups.
- La restauration remet **tout le projet** à l'état de ce jour-là : le projet est
  **inaccessible** pendant l'opération, et **tout ce qui a été écrit depuis est perdu**.
  On ne peut pas reprendre « seulement les lignes perdues ».
- Les sauvegardes sont **physiques** (Postgres ≥ 15.8.1.079) : la doc dit qu'elles ne sont
  pas téléchargeables (seule une copie logique `pg_dump` l'est).
- **Supprimer le projet supprime aussi ses sauvegardes.**
- La restauration à la seconde (PITR) est une option payante (~100 $/mois pour 7 jours,
  plus une instance « Small » minimum) — pas pour nous.

Ce qui manquait donc : une copie **à nous**, gardée **30 jours**, hors de Supabase, dont on
peut reprendre **une ligne** sans remettre tout le projet en arrière — et dont on **prouve**
chaque semaine qu'elle se restaure.

### 1.3 Le dépôt est PUBLIC : qui peut télécharger un artefact ?

Doc GitHub « Downloading workflow artifacts » : *« People who are signed into GitHub and have
read access to a repository can download workflow artifacts. »* Sur un dépôt public, **tout
compte GitHub** a l'accès en lecture, et les journaux des actions sont publics aussi.
Conséquences, tenues par le code :
- la copie est **toujours chiffrée** avant d'être gardée (sans la phrase, le script s'arrête
  et ne garde rien) ;
- la phrase n'est **que** dans les secrets GitHub (et chez Julien), jamais dans le dépôt ;
- les journaux ne disent **aucun contenu ni aucun nombre par famille** (des totaux d'état
  seulement ; en cas d'écart, le NOM de la famille).

### 1.4 Ce qui a été construit

| fichier | rôle |
|---|---|
| `.github/workflows/sauvegarde.yml` | chaque nuit 02:23 UTC : copie + chiffrement + artefact 30 jours ; le **dimanche** (et à chaque lancement à la main, case cochée par défaut) : essai de restauration de la copie du jour |
| `scripts/sauvegarde/sauvegarder.sh` | compte (lecture seule) → `pg_dump --schema=public` (structure + données, format custom) → recompte → emballe (copie + 2 comptes + fiche : date, versions, empreinte SHA-256) → chiffre (**gpg AES-256**, phrase par descripteur, jamais sur la ligne de commande) → **relit le chiffré avec la phrase** et compare l'empreinte → efface tout le clair |
| `scripts/sauvegarde/essai-restauration.sh` | déchiffre, vérifie l'empreinte, prépare une base NUE (`stub-supabase.sql`), restaure structure + données, pose les propriétaires (`proprietaires.sql`), rejoue contraintes/index/politiques/déclencheurs, puis compte famille par famille : chaque compte restauré doit tomber **entre le compte d'avant et celui d'après la copie** (la base vit pendant la copie) |
| `scripts/sauvegarde/compter.sql` | les comptes : chaque table du `public`, et `app_data` par famille d'id (le mot avant le premier `_`), dans une transaction **en lecture seule** |
| `scripts/sauvegarde/stub-supabase.sql` | ce qu'une base nue doit avoir pour recevoir le `public` de Supabase : rôles `anon`/`authenticated`/`service_role`, `auth.uid()/role()/jwt()`, `auth.users`, et les deux fonctions du schéma `sauvegarde` appelées par les déclencheurs (ici, elles ne font rien) |
| `scripts/sauvegarde/essai-local.sh` | le banc local (§1.6) |

Garde-fous :
- **Aucune écriture sur la vraie base** : `pg_dump` lit ; `compter.sql` ouvre `begin
  transaction read only`. L'essai de restauration **refuse** toute cible qui n'est pas
  `localhost`/`127.0.0.1`/`::1`, et toute URL contenant « supabase », **avant** de se
  connecter ; il refuse aussi une base cible non vide.
- « Une liste vide n'est jamais une réponse » : `app_data` à 0 ligne, ou sans ligne `main` ⇒
  **aucune copie** (elle remplacerait les bonnes au bout de 30 jours).
- Phrase de moins de 20 caractères ⇒ refusée. Secret absent ⇒ l'action échoue en disant
  le geste (GitHub envoie alors un e-mail).

Choix techniques :
- **gpg** plutôt qu'`age` (`age -p` ne lit une phrase que depuis un terminal) ou `openssl
  enc` (aucun contrôle d'intégrité : une mauvaise phrase peut « réussir » et rendre du
  bruit). gpg est installé sur les machines GitHub et sur la plupart des ordinateurs.
- **URL « Session pooler »** (port 5432, `aws-…pooler.supabase.com`) : la doc Supabase dit
  que la connexion directe `db.<ref>.supabase.co` est **IPv6 seulement** et cite **GitHub
  Actions** parmi les plateformes IPv4 seulement.
- Les outils PostgreSQL sont installés **à la version du serveur** (lue par `show
  server_version_num`) : un `pg_dump` 16 refuse un serveur 17. La base jetable du dimanche
  (`docker run postgres:<version>`) suit la même version.
- Schéma `public` seulement (la demande) : `auth.users` (comptes, mots de passe hachés)
  n'est **pas** dans la copie — le Supabase Pro le couvre 7 jours. Le schéma `sauvegarde`
  (anciennes copies, 140 Mo) non plus.

### 1.5 Les gestes de Julien (pas à pas)

**Une fois, avant tout :**
1. **Choisir la phrase de chiffrement** : 5 ou 6 mots au hasard (plus de 20 caractères),
   par exemple *« carton bleu semelle mardi vingt pluie »* (pas celle-ci). La noter dans
   ton gestionnaire de mots de passe **et** sur papier. ⚠️ **Phrase perdue = sauvegardes
   illisibles, pour toujours** : personne (ni GitHub, ni Claude) ne peut la retrouver.
2. **Trouver l'URL de connexion Supabase** : supabase.com → ton projet → bouton
   **« Connect »** en haut de la page → méthode **« Session pooler »** → copier l'adresse
   qui ressemble à
   `postgresql://postgres.lgonxzrzjcqthjtbdpzo:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`.
   Remplacer `[YOUR-PASSWORD]` (crochets compris) par le mot de passe de la base. Tu ne
   l'as plus ? Project Settings → Database → **Reset database password** (aucune fonction
   de VRM ne s'en sert : l'app et les `api/` passent par les clés, pas par ce mot de
   passe). Si le mot de passe contient `@ : / ? # &` ou une espace, le choisir sans
   (plus simple que de l'encoder).
   ⚠️ Prendre **« Session pooler »**, pas « Direct connection » (IPv6, injoignable depuis
   GitHub) ni « Transaction pooler » (port 6543).
3. **Poser les deux secrets** : github.com → `julatace/cancale-v67` → **Settings** →
   **Secrets and variables** → **Actions** → **New repository secret** :
   - Name `SUPABASE_DB_URL`, Secret : l'adresse du point 2 ;
   - Name `SAUVEGARDE_PHRASE`, Secret : la phrase du point 1.
4. **Après la fusion sur `main`** (les tâches planifiées ne tournent que depuis `main`) :
   onglet **Actions** → « Sauvegarde quotidienne de la base » → **Run workflow** (laisser
   « Faire aussi l'essai de restauration » coché) → attendre les deux coches vertes. Le
   résumé du second job dit « Essai de restauration réussi ».

**Ensuite :** rien. Si une nuit échoue, GitHub t'envoie un e-mail ; l'erreur dit quoi faire.

### 1.6 Restaurer en cas de besoin

- **Tout le projet est cassé** (base supprimée, migration ratée) : Supabase → Database →
  Backups → choisir le jour → Restore (jusqu'à 7 jours ; tout ce qui a été écrit depuis
  est perdu, le projet est coupé pendant l'opération).
- **Des lignes ont disparu ou ont été écrasées** (le cas le plus probable) :
  1. GitHub → Actions → « Sauvegarde quotidienne de la base » → le run du **jour d'avant
     le problème** → en bas, **Artifacts** → télécharger `vrm-sauvegarde-…` (un zip qui
     contient le `.tar.gpg`) ;
  2. ouvrir une session Claude : « restaure cette sauvegarde dans un Postgres jetable et
     recopie seulement les lignes perdues de `app_data` » — en lui donnant le fichier ;
     la phrase se tape dans son terminal, jamais dans le chat. La session lance
     `FICHIER=… SAUVEGARDE_PHRASE=… CIBLE_URL=postgresql://…@127.0.0.1:…/… GARDER_DOSSIER=./copie bash scripts/sauvegarde/essai-restauration.sh`,
     compare, puis réinsère **seulement** les lignes manquantes (`insert … on conflict do
     nothing`), **après** une copie fraîche de l'état actuel — jamais un écrasement de
     table entière.
  3. À la main, sur un ordinateur avec gpg et PostgreSQL : `gpg --decrypt
     vrm-sauvegarde-….tar.gpg > copie.tar` (la phrase est demandée), `tar -xf copie.tar`,
     `pg_restore --list vrm-sauvegarde-…/public.dump` pour voir le contenu,
     `pg_restore --data-only --table=app_data -d <base jetable> vrm-sauvegarde-…/public.dump`.

### 1.7 Comment c'est testé

`bash scripts/sauvegarde/essai-local.sh` monte un Postgres **jetable** (dossier temporaire,
port 10150), une base « source » de la même forme que Supabase (`stub-supabase.sql` +
`schema-exemple.sql`, inventé), 572 lignes **inventées**, puis : sauvegarde, restauration,
et sept cas qui doivent échouer. Résultat :

```
✓ sauvegarde produite · ✓ fichier chiffré (aucun texte lisible) · ✓ rien en clair à côté
✓ restauration réussie : 8 comptes relus, tous dans la fourchette
✓ app_data restaurée 572/572 · ✓ politiques/déclencheurs/clés rejoués 3/2/1
✓ contenu de app_data identique ligne à ligne (empreinte)
✓ a. mauvaise phrase refusée · ✓ b. cible distante refusée · ✓ b2. « localhost.supabase.co » refusé
✓ c. app_data vide : aucune copie · ✓ d. 5 lignes manquantes dans « email » : vues, échec
✓ e. phrase courte refusée · ✓ f. cible déjà remplie refusée · ✓ g. secret absent : le geste est dit
VERT
```

- **Avec le schéma RÉEL** : la structure du `public` de production a été relue (catalogue,
  SELECT — aucune donnée) et rejouée en local par `SCHEMA_SQL=<fichier>` (fichier gardé
  hors du dépôt) : **34 comptes**, **27 politiques / 25 déclencheurs / 3 clés étrangères**
  rejoués à l'identique, VERT. C'est ce passage qui a trouvé les deux fonctions du schéma
  `sauvegarde` et le `CREATE SCHEMA public` à écarter.
- **Mutations** : la comparaison des comptes neutralisée ⇒ le cas d rougit ; la garde
  « app_data vide » neutralisée ⇒ le cas c rougit ; la garde d'hôte neutralisée ⇒ la
  seconde garde (« supabase » dans l'URL) refuse encore (deux couches).
- **Pas testé ici** : le vrai passage sur GitHub (il faut les secrets et `main`), et
  `pg_dump` 17 à travers le pooler de Supabase. Le premier lancement à la main (§1.5.4)
  est cet essai.

---

## 2. Le prix d'achat au numérotage

### 2.1 Constat et règle

Aucune des 56 annonces en ligne n'a de prix d'achat (mesure de la vague 2) : 504 fiches sur
522 ont été numérotées **toutes seules** par VRM. §2.5 : il saisit les prix lui-même, on ne
les devine pas. Une **seule écriture** pour tout prix tapé : `src/prixAuNumerotage.js`.

- `ecriturePrixSaisi(texte)` : **vide ⇒ rien** (ni « 0 », ni lien effacé) ; **illisible ⇒
  rien**, et on le dit (« 25 € env. », « 2x30 », « -5 », « 25,999 ») ; sinon
  `{ buyPrice: "25,00", buyFromId: null, buyFrom: null }` (centimes exacts).
- `prixADemander(fiche, prixConnu)` : ni prix (fiche ou miroir par N°) ni achat relié.
- `suggestionNumerotage(…)` : le bouton « Relier · 32,90 € » et sa ligne — **jamais** une
  valeur pour le champ.
- Dans l'app, `ecrirePrixTape(cible, texte, numero)` applique la règle, écrit dans la fiche
  (par `updatePair` pour une annonce, par clé pour la saisie en série) et dans le miroir
  par N° (`vinted_buyprice_by_num`).

### 2.2 Les moments où une paire reçoit son N°, et ce qui s'y passe

| moment | avant | maintenant |
|---|---|---|
| N° posé **à la main** (carte, ligne « mise en ligne », 4 chemins de `poserNumero`) | feuille « Prix d'achat de la N°… » (11 oct.), `parseFloat` (« 25 € env. » valait 25), écriture brute | même feuille, **champ vide**, clavier décimal, « Plus tard » ; une **suggestion proposée** à côté (« Relier · 28,00 € » : marque ET taille, achat antérieur, la règle de « Sans achat relié ») — SON tap relie par `relierAchatAnnonce` ; sinon `ecrirePrixTape` |
| N° posé **par VRM** à la mise en ligne (bloc « mise en ligne numérotée par VRM », 48 h) | rien | chaque ligne porte un champ **« Prix d'achat · facultatif »** vide + la suggestion ; même écriture |
| N° posé par VRM **sans geste** (numérotage auto, doublons réglés) | carte Ma journée « N annonces sans achat relié » (vague 2) | **la même carte, fusionnée** : « N annonces numérotées sans prix d'achat » ; « Voir » ouvre la file, qui porte maintenant **« Saisie en série des prix d'achat »** |
| saisie en série (`setBuyForKey`) | texte brut, un champ vidé écrivait `''` et effaçait le lien | `ecrirePrixTape` |
| « Saisir » de la file, champ « achat » de la carte | deux écritures voisines | `ecrirePrixTape` (vider le champ de la carte retire toujours le prix, comme avant) |

Pas couverts (raison) : « Dupliquer » une fiche (`vrm_fiches_neuves`, une fiche sans
annonce : son prix vivra sur l'annonce publiée), un N° redonné après un doublon ou « le
carton dit N°… » (la paire avait déjà son N°, la carte Ma journée la rattrape), Vestiaire
(`attribuerNumerosVc`, automatique : hors de la file Vinted pour l'instant).

### 2.3 Preuves

- `node scripts/audit-prix-numerotage.cjs` : **45 contrôles verts** (E règle exécutée, D
  quand demander, P suggestion, S branchement dans `App.jsx` commentaires retirés).
  `--prouve` : **11/11 mutations attrapées** (vide écrit, parseFloat, lien gardé, achat relié
  redemandé, valeur de suggestion, saisie en série brute, seconde règle au numérotage,
  feuille pré-remplie, numérotage sans demande, ligne « mise en ligne » sans la règle,
  seconde carte Ma journée).
- **Arbre d'avant** (`git archive 46f18482`) : 13 rouges sur 15 (le module n'existe pas,
  aucun branchement).
- `scripts/bancs/prix-numerotage.cjs` (390 tactile et 1512, clair et sombre) : **132
  contrôles verts** — feuille au N° posé (champ vide, clavier décimal, « Relier · 28 € »
  proposé, « 25 € env. » ⇒ rien d'écrit, « Plus tard » ⇒ rien, « 18 » ⇒ « 18,00 » + miroir
  par N°, « Relier » ⇒ l'achat relié, nuage relu), ligne « mise en ligne » (champ vide,
  « Relier · 30 € », « 32,5 » ⇒ « 32,50 » au nuage), Ma journée (UNE carte « 4 annonces
  numérotées sans prix d'achat »), file → « Saisie en série » (champ vidé ⇒ rien, « 40 » ⇒
  « 40,00 »), 44 px, aucun défilement de côté, aucune erreur. Captures regardées (feuille
  390 clair/sombre, ligne 1512 sombre, Ma journée, file). **Sur le build de l'arbre d'avant**
  (46f18482) : 49 rouges dès 390 clair (pas de champ marqué, pas de suggestion, pas de prix
  sur la ligne, carte « sans achat relié », pas de « Saisie en série »).
  Note de banc : à 1512 px sous swiftshader, Playwright n'obtient jamais « stable » sur un
  bouton de la feuille (fond flouté ; mesuré immobile) — le banc finit par Tab + Entrée.
  Constat au passage (pas touché) : Ma journée peut dire « 3 annonces sans numéro » alors que
  ces 3 annonces viennent d'être numérotées toutes seules au chargement.
- Verts : `npm run build`, `audit-identite`, `audit-coherence`, `audit-chiffres`,
  `audit-benefice`, `audit-benefice-unique`, `audit-achats-a-relier`.

### 2.4 Geste de Julien

Annonces → « N nouveaux N° · Vérifier » : taper le prix sur chaque ligne (ou « Relier ») ;
Ma journée → « N annonces numérotées sans prix d'achat » → « Saisie en série ».
