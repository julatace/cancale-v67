# « VRM natif » — le SEUL design de l'app (décision du 19 nov. 2026)

Julien, 19 nov. : « la mise en page est catastrophique, revois absolument tout […] j'en ai marre que tu ne modifies
qu'un tout petit peu à chaque fois, je veux quelque chose de drastique, nouveau, totalement différent » ; « l'outil
doit être pratique, pas chiant » ; « la chose la plus importante est que l'app ne bug plus et que ça charge plus vite
entre les onglets ». Le 18 nov. : l'app qu'il trouve belle sur iPhone, c'est Apple (Wallet, Réglages).

**Direction.** On arrête d'empiler des habillages (studio, verre, v2, Apple, « VRM » de Codex : ~11 000 règles, ~440
`:has`, des blancs sur clair). VRM prend la STRUCTURE d'une app iOS / macOS, pas seulement ses couleurs : grands
titres, listes groupées, barre d'onglets standard, feuilles, gestes de balayage, trois volets à l'ordinateur. Un seul
style, pas de réglage « Style », pas d'« Ancien design ». Moins de CSS = onglets plus rapides.

## 0 ter. ⚠️⚠️ (25 nov. 2026, décision de Julien : « fais entre les deux, la couleur », puis « gris moyen c'est d'accord ») LE CLAIR PAR DÉFAUT EST LE GRIS MOYEN — page `--n-fond` **#878B92** (latérale #7F838A), cartes `--n-carte` #F1F2F4 / `--n-carte-2` #E3E5E9, contour #B9BDC3, encre #0E0F12 (5,60:1 sur la page), corps #16181C, secondaire `--n-encre-2` #1F2226 (posé aussi sur la page : 4,67:1 ; 14,3:1 sur la carte), accent = plein = « à faire » #19222C (4,70:1 sur la page, 16:1 sous le blanc du plein). Sur un gris moyen, ni l'encre ni le blanc n'ont de marge : tout texte posé sur la page est à l'encre, jamais un gris clair ni du blanc (3,9:1). Le mode sombre (#1C1C20) ne change pas. Récit : `docs/passation/2026-11-25-gris-moyen.md`. Les valeurs claires du tableau §1 ci-dessous sont celles d'avant (la vérité est `src/natif/jetons.css`).

## 0 bis. ⚠️⚠️ (22 nov. 2026, décision de Julien : « un mélange de 2 et 1 », « j'aime bien en noir ») L'ACCENT EST L'ENCRE NOIRE (`--n-accent` #16181D, nuit #F4F4F5) — fond #F4F4F2, carte héros à l'encre sur Aujourd'hui (`Heros`, `ActionsRondes`, `GrapheJours`, `Etincelle`, `Repartition`), vert seulement pour un écart positif ou « fait » ; récit `docs/passation/2026-11-22-style-clarte.md`. Le reste de §0 (mesures, étiquettes) tient ; « vert sapin » y est remplacé par l'encre.

## 0. ⚠️⚠️ STYLE « COMME VINTEX — 2ᵉ JET » (décision de Julien, 21 nov. 2026) — il REMPLACE les valeurs d'avant

Julien a validé d'appliquer à TOUTE l'app les maquettes `docs/design/iphone-2026-11-21/vintex-vrai-2/` (branche
`claude/design-iphone`, README « 6ᵉ passe ») : ses 5 onglets (Aujourd'hui · Annonces · Ventes · Achats · Argent), échelle
RÉDUITE, fond à peine teinté, cartes blanches à ombre très douce, contrôles fins, étiquettes pastel franches, logos des sites et
des transporteurs en couleur, bouton plein à l'ENCRE, accent VERT SAPIN rare (l'onglet actif le porte — pas le rose de la
maquette, trop proche du rouge réservé), plus AUCUN bleu vif, plus AUCUN titre en capitales, mode sombre aux mêmes mesures.
La structure (§2–§4 : coque, listes groupées, tableaux de travail, feuilles) ne change pas : ce sont les VALEURS qui changent.
Récit et preuves : `docs/passation/2026-11-21-style-vintex.md`. Garde : `scripts/audit-style-vintex.cjs` (bleu vif, jetons,
onglet actif, capitales, violet et rouge hors doublon — mutations comprises).

## 1. Jetons (`src/natif/jetons.css`, variables `--n-*`, clair / sombre choisi par `vinted_dark`)

