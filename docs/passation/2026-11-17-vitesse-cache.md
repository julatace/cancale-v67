# 17 nov. 2026 — Vitesse : ouvrir une vente, l'histoire des N° gardée (PR #1253, branche `claude/vitesse-cache`)

## ÉTAT À LA REPRISE
PR #1253 ouverte, non fusionnée (contient #1250, déjà en ligne). Suite prévue sur `claude/cache-onglets` (banc
`onglets-froids` posé, rien d'autre) : instantané d'Achats (depuis les codes hors ligne déjà rangés), d'Argent,
Annonces gardé, `Comptabilite` mémorisé par version des données, structure de l'instantané de Ma journée.

## Mesuré (390 tactile, ×4, base inventée 2 000–5 000 ventes)
- Premier écran utile depuis la copie de l'appareil : déjà < 2 s (instantané du 14 nov. : 1,18–1,33 s à ×4 en Fast 3G).
  L'écran vrai : 22–29 s (17 s de tâches longues au ×4 ; lectures servies en 80 ms) — c'est le calcul.
- Appareil neuf : 4,7 Mo de lectures, dont 2,9 Mo de commandes en une requête ; 2e ouverture 0,67 Mo (lot K).
- Toucher une vente dans Ventes « Toutes » : 2,6–3,2 s avant la première image, puis l'écran Vinted entier, jamais la vente.
- Chaque fiche relisait toute l'histoire des N° (jetée à la fermeture de la précédente).
- Défilement de Ventes : la liste est paginée par 60 ; 16–22 images longues sur 30 pas, la plus longue 250–600 ms (bruit
  de la machine) — pas de fenêtrage nécessaire à ce volume.

## Ce qui change
1. Une vente Vinted de « Toutes » ouvre SA fiche par son n° de transaction (`attrsFicheLigne`) ; « Ses gestes dans
   Ventes · Vinted » (5 langues) dans la fiche mène à l'écran d'avant. Leboncoin, Vestiaire, eBay : inchangés.
2. `src/histoireGardee.js` : l'histoire des N° gardée entre deux fiches — seulement complète, périmée dès qu'une donnée
   change (génération des écrans gardés) ou après 10 min, oubliée AVANT d'être relue.

## Mesures (banc `latence-gestes`)
Vente touchée : réponse 2 592–3 208 → 336–552 ms ; contenu utile : jamais → 1re fiche 2,3–3,6 s, suivantes 222–477 ms.
Chiffres identiques (`chiffres-volume`, Ma journée, Ventes, Argent, Déclarer : 25/26, seule différence l'attribut `data-fl-tx`).

## Preuves
`audit-gestes-fluides.cjs` 13 verts, rouge sur la base (8), `--prouve` 6/6 ; audits studio, tdz, variables,
arrivee-sans-gel, traduction, quoi-de-neuf, composants, identite verts.

## Geste de Julien
Aucun.
