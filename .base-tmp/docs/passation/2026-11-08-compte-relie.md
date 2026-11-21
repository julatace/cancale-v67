# 8 nov. — « shop_x est relié à VRM » : le moment d'un nouveau compte

Julien : « Quand de nouveaux comptes sont liés, je veux des notifications, des
animations, un accompagnement. » Relier un compte (Vinted, Leboncoin, Vestiaire,
eBay) était silencieux : la ligne apparaissait dans Comptes liés, rien d'autre.

Branche `claude/compte-relie`. Extension **inchangée** (aucune version à installer).

## 1. Comment un compte apparaît aujourd'hui (mesuré dans le code, lecture seule)

| plateforme | où il naît | son identité | qui l'écrit |
|---|---|---|---|
| Vinted | table `vinted_accounts` (une ligne par `owner, vinted_user_id`) | `vinted_user_id` (chiffres) | l'extension (`supabaseUpsert('vinted_accounts', …)`, background.js ~l.1419), dès qu'elle voit les cookies d'un compte ; **directement en base**, aucune route serveur n'est appelée |
| Vinted (retiré) | `vrm_blocked_accounts.uids` | même uid | l'app (« Supprimer ») ; l'app retire ces comptes de la liste |
| Vinted (données) | `harvest_{uid}_listings`, `_orders_sold`, `_orders_purchased`, `_billing`, `_releve_{mois}`, `_profile` (+ `meta->>capturedAt`, `meta->>nItems`) | uid dans l'id | l'extension (`orders_*` aussi par `api/compte.js?mode=commandes` depuis la 5.326) |
| Vinted (état) | `panel_comptes_etat.comptes[uid]` (banni/actif) | uid | l'extension |
| Leboncoin | `lbc_accounts.accounts` (`id`, `name`, `seenAt`, `sessionAt`) | id du compte (`lbc-account:8442…` = `8442…`) | l'extension |
| Vestiaire | `vc_session` (`id`, `at`, `comptes{id: date}`) | id du compte ; une capture sans compte = « non identifié » (pas d'identité ⇒ jamais accueilli) | l'extension |
| eBay | `ebay_comptes.comptes` (`principal`, `cle`, `pseudo`) | `principal` ou la clé de 16 hex | la route eBay (connexion OAuth) |
| appareils | `ext_appareil_{id}` (5.327) | un navigateur, pas un compte | l'extension |
| app | `vrm_comptes_lies` (localStorage) | — | mémo de préchargement de CET appareil, jamais une décision |

**Ce qui prouve qu'un compte est NOUVEAU pour CE vendeur** : son identité (ci-dessus)
absente de SA ligne `vrm_comptes_relies` alors que la plateforme y a déjà un point de
départ. Jamais un pseudo (§5).

## 2. La règle — `src/compteRelie.js` (pure, importée par l'app ET le serveur, §11)

Ligne `vrm_comptes_relies` (synchronisée, au nom du vendeur, comparer-et-échanger sur `rev`) :
`{ v, bases: { vinted: ms, … }, connus: { 'vinted:222': { at, base?, accueilli?, notifie?, nom? } } }`.

- **Point de départ par plateforme**, posé par l'APP sur une lecture RÉUSSIE de ses
  comptes : les comptes déjà là sont `base` (jamais accueillis, jamais notifiés —
  Julien ne reçoit pas neuf feuilles le jour du déploiement). Une plateforme « pas su »
  n'en reçoit pas. Exception : un vendeur inscrit depuis < 48 h (`user.created_at`) —
  ses comptes déjà là sont accueillis (il vient de les relier).
- Une identité jamais vue ensuite = **nouvelle**. On n'oublie jamais une identité : un
  compte supprimé puis relié n'est pas « nouveau ».
- **Le serveur ne pose jamais de point de départ** (`sansBase`) : ligne absente ⇒ il ne
  fait rien.
- **Une fois** : la feuille ne paraît qu'une fois `accueilli` ÉCRIT ; la notification ne
  part qu'une fois `notifie` ÉCRIT (réservé avant l'envoi : trois appels simultanés ⇒
  une notification).
- **Première lecture** (Vinted) : 4 étapes (annonces · ventes · achats · porte-monnaie),
  chacune `lu` (ligne captée ; « 12 annonces lues » si `nItems` est écrit, sinon « Lu »),
  `en-cours`, `pas-su` (lecture ratée). Après 3 min sans rien, le geste : « Ouvre une
  fois Mes commandes › Ventes sur vinted.fr ». Autres plateformes : une étape (la date
  de lecture que montre Comptes liés).

## 3. L'app — `src/CompteRelie.jsx` (+ `src/styles-compte-relie.css`)

