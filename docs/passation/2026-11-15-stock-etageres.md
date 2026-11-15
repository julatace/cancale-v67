# 15 nov. 2026 — Le Stock en étagères : meubles libres, couleurs, règle des piles

Branche `claude/stock-etageres` (depuis `origin/main` ea152a4b). Aucune PR ouverte.

Julien (iPhone) : « je veux que tu améliores le stock pour qu'on puisse vraiment faire le nombre de
cases que l'on veut, pour que l'on puisse représenter comme on veut notre stock, que l'on puisse
mettre des couleurs aux cases pour faire des étagères, vraiment quelque chose de parfait, pro,
nickel ; que l'on puisse mettre la règle par exemple pour une pile de boîtes : si on enlève celle
tout en bas, celles du dessus descendent toutes seules. Il faut que les numéros soient bien
attribués, que dans le stock ce soit bien fait. »

## 1. Mesuré d'abord

**Le code.** « Mes meubles » (la vue 2D du Stock, seule vue depuis le 5 nov.) existait :
`vrm_meubles` = `[{ id, name, cols, rows, planches?, gravite? }]`, `vrm_slots` = `{ [cleNum]: { m, i } }`,
deux clés de SYNC_KEYS (ligne `main` : fusion à trois voies par `fusionnerLigne`, comparer-et-échanger
sur `data.rev` dans `cloudPush`, une lecture ratée n'écrit rien). L'éditeur bornait à **8 colonnes × 10
rangées**, aucune couleur, la gravité était tout-ou-rien (`gravite`). Lecteurs de la place : la loupe
« Tout sur le N° » et l'emballage (`ouStockNumero` → `ouDansMeubles`), « Préparer mes colis » /
« Tout imprimer » (le tampon « Meuble · rangée r, colonne c »), « Où ranger » (src/ouRanger.js),
le rangement à l'arrivée (src/rangementArrivee.js), l'inventaire, Ma journée.

**La base (lecture seule, 15 nov., outil SQL, scalaires projetés).** Sept lignes `main` ; une seule
porte un rangement : **2 meubles** — 4 × 8 (champs `id, name, cols, rows`) et 7 × 10 (`gravite: false`,
`planches: []`) — et **1 case occupée** (le 7 × 10, case 22 = rangée 4, colonne 2, meuble existant).
`cols`/`rows` sont des nombres. `vrm_stock_sortis` : 52 entrées. L'ancienne pièce 3D (`vrm_room`, ligne
à part) est lue seulement (fiche « Ancienne place »), jamais touchée.

**Trois défauts trouvés et prouvés** (audit rouge sur `origin/main`, voir §5) :
1. **La gravité ne comptait que les paires MONTRÉES** (`tasserMeuble(slots, m, presents)`, presents =
   les fiches affichées). Une paire d'un compte écarté, ou toutes pendant le chargement, laissaient sa
   case « vide » : à la première écriture, la paire du dessus **descendait dans la case du carton** (deux
   N° dans la même case — mesuré : `{"31":{i:4},"32":{i:4}}`). Une sortie que rien ne prouvait (§5 « pas
   su ne vaut pas oui »).
2. **La sortie automatique (colis parti) ne tassait pas la pile** : `libererCasesPartis` vidait la case,
   les cartons du dessus restaient en l'air jusqu'au prochain geste dans le Stock, qui les faisait alors
   tomber sans rien dire. Même chose pour « Enlever du stock » et « Vendu ailleurs / en main propre ».
3. **Poser sur une case qui porte un N° pas montré l'effaçait de sa case sans un mot** (« case notée pour
   un article qui n'est plus là »), et un meuble rétréci faisait sortir des paires de leur case en silence.

## 2. Le modèle (aucune clé nouvelle, aucun champ renommé)

Un meuble est l'objet d'hier **augmenté de champs facultatifs** (src/stockEtageres.js) :

| champ | sens | absent |
|---|---|---|
| `type` | `etagere` · `armoire` · `casier` · `pile` · `bac` (un point de départ : dimensions proposées, dessin) | « étagère » |
| `couleur` | un nom de la palette : `ciel`, `lagon`, `sauge`, `sable`, `terre`, `ardoise` | aucune |
| `couleurs` | `{ 'rangée:colonne': nom }` — la couleur d'une case (1 = en haut / à gauche) | celle du meuble |
| `piles` | `[colonne, …]` — les colonnes en pile quand le meuble ne l'est pas tout entier | aucune |
| `ordre` | sa place dans la pièce (monter / descendre) | sa place dans la liste |

