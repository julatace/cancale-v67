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
