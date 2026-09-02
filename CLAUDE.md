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

---

## 5.33 — FIABILITÉ DU NUMÉRO : une seule règle, « un numéro = une paire présente »

Julien : « quand on attribue un numéro à une paire, il ne doit y avoir **aucune chance** d'erreur — si le numéro n'est pas le bon, la paire est presque impossible à retrouver au garage ». Même enjeu que les bordereaux.

### Ce que la vraie base disait (mesuré avant de coder)
| contrôle | résultat |
|---|---|
| photos partagées par des numéros différents | **0** (le rapprochement par photo est sûr) |
| **titres identiques portant des numéros DIFFÉRENTS** | **6** ⚠️ |
| numéros réutilisés par plusieurs ventes dans l'historique | 31 (normal : §7, un numéro se libère) |
| numéros à la fois sur une annonce en ligne et sur une vente | 11 (historique — **0 sur une vente qui attend l'envoi**) |
| cases posées au garage | 0 |

Le pire cas : **« adidas spezial noir taille 35,5 » a porté N°36, 25, 4, 134, 156 ET 161.** Tout rapprochement par ressemblance de titre peut donc désigner la mauvaise boîte.

### 1. `porteursNum` — LA définition de « qui porte ce numéro »
Un numéro est porté par une paire **réellement présente** quand elle est (a) **en ligne**, (b) **vendue mais pas encore expédiée** (le carton est encore à la maison), ou (c) **posée dans une case du garage**. Un seul memo, **deux usages** (§11) : empêcher une réattribution, et signaler un conflit.
⚠️ **Tous les comptes, même masqués** : masquer un compte cache sa comptabilité, ça ne sort pas le carton de l'étagère.

### 2. Le pool d'attribution devient STRICT
L'auto-numérotation d'une vente à expédier puisait dans `takenNums`, qui **retire** les numéros « libérés ». Elle puise maintenant dans `takenNums ∪ numsOccupes` : **jamais** un numéro encore porté par une paire présente, même si la libération le croyait disponible.

### 3. Le conflit est SIGNALÉ, en rouge, là où il coûte cher
`conflitsNum` → bandeau en tête de **Colis à envoyer** : « 🚨 N numéros portés par deux paires », avec les deux porteurs nommés (📦 en ligne / 📮 à expédier / 🏠 garage). Une annonce restée ouverte après sa vente n'est **pas** un conflit (même paire, même titre) — sinon on crierait au loup en permanence.
⚠️ L'écran Bordereaux charge désormais les annonces en ligne : sans elles le détecteur serait **aveugle exactement là où il sert**.

### 4. Le rapprochement par titre n'accepte plus une pointure inconnue
`entryByTitleLoose` refusait déjà l'ambiguïté, mais gardait un repli « compatible » qui acceptait une paire **sans taille enregistrée**. C'était un pari. On exige désormais une pointure **identique** : sinon rien n'est attribué et le numéro reste à poser à la main. **Mieux vaut un blanc qu'un faux.**

### ⚠️ PIÈGE TDZ — troisième fois (§19)
`porteursNum` lisait `effEntry`, déclaré **80 lignes plus bas** → `Cannot access 'Wn' before initialization`, écran en erreur. Un `useMemo` s'exécute **immédiatement** : il doit être placé APRÈS tout ce qu'il lit. Déplacé juste après `effEntry`.

**Vérifié au banc, dans les deux sens** : sans conflit → aucun bandeau ; avec un conflit forcé (N°1 posé au garage alors qu'une annonce en ligne le porte) → « 🚨 1 numéro porté par deux paires · N°1 — 📦 en ligne « nike p-6000 blanc/jaune taille 40 » · 🏠 garage « case zone-0-3 » ». Smoke 12 écrans : **0 PAGEERROR**.

---

## 5.34 — ⚠️ UNE ANNONCE N'EST PLUS IDENTIFIÉE PAR SON TITRE

Julien : « il y a des gens qui font des ventes avec les mêmes articles, donc les mêmes titres — il faut que ce soit autre chose qui caractérise une annonce ». Puis : « il n'y a pas un identifiant d'annonce chez Vinted, ce serait plus simple ? »

**Il a raison sur les deux points, et l'identifiant existe.**

### Ce que porte vraiment une vente (mesuré sur les 277 ventes captées)
```
date · price · title · status · transaction_id · conversation_id · photo
```
**Aucun `item_id`.** C'est pour ça que le rapprochement se faisait par titre.

### ⚠️ LE PONT : le DÉTAIL de transaction porte `item_id`
`harvest_*_txn_*` → **198 lignes sur 198 portent `transaction.item_id`** (100 %). Or `transaction_id` est présent sur **277 ventes sur 277**. Donc :

> **`transaction_id` → détail de transaction → `item_id` = l'identifiant d'annonce donné par Vinted lui-même.**

Ce n'est pas une ressemblance : c'est Vinted qui dit à quelle annonce correspond la vente.

### La règle unique — `identiteAnnonce(o)` (App.jsx) / `lookupPair(o)` (extension)
Deux voies, toutes deux certaines, **et rien d'autre** :
1. **identifiant Vinted** (transaction → `item_id`) ;
2. **photo** — l'image appartient à une paire et une seule (**0 collision mesurée sur 261 annonces**) ; c'est le repli quand la transaction n'est pas encore captée.

**Le repli par TITRE est supprimé** de `resolvedEntry`, de l'auto-verrouillage `txnLink` (un verrou est permanent : il ne se pose plus jamais sur une ressemblance) et de l'auto-numérotation des ventes. Même règle copiée à l'identique dans l'extension (`enrichPairs`).

### Mesuré sur la vraie base — la preuve
| | ancienne règle (titre unique) | nouvelle (id Vinted + photo) |
|---|---|---|
| ventes résolues | 66 | **88** |
| **ventes où le titre désignait la MAUVAISE annonce** | **3** | 0 |
| désaccords entre les deux voies certaines | — | **0** (15 cas comparables) |

Les 3 erreurs réelles : « adidas spezial noir taille 34 » (titre → N°155), « adidas spezial vert taille 36 » (→ N°6), « adidas spezial noir taille 38,5 » (→ N°3) — dans les trois cas **Vinted rattache la vente à une AUTRE annonce**. C'est très exactement la mauvaise boîte au moment d'expédier (§19, risque n°1).
**61 ventes sur 277 (22 %) portent un titre en double** — dont deux « Nike zoom fly 5 noir et violet taille 41 » qui sont **deux annonces différentes**. Le titre ne caractérise donc pas une annonce.

⚠️ **8 ventes passent de « un numéro deviné » à « rien »** (photo absente ET transaction pas encore captée). C'est voulu : **mieux vaut un blanc qu'un faux** — un numéro faux ne se voit pas, il envoie la mauvaise chaussure.

### Le seul endroit où le titre reste, et pourquoi
Un article **DANS UN LOT** n'a que son titre (Vinted ne donne ni identifiant ni photo par article du lot). Le N° y est donc encore proposé, mais **en orange avec « titre ? à vérifier »** — jamais présenté comme certain.

### Égress (§34)
- App : `fetchTxnItemIds()` lit **deux entiers par ligne** (`select=tx:data->payload->transaction->>id,item:…->>item_id`), vérifié en direct sur la base — jamais `select=data`.
- Extension : `itemParTxn` est récolté **dans la boucle `txnEtat` qui lisait déjà ces lignes** → **0 requête et 0 octet supplémentaires**.

### Vérifié
`npm run build` OK · `node --check background.js` OK · smoke app 12 écrans sur les vraies données : **0 PAGEERROR** · vrai `buildPanelData` contre la vraie base : 22 annonces, 80 ventes, 5 colis — aucune régression · `scripts/audit-coherence.cjs` : **6 règles, 0 désaccord**. Extension **5.28.0**.

### 5.34 (suite) — ⚠️ LES VERROUS HÉRITÉS ÉTAIENT LE VRAI RESTE DE RISQUE

Julien : « il n'y a aucun risque de base, on est d'accord ? » — la bonne question, et la réponse honnête demandait une mesure.

Le correctif ci-dessus ne *lit* que des données (deux entiers par transaction) : aucun `DELETE`, aucun numéro touché, aucune écriture nouvelle. **Mais `vinted_txn_link` est un verrou PERMANENT, longtemps posé PAR TITRE, et il est consulté AVANT tout le reste** — donc un mauvais lien déjà en base aurait survécu au correctif.

**Mesuré en base (17 août) :**
```
verrous vinted_txn_link : 177  |  vérifiables contre l'id Vinted : 35  |  justes : 33  |  FAUX : 2
  « adidas spezial noir taille 34 » → verrou N°155, Vinted rattache une AUTRE annonce
  « adidas spezial noir taille 38 » → verrou N°27,  idem
numéros auto sur ventes : 3  |  en désaccord avec Vinted : 0
```

Deux corrections :
1. **Un verrou ne prime plus sur Vinted** : quand `txnItem[tx]` contredit `txnLink[tx]`, le verrou est ignoré.
2. **Il est RÉPARÉ en base, pas contourné** — l'auto-lock réécrit la ligne avec l'identifiant Vinted. Sans ça le mauvais lien resurgirait partout où il est lu (bordereau, facture, prix d'achat). L'effet ne saute plus une transaction déjà verrouillée : il la vérifie.

⚠️ **Ce qu'on ne peut PAS affirmer** : 142 des 177 verrous ne sont pas vérifiables aujourd'hui (leur transaction n'est pas encore captée). Ils se vérifieront et se répareront tout seuls au fur et à mesure que l'extension capte les transactions. Aucun n'est réputé juste par défaut.

Vérifié : `npm run build` OK · smoke app 12 écrans sur les vraies données, **0 PAGEERROR**.

### 5.34 (suite) — ⚠️ UN ARTICLE DE LOT PORTE SON IDENTIFIANT (j'avais écrit le contraire)

Julien : « dans un lot quand tu cliques, tu vois les deux articles ». **Il a raison, et le paragraphe ci-dessus était faux.**

J'avais écrit « un article dans un lot n'a que son titre (Vinted ne donne ni identifiant ni photo par article) » et livré un N° en orange « titre ? à vérifier ». **Mesuré en base : `transaction.order.items[]` porte `id, url, price, title, photos, size_title, status, is_closed` — 206 articles sur 206 ont leur `id`.** `fetchLotItems` le lisait déjà depuis toujours ; c'est l'affichage qui l'ignorait et repartait sur `entryByTitleLoose`.

- La modale de lot résout désormais chaque article par **son identifiant d'annonce**, sinon par sa photo, **jamais par titre**. Elle affiche aussi la **photo** et la **pointure** de chaque article (`fetchLotItems` les remonte).
- **`entryByTitleLoose` et `keyOfEntry` sont SUPPRIMÉS** : plus aucun appelant. Un helper de rapprochement par titre laissé dans le fichier est un piège pour la session suivante — un commentaire à leur place explique pourquoi il n'y en a plus.

### ⚠️ LA PHOTO CHANGE DE NOM QUAND ON REPUBLIE (et le dossier, non)
En cherchant pourquoi 4 articles du lot de 8 ne se résolvaient plus, le diagnostic a montré ceci :
```
article du lot : 05_02624_dfaznfhbbwgavj8tfkfe5ttc/1783338221
paire N°20     : 05_02624_dfaznfhbbwgavj8tfkfe5ttc/1785602038
```
**Même dossier, horodatage différent** : republier (supprimer + recréer, §46) **re-téléverse la même image**. `photoKey` inclut le nom de fichier, donc elle ratait ce cas.

⚠️ **Le dossier seul n'est PAS une identité** — mesuré sur 261 annonces : **17 collisions** (contre **0** pour la clé complète) et **4 dossiers portent DEUX numéros différents**. Il ne sert donc qu'en **dernier recours**, via `numerosByPhotoDir`, qui **écarte tout dossier ambigu** (même garde que `numerosByPhoto`). Ordre final de `entryKeyByPhoto` : fichier exact → dossier non ambigu → rien.

**Mesuré : ventes résolues 60 → 65 · articles de lot 4 → 6 · 4 dossiers ambigus refusés.**

Vérifié : `npm run build` OK · smoke app 12 écrans sur les vraies données, **0 PAGEERROR** · `audit-coherence` : 6 règles, 0 désaccord.

---

## 5.35 — Numéro dès la vente récente · ventes à l'heure · ⚠️ la cloche marchait (correction de mon diagnostic)

### 1. Le numéro manquait sur les ventes récentes — cause mesurée
La numérotation auto ne tourne que sur `annBase` = les annonces **encore en ligne**. Une paire vendue **avant** que l'app soit ouverte n'y passe jamais.

| ventes | sans N° | dont **numérotables** (annonce captée) |
|---|---|---|
| 7 derniers jours | 13 | **6** |
| 30 jours | 29 | **14** |
| plus de 90 j | 140 | 0 (annonce jamais captée) |

⚠️ Les 6 colis qui **attendent l'envoi** avaient tous leur numéro : le trou est sur les ventes déjà parties, pas sur celles qui comptent pour expédier.

➡️ `VENTE_NUM_MAX_J = 60` + `venteRecente(o)` (module-level) : l'auto-numérotation couvre désormais **les ventes qui attendent l'envoi OU vendues il y a moins de 60 jours**, identité certaine exigée (§5.34), annulées exclues, pool strict (`takenNums ∪ numsOccupes`, §5.33).
⚠️ **C'est la fenêtre qui protège** : sans elle on renumérote les 140 ventes de plus de 90 jours — exactement l'inflation de juillet (compteur 50 → 120).

### 2. Ventes et achats triés à l'HEURE
L'écran Ventes n'avait **aucun tri** : il suivait l'ordre de la moisson, donc plusieurs comptes mis bout à bout s'entremêlaient. `tsCommande` / `parDateDesc` / `heureCommande` (module-level) ; `.sort(parDateDesc)` sur Ventes ET Achats. Une date illisible part en bas plutôt que de remonter en tête.

### 3. ⚠️ CORRECTION DE MON PROPRE DIAGNOSTIC — le centre de notifications n'était PAS cassé
Plainte : « je n'ai plus les notifications dans l'app ». Ma première sonde de banc cherchait le badge par une expression régulière sur le HTML (`border-radius:999px`) → **elle ne matchait pas** (React rend `border-radius: 999px`, avec l'espace). J'ai conclu « la cloche est vide », et **c'était faux**.

**En OUVRANT réellement la cloche au banc** : « **3 ventes à expédier** » + « **37 messages non lus · sur julatace3535 (10)…** ». Le centre fonctionne.
➡️ C'est la 4ᵉ fois qu'un compteur de banc ment (§21, §25) : **ouvrir l'écran et lire le texte, jamais conclure sur une regex de HTML.**

**Ce qui reste vrai et a quand même été corrigé** — une VRAIE course dormait là :
`vintedNotifChecked.current = true` était posé **avant** le travail réseau, et coupait **deux choses distinctes** : le bandeau « nouveautés » (qui doit être unique) ET la cloche (qui est une liste de choses à faire, donc à recalculer). Si `vintedAccounts` changeait pendant le réseau — ça arrive à chaque rafraîchissement de compte — le nettoyage posait `cancelled`, la 1ʳᵉ passe sortait à `if(cancelled) return`, et la 2ᵉ sortait immédiatement sur le drapeau : **la cloche restait vide pour toujours**. Séparé en `dejaVu` (bandeau seulement) ; la cloche se recalcule.

⚠️ **Piège évité de justesse (§26, encore)** : j'avais mis `cloudReady` dans les dépendances — **cette variable n'existe pas** dans `App` (c'est `isCloudReady()`). `npm run build` passe, et le banc a affiché `ReferenceError: cloudReady is not defined` **avant** que ça parte en production. Dépendances remises à `[vintedAccounts]`.

### Vérifié
`npm run build` OK · smoke app 12 écrans sur les vraies données : **0 PAGEERROR** · cloche ouverte au banc : contenu conforme aux chiffres de la base (37 non lus, 3 à expédier).

---

## 5.36 — UN LOT DE BORDEREAUX, MAIS UN PAR UN (5.29.0)

Julien : « je veux que ça la récupère automatiquement quand j'appuie sur généré, et je veux pouvoir sélectionner plusieurs ventes pour générer des bordereaux ».

### Ce qui existait déjà (vérifié avant de coder, pas réécrit)
La récupération automatique **était faite** depuis §5.32 : `genererBord` génère, puis appelle `recupererLabel` et envoie le PDF dans l'app, et le bouton rend compte (« ✓ envoyé à l'app » / « ✓ généré » si le PDF n'est pas récupérable). Rien à refaire — c'est la sélection multiple qui manquait.

### La sélection : séquentielle, jamais en rafale
- Case à cocher sur chaque vente actionnable **du compte connecté uniquement** (les autres comptes restent floutés, §5.32 — agir depuis la session d'un autre compte est LE signal multi-comptes, §48). « tout cocher » + **« ▶ Traiter la sélection »**.
- La boucle **attend la réponse de Vinted avant d'envoyer la suivante**. Le service worker ne reçoit donc jamais un lot à lâcher d'un coup : un message = un bordereau, comme avant. C'est ce qui sépare une file séquentielle d'une rafale (§32/§43) — et ce n'est **pas** une temporisation déguisée : il n'y a aucun `setTimeout` entre deux, c'est le rythme du réseau.
- ⚠️ **Le vrai garde-fou reste le plafond de 20 actions/h par compte** (`garde`). Un refus (`code`) **arrête le lot** au lieu de s'acharner : les suivantes taperaient le même mur. Le motif exact s'affiche dans le bandeau d'alerte du panneau.
- Chaque ligne garde son propre bouton (un clic = un bordereau) ; la sélection ne fait que les enchaîner.
- `bordPick` (Set de n° de transaction) survit aux rendus : un `load()` en cours de route ne vide pas la sélection.

**Vérifié au banc panneau** (faux `chrome`, 4 ventes dont une sur un autre compte) : **3 cases** (la 4ᵉ vente, compte `222`, n'en a pas), « tout cocher » → 3, le lot envoie **3 messages espacés de 10-11 ms — donc bien l'un après l'autre** — avec la bonne action par ligne (`genererBord` sur « paiement validé », `recupBord` sur « Bordereau envoyé au vendeur »), et le refus simulé du garde-fou **arrête le lot** en affichant « 20 actions/h atteint ». **0 erreur page/console.**

⚠️ Piège de banc (le harnais mentait, encore — §21) : `load()` fait `DATA = resp`, pas `resp.data`. Mon stub renvoyait `{ok:true, data:DATA}` → `DATA.toShip` vide → **0 case rendue**, et j'aurais conclu que la fonctionnalité ne marchait pas. Et `.vrm-tab` n'est pas « visible » au sens Playwright : cliquer via `$eval(e=>e.click())`.

### Le reçu d'achat : retour à l'ancien modèle
Julien, deux fois : « je n'aime toujours pas ce modèle, je veux vraiment l'ancien, il était super ». Repris **tel quel** depuis `7256d7e^` (page 420×560, une colonne, étiquette grise puis valeur) plutôt que réécrit de mémoire. Trois ajouts seulement : le **N° de la paire** (les 3 boutons appelants passaient déjà `opts.numero`), la **virgule décimale** (document comptable français) et les **accents** (vérifié : ils passent en WinAnsi, §5.28).

**Vérifié à l'octet** (Playwright + la vraie fonction découpée du fichier, texte hex du flux décompressé) : 19 lignes imprimées, **aucune ne chevauche la suivante** (y strictement décroissants, écart ≥ 13), tous les champs présents, **le symbole € présent** (`0x80` WinAnsi — invisible en latin1, d'où la vérification en hexadécimal).
⚠️ Deux pièges du harnais : le découpage de la fonction gardait le `;` final → `return (…;)` = SyntaxError ; et pdf-lib écrit le texte en **hexadécimal dans un flux Flate** — chercher une chaîne dans le PDF brut ne trouve jamais rien. Il faut décompresser puis décoder `<hex> Tj`.

### 5.36 (suite) — L'ACHAT RELIÉ : sa photo et SON reçu, sur l'annonce ET sur la vente

Julien : « quand l'annonce est en ligne, pouvoir relier un achat à la vente, donc avec la photo de l'achat ainsi que sa facture d'achat générée par l'application… et je veux que ça fasse également ça dans les ventes, avec le numéro et l'achat qui correspond ».

Le sélecteur d'achat (§5.23) montrait déjà la photo **au moment de choisir**, puis tout disparaissait : il ne restait qu'un prix dans un champ. Rien ne disait *quel* achat était relié, et son reçu n'était atteignable que depuis l'onglet Achats.

- **`AchatRelie`** (composant unique, utilisé aux DEUX endroits — §11 : une seule définition, sinon les deux écrans finissent par ne plus dire la même chose) : vignette de l'achat, titre, « Acheté X € · date », et un bouton **📄 Reçu** qui génère le reçu d'achat **avec le N° de la paire**.
- **⚠️ Un INSTANTANÉ de l'achat est écrit sur la paire au moment du lien** (`buyFrom` : titre, date, photo, prix, vendeur, compte). Sans lui, réafficher le bloc obligerait à recharger les ~700 achats de tous les comptes à chaque ouverture de l'écran Annonces — exactement le trou d'égress de §34. La donnée est déjà sous la main au clic : 6 champs courts, écrits une fois, et le reçu reste générable hors ligne. `achatRelie(e)` préfère la commande vivante quand elle est déjà chargée (statut à jour), sinon l'instantané.
- Saisir un prix d'achat **à la main** efface le lien ET l'instantané (`buyFromId:null, buyFrom:null`) : sinon la carte affichait un achat qui n'avait plus rien à voir avec le chiffre saisi.
- Sur les ventes, l'entrée vient de `effEntry(o)` → identité certaine (id Vinted, sinon photo, §5.34) — **jamais un rapprochement par titre**.

**Vérifié au banc sur les vraies données** (fixture de banc : un achat relié à chaque paire numérotée, jamais écrite en base) : **25 blocs sur Annonces** (= les 25 annonces en ligne), **57 sur Ventes**, et le bouton 📄 télécharge un vrai PDF dont le contenu décompressé porte `N° de la paire | N°36` — le numéro de la paire vendue, pas celui de la transaction. **0 PAGEERROR** · smoke 12 écrans : **0 PAGEERROR, 0 artefact d'affichage**.

---

## 5.37 — ⚠️ CHRONOPOST : le « QR » affiché était un PIXEL DE TRACKING, et un code était le mot « suivant »

Julien va faire supprimer son compte Mondial Relay : **les emails deviennent sa seule façon de retirer un colis**. Donc plus aucune donnée fausse ne peut passer. Méthode habituelle : lire la base avant de coder.

### ⚠️ CORRECTION DE §17 ET §28 — Chronopost n'a JAMAIS envoyé un seul vrai QR capté
J'avais écrit « Chronopost : 11 vrais QR en image hébergée (`qrUrl`) ». **C'est faux.** Mesuré sur les 26 emails Chronopost réels, 21 portent une `qrUrl` et **aucune n'est un QR** :

| ce que contenait `qrUrl` | nombre |
|---|---|
| **pixel de tracking** (`tracking.network1.pickup.fr/tracking/1/open/…`) | 9 |
| **illustration marketing** (`avn-webexternal.azureedge.net/avn-prod/FRA_DROPOFF_PICKUP_PARCEL`) | 11 |
| bannière enquête de satisfaction | 1 |

Devant la consigne, l'app affichait donc **une image invisible ou un dessin publicitaire** à la place du Pickup Pass.

**CAUSE, dans `extractPickupQr` étape 3** : le contexte testé pour les mots-clés incluait **l'URL elle-même** (`ctx = html_avant + ' ' + url`). Or `pickup` est dans *toutes* les URL Pickup — mouchard compris. La première image de l'email gagnait, et la fonction s'arrêtait là : **le vrai QR, plus bas dans l'email, n'était jamais atteint.**

### Les trois règles posées
1. **`URL_PAS_UN_QR`** — liste noire (`/tracking/`, `/open/`, `pixel`, `banner`, `avn-prod`, `azureedge`, `drop_off`, `enquete`, réseaux sociaux…) **+ rejet des `<img>` de 1×4 px** (`width`/`height` ≤ 4).
2. **Le mot-clé doit venir du HTML AUTOUR de l'image, jamais de l'URL** (`INDICE_QR_FORT` : `qr`, `pickup pass`, `à scanner`, `code-barre`, `présentez ce code`). « pickup » seul ne suffit plus.
3. **⚠️ UN CODE DE RETRAIT EST NUMÉRIQUE.** L'ancien motif acceptait des lettres (`[A-Z0-9]{4,8}`) : sur un vrai email il a capté le mot **« suivant »** et l'affichait en gros comme code à donner au comptoir (ligne `email_track_chronopost_XW476115185SP`, toujours en base). Désormais `\d{4,10}` uniquement.

### ⚠️ LE FILTRE VIT AUSSI À LA LECTURE (le point qui compte)
Les 21 fausses `qrUrl` et le code « suivant » **sont déjà en base et ne seront jamais réécrits** — l'email ne repassera pas. Un correctif uniquement dans `api/email-inbound.js` n'aurait donc rien changé à ce que Julien voit. `src/App.jsx` porte la **même liste noire** (`URL_PAS_UN_QR` → `qrImage(t)`) et la **même règle de code** (`codeRetrait`).
➡️ **Mesuré : sur les 25 `qrUrl` en base, 25 sont écartées** — plus une seule fausse image affichable.

`codeRetrait` remplace **trois copies** de la même règle qui traînaient (`okCode` local, un `/^\d{3,8}$/` en dur dans `isColisRetirable`, et le test de `retraitMode`) — le doublon que §11 interdit.

### Ce que l'email Chronopost Pickup donne vraiment (relevé sur les captures de Julien)
Numéro de colis · transporteur · statut · **à retirer jusqu'au vendredi 21 août 2026** · nom + adresse de la consigne · le QR « Pickup Pass » · **Identifiant : 8156** ET **Code d'ouverture : 9539**.

- **DATE LIMITE (`limite`)** — captée (« jusqu'au 21 août 2026 », « jusqu'au 21/08/2026 »), **jamais déduite**. Affichée sur la carte du colis ET dans la modale, en rouge à ≤ 2 jours : passé la date, le colis repart chez l'expéditeur et rien ne le disait.
- **CONSIGNE ≠ COMPTOIR (`consigne`)** — au casier on **saisit l'identifiant puis le code d'ouverture** ; il n'y a pas de comptoir. Le texte de la carte et de la modale suit.
- ⚠️ **LES DEUX NOMBRES SONT AFFICHÉS.** Ma première version ne montrait que le code d'ouverture — **avec lui seul la porte ne s'ouvre pas**. Défaut vu au rendu réel, pas à la relecture.
- Le **lieu** se lit désormais **ligne par ligne** sur le texte : sur `all` (sujet + HTML), « Votre colis est arrivé en consigne Pickup » gagnait et le lieu devenait une phrase. Nom court (une enseigne) + lignes d'adresse suivantes.

### Vérifié
Banc unitaire sur les **vraies fonctions découpées du fichier**, avec l'email de Julien reconstruit d'après ses captures — **9/9** : le vrai QR (`/pass/…png`) est retenu, le pixel et la bannière écartés, code d'ouverture 9539, identifiant 8156, limite `2026-08-21`, consigne `true`, lieu « Consigne Pickup Super U Cancale, RUE DE LA BRETONNIERE, 35260 CANCALE », et le mot « suivant » n'est plus un code.
**Non-régression Mondial Relay — 5/5** : code 077831, lieu « MAISON DE LA PRESSE, 40 RUE DU PORT, 35260 CANCALE », date limite 25/08, `consigne:false`, **aucun QR fabriqué** (§17 tient toujours : MR fonctionne au CODE).
Rendu réel (banc §20, vraies données + les deux colis en fixture) : Mondial Relay → « Donne ce code au comptoir » + CODE 077831 + « à retirer avant le 25/08 · 8 j » ; Chronopost → « Saisis ces nombres sur le casier » + IDENTIFIANT 8156 + CODE D'OUVERTURE 9539 + « à retirer avant le 20/08 · 3 j ». **0 image QR affichée, 0 PAGEERROR.**
Smoke 12 écrans : **0 PAGEERROR** · `audit-coherence` : **6 règles, 0 désaccord**.

### ⚠️ Ce que je ne peux PAS réparer, dit franchement
Le **corps brut des emails n'est pas conservé** en base : les 94 lignes existantes ne peuvent pas être re-parsées. Elles n'auront donc jamais leur date limite ni leur identifiant — seuls les **prochains** emails les auront. Ce qui est réparé pour l'existant, c'est l'affichage : plus aucune fausse image ni faux code.

### 5.37 (suite) — ⚠️ 5 COLIS À RETIRER ÉTAIENT CLASSÉS « LIVRÉS » (le défaut inverse de celui signalé)

Demande de Julien : « dès que tu reçois le mail comme quoi le colis a été retiré, tu peux supprimer l'achat en attente ; sinon tu attends de capter ça dans l'extension ». Mesure d'abord : **le défaut trouvé est l'inverse, et plus grave.**

| statut en base | lignes |
|---|---|
| transit | 54 · available **15** · delivered **18** · info 7 |

Parmi les 18 `delivered` : **5 emails Mondial Relay dont le SUJET dit « Votre colis 60385202 est DISPONIBLE »**. Ces 5 colis à retirer n'apparaissaient donc nulle part — et au bout de 14 jours (`PICKUP_MAX_DAYS`) un point relais rend le colis à l'expéditeur. Rater un colis coûte plus cher qu'en afficher un de trop.

**CAUSE** : le classement lisait **tout le texte** (`all` = sujet + corps). Or le corps d'un email « disponible » contient les consignes de retrait (« venez récupérer votre colis », « à retirer avec ce code »…), qui font matcher les motifs de « déjà retiré ».
➡️ **LE SUJET TRANCHE AVANT LE CORPS** (`SUJ_RETIRE` / `SUJ_DISPO`) : c'est lui qui porte l'état COURANT, c'est pour ça que le transporteur l'écrit. Le corps ne sert plus que de repli quand le sujet ne dit rien.

**Rejoué sur les 94 sujets réels : 31 sujets tranchent, 6 classements corrigés — 6 colis redeviennent « à retirer », 0 régression.** Les 10 « Votre colis a été retiré » Chronopost restent bien `delivered` (le bug de §5.37 précédent ne revient pas).

### Un colis retiré s'éteint sur TOUTES ses lignes
Mesuré : **3 n° de suivi existent en double** (`email_track_vinted_04103186091937` ET `email_track_chronopost_04103186091937`) — le transporteur et Vinted envoient chacun leur email, donc deux lignes pour un seul colis. Si l'une passe « retiré » et l'autre reste « disponible », le colis restait affiché : Julien serait allé au relais pour rien.
`suivisRetires(tracking)` + `colisRetireAilleurs(t, retires)` : **le n° de suivi est une identité, pas une ressemblance** (§24) — aucun risque de devinette. Appliqué à `pickupUnion` ET au compteur de notifications (sinon deux chiffres pour la même chose, §11).

**Vérifié au banc, dans les deux sens** (fixture : un colis « disponible » dont l'email de retrait est arrivé sur une autre ligne) : **sans le correctif → 5 colis à retirer dont un déjà récupéré ; avec → 4, le bon écarté.** 0 PAGEERROR.

### ⚠️ Ce que je ne fais PAS, et pourquoi
Julien demande de « supprimer l'achat en attente » quand le colis est retiré. **Il n'existe aujourd'hui aucun lien certain entre un email de suivi et un achat Vinted** : vérifié sur les 431 achats moissonnés, les champs sont `date, photo, price, title, status, transaction_id, conversation_id, transaction_user_status` — **aucun n° de suivi**. Et le `shipment` du détail de transaction ne porte que `{id, status, status_title, status_updated_at}` (§16, reconfirmé). Le seul rapprochement possible serait **par titre**, précisément ce que §24 interdit : marquer « reçue » une paire qui ne l'est pas est pire que de la laisser en attente.
➡️ L'achat bascule donc sur le **statut Vinted** capté par l'extension (« Commande livrée ! ») — le seul lien certain, et il se met à jour tout seul. Pour rendre ça automatique depuis l'email il faudrait capter un n° de suivi côté Vinted (piste : `harvest_*_ship_*`, §5.27 — **0 ligne en base à ce jour**).

### ⚠️ Le correctif ne répare pas les 5 lignes déjà en base
Elles gardent leur statut `delivered` (l'email ne repassera pas, et le corps brut n'est pas conservé). Elles datent du 28/07 au 06/08 : au-delà des 14 jours, elles seraient de toute façon écartées. **La protection vaut pour les prochains colis.**

### 5.37 (suite) — « J'ai retiré mes colis, ils sont encore là » : GRISÉ, PAS DISPARU

Julien : « j'ai reçu les deux colis, je suis allé les retirer, ils sont encore dans l'application… est-ce que ça peut être fait en automatique ? Ça peut peut-être griser en attendant que l'extension vérifie par elle-même ».

### ⚠️ Ce n'est PAS un retard de l'extension — mesuré avant de coder
| paire | statut Vinted | fraîcheur de la capture |
|---|---|---|
| Salomon XT-6 | « La livraison n'a pas encore eu lieu — colis déposé en point relais » | **2 h** |
| Adidas 37,5 | idem | 18 h |

**Vinted lui-même dit encore « déposé », sur une capture vieille de 2 heures.** L'automatique existe déjà et fonctionne (`isAtRelayStatus` cesse de compter dès « Commande livrée ! ») — ce qui traîne, c'est le relais qui remonte le retrait à Vinted, pas la capture. On ne peut pas aller plus vite sans une autre source, et il n'y en a pas (l'email de retrait n'est rattachable à aucun achat, §5.37 précédent).

### Sa proposition était la bonne
Cocher ✓ faisait **disparaître** la ligne d'un coup. Désormais elle reste **en gris**, barrée, avec « Tu l'as coché récupéré · Vinted dit encore "déposé" — ça se règle tout seul » et un bouton **↺ Remettre**.
- Elle **ne compte jamais** dans le total (le compteur reste juste).
- Elle **sort toute seule** dès que Vinted enregistre le retrait — c'est l'extension qui confirme, exactement ce qu'il demandait.
- `PICKUP_CONFIRM_DAYS = 7` : au-delà on n'attend plus, sinon un statut Vinted qui ne bouge jamais encombrerait la liste pour toujours.

**Vérifié au banc** (les 3 vraies transactions « déposées » cochées comme récupérées) : le compteur passe de 4 à **2 colis à retirer**, et le bloc gris affiche « ✓ 2 retirés — Vinted n'a pas encore enregistré » avec les deux vraies paires et leur bouton ↺. Smoke 12 écrans **0 PAGEERROR**, banc email 15/15, cohérence 6 règles / 0 désaccord.

---

## 5.38 — LE PRIX D'ACHAT : la couleur et la pointure tranchent (3 suggestions fausses sur 9)

État relevé du jour : **24 annonces en ligne, 24 avec un N°, 0 avec un prix d'achat** (198 entrées numérotées, **0 prix**, miroir `vinted_buyprice_by_num` vide). Le bénéfice, la marge, la « meilleure marque » et le rapport comptable tournent donc toujours avec un coût nul.

⚠️ En mesurant les candidats proposés par `openPicker` (§5.23) sur les vraies données, le vrai défaut n'était pas le nombre de suggestions mais **leur justesse** :

| paire en ligne | candidat « suggéré » proposé | verdict |
|---|---|---|
| adidas spezial **noir** taille 38 | Adidas Spezial **blu** n. 38 | ❌ couleur |
| adidas spezial gris **taille 38** | Adidas spezial **maat 41** grijs | ❌ pointure |
| adidas spezial gris **taille 39,5** | Adidas spezial **maat 41** grijs | ❌ pointure |
| adidas spezial gris **taille 36,5** | Adidas spezial **maat 41** grijs | ❌ pointure |

Marque + modèle suffisaient à franchir le seuil de 12 : **ni la couleur ni une pointure DIFFÉRENTE ne pesaient**. Un prix d'achat faux ne se voit jamais — il produit une marge crédible, pour toujours.

### Deux règles ajoutées à `openPicker`
1. **`extractColor(text)`** (module-level, à côté de `extractBrand`/`extractSize`/`extractModel`) : 12 couleurs × 6 langues (fr/en/it/es/de/nl — ses achats viennent de toute l'Europe). Même couleur **+4**, couleurs reconnues mais **différentes −8**. ⚠️ Deux couleurs dans un titre (bicolore) ⟹ `null` : on ne se prononce pas plutôt que de trancher.
2. **Pointure différente −10** — le signal le PLUS discriminant, et il ne pénalisait rien. Une pointure différente, ce n'est pas la même paire.

### Mesuré sur les 24 annonces en ligne et 315 achats
| | avant | après |
|---|---|---|
| paires avec un candidat « suggéré » | 9 | **7** |
| dont **fausses** (couleur ou pointure incompatible) | **4** | **0** |

Les 7 restantes sont toutes cohérentes : « spezial noir 38 » → « Adidas Spezial **schwarz** », « spezial gris 39,5 » → « Adidas spezial **39.5** », « zoom fly 5 orange 41 » → « zoom fly 5 **maat 41 oranje** » (score 18, le plus fort). **Moins de suggestions, mais plus une seule fausse** — c'est le sens de « mieux vaut un blanc qu'un faux ».

⚠️ Il reste un cas non traité, et il est sans danger : deux annonces en ligne au titre identique (« adidas spezial noir taille 35,5 », N°134 et N°156) se voient proposer le MÊME achat. `linkedBuyIds` empêche déjà de relier deux fois le même achat, donc pas de double comptage — seul le badge est optimiste.

⚠️ Le banc (`prix.mjs`) utilise les **vraies** `extractBrand`/`extractSize`/`extractModel`/`extractColor` découpées du fichier, mais **recopie les poids** du score (qui vit dans `openPicker`, à l'intérieur d'un composant). Si les poids changent d'un côté, les remettre des deux.

**Vérifié** : `npm run build` OK · smoke app 12 écrans sur les vraies données **0 PAGEERROR** · banc email 15/15 · bancs colis (grisé + retrait ailleurs) conformes · `audit-coherence` 6 règles, 0 désaccord.

---

## 5.39 — ⚠️ « MÊME AVEC 50 ARTICLES IDENTIQUES, TU NE DOIS PAS POUVOIR TE TROMPER »

Exigence de Julien, et elle change la règle : **tout rapprochement par ressemblance est disqualifié par principe**, pas seulement quand il donne un mauvais résultat aujourd'hui. Seules les identités comptent : identifiant d'annonce Vinted, n° de transaction, n° de suivi, photo.

Audit systématique de tous les `normTitle(` du fichier. Quatre défauts trouvés, tous corrigés :

### 1. Deux helpers dormants qui rendaient « la première paire au même titre »
`entryByTitle` / `entryKeyByTitle` : **plus aucun appelant**, mais laissés dans le fichier. C'est exactement le piège de `entryByTitleLoose` (§5.34) — la session suivante les rebranche. **Supprimés**, avec un commentaire à leur place.

### 2. ⚠️ COLIS ↔ ACHAT : le code de retrait d'un AUTRE colis pouvait s'afficher
`buyForTrack` / `trackForBuy` prenaient **le premier** titre égal, et retombaient même sur un `.includes()`. Avec plusieurs paires au même libellé, elles désignaient une paire **au hasard** — visible à l'écran : la photo d'une autre paire, ou l'étape de suivi (« au relais », avec SON code) posée sur le mauvais achat.
➡️ Règle : **titre exactement égal ET un seul candidat des deux côtés, sinon rien**. Le `.includes()` est supprimé — ce n'est pas une identité. Helper `unique(liste, clé, valeur)`.

### 3. La reprise de numéro après republication s'appuyait sur le titre
`numeroReprises` exigeait déjà un candidat unique (elle résistait donc au scénario des 50), mais tranchait par titre + pointure. Or republier **re-téléverse la même image dans le même dossier** (§5.34) : c'est une identité. `photoDir` passe désormais **avant** le titre — deux dossiers connus et différents ⟹ ce n'est pas la même paire, quel que soit le libellé.

### 4. La photo de la modale de retrait
`openQrView` prenait le premier achat au même titre. Montrer la chaussure d'une autre paire à côté d'un code de retrait est pire que de n'en montrer aucune → **un seul candidat, ou pas de photo**.

### ✅ `scripts/audit-identite.cjs` — le scénario des 50, en test permanent
Le script pose **50 paires rigoureusement identiques** (même titre, taille, couleur, description) et vérifie qu'aucune règle n'en désigne une. Il contrôle aussi le **cas inverse** : avec un seul exemplaire, le rapprochement doit encore fonctionner — un garde-fou qui bloque tout serait pire que le défaut.

⚠️ **Le test a été validé dans les deux sens** (§21 : un test qui passe toujours ne prouve rien) : rejoué sur le code d'avant les correctifs, il sort **4 échecs** ; après, **8 contrôles au vert**. À relancer après toute modification d'une règle qui relie deux choses.

### Relier les achats entre TOUS les comptes — déjà en place, vérifié
`openPicker` boucle sur `accounts` (= tous les comptes captés) **sans filtre `acctOff`** : un achat fait sur le compte A peut donc être relié à une annonce du compte B, comptes masqués compris, et chaque candidat porte son étiquette de compte (`AcctTag`). Rien à changer.

**Vérifié** : `npm run build` OK · `audit-identite` 8/8 · smoke app 12 écrans **0 PAGEERROR** · bancs colis (grisé, retrait ailleurs, faux QR, faux code) conformes · `audit-coherence` **6 règles, 0 désaccord**.

### 5.39 (suite) — LE BORDEREAU TRANSPORTE L'IDENTITÉ DE L'ANNONCE (extension 5.30.0)

Julien : « par annonce, comme ça au moins t'es sûr de ne jamais te tromper… et après on envoie le bordereau et t'envoies directement l'identité de l'annonce, comme ça l'application ne se trompe plus. »

C'est la bonne architecture, et elle est **gratuite** : `recupererLabel` charge déjà `GET /api/v2/transactions/{tx}` pour trouver l'expédition — `transaction.item_id` y est donc sous la main, sans une requête de plus.

- **Extension** : la ligne `harvest_{uid}_label_{tx}` porte désormais **`item`** (l'identifiant d'annonce Vinted) et **`items`** (tous les articles quand c'est un lot — un bordereau de lot couvre plusieurs paires, on ne veut pas en désigner une au hasard).
- **App** : `fetchCapturedLabelMetas` remonte `item` (scalaire — les octets du PDF ne partent toujours qu'à l'impression, §34), et **`numFromLabelItem` passe AVANT tout le reste** dans `numForBord` : `vinted_annonce_numeros` étant indexé par id d'annonce, la lecture est directe. Plus de chaîne bordereau → transaction → vente → annonce.
- `numLitige` compare l'email au plus sûr des deux chemins certains (identité d'annonce si elle est là, sinon transaction).

**Pourquoi ça ferme définitivement le sujet** : deux articles rigoureusement identiques ont **deux identifiants différents**. Le titre, la couleur, la taille et la description ne rentrent plus jamais dans la décision.

**Vérifié de bout en bout, au rendu réel** (banc dédié : deux annonces au même titre / même taille / même couleur, N°7 et N°99 ; Vinted désigne la seconde) : l'écran tamponne **N°99**, et **N°7 n'apparaît nulle part**. 0 PAGEERROR.

### 5.39 (suite) — AUDIT DEMANDÉ : « aucun risque de se tromper d'annonce ? »

Julien : « vérifie bien, il n'y a bien aucun risque que l'application se trompe sur une annonce, que ce soit sur un litige, sur une vente, sur une mise en ligne, sur une annulation de commande ». Traité comme un audit, pas comme une affirmation — et transformé en **contrôles permanents** (`scripts/audit-identite.cjs`, 14 contrôles).

| chemin | d'où vient l'identité | verdict |
|---|---|---|
| **vente** | `effEntry` → `resolvedEntry` → `identiteAnnonce` = id d'annonce Vinted, sinon photo | identité |
| **litige / annulation** | même porte (`effEntry`) — vérifié : `saleOutcome` n'identifie rien lui-même | identité |
| **mise en ligne** | `updatePair` écrit dans `vinted_annonce_numeros[item.id]` | identité (par construction) |
| **bordereau** | `item` joint par l'extension, sinon transaction | identité |
| **auto-retrait d'une annonce d'après un EMAIL de vente** | titre + taille | ⚠️ **seul chemin sans identité** |

### Un dernier rapprochement par titre retiré
L'audit du stock (« paires numérotées qui ne sont plus en ligne ») écartait une paire dès qu'une **vente portait le même titre** — donc une seule vente masquait TOUTES les paires au même libellé, et une paire réellement perdue passait inaperçue. Le numéro, juste au-dessus, est une identité et suffit. Le nouveau contrôle **détecte bien ce défaut sur le code d'avant** (1 échec) et passe après.

### ⚠️ Ce qui reste sans identité, dit franchement
Un **email de vente ne porte pas d'identifiant d'annonce** — il n'y a que le titre et la taille. `emailSoldIds` retire donc une annonce en ligne sur cette base, avec trois garde-fous : clé titre+taille portée par plusieurs paires ⟹ **on ne retire rien** ; il faut **autant de ventes que d'annonces** du groupe ; une annonce renumérotée après la vente (paire republiée) est épargnée.

**Mesuré sur les données du jour** : 2 titres portés par 2 annonces en ligne chacun (« adidas spezial gris taille 38 », « adidas spezial noir taille 35,5 ») et **6 clés titre+taille ambiguës** parmi les paires numérotées (dont « spezial noir 35,5 » ×6 et « p-6000 argenté 37,5 » ×4). Sur ces 6 groupes, **l'auto-retrait est désactivé** : aucune paire ne peut être masquée à tort.
➡️ La contrepartie assumée : sur ces groupes, une paire vendue reste affichée « en ligne » jusqu'à ce que la moisson Vinted la ferme. **Afficher une paire de trop plutôt que masquer une paire encore en stock.**

### 5.39 (suite) — ⚠️ VINTED NE SUPPRIME PAS UNE ANNONCE VENDUE, il la ferme en « sold »

Julien : « en fait, Vinted ne supprime pas l'annonce, elle la met simplement dans la catégorie vendue ». **Il a raison, et ça ferme le dernier trou** — celui que la section précédente laissait ouvert (l'auto-retrait par email, seul chemin sans identité).

**Vérifié en base** : 261 articles captés, **235 fermés** (`is_closed`), et le champ qui dit POURQUOI existe :
```
id 9413157752  is_closed true   item_closing_action = 'sold'    (vendue)
id 9421527393  is_closed false  item_closing_action = null      (en ligne)
```

⚠️ **Mais l'allègement le JETAIT.** `CHAMPS_ARTICLE` (§23) ne gardait pas `item_closing_action` : l'information arrivait de Vinted et était supprimée à l'écriture — d'où sa présence sur **3 articles seulement** (captés avant l'allègement). Sans elle, `is_closed` mélange « vendue » et « retirée par moi », deux choses différentes pour la compta comme pour le taux d'écoulement.

- **Extension (5.31.0)** : `item_closing_action` et `is_reserved` sont conservés. Quelques octets par article.
- **App** : `venduChezVinted(it)` = `is_closed && item_closing_action ~ 'sold'`. `fetchVintedListings` remonte `soldIds` — **calculé sur des données déjà en mémoire, 0 requête et 0 octet de plus**. `loadListings` les range dans `venduesVinted`.
- **L'audit du stock** écarte désormais une paire vendue **par son identifiant**, en remplacement du test par titre retiré juste avant. La boucle est fermée : ce n'est plus une ressemblance, c'est Vinted qui désigne l'annonce.
- ⚠️ `etatConnuChezVinted(it)` distingue « Vinted n'a rien dit » de « Vinted dit non » : sur une annonce captée avant la 5.31 le champ est absent, et **on ne conclut rien** plutôt que de deviner.

**Honnêteté** : le champ n'existe aujourd'hui que sur 1 des 235 articles fermés. L'effet est donc nul tant que l'extension n'a pas recapté le dressing — il grandit à chaque visite sur Vinted. `audit-identite.cjs` passe à **16 contrôles**.

**Vérifié** : smoke app 12 écrans **0 PAGEERROR** · banc bordereau (deux annonces identiques → N°99, jamais N°7) · bancs colis conformes · `audit-coherence` 6 règles / 0 désaccord · `node --check` OK.

---

## 5.40 — ⚠️ RÈGLE INVERSÉE : UN NUMÉRO N'EST JAMAIS RÉATTRIBUÉ (§7 est annulé)

Julien : « il faut que les chaussures vendues gardent quand même leur numéro pour ne pas qu'il y ait d'erreur. C'est normal si ça monte à 124, ça veut dire qu'il y en a eu 100 autres avant. Si je me prends un retour en litige, je pourrai attribuer le numéro à la paire de chaussures. »

⚠️ **Ceci ANNULE la règle de §7** (« un numéro = une place au garage, il retourne dans le pool quand la paire part »), posée après sa plainte « pourquoi N°156 alors que j'ai à peine 50 paires ». Il tranche dans l'autre sens, et **il a raison** : la libération est une source de COLLISION.

### Ce que la vraie base disait
| | |
|---|---|
| paires numérotées | 198 · **176 numéros distincts** |
| **numéros portés par PLUSIEURS paires** | **13** — le N°4 par **quatre** (spezial noir 35,5 / zoom fly blanc rose / spezial kaki 38,5 / 3 manuels ST2S), les N°1, 2, 3, 8, 11 par trois ou quatre |
| `vinted_used_numeros` (mémoire) | 249 entrées, **aucun trou entre 1 et 249** |

Si l'une de ces paires revient en litige, **plus personne ne sait laquelle porte le N°4**. C'est exactement l'erreur qu'on cherche à rendre impossible.

### Le correctif
- **`freedNums` est SUPPRIMÉ.** C'est lui qui rendait au pot le numéro d'une paire partie.
- **Deux endroits retiraient encore des entrées de `vinted_used_numeros`** (`applyReprise` et l'effet d'auto-reprise, via `.filter(...)`) : supprimés. Le raisonnement d'origine (« ce numéro auto n'a jamais été écrit sur une boîte ») est vrai mais ouvre la porte à la réattribution. Un numéro brûlé ne coûte rien ; une collision, si.
- Le **« nettoyage v1 »** (qui reconstruisait `vinted_used_numeros` en jetant les numéros « fantômes ») est **désactivé** : il remettait des numéros en circulation.

### ⚠️ MESURÉ AU BANC — le défaut était visible, pas théorique
Avant : le champ N° proposait **134** comme prochain numéro… alors que le N°134 est **porté par une paire**. Cause : l'effet d'auto-reprise avait retiré 134 de la mémoire (`used134: false` dans le localStorage). Après correctif : `used134: true`, prochain numéro **341** au banc.
**Sur la vraie base, la règle donne 250** (vérifié en exécutant le vrai `takenNums` découpé du fichier : 249 numéros pris, aucun trou). L'ancienne règle aurait rendu **198 numéros au pot → prochain = 1**, donc collision garantie.

⚠️ Ne pas « corriger » la montée du compteur : elle est VOULUE. 250 ne veut pas dire 250 paires en stock, ça veut dire 249 paires passées. Ne pas remettre en avant « Renuméroter à la suite » (§19) : ça réattribuerait des numéros.

`audit-identite.cjs` passe à **18 contrôles**, dont deux nouveaux qui **détectent bien le défaut sur le code d'avant** : « aucun numéro n'est rendu au pot » et « la mémoire des numéros ne perd jamais d'entrée ».

**Vérifié** : smoke app 12 écrans **0 PAGEERROR** · banc bordereau (deux annonces identiques → N°99) · `audit-coherence` 6 règles / 0 désaccord.

### 5.40 (suite) — LE DÉTECTEUR DE DOUBLONS ÉTAIT AVEUGLE SUR LA MOITIÉ DU STOCK

Une fois la réattribution supprimée, restait à traiter les collisions **déjà en base**. Mesuré :

| | |
|---|---|
| numéros portés par plusieurs entrées | **13** |
| dont **deux paires PRÉSENTES** (donc dangereux aujourd'hui) | **1 — le N°4** |

Le N°4 est porté par **deux annonces actuellement en ligne** : « adidas spezial noir taille 35,5 » et « 3 manuels première ST2S » (compte `llloollllaa`). Si l'une se vend, le bordereau est tamponné N°4 et **la mauvaise chose part dans le carton**.

⚠️ **Et le détecteur ne le voyait pas** : `numDoublons` bouclait sur `annBase`, qui écarte les comptes masqués et les paires données pour vendues. Or masquer un compte cache sa comptabilité — **ça ne sort pas le carton de l'étagère** (§5.33). Il boucle désormais sur `listings.items` : **toutes les annonces réellement en ligne, tous comptes confondus**. Chaque ligne porte son étiquette de compte, pour savoir où chercher.
La réattribution appelle maintenant `recordUsed(libre)` : le numéro neuf est brûlé à vie, comme les autres.

### ⚠️ Un panneau contredisait la nouvelle règle — retiré
L'écran Annonces affichait « **Tes numéros montent jusqu'à 178 pour 22 paires — 156 numéros sont libres entre les deux** » avec un bouton « 🔢 Voir la renumérotation ». Deux affirmations devenues fausses et dangereuses : ces numéros ne sont **pas** libres (ils sont pris à vie), et renuméroter les **réattribuerait** — précisément ce qui empêche une paire revenue en litige de retrouver le sien. Supprimé, ainsi que le signalement « trous ≥ 15 » qui le comptait. « Renuméroter à la suite » reste dans ⋯ Outils pour un cas exceptionnel, mais **n'est plus jamais suggéré**.

**Vérifié au rendu réel** : le bandeau 🚨 affiche « 1 numéro porté par deux annonces », les deux paires avec leur compte, et le bouton « → N°339 » (250 sur la vraie base). Le panneau « numéros trop hauts » a disparu. Smoke 12 écrans **0 PAGEERROR** · `audit-identite` 18/18 · `audit-coherence` 6/0.

### 5.40 (suite) — VENTES & ACHATS : une info affichée deux fois, un conseil faux, deux écrans jumeaux mal alignés

Julien : « les onglets ne sont pas forcément assez intuitifs, fais quelque chose de très professionnel ». Méthode : **relever ce qui s'affiche, dans l'ordre**, plutôt que de juger à l'œil.

**1. La même information deux fois sur le même écran (Ventes).** La grande carte « ARGENT EN ATTENTE (ESTIMATION) ≈ 807 € · 25 ventes en cours », puis dix lignes plus bas la StatBox « 💰 En attente · 807 € · 25 en cours · estimation ». La StatBox est retirée : la carte porte déjà le montant, le détail par compte et l'avertissement d'incomplétude (§11 — une seule notion, un seul endroit).

**2. Un conseil FAUX était revenu.** « Ouvre une fois ton porte-monnaie sur Vinted » — invalidé depuis la 5.20 (§5.27 : la lecture du solde est automatique). Remplacé.
⚠️ En le corrigeant j'ai créé un **nouveau doublon** (le texte d'estimation répétait la marche à suivre déjà donnée par l'avertissement juste en dessous) — vu au relevé, corrigé dans la foulée.

**3. Deux écrans jumeaux organisés différemment.** Sur **Ventes**, la barre d'outils (période, filtres, recherche) est en 1re position sous le titre. Sur **Achats**, elle arrivait en **19e**, après les cartes. C'est ça qui rend la navigation hésitante. Achats suit désormais le même ordre : **titre → outils → cartes → liste**.

**Vérifié au relevé, dans l'ordre** : Ventes n'affiche plus qu'une fois l'argent en attente ; Achats commence par ses filtres + période (2e à 11e position) puis les colis. Smoke 12 écrans **0 PAGEERROR** · `audit-identite` 18/18 · `audit-coherence` 6/0.

---

## 5.41 — LES NOTIFICATIONS : « des fois je reçois des choses complètement débiles »

Julien : « remets les notifications et améliore les notifications ». Mesure avant de coder.

### Le canal marche — ce n'est pas ça, le problème
`push_subs` est une **ligne dans `app_data`**, pas une table (`/rest/v1/push_subs` → PGRST205 : ce piège m'a fait conclure une fois « aucun abonné »). Relevé : **2 appareils abonnés** (FCM + Apple), mis à jour le 22 août 06:33. Les notifications partent donc bien.

### Le vrai défaut : un push à CHAQUE étape de colis
Sur ses **94 emails de suivi** en base :
| statut | lignes | ça appelle une action ? |
|---|---|---|
| **transit** | **54** | non |
| available | 15 | **oui** — c'est là qu'est le code de retrait |
| delivered | 18 | non |
| **info** | **7** | non |

➡️ **61 des 94 notifications de colis ne demandaient rien.** Même chose pour « 🛍 Achat confirmé » (il vient de cliquer sur Acheter), les favoris et chaque message.

### La règle : on ne sonne que pour de l'ARGENT ou une ACTION
`PUSH_DEFAUT` + **`pushCategorieActive(cat)`** vivent dans **`api/_lib/push.js`** — une seule définition (§11), importée par `api/email-inbound.js` ET `api/ship-reminders.js` ; deux copies finiraient par ne pas notifier la même chose.

| catégorie | par défaut | pourquoi |
|---|---|---|
| 💸 vente · 💰 argent · 📦 colis à retirer · 📮 à poster · 🏷 offre | **ON** | argent, ou un geste à faire |
| 🚚 suivi · 🛍 achat · 💬 message · ❤️ favori · 🧾 facture | **OFF** | le badge de l'app suffit |

Chaque `pushOnce` porte sa catégorie (2ᵉ argument, ou champ `_cat`) ; les colis prennent `available → 'colis'`, tout le reste `'suivi'`. ⚠️ `_cat` est **retiré du payload** avant l'envoi — c'est un marqueur interne, il n'a rien à faire dans la notification.

### Le vendeur peut tout rouvrir
**Réglages → Notifications** (`PushPrefsSetting`, sous l'interrupteur push existant) : les 10 catégories, une ligne chacune, avec ce que ça déclenche. Écrit dans la ligne **`push_prefs`** via `sbAuth()` / `withOwner()` / `SB_CONFLICT` — donc déjà prête pour le cloisonnement (§12), et la lecture serveur passe par `duVendeur` (§5.16 : la clé de service contourne RLS, chaque lecture doit être cadrée).
⚠️ Une catégorie absente de la ligne ⟹ **le défaut ci-dessus**, jamais « muet ». Un réglage qu'on ne trouve pas ne doit pas éteindre une vente.

**Vérifié** : `npm run build` OK · `node --check` sur les 3 fichiers `api/` · banc app, écran Réglages RENDU sur les vraies données → « Ce que tu reçois sur ton téléphone — **5 types de notification sur 10** », les 10 lignes présentes avec le bon état par défaut · smoke 12 écrans **0 PAGEERROR, 0 artefact** · `audit-identite` 18/18 · `audit-coherence` 6 règles / 0 désaccord.

---

## 5.42 — ANNULATION vs LITIGE : le numéro suit la paire PHYSIQUE

Julien : « je ne veux pas ne pas utiliser un numéro pour une publication, il faut réattribuer un nouveau — **sauf** si c'est une annulation et qu'on appuie sur republier dans Vinted ; et si c'est un **litige**, qu'on reçoit la paire et qu'on la reposte nous-mêmes, là il faut prendre un **nouveau numéro**. On peut donner la possibilité aux gens de changer de numéro, et lorsqu'ils mettent un numéro déjà attribué, il demande si c'était bien un litige et relit ensuite les informations de l'ancienne paire. »

### La question à laquelle tout se ramène : la chaussure a-t-elle quitté la maison ?
- **annulation / retrait puis republication** → elle n'a jamais bougé, sa boîte porte toujours son numéro → **il reste** ;
- **litige / retour** → elle revient dans un autre carton, on la repose nous-mêmes → **numéro NEUF**.

Les deux se ressemblent à l'écran (l'annonce redevient en ligne). Ce qui les sépare : **une VENTE existe**.

### ⚠️ Le défaut mesuré (22 août, vraie base)
`numeroReprises` excluait les paires « vendues » en lisant `vinted_txn_link`. Or **ce verrou ne se pose que sur les ventes FINALISÉES** (`classifyOrderStatus === 'completed'`). Résultat :

| | |
|---|---|
| ventes rattachées à une paire numérotée hors ligne | **58** — dont **18 sans verrou** |
| paires en **litige** | **3** — N°115 « Retour initié », N°169 « non réclamée », N°167 « Remboursement effectué » |
| ces 3 paires avaient-elles un verrou ? | **AUCUNE** |

➡️ Les trois paires en litige auraient **repris leur ancien numéro toutes seules** en étant reposées.

### Ce qui a changé
- **`pairesVendues`** (memo) = `vinted_txn_link` **+ toute vente, quel que soit son statut**, résolue par `identiteAnnonce` (identifiant Vinted, sinon photo — §5.34). Jamais par titre.
- Une paire marquée `vendue` reste **proposée** dans le bandeau ♻️ (avec un avertissement orange : « cette paire a été VENDUE sous le N°X — ne le remets que si elle t'est revenue et qu'elle est dans sa boîte ») mais **l'effet automatique la saute** (`if (r.vendue) continue;`). Une paire jamais vendue garde son numéro sans un clic, comme avant.

### Changer un N° à la main — trois cas, un seul refus
`poserNumero(item, valeur, avant)`, au **blur** du champ N° (⚠️ pas à chaque frappe : en tapant « 15 » on passe par « 1 », qui déclencherait une fausse alerte) :
1. **numéro libre** → posé, et brûlé à vie (`recordUsed`) ;
2. **numéro d'une paire ABSENTE** → « Le N°X a déjà servi… Est-ce bien la MÊME paire qui te revient (litige, retour, annulation) ? » → **oui** ⟹ elle récupère **prix d'achat, achat relié, boost et pointure** de l'ancienne fiche, qui lui cède la place ; **non** ⟹ prochain numéro libre ;
3. **numéro d'une paire ENCORE PRÉSENTE** (en ligne / à expédier / au garage, via `porteursNum`) → **REFUS**, avec le nom du porteur et un bouton « Prendre le N°X ». Deux paires dans la même boîte, c'est la mauvaise chaussure dans le carton (§19, risque n°1).

### ⚠️ Deux pièges rencontrés
- **`useRef` n'était pas importé** (`import React, { useState, useMemo, useEffect }`). `npm run build` passe, mais l'écran tombe au premier rendu. `EcranGardeFou` (§5.14) l'a attrapé au banc : « Cet écran n'a pas pu s'afficher — useRef is not defined ». ⚠️ **`PhotoEditor` (2 `useRef` nus, ligne ~2934) était donc cassé depuis sa création** — corrigé au passage par le même import.
- **Piège de banc** : taper le numéro caractère par caractère **re-rend la grille** (le tri bouge) et le handle Playwright se détache — on mesurait « champ = 1 » au lieu de « 154 ». Il faut poser la valeur **en un coup** (setter natif + événement `input`, comme §5.04), et **repérer chaque champ par l'identifiant de son annonce**, jamais par un index figé. Idem : une annonce d'un **compte supprimé** existe en base mais n'est ni rendue ni comptée comme « présente » — la choisir comme fixture faisait mesurer un artefact.

### Vérifié
`npm run build` OK · banc dédié (`num_manuel.cjs`, vraies données, les deux cas dans des sessions séparées) : **CAS 1** feuille « a déjà servi » → le N°154 passe sur l'annonce en ligne, **prix d'achat 23,50 récupéré**, ancienne fiche libérée ; **CAS 2** refus affiché, N°335 (libre) posé à la place, **le N°5 n'est pas dupliqué** — **0 erreur d'app** dans les deux · smoke 12 écrans **0 PAGEERROR, 0 artefact** · `audit-identite` **22 contrôles** (les 4 nouveaux **échouent bien sur le code d'avant**, §21) · `audit-coherence` 6 règles / 0 désaccord.

---

## 5.43 — ⚠️⚠️ INCIDENT : 593 EMAILS MIS EN QUARANTAINE À TORT, ET LE VRAI PICKUP PASS JAMAIS RECONNU

Julien, en urgence : « j'ai plein de colis arrivés chez Chronopost Super U et je n'ai pas les QR codes dans l'application… les personnes ne peuvent pas récupérer leurs colis et perdre de l'argent car les colis sont retournés. »

Méthode habituelle : lire la base avant de coder. **Trois causes empilées, dont deux que j'avais introduites.**

### 1. ⚠️⚠️ LA CAUSE PRINCIPALE : plus AUCUN email n'était traité depuis le 16 août

| famille | dernière ligne |
|---|---|
| `email_track_` | **16 août 14:56** |
| `email_bord_` | 16 août 08:38 |
| `email_sale_` | 15 août 23:44 |
| **`email_quarantaine_`** | **593 lignes · la dernière il y a 16 minutes** |

**Six jours d'emails entiers mis de côté, zéro traité** — dont « Votre colis Chronopost est arrivé en consigne Pickup » (17 août) et « Votre colis VINTED est arrivé en relais Pickup » (19 août). Raison inscrite sur les 593 : *« adresse de réception inconnue »*.

**C'est §5.16.** J'y avais écrit : « `VRM_OWNER_UID` reste le propriétaire par défaut : tant qu'il n'y a qu'un vendeur, **rien ne change** pour lui. » **Faux en production** : la variable n'est pas réglée sur Vercel, aucune adresse de réception n'est déclarée, donc `resoudreProprietaire` tombait à l'étape 4 → quarantaine, pour **chaque** email.

➡️ **LA RÈGLE : la quarantaine n'a de sens QUE si la base sait séparer les vendeurs.** Tant que la colonne `owner` n'existe pas, il n'y a qu'une boutique et une ligne `main` : rien à protéger, donc rien à mettre de côté.
```js
if (!proprio.owner && await baseCloisonnee()) { …quarantaine… }
```
⚠️ **Ne jamais reposer un filtre de propriétaire avant que la base sache l'honorer.** Un garde-fou qui s'active dans le vide ne protège personne — il coupe l'outil.

### 2. ⚠️ LE VRAI PICKUP PASS N'A NI `alt` NI MOT-CLÉ AUTOUR
Relevé dans l'email du 17 août :
```html
<img width="218" src="…pickup-services.com/api/barcode/DataMatrix?d=FR1971A;09843408317167|81569539" alt="">
<img              src="…pickup-services.com/api/barcode/AztecCode?d=PICKUPPASS:2.00:FR93638;09447431562792;;">
```
Le HTML autour n'est que du `<table>`. Or §5.37 exigeait un **mot-clé dans le HTML, jamais dans l'URL** — règle juste pour « pickup » (présent dans TOUTES les URL Pickup, mouchard compris), mais qui **rejetait le code lui-même**.

➡️ **`URL_QR_CERTAIN`** = `/(api/)?barcode/(datamatrix|azteccode|aztec|qrcode|qr|pdf417|code128…)/`. Un chemin qui dit `barcode/DataMatrix` n'est pas un indice marketing : c'est **la nature de la ressource**. Il passe avant la liste noire, dans `api/email-inbound.js` (extraction) **et** dans `src/App.jsx` (affichage) — sinon un mot innocent de l'URL ferait disparaître le seul moyen de retirer le colis. Une passe **0)** dans `extractPickupQr` le cherche en premier.

### 3. Les deux nombres du casier étaient dans le texte, en gras markdown
```
Identifiant : *8156*
Code d’ouverture : *9539*
```
Les regex de §5.37 ne toléraient ni les **astérisques** ni l'apostrophe typographique → `code` vide alors que la date limite et le lieu, eux, passaient. ⚠️ **Au casier, sans ces deux nombres la porte ne s'ouvre pas.**

### ✅ `scripts/audit-qr.cjs` — contrôle permanent
Fige les **vraies URL relevées** dans ses emails (2 Pickup Pass) et les fausses (mouchard `tracking/1/open`, `avn-prod`, logo, bannière VintedGo, enquête). Vérifie que les deux fichiers **acceptent les vraies, rejettent les fausses, et tranchent pareil**. Il a immédiatement trouvé un défaut réel : la liste noire du serveur n'avait jamais reçu les ajouts de §5.37 faits côté app (`avn-prod`, `azureedge`, `dropoff`, `_parcel`…) — alignée.

### Mesuré
| | |
|---|---|
| anciennes `qrUrl` en base (les fausses de §5.37) | **25 · 0 affichée** — la protection tient |
| emails transporteur bloqués en quarantaine | 23, dont **2 « à retirer »** |
| ces 2 emails après correctif | **2 vrais QR**, 1 code + identifiant, 2 dates limites, 1 lieu |

### ⚠️ RESTE À FAIRE — LE REJEU DES 593 EMAILS
Le correctif répare l'avenir ; **les 593 emails déjà en quarantaine ne se traitent pas tout seuls**. Le harnais existe (`rejouer.mjs` : relit chaque ligne, appelle le VRAI `traiterEmail`, éteint les notifications le temps du rejeu via `push_prefs`, puis marque la ligne rejouée). **Il écrit en base de production : l'action a été bloquée, elle demande le feu vert de Julien.**
⚠️ Deux points à redire avant de lancer : les **pièces jointes ne sont pas conservées** en quarantaine (seuls `filename`/`contentType`), donc les **PDF de bordereaux de ces 6 jours sont perdus** — le QR, lui, est une URL dans le HTML, il revient ; et `vrm_pro_facture.actif = true` mais `autoSend: false`, donc le rejeu **prépare** les factures sans en envoyer aucune.

### Vérifié
`npm run build` OK · `node --check` sur `api/email-inbound.js` · `scripts/audit-qr.cjs` **5/5** · banc unitaire sur les VRAIES fonctions découpées du fichier, contre les emails réels en quarantaine · `audit-identite` 22/22 · `audit-coherence` 6 règles / 0 désaccord.
⚠️ Piège de banc (§21, encore) : `extractPickupQr` est appelée par le **handler**, pas par `parseCarrierEmail` — lire `t.qrUrl` affichait « AUCUN » quoi qu'il arrive. Et `.replace(/^export\s+/gm,'')` sur le code découpé **effaçait l'export ajouté à la fin** : la fonction paraissait absente du module.

### 5.43 (suite) — LE REJEU EST DANS L'APP, PAS DANS UN SCRIPT

Le correctif ci-dessus répare l'avenir ; les **593 emails déjà mis de côté** ne repartent pas seuls. Lancer un script qui écrit en base de production a été **refusé par la sécurité**, deux fois — et c'était la bonne réponse : ce geste appartient au propriétaire des données, pas à l'agent.

➡️ **Bouton « ▶ Tout rejouer (N) »** dans Réglages → *Mes adresses de réception*, sous la liste des emails en attente (`EmailsRecuSetting`). Il repasse chaque email dans **exactement** le traitement d'un email qui vient d'arriver (`api/email-rattacher` → `traiterEmail`).

- **UN PAR UN, en attendant la réponse** : on ne lâche pas 600 requêtes d'un coup sur la fonction serverless. Barre d'avancement « Traitement… 137/593 ».
- ⚠️ **`silencieux: true`** : sans ça, rattraper six jours d'emails enverrait **600 notifications** pour des choses déjà faites. Le drapeau vit dans le **contexte de la requête** (`AsyncLocalStorage`, §5.16) et `pushOnce` en sort immédiatement — il ne peut donc pas éteindre un email qui arrive vraiment au même moment.
- Une ligne de quarantaine n'est effacée **que si le traitement a abouti** (déjà le cas) : on ne détruit jamais le seul exemplaire.

### Ce que le backlog contient vraiment (mesuré, avant rejeu)
23 emails de transporteur sur les 593 :
| | |
|---|---|
| **colis à retirer** | **2** — les deux rendent leur **vrai QR** ; l'un avec code **9539** + identifiant **8156**, l'autre en relais |
| Mondial Relay | 12, **tous « en transit »** (ses colis vendus qui partent) — aucun code à afficher, c'est normal |
| « colis retiré » | 3 — ils éteindront d'anciens colis restés « à retirer » |
| dépôts / en chemin | 6 |

⚠️ À dire à Julien plutôt que de le laisser croire : **le retard ne contient que 2 colis à retirer**, pas « plein ». S'il en attend davantage, leurs emails sont soit arrivés avant le 16 août (donc déjà traités), soit jamais arrivés à l'app.

**Vérifié au banc** (Réglages rendu, 12 lignes de quarantaine, `/api/email-rattacher` simulé) : carte affichée, bouton « ▶ Tout rejouer (12) », feuille de confirmation, **12 appels sur 12**, tous en `silencieux`, **envoyés l'un après l'autre** (écarts 6–9 ms), ids distincts, **0 erreur d'app**.

### 5.43 (suite) — ⚠️ IL AVAIT RAISON : LA CARTE DES COLIS N'AFFICHAIT AUCUN QR

Julien : « il n'y a rien qui a changé, tu es sûr que tu as mis les QR code Chronopost dans achat ? » — **non**, et le vérifier au rendu l'a prouvé en trois minutes.

J'avais vérifié l'**extraction** (le QR sort bien de l'email) et le **filtre** (`qrImage`). Je n'avais **pas** vérifié que l'écran Achats l'affiche. Banc dédié (`achat_qr.cjs`) : on fabrique la ligne `email_track_*` que le rejeu VA produire, en passant les vrais emails encore en quarantaine dans les vraies fonctions, puis on rend l'écran Achats. Résultat : **0 vignette QR, aucune modale**.

⚠️ **Il y a DEUX cartes de colis dans le fichier, et j'avais lu la mauvaise.** Celle que j'ai relue (l. ~14030) porte bien un bloc `qrImage(t)` — c'est celle de **Ma journée**. L'écran **Achats** utilise une autre carte, **groupée par point relais** (l. ~13775), qui n'affichait que le code et l'identifiant. **Chronopost se retire en SCANNANT** : sur cet écran il n'y avait donc littéralement rien à présenter au comptoir.

### Trois défauts, tous trouvés au rendu réel
1. **La carte Achats ne montrait pas le QR.** Vignette 64 px cliquable ajoutée **en premier** (avant les nombres) : c'est le geste principal. Le texte d'usage suit (« Scanne le QR, ou saisis ces nombres 👉 » / « Présente le QR au comptoir 👉 »).
2. ⚠️ **Un colis qui n'a QU'UN QR n'apparaissait NULLE PART.** `isColisRetirable` exigeait **un lieu OU un code** — or « Votre colis VINTED est arrivé en relais Pickup » n'a ni l'un ni l'autre, seulement le Pickup Pass. Il est maintenant compté (`|| !!qrImage(t)`). Sans ça, le colis serait resté invisible jusqu'au renvoi à l'expéditeur.
3. ⚠️ **`-0 < 0` est FAUX en JavaScript.** Le calcul `Math.ceil((limite 23:59:59 − maintenant)/24h)` rend **-0** pour une limite d'hier → le colis annonçait « ⏰ dernier jour pour le retirer » alors que **le délai était dépassé**. `joursAvant(limite)` (module-level, utilisé par les DEUX cartes — §11) compare des **jours**, minuit à minuit.

**Vérifié au banc, sur les données que le rejeu produira** : « colis à retirer » affichés · **2 vignettes QR** (dont le colis qui n'apparaissait pas du tout) · modale ouverte avec le **QR en grand** · identifiant 8156 + code 9539 · lieu « Consigne Pickup Super U Cancale » · délais corrects (**« délai de retrait dépassé »** pour le 21/08, **« à retirer demain »** pour le 23/08) · **0 erreur d'app**.
⚠️ Trois de mes assertions de banc étaient fausses avant l'app (date affichée en « demain », en « dépassé ») — **relire l'attendu avant d'accuser le code**.

Smoke 12 écrans **0 PAGEERROR** · `audit-qr` 5/5 · `audit-identite` 22/22.

### 5.43 (suite) — LE RATTRAPAGE EST SUR L'ÉCRAN ACHATS, PAS DANS LES RÉGLAGES

Julien : « regarde, il n'y a aucun QR code comme avant ni de code de retrait ». **Mesuré avant de coder, et l'écran a raison d'être vide** :

| | |
|---|---|
| emails encore en quarantaine | **593** (le rejeu n'a jamais été lancé) |
| dernière ligne `email_track_` | toujours **16 août** |
| colis « à retirer » en base | 15 — **le plus récent a 15 jours**, les autres 21 à 37 |
| colis « à retirer » de moins de 14 j (`PICKUP_MAX_DAYS`) | **0** |

Donc : les vrais colis sont dans les emails mis de côté, et les 15 anciens sont tous périmés. L'app n'avait **rien** à afficher — ce n'était ni un défaut d'extraction ni un défaut d'affichage cette fois.

⚠️ **Le vrai défaut était produit** : le bouton de rattrapage vivait dans **Réglages → Mes adresses de réception**. Il regarde **Achats**. Un outil de travail doit proposer la réparation **là où le manque se constate**.

➡️ **`RejeuEnAttente`** (composant module-level) monté en tête de l'écran **Achats** : bandeau orange « 📥 N emails pas encore traités — tes colis à retirer, avec leur QR et leur code, sont dedans » + bouton **« ▶ Traiter maintenant (N) »**. Mêmes garde-fous que dans Réglages : confirmation, **un par un** en attendant la réponse, **`silencieux: true`**, rien n'est supprimé sans traitement abouti, puis rechargement. Lecture **scalaire** des identifiants seuls (une ligne de quarantaine contient l'email entier — §34). Le bandeau disparaît de lui-même quand la quarantaine est vide.

**Vérifié au banc** (écran Achats rendu, 12 lignes de quarantaine + les 2 vrais colis du rejeu) : bandeau affiché, confirmation, **12 appels sur 12** tous en `silencieux` ; et sur la même page **2 vignettes QR**, modale avec le QR en grand, identifiant 8156 + code 9539, lieu Super U, délais justes. **0 erreur d'app** · smoke 12 écrans **0 PAGEERROR** · `audit-qr` 5/5 · `audit-identite` 22/22 · `audit-coherence` 6/0.

### 5.43 (suite) — PLUS DE BOUTON : LE RETARD SE RÉSORBE TOUT SEUL

Julien : « je ne veux pas qu'il y ait un bouton pour traiter les mails, dès que ça arrive ça doit apparaître ».

Les emails qui arrivent **maintenant** sont déjà traités tout seuls depuis le correctif de quarantaine. Ce qui restait manuel, c'était le **retard**. Il ne l'est plus.

- **`RejeuEnAttente` (le bandeau à bouton) est SUPPRIMÉ.** À la place, un effet dans `Comptabilite` : à l'ouverture de l'onglet **Achats**, s'il reste des lignes `email_quarantaine_*`, elles sont repassées dans le traitement normal, sans rien demander.
- ⚠️ **LES COLIS D'ABORD.** 593 emails à la file, c'est plusieurs minutes ; ce qu'il attend (le QR, le code) doit apparaître en quelques secondes. On trie sur le **SUJET** (`SUJET_COLIS`), lu en **scalaire** — jamais le corps (§34). Dès que les colis sont passés, `fetchEmailTracking()` rafraîchit l'écran : le QR s'affiche sans attendre la fin du reste (puis tous les 40).
- **`silencieux: true`** partout : on rattrape de l'historique, pas des nouveautés.
- Garde-fous : **`_rattrapageLance`** (module-level) → une seule passe par chargement de page, sinon revenir sur l'onglet relancerait la boucle ; **arrêt après 8 échecs d'affilée** (réseau coupé) au lieu d'insister 600 fois ; `mort` au démontage.
- À l'écran, plus un bouton mais **un compte rendu** : « 📥 Récupération de tes emails… 12/593 · Tes colis à retirer apparaissent au fur et à mesure. »

**Vérifié au banc** (écran Achats, quarantaine mêlant colis et autres sujets) : **aucun bouton « Traiter »**, rattrapage **lancé tout seul** (8 emails), **les 3 colis traités EN PREMIER** (a2, a4, a6 avant les ventes/favoris/évaluations), tous en `silencieux` ; et sur la même page 2 vignettes QR, modale, identifiant 8156 + code 9539, délais justes. **0 erreur d'app** · smoke 12 écrans **0 PAGEERROR** · `audit-qr` 5/5 · `audit-identite` 22/22.

### 5.43 (suite) — LE COLIS COCHÉ RESTE EN GRIS **AVEC SON QR**, et le rattrapage devient invisible

Julien : « je ne veux pas qu'il y ait marqué traité, je veux que ce soit automatique… et grisé en attendant que ce soit confirmé, comme ça si jamais il y a un problème, j'ai quand même le QR code ».

**1. Le rattrapage ne se voit plus.** L'indicateur « Récupération de tes emails… n/N » est retiré : l'effet tourne en fond, ce qui apparaît ce sont les colis eux-mêmes.

**2. ⚠️ LE TROU RÉEL : cocher ✓ faisait disparaître le colis, QR compris.** Le mode « grisé, pas disparu » (§5.37) n'existait que pour les colis déduits du **statut Vinted** (`markPickupDone`). Un colis venu d'un **email transporteur** passe par `markCollected`, qui le sort de `isColisActive` → il s'évaporait d'un coup. C'est exactement le cas de ses Chronopost.
- **`vrm_colis_collected_at`** (nouvelle clé, synchronisée) mémorise **QUAND** on a coché — le Set `vrm_colis_collected` ne le disait pas, et sans la date on ne peut pas garder la ligne « le temps que ce soit confirmé ». Clé à part : un colis coché avant ce changement n'a pas de date et se comporte comme avant (aucune régression).
- **`pickupUnion.attenteMail`** : les colis d'email cochés restent affichés **en gris, avec leur QR, leur code et leur n° de suivi**, jusqu'à ce que le transporteur confirme (`colisRetireAilleurs`) ou au plus `PICKUP_CONFIRM_DAYS`. Bouton **↺ Remettre**.
- ⚠️ **L'opacité n'est PAS sur la carte** : elle se transmet aux enfants et ne se « défait » pas. On grise le texte et la photo séparément — **le QR reste net et scannable**.
- Le bloc « retirés » côté Vinted (`attente`) gagne la même chose, via `trackForBuy(o)` (titre exact ET candidat unique des deux côtés, §5.39) — jamais le QR d'un autre colis.

**3. Le n° de suivi sur sa propre ligne**, en chiffres monospace : au comptoir c'est ce qu'on demande quand le scan ou le code ne passe pas.

**Vérifié au banc** : aucun bouton « Traiter », **aucun indicateur** de traitement, rattrapage lancé tout seul (**colis en premier**, tous en `silencieux`), `n° 09843408317167` visible, 2 vignettes QR, modale plein écran, identifiant 8156 + code 9539, délais justes — puis **après le ✓** : bloc « en attente de confirmation », **le QR toujours accessible dessus**, bouton ↺ Remettre. **0 erreur d'app** · smoke 12 écrans **0 PAGEERROR** · `audit-qr` 5/5 · `audit-identite` 22/22 · `audit-coherence` 6/0.

### 5.43 (suite) — ⚠️ LE RATTRAPAGE NE SE TERMINAIT JAMAIS + le compte exact des colis

Julien : « j'ai qu'un seul QR code alors que j'ai plusieurs colis… scanne tous les mails que tu peux ».

**1. ⚠️ Défaut trouvé en mesurant : la quarantaine ne se vidait pas.**
Relevé le 22 août au soir : `email_track_` **94 → 109** (le rattrapage automatique a bien tourné), mais **593 lignes de quarantaine toujours là**. Cause : `api/email-rattacher.js` supprime la ligne traitée par `DELETE`… or **le `DELETE` sur `app_data` est sans effet avec la clé publique** (§5.22) et `SUPABASE_SERVICE_KEY` n'est pas réglée sur cette installation. Donc le rattrapage **reprenait les 593 mêmes emails à chaque ouverture de l'onglet Achats** — 593 appels serverless pour rien, à chaque fois.
➡️ La ligne est désormais **VIDÉE** par upsert (`{supprime:true, rejoueLe, type}`) en plus du `DELETE`, et **les deux listes** (rattrapage auto + écran Réglages) **ignorent ce qui porte `supprime`**.

**2. Le scan exhaustif — il n'y a bien que 2 colis à retirer.**
Détection VOLONTAIREMENT LARGE (n'importe quelle mention de chronopost / pickup / mondial relay / relais / consigne / shop2shop / colissimo / suivi, dans l'expéditeur, le sujet, le texte OU le HTML) sur les **593** emails :

| | |
|---|---|
| emails qui parlent de colis | **41** |
| **« arrivé / à retirer »** | **2** — les deux avec leur **vrai QR** (17 et 19 août) |
| « entre de bonnes mains » / « confirmation de dépôt » | 34 — **ses colis vendus qui partent**, rien à retirer |
| « Votre colis a été retiré » | 3 (20 août) — déjà récupérés |
| « en chemin » / espagnol | 2 |

⚠️ **À dire tel quel : les autres emails Chronopost ne sont pas des colis qui l'attendent, ce sont les siens qui partent.** Chercher plus loin dans ces 593 ne donnera rien de plus — c'est mesuré, pas supposé. S'il en attend d'autres, leurs emails **ne sont jamais arrivés à l'app** (une boîte qui ne transfère pas) ou datent d'**avant le 16 août** (donc déjà traités, mais extraits par l'ancien code : le corps brut n'étant pas conservé, leur QR est définitivement perdu — §5.37).

**Vérifié au banc** : les lignes déjà rejouées sont **ignorées** (elles ne repartent pas dans la boucle), aucun indicateur, colis en premier, n° de suivi visible, 2 vignettes QR, modale, 8156/9539, et après le ✓ le QR reste accessible. **0 erreur d'app** · smoke 12 écrans **0 PAGEERROR** · `audit-qr` 5/5 · `audit-identite` 22/22.

### 5.43 (suite) — ⚠️⚠️ LE CSS ÉTAIT LU COMME DU TEXTE (tout email Mondial Relay)

Julien : « j'ai les QR code qui sont arrivés hier que je ne suis pas allé retirer et qui ne sont pas affichés ».

**Un vrai défaut, général, trouvé en lisant un email au lieu de faire confiance à mon classement.**
`htmlToText` ne retirait **ni `<style>` ni `<script>` ni les commentaires**. Or les emails Mondial Relay / Vinted-relay embarquent une feuille de style de plusieurs milliers de caractères — et certains services de réception fournissent un `text` qui **n'est QUE cette feuille de style**. Relevé sur « Votre colis est entre de bonnes mains 📦 » : le champ `text` commence par `body { margin: 0 !important; … }` et ne contient **aucune phrase**.

Conséquences : le statut tombait en « en transit » par défaut, le lieu / la date limite / le code n'étaient jamais cherchés au bon endroit — et des **chiffres de CSS** pouvaient être pris pour un code de retrait.

- `htmlToText` retire désormais `<style>`, `<script>` et les commentaires.
- **`texteUtile(mail)`** choisit la meilleure source : le `text` fourni s'il ressemble à un message, sinon le HTML nettoyé, sinon le moins pollué des deux (`RESSEMBLE_A_DU_CSS`). `parseCarrierEmail` part de là.
- **Prouvé** : le même email rend maintenant « *Bonne nouvelle Julien, votre colis n° 65811418 déposé a été pris en charge. Cet email fait office de preuve de dépôt.* » — donc un colis **qu'il DÉPOSE**, pas un colis à retirer.

### Le compte, mesuré deux fois et par deux chemins
Après correctif, re-scan de **tous** les emails conservés :

| | |
|---|---|
| emails conservés | 593 (581 encore à traiter, 12 déjà consommés) |
| emails contenant **un vrai code-barre** (recherche brute de `barcode/…` dans le HTML) | **1** restant + 1 déjà traité |
| emails « arrivé / à retirer » | **2 au total**, 17 et 19 août |
| statuts changés par le correctif CSS | **0** (le classement était juste, par chance) |
| emails du **21 août** | 9, tous « bonnes mains » / « dépôt » / « bordereau » — **aucune arrivée** |

➡️ **Aucun email d'arrivée du 21 août n'a atteint l'app.** Ce n'est pas un défaut de lecture : le code-barre est cherché **en brut dans le HTML**, indépendamment de tout classement, et il n'y en a pas. Soit Chronopost n'en a pas envoyé, soit il est parti sur une boîte qui ne transfère pas.
⚠️ **La prochaine question à poser à Julien est donc l'ADRESSE**, pas le code : quelles boîtes transfèrent vers l'app (relevé : `shopcancale35@`, `lolanisse35@`, `tomjeancanc35@`, `vinted35260@icloud`, `traces_etage_3i@icloud`, 2 `privaterelay`), et sur laquelle arrivent ses emails Pickup.

**Vérifié** : `npm run build` OK · le parseur rend toujours code 9539 + identifiant 8156 + lieu + QR sur l'email réel · écran Achats : vignette QR, modale, QR conservé après le ✓ · smoke 12 écrans **0 PAGEERROR** · `audit-qr` 5/5 · `audit-identite` 22/22.

### 5.43 (suite) — POURQUOI LE COLIS 8156/9539 N'ÉTAIT PAS LÀ, ET LA RÈGLE QUI POUVAIT EN CACHER D'AUTRES

Julien : « ce colis-là n'est pas dans l'app, regarde pourquoi et corrige pour que ça n'arrive pas. Identifiant 8156, code 9539. »

**Tracé ligne par ligne dans la vraie base** (`colis8156.mjs`, puis `filtre.mjs` qui rejoue la CHAÎNE DE FILTRES de l'app sur les vraies lignes) :

| contrôle | résultat |
|---|---|
| ligne `email_track_chronopost_09843408317167` | **existe**, `status=available`, code 9539, ident 8156, QR réel, lieu Super U |
| coché « récupéré » ? | non |
| un email « colis retiré » pour ce suivi ? | non |
| **la chaîne de filtres de l'app l'affiche-t-elle ?** | **OUI** |

➡️ **Il n'y avait pas de bug d'affichage : la ligne n'a été créée qu'à 21:00**, quand le rattrapage automatique est arrivé à cet email. Julien regardait avant.

### Ce qui a quand même été corrigé — la règle des 14 jours pouvait cacher un vrai colis
`isColisActive` écartait tout colis reçu il y a plus de `PICKUP_MAX_DAYS` (14). C'est une **supposition** (« un relais ne garde pas plus longtemps »). Or quand le transporteur **écrit** la date limite, c'est lui qui a raison — mesuré : un Chronopost de 15 jours était écarté par la supposition.

➡️ **La `limite` de l'email prime sur les 14 jours, dans UN SEUL SENS :**
- limite **connue et pas encore dépassée de plus de `PICKUP_GRACE_DAYS` (10 j)** ⟹ le colis reste visible, même vieux ;
- ⚠️ **jamais l'inverse** : une limite dépassée ne fait PAS disparaître le colis. Celui de Julien avait sa limite au 21 août et n'était toujours pas retiré le 23. **Un colis caché est un colis perdu** — on l'affiche en rouge « délai dépassé », c'est à lui de trancher.
- Sans limite dans l'email : comportement inchangé (14 jours).

**Et le rattrapage part aussi depuis Ma journée**, plus seulement depuis Achats : attendre qu'il ouvre précisément l'onglet Achats retardait l'apparition d'un colis pour rien.

**Vérifié** : chaîne de filtres rejouée sur les 109 lignes réelles → **2 colis affichés**, dont celui de Julien (9539 / 8156), et les 16 écartés le sont pour une raison nommée (coché récupéré, ou > 14 j sans limite) · **6 cas sur 6** au contrôle unitaire de la nouvelle règle (vieux + limite demain → visible ; vieux + limite d'hier → visible ; limite dépassée de 20 j → non ; sans limite → inchangé ; coché → non) · écran Achats rendu : vignette QR, modale, QR conservé après le ✓ · smoke 12 écrans **0 PAGEERROR** · `audit-qr` 5/5 · `audit-identite` 22/22.

### 5.43 (suite) — UN ENDROIT PAR TRANSPORTEUR + le jour d'arrivée + la date d'origine au rejeu

Julien : « pourquoi il y en a que deux, mets le jour d'arrivée, et prépare un endroit dédié pour chaque transporteur ».

### « Pourquoi seulement deux » — mesuré, il n'y en a pas d'autres
| | |
|---|---|
| quarantaine | 593 lignes · **38 traitées · 555 restantes** |
| **parmi les 555 restantes, emails qui parlent de colis** | **0** — tous les emails de colis sont passés |
| lignes de suivi | 109 : Mondial Relay 67, Chronopost 32, Vinted 5, Colissimo 4, Shop2Shop 1 |
| « à retirer » | MR **13** (11 avec code) · Chronopost **4** (2 avec vrai QR) |
| **affichés par l'app** | **2** |

Les 13 Mondial Relay ne s'affichent pas parce qu'ils ont **21 à 37 jours** et que **12 sont cochés « récupéré »**. Ce n'est donc ni une perte ni un filtre trop dur : il n'y a réellement que 2 colis en attente.

### ⚠️ La date d'origine est conservée au rejeu
`traiterEmail` datait la ligne à `Date.now()`. Un email d'il y a six jours rejoué ressortait donc daté d'**aujourd'hui** : le colis aurait affiché « arrivé le 22 » alors qu'il attend depuis le 17, et la fenêtre d'ancienneté (§`isColisActive`) aurait été fausse. `api/email-rattacher.js` passe désormais `__recuLe` (le `at` de la ligne conservée) et `traiterEmail` l'utilise.
⚠️ **Les deux colis déjà récupérés aujourd'hui gardent la date du rejeu** (22/08) — leur ligne est déjà écrite. Ça se corrige tout seul pour les suivants.

### Le jour d'arrivée, et un endroit par transporteur
- Chaque colis affiche **`n° 0984… · arrivé le 17/08 · il y a 6 j`**. Savoir depuis quand il attend, c'est ce qui dit s'il faut y aller aujourd'hui.
- Les points relais sont regroupés **par transporteur** (`parTr`), avec un en-tête (logo + nom + nombre de colis) **toujours affiché**, même s'il n'y a qu'un transporteur : chacun a sa façon de remettre le colis (§28 — Chronopost au QR, Mondial Relay au code), et les mélanger obligeait à relire le logo de chaque ligne pour savoir quoi présenter au comptoir.

**Vérifié au banc** : section transporteur rendue, `n° 09843408317167 · arrivé le 22/08`, vignette QR, modale plein écran, identifiant 8156 + code 9539, lieu Super U, QR conservé après le ✓ — **0 erreur d'app** · smoke 12 écrans **0 PAGEERROR** · `audit-qr` 5/5 · `audit-identite` 22/22.

### 5.43 (suite) — LA SAISIE NE VALIDE QU'À LA SORTIE (Entrée ou clic ailleurs)

Julien : « quand je remplis les prix d'achat, dès que je mets 2 pour mettre 20 ça
le rentre et je ne peux plus mettre plus que 2 — actionne le bouton entrer pour
que je puisse taper 20. »

**Cause de la famille de bugs** : cinq champs écrivaient à **chaque frappe**
(`onChange` → `updatePair` / `setSaleOverride` / `poserNumero`). Chaque frappe
réécrivait `vinted_annonce_numeros` ou `vinted_sale_overrides`, l'écran se
re-rendait et se retriait, l'input pouvait être remonté ailleurs — et le focus
partait après le premier caractère.

➡️ **`ChampSaisie`** (module-level) : la valeur reste **locale** pendant la
saisie, et n'est validée qu'à la **sortie du champ** ou sur **Entrée** (Échap
annule). Tant qu'on n'écrit pas dedans, le champ suit la donnée (numéro posé
automatiquement, prix repris d'un achat relié). **`onCommit` n'est appelé que si
la valeur a CHANGÉ** — sinon entrer puis sortir d'un champ prix effaçait l'achat
relié (`buyFromId`/`buyFrom` sont remis à `null` à toute saisie manuelle).

Les 5 champs convertis : **N° de la paire**, **prix d'achat** et **boost** sur
l'écran Annonces ; **N°** et **prix d'achat** sur une ligne de vente.
⚠️ `poserNumero` **écrit maintenant lui-même le numéro** dans le cas « numéro
libre » (avant, c'est `onChange` qui l'avait déjà posé) — donc le numéro n'est
écrit qu'**après** les contrôles de collision, jamais pendant la frappe. Un champ
vidé ne retire jamais un numéro (§5.40) : l'affichage revient à la valeur en base.

### « Les numéros ne doivent plus jamais bouger » (il va les écrire sur les boîtes)
Ce qui était déjà garanti : l'auto-numérotation **saute toute annonce qui a déjà
un numéro** ; la reprise auto ne touche que les numéros **posés automatiquement**
(`auto:true`), jamais un numéro tapé à la main ; aucun numéro n'est rendu au pot
(§5.40).
➡️ **Garantie ajoutée** : la reprise automatique **ne touche jamais une paire
rangée au garage** (`porteursNum[n]` contient un porteur `garage`). Un numéro
écrit sur un carton réel ne peut plus changer tout seul, même s'il vient de
l'attribution automatique.

### ⚠️ HONNÊTETÉ — je n'ai PAS reproduit sa perte de focus au banc
Testé sur les vraies données, écran Annonces ET écran Ventes, en tapant « 20 »
caractère par caractère (300 ms entre les frappes) : **l'ancien code passait
aussi**. Sa configuration réelle diffère donc de la mienne (tri actif, données,
aller-retour cloud). Le correctif reste juste — c'est exactement ce qu'il a
demandé, et il rend la famille entière impossible : **plus aucune écriture
pendant la frappe**, donc plus rien qui puisse re-trier la liste sous ses doigts.
Ne pas écrire ailleurs « bug de focus reproduit puis corrigé » : ce serait faux.

### Vérifié
`npm run build` OK · banc dédié (`saisie.cjs`, vraies données) : « 20 » tapé en
deux frappes → **valeur « 20 », focus gardé**, Entrée → `buyPrice = "20"` en
base ; entrer/sortir sans rien changer → **la fiche n'est pas réécrite** ; champ
N° → « 335 » tapé et enregistré · `num_manuel.cjs` cas 1 et 2 rejoués (reprise
d'une paire absente avec son prix d'achat ✅, refus sur une paire présente ✅) ·
smoke 12 écrans **0 PAGEERROR** · `audit-identite` **26 contrôles** (les 4
nouveaux **échouent bien sur le code d'avant** : 5 champs écrivaient lettre par
lettre, la reprise auto touchait une paire au garage) · `audit-qr` 5/5 ·
`audit-coherence` 6 règles / 0 désaccord.

---

## 5.44 — ⚠️ UN EMAIL ARRIVÉ ET PERDU SANS TRACE (23 août) + lecture de TOUTES les formes

Julien : « j'ai toujours que deux colis, et j'ai reçu quatre messages ce matin de
Chronopost dont deux rappels. Je veux qu'il n'y ait aucune erreur du côté
Chronopost, Mondial Relay, Vinted GO. À chaque fois on doit voir le nombre de
paires que l'on reçoit. »

### Ce que la base disait (mesuré avant de coder)
| | |
|---|---|
| dernière ligne `email_track_` | **22 août 20:29** — donc rien ce matin |
| emails reçus le 23 août (journal `email_journal`) | **3** : une offre à 08:01, une finalisation à 00:56, et **un « ignoré » à 06:36 avec expéditeur ET sujet VIDES** |
| quarantaine | 593 lignes, **0 email de colis restant** (tous rejoués) |
| suivis en base | 109 · Chronopost 32 · Mondial Relay 67 · Vinted 5 |

➡️ Deux conclusions, et elles sont différentes :
1. **Au plus UN de ses quatre emails Chronopost a atteint l'app**, et celui-là,
   l'app **n'a même pas su en lire l'expéditeur ni le sujet** — il a été classé
   « ignoré » et **rien n'a été gardé**. Aucun moyen de savoir ce que c'était.
2. Les trois autres ne sont **jamais arrivés** (le pipeline fonctionne : une
   finalisation Vinted est passée à 00:56 le même matin). C'est une question
   d'**adresse de transfert**, pas de code.

⚠️ Et **deux rappels ne sont pas deux colis** : un rappel réécrit la ligne du
colis qu'il concerne (clé = n° de suivi). « Toujours deux colis » peut donc être
exact — c'est le troisième point ci-dessous qui rend ça vérifiable.

### 1. `api/_lib/lire-email.js` — savoir ouvrir le contenant
`normalizeInbound` ne connaissait que **4 formes** (Postmark, SendGrid, Mailgun,
JSON à plat). Un service qui livre l'email **BRUT (MIME)**, ou l'emballe
(`{message:{…}}`, `{data:{email:{…}}}`), ou met les en-têtes dans un tableau,
passait **entièrement à travers** — expéditeur et sujet vides, exactement le cas
du 06:36.
Nouveau module **pur** : MIME complet (multipart, `quoted-printable`, `base64`,
en-têtes `=?UTF-8?B?…?=`, dépliage des lignes, pièces jointes), formes emballées
(4 niveaux), en-têtes en tableau ou en objet, `envelope`, chaîne JSON, Buffer.
Il rend aussi **`forme`** (« mime-brut », « data>email>plate »…) — donc le
journal dit désormais CE QU'ON A REÇU quand quelque chose ne passe pas.
⚠️ Il ne devine **jamais** le contenu : il ne fait qu'ouvrir l'enveloppe.
**`scripts/audit-email-formes.cjs` : 15 formes, toutes lisibles** (les 4
anciennes en non-régression).

### 2. ⚠️ ON NE JETTE PLUS AUCUN EMAIL
`garderInconnu()` : tout email qu'aucune règle ne reconnaît — et tout corps
illisible — est **conservé entier** (`email_inconnu_*`, borné à 200 Ko) avec sa
forme et la raison. Le journal passe de **30 à 200 entrées** : le 23 août, une
rafale d'emails « offre » avait chassé du journal la seule ligne qui expliquait
un colis manquant.
➡️ **Règle : « ignoré » ne veut pas dire « jeté ».** Sans ça, on ne peut que
deviner — c'est ce qui a coûté six jours en août.

### 3. Panneau « 📬 Réception des emails » (écran Achats)
Par transporteur : **nombre d'emails reçus et date du dernier**. Chronopost,
Mondial Relay et Vinted Go y sont **toujours listés, même à zéro** — « aucun
email reçu » est justement l'information à voir. Plus, en orange, les emails que
l'app n'a pas su lire (sujet, expéditeur, forme).
⚠️ Aucune requête pour les dates (elles viennent des suivis déjà chargés) ; une
seule lecture **scalaire** pour les emails non compris (§34).
Ça remplace « je crois que ça n'arrive pas » par un chiffre.

### 4. Aiguillage des transporteurs : `detecterTransporteur(mail)` (fonction pure)
Extraite du handler pour être testable. Deux trous comblés :
- **Vinted Go** : son nom contient « vinted », donc un email de `@vintedgo.com`
  n'était **jamais** reconnu comme un colis (l'expéditeur seul était examiné) ;
- un **colis annoncé par Vinted lui-même** (pas via `shipping@`) était écarté par
  un `!fromVinted` — il n'apparaissait nulle part. Récupéré **uniquement** sur un
  signal fort dans le SUJET et jamais sur un email de vente / offre / message /
  favori / bordereau (on ne devine pas).
**`scripts/audit-transporteurs.cjs` : 23 contrôles**, dont les 8 « ce qui ne doit
JAMAIS devenir un colis » et 3 bout-en-bout (la forme du contenant ne change pas
la décision).

### 5. Le nombre de paires
La carte affiche « 📦 N colis à retirer » **et** « M paires connues · X colis
dont l'article n'est pas encore identifié », et chaque section de transporteur
« N colis · M paires ».
⚠️ **Mesuré : `artTitle` est vide sur les 109 suivis** — un email de transporteur
ne nomme pas l'article. Les paires connues viennent donc aujourd'hui des colis
identifiés par le **statut Vinted**. Le compteur le dit au lieu de gonfler un
total : quand il en manque, ça se voit.

### 6. Le transporteur générique n'avait pas de fiche
Le serveur peut classer un email en `carrier: 'autre'` ; `CARRIERS` n'avait pas
cette entrée → carte sans nom ni couleur, et `retraitMode` sans préférence (donc
aucune consigne au comptoir). Ajoutée.

### Vérifié
`npm run build` OK · `node --check api/email-inbound.js` OK ·
`audit-email-formes` **15/15** · `audit-transporteurs` **23/23** · `audit-qr`
5/5 · `audit-identite` 26/26 · `audit-coherence` 5 règles / 0 désaccord ·
banc app (écran Achats rendu sur les vraies données) : panneau « Réception des
emails » présent et déplié (Chronopost 27 emails · dernier il y a 11 h · Mondial
Relay 58 · Vinted Go 5 …), compteur de paires rendu, QR + modale + code 9539 +
identifiant 8156 inchangés, **0 erreur d'app**.

### ⚠️ CE QUI RESTE OUVERT, ET CE QU'IL FAUT DEMANDER À JULIEN
Le code sait maintenant lire n'importe quelle forme et ne perd plus rien — mais
**il ne peut pas traiter un email qui ne lui est pas envoyé**. Sur ses quatre
emails Chronopost du 23 août, un seul est arrivé. La question à poser est donc
**l'ADRESSE** : sur quelle boîte arrivent ses emails Pickup, et cette boîte
transfère-t-elle bien vers l'app ? (Adresses vues jusqu'ici : `shopcancale35@`,
`lolanisse35@`, `tomjeancanc35@`, `vinted35260@icloud`, `traces_etage_3i@icloud`,
2 `privaterelay`.) Le panneau « Réception des emails » sert exactement à ça :
un transporteur à « aucun email reçu » désigne une boîte qui ne transfère plus.

⚠️ **Le rejeu VIDE la ligne de quarantaine** (`{supprime:true}`) : le corps brut
de ces emails est donc perdu. C'est pour ça qu'on ne peut plus en extraire
l'article a posteriori — les `email_inconnu_*`, eux, sont conservés entiers.

---

## 5.45 — ⚠️ UN NUMÉRO NE BOUGE PLUS JAMAIS TOUT SEUL, ET AUCUNE PAIRE N'EN MANQUE

Julien : « es-tu sûr que les numéros qu'on a attribués aux chaussures ne
changeront jamais, même si on modifie des choses dans le site ? Je veux vraiment
que ça ne change pas. Et je veux forcément qu'elle ait un numéro : dès qu'elle
est postée, elle doit avoir un numéro. »

**Réponse honnête au moment de la question : NON, pas encore garanti.** Mesuré
sur la vraie base le 23 août :

| | |
|---|---|
| annonces en ligne (tous comptes) | 23 · **1 sans numéro** (`9736477763`, compte `angeled92`) |
| paires numérotées | 209 · **194 avec `auto:true`** |
| **numéros posés au garage** | **0** |
| → paires que la reprise automatique pouvait encore changer | **194** |

Le garde-fou « pas si elle est rangée au garage » (posé la veille) ne protégeait
donc **rien en pratique** : le garage est vide.

### 1. La reprise de numéro n'est plus AUTOMATIQUE
C'était la seule chose qui pouvait encore changer un numéro déjà écrit. L'effet
qui appliquait `numeroReprises` est **supprimé**. La reprise reste **proposée**
dans le bandeau ♻️ (`applyReprise`, un tap, avec la photo, le titre, les deux
numéros et la case du garage sous les yeux — et l'avertissement quand la paire a
été vendue).
⚠️ **Contrepartie assumée, à redire à Julien** : quand il republie une paire,
elle reçoit un numéro **NEUF** (nouvel id d'annonce = nouvelle paire pour Vinted)
et sa boîte porte l'ancien. Le bandeau ♻️ propose de remettre l'ancien — **c'est
à lui de taper**. C'est le prix de « rien ne change tout seul », et c'est ce
qu'il a demandé. **Ne pas remettre l'automatique sans son accord explicite.**

### 2. « Renuméroter à la suite » est retiré du menu
C'est le seul outil qui **réattribue** des numéros en masse — donc exactement ce
qui est interdit maintenant qu'ils sont écrits sur des cartons. Le code de la
modale reste, mais **plus rien ne l'ouvre**.

### 3. La numérotation ne peut plus être désactivée
L'interrupteur « 🔢 Auto N° » pouvait rester sur *off* : une paire mise en ligne
pendant ce temps n'obtenait **aucun** numéro, et rien ne le disait. `autoNum` est
désormais une **constante vraie** et le bouton a disparu.

### 4. Toute annonce EN LIGNE reçoit un numéro — comptes masqués compris
L'effet partait d'`annBase`, qui écarte les comptes masqués et les paires données
pour vendues. Or masquer un compte cache sa **comptabilité** : ça ne sort pas le
carton de l'étagère. Il part maintenant de **`listings.items`** (même portée que
`porteursNum`, §5.33).

### Ce qui peut encore changer un numéro (la liste complète, à jour)
| chemin | déclenché par |
|---|---|
| champ N° d'une annonce | **lui**, validé à la sortie du champ (§5.44) |
| champ N° d'une ligne de vente | **lui** |
| bouton « → N°X » d'un doublon | **lui** |
| bandeau ♻️ « remets son numéro » | **lui** |
| numérotation automatique | seulement une annonce **sans** numéro |
⚠️ **Aucun autre. Aucun effet, aucun outil, aucune synchro.**

### Vérifié
`npm run build` OK · `scripts/audit-identite.cjs` **30 contrôles**, dont 4
nouveaux — et **les 4 échouent bien sur le code d'avant** (§21) ·
banc dédié (`num_tous.cjs`, vraies données) : 21 annonces rendues, **0 sans
numéro**, **0 champ N° vide**, une annonce volontairement dépouillée de son
numéro en **reçoit un neuf (N°335)**, et **aucun numéro ne bouge** sur 4 s
d'observation · `num_manuel.cjs` cas 2 rejoué (refus sur une paire présente) ·
`audit-qr` 5/5 · `audit-transporteurs` 23/23 · `audit-email-formes` 15/15 ·
`audit-coherence` 0 désaccord · smoke 12 écrans **0 PAGEERROR, 0 artefact**.

⚠️ **Piège de banc rencontré** : le contrôle « la numérotation couvre toutes les
annonces en ligne » passait AUSSI sur l'ancien code — la chaîne
`const items = (listings.items || []);` existe ailleurs dans le fichier. Ancré
sur le commentaire qui la précède. **Un contrôle qui ne sait pas échouer ne
prouve rien.**

---

## 5.46 — LES OFFRES LISAIENT LE PRIX DE L'ARTICLE, PAS L'OFFRE + le texte se lit d'une seule façon

Audit des données du jour (23 août), sans rien demander : **184 offres archivées**
(`email_offer_*`).

| constat | chiffre |
|---|---|
| offres avec le **pseudo de l'acheteur** | **0 / 184** |
| offres **sans montant** | une bonne partie (`€ de ?` dans le relevé) |
| numéros portés par deux paires **présentes** | **1 — le N°4** (« adidas spezial noir 35,5 » et « 3 manuels première ST2S ») |
| annonces en ligne sans numéro | 1 (se règle à la prochaine ouverture de l'app) |

### 1. ⚠️ LE MONTANT DE L'OFFRE ÉTAIT LE PREMIER € DU MESSAGE
`montant` prenait `(\d+[,.]?\d*)\s*€` sur **tout** le texte — donc le **prix
affiché de l'article** quand il apparaît avant l'offre. **Prouvé** sur un email
type : ancienne règle → **45,00 €** (le prix), nouvelle règle → **30,00 €**
(l'offre).
Conséquences réelles : la notification annonçait le mauvais montant, et le
« copilote d'offres » (`buy` / `net` / « ✅ Accepte » ou « ⚠️ Refuse ») **conseillait
sur un chiffre faux** — sur de l'argent, avec 24 h pour décider.
➡️ On cherche d'abord un montant **rattaché à l'offre** (`offre de X €`,
`X € pour`, `propose X €`), le premier € du message ne servant plus que de repli.

### 2. Le pseudo de l'acheteur : vide sur les 184
Deux causes cumulées : une seule tournure reconnue, et surtout — voir ci-dessous —
un texte d'email qui n'était parfois **que du CSS**. Quatre tournures acceptées
maintenant (`X t'a fait une offre`, `offre de X`, `de la part de X`, `X a fait
une offre`).
⚠️ **Et quand l'extraction échoue, on garde un ÉCHANTILLON** du texte (300
caractères, seulement dans ce cas) sur la ligne de l'offre : la prochaine session
calera les motifs sur du vrai au lieu de deviner (méthode §5.24 → §5.26).

### 3. ⚠️ LE TEXTE UTILE, PARTOUT — une seule règle (§11)
`texteUtile(mail)` (posé la veille pour les colis) écarte un `text` qui n'est
qu'une feuille de style — certains services de réception en livrent une à la
place du message. **Seule `parseCarrierEmail` l'utilisait.** Les branches
vente / achat / offre / message / favori lisaient encore `mail.text` brut : sur
ces emails-là elles ne trouvaient **ni montant, ni acheteur, ni article**.
`const corpsTexte = texteUtile(mail)` est calculé **une fois** dans le handler et
utilisé par toutes les branches — y compris les **clés de déduplication**
(`shortHash`), qui sinon se calculaient sur du CSS identique d'un email à l'autre.

### 4. ⚠️ UN BUG QUE LE BUILD NE POUVAIT PAS VOIR
En factorisant, `detecterTransporteur` (fonction **pure**) s'est mise à lire
`corpsTexte`, une variable du **handler**. `npm run build` passe (le fichier
`api/` n'est pas dans le bundle) et `node --check` aussi (la syntaxe est bonne) :
c'est **`scripts/audit-transporteurs.cjs` qui l'a attrapé**, en l'exécutant
vraiment. La fonction relit désormais son texte elle-même.
➡️ **Une fonction serverless n'est vérifiée que si un banc l'EXÉCUTE.**

### 5. Le numéro en double remonte dans la cloche
Le N°4 est porté par **deux annonces en ligne** depuis des semaines. C'était
signalé sur l'écran Annonces — encore fallait-il y aller. C'est une chose **à
faire**, donc sa place est dans le centre de notifications :
« 🚨 N numéros portés par deux annonces (N°4…) — la mauvaise paire peut partir »,
qui mène à l'écran Annonces.
⚠️ Rien n'est corrigé automatiquement (un numéro ne bouge plus tout seul, §5.45) :
on **montre**, il tranche.

### Vérifié
`npm run build` OK · **`scripts/audit-offres.cjs`** (nouveau) : 8 formulations +
le cas « le prix de l'article vient avant l'offre » + « du CSS ne fabrique ni
montant ni acheteur » + « toutes les branches lisent le même texte utile » —
**10/10** · `audit-transporteurs` 23/23 (il a trouvé le bug du point 4) ·
`audit-email-formes` 15/15 · `audit-qr` 5/5 · `audit-identite` 30/30 ·
`audit-coherence` 0 désaccord · banc cloche (fixture : deux annonces au même
numéro) → **« 🚨 2 numéros portés par deux annonces (N°4, N°15) »** rendu, et le
N°4 est le VRAI doublon de la base · smoke 12 écrans **0 PAGEERROR, 0 artefact**.

---

## 5.47 — LA SAISIE EN SÉRIE DES PRIX D'ACHAT (le défaut de données le plus coûteux)

Relevé du 23 août, après tous les correctifs de la journée :

| | |
|---|---|
| paires numérotées | **210** |
| **avec un prix d'achat** | **0** |
| ventes finalisées | **231** · CA **6 717,69 €** |
| ventes du mois (hors annulées) | 83 · 2 816 € (l'app publiait 81 / 2 792 € — écart = les ventes captées depuis) |
| factures | 0 · cases de garage occupées | 0 |

➡️ **Tout le bénéfice, la marge, la « meilleure marque » et le rapport comptable
tournent avec un COÛT DE ZÉRO**, sur 231 ventes et 6 717 € de CA. C'est le
défaut ouvert depuis §22, et il n'a jamais bougé.

### Pourquoi ça ne se remplissait pas — ce n'est pas de la paresse
Julien a dit « je vais tout remplir manuellement ». Ce qui l'en empêche, c'est le
**geste** : ouvrir chaque carte de l'écran Annonces, viser un petit champ, taper,
recommencer — 210 fois, en cherchant les paires une par une. Le rapprochement
automatique est exclu depuis §22/§5.23/§5.38 (un prix d'achat faux ne se voit
jamais et fausse la marge pour toujours).

### Ce qui est livré : `fillBuyRows` + la modale « Prix d'achat à compléter »
**Une seule liste, un champ par ligne, Entrée passe à la suivante.**
- **Les paires VENDUES d'abord, au CA décroissant** — ce sont elles qui faussent
  vraiment la compta. Mesuré au banc : N°11 (84 €), N°3 (77 €), N°21 (60 €)…
  Vingt minutes de frappe redressent l'essentiel.
- Chaque ligne : vignette, N°, titre, et ce que la paire pèse (« vendue 84,00 € »,
  « en ligne · 45,00 € », « plus en ligne »).
- `ChampSaisie` (§5.44) gagne **`apresEntree`** : Entrée valide **et** donne le
  focus au champ suivant. C'est ce qui rend une longue liste tenable au clavier.
- Écriture par `setBuyForKey(key, val)` sur `vinted_annonce_numeros[key]`, avec la
  règle existante : **une saisie manuelle efface le lien vers un achat**
  (`buyFromId`/`buyFrom` à `null`), sinon la carte afficherait un achat sans
  rapport avec le chiffre saisi.
- L'impact de chaque paire est calculé par **IDENTITÉ** (`identiteAnnonce` : id
  d'annonce Vinted, sinon photo) — **jamais par titre** (§5.34).

⚠️ **Aucune saisie automatique** : c'est lui qui tape. La règle « mieux vaut un
blanc qu'un faux » est intacte.

### Deux portes d'entrée, là où le manque se constate
- écran **Ventes**, sur l'alerte « X ventes finalisées sans prix d'achat » →
  bouton **« 💶 Tout compléter d'un coup »** (l'ancien « Les compléter → », qui ne
  faisait que filtrer la liste, devient « Voir la liste ») ;
- écran **Annonces** → ⋯ Outils → **« Compléter les prix d'achat »**, avec le
  compte de paires concernées.

### Vérifié
`npm run build` OK · banc dédié (`fillbuy.cjs`, vraies données) : le bouton ouvre
la modale, **196 paires listées et 196 champs**, triées par CA décroissant
(84 € / 77 € / 60 €), un prix tapé au clavier est **enregistré**, et **Entrée
donne bien le focus au champ suivant** — **0 erreur d'app**.

### 5.47 (suite) — LES CODES 9195 / 6121 : CHERCHÉS PARTOUT, INTROUVABLES — et POURQUOI

Julien : « j'ai deux codes de rappel, 9195 et 6121, regarde si tu les trouves
dans les mails ».

**Cherchés dans les trois endroits possibles, à la chaîne brute :**
| où | résultat |
|---|---|
| 109 lignes `email_track_*` (`code` et `code2`) | **absents** |
| 444 lignes de quarantaine restantes (recherche brute dans le JSON entier) | **absents** |
| 26 lignes `email_inconnu_*` (corps conservé) | **absents** |

➡️ **Ces deux emails ne sont jamais arrivés jusqu'à l'app.** Ce n'est pas un
défaut de lecture — le corps brut est fouillé, chiffre par chiffre.

### ⚠️ ET LA CAUSE EST MAINTENANT NOMMÉE : DEUX COMPTES NE REÇOIVENT RIEN
Croisement des 8 comptes Vinted reliés avec les emails réellement reçus :

| compte | emails reçus |
|---|---|
| julatace35260 | 184 |
| llloollllaa | 127 |
| julienf765 | 112 |
| tomj683 | 87 |
| julatace3535 | 23 |
| liliand653 | 2 |
| **tomj606** | **0** ⚠️ |
| **angeled92** | **0** ⚠️ |

**`angeled92` a 4 annonces en ligne et 91 € en attente** — c'est un compte
vivant, et **aucun** de ses emails n'atteint l'app. Ses codes de retrait ne
peuvent donc pas y être. Adresses de réception observées : `shopcancale35@`,
`lolanisse35@`, `tomjeancanc35@`, `vinted35260@icloud`, `traces_etage_3i@icloud`,
un `privaterelay`.

### Le panneau « 📬 Ce qui arrive dans l'app » (onglet Achats, ouvert par défaut)
Remplace le `<details>` replié de §5.44 et répond aux trois demandes du jour :
- **une ligne par transporteur**, Chronopost / Mondial Relay / **Vinted Go**
  **toujours affichés même à zéro**, avec le nombre de **colis à retirer** et la
  date du dernier email ;
- **une ligne par compte Vinted** avec le nombre d'emails reçus et la fraîcheur —
  et, en rouge, **la liste de ceux qui ne reçoivent rien** avec ce que ça
  implique (« leurs codes de retrait n'arrivent jamais ici ») ;
- le compte des emails **non classés** (26 à ce jour — évaluations, « commande
  mise à jour », « a mis en ligne un nouvel article », newsletters : aucun colis).

⚠️ Aucune requête pour les dates de colis (elles viennent des suivis déjà
chargés) ; deux lectures **scalaires** pour le reste (§34).

**Vérifié au rendu réel** (banc Achats, vraies données) : les 5 transporteurs
listés, les 8 comptes listés, **« 2 comptes ne reçoivent aucun email (tomj606,
angeled92) »**, 2 colis à retirer et « 2 paires connues ». **0 erreur d'app.**

---

## 5.48 — LE BORDEREAU PROPOSÉ DÈS L'ARRIVÉE SUR VINTED + le PDF qui arrive vraiment

Julien : « dès que je me connecte sur un compte Vinted, **sans même avoir ouvert
l'extension**, s'il y a une vente, propose de générer et d'envoyer le bordereau
dans l'app. Et je veux que la transmission du bordereau dans l'app soit
automatique dès qu'il est généré, il ne doit pas y avoir d'erreur. »

### 1. La proposition, sur la page, sans ouvrir le panneau
`visiteVinted()` (déjà déclenchée à chaque chargement d'une page Vinted, §5.19)
appelle désormais **`proposerBordereaux(uid)`** :
- `ventesSansBordereau(uid)` lit la moisson (`aGenererBordereau`) et **écarte**
  ce qui a déjà un bordereau — reçu par email (`email_bord_*`) ou déjà capté
  (`harvest_{uid}_label_*`). **Aucun appel Vinted** : lecture seule.
- Le service worker envoie la liste à l'onglet ; `vinted-panel.js` affiche une
  **carte flottante au-dessus du FAB** (panneau fermé), une ligne par vente :
  photo, titre, bouton **« 📄 Générer »**. Un clic → génération **et** envoi du
  PDF dans l'app, avec le compte rendu sur la ligne (« ✅ dans l'application »).
- ⚠️ **C'est une PROPOSITION, pas une génération automatique** — générer, c'est
  agir sur Vinted, ça reste son clic (§5.32). Et **seulement pour le compte
  connecté dans cet onglet** : agir au nom d'un autre est LE signal multi-comptes
  que Vinted sanctionne (§48).
- ⚠️ **Une seule proposition par vente et par 20 h** (`vrmPropose`, mémo local) :
  sans ça, ça devient un bandeau qu'on ne voit plus.

### 2. Le PDF n'existe pas à la milliseconde où Vinted accepte
C'était la cause des « bordereaux générés mais pas dans l'app » : le service
d'expédition **fabrique** le PDF puis le dépose sur S3. Un seul essai juste après
la génération tombait souvent sur « pas encore d'URL », et le bordereau
n'arrivait qu'à la visite suivante — voire par email.
**`recupererLabelInsiste`** réessaie (1,5 s → 4 s → 9 s), et **uniquement sur les
échecs transitoires** (« pas donné l'URL », « n'expose pas encore l'expédition ») :
un refus dur (permissions, PDF vide, 4xx) ne s'arrangera pas en attendant, on
n'insiste pas. Branchée aux **trois** chemins : génération automatique,
`genererBord` et `recupBord` du panneau.
⚠️ Ce **n'est pas** un rythme « faussement humain » (toujours refusé, §32) :
c'est attendre qu'un fichier soit prêt, sur UNE vente, après SON action.

### 3. ⚠️ Un helper appelé hors de sa portée, encore
`ventesSansBordereau` lisait la photo via `photoDeCommande` — qui vit **dans**
`buildPanelData`. `node --check` passe (la syntaxe est bonne) et l'erreur ne
serait apparue **qu'au moment d'afficher la proposition**. Lecture inlinée.
C'est la deuxième fois en deux sessions (§5.46 point 4) : **dans ce fichier, un
helper n'est utilisable que dans la fonction où il est déclaré.**

### Vérifié
`node --check` sur les deux fichiers · **`scripts/audit-bordereau-pdf.cjs`**
(nouveau, exécute la VRAIE fonction en `vm`) : **7 cas / 0 non conforme** — prêt
du 1er coup, prêt au 2e, prêt au 4e (dernier), expédition pas encore exposée puis
oui, jamais prêt → abandon après 4, refus dur → **aucun réessai**, PDF vide →
**aucun réessai** · banc panneau : **panneau FERMÉ**, la carte s'affiche avec les
2 ventes et leurs boutons, le clic envoie `genererBord` avec le bon `tx` et le
bon `uid`, et la ligne affiche « ✅ dans l'application » — les 13 onglets sans
erreur (le seul « interactions: 1 » reste l'artefact connu du harnais).
Extension **5.32.0** — à recharger dans Chrome.

---

## 5.49 — « NON COMPRIS » DOIT VOULOIR DIRE QUELQUE CHOSE

Le compteur posé la veille (§5.44) a fait son travail : **28 emails conservés**.
Mais en les classant, aucun n'appelle la moindre action :

| famille | nombre |
|---|---|
| **les emails que Julien ENVOIE lui-même à Vinted** (contestations de blocage) | **11** |
| « Commande mise à jour pour … » | 8 |
| évaluations (« Laisse une évaluation », « X t'a laissé une évaluation ») | 5 |
| « untel a mis en ligne un nouvel article » | 3 |
| newsletter | 1 |
| **vraiment inconnu** | **0** |

➡️ Le panneau annonçait donc « 28 emails non compris » alors qu'il n'y avait
**rien à comprendre**. Un compteur qui crie au loup finit par ne plus être
regardé — c'est le défaut du panneau Garage (§5.14), et il se reproduisait.

### `familleConnue(subject, from)` — reconnaître, sans jeter
Six familles étiquetées. **Rien n'est supprimé** (la règle §5.44 tient) : ces
emails restent conservés, simplement rangés en `connu-sans-action` et **allégés
à 2 Ko** au lieu de 200 (une newsletter n'a pas à peser en base, §34).
⚠️ **« Commande mise à jour » est volontairement SANS ACTION** : les statuts de
commande viennent de la moisson Vinted, **jamais des emails** (§33 — c'était la
source des faux achats). L'étiquette est là pour ne pas le redécouvrir.

### ⚠️ LA MÊME RÈGLE À LA LECTURE (leçon §5.37)
Les 28 lignes déjà en base n'ont pas de champ `famille` et **ne seront jamais
réécrites**. Sans une copie de la règle **côté app**, le compteur aurait continué
d'annoncer 28. `familleEmail` (src/App.jsx) est donc la copie exacte de
`familleConnue` (api/email-inbound.js).
**`scripts/audit-email-formes.cjs` vérifie que les deux tranchent pareil** sur
**12 sujets réels** — dont 5 qui ne doivent **JAMAIS** être rangés « sans
action » : colis Chronopost, offre, vente, bordereau, transaction finalisée.

### Ce que le panneau affiche maintenant
- rien à signaler → une ligne discrète « N emails reconnus sans action à faire » ;
- un email vraiment inconnu → l'alerte orange, avec son sujet.

### Vérifié
`npm run build` OK · `node --check api/email-inbound.js` OK ·
`audit-email-formes` **16 contrôles** (15 formes + les familles) ·
banc Achats avec 5 emails injectés (4 familles connues + 1 vrai inconnu) →
le panneau affiche **« ⚠️ 1 email »**, pas 5 · `audit-offres` 10/10 ·
`audit-transporteurs` 23/23 · `audit-qr` 5/5 · `audit-identite` 30/30 ·
`audit-bordereau-pdf` 7/7 · `audit-coherence` 0 désaccord.

⚠️ **Au passage, une information qui n'est pas technique** : 11 des emails reçus
sont les **contestations que Julien envoie lui-même à Vinted** (« réexamen
humain », « DEMANDE URGENTE »). Sa boîte fait donc suivre aussi son courrier
SORTANT. Ce n'est pas un défaut de l'app, mais ça explique une partie du bruit.

---

## 5.50 — LA DESCRIPTION QUE L'APP NE VOYAIT PAS + le coffre complété + un objectif proposé

Julien : « vas-y, tout est bien à part facture et garage, parce que je n'ai pas
encore eu l'occasion de m'en servir. » ⚠️ **Ni les Factures ni le Garage n'ont
donc été touchés** : ils ne sont pas cassés, juste pas encore utilisés.

### 1. ⚠️ `descLen` ÉTAIT TOUJOURS NUL — le même défaut que les photos (§5.11)
`mapWardrobeItem` calcule `descLen` depuis `it.description`. Or l'allègement
(§23) ne garde **pas** ce champ (il pèse). Donc, sur les **25 annonces en
ligne, aucune** n'était jugée sur sa description : `scoreAnnonce` s'abstient
quand le champ est nul (règle §31, « un champ absent ne retire jamais de
point »), et l'atelier Republier ne conseillait **jamais** dessus.
- **Extension** : `articleMaigre` pose désormais **`descLen`** (un entier, trois
  octets — exactement le motif `nPhotos` de §5.11). Le TEXTE, lui, continue
  d'aller au coffre : c'est là qu'on le recopie pour republier.
- **App** : `mapWardrobeItem` lit `it.descLen` en premier.
- ⚠️ **Et à la lecture, pour l'existant** (leçon §5.37) : les annonces déjà
  captées n'ont pas l'entier et ne seront pas recaptées tout de suite. `loadListings`
  complète depuis **`vinted_item_details`** (les fiches lues sur la page —
  **40 sur 40 portaient leur texte** au moment de la mesure), en ne gardant que
  la **longueur** : le texte complet ne repart jamais dans l'app (§34). Une
  seule lecture, mise en cache, et le filtre `PUB` de §5.08 écarte le texte
  marketing de Vinted.

**Mesuré au banc, dans les deux sens** : avec une fiche de description très
courte posée sur une annonce en ligne, l'écran Republier affiche enfin
**« description courte »** — et **sur le code d'avant, rien n'apparaît**.

### 2. Le coffre ne complétait que ce qu'il archivait
Mesuré : **89 annonces au coffre, 8 avec leur texte**, alors que 40 fiches en
portaient un. `archiverLot` n'enrichissait que les articles du dressing **en
cours** d'archivage : une annonce plus en ligne, ou d'un autre compte, ne
récupérait jamais son texte — et « Republier » annonçait « texte à capter » pour
une paire dont le texte est en base.
➡️ Une seconde boucle repasse sur les lignes **déjà enregistrées** à qui il
manque la description, en n'écrivant que celles qui changent vraiment (égress).

⚠️ **CORRECTION DE MA PROPRE MESURE** — ma première lecture annonçait « coffre :
0 description ». **C'était faux** : je lisais `data->>description` alors que le
champ s'appelle **`desc`**. Le vrai chiffre est **8 sur 89**. Troisième fois de
la journée qu'un de mes scripts ment avant le code (§21) — **vérifier le nom du
champ avant de conclure à un zéro**.

### 3. Un objectif de CA qu'on ne peut plus « oublier de fixer »
`vinted_goal` n'était **pas défini** : la barre d'objectif, la carte de « Ma
journée » et le panneau de l'extension affichaient tous un objectif vide depuis
le début. Un objectif qu'il faut inventer ne se fixe jamais.
➡️ Tant qu'aucun objectif n'existe, l'app en **propose un**, calculé sur SON
historique : la moyenne des **3 derniers mois complets**, arrondie à la dizaine,
avec le chiffre affiché (« Tes 3 derniers mois complets : 1 439 € en moyenne »)
et un bouton **« 🎯 Viser 1 440 € »**. Un clic. ⚠️ Rien n'est écrit tout seul, et
**rien n'est proposé sous 2 mois complets d'historique** — un objectif tiré d'un
seul mois n'est qu'un hasard.

### Vérifié
`npm run build` OK · `node --check background.js` OK · banc objectif : bloc rendu,
proposition **1 439 € → « Viser 1 440 € »**, clic → `vinted_goal = 1440` · banc
description : « description courte » affiché, **absent sur le code d'avant** ·
`audit-email-formes` 16 · `audit-offres` 10/10 · `audit-transporteurs` 23/23 ·
`audit-qr` 5/5 · `audit-identite` 30/30 · `audit-bordereau-pdf` 7/7 ·
`audit-coherence` 0 désaccord · smoke 12 écrans **0 PAGEERROR**.
⚠️ Piège de banc : le bloc objectif vit dans « Analyse de tes ventes »,
**repliée par défaut** — sans l'ouvrir, on mesure un artefact et on conclut à
tort que le bloc n'existe pas.

---

## 5.51 — LE PLAFOND DES 1 000 LIGNES, `updated_at` QUI MENT, ET LES PAIRES BICOLORES

Julien : « vas-y, fais tout — et avant de faire, fais-moi une énorme liste de
choses à améliorer que tu peux faire, prends ton temps. » ⚠️ **Factures et Garage
exclus** (« tout est bien à part facture garage parce que j'ai pas encore eu
l'occasion de m'en servir ») : ils ne sont pas cassés, juste pas encore utilisés.

Liste établie **en mesurant la base d'abord**, puis exécutée. Trois défauts réels
trouvés, un faux positif écarté, un chantier laissé à son arbitrage.

### ⚠️⚠️ 1. SUPABASE PLAFONNE UNE RÉPONSE À 1 000 LIGNES, SANS LE DIRE
Relevé du 23 août : **2 447 lignes** dans `app_data`, dont **1 127 `harvest_*`**
et **1 211 `email_*`**. PostgREST renvoie **au plus 1 000 lignes** par requête et
ne signale rien : on reçoit une liste complète en apparence, tronquée en réalité,
**coupée par ordre d'identifiant** — c'est donc toujours la même fin de liste qui
disparaît.

⚠️ **MESURÉ, pas supposé — et l'écart d'AUJOURD'HUI est plus petit que le pire
cas** (je le dis parce que la tentation était d'annoncer le pire cas) :

| lecture | lignes lues avant → après | impact réel mesuré le 23 août |
|---|---|---|
| fraîcheur des comptes (`VintedAccounts`) | **1 000 → 1 115** | **aucun compte ne disparaît** (les 10 sont vus dans les deux cas) ; **2 comptes** avaient une fraîcheur légèrement en retard |
| réparation auto des comptes bloqués (§5.09) | 1 000 → 1 115 | même lecture, même écart : une fraîcheur en retard peut faire rater la fenêtre de 7 jours |
| « dernier email reçu » (Réglages) | **1 000 → 1 055** | **« dernier email » était en retard de 12 minutes** (12:44 au lieu de 12:56) ; aucune famille ne disparaît |

Le correctif est donc **préventif autant que curatif** : l'écart d'aujourd'hui est
mineur, mais il **grandit avec la base** (2 447 lignes et ça monte tous les
jours), et il est **silencieux** — rien, dans la réponse, ne dit qu'elle est
tronquée.

➡️ **`lireTout(query)`** (module-level) pagine avec l'en-tête `Range`, page de
1 000, jusqu'à recevoir moins d'une page pleine ; garde-fou à 20 pages. Les trois
lectures y passent, et écartent au passage les lignes vidées
(`data->>supprime=is.null` — **168 lignes** en base, dont 155 de quarantaine
rejouée, relues pour rien à chaque ouverture).
⚠️ **C'est le même plafond qui a faussé une de MES mesures ce jour-là** (§21) :
j'ai d'abord annoncé « 1 000 lignes en base » avant de paginer et d'en trouver
2 447. Un plafond silencieux ressemble exactement à une donnée absente.

### ⚠️ 2. LA COLONNE `updated_at` MENTAIT SUR 9 ÉCRITURES SUR 10
`app_data` n'a **aucun trigger** (§15) : sans estampille explicite, la colonne
garde la date de **création** de la ligne. Sur les 10 upserts de l'app, **9**
l'omettaient.
- `widget_stats` : colonne **21 juillet**, `data.updatedAt` **23 août 12:44**.
- `push_subs` : colonne **16 juillet**, `data.updatedAt` **23 août 12:44**.

➡️ **Les deux figuraient dans ma liste comme « périmés ». Les deux étaient
frais.** Ce sont deux faux diagnostics que j'ai attrapés en vérifiant AVANT de
coder — et que j'aurais livrés en corrigeant « à l'œil ».
➡️ Correctif à **un seul endroit** (§11) : **`withOwner`** estampille désormais
`updated_at` sur toute ligne écrite, y compris celles ajoutées plus tard. Une
valeur déjà posée par l'appelant gagne.

### 3. LES JETONS VINTED NE PARTENT PLUS DANS LA LIGNE PARTAGÉE
La ligne `main` fait **138,4 Ko** et repart **EN ENTIER** à chaque sauvegarde
(`cloudPush` remplace `data`). Détail : `vinted_annonce_numeros` 78,5 Ko ·
`vinted_sale_overrides` 16,8 Ko · **`vinted_accounts` 15,9 Ko** ·
`vinted_stock_vinted` 11,3 Ko · `vinted_txn_link` 5,4 Ko.

`vinted_accounts` y était copié **avec `access_token` et `refresh_token`** des
8 comptes — 11 % de la ligne, renvoyés à chaque frappe validée — alors que cette
copie ne sert qu'à **afficher** les comptes avant que le réseau réponde ; la
source des jetons est la **table** `vinted_accounts`, relue au démarrage.
➡️ **`ALLEGER_AVANT_CLOUD`** : la copie qui part dans le nuage ne garde que
`id / vinted_user_id / login / domain`.
⚠️ **Et `cloudLoad` n'écrase plus cette clé** : sans ça, un chargement du nuage
aurait retiré les jetons du localStorage de l'appareil jusqu'à ce que la table
réponde — donc un « Synchroniser » en échec dans les premières secondes.

### ⚠️ 4. LE SÉLECTEUR D'ACHAT ÉTAIT AVEUGLE SUR LES PAIRES BICOLORES
§5.38 avait ajouté la couleur au score (même couleur +4, couleurs différentes
−8). Mais `extractColor` rend **une couleur ou rien**, et rend `null` dès qu'un
titre en porte deux — « on ne se prononce pas ». Conséquence non vue à l'époque :
une paire **bicolore désactivait complètement le test**, bonus ET pénalité.

Mesuré en exécutant les VRAIES fonctions sur les **212 paires numérotées** et
**318 achats** — 2 des 10 premières suggestions étaient fausses, pile au seuil
de 12 :
| paire | achat « suggéré » | pourquoi ça passait |
|---|---|---|
| « Nike zoom fly 5 **noir violet** 41 » | « Nike zoom fly 5 maat 41 **ORANJE** » | bicolore → aucun test de couleur (4+4+5+1 = 14) |
| « Adidas Spezial **noir et vert** 38 » | « Adidas Spezial **BLU** n. 38 » | idem |

➡️ **`extractColors(text)`** rend **toutes** les couleurs reconnues, et le score
compare des **ensembles** : une couleur commune rapproche (+4, « bleu marine » ↔
« blu »), **aucune couleur commune écarte** (−8). Un côté sans couleur reconnue
ne pèse ni dans un sens ni dans l'autre. `extractColor` reste, définie à partir
de `extractColors`.

**Mesuré après correction, sur les mêmes données** : les deux fausses
suggestions **disparaissent**, et plusieurs paires récupèrent un **meilleur**
candidat en tête (« Spezial noir et vert » → « Spezial **schwarz** » au lieu de
« blu » ; « Spezial bleu marine Lila » → « Spezial **bleu** »). Total : 62 → 63
paires avec au moins un candidat suggéré — **moins de faux, pas moins d'aide**.

### ⚠️ 5. LE REÇU D'ACHAT POUVAIT ÊTRE CELUI D'UN AUTRE ACHAT
`receiptFor(o)` rattache le **vrai reçu Vinted reçu par email** à un achat —
c'est un document comptable, pas un ornement. Il cherchait dans cet ordre :
n° de transaction → titre exact → **titre « contenu » dans l'autre**
(`.includes`). Les deux derniers niveaux sont des ressemblances, exactement ce
que §5.39 a retiré partout ailleurs — et ils étaient restés là.

**Mesuré sur les 48 reçus réels :**
| | |
|---|---|
| reçus portant un n° de transaction | **0 / 48** — la voie certaine ne marche **jamais** |
| reçus dont le titre est « contenu » dans celui d'un autre | **22 / 48** |
| titres en double parmi les reçus | 2, dont **« est conforme à sa » ×16** |

### 6. ⚠️ ET LA CAUSE DU CHARABIA : les deux-points étaient FACULTATIFS
L'extraction du titre d'article (`api/email-inbound.js`, branche achat) avait
pour seconde alternative `(?:achet[ée]e?\s*:?\s*|article\s*:?\s*)([^…]{4,70})`
— **les deux-points optionnels**. Donc n'importe quelle phrase contenant le mot
« article » était capturée comme titre.

**Preuve, en exécutant l'ANCIEN code sur des phrases types** — il rend
exactement les chaînes trouvées en base :
| texte de l'email | ancien code | nouveau |
|---|---|---|
| « L'**article** est conforme à sa description. » | `"est conforme à sa description."` (16 fois en base) | `""` |
| « Les **articles** sont dans leur état d'origine. » | `"s sont dans leur état d"` (2 fois en base) | `""` |
| « Ton **article** te plaît ? Laisse une évaluation » | `"te plaît ? Laisse une évaluation"` | `""` |
| « **Achat :** Salomon XT-6 » | `""` (raté !) | `"Salomon XT-6"` |

➡️ Deux formes acceptées, et deux seulement : le titre **entre guillemets**
après « commande », ou une **vraie étiquette suivie de deux-points**
(`Article :`, `Achat :`, `Articles achetés :`). Sinon **pas de titre**.
⚠️ Ça ne répare pas les 48 lignes déjà en base (l'email ne repassera pas), mais
combiné au point 5, un titre-charabia ne peut plus attraper de reçu.

➡️ Règle §5.39 appliquée ici aussi : **transaction unique, sinon titre
strictement égal ET unique, sinon rien**. Le `.includes` est supprimé. La
fonction rend donc `null` plus souvent — c'est le comportement voulu : mieux
vaut aucun reçu que le reçu d'une autre paire.

### Ce que je n'ai PAS fait, et pourquoi
- **`vinted_stock_vinted` (1 815 entrées, 11,3 Ko à chaque sauvegarde)** : §22 le
  donnait pour « un écran retiré ». **Faux** — le composant `StockVinted` existe
  toujours, la clé est **lue ET réécrite** par deux effets de réconciliation
  vivants. La retirer de `SYNC_KEYS` l'**effacerait du nuage** (`cloudPush`
  remplace toute la ligne) et arrêterait le partage entre appareils. C'est une
  décision qui lui appartient (§22 le disait déjà), pas un nettoyage.
- **Les notifications** : rien à réparer. `push_subs` porte 2 appareils et se
  réécrit à chaque ouverture (voir point 2) ; `push_prefs` est absent, donc les
  défauts de §5.41 s'appliquent — 5 catégories sur 10, ce qui est le
  comportement voulu.
- **Le prix plancher des offres** (0 posé sur 212 offres) : le calcul du montant
  à proposer appartient **au panneau de l'extension** (`remiseLigne`, §5.02).
  En écrire un second dans l'app, c'est deux règles pour une même notion (§11) —
  donc deux chiffres qui finiront par se contredire.

### Ce qui reste dans SES mains (mesuré, pas corrigeable par le code)
| | |
|---|---|
| **212 paires numérotées, 0 prix d'achat** | 231 ventes / **6 717,69 €** calculées avec un coût de zéro. L'outil de saisie en série existe (§5.47) ; **63 paires** ont désormais une suggestion fiable à un tap. |
| **le N°4 porté par deux annonces en ligne** | « adidas spezial noir 35,5 » et « 3 manuels première ST2S » — signalé dans la cloche |
| **`tomj606` et `angeled92` ne reçoivent aucun email** | `angeled92` a 4 annonces en ligne et 91 € en attente : ses codes de retrait n'arrivent jamais |
| **`vinted_goal` toujours vide** | l'app propose 1 440 € (moyenne de ses 3 derniers mois), un tap |

### Vérifié
`npm run build` OK · **`scripts/audit-identite.cjs` passe à 38 contrôles**, dont
**8 nouveaux qui échouent bien sur le code d'avant** (§21) : lecture des couleurs
en ensemble, score par ensembles, ancien test unique disparu, pagination des
lectures > 1 000 lignes, helper `lireTout` avec l'en-tête `Range`, estampille
`updated_at` · `audit-coherence` 5 règles / **0 désaccord** · `audit-qr` 5/5 ·
`audit-offres` 10/10 · `audit-transporteurs` 23/23 · `audit-email-formes` 17/17 ·
`audit-bordereau-pdf` 7/7 · smoke app **12 écrans, 0 PAGEERROR, 0 artefact**.

---

## 5.52 — ⚠️ L'INSTRUMENTATION DÉTRUISAIT SES PROPRES PREUVES + 6 REQUÊTES PAR VISITE DANS LE VIDE

Julien : « améliore d'autres choses, propose-moi des améliorations ». Méthode
habituelle : lire la base d'abord. Le compteur `panel_diag_capture` (posé en §46,
relevé du 24 août 08:29) répond à deux questions ouvertes depuis des semaines.

```
recu_item = 73   ·   abandon_json_item = 73   ·   ecrit_item = 0
label_url_trouve = 1  ·  label_url_introuvable = 1
rates = {}      ← ⚠️ vide, alors qu'il devrait expliquer les 73 échecs
```

### 1. ⚠️ `noterDiag` EFFAÇAIT `rates` — on comptait les échecs sans pouvoir les expliquer
La ligne `panel_diag_capture` porte deux choses : `n` (les compteurs, écrits par
`noterDiag`) et `rates` (**un échantillon de réponse ratée par type**, écrit par
`echantillonRate`). C'est ce couple qui avait fini par expliquer la fiche article
(§5.24 → §5.26) : le compteur dit COMBIEN, l'échantillon dit POURQUOI.

Or `noterDiag` réécrivait la ligne avec **`{ n, majAt }` seulement** — donc il
supprimait `rates`. Et comme il part **à chaque capture** (des centaines de fois
par jour) alors qu'un échantillon n'est posé que **sur un échec**, la preuve
était détruite dans la minute. D'où `rates: {}` en base avec 73 échecs comptés.

➡️ `noterDiag` réécrit désormais **toute la ligne** (`{ ...tout, n, majAt }`).
⚠️ **La leçon dépasse ce cas** : une instrumentation qui réécrit sa propre ligne
doit préserver ce qu'elle n'a pas produit, sinon elle efface exactement ce qu'on
lui demande de garder — et on passe des semaines à re-poser des sondes qui
existaient déjà.

### 2. ⚠️ 6 REQUÊTES PAR VISITE VERS UN ENDPOINT MORT (73 échecs sur 73)
`inject.js` demandait à chaque passage sur Vinted le détail de **6 annonces**
(`GET /api/v2/items/{id}`), avec une pause de 0,9–2,2 s entre chacune, pour
récupérer la DESCRIPTION. Bilan mesuré : **73 tentatives, 73 échecs, 0 ligne
écrite**. La cause est connue depuis §5.26 — Vinted renvoie sur cette URL une
**page d'erreur HTML avec un statut 200**, donc `apiGet` la laisse passer et
`JSON.parse` casse.

Ce que ça coûtait à **chaque** visite : 6 appels inutiles, **6 à 13 secondes** de
retard sur la vraie moisson, et 6 requêtes de plus dans l'empreinte du compte —
le signal qu'on passe justement notre temps à réduire (§5, §48).

➡️ La boucle est **retirée** (et `wardrobeIds`, devenue morte, avec elle).
⚠️ **Rien n'est perdu** : la description arrive par la **lecture de page**
(`readListingDetailFromPage` → `vinted_item_details`), qui fonctionne — c'est
elle que le coffre et « Republier » lisent (§5.10, §5.50). Le bouton manuel
« 📥 Récupérer le texte » reste là : si Vinted rétablit l'endpoint, il l'écrira
tout seul. **Ne pas remettre la boucle sans avoir vu `ecrit_item > 0`.**

### Ce que le relevé dit d'autre (pas de correctif nécessaire)
| compteur | lecture |
|---|---|
| `ignore_partiel_orders_purchased = 49` · `_inbox = 48` · `_listings = 20` | le garde-fou anti-partiel (§5.19) refuse constamment des captures tronquées — **il travaille**, ce n'est pas un défaut |
| `ignore_billing_hors_sujet = 24` | le garde-fou porte-monnaie (§5.27) écarte bien les réponses qui n'en sont pas |
| `label_url_trouve = 1` / `introuvable = 1` | la chaîne du PDF de bordereau **a fonctionné au moins une fois** — première observation réelle depuis §5.29. L'échec restant s'expliquera tout seul maintenant que `rates` survit. |

### Vérifié
`node --check` sur `inject.js` et `background.js` · **`scripts/audit-diagnostic.cjs`**
(nouveau) exécute le VRAI `noterDiag` avec des stubs : **5 contrôles**, dont
**4 qui échouent bien sur le code d'avant** (§21) · banc panneau : la carte de
proposition de bordereau rend et envoie toujours le bon message, **16 onglets,
0 erreur d'app** (les 2 « échecs » restent les artefacts connus du harnais :
l'onglet `reponse` n'existe que sur une page de conversation, et le clic sur un
élément filtré `display:none`). Extension **5.34.0**.

---

## 5.53 — ⚠️ SÉCURITÉ : le dépôt est PUBLIC, et il portait une vraie clé privée

Julien : « ne laisse pas d'informations dans le code source et sécurise bien le
site Internet… il faut que je puisse bientôt pouvoir louer ». Vérifié avant de
coder — et le constat est sérieux.

### 1. ⚠️⚠️ Ce qui était lisible par n'importe qui sur GitHub
Le dépôt `julatace/cancale-v67` est **public** (`"private": false`, vérifié par
l'API). Y étaient écrits en clair :

| | pourquoi c'est grave |
|---|---|
| **la clé PRIVÉE VAPID** (`ayc_z_…`, en repli dans `api/_lib/push.js`) | un **vrai secret** : n'importe qui pouvait envoyer une notification sur les téléphones de Julien |
| **nom + email + adresse postale d'une VRAIE CLIENTE** (placeholders du formulaire de facture) | donnée personnelle d'un **tiers**, publiée |
| l'email personnel de Julien | idem |
| raison sociale + adresse + **SIRET**, en valeur par DÉFAUT | un nouveau vendeur ouvrait l'app avec l'entreprise de quelqu'un d'autre pré-remplie sur ses factures |

**Fait** : paire VAPID **régénérée** (l'ancienne est morte), la privée vit
désormais **uniquement** en variable d'environnement, **sans aucun repli** —
sans elle on n'envoie rien et on le dit (`pushConfigure`), plutôt que de repartir
sur une clé connue de tous. Données personnelles remplacées par des exemples
neutres. Identité d'entreprise → **`ENTREPRISE_VIDE`**.
⚠️ **Conséquence à dire à Julien** : ses infos d'entreprise n'étaient sauvegardées
**nulle part** (ni localStorage ni cloud — vérifié : `vinted_invoice_settings`
est absent de la ligne `main`). Elles ne vivaient QUE dans le code. Il doit donc
les ressaisir **une fois** dans Réglages → Factures.

### 2. ⚠️⚠️ LA PORTE GRANDE OUVERTE SUR INTERNET
`MULTI_USER = true` et `CLOISONNE = false` : l'écran de connexion s'affiche, et
il portait un bouton **« Entrer sans compte (temporaire) »** — visible de tout le
monde, sur une adresse publique. Un clic donnait accès à **toute la boutique** :
ventes, achats, noms d'acheteurs, codes de retrait, comptes Vinted reliés.

La porte existait pour une bonne raison (§12 : ne jamais enfermer Julien dehors à
cause d'un email de confirmation qui n'arrive pas). Elle demande maintenant un
**CODE**, dont seule l'**empreinte SHA-256** est dans le code source
(`CODE_ACCES_HASH`) — une empreinte ne se remonte pas.
⚠️ **Aucun risque d'enfermement** : les appareils déjà entrés gardent leur accès
(le drapeau `vrm_acces_direct` vit dans leur navigateur). **Vérifié au banc dans
les deux sens** : inconnu → écran de connexion, bouton libre disparu, mauvais
code refusé, bon code accepté ; appareil déjà autorisé → entre directement.

### 3. Ce qu'on ne peut PAS cacher, et pourquoi on ne fait pas semblant
`SUPABASE_URL`, la clé « anon » et l'URL du script de factures sont **livrées au
navigateur** : une application web ne cache rien à celui qui l'ouvre. Les mettre
en variable d'environnement les retire du dépôt, **pas du bundle**.
➡️ Ce qui les rend inoffensives, c'est **RLS**. Tant qu'il est désactivé, cette
clé n'est pas une clé publique : c'est un **accès complet lecture/écriture** à
toute la base, y compris la table `vinted_accounts` et ses **jetons de session
Vinted**. Ce n'est pas une hypothèse — toute la mise au point de ce projet s'est
faite en lisant la vraie base avec cette seule clé, prise dans le dépôt public.

**Les deux gestes qui referment ça, et que SEUL Julien peut faire** :
1. **passer le dépôt en privé** (un clic, gratuit, réversible, sans effet sur
   Vercel) ;
2. **appliquer la migration RLS** (`supabase/migrations/001-multi-utilisateurs.sql`).

`SECURITE.md` (nouveau) dit tout ça noir sur blanc, pour pouvoir être montré à
quelqu'un qui envisage de louer l'outil. `.env.example` documente chaque
variable, sans aucune valeur.
**`scripts/audit-secrets.cjs`** (nouveau) refuse toute réapparition : clé privée,
email personnel, SIRET, adresse postale. Les 4 règles **échouent bien sur le code
d'avant**.

### 4. L'onglet « Republier » de l'app est RETIRÉ
Julien : « l'onglet republier sur l'application ça sert à rien, tu peux
l'enlever. » Il faisait doublon avec le panneau de l'extension, qui lui travaille
**sur Vinted**, là où le geste est possible (texte du coffre, photos recadrées,
formulaire pré-rempli, suppression de l'ancienne — §5.07). Ici, on notait une
annonce sans rien pouvoir appliquer.
Retirés ensemble : l'entrée de la barre, l'écran, la modale d'édition et les
calculs qui n'existaient que pour eux (`scoreAnnonce`, `repubList`, `peerPrice`,
`aiRewrite`, l'état des brouillons). **≈ 740 lignes.**
⚠️ La clé `vinted_annonce_drafts` **reste dans `SYNC_KEYS`** : `cloudPush`
remplace toute la ligne, donc la retirer **effacerait** ses brouillons du nuage.
On ne supprime pas des données au passage d'un écran. Le panneau de l'extension
n'est **pas** touché.

### 5. ⚠️ LA BARRE DU BAS NE DÉFILE PLUS
Julien : « je dois glisser de gauche à droite en bas pour voir toutes les
interfaces ». C'était exact : **neuf onglets** dans un conteneur
`overflow-x: auto` — sur un téléphone, Garage et Factures étaient hors écran, sur
une barre dont rien n'indiquait qu'elle défilait.
Une barre d'onglets qui défile, c'est le signe qu'il y a trop d'onglets. Elle
porte désormais les **cinq écrans du quotidien** (Ma journée · Annonces · Ventes ·
Achats · Colis) + **« Plus »**, une feuille qui monte du bas avec Statistiques,
Messages, Garage et Factures. « Plus » s'allume quand l'écran affiché vient de
derrière — sinon on ne saurait plus où on est.
**Mesuré au banc à 320, 390 et 430 px** : `scrollWidth === clientWidth` sur les
trois, **et la page elle-même ne défile plus horizontalement**. La feuille
s'ouvre, liste les 4 écrans et se referme au clic.

### Vérifié
`npm run build` OK · **9 audits au vert** (`secrets` nouveau, `identite` 38,
`coherence`, `qr`, `offres`, `transporteurs`, `email-formes`, `bordereau-pdf`,
`diagnostic`) · banc barre du bas (3 largeurs) · banc porte d'accès (5 contrôles,
dans les deux sens).

### ⚠️ CE QUI RESTE, ET QUI N'EST PAS DU CODE
| à faire | par qui |
|---|---|
| **dépôt en privé** | Julien (un clic) |
| **migration RLS** | Julien (coller le SQL) |
| `VAPID_PRIVATE_KEY` sur Vercel (sinon plus aucune notification) | Julien |
| ressaisir son entreprise dans Réglages → Factures | Julien |
| `SUPABASE_SERVICE_KEY` + `VRM_OWNER_UID` avant d'activer RLS | Julien |

---

## 5.54 — REFONTE VISUELLE, PHASE 1 : arrêter de crier

Julien : « on dirait vraiment un site fait par intelligence artificielle, fais
quelque chose de professionnel… là ça ne me convient pas du tout ».

Méthode : **regarder l'écran** (captures du banc §20) avant de toucher au code,
puis mesurer ce qui produit l'impression.

### ⚠️ 1. UN `>` S'AFFICHAIT EN HAUT DE CHAQUE ÉCRAN
Trouvé en inspectant le DOM, pas le code : un nœud de texte `>` en tout premier
enfant du conteneur racine. Cause — la balise ouvrante du conteneur se terminait
par **`}}>>`** : le premier `>` ferme la balise, le second devient du texte.
Il était là sur **tous les écrans, tous les appareils**. C'est exactement le
genre de détail qui fait « pas fini ». Une ligne.

### 2. Le diagnostic, en chiffres
**693 emojis** dans du code non commenté (⚠️ 70 · ✓ 44 · 📦 42 · 💸 20 · ✅ 20 …).
Mais le vrai défaut n'est pas leur nombre : c'est que **tout est un encadré
teinté**. Sur l'écran Ventes on comptait, empilés : un bloc rouge, un vert, un
ambre, trois gris, **un bandeau en dégradé violet/rose**, un autre ambre. Quand
tout crie aussi fort, plus rien ne ressort — et l'œil lit « fabriqué à la
chaîne ».

### 3. La règle posée : `Notice`
Nouveau composant (à côté de `Card`/`StatBox`) :
- **surface NEUTRE** (`C.card`), jamais un fond teinté ;
- la couleur ne sert qu'à une **barre de 3 px** sur le côté et à l'**icône** ;
- le titre garde la couleur du texte — c'est le **chiffre** qui porte la couleur
  quand il y a urgence ;
- l'explication longue passe derrière **« Pourquoi ? »** : disponible, mais elle
  n'occupe plus l'écran.

Converti : colis à expédier, argent en attente, vente repérée via bordereau,
ventes sans prix d'achat.

### 4. Les emojis utilisés COMME icônes
⚠️ Un emoji est dessiné par le système : ni la même graisse, ni la même grille,
ni la même couleur que le reste. Mélanger les deux, c'est le tell.
- **16 icônes au trait ajoutées** à `ICON_PATHS` (truck, clock, alert, check,
  euro, eye, heart, printer, camera, calendar, filter, sleep, target, qr,
  wallet, info) — même grille 24 et même trait que la barre du bas.
- Les tuiles de « Ma journée » : le carré de 46 px teinté avec un emoji de 24 px
  devient une **pastille neutre + icône au trait**.
- Le **bandeau « Wrapped »** en dégradé violet/rose passe en ligne discrète, au
  même gabarit que « Analyse de tes ventes » juste en dessous : deux entrées de
  même nature ont désormais la même apparence.
- ☀️ devant « Bonjour Julien » et 🗓️ devant « Ta semaine » : retirés (« TA
  SEMAINE » devient une étiquette calme en capitales).
- **9 loupes** retirées des champs de recherche : un champ se reconnaît à sa
  forme, pas à un emoji collé devant le texte d'aide.

### 5. Le numéro de version sort de l'en-tête
Il s'affichait **tronqué** (« v83/00 · Rafraîchisse… ») sur tous les écrans :
information de développeur, en permanence, dans le bandeau du haut. Il vit
maintenant dans Réglages, à côté de la version de l'extension — là où on le
cherche quand on en a besoin.

### ⚠️ Ce qui reste (dit franchement)
Il reste ~600 emojis, surtout dans des pastilles de statut et des libellés de
boutons. Les remplacer d'un coup, c'est 600 modifications dispersées que je ne
peux pas vérifier une par une — et le résultat serait moins bon, pas meilleur.
La suite se fait **écran par écran, capture à l'appui**, comme cette phase.

### Vérifié
`npm run build` OK · smoke **11 écrans, 0 PAGEERROR, 0 artefact** · le nœud de
texte parasite a disparu du DOM (mesuré avant/après) · 9 audits au vert.

---

## 5.55 — ⚠️ UN COMMENTAIRE JSX SEUL ENTRE PARENTHÈSES EST UN OBJET (écran Ventes cassé)

Trouvé par le smoke, pas par la relecture ni par `npm run build` :

```
CONSOLE @cat_ventes  Minified React error #31 … object with keys {}
CONSOLE @cat_ventes  [VRM] écran en erreur
```

En nettoyant un doublon d'avertissement, j'avais laissé la condition et remplacé
son contenu par un commentaire :

```jsx
{totals.nb>0 && (totals.nb-totals.nbCout)>0 && (
  {/* … le bloc vit maintenant plus bas … */}
)}
```

⚠️ **`( {/* … */} )` n'est PAS un commentaire : c'est un littéral d'objet `{}`.**
React refuse de rendre un objet (#31), donc **l'écran Ventes tombait dès qu'il y
avait une vente sans prix d'achat** — c'est-à-dire toujours (§5.47 : 0 prix
d'achat sur 212 paires). Le build ne le voit pas (la syntaxe est valable), un
smoke sans données non plus (la condition est fausse) : **seul un rendu réel avec
les vraies données le montre** — la leçon de §26, à l'identique.

`EcranGardeFou` (§5.14) a fait son travail : message d'erreur, barre du bas
intacte, rien de perdu. C'est la deuxième fois qu'il rattrape une de mes
livraisons.

➡️ Le motif n'existe nulle part ailleurs (vérifié par recherche sur
`&& (` immédiatement suivi d'une ligne `{/*`). **Un commentaire qui remplace du
JSX doit sortir des parenthèses, ou la condition doit disparaître avec lui.**

### Refonte visuelle, phase 2 — écran Achats
- **« Ce qui arrive dans l'app »** était un tableau de diagnostic encadré, ouvert
  en permanence, **au-dessus des colis à retirer**. Il se tait désormais quand
  tout va bien (une ligne dépliable « Réception des emails · tout arrive ») et
  devient un vrai `Notice` d'avertissement **quand un compte ne reçoit aucun
  email** — le cas grave, mesuré en §5.47 : ses codes de retrait n'arrivent
  jamais. Le tableau complet (transporteurs + comptes) reste, derrière le
  dépliant : c'est la preuve, pas l'alerte.
- **Pastilles de statut de vente** (`venteStage`) : elles portaient un emoji ET
  une couleur qui disent la même chose. On garde la couleur et le mot
  (« À expédier », « En transit », « Au relais », « Livrée », « Vendue »).
- **Points relais** : `📍` et `🧭` deviennent des icônes au trait (`pin`, `nav`,
  ajoutées à `ICON_PATHS`) — elles étaient à côté des logos de transporteurs.
- **Annonces** : `🚨`/`⚠️` du bandeau de signalements → `Icon name="alert"` teinté
  par la gravité ; `🏠` → icône `home` ; raccourcis Ventes/Achats/Annonces/
  Bordereaux → mêmes symboles au trait que la barre du bas.

⚠️ **Ce qui reste volontairement en emoji** : les emojis **dans un libellé de
bouton** (« 📋 Copier », « ⬇️ Exporter ») — §13 : là, ils aident. La règle est
« un emoji utilisé COMME icône devient une icône au trait », pas « plus aucun
emoji ».

---

## 5.56 — ⚠️⚠️ J'AI SUPPRIMÉ DEUX ÉCRANS ENTIERS, ET LE BANC N'A RIEN DIT

En retirant l'atelier « Republier » (§5.53), j'ai supprimé une **plage de lignes**
qui contenait aussi ses voisins. Perdus, en production sur la branche :

| perdu | conséquence |
|---|---|
| `curSub==='messages'` | **écran Messages entièrement vide** |
| `curSub==='bordereaux'` | **écran Colis entièrement vide** — celui qui porte les colis à expédier |
| modale `{pickerFor && …}` | **« Relier à un achat » ne s'ouvrait plus** — l'outil central du prix d'achat (§5.23) |

Vu au **rendu**, pas à la relecture : la capture de l'onglet Colis était une page
noire avec la barre du bas, alors que « Ma journée » annonçait *« Expédier 3 colis »*.

### ⚠️ Pourquoi le smoke ne l'a pas vu — et le chiffre était sous mes yeux
Le banc comptait les erreurs de page et les artefacts d'affichage. **Un écran vide
ne lève aucune erreur** : il passait donc « 0 PAGEERROR, 11 écrans OK ». Pire, le
banc imprimait déjà la preuve et je l'ai lue sans la voir :

```
cat_ventes 17455 · cat_annonces 4418 · cat_achats 3560 · settings 5823
cat_bord 57   ⚠️   cat_msg 61   ⚠️
```

57 et 61 caractères, c'est l'en-tête et la barre du bas — rien d'autre.

➡️ **Deux durcissements du banc** (`smoke_all.cjs`) :
1. **moins de 120 caractères = ÉCHEC** (`ECRAN VIDE @<onglet>`), plus un nombre à
   remarquer dans un JSON ;
2. la liste d'onglets contenait **`stats` et `cat_repub`, qui n'existent pas dans
   `TABS_OK`** : l'app retombait sur l'onglet par défaut et le banc mesurait
   **trois fois Ma journée** en croyant tester le tableau de bord (les trois
   rendaient exactement 361 caractères — le même repli). Remplacés par `journee`
   et `dashboard`.

### La leçon
**Une suppression par plage de lignes se vérifie sur ce qui RESTE, pas sur ce qui
disparaît.** `npm run build` passe (le JSX restant est valable), un smoke qui ne
compte que les erreurs passe aussi. Le contrôle qui tranche est : *chaque écran
affiche-t-il encore quelque chose ?*
⚠️ C'est la deuxième fois de la journée qu'un défaut passe le build et le smoke
et n'apparaît qu'au rendu réel (l'autre : §5.55, le commentaire JSX rendu comme
objet vide). **Regarder les captures fait partie du test, ce n'est pas un extra.**

### 5.56 (suite) — écran Colis, même traitement
Les trois blocs de tête (vert « N colis à envoyer », rouge « à poster en
priorité », rouge « numéro porté par deux paires ») s'empilaient comme trois
alertes de même force. Les deux premiers passent au gabarit `Notice` : surface
neutre, barre de 3 px, **le chiffre porte la couleur**. Le troisième garde son
cadre rouge — deux paires dans la même boîte est le seul risque irréversible de
l'app (§19), il doit rester le plus fort de l'écran.
Emojis d'état retirés des cartes (`⏳`, `✅`, `📦`, `📮`) : le mot et la couleur
disaient déjà la même chose ; `🏠 pas rangée` passe à l'icône `home`.

---

## 5.57 — LE NUMÉRO NE PEUT PLUS TROMPER · « FINALISÉE » = ENCAISSÉE · VENTES PAR JOUR

Julien déménage : « je veux pouvoir faire une confiance aveugle et totale envers
ces numéros… si je me trompe entre deux colis, c'est deux ventes de perdues ».

### État mesuré AVANT de coder (24 août)
| | |
|---|---|
| annonces en ligne | **24 · toutes numérotées** |
| colis à envoyer | **10 · tous avec un numéro CERTAIN** |
| cases posées au garage | 0 |
| **numéros portés par deux paires présentes** | **1** — le N°4 (« 3 manuels première ST2S » et « adidas spezial noir 35,5 ») |

La chaîne est donc déjà saine ; ce qui manquait, c'est que le défaut se voie **au
moment du geste**, pas seulement sur un écran qu'il faut penser à ouvrir.

- Le conflit s'affiche **sur la carte du colis**, en rouge, en nommant l'autre
  porteuse et en renvoyant à la photo.
- Le numéro passe de 12 à **15 px** sur cette carte : c'est ce qu'on recopie sur
  la boîte.
- **Nouvel « Inventaire physique »** (Annonces → ⋯ Outils) : la liste des paires
  qui doivent être chez lui **maintenant**, triée par numéro, avec photo, et
  copiable pour l'imprimer. ⚠️ Il dérive de **`porteursNum`**, la définition
  unique de « ce numéro est occupé par une paire présente » (§5.33) — celle-là
  même qui interdit la réattribution. Une règle, deux usages (§11) : on ne
  recalcule rien. Tous les comptes, **même masqués** : masquer un compte cache
  sa comptabilité, ça ne sort pas le carton de l'étagère.

### ⚠️ « ANNULÉE » vs « REMBOURSÉE » — Julien avait raison
« Je crois que tu t'es trompée dans une vente, tu l'affiches annulée alors
qu'elle a bien été expédiée. »

**Mesuré : sur 33 ventes classées annulées, 3 avaient bel et bien été
EXPÉDIÉES** — « new balance fuelcell propem v5 blanc » (30 €, bordereau reçu),
« adidas samba argenté 40,5 » (26 €, bordereau reçu), « adidas spezial cuir blanc
37,5 » (29 €, Vinted dit « Commande livrée ! »). Les 33 portent toutes le statut
« Remboursement effectué ».

Ce ne sont pas des commandes annulées avant l'envoi : **la paire est partie ET
l'argent est revenu**. C'est pire qu'une annulation, et ça ne se dit pas avec le
même mot. `venteExpediee(o)` tranche sur une preuve **certaine** (bordereau
rattaché au n° de transaction, ou mot d'acheminement dans le statut Vinted) —
jamais un rapprochement par titre (§24).

### ⚠️ « FINALISÉE » VEUT DIRE ENCAISSÉE — et ce n'est PAS la date de vente
« En finalisé, c'est simplement la réception d'argent qui compte. »

`my_orders` ne porte **qu'une** date : celle de la vente. Le moment où Vinted
finalise — donc libère l'argent — n'existe que dans le **détail de transaction**
(`status_updated_at`). **Mesuré : 7 jours d'écart en médiane, jusqu'à 25.** Dater
un encaissement au jour de la vente serait donc faux d'une à trois semaines.

- **`dateEncaissement(o)`** = ce `status_updated_at`, **et seulement quand le
  détail dit lui-même « finalisé »**. ⚠️ Sur un détail capté plus tôt, ce champ
  date de l'étape d'avant (« Le paiement a été validé ») : mesuré, deux cas
  donnaient un encaissement le jour même de la vente. Sans ce garde-fou, on
  fabriquerait une date fausse.
- Sur le filtre **Finalisées**, la période ET les totaux portent sur cette date ;
  la carte se renomme **« Argent reçu »**.
- ⚠️ Une finalisée **sans** date connue n'est **jamais** datée au jour de la
  vente : elle sort du total, et un avertissement dit combien il y en a. Un total
  incomplet qui se présente comme complet est pire qu'un total absent.
- **En cours** et **Annulées** : inchangés (période sur la date de vente).
- ⚠️ `matchOrd` sert AUSSI aux Achats et aux Colis : la règle est bornée à
  `curSub === 'ventes'`, sinon un filtre laissé sur « Finalisées » daterait les
  achats à l'encaissement d'une vente.
- `fetchTxnItemIds` lit désormais **quatre scalaires** par transaction
  (`item`, `maj`, `etat`) — jamais le payload (§34). Sa valeur est devenue un
  **objet** : les 3 sites qui la lisaient ont été mis à jour.

### VENTES PAR JOUR
Bloc dépliable sur l'écran Ventes : chaque jour de la période, nombre de ventes +
total, avec une barre de comparaison. **Toujours sur la DATE DE VENTE**, même
quand le filtre Finalisées fait porter le reste de l'écran sur l'encaissement —
ce sont deux questions différentes et elles ne doivent pas se mélanger.

### Extension 5.35.0 — `capterEncaissements`
À chaque visite sur Vinted, va chercher le détail des ventes **finalisées qui
n'en ont pas** : c'est ce qui remplit la date d'encaissement (couverture mesurée
au départ : **67 sur 236**). Mêmes garde-fous que partout (§48) : **compte
connecté uniquement** (`garde`), plafond de 20 actions/h, **3 par visite max**
(une limite de volume, pas un rythme « humain » déguisé — §32), pas de nouvel
essai avant 24 h, et uniquement les finalisées sans détail.
⚠️ Écrit via **`storeHarvest`** (une ligne PAR transaction) et non
`storeHarvestRow`, qui n'écrit qu'une ligne par type et écraserait chaque détail
avec le suivant.

### ⚠️ Piège de banc (§21, encore)
Le banc ne servait **aucune ligne `harvest_*_txn_*`** : il mesurait donc « 0 date
d'encaissement, 112 sans date » et j'aurais pu conclure que la fonction ne marche
pas. Fixture `txn.json` ajoutée (4 champs par transaction, comme l'app).
**Servir TOUTES les familles de lignes avant de conclure.**

### 5.57 (suite) — CHOISIR N'IMPORTE QUEL MOIS, et ⚠️ 205 VENTES MASQUÉES

Julien : « je veux pouvoir sélectionner un mois — juin par exemple — et que
l'app fasse la somme du 1er au dernier jour de juin ».

Les raccourcis « Ce mois » / « Mois dernier » ne couvraient que les deux
derniers : pour juin en août, il fallait pointer deux dates dans le calendrier.
`PeriodePicker` s'ouvre désormais sur les **MOIS** — une année navigable et
douze boutons, un tap = tout le mois, bornes calculées jamais saisies, mois à
venir grisés. « Jour à jour » reste à un clic.

### ⚠️ LE VRAI DÉFAUT TROUVÉ EN VÉRIFIANT : 205 ventes masquées, sans un mot
En testant juin, l'app annonçait **1 vente / 41 €** alors que la base en porte
**51 pour 1 740 €**. Le banc a prouvé que les 90 ventes du compte arrivent bien
jusqu'à l'app (log du mock) — la perte était ailleurs.

**Cause : `vinted_sales_hidden` contient 205 ventes masquées, dont 50 des 51 de
juin.** L'app les excluait à raison (un ✕ sur une carte les masque
volontairement) — mais elle ne le **disait pas**. Un total qui se présente comme
complet alors qu'il exclut des lignes est exactement ce qu'on s'interdit.
➡️ Un avertissement compte désormais les ventes masquées **de la période**, avec
leur montant, et propose de les réafficher en un clic. Vérifié au rendu :
« 41 ventes masquées sur juin 2026 · 1 472 € qui ne comptent dans aucun total ».

### ⚠️ Honnêteté sur les mois passés
La date d'encaissement n'existe que dans le détail d'une transaction, et
l'extension ne les capte que depuis peu : **mesuré, l'argent reçu daté ne couvre
que juillet (5 ventes, 215 €) et août (56, 1 791,80 €)**. Pour juin, l'app
afficherait 0 € — exact et inutilisable. L'avertissement dit donc les **deux**
chiffres, nommés : « Argent reçu » (encaissements réellement datés) et « X €
vendus sur juin et finalisés, mais l'encaissement n'est pas encore daté ».

### Extension 5.36.0 — bouton « Récupérer » (onglet Ventes)
Le passage automatique ramène 3 dates par visite : boucler un mois passé
prendrait des semaines. Ce bouton en fait un lot de 15, **sur son clic**.
⚠️ Ce n'est pas une rafale (§32/§43) : ce sont des **lectures** sur ses propres
transactions, envoyées une par une en attendant chaque réponse, pour le seul
compte connecté, et le plafond de 20 actions/h coupe le lot de lui-même — il est
désormais vérifié **avant chaque requête**, plus seulement au début.


### 5.57 (suite) — ⚠️ SIMPLIFIÉ : « FINALISÉES » PORTE SUR LA DATE DE VENTE

Julien, après coup : « c'est hyper simple, il s'agit juste d'additionner toutes
les ventes réalisées d'une date à l'autre dans les ventes finalisées. **On ne te
parle pas de transfert d'argent**, simplement des ventes finalisées. »

➡️ **La date d'encaissement est RETIRÉE de la période.** Une seule date partout :
celle de la vente. Le filtre « Finalisées » somme les ventes finalisées dont la
vente tombe dans la plage. C'est plus simple, **complet dès aujourd'hui** (la
date de vente est toujours là, l'encaissement ne l'était que pour 67 ventes sur
236), et ça ne dépend d'aucune capture supplémentaire.
⚠️ **Ne pas réintroduire la date d'encaissement sans qu'il le redemande.**
Retirés avec elle : `dateEncaissement`, le mode « Argent reçu », l'avertissement
« sans date d'encaissement », la capture `capterEncaissements` de l'extension et
son bouton dans le panneau — des requêtes Vinted pour une donnée que plus rien
ne lit, c'est de l'empreinte pour rien. `fetchTxnItemIds` revient à deux
scalaires (l'identité d'annonce, elle, reste essentielle).

### La période descend sous les onglets
« En haut, quand tu cliques sur finalisé, ça fait un onglet trop gros. » Six
pastilles de période + la recherche formaient deux blocs pleins avant la
première vente. La recherche reste en haut (elle sert quel que soit le filtre) ;
**le sélecteur de période passe SOUS les onglets** — on choisit « Finalisées »,
puis le mois.

### ⚠️ « Est-ce que tu es sûr qu'il n'y aura jamais d'erreur sur les numéros ? »
Réponse mesurée, et elle n'est pas « oui » sans réserve.

| relevé du 24 août | |
|---|---|
| numéros attribués | **195, du N°1 au N°275** |
| portés par une annonce EN LIGNE | **23** |
| paires déjà parties (numéro brûlé à vie) | **172** |
| jamais attribués (vrais trous) | 80 |
| **conflits (un numéro sur deux paires présentes)** | **1 — le N°4** |

**Les « sauts » ne sont pas aléatoires** : entre 100 et 160, presque tous les
numéros SONT attribués — à des paires vendues (N°100 Samba LT, N°101 Spezial
gris… seuls N°118 et N°134 sont encore en ligne). L'inventaire n'affiche que les
paires présentes, d'où l'impression de trous.
**Ce qui est garanti** : un numéro n'est jamais réattribué (§5.40) ; la saisie
manuelle refuse un numéro porté par une paire présente (§5.42) ; l'attribution
automatique ne pioche que dans les numéros libres ; le numéro d'un colis vient
de l'identifiant d'annonce Vinted, jamais d'une ressemblance (§5.34).
**Ce qui ne l'est pas** : le N°4, hérité d'avant ces garde-fous, est encore porté
par deux annonces en ligne. Il est signalé en rouge sur l'écran Annonces, dans
l'inventaire et sur la carte du colis — mais il existe. Tant qu'il n'est pas
corrigé, la réponse honnête est « une seule erreur possible, et elle est
nommée », pas « aucune ».

---

## 5.58 — RETIRER LE BRUIT, CORRIGER UN BANDEAU QUI MENTAIT, OUVRIR LA 3D

### « Synchroniser » retiré (Ventes, Achats, Annonces)
Julien : « tu peux enlever le bouton synchroniser, ça se synchronise avec
l'extension de toute façon ». C'est vrai — et ce bouton allait chercher les
données **en direct chez Vinted, tous comptes à la fois** : exactement
l'empreinte multi-comptes qu'on passe notre temps à réduire (§5). Le retirer
supprime le seul endroit d'où l'app pouvait déclencher ça.
⚠️ `loadOrders(..., force)` et `loadListings(force)` existent toujours (le
`force` sert au vidage de cache) — c'est seulement l'entrée manuelle qui part.

### ⚠️ « 22 JOURS SANS CAPTURE » ÉTAIT FAUX — mesuré
Le bandeau prenait le compte **le plus ancien parmi TOUS**, masqués compris.

| compte | dernière capture |
|---|---|
| 6 comptes actifs | **0,0 à 0,1 j** (le jour même) |
| 147827838 | 5,5 j |
| **3175772080 (`liliand653`)** | **22,6 j — MASQUÉ par Julien** |
| 3170790456 (sans jetons) | 48 j |

Les « 22 jours » venaient donc d'un compte qu'il a **lui-même mis hors
comptabilité**. Le bandeau ignore désormais `acctOff` et ne parle qu'au-delà
d'**une semaine** (2 jours, c'était du bruit quotidien).

### Signalements des Annonces : il n'en reste qu'un
Le compteur générique additionnait des choses sans conséquence (compte muet,
annonce disparue, compte bloqué) avec **la seule qui coûte de l'argent** : deux
paires présentes sous le même numéro. Noyée au milieu, elle ne se voyait plus.
Les autres sont retirées ; celle-ci reste, en rouge, dépliée d'office.

### 3D : 14 objets de décor + une vraie palette
« Je veux un vrai jeu vidéo, je veux pouvoir tout créer dedans. »
chaise, bureau, canapé, lit, tapis, plante, lampadaire, miroir, cadre,
poubelle, escabeau, radiateur, vélo, établi — assemblés avec **les mêmes
primitives et les mêmes matières** que les meubles, chacun projetant son ombre.
⚠️ Ils portent `deco: true` : ni case, ni numéro, ni inventaire. `isSurface()`
les excluait déjà, donc on ne peut rien poser dessus par erreur.
La palette passe en **deux familles nommées** (Rangement / Décor) : trente
boutons à plat rendaient le rangement introuvable.

### Refonte visuelle : les FONDATIONS, pas six cents endroits
Ce qui faisait « tableau de bord de développeur » n'était pas le détail des
écrans mais les valeurs de base : cartes plates de la même couleur que le fond,
séparées par un trait d'1 px, un vert unique posé partout.
- **Tokens** : fond légèrement teinté et carte **plus claire que lui** — c'est
  ce décalage qui donne le relief, pas le contour ; trois niveaux d'élévation
  (`shadow`/`shadowMd`/`shadowLg`), jamais de noir pur ; nouveaux `card2` et
  `ring` ; mode sombre recalculé pour son fond.
- **Primitives** (tout l'écran en hérite) : `Card` rayon 16 + ombre ;
  `Notice` avec un voile très pâle de sa couleur (il se teinte sans crier) ;
  `ScreenHead` titre 22 px serré, icône dans une pastille teintée ;
  `StatBox` où **le chiffre passe devant** (26 px) et l'étiquette redevient une
  légende.

**Vérifié** : `npm run build` OK · smoke **11 écrans, 0 vide, 0 erreur** ·
**9 audits au vert** · captures relues (Ventes, Réglages).

---

## 5.59 — LA 3D SUR LE FOND : parquet, lumière, et ce qu'on regarde en premier

### Le sol décide de tout
C'est la plus grande surface de l'image : une texture de bois « bruitée » étirée
sur six mètres n'a **aucune échelle**, l'œil n'a rien pour mesurer la profondeur.
`makeParquet` pose de vraies **lames** avec leurs joints, à coupe perdue
(décalage d'un rang à l'autre), chacune avec sa teinte et son veinage — un joint
sombre en bas/droite, un liseré clair en haut, c'est ce contraste qui donne le
relief. **Une tuile = ~1,6 m** : les lames gardent une taille crédible quelle
que soit la pièce (avant, elles s'étiraient avec elle).

### Les murs : la lumière tombe
Un mur d'une seule teinte du sol au plafond est le signe le plus sûr d'une image
de synthèse. `makeWall` pose un dégradé vertical très léger (le haut prend la
lumière du plafond, le bas s'assombrit) plus une trame fine.

### La pièce d'abord, les réglages ensuite
La vue 3D était **sous quinze rangées de boutons** : il fallait défiler tout
l'écran de configuration avant de voir son garage. Elle passe en premier.

### ⚠️ « undefined » sur chaque meuble — et pourquoi le DOM ne le voyait pas
Vu au **rendu** : chaque étiquette de meuble portait le mot « undefined ». Mon
scan du DOM ne trouvait rien — normal, **ce sont des sprites WebGL, pas du
HTML**. C'était mon banc qui servait des meubles sans `name`, mais l'app ne s'en
protégeait pas (un plan importé ferait pareil) : on retombe désormais sur le
libellé du TYPE. Le banc sert maintenant des meubles complets.
➡️ **Un défaut dans un canvas ne se cherche pas dans le DOM. Il faut regarder
l'image.**

### Le décor ne porte pas d'étiquette
Huit pastilles sombres flottaient au-dessus de la pièce et masquaient
précisément ce qu'on vient regarder. Une chaise se reconnaît sans qu'on écrive
« Chaise » dessus ; un **rangement** garde son nom et son compte — c'est
l'information utile (où sont les paires).

---

## 5.60 — LE GARAGE SERT À RANGER, PAS À MEUBLER (3D cadrée + écran remis dans l'ordre)

Julien : « améliore la 3D, c'est pas ouf comme ça ; **mets-toi à la place d'un
revendeur pour son rangement**, vraiment ça doit être mieux, plus facile à
prendre en main ». Méthode : **regarder la capture** avant de toucher au code
(§5.56 — un défaut dans un canvas ne se cherche pas dans le DOM).

### 1. ⚠️ LA CAMÉRA ÉTAIT DANS LA PIÈCE, PAS DEVANT
La position de départ était **fixe** : `x = w*0.1, y = max(2.2, max(w,h)*0.5),
z = h*1.05`. Sur une pièce de 7×6 ça met la caméra à **~7 m du centre**, donc à
l'intérieur : sur la capture, l'étagère était **coupée en haut** et à moitié
cachée par le canapé. On ne voyait pas son rangement — c'est très exactement le
« pas ouf ».

➡️ `cadrerPiece()` calcule la **distance qui fait entrer les 8 COINS** de la
pièce dans le champ, en tenant compte du **format du canvas** (sur un écran
étroit c'est la largeur qui contraint, pas la hauteur). `maxDistance` est relevé
en conséquence — sinon OrbitControls ramenait la caméra plus près à la première
mise à jour et **annulait le calcul en silence**.

⚠️ **Ma première version cadrait la SPHÈRE englobante** (demi-diagonale de la
pièce) : la caméra partait beaucoup trop loin et la pièce **flottait au milieu
d'un grand vide gris**. La diagonale d'une boîte est bien plus grande que ce
qu'on voit réellement d'un point de vue donné. Vu en capture, corrigé en
projetant les coins — exact, et ça s'adapte tout seul à la forme de la pièce.

### 2. Chercher un N° amène DE FACE, plus en trois-quarts
Ce qu'on veut voir quand on cherche une paire, c'est la **grille de cases** du
meuble : de biais, les rangées se chevauchent et on ne compte plus rien.
`flyTo` vise désormais le meuble **de face**, depuis le côté dégagé —
direction « meuble → centre de la pièce » : un rangement est contre un mur, il
s'ouvre vers l'intérieur. ⚠️ **Aucune convention de rotation à deviner** (elle
diffère d'un type de meuble à l'autre). Un meuble au centre (< 0,35 m) retombe
sur une direction par défaut.
Bouton **« 👁 De face »** dans la vue, visible dès qu'un meuble est sélectionné.

### 3. L'écran s'ouvre sur la PIÈCE + la RECHERCHE
Tout l'outillage de **construction** (palette de meubles, dimensions, plafond,
couleur des murs, mode déplacement) part derrière un dépliant **« Aménager la
pièce »**. Un revendeur ouvre son garage pour **retrouver une paire ou en ranger
une**, pas pour ajouter un canapé. Le sélecteur de pièces reste visible : c'est
de la navigation, pas de la construction.

### 4. Trois défauts d'affichage relevés en capture
- **Les 5 ambiances** étaient une rangée de pastilles qui **défilait en travers
  du haut de la vue** — la dernière coupée, et elles couvraient précisément
  l'étagère qu'on vient regarder. Un seul bouton « Ambiance » les déplie.
- **Les 6 boutons de vue** étaient collés dans le même coin, en trois groupes qui
  se chevauchaient. Deux grappes séparées : **cadrage à gauche, navigation à
  droite**.
- **Le vide autour de la pièce** était un **aplat gris uni** — la chose qui fait
  le plus « rendu 3D pas fini ». Dégradé vertical léger (même recette que les
  murs, §5.59), **régénéré à chaque changement d'ambiance** (`fondDegrade`).

### 5. ⚠️ « Version : … · 🔄 Forcer la mise à jour » trônait au milieu du Garage
De l'outillage de développeur posé dans un écran de travail, **juste au-dessus
de la 3D**. §5.54 avait sorti la version de l'en-tête ; ce bloc-là était resté.
Il **ne disparaît pas** (c'est le seul bouton de forçage de l'app) : il rejoint
la version dans **Réglages**, là où on le cherche.

### ⚠️ CE QUE J'AI CASSÉ EN CHEMIN (et comment ça a été rattrapé)
Ma première tentative de réorganisation découpait des **plages de lignes** et les
réinsérait ailleurs. Elle a attrapé le bloc « Recherche » du **mauvais
composant** (celui du garage-photo, qui lit `photos`/`cur`/`pins`) et produit un
JSX déséquilibré — `npm run build` refusait de compiler.
➡️ Réparé en **isolant les seuls morceaux voulus** dans le diff (`git apply` de
la palette seule sur un fichier propre) puis en refaisant le déplacement avec
des **assertions sur la première et la dernière ligne de chaque bloc**.
**Une découpe par numéros de ligne se vérifie sur ce qui RESTE** (§5.56) — et
chaque bloc extrait doit être reconnu par son contenu, jamais par sa position.

### Palette : identité assumée
Ma tentative précédente déplaçait les couleurs de ~2 % : Julien a dit deux fois
« rien n'a changé », et **il avait raison**. Nouvelle base : accent vert franc
(`#00875a` / `#2ee08f`) réservé aux actions et aux chiffres qui comptent,
surfaces **nettement étagées** en sombre (`#0a0e11` → `#151b20` → `#1d252b`), gris
légèrement froid (le vert-olive rendait terne).

### Vérifié
`npm run build` OK · **9 audits au vert** (secrets, identité, cohérence 0
désaccord sur 12 statuts, qr, offres, transporteurs, formes d'email, bordereau,
diagnostic) · smoke **11 écrans, 0 ECRAN VIDE, 0 PAGEERROR, 0 texte
« undefined »** (les lignes console restantes sont le 400 volontaire de
`select=owner` et les resets de fin de test) · **captures relues** : la pièce
entière tient dans le cadre, les boutons ne se chevauchent plus, le fond est
dégradé · banc dédié **« De face »** : un tap dans le canvas sélectionne le
meuble, le bouton apparaît, le clic **change réellement la vue** (images
comparées à l'octet) et l'étagère se présente **de face, ses rayons lisibles**.

### ⚠️ Reste ouvert (pas fait, dit franchement)
- L'onglet **par défaut du Garage reste « Grille »** (25 cases grises vides). La
  3D est derrière « Plan ». Changer le défaut est un changement de comportement :
  **à trancher avec Julien**, pas à décider seul.
- Le cadre reste un peu haut par rapport à une pièce large (bandes vides en haut
  et en bas sur un écran de téléphone). Sur ordinateur — la cible qu'il a fixée
  pour l'app comme pour l'extension (§42) — le canvas est large et la pièce
  remplit le cadre.

---

## 5.61 — LES NOTIFICATIONS COUPÉES PAR MA PROPRE CORRECTION + une vraie typographie + on range une VRAIE paire

Julien : « remets les notifications, je ne les reçois plus… améliore le
graphisme, les couleurs, les contrastes, les logos, les boutons, qu'on n'ait
pas l'impression que ce soit fait par une IA… et la 3D doit être une
application dans l'application : tu sélectionnes ce que tu ranges, la taille,
on voit les animations. »

### 1. ⚠️⚠️ POURQUOI IL NE RECEVAIT PLUS RIEN — c'est §5.53 qui l'a cassé
En sortant la clé privée VAPID du dépôt public, la **paire a été régénérée** :
la clé **PUBLIQUE a changé elle aussi**. Or un abonnement push est **scellé à
la clé publique avec laquelle il a été créé**. Les abonnements déjà posés sur
ses deux appareils sont donc devenus inutilisables — le service de push refuse
l'envoi — et `getSubscription()` les rend **quand même**. L'écran affichait
donc « activé » pendant que plus rien n'arrivait, et le bouton « Test »
répondait « aucun appareil n'a reçu », ce qui désignait le mauvais coupable.

- **`memeCle(sub)`** compare la clé de l'abonnement à la clé courante et
  **ré-abonne tout seul** quand elles diffèrent (désabonnement + nouvel
  abonnement + renvoi au serveur), avec un mot dans l'écran.
- **`GET /api/push?etat=1`** répond « le serveur peut-il envoyer ? » (booléen +
  nombre d'appareils, **aucun secret exposé**). Réglages → Notifications
  affiche le verdict en rouge quand la clé manque.
- Le bouton **Test remonte la RAISON du serveur** : « aucun appareil abonné »
  et « le serveur n'a pas sa clé » produisaient exactement le même silence.

⚠️ **Ce que le code ne peut PAS faire** : poser `VAPID_PRIVATE_KEY` dans les
variables d'environnement Vercel. Tant qu'elle manque, **zéro notification
part**, quel que soit le nombre d'appareils abonnés. L'app le dit désormais
noir sur blanc au lieu de laisser chercher.

### 2. LE GRAPHISME — les deux tells d'une interface générée
**Tell n°1 : une seule police neutre à toutes les tailles.** Rien ne distingue
un titre d'un paragraphe sinon la taille. On oppose désormais une police
d'**AFFICHAGE** (Bricolage Grotesque — titres d'écran, montants, gros
chiffres, N° des paires) à la police de **TEXTE** (Inter), avec un contraste
tenu : affichage resserré (**-0,03 em**) contre micro-étiquettes aérées en
capitales (**+0,09 em**, classe `.vrm-label`). C'est ce couple qui fait lire
« composé par quelqu'un ».
**Tell n°2 : l'aplat parfaitement lisse.** Aucune surface réelle ne l'est. Une
trame de bruit à **2,8 %**, non cliquable, sur toute la page (`body::after`,
SVG `feTurbulence` en `data:`) — personne ne sait dire pourquoi, mais ça ne
ressemble plus à du CSS pur.

**Les boutons** (il les a nommés) : tous les boutons de l'app portent des
styles **en ligne**, donc une règle CSS ne peut pas les repeindre — mais les
**états** (`:hover`, `:active`, `:focus-visible`) n'existent pas en style en
ligne. Ces règles-là s'appliquent donc partout **sans jamais écraser une
intention de couleur** : légère montée en luminosité au survol, enfoncement au
clic, anneau de focus aux couleurs de la marque.
⚠️ `:hover` borné à `(hover:hover) and (pointer:fine)` : sur mobile le survol
reste « collé » après un tap et le bouton paraît bloqué.

⚠️ **Le fond de page gardait les ANCIENNES couleurs** (`#eef2ef` / `#0b0f0d`)
alors que la palette était passée à `#f1f4f2` / `#0a0e11` : une bande d'une
autre teinte derrière les cartes, visible sur tous les écrans. Resynchronisé.

⚠️ **Défaut vu en capture, pas à la relecture** : les étiquettes en capitales
sont **plus longues**. « COÛT D'ACHAT » et « BÉNÉFICE NET » passaient sur deux
lignes et les trois `StatBox` d'une rangée ne s'alignaient plus. On réserve
deux lignes pour tout le monde — les chiffres restent sur la même ligne d'œil.

### 3. LA 3D — on range une VRAIE paire, et le carton tombe
Avant, remplir une case demandait de **taper un numéro de mémoire** : rien ne
vérifiait qu'il existe, ni qu'il n'est pas déjà rangé ailleurs.

- **`RangerSheet`** : on choisit dans la liste de ses paires — **photo, N°,
  titre, POINTURE**, recherche. La liste dérive de **`vinted_nums_physiques`**
  (§5.14), la définition unique de « cette paire est chez toi » : aucune règle
  n'est réécrite ici (§11).
  ⚠️ **Sans cette liste** (écran Annonces jamais ouvert sur cet appareil), on
  propose **tout plutôt que rien** — mais on trie les **plus récemment
  numérotées en tête** et **on l'écrit dans la feuille**. On ne fait pas
  semblant de savoir.
- **`animerDepot`** : la boîte **tombe** dans sa case — chute accélérée, rebond
  amorti, halo qui s'éteint. ⚠️ Déclenchée **APRÈS** la reconstruction du
  meuble (l'effet sur `items`) : la boîte n'existe qu'à ce moment-là. React
  exécute les effets dans l'ordre de déclaration, c'est ce qui garantit
  l'enchaînement.
- **`poserDansCase`** : un seul chemin d'écriture pour les trois entrées
  (choix, saisie libre, effacement) — gravité, croissance de la grille,
  animation.
- **Garde-fou `dejaPoseOu(num)`** : un même numéro dans deux cases, c'est
  « dans quelle boîte est-elle ? » — le pendant, au garage, des deux paires
  sous le même numéro (§19). La feuille l'empêche par construction (elle ne
  propose que ce qui n'est pas rangé) ; ce garde-fou couvre la **saisie
  libre**, qui ne vérifiait rien, et nomme le meuble où la paire se trouve.

### 4. État des données mesuré AVANT de coder (25 août)
| | |
|---|---|
| paires numérotées | **225** |
| annonces en ligne | 26 |
| **numéros portés par deux annonces en ligne** | **0** ✅ |
| **annonces en ligne sans numéro** | **0** ✅ |
| **prix d'achat renseignés** | **0 / 225** ⚠️ |

Les garde-fous de §5.40 (aucun numéro réattribué) et §5.45 (rien ne bouge tout
seul) **tiennent** : le N°4 corrigé la veille n'est pas revenu, et aucune
annonce n'est sortie sans numéro. Le seul trou reste **le prix d'achat** —
l'outil de saisie en série existe (§5.47), c'est de la frappe.

### ⚠️ Deux pièges de banc, encore (§21)
1. **J'ai failli signaler un bug qui n'existe pas** : la capture
   `smoke-cat_journee.png` montrait un commentaire JSX affiché EN TEXTE sur
   l'écran d'accueil. Vérification : la capture datait de **10:49**, d'un run
   précédent, et `cat_journee` n'était **pas** dans les onglets du banc. Le
   bundle courant ne contient **aucune** occurrence du texte. **Regarder la
   date du fichier avant d'accuser le code.** L'onglet a été ajouté au banc, et
   un **détecteur permanent** cherche désormais `/*` et `*/` dans le texte
   affiché — la famille §5.55/§5.56 ne repassera plus.
2. **Mon banc lisait la mauvaise clé** : `vrm_room` au lieu de
   `vrm_room_plan` → il concluait « rien n'a été rangé » alors que tout
   marchait.

### Vérifié
`npm run build` OK · `node --check api/push.js` OK · **9 audits au vert** ·
banc : la police d'affichage est **réellement chargée et appliquée**
(`document.fonts.check('700 22px "Bricolage Grotesque"')` = **true**, famille
calculée du titre = Bricolage Grotesque) · **banc de rangement dédié** : deux
taps sur une case → la feuille s'ouvre (**175 paires**, nom de case
« colonne 3 · 2ᵉ depuis le bas », avertissement d'honnêteté affiché) → un tap
sur N°154 → **`Étagère:3_2=154`** en base (la gravité l'a fait tomber en bas de
la colonne), l'étiquette du meuble passe à **« Étagère (1) »** et le panneau à
**« 1 boîte rangée · 14 places libres »** · smoke tous écrans, **0 ECRAN
VIDE, 0 PAGEERROR**.

### 5.61 (suite) — le garage s'ouvre sur la 3D + le banc ne ment plus

- **`vinted_garage_view` passe par défaut à `plan`.** Julien : « je veux
  vraiment que la 3D soit une application dans l'application ». Le choix reste
  **mémorisé par appareil** : qui préfère la grille la retrouve au prochain
  passage — on change le point de départ, pas son habitude. Les trois onglets
  passent des emojis (🗄️ 📸 🪑) aux **icônes au trait** (§5.55) et s'appellent
  **Ma pièce / Grille / Photos**.
- **La pastille ✎ quitte le logo** : elle n'apparaît qu'au survol (ordinateur).
  Un produit fini ne porte pas un crayon sur sa marque ; le changement d'icône
  reste dans Réglages.

⚠️ **TROIS FOIS dans la même session j'ai lu une capture PÉRIMÉE** et failli
signaler un bug qui n'existait pas — dont un commentaire JSX prétendument
affiché en clair sur l'écran d'accueil (le bundle n'en contenait aucune trace ;
la capture datait d'un run précédent). Deux durcissements du banc :
1. **il efface toutes ses captures au démarrage** — une capture qui survit à un
   run planté est un piège ;
2. **détecteur permanent** de `/*` et `*/` dans le texte affiché, pour que la
   famille §5.55/§5.56 (commentaire JSX rendu comme texte) ne repasse plus.
⚠️ Et : **ne jamais lancer `npm run build` pendant qu'un banc sert `dist/`** —
le dossier est vidé, le banc plante, et on croit à une régression.

**État final vérifié** : smoke **11 écrans, 0 ECRAN VIDE, 0 suspect
d'affichage, 0 erreur non-réseau** · 9 audits au vert · base de production :
225 paires numérotées, 26 annonces en ligne, **0 doublon de numéro**,
**0 annonce sans numéro**.

---

## 5.62 — ⚠️ LE VRAI PROBLÈME N'ÉTAIT NI LES COULEURS NI LA POLICE : LA FORME ÉTAIT MOBILE

Julien, **trois fois** : « le rendu est presque pareil, je veux quelque chose
qui révolutionne ». Il avait raison les trois fois, et mes réponses (palette,
typographie, grain, états de boutons) étaient **des retouches sur une structure
qui ne changeait pas**.

### Ce que la mesure a montré — et il fallait la faire au 1er message
Rendu de l'app à **1440×900**, l'écran où il travaille (§42 : ordinateur
d'abord). C'était une **app mobile étirée** :

| constat (capture) | |
|---|---|
| largeur d'une carte d'action pour porter trois mots | **1170 px** |
| navigation | **en bas**, comme sur un téléphone |
| vide noir sous le contenu | **~350 px** |
| écrans accessibles d'un coup | **5 sur 9** (les autres derrière « Plus ») |

➡️ **Aucune retouche de teinte ne corrige ça.** Un lecteur relie mal le début
d'une ligne de 1170 px à sa fin ; une barre d'onglets en bas d'un écran de
bureau, personne n'en met ; et cacher la moitié de la navigation derrière un
bouton est une contrainte de **téléphone**, sans raison d'être sur 1440 px.

### Le shell d'ordinateur — `useOrdinateur()` (≥ 1024 px)
- **`SideBar`** : les **neuf** écrans visibles d'un coup, groupés
  « Au quotidien » / « Le reste », la marque en haut, Réglages en bas. La barre
  du bas disparaît — **une seule navigation à la fois, jamais les deux**.
- **Largeur de lecture bornée à 980 px**, collée à gauche sous la barre : la
  respiration passe **à droite**, plus dans la carte.
- **En-tête décalé** après la barre latérale, et **la marque n'y est plus** :
  deux logos sur le même écran, c'est ce qui fait « assemblé » plutôt que
  « conçu ».
- **Actions de Ma journée en GRILLE** :
  `repeat(auto-fit, minmax(340px, 1fr))` → **deux colonnes** sur grand écran,
  **une** sur téléphone. La même règle pour les deux, **sans test de largeur
  dans le JavaScript** — donc rien à maintenir en double.
- **Une lueur** (deux dégradés radiaux très doux, `body::before`) sous tout le
  contenu. Sur grand écran il reste forcément du vide une journée calme : un
  aplat noir qui s'arrête net fait « page pas finie », une source de lumière en
  fait de la respiration.

⚠️ **En dessous de 1024 px, RIEN ne change** : `ordi` est faux, la barre du bas
et la pleine largeur sont exactement celles d'avant. **Le téléphone est
intact** — c'est la condition de ce changement, et elle est vérifiée au banc à
430 px.

### La leçon, et elle vaut pour la suite
**Quand quelqu'un dit trois fois « c'est pareil », arrêter de retoucher et aller
mesurer l'objet dans SES conditions.** Deux sessions de palette et de
typographie n'ont pas déplacé son impression parce que le défaut n'était pas
là ; une capture à sa vraie résolution l'a montré en trente secondes.

⚠️ **Piège d'outillage rencontré cinq fois aujourd'hui** : lancer
`npm run build` pendant qu'un banc sert `dist/` vide le dossier sous ses pieds —
le banc plante ou se fige, et on croit à une régression. **Un seul des deux à
la fois.**

---

## 5.63 — LE GARAGE MONTRE ET SORT · LES LISTES EN DEUX COLONNES

Deux briques livrées avec le shell d'ordinateur (§5.62) et pas encore écrites
ici.

### 1. ⚠️ LE GARAGE NE SAVAIT QUE RANGER
`RangerSheet` (§5.61) permettait de poser une paire dans une case. Rien, ensuite,
ne disait **ce qu'un meuble contient**, et **rien ne permettait d'en sortir une
paire** — sauf le vieux ✕ de la vue Grille, sur un numéro nu, sans photo. Un
rangement où l'on ne peut que faire entrer se remplit et ne sert plus.

- **`contenuMeuble(it)`** : le contenu réel d'un meuble, **trié par numéro**,
  chaque ligne enrichie par `ficheParNum` — photo, titre, et le drapeau
  `ambigu`. Panneau sous la 3D dès qu'un meuble est sélectionné.
- **`ficheParNum`** = la résolution numéro → paire. ⚠️ **Deux fiches peuvent
  porter le même numéro** (héritage d'avant §5.40, la réattribution). Dans ce
  cas on préfère celle d'une paire **réellement présente** (`vinted_nums_physiques`,
  §5.14 — la définition unique, on ne la refait pas), sinon la plus récemment
  numérotée, **et on le SIGNALE** (`ambigu`) au lieu de choisir en silence.
  Montrer la mauvaise chaussure à côté d'un numéro est exactement le risque n°1
  (§19).
- **`sortirDeCase(itemId, cellKey, numero)`** : la boîte **monte et s'efface**
  (`animerSortie`, 380 ms) **PUIS** on écrit — `fini()` est rappelé par la scène
  quand l'animation est finie. Écrire d'abord ferait disparaître la boîte avant
  qu'on la voie partir : le geste n'aurait aucun retour.
- **`dejaPoseOu(num)`** couvre la **saisie libre** (le champ « numéro à ranger »,
  qui ne vérifiait rien) : un même numéro dans deux cases, c'est « dans quelle
  boîte est-elle ? ». Le message nomme le meuble où la paire se trouve déjà.

⚠️ Le garage **n'écrit jamais de numéro** : il déplace une paire déjà numérotée
d'un endroit à l'autre. Aucun des chemins de §5.45 n'est touché.

### 2. Les listes Ventes et Achats en deux colonnes (ordinateur)
Une ligne de vente sur **1170 px** pour une photo, un titre et un prix, c'est le
même défaut que les cartes d'action de Ma journée (§5.62). Les deux listes
passent en `repeat(auto-fit, minmax(430px, 1fr))` + `alignItems:'start'` :
**deux colonnes** au-delà de ~900 px, **une seule** en dessous — la même règle
pour les deux, **sans test de largeur en JavaScript**. Le téléphone est
strictement inchangé.

⚠️ **Largeur de lecture portée de 980 à 1180 px** : sur un écran de 1512, 980 px
laissait 230 px de vide à droite — ni rempli ni centré, ça se lisait comme un
décalage. À 1180 px, avec les listes en deux colonnes, la ligne ne redevient pas
trop longue.

### Vérifié
Banc de rangement dédié : deux taps sur une case → feuille → N°154 posé
(`Étagère:3_2=154`, la gravité le fait tomber en bas de colonne) → le panneau
affiche **« Étagère (1) · 1 boîte rangée »** avec photo et titre → « sortir » →
la case revient à **`[]`**. Rendu ordinateur (1512×950) : barre latérale, les
9 écrans groupés, listes Achats **en deux colonnes**. Rendu final à 1180 px :
**0 écran vide, 0 artefact**. Mobile 430 px rejoué : **0 écran vide** — le shell
n'a rien changé au téléphone. 9 audits au vert.

---

## 5.64 — LE PRIX D'ACHAT SE RELIE EN UN TAP (et le barème n'existe plus en deux exemplaires)

État inchangé depuis §22 : **0 prix d'achat sur 225 paires**, donc tout le
bénéfice, la marge, la « meilleure marque » et le rapport comptable tournent
avec un **coût de zéro**. La saisie en série existait (§5.47) mais il fallait
**taper** 225 fois ; le sélecteur d'achat classait bien les candidats (§5.23,
§5.38, §5.51) mais il fallait l'ouvrir **paire par paire**.

### 1. ⚠️ LE BARÈME VIVAIT DANS UN COMPOSANT
Le score de pertinence était écrit **à l'intérieur de `openPicker`**. Deux
conséquences : la modale de saisie en série ne pouvait pas s'en servir, et le
banc `prix.mjs` devait en **RECOPIER les poids** — deux barèmes qui finissent
par diverger, exactement ce que §11 interdit (c'était même écrit dans la note de
§5.38 : « si les poids changent d'un côté, les remettre des deux »).

➡️ **`refAchat(item)` / `scoreAchat(ref, o)` / `SEUIL_SUGGERE`** vivent au niveau
module. `openPicker`, la modale de saisie et le badge « suggéré » lisent la même
chose. Le `12` recopié dans le rendu devient la constante.

### 2. La suggestion s'affiche dans la liste, un tap la relie
- Les achats sont chargés **UNE SEULE FOIS** pour toute la modale
  (`fillBuyAchats`), pas une fois par paire — la même lecture que le sélecteur,
  refaite 225 fois ce serait le trou d'égress de §34.
- `fillBuySugg` retient le meilleur candidat **≥ `SEUIL_SUGGERE`** par paire, et
  sert les lignes **dans l'ordre de la liste** (ventes au plus gros CA d'abord).
- ⚠️ **Un achat ne peut être proposé qu'à UNE SEULE paire.** Sans ça, deux paires
  au même titre se voyaient proposer le même achat, donc **le même coût compté
  deux fois**. Un achat retenu sort du pot (`pris`), et `linkedBuyIds` exclut
  d'entrée ceux déjà reliés.
- `linkBuyForKey` écrit comme `choosePick`, **instantané compris** (`buyFrom`,
  §5.36) : sans lui, réafficher la photo et le reçu de l'achat obligerait à
  recharger les ~700 achats.
- ⚠️ **Rien n'est écrit tout seul** : la suggestion s'affiche, c'est lui qui tape
  dessus. La règle de §22/§5.23/§5.38 tient — mieux vaut un blanc qu'un faux.

### 3. ⚠️ MARQUE + POINTURE + COULEUR FONT EXACTEMENT LE SEUIL
En regardant les 19 premières suggestions produites sur les vraies données, 18
étaient justes et **une ne l'était pas** :
`« nike zoom fly 5 bleu et blanc 45 » ← « Baskets Nike blanche et grise
pointure 45 » (payé 30,23 €, revendu 24 €)`.
4 + 4 + 4 = **12**, soit le seuil pile, alors que l'achat ne porte **aucun
modèle** — c'est le piège nommé en §5.23 : « nike » + « 45 » désigne des
centaines de paires.

⚠️ **Ma première correction n'a pénalisé qu'un sens** (paire avec modèle / achat
sans modèle). Re-mesuré : **le même achat générique est aussitôt reparti sur une
AUTRE paire** dont le modèle n'est pas reconnu non plus (« Nike zoom vapor pro
Carlos Alcaraz blanc 45 »). Dès qu'il manque le modèle **d'un côté OU de
l'autre**, la preuve est insuffisante → **−3** (un manque, pas une
contradiction : on ne descend pas à −6).

**Mesuré : 19 → 17 suggestions.** Les 2 perdues sont les 2 génériques. Une
troisième, correcte, disparaît aussi (« salomon XT-6 noir 38 » ← « Salomon
schwarz 38 ») : l'achat n'a pas de modèle reconnu. **Rien n'est perdu pour
autant** — la paire reste dans la liste avec son champ, et le sélecteur la
classe toujours en tête ; c'est seulement le badge qui ne s'allume plus.

Les **17 restantes** ont toutes la même marque, le même modèle et la même
pointure des deux côtés, couleur compatible.

### Vérifié
`npm run build` OK · banc `fillbuy.cjs` (vraies données) : 196 paires listées,
**17 achats retrouvés**, le tap relie (`N°9 → 22,05 € · Adidas spezial 39.5`),
**0 achat relié deux fois**, Entrée passe toujours au champ suivant, **0 erreur
d'app** · `audit-identite` **40 contrôles**, dont **3 réancrés/ajoutés qui
échouent bien sur le code d'avant** (§21) : le barème compare des ensembles de
couleurs à son nouvel emplacement, un titre générique ne peut plus atteindre le
seuil, le seuil est une seule constante · 8 autres audits au vert.

### 5.64 (suite) — L'URGENCE DES COLIS ÉTAIT UN SECOND BLOC POUR LE MÊME ENSEMBLE

Même famille que le doublon des Annonces, vue en capture sur l'écran **Colis** :
```
[vert]  3 colis à envoyer · 0 bordereau prêt · 3 en attente de bordereau
[rouge] 3 à poster en priorité — du retard · 3 en retard
```
Deux blocs consécutifs pour **les mêmes 3 colis**. §5.17 avait déjà corrigé le
*vocabulaire* de ce bandeau (« à poster en priorité » au lieu de « colis à
expédier ») pour qu'on ne croie pas à une contradiction — mais quand **tous** les
colis sont urgents, les deux ensembles sont identiques et le second bloc n'ajoute
que le détail.

Cause structurelle : le calcul d'urgence vivait **dans le bloc de rendu** du
bandeau rouge, donc le bandeau du haut ne pouvait pas savoir si l'urgence
couvrait tout ou une partie.

➡️ **`urgenceColis()` et `nAPoster()` au niveau du composant, une seule fois.**
Le bandeau rouge ne s'affiche plus que si l'urgence est un **sous-ensemble
strict** ; sinon la ligne d'urgence passe dans le sous-titre du bandeau du haut,
en rouge. Les deux conditions sont complémentaires : exactement un des deux
s'affiche.

**Vérifié au rendu** : « 3 colis à envoyer · 0 bordereau prêt à imprimer · 3 en
attente de bordereau · **3 en retard — les plus urgents sont en haut de la
liste** » en un seul bloc, les cartes remontent d'un cran. 9 audits au vert,
smoke **0 PAGEERROR, 0 écran vide, 0 suspect**.

---

## 5.65 — ⚠️ REFONTE TOTALE : PAPIER, ENCRE, VERMILLON (on ne reconnaît plus l'app)

Julien, **quatre fois**, la dernière avec de l'agacement légitime : « je veux
que ça soit choquant tellement c'est bien que limite on ne reconnaisse pas
l'application — les couleurs, les formes, tout ». Les passes précédentes
(§5.54, §5.58, §5.61, §5.62) retouchaient une identité qu'elles gardaient. Ici
on **change de famille**, pas de nuance.

### La direction
| | avant | maintenant |
|---|---|---|
| fond | ardoise froide `#f1f4f2` / `#0a0e11` | **papier chaud** `#EFE8DC` / encre `#151110` |
| accent | vert émeraude `#00875a` | **vermillon** `#D2401E` / `#FF6B3D` |
| formes | arrondis 10-16 px | **carré, 3-4 px** (582 rayons convertis, pastilles 999 → 3) |
| profondeur | ombres douces empilées | **filets nets** — une carte est imprimée, pas posée |
| titre d'écran | 23 px + pastille ronde teintée | **manchette** : trait d'accent, titre 27-38 px, filet d'encre 2 px |
| chiffres | trois cartes grises « KPI » | **hors de la boîte** : filet d'accent en haut, nombre en 34 px |
| police d'affichage | Bricolage Grotesque | **Space Grotesk** |
| fond de page | lueur radiale verte | **trame de papier** (la page a une matière, pas une source de lumière) |

### ⚠️ LE CHROME EST À L'ENCRE, MÊME EN CLAIR
Nouveaux jetons **`chrome` / `onChrome` / `chromeMuted` / `chromeLine`** : la
**navigation** (barre latérale sur ordinateur, barre du bas sur téléphone) est
un bloc d'encre contre la page papier. C'est la signature qui rend l'app
reconnaissable en une seconde.
Ça règle aussi un vrai défaut vu en capture : `C` est une **variable de module
mutable** (§4), donc un composant qui ne se redessine pas garde les couleurs de
l'ancien thème — la barre latérale restait sombre sur une page claire. Avec un
jeton dédié, ce n'est plus une incohérence, c'est le dessin voulu.

### Ce qui n'a PAS changé, volontairement
- **Aucune donnée, aucune règle métier touchée.** Uniquement les jetons, les
  rayons et quatre primitives (`ScreenHead`, `StatBox`, `SideBar`, `BottomBar`).
- Le mode sombre reste disponible et suit la même identité (encre chaude, même
  vermillon éclairci pour tenir le contraste sur le brun).
- Le grain de §5.61 est conservé (passé à 4,5 % en `multiply` : sur du papier il
  doit se voir), les états de boutons aussi.

### ⚠️ Le surtitre a failli répéter la marque
Première version : un surtitre « VRM » sur **chaque** écran — la marque est déjà
dans la barre de navigation, juste à côté. Remplacé par un simple trait
d'accent : la manchette garde son rythme sans rien répéter.

### Vérifié
`npm run build` OK · **9 audits au vert** · rendu ordinateur 1512 px en mode
**papier** ET en mode **encre** : manchette, filets, chiffres hors boîte, rail
d'encre, badges N° vermillon carrés · rendu mobile 430 px : barre du bas à
l'encre, cartes d'action carrées.

### ⚠️ ET UNE RÉGRESSION À MOI, ATTRAPÉE EN CAPTURE MOBILE
Les listes Ventes/Achats passées en deux colonnes (§5.63) utilisaient
`repeat(auto-fit, minmax(430px, 1fr))`. **`minmax(Npx, 1fr)` force une piste de
N px** : sur un écran de 430 px, une fois les marges enlevées, la grille déborde
et le prix se coupe au bord droit. Vu en capture, invisible pour le smoke (il ne
lit que le texte). Correctif standard : **`minmax(min(430px, 100%), 1fr)`** —
6 grilles corrigées, y compris les cartes d'action de Ma journée.

---

## 5.66 — « IL Y A TROP D'INFORMATIONS PARTOUT » : la passe MOINS

Julien, photos à l'appui : avant de voir **un seul colis** ou **une seule
annonce**, il fallait passer cinq à sept blocs de conseils, de diagnostics et
d'explications. Il a raison, et c'est mesurable.

### Ce qui a été SUPPRIMÉ (pas replié — supprimé)
| bloc | pourquoi |
|---|---|
| **la description sous chaque titre d'écran** | elle explique ce que fait l'écran : on la lit UNE fois, puis c'est du bruit tous les jours, en haut de chaque page. Le texte reste passé par les appelants — rien à réécrire si on veut le remettre pour un nouveau venu. |
| **« N j sans capture de l'extension »** | doublon : la ligne « X annonces viennent d'un compte dont les données datent » dit déjà la même chose, juste sous les puces de comptes — donc à côté de ce qu'elle qualifie, et repliée. |
| **« Un compte masqué n'apparaît ni dans les annonces ni dans la compta… »** | règle qu'on comprend au premier tap, affichée en permanence. |
| **« Les numéros se mettent automatiquement (modifiables à la main)… »** | mode d'emploi permanent. Le prochain numéro libre reste visible là où il sert : dans le champ N° d'une paire qui n'en a pas. |

### ⚠️ TROIS DÉPLIANTS DE CONSEILS EMPILÉS → UN SEUL
« N signalements », « N paires qui te reviennent » et « Conseils &
signalements » posaient **trois lignes à ouvrir, l'une sous l'autre**, avant la
moindre annonce. Les deux premières rejoignent la troisième, qui existait déjà
et comptait déjà ce genre de choses. **Un seul endroit où regarder**, avec un
compteur unique.

### Ce qui RESTE au-dessus de la grille, et pourquoi
1. le titre ;
2. **le numéro porté par deux annonces** — le seul défaut irréversible de l'app
   (§19), il ne se replie pas ;
3. les **puces de comptes** — une commande, pas un conseil ;
4. le bandeau de stats — une ligne, un chiffre par métrique ;
5. **un** dépliant « Conseils & signalements ».

### Mesuré
| | ce matin | maintenant |
|---|---|---|
| première annonce | **1146 px** du haut | **490 px** |
| hauteur de la page Annonces | 3262 px | 2606 px |
| blocs avant la grille | 9 | **5** |

### Vérifié
`npm run build` OK · 9 audits au vert · smoke 11 écrans, 0 écran vide,
0 PAGEERROR · rendu ordinateur : la grille d'annonces est visible sans défiler.

### 5.66 (suite) — DES COULEURS DE L'ANCIENNE IDENTITÉ SURVIVAIENT EN DUR
Les badges N° des colis s'affichaient encore en **vert menthe** au milieu d'une
app vermillon. Cause : `INV_STATUS` portait quatre teintes **codées en dur**
depuis l'origine (`#22a06b`, `#2f80ed`, `#c0392b`, `#f39c12`) — elles ne lisent
pas `C.*`, donc elles survivaient à tous les changements de palette et
réimportaient l'ancienne identité par petits morceaux.
Alignées sur la famille papier/encre. Et le **N° d'un colis** passe à l'accent :
c'est L'information de cette carte (on le recopie sur le carton), pas une
couleur d'état.
⚠️ **À vérifier après tout changement de palette** : `grep -oE '#[0-9a-fA-F]{6}'`
sur `src/App.jsx` — ce qui n'est pas dans `THEMES` ne suivra pas.

---

## 5.67 — PLUS MINIMALISTE : l'écran Ventes passe de 11 blocs à 7

Julien : « ça ne me convient toujours pas, je veux que ce soit **plus
minimaliste** ». La passe §5.66 avait traité Annonces ; **Ventes était le pire
écran** et n'avait pas été touché — mesuré, **onze blocs** avant la première
vente.

### La règle, tenue jusqu'au bout
**Au-dessus de la liste, uniquement : un réglage, un chiffre, ou une vente.**
Tout le reste descend dans « Analyse de tes ventes », qui existait déjà.

| bloc | où il va |
|---|---|
| « 3 colis à expédier · 3 en retard » | **dans Analyse** — il a son propre écran (Colis) ET sa tuile sur Ma journée. Trois endroits pour la même action. |
| la grande carte « Argent en attente » + son détail par compte | **dans Analyse** — mais le **montant reste un chiffre visible** : il prend sa place dans la rangée (`EN ATTENTE · 807 € · 25 en cours`). C'est ce que Julien vient regarder ; c'est le pavé explicatif qui partait. |
| « 1 vente repérée via bordereau » | dans Analyse |
| « Ventes par jour » | dans Analyse |
| **« Rétrospective 2026 »** | dans Analyse — deux lignes « regarder des chiffres » l'une sous l'autre, c'était une de trop |
| « 112 ventes finalisées sans prix d'achat » | dans Analyse — **le chiffre est déjà dans la rangée** (`COÛT D'ACHAT · 0/112 renseigné`) |
| « 100 ventes masquées sur la période » | dans Analyse |

### Ce qui reste, dans l'ordre
titre · recherche · **quatre chiffres** · une ligne « Analyse » · filtres ·
période · la ligne des ventes masquées · la liste.

### ⚠️ Un champ qui n'existait pas
La nouvelle case affichait `EN ATTENTE —` : j'avais écrit `totals.attente`, le
champ s'appelle **`totals.enAttente`**. Vu au rendu, pas à la relecture — le
build ne dit rien d'une propriété absente.

### Mesuré
| écran | blocs avant le contenu |
|---|---|
| Ventes | **11 → 7** |
| Annonces | 9 → 5 (§5.66) |

### Vérifié
`npm run build` OK · 9 audits au vert · smoke 11 écrans, 0 écran vide,
0 PAGEERROR · rendu ordinateur relu : les ventes commencent juste sous les
filtres.

---

## 5.68 — LE TÉLÉPHONE : mesuré à 390 px, pas à l'œil

Julien : « ça ne me va toujours pas surtout sur mon téléphone, le rendu ne me
va pas ». Les deux passes précédentes (§5.65 identité, §5.66/§5.67 densité)
avaient été **vérifiées sur grand écran**. Rendu à **390×844** (iPhone), le
défaut saute : ce n'est pas le style, c'est que **tout ce qui était sur une
ligne passait sur trois ou quatre**.

### Ce que la mesure montrait
| écran | rangées empilées |
|---|---|
| en-tête | **8 éléments** : retour, icône VRM, mot « VRM », nuage, heure de synchro, loupe, cloche, rouage |
| Ventes | filtres sur **2 rangées**, période sur **3** |
| Annonces | puces de compte sur **4 rangées**, stats sur **3** |
| lignes de vente | titre coupé à ~15 caractères (« adidas spezial n… ») |

### La règle : `flexWrap:'wrap'` → une seule rangée QUI DÉFILE
`flexWrap:'nowrap'` + `overflowX:'auto'` + `WebkitOverflowScrolling:'touch'` +
`scrollbarWidth:'none'`/`msOverflowStyle:'none'` sur le conteneur, et
**`flexShrink:0` + `whiteSpace:'nowrap'` sur CHAQUE enfant**.
⚠️ **Les deux moitiés sont obligatoires** : sans `flexShrink:0`, les enfants se
compriment jusqu'à l'illisible **au lieu de défiler** — le conteneur ne déborde
jamais, donc rien ne défile. C'est le piège de §26 (une pastille écrasée à 0 px
plutôt que renvoyée à la ligne), dans l'autre sens.
⚠️ `alignItems:'center'` sur le conteneur, sinon chaque pastille s'étire à la
hauteur de la plus grande.

Appliqué aux 5 rangées : période (`PeriodePicker`), filtres Ventes, filtres
Achats, puces de compte (Annonces), bandeau de stats (Annonces).

### L'en-tête : 8 éléments → 6
- **Le mot « VRM » était écrit deux fois** — l'icône carrée porte déjà les
  lettres. Le mot seul reste dans la **barre latérale**, sur ordinateur.
- **L'heure de synchro est retirée** : l'icône de nuage dit déjà si c'est
  synchronisé, l'heure exacte est dans Réglages (comme le numéro de version,
  §5.54).

### Deux corrections de fond
- **`StatBox`** : les tailles étaient des **pixels fixes** (34 / 28 / 21 …),
  calibrées sur un écran large. Elles passent en `clamp(min, vw, max)` — le
  chiffre rétrécit avec l'écran au lieu de déborder de sa colonne.
- **Titre d'une ligne de vente** : `nowrap + ellipsis` coupait à ~15 caractères
  sur 390 px, donc deux paires de la même marque étaient indiscernables. Passe
  en **deux lignes** (`-webkit-box` + `WebkitLineClamp:2`).

### ⚠️ Le contrôle qui manquait au banc : le DÉBORDEMENT HORIZONTAL
Un écran trop large **ne lève aucune erreur** et ne compte pas comme vide — le
smoke passait au vert pendant que la page débordait. `telall.cjs` compare
`documentElement.scrollWidth` à `clientWidth` sur **les 11 écrans à 390 px** et
**nomme l'élément coupable** quand ça dépasse. C'est le pendant du contrôle
« écran vide » de §5.56 : *un défaut de mise en page ne se voit ni au build, ni
au compte d'erreurs — il faut le mesurer.*

### Vérifié
`npm run build` OK · banc **telall.cjs à 390×844 : 11 écrans, 0 DÉBORDEMENT,
0 ÉCRAN VIDE, 0 PAGEERROR, 0 artefact** (les lignes console restantes sont le
400 volontaire de `select=owner` et les resets de fin de test) · captures
relues (Ma journée, Achats, Ventes, Annonces, Colis) · **9 audits au vert** ·
smoke complet inchangé.

---

## 5.69 — ⚠️ LE CA DU JOUR VENAIT DES EMAILS · le numéro d'une paire vendue avant d'être captée · menu en haut

### 1. ⚠️ « Les ventes d'aujourd'hui, ça ne représente pas 45 € » — il avait raison
Mesuré avant de coder : la base porte **13 ventes / 152 €** pour le 26 août,
l'app affichait **45 € / 9 paires**.

**Cause** : la tuile « Vendu aujourd'hui » et le bloc « Ta semaine » de Ma
journée se calculaient sur les **emails de vente** (`email_sale_*`), avec en
commentaire « même source que le tableau de bord ». **Faux depuis §33** : le
tableau de bord est passé à la moisson Vinted, précisément parce que les emails
en voient moins (12 ventes / 308 € là où la moisson en voit 17 / 437 €). Un
email n'arrive pas pour tout : offres acceptées, lots, et **2 comptes sur 8**
dont la boîte ne transfère rien (§5.47).

- **`montantCommande(o)`** (module-level) = LA lecture du prix. Vinted rend un
  **objet** `{amount, currency_code}` : `Number(o.price)` donne NaN et la somme
  tombe à 0 — deux faux diagnostics déjà causés par ça (§5.27).
- **`bilanVentes(depuis, jusqua)`** = LA règle (§11) : ventes moissonnées, par
  date de vente, hors annulées, hors ventes masquées et comptes masqués
  (`isHidden`, déjà partagé par tout l'écran Ventes). Les deux tuiles la
  consomment ; elles ne peuvent plus contredire le tableau de bord.

**Mesuré après, au rendu réel** : jour **45 € / 9 → 152 € / 13** · semaine
**24 ventes / 409 € → 56 / 1 129 €**. Les deux correspondent à l'euro près au
recomptage direct dans la base.

### 2. Le trou qu'il a vu venir : poster du téléphone et vendre en direct
Julien : « si je poste une annonce sur ma tablette et que je la vends en direct,
l'extension n'a pas eu le temps de capter l'annonce en ligne, elle a juste la
vente — donc elle va devoir écrire un numéro pour la vente ».

C'est exact, et c'est prévu (`autoShip`, **98 cas en base**). **La suite ne
l'était pas** : quand l'extension capte enfin le dressing et que Vinted a
**laissé l'annonce ouverte** (ça arrive, §5.39), cette annonce arrive sans
numéro. La numérotation automatique ne réutilisait que `numeros` (les annonces
déjà numérotées) — **jamais `saleOv`** — donc elle lui donnait un numéro NEUF.
Le carton porte N°A, l'app affiche N°B pour la même paire : c'est le risque n°1
(§19), avec un numéro qui ne se reprend jamais (§5.40), donc **définitif**.

Mesuré le 26 août : **0 conflit aujourd'hui** (les annonces vendues sont presque
toujours fermées par Vinted). On ferme un trou latent — le bon moment.

- **`numVentesParIdentite`** : les numéros déjà posés sur des ventes, indexés par
  identité **certaine** (item_id Vinted, sinon photo ; une photo portée par deux
  ventes de numéros différents est écartée). Jamais par titre (§5.34).
- La numérotation des annonces le consulte **avant** de créer un numéro.
- **Elle n'écrit plus rien tant que les ventes et les identités n'ont pas
  répondu** (`sales.items === null || !txnPret`). Sinon elle grave d'abord et
  découvre l'identité ensuite : au banc, la paire recevait N°319 alors que son
  carton portait N°777, et le second passage ne pouvait plus rien corriger.

### ⚠️ 3. LE DÉFAUT PLUS GRAVE TROUVÉ EN CHERCHANT CELUI-LÀ
L'effet « le cloud est arrivé » relisait `vinted_annonce_numeros` et
`vinted_used_numeros` depuis le localStorage… **mais pas
`vinted_sale_overrides`**. Sur un appareil neuf (localStorage vide au premier
rendu), la numérotation voyait donc **toutes les ventes sans numéro**, leur en
attribuait, et `setSaleOv({ ...saleOv })` repartait d'un objet **VIDE** — les
**361 numéros de vente** pouvaient être remplacés par du vide.
Le commentaire de l'effet de numérotation annonçait justement cette protection
(« sans ça, au démarrage `saleOv` est vide → l'app écrase les numéros saisis à
la main ») ; **elle n'existait pas**.
➡️ **Règle : tout état initialisé par `load(...)` ET réécrit ensuite par un
effet automatique doit être rechargé dans `onCloudReady`.** `hiddenSales` a été
ajouté au passage (le CA du jour en dépend maintenant).

### 4. Ergonomie — ce qu'il a demandé, mot pour mot
- **« Pour les offres reçues, tu peux juste mettre le nombre »** : six cartes
  avec photo, titre, date et deux boutons chacune (~300 px sur l'accueil) → une
  ligne « N offres reçues » + Répondre + tout marquer traité. Une offre se
  répond sur Vinted de toute façon (§5).
- **« Un menu déroulant à gauche, en haut, plutôt qu'en bas avec le plus »** :
  `MenuEcrans`. Le bouton « Plus » disparaît de la barre du bas — c'était un
  **sixième bouton d'un genre différent des cinq autres** (il n'ouvrait pas un
  écran mais une liste) et **son libellé changeait selon l'écran affiché**, donc
  la barre n'avait jamais tout à fait la même tête. Elle porte maintenant les
  cinq écrans du quotidien, un point c'est tout. ⚠️ Absent sur ordinateur : la
  barre latérale montre déjà les neuf écrans.
- **« On dirait quelque chose de brouillon »** : « Ta semaine » et les quatre
  cartes d'action étaient des encadrés teintés empilés, **quatre couleurs à la
  suite**. Surface neutre ; la couleur reste sur l'icône et les chiffres. Il ne
  reste qu'**une** zone teintée sur l'accueil : le chiffre du jour.
- **Ventes** : les quatre libellés sous la barre de progression sont retirés (la
  pastille de statut, trois lignes plus haut, dit déjà l'étape — la même
  information deux fois, une ligne de texte par vente).
- **Colis** : « N bordereaux sans vente correspondante » était un pavé de cinq
  lignes d'explication en permanence, au-dessus des colis, pour un cas qui ne
  demande aucun geste. Gabarit `Notice` : une ligne + « Pourquoi ? ». La
  première carte remonte d'environ 90 px.

### ⚠️ 5. `ICON_PATHS` ATTEND DU JSX — deux icônes ne se dessinaient pas
Trouvé en ajoutant l'icône du menu : `Icon` fait `{d}` dans la `<svg>`, donc une
**chaîne** y devient du **texte** — invisible. `pin` et `nav` étaient des chaînes
depuis leur ajout (§5.26) : **les deux repères des points relais n'ont jamais
été dessinés**. Corrigées, et le commentaire le dit à côté de la table.

### Vérifié
`npm run build` OK · **9 audits au vert**, dont **4 contrôles permanents
ajoutés** à `audit-identite.cjs` qui **échouent bien sur le code d'avant** (§21 :
la première tentative de preuve lançait le script depuis `/tmp`, où il plantait
sur un chemin absent — **un test qui ne s'exécute pas ressemble à un test qui
passe**) · banc dédié du scénario (vente au N°777, annonce captée ensuite) :
avant **N°319**, après **N°777** · banc de numérotation : 28 annonces, **0 sans
numéro, 0 numéro qui bouge** · **11 écrans à 390 px** sans débordement, écran
vide, erreur ni artefact · captures relues (Ma journée, Ventes, Colis, menu
ouvert).

### ⚠️ Piège de banc rencontré (§21, encore)
`num_tous.cjs` choisissait sa fixture parmi **toutes** les annonces des lignes
moissonnées — y compris celles d'un compte **sans jetons** (3170782324), que
l'app ne charge jamais (§5.20/§5.21). Il concluait « l'annonce dépouillée n'a
rien reçu » pour une annonce invisible. Le banc filtre désormais sur les comptes
vivants.

### ⚠️ RIEN DE CETTE SESSION N'EST EN PRODUCTION
`origin/main` est au **25 août** (PR #55). La branche `claude/new-session-gzdgur`
a **29 commits d'avance** et **aucune pull request n'est ouverte** pour elle.
C'est l'explication complète du « on dirait que tu n'as rien fait » : tout est
poussé sur la branche, rien n'est déployé. Le déploiement se fait en ouvrant une
PR depuis cette branche et en la fusionnant — c'est **la décision de Julien**,
l'agent n'ouvre pas de PR de lui-même.

---

## 5.70 — LE RÉCAP D'ARRIVÉE (extension 5.40) + le coffre qui se remplit + les ventes masquées chiffrées

### 1. ⚠️ « LA GÉNÉRATION A DU MAL À SE FAIRE » — deux causes, toutes deux mesurées

**a) Le mémo « déjà demandé » partait AVANT l'envoi.** `proposerBordereaux`
écrivait `vrmPropose[tx] = now` puis envoyait le message à l'onglet. Or on
arrive **3 s après le chargement** (§5.19) : si le script de page n'est pas
encore prêt, `sendMessage` échoue en silence — la fenêtre ne s'affiche jamais
**et la vente est marquée « demandée » pour 20 h**. La question ne revenait donc
plus. ➡️ On ne note « déjà montré » **que si un onglet a réellement reçu**.

**b) 3 comptes sur 9 ne peuvent PAS générer.** Relevé du 26 août :
| adresse d'envoi captée | comptes |
|---|---|
| ✅ oui | julatace35260, llloollllaa, tomj606, julienf765, tomj683, angeled92 |
| ❌ non | **julatace3535**, arthuror2, liliand653 (masqué) |

Et sur les **2 ventes qui attendaient un bordereau ce jour-là**, une était
justement sur `julatace3535`. Le refus était honnête mais ne se débloquait qu'en
générant un bordereau **à la main** une fois.
➡️ `adresseVendeur(uid, acc)` garde la capture comme source première, puis
**demande ses propres adresses** (`GET /api/v2/user_addresses`) — une lecture,
sur son compte, **derrière le garde-fou** (compte connecté, plafond 20/h), et
mémorisée localement. ⚠️ La forme de la réponse **n'a jamais été observée** :
lecture défensive (`idDAdresse`, plusieurs noms de champ), et si rien ne
ressemble à une adresse **on ne prétend rien** et on garde un échantillon dans
`panel_diag_capture` (§5.24).

⚠️ **CORRECTION D'UNE DE MES MESURES (§21, encore)** : mon premier script
annonçait « **aucun** compte n'a d'adresse ». Faux — le corps est stocké en
**chaîne JSON**, donc `JSON.stringify(row.data)` échappe les guillemets et mon
motif `"seller_address_id"` ne pouvait pas matcher. La vraie réponse est 6 sur 9.
**Vérifier la FORME du champ avant de conclure à un zéro.**

### 2. LE RÉCAP : « ça ne s'allume que s'il y a du nouveau »

Demande, en deux temps : *« je veux avoir AU MILIEU DE MON ÉCRAN un message qui
me dit si j'ai fait une vente et qui me demande si je génère les bordereaux —
oui, non, et seulement cela »*, puis *« il ne faut pas que ça s'allume s'il n'y
a rien ; ou alors ça peut faire un résumé de tout ce qui s'est passé, ça
m'évite d'aller dans les messages, dans les notifications »*.

- **`nouveautes(uid)`** compare l'état courant à un repère posé au **dernier
  récap montré** (`vrmRecapVu`, local, aucun égress) : ventes nouvelles (+
  montant), messages non lus **qui ont bougé**, offres en attente, bordereaux à
  générer. **Zéro requête Vinted** : tout vient de la moisson déjà en base.
- **Rien de neuf ⟹ aucun message n'est envoyé** : la fenêtre ne s'ouvre pas.
- La fenêtre affiche **une ligne par nouveauté** et ne pose la question
  **OUI / NON** que s'il y a vraiment un bordereau à générer ; sinon **un seul
  bouton « Fermer »** — c'est une information, pas une question.
- **« Oui »** enchaîne les ventes **une par une en attendant la réponse** de
  Vinted (§5.36) — jamais un lot lâché d'un coup, **aucune temporisation
  « faussement humaine »** (§32) : c'est le rythme du réseau. Un refus du
  garde-fou **arrête la série** (les suivantes taperaient le même mur).

⚠️ **Deux garde-fous à ne pas retirer :**
1. **Première visite sur un compte** : on pose le repère **sans** annoncer tout
   l'historique comme une nouveauté (sinon « 40 ventes ! » au premier passage).
2. Une **conversation non lue laissée exprès** ne resonne pas ; elle resonne dès
   qu'un nouveau message y arrive (comparaison sur `updated_at`) — même règle
   que le bandeau de notification de l'app (§7).

⚠️ **Honnêteté sur « depuis que j'ai fermé la session »** : on ne sait pas quand
il ferme Vinted. Le repère est « **depuis ton dernier passage** » (= le dernier
récap montré) — c'est observable, et c'est ce qui est écrit dans la fenêtre.

**`scripts/audit-recap.cjs`** (nouveau) exécute le VRAI code du service worker
dans un `vm` : **7 contrôles**, et **3 échouent bien sur le code d'avant**.

### 3. Ergonomie du panneau : 12 pastilles → 6 + « Plus »
Douze onglets sur trois rangées, c'est un mur : on ne lit plus, on cherche. Même
remède que la barre du bas de l'app (§5.53) — **Ma journée · Cette paire\* · Mes
paires · Bordereaux · Achats · Messages** restent visibles, le reste (Ventes,
Chercher, Coffre, Litiges, Favoris) passe derrière **« Plus »**, qui porte leurs
badges et s'allume quand l'onglet affiché vient de derrière.
⚠️ **L'onglet « Republier » est RETIRÉ** (« ne mets pas l'onglet republié, ce
n'est pas obligé »). `renderRepublier` reste dans le fichier mais **plus rien ne
l'ouvre** — même parti pris que « Renuméroter à la suite » côté app (§5.45).
⚠️ `svgi()` ne dessine que ce qui existe dans `ICONS` : `more-horizontal` a dû
être ajoutée. Une icône absente ne lève **aucune** erreur, elle ne s'affiche
simplement pas (même famille que `ICON_PATHS`, §5.69).

### 4. L'extension avait gardé l'ancienne identité
Turquoise `#09b1ba` sur blanc, alors que l'app est passée en **papier/vermillon**
(§5.65) : deux outils du même produit, deux identités. Accent → `#D2401E`,
surface → papier `#EFE8DC`, cartes `#FBF7F0` à coins nets, onglet actif à
l'encre. 60 occurrences remplacées.

### 5. LE COFFRE : 28 fiches sur 45 ne correspondaient à AUCUNE ligne
| | |
|---|---|
| lignes de coffre | **144 · 9 avec leur description** |
| fiches lues sur la page (`vinted_item_details`) | **45, toutes avec leur texte** |
| fiches **sans aucune ligne de coffre** | **28** |

Cause : on n'archivait que les annonces **EN LIGNE**. Or une fiche est lue dès
qu'il **ouvre** une annonce — y compris une paire déjà vendue, et c'est
justement celle-là qu'on veut au coffre (il sert à **recréer** une annonce
disparue, §47).
➡️ `archiverLot(uid, items, tous)` reçoit le dressing **complet** et archive en
plus les articles **fermés dont la page a été lue**. L'identité vient de l'**id
d'annonce Vinted**, et les extras ne peuvent venir que du **dressing du compte** :
une annonce d'un autre vendeur qu'il aurait consultée ne peut pas y entrer.
La passe de complétion tourne désormais **même sans annonce en ligne**.
**Mesuré au banc** (vraies données, écritures capturées, **aucune écriture en
prod**) : **5 nouvelles lignes** de coffre et **13 lignes qui gagnent leur
description** sur 4 comptes ; sur le code d'avant, **0 nouvelle ligne**.
⚠️ Seules **6 des 28** fiches orphelines appartiennent à un compte connu — les
22 autres sont des annonces **d'autres vendeurs** qu'il a consultées. Elles ne
doivent jamais entrer au coffre, et par construction elles ne le peuvent pas.

### 6. Les ventes masquées : le compte ne disait pas l'enjeu
**208 ventes masquées**, dont **131 retrouvées dans la moisson pour 2 927,60 €**
hors de tous les totaux, réparties sur presque tous les mois. La ligne de
l'écran Ventes porte maintenant le **montant**, sépare les deux causes
(masquée **à la main** / **compte** masqué, qui se règle dans Réglages) et
propose **« tout réafficher »** avec confirmation.
Vérifié au rendu : « 131 ventes hors de la compta · 2 928 € », la feuille
s'ouvre, et après confirmation la liste passe de **208 à 0**.

### ⚠️ TOUJOURS PAS EN PRODUCTION
`origin/main` est au 25 août. La branche `claude/new-session-gzdgur` a
**32 commits d'avance** et **aucune pull request ouverte**. Rien de tout ceci
n'est chez Julien tant que la PR n'est pas ouverte puis fusionnée — c'est **sa**
décision, l'agent n'ouvre pas de PR de lui-même.

---

## 5.71 — LE BORDEREAU PART TOUT SEUL · la vente captée vite · N° + prix mini sur les vignettes

### 1. ⚠️ « Est-ce que ça réattribue le numéro d'avant ? » — NON, mesuré
Julien, après un lot vendu puis annulé. Vérifié en base le 27 août :

| | |
|---|---|
| numéros brûlés à vie | **329** · plus haut : 329 · prochain libre : **330** |
| ventes annulées / remboursées | 38 · dont **11 portent un N°** |
| leur numéro est-il toujours pris ? | **11 / 11** ✅ |

`takenNums` est **append-only** (`vinted_used_numeros` + tous les `numeros` +
tous les `saleOv` + les annonces en ligne + le garage) : `freedNums` a été
supprimé en §5.40. **Aucun numéro ne retourne jamais dans le pool**, annulation
comprise. Si Vinted rouvre la MÊME annonce (même id), elle garde son numéro
toute seule ; s'il la repose (nouvel id), elle en reçoit un neuf et le bandeau
♻️ propose de remettre l'ancien — c'est SON clic (§5.45).

### 2. ⚠️ MAIS la paire annulée disparaissait de l'inventaire physique
`porteursNum` ne comptait comme « présente » qu'une annonce en ligne, une vente
qui attend l'envoi, ou une case du garage. Une vente **annulée** n'est ni l'un
ni l'autre → la paire sortait de l'inventaire physique et du panneau « à
ranger » du Garage, **alors qu'elle est sur l'étagère**.
➡️ Une vente annulée **avant l'envoi** garde sa place (`type: 'annulee'`). Une
vente annulée **après expédition** (remboursement) ne compte pas — `venteExpediee`,
preuve certaine (statut Vinted, bordereau capté, ou email de bordereau, par n° de
transaction, jamais par titre).
⚠️ `venteExpediee` a été **remontée avant `porteursNum`** : un `useMemo`
s'exécute immédiatement et ne peut pas lire un `const` déclaré après (§19).
**Déplacée, pas recopiée** (§11). 3 contrôles permanents dans `audit-identite`.

### 3. Le bordereau part tout seul (extension 5.42)
« Une fois que la vente a été faite, je veux que le bordereau soit
automatiquement envoyé dans l'app. » ⚠️ **Retour en arrière assumé sur §5.32**
(où il avait demandé l'inverse) — c'est sa décision, et elle est cohérente avec
§5.29 : générer un bordereau **n'engage aucun argent et ne décide de rien**.
Garde-fous inchangés : compte connecté uniquement, 20 actions/h, **3 par
visite**, pas de nouvel essai avant 6 h.
Le récap **annonce** ce qui est parti (« 2 bordereaux envoyés dans l'app ») et
ne pose la question **OUI/NON** que pour ce qui n'a **pas** pu être généré.

### 4. « Ça prend du temps à ce que la vente soit captée »
C'était le garde de **5 minutes** (`VISITE_DELAI_MS`), qui protège d'une moisson
**complète** (dressing jusqu'à 600 articles, achats, boîte) à chaque page
ouverte. Or « ai-je vendu ? » ne demande **qu'une** liste.
➡️ **`rafraichirVentes(uid)`** rafraîchit les ventes **seules**, au plus une fois
par **90 s**, puis relance la génération et le récap. ⚠️ Ce n'est **pas** un
rythme « faussement humain » (§32) : c'est une limite de volume, comme le
plafond horaire. Réutilise `fetchAllOrders` + `storeHarvestRow` — donc les
garde-fous anti-capture-partielle de §5.19, et **pas une deuxième façon de lire
les ventes** (§11).

### 5. Les erreurs de génération sont MESURÉES, plus supposées
« Il y a des messages d'erreur » — impossible d'aller plus loin sans savoir
lesquels. `genererBordereau` compte désormais `bordereau_genere` /
`bordereau_refuse_<statut>` dans `panel_diag_capture` et garde **un échantillon
de la réponse de Vinted**. Et le message rendu est traduit : 401 = session
expirée, 403 = refus pour ce compte, 404 = cette vente n'attend plus de
bordereau, 422 = Vinted refuse ces informations d'envoi.
➡️ **Prochaine session : lire `panel_diag_capture.rates.bordereau`.**

### 6. Le N° et le prix minimum sur chaque vignette du profil
« Je veux que le prix minimum s'affiche à côté des vues dans l'annonce quand on
est sur le profil, ainsi que son numéro, pour voir d'un coup d'œil. »
`decorerVignettes()` décore chaque lien d'annonce **qui est une des siennes**
(présente dans `DATA.byId`) — jamais celle d'un autre vendeur.
⚠️ **On n'écrit jamais dans le HTML de Vinted** : un enfant en surimpression sur
la vignette. Si Vinted refond sa grille, le badge ne s'affiche pas — rien ne
casse (§4.95). Redécoré au défilement par un `MutationObserver` limité à une
passe / 400 ms.
Vérifié au banc : 2 des 3 tuiles décorées (`N°7 · min 38,00 €` / `N°12 · min ?`),
celle d'un autre vendeur **intacte**, redécoration après ajout dynamique,
0 erreur.

### Vérifié
`npm run build` OK · **11 audits au vert** (`audit-recap` passe à 12 contrôles,
les 3 nouveaux échouent bien sur le code d'avant ; `audit-identite` à 43) ·
smoke app **11 écrans, 0 écran vide, 0 PAGEERROR, 0 artefact** (les 23 lignes
console sont le 400 volontaire de `select=owner` et les resets de fin de test).

### 5.71 (suite) — Le prix plancher se remplit en série (5.43 → 5.44)

**Le badge de la vignette n'était pas remplissable** : il vit DANS le lien de
l'annonce, donc cliquer dessus ouvrait la page Vinted. `pointer-events:auto` +
`preventDefault` + une petite boîte de saisie posée sur `documentElement`.
⚠️ **Piège trouvé au banc** : ma 1ʳᵉ version arrêtait les événements de la boîte
en phase de **CAPTURE**. En capture, `stopPropagation` empêche l'événement
d'atteindre les **descendants** — donc mes propres boutons : « Enregistrer » ne
faisait rien. La boîte n'est pas dans le lien : il n'y a rien à arrêter à la
descente, seulement à la remontée.
Le **N° passe de 11 à 17 px** (gras 800) : c'est ce qu'on recopie sur le carton.

**Et en série, dans « Mes paires »** — mesuré le 27 août : **0 plancher posé sur
255 paires**, donc le copilote d'offres n'a jamais rien à dire et l'acceptation
automatique ne peut pas fonctionner. Un champ `min` par ligne (vue *En ligne*
seulement) + une puce **« 🏷 Sans minimum »**.
⚠️ On n'écrit **pas** à chaque frappe et on ne **redessine pas** la liste (en
tapant « 20 » on passe par « 1 », et un `render()` re-trie sous les doigts —
c'est le défaut corrigé côté app en §5.44). Validation à la sortie du champ ou
sur Entrée.
⚠️ Deuxième piège du même banc : Entrée validait, puis le `blur` qui suit
revalidait la même valeur → **deux écritures pour une saisie**. Le repère doit
être réassigné après chaque validation.
⚠️ **Aucun montant n'est suggéré par défaut** : sans prix d'achat connu (0 sur
255), un plancher inventé pourrait faire vendre à perte (§5.38, §45).

### État mesuré le 27 août (après les correctifs de la session)
| | |
|---|---|
| annonces en ligne | **32 · 0 sans N° · 0 doublon de numéro** ✅ |
| colis à envoyer | **13 · 0 sans numéro · 0 désaccord** entre le N° de l'annonce et celui de la vente ✅ |
| colis sans PDF de bordereau | 4 (3 « étiquette déjà émise » + 1 à générer) |
| coffre | 156 lignes · **28 avec leur description** (9 avant le correctif) |
| **prix d'achat** | **0 / 255** ⚠️ |
| **prix plancher** | **0 / 255** ⚠️ (l'outil de saisie en série existe maintenant) |

---

## 5.72 — ⚠️ LE CODE DE RETRAIT VINTED GO EST DANS LA CONVERSATION, PAS DANS UN EMAIL

Deux captures d'écran de Julien (27 août), prises dans le fil de discussion
Vinted (pas dans sa boîte mail) :

> **Ton colis est arrivé !** Il t'attend à l'adresse suivante : Kusmi Tea,
> 13 Rue Saint-Vincent, 56000 Vannes, France. *Scanne ton code de retrait* ou
> saisis le code **C65735** pour le récupérer.

…et l'écran suivant, le QR en grand + « Tu n'arrives pas à le scanner ? Saisis
le code suivant : **C65735** ».

### Ce que la base disait (mesuré AVANT de coder, méthode §46)
| | |
|---|---|
| conversations captées | **582** |
| types de message | `message` 403 · `offer_request_message` 338 · `offer_message` 189 · **`status_message` 74** · **`action_message` 40** · `portal_message` 3 |
| conversations parlant de retrait | 10 |
| **message d'ARRIVÉE réellement capté** | **1** — `harvest_3156028798_conv_22488948907` |
| conversations **côté acheteur** | **12 sur 343** (Julien vit sur ses ventes) |

Forme exacte du message d'arrivée, relevée en base :
```
entity_type : action_message
title       : « Ta commande est arrivée. »
subtitle    : « Ton colis a été livré dans le Point Relais MAISON DE LA PRESSE,
                40 RUE DU PORT, 35260 CANCALE. Tu peux … aller le récupérer. »
actions     : track_shipment · mark_as_delivered
```
➡️ **L'adresse du relais et le code de retrait sont là — et RIEN ne les lisait.**
Même famille que §5.26 (une ligne en base sans lecteur). Pour Vinted Go, c'est la
**seule** source : aucun email transporteur ne les porte, et 2 comptes sur 8 ne
reçoivent aucun email (§5.47). Sans ça, le colis repart chez l'expéditeur.

### ⚠️ ET UN CODE DE RETRAIT PEUT COMMENCER PAR UNE LETTRE
`codeRetrait` était `/^\d{3,10}$/` — la règle **strictement numérique** posée en
§5.37 parce que le mot « suivant » avait été capté comme code. Vérifié :
`C65735` était **REJETÉ**, `077831` accepté. La règle devient
`/^[A-Z]{0,2}\d{3,10}$/` : au plus deux majuscules devant les chiffres — « suivant »
n'a aucun chiffre, il reste écarté. Même famille que §5.37, dans l'autre sens :
une règle trop large invente un code, une règle trop étroite en cache un vrai.

### Ce qui est livré
- **`retraitDeConversation(conv)`** (extension, fonction **pure**) : sort
  `{tx, item, titre, photo, lieu, code, conv, url}` du **dernier** message
  d'arrivée. ⚠️ **Côté ACHETEUR uniquement** (`current_user_side !== 'seller'`) :
  côté vendeur, « la commande est arrivée » veut dire que l'ACHETEUR l'a reçue.
  ⚠️ « Article à emballer et envoyer … dépose ton colis dans un point relais »
  parle aussi de relais : c'est un colis qui **PART**, jamais un colis à retirer.
  Ni adresse ni code ⟹ `null` (on n'affiche pas une carte vide).
- **`noterRetrait(r)`** → ligne **DÉDIÉE `panel_colis_relais`** (motif
  anti-clobber §35 : l'extension n'écrit jamais `main`), clé = **n° de
  transaction** (identité, jamais un titre §24), purge à 45 j, **aucune écriture
  si rien n'a changé** (§34).
- **À la capture** : `storeHarvest` extrait dès qu'une conversation arrive.
- **`capterRetraits(uid)`** (à chaque visite sur Vinted, après la moisson) : va
  lire la conversation des achats que Vinted dit **« déposés en point relais »**
  et dont on n'a pas le code. ⚠️ Garde-fous identiques au bordereau (§5.29) :
  compte **connecté uniquement** (`garde`), plafond 20 actions/h, **3 par
  visite**, pas de nouvel essai avant 6 h. C'est une **LECTURE** sur ses propres
  achats — elle ne décide de rien, n'engage aucun argent.
- **App** : `colisRelais` (une seule ligne lue, quelques Ko) + `relaisDe(o)`. La
  carte « en point relais » porte désormais **l'adresse**, **le code en 20 px**
  et **« Ouvrir la conversation (QR) ↗ »** — le QR vit dans le fil Vinted, on ne
  le fabrique pas (§17).

⚠️ **Honnêteté** : le code de la capture d'écran (`C65735`) **n'est pas en base**
— sa conversation n'a jamais été ouverte avec l'extension. La chaîne est donc
prouvée sur le message réel (Mondial Relay, adresse sans code) et sur la forme
exacte de la capture ; elle se remplira à sa prochaine visite sur Vinted.

### Vérifié
`npm run build` OK · `node --check` sur les deux fichiers de l'extension ·
**`scripts/audit-retrait-conv.cjs` — 8 contrôles**, et il **échoue bien sur le
code d'avant** (la fonction n'existait pas ; et l'ancienne règle rejetait
`C65735`, mesuré) · **12 audits au vert** · banc app dédié : la fixture
`panel_colis_relais` est produite **par la VRAIE fonction** sur la **VRAIE**
conversation en base, puis l'écran Achats est rendu → **adresse Kusmi Tea, CODE
C65735, adresse Maison de la Presse, lien vers la conversation, 0 erreur d'app**
(capture relue) · vrai `buildPanelData` contre la vraie base : 24 annonces,
80 ventes, 12 colis à poster, 9 comptes — aucune régression · smoke app
**11 écrans, 0 écran vide, 0 suspect**.
⚠️ Le banc du PANNEAU (`panel.cjs`) sort 18 échecs — **tous des artefacts de
banc connus** (`page.click` sur `.vrm-tab`, invisible au sens Playwright, §5.36 ;
plus les onglets passés derrière « Plus » en 5.40). `vinted-panel.js` n'a pas été
touché de la session : ces échecs sont antérieurs.

Extension **5.45.0** — à recharger dans Chrome.

### 5.72 (suite) — ⚠️ « LA VENTE S'EN VA SANS AVOIR ENVOYÉ LE BORDEREAU À L'APP »

Julien : « des fois je génère et la vente s'en va sans même avoir envoyé le
bordereau à l'app… dès que je navigue sur Vinted il doit capter les bordereaux
des ventes où les bordereaux ont été téléchargés ». **Il avait raison, et le
chiffre est gros.**

### Mesuré AVANT de coder, sur la vraie base
| | |
|---|---|
| bordereaux captés par l'extension | 29 lignes · **23 transactions** |
| bordereaux reçus par email | 113 lignes · 112 transactions |
| **ventes de moins de 45 j SANS aucun PDF** (ni capté, ni email) | **90** |
| dont couvertes par l'ancienne 2ᵉ passe | **1** ⚠️ |
| dont **déjà parties** (expédiée / finalisée / au relais) | **89** |
| dont pas encore livrées (donc encore utiles) | **28**, toutes < 21 j |

### La cause, en une ligne
```js
if (!AWAITING_SHIP(o.status) || aGenererBordereau(o.status)) continue;   // ancienne 2ᵉ passe
```
La 2ᵉ passe ne regardait QUE les ventes **encore en attente d'envoi**. À la
seconde où Vinted fait avancer le statut (« expédiée », « finalisée »), on
cessait **définitivement** d'aller chercher le PDF. Or Vinted **fabrique** le
PDF après la génération et le dépose sur S3 : la seule fenêtre où on essayait
était justement celle où ça échoue le plus. D'où « la vente s'en va sans que le
bordereau soit arrivé ».

### La nouvelle règle
Toute vente **récente** (`BORD_RATTRAPAGE_J = 21`), **non annulée**, dont
l'étiquette existe (donc au-delà de « paiement validé ») et dont on n'a **aucun**
PDF — ni capté, ni email. Triée : **ce qui attend TON envoi d'abord**, puis les
plus récentes. Plafond inchangé : **3 par visite**, mémo de 6 h.
- **21 jours** parce que c'est mesuré : les 28 ventes sans PDF qui ne sont pas
  encore livrées tiennent TOUTES dans cette fenêtre, et au-delà le lien de Vinted
  n'existe plus (on ne part pas à la pêche sur 60 ventes finalisées anciennes).
- ⚠️ **On n'insiste (§5.48) que sur une vente qui attend encore l'envoi** : là, le
  PDF est en cours de fabrication. Sur une vente déjà partie, « pas d'expédition
  exposée » ne s'arrangera pas — réessayer 4 fois serait 4 requêtes pour rien
  dans l'empreinte du compte (§5, §48). Mesuré au banc : 1 requête contre 4.

⚠️ Avec 89 en retard et 3 par visite, le rattrapage prend une trentaine de
passages sur Vinted. C'est voulu : discret, et les plus utiles passent d'abord.

### Vérifié
**`scripts/audit-bordereau-rattrapage.cjs`** (nouveau) exécute le VRAI
`genererBordereauxEnAttente()` dans un `vm` et mesure **quelles transactions sont
réellement demandées à Vinted** — **11 contrôles**, dont **5 échouent bien sur le
code d'avant** (§21) : vente expédiée récupérée, vente finalisée récupérée,
plafond de 3, une seule requête sur une vente partie, insistance conservée sur
une vente qui attend l'envoi. Plus : fenêtre de 21 j respectée, PDF déjà capté ou
reçu par email → aucune requête, vente remboursée → jamais.
`node --check` OK · **13 audits au vert** · vrai `buildPanelData` contre la vraie
base : aucune régression.
⚠️ Piège de banc rencontré : mes fixtures utilisaient des identifiants de
transaction **non numériques** (`t1`), alors que le mock n'interceptait que
`/transactions/(\d+)/` — le banc annonçait « aucune demande » pour un code qui
marchait. Identifiants numériques, comme les vrais.

Extension **5.46.0** — à recharger dans Chrome.

---

## 5.73 — UN ENDROIT = UN BLOC (et deux bugs qu'aucun filet ne voyait)

Julien : « améliore encore la réception dans les achats pour les Vinted Go, il y
a les codes de retrait dans la conversation avec le QR code en lien ; je veux que
tu t'améliores pareil pour les QR Chronopost et les codes Mondial Relay ; je veux
bien que tu **sépares les différents endroits pour bien savoir où je vais** ».

### État mesuré avant de coder
| transporteur | lignes de suivi | colis « à retirer » | code | QR | lieu |
|---|---|---|---|---|---|
| Mondial Relay | 79 | **13** | 11 | 0 | 12 |
| Chronopost | 38 | **5** | 3 | 4 | 2 |
| Vinted / Shop2Shop / Colissimo | 10 | 0 | — | — | — |

⚠️ `panel_colis_relais` était encore **ABSENT** : l'extension 5.45 n'avait pas
encore tourné chez lui. Les données Vinted Go arriveront à sa prochaine visite.

### 1. L'ENDROIT devient le niveau principal
Avant : **transporteur** en titre, point relais en dessous. Avec un seul relais
par transporteur, ça faisait un étage de titres pour rien — et **l'adresse, la
seule chose qui décide où on va, arrivait en second**.
Maintenant : **une destination = un bloc** (nom, adresse, horaires, « 🧭 Y aller »),
et les colis dedans. Les blocs sont ordonnés par **urgence** : le point dont un
colis expire le plus tôt d'abord — un colis non retiré repart chez l'expéditeur.

### 2. Le GESTE est écrit SUR la destination — `methodeDuPoint(colis)`
Chaque transporteur remet le colis à sa façon (§28). Le geste vit donc là où on
lit l'adresse, pas répété sur chaque ligne :
| ce qu'on a | ce que le bloc annonce |
|---|---|
| `consigne` ou `code2` | **Consigne automatique** — « Tape l'identifiant puis le code d'ouverture sur le casier » |
| QR seul | **Au comptoir** — « Présente le QR de chaque colis » |
| QR + code mélangés | **Au comptoir** — « QR pour certains colis, code pour les autres » |
| code | **Au comptoir** — « Donne le code de retrait + une pièce d'identité » |
| rien | **Au comptoir** — « Donne ton numéro de colis + une pièce d'identité » |
⚠️ **Dérivé de `retraitMode`**, jamais d'une règle parallèle (§11) : deux règles
pour « comment on retire ici », c'est l'écran et la modale qui finissent par ne
plus dire la même chose. Un contrôle permanent le vérifie.

Les **colis Vinted Go** sont groupés par lieu eux aussi (ils ont une adresse
depuis §5.72). Ceux dont le lieu est encore inconnu restent à part, et on le
dit : « Vinted dit "déposé" — l'adresse arrive avec le message de retrait ».

Chaque ligne de colis ne porte plus que **ce qui lui est propre** : n° de suivi,
jour d'arrivée, date limite, identifiant/code, QR. Le lieu et le geste étaient
répétés trois fois sur un écran de téléphone.

### 3. Le LIEN du QR, capté depuis la conversation
« Scanne ton code de retrait » est une **ancre HTML** dans le message Vinted Go.
`retraitDeConversation` la retient (`qr`) et l'app propose **« Voir le QR de
retrait ↗ »**, sinon **« Ouvrir la conversation (QR) ↗ »**.
⚠️ **Un lien qui ne mène nulle part n'est pas un lien** : dans les messages
réellement captés, la plupart des ancres valent `href="/"` (Vinted les recâble
côté client). Ouvrir la page d'accueil au lieu du QR serait pire que pas de
bouton. Un `href` relatif est remis sur `vinted.fr`.

### ⚠️⚠️ 4. DEUX BUGS PRÉ-EXISTANTS, TROUVÉS EN VÉRIFIANT
**a) « overdue is not defined » — l'écran Colis tombait.** Depuis §5.64, le
bandeau d'urgence faisait `const { total, danger, parts } = u;` puis lisait
`overdue` deux lignes plus bas. L'écran **tombait dès qu'il y avait à la fois des
colis en retard et des colis tranquilles** (si TOUS sont urgents, le bloc ne
s'affiche pas — d'où un smoke qui passait un jour et pas l'autre : 1481
caractères contre 288).

**b) `syncFromSheets` / `syncToSheets` : mortes et cassées.** Restes de l'ancienne
architecture Google Sheets (§2), **aucun appelant**, et toutes deux lisaient une
constante **`API_URL` qui n'existe nulle part**. Pire : `syncFromSheets` écrasait
`vinted_catalog` et `vinted_sales` avec la réponse d'un endpoint fantôme.
Supprimées.

### ✅ `scripts/audit-variables.cjs` — LA famille est enfin couverte
C'est la **troisième fois** qu'une variable jamais déclarée casse un écran en
production, et aucun filet ne la voyait :
| | |
|---|---|
| §26 | `reel is not defined` → écran Ventes |
| §5.42 | `useRef` pas importé → écran Annonces |
| §5.73 | `overdue is not defined` → écran Colis |
`npm run build` compile (la syntaxe est valable) et le smoke ne la voit que si
les **données** font entrer dans le bloc conditionnel fautif.
➡️ Vraie vérification **no-undef** sur `src/App.jsx` et `src/main.jsx` avec
`@babel/parser` + `@babel/traverse` (déjà dans `node_modules`) : chaque
identifiant lu doit être déclaré, importé, ou être un global du navigateur.
**Rejoué sur le code d'avant : il sort les DEUX bugs** (`API_URL`, `overdue`).
⚠️ À lancer avec les autres audits après toute modification de `App.jsx`.

### Vérifié
`npm run build` OK · **14 audits au vert** (dont `audit-variables` nouveau, et
`audit-retrait-conv` passé à **13 contrôles** — 4 des 5 nouveaux échouent sur le
code d'avant) · rendu réel de l'écran Achats avec les trois familles de
destination : **Consigne Pickup Super U** (3 colis · consigne · identifiant +
code d'ouverture + QR), **Maison de la Presse** (1 colis · comptoir · code
946352), **Kusmi Tea** (Vinted Go · comptoir · code ou QR depuis la
conversation) — **0 erreur d'app** · écran Colis remonté de 288 à **1481
caractères** (7 colis à envoyer) · smoke **11 écrans, 0 écran vide, 0 suspect**.
⚠️ Artefact de banc corrigé au passage : le détecteur de suspects flaggait
« 1 colis » — **« colis » est invariable**, il n'avait rien à faire dans la liste
des accords à vérifier (déjà noté en §5.22, jamais corrigé).

Extension **5.47.0** — à recharger dans Chrome.

---

## 5.74 — L'ÉCRAN ACHATS DEVIENT UN OUTIL DE RÉCEPTION (une étape = un onglet)

Julien : « les achats ça ne me convient pas, conçois VRM un outil parfait pour
la réception des colis ».

### Ce que l'écran montrait vraiment (relevé ligne par ligne avant de coder)
**336 lignes affichées, dont ~40 parlaient de colis.** Le reste, c'était la
liste des 538 commandes de l'historique, filtrée par « En attente / Reçus /
Tous » — c'est-à-dire des **états de commande**, pas des **étapes de colis**.

Pipeline réel mesuré sur ses 441 achats de comptes vivants :
| étape | nombre |
|---|---|
| en route vers lui | **26** |
| arrivés au point relais | **13** |
| reçus | 317 |
| annulés / remboursés | 146 |

➡️ Les **26 colis en route** — exactement ce qu'un outil de réception doit
montrer — étaient **noyés au milieu de 538 lignes**, sans tri ni âge.

### La règle : les onglets sont les ÉTAPES du colis
`phaseReception(o)` (une seule définition, §11) : `annule` → `relais` → `recu` →
`route`. Les pastilles portent leur compte, donc **un onglet vide se voit avant
d'être ouvert** : `À retirer 4 · En route 25 · Reçus 284 · Tous`.

⚠️ **« À retirer » lit `pickupUnion.total`**, pas le nombre d'achats « au
relais ». Les deux ne donnent pas le même chiffre (union email + statut Vinted),
et ma première version affichait **2 en haut, « 4 colis à retirer » en dessous,
sur le même écran** — le doublon que §11 interdit.

⚠️ **« Retour initié » n'est PAS un colis qui arrive** : c'est une paire qu'on
renvoie. Le laisser dans « En route » faisait attendre une livraison qui ne
viendra jamais (1 cas sur les 26).

### Une étape = un écran
- **« À retirer » ne déroule plus de liste** : les colis qui l'attendent sont
  déjà en haut, groupés par destination avec leur code (§5.73). Les répéter en
  dessous, c'était le doublon qui faisait les 336 lignes.
- **Les blocs de destination ne s'affichent QUE sur « À retirer »**. Ils
  apparaissaient au-dessus des trois onglets — le même bloc, trois fois. La
  pastille du haut porte le compte : rien n'est caché.

### Ce qui manquait vraiment : DEPUIS QUAND
Un outil de réception répond à « est-ce que je dois m'inquiéter ? ». La date
d'achat seule oblige à compter dans sa tête. Chaque ligne en route affiche
désormais **« depuis N j »**, en rouge au-delà de `ACHAT_RETARD_J = 21` avec
« relance le vendeur ».
Mesuré : 12 colis à 7-15 j (le rythme normal Vinted), 10 à 15-30 j, et
**4 au-delà du mois** dont un « en transit » depuis 120 jours — un statut Vinted
qui ne bouge plus. ⚠️ On ne les **cache pas** (un colis caché est un colis
perdu, §5.43) : on affiche le chiffre.
**« En route » est trié du PLUS ANCIEN au plus récent** — c'est celui qui traîne
qu'on veut voir, pas le dernier acheté. Partout ailleurs le plus récent d'abord
(§5.35) : le tri ne change que sur cette étape.

### Deux légendes recopiées à chaque ligne
- **Les 4 libellés sous la barre de progression** (`Payé · Expédié · Au relais ·
  Reçu`) étaient **104 des 286 lignes** de l'onglet En route — une légende
  répétée 26 fois, alors que la pastille juste au-dessus nomme déjà l'étape en
  cours. Même défaut que les lignes de vente (§5.69), même correctif : les
  segments colorés restent, le texte part.
- **Le badge de délai du bloc de destination** répétait mot pour mot ce que
  chaque colis dit en dessous quand ils sont tous hors délai — quatre fois la
  même information dans un bloc de six lignes. Il ne s'affiche plus que si les
  colis **n'ont pas le même état** (là seulement « au plus tôt » veut dire
  quelque chose). Le tri des blocs par urgence, lui, est inchangé — il n'a pas
  besoin d'être écrit.

### Et le total dit enfin le hors-délai
« 4 colis à retirer » : sur les 4, **3 avaient leur date limite passée**. Ce
n'est pas la même liste de travail (soit il l'a récupéré sans cocher, soit le
colis est reparti chez l'expéditeur et il faut le réclamer). La ligne dit
maintenant **« 4 colis à retirer · 3 hors délai à vérifier »**.

### Mesuré
| onglet | avant | après |
|---|---|---|
| **À retirer** | **336 lignes** | **64** |
| En route | 286 | **201** |

### Vérifié
`npm run build` OK · **14 audits au vert** (`audit-coherence` : 5 règles,
**0 désaccord sur 12 statuts**) · les **4 onglets rendus sur les vraies
données** : À retirer (2 destinations, identifiants 1222/5789 et 8156/9539,
âges, hors-délai), En route (25 lignes, plus ancien d'abord, « depuis 120 j —
relance le vendeur »), Reçus, Tous — **0 suspect d'affichage, 0 erreur d'app**
(les 3 lignes console sont le 400 volontaire de `select=owner` et les resets de
fin de test).

---

## 5.75 — « JE DOIS PASSER À CÔTÉ DE RIEN » : 4 colis disparaissaient en silence

Julien : « continue encore à améliorer les achats, les QR codes, etc. Ça doit
être parfait, je ne dois passer à côté de rien. » Méthode habituelle : mesurer la
vraie base avant d'écrire une ligne.

### Ce que portent vraiment les 127 lignes de suivi (valeurs NON VIDES)
| champ | renseigné |
|---|---|
| `suivi` | 116 | 
| `consigne` | 38 · `qrUrl` **28** · `code` **20** · `lieu` 15 |
| `limite` | **3** · `code2` 2 · `qrB64` **0** |
| **`artTitle`** | **0** ⚠️ |

⚠️ **Aucun colis ne dit quelle paire il contient** — un email de transporteur ne
nomme pas l'article. C'est mesuré, pas supposé, et ça ne se corrige pas par le
code (voir plus bas).

### ⚠️ LE DÉFAUT : 18 colis « disponibles », l'app en affichait 3
Chaîne de filtres de l'app **rejouée sur les vraies lignes** :
| | |
|---|---|
| lignes « colis disponible » | **18** |
| cochés « récupéré » par Julien | 11 → écartés à raison ✅ |
| **non cochés, écartés SANS RIEN DIRE** | **4** ⚠️ |
| affichés | 3 |

Les 4 : Chronopost `05488805839014` (23 j), Mondial Relay `74950536` (29 j),
`15658327` (32 j, code 077831), `16100938` (33 j, code 184143). Aucun n'a de date
limite dans son email, donc la **supposition** des 14 jours (`PICKUP_MAX_DAYS`)
les faisait sortir de l'écran. Un colis non retiré repart chez l'expéditeur :
c'est de l'argent perdu, et **rien ne l'annonçait**.

➡️ **`pickupUnion.oublies`** + un bloc rouge « N colis jamais retirés » sur
l'onglet À retirer : transporteur, lieu, n° de suivi, **âge réel**, le code
quand il existe, « Vérifier » (suivi transporteur) et **« ✓ Je l'ai eu »**.
⚠️ Ils ne reviennent **PAS** dans la liste de travail et ne comptent dans **aucun
total** : l'action n'est pas « aller au comptoir » mais « réclamer », et un
colis d'il y a un mois n'est plus un retrait.

### ⚠️ « HIDE MY EMAIL » D'iCLOUD RÉÉCRIT L'EXPÉDITEUR
Trouvé en cherchant pourquoi un email traînait chez les « non compris » :
```
SEUR via Vinted <shipping_at_relay_vinted_com_t9zx4089tn7g48_18rq1890@icloud.com>
                 ↑ le vrai expéditeur est shipping@relay.vinted.com
```
**37 des 453 emails conservés** arrivent sous cette forme. Tout test sur
l'expéditeur (`/relay\.vinted/`, `/chronopost/`, `/@team\.vinted/`) échoue alors
— et le cas trouvé était un **VRAI email de transporteur** (« Tu envío ha sido
recogido »), reconnu par **aucune** règle.

➡️ **`demasquerRelais(adr)`** dans `api/_lib/lire-email.js` (iCloud, Apple
private relay, DuckDuckGo, SimpleLogin, AnonAddy) ; `normalizeInbound` ajoute
l'adresse lisible **à côté** de l'alias dans `from`.
⚠️ **On ne reconstruit PAS l'adresse exacte** : on ne sait pas où s'arrête le
domaine et où commencent les jetons aléatoires, et deviner produirait une adresse
fausse. On rend le nom et le domaine **lisibles** — c'est tout ce dont un test
par sous-chaîne a besoin — et l'original reste intact.
⚠️ Ça ne touche **jamais** le rattachement au vendeur, qui lit l'adresse de
**RÉCEPTION** (§5.16), jamais celle de l'expéditeur.

**Prouvé dans les deux sens sur le vrai email** : code d'avant → `null`
(l'email était perdu) · après → `vinted`. Trois contrôles permanents ajoutés à
`scripts/audit-transporteurs.cjs` (dont « une adresse normale n'est pas
réécrite »).

### « Non compris » recommençait à crier au loup
**453 emails conservés**, dont 93 qu'aucune famille ne reconnaissait :
| | |
|---|---|
| « MISE EN DEMEURE – Demande d'intervention humaine… » | **76** — son courrier SORTANT vers Vinted |
| « Le transfert bancaire est en cours » | **15** |
| divers | 2 |

Deux familles ajoutées (serveur **et** app — les lignes déjà en base ne seront
jamais réécrites, §5.49), vérifiées par `audit-email-formes` sur 14 sujets réels.

⚠️ **CE QUE JE N'AI PAS FAIT, ET POURQUOI** : router « transfert bancaire » vers
`email_final_*`. C'est tentant (c'est de l'argent) — mais `email_final` compte
l'argent **entrant dans le porte-monnaie** quand une vente se finalise. Un
virement, c'est le porte-monnaie qui **se vide** vers sa banque : le même euro
serait compté **deux fois** dans « encaissé ». Aucune action à faire → famille
reconnue, pas alerte.

### Ce qui NE se corrige pas par le code (dit franchement)
- **Nommer la paire d'un colis** : `artTitle` est vide sur 127/127. La seule voie
  certaine est la conversation Vinted (§5.72) — or, mesuré en exécutant la VRAIE
  fonction sur les **636 conversations captées** : **12 seulement sont côté
  acheteur**, et **1 seule** produirait une ligne. Julien vit sur ses VENTES.
  Cette voie ne couvrira donc jamais qu'une poignée d'achats.
- **`panel_colis_relais` est toujours ABSENTE** alors que le diagnostic de
  l'extension est frais (30 août 20:47, 519 conversations rangées) et ne porte
  **aucune clé `retrait_*`** ⟹ **l'extension installée chez lui est antérieure à
  la 5.45**. Il faut la recharger dans Chrome pour que cette chaîne démarre.
- **Rien ne dort ailleurs** : sur les 125 lignes de quarantaine non traitées et
  les 453 emails « inconnus », **0 email de colis**. La lecture ne perd rien.

### Vérifié
`npm run build` OK · `node --check` sur les deux fichiers `api/` · **14 audits au
vert** · rendu réel de l'onglet À retirer : le bloc « 4 colis jamais retirés »
affiche les 4 colis **mesurés en base**, avec leur âge exact (23 / 29 / 32 / 33 j)
et leurs codes (077831, 184143) · **0 suspect, 0 erreur d'app**.

---

## 5.76 — « C'EST MON MÉTIER, FAIS ÇA COMME UN PRO » : j'ai enfin REGARDÉ l'écran

Julien, après plusieurs passes : « ça ne me convient toujours pas, c'est mon
métier ». Il avait raison, et la leçon de §5.62 s'appliquait encore : **j'avais
lu des listes de lignes de texte, jamais REGARDÉ l'écran**. Une capture à sa
résolution de travail (1512 px, ordinateur — §42) a montré cinq défauts en
trente secondes, dont trois qu'aucun banc ne pouvait voir.

### ⚠️ 1. LES QR NE S'AFFICHAIENT PAS — et rien ne prenait le relais
Sur la capture, les trois vignettes QR étaient des **icônes « image cassée »**.
Vérifié au `curl` : **les 3 vrais QR de Julien répondent parfaitement**
(`image/png`, 645 à 873 octets) — l'image morte était un artefact du banc (pas de
réseau vers `pickup-services.com`).
**Mais le défaut, lui, est réel** : `onError` n'existait que dans la **modale**
plein écran (§17). Sur la carte, une image morte restait une image morte —
et un lien de transporteur expire. **Au comptoir, il n'aurait rien eu à
présenter.**

⚠️ **Ma première correction ne marchait pas** : `e.target.closest(...).style.display='none'`
est **effacé au premier re-render de React**, qui réapplique son style en ligne.
Vu en capture (le cadre vide restait), pas à la relecture.
➡️ Le repli vit maintenant dans l'**ÉTAT** (`imgMortes` / `noterImgMorte`), et il
sert aussi aux **photos de paires** (même famille : le CDN Vinted expire).

➡️ Et **ni QR ni code ⟹ le NUMÉRO DE COLIS en gros** (§17 le disait, ce n'était
pas fait sur cette carte) : mesuré, le colis `09447431562792` n'avait
**strictement rien** à montrer.

### 2. Le n° de suivi était écrit DEUX FOIS par ligne
« Colis n°08448878300059 » en titre, puis « n° 08448878300059 » juste en dessous.
Un email de transporteur ne nomme jamais l'article (mesuré : `artTitle` vide sur
**127 lignes sur 127**) — donc à défaut on écrit ce qu'on SAIT, **le
transporteur**, et le numéro reste sur sa ligne, une seule fois.

### 3. « délai de retrait dépassé » ne disait pas de combien
Ça se lisait comme une contradiction juste sous « arrivé il y a 6 j ». Devenu
**« délai dépassé depuis 2 j (29/08/2026) — va vite le chercher »** : c'est ce
qui décide si on court au relais ou si on réclame. Et ça distingue enfin ce bloc
du bloc « colis jamais retirés » (§5.75), dont l'action est « réclame à Vinted ».

### ⚠️ 4. L'ÉCRAN ACHATS N'AVAIT AUCUN CHIFFRE
Ventes porte quatre chiffres depuis toujours ; **Achats, zéro** — alors que
l'achat, c'est la moitié de la marge. Mesuré sur ses **534 achats réels** :

| | paires | montant |
|---|---|---|
| reçus | 326 | 8 064 € |
| en route | 62 | 1 672 € |
| au relais | 13 | 346 € |
| **annulés / remboursés** | **146** | **3 980 €** → **27,3 %** ⚠️ |

**Plus d'un achat sur quatre n'aboutit pas, et rien ne le lui disait.** Quatre
`StatBox` ajoutées (Dépensé · Prix médian · En route · Annulés), qui **suivent la
période choisie** comme sur Ventes.
⚠️ On ne remet **PAS** « à retirer » dans cette rangée : ce compte a sa
définition (`pickupUnion.total`) et il est déjà affiché deux fois plus bas. Deux
nombres proches pour deux notions différentes sur le même écran, c'est
exactement ce qu'on s'interdit (§11).
⚠️ Le libellé disait « Prix moyen » pour une **médiane** — corrigé.

### 5. « Reçu » se lisait « colis reçu »
Le bouton du justificatif PDF s'appelait **« 📄 Reçu »**, juste à côté d'une
pastille **« En transit »**. Un pro clique dessus en croyant marquer le colis
reçu. Devenu **« 📄 Justificatif »**.
Et le bandeau « 2 comptes ne reçoivent aucun email » s'affichait sur les
**quatre** onglets, donc au-dessus de la liste des achats en route où il ne dit
rien : c'est une information de **configuration**, sa place est sur « À
retirer », là où les codes manquent.

### La leçon, à ne plus oublier
**Un défaut d'affichage ne se voit ni au build, ni dans une liste de textes, ni
dans un compte d'erreurs.** Trois des cinq défauts ci-dessus (image cassée,
numéro en double, style React qui écrase le DOM) n'étaient visibles **que sur
l'image**. Regarder la capture fait partie du test — c'est déjà écrit en §5.56,
et je ne l'avais pas fait sur cet écran.

### Vérifié
`npm run build` OK · **14 audits au vert** · les 4 onglets rendus sur les vraies
données (À retirer 105 lignes, En route 214) : **0 suspect, 0 PAGEERROR** ·
captures relues avant/après · 11 écrans à 390 px : 0 débordement, 0 écran vide.

---

## 5.77 — ⚠️⚠️ LES NOTIFICATIONS ÉTAIENT MORTES DEPUIS LE 25 AOÛT, ET C'ÉTAIT MA FAUTE

Julien : « remets les notifs, ça ne marche plus du tout ». **Il avait raison, la
cause est chez moi, et elle est mesurée.**

### Ce que la production contenait vraiment (`origin/main`, 25 août)
| contrôle | état |
|---|---|
| clé privée VAPID disponible | **NON** → `sendPushToAll` sort sur « VAPID_PRIVATE_KEY absente » |
| route `GET /api/push?etat=1` | **NON** → l'app reçoit **405**, elle ne peut pas savoir |
| l'app affiche l'alerte | **NON** → l'écran dit « activées » |

➡️ **Depuis le 25 août, zéro notification n'est partie**, pendant que l'écran
affichait « activées ». Vérifié en direct : `https://vrm.center/api/push?etat=1`
→ **405 « POST only »**, et 2 appareils toujours abonnés (mis à jour hier 20:17).

### La cause exacte : §5.53
En sortant la clé privée du dépôt public, j'ai **régénéré la paire** — donc
`BBQbRWE86gwZ…` (avec sa privée en dur, qui marchait) est devenue
`BLw4VOxC3CXI…` **sans privée nulle part**. La note disait « à faire par
Julien : poser `VAPID_PRIVATE_KEY` sur Vercel »… **sans jamais lui donner la
valeur à poser**. C'était donc impossible à faire.
⚠️ Confirmé dans l'historique : `ffa1c18` et antérieurs → clé publique
`BBQbRWE86gwZ…` + privée en dur ; `75733c4` (§5.53) → nouvelle publique, plus
aucune privée. **La privée de la paire actuelle n'a jamais existé ailleurs que
dans ma session.**

### Ce qui est livré
1. **Paire régénérée**, la publique posée **aux deux endroits** (`src/App.jsx` et
   `api/_lib/push.js`) ; **la privée est remise à Julien en main propre**, jamais
   dans le dépôt (le dépôt est public — c'est tout l'objet de §5.53).
2. **L'alerte devient actionnable** : elle donnait le nom de la variable sans
   dire quoi faire. Elle liste maintenant les trois étapes exactes, avec le
   **lien direct** vers les variables d'environnement du projet Vercel.
   ⚠️ Une alerte qui ne dit pas quoi faire ne sert à rien quand la personne en
   face n'est pas développeur.
3. Le **ré-abonnement automatique** (`memeCle`, §5.61) était déjà écrit : la clé
   publique ayant changé, les 2 abonnements existants sont périmés et seront
   remplacés tout seuls à la première ouverture après déploiement.

### ✅ `scripts/audit-push.cjs` — 7 contrôles permanents
La chaîne push casse **en silence** : c'est ça qui a coûté six jours.
1. l'app et le serveur partagent **la même clé publique** (si elles divergent,
   chaque abonnement est scellé sur une clé que le serveur n'utilise pas —
   refus à l'envoi, et rien ne le dit) ;
2. **aucune clé privée en dur** (le dépôt est public) ;
3. la privée vient **uniquement** de la variable d'environnement ;
4. le serveur **annonce** « clé absente » au lieu d'échouer en silence ;
5. l'app **interroge** l'état du serveur ;
6. l'app **affiche** l'alerte ;
7. la route `GET ?etat=1` **existe** côté serveur — sinon l'app reçoit 405 et
   n'alerte jamais (exactement le cas de production).

⚠️ **Prouvé dans les deux sens** (§21) : rejoué sur `origin/main`, il sort
**3 maillons cassés** (points 5, 6, 7) ; sur la branche, 7 au vert.

### ⚠️ CE QUI RESTE À FAIRE PAR JULIEN, ET QUE LE CODE NE PEUT PAS FAIRE
Poser **`VAPID_PRIVATE_KEY`** dans les variables d'environnement Vercel, puis
redéployer. Une clé privée ne peut pas vivre dans le dépôt (public) ni dans
Supabase (lisible avec la clé anon publique — ce serait la même faille). C'est
le seul endroit sûr, et c'est un geste unique.

---

## 5.78 — TEST NOTIF FAIT EN DIRECT : trois pannes empilées, toutes mesurées

Julien : « fait un test notif, je ne reçois pas les ventes etc ». Test réel
lancé contre la production et contre ses **2 vrais appareils** — pas une
relecture de code.

### Ce que le test a donné (31 août, en direct)
| test | résultat |
|---|---|
| `GET https://vrm.center/api/push?etat=1` | **405 « POST only »** → la production tourne l'ancien code, l'app ne peut même pas demander « peux-tu envoyer ? » |
| `POST /api/push {action:'test'}` (production) | `{"sent":0,"total":0,"erreur":"VAPID_PRIVATE_KEY absente"}` |
| appareils abonnés en base | **2** (Chrome/FCM + Apple), réabonnés **le matin même à 06:59** |
| **envoi RÉEL tenté** avec la paire régénérée (§5.77) | Chrome **403** « the VAPID credentials … do not correspond » · Apple **400 `{"reason":"VapidPkHashMismatch"}` » |
| clé publique dans le bundle **déployé** | **DEUX clés différentes** — `BBQbRWE86gwZ…` (bloc de réabonnement hérité) et `BLw4VOxC3CXI…` (§5.53) |
| clé publique sur la **branche** | **une seule**, `BIImaPEF…`, app et serveur d'accord |

➡️ **Trois pannes empilées**, et chacune suffit à elle seule :
1. le serveur n'a **aucune** clé privée → il n'envoie rien, jamais (§5.77) ;
2. la production ne porte pas la route `GET ?etat=1` → l'app ne peut pas
   l'annoncer, elle affiche « activées » ;
3. les 2 abonnements sont **scellés sur une clé publique dont la privée
   n'existe nulle part** — même en posant la clé sur Vercel, ces deux-là
   resteraient morts.

### ✅ CE QUE LE TEST PROUVE EN POSITIF (et c'était la vraie inconnue)
**Les deux endpoints sont VIVANTS.** Un appareil désinstallé ou une permission
retirée renvoie **404/410** ; ici les deux services ont **accepté la requête et
ne l'ont refusée que sur la clé**. Donc la chaîne Supabase → service de push →
téléphone fonctionne de bout en bout : il ne manque que la clé.
⚠️ Sans ce test, impossible de distinguer « clé absente » de « téléphones
partis ». C'est pour ça qu'on l'a lancé pour de vrai au lieu de relire le code.

### ⚠️ LE DÉFAUT CORRIGÉ : un abonnement à clé périmée était compté comme vivant
`sendPushToAll` ne purgeait que sur **404/410**. Un abonnement scellé sur une
ancienne clé (403 / `VapidPkHashMismatch`) restait donc dans la liste **pour
toujours** : « 2 appareils abonnés » s'affichait pendant que rien n'arrivait —
la panne silencieuse exacte qui a coûté six jours.
- **`cleSansRapport(e)`** reconnaît les deux formes RÉELLES relevées ci-dessus.
- ⚠️ **Jamais sur un 403/400 nu** : on exige le MOTIF. Un refus passager ou une
  charge mal formée effacerait sinon **tous** les appareils d'un coup.
- `sendPushToAll` renvoie `perimes`, et le bouton **Test** de l'app dit quoi
  faire : « N appareils étaient abonnés avec une ancienne clé — ils viennent
  d'être retirés, rouvre l'app sur chaque appareil ». Avant, on lisait
  « 2 abonnés, 0 joint » sans savoir quoi en faire.

### L'ORDRE COMPTE (sinon ça ne marchera toujours pas)
`memeCle()` — le réabonnement automatique qui re-scelle les appareils sur la
clé courante (§5.61) — **n'existe QUE sur la branche**. Donc :
1. **déployer la branche** (sans ça, les abonnements ne se re-scellent jamais) ;
2. poser **`VAPID_PRIVATE_KEY`** dans les variables d'environnement Vercel ;
3. **ouvrir l'app une fois sur chaque appareil** → il se réabonne tout seul ;
4. refaire le test.
⚠️ Inverser 1 et 3 ne marche pas : c'est le point qui manquait à §5.77.

### Vérifié
`npm run build` OK · **15 audits au vert** · `audit-push` passe à **10
contrôles**, dont **3 nouveaux qui échouent bien sur le code d'avant** (§21 :
rejoué sur `HEAD`, il sort les 3) · banc unitaire sur la VRAIE fonction
`cleSansRapport` contre les erreurs mesurées : **8/8** (les 2 vraies purgent,
403 nu / 400 nu / 429 / 500 / 404 / sans corps ne purgent pas).

### 5.78 (suite) — ⚠️ « AUCUN APPAREIL ABONNÉ » ÉTAIT UN MENSONGE DU CODE

Julien : « pour les notifs ça met qu'aucun appareil n'est abonné ». Mesuré
immédiatement : **la base porte bien 2 abonnements**, rafraîchis le matin même
à 06:59. Le message est donc **faux**, et il l'envoyait chercher du côté de son
téléphone alors que le problème est la clé du serveur.

### La chaîne exacte du mensonge
1. `sendPushToAll` sort sur `if (!PUSH_PRET) return { sent:0, **total:0**, … }`
   — **sans jamais lire la liste des abonnés** ;
2. le bundle **déployé** (25 août) ne connaît ni le champ `erreur` ni la route
   `?etat=1` — vérifié en cherchant dans le vrai fichier servi par vrm.center :
   `VAPID_PRIVATE_KEY absente` → **0 occurrence**, `etat=1` → **0**,
   `Aucun appareil abonné` → **1** ;
3. l'app lit donc `total === 0` et affiche **« Aucun appareil abonné »**.

➡️ **`total` veut dire « appareils abonnés », jamais « ce qu'on a réussi à
faire ».** Sans clé, on lit quand même la liste et on renvoie le vrai nombre.
La lecture est une ligne minuscule (`push_subs`, quelques centaines d'octets) et
n'a lieu que dans un état cassé qu'on veut justement diagnostiquer.

⚠️ **C'est la troisième fois d'affilée qu'un chiffre à 0 vient de MON code qui
abandonne, pas de la donnée** (§21 : `my_orders`, §5.27 : `price` objet, ici
`total`). **Avant d'afficher un compteur à zéro, vérifier qu'on a vraiment
regardé.**

`audit-push` passe à **11 contrôles** ; le nouveau (« sans clé, on compte quand
même les appareils abonnés ») **échoue bien sur le code d'avant**.

### ⚠️ CE QUI BLOQUE N'EST PLUS DU CODE
Trois plaintes d'affilée — notifications mortes, « tu n'as rien modifié dans
Achats », « aucun appareil abonné » — ont **la même cause unique** : la
production date du **25 août** et la branche a ~50 commits d'avance. Chaque
correctif décrit ici est invisible tant que la branche n'est pas déployée.

---

## 5.79 — LES 183 € : CE N'ÉTAIT PAS LE CODE DE LA BRANCHE, C'ÉTAIT LA PRODUCTION

Julien : « j'ai fait plus que 183 € aujourd'hui… dans les ventes elles
apparaissent bien, mais elles ne sont pas catégorisées dans vendu aujourd'hui ».

### Ce que la mesure a donné (31 août)
| source | ventes du jour | total |
|---|---|---|
| moisson Vinted (base) | **6** sur 4 comptes | **400,00 €** |
| **emails `email_sale_*` du jour** | **3** | **183,00 €** ⚠️ |
| ce que Julien voit | — | **183 €** |

Les 3 emails manquants = `julienf765` (87 €) et `tomj606` (80 + 50 €).

➡️ **C'est exactement §5.69**, déjà corrigé sur la branche : la tuile « Vendu
aujourd'hui » calculait sur les EMAILS. Preuve dans le bundle **déployé** :
`bilanVentes` → **0 occurrence**, `montantCommande` → **0**, `email_sale` → 1.
La production date du 25 août, §5.69 du 26.
**Vérifié au banc sur les vraies données : la branche affiche `400 € · 6 paires`.**

### ⚠️ J'AI FAILLI ACCUSER LA MAUVAISE CAUSE
Ma première hypothèse était `vinted_accounts_blocked` (liste **locale à
l'appareil**, donc invisible depuis la base — §5.21). J'ai construit un banc qui
la seedait avec les 2 comptes… et il affichait **400 € dans les deux cas** : la
réparation automatique de §5.09 les retire au démarrage. **L'hypothèse était
fausse, et c'est le banc qui l'a dit.** Ne pas conclure sur un raisonnement quand
un banc peut trancher en trois minutes.

### Corrigé quand même, parce que la règle était mauvaise
`acctOff` incluait `blockedAccts` — une liste **auto-détectée** et **locale** —
donc une heuristique sur un refus d'authentification pouvait retirer de l'argent
de TOUS les totaux, en silence et sans trace en base.
➡️ **Une vente réalisée est de l'argent gagné.** Qu'un jeton soit refusé
aujourd'hui ne change rien au fait que la paire est partie. §5.09 l'avait posé
pour les annonces, §5.22 pour la suppression d'un compte : c'était la même
règle, jamais appliquée ici. Le compte affiche « connexion refusée » en orange
et **ne masque plus rien**. Ne masquent encore que ses choix explicites
(`vinted_accounts_hidden`, `panel_accounts_off`).

---

## 5.80 — ⚠️ 76 LIGNES DE SUIVI SUR 128 SONT DES COLIS QU'IL ENVOIE

Demande : « améliore l'onglet achat avec les colis que je reçois, les QR codes,
les codes de retrait, adapte-toi aux nouveaux emails ».

### Mesuré avant de coder
| | |
|---|---|
| lignes de suivi | 128 |
| **colis SORTANTS** (ses ventes qui partent, sujet certain) | **76** |
| colis entrants | 22 · indéterminés 30 |
| **sortants classés « disponible »** (donc affichés à retirer) | **1** ⚠️ |

Le coupable : Mondial Relay **`74950536`**, « Votre colis est entre de bonnes
mains 📦 » — **sa propre preuve de dépôt**. Il était affiché comme un colis à
aller chercher, puis promu en « colis jamais retiré, va le réclamer » (§5.75).
**L'app lui demandait de réclamer un colis qu'il avait posté lui-même.**

**Cause** : le sujet ne matchait aucune règle, on retombait sur le CORPS — et le
corps d'un email de dépôt contient « disponible » et « prêt » (le piège de §5.43,
en plus discret).

### La règle : `sensColis(t)` / `SUJ_SORTANT`
- **On ne tranche que sur du CERTAIN** (§24) : une **confirmation de dépôt** ne
  peut pas vouloir dire autre chose. « votre colis a été retiré », « en cours
  d'acheminement » restent **indéterminés** — comportement inchangé.
- **La règle vit aux DEUX endroits** (§5.37, §5.49) : sur le serveur pour les
  emails à venir (un dépôt est classé `transit`, jamais `available`), et **dans
  l'app** parce que les 128 lignes déjà en base ne seront jamais réécrites.
- ⚠️ **Le panneau « jamais retirés » écarte aussi les sortants** : il liste
  précisément ce que `isColisActive` refuse, donc sans ce second test la fausse
  alerte était simplement **déplacée d'un bloc**.

**Vérifié au rendu réel** : `74950536` a disparu, « colis jamais retirés »
passe de **4 à 3**, les colis Chronopost gardent QR + identifiant 8156 + code
d'ouverture 9539. `scripts/audit-colis-sens.cjs` — **7 contrôles, 6 échouent
sur le code d'avant**.

---

## 5.81 — 5 COMPTES NE PEUVENT DÉCLENCHER AUCUNE NOTIFICATION DE VENTE

Julien : « dès demain je vais avoir besoin de ces notifications, je ne vais pas
pouvoir me connecter tout le temps ».

**Une notification de vente naît d'un EMAIL de vente, pas de la moisson.**
Mesuré : sur les 6 ventes du jour, **3 emails seulement**. Et par compte :

| compte | emails de vente reçus |
|---|---|
| julatace35260 · julienf765 · llloollllaa · tomj683 | 36 · 33 · 27 · 18 |
| **tomj606 · angeled92 · arthuror2 · liliand653 · julatace3535** | **0** |

⚠️ `tomj606` a vendu **130 € aujourd'hui** : aucune notification n'était
possible. Ce n'est **pas réparable côté code** — ces boîtes ne font pas suivre
vers l'adresse de réception de l'app.
➡️ Réglages → Notifications le **dit maintenant, sans avoir à déplier** :
« ⚠ 5 comptes ne te préviendraient d'aucune vente ». Lecture scalaire, une seule
requête (§34) ; `null` tant qu'on ne sait pas — on n'accuse jamais sur une
lecture ratée.

**Au passage, vérifié** : `push_prefs` = `{achat, suivi, favori, facture,
message}` — il a allumé les 5 catégories bruyantes. **`vente` est absente, donc
au DÉFAUT, donc active** (§5.41 : une catégorie absente vaut son défaut, jamais
« muet »). Les notifications de vente sont bien armées.

### État de la chaîne bordereau (mesuré)
14 ventes attendent son envoi · **10 ont déjà leur PDF** (extension ou email) ·
4 sans. Les compteurs de l'extension (`label_url_trouve: 4`) montrent que la
chaîne fonctionne.
⚠️ **Son extension installée est antérieure à la 5.34** : `panel_colis_relais`
est ABSENTE et `abandon_json_item` monte encore (104) — donc ni le rattrapage
des bordereaux (5.46), ni les codes de retrait Vinted Go depuis les
conversations (5.45) ne tournent chez lui. **Zip 5.47 livré.**

### 5.80 (suite) — LE N° DE SUIVI D'UN BORDEREAU EST UNE PREUVE, PAS UN INDICE

Un bordereau est l'étiquette qu'il colle sur SON colis : son n° de suivi
identifie donc un colis **sortant**, de façon certaine (§24 — un n° de suivi est
une identité). `fetchEmailBordereaux` projette déjà le champ `suivi` (§23),
donc le pont est **gratuit**.

**Mesuré sur les 128 lignes de suivi** : 18 portent le n° d'un de ses
bordereaux, dont **9 que la lecture du sujet ne permettait pas de trancher** —
et **0 conflit** avec cette lecture. Le pont ajoute de la précision sans jamais
contredire la règle existante.

⚠️ **Honnêteté** : aucun colis actuellement affiché « à retirer » n'était en
fait un envoi (mesuré : 0 sur 17). Ce pont ne corrige donc rien de visible
aujourd'hui — il ferme la porte pour la suite, là où le sujet ne suffit pas.
Vérifié au rendu : 14 à retirer / 3 jamais retirés / QR + 8156 + 9539 — chiffres
**identiques** avant et après, comme prévu.

⚠️ L'onglet Achats charge désormais `emailBords` (13 colonnes scalaires, ~21 Ko,
jamais le PDF — §23/§34) : il en a besoin pour ce pont.
⚠️ `suivisEnvoyes` est déclaré juste après `emailBords`, donc avant tout ce qui
le lit (piège TDZ, §19).

### ⚠️ PIÈGE DE PREUVE, ÉVITÉ DE JUSTESSE (le même qu'en §5.69)
Pour prouver que l'audit échoue sur le code d'avant, j'ai d'abord lancé
`node /home/user/cancale-v67/scripts/audit-colis-sens.cjs` depuis `/tmp/av4`.
Le script résout ses chemins avec `path.join(__dirname, '..')` : il a donc relu
**le dépôt courant** et affiché « tout va bien ». **Il faut copier le script dans
l'arbre de test et le lancer DEPUIS cet arbre.** Fait : **6 contrôles en échec**
sur le code d'avant, 7/7 sur la branche.

### Santé de la base au moment du déploiement (31 août)
| | |
|---|---|
| annonces en ligne (comptes vivants) | **30** |
| sans numéro | **0** ✅ |
| numéros portés par deux annonces | **0** ✅ |
| paires numérotées | 278 |
| **avec un prix d'achat** | **0 / 278** ⚠️ (saisie manuelle, §5.47/§5.64) |

### ✅ DÉPLOYÉ (31 août, PR #56)
La production était figée au 25 août, 54 commits de retard — c'était la cause
unique de trois plaintes d'affilée. Fusionnée après vérification complète
(build, 16 audits, smoke 10 écrans : 0 vide / 0 artefact).
**Vérifié en direct sur `vrm.center` après déploiement** : les nouvelles chaînes
sont dans le bundle servi, `GET /api/push?etat=1` répond **200** (au lieu de
405) avec `{"pret":false,"devices":2}`, et le test renvoie **`total: 2`** au
lieu de 0. La production dit enfin la vérité sur ses notifications.
⚠️ **Reste `VAPID_PRIVATE_KEY` à poser dans Vercel** — aucun outil de la session
ne donne accès aux variables d'environnement, c'est son geste.

---

## 5.82 — « TU ES SÛR QUE LES NOTIFS MARCHENT ? » — NON, ET ÇA SE VOIT MAINTENANT

Réponse honnête au moment où il l'a posée, vérifiée en direct sur la
production : **non**. `GET https://vrm.center/api/push?etat=1` →
`{"pret":false,"devices":2}` — deux téléphones abonnés, **zéro notification
possible**, faute de `VAPID_PRIVATE_KEY` côté Vercel.

⚠️ L'information existait déjà… **dans Réglages → Notifications**. Or on compte
sur les notifications précisément pour **ne pas** avoir à ouvrir l'app :
découvrir la panne en ouvrant un écran de réglages, c'est le pire des deux
mondes.

➡️ **`NotifsMuettes`** en tête de « Ma journée » : bandeau rouge « Ton téléphone
ne recevra aucune notification », avec les trois étapes exactes. Il **disparaît
tout seul** dès que la clé est posée.
⚠️ On n'affiche **rien** tant que la réponse n'est pas arrivée (`null`) : une
lecture ratée ne doit pas faire croire à une panne.

**Vérifié au banc dans les DEUX sens** (le point qui compte — un bandeau qui
s'affiche toujours ne vaut rien) : `pret:false` → bandeau rendu ;
`pret:true` → **absent**. 0 erreur dans les deux cas.

⚠️ **Piège de banc, nouveau** : Playwright teste les routes **de la plus
récente à la plus ancienne**. Ma route spécifique `**/api/push*` était
enregistrée AVANT le fourre-tout `**/api/**`, donc le fourre-tout gagnait et
renvoyait `{}` — le bandeau n'apparaissait dans **aucun** des deux sens, et
j'aurais conclu que le composant ne marche pas. **La route la plus spécifique
s'enregistre en DERNIER.**

### Le rappel du matin : mesuré, il ne dira rien demain (et c'est correct)
Le vrai handler `api/ship-reminders.js` exécuté contre la vraie base :
`{"ok":true,"skipped":"déjà notifié","total":0}`.
Décomposé : 8 transactions attendent son envoi, **3 ont un bordereau avec une
date limite** — toutes au **07/09**. Rien n'est donc en retard, ni dû
aujourd'hui ou demain : `total = 0` est le bon chiffre.
⚠️ **À savoir** : un bordereau **sans `dateLimite`** est ignoré par ce rappel
(`if (!iso) continue;`). Aujourd'hui aucun n'est dans ce cas, mais le jour où
un email de bordereau arrive sans date, le colis ne déclenchera aucun rappel.
Ne pas « corriger » en inventant une date : c'est le transporteur qui la donne.


---

## 5.83 — « RETIRER 15 COLIS » QUAND IL N'EN A QUE 3 DE RETIRABLES

Trouvé en **regardant l'écran** (§5.76), pas en relisant du code. Sur les
**mêmes** données du 1er septembre :

| écran | ce qu'il affichait |
|---|---|
| **Ma journée** | « Retirer 15 colis — **récupère-les avec ton code** » |
| **Achats** | 3 colis avec un code ou une adresse… **tous les 3 hors délai**, et **12 « Code de retrait pas encore reçu · Point relais à confirmer »** |

Les 12 ne viennent pas d'un email de transporteur : ce sont des achats que
**Vinted** dit « déposés en point relais », sans code, sans adresse, sans QR.
L'écran Achats était honnête ; c'est **l'accueil** qui l'envoyait au comptoir
pour 15 colis dont 12 ne peuvent pas être retirés — et qui taisait que les 3
retirables étaient **hors délai** (un point relais rend le colis à l'expéditeur).

### Le correctif : le total ne bouge pas, la consigne change
⚠️ **On ne cache RIEN** (§5.43 : un colis caché est un colis perdu). `total`
reste l'union des deux signaux. Ce qui change, c'est ce que la tuile **dit** :
| état | consigne |
|---|---|
| des colis hors délai | « N hors délai — va vite les chercher » (rouge, **remonte en tête**) |
| code pour une partie | « N avec ton code · M en attente de leur code » |
| tous avec code | « Tu as le code — plus qu'à aller les chercher » |
| aucun code | « Vinted dit "déposé" — le code arrive par email ou dans la conversation » (gris, **descend en bas**) |

### ⚠️ Le hors-délai était calculé DEUX FOIS
L'écran Achats le recomptait **en ligne** dans son bandeau. `pickupUnion` porte
désormais **`horsDelai`**, `prets` et `sansCode` (§11 : une notion, une règle) —
les deux écrans ne peuvent plus annoncer des nombres différents.

### Une urgence écrite en gris n'est pas une urgence
Les sous-titres des cartes d'action étaient **tous** en `C.muted` : « 3 en retard
— à poster en priorité » se lisait de la même couleur que « Bordereau + paire au
garage ». Drapeau `urgent` sur la carte → la consigne porte la couleur, et
seulement quand il y a vraiment quelque chose à rattraper (§5.65 : c'est le
chiffre qui se colore, pas le fond).

**Vérifié au rendu réel** (vraies données rafraîchies du jour) : la ligne remonte
en tête et affiche **« Retirer 15 colis · 3 hors délai — va vite les chercher »**
en rouge ; l'écran Achats affiche **le même 3**. `npm run build` OK ·
**16 audits au vert** · smoke : 0 écran vide, 0 suspect, 0 PAGEERROR.

### État mesuré le 1er septembre (après rechargement de l'extension par Julien)
| | |
|---|---|
| comptes captés dans l'heure | **7 sur 9** (`julatace3535` 4,8 j · `liliand653` masqué, 30 j) |
| colis à envoyer | 14 — **12 ont déjà leur PDF**, 2 sans (les deux `tomj606`, « Bordereau envoyé au vendeur ») |
| colis réellement retirables | **3, tous hors délai** · 12 « déposés » sans code · 3 jamais retirés (25 à 35 j) |
| annonces en ligne | 30 · **0 sans numéro · 0 doublon de numéro** ✅ |
| prix d'achat | **0 / 278** ⚠️ |

⚠️ **L'extension installée chez lui est antérieure à la 5.45** — mesuré :
`panel_colis_relais` **absente** et le compteur `retrait_conv_ecrit` à zéro,
alors que `ventes_rafraichies: 5` prouve qu'elle est ≥ 5.42. C'est ce qui bloque
les deux choses qu'il a demandées : le bordereau envoyé tout seul dans l'app
(rattrapage 5.46) et les codes de retrait Vinted Go lus dans la conversation
(5.45). **Zip 5.47 relivré.**

⚠️ **`VAPID_PRIVATE_KEY` toujours absente de Vercel** : `GET
https://vrm.center/api/push?etat=1` → `{"pret":false,"devices":2}`. Vérifié dans
cette session qu'**aucun outil disponible ne peut écrire une variable
d'environnement Vercel** (pas de CLI, pas de jeton, le connecteur Vercel ne
couvre que projets/déploiements/protection). C'est son geste, et c'est le seul
qui reste pour que les notifications partent.


### 5.83 (suite) — L'ONGLET « À RETIRER » COMMENCE PAR LES COLIS

Toujours en regardant la capture, sur le même écran : avant d'atteindre le
premier colis il fallait passer **la période, la recherche, quatre chiffres
comptables et un bandeau d'avertissement**.

⚠️ **Ces trois commandes n'agissent sur RIEN sur cet onglet.** Vérifié dans le
code : `aFilter === 'attente'` renvoie **faux** dans le filtre de la liste des
commandes — l'onglet n'affiche aucune liste, seulement les colis groupés par
point relais. La période et la recherche filtrent donc du contenu absent, et
« Dépensé / Prix médian / En route / Annulés » sont des chiffres de comptabilité
au-dessus d'un écran opérationnel. Ils reviennent **tels quels** sur En route /
Reçus / Tous, où ils filtrent vraiment quelque chose.

**Le bandeau « N comptes ne reçoivent aucun email » passe SOUS les colis.** Il
reste sur cet onglet (c'est bien là que les codes manquent) mais c'est une
information de **configuration** — vraie pendant des semaines, réglée une fois,
et pas depuis cet écran. En tête, il repoussait chaque jour les codes et les QR
d'une centaine de pixels.

### ⚠️ La ligne la plus urgente de l'écran était la seule tronquée
`délai dépassé depuis 3 j (29/08/2026) — va …` : elle portait
`nowrap + overflow + ellipsis` comme ses voisines. Un n° de suivi peut se
couper, une date limite non — elle passe en `lineHeight` normal et se replie.

**Mesuré au rendu, 430 px** : le premier colis passe de **~830 px du haut à
~400 px** — il est visible sans défiler, avec son identifiant et son code
d'ouverture en gros.

**Vérifié** : `npm run build` OK · **16 audits au vert** · smoke 11 écrans à
390 px : **0 débordement horizontal, 0 écran vide, 0 suspect d'affichage,
0 texte « undefined »**.


---

## 5.84 — ⚠️ « BÉNÉFICE NET 5 739 € » ÉTAIT LE CHIFFRE D'AFFAIRES SOUS UN AUTRE NOM

Trouvé en regardant l'écran Ventes à sa résolution de travail (1512 px). Deux
cases côte à côte, sur les vraies données du 1er septembre :

```
CA FINALISÉ   5 741 €      COÛT D'ACHAT  2 €          BÉNÉFICE NET  5 739 €
175 ventes                 1/175 renseigné            (en vert, 34 px)
```

`benef = ca - cout - frais` suppose que les **174 ventes sans prix d'achat ont
coûté ZÉRO**. Le « bénéfice net » valait donc mécaniquement le CA — affiché en
vert, en gros, à côté de lui. Un chiffre faux présenté comme fiable.

⚠️ **Un garde-fou existait déjà… et ne couvrait que `nbCout === 0`.** Son
commentaire disait : « prix connus en partie → on affiche le bénéfice mais on
précise "sur X/Y" ». Ce raisonnement ne tient pas à 1/175 : une légende grise de
11 px ne neutralise pas un nombre vert de 34 px.

### La règle : on ne somme QUE ce dont on connaît le coût
**`benefConnu`** additionne `vente − achat − boost` **uniquement** sur les ventes
au coût saisi. Le chiffre devient petit tant qu'il manque des prix, mais il est
**vrai**. C'est la règle de §5.27 (l'argent en attente) appliquée ici : *un total
partiel qui se présente comme complet est pire qu'un total absent.*

**Mesuré au rendu : 5 739 € → 38 €** (la seule vente au coût connu : 40 − 2),
avec « sur 1 vente sur 175 — les autres n'ont pas de prix d'achat » **en orange
gras** (`StatBox` gagne `subColor` : une légende qui AVERTIT ne peut pas être du
même gris qu'une légende ordinaire).

### ⚠️ LE MÊME CALCUL PARTAIT CHEZ LE COMPTABLE
`benefNet = ca - cout - frais` alimentait **le rapport mensuel ET le rapport
annuel** — modale, **CSV et PDF**. Les deux passent à `margeKnown - fraisConnu`,
et la **couverture voyage avec le chiffre** : « (sur 1/175 ventes au coût
connu) » est imprimé à côté du bénéfice dans les deux PDF, et une ligne dédiée
part dans le CSV.
⚠️ `marge` (régime société-marge) avait la même incohérence : `margeKnown`
(sous-ensemble connu) **moins `frais`** (toutes les ventes). Aligné sur
`fraisConnu`.

### ✅ `scripts/audit-chiffres.cjs` — 6 contrôles permanents
« Aucun total ne se présente comme complet quand il ne l'est pas » : le calcul
sur le sous-ensemble, l'affichage de CE chiffre, la couleur d'avertissement de
la couverture, les deux rapports, l'absence de tout `ca - cout - frais`, et la
couverture dans les PDF.
⚠️ **Prouvé dans les deux sens** (§21) : `git archive HEAD` dans un arbre à
part, script copié DEDANS et lancé DEPUIS cet arbre (le piège de §5.80 :
`__dirname/..` relit sinon le dépôt courant) → **6 contrôles sur 6 en échec** sur
le code d'avant.

**Vérifié** : `npm run build` OK · **17 audits au vert** · écran Ventes rendu sur
les vraies données (38 € + avertissement orange) · modale « Rapport comptable »
réellement ouverte (⋯ Outils → Rapport) et rendue sans erreur · smoke **11
écrans, 0 écran vide, 0 PAGEERROR, 0 suspect d'affichage**.

⚠️ **Ceci ne remplace pas la saisie des prix d'achat** (0 sur 278, §22) — Julien
s'en charge lui-même (« je vais faire les coûts d'achat »). Le correctif garantit
seulement que l'app **ne raconte rien de faux en attendant**.


### 5.84 (suite) — ANNONCES : 6 COLONNES DE 180 px, TOUS LES CHAMPS TRONQUÉS

Rendu à 1512 px (son écran de travail, §42). La grille était en
`minmax(160px, 1fr)` : sur un écran large, `auto-fill` fabrique donc **plus de
colonnes**, pas des cartes plus grandes — **6 colonnes de ~180 px**. Résultat
mesuré à l'écran : « **acha€** » pour « achat € », « **N° 15(** », « **N° 38!** »,
« Min. accepté » cassé sur deux lignes, « Prix conseill ». Or c'est
**précisément cet écran** qui porte le N° de la paire, le prix d'achat et le prix
plancher.

➡️ **`minmax(clamp(160px, 25%, 240px), 1fr)`**. Le pourcentage se résout sur la
largeur de la grille, donc le **plancher monte avec l'écran** :
| | plancher | résultat mesuré |
|---|---|---|
| ordinateur (grille 1124 px) | 240 px | **4 colonnes de 270 px** — tous les champs lisibles |
| téléphone (grille ~362 px) | 160 px (25 % = 90) | **2 colonnes, strictement inchangé** |

Une seule règle, **aucun test de largeur en JavaScript** (§5.62).

⚠️ **Effet de bord immédiat, vu en capture** : à 270 px de large, le ratio `3/4`
portait la photo à **~360 px de haut** — une SEULE rangée d'annonces tenait à
l'écran. Une chaussure ne se voit pas mieux en 360 px qu'en 250 : `maxHeight: 250`
+ `overflow: hidden` (l'image reste cadrée par `objectFit: cover`).

### Deux défauts de plus sur l'écran Colis
- ⚠️ **« Bordereau déjà généré chez Vinted — le PDF arrive par email. »** est
  **faux depuis §5.31/§5.72** : c'est l'extension qui va chercher le PDF à chaque
  visite (rattrapage 21 j), l'email n'est plus que le filet. Le texte l'envoyait
  surveiller sa boîte mail au lieu de simplement repasser sur Vinted — même
  famille que « ouvre ton porte-monnaie » (§5.27), un conseil qui survit à la
  fonction qu'il décrivait. Devenu « **l'extension le récupère** à ta prochaine
  visite sur Vinted (l'email sert de filet) ».
- Le bouton **« 🖨 Imprimer »** était `flex:'1 1 160px'` et **seul enfant de sa
  rangée** quand le PDF est là : mesuré **~1100 px de large** sur un écran de
  1512. `maxWidth: 340` — il grandit toujours sur téléphone, il s'arrête à une
  taille de bouton sur ordinateur.

**Vérifié** : `npm run build` OK · **17 audits au vert** · colonnes mesurées au
banc (`getComputedStyle(...).gridTemplateColumns`) : **4 × 270,5 px** sur
ordinateur · **11 écrans à 390 px : 0 débordement, 0 écran vide, 0 PAGEERROR,
0 suspect** — le téléphone est intact.

### 5.84 (suite) — LE TABLEAU DE BORD AVAIT GARDÉ L'ANCIENNE IDENTITÉ

Trois défauts trouvés en **regardant l'écran** (§5.76), tous sur des écrans que
les passes de refonte n'avaient pas ouverts.

### ⚠️ 1. DEUX DESSINS POUR LA MÊME CHOSE, DANS LA MÊME APPLICATION
`Dashboard` avait sa **propre** carte de statistique (`StatCard`) : encadrée,
ombre douce, coins arrondis, **et un EMOJI de 17 px devant chaque chiffre**.
Or tous les écrans du quotidien sont passés au **filet d'accent + chiffre hors
boîte** (§5.65), et la règle « un emoji utilisé COMME icône devient une icône au
trait » date de §5.55. Le tableau de bord était donc resté sur l'identité
d'avant — visible d'un coup d'œil en changeant d'onglet.

➡️ **`StatCard` n'est plus qu'un ALIAS de `StatBox`** (§11 : une seule
définition). `icon` et `gradient` restent **acceptés** dans la signature — les
10 appels ne changent pas — mais ne sont plus dessinés. Cet écran hérite
désormais de tout ce qui arrivera ensuite sur `StatBox`, au lieu de diverger un
peu plus à chaque passe.
Les 4 cartes cliquables « Vinted en direct » deviennent des **boutons nus**
(`border:none, background:transparent, padding:0`) enveloppant un `StatBox` :
le geste reste, le dessin est celui de tout le monde.

### 2. Deux rangées de chiffres qui ne parlaient pas de la même période
« Vinted en direct » (le mois en cours) et les 6 chiffres du dessous (**tout
l'historique**) se suivaient sans rien pour les séparer : on lit « 30 annonces »
puis « 278 paires » et on croit à une contradiction. Une étiquette
**« Depuis le début »** ouvre la seconde rangée — même gabarit que
« Vinted en direct · ce mois » juste au-dessus.

### ⚠️ 3. « ENCAISSÉ (CA) » COMPTAIT DES VENTES NON ENCAISSÉES
Le bloc « Ta semaine » (Ma journée) affichait `wca` sous le libellé
**« encaissé (CA) »**. Or `wca` vient de **`bilanVentes`** (§5.69), qui somme les
ventes **par date de VENTE** — et §5.57 a explicitement retiré la date
d'encaissement de toute l'app (« on ne te parle pas de transfert d'argent »).
Le chiffre était donc juste, le mot faux : sur cet écran, « argent en attente
≈ 1 339 € » s'affiche trois lignes plus bas, donc annoncer « encaissé » à côté
revient à dire deux choses contradictoires sur le même écran.
➡️ **« vendu sur 7 j »**. ⚠️ Ne pas réintroduire « encaissé » ici sans remettre
d'abord une vraie date d'encaissement (§5.57 : elle n'existe que pour une partie
des ventes, c'est pour ça qu'elle a été retirée).

### 4. La cloche disait « 15 colis à retirer », l'écran Achats « 3 »
Même contradiction que §5.83, au même endroit et pour la même raison : le
compteur est l'**union** des deux signaux (email + statut Vinted), donc il
inclut les colis « déposés » dont on n'a ni code ni adresse. §5.83 avait corrigé
la tuile de Ma journée ; la cloche portait encore le nombre nu.
➡️ **« N colis à retirer — tu as le code ou l'adresse »**. ⚠️ Le nombre **ne
change pas** (un colis caché est un colis perdu, §5.43) : c'est la phrase qui
dit ce qu'on peut réellement en faire, sans recalculer quoi que ce soit — donc
aucune seconde règle à maintenir.

**Vérifié** : `npm run build` OK · **17 audits au vert** (dont
`audit-variables` : aucun identifiant non déclaré) · **11 écrans à 390 px :
0 débordement, 0 écran vide, 0 PAGEERROR, 0 suspect d'affichage** (les 23 lignes
console sont le 400 volontaire de `select=owner` et les resets de fin de test) ·
capture du tableau de bord relue : les deux rangées portent le même dessin que
le reste de l'app, séparées par leur étiquette.

### ✅ 5.84 (suite) — LES NOTIFICATIONS PARTENT (1er septembre, vérifié en direct)

Julien a posé **`VAPID_PRIVATE_KEY`** dans les variables d'environnement Vercel.
C'était le dernier maillon, et il était hors de portée du code (§5.77, §5.78).

Mesuré sur la **production**, pas déduit :
```
GET  /api/push?etat=1        → {"pret":true,"devices":1}
POST /api/push {test}        → {"ok":true,"sent":1,"total":1}
```
➡️ La chaîne complète fonctionne : clé serveur → abonnement scellé → service de
push → téléphone. **La notification est réellement partie**, ce n'est pas un
« ça devrait marcher maintenant ».

⚠️ **`devices` est passé de 2 à 1** : le second appareil était abonné sous
l'ancienne clé publique et a été **purgé** par `cleSansRapport` (§5.78) — c'est
le comportement voulu, un abonnement mort ne doit pas être compté comme vivant.
Il se réabonne **tout seul** (`memeCle`, §5.61) à la première ouverture de l'app
sur cet appareil. **Rien à faire d'autre que l'ouvrir une fois.**

⚠️ **Ne pas conclure de ce test que Julien recevra une notification pour chaque
vente** : une notification de vente naît d'un **email de vente**, et **5 comptes
sur 9 ne reçoivent aucun email** (§5.81 — leurs boîtes ne transfèrent pas vers
l'adresse de réception de l'app). Le canal est réparé ; la couverture par compte
reste le point ouvert, et il est affiché dans Réglages → Notifications.

---

## 5.85 — ⚠️ LE DÉTAIL D'EXPÉDITION NE PARLE PAS LA LANGUE DE LA COMMANDE

Julien : « j'ai généré manuellement le bordereau et l'extension m'a mis encore
que c'était **en paiement validé** et non en génération de bordereau. Et ensuite
quand j'ai actualisé l'extension, **la vente s'est automatiquement supprimée** et
ça n'a pas marqué que le bordereau a été généré. »

Deux symptômes, **trois défauts**, tous mesurés sur la vraie base avant d'écrire
une ligne (§46).

### Ce que la base dit — deux vocabulaires, pas un
| statut de COMMANDE (`orders_sold`) | n | statut d'EXPÉDITION (`txn.shipment.status_title`) | n |
|---|---|---|---|
| Commande finalisée… | 278 | **`1`** (un NOMBRE) | **284** |
| Remboursement effectué | 42 | Commande livrée ! | 110 |
| Commande expédiée… | 40 | Commande expédiée… | 28 |
| Bordereau envoyé au vendeur | 14 | Bordereau envoyé au vendeur | 17 |
| colis déposé en point relais | 11 | Commande annulée - article indisponible | 16 |
| | | **Commande du bordereau d'envoi validée** | **3** |
| | | Le paiement a échoué | 1 |

⚠️ **Le détail emploie des libellés que la commande n'utilise JAMAIS** — dont
**« Commande du bordereau d'envoi validée »**, qui est très exactement le statut
qui apparaît **juste après une génération manuelle**.

### A. La vente DISPARAÎT sur un statut qu'on ne sait pas lire
`encoreAExpedier` passait le statut du détail à **`awaitingShip`**, une **liste
POSITIVE de deux phrases** (« bordereau envoyé au vendeur » / « paiement
validé »). Tout le reste du vocabulaire d'expédition répondait donc « non, plus
rien à expédier » → **la vente sortait de la liste**. C'est le symptôme #2, mot
pour mot.
⚠️ §5.17 avait déjà tiré cette leçon **côté app** (« la liste positive laissait
passer 4 cas ») ; l'extension ne l'a jamais reçue.

### B. Un CODE NUMÉRIQUE traité comme un libellé
Sur **284 lignes**, `shipment` vaut `{}` et `status_title` vaut `""` : la chaîne
de replis `sh.status_title || sh.status || t.status_title || t.status` retombe
alors sur **`t.status` = le nombre `1`**. On demandait donc à une règle de texte
de lire un code. Aucune de ces 284 ne coïncide avec une vente en attente
aujourd'hui — mais c'est un piège armé, pas une hypothèse.

### C. Le LIBELLÉ et le FILTRE ne lisaient pas la même source (§11)
`aGenerer` / `emis` lisaient `o.status` (la **commande**, périmée) pendant que le
filtre lisait la **capture la plus fraîche**. La ligne survivait donc grâce au
détail frais mais **se décrivait avec l'ancien statut** → « pas encore générée »
alors que le bordereau existait. C'est le symptôme #1.

### La règle : `etatExpedition(st)` — TROIS états, et le 3ᵉ est le plus important
Au **niveau module** (une seule définition, §11), à côté de `aGenererBordereau` :
`'attend'` · `'parti'` · **`null` = « ce statut ne nous dit rien »**.
➡️ **On ne conclut JAMAIS « le colis est parti » depuis un statut illisible** —
un code numérique, une chaîne vide, un libellé que Vinted inventera demain. Le
détail ne tranche que lorsqu'il **dit** quelque chose ; sinon la commande reste
la référence. C'est §16 (« une liste vide n'est jamais une réponse ») appliqué
aux statuts.
`statutFrais(tx, …)` nomme **une fois** le statut qui gouverne : le filtre ET
l'étiquette le lisent.
⚠️ `awaitingShip` est **inchangée** (elle reste la règle du vocabulaire des
COMMANDES, et `audit-coherence` la compare à `isAwaitingShipStatus` de l'app par
un regex sur sa ligne — ne pas la reformater).

### La génération travaillait aussi sur le statut périmé
Conséquence directe, jamais vue jusqu'ici : après une génération manuelle,
**la 1ʳᵉ passe REGÉNÈRE** une étiquette qui existe déjà (requête pour rien,
refusée par Vinted → « il y a des messages d'erreur », §5.71) **et la 2ᵉ passe
REFUSE d'aller chercher le PDF** (`aGenererBordereau(o.status)` la fait sortir).
**Donc le bordereau n'arrive jamais dans l'app** — c'est la plainte §5.72 qui
revenait par une autre porte.
➡️ `genererBordereauxEnAttente` lit le détail de CE compte en **SCALAIRES**
(`select=id,st:…->shipment->>status_title,cap:data->>capturedAt` — jamais
`select=data`, §34) et travaille sur le statut qui gouverne.

### ✅ Prouvé sur la VRAIE base, dans les deux sens
Banc `vm` exécutant le VRAI `buildPanelData`, avec **une seule fixture de banc**
(jamais écrite en base) : un détail frais portant « Commande du bordereau d'envoi
validée » sur une vente réelle (`tx=21883380310`, nike zoomX vaporfly).
| | colis à envoyer | la cible |
|---|---|---|
| **code d'avant** | 14 → **13** | **ABSENTE (disparue de la liste)** |
| **code corrigé** | **14** | **PRÉSENTE** · `aGenerer=false emis=true` → « étiquette prête » |

⚠️ **Piège de banc** : la fixture doit porter un `uid` de compte VIVANT —
`txnRows` est filtré par `keepAcc`, donc une ligne à `uid: ""` est écartée en
silence et on mesure « rien n'a changé » (§21, encore).

**`scripts/audit-bordereau-etat.cjs`** (nouveau, **9 contrôles**) exécute la
vraie fonction sur les **11 statuts d'expédition relevés en base** + les valeurs
illisibles, et vérifie le câblage des trois défauts.
⚠️ Il ne **s'arrête pas** quand `etatExpedition` est absente : il rejoue
l'ancienne sémantique pour montrer, statut réel par statut réel, ce qu'elle
cassait — un audit qui sort au premier manque ne prouve qu'une chose.
**Rejoué sur le code d'avant : 8 contrôles en échec**, dont
`"Commande du bordereau d'envoi validée" → parti` et `"1" → parti`.

### Vérifié
`node --check` OK · **18 audits au vert** (`audit-coherence` : 0 désaccord sur
les 12 statuts réels — `awaitingShip` et `etatExpedition` sont d'accord sur tout
le vocabulaire des COMMANDES, aucune régression) · vrai `buildPanelData` contre
la vraie base : **14 colis, mêmes chiffres qu'avant** hors scénario.
Extension **5.48.0** — à recharger dans Chrome.

---

## 5.86 — ⚠️⚠️ L'INSTRUMENTATION NE SURVIVAIT PAS AU SERVICE WORKER (et 2 colis introuvables)

Julien : « pour l'extension c'est pas encore parfait quand il y a une vente ».
Méthode habituelle : lire la base avant de coder (§46).

### Ce que la base dit (2 septembre)
| | |
|---|---|
| ventes qui attendent l'envoi | **16** |
| avec un bordereau capté par l'extension | 12 |
| **sans AUCUN PDF** (ni capté, ni email) | **2 — les deux de `tomj606`** ⚠️ |
| comptes **sans un seul** bordereau capté | **2 : `julienf765`, `tomj606`** (les 7 autres en ont) |

⚠️ Ce n'est **pas** la fraîcheur ni le garde-fou « compte connecté » : ces deux
comptes sont captés **le jour même** (235 et 205 lignes). C'est spécifique à eux.

### 1. ⚠️⚠️ POURQUOI ON NE POUVAIT PAS L'EXPLIQUER : les sondes mouraient
`_diag.n` et `_rates` étaient des variables de **MODULE**, écrites en base au plus
une fois par minute. Or **Chrome tue un service worker MV3 après ~30 s
d'inactivité** : le tampon mourait donc AVANT le flush.

**Preuve directe en base, pas une hypothèse.** `recupererLabel` pose **trois**
échantillons dans la même boucle (`label_url`, `shipments/{id}`, `label_options`),
à quelques centaines de millisecondes. Le premier écrivait et **consommait le
quota d'une minute** ; les deux suivants étaient jetés, puis mouraient avec le
worker. En base, `rates` ne contient QUE **`label_label_url`** — jamais `label`,
jamais `label_label_options`.
➡️ **C'est exactement pour ça qu'après trois sessions d'instrumentation on ne
connaissait toujours la forme d'AUCUNE de ces réponses.** La sonde posée en §5.24
et réparée en §5.52 ne pouvait structurellement pas écrire ce qu'on lui demandait.

Même dégât sur les compteurs : **`label_url_trouve = 6` pour `label_envoye = 2`,
sans aucun compteur d'échec entre les deux** — les deltas manquants n'ont jamais
été flushés. J'ai raisonné plusieurs sessions sur des compteurs sous-comptés.

➡️ **Le tampon vit désormais dans `chrome.storage.local`** (`vrmDiagBuf`) : local,
gratuit, zéro égress, et il **survit à la mort du worker**. Le throttle ne protège
plus que l'écriture Supabase ; il ne peut plus rien perdre. `majTampon()`
sérialise les lecture-modification-écriture (deux appels concurrents perdaient
sinon des incréments), le tampon **n'est vidé que si l'écriture a abouti**, et une
alarme le réveille pour qu'il ne dorme pas indéfiniment.

⚠️ **Règle** : dans un service worker MV3, **aucun tampon de plus de ~30 s ne
peut vivre en variable de module**. Ça vaut pour toute future sonde.

### Le seul échantillon qui a survécu, et ce qu'il dit
```
label_label_url · shipId 51111914706 → {"label_url":null,"code":0}
```
Vinted répond donc **200 avec un `label_url` NUL** pour au moins certaines
expéditions dont le bordereau a pourtant été « envoyé au vendeur ». On ne sait
**pas encore** pourquoi (transporteur ? PDF pas encore déposé sur S3 ?) — et
c'est justement ce que les deux échantillons manquants diront à la prochaine
visite, maintenant qu'ils peuvent être écrits.

### 2. ⚠️ DEUX COLIS À LA FOIS = LE TÉLÉCHARGEMENT MANUEL NE POUVAIT PAS ÊTRE RELIÉ
`storeLabel` n'attribue le PDF qu'à condition qu'il n'existe **qu'un seul** colis
possible pour ce compte (règle juste, §24 : on ne devine jamais). Or `tomj606` a
**exactement deux** ventes en attente sans bordereau : même en les téléchargeant à
la main, **aucun des deux n'était relié à sa vente**, et le second écrasait le
premier dans `label_latest`. C'est très exactement le compte dont Julien se plaint.

Et à l'écran, l'échec était un **cul-de-sac** : le panneau affichait la raison
technique (« Vinted n'a pas donné l'URL du PDF ») et il n'avait plus rien.

➡️ **Le rendez-vous** (`attendreBordereau`) : quand c'est NOUS qui l'envoyons
télécharger UNE vente précise, on sait laquelle. Ce n'est pas une devinette —
c'est l'identité de la vente qu'il vient d'ouvrir, **sur son clic**. Court
(15 min), **à usage unique**, borné au compte concerné. La règle « un seul
candidat » reste en second, inchangée.
➡️ Le bandeau d'échec porte maintenant **« ⬇ Ouvrir la vente sur Vinted »** : il
pose le rendez-vous puis ouvre `/member/transactions/{tx}`. Il télécharge le
bordereau, `chrome.downloads` le capte (§5.46) et le range **sur la bonne vente**.

### Vérifié
`node --check` OK sur les deux fichiers · **18 audits au vert** ·
`audit-diagnostic.cjs` passe à **10 contrôles** et **5 échouent sur le code
d'avant** — dont « les 3 échantillons de la chaîne bordereau arrivent en base »,
qui manque exactement `label` et `label_label_options`, **la situation mesurée en
base** · `audit-bordereau-pdf.cjs` passe à **14 contrôles**, **3 échouent sur le
code d'avant** (§21), et l'audit **ne s'arrête plus** au premier manque : il
rejoue l'ancien `storeLabel` pour montrer contrôle par contrôle ce qu'il ne
savait pas faire — « un seul colis possible → toujours relié » passe dans les
deux sens, donc aucune régression · banc panneau dédié sur le **cas réel**
(les 2 ventes de `tomj606`) : le bouton de secours apparaît, le rendez-vous part
avec **`tx=21928427030`**, la bonne page s'ouvre, **0 erreur d'app** · vrai
`buildPanelData` contre la vraie base : 32 annonces, 80 ventes, **16 colis** —
aucune régression.
⚠️ `audit-bordereau-pdf.cjs` lisait le fichier par un **chemin absolu** : lancé
depuis un arbre de test il relisait le dépôt courant, donc la preuve « ça échoue
sur le code d'avant » aurait été truquée (§5.80). Passé en `__dirname`.

Banc panneau complet : **14 onglets rendus, 0 PAGEERROR**.
⚠️ **Le banc du panneau criait au loup depuis la 5.40** : sa liste d'onglets
datait d'avant le dépliant « Plus », donc il annonçait « onglet absent » pour
`ventes`, `recherche`, `coffre`, `litiges`, `favoris` — cinq onglets
parfaitement vivants — et `republier`, retiré exprès en 5.70. **12 échecs → 6**,
tous des artefacts assumés (l'onglet `reponse` n'existe que sur une page de
conversation ; `republier` n'existe plus). Un banc qui crie au loup n'est plus
lu (§5.14) : sa liste doit suivre `PANEL_TABS`, et ouvrir « Plus » avant de
cliquer un onglet caché.

Extension **5.49.0** — à recharger dans Chrome.

---

## 5.87 — LE RAPPORT URSSAF : il existait, et il ÉCARTAIT 2 174 € de ventes finalisées

Julien : « je veux aussi que tu me fasses un rapport tous les mois de la somme de
toutes les ventes finalisées pour mon URSSAF ; si c'est déjà fait, améliore la
viabilité. » **C'était déjà fait** (§7, le rapport comptable) — donc la demande
est bien « fiabilise-le ». Méthode habituelle : mesurer la vraie base avant
d'écrire une ligne (§46).

### ⚠️⚠️ 1. LE DÉFAUT : les ventes masquées à l'écran sortaient du CA DÉCLARÉ
Les deux rapports (mensuel ET annuel) commençaient par `if (isHidden(o)) continue;`.
Or `vinted_sales_hidden` contient **209 ventes masquées à la main** (§5.57) : un ✕
sur une carte range un écran, **ça n'annule pas une vente encaissée**.

| mesuré le 2 septembre | |
|---|---|
| CA que le rapport affichait | 5 814,09 € |
| **CA écarté parce que masqué** | **2 174,80 € · 101 ventes finalisées** ⚠️ |
| juin 2026 | **1 vente / 41 €** affiché contre **42 ventes / 1 512,70 €** réels |

➡️ **Un chiffre destiné à une déclaration ne peut pas dépendre d'un geste
d'affichage.** Les ventes masquées **comptent** dans le CA, et leur poids est
affiché à part (`nMasq` / `caMasq`) — auditable, jamais silencieux. C'est la
règle de §5.27 : *un total partiel qui se présente comme complet est pire qu'un
total absent.*

### 2. Le récap du tableau de bord lisait une archive VIDE
Le bloc « À payer pour <mois> » et le tableau des 12 mois lisaient
`vinted_sales` — **0 ligne en base** (l'ancien catalogue, vidé en juillet 2026,
§4). Donc **0 € partout**, en permanence.
➡️ L'écran Ventes **publie** `vinted_urssaf_mois` (§11 : un propriétaire, les
autres consomment — exactement le motif de `vinted_nums_physiques`, §5.14), et le
tableau de bord le consomme. **Mesuré au rendu : 22 mois publiés**, et le bloc
d'échéance affiche « Période août 2026 · CA finalisé 3 163,20 € → à payer
≈ 427,03 € » — le chiffre de la moisson, plus un zéro.
⚠️ Clé **locale**, pas dans `SYNC_KEYS` : c'est une photo recalculable.

### 3. Le taux de cotisations était écrit en dur à 14 endroits
13,5 % figé dans le code — donc faux le jour où son taux change (ACRE, activité
mixte, versement libératoire). `vinted_urssaf_taux` (réglable dans Réglages →
Régime, **synchronisé**) + `tauxUrssaf()` au niveau module : modale, CSV, PDF et
tableau de bord lisent la même valeur. Un taux illisible **retombe sur 13,5**,
jamais sur zéro.

### ⚠️ 4. LA MARGE ANNUELLE MÉLANGEAIT DEUX ENSEMBLES
`marge = margeKnown - frais` : le sous-ensemble des ventes **au coût connu**
moins les boosts de **TOUTES** les ventes. §5.84 avait corrigé le mensuel — pas
l'annuel, qui part pourtant chez le comptable lui aussi. Aligné sur `fraisConnu`.

### ⚠️ 5. « CA ENCAISSÉ » ÉTAIT LE MAUVAIS MOT (et ça compte ici)
Les deux rapports et le tableau de bord annonçaient un **« CA encaissé »**. Or
§5.57 a retiré la date d'encaissement de toute l'app : tout est daté au jour de
la **VENTE**. Sur un écran de gestion c'est un détail ; sur un document destiné à
l'URSSAF — qui demande légalement les recettes **encaissées** sur la période —
c'est une affirmation fausse.
➡️ Partout « **CA des ventes finalisées** », et le tableau de bord **le dit** :
« ces ventes sont datées au jour de la vente, pas au jour où Vinted t'a versé
l'argent — vérifie ton chiffre sur autoentrepreneur.urssaf.fr, je ne suis pas
comptable ». On n'invente pas une date d'encaissement pour faire joli (§5.57 :
elle n'existe que pour une partie des ventes, c'est pour ça qu'elle a été
retirée).

### ✅ `scripts/audit-urssaf.cjs` — 18 contrôles permanents
Il **exécute** la règle (`caUrssafParMois`) dans un `vm` contre les **8 statuts
réellement présents en base** : seules les finalisées comptent, une vente masquée
reste dans le total (141 €, pas 41 €), son poids est compté à part, un
remboursement n'est jamais du chiffre d'affaires, le taux vient du réglage
(virgule acceptée) et un taux illisible retombe sur le défaut. Puis, en statique :
les deux rapports n'écartent plus les masquées, comptent `nMasq`, appliquent le
taux, ne disent plus « encaissé », la marge annuelle ne mélange plus deux
ensembles, le récap est publié ET consommé, et plus aucun 13,5 % n'est en dur.
⚠️ **Prouvé dans les deux sens** (§21) : rejoué sur le code d'avant (`git archive
HEAD` dans un arbre à part, script copié DEDANS et lancé DEPUIS cet arbre — le
piège de §5.80), il sort **13 contrôles en échec**.

### ⚠️ Piège d'outillage : `vm.runInContext` n'expose PAS les `const`
Une déclaration `const` est **lexicale** : contrairement à une `function`, elle ne
devient jamais une propriété de l'objet de contexte. L'audit plantait sur
`ctx.venteFinalisee is not a function` alors que le code était juste. Il faut
**exporter explicitement** à la fin de la source évaluée
(`Object.assign(this, { … })`) — le motif déjà utilisé dans
`audit-bordereau-pdf.cjs`.

### Vérifié au RENDU RÉEL (§20, vraies données)
| | |
|---|---|
| rapport **mensuel**, juin 2026 | **CA des ventes finalisées 1 512,70 € · 42 ventes · cotisations 204,21 €**, avec « 41 ventes masquées dans l'app (1 471,70 €) sont comptées dans ce CA » |
| rapport **annuel** 2026 | **7 626,89 € · 235 ventes**, dont 1 885,80 € masqués |
| `vinted_urssaf_mois` publié | **22 mois** (2026-08 : 101 ventes / 3 163,20 €) |
| tableau de bord | « Période août 2026 · CA finalisé 3 163,20 € → à payer ≈ 427,03 € » |

⚠️ **Piège de banc, deux fois** : (1) la modale s'ouvre sur le **mois en cours** —
le 2 du mois il est vide, on mesure « 0 € » et on conclut à tort que le rapport
ne marche pas ; il faut choisir un mois qui a des ventes. (2) `body.innerText`
place la modale **à la fin** du texte : lire les 700 premiers caractères ne
montre que l'écran derrière, et on croit que rien ne s'est ouvert.

`npm run build` OK · **19 audits au vert** · smoke **11 écrans, 0 écran vide,
0 PAGEERROR, 0 suspect** · banc 390 px : **0 débordement**.

### ⚠️ CE QUE CE RAPPORT NE RÈGLE PAS
**0 prix d'achat sur 278 paires** (§22) : le CA déclaré est juste, le **bénéfice**
reste calculé sur la seule vente au coût connu (et le dit — §5.84). Julien s'en
charge lui-même (« je vais faire les coûts d'achat ») ; les outils de saisie
existent (§5.47 en série, §5.64 en un tap).
