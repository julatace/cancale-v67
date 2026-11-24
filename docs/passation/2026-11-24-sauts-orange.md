# 24 nov. · Les sauts de mise en page et l'orange qui restait (`claude/sauts-orange`)

Suite du robot « la journée de Julien sur iPhone » (`2026-11-24-parcours-iphone.md`, PR #1351) : il avait
TROUVÉ, sans les corriger, quatre sauts de mise en page et de l'orange encore visible. Base : la pointe de
`claude/parcours-iphone` (qui contient #1326), puis `claude/retours-suivi` (#1341), `claude/tutos-design` (#1320,
demandé par le coordinateur : il retire déjà l'orange d'Argent) et `main`. **Cette PR fusionne APRÈS #1326, #1341,
#1320 et #1351.**

## 1. Les sauts (P9 du banc `parcours-iphone`)

Mesurés avec une sonde (layout-shift + qui apparaît, qui change de hauteur), puis corrigés à la source. Règle suivie :
rien n'est caché (« un colis caché est un colis perdu »), « pas su » ne devient jamais « 0 ».

| écran | cause mesurée | correctif |
|---|---|---|
| **Achats, à l'arrivée** (CLS 0,53) | les achats lus seuls dessinaient « À vérifier » ; les e-mails de suivi lus ensuite ajoutaient « Mode relais » et la section des codes AU-DESSUS (+46 px, défilement décalé de ~320 px) | `src/ecrans/Comptabilite.jsx` : `retraitsPrets` — la colonne « À retirer » et « Mode relais » attendent les DEUX sources (e-mails de suivi ET achats). Pendant la lecture, la place dit « Je lis tes colis… » et TIENT une hauteur d'écran (sinon la liste des achats, dessinée dessous, était poussée hors de l'écran : CLS 0,58 vu au 2ᵉ passage) — sauf si la dernière publication `vrm_colis_retirer` disait 0 colis ; une lecture ratée dit « Réessayer » ; une attente trop longue (`colisAttenteLongue`) montre ce qui est lu (jamais un colis caché faute d'une seconde source). Même règle que la version « natif » (`QuandLuV2`). |
| **La loupe** (CLS 0,12) | « Dernières ventes » (déjà en mémoire) se dessinait seule, puis « Colis à retirer » (lu ensuite) arrivait au-dessus | `src/App.jsx` : les suggestions (colis, ventes, actions, aide) n'arrivent qu'une fois la lecture de la loupe faite (`gsData`), d'un coup ; avant, une ligne « Lecture… » à la marge du premier titre (aucun décalage de 16 px). |
| **Argent** (CLS 0,21) | « Tes seuils de l'année » (DAC7) se décide sur la ligne publiée par Ventes + le régime + « Compris » ; prête après le reste, elle s'insérait en tête | `src/ecrans/Compta.jsx` : prête à l'ouverture d'Argent ⇒ en tête, comme avant ; pas encore prête ⇒ elle prend sa place EN BAS du résumé (sous ce qui est déjà dessiné). À la prochaine ouverture, elle revient en tête. Jamais cachée. |
| **Fin d'Achats** (CLS jusqu'à 0,94) | deux causes : (a) la liste « À vérifier » se pose par paquets (`ParPaquets`) et chaque paquet poussait la suite (Safari n'ancre pas le défilement) ; (b) les blocs du bas (achats eBay, Leboncoin/Vestiaire, sources, « pour acheter », hors plateforme) montraient un squelette de 320 px remplacé par 76–184 px : la page raccourcissait sous le doigt | (a) `src/composants/ParPaquets.jsx` : la sentinelle TIENT la place des rangées pas encore posées (hauteur moyenne mesurée × reste) ; (b) ces blocs passent en `aLaDemandeDiscret` (rien pendant le chargement, la règle du 17 nov. « jamais un squelette au milieu d'une liste »). |

`SAUTS_CONNUS` du banc : **vidée de tout ce qui est corrigé** ; un saut qui revient sur ces écrans est ROUGE.

## 2. L'orange (décision de Julien du 23 nov. : aucun orange ni ambre, jour ET nuit ; rouge au seul doublon)

- **646 couleurs orange/ambre écrites à la main** (et 14 « or terne » de plus après élargissement de la règle : le liseré
  `rgb(178 106 0 / .5)` de la **carte d'offre Vinted de Messages** — signalé par le coordinateur, compté dans les 646 —, #AD9658
  de la raison d'un bordereau, le kraft doux des étiquettes N°) dans `src/` (feuilles des écrans d'hier, palettes JS, repli
  `var(--x, #B25000)`), plus 13 dans les pages publiques (`public/` : aide, état, statut, mentions, récupération).
