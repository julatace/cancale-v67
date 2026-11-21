# 10 nov. 2026 — Lot AM : Annonces « Toutes » en grille, rangée par compte

Branche `claude/annonces-grille` (depuis `origin/main`, `origin/main` refusionné par un vrai `git merge` avant
la fin). Pas de PR, pas de fusion : à intégrer par le coordinateur. Rien dans `vinted-sync-extension/`.

Julien (propositions du 9 nov., 21 h, demande 15) : « la disposition par compte de Vinted me plaît (grille de
cartes : case, photo, N°, titre, état, prix) ⇒ la même pour Toutes, en gardant toutes les fonctions (liaison des
achats…) ; les propositions collées entre elles cachent le produit ⇒ à corriger ». Puis, le 10 nov., sur une
capture iPhone de la grille d'avant (« Améliore ça stp ») : une carte ouverte s'étire et laisse un grand vide sous
sa voisine ; titre coupé « Adidas Handball S… » puis un blanc avec l'icône note seule ; « Accepter / dès » coupé,
libellés soulignés en pointillés ; des « — » isolés qui prennent une case ; « Ranger au stoc » tronqué ; deux
gabarits différents ; le « V » répété sur chaque carte.

## Ce qui change (affichage seulement)

| avant | après |
|---|---|
| « Toutes » : des fiches (achat, mini, refuse, boost, marge, gestes) côte à côte, 2 colonnes au téléphone | une **grille de vignettes** comme le dressing Vinted : photo carrée, N° en pastille, titre sur 2 lignes, prix, une ligne d'état (« Très bon état ») et une de chiffres (vues · favoris · jours) ; « À confirmer », « Boostée » et **« En double »** (lot AF, mêmes groupes que l'alerte) posés sur la photo |
| toutes les annonces mélangées, compte nommé sur chaque carte + « V » | **un en-tête par compte** (initiale dans un rond, comme la carte du compte de la colonne, nom, « N annonces ») ; ni le nom ni le « V » sur la vignette (Leboncoin/eBay restent : présence prouvée ailleurs) |
| « Détails et gestes » étirait la carte dans sa colonne | toucher la vignette (ou son chevron, ou « Détails et gestes » au clavier) **l'ouvre en place sur toute la largeur** : la fiche entière, sans étirer aucune voisine ; sur ordinateur photo à gauche, tout à droite |
| chiffres en 4 cases étroites (« Accepter / dès » coupé, « — » isolés) | ouverte : **des rangées pleine largeur** (État · Prix d'achat · Accepter dès · Refuser sous · Boost payé · Marge), libellé à gauche jamais coupé, valeur à droite, toute la rangée se touche ; plus de pointillés |
| « Ranger au stoc » tronqué, icône coupée | gestes **pleine largeur** au téléphone (libellé entier, icône entière, `display:flex`, jamais `inline-flex`), en rangée à leur largeur sur ordinateur ; « … » dit « Autres gestes » |
| « Même paire ? » : cartes côte à côte au-dessus de la grille | la proposition est **sur la vignette** de la nouvelle annonce (l'ancienne paire en petit avec son N°, « Même paire que N°7 ? » ⓘ, [Oui] [Non]) ; en tête, une pastille ambre « N · Même paire ? » y mène (`data-remise-bloc`, cible d'À trancher). Une proposition dont l'annonce n'est pas montrée (recherche, autre vue) garde sa carte en tête : rien n'est perdu |
| toucher la photo : l'annonce sur Vinted | la **visionneuse unique** (`src/visionneuse.js`, elle garde le lien Vinted) |

2 colonnes à 390 px, 4 à 6 à 1512 px (`minmax(188px, 1fr)`). Les autres vues (Sélectionner, Republier,
Brouillons, Masquées, Sans achat relié, À relancer) ne changent pas.

**Rien ne disparaît** : la vignette EST la fiche d'avant (même élément, mêmes `data-*`, mêmes écritures
`updatePair`, `poserNumero`, `ecrirePrixTape`) ; ce qui ne se lit qu'ouverte est replié par la feuille de style,
jamais retiré du DOM. La note privée (lot BD) reste visible sur la vignette si elle existe ; l'icône « ajouter une
note » seule n'apparaît qu'ouverte. Sélection, actions, baisse de prix, Republier : leurs vues, inchangées.

**L'ordre et « en ligne » (§5) ne changent pas** : `src/annoncesGrille.js` (pur) reçoit `annShown` (déjà filtré
et trié par l'écran) et le range par compte en gardant l'ordre de chaque annonce ; un compte prend la place de sa
première annonce (le compte de l'onglet, mis en tête par l'écran, reste en tête). n en entrée = n en sortie.

## Code

