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

## Idées 149 et 150 : commencées, puis RETIRÉES (Julien ne les a pas retenues)

La densité des listes au choix (149) et « Automatique (le soir) » au coucher du soleil (150) ont été
construites puis retirées proprement le même soir (`git revert` du commit, banc `studio-reglages` supprimé,
textes retirés des cinq langues). Restent : UNE hauteur de rangée du Studio (64 px, `.sb-rangee`) et les
choix d'apparence d'avant (Clair · Sombre · Automatique · Le soir, `src/apparence.js` inchangé). Seul le
`theme-color` du script de démarrage a gardé les couleurs du Studio (le haut de la lumière).

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

## Résultats (refaits APRÈS le retrait des idées 149-150, sur la branche fusionnée avec l'intégration)

- `npm run build` vert. **Écrans** : 44 lignes `tab===` avant et après, 31 écrans montés `{tab==='…'}` (21
  distincts), identiques à `origin/claude/integration-refonte` (§4.11).
- **Audits** (13) verts : traduction, tdz, variables, coherence, composants, icones, violet, rouge-doublon,
  identite, csp, quoi-de-neuf, studio, apparence. `--prouve` : studio 13/13, apparence verte, traduction 12/12.
  (`audit-quoi-de-neuf --prouve` : 2 mutations « introuvables » — leurs motifs n'existent plus dans
  `src/nouveautes.js` depuis l'intégration, sans lien avec ce lot.)
- **studio-coque : 78 verts, 0 rouge** (390 tactile et 1512, clair et sombre) — fond, verre, pastille 46 × 30 +
  diode, disque ⇒ éventail ⇒ Chercher / glisser ⇒ loupe, Scanner ⇒ scanner de Ventes, Publier ⇒ Publier
  ailleurs, Imprimer ⇒ feuille Tout imprimer avec **N = « Tout imprimer (N) »**, voile qui referme, loupe de
  l'en-tête au toucher, ondulation sur les quatre espaces (et aucune en mouvement réduit), contrastes AA ≥ 4,5:1
  mesurés (barre sur le verre posé sur le bas, titre, éventail sur le voile, mot du plein, navigation 1512),
  rien ne déborde, un plein au plus. Sur le build d'AVANT : **10 rouges** (le banc mord).
- **garde-ecrans** vert · **accueil-reste** vert · **exemple-photos** vert · **refonte-listes** vert (forme ;
  volume vert au passage complet). Le banc refonte-listes connaissait l'encre #1D1D1F d'hier comme « nom de
  paire » : il connaît aussi celle du Studio (sinon chaque titre de paire comptait comme une phrase répétée).
- **ouverture-instantanee** : 19 verts, 1 rouge (« 2e ouverture < 1 s » à CPU ×4 sur une machine chargée ×5 :
  1 044 ms) — le MÊME rouge sur le build d'AVANT (machine partagée), sans lien avec le Studio.
- Captures regardées (390 et 1512, clair et sombre : Ma journée, Ventes, Annonces, Argent ; l'éventail ; la
  feuille Tout imprimer) : une seule lumière, la porcelaine et la plaque partout ; Ma journée garde sa carte
  sombre (son chantier) ; les N° posés sur les photos de la grille d'Annonces restent en plaque sombre
  (lisible sur photo ; à son chantier).

## Ce qui reste (aux chantiers d'écran)

- Ma journée garde sa carte héros sombre (son chantier la remplace par les tuiles de porcelaine).
- Un seul plein par écran : c'est l'écran qui le pose (`.sb-btn-plein`) ; aujourd'hui « Tout imprimer » de
  Ventes est un `primaire` d'hier dessiné à l'encre (en barre).
- `design-passe.cjs` connaît l'échelle et les graisses du studio (Urbanist 200/300, méta Inter 500) et son aplat.
