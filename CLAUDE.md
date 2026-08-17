# Shop Cancale35 / Cancale Shoes Store — Brief complet pour Claude Code

Ce fichier est un **dossier de passation** pour Claude Code. Il résume tout ce qui a été fait, comment le projet fonctionne, où sont les pièges, et ce qui reste à faire. Placer ce fichier à la racine du dépôt local (`CLAUDE.md`) : Claude Code le lit automatiquement au démarrage dans ce dossier.

Le projet a été développé jusqu'ici via **Cowork** (une session Claude sans accès direct à GitHub — édition en local puis upload manuel via l'interface web de GitHub). Claude Code, lui, tourne en local sur la machine de l'utilisateur et a un accès normal au terminal : git, GitHub (via `gh` ou SSH), et la CLI Vercel. L'objectif de ce document est que Claude Code puisse reprendre le projet sans repasser par toute cette histoire.

---

## 1. Contexte métier

Julien (le propriétaire) revend des sneakers d'occasion sur Vinted sous le nom **"Shop Cancale35"**. L'application "Cancale Shoes Store" est son outil de gestion interne :
- suivi du catalogue de paires en stock,
- suivi des ventes et de la rentabilité,
- génération de factures,
- visualisation physique du "garage" (l'endroit où les paires sont rangées, représenté comme une étagère de boîtes),
- suivi de ce qui est en ligne sur Vinted,
- et maintenant, connexion directe à l'API interne de Vinted pour voir achats/ventes/messages sans repasser par les emails.

Il gère tout seul, n'est pas développeur, et pilote le projet uniquement via des sessions Claude successives (d'où l'importance de ce document).

---

## 2. Architecture technique

- **Frontend** : React (Vite), un **unique fichier** `src/App.jsx` d'environ **3550 lignes / ~650 Ko**. Tout est dedans : composants, styles inline, logique métier, données d'amorçage. Pas de découpage en plusieurs fichiers/composants séparés.
- **Dépôt GitHub** : `julatace/cancale-v67`, branche `main`. Propriétaire du compte GitHub : `julatace` (= Julien).
- **Déploiement** : Vercel, projet `cancale-v67`, team `shopcancale35-7638s-projects` (team ID `team_bhqBIM90w8Awkmhb2KFgOJ6Y`, project ID `prj_WRNJam11Oc61TJuwz1TQCz7Gq3rR`). L'intégration GitHub↔Vercel est déjà configurée : **tout push sur `main` déclenche automatiquement un déploiement en production**, aucune action manuelle sur Vercel n'est nécessaire.
- **URL de production** : https://cancale-v67-ten.vercel.app (alias) et https://cancale-v67.vercel.app (domaine "About" du repo GitHub) — les deux pointent vers la même app.
- **Backend de données** : Supabase (Postgres + API REST), utilisé comme simple magasin clé-valeur, **pas comme vraie base relationnelle avec auth**. RLS (Row Level Security) est **désactivé intentionnellement** sur les deux tables, et la clé anon Supabase est utilisée directement côté client (visible dans le code source). C'est un choix assumé pour un outil interne mono-utilisateur, pas un oubli de sécurité — mais bon à savoir si on audite le code.
- **Fonction serverless** : `api/vinted-proxy.js` (convention Vercel : tout fichier dans `api/` devient une route serverless). Sert de proxy CORS vers l'API interne de Vinted.
- **Extension Chrome** : dossier `vinted-sync-extension/` — **n'est pas déployée avec l'app web**, elle est chargée manuellement en mode développeur dans Chrome (`chrome://extensions`). Voir section 6.

### Autres fichiers présents dans le repo (hérités, à ne pas confondre)
- `apps-script.gs`, `sync-firebase.gs` : anciens scripts Google Apps Script liés à une ancienne architecture Firebase, antérieure à Supabase. Vérifier avec Julien s'ils sont encore utiles avant de les supprimer — a priori obsolètes depuis le passage à Supabase, **sauf** le point de la section 3 ci-dessous concernant les factures.
- `index.html`, `vite.config.js`, `package.json` : config Vite standard.
- `public/`, `scripts/` : à inspecter au cas par cas, pas de documentation connue dessus.

---

## 3. ⚠️ Point d'architecture important : deux pipelines de données bien distincts

Ne pas les confondre — un agent qui ne lit pas cette section risque de "corriger" une chose en cassant l'autre :

1. **Achats / Ventes / Messages Vinted** (onglet "Comptes Vinted liés") → viennent **directement de l'API interne de Vinted**, via les comptes captés par l'extension Chrome + le proxy `api/vinted-proxy.js`. C'est le pipeline le plus récent, construit pour remplacer l'ancien système par emails.
2. **Factures** (onglet "Factures") → viennent encore d'un **script Google Apps Script séparé** qui parse les emails Gmail de confirmation de vente Vinted et expose les données via une URL de web app Apps Script :
   `https://script.google.com/macros/s/AKfycbzO-jwmFwOwJI49W0LjR8EOcIKAWsTzElWsWc6IVg0luX6MhbJNdOXzpe2BhYUCXmHb/exec`
   L'app interroge cette URL au chargement de l'onglet Factures, puis toutes les 5 minutes, pour importer automatiquement les nouvelles factures (fonction `fetchVintedInvoices` dans `App.jsx`). **Ce pipeline email→Apps Script est toujours actif et nécessaire** pour les factures — il n'a pas été remplacé par l'API directe.

Donc : si on améliore/débogue les "achats en attente", c'est le pipeline API Vinted directe. Si on améliore/débogue les factures, c'est le pipeline Gmail/Apps Script. Ce sont deux systèmes différents qui alimentent deux onglets différents.

---

## 4. Le fichier `App.jsx` : pièges à connaître avant de l'éditer

- **~~Deux tableaux constants énormes~~ VIDÉS (juillet 2026).** `INIT_CAT` et `INIT_SAL` contenaient l'historique perso réel de Julien (~1815 paires / ~1580 ventes) embarqué dans le bundle **et donc visible dans le dépôt public**. Ils ne servaient que de valeur d'amorçage au 1er lancement ; les vraies données vivent dans le cloud (Supabase, ligne `main`, vérifié plus complet que le seed). On les a **remis à `[]`** : Julien ne perd rien (`cloudLoad` recharge ses données), un nouvel utilisateur part vierge, et le bundle est passé de **~735 Ko à ~355 Ko** (gzip 166→119 Ko). ⚠️ Le fichier reste gros (~310 Ko) mais **n'a plus** de lignes géantes tronquant les fetch distants.
- **Ne jamais lire tout le fichier d'un coup avec un outil à limite de tokens.** Utiliser `grep`/`rg` pour cibler une fonction ou une section avant de lire, comme on l'a fait pour ce brief (ex: `grep -n "fetchVintedOrders" src/App.jsx`).
- **Thème clair/sombre** : géré via une variable de module mutable `let C = THEMES.light` réassignée à chaque rendu du composant `App` (`C = dark ? THEMES.dark : THEMES.light`). Ce n'est pas un pattern React idiomatique (variable globale mutable plutôt que contexte), mais c'est le choix actuel — tout le reste du fichier lit `C.xxx` pour les couleurs. Ne pas le refactorer sans en parler à l'utilisateur, ça touche à absolument tout l'UI.
- **Synchronisation cloud maison** : pas de vrai backend applicatif. Le localStorage du navigateur est la source de vérité immédiate, et une liste `SYNC_KEYS` définit quelles clés localStorage sont synchronisées vers une seule ligne Supabase (`app_data`, id=`main`, colonne `data` en JSONB) :
  ```
  vinted_catalog, vinted_sales, vinted_garage_grid, vinted_blocked,
  vinted_extracols, vinted_colors, vinted_invoices,
  vinted_invoice_settings, vinted_custom_logo, vinted_dark, vinted_stock_vinted,
  vinted_accounts, vinted_account_labels, vinted_inventory
  ```
  D'autres clés localStorage existent mais **ne sont volontairement pas synchronisées** (comportement propre à chaque appareil) : `vinted_notif_enabled`, `vinted_last_weekly_recap`, `vinted_last_monthly_recap`, `vinted_sv_auto_removed`, `vinted_sv_seen_catalog`, `vinted_notif_last_sales`, `vinted_notif_last_invoices`.
- **Identifiants Supabase** (déjà en clair dans le code, RLS désactivé volontairement) :
  ```
  SUPABASE_URL = "https://lgonxzrzjcqthjtbdpzo.supabase.co"
  SUPABASE_KEY = (clé anon JWT, voir en haut de App.jsx)
  ```

---

## 5. Intégration Vinted (API interne non officielle)

Vinted n'a pas d'API publique documentée. Tout ce qui suit a été découvert par rétro-ingénierie (DevTools → "Copy as fetch" sur de vraies requêtes du site).

- **Deux hosts différents selon l'endpoint** :
  - `www.vinted.fr/api/v2/...` → commandes, achats, ventes (`/api/v2/my_orders`)
  - `api.vinted.fr/...` (sans `/api/v2`) → notifications et services annexes (`/inbox-notifications/v1/notifications/unread_count`)
- **Headers requis**, en plus des cookies de session (`access_token_web`, `refresh_token_web`, `anon_id`) :
  - `x-anon-id`
  - `x-csrf-token` — **introuvable** via cookie, meta tag ou JSON embarqué dans la page ; seule méthode fiable trouvée : intercepter les vraies requêtes fetch/XHR de la page elle-même en injectant un script dans le "MAIN world" (voir `inject.js` de l'extension).
  - `x-next-app: marketplace-web` et `platform: web` — uniquement nécessaires sur les appels à `api.vinted.fr` (pas sur `www.vinted.fr`).
- **Endpoint conversations/messages : TROUVÉ (juillet 2026).** La liste vient de `GET /api/v2/inbox` → `{ conversations: [...] }` (chaque conv : `id`, `description` = titre de l'article, `unread`, `updated_at`, `opposite_user{id,login,photo}`, `item_photos`). Le détail d'un fil vient de `GET /api/v2/conversations/{id}` → `{ conversation }` avec `conversation.messages` = liste d'entités `{ entity_type, entity }`. `entity_type==='message'` = vrai message (`entity.body`, `entity.user_id`) ; autres types = événements système (`offer_request_message`, `status_message`, `action_message`). Pour distinguer « moi » de l'acheteur : comparer `entity.user_id` à `conversation.opposite_user.id`. Les anciens chemins `/api/v2/conversations` et `/api/v2/transaction_messages` renvoyaient 404. Implémenté dans `fetchVintedConversations`, `fetchVintedConversationDetail`, `normalizeConversationMessages` + modale de lecture. **Fonctionnalité réactivée** (lecture seule ; répondre se fait via lien « Répondre sur Vinted »).
- **Auto-refresh des tokens (juillet 2026).** Les `access_token` Vinted expirent en ~2h. Le proxy `api/vinted-proxy.js` détecte un 401, appelle `POST /web/api/auth/refresh` (host `www.vinted.fr`, avec le `refresh_token_web`), récupère un nouveau access_token **et un nouveau refresh_token** (Vinted fait tourner le refresh_token — l'ancien est invalidé après usage), rejoue la requête, et renvoie les nouveaux tokens dans `json.refreshed`. `App.jsx` (`persistRefreshedTokens`) les répercute en mémoire + Supabase (`vinted_accounts`) + state. **Important** : ne jamais consommer un refresh_token sans persister le nouveau, sinon les appels suivants échouent en 401.
- **Refresh des tokens — PROFIL DISCRET (choix assumé, juillet 2026).** Après un blocage probable d'un compte, on a **volontairement réduit l'empreinte** de l'app côté Vinted. Le refresh ne se fait plus **en masse en arrière-plan** : rafraîchir plusieurs comptes en même temps depuis l'IP serveur de Vercel ressemble à du multi-comptes piloté par un robot (ce que Vinted détecte). Concrètement : **l'ancien `fetch('/api/vinted-refresh')` au démarrage a été retiré, et le cron Vercel supprimé** (`vercel.json` supprimé). Le token n'est désormais rafraîchi que pour **le compte réellement consulté**, et seulement s'il a expiré (via le proxy, au 401). Le pseudo (`login`) manquant n'est complété que pour le **compte sélectionné**, jamais tous d'un coup. L'endpoint `api/vinted-refresh.js` existe toujours mais n'est plus déclenché automatiquement (utilisable à la main si besoin). **Contrepartie** : si l'app reste fermée très longtemps, les tokens expirent et l'extension doit recapturer une session (repasser sur vinted.fr) — compromis accepté pour protéger les comptes.
- **⚠️ Risque multi-comptes (important).** Julien a plusieurs comptes Vinted capturés dans le même navigateur (`vanessa5723`, `llloollllaa`, `tomjean889`, `tomj683`). **Vinted interdit le multi-comptes** et le détecte (même appareil/navigateur/IP). Faire transiter plusieurs comptes par une seule IP serveur (le proxy Vercel) **amplifie** ce signal. C'est une cause de blocage indépendante du code. Piste de fond évoquée avec Julien : faire porter les appels Vinted par **l'extension (son navigateur/IP)** plutôt que par le proxy Vercel — plus discret — et/ou ne garder qu'un seul compte dans l'app.
- **Annonces en ligne (wardrobe)** : `GET /api/v2/wardrobe/{user_id}/items` → `{ items: [...], pagination }`. Utilisé par `fetchVintedListings` pour l'import dans l'inventaire.
- **Bordereau (label PDF) : endpoint réel PAS ENCORE capturé.** Vinted ne génère le bordereau que pour une commande *en attente d'expédition* ; il n'y en avait aucune au moment du sondage. La transaction (`GET /api/v2/transactions/{id}`) expose `shipment.id` mais pas l'URL du PDF. Solution actuelle (v1, fonctionnelle) : bouton 📄 par paire dans l'inventaire → l'utilisateur fournit le bordereau PDF téléchargé depuis Vinted → `annotateAndDownloadBordereau` (pdf-lib) y imprime le numéro + le titre. **Pour rendre automatique** : capturer la vraie requête du label (DevTools → Réseau lors d'un vrai téléchargement de bordereau, ou étendre `inject.js` de l'extension), puis fetch via le proxy avant annotation.
- **Statuts de commande** : Vinted ne renvoie pas un enum documenté, juste un champ `status` texte libre. La fonction `classifyOrderStatus(status)` dans `App.jsx` classe ce texte par regex :
  - `/annul|cancel|refus|rembours/i` → `'cancelled'`
  - `/finalis/i` → `'completed'`
  - sinon → `'pending'`
  C'est une heuristique, pas une garantie. **Si un jour un achat mal classé réapparaît**, c'est probablement un mot de statut Vinted pas encore couvert par cette regex — l'ajuster en priorité avant de chercher ailleurs.

### Extension Chrome (`vinted-sync-extension/`) — VERSIONNÉE + CAPTURE PASSIVE (juillet 2026)
- **Désormais dans le dépôt** (avant elle vivait seulement en local). Toujours chargée en mode développeur, non publiée sur le Chrome Web Store.
- **v2 = capture passive des données.** En plus de capturer les comptes (cookies → Supabase `vinted_accounts`), `inject.js` observe (sans les provoquer) les réponses des endpoints Vinted que la page charge déjà (`wardrobe/items`, `my_orders`, `inbox`, `conversations/{id}`, `users/current`) pendant que Julien navigue, et `background.js` les range dans Supabase table `app_data` sous des lignes `harvest_{account_id}_{type}` (et `harvest_{account_id}_conv_{convId}`). **Zéro requête supplémentaire vers Vinted** → invisible. Choix fait après un blocage de compte pour porter les appels par le navigateur/IP de Julien plutôt que par le proxy Vercel (IP datacenter).
- **À FAIRE (phase 2, pas encore branchée)** : côté `App.jsx`, lire ces lignes `harvest_*` de Supabase pour alimenter Inventaire/Ventes/Messages **sans passer par le proxy**. Tant que ce n'est pas fait, l'app continue d'utiliser le proxy `vinted-proxy` en direct (fonctionne, mais moins discret).
- Fichiers : `manifest.json` (MV3), `background.js` (service worker : capture comptes + rangement des données moissonnées), `content.js` (injecte inject.js + relaie), `inject.js` (MAIN world, observe fetch/XHR + capture csrf ET corps des réponses utiles), `popup.html`/`popup.js`, `README.md` (installation).
- Fonctionne pour plusieurs comptes Vinted en parallèle : chaque compte connecté dans Chrome (ou dans des profils Chrome différents) est capturé et upserté séparément dans `vinted_accounts` (clé unique `vinted_user_id`, décodé depuis le JWT du cookie `access_token_web`).
- Se relance : au démarrage de Chrome, à l'installation, toutes les 10 min (alarme), et immédiatement si le cookie de session change.

### Table Supabase `vinted_accounts`
Colonnes : `id`, `vinted_user_id` (unique), `login`, `domain`, `access_token`, `refresh_token`, `anon_id`, `csrf_token`, `updated_at`, `created_at`. RLS désactivé.

---

## 6. Comment le déploiement a été fait jusqu'ici (et pourquoi c'était pénible)

Sans accès terminal/git direct (session Cowork), chaque modification suivait ce cycle :
1. Éditer une copie locale du fichier.
2. Aller sur `github.com/julatace/cancale-v67/upload/main/src`.
3. Glisser le fichier, le renommer en `App.jsx` dans la zone d'upload, confirmer le remplacement, "Commit changes".
4. Le push déclenche automatiquement un build+déploiement Vercel.
5. **Vérification obligatoire** (ne jamais faire confiance à l'apparence de succès de l'upload) :
   - `list_deployments` sur le projet Vercel pour récupérer le SHA du commit du déploiement `READY`/`production` le plus récent.
   - Fetch `https://github.com/{owner}/{repo}/commit/{sha}.diff` — **et non le fichier brut complet**, qui est trop gros et se fait tronquer avant d'atteindre le code utile (voir section 4). Le `.diff` ne montre que les lignes changées, ce qui est rapide et fiable.
   - Comparer ce diff avec le changement attendu.
6. Un bug de désynchronisation GitHub a été observé plusieurs fois (le fichier live revenait à un ancien contenu après un upload) — jamais définitivement expliqué. Contournement qui a fonctionné : **toujours utiliser un nom de fichier local unique pour chaque nouvel upload** (ex. `App-v3-fix-annulees.jsx`) plutôt que de réutiliser littéralement `App.jsx` en local.

**Avec Claude Code (accès terminal réel), tout ce cycle disparaît** : `git add`, `git commit`, `git push` suffisent, et il n'y a plus besoin du contournement de nom de fichier unique ni de la vérification via diff GitHub (on peut vérifier directement avec `git log`, `git diff`, et en observant le déploiement Vercel se lancer).

---

## 7. État fonctionnel actuel

**Fonctionne** :
- Tableau de bord (stats, CA, bénéfices, estimation cotisations URSSAF, graphiques)
- Catalogue (ajout/édition/suppression de paires)
- Ventes (saisie, édition, export CSV)
- Factures (création manuelle + import automatique via Gmail/Apps Script, génération PDF imprimable)
- Garage visuel (grille de boîtes, recherche, doublons, blocage de cases, couleurs)
- Stock Vinted (liste des annonces en ligne, réconciliation automatique avec factures et catalogue)
- Comptes Vinted liés : achats/ventes multi-comptes avec photos, prix, dates, filtres Toutes/En attente/Finalisées/**Annulées** (ce dernier ajouté récemment pour corriger un bug de classification)

**ARCHITECTURE ACTUELLE (juillet 2026, après une longue session Claude Code — REMPLACE les anciennes descriptions ci-dessus)** :

⚠️ **L'onglet « Inventaire » et l'onglet « Stock » ont été RETIRÉS** (leurs données restent en base, non supprimées). Le nouveau modèle : le numéro se met **directement sur chaque annonce en ligne**.

- **Navigation** : une **barre du bas façon Vinted** (`BOTTOM_TABS`, `BottomBar` — fixe en bas, scrollable/swipe) avec des **onglets dédiés par catégorie** : Stats / **Annonces** (`cat_annonces`) / **Ventes** (`cat_ventes`) / **Achats** (`cat_achats`) / **Bordereaux** (`cat_bord`) / **Messages** (`cat_msg`) / Garage / Factures. En haut à droite, un **rouage ⚙️** ouvre les **Paramètres** (`SettingsScreen`) : export/import, ancien catalogue + anciennes ventes (`ARCHIVE_TABS`, toujours lus par le tableau de bord), thème, et l'accès à **« Comptes liés »**.
- **Un seul composant rend toutes les catégories** : `Comptabilite({ only })`. Chaque onglet dédié le monte avec `only='annonces'|'ventes'|'achats'|'bordereaux'|'messages'` (agrège **tous les comptes**). Petite **étiquette de compte** (`AcctTag`) sur chaque ligne pour savoir d'où vient la vente/l'annonce. Les Messages sont **séparés par compte** (sélecteur `msgAcc`).
  - **Annonces** = annonces réellement en ligne (`fetchVintedListings` → `wardrobe/{PROFIL_id}/items`, filtrées `isOnlineListing` = `!is_closed && !is_hidden && !is_draft`). ⚠️ **Le wardrobe utilise l'ID DE PROFIL** (`users/current.user.id`, ≠ `vinted_user_id`=account_id) — sinon 0 annonce. Affichage façon Vinted (photo, prix, marque·taille·état). Sur chaque annonce : champ **N°** (badge), **prix d'achat**, bouton **🔗** (relier à un achat Vinted de N'IMPORTE quel compte → récupère le prix payé, exclut les achats déjà reliés), indicateur **🏠 Au garage / Ranger**.
  - **Numérotation** : stockée dans **`vinted_annonce_numeros`** (clé = id d'annonce wardrobe) = `{numero, title, buyPrice, buyFromId, photo, price, numberedAt}`.
    ⚠️ **RÈGLE CHANGÉE (août 2026) — un numéro = une PLACE au garage, pas un numéro de facture.** Avant, `vinted_used_numeros` était append-only et **aucun numéro n'était jamais réattribué** : résultat, 116 paires en ligne et un compteur déjà à 181, avec des numéros jusqu'à 172 (plainte de Julien : « pourquoi numéro 156 alors que j'ai à peine 50 paires »). Désormais un numéro est **PRIS** seulement tant qu'une paire l'occupe vraiment : annonce encore en ligne, numéro posé au garage, ou vente **pas encore expédiée** (`needsBordereau`). Sinon il **retourne dans le pool** (`freedNums` / `takenNums` dans `Comptabilite`), et la suggestion est le **plus petit libre**. L'historique n'y perd rien : chaque vente garde son numéro dans sa propre ligne (`vinted_sale_overrides`).
    **Garde-fou anti-doublon** : on ne libère le numéro d'une annonce disparue que si les ventes sont chargées ET si le compte de cette annonce a bien renvoyé ses annonces au dernier chargement — un chargement partiel ne doit jamais libérer un numéro encore utilisé.
    **Bouton « 🔢 Renuméroter à la suite »** (Annonces → ⋯ Outils) : `renumPlan` calcule un aperçu (X → Y par paire), `applyRenum` écrit après confirmation. Ne déplace jamais une paire rangée au garage ni une paire dont le numéro sert à une vente pas encore expédiée. Met aussi à jour `vinted_buyprice_by_num` (sinon le prix d'achat suivrait l'ancien numéro).
  - **Ventes/Achats** : filtres (En cours/Finalisées/Annulées ; En attente/Reçus), tri par date, totaux **CA finalisé / Coût / Bénéfice + marge moyenne + temps de vente moyen**, bouton **bordereau 📄** par vente, **export CSV**. Le bénéfice se calcule via le prix d'achat relié dans Annonces (matching par **titre exact**, `normTitle`). ⚠️ **Titres en double** : si plusieurs annonces portent le même titre (`titleAmbiguous`), on **n'associe pas** de prix d'achat au hasard — badge « ⚠️ titre en double » (Ventes/Annonces) et exclusion dans Bordereaux.
  - **Cache** : `_acctCache` (module-level, TTL 3 min) partagé entre vues → changer d'onglet ne re-fetche pas ; le bouton **« Synchroniser »** force (`{force}`).
- **Écran « Comptes liés »** (`VintedAccounts`, accessible depuis Paramètres) : **gestion des comptes uniquement** — lister les comptes captés par l'extension, les renommer (`vinted_account_labels`), tester la connexion, actualiser, et **« Déconnecter »** (supprime la ligne `vinted_accounts` de Supabase + state — pour un compte bloqué/fermé ; via `deleteVintedAccount`). **Plus aucune vue de données ici** — évite les doublons.
- **Chargement des comptes au démarrage de l'app** (`fetchVintedAccounts` dans un effet racine + `accountsLoaded`) : les onglets Ventes/Achats/Annonces/Messages ont les comptes **immédiatement**, sans devoir passer d'abord par « Comptes liés ». Lecture Supabase légère (pas un appel Vinted).
- **Garage** : depuis une annonce, bouton **🏠 Ranger** → mode rangement (`placeNum`) : clic sur une case vide y place le N°. Panneaux de cohérence : « numérotées mais pas au garage » / « au garage mais numéro inconnu ».
- **Notif à l'ouverture** (`vintedNotif`) : bandeau **nouveautés depuis la dernière ouverture** (ventes + messages). ⚠️ Les messages sont en **delta** : on mémorise par conversation le `updated_at` déjà vu (`vinted_notif_seen_convs`, local non synchronisé) ; une conv non lue laissée exprès ne re-sonne plus. Premier lancement silencieux. Calculé depuis la moisson (0 requête).
- **Accueil nouveau venu** (`Onboarding`) : carte 3 étapes tant qu'aucun compte n'est lié (`vintedAccounts.length===0 && accountsLoaded`).
- **Robustesse UI** : `Skeleton` (squelettes animés au chargement, keyframes `cancaleSkeleton` dans `index.html`), `LoadError` (bouton « Réessayer ») quand un chargement échoue totalement — les loaders distinguent **vide** (0 résultat) et **échec réseau** (tous les comptes en erreur). Empty states parlants. Mobile : `paddingBottom` du `<main>` = `calc(84px + env(safe-area-inset-bottom))`.
- **Annonces façon outil pro** : recherche (titre/marque/N°, `annSearch`), tri (`annSort` : prix, favoris, vues, **À booster 💡** = très vues sans favoris → baisse de prix, sans numéro), bandeau de stats (nb en ligne, valeur totale, ❤️/👁 cumulés, sans N°), badges d'engagement par annonce. Champs `views`/`favourites`/`createdTs` **captés défensivement** dans `mapWardrobeItem` (affichés seulement si présents).
- **Analyse de perf (onglet Ventes)** : temps de vente moyen (numérotation→vente), taux d'écoulement (`vendues/(vendues+en ligne)`), meilleure marque (`extractBrand`, bénéfice moyen/paire), et **objectif de CA mensuel** éditable avec barre (`vinted_goal`, synchronisé). Recherche sur Ventes/Achats (`ordSearch`, via `matchOrd`).
- **Bénéfice NET (boosts)** : champ `fees` (« 💡 boost € ») par annonce dans `vinted_annonce_numeros`. Bénéfice = vente − achat − boost, répercuté ligne de vente, totaux (cartes « Boosts »/« Bénéfice net »), marge, top marque, CSV. `feesOf(e)`/`eur(v)` helpers. Détection AUTO des boosts = à faire (endpoint facturation Vinted non capturé) ; saisie manuelle en attendant.
- **Paire qui dort (#2)** : `listedAgeDays(it)` (ancienneté via `createdTs` Vinted sinon `numberedAt`), seuil `SLEEP_DAYS=30`. Badge « 😴 Xj », puce/bandeau « X qui dorment » + tri « Qui dorment 😴 » → baisser le prix / republier.
- **Accessibilité (#5)** : `:focus-visible` (anneau clavier), `prefers-reduced-motion` (coupe le shimmer), `aria-label` sur boutons icônes + barre du bas (`aria-current` sur l'onglet actif). Dans `index.html`.
- **PWA** : app **installable** + consultable **hors-ligne**. `public/manifest.webmanifest` + icônes (`public/icon-192/512/maskable-512.png`, `apple-touch-icon.png`), SW enregistré dans `main.jsx`. `public/sw.js` = réseau-d'abord pour la navigation (toujours la dernière version), cache-d'abord pour les assets hashés, **jamais** de cache sur Supabase/Vinted/proxy (cross-origin) ; conserve le handler `/print-pdf/` (bordereaux AirPrint).
- **Rapport comptable (#3) — FAIT** : réglage `vinted_regime` (micro / société-marge) + `vinted_tva` dans Paramètres (`RegimeSetting`). Bouton « 📊 Rapport » (onglet Ventes) → modale `showReport` : sélecteur de mois (`reportMonths`/`reportMonth`), chiffres adaptés au régime (micro : CA + bénéfice net + cotisations 13,5 % ; marge : marge TTC + TVA sur marge + marge HT), registre d'achats du mois, export CSV (`exportReportCsv`) + PDF (`exportReportPdf`, pdf-lib). **Justificatif d'achat** PDF par commande (`generateAchatJustificatif`) : bouton « 📄 Justif. » sur chaque achat + dans le registre. ⚠️ Le justificatif est un **récap généré par l'app** (pas la facture/reçu officiel Vinted) ; capter le reçu officiel via l'extension reste à faire.
- **PWA** : app **installable** + consultable **hors-ligne**. `public/manifest.webmanifest` + icônes (`public/icon-192/512/maskable-512.png`, `apple-touch-icon.png`), SW enregistré dans `main.jsx`. `public/sw.js` = réseau-d'abord pour la navigation (toujours la dernière version), cache-d'abord pour les assets hashés, **jamais** de cache sur Supabase/Vinted/proxy (cross-origin) ; conserve le handler `/print-pdf/` (bordereaux AirPrint).
- **Dépendance ajoutée** : `pdf-lib` (bordereaux, import dynamique).

**PIPELINE DE DONNÉES (crucial)** : voir aussi extension section 5. L'app lit **d'abord** les données moissonnées passivement par l'extension (lignes `harvest_*` de Supabase, 0 requête Vinted), et **retombe sur le proxy `vinted-proxy` uniquement si rien n'a encore été capté** pour cette page (filet anti-écran-vide). Le bouton **« Synchroniser »** force un vrai fetch (`opts.force`). Chaque `fetchVinted*` accepte `{harvestOnly}` / `{force}`.

**Ne fonctionne pas / en pause** :
- Répondre aux messages depuis l'app (lecture OK ; réponse via lien Vinted).
- Bordereau 100% automatique : l'extension v2.2 **capte le PDF quand tu le télécharges sur Vinted** (`harvest_{uid}_label_latest`) et l'app propose de l'utiliser (< 20 min, avec confirmation) sinon glisser-fichier — **jamais validé sur un vrai envoi** (aucune commande à expédier pendant le dev). À confirmer au prochain envoi réel.
- Dates fines (argent reçu vs vente vs réception colis) : `my_orders` ne donne qu'**une date** par commande. Séparer demanderait de capter le détail transaction par transaction.

**⚠️ Risque de blocage** : Julien a **4 comptes Vinted** dans le même navigateur (multi-comptes interdit par Vinted, détecté par empreinte/adresse/paiement, pas que l'IP). C'est la principale cause de risque, indépendante du code. C'est pour ça qu'on est passé à la **capture passive par l'extension** (navigateur/IP de Julien) et qu'on a **retiré le refresh en masse + le cron** (voir section 5).

---

## 8. Instructions pratiques pour démarrer avec Claude Code

```bash
git clone https://github.com/julatace/cancale-v67.git
cd cancale-v67
# S'assurer d'être authentifié sur GitHub (gh auth login, ou clé SSH déjà configurée)
npm install
npm run dev        # pour tester en local
```

- Fichier principal à éditer : `src/App.jsx`.
- Pas besoin de configurer Vercel manuellement : le push sur `main` déclenche le déploiement automatiquement (intégration déjà en place).
- Si on veut quand même utiliser la CLI Vercel en local : `vercel login` puis `vercel link` (choisir le projet `cancale-v67` dans le team `shopcancale35-7638s-projects`).
- Après une modification et un push, vérifier le déploiement soit sur https://vercel.com/shopcancale35-7638s-projects/cancale-v67, soit directement en rechargeant https://cancale-v67-ten.vercel.app après une minute ou deux.
- Toujours cibler ses lectures/greps dans `App.jsx` à cause des deux lignes géantes de données (section 4).

---

## 9. Ce que je n'ai pas pu faire depuis Cowork (et pourquoi ce document existe)

Depuis l'environnement Cowork (celui qui a produit ce document), il n'y a :
- aucun accès réseau sortant vers `github.com`/`api.github.com` pour pousser du code (lecture publique seule, utilisée uniquement pour vérifier les déploiements),
- aucun connecteur GitHub disponible dans le registre de connecteurs Cowork.

D'où le report vers **Claude Code**, qui tourne directement sur la machine de l'utilisateur avec un accès terminal complet (git, `gh`, `vercel`). Ce document sert à ce que ce transfert se fasse sans perte de contexte.

---

## 10. Session juillet 2026 (Claude Code) — Widget + « à retirer / à expédier » automatiques + cohérence des chiffres

**Contexte** : gros travail de fiabilisation des chiffres (ils étaient incohérents entre app et emails). Points clés à NE PAS casser :

### Sources de vérité (crucial)
- **CA + ventes du mois** = les emails de VENTE `email_sale_*` (Supabase), un par vente avec `prix`. C'est complet et fiable 24/7 (arrive même sans être sur Vinted). **PAS** les emails « argent viré » `email_final_*` (rares + montant souvent vide → donnait un faux 41 €). Côté app : l'effet racine `liveStats` recalcule `caMois`/`ventesMois` depuis `email_sale_*` (écrase le calcul harvest). Côté widget : idem.
- **« À retirer » (achats) + « À expédier » (ventes)** = **STATUT VINTED** moissonné (`harvest_*_orders_purchased` / `_sold`, champ `status` texte). C'est la seule source qui se met à jour toute seule quand tu récupères/expédies.
  - à retirer = achat `status` ~ « déposé en point relais / bureau de poste » (`isAtRelayStatus`).
  - à expédier = vente `status` ~ « Bordereau envoyé au vendeur » ou « paiement validé » (`isAwaitingShipStatus`).
  - ⚠️ Les emails `email_track_*` (« colis dispo » Mondial Relay) sont **imprécis** (aucun email quand tu récupères → ils restent « dispo » pour toujours) et ne servent plus qu'à afficher la **carte relais + les codes/QR de retrait**, pas à compter.
- **Bordereaux** : `bordShipped(b)` = la vente liée (par `transaction`) a un statut Vinted au-delà de « bordereau envoyé » → le bordereau est auto-marqué expédié (`isBordDone = isBordPrinted || bordShipped`). Bouton **✕** pour masquer un bordereau (`vinted_bords_hidden`). « Relier » (`vinted_bord_links`) pour un bordereau dont la paire n'est pas retrouvée (départage aussi par la taille, cf. `entryByTitleLoose(title, size)`).

### Widget écran d'accueil (iPhone)
- App **Scriptable** + endpoint **`api/widget.js`** (JSON, lecture Supabase seule, zéro appel Vinted). Domaine : `https://vrm.center/api/widget`.
- Renvoie : `ship{total,overdue,today,tomorrow}`, `pickup`, `moneyMonth` (CA du mois = somme `email_sale.prix`), `salesMonth`, `received` (argent viré `email_final`), `pending`/`online`/`unread` (via la ligne `widget_stats`).
- **`widget_stats`** = photo publiée par l'app (effet `liveStats`) pour les chiffres harvest (en attente, en ligne, non lus). « Synchroniser le widget » = ouvrir l'app.
- `vinted_pickup_done` (synchronisé) = colis marqués récupérés à la main (bouton ✓) → soustrait du compteur à retirer, app ET widget.

### Autres endpoints ajoutés
- **`api/ship-reminders.js`** + `vercel.json` (cron quotidien 08:00 UTC) : push « X colis à expédier aujourd'hui/demain/en retard ».
- **`api/email-inbound.js`** amélioré : capture QR de retrait (pièce jointe / `data:base64` / URL / image carrée), détecte plus de transporteurs, statut « livré/retiré » élargi, montant « argent viré » robuste, anti-faux-colis (exige un n° de suivi pour « disponible »).

### Features ajoutées cette session (toutes dans `Comptabilite`)
Passeport de la paire (📖), Répartiteur de lot (🧮), Audit stock fantôme (🔎), Courbes de prix par marque (📈), Wrapped vendeur (🎉), Planificateur de tournée (🗺️), garde-fou ventes sans prix d'achat, dépendance `qrcode-generator` (QR généré à la volée).

### RESTE À FAIRE / discuté, pas fait
- **Multi-utilisateurs** : l'app est **mono-utilisateur** (une seule ligne Supabase `main` partagée). Pour ouvrir à d'autres vendeurs → vrai chantier : login + isolation des données par utilisateur. À scoper avec Julien avant de coder (ne pas bricoler une auth à moitié).
- Carte des relais : encore perfectible selon les retours de Julien.


---

## 11. Session août 2026 (Claude Code) — Cohérence + numérotation + refonte visuelle

### Cohérence (une seule règle par notion)
- `acctOff(uid)` / `acctOffOf(o)` dans `Comptabilite` = **la** définition d'un compte masqué ou bloqué. Utilisée par les ventes, achats, messages, annonces, trésorerie, rapport, notifications. Ne plus refaire ce test à la main ailleurs.
- `annBase` = **la** liste des annonces réellement en ligne (comptes actifs, hors paires vendues). La grille, le bandeau de stats, les conseils de prix/qualité/likers, le taux d'écoulement, l'audit et la numérotation auto en dérivent tous.
- `buysBase` = idem pour les achats.
- `isColisRetirable(t, collected)` (module-level) = **le** compteur « colis à retirer », partagé par l'accueil, l'onglet Achats et le centre de notifications.
- `toShip` exclut désormais les colis déjà cochés « posté ».
- `vinted_annonces_email_sold` (synchronisé) = mémoire des annonces auto-retirées parce qu'un email de vente/bordereau les confirme vendues → le tableau de bord compte comme l'onglet Annonces.
- La barre d'objectif de CA lit `liveStats.caMois` (prop passée à `Comptabilite`), pas un calcul local.

### Visuel
- **Échelle typographique** ramenée à 9 / 11 / 12 / 13 / 15 / 17 / 20 / 22 / 26 / 32 (24 tailles avant). **Graisses** : 500 / 600 / 700 uniquement (800 et 900 supprimés). **Rayons** : 6 / 10 / 12 / 16 / 20 / 999 (18 valeurs avant).
- **Icônes au trait** (`ICON_PATHS` + `<Icon name size/>`) dans la barre du bas ET dans les `ScreenHead` : un écran et son onglet portent le même symbole. Les emojis restent ailleurs.
- Police : **Inter uniquement** (l'app forçait encore Nunito par-dessus, et un `@import` chargeait Nunito + Instrument Sans pour rien).
- Titre en double supprimé (le `<h2>` de `Comptabilite` répétait le `ScreenHead`), et « Aucun compte lié » est devenu un vrai `EmptyState` **sous** le titre.


---

## 12. Multi-vendeurs (posé août 2026, PAS ENCORE ACTIF)

**Modèle choisi avec Julien : SaaS — chaque vendeur a ses propres données**, aucun partage. (Pas le modèle « équipe sur une même boutique ».)

### Où vit l'isolation
**Dans Postgres, pas dans le JavaScript.** Chaque ligne de `app_data` et `vinted_accounts` porte un `owner uuid` (défaut `auth.uid()`), et une policy RLS `owner = auth.uid()` filtre lecture ET écriture. Une isolation écrite côté app ne protégerait de rien (console du navigateur). ⚠️ **Ne jamais « simplifier » en filtrant côté client.**

### Deux interrupteurs, à ne PAS confondre
- **`MULTI_USER`** (constante en haut de `src/App.jsx`) = est-ce qu'on demande une connexion ? **Actuellement `true`** — le compte vendeur existe (`shopcancale35@gmail.com`, UID `74eea6e7-f060-46b6-b9c7-d500cedf4738`, à coller dans l'étape 2 de la migration). ⚠️ **Créer un compte ne marche QUE via Authentication → Add user → Create new user + « Auto confirm user »** : le formulaire d'inscription dépend d'un email de confirmation que le serveur de test Supabase n'envoie pas (quota ~2/h), et la page Providers refuse d'enregistrer (option « leaked password protection » réservée au plan payant). Un premier essai à `true` avant d'avoir le compte avait enfermé Julien dehors — remis à `false`, puis à `true` une fois le compte créé — remis à false après essai réel : l'écran de connexion n'apportait aucune protection (rien n'est cloisonné sans la colonne `owner`) mais bloquait l'outil de travail quotidien, et la création de compte était impossible (quota d'emails du serveur de test Supabase, tableau de bord qui refuse d'enregistrer à cause d'une option réservée au plan payant, pas d'action « Confirm email » dans cette version). **Ordre correct : migration SQL → créer le compte via « Add user » du tableau de bord (confirmé d'office, sans email) → puis `MULTI_USER = true`.**
- **`CLOISONNE`** (détecté au démarrage par `detectSchema()`, qui teste si la colonne `owner` existe) = est-ce que la base sait séparer les vendeurs ? **Actuellement faux** tant que la migration SQL n'est pas passée.

⚠️ **Tant que `CLOISONNE` est faux, on écrit EXACTEMENT comme avant** : clé publique dans `Authorization`, pas de colonne `owner`, cible d'upsert `id`, ligne `main` partagée. Envoyer un `owner` inexistant ferait échouer **toutes** les sauvegardes. Le jeton du vendeur ne remplace la clé publique que lorsque la base sait s'en servir (le rôle `authenticated` n'a pas forcément les mêmes autorisations — ne pas parier là-dessus).
L'extension fait la même détection de son côté (`isCloisonne()`, mise en cache le temps de vie du service worker).

**Porte de secours** : tant que `CLOISONNE` est faux, l'écran de connexion propose « Entrer sans compte (temporaire) » (`vrm_acces_direct` en localStorage). Elle ne donne accès à rien de plus (les données sont communes de toute façon) et **disparaît automatiquement** dès la migration. Sans elle, un email de confirmation qui n'arrive pas enfermerait Julien hors de son outil de travail quotidien.

### Ancien texte de l'interrupteur (historique)
`const MULTI_USER = false;` en haut de `src/App.jsx`. À `false` (état actuel) : l'app se comporte exactement comme avant, aucune connexion demandée. On ne passe à `true` **qu'après** avoir appliqué la migration SQL — dans l'autre ordre, Julien se retrouverait devant un écran de connexion que la base ne sait pas honorer.

### Pièces en place
- `supabase/migrations/001-multi-utilisateurs.sql` — migration en 2 étapes (colonnes + défauts, puis attribution des lignes existantes à Julien, clé primaire `(owner,id)`, RLS). `supabase/README.md` = le mode d'emploi pas à pas.
- `AUTH` / `authBoot` / `authSignIn` / `authSignUp` / `authReset` / `authRefresh` / `authSignOut` dans `App.jsx` (Supabase Auth en REST, session en localStorage `vrm_session`, renouvellement auto toutes les 4 min).
- **`sbAuth(extra)` = le point de passage UNIQUE de tous les appels Supabase** (37 sites convertis). Il met le jeton du vendeur dans `Authorization`, la clé publique dans `apikey`. Ne plus jamais écrire `Authorization: Bearer ${SUPABASE_KEY}` à la main.
- `withOwner(row)` sur toute ligne écrite, `SB_CONFLICT` (`'id'` en solo, `'owner,id'` en multi) sur tous les upserts.
- `cloudPush` est passé de PATCH à **upsert** : un nouveau vendeur n'a pas encore de ligne, un PATCH n'aurait jamais rien sauvegardé.
- `ensureLocalOwner(uid)` + `wipeLocalData()` : le localStorage est commun à tout le site — sans ménage, le vendeur B héritait des numéros de A **et les repoussait dans le cloud sous son propre compte**. Changement d'identité ⇒ effacement des clés `vinted_*` / `vrm_*`, puis `location.reload()` après connexion.
- `AuthScreen` : connexion / création / mot de passe oublié. Réponse identique que le compte existe ou non (sinon le formulaire révèle qui est inscrit).
- **Extension** : `background.js` a sa propre session (`chrome.storage.local.vrmSession`), `sbHeaders()` / `withOwner()` / `appDataConflict()`. L'app lui transmet le jeton par `window.postMessage({__vmr:'session'})` → `bridge.js` → background, **avec vérification de l'origine** (seuls les domaines de l'app sont acceptés, sinon n'importe quel site pourrait injecter un jeton).

### Connexion Google / Discord (OAuth, PKCE)
- `oauthStart(provider)` → `/auth/v1/authorize?provider=…&code_challenge=…&code_challenge_method=s256`, vérificateur en `sessionStorage`.
- `consumeAuthRedirect()` au boot gère **les deux formes de retour** : `?code=` (PKCE → échange sur `token?grant_type=pkce` avec `{auth_code, code_verifier}`) et `#access_token=` (liens email, notamment « mot de passe oublié »). `cleanAuthUrl()` efface le jeton de la barre d'adresse.
- ⚠️ **PKCE et pas implicite** : en implicite le jeton d'accès revient dans l'URL (historique, journaux de proxy, presse-papier). Ne pas « simplifier » en revenant à l'implicite.
- `RECOVERY_PENDING` : le lien « mot de passe oublié » connecte techniquement le vendeur — sans ce drapeau l'app s'ouvrait normalement et le formulaire de nouveau mot de passe n'apparaissait jamais.
- Providers à activer dans le dashboard Supabase (clés Google Cloud / Discord Developer) + **liste blanche des Redirect URLs** : sans elle, un lien de connexion fabriqué peut renvoyer le jeton vers un autre site. Procédure dans `supabase/README.md`.

### ⚠️ Faille corrigée : `api/widget.js` était PUBLIQUE
`https://vrm.center/api/widget` renvoyait **sans aucune clé** le CA du mois, le nombre de ventes, l'argent en attente et les annonces en ligne — avec `Access-Control-Allow-Origin: *` en prime. Exige désormais `?k=<vrm_widget_token>`, comparé **en temps constant** (une comparaison ordinaire s'arrête au premier caractère faux → clé devinable au chronomètre). Le jeton est généré par l'app après `onCloudReady` (une seule fois, sinon chaque appareil en créerait un) et affiché dans **Paramètres → Widget iPhone**. Tant qu'aucun jeton n'existe en base, la route répond encore (transition, pour ne pas casser le widget avant que Julien ait la nouvelle adresse).

### Ce qui bloque encore la bascule
Les fonctions `api/*.js` (widget, email-inbound, ship-reminders, push) écrivent avec la clé anon → **cassées dès que RLS est activé**. Il leur faut `SUPABASE_SERVICE_KEY` (Vercel) + savoir à quel vendeur attribuer chaque ligne. Pour les emails, ça suppose de rattacher une adresse email à un vendeur — chantier à part entière.

---

## 13. Session août 2026 (suite) — plus aucune boîte de dialogue du navigateur

C'était **le** détail qui faisait « site web » plutôt qu'« application » : chaque suppression, chaque saisie de numéro ouvrait la boîte grise du navigateur — sur iPhone, une alerte système au milieu de rien.

### Ce qui remplace quoi
| Avant | Après |
|---|---|
| `window.confirm()` (29 appels) | `await askConfirm({title, desc, ok, cancel, danger})` → `<ConfirmHost/>` |
| `window.prompt()` (25 appels) | `await askText({desc, value, numeric, ok})` → `<AskTextSheet/>` |
| `window.alert()` (2 appels) | `toast()` |

- Les deux feuilles partagent `SheetShell` (voile flouté + panneau qui monte du bas, animation `cancaleSheet` dans `index.html`) et `sheetTexte()` (la première phrase devient le titre, le reste passe en dessous en texte normal — sinon une question d'un seul tenant faisait un titre de six lignes en gras).
- `askText` renvoie **la chaîne saisie, ou `null` à l'annulation**, exactement comme `window.prompt` : les appels existants (`|| ''`, `!= null`) marchent tels quels.
- 14 champs sont en `inputMode="numeric"` (pavé numérique sur téléphone) — la moitié des saisies du Garage sont des numéros de boîte.
- **Filet** : si `<ConfirmHost/>` n'est pas monté, on retombe sur la boîte du navigateur au lieu de bloquer. Il **est** monté, à côté de `<Toaster/>`.

### ⚠️ Piège si tu refais ce genre de conversion en masse
Passer de synchrone à `await` oblige à rendre `async` toutes les fonctions englobantes. Un script qui remonte automatiquement jusqu'à la fonction la plus proche **se trompe** sur deux familles de cas, et ça ne se voit pas au build :
1. **Les fonctions de RENDU** (`{cond && (()=>{ … })()}`). React ne sait pas afficher une Promise → l'écran devient blanc. 4 cas dans le Garage.
2. **Les callbacks dont la valeur de retour compte** : `items.find(async o => …)` renvoie toujours une Promise, donc toujours vrai → **le mauvais meuble est retourné**. Pareil pour `.reduce`, `.map`, `.filter`. 4 cas.
Dans les deux familles, il faut rendre `async` la fonction **au-dessus**, pas le callback. Vérifier après coup : `git diff | grep async` puis chercher chaque nom converti pour voir si son retour est consommé quelque part.

### Icônes
`ICON_PATHS` gagne `trash` / `close` / `pencil`. Les 25 boutons qui ne portaient qu'un emoji nu (🗑 ✕ ✎ 📄) passent au trait — un emoji est dessiné par un fournisseur différent des icônes de la barre du bas, ça ne va pas ensemble. `<Icon>` porte `vertical-align: middle` : une `<svg>` est un élément en ligne, sans ça elle se pose sur la ligne de base et paraît décalée. Les emojis **dans les libellés** (« 📤 Exporter Excel ») sont gardés : là, ils aident.

**Garage** et **Factures** étaient les deux derniers écrans avec leur vieux `<h2>` vert + emoji ; ils passent à `<ScreenHead>` comme tous les autres.

---

## 14. Session août 2026 (suite) — densité d'affichage + gestes à la souris

### « Ça fait un peu gros sur iPhone » → réglage de taille
Réglages → Affichage → **Petit / Compact / Normal / Grand** (`ZoomSetting`, clé `vrm_zoom`).
**Volontairement PAS dans `SYNC_KEYS`** : ça dépend de l'écran, pas du vendeur. Le même compte sur un iPhone et sur un 27 pouces ne veut pas la même densité.

⚠️ **Pièges, tous rencontrés et corrigés :**
1. **`zoom` seul ne suffit pas.** Il rétrécit la page sans élargir la mise en page → bande vide sur la droite. Il faut lui rendre la largeur perdue : `minWidth = largeurRéelle / facteur`.
2. **En PIXELS, jamais en `vw`.** À l'intérieur d'un élément zoomé, `100vw` est zoomé lui aussi : `calc(100vw / 0.8)` s'annule tout seul. Testé, ça ne marche pas.
3. **Remettre à zéro avant de mesurer.** `applyZoom` fait `zoom=''; minWidth=''` puis lit `clientWidth`, sinon on lit une largeur déjà zoomée et on la redivise → les zooms se composent à chaque appel.
4. **Le conteneur racine avait `maxWidth:'100vw'`**, qui plafonnait la page à la largeur non zoomée et ramenait la bande grise. Retiré ; `overflowX:'clip'` faisait déjà le travail.
5. **Recalcul sur `resize` / `orientationchange`** : la largeur est en pixels, elle ne suit pas toute seule.
6. Appliqué par un petit script **dans `index.html`, avant le chargement de l'app** : sinon la page s'affiche à 100 % puis saute de taille à chaque ouverture.

### « Sur l'ordinateur je ne peux pas glisser avec la souris »
Le balayage entre onglets n'écoutait que `onTouchStart`/`onTouchEnd` — **une souris n'émet jamais ces événements**.

- Ajout de `onPointerDown/Move/Up/Cancel` **filtrés sur `pointerType === 'mouse'`**. Le tactile continue de passer par les gestes tactiles : sur mobile un `pointerup` n'arrive pas toujours (dès que la page défile, le navigateur envoie `pointercancel`), donc on ne touche pas à ce qui marche.
- **Un glissé franchement horizontal coupe la sélection de texte** (`userSelect:none` + `removeAllRanges`). Sans ça le geste surlignait la page, et la sélection restée en place faisait échouer tous les gestes suivants : **le balayage ne marchait qu'une fois**. Un geste vertical ou oblique sélectionne normalement.
- Seuil souris 110 px (contre 70 au doigt) : à la souris on bouge sans le vouloir.
- **Flèches ← → du clavier** aussi, via le même `slideTab()` — une seule règle pour les trois entrées.
- ⚠️ **Les gestes sont sur le conteneur racine, plus sur `<main>`.** Sur `<main>` ils ne marchaient que là où il y a du contenu : dézoomé, le contenu s'arrête plus haut et glisser dans le vide ne faisait rien. Le garde-fou « surface flottante » (`data-noswipe` ou `position:fixed`) protège toujours la barre du bas et les modales.

---

## 15. Session août 2026 (suite) — ⚠️ LE PIÈGE `updated_at` (à lire avant de déboguer « données vides »)

**La table `app_data` n'a AUCUN trigger : `updated_at` garde la date de CRÉATION de la ligne.** Vérifié en base : `harvest_147827838_listings` portait `updated_at = 7 juillet` alors que `data.capturedAt = 2 août 14h23`. 5 comptes sur 10 étaient dans ce cas.

Deux dégâts, longtemps invisibles :
1. L'extension annonçait « rien capté depuis 25 jours » sur des comptes moissonnés deux heures plus tôt (plainte de Julien, il avait raison).
2. **Bien pire** : cette date sert de **seuil de péremption** (`HARVEST_MAX_AGE_MS` = 12 h) dans `fetchHarvest` / `fetchHarvestOrders`. Une moisson fraîche était donc **jetée**, l'app repartait à vide, et les écrans affichaient « annonces disparues », « compte muet », ventes introuvables.

➡️ **`harvestTs(row)` est LA fonction à utiliser** : elle lit `data.capturedAt` (écrit par l'extension), avec `updated_at` en repli. 7 sites convertis. `storeHarvestRow` écrit maintenant aussi `updated_at` pour que la colonne cesse de mentir aux autres lecteurs (`api/widget.js`…).

### Ventes vides — deux causes cumulées
1. `background.js` rangeait une moisson **VIDE** par-dessus une bonne : une session expirée renvoie `my_orders: []`, pas une erreur. Les 10 comptes avaient fini à zéro vente. **On ne range plus jamais du vide** (`plein(o, cle)`).
2. Côté app, `fetchVintedOrders` prenait `my_orders: []` pour « aucune vente » et **coupait le repli sur le proxy**. Une liste vide n'est plus une réponse.
3. **Filet emails** : `ordersFromEmailSales()` reconstitue des ventes depuis `email_sale_*` (49 en base, tous comptes) au format d'une commande Vinted, dédoublonnées sur `normTitle(titre) + prix`. L'onglet ne peut plus être vide alors que les ventes existent. Les emails ne remplacent jamais une vraie commande (elle porte le vrai statut et le vrai n° de transaction).

### Bordereaux
- Tri **strictement chronologique**. Avant, `isBordDone` passait en premier critère : imprimer un bordereau le faisait sauter en bas et la liste ne suivait plus l'ordre d'arrivée.
- Le titre annonce le nombre **affiché**, pas le total — il disait « 51 » au-dessus d'une liste filtrée, d'où « il en manque ».
- ⚠️ `bordShipped()` dépend de `soldByTxn`, donc **des ventes**. Tant que les ventes étaient vides, aucun bordereau n'était auto-marqué expédié : ils restaient tous dans la liste. Corrigé en amont par les ventes.

### État vérifié en base (2 août 2026)
| donnée | constat |
|---|---|
| annonces moissonnées | 8 comptes /10 à moins de 6 h ; 1 à 3 j ; 1 mort (0 annonce, 26 j) |
| ventes moissonnées | **542, fraîches (0,2–0,5 j)** — voir la correction en section 21 |
| `email_sale_*` | 49, jusqu'au 1er août |
| `email_bord_*` | 51 — 40 avec n°, 51 avec transaction, 50 avec PDF |
| `email_track_*` | 61 — 0 `qrB64`, **11 `qrUrl` (tous Chronopost)**, 16 codes de retrait |
| lieu de retrait | **48/61 vides**, 11 mal découpés (« ® MAISON DE LA PRESSE … SUPER PRATIQUE Retr ») |

### PAS RÉSOLU — il faut un email d'exemple (⚠️ voir la correction en section 27)
Le QR authentique n'est **jamais** capté (0/61) et le point relais est vide 48 fois sur 61. Le code d'extraction (`api/email-inbound.js`, `extractQr` + parsing `lieu`) existe et l'app affiche déjà le vrai QR quand il est là (`qrB64` → `qrUrl` → repli généré). **Le problème est en amont, dans le découpage de l'email.** Écrire des regex sans voir le HTML réel serait deviner. ➡️ Demander à Julien de **transférer un email Mondial Relay « colis disponible » brut** pour caler l'extraction sur du vrai.

---

## 16. Session août 2026 (suite) — le bug « liste vide » était partout

`fetchVintedOrders`, `fetchVintedListings` **et** `fetchVintedConversations` prenaient tous une moisson **vide** pour une réponse valable, au lieu de « rien capté ». Corrigé aux trois endroits (`&& X.length > 0`). C'est ce qui déclenchait les bandeaux « compte muet » et « annonces disparues » alors que les annonces étaient bien en ligne — combiné au piège `updated_at` de la section 15, l'app se vidait toute seule.

**Règle à retenir : une liste vide n'est jamais une réponse.** Une session expirée, une page pas encore ouverte ou un appel refusé renvoient `[]`, pas une erreur.

### Écran Annonces épuré
Les trois bandeaux d'alerte (compte muet / annonces disparues / compte bloqué) s'empilaient en permanence au-dessus de la grille — « il faut trop glisser pour voir les annonces ». Ils sont derrière une ligne repliable « ⚠️ N signalements » (`diagOpen`), affichée seulement s'il y a vraiment quelque chose. Les puces de visibilité par compte restent visibles (c'est une commande, pas une alerte).

### Point relais : vérifié, la donnée n'existe QUE dans l'email
- `cleanLieu()` **fonctionne** — testé sur les 61 lignes réelles : « ® MAISON DE LA PRESSE 40 RUE DU PORT 35260 CANCALE SUPER PRATIQUE Retrou… » → `{nom:"Maison de la Presse", adresse:"40 Rue du Port, 35260 Cancale"}`. Ce n'est donc **pas** le nettoyage qui est en cause.
- **Seules 12 lignes sur 61 portent un lieu**, et toutes disent « Maison de la Presse » — d'où la plainte « il n'y a pas que Maison de la Presse ». Le problème est en amont : `api/email-inbound.js` n'extrait le lieu que d'un seul format d'email.
- **Vérifié : Vinted ne donne pas le point relais.** Les 26 lignes `harvest_*_txn_*` ont un `shipment` réduit à `{id, status, status_title, status_updated_at}` ; aucun champ pickup / drop_off / adresse dans toute la transaction. ➡️ **Il faut vraiment un email brut** pour aller plus loin.

### « Colis retiré » automatique : déjà en place, c'était le harvest qui manquait
`isAtRelayStatus` exige « déposé » + « point relais / bureau de poste ». Dès que Vinted passe à « Commande livrée ! » (statut vu dans les transactions moissonnées), le colis cesse d'être compté — sans rien faire. Ça ne marchait pas parce que la moisson des achats était **jetée** par le piège `updated_at`. Corrigé en amont.

### Bordereaux sans numéro
11 sur 51 n'ont aucun numéro. La pastille était simplement absente → le bordereau avait l'air normal. Il porte maintenant « N° ? » en orange ; le bouton « Relier » existait déjà juste en dessous.


---

## 17. Session août 2026 (suite) — le QR : par transporteur, et on n'en fabrique plus

Julien : « je n'ai pas de code, j'ai que pour Chronopost » — et surtout « ça me génère le QR code, mais c'est juste une retranscription ». Il avait raison sur les deux.

### Ce que disent vraiment les 61 colis reçus
| transporteur | colis | vrai QR | code retrait | lieu |
|---|---|---|---|---|
| **Mondial Relay** | 39 | **0** | 15 | 13 |
| **Chronopost** | 15 | **11** (`qrUrl`) | 1 | 0 |
| vinted / colissimo / shop2shop | 7 | 2 | 0 | 0 |

➡️ **Le QR n'existe que chez Chronopost**, en image hébergée. **Mondial Relay fonctionne au CODE de retrait**, jamais au QR. Ma conclusion précédente (« 0 vrai QR ») était fausse : il y en a 11, l'app les affichait déjà.

### Ce qui était vraiment cassé
`openQrView` **fabriquait** un QR à partir du n° de suivi quand il n'y en avait pas — un carré que le comptoir ne scanne pas. C'est la « retranscription » dont parlait Julien, et elle faisait perdre du temps au relais.

- **`makeQrDataUrl` et la dépendance `qrcode-generator` sont SUPPRIMÉS.** ⚠️ Ne pas les réintroduire.
- Sans vrai QR, la modale montre **le code en 44 px** (au lieu de 32), le **point relais** (`cleanLieu(...).display`) et un texte qui dit quoi présenter au comptoir.
- Si l'image Chronopost hébergée ne charge pas, on bascule sur le code — plus jamais sur un QR fabriqué.
- Ni QR ni code ⟹ on affiche le **numéro de colis** en gros, honnêtement.

---

## 18. Session août 2026 (suite) — ⚠️ LA PAGINATION DU DRESSING (508 annonces invisibles)

**Constaté en base** : le compte `199082413` annonce `total_entries = 604` sur **7 pages**, et la moisson n'en contenait que **96** — la première page. Les 96 captées étaient **toutes en ligne**, donc les 508 autres n'ont jamais été vues par l'app.

Conséquences : bandeau « annonces disparues », numérotation faussée (le pool de numéros libres se calcule sur `annBase`), taux d'écoulement faux, stats fausses.

**Vinted plafonne `per_page` autour de 96**, même quand on demande 100 ou 200. Il FAUT donc paginer. Quatre chemins récupéraient le dressing, **tous en page 1** — les quatre sont corrigés :

| fichier | fonction | avant | après |
|---|---|---|---|
| `background.js` | `refreshAccount` (jetons) | page 1, `per_page=100` | `fetchAllWardrobe()` — toutes les pages |
| `background.js` | version cookies | page 1 | `fetchAllWardrobe()` |
| `background.js` | `activeFetchAll` (dans la page) | page 1 | boucle jusqu'à `total_pages` |
| `inject.js` | capture passive | page 1, `per_page=200` | boucle jusqu'à `total_pages` |
| `src/App.jsx` | `fetchVintedListings` (proxy) | **page 1, `per_page=40`** | boucle, `per_page=100` |

Garde-fou à 10 pages partout, avec une pause (1,2 s côté extension, aléatoire côté page) pour garder un rythme de navigation humaine.

⚠️ **Il faut recharger l'extension dans Chrome** (`chrome://extensions` → ⟳) pour que la moisson complète parte. Version bumpée à **4.23.0**.

### Ce que `total_entries` compte vraiment
Le dressing contient **tout l'historique**, pas seulement le stock en ligne. Répartition réelle des articles captés :
| compte | captés | en ligne | fermés/vendus |
|---|---|---|---|
| 3156028798 | 95 | 8 | 87 |
| 147827838 | 54 | 2 | 46 (+6 masqués) |
| 199082413 | 96 | **96** | 0 |
| autres | 61 | 13 | 48 |

⚠️ **CORRECTION (Julien avait raison) — il n'y a PAS 508 annonces en ligne cachées.**
J'avais déduit « la page 1 est 100 % en ligne, donc les suivantes le sont aussi ». C'est faux :
le dressing est trié **actifs d'abord**, donc une page 1 entièrement active est le comportement
NORMAL, et les 508 suivantes sont selon toute vraisemblance l'historique vendu (comme sur les
autres comptes : 87 fermés sur 95, 46 sur 54). **On ne sait pas** combien des 508 sont en ligne
tant que les pages n'ont pas été lues — c'est justement ce que la pagination corrige.
La pagination reste nécessaire (l'historique sert à retrouver une vente par son titre), mais
elle ne « récupère » pas un stock caché.

---

## 19. Session août 2026 (suite) — audit de la numérotation contre la vraie base

État réel au 2 août (ligne `main`, 118 Ko, `vinted_annonce_numeros` = 177 entrées / 69 Ko) :

| mesure | valeur |
|---|---|
| annonces en ligne | 119 |
| numéros occupés par une annonce en ligne | 119 |
| annonces en ligne **sans** numéro | **0** |
| numéros attribués en tout | 177 (58 concernent des annonces qui ne sont plus en ligne) |
| plage | 1 → **181** |
| trous dans 1..181 | **62** |
| numéros en double | 1 (le **N°1**) |

**Le doublon du N°1** oppose « adidas spezial bleu marine taille 36 » (en ligne) et « basket philippe model bleu taille 38 » (plus en ligne) : **aucun risque d'expédition aujourd'hui**, la seconde n'existe plus.

### Deux garde-fous ajoutés dans les signalements de l'écran Annonces
1. **`numDoublons`** — deux annonces **EN LIGNE** portant le même numéro = deux paires dans la même boîte, donc la mauvaise chaussure part à l'expédition. Rien ne le détectait (le Garage ne voyait que les doublons de case). Panneau rouge, barre de résumé en 🚨, **dépliage automatique**, et un bouton « → N°X » qui bascule une des deux sur le plus petit numéro libre.
2. **Numéros trop hauts** — « pourquoi N°156 alors que j'ai à peine 50 paires ». L'outil « 🔢 Renuméroter à la suite » existait mais était enfoui dans « ⋯ Outils ». Il est maintenant proposé dès que l'écart dépasse 15 numéros perdus, avec le chiffre exact (« jusqu'à 181 pour 119 paires, 62 libres »).

### ⚠️ PIÈGE TDZ — rencontré une deuxième fois, à ne pas refaire
Un `useMemo` placé **avant** la déclaration d'un `const` qu'il lit plante l'app au premier rendu (`Cannot access 'X' before initialization`, écran blanc) : la fabrique du `useMemo` s'exécute immédiatement, pas plus tard. `numDoublons` lisait `annBase`, déclaré 20 lignes plus bas. **Toujours placer un `useMemo` après tout ce qu'il lit** — le build ne le voit pas, seul un rendu réel le révèle. (Même piège déjà noté pour `disparues`/`pairsLost`.)

---

## 20. Session août 2026 (suite) — vérification de bout en bout avec les VRAIES données

Méthode : Playwright + interception des appels Supabase, alimentés par des copies réelles de la base (annonces, ventes, achats, inbox, profils, emails, ligne `main`). But : voir l'app telle que Julien la voit, au lieu de vérifier fonction par fonction. **À refaire à chaque gros changement** — c'est ce qui a révélé les points ci-dessous.

⚠️ **Deux pièges du banc de test lui-même** (sinon on mesure un artefact) :
1. `detectSchema()` sonde `select=owner` : le mock doit répondre **400**, sinon l'app se croit cloisonnée et affiche l'écran de connexion.
2. **Servir TOUTES les familles de lignes.** Sans les `harvest_*_inbox`, le banc simulait 8 comptes sans boîte de réception et comptait 16 appels Vinted fantômes. Avec les vraies lignes : 2.

### Résultat : l'app fonctionne
| écran | ce qui s'affiche |
|---|---|
| Ventes | **44 ventes en cours, ≈1204 €** — le filet email marche, l'onglet n'est plus vide |
| Bordereaux | 6 à imprimer, 50 reçus, **43 auto-marqués expédiés** (avant : les 51 restaient) |
| Achats | 3 colis à retirer, **« Maison de la Presse — 40 Rue du Port »** + code 077831, sans QR fabriqué |
| Annonces | 8 comptes chiffrés, 2 signalements |

### ⚠️ Régression que j'avais introduite : 21 appels Vinted au démarrage
La règle « une liste vide n'est pas une réponse » (section 16) faisait retomber sur le proxy pour **chaque compte** dont la moisson était vide → **21 appels depuis l'IP Vercel à chaque ouverture**, dont 16 sur l'inbox alors que l'écran Messages n'était même pas ouvert. C'est très exactement le motif « multi-comptes piloté par un robot » que Vinted détecte (section 5).

**Distinction posée** — elle vaut pour tout nouveau `fetchVinted*` :
- **ligne ABSENTE** (`h == null`) = compte jamais moissonné → on tente le proxy, sinon un compte neuf n'afficherait jamais rien ;
- **ligne PRÉSENTE mais vide** → on renvoie `{ items: [], source: 'harvest-vide' }` **sans appeler Vinted**. Les données viennent des emails, et « Synchroniser » (`opts.force`) reste là pour forcer.

Appliqué aux commandes ET aux conversations. **Mesuré : 21 → 7 appels**, les 7 restants correspondant à des lignes réellement absentes.

`ordersFromEmailAchats()` complète `ordersFromEmailSales()` : les 46 reçus `email_achat_*` alimentent l'onglet Achats, pour que couper le proxy ne vide rien.


---

## 21. ⚠️ CORRECTION d'une de MES analyses — les ventes n'étaient PAS vides

Dans la section 15 j'ai écrit « ventes moissonnées : 0 partout ». **C'est faux.** Mon script d'analyse lisait `payload.items` / `payload.orders` alors que les commandes sont sous **`payload.my_orders`** — il comptait donc zéro partout.

Chiffres réels (2 août) : **542 ventes moissonnées**, fraîches de 0,2 à 0,5 jour, sur 8 comptes (320 pour `199082413`, 81, 74, 39, 23…). Statuts : 436 finalisées, 61 remboursements, 24 en acheminement, 11 bordereaux envoyés, 3 retours initiés.

**Ce que ça change dans le diagnostic :**
- La vraie cause de l'onglet Ventes vide est **le piège `updated_at`** (section 15) : cette moisson fraîche était **jetée** par le seuil de péremption de 12 h. C'est ce correctif-là qui soigne.
- Le garde-fou « ne jamais ranger du vide » (extension) et la règle « une liste vide n'est pas une réponse » (app) restent justes, mais ce sont des **ceintures de sécurité**, pas le remède.
- Le filet email (`ordersFromEmailSales`) est un **complément**, pas la source principale.

**Risque de doublon mesuré** : 47 des 49 emails de vente sont reconnus comme déjà présents par la clé `normTitle(titre) + prix arrondi`. Les 2 restants sont un lot Vinted (« 7 Lot 7 articles », 146 €) et une ligne de test. Pas de doublon significatif — mais les lignes issues d'un email portent désormais une pastille **« email »** pour qu'on sache toujours d'où sort une ligne sans statut ni n° de transaction.

**Le panneau « X paires qui te reviennent » est correct** : il dérive de vrais statuts Vinted (remboursements, retours initiés, transactions suspendues), pas d'une erreur de classement.

### Leçon de méthode
Avant d'affirmer « la donnée est vide », **vérifier la clé qu'on lit**. Deux fois de suite dans ce projet, une conclusion alarmante venait de mon propre outil de mesure, pas de la base (ici `my_orders` ; plus haut les `harvest_*_inbox` absents du banc de test qui gonflaient les appels Vinted à 16).

---

## 22. Session août 2026 (suite) — audit croisé de TOUTES les sources

Méthode : un seul script qui recoupe ventes moissonnées / achats / annonces en ligne / bordereaux / numéros / garage, contre la vraie base.

| contrôle | résultat |
|---|---|
| bordereaux sans vente correspondante | **1 / 51** |
| ventes « à expédier » sans bordereau reçu | 6 / 11 (normal : le bordereau arrive après) |
| numéros dans `used` mais nulle part ailleurs | **0** |
| numéros au garage inconnus ailleurs | **0** (le garage est vide : 0 case posée) |
| titres en double parmi les annonces en ligne | 1 titre, 3 annonces |
| **prix d'achat renseignés** | **0 sur 177** ⚠️ |

### ⚠️ LE problème de cohérence : aucun prix d'achat
`buyPrice` est vide sur les 177 entrées, et `vinted_buyprice_by_num` est **vide**. Conséquence : **tout le calcul de bénéfice tourne avec un coût de zéro** — bénéfice = prix de vente, marge ≈ 100 %, « meilleure marque » sans valeur, rapport comptable qui sous-estime les charges. L'app le signale déjà (« X ventes sans prix d'achat — le bénéfice est faux »), donc rien n'est faussement affirmé, mais les chiffres restent inexploitables.

**Association automatique par titre : impossible.** Mesuré — sur 119 annonces en ligne, **1 seule** a un titre identique à un achat (Julien réécrit ses titres à la revente). 28 ventes sur 542 seulement matchent. Ne pas retenter cette piste.

**Ce qui débloque vraiment : le sélecteur d'achat.** Il listait les ~700 achats **par date**, donc retrouver la bonne paire était décourageant — c'est la vraie raison pour laquelle aucun prix n'est saisi. `openPicker` classe désormais par pertinence :
- titre identique **+6**
- même marque **+4**, même taille **+4** (`extractBrand` / `extractSize`)
- prix payé < prix de vente **+1**
- à score égal, le plus récent

Mesuré sur 60 annonces : marque détectée 113/119, taille **119/119** ; 8 annonces n'ont **qu'un seul** candidat « même marque + même taille », la plupart moins de 8, seules 12 n'en ont aucun. Les candidats à score ≥ 8 portent une pastille **« suggéré »**.

### Reste ouvert
- `vinted_stock_vinted` : **1815 entrées** encore synchronisées à chaque sauvegarde pour un écran retiré (13 Ko dans la ligne `main`). À arbitrer avec Julien avant de purger — c'est son historique.

---

## 23. Session août 2026 (suite) — ⚡ LE DÉMARRAGE : 13 s → 0,26 s

« Le chargement des données c'est beaucoup trop long. » Mesuré au banc (section 20) avant de toucher à quoi que ce soit :

| | avant | après |
|---|---|---|
| barre du bas visible | **13 090 ms** | **261 ms** |
| requêtes Supabase | 102 | 62 |
| données téléchargées | **42 Mo** | **1,28 Mo** |

### 1. La vraie cause des 13 s : `authBoot` attendait le réseau
`authBoot` faisait `await Promise.all([detectSchema(), loadAuthSettings()])` **avant le premier rendu**. Tant que Supabase n'avait pas répondu, l'écran restait vide. C'était ça, la lenteur — pas le volume (le chiffre ne bougeait pas entre 42 Mo et 1,28 Mo).
- `loadAuthSettings()` ne sert qu'à dessiner les boutons Google/Discord de l'écran de connexion → **lancé sans être attendu**, il appelle `_emitAuth()` en arrivant pour redessiner.
- `detectSchema()` décide comment on **écrit** → toujours attendu, mais avec `Promise.race` à **4 s** ; au-delà on garde le repli sûr (non cloisonné). Un réseau qui pend ne fige plus l'app.

⚠️ **Ne jamais remettre un `await` réseau sur le chemin du premier rendu.**

### 2. 42 Mo → 1,28 Mo
- **Les PDF des bordereaux** : `fetchEmailBordereaux` faisait `select=data`, or chaque ligne embarque le PDF en base64 **deux fois** (brut + tamponné) — 51 bordereaux = 6 Mo dont **99 % de PDF**, chargés **deux fois** = 12 Mo pour afficher des titres. On projette maintenant les 13 champs utiles (**21 Ko**) ; `fetchBordPdf(rowId)` va chercher le PDF **à l'impression**. `filename` sert de témoin « ce bordereau a un PDF » (vérifié : 50/50, aucun écart).
- **Requêtes en double** : les mêmes lignes moissonnées étaient demandées 24× (annonces) et 32× (commandes) au démarrage. `cachedRow(clé, fn)` partage **la requête en cours**, pas seulement le résultat (TTL 60 s, vidé par « Synchroniser »). 24 → 8.
- **Moisson allégée à la source** (extension `alleger()` dans `storeHarvestRow`) : Vinted renvoie toutes les variantes de photos, traductions, blocs promo. On ne garde que ce que `mapWardrobeItem` lit. Mesuré sur les vraies données, **tous les éléments conservés** :

| | avant | après |
|---|---|---|
| annonces | 7,09 Mo | 0,15 Mo (−98 %) |
| ventes | 0,69 Mo | 0,24 Mo (−65 %) |
| achats | 0,79 Mo | 0,29 Mo (−64 %) |
| messages | 0,74 Mo | 0,10 Mo (−86 %) |

Les anciennes lignes restent lisibles (on enlève des champs, on n'en renomme aucun) et s'allègent à la prochaine moisson. **Extension 4.24.0 — à recharger dans Chrome.**

### Vérifié
Rendu réel avec les données allégées : Annonces (96 pour shop_cancale), Ventes, Achats (3 colis, code 077831), Bordereaux (6 à imprimer / 50 reçus) — identiques à avant, zéro erreur.

---

## 24. Session août 2026 (suite) — bordereaux : plus aucune devinette

Demande de Julien : « je veux que les ventes soient connectées au bordereau grâce à l'extension, et non plus grâce à une imagination de l'application. Mets la photo à côté du bordereau, et le numéro ne le devine pas. »

### Ce qui était « imaginé »
`numForBord` et `bordPhoto` retombaient sur `entryByTitleLoose(titre, taille)` — un rapprochement **par ressemblance de libellé**. Conséquence : un bordereau pouvait être tamponné du numéro d'une **autre paire**, ou afficher la photo d'une autre paire, **sans aucun signalement**. C'est pire que de ne rien afficher.

### Sources retenues, toutes certaines
**Numéro** (`numForBord`) : lien manuel → numéro écrit dans l'email → **n° de TRANSACTION** (bordereau → vente moissonnée par l'extension → annonce verrouillée → numéro). Sinon `''`.
**Photo** (`bordPhoto`) : lien manuel → **vente reliée par transaction** (vraie photo Vinted captée par l'extension) → annonce portant exactement ce numéro. Sinon `null`.

⚠️ **Ne jamais réintroduire le rapprochement par titre dans ces deux fonctions.**

### Mesuré sur les 51 bordereaux réels
| | |
|---|---|
| numéro venu de l'email (certain) | **40** |
| numéro venu de la transaction (certain) | **2** |
| « N° en attente » | **9** |
| **photo réelle via la vente reliée** | **50 / 51** |

Sans lien certain, le bordereau porte une pastille **« N° en attente »** (au lieu de « N° ? ») : il n'est pas oublié, le numéro arrivera tout seul dès que la vente correspondante sera moissonnée. Le bouton « Relier » reste là pour trancher à la main.

### Quand un bordereau sort de la liste (corrigé)
Demande de Julien : « enlève le bordereau une fois marqué expédié, ou je le marque *traité / colis fait* — mais ça ne le supprime pas tant que le colis n'est pas parti dans Vinted. »

**Défaut trouvé** : `isBordDone` incluait `isBordPrinted`. **Sortir le papier de l'imprimante retirait le bordereau de la liste**, alors que le colis n'était même pas préparé — on le croyait traité. 13 bordereaux étaient dans ce cas.

`isBordDone = isBordShippedManual(b) || bordShipped(b)` — deux raisons, et deux seulement :
- **« ✓ Colis fait »**, posé à la main (bouton renommé, `vinted_bords_shipped`, synchronisé) ;
- **Vinted dit que le colis est parti** (`bordShipped` : statut de la vente moissonné par l'extension) — c'est la confirmation qui fait foi.

L'impression garde sa pastille « ✓ Imprimé » mais **ne retire plus rien**. Rien n'est jamais supprimé : « Voir » réaffiche les terminés, et le ✕ (`vinted_bords_hidden`) reste pour masquer un cas particulier.

Mesuré sur les 51 bordereaux réels : 43 confirmés expédiés par Vinted, 2 marqués à la main, **13 impressions qui ne cachent plus rien**.

### Litiges captés par l'extension (v4.25.0)
`inject.js` observe désormais aussi les réclamations, passivement, quand Julien ouvre l'écran « Litiges » ou une conversation en litige :
- `/api/vN/complaints` → ligne `harvest_{uid}_complaints` (la liste) ;
- `/api/vN/complaints/{id}` → ligne `harvest_{uid}_litige_{id}` (le détail).

Aujourd'hui l'app **déduit** les litiges du statut de vente (`saleOutcome` : remboursement / retour initié / suspension) — ça marche, mais sans le motif ni l'état réel de la réclamation. Ces lignes permettront d'afficher le vrai motif et de savoir quand la paire revient. **Côté app : pas encore branché** (rien ne les lit pour l'instant).

### ⚠️ Trou comblé dans l'allègement (section 23)
`alleger()` n'était appliqué que dans `storeHarvestRow` — or la **capture passive** (inject → background, ligne ~217) écrit **en direct** sans passer par cette fonction. La moisson faite en naviguant restait donc énorme (7 Mo d'annonces) alors que la moisson active était allégée. `alleger()` est maintenant appelé sur les deux voies. Un type inconnu (litiges…) passe inchangé — vérifié.

---

## 25. Session août 2026 (suite) — ventes/achats jamais mélangés + un défaut d'affichage localisé

### Confusion ventes ↔ achats : la ligne « générique » en était la cause
Quand Vinted charge `/my_orders` **sans** paramètre `?type=`, la réponse **mélange ventes et achats**. L'extension la rangeait quand même (`harvest_{uid}_orders_all`), et l'app avait un repli `fetchHarvest(uid,'orders')` utilisé **pour les deux** — donc des achats pouvaient s'afficher dans les ventes.

- **Extension** : une réponse `/my_orders` sans `?type=` n'est plus rangée du tout (`return null` dans `matchHarvest`).
- **App** : le repli générique est supprimé. On n'accepte plus que les lignes explicitement `orders_sold` ou `orders_purchased`. (Mesuré : la ligne générique était vide, ce repli ne rapportait rien et ne pouvait que tromper.)

### ⚠️ Débordements : NE PAS corriger par une règle CSS globale
Défaut réel, reproduit au banc (écran 320 px, zoom « Grand ») : sur Ventes et Achats, ~8 textes débordent de leur carte, et l'encart du code de retrait s'effondre au point d'écrire « Donne ce code au comptoir » **une lettre par ligne**.

**Tentative annulée** : `main div, main span, … { min-width: 0 }`. Ça règle bien le cas « `1593,30 €` dans une case de 85 px », mais `min-width:0` **autorise aussi** un conteneur flex à s'effondrer à ~0 px — donc ça n'a pas créé le texte vertical (il préexiste) mais ça ne le soigne pas et ça fragilise le reste. Seul `overflow-wrap: break-word` est conservé (sûr).

➡️ **La bonne correction est locale** : poser `minWidth:0` sur LE conteneur qui doit rétrécir + `overflow:hidden; textOverflow:ellipsis` sur son enfant texte. À faire carte par carte, en vérifiant au banc à 320 px / zoom Grand. Reste à faire : la carte « colis à retirer » (Achats) et les lignes de vente.

### Porte-monnaie : le vrai montant existe, l'app affichait une estimation
Julien : « les montants en attente n'ont pas l'air de correspondre ».

Vinted expose le solde de chaque porte-monnaie, et l'extension le capte déjà (lignes `harvest_{uid}_billing`, quand tu ouvres ton porte-monnaie) :
```
main   = disponible        escrow = BLOQUÉ (l'argent « en attente »)
199082413 : 7,95 € / 57,23 €     3171228253 : 0 € / 29,00 €
```
Total réel bloqué : **86,23 €**. La carte « Argent en route » de l'écran Ventes affichait **≈ 1204 €** — elle additionnait toutes les ventes dont le statut n'est pas « finalisée », or beaucoup de ventes anciennes gardent ce statut alors que l'argent a déjà été versé.

- La carte utilise désormais **`walletEscrow`** (solde réellement bloqué) dès qu'il est connu, et le dit : « Bloqué chez Vinted · lu sur N porte-monnaie ».
- À défaut, elle affiche l'estimation **en l'annonçant comme telle**, avec la marche à suivre (« ouvre une fois ton porte-monnaie sur Vinted »).
- `walletEscrow` était chargé **uniquement** à l'ouverture de la modale Trésorerie ; il l'est maintenant aussi sur Ventes / Ma journée (lecture Supabase légère).

⚠️ 5 comptes sur 7 ont une ligne `billing` **vide** (`{}`) : Julien n'a pas ouvert leur porte-monnaie. Le total réel ne couvre donc que les comptes visités — c'est écrit sur la carte, pas masqué.

### Carte « colis à retirer » : débordement corrigé LOCALEMENT
Le pire cas mesuré (écran 320 px, zoom « Grand ») : « Donne ce code au comptoir » s'écrivait **une lettre par ligne**. Cause : la pastille du code (`flexShrink:0`, 22 px, padding) + l'emoji + les espacements mangeaient toute la largeur, et le bloc texte (`flex:1;minWidth:0`) s'effondrait à ~0 px.

Trois corrections **sur cette carte uniquement** :
1. la rangée passe en `flexWrap:'wrap'` → sur écran étroit la pastille du code **descend à la ligne** au lieu d'écraser le texte ;
2. le bloc texte passe de `flex:1` à **`flex:'1 1 150px'`** → il ne peut plus tomber sous une largeur lisible ;
3. la 3ᵉ ligne reçoit `whiteSpace:nowrap; overflow:hidden; textOverflow:ellipsis` comme ses deux voisines (elle ne les avait pas, d'où le retour à la ligne caractère par caractère).

Vérifié en capture à 320 px / zoom Grand : les trois lignes se coupent proprement, le code reste lisible en 22 px.

⚠️ **Le compteur « textes qui débordent » du banc est trompeur** : `scrollWidth > clientWidth` est **exactement** ce que produit un `text-overflow:ellipsis` volontaire. Il sert à LOCALISER les candidats, pas à valider — **toujours regarder la capture d'écran** avant de conclure.

---

## 26. Session août 2026 (suite) — ⚠️ UN PLANTAGE QUE J'AVAIS LIVRÉ, et la leçon

**`reel is not defined`** : en v63/01, mon édition de la carte « Argent en route » a posé le texte utilisant `reel` mais **la déclaration `const reel = …` n'a jamais été écrite** (le script d'édition a échoué son assertion et s'est arrêté après avoir déjà appliqué une partie). L'app **plantait à l'écran Ventes dès qu'il y a des ventes en cours**.

**Pourquoi le test ne l'a pas vu** : mon test de fumée tourne **sans données** — or la carte retourne `null` quand il n'y a aucune vente en cours. Elle n'était donc jamais rendue.

➡️ **Un test de fumée à vide ne prouve rien sur les écrans conditionnels.** Tout changement dans un bloc `{(()=>{ … })()}` doit être vérifié **au banc avec les vraies données** (section 20), pas seulement au build ni sur une app vide.

### Débordements corrigés (carte par carte, méthode validée)
- **Carte « colis à retirer »** (section 24) : `flexWrap` sur la rangée, `flex:'1 1 150px'` sur le bloc texte, `nowrap+ellipsis` sur la 3ᵉ ligne.
- **Pastilles des lignes de vente** : elles n'avaient pas `flexShrink:0`, donc elles étaient **écrasées à 0 px** au lieu de passer à la ligne (la rangée a pourtant `flexWrap`). 6 pastilles corrigées (date, étape de vente, garage, litiges).
- **`StatBox`** : un montant se coupait au milieu (« 1593,3 » puis « 0 € »). La valeur passe en `whiteSpace:nowrap` + `clamp(15px, 5.2vw, 20px)` : elle rétrécit un peu plutôt que de se casser en deux.

### Reste à faire (mesuré, pas corrigé)
La **ligne de vente elle-même** se chevauche encore à 320 px en zoom Grand (le prix passe par-dessus « achat ? »). Même méthode : `flexShrink:0` sur ce qui ne doit pas rétrécir, largeur plancher sur le bloc texte, vérification en capture.

### « L'extension n'a pas moyen de capter tout Vinted sans que j'ouvre tout ? » — si
Il y a **deux modes** dans l'extension, et la confusion venait de là :
- **capture PASSIVE** (`inject.js`) : elle ne voit que ce que la page charge déjà. Zéro requête ajoutée, donc invisible — mais elle ne connaît que les écrans réellement ouverts. C'est pour ça que 5 porte-monnaie sur 7 étaient vides.
- **moisson ACTIVE** (`activeFetchAll` dans `background.js`) : l'extension appelle elle-même les endpoints **depuis le navigateur de Julien**, sur un onglet vinted.fr où il est déjà connecté. Même IP, même session, même empreinte qu'une visite normale — c'est le mode discret voulu (section 5), à l'opposé du proxy Vercel.

Elle allait déjà chercher : `users/current`, le dressing (toutes les pages), `my_orders` ventes + achats, `inbox`. **Il manquait le porte-monnaie.**

➡️ Ajout de **`/api/v2/users/{profileId}/payouts`** (endpoint trouvé dans les lignes `harvest_*_wreq_*` déjà captées) → rangé en `harvest_{uid}_billing` dès qu'il porte un montant. Julien n'a plus besoin d'ouvrir le porte-monnaie de chaque compte. **Extension 4.26.0.**

⚠️ Le solde n'est **pas** une liste : le garde-fou `plein(o, cle)` ne s'applique pas, on teste `main || escrow`.

### Ligne de vente : dernier débordement corrigé
La rangée (photo 56 px + bloc texte + prix) n'avait pas `flexWrap` : à 320 px en zoom Grand, le bloc texte était comprimé jusqu'au chevauchement (« 18,00 € » par-dessus « achat ? »).
- rangée → `flexWrap:'wrap'` ;
- bloc texte → `flex:'1 1 140px'` (plancher lisible).

Vérifié en capture : titre coupé net, pastilles qui passent à la ligne, prix et boutons chacun à leur place.

**Le schéma est le même partout, il est maintenant validé sur 3 cartes** :
1. `flexWrap:'wrap'` sur la rangée → ce qui ne rentre pas descend au lieu d'écraser ;
2. `flex:'1 1 <plancher>px'` sur le bloc texte → il ne peut plus tomber à 0 ;
3. `flexShrink:0` sur les pastilles/pastilles-prix, `nowrap+ellipsis` sur chaque ligne de texte.


---

## 27. ⚠️ CORRECTION — il n'y a PAS de QR Mondial Relay à extraire

Julien : « il n'y a pas de QR code Mondial Relay, c'est que Chronopost. Si on veut un QR c'est directement dans l'app Mondial Relay. »

**Il a raison, et ça invalide une demande que j'ai répétée plusieurs fois.** Je réclamais un email Mondial Relay brut « pour finir l'extraction du QR » — **ce QR n'existe pas dans l'email**. Les chiffres le disaient déjà (39 colis Mondial Relay, **0 QR**, 15 codes de retrait) : j'ai lu ça comme « extraction ratée » alors que c'était **le fonctionnement normal du transporteur**.

| transporteur | mécanisme de retrait |
|---|---|
| **Mondial Relay** | **CODE de retrait** + pièce d'identité. Le QR, si on en veut un, est dans **leur application**. |
| **Chronopost** | QR en image hébergée (`qrUrl`), 11 sur 15 |

➡️ La modale de retrait propose désormais un bouton **« 📱 Ouvrir Mondial Relay (QR) »** (via `trackUrl`) plutôt que de faire semblant d'en fabriquer un, et le texte dit « Mondial Relay fonctionne au CODE, pas au QR ».

**Ce qui reste vraiment ouvert** : le **point relais** (nom/adresse), vide dans 48 emails sur 61. Là, un email brut aiderait encore — mais **uniquement pour le lieu**, plus pour le QR.

### Leçon (la quatrième de cette session)
Un chiffre à zéro n'est pas forcément une panne : ça peut être le comportement normal du système observé. Avant de conclure « l'extraction échoue », demander **comment ça marche en vrai** — Julien le savait, moi non.
---

## 28. Session août 2026 (suite) — RETRAIT PAR TRANSPORTEUR, une seule règle

« Fais ça avec Mondial Relay, Chronopost, UPS, Vinted Go, tout, à la perfection. »

Chaque transporteur a SA façon de remettre le colis. Vérifié sur les 61 vrais colis :
| transporteur | colis | QR | code | méthode réelle |
|---|---|---|---|---|
| Mondial Relay | 39 | **0** | 15 | **CODE** + point relais |
| Chronopost | 15 | **11** | 1 | **QR** (image hébergée) |
| Vinted Go | 3 | 2 | 0 | QR |
| Colissimo | 3 | 0 | 0 | domicile (rien à retirer) |
| Shop2Shop | 1 | 0 | 0 | code |

### La règle unique : `CARRIERS[x].retrait` + `retraitMode(t)`
Chaque transporteur porte un champ **`retrait`** : `'qr'` (Chronopost), `'code'` (Mondial Relay, Relais Colis, Shop2Shop, InPost, Amazon, GLS), `'auto'` (Vinted Go, UPS, DPD, DHL, FedEx — QR si fourni sinon code), `'home'` (Colissimo — livraison).

**`retraitMode(t)`** croise cette préférence avec ce qu'on a REÇU et renvoie `{mode:'qr'|'code'|'numero'|'home', …}`. Si le transporteur préfère un QR qu'on n'a pas, il retombe sur le code, jamais sur un QR fabriqué (cf. section 17). Testé unitairement sur 9 cas, chacun résout au bon mode.

La modale de retrait (`openQrView`) et son texte de consigne dérivent **uniquement** de `retraitMode` — plus aucune logique QR/code éparpillée. Le message est par transporteur : « Chronopost — présente le QR », « Mondial Relay fonctionne au CODE », « La Poste livre à ton adresse : rien à retirer ».

⚠️ **Ne jamais afficher un QR pour Mondial Relay** : il n'en met aucun dans ses emails (Julien : « c'est que Chronopost »), le QR MR vit dans leur app, inaccessible.

---

## 29. Session août 2026 (suite) — ⚠️ « Impossible de charger » après 12 h d'inactivité

Découvert en rendu réel : l'écran **Messages** (et potentiellement Annonces/Ventes) affichait « Impossible de charger ces données » alors que les conversations étaient **parfaitement présentes** en base — juste capturées il y a 19 h.

**Cause** : `HARVEST_MAX_AGE_MS` (12 h). Une fois passé ce délai, `fetchHarvest` renvoyait `null` (« trop vieille »), l'app croyait la ligne absente, tentait le proxy (bloqué / vide en profil discret) → état d'erreur. Donc **dès que Julien n'ouvrait pas Vinted pendant une demi-journée, ses messages passaient en erreur** — et ça relançait un appel proxy par compte, le trafic qu'on fuit.

**Le seuil de 12 h n'était piloté par personne** : aucun appelant ne passait `opts.maxAgeMs`, c'était un rejet aveugle par défaut.

➡️ **On ne jette plus une moisson datée.** `fetchHarvest` / `fetchHarvestOrders` ont leur défaut passé de `HARVEST_MAX_AGE_MS` à `0` (pas d'expiration). Une donnée un peu vieille **s'affiche** (mieux qu'une erreur), la fraîcheur reste connue (`_harvestSeen`, popup, badge) et **« Synchroniser »** (`opts.force`) rafraîchit. Un appelant qui exigerait de la fraîcheur peut encore passer `opts.maxAgeMs` explicitement. Constante `HARVEST_MAX_AGE_MS` supprimée.

Vérifié : Messages passe de « Impossible de charger » à 29 conversations affichées (pseudo, article, prix, compte), **zéro appel proxy**.

---

## 30. Session août 2026 (suite) — Messages = juste « il y a du nouveau »

Demande de Julien : « améliore, limite enlève les messages, tu mets juste qu'il y en a de nouveaux mais c'est tout ».

L'onglet Messages **ne déroule plus la liste des conversations**. À la place, une **seule carte de résumé** (`curSub==='messages'`, ~ligne 12139) :
- `nonLus` = conversations non lues de comptes actifs (`!acctOffOf(c) && c.unread`) → titre « X nouveaux messages » / « Aucun nouveau message » ;
- `total` = conversations en tout → sous-titre « X conversations en tout » ;
- un lien **« Répondre sur Vinted »** (`https://www.vinted.fr/inbox`, `target=_blank`) — répondre depuis l'app reste impossible (section 5).
- La section **⚡ Réponses rapides** (modèles copiables) est **conservée** au-dessus.

Le sous-titre du `ScreenHead` est passé de « Les conversations… en lecture » à « On te dit juste s'il y a du nouveau ».

⚠️ **`msgAcc` (sélecteur de compte) et `openConversation` (modale de lecture) ne sont plus appelés** par cet onglet — laissés en place (aucune erreur, la modale `openConversation` sert peut-être ailleurs) mais l'onglet ne s'en sert plus. Le calcul du delta de notification (`vintedNotif`, bandeau d'ouverture) est indépendant et **inchangé** : il lit toujours la moisson des conversations, pas cet écran.

Vérifié en rendu réel (banc section 20, écran 400 px) : « 36 nouveaux messages / 213 conversations en tout » + bouton, réponses rapides au-dessus, **zéro erreur de page**. `BUILD_ID = v68/00`.

---

## 31. Session août 2026 (suite) — Atelier de republication + première brique IA (RESELL AI)

Julien a envoyé un « cahier des charges niveau startup » (RESELL AI, 15 modules) puis, en priorité, le **module Republication intelligente**. Constat posé avec lui : **~10 des 15 modules existent déjà dans VRM** (dashboard, stock/ERP, rapport financier, conseils prix/qui-dorment, multi-plateforme LBC…). Ce qui manquait vraiment = **une vraie IA branchée** (les modules « l'IA explique / réécrit / score » ont tous besoin d'un LLM). Décision : construire l'**atelier de republication** en entier, dont tout le **calcul est réel**, et poser la **tuyauterie IA** pour la rédaction (optionnelle, sans clé → dégradation propre).

### Nouvel onglet « Republier ✨ » (`cat_repub` → `only='republication'`)
Un onglet dédié dans `BOTTOM_TABS`, rendu par `Comptabilite` comme les autres catégories. Icône au trait `spark` ajoutée à `ICON_PATHS`.

### Note d'annonce — `scoreAnnonce(it, override?)` — 100 % CALCULÉE
Part de 100, **retire** des points pour chaque défaut RÉELLEMENT constaté (champ présent) : titre pauvre (mots, marque/taille absentes, état), fiche incomplète (`photoCount<3`, marque/taille manquante, `descLen<20`), âge (`listedAgeDays` : dort 30/60/90 j), engagement (vues sans favori, peu vue), prix vs paires comparables (`peerPrice` = médiane même marque+taille EN LIGNE, ≥2 paires). **Un champ absent ne retire jamais de point** (pas de faux procès). Renvoie `{score, cls:'top'|'mid'|'low', problems[], advice[], peer, age}`. `cls` : ≥80 top / 55-79 mid / <55 low.
- `repubList` (useMemo) = toutes les annonces `annBase` notées, **triées pire→meilleur** (« voici les annonces avec le plus gros potentiel »). Placé APRÈS `annBase`/`peerPrice`/`scoreAnnonce` (piège TDZ, cf. §19).
- File de travail : chips Toutes / 🔴 Haute (low) / 🟠 Moyenne (mid) / 🟢 OK (top) + bandeau note moyenne / à retravailler.

### Éditeur de nouvelle version (`repubEdit`/`repubForm`, modale)
Titre + description + prix. **Comparaison de score en direct** (Actuelle → Nouvelle, +/−). Conseils calculés (`before.advice`). **Historique des versions** (`vinted_annonce_drafts`, clé = id d'annonce → `{title,desc,price,versions[],updatedAt}`, **synchronisé**). Bouton « Enregistrer la version » + lien « ↗ Vinted » (l'app ne publie pas ; Julien applique sur Vinted — pas d'écriture Vinted auto, cf. §5).
- ⚠️ **Piège corrigé** : le brouillon pré-remplit la description à VIDE, or l'extension ne garde que `descLen` (pas le texte). Sans garde-fou, la « nouvelle version » démarrait pénalisée « pas de description » et paraissait **pire** que l'actuelle (−11). Correctif : dans `scoreAnnonce`, tant que la description du brouillon est vide, on garde `it.descLen` d'origine. Vérifié au banc : 51 → 51 tant qu'on ne change rien.

### Brique IA — `api/ai.js` (serverless) + `aiRewrite` (app)
Réécrit titre + description à partir des VRAIES caractéristiques (consigne stricte : **ne rien inventer**). Modèle par défaut `claude-haiku-4-5-20251001` (`AI_MODEL` configurable). **Clé jamais dans le repo/l'extension** : lue depuis `AI_API_KEY` (env Vercel, recommandé) sinon depuis une clé perso locale (`vrm_ai_key`, **PAS dans SYNC_KEYS** — secret par appareil). Sans clé → `{ok:false, reason:'no-key'}` : l'app le dit, garde les suggestions calculées, ne fabrique rien. Réglages → **Assistant IA** (`AiKeySetting`) : statut « branchée / non branchée » (ping GET `/api/ai`) + champ clé si pas d'env serveur.
- **Pour activer la rédaction IA** : ajouter `AI_API_KEY` (clé Anthropic `sk-ant-…`) dans les variables d'environnement Vercel du projet, OU la coller dans Réglages → Assistant IA.

### Vérifié au banc (section 20, données réelles, 400 px)
Onglet Republier : note moyenne + file par priorité + cartes (score, problèmes détectés, bouton). Éditeur : comparaison de score, champs, conseils, bouton IA (avec fallback « non branchée »). **Zéro erreur de page.** `BUILD_ID = v69/00`.

### Reste du cahier des charges (pas fait, honnête)
Analyse **photo** par vision IA (module 6), CRM client détaillé (module 9), mémoire IA de stratégie (module 11), abonnements Free/Pro/Business (module 14) : non faits — soit ils dépendent d'un LLM vision/branché, soit c'est un chantier à part. À reprendre brique par brique une fois l'IA active en prod.

---

## 32. Session août 2026 (suite) — Republication ASSISTÉE dans l'extension + ⚠️ refus tenus

### ⚠️ Ce que Julien a redemandé et que je REFUSE (final, comme les refus précédents)
Julien veut republier ses annonces **en masse depuis l'extension**, et a explicitement demandé une **file d'attente qui s'exécute seule avec des délais aléatoires (10-20 s)** entre chaque republication, « faire à ma place ». **Refusé.** Un délai aléatoire n'a qu'un seul but : **tromper la détection bot de Vinted**. Republier 20 annonces en rafale (même présent, même depuis son navigateur) = la signature exacte que Vinted sanctionne — c'est ce qui a **bloqué `vanessa5723`**. Ce n'est PAS une question de coût. Refus constant : pas d'auto-republication en file/minuterie, pas de délais « faussement humains », pas d'envoi de messages automatisé, pas de modification de photos pour esquiver la détection de doublon.

### Ce qui a été construit à la place (sûr, dans l'extension — v4.27.0)
Onglet **« Republier ♻️ »** dans le panneau VRM sur Vinted (`vinted-panel.js`, `renderRepublier`/`wireRepublier`) :
- liste des annonces **en ligne** (lues via `buildPanelData().online`, 0 requête Vinted) avec **cases à cocher** ; « tout cocher / décocher » ;
- bouton **« Commencer (N) »** → **défilement UNE-PAR-UNE** (`repubRun = {queue, idx}`) : le panneau **ouvre** chaque annonce sur Vinted (`window.open`), **Julien republie lui-même** (bouton natif Vinted), puis **« Suivante ▶ »**. 
- **Aucune requête envoyée à sa place, aucune file auto, aucun délai.** C'est ce qui le rend sûr. Les vendues ne sont pas listées (on ne republie pas une paire vendue — sauf litige, à voir plus tard).

### ⚠️ Bug vente↔achat corrigé (encore) — « Adidas spezial North high 35 » (une VENTE) tombait dans les Achats
Cause racine dans **`api/email-inbound.js`** : la branche ACHAT (2b, AVANT la branche vente) matchait le motif **« ta commande » nu** — or les emails **côté vendeur** disent aussi « ta commande » (« Prépare ta commande », « ta commande est à expédier »). Une vente était donc classée `email_achat_*`.
- **Source** : ajout d'un garde-fou `cotéVendeur` (`/vendu|a acheté ton article|prépare ta commande|à expédier|bordereau d'envoi|ton article/i`) qui EXCLUT tout signal vendeur avant de classer en achat ; motifs « ta commande » nu et « récapitulatif de commande » retirés (envoyés aussi au vendeur).
- **Nettoyage des lignes déjà mal rangées** (App.jsx `loadOrders`, filet emails achats) : on écarte un achat **venu d'un email** (`_fromEmail`) dont **titre + prix** correspondent EXACTEMENT à une **vente** (`sales.items`) — on n'achète/revend pas la même paire au même prix. Les vrais achats moissonnés (vrai n° de transaction) ne sont jamais touchés. Vérifié au banc : Ventes/Achats, zéro erreur.

---

## 33. ⚠️ Session août 2026 (suite) — SOURCE UNIQUE = VINTED VIA L'EXTENSION (annule le « CA = email_sale » de §10)

Demande explicite de Julien : « toutes les données à partir de maintenant tu les récupères dans Vinted avec l'extension ». Motif : les reconstructions par emails produisaient des **erreurs de classement** que la moisson n'a pas (Vinted classe lui-même achat vs vente).

**Vérifié EN DIRECT sur la vraie base** (clé anon publique, lecture REST — c'est comme ça qu'on arrête de deviner) :
- `email_achat_*` : **47 lignes, seulement 11 vrais achats** (« Ton reçu pour la commande … »). Les 36 autres = emails de STATUT (16 « Confirmation requise », 18 « Commande mise à jour », 2 « Retourne ta commande ») mal classés → polluaient les Achats. Ex. « Adidas Spezial North high 35 » (que Julien signalait comme une vente) n'existait NI dans `orders_purchased` NI dans `orders_sold` moissonnés : uniquement dans ces emails « Confirmation requise ».
- `harvest_*_orders_purchased` : **434 vrais achats, dont 106 Adidas Spezial** — Julien en achète énormément pour revendre, c'est NORMAL d'en voir beaucoup dans les Achats.
- CA du mois en cours : `orders_sold` **finalisés** = 0 € en août (une vente ne se finalise qu'~2 semaines après). Par **DATE de vente** (hors annulées) = **17 ventes / 437,60 €**, alors que `email_sale` n'en voyait que 12 / 308,60 €. Donc la moisson par date est **plus complète** que les emails.

### Ce qui a changé dans `App.jsx`
1. **`loadOrders` (ventes ET achats)** : le **filet emails est SUPPRIMÉ**. Les onglets Ventes/Achats ne lisent plus QUE la moisson (`fetchVintedOrders` → harvest, classification Vinted). Un onglet peut être momentanément vide si l'extension n'a pas encore moissonné → « Synchroniser » force, ou repasser sur vinted.fr.
2. **`ordersFromEmailAchats`** garde un garde-fou `estVraiAchat` (sujet = vrai reçu d'achat) au cas où il resservirait, mais il n'est plus appelé par `loadOrders`.
3. **CA/ventes du mois (`liveStats`, dashboard)** : ⚠️ **ANNULE §10/§15/§21** qui prenaient `email_sale`. Désormais calculé sur la **moisson `orders_sold` par DATE de vente** (hors annulées), y compris les ventes pas encore finalisées — sinon le mois en cours affichait ~0 €. `ventesJour`/`caJour` idem. Le recalcul email a été retiré.

⚠️ **Ne pas revenir aux emails pour les ventes/achats/CA** sans raison forte : c'était la source des faux achats. Les emails restent utilisés pour ce que la moisson ne donne pas (bordereaux PDF, suivi colis, factures Gmail/Apps Script — §3), pas pour classer achats/ventes.

### Reste (pas fait, à voir avec Julien)
- `api/widget.js` : lit encore `email_sale` pour son propre calcul du mois. Le widget devrait lire `widget_stats` (publié par l'app, désormais harvest). À aligner si le chiffre du widget diverge.

---

## 34. ⚠️ Session août 2026 (suite) — QUOTA SUPABASE EXPLOSÉ : le widget retéléchargeait les PDF

Julien a reçu un mail Supabase : **org « cancale » a dépassé son quota de bande passante (égress) du mois — 5,74 Go sur 5,5 Go** (offre gratuite). Jusqu'au **24 août 2026**, Supabase **jette / limite les requêtes** → l'app charge mal, par intermittence.

### Cause (trouvée en lisant le code, pas en devinant)
`api/widget.js` (endpoint du **widget iPhone Scriptable**, rafraîchi TOUT SEUL 24h/24) **et** `api/ship-reminders.js` (cron quotidien) faisaient `select=data` sur les lignes `email_bord_*`. Or **chaque bordereau embarque son PDF en base64 DEUX fois** (brut + tamponné) — ~6 Mo au total pour ~50 bordereaux — alors que ces endpoints n'en lisent que `dateLimite`, `transaction`, `suivi`, `numero`.

➡️ Le widget se rafraîchissant en permanence, ces **~6 Mo repartaient à chaque rafraîchissement** = plusieurs Go/mois = quota crevé **sans que Julien fasse quoi que ce soit**. C'est **exactement** le piège corrigé côté app en §23 (`fetchEmailBordereaux` projette 13 champs, 21 Ko), **jamais reporté dans ces deux endpoints serveur**.

### Correctif
Les deux endpoints projettent maintenant les 4 champs scalaires utiles :
`select=dateLimite:data->>dateLimite,transaction:data->>transaction,suivi:data->>suivi,numero:data->>numero`
→ **~6 Mo → ~1 Ko par appel**. (Syntaxe alias+flèche déjà éprouvée dans App.jsx, ex. `cap:data->>capturedAt`.)

### ⚠️ Important — le correctif arrête l'hémorragie, il ne DÉBLOQUE pas le mois en cours
Le quota du cycle est déjà dépassé → Supabase reste restreint **jusqu'au refill du 24 août**, correctif ou pas. Deux issues, à trancher avec Julien :
1. **Attendre le 24** (gratuit) : le compteur repart à zéro, et grâce au correctif ça ne se reproduit plus.
2. **Passer Supabase en Pro** (~25 $/mois) : débloque tout de suite + quota large. Décision argent de Julien.

### Reste à surveiller (secondaire, pas corrigé)
- `api/widget.js` fait encore `harvestOrders('sold')` + `('purchased')` en `select=data` (tableau `my_orders`) : ~0,5 Mo/appel après allègement (§23) — 12× plus léger que les PDF, donc pas le tueur, mais à garder à l'œil. Pour l'annuler complètement, il faudrait précalculer les compteurs « à expédier / à retirer » dans `widget_stats` (publié par l'app) au lieu de lire la moisson en direct — mais ça casse la propriété « se met à jour même app fermée » (§10). À ne faire que si l'égress reste trop haut après ce correctif.
- **Leçon** : quand un correctif d'égress/perf est trouvé côté app, **vérifier tout de suite les endpoints `api/*.js`** qui lisent les mêmes lignes — ils ont leur propre code de lecture et ne bénéficient pas des corrections de `App.jsx`.

---

## 35. Session août 2026 (suite) — Panneau « boutique en un coup d'œil » + factures pro/multi-entités + Factur-X + 3D fly-to

Longue session. Beaucoup de petites briques sûres, deux gros chantiers finis. **Aucune modif ne casse le chemin existant** (tout est additif). ⚠️ Les changements **app** vivent sur la branche `claude/new-session-gzdgur` → **prod au déploiement de la branche** ; les changements **extension** demandent un **rechargement** (`chrome://extensions` → ⟳).

### Extension (panneau VRM sur Vinted) — 4.40 → 4.50
Principe tenu : **le panneau LIT et AFFICHE, il n'agit jamais sur Vinted** (aucune requête, aucun clic auto).
- **4.40** bandeau « À faire » cliquable (chips → onglet concerné).
- **4.41** le panneau garde sa **position** (ouvert/fermé + onglet) entre les pages (`vrm_panel_open`/`vrm_panel_tab`, localStorage).
- **4.42** filtre de recherche dans Republier (DOM, garde le focus ; `repubQuery`).
- **4.43** « Cette paire » : conseils **à relancer / dort** repris tels quels des onglets (mêmes signaux → jamais un chiffre qui contredit l'app).
- **4.44** « Cette paire » sans prix d'achat → **lien 1-tap** vers l'app (`?tab=cat_annonces`).
- **4.45** bouton **« ✓ Traiter »** sur les bordereaux à imprimer.
- **4.46** « Traiter » **réversible** (section « Traités » + ↺ Remettre) + nouvel onglet **« Achats 📦 »** (colis à retirer).
- **4.47** l'onglet Achats affiche **le CODE de retrait** en gros (source = emails `email_track_*`, la SEULE qui porte le code ; jamais deviné par titre).
- **4.48** écran d'accueil **« Ma journée »** (CA du mois, argent bloqué, encaissé — lus depuis `widget_stats` publié par l'app, JAMAIS recalculés → zéro divergence) + à-faire cliquables. Bouton **📋 Copier le code**. Défaut d'accueil = `journee`.
- **4.49** barre **objectif de CA** (lit `vinted_goal`).
- **4.50** bloc **« Pour vendre plus »** (à relancer / dorment / sans N°).

⚠️ **COHÉRENCE SANS CLOBBER — le motif à réutiliser :** pour qu'une action du panneau (Traiter un bordereau, « Récupéré » un colis) se répercute dans l'app **sans jamais écraser la ligne `main`** (un upsert y remplacerait tout le blob et pourrait effacer une sauvegarde de l'app faite en parallèle) :
- l'extension écrit dans une **ligne DÉDIÉE** qu'elle est seule à écrire : **`panel_bords_done`** (bordereaux, clé = `transaction||suivi||numero` = `bordKey`) et **`panel_colis_collected`** (colis, clé = `suivi||subject` = `colisKey`) — read-merge-write sur SA propre ligne.
- `buildPanelData` (background.js) relit ces lignes et filtre → le panneau se met à jour tout de suite.
- **App.jsx LIT ces lignes en source « déjà fait » SUPPLÉMENTAIRE**, en lecture seule : `isBordDone` inclut `panelBordsDone[bordKey(b)]` ; un effet fond `panel_colis_collected` dans le set `collected` (colis). **Jamais de drain qui réécrit, jamais de boucle.** Sens app→panneau déjà en place (buildPanelData lit `vinted_bords_shipped`/`vrm_colis_collected`).
- `buildPanelData` renvoie aussi `pickups` (email_track à retirer), `appStats` (ligne `widget_stats`), `goal` (`vinted_goal`).

### Factures PRO — plusieurs micro-entreprises (App.jsx, additif, rétro-compatible)
- **`vinted_entreprises`** (liste `[{id,companyName,companyType,companyAddress,siret,tvaMention,footer}]`) + **`vinted_entreprise_active`** (id), tous deux dans `SYNC_KEYS`. Amorcés depuis `vinted_invoice_settings` → **une seule entité = comportement identique à avant**.
- `invoiceSettings` reste le **miroir de l'entité active** (tout code hérité qui le lit marche encore). `InvoiceSettings` (la modale) est devenue un **gestionnaire d'entités** (chips + Ajouter/Supprimer/⭐ active + champ « Mention TVA »).
- Chaque facture porte `entrepriseId` (stampé à la création, à `activeEnt`). **Numérotation SÉQUENTIELLE PAR ENTITÉ** (`nextInvoiceNumber` filtre par entité ; facture sans `entrepriseId` = 1ʳᵉ entité). Exigence légale.
- **`entForInvoice(inv, entreprises, activeEnt, fallback)`** (module-level) = LA résolution de l'entité d'une facture (celle stockée dessus, sinon active, sinon 1ʳᵉ). Utilisée par le PDF, le Factur-X, le CSV. Une vieille facture se régénère avec **sa** raison sociale, pas celle du moment.
- PDF : **mention légale « TVA non applicable, art. 293 B du CGI »** ajoutée (obligatoire en micro, elle manquait) ; bloc client = **nom** en principal (avant : l'email en gras). Étiquette 🏢 entreprise sur les lignes + colonnes Entreprise/SIRET au CSV (si >1 entité).

### Facturation électronique — Factur-X (le vrai fichier)
- **`factureCII(inv, ent)`** = XML **Cross Industry Invoice EN16931** (profil BASIC), TVA catégorie `E` (exonéré) + `ExemptionReason` = la mention de l'entité. Bien-formé au `xmllint` (échappement `xmlEsc`).
- **`generateFacturXPdf(inv, ent)`** (bouton 🧾) = **UN SEUL fichier Factur-X** : PDF de la facture (pdf-lib, avec logo) **+ le XML embarqué** sous le nom normalisé **`factur-x.xml`** (`AFRelationship=Alternative`, `/AF`) **+ XMP** d'identification (`pdfaid part=3` + schéma d'extension `fx` : DocumentType/FileName/Version/ConformanceLevel). Sauvé `useObjectStreams:false` → `/AF` + nom en clair, lisibles par les outils (Indy, validateurs). Vérifié au smoke-test pdf-lib.
- **`downloadFacturX(inv, ent)`** (XML seul) existe encore mais n'est plus câblé à un bouton (le XML est dans le PDF).
- ⚠️ **HONNÊTETÉ (dit à Julien, à redire) :** le **format** Factur-X est respecté, mais la **conformité PDF/A-3 stricte n'est PAS certifiée** (polices non embarquées, pas de profil ICC — il faudrait un validateur officiel + une police TTF embarquée). Surtout : l'**envoi légal passe par une Plateforme de Dématérialisation Partenaire (PDP) / Indy**, pas par l'app ; **Indy n'a pas d'API publique de push**. Et l'activité de Julien est **B2C (Vinted → particuliers)** → ce n'est **pas** l'e-invoicing Factur-X (B2B) qui s'applique mais l'**e-reporting**. **À confirmer avec son comptable / Indy** — ne pas présenter l'app comme une solution légale complète.

### Garage 3D — « vol vers la boîte »
- `Room3D` expose `flyTo(itemId)` : à la recherche d'un N°, la caméra **vole en douceur** (720 ms, ease, lerp position+target) jusqu'au meuble. Déclenché depuis l'effet de surlignage **seulement quand la cible change** (`flownRef`), try/catch (si ça rate, le garage reste utilisable). Les **ambiances** (`GARAGE_AMBIANCES`/`applyAmbiance`) étaient déjà là.
- ❌ **Mode balade 1ʳᵉ personne : REFUSÉ par Julien (« c'est nul »)** — ne pas le construire.

### ✅ VÉRIFIÉ AU BANC (Playwright, rendu réel — §20)
Fait après coup, sur l'écran **Factures** en multi-entités (2 entités, 3 factures synthétiques réalistes) :
- **détail du banc** : `dist` servi en statique, Supabase intercepté (`select=owner`→400 pour rester non cloisonné ; `id=eq.main`→données synthétiques ; reste→`[]`), `vrm_acces_direct='1'` (⚠️ **`'1'`, pas `'true'`** — le check `MULTI_USER=true`+`!CLOISONNE` lit exactement `'1'`) injecté par `addInitScript`, deep-link `?tab=invoices`. Chromium `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `--use-angle=swiftshader`.
- **Résultat : 0 erreur page/console.** L'écran rend les 3 factures avec l'**étiquette 🏢 entité**, deux factures **`2026-000001`** distinctes (une par entité → numérotation par entité confirmée). La modale **gestionnaire d'entités** s'ouvre (chips ⭐, champ Mention TVA, Ajouter/Supprimer). 📄 (print) et 🧾 (Factur-X) cliqués sans erreur.
- **Factur-X vérifié à l'octet** : le 🧾 télécharge un vrai PDF ~32 Ko ; il contient `EmbeddedFile` + `factur-x.xml` + `/AF` + `AFRelationship=Alternative` + XMP `pdfaid part 3`. Le stream XML **décompressé (Flate)** est **bien-formé au xmllint** et porte la BONNE entité **par facture** (la facture de la 2ᵉ entité → « Seconde Micro » / 62,50 €, pas Shop Cancale35) + la mention 293 B + le n°. ⇒ `entForInvoice` résout juste.
- Harnais jetable (chemins absolus scratch) → **non commité**. Pour rejouer : servir `dist`, intercepter Supabase comme ci-dessus, seed `vrm_acces_direct='1'`.
- **Smoke TOUS les onglets** (Ma journée / Stats / Annonces / Republier / Ventes / Achats / Bordereaux / Messages / Garage / Factures), en cliquant chacun avec le seed synthétique : **0 erreur page/console partout**, Garage 3D inclus (rendu WebGL logiciel, vues Grille/Photo/Plan OK). Aucune régression des changements de session (`isBordDone`+`panelBordsDone`, effet `collected`+`panel_colis_collected`, `flyTo` 3D).
- **Reste au smoke seulement** (pas d'exercice fonctionnel profond) : le **fly-to 3D** n'a pas été déclenché sur une vraie recherche (garage synthétique sans meuble) — code guardé try/catch.

### ✅ NOUVEAU — le PANNEAU D'EXTENSION SE VÉRIFIE AUSSI (méthode débloquée)
On croyait le panneau (`vinted-panel.js`) non testable hors Chrome. FAUX : Playwright + un **faux `chrome`** suffit.
- `page.route('**/*', …)` sert une page HTML factice au chemin **`/items/1-adidas`** (pour que `currentItemId()` renvoie `'1'`), **zéro réseau réel**.
- `addInitScript` définit `window.chrome.runtime.sendMessage(msg,cb)` qui répond selon `msg.action` : `panelData` → un objet DATA réaliste (mêmes champs que `buildPanelData` : `online, byId, sleeping, relance, noNum, toShip, pickups, bordsToPrint, convs, quickReplies, appStats, goal, stats`) ; `aiReply`/`convLastMessage` → réponses stub ; le reste → `{ok:true}`. Plus `chrome.storage.local.get/set`.
- On injecte le script (`addScriptTag({content: panelJs})`), on clique le **FAB `#vrm-fab`** pour ouvrir, puis on clique chaque `.vrm-tab[data-t=…]` et on capture `pageerror`/`console.error`.
- **Résultat de cette session** : 11 onglets (journee/paire/republier/reponse/expedier/achats/messages/favoris/relance/dorment/sansnum) + interactions (cocher priorités, `📋 Copier N°+titre`, `✓ Traiter`, `📋 code` + `✓ Récupéré`, filtre bordereaux) → **0 erreur app**. Capture Ma journée conforme (CA 320 €, objectif 64 %, badge FAB 6).
- ⚠️ un `click` Playwright qui timeoute sur un élément **filtré (`display:none`)** est une erreur de TEST, pas de l'app — ne compter que `PAGEERROR`/`CONSOLE`.
- Harnais jetable (scratch). **À refaire à chaque gros changement du panneau** — c'est le pendant §20 pour l'extension.

---

## 36. Session août 2026 (suite) — panneau extension « autosuffisant » : moins besoin de rouvrir l'app

Objectif de Julien : « juste à regarder l'extension pour naviguer sur Vinted et gagner du temps ». Trois briques ajoutées au panneau VRM (`vinted-panel.js` + `background.js`), **toutes en lecture seule, cohérentes avec l'app (mêmes sources moissonnées, aucun total recalculé)**. Extension **4.68 → 4.71** (à recharger dans Chrome).

- **4.69** — bandeau « boutique en un coup d'œil » en haut de **Mes paires** : `👟 N en ligne · valeur · 👁 vues · ❤️ favoris`, calculé sur **toutes** les annonces en ligne (`DATA.online`), comme le bandeau Annonces de l'app. Un champ absent ne fausse rien.
- **4.70** — **engagement cumulé** (👁 vues / ❤️ favoris) sous les stats de stock de **Ma journée**. Nouveaux champs `stats.viewsTotal` / `stats.favsTotal` dans `buildPanelData` (mêmes `online` → aucun chiffre qui diverge).
- **4.71** — liste **« 🧾 Dernières ventes »** sur **Ma journée** : nouveau tableau `recentSales` dans `buildPanelData`, tiré des commandes moissonnées `orders_sold`, **mêmes règles de statut que l'app** (`classifySale` = copie de `classifyOrderStatus` : `annul|cancel|refus|rembours`→annulée, `finalis`→finalisée). Annulées/remboursées exclues, tri par `Date.parse(o.date)` desc (l'app parse `o.date` pareil), top 6, dédup par `transaction_id`. Chaque ligne = titre + statut (✅ finalisée / ⏳ en cours) + date relative + prix, lien vers la transaction Vinted. **Aucun total ici** : le CA du mois reste celui de l'app (`appStats`/`widget_stats`).

⚠️ Rappel cohérence tenu : le panneau **n'agit jamais** sur Vinted (0 requête, 0 clic auto), ne réécrit **jamais** la ligne `main`, et ne recalcule aucun CA/marge qui pourrait contredire l'app.

Vérifié au banc extension (§35, faux `chrome` + Playwright, données synthétiques) : **0 erreur page/console** sur les 8 onglets ; captures Ma journée (engagement + Dernières ventes) et Mes paires (bandeau stats) conformes. Le seul « interactions: 1 » du harnais reste l'artefact de test connu (click Playwright qui timeoute sur un élément `display:none` filtré), **pas** une erreur d'app.

---

## 37. Session août 2026 (suite) — onglet Ventes complet + derniers achats + pouls Favoris

« Fait un truc de ouf, tout en même temps. » Gros lot cohérent sur le panneau VRM (`vinted-panel.js` + `background.js`), **tout en lecture seule, zéro divergence avec l'app**. Extension **4.71 → 4.73** (à recharger dans Chrome).

- **4.72 — nouvel onglet « 💶 Ventes »** : liste des ventes moissonnées (`buildPanelData.sales`, top 80), filtres **Toutes / ⏳ En cours / ✅ Finalisées** (comptés depuis `etat`), recherche par titre, chaque ligne → transaction Vinted. ⚠️ L'en-tête **CA du mois / Argent bloqué / Encaissé** vient d'`appStats` (`widget_stats` publié par l'app) — **AUCUN total recalculé** dans le panneau (règle de cohérence tenue). Annulées/remboursées exclues. `classifySale` (copie de `classifyOrderStatus`) porte le statut.
  - ⚠️ **Bénéfices volontairement PAS affichés** : les prix d'achat sont vides sur ~toutes les entrées (§22) → une colonne marge afficherait ~100 % de faux. On ne montre que ce qui est vrai.
- **4.72 — onglet Achats enrichi** : liste **« 🧾 Derniers achats »** sous les colis à retirer (`buildPanelData.recentBuys`, commandes `orders_purchased` moissonnées, top 80). **Statut NON relabellé** (l'app classe les achats par statut ; on ne veut rien inventer) → titre + prix + date seulement, annulés/remboursés exclus.
- **4.73 — pouls Favoris** : bandeau `❤️ N favoris en attente · M annonces likées` en haut de l'onglet Favoris (somme sur `online` filtré favs>0). Le flux de relance assistée (une-par-une, offre native Vinted, aucun envoi auto) est inchangé.

`buildPanelData` renvoie désormais aussi `sales`, `recentBuys` (en plus de `recentSales`). Le champ `date` des commandes est parsé comme dans l'app (`new Date(o.date)` / `Date.parse`), tri desc.

Vérifié au banc extension (faux `chrome` + Playwright, données synthétiques) : **0 erreur app** ; Ventes = 14 lignes, en-tête CA app, filtre « En cours » → 5, recherche « nike » → 4 ; Achats = « Derniers achats » présent ; captures Ventes/Achats/Favoris conformes. Rappel : le « interactions: 1 » du harnais principal reste l'artefact connu (click Playwright sur élément `display:none` filtré), pas une erreur d'app.

---

## 38. Session août 2026 (suite) — onglet Litiges (paires qui reviennent), fait proprement

« Fais ça parfaitement. » Nouvel onglet **« ⚠️ Litiges »** dans le panneau VRM (`vinted-panel.js` + `background.js`). Extension **4.73 → 4.74** (à recharger dans Chrome). Lecture seule, cohérent avec l'app.

### Source (fiable AUJOURD'HUI, pas une promesse)
- **Primaire = le STATUT des ventes moissonnées** (`orders_sold`), classé par `DISPUTE` (regex) en `remboursement` / `retour` / `litige` / `suspendu` — **le même signal que `saleOutcome` de l'app** (§21 : 61 remboursements, 3 retours…). Rien n'est deviné : c'est Vinted qui pose le statut. Marche immédiatement, même sans avoir ouvert l'écran Litiges.
- **Enrichissement OPTIONNEL = le MOTIF** des vraies réclamations captées passivement (`harvest_*_complaints`, §24). ⚠️ La forme exacte de l'API `complaints` n'est **pas garantie** → lecture **défensive** (`payload.complaints || items || entries || []`, plusieurs noms de champ testés, `try/catch`, `.slice(80)`), indexée par n° de transaction. Si la forme diffère, **rien ne casse** et on affiche juste le litige sans motif. (Si Julien veut le motif à coup sûr, il faudra un exemple réel de réponse `complaints` pour caler les champs — même méthode que le point relais §15.)

### Ce que `buildPanelData` renvoie en plus
`disputes` (tri par date desc) + `stats.litiges`. Chaque entrée : `{transaction,title,status,kind,label,reason,price,ts,url}`.

### UI (`renderLitiges`, aucune action Vinted)
Badge sur l'onglet (`stats.litiges`), résumé par type (« 1 💸 remboursées · 1 📦 retours · 1 ⏸️ suspendues »), une carte par paire (pastille couleur par `kind`, motif si connu, date relative, prix), lien vers la transaction pour **agir sur Vinted**. Empty state honnête (« Aucun litige… apparaît ici dès que Vinted change le statut ; ouvre ta page Litiges pour le motif détaillé »).

Placé dans `PANEL_TABS` entre Achats et Messages. Pas de wiring (liens seuls).

Vérifié au banc extension (faux `chrome` + Playwright) : **0 erreur app** en état **peuplé** (3 litiges, badge « Litiges 3 », résumé, motif « Article non conforme » affiché) **et vide** (message d'attente). `node -c` OK sur les deux fichiers.

---

## 39. Session août 2026 (suite) — PHOTO + N° de la paire sur les lignes ventes/achats/litiges

Demande de Julien : « je veux les photos des paires avec les numéros ». Les lignes Ventes / Litiges / Derniers achats / Dernières ventes ne montraient que le titre — parce que les commandes moissonnées (`orders_sold`/`orders_purchased`) sont **allégées** et **n'ont ni photo ni numéro** (`commandeMaigre`). Extension **4.74 → 4.75** (à recharger dans Chrome).

### Comment on retrouve photo + N° (sans devinette)
Dans `buildPanelData` : index `numByTitle` construit depuis **`vinted_annonce_numeros`** (qui garde `{numero, photo, title}` par paire, **même vendue**), **PAR TITRE EXACT** (`normT` = lowercase + espaces normalisés) et **UNIQUEMENT si le titre est unique** — un titre en double (`titleCount>1`) → **on n'associe rien** (même garde que l'app §7/§24 `titleAmbiguous`, jamais la photo/numéro d'une autre paire). La photo d'une annonce **encore en ligne** prime (plus fraîche). `enrichPairs()` pose `photo`/`numero` sur `sales`, `recentSales`, `recentBuys`, `disputes` quand un match unique existe ; sinon ils restent vides.

### UI (`vinted-panel.js`)
Deux helpers réutilisables : `pairThumb(o, sz)` (vignette photo **ou** pictogramme 👟 si pas de photo captée) et `numBadge(o)` (badge `N°X` avant le titre, réutilise `.vrm-num`). Ajoutés aux 4 listes (Ventes, Litiges, Derniers achats, Dernières ventes de Ma journée). La recherche Ventes indexe aussi le N° (`data-s`).

⚠️ Une paire sans photo captée affiche le pictogramme 👟 (honnête) — la photo n'apparaît que quand `vinted_annonce_numeros` l'a (ou que l'annonce est encore en ligne). Rien n'est deviné.

Vérifié au banc (faux `chrome` + Playwright, images `data:` inline qui rendent vraiment) : Ventes = 3 lignes, **2 vraies vignettes + 1 pictogramme** (paire sans photo), **3 badges N° corrects** (N°12/N°7/N°33), **0 erreur app**. Litiges + Ventes/Achats : 0 erreur. `node -c` OK sur les deux fichiers.

---

## 40. Session août 2026 (suite) — « argent en attente » + photos sur les Bordereaux

Deux demandes de Julien. Extension **4.75 → 4.77** (à recharger dans Chrome).

### 4.76 — « argent bloqué » → « argent en attente »
Julien n'aime pas « bloqué ». Libellé renommé partout dans le panneau (Ma journée, onglet Ventes, état vide, commentaires). Le champ interne reste `enAttente` (aucune logique changée).

### 4.77 — photo + N° de la paire sur les Bordereaux aussi
Suite du §39. L'onglet Bordereaux montre maintenant la **vignette photo** de la paire :
- **Bordereaux à imprimer** : photo retrouvée **par N° UNIQUEMENT** (`photoByNum` : numéro → photo depuis `vinted_annonce_numeros` + annonces en ligne). ⚠️ **Jamais par titre** — §24 l'interdit pour les bordereaux (risque d'envoyer la mauvaise paire). Le N° d'un bordereau vient de l'email/la transaction (certain), donc la photo l'est aussi. Pas de N° → pictogramme 👟 + pastille « N° ? » (inchangé).
- **Ventes à générer / défilement** : `toShip` est maintenant enrichi (`enrichPairs(toShip)`, par titre unique comme les autres listes — ici pas de bordereau à tamponner, le risque est nul) → photo + badge N° via `pairThumb`/`numBadge`.

Vérifié au banc : Bordereaux = 1 vraie vignette (N°12) + 1 pictogramme (paire sans N°), ligne « à générer » avec photo + N°8, **0 erreur app**. `node -c` OK sur les deux fichiers.

---

## 41. Session août 2026 (suite) — Bordereau + FACTURE (comptes pro) imprimés ensemble

Demande de Julien : « pour les bordereaux tu mets ça à côté de la vente avec la facture pour les comptes pro, et après quand on met imprimé soit ça génère et ça imprime soit imprime directement. » Précisions (AskUserQuestion) : la facture vient **des emails que l'app reçoit** (pipeline Gmail/Apps Script §3), l'app génère **seulement pour les comptes pro** (les autres, inutile) ; « Imprimer » = **génère bordereau + facture puis lance l'impression** ; **dans l'app**. Changement **App.jsx** (pas l'extension) → déployé au push de la branche.

### « Compte pro » = il existe une facture pour cette vente
Pas de nouveau drapeau : une facture n'arrive par email QUE pour un compte pro. Donc **la présence d'une facture EST le signal pro**. `invForBord(b)` (dans `Comptabilite`) lit `vinted_invoices` (via `load`, lecture seule) et rapproche **par N° de paire** (`invoice.productId` === `numForBord(b)`, le N° tamponné, certain). Si un N° a resservi dans le temps → départage par le **prix de la vente reliée** (`soldByTxn`), puis la plus récente. **Jamais par titre** (règle §24). Compte perso (aucune facture) → rien, comme avant.

### Impression combinée
- `buildFacturXBytes(inv, ent)` = **refactor** de `generateFacturXPdf` : les octets du PDF facture (Factur-X, XML EN16931 embarqué) sans le télécharger. `generateFacturXPdf` n'en est plus qu'un wrapper (le bouton 🧾 des Factures marche pareil).
- `printBordAndInvoice(b)` : tamponne le bordereau (N° via `drawBordereauStamp`), **fusionne** (pdf-lib `copyPages`) bordereau + facture dans **UN seul PDF**, puis `autoPrintUrl(url)` (iframe caché → `print()`, ordinateur) lance l'impression tout de suite. iPhone (print PDF bloqué) → repli modale « Ouvrir → Partager → Imprimer ». `entForInvoice` résout l'entité de la facture (§35).
- Carte bordereau : pastille **🧾 Facture N°xxxx** quand une facture existe ; le bouton principal devient **« 🖨 Imprimer + facture »** (sinon « 🖨 Imprimer » classique, inchangé). Modale « Bordereau + facture prêts » / « impression lancée ».

⚠️ `invForBord` s'exécute à chaque rendu de carte (pastille + bouton) : lecture `localStorage` légère, sûre. Le rapprochement par titre reste **interdit** ici comme pour la photo (§24/§39).

### Vérifié
`npm run build` OK. Banc app (Playwright, `dist` servi, Supabase mocké : `email_bord_*` = 1 bordereau N°12 + ligne `main` avec `vinted_invoices` productId=12) : la carte rend **« N°12 · Adidas Spezial · 🧾 Facture 2026-000042 »** et le bouton **« 🖨 Imprimer + facture »**, **0 PAGEERROR** (les 3 « erreurs » console = le 400 du sondage `select=owner` volontaire + resets réseau au teardown, pas l'app).

---

## 42. Session août 2026 (suite) — GLISSER-DÉFILER à la souris (ordinateur)

Plainte de Julien : « sur l'ordi, je ne peux pas glisser avec la souris vers le bas, je suis obligé de prendre le curseur de droite et de descendre à la main. » Sur ordinateur, glisser la souris ne fait pas défiler (comportement natif du navigateur) — il fallait attraper la barre de défilement.

### Correctif (App.jsx, conteneur racine, prolonge §14)
Les gestes souris (§14) ne géraient que l'HORIZONTAL (balayage entre onglets). Ajout du **VERTICAL = glisser-défiler** : on décide la direction à la volée dans `onPointerMove` (souris uniquement) —
- horizontal franc (`|dx|>25 && |dx|>|dy|*1.5`) → `slideTab` (inchangé) ;
- vertical franc (`|dy|>8 && |dy|>=|dx|`) → **`window.scrollTo(0, sy + dy)`** : on attrape la page et on la fait défiler. `sy` = `window.scrollY` mémorisé au `pointerdown`.

**Sens** : glisser vers le bas fait **descendre** la page (drag = barre de défilement, comme Julien l'a décrit — 1:1 avec la distance). Pendant le geste : `userSelect='none'` + `cursor='grabbing'`, remis à zéro au `pointerup`/`pointercancel`. Un mouvement < 8 px reste un clic/une sélection normale. Les champs (`INPUT/TEXTAREA/SELECT/contentEditable`) et les surfaces flottantes (`data-noswipe`/`position:fixed`, donc les modales à `overflow:auto`) sont **exclus** au `pointerdown` → elles gardent leur propre défilement, et la sélection dans un champ marche encore. Le tactile (mobile) est inchangé (jamais d'événement souris).

⚠️ Contrepartie assumée (cohérente avec §14) : un glissé vertical franc **fait défiler au lieu de sélectionner** du texte hors champ — c'est un outil de travail, on privilégie le défilement ; les codes se copient déjà par bouton.

### Vérifié
`npm run build` OK. Banc app (`dist` servi, espaceur 2500 px injecté dans le conteneur de gestes pour rendre la page défilable, souris Playwright) : glisser vers le bas 300 px → `scrollY` 0→300 ; glisser vers le haut 250 px → 300→50 ; **0 PAGEERROR**. Direction et amplitude conformes.

### ⚠️ ANNULÉ IMMÉDIATEMENT (Julien : « je veux pas swipe vers le bas »)
Le glisser-défiler vertical à la souris a été **entièrement retiré** dès la session suivante. Le conteneur racine ne gère plus que le **balayage HORIZONTAL** entre onglets (§14). Ne pas le réintroduire.

### Note portée : ordinateur d'abord pour l'extension + l'app
Julien : « il n'y a pas d'extension sur iPhone, on se concentre sur l'ordinateur pour l'extension et l'app ». L'**extension** (panneau VRM) est **desktop only** (Chrome). L'**app** reste dispo **partout** (PWA mobile + web desktop) mais les gestes souris ci-dessus ciblent l'ordinateur ; le tactile mobile est intact.

---

## 43. Session août 2026 (suite) — extension 4.78 → 4.84 : visuel pro, comptes, ventes, bordereaux

### Livraison de l'extension (RÈGLE PERMANENTE)
Julien : « donne-moi un zip, je veux qu'un seul dossier à chaque fois ». **Toujours** livrer un **zip qui se dézippe en UN dossier** (`cp -r vinted-sync-extension /tmp/vrm-extension && (cd /tmp && zip -rq out.zip vrm-extension)`), envoyé en pièce jointe. Ni fichiers en vrac (Chrome veut un dossier pour « Charger l'extension non empaquetée »), ni plusieurs pièces jointes.

### 4.81 → 4.83 — refonte visuelle (« on dirait un jeu pour enfant »)
- **Icônes Feather (MIT)** téléchargées et inlinées (`ICONS` + `svgi(name, sz)`) : la nav, les boutons d'en-tête et les chips « À faire / Pour vendre plus » n'ont plus un seul emoji. Palette **ardoise** (`#0f172a` sur l'onglet actif) au lieu du turquoise fluo.
- Liens vers l'app en `target="vrm_app"` : cliquer 5 fois n'ouvre plus 5 onglets.
- Filtre par **compte** amorcé (`keepAcc`) — mais Julien voyait toujours les paires d'un compte retiré : voir ci-dessous, ce n'était pas suffisant.

### 4.84 — le lot « ça ne me sert à rien sinon » (tout vérifié au banc, 0 erreur)
**1. La photo manquante sur les ventes — VRAIE CAUSE trouvée.** `commandeMaigre` garde bien `photo` ({url}) sur chaque commande moissonnée, mais `buildPanelData` **ne la lisait pas** : les lignes de vente n'avaient de photo que si `enrichPairs` retrouvait la paire par titre unique. Ajout de `photoDeCommande(o)` sur `sales` / `recentSales` / `recentBuys` / `disputes` / `toShip`. ⚠️ `toShip` lisait `o.photo` **brut** (un objet) → `pairThumb` rendait `[object Object]` ; corrigé aussi.

**2. Comptes : on peut enfin en couper un DEPUIS l'extension.** `acctOff` réunit désormais **quatre** sources : `vinted_accounts_hidden`, `vinted_accounts_blocked` (ligne `main`), `vrm_blocked_accounts`, et **`panel_accounts_off`** — une ligne DÉDIÉE écrite par le panneau (`setAccountOff`, jamais `main`, même motif anti-clobber que `panel_bords_done`, §35). Bloc **« 👤 Mes comptes Vinted »** en bas de Ma journée : nom + nb en ligne + « ✕ Masquer / ↺ Réafficher ». Un compte masqué disparaît de **tout** le panneau. `DATA.accounts` porte `{uid,name,online,off}`, et chaque ligne (annonce, vente, achat, litige) porte `uid` + `acct`.

**3. Paires vendues qui traînaient en « en ligne » — supprimées.** Deux sources sûres seulement : `vinted_annonces_email_sold` (par ID) **et** une vente de moins de 60 j dont le titre est **unique** parmi les annonces en ligne. ⚠️ Un titre en double ne retire **jamais** rien (§24 : pas de devinette — sinon on effacerait une paire identique encore en vente).

**4. Ventes : tri par COMPTE et par PÉRIODE.** Chips de compte (construites sur les comptes réellement présents, ≥2 sinon rien) + deux champs date (`ventesFrom`/`ventesTo`, filtre sur `ts`). La période s'applique **avant** les autres filtres pour que les compteurs correspondent à ce qui est affiché.

**5. Le BORDEREAU est SUR la ligne de vente** (Julien : « c'est totalement débile » d'avoir une liste séparée à cocher). `buildPanelData` pose `v.bord` = `{etat:'print'}` (bordereau reçu, N° connu) ou `{etat:'generer'}` (Vinted attend le colis, pas encore de bordereau). Pastille 🖨️ imprimer / 📄 générer directement sur la ligne.

**6. Bordereaux déjà expédiés : ils disparaissent TOUT SEULS.** `bordExpedie(tx)` = la vente liée par transaction n'attend plus le colis → le bordereau sort de `bordsToPrint` **sans aucun clic**. C'est le même signal que `bordShipped` de l'app. Le « ✓ Traiter » manuel reste en secours.

**7. File de génération : on confirme la capture.** Dans le défilement, la carte passe au vert « ✓ bordereau capté » dès que l'extension a le PDF, avec un bouton **« J'ai généré → vérifier »** qui relit les données. ⚠️ Toujours **aucun clic à sa place** sur Vinted.

**8. Mise en page : une seule ligne par info.** Julien : « ne fais pas des trucs de gauche à droite ». `.vrm-stats` passe en **colonne** (libellé à gauche, valeur à droite, pleine largeur), le bandeau de « Mes paires » devient une ligne de texte, et le mode agrandi remplit la page (`calc(100vw - 24px)` × `calc(100vh - 24px)` — mesuré 1258×878 sur une fenêtre 1280×900).

**9. « Mes paires » : le vrai filtre.** Deux gros boutons **👟 En ligne / 💶 Vendues** en tête d'onglet ; les tris fins (à relancer, trop cher, dorment, sans N°) restent en dessous, en option. La vue « Vendues » réutilise `venteRow` (photo, N°, compte, bordereau) — une seule définition de ligne de vente pour les deux onglets.

### ⚠️ REFUS MAINTENU (Julien l'a redemandé, en insistant)
Il veut que l'extension **modifie les photos** (inclinaison/rotation/degré) et **réécrive titre/description** de ses annonces **à sa place**, en masse. **Refusé, comme les fois précédentes (§32).** Faire tourner une photo de quelques degrés n'a qu'un seul usage : **tromper la détection de doublon de Vinted** pour republier — c'est exactement le motif qui a fait bloquer `vanessa5723`. Idem pour un clic automatique sur « Générer » : un script qui clique sur Vinted est LE geste sanctionné. Ce qui est fait à la place, et qui est sûr : l'atelier de republication de l'app (§31, scores + réécriture assistée, Julien applique lui-même), et le défilement une-par-une du panneau (§32).

### Vérifié au banc extension (§35 : faux `chrome` + Playwright, données synthétiques 3 comptes)
Comptes on/off rendus, Ventes = 3 lignes + chips compte (`Tous 3 / shop_cancale 2 / Shop Concale 1`), filtre compte → 1 ligne, période 7 j → 2 lignes, pastilles `🖨️ imprimer` + `📄 générer` présentes, Mes paires bascule En ligne 3 / Vendues 3, Bordereaux 1, panneau agrandi 1258×878, **0 erreur page/console** sur les 10 onglets. `node -c` OK sur les deux fichiers.

---

## 44. Session août 2026 (suite) — calendrier Airbnb, le bordereau DONNÉ, statut = capture la plus fraîche, offres, message type

Extension **4.84 → 4.85** (à recharger dans Chrome — livrée en zip à dossier unique, cf. §43).

### 1. Période = un CALENDRIER qu'on clique (plus deux champs à remplir)
Julien : « je veux cliquer un peu comme sur les calendriers Airbnb, telle date à telle date ».
`periodeBar()` est devenu un bouton pleine largeur (« 01/08 → 10/08 ») + 4 raccourcis (**7 jours / 30 jours / Ce mois / Mois dernier**) + `calendrier()` dépliable : mois navigable (‹ ›), lundi en premier, **1ᵉʳ clic = début, 2ᵉ = fin** (un clic avant le début en cours redémarre la sélection, sinon on se coince). État : `calOpen` / `calMonth`. Vérifié au banc : 3 ventes → 2 sur « ce mois », 2 sur « 7 jours », retour à 3 au ✕.

### 2. ⚠️ « Tu te trompes sur deux paires » — LE STATUT VIENT DE LA CAPTURE LA PLUS FRAÎCHE
Une paire vendue il y a 15 jours et une **déjà expédiée** apparaissaient encore « à générer ». Cause : une même transaction existe dans **plusieurs** lignes moissonnées (comptes, captures successives) et on gardait **la première rencontrée**, parfois périmée.
- `soldRows` / `lstAll` sont maintenant **triés par `data.capturedAt` décroissant** (`parFraicheur`) → la première occurrence d'une transaction est la plus récente.
- Nouveau **`txnEtat`** : les lignes `harvest_*_txn_*` (détail de transaction) portent `shipment.status_title` — la source la plus précise. **`encoreAExpedier(tx, statut, capture)`** privilégie ce détail dès qu'il est **plus récent** que la ligne de commande, sinon retombe sur le statut de la commande.
- Utilisé par `toShip`, `salesFlat.aExpedier` **et** `bordExpedie` (les trois lisaient `awaitingShip(o.status)` chacun de leur côté). Une transaction écartée est quand même marquée vue → une vieille ligne ne peut plus la rouvrir.
⚠️ **Aucune déduction ajoutée** (pas de « plus de 15 jours donc expédiée ») : on lit ce que Vinted a dit en dernier, c'est tout.

### 3. Le bordereau, DONNÉ pour de vrai
« Je ne sais pas trop comment tu comptes me les donner. » → nouvelle action **`bordPdf(rowId)`** (background) : lit `email_bord_*` et renvoie le PDF **tamponné** (avec le N°, quand l'app l'a produit) sinon le brut. Côté panneau, `ouvrirBordereau()` décode le base64 → `Blob` → **ouvre le PDF dans un onglet, prêt à imprimer**. Boutons `.vrm-bord-dl` (câblés une seule fois dans `render()`) : sur la **ligne de vente** (pastille « ouvrir »), sur chaque **bordereau à imprimer**, et dans le **défilement de génération**. `bordsToPrint[].row` + `v.bord.row` transportent l'id de ligne. Plus besoin de passer par l'app pour un bordereau.

### 4. « Généré → vérifier » vérifie vraiment
Le défilement relit les données (`load()`) **et le dit** : carte verte « ✓ bordereau capté » **avec le bouton d'ouverture du PDF** s'il est arrivé ; sinon message honnête « pas encore reçu — le bordereau arrive par email juste après la génération, réessaie dans une minute » (`shipCheck`, remis à zéro à « Suivante »).

### 5. Offres : le prix plancher décide, TU cliques
Demande : « un montant minimum par paire ; si l'offre est au-dessus ça accepte, sinon ça contre ».
- **`panel_min_prices`** (ligne dédiée, jamais `main` — motif anti-clobber §35) + action `setMinPrice`. Saisie dans **« Cette paire » → Mon prix plancher**.
- `buildPanelData.offers` : lit les conversations **déjà captées** (`harvest_*_conv_*`), prend la **dernière demande d'offre** (`entity_type` ~ `offer`) et son montant (lecture **défensive** : `offer_price`/`price`/`amount`, objet ou texte ; offre déjà acceptée/refusée/expirée ignorée). Rapprochement à l'annonce **par titre unique** seulement (§24). Sans montant trouvé → **rien affiché** (jamais de chiffre inventé).
- Section **« N offres à trancher »** en tête de Messages + chip sur Ma journée (`stats.offres`) : verdict **✅ Accepte** (≥ plancher) / **↩️ Contre à X €** (avec bouton 📋 pour coller le chiffre) / « pose ton plancher ».
⚠️ **REFUS TENU** : l'extension **n'accepte ni ne contre l'offre à ta place**. Répondre à Vinted par script est le geste sanctionné (§32), et une offre acceptée par erreur = une vente à perte. Elle tranche, elle prépare le chiffre, tu cliques.

### 6. Message type pour plusieurs conversations
Demande : « sélectionner plusieurs conversations et prédéfinir un message qui sera envoyé par l'extension ».
- Bloc **« Mon message type »** (Messages) : zone de texte + chips reprises des **réponses rapides** de l'app. Stocké en `localStorage` (`vrm_msg_modele`) **parce que la conversation s'ouvre dans un autre onglet** — un état mémoire ne suivrait pas.
- Sur **toute page de conversation**, un bandeau **« Coller mon message type »** (`modeleBandeau()`, au-dessus du corps du panneau, tous onglets) appelle `insertReply()` → le texte atterrit dans le champ Vinted. **C'est toi qui appuies sur Envoyer.**
⚠️ **REFUS TENU** : pas d'envoi automatique en série (§32). Coller le texte enlève tout le travail sans prendre le risque.

### Vérifié au banc extension (§35, faux `chrome` + Playwright, `window.open` espionné)
Calendrier (31 jours, début→fin, filtres 3→2, raccourci 7 j, ✕ → 3), `bordPdf` demandé avec le bon `row` et **blob PDF réellement ouvert**, 1 bouton d'ouverture par bordereau, 3 offres rendues avec les 3 verdicts, message type sauvé + **collé dans le `<textarea>` de la page** (`colle === "Bonjour, la paire est disponible !"`), `setMinPrice` envoyé avec `{id:'1', amount:'42'}`. **0 erreur page/console.** `node -c` OK sur les deux fichiers.
⚠️ Piège de banc rencontré : `currentConvId()` exige un id **numérique** (`/inbox/(\d+)`) — tester avec `/inbox/c1` fait croire à tort que le bandeau ne s'affiche pas. Et le panneau doit être ouvert (`localStorage.vrm_panel_open='1'`) avant l'injection, sinon les clics tombent sur un panneau `display:none`.

---

## 45. Session août 2026 (suite) — répondre à une offre EN UN CLIC (4.86) + ⚠️ le refus de l'auto-acceptation

### Ce que Julien a demandé, et ce qui a été fait
« Je veux que ce soit l'extension qui accepte dès qu'un acheteur envoie l'offre quand je suis sur l'app. » Puis, devant le refus : « Sinon tu prends juste le contrôle de ma souris ? »

**Construit** : les trois réponses (**Accepter / Contre-offre à ton plancher / Refuser**) **dans le panneau**, sur la ligne de l'offre. Un clic arme (« Confirmer ? », 5 s), le second envoie. Il n'ouvre plus la conversation.
**Refusé** : le moteur qui répond **tout seul**, et a fortiori le pilotage de la souris (c'est le même geste en plus visible — cf. §43).

### ⚠️ La vraie raison du refus n'est PAS que le risque de blocage
Elle est ailleurs, et elle est technique : **accepter une offre engage une VENTE FERME qu'on n'annule pas**, et le champ qui dit « cette offre est encore en attente » **n'a jamais été observé**. Vérifié sur les 40 conversations captées : 21 `offer_request_message`, **toutes** en `status: 20` (« Offre acceptée ») ou `30` (« Refusée ») — **aucune offre ouverte** dans l'échantillon. Un moteur automatique aurait donc tranché sur un code inconnu, avec de l'argent réel au bout. Ce n'est pas une position de principe : c'est qu'on ne sait pas encore lire l'état.
➡️ **Si l'auto-acceptation revient sur la table**, la première chose à faire est de capter une **offre réellement en attente** (ouvrir une conversation avec une offre en cours) et de relever son `status`. Sans ça, ne pas coder de moteur.

### Les requêtes : CAPTÉES, jamais devinées
`storeWriteReq` (déjà en place, §26) avait enregistré les vraies actions de Julien sur **5 comptes** :
```
accepter     PUT  /api/v2/transactions/{tx}/offer_requests/{oid}/accept   (corps vide)
refuser      PUT  /api/v2/transactions/{tx}/offer_requests/{oid}/reject   (corps vide)
contre-offre POST /api/v2/transactions/{tx}/offers   {"offer":{"price":"32","currency":"EUR"}}
```
C'est exactement à ça que sert cette ligne (« sert à l'app pour reproduire ensuite l'action exacte, sans deviner ») — **premier vrai usage**.

### Forme RÉELLE d'une offre (relevée en base, à ne plus redécouvrir)
`conversation.messages[].entity_type` :
- **`offer_request_message`** = offre **de l'acheteur** → `entity = { price:{amount}, status, status_title, current, user_id, transaction_id, offer_request_id, original_price }`. **C'est la seule qui porte les deux identifiants.**
- **`offer_message`** = **mes** offres (aucun id) — à ne pas confondre, c'était la cause d'un faux positif dans la première version.
Filtres retenus : `current !== false`, `user_id === opposite_user.id` (sinon c'est moi), `status ∉ {20,30}`, `status_title` sans accept/refus/expir. L'article vient de **`conversation.transaction.item_id`** (identité certaine) ; le titre n'est qu'un repli, et seulement s'il est unique (§24).

### Côté code
- `background.js` : **`repondreOffre({uid,tx,oid,quoi,prix})`** → un `vintedSend` par appel, **déclenché uniquement par le message `offre` du panneau**. Aucun appel depuis un événement de fond, aucune minuterie. Journalisé dans l'activité.
- `buildPanelData.offers` porte maintenant `tx` / `oid` / `uid`.
- `vinted-panel.js` : `agir(of…)` rend les 3 boutons **seulement si `tx`+`oid`+`uid` sont présents** ; sinon on retombe sur « Répondre sur Vinted ↗ » (jamais de bouton qui enverrait une requête incomplète). Double tap obligatoire.

### Vérifié au banc (§35)
6 boutons sur les 2 offres identifiées, la 3ᵉ (sans ids) n'a que le lien Vinted ; 1ᵉʳ clic → « Confirmer ? » et **0 envoi** ; 2ᵉ clic → un seul message avec les bons `tx`/`oid`/`uid` ; contre-offre transmise avec le **prix plancher** (`prix:"40"`). **0 erreur page/console.**

---

## 46. Session août 2026 (suite) — ⚠️ DEUX CAPTURES QUI N'ONT JAMAIS RIEN RANGÉ (bordereau, fiche annonce)

Méthode : avant de coder, **lire la base**. Deux plaintes de Julien (« les bordereaux ne servent à rien car tu ne les captes pas », « améliore republier ») avaient la même racine — une capture qui existe dans le code mais ne produit **aucune ligne**.

| ligne attendue | en base | conséquence |
|---|---|---|
| `harvest_*_label_latest` (PDF du bordereau) | **0** | l'app dépend des emails, rien d'automatique |
| `harvest_*_item_*` (fiche annonce) | **0** | pas de description → « Republier » = tout retaper |

### 1. Bordereau : `inject.js` ne pouvait PAS le voir (4.88)
`inject.js` n'observe que `fetch` et `XMLHttpRequest`. Vinted sert le bordereau par un **lien direct** : c'est le navigateur qui télécharge, sans JavaScript. La capture était donc structurellement aveugle — et l'URL du label n'apparaît nulle part ailleurs (ni dans les transactions captées : `shipment` = `{id,status,status_title,status_updated_at}`, ni dans `seen_urls`).
➡️ **`chrome.downloads.onCreated`** (permission déjà dans le manifeste, jamais utilisée). On filtre PDF + origine/référent Vinted, on relit le fichier avec la session, on range via `storeLabel`. Bonus : `panel_label_urls` **apprend l'URL** du bordereau — la pièce qui manquait pour aller le chercher soi-même.
⚠️ Un reçu/facture n'est pas un bordereau : même distinction que `inject.js` (`invoice|receipt|facture|billing`).

### 2. Générer le bordereau : FAIT À SA PLACE (4.88)
Requête captée par `storeWriteReq` sur 5 comptes :
`PUT /api/v2/transactions/{tx}/shipment/order` → `{"seller_address_id":N,"drop_off_type":null,"label_type":null}`
`adresseVendeur(uid)` relit le `seller_address_id` **dans la capture de CE compte** (il change par compte ; sans capture, on ne devine pas — on le dit). Bouton **« générer »** sur la ligne de vente.
**Pourquoi celle-ci oui, alors que l'auto-acceptation d'offre non** : générer un bordereau **n'engage aucun argent** et ne décide de rien — la vente est faite, le colis doit partir, il n'y a ni prix ni choix. Accepter une offre, si.
⚠️ Une version **« générer mes 25 sélectionnés »** a été écrite **puis retirée** : 25 PUT enchaînés sur un clic, c'est la rafale refusée partout ailleurs. **Un clic = un bordereau.**

### 3. Fiche annonce : la fuite n'est PAS localisée — on l'instrumente (4.89)
`/api/v2/items/{id}` **est bien appelé** (présent dans `seen_urls`, 4 fois) et tout le code existe (regex `item` dans `HARVEST`, moisson active par lots de 6 avec pauses, `content.js` relaie tout sans filtre, `storeHarvest` a la bonne clé). Pourtant : 0 ligne. Analyse statique épuisée sans conclusion.
➡️ **`noterDiag(clé)`** compte chaque passage ET chaque **sortie muette** de `storeHarvest` (`recu_*`, `abandon_sans_compte_*`, `abandon_json_*`, `ecriture_ratee_*`, `ecrit_*`) dans la ligne **`panel_diag_capture`** (agrégé en mémoire, écrit au plus une fois par minute). Trois sorties silencieuses existaient, impossible de savoir laquelle sans mesurer.
➡️ En attendant : **`capterAnnonce(uid, itemId)`** — bouton qui va lire la fiche de CETTE annonce (lecture seule, sur clic) et la range par `storeHarvest`, donc au même endroit.

### 4. « Republier » enfin utile — le KIT (4.89)
Ce que disent les requêtes captées : republier chez Vinted **n'est pas un bouton « remonter »** (ça n'existe pas), c'est `POST /api/v2/items/{id}/delete` **puis** `POST /api/v2/item_upload/items` avec tout le contenu. Donc republier = **retaper titre + description**, et **perdre les favoris et les vues** de l'annonce.
`buildPanelData` sert désormais `o.desc` depuis les fiches captées. `kitRepub(o)` dans le défilement :
- fiche captée → aperçu du texte + **📋 Titre / 📋 Description / 📋 Prix** (le presse-papier rend le texte EXACT, sauts de ligne compris) ;
- fiche absente → encart orange honnête + bouton **« 📥 Récupérer le texte de cette annonce »**.

⚠️ **Julien a raison sur la distinction masse vs unité** : republier UNE annonce sur son clic n'est pas une rafale, et n'a pas à être refusé. Ce qui reste refusé, c'est la file qui s'exécute seule et la rotation de photos pour tromper la détection de doublon (§32/§43).

### Vérifié au banc (§35)
Défilement Republier : annonce avec fiche → 3 boutons de copie, **la description copiée est identique à l'originale** (sauts de ligne compris) ; annonce sans fiche → encart + bouton, qui demande le bon `itemId`+`uid`. **0 erreur page/console.** `node --check` OK sur les deux fichiers.
⚠️ Piège de banc : cocher une case **re-rend la liste** → un handle Playwright récupéré avant devient détaché. Re-sélectionner par `data-id` à chaque clic.

### 5. ⚠️ REPUBLIER CASSE LE NUMÉRO DE LA PAIRE (4.90) — effet de bord jamais traité
Republier = supprimer + recréer → **nouvel id d'annonce**. Or `vinted_annonce_numeros` est indexé **par id d'annonce** (§7). Donc après chaque republication :
1. le N° reste accroché à une annonce qui n'existe plus ;
2. la nouvelle annonce n'a plus de numéro ;
3. **le pire** — le N° n'étant plus porté par aucune annonce en ligne, il redevient « libre » (§7, `freedNums`) et la numérotation auto peut le **donner à une autre paire**, alors que la chaussure occupe toujours cette boîte. C'est le « deux paires dans la même boîte » que §19 traite comme le risque n°1.

- `markRepub(id)` envoie désormais `repubMarque {id, numero, title}` → **`panel_repub_pending`** (ligne dédiée, purge à 30 j).
- `buildPanelData.renumSuggest` retrouve la nouvelle annonce, sous **trois** conditions strictes : le numéro n'est porté par **aucune** annonce en ligne (sinon il a déjà été réattribué), le titre est **exactement** le même, **unique** parmi les annonces en ligne, et la cible n'a pas déjà un numéro. Sinon : **aucune suggestion** (§24, jamais de devinette).
- Bandeau orange en tête de Republier : « N numéros à remettre » + la paire + « remets le N°7 » + lien vers l'app.
⚠️ **L'extension n'écrit PAS le numéro** : `vinted_annonce_numeros` vit dans la ligne `main`, que le panneau ne doit jamais réécrire (§35). Elle signale seulement.

### ⚠️ 6. ET J'AI FAILLI LIVRER UN DOUBLON — l'app le faisait DÉJÀ
J'ai écrit côté `App.jsx` un panneau « N° à remettre après republication » (lecture de `panel_repub_pending`, `renumAFaire`, bouton d'application). **Le banc l'a démenti** : le panneau ne s'affichait pas… parce que le numéro **était déjà remis**, tout seul, avec un champ `repriseAt`.
➡️ `numeroReprises` + l'effet **AUTO-REPRISE** existent depuis longtemps dans `App.jsx` (~l.9878) : quand une annonce republiée correspond **sans ambiguïté** à une paire orpheline (même titre + pointure), elle récupère son ancien numéro **sans aucun clic**, et `applyReprise` gère le cas manuel. Commentaire d'époque : « vérifié sur données réelles, 5 reprises justes, 2 cas piégeux laissés intacts ».
**Mon ajout a été entièrement annulé** (`git checkout -- src/App.jsx`) : deux mécanismes qui écrivent des numéros, c'est exactement la violation d'« une seule règle par notion » (§11) — et le mien était moins testé.
**Ce qui reste côté extension** : `panel_repub_pending` + le bandeau, **reformulé pour ne pas être une fausse alerte** — il dit désormais « l'app le remet toute seule à sa prochaine ouverture », ce qui est vrai et reste utile (entre la republication et l'ouverture de l'app, la paire est bien sans numéro).
**Leçon (la même que §21) : avant d'ajouter un garde-fou, vérifier qu'il n'existe pas déjà.** Un banc qui « ne montre pas la fonction attendue » n'est pas forcément un bug du code — ici c'était la preuve que le problème était déjà résolu.

### Ce qui reste ouvert
- La **fuite de capture des fiches** : réponse attendue dans `panel_diag_capture` dès que Julien navigue avec la 4.89.
- Le **code « offre en attente »** (§45) : toujours inconnu, `panel_offer_statuts` l'apprendra.
- **Republier en un clic** (delete + recreate) : faisable en principe (les deux requêtes sont captées) mais suppose de **re-téléverser les photos** — chantier à part, à ne pas bricoler.

---

## 47. Session août 2026 (suite) — LE COFFRE (annonces enregistrées en entier) + widget aligné

### Widget : le CA du mois venait d'une AUTRE source que l'app
`api/widget.js` calculait encore sur `email_sale_*` alors que l'app est passée à la moisson Vinted (§33 : les emails voyaient 12 ventes / 308 € là où la moisson en voit 17 / 437 €). Deux chiffres pour la même chose sur l'écran d'accueil.
➡️ **Référence = `widget_stats`** (la photo publiée par l'app) : le widget affiche EXACTEMENT ce que montre l'app. Repli sur les emails **uniquement** si la photo manque ou date d'un autre mois (sinon le widget resterait bloqué sur le mois précédent tant que l'app n'est pas ouverte). Champ **`moneySource`** (`'app'` / `'emails'`) pour que le widget puisse le dire.

### Le coffre (extension 4.92) — demande : « un cloud qui enregistre intégralement une annonce »
Chaque annonce enregistrée **en entier** : titre, description, marque, taille, état, catégorie, prix, **URL des photos**. Une ligne par annonce : `coffre_{uid}_{itemId}`.
- **⚠️ Les photos ne sont PAS stockées en base.** 119 annonces × plusieurs images = des centaines de Mo — exactement ce qui a crevé le quota d'égress (§34). On garde les **liens** (quelques Ko/annonce) ; le bouton « Ouvrir les N photos » construit une page locale (blob) avec toutes les images pour les réenregistrer.
- **⚠️ Il ne dépend PAS de la capture de fiche** (`harvest_*_item_*`, qui ne range toujours rien) : il se construit avec le **dressing** (titre, prix, marque, taille, photo) et s'enrichit de la **description** quand une fiche arrive ou via « Récupérer le texte » (§46).
- **`archiverLot(uid, items)` = UNE lecture + UNE écriture** pour tout le dressing. Une boucle unitaire aurait fait 200 lectures + 200 écritures à chaque chargement — la faute de §34. On saute aussi les lignes inchangées (titre, prix, nb photos, description identiques).
- `archiverAnnonce` ne **dégrade jamais** un enregistrement riche : le dressing n'a pas la description, on complète, on n'écrase pas. `firstSavedAt` conservé.
- Onglet **Coffre** : compteur (« N enregistrées · M avec leur description »), recherche, export JSON complet, détail par annonce avec **📋 Titre / Description / Prix / Tout** (le bloc « Tout » sépare les sections par une ligne vide — il est fait pour être collé), et « Recréer cette annonce sur Vinted ».

Couvre les trois demandes : catalogue hors-ligne (36), restaurer une annonce supprimée (32), recopier le texte existant (35 — **le sien, à l'identique**, aucun texte inventé).

### ⚠️ REFUS MAINTENU — modifier les photos pour passer une annonce sur un autre compte après un bannissement
Demande explicite : « l'extension modifie photos etc et comme ça on peut passer une annonce d'un compte à un autre s'il est ban ». Refusé : la retouche d'image n'a ici qu'un usage, tromper la reconnaissance de Vinted pour **contourner une sanction**.
**Argument factuel donné à Julien** (plus utile que le principe) : Vinted ne relie pas les comptes par les photos mais par **appareil / navigateur / adresse / moyen de paiement** — c'est comme ça que `vanessa5723` est tombé, avec des annonces différentes. Tourner une image ne change aucun de ces signaux : le compte suivant tombe aussi, et l'inventaire part avec.
**Ce qui est proposé à la place et qui marche** : le coffre (garder textes + photos), le re-téléversement **à l'identique** sur un compte utilisé normalement, et le diagnostic « est-ce vraiment les photos ? » (beaucoup de vues + peu de favoris = c'est le PRIX, pas les images).

### Vérifié au banc (§35)
Onglet Coffre : 2 annonces, compteur « 1 avec leur description », détail complet, 4 boutons de copie, bloc « Tout » correctement séparé, page photos ouverte en blob, export. **0 erreur page/console.** `node --check` OK sur les deux fichiers.

### 4.93 — RETOUCHE PHOTO dans le panneau (la vraie demande, enfin comprise)
Julien : « pour republier une annonce, je ne peux pas avoir les mêmes photos, même si c'est le même article ». **Vinted refuse un fichier identique** quand on supprime puis recrée — c'est un obstacle réel au relistage de SON article sur SON compte, sans rapport avec le contournement de sanction refusé plus haut.
- **`photoBytes(url)` (background)** rapatrie la photo du CDN en `data:` URL. ⚠️ Indispensable : dans une page, une image CDN chargée dans un `<canvas>` le rend *tainted* (cross-origin) et **l'export devient impossible** — on ne pourrait ni recadrer ni enregistrer. Le service worker a les permissions d'hôte, une `data:` URL se recadre sans restriction. (Même contrainte que `PhotoEditor` dans l'app, qui la contourne en partant d'un fichier local.)
- **Éditeur ouvert en page locale (blob)** depuis le détail du coffre : un bouton `✂️ N` par photo. Recadrage (glisser), zoom, luminosité, rotation 90°, format 3:4 / 1:1 / 4:3, export JPEG ×3 en qualité 0,92.
- ⚠️ **Une photo à la fois, réglages choisis par lui.** Ce n'est pas un outil qui retouche en masse : le refus porte sur l'automatisation qui altère des images pour esquiver une détection, pas sur un éditeur manuel — l'app en a déjà un depuis longtemps (« ✂️ Retoucher une photo »).

**Vérifié au banc, éditeur RÉELLEMENT chargé** (le HTML de la page blob est capturé puis rendu dans un vrai onglet) : image dessinée (172 800 px non blancs), zoom + rotation + changement de format (360×480 → 360×360, libellé « Format : 1:1 »), et le **téléchargement produit un vrai fichier** (`photo-vrm-….jpg`, 28 Ko). **0 erreur** côté panneau ET côté éditeur.

### 4.94 — LE PRIX D'ACHAT, relié d'un tap depuis l'annonce (le trou le plus coûteux)
Rappel du constat (§22) : **0 prix d'achat sur 177 paires** → bénéfice, marge, « meilleure marque » et rapport comptable tournent tous avec un **coût de zéro**. La cause n'était pas la paresse : il fallait retrouver la bonne paire parmi ~700 achats classés par date.
- **`achatsPour(titre, prixVente)` (background)** : score repris de `openPicker` de l'app, **mêmes poids** (titre identique +6, marque +4, taille +4, payé moins cher +1 ; à égalité le plus récent), seuil à 4, top 6. Lit les commandes `orders_purchased` moissonnées, annulées/remboursées exclues.
- **UI dans « Cette paire »** (`achatBloc`) : encart orange « Prix d'achat manquant » → bouton « 🔎 Retrouver dans mes achats » → liste avec photo, date relative, prix, pastille **« suggéré »** au-dessus de 8. Un tap relie. Champ de saisie manuelle en secours. Une fois relié : « Acheté X € · marge Y » + bouton « Changer ».
- **Écriture** : ligne dédiée **`panel_buyprices`** (l'extension n'écrit jamais `main`, §35). `buildPanelData` la relit aussi pour afficher le prix tout de suite.
- **Côté app** : effet gardé par `cloudReady` qui reporte chaque prix sur la paire via **`updatePair`** (donc le miroir `vinted_buyprice_by_num` est mis à jour aussi, §7). ⚠️ **N'écrase jamais un prix déjà saisi** — le panneau complète, il ne remplace pas.

**Vérifié aux deux bancs** : panneau (3 candidats, 2 « suggéré », tap → `setBuyPrice{itemId,prix,tx,titre}`, saisie manuelle → 27 €, **0 erreur**) ; app (`dist` servi, `panel_buyprices` mocké → `vinted_annonce_numeros['77'].buyPrice === "18"`, **0 PAGEERROR** — les 3 lignes console sont le 400 volontaire de `select=owner` et les resets de fin de test).

### 4.95 — pastille N° sur Vinted · créneau de vente réel · sauvegarde des numéros
- **N° visible sur la page Vinted** (`majBadge`) : pastille fixe en haut à gauche sur une de tes annonces → `N°7 · 🏠 B3` + la marge (ou « achat ? »). Clic = ouvre « Cette paire ». ⚠️ **Position fixe, jamais greffée dans le HTML de Vinted** : une pastille flottante survit à leurs refontes, une pastille insérée dans leur `<h1>` disparaît sans prévenir. Appelée depuis `render()`.
- **Le meilleur moment pour republier = TON historique** (`momentVente`, background) : répartition des ventes moissonnées par jour de semaine et par créneau (matin/après-midi/soir/nuit). ⚠️ **Rien n'est affiché en dessous de 20 ventes datées** — un « pic » sur 5 ventes n'est que du hasard, et un conseil inventé vaut moins que rien. Bandeau vert en tête de Republier.
- **Sauvegarde des numéros** (`sauvegardeNumeros`) : lecture seule de `main` → fichier JSON (`vinted_annonce_numeros` + `vinted_buyprice_by_num` + garage). Le N° est ce qui est **écrit sur la boîte** : il ne se recalcule pas, un fichier chez lui est le seul vrai filet. ⚠️ Le bouton est proposé **aussi quand le coffre est vide** (il n'en dépend pas — c'est justement là qu'on veut un filet).

**Vérifié au banc** : pastille rendue et visible (`N°7 · 🏠 B3 · marge 22,00 €`), bandeau créneau (« dimanche, en soirée · 41/180 »), téléchargement réel `numeros-vrm-AAAA-MM-JJ.json` avec 2 entrées et libellé « ✓ 2 N° sauvegardés ». **0 erreur.**

### 4.96 — baisse de prix (raccourci sûr) + garde-fou « ne saborde pas une paire qui travaille »
**⚠️ POURQUOI L'EXTENSION N'ENVOIE PAS LA BAISSE DE PRIX ELLE-MÊME** (demande #2 de Julien, refusée sur base technique, pas de principe) : la requête captée `PUT /api/v2/item_upload/items/{id}` exige **l'annonce ENTIÈRE** — champs relevés dans la vraie capture : `title, description, brand_id, catalog_id, color_ids, item_attributes, measurement_length/width, package_size_id, shipment_prices, currency, temp_uuid` et **`assigned_photos`** (identifiant + orientation de CHAQUE photo). Changer un seul nombre imposerait de tout reconstruire, et **aucune capture ne permet aujourd'hui de vérifier la correspondance lecture (`GET /items/{id}`) → écriture** (`harvest_*_item_*` est vide). Une PUT mal formée renvoie une annonce **sans ses photos** ou dans la mauvaise catégorie. Coût d'une erreur ≫ deux secondes gagnées.
➡️ À la place : bouton **« Passer à X € ↗ »** — copie le prix conseillé **et** ouvre l'écran de modification. Il ne reste que le champ prix à coller.
➡️ **Pour le rendre automatique un jour** : capter un `GET /api/v2/items/{id}` ET la `PUT` correspondante **sur la même annonce**, puis vérifier champ par champ. Sans ça, ne pas coder.

**Garde-fou momentum** (`alerteMomentum`, idée #17) : dans le défilement Republier, une annonce à ≥ 2 favoris ou ≥ 40 vues affiche un avertissement chiffré — republier la remet à zéro et les gens qui l'ont mise en favori la perdent de vue. Oriente vers la bonne action : **remise aux favoris** s'il y en a, **baisse de prix** si c'est très vu et peu mis en favori. ⚠️ On n'interdit rien : on met le chiffre sous les yeux avant un geste irréversible.

**Vérifié au banc** : alerte rendue (« 5 favoris et 120 vues… propose-leur plutôt une remise »), **0 erreur**.

### 4.97 — « paire qui dort » sur la page + écran Santé de la capture
- **Badge d'annonce** : passe en orange et affiche « 😴 en ligne depuis X j » au-delà de 30 jours. Le signal arrive **sur la page de l'annonce**, au moment où l'action (baisser / republier) est possible.
- **`sante` (background)** : par compte, date de la dernière moisson de chaque type (annonces / ventes / achats / messages), lue sur `capturedAt` des lignes déjà chargées → **aucune requête ajoutée**. Rendu en tête du Coffre : vert < 2 j, orange < 7 j, rouge au-delà ; un compte sans aucune capture affiche « la session a sans doute expiré, ouvre Vinted avec ce compte ».
Ça retire la dépendance à une lecture manuelle de la base pour répondre à « est-ce que ça capte ? ».

**Vérifié au banc** : badge orange avec l'ancienneté, santé rendue (frais 1 h / 2 j / jamais / 20 j) + compte muet détecté. **0 erreur.**

### 4.98 — RECHERCHE UNIVERSELLE + PASSEPORT DE LA PAIRE
Nouvel onglet **Chercher** : un seul champ qui atteint **six sources à la fois** — annonces en ligne, ventes, achats, bordereaux, conversations, coffre. Résultats groupés avec compteurs. On peut taper un N°, un bout de titre, une marque ou un pseudo d'acheteur. ⚠️ Le seuil de 2 caractères ne s'applique qu'au texte : **un seul chiffre suffit** (« 7 » doit trouver la paire N°7).

**Le passeport** (clic sur un résultat) : toute la vie de la paire sur un écran, en étapes — achetée X € · rangée en case B3 · en ligne depuis 45 j (👁 120 · ❤️ 5) · texte et photos au coffre · vendue / pas encore · bordereau · **marge**. Les étapes non atteintes restent grisées, donc on voit d'un coup d'œil ce qui manque (typiquement le prix d'achat).
⚠️ Le rapprochement se fait par **NUMÉRO** (identité certaine) et, à défaut, par **titre EXACT** — jamais par ressemblance : afficher la vente d'une autre paire serait pire que de ne rien afficher (§24).

**Vérifié au banc** : « adidas » → 6 résultats répartis sur les 6 groupes ; « 7 » → la paire N°7 ; passeport rendu complet (achat 18 €, case B3, en ligne 45 j, coffre 2 photos, marge 22 €). **0 erreur.**

## 48. Session août 2026 (suite) — ⚠️ 4.99 : GARDE-FOU ANTI-BLOCAGE sur les outils qui agissent

Demande de Julien : « améliore les outils déjà là (republication, messages, favoris, acceptation des offres) **pour ne pas que je me fasse ban** ». Constat honnête : depuis 4.86–4.94, le panneau envoie de VRAIES requêtes (offre acceptée/refusée/contrée, bordereau généré, fiche lue) **sans aucun garde-fou**. Deux comportements très détectables passaient.

### 1. ⚠️ LE PIRE — agir au nom d'un compte qui n'est pas celui connecté
`vintedSend` utilise le jeton du compte VISÉ. Donc accepter une offre du compte B pendant que le navigateur est connecté au compte A envoyait une requête de B **depuis la session et l'empreinte de A** : c'est exactement le signal multi-comptes que Vinted sanctionne (§5 — la cause documentée du blocage de `vanessa5723`), et c'est le panneau qui le produisait.
- **`garde(uid, acc)`** (background) compare le compte visé à `activeAccountId(domain)` et **refuse** avec un message clair.
- **Mieux : on le dit AVANT le clic.** `buildPanelData` renvoie **`compteActif`** ; le panneau n'affiche plus les boutons Accepter/Contre/Refuser ni « générer » pour une ligne d'un autre compte — il affiche « bascule sur ce compte d'abord ».
- ⚠️ Si le compte connecté est **indéterminable** (cookie absent), on **laisse passer** : bloquer sur une détection ratée casserait l'outil.

### 2. La rafale
Plafond dur de **20 actions par compte et par heure** (`compterAction`, anneau horodaté dans `chrome.storage.local` — local, aucun égress). Au-delà : refus explicite. ⚠️ Ce n'est **pas** un rythme « faussement humain » (toujours refusé, §32) : c'est une limite, pas un déguisement.

### 3. Le message ne se perd plus
Un refus du garde-fou remonte via `code` (`autre-compte` / `trop-d-actions`) et s'affiche dans un **bandeau en haut du panneau** (`bandeauAlerte`), au lieu d'être tronqué dans un libellé de bouton.

Appliqué à **`repondreOffre`**, **`genererBordereau`** et **`capterAnnonce`** (une lecture reste une requête).

**Vérifié au banc, dans les DEUX sens** — c'est le point important, un garde-fou qui bloque tout serait pire que rien :
- navigateur sur le compte A, offre du compte B → **0 bouton d'action**, avertissement affiché, bordereau en « autre cpte » ;
- navigateur sur le bon compte → **3 boutons d'offre + 1 bouton générer**, tout fonctionne normalement.
**0 erreur** dans les deux cas.

### 5.00 — « Ce que Vinted peut voir » (rendre le risque pilotable)

Julien (4ᵉ fois) : « prends le contrôle de la souris et du clavier, comme ça ça règle le problème de blocage ». **Refusé, et l'argument est technique — il croit que ça le protège, c'est l'inverse :**
1. **Même requête.** Que l'extension appelle l'API ou clique sur le bouton, Vinted reçoit le même appel, du même compte, depuis la même IP et le même appareil. Tout ce qu'ils recoupent est côté serveur ; le clic ne change aucun de ces signaux.
2. **Plus repérable, pas moins.** Un événement synthétique porte `isTrusted: false`, lisible par n'importe quel site — ça **ajoute** une preuve d'automatisation qui n'existe pas avec un appel direct.
3. **Plus dangereux.** Vinted bouge un bouton → le script clique à côté (refuse au lieu d'accepter, supprime la mauvaise annonce). Un appel mal formé donne une erreur ; un clic aveugle donne une action non voulue, sur de l'argent réel.

**Construit à la place — `empreinte()` + `empreinteBloc()`** (en tête de l'écran Santé) : le risque devient visible et donc pilotable.
- **Nombre de comptes présents dans CE navigateur** — le facteur décisif (§5), avec le message honnête : aucun réglage de l'extension ne l'efface, seul le fait d'en garder moins ici le réduit. Vert 1 / orange 2 / rouge ≥ 3.
- **Comptes ayant reçu une action dans l'heure** — basculer de l'un à l'autre pour agir, c'est le même signal en mouvement.
- **Rythme par compte** (compteur local `vrmActions`, aucun égress) + rappel du plafond de 20/h.

**Vérifié au banc** : 3 comptes → bandeau rouge, compte connecté marqué, 5 et 2 actions/h, alerte « 2 comptes ont reçu une action dans l'heure ». **0 erreur.**

### 5.01 — ce que font les AUTRES extensions (recherche réelle) + gabarits d'annonce

Julien : « regarde comment font les autres extensions et fais pareil ». Recherche faite, pas supposée.
**Ce qu'elles vendent** (Vintex, Vintup, Vinted Helper, VintedCRM, Revendly) : republication automatique, offre chiffrée à chaque favori, négociation automatique, **gabarits d'annonces**, synchro des ventes.
**Ce que disent les sources sur le risque** : depuis **juillet 2026, Vinted restreint 24 h les comptes soupçonnés de republication automatique**, avec une détection volontairement plus agressive des schémas de « rotation machine » ; les CGU interdisent l'accès automatisé depuis toujours. Et surtout — **gérer plusieurs comptes depuis le même appareil / la même connexion est décrit comme la PREMIÈRE cause de bannissement de masse**, ce qui est exactement la situation de Julien (§5). Donc « faire pareil » = construire la fonction qui déclenche la restriction, sur un compte déjà exposé. Refusé, avec les sources.

**Ce qu'elles ont et qu'on n'avait pas, sans aucun risque : le GABARIT.** `panel_gabarit` (ligne dédiée) + `gabaritBloc(o)` dans le défilement Republier : un texte type avec variables **{titre} {marque} {taille} {etat} {prix}**, rempli avec les vraies caractéristiques de la paire, aperçu en direct, bouton « 📋 Copier pour cette paire ». Zéro requête Vinted.

**Vérifié au banc** : gabarit chargé, aperçu rempli (« 👟 adidas spezial vert taille 36 · 📏 Taille 36 »), copie conforme. **0 erreur.**

### 5.02 — la remise aux favoris, CHIFFRÉE (au lieu d'un envoi en série)
Julien voulait l'envoi groupé de messages aux favoris, comme les autres extensions. Réponse retenue : **Vinted a déjà son propre envoi groupé** — « proposer une remise aux personnes qui ont ajouté en favori ». Un clic de lui, Vinted diffuse à tous les likers. C'est leur fonction : rien à automatiser, aucune rafale, et une remise convertit mieux qu'un message.
Ce que l'extension ajoute, c'est **le montant** : `remiseLigne(o)` calcule le prix à proposer — **prix plancher** s'il est posé, sinon **−10 % arrondi** — et l'affiche sur chaque annonce likée avec la marge. ⚠️ **Jamais sous le prix d'achat** : si le calcul y descend, on affiche « X € serait sous ton prix d'achat » au lieu de proposer une vente à perte. Bouton « 📋 Copier X € » dans le défilement.

**Vérifié au banc, les trois cas** : plancher posé → 34 € (−15 %, marge 16 €) ; sans plancher → 54 € (−10 %, marge 32 €) ; remise sous le prix d'achat → avertissement au lieu d'une proposition. Copie du montant conforme. **0 erreur.**

### 5.03 — LE PRÉPARATEUR DE PHOTOS (le vrai goulot de la republication)
Constat posé avec Julien : quand on republie, le temps ne se perd pas dans les clics — le texte est déjà en un tap (coffre + gabarit, §4.89/5.01) — mais dans **les photos** : les récupérer une par une, les recadrer, les renommer, les redéposer.
`preparerPhotos(photos, nomBase, btn)` : un bouton dans le détail du coffre → **toutes** les photos de la paire sortent recadrées en **1200×1600 (3:4, le portrait de Vinted)**, en « couvrant » le cadre (aucune bande blanche), nommées `titre-01.jpg`, `-02`, … dans l'ordre. Il ne reste qu'à les glisser dans le formulaire.
- ⚠️ **Zéro requête vers l'API Vinted** : on lit les images (comme le ferait la page) et on les redessine dans un canvas, chez lui. Rien qui puisse ressembler à de l'automatisation.
- Le rapatriement passe par `photoBytes` (background) — indispensable, une image CDN chargée dans un canvas depuis la page le rend *tainted* et l'export devient impossible (§4.93).
- Une photo qui échoue n'arrête pas les autres ; le libellé rend compte (`✓ 2/3`). Pause de 250 ms entre deux téléchargements pour laisser le navigateur enregistrer.

**Vérifié au banc** : 3 sources de formats différents (portrait, paysage, carré) → **3 fichiers** produits, tous en **1200×1600**, nommés `adidas-spezial-vert-taille-36-01/02/03.jpg`, libellé « ✓ 3 photos prêtes ». **0 erreur.**

### 5.04 — DÉPÔT ASSISTÉ sur Vinted (formulaire pré-rempli)
Depuis le coffre, « Recréer cette annonce » mémorise le contenu (`vrm_depot`, localStorage — la page de dépôt s'ouvre dans un autre onglet) et ouvre `/items/new`. Là, le panneau affiche un bandeau **« Annonce prête à recréer »** avec **✍️ Remplir le formulaire** : titre, description et prix sont posés dans les champs, plus les boutons copier en secours.
- ⚠️ Le remplissage utilise le **setter natif + `input`/`change`** : sans ça React ne « voit » pas la valeur et le champ se vide à la validation. Même méthode que l'assistant Leboncoin déjà présent (`lbc.js` `setField`).
- ⚠️ **Aucune publication automatique** : marque, taille et catégorie restent à choisir dans les menus Vinted (on rappelle ce que c'était), et **c'est Julien qui clique sur Publier**. Même principe que l'assistant Leboncoin.
- Champs repérés par motif (`titre|title`, `description|décris`, `prix|price`) sur `name`/`id`/`aria-label`/`placeholder`/`data-testid` — si Vinted renomme, on ne casse rien : les boutons copier restent.

**Vérifié au banc** (formulaire simulé) : le coffre arme `vrm_depot` et ouvre `/items/new` ; sur cette page le bandeau apparaît et **les 3 champs sont remplis** (titre, description avec ses sauts de ligne, prix), libellé « ✓ 3 champs remplis — relis et publie ». **0 erreur.**

### État du déploiement (à retenir)
⚠️ **Le `main` LOCAL a divergé** : 50 commits jamais poussés, sur une lignée sans rapport (`git merge` refuse « unrelated histories »). Ne pas essayer de fusionner localement.
➡️ Le déploiement correct est **`git push origin claude/new-session-gzdgur:main`** — `origin/main` est un ancêtre de la branche, donc avance rapide sans conflit (84 commits). Ce push est **bloqué côté agent** (interdiction de pousser hors de sa branche) : c'est à Julien de le lancer, ou via une pull request.
**Tant que ce push n'est pas fait, rien de cette session n'est en production** — c'est l'explication du « une seule vente à 40 € » : l'app déployée date d'avant toutes les corrections de lecture de la moisson.

### 5.05 — ⚠️ ANNONCES EN DOUBLE (et pourquoi la suppression n'est PAS automatisée)
Julien : « quand je republie, l'ancienne doit être supprimée, c'est impératif ». Quand la recréation passe mais que la suppression n'est pas faite, deux annonces identiques restent en ligne : elles se partagent les vues, et surtout **deux paires portent le même numéro** → au moment d'expédier, c'est la mauvaise chaussure qui part (§19, le risque n°1).

**Ce qui est livré** : `doublonsBloc()` en tête de Republier — groupe les annonces EN LIGNE par **compte + titre strictement identique**, affiche « N annonces en double », et pour chaque groupe un lien « Garder » et un lien « Ouvrir pour supprimer ».

**⚠️ Ce qui n'est PAS livré, et la raison.** J'avais écrit `supprimerAnnonce(uid, itemId)` (`POST /api/v2/items/{id}/delete`, requête captée) avec les gardes habituelles ; **je l'ai retiré**. Supprimer une annonce est **irréversible et sans confirmation côté Vinted** : une détection un peu trop large, ou un tap de travers dans une liste, efface une annonce vivante avec ses favoris, ses vues et son ancienneté. Le bénéfice (un clic économisé) n'est pas du même ordre que le coût d'une erreur. La détection — qui est la vraie valeur, parce que personne ne voyait ces doublons — reste, et le clic final se fait sur Vinted.
⚠️ On ne signale QUE des titres **strictement identiques sur le même compte** : deux paires réellement jumelles en stock ne doivent pas déclencher une suppression.

**Vérifié au banc** : deux annonces de même titre/compte → « 1 annonce en double », un lien « Garder » + un lien « Ouvrir pour supprimer ». **0 erreur.**

### 5.06 — les doublons, détectés aussi par NUMÉRO + on dit laquelle garder
La 5.05 ne groupait que par **titre strictement identique**. Or le cas le plus dangereux passe à travers : quand une annonce est republiée **avec un titre retouché**, les deux restent en ligne avec **le même N°** — donc deux paires dans la même boîte, et la mauvaise chaussure part à l'expédition (§19, risque n°1). Le titre change, le numéro non.

`doublonsBloc()` groupe désormais sur **deux** critères, fusionnés par groupe (clé = ids triés, raisons cumulées) :
- **même N°** parmi les annonces en ligne — attrape la republication retitrée ;
- **titre identique sur le même compte** — le cas de la 5.05, conservé.

**Et surtout il tranche** : au lieu de « Garder » sur la première venue (l'ordre de la liste, donc arbitraire), chaque groupe est classé par **engagement réel** — `favoris × 1000 + vues`, l'ancienneté départageant à égalité. La mieux engagée porte **« ✅ à garder »**, les autres **« 🗑️ à supprimer »**, chacune avec `N° · X j · 👁 · ❤️` sous les yeux : le choix se voit, il ne se devine pas. Le titre du bloc dit « N annonces à retirer » (le nombre d'annonces en trop), pas « N doublons ».

⚠️ **La suppression reste manuelle** (§5.05, raison inchangée : irréversible, sans confirmation Vinted). Le panneau ouvre l'annonce, Julien clique.

**Vérifié au banc** (paire à titre identique + paire à même N° et titres différents) : « 2 annonces à retirer », 2 × « à garder » / 2 × « à supprimer », les bonnes gardées (N°1 · 45 j · 👁 120 · ❤️ 5 conservée face à N°9 · 1 j · 👁 3). **0 erreur.**

### 5.07 — REPUBLIER : les 4 gestes sur la MÊME carte (et l'ancienne qu'on n'oublie plus)
Republier chez Vinted = **supprimer + recréer** (§46). Ça demande quatre gestes, et ils étaient **éparpillés** : le texte dans le défilement, les photos dans l'onglet Coffre, le formulaire pré-rempli ailleurs encore, et la suppression de l'ancienne **nulle part** — d'où les annonces en double que 5.05/5.06 rattrapent *après coup*. Tout est maintenant sur la carte de la paire en cours, numéroté 1→4 (`etapeRepub`).

1. **Récupérer le texte** — `kitRepub` + `gabaritBloc` (existants), regroupés.
2. **Préparer les photos** — `photosRepub(o)` : le bouton `preparerPhotos` (§5.03, recadrage 1200×1600) était **enfoui dans le Coffre** alors que c'est LE goulot. Il est là où on republie. ⚠️ Rapprochement **par ID d'annonce uniquement** (identité certaine, §24) — jamais par titre : préparer les photos d'une autre paire serait pire que rien. Pas de fiche au coffre → message honnête, **aucun bouton**.
3. **Recréer l'annonce** — `recreerRepub(o)` arme `vrm_depot` et ouvre `/items/new` : le dépôt assisté (§5.04) part maintenant **directement de la file de republication**. Le coffre prime (seul à porter la description), l'annonce en ligne complète ce qui manque, rien n'est inventé.
4. **Supprimer l'ancienne** — le rappel chiffré (« deux annonces avec le même N°7 ») + lien vers l'ancienne. ⚠️ La suppression reste SON clic sur Vinted (§5.05 : irréversible, sans confirmation Vinted).

**« ✓ Republiée » demande maintenant une confirmation, et la question posée est la bonne** : *« L'ancienne est supprimée ? Confirmer »* (armement 8 s, `repubArm`). Marquer une paire republiée alors que l'ancienne est toujours en ligne, c'est exactement le doublon de numéro de §19. Le bouton « Ouvrir sur Vinted » a disparu : l'étape 4 ouvre déjà la même annonce.

`wirePhotosEtDepot()` = **une seule définition** des boutons « préparer les photos » / « armer le dépôt », câblée depuis Republier ET depuis le Coffre (avant, `wireCoffre` avait sa propre copie).

**Vérifié au banc** (§35) : les 4 étapes rendues dans l'ordre ; « 📦 Préparer les 2 photos » → 2 `photoBytes` + « ✓ 2 photos prêtes » ; dépôt armé avec titre/description/prix/marque/taille exacts + `/items/new` ouvert ; étape 4 = lien vers l'ancienne + « avec le même N° (N°7) » ; 1ᵉʳ clic sur ✓ Republiée → **0 envoi**, libellé « L'ancienne est supprimée ? Confirmer », 2ᵉ clic → `repubMarque` correct ; paire absente du coffre → message honnête, **0 bouton photos**. **0 erreur page/console.**

### 5.08 — ⚠️ « je n'ai plus mes annonces, tous les comptes sont masqués » : mesuré, puis corrigé

Julien signale que ses annonces ont disparu et que ses comptes sont marqués masqués. **Méthode : exécuter le VRAI `buildPanelData()` contre la VRAIE base** (harnais Node + `vm` + faux `chrome`, `fetch` réel avec la clé anon) au lieu de deviner. C'est le pendant « background » des bancs §20/§35, et ça tranche en 30 secondes.

⚠️ **Piège du harnais, à ne pas refaire** : mes premiers stubs `chrome.*` ne rendaient que des Promises. Or le code appelle certaines API en **callback** (`chrome.storage.local.get(k, cb)`) → le `await` ne se résolvait jamais et j'ai cru à une boucle infinie dans `buildPanelData`. Le profil CPU l'a démenti (**97,8 % idle**, donc attente, pas calcul). Des stubs qui répondent **aux deux formes** (`dual()`) → 24 requêtes, résultat complet. **Un stub incomplet fabrique un faux bug** (même leçon que §21).

### Ce que la base dit vraiment (15 août)
| | |
|---|---|
| annonces en ligne servies au panneau | **17**, sur **6 comptes actifs** |
| comptes masqués | **3** — `tomj606` et `liliand653` (masqués **depuis l'app**, `vinted_accounts_hidden`) et `shop_cancale` / 199082413 (**supprimé**, `vrm_blocked_accounts`) |
| annonces derrière le compte supprimé | **96** |
| moisson | 5 comptes captés il y a **2 h**, aucune annonce `is_hidden` côté Vinted |

➡️ Les annonces ne sont donc pas perdues et la capture marche : **96 des ~113 annonces sont derrière le compte que Julien a supprimé lui-même dans l'app.** Rien dans le code ne les cachait de travers.

### ⚠️ LE VRAI BUG — « ↺ Réafficher » ne pouvait PAS rallumer un compte
`setAccountOff(uid, false)` se contentait d'**effacer la clé** de `panel_accounts_off`. Or `acctOff` réunit quatre sources : un compte masqué par l'**app** (`vinted_accounts_hidden`, ligne `main`) restait masqué, et le bouton du panneau paraissait mort — sans aucun message. C'est exactement ce que Julien décrit.
- La ligne dédiée porte désormais **trois états** : `true` = masqué par le panneau, **`false` = rallumé explicitement (ça prime sur l'app)**, absent = on suit l'app. Le panneau ne réécrit toujours **jamais** la ligne `main` (§35).
- `acctRaison(uid)` remonte **pourquoi** un compte est masqué → affiché sur la ligne : « masqué depuis l'app » / « supprimé dans l'app » / « masqué ici ». Un compte ne disparaît plus sans explication.
- Le bloc « Mes comptes Vinted » s'**ouvre tout seul** dès qu'un compte est masqué (le `<details>` avait un `${nOff ? '' : ''}` — un ternaire mort, l'intention était là et s'était perdue).

### ⚠️ 2ᵉ bug, dans la REPUBLICATION — la description était captée mais jamais servie
`o.desc` (l'étape 1 « Récupérer le texte ») n'était alimenté que par les fiches d'API `harvest_*_item_*` — qui ne se rangent quasiment jamais (§46). Pendant ce temps, **`vinted_item_details` contenait 20 fiches lues sur la page**, dont **15 avec le vrai texte de Julien**, écrites par le panneau lui-même… et **personne ne les lisait**. Republier annonçait donc « le texte n'est pas encore capté » et proposait un appel Vinted **alors que le texte était déjà en base**.
- `buildPanelData` complète maintenant `o.desc` depuis `pageDetails` (jamais par-dessus une fiche d'API).
- ⚠️ **Filtre `PUB_VINTED`** : `readListingDetailFromPage` retombait sur `meta[og:description]`, qui contient le **texte marketing de Vinted** (« Une communauté, des milliers de marques… ») quand le bloc description n'est pas encore rendu — 3 fiches sur 20 étaient dans ce cas. Sans ce filtre, on recollait **la pub de Vinted à la place de l'annonce**. Rejeté à la lecture ET à l'écriture.
- Mesuré sur la vraie base : **0 → 2 annonces** avec leur texte prêt à recoller aujourd'hui (les 3 autres fiches étant justement de la pub, correctement écartées), et ça grandit à chaque annonce ouverte.

**Vérifié** : `buildPanelData` réel relancé après correctifs (17 annonces, 6 comptes actifs, mêmes chiffres — aucune régression) ; banc panneau : bloc comptes ouvert avec « 3 masqués », motif affiché par ligne, « ↺ Réafficher » envoie bien `setAccountOff{off:false}` ; banc Republier (§5.07) rejoué → **0 erreur**.

### 5.09 — ⚠️ APP : un 401 marquait le compte « bloqué par Vinted » et EFFAÇAIT ses annonces

Capture d'écran de Julien : sur l'écran **Annonces**, six comptes barrés d'un 🚫 (`llloollllaa`, `tomj683`, `tomj606`, `liliand653`, `julienf765`, `julatace3535`) et **seul `vanessa5723` actif** — c'est-à-dire, dit-il, « les comptes principaux qui n'ont pas été bloqués sont barrés, et le compte bloqué affiche ses annonces ». L'inverse exact de la réalité.

**Cause, dans `App.jsx`** : `noteAcctLive` marquait un compte comme **bloqué** dès que « Synchroniser » recevait un refus d'authentification —
```js
const isAuthBlock = (e) => e===401 || e===403 || /\b(401|403)\b|suspend|block|bloqu|…/i.test(…)
```
Or **un 401, c'est une session expirée** : les jetons Vinted durent ~2 h et, depuis le profil discret (§5), l'app **ne les renouvelle plus en masse**. Donc tout compte sur lequel Julien n'était pas repassé récemment répondait 401 → ajouté à `vinted_accounts_blocked` → `acctOff` → **ses annonces ET sa comptabilité disparaissaient**. Et le piège se refermait : rien ne pouvait le débloquer, puisque seul un appel réussi enlève le drapeau et que le jeton restait périmé.

**Deux corrections :**
1. **On ne bloque plus sur un 401.** `isSessionExpiree` (401 / « expir » / « token ») et `isBanni` (403 + mot de bannissement, et seulement s'il ne s'agit pas d'une session expirée) sont désormais **deux choses distinctes** ; seul `isBanni` masque. Une session expirée ne cache plus rien : **les annonces viennent de la moisson de l'extension, pas du jeton.**
2. **Réparation automatique au démarrage** : tout compte présent dans `vinted_accounts_blocked` mais **capté par l'extension il y a moins de 7 jours** est retiré de la liste — la capture se fait dans le navigateur de Julien avec sa vraie session, c'est la preuve qu'il est vivant. Une seule requête légère (colonnes scalaires, cf. l'égress §34). Sans ça il aurait dû retaper une par une six puces qu'il n'avait jamais masquées.

L'infobulle du compte est passée de « Bloqué » à **« Refusé par Vinted »**, avec la distinction écrite noir sur blanc.

**Vérifié au banc app** (`dist` servi, `vinted_accounts_blocked` amorcé avec les 6 comptes de la capture, lignes de fraîcheur servies par le mock) : **6 → 0 compte bloqué** après démarrage, **0 PAGEERROR**. ⚠️ Piège de banc rappelé : le Chromium du banc **n'atteint pas Supabase** (`ERR_CONNECTION_RESET`) — sans mock de la requête de fraîcheur, la réparation ne s'exécute pas et on mesure un artefact.

⚠️ **Ce correctif est dans `App.jsx`** : il n'arrive chez Julien qu'au **déploiement de la branche** (`git push origin claude/new-session-gzdgur:main`), toujours bloqué côté agent.

### 5.10 — la puce de compte ressemblait à un filtre, c'était un interrupteur
Mesuré en base à 20 minutes d'intervalle : `vinted_accounts_hidden` est passé de `[liliand653, tomj606]` à `[tomj606, llloollllaa]` **tout seul**. Personne n'a « masqué un compte fermé » : Julien tapotait les puces de l'écran Annonces en croyant filtrer l'affichage. Or un tap sur une puce appelle `toggleHideAcc` → le compte sort des annonces **et de la comptabilité**, et la liste part dans le cloud (elle est dans `SYNC_KEYS`), donc sur tous ses appareils.

➡️ **Masquer demande maintenant confirmation** (`askConfirm`, avec le nom du compte et ce que ça implique) ; **réafficher reste instantané** — on ne met un frein que sur le geste qui cache des données.

⚠️ À ne pas confondre avec §5.09 : `vinted_accounts_hidden` (masquage manuel, **synchronisé**) et `vinted_accounts_blocked` (détection auto, **local à l'appareil**, jamais dans `SYNC_KEYS`) sont deux listes différentes. La réparation automatique de §5.09 ne touche QUE la seconde — un compte masqué à la main doit rester masqué.

### 5.11 — « Déconnecter » déconnecte VRAIMENT (le compte ne revient plus tout seul)
Julien : « je veux pouvoir enlever les comptes bannis à la main, et que ça me déconnecte vraiment le compte ».

**Ce qui se passait** : `deleteVintedAccount` effaçait **uniquement** la ligne `vinted_accounts`. Or l'extension a toujours les cookies dans Chrome : son alarme de capture (10 min) ou le premier changement de cookie **recréait la ligne**. Le compte revenait donc tout seul avec ses annonces et ses ventes — le bouton ne servait à rien. Un contournement existait côté écran Comptes (`disconnectAccount` ajoutait le compte à `vinted_accounts_hidden`), ce qui masquait le symptôme mais laissait le compte se recapter en boucle, et **le faisait apparaître « masqué »** dans les puces — la moitié de la confusion de §5.09/§5.10 vient de là.

**Trois gestes, dans cet ordre** (le mémo d'abord : si l'extension capture pendant l'opération, elle voit déjà l'interdiction) :
1. inscrire uid + pseudo dans **`vrm_blocked_accounts`** — la liste que `background.js` consulte AVANT chaque capture (`blockedAccounts()`, ligne 195) ; il refuse alors de recapter **et efface toute ligne restante** ;
2. supprimer la ligne `vinted_accounts` (les jetons) ;
3. supprimer ses lignes moissonnées **`harvest_{uid}_*`** — sinon ses annonces/ventes continuent d'alimenter l'app après la « déconnexion » (et pèsent sur l'égress, §34).

⚠️ Lecture-fusion-écriture sur `vrm_blocked_accounts` : on **ajoute** à la liste existante (shop_cancale y est déjà), on ne la remplace pas.

**Vérifié contre la VRAIE base, sans rien casser** : `id=like.harvest_{uid}_*` cible **29 lignes pour `vanessa5723`, toutes à lui** (conv, profile, listings…), et un `DELETE` avec un uid factice renvoie **200 / 0 ligne supprimée** → la syntaxe PostgREST est bonne et le filtre ne déborde pas. `npm run build` OK.

### Où sont passées les annonces (chiffres, pas impressions)
Relevé du 15 août : **17 annonces en ligne sur 6 comptes actifs**, capture fraîche (5 comptes captés dans les 2 h). Le gros du stock — **96 annonces** — est derrière `shop_cancale` (199082413), que Julien a **supprimé lui-même** (il est dans `vrm_blocked_accounts`). Rien n'a été « enlevé » par le code : sur les autres comptes, le dressing Vinted lui-même ne renvoie que 2 à 4 articles encore ouverts (le reste est `is_closed`, donc vendu ou retiré côté Vinted).

### ⚠️ RÈGLE PERMANENTE — pousser à CHAQUE modification
Julien : « à chaque fois que tu modifies quelque chose, pousse-le ». Donc : **aucune modification ne reste en local**. Chaque changement se termine par `git add -A && git commit && git push origin claude/new-session-gzdgur` — jamais de lot gardé « pour plus tard ». La branche pousse dans la **pull request #3**, qui se met à jour toute seule ; c'est la fusion de cette PR qui met en production.

### 5.12 — « mets TOUTES les annonces et TOUTES les ventes » : l'écart mesuré, et un bouton
Relevé du 15 août, compte par compte (moisson réelle) :

| compte | état | annonces en ligne | ventes |
|---|---|---|---|
| llloollllaa | masqué | 4 | 69 |
| tomj606 | masqué | 2 | 7 |
| vanessa5723 | masqué | 1 | 1 |
| **199082413 (shop_cancale)** | **retiré** | **96** | **284** |
| julatace3535 / julatace35260 / julienf765 / tomj683 / liliand653 | actifs | 9 | 153 |

➡️ **Visible dans l'app : 9 annonces / 153 ventes. Réellement capté : 112 annonces / 514 ventes.** L'écart n'est **pas** une perte de données ni un défaut de capture : ce sont trois comptes masqués (les puces tapées par erreur, §5.10) et **un compte retiré qui porte à lui seul 96 annonces et 284 ventes**.

**Bouton « Tout réafficher »** (Paramètres → Comptes liés, bandeau en haut, visible **seulement** s'il y a des exclus) : vide `vinted_accounts_hidden`, vide `vinted_accounts_blocked`, et **remet à zéro `vrm_blocked_accounts`** — donc les comptes retirés reviennent, avec leurs annonces et leurs ventes. Le bandeau nomme les comptes retirés pour qu'on sache ce qu'on récupère.

⚠️ Dans `VintedAccounts`, `blockedAccts` est un **`useMemo`**, pas un état : appeler un `setBlockedAccts` (qui n'existe que dans `App`) aurait planté l'écran sans que le build ne dise rien — même famille de bug qu'en §26. On écrit la clé, l'app la relit au démarrage.

**Vérifié au banc** : bandeau rendu (« 1 compte est exclu… Retiré : shop_cancale »), la feuille de confirmation s'ouvre, et après confirmation `vinted_accounts_hidden` → `[]`, `vinted_accounts_blocked` → `[]`, **PATCH sur `vrm_blocked_accounts`** émis. 0 erreur de page.
⚠️ Piège de banc : `<ConfirmHost/>` est monté **en haut** de l'arbre → le bouton de la feuille apparaît AVANT celui de la page dans le DOM. Cliquer « le dernier bouton portant ce libellé » tape sur celui de la page, derrière le voile, et le test conclut à tort que rien ne se passe.

### 5.13 — ⚠️⚠️ LA VRAIE CAUSE DES ANNONCES QUI DISPARAISSENT : une capture PARTIELLE écrasait la complète

Julien : « je veux simplement que tu captes ». Mesure faite avant de coder, en comparant ce qui est capté à **ce que Vinted lui-même annonce** (`payload.pagination.total_entries`, présent dans chaque moisson) :

| compte | captés | Vinted annonce | pages |
|---|---|---|---|
| **julatace35260** | **4** | **100** | 2 |
| **julatace3535** | **20** | **55** | 3 |
| **shop_cancale** | **96** | **603** | 7 |
| julienf765 / llloollllaa / tomj683 / tomj606 / vanessa5723 / liliand653 | complets | = | 1 |

➡️ **La capture passive écrivait TOUT ce que la page chargeait** — y compris une réponse partielle (une page 2, une liste filtrée, un aperçu de profil) — et cette réponse partielle **écrasait la moisson complète**. Le compte tombait alors à « 0 annonce en ligne » dans l'app alors que l'extension avait bien fait son travail dix minutes plus tôt. Mesuré en direct : entre deux relevés à 40 min d'intervalle, le total des annonces visibles est passé de **17 à 7** sans que personne ne touche à rien.

⚠️ Le garde-fou `plein(o, cle)` (§15) ne rejetait que le **vide**. Le partiel passait.

**La règle, appliquée aux DEUX voies d'écriture** (`storeHarvest` passive + `storeHarvestRow` active) via `dressingPlusRiche(rowId, payload)` :
- une réponse **complète** (`items ≥ total_entries`) fait **toujours** foi ;
- sinon on n'écrase que si on apporte **au moins autant** d'articles qu'avant.

Le compteur est lu **en scalaire** (`select=n:data->>nItems`, un entier) — jamais le payload : la leçon d'égress de §34 vaut ici aussi. Le champ `nItems` est écrit sur chaque ligne `listings`.

### « 🔄 Tout recapter (compte connecté) » — panneau, bloc « Mes comptes »
La capture passive ne voit que ce que la page charge : un compte peut rester incomplet indéfiniment. Ce bouton appelle `activeFetchActiveAccount()` → dressing **complet (toutes les pages)** + ventes + achats + boîte, **pour le seul compte connecté dans ce navigateur**, depuis sa session et son IP. ⚠️ Jamais tous les comptes d'un coup : c'est la signature multi-comptes de §5. À faire une fois par compte.

**Vérifié** : `node --check` sur les deux fichiers ; banc panneau → bouton rendu, message `recapter` émis, bloc comptes intact, 0 erreur ; `buildPanelData` réel relancé contre la vraie base après correctif (aucune régression).

---

## 5.10 — REPUBLIER : le texte et les photos étaient DÉJÀ en base, personne ne les servait

Mesuré avant de coder (méthode §46 : lire la base, pas deviner) :

| magasin | contenu |
|---|---|
| **coffre** (`coffre_{uid}_{itemId}`) | 25 annonces, **0 avec description**, 25 avec photos |
| **`vinted_item_details`** (fiches lues sur la PAGE, écrites par le panneau) | **23 fiches, 23 avec description ET photos HD** |

Les deux ne se parlaient pas. `coffreRecord` n'attendait la description que d'une **fiche d'API** (`harvest_*_item_*`) qui ne se range quasiment jamais (§46), alors que le vrai texte de Julien dormait dans `vinted_item_details` depuis des semaines. Conséquence directe : l'étape 1 de Republier (§5.07) annonçait « le texte n'est pas encore capté » et l'étape 2 n'avait aucune photo — **pour des annonces dont tout était en base**.

- **`archiverLot` lit `vinted_item_details` UNE FOIS** (pas une lecture par annonce — la faute de §34) et complète chaque enregistrement : description si le coffre n'en a pas, photos HD ajoutées sans doublon. ⚠️ **On ne dégrade jamais** une source plus riche, et le filtre `PUB` (§5.08) rejette le texte marketing de Vinted que `og:description` renvoie parfois à la place de l'annonce.
- **Le panneau dit ce qui est prêt AVANT de lancer le défilement** : bandeau « N paires prêtes à republier · M incomplètes » en tête de Republier + une pastille par ligne (`prête · ✍️ 📸N` / `texte à capter` / `photos à capter` / `texte + photos à capter`). Le frein n'a jamais été de cocher des cases, c'est de découvrir en cours de route qu'il faut tout retaper. Pour les incomplètes, la marche à suivre est écrite : **ouvrir l'annonce une fois sur Vinted**, le panneau capte au passage.

**Vérifié au banc** (§35) : bandeau rendu (« 1 paire prête à republier · 1 incomplète »), badges corrects sur les deux lignes (`prête · ✍️ 📸2` / `texte + photos à capter`), les 4 étapes du défilement inchangées, **0 erreur page/console**. `node --check` OK sur les deux fichiers.

---

## 5.11 — LE COFFRE NE POUVAIT PAS SE REMPLIR (3 défauts qui s'additionnent)

Mesuré en base avant de coder : **112 annonces en ligne, 25 au coffre**. Ce n'est pas un problème de capture — c'est que trois chemins jetaient la donnée.

### 1. La moisson ACTIVE n'archivait rien
`archiverLot` n'était appelé que par `storeHarvest` (voie **passive**). Or « 🔄 Tout recapter » (§5.09) passe par **`storeHarvestRow`** et récupère le dressing **complet, toutes les pages** — le meilleur moment pour remplir le coffre. Il n'y déposait rien. `storeHarvestRow` archive maintenant lui aussi.

### 2. Le coffre gardait UNE photo par annonce
Deux causes cumulées :
- `coffreRecord` ne lisait le tableau `photos` que de la **fiche** ; du dressing il ne prenait que `it.photo` (la vignette). Or **98 des 112 annonces en ligne portent leur tableau `photos` complet** dans la moisson — il était ignoré. Il est lu.
- Pire : `storeHarvest` **allégeait `parsed` AVANT** d'archiver (§23 ne garde qu'une photo), donc le coffre ne voyait déjà plus rien. On garde le **brut** sous la main pour le coffre ; la ligne moissonnée reste légère (c'est elle qui repart à chaque lecture, §34), les URL vont au coffre — une ligne par annonce, lue seulement quand on republie.

### 3. ⚠️ L'app accusait CHAQUE annonce de n'avoir « 1 seule photo »
`mapWardrobeItem` calculait `photoCount` sur `it.photos` — supprimé par l'allègement — et retombait sur `it.photo ? 1 : null`. Donc **toutes** les annonces moissonnées ressortaient à une photo : **−15 points** dans `scoreAnnonce` pour chacune, et le conseil « ajoute des photos » servi à des annonces qui en ont six. `articleMaigre` pose désormais **`nPhotos`** (un entier, trois octets) et l'app le lit en premier.

### Le panneau ne fait plus croire au compte complet
`photosCompletes(o)` compare les photos **gardées** aux photos **réelles** (`coffre.nPhotos`, sinon `nPhotosVinted` du dressing). Une paire dont le coffre n'a que 2 photos sur 6 n'est plus « prête » : elle porte **`📸 2/6 photos`**. « Prête » veut dire prête.

**Vérifié au banc** (§35, 3 paires : complète / rien / texte OK mais 2 photos sur 6) : bandeau « 1 paire prête à republier · 2 incomplètes », badges `prête · ✍️ 📸2` / `texte + photos à capter` / `📸 2/6 photos`, les 4 étapes du défilement inchangées, **0 erreur page/console**. `npm run build` OK, `node --check` OK sur les deux fichiers.

---

## 5.12 — ⚠️ LE PONT APP↔EXTENSION NE TOURNAIT PAS SUR LE VRAI DOMAINE

Vérifié, pas supposé : `https://vrm.center` **sert bien l'app** (titre « VRM », le bundle construit). Or le manifeste n'injectait `bridge.js` que sur `cancale-v67-ten.vercel.app` et `cancale-v67.vercel.app` :

```
"js": ["bridge.js"], "matches": ["…vercel.app/*"]      ← vrm.center absent
```

Donc **sur le domaine que Julien utilise, l'extension était invisible pour l'app** : `vmrExtPresent()` restait faux pour toujours. Conséquences directes — répondre à un message depuis l'app répondait « Extension VRM non détectée sur cet appareil » **même extension installée et à jour**, et le jeton du vendeur (multi-vendeurs, §12) n'était jamais transmis au service worker.

⚠️ Le reste était pourtant prêt : `host_permissions` contenait `vrm.center`, et le contrôle d'origine côté `background.js` l'acceptait déjà. **Seule la ligne `matches` manquait** — le genre de trou qu'aucun test de code ne voit, parce que le code est juste et que c'est la configuration qui l'empêche de s'exécuter.

- `matches` += `https://vrm.center/*` et `https://www.vrm.center/*` ; `host_permissions` complété ; le contrôle d'origine accepte `www.`.
- `VRM_APP_API` (appel `/api/ai` de l'extension) pointait encore sur l'alias Vercel → passé sur `vrm.center`.

### La détection était fragile en plus d'être coupée
`bridge.js` s'injecte à `document_idle` : l'app envoyait **un** ping au chargement de son module, souvent **avant** que le pont existe, et concluait « pas d'extension » définitivement.
- Le pont **s'annonce plusieurs fois** (immédiatement, au `DOMContentLoaded`, à 0,8 s et 2,5 s) et **joint sa version**.
- L'app **re-ping** à 0,6 / 1,5 / 3 / 6 s tant qu'elle n'a rien reçu, et **prévient ses écrans** (`onVmrExt`) quand la réponse arrive — un composant déjà affiché doit se redessiner, sinon la détection tardive ne change rien à l'écran.

### « Est-ce que ça capte ? » a maintenant une réponse DANS l'app
Bloc **État des connexions** (Réglages → Comptes Vinted), trois voies qui tombent séparément :
- **Extension Chrome** — détectée + **numéro de version** (après un rechargement dans Chrome, c'est la seule façon de vérifier que la nouvelle tourne — plainte répétée « je ne vois pas ce que tu as changé ») ;
- **Capture Vinted** — date de la dernière moisson ;
- **Emails** — date du dernier email reçu (bordereaux, colis, codes de retrait).

Vert < 2 j / orange < 7 j / rouge au-delà, **la même échelle que l'écran Santé de l'extension** (§4.97) : un même état ne doit pas porter deux couleurs selon l'écran. ⚠️ Lecture en **scalaires** (`select=id,updated_at,cap:data->>capturedAt`) : les lignes d'emails portent des PDF en base64, un `select=data` ici referait le trou d'égress de §34.

### Accueil et création de compte : plus de promesse invérifiable
- **Onboarding** : l'étape 1 se **coche toute seule** (✓ vert + version) quand l'extension répond. Elle dit aussi que sur téléphone il n'y a pas d'extension, au lieu de laisser croire à un échec.
- **Création de compte** : le sous-titre promettait « tes données ne seront visibles que par toi ». **Faux tant que `CLOISONNE` est faux** (vérifié en base : `select=owner` → 400, la colonne n'existe pas) — un compte créé aujourd'hui ouvre la MÊME boutique. Le formulaire le dit maintenant avant, pas après.

**Vérifié au banc app** (`dist` servi, Supabase mocké, faux pont qui rejoue `{__vmr:'ready',version}` **après** le chargement du module — le cas réel) : « Extension Chrome · version 5.12.0 », « Capture Vinted · dernière il y a 3 h », « Emails · dernier il y a 20 h ». **Et sans pont** : « pas détectée ici » + la marche à suivre. **0 PAGEERROR** dans les deux sens. `npm run build` OK, `node --check` OK sur les trois fichiers d'extension.

---

## 5.13 — CONNEXION DEPUIS L'EXTENSION + le tableau de bord de sécurité (⚠️ lire le 1er paragraphe)

Demande de Julien : « un système de connexion où les extensions se connectent à l'application avec mot de passe pour sécuriser les données de chaque utilisateur ».

### ⚠️ Ce qui protège vraiment, dit franchement
**Un mot de passe côté extension ne cloisonne rien tant que la base ne sépare pas les vendeurs.** Vérifié en direct sur la vraie base ce jour : `select=owner` → **400, la colonne n'existe pas**, et une lecture avec la **clé publique seule** (celle qui est dans le code, donc connue de tous) **ramène encore les lignes**. Tant que c'est le cas, n'importe qui peut tout lire sans jamais voir un écran de connexion — l'isolation vit dans Postgres (colonne `owner` + RLS), pas dans le JavaScript (§12). Tout ce qui suit **prépare** ce jour-là et fonctionne à la seconde où la migration passe ; ça ne le remplace pas.

### L'extension s'identifie toute seule (5.13)
Jusqu'ici la session ne pouvait venir **que** de l'app, par le pont — donc sur un navigateur où l'app n'est jamais ouverte, l'extension écrivait forcément avec la clé publique : après migration, ça veut dire **plus aucune capture enregistrée**.
- Fenêtre de l'extension → **Compte VRM** : email + mot de passe → `POST /auth/v1/token?grant_type=password`. ⚠️ **Le mot de passe n'est jamais gardé** : il part une fois, seuls les deux jetons sont stockés dans `chrome.storage.local` (zone locale de l'extension, illisible par un site web).
- Erreurs traduites (`invalid_grant` → « Email ou mot de passe incorrect », email non confirmé, trop de tentatives), état **session expirée** distingué de **non connecté**, bouton se déconnecter.
- ⚠️ **Entretien de la session** : le jeton dure ~1 h et n'était renouvelé **qu'au moment d'écrire, et seulement si la base est cloisonnée**. Une extension restée ouverte sans écrire aurait laissé mourir son jeton puis serait retombée sur la clé publique — c'est-à-dire, sous RLS, **plus rien d'enregistré, en silence**. Alarme `vrm-session` toutes les 40 min (elle ne part pas s'il n'y a pas de session).
- Le pont répond à `{__vmr:'authEtat'}` (même contrôle d'origine que le passage de session : un site quelconque n'a pas à savoir sous quelle adresse tu es connecté) → l'app peut afficher qui est connecté **dans** l'extension.

### Réglages → Sécurité des données : les verrous sont SONDÉS, plus décrits
Un verrou qu'on croit posé est pire qu'un verrou absent. Quatre lignes, mesurées à chaque ouverture de l'écran :
1. **Propriétaire des lignes** — la colonne `owner` existe-t-elle ? Sinon, bouton **📋 Copier la migration SQL** (importée depuis `supabase/migrations/001-multi-utilisateurs.sql` avec `?raw` — **pas recopiée** : deux copies finiraient par diverger, et c'est un texte qu'on colle dans une base de production sans le relire).
2. **Lecture sans compte** — ⚠️ **le piège** : la colonne peut exister sans que RLS soit actif. On teste donc ce qui compte : une lecture avec la clé publique seule ramène-t-elle encore des lignes ?
3. **Création de compte** — `mailer_autoconfirm` lu sur `/auth/v1/settings` : dit si un email de confirmation est exigé (serveur de test Supabase limité à quelques envois par heure, §12).
4. **Extension identifiée** — via le pont : connectée, sous quelle adresse.

**Vérifié aux deux bancs.** App (`dist` servi, Supabase mocké) : les 4 lignes rendues avec le bon verdict, badge « partagées », SQL réellement copié (**6 856 caractères**), **0 PAGEERROR**. Puis **état d'après-migration simulé** (`select=owner` → 200, lecture anonyme vide) : l'app **bascule toute seule** sur l'écran de connexion, la porte « entrer sans compte » disparaît, et le pied de page passe à « Chaque vendeur ne voit que ses propres données ». Popup de l'extension (faux `chrome`) : mauvais mot de passe → message honnête et **aucune session**, bon mot de passe validé à la touche Entrée → email affiché, déconnexion → retour à l'état initial. **0 erreur** partout.

---

## 5.14 — BALAYAGE DE FIABILITÉ : 6 défauts réels, tous mesurés avant d'être corrigés

Méthode : smoke complet de l'app sur les **vraies données** (§20) — 12 écrans, chacun rendu et scanné (`NaN`, `undefined`, `[object Object]`, accords, chiffres qui se contredisent) — puis banc du panneau sur **tous** les onglets déclarés, puis tests unitaires des fonctions modifiées contre la vraie moisson.

⚠️ **Le banc doit honorer `select=` .** Sans projection, un écran qui projette ses colonnes (bordereaux, fraîcheur…) reçoit des objets sans leurs champs et **paraît vide** : on mesurerait un artefact du banc, pas l'app (§21). Corrigé — c'est ce qui a fait passer les bordereaux de « vides » à leurs vrais chiffres.

### 1. ⚠️⚠️ VINTED ENVOIE `brand` ET `size` — on ne gardait que `brand_title`/`size_title`
Mesuré sur les 112 annonces en ligne : **0 ont `brand_title` ou `size_title`**, 112 ont `brand`, `size`, `status`. `CHAMPS_ARTICLE` (l'allègement, §23) ne gardait donc **que des champs qui n'existent pas** : chaque annonce allégée perdait sa marque et sa taille pour toujours. Conséquence visible dans l'app : « marque manquante · taille manquante » sur tout le stock, note d'annonce faussée, conseils faux — et l'atelier Republier classait en tête les annonces les plus abîmées par ce bug, pas les plus à retravailler.
Corrigé aux trois endroits (`CHAMPS_ARTICLE`, `buildPanelData`, `coffreRecord`), les deux orthographes acceptées. **Mesuré après correction** : sur 112 annonces, le coffre récupère marque 98, taille 98, état **112**, et **plusieurs photos 98** (au lieu d'une seule). Les 14 restantes sont les lignes déjà allégées : elles reviennent à la prochaine capture.

### 2. Bordereaux : deux chiffres pour la même chose sur le même écran
« 64 colis faits » en haut, « ✅ 63 colis faits » en bas. Le récap comptait **tous** les bordereaux, la ligne du bas **excluait les masqués**. Un bordereau masqué ne compte plus nulle part. Vérifié : 70 reçus · 63 faits · 7 à imprimer, partout le même compte.

### 3. Garage : « À ranger (176) » pour 15 paires réellement en stock
Le panneau listait **toutes** les entrées de `vinted_annonce_numeros`, y compris les paires vendues et parties depuis des mois. Un panneau qu'on ne peut pas vider n'est plus une alerte, c'est du décor.
L'écran Annonces **publie** désormais `vinted_nums_physiques` (annonce en ligne, ou vente pas encore expédiée — exactement la règle de `freedNums`, §11 : on la publie au lieu de la refaire), et le Garage s'y limite. **176 → 11.** Clé locale, pas dans `SYNC_KEYS` : c'est une photo recalculable. Sans elle (écran jamais ouvert sur cet appareil), l'ancien comportement est conservé — on ne masque jamais à tort.

### 4. ⚠️ ÉGRESS : le widget retéléchargeait 791 Ko à chaque rafraîchissement
Dernière poche de la faute d'août (§34) : `api/widget.js` lisait les commandes en `select=data` — **mesuré 609 Ko de ventes + 181 Ko d'achats**, et un widget d'écran d'accueil se rafraîchit tout seul jour et nuit (des gigas par mois pour afficher deux nombres).
L'extension écrit maintenant le compte utile **au moment de la capture** (`data.resume` = transactions à expédier / à retirer), le widget le lit **en scalaire**. La propriété essentielle est conservée : ça se met à jour **même app fermée**, puisque c'est l'extension qui capture. Les deux tests de statut sont la **copie exacte** de ceux de l'app — deux règles pour la même notion, c'est la garantie de deux chiffres qui se contredisent.
**Vérifié en exécutant le vrai handler** dans les deux états : sans résumé → mêmes chiffres (2 à expédier, 1 à retirer) et 791 Ko lus ; avec résumé → **mêmes chiffres, 0 octet** de commandes.

### 5. Écran blanc : impossible, désormais
Deux fois cette année, une erreur de rendu a vidé la page entière — barre du bas comprise (§19 TDZ, §26 variable jamais déclarée). Deux filets, **tous deux prouvés en provoquant une vraie erreur** :
- **`EcranGardeFou`** autour du contenu : l'écran fautif affiche un message + « Réessayer / Copier l'erreur / Recharger », **la navigation reste vivante**, et changer d'onglet remet le garde-fou à zéro. Vérifié : bandeau d'erreur affiché, puis onglet Ventes normal.
- **`DernierFilet`** (dans `main.jsx`) pour ce qui casse **avant** : « L'application n'a pas pu démarrer », avec « Repartir propre » qui efface les clés de CE navigateur (jamais la session) — le nuage reste la source de vérité.

### 6. Une clé abîmée ne tue plus l'app
`load()` rendait tel quel ce qu'il trouvait : une clé corrompue (écriture interrompue, import bancal) rendait une **chaîne** là où l'app attend une liste, et le premier `.filter` faisait écran blanc — **avant** que le garde-fou d'écran existe, puisque la lecture a lieu dans l'état initial du composant racine. `load` vérifie maintenant que la forme correspond à la valeur par défaut, sinon défaut + avertissement en console. Vérifié : `vinted_invoices` corrompue → l'écran Factures s'affiche normalement au lieu de tout faire tomber.

**État final vérifié** : 12 écrans rendus sur les vraies données, **0 erreur de page, 0 artefact d'affichage** ; panneau d'extension, **tous les onglets déclarés** (recherche, coffre, litiges, ventes… ) sans erreur — les 2 « échecs » du banc sont les artefacts connus (clic sur un élément filtré `display:none`, onglet « réponse » qui n'existe que sur une page de conversation).

### 5.14 (suite) — trois défauts trouvés en TESTANT le correctif précédent

**7. Le résumé des commandes classait 7 ventes en « colis à retirer ».** En comparant le résumé au calcul de l'app sur les vraies commandes, l'écart a sauté aux yeux : 0 côté app, 7 côté résumé. Cause — `resumeCommandes` acceptait tout type commençant par `orders`, donc aussi les vieilles lignes génériques (`orders_bought`, `orders_all`) dont le contenu **mélange ventes et achats** (§25). Restreint aux deux clés canoniques exactes. **Re-mesuré : 4 à expédier / 0 à retirer, identiques à l'app, transaction par transaction.** ⚠️ C'est le test qui a trouvé le bug, pas la relecture — un résumé faux aurait fait clignoter le widget pour des colis inexistants.

**8. 114 € invisibles dans le porte-monnaie, et un solde écrasé par une réponse sans rapport.** Les 8 lignes `harvest_*_billing` réelles ont **trois formes** : `{main, escrow}` (le porte-monnaie), `{balance, history, reference}` (la lecture `payouts` ajoutée en 4.26) — **que l'app ne lisait pas**, donc 114,36 € jamais comptés — et une réponse de tarification (`minimum_price`) rangée là par erreur, qui avait **remplacé** le vrai solde d'un compte (il n'y a qu'une ligne par compte : la dernière réponse gagne, même piège que le dressing partiel de §5.13).
- L'app lit maintenant `escrow` **ou** `balance`, et ignore ce qui ne porte aucun montant. **Mesuré : 675,43 € sur 5 comptes → 789,79 € sur 7.**
- L'extension refuse d'écrire une ligne `billing` qui n'est pas un porte-monnaie (`estPorteMonnaie`), des deux côtés (capture passive et moisson active — cette dernière jetait au passage la lecture `payouts`, qui ne portait pas `main`/`escrow`).

**9. Le service worker mettait `/api/` en cache.** Règle « cache d'abord » pour tout GET de même origine hors navigation : `/api/ai` (« la clé IA est-elle configurée ? ») et toute future route GET restaient **figées pour toujours** sur leur première réponse. `/api/` passe désormais toujours par le réseau.

**Aussi** : la fenêtre de l'extension insérait les pseudos Vinted dans du HTML **sans les échapper** — un pseudo bien choisi cassait (ou détournait) l'affichage. Échappés.

---

## 5.15 — COHÉRENCE APP ↔ EXTENSION : les règles ne sont plus écrites deux fois

Demande de Julien (il veut la vendre) : **aucune incohérence, ni dans l'app, ni dans l'extension, ni entre les deux.**

### La méthode, désormais outillée : `scripts/audit-coherence.cjs`
À lancer après toute modification d'une règle métier. Il **extrait les prédicats des deux fichiers**, les exécute sur **tous les statuts réellement présents en base** (12 distincts aujourd'hui) et affiche chaque désaccord. Lecture seule, aucun appel à Vinted. C'est ce script qui a trouvé les deux premiers défauts ci-dessous — pas la relecture.

### 1. ⚠️ DANS L'APP : « Bordereau envoyé au vendeur » était à la fois « à expédier » et « rien à expédier »
`isAwaitingShipStatus` répondait **oui** (c'est le moment où Vinted te donne l'étiquette), et `needsBordereau` **non** — parce que son test « déjà parti » attrape le mot **« envoyé »**. Deux conséquences réelles : le **numéro de cette paire retombait dans le pool** alors que le carton est encore sur l'étagère (deux paires dans la même boîte, §19), et le même statut valait « à expédier » ailleurs dans l'app.
Les deux tests deviennent **la référence unique, au niveau module** (ils vivaient dans un composant, donc invisibles pour `needsBordereau` juste en dessous), et la vente qui attend TON envoi passe avant le test « déjà parti ».

### 2. Trois statuts classés différemment par l'app et par l'extension
`classifySale` (extension) n'avait pas `retour` ni `suspend` : **« Retour initié »**, **« Transaction suspendue »** et **« Commande non réclamée – Retournée »** étaient **annulées côté app** et **affichées comme ventes en cours** dans le panneau. Copie exacte de la règle de l'app. **Vérifié : 0 désaccord sur les 12 statuts.**

### 3. « À booster » (app) ≠ « à relancer » (extension)
Même question — *cette annonce a de l'audience mais ne convertit pas* — deux règles : l'app faisait `vues ≥ 20 && favoris ≤ 1` (seuils absolus), le panneau comparait le ratio favoris/vues à **ta médiane**. Deux listes différentes selon l'outil ouvert. L'app adopte la règle relative (un seuil absolu ne veut rien dire : 300 vues et 3 favoris convertit deux fois moins bien que 40 vues et 1 favori), avec repli sur l'ancien repère quand il y a moins de 5 annonces notées.

### 4. Une paire vendue restait « en ligne » dans l'app, pas dans le panneau
Vinted laisse parfois l'annonce ouverte après la vente. Le panneau la retirait (vente de moins de 60 j au **titre unique**) ; l'app non. Même règle des deux côtés, même garde (`§24` : un titre en double ne retire **jamais** rien). Et la **portée** est alignée : on regarde les ventes de **tous** les comptes, y compris masqués — une paire vendue sur un compte masqué a quand même quitté l'étagère.

### 5. Masquer un compte depuis le panneau ne masquait rien dans l'app
Le panneau écrit `panel_accounts_off` (sa ligne dédiée) ; l'app **ne la lisait pas**. Le sens inverse marchait déjà — le masquage ne tenait donc que dans un sens. L'app lit maintenant la même liste, avec le **même trois-états** (`false` = rallumé exprès depuis le panneau, ça prime). Elle n'y écrit toujours jamais (§35).

### ✅ Convergence PROUVÉE sur les mêmes données
Le vrai `buildPanelData()` de l'extension et l'app rendue par Playwright, alimentés par **les mêmes copies de la vraie base** :
| | app | panneau |
|---|---|---|
| annonces en ligne | 7 | **8** → **7** |
Les deux tools tombaient sur 8 vs 7 pour une seule raison, et elle est saine : l'app **dérive** des ventes depuis les emails (bordereau reçu ⟹ paire vendue) et **persiste** le résultat dans `vinted_annonces_email_sold` ; le panneau **consomme** cette clé plutôt que de relire tous les emails (égress, §34). Simulé « l'app a tourné une fois » → le panneau passe de 8 à **7**. ⚠️ **Un seul propriétaire par règle, les autres consomment** — c'est le motif à garder.

⚠️ **Piège de banc rencontré (encore une fois §21)** : mon harnais ne servait pas la ligne `vrm_blocked_accounts`, donc le panneau croyait le compte supprimé encore actif et affichait ses 96 annonces — **104 contre 7**, un écart spectaculaire qui n'était **que l'artefact du banc**. Servir TOUTES les familles de lignes avant de conclure.

**État final** : app — 12 écrans sur les vraies données, **0 erreur, 0 artefact d'affichage** ; extension — **15 onglets sur 15** sans erreur (les 2 « échecs » du banc restent les artefacts connus) ; audit de cohérence — **6 règles comparées, 0 désaccord**.

---

## 5.16 — LES EMAILS APPARTIENNENT À UN VENDEUR (le dernier chantier du multi-vendeurs)

Un email arrive **sans session** : rien, dans le message, ne dit à qui il est destiné. C'était le point qui restait ouvert depuis §12 (« rattacher une adresse email à un vendeur — chantier à part entière »). Il est fait, et construit pour ne **jamais** se tromper.

### La règle, en une phrase
**C'est l'adresse de RÉCEPTION qui décide, jamais le contenu.**

L'expéditeur, le sujet et le corps sont écrits par n'importe qui : il suffirait d'envoyer un email mentionnant « shopcancale35 » pour déposer des données dans le compte d'un autre vendeur. L'adresse à laquelle le message a été **livré**, elle, est décidée par le routage — le vendeur l'a déclarée lui-même dans l'app, et il est le seul à l'avoir donnée à son transfert. C'est le seul champ que l'extérieur ne choisit pas.

⚠️ **Ne JAMAIS « améliorer » ça en rattachant par le pseudo Vinted, le nom de l'expéditeur ou un mot du corps** — c'est exactement la porte qu'on referme ici.

### Ce qui est livré
- **`api/_lib/proprietaire-email.js`** — fonction **pure**, donc testable exhaustivement : `adressesDeLivraison(body, mail)` ne lit que des champs d'enveloppe/destination (Postmark `ToFull`, Mailgun `recipient`, Cloudflare `to`, `envelope.to`, `Delivered-To`, `Cc`…), et `resoudreProprietaire(adresses, registre, defaut)` tranche dans cet ordre : **adresse exacte** → **adresse sans son étiquette `+`** → **propriétaire de l'installation** (`VRM_OWNER_UID`) → **quarantaine**.
- **Deux vendeurs destinataires du même email → quarantaine**, jamais un choix au hasard.
- **Quarantaine** : l'email est conservé **entier** (`email_quarantaine_*`) avec la raison et les adresses lues. Perdre un email est réparable — le donner au mauvais vendeur ne l'est pas.
- **Réglages → Mes adresses de réception** : le vendeur déclare ses adresses à l'avance, voit les emails en attente et les réclame d'un tap (**« C'est à moi »**).
- **`api/email-rattacher.js`** rejoue l'email **exactement comme s'il venait d'arriver**, avec le propriétaire imposé. ⚠️ Il faut **prouver son identité** (jeton de session vérifié auprès de Supabase) — sinon n'importe qui s'attribuerait les emails d'un autre. La ligne de quarantaine n'est supprimée que si le traitement a **réellement** abouti.

### ⚠️ LE PIÈGE QUI AURAIT TOUT GÂCHÉ : une variable de module en serverless
Première version : le propriétaire résolu était rangé dans une variable de module. **Une fonction serverless garde son instance entre deux appels et peut en traiter plusieurs EN MÊME TEMPS** — l'email suivant écrasait la variable pendant que le premier finissait d'écrire, et des lignes seraient parties **chez le mauvais vendeur, sans aucune erreur visible**. Remplacé par **`AsyncLocalStorage`** : un contexte isolé par requête.
**Prouvé au banc** : deux emails traités **en parallèle** pour deux vendeurs, avec un délai injecté dans l'écriture pour forcer l'entrelacement → **3 lignes pour U-JULIEN, 3 pour U-MARIE, aucun mélange**.

### Vérifications
- **19 cas** sur la résolution : adresse exacte, casse, forme « Nom <adresse> », registre en casse mixte, étiquette `+` inconnue → base, plusieurs destinataires dont un connu, **deux vendeurs → quarantaine**, inconnue sans/avec défaut, aucune adresse lisible, doublon, **et l'usurpation** (From + sujet + corps portant l'adresse d'un vendeur → **quarantaine**), plus les 6 formes d'enveloppe des services de réception. **Tous passent.**
- **Pipeline complet** (vrai handler, Supabase simulé) : email attribué → 3 lignes sous le bon vendeur ; adresse inconnue → quarantaine et **aucune donnée attribuée** ; rattachement avec jeton valide → 3 lignes sous `U-JULIEN` + quarantaine supprimée ; identifiant hors quarantaine → refusé.
- **Au passage** : `parseSaleEmail` remplaçait le texte par la version HTML dès qu'il faisait moins de 100 caractères — un email court en texte brut était donc **écrasé par un HTML vide** et la vente perdue. On ne remplace plus que si le HTML apporte vraiment plus.

### Mise en service (une fois la migration passée)
1. Chaque vendeur déclare **sa** adresse de réception dans Réglages → Mes adresses de réception.
2. Il fait suivre ses emails Vinted vers **cette adresse** (une par vendeur — deux vendeurs qui partagent la même adresse sont indépartageables **par construction**, et le système le dira au lieu de deviner).
3. `VRM_OWNER_UID` reste le propriétaire par défaut : tant qu'il n'y a qu'un vendeur, **rien ne change** pour lui.

### 5.16 (suite) — ⚠️ LA CLÉ DE SERVICE CONTOURNE RLS : chaque lecture doit être cadrée

Le pipeline email lit `?id=eq.main`, `vinted_accounts`, `push_subs`… avec la **clé de service**, qui **passe outre RLS**. Une fois la base cloisonnée, ces lectures auraient donc ramené **les lignes de TOUS les vendeurs**, et `rows[0]` aurait été celle du premier venu : en traitant l'email de Marie, on aurait lu les comptes Vinted et les numéros de Julien. Aucune erreur, aucun signe — juste des données mélangées.

- **`duVendeur(url)`** ajoute `owner=eq.<vendeur résolu>` à chaque lecture, **et seulement si la colonne existe** (un filtre sur une colonne inconnue ferait échouer la lecture en 400 — donc rien ne change aujourd'hui).
- ⚠️ **Le pire cas était les NOTIFICATIONS** : `_lib/push.js` lisait `push_subs` sans filtre → une vente de Julien aurait fait sonner le téléphone de Marie. Le contexte de requête a donc déménagé dans `_lib/owner.js`, pour être partagé par les deux modules.

**Vérifié dans les deux états, à l'URL près** : base partagée → **0 lecture filtrée** (comportement d'aujourd'hui, strictement inchangé) ; base cloisonnée → **5 lectures sur 5** portent `owner=eq.U-JULIEN`, `push_subs` compris.
⚠️ **Piège de banc** : les modules gardent leur sonde « base cloisonnée ? » en cache. Enchaîner les deux états dans le même processus fait croire à une lecture non filtrée — il faut un processus neuf par état.

---

## 5.17 — LES BORDEREAUX : quatre causes distinctes, toutes mesurées

Plainte de Julien : « j'ai des bordereaux de vente déjà expédiés que tu me laisses dans l'application, tu te trompes sur certains bordereaux et tu ne mets pas les bonnes paires, ni les paires qui ont besoin d'un bordereau imprimé — j'ai reçu une notification où je devais imprimer **51 bordereaux**, je n'ai pas 51 colis à envoyer. »

Quatre défauts indépendants, séparés en mesurant sur les **72 bordereaux réels** avant d'écrire une ligne.

### 1. La notification « 51 bordereaux » — `api/ship-reminders.js` ne regardait presque rien
Le cron ne consultait que `vinted_bords_printed`… qui est quasi vide **depuis que l'impression ne marque plus un bordereau comme fait** (§24 : sortir le papier de l'imprimante ne veut pas dire que le colis est parti). Résultat : presque tous les bordereaux en retard étaient comptés, d'où le 51.
Il lit maintenant les quatre sources de « déjà fait » (`vinted_bords_printed`, `vinted_bords_shipped`, `vinted_bords_hidden`, `panel_bords_done`) **et** ne garde que les bordereaux dont la transaction est dans l'ensemble « attend encore mon envoi » écrit par l'extension (`select=id,txns:data->resume->txns`, un scalaire — jamais `select=data`, §34).
⚠️ **Sans résumé en base, il n'envoie RIEN** (`{ok:true, skipped:'resume absent'}`) : une notification fondée sur une source absente est pire que pas de notification.
**Mesuré : 72 bordereaux → 3 attendent réellement l'envoi, 67 déjà partis, 1 masqué, 1 vente inconnue.**

### 2. « Déjà expédiés mais toujours listés » — la liste positive laissait passer 4 cas
`bordShipped` cherchait des mots de colis parti (`expédié|acheminé|livré|finalisé|déposé`). Tout ce qui ne ressemblait à aucun de ces mots restait à imprimer pour toujours.
La bonne question n'est pas « ce statut ressemble-t-il à un colis parti ? » mais **« cette vente attend-elle encore MON envoi ? »** → `!isAwaitingShipStatus(o.status)`.
**Mesuré : 64 → 68 bordereaux correctement retirés.** Les 4 gagnés : 2 « Remboursement effectué », 2 « Transaction suspendue » — des paires qui ne partiront jamais.

### 3. ⚠️ « Pas les bonnes paires » — le numéro de l'email vient d'un RAPPROCHEMENT PAR TITRE
`numForBord` faisait confiance d'abord à `b.numero`, le numéro écrit dans l'email. Or ce numéro est résolu **côté serveur** par `findNumeroByTitle`, contre tout l'historique de `vinted_annonce_numeros` : une paire vendue il y a six mois au même titre peut gagner. C'est une ressemblance, pas une identité — exactement ce que §24 interdit pour les bordereaux.
Le chemin **bordereau → transaction → vente moissonnée → annonce numérotée** passe désormais devant. **Mesuré : 1 désaccord réel** (email N°41 contre transaction N°131, « nike zoom fly 5 blanc taille 44 ») — soit un bordereau tamponné du numéro d'une AUTRE paire, donc la mauvaise chaussure dans le carton.
Le désaccord n'est plus tranché en silence : `numLitige(b)` l'affiche sur la carte (« L'email disait N°41, la vente dit N°131 — on garde celui de la vente ») avec un lien **choisir** vers le sélecteur manuel.

### 4. ⚠️ Masquer un compte faisait disparaître un colis à poster
`toShip` / `vintedToShip` écartaient les ventes d'un compte masqué (`isHidden` → `acctOffOf`). Or l'écran Bordereaux, lui, ne filtre pas par compte (`soldByTxn` est construit sur toutes les ventes). **Deux chiffres pour la même obligation, sur le même écran** : 3 bordereaux à imprimer, « 1 colis à expédier ».
Masquer un compte sert à nettoyer la **comptabilité** ; ça ne fait pas sortir un carton de l'étagère, et Vinted pénalise le retard. Les deux listes n'écartent plus qu'une vente masquée **à la main**.
**Mesuré : 4 ventes attendent l'envoi, dont 2 sur un compte masqué** — invisibles avant.

### Et un cinquième, de vocabulaire
Le bandeau d'urgence disait « 📮 1 colis à expédier » alors qu'il ne compte que **l'urgent** (en retard / aujourd'hui / demain) — les mêmes mots que le compteur du haut qui compte tout. On lisait « 4 bordereaux à imprimer » puis « 1 colis à expédier » sur le même écran. Devenu **« 1 à poster en priorité »**.

### Vérifié
`npm run build` OK · smoke app sur les vraies données : **12 écrans, 0 PAGEERROR, 0 artefact d'affichage** (le dernier « suspect » du banc a disparu avec le renommage) · `scripts/audit-coherence.cjs` : **0 désaccord sur les 12 statuts réels** · `node --check api/ship-reminders.js` OK.

---

## 5.18 — ⚠️ « L'EXTENSION NE RENVOIE PAS MES NOUVEAUX COMPTES » : la suppression était un aller sans retour

Question de Julien : « à chaque fois que j'ajoute l'extension à un nouveau compte, il faut bien que je dise à quel compte elle appartient ? où est-ce que je dois le relier ? »

**Réponse : il n'y a RIEN à relier.** L'extension lit l'identifiant du compte dans le cookie de session Vinted (`access_token_web` → `account_id`) et crée la ligne `vinted_accounts` toute seule. Aucun choix à faire, donc aucun risque de relier le mauvais compte. Le problème était ailleurs.

### La cause, mesurée en base
`vrm_blocked_accounts` contenait **199082413 = shop_cancale**, supprimé par Julien (§5.11) — **son plus gros compte : 96 annonces, 284 ventes**. Or `captureDomain` refusait de capter tout compte de cette liste **et effaçait sa ligne à chaque cycle**, en silence. Se reconnecter à ce compte dans Chrome ne pouvait donc **jamais** le ramener.

⚠️ Le contre-ordre existait pourtant : `panel_accounts_off[uid] === false` = « rallumé explicitement, ça prime » (tri-état, §5.08). **`buildPanelData` l'honorait pour l'AFFICHAGE, la CAPTURE non** — le compte revenait dans les listes du panneau mais sans jetons frais, donc vide. C'est très exactement « le bouton ne marche pas ».

- `unblockedAccounts()` (cache 60 s) lit le contre-ordre ; `captureDomain` ne refuse plus qu'un compte bloqué **ET** non réautorisé.
- `setAccountOff(uid, false)` **vide les caches et relance `captureAllAccounts()`** : sans ça, réautoriser ne prenait effet qu'au bout de 5 min.
- Un refus est **noté** (`chrome.storage.local.vrmRefus`) et journalisé, au lieu d'être muet.

### Un compte tout neuf était INVISIBLE dans le panneau
La liste des comptes se construisait uniquement à partir des **lignes moissonnées**. Un compte fraîchement capté (jetons OK, aucune moisson encore) n'apparaissait donc nulle part — ce qui ressemble exactement à « il n'arrive pas ». Elle part maintenant de la table `vinted_accounts`, plus du compte connecté dans ce navigateur ; la moisson ne fait qu'ajouter les compteurs.

### Le bloc « compte connecté » (panneau, en tête de Ma journée)
Trois causes se ressemblaient — jamais capté / supprimé définitivement / simplement masqué — et toutes se présentaient comme du silence. Elles sont désormais distinctes, avec le bouton qui va avec :
| état | message | bouton |
|---|---|---|
| supprimé définitivement | ⛔ n'est pas synchronisé | ↺ Réautoriser et relier |
| capté nulle part | ⏳ pas encore relié | 🔗 Relier maintenant |
| relié mais masqué | 🙈 relié mais masqué | ↺ Réafficher |
| tout va bien | ✓ relié | — |
| aucun compte connecté | 👤 connecte-toi sur vinted.fr | — |

Le pseudo d'un compte supprimé est repris de la liste noire (elle garde `logins`) : il s'affichait « compte 2413 » alors que sa ligne `vinted_accounts` avait justement été effacée.

### ⚠️ DEUX BANCS ÉTAIENT MUETS DEPUIS UN MOMENT — même piège, troisième fois
`run_panel_data.cjs` ne sortait **rien du tout** (exit 0, aucune ligne) — et **avant mes changements aussi**, vérifié au `git stash`. Cause : `chrome.cookies.get` est appelé **en callback** par le code, et le stub ne rendait qu'une promesse → attente infinie, sortie silencieuse. C'est le piège de §5.08, à l'identique, sur une autre API.
➡️ **Tout stub `chrome.*` doit répondre AUX DEUX FORMES** (promesse et callback). Un banc muet n'est pas une preuve que rien ne casse : c'est un banc qui ne s'exécute pas.

### Vérifié
`node --check` sur les deux fichiers · banc de la porte (vrai `captureDomain` en `vm`, `fetch` simulé) : liste noire seule → **refusé, ligne effacée, refus noté** ; réautorisé → **capté, aucun effacement** — **0 cas non conforme** · banc panneau : les 5 états rendus avec le bon bouton et le bon message, **0 erreur**, et le clic envoie exactement `relierCompte` / `setAccountOff{off:false}` · vrai `buildPanelData` contre la vraie base : 13 annonces, 10 comptes dont **shop_cancale (96 annonces) désormais visible et réactivable**. Extension **5.16.0**.

---

## 5.19 — ⚠️ « ARRÊTE D'INVENTER DES DONNÉES » : il avait raison sur les deux tableaux

### 1. Une VRAIE fausse ligne dormait dans sa base de production
Trouvée en cherchant, pas en supposant : **`email_bord_99000000001`** — « Nike Air Max N°99001 Taille 42 », suivi `LD123456789FR`, `uid` vide, `account` vide, **aucun PDF**. Créée le 11 juillet en testant le pipeline email. Elle apparaissait dans ses bordereaux « à imprimer » comme un colis réel : c'est **littéralement de la donnée inventée dans son outil de travail**.
Scan complet : **1 seule** sur les 1000 lignes `app_data`, et **rien** dans la ligne `main` (ni numéro ≥ 9000, ni facture, ni motif de test).
⚠️ **La clé publique n'a pas le droit de DELETE** (200 / 0 ligne supprimée) : impossible de l'effacer depuis un script. Le ✕ de la carte la masque en un clic.
➡️ **Règle : ne JAMAIS écrire de donnée de test dans la base de production.** Les bancs servent des copies (§20/§35) ; une ligne synthétique n'a rien à y faire.

### 2. Le chemin de capture PRÉFÉRÉ tronquait les commandes à 100
`pageActiveFetch` (injecté dans la page, c'est le chemin choisi en premier par `runActive`) faisait `my_orders?page=1&per_page=100` — **une seule page** — alors que l'autre chemin (`fetchAllOrdersCookie`, par cookie) paginait. Donc selon le chemin emprunté, le même compte rendait 320 ventes ou 100.
**Pire : la capture tronquée ÉCRASAIT la complète.** Le garde-fou anti-partiel (§5.13) ne protégeait que le *dressing* ; les commandes et la boîte n'avaient rien. Des ventes disparaissaient donc toutes seules, sans que personne ne touche à rien.

**Mesuré au banc, sur les vraies volumétries (320 ventes / 434 achats / 603 annonces) :**
| | avant | après |
|---|---|---|
| ventes captées | **100** | **320** |
| achats captés | **100** | **434** |
| annonces | 603 | 603 |
| porte-monnaie | oui | oui |

- `listePlusRiche(rowId, parsed, cle)` **remplace** `dressingPlusRiche` et s'applique à **toutes** les listes (`CLE_LISTE` : listings/orders_sold/orders_purchased/inbox), **sur les DEUX voies d'écriture** (passive `storeHarvest` + active `storeHarvestRow`). Compteur lu **en scalaire** (`select=n:data->>nItems`), jamais le payload (§34).
- Les commandes se paginent maintenant **dans la page** aussi (10 pages max, pause 700 ms, arrêt sur `total_pages`).

### 3. Capture à CHAQUE visite sur Vinted (la demande)
`chrome.tabs.onUpdated` (statut `complete`, domaine Vinted) → `visiteVinted()` → `runActive()`, **3 s après le chargement** (on laisse la capture passive profiter de ce que la page demande d'elle-même).
- **Uniquement le compte connecté dans cet onglet**, depuis sa session et son IP — jamais tous les comptes d'un coup (§5, la signature multi-comptes).
- **Délai de garde de 5 min par compte** (`vrmDerniereVisite`, local). ⚠️ Ce **n'est pas** un « rythme faussement humain » (toujours refusé, §32) : c'est ne pas refaire dix fois la même lecture en naviguant de page en page — sans lui, ouvrir 30 annonces = 30 moissons complètes.
- `runActive()` rend désormais un booléen, pour que le journal dise « rafraîchi » seulement quand quelque chose a été rangé.

### Vérifié
Banc `vm` avec le VRAI code : **6 cas de garde-fou** (dressing / ventes / achats / boîte, tronqué → ignoré, complet → écrit) + **délai de garde dans les deux sens** → **0 cas non conforme**. Banc de pagination exécutant réellement la fonction injectée : **320/434/603 + porte-monnaie, 0 écart** (et 100/100 avant correction, mesuré au `git stash`). Banc panneau : **16 onglets, 0 erreur d'app** (les 2 artefacts connus). Extension **5.17.0**.

---

## 5.20 — LES COMPTES FANTÔMES : des données qui survivaient à la suppression

Julien : « garde simplement ceux qui ont été captés récemment par Vinted, shop_cancale a été supprimé de toute façon ».

### Ce que la base disait
| identifiant | lignes moissonnées | dernière capture | ligne `vinted_accounts` |
|---|---|---|---|
| 199082413 (shop_cancale) | 12 | 12,7 j | **aucune** |
| 3170782324 | 29 | 4,6 j | **aucune** |
| 3170790456 | 5 | 39,5 j | **aucune** |

**46 lignes appartenant à des comptes qui n'existent plus** — et elles alimentaient encore les listes du panneau et s'affichaient comme des comptes. ⚠️ La clé publique **n'a pas le droit d'effacer `app_data`** (DELETE → 200 / 0 ligne) : ces restes ne partent donc **jamais** tout seuls. Supprimer un compte doit vouloir dire supprimer.

### La règle, unique et sans délai
**Un compte existe s'il a des JETONS (`vinted_accounts`), pas parce qu'il reste des données.** `compteExiste(uid)` filtre `keepAcc` **et** `noteAcct` : un identifiant orphelin ne s'affiche plus et ne nourrit plus rien. Pas de seuil d'ancienneté à régler — un compte supprimé est supprimé, quelle que soit la fraîcheur de ses restes.

⚠️ **Garde-fou obligatoire** : si la lecture de `vinted_accounts` échoue (réseau), on **n'applique aucun filtre**. Filtrer sur une liste vide viderait tout le panneau pour une simple coupure — c'est-à-dire reproduire exactement le bug qu'on corrige. Testé : lecture vide → **99 annonces conservées, 0 filtrage**.

### La fraîcheur est écrite, pas devinée
Chaque compte porte `capte` (la capture la plus récente de ses lignes). La liste est **triée du plus frais au plus ancien**, et chaque ligne le dit : « capté aujourd'hui » / « capté il y a 4 j » / « ⚠️ rien depuis 14 j — repasse dessus ». Même échelle que l'écran Santé et que l'app (§5.12) — un même état ne doit pas porter deux couleurs selon l'écran.
**On ne cache jamais un compte muet** : une session expirée n'est pas un compte mort, ses paires sont réelles. On le montre, trié en bas, avec la raison.

### État relevé (16 août)
7 comptes vivants : 5 captés dans l'heure, `julatace3535` à 4,7 j, `liliand653` à 14 j (session à rafraîchir). **18 annonces en ligne** au total.
⚠️ `vinted_accounts_hidden` et `vrm_blocked_accounts` sont **vides depuis 09:18** — Julien a cliqué « Tout réafficher » (§5.12) lui-même. Ce n'est pas un effet du code.

### Vérifié
Banc `vm` avec le vrai `buildPanelData` : compte supprimé **écarté de la liste ET de ses 96 annonces**, fraîcheur portée par le compte, panne réseau → aucun filtrage — **0 cas non conforme**. Banc panneau : **16 onglets, 0 erreur**. Bancs 5.16/5.17 rejoués : 0 écart. Extension **5.18.0**.

---

## 5.21 — ⚠️ CORRECTION D'UNE DE MES ANALYSES : `origin/main` n'était PAS périmé, ma copie locale l'était

⚠️ **La première version de cette section affirmait « l'app déployée date du 8 août, 109 commits jamais déployés ». C'EST FAUX.** Je lisais `origin/main` **sans avoir fait `git fetch`** : ma référence locale pointait sur le 8 août alors que le vrai `main` était au **15 août 22:36**. L'écart réel était de **16 commits**, pas 109 — et le correctif du 401 (§5.09) **était déjà en production**, donc il n'explique pas ce que Julien voit.

➡️ **`git fetch origin main` AVANT toute comparaison avec la production.** Une référence locale jamais rafraîchie ne vieillit pas toute seule : elle ment silencieusement, et fait accuser le déploiement à la place du code.

### Ce que la mesure a vraiment montré (16 août, données du jour)

Plainte : « j'ai que trois paires en ligne, enfin quatre avec une autre, mais elle appartient à un compte bloqué qui n'est même plus dans les comptes répertoriés ».

### Ce que dit la base (mesuré, compte par compte)
| compte | captées | en ligne | capture | complète ? |
|---|---|---|---|---|
| julienf765 | 33 | 3 | aujourd'hui 08:42 | oui (33/33) |
| tomj606 | 9 | 2 | aujourd'hui 08:42 | oui |
| llloollllaa | 29 | 3 | aujourd'hui 08:42 | oui |
| tomj683 | 9 | 3 | aujourd'hui 08:43 | oui |
| julatace35260 | 100 | 4 | aujourd'hui 08:39 | oui (100/100) |
| julatace3535 | 20 | 2 | il y a 4,7 j | **non — 20 sur 55** |
| liliand653 | 1 | 1 | il y a 14 j | oui |

**18 annonces en ligne**, données de Vinted lui-même, captures fraîches du matin. Julien en voit 3 ou 4.

### Les annonces affichées sont VRAIES — vérifié une par une
Après rafraîchissement des copies depuis la base, l'écran Annonces rend **25 annonces**, et chacune a été retracée jusqu'à son compte : **25 sur 25 viennent d'un compte vivant, 0 fantôme**. Elles sortent toutes du dressing Vinted capté par l'extension, dont 4 comptes dans l'heure. **Rien n'est inventé sur cet écran.**

Répartition réelle (16 août) : julatace35260 · 6, julienf765 · 5, llloollllaa · 5, tomj683 · 4, julatace3535 · 3, tomj606 · 2, liliand653 · 1 = **26 annonces sur 7 comptes**.
➡️ Si Julien n'en reconnaît que 3, ce ne sont pas des annonces fausses : ce sont des **comptes qu'il ne considère pas comme sa boutique** (llloollllaa vend par exemple « 3 manuels première ST2S »). La réponse n'est pas de filtrer dans le code mais de **masquer ces comptes** (✕ Masquer, dans l'app comme dans le panneau). ⚠️ Ne pas « corriger » ça en inventant un filtre : la donnée est juste.

⚠️ `vinted_accounts_blocked` est **local à l'appareil** (jamais dans `SYNC_KEYS`) : cette liste ne se voit PAS en lisant la base. Un diagnostic fait uniquement en base ne peut donc pas expliquer à lui seul ce que Julien a sous les yeux.

### Correctif quand même apporté (app, §5.20 côté app)
Une annonce dont le compte n'a plus de ligne `vinted_accounts` passait **tous** les filtres : `acctOffOf(it)` lit `it._acc.vinted_user_id`, et sur un compte supprimé ce champ est vide → `acctOff('')` répond « non masqué » → l'annonce restait affichée alors que son compte n'apparaît plus nulle part.
`accountUids` (les comptes qui ont vraiment des jetons) + un test en tête d'`annBase` : **une annonce doit venir d'un compte qui existe encore**. Même règle que l'extension.
⚠️ `accountUids` est déclaré juste après `acctOff`, donc **avant** `annBase` — un `useMemo` lu avant sa déclaration plante au premier rendu (§19).

### Vérifié
Banc app dédié (3 annonces d'un compte vivant + 1 d'un compte supprimé) : **les 3 restent, la 4ᵉ disparaît, 0 PAGEERROR**. Smoke complet : **12 écrans, 0 erreur, 0 artefact**.

---

## 5.22 — SUPPRIMER UN COMPTE SUPPRIME VRAIMENT + les 561 € d'argent en attente

Julien : « je veux simplement pouvoir choisir quel compte Vinted garder et les autres les supprimer… je n'ai pas 561 € ».

### 1. ⚠️ « Déconnecter » ne supprimait presque rien — TROIS défauts empilés
**a) Le `DELETE` sur `app_data` est SANS EFFET.** Vérifié en direct : la clé publique reçoit **200 avec 0 ligne supprimée** — le droit d'effacer n'est pas accordé sur cette table (il l'est sur `vinted_accounts`). L'étape « supprimer ses lignes moissonnées » de `deleteVintedAccount` ne faisait donc **rien depuis toujours**, en silence. C'est l'origine des 46 lignes fantômes de §5.20.
⚠️ §5.11 avait « vérifié » cette suppression avec un **uid factice** : 0 ligne supprimée était le résultat attendu, donc le test ne prouvait rien. **Tester une suppression sur une ligne qui existe vraiment.**
➡️ On **VIDE** les lignes à la place (un upsert, lui, passe) : `{supprime:true, purgedAt}` sur chaque `harvest_{uid}_*` et `coffre_{uid}_*`. La donnée part réellement, et l'égress avec.

**b) Une DEUXIÈME feuille bloquait la suppression.** Après la confirmation, `disconnectAccount` posait une seconde question (« garder son chiffre d'affaires passé ? »). **Mesuré au banc : tant qu'on n'y répondait pas, aucune des trois écritures ne partait.** Une seule question désormais ; le CA passé est **conservé par défaut** (c'est de l'argent réellement gagné) et c'est écrit dans la confirmation.

**c) Supprimer AJOUTAIT le compte aux « masqués ».** `disconnectAccount` mettait l'uid dans `vinted_accounts_hidden` — une clé **synchronisée** — en plus de le supprimer. Le compte apparaissait donc « masqué » sur tous les appareils alors qu'il était supprimé : c'est la moitié de la confusion « tous mes comptes sont masqués » (§5.09/§5.10). Retiré — la liste noire suffit.

Le bouton dit maintenant **« 🗑 Supprimer ce compte »** et la confirmation liste exactement ce qui part et ce qui reste.

### 2. Les 561,23 € : 57 € appartenaient à un compte supprimé
Relevé des 8 lignes `harvest_*_billing` :
| compte | en attente | capture |
|---|---|---|
| **199082413 (shop_cancale, supprimé)** | **57,23 €** | 16,9 j |
| julatace3535 | 359,00 € | 4,9 j |
| tomj606 | 145,00 € | 0,2 j |
| 3170782324 (supprimé) | 0 € | 4,8 j |
| llloollllaa / tomj683 / julienf765 / julatace35260 | ligne vide | — |

`fetchWalletEscrow` additionnait **tout**, comptes supprimés compris. Il reçoit désormais la liste des comptes vivants (même règle que partout, §5.20) → **561,23 € → 504,00 € sur 2 porte-monnaie**. ⚠️ Garde-fou : sans liste de comptes (appel trop tôt), **on ne filtre rien** plutôt que de tout jeter.
**Et on dit l'âge** : un solde lu il y a 5 jours n'est pas le montant d'aujourd'hui. La carte affiche « le plus ancien lu il y a N j — repasse dessus » au-delà d'un jour. 4 comptes sur 7 n'ont aucun solde capté : le total ne couvre que ceux visités, ce n'est pas masqué.

### 3. « Il manque encore de nouveaux comptes » — la contrainte est dans Chrome
Chrome ne garde **qu'une session Vinted à la fois par domaine** : l'extension capte le compte actuellement connecté. Un nouveau compte arrive donc **au moment où Julien s'y connecte**, pas avant. Rien à relier (§5.18) ; pour en avoir plusieurs en parallèle il faut des **profils Chrome distincts**.

### Vérifié
Banc app dédié : le bouton rend, la confirmation s'ouvre, et les **trois** écritures partent — liste noire ✅, jetons ✅, **3 lignes vidées** (`supprime:true`) ✅, **0 PAGEERROR**. Porte-monnaie recalculé sur la vraie base : 561,23 → 504,00 €. Smoke complet : 12 écrans, **0 PAGEERROR** ; les 3 « suspects » restants sont l'accord de « colis » (invariable) — un artefact du banc. `scripts/audit-coherence.cjs` : **0 désaccord sur les 12 statuts**.

---

## 5.23 — LE PRIX D'ACHAT : la marque et la taille ne suffisent pas (le modèle tranche)

Audit large sur les données du jour (26 annonces en ligne, 7 comptes) :

| contrôle | résultat |
|---|---|
| annonces sans numéro | **0** |
| numéros en double sur des annonces en ligne | **0** |
| **prix d'achat renseignés** | **0 / 26** ⚠️ |
| plage de numéros | 1 → **182** pour 26 paires, **156 trous** |
| titres en double parmi les annonces en ligne | 2 |
| cases posées au garage | **0** |

Le seul vrai défaut de données reste **le prix d'achat** (§22, toujours à zéro) : tout le bénéfice, la marge, la « meilleure marque » et le rapport comptable tournent avec un coût nul.

### ⚠️ Pourquoi je n'ai PAS fait le rapprochement automatique
Tentation évidente : 337 achats captés, un score existant, il suffirait de relier ce qui n'a qu'un seul bon candidat. **Mesuré : 5 annonces sur 26 ont un candidat unique à « même marque + même taille »… dont 2 FAUX** —
- « nike p-6000 blanc/jaune **taille 40** » ← « **Nike speakers** maat 40 » (12,29 €)
- « nike zoom fly 5 bleu **taille 47** » ← « **Nike Air Max 1** SC in maat 47 » (19,49 €)

« nike » + « 40 » désigne des centaines de paires. Un prix d'achat faux ne se voit pas : il produit une marge crédible et fausse **pour toujours**. C'est pire que pas de prix — donc **pas d'attribution automatique**, comme §22 l'avait déjà conclu pour le titre.

### Ce qui a été fait : le MODÈLE devient un signal
- **`extractModel(text)`** (module-level, à côté de `extractBrand`/`extractSize`) : ~45 modèles (zoom fly, p-6000, air max 95, spezial, samba, gel-resolution, xt-6, medalist…). Rend **le plus long** modèle reconnu (« air max 95 » gagne sur « air max »).
- **`openPicker`** : même modèle **+5** ; modèles reconnus mais **DIFFÉRENTS → −6** (c'est ce qui écarte « speakers » et « Air Max » des exemples ci-dessus).
- **Le badge « suggéré » passe de 8 à 12.** À 8, marque + taille suffisaient — exactement les deux faux cas. À 12 il faut le modèle (4+4+5) ou un titre identique. Une paire dont le modèle n'est pas reconnu **n'est jamais « suggérée »** : on ne se prononce pas.

**Mesuré après correction, avec les vraies fonctions de l'app** : 10 annonces sur 26 ont au moins un candidat suggéré, et **toutes les suggestions sont du même modèle ET de la même taille** (« Adidas Spezial noir 35,5 » ← « Baskets Adidas Spezial taille 35,5 », « zoom fly 5 40,5 » ← « Nike zoom fly 5 pink 40,5 »…). Les 16 autres n'affichent aucun badge — c'est honnête, leur achat n'est pas identifiable avec certitude.

⚠️ `extractSize` de l'app était déjà correct (plage 34–52, donc « air max **95** » n'est pas lu comme une pointure) — c'est mon script d'audit qui avait ce défaut, pas le code. Vérifier la règle de l'app avant de l'accuser.

### Vérifié
`npm run build` OK · smoke app sur les vraies données : **12 écrans, 0 PAGEERROR** (les 3 « suspects » = l'accord de « colis », invariable) · `scripts/audit-coherence.cjs` : **5 règles, 0 désaccord**.

---

## 5.24 — LE COMPTEUR DE DIAGNOSTIC A PARLÉ : la fiche article échoue au `JSON.parse`

Le compteur posé en §46 (`panel_diag_capture`) a enfin des données. Relevé :

| clé | valeur |
|---|---|
| `recu_item` | **13** |
| `abandon_json_item` | **13** |
| `ecrit_item` | **0** |
| tout le reste (profil 70, conversations 57, annonces 47, ventes 26, achats 21, porte-monnaie 43…) | reçu ≈ écrit |

➡️ **Les 13 réponses de fiche article arrivent bien et sont TOUTES rejetées par `JSON.parse`.** La fuite ouverte depuis §46 est localisée : ce n'est ni l'URL (le motif matche), ni le compte (il est trouvé), ni l'écriture — c'est le **corps** qui n'est pas du JSON.

⚠️ **Localisé ≠ expliqué.** Corps vide ? HTML de la page servi sur la même URL ? flux déjà consommé ? On ne peut pas trancher sans voir. Donc **on instrumente encore une fois** plutôt que de supposer : `echantillonRate(type, id, body)` garde **un exemplaire par type** dans `panel_diag_capture.rates` — `{id, taille, type, tete: 160 premiers caractères, at}`. Assez pour reconnaître la forme, trop court pour embarquer quoi que ce soit d'utile ou de lourd, un seul exemplaire écrasé à chaque fois.

➡️ **Prochaine session : lire `panel_diag_capture.rates.item`.** Si `tete` commence par `<!DOCTYPE`, c'est la page HTML qui matche le motif → resserrer la regex. Si `taille` vaut 0, c'est le flux déjà consommé → cloner plus tôt dans `inject.js`.

**Autre trouvaille du même relevé** : `recu_pickup_points: 1` / `ecrit_pickup_points: 1`. **Vinted expose donc bien les points relais** — ce que §16 avait conclu introuvable côté API (« la donnée n'existe QUE dans l'email »). Une ligne existe maintenant. À rouvrir quand il y en aura assez pour en tirer quelque chose.

**Vérifié au banc `vm`** (vrai `storeHarvest`, corps HTML injecté) : ligne de diagnostic écrite, échantillon présent, `tete` = `<!DOCTYPE html><html lang="fr">…`, taille 131. `node --check` OK. Extension **5.19.0**.

---

## 5.25 — shop_cancale SUPPRIMÉ POUR DE BON (16 août)

Demande : « je veux que shop cancale soit totalement supprimé ».

⚠️ **Il n'était pas supprimable depuis l'app** : sa ligne `vinted_accounts` avait déjà disparu, donc il n'apparaissait dans aucune liste et le bouton « 🗑 Supprimer ce compte » (§5.22) était hors d'atteinte. Ses **12 lignes moissonnées** continuaient pourtant d'exister (annonces, ventes, achats, boîte, porte-monnaie à 57,23 €…). Et `vrm_blocked_accounts` était **vide** depuis le « Tout réafficher » du 16 août 09:18 (§5.20) — l'extension aurait donc pu le recapter à la première reconnexion.

Fait directement en base, dans cet ordre :
1. **liste noire** — `199082413` + `shop_cancale` réinscrits dans `vrm_blocked_accounts` (lecture-fusion-écriture) → `captureDomain` refuse de le recapter (§5.18) ;
2. **jetons** — `DELETE vinted_accounts` (0 ligne, déjà absente) ;
3. **12 lignes vidées** par upsert `{supprime:true, uid, purgedAt}` — ⚠️ le `DELETE` sur `app_data` reste sans effet avec la clé publique (§5.22), vider est la seule suppression réelle possible.

**Vérifié après coup** : 0 ligne non vidée, 8 comptes restants (`julienf765, tomj683, angeled92, llloollllaa, tomj606, liliand653, julatace35260, julatace3535`).

⚠️ **Ce qui n'a PAS été touché, volontairement** : les **198 numéros de boîte** de `vinted_annonce_numeros`. Un numéro est écrit sur un carton réel ; effacer ceux d'un compte supprimé ferait perdre le rangement de paires physiquement présentes. Un numéro devenu inutile retourne de toute façon dans le pool tout seul (§7, `freedNums`).

⚠️ **Nouveau compte repéré au passage** : `angeled92` (3175765377) est apparu dans `vinted_accounts`. Il n'a pas été touché.

---

## 5.26 — LE DIAGNOSTIC A PARLÉ + « où déposer mes colis » (une donnée en base que personne ne lisait)

### 1. La fiche article : le corps rejeté est une PAGE D'ERREUR HTML servie en 200
L'échantillon posé en §5.24 est arrivé :
```
id 9677654811 · type "string" · taille 3771
tête: <div class="u-text-center u-stretch-height u-margin-top-x-large">
      <span class="svg"><svg width="300" height="300" …
```
➡️ Ce n'est ni un flux vidé (taille 3771), ni la page de l'annonce (trop court) : c'est **l'illustration d'erreur de Vinted, renvoyée avec un statut 200**. Comme `apiGet` ne rejette que `!r.ok`, elle passe le filtre et casse au `JSON.parse`.
⚠️ La regex n'est PAS en cause — elle est bien bornée à l'API (`/\/api\/v\d+\/items\/(\d+)(?:\?|$)/`), une URL de page ne peut pas la déclencher. **`GET /api/v2/items/{id}` ne rend donc plus la fiche** ; l'endroit où lire la description reste `vinted_item_details` (les fiches lues sur la page, §5.10), qui marche. Reste à identifier le remplaçant côté API — piste : `/api/v2/item_upload/items/{id}` (la requête d'édition captée, §4.96).

### 2. ⚠️ DES ENDPOINTS JAMAIS EXPLOITÉS dorment dans `seen_urls`
En listant les 39 URL réellement observées :
| endpoint | ce que ça débloque |
|---|---|
| `/api/v2/shipments/{id}/label_url` | **l'URL du bordereau PDF** — « pas encore capturé » depuis §5 |
| `/api/v2/shipments/{id}/nearby_drop_off_points` | **les points de dépôt** (fait, ci-dessous) |
| `/api/v2/shipments/{id}/label_options` | les formats d'étiquette proposés |

### 3. « Où déposer tes colis » — 6 lignes en base, 0 lecteur
`harvest_*_pickup_points` existait déjà (6 comptes, 15 points chacun) et **rien ne la lisait**. Elle porte exactement ce que §16 cherchait dans les emails, mais en structuré : `drop_off_point_address` (« 40 RUE DU PORT, CANCALE, 35260 »), `distance`, `opening_status.text` (« Vendredi 09:30–18:30 »), `latitude/longitude`, `business_hours`, et le transporteur.

⚠️ **NE PAS CONFONDRE avec le point relais de RETRAIT** (§16, toujours ouvert) : ici c'est le **DÉPÔT**, l'endroit où Julien porte le carton. Deux notions différentes — c'est écrit dans le code, à côté de la fonction.

- **`fetchDropOffPoints(uidsVivants)`** + carte dépliable en tête de l'écran **Bordereaux** : nom, adresse, distance, horaires du jour, lien Itinéraire. **Zéro appel Vinted** (la donnée vient de la capture). Comptes supprimés filtrés (§5.20).
- ⚠️ **Égress (§34)** : chaque ligne pèse ~30 Ko. On lit les dates en **scalaire** d'abord, puis le contenu de **4 lignes seulement, une par compte**, une fois par session, uniquement sur cet écran.
- ⚠️ **Défaut trouvé au banc, pas à la relecture** : ma 1ʳᵉ version prenait « les 3 plus récentes » → **un transporteur sur deux disparaissait** (le transporteur est attaché au compte : 3 comptes Mondial Relay, 3 Shop2Shop), donc les points où partent la moitié des colis. Une ligne par compte corrige.
- **On dit l'âge** de la liste : un point relais ferme.

**Vérifié au banc** (§20, `dist` servi, Supabase mocké honorant `select=`, vraies lignes) : carte rendue, dépliée, **les deux transporteurs présents** (SUPER U ACCUEIL / Shop2Shop 1,7 km · Maison de la Presse / Mondial Relay 1,9 km), adresses et horaires réels, aucun débordement à 420 px. **0 erreur** (le seul 400 est le sondage `select=owner` volontaire). `npm run build` OK · `scripts/audit-coherence.cjs` : **4 règles, 0 désaccord**.

---

## 5.27 — ⚠️ « EN ATTENTE » ≠ « DISPONIBLE » + le lieu de retrait complété par la liste de Vinted

### 1. ⚠️ Le porte-monnaie mélangeait deux montants qui n'ont rien à voir
Julien : « l'argent en attente c'est totalement faux, ce n'est pas l'argent disponible, c'est l'argent en attente que je veux ». **Il a raison, et c'était écrit dans le code.** Les deux formes de porte-monnaie portent **chacune les DEUX montants** :

| forme | disponible | EN ATTENTE |
|---|---|---|
| solde (`wallet`) | `main` | `escrow` |
| versements (`payouts`) | `balance` | **`pending_balance`** |

Or `fetchWalletEscrow` lisait `escrow` **ou `balance`** (§5.14 point 8) : dès qu'un compte est capté par `payouts`, son argent **disponible** était compté dans le total « en attente ». `pending_balance` — le vrai champ — **n'était lu nulle part**.

➡️ Règle posée : `attente = escrow ?? pending_balance`, `dispo = main ?? balance`, **jamais l'un pour l'autre**. La fonction renvoie désormais les deux, et la carte les affiche **côte à côte** (« en attente X € · à côté, Y € déjà disponibles à virer — les deux ne se confondent pas »).

⚠️ **HONNÊTETÉ — mesuré : le total d'aujourd'hui NE CHANGE PAS** (504,00 € avant comme après), parce qu'aucun compte vivant n'a actuellement de ligne au format `payouts`. Le correctif empêche le faux à venir et sépare enfin les deux notions ; il n'explique pas à lui seul un 504 € qui paraîtrait trop haut. **Ce qui l'explique** : seuls **2 porte-monnaie sur 8** sont captés, et celui de `julatace3535` (359 €) date de **5 jours**. La carte le dit déjà (nombre de porte-monnaie + âge du plus ancien).

### 2. ⚠️ Le garde-fou porte-monnaie n'était pas dans la fonction qui écrit
`estPorteMonnaie` n'était testé **que chez l'appelant** (moisson active) — donc `storeHarvestRow` pouvait écrire un `payload: {}` par-dessus un vrai solde. **Mesuré : 4 comptes sur 8 avaient une ligne `billing` vide**, donc leur argent en attente invisible. Et le test lui-même finissait par `|| p.main || p.escrow`, ce qui laissait passer un objet vide.
- `estPorteMonnaie` exige maintenant **un montant réel** parmi `main`/`escrow`/`balance`/`pending_balance` ;
- le test est **dans `storeHarvestRow`**, pas seulement chez ses appelants. Un garde-fou vit dans la fonction qui écrit.

### 3. « Je ne sais pas où aller chercher mes colis » — mesuré avant de coder
| constat | chiffre |
|---|---|
| colis réellement à retirer (statut Vinted) | **2** |
| ces 2 colis ont un email de suivi | **0** ⚠️ |
| emails de suivi en base | 94 (MR 58 · Chronopost 26 · Vinted 5 · Colissimo 4 · Shop2Shop 1) |
| emails portant un **lieu** | **13 / 94** |
| `shipment` dans la transaction | `{id, status, status_title, status_updated_at}` — **aucune adresse** (§16 reconfirmé) |

Donc pour les colis du jour, l'app **ne peut rien afficher** : la donnée n'existe nulle part. Deux réponses :

**a) On complète le lieu depuis la liste officielle de Vinted.** Quand l'email donne le NOM du relais sans adresse ni horaires, on va les chercher dans les points captés (§5.26) — **par NOM EXACT normalisé uniquement**, jamais par ressemblance (§24). Ce n'est pas une déduction : c'est la même enseigne dans la liste de Vinted. La carte « colis à retirer » gagne l'**adresse**, l'**ouverture du jour** et un itinéraire par **coordonnées** (plus précis qu'une recherche texte).
**Vérifié sur les vraies données** : les 3 noms de relais présents dans les emails → **2 rapprochés** (« MAISON DE LA PRESSE » et « Maison de la Presse, » → *40 Rue du Port, Cancale · Vendredi 09:30–18:30*), le 3ᵉ étant « juste ici », le remplissage parasite que `cleanLieu` rejette déjà.

**b) On capte le détail de l'expédition.** La transaction donne le `shipment.id` et Vinted sert des `/api/v2/shipments/{id}/…` (vus dans `seen_urls`). Nouveau motif `shipment` dans `inject.js` → **une ligne PAR COLIS** (`harvest_{uid}_ship_{id}`) : sans l'identifiant dans la clé, un colis écraserait le précédent. ⚠️ Motif borné à `(?:\?|$)` pour ne pas avaler `label_url` / `label_options` / `nearby_drop_off_points`.
➡️ **Prochaine session** : lire `harvest_*_ship_*` dès que Julien aura ouvert une page de suivi avec la 5.20 — c'est là qu'on saura si Vinted expose le point de retrait côté API, ou si l'email reste la seule source.

### Vérifié
`npm run build` OK · `node --check` OK sur `background.js` et `inject.js` · banc app (§20, `dist` servi, Supabase mocké honorant `select=`, vraies lignes) : carte « Où déposer » avec **les deux transporteurs**, **0 erreur** (le seul 400 est le sondage `select=owner` volontaire) · `scripts/audit-coherence.cjs` : **5 règles, 0 désaccord** · règle du porte-monnaie exécutée sur les vraies lignes : ancien 504,00 € → nouveau **504,00 € en attente + 114,36 € disponibles** distingués. Extension **5.20.0**.

### 5.27 (suite) — ⚠️ LE TOTAL N'ÉTAIT PAS FAUX, IL ÉTAIT **INCOMPLET** (et il se présentait comme complet)

Capture d'écran de Julien : sur **un seul** compte, « Montant en attente **323,10 €** / Montant disponible 0,00 € ». Or l'app annonçait 504 € pour ~7 comptes. Sa conclusion est juste — et ce 323,10 € **ne correspond à aucune** des deux valeurs en base (359 € et 145 €), donc **ce compte n'a jamais été capté**.

Relevé des 8 lignes `billing` : **2 seulement portent un montant**, les **6 autres sont vides** (`payload: {}`) — écrites par une version de l'extension antérieure au garde-fou (d'où le correctif ci-dessus, désormais dans `storeHarvestRow`).

➡️ **Un total partiel qui se présente comme complet est pire qu'un total absent.** La carte « Argent en attente » porte maintenant un bandeau qui **NOMME les comptes manquants** :
> ⚠️ Total incomplet — 6 comptes sur 8 n'ont pas encore de porte-monnaie lu, donc leur argent en attente n'est pas dans ce chiffre : julienf765, tomj683, angeled92, llloollllaa, liliand653, julatace35260.

`fetchWalletEscrow` renvoie `avecSolde` (les uid réellement lus) ; la carte croise avec les comptes actifs (`acctOff` exclu, §11).

⚠️ **PIÈGE §26 ÉVITÉ DE JUSTESSE** : ma 1ʳᵉ version appelait `acctLabel(a)` — **fonction inexistante dans cette portée**. `npm run build` passe (JSX ne le voit pas) et un smoke sans données ne rend pas la carte : c'est **exactement** le plantage « `reel is not defined` » de §26. Le bon helper est `accName(acc)` (l. 11142). **Toute carte conditionnelle doit être RENDUE avec les vraies données**, pas seulement compilée.

⚠️ **Piège de banc, nouveau** : l'app filtre avec le joker SQL **`%`** (`id=like.harvest_123_orders_%`), mon mock ne traduisait que `*` → aucune commande servie, l'écran Ventes tombait en « Impossible de charger » et la carte n'était jamais rendue. Corrigé (`/[*%]/g`).

**Vérifié au banc, carte réellement rendue sur les vraies données** : « lu sur 3 porte-monnaie · 114,36 € disponibles » + le bandeau nommant les **6 comptes manquants**, **0 erreur** (le seul 400 est le sondage `select=owner` volontaire).

### 5.27 (suite) — LE DÉCOMPTE : la carte « en attente » s'ouvre

Julien : « quand j'appuie sur en attente, je veux le détail du décompte ». Un chiffre agrégé qu'on ne peut pas ouvrir est invérifiable — donc invendable.

`fetchWalletEscrow` renvoie **`parCompte`** : `{uid, attente, dispo, jours, format}` par ligne lue, trié par montant décroissant. La carte devient un bouton (`detailAttente`) qui déroule :
- **une ligne par compte lu** : nom · « lu aujourd'hui / il y a N j » · le disponible en second · le montant en attente à droite ;
- **une ligne par compte NON lu**, à `?`, avec « porte-monnaie jamais lu — ouvre-le sur Vinted » (c'est là qu'est l'écart) ;
- un **« Total lu »** en pied, qui doit égaler le grand chiffre.

**Vérifié au banc sur les vraies données** : 359,00 € (lu il y a 5 j) · 145,00 € (lu aujourd'hui · 114,36 € disponibles) · 0,00 € · **6 lignes « jamais lu »** · **Total lu 504,00 €**. **0 erreur.**

### 5.27 (suite) — ⚠️ JULIEN AVAIT LA RÈGLE : en attente = SOMME DES VENTES EN COURS

« Si tu n'arrives pas à capter la bonne somme en attente, c'est que tu ne captes pas toutes les ventes en cours — il s'agit simplement de la somme des ventes en cours. »

**Testé compte par compte contre le solde annoncé par Vinted** (ventes moissonnées, `classifyOrderStatus==='pending'`) :

| compte | escrow Vinted | somme des ventes en cours |
|---|---|---|
| **angeled92** | **91,00 €** | **91,00 € (4)** ✅ **exact** |
| julatace3535 | 359,00 € | 283,10 € (8) — manque 75,90 € |
| julatace35260 | 157,00 € | 125,00 € (3) — manque 32,00 € |
| tomj606 | 145,00 € | 116,00 € (3) — manque 29,00 € |

➡️ **La règle est juste** (un compte tombe à l'euro près) et **l'écart mesure exactement les ventes non captées** — c'est le diagnostic qu'il proposait, confirmé par les chiffres.

**Ce qu'on en fait** : un compte dont le porte-monnaie n'a jamais été lu n'affiche plus « ? » — on **calcule** son en-attente depuis ses ventes en cours, marqué « estimé sur N ventes en cours ». Pied du décompte : **Total lu chez Vinted · + estimé sur les autres comptes · Total probable**.
⚠️ Là où Vinted a parlé, **son solde fait foi** : on ne remplace jamais un chiffre mesuré par une estimation, et un escrow supérieur à la somme des ventes reste visible tel quel — c'est le signal « il manque des ventes ici ».

⚠️ **PIÈGE DE MESURE (§21, troisième fois)** : mon premier script rendait **0 vente en cours partout**. Cause — `price` est un **objet** `{amount, currency_code}`, pas un nombre : `String(price)` → `"[object Object]"` → NaN → toutes les ventes écartées. J'ai failli conclure « aucune vente en cours » et accuser la capture. **Toujours vérifier la FORME du champ avant de conclure à un zéro.**

**Vérifié au banc** (vraies données) : lignes estimées rendues (≈ 36 / 30 / 91 / 126 / 125 €), pied « Total lu 504,00 € · + estimé ≈ 408,00 € · **Total probable ≈ 912,00 €** », **0 erreur**.

### 5.27 (suite) — ✅ LA LECTURE DU SOLDE EST AUTOMATIQUE (mesuré, pas supposé)

Julien : « ça ne peut pas lire automatiquement sans que j'aie besoin d'aller dans le porte-monnaie ». **Si — et ça marchait déjà.** `activeFetchAll` (moisson active, §4.26) appelle `/api/v2/users/{profileId}/payouts` pour le **compte connecté**, à chaque visite sur Vinted (§5.19). Ce qui bloquait, c'étaient les lignes `billing` **vides** écrites avant le garde-fou de `storeHarvestRow` (§5.27 point 2) : elles écrasaient les vrais soldes.

**Relevé après qu'il a chargé la 5.20 et rouvert ses comptes** (16 août, aucun porte-monnaie ouvert à la main) :

| compte | en attente | disponible | capté |
|---|---|---|---|
| julatace3535 | 359,00 € | 0,00 € | 11 août (5 j) |
| julatace35260 | **157,00 €** | 0,00 € | 16 août 20:07 |
| tomj606 | 145,00 € | 114,36 € | 16 août 20:08 |
| llloollllaa | 126,00 € | 0,00 € | 16 août 20:07 |
| angeled92 | 91,00 € | 79,00 € | 16 août 20:06 |
| julienf765 | 69,00 € | 77,20 € | 16 août 20:08 |
| tomj683 | 30,00 € | 140,00 € | 16 août 20:08 |
| **total** | **977,00 €** | **410,56 €** | 7 / 8 comptes |

**6 soldes captés entre 20:06 et 20:08**, tout seuls. Et le **157,00 € de `julatace35260` est exactement le chiffre que Julien avait relevé à l'écran** — la lecture est juste, pas seulement présente.

Il ne manquait que **`liliand653`** — ⚠️ **Julien l'a MASQUÉ le 17 août** (`vinted_accounts_hidden` = `3175772080`) : ce compte est hors comptabilité, il n'y a plus rien à en attendre. Ne plus le lister comme un manque.

➡️ Les trois textes de l'app qui disaient « ouvre Mon porte-monnaie sur Vinted » sont **faux depuis la 5.20** et ont été corrigés : le seul geste utile est **se connecter une fois au compte**. ⚠️ Ne pas réintroduire la consigne « ouvre ton porte-monnaie ».

---

## 5.28 — LES PHOTOS, LES BORDEREAUX ET LES REÇUS : trois causes, toutes mesurées à l'écran

Plainte de Julien : « je n'ai plus les photos des ventes… les reçus ne sont pas très bien… la fiabilité des bordereaux n'est vraiment pas bonne, tu me montres une 1000 et c'est marqué Nike air Max obsidienne, je n'ai même pas les dernières que j'ai vendues… prends en compte ce que l'extension capte… tout le monde ne va pas connecter son e-mail ».

Méthode : **rendre l'écran Bordereaux sur les vraies données** (§20) avant d'écrire une ligne. Il avait raison sur les trois points, et chacun avait une cause distincte.

### 1. ⚠️⚠️ `photo_url` N'EXISTE PAS — l'app lisait un champ que rien n'écrit
Une commande Vinted porte **`photo: { url, high_resolution }`** (vérifié : **219 des 275 ventes** en base). Or **toute** l'app affichait `o.photo_url` — un champ **jamais assigné nulle part** (`grep "photo_url\s*[:=]"` → **0 résultat**). D'où le pictogramme 👟 sur chaque vente, chaque achat, chaque reçu, chaque ligne de bordereau.

⚠️ Le dégât n'était pas que cosmétique : `entryKeyByPhoto(o)` lisait lui aussi `o.photo_url`, donc le **rapprochement vente↔paire PAR PHOTO** (la voie la plus sûre de `resolvedEntry`, celle qui gère les titres en double) **n'a jamais fonctionné**. On retombait toujours sur le titre.

➡️ **`orderPhoto(o)` (module-level) = LA lecture de la photo d'une commande.** 14 sites convertis. **Mesuré : Ventes 0 → 145 photos, Achats 29, Bordereaux 4** ; le rapprochement par photo retrouve maintenant le numéro de **58 ventes sur 275** (21 %) — les autres n'ont réellement pas d'annonce numérotée correspondante.

### 2. LES BORDEREAUX VENAIENT DES EMAILS — ils viennent maintenant de la MOISSON
Ce que l'écran affichait vraiment, mesuré :
| | |
|---|---|
| ventes qui attendent réellement mon envoi (statut Vinted) | **3** (angeled92 ×2, julatace3535, toutes du 16/08) |
| ces 3 ventes ont un email de bordereau | **0** |
| bordereaux affichés « à imprimer » | **1** — « nike air max 1 obsidian lilac bloom », vendu le **16/07** sur **`vanessa5723`, un compte SUPPRIMÉ** |

C'est très exactement sa phrase. Deux défauts :
- l'écran était construit sur `email_bord_*` : **pas d'email = pas de colis affiché**, donc ses 3 vraies ventes étaient reléguées dans une seconde liste, tout en bas, sans photo ;
- `bordShipped` refuse de conclure quand la vente est inconnue (« on ne conclut pas ») → un bordereau **orphelin restait à imprimer POUR TOUJOURS**.

➡️ **`expeditions()` = la liste, et elle part de la moisson** : une entrée = une vente que Vinted attend (`needsBordereau`, identité = n° de transaction). L'email n'apporte plus que **le PDF**, accroché par transaction. Conséquences :
- **ça marche sans email** (« tout le monde ne va pas connecter son e-mail ») : sans PDF la carte propose **« 📄 Générer sur Vinted ↗ »** + **« 📎 J'ai le PDF »** (glisser le fichier téléchargé, il est tamponné du N°) ;
- **un colis parti disparaît tout seul** : la vente ne demande plus d'envoi ⟹ elle sort de la liste. Rien à cocher ;
- un bordereau email **sans vente correspondante** n'est gardé que s'il a **moins de 21 jours** ET que **son compte existe encore** (`ORPHELIN_MAX_J`) — c'est ce qui fait disparaître l'obsidian ;
- **une seule liste** au lieu de deux, avec photo (celle de la vente = identité certaine, jamais un rapprochement par titre, §24), N°, compte, prix, urgence, case au garage, facture pro ;
- **« ✓ Colis fait » marque les DEUX** marqueurs (`vinted_ship_done` + `vinted_bords_shipped`) : deux marqueurs pour un même carton, c'était deux chiffres qui divergeaient ;
- **« 🔢 Poser le N° »** sur une vente sans bordereau : il n'existait **aucun** moyen de poser le numéro qu'on tamponne quand l'email manque. Le numéro n'est pas deviné (le titre de revente diffère souvent de celui de l'annonce) — Julien le donne, c'est mémorisé dans `vinted_sale_overrides`.

L'écran s'appelle désormais **« Colis à envoyer »**. Les bordereaux terminés restent consultables (« voir ») avec un bouton **Réimprimer**.

**Vérifié au banc, écran rendu** : 3 colis, les 3 vraies ventes du 16/08, **3 photos**, l'obsidian disparu, **0 PAGEERROR**. Puis avec un bordereau email relié (fixture de banc uniquement, jamais en base) : la carte passe à **N°21 · 🖨 Imprimer · 🔍 Suivre** et le bouton d'impression groupée réapparaît.

### 3. LE REÇU D'ACHAT : refait
L'ancien était une colonne de champs **sans accents** (« Recu d'achat »), sans photo, sans le numéro de la paire — on ne savait pas de quelle chaussure il s'agissait. Le nouveau : en-tête + **encadré paire (photo, titre, N°, pointure, marque, montant payé en gros)** + détail **en deux colonnes** (date, compte, vendeur, transaction, statut) + mention légale en pied. Les **accents passent** avec les polices standard de pdf-lib (WinAnsi) — la prudence d'origine n'était pas nécessaire.

⚠️ **La photo passe par l'extension, et il n'y a pas d'autre voie.** Vérifié au `curl` : le CDN Vinted ne renvoie **aucun** en-tête CORS, donc une page web peut *afficher* l'image mais pas en *lire les octets* (et un canvas nourri d'une image cross-origin devient inexportable, §4.93). Nouveau relais **`{__vmr:'photo'}`** → `bridge.js` → `photoBytes` du service worker, **borné au CDN `*.vinted.net`** (ce pont ne doit pas devenir un téléchargeur d'URL arbitraire). Sans extension : reçu **sans photo**, rien ne casse.

**Vérifié à l'octet** : le PDF téléchargé porte « Reçu d'achat », « Payé 28,15 € », le compte, la transaction, le statut, la mention légale — et **aucun chevauchement** (positions relevées dans le flux : 469 / 453 / 435). ⚠️ La 1ʳᵉ version écrivait le montant **par-dessus** la marque quand il n'y a pas de photo (bloc de 62 px au lieu de 96) : c'est la lecture des coordonnées dans le PDF qui l'a montré, pas la relecture du code.

### 4. Une ligne de test m'appartenant dormait encore en production
`email_bord_99000000001` (« Nike Air Max N°99001 Taille 42 », §5.19) était toujours là. **Vidée** (`{supprime:true}` — le `DELETE` reste sans effet avec la clé publique, §5.22).

**Vérifié** : `npm run build` OK · smoke app 12 écrans sur les vraies données, **0 PAGEERROR** (les seuls « suspects » restent l'accord de « 1 colis », invariable) · `node --check` OK sur `background.js` et `bridge.js`. Extension **5.21.0**.

### 5.28 (suite) — RÈGLE : IL NE PEUT PAS Y AVOIR DE BORDEREAU SANS VENTE

Julien pose la règle. **Vérifiée sur la base avant de coder : 72 des 73 bordereaux retrouvent leur vente, 0 orphelin** (le 73ᵉ était ma ligne de test, vidée le jour même). Elle tient.

Conséquence sur `expeditions()` : la branche « bordereau orphelin gardé 21 jours » **est supprimée**. Un bordereau qu'on ne rattache à aucune vente **n'est pas un colis à préparer** — c'est le signe que la MOISSON manque (compte supprimé, capture en retard). Le mettre dans la liste de travail, c'était exactement le bordereau fantôme d'un compte supprimé qui restait affiché pour toujours.

➡️ Il ressort en **signalement** (`bordSansVente`, bandeau orange, seuil `SANS_VENTE_MAX_J = 21 j`) qui nomme le compte concerné et dit quoi faire (« repasse une fois sur Vinted avec ce compte »), **jamais en carton à préparer**.

**Vérifié au banc dans les deux sens** : sans orphelin → aucun bandeau, 3 colis ; avec un orphelin injecté (fixture de banc, jamais en base) → bandeau « 1 bordereau reçu sans vente correspondante · julatace3535 » et **toujours 3 colis**, pas 4. **0 PAGEERROR** dans les deux cas.

---

## 5.29 — LE BORDEREAU SE GÉNÈRE TOUT SEUL À L'ARRIVÉE SUR VINTED

Demande de Julien : « enlève le bouton *générer* de l'application ; dès que je me connecte sur Vinted, si une vente n'a pas son bordereau, que l'extension appuie et le mette dans l'application ».

### Pourquoi c'est ACCEPTÉ, alors que l'auto-acceptation d'offre reste refusée
Générer un bordereau **n'engage aucun argent et ne décide de rien** : la vente est faite, le colis doit partir, il n'y a ni prix ni choix — c'est une formalité obligatoire. Accepter une offre, si (§45 : vente ferme, et le champ « offre en attente » n'a jamais été observé). C'est la même distinction que §46, qui autorisait déjà la génération **sur clic** ; ici elle passe automatique.

### La distinction que personne ne faisait : GÉNÉRER ≠ EXPÉDIER
Deux statuts Vinted se ressemblent et veulent dire l'inverse :
| statut | ce que ça veut dire |
|---|---|
| **« Le paiement a été validé »** | le bordereau **n'existe pas encore** → à générer |
| **« Bordereau envoyé au vendeur »** | il **existe déjà** → il n'y a qu'à l'imprimer |

**`aGenererBordereau(statut)`** (module-level dans `App.jsx` ET dans `background.js`, copie à l'identique) : `paiement validé` ET pas de mot « bordereau » ET rien d'annulé/finalisé. Ajoutée à `scripts/audit-coherence.cjs` — **0 désaccord sur les 12 statuts réels**. Sans cette distinction, on aurait regénéré des bordereaux existants : des requêtes pour rien, exactement le bruit qu'on évite.

### Ce qui tourne, et ses garde-fous
`genererBordereauxEnAttente(uid)` est appelée par **`visiteVinted()`**, après la moisson (sinon on travaillerait sur des statuts périmés).
- **Uniquement le compte connecté dans cet onglet** (`garde`, §48) — agir au nom d'un autre compte est LE signal multi-comptes que Vinted sanctionne (§5).
- Plafond existant de **20 actions/h par compte**.
- ⚠️ **Au plus 3 par visite** (`BORD_MAX_PAR_VISITE`). Ce n'est **pas** un « rythme faussement humain » (toujours refusé, §32) : c'est une limite de volume, de même nature que le plafond horaire. Mesuré sur les vraies données : **1 seule vente à générer aujourd'hui** — la rafale est théorique.
- Une vente refusée n'est **pas réessayée avant 6 h** (`vrmBordFaits`, mémo local, aucun égress).
- Un bordereau déjà reçu par email ⟹ on ne regénère pas.
- Adresse d'envoi inconnue ⟹ refus honnête, **0 requête** (`adresseVendeur` lit le `seller_address_id` capté par compte : **6 comptes sur 8** l'ont). ⚠️ Le seul compte ACTIF qui n'en a pas est **`julatace3535`** — il faut y générer un bordereau à la main une fois, l'extension retiendra l'adresse. (`liliand653` est masqué, voir ci-dessous.)

### Récupérer le PDF : tenté, pas promis
Après génération on essaie `transaction → shipment.id → GET /api/v2/shipments/{id}/label_url` puis on range le PDF en `harvest_{uid}_label_latest` (ce que l'app lit déjà). ⚠️ **L'endpoint a été VU dans les URL observées (§5.26) mais sa réponse n'a jamais été capturée** : lecture défensive sur plusieurs noms de champ, et si ça ne donne rien **on ne prétend rien** — le journal dit « le PDF arrivera par email » (§3). C'est la seule partie non garantie ; la génération, elle, l'est.

### Côté app : le bouton disparaît
Plus de « 📄 Générer sur Vinted ↗ ». La carte dit où on en est : **« ⏳ L'extension le génère à ta prochaine visite sur Vinted »** ou **« ✅ Bordereau déjà généré chez Vinted — le PDF arrive par email »**. « 📎 J'ai le PDF » reste (dépôt manuel du fichier téléchargé).

**Vérifié** : banc `vm` exécutant le VRAI `genererBordereauxEnAttente`, **8 cas → 0 non conforme** (génère 1 quand il faut ; 0 sur « bordereau envoyé », sur annulé/remboursé, sans adresse, si l'email l'a déjà, si tenté il y a 1 h ; **3 max** quand 5 sont en attente ; **0 si le navigateur est sur un autre compte**). Banc app : les 3 cartes affichent le bon état (2 « déjà généré », 1 « l'extension le génère »), **0 PAGEERROR**. `audit-coherence` : **6 règles, 0 désaccord**. Extension **5.22.0**.

### ⚠️ `liliand653` : MASQUÉ (17 août), pas supprimé
Julien : « oublie liliand653, je l'ai enlevé dans l'application ». Vérifié en base : son uid **3175772080** est dans **`vinted_accounts_hidden`** (clé synchronisée) — donc masqué. Il n'apparaît nulle part, ne compte dans aucun total, et l'extension ne génère rien pour lui (elle ne travaille que sur le compte connecté).
⚠️ **Masqué ≠ supprimé** (§5.10 vs §5.22) : sa ligne `vinted_accounts` existe toujours, donc si Julien s'y reconnecte dans Chrome l'extension le recapte (il reste masqué pour autant). Pour l'effacer vraiment il y a « 🗑 Supprimer ce compte ».
➡️ **Ne plus le compter comme un compte à rafraîchir** dans les relevés (porte-monnaie non lu, adresse d'envoi manquante, capture ancienne) : ce n'est pas un manque, c'est un choix.

---

## 5.30 — LE NUMÉRO MANQUANT : la numérotation auto ne voyait que les annonces EN LIGNE

Julien : « je me retrouve avec des paires qui n'ont pas de numéro, alors que normalement c'est censé être en automatique ».

### La cause, mesurée
L'effet de numérotation automatique tourne sur **`annBase`** — c'est-à-dire les annonces **encore en ligne**. Une paire vendue **avant** que l'app soit ouverte n'y passe donc jamais.

| | |
|---|---|
| annonces EN LIGNE | 27 · **0 sans numéro** |
| annonces FERMÉES (vendues/retirées) | 234 · **171 sans numéro** |

Les 3 colis à envoyer du jour en faisaient partie : leurs annonces (`9677383874`, `9677588666`, `9677552994`) sont bien dans le dressing capté, toutes `is_closed: true`, et **aucune n'a jamais eu d'entrée dans `vinted_annonce_numeros`**. Le rapprochement par photo ne pouvait rien y faire — il n'y avait rien à rapprocher.

### Ce qui a changé (et le garde-fou qui va avec)
L'effet « auto-numéro des ventes » existait déjà mais faisait **réutilisation SEULE** : depuis juillet il n'invente plus de numéro, parce qu'en inventer pour toutes les ventes avait fait grimper le compteur de 50 à 120. Cette règle reste — on l'**élargit au seul cas où le numéro est indispensable** :

➡️ une vente qui **attend encore l'envoi** (`needsBordereau`) et pour laquelle aucun numéro n'est retrouvé reçoit **le plus petit numéro libre**, écrit dans `vinted_sale_overrides` (clé synchronisée) avec le drapeau **`autoShip`**.

Pourquoi c'est cohérent avec §7 (« un numéro = une place au garage ») : le carton est **physiquement à la maison**, il occupe une place, et il faut écrire quelque chose dessus pour l'expédier. Le numéro repart dans le pool dès que le colis est parti (`freedNums`).
⚠️ **Strictement limité aux ventes qui attendent l'envoi** : 3 ventes aujourd'hui, pas les 275 de l'historique — c'est ce qui évite l'incident de juillet. Le nettoyage des vieux numéros inventés épargne désormais `autoShip` (celui-là est écrit sur un vrai carton).

**Mesuré au banc** : les 3 colis passent de « N° en attente » à **N°117, N°55, N°84** — trois numéros distincts, **aucun porté par une annonce en ligne**, aucun posé au garage.

### Capter le bordereau : on ne devine plus, on mesure
`recupererLabel` essayait un seul chemin (`/shipments/{id}/label_url`) et abandonnait en silence si la réponse n'avait pas la forme attendue — or **cette forme n'a jamais été observée**.
- **`urlDeLabel(o)`** balaie la réponse (4 niveaux) et retient la première URL plausible, au lieu de parier sur un nom de champ.
- Trois chemins essayés à la suite (`label_url`, la transaction d'expédition, `label_options`), et **un échantillon de chaque réponse est conservé** dans `panel_diag_capture.rates` — la méthode qui a fini par expliquer la fiche article (§5.24 → §5.26).
- La ligne `harvest_{uid}_label_latest` porte maintenant **`tx`** : le PDF est donc rattaché à LA bonne vente.

Côté app, un bordereau capté vaut un bordereau reçu par email : la carte affiche **« 🖨 Imprimer »** + la pastille « 📎 Bordereau capté par l'extension ». ⚠️ Lecture des **scalaires** (`tx`, `capturedAt`) pour l'affichage, octets du PDF **seulement à l'impression** — sinon ouvrir l'écran retéléchargerait un PDF par compte (§34).

### ⚠️ J'ai introduit un plantage, et le filet l'a attrapé
En rendant `pdf` vrai pour une entrée **sans** bordereau email, le récap appelait `invForBord(e.b)` avec `e.b === null` → `Cannot read properties of null (reading 'transaction')`. **`EcranGardeFou` (§5.14) a fait exactement son travail** : message d'erreur, navigation intacte, rien de perdu — et le banc l'a vu tout de suite. Corrigé (`e.b && invForBord(e.b)`), et `bordKey` rendu insensible à `null` puisque c'est un helper bas niveau.

**Vérifié** : banc `vm` sur le vrai code de l'extension, **11 cas → 0 non conforme** (dont l'URL du PDF trouvée à plat ET imbriquée, et « aucune URL → on ne prétend rien ») · banc app dans les deux états (avec et sans bordereau capté), **0 PAGEERROR** · smoke 12 écrans, **0 PAGEERROR** · `audit-coherence` : 6 règles, 0 désaccord. Extension **5.23.0**.

---

## 5.31 — LE GARAGE, LA PÉRIODE, ET LE BORDEREAU QU'ON N'ALLAIT JAMAIS CHERCHER

### 1. « Le garage ne marche plus » — une bande verticale de 25 cartons
`LAYOUT` déclarait **une seule colonne de 25 places**. Rendu réel (capture) : 25 rectangles empilés en colonne sur **1 244 px de haut**, illisible.
➡️ `COL_H = 8`, **4 colonnes de 8** = 32 places, la forme d'un vrai meuble (mesuré : 32 cases, page ramenée à **666 px**). `extraCols` ajoute des colonnes de la même hauteur.
⚠️ Le changement **déplace la correspondance case↔numéro** : c'était sans risque ici (garage vide en base, 0 case posée), ça ne le serait plus une fois qu'il aura rangé des paires.
Deuxième défaut du même écran : les cases vides sont masquées par défaut → garage vide = **écran totalement vide**. On montre l'étagère tant qu'aucune case n'est remplie.

### 2. Filtre de période sur Ventes et Achats (demande : « comme sur Airbnb »)
`PeriodePicker` (module-level) : raccourcis **Ce mois / Mois dernier / 7 j / 30 j / année** + un **calendrier** début→fin (lundi en premier, 2ᵉ clic avant le 1er = on repart de zéro, sinon on se coince). `dansPeriode(o, p)` est branché **dans `matchOrd`**, donc la liste, la recherche et les compteurs partagent la même règle.
⚠️ **Les totaux devaient suivre** : au premier essai, filtrer sur « ce mois » laissait « CA finalisé 6 068 € · 212 ventes » au-dessus d'une liste de quelques lignes — deux chiffres pour la même chose sur le même écran (§11). Le memo `totals` filtre désormais lui aussi. **Mesuré : 212 ventes / 6 068 € → 40 / 1 397 € (ce mois) → 2 / 37 € (7 jours).**

### 3. La barre d'outils était sous six bandeaux
Capture de l'écran Ventes : avant d'atteindre la moindre vente il fallait passer « colis à expédier », « argent en attente » (+ son encadré), « vente repérée », 4 cartes de stats, « Wrapped », « Analyse »… La période et la recherche arrivaient après. **Ce qu'on manipule tous les jours passe en premier**, juste sous le titre.

### 4. ⚠️ « Ça ne capte pas le bordereau » — on n'allait le chercher qu'après l'avoir généré
Le diagnostic en base l'a montré sans ambiguïté : `panel_diag_capture` **ne portait aucune clé `label`** — `recupererLabel` n'avait jamais été atteinte. Raison : elle n'était appelée qu'**après une génération réussie**. Or une vente au statut **« Bordereau envoyé au vendeur » a déjà son étiquette chez Vinted** : rien à générer, donc on ne passait jamais la chercher. **2 des 3 colis de Julien étaient exactement dans ce cas.**
Second défaut, plus bête : `if (!candidates.length) return 0;` sortait avant toute autre passe dès qu'il n'y avait rien à générer.
➡️ **2ᵉ passe** dans `genererBordereauxEnAttente` : toute vente qui attend l'envoi, dont l'étiquette existe, sans PDF connu (ni email, ni `label_latest`), déclenche `recupererLabel`. Mêmes garde-fous (compte connecté, 3 par visite, pas de nouvel essai avant 6 h).

**Vérifié** : banc `vm` sur le vrai code, **14 cas → 0 non conforme** (dont « bordereau envoyé → 0 génération mais le PDF est récupéré », « PDF déjà reçu par email → on ne redemande rien », « vente finalisée → on ne va rien chercher ») · banc app : garage 32 cases, filtre de période mesuré sur les 3 états · smoke 12 écrans **0 PAGEERROR** · `audit-coherence` 6 règles, 0 désaccord. Extension **5.24.0**.

### 5.31 (suite) — L'EXTENSION ENVOIE LE BORDEREAU, L'EMAIL N'EST QU'UNE VÉRIFICATION

Julien : « je veux que l'extension récupère le bordereau et l'envoie dans l'application, pas qu'elle génère et qu'on attende le mail. Le mail doit simplement être une vérification qu'il n'y a pas d'erreur ».

Trois défauts empêchaient ça, tous corrigés :

1. **`harvest_{uid}_label_latest` = UNE SEULE ligne par compte**, écrasée à chaque capture. Avec 3 colis à envoyer, l'app n'en voyait qu'un. ➡️ **une ligne par bordereau** : `harvest_{uid}_label_{tx}` — la clé porte le n° de transaction, c'est-à-dire l'identité de la vente, donc du bordereau (il ne peut pas y avoir de bordereau sans vente, §5.28). `label_latest` reste écrite pour les écrans qui la lisent encore.
2. **Côté app, on ne lisait que `label_latest`.** ➡️ `fetchCapturedLabelMetas(uid)` lit **toutes** les lignes `harvest_{uid}_label_*` en scalaires (`tx`, `capturedAt`) ; les octets ne partent qu'à l'impression (`fetchLabelPdf(rowId)`) — sinon ouvrir l'écran retéléchargerait un PDF par colis (§34).
3. **L'email passait en premier à l'impression.** ➡️ **le PDF capté par l'extension est la source**, l'email n'est plus qu'un secours ; la carte le dit : « 📎 Bordereau récupéré chez Vinted par l'extension · ✓ confirmé par l'email » quand les deux sont là.

**Téléchargement manuel relié à sa vente** : `storeLabel` (capture par `chrome.downloads`) ne savait pas à quel colis appartenait le PDF. Il l'attribue désormais **uniquement s'il n'existe qu'UN seul colis possible** pour ce compte — ce n'est pas une devinette (§24), c'est le seul candidat. Sinon le PDF reste « le dernier capté », comme avant.

**Vérifié au banc** : 3 bordereaux captés (un par colis) → **les 3 cartes affichent « 🖨 Imprimer »** + « 🖨 Tout imprimer (3) », pastille « récupéré chez Vinted » sur chacune, **0 PAGEERROR**. Banc `vm` extension : 14 cas, 0 non conforme. Smoke 12 écrans : 0 PAGEERROR. Extension **5.25.0**.

⚠️ **Ce qui reste incertain, dit franchement** : la réponse de `/api/v2/shipments/{id}/label_url` n'a **toujours jamais été observée**. `urlDeLabel` balaie la réponse pour trouver l'URL et un échantillon est conservé dans `panel_diag_capture.rates` — si aucun des trois chemins ne répond, on ne prétend rien et l'email reste le filet. C'est la seule pièce non garantie de la chaîne.

---

## 5.32 — LE TABLEAU DE BORD DES BORDEREAUX (panneau) : par compte, floutés, avec compte rendu

Demande de Julien : « comme font les autres extensions — nos ventes par compte, les autres comptes affichés mais **floutés** car on n'est pas encore dessus ; on sélectionne une vente, on appuie sur **générer** ; et à droite le **compte rendu** pour voir si l'extension a capté ET envoyé à l'application. Pareil pour les numéros. »

### Ce que ça change dans le principe
La génération **repasse sur son clic** (`visiteVinted` ne génère plus rien). Ce qui reste automatique est **en lecture seule** : aller chercher le PDF des bordereaux déjà émis. Générer = agir sur Vinted, donc c'est lui qui appuie.

### L'onglet Bordereaux du panneau
Ventes groupées **par compte**, le compte connecté en premier. Les autres sont **floutés** (`filter: blur` + `pointer-events:none`) avec la mention « connecte-toi à ce compte pour agir ».
⚠️ Le flou n'est pas décoratif : agir au nom d'un compte qui n'est pas celui connecté envoie une requête depuis la session d'un autre — c'est LE signal multi-comptes que Vinted sanctionne (§48). On le montre **avant** le clic au lieu de laisser échouer après.

Chaque ligne porte le **N° de la paire** (couleur : vert s'il est connu, rouge s'il manque) et, à droite, l'état réel :
| état | ce que ça veut dire | bouton |
|---|---|---|
| ✓ dans l'app | le PDF est en base, rattaché à cette vente | — |
| 📧 reçu par email | l'email est arrivé | 📥 Récupérer |
| étiquette prête | Vinted l'a émise, on ne l'a pas encore | 📥 Récupérer |
| pas encore générée | rien n'existe | 📄 Générer |

Le bouton rend compte **lui-même** (« ⏳ », « ✓ envoyé à l'app », « ✓ généré » si le PDF n'est pas récupérable, ou le message d'erreur exact) — plus besoin d'aller lire un journal ailleurs.

**Le N° part avec le bordereau** : `buildPanelData` lit `vinted_sale_overrides` **par n° de transaction** (identité certaine, jamais un rapprochement par titre §24) et `enrichPairs` ne l'écrase pas.

### ⚠️ DEUX PIÈGES, tous deux trouvés au banc
1. **Collision de classe CSS.** Mes boutons portaient `.vrm-gen-bord` — une classe **déjà utilisée** par les lignes de vente, avec son propre câblage exécuté **après** le mien. Résultat : mon `onclick` était écrasé, le bouton envoyait `genererBord` au lieu de `recupBord`, et un clic « Récupérer » paraissait ne rien faire. Renommés `.vrm-bord-act`. **Deux câblages sur la même classe, le second gagne — et le bouton a l'air mort.**
2. **`const genSection` en double.** Ma section réutilisait le nom d'une variable réassignée plus bas (`genSection = …`) → `TypeError` sur une constante. L'ancien flux « coche puis je t'ouvre chaque vente » a été **retiré** : deux chemins pour le même geste, c'est la meilleure façon de ne plus savoir lequel marche.

**Vérifié au banc panneau** (faux `chrome`, 3 ventes sur 2 comptes) : 1 bloc flouté, 2 boutons d'action, `pointer-events: none` confirmé sur le compte non connecté, clic « Récupérer » → `recupBord` avec le bon `tx`/`uid`, et le message honnête (« Vinted n'a pas donné l'URL du PDF ») remonté dans le panneau. **0 erreur.** Banc `vm` de génération : 14 cas, 0 non conforme. Extension **5.26.0**.
