# 22 nov. 2026 — « À distance » : tes comptes depuis l'iPhone, ton ordinateur exécute (ext. 5.436.0, capacité `adistance`)

Branche `claude/a-distance` (partie de `claude/integration-finale`). Les zips de l'extension ne sont PAS régénérés
(intégration). `CLAUDE.md` §9 n'est pas touché (règle commune) : la ligne proposée est en bas.

## 1. La demande, la décision

Julien : accéder à ses comptes Vinted (et Leboncoin, Vestiaire) **à distance**, « comme Bleam Cloud mais sans risque de
ban », pour tous les vendeurs VRM. Puis (relayé par le coordinateur) : « l'expérience à distance actuelle c'est pas top »
— instantané, miroir par compte, ordinateur toujours joignable, file lisible, 1 à 2 touchers.

Décision (confirmée par lui, finale) : **aucun navigateur dans le cloud, aucune IP ni empreinte par compte** (§3). Le
relais est **son ordinateur** : son Chrome avec l'extension, chez lui, exécute ; l'app (iPhone, n'importe où) montre et
commande. C'est l'exception assumée à « toute action de plateforme se fait dans le panneau de l'extension » : l'app ne
fait AUCUNE requête vers une plateforme, elle **dépose** une commande dans SA base ; l'extension l'exécute par le chemin
du clic existant, avec tous ses garde-fous.

## 2. Ce qui est construit

### La règle — `src/aDistance.js` (bloc `<a-distance-regle>` recopié dans `background.js`)
- **Commande** `cmd_dist_{id}` = UN geste = UN compte : `{ v:1, geste, site, compte, args, pour, demandeLe, expire, etat,
  empreinte, cle, num, avant? }`. Gestes permis (liste blanche `ADIST_GESTES`) : répondre (Vinted, Leboncoin, Vestiaire),
  accepter / refuser / contre-offre (Vinted), changer le prix — **baisse seulement** (les 3 sites), masquer / afficher,
  republier (l'atelier : `recreerVinted`), bordereau, relire (Vinted, Leboncoin). Jamais supprimer seul, jamais une
  requête arbitraire.
- **Confirmation** (`ADIST_CONFIRMER`) seulement pour ce qui engage l'argent ou ne se défait pas : accepter (vend la
  paire), republier (supprime l'ancienne). Le reste part en UN toucher (§2.10), avec « Annuler » tant que ça attend.
- **Empreinte** (FNV-1a 64 bits sur geste, site, compte, args, vendeur, heure) : une ligne modifiée après le dépôt (un
  prix, un compte changé) est refusée. La signature, c'est SA session : RLS n'accepte que ses lignes (`owner`), et
  l'extension exige `owner` ET `pour` = le vendeur de SA session.
- **24 h** au plus (`adistFin`), puis « expirée » (jamais exécutée en retard) ; prise sans issue 15 min ⇒ « pas sûr ».
- **Présence** `presence_{appareil}` (une ligne par navigateur, jamais `main`) : allumé si vue < 3 min.

### L'extension — `vinted-sync-extension/background.js` (section « À DISTANCE »)
- `publierPresence` : version, appareil (Chrome · Mac), **comptes de CE navigateur** (Vinted : le cookie ; Leboncoin et
  Vestiaire : le compte privé de chaque onglet ouvert), `retenues` (ce qui retient chaque commande : autre compte,
  pause, vérification…), geste en cours, état du temps réel, comptes lus 48 h. Au plus 1 écriture / min, tout de suite
  (10 s au moins) quand quelque chose change.
- `distanceTick` (alarme `vrm-relais` 30 s, chaque visite Vinted, démarrage de Chrome, et **temps réel**) : rien sans
  session ; tri sans aucune requête vers un site ; périmée ⇒ expirée ; elle ne part que si le compte visé est CELUI de
  ce navigateur (un seul compte du site ouvert ; sinon « deux-comptes »), sans pause ni vérification ; prise
  conditionnelle `attente → pris` notée dans `chrome.storage.local` AVANT d'agir (jamais rejouée) ; **une commande par
  passage**, 8 à 25 s au hasard entre deux ; jamais deux comptes à la fois.
- Exécution par les **chemins du clic existants** (aucun endpoint neuf) : `executerPourApp` (réponse, offres — par
  l'interface de la page depuis la 5.414, liste blanche `EXEC_PERMIS`, garde stricte, plafonds, pause 403/429),
  `prixAttExecuter` (le chemin des prix en attente, prix vu relu), `masquerCoeur` (extrait de `masquerCarte`, même
  code), `executerCommande` (`recreerVinted`, `bordereau`, `ventes`), `repondreLeboncoin`, `repondreVestiaire`,
  `relireLbcPourApp`. Onglet Vinted absent mais cookie du bon compte ⇒ l'onglet de travail est ouvert par
  l'extension (`travailDabord` : épinglé, sans focus).
- Issue écrite (`fait` avec avant → après, `refuse` + raison, `incertain`, `attente` remise et bornée à 40 reports) ;
  « Tout arrêter » ⇒ refusée, jamais une attente.
- **Temps réel** : une prise WebSocket sur le sujet privé `vrm-lignes:<owner>` (migration 040 — **vérifiée posée** en
  lecture sur la vraie base : déclencheur `vrm_signal_ligne` et règle `vrm_lignes_recevoir` présents). Une commande
  déposée réveille la file dans la seconde. Refusée / fermée ⇒ l'alarme de 30 s, dit par la présence (`rt`).
- **Notification** : après chaque issue, `POST /api/push { action: 'distance', id }` ; le serveur relit la ligne au nom
  du vendeur (`api/_lib/distance-notif.js`) : « ✅ Fait sur ton ordinateur · N°134 · Prix changé : 85 € → 79 € »,
  étiquette par issue (une fois). Aucune fonction serverless de plus (12).

### L'app — écran « Mes comptes » (`?tab=adistance`, Menu → Aide → Mes comptes ; `src/aDistance/EcranADistance.jsx`)
- **Ton ordinateur** : chaque navigateur — « Chrome · Mac est allumé · boutique_a » ou « éteint depuis 21:40 — tes
  gestes attendront » (le jour s'il date d'hier) ; extension trop ancienne dite ; « Instantané » ou « le temps réel ne
  répond pas : VRM regarde toutes les 2 s pendant un geste » ; « Garder ton ordinateur joignable » (Chrome ouvert,
  Windows « continuer à exécuter en arrière-plan », Mac ne pas quitter, empêcher la veille, rester connecté au compte).
- **Tes gestes à distance** : Attente · En cours · Fait · Refusé ; chaque rangée dit l'état en mots (« Envoyé · Chrome ·
  Mac le prend », « En attente : ouvre Vinted sur ce compte », « …éteint — partira dès qu'il revient (jusqu'à demain
  12:31) », « Prix changé : 85 € → 79 € », « Refusé : raison ») ; une en attente se touche ⇒ « Annuler ce geste »
  (aussi au balayage, et dans le toast « Envoyé à ton ordinateur · Annuler »). La file **suit** le geste envoyé.
- **Comptes** : une rangée par compte (Vinted, Leboncoin, Vestiaire ; un compte retiré n'apparaît pas) — ouvert sur
  quel ordinateur, relu quand (« Pas relu · il y a 3 jours » en ambre au-delà de 48 h ; pas su ⇒ « — », jamais « jamais
  relu »), à envoyer par compte (publication `vrm_colis_aposter.parCompte`, ajoutée par Ventes, par identité de compte).
- **Un compte** : « Relire » (une commande), Annonces / Ventes de l'app, et pour Vinted **sa boîte** (20 conversations
  projetées champ par champ, jamais `select=data`) → **le fil** (messages, offres ; une offre en attente = courante ET
  statut 10, mesuré sur la vraie base : 10 · 20 · 30 · 40) avec Accepter (feuille de confirmation) · Refuser · Contre-offre
  (feuille, un prix) et la réponse tapée ici, « Envoyer » ; l'état de SES gestes dans le fil sans le quitter.
- Instantané : la veille temps réel de l'app relaie maintenant chaque ligne changée (`vrm:ligne`, l'identifiant seul,
  `src/VeilleTempsReel.jsx`) ; l'écran relit la file / la présence dans les 120 ms ; sans temps réel, toutes les 2 s
  pendant qu'un geste est en vol (5 s avec), 30 s sinon. Le geste est montré **avant** la réponse de la base.

