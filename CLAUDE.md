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

- **Deux tableaux constants énormes, chacun sur une seule ligne physique** : `INIT_CAT` (catalogue initial, ~1815 entrées) et `INIT_SAL` (ventes initiales, ~1580 entrées), situés tout en haut du fichier (juste après la définition des thèmes). À eux deux ils représentent la majorité du poids du fichier. **Conséquence pratique** : tout outil qui fetch le fichier brut à distance (`raw.githubusercontent.com`, `web_fetch`, etc.) sans accès filesystem réel va tronquer bien avant d'atteindre le code utile plus bas dans le fichier — ce n'est pas un bug, juste la structure du fichier. En local avec `cat`/`grep`/un éditeur, aucun souci.
- **Ne jamais lire tout le fichier d'un coup avec un outil à limite de tokens.** Utiliser `grep`/`rg` pour cibler une fonction ou une section avant de lire, comme on l'a fait pour ce brief (ex: `grep -n "fetchVintedOrders" src/App.jsx`).
- **Thème clair/sombre** : géré via une variable de module mutable `let C = THEMES.light` réassignée à chaque rendu du composant `App` (`C = dark ? THEMES.dark : THEMES.light`). Ce n'est pas un pattern React idiomatique (variable globale mutable plutôt que contexte), mais c'est le choix actuel — tout le reste du fichier lit `C.xxx` pour les couleurs. Ne pas le refactorer sans en parler à l'utilisateur, ça touche à absolument tout l'UI.
- **Synchronisation cloud maison** : pas de vrai backend applicatif. Le localStorage du navigateur est la source de vérité immédiate, et une liste `SYNC_KEYS` définit quelles clés localStorage sont synchronisées vers une seule ligne Supabase (`app_data`, id=`main`, colonne `data` en JSONB) :
  ```
  vinted_catalog, vinted_sales, vinted_garage_grid, vinted_blocked,
  vinted_extracols, vinted_colors, vinted_invoices,
  vinted_invoice_settings, vinted_custom_logo, vinted_dark, vinted_stock_vinted,
  vinted_accounts, vinted_account_labels
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
- **Endpoint conversations/messages : jamais trouvé.** Tentatives faites et échouées : `/api/v2/conversations` (404), `/api/v2/transaction_messages?folder=message` (404, endpoint sourcé d'un wrapper communautaire non fiable). `/api/v2/conversations/stats` fonctionne mais ne renvoie qu'un compteur, pas la liste. **Fonctionnalité mise en pause**, pas abandonnée : l'UI et la fonction `fetchVintedConversations` existent déjà dans `App.jsx` avec un fallback propre (état vide + visualiseur JSON brut de debug). Pour la reprendre : ouvrir une conversation précise sur vinted.fr avec l'onglet Réseau des DevTools ouvert, chercher la requête XHR/fetch réelle.
- **Statuts de commande** : Vinted ne renvoie pas un enum documenté, juste un champ `status` texte libre. La fonction `classifyOrderStatus(status)` dans `App.jsx` classe ce texte par regex :
  - `/annul|cancel|refus|rembours/i` → `'cancelled'`
  - `/finalis/i` → `'completed'`
  - sinon → `'pending'`
  C'est une heuristique, pas une garantie. **Si un jour un achat mal classé réapparaît**, c'est probablement un mot de statut Vinted pas encore couvert par cette regex — l'ajuster en priorité avant de chercher ailleurs.

### Extension Chrome (`vinted-sync-extension/`)
- **Non publiée sur le Chrome Web Store**, chargée en mode développeur uniquement.
- Fichiers : `manifest.json` (MV3), `background.js` (service worker, capture les cookies via `chrome.cookies` et pousse vers Supabase table `vinted_accounts`), `content.js` (relaie le csrf-token trouvé), `inject.js` (tourne en MAIN world, intercepte fetch/XHR réels de la page), `popup.html`/`popup.js` (statut de synchro par domaine, bouton "Synchroniser maintenant").
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

**Ne fonctionne pas / en pause** :
- Messages/conversations Vinted (endpoint API introuvable, voir section 5)

**Signalé par l'utilisateur, pas encore détaillé** : Julien a mentionné qu'il reste des choses "pas très bien" dans l'app sans préciser lesquelles. **À creuser avec lui en priorité** — probablement des détails d'affichage/UX sur un ou plusieurs écrans existants plutôt qu'un bug fonctionnel majeur.

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
