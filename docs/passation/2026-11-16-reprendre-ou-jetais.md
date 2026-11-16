# 16 nov. — « Reprendre là où j'étais » (lot `reprendre-ou-jetais`)

Mission : `docs/passation/file-attente-16nov/4-reprendre.md` (validée par Julien).

## Ce qui existait déjà (mesuré dans le code avant de coder)
- 5 nov. (`src/repriseEcran.js`) : écran, section/site, onglet de Colis rangés sur l'APPAREIL, par vendeur ;
  un lien `?tab=` reçu fait taire la reprise ; un écran hors liste blanche ⇒ Ma journée.
- 11 nov. (`src/repriseSynchro.js`, clé `vrm_reprise_ecrans`) : filtres, tri, période, recherche, compte par
  site, site par tâche, dernier écran — SUR TOUS LES APPAREILS ; filtre retenu toujours dit (bandeau « Effacer »).
- Défilement : `MemoireDefilement` (App.jsx), sur l'appareil, relu jusqu'à **7 jours**.
- Une notification touchée : le service worker ouvre l'adresse `?tab=…` ou la poste à l'app ouverte (`open-url`) ⇒
  `goto`, jamais la reprise.

## Ce qui change (la seule vraie différence avec la demande)
- Le dernier écran rouvre s'il a moins de **12 h** (c'était 30 min) : `DUREE_ECRAN = 12 * 3600000`.
- La position de défilement suit la **même** durée : `positionReprise(storage, owner, ecran, now)` (12 h, bornée
  0–1 000 000, un autre vendeur ⇒ 0). `MemoireDefilement` la lit par cette règle (au lieu de 7 jours).
- Inchangé, voulu : une recherche ne revient que quittée il y a < 10 min ; un filtre/tri 60 j, toujours DIT.
  Aucune feuille, confirmation ou geste à moitié fait n'est rangé (seulement `tab`, `sub`, `colis`).
  Écran retiré (Colis) : `placeDesColis` le mène à Ventes/Achats ; inconnu ⇒ Ma journée.
- « Quoi de neuf » : `reprendre-12h`.

## Preuves
- `audit-reprise-synchro` : 44/44 ; **18/18 mutations** (3 neuves : `ecran-30min`, `defilement-7j`,
  `defilement-sans-regle`). Sur le code d'avant (`git archive origin/main`) : 4 rouges (31 min, 11 h 59,
  `positionReprise` absente, câblage).
- Banc `reprise-ecrans` (390 tactile + 1512, base inventée) : P6 13 h ⇒ Ma journée ; P7 11 h ⇒ Ventes + filtre ;
  P8 défiler 700 px, recharger ⇒ même écran, 700 px ; lien `?tab=achats` gagne ; P9 ordinateur 11 h ⇒ Annonces.
  **35/35**, captures regardées. Note : dans ce banc, toucher « Annonces » dans la barre du bas depuis Ma journée
  (iPhone, P6) ne menait pas à Annonces (vu sur la capture ; non expliqué, probablement hérité) : P6 y va par
  `?tab=annonces` (la reprise des VUES reste jugée). À regarder par le lot des bancs rouges.

## ÉTAT À LA REPRISE
Fini, PR ouverte (voir le rapport). Rien d'autre à faire. Geste de Julien : aucun.
