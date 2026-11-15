# 15 nov. 2026 — Vendre plus : baisse conseillée, relance des favoris, loupe universelle

Branche `claude/vendre-plus` (partie de `claude/project-review-nsk5su`). Pas de PR (demandé).
Validé par Julien : les trois chantiers ci-dessous. L'extension n'est PAS touchée : tout passe
par ses gestes existants (`baisserPrixVinted`, la file « offre aux favoris »).

## 1. Baisse de prix intelligente — `src/baisseConseillee.js`

**Une règle par notion (§5).** Elle ne remplace pas le conseil mesuré du 12 nov.
(`src/conseilPrix.js` : ≥ 30 j en ligne, −10 % au plus, une proposition tous les 14 j, jamais
sous achat + 10 %, achat inconnu ⇒ rien) : elle PREND son résultat (`conseil`) et décide, avec
les données LUES de l'annonce :

| ordre | si… | décision | geste proposé |
|---|---|---|---|
| 1 | < 30 j, prix ou âge pas lus, vendue | rien | — (aucun prix à la mise en ligne) |
| 2 | prix d'achat pas saisi | « Prix d'achat ? » | la saisie (§2.5) |
| 3 | baissée < 14 j, proposée < 14 j, trop près du plancher | garder | — |
| 4 | offre reçue LUE | garder | voir les offres |
| 5 | SES ventes comparables (≥ 5 datées) et pas 1,5 × son délai habituel | garder | — |
| 6 | ≥ 3 favoris LUS | garder | offre aux favoris |
| 7 | ≤ 25 vues LUES | garder | republier |
| 8 | sinon | baisser : −5 % (douce), −10 % si ≥ 3 × son délai ou ≥ 2 vues/j sans favori | Appliquer |

- **Comparables = SES ventes** (relevé `vrm_stats_ventes` × la lecture partagée de Statistiques
  `lireExtrasRepartition`) : la vente rejoint SON annonce par SA transaction (jamais un titre) ;
  groupe = modèle sûr (`modeleSur`), sinon marque LUE, sinon tranche de prix (`delaisPar`).
  Lu seulement sur Annonces (cache de 10 min déjà partagé) ; pas lu ⇒ sans comparables, et la
  feuille le dit.
- **Plancher** : `plancherVente` (achat + frais connus de la fiche) en plus de achat + 10 % ;
  remonté au plancher et DIT ; frais pas tous saisis ⇒ « au moins ».
- **Pas su ≠ peu/aucun** : vues, favoris, offres pas lus ne déclenchent rien. Les offres par
  annonce ne sont PAS lues aujourd'hui (capture des conversations arrêtée, voir
  `src/statsOffres.js`) : l'app passe `offres: null`.
- **Branchement** : `decisionsBaisse` (App.jsx) ⇒ `conseilsPrix` (la carte que lisent la fiche,
  le repricing et « Qui dorment ») par `commeConseil` : UNE proposition affichée partout.
- **Feuille** `src/BaissesConseillees.jsx` (tuile « N baisses conseillées » au-dessus de
  Annonces → À relancer → Qui dorment). « Appliquer » / « Appliquer les N baisses » ouvre la
  feuille EXISTANTE `BaissePrixSerie` avec `cible` par annonce (`lignesBaisse` : la cible remplace
  la baisse tapée, jamais « variée », jamais ≥ prix) — aperçu, son clic, confirmation, une à la
  fois, prix RELU, plafonds de l'extension. Rien n'est envoyé d'ici.

## 2. Relance des favoris au bon moment — `src/relanceFavoris.js`

Carte de Ma journée (dans le bloc « favoris », rangeable avec lui) : « 6 personnes aiment N°47 ·
depuis 60 j, aucune vente · offres pas lues ». Conditions : compteur LU ≥ N (le seuil de « Très
aimées, pas vendues », `vrm_sans_vente_favoris_min`, 3 par défaut) ET rien depuis 7 j (la plus
récente date CONNUE : mise en ligne, dernier favori daté de la cloche — la MÊME lecture que
« Nouveaux favoris », `useNouveauxFavoris` expose maintenant `lignes` —, offre lue, relance).
Aucune date ⇒ pas de carte. Le geste : `preparerEnvoiFavoris(uid, …, item)` ⇒ Messages →
Favoris coche les favoris de CETTE annonce par `favorisAContacter` (une personne une fois,
jamais un déjà contacté) ; l'envoi reste SON « Envoyer ». eBay (observateurs) : la règle le sait,
l'app ne le branche pas encore (les annonces eBay ne sont pas lues dans Ma journée). Vestiaire
« aimés » : aucune lecture ne les range — pas de carte.

## 3. Loupe universelle — `src/rechercheUnique.js`

Elle trouvait déjà N°, suivi, code, pseudo, transaction, titre/marque/taille, ventes, achats,
colis, messages, annonces, factures. Ajouté : **Stock** (`stockPourRecherche` : chaque N° du plan
et du garage avec son lieu ; le lieu s'ajoute à la paire qui a une fiche, un N° rangé sans fiche
est un résultat « Stock » qui ouvre le Stock sur CE N°), **Retours** (la lecture partagée
`fetchRetoursAchat` : n° de transaction, n° de suivi du bordereau de retour ⇒ son achat), le
**plus probable d'abord** (mots entiers avant morceaux, en ligne avant hors ligne, groupes rangés
par leur meilleur résultat, `ordre`), et la **vitesse** (`normaliser` saute NFD pour un texte ASCII).

## Preuves

- `scripts/audit-baisse-conseillee.cjs --prouve` (une quarantaine de contrôles + 12 mutations, 50 annonces
  identiques), `audit-relance-favoris.cjs --prouve` (23 + 8), `audit-loupe-vendre-plus.cjs --prouve`
  (17 + 7 ; 5 370 entrées : index + recherche ≈ 20 ms de calcul, une frappe ≈ 1 ms). Les trois
  sont ROUGES sur l'arbre de départ (`git archive origin/claude/project-review-nsk5su`).
  Le temps se mesure en temps de CALCUL (`process.cpuUsage`) : la machine du banc était à une
  charge de 56, l'horloge murale y mesure l'attente des autres.
- Banc `scripts/bancs/baisses-conseillees.cjs` (390 tactile et 1512, clair et sombre) : 78 verts.
- Non régressés : audit-conseil-mesure, audit-dormantes, audit-baisse-prix, audit-recherche-unique,
  -exacte, -numero, audit-traduction, audit-quoi-de-neuf, audit-studio, audit-icones,
  audit-favoris-sans-vente, audit-robustesse-metier. Bancs : `vendre-plus` a 2 rouges (« Agir… Leboncoin · eBay · Vestiaire ») AUSSI sur le build de départ (mesuré) ; `baisse-prix` G2 dépend du hasard de « Varier » (le banc ne le décoche pas sur ce chemin, sans cible) — 1 rouge sur 59 ici, rien de ce lot sur ce chemin.
  `audit-recherche-universelle` : ses deux contrôles de temps à l'horloge murale rougissent sur
  cette machine chargée AVANT comme APRÈS ce lot (mesuré sur les deux arbres).

## Geste de Julien

Aucun. (Installer rien : l'extension servie suffit.) Pour voir les délais habituels, ouvrir une
fois Statistiques ou Annonces avec ses ventes lues.