- `src/annoncesGrille.js` : `groupesParCompte`, `initialeCompte`, `remisesSurVignettes`.
- `src/App.jsx` : `annGroupes`, `annEnDouble` (mêmes groupes que `groupesDeuxFois`), `annGrilleMontree` ;
  `remisesParts`, `carteRemise(r, surVignette)` (une seule forme de la proposition, tête ou vignette) ; la grille
  `data-ann-grille="vignettes"`, l'en-tête `data-ann-compte`, la vignette (`vrm-vignette`, `data-vignette-cle`,
  toucher hors lien/bouton/champ ⇒ `basculerFiche`), `data-vignette-en-double`, `data-stats-compte`.
- `src/styles-annonces-grille.css` (`@layer vrm-premium`, importé après la DA6).

## §4.11 — écrans montés, avant / après

`origin/main` et la branche : `tab===` 28 distincts / 49 occurrences, `GardeEcran` 39 ; `<ChoixAnnoncesVinted` 1,
`<QuiDorment` 1, `<AchatsARelier` 1, `<AnnoncesMasquees` 1, `<EnLigneDeuxFoisAlerte` 1, `<RepublierVinted` 4,
`<BaissePrixSerie` 1, carte `data-carte-annonce={it.id}` 1 — identiques.

## Preuves

- **Nouveau banc `scripts/bancs/annonces-grille.cjs`** (deux comptes, sept annonces inventées ; 390 tactile et
  1512, clair et sombre ; G1–G11 dont les trois demandés : « carte ouverte ⇒ aucune vignette voisine étirée »,
  « aucun libellé coupé/tronqué » (texte qui déborde ou passe sur deux lignes, fermée et ouverte), « un seul
  gabarit de vignette » (même hauteur)) : **96 verts, 0 rouge**.
  Sur `origin/main` (git archive, son build, le banc copié dedans) : **42 rouges** (pas de grille ni d'en-tête,
  titre coupé sur une ligne, achat/mini/refuse/boost/marge, « V » et compte sur chaque vignette, « Même paire ? »
  hors de la vignette, la vignette ne s'ouvre pas au toucher…).
  Mutations (git archive HEAD, mutation, build, banc) : ordre rangé par n° au lieu de l'ordre de l'écran ⇒ 4
  rouges (G2) ; ce qui ne se lit qu'ouverte plus replié ⇒ 4 rouges (G4) ; vignette ouverte sans pleine largeur
  ⇒ 8 rouges (G7).
- Captures regardées (390 tactile et 1512, clair et sombre) : grille fermée, vignette ouverte, prix d'achat saisi,
  « … », « Même paire ? », visionneuse. La capture 390 d'`origin/main` reproduit celle de Julien (titre coupé, icône
  note seule, compte + « V » sur chaque carte).
- `npm run build` ; audits `variables`, `tdz`, `coherence`, `identite`, `icones`, `annonces-actions` (69),
  `annonces-coherence` (29) verts.
- Bancs Annonces (un à la fois, `BANC_PORT` aléatoire) : `annonces-coherence` 130 verts, `annonces-retirees`,
  `annonces-outils`, `baisse-prix` (57) verts ; `annonces-carte` mis à la grille (il ouvre chaque vignette avant
  de la lire, photo ≥ 150 px à deux colonnes) — ses 5 rouges restants sont ceux d'`origin/main` (saisie 18 €,
  baisse eBay, G22 ×2, recherche). `note-achat-double` vert (il ouvre la vignette avant l'icône « ajouter une
  note » ; la note écrite se lit sur la vignette fermée) ; `popups-propre` **239/0** (P3 lit la proposition sur sa
  vignette : l'ancienne paire dans la bande + la vignette) ; `numero-ou-remise` **103/0** (boutons [Oui] [Non] de la
  vignette à 44 px) ; `navigation-fusion` 45 verts.
- Rouges hérités, **identiques sur `origin/main`** (arbre `git archive`, mesuré) : `annonces-actions` (A « deux
  comptes mélangés », K « la masquée partie ⇒ N°45 ») et `annonces-ventes-brouillon` (23, dont « les annonces sont
  rendues — 0 » : le banc n'arrive pas à l'écran Annonces).

## Planches

`docs/passation/planches-annonces-grille/` (données inventées) : `avant-390-clair` (la grille d'`origin/main`, les
défauts de la capture de Julien), `apres-390-{clair,sombre}-{fermee,ouverte}`, `apres-390-clair-meme-paire`,
`apres-1512-{clair,sombre}-fermee`, `apres-1512-clair-achat-saisi` (vignette ouverte), `apres-1512-clair-menu` (« … »).

## Ce qui reste

- Julien : regarder Annonces au téléphone (grille, vignette ouverte, « Même paire ? »). Aucun geste technique.
- Une vignette qui porte « Même paire ? » est plus haute que ses voisines (la question est sur elle, voulu).
- L'en-tête de compte est montré même avec un seul compte (il nomme le dressing).
