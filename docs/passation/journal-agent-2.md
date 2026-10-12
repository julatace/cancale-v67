# Journal — AGENT 2 (« fonctionnalités, accueil, revue »)

Branche de travail : `claude/agent2-nsk5su` (partie de `origin/main`, tête
`ac37a2a` — qui contient déjà les étapes B et C de l'Agent 1 : extension
**5.175.0** en ligne + migration **014** mergée).
Plage de versions d'extension réservée : **5.176 → 5.189**, dans l'ordre.

Coordination : je pousse à chaque étape. L'Agent 1 me lit ici
(`git show origin/claude/agent2-nsk5su:docs/passation/journal-agent-2.md`).
Ordre des PR : la 5.175 de l'Agent 1 est **déjà mergée** dans `main`
(`7589fdf`), donc mon verrou est levé — je peux faire des PR. Avant chaque PR :
`git fetch origin` + `git merge origin/main` (vrai merge, jamais `-s ours`).

Mon domaine (moi seul modifie) : `src/Accueil.jsx`, `public/legal/`,
`scripts/film-accueil.cjs`, tout le reste de `src/App.jsx` (hors `Ebay*`),
`vinted-sync-extension/`, `public/VRM-extension.zip`, migrations **020+**.
Je ne touche PAS au domaine de l'Agent 1 (`api/ebay.js`, `api/_lib/ebay*`,
`Ebay*` dans App.jsx, migrations 014/015, `scripts/agent-sql/`,
`scripts/audit-ebay-*`, `scripts/bancs/ebay-*`).

---

## 12 octobre — démarrage

- Je suis l'**Agent 2** : Julien me l'a dit explicitement, et
  `docs/passation/journal-agent-1.md` existe déjà (règle de détection du README).
- Lu : `docs/passation/README.md` (🔴 LIRE D'ABORD + RÉPARTITION), le journal de
  l'Agent 1. État de `main` à mon démarrage : `ac37a2a` — contient #473, #474,
  la 5.175 (étape B, `7589fdf`) et la migration 014 (étape C, `194e268`).
- Ma branche d'environnement était `claude/project-review-nsk5su` (l'ancienne
  intégration, tête distante `b579919`). Ses commits uniques au-dessus de `main`
  sont **redondants** (photos-r2 + 5.175 déjà dans `main` via l'Agent 1 ; le
  reste = docs de passation déjà sur `main`). Je ne la force-push pas (pour ne
  rien casser de la coordination) : je pars sur `claude/agent2-nsk5su` depuis
  `origin/main`, l'état le plus à jour.

### Étape E — page d'accueil + film (TERMINÉE ✅)
- `passation2/accueil` (`a78fbc9`) est sur une **base ancienne** (`e6bda5c`,
  #470) : son diff vs `main` SUPPRIME les migrations 013/014, `photosVinted.js`,
  et réécrit `App.jsx`/`background.js`. **Je ne l'ai PAS mergée** (elle défairait
  tout le travail récent, §3). J'ai extrait **uniquement** les 12 fichiers du
  delta accueil (vs sa base) et les ai posés sur `main` actuel :
  - neufs : `AccueilFilm.jsx`, `accueil-carte.jsx`, `accueil-demo.js`,
    `accueil-jetons.js`, `accueil-mouvement.js`, `accueil-reglages.js`,
    `accueil-scenes.jsx`, `scripts/audit-accueil-demo.cjs` ;
  - réécrits : `src/Accueil.jsx` (modulaire), `scripts/film-accueil.cjs`,
    `scripts/bancs/accueil.cjs` ;
  - `src/main.jsx` : version branche (Film en `React.lazy`) **+** j'ai ré-appliqué
    l'ajout `lier-extension` que `main` avait (sinon régression du chantier
    connexion de l'Agent 1).
