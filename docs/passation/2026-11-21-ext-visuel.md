# 21 nov. — Ext. 5.427 : le visuel du panneau « comme Vintex, 2ᵉ jet » (`claude/ext-visuel`)

Julien, sur les captures du panneau 5.420–5.423 : « le visuel doit être mieux que ça ». Capture de référence de ce qui
n'allait pas : la feuille « Message aux favoris » à 390 (Orion) — étapes tronquées « Séle… Rédu… Mess… », plaque N°
beige énorme avec un œillet qui poussait le titre, titres de rangée à 17–18 px, bandeau « VRM travaille dans un onglet
vinted.fr en arrière-plan /items/…/edit » technique et gros, « Retirer » en texte nu, fonds gris lourds, vignettes roses,
« (voir pourquoi) » en lien brut, « Annuler » gris plat à côté d'un plein noir énorme.

Direction : la même que celle validée pour l'app, `docs/design/iphone-2026-11-21/vintex-vrai-2/` (branche
`claude/design-iphone`) et la planche 6.

## Ce qui est fait (présentation SEULE : aucun geste, aucune règle, aucun garde-fou ne change)

Le travail vit presque entièrement dans DEUX couches de style posées à la FIN des feuilles, pour que les fusions avec
les autres chantiers du panneau (5.421–5.426) restent simples :

- `vinted-sync-extension/vrm-badge.js`, fin du `<style>` : bloc `/* ══ 5.427 — « COMME VINTEX, 2ᵉ JET » … */` →
  `/* ══ fin 5.427 ══ */`. Il redéfinit les jetons `--n-*` du grand panneau (fond `#F1F3F6`, surfaces blanches à ombre
  douce, contours `#E4E4E7`, filets `#EEF0F2`, encre `#16181D`, gris `#5F646C` / `#6E737B` — contrastes ≥ 4,5:1 —,
  étiquettes pastel franches vert / ambre / gris / teal, nuit `#0E0F11` / `#17181B`) et l'échelle (titre d'écran 18,
  20 au téléphone ; texte 14 ; méta 12 ; titres de rangée 14), puis :
  - **contrôles dessinés à 36 px dans une cible de 44 px** : bordure transparente de 4 px en haut et en bas +
    `background-clip: padding-box` + contour en ombre intérieure 1 px (la boîte mesurée reste 44 : les bancs « cibles
    ≥ 44 px » sont inchangés) ; rayon `8px / 12px` (= 8 px visibles) ;
  - le **plein** à l'encre, compact, sans halo ; le **secondaire** blanc à contour ; segments et filtres en **puces à
    contour**, la choisie enfoncée ; champs blancs à contour (16 px au téléphone, pas de zoom d'Orion/Safari) ;
  - **plaque N°** : 20 px, 12 px, gris très clair, encre — plus de kraft, de coin coupé ni d'œillet (aussi dans la
    petite carte : `.plaque`) ;
  - **étapes des favoris** : à l'ordinateur pastilles numérotées + nom entier ; au téléphone (≤ 560 px) une **barre de
    progression fine de 4 segments** (vert sapin pour faite / en cours) et « Étape 1 sur 4 · Sélection » dessous —
    plus aucun libellé coupé ; les 4 `li[data-fav-etape-pas]` restent dans le DOM ;
  - **feuilles** : poignée au téléphone, **titre et × alignés** sur une ligne (`header.fe6-h`, titre `fe6_confirmer` /
    `fe6_auto` / `fe6_stats`), fond blanc ; **pied collant** (filet dessus) avec les deux boutons **à la même hauteur**
    (le `margin-top: 10px` de `.fl-recap .vu-plein` décalait « Suivant » de 5 px — mesuré, retiré dans le pied) ;
  - **« Retirer »** = un ✕ discret de 44 px (son `aria-label` « Retirer {qui} » reste) ;
  - **« N favoris seront sautés »** : une rangée à chevron (`<details>`), le texte « (voir pourquoi) » retiré des 5 langues ;
  - **onglet de travail** : UNE ligne discrète dans la tête « ● Onglet de travail actif · Voir » (le chemin reste dit à
    l'ordinateur, et en info-bulle ; le texte complet reste l'`aria-label` de « Voir ») — clés `cb_onglet_court`,
    `cb_onglet_libre_court`, `cb_voir_court` (5 langues) ;
  - tableaux : carte blanche à contour, rayon 12, ombre douce ; étiquettes 20 px ; vignettes neutres ; barre du bas
    10,5 px, l'onglet actif en vert sapin ; barre latérale 14 px.
- `vinted-sync-extension/vrm-ui.js` (feuille commune) : jetons JOUR/NUIT (fond teinté, filets fins, gris lisibles, kraft
  → gris très clair) et une couche finale `/* ══ 5.427 — feuille commune … */` : `.vu-n` fine (20 px ; `vu-grand`
  22 px), `.vu-btn` rayon 8 / 14 px / 500, `.vu-plein` 44 sans halo, `.vu-sec` blanc à contour, segmenté léger.
- `vinted-sync-extension/vrm-action.js` (écran plein) : titre 20, compteur 28, photo 96, texte 13–14, plein compact,
  secondaire à contour, anneau de focus fin.
- `vinted-sync-extension/popup.html` : fond teinté, groupe à contour et ombre douce, titre 20, texte 14, plein à l'encre
  rayon 8, secondaire à contour.
- Bancs : la vignette de banc (un pixel ROSE servi pour toutes les photos inventées) est devenue un gris neutre
  `#D9DCE1` dans les 9 bancs du panneau — c'était le « placeholder rose » des captures, pas l'extension.

Version **5.427.0** (manifeste, `CODE_VERSION`, capteur/relais Leboncoin, `EXT_ATTENDUE`, `extension-version.json`).
Zips NON régénérés (consigne). `claude/ext-5421` et `claude/ext-5423` fusionnées (vrais merges, capacités réunies).

## Pas fait / à l'intégrateur

- **`claude/ext-5422` n'est PAS fusionnée ici** : elle entre en conflit de LOGIQUE avec la 5.423 dans l'atelier
  « Republier » (`atelierEtatHtml`, bouton « Lancer » : la 5.423 ouvre d'abord la feuille Avant | Après, la 5.422 ajoute
  « Programmer à … » et sa confirmation). Ce n'est pas du style : à trancher à l'intégration. Ses écrans utilisent les
  mêmes pièces (`geste6`, `rg6`, `vu-seg`, `prix6`, `conf5`, `pied6`) : ils prendront la couche 5.427 sans rien changer.
- `claude/ext-5424`, `-5425`, `-5426` étaient encore « en cours » au moment de la fusion : non fusionnées. Même remarque :
  leurs écrans dessinés avec les pièces communes suivent la couche.
- Au téléphone, les rangées d'Articles gardent la ligne méta SOUS la vignette (prix · date · étiquette, puis vues /
  favoris) : un titre court laisse un blanc sous lui. Mettre le prix à droite du titre, comme la planche, demande de
  toucher le gabarit de la rangée (`tr6` / `cels6`), donc les bancs de rangées ; laissé pour un lot dédié.
- Le banc `extension-surfaces` était déjà rouge sur l'arbre d'avant (K : tête de la petite carte, jauge, segmenté ;
  C : « À connecter à VRM » 1,13:1 ; une exception) — mêmes rouges après, aucun de plus (comparé ligne à ligne).

## Preuves

Voir la fin de ce fichier (résultats des bancs et audits) et les planches AVANT / APRÈS dans le scratchpad de la session.
