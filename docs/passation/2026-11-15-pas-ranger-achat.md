# 15 nov. 2026 — On range un ARTICLE, pas un achat

Branche `claude/pas-ranger-achat` (partie de `origin/claude/project-review-nsk5su`), pas de PR.

## La demande

Julien, sur une capture du centre de notifications (15 nov., 23 h 10) : **« Enlève ça, on range une
ANNONCE, pas un achat »**. Pour CHAQUE achat arrivé, la cloche montrait « Arrivé · Zapatillas Adidas
Spezial · Première case libre : Meuble · rangée 1, colonne 1 · [Ranger] Déjà rangé », c'est-à-dire la
même case pour tous. Ma journée disait aussi « 8 achats à ranger · N° et case proposés, un geste ».

## D'où ça venait

Deux lots ajoutés l'un sur l'autre :

- **5 nov., chantier H, « Où ranger à l'arrivée »** (`src/ouRanger.js` : `achatsArrives`,
  `notifsOuRanger`). Dans la cloche, `calculerOuRanger` relisait les achats, repérait le passage
  « en route → arrivé » et proposait `premiereCaseLibre`, la MÊME case pour toutes les lignes (« on ne
  propose qu'une case à la fois », disait le commentaire). C'était **calculé sur l'appareil à chaque
  ouverture**, jamais écrit dans le journal du serveur (`push_journal`). Côté serveur
  (`api/_lib/notif-*`), aucune famille ne portait ce motif : rien à retirer là-bas.
- **11 nov., lot rangement-guide, « Ranger cet achat »** (`src/rangementArrivee.js`,
  `src/RangerAchat.jsx`). « J'ai retiré » (colis, commande Vinted, en série, au comptoir avec le
  scanner ou le mode relais) ouvrait une feuille qui numérotait l'ACHAT et lui donnait une case.
  Ma journée portait « N achats à ranger » (`id: 'achats-a-ranger'`), et « Ranger » dans la cloche
  ouvrait la même feuille.

## Ce qui est retiré

- **La cloche** (`CentreNotifsCoque`, App.jsx ; `src/CentreNotifs.jsx`) : plus de `calculerOuRanger`,
  plus de bloc « À ranger » (« Ranger », « Déjà rangé »), plus de notifications locales comptées dans la
  pastille (`enPlus` retiré de `BoutonCentreNotifs`). Comme ces lignes étaient recalculées à chaque
  ouverture, **celles qu'il voyait déjà disparaissent aussi** : elles ne sont plus calculées. Les clés
  de l'appareil (`vrm_ranger_vus`, `vrm_ranger_proposes`) ne sont plus lues nulle part. Rien n'est
  effacé, aucune écriture.
- **Ma journée** : la ligne « N achats à ranger » et son crochet `useARanger`.
- **« J'ai retiré »** (`markCollected`, `markAllCollected`, `markPickupDone`, `markPickupDoneSerie`,
  la fermeture du scanner ou du mode relais) : ces gestes ne font plus que retirer. Retirés aussi :
  `apresRetrait`, `proposerRangement`, `ouvrirRangement`, `entreeRangementVinted`,
  `entreeRangementColis`, `preparerRangement`, `ecrireRangement`, `RangerAchatCoque`, ainsi que
  l'import de `RangerAchat.jsx`.
- **`src/ouRanger.js`** : `achatsArrives` et `notifsOuRanger` sont supprimées.

## Ce qui reste

- **Le rattrapage du pool** : un N° d'une fiche déjà rangée à l'arrivée avant ce jour, s'il manque au
  pool, y entre toujours (append-only, §5). Il est porté par `RattrapageNumerosRanges`
  (`reserverNumerosRanges`, 6 s après le montage).
- **`src/rangementArrivee.js`** reste, parce que c'est la règle des cases d'un gros lot (`casesEnSerie`,
  `caseHabitude`, `src/grosLot.js`). `src/RangerAchat.jsx` reste dans le dépôt, mais n'est plus importé.
  La branche `claude/atelier-arrivee` charge son `Plan` (voir plus bas).
