# 8 nov. 2026 — Direction artistique, phase 1 (Ma journée, Ventes, Colis)

Branche `claude/direction-artistique` (pas de PR, pas de merge : à valider par Julien).
Demande de Julien (8 nov.) : « le graphisme visuel, c'est vraiment catastrophique, on dirait un
truc fait à l'arrache, ça ne fait pas du tout premium ». Il garde Apple (blanc, encre, bleu rare,
police système), « en mieux », comme un outil pro calme, aussi beau sur iPhone que sur ordinateur.

## Ce qui a été fait

- `src/styles-premium.css`, importé EN DERNIER par `src/App.jsx` (après `styles-parcours-clairs.css`).
- Tout est dans une couche `@layer vrm-premium` : une déclaration `!important` DANS une couche
  gagne contre toutes les déclarations `!important` hors couche (CSS Cascade 5), quelle que soit
  leur spécificité. Plus besoin de `:root:root:root body …` ni de répéter une classe huit fois
  (fusion.css le faisait pour `.vrm-colis-primaire`). Les styles en ligne restent au-dessus pour
  ce qu'ils déclarent `!important` (aucun ici) ; une déclaration en ligne SANS `!important`
  perd contre la couche (voulu : la couleur ambre écrite en ligne sur la date limite).
- Périmètre : `.vrm-main[data-ecran="journee"|"ventes"|"cat_bord"]`, et la coque (en-tête iPhone,
  compteurs de la barre d'onglets et du rail) seulement quand elle porte l'un de ces trois écrans
  (`.vrm-app-shell:has(> .vrm-main…)`). Les autres écrans ne bougent pas.
- Rien de métier : aucun texte, chiffre, `data-*`, geste, ordre de blocs. Deux éléments
  DÉCORATIFS ne s'affichent plus sur ces trois écrans : la tuile d'icône devant le grand titre
  (`.vrm-screen-repere`, `aria-hidden`) et, au téléphone seulement, le logo du site dans la note
  d'une vente (le mot « Vinted » est juste à côté).

## La direction (jetons `--p-*` en tête du fichier)

- Grille 4 px ; marge de page 16 px au téléphone sur les trois écrans ; un seul bord gauche.
- SF : grand titre 34/700 −0,022 em · grand chiffre 40/700 (44 ordinateur) tabulaire ·
  section 20/700 · rangée 15/600 · texte 15 · note 13/400 grise · légende 12. Plus de 800.
- Rayons : vignette 10 · contrôle/case 12 · groupe 18 · carte sombre 22.
- Surfaces : groupes blancs sans cadre, ombre réduite à un liseré .5 px ; nuit `#000`/`#1C1C1E`.
- Listes = UN groupe à rangées, filet .5 px après la photo (Colis : 84 px ; Ventes : 72/76 px).
- Couleur : bleu rare ; ambre = un POINT devant ce qui presse (la phrase à l'encre) ;
  compteurs = pastille pleine de 18 px.
- Carte sombre : bleu nuit plus calme, cases au voile 8 %, alignées en haut, « — » fin ;
  couchée à l'ordinateur (Ventes comme Colis) ; « 70 à envoyer » sur une ligne au téléphone.

## Défauts relevés (15) et réponses

Liste complète, avec captures annotées et AVANT/APRÈS : dossier de livraison de la session
(`da/README.md` du scratchpad). En bref : 1 premier écran de Colis sans colis · 2 tuile
d'icône qui casse le bord gauche · 3 marges 24/14/16 · 4 une carte par colis · 5 colonne de
texte de 158 px · 6 phrase ambre sur chaque colis · 7 bandeau rosé à cadre · 8 cases de la
carte sombre désalignées · 9 bandeau sombre de 1 180 px pour un chiffre · 10 graisse 800 et
approche tassée · 11 vente sur 3 lignes, date coupée · 12 site/compte sur 2 lignes, tournée en
dalle grise · 13 pile de photos en biais · 14 pastille d'état vide et anneaux ambre · 15 couches
CSS contradictoires.

## Vérifications

`npm run build`, `audit-violet`, `audit-icones`, `audit-boutons`, `audit-variables`,
`audit-tdz` : verts. Bancs (base inventée, un à la fois) : `chargement` (Ma journée, Ventes,
Colis ; 4 combinaisons) 45 verts · `iphone-reprise` 139 · `ventes-e2` vert (il a attrapé l'état
d'une vente posé à droite de la note : remis sur SA ligne) · `ventes-une-phrase` · `ventes-compte`
55 · `colis-envoi` 118 · `colis-retirer-propre` 129. Rouges identiques sur `origin/main` (a49ebbc4),
donc pas de cette branche : `colis-colonnes` 2 (« dernier jour » en ambre), `ventes-colis-premium` 4,
`colis-tous-sites` 12 (HTTP 503 de son serveur), `colis-fiables` 58. Texte rendu (`innerText`)
identique avant/après sur les 12 captures. `colis.cjs` exige `fx/` (absent ici).

## Phase 2 proposée (après validation de Julien)

1. Étendre la couche aux autres écrans dans l'ordre d'usage : Annonces, Messages, Achats,
   E-mails, Compta, Statistiques, Stock, Réglages (mêmes jetons, mêmes règles de liste).
2. **Nettoyer** : retirer des anciennes couches (fusion, finition, vitrine, visuel, visuel-2,
   design-2026, mineral, epure, telephone…) chaque règle que la couche remplace, écran par
   écran, banc de capture avant/après à l'appui ; but : une feuille par composant et zéro
   `!important` hors couche.
3. Remplacer `--d-*`/`--fu-*`/`--t-*`/`--vrm-t*` par les `--p-*` (un seul jeu de jetons) et
   mettre DESIGN.md à jour (rayons 10/12/18/22, graisse 700, ombre liseré).
4. Ordre des blocs de Colis au téléphone (le premier colis encore sous le pli) : proposer à
   Julien de replier la carte sombre en une ligne de chiffres sur Colis — c'est un choix de
   produit, pas fait ici.
5. Vignettes : des photos réelles détourées sur fond clair rendraient les rangées plus « Wallet »
   — à mesurer sur sa base (les captures utilisent une photo neutre inventée).
