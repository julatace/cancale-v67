# Audit complet de l'extension — 22 novembre 2026

Branche `claude/audit-extension`, partie de `claude/integration-22nov-2` (extension 5.436.0). La 5.436.0 a été servie par
`main` pendant le chantier : les correctifs partent dans le train **5.438.0** (`origin/main` et `origin/claude/ext-5438`
fusionnés pour de vrai dans cette branche, numéros du train adoptés). **Aucun zip régénéré, aucune PR** — l'intégrateur le fera.

Julien, 22 nov. : « audite toute l'extension, ne laisse aucun bug, que tous les boutons marchent ».

## 1. La méthode : le vrai panneau relié au vrai fond

Les bancs du panneau servaient jusqu'ici un faux `chrome.runtime.sendMessage` écrit à la main : il répondait ce que
l'auteur du banc croyait que le fond répond. Un bouton dont le message n'a pas de gestionnaire, ou dont la forme n'est
pas celle que le fond lit, y passait vert.

`scripts/bancs/_pont-panneau.cjs` relie les deux vraies moitiés :

- le VRAI panneau (`vrm-ui.js`, `vrm-mots.js`, `vrm-depot.js`, `vrm-badge.js`) dans un vrai Chromium, et la VRAIE
  fenêtre de l'extension (`popup.html`, `popup.js`, `parcours-popup.js`) ;
- le VRAI `background.js` exécuté par `scripts/_fond-vm.cjs` (fausse base à état, projections appliquées, faux Vinted
  qui compte, faux vrm.center avec la **vraie** file des favoris `api/_lib/favoris-file.js` et le **vrai** aperçu
  `api/_lib/favoris-carte.js`) ;
- `chrome.storage.local` de la page EST celui du fond (les changements reviennent par `onChanged`) ;
- chaque message est noté avec sa réponse et la fonction du panneau d'où il part.

Tout est inventé (le dépôt est public). `BANC_EXT=<arbre>/vinted-sync-extension` rejoue un banc sur une autre copie de
l'extension (la preuve sur le code d'avant, §6.1).

## 2. Ce qui a été ajouté (gardes permanentes)

| fichier | quoi |
|---|---|
| `scripts/bancs/_pont-panneau.cjs` | le pont panneau ↔ fond, la base inventée, le faux vrm.center |
| `scripts/bancs/panneau-tout-toucher.cjs` | recense et TOUCHE chaque contrôle de chaque page et de chaque état du panneau et de la fenêtre, à 390 (Orion) et 1512, puis ce que ce toucher a fait apparaître ; chaque option des listes déroulantes ; juge : mort, muet, levé, forme refusée, refus sans raison, 44 px, recouvert, clé brute / `undefined` / `NaN`, débordement, liens |
| `scripts/bancs/_panneau-connus.cjs` | les exceptions du banc, chacune NOMMÉE avec sa raison |
| `scripts/bancs/panneau-saisie-gardee.cjs` | le champ où il tape garde le curseur, la valeur et la sélection à chaque rendu |
| `scripts/audit-ext-contrat-messages.cjs` | chaque couple (from, action) lu dans les 26 émetteurs et chaque `cmd` de l'app reçoit une réponse, même avec des champs hostiles ; rien n'est accepté d'une origine étrangère |
| `scripts/audit-ext-reprise-offres.cjs` | service worker tué à CHAQUE écriture d'une réponse à une offre (contre-offre par palier, « rester flexible », leur message) : jamais deux fois le même geste |
| `scripts/audit-ext-aussi-interrompu.cjs` | « Publier aussi sur… » : le worker meurt pendant le dépôt |

Pages et états parcourus par « tout toucher » : Accueil, Articles, Commandes, Messagerie, Favoris, Notifications,
Automatisations, File d'actions, Santé, Paramètres (cadence, sauvegarde, « comme Bleam », mode vacances) ; panneau pas
connecté à VRM (connexion par e-mail, par code, par vrm.center) ; « c'est bien un de tes comptes ? » ; aucun compte
dans l'onglet ; panneau sur leboncoin.fr et vestiairecollective.com ; fenêtre de l'extension reliée, pas reliée,
« État de l'extension », réparation.

## 3. Les défauts trouvés et corrigés

Chacun a son contrôle, rouge sur le code d'avant, vert après.

1. **Le champ où il tape perdait le curseur** (panneau, toutes les pages). Chaque rendu remplace les enfants ; un rendu
   arrive sans lui : un état qui change dans `chrome.storage.local` (une capture finie écrit `vrmFlux`), l'onglet qui
   redevient visible, la souris qui revient sur le panneau. Les lettres suivantes partaient dans le vide. 34 cas rouges
   sur 6 pages (390 et 1512). ⇒ `poserHtml` retrouve le champ (balise, `data-*`, rang) et lui rend curseur, sélection
   — JAMAIS la valeur : c'est l'état du panneau qui la rend (sur Orion, toucher « Envoyer » ne retire pas le curseur du champ : une réponse envoyée y serait revenue). Banc `panneau-saisie-gardee` (34 rouges avant, 55 verts après ; 3 mutations rouges).
