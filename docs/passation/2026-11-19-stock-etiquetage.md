# 19 nov. 2026 — Le Stock en meubles pleine largeur, et la méthode d'étiquetage (lot stock-etiquetage)

Julien, mot pour mot (`2026-11-19-demandes-julien.md` §B) : « Pour chaque article, mets "à ranger maintenant" au lieu que
je doive appuyer sur l'article et qu'après ce soit à droite. Fais une meilleure représentation du meuble, avec une
animation quand je range l'article dans le meuble. Je veux voir le meuble d'un peu plus loin : qu'il occupe toute la
largeur de l'écran, et que "ranger" n'apparaisse que quand on le demande. Je veux tous les meubles de rangement
parfaitement dans l'onglet Stock. » — « À la création du compte, et même après, qu'on puisse choisir la méthode
d'étiquetage que l'on veut. » Décision du 19 nov. : garder des meubles DESSINÉS.

Branche `claude/stock-etiquetage`, partie de `origin/claude/integration-19nov` (train du 19 nov.), le train refusionné
par un vrai `git merge` avant les grosses étapes et à la fin. Pas de PR, pas de fusion (le coordinateur intègre).

## Ce qui change

### Le Stock (src/stockV2/StockV2.jsx, design « VRM natif »)
De haut en bas : « Stock » et « ⋯ » ; le champ « Où est… » (photo et voix dedans, plus collé en haut) ; LE plein
« Ranger N paires » ; **« À ranger · N »** — une rangée par article (photo, titre, plaque N°, taille) et **« Ranger » au
bout** : toucher la rangée ouvre la séance sur CET article (plus de fiche ni de colonne « à droite » ; la fiche est un
balayage, « Fiche ») ; 5 articles, puis « Voir les N autres » ; puis **Meubles · Paires** (segmenté natif).
- **Meubles** (l'entrée) : TOUS les meubles, DESSINÉS (src/stockV2/MeubleDessin.jsx) — le bâti à sa couleur, ses
  tablettes, une boîte par case prise (sa teinte) avec une étiquette papier au N° EN GRAND, un creux par case libre.
  Téléphone : chaque meuble sur toute la largeur. Ordinateur : côte à côte (un meuble de 6 colonnes et plus prend deux
  places), l'onglet Stock prend toute la largeur (pont.css : la coque rétrécissait l'écran à 535 px). « De loin » :
  jamais de photo, N° ≥ 13 px, cases plus basses ; « à sortir » (ambre), « plus en ligne » (pointillé ambre), « en
  double » (rouge, le seul). Un toucher **zoome** sur un meuble : ses cases se touchent (≥ 44 px, un grand meuble défile
  dans son cadre, jamais la page) avec les gestes d'avant (`toucherCase` = `cliquerCase` : la fiche, la sortie d'une
  vendue, placer), « Modifier le meuble », « Monter / Descendre d'un cran », « ‹ Tous les meubles ».
- **Paires** : « Dans une case · N » (balayer ⇒ « Déplacer ») et les blocs d'avant (à faire, importées, à part…).
- **La séance « Ranger »** (une feuille, seulement à la demande) : l'article (photo, plaque, titre), « Pose-la ici · meuble
  · rangée, colonne », le meuble DESSINÉ en grand avec la case proposée qui respire (« Ici »), des onglets pour un autre
  meuble ; « Ranger ici » (le plein de la feuille) ou le toucher de n'importe quelle case. **L'article vole dans sa case**
  (une copie de sa photo, 260 ms, `cubic-bezier(.32,.72,0,1)`), la boîte arrive dans la case, le suivant glisse ;
  un toucher pendant le vol fait arriver le suivant sans reposer l'article ; **mouvement réduit ⇒ aucun vol, un fondu**.
  « Déplacer » = la même séance, la case actuelle marquée. La liste sous la feuille ne bouge pas pendant la séance.
- Étagère v4 (lot gardé `integration-16nov-finitions-stock-v4`, validé par Julien) : repris `src/etageres/reglages.js`
  (module pur, tel quel) — chaque meuble se dessine selon SES réglages (Cartons · Rayonnage · Plan, couleur du bâti,
  teintes des contenants, « de loin » sans photo). Pas repris : le panneau « Personnaliser », « La pièce » et
  l'isométrique (ils écrivent le meuble par un chemin du Stock v4 qui n'est pas sur le train) — à faire dans un lot à part.

### La méthode d'étiquetage (src/etiquetage/)
UNE méthode = qui numérote · la forme des PROCHAINS N° · l'étiquette (écrite à la main ou imprimée) · son format.
- La règle : `src/etiquetage/methode.js` (pur). Trois clés, rien de neuf quand une clé existe : `vrm_numero_ecrit`
  (« je numérote moi-même » — LE réglage que lit l'extension, capacité `numerotes` 5.382 : l'app DEMANDE alors le N° de
  chaque nouvel article), `vrm_num_prefixe` (la série, '' = chiffres), `vrm_etiquetage` { support, format, titre }
  (neuve, dans SYNC_KEYS). Seulement ce qui CHANGE ; la lettre des anciens N° (archive 013, « B ») REFUSÉE, rien
  écrit ; « Avec une lettre » sans lettre tapée n'écrit rien.
