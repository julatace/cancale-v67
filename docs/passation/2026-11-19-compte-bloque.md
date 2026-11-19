# 19 nov. 2026 — « Vinted a bloqué {compte} » : la question, la pause, la remise (lot compte-bloque, ext. 5.409)

Branche `claude/compte-bloque` (partie de `claude/project-review-nsk5su`). Pas de PR, pas de fusion.

## La demande

Julien, 19 nov., mot pour mot : « Est-ce que tu peux faire en sorte que l'extension détecte les comptes bloqués stp, je
veux que ça demande pour mettre en suspens les annonces et que ça les remette si jamais le compte est débloqué. Tu captes
ou pas ». Avant (`2026-11-19-demandes-julien.md` §D) : « je dois recevoir une animation ou un message de VRM quand je suis
bloqué, avec un questionnaire sur quoi faire : est-ce que je garde les annonces en ligne ou pas… ». Un de ses comptes est
bloqué en ce moment.

## Mesuré sur sa base AVANT de coder (lecture seule, aucune donnée réelle ici — des nombres)

- `panel_comptes_etat` : 11 comptes, **9 « actif », 2 « banni »**, tous avec la preuve `champ profil is_account_banned`
  (le verdict de `noterEtatCompte`, ext. 5.181). Les deux bannis sont des comptes encore liés (`vinted_accounts`).
- `harvest_*_profile` (projection des scalaires seulement) : le profil `/api/v2/users/current` porte
  `is_account_banned` (booléen) et `account_status` ; **4 profils `true`** (2 anciens, de juillet et août, statut 8 ;
  2 de ce mois, statut 0 — `account_status` ne suffit donc PAS, seul `is_account_banned` départage), **9 `false`**
  (statut 0). Vinted RÉPOND `/users/current` à un compte banni : un profil daté d'aujourd'hui l'est.
  Autres champs présents (formes) : `account_ban_date` (null ou texte), `action_restriction` (null partout),
  `restricted_by_terms`, `soft_restricted_by_terms`, `is_on_holiday`, `is_deleted`.
- `moderation_vinted_*` : **0 ligne** — son extension en service est antérieure à la 5.350 (`guetterDressing`) ;
  la notification de modération n'est jamais partie chez lui.
- `harvest_{uid}_listings` : `meta->>nItems` rempli pour 10 comptes ; un banni a 3 annonces lues aujourd'hui, l'autre
  aucune ligne d'annonces (le banc sert les deux cas : « ses 3 annonces » / « ses annonces »).

⇒ La DÉTECTION existait déjà et elle est prouvée : `is_account_banned === true` ⇒ « banni » ; `false` ⇒ « actif » ;
absent ou illisible ⇒ « pas su », qui ne remplace jamais un verdict lu. Un 401 / 403 / 429 n'arrive jamais là (le
profil n'est pas rendu, et un corps de refus Vinted est écarté par `estErreurVinted` avant). Rien n'a été déduit d'une
absence ni d'un 403 : le 403 reste la pause d'aujourd'hui (`vrmPauseVinted`, `poserPrudence`).

## Ce qui est livré

### Extension (5.409.0 — version partagée, manifeste NON monté, zip NON régénéré)
- `noterEtatCompte` garde `depuis` : l'heure où l'état a CHANGÉ (un épisode de blocage) ; inchangé tant que l'état
  ne change pas ; un « passu » ne touche à rien.
- Au passage bloqué ⇔ actif : la mémoire de la pause est oubliée (relue tout de suite) et
  `/api/push {action:'comptebloque'}` est appelé (corps vide : le serveur relit tout) ; marque locale
  `vrmCompteBloqueASignaler` rejouée à chaque visite tant que l'envoi n'a pas abouti (3 jours max, le cron est le filet).
