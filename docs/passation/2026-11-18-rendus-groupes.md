# 18 nov. 2026 — Regrouper les rendus du démarrage (branche `claude/rendus-groupes`, pas de PR)

## ÉTAT À LA REPRISE
Rien de changé dans l'app : deux essais mesurés, SANS gain net, retirés. Le banc `_mesure-demarrage.cjs` gagne `POURQUOI=<script>`
(un crochet React posé avant l'app note, à chaque rendu validé de `Comptabilite`, le RANG des états qui ont changé et un aperçu
de leur forme — jamais la valeur). Script du crochet : voir §1.

## 1. Ce qui déclenche les rendus (main 777d369, Ma journée, 390 ×4, 5 000 ventes)
`RENDUS=1` : 14 à 17 rendus de `Comptabilite` avant « prêt » (deux instances montées : les rendus vont souvent par paires).
`POURQUOI` : chaque rendu suit l'arrivée d'UNE à QUELQUES lectures (rangs 4, 14/16, 55–61, 65, 107, 119, 184, 219, 322/329,
425/445…) étalées de 5,9 s à 25 s, ET des changements de props venus d'`AppCoeur` (comptes, liveStats). Le crochet :
parcourir `root.current`, trouver la fibre dont les props ont `only`, `accounts`, `garageGrid`, comparer
`memoizedState` hook par hook à `alternate.memoizedState` (seulement les hooks à `queue`, donc useState/useReducer).

## 2. Essais mesurés (A/B, mêmes builds, même machine) et retirés
| essai | rendus de Comptabilite | prêt (ms) | tâches longues (ms) |
|---|---|---|---|
| main | 8 · 15 · 17 | 21 235 · 8 871 · 9 762 | 25 015 · 14 716 · 13 377 |
| poses hors geste en `startTransition` | 16 · 22 | 8 999 · 12 590 | 12 165 · 13 569 |
| poses hors geste groupées (≤ 250 ms, une tâche) | 21 · 20 | 8 669 · 9 071 | 11 321 · 12 440 |
`startTransition` donne PLUS de rendus validés (chaque voie de transition valide à part). La pose groupée gagne ~0,7 s de prêt
et ~1–2 s de tâches longues, dans le bruit de la machine (charge 10–25) — pas assez pour être prouvé ; elle ne couvre pas les
rendus venus des props d'`AppCoeur`.

## 3. Ce qu'il faut pour descendre à ≤ 3 rendus
Une SEULE source des données du démarrage (le magasin `src/magasinPartage.js`) que `Comptabilite` et `AppCoeur` lisent par
`useSyncExternalStore`, avec une pose groupée DANS le magasin (toutes les lectures parallèles du démarrage posées ensemble,
« pas su » gardé `null`, « en cours » `undefined`). C'est le chantier « une version des données » : les deux vont ensemble.
