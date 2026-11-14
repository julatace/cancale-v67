# 14 nov. 2026 — Studio bleu clair : la FONDATION

Julien a choisi la direction t25 « Studio bleu clair » (Spatial × Bento × Aplats × Lumière) : bleu clair
partout, quatre formes de bouton, « aucun bouton moche ou inutile », « tout doit être parfait, tu peux
changer les dispositions ». Plusieurs chantiers appliquent le design aux écrans EN MÊME TEMPS ; ce lot pose
ce sur quoi ils comptent : les NOMS du contrat, la coque, les primitives partagées, les règles et les
contrôles. Spec chiffrée : `docs/design/studio-bleu-clair.md` (la note de la direction, sans photo ni
donnée réelle, + le contrat des noms). Branche `claude/studio-fondation` (depuis `claude/integration-refonte`).

## Ce qui change à l'écran

- **Le fond** : la lumière du studio sur toute la coque — un halo blanc en haut à gauche, puis
  `#EEF6FD → aplat (40 %) → #C6DDF0` (la nuit `#15263D → #0C1829 → #060E19`). L'aplat bouge de ±2 points
  par espace (`data-espace` sur la coque, `<main>` et la racine de chaque écran gardé). La barre d'état du
  téléphone prend le HAUT de la lumière (`theme-color`).
- **La barre du bas (téléphone)** : du verre dépoli flottant (64 px, rayon 26, à 12 px des bords), le
  contenu passe dessous avec un fondu de 132 px ; l'espace actif est une **pastille enfoncée 46 × 30 avec
  sa diode**, qui glisse d'un onglet à l'autre ; au centre, le **disque « + »** (rond 60 monté de 16 px).
- **Le disque ⇒ l'éventail** : appui (au toucher, pas au relâcher) ⇒ l'écran recule (0,94, flou léger)
  sous un voile de bleu éclairé par le bas, quatre gestes en arc : **Chercher · Scanner · Publier ·
  Imprimer N** (le seul plein, sous le pouce droit). On touche, ou on GLISSE le pouce du disque et on
  relâche. Chaque geste est un geste qui existait : la loupe ; le scanner de bordereau de Ventes (nouvel
  évènement `vrm:scanner`, `DEMANDE_SCAN`) ; « Publier ailleurs » ; « Imprimer les bordereaux du jour »
  (la feuille Tout imprimer — rien n'est imprimé avant SON clic). **N = le nombre de « Tout imprimer (N) »**
  de Ventes : Ventes le publie désormais dans `vrm_colis_prets.lot` (`resumeLot(...).partent`, la même
  source que son bouton) ; pas su ⇒ « Imprimer » sans nombre ; 0 lu ⇒ le plein grisé, « rien de prêt ».
- **L'ondulation** au changement d'espace : un anneau de lumière part de l'onglet touché (560 ms), le
  contenu entre de 12 px en fondu (320 ms) ; mouvement réduit : un fondu seul, aucun anneau.
- **L'en-tête (téléphone)** : transparent sur la lumière, en verre au défilement ; loupe et cloche en
  ronds posés de 44. La loupe reste dans l'en-tête (20 bancs la visent, Julien l'a voulue là) : « Chercher »
  de l'éventail ouvre LA MÊME.
