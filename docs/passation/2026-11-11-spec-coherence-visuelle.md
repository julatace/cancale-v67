# Spec de passation — lot « cohérence visuelle » (11 nov. 2026)

Pour l'agent qui fera le lot de fin de journée. Mesures prises sur `main` (audit design-system du
11 nov.). Lire aussi `DESIGN.md` et `src/themeMineral.js` (la palette ne change PAS : §3 « Palette »,
§7 : une seule couleur d'accent, rare ; ambre = geste à faire ; rouge = deux paires sous un N°).
Attendre le rapport `docs/passation/2026-11-11-revue-design.md` (revue design en cours) et en
reprendre les points P1 avant de commencer.

## But
Que tous les écrans soient « pareils » : mêmes tailles de texte, arrondis, marges, ombres,
mouvements. **Aucune refonte, aucun écran retiré, aucun texte changé** : on rabat des valeurs.

## Jetons à poser (CSS `:root` dans `src/styles-vitrine.css` + objet exporté pour le JS)

| jeton | valeur | usage | remplace |
|---|---|---|---|
| `--t-11` … `--t-34` | 11 · 12 · 13 · 15 · 17 · 22 · 28 · 34 px | texte (légende → grand chiffre) | 7,5 · 8 → 11 ; 11,5 → 12 ; 12,5 → 13 ; 14 → 13 ou 15 (selon rôle) ; 16 → 15 ; 18/19 → 17 ; 20 → 22 |
| graisses | 400 · 500 · 600 · 700 | corps · libellé · titre · chiffre | 650 → 600 ; 800 → 700 |
| `--r-petit` 6 · `--r-carte` 12 · `--r-feuille` 20 · `--r-pilule` 999 | arrondis | 2/3/4 → 6 ; 8/9/10/13/14 → 12 ; 16/18/22/24 → 20 ; 99 → 999 |
| `--e-4` … `--e-32` | 4 · 8 · 12 · 16 · 20 · 24 · 32 px | marges et espacements | toute valeur hors échelle → la plus proche |
| ombres | `C.shadow` (none) · `C.shadowMd` (île flottante) · `C.shadowLg` (feuille) | seulement ce qui FLOTTE | les 14 `boxShadow` écrits à la main |
| `--m-court` 120 ms · `--m-moyen` 200 ms · `--m-long` 320 ms | durées | 0,12–0,16 s → court ; 0,18–0,25 s → moyen ; au-delà → long |
| `--m-sortie` `cubic-bezier(.2,.8,.2,1)` · `--m-ressort` `cubic-bezier(.34,1.3,.64,1)` | courbes | les 23 courbes différentes |

Couleurs : les 170 hex en dur du JS et les 72 des CSS → le jeton `C.*` / `var(--…)` de même
valeur (table `MINERAL` / `MINERAL_DARK`). Gardés en dur : logos et couleurs des plateformes et des
transporteurs, contenu des e-mails HTML (pas de variables CSS dans un client mail), PDF/bordereaux.

## Composants
- **Bouton** : les 119 `display:inline-flex` des JSX sur des boutons → la règle de base (§7).
- **Carte** : une `CarteBase` (fond `C.card`, `--r-carte`, `--e-16`, pas d'ombre) ; les cartes maison
  des écrans la reprennent une par une, rendu inchangé à l'œil (capture avant/après).
- **Badge / pastille** : un composant, trois sens seulement : neutre, ambre (geste), rouge (doublon).

## États à tenir partout
défaut · survol (ordinateur seulement, `@media (hover:hover)`) · appuyé (échelle .97, `--m-court`) ·
focus (contour `C.ring`, ≥ 3:1) · désactivé (opacité .4, `aria-disabled`) · chargement (« … » ou
squelette, jamais un 0) · pas su (« — » + raison, §5) · vide (une phrase + le geste).

## Responsive
390 px tactile (44 px au doigt, §7) · 768–1024 iPad (lot ipad) · 1512 ordinateur (île flottante,
`ScreenHead` slot `right`). `prefers-reduced-motion` : aucune animation de déplacement.

## Cas limites
titres longs (2 lignes puis « … », titre entier lu au lecteur d'écran) · 0 / 1 / 1 000 lignes ·
langues plus longues (allemand +30 %, lot traduction) · mode sombre sur chaque capture.

## Preuves attendues
Un audit `audit-jetons-visuels.cjs` qui compte les valeurs hors échelle (rouge si une remonte
au-dessus du chiffre atteint) ; captures avant/après des 11 écrans du banc `accessibilite`
(390/1512, clair/sombre) regardées ; banc `accessibilite` toujours 0 ❌.
