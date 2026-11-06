# 6 nov. — Vague 3, écrans : quatre défauts de la revue de cohérence

Branche locale `v36-vague3-ecrans` (depuis `claude/project-review-nsk5su`, be6b7179). Rien
dans `vinted-sync-extension/` ni `public/`. Sources : `2026-11-05-revue-coherence.md`,
`2026-11-05-chantier-e2.md` (2.30, « rapporté pour F »), `2026-11-05-chantier-h.md` (« ce qui reste »).

## 1. La fraîcheur dite une fois par écran (2.30)
Mesuré (banc, deux comptes relus il y a 3 et 4 j) : **Annonces · Vinted** disait deux fois les mêmes
comptes — la tête de Vinted (`VintedResume` → `FraicheurDonnees`, date des VENTES captées :
« 2 comptes pas relus depuis 3 j ») au-dessus de `FraicheurAnnonces` (date des DRESSINGS :
« 12 annonces à confirmer — dernière lecture il y a 4 j »). Ventes · Vinted, Colis (la puce
« N comptes à relire » ; la ligne du bas y est cachée par fusion.css) et Statistiques n'avaient
qu'une voix. **Fait** : `VintedResume` reçoit `sansFraicheur` ; sur Annonces la seule voix est
`FraicheurAnnonces` (la date du dressing gouverne la liste).

## 2. « Ranger » vise sa case (Stock 2D)
Avant : « Ranger au stock » (vente, fiche) ouvrait le Stock en mode « touche une case », aucune case
désignée ; « Voir au stock » ouvrait la recherche, la case hors de l'écran ; la cloche « Où ranger à
l'arrivée » menait à `?tab=garage` sans la case qu'elle venait de proposer. **Fait** : une cible
`case` dans `src/cibleNotif.js` (`cible=case&meuble=<id>&i=<n>`, jeton `case:<meuble>:<i>`, repli
`data-case-ici`) ; chaque case porte le crochet `data-cible`. `poserCible` fait aussi SÉLECTIONNER la
case par le Stock (`DEMANDE_STOCK_CASE` → `is-vise`, `data-case-choisie`, `aria-current`) ; `CibleNotif`
la défile et l'éclaire (le mécanisme unique des notifications). « Ranger au stock » propose la
première case libre (`premiereCaseLibre` de `src/ouRanger.js`, la règle de la cloche) et le dit dans le
toast ; toucher une case (celle-ci ou une autre) range comme avant. « Voir au stock » d'un N° rangé
vise SA case ; sans case, la recherche comme avant. La cloche mène à LA case proposée.

## 3. Statistiques : le compte exclu nulle part (§5)
Cause : « Annulations » et « Notes reçues » lisaient `vinted_accounts_hidden` dans un `useMemo([panelOff])`
au MONTAGE ; Statistiques se monte avant que `main` arrive du nuage (`load` rend `[]`) et ne relisait
plus. **Fait** : `useCompteEcarte(panelOff)` (App.jsx, à côté de `compteEcarte`) relit à l'arrivée du
nuage et à chaque « Masquer » (masqués, panneau, supprimés) ; utilisé par « Annulations », « Notes
reçues », « Boost » et « Offres ». Banc : compte masqué avec ventes, annulations, notes, annonce,
offre ⇒ écrit nulle part, aux trois périodes, volets ouverts.

## 4. Contraste de la carte sombre (`CarteStats` / `CarteMois`, tête de Ma journée)
Mesuré au pire point (l'arrêt le plus clair du dégradé, sous le voile d'une case à 10 %) : en
sombre, le gris (blanc à 62-65 %) tombait à **3,4-3,6:1** sur #2A5385 ; en clair 4,4:1 pour le
11 px « pas lu ». **Fait** : jetons dans `src/themeMineral.js` (`carteSombre`, `carteSombreClair`,
`caseSombre`, `surSombre`, `surSombre2` = blanc à 70 % clair / 82 % sombre), posés en `--vrm-*` par
`variablesTheme` ; fusion.css et jetons.css lisent `--fu-sur-sombre-2` / `--fu-case-sombre` /
`--fu-sombre` (33 blancs translucides écrits à la main remplacés). Pire point : 5,15:1 clair,
4,71:1 sombre. Aucune couleur nouvelle (ni accent, ni ambre, ni rouge).

## Preuves
- **Banc** `scripts/bancs/vague3-ecrans.cjs` (harnais `nouveau-vendeur`, port 9610, données
  inventées ; 390 tactile et 1512, clair et sombre ; points F, S, X, K). Arbre d'avant (`git archive
  be6b7179`, son dist) : **56 rouges** (F 3, S 24, X 9, K 20). Après : **0 rouge** (F 12, S 45, X 15,
  K 44 verts). Mutant (dist construit avec les quatre retours en arrière) : F 2, S 6, X 6, K 4 rouges.
- **Audit** `node scripts/audit-vague3-ecrans.cjs --prouve` : 26 contrôles verts, 10 mutations toutes
  rouges ; sur l'arbre d'avant : 19 rouges.
- `npm run build` vert ; audits verts : coherence, identite, rouge-doublon, comptes-exclus,
  cibles-notif, tdz, composants, icones, annulations-compte, colis-envoi, coque-parametres, flux-divers,
  offres-expirent, stock-2d, stock-annonces, fonctions-api, statuts.
- Bancs : stock-2d, ventes-par-compte (plus de « rapporté » : le compte exclu n'est plus dans
  Statistiques), annulations-notes verts. `stock-retrouver` lisait tout `[data-cible]` (la liste « à
  aller chercher » ET maintenant les cases) : il lit `[data-cible]:not([data-case-ici])`.
  `stock-2d-revue` C jugeait « la recherche contient 1 » : il accepte la case N°1 visée (la règle).
- Captures regardées (scratchpad, hors dépôt) : `v3-S-*` (case proposée cerclée), `v3-K-*` sombre.

## Ce qui reste
- Colis : la ligne `FraicheurDonnees` du bas est toujours rendue, cachée par fusion.css quand la
  carte Colis est là (la puce parle) — à retirer du rendu quand on touchera Colis.
- `.vrm-fu-jour[data-futur]` (blanc à 38 %) et le « — » vide de la carte Compta (50 %) restent écrits
  à la main : décoratif / grand texte, hors du jeton.
- La Stock-liste « à aller chercher » emploie `data-cible` pour un autre sens (des N°) : à renommer.
