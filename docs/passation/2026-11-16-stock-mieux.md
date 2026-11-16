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

## Les pistes évaluées

- (a) vue par défaut = la LISTE groupée par meuble, le plan en mini-carte : la liste existe déjà dans le Stock
  (« la liste », au-dessus de « Mes meubles », avec la recherche collée) ; la dupliquer par meuble aurait mis deux
  listes à l'écran. Écartée.
- (b) plan « étagère » net : chaque case pleine = la photo nette, le N° en grand sur une plaque opaque ; cases vides
  à peine marquées. **Retenue** : devant les cartons, c'est le plan qui ressemble au meuble ; le N° est ce qui est
  écrit sur le carton (§5).
- (c) la recherche qui allume et fait défiler (elle existait : vérifiée par le banc, R) + un compte clair
  « N rangées · N à sortir · N cases libres ». **Retenue**, posée dans la barre du plan.

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

## Les preuves

MESURES (à compléter par le banc) — voir « ÉTAT À LA REPRISE ».

## ÉTAT À LA REPRISE

(à compléter)