| jeton | clair | sombre | usage |
|---|---|---|---|
| `--n-fond` | #878B92 (25 nov., gris moyen ; avant #F1F3F6) | #0F0F11 | la page |
| `--n-carte` | #FFFFFF | #18181B | cartes, groupes, barres |
| `--n-carte-2` | #F8F9FA | #1F1F23 | bande de groupe, champ dans une feuille |
| `--n-bord` | #E4E4E7 | #2E2E33 | contour d'un contrôle, d'une carte ; filet de structure |
| `--n-trait` | #EEF0F2 | #26262B | filet entre deux rangées (1 px) |
| `--n-encre` / `--n-texte` | #16181D / #30343B | #F4F4F5 / #E4E4E7 | titres / corps |
| `--n-encre-2` | #62676F | #A1A1AA | secondaire (5,1:1 sur le fond, 5,8:1 sur la carte ; 6,9:1 en sombre) |
| `--n-encre-3` | #9EA3AB | #71717A | jamais du texte : chevrons, icônes muettes |
| `--n-accent` | #0F6B4C | #3FD49A | vert sapin, RARE : l'onglet actif, un lien, une sélection (6,5:1 sur blanc ; 9,4:1 sur #18181B) |
| `--n-teinte` / `--n-sur-teinte` | rgb(15 107 76 / .10) / #0B5A40 | rgb(63 212 154 / .14) / #6FE3B5 | voile de l'onglet actif, sélection |
| `--n-plein` / `--n-sur-plein` | #16181D / #FFFFFF | #F4F4F5 / #18181B | LE bouton plein, à l'encre (un par écran au plus) |
| `--n-ambre` / `-fond` / `-bord` | #874600 / #FFEBC4 / #F8D79B | #FFB340 / ambre 14 % / 28 % | un geste à faire (6,2:1) |
| `--n-vert` / `-fond` / `-bord` | #17744A / #DDF4E6 / #C3EAD2 | #6FE3B5 / vert 14 % | étiquette « fait · prêt · en ligne » (5,0:1) |
| `--n-teal` / `-fond` / `-bord` | #0D6A6B / #DAF0F0 / #BCE3E3 | #6ED6D6 / teal 14 % | étiquette « en route » (5,4:1) |
| `--n-gris` / `-fond` / `-bord` | #4C525B / #ECEEF1 / #DFE2E6 | #C4C4CC / #26262B | étiquette « en attente » (6,8:1) |
| `--n-doublon` | #BF2A21 | #FF6B5E | SEULEMENT deux paires sous un N° (§7 de CLAUDE.md) |
| `--n-ombre-carte` | 0 1px 2px rgb(16 24 40/.04), 0 2px 6px rgb(16 24 40/.04) | un liseré | une carte, un groupe |