- **Prix 12,99 €** : la branche était à 9,99 € (base ancienne) ; `main`/CGV sont
  à 12,99 € depuis le 11 oct. Corrigé `PRIX_MOIS='12,99'` (`accueil-reglages.js`,
  source unique rendue par `{PRIX_MOIS}`) et les 2 littéraux du banc (fallback +
  liste d'interdits du film).
- `audit-lancement.cjs` : il cherchait le prix en **littéral** dans `Accueil.jsx`
  (ancienne orthographe) — la page le rend maintenant via la constante. Corrigé
  pour suivre la RÈGLE (`PRIX_MOIS`=CGV + aucun littéral mensuel contradictoire),
  **sans affaiblir** : prouvé rouge sous mutation (`PRIX_MOIS` faux → rouge).
  28ᵉ « cri au loup » de la famille documentée.
- **Preuves** : `npm run build` vert ; banc `accueil.cjs` **171 verts / 0 rouge**
  (poids avant l'app : entrée 21,7 Ko gzip, scènes 8,4, film 7,3 — sous les
  plafonds ; `?film` 35 s, fonction pure, aucun prix) ; banc `demarrage.cjs` tout
  vert ; honnêteté statique OK (0 adresse en dur, 0 preuve sociale, 0 promesse
  interdite). `verif_visuel`/`verif_dark` NON lancés (fx/ réelles absentes, pas
  de clé Supabase ici) — ils rendent des écrans de l'app, non touchés par E, et
  restent à la version de `main`.
- **MP4 du film** : non régénéré ici (les MP4 ne montent pas dans le dépôt, et
  la page ne charge aucune vidéo — le film est rendu en direct par canvas ;
  l'export marketing se refait à la demande via `scripts/film-accueil.cjs`).

### Étape F — tri des 21 anciennes branches (TERMINÉE ✅)
Méthode (§F) : pour chaque branche, `merge-base` avec `main`, `merge-tree`,
lecture des commits, et vérification du CŒUR de sa feature (fonction/banc, pas
seulement le nom) sur `main` actuel. ⚠️ `e6bda5c` ET `cdc9c1d` sont **ancêtres
de `main`** : un merge n'apporte que le(s) commit(s) de feature (3-way) — le
risque §3 (« défaire une correction récente ») n'existe que si on accepte le
côté branche dans un conflit.

**Hors de mon périmètre (Agent 1 / déjà fait)** : `worktree-wf_30feaf2f-334-8`
(règle d'offre eBay, étape D), `worktree-wf_d62e1db4-b5c-1` (eBay multi-comptes),
`worktree-agent-a14d457d…` (eBay planificateur), `worktree-wf_e364d40c-3ea-9`
(accueil — fait en E).

**Déjà en production → laissées** (feature cœur présente sur `main`, vérifié) :
- `…-1d6-1` litiges → `ACHAT_A_RENVOYER` (×5) en prod (5.164).
- `…-1d6-2` messages → `data-messagerie` en prod (messagerie 5.135) ; la revue
  du 9 oct est antérieure à la refonte messagerie en prod.
- `…-1d6-3` synchro ligne main → `onCloudReady` (×39) en prod (4 oct, 11 cartes).
- `…-1d6-4` copies « Remettre » → `repriseDe`/`Remettre` (×12) + 013 en prod.
- `…-1d6-6` achats pas postés → `poste-sans-depart`/`cochesNonPartis` (×16) en
  prod (5.162).
- `…-1d6-7` URSSAF par rythme → `vinted_urssaf_freq` (×5) en prod.
- `…-1d6-8` logo/prénom/consignes → icônes PWA (3 oct) + `vrm_prenom` en prod.
- `cb6f835a-c5a-1` pointage (banc seul) / `cb6f835a-c5a-2` coffre →
  `archiverAnnonce` (×3) en prod (5.150). Ce sont surtout des BANCS de
  couverture écrits sur une base ancienne ; les réimporter risquerait des rouges
  (code évolué), peu de valeur.
- `c713efbe-040-2` compte de résultat → `comptabilite` en prod (tâche terminée).
- `wf-banc-statuts` → `audit-statuts`/`statuts-colis`/`widget-colis` sur `main`.
- `wf-ext-notifs` → `audit-evt-extension` sur `main` (5.155).

**WIP interrompus, rien à récupérer → laissés** : `133587f0-45f-5`,
`6f1cc0ad-b1e-1`.

**Vraiment absentes de prod, mais PAS intégrées, avec la raison** :
- `…-1d6-5` **« Tes connexions »** (0 occurrence en prod — genuinely new, voulue
  par Julien, proposition 7). J'ai tenté le merge (2 conflits App.jsx + README).
  **ANNULÉ** : la branche part d'une base pré-5.171 et s'entremêle au chantier
  **session/extension d'Agent 1** (5.171-5.175) — conflit #3 remplacerait
  `authSignOut` (reworké le 11 oct : canal adressé, `deconnecterExtensionAncienne`,
  garde « autre compte », `__vmrPlusieurs`) par un `seDeconnecter` plus ancien
  ⇒ régression du travail tout juste livré ; et `marquerSessionExtension` +
  le changement `background.js` (`etat.session_id`) sont DANS son domaine.
  Sa migration est numérotée **011** (hors de mon périmètre 020+) et son audit
  exige un **Postgres local absent ici** (je ne peux pas la prouver). ⇒ À
  rebâtir proprement sur `main` : UI de liste de sessions + migration **020**
  (revue + essai annulé sur une **branche Supabase**, audit-connexions là où
  Postgres existe), et l'étiquetage de la session d'extension **coordonné avec
  l'Agent 1**. Je n'ai rien poussé pour elle.
- `pdf/app-lecture` **PDF dans le stockage, étape 2** (l'app lit `pdfPath`,
  0 en prod). Prématurée : l'étape 1 (le serveur ÉCRIT les PDF dans le stockage)
  n'est pas faite ; CLAUDE.md « PDF — étape 0 » stage les étapes 1-4 en PR
  séparées avec mesures sur une branche Supabase. Laissée.
- `133587f0-45f-4` **Boutique Chrome** (`audit-store` absent). Gated par
  `EXTENSION_SUR_LE_STORE=false` ; publier la fiche sur le Chrome Web Store est
  un geste de Julien (§7). Laissée jusqu'à sa décision.

**Bilan F** : aucune branche n'apporte, ici et maintenant, une feature
intégrable sans régresser le travail d'un autre agent, appliquer une migration
non prouvable (pas de Postgres), ou livrer un demi-chantier. Tout est laissé,
chaque cas documenté. « Tes connexions » reste le meilleur candidat à construire
proprement (coordination Agent 1 pour l'extension).

### ⚠️ À L'AGENT 1 — deux audits ROUGES sur `main` (hors mon domaine, pré-existants)
Mesuré sur `origin/main` (vrai worktree git) à mon démarrage, AVANT mon étape E
(donc pas une régression de ma part) :
- **`audit-photos-vinted.cjs`** : rouge sur `main`. Domaine photos
  (`photosVinted.js`). À regarder.
- **`audit-planchers-code.cjs`** : rouge sur `main`. Il dit
  « `EXT_CAPACITES.liaison = 5.171.0` est au-dessus de toute version publiée
  sans le champ — 5.175.0 serait dite périmée (ou recevrait une session qu'elle
  ne sait pas lire) », et « une 5.175.0 publiée ne reçoit pas de session
  adressée (extSait('liaison')) : ok [attendu retard] ». C'est ton chantier
  **connexion de l'extension / 5.175** (EXT_CAPACITES.liaison dans App.jsx +
  `scripts/_versions-publiees.cjs`). Je n'y touche pas (risque de conflit avec
  ta lane). À corriger côté 5.175, car ça touche Julien à l'installation.

### Étape G — fonctions retenues par Julien (11 oct), groupe « Argent et stock »

#### 1 · Prix d'achat au numérotage (TERMINÉE ✅)
Julien (§2 retenu le 11 oct) : « prix d'achat au numérotage ». Mesuré avant de
coder : §« prix d'achat » du dossier dit que **8 paires sur 401** seulement ont
un prix d'achat saisi, et qu'il n'existe **aucun pont automatique** paire↔achat
(il les saisit lui-même, §2.5). Le bon moment pour le lui demander, c'est quand
il a la paire en main — **au numérotage**.
- `demanderPrixAchat(item, numeroPose)` (juste avant `poserNumero`) : une modale
  `askText` « Prix d'achat de la N°… ? », facultative (« Plus tard »), qui
  **n'écrase jamais** un prix déjà saisi (`buyOf != null`) ni un achat déjà relié
  (`e.buyFromId`). Même écriture que le champ « achat » de la carte
  (`updatePair { buyPrice, buyFromId:null, buyFrom:null }` — un prix à la main
  n'est pas « relié à un achat »). On ne devine RIEN (§5) : s'il ne le tape pas,
  rien n'est écrit.
- Branchée sur les **4 chemins de succès** de `poserNumero` (pose propre,
  même-paire confirmée, « prendre le prochain » après collision présente,
  « non — numéro neuf » après collision d'archive). ⚠️ **PAS** sur la reprise
  `meme` (la paire revient : elle **hérite** du `buyPrice` de l'ancienne fiche,
  lui redemander l'effacerait).
- **Preuves** : `npm run build` vert ; banc `annonces-carte.cjs` — deux contrôles
  neufs (la feuille s'ouvre tout de suite sur une paire sans prix ; la saisie
  écrit « achat 18,00 € »), **verts aux deux tailles**, et **4 rouges sous
  mutation** (`demanderPrixAchat` no-op, après rebuild — le banc sert `dist/`).
- **Deux audits suivaient l'orthographe, corrigés (règle, pas orthographe)** :
  `audit-identite.cjs` (regex d'ordre de collision assoupli pour tolérer l'appel
  ajouté — toujours rouge si la garde `!autres.length` saute) et
  `audit-numerotation-lecteurs.cjs` (délimiteur `corps()` de `poserNumero` passé
  à `const buyOf = (o) =>`, repère stable qui borne la fonction entière — rouge
  si `manuelAt` disparaît de `poserNumero`). 29ᵉ et 30ᵉ « cri au loup ».
- Passe d'audits : seul `audit-planchers-code.cjs` rouge (pré-existant, domaine
  Agent 1, EXT_CAPACITES.liaison/5.175 — pas touché). `audit-photos-vinted` est
  repassé vert entre-temps.
