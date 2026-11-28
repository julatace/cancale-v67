# 28 nov. 2026 — « Mode ordinateur allumé » : l'ordinateur serveur (ext. 5.457.0, capacité `serveur`)

Branche `claude/ordinateur-serveur` (depuis `origin/main` 18e068604). **Pas de PR** (consigne). Version **5.457.0** partout
(`CODE_VERSION`, manifeste, `CAPTEUR_VERSION`, `relaisVersion`, `EXT_ATTENDUE`, `public/extension-version.json`, Orion) ;
capacité `serveur` (`serveurTick`) dans `EXT_CAPACITES` et `audit-coherence` ; zips régénérés (`scripts/zip-extension.cjs`).
D'autres branches sont en vol avec 5.455.7 (favoris) et 5.456.0 (panneau de connexion) : 5.457.0 reste au-dessus.

## 1. La demande (Julien, 28 nov.)

> « Je vais laisser un ordinateur allumé toute la journée, comme un serveur. Je veux que l'extension me permette de garder
> mes anciens comptes Vinted dessus toute la journée, et faire ce que je veux : publier, republier, envoyer des messages,
> répondre aux offres, recevoir des messages. Aujourd'hui je ne suis prévenu d'un message que 15 minutes après, quand
> l'e-mail arrive. Je veux que l'extension rafraîchisse Vinted régulièrement pour que j'aie une notification dès qu'il y a
> vraiment un nouveau message. La notification doit montrer la vraie question de la personne et le nom du compte Vinted, si
> j'en ai plusieurs. Ça doit être parfait, irréprochable, et je dois pouvoir agir sur les différents comptes. »
>
> Puis (relayé) : « Plusieurs comptes Vinted si c'est par profil Chrome c'est bon, c'est comme si on était 2 utilisateurs
> distincts. » — un profil Chrome par compte Vinted, chacun avec SA copie de l'extension. Le tour entre profils est GARDÉ
> (même ordinateur, même IP : Discrétion §3 « jamais deux comptes au même moment sur un ordinateur »), lectures décalées aussi.

**Sa décision remplace, pour ce chemin seulement, la règle du 21 nov. « le texte du message ne part jamais »** (`pushcapte`) :
le texte de l'acheteur part, nettoyé (sans balise, sans lien, sans caractère de contrôle) et coupé proprement.

## 2. Ce qui existait déjà (mesuré dans le code)

- Un compte par cookie, donc **un compte par profil Chrome** : chaque profil = son `chrome.storage.local`, son `idAppareil`,
  SA ligne `presence_{appareil}`. Rien n'empêchait N profils connectés au même compte VRM.
- « À distance » (5.436) : la file `cmd_dist_*` couvre déjà répondre, accepter/refuser/contre-offre, prix (baisse), masquer,
  republier, bordereau, relire, favoris, vacances, créer (publier) — exécutés par LE profil dont le cookie est le compte visé
  (`distPeutPartir` : sinon « autre-compte »). **Aucun geste manquant** pour la demande : rien ajouté à `ADIST_GESTES`.
