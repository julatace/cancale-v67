# 11 nov. — L'écran E-mails, dense comme Mail sur Mac (lot `emails-ecran`)

Julien : « les mails doivent être retravaillés, je n'aime pas trop, surtout sur
ordi : tout fait trop gros ». Principe : « plus beau, simple, surtout PRATIQUE ».
Branche `claude/emails-ecran`. Aucune PR, aucun merge dans `main`, rien en base.

## Ce qui change

### Sur ordinateur (≥ 900 px)
- **Un panneau à deux colonnes** qui remplit la fenêtre, comme Mail : liste à
  gauche (`clamp(340px, 26,5vw, 400px)`), lecture à droite, un filet entre les deux.
  Chaque colonne défile seule. La hauteur se mesure sous le titre et les onglets
  (`--bx-panneau-h`, relue au redimensionnement), 460 px au moins.
- **Densité au pointeur fin** (`hover:hover` et `pointer:fine`) : lignes 14 px (nature),
  13 px (extrait d'une ligne), 12 px (pied, heure) ; avatar 28 px ; point non lu
  7 px ; recherche 30 px, pastilles 26 px, menu des comptes 26 px.
  Au doigt (tablette ≥ 900 px), les cibles restent à 44 px.
- **Titre de l'écran 26 px** (40 avant). La règle vit dans la couche `vrm-premium` :
  hors couche, elle ne battait pas le `!important` de styles-widgets-ios.css.
- **Lecture** : titre 19 px, corps 14 px / 21 px, **69 caractères par ligne** (87
  avant à 1512), code de retrait 30 px (44), montant 24 px (34), boutons 30 px.
  La barre « Fermer · Marquer non lu » colle en haut de la colonne.
- **L'e-mail HTML à sa taille naturelle** : il prend toute la largeur de la colonne.
  `CadreEmail` retire d'abord sa marge intérieure (14 px) avant toute échelle.
  À 1280 px : échelle **1** (0,704 avant). Le cadre isolé, la CSP, le blocage des
  images et l'absence de scripts sont inchangés.
- **Le clavier** : ↓ / ↑ ouvrent l'e-mail voisin, Échap ferme la lecture.
  Seulement quand le focus est sur une ligne (jamais dans un champ). Le focus reste
  sur la ligne choisie : il ne saute plus au titre de la lecture (au téléphone, si).

### Au téléphone (< 900 px)
- Lignes : nature 16 px (17), extrait 14 px (15), avatar 36 px (40). 44 px au doigt.
- Feuille de lecture : titre 22 px (28), code 36 px (44), montant 28 px (34),
  corps 16 px (15, plus confortable à lire), boutons 48 px.
- La feuille reste opaque dès la première image, avec `FermeAuRetour`.

### Rien de perdu
Recherche, rubriques (Tout, Non lus, Codes, Colis, Ventes, Achats, Offres, À vérifier),
menu des comptes, « Tout marquer lu », actualiser, piles, glisser lu / non lu,
réessayer, « Relier ma boîte » (le parcours de l'adresse VRM et l'essai « Reçu ✓ »
ne sont pas touchés), réclamer et rattacher (Paramètres → Mes e-mails, pas touchés).
Le banc vérifie la présence des fonctions à chaque taille.

## Mesures avant → après (scripts/bancs/emails-densite.cjs, tailles RENDUES)

| | 1512×950 | 1280×800 | 390×844 |
|---|---|---|---|
| titre de l'écran | 40 → 26 | 40 → 26 | 34 → 34 |
| largeur de la liste | 440 → 400 | 440 → 340 | 366 |
| nature / extrait / pied | 17/15/13 → 14/13/12 | idem | 17/15/13 → 16/14/13 |
| hauteur d'une ligne (médiane) | 72 → 51 | 72 → 51 | 65 → 62 |
| e-mails entiers visibles | **5 → 8** | **2 → 6** | 3 → 4 |
| 1re ligne à (px) | 513 → 387 | 513 → 387 | 497 → 493 |
| titre de la lecture | 22 → 19 | 22 → 19 | 28 → 22 |
| corps / interligne | 15/23,3 → 14/21 | idem | 15/23,3 → 16/24 |
| caractères par ligne | 87 → 69 | 58 → 69 | 44 → 41 |
| code / montant | 44/34 → 30/24 | idem | 44/34 → 36/28 |
| échelle de l'e-mail HTML | 1 → 1 | **0,704 → 1** | 0,531 (tient dans l'écran) |

