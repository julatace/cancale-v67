# Refonte d'Achats — 14 novembre 2026

Branche `claude/refonte-achats`. Forme seulement : aucune règle métier, aucun chiffre calculé
autrement, aucune donnée supprimée (on déplace, on replie, on hiérarchise). Skill du projet :
`vrm-design` (ordre : AJOUT 3 « la liste d'abord » > AJOUT 2 « 1 000 articles » > Atelier).

## Ce que Julien a dit (captures d'iPhone, non versionnées : données réelles)

1. « C'est moche. Continue à améliorer le design, rien n'a changé. »
2. « Il faut vraiment qu'on sorte des classiques » (direction « Atelier »).
3. « Il faut que ça soit pratique, imagine si j'ai 1000 articles ».
4. (Annonces) « pas beau du tout : les couleurs, les formes, les boutons » ⇒ AJOUT 3, appliqué à Achats.

Ce qu'on voyait sur Achats : le « … » d'une rangée collé au bord (débordant chez lui) ;
« Autres comptes · 9 comptes · 2456 achats » en long gris ; « Tes meilleures sources » = un grand
titre DANS une carte au padding énorme, des chiffres noyés dans des phrases, quatre paragraphes
gris, « au plus +43 € » en bleu ; une carte sombre de 411 px ; « À retirer » (des centaines de px)
avant la première ligne d'achat.

## Ce qui a changé (visible)

| où | avant (origin/main) | après |
|---|---|---|
| haut d'Achats | carte SOMBRE « Dépensé » + 3 grandes cases (411 px, 49 % de l'écran) | **bande de chiffres** sur le fond (≤ 72 px) : « Novembre … Modifier », puis Dépensé · En route · À retirer · Arrivés (libellé 12, chiffre 20/700). La MÊME carte réglable (`CarteStatsApp`, mêmes chiffres, mêmes `data-*`, « ? », « Modifier ») dessinée autrement |
| « À retirer » (points, codes, QR, Mode relais, outils) | toute la section AVANT la liste | rangée dans un repli (`RepliRetirerAchats`) : la case « À retirer · N » de la bande l'ouvre (`retraits` ⇒ ouvert + défilé jusqu'à elle) ; il s'ouvre SEUL quand on vient pour un retrait (anciens chemins Colis/À retirer, notification, Ma journée), reste ouvert si on l'a ouvert (`vrm_achats_retirer_ouvert`, cet appareil). Rien n'est démonté : ses publications continuent. Hors Vinted (eBay, Leboncoin, Vestiaire), une ligne « À retirer · N › » |
| outils | 3 grandes capsules grises + « … », recherche, calculette sur sa propre ligne, « Sélectionner » sur sa ligne | étapes en **petites capsules** dessinées à 36 px (cible 44), la choisie à l'encre pleine ; « Sélectionner » en icône ✓ à côté de « … » ; la calculette en icône dans la barre de recherche |
| recherche + période | défilent avec la page | **collées en haut** (matériau translucide `--d-materiau`, opaque si transparence réduite) |
| N° tapé | ne trouvait pas l'achat | trouve l'achat relié à la fiche de ce N° **par son n° de transaction** (`buyFromId`, §5) — 67–260 ms à 1 000 achats |
| rangée d'achat | 114 px, vignette 60, ≤ 5–6 achats par écran | **68 px**, vignette 52 (jetons §4) : titre sur une ligne ; état, date et **prix** sur la seconde ; `…` DANS la carte ; **8 achats** entiers par écran de 390 |
| liste par compte | une carte, en-têtes en phrase, rangées 44 px / 15 px | **liste groupée iOS** : un groupe = une carte, en-tête court au-dessus (13 px, le nom à gauche, les nombres à droite), rangées **52 px**, nom **17**, filets indentés |
| Achetés pas en ligne · Achats hors plateforme | entre les outils et la liste | **sous la liste** (mêmes blocs, mêmes gestes) |
| Tes meilleures sources | titre dans la carte, chiffres dans des phrases, 4 paragraphes, montant en bleu | **titre hors carte** (20/700) ; une carte = les sources ; chaque source : nom · chiffre **à l'encre** · **tuiles** (Investi, Marge, Pour revendre — 28/700 ; une tuile « — » n'est pas dessinée) ; **une** ligne de couverture (§5, la même phrase) ; hors de toute source : une ligne courte ; **toutes** les phrases d'avant dans « Comment c'est calculé » |
| reçus, hors plateforme | cadres 1 px rayon 12, texte 12 px | cartes du système (rayon 20, ombre douce), reçus en rangée iOS 17 px + chevron |
| ligne de retrait | « Date limite inconnue » sous une barre VIDE ; « Code sur Vinted » en faux code gras | pas de barre quand on ne sait pas (la phrase seule ; le `progressbar` reste pour les lecteurs) ; « Code sur Vinted » en note 13/400 grise |
| mouvement | — | les **12 premières** rangées arrivent en ressort court (`--d-m-rangee`, décalage 24 ms), jamais 1 000 ; `prefers-reduced-motion` respecté |

