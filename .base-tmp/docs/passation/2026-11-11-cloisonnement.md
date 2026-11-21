# 11 nov. 2026 — Cloisonnement, simulation de création de compte, « comme un vrai client »

Branche `claude/agent2-cloisonnement` (second agent), partie d'`origin/main`. **Pas de PR, pas
de fusion** : l'agent principal intègre. Aucun changement d'extension, aucune fonction `api/`
ajoutée (12 au plus), aucune migration, rien écrit dans la vraie base.
Recouvrement avec `claude/e2e-extension` vérifié : ce banc-là joue la VRAIE extension avec l'app
(liaison, dressing, vente) ; il ne teste ni les routes `api/` entre deux vendeurs, ni la bascule
de vendeur dans un onglet, ni la simulation admin, ni la production. Rien de refait.

## 1. « Aucun vendeur ne voit jamais rien d'un autre »

### Les routes — `scripts/audit-cloisonnement.cjs` (+ `scripts/_cloisonnement-mutations.cjs`)
- Chaque fichier `api/*.js` est **exécuté** (un processus par route) contre une **fausse base
  qui applique la RLS** : jeton d'un vendeur ⇒ seulement SES lignes (lecture, écriture, `PATCH`,
  `DELETE`), ligne écrite au nom d'un autre ⇒ 403 ; clé de service ⇒ tout visible (c'est la route
  qui doit filtrer) ; clé publique ⇒ rien. Supabase Auth simulé : seul un jeton à signature
  valide est reconnu (`/auth/v1/user`), l'admin (`/auth/v1/admin/users`) est tracé.
