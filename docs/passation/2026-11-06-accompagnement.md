# 6 nov. 2026 — L'accompagnement : une bulle sur le bon bouton (branche `v36-accompagnement-2`)

Julien (6 nov.) : « Je veux quelque chose de plus beau, simple et visuel ; peut-être
un accompagnement à faire telle ou telle action quand tu juges favorable, que l'on
peut skip. »

Une première session avait conçu ce chantier puis perdu ses fichiers (rien de
commité). Ce chantier refait son plan, vérifié dans le code.

## Ce qui change pour lui

1. **La visite en bulles** (premier jour, après Bienvenue) passe de 7 bulles
   (un onglet chacune) à **4** : la navigation entière (barre du bas au téléphone,
   colonne sur ordinateur), puis l'étape « extension » du guide de démarrage, puis
   l'étape « boîte e-mail », puis « Découvrir avec des exemples ». Une cible absente
   est sautée, comme avant (`src/visiteBulles.js`, banc `demo-bulles.cjs`).
2. **Les conseils** : au plus UNE bulle à la fois, posée à côté du VRAI bouton d'un
   geste utile, quand un chiffre que l'écran affiche déjà le justifie. Un halo
   autour du bouton, sans voile (l'écran reste vivant), un titre, une phrase, le
   geste (il touche le bouton de l'écran), « Plus tard » et « Ne plus montrer ».
   Échap = « Plus tard ». Toucher le bouton pointé lui-même = geste fait.
3. **Paramètres → Aide** : interrupteur « Conseils » (sur tous ses appareils) et
   « Revoir les conseils » (ce qu'il a passé ou masqué peut revenir).

## Les conseils

| conseil | quand (chiffre publié par l'écran) | bouton pointé | geste |
|---|---|---|---|
| Un envoi presse | Colis : `nLot ≥ 1` et un bordereau pour aujourd'hui ou demain (`gesteEnvoi` de `src/prochainGesteColis.js`, la règle de « Prochain geste ») | `[data-colis-barre-btn="imprimer"]` | Tout imprimer |
| Un compte sans e-mail | Colis : `ComptesMuetsColis`, `muets.length ≥ 1`, état **lu** | `[data-colis-comptes-muets-ouvrir]` | Relier maintenant |
| Annonces eBay à relier | eBay : `setRelierAnn.size ≥ 1` (le compte du filtre « À relier ») | `[data-ebay-filtre="relier"]` | Voir lesquelles |
| Des prix d'achat manquent | Annonces : `m ≥ 5` et `m − n ≥ 5` (le N/M de `data-ann-achats` / « Prochain geste ») | `[data-ann-achats-completer]`, sinon le bouton du « Prochain geste » prix | Saisie en série |
| Des paires dorment | Annonces : `annStats.sleeping ≥ 1` | « À relancer » (`data-vue-relancer`, ajouté) | Voir les paires (il choisit, il lance) |
| Offres automatiques sans seuil | Annonces : offres auto allumées et « Accepter dès » sur < 20 % d'au moins 5 annonces (`nbAccepterDes`, la règle de la carte « Offres automatiques ») | `[data-vue-selection]` | Sélectionner (puis Actions → Prix mini) |
| Ton premier inventaire (une fois) | Stock : ni inventaire en cours ni ancien dans `vrm_inventaire` (scalaires projetés + la copie de l'appareil) et ≥ 10 N° d'annonces actuelles | `[data-stock-inventaire-ouvrir]` | Commencer |
| Ton extension est en retard | Coque, ordinateur, Ma journée : la règle du bandeau `ExtEnRetard` (`extEstEnRetard`, désormais partagée) | `[data-nav-entree="settings"]` | Voir comment ⇒ Paramètres → État des connexions |
| VRM sur ton écran d'accueil | Coque, téléphone, Ma journée : iPhone + Safari + pas installée (`src/guideIphone.js`) | `.vrm-nav-more` | Voir comment ⇒ Paramètres → Notifications du téléphone |

Aucun nombre n'est redit dans la bulle (§7 : il est déjà à côté du bouton pointé).
Aucun sujet refusé (§3) : ni rappel de messages sans réponse, ni rappel
d'évaluations, ni prix conseillé, ni alerte « achat jamais arrivé ». Aucun conseil
ne fait un geste à sa place : le bouton de la bulle touche celui de l'écran.

## La règle (`src/accompagnement.js`, pure)

- **Chiffres publiés** : `<ChiffreConseil cle valeur/>` posé par l'écran À CÔTÉ du
  calcul qu'il affiche déjà (§11) ; `publierChiffre` / `retirerChiffre` (démontage).
  `undefined` (en cours) ou `null` (pas su) ⇒ aucun conseil, quelle que soit la
  condition.
- **`choisirConseil({ ecran, chiffres, memoire, contexte, enCours })`** : le premier
  conseil du catalogue dont la condition est vraie sur un chiffre lu, libre (repos,
  jamais, une fois), au bon appareil et au bon écran, et dont la cible est visible.
- **Plafonds** : 2 par jour, 1 par écran et par jour (jour de **Paris**) ; « Plus
  tard », le geste fait, ou un simple « vu » ⇒ 3 jours ; « Ne plus montrer » ⇒
  jamais ; `uneFois` ⇒ une seule fois.
- **`raisonSilence`** : app pas prête (comptes lus, nuage arrivé, base joignable),
  appareil coupé (bancs), tour en cours (Bienvenue, visite, ou personne neuve qui
  n'a pas vu la visite), mode exemple, mode stream, écran tombé sur le garde-fou,
  chargement, feuille ouverte, mémoire pas lue, conseils coupés, un conseil déjà
  là ⇒ rien.
- **Mémoire** : SA ligne `vrm_accompagnement` (`{ v, rev, coupe, etats: { cle: { vu,
  plusTard, fait, jamais } }, vus: [{ c, e, at }] }`), lue/écrite par
  `lireLigneAccompagnement` / `ecrireLigneAccompagnement` (App.jsx, le motif exact de
  l'inventaire : `null` sur lecture ratée, comparer-et-échanger sur `data->>rev`).
  `modifierMemoire` n'écrit RIEN si la lecture rate, relit sur conflit (3 essais).
  **Un conseil ne paraît qu'une fois son « vu » écrit** : un rechargement ne le
  ramène pas, un autre appareil non plus.
- **`placerConseil`** : dessous si ça tient au-dessus de la barre du bas, sinon
  dessus, sinon le côté le plus large ; la pointe tombe dans la cible.

## La bulle (`src/Conseils.jsx`, `src/styles-conseils.css`)

Portail sur `<body>`, z 8500 (au-dessus de l'écran, sous les feuilles), non
modale (`role="dialog" aria-modal="false"`, phrase en `aria-live`). Choisie
1,4 s après que l'écran s'est posé ; suivie au défilement et au redimensionnement ;
une feuille, le garde-fou ou le mode stream qui s'ouvrent la retirent ; une cible
qui disparaît la retire (sans réponse : le « vu » suffit, 3 jours de repos).
Entrée : ressort `linear()` (amortissement 0,83, dépassement ≈ 0,9 %) depuis la
pointe, 420 ms, et un fondu ; halo qui « respire » une fois ; sortie 140 ms ;
mouvement réduit ⇒ fondu seul. Le geste en bleu Apple (le seul accent),
pleine largeur ; « Plus tard » / « Ne plus montrer » discrets, 44 px. Le halo
reste dans l'écran (« Plus », collé au bord, garde un anneau entier).

## Branchements dans `src/App.jsx` (chirurgicaux)

- imports ; `lireLigneAccompagnement` / `ecrireLigneAccompagnement` (à côté de
  l'inventaire) ; `ChiffreInventaire` ; `nbAccepterDes` (la carte « Offres
  automatiques » s'en sert aussi) ; `extEstEnRetard` + `ChiffreConseilExtension`
  (le bandeau `ExtEnRetard` lit la même règle) ; `DEMANDE_REGLAGE_SOUS` (un
  conseil ouvre un panneau de Paramètres).
- `<Conseils>` monté à côté de `VisiteBulles`, avec `tour = bienvenue || visite ||
  (premierJour && !vrm_visite_vue)`, `exemple`, `stream`, `telephone`.
- Chiffres : Colis (barre « Tout imprimer », `ComptesMuetsColis`), eBay (filtres),
  Annonces (vues rapides, ligne prix d'achat), Stock (`StockMeubles`), coque.
- `src/prochainGesteColis.js` : `gesteEnvoi` exporté (aucun changement de règle).
- `scripts/bancs/_porte-banc.cjs` : `vrm_conseils_appareil=coupes` sur l'appareil du
  banc, sauf `vrm_banc_conseils` (un banc qui les juge).

## Preuves

- `node scripts/audit-conseils.cjs` : 135 ✓ — exécute la règle (condition vraie ⇒
  conseil ; pas su ⇒ rien ; seuils au bord ; 3 jours ; jamais ; une fois ; 2/jour,
  1/écran, minuit de Paris ; chaque raison de silence ; lecture ratée ⇒ 0 écriture ;
  conflit ⇒ relu sur la nouvelle `rev`, rien perdu ; place de la bulle) et le
  branchement (chaque chiffre publié, chaque cible dans le source, « vu » écrit
  avant de montrer, Échap, porte de banc, Paramètres, aucun sujet refusé, aucun
  nombre redit).
- `node scripts/audit-conseils.cjs --prouve` : 15 mutations de la règle, toutes
  rouges. Sur l'arbre d'avant (`4369d989`) : rouge (module absent) ; avec le seul
  module copié : 15 rouges de branchement.
- `scripts/bancs/conseils.cjs` (1512 et 390 tactile, clair et sombre) : la bulle
  pointe la cible (pointe dans son rectangle, du bon côté), halo, tient dans l'écran
  et au-dessus de la barre, aucun voile, 44 px, « vu » écrit, « Plus tard » /
  Échap / « Ne plus montrer » / geste écrits, rechargée ⇒ ne revient pas, lecture
  ratée ⇒ ni bulle ni écriture, interrupteur et « Revoir », mouvement réduit ; un
  conseil d'écran (Annonces, prix d'achat) qui ouvre la saisie en série.
- `demo-bulles.cjs` (4 bulles), `nouveau-vendeur.cjs`, `navigation-tache.cjs` ;
  `npm run build`, `audit-coherence`, `audit-identite`, `audit-tdz`,
  `audit-variables`, `audit-garde-ecrans`, `audit-icones`, `audit-colis-prochain`.

## Ce qui reste / gestes de Julien

- Aucun geste obligatoire. S'il trouve les bulles de trop : Paramètres → Aide →
  « Conseils ».
- La session `v36-visuel` refait eBay/Colis/Annonces : les cibles sont des `data-*`
  (`data-colis-barre-btn`, `data-colis-comptes-muets-ouvrir`, `data-ebay-filtre`,
  `data-ann-achats-completer`, `data-vue-relancer`, `data-vue-selection`,
  `data-stock-inventaire-ouvrir`) : à garder en refaisant ces écrans, avec les
  `<ChiffreConseil>` posés à côté des calculs. `audit-conseils` le vérifie.
