# Historique — communaute-equipe

> Texte déplacé TEL QUEL depuis `CLAUDE.md` le 31 octobre 2026 (allègement du dossier : 1,36 Mo → moins de 60 Ko).
> Rien n'a été réécrit : les paragraphes gardent leur ordre d'origine. Le classement par thème est automatique (mots du titre) — en cas de doute, chercher par `grep` dans tous les `docs/passation/historique-*.md`.

> **30 octobre — Discord créait un second compte, et la voix de la démo :** mesuré (lecture seule) : « Se connecter avec
> Discord » a créé le compte `99457424…` (vide, une ligne `main`) — l'email Discord n'est pas celui de son compte VRM, et le
> « Discord relié » de Mon compte ne rangeait qu'un PSEUDO (`vrm_discord`), pas une méthode de connexion. Corrigé : Mon compte
> → Comptes associés propose aussi « Connecter Discord » (liaison d'identité Supabase, `preparerLiaisonOAuth`) ; un compte
> que Supabase vient de créer par Discord/Google sans email (`compteOAuthNeuf`, < 10 min) passe par `PorteNouveauOAuth` :
> « nouveau compte » ou « j'ai déjà un compte » ⇒ suppression du compte vide par la route « Fermer mon compte », confirmée ;
> « Identity is already linked » est traduit (`erreurRetourOAuth`). Banc `discord-nouveau-compte.cjs` (rouge sur l'avant).
> Voix de la démo : plus la première voix française venue (la « compacte », robotique) — classement naturelle/neuronale ›
> améliorée/premium › Google ; aucune voix de qualité ⇒ pas de bouton (`bienvenue.cjs` : 4 rouges sur l'avant).
> ⚠️ Non mesuré : que « Manual linking » soit activé dans Supabase (sinon l'écran le dit). **Gestes de Julien** : supprimer le
> compte vide (se connecter avec Discord ⇒ « J'ai déjà un compte VRM »), puis email ⇒ Mon compte ⇒ « Connecter Discord ».

> **30 octobre (suite) — le Discord de la carte était le MÊME que celui de la connexion :** mesuré, `vrm.center`
> (id Discord 1562201720438788168) est le pseudo VÉRIFIÉ de `vrm_discord` sur son compte (relié le 22 oct. pour la
> carte) ET l'identité du compte vide créé à 10 h 55 (email Discord vrm.vinted35@gmail.com ≠ shopcancale35@…).
> `GET /api/compte?mode=discord-deja` (session) : l'identifiant Discord du compte neuf (ou son pseudo, unique chez
> Discord) comparé aux `vrm_discord` vérifiés d'AUTRES comptes ⇒ l'email MASQUÉ de ce compte, rien d'autre ; pas su ⇒
> rien. `PorteNouveauOAuth` dit alors « Ce Discord est déjà sur ton compte VRM sh•••@gmail.com — seulement pour la
> carte » et met « Supprimer ce compte vide et revenir au mien » en geste principal. Banc `discord-nouveau-compte.cjs`
> (+3 par taille). ⚠️ Non mesuré : le vrai Discord. Geste de Julien inchangé (supprimer le vide, puis « Connecter Discord »).

### Le mode équipe : migration 016 (fonction n°37, 16-17 octobre) — PAS APPLIQUÉE ; écran livré le 17 ; corrigée et essayée sur la vraie base le 22 (voir plus bas)
Retenue le 11 octobre : le vendeur invite un aide qui voit les colis à expédier
et à retirer, les codes de retrait, imprime les bordereaux — et RIEN d'autre.
**Livré le 16 : la migration prouvée. Le 17 : la route, les écrans et leur banc**
(section « L'écran du mode équipe » ci-dessous).
Fichier : `supabase/migrations/016-equipe.sql` (la 015 est réservée à l'horloge
de l'agent eBay).
- **Une table** `vrm_equipe` (vendeur, email, membre, rôle `colis`, statut
  `invitee | actif | revoquee`, dates), lue et écrite par **personne** en direct
  (RLS forcé, aucune règle, tous droits retirés — même à `service_role`) ; tout
  passe par des fonctions `SECURITY DEFINER`, `search_path` vide, qui prennent
  l'identité dans le jeton : `vrm_equipe_inviter(email)`, `_accepter(id)`,
  `_revoquer(id)` (le vendeur, ou le membre qui QUITTE), `_lister()`,
  `_colis(vendeur)`, et `_effacer(owner)` (serveur seul). Empreinte de forme
  (une table d'une autre forme fait tout refuser). 5 invitations vivantes au plus.
- **L'acceptation exige une adresse CONFIRMÉE** (`auth.users.email_confirmed_at`)
  égale à celle de l'invitation — une identité. Sans ça, quelqu'un créerait un
  compte à l'adresse invitée.
- **Lecture : une liste blanche d'`id`** (`vrm_equipe_id_permis`, ancrée) :
  `email_bord_{tx}` (le PDF porte l'adresse de l'acheteur : c'est ce qu'on colle
  sur le carton), `harvest_{uid}_label_{tx|latest}` (+ leur `meta`, même ligne),
  `panel_colis_relais`, `email_track_{transporteur}_{n}`. Rien d'autre : ni
  `main`, ni `orders_*` (prix), ni `txn_*`, `billing`, `releve_*`, `inbox`,
  `conv_*`, `email_sale|final|offer|invoice|achat|inconnu|quarantaine_*`,
  `ebay_*`, et **aucune** règle sur `vinted_accounts` (jetons).
- **Les ventes à expédier / achats à retirer passent par une PROJECTION**
  (`vrm_equipe_colis`) : `transaction_id, item_id, title, status,
  transaction_user_status, date, photo` (l'adresse), le login des comptes, les
  clés de `vinted_ship_done` / `vinted_pickup_done` — **aucun montant, aucun
  acheteur, aucun jeton**. Liste LARGE (sans finalisé/annulé/remboursé/
  completed) : la règle « à expédier » reste `aExpedier` dans l'app (§11).
- ⚠️⚠️ **LA DEMANDE EXPLICITE (en-tête `x-vrm-equipe: <vendeur>`)**. L'app lit
  ses lignes SANS filtre de propriétaire (`id=like.email_bord_*`) : si un membre
  qui est aussi vendeur voyait d'office les colis de l'autre, ses propres écrans
  les mêleraient aux siens. Les lignes du vendeur ne sont donc visibles que dans
  une requête qui porte l'en-tête (PostgREST l'expose dans `request.headers`,
  déjà lu en production par `noter_ecriture`) ET si l'appelant en est membre
  actif. Sans en-tête : rien ne change pour personne.
- **Aucune écriture du membre PAR RLS.** « Coché posté » n'est pas indispensable :
  Vinted sort le colis d'« à expédier » dès le scan au relais. ⚠️ Mais la 016 met
  en service UNE écriture du membre, hors RLS : l'écran Organisation
  (`/api/compte?mode=operations`) réécrit `vrm_operations_v1` du vendeur avec la
  clé de service — voir « Revue du 22-23 octobre » plus bas.
- **L'abonnement est celui du VENDEUR** : `vrm_equipe_actif` exige
  `vrm_acces_pour(vendeur)`. Seul objet existant modifié : la restrictive
  `abonnement_requis` d'`app_data` (`… or owner = (select
  vrm_equipe_vendeur())`) — un aide ne paie pas. Texte d'avant dans le fichier
  (retour arrière). `with check` inchangé ; `vinted_accounts` inchangée.
- **Preuves** : `scripts/audit-equipe-sql.cjs` (Postgres 16 jetable, socle
  `agent-sql/supabase-min.sql` + 005-007 + 013 tels quels, `auth.users` complété
  de `email`/`email_confirmed_at`) — **106 contrôles verts** : le membre lit
  EXACTEMENT les 5 lignes de colis ; ni `main`, ni prix, ni jetons, ni l'autre
  vendeur ; sans en-tête il ne voit que SES lignes ; la projection ne porte
  aucun de `42.00`, `price`, `tokJ`, `buyPrice`, l'acheteur ; il n'écrit rien
  (UPDATE/DELETE 0 ligne, INSERT refusé, table et `_effacer` refusées) ; un
  membre d'un autre vendeur, une invitation non acceptée, une adresse non
  confirmée, une invitation révoquée (ou quittée), un vendeur qui ne paie plus ⇒
  rien ; le vendeur et le serveur voient comme avant ; l'essai annulé ne laisse
  rien ; `--verifier` rend ok, et ok = false sur 10 gardes touchées (droit de
  table, de colonne, RLS non forcé, règle sur la table, fonction INVOKER, corps
  changé, `anon` exécutant, restrictive revenue, règle d'écriture ajoutée,
  forme). `--prouve` : **16 mutations sur 16 au rouge**.
  Pas de « rouge sur le code d'avant » : la migration est neuve, ce sont les
  mutations qui prouvent.
- **Essai annulé / vérification** : `node scripts/equipe-sql/essai-annule.cjs >
  essai.sql` (~15 Ko, ROLLBACK), puis après application `… --verifier`.
- **Non mesuré** : jamais appliquée ; `postgres` doit pouvoir lire
  `auth.users.email`/`email_confirmed_at` en production (la migration le vérifie
  à l'installation et refuse sinon) ; l'en-tête `x-vrm-equipe` dans
  `request.headers` de SA PostgREST (forme `noter_ecriture`, pas essayé) ; banc
  sur Postgres 16, production en 17.6.
- **Gestes de Julien** : (1) Supabase → Authentication : **confirmation d'email
  obligatoire** (sinon l'adresse « confirmée » ne prouve rien) ; (2) lancer
  l'essai annulé (`essai.sql`) dans l'outil SQL, lire la ligne `essai` ; (3)
  appliquer la 016 VRM fermé ; (4) `--verifier` ⇒ `ok: true`. Rien ne change
  pour personne tant qu'aucune invitation n'est acceptée (l'écran, sans la 016,
  dit « le mode équipe n'est pas encore activé sur ta base »).

#### L'écran du mode équipe (17 octobre)
- **Route** : `api/compte.js?mode=equipe` (logique `api/_lib/equipe.js`, toujours
  **12 fonctions**). GET → `rpc/vrm_equipe_lister` + `aBoutique` (a-t-il au moins
  un compte Vinted à lui, lu avec SON jeton) ; POST `{action: inviter | accepter
  | revoquer | quitter}`. Tout part avec le **jeton de l'appelant**, jamais la clé
  de service. Trois états : 200 · **503 `non-installe`** (fonction absente,
  PGRST202 ⇒ « Le mode équipe n'est pas encore activé sur ta base. », jamais une
  erreur brute ni une équipe vide) · **503 `pas-su`** · 400/409 refus réel dit en
  clair (adresse invalide, la sienne, plafond de 5, adresse pas confirmée…).
  ⚠️ **Aucun email d'invitation n'est envoyé** (pas de SMTP) : le panneau le dit,
  le vendeur prévient la personne.
- **Fermer mon compte** appelle `vrm_equipe_effacer` (clé de service, `sbCle`)
  APRÈS les compteurs et AVANT les photos : base sans la 016 ⇒ 0, rien à effacer ;
  base muette ⇒ fermeture INCOMPLÈTE, dite, compte de connexion gardé.
- **Réglages → Mon compte → Équipe** (`EquipeSetting`) : ce qu'un membre voit et
  ne voit pas (`CE_QUE_VOIT_UN_MEMBRE`, une phrase pour le panneau et
  l'invitation, §11), inviter par email, la liste (membre / invitée), « Retirer »
  (confirmé) ; côté invité : « Accepter », et « Tu prépares les colis de X —
  Ouvrir ses colis · Quitter ».
- **L'aiguillage** (`PorteEquipe`, dans `App`, **AVANT `PorteAbonnement`** : un aide
  ne paie pas, c'est l'abonnement du VENDEUR que la base vérifie) :
  · l'appareil a choisi l'écran d'un vendeur (`vrm_equipe_vue_{uid}`) ⇒ ses colis ;
  · jamais choisi + **aucune boutique à lui** (lu, pas supposé) ⇒ l'équipe, ou ses
    invitations à accepter ;
  · sinon ⇒ sa propre app, exactement comme avant. **Un vendeur qui est aussi
    membre garde sa propre app** et ouvre l'équipe sur son clic ; « Ma propre
    boutique » le ramène.
  · Choisi mais plus membre (révoqué / quitté) ⇒ « Tu n'as plus accès », rien de
    la boutique du vendeur. Base sans la 016 ⇒ la phrase prévue.
  · ⚠️ La liste est mise en cache sur l'appareil (`vrm_equipe_cache_{uid}`) : seule
    la TOUTE PREMIÈRE ouverture sur un appareil attend la réponse (2,5 s au plus)
    — sans ça un aide voyait d'abord une boutique vide et ses écrans lisaient
    ses lignes pour rien (vu au banc : `txn`, `billing`, `main`…). Ensuite, aucune
    attente pour personne. `AppCoeur` ne monte toujours qu'avec une session.
- **`ColisEquipe`** : chaque lecture porte `x-vrm-equipe: <vendeur>` ET
  `owner=eq.<vendeur>` ; la liste des ventes/achats vient de `rpc/vrm_equipe_colis`
  (aucun montant) ; « à expédier » = `aExpedier` de l'app moins les coches
  « posté » ; « à retirer » = `isAtRelayStatus` / `needs_action` moins les
  « retirés », avec le code (`panel_colis_relais`, `codeRetrait`) et le QR ;
  les codes reçus par email (`email_track_*`, disponibles, ≤ 14 j). Impression :
  `lirePdfLigne(row, '', {'x-vrm-equipe'})` (nouveau 3ᵉ paramètre), tamponnée du
  N° que porte la ligne `email_bord_*` — le membre ne lit jamais `main`, il ne
  recalcule aucun numéro (un bordereau capté sans email part avec le titre seul).
  Trois états : chargement · pas su (une ligne, « Réessayer ») · non installé ·
  plus d'accès (projection `null`) · lu ; une lecture partielle est dite une fois.
  `lecturesPartagees` met `x-vrm-equipe` dans sa clé.
- **Preuves** : banc `scripts/bancs/equipe.cjs` (port 5011, `BANC_PORT`), faux
  PostgREST qui applique la règle de la 016 (liste blanche, en-tête, adhésion
  active, aucune règle sur `vinted_accounts`), faux GoTrue, le VRAI
  `api/compte.js` exécuté, 390 et 1512 px — **76 contrôles** : l'aide arrive sur
  les colis (pas de porte d'abonnement), ne voit que la vente à poster (ni la
  finalisée, ni celle cochée « posté »), le code de retrait, AUCUN montant ;
  aucune requête de son navigateur vers `main`, `vinted_accounts`, `_txn_`,
  `_billing`, `orders_*`, `email_sale_*` ; chaque lecture porte l'en-tête ET
  `owner=eq.` ; l'impression lit le PDF avec l'en-tête et ouvre le bordereau ;
  invitation retirée ⇒ plus rien ; base sans la 016 ⇒ la phrase (écran et
  Réglages) ; le vendeur garde son app (aucune requête avec l'en-tête), invite et
  retire ; accepter d'un clic ouvre les colis ; une vendeuse-membre garde SA
  boutique, ouvre celle de V sur son clic, sans mélange. **35 rouges sur le build
  d'avant** (ed52842, §6.1) ; mutation « lecture sans `x-vrm-equipe` » ⇒ 8
  rouges. `audit-fermer-compte.cjs` : +3 contrôles (équipe effacée chez lui seul,
  base sans la 016, base muette ⇒ incomplet).
- **Non mesuré** : que la passerelle de Supabase laisse passer l'en-tête
  personnalisé `x-vrm-equipe` depuis le navigateur (CORS : le greffon Kong
  renvoie par défaut les en-têtes demandés — non vérifié, supabase.co est bloqué
  d'ici) ; si elle le refusait, l'écran dirait « pas pu lire » (jamais « aucun
  colis ») et la lecture devrait passer par la route. Le thème sombre n'est pas
  appliqué sur l'écran d'équipe (monté hors d'`AppCoeur`).
- **Gestes de Julien** (en plus de ceux de la migration) : rien d'autre. Une fois
  la 016 appliquée : Réglages → Mon compte → Équipe → inviter l'adresse de son
  aide, la prévenir ; elle crée son compte VRM avec cette adresse, la confirme, et
  arrive directement sur « Colis à préparer ».

#### 22 octobre : la 016 retouchée pour la 021, essai annulé sur la vraie base — sûre à appliquer
**Mesuré (lecture seule, 22 oct.)** : `list_migrations` porte 005-008, **014** (12 oct.), 017, **018** (20 oct.,
deux morceaux), 019, 020 ; la **013** est en place (27 corps de fonctions identiques au fichier, md5) ; la **021**
aussi (ses politiques sont là, appliquée hors `list_migrations`) ; 014 (28 corps), 017, 018-020 (22 corps) : tous
identiques au fichier. **Seule la 016 manque** (aucune table, aucune fonction `vrm_equipe_*` : d'où les 404 de
`rpc/vrm_equipe_lister`). La passation du 21 (« 014, 016, 018 non appliquées ») était fausse pour 014 et 018.
- ⚠️⚠️ **Le défaut, trouvé en relisant la 016 contre le schéma actuel** : la 021 a posé, AVANT la 016, la
  restrictive `vrm_lecture_privee` (SELECT, `owner = auth.uid()`, sans la clause de l'équipe puisque ses
  fonctions n'existaient pas). Une restrictive s'ajoute (ET) : la 016 d'avant, appliquée telle quelle, aurait
  installé un mode équipe **mort** — l'aide lit 0 ligne (rejoué sur Postgres jetable dans l'ordre de la
  production). Corrigé : §11 bis pose sur `vrm_lecture_privee` l'expression que la 021 prévoit elle-même (§11,
  mot pour mot, `alter policy`, aucun DROP) ; §11 ter **refuse toute la migration** si une autre restrictive de
  lecture ignore l'équipe (`vrm_equipe_lecture_bloquee`) ; `--verifier` exige la clause sur `vrm_lecture_privee`
  quand elle existe (`regles`) et aucune restrictive bloquante (`restrictives_bloquantes`).
- **Isolation** (relue) : `abonnement_requis` ne s'ouvre que pour `owner = vrm_equipe_vendeur()` (membre ACTIF
  d'un vendeur dont l'accès est ouvert, DEMANDÉ par l'en-tête) ; aucune écriture du membre PAR RLS
  (restrictives d'écriture de la 021, permissives `owner = auth.uid()`) — mais la 016 met en service le
  parcours membre d'Organisation, hors RLS (puce suivante) ; `vinted_accounts` n'est pas
  touchée ; la vérification de séparation de `api/compte.js?mode=confidentialite` n'envoie pas l'en-tête (rien ne
  change pour elle).
- ⚠️ **Revue du 22-23 octobre — ce que la 016 OUVRE en plus, hors RLS** (le premier jet disait « les écritures
  restent fermées » et « la migration ne change rien pour operations.js » : faux). **Mesuré** (la vraie route
  `api/_lib/operations.js`, fetch simulé, données inventées) : sans la 016, `rpc/vrm_equipe_lister` répond 404 et
  un membre qui poste `mission.etat` chez le vendeur reçoit 403, 0 écriture ; avec la 016 (`membre_de`,
  `acces === true`), la route **lit et réécrit la ligne `vrm_operations_v1` DU VENDEUR avec la clé de service**
  (`PATCH …owner=eq.<vendeur>&id=eq.vrm_operations_v1`). ⇒ **Appliquer la 016 met en service le parcours membre
  d'Organisation** (`/api/compte?mode=operations`). Bornes, tenues par `src/operations/metier.js` et vérifiées :
  `mission.etat` et `mission.etape` seulement, sur SES missions (attribution = son invitation), jamais valider
  (en_cours, terminee, bloquee) ; `mission.creer`, `reservation.creer`, la mission d'un autre aide, un vendeur à
  l'accès fermé ou dont il n'est pas membre ⇒ refusés, 0 écriture ; il ne LIT que SES missions (ni réservations,
  ni montants). **Décidé** : rien à changer dans le SQL ni dans la route (bornée, pas une fuite) ; l'en-tête de la
  016 et ce dossier le disent (commentaires seuls : l'essai annulé et l'essai de production produisent le même
  texte qu'avant, md5 `eeb6e4fe…` et `69f80fe9…` — l'essai déjà joué sur la vraie base vaut toujours ; `audit-equipe-sql`
  144 verts). **Prouvé** : `scripts/audit-equipe-ecriture-membre.cjs` (16 contrôles, sans
  Postgres) — rouge sur 15dbcb3 (l'en-tête et la section ne nommaient pas ce chemin) ; `--prouve` : 6/6 mutations
  au rouge (en-tête d'avant, section sans le chemin, membre qui crée, qui touche la mission d'un autre, qui
  valide, accès fermé ignoré). **Non mesuré** : la route contre la vraie base (aucune écriture en production).
- **Essai annulé sur la vraie base** (`scripts/equipe-sql/essai-production.cjs`, UN appel `execute_sql`, BEGIN →
  migration → contrôles par rôle joués comme PostgREST → ROLLBACK ; aide, vendeur et adresse non confirmée
  INVENTÉS dans la transaction) : propriétaire 7 840/7 840 lignes avant et après (avec l'en-tête aussi) ; un autre
  vendeur réel 21 siennes, **0** du propriétaire, même en le demandant ; l'aide **577** lignes = exactement la liste
  blanche (même empreinte), 0 sans en-tête, 0 de `main`/ventes/transactions/porte-monnaie/eBay, 0 compte Vinted,
  le PDF lisible, 0 modifiée/effacée, création refusée (42501) ; projection : 36 ventes, 50 achats, clés
  `date, photo, status, title, transaction_id, transaction_user_status, uid`, **aucune clé d'argent** ; inventaire
  des clés des 577 lignes : aucune clé d'argent (le seul « € » du texte est le pied légal d'un email Chronopost) ;
  adresse non confirmée refusée ; révocation : 0 tout de suite ; plans d'index inchangés (+1 à 2 ms sur un
  balayage de 7 840 lignes) ; `--verifier` ok, empreinte 948f… identique en 17.6. Verrou de table **660 ms**
  (essai entier 1 s). Relu ensuite : ni table, ni fonction, ni règle, ni compte inventé.
- Preuves : `audit-equipe-sql.cjs` **144 contrôles** (021 puis 016, 016 puis 021, restrictive inconnue, l'essai de
  production rejoué et ne laissant rien) ; **6 rouges** sur la 016 d'origin/main (dont « l'aide lit [] ») ;
  `--prouve` **19/19** mutations (dont `sans-lecture-021`, `sans-garde-restrictive`, `verifier-restrictives`).
- **Appliquer** : le fichier tel quel (comme 019/020, par `apply_migration` ou l'éditeur SQL), VRM peu sollicité
  (verrou exclusif bref sur `app_data`). Puis `node scripts/equipe-sql/essai-annule.cjs --verifier` ⇒ `ok: true`.
- **Non mesuré** : l'en-tête `x-vrm-equipe` à travers la passerelle de Supabase depuis un navigateur (CORS) ; la
  confirmation d'email obligatoire du projet (geste de Julien, voir plus haut).


### La carte de la communauté : migration 018 (20 octobre) — ✅ APPLIQUÉE le 20 octobre (vérifié le 22)
Julien : « un onglet avec une carte où les utilisateurs de VRM peuvent mettre
leur emplacement quand on est connecté, pour s'écrire si on est dans la même
ville ; un vrai jeu interactif ». Gestion → Autres outils → **Communauté**
(`?tab=communaute`, `src/communaute/Communaute.jsx`, chargé au clic).
- **Décisions (ne pas rediscuter)** : opt-in strict (invisible par défaut,
  « Me retirer de la carte » SUPPRIME la ligne) ; jamais une position exacte —
  une VILLE choisie, rangée arrondie à **0,05° (≈ 5 km)** ; « Me localiser »
  PROPOSE la ville la plus proche, rien n'est rangé avant sa confirmation (la
  position du téléphone n'est jamais envoyée à la base) ; des autres : un
  pseudo (défaut `vrm_prenom`, sinon « Revendeur »), une ville, un pays — jamais
  l'email, jamais l'identifiant du compte (un `pid` public tiré au hasard),
  jamais un compte Vinted ; messages seulement entre personnes VISIBLES,
  1–500 caractères, **20/h et 5 nouvelles conversations/jour** ; texte brut
  (React échappe, aucun lien rendu) ; Bloquer (ses messages sont rangés
  « masqués » : il ne le sait pas, et il disparaît de la carte de celui qui
  bloque) ; Signaler (rangé avec un extrait de ses 5 derniers messages,
  lisible par le PROPRIÉTAIRE seul : `vrm_communaute_signalements()`, pas
  d'écran) ; rien d'IA, rien de payant ; abonnement = `vrm_acces_pour` (qui ne
  paie plus ne voit plus, n'écrit plus, n'est plus montré).
- **Le ludique, honnête** : épingles regroupées au zoom (le nombre de personnes,
  `grouperParPixels`), la sienne en accent avec un pouls (coupé par « réduire
  les animations »), « près de toi » (≤ 30 km), « N autres à {ville} »,
  🥇 premier de sa ville (le plus ancien inscrit de la ville), « 👋 Coucou » en
  un geste. Tout vient de la liste lue ; zéro inscrit ⇒ « Personne n'est encore
  sur la carte — sois le premier », aucun chiffre, aucune épingle.
- **Base** : `supabase/migrations/018-communaute.sql`, modèle de la 016 — cinq
  tables (`vrm_communaute_profils`, `_conversations`, `_messages`, `_blocages`,
  `_signalements`), RLS activé ET forcé, aucune règle, tous droits retirés (aux
  deux séquences aussi), EMPREINTE de forme ; dix fonctions SECURITY DEFINER,
  `search_path` vide, identité dans le jeton. La contrainte refuse toute
  coordonnée non arrondie (même écrite par le propriétaire de la table).
  Aucune table existante n'est touchée. « Fermer mon compte » appelle
  `vrm_communaute_effacer` (clé de service) entre l'équipe et les photos ; base
  sans la 018 ⇒ 0 ; muette ⇒ fermeture INCOMPLÈTE, dite.
- **Route** : `api/compte.js?mode=communaute` (`api/_lib/communaute.js`, toujours
  12 fonctions), au nom de l'appelant (jamais la clé de service) ; GET → carte +
  conversations ; POST `rejoindre · quitter · ecrire · fil · bloquer · signaler ·
  ville`. Trois états : 200 · 503 `non-installe` (« La carte de la communauté
  n'est pas encore activée sur ta base ») · 503 `pas-su` (« pas pu lire », jamais
  « personne ») · refus réel dit en clair. Le géocodage (`ville`) passe par
  Nominatim (OpenStreetMap, gratuit), session exigée, coordonnées arrondies
  côté serveur aussi.
- **Carte** : Leaflet **1.9.4** depuis cdnjs, chargé à l'ouverture de l'écran
  (jamais au démarrage), fond OpenFreeMap depuis le 21 oct. (voir « La carte sans clé d'API »). Injoignable ⇒ la même communauté en
  liste. Les épingles sont de vrais boutons (44 px) écoutés directement : le
  « clic » de Leaflet ne partait pas au doigt dans la coque zoomée à 80 %.
  Les feuilles (FermeAuRetour) et le toast vivent sur `<body>` (portail) : dans
  la coque, un `position:fixed` restait sous la barre du bas.
- **Preuves** : `scripts/audit-communaute-sql.cjs` (Postgres jetable, socle
  `agent-sql/supabase-min.sql` + 005-007) — **82 contrôles** ; `--prouve`
  **17/17 mutations** au rouge (lecture des messages d'autrui, position exacte
  rangée, sans arrondi, bloqué qui écrit, anon qui lit, retrait qui garde la
  ligne, identifiant de compte exposé, invisible qui écrit, plafonds, signalements
  lus par tous, droits de table, effacement incomplet, abonnement ignoré, bloqué
  encore visible, forme ignorée, vérification aveugle aux droits) ; l'essai
  annulé ne laisse rien ; `--verifier` voit 10 gardes touchées. Banc
  `scripts/bancs/communaute.cjs` (port `BANC_PORT`, deux personnes, faux
  PostgREST aux règles de la 018, le VRAI `api/compte.js`, Leaflet servi à la
  place de cdnjs — `BANC_LEAFLET_DIR`, sinon `npm pack leaflet@1.9.4` dans le
  dossier temporaire) — **42 contrôles**, **21 rouges** sur le build d'avant (§6.1) ;
  `BANC_MUTATION=bloque-ecrit` ⇒ 2 rouges, `opt-in` ⇒ 5 rouges.
  `audit-fermer-compte.cjs` +3 (effacée chez lui seul, base sans la 018, muette).
  `verif_visuel` et `verif_dark` rendent l'écran.
- **Non mesuré** : la 018 n'a jamais tourné sur sa vraie base (Postgres 16 au
  banc, 17.6 en production) ; Nominatim depuis Vercel (politique d'usage : un
  appel par recherche, pas de cache) ; un vrai Leaflet au doigt sur un vrai
  téléphone ; aucun écran de modération (le propriétaire lit les signalements par
  `select public.vrm_communaute_signalements();` sous sa session, ou la table
  dans l'outil SQL) ; aucune notification d'un nouveau message (relu toutes les
  30 s écran ouvert, 15 s fil ouvert).
- **Gestes de Julien** (rien ne change pour personne avant) : (1)
  `node scripts/communaute-sql/essai-annule.cjs > essai.sql`, coller dans
  l'outil SQL de Supabase, lire la ligne `essai` (`tables: 5, rls: true`) ;
  (2) appliquer `supabase/migrations/018-communaute.sql`, VRM fermé ;
  (3) `node scripts/communaute-sql/essai-annule.cjs --verifier`, coller, exiger
  `ok: true`. Ensuite : Gestion → Communauté → « Apparaître sur la carte ».


### Communauté : pseudo Discord et classement des ventes — migration 019 (20 octobre) — ✅ APPLIQUÉE LE 20 OCTOBRE
Julien : « pour la carte ça peut être le compte discord » et « un classement entre
tous les membres, sur les journées, les semaines, les mois ». Fichier
`supabase/migrations/019-communaute-discord-classement.sql`, **sur la 018 (en
production) sans la modifier** — deux colonnes sur `vrm_communaute_profils`
(`discord`, `classement`), mêmes gardes (RLS forcé, aucune règle, aucun droit,
SECURITY DEFINER `search_path` vide, identité par `auth.uid()`, empreinte AVANT —
celle de la 018 — et APRÈS). La 018 rejouée après la 019 est REFUSÉE (empreinte) :
voulu. **Elle ne contient aucune suppression** (l'outil SQL de Supabase demande
une confirmation pour ce mot) : elle se colle d'un bloc.
- **Discord** (`vrm_communaute_discord`) : facultatif, vide par défaut, retiré par
  un pseudo vide ; 2-32 caractères `[a-z0-9._]`, jamais « .. », ni @ < > (contrainte
  + fonction ; l'écran retire un « @ » de tête et met en minuscules). Montré aux
  membres visibles de la carte (`vrm_communaute_carte` remplacée, +`discord`).
  Aucun appel à Discord.
- **Classement** (`vrm_communaute_classement(p_periode)`, `jour|semaine|mois|annee`,
  Europe/Paris, semaine du lundi) : opt-in strict (`…_classement_inscrire`, il faut
  être sur la carte : pseudo et ville en viennent ; quitter la carte retire du
  classement ; y revenir ne réinscrit pas). **Le chiffre = le NOMBRE de ventes
  Vinted, jamais des euros**, COMPTÉ PAR LA BASE (la route n'envoie que la période,
  aucune fonction ne reçoit un nombre). **Règle mesurée le 20 oct. (lecture seule)**,
  celle de `ventesFaites` : `harvest_{uid}_orders_sold → payload.my_orders` des
  lignes du membre (owner = lui), comptes LIÉS à lui (`vinted_accounts.owner`) et pas
  masqués (`main.vinted_accounts_hidden`) ; statut qui ne matche pas
  annul|cancel|refus|rembours|retour|suspend|paiement échoué ; daté par `date` (ISO
  avec décalage, illisible ⇒ rien, `vrm_communaute_ts`, exécutée par personne) ;
  dédoublonné par `transaction_id` (mesuré : 554 lignes, 527 transactions — le même
  compte porté par deux propriétaires). Limites dites : Vinted seul (pas Leboncoin
  ni eBay), une vente n'existe qu'une fois captée. Rang `rank()` (ex aequo), top 100
  + soi, bloqués masqués, abonnement `vrm_acces_pour`. Rend rang, pid, pseudo,
  ville, pays, ventes — jamais l'identifiant du compte.
- **Fermer mon compte** : rien à ajouter, `vrm_communaute_effacer` (018) efface la
  ligne entière (colonnes comprises) — l'audit le vérifie.
- **Route** : `action: discord | inscrire | classement` (`api/_lib/communaute.js`),
  « pas encore activé » sur PGRST202. **Écran** : onglets Carte · Classement ;
  Discord sur sa présence et sous chaque personne (Copier) ; classement : « Tu es
  Xᵉ sur N », sa ligne mise en avant, zéro inscrit ⇒ « sois le premier », panne ⇒
  « pas pu lire le classement », sans la 019 ⇒ ni Discord ni classement.
- **Preuves** : `audit-communaute-sql.cjs` (section 019 : 137 contrôles en tout,
  `--prouve` **30/30** dont chiffre envoyé par le client, non-inscrit visible, vente
  annulée comptée, autre vendeur, compte non lié, compte masqué, sans dédoublonnage,
  fuseau UTC, Discord libre, effacement) ; `essai-annule.cjs` joue maintenant la
  019 (`--migration` répétable, vérification = 018 + 019, sans le mot interdit) ;
  banc `communaute.cjs` +019 (1512 clair, 390 tactile sombre).
- ✅ **Appliquée en production le 20 octobre** (sur son « ok on fait discord »), par
  l'outil (aucune suppression dedans). Vérifiée : 5 tables, RLS forcé, aucun droit
  direct, les 14 fonctions identiques au fichier (md5). La 018 avait été complétée
  juste avant : ses 3 fonctions qui contiennent le mot « delete » (quitter, bloquer,
  effacer) ont été collées par Julien dans l'outil SQL (l'outil de la session attend
  une confirmation humaine pour ce mot et expire).


### Communauté : les groupes à code (accompagnement) — migration 020 (20 octobre) — ✅ APPLIQUÉE LE 20 OCTOBRE
Julien : « pour le classement et la carte, un endroit où je peux mettre un code pour
que les membres d'un accompagnement puissent comparer leurs résultats ». Fichier
`supabase/migrations/020-communaute-groupes.sql`, sur la 019 (refusée sans elle,
empreinte d'avant), deux tables `vrm_communaute_groupes` (nom, code, créateur) et
`vrm_communaute_membres` (groupe, `pid`, `quitte_le`), mêmes gardes que la 018 (RLS
forcé, aucune règle ni droit, SECURITY DEFINER, empreinte des 7 tables). **Aucune
suppression dans le fichier** (pas même une clé étrangère « on delete ») : il se
colle d'un bloc, et l'outil de la session peut l'appliquer.
- **Le code** : 8 caractères de l'alphabet sans I, O, 0, 1 (32⁸), tiré par la base ;
  tapé avec tirets, espaces, minuscules, il est normalisé. Seul le créateur le change
  (l'ancien ne marche plus ; les membres restent). 5 groupes créés, 10 rejoints, 200
  membres au plus.
- **Une adhésion porte le `pid` public de la carte, jamais le compte** : quitter la
  carte (la ligne part) fait quitter tous ses groupes ; y revenir donne un nouveau
  `pid`, dans aucun groupe. « Fermer mon compte » : `vrm_communaute_effacer` (018)
  efface la ligne de la carte, ses adhésions ne se relient plus à rien (un `pid` au
  hasard, ni compte ni email) ; un groupe qu'il avait créé perd seulement son
  créateur. ⚠️ Le NOM d'un groupe reste (c'est le groupe des autres membres).
- **Entrer dans un groupe est un consentement dit avant** (« ses membres verront ton
  pseudo, ta ville et ton NOMBRE de ventes ») : le classement du groupe montre ses
  membres SANS l'opt-in du classement public (qui reste à part). Il faut être sur la
  carte. Blocages et abonnement : comme la carte.
- **Une règle de comptage** : `vrm_communaute_classement_calc(periode, groupe)`
  (aide interne, exécutée par personne) porte le comptage de la 019 mot pour mot ;
  `vrm_communaute_classement(text)` (public) et `vrm_communaute_classement_groupe`
  (membres seulement, sinon `erreur: 'groupe'`) l'appellent. `vrm_communaute_carte`
  rend en plus `groupes` (les miens : nom, code, créateur ?, `pid` des membres).
- **Route** : `action: groupe-creer | groupe-entrer | groupe-quitter | groupe-code`,
  et `classement` avec `groupe` (`api/_lib/communaute.js`) ; sans la 020 : « Les
  groupes ne sont pas encore activés sur ta base ». **Écran** (Carte et Classement) :
  bloc « Groupe d'accompagnement » (Entrer un code · Créer un groupe · choix « Tous
  les membres » / un groupe · code lisible ABCD-2345, Copier, Nouveau code pour le
  créateur, Quitter) ; le groupe choisi filtre la carte, ses chiffres et le
  classement. Base sans la 020 : aucun bloc (`carte.groupes` absent).
- **Preuves** : `audit-communaute-sql.cjs` section 020 (~60 contrôles ; 6 mutations
  rouges : non-membre qui lit, code changé par un autre, groupe qui compte tout le
  monde, membre parti compté, bloqué visible, groupes d'autrui) ; banc
  `communaute.cjs` partie 020 (1512 clair, 390 tactile sombre, et base sans la 020) ;
  mutation de l'écran « filtre de groupe retiré » ⇒ 4 rouges.
- **Pseudo unique** (même migration, demande du même jour) : index unique sur
  `lower(pseudo)` + `vrm_communaute_rejoindre` redéfinie (« pseudo-pris », 409) ;
  vide ⇒ « Revendeur-XXXX ». L'écran propose « Utiliser mon pseudo Discord ».
- ✅ **Appliquée en production le 20 octobre** (sur son « ok fait tout »), par l'outil.
  Vérifiée : 7 tables, RLS forcé, aucun droit direct, 22 fonctions identiques au
  fichier (md5), empreinte `c86baf95…`.
- **« Se connecter avec Discord »** (20 octobre, `api/_lib/discord.js`, toujours 12
  fonctions) : OAuth2 Discord, portée `identify` SEULE, aucun jeton Discord gardé.
  `POST ?mode=discord-debut` (session) rend l'adresse Discord + un nonce en cookie
  HttpOnly ; `GET ?mode=discord` (retour, adresse déclarée chez Discord :
  `https://vrm.center/api/compte?mode=discord`) vérifie le `state` signé ET le nonce
  (le lien ne marche que dans le navigateur qui l'a demandé, une fois — leçon eBay
  du 6 octobre), lit le pseudo, renvoie à l'app avec `#discord=…&preuve=…` ; l'app
  rend la preuve AVEC SA SESSION (`action: discord-verifie`) et la base range le
  pseudo (`vrm_communaute_discord`). Preuve liée au compte VRM et au pseudo, 15 min.
  Ancien compte « nom#1234 » ⇒ dit, jamais inventé. Sans `DISCORD_CLIENT_ID` /
  `DISCORD_CLIENT_SECRET` (Vercel, Production) : pas de bouton, la saisie à la main
  reste. Application Discord de Julien : identifiant `1562176038098702467` (public) ;
  ⚠️ son premier secret a été collé dans une conversation et RÉINITIALISÉ — le secret
  ne vit que sur Vercel. Preuves : `audit-discord-oauth.cjs` (14 ; mutations
  « sans nonce » 3 rouges, « sans preuve » 2) ; banc `communaute.cjs` (bouton, départ
  chez Discord, retour rangé, preuve d'un autre compte refusée, pas réglé ⇒ pas de
  bouton). Non mesuré : le vrai Discord (bloqué d'ici).


### Discord relié au COMPTE, depuis Mon compte, sans être sur la carte (20 octobre)
Julien : « connecter mon compte Discord à mon compte qui est déjà connecté ». Le
bouton n'existait que sur la présence de la carte, et `vrm_communaute_discord`
(019) refuse sans présence (« invisible »). **Aucune migration** :
- Le pseudo VÉRIFIÉ vit dans `app_data.vrm_discord` (`{v, discord, verifie, at}`),
  écrit par la route (`api/_lib/communaute.js`, actions `discord-compte` ·
  `discord-compte-verifie` · `discord-compte-retirer`) avec le JETON de l'appelant
  (RLS : owner = lui), seulement après la preuve signée (`lirePreuve`). ⚠️ RLS laisse
  aussi le navigateur écrire sa propre ligne : même confiance que la saisie à la main
  de la carte (permise) — la ligne ne sert qu'à lui. « Fermer mon compte » l'efface
  (lignes `app_data` du vendeur).
- Paramètres → Mon compte → **Discord** (`DiscordCompte`, trois états) : « Se
  connecter avec Discord » (si `DISCORD_CLIENT_*` réglés), « Retirer » (confirmé).
- Le `state` porte la destination SIGNÉE (`ts.owner.c.mac`, forme d'avant à trois
  morceaux = la carte) : le retour revient à `/?tab=settings&vue=compte#…&ou=compte`.
  La carte laisse un retour `ou=compte` à Mon compte. Erreurs : `src/communaute/discordErreurs.js` (§11).
- Déjà sur la carte : le pseudo vérifié y est posé aussi ; « Retirer » ne l'enlève de
  la carte que s'il est celui du compte. La vérification faite depuis la carte range
  aussi la ligne du compte. Sur la carte : « Afficher mon Discord relié » et
  « Utiliser mon pseudo Discord » le PROPOSENT (jamais posé tout seul).
- Preuves : banc `discord-compte.cjs` (`BANC_PORT`, 1512 + 390 tactile, le vrai
  `api/compte.js`, RLS simulé) 29 contrôles, ROUGE sur le build d'origin/main,
  vert après ; `lirePreuve` réaffaibli ⇒ 4 rouges. `audit-discord-oauth.cjs` +3
  (destination signée). `communaute.cjs` reste vert (137).
- Non mesuré : le vrai Discord ; l'écriture `app_data?on_conflict=owner,id` avec le
  jeton du vendeur sur SA base (forme de superpdp, mais jamais faite avec un jeton
  utilisateur ici).


### Carte de la communauté : « la ville ne rentre pas, la carte n'apparaît pas » (20 octobre)
Mesuré : **0 ligne** dans `vrm_communaute_profils` — personne n'avait pu rejoindre.
- **La ville** : le serveur ne demandait qu'à Nominatim (OpenStreetMap), qui refuse
  souvent les serveurs partagés (Vercel). Trois sources désormais (`geocoderVille`) :
  la **Base Adresse Nationale** (`api-adresse.data.gouv.fr`, communes de France),
  **Photon** (komoot, le reste du monde), puis Nominatim si les deux se taisent ;
  4 s chacune, User-Agent ASCII. Si le serveur ne joint rien, le **navigateur**
  interroge la BAN lui-même (un nom tapé, jamais une position). Les villes se
  proposent **pendant la frappe** (350 ms) ; toucher une ville la met dans le champ.
- **La carte** : Leaflet n'est plus chargé depuis cdnjs (un bloqueur, un réseau ou
  le relais privé d'iCloud l'empêchaient) : paquet npm `leaflet@1.9.4` (BSD-2),
  morceau à part chargé à l'ouverture de la carte. `invalidateSize` sur
  ResizeObserver (carte grise quand la boîte change de taille) ; fond OSM si les
  tuiles CARTO ne viennent pas ; sur téléphone la carte annule le zoom 80 % de la
  coque (`zoom:1.25`, Leaflet ne sait pas compter avec un zoom CSS parent).
- ⚠️ Non mesuré : les trois services de géocodage depuis Vercel (bloqués d'ici) ;
  la carte sur un vrai téléphone. Banc `communaute.cjs` : 129 contrôles (frappe,
  pseudo pris, Leaflet refusé ⇒ liste ; il coupe le service worker et marque le
  rechargement de `main.jsx` déjà fait pour ce cas).


### Discord sur téléphone, connexion refaite, accueil corrigé (21 octobre)
Julien : « sur téléphone on ne peut pas se connecter à Discord », « l'accueil est nul et l'onglet connexion », « créer son compte VRM avec Discord ».
- ⚠️⚠️ **Cause Discord** : sur iPhone, l'app d'écran d'accueil n'a pas les cookies de Safari, et l'app Discord renvoie le retour dans le navigateur par défaut ⇒ le nonce en cookie manquait toujours (« lien invalide »). Le `state` signé porte maintenant le ticket (`ts.owner.[cp].ticket.mac`, forme d'avant acceptée avec cookie). Même navigateur ⇒ comme avant. Autre navigateur ⇒ page « retourne dans VRM » (sans script, CSP stricte) et la preuve est rangée côté serveur (`app_data.discord_attente`, clé de service, owner = celui du state, empreinte sha256 du ticket) ; l'app qui a lancé la reprend (`POST mode=discord-attente {ticket}`, session, une fois, 15 min ; base muette ⇒ 503) au retour au premier plan (`src/communaute/discordAttente.js`, `ecouterDiscord` dans `AppCoeur`).
  ⚠️⚠️ **Fermé le 21 oct. (revue de sécurité)** : quelqu'un qui envoyait SON lien Discord à une autre personne récupérait le pseudo VÉRIFIÉ de celle-ci (l'app de l'expéditeur reprenait la preuve d'office). Dans l'autre navigateur la page montre maintenant un **code à 6 chiffres** (sans la preuve) ; `discord-attente` ne rend la preuve qu'avec lui (`requis` · `faux` 5 essais, chacun compté par comparer-et-échanger AVANT la réponse, non compté ⇒ 503 · `epuise` ⇒ ligne effacée) ; l'app le demande (`DemandeCodeDiscord`, sur la coque). Corrigé au passage : la reprise ne rechargeait pas quand seul le fragment changeait, et fermer la feuille (retour d'historique) annulait la navigation. `audit-discord-oauth.cjs` 32 contrôles (8 rouges sur l'avant ; mutations `sanssignature|sanspreuve|sansempreinte|sanscode|sanscompte` rouges) ; banc `discord-compte.cjs` 45 (8 rouges sur le build d'avant). ⚠️ Portée réelle : la saisie à la main d'un pseudo Discord reste permise sur la carte, et « vérifié » n'est montré à personne d'autre — ce défaut cassait la promesse de la vérification, pas une barrière visible.
- **Connexion** (`AuthScreen`) : marque sur l'ardoise (deux colonnes ≥ 900 px, en-tête sur téléphone), champs 50 px / 16 px (Safari ne zoome plus), liens 44 px, la phrase « Retrouve ta boutique » retirée (redite). Logique intacte.
- **Créer son compte avec Discord** : le bouton existe déjà (`OAUTH_PROVIDERS`, affiché seulement si Supabase l'active : `providerEnabled`) ; il dit « Créer mon compte avec Discord » en inscription. Le vérificateur PKCE est aussi gardé 10 min dans `localStorage` (retour dans un nouvel onglet). ⚠️ **Geste de Julien** : Supabase → Authentication → Providers → Discord : activer, coller l'identifiant de l'application Discord et son secret ; dans l'application Discord (OAuth2 → Redirects), ajouter `https://lgonxzrzjcqthjtbdpzo.supabase.co/auth/v1/callback`. Mesuré le 21 oct. : aucune identité Discord en base (4 comptes par email).
- **Accueil** : « VR / M » coupé dans la colonne VRM/Toi corrigé, plateformes en pastilles de couleur (plus de faux boutons), textes plus lisibles. `accueil.cjs` 171 verts.
- **Sécurité** : `Referrer-Policy`, `Permissions-Policy` (caméra, micro, position : le site seul ; paiement, USB… coupés), `Cross-Origin-Opener-Policy: same-origin-allow-popups`, HSTS. Conseillers Supabase : rien d'anormal (tables fermées et fonctions « ma donnée seulement » voulues). Erreurs de production : aucune depuis le 20 oct. midi.


### La carte de la communauté « plus professionnelle » (22 octobre) — branche `v22-carte`
Julien (21 oct.) : « une autre carte, beaucoup plus professionnelle, fiable et de
qualité ». Une session l'avait commencée (`claude/carte-pro`, b3fe852, « EN COURS,
non vérifié ») : Leaflet retiré (MapLibre seul), fond **VersaTiles** + secours
OpenFreeMap. Finie ici, après un VRAI merge de main (avatars Discord de main portés
sur les épingles MapLibre). Mesuré en production (lecture seule, 22 oct.) :
**1 inscrit** sur la carte (1 ville, pseudo Discord renseigné).
- **Tranché** : **OpenFreeMap seul**, VersaTiles retiré. Raisons : un seul domaine
  (`tiles.openfreemap.org` : style, TileJSON, tuiles, polices, icônes) — celui que
  la CSP de `claude/csp-app` prépare et que la politique de confidentialité nomme ;
  un second fournisseur = un second tiers qui voit l'IP de chaque vendeur, jamais
  mesuré depuis son téléphone. Le repli reste la LISTE (jamais une carte grise).
- **Le rendu pro** : styles SOBRES d'OpenFreeMap — `positron` (clair, gris, sans
  points d'intérêt) et `dark` (Dark Matter). `liberty` (couleurs OSM) est retiré :
  sur un fond presque sans couleur, l'accent PLEIN reste à SON épingle (§7 ;
  un liseré accent marque seulement « près de toi », et depuis la relecture les
  initiales des autres sont en encre neutre). **Noms en français** : `enFrancais` enveloppe chaque étiquette de NOM par
  `["coalesce", ["get","name:fr"], <expression d'origine>]` (« Allemagne », pas
  « Germany ») ; sans `name:fr`, le nom d'origine ; les numéros de route intacts.
  Ni rotation ni inclinaison, zoom 44 px, « Ma ville », attribution dépliée sur
  ordinateur ; sous 640 px elle est VISIBLE à l'ouverture et se replie en « i »
  au premier glisser (comportement de MapLibre, gardé — voir la relecture).
- **Quatre défauts de l'état laissé, VUS AU RENDU** (banc, 390 et 1512) :
  1. ⚠️ l'épingle ÉTAIT le marqueur MapLibre, qui se place par un `transform` en
     ligne : la `transition: transform .15s` de `.vrm-cm-pin` la faisait TRAÎNER
     derrière la carte (80 px au lieu de 120 sur un glisser), et à 390 px le
     toucher manquait l'épingle (coucou, message, blocage : 4 rouges en cascade).
     ⇒ un PORTEUR (`.vrm-cm-porteur`) est le marqueur, le bouton vit dedans ;
  2. l'attribution était DOUBLÉE (la mention ajoutée + celle de la TileJSON) ⇒
     `attributionManquante` n'ajoute que ce que les sources ne portent pas ;
  3. deux « i » empilés à 390 px : la règle générale des boutons de `.vrm-main`
     (`min-height: 44px !important`) étirait le `<summary>` de MapLibre et son
     image se répétait ;
  4. sa propre épingle n'était plus en accent : la règle `.profil` de main (avatars)
     la repeignait en blanc (vrai aussi sur main).
  Et le fond tombait en liste sur UNE tuile en erreur (500) : `poserFond` ne
  déclare « dessiné » qu'après une tuile ARRIVÉE ; une tuile isolée en erreur ne
  fait pas tomber la carte ; une source (TileJSON) injoignable si ; une police ou
  une icône manquante non ; AUCUNE tuile arrivée ⇒ délai (12 s) ⇒ liste (une
  tuile LENTE la faisait encore tomber : corrigé par la relecture, ci-dessous).
- **Politique de confidentialité** : elle nommait encore **CARTO** (retiré le
  21 oct.) — la ligne dit OpenFreeMap (IP + zone affichée, aucun compte, aucun
  cookie, lieu « non précisé par le service ») et le géocodage de la communauté
  (BAN, Photon, Nominatim, par le serveur ; BAN depuis le navigateur en repli).
  Date au 22 oct. ⚠️ Ce remplacement avait retiré la déclaration du géocodage
  de l'écran ACHATS (relecture, ci-dessous) : remise.
- **Le banc sert la VRAIE forme** (§6.3) : les vrais styles `positron`/`dark`
  (`hyperknot/openfreemap-styles` @ 6e53612), une TileJSON qui déclare toutes les
  couches et porte l'attribution exacte du README, de vraies tuiles OpenMapTiles
  (Natural Earth : eau, frontières, villes et pays avec `name:fr`), de vrais
  glyphes Noto Sans (`protomaps/basemaps-assets` @ 028c18f, « Bold » servi par
  « Medium »), une planche d'icônes valide mais vide. ⚠️ Avec une TileJSON qui ne
  déclarait que 3 couches, MapLibre criait « Source layer … does not exist » —
  une erreur que le vrai service ne produit pas : corrigé dans le banc.
  Téléchargés une fois par `curl` dans `os.tmpdir()/vrm-carte-banc-v2`.
- **Preuves** : `scripts/bancs/communaute.cjs` (port `BANC_PORT`) **168 verts** ;
  **16 rouges** sur l'état laissé (b3fe852 + main, build de la copie) ; **15
  rouges** sur origin/main 4afdcda ; 4 mutations de l'app posées ensemble
  (bouton = marqueur, accent retiré, « i » sans correctif, une tuile qui tue) ⇒
  **10 rouges**, chacune attrapée par SON contrôle. `scripts/audit-fond-carte.cjs`
  (exécute `src/fondCarte.js` : vrais styles évalués par
  `@maplibre/maplibre-gl-style-spec`, fausse carte aux évènements de MapLibre) :
  **15 rouges** sur l'état laissé, **15** sur main, vert après, `--prouve` **7/7
  mutations** attrapées. Les 4 combinaisons 1512/390 × clair/sombre regardées.
- **CSP** (pour `claude/csp-app`) : la carte ne demande que
  `https://tiles.openfreemap.org` (`connect-src` : style, TileJSON, tuiles, polices,
  icônes) ; le worker MapLibre est servi par VRM. ⚠️ Les avatars de main viennent
  de `https://cdn.discordapp.com` (`img-src`) — pas de ce chantier, à ne pas oublier.
- **Non mesuré** : la vraie instance depuis son téléphone (bloquée d'ici) ; que les
  tuiles réelles portent `name:fr` (absent ⇒ le nom d'origine, aucune régression) ;
  le rendu de Dark Matter sur de vraies données ; WebGL sur un vrai iPhone ; la
  mini-carte des points relais (injoignable, pas de banc ; `interactive: false` et
  `compact: true` : son attribution reste dépliée, jamais repliée).

#### Relecture adverse du 22 octobre (soir) — quatre défauts reproduits, corrigés
Chacun REPRODUIT d'abord (copie `git archive` de 87df182 compilée, contrôles lancés
depuis la copie, §6.1), corrigé, rouge sur 87df182, vert après, rouge sous mutation.
- ⚠️ **Une tuile LENTE faisait tomber en liste une carte qui dessinait déjà.**
  MapLibre (6.11.2) n'émet `idle` qu'une fois TOUTES les tuiles visibles chargées
  ET la carte immobile ; le délai de 12 s de `poserFond` rejetait sans regarder si
  des tuiles étaient arrivées. Reproduit au banc : une tuile tenue sans réponse,
  3 servies ⇒ à ~11 s `data-cm-fond="charge"` et AUCUNE attribution, à 18 s la
  liste (« La carte n'a pas pu se charger »). Même défaut sur main (déjà là
  avant), mais l'en-tête de `fondCarte.js` et ce dossier affirmaient le contraire.
  Même effet attendu sur un réseau lent ou si la personne glisse la carte pendant
  le chargement (pas d'`idle` pendant un mouvement) — non mesuré.
  ⇒ « dessiné » = une tuile ARRIVÉE puis la carte REPEINTE (`render`), sans
  attendre `idle` ni les autres tuiles ; au délai, une tuile arrivée (onglet en
  arrière-plan : pas de repeinte) ⇒ dessiné, aucune ⇒ liste ; une repeinte sans
  aucune tuile ne compte pas. L'attribution est donc posée dès que la carte
  dessine.
- ⚠️ **La politique ne déclarait plus le géocodage de l'écran ACHATS.** À chaque
  ouverture d'Achats, le NAVIGATEUR envoie l'adresse de chaque point relais à la
  Base Adresse Nationale puis à Nominatim (`geocode`, `useEffect` sur `tracking`)
  — reproduit : 8 requêtes pour 4 points (colis inventés). L'ancienne ligne
  « Nominatim, CARTO … points relais » le couvrait ; la nouvelle ne parlait que de
  la communauté, « envoyé par le serveur ». ⇒ une ligne « Base Adresse Nationale,
  Nominatim — placer sur la carte les points relais (écran Achats) — adresse du
  point relais, envoyée par ton navigateur ». Et, trouvés par le contrôle écrit
  pour ça, deux autres envois du navigateur jamais déclarés : les **photos de
  profil Discord** de la carte (`cdn.discordapp.com`, une ligne) et **jsDelivr**
  (pdf.js des aperçus de bordereaux, onnxruntime du Studio photo — adresse IP
  seulement, une ligne). ⇒ `scripts/audit-politique-hotes.cjs` : TOUTE adresse
  `https://` du CODE de `src/` (commentaires retirés) est dans une liste FERMÉE
  (« politique » · « lien » · « vrm » · « éteint ») ; un hôte contacté tout seul
  par le navigateur exige une ligne qui nomme le service, dit À QUOI il sert ici
  et QUI l'envoie (juger le seul nom serait vert sur le défaut : Nominatim restait
  nommé) ; un couple (fichier, hôte) inconnu ⇒ rouge. **5 rouges sur 87df182**,
  `--prouve` 5/5. ⚠️ Turnstile (`challenges.cloudflare.com`) reste « éteint » :
  la politique devra citer Cloudflare le jour où la clé est posée.
- **L'attribution à 390 px était annoncée « repliée en « i » » : FAUX** —
  MapLibre ajoute `maplibregl-compact-show` sous 640 px et ne replie qu'au premier
  glisser. Tranché : on GARDE ce comportement (une mention vue à l'ouverture est le
  choix sûr pour la licence) ; ce qui l'annonçait est corrigé (en-tête du
  composant, ce dossier). Le banc juge maintenant ce qui est vrai : texte visible à
  l'ouverture, replié derrière le « i » après un glisser AU DOIGT (événements tactiles
  CDP). Le comportement n'a pas changé (vert aussi sur 87df182 — c'est un défaut
  d'annonce) ; rouge sous la mutation « repliée d'office » (`display:none
  !important` sur le texte).
- **Les initiales des AUTRES étaient en accent** (règle `.profil` de main) : avec
  50 vendeurs l'accent n'aurait plus rien de rare (§7). ⇒ `.profil:not(.moi)` en
  encre neutre ; l'accent plein reste à SA propre épingle.
- **Banc** `scripts/bancs/communaute.cjs` : **175 verts** (scènes « tuile lente »,
  « attribution 390 », couleur des épingles à 1512 sombre et 390 clair) ; **5
  rouges sur 87df182** (2 couleurs, 3 tuile lente) ; 3 mutations de l'app posées
  ensemble (délai qui rejette + repeinte ignorée · règle `:not(.moi)` retirée ·
  attribution repliée d'office) ⇒ **6 rouges**, chacune par SON contrôle.
  ⚠️ Un rouge intermittent sous charge (« un coucou : le message part » ×4 en
  cascade) venait du BANC : il attendait « un toast » quelconque, et celui de
  l'arrivée sur la carte (3,5 s) était encore là ⇒ il lisait la base avant
  l'envoi. Il attend maintenant le toast du coucou. `audit-fond-carte.cjs`
  `--prouve` **10/10** (3 mutations de plus : délai qui rejette malgré des tuiles,
  repeinte ignorée, repeinte sans tuile = dessiné) ; **2 rouges sur 87df182**.
  Les 138 audits non SQL : 0 rouge.
- **Non mesuré** : un vrai réseau mobile lent ; la vraie instance OpenFreeMap.
