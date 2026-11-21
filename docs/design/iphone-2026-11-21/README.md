# Design iPhone — 21 nov. 2026

## ⚠️⚠️ 3ᵉ passe (la plus récente) : V4 « énergique clair » et V5 « premium sombre »

Julien sur V1/V2/V3 : « tu peux faire mieux sur le design » ; il a coché **trop fade / pas d'impact**, **textes et
tailles** (pas assez pro), **boutons et formes** (pas assez finis). Donc : la finition et la structure de Vintex restent,
on y ajoute une **personnalité**. Dossiers `vintex-v4-energique/` et `vintex-v5-premium/` (6 écrans + `composants.html`).
Dans le dépôt les vignettes restent des baskets dessinées ; les captures montrées à Julien (scratchpad) utilisent des
photos réelles découpées dans ses captures — jamais versionnées.

**Critique de V2 (ce qui faisait « gabarit ») et ce qui a changé :**
1. Fade : tout blanc-gris, accent vu une fois ⇒ un parti pris de couleur (V4 vert vif `#12C468` + fond légèrement teinté
   `#F4F5F2` ; V5 « volt » `#D4FF3F` sur quasi-noir) et un **moment** en tête d'Aujourd'hui (carte du chiffre du mois).
2. Typo plate (15/13/12 partout, gris trop proches) ⇒ échelle nette **34 / 22 / 17 / 15 / 13**, titres et chiffres en
   **Inter Display** 700 au tracking négatif (−0,9 px à 34, −2,2 px à 56), trois gris bien séparés, chiffres
   tabulaires seulement dans les colonnes (prix, compteurs).
3. Mur de boîtes à contour identiques ⇒ hiérarchie : plein 50 px 17/600 (UN par écran) ; secondaires 44 ; bouton icône
   44 ; état pressé = enfoncé 97 % + fond plus sombre.
4. Icônes grêles ⇒ un seul jeu au trait 1,6, 20 dans les contrôles, 22 dans les pastilles, 26 dans la barre ; l'onglet
   actif a son icône pleine et un trait d'accent.
5. Étiquettes délavées à contour ⇒ pleines et franches, 24 px, 13/600 ; plaque N° en **encre pleine** (V4) / blanche
   (V5), comme une étiquette de carton ; logos de site en vrais carrés de couleur.
6. Rythme : 32 au-dessus d'un titre de section, 12 dessous, rien entre les rangées d'un groupe (filets 0,5 px) ;
   coins 18 (cartes) / 24 (carte du chiffre, feuilles) ; ombres quasi invisibles ; barres haut/bas en verre (flou).

### Jetons (à poser dans `src/natif/jetons.css`)

