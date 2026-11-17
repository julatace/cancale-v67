# 16 nov. 2026 — Stock : le plan lisible au téléphone (lot `stock-mieux`)

Julien, sur deux captures iPhone du Stock : « Tu peux faire mieux. » Puis, relayé : « tu peux faire tellement mieux ».
Branche `claude/stock-mieux`, partie de `main` + `claude/retirer-case-compact` (PR #1197, case d'une vendue en
surbrillance) + `claude/design-restes` (PR #1205, meuble glissé au doigt), fusionnées dedans.

## Le constat (mesuré à 390 px, banc `scripts/bancs/stock-mieux.cjs` sur l'arbre d'avant)

1. Le plan d'un meuble : une grille de cases vides en pointillés, un « + » dans CHACUNE (dizaines de « + »).
2. Les cases pleines : « V j… / N… » (logo Vinted + pseudo coupé + « N°12 » en 12 px) sur une photo minuscule.
3. La tête « Garage · 0/32 · 4×8 » posée sur le fond bleu, gris-bleu ; « Comment ça marche ? » bleu sur bleu ;
   la légende (« plus en ligne ») quasi invisible.
4. ↑ ↓ et le crayon sans mot.
5. En bas : « Plus · Aujourd'hui · 10 N° à vérifier · 0 sur 10 vérifiés » ; la liste dépliée sortait de la carte.

## Les deux pistes, faites en captures puis comparées (reprise du 16 nov. au soir)

Julien (relayé) : comparer « liste d'abord + mini-plan » et « étagère réaliste », les deux en captures (390 et 1512).
Les deux ont été rendues dans LA MÊME page de l'app, avec les MÊMES données inventées que le banc `stock-mieux`
(Garage 4×8 à 12 paires dont N°3 et N°7 vendues, N°9 plus en ligne ; Bureau 8×10 à 30 paires dont N°1024) :

- **A — la liste d'abord + un mini-plan** : maquette posée dans la vraie page par un script hors dépôt (la vraie tête du
  meuble ; à la place du plan, un mini-plan en points de 12 px — plein, vendue en bleu, plus en ligne en ambre,
  cherchée en anneau — puis la liste des paires rangées dans l'ordre de leur place : N° en 24 px, photo 48 px,
  « Rangée 5 · col. 4 », pastille « à sortir »). Rien de A n'est dans l'app.
- **B — l'étagère réaliste** : le plan de ce lot (le code).

| mesuré (390 px, clair) | A — liste + mini-plan | B — étagère |
|---|---|---|
| hauteur du Garage (12 paires) | 1 015 px | 682 px |
| hauteur du Bureau (30 paires) | **2 217 px** | **602 px** |
| N° lisibles sur un écran de téléphone | 6 à 7 | 11 (Garage) à 28 (Bureau) |
| « où est le carton ? » | lire « Rangée 5 · col. 4 », puis compter sur le meuble | la case est À SA PLACE, comme sur le meuble |
| le mini-plan | points de 12 px : ni N°, ni touchables (< 44 px) | — (le plan EST la carte) |
| à 1512 | deux longues colonnes de lignes | les deux meubles côte à côte, 42 N° d'un coup d'œil |

**Choix : B, l'étagère réaliste.** C'est la plus lisible : 4 fois plus de N° par écran, et la case est à l'endroit du
carton — devant le meuble, il n'y a rien à traduire. La liste existe déjà au-dessus de « Mes meubles » (la recherche,
ses résultats, « À aller chercher ») : A la doublait meuble par meuble. Le seul point où A gagnait — un meuble plus
large que le téléphone (8 colonnes de 44 px ne tiennent pas dans 390 px) — est corrigé dans B (reprise, plus bas).
La recherche qui allume la case et la fait venir dans l'écran, et le compte « N rangées · N à sortir · N cases
libres » dans la barre du plan, sont gardés.

Captures (hors dépôt, données inventées) : `A-*.png` (piste A) et `sm-*.png` (piste B), et l'avant (main) dans
`capt-main/`, sous `scratchpad/stock-mieux/` de la session.