- La boîte n'était relue que par la moisson (toutes les 20 min, hors budget de lecture) et la page ouverte : d'où le retard.
- Le budget de LECTURE est de **20/h par compte**, tous Chrome confondus (`LECTURES_MAX_HEURE`, partagé avec les photos,
  l'argent, les colis). Non monté.

## 3. Ce qui est construit

### La règle — `src/ordinateurServeur.js` (bloc `<serveur-regle>`, recopié dans background.js : `node scripts/audit-ordinateur-serveur.cjs --recopie`)
- `srvIntervalle` : 4 à 7 min **au hasard**, jamais à moins de 7 s du précédent (« jamais deux fois le même temps ») ;
  `SRV_PLAFOND_LECTURES = 14` (la veille s'arrête à 14 des 20 lectures/h ; 6 restent à l'argent, aux colis, aux photos) ;
  `SRV_FILS_PAR_TOUR = 3` ; `SRV_DECALAGE_MS = 20 s` entre deux profils.
- `srvChangees` : la 1re lecture d'un compte est le **point de départ, en silence** ; ensuite seule une conversation NON LUE
  dont `updated_at` a bougé est ouverte.
- `srvNeufsDuFil` : identité = conversation + `entity.id` (message) ou `offer_request_id` (offre en attente, statut 10) ;
  jamais de moi, jamais sans date, jamais avant le point de départ, jamais déjà vu. Une notification par conversation (la
  plus récente ; une offre passe devant).
- `srvTexte` (coupé à un espace, « … »), `srvTour` (le tour d'écriture, 60 s, prolongé, rendu, périmé ⇒ libre), `srvLigne`
  (l'état d'un profil : pret · deconnecte · captcha · pause · prudence · budget · off · eteint).

### L'extension — background.js, section « ORDINATEUR SERVEUR »
- **Éteint par défaut**. Interrupteur : panneau → Paramètres → « Mode ordinateur allumé » (`serveurCarte`), SON toucher.
- `serveurTick` (réveil `vrm-relais`, 30 s) : session VRM exigée ; onglet vinted.fr **épinglé** gardé (`serveurOnglet` :
  rouvert s'il est fermé, rechargé s'il est déchargé ou après 3 lectures ratées, `autoDiscardable: false`) ; rien pendant
  une pause 429/403, un captcha, la prudence (lectures de fond suspendues 24 h) ; décalée de 20–45 s si un autre profil
  vient de lire ; `compterLecture(uid, 14)` ; `GET /api/v2/inbox` par `vintedGetCookie` → `requeteVinted` (une requête à
  la fois, pause posée sur 429/403) ; compte relu après la lecture (§5 : jamais B rangé sous A) ; boîte rangée
  (`storeHarvest`) ; au plus 3 fils neufs ouverts (chacun une lecture), **rangés puis relus dans la base** avant d'être
  annoncés ; `POST /api/push { action:'serveur', evenements }` (identités seulement), file `vrmServeurFile` (503/réseau :
  rejouée, 24 h ; 400 : vidée).
- **Déconnecté** (le cookie ne donne plus de compte alors qu'il y en avait un) : UNE annonce `deconnecte` par déconnexion,
  la veille s'arrête jusqu'à la reconnexion.
- **Le tour d'écriture** : allumé, `compterAction` (TOUTE écriture : clic, automatisme, « À distance ») demande le tour
  (`tourAvantEcriture` → `POST /api/push { action:'tour' }`) ; un autre profil l'a ⇒ code `tour` (`garde`/`gardeStricte`
  le disent ; une commande à distance ATTEND : `tour` ajouté à `ADIST_ATTENDRE`) ; pas su ⇒ rien ne part. `distanceTick`
  prend le tour AVANT la prise d'une commande et le rend après le geste. Éteint : rien ne change.
- La voie « capte » se tait pour les messages Vinted quand la veille est allumée (pas deux notifications).
- La présence publie `serveur` : compte, nom, dernière lecture, prochaine, actions de l'heure, plafond, pause / captcha /
  prudence / budget / déconnecté.

### Le serveur (aucune fonction de plus : 12)
- `api/_lib/push-serveur.js` (action `serveur` de `api/push.js`) : tout est RELU au nom du vendeur (compte Vinted à lui,
  message dans le fil rangé, de l'autre personne, offre en attente). Message : « Message de @pseudo » · « *texte* · compte
  shop_a · Adidas Samba » (corps ≤ 90 : le compte et l'article d'abord, le texte coupé dans ce qui reste) ; le nom du compte
  seulement s'il a **plusieurs** comptes Vinted. Offre : « Offre 45 € sur Adidas Samba » · « compte shop_a · @julie_92 ·
  Répondre » (clé `offer-capte-vinted-{n°}`, la même que « capte »). Déconnecté : « Compte shop_a déconnecté » · « Sur Chrome
  · Mac : ouvre ce profil Chrome et reconnecte-toi sur vinted.fr ». Le toucher : SA conversation (Messages · compte · conv),
  l'offre, ou `?tab=serveur`. Tag hors des genres regroupés : deux messages proches ne deviennent jamais « 2 nouveaux
  messages » sans texte. Clé réservée AVANT l'envoi (`push_dedup`), lecture ratée ⇒ 503.
- **L'e-mail d'après se tait** : chaque conversation sonnée est notée (`push_serveur_vu`, clé `k{conv}`) ; l'e-mail
  « nouveau message » ou « nouvelle offre » de Vinted dont le lien `/inbox/{id}` est CETTE conversation, dans les 45 min, ne
  sonne pas (`serveurDejaSonne`, api/email-inbound.js). Pas su ⇒ l'e-mail sonne (rien n'est avalé).
- `api/_lib/tour-ecriture.js` (action `tour`) : ligne `tour_ecriture` du vendeur de la SESSION, comparer-et-échanger.

### L'app
- **« Ordinateur serveur »** (`?tab=serveur`, Menu → Aide ; `src/serveur/EcranServeur.jsx`) : une rangée par profil —
  « shop_a · prêt · lu il y a 1 min 35 s · prochaine lecture dans 3 min 12 s (à la seconde) · 4/50 actions cette heure ·
  Chrome · Mac », « shop_b · déconnecté », « shop_c · vérification », « ne répond plus · muet depuis 07:31 » ; chaque arrêt
  a SON geste sous « Que faire ? » ; un toucher ⇒ « Mes comptes » (agir). « Vitesse des notifications » : « En moyenne :
  2 min 45 s · au pire 7 min · l'e-mail met ~15 min » (calculée sur la règle, `SRV_LATENCE`) et, sous « Pourquoi ? », la
  proposition ci-dessous. « Ajouter un compte à l'ordinateur » : 6 étapes, le détail sous « Comment faire ? ».
- `peutAgir` : un compte Vinted servi par un profil prêt ⇒ `serveur: true`, `agir.serveur.pret` ; `BadgeLectureSeule`
  montre alors « ordinateur allumé · compte X prêt » (neutre) partout où le badge par compte vit (Messages, Annonces,
  Connexions). `adistPresence` garde `serveur` (bloc recopié), `SELECT_PRESENCE` le projette.
- Panneau → Paramètres : « Mode ordinateur allumé » (état de CE profil, « prochaine lecture dans N s » à la seconde,
  Allumer/Éteindre, les autres profils de l'ordinateur, l'installation guidée en 6 étapes). 5 langues (`os_*`).
- Quoi de neuf : `ordinateur-serveur`. Textes : `src/i18n/langues/*/serveur.js`.

## 4. La latence, mesurée sur la règle — et LA PROPOSITION à Julien

- Détection : un message arrive au hasard dans un intervalle de 4 à 7 min ⇒ **2 min 45 s en moyenne, 7 min au pire**,
  plus ~2 s (fil, base, notification). L'e-mail : ~15 min. Lectures de la veille : ~11/h (sur 20).
- **Au-delà de 3 min au pire : je n'ai PAS changé le budget** (consigne). Réglage proposé à Julien : « Veille rapide »
  1 min 30 à 3 min (moyenne ~1 min 10, pire 3 min) — il faudrait monter le budget de LECTURE à 40/h pour ce compte
  (`LECTURES_MAX_HEURE`), ce qui double les lectures de fond du compte. À trancher par lui ; la page le dit sous
  « Pourquoi ? ».

## 5. Preuves

| contrôle | résultat |
|---|---|
| `audit-ordinateur-serveur` (VRAI background.js, `_fond-vm.cjs` ; deux profils = deux vm, base et serveur partagés, tour jugé par la vraie `srvTour`) | **46 verts** : 1re lecture silencieuse ; message neuf ⇒ UN appel, identités seulement, fil rangé avant ; revu ⇒ rien ; de moi ⇒ rien ; fil pas rangé ⇒ rien puis UNE fois ; intervalle au hasard ; 429 ⇒ pause et plus rien ; captcha, prudence ⇒ rien (et dit) ; budget plein ⇒ rien ; déconnexion ⇒ UN appel ; onglet épinglé rouvert ; lectures décalées ; **deux profils ⇒ jamais deux écritures au même moment** ; commande de A faite par le profil de A seulement ; `compterAction` ⇒ `tour` ; présence ; capte se tait ; `peutAgir` « prêt ». `--prouve` : **19/19 mutations rouges**. Avec le background.js d'`origin/main` (`--src`) : **29 rouges, 17 verts** — verts : la règle pure S0 et la porte S15 (elles lisent `src/` de cet arbre), « éteint ne lit rien » S1, S5a, S10a, S11 (la commande exécutée par le BON profil est une garantie DÉJÀ là, `distPeutPartir` : gardée en régression), S12c |
| `audit-ordinateur-serveur-route` (VRAIE route `api/push.js` + VRAIE `api/email-inbound.js`, fausse base `_faux-inbound.cjs`) | **33 verts** : texte, compte, article, 90 car. ; jamais deux fois ; sans preuve rien ; offre ; déconnecté ; **l'e-mail de la même conversation ne sonne pas, celui d'une autre si, après 45 min si** ; pas su ⇒ 503 ; le tour (deux profils au même instant ⇒ un seul) ; un seul compte ⇒ pas de nom. `--prouve` **10/10**. Sur l'arbre `origin/main` : rouge (2 verts : 401, 400) |
| banc `ordinateur-serveur` (vrai `dist/` + vrai vrm-badge.js ; 390 tactile et 1512, clair et sombre) | **64 verts** ; captures regardées (titres raccourcis, « Prêts : 1 sur 4 », liste des autres profils sans vide, bouton du panneau à la taille des autres) |
| `e2e-extension` | 45 verts, 0 rouge |
| audits voisins | coherence, extension-zip, traduction, quoi-de-neuf, fonctions-api, cadence, actions-app, extension-feuille, a-distance 72, agir-si-connecte 63, compteurs-concurrents, push-capte, push-capte-fond, budget-lectures, discretion, tout-interface : verts ; `npm run build` vert |

## 6. Ce que seul le vrai ordinateur de Julien peut confirmer

- Plusieurs profils Chrome ouverts en même temps, chacun avec son service worker, sur une journée entière (veille de l'OS,
  `chrome.alarms` de 30 s qui réveille chaque profil, onglet épinglé jamais jeté).
- La forme réelle de `/api/v2/inbox` (`updated_at`, `unread`) et de `/api/v2/conversations/{id}` (`entity.id` des messages,
  `created_at_ts`) — mesurées dans le code existant (`filDe`, `derniereOffreEnAttente`), jamais sur une vraie veille.
- Que l'e-mail de Vinted porte bien le lien `/inbox/{id}` de la conversation (la règle `conversationDeLEmail` existe déjà).
- La déconnexion détectée par l'absence de cookie de session (une session expirée qui garde son cookie n'est pas vue : la
  lecture rendra 401 et la ligne dira « lecture »).
- La vraie latence (Vinted, réseau, notification sur l'iPhone).

## 7. Gestes de Julien (en clair)

1. Installer l'extension **5.457.0** (le zip de vrm.center), puis, sur l'ordinateur qui reste allumé :
2. Chrome → ton avatar en haut à droite → **Ajouter** : un profil par compte Vinted (jamais deux comptes dans un profil).
3. Dans CHAQUE profil : chrome://extensions → Mode développeur → **Charger l'extension non empaquetée** (le dossier
   dézippé) ; icône VRM → **Me connecter** (ton compte VRM habituel, le même partout) ; ouvre **vinted.fr** et connecte CE
   compte ; panneau VRM → **Paramètres → Mode ordinateur allumé → Allumer**.
4. Empêcher la mise en veille (Mac : Réglages → Écran ; Windows : Alimentation → Jamais), laisser Chrome ouvert.
5. Sur l'iPhone : VRM → Menu → **Ordinateur serveur** : chaque compte doit dire « prêt ».
6. Décider : veux-tu la « veille rapide » (1 min 30 à 3 min, budget de lecture 40/h) ? VRM ne la met pas sans toi.

## 8. Suite du 28 nov. — « Veille rapide » (décision de Julien : « vas-y veille rapide »)

- **Rythme** : 1 min 30 à 3 min au hasard (jamais deux fois le même intervalle, 7 s d'écart au moins) — **moyenne 1 min 8 s,
  pire 3 min** (calculé sur la règle, `SRV_LATENCE_RAPIDE`). Allumée PAR DÉFAUT avec « Mode ordinateur allumé » ; éteinte
  par compte dans les Paramètres du panneau (« Veille normale ») ⇒ retour à 4–7 min et 20/h.
- **Budget de LECTURE** : 40/h pour CE compte seulement (mode allumé + veille rapide + le compte de la veille de ce profil :
  `srvLecturesHeure`, appliqué dans `compterLectureUn`) ; la veille s'arrête à 34 (6 restent aux autres lectures). Les autres
  lectures (photos, argent, colis) gardent leur plafond de 20/h ; tous les autres usages restent à 20/h. Autres Chrome
  illisibles ⇒ la moitié, comme avant.
- Gardes inchangées : pause 403/429, arrêt au captcha, prudence, tour d'écriture entre profils, lectures décalées.
- Page « Ordinateur serveur » : le mode sur chaque rangée (« veille rapide » / « veille normale ») et la vitesse mesurée par
  mode ; panneau : l'état et l'interrupteur, 5 langues. CLAUDE.md §3 (Plafond d'actions) dit la décision.
- Preuves : `audit-ordinateur-serveur` 52 verts (S5b/S5c/S5d bornes, S7a–S7e budget 40/34, autres lectures à 20, éteinte ⇒
  20/h, mode éteint ⇒ 20/h) ; `--prouve` : mutations des bornes, du 40, du plafond de la veille, « éteinte ⇒ retour »,
  et du 40 appliqué partout, toutes rouges. Banc `ordinateur-serveur` : le panneau bascule rapide ⇒ normale.
