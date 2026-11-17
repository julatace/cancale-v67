# 17 nov. 2026 — Le coût du calcul au démarrage (branche `claude/cache-onglets`, pas de PR)

## ÉTAT À LA REPRISE
Rien de changé dans l'app sur cette branche : seulement le banc `scripts/bancs/onglets-froids.cjs` et ce récit.
Deux essais mesurés SANS gain ont été retirés (voir §3). À reprendre par le §4.

## 1. Le profil (build non minifié, `_mesure-demarrage.cjs` PROFIL, Ma journée, 390 ×4, 4G, 5 000 ventes, 1 000 annonces)
Écran prêt au plafond 9,7 s (1re ouverture) / 12,1 s (2e) ; tâches longues 12,1 s / 13,6 s.
Temps PROPRE, les 10 premiers (1re ouverture, ms) : `listeEnvoyes` 660 · React `Nh` 585 · fetch 258 · `numFromTxn` 230 ·
React `Qj` 220 · `ajuste` (grand chiffre) 213 · anonyme App:112410 206 · `load` 186 · `poser2` 174 · IndexedDB `onsuccess` 152.
2e ouverture : React 546 · `listeEnvoyes` 518 · `ajuste` 503 · `vider`/`tient` (titres qui tiennent) 288+286 ·
`jsonStable` 219 · `attendrePolices` 192 · `classifyOrderStatus` 135 · `echelleTexte` 120.
INCLUSIF : `Comptabilite` 5,5–6,5 s, dont le rendu de Ma journée (l'IIFE `curSub === 'journee'`) 3,0–3,6 s,
`commandesAVerifier` 1,1–1,4 s (→ `listeEnvoyes` 0,9–1,1 s), la grille des tuiles 1,5–1,9 s.
**`Comptabilite` est rendu 14 fois avant « prêt »** (banc RENDUS=1 : de 5,4 s à 9,0 s, une fois par donnée arrivée).

## 2. Ce qui n'est PAS la cause
- Le réseau : lectures servies en 80 ms ; l'écran attend le CALCUL.
- `ajusterChiffre` seul : sa lecture force une mise en page du document, que le navigateur ferait de toute façon pour peindre
  (≈ 1,5–2 s au ×4 pour ≈ 7 000 nœuds et ~440 règles `:has`). La déplacer ne la supprime pas (§3).

## 3. Essais mesurés et retirés (A/B alterné, `vitesse-volume.cjs`, 3 passes, médianes)
- Mesure du grand chiffre déplacée dans le rappel du ResizeObserver + `listeEnvoyes` calculée une fois par calcul synchrone :
  Ma journée prête 9,6 s, Achats 11,2 s, tâches longues 11,3–12,0 s — identiques à main (Achats 11,0 s, 11,9 s) dans le bruit.
  Retirés : aucun gain prouvé, et le premier changeait l'instant du réglage d'un chiffre trop long.

## 4. Ce qui ferait tomber l'écran vrai sous 3 s au ×4 (par gain attendu)
1. **Moins de rendus de `Comptabilite`** : 14 rendus de 200–600 ms. Regrouper les arrivées de données du démarrage (une
   seule pose d'état pour les lectures parallèles, ou `startTransition` sur les poses de données pour que React fusionne les
   mises à jour en attente et cède aux touchers).
2. **Mémoriser les dérivées lourdes par VERSION des données** (`commandesAVerifier`, `listeEnvoyes`, la grille des tuiles) :
   elles dépendent d'une vingtaine d'entrées dont des lectures de `localStorage` dans le rendu — il faut d'abord une
   version unique des données (src/magasinPartage.js a la source unique des ventes/achats) avant de mémoriser, sinon un
   chiffre périmé se présenterait comme frais.
3. **Le coût d'une mise en page** : ≈ 1,5–2 s au ×4. Les règles `:has()` dont le sujet est `html`/`body`/`.vrm-app-shell`
   (ex. `html:has(.vrm-app-shell[data-espace])`, `html:has(.vrm-pp)`, `.vrm-app-shell:has(.vrm-main .vrm-fu-journee)`) font
   restyler tout le document à chaque insertion ; les remplacer par un attribut posé par React sur `<html>` (domaine design :
   studio-verre.css, verre-journee.css, fusion.css). Mesuré : une insertion sous `<body>` coûtait 2,5–4,2 s de recalcul (#1250).

## 5. Le banc `onglets-froids` (mesure de départ, main 7b8bfc2)
Appareil déjà utilisé, page rechargée, chaque onglet une fois : aucun squelette ni écran vide ; contenu neuf après
Achats 7,2 s · Ventes 2,1 s · Paires 1,3 s · Argent 0,5 s. Instantanés rangés : Ma journée, Ventes, Annonces (aucun pour
Achats ni Argent ; Achats montre des codes de retrait et adresses : son instantané doit venir des codes hors ligne déjà rangés).
