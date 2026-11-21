# 14 nov. — Design : la passe écran par écran

Julien (13 nov.) : « l'appli est pas très belle, tout doit être revu » ; « je veux que tout soit beau,
cohérent, simple ». Le système (`src/styles-systeme.css`, `docs/design/DESIGN.md`, récit
`2026-11-13-design-systeme.md`) était en ligne ; restait la passe écran par écran que l'agent design
précédent avait listée (§6 de son récit). Branche `claude/design-passe-ecrans` (depuis `origin/main`
bff95685), poussée à chaque commit, pas de PR. Aucune donnée réelle : base INVENTÉE de
`scripts/bancs/_base-volume.cjs` (3 comptes, vignettes SVG inventées), garde réseau.

**Rien de métier ne change** : aucun texte (aucune chaîne ajoutée ni modifiée, hors la ligne de
« Quoi de neuf »), aucun chiffre, aucun `data-*` retiré, aucun geste. Forme seulement.

## 1. Ce qui a été mesuré AVANT (origin/main construit, banc `design-passe`)

Ma journée, Ventes, Colis, Annonces, Stock, Argent, Paramètres, la loupe (« Tout sur le N° ») et la
fiche « Tout sur le N° », 390 tactile ET 1512, clair ET sombre (36 rendus, deviceScaleFactor 1) :
**1 839 défauts, 36 rendus rouges sur 36** (390 : 687 ; 1512 : 1 152).

| mesure | avant (390 + 1512) | après |
|---|---|---|
| cibles sous 44 px au doigt / 36 à la souris | 96 (« Choisir la vente » 34, filtres et puces 32, « Me le rappeler » 30, repli 32) | 0 |
| graisses hors 400/600/700 (le 500) | 1 074 | 0 |
| tailles hors de l'échelle | 424 (10, 14, 16, 19, 22, 52, 93,5, 128…) | 0 |
| gris écrits à la main (texte) | 167 (#5E5E63, #636366, #2C2C2E, #E5E5EA…) | 0 |
| contraste sous 4,5:1 | 54 (« 36 » 4,40/4,47:1 ; « 18 » 3,1:1 ; « / » 4,03 ; Stock 2,35) | 0 |
| mots coupés au trait d'union (« xt- / 6 ») | 24 | 0 |
| chiffres rognés · violet · Chronopost jaune · cadre de la carte MFA | 0 | 0 |

## 2. Ce qui change

**Le système (`src/styles-systeme.css`)**
- `--d-h-filtre` : **36 à la souris** (32 avant) — une seule hauteur de contrôle par pointeur (44 au
  doigt, 36 à la souris) ; `DESIGN.md` §7 suit. Les filtres d'Annonces, les puces de compte, les vues,
  les puces du Stock passent de 32 à 36.
- §2.10 (neuf) « la passe écran par écran » : les 500 restants (notes → 400, libellés → 600) ; le
  compte d'un segment ou d'un filtre (« Envoyés · 18 », « À compléter 36 ») à l'ENCRE du libellé en
  400 (le gris sur la piste grise ne tenait que 3,1 à 4,4:1 — **le « 36 » est réglé**) ; titres de
  section de Colis 22 → 20 ; textes de bouton 14 → 13 ; prix et titres des vignettes → 20 / 15 ;
  jours de la semaine → 15 ; chiffre d'Argent 32 → 28, « — » à 20/400 ; LE gris dans les tuiles
  d'Argent (plus le #5E5E63 « un cran plus sombre » de la tuile grise d'avant) ; touche « / » de la
  recherche lisible ; libellés de la colonne de gauche à l'encre (`--n2-libelle` lit `--d-encre`) et
  au texte d'un contrôle ; « Pro » à l'encre ; Paramètres : la SECTION n'est plus une carte (une ombre
  sur la section transparente dessinait une carte autour du titre « Mes comptes »).
