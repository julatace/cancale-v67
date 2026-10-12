# Journal — AGENT 1 (« mise en ligne, eBay, agent »)

Branche de travail : `claude/new-session-gzdgur` (partie de
`origin/claude/project-review-nsk5su`, tête `fb782fe`).
Plage de versions d'extension réservée : **5.190 → 5.199** (normalement aucune
— l'intégration est déjà en 5.175.0).

Coordination : je pousse à chaque étape. L'Agent 2 me lit ici avant de partir.
Ordre des PR : **ma PR de la 5.175 part EN PREMIER** ; l'Agent 2 attend qu'elle
soit mergée dans `main` avant sa première mise en ligne.

---

## 12 octobre — démarrage

- Je suis l'**Agent 1** : aucun `journal-agent-*.md` n'existait sur aucune
  branche `claude/` au démarrage (règle de détection du README), et Julien me
  l'a dit explicitement.
- Ma branche d'environnement `claude/new-session-gzdgur` portait un commit
  `313e80e` (port de la page d'accueil fait plus tôt dans cette session — lane
  de l'Agent 2). Il est **superflu** : la version canonique de l'accueil est
  `passation2/accueil` (`a78fbc9`), que l'Agent 2 reprendra (étape E). J'ai donc
  réinitialisé ma branche sur l'intégration ; `313e80e` reste récupérable sur
  l'historique distant si besoin, mais rien d'unique n'y est.

### Étape B — mettre la 5.175 en ligne (EN COURS)

- Base : intégration `fb782fe`, extension **5.175.0** (manifest vérifié).
- `main` = `2fed734` (#473 + #474). `main` n'est pas un ancêtre *de graphe* de
  l'intégration (topologie des merges), mais son CONTENU est déjà dans
  l'intégration (l'intégration = main + preuve de vente eBay + connexion
  extension + notifs + K3 014 + ext 5.175). Le `git merge origin/main` final
  devra donc être un quasi no-op — à vérifier au moment de la PR.
- `passation2/photos-r2` = **un seul commit** `bf63bca` au-dessus de `c7efee0`
  (déjà dans l'intégration). Fichiers touchés : CLAUDE.md,
  `scripts/audit-photos-vinted.cjs`, `scripts/bancs/README.md`,
  `scripts/bancs/photos-vinted.cjs`, `src/App.jsx`, `src/photosVinted.js`.
- Fichiers hors de mon domaine touchés par l'étape B (et POURQUOI) :
  `src/App.jsx` (zone `PhotoVinted` / phrase des photos) et `src/photosVinted.js`
  — c'est le merge de photos-r2 que l'étape B impose explicitement (README §B.1),
  pas une fonctionnalité neuve. Comportement conservé : un refus de l'extension
  n'est jamais définitif (`estDefinitive` rend toujours faux).

(suite ci-dessous au fil des étapes)

### Étape B — TERMINÉE ✅ (12 octobre)

- Fusion `photos-r2` (`bf63bca`) : conflits CLAUDE.md + `scripts/bancs/README.md`
  résolus (les deux sections photos gardées + relecture croisée 5.174 ;
  `photos-vinted` = version 166 contrôles ; `enligne`/`deux-extensions` = versions
  riches 5.171). `src/App.jsx`/`photosVinted.js` auto-mergés, `estDefinitive`
  rend toujours `false`.
- `npm run build` vert.
- **91 audits verts, 0 rouge.** Sautés faute de Postgres dans ce conteneur :
  `audit-agent-sql`, `audit-renum-b` (hors périmètre photos ; à couvrir en C).
- **Bancs : 26 verts.** `photos-vinted` a montré 7 « reds » = flakes de fin de
  session Chromium (`Target page… has been closed` après ~160 contextes dans un
  seul process) ; **chaque scénario (T, T390, X, O, W, N, Y) rejoué seul = vert**
  (SEUL=…, ports 5751/5752). `capacites` **non lancé** : il lit `fx/` (fixtures
  réelles absentes du dépôt public, pas de clé Supabase ici).
- `git merge origin/main` : no-op de contenu (vérifié par merge-tree).
- **PR #476 → `main` mergée** (merge commit `e432f8c`).
- **Vercel** : déploiement `dpl_EQnr41h4...` READY, alias `vrm.center` ;
  `/api/sante` = 200 `{ok, serviceKey:true, owner:true, ia:false, stripe:false,
  stripeWebhook:true}` ; `/VRM-extension.zip` servi = **439 265 B** (identique à
  `public/VRM-extension.zip`, `application/zip`) → c'est bien la 5.175.
- Consigne d'installation envoyée à Julien (une fois).

➡️ **L'Agent 2 peut maintenant partir** (sa 1ʳᵉ mise en ligne était bloquée
tant que la 5.175 n'était pas dans `main` — c'est fait).

### Étape C — migration 014 (K3) : EN COURS

### Étape C — migration 014 : revue + fichier en ligne ✅ ; APPLICATION DIFFÉRÉE
- `git merge passation2/k3-014` (9df8061) : propre, 4 fichiers (migration,
  `essai-annule.cjs`, `audit-agent-sql.cjs`, section CLAUDE.md). Inerte
  (`agent_ebay='0'`).
- Revue (C.1) : **`audit-agent-sql` 221 contrôles, 0 rouge** (Postgres jetable
  embarqué — il tourne dans ce conteneur sans Postgres système). Couvre les
  classes nommées : sérialisation effacement↔écrivains (verrou consultatif),
  bails bornés (pas de gel 33 h), garde d'isolation (REPEATABLE READ refusé),
  « Fermer mon compte » pas « fait » sur porte ouverte, droit manquant ≠ échec
  de purge. **Revue par UN agent** (pas le panel de 4) s'appuyant sur ces
  contrôles + lecture du diff. Les défauts de revue 2 étaient déjà corrigés.
- Build vert, **92 audits verts** (`audit-renum-b` sauté : 5 min Postgres, non
  concerné).
- **PR #477 → `main` mergée** (`ac37a2a`). Fichier corrigé en ligne, INERTE.
- ⚠️⚠️ **PAS appliquée à la base de production** : cette session n'a **aucun
  outil SQL Supabase** (pas de connecteur, pas de clé). L'essai-annulé (C.3) et
  l'application (C.4) attendent une session qui a `execute_sql` sur le projet
  `lgonxzrzjcqthjtbdpzo`. Rien n'est faké. `vrm_reglages.agent_ebay` reste '0'
  tant que non appliquée — donc aucun effet, aucun risque en l'état.

### Étape D — règle d'offre eBay : EN COURS
- Base : `passation2/regle-offre` (`00a9d92`, revue tour 3). Tour 4 :
  6 confirmés (0,2,3,4,5,6) à corriger, 5 à juger (7-11), #1 rejeté (laissé).
- Fusion dans l'intégration = gros conflit attendu (branche partie de `cdc9c1d`,
  avant 013 / preuve-vente / relecture croisée).