## Ce qui a changé (aucune règle de rangement : N° jamais réattribué, `prochainLibre`, `cleNum` intouchés)

- **La case pleine** (`Vignette`, `dansCase`) : plaque pleine largeur en bas, opaque (jetons `--etag-plaque*`, jour
  et nuit, jamais le verre translucide), le numéro SEUL en 18 px (16 px à 4 chiffres, 13 px au-delà), jamais coupé ;
  « N° » est dit à l'aide vocale. Vendue = plaque bleue + la surbrillance de #1197 ; plus en ligne = plaque ambre ;
  doublon = rouge (le seul).
- **Les sites sur la case** : les logos seulement quand ils apprennent quelque chose (un autre site que Vinted, une
  annonce pas « en ligne ») ; le pseudo seulement « De près » et s'il tient en entier. La fiche et l'aide vocale
  disent tout (`data-case-sites`, `data-case-compte` gardés).
- **La case vide** : un fond à peine marqué, plus de pointillé ni de « + » ; le « + » paraît au survol (souris), à la
  pose d'une paire (`is-cible`) et sur la case visée.
- **Le meuble** : une carte de verre (`sb-plan`), la tête dedans : nom 18 px, « 12 / 32 rangées », la pastille
  « N à sortir » ; « Modifier » (un mot) — avec plusieurs meubles, un menu Modifier le meuble / Monter / Descendre
  (`data-meuble-menu`, `role="menu"`, Échap et toucher ailleurs le ferment) ; la poignée de glisser (#1205) reste.
- **La barre du plan** (`data-stock-barre-plan`) : « N rangées · N à sortir · N cases libres », les meubles en onglets
  (toucher = y aller, celui sous les yeux marqué par un `IntersectionObserver`), la taille des cases (libellés par
  `tr()`), la légende, « Comment ça marche ? ». Le fond bleu ne porte plus de texte du plan.
- **L'inventaire tournant** : UNE carte (tête « 10 N° à vérifier aujourd'hui », « 3 sur 10 vus », barre d'avancée,
  chevron ; la liste dépliée DANS la carte).
- Textes : `etag.*` (5 langues), `confort.tournant.titre/fait` reformulés (5 langues), ligne « Quoi de neuf »
  `stock-plan-lisible`.

### Reprise du 16 nov. au soir (après la pause)

- **Un meuble plus large que l'écran** (le Bureau 8×10 à 390 px) : il défilait de côté sans le dire, et ses colonnes
  7-8 sortaient du meuble dessiné (le cadre s'arrêtait à la largeur de la carte). Maintenant : le bord droit s'efface
  en fondu tant qu'il reste des cases (`data-deborde`, `suivreDebord` dans `src/ecrans/Stock.jsx`), les numéros de
  rangée restent collés à gauche, le cadre entoure toutes les colonnes (`min-width: min-content`), un meuble plus
  étroit que sa carte est centré.
- **La case trouvée** (recherche, « Voir au stock ») est centrée DANS son meuble qui défile (jamais sous le fondu) ;
  la page, elle, ne défile qu'en hauteur (un `inline: 'center'` poussait la page de côté à 1512 : essayé, retiré).
- **« À aller chercher »** : plaque opaque (`.vrm-etag-cibles`, jetons `--etag-plaque`) — avant, texte sombre sur la
  barre bleue (2,33:1) et « Fermer » coupé (marge −12 px du bouton discret, coins en pilule hérités du champ).
- **Le menu d'un meuble** passe au-dessus du meuble suivant (`:has(.vrm-etag-menu:not([hidden]))`) : « Descendre »
  était recouvert par la règle des colonnes du meuble d'en dessous quand le meuble était replié (banc
  `stock-etageres`, rouge depuis le début du lot).
- Fusions : `origin/claude/retirer-case-compact` (#1197, en file, pas encore sur main) puis `origin/main` (vrais
  merges) ; la case allumée et la sortie automatique de #1197 sont intactes (banc `stock-case-a-sortir` vert).

## Les preuves

