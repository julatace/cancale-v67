# 10 nov. — Mode « dépôt » au point relais (lot AU) et hors ligne au point relais (lot AY)

Branche `claude/depot-hors-ligne` (pas de PR, pas fusionnée par la session). Validé par Julien (peu de texte,
du visuel). Extension : rien touché. Aucune migration, aucune fonction `api/` ajoutée (12/12).

## 1. « Je dépose » (lot AU)

- Colis → À envoyer : bouton **« Je dépose »** (`data-depot-ouvrir`) à côté de « Préparer mes colis » (même
  rangée `.vrm-pas-a-pas-rangee`). Écran plein (portail, `FermeAuRetour`, Échap) : `src/ModeDepot.jsx`, pas
  paresseux (il s'ouvre sans réseau), style `src/styles-mode-depot.css` (jetons DA6, clair et sombre).
- **Liste** : `colisDepot()` (App.jsx) = `colisPreparer()` tel quel (= `colisAEnvoyerRanges()`, règle `aExpedier`,
  même ordre que la liste et que Préparer), plus le n° de suivi de SON bordereau et la marque du transporteur
  (`trCle`, ajouté aux lignes de `colisPreparer` — rien d'autre n'y change). Groupés par transporteur dans l'ordre
  de leur premier colis (`groupesDepot`, src/modeDepot.js), logo `LogoTransporteur` ; sans transporteur lu :
  « Transporteur à identifier ».
- **Scan** : la caméra du scanner du lot V, extraite telle quelle en `useLectureCamera` (src/ScannerColis.jsx ;
  le scanner l'utilise lui-même, rien n'y change). `trouverDepot` = `trouverParScan` (égalité EXACTE du n° de
  suivi, §5) restreint à la liste du mode : un seul colis ⇒ coché ; déjà coché ⇒ « Déjà déposé » ; deux ⇒
  « 2 colis portent ce n° : vérifie » ; aucun ⇒ **« Pas dans tes colis à déposer »**, rien d'écrit. Saisie du n°
  toujours là ; sans caméra elle prend la main.
- **Le geste** : un scan trouvé ⇒ `deposeScan.demander` (le « Colis fait » des cartes, de Préparer et de la
  tournée : `marquerColisFait`, `vinted_ship_done[tx]` + `vinted_bords_shipped`, annulable 5 s, « Annuler » sur la
  ligne et sous le résultat). Le scan coche directement ici (c'est la demande : « chaque colis scanné se coche ») —
  différent du scanner du lot V qui MONTRE la paire et attend un toucher (vérifier le contenu du carton au moment
  de le fermer) ; au comptoir les cartons sont fermés, le n° de suivi est une identité exacte, et l'écriture reste
  annulable 5 s. « Déposé » au doigt sur chaque ligne (Leboncoin n'a pas de n° de suivi lu). eBay : montré, jamais
  coché (« Suivi dans eBay », §2.8).
- **Barre** « 3 sur 5 déposés » ; tout coché ⇒ **« Tout est déposé »** en grand (coche ronde, « Revoir »,
  « Fermer »). Wake Lock pris à l'ouverture et rendu (`useEcranAllume`, exporté de ModeRelais).
- La tournée de dépôt du 5 nov. (feuille « Préparer la tournée de dépôt ») reste telle quelle (8 bancs la jugent) :
  **à décider avec Julien** si « Je dépose » la remplace.

## 2. Hors ligne au point relais (lot AY)

- **Une seule source hors ligne** : la photo de Ma journée (`vrm_hl_photo_{uid}`, src/journeeHorsLigne.js — la règle
  d'instantané hors ligne qui existait : CE compte, CET appareil, datée, écrite seulement après une lecture
  complète). Elle porte maintenant, pour chaque colis à envoyer, le **n° de suivi** du bordereau et le
  **transporteur lu** (`suivi`, `tr`, `trNom`) ; pour chaque colis à retirer, l'**identité publiée** (`id`) et le
  **verdict du code** de src/sourcesRetrait.js (`verdictCode` : le code de la conversation de SA commande compte ;
  deux codes ⇒ aucun choisi, `desaccord` gardé). Rien d'autre (pas de photo, pas d'acheteur).
- Écran Colis hors ligne (`JourneeHorsLigne`) : **« Je dépose »** (au-dessus de « À déposer ») ouvre le même
  ModeDepot, `horsLigne`, avec « Hors ligne · liste vue à 14:02 » (jamais présentée comme fraîche) ; **« Mode
  relais »** (au-dessus de « À retirer ») ouvre le mode relais sur la photo, « Hors ligne · codes vus à 14:02 ».
  Le bloc « Tes codes de retrait (hors ligne) » (base injoignable) dit aussi « codes vus à ».
- **Cocher hors ligne** = le « Déposé » de Ma journée hors ligne qui existait (`gestes.faire` : `vinted_ship_done[tx]`
  par `save`, clé = n° de transaction — refaire le geste ne double rien), gardé par la **file d'envoi**
  (src/fileEnvoi.js) jusqu'à ce que le nuage l'ACCEPTE (« pas su » ≠ « envoyé » ; fusion à trois voies au retour).
  Visible : « 2 dépôts à envoyer » en ambre, et « Part au retour du réseau » sur chaque ligne. Annulable tant
  qu'il n'est pas parti. Un colis de la photo sans n° de transaction : « Il faut le réseau » (jamais deviné).
- Garde du lot D respectée : aucune requête base//api/ en mode hors ligne (le banc le compte).
- `vrm_codes_hors_ligne` porte maintenant `uid` (une copie d'un autre compte n'est jamais lue ; celle d'avant sans
  `uid` est celle du compte, `vrm_*` étant effacé à chaque changement de compte) et `vu` (redaté au plus toutes les
  5 min quand une lecture complète la confirme).

## 3. Le banc `codes-hors-ligne` (rouge sur main en phase « réseau coupé »)

Trois causes, toutes dans le banc (aucune dans l'app) : (1) la ligne de suivi n'avait pas la vraie forme (`type`,
`subject`, `emailAt`, `arriveLe`) ; (2) le banc ne servait pas la relecture par identités `id=in.(…)` ⇒ aucun colis
n'arrivait, la copie n'était jamais écrite (phases 1 et 2) ; (3) la phase « réseau coupé » rouvre l'app à FROID :
la porte hors ligne du lot D exige une session dont le jeton dit le même compte (`sub`) et le dernier état de
l'abonnement lu — la session de banc (« jeton-de-banc-direct ») et l'absence de `/api/compte?mode=abonnement`
la faisaient refuser (« Vérification indisponible »). Le banc range une session JWT et sert l'abonnement :
**6/6 verts** (était 6 rouges).

## 4. Preuves

- `scripts/bancs/mode-depot.cjs` (390 tactile sombre et clair, 1512 clair et sombre ; faux `BarcodeDetector`,
  fausse caméra, Wake Lock compté ; 8 ventes au MÊME titre, 5 Mondial Relay / 3 Chronopost) : voir §5 pour le compte.
  D1 liste = « À envoyer » (ordre, une fois, groupes par transporteur avec logo, « 0 sur 8 ») ; D2 scan ⇒ CE colis,
  rien pendant 5 s puis 9203 seulement (+ son bordereau) ; D3 hors liste ⇒ rien ; D4 rescanné ⇒ « Déjà déposé » ;
  D5 « Annuler » ⇒ rien ; D6 saisie à la main ; D7 « Tout est déposé », 8 écrits, Wake Lock rendu, caméra coupée ;
  D8 sans caméra ; H1 la photo porte suivi/transporteur/identités ; H2 rouverte à froid réseau coupé, « vue à » ;
  H3 coché en file, « 1 dépôt à envoyer », rescanné/hors liste ⇒ rien de plus ; H4 mode relais hors ligne =
  identités publiées, « codes vus à », Wake Lock ; aucune requête base//api/ ; H5 retour du réseau ⇒ compté une
  fois (le colis sort de « À envoyer »).
- Rouge sur origin/main et mutations : §5.
- Captures regardées (scratchpad de la session, hors dépôt) : `mode-depot-{390-sombre,390-clair,1512-clair,1512-sombre}-{1-ouvert,2-scan,3-hors-liste,4-tout}.png`, `-1512-clair-5-sans-camera.png`, `-{390-sombre,1512-clair}-{6-hors-ligne,7-hors-ligne-coche,8-relais-hors-ligne}.png`.

## 5. Chiffres

- `mode-depot` : **122 verts** sur les quatre vues (avant le `git merge origin/main`), revérifié après (voir §7).
- **Rouge sur origin/main** (5f38baa4, `git archive`, banc copié dedans, 390-sombre) : 6 rouges (pas de « Je dépose »,
  photo sans n° de suivi ni transporteur ni identité publiée, rien hors ligne).
- **Mutations** (390-sombre, build muté) : « Déposé » écrit tout de suite (sans les 5 s) ⇒ 2 rouges (D2) ; photo hors
  ligne sans n° de suivi ni identité publiée ⇒ 8 rouges (H1, H3 : le scan hors ligne ne trouve plus rien, H4, H5) ;
  réseau coupé = la phase H elle-même (rouge sur main).
- `codes-hors-ligne` : 6/6 verts (6 rouges sur main, causes §3).
- `npm run build` ; audits `variables`, `tdz`, `coherence`, `identite`, `icones`, `codes-retrait`,
  `retraits-irreprochables`, `fonctions-api` verts.

## 6. Ce qui reste

- **iPhone hors ligne : la caméra.** Safari n'a pas `BarcodeDetector` : le scanner charge ZXing depuis
  cdn.jsdelivr.net. Sans réseau, s'il n'a jamais été chargé, la lecture caméra est impossible ⇒ « Pas de caméra :
  tape le n° » (la saisie marche). Garder ZXing dans le service worker serait un chantier `public/sw.js`.
- Hors ligne : Vestiaire et Leboncoin ne sont pas dans la photo (elle ne gardait que Vinted et eBay) ; ils se
  déposent en ligne.
- L'app ouverte qui PERD le réseau bascule sur l'écran hors ligne (règle existante) : le mode dépôt en ligne se
  ferme (le « Colis fait » en attente est écrit), il se rouvre depuis l'écran hors ligne.
- Le mode relais hors ligne garde « Retiré » coupé (règle du lot AD) alors que la liste hors ligne offre « J'ai
  retiré » : à unifier si Julien le veut.
- Tournée de dépôt (5 nov.) et « Je dépose » font des choses voisines : décision de Julien.
- Geste de Julien : aucun (essayer au comptoir, avec et sans réseau).

## 7. Après le vrai `git merge origin/main` (rebâti, un banc à la fois, port aléatoire)

`mode-depot` 122/122 · `codes-hors-ligne` 6/6 · `preparer-relais` 131/131 · `scanner-colis-achats` 204/204 ·
`photo-colis-scan` 124/124 · `hors-ligne-froid` 80/80.
