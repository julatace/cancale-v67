# 25 nov. — Régressions vues sur l'iPhone de Julien (« Regarde comment tout est atroce »)

Branche `claude/regressions-25nov` (depuis `origin/main` ae3393f72). Six captures iPhone de la version en ligne (gris moyen).
Banc : `scripts/bancs/regressions-25nov.cjs` (390 px tactile, dsf 2, clair et sombre, base inventée) — **5 rouges sur
origin/main, 0 après** (34 verts).

## Cause et correction, défaut par défaut

| # | défaut vu | cause | correction | banc |
|---|---|---|---|---|
| 1 | 3 cartes grises sous « Personnaliser », pour toujours | `VersementsEbayJournee` (App.jsx) en `aLaDemande` : son attente est `MorceauAttente` = `SqueletteChargement count={3}` (photo 56×76 + 2 barres, src/Chargement.jsx). Avec un compte eBay, le morceau `EspaceEbay` tenu par le réseau ⇒ squelette éternel ; et même quand il arrive, le bloc rend `null` (rien à dire) ⇒ trois cartes qui paraissent puis s'en vont. Aussi : `copierElague` (src/copieEcran.js) ne sautait que `.n-os`/`.vrm-sq-barre` — la copie de l'écran gardait ces cartes et les rouvrait. | `aLaDemandeDiscret` (attente muette) ; la copie saute `.vrm-skeleton`. | S |
| 2 | contenu visible SOUS la barre du haut au défilement, loupe/bulle sur les photos | La barre (`.n-barre-titre::before`, src/natif/natif.css) n'est opaque que si `data-n-fond`/`data-n-reduit` sont posés par le JS (Page.jsx `useTitreReduit`) ; sinon opacité 0 + fondu. Copie d'écran rouverte (prise page en haut, sans l'état), image pas encore relue ⇒ transparente. | Au téléphone (≤ 759 px) le fond de la barre est TOUJOURS `var(--n-fond)` opaque ; seuls le filet et le petit titre attendent le défilement. | E |
| 2b | photos du carrousel « Dernières ventes » blanches | `TuilePaire` (src/natif/Jeu.jsx) remet l'image à opacité 0 à chaque changement d'adresse (relecture au retour : adresse Vinted neuve) et attend un `load` qui, pour une image `lazy` dans un défilement de côté (iPhone), peut ne jamais venir. | Une tuile déjà montrée ne recache plus son image ; `load` manqué rattrapé à l'image suivante. | T (garde ; le changement d'adresse n'est pas reproduit au banc) |
| 3 | petit titre centré dans la barre | **Voulu** (iOS : le grand titre passe sous la barre au défilement, le petit paraît). Le grand titre est bien en haut de page (capture `apres/E-*-defile.png`). | rien | — |
| 4 | Ventes › En route : prix, « Livrée », logo empilés | `.n-vt-ligne` (ventes-lisibles.css, morceau à la demande) et `.n-vt-valeur` (tableau.css, feuille de l'app : `inline-flex; column`) dans la MÊME couche, même spécificité : l'ordre des feuilles décide. La copie d'un écran (`chargerFeuillesCopie`) et le préchargement posent la feuille du morceau AVANT `App-*.css` ⇒ la colonne gagne. | `.n-vt-valeur.n-vt-ligne` (spécificité) : la rangée gagne quel que soit l'ordre. Ventes.jsx pas touché (#1404). | R |
| 5 | « Pas revue récemment » sur chaque rangée ; « Mis à jour à l'instant » ET « il y a 5 h » | (a) `RangeeArticle`/`CarteAnnonce` écrivent l'état sur chaque rangée. (b) La 2e capture est la COPIE de l'écran (83/16/75, chiffres d'il y a 5 h) : elle avait copié le texte « Mis à jour à l'instant » de sa prise, à côté de sa propre mention « il y a 5 h ». | (a) ≥ 2 rangées d'un compte « à confirmer » ⇒ l'en-tête du compte le dit une fois (`data-ad-etat-groupe`, « · N » si ce ne sont pas toutes), un point gris discret sur les rangées concernées (aucun si toutes). (b) `data-copie-vide` : la copie garde la boîte, pas l'heure relative (`n-ad-maj-texte`, `n-tt-maj`, `n-tb-lu`). | P (a) ; (b) non rejoué au banc |
| 6 | toast « 2 nouveaux codes de retrait » qui reste | Le toast part seul en 4 s, mais le MÊME texte redit remplace le précédent et remet ses 4 s à zéro. Cause probable : deux écrans montés (Aujourd'hui + Achats gardés) se renvoient l'état « vu » (`CLE_RETRAITS_VUS`) et ré-annoncent le même colis à chaque relecture. | Une annonce (clé + raison) une seule fois par ouverture de l'app (`RETRAITS_DEJA_DITS`, Comptabilite.jsx). | non reproduit au banc (la base n'a pas de colis à retirer) |

## Films de chargement (5 onglets, 390 px, base à 900 ms, 1re et 2e ouverture, une image / 150 ms pendant 6 s)

Outil jetable `scripts/bancs/_film-25nov.cjs` ; planches `…/scratchpad/rg/film-{avant,apres}-{onglet}-{premiere,deuxieme}.png`.
Mesure de référence : `scripts/bancs/chargement-structure.cjs` (CLS) avant / après — voir le rapport de session.

## Pas vérifié
- Sur un vrai iPhone (le morceau eBay tenu est une hypothèse de réseau ; la correction tient quel que soit le cas).
- Le toast (§6) et la copie (§5b) : par lecture du code, pas rejoués au banc.

## Suite (branche `claude/onglets-fluides`) — passages d'onglet (« améliore encore l'affichage quand les données apparaissent »)

Mesure `scripts/bancs/_passages-onglets.cjs` (base à 700 ms, Aujourd'hui → Annonces → Ventes → Achats → Argent → Aujourd'hui puis
2e tour, une mesure par image ; banc `regressions-25nov` cas O). Images avec squelette / sauts > 4 px (avant = main du 25 nov. avant #1405) :

| passage | 390 avant | 390 après | 1512 avant | 1512 après |
|---|---|---|---|---|
| 1re visite Ventes | 1 image grise | 0 | 1 | 0 |
| 1re visite Achats | 1 | 0 | 1 | 0 |
| 1re visite Argent | 1–2 | 0 | 1 | 0 |
| retour Aujourd'hui | 0–17 sq, 0–2 sauts | 0 / 0 | 9 sq, 6 sauts (−19 / +105 px) | 0 / 0 |
| 1re visite Annonces | squelette de l'écran (lit sa liste) | idem | idem | idem |
| 2e visite (tous) | 0 / 0, défilement retrouvé | idem | idem | idem |

Causes et corrections :
- **Image grise à la 1re visite** (`src/AttenteEcran.jsx`) : l'écran déjà rempli n'était conclu « peint » qu'après une image
  (effet + observateur). Conclu dans un effet de mise en page quand le premier écran n'a aucune brique d'attente.
- **« Par site » au retour sur Aujourd'hui** (`src/natif/ecrans/Aujourdhui.jsx`) : depuis #1400 la carte n'existe qu'à 2 sites, mais
  sa place était tenue 3 s par un squelette puis rendue (−19 px). Désormais `PlaceGardee` (la hauteur de la dernière fois, 0 s'il n'y était pas).
- **« Dernières ventes » insérée tard** (même fichier) : au remontage, ses lignes se recalculaient une image plus tard et la colonne
  entrait dans la grille (« Tes chiffres » +105 px). Les lignes déjà montrées dans la page, pour ce compte (`vrm_local_owner`), restent
  pendant le temps de grâce.
- **Fondu** (`src/passageOnglet.js`) : 150 ms au téléphone et à l'ordinateur (180 avant), opacité seule, coupé sous prefers-reduced-motion.
- Préchargement des morceaux des onglets : existait déjà (`prechargerOnglets`), inchangé.
