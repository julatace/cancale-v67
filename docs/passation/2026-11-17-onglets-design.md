# 17 nov. 2026 — lot `onglets-design` : disposition des onglets, inventaire + proposition A « sobre »

Demande de Julien (17 nov.) : « je veux que tu améliores la disposition des onglets et le design, car ce n'est
pas optimal, on peut faire mieux ». Trois propositions sur trois branches : A « sobre » (celle-ci,
`claude/onglets-design`), B « iOS natif » (`claude/onglets-design-b`), C « Studio » (`claude/onglets-design-c`).
**Rien n'est fusionné, aucune PR** : Julien choisit sur les planches, puis on fait la version finale prouvée.

## ÉTAT À LA REPRISE
- Inventaire des défauts (30 points, captures 390/1512 clair/sombre de `origin/main` sur base inventée) :
  scratchpad `onglets/inventaire.md` (recopié dans le rapport de l'agent).
- Proposition A implémentée DERRIÈRE UN RÉGLAGE DE BANC, invisible chez Julien :
  - `src/design/ongletsBanc.js` : `?banc_onglets=a` ⇒ `data-onglets="a"` sur la racine, SEULEMENT si
    `vrm_banc_vends` (posé par les bancs) est là ; appelé en tête de `src/main.jsx`.
  - `src/design/onglets-a.css` : tout sous `:root[data-onglets="a"]`, dans `@layer vrm-onglets`, nommée la
    PREMIÈRE dans `index.html` (pour un `!important`, la première couche gagne : aucune course aux `:root`).
- Captures : scratchpad `onglets/cap.cjs` (REPO, BANC_DIST, SHOTS, PROPO, SANS_TOAST) ; planche :
  `onglets/planche.py`.

## Ce que A change (5 lignes)
1. Une seule forme de segment partout (sites, états de Ventes et d'Achats, Annonces·Stock, Argent) : piste
   translucide fine, l'actif = touche porcelaine pleine ; plus aucune diode bleue sur un segment.
2. Compteurs discrets : chiffres simples sans capsule ; le segment allumé et l'onglet allumé de la barre ne
   répètent plus leur nombre (la page le dit déjà).
3. Rangées de filtres (comptes, vues) : la même touche en 36 px dessinés (44 au doigt), sans bord, fondu au
   bord droit quand elles défilent ; sites à la largeur de leur contenu.
4. Barre du bas : libellés 11 px sans saut de graisse, pastilles 16 px, disque « + » rentré dans la barre.
5. Un seul titre d'écran (34/700 téléphone, 28/700 ordinateur) ; le rond « Retrouver » en double de la loupe
   quitte la ligne du titre au téléphone (même geste : disque + → Scanner).

## Si Julien choisit A
Passer les règles de `onglets-a.css` hors du réglage (les écrire dans les feuilles des composants :
`SegmenteBase`, `PlatSubNav`, `vv-seg`, barre), retirer `ongletsBanc.js`, banc qui mesure : une seule forme de
segment (même hauteur, même fond actif) sur les 5 écrans, aucune diode sur un segment, aucun nombre répété
entre la barre et le segment allumé, aucune rangée coupée sans fondu, titres identiques.
