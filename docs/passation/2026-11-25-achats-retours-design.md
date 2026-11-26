# 25 nov. 2026 — Achats : les cartes de retour compactes (branche `claude/achats-retours-design`)

Julien (iPhone, style Monochrome, Achats → « À renvoyer 2 » puis « À vérifier 1 ») : « Tu peux améliorer ce design ».
Ses captures : chaque carte de retour faisait ≈ un écran (mesuré sur la même forme inventée : **452 px** l'Autry « délai
dépassé », **374 px** le Nike remboursé, **124 px** la ligne « À vérifier ») ; « Remboursé » écrit trois fois (pastille, titre,
étape) ; « date pas vue » sous deux étapes ; « Livré au ven- deur » coupé ; deux ou trois gros boutons par carte ; en haut de
l'écran une ligne vide avec seulement « ⋯ » (et « ✓ » quand il y a plusieurs achats). Suite du lot #1341
(`2026-11-23-retours-suivi.md`) : **aucune règle touchée** (`src/retoursAchat.js` `etapesRetour`, `quandLimite`, l'identité par
n° de transaction, les dates lues) — seulement la structure et le style de ces cartes.

## Ce qui change (src/RetoursLitiges.jsx, src/styles-retours-cartes.css)

1. **Carte en cours ≈ 1/3 d'écran (264 px au lieu de 452)** : photo 44, titre sur 2 lignes au plus, « compte … » en petit ;
   l'**état écrit UNE fois** (« Date limite de dépôt dépassée »), précédé d'un **point de ton** (gris = en attente, contour d'encre
   = délai dépassé, teal = en route, vert = livré/remboursé ; jamais orange ni rouge) — la pastille qui redisait l'état est
   retirée ; dessous, en une ligne : la date (« mer. 25 nov. · 5 h 21 ») · la phrase courte · « Pourquoi ? » (lien discret, son
   texte intact) ; la **frise courte** (cinq points reliés, sans libellé : la ligne d'état dit où il en est ; chaque point garde
   son nom et son détail pour le lecteur d'écran) ; le n° de suivi en ligne discrète (logo, un toucher = copié, 44 px) ;
   **UN bouton** (le geste de maintenant) + les autres gestes en **liens soulignés** à côté.
   Ordre des gestes (inchangé dans le fond) : délai dépassé ⇒ Vinted · Imprimer · Déposé ; à déposer ⇒ Imprimer · Déposé ·
   Vinted ; déposé par lui ⇒ Suivre · Déposé · Imprimer · Vinted ; ensuite ⇒ Suivre · Vinted.
   Plein seulement sur la carte principale de l'écran (la première qui attend SON geste, comme avant) ; au contour sinon.
2. **Retour terminé (remboursé) = une rangée repliée (66 px au lieu de 374)** : photo, titre sur une ligne, « ● Remboursé ·
   35,98 € · 20 nov. », chevron. La toucher (`<details>`) déplie : N° et compte, « Étapes d'avant faites, dates pas vues. Pourquoi ? »
   (dit UNE fois), la **frise détaillée** à libellés courts qui tiennent sur une ligne (Bordereau · Déposé · En route · **Reçu** ·
   Remboursé — nouvelle clé `rt.f.recu` en 5 langues), la date sous l'étape quand elle est LUE, le montant et sa date sous
   « Remboursé » (la ligne du résumé se tait quand c'est ouvert), le n°, Suivre (bouton) et Vinted (lien).
   « date pas vue » n'est plus écrit sous chaque étape : le rond au contour le montre, le lecteur d'écran l'entend par étape.
3. **« À vérifier » = une rangée (70 px au lieu de 124)** : photo, titre, « Sans nouvelles depuis le … » et « Réglé » (lien) sur la
   même ligne, « Vinted » (bouton au contour) à droite. Sans lien Vinted : « Réglé » devient le bouton.
4. **« ✓ » et « ⋯ » d'Achats** (src/ecrans/Comptabilite.jsx, src/App.jsx) : ils ne flottent plus seuls sous les étapes. La tête de
   la tâche (App.jsx) pose une place `data-achats-tete-place` à côté de « Retrouver » et « Arrivée » ; l'écran y rend les deux
   ronds par portail (mêmes composants, mêmes `data-achats-plus` / `data-serie-ouvrir`), même fond que leurs voisins dans chaque
   style (styles-achats-photos.css, fin). Sans place (design V2, retraits) : à leur place d'avant. À l'ordinateur, le « ⋯ » seul à
   droite au-dessus du tableau monte aussi dans la tête ; « ✓ » n'y est pas ajouté (le tableau a sa sélection).
   Choix : **déplacés, pas retirés** (ils ne doublonnent rien : Sélectionner ouvre la série, ⋯ ouvre Fournisseurs · Délai · Lots).

⚠️ Appris en route : le pont des contrôles natifs (`src/coque-native.css`, `:is(#vrm-contenu, html) .n-bouton { all: revert-layer }`)
efface toute règle hors couche posée sur un `.n-bouton` ou un `.n-bouton-icone-seule` (l'id l'emporte) — c'était déjà vrai pour
l'ancienne carte (ses hauteurs et contours n'étaient pas appliqués). Plein et teinté restent donc ceux de la couche du style ; seule
la forme LIEN (souligné, sans fond, 44 px) et les ronds de la tête portent quelques `!important` ciblés.

## Texte rendu comparé (même données, Monochrome 390 clair ; le reste à l'identique dans les 8 cas)

| carte | retiré de l'écran (redites) | ailleurs, pas perdu |
|---|---|---|
| Autry (délai dépassé) | pastille « Délai dépassé » (redisait l'état) ; « avant le 25 nov. » sous Déposé (redisait la date) | les 5 noms d'étape et « Chronopost » : pour le lecteur d'écran sur chaque point, et le logo du transporteur sur la ligne du n° |
| Nike (remboursé, replié) | pastille « Remboursé », « Remboursé · 35,98 € » en titre ET « Remboursé 35,98 € » sous l'étape (3 ⇒ 1) ; « date pas vue » ×2 (dit une fois dans la phrase) | déplié : frise, n°, « Pourquoi ? », Suivre, Vinted ; « Livré au vendeur » ⇒ « Reçu » |
| Salomon (à vérifier) | rien | « Vinted » et « Réglé » dans la même rangée |

Fichiers : `…/scratchpad/achats-retours/avant/textes.json` et `apres/textes.json` (banc, `BANC_TEXTES`).

## Preuves

- **Banc neuf `scripts/bancs/retours-cartes-compactes.cjs`** (mêmes données que `retours-renvoyer-suivi`, défaut ET Monochrome,
  390 tactile et 1512, clair et sombre) : K1 un état écrit une fois (texte VISIBLE), K2 aucun libellé de frise coupé, K3 un seul
  plein par carte et par section, K4 hauteurs (en cours ≤ 300, terminé replié ≤ 96, « À vérifier » ≤ 100 au téléphone) et rien
  ne déborde, K5 aucun geste perdu (Autry : Vinted, Imprimer, Déposé, « Pourquoi ? » ; Nike déplié : Suivre, Vinted ; Salomon :
  Vinted, Réglé), K6 « ✓ ⋯ » jamais seuls sur une ligne. **Rouge sur origin/main : 40 rouges** ; vert après.
  **Mutations** : la pastille remise ⇒ 8 rouges K1 ; tous les gestes en plein ⇒ 8 rouges K3 + 4 K4.
- Bancs mis à la nouvelle règle sans l'affaiblir : `retours-renvoyer-suivi` (R2 : l'état « Date limite de dépôt dépassée » au
  ton « délai dépassé » ET la pastille qui le redisait absente ; R4 : une rangée ≤ 100 px, les deux gestes ≥ 44 px dedans ;
  le Nike remboursé est déplié avant d'être lu) ; `retour-parfait` et `retours-litiges` (le remboursé est déplié avant d'être lu).
- Audits : boutons, boutons-natifs (A–E ; la partie navigateur ne charge pas dans ce conteneur, ni sur main), stockage-sur
  (mêmes rouges que main, rien d'ajouté), violet, icones, variables, tdz, coherence, traduction, quoi-de-neuf, studio,
  style-vintex, textes-courts, couleurs-anciens-ecrans, retour-parfait, retours-* : mêmes résultats que main.
- Planches AVANT/APRÈS : `/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/achats-retours/planches/`
  (`planche-{monochrome,defaut}-{390,1512}-{clair,sombre}.png`).

## Reste / à regarder

- C3 (`claude/style-c3`) n'existait pas encore sur le dépôt : tout est en jetons communs (`--n-*`, `--g-point`), il héritera.
- Ma journée (`ARenvoyerJournee`, `compact`) garde la même tête et le même bouton unique ; pas de frise (comme avant).
- Geste de Julien : regarder les planches ; dire s'il veut les noms d'étape visibles sous les points (aujourd'hui seulement
  sur un retour terminé déplié).
