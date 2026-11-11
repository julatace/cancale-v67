# 10 nov. 2026 — Ouverture encore plus légère (lot K, proposition 12)

Branche `claude/ouverture-legere` (depuis `origin/main`), poussée à chaque commit. Pas de PR
ni de fusion (consigne). Pas d'extension, pas de migration, aucune route ajoutée.

## 1. Ce qui change pour Julien
Rien à voir, sauf deux choses :
- en 4G, VRM télécharge **~1,6 Mo de moins** à chaque ouverture quand rien n'a changé (ventes,
  achats, dressings, boîtes de réception déjà sur l'appareil) ;
- si ces listes ne peuvent pas être relues, une petite pastille grise en haut :
  **« Vu à 14:32 · pas relu »**. Rien à faire (ni ambre, ni rouge).

## 2. La règle (`src/copieLignes.js`)
- Les lignes lourdes de moisson — `harvest_{uid}_orders_sold|purchased` (préchargement du
  démarrage), `harvest_{uid}_listings` et `harvest_{uid}_inbox` (lecture groupée `_groupeMoisson`)
  — sont **gardées sur l'appareil** (IndexedDB `vrm_copies`) telles que lues.
- À l'ouverture suivante, on lit d'abord leur **version** : `SEL_VERSION` =
  `id,updated_at,cap:data->>capturedAt,rev:data->>rev,sup:data->>supprime,pg:data->>purgedAt`
  (scalaires, jamais `select=data`, §4.4). Version identique ⇒ la copie **est** la ligne du
  serveur, rien n'est téléchargé ; différente ⇒ **cette ligne seule** est relue ; absente ⇒ elle
  n'existe plus, la copie part.
- La version est lue **avant** la ligne : une écriture entre les deux range une ligne plus neuve
  sous l'ancienne version (relue la fois suivante), jamais l'inverse.
- **Lecture des versions ratée** ⇒ jamais la copie : l'ancienne lecture (la ligne entière) ; ratée
  aussi ⇒ « pas su » (`null`, comme avant). La copie reste sur l'appareil (jamais vidée) et la coque
  dit « Vu à hh:mm · pas relu » (`MentionCopie`, `data-copie-pas-relu`), l'heure étant la dernière
  confirmation par le serveur sur cet appareil (`vrm_copies_vu`).
