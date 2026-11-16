# 16 nov. — eBay → « À traiter » : les deux messages vus par Julien (lot `ebay-a-traiter`)

Vu en production sur iPhone, Ventes → eBay → À traiter :
1. « Retours : Réponse eBay illisible pour les retours. » (bloc « Retours et annulations ») ;
2. « Compte eBay mal désigné — rien n'a été envoyé à eBay. » (bloc « Tâches à traiter », après « Actualiser »).

## Mesure (lecture seule, vraie base)
- `ebay_comptes` de Julien : **un seul compte**, `principal:true`, clé de 16 hexadécimaux, site FR,
  particulier, non déconnecté. `ebay_orders` : 301 octets (aucune commande en cours).
- Aucune donnée réelle n'est recopiée dans le dépôt.

## Cause de (2) — un vrai défaut, deux couches
- `EbayAgent` (`src/ebayGestion.jsx`, « Tâches à traiter ») appelait `appelerEbay('agent', {compte}, …)`
  avec `compte = 'principal'` (le `ref` que l'app donne au principal). Tous les autres blocs
  retirent `'principal'` ; lui l'envoyait tel quel. `resoudreCompte` (api/_lib/ebay.js) exige une
  clé de 16 hexadécimaux ⇒ 400 « Compte eBay mal désigné ».
- Derrière, l'action `agent` répond **410** depuis le lot `familles-serveur` (11 nov., H27/M87), dont
  le récit disait « plus appelée par l'app » — c'était faux : « Tâches à traiter » l'appelait encore.
  Un second compte (clé) lisait donc « L'agent eBay est arrêté ».

Corrigé :
- serveur : `resoudreCompte` lit `'principal'` comme l'absence de `compte` (le principal) ; le refus
  d'une clé mal formée dit le geste (« Ouvre eBay → Compte et reconnecte ce compte ») ;
- serveur : nouvelle action **`taches`** (`tachesEbay`, api/ebay.js) — LECTURE SEULE, la même liste
  qu'avant (`preparerAgentEbay` : commandes à expédier, messages, offres, journal), mais
  `ebay_orders` lue **projetée** (`orders:data->orders,capturedAt:data->>capturedAt`, la projection de
  l'app), le journal en `items` seul, messages et offres **en parallèle**. `agent` reste 410 ;
- app : `EbayAgent` appelle `taches` avec `corpsCompteGestion(compte)` (rien pour le principal, la clé
  sinon) ; un refus qui se règle en reconnectant (`scope`, `compte`, `compte-inconnu`,
  `compte-deconnecte`, `reconnecter`, `not-connected`) montre un bouton « Reconnecter mon compte eBay »
  (`ebt.reconnecter`, 5 langues) qui ouvre eBay → Compte (`allerComptesEbay`).

## Cause probable de (1)
Julien n'a aucun retour. `retoursEbay` exigeait un tableau `members` ; un corps vide (data `null`), un
204, ou une réponse sans `members` (seulement `paginationOutput.totalEntries: 0`) rendait « illisible ».
La documentation Post-Order v2 (`GET /post-order/v2/return/search`, ReturnSearchResponse : `members`,
`paginationOutput{limit,offset,totalEntries,totalPages}`) n'a pas pu être relue d'ici
(developer.ebay.com hors du réseau de la session) : la lecture est rendue **tolérante aux formes
documentées**, sans rien inventer :
- 204, ou 2xx au corps vide ⇒ `retours: []` (« Aucune demande ») ;
- objet sans `members`/`returns`, sans `error(s)`, avec un total à 0 (`total`, `totalCount`,
  `totalEntries`, `paginationOutput.totalEntries`) ou objet vide `{}` ⇒ `[]` (`totalDitZero`) ;
- `members` ou `returns` ⇒ lus ;
- toute autre forme ⇒ toujours **illisible** (jamais une liste vide), avec le geste (« regarde-les sur
  ebay.fr, Mon eBay → Retours et annulations ») et les **noms** des champs reçus (`champs`, jamais les
  valeurs) pour apprendre la forme ;
- 401/403 ⇒ raison `scope`, « Reconnecte ton compte eBay (eBay → Compte → Connecter) » + bouton.
Même règle pour les annulations (`cancellation/search`).

## « Évaluations à laisser »
Vérifiée : elle retirait déjà `'principal'` ; `GetItemsAwaitingFeedback` sans tableau ⇒ liste vide.
Couverte par l'audit (E1, E2).

## Preuves
- `scripts/audit-ebay-a-traiter.cjs` (vraie route, faux eBay, registre à la forme mesurée) : 28 contrôles
  verts ; `--avant` (main 5a9abe571) : 17 rouges (dont « mal désigné », « action inconnue », retours vides
  illisibles) ; `--prouve` : 9/9 mutations rougies.
- `scripts/bancs/ebay-apres-vente-ecran.cjs` étendu : `taches` part sans `compte` pour le principal,
  jamais `agent` ; la tâche lue s'affiche ; refus ⇒ bouton « Reconnecter » dans les deux blocs, qui
  ouvre eBay → Compte ; 390 et 1512 px.

## ÉTAT À LA REPRISE
- Fait et poussé sur `claude/ebay-a-traiter`, PR #1187 **pas fusionnée** : la règle du 16 nov.
  (zéro rouge, y compris ceux qui sont déjà sur main) n'est pas tenue. Sur la PR, la CI montre
  68 audits rouges dans « Audits 1-3 » : ce sont exactement les mêmes que sur la PR #1181 déjà
  fusionnée (70 rouges là-bas, aucun rouge nouveau ici). Les mêmes jobs « Bancs principaux »,
  `regles`, `ecrans (…)` et `comptes-et-reception` sont rouges des deux côtés. Fusionner dès que
  main est revenu au vert (ou sur décision).
- Banc `ebay-apres-vente-ecran` (absent des lots de la CI) : il était périmé sur main, car les
  sous-onglets ont changé. Il ouvre maintenant les sections par `?tab=plat_ebay&section=…`. Tous
  les contrôles du lot passent à 390 et 1512 px. À 1512 px, il reste 3 rouges instables : la
  feuille de confirmation n'apparaît pas toujours (`askConfirm` sans écouteur monté ⇒ repli sur
  `window.confirm`, que Playwright ferme). Ces rouges sont hors du lot et restent à regarder.
- **Ce qui manque (mesure réelle)** : la vraie réponse de `return/search` sur le compte de Julien n'a
  jamais été vue. Si « illisible » revient, la réponse de la route porte maintenant `champs` (noms
  des champs reçus) : les relever dans l'onglet réseau (ou un `console.log` de banc) et ajouter la
  forme à `retoursEbay`. Geste de Julien : aucun (rouvrir eBay → À traiter).