- **L'ordinateur** : la colonne de gauche en verre (rayon 26), l'entrée active enfoncée avec sa diode (la
  pastille qui glisse d'hier prend le creux) ; la barre de recherche collée en haut est du verre sur la lumière.
- **Toute l'app d'un coup** : la famille `--d-*` (que styles-systeme et toutes les familles lisent) LIT
  le studio ; `themeMineral.js` (les `C.*` écrits en ligne) a la même palette. Les boutons d'hier passent
  aux quatre formes : `primaire` → l'encre (le plein en barre), `secondaire`/`danger` → la touche,
  `discret` → le lien, icône → le rond ; segmentés → plateau (choisi enfoncé + diode) ; filtres → touches ;
  le N° (`.vrm-num`) → la **plaque gravée** (doublon : texte et anneau rouges, le seul rouge ; « à vérifier »
  ambre) ; recherches → creusées ; feuilles → porcelaine ; titres d'écran → Urbanist 400.
- **Les polices** : Urbanist (affiche) + Inter (texte), variables, sous-ensemble latin (28 + 48 Ko),
  embarquées (`src/design/polices/`, `npm pack` @fontsource-variable 5.3.0, empreintes vérifiées, licence
  OFL jointe), `font-display: swap`, préchargées seulement avec le morceau de l'app (`src/design/polices.js`).
- **`src/ui`** (Ligne, Feuille, BandeChiffres, Filtres, BarreOutils, MenuCompte, LigneAFaire, AFaire) :
  classes du studio dans le JSX et leur dessin (ui.css, section Studio) — filtre/menu = touche, icône = rond,
  « À faire · N › » = lien, champ creusé, feuille porcelaine sous un voile de bleu, bande en Urbanist 300,
  rangée 64 avec vignette posée.

## Idées 149 et 150 de Julien (ajoutées en cours de lot)

- **149 · Densité au choix** : Paramètres → Affichage → **Densité des listes** : Serrées (rangées de 56 px,
  12 paires ou plus sur un iPhone), Normales (64, le Studio), Aérées (72, 8 paires). Un réglage **par appareil**
  (`localStorage` `vrm_densite`, try/catch ; jamais le nuage), `src/design/densite.js`. La racine porte
  `data-densite` — posée AVANT le premier rendu par `public/demarrage-theme.js` (aucun saut) — et studio.css en
  tire `--sb-rangee-h`, que `.sb-rangee` lit, ainsi que `--d-h-rangee` (les listes d'hier : Messages, E-mails,
  Stock, Achats) et la rangée de `src/ui` (`Ligne`). La rangée entière reste la cible (56 ≥ 44 px).
- **150 · Sombre le soir tout seul** : le choix « Le soir » devient **« Automatique (le soir) »** (et
  « Automatique » devient « Comme l'appareil ») : sombre du **coucher au lever du soleil**, calculés sur
  l'appareil (formule astronomique simple — jour de l'année, ville du FUSEAU de l'appareil, 19 villes ;
  aucune position demandée) ; fuseau sans ville ⇒ 20 h → 7 h. `src/apparence.js` (`soleil`, `estLeSoir`) et sa
  COPIE dans `public/demarrage-theme.js` (avant le premier rendu : pas de flash) ; l'app la revoit **chaque
  minute** dans un état qui ne change que si la teinte change (aucun rendu, aucun clignement). `vinted_dark`
  reste la vérité d'un choix explicite. `audit-apparence` : les deux copies donnent la même teinte sur
  6 912 entrées (4 fuseaux × 48 demi-heures × modes × anciens choix × système), Paris le 8 nov. lever ≈ 7 h 50 /
  coucher ≈ 17 h 15, le 21 juin coucher ≈ 21 h 58 ; 10/10 mutations rougissent. Libellés par `tr()` (5 langues).
- Banc `scripts/bancs/studio-reglages.cjs` : densité (56 · 64 · 72, nombre de paires visibles, posée avant
  React, choix dans Paramètres) et « Automatique (le soir) » (22 h sombre et 12 h clair dès le premier rendu,
  jamais l'autre teinte entre-temps ; bascule toute seule au coucher ; Paramètres le dit).

## Fichiers

`src/design/studio.css` (jetons, formes, composants, coque — importé EN DERNIER par App.jsx),
`src/design/studio-polices.css`, `src/design/polices/*`, `src/design/polices.js`, `src/design/espace.js`,
`src/design/DisqueEventail.jsx`, `src/design/ondulation.js`, `src/themeMineral.js`, `src/App.jsx` (import,
BottomBar : disque + pastille 46 × 30 + ondulation, gestes du disque, `data-espace`, `vrm:scanner`,
`vrm_colis_prets.lot`, `theme-color`), `src/ecransGardes.jsx` (`data-espace` à la racine de l'écran gardé),
`src/ui/*`, `src/i18n/langues/{fr,en,es,it,de}/studio.js`, `src/nouveautes.js`.

## Les noms du contrat (pour les chantiers d'écran)

Jetons `--sb-haut --sb-bas --sb-aplat --sb-porcelaine(-2) --sb-creux --sb-verre --sb-encre(-2) --sb-diode
--sb-lien --sb-ambre(-point) --sb-doublon --sb-o --sb-ombre-pose/-plan/-avant --sb-r-* --sb-police-* --sb-e-*`.
Formes `.sb-btn-plein(--barre) .sb-touche .sb-rond(--disque) .sb-lien` (+ diode automatique sur
`aria-pressed`/`aria-current`/`.is-actif`/`.is-en-cours`). Composants `.sb-plaque(.is-double, --grande,
--ouverte) .sb-tuile[data-taille] .sb-tuile-plus .sb-douille .sb-bento .sb-rangee(-titre/-meta/-chiffre/
-echeance) .sb-vignette(--tuile/--ouverte) .sb-bande .sb-chiffre-affiche(--tuile/--moyen/--bande) .sb-eur
.sb-prix .sb-feuille .sb-barre .sb-disque .sb-eventail .sb-lame .sb-voile .sb-segment .sb-champ .sb-avant
.sb-plan .sb-recul .sb-fond .sb-ecran-titre .sb-surtitre .sb-onde`. `data-espace` : `espaceDe(tab)`.
Un fichier d'écran dont tous les boutons sont aux quatre formes s'ajoute à `MIGRES` dans `audit-studio.cjs`.

## Preuves

- `npm run build` vert.
- Audits verts : traduction, tdz, variables, coherence, composants, icones, violet, rouge-doublon,
  identite, csp, quoi-de-neuf, **studio** (`--prouve` : 13/13 mutations rougissent).
- Banc `scripts/bancs/studio-coque.cjs` (390 tactile et 1512, clair et sombre) : voir « Résultats ».
- Bancs demandés : voir « Résultats ».

## Résultats

(complété en fin de lot)

## Ce qui reste (aux chantiers d'écran)

- Ma journée garde sa carte héros sombre (son chantier la remplace par les tuiles de porcelaine).
- Un seul plein par écran : c'est l'écran qui le pose (`.sb-btn-plein`) ; aujourd'hui « Tout imprimer » de
  Ventes est un `primaire` d'hier dessiné à l'encre (en barre).
- `design-passe.cjs` connaît l'échelle et les graisses du studio (Urbanist 200/300, méta Inter 500) et son aplat.