## 3. Preuves

- `node scripts/audit-a-distance.cjs` : **52 contrôles verts** (règle, vue, miroir, bloc recopié, VRAI `background.js`
  en vm : session, autre vendeur, `pour`, prise conditionnelle, avant → après, présence, notification, rejeu, autre
  compte / pause / vérification / aucun compte ⇒ rien touché et dit, périmée, empreinte, un par passage, plafond remis,
  Leboncoin deux comptes, Tout arrêter ; la route de notification EXÉCUTÉE). `--prouve` : **22/22 mutations** rougissent.
  Sur le `background.js` d'avant (`origin/claude/integration-finale`) : **24 rouges** (E–L).
- `node scripts/bancs/a-distance.cjs` (après build) : **53 verts** — vrai `dist/`, base à état, temps réel simulé à la
  forme du déclencheur 040, ordinateur simulé (règle de l'app, prise 350 ms, exécution 900 ms), dépôt « 4G » de 1,2 s ;
  390 clair, 390 sombre, 1512 clair, 390 éteint. `--sans-temps-reel` : 50 verts (dit, et ~2,1 s). `--prouve` : 3/3
  mutations du build rougissent (sans écoute du temps réel, sans feuille d'acceptation, sans ajout local).
- **Latences mesurées** (toucher « Envoyer » → affiché) : montré 65–100 ms · « en cours » 1,8 s · « fait » 2,7 s (dont
  1,2 s de dépôt 4G et 1,25 s d'ordinateur simulé) ; sans temps réel : en cours/fait ~2,1 s (dépôt rapide).
- Défauts trouvés et corrigés grâce au banc : la file restait sur « Attente » quand le geste passait « En cours » (elle
  suit maintenant le geste) ; le toast « Envoyé » couvrait « Accepter et vendre » (une feuille qui s'ouvre fait taire le
  toast — contrôle ajouté) ; « jusqu'à 12:31 » pour demain ; la fraîcheur « pas sue » s'affichait « jamais relu ».
- Verts aussi : `audit-coherence` (capacité `adistance` → `distanceTick`), `audit-traduction`, `audit-quoi-de-neuf`,
  `audit-actions-app`, `audit-cadence`, `audit-tout-interface`, `audit-icones`, `audit-relais`, `audit-prix-attente`,
  `audit-actions-gardees`, `audit-fonctions-api`, `npm run build`. Rouge attendu : `audit-extension-zip` (zips à refaire
  à l'intégration, version 5.436.0).
- Captures regardées (scratchpad de la session) : accueil, compte, fil, en cours, accepter, file — 390 clair/sombre,
  1512 ; éteint + annuler à 390.

## 4. Ce qui n'a PAS pu être vérifié sans vrai compte

- Un vrai geste chez Vinted / Leboncoin / Vestiaire depuis une commande à distance : les chemins appelés sont ceux du
  clic (leurs audits à eux), mais la chaîne complète n'a tourné qu'avec des espions.
- La prise WebSocket dans le **service worker MV3** réel (garder le worker éveillé tant qu'elle vit, Chrome ≥ 116) et sa
  reprise après mise en veille de l'ordinateur ; le réveil `onStartup` après un redémarrage de Chrome. L'alarme de 30 s
  reste le filet dans tous les cas.
- La notification sur un vrai iPhone (la route est exécutée par l'audit ; l'envoi passe par `sendPushToAll` existant).
- La fraîcheur `lireCapturesDetail` sur une vraie base (au banc elle répond parfois « pas su » au premier tour : l'écran
  le dit et relit 5 s plus tard).
- L'écran expose répondre / offres / relire ; prix, masquer, republier, bordereau sont acceptés par la file et
  l'extension (audités) mais pas encore proposés comme boutons dans « Mes comptes » — les autres écrans gardent leurs
  chemins (`cmd_prix_*` pour le prix, relais pour le bordereau). Miroir des annonces et des ventes : liens vers les
  écrans existants, pas une copie dans « Mes comptes ».

## 5. Gestes de Julien

- Installer l'extension **5.436.0** (après les zips de l'intégration) dans le Chrome de l'ordinateur qui reste allumé,
  laisser Chrome ouvert, suivre « Garder ton ordinateur joignable ».
- Aucune migration : la 040 (temps réel) est déjà posée.

## 6. Ligne proposée pour `CLAUDE.md` §9

- **22 nov. · À distance (ext. 5.436.0, `adistance`)** : « Mes comptes » — ton ordinateur (présence `presence_*`), la
  file `cmd_dist_*` (24 h, empreinte, une fois, compte de l'onglet, chemins du clic, temps réel 040, notification),
  boîte et fil d'un compte Vinted (répondre, offres), Relire ; aucun cloud, aucune IP. `2026-11-22-a-distance.md`.
  Geste : installer la 5.436.0, laisser Chrome ouvert.
