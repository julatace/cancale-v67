# Refonte d'Achats — 14 novembre 2026

Branche `claude/refonte-achats`. Forme seulement : aucune règle métier, aucun chiffre calculé
autrement, aucune donnée supprimée (on déplace, on replie, on hiérarchise).

## Ce que Julien a dit (captures d'iPhone, `achats-comptes.png`, `achats-sources.png`)

1. « C'est moche. Continue à améliorer le design, rien n'a changé. »
2. « Il faut vraiment qu'on sorte des classiques » (direction « Atelier », commune aux trois chantiers).
3. « Il faut que ça soit pratique, imagine si j'ai 1000 articles » (passe AVANT l'Atelier).

Ce qu'on voyait : le « … » d'une rangée qui débordait de la carte ; « Autres comptes · 9 comptes ·
2456 achats » en long gris ; « Tes meilleures sources » = un grand titre DANS une carte au padding
énorme, des chiffres noyés dans des phrases (« 41 071 € investi 61 % marge 167 jours… »), quatre
paragraphes gris, « au plus +43 € » en bleu d'accent.

## Ce qui a changé (visible)

| où | avant | après |
|---|---|---|
| rangée d'achat | 114 px (titre sur 2 lignes, sous-ligne, rangée de pastilles), vignette 60, ≤ 6 achats par écran | **68 px** (jetons §4 `--d-h-rangee`, `--d-vignette-rangee` 52) : titre sur une ligne ; l'état, la date et le **prix** sur la seconde ; `…` DANS la carte (6 px du bord) ; **8 achats entiers** sur un écran de 390 |
| liste par compte | une carte, en-têtes « Compte choisi : X · N achats » en phrase, rangées de 44 px à 15 px | **liste groupée iOS** : un groupe = une carte, en-tête court au-dessus (13 px, le nom à gauche, les nombres calés à droite), rangées de **52 px**, nom **17**, nombre 17 gris, chevron fin, filets indentés |
| recherche + période | défilent avec la page | **collées en haut** (matériau translucide `--d-materiau`, opaque si transparence réduite) |
| N° tapé | ne trouvait pas l'achat (la recherche lisait le N° de la fiche de VENTE) | trouve l'achat relié à la fiche de ce N° **par son n° de transaction** (`buyFromId`, une identité, §5) — mesuré 67–260 ms à 1 000 achats |
| carte héros | carte sombre + 3 grandes cases en bento (411 px, 49 % de l'écran) | la même carte (« Dépensé », même chiffre, même règle) + **la pile des photos** des paires achetées ce mois (chacune par SON achat, `orderPhoto`) ; les trois chiffres sur **une ligne** (263 px, 31 %) |
| Tes meilleures sources | titre dans la carte, chiffres dans des phrases, 4 paragraphes, montant en bleu | **titre hors carte** (20/700) ; une carte = les sources ; chaque source : nom · chiffre **à l'encre** · **tuiles** (Investi en large, Marge, Pour revendre — chiffre 28/700, libellé 13) ; **une** ligne de couverture (§5, la même phrase « 45 revendus sur 824 achetés · … ») ; hors de toute source : une ligne courte (« 180 ventes sans achat relié ») ; **toutes** les phrases d'avant dans « Comment c'est calculé » (repli) |
| hors plateforme, reçus | cadre 1 px rayon 12 ; « Reçus d'achat par e-mail · 179 › » en texte 12 px | cartes du système (rayon 20, ombre douce, aucun cadre), l'icône dans une tuile neutre ; les reçus en **rangée iOS** 17 px + chevron |
| ligne de retrait | « Date limite inconnue » sous une **barre vide** ; « Code sur Vinted » en faux code gras | pas de barre quand on ne sait pas (inconnue, vérification, point changé) — la phrase seule, le `progressbar` reste pour les lecteurs ; « Code sur Vinted » en note du système (13/400 gris) |
| mouvement | — | les **12 premières** rangées arrivent en ressort court (`--d-m-rangee` 240 ms, décalage 24 ms, `--d-ressort`), jamais 1 000 ; `prefers-reduced-motion` : rien ne bouge ; la ligne d'une source s'enfonce au toucher |

Dark : mêmes formes, surfaces plus claires que le fond, aucune ombre.

## Un défaut trouvé en chemin (le « énorme padding »)

La carte des sources avait une enveloppe `.vrm-ms` ; « Ma semaine » (`styles-ma-semaine.css`) style
`.vrm-ms` avec `padding: 16px !important; max-width: 980px`. D'où la marge intérieure énorme de la
capture et la carte rognée à 980 px sur ordinateur. L'enveloppe s'appelle maintenant `vrm-ms-corps`.

## Fichiers

- `src/styles-achats-photos.css` — §1 à §8 « REFONTE D'ACHATS » (rangée, carte, comptes, recherche
  collée, héros, entrée, retrait, hors plateforme / reçus), spécificité `:root:root:root`, dans
  `@layer vrm-premium`. Jetons §4 Atelier (`--d-ombre-douce`, `--d-materiau`, `--d-h-rangee`…) lus
  avec un repli : ils arrivent par `claude/refonte-coque`.
- `src/MeilleuresSources.jsx`, `src/styles-meilleures-sources.css` — la carte refaite.
- `src/GroupesComptes.jsx` — `court` (facultatif, défaut éteint : Ventes inchangé).
- `src/App.jsx` — Achats seulement : `teteGroupe(…, 'achat')` passe `court` ; la recherche par N°
  d'achat ; `pile` + `data-achats-hero` sur la carte d'Achats ; la marge de la section des sources.
- `src/i18n/langues/{fr,en,es,it,de}/achats.js` — `achats.ms.*` (5 clés).
- `src/nouveautes.js` — « Achats plus dense, plus net ».
- `scripts/audit-meilleures-sources.cjs` (E5 et la mutation « ecran-rouge » : l'encre, plus l'accent),
  `scripts/bancs/meilleures-sources.cjs` (7 : la source en tête par sa place, chiffres à l'encre ;
  2 : « au moins » posé au-dessus du chiffre, `\s+`).

## Preuves

Banc `scripts/bancs/refonte-achats.cjs` (base inventée : 10 comptes dont un nom de 35 lettres,
1 000 achats, 240 ventes dont 60 reliées, 4 achats hors plateforme ; 390 tactile clair ET sombre,
1512) :

- **origin/main** (`dist` de 9236d48b) : F1 (le `…` touche le bord), F2 ×2, F3, F4, F5, F6
  (« au plus +2 250 € » en bleu), F7 (114 px, vignette 60), F8 (pas de héros ≤ 40 %), P4 (5–6
  achats visibles), P5 (le N° ne trouve rien) **rouges** ;
- **après** : tout vert (35/35) ; P1 premier rendu pas plus lent, P3 nœuds DOM 1 218 ⇒ 1 038,
  P2 CLS 0–0,002.

Captures (390 iPhone, dsf 2) : `docs/design/avant-apres/achats-*-avant.png` / `-apres.png`.

## Ce qui reste

- La carte héros ne se **compacte pas au défilement** en une ligne : elle tient 31 % du premier
  écran et part avec la page ; la recherche, elle, reste collée. (Une ligne de chiffres collée
  redirait « Dépensé » à côté de la carte : à faire en lisant LA même valeur, pas une copie.)
- Le chiffre de la carte héros reste à 40 px (44 à l'ordinateur) : l'échelle d'affiche 48–64 (§4)
  attend que `design-passe` l'admette (chantier coque).
- Pas de mini-courbe : aucune série d'achats n'existe déjà (la consigne : seulement si elle existe).
