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

### Étape E — page d'accueil + film (EN COURS)
- À reprendre : `passation2/accueil` (`a78fbc9`) dans
  `branches-2026-10-12.bundle`, finir selon `notes/accueil/spec.md`.