- Exception documentée : la colonne de gauche garde SON gris `--n2-titre` (#636366) — sur son
  panneau #E5E5EA, LE gris ne tient que 4,1:1 (mesuré). Le banc l'admet là seulement.

**À la source (styles en ligne, script)** — 31 fichiers `.jsx` : `fontWeight: 500` → 400 (600 si la
taille du même objet est entre 15 et 20) ; 650 → 600 ; 800 → 700 ; `fontSize` 14 → 15 (13 si gris),
16 → 15 (17 si ≥ 600), 18 → 17, 19 → 20, 22 → 20, 38 → 34. **97 feuilles CSS** : le 500 → 400 (600
quand la même règle pose 15–20 px). Outils : `scratchpad/outils/normaliser_inline.py`,
`normaliser_css500.py` de la session (non versionnés).

**La fiche « Tout sur le N° » (`src/styles-fiche-paire.css`, `src/FichePaire.jsx`)** — ramenée au
système : grand N° 40/700 (44 à l'ordinateur), police du système (plus 128 px en 500 mono) ; trois
tuiles = cartes rayon 20, libellé 13/600 gris, chiffre 20/700 (28 dès 700 px), « — » en 400
(`is-vide`, une classe) ; « L'état » = un titre de section 20/700 et UNE carte (⚠️ `.vrm-fp-etat`
est aussi l'encadré de la facture Pro, `facture-pro.css`, qui posait un cadre 1 px ici, visible la
nuit : la fiche le remet à zéro) ; « Ajouter une note » et « Me le rappeler » = deux capsules côte à
côte (plus une barre pleine largeur de 30 px) ; « Changer le prix / Publier ailleurs / Dupliquer »
= capsules d'une ligne chacune (plus « Changer le / prix ») ; raccourcis = filtres remplis, une rangée
qui défile au téléphone ; « Modifications enregistrées » = une carte et un chevron qui tourne ;
Bordereau / Emballer = capsules, Emballer l'aplat bleu ; deux paires sous ce N° = `--vrm-doublon`
(le rouge, §5 — `--vrm-danger` y donnait l'ambre).

**La loupe (`src/ecrans/Loupe.jsx`)** — « Tout sur le N° » = UN groupe (carte rayon 20, rangées 15/600
+ note 13 grise séparées par un filet, chevron `--d-glyphe`) au lieu d'une carte par ligne dans une
carte ; sous-titres 13/600 (plus 11/700 en capitales).

**Les titres au trait d'union** — `src/motsInsecables.jsx` (neuf) : un mot à trait d'union de 20 signes
au plus (« xt-6 », « gel-1130 ») dans une portée insécable ; le TEXTE ne change pas (`innerText`,
`title`). Posé sur les titres de colis (Ventes, Colis), les vignettes d'Annonces et la fiche.
(`hyphens: none` n'empêche pas la coupure APRÈS un trait d'union : c'est elle qui faisait « xt- / 6 ».)

**Le reste**
- Compteurs de la barre d'onglets (« 36 », « 30 », « 60 ») : l'encre sur l'orange (8,3:1 ; le blanc
  n'y tenait que 2,2:1) — `styles-premium.css`.
- LE chiffre de la carte sombre : `--d-t-44` (40 téléphone / 44 ordinateur), plus 44 et 52.
- Le film du Stock : une étape en attente à .7 (6:1), plus .38 (2,35:1).
- « Choisir la vente » (litige de N° sur un colis) : 36/44 px, 13 px (`vrm-colis-choisir`).
- Carte « Protège ton compte » : sans cadre À LA SOURCE (rayon 20, ombre posée, aucune la nuit) —
  à l'écran, la règle du système l'effaçait déjà depuis le 13 nov. (le banc G le confirme avant et
  après) ; le liseré vu la nuit sur les captures réduites n'existe pas (pixels relevés : #1C1C1E sur
  #000, aucun trait).
- Chronopost : le cube bleu sur blanc de `src/transporteursVisuels.js` (13 nov.) et `CARRIERS`
  (#009BDE) — aucun jaune, vérifié (le banc H regarde tout `[data-transporteur*="chrono"]` rendu).
- `styles-note-paire.css`, `styles-argent.css` : les deux gris « #5E5E63 » retirés.
- Quoi de neuf : `design-passe-ecrans` (« Fiche du N° et écrans plus nets »).

## 3. Les preuves

- **`scripts/bancs/design-passe.cjs`** (neuf) — mesure sur l'app RENDUE : A cibles (44 doigt / 36
  souris, `getBoundingClientRect`), B graisses calculées, C tailles calculées (échelle 11 · 12 · 13 ·
  15 · 17 · 20 · 28 · 34 · 40 · 44 ; exceptions écrites : libellés de la barre d'onglets à 10 pt —
  décision de Julien en attente ; le chiffre de Ma journée qui se resserre, sa demande du 10 nov.), D
  gris calculés, E contraste contre le fond EFFECTIF (fonds empilés, `color-mix`, opacités ; dégradés
  et animations finies écartés), F mots coupés (Range mot par mot), G cadre de la carte MFA, H violet
  et Chronopost jaune, I chiffres rognés.
  - **avant** (origin/main construit) : ROUGE, 1 839 défauts, 36/36 rendus ;
  - **après** : VERT, 0 défaut, 36/36 (390 et 1512 lancés séparément, < 9 min chacun) ;
  - **mutation** : la règle du compte de filtre retirée ⇒ rouge (« 36 » 4,4:1, « 18 » 3,1:1).
- **Captures REGARDÉES** (390 tactile et 1512, clair et sombre, défilées) : fiche, loupe, Ventes,
  Colis, Annonces, Stock, Argent, Paramètres, Ma journée. Deux défauts vus à l'œil et corrigés (aucun
  contrôle ne les voyait) : la règle `.vrm-roule` qui gonflait les tuiles de Ma journée à 40 px
  (« 1 47… » rogné — d'où le contrôle I) ; la carte autour du titre de section de Paramètres.
- **Bancs** (un à la fois, mémoire ≥ 3 000 Mo, port aléatoire) : `fiche-paire` 48 verts,
  `recherche-fiche` vert, `securite-comptes-avertir` 72 verts, `nouveau-vendeur`, `garde-ecrans`,
  `annonces-grille` 96 verts, `argent` 268 verts. `fiche-paire`, `recherche-fiche` et
  `securite-comptes-avertir` exigeaient 44 px À LA SOURIS : ils jugent maintenant la règle du système
  (44 doigt / 36 souris) — `securite-comptes-avertir` était déjà rouge sur main depuis le 13 nov.
  (36 px mesurés, mêmes 4 rouges). `colis-colonnes` : 2 rouges IDENTIQUES sur main (« Code de retrait
  998877 », hors forme).
- **Audits** : `npm run build`, `traduction`, `tdz`, `icones`, `coherence`, `rouge-doublon`, `violet`,
  `composants`, `variables`, `quoi-de-neuf`, `coque-tablette` verts ; les 372 audits qui lisent un
  fichier touché : 362 verts, 10 rouges IDENTIQUES sur main (`benefice` et `revue-fin` : le même
  « joursAvant déclaré deux fois » d'App.jsx, une ligne plus bas ; `coque-parametres`,
  `frein-relais-vinted`, `label-latest`, `lus-deux-appareils`, `photos-vinted`, `signalement`,
  `stockage-sur`, `vocabulaire-article`). Les zips de `public/` régénérés par les audits ont été
  remis tels quels (jamais commités).

## 4. Ce qui reste

- Hors des 7 écrans + loupe + fiche : les autres écrans (Messages, E-mails, eBay, Leboncoin,
  Vestiaire, Achats, feuilles) n'ont pas été mesurés par ce banc — le 500 et les tailles en ligne y
  sont ramenés par les scripts, les gris et contrastes pas mesurés. `ECRANS=` du banc à étendre.
- Les recherches par N° : chaque rangée de paire porte DEUX fois le numéro (« #125 » à gauche,
  « N°125 » à droite) — une seule écriture du nombre (§7) : à trancher sur la rangée de la loupe.
- La barre d'onglets du téléphone garde ses libellés à 10 pt (Julien doit trancher « 9 px »).
- La colonne de gauche garde `--n2-titre` (#636366) : unifier demanderait un panneau plus clair.
- Les rangées de « L'histoire du N° » gardent une colonne de date de 76 px même quand la date est
  « — » (un grand blanc) ; la croix de la fiche reste à 44 à la souris (une règle commune des croix).
- Les libellés de « Quoi de neuf » ne passent pas par `tr()` (le mécanisme ne le prévoit pas encore).
