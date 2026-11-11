# 11 nov. 2026 — Découpe d'App.jsx, version 2 (outil rejouable)

Branche outil : `claude/decoupe-app` · résultat de la répétition : `claude/decoupe-app-essai` (jetable, jamais à fusionner).
Aucune PR, rien sur `main`.

## Ce qui a été fait
- `scripts/decouper-app-2.cjs` : découpe par ANALYSE SYNTAXIQUE (Babel), pilotée par `scripts/decoupe-plan.json`
  (des NOMS, jamais des lignes ; un bloc absent est dit, un bloc refusé est dit avec sa raison). Trois sortes :
  - `vues` : une branche `{condition && (…)}` du rendu d'un composant de tête (ex. `curSub==='ventes'` de
    Comptabilite) devient `<VueX v={{…}}/>` à la demande ; les valeurs lues du composant sont passées
    (lecture seule vérifiée : refus si la branche écrit une variable du composant, si une variable lue est
    réaffectée après elle ou dans une fonction non appelée sur-le-champ, si elle appelle un hook, lit
    this/arguments, await/yield). `laPlusGrande` lève une ambiguïté (≥ 2× la suivante).
  - `racines` (écran à la demande) : comme decouper-app.cjs ; un bloc déclaré DANS un composant (closure) est refusé.
  - `pur` (import statique, ne lit rien d'App, initialisations sans effet) — codé, pas utilisé par le plan.
  - Garde-fous : réaffectation d'une variable d'App ⇒ reste ; initialisation avec effet ⇒ reste dans App ;
    blocs balisés entiers ; ordre relatif gardé ; styles gardés à leur place ; `precharger` = morceau demandé
    au repos 4 s après l'ouverture (même total d'octets, premier écran plus léger).
  - Balises : lignes `// ⟦→ coeur/X #k⟧` / `// ⟦← App.jsx #k⟧` ; vues `/*⟦→ … #vk⟧*/…/*⟦→/⟧*/` et
    `/*⟦← App.jsx #vk⟧*/…/*⟦←/⟧*/` ; tout ce qui est posé dans App finit par `// ⟦découpe 2⟧`.
- `scripts/_source-app.cjs` lit aussi `src/coeur/`, recolle les vues, retire les lignes `⟦découpe 2⟧`.
- audit-variables, audit-tdz, audit-commandes, audit-parite-plateformes lisent aussi `src/coeur/`.
- `scripts/verifier-decoupe.cjs --avant <arbre> --apres <arbre> [texte structure imports poids audits tests bancs]`.

## Prouvé (répétition sur origin/main f04d4a5)
- texte recollé IDENTIQUE à l'avant (83 467 lignes, hors imports de style et liste d'exports) ;
- `tab===` 59→59, `curSub===` 90→90, écrans montés 43→43, 680 composants rendus aux mêmes nombres (+1 par vue) ;
- imports/exports : aucun cassé neuf ; build OK ; audit-variables, audit-tdz, audit-commandes, audit-parite verts ;
- poids : morceau App 3 852 Ko / 1 290 Ko gz → 3 389 Ko / 1 167 Ko gz (−9,5 % gz) ; JS du premier
  chargement 1 367 → 1 244 Ko gz (−9 %). App.jsx source 4 535 → 3 786 Ko (9 modules src/coeur/).

## ÉTAT À LA REPRISE
- **Pas encore lancé** : étapes `audits`, `tests`, `bancs` du vérificateur (longues ; à lancer en fond) ;
  mutation qui rougit chaque contrôle (ex. retirer un nom du `const {…} = v` d'une vue ⇒ audit-variables rouge ;
  réécrire une ligne d'une vue ⇒ étape texte rouge) ; captures d'écran Ventes/Achats/Annonces/Messages/Colis.
- `claude/decoupe-app-essai` porte le résultat (WIP, non vérifié par audits/bancs).
- Prochaines étapes exactes :
  1. `git worktree add /tmp/w/avant origin/main` ; `git worktree add /tmp/w/apres claude/decoupe-app` ; lier node_modules ;
     dans apres : `node scripts/decouper-app-2.cjs --appliquer` ;
  2. `node scripts/verifier-decoupe.cjs --avant /tmp/w/avant --apres /tmp/w/apres` (toutes étapes) ;
  3. mutations ; captures 390/1512 des onglets ; puis commit du résultat sur `claude/decoupe-app` au « GO ».
- Ce qui reste dans App.jsx et pourquoi : `Comptabilite` ~1,4 Mo (sa logique — hooks, effets, rappels comme
  `rendreConversation`, `pickupUnion` — lit des centaines de variables du composant : pas mécanique) ; Ma journée
  (premier écran) ; le haut de Colis (son IIFE pose `ongletColisVu`, `colisSansCompte`) ; `AppCoeur` 330 Ko ;
  EtatActions / GuideDemarrageApp / ParcoursArriveeApp (rendus au démarrage : un squelette clignoterait) ;
  AuthScreen (réaffecte `__lierConnexion`).
- Pièges : un module à vues seules ne doit RIEN avoir après sa dernière suite (sinon ligne vide recollée) ;
  `scope.getFunctionParent()` rend une Scope (`.block`, pas `.node`) ; une racine paresseuse peut voyager dans
  un morceau (sourceApp la retire aussi après recollage) ; l'ordre du plan compte (VueColisHaut après VueColis).
