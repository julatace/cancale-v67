# 5 novembre — La barre du bas de l'iPhone, revue ; la reprise au même endroit

Demandes de Julien du 5 nov. (`docs/passation/demandes-2026-11-05.md`, §12 et « Précisions du
vocal ») : « la barre d'onglets sur iPhone est à revoir — ça ne marche pas, c'est pas ouf », revue
« TOTALEMENT » ; « quand on quitte l'app et qu'on la rouvre : revenir au même endroit, dans le même
état ». Et, vu sur une capture Edge du matin : libellés du rail coupés (« Ven », « Gér », « Arg »,
« Plat ») et logo « VI ». Branche `v31-iphone-reprise`.

## 1. Ce qui ne marchait pas — mesuré AVANT de coder (390 × 844 tactile, données inventées)

| défaut | mesure (build d'avant) |
|---|---|
| Le geste « retour » avec « Plus » ouvert **quittait VRM** | depuis Ma journée, `history.back()` ⇒ `about:blank` ; depuis Ventes ⇒ Ma journée (au lieu de seulement fermer) |
| La feuille « Plus » **couvrait la barre** et la zone sûre | feuille de 651 px, du haut à 193 px jusqu'au bas de l'écran (844) ; la barre (781–844) dessous, intouchable |
| Sur un iPhone SE, **Paramètres hors de l'écran** | 375 × 667 : `scrollHeight` 651 > 623 visibles, « Paramètres » à défiler |
| Sur un écran de « Plus », la barre **ne disait pas où l'on est** | sur Compta : `Journée · Annonces · 3 Ventes · 3 Colis · Plus*` |
| Un balayage parti du **bord gauche** (le « retour » d'iOS Safari) **changeait AUSSI d'onglet** | Ventes ⇒ Annonces par VRM, puis le retour du système en jouait un second |
| **Le même nombre deux fois** côte à côte (§7) | Ventes « 3 » et Colis « 3 » (la même notion, les colis à poster) |
| « Plus » ouvert, toucher Ventes ou re-toucher « Plus » | impossible : la feuille couvrait la barre |
| Toucher l'onglet où l'on est | ne faisait rien (iOS : remonter en haut) |
| Rien de cassé ailleurs | 5 entrées de 52 px, libellés entiers, le toucher au centre tombe bien sur l'entrée, aucun débordement de côté, la barre reste en bas au défilement |

## 2. Ce qui est fait

### La barre (téléphone seul — `BottomBar`, `MenuEcrans`, `src/styles-barre-iphone.css`)
- **Organisation** : quatre tâches fixes, les plus utilisées (décision du 31 oct., « par tâche ») —
  **Journée · Annonces · Ventes · Colis** — et une **5ᵉ place qui dit où l'on est** : « Plus » en
  temps normal ; sur un écran rangé dans « Plus », CET écran (icône + nom court : Messages, Stock,
  Achats, Stats, Compta, Communauté, Réglages ; `data-plus-ecran`). Le point des messages non lus
  reste sur cette place. Un nom long (« Communauté ») passe à 11 px et la place s'élargit un peu
  (sinon coupé sur un iPhone SE — vu par le banc).
- **« Plus » = un panneau de tuiles** (3 × 3 : Messages, Republier, Favoris & offres, Stock, Achats,
  Statistiques, Compta, Communauté, Paramètres), posé **juste au-dessus de la barre**
  (`--vrm-barre-bas`, mesurée par la barre). La barre reste visible et touchable : re-toucher
  « Plus » ferme, toucher un onglet y va. 270 px de haut : tout tient sans défiler sur un SE.
  Les groupes (Vendre · Gérer · Argent · Moi) restent dans la structure (`data-nav-groupe`,
  `role="group"`) pour les lecteurs d'écran et les bancs.
- **Retour** : le panneau porte `FermeAuRetour` (règle §7) — le geste retour le ferme et reste sur
  l'écran. La feuille d'en-tête aussi.
- **Toucher l'onglet courant** ⇒ remonte en haut (doux, sans animation si mouvement réduit).
- **Bords de l'écran** : un balayage qui commence à moins de 24 px d'un bord (`BORD_SYSTEME`)
  appartient au système ; le balayage au milieu entre onglets existe toujours.
- **Un nombre une fois** : dans la barre, Ventes ne répète plus le nombre de Colis (il reste sur
  Colis). La colonne de l'ordinateur ne change pas.
- Cibles ≥ 44 px (entrées 52 px, tuiles 76 px), zone sûre portée par la barre
  (`max(6px, env(safe-area-inset-bottom))`, bords en paysage), échelle Fusion respectée.

### La reprise (`src/repriseEcran.js`)
- **Rangé** : l'écran (`tab`), sa section / son filtre de site (`sub`), l'onglet de Colis choisi à
  la main (`colis`) — rien d'autre (aucun nombre, aucune donnée, aucune identité). Liste blanche =
  celle des liens `?tab=` (`ONGLETS_LIENS`, partagée).
- **Où** : `localStorage` de l'appareil, sous `vrm_parcours:<owner>:…` (7 jours), effacé au
  changement de vendeur / à la déconnexion (`viderParcours(localStorage…)`, deux chemins). Les
  filtres (`useVueSession`) et le défilement (`MemoireDefilement`) passent du `sessionStorage` —
  qu'iOS vide quand il rouvre l'app installée — au même stockage ; le défilement est aussi rangé au
  passage en arrière-plan (`visibilitychange`), et tenu 6 s au premier écran (données du nuage).
- **Une recherche tapée ne revient que 12 h** (`DUREE_RECHERCHE`) : un mot oublié cacherait des
  annonces trois jours plus tard. Les filtres : 7 jours.
- **Un lien reçu gagne** : une adresse avec `tab=` (notification, e-mail, lien) fait taire la reprise
  entièrement ; `goto` mène au lien comme avant.
- **« Pas su » ⇒ Ma journée** : illisible, autre vendeur, trop vieux, « du futur » (horloge
  reculée), écran hors liste ⇒ `null`.
- Le compte choisi avait déjà sa mémoire par site (`src/compteChoix.js`, 4 nov.) : il revient avec
  l'écran.

### L'ordinateur (le rail sur Edge)
**Non reproduit** dans Chromium : à 1512 × 950, 1512 × 830 (fenêtre d'Edge), 1008 × 633 (Windows à
150 %), zoom de l'app 125 %, police de repli Verdana, nom d'entreprise long, sur 11 écrans, clair et
sombre : la colonne fait 236 px, aucun libellé coupé, « VRM » entier. La capture de Julien (14 h 12)
montrait le bloc plein écran « Recharger » (corrigé le matin même, `2026-11-05-numeros-autre-
appareil.md`) : une hypothèse est qu'un calque recouvrait la colonne à partir de ~45 px — **non
prouvée**. Le banc vérifie désormais, en plus des coupures, que **rien ne passe par-dessus** la
colonne (le toucher au milieu de chaque libellé tombe sur elle). Rien n'a été changé au rail.

## 3. Preuves
- `npm run build` vert.
- `node scripts/audit-reprise-ecran.cjs` : **30/30** ; `--prouve` : **12/12 mutations attrapées**
  (lien ignoré, liste blanche, section libre, tout rangé, recherche 7 j, valeur du futur, filtres en
  `sessionStorage`, départ fixe, sans FermeAuRetour, bord, double nombre, vendeur gardé). Sur l'arbre
  d'avant : rouge (module absent).
- Banc `scripts/bancs/iphone-reprise.cjs` (données inventées, 390 × 844 tactile, 375 × 667,
  1512 px, clair et sombre) : **121/121 vert après** (B 92, R 14, O 15) ; sur le build d'avant (archive de c52bb8ee, banc copié
  dedans) **54 rouges** : B2 ×4, B3 ×8, B4 ×4, B5 ×8, B6 ×4, B7 ×8, B8 ×4, R1 ×4, R2 ×2, R3 ×4
  (+ 4 erreurs de page dues au retour qui sortait de VRM). La partie O (colonne) est verte avant et
  après (voir ci-dessus).
- Mutations du câblage (dans l'audit, sur le source) : retirer `FermeAuRetour`, le bord, le nombre
  unique, la reprise au départ, le stockage de l'appareil ⇒ rouge.
- Bancs voisins, avant / après identiques : `navigation-tache` (4 rouges déjà sur main : onglet
  « Envoyés » de Colis, Colis · Leboncoin), `feuilles-coque` (12 rouges déjà sur main),
  `menu-range` (1 rouge déjà sur main), `coque-mobile` 124/0, `glisser-onglet` vert,
  `parcours-quotidien` vert (banc mis à jour : il importe `stockageParcours`).
- `audit-bancs` : sa lecture de la liste blanche suit `ONGLETS_LIENS`. `audit-coherence`,
  `audit-icones`, `audit-tdz`, `audit-variables`, `fusion-echelle` (le nouveau fichier est sur
  l'échelle ; 4 fichiers hors échelle déjà sur main) : verts.
- Captures regardées : barre et panneau en clair et sombre (390, SE), Compta avec la 5ᵉ place,
  Annonces et Colis rouverts, colonne 1512 clair/sombre.

## 4. Ce qui reste
- **Sur son iPhone** (geste de Julien) : ouvrir « Plus », faire le geste retour, aller sur
  Statistiques puis fermer l'app (balayer) et la rouvrir — elle doit revenir sur Statistiques, au
  même défilement. Le vrai Safari n'est pas émulable ici (zone sûre réelle, geste du bord).
- **Edge** : si les libellés coupés reviennent, une capture avec la fenêtre entière (et le zoom
  d'Edge) ; le banc O vérifie déjà coupures et recouvrement.
- Extension : rien à faire pour ce chantier (aucune capacité nouvelle).
- À décider avec lui : la 5ᵉ place qui prend le nom de l'écran (« Compta ») plutôt que « Plus » —
  si elle le trouble, une ligne suffit à la remettre (`courant`).