| jeton | V4 énergique (clair) | V5 premium (sombre) |
|---|---|---|
| `--n-fond` / `--n-carte` / `--n-carte-2` | `#F4F5F2` / `#FFFFFF` / `#EFF1ED` | `#09090B` / `#141417` / `#1C1C20` |
| `--n-trait` (0,5 px) / `--n-bord` (1 px) | `rgb(16 24 18/.12)` / `rgb(16 24 18/.11)` | `rgb(255 255 255/.09)` / `rgb(255 255 255/.10)` |
| encre / texte / `-2` / `-3` | `#0B0F0C` / `#1E2420` / `#5F6762` / `#98A09B` | `#F7F7F8` / `#E7E7EA` / `#9C9CA4` / `#67676F` |
| `--n-accent` = `--n-plein` / pressé | `#12C468` / `#0EAB5A` | `#D4FF3F` / `#BCE62E` |
| `--n-sur-plein` (texte sur l'accent) | `#03230F` | `#0A0D00` |
| accent en texte (lien) / voile / anneau | `#067A40` / `rgb(18 196 104/.14)` / `.30` | `#D4FF3F` / `rgb(212 255 63/.12)` / `.32` |
| étiquette verte fond / texte | `#DDF6E7` / `#055F31` | `rgb(212 255 63/.12)` / `#DAFF5E` |
| `--n-ambre-fond` / `--n-ambre` | `#FFEDC9` / `#874800` | `rgb(255 176 58/.15)` / `#FFC163` |
| étiquette grise fond / texte | `#ECEEEA` / `#434A45` | `#212125` / `#A6A6AE` |
| doublon : étiquette / plaque pleine | `#FFE1DD`·`#AE2318` / `#AE2318` + blanc | `rgb(255 92 80/.16)`·`#FF8A7F` / `#FF6B5E` + `#1A0300` |
| plaque N° fond / texte | `#0B0F0C` / `#FFFFFF` | `#F2F2F3` / `#0A0A0B` |
| carte du chiffre (Aujourd'hui) | `radial-gradient(120% 90% at 100% 0, rgb(18 196 104/.38), transparent 55%), linear-gradient(160deg,#0A1F16,#0C2C20 55%,#0E3526)` | `radial-gradient(90% 80% at 0 0, rgb(212 255 63/.16), transparent 60%), linear-gradient(180deg,#141417,#101013)` |
| verre des barres (`--n-barre` + `saturate(180%) blur(20px)`) | `rgb(250 251 249/.80)` (maquette : .94) | `rgb(12 12 14/.72)` (maquette : .92) |
| pastille de notification | `#0B0F0C` / blanc, anneau 2,5 px couleur du fond | `#D4FF3F` / `#0A0D00`, anneau 2,5 px |
| ombre | `0 1px 2px rgb(16 24 18/.04), 0 2px 8px rgb(16 24 18/.03)` | aucune (filet 0,5 px) |

**Texte** : `--n-t34: 700 34px/40px` et `--n-t22: 700 22px/28px` en **Inter Display** (OFL 1.1, libre, à livrer en
woff2 à côté de `src/design/polices/inter-latin-wght-normal.woff2`) ; `17/600`, `15/400` (500 pour un titre de rangée),
`13/400` en police système/Inter. Chiffre d'affiche d'Aujourd'hui : 56/700 Inter Display, −2,2 px (le seul).
**Mesures** : marge 16 ; contrôle 44, plein 50, rayon 12 ; carte 18 ; carte du chiffre et feuille 24 ; rangée 68,
vignette 52 rayon 10 ; étiquette 24 pilule ; plaque 22 rayon 6 ; case 22 rayon 7 ; interrupteur 51 × 31 ; barre
d'onglets 49 + zone sûre, icônes 26, libellé 11/600, « + » = pavé d'encre 48 × 40 rayon 14.

**Composants à changer** (un seul lot) : les 13 de la section « famille Vintex » ci-dessous, avec en plus :
`Affiche` (carte du chiffre d'Aujourd'hui : chiffre 56, puce « +412 € · 7 j », 30 barres du `vrm_benefice_jours` déjà
publié — les 7 derniers jours en accent —, objectif, et 3 compteurs séparés de filets) ; `Plaque` pleine ; `Pastille`
pleines sans contour ; `BarreOnglets` en verre, icône active pleine + trait d'accent ; `TetePage` en Inter Display 34 ;
`Groupe` : titre de section 22 Inter Display + compte gris de même taille.

**Recommandation : V4 (énergique clair) par défaut, V5 comme mode sombre.** V4 garde la clarté de Vintex que Julien aime,
gagne l'impact qui manquait (carte du chiffre, vert vif, plaques d'encre, titres d'affiche) et reste lisible en plein
jour ; V5 est la version de nuit, la plus « premium ». Le vert vif ne sert qu'au plein, à l'onglet actif, aux
interrupteurs et aux 7 dernières barres : il reste rare.

---

## 2ᵉ passe : la famille « Vintex » (V1, V2, V3)

Retour de Julien sur les directions A/B/C (plus bas, gardées pour l'historique) : « je veux vraiment que ce soit comme
Vintex, parce que là je n'aime pas trop les boutons, les formes, etc. Ça fait un peu bâclé, je veux que ce soit beaucoup
plus qualitatif. » Référence absolue : ses photos du panneau Vintex (Articles, Commandes, Notifications — jamais
copiées dans le dépôt). Trois variantes du MÊME dessin, mêmes maquettes HTML, trois jeux de jetons :

| variante | dossier | ce qui change |
|---|---|---|
| **V1 — Vintex fidèle** | `vintex-v1-fidele/` | le panneau Vintex transposé tel quel : contrôles 36 px (zone tactile 44 par `::after`), texte 14, rangée 56, vignette 36 |
| **V2 — Vintex, plus d'air** | `vintex-v2-air/` | même dessin, contrôles 44 px, texte 15, rangée 68, vignette 44, marges 20 |
| **V3 — Vintex sombre** | `vintex-v3-sombre/` | les mesures de V1 sur fond anthracite |

Chaque dossier : les 6 écrans (`aujourdhui`, `annonces`, `ventes`, `fiche`, `menu`, `favoris` = « Messages aux favoris »)
et **`composants.html`** — la planche des contrôles en états normal / pressé / désactivé : bouton principal, bouton
secondaire à contour, bouton icône, menu déroulant, segmenté, champ de recherche (vide / saisie / désactivé), case,
interrupteur, étiquettes, plaque N° (et le doublon rouge), rangée de liste, feuille du bas, barre d'onglets.

**Ce qui fait « Vintex »** (relevé sur ses photos, appliqué partout) :
- fond de page `#FAFAFA`, surfaces blanches, **contour 1 px `#E4E4E7`**, filets de rangée `#F0F0F2`, ombre `xs` seulement
  (`0 1px 2px rgb(16 24 40/.05)`), aucune ombre lourde ;
- boutons : fond blanc + contour fin + petit rayon (8 / 10), texte 14 / 15 en 500, **icône fine à gauche** (trait 1,5,
  16 / 18 px) — « Choisir une action ▾ » (texte gris, chevron fin), « ≡ Statut 1 », « ⟳ », « Colonnes » ;
- recherche = champ fin à contour, loupe 16, placeholder gris « Rechercher un article… » ; à la saisie, anneau d'accent ;
- liste = **carte-tableau** à contour 1 px, rayon 12, rangées séparées d'un filet, en-tête de groupe gris pâle
  (« Avant demain 12:00 · 1 » en ambre) ; prix « 54,00 € » ; date grise ; « ⋯ » gris ;
- étiquettes **minuscules, fond pastel, texte coloré, filet de la même teinte** (hauteur 20 / 22, pilule, 11 / 12 en 500) :
  vert = en ligne / prêt / actif, ambre = geste (« Avant demain », « Offre 45 € », compteur à trancher), gris = en
  attente / brouillon, rouge = « N° en double » SEULEMENT ;
- puce de compte « (J) julien.sneak ▾ » comme la puce « tomj683 » ; barre d'onglets : l'actif = icône sur un voile
  d'accent, comme la barre latérale de Vintex ; le « + » = bouton à contour.

**Accent : vert sapin, gardé** (il va avec Vintex, plus sobre que le rose de Vintex et loin du bleu). Il ne sert qu'à : le
bouton principal (UN par écran), l'interrupteur allumé, l'onglet actif (voile), l'anneau de saisie, les mots variables
d'un message. Les montants sont à l'encre.

### Jetons à poser dans `src/natif/jetons.css` (famille Vintex)

| jeton VRM | clair (V1, V2) | sombre (V3) |
|---|---|---|
| `--n-fond` | `#FAFAFA` | `#0F0F11` |
| `--n-carte` | `#FFFFFF` | `#18181B` |
| `--n-carte-2` (en-tête de groupe, plaque, vignette vide) | `#FAFAFA` | `#1C1C20` |
| `--n-bord` (nouveau : contour des contrôles et des cartes, 1 px) | `#E4E4E7` | `#2A2A2F` |
| `--n-bord-fort` (nouveau : case, poignée) | `#D4D4D8` | `#3A3A40` |
| `--n-trait` (filet de rangée) | `#F0F0F2` | `#232327` |
| `--n-encre` / texte / `-2` / `-3` | `#18181B` / `#3F3F46` / `#71717A` / `#A1A1AA` | `#FAFAFA` / `#E4E4E7` / `#A1A1AA` / `#71717A` |
| `--n-appui` (fond pressé) / `--n-piste` (segmenté) | `#F4F4F5` / `#F4F4F5` | `#232327` / `#232327` |
| `--n-accent` = `--n-plein` (vert sapin) / pressé | `#0F6B4C` / `#0B5A3F` | `#3FD49A` / `#2FBF86` |
| `--n-sur-plein` | `#FFFFFF` | `#05150E` |
| `--n-teinte` (voile d'accent) / anneau de saisie | `rgb(15 107 76/.10)` / `rgb(15 107 76/.22)` | `rgb(63 212 154/.12)` / `rgb(63 212 154/.28)` |
| étiquette verte fond / texte / filet | `#ECF7F0` / `#13714A` / `#CFEBDA` | `rgb(63 212 154/.10)` / `#5EE0A8` / `rgb(63 212 154/.22)` |
| `--n-ambre-fond` / `--n-ambre` / filet / point | `#FEF4E4` / `#9A5200` / `#F8DDB0` / `#E8960C` | `rgb(255 179 64/.10)` / `#FFBF5C` / `rgb(255 179 64/.24)` / `#FFB340` |
| étiquette grise fond / texte / filet | `#F4F4F5` / `#52525B` / `#E4E4E7` | `#232327` / `#A1A1AA` / `#2E2E33` |
| `--n-doublon` fond / texte / filet | `#FEEDEC` / `#C42B1C` / `#F9CFCB` | `rgb(255 90 80/.12)` / `#FF7A70` / `rgb(255 90 80/.28)` |
| `--n-ombre-xs` (nouveau) | `0 1px 2px rgb(16 24 40/.05)` | `none` |
| `--n-interrupteur-eteint` | `#E4E4E7` | `#3A3A40` |

| mesure | V1 fidèle (et V3) | V2 plus d'air |
|---|---|---|
| marge de page | 16 | 20 |
| hauteur de TOUT contrôle (bouton, menu, champ, segmenté, bouton icône) | **36** (+ zone 44) | **44** |
| rayon contrôle / carte / vignette | 8 / 12 / 6 | 10 / 14 / 8 |
| texte : titre · corps · secondaire · étiquette | 20/600 · 14/400 (500 fort) · 12/400 · 11/500 | 24/600 · 15/400 (500) · 13/400 · 12/500 |
| icône : contrôle · rangée · onglet (trait 1,5 partout) | 16 · 18 · 22 | 18 · 20 · 24 |
| rangée de liste / vignette | 56 / 36 | 68 / 44 |
| étiquette / plaque | 20 / 20, rayon 999 / 5 | 22 / 22 |
| case / interrupteur | 18 rayon 5 / 44 × 26 | idem (zone 44) |
| espace avant un titre de section | 20 | 28 |
| barre d'onglets | 52 + zone sûre, libellé 11/500 | 56 + zone sûre |

### Les composants natifs à changer (un seul lot)

1. `jetons.css` : tableau ci-dessus ; `--n-bord`, `--n-bord-fort`, `--n-ombre-xs`, `--n-piste`, étiquettes en trio
   fond/texte/filet. Le bleu `#0068D6` disparaît (pleins, liens, icônes de barre, cases).
2. `Bouton.jsx` : `.n-btn` = fond carte + `--n-bord` + `--n-ombre-xs`, rayon 8/10, hauteur `--n-h-ctl` (36 ou 44),
   icône 16/18 à gauche ; `.n-btn-plein` = vert sapin, texte 500, même hauteur, UN par écran ; `BoutonIcone` = carré de
   la même hauteur ; pressé = `--n-appui` sans ombre ; désactivé = opacité .45.
3. Nouveau `Menu` déroulant (« Choisir une action ▾ ») : un bouton à contour à texte gris + chevron 14, qui ouvre la
   `Feuille` « Choisir une action » (rangées 44, icône 18, valeur grise à droite).
4. `ChampRecherche` : contour 1 px, rayon 8/10, loupe 16, anneau `--n-teinte` 3 px à la saisie.
5. `Segmente` : piste `--n-piste`, choix blanc + ombre fine, compte gris après le libellé.
6. `Groupe` → **carte-tableau** : contour 1 px, rayon 12/14, en-tête de groupe en bande `--n-carte-2` 32 px (texte 12/500
   gris, ambre pour un geste), plus de titre en capitales (retirer `text-transform: uppercase` partout, ~130 occurrences,
   voir la liste du lot A/B/C plus bas).
7. `Rangee` : filet `--n-trait` pleine largeur dans la carte, vignette 36/44 rayon 6/8 avec liseré, titre `--texte`
   (gris 700) sur 2 lignes, ligne « plaque · site · 👁 41 ♡ 5 » en icônes fines, à droite prix 500 + étiquette OU date,
   « ⋯ » gris ; pressé = `--n-appui`.
8. `Pastille` (étiquettes) : trio fond/texte/filet, pilule 20/22, 11/12 en 500, point optionnel ; `Plaque` : contour 1 px,
   fond `--n-carte-2`, 11/600 ; `.is-double` = trio rouge.
9. `Interrupteur` 44 × 26 vert sapin ; case 18 rayon 5, cochée = encre.
10. `Page`/`TetePage` : titre 20/24 en 600 + puce de compte « (J) compte ▾ » + au plus 2 boutons icônes à contour ; pas de
    phrase sous le titre ; ligne « 184 articles · Plus récents ⇅ » en 12 gris au-dessus de la carte, comme « 48 commandes ».
11. `BarreOnglets` : fond carte, contour haut 1 px, icônes 22/24 trait 1,5, actif = voile `--n-teinte` derrière l'icône +
    libellé encre ; « + » = bouton à contour 40/48.
12. `Carte`/`Tuiles` : chiffres en cartes à contour (libellé 12 gris + icône 14, chiffre 20/24 en 600) ; Menu = tuiles à
    contour 48/56, icône 18/20, pastille ambre pour un compte.
13. `Feuille` : contour 1 px, rayon 16 en haut, poignée `--n-bord-fort`, croix dans un rond `--n-piste` 30.

### Recommandation (famille Vintex)

**V2 — Vintex, plus d'air**, en clair, avec V3 comme mode sombre aux mesures de V2. Elle garde exactement la finition
de Vintex (contours 1 px, petits rayons, étiquettes pastel, icônes fines) mais avec des contrôles de 44 px. Au doigt,
sur un iPhone, c'est la taille qui ne rate pas, alors que V1 (36 px) est plus fidèle mais demande de viser. V1 reste le
bon choix pour l'ordinateur (c'est le panneau Vintex lui-même).

---

# Les trois premières directions (A/B/C — refusées par Julien le 21 nov., gardées pour l'historique)


Demande de Julien (21 nov.) : « je pense que tu peux faire mieux pour le design du site sur l'iPhone », après « je n'aime
pas l'affichage sur iPhone » et « ça fait vibe codé ». Il aime le panneau Vintex (sobre, clair, rangées fines, étiquettes
douces) et la structure de Bleam (Accueil, Dressing, Menu en tuiles, sombre élégant). Il ne veut plus : cartes arrondies
empilées, bandeaux en série, CAPITALES (`.n-carte-titre`, `.n-tuiles-titre`, `.n-tuile-libelle`…), gros boutons pleins
partout, petites icônes illisibles.

Ce dossier est un travail de **DESIGN seulement** : rien n'est appliqué au code de l'app. Trois maquettes HTML statiques,
390 × 844, **données inventées** (aucune donnée réelle, photos remplacées par une basket dessinée).

| direction | dossier | en une phrase | accent (nouveau) |
|---|---|---|---|
| **A — Vintex clair** | `a-vintex-clair/` | blanc, filets, rangées fines pleine largeur, étiquettes pastel | **vert sapin** `#0F6B4C` (nuit `#3FD49A`) |
| **B — Bleam sombre** | `b-bleam-sombre/` | presque noir, surfaces anthracite, grands chiffres, tuiles | **lime électrique** `#C8F03C` (jour `#B8E62E`), texte encre dessus |
| **C — iOS natif réglages** | `c-ios-reglages/` | listes groupées insetées façon Réglages, grand titre 34, séparateurs inset | **pétrole** `#00727C` (nuit `#3CC6D0`) |

⚠️ **Précision de Julien (21 nov.) : « tout l'ancien design bleu doit être amélioré, je veux que tu me fasses un
banger ».** L'ancien bleu `#0068D6` (boutons pleins « Saisir 13 prix d'achat », « Publier un article », « Imprimer »,
liens bleus, icônes bleues de la barre) **disparaît** des trois directions : chacune a son accent à elle, assumé, utilisé
rarement (le plein, l'interrupteur allumé, les mots variables d'un message, l'étiquette « Prêt ») ; jamais le bleu iOS,
jamais le violet (refusé), jamais l'ambre (= geste) ni le rouge (= doublon de N°).

Chaque dossier : `aujourdhui.html`, `annonces.html`, `ventes.html` (À envoyer), `fiche.html` (fiche article),
`menu.html` (Menu en tuiles), `favoris.html` (« Messages aux favoris » : l'écran de réglages — interrupteurs, message à
variables, remise, plancher prix mini / achat + 10 %, rythme 40–90 s au hasard, 15 par heure), `style.css` (les jetons de la direction en tête du fichier). La barre du bas est la même
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
**Action principale** : le bouton compact **vert sapin** (36 px affichés + zone 44, rayon 10) — « Imprimer 4 »,
« Changer le prix », « Envoyer à 12 ». Ailleurs le vert n'est que sur l'étiquette « Prêt » (teinte) et l'interrupteur
allumé ; la barre du bas, les liens et le « + » sont à l'encre.
**Densité** : 8 annonces sur le premier écran d'Annonces.

### Jetons à poser dans `src/natif/jetons.css`

| jeton | clair | sombre |
|---|---|---|
| `--n-fond` | `#FFFFFF` | `#0E0E10` |
| `--n-carte` | `#FFFFFF` | `#0E0E10` (les listes n'ont pas de fond propre) |
| `--n-carte-2` (champ, plaque, vignette vide) | `#F6F6F7` | `#18181B` |
| `--n-trait` (filet) | `#EBEBEE` | `#25252A` |
| `--n-encre` / `-2` / `-3` | `#18181B` / `#6B6B74` / `#A1A1AA` | `#F2F2F3` / `#9C9CA5` / `#66666F` |
| `--n-accent` = `--n-plein` (vert sapin) | `#0F6B4C` | `#3FD49A` |
| `--n-sur-plein` | `#FFFFFF` (6,6:1) | `#03140D` |
| `--n-teinte` / `--n-sur-teinte` | `#E5F2EB` / `#0B5A3F` | `rgb(63 212 154/.14)` / `#7BE6BC` |
| `--n-interrupteur-eteint` (nouveau) | `#E4E4E8` | `#2A2A2F` |
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
bloc ; Annonces = rangée de 4 chiffres-segments (184 en ligne souligné de lime) puis la liste pleine largeur ; Ventes =
segmenté + « 6 colis · 4 bordereaux prêts » ; fiche = photo bord à bord, prix 40, 3 tuiles (vues, favoris, bénéfice).
**Action principale** : plein **lime électrique** 48 px, rayon 14, pleine largeur, texte encre, dans une barre fixe
au-dessus des onglets (« Imprimer 4 bordereaux », « Changer le prix », « Envoyer à 12 favoris ») ; le « + » de la barre
est un disque d'ENCRE ; la lime n'est ailleurs que sur le segment choisi (trait) et l'interrupteur allumé.
**Densité** : 7 à 8 annonces (vignette 48).

| jeton | sombre (défaut) | clair |
|---|---|---|
| `--n-fond` | `#0B0B0C` | `#F4F4F5` |
| `--n-carte` (surface) | `#161618` | `#FFFFFF` |
| `--n-carte-2` | `#1F1F23` | `#EBEBEE` |
| `--n-trait` | `rgb(255 255 255/.07)` | `rgb(0 0 0/.07)` |
| `--n-encre` / `-2` / `-3` | `#F4F4F5` / `#9B9BA3` / `#68686F` | `#121214` / `#6A6A72` / `#9E9EA6` |
| `--n-accent` = `--n-plein` (lime) | `#C8F03C` (texte dessus `#0B0E02`) | `#B8E62E` (texte dessus `#101405`) |
| `--n-teinte` / `--n-sur-teinte` | `rgb(200 240 60/.13)` / `#D6F57A` | `rgb(130 170 0/.14)` / `#3D5A00` |
| `--n-interrupteur-eteint` (nouveau) | `#2C2C31` | `#DCDCE0` |
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
segmenté iOS, barre de navigation à texte d’accent), Apple (grand titre 34, retenue). **Composition** : grand titre +
avatar ; Aujourd'hui = un groupe « Vendu en novembre » (34) puis « À faire » (rangées 44 à carré d'icône, ambre pour un
geste, gris sinon, compte à droite, chevron) ; listes en groupes insetés ; fiche = photo 4:3 insetée, groupe titre +
prix, groupes « Sur les sites » et « Détails » en paires libellé/valeur. **Action principale** : plein **pétrole** 50 px,
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
| `--n-accent` = `--n-plein` (pétrole) | `#00727C` (texte blanc, 5,6:1) | `#3CC6D0` (texte dessus `#00262A`) |
| `--n-teinte` / `--n-sur-teinte` | `rgb(0 114 124/.10)` / `#005A62` | `rgb(60 198 208/.16)` / `#7EDDE3` |
| `--n-interrupteur-eteint` (nouveau) | `rgb(120 120 128/.16)` | `rgb(120 120 128/.32)` |
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
6. **`Pastille`** (étiquettes) : trois teintes seulement — neutre, teinte de l’accent, ambre ; hauteur 20/22, rayon 6 (A, C) ou
   pilule (B). Pastille d'onglet / cloche : encre (compte) ou point ambre (geste), jamais en accent, « 9+ ».
7. **`Plaque`** : `--n-neutre` / `--n-carte-2`, 18–20 px, 11–13/600 ; `.is-double` reste le seul rouge.
8. **`Bouton` / plein** (`Bouton.jsx`, `.n-btn-plein`) : l'ancien bleu `#0068D6` disparaît de TOUS les pleins, liens,
   icônes de barre et cases cochées (`grep -rn "0068D6\|n-accent\|n-plein" src`), remplacé par l'accent de la direction ou
   par l'encre. UNE forme par direction — A plein vert sapin 36/44 rayon 10 ;
   B = plein lime 48 rayon 14 pleine largeur dans une barre fixe (`.fixe`) ; C plein pétrole 50 rayon 14. Un seul par écran
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

**A — Vintex clair (vert sapin).** C'est ce que Julien a dit aimer (le panneau Vintex : sobre, clair, rangées fines,
étiquettes douces), c'est la plus dense (8 annonces au premier écran) et la plus calme : le vert sapin ne sert qu'au
geste du jour, à « Prêt » et aux interrupteurs. Si Julien veut le « banger » le plus frappant, c'est **B (lime sur
noir)**, mais elle est moins dense et plus éloignée de Vintex. On peut lui prendre de B le Menu en tuiles et, si Julien veut plus de « grand
chiffre », la tuile d'Aujourd'hui ; C est la plus « Apple » mais la moins dense et la plus proche de ce qu'il trouve
déjà « vibe codé ».
