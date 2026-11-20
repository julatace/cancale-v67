# « VRM natif » — le SEUL design de l'app (décision du 19 nov. 2026)

Julien, 19 nov. : « la mise en page est catastrophique, revois absolument tout […] j'en ai marre que tu ne modifies
qu'un tout petit peu à chaque fois, je veux quelque chose de drastique, nouveau, totalement différent » ; « l'outil
doit être pratique, pas chiant » ; « la chose la plus importante est que l'app ne bug plus et que ça charge plus vite
entre les onglets ». Le 18 nov. : l'app qu'il trouve belle sur iPhone, c'est Apple (Wallet, Réglages).

**Direction.** On arrête d'empiler des habillages (studio, verre, v2, Apple, « VRM » de Codex : ~11 000 règles, ~440
`:has`, des blancs sur clair). VRM prend la STRUCTURE d'une app iOS / macOS, pas seulement ses couleurs : grands
titres, listes groupées, barre d'onglets standard, feuilles, gestes de balayage, trois volets à l'ordinateur. Un seul
style, pas de réglage « Style », pas d'« Ancien design ». Moins de CSS = onglets plus rapides.

## 1. Jetons (`src/natif/jetons.css`, variables `--n-*`, clair / sombre choisi par `vinted_dark`)

| jeton | clair | sombre | usage |
|---|---|---|---|
| `--n-fond` | #F2F2F7 | #000000 | la page |
| `--n-carte` | #FFFFFF | #1C1C1E | listes groupées, cartes |
| `--n-carte-2` | #F2F2F7 | #2C2C2E | carte dans une feuille, champ |
| `--n-trait` | rgb(60 60 67 / .18) | rgb(84 84 88 / .60) | séparateurs (en retrait de 16 ou de la vignette) |
| `--n-encre` | #111114 | #FFFFFF | texte |
| `--n-encre-2` | #6C6C70 | #98989F | texte secondaire (≥ 4,5:1 sur carte ET sur fond) |
| `--n-encre-3` | #8E8E93 | #636366 | jamais du texte : chevrons, icônes muettes |
| `--n-accent` | #0068D6 | #409CFF | liens, texte d'action, onglet actif |
| `--n-plein` / `--n-sur-plein` | #0068D6 / #FFFFFF | #0068D6 / #FFFFFF | LE bouton principal (un par écran) |
| `--n-teinte` | rgb(0 104 214 / .12) | rgb(64 156 255 / .20) | bouton teinté, sélection |
| `--n-ambre` / `--n-ambre-fond` | #8A4B00 / #FFF4DD | #FFB340 / rgb(255 179 64 / .16) | un geste à faire, une date limite LUE proche |
| `--n-doublon` | #D70015 | #FF453A | SEULEMENT deux paires sous un N° (§7 de CLAUDE.md) |

Pas de violet. Pas de dégradé. Pas d'ombre, sauf la feuille et le volet (0 8px 30px rgb(0 0 0 / .12)). Flou : la barre
d'onglets et la barre de titre seulement (`backdrop-filter: saturate(180%) blur(20px)`), rien d'autre.

**Typo** : `-apple-system, "SF Pro Text", "Inter", system-ui, sans-serif`, chiffres tabulaires.
Grand titre 34/41 gras 700 · titre de barre 17/22 600 · titre de section 22/28 700 (ou en-tête de groupe 13/18 capitales
`--n-encre-2`) · corps 17/22 400 · secondaire 15/20 400 · légende 13/18 400 · chiffre d'affiche 48/52 700.
Jamais sous 13 px. Graisses : 400, 600, 700 seulement.

**Mesures** : grille de 4 ; marges de page 16 (20 dès 430 px) ; rayon carte 12, bouton 12 (plein 14), plaque 8,
vignette 10 ; rangée ≥ 44 (56 avec vignette 44, 72 avec vignette 56) ; cible au doigt ≥ 44 × 44 ; bouton plein 50 de haut.
Mouvement : 200–300 ms, courbe iOS `cubic-bezier(.32,.72,0,1)`, `prefers-reduced-motion` respecté ; `:active` assombrit
de 8 % en 80 ms (pas de survol au doigt).

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
- fond gris très clair, GROUPES blancs arrondis (rayon 12), rangées 52–60 : icône bleue fine 22 à gauche (facultative),
  libellé 17, valeur ou pastille alignée à droite, chevron gris ; séparateurs en retrait ;
- en-tête de groupe en petites capitales grises (13), pied de groupe en gris (13) seulement s'il est indispensable ;
- un écran = un grand titre + des groupes ; le détail est derrière le toucher de la rangée (page poussée ou feuille) ;
- AUCUNE carte décorée, aucune ombre, aucun texte d'explication permanent (un « ? » discret si besoin), aucun lien souligné,
  aucun bouton gris pleine largeur ; un seul plein par écran, sinon des actions en texte bleu ou des rangées ;
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
- États en étiquettes douces neutres ; ambre = à faire ; jamais de rouge ni de vert vif (rouge = doublon de N° seul).

## 3. Composants (`src/natif/`, un fichier par composant, classes `n-*`)

`Page` (titre, actions, recherche, plein collé) · `Groupe` (en-tête, pied) + `Rangee` (vignette | icône, titre 1–2
lignes, sous-titre, valeur à droite, chevron | interrupteur | coche, balayage → actions) · `Bouton` (plein | teinté |
texte | destructif-avec-confirmation ; chargement, indisponible AVEC sa raison) · `Segmente` · `Feuille` (détentes
moitié / pleine, poignée, `FermeAuRetour`) · `Faits` (grille 2–4 colonnes : libellé 13 gris, valeur 17/600 ; une valeur
« — » se touche et ouvre sa saisie) · `Plaque` (N°) · `Pastille` · `Affiche` (grand chiffre + unité + écart nommé) ·
`Vide` (icône, une phrase, un geste) · `Attente` (squelette de la forme exacte, jamais de saut) · `Toast` (au-dessus
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