- Codemod refait une fois (v2) après relecture : la v1 réécrivait aussi les commentaires et posait l'ardoise sombre sous un
  texte sombre (étiquette kraft du N°, pastille de la barre d'onglets). La v2 laisse les commentaires, suit le contexte nuit
  bloc par bloc, envoie une teinte claire (clarté ≥ 60 %) vers `--n-ambre-fond`/`--n-ambre-bord`, et met `--n-sur-ambre` sous
  tout texte posé sur un aplat `--n-ambre`.
- Remplacées par les jetons de `src/natif/jetons.css` : `var(--n-ambre)` (l'ardoise #3D4B5B le jour, l'encre claire
  #F4F4F5 la nuit), `--n-ambre-fond` pour les teintes pâles, `color-mix(… N %, transparent)` pour les transparences, et
  `--n-sur-ambre` pour un texte blanc posé sur un aplat. Palettes : `themeMineral.js` (nuit : `warn`/`danger`/`gold`
  #FFC266 → #F4F4F5), `App.jsx` (deux palettes d'hier), `accueil-jetons.js`. Code mort retiré : `Box`/`Door` (garage 2D
  jamais rendu, plein d'orange).
- **Exceptions NOMMÉES** (marqueur `orange-permis : <raison>` sur la ligne, ou `orange-permis-fichier` en tête) : les
  MARQUES (logos des transporteurs `transporteursVisuels.js`, Leboncoin, eBay `natif/logo-site.css`, Google), les objets
  réels du stock 3D (parquet, carton kraft : `Room3D.jsx`, meubles du garage), les couleurs choisies par lui (sa
  facture, un visuel, la couleur d'une paire `couleurPhoto.js`).
- **Audit** `scripts/audit-sans-orange.cjs` (règle partagée `scripts/_couleurs-orange.cjs` : teinte 15–55°, clarté 15–96 %,
  saturation ≥ 40 % — ou ≥ 25 % jusqu'à 85 % de clarté, l'or terne) : chaque source de `src/` et `public/`, hors commentaires. Avant : **646 refus** ; après : 0.
  Mutation : un `.x{color:#B25000}` ajouté ⇒ rouge ; la règle affaiblie (teinte ≤ 16°) ⇒ rouge (témoins).
- **Banc rendu** `scripts/bancs/sans-orange.cjs` : chaque écran principal (Aujourd'hui, Annonces, Ventes, Achats,
  Argent, Statistiques, Stock, Messages, Paramètres et CHACUNE de ses sections, la loupe vide et avec un N°), 390 tactile
  et 1512, clair et sombre ; couleur CALCULÉE de tout ce qui se voit (texte, fond, bords, contour, ombre, dégradé,
  fill/stroke SVG, ::before/::after). Écartés : logos (`[data-transporteur-logo]`, `.n-logo-site`, `[data-logo]`), photos.
  Ouvre aussi Messages → « Offres » → une conversation (`SEULEMENT=messages` pour ce seul passage). ⚠️ La base inventée n'a
  aucune offre EN ATTENTE : la carte d'offre (`.vrm-chat-offre`) n'est pas rendue par le banc — c'est l'audit des sources qui
  tient son liseré. Avant (390 clair, build intermédiaire) : rouge sur Paramètres « Tout va bien ? Pas tout à fait »
  (#5E3900) et le logo Google (marque, depuis `data-logo`).

## 3. Les trois petits défauts vus sur les captures

- **Aujourd'hui** : la pile de photos de « 75 € vendu dimanche » débordait de son bouton (vignettes de 68 px pour un
  bouton de 84 × 64) et touchait le bord et la fin de la phrase ⇒ vignettes de 52 px dans le bouton, 16 px d'air
  (`src/design/verre-journee.css`).
- **Argent « 6 derniers mois »** : « Les saisir » (bouton de 44 px) DANS la phrase écartait ses deux lignes ⇒ le bouton
  a sa rangée sous la phrase (même bouton, même `data-fu-mois6-porte`).
- **Fiche d'une vente** : « Vendu » et « Pour toi » pas à la même hauteur (une case centrée à côté d'une case avec
  légende) ⇒ les `Fait` se posent en haut de leur case (`src/natif/natif.css`).

## 4. Trouvé par le lot tutos : URSSAF, « J'ai déclaré » sur « avant le 30 nov. »

Argent pas encore calculé (ventes pas lues) et statut choisi : la carte URSSAF n'a ni montant ni pied, et « J'ai
déclaré » (posé en bas à droite) couvrait l'échéance. Reproduit (sonde : `CHEVAUCHE 109×14` sur l'ancien build).
Correctif `src/design/verre-ecrans.css` : sans pied, le bouton a sa rangée sous le contenu. Banc `parcours-iphone`,
étape 14 « argent-pas-calcule » (lectures des ventes en panne, statut micro) : l'état voulu est vérifié (bouton montré,
pas de pied), puis **P7 bis** — le bouton ne couvre aucun texte de sa carte.

## Preuves

- Avant / après : `BANC_DIST` = build de la base (`origin/claude/parcours-iphone` + fusions, avant correctifs).
- Mutations : voir chaque section (audit, P7 bis, `SAUTS_CONNUS`).
- Bancs lancés : `parcours-iphone`, `sans-orange` (390/1512, clair/sombre), `textes-visibles`, voisins (`recherche-partout`,
  `ventes-verre`) ; `npm run build`. Les résultats exacts sont dans la PR.
- Machine partagée (≈ 13 agents, charge 7 à 46 par cœur, mémoire et disque au plus bas) : un build a été tué par le
  manque de mémoire ; P10 (vitesse) n'est que rapporté ici.

## Ce qui reste

- L'extension (`vinted-sync-extension/`, la carte posée sur vinted.fr) n'a pas été passée à l'audit : elle a sa
  propre version et son zip (§6) — à faire dans le train de l'extension.
- Aujourd'hui : « 28 colis pressés » arrive après la première image et pousse l'écran (vu sur les captures, hors de la
  liste du robot ; même famille, à traiter comme Achats).

## Geste de Julien

Aucun.
