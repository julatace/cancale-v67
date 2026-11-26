# src/ — règles de design (se lit APRÈS le CLAUDE.md racine)

Le CLAUDE.md racine est plein (< 60 Ko) : ce fichier porte les règles de DESIGN, en
liste vérifiable, pour toute modification sous `src/`. En cas de doute, la racine gagne
(§2 à §7). Format inspiré du plugin `fairmind-design` (24 nov., Julien : « installe
tout et sers-toi d'eux pour faire le design »).

## Agents et skills de design disponibles

| besoin | outil |
|---|---|
| relire un écran comme un designer pro | skill `ui-design-review:ui-review`, puis `ui-design-review:ui-polish` |
| contrastes (WCAG 1.4.3 / 1.4.11) | agent `fairmind-design:fairmind-color-contrast-specialist` |
| audit d'accessibilité complet | agent `fairmind-design:fairmind-accessibility-orchestrator` |
| jetons de couleur / espacement | skill `fairmind-design:design-token-conventions` |
| direction visuelle nouvelle | skill `inhabited-design:inhabited-design` (mode `lite`) |
| mouvement | skills `animate`, `emil-design-eng`, `apple-design` |
| confort iPhone | skill `mobile-native` |

## Portes obligatoires

| changement | à lancer (doit être vert) |
|---|---|
| tout texte visible ajouté | `node scripts/audit-traduction.cjs` (clé dans `src/i18n/fr.js` puis en/es/it/de) |
| tout lot visible | `node scripts/audit-quoi-de-neuf.cjs` (une ligne dans `src/nouveautes.js`) |
| icône ajoutée | `node scripts/audit-icones.cjs` |
| bouton ajouté ou restylé | `node scripts/audit-boutons.cjs` · banc `scripts/bancs/chaque-bouton.cjs` |
| couleur touchée | `node scripts/audit-couleurs-anciens-ecrans.cjs` · banc `scripts/bancs/contraste-clair.cjs` |
| écran modifié | sa capture REGARDÉE à 390 px et 1512 px, clair ET sombre (racine §6.2) |
| toujours | `npm run build` |

## On ne livre pas si

- une couleur orange ou ambre apparaît (décision de Julien, lot « sauts / orange » ;
  remplace « ambre pour un geste à faire » de la racine §7) ;
- le violet apparaît (refusé, racine §3 « Palette ») ;
- le rouge sert à autre chose qu'à deux paires présentes sous le même N° ;
- un écran porte plus d'UNE couleur d'accent, ou l'accent n'y est plus rare ;
- une cible au doigt fait moins de 44 px affichés ;
- un élément cliquable n'a pas de nom accessible, ou n'a aucun anneau de focus visible ;
- un texte visible n'est pas passé par `tr()` ;
- un chiffre « pas su » s'affiche `0` au lieu de `—` ;
- un contenu déjà connu attend une animation pour apparaître (stagger ≤ 15 ms par élément,
  total ≤ 120 ms, toucher → réaction < 100 ms ; `prefers-reduced-motion` respecté) ;
- un nouveau fichier CSS est créé alors qu'un fichier existant de l'écran ou du composant
  convient (il en existe déjà ~200 : on ÉTEND, on n'empile pas).

## Anti-motifs (à chercher par `grep` dans le diff)

- `display:\s*inline-flex` sur un bouton (racine §7 : une règle de base pour tous) ;
- `-webkit-overflow-scrolling:\s*touch` sur un conteneur qui peut contenir une feuille (racine §7) ;
- `outline:\s*none` sans règle `:focus-visible` à côté ;
- `<div[^>]*onClick` sans `role=` et sans `tabIndex` ;
- `( {/* … */} )` dans le JSX (racine §4.7 : objet vide ⇒ React #31) ;
- un nom d'icône absent de `ICON_PATHS` (ne dessine rien, sans erreur).

## Jetons

Ne pas inventer une couleur en dur dans un composant neuf : prendre les variables de
`src/themeMineral.js` / `src/styles-vitrine.css` (et, une fois fusionnée, la famille
`--g-*` des styles au choix, `src/natif/styles-choix.css`). Un jeton neuf ne se crée
que s'il sert à au moins deux endroits et qu'aucun jeton existant ne convient.
