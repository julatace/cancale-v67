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
