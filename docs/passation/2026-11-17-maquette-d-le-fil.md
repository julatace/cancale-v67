# Maquette D · « Le fil » (17 nov. 2026)

Demande de Julien (17 nov.) : « des agents qui vont révolutionner les maquettes, qui me proposent des choses
TOTALEMENT différentes ». A, B, C sont des variantes classiques ; D casse la navigation.

## L'idée
- Plus d'écrans ni d'onglets : UN fil des gestes du jour (« Aujourd'hui · 9 gestes »), qu'on vide comme une
  boîte de réception. La première carte est ouverte (« maintenant ») avec SES listes et SON bouton.
- Glisser à droite = Fait, à gauche = Plus tard (ou les touches ; Annuler 5 s). « Fait » est SA marque
  (sessionStorage, signature `id:nombre`) : rien n'est écrit chez Vinted ni dans la base, la carte revient si
  son nombre change.
- Le reste = des bibliothèques (Ventes, Achats, Annonces, Stock, Messages, Argent, Réglages) : dock du téléphone
  (le fil · chercher · ▦), « ‹ Le fil » + touches en tête de chaque bibliothèque ; à l'ordinateur, barre du haut
  (la vraie recherche « / », les bibliothèques en liens, le slot des filtres de l'écran), le fil à gauche et le
  geste choisi en grand à droite (J/K, E, H).

## Rien d'inventé
Les cartes sont les tuiles de Ma journée (`placerTuiles(out)`, mêmes nombres, mêmes dépliés, « — » / « Pas encore
lu » quand ce n'est pas su), les alertes d'argent (`alertesAF`, urgentes, jamais rangées d'un glisser) et les
cartes « À faire » déjà rendues (`resteAF`). Le fichier `src/maquettes/LeFil.jsx` ne calcule rien.

## Invisible pour Julien
`FIL_MAQUETTE` n'est vrai que si l'URL porte `?maquette=fil` ET que `vrm_banc_vends` vaut « 1 » (posé par
`scripts/bancs/design-passe.cjs` seulement). Sinon aucun composant du fil n'est rendu, aucune règle CSS ne
s'applique (tout est sous `[data-fil]`). CSS dans `@layer vrm-verre` (seule couche qui passe devant
`verre-journee.css`).

## Ce que ça casse (si on l'adoptait)
Barre du bas, « Plus », disque « + » et son éventail, rail de l'ordinateur, île d'actions ; la grille Bento de
Ma journée, son affiche (vendu du jour, semaine) et la tuile du mois (les chiffres iraient dans Argent) ; tout
écran passe à deux gestes (dock ▸ bibliothèque) au lieu d'un.

## Fichiers
`src/maquettes/LeFil.jsx`, `src/maquettes/le-fil.css`, `src/i18n/langues/{fr,en,es,it,de}/le-fil.js`, cinq
points d'accroche dans `src/App.jsx` (import, `AF.cartesFil/alertesFil`, la tête, le bloc des tuiles, la coque).
Captures et planche hors dépôt (scratchpad `onglets/D-planche.png`). Pas de PR (maquette).