## Un défaut trouvé en chemin (le « énorme padding »)

L'enveloppe de la carte des sources s'appelait `.vrm-ms` — le nom que « Ma semaine »
(`styles-ma-semaine.css`) style avec `padding: 16px !important; max-width: 980px`. D'où la marge
intérieure énorme de sa capture et la carte rognée à 980 px sur ordinateur. Renommée `vrm-ms-corps`.

## Fichiers

- `src/styles-achats-photos.css` — sections 1 à 8 « REFONTE D'ACHATS », `@layer vrm-premium`,
  spécificité `:root:root:root`. Jetons §4 Atelier (`--d-ombre-douce`, `--d-materiau`,
  `--d-h-rangee`, `--d-vignette-rangee`…) lus avec un repli (ils arrivent par `claude/refonte-coque`).
- `src/MeilleuresSources.jsx`, `src/styles-meilleures-sources.css` — la carte refaite.
- `src/GroupesComptes.jsx` — `court` (facultatif, éteint par défaut : Ventes inchangé).
- `src/App.jsx` — `RepliRetirerAchats` + `demanderRetirer` (chemins de retrait) ; Achats : `court`
  pour ses en-têtes, la recherche par N° d'achat, `data-achats-hero`, la calculette et
  « Sélectionner » dans les barres, hors plateforme / pas en ligne sous la liste.
- `src/i18n/langues/*/achats.js` — `achats.ms.*`, `achats.selectionner` (5 langues).
- `src/nouveautes.js` — « Achats plus dense, plus net ».
- `scripts/audit-meilleures-sources.cjs` (E5 + mutation : l'encre), `scripts/bancs/meilleures-sources.cjs`
  (7 : la source en tête par sa place ; 2 : « au moins » posé au-dessus du chiffre).

## Preuves

Banc `scripts/bancs/refonte-achats.cjs` (base inventée : 10 comptes dont un nom de 35 lettres,
1 000 achats, 240 ventes dont 60 reliées, 4 achats hors plateforme ; 390 tactile clair ET sombre,
1512) :

- **origin/main** : 25 rouges — F1 (`…` au bord), F2, F3, F4, F5, F6 (« au plus +2 250 € » en
  bleu), F7 (114 px / 60), F8 (pas de bande), F9 (Achats pose 2 164 px avant sa liste), P4 (5),
  P5 (le N° ne trouve rien) ;
- **après** : vert. P1 pas plus lent, P3 nœuds DOM 1 218 ⇒ 1 038, P2 CLS 0.

Captures (390 iPhone, dsf 2) : `docs/design/avant-apres/achats-*-avant.png` / `-apres.png`.

## Ce qui reste (hors de ce chantier)

- **L'écran entier** : la 1re ligne est à ~500 px sur 844 (visé ≤ 422). Au-dessus d'Achats, la coque
  pose « Vérification de tes données… », la phrase sous le titre (AJOUT 3 point 8) et la rangée de
  pilules des comptes (point 4 : un menu « compte ▾ ») — `claude/refonte-coque` / `refonte-listes`.
  Achats lui-même n'occupe plus que ~190 px au-dessus de sa liste (F9).
- La ligne « À faire · N › » (AJOUT 3 point 5) regroupant à confirmer / à renvoyer / doublons : pas
  faite ici (ces blocs n'apparaissent que s'ils ont un contenu).
- Pas de mini-courbe : aucune série d'achats n'existe déjà.
