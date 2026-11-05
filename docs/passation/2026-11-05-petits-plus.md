# Petits plus — 5 novembre 2026 (branche locale `v34-petits-plus`)

Quatre améliorations, chacune avec un audit qui EXÉCUTE la règle (rouge sur la
base `claude/project-review-nsk5su` et sous mutation), plus un banc rendu pour
les deux qui se voient.

## 1. La page d'accueil dit les vrais navigateurs

Avant : « S'installe une fois dans Chrome », « Ajoute l'extension à Chrome »,
« Ton ordinateur avec Chrome reste nécessaire… Chrome ouvert », « VRM agit sur
le compte ouvert dans Chrome ».

Ce qui est vrai (code et `docs/boutiques-extension.md`) :
- le paquet servi `public/VRM-extension.zip` s'installe dans **tous les
  navigateurs Chromium** : Chrome, Edge, Brave, Opera, Vivaldi ;
- **Orion** (Mac, iPhone) a son paquet servi `public/VRM-Orion.xpi` ; la 5.319
  s'installe chez Julien, mais la lecture de Vinted n'y est **pas confirmée**
  (API partielles) ⇒ « en essai » ;
- **Firefox** : le paquet existe, il n'est pas servi (aucune fiche publiée) ⇒
  « pas encore » ; **Safari** : aucun paquet ⇒ « pas encore » ;
- **aucun chemin téléphone n'est prouvé** pour LIRE Vinted ⇒ l'ordinateur reste
  nécessaire.

Une source : `navigateursServis()` dans `src/navigateursServis.js` (module léger,
ré-exporté par `src/navigateurExtension.js` avec `LIENS_BOUTIQUES` et
`LIEN_ORION_FICHIER`, qui y ont déménagé : la page d'accueil se charge AVANT
l'app et son fichier d'entrée a un budget de 26 Ko compressés — importer
`navigateurExtension.js` entier le portait à 27,5 Ko ; il est à 25,9 Ko, base
25,6) — `ordinateur`, `essai`, `pasEncore`, `lectureTelephone: false`,
`NAVS_ORDINATEUR_TEXTE`. Firefox entre
dans la liste le jour où `LIENS_BOUTIQUES.firefox` est rempli ;
`lectureTelephone` ne passe à `true` que sur une preuve. `src/Accueil.jsx` la
rend : premier écran (`data-navigateurs`, `data-lecture-telephone`), étape 2
« Ajoute l'extension à ton navigateur », note « Ton ordinateur reste
nécessaire » sans Chrome, une ligne « Orion (Mac, iPhone) : en essai, lecture de
Vinted pas encore confirmée. Safari, Firefox : pas encore. » (`data-navigateurs-essai`),
« le compte ouvert dans ton navigateur ». Style de la page inchangé.

Preuves : `scripts/audit-accueil-navigateurs.cjs` — la règle exécutée et la
PAGE RENDUE (esbuild + `react-dom/server`, au doigt et à la souris) : **27
verts**, rouge sur la base, **9/9 mutations rouges** (`--prouve`).

Pas touché (hors sujet, à signaler) : la carte « Tes comptes restent les tiens »
dit encore « Pas de relances en série aux favoris, de republication en boucle,
d'acceptation automatique des offres Vinted… ». Depuis le 27 oct., l'acceptation
automatique est rétablie (éteinte par défaut) et les messages aux favoris sont
permis sur son clic : la phrase est à revoir avec Julien.

## 2. Guide « Installer VRM sur l'iPhone »

Paramètres → Notifications → Notifications du téléphone (`PushSetting`), là où
l'app disait « installe d'abord l'app sur ton écran d'accueil (Partager → Sur
l'écran d'accueil) ». Trois étapes dessinées en SVG (aucune capture) :
1. **Touche Partager** (la barre de Safari, le bouton entouré) ;
2. **Sur l'écran d'accueil**, puis « Ajouter » (la feuille de partage, la ligne
   « + » entourée) ;
3. **Active les notifications** depuis l'icône : Paramètres → Notifications,
   « Activer sur cet appareil », « Autoriser » (l'écran d'accueil, l'icône VRM,
   sa pastille). Sur iOS < 16.4 : « Mets l'iPhone à jour » (les notifications
   d'une web app demandent 16.4).

Règle (`src/guideIphone.js`) : iPhone/iPod + **Safari** (`navigateurIci`, Orion
écarté par `window.KAGI`) + pas installée (`navigator.standalone`,
`display-mode: standalone|fullscreen|minimal-ui`) + pas fermé. La croix (44 px)
le ferme pour de bon : `localStorage.vrm_guide_iphone_ferme` (propre à
l'appareil, comme l'installation ; stockage interdit ⇒ rien ne casse). Quand il
est là, la ligne « Non disponible ici… » se tait (une phrase, une fois) ; fermé,
elle revient. Écran : `src/GuideIphone.jsx`, `src/design/guide-iphone.css`
(variables `--fu-*`, échelle fermée ; trois colonnes à partir de 720 px).

Preuves : `scripts/audit-guide-iphone.cjs` — **29 verts**, rouge sur la base,
**9/9 mutations rouges**.

## 3. Notification « compte Vinted pas relu »

Passage du MATIN de `api/ship-reminders.js` (`rappelComptesARelire`), aucune
nouvelle fonction `api/`. Règle : `api/_lib/comptes-a-relire.js`, qui IMPORTE
celles de l'app : `etatCompteLie` / `ageLecture` (`src/comptesLies.js`, plus de
24 h ⇒ « à relire ») et `compteEcarte` (`api/_lib/ventes-regle.js`).
- Fraîcheur : la plus récente des lignes `harvest_{uid}_*` captées avec SA
  session (pas `_enligne`), `capturedAt` (repli `updated_at`, la règle
  `harvestTs`), en projection `id,updated_at,cap:meta->>capturedAt`, lignes
  vidées écartées (`meta->>supprime=is.null`), paginée.