- **Réponse incohérente** (la relecture ne rend pas une ligne que les versions disent exister — un
  serveur qui ignore `in.(…)`) ⇒ rien deviné ni gardé : relue comme avant (lecture groupée : ligne par
  ligne ; commandes : la lecture d'avant).
- **Aucune écriture ne part d'une copie** : l'app ne reçoit une copie que confirmée à l'instant par la
  version du serveur — c'est la ligne du serveur. Publieurs uniques, `listePlusRiche`,
  `fusionNumerosAuChargement`, `onCloudReady`, la ligne `main` : inchangés (la ligne `main` n'est pas
  concernée : elle a déjà sa sonde scalaire `relireNuage`).
- **Cloisonnée par compte VRM** : clé et valeur portent l'uid, vérifié à la lecture ; écrire pour un
  uid efface les copies de tout autre ; `wipeLocalData` (déconnexion, changement de vendeur) et
  `writeSession(null)` effacent la base entière (`effacerCopies`).
- Jamais de PDF ni de photo : seules ces projections passent (aucun `pdfB64`) ; une ligne qui en
  porterait un, ou de plus de 4 M caractères, n'est pas gardée.
- Première ouverture sur l'appareil (comptes pas encore mémorisés) : les versions par le motif
  `like.harvest_*_orders_*d` nomment les lignes ⇒ gardées dès la 1re ouverture.

## 3. Le visuel : ce qui n'a PAS été fait, et pourquoi
« Montrer tout de suite la dernière copie marquée « vu à hh:mm » » existe déjà pour Ma journée,
Colis et Ventes : les **instantanés** (lots A/AE, « Mis à jour il y a 7 min », inertes). Donner les
listes gardées aux écrans AVANT la revalidation les aurait données aux publieurs (`widget_stats`,
`vrm_colis_aposter`, doublons de N°…) : refusé (une écriture partirait d'une copie). La copie n'est
donc montrée « telle quelle » que par l'instantané ; quand la relecture rate, l'écran dit « pas su »
comme avant + la pastille « Vu à hh:mm · pas relu ». Annonces n'a pas d'instantané (à faire par un
lot dédié si Julien le veut).

## 4. Preuves
**Ligne de base** (`_mesure-demarrage.cjs`, 390 px, 4G 9 Mb/s, CPU ×4, base inventée au poids
réel, 2e ouverture dans le même navigateur) :

| 2e ouverture | avant (`origin/main`) | après |
|---|---|---|
| Ma journée | 112 lectures · **2 515 Ko** | 112 lectures · **927 Ko** (−63 %) |
| Annonces | 110 lectures · **2 695 Ko** | 108 lectures · **1 108 Ko** (−59 %) |
| Ventes | 91 lectures · **2 476 Ko** | 91 lectures · **889 Ko** (−64 %) |
| lignes lourdes (banc `ouverture-legere`) | 3 lectures · 1 590 Ko | **0** (versions : 3 lectures, 3 Ko) |

L'heure « prêt » ne bouge pas de façon mesurable sur ce banc (fixée par le processeur et le plafond
d'`AttenteEcran`, voir `2026-11-09-vitesse-demarrage.md` §4) ; le gain est en octets — ce qui coûte
en 4G réelle (débit variable) et sur le quota d'égress.

**Banc `scripts/bancs/ouverture-legere.cjs`** (390 tactile clair, 1512 sombre ; `PASSES=390s,1512c`
inverse les thèmes) : 1re ouverture (copie gardée pour CE compte, aucun PDF) · **A** 2e ouverture
⇒ 0 ligne lourde, versions seules, −1,7 Mo, Ventes montre les ventes · **R** `data.rev` + 1 sur une
ligne ⇒ elle seule relue, la vente neuve à l'écran · **K** versions et lignes en 503 ⇒ « Vu à hh:mm ·
pas relu », copie gardée, la vente gardée PAS montrée comme lue, aucune écriture · **C** autre compte
VRM sur l'appareil ⇒ tout relu, copies à lui seul, aucune mention héritée. **32 verts, 0 rouge** (et
32/0 en thèmes inversés).
- Sur `origin/main` : **7 rouges** (rien gardé, 1,6 Mo relus, R relit 28 lignes, aucune mention, C).
- Mutations (chacune rouge) : version ignorée (toujours relire) ⇒ A, R rouges ; copie rendue quand les
  versions ratent ⇒ K rouge (« présentée comme fraîche ») ; ni uid dans la clé ni effacement ⇒ C rouge
  (0 Ko relu : la copie de l'autre servie). Uid seul retiré : vert (l'effacement au changement de
  vendeur couvre) — deux protections.
- `scripts/tests/copie-lignes.test.mjs` 10/10. `audit-lectures-lourdes` : il résout maintenant une
  constante IMPORTÉE de `src/` (`SEL_VERSION`), au lieu de la dire introuvable.
- Relancés, un à la fois : `colis-ventes-instantanes` (mêmes 6 rouges qu'`origin/main` : ordre de la
  liste et CLS 0,0107, préexistants), `journee-instantanee` 0 rouge. Audits verts : variables, tdz,
  coherence, identite, icones, fonctions-api, inventaire-hors-ligne, lecture-groupee,
  lectures-lourdes. (`pagination-ordre` : 1 rouge préexistant dans `api/_lib/pilotage.js`.)
- Captures regardées (390 / 1512, clair / sombre) : pastille grise discrète au-dessus de la ligne
  « Extension », rien ne déborde.

## 5. Ce qui reste
- Les autres lectures du démarrage restent entières : `like.harvest_%_txn_%` (~246 Ko),
  `like.harvest_*` (~244 Ko), `email_track_*` (~130 Ko), `vinted_item_details` (~108 Ko). Même
  mécanisme possible (elles ont `capturedAt`), à mesurer d'abord.
- La 1re ouverture paie une petite lecture de plus (versions, ~5 Ko).
- Annonces sans instantané (voir §3).

## 6. Geste de Julien
Aucun.
