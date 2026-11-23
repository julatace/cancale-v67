# 20 nov. — bugs-terrain : ce que SA base révèle (branche `claude/bugs-terrain`)

Julien, après la mise en ligne du 20 nov. (d7bc5598a) : « C'est bien mais ça bug beaucoup trop encore ». Captures iPhone
(15:35) prises pendant que la barre bleue restait figée vers 80 % : Achats « À retirer au moins · 18 », « 13 à vérifier »,
puis rien ; Ventes « À envoyer » sans aucune photo ; Annonces en squelette.

## Mesuré (lecture seule, nombres agrégés)
- Sa base : 12 comptes Vinted, ~2 600 ventes et ~2 700 achats dans `orders_*` (un compte en porte ~2 000 de chaque),
  453 lignes `email_track_*`, 249 bordereaux. Les bancs servaient 3 à 7 comptes et 30 à 80 commandes par compte.
- Journaux Supabase de la session iPhone : toutes les lectures répondent en 200 (aucune panne serveur) ; ~700 requêtes en 3 min.
- Sonde `scratchpad/terrain/sonde.cjs` (hors dépôt) : l'app buildée, base INVENTÉE au volume de la sienne
  (`_base-volume.cjs` : 12 comptes, 2 600 ventes, 2 700 achats, 1 000 annonces), 390 tactile, processeur ×4.
  Résultat : 29 à 35 s de tâches longues sur 42 s ; les e-mails de suivi posés après plus de 20 s ; la barre du haut
  allumée presque tout le temps ; en v2, « À retirer au moins 0 » puis une zone vide.

## Corrigé
1. **Achats · À retirer n'est plus jamais un vide muet** (`src/App.jsx`, bloc v2) : lecture en cours ⇒ « Je lis tes colis… » ;
   lecture ratée (avant : `tracking` restait `null` pour toujours, sans phrase ni relecture) ⇒ la phrase + « Réessayer ».
   Le détail replié n'est monté qu'ouvert (`DetailsRepliOuvert`). Banc `retraits-jamais-muet` : 6 rouges sur origin/main, 12 verts.
2. **`texteVerifie`** (`src/sourcesRetrait.js`) : trois formateurs gardés au lieu d'un `Intl` neuf par appel (7 s sur 25 s au profil),
   textes identiques. `audit-texte-verifie` A–C.
3. **`jourDe`** (`api/_lib/retrait-colis.js`) : le jour de Paris gardé par heure (0,9 s au profil). `audit-texte-verifie` D.

## Vu, pas corrigé (à reprendre)
- Le fond du problème reste le CALCUL : Achats monte 3 `Comptabilite`, Ventes 2 ; chacun refait ses dérivés à chaque arrivée
  de données (11 s inclusifs au profil). Points chauds restants : `rangsEnvoyerNatif` (2,7 s, deux `toLocale…String` par rangée),
  `ajusterChiffre` (1,5 s de mises en page forcées), `useTitreReduit` (relit la mise en page toutes les 1,5 s), `load()` qui
  relit et reparse `vinted_annonce_numeros` (~250 Ko) dans des boucles de rendu.
- Photos des ventes (relues dans les transactions) : l'effet relit TOUT à chaque nouvelle référence de `sales.items` (journal :
  101 lectures `id=in.(…txn…)` en 2 min 30, les mêmes identifiants relus).
- `lireSuivisSansQr` relit les QR « retirés remis en jeu » par lots de 40 L'UN APRÈS L'AUTRE (8 allers-retours au banc).
- Ventes « À envoyer » sans photo : toutes ses 11 ventes à envoyer portent une photo ; tant que les commandes Vinted ne sont pas
  posées, les rangées viennent des e-mails (sans photo). C'est la lenteur, pas une donnée absente.
- Leboncoin : `lbc_listings` garde 49 annonces actives de 47 AUTRES vendeurs (vues en naviguant) ; l'écran Leboncoin les écarte
  (`annonceLbcALui`), à vérifier chez chaque autre lecteur.

## Suite (20 nov., soir) : le fil principal saturé
Mesure fixe : sonde hors dépôt (`_base-volume` à 12 comptes, 2 600 ventes, 2 700 achats, 1 000 annonces ; 390 tactile,
processeur ×4, 2e ouverture, 42 s). Origine = origin/main fusionnée (f57375a1c). Variance d'une passe à l'autre : ±2–3 s.

| écran | prêt avant → après | tâches longues avant → après |
|---|---|---|
| Achats (À retirer lu) | 25,6 s → 10,5 s | 35,5 s → 25,8 s |
| Ventes (photos affichées) | 6,7 s → 5,4 s | 27,8 s → 22,6 s |
| Annonces (squelette fini) | 4,9 s → 4,6 s | 16,0 s → 12,9 s |