- Jamais nommé : hors des totaux (`vinted_accounts_hidden`, `panel_accounts_off`,
  `false` = rallumé), supprimé (absent de `vinted_accounts`, ou dans
  `vrm_blocked_accounts`), banni (`panel_comptes_etat`), jamais daté (pas su).
- Une lecture ratée (comptes, `main`, panneau, état, liste noire, lignes, mémo)
  ⇒ rien. Compte lu ⇒ rien.
- UNE par jour au plus : mémo `relecture_rappel_dedup` `{jour}` (Paris), écrit
  AVANT l'envoi et confirmé.
- Catégorie `relecture`, famille **Rappels** (`api/_lib/notif-textes.js` ;
  hérite de l'ancien « Compta »), `PUSH_DEFAUT.relecture = true` ; passe par
  `sendPushToAll({ cat })` ⇒ choix par type et heures calmes (rangée dans le
  centre, pas sonnée). Le toucher ouvre Paramètres → Comptes liés
  (`DESTINATIONS.comptes`, `?tab=vintedaccounts`). Aperçu dans Paramètres →
  Notifications (« Rappels »), tiré de la vraie fabrique.
- Texte : « 🔄 Compte Vinted pas relu : X » / « Dernière lecture il y a 2 j.
  Ouvre vinted.fr connecté sur ce compte, dans le navigateur où est l'extension
  VRM. » ; plusieurs : « 🔄 N comptes Vinted pas relus », quatre noms au plus,
  le reste compté. Jamais « Chrome ». La réponse du cron ne porte qu'un nombre.

Preuves : `scripts/audit-compte-pas-relu.cjs` — la règle seule ET la vraie route
du cron contre une fausse base et un faux Web Push : **51 verts**, **11 rouges
sur la base**, **12/12 mutations rouges**.

## 4. Le contrôle de la production

`scripts/verifier-production.mjs` (workflow `.github/workflows/disponibilite.yml`,
inchangé dans sa planification `17 */6 * * *` pour que la personne prévenue par
GitHub reste la même). Public, sans session, sans secret :
page d'accueil + son titre (celui d'`index.html`) + `/assets/` ; page de
récupération ; `/api/sante` : `ok`, TOUTES les clés que déclare `sante()` dans
`api/compte.js`, chacune un oui/non, `serviceKey` vrai ; la route
confidentialité refuse sans session (401) ; `/VRM-extension.zip` : un vrai zip,
UN dossier, version = `EXT_ATTENDUE` ; `/VRM-Orion.xpi` : version du paquet du
dépôt ; la notice Orion ; `/manifest.webmanifest` et ses icônes ; `/sw.js` en
JavaScript (pas la page de l'app). Un échec : ligne « ÉCHEC … — cause »,
annotation `::error title=Production : …` sous Actions, code 1 ⇒ job rouge.
`VRM_ORIGINE` permet de jouer le contrôle contre une copie locale.

⚠️ Une version d'extension montée dans `main` avant le déploiement Vercel peut
faire échouer UN passage (le contrôle compare au dépôt) : le suivant, 6 h plus
tard, repasse vert.

Preuves : `scripts/audit-verifier-production.cjs` — le script exécuté contre une
copie locale saine puis cassée de 13 façons : **22 verts**, **18 rouges sur la
base**, **10/10 mutations rouges**.

## Banc rendu

`scripts/bancs/petits-plus.cjs` (`BANC_PORT` 8931, données inventées,
`npm run build` d'abord) : la page d'accueil (390 tactile et 1512, clair et
sombre du système) et le guide (agent iPhone Safari sans `PushManager`, 390 ×
844 clair et sombre, iPhone couché 844 × 390 ; jamais pour l'app installée,
Chrome iPhone, Orion, l'ordinateur à 1512 clair et sombre). **57 verts.**
Captures regardées : guide clair/sombre, trois colonnes alignées couché, accueil
haut et section « installation ».

## Audits voisins

`notifications` 31/0, `notifs-centre` 28/0, `reveil-calme` 13/0,
`relances-essai` 31/0, `fonctions-api` vert, `coherence` vert, `icones` vert,
`chrome-en-dur` vert, `lancement` 31/0. Déjà rouges sur la base, inchangés :
`vendeur-neutre` (1 rouge, `src/App.jsx` consigne Vercel hors condition
propriétaire), `bilan-semaine` (2 rouges : l'app ne liste plus les catégories
`{id, def}` depuis les familles), `fusion-echelle --verifier` (6 fichiers des
autres chantiers). Banc `accueil.cjs` : 167 verts, 4 rouges — les MÊMES 4 que
sur la base (budgets de hauteur des sections « questions »/« comment », un texte
à 12,0 px dans la carte, le film) ; la ligne Orion allonge « comment » (629 px à
1512 au lieu de 591, 1006 à 390 au lieu de 900 ; déjà au-dessus du budget sur la
base). Le budget du fichier d'entrée reste vert (25,9 Ko).
⚠️ `audit-extension-navigateurs` et `audit-mentions-paiement` régénèrent les
zips de `public/` : `git checkout -- public` avant de commiter.

## Gestes de Julien

- Ouvrir VRM dans Safari sur l'iPhone (pas depuis l'icône) : Paramètres →
  Notifications → Notifications du téléphone ⇒ le guide ; le fermer.
- Rien à faire pour la notification : elle part le matin si un compte gardé dans
  les totaux n'a pas été relu depuis plus de 24 h.