- **Paramètres → Stock → Méthode d'étiquetage** (`EtiquetageReglage.jsx`, `?tab=settings&reglage=etiquetage`) : listes
  groupées natives à coches ; Réglages n'écrit QUE `CLES_METHODE` (filtre avant toute écriture) ; « Où VRM lit ton
  numéro » mène au panneau Numéros d'avant (endroits, essai, aperçu), inchangé.
- **Ma configuration** (création du compte, rejouable) : l'étape « Où est ton numéro ? » propose en plus, quand VRM
  numérote, « Tes prochains numéros » (chiffres / lettre tapée, l'archive refusée) puis « Ton étiquette » (main ou
  imprimée, format) — mêmes écritures (`ecrituresMethode`), le récap les redit.
- **Étiquettes imprimées** (`impression.js`) : quand la méthode est « imprimée », « Imprimer N étiquettes » au-dessus
  de « À ranger » ; une étiquette par N° TEL QU'IL EST (aucun N° calculé, donné ni réservé), au format choisi (50 × 30,
  62 × 29, planche A4 de 24), le début du titre s'il l'a coché ; **aucun QR** (refusé le 11 oct.) ; par un cadre caché.

## Ce qui ne change pas (CLAUDE.md §5)
Aucun N° n'est écrit, changé ni réattribué par ces écrans : le Stock ne range que par `s.poser` (lire-fusionner-réécrire
de `vrm_slots`, une case prise DEMANDE, la gravité des piles) ; la case proposée vient de src/ouRanger.js
(`caseLibreDans` puis `premiereCaseLibre`) ; on range un ARTICLE (les annonces actuelles de `aRanger`), jamais un achat
(`peutRanger` garde « Ranger » et « Ranger maintenant »). Changer de méthode ne renumérote rien ; aucune migration,
aucun drapeau du navigateur ne touche un numéro. Le DOM d'avant (bancs `vrm_banc_dom_ancien`) est intact.

## Preuves
- `node scripts/audit-stock-etiquetage.cjs --mutation` : 18 contrôles (la règle EXÉCUTÉE : 432 choix n'écrivent que les
  trois clés, rien si rien ne change, archive refusée, « moi » = `vrm_numero_ecrit` ; l'impression ; les écrans n'écrivent
  rien eux-mêmes ; un article, jamais un achat) ; **8 mutations, toutes rouges** ; rouge sur l'arbre d'avant (6 KO).
- Banc `scripts/bancs/stock-etiquetage.cjs` (390 tactile clair/sombre, 1512 clair/sombre, base de volume de 96 paires et
  4 meubles — étagère, armoire, rayonnage 8 × 6, bacs en plan —, base VIDE, mouvement réduit, Paramètres) : 103 verts —
  M1-M3 (4 meubles d'entrée, pleine largeur, de loin lisible ≥ 4,5:1), R1-R5 (rien avant la demande, « Ranger » au
  bout, CET article, case de src/ouRanger.js écrite, vol 260 ms courbe iOS / fondu en réduit, autre case touchée),
  Z1 (zoom, 48 cases ≥ 44 px, retour), N1 (aucun N° changé), E1 (moi ⇒ `vrm_numero_ecrit`, « B » refusée, « C » écrite,
  imprimée A4 ⇒ `vrm_etiquetage`, aucun N° ni case touchés), Q. Rouge sur l'arbre d'avant (3 KO puis arrêt).
  Captures regardées (écran, meubles, séance, zoom, vide, réglage ; jour et nuit) ; jamais commitées.
- Banc `stock-rangement.cjs` mis au design (meubles d'entrée, séance au meuble dessiné, plus de colonne « à droite ») :
  touchers 2→2 · 20→11 · 2→1 · 6→3, aucun N° changé.
- Audits verts : traduction, tdz, variables, identite, configuration-depart, quoi-de-neuf, icones, pas-ranger-achat,
  parametres, centre-aide, numero-ecrit, numeros-lettres, studio, textes-courts, ligne-glissable. `coque-parametres`
  (26/27) et le banc `configuration-depart` (notifications 8 sur 9, « Ma configuration ») : rouges IDENTIQUES sur le train
  `integration-19nov` sans ce lot (pas de ce lot).

## Reste / gestes
- Aucun geste de Julien. Rien à appliquer en base.
- À faire plus tard : « Personnaliser » un meuble et « La pièce » (v4) en natif ; un glisser à la souris dans le meuble
  zoomé (le Stock d'avant l'avait) ; la coque native qui rétrécit les écrans d'avant à l'ordinateur (pont posé pour le
  Stock seulement : `#vrm-contenu[data-ecran="garage"]`).