- Banc `scripts/bancs/stock-mieux.cjs` : **64 OK** aux quatre variantes (390 tactile / 1512 souris, clair / sombre).
  Mesures : N° des cases en 18 px (16 px à 4 chiffres), contraste aux pixels ≥ 5,92:1 (clair) et 7,28:1 (sombre),
  tête ≥ 5,49:1, « + » dessinés au repos : 0 et 0 (main : 20 et 50).
- **Rouge sur main** (arbre `git archive origin/main`, banc copié dedans, 390 clair + 1512 sombre) : 14 échecs —
  20/50 « + », N° 11-12 px, pseudo « vanessa… » coupé, tête 1,12:1 et 2,15:1, ↑ ↓ ✎ sans mot, « Comment ça marche ? »
  1,01:1, « À aller chercher » 2,33:1 et « Fermer » coupé, Bureau sans fondu ni cadre entier.
- **Rouge sur la branche avant la reprise** (94aa55fcb) pour les contrôles ajoutés : K (2,33:1, coins 999 px, « Fermer »
  hors du panneau) et D. R « 1024 » passe aussi avant : c'est une garde (la case doit rester hors du fondu).
- **Mutations** (CSS injectée, 390 clair) : `num` ⇒ N rouge (9 px) — elle ne prenait plus (les plaques portent leur
  taille en `!important` sur 4 classes) : préfixée ; `plus` ⇒ P rouge (20/50) ; `debord` ⇒ D rouge ; `fermer` ⇒ K rouge.
- Bancs portés : `stock-case-a-sortir` (S1 : la plaque écrit le N° SEUL, « 3 », retiré du texte comme « N°3 »),
  `stock-retrouver` (« De près » à 390 : la carte coûte ~6 px par case, 64 → 69 ; « agrandit » suffit au téléphone,
  +10 px gardé à 1512). Verts : stock-mieux, stock-etageres, stock-case-a-sortir, stock-retrouver, stock-planches
  (rouge une fois sous charge — attente fixe de 1,2 s après l'enregistrement —, vert à la relance, avant comme après),
  paire-a-sortir, stock-annonces, design-restes.
- Audits verts : actions-serie, calculette-emballages, confort-securite, cout-vente, import-autre-outil,
  inventaire(-annuel, -hors-ligne), note-achat-double, numeros-clenum, pas-ranger-achat, plancher-stock,
  robustesse-metier, stock-etageres, stock-hors-ligne, stock-juste, stockage-sur, textes-courts, sortie-expedition,
  traduction, quoi-de-neuf, icones, coherence. Rouge connu de main, rien de ce lot dedans : vendeur-generaliste.
- Captures regardées : 390 et 1512, clair et sombre (plan, Bureau défilé, recherche « 118 » et « 1024 », barre du plan).
- Aucune règle de numéro touchée : N° jamais réattribué, `cleNum`, `prochainLibre` intacts ; aucun nouveau texte
  visible dans la reprise (le fondu et les rangées collées sont muets ; l'aide vocale dit déjà « N°… » et la place).

## ÉTAT À LA REPRISE

17 nov. (reprise après pause) : `main` refusionnée (#1197 et #1205 y sont), conflits réglés (imports de `main` dans
`Stock.jsx`, ids en double de Quoi de neuf retirés, §9 sous 60 Ko). Local, sur le build fusionné : banc `stock-mieux`
64 OK / 0 KO aux 4 variantes (« + » au repos 0 contre 20 et 50 avant ; N° 18 px mini contre 11-12 px ; contraste du N°
≥ 5,92:1 ; tête ≥ 5,49:1 contre 1,12:1) ; mutations `num` et `plus` ⇒ rouges ; `stock-etageres`, `stock-planches`,
`design-restes`, `stock-case-a-sortir`, `stock-retrouver` : 0 KO. CI de la PR #1221 comparée à `main` (rouges déjà
présents sur `main` : vocabulaire-article, vendeur-generaliste, banc nouveau-vendeur). Possible plus tard : dire
« glisse → » en mots au-dessus d'un meuble qui défile.
