# 23 nov. · Lot E — Objectif du mois : ce qu'il reste, en € et en ventes moyennes (`claude/objectif-mois`)

Julien (validé le 23 nov.) : « objectif de bénéfice du mois saisi par lui ; Aujourd'hui montre la progression et ce
qu'il reste (en € et en ventes moyennes), d'après le bénéfice réel avec sa couverture (« au moins … », prix d'achat
manquants nommés) — jamais un chiffre inventé ».

## Ce qui existait (mesuré dans le code avant de coder)
- `src/objectifMois.js` (4, 11, 14 nov.) : un réglage `vrm_objectif_mois`, quatre mesures (vendu, reçu, bénéfice brut,
  ventes), la progression (`progressionObjectif`), le reste et le rythme (`resteObjectif`), l'anneau de Ma journée.
- MAIS l'écran Aujourd'hui « natif » (19 nov.) ne montrait que « 1 840 € / 3 000 € · 61 % · il reste 11 jours » et sa
  feuille ne savait poser qu'un objectif de **vendu** (« CA vendu à atteindre ce mois ») : le bénéfice ne se
  choisissait plus nulle part sur Aujourd'hui, et ce qui reste n'était pas dit.

## Ce qui est fait
1. **La règle** `resteEnVentes(prog, { n, nCout })` (src/objectifMois.js) : le reste de `resteObjectif` divisé par la
   moyenne DU MOIS sur les ventes qui portent le chiffre — bénéfice : la case « Bénéfice brut » ÷ les ventes au prix
   d'achat CONNU (`nCout`, publié désormais par `valeurChiffre('brut')`) ; vendu : ÷ le nombre de ventes du mois lu
   en entier. Arrondi vers le HAUT ; moins de 3 ventes ⇒ aucune moyenne ; « au moins » ou prix manquants ⇒ « au
   plus » ; les ventes sans prix d'achat COMPTÉES (`sansPrix`) ; atteint ⇒ 0 ; pas su ⇒ rien.
2. **Aujourd'hui** (`src/natif/ecrans/Aujourdhui.jsx`, `src/aujourdhui/Branche.jsx`) : sous la barre, une ligne
   « encore 760 € · ≈ 8 ventes moyennes · 3 ventes sans prix d'achat » (data-objectif-reste, -ventes-restantes,
   -sans-prix, -au-plus) ; la feuille « Objectif du mois » propose **Vendu · Bénéfice** (Segmente) — un objectif
   déjà posé en ventes ou en reçu garde sa mesure.
3. Textes `objr.*` en 5 langues (`src/i18n/langues/*/objectifReste.js`), « Quoi de neuf » `objectif-reste-ventes`.

## Preuves
- `node scripts/audit-objectif-reste.cjs` : 26 contrôles verts ; `--prouve` : 8/8 mutations rougissent (arrondi vers
  le bas, moyenne sur toutes les ventes, moyenne sur 1 vente, « au plus » oublié, prix manquants tus, atteint ignoré,
  `n` au lieu de `nCout`, type ignoré). Sur le code d'avant : rouge (la règle n'existe pas — ET les mutations prouvent
  la règle, pas son nom).
- `audit-objectif-mois` (64 verts), `audit-securite-ventes`, `audit-traduction`, `audit-quoi-de-neuf` : verts.

## ÉTAT À LA REPRISE
- Code poussé sur `claude/objectif-mois`. Build, bancs (`aujourdhui-natif`) et captures 390/1512 : après 15:30 UTC
  (consigne du jour : aucune commande lourde avant), puis PR, puis fusion demain après 07:00 UTC.
- La ligne CLAUDE.md §9 s'ajoute au moment de la fusion (le fichier est à 59,5 Ko : déplacer d'abord les plus
  anciennes lignes du §9 dans `historique-divers.md`).
- Geste de Julien : aucun.