- Dimensions : **1 à 30 colonnes × 1 à 50 rangées** (`COLS_MAX`, `RANGEES_MAX`), tapées ou au + / −.
- Les couleurs sont rangées par **rangée:colonne** (pas par index de case) : changer le nombre de
  colonnes ne repeint pas la mauvaise case. Palette sobre, teinte claire et teinte bleu-nuit
  (src/styles-etageres.css), **jamais le rouge** (doublon de N°) **ni le violet** (audits `violet`,
  `rouge-doublon` verts).
- `ordre` plutôt que l'ordre de la liste : `fusionParId` garde l'ordre du NUAGE ; un champ par meuble se
  fusionne, lui, champ par champ entre deux appareils.
- `vrm_slots` ne change pas.

## 3. La reprise de l'existant (« migration » sans drapeau)

L'ancienne forme **est** la nouvelle sans ses champs facultatifs : aucune place ne bouge, rien n'est
réécrit à la lecture (`lireMeuble` lit tolérant pour DESSINER — une valeur abîmée se lit comme absente —,
jamais réécrit tel quel). Le premier geste réécrit le meuble **d'origine augmenté** (`{ ...x, name, cols,
rows, planches, gravite, ...plus }`) par `save` → la file d'envoi → `cloudPush` (lire-fusionner-réécrire,
comparer-et-échanger sur `data.rev`, lecture ratée ⇒ rien). Aucun drapeau `localStorage` (§5). Un meuble
d'hier `gravite: true` reste empilé (toutes ses colonnes). Prouvé : audit M1-M4, banc A (aucune écriture
de `main` au montage, N°12 dans SA case, ordre d'hier).

## 4. La règle des piles (src/stockEtageres.js, une règle pour tous)

- Une colonne est **en pile** si le meuble l'est (`gravite`, ou `type: 'pile'`) ou si elle est dans
  `piles`. Dans une telle colonne, entre deux planches, un carton pose sur celui du dessous.
- **Une case est occupée dès qu'une entrée de `vrm_slots` la désigne** — paire montrée ou non
  (`tasserPiles`). L'écran dessine une case prise par un N° pas montré en hachuré « N°9999 »
  (`data-case-notee`), jamais « + » ; la toucher le dit ; poser dessus DEMANDE (« N°… n'est plus là :
  libérer la case »), « Annuler » ne change rien.
- **Seul un fait prouvé vide une case** : la sortie automatique d'un colis PARTI (`venteSortieDuStock` →
  `libererCasesPartis`), ou SON clic (Retirer de la case, Je l'ai sortie, Enlever du stock, Vendu
  ailleurs / en main propre, Déplacer, enlever en série, meuble rétréci après confirmation). Une vente
  pas encore partie allume la case (« Vendue »), elle ne la vide pas ; une absence ne vide rien.
- Après chaque sortie, les meubles **touchés** se tassent (`tasserApres`, `sortirDeCases`,
  `opsSortieCases`) : chaque carton du dessus descend d'autant de cases vidées sous lui, dans l'ordre,
  jamais à travers une planche. **C'est l'emplacement (`i`) qui change, jamais le N°.**
- **C'est DIT** : « N°34 et N°35 sont descendus d'un cran. » (`phraseDescentes`, src/etageresTextes.js) —
  sur le meuble (ligne `data-descente`, « Compris »), dans le message du geste, dans la pilule de
  « Enlever du stock » / « Vendu ailleurs », dans le message de la sortie automatique et dans la carte
  « Cases libérées toutes seules » (`descendus` du journal `vrm_stock_sortis`).
- « Annuler » (geste annulable 5 s) rend la case ET les descentes (`opsSortieCases` les porte en
  opérations, la case vidée d'abord).
- **L'impression** : le tampon de « Tout imprimer » / « Préparer mes colis » lit la place au moment de
  l'impression (`ouStockNumero`) ; la sortie n'arrive qu'au colis PARTI, donc APRÈS : le bordereau dit
  la case où la paire est quand il va la chercher. Les paires du dessus qui descendent ensuite ont, elles,
  leur nouvelle case au tampon suivant.
- « Où ranger » et le rangement à l'arrivée ne proposent dans une colonne en pile que la case la plus
  basse libre (`colonneEnPile`, src/ouRanger.js, src/rangementArrivee.js).

## 5. L'écran (Studio bleu clair)

- En-tête de meuble : pastille de couleur, nom, « 7/12 · 4×3 · empilé » ou « · 1 colonne en pile »,
  ronds 44 px **monter / descendre** (dans la liste) et **modifier** (`sb-rond`). La colonne en pile
  porte « ↓ » sur sa règle.
- Le meuble prend sa couleur (montants, planches, fond) ; une case colorée : son fond quand elle est
  vide, une bande en bas quand elle porte une photo. Formes : armoire (montants épais), pile (boîtes à
  couvercle, sans cadre), bac (contenant), casier (cases serrées).
- La case d'un N° en **doublon** (`vrm_num_doublons`) : anneau rouge `--sb-doublon` (seul rouge).
- L'éditeur (feuille) : **Forme** (5 touches enfoncées), Nom, Colonnes / Rangées (− champ +),
  « N cases », **Couleur du meuble** (7 ronds), « Articles empilés » ou **Colonnes en pile** une par une,
  **Couleurs des cases** (repli : pinceau, gomme, toile 44 px ; un numéro de rangée / colonne peint la
  ligne entière, un second toucher la dépeint), planches, « Créer le meuble » (le seul plein).
- 1 000 paires : les cases sont indexées une fois par rendu (`parCase`) au lieu d'un balayage de toutes
  les cases pour chaque case dessinée.
- Textes : `etag.*` dans `src/i18n/langues/<l>/etageres.js` (5 langues ; `audit-traduction` 45 verts).
  « Quoi de neuf » : `stock-etageres`.

## 6. Les numéros

Vérifiés, **aucune règle changée** : `prochainLibre` (part du plus haut, jamais d'un trou),
`doublonsAReattribuer`, les numéros à lettres (« B » d'archive), la reprise du N° d'une republication,
la garde rapide. Audits verts : `conflits-numeros` 35, `doublons-historique` 39, `numeros-clenum` 11,
`numeros-lettres`, `numerotation-lecteurs` 100, `renum-b` 126, `reprise-numero`, `garde-numeros-rapide`
23, `rangement-guide` 42 (le VRAI `prochainLibre`), `identite`. Aucun défaut trouvé. Rien dans le Stock
ne touche un N° : `vinted_annonce_numeros` reste 1 000 fiches intactes dans le banc.

## 7. Preuves

- `node scripts/audit-stock-etageres.cjs` : **48/48** ; `--prouve` : **14/14 mutations** rougissent
  (sans gravité, ordre inversé, un cran au plus, planche traversée, sortie sans tasser, paire remise
  sortie, toutes les colonnes au lieu de celles choisies, pose dite « descente », « Annuler » partiel,
  ordre ignoré, déplacement qui recopie le meuble, couleurs par index, écran qui ne tasse que les paires
  montrées, gravité au montage). **Sur `origin/main`** (git archive, l'audit copié DEDANS) : **20 rouges
  sur 31** — dont la règle de l'écran d'avant EXÉCUTÉE (`tasserMeuble` extrait) : « N°32 descend dans la
  case de N°31 », et la sortie automatique sans descente.
- Trouvé en REGARDANT la capture (390) : poser une paire en haut d'une pile disait « N°1 est descendu de
  4 crans » — la paire qu'il pose n'est pas « descendue » : `tasserApres` sépare `chutes` (la paire posée,
  dont la case finale est dite par la pose) et `descentes` (les cartons déjà là). Audit P8.
- `audit-stock-2d` 49/49 (13/13 mutations), `audit-coque-parametres` 31/32 (le rouge « une icône par
  ligne » est le MÊME sur origin/main), `cycle-article` 57, `stock-juste`, `stock-annonces` 54,
  `stock-hors-ligne` 33, `vague3-ecrans`. Les deux premiers copient désormais src/stockEtageres.js à côté
  de la sortie (elle l'importe).
- Audits demandés : `traduction`, `tdz`, `variables`, `studio`, `identite`, `composants`, `icones`,
  `violet`, `rouge-doublon`, `csp`, `quoi-de-neuf`, `coherence` : verts.
- Banc `scripts/bancs/stock-etageres.cjs` — données INVENTÉES à la forme mesurée (deux meubles d'hier
  4×8 et 7×10, une case prise ; une pile d'hier dont le bas porte N°9999 d'un compte MASQUÉ ; 1 000 paires
  en ligne ; un N° en doublon), 390 tactile et 1512, clair et sombre (`CAPTURES=dossier`) :
  - **390 clair et 1512 sombre (scénario complet), 1512 clair et 390 sombre (rendu)** : verts — reprise (N°12 dans SA
    case, ordre d'hier, 106 cases, **aucune écriture de `main` au montage**), N°9999 hachuré (jamais « + »),
    doublon rouge et aucun autre, étagère 4×3 « sauge » rangée 1 « ciel », pile de 5, trois paires
    touchées en haut tombent l'une sur l'autre, celle du bas sortie ⇒ les deux du dessus descendent d'un
    cran et c'est DIT, 1 001 fiches intactes, la pile d'hier garde N°9999, recherche « 12 » allume sa
    case, « Descendre » réordonne, 44 px au doigt (40 à la souris, la touche du studio), aucune page plus
    large, aucune erreur ; la grille est là en ~3,4–4 s pour 1 000 paires (machine chargée, charge 60).
  - **Sur `origin/main`** (build d'avant, même banc) : **4 rouges** à 390 clair — N°9999 pas dessiné
    comme pris, pas de doublon rouge sur la case, **N°61 tombé dans la case du carton N°9999** (`mQ:3`),
    et l'éditeur sans formes / couleurs (le scénario s'arrête là).
  - Dernier passage, sur le build final (tête de branche) : **390 clair 24/24 vert** ; 1512 sombre vert
    jusqu'à la pile (12 contrôles) puis « Target crashed » (navigateur tué sous la charge) — le passage
    complet précédent de 1512 sombre était vert sur A–H, hors les deux points corrigés depuis (ci-dessous).
  - Le seul rouge de mise au point (1512 sombre) : le choix des planches (`ChoixPlanches`, App.jsx, pas
    touché) dessine des boutons de 30 px à la souris — jugé à part, dit ici ; « Enregistrer » est passé au
    plein du studio (`sb-btn-plein--barre`, 52 px).
- Bancs existants sur ce build : `tout-imprimer` **28 conformes** (l'emplacement imprimé). `stock-planches`
  : 1 rouge à 390 (la fiche de la paire, ouverte par la case depuis le 14 nov., couvre la case suivante) —
  **le MÊME sur origin/main** (rejoué sur son build). `stock-2d` (5 rouges : « Voir l'état » attendu dans
  l'ancienne feuille du Stock, clics à 390 couverts par la fiche, animation de l'explication),
  `stock-retrouver` (1 : la case qui clignote hors de l'écran à 1512), `stock-juste` (8 : pastilles par
  site d'une ligne de la liste, délais dépassés, « Target crashed ») : rouges de la refonte du 14 nov. et
  de la charge de la machine (charge 50–64, un build en 11 min) ; leur référence sur origin/main n'a pas pu
  aller au bout (navigateur fermé sous la charge). `stock-hors-reseau` : arrêté sans résultat (bloqué sous
  la charge) — `audit-stock-hors-ligne` 33/33 vert.

## 8. Ce qui reste

- Les gestes rares « monter / descendre » n'existent qu'en touches (pas de glisser de meuble) : demandé
  « par glisser ou touches », les touches sont accessibles au doigt et au clavier.
- Une case contient UNE paire (comme avant) : un « bac » est une rangée de compartiments, pas un tas.
- Banc `stock-planches` : à 390 px, la fiche de la paire (ouverte par une case depuis le 14 nov.) reste
  ouverte après « Retirer de la case » et couvre la case suivante (le banc ne la referme pas) — même rouge
  sur origin/main. `stock-2d`, `stock-retrouver`, `stock-juste` à rejouer sur une machine au repos.
- Le choix des planches (`ChoixPlanches`, App.jsx) garde ses boutons de 30 px à la souris.

## Geste de Julien

Aucun obligatoire. Ouvrir Stock → « Ajouter un meuble » : choisir sa forme, ses cases, sa couleur ;
pour une pile de boîtes, « Pile » (ou cocher les colonnes en pile d'une étagère).