- `pauseCompteBloqueDit(uid)` (capacité `comptebloque`) : lit `main.vrm_comptes_bloques` (projeté) et
  `panel_comptes_etat` (projeté), 2 min en mémoire `vrmPauseBloque` ; base muette ⇒ le dernier lu ; jamais lu ⇒ pas
  de pause. En pause (bloqué PROUVÉ et SON choix « pause » pour ce blocage) : `garde` (gestes automatiques),
  `gardeStricte` quand c'est une série (`sorte` ou mode ≠ clic) et `secuGeste` Vinted mode ≠ clic refusent
  `code: 'compte-bloque'` avec la phrase. Couvre offres auto, refus auto, baisses (programmées, en série),
  favoris en série, republication (étapes « suite »), relances. Un CLIC passe. Leboncoin, eBay, Vestiaire ne passent
  jamais par là. Aucune garde retirée ; le 50/h et la réserve de 5 inchangés.
- La règle est le bloc `<compte-bloque-regle>` de `src/compteBloque.js`, recopié tel quel
  (`node scripts/audit-compte-bloque.cjs --recopie`).
- **À faire par celui qui publie la 5.409** : monter `manifest.json`, `CODE_VERSION`, `EXT_ATTENDUE`, régénérer
  les zips. D'ici là `audit-coherence` dit, à raison, « seuil 5.409.0 atteignable — manifeste 5.408.0 » (vérifié :
  avec le manifeste et `CODE_VERSION` en 5.409, seul reste le contrôle `EXT_ATTENDUE`, qui suit le même geste).

### App
- `src/compteBloque.js` : la règle pure (phases `passu · question · pause · garder · plus_tard · remis · normal`,
  épisode, « plus tard » qui revient après 24 h, « OK » qui clôt sans effacer ; ensembles en pause / bloqués ;
  la notification une fois par blocage / remise).
- `src/compteBloqueEtat.js` : les deux lectures partagées (état lu par `lireEtatsComptes`, choix par `load`),
  relues au montage, au retour sur l'onglet, sur « etatcompte » de l'extension, au retour du nuage, toutes les 5 min.
- `src/CompteBloque.jsx` (+ `styles-compte-bloque.css`, jetons `--n-*` du natif avec repli — `src/natif/` n'existe
  pas sur cette branche) : sur la COQUE, au-dessus de tous les écrans, une carte par compte :
  « Annonce de VRM · Vinted a bloqué {compte} · Mettre ses N annonces en pause ? » + la phrase de ce que ça fait +
  « Lu dans son profil Vinted le … » ; **Oui, en pause** (le seul plein) / **Garder** / **Plus tard**.
  Débloqué après « Oui » : « {compte} est débloqué : N annonces remises » + **OK**. Entrée glissée 240 ms
  (mouvement réduit respecté). Ambre, jamais rouge. Écrit SEULEMENT sur son toucher (`vrm_comptes_bloques`, SYNC_KEYS).
- En pause : `annBase` (Annonces) et `liveStats` (« en ligne » de la coque, Ma journée) écartent ses annonces ; une
  ligne neutre « N annonces en pause · compte bloqué ({compte}) » sur Annonces (`data-annonces-en-pause`). Ses ventes
  restent dans TOUS les totaux (une vente faite est de l'argent gagné). Rien supprimé, aucun N° changé.
- Débloqué (profil relu `false`) : la pause tombe d'elle-même (la règle exige « banni »), ses annonces reviennent,
  les gestes automatiques repartent selon ses réglages d'avant — VRM n'en a changé AUCUN. Aucun geste côté Vinted
  n'est nécessaire (VRM n'a rien masqué chez Vinted) : rien n'est envoyé à Vinted à la remise.
- Alertes tues tant que le compte est bloqué : « n'envoie aucun e-mail » (`useEtatEmailsComptes` : bloqués dans
  `exclus`) ; « lecture ancienne » l'était déjà (`ligneFraicheur` : « banni par Vinted », sans geste).
- La carte « Vinted a fermé le compte » de `AlerteModeration` et sa notification (`moderation-notif`) laissent la
  sorte « banni » à ce lot : une seule annonce, une seule notification par blocage.
- Textes par `tr()` (`src/i18n/langues/{fr,en,es,it,de}/compteBloque.js`). Ligne « Quoi de neuf » `compte-bloque`.