- **Les fiches déjà rangées à l'arrivée** (`vrm_fiches_neuves`, `origine: 'arrivee'`) restent telles
  quelles : N°, case, coût. Le Stock les montre comme avant (« Rangé à l'arrivée — pas encore en ligne »).

## Le rangement, là où il a un sens : l'article, au Stock

`casesProposees({ meubles, slots, cles })` (src/ouRanger.js, pure) : chaque article à ranger reçoit,
dans l'ordre de la liste du Stock, la première case libre **qui n'est pas déjà proposée à un article
d'avant**. Une case proposée compte comme prise. Dans un meuble empilé, la suivante est donc celle juste
au-dessus. Plus de case libre ⇒ `null`, c'est dit et rien n'est inventé. « Pas su » ⇒ `null`.

Dans `src/ecrans/Stock.jsx` :
- `caseProposeeDe(cle)` : la proposition de CET article. Un article hors de la liste (filtré, vendu…)
  reçoit la case qui suit toutes celles déjà proposées : jamais celle d'un autre.
- **La fiche d'un article sans case** affiche « Case proposée : Étagère A · rangée 1, colonne 3 »
  (`data-fiche-case-proposee`). « Ranger ici » (`data-fiche-ranger-ici`, sur SON toucher) pose l'article
  dans cette case, et « Autre case » garde le choix sur le plan.
- « Ranger au stock » (depuis Annonces) et le geste « Ranger » d'une ligne visent la case de CET
  article. Avant, ils visaient la première case libre, commune à tous.
- Textes : `stock.caseProposee`, `stock.rangerIci`, `stock.autreCase`, dans les 5 langues.

## L'atelier « achat arrivé → en ligne » (`origin/claude/atelier-arrivee`) : à reprendre

Cette branche (pas modifiée ici) fait de « Ranger cet achat » la **première étape** de son atelier
(N° · case · photos · prix · fiche · publier). Elle s'ouvre par `ouvrirRangement` (« J'ai retiré », la
cloche, Ma journée), c'est-à-dire **sur l'achat brut**. Elle s'appuie sur `preparerRangement`,
`ecrireRangement`, `lirePropositionsRanger`, `entreeRangementVinted` et `RangerAchatCoque`, retirés ici :
la fusion sera en conflit. Pour suivre la décision de Julien, son étape « carton / case » ne doit
s'ouvrir **qu'une fois l'article numéroté (une fiche)**, jamais sur l'achat. La case se prend alors par
`casesProposees` (une case par article).

## Preuves

- `node scripts/audit-pas-ranger-achat.cjs --prouve` : **18 verts**. Sur l'arbre de départ
  (`origin/claude/project-review-nsk5su`) : **17 rouges sur 18** (seul « App.jsx lu » reste vert). Les
  **6 mutations sont attrapées sur 6** : une case proposée qui ne compte pas comme prise, le meuble
  empilé ignoré, « J'ai retiré » qui rouvre la feuille, Ma journée qui retrouve sa ligne, la pastille qui
  recompte, le Stock revenu à la case commune.
- Audits suivis : `audit-coque-parametres` (14 mutations sur 14 ; le rouge « Paramètres · Réglages : une
  icône par ligne » existait déjà sur l'arbre de départ), `audit-lectures-lourdes`,
  `audit-rangement-guide` (41 verts, 14/14 mutations ; sa copie oubliait `stockEtageres.js` et une ancre
  avait vieilli : réparés), `audit-vague3-ecrans` (les 5 mutations « introuvables » le sont
  aussi sur l'arbre de départ), `audit-traduction`, `audit-quoi-de-neuf`.
- Bancs : `scripts/bancs/pas-ranger-achat.cjs` (nouveau, 390 px tactile clair et 1512 px sombre) :
  P1 cloche, P2 Ma journée, P3 « J'ai retiré », P4 deux fiches et deux cases différentes, puis « Ranger
  ici ». `coque-parametres` (H6) et `vague3-ecrans` (S) jugent désormais qu'aucune case n'est proposée à
  un achat. `scripts/bancs/rangement-guide.cjs` est retiré : il jouait la feuille, qui n'existe plus.
- Bancs relancés : `pas-ranger-achat` 30 verts ; `vague3-ecrans` (S) 40 verts ; `coque-parametres` H5, H6 verts
  (les rouges H3 et H4, icônes de Paramètres et « Discord dit une fois », ne touchent pas ce lot) ;
  `centre-notifs` 136 verts (les 8 rouges F1 et F11 viennent des réglages : il attend 8 types, l'app en a 11
  depuis avis, alertes eBay et modération ; pas ce lot) ; `journee-coherence` vert. Captures regardées (cloche
  vide, fiche « Case proposée · Ranger ici · Autre case » à 390 px et 1512 px).
- `src/nouveautes.js` : « Plus de rangement proposé sur un achat ».

## Geste de Julien

Aucun.
