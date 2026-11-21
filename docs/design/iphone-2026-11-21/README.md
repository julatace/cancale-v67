# Design iPhone — trois directions (21 nov. 2026)

Demande de Julien (21 nov.) : « je pense que tu peux faire mieux pour le design du site sur l'iPhone », après « je n'aime
pas l'affichage sur iPhone » et « ça fait vibe codé ». Il aime le panneau Vintex (sobre, clair, rangées fines, étiquettes
douces) et la structure de Bleam (Accueil, Dressing, Menu en tuiles, sombre élégant). Il ne veut plus : cartes arrondies
empilées, bandeaux en série, CAPITALES (`.n-carte-titre`, `.n-tuiles-titre`, `.n-tuile-libelle`…), gros boutons pleins
partout, petites icônes illisibles.

Ce dossier est un travail de **DESIGN seulement** : rien n'est appliqué au code de l'app. Trois maquettes HTML statiques,
390 × 844, **données inventées** (aucune donnée réelle, photos remplacées par une basket dessinée).

| direction | dossier | en une phrase |
|---|---|---|
| **A — Vintex clair** | `a-vintex-clair/` | blanc, filets, rangées fines pleine largeur, étiquettes pastel, un rond d'encre pour le geste |
| **B — Bleam sombre** | `b-bleam-sombre/` | presque noir, surfaces anthracite, grands chiffres, tuiles, un bleu vif réservé au geste |
| **C — iOS natif réglages** | `c-ios-reglages/` | listes groupées insetées façon Réglages, grand titre 34, séparateurs inset, carrés d'icône |

