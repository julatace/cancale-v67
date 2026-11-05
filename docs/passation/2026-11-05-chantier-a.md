# 5 nov. — Chantier A : jetons et formes de base

Feuille de route : `docs/passation/2026-11-05-revue-coherence.md` (points 1.1, 1.3, 1.5,
1.6, 2.33 « filtre actif blanc en sombre » et 3.1 « casse des tuiles »). Branche locale
`v33-chantier-a`, partie de `claude/project-review-nsk5su`. Rien dans `vinted-sync-extension/`.

## Ce qui change

### 1. Un seul bleu d'accent (1.1)
- `src/themeMineral.js` : `accent` est l'APLAT d'Apple — `#0071E3` en clair, `#0A84FF` en
  sombre — avec `onAccent` BLANC dans les deux thèmes (le sombre posait du texte noir sur
  `#409CFF`). Nouveau jeton `accentTexte` pour les liens : `#0066CC` (5,3:1 sur le gris)
  / `#409CFF` (5,8:1 sur `#1C1C1E`), posé en `--vrm-accent-texte`.
- `src/design/fusion.css` : `--fu-bleu: var(--vrm-accent)` (il n'a plus sa propre valeur) ;
  les `#0071e3` / `#0a84ff` écrits en dur passent par `--fu-bleu` (aplats, traits, focus) ou
  `--vrm-accent-texte` (texte bleu sur une case). Le bouton « Imprimer » de Ma journée était
  `#0071E3` même en sombre (une règle claire plus spécifique) : il suit le thème.
- `jetons.css` : `--fu-lien` lit `--vrm-accent-texte`. Onglet actif de la barre du bas et de
  la feuille « Plus » : `accentTexte`. Bienvenue : `--b-accent` = l'aplat, texte blanc en sombre.
- **Contraste du blanc sur l'aplat (mesuré par le banc)** : 4,70:1 en clair (AA) ;
  **3,65:1 en sombre** — AA pour un grand texte ou une commande seulement (c'est le choix
  d'iOS, demandé tel quel par la feuille de route). À trancher par Julien s'il veut l'AA
  strict la nuit (il faudrait un aplat plus sombre que celui d'Apple).
- ⚠️ Reste : `src/App.jsx` écrit encore `color:C.accent` à 76 endroits (texte bleu). En
  clair il passe de `#0066CC` à `#0071E3` (4,7:1 sur blanc, 4,2:1 sur le gris `#F2F2F7`).
  Les passer à `C.accentTexte` est hors de la zone A (App.jsx) : chantiers B à H.

### 2. Le segmenté : UNE règle (1.3)
`.vrm-seg` / `.vrm-seg-btn` n'ont plus qu'une règle, dans `src/styles-coque.css` : piste
neutre (remplissage d'iOS) rayon 14, segment rayon 12, **14 px de retrait latéral**, 13/600
sur une ligne, `flex: 1 0 auto` (un segment prend la largeur de ses mots ; la piste défile au
lieu de couper), **36 px à la souris, 44 px au doigt** (`(pointer: coarse), (hover: none)`),
segment choisi en aplat (`--seg-actif` : blanc / `#636366`). Retirées : `jetons.css` §5 et §13
(le `padding: 0 4px` qui écrasait tout à 1512, le `height: 44px` posé même à la souris),
`fusion.css` (onglets de Colis, villes à retirer), `styles-vitrine.css` §8, `styles-epure.css`
(pilule 999), `styles-finition.css` §5, `stats-vitrine.css` (période). Hors zone et laissées :
`styles-mineral.css` (`.vrm-seg > button`, battue par la spécificité), `styles-messages.css`
(numéros de questions eBay, 12 px), `styles-colis-colonnes.css` (44 px des onglets de Colis à
l'ordinateur), `outils-stats.css` (`nowrap`).

### 3. Le sélecteur de site (1.3)
`src/SelecteurSites.jsx` : le LOGO seul ; le nom n'est rendu QUE sur le site choisi, au
téléphone comme à l'ordinateur (plus « Vinted Leboncoin eBay Vestiaire » écrits en entier dans
la barre du haut) ; le logo d'eBay est le mot « ebay » : il ne porte jamais un second nom
(`LOGO_EST_LE_NOM`). Le nom reste dans `aria-label` et l'infobulle. Retrait latéral 10 px.

### 4. Les chiffres alignés vont aux nombres (1.5)
- La page entière était en `tnum` : `index.html` (`body { font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "cv05" 1, "ss01" 1 }`, hors zone) et `styles-vitrine.css`
  (`html body { font-feature-settings: "tnum" 1 }`). Retiré de vitrine ; neutralisé par
  `html body { font-variant-numeric: normal; font-feature-settings: normal }` (vitrine) —
  **la ligne de `index.html` est à supprimer** par qui la touchera (elle ne fait plus rien).
- `fusion.css` : plus de `tabular-nums` sur tout `.vrm-fu-ecran` (les nombres ont leurs règles).
- `jetons.css` §15 rend la main sur les blocs qui le posaient à tout leur contenu (cartes
  d'annonce, `[data-chiffres]`, `[data-ann-resume]`, `.vrm-fa`, `.vrm-finance-page .vrm-display`
  — règles d'origine dans `styles-mineral.css`, `favoris.css`, `styles-mobile-studio.css`, à
  retirer par leurs écrans). `stats-vitrine.css` : « Les offres » tabulaires sur les cellules
  de nombres seulement, plus sur l'en-tête ni le nom du compte.
- Polices mortes : imports `@fontsource/inter` et `@fontsource/space-grotesk` retirés de
  `main.jsx` ; `@font-face` Bricolage Grotesque et Geist Mono retirés de `styles-vitrine.css`
  (et les 4 fichiers de `src/fonts/`) ; `'Inter'` retiré des piles `--vrm-police` ;
  `font-family: 'Space Grotesk', inherit` (invalide) retiré de `styles-bienvenue.css`.
  Les paquets `@fontsource/*` restent dans `package.json` (plus importés : à retirer avec le
  verrou, hors zone).
- ⚠️ Reste : 4 `fontVariantNumeric: 'tabular-nums'` EN LIGNE dans `App.jsx` sur des libellés
  (Statistiques : « Ventes », « CA vendu », « Reçu », « Bénéfice ») ; le banc les rapporte à
  part (il ne juge que les feuilles de style).

### 5. Le rouge n'est qu'au doublon de N° (1.6)
- `danger` vaut l'ambre (`warn`) dans les deux thèmes : les 88 `C.danger` (erreurs,
  annulations, pertes, « banni », bordereau détaché…) ne sont plus rouges.
- Nouveau jeton **`doublon`** (`#D70015` / `#FF6961`), posé en `--vrm-doublon`. Dans
  `App.jsx`, SEULS les `C.danger` d'un doublon de N° passent à `C.doublon` (13 lignes :
  `dv==='num'` de Ma journée, « N numéros portés par deux paires » de Ma journée, d'Annonces
  et de Colis, la ligne « Le N°x est porté par un autre article », « Tout sur le N° » quand
  deux paires le portent, la liste du déménagement `dbl`).
- Le Mode emballage et la fiche d'une paire colorent leur doublon avec `var(--vrm-danger)`
  (`styles-emballage.css`, `styles-fiche-paire.css`, hors zone) : `jetons.css` §16 y redirige
  `--vrm-danger` vers `--vrm-doublon` (sinon leur doublon serait passé à l'ambre en silence).
- `scripts/audit-rouge-doublon.cjs` : R1 `danger` = ambre ; R2 `doublon` rouge et posé ;
  R3 `C.doublon` / `--vrm-doublon` seulement là où un doublon est en jeu ; R4 aucun doublon
  coloré par `danger` ; R5 aucun rouge écrit en dur hors doublon, hors couleurs de marque
  (logos de transporteur, Google) et hors une DETTE nommée par fichier, au plafond qui ne peut
  que baisser (App.jsx 12, Room3D 5, operations.css 1, reception-emails.css 1,
  styles-gestion.css 1 — chacune dit son chantier). **25 rouges sur la base, 0 après** ;
  `--mutation` : 7 règles affaiblies, 7 rouges.

### 6. Le filtre actif en sombre (2.33)
Un choix actif « à l'encre » (`var(--vrm-ink)`, blanc la nuit) devenait la pilule la plus
lumineuse de l'écran. En sombre il prend l'aplat du segment actif (`--seg-actif` `#636366`,
texte blanc) : filtres d'état, puces de compte et « Toutes / À répondre / Non lues » de
Messages, filtres de Ventes, vues du Stock, Leboncoin, Favoris, raccourcis du calendrier
(`jetons.css`, une règle). Le sélecteur de site et les segmentés lisent les mêmes jetons.

### 7. La casse des tuiles (3.1)
`::first-letter` en capitale sur les cases de la carte sombre (`.vrm-fu-case > span` :
« Dernier jour », « Avec code », « À vérifier ») et les tuiles de Statistiques. Les libellés
restent écrits en minuscules dans App.jsx (hors zone) ; le rendu est juste.

## Preuves
- `npm run build` vert.
- `scripts/bancs/jetons-coherence.cjs` (données INVENTÉES — le jeu de `nouveau-vendeur` + une
  vente annulée, un compte lu « banni », et un doublon de N° ; `BANC_PORT` 8731 ; 390 tactile
  et 1512, clair et sombre ; 11 écrans) mesure par styles calculés J1 accent unique, J2
  retrait ≥ 10 px, J3 aucun libellé coupé, J4 aucun texte tabulaire, J5 aucun rouge hors
  doublon (et le doublon EST rouge dans Colis), J6 aucun choix actif blanc en sombre, J7 le
  nom du site seulement sur le choisi, J8 majuscule en tête des tuiles.
  **Base (`claude/project-review-nsk5su`, banc copié dans l'arbre d'avant) : 99 rouges**
  (J1 3 — trois bleus d'aplat : #0071E3, #0066CC, #0A84FF/#409CFF ; J2 20 ; J3 6 ; J4 44 ;
  J5 4 — `--vrm-danger` rouge, pas de `--vrm-doublon` ; J6 6 ; J7 12 ; J8 4).
  **Après : 0 rouge, 362 verts.** `JC_MUTATION=1` (anciennes règles remises dans la page :
  segment à 4 px, page en `tnum`, choix actif blanc la nuit, `--vrm-danger` rouge) : J2, J4,
  J5, J6 rougissent. Le banc rapporte à part, sans les juger, les 4 `tabular-nums` EN LIGNE
  de App.jsx (Statistiques).
- `node scripts/audit-rouge-doublon.cjs --mutation` : vert, 7/7 mutations rouges ; sur l'arbre
  de base (copié dedans) : 25 rouges.
- Bancs voisins (base → après, même machine, données inventées) :
  `nouveau-vendeur` vert → vert ; `carte-stats` 114/0 → 114/0 ; `design-fusion` 2 rouges →
  les 2 mêmes (Ma journée, colonne à 1512, autre chantier) ; `navigation-tache` 163/0 → 163/0 ;
  `plateformes-logo` 198/0 → 198/0 ; **`fusion-app` 9 → 21 rouges** — les 9 de la base
  restent, et 12 nouveaux, tous au contrôle F6 (contraste 4,5:1) :
  · 6 en SOMBRE : le texte BLANC sur l'aplat `#0A84FF` (3,65:1 — « Tout imprimer »,
    « Réessayer », « Relier eBay », « + Nouvelle facture », « PDF », une pastille) : c'est la
    valeur demandée par la feuille de route ; avant, `#409CFF` portait du texte NOIR (7:1) ;
  · 6 en CLAIR : du TEXTE bleu écrit `color:C.accent` dans App.jsx sur le gris `#F2F2F7`
    (« ‹ Paramètres », « Ouvrir » de Comptes liés, « En attente » des factures, un « 1 »
    d'Achats) : `C.accent` est désormais l'aplat `#0071E3` (4,21:1 sur le gris) ; ces textes
    doivent passer à `C.accentTexte` (App.jsx, hors zone A).
  Le banc n'est PAS adapté : F6 juge un contraste, pas l'ancien rendu.
- Audits voisins verts : csp, plateformes-logo 60/60, push, vapid, variables, finir-compta,
  couleurs-comptes, coherence, icônes, retrait-qr, statuts. `fusion-echelle --verifier` : les
  mêmes 6 fichiers hors échelle que sur la base (rien d'ajouté).
- Captures (hors dépôt, regardées) : avant
  `scratchpad/captures-avant/jc-*.png`, après `scratchpad/captures-apres/jc-*.png` (60 chacune :
  11 écrans × 390/1512 × clair/sombre + le doublon) — Statistiques 1512 (« Vue d'ensemble /
  Prix qui marche », « Semaine / Mois / Année », « Modèle / Marque… » collés au bord avant,
  14 px après), Colis · À retirer 390 sombre (« Dernier jour / Avec code / À vérifier »,
  « Tous » seul nommé), Messages 1512 sombre (puces de compte et « Toutes » en `#636366`),
  Ventes, Stock, Achats, Ma journée.

## Ce qui reste (hors zone A)
- `App.jsx` : 76 `color:C.accent` → `C.accentTexte` ; 4 `tabular-nums` en ligne sur des
  libellés ; les libellés de tuiles en minuscules ; 12 rouges en dur (dette de l'audit).
- `index.html` : la ligne `body{font-variant-numeric…}` (neutralisée).
- `styles-emballage.css`, `styles-fiche-paire.css` : lire `--vrm-doublon` (puis retirer §16).
- `styles-mineral.css`, `favoris.css`, `dac7.css`, `styles-mobile-studio.css` : leurs
  `tabular-nums` de bloc (puis retirer §15) ; `.vrm-seg > button` de `styles-mineral.css`.
- `package.json` : `@fontsource/inter`, `@fontsource/space-grotesk` plus importés.
- Contraste du blanc sur `#0A84FF` (3,65:1, F6 de `fusion-app` rouge 6 fois en sombre) :
  décision de Julien — garder l'aplat d'iOS, ou `#0071E3` dans les deux thèmes (4,70:1 avec
  le blanc, mais alors les 76 textes `C.accent` d'App.jsx tombent à 3,6:1 la nuit tant
  qu'ils ne lisent pas `accentTexte`), ou texte noir sur `#0A84FF` (5,7:1).
- `scripts/bancs/README.md` : ajouter la ligne du banc `jetons-coherence`.