Monté par la coque (`AccueilComptesReliesParesseux`, chargé à la demande), seulement
quand : comptes lus, nuage prêt, base joignable, en ligne, pas en mode exemple, session ;
jamais pendant Bienvenue ni la visite ; jamais sous l'écran d'ouverture (`#vrm-demarrage`).
Relit à chaque changement de la liste des comptes (déjà relue par la coque : signal de
l'extension, retour au premier plan, toutes les 2 min).

La feuille (SheetShell, portail, `FermeAuRetour`) : avatar (photo de profil captée sinon
l'initiale) qui entre avec un léger ressort, pastille bleue cochée qui se dessine (le
seul accent), titre « shop_x est relié à VRM », les étapes qui arrivent l'une après
l'autre et se cochent sur preuve (relues toutes les 8 s tant que tout n'est pas lu), puis
trois choix : **Nom court** (`vinted_account_labels`), **Dans tes totaux et ton bilan**
(Vinted : `vinted_accounts_hidden` ; autres : `vrm_comptes_exclus`), **Numéros** (la règle
rappelée : « Ses annonces sans N° en reçoivent un, à la suite. Aucun N° déjà écrit sur un
carton ne change » — ou « Tu numérotes toi-même » si le réglage est allumé ; rien n'est
renuméroté). « Voir ses ventes » / « Fermer ». Plusieurs comptes ⇒ une feuille, une carte
chacun. Mouvement réduit ⇒ aucune animation.

Rattrapable : Paramètres → Comptes liés → « Revoir l'accueil des comptes reliés ».

## 4. La notification — `api/_lib/compte-relie.js`

Famille neuve **« Nouveau compte relié »** (`comptes`, catégorie `compte`, allumée par
défaut, réglable dans Paramètres → Notifications, groupe « Comptes » ; aperçu tiré du vrai
texte). « 🔗 shop_x est relié à VRM · Compte Vinted · la première lecture commence ».
Rangée dans la cloche (`sendPushToAll` : heures calmes, regroupement, abonnement).
Deux chemins, **aucune nouvelle fonction** (12) :
- `api/push.js` action `comptes` : l'app l'appelle quand ELLE voit un compte neuf ; le
  corps ne dit rien, la route relit tout au nom du vendeur de la session ;
- `api/ship-reminders.js` (matin et soir) : le filet quand aucune app n'est ouverte.

⚠️ **Signal qui manque côté extension** : l'extension écrit `vinted_accounts` directement
en base, sans appeler de route. Tant qu'aucune app VRM n'est ouverte, le serveur ne voit
un compte neuf qu'au cron suivant (matin/soir). Pour une notification immédiate, il
faudrait que l'extension appelle `/api/push` `{action:'comptes'}` après sa première
écriture d'un compte (chantier extension, non fait ici : la carte du logo est en cours
ailleurs).

## 5. Preuves

- Banc `scripts/bancs/compte-relie.cjs` (base inventée, `src/exempleBase.js`) : S1-S6
  serveur (la vraie route `api/push.js` exécutée : une notification, rangée dans la cloche,
  rien au second appel, une seule sur 3 appels simultanés, rien sans mémoire, rien famille
  coupée), A (390/1512 × clair/sombre : feuille au premier plan, nombres servis, « En
  cours » sans nombre, ventes servies ensuite ⇒ cochées sans recharger, `accueilli` écrit,
  serveur prévenu une fois, second chargement sans feuille, « Revoir »), B (deux comptes,
  une feuille), C (geste après 10 min, mouvement réduit ⇒ aucune animation), D (aucune
  mémoire ⇒ point de départ, aucune feuille), E (mémoire en 503 ⇒ rien écrit, rien montré).
- Branche : **105 verts, 0 rouge**. Sur origin/main (7acdfc36, banc copié dans l'arbre
  d'avant) : **25 rouges au moins** (aucune feuille ; la route ne connaît pas `comptes`).
  Mutation `aAccueillir` qui ignore `accueilli` : **5 rouges** (la feuille revient au
  second chargement, « Revoir » ne rouvre plus seul le compte relié).
- Captures regardées (390/1512, clair/sombre, mouvement réduit) : la feuille attend la
  fin de l'écran d'ouverture (`#vrm-demarrage`, sinon elle passait dessous) ;
  l'interrupteur allumé était blanc sur blanc en sombre — corrigé.
- Audits verts : variables, tdz, icones, boutons, violet, coherence, fonctions-api,
  identite, notifications (8 familles), compte-pas-relu, bilan-semaine, notifs-centre.

## Geste de Julien
Aucun. (Optionnel : dire si la famille « Nouveau compte relié » doit rester allumée par défaut.)
