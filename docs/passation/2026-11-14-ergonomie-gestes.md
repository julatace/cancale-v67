# 14 nov. — Ergonomie des gestes courants (mesurée)

Branche `claude/ergonomie-gestes`. Julien : « améliore l'ergonomie, absolument tout ». Périmètre : les GESTES,
pas le dessin (la coque, les listes, Achats, la fiche, Messages/Stock, Plateformes/Réglages sont refaits par
d'autres branches). Aucune règle métier touchée.

## Comment c'est mesuré — `scripts/bancs/ergonomie-gestes.cjs`

Le banc JOUE les 15 gestes les plus fréquents comme un pouce sur un iPhone (390 × 844, tactile), depuis
l'ouverture de l'app (Ma journée), sur une base INVENTÉE (celle des passes design, `baseSites`, + une offre
en attente, deux colis au point relais avec leur code, le régime URSSAF choisi). Pour chaque geste :
touchers (le toucher décisif compris : Imprimer, Accepter, Déposé, Appliquer…), touchers en zone haute (tiers
haut de l'écran, hors du pouce), défilés, mots à l'écran au moment de chercher la cible, plus longue attente,
impasses. Un geste a plusieurs chemins, du plus court au plus long ; le premier qui ABOUTIT (son but vérifié
par un `data-*` dans la page, jamais un libellé) est retenu. Le toucher décisif d'un geste qui enverrait
quelque chose est compté et placé mais pas joué : le banc n'écrit rien.
Rouge : un geste au-dessus de son plafond (3 touchers ; 0 pour « ce qui est à faire », 1 pour le bénéfice,
2 pour imprimer), ou sans aucun chemin qui aboutit.
Liste des gestes et de leurs chemins : `scripts/bancs/_ergonomie-gestes-liste.cjs`.
Lancer : `npm run build`, puis `BANC_PORT=… node scripts/bancs/ergonomie-gestes.cjs` (`BANC_DIST=` pour un
autre build, `GESTES=id,id`, `DEBUG=1` les cibles visibles quand un chemin échoue, `SHOTS=` captures).

Mesuré sur `origin/main` + les six branches de refonte disponibles au moment de la mesure (coque, listes,
achats, fiche-partout, messages-stock ; **plateformes-reglages** n'a pas pu être fusionnée : vrais conflits
de code dans `AnnoncesLeboncoin.jsx` et `ecrans/Vestiaire.jsx` avec fiche-partout, à trancher par ses
auteurs — aucun des 15 gestes ne passe par ces deux écrans).

## Tableau avant / après (touchers depuis l'ouverture)

| # | geste | plafond | avant | après | chemin retenu après | zone haute après |
|---|---|---|---|---|---|---|
| 1 | Imprimer les bordereaux du jour | 2 | 2 | 2 | Ma journée « Imprimer » → feuille → Imprimer | 0 |
| 2 | Retirer un colis et montrer son code | 3 | 1 | 1 | Ma journée « À retirer » (code écrit sur la ligne) | 0 |
| 3 | Saisir un prix d'achat | 3 | 2 | 2 | Ma journée « sans prix d'achat » → Saisir (+ la saisie) | 0 |
| 4 | Trouver la paire N°x | 3 | 2 | 2 | Loupe → N° tapé → « Toute l'histoire du N° » | 2 |
| 5 | Répondre à une offre | 3 | 3 | 3 | Ma journée « messages » → l'offre → Accepter | 0 |
| 6 | Baisser un prix | 3 | 3 | 3 | Loupe → N° → « Baisser le prix » → Appliquer | 1 |
| 7 | **Republier (à la main)** | 3 | **5 ✗** | **3 ✓** | Loupe → N° → « Republier N° à la main » → Tout copier | 1 |
| 8 | Marquer un colis déposé | 3 | 3 | 3 | Ventes → ⋯ → Déposé (pilule « Annuler » 5 s) | 0 |
| 9 | Relier un achat | 3 | 2 | 2 | Ma journée « sans achat » → « Relier · 21 € » | 0 |
| 10 | Voir ce qui est à faire | 0 | 0 | 0 | à l'ouverture | 0 |
| 11 | Déclarer l'URSSAF du mois | 3 | 3 | 3 | Argent → Déclarer → J'ai déclaré | 1 |
| 12 | Changer de compte | 3 | 3 | 3 | Paires → compte ▾ → vendeur_2 | 1 |
| 13 | Lire un message | 3 | 2 | 2 | Ma journée « messages » → le fil | 0 |
| 14 | **Publier une paire partout** | 3 | **≥ 4, impasse ✗** | **3 ✓** | Loupe → N° → « Publier N° partout » → Publier | 1 |
| 15 | Voir le bénéfice du mois | 1 | 0 | 0 | à l'ouverture | 0 |

Avant : la paire passe par Paires → la paire → « Publier ailleurs », et la feuille « Publier partout » n'est
pas atteinte au 4ᵉ toucher (impasse mesurée). Republier « à la main » : Paires → Republier → cocher → À la
main → Tout copier = 5. Mots à lire, attentes et défilés de chaque geste : `rapport.json` du banc.

## Ce qui a changé

1. **⌘K « Republier N°x à la main »** (`src/annulerCommandes.js`, action `republier-num`) : on tape le N°
   dans la loupe, la ligne ouvre le kit « à la main » (conseillé, le moins risqué) de L'annonce en ligne qui
   porte CE N° (identité exacte `cleNum`, jamais une ressemblance), par la même règle que le bouton « À la
   main » de la vue Republier (`actionsPossibles`, k `main`). Rien ne part chez Vinted : c'est lui qui publie
   (§3, l'atelier n'est pas touché). Aucune annonce en ligne sous ce N°, ou plusieurs : la vue Republier
   s'ouvre et une phrase dit pourquoi (il coche lui-même). La demande (`DEMANDE_REPUB_MAIN`) vit 30 s et est
   relue tant que l'écran Annonces (chargé à la demande) n'est pas prêt.
   Avant : Paires → Republier → cocher → À la main → Tout copier = 5 touchers ; après : 3.
2. **⌘K « Publier N°x partout »** (`partout-num`) : ouvre la feuille « Publier partout » de ce N° (le même
   évènement `vrm:publier-partout` que le geste de la fiche) ; rien ne part avant « Publier ».
   Avant : Paires → la paire → Publier partout → Publier = 4 ; après : 3.
3. Les deux lignes s'ajoutent à celles d'un N° tapé seul (`ACTIONS_NUM_SEUL` : baisser le prix, republier à la
   main, publier partout, Stock). Textes par `tr()` (`src/i18n/langues/*/ergonomie.js`, 5 langues) ; les
   libellés français de `annulerCommandes.js` restent le repli lu par les audits. `audit-annuler-commandes`
   A7 / A7b : la liste du N° et ce que chaque ligne OUVRE (jamais sans N°). Ligne « Quoi de neuf ».

## Ce qui est déjà bien (mesuré, pas touché)
- Imprimer depuis Ma journée : 2 touchers (la case « Imprimer » ouvre la feuille « Tout imprimer »).
- Retirer un colis : 1 toucher, le code est écrit sur la ligne (« ce qu'il faut au comptoir »).
- Prix d'achat et relier un achat : la carte de Ma journée mène à la liste, 2 touchers.
- Déposé : 3 touchers et la pilule « Annuler » 5 s (geste réversible, aucune confirmation) — déjà là
  (`gesteVrm`, lot Y).
- Ce qui est à faire et le bénéfice du mois : 0 toucher, à l'écran à l'ouverture.

## Restes (nommés, pas faits)
- La loupe est en haut à droite : chaque geste par ⌘K a 1 toucher en zone haute (le clavier occupe le bas
  pendant la saisie). Un accès à la recherche dans la zone du pouce changerait la coque (4 onglets décidés
  le 14 nov., n° 61) : à proposer à Julien, pas fait ici.
- « Imprimer » depuis Ma journée attend que la liste soit lue en entier (`lotLu`, §4.1) : jusqu'à ~6–12 s
  sur la machine de banc chargée. Ne pas ouvrir la feuille avant (une liste pas lue n'est pas une liste vide).
- L'offre : 3 touchers quand l'offre est la conversation la plus récente ; sinon « Offres reçues » en ajoute un.
- Focus et retour au même défilement après une feuille : pas mesurés par ce banc (à ajouter).

## Preuves
- `scripts/bancs/ergonomie-gestes.cjs` : sur le build d'AVANT (commit `afd5d31e`, `git archive` + build dans
  un dossier à part) **13 ✓ · 2 ✗** (republier 5 > 3, publier partout impasse) ; sur ce build **15 ✓**.
  Mutation : `republier-num` retiré de `ACTIONS_NUM_SEUL` ⇒ republier **ROUGE** (5 touchers, la ligne
  introuvable). Captures regardées (kit « Republier à la main » N°203, feuille « Publier partout » N°203).
- Après le vrai `git merge origin/main` et des branches de refonte : build vert, banc relancé (voir le
  rapport de fin de session), audits verts : traduction, tdz, coherence, variables, quoi-de-neuf,
  annuler-commandes (43 ✓, A7/A7b nouveaux), icones.
- Machine de banc très chargée (charge 55–72, autres sessions) : les attentes sont des conditions (15 s pour
  un toucher décisif, 25 s pour l'ouverture), jamais des délais fixes.