Chaque dossier : `aujourdhui.html`, `annonces.html`, `ventes.html` (À envoyer), `fiche.html` (fiche article),
`menu.html` (Menu en tuiles), `style.css` (les jetons de la direction en tête du fichier). La barre du bas est la même
dans les trois : **Aujourd'hui · Annonces · + · Messages · Menu**. Mode clair et sombre dans chaque `style.css`
(`data-theme="dark"` sur `<html>`, comme `vinted_dark` dans l'app) ; B est sombre par défaut.

Règles VRM tenues dans les trois : accent rare (un seul plein par écran, ≤ 1 accent visible ailleurs), **ambre = geste à
faire** (offre à trancher, prix d'achat à saisir, « avant demain »), rouge réservé au doublon de N° (absent des maquettes),
**N° en plaque**, cibles ≥ 44 px, aucune capitale d'en-tête (phrases normales), aucune phrase d'explication sous un titre,
la 1ʳᵉ annonce visible dans la moitié haute du premier écran, titre COMPLET avec la taille, « 1 favori » / « 5 favoris ».
⚠️ Dans les maquettes les barres (haut, bas, sélection) sont **opaques** : le Chromium sans GPU des captures ne rend pas le
flou. Dans l'app, `--n-barre` garde sa transparence (valeurs « app » ci-dessous) avec `--n-flou`.

Captures (390 px, deviceScaleFactor 2, regardées et corrigées) et planches : dans le scratchpad de la session (jamais dans
le dépôt). Pour les refaire : ouvrir les HTML dans un navigateur à 390 px de large.

---

## A — « Vintex clair »

**Pris à** : Vintex (filets, rangées fines, étiquettes douces, « ⋯ », compte en petit menu), Linear (densité, encre
quasi noire pour l'action), iOS (barre du bas, cibles). **Composition** : pas de cartes ; listes pleine largeur séparées
par un filet indenté au début du texte ; une bande de 3 chiffres séparés par des filets ; un seul encart ambre « 3 choses
à faire » qui ouvre la feuille de tout ce qui attend un geste ; onglets soulignés (« En ligne 184 · Brouillons 4 … »).
**Action principale** : le « rond d'encre » compact (encre pleine, 36 px affichés + zone 44, rayon 10) — « Imprimer 4 »,
« Changer le prix ». Le bleu n'apparaît que sur l'étiquette « Prêt » (teinte) : l'accent devient vraiment rare.
**Densité** : 8 annonces sur le premier écran d'Annonces.

### Jetons à poser dans `src/natif/jetons.css`

| jeton | clair | sombre |
|---|---|---|
| `--n-fond` | `#FFFFFF` | `#0E0E10` |
| `--n-carte` | `#FFFFFF` | `#0E0E10` (les listes n'ont pas de fond propre) |
| `--n-carte-2` (champ, plaque, vignette vide) | `#F6F6F7` | `#18181B` |
| `--n-trait` (filet) | `#EBEBEE` | `#25252A` |
| `--n-encre` / `-2` / `-3` | `#18181B` / `#6B6B74` / `#A1A1AA` | `#F2F2F3` / `#9C9CA5` / `#66666F` |
| `--n-accent` | `#0068D6` | `#4C9DFF` |
| `--n-plein` / `--n-sur-plein` | `#18181B` / `#FFFFFF` (ENCRE, plus le bleu) | `#F2F2F3` / `#0E0E10` |
| `--n-teinte` / `--n-sur-teinte` | `#EAF2FD` / `#0A58B0` | `rgb(76 157 255/.15)` / `#8EC3FF` |
| `--n-ambre` / `--n-ambre-fond` | `#8A4B00` / `#FFF3DC` | `#FFB340` / `rgb(255 179 64/.14)` |
| `--n-ambre-point` (nouveau, la pastille ronde) | `#E59400` | `#FFB340` |
| `--n-neutre` / `--n-sur-neutre` (nouveaux : étiquette grise, plaque) | `#F1F1F3` / `#55555D` | `#202024` / `#B4B4BC` |
| `--n-doublon` | `#D70015` | `#FF453A` |
| `--n-barre` (app, sous `--n-flou`) | `rgb(255 255 255/.92)` | `rgb(14 14 16/.90)` |

**Texte — 4 tailles** (police système, `tnum`) : `--n-t-1: 650 26px/32px` (titre de page, chiffres de la bande, prix de
la fiche ; fiche : 22/28) · `--n-t-2: 500 15px/20px` (titre de rangée, onglets, boutons ; prix 600) ·
`--n-t-3: 400 13px/18px` (phrase grise, en-tête de section en **600 encre**, sans capitales) · `--n-t-4: 500 11px/14px`
(étiquette, plaque, libellé de la barre du bas). Correspondance : `--n-t-affiche`, `--n-t-grand` → t-1 ;
`--n-t-section`, `--n-t-barre`, `--n-t-corps(-fort)` → t-2 ; `--n-t-second(-fort)`, `--n-t-legende(-fort)` → t-3 ;
`--n-t-onglet` → t-4.

**Mesures (grille de 4)** : marge 16 · rangée 60 (`--n-h-rangee`, nouveau) · vignette 40 (`--n-vignette`, nouveau),
rayon 8 · étiquette 20 de haut, rayon 6 (`--n-r-etiquette`, nouveau) · plaque 18, rayon 5 · champ et bouton 36, rayon
10 · tuile de menu 56, rayon 12, filet 1 px · barre du bas 49 + zone sûre, icônes 26, libellé 11/500, « + » = carré
d'encre 46 rayon 14 · espaces entre sections 20, dans une rangée 12.

---

## B — « Bleam sombre »

**Pris à** : Bleam (Accueil en tuiles, Menu en tuiles 2 colonnes, sombre anthracite, « À traiter »), Revolut / Oura
(LE chiffre en très grand, calme autour), Spotify (photo pleine largeur sur la fiche). **Composition** : Aujourd'hui =
grand chiffre 40 + jauge fine + 4 tuiles (À envoyer · À retirer · Messages · En ligne) + le plein + « À traiter » en UN
bloc ; Annonces = rangée de 4 chiffres-segments (184 en ligne souligné de bleu) puis la liste pleine largeur ; Ventes =
segmenté + « 6 colis · 4 bordereaux prêts » ; fiche = photo bord à bord, prix 40, 3 tuiles (vues, favoris, bénéfice).
**Action principale** : plein bleu vif 48 px, rayon 14, pleine largeur, dans une barre fixe au-dessus des onglets
(« Imprimer 4 bordereaux », « Changer le prix ») ; le « + » de la barre est un disque d'ENCRE (jamais deux bleus).
**Densité** : 7 à 8 annonces (vignette 48).

| jeton | sombre (défaut) | clair |
|---|---|---|
| `--n-fond` | `#0B0B0C` | `#F4F4F5` |
| `--n-carte` (surface) | `#161618` | `#FFFFFF` |
| `--n-carte-2` | `#1F1F23` | `#EBEBEE` |
| `--n-trait` | `rgb(255 255 255/.07)` | `rgb(0 0 0/.07)` |
| `--n-encre` / `-2` / `-3` | `#F4F4F5` / `#9B9BA3` / `#68686F` | `#121214` / `#6A6A72` / `#9E9EA6` |
| `--n-accent` = `--n-plein` | `#4DA3FF` (texte dessus `#03101F`) | `#0A72E8` (texte dessus `#FFFFFF`) |
| `--n-teinte` / `--n-sur-teinte` | `rgb(77 163 255/.14)` / `#8EC5FF` | `rgb(10 114 232/.10)` / `#0A5FC2` |
| `--n-ambre` / `--n-ambre-fond` / point | `#FFB340` / `rgb(255 179 64/.13)` / `#FFB340` | `#8A4B00` / `#FFF1D6` / `#E59400` |
| `--n-doublon` | `#FF453A` | `#D70015` |
| `--n-barre` (app) | `rgb(11 11 12/.92)` | `rgb(244 244 245/.92)` |

**Texte — 4 tailles** : `600 40px/44px` affiche (LE chiffre, prix de la fiche ; `letter-spacing:-1.2px`) ·
`600 22px/28px` titre (titre de page, chiffres des tuiles et des segments) · `500 15px/20px` corps (rangées, boutons,
sections en 600) · `400 13px/18px` légende (phrase grise, libellés de tuile ; étiquettes 500 12 incluses ici).
**Mesures** : marge 16 · rangée 64 · vignette 48 rayon 10 · tuile rayon 14, padding 12/14, 84 de haut · bloc de surface
rayon 16 (UN par section, jamais empilé carte sur carte) · champ 40 rayon 12 · segmenté 40 (piste surface, choix
surface-2) · ronds d'en-tête 44 sur surface · étiquette 22, rayon 11 (pilule) · plaque 20, rayon 6, liseré 1 px ·
barre du bas libellé 11/500, icônes 26, « + » disque 50.

---

## C — « iOS natif réglages »

**Pris à** : Réglages et Santé d'iPhone (listes groupées insetées, carrés d'icône, séparateur inset qui part du texte,
segmenté iOS, barre de navigation à texte bleu), Apple (grand titre 34, retenue). **Composition** : grand titre +
avatar ; Aujourd'hui = un groupe « Vendu en novembre » (34) puis « À faire » (rangées 44 à carré d'icône, ambre pour un
geste, gris sinon, compte à droite, chevron) ; listes en groupes insetés ; fiche = photo 4:3 insetée, groupe titre +
prix, groupes « Sur les sites » et « Détails » en paires libellé/valeur. **Action principale** : plein accent 50 px,
rayon 14, dans la marge des groupes ou dans la barre d'outils au-dessus des onglets. Les actions de navigation
(« ‹ Aujourd'hui », « Tous les comptes », « Modifier ») sont du texte accent — c'est la convention iOS, mais c'est AUSSI
ce qui rend l'accent moins rare que dans A. **Densité** : 6 annonces (corps 17 et marges insetées).

| jeton | clair | sombre |
|---|---|---|
| `--n-fond` | `#F2F2F7` | `#000000` |
| `--n-carte` | `#FFFFFF` | `#1C1C1E` |
| `--n-carte-2` (remplissage : recherche, segmenté, plaque) | `rgb(118 118 128/.12)` | `rgb(118 118 128/.24)` |
| `--n-trait` (0,5 px) | `rgb(60 60 67/.22)` | `rgb(84 84 88/.60)` |
| `--n-encre` / `-2` / `-3` | `#000000` / `#8A8A8E` / `#C4C4C7` | `#FFFFFF` / `#98989F` / `#48484A` |
| `--n-accent` = `--n-plein` | `#0068D6` | `#409CFF` (plein `#0068D6`) |
| `--n-icone` (nouveau, carré d'icône neutre) | `#8E8E93` | `#636366` |
| `--n-ambre` / `--n-ambre-fond` / `--n-ambre-plein` (carré d'icône du geste) | `#8A4B00` / `#FFF4DD` / `#F29B00` | `#FFB340` / `rgb(255 179 64/.16)` / `#E89400` |
| `--n-curseur` (segmenté) | `#FFFFFF` | `#636366` |
| `--n-doublon` | `#D70015` | `#FF453A` |
| `--n-barre` (app) | `rgb(249 249 251/.86)` (inchangé) | `rgb(22 22 24/.86)` |

**Texte — 4 tailles** (les tailles d'iOS) : `700 34px/41px` (grand titre, chiffre, prix) · `400 17px/22px` (rangée,
600 pour le titre de fiche et des tuiles) · `400 15px/20px` (phrase grise) · `400 13px/18px` (en-tête et pied de groupe,
segmenté, étiquettes ; libellé de la barre du bas 11 toléré). `--n-t-section` 22 et `--n-t-legende-fort` disparaissent.
**Mesures** : groupe inseté marge 16, rayon 12, rangée 44 (une ligne) / ~64 (article), padding 16 · séparateur 0,5 px
qui part du texte (jamais de la vignette) · carré d'icône 30, rayon 7, glyphe 19 blanc · vignette 44 rayon 8 · plaque
19 rayon 5 · recherche 36 rayon 10 · segmenté 32, rayon 9 · tuile de menu 76, rayon 12 · en-tête de groupe 22 au-dessus,
7 sous · barre du bas icônes 27, actif en accent, « + » disque gris 46.

---

## Le lot qui applique la direction choisie à TOUTE l'app (un seul lot)

1. **`src/natif/jetons.css`** : remplacer les valeurs des tableaux ci-dessus (clair + `[data-theme="dark"]`) ; ajouter les
   jetons nouveaux (`--n-h-rangee`, `--n-vignette`, `--n-r-etiquette`, `--n-neutre`, `--n-sur-neutre`,
   `--n-ambre-point`, et pour C `--n-icone`, `--n-ambre-plein`) ; ramener les 7 tailles aux 4 de la direction (garder
   les noms `--n-t-*`, ils pointent sur les 4 valeurs : aucun écran à toucher pour ça). Banc `natif-galerie` : remesurer
   les contrastes (4,5:1) après le changement.
2. **Capitales — les retirer partout, en une fois** : `text-transform: uppercase` + `letter-spacing` d'en-tête dans
   `src/natif/complements.css` (`.n-carte-titre`, `.n-tuiles-titre`, `.n-tuile-libelle`), `src/natif/natif.css`
   (`.n-groupe-titre`, `.n-laterale-titre`), `src/natif/fiche.css` (`.nf-section-titre`), `src/natif/retraits.css`
   (`.n-rp-transp`), `src/natif/anciens-ecrans.css` (l. 181-183 : `.vrm-ios-groupe-titre`, `.v2-groupe-titre`… en
   `!important`), `src/natif/ecrans/{annonces,argent,argent-pont}.css` ; puis les ~130 occurrences restantes de 30
   fichiers (`grep -rn "uppercase" src`) : `styles-ios.css`, `styles-coque.css`, `styles-telephone.css`,
   `styles-mineral.css`, `src/design/*.css`, `App.jsx` (`textTransform`)… Un audit doit l'interdire ensuite
   (`audit-capitales` : aucun `uppercase` hors sigles écrits en dur).
3. **`Page` / `TetePage`** (`Page.jsx`) : A = titre 26/650 à gauche + menu de compte compact (`compte ▾`) + 1–2 ronds ;
   B = titre 22/600 + ronds 44 sur surface ; C = grand titre 34 qui se replie en 17/600 au défilement (déjà là) + actions
   en texte accent. Aucune phrase d'explication sous le titre (le « ? » suffit). `ChampRecherche` : 36 (A, C) / 40 (B).
4. **`Groupe`** (`Groupe.jsx`, `.n-groupe-*`) : A = pas de fond ni de rayon (liste pleine largeur), en-tête 13/600
   encre + compte gris ; B = en-tête 15/600 hors bloc, bloc surface rayon 16 seulement pour « À traiter », « Sur les
   sites », « Détails » ; C = inchangé dans l'esprit (inset rayon 12), en-tête 13/400 SANS capitales.
5. **`Rangee` / `Vignette`** (`Rangee.jsx`) : hauteur par `--n-h-rangee` (60/64/44-64), vignette `--n-vignette`
   (40/48/44), séparateur qui part du TEXTE ; titre sur 2 lignes au plus (`line-clamp:2`, jamais tronqué avant la taille) ;
   ligne grise = plaque N° + logo du site + une phrase ; à droite prix (encre) + au plus UNE étiquette, seulement quand
   l'état n'est pas celui du segment (« Offre 45 € », « En attente », « Pas revue depuis 3 j »).
6. **`Pastille`** (étiquettes) : trois teintes seulement — neutre, teinte bleue, ambre ; hauteur 20/22, rayon 6 (A, C) ou
   pilule (B). Pastille d'onglet / cloche : encre (compte) ou point ambre (geste), jamais bleue, « 9+ ».
7. **`Plaque`** : `--n-neutre` / `--n-carte-2`, 18–20 px, 11–13/600 ; `.is-double` reste le seul rouge.
8. **`Bouton` / plein** (`Bouton.jsx`, `.n-btn-plein`) : UNE forme par direction — A rond d'encre 36/44 rayon 10 ;
   B plein bleu 48 rayon 14 pleine largeur dans une barre fixe (`.fixe`) ; C plein bleu 50 rayon 14. Un seul par écran
   (déjà vérifié par `audit-studio`). Les secondaires : bordure 1 px (A), surface (B), texte accent (C).
9. **`Segmente`** : A = onglets soulignés (trait d'encre 2 px, compte gris après le libellé) ; B = piste surface 40 ou
   rangée de chiffres-segments 22/600 soulignés d'accent ; C = segmenté iOS 32.
10. **`Carte` / `Tuiles` / `Tuile`** (`Carte.jsx`, `complements.css`) : A = bande de chiffres séparés par des filets
    (pas de carte) ; B = tuiles 2 × 2 surface rayon 14 (chiffre 22, libellé 13, icône 20 en haut à droite) ; C = un
    groupe inseté avec le chiffre 34. Libellés en phrase normale.
11. **`BarreOnglets`** : libellé 11 (plus 10), icônes 26–27 au trait 1,75 (lisibles), 5 entrées Aujourd'hui · Annonces ·
    + · Messages · Menu ; actif = encre (A, B) ou accent (C) ; « + » = carré d'encre (A), disque d'encre (B), disque
    gris (C). `FeuillePlus` inchangée.
12. **Menu en tuiles** (écran Menu, `Coque.jsx` / l'écran « Plus ») : rangée compte (avatar + « N comptes ») puis
    sections Gestion · Automatisations · Compte et aide en tuiles 2 colonnes (icône + libellé, pastille ambre pour un
    compte de gestes) ; pied Langue · Apparence · Se déconnecter.
13. **`Feuille`, `Toast`, `Faits`, `Article`/fiche (`fiche.css`)** : rayons et couleurs par jetons ; `Faits` = paires
    libellé / valeur séparées d'un filet (A, C) ou bloc surface (B).
14. **Icônes** (`icones.jsx`, `ICON_PATHS`) : trait 1,75, 22–26 px dans les rangées et barres, jamais < 20 px pour une
    icône qui porte un sens ; `audit-icones` reste vert.

Preuves à exiger de ce lot (règles de `vrm-design`) : 1ʳᵉ rangée d'Annonces ≤ 50 % de 844 à 390 ; ≥ 8 annonces visibles
(A, B) ; aucun `uppercase` ; ≤ 1 plein par écran ; aucun montant en accent ; contrastes 4,5:1 clair et sombre ;
`natif-galerie`, `design-passe*`, `studio-coque` verts ; captures 390 @2x regardées, clair et sombre.

## Recommandation

**A — Vintex clair.** C'est ce que Julien a dit aimer (le panneau Vintex : sobre, clair, rangées fines, étiquettes
douces), c'est la plus dense (8 annonces au premier écran) et la plus calme (l'accent ne sert plus qu'aux étiquettes
« Prêt », le geste est un rond d'encre). On peut lui prendre de B le Menu en tuiles et, si Julien veut plus de « grand
chiffre », la tuile d'Aujourd'hui ; C est la plus « Apple » mais la moins dense et la plus proche de ce qu'il trouve
déjà « vibe codé ».