2. **La souris qui revient sur le grand panneau déjà ouvert relançait une lecture d'état (`etat`) et un rendu complet à
   chaque passage** (le panneau n'a rien à ouvrir : il est ouvert). Au banc, souris posée à l'endroit du logo, jusqu'à
   24 demandes d'état en trois secondes après un seul toucher. ⇒ `pointerenter` ne fait plus rien quand le grand panneau
   est ouvert. Même banc (G2).
3. **Un dépôt « Publier aussi sur Leboncoin / Vestiaire » restait « en cours » pour toujours quand Chrome arrêtait le
   service worker en route** (§4.9) : le panneau, qui relit l'état jusqu'à « fini », tournait dans le vide, et un
   nouveau dépôt était refusé 15 minutes. ⇒ `_aussiIci` (les dépôts que CE worker mène) et `aussiInterrompus()` : un
   dépôt orphelin est fini et DIT — pas commencé ⇒ « rien n'est parti » ; en cours ⇒ « arrêté avant Publier, rien
   n'est publié » ; publication déjà notée, ou note illisible ⇒ « pas su : regarde tes annonces, VRM ne reclique
   jamais ». `audit-ext-aussi-interrompu` (8 rouges avant, 10 verts après, 3 mutations rouges).
4. **La copie des règles d'achat de l'extension n'était plus celle de l'app** (`vrm-regles-achat.js` : ni le forfait
   d'emballage, ni « achat chez moi ») — `audit-infos-vinted` I10 rouge sur la branche d'intégration. ⇒ refabriquée par
   `node scripts/regles-achat-extension.cjs --recopie` (jamais à la main).
5. **`reprendreModif` sans confirmation ne recevait aucune réponse** (silence : aucun gestionnaire). ⇒ le refus est
   dit (`confirmation`). `audit-ext-contrat-messages` A.
6. **Cibles de moins de 44 px** : les sept jours de la semaine du cycle de vie (32 px de large), le lien « Aucun » de
   la liste des favoris (37 px). ⇒ 44 px. Banc « tout toucher ».

Audits de garde qui étaient ROUGES sur la branche d'intégration et qui jugeaient une règle d'hier (aucune garde n'a été
affaiblie : chacun est remis à la règle d'aujourd'hui, plus stricte) :

- `audit-extension-porte-app` : sous le plancher ⇒ rien n'est rangé et la feuille demande de confirmer le chiffre
  (5.432) ; note de l'acheteur pas sue ⇒ avertissement avant d'accepter (5.430).
- `audit-offres-auto` : accepter n'arrive que sous `reg.actif` (≥ prix mini) ou sous SES paliers « rester flexible »
  (≥ plancher), 5.410.4.
- `audit-familles-extension` J1 : `JSON.parse(JSON.stringify())` (une copie d'objet) et `pdf-lib.min.js` (tierce) ne
  sont pas un `JSON.parse` nu.
- `audit-infos-vinted` : l'ordre des scripts du manifeste, pas la liste exacte (`vrm-dressing.js` ajouté après).

## 4. Ce qui a été vérifié et trouvé sain

- **Contrat des messages** : chaque (from, action) envoyé par le panneau, l'écran d'action, la fenêtre, les scripts de
  page (Vinted, Leboncoin, Vestiaire, eBay, transporteurs, retour OAuth) reçoit une réponse ; avec des champs hostiles
  (types faux, `null`, listes de 3 000 éléments, texte de 200 000 caractères, `confirme: true`) rien ne lève et aucune
  promesse n'est rejetée sans gardien ; les commandes de l'app répondent toutes un verdict, une commande inconnue est
  refusée avec un code ; depuis une origine étrangère rien n'est accepté et rien n'écrit chez Vinted.
- **Panneau relié au fond** : aucun message muet, aucun gestionnaire qui lève, aucune forme refusée, aucune erreur de
  page ; les actions en série d'Articles (republier, baisser, publier aussi, masquer, afficher, favoris) reçoivent du
  fond la réponse que le panneau attend.
- **Reprise après un worker tué** : négociation (ce chantier) ; republication (`audit-republication-parfaite` B),
  prix en attente et baisse par règle (`audit-prix-attente`), favoris (`audit-favori-offre-message`,
  `audit-favoris-sites`), à distance (`audit-a-distance`) — verts.
- **§4.8** (noms hors portée) : `audit-portee-modules` ne désigne dans l'extension que `vrmVerifVisible`, lu sous
  `typeof … === 'function'` dans une fonction injectée dans le monde isolé de l'onglet (où `vrm-badge.js` le déclare) —
  voulu. **§4.9** : les variables de module du fond sont des chaînes d'écriture, des verrous « en vol » et des mémos
  (perdus sans dommage) ; le seul état qui manquait à un worker neuf était le dépôt « Publier aussi » (défaut 3).
- **Garde-fous** : les audits de garde (compte de l'onglet, plafonds, une requête à la fois, pause 403/429, arrêt au
  captcha visible) sont verts — voir §6.

## 5. Ce qui reste, et ce qui ne se vérifie pas sans vrai compte

Restent ROUGES sur la branche, déjà rouges avant ce chantier, hors de son périmètre ou à trancher par l'intégrateur :

- `audit-portee-modules` : **`src/natif/RetraitsPoints.jsx` l.120 lit `Icon` qui n'est déclaré nulle part** (le
  composant `Contenu` ne le reçoit pas) ⇒ un point de retrait dont le colis n'a pas de photo fait tomber l'écran
  (« Icon is not defined »). **App, pas extension : signalé, pas corrigé ici.** Aussi `src/copieEcran.js`
  (`__VRM_COPIE_MUTATION__`) et `pdf-lib.min.js` (tierce).
- `audit-confiance-publique` (A2, G2, G5, G10) : les phrases publiques « rien n'est simulé, ni clic ni frappe » ne sont
  plus vraies depuis le 20 nov. (republication par le formulaire, sa décision) : c'est un texte à lui à trancher.
- `audit-preuve-vente` : `ventesApresVente` (après-vente, 5.410.4) lit l'état des transactions hors des deux lecteurs
  permis (elle applique `PAS_UNE_VENTE`, mais c'est un troisième lecteur).
- `audit-republier-question` (bloc introuvable), `audit-signalement` (écrans `menu`, `adistance`),
  `audit-vocabulaire-article` (arrêté au bout de 240 s sur une machine chargée).
- `audit-paquets-boutiques` / `audit-extension-zip` : rouges tant que les zips ne sont pas régénérés (voulu ici).

Ce que le banc ne peut pas juger sans vrai compte ni vrai site :

- les pages réelles de Vinted, Leboncoin et Vestiaire (les formulaires changent : `vrm-formulaire.js`, `lbc-ecrire.js`,
  `vc-ecrire.js` sont jugés contre des pages de banc qui imitent la forme relevée) ;
- le captcha réel, un vrai 403/429, une vraie session expirée ;
- la connexion Google / Discord (fenêtre du fournisseur), la liaison par vrm.center jusqu'au bout (la session adressée
  par l'app), `externally_connectable` ;
- Orion sur un vrai iPhone (le banc joue Chromium avec l'écran et l'agent d'Orion) ;
- la mort réelle du service worker par Chrome (elle est simulée : un worker neuf sur le même stockage).

Non reproduit hors du banc : la rafale de `pointerenter` sur l'hôte du panneau (défaut 2) n'apparaît qu'avec la souris
laissée à l'endroit du logo pendant que le banc lit la page ; un vrai clic suivi d'une souris immobile n'en produit
pas. Le correctif la rend sans effet dans tous les cas.

## 6. Résultats

### Banc « tout toucher » (vrai panneau ↔ vrai fond)

- **1512** (second passage, banc corrigé, deux niveaux) : **620 contrôles recensés, 614 touchés**, 19 pages et états —
  aucun contrôle mort, aucun message muet, aucun gestionnaire qui lève, aucune forme refusée, aucune erreur de page,
  cibles ≥ 44 px, aucune clé brute, rien ne déborde, 5 liens tous vers VRM. Restent au relevé, sans défaut du produit :
  le bouton « Réglages » des favoris vu sous le voile d'une feuille restée ouverte par le toucher précédent (dérive du
  banc), trois boutons « ouvrir » des commandes dont le rang change quand une case est cochée (non retrouvés).
- **390 Orion** (premier passage, banc d'avant ses corrections) : **582 recensés, 554 touchés** — aucun mort réel (les 9
  relevés sont des choix déjà courants et des liens), aucun muet, aucun levé, aucune forme refusée, aucune erreur ; les
  « recouverts » de ce passage étaient jugés sans amener le contrôle à l'écran (corrigé depuis) ; deux cibles de moins de
  44 px corrigées (défaut 6). **Le second passage à 390 avec le banc corrigé n'était pas fini à la clôture** (machine
  très chargée) : à relancer — `node scripts/bancs/panneau-tout-toucher.cjs --taille=390 [--pages=…]`.
- 45 actions distinctes du panneau reçues et répondues par le vrai fond pendant le parcours.
- Les cinq langues (`--langues`) : pas lancées au banc ; vérifié hors banc que chaque clé `TU('…')` écrite en clair dans
  vrm-badge.js existe dans les 1 620 clés de vrm-ui.js, toutes complètes en fr/en/es/it/de, et que les clés construites
  de la page Santé reçoivent du fond des valeurs toutes traduites.

### Autres gardes ajoutées

| garde | résultat |
|---|---|
| `audit-ext-contrat-messages` | 136+ couples (from, action), 20 commandes de l'app : verts après le correctif 5 |
| `panneau-saisie-gardee` | 55 verts ; 34 rouges sur la 5.436.0 ; 3 mutations rouges |
| `audit-ext-reprise-offres` | 30 verts ; mutation « memo-apres » rouge |
| `audit-ext-aussi-interrompu` | 10 verts ; 8 rouges avant ; 3 mutations rouges |
| `audit-ext-arrets-formulaire` | 8 verts ; mutation rouge |
| `bancs/cloche-favoris` | 16 verts ; 8 rouges sur la 5.436.0 ; 3 mutations rouges |
| `audit-ext-cloche-favoris` | 27 verts ; 12 rouges avant ; 5 mutations rouges |
| `bancs/panneau-parcours` | 390 : 19 verts ; 1512 : le navigateur du banc a été tué faute de mémoire (à relancer) |

Les 246 audits qui touchent l'extension, lancés au départ : 235 verts, 11 rouges — les 10 déjà rouges sur la branche
d'intégration (§3, §5) et `audit-paquets-boutiques` (zips pas régénérés, voulu). Quatre ont été remis au vert (§3).
**Le lot complet n'a pas été relancé après la fusion du train 5.438** : seuls les audits des favoris, de l'interface, de
la cohérence, de la traduction et ceux de ce chantier l'ont été (verts).

## 7. Production, 22 nov. au soir : « Vinted a changé le bouton notif », la file en pause

Julien, pendant « messages aux favoris » (5.436.0) : « Vinted a changé le bouton notif », « Une file d'envoi est en pause :
3 en attente », puis après « Reprendre » : « 0 envoyé · 2 refusés : autre refus ». Sa capture : la cloche ouverte, qui ne
liste que des baisses de prix puis « Voir tout ».

**Cause** (reproduite, rouge sur la 5.436.0) : la liste de la cloche ne montre que les dernières notifications, tous types
mêlés. La ligne du favori n'y était pas ; l'étape était réessayée ; cloche ouverte, son bouton n'était plus reconnu ⇒
« touche le bouton Notifications ». Le fond rendait `element_introuvable`, raison que le serveur ne connaissait pas ⇒
traduite `vinted_refus` (« Vinted a refusé », « autre refus ») ; et tout refus arrêtait la file.

**Corrigé** :
- `vrm-formulaire.js` : la cloche par plusieurs ancres ; la liste déjà ouverte reconnue ; trois issues jamais confondues
  (cloche introuvable · favori absent de la liste, avec le chemin de « Voir tout » · absent de la page complète) ; étape
  `favoriListe` ; seul le lien qui porte CET article ET CETTE personne est cliqué.
- `background.js` : absent ⇒ page complète ⇒ toujours absent ⇒ ce favori est sauté, la file continue ; ni réessai ni
  « apprendre » ; chaque accusé porte l'ÉTAPE et la CLASSE de la cause (`element_absent:message-champ`, `http_403`,
  `garde`…), jamais une valeur.
- `src/favorisProgression.js`, `api/_lib/favoris-file.js` : `element_introuvable` connu ; étape et cause rangées sur la
  ligne (liste blanche) ; un refus propre à UN favori sans écriture est sauté (trois de suite ⇒ arrêt dit, « Reprendre ») ;
  les causes globales arrêtent toujours. La partie serveur vaut pour la 5.436.0 déjà installée dès que `main` est servi.
- libellés en 5 langues ; la bannière de la file en pause dit sa raison ; les favoris d'articles vendus ne sont plus
  montrés dans la liste lue (ils n'étaient déjà pas cochables, et l'extension revérifie l'annonce avant chaque envoi).

**Pas fait** : la reprise automatique d'une file en pause ; l'affichage de l'étape et de la cause rangée par rangée dans
le panneau. **Pas vérifiable sans compte** : la vraie forme de la cloche et le vrai chemin de « Voir tout » (si le chemin
diffère, le favori est sauté — jamais une pause).

CLAUDE.md pèse 60 157 octets après la fusion (les lignes §9 de `main` et du train gardées toutes les deux) : 157 de trop.

