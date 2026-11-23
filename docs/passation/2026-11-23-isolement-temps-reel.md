# 23 nov. — Isolement entre vendeurs et colis en temps réel (`claude/isolement-23nov`)

Demande de Julien : « regarde bien que tout peut marcher pour CHAQUE utilisateur : tous les codes de retrait,
tous les colis de chaque utilisateur doivent être mis à jour en temps réel ; aucune erreur » — puis « aucune
donnée entre utilisateurs ne peut se croiser » (priorité absolue).

## ÉTAT À LA REPRISE
- Branche `claude/isolement-23nov` : une correction (bordereau reçu par e-mail ⇒ relu sans changer d'écran) +
  deux contrôles dans `scripts/audit-retraits-parfaits.cjs` (F7, F8, deux mutations). Voir la PR.
- Aucune écriture en vraie base. Aucune réparation de données nécessaire (rien de mal rangé trouvé).

## 1. Mesures en vraie base (lecture seule, 23 nov. ~10 h 30 UTC)
- **8 vendeurs** (owners) + le propriétaire NEUTRE `00000000-…`. Un seul (le compte de Julien) reçoit des
  e-mails et capte en continu ; 3 autres ont capté une fois (oct.–17 nov.), 4 n'ont qu'une coque (`main`,
  `vrm_vu`, `restore_*`) — aucun e-mail, aucun colis : rien à mettre à jour chez eux.
- E-mails du compte actif, 48 h : 116 rangés (`email_reception_*`, 114 « intégré », 2 « à vérifier »),
  délai e-mail envoyé → ligne rangée : **médiane 35 s, 95 % sous 65 s, pire 9 min** (`sourceDate` → `receivedAt`).
- Quarantaine (owner neutre) : 7 e-mails non attribuables (adresse de réception inconnue), le plus récent le
  22 nov. — conservés, réclamables, jamais donnés à un vendeur au hasard (§5).
- Captures de l'extension : dernière capture 23 nov. 07 h 33 UTC ; points relais / bordereaux captés 22 nov.
- Journaux Supabase 24 h : **aucun 5xx**, aucune erreur Postgres de l'app ; 401 = jetons expirés (normal) ;
  404 sur `rpc/vrm_equipe_lister` (migration 016 pas appliquée, attendu) et `rpc/vrm_commandes_lire`
  (migration 042 pas appliquée : la route a sa voie d'avant). Vercel : aucune erreur d'exécution sur 48 h.

## 2. Isolement — prouvé en vraie base (lecture seule)
- Chaque table de `public` a la RLS ; les politiques permissives sont `owner = auth.uid()` ; les
  `abonnement_requis*` sont RESTRICTIVES (elles ne peuvent qu'enlever). 27 tables sans politique = fermées
  au navigateur (clé de service seulement). Schéma `sauvegarde` : aucun droit pour `anon`/`authenticated`.
- **Essai réel par vendeur** (transaction, `set local role authenticated` + `request.jwt.claims` de CHAQUE
  vendeur, comptes seulement) : pour les 8, lignes d'un AUTRE vendeur visibles = **0** dans `app_data`,
  `vinted_accounts`, `vrm_agent_commandes`, `abonnements`, `storage.objects`.
- Fonctions SECURITY DEFINER exposées (31) : toutes partent de `auth.uid()` (accompagnement, communauté :
  partages consentis par conception) ; aucune n'est exécutable par `anon`.
- Temps réel : diffusion PRIVÉE `vrm-lignes:<owner>` (déclencheur `vrm_signal_ligne`), politique
  `realtime.messages` = le sujet de SON uid seulement ; le message ne porte que l'id et des dates ; l'app
  rejette tout message dont `owner` n'est pas le sien (`src/tempsReel.js`).
- Stockage : 2 seaux privés ; `detourage` lisible seulement dans le dossier `{uid}/` ; `sauvegardes` aucune
  politique (serveur seul).
- Appareil : copie IndexedDB clé + valeur par uid, effacée à la déconnexion et au changement de vendeur
  (`effacerCopies`) ; au changement de vendeur `wipeLocalData` efface QR, bordereaux, photos hors ligne ;
  le service worker ne met JAMAIS `/api/` ni Supabase en cache.
- Routes `api/` : `scripts/audit-cloisonnement.cjs` (chaque mode de chaque route, trois vendeurs inventés,
  canaris, usurpation, jeton forgé) — résultat dans la PR.

## 3. La chaîne « temps réel » (comment un colis arrive à l'écran)
1. E-mail → `api/email-inbound.js` (adresse de RÉCEPTION ⇒ vendeur) → lignes `email_reception_*`,
   `email_track_*` (suivi, code de retrait), `email_bord_*` (bordereau) …
2. Extension → ses lignes `harvest_*`, `panel_colis_relais` (codes lus dans les conversations).
3. Toute écriture dans `app_data` ⇒ déclencheur `vrm_signal_ligne` ⇒ diffusion privée au vendeur (< 1 s),
   plus le sondage de secours (25 s, 2 min quand Realtime a prouvé qu'il marche), onglet visible.
4. La veille (`src/tempsReel.js`) traduit l'id en famille : `colis` (email_track) ⇒ suivis relus,
   `retrait` ⇒ codes relus, `emails` ⇒ « Actualiser » dans la boîte, ventes/achats/annonces…
- **Trou trouvé et corrigé** : `email_bord_*` (bordereau reçu par e-mail = un colis à envoyer) n'était dans
  aucune famille : Colis / Ventes / Ma journée ne le montraient qu'en changeant d'écran. Désormais famille
  `bordereaux` ⇒ `fetchEmailBordereaux` (scalaires) relu tout de suite, ou une fois au retour d'un écran caché.
  Contrôles F7/F8 de `audit-retraits-parfaits.cjs` : rouges sur `origin/main`, verts ici, deux mutations.

## 4. Ce qui reste
- Migrations 016 (équipe) et 042 (écritures atomiques) : gestes de Julien, inchangés.
- 7 e-mails en quarantaine : à réclamer par leur vendeur s'il en reconnaît un (rien à faire côté code).