- Quatre personnes inventées : **O** (propriétaire de l'installation), **A** (vendeur),
  **B** (l'attaquant), **N** (le propriétaire neutre, quarantaine). Chaque ligne de O, A, N porte
  un canari (`CANARI-A`…) ; la base **fabrique une ligne pour chaque `id` demandé** (eq, in, like,
  `or=`) : quoi que la route lise, A et O en ont une.
- Les modes sont **lus dans le code** (`mode === '…'`, `action === '…'`, et les actions des
  bibliothèques : communauté, accompagnement, formateur, équipe, factures, Photoroom, favoris,
  agenda…) : un mode ajouté demain est couvert sans toucher l'audit. GET et POST.
- Six variantes de B : `base` (son jeton) · `usurpe` (`owner`/`uid`/`user_id`/`vendeur`/
  `proprio`/`membre` = A, compte Vinted de A, adresse de A, en-têtes `x-vrm-equipe`/`x-vrm-owner`,
  en requête ET corps) · `in` (`owner=in.(A,B)`, `id=in.(…)`, `select=owner,data`) · `cles` (clé
  d'un compte eBay de A, compte Vinted de A pour le relais, SA clé de widget) · `forge` (jeton au
  `sub` de A, signature fausse) · `anonyme`.
- Rouge si : un canari (ou l'id Vinted / la clé eBay de A ou O) sort dans la réponse, une
  écriture touche une ligne de A, une fonction de la base est appelée **à la clé de service** au
  nom de A, l'admin lit/efface A, B s'approprie le compte Vinted de A, ou une lecture à la clé de
  service est **portée sur A** (`owner=eq.A`) pendant la requête de B. Chez O, seules sont permises
  (et listées) : la création d'un signalement, les mesures anonymes, le relevé des plantages, et
  la notification du propriétaire (ses `push_subs`/`push_prefs`/`push_journal`).
- **Résultat : 1 560 appels de B (234 touchent la base), 4 680 contrôles, 0 rouge.** Aucun trou trouvé dans les
  routes. `--prouve` : **6/6 trous injectés rougissent** (texte d'e-mail lu sans filtre, `sub`
  du jeton cru sans Supabase, renouvellement Vinted de tous les vendeurs, `owner` pris dans le
  corps (étiquettes), widget servi sans clé, relais Vinted lu à la clé de service).
- `CLOISON_DETAIL=1` : chaque appel, son code et le début de sa réponse.

### Notés (hors routes, pour l'agent principal)
1. **Le cloisonnement des fonctions SQL n'est pas testé ici.** Communauté, équipe (016),
   accompagnement, formateurs, appareils appellent des fonctions de la base avec le JETON de
   l'appelant ; l'audit les liste (ex. `vrm_accomp_decider(p_membre=A)`) mais la règle est dans
   le SQL. Il faudrait un banc SQL (PGlite ou une branche Supabase) qui joue ces fonctions avec
   deux `auth.uid()`.
2. **La RLS de la vraie base n'est pas prouvée par ce contrôle** (il la SIMULE). Contrôle à
   faire en lecture seule : chaque table a `owner = auth.uid()` en `USING` ET `WITH CHECK`.
3. `api/vinted-refresh.js` code l'URL Supabase de production en dur (ignore `SUPABASE_URL`) :
   sans risque de fuite, mais les bancs doivent la router.
4. Par conception (pas des fuites) : `discord-deja` rend l'e-mail MASQUÉ du compte qui porte le
   même Discord ; `vinted-pris` dit si un compte Vinted est déjà relié ailleurs (oui/non).

### L'onglet — `scripts/bancs/cloisonnement-onglet.cjs`
A (base inventée au volume réel, `_base-volume.cjs`, pseudos `vendeuseA_*`) est connecté et ouvre
ses écrans ; **profil → « Se déconnecter » → confirmer, sans recharger** ; B (neuf) se connecte
par le formulaire dans le **même onglet** ; « Plus tard » sur Ma configuration ; B ouvre
15 écrans. La base du banc applique la RLS. Relevé de TEXTE (texte visible + `title`/
`aria-label`/`alt`) sur 387 chaînes propres à A ; contrôle d'abord que A les VOIT. Aussi :
localStorage après B (ni donnée ni identifiant de A), aucune écriture de B ne repousse une
donnée de A dans son compte, aucune erreur JS.
- **Vert sur 390/1512 × clair/sombre (96 contrôles).** Mutation `BANC_MUTATION=base-sans-rls`
  (la base sert A à tout le monde) ⇒ **10 écrans rouges** (Ma journée, Ventes, Achats, Messages,
  Argent, Favoris, Factures, Stock, Comptes, Vinted) : le banc voit une fuite.

## 2. Simuler une création de compte (Réglages, propriétaire seul)
- `src/simulationCompte.js` (JS pur) : 7 scénarios — Sneakers Solo tout bien · Lunettes Pro
  2 comptes · Vêtements + livres Solo, vente sur le 2e compte (hors offre) · sans extension ·
  extension d'un AUTRE compte VRM et sans e-mails · dressing pas encore lu, achat seulement ·
  panne de lecture des e-mails. Chacun joue : inscription (identifiant FICTIF `51000000-…`,
  aucun compte Supabase), **Ma configuration avec ses vraies règles** (`choixInitiaux`,
  `ecrituresEtape`, `appliquerEcritures`, `ecritureFin`), extension, e-mail « Reçu ✓ », dressing
  lu, première vente — les **vraies preuves** du parcours (`src/parcoursArrivee.js`), les mots
  (« paire »/« article »), Solo/Pro (`api/_lib/plan-regle.js`). Les lectures sont les MÊMES
  requêtes qu'App.jsx, servies par un mini PostgREST en mémoire.
- `src/SimulationCompte.jsx` + `src/simulation-compte.css` : « Lancer les 7 simulations »,
  « 7 sur 7 : comme prévu », une carte par scénario, six miniatures (le VRAI écran du parcours,
  réduit) avec ✓, ou ✗ en ambre et ce qui a accroché ; toucher agrandit. Entrée :
  `src/ecrans/Reglages.jsx`, `proprioInst && { id:'simulation-compte' … }` (2 lignes).
- Preuves : `scripts/audit-simulation-compte.cjs` (50 contrôles ; `fetch`, XHR, WebSocket,
  stockages et `sendBeacon` piégés ⇒ 0 appel ; requêtes = App.jsx au caractère près) et
  `--prouve` **6/6** ; banc `scripts/bancs/simulation-compte.cjs` (390/1512, clair/sombre :
  entrée chez le propriétaire seulement, 7 cartes conformes, miniatures, rien ne part vers le
  réseau ni le stockage pendant le clic, loupe, pas de débordement). Captures regardées.

## 3. « Comme un vrai client » après la mise en ligne
- `scripts/verif-prod.cjs` + `.github/workflows/verif-prod.yml` (après chaque push sur `main`,
  attend le déploiement de Vercel ; ou à la main). En iPhone et ordinateur : entre dans l'app,
  ouvre 17 écrans par la navigation de l'app, fait ≥ 5 gestes sans écriture (recherche, ouvrir
  une vente, filtre, menu du profil, notifications, calculette, retour), échoue sur erreur JS,
  garde-fou d'écran, app démontée, page blanche, `/assets/` en erreur.
  1. **Exemple** (« Découvrir avec des exemples ») : toujours joué, aucun secret, aucune requête
     vers la base (contrôlé).
  2. **Compte de démonstration** : seulement si les secrets existent ; vraie connexion.
- **Jamais d'écriture** : tout ce qui n'est pas une lecture est bloqué avant de partir, sauf la
  connexion (`/auth/v1/token`) et une liste de fonctions de LECTURE de la base ; service worker
  bloqué ; aucune déconnexion envoyée.
- Joué en local contre `dist/` (exemple, 390 et 1512) : vert, 0 écriture bloquée.

## Gestes de Julien
1. **Créer le compte de démonstration** : sur https://vrm.center, « Essayer gratuitement » avec
   une adresse à toi réservée à ça (ex. `demo@` ton domaine), un mot de passe long ; confirmer
   l'e-mail ; **ne rien relier** (ni Vinted, ni e-mails, ni extension) ; fermer « Ma
   configuration » par « Plus tard ». Ce compte reste vide : le contrôle n'écrit jamais rien.
2. **Poser deux secrets GitHub** : dépôt → Settings → Secrets and variables → Actions → « New
   repository secret » : `VRM_DEMO_EMAIL` (l'adresse) et `VRM_DEMO_MOT_DE_PASSE`. Sans eux, le
   contrôle joue seulement l'exemple et l'écrit en avertissement.
3. Rien d'autre (aucune migration, aucune extension).
