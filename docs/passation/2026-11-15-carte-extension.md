# 15 nov. 2026 — La carte du logo VRM sur vinted.fr, refaite (extension 5.380.0)

Branche `claude/carte-extension`. Pas de PR (consolidation par la session principale).

## Ce que Julien a envoyé

Trois captures (iPhone, Orion, vinted.fr en sombre, compte de l'onglet `shop_cancale`) et ses
mots : « tout doit être parfait », « je veux voir les favoris du plus récent au plus vieux pour
envoyer des messages aux favoris, voir les annonces et ventes à chaque fois sur le compte connecté,
les autres comptes floutés sauf si tous les comptes sont sélectionnés, mais aucune action possible
dessus ».

## Les défauts, leur cause, ce qui a changé

### 1. « Page not found » sur vinted.fr
- **Cause** : le lien « Mes ventes » pointait vers `https://www.vinted.fr/my_orders/sold`. Cette
  adresse n'est **attestée nulle part** : ni l'app ni l'extension ne l'ouvrent ou ne la lisent
  (seule l'API `/api/v2/my_orders?type=sold` existe) ; elle venait d'un banc (`numero-vinted`) qui
  servait une page inventée sous ce chemin. Vinted la sert en 404. « Messages » (`/inbox`) et
  « Mon dressing » (`/member/{id}`) sont, eux, des adresses que l'app ouvre déjà.
- **Changé** : `LIENS_CARTE.vinted` (background.js) n'a plus que `/inbox` et `/member/{uid}` (uid du
  cookie de l'onglet, sinon aucun lien). La carte filtre en plus chaque lien sur une **liste
  blanche de chemins attestés** (`CHEMINS_ATTESTES`, vrm-badge.js) : Vinted `/inbox`,
  `/member/{id}` ; Leboncoin `/compte/part/mes-annonces`, `/compte/part/mes-transactions`,
  `/messages` ; eBay `/sh/lst/active`, `/sh/ord`. Le « Voir » de « VRM a capté » et le geste
  « Ouvre tes ventes à expédier » n'ont plus de lien Vinted pour les ventes (aucune adresse
  attestée) — jamais un lien qui mène à une 404.
- **En plus** : chaque vente de l'onglet Ventes dont la conversation est connue s'ouvre sur
  Vinted, `/inbox/{conversation_id}` (l'adresse que l'app ouvre déjà pour une vente) ;
  `carteListes` rend `conv` (chiffres seulement). Sans n°, la ligne reste une ligne.
- Le jour où Julien veut un lien direct « Mes ventes », il faut **l'adresse vue dans sa barre
  d'adresse** (la page de ses ventes sur Vinted) : l'ajouter à `LIENS_CARTE` ET à
  `CHEMINS_ATTESTES`, jamais la deviner.

### 2. Favoris : aucune liste, seulement une phrase
- **Cause** (mesurée en lecture seule sur la base) : `shop_cancale` n'a **pas** de ligne
  `vrm_favoris_reglages_{uid}` (le message aux favoris s'écrit **par compte** ; d'autres comptes en
  ont un). Le serveur (`apercuCarte`, `api/_lib/favoris-carte.js`) rendait alors
  `{ etat: 'bloque', raison: 'reglages' }` **avant même de lire les favoris** ; la carte n'avait
  qu'une phrase à montrer, et la liste n'apparaissait qu'après un « Voir » — §4.1 violé (une
  liste vide n'est jamais une réponse).
- **Changé (serveur)** : dès que la cloche est lue, `apercuCarte` rend `lus` (les 30 favoris les
  plus récents : id, pseudo, titre de l'annonce PAR son id, date, photo, état d'`etatFavori`) et
  `totalLus`, aussi pour « pas de message » (`reglages`), « dressing pas relu » et « personne à
  qui écrire » (`rien`). Lecture seule : rien ne change à l'envoi (`pret`, `lancer`, gardes).
  Cloche jamais lue ⇒ `favoris_absents` + `sansMessage`.
- **Changé (carte)** : l'onglet Favoris demande l'aperçu à VRM (jamais à Vinted : aucune action,
  aucune lecture Vinted ; gardé une minute) et **montre la liste tout de suite** :
  - prêt : les favoris cochés, du plus récent au plus ancien (rangée entière qui coche, « Tout
    cocher »), le message rendu, l'offre, le rythme, puis **« Envoyer le message (N) »**, seul
    bouton plein ; envoi sur SON clic seulement (`confirme`), file et gardes inchangées ;
  - pas de message : la liste lue (photo, article, qui · quand · « déjà écrit »…) puis
    « Pour leur écrire d'ici, écris ton message une fois pour ce compte » et le lien
    **« Écris d'abord ton message dans VRM › »** → `https://vrm.center/?tab=messages&vue=favoris`
    (Messages → Favoris, l'adresse que l'app lit déjà), **dans un nouvel onglet** (l'onglet Vinted
    reste). C'est le seul lien de la carte vers VRM, et seulement quand le message manque
    (nuance assumée de la règle 5.376 « la carte n'ouvre pas VRM » : le message ne s'écrit que
    dans VRM) ;
  - cloche jamais lue : « Ouvre une fois ta cloche Vinted (tes notifications) : VRM y lit qui a
    mis tes articles en favori » (+ le message à écrire s'il manque) ;
  - erreur : la raison et « Réessayer ».
  Plus d'étape « Voir » ni de vue séparée ; le défilement d'une liste survit au redessin
  (cocher ne remonte plus en haut).

### 3. Ventes : une case « — » au début de chaque ligne
- **Cause** : la plaque N° vide (`plaque vide` « — ») quand le N° de la vente n'est pas connu par
  identité — sur `shop_cancale`, aucun.
- **Changé** : la plaque ne s'affiche que si le N° est connu ; une liste sans aucun N° n'a pas de
  colonne N° ; une ligne sans N° dans une liste qui en a garde une place vide, rien d'écrit.

### 4. Le dessin
- **Cause** : un verre blanc à 88 % (`--verre`) posé sur la page **sombre** de Vinted (Orion) ⇒
  carte grise ; « Tout arrêter » (sécurité du compte) en bouton gris pleine largeur avant les
  listes ; titres `white-space: nowrap` (« Chaussures Running Asi… »).
- **Changé** : jetons « Studio bleu clair » (src/design/studio.css) sous les mêmes noms : fond
  **opaque** bleu clair (nuit : bleu-nuit), lumière du haut ; quatre formes de bouton — le plein
  (rond d'encre, un seul : « Envoyer le message »), la touche (porcelaine, l'active enfoncée +
  diode), le rond (×), le lien ; plans de porcelaine pour les listes et les liens ; titres sur
  **deux lignes** ; méta d'un tenant (« il y a 30 h » jamais coupé) ; « 2 011 ventes · lues à
  l'instant » (singulier, « lues » seulement si su) ; Inter puis la police du système. « Sécurité
  du compte » passe **sous** les listes et les liens, « Tout arrêter » en touche à droite
  (accessible, plus le premier geste). Compte de l'onglet d'abord ; « Tous les comptes » : les
  autres floutés, `inert` (inchangé). Le résumé du mois reste en ligne (la grille `.seg` des
  touches le cassait depuis la 5.377 : `carte-resume-mois` était rouge).

### 5. Garde-fous
Aucun touché : compte de l'onglet (`favorisCarte` refuse un autre uid), 50/h, une requête à la
fois, pause 429/403, `garde`/`gardeStricte`, envoi aux favoris sur SON clic seulement.

## Preuves
- **Banc neuf `scripts/bancs/carte-extension.cjs`** : la vraie chaîne (règle serveur
  `apercuCarte` → vrai `background.js` `carteListes` + `liensCartePour` → vrai `vrm-badge.js`),
  données inventées, 390 px au doigt sur page sombre et 1512 px, clair et sombre. 72 contrôles
  verts ; sur `origin/main` (`BANC_RACINE=<arbre d'avant>`) **52 rouges** : `/my_orders/sold`,
  aucune liste de favoris, case « — », titres à une ligne, « Tout arrêter » avant les listes, verre.
- Bancs mis à jour à la nouvelle forme : `carte-favoris` (liens, liste tout de suite, plein
  d'encre, « bloqué » = liste + geste), `carte-listes`, `badge`, `extension-visuel`,
  `carte-logo-boutique` (ambre du studio), `carte-orion-sans-onglet` (plein d'encre).
- Audits : `audit-carte-extension` (liens : plus de `/my_orders/sold` ; mutation du dressing
  ancien suivie), `audit-popup-capte` (« Voir » vide pour les ventes Vinted).
- `audit-carte-listes --prouve` : deux règles neuves (favoris lus sans message ; n° de
  conversation des ventes) — rouge sur `origin/main`, chaque mutation rouge.
- Entrée de la carte sans mise à l'échelle (`vrm-entree` : fondu + 6 px) : les cibles gardent leurs
  44 px pendant l'animation (le banc `badge` mesurait 43 px sous charge).
- ⚠️ Conteneur saturé pendant la session (disque plein un temps, charge ~50, mémoire) : bancs lancés
  avec un `TMPDIR` court (`/dev/shm/ce-t`, vidé entre deux bancs). Sous charge, `carte-orion-sans-onglet`
  (cadre « repli » au-delà de 1,5 s) et `lbc-clair-carte` ont été rouges une fois puis verts relancés.
  `popup-capte` (34 rouges) et `popup` (« ⟳ = chrome.runtime.reload ») sont rouges AUSSI sur
  `origin/main` (mesuré pour `popup-capte`) : pas de cette session.

## Geste de Julien
Installer l'extension **5.380.0** (Chrome : remplacer le dossier puis ⟳ ; Orion :
`VRM-Orion-dossier.zip`). Puis, une fois : **écrire son message aux favoris pour shop_cancale**
(le lien « Écris d'abord ton message dans VRM › » de la carte y mène) — la liste s'affiche déjà
sans ça.
