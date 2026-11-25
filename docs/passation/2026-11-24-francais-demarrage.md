# 24 nov. — Le français du démarrage repasse sous 74 Ko (lot `francais-demarrage`)

## Pourquoi
`main` (après #1326) pesait **79,96 Ko** compressés de français au démarrage pour un budget de
80 Ko (`scripts/audit-francais-differe.cjs`, déjà monté trois fois : 75 → 78 → 79 → 80). Chaque PR
qui ajoutait une phrase au démarrage rougissait (#1321, #1377…). Décision : **ne pas remonter le
budget** (la vitesse est la priorité de Julien), sortir du démarrage ce qui n'est pas la première image.

## Mesure (avant de coder)
Analyse `scripts/_francais-differe.cjs` rejouée en coupant, un par un, les modules du graphe du
démarrage (copie en mémoire du script, arête statique ⇒ à la demande). Gain par module seul :
`accueilReste/AccueilReste.jsx` 6,42 Ko · `ui/Accompagne.jsx` 4,07 · `RetoursLitiges.jsx` 1,54 ·
`SanteComptes.jsx` 1,45 · `fiabilite/Fiabilite.jsx` 1,32 · `extension/peutFaire.js` 1,32 ·
`RepubProgramme.jsx` 1,25 · `ARetirerAilleurs.jsx` 0,86 · `ArgentAVenirEcran.jsx` 0,71 · le reste < 0,6.
Un seul module suffit à la cible : l'accueil des nouveaux (visite des écrans, glossaire, conseil du
jour, cartes du bas de Ma journée) et ses règles (`visiteEcrans.js`, `glossaire.js`, `conseilDuJour.js`…).

## Ce qui change (aucun comportement, aucun visuel)
- `src/App.jsx` : `VisiteEcranHote` par `aLaDemandeDiscret` (elle ne rend rien avant de partir,
  2,2 s après l'arrivée sur un écran : aucune place à réserver). L'import inutilisé
  d'`AccueilResteJournee` est retiré.
- `src/ecrans/Comptabilite.jsx` : `AccueilResteJournee` par `aLaDemandeDiscret` — ses cartes sont
  EN BAS de Ma journée, sous tout le reste : leur arrivée ne déplace rien au-dessus.
- `src/composants/AideEcran.jsx` (le « ? », au démarrage) : `RevoirVisite` et `GlossaireListe` par
  `lazySur` ; le `Suspense` entoure la feuille ENTIÈRE (pastille « Ouverture… » comme les autres
  feuilles à la demande) : elle paraît d'un bloc, jamais un bouton qui pousse le reste. Préchargée à
  l'intention (survol, appui, focus du « ? », événement `vrm:aide`) : déjà là au clic, `lazySur` la
  rend tout de suite.
- `src/ecrans/Reglages.jsx` garde son import statique (Réglages est déjà à la demande).

## Preuves
- `audit-francais-differe` : **73,6 Ko** (budget 80 inchangé, ≈ 6,4 Ko de marge) ; reste 135 Ko.
- `audit-poids-demarrage` : voir la PR (main → branche).
- `npm run build` vert ; `audit-tdz`, `audit-traduction`, `audit-quoi-de-neuf`, `audit-accueil-reste`,
  `audit-aide-client`, `audit-import-partage-aide` verts (`audit-vocabulaire-article` : 2 rouges
  identiques sur `main`, hors de ce lot).
- Bancs : `accueil-reste`, `centre-aide`, `aide-signalement`, `import-partage-aide`, `demo-bulles`.

## Pour la suite
S'il faut encore de la place : `ui/Accompagne.jsx` (4 Ko, mais posé en ligne dans beaucoup d'écrans),
puis `RetoursLitiges`, `SanteComptes`, `Fiabilite` (importés par Comptabilite.jsx, préchargé).
