# Aujourd'hui, moitié moins de texte — 25 nov. 2026

Branche `claude/aujourdhui-moins-texte` (depuis `origin/main` e93e24ef8). Pas fusionnée.

## La demande

Julien, sur ses captures iPhone de l'écran « Aujourd'hui » (style Monochrome) : « C'est pas mal mais trop de texte,
améliore. » Il fallait diviser le texte par deux sans perdre une information ni un geste, et corriger trois défauts vus
sur ses captures : « ±0 % » en vert avec une flèche montante, « Reçu · novembre au moins 1… » coupé, « Par site »
avec un seul site (une barre pleine « Vinted 100 % » qui redit le grand chiffre).

## Ce qui change (de haut en bas)

| avant | après | où |
|---|---|---|
| « 5 annonces ont disparu de shop_cancale » / « entre le 21 nov et le 23 nov » | « 5 annonces disparues » / « shop_cancale · 21–23 nov. » (phrase entière au lecteur d'écran) | `src/AlerteModeration.jsx` (`fenetreCourte`, Intl `formatRange`) |
| « **Tout est arrêté.** Aucun geste automatique ne part, sur aucun compte. » + « Reprendre » dessous | « En pause » + « Reprendre » sur une ligne (phrase entière au lecteur d'écran) | `src/Discretion.jsx`, `src/styles-discretion.css` |
| « Ton ordinateur (Chrome · Mac) est éteint depuis 07:37 » / « Tes comptes à distance : … » | « Ordinateur éteint · 07:37 › » ; la ligne dessous seulement si des gestes attendent | `src/aDistance/LigneOrdinateur.jsx` |
| « Vendu · 7 derniers jours » | « Vendu » (le segmenté 7 j · 30 j · Mois dit la fenêtre) | `src/natif/ecrans/Aujourdhui.jsx` (`Pilotage`) |
| « ▲ ±0 % vs les 7 jours d'avant » en vert | « ±0 % · 4 ventes » neutre, sans flèche ; ▲/▼ seulement si l'écart n'est pas nul ; la phrase au survol et au lecteur d'écran | idem (`n-heros-egal`) |
| « Bénéfice · 7 j », « Reçu · novembre », « au moins 694 € » (coupé à 390 px) | « Bénéfice », « Reçu · nov. », « ≥ 694 € » (« au moins » dit au lecteur d'écran, `auMoinsCourt`) | idem |
| détail du jour toujours écrit (1512) | dit au toucher d'un jour (sa place reste tenue) | idem |
| titre « Colis » | sans titre quand le tableau de bord est là (les cases « À envoyer » / « À retirer » le disent) | idem |
| « Relais 0 · 100000 · 7 points » | « code 100 000 » (le lieu et les points restent dans À retirer ›) | idem |
| « 1 paire à republier en priorité » / « En ligne depuis 30 j ou plus » | « 1 paire à republier › » | idem + `prio.journee` |
| « 1 offre sans réponse » / « La plus ancienne : il y a 105 j » | « 1 offre sans réponse · il y a 105 j › » (l'âge à droite) | idem |
| « 24 nouveaux N° à écrire sur leurs rangements », 6 N° | « 24 N° à écrire », 4 N° + « +20 » · « Voir » · « C'est écrit » | `src/App.jsx` (`CarteNumerosAEcrire`) |
| « Montant en attente / Montant disponible / lu il y a 13 jours » | « En attente / Disponible / lu il y a 13 j » | `pm.*` |
| « Par site · 7 jours » avec un seul site | absent tant qu'un seul site a vendu (CLAUDE.md §7 : un nombre une fois) | `ParSite` |
| « Tes chiffres » : CA vendu, Bénéfice brut, Bénéfice net | « Chiffres » : Vendu, Brut, Net | `jour.t.*`, `v2.stats.titre` |
| Dernières ventes : « avant-hier », « il y a 3 j »… sous chaque tuile | la tuile : photo, N°, prix (l'âge reste dans son nom, `aria-label`) | `Aujourdhui.jsx` |
| « Toutes les statistiques / Pilotage et finances, sur 7, 30 ou 90 jours », « Personnaliser cet écran » | « Statistiques › », « Personnaliser » | `v2.af.*`, `v2.perso.ouvrir` |

Aucun chiffre n'est calculé autrement, aucun `data-*` retiré (un ajouté : `data-pil-recu-partiel`). « Pas su » reste
« — » avec sa raison ; « au moins » reste dit (le signe ≥ à l'œil, les mots au lecteur d'écran). Textes par `tr()`,
dans les cinq langues (clés neuves : `src/i18n/langues/*/moinsTexte.js` ; valeurs raccourcies des clés qui ne
servaient qu'ici).

## Les preuves

- Banc **`scripts/bancs/aujourdhui-moins-texte.cjs`** (l'app rendue, base inventée qui reproduit ses captures :
  `shop_cancale`, 5 annonces disparues, « Tout arrêter » posé, ordinateur éteint à 07:37, vendu des 7 jours ÉGAL aux
  7 d'avant, reçu incomplet, 24 N° à écrire, porte-monnaie lu il y a 13 j, une paire à republier, un seul site).
  Il juge : M mots VUS (le texte réservé au lecteur d'écran ne compte pas ; un nombre = un mot) ≤ la moitié d'origin/main ;
  T aucun chiffre ni titre coupé ; Z ±0 % sans flèche ni vert ; S « Par site » absent avec un site ; D aucun montant
  ≥ 100 € écrit deux fois ; G chaque geste là (Reprendre, C'est écrit, Imprimer, les deux cases, l'ordinateur, la ligne
  des disparues, le porte-monnaie et ses deux montants, la paire à republier, le reçu « au moins »).
  - **Après** : 80 verts, 0 rouge (390 et 1512, clair et sombre, style par défaut et Monochrome).
  - **origin/main** (banc copié dans l'arbre d'origin/main, son build) : 36 verts, 44 rouges (M, T « au moins 694 € »
    114 > 99 px, Z, S, D « 339 € × 2 », G).
  - **Mutations** (`MUTATION=fleche|site|tronque`) : chacune rougit SA mesure.
- **Mots vus** : 213 → **100** à 390 px ; 249 → **123** à 1512 px (identiques en clair/sombre et en Monochrome).
- Planches avant/après (mêmes données) : `…/scratchpad/aujourdhui/planches/{390,1512}-{clair,sombre}[-monochrome].png`
  (hors du dépôt).
- Audits verts : traduction, quoi-de-neuf, variables, tdz, coherence, identite, statuts, boutons, violet, icones ;
  `npm run build`. `audit-stockage-sur` : le même rouge que sur origin/main (5 fichiers que ce lot ne touche pas) ;
  `audit-boutons-natifs` : plante pareil sur origin/main dans ce conteneur (`../i18n/index.js` introuvable depuis sa
  copie temporaire) — ce lot n'ajoute ni bouton brut ni clé d'index.

## Pas fait ici (à dire)

- Le bandeau « En pause » garde la couleur `--vrm-warn` (orange-brun en style par défaut, sombre compris) :
  `src/CLAUDE.md` interdit l'orange, mais les couleurs sont le chantier `claude/style-c3` — à reprendre là.
- La ligne « Extension pas ouverte dans ce navigateur » (en-tête à l'ordinateur) vient de `EnDirect`/l'en-tête : hors de ce lot.