Clair et sombre donnent les mêmes nombres.

## Gestes, avant → après
- **Ordinateur** — lire : 1 clic (inchangé). E-mail suivant : 1 clic visé → **1 touche
  (↓)**. Revenir : 0 (la liste reste à gauche) ; Échap ferme. Surtout : la liste ne
  défile plus avec la page, la lecture reste en face.
- **Téléphone** — lire : 1 toucher ; revenir : 1 toucher (« ‹ Boîte de réception »)
  ou le retour du téléphone. Inchangé.

## Captures regardées (avant / après, côte à côte)
- 1512 clair, colis à retirer : avant, deux cartes séparées, titre 40 px, code
  géant, 5 lignes visibles. Après, un seul panneau, filet fin, code 30 px.
- 1280 sombre, vente HTML : avant, l'e-mail réduit à 70 %, liste coupée au 3e e-mail.
  Après, l'e-mail à sa taille, 6 lignes entières à gauche.
- 390 clair et sombre : liste un peu plus fine, feuille moins criarde, 44 px tenus.
Captures : `CAPTURE_DIR` du banc (hors dépôt).

## Preuves
- `npm run build` vert.
- Audits verts : variables, tdz, coherence, identite, icones, textes-courts,
  fonctions-api, secrets, csp, et les 21 audits e-mails (`ls scripts | grep -i mail`).
- Banc neuf `scripts/bancs/emails-densite.cjs` : **96 verts** sur ce code.
  Sur le code d'avant (`BANC_DIST=<dist d'origin/main>`) : **58 rouges**.
  Par mutation (ligne à 17 px, clavier coupé) : 3 rouges, comme attendu.
- Bancs e-mails existants, relancés après le changement :
  - verts : `boite-mail` (120/0), `emails-html`, `reception-emails`, `journal-emails`,
    `emails-action`, `attente-email`, `vente-email-fraiche`, `bordereau-des-email`,
    `messages-emails-communaute`, et `scripts/tests/` `journal-email-reessai`,
    `transfert-guide-interface`, `reception-synthese-interface`
    (`VRM_CHROMIUM_PATH=/opt/pw-browsers/chromium`).
  - rouges DÉJÀ sur `main`, à l'identique (arbre d'avant par `git archive`) :
    `boite-emails` 4 (« MR » attendu, le logo du transporteur est montré depuis v36),
    `emails-mis-de-cote` 3, `emails-stats-clairs` 5, `comptes-sans-email` 12,
    `scripts/tests/espace-emails-interface` (attend « Bordereau de ta vente »).
- Contrôles de banc retouchés (et dits) : `boite-mail` et `boite-emails` exigeaient 44 px
  aussi à la souris. Ils exigent maintenant 44 px au doigt et 26 px au pointeur fin
  (même requête que la CSS) ; l'avatar 28 px à la souris, 32 au doigt. Sans ce
  changement, 26 + 16 rouges : uniquement ces tailles, et une page préchargée trop tôt
  (corrigé : 400 px d'avance sur ordinateur au lieu de 900).

## Pour la suite
- Le titre d'écran et la phrase restent ceux de la coque ; seul leur corps change ici.
- Au téléphone, l'en-tête (titre, phrase, onglets, outils) prend encore ~490 px :
  piste pour un prochain lot, sans retirer de fonction.
