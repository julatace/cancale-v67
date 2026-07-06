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
  - **Numérotation** : stockée dans **`vinted_annonce_numeros`** (clé = id d'annonce wardrobe) = `{numero, title, buyPrice, buyFromId, photo, price, numberedAt}`. **`vinted_used_numeros`** (append-only) = tous les numéros déjà utilisés : **un numéro n'est JAMAIS réattribué** (compta non ambiguë), suggestion = max+1.
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
