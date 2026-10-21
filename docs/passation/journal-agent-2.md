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

#### Triage du reste du groupe « Argent et stock » (mesuré §6)
- **14 bénéfice réel (avec couverture)** : **déjà en production**. Le bénéfice ne
  somme que les ventes au COÛT CONNU et affiche la couverture (`benefConnu`,
  `nbCout/nb`, « sur X/Y ventes au coût connu », « inconnu — aucun prix d'achat
  saisi »). Rien à bâtir.
- **21 retour reçu → la paire revient en stock** : **déjà en production**
  (`retoursRecus`, `isRetourRecu`, `toggleRetourRecu`, `retoursAttendus`, et la
  règle « (re)numérotée APRÈS la vente ⇒ republiée, de retour en stock »). La
  règle §5/013 (un ancien numéro ne se redonne jamais) est respectée via
  `numeroReprenable`. Rien à bâtir.
- ⛔ **18 achats à vérifier avant la date limite** : **mesurée impossible
  honnêtement**. Lecture seule sur sa vraie base (1 581 achats) :
  `a_une_echeance = false` partout (aucun `protection_until`/`complete_by`/…),
  les champs d'un achat sont `conversation_id, date, photo, price, status,
  title, transaction_id, transaction_user_status` — **aucune date limite
  d'acheteur**. Et **aucun état « livré, en attente de ta validation »** : les
  achats sont à 99 % « Transaction finalisée - l'acheteur a validé la
  commande ». Bâtir une alerte « date limite » reviendrait à **inventer le délai
  de Vinted** — explicitement interdit par le README (G/18). Non bâtie, comme le
  dossier le fait pour la photo du code de retrait : mieux vaut un blanc qu'un
  faux. Les seuls « à vérifier » réels (à retirer, en transit, retour à
  renvoyer) sont déjà surfacés par `achatStage`.

#### 11 · Fiche à l'arrivée d'un achat (TERMINÉE ✅)
Mesuré : un achat porte `title`(100 %), `price`(100 %, le prix payé),
`photo`(18 %), `date` — **pas de taille**. La carte d'achat EST déjà la fiche
(photo, titre, prix payé, N° lié, reçu, étiquette SKU, note). Le seul manque à
l'arrivée pour la **revente** : reporter le prix payé vers le numérotage (G1).
- Menu ⋯ d'un achat **ARRIVÉ** (`st.step>=3 && !cancelled && !st.retour`) :
  **« Copier le prix payé (pour le numérotage) »** (`data-copier-prix`), copie
  robuste (`await` → une promesse rejetée tombe bien dans `catch`, jamais
  « copié » à tort ; `toast('Copie impossible','error')` sinon). On ne relie
  RIEN automatiquement (§5) : il la renumérote/rephotographie. Gated sur
  l'arrivée : un achat annulé/remboursé ne le porte pas.
- `data-achat-tx` posé sur la carte d'achat (affordance de test, comme `data-tx`
  des ventes) pour cibler une carte au banc.
- **Preuves** : `npm run build` vert ; banc `scripts/bancs/achats-fiche.cjs`
  (données inventées, deux tailles) **tout vert**, et **rouge sous mutation** :
  M1 (entrée retirée) → les contrôles « arrivé » rouges ; M2a (copie naïve
  `try{writeText}catch`) → « refusé » rouge (ment « copié ») ; M2b (garde
  `arrive` retirée) → « annulé » rouge (présent à tort). `audit-bancs` vert.

### Groupe « Alertes » — triage (mesuré §6)
- **3 rappel URSSAF à l'échéance** : **déjà en prod** (`api/ship-reminders.js`,
  le 1er du mois ; `push.js` `urssaf:true` ; app). Rien à bâtir.
- **6 page « tout va bien ? »** : **déjà en prod** (Ma journée « Rien d'urgent —
  ta boutique tourne », « quand tout va bien, une ligne »). Rien à bâtir.
- ⛔ **10 rappel la veille au soir** : **bloqué par la contrainte cron**. Le seul
  cron du projet (`ship-reminders`, 08:00 UTC = matin de Paris) tourne une fois
  par jour et mentionne DÉJÀ « demain ». Un rappel *le soir* exigerait un SECOND
  cron Vercel — le README l'interdit sans preuve qu'il passe, et un cron refusé
  bloquerait TOUS les déploiements (plan Hobby, incident #250). Non bâti ; à
  trancher par Julien (second cron) ou à la montée en plan.
- ⏸️ **2 double vente « app fermée » (push serveur)** : **différé**, lourd et
  **cross-domaine**. L'anti double vente existe déjà côté app (cloche + écrans,
  eBay/Leboncoin). Le pousser côté SERVEUR dès qu'`email-inbound` apprend une
  vente, par identité N°, exige de résoudre N°→annonce eBay/LBC côté serveur
  (numeros `main`, `ebay_listings`/`lbc_listings`, marqueur 013 `numeroExterne`)
  — ce qui chevauche la lane eBay de l'Agent 1. Un push générique « vendue,
  pense à retirer ailleurs » sans vérifier qu'elle est cross-listée serait une
  fausse alerte (interdit). À coordonner avec l'Agent 1 ; non bâti seul.

### Groupe « Ventes »
Triage : **13 (paires qui dorment)** et **25 (ce qui part vite = temps de vente)**
**déjà en prod** ; **23 (boost rentable ?)** data-starved (le coût de boost par
paire est mesuré impossible, §5.132 : 0 trace en base) — laissé ; **22 (favoris
sans vente → remise native)** candidat (favourite_count, un nombre, pas une
identité — §3 : la remise native touche tout le monde) ; **24** bâti.

#### 24 · Compte qui vend le mieux (TERMINÉE ✅)
Absent (0 occurrence). Il a 7+ comptes Vinted ; il veut savoir lequel vend le
plus. Agrégation des ventes **finalisées** par compte (count + CA) dans le memo
`perf` de l'écran Ventes, **à côté de « Top marque »** : StatBox « Compte qui
vend le mieux » (le leader) + liste « Ventes finalisées par compte » (le
classement, `data-ventes-par-compte`).
- **Honnête** : agrégation de ventes connues, jamais une estimation (§5). Un
  compte exclu et une vente masquée (✕) n'y entrent pas — via le
  `if (isHidden(o)) continue;` déjà en tête de boucle (§11, une seule règle ;
  pas de second garde d'exclusion). « Qui vend LE MIEUX » suppose une
  comparaison : rien à moins de **2** comptes vendeurs.
- **Preuves** : `npm run build` vert ; banc `scripts/bancs/ventes-par-compte.cjs`
  (3 comptes dont un exclu, données inventées, deux tailles) **vert**, **rouge
  sous mutation** : agrégation neutralisée → leader/classement rouges (6) ;
  seuil `>=2`→`>=1` → « un seul compte » rouge. Le contrôle « gamma (exclu)
  nulle part » garde le placement APRÈS `isHidden`. `audit-tdz`/`audit-bancs`
  verts.

### Déploiements de la session (12 octobre, après-midi)
- **PR #479** (G1 prix d'achat au numérotage) → mergée, déployée, `/api/sante`
  200. En production.
- **PR #480** (G11 fiche à l'arrivée) → mergée, déployée, `/api/sante` 200.
- **PR #482** (G24 compte qui vend le mieux) → mergée.
  ⚠️⚠️ **Le déploiement Vercel du merge a échoué DEUX fois sur `git_info_fail`**
  (Vercel n'arrivait pas à récupérer le commit depuis GitHub — échec en ~7 s,
  AVANT tout build, `list_deployment_events` vide). **Ce n'était PAS un défaut de
  code** : `npm run build` passait, le commit existait bien sur GitHub. C'est un
  hoquet d'intégration Vercel↔GitHub, transitoire. **Production jamais tombée** :
  l'alias vrm.center est resté sur le dernier déploiement READY (#480). Résolu au
  **3ᵉ redéploiement** (`create_deployment` par `deploymentId`, `forceNew:1`,
  `target:production`) après ~90 s d'attente → READY, aliasé, `/api/sante` 200.
  **Leçon** : sur `git_info_fail`, ne pas pousser de commit « correctif » (le code
  est bon) — attendre 1-2 min et **redéployer le même commit**. Le prochain
  déploiement réussi (le mien ou celui de l'Agent 1) emporte de toute façon le
  HEAD de `main`, features comprises.

#### 22 · Favoris sans vente → remise native (TERMINÉE ✅)
Julien (retenu le 11 oct) : relancer les favoris. §3 l'a tranché : on ne connaît
PAS qui a mis en favori (Vinted ne le dit pas — aucun endpoint, aucun champ),
donc pas de message individuel ; **la remise NATIVE de Vinted, elle, touche tous
les favoris en un clic**. Mesuré sur sa vraie base (lecture seule) : sur **644
annonces captées, 224 ont ≥3 favoris** (max 165, moy 17,5) — de vrais candidats.
- Nouveau bloc « 👀 Suivies, pas encore vendues » dans « Conseils & signalements »
  de l'écran Annonces : les annonces EN LIGNE (`annBase`, une vendue en est déjà
  sortie) à **≥3 favoris**, triées par favoris, **PAS déjà dans le repricing**
  (un seul conseil par paire, §7). Chaque ligne : photo, N°·titre, « X ❤️ », et
  **« Proposer une remise »** = un LIEN vers l'annonce Vinted. **VRM ne change
  jamais le prix (§3)** — c'est lui, sur Vinted ; l'explication de la remise
  native est écrite UNE fois en tête du bloc.
- `favourites` est un NOMBRE, jamais une identité (§5/§3). Aucune lecture neuve.
- **Preuves** : `npm run build` vert ; banc `annonces-carte.cjs` étendu
  (9106 = 10 ❤️ récente hors repricing → ressort ; 9105 = 2 ❤️ → absente, seuil
  3), **vert aux deux tailles**, **4 rouges sous mutation** (bloc neutralisé →
  « 9106 ressort » et « remise native » rouges). `audit-tdz`/`audit-bancs` verts.

### Groupe « Terrain » — triage (mesuré §6)
- **16 réponses rapides** : **déjà en prod** (`vinted_quick_replies`,
  `DEFAULT_QUICK_REPLIES`, copiables en 1 clic, éditables). Rien à bâtir.
- **4 fiche « republier » (copie, rien d'automatique)** : **déjà en prod** —
  l'« Assistant de mise en vente » (`lister`, écran Ventes → Outils) rend un
  **titre optimisé + une description prêts à coller** (boutons « Copier »), prix
  conseillé sur ses ventes réelles. C'est exactement la fiche à copier pour
  republier, rien d'automatique. Rien à bâtir.
- ⏸️ **9 codes de retrait hors ligne** : genuine-new mais **délicat** (cache
  service-worker des codes `panel_colis_relais` pour le point relais sans
  réseau) — touche `sw.js` (le chantier cache de §lot 1). À faire avec son
  propre banc (déploiements synthétiques), pas en fin de passe.
- ⏸️ **34 saisie vocale (Web Speech)** : genuine-new, §2.9-OK (API navigateur,
  sans clé) MAIS **la cible n'est pas tranchée** (réponses ? recherche ? prix ?)
  et `SpeechRecognition` **n'existe pas en Chromium headless** — un banc ne
  prouverait que le mock, pas la dictée. À cadrer avec Julien (où) avant de
  bâtir, pour ne pas poser une icône micro au mauvais endroit.
- ⏸️ **35 traduction des messages** : genuine-new, mais l'API **Translator
  intégrée de Chrome est expérimentale/gated** (pas fiable, non prouvable en
  banc headless) ; §2.9 impose le repli « lien, sinon la clé DU VENDEUR ». À
  bâtir prudemment quand la dispo de l'API est mesurable.

### Bilan de la passe G (12 octobre, après-midi) — ce qui reste
**Livré et vérifié en prod cette session** : G1, G11, G24, G22 (4 PR : #479,
#480, #482, #483 ; `/api/sante` 200 à chaque fois).
**Déjà en prod (mesuré)** : 14, 21, 3, 6, 13, 25, 16, 4.
**Mesuré impossible / data-starved (documenté, ne pas bâtir à l'aveugle)** :
18 (date limite achat), 23 (coût boost par paire).
**Bloqué / différé (raison)** : 10 (2ᵉ cron Vercel), 2 (push serveur
double-vente, cross-domaine eBay), 9 (cache SW), 34 (cible + banc), 35 (API
gated).
**Groupes restants à ouvrir (plus lourds)** : Studio (33 détourage local —
licence à vérifier, sinon clé vendeur §2.9), Comptes (37 mode équipe = migration
020+ avec essai annulé sur une branche Supabase ; 17 double-vérif connexion ;
15 récap mensuel comptable — ce dernier **probablement déjà en prod**, à
mesurer), puis **Vitesse (5), en dernier, seule**.
⇒ Les fonctions restantes demandent soit une migration (essai annulé sur branche
Supabase), soit une API navigateur non prouvable en banc, soit une coordination
avec la lane eBay de l'Agent 1 — à ouvrir chacune proprement, pas en fin de passe.

#### 34 · Saisie vocale (TERMINÉE ✅)
Retenu le 11 oct. §2.9 : d'abord ce que le navigateur fait SEUL — la Web Speech
API (`SpeechRecognition`/`webkitSpeechRecognition`), **en français, sans clé ni
serveur**. Composant réutilisable `MicDictee` (après `Icon`) : bouton micro au
trait (icône `mic` ajoutée à `ICON_PATHS`), posé sur la **recherche Annonces**
et le **champ modèle du « mise en vente »** (`setAnnSearch`/`setListQ`).
- **Muet si l'API manque** (`DICTEE_OK`) : sur Safari iPhone, RIEN — jamais un
  bouton mort (§2.7, une fonction qui ne peut pas tenir se tait). Aucune clé,
  aucun serveur (§2.9). On ne DEVINE pas le texte : on pose ce que le navigateur
  a reconnu, à lui de corriger.
- **Preuves** : `npm run build` + `audit-tdz` + `audit-icones` verts ; banc
  `scripts/bancs/dictee.cjs` (deux tailles) — micro présent quand l'API est là
  (mockée, comme le pont/presse-papier : `SpeechRecognition` n'existe pas en
  Chromium headless), la dictée pose « salomon » dans la recherche, écoute en
  `fr-FR` ; **absent** sans API. **4 rouges sous mutation** (garde retirée →
  « absent » rouge ; report `onText` cassé → « dicter » rouge).
- Le composant est **réutilisable** (drop-in) sur les autres champs texte
  (recherches Ventes/Achats) — placé ici sur les deux plus utiles, à étendre si
  Julien le demande.

---

## G9 — Codes de retrait visibles hors ligne (Terrain) — 12 octobre

**Besoin de Julien (retenu le 11 oct, groupe Terrain) :** « codes de retrait hors
ligne ». Au comptoir du point relais, le réseau passe mal ; quand la base ne
répond pas, l'app bascule sur `BaseInjoignable` et il ne voyait plus SES codes —
pile au moment où il en a besoin.

**Mesuré d'abord (§6) :** les codes lisibles vivent déjà dans `panel_colis_relais`
(extension) + les emails transporteur (`email_track_*`, `isColisRetirable`). La
file « à retirer » est publiée dans `vrm_colis_retirer`. Il manquait juste une
copie LOCALE pour survivre à la panne.

**Livré (app seule, aucune requête de plus) :**
- L'effet qui publie `vrm_colis_retirer` garde une copie des codes lisibles
  (`vrm_codes_hors_ligne` = `{at, codes:[{code,lieu,carrier,suivi,titre,qr}]}`),
  réécrite seulement quand elle change (§4.4).
- `codesHorsLigne()` : trois états (pas de cache ⇒ rien — jamais un faux).
- `BaseInjoignable` affiche « 📴 Tes codes de retrait (hors ligne) » : par colis,
  le code en grand, ou « QR — besoin d'internet » quand il n'y a qu'un QR (on ne
  promet pas ce qu'on ne peut pas montrer, §2.7).

**Preuves :** banc `scripts/bancs/codes-hors-ligne.cjs` (données inventées, 390 +
1512 px) — phase 1 base up : le code est gardé en local ; phase 2 base KO : il
reste affiché dans `BaseInjoignable`. Rouge sous mutation (écriture du cache
retirée → phase 1 rouge ; bloc hors ligne retiré → phase 2 rouge). `audit-tdz`
vert.

**Au passage — `audit-photos-vinted` était rouge sur `main`** (collision entre mon
étape E et le chantier photos) : `src/AccueilFilm.jsx` et `src/accueil-carte.jsx`
portent le logo VRM `/logo-vrm-*.png` (même-origine, jamais une photo Vinted).
Inscrits dans `PERMIS` avec leur raison — l'extension sanctionnée de cet audit.
Ce sont MES fichiers (domaine Accueil), donc à moi de les régulariser.

**⚠️ Pour Agent 1 (ligne connexion/extension) — `audit-planchers-code` est ROUGE
sur `main`** : `main` publie la **5.175.0** qui ne porte pas le code `liaison` à la
frontière, alors que `EXT_CAPACITES.liaison = 5.171.0` est en dessous — une 5.175
serait dite « périmée » ou recevrait une session qu'elle ne sait pas lire. Le
remède documenté (« monter les quatre frontières ensemble » : `EXT_CAPACITES.liaison`,
`CODE_DANS_ETAT`, bridge.js, vrm-badge.js) appartient à ta ligne, pas à la mienne
— je n'y ai pas touché. À regarder.

---

## G35 — Traduction des messages (Terrain) — 12 octobre

**Besoin de Julien (retenu le 11 oct, groupe Terrain) :** « traduction des
messages ». Mesuré : des acheteurs écrivent en anglais (cf. la section IA de
CLAUDE.md, « Trainers are in post »).

**Règle §2.9 appliquée :** d'abord SANS IA, avec le traducteur INTÉGRÉ du
navigateur (API `Translator` + `LanguageDetector` de Chrome) — aucune clé,
aucun serveur, jamais SA clé ni l'IA de réponse. Même patron que G34 (micro) :
feature-détection, et si l'API n'existe pas (Safari, vieux Chrome) ⇒ RIEN
(§2.7), jamais un bouton mort.

**Livré :** `BoutonTraduire` (près de `MicDictee`), posé sous chaque message
ENTRANT du fil (`!m.mine && m.body` — jamais les miens, jamais un évènement).
Au clic : détecte la langue, traduit en français, affiche la traduction SOUS
l'original (on n'écrase pas) et DIT de quelle langue (`NOM_LANGUE`). Un message
déjà en français dit « déjà en français » (pas de fausse traduction) ; une API
indisponible dit « traduction indisponible sur cet appareil ». Tout au clic
seulement (pas de téléchargement de modèle ni d'appel en rafale).

**Preuves :** banc `scripts/bancs/traduire-messages.cjs` (données inventées,
390 + 1512 px, `Translator`/`LanguageDetector` mockés comme le micro) :
bouton présent sur l'entrant anglais et UN SEUL (pas sur le mien) ; clic →
traduction + « traduit de l'anglais » ; message FR → « déjà en français » ;
API absente → aucun bouton. **Rouge sous trois mutations** : bouton sur tous
les messages (→ 2 boutons), API ignorée (→ bouton sans traducteur), FR traduit
quand même. `messagerie.cjs` reste vert (sans mock, `TRAD_OK` faux → rien).
`audit-tdz/icones/coherence/variables/chiffres/boutons` verts.

Aucune entrée d'`EXT_CAPACITES` : c'est le navigateur qui traduit, l'app ne
promet rien de l'extension.

---

## Bilan de l'étape G — ce qui est livré, ce qui reste et pourquoi (12 octobre)

**Livré et en ligne cette passe (chaîne de preuve complète, PR mergée, déploiement
READY sur vrm.center, `/api/sante` ok) :**
- **G1** prix d'achat au numérotage (#479) · **G11** copier le prix payé (#480) ·
  **G24** compte qui vend le mieux (#482) · **G22** favoris sans vente → remise
  native (#483) · **G34** saisie vocale (#484) · **G9** codes de retrait hors
  ligne (#485) · **G35** traduction des messages (#486).

**Déjà en production (mesuré, rien à refaire) :** 14, 21 (Argent) · 3, 6
(Alertes) · 13, 25 (Ventes) · 16, 4 (Terrain) · 15 récap comptable (Comptes).

**Mesuré impossible / data-starved (documenté, pas inventé) :**
- **18** (alerte « achat à vérifier avant date limite ») : 0 délai de protection
  acheteur dans ses 1581 achats, pas d'état « livré en attente de validation » —
  on ne peut pas inventer le délai de Vinted.
- **23** (coût de boost par paire) : aucune trace de boost rattachable à une paire
  en base (§5.132) — un coût de compte, jamais réparti.

**Différés — chacun exige une DÉCISION de Julien ou une ressource qu'une session
autonome ne peut pas se donner (le projet interdit d'inventer une règle qu'il n'a
pas tranchée, et d'expédier de l'irréversible sur son outil de gagne-pain) :**
- **2** (double vente notifiée app fermée) : push SERVEUR, et le versant eBay est
  la ligne de l'Agent 1. Cross-lane.
- **10** (rappel la veille au soir) : demande un SECOND cron Vercel. Un cron refusé
  au déploiement bloque TOUS les déploiements (leçon #250) — à ne pas tenter sans
  que Julien l'ait validé (il est noté « à trancher » dans CLAUDE.md, section
  Bilan de la semaine).
- **33 Studio** : le **détourage est déjà en prod** (Photoroom, clé vendeur, §2.9).
  Le « cadre guide + modèle LOCAL dans la page » est sous **licence commerciale**
  (noté dans la passation) — pas de modèle sans clé ni licence libre mesuré, donc
  pas construit (§2.9 : ni SA clé, ni un coût caché).
- **17 double vérification de connexion (2FA)** : aucun MFA aujourd'hui (mesuré :
  0 `factors`/`totp`/`enroll`). Buildable avec le MFA natif de Supabase, MAIS :
  (a) Julien est seul utilisateur et **un mauvais enrôlement le VERROUILLE hors de
  son propre outil** — irréversible sans plan de récupération ; (b) ça touche le
  flux d'auth que la ligne « session adressée » de l'extension fait mûrir. Il faut
  SON feu vert + un chemin de récupération décidé avec lui. Différé, pas abandonné.
- **37 mode équipe** : aucun code équipe aujourd'hui (mesuré). C'est de l'auth +
  RLS (migration 020+), **testable seulement sur une branche Supabase** (§2.3,
  jamais la prod), et il reste des choix PRODUIT non tranchés : quel périmètre
  exact (« colis et codes » = quels écrans ?), comment un membre s'authentifie
  (login séparé ? invitation par email — or les adresses ne sont pas encore
  PROUVÉES, pas de SMTP), comment on révoque. Ça se superpose à l'isolation
  multi-vendeur encore en cours. À cadrer avec lui avant d'écrire une ligne.
- **5 Vitesse (écrans à la demande)** : **les gros découpages sont déjà faits** —
  `App.jsx` est en `React.lazy` derrière l'accueil (`main.jsx`), `three` (720 Ko)
  et `pdf-lib` sont en `import()` dynamique. Le reste, c'est découper le fichier
  **unique de ~37 000 lignes** par écran : un refactor « en dernier, seul » (dit
  tel quel dans la passation) qui est un champ de mines TDZ (§4.6, le défaut le
  plus fréquent du projet) et dont chaque interaction d'écran devrait être
  revalidée. Le livrer en autonome sans Julien pour valider risquerait exactement
  la casse silencieuse que le projet craint le plus. À faire incrémentalement,
  écran par écran, avec un banc par écran — pas en une passe aveugle.

**⇒ Tout ce qui est sûrement constructible en autonomie est livré.** Les 5 items
restants (2, 10, 17, 33, 37) attendent une décision de Julien ou une ressource
(cron validé, licence, branche + SMTP), et Vitesse 5 est le gros refactor final à
mener écran par écran. Rien n'a été inventé ni expédié à l'aveugle.

---

## Répartition proposée des tâches restantes (13 octobre) — Agent 2

Julien demande de répartir le travail restant entre les agents (codex, Agent 1,
moi). Aucune session Claude pair n'est joignable en direct depuis cette machine
en ce moment (peer-messaging ne voit personne) ; cette note EST le canal de
coordination. **Pour éviter les conflits sur `src/App.jsx` (fichier unique,
~37 000 lignes), un seul agent le touche à la fois — c'est moi (Agent 2).**

**MOI — Agent 2** (lane : `src/Accueil*`, reste de `src/App.jsx` HORS `Ebay*`,
extension 5.176→5.189, migrations 020+) :
- **Vitesse 5** (écrans à la demande), en cours : première tranche = sortir le
  gros bloc 3D (`Room3D` + `RoomPerspective`, ~1250 lignes) dans
  `src/Room3D.jsx` en `React.lazy` (dépendances mesurées : seulement `C`, `Icon`,
  `load`, `save` en props ; `three` déjà dynamique). Preuve : taille du bundle +
  `garage3d.cjs` + `verif_visuel.cjs` + `audit-tdz`. Écran par écran ensuite.
- **H** (revue complète) de mon domaine, quand l'Agent 1 a fini D.

**AGENT 1** (lane : `api/ebay*`, `Ebay*` dans App.jsx, migrations 014/015,
frontière session/connexion, `scripts/*ebay*`) :
- ⚠️ **`audit-planchers-code` est ROUGE sur `main`** : la 5.175 publiée est sous
  la frontière `EXT_CAPACITES.liaison = 5.171` → une 5.175 serait dite
  « périmée » ou recevrait une session qu'elle ne sait pas lire. Remède documenté
  par la ligne connexion : **monter les quatre frontières ensemble**
  (`EXT_CAPACITES.liaison`, `CODE_DANS_ETAT`, bridge.js, vrm-badge.js). **À faire
  avant d'autres publications d'extension.**
- Étape **D** (règle d'offre eBay), migration 014/015 (agent eBay).
- Item **2** (double vente notifiée app fermée) : versant push SERVEUR + eBay.

**CODEX** (si Julien le lance) — pour ne PAS entrer en conflit avec App.jsx :
- Idéalement du travail hors `src/App.jsx` : revue/renforcement des **bancs et
  audits** (`scripts/`), ou la **spec** (pas le code) des items différés 17/37.
- **Ne pas** modifier `src/App.jsx` ni le domaine eBay en parallèle de nous.

**Différés — attendent une DÉCISION de Julien** (aucun agent ne les code sans) :
- **17** 2FA : méthode + plan anti-verrouillage (il est seul utilisateur).
- **37** mode équipe : périmètre d'accès + mécanisme d'invitation (adresses non
  prouvées, pas de SMTP).
- **10** rappel la veille : valider un 2ᵉ cron Vercel (un cron refusé bloque tous
  les déploiements).
- **33** modèle de détourage local : licence commerciale.

---

## Vitesse 5 — 1ʳᵉ tranche : le Stock 3D chargé à la demande (13 octobre)

**Mesuré d'abord :** les gros découpages existaient déjà (`App.jsx` en `React.lazy`
derrière l'accueil ; `three` et `pdf-lib` en `import()`). Le plus gros bloc encore
DANS le bundle initial était le Stock 3D (`Room3D` + `RoomPerspective`, ~1250
lignes). Dépendances de niveau module mesurées (scan des identifiants libres, pas
deviné) : `C`, `Icon`, `load`, `save`, `FURN_TYPES`, `GARAGE_AMBIANCES`, plus les
hooks nommés `useState/useEffect/useRef` — tout le reste est local ou en props,
`three` déjà dynamique.

**Livré :** `src/Room3D.jsx` (nouveau), importé en `const Room3D =
React.lazy(() => import('./Room3D.jsx'))`, rendu derrière `<React.Suspense>` à
l'ouverture du Stock. Les 6 identifiants de module passent en **props** (pas
d'import circulaire avec App.jsx) ; `RoomPerspective` (le repli 2.5D) part dans
le même fichier et sert de repli interne de Room3D (plus de prop `fallback`
construite côté App). Aucun changement de comportement.

**Mesuré après :** chunk `Room3D-*.js` = **46 Ko** sorti du bundle ; App initiale
**1 535 Ko → 1 485 Ko**.

**Preuves :** `garage3d.cjs` (rend le Stock 3D : montage, sonde caméra, survol,
clic droit, surlignage, molette, clavier, double-clic — tout vert via le chunk
paresseux) + `verif_visuel.cjs` (conforme aux deux tailles) + `audit-tdz` vert.
La chaîne de preuve est un vrai rouge→vert : à chaque dépendance oubliée le banc
TOMBAIT au garde-fou d'écran (`useState is not defined`, puis `FURN_TYPES is not
defined`) — c'est `garage3d.cjs` qui l'a attrapé, pas le build (un bundle ne lève
pas sur un global manquant). `audit-variables/icones/coherence/chiffres/boutons/
bancs` verts.

⚠️ **Prochaines tranches** (écran par écran, un banc par écran, jamais en passe
aveugle) : les autres gros écrans restent dans App.jsx — ils closurent beaucoup
d'état/d'helpers, donc chaque extraction demande le même scan d'identifiants
libres + un banc de rendu. Le Stock 3D était le plus isolé (tout en props),
d'où le premier choix.

## 21 octobre — Codex : isolation et configuration MFA

Renforcement demandé après la fuite de comptes sur l’appareil d’un ami. Suppression des replis partagés sur les routes Vinted, filtrage explicite et vérification du propriétaire dans l’app et l’extension 5.205, protection des sauvegardes différées et changement d’onglet, caches de l’extension rattachés à la session. Code d’accès obsolète retiré. Le contrôle de confidentialité se renouvelle au retour dans l’app.

Modification minimale dans le domaine eBay : uniquement `portee` dans `api/_lib/ebay.js`, suppression du repli partagé et impossibilité pour le corps d’imposer un autre owner. Aucune fonctionnalité commerciale eBay modifiée.

QR MFA généré localement depuis l’URI native, clé manuelle repliée, remplacement d’un facteur non vérifié. La clé montrée en capture n’est pas automatiquement révoquée : l’utilisateur doit recommencer la configuration depuis sa session.

**Base réelle : migration 021 toujours NON exécutée par Codex, faute d’accès d’administration Supabase. Ne pas déclarer l’incident définitivement résolu.**

## Suite sécurité — réception et push (sans modification MFA)

Le vendeur a reporté la double vérification et refusé les SMS payants : la branche codex/mfa-sms ne doit pas être fusionnée. Travail présent repart de main/PR635 ; aucun code SMS repris.

Réception publique : clé obligatoire pour tous les formats, pas seulement Gmail partagé. Contexte vendeur obligatoire pour les lectures/écritures métier, conflit owner,id. Plus de repli attribuant un email inconnu au propriétaire d'installation : quarantaine privée neutre et reprise après association. Push : authentification obligatoire sur la route et contexte obligatoire côté serveur, même si la sonde dit ancien schéma. Tests synthétiques actualisés pour enregistrer explicitement les adresses et le contexte des notifications.

Limites encore ouvertes : SQL021 non appliquée faute d'accès administrateur ; attribution historique non auditée ; possession des adresses supplémentaires déclarées à prouver (ne pas confondre déclaration et preuve de propriété). Aucun email ou push réel envoyé par les tests.