Pas de violet. Plus aucun bleu vif (#0068D6, #0071E3, #0A84FF, #409CFF… et leurs dérivés) : un logo de MARQUE seulement
(fichiers nommés par l'audit). Pas de dégradé (sauf la jauge et la carte du mois). Flou : barre de titre et barre d'onglets.

**Typo** : `-apple-system, "SF Pro Text", "Inter", system-ui, sans-serif`, chiffres tabulaires.
Titre d'écran 22/28 700 · titre de section 15/20 700 (en minuscules, encre) · titre de barre 15/20 600 · corps 14/20 400
(500 pour un contrôle, 600 pour un prix) · secondaire 13/18 · méta 12/16 (en-tête de groupe 12/16 500, gris, EN MINUSCULES) ·
libellé d'onglet 10,5/12 500 (600 actif) · chiffre d'affiche 30/36 700. **Jamais de capitales** (`text-transform: uppercase`
seulement sur la plaque du N° et le champ où l'on tape un N°).

**Mesures** : grille de 4 ; marges de page 16 ; contrôles DESSINÉS à 36 (rayon 8, contour 1 px `--n-bord`) dans une ZONE
tactile de 44 (bordure transparente de 4 px en haut et en bas, `background-clip: padding-box`) ; rangées ~56 (vignette 48
rayon 10) ; carte rayon 12 ; plaque rayon 6, 20 de haut ; étiquette pilule 20 ; case 18 rayon 5 ; interrupteur 36 × 20
(zone 44) ; barre de titre 52 ; barre d'onglets 49 + zone sûre, l'actif = icône sur un voile 44 × 28 rayon 8.
Mouvement : 200–300 ms, courbe `cubic-bezier(.32,.72,0,1)`, `prefers-reduced-motion` respecté.

## 2. La coque (`src/natif/Coque.jsx`)

**Téléphone.** Barre de titre : grand titre qui se réduit en 17/600 centré au défilement ; à droite DEUX icônes au plus
(Messages avec pastille, avatar → « Plus ») ; la recherche est le champ sous le grand titre (loupe, scanner dans le
champ), qui se cache au défilement. Barre d'onglets : 5 onglets de MÊME largeur, icône 24 + libellé 10/600, actif en
`--n-accent`, pastille rouge-ambre lisible, 49 px + zone sûre ; le contenu ne passe jamais dessous sans marge. Onglets :
**Aujourd'hui · Annonces · Ventes · Achats · Argent**. « Plus » (feuille pleine hauteur depuis l'avatar) : Stock,
Messages, E-mails, Tout va bien ?, Paramètres, Communauté. Le bouton plein d'un écran est collé au-dessus de la barre.
Une fiche ou un atelier = une page poussée (retour ‹ en haut à gauche, balayage du bord) ; un réglage court = une feuille.

**Ordinateur (≥ 1024).** Trois volets : barre latérale 240 (fond `--n-fond`, entrée active = pastille `--n-teinte` +
texte `--n-accent`), liste 380–520, détail (la fiche) qui prend le reste, borné à 760. Sans sélection : état vide
dessiné. UNE recherche, en tête de la liste. Clavier : ↑ ↓ Entrée Échap, ⌘K / « / » pour chercher.

## 1 bis. La règle de Julien (20 nov.) : « tout le site doit être comme la fiche Paramètres, simple et minimaliste »

Référence : la feuille « Plus » / Paramètres (listes groupées iOS). Partout :
- fond à peine teinté, GROUPES blancs arrondis (rayon 12, contour fin, ombre très douce — §0), rangées 44–56 : icône grise fine
  20 à gauche (facultative), libellé 14, valeur ou pastille alignée à droite, chevron gris ; séparateurs de 1 px en retrait ;
- en-tête de groupe en minuscules grises (12/500), pied de groupe en gris (12) seulement s'il est indispensable ;
- un écran = un grand titre + des groupes ; le détail est derrière le toucher de la rangée (page poussée ou feuille) ;
- AUCUNE carte décorée, aucune ombre forte, aucun texte d'explication permanent (un « ? » discret si besoin), aucun lien souligné,
  aucun bouton gris pleine largeur ; un seul plein (à l'encre) par écran, sinon des boutons à contour, des actions en texte ou des rangées ;
- les chiffres importants : grands mais sobres (noir, pas de couleur), unités en gris ;
- à l'ordinateur : même grammaire, groupes sur une ou deux colonnes, tableaux (§2 bis) au même style (filets fins, rien d'autre).

## 2 bis. Les listes « tableau de travail » (Julien, 19 nov. soir : « mêmes fonctionnalités, même rendu grosso modo, j'aime bien ce style, les options proposées »)

Référence de STRUCTURE (pas de marque, pas de couleurs) : un outil de vendeur en tableaux clairs. Chaque écran de liste
(Annonces, Ventes, Achats, Messages, Notifications, E-mails) a, de haut en bas :
- **Barre de titre** : titre, pastille du compte (ou « Tous les comptes »), à droite « Mis à jour il y a 1 min » + ⟳.
- **Barre d'outils** : « Choisir une action ▾ » (les gestes en série permis de l'écran ; rien de destructif en série),
  recherche, **Statut ▾** (cases à cocher AVEC leur nombre : En vente 12, Brouillon 1, Masqué 1, Vendu 52…), filtres
  propres à l'écran (site, compte, période « 7 jours »), à droite liste ⇄ grille et **Colonnes ▾** (cases, mémorisé).
- **« N articles »** au-dessus du tableau.
- **Tableau** (≥ 1024) : case | vignette 48 + titre (+ sous-titre d'état en gris) | colonnes chiffrées alignées à droite,
  triables (↑↓ dans l'en-tête) | Statut en étiquette douce | ⋯. Rangée 64–72, filets fins, fond blanc, pas d'ombre.
  Au téléphone : la même liste en rangées 72 (§4), barre d'outils réduite (action ▾, loupe, filtre).
- **Messages** : deux volets (liste avec avatar, pseudo, « il y a 10 min », vignette de l'article ; filtre « Non lus · N »),
  volet vide dessiné « Choisis une conversation ».
- **Automatisations** (Paramètres → Automatisations, et dans l'extension) : liste des automatismes avec état
  « Activé / Désactivé » ; détail en sections MESSAGES (plusieurs messages, un au hasard ; ✎ 🗑 interrupteur ; « + Ajouter »),
  CIBLAGE, DÉLAIS ; en bas « Réinitialiser » (texte) et un plein « Démarrer ».
- États en étiquettes pastel (§0) : vert = fait / prêt / en ligne, ambre = à faire, teal = en route, gris = en attente ;
  jamais de rouge (rouge = doublon de N° seul).

## 3. Composants (`src/natif/`, un fichier par composant, classes `n-*`)

`Page` (titre, actions, recherche, plein collé) · `Groupe` (en-tête, pied) + `Rangee` (vignette | icône, titre 1–2
lignes, sous-titre, valeur à droite, chevron | interrupteur | coche, balayage → actions) · `Bouton` (plein | teinté |
texte | destructif-avec-confirmation ; chargement, indisponible AVEC sa raison) · `Segmente` · `Feuille` (détentes
moitié / pleine, poignée, `FermeAuRetour`) · `Faits` (grille 2–4 colonnes : libellé 13 gris, valeur 17/600 ; une valeur
« — » se touche et ouvre sa saisie) · `Plaque` (N°) · `Pastille` · `Affiche` (grand chiffre + unité + écart nommé) ·
`SelecteurSite` (20 nov. : LE sélecteur de plateforme global, src/siteCourant.js) · `Vide` (icône, une phrase, un geste) · `Attente` (squelette de la forme exacte, jamais de saut) · `Toast` (au-dessus
de la barre, annulable 10 s) · `BarreOnglets` · `BarreLaterale`.
Aucun style en ligne dans les écrans neufs ; aucun `!important` ; aucun `:has()` ancré sur `html`, `body`, `#root`.

## 4. Les écrans (mêmes sources et règles qu'avant : c'est la disposition qui change)

- **Aujourd'hui** : `Affiche` « X € vendus aujourd'hui · N ventes », 7 barres, groupe « Ce mois » (Vendu · Reçu ·
  Bénéfice) ; groupe « À envoyer » (vignettes + plaques, plein « Imprimer N bordereaux ») ; groupe « À retirer » (passe :
  point sur une ligne, code en grand) ; groupe « Dernières ventes » (5 rangées). Pas de liste « À faire ».
- **Annonces / Ventes / Achats** : `Segmente`, une liste groupée, rangées 72 (vignette 56, titre, « N° · T · état »,
  prix à droite) ; « À régler · N » replié en tête ; balayage = le geste principal ; toucher = la fiche poussée.
  Ventes garde ses cases cochées d'office et « Imprimer N bordereaux ».
- **La fiche d'un article** : photo, plaque, titre, état ; `Faits` (Prix · Prix mini · Acheté · Bénéfice · Taille ·
  En ligne depuis · Place · Favoris) où chaque valeur se modifie en la touchant ; groupe « Sites » ; UN plein ; gestes
  en rangées ; histoire repliée. Rien derrière « ⋯ » sauf le rare et le destructif.
- **Argent, Messages, Stock, Paramètres** : listes groupées standard ; Paramètres = l'app Réglages.
- **Pratique, pas pénible** : pas de confirmation sans risque, pas de phrase d'explication permanente, pas de carte de
  reproche récurrente, ce qui est certain se remplit seul, 1 à 2 touchers par geste courant.

## 5. Preuves attendues de chaque écran

Banc à 390 × 844 tactile (zone sûre), 1512 et 1280, clair et sombre, base inventée de volume ET base vide : contrastes
≥ 4,5:1 sur le fond rendu, cibles ≥ 44, un seul plein, aucun débordement ni texte coupé (titres longs, prix à 4
chiffres, 6 sites, sans photo), rien sous la barre d'onglets ; captures REGARDÉES ; chiffres identiques à l'écran
d'avant (`chiffres-volume`) ; changement d'onglet sans recalcul de style du document.