## Passe visuelle (demande de Julien — skills design d'Emil Kowalski installés)
Branche `claude/new-session-gzdgur` (branche de dev sanctionnée), commit 10a1e93.
Constat d'abord : la base visuelle est DÉJÀ très soignée (appui iOS, fondu
d'onglet, feuilles/toasts, anneaux de focus bleu marque, reduced-motion,
opposition police d'affichage/texte, grain, chiffres tabulaires). On ÉLÈVE,
on ne refait pas — §7 intacte, aucune couleur nouvelle.
Fait, couche GLOBALE (`index.html` seul — faible collision, aucun churn App.jsx) :
- `touch-action:manipulation` → supprime la latence ~300 ms du tap sur iPhone
  (pincer-pour-zoomer gardé) ; appui long ne sélectionne plus le texte d'un bouton.
- Courbes/durées nommées (`--vrm-ease-ios/-out`, `--vrm-dur-*`), réutilisées.
- Entrée d'écran en ease-out-quint, opacité seule (contrainte position:fixed).
Preuves : build + audits boutons/cohérence/icônes/chiffres/variables verts.
Plafond atteint côté couche globale : pas de classe `.vrm-card` générique, les
cartes sont stylées EN LIGNE dans App.jsx. Aller plus loin (élévation au survol,
stagger d'entrée) = toucher le gros fichier partagé — à faire en passe DÉDIÉE,
vérifiée au rendu (fixtures ou déploiement), jamais en aveugle (§7, §6.2).

## Cartes vivantes (options 1 & 2 de Julien, prouvées au banc) — commit ee4b73a
- Option 1 (accueil) : survol d'élévation sur `.acc-q` et `.acc-prix` + logo
  qui respire. Réutilise REFLET/OMBRE_CARTE (aucune couleur neuve), loin du hero
  → « accent rare » intact. Accueil banc 171/0 inchangé.
- Option 2 : primitives `.vrm-card` (élévation au survol + appui) et
  `.vrm-stagger` (cascade d'entrée, montage unique) dans index.html ; appliquées
  à la carte d'accueil de l'app (PremiersPas) + sa liste d'étapes. Premier jour
  banc 67/0 inchangé.
- Preuve : `scripts/bancs/cartes-vivantes.cjs` survole pour de vrai et lit
  ombre/transform calculés. Red-before sur HEAD = 6 rouges (les 6 contrôles de
  survol/cascade), 12/12 après ; reduced-motion neutralise.
- `.vrm-card`/`.vrm-stagger` sont prêtes à être adoptées écran par écran (une à
  la fois, prouvée à chaque fois) — ne jamais mettre `.vrm-stagger` sur une
  liste qui se réordonne en direct (ça rejouerait, §Emil).
