# Maquette H — « L'atelier » (17 nov. 2026)

Demande de Julien (17 nov.) : « j'aime bien le C, propose encore plein d'autres maquettes » ; « change tout, même la
disposition des boutons » ; « parfait, minimaliste et simple ». **Une proposition, pas une livraison** : aucune PR.
Branche `claude/maquette-h`, partie de `claude/onglets-design-c` (style Studio de C).

## Ce que c'est
- La barre du bas = cinq **postes** de travail physiques : Recevoir · Ranger · Publier · Emballer & poster · Encaisser
  (point ambre = du travail y attend). Le disque du milieu = **le scanner** : un N°, un suivi, un code de retrait, un
  n° de transaction ouvre le bon poste — identité EXACTE seulement (`estIdentiteExacte`), sinon « ressemble — à toi de choisir ».
- Chaque poste ouvre sur **ce qu'il y a à faire** ; le rail souligné de C donne ses autres listes ; le dernier cran
  est l'**historique** (Achats, Stock, Annonces, Ventes, Versements).
- **Au pouce** : en haut, titre + « ? » + rail ; en bas, « Chercher » + LE geste du poste (le seul plein).
- Minimal : un cran = une liste, aucun nombre écrit deux fois (le plein porte le compte, son cran non), aucune
  phrase d'explication à l'écran, aucun mot répété sur chaque ligne.

## Règles gardées
Identités (§5) : le modèle est celui de la maquette F (`src/maquettes/h/donnees.js`, repris tel quel) ; les postes
(`postes.js`) n'ajoutent que des filtres sur ces identités. Un point = une carte ; une date limite pas lue = « estimée »,
jamais en retard ; versements datés au jour du versement (450) ; statut URSSAF jamais deviné (« — ») ; pas su = « — ».

## Ce que ça casse
Ma journée disparaît (éclatée dans les postes) ; Messages, Offres, Favoris sans onglet ; loupe et cloche quittent
l'écran ; l'éventail du « + » devient le plein de chaque poste ; Leboncoin, eBay, Vestiaire perdent leur écran (filtre
de site par poste) ; Argent perd Statistiques/Déclarer/Factures ; Stock 3D réduit au cran « Cases » ; liens `?tab=` à refaire.

## Fichiers
`src/main.jsx` (monté si `localStorage.vrm_banc_maquette === 'h'`, posé par le banc seulement) ·
`src/maquettes/h/{Atelier.jsx,atelier.css,donnees.js,postes.js}` · banc `scripts/bancs/maquette-h.cjs`
(`npm run build && SHOTS=… node scripts/bancs/maquette-h.cjs`) : mesure 1 plein visible, cibles ≥ 44 px, 1re rangée
≤ 50 % de 844, aucun bouton dans la moitié haute hors rail/« ? », aucun undefined/NaN — vert sur les 10 captures.
Textes en français seulement (prototype) : à passer par `tr()` s'il est retenu.