Fait : formateurs gardés (`src/formatsRapides.js`, repris de claude/iphone-rapide), comparateurs gardés
(`src/comparaisonsRapides.js`), cache de session oublié sans réécrire 1,5 Mo (`oublierAcct`), affectation des propositions
hors du moteur des outils et recalculée quand les données se posent, `cartesColis`/`listeEnvoyes` une fois par rendu,
`bordForItem` par index, photos des ventes sans tout relire, lots de suivis trois à la fois. `chiffres-volume` : 38 relevés
identiques à origin/main. `achats-liaison` : 6 rouges préexistants sur origin/main (390), aucun de plus.

Pas atteint : diviser les tâches longues par 3. Ce qui reste est réparti : ~45 rendus par moteur `Comptabilite` en 42 s (17–19
seulement viennent de la coque, le reste de leurs propres lectures asynchrones et des magasins partagés), 3 moteurs sur
Achats ; chaque rendu refait ses dérivés et réconcilie ~480 rangées (Achats) ; « (program) » (style, mise en page) ~1/3.
Prochain levier : les dérivés lourds (`pickupUnion`, `expeditions`, `cartesColis`) calculés UNE fois pour tous les moteurs,
dans un magasin indexé par leurs données ; rangées mémoïsées (props stables) ; le moteur des outils de retrait monté après
le calme. Non fait, et pourquoi : `load()` mémoïsé (des appelants modifient l'objet rendu puis `save` : risque de fausse
donnée) ; `useTitreReduit` et `ajusterChiffre` (le temps mesuré est la mise en page que l'image ferait de toute façon).

### Le levier (a) mesuré avant de le construire (20 nov., nuit)
Même mesure fixe (Achats, 12 comptes, ×4, 42 s, ~26 s de tâches longues) :
- **Rendus de la coque (4)** : moteurs enveloppés dans `React.memo` avec fonctions stabilisées : les rendus de la coque
  n'atteignaient le moteur que 2–3 fois (props changées : `accounts`, `accountsReady`, `liveStats`, `sitesPresents`) ; ~40 rendus
  par moteur viennent de SES propres lectures asynchrones. Gain nul ⇒ retiré.
- **Un seul moteur par onglet (2)** : le moteur des outils de retrait RETIRÉ entièrement (essai sur le build) : 26,4 → 25,6 s.
  Ce n'est pas le nombre de moteurs.
- **Rangées (3)** : l'écran Achats fait ~2 550 nœuds ; la réconciliation des rangées n'est pas le coût.
- Trace (catégories timeline) : `FunctionCall` 30,9 s, `TimerFire` 8,6 s, `UpdateLayoutTree` 5,3 s, `Layout` 0,3 s.
  Le coût est le JavaScript du moteur (14,5 s inclusifs) refait à chacun de ses ~40 rendus, et les minuteries.
⇒ Diviser par 3 demande de SORTIR le calcul du moteur : les dérivés (`pickupUnion`, `expeditions`, `cartesColis`,
`listeEnvoyes`, l'affectation, `usePasEnLigne`) dans un magasin de module recalculé quand ses SOURCES changent (pas à chaque
rendu), et les lectures asynchrones du moteur regroupées (un rendu par vague de données, pas un par lecture).

### Vagues (2) et premier dérivé (1) — 20 nov., soir
- `origin/claude/lectures-legeres` fusionnée (vrai merge ; leur retrait de la barre bleue gardé).
- **(2) Vagues** (9534e042e) : dans le moteur, `useState = useStateVague` — un setState hors geste est gardé ≤ 80 ms puis appliqué
  avec les autres en `startTransition` ; un geste vide d'abord la vague. Compteur de rendus : PAS moins de rendus (45–56 par
  moteur : les données arrivent étalées sur 20 s, et un rendu de transition interrompu recompte) ; le gain vient du rendu
  par tranches. Mesure sous une machine chargée (load 11–19), 3 passes alternées par build :
  Achats tâches longues 29,4 → 26,9 s en moyenne, prêt 13,1 → 10,5 s ; Annonces 12,4 → 10,7 s. Le bruit (±3 s) est du
  même ordre que l'écart : une première mesure à 19,8 s (machine calme) n'a pas été retrouvée.
- **Achetés pas en ligne** (00d5c62fe) : candidats calculés seulement là où ils sont montrés.
- **(1) Dérivés en magasin de module : pas fait.** `cartesColis` (le plus coûteux : 1,8 s Achats, 2,8 s Ventes) lit ~40 valeurs
  du moteur, dont des fonctions recréées à chaque rendu (`effEntry`, `isShipDone`, `numForBord`, `commandeRetrait`,
  `transporteurVente`…) qui lisent elles-mêmes l'état. Un magasin « recalculé quand ses sources changent » exige d'abord de
  rendre ces sources explicites ; une seule oubliée = un colis affiché avec un état périmé (§5 : pire qu'un blanc). À faire en
  chantier dédié, fonction par fonction, chacune avec chiffres-volume ET un banc qui change UNE source et vérifie la carte.
- chiffres-volume : identique (le banc trie désormais les attributs d'un même élément ; la prévision haute dépend de
  l'heure — comparer deux relevés pris à la même heure).