### Serveur (aucune nouvelle fonction : 12 au plus)
- `api/_lib/compte-bloque-notif.js`, action `comptebloque` d'`api/push.js`, et le cron du matin / soir
  (`api/ship-reminders.js`, filet — et le seul chemin pour une extension d'avant la 5.409, qui range déjà
  l'état du profil). Lit `panel_comptes_etat` et `main` en projection, `vinted_accounts`, moins les comptes retirés ;
  réserve `vrm_compte_bloque_notifie` (comparer-et-échanger sur `rev`) AVANT l'envoi ; famille « Vinted : annonce
  cachée ou compte limité » ; lecture ratée ⇒ 503. « ⛔ Vinted a bloqué X · Mettre ses annonces en pause ? Réponds
  dans VRM. » / « ✅ X est débloqué · N annonces remises dans VRM. »

## Preuves
- `node scripts/audit-compte-bloque.cjs` : **52 verts** — R (règle, 18), C (copie), E (le VRAI background.js dans
  `scripts/_fond-vm.cjs`, réponses Vinted inventées de la vraie forme : bloqué, débloqué, 403 seul — au frein, à la
  capture et au profil —, champ absent, profil illisible, pause sur `garde` / `secuGeste` / `gardeStricte`, clic
  qui passe, autres sites, « garder », base muette), S (la route `/api/push` exécutée : une fois, trois appels en
  même temps ⇒ une, débloqué ⇒ « 4 annonces remises », compte retiré ⇒ rien, 503).
- `--mutation` : **17/17 rouges** (7 de la règle, 9 du fond dont « refus 403 = banni », « absence = banni »,
  « pas su = en pause », « clic bloqué aussi », et le background.js d'avant ⇒ E rouge).
- Banc `scripts/bancs/compte-bloque.cjs` (390 tactile et 1512, clair et sombre, base inventée) : **82 verts** — la carte
  VUE après l'écran d'ouverture (rien par-dessus), « Vinted a bloqué shop_cancale · Mettre ses 3 annonces en pause ? »,
  un seul plein, cibles 44, aucun débordement ni texte coupé, aucun rouge, contraste ≥ 4,5:1 (5,2 clair, 5,9 sombre),
  « Oui » range le choix (épisode, 3) ; débloqué ⇒ « 3 annonces remises », « OK » clôt ; 503 ⇒ rien ; Annonces : « 3
  annonces en pause · compte bloqué (shop_cancale) », ses annonces hors liste, l'autre compte reste ; « Garder » ⇒ rien.
  Captures regardées. Vu sur la capture 390 de « remis » : le bas de la carte paraît voilé par la couche de Ma journée
  (le bouton reste au-dessus, contrôle `elementFromPoint` vert) — à surveiller quand la coque natif arrive.
- `npm run build`, `audit-traduction` (45), `audit-tdz`, `audit-variables`, `audit-quoi-de-neuf`,
  `audit-fonctions-api`, `audit-alerte-moderation` (65), `audit-moteur-offres`, `audit-frein-vinted`,
  `audit-securite-comptes`, `audit-cloisonnement`, `audit-cle-service`, `audit-fusion` : verts.
  `audit-coherence` : le seul rouge est le seuil 5.409 contre le manifeste 5.408 (ci-dessus).

## Ce qui reste
- Publier la 5.409 (manifeste, `CODE_VERSION`, `EXT_ATTENDUE`, zips) avec les autres lots de cette version.
- Changer d'avis après « Garder » ou « Oui » pendant le blocage : pas d'écran pour ça aujourd'hui (la question
  revient seulement après « Plus tard » ou à un nouveau blocage).
- « Supprimer tout sur ce compte sauf ventes et achats » (§D, option 2) : PAS fait — refusé tant qu'il ne le
  redemande pas (suppression : §3, sauvegarde + annulation exigées).
- Ligne CLAUDE.md §9 et §8 (`comptebloque` · `pauseCompteBloqueDit` · 5.409.0) : l'orchestrateur s'en charge.
