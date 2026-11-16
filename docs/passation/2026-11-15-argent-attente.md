# 15 nov. 2026 — L'argent à venir, mieux affiché (étapes, sites, comptes, dates sûres)

Julien : « je veux que les stats des montants en attente soient mieux affichées ». Vu en prod :
Ventes à l'ordinateur « À venir · 43 ventes · détail par compte · 2 591,33 € › ». Précision
de Julien en cours de lot : « il ne peut pas y avoir de montant inconnu » — chaque vente porte
son prix ; un trou est un défaut de LECTURE à corriger, pas une case à montrer.

Branche `claude/argent-attente` (partie de `claude/project-review-nsk5su`), pas de PR.

## 1. Mesuré d'abord

### Les endroits qui montraient de l'argent « en attente / à venir » (avant)

| où | ce qui était dit | la règle |
|---|---|---|
| Ventes · Tous et Ventes · Vinted | carte « À venir · N ventes · détail par compte · total », détail par compte replié | `argentAVenir` (src/argentAVenir.js, la coque, `liveStats.aVenir`) |
| Résumé Vinted (`VintedResume`) | case « À venir » | la part Vinted de la même règle (`aVenirPour`) |
| Carte des chiffres, case `attente` | « Argent à venir » (si choisie dans « Modifier ») | la même règle |
| Widget iPhone | `enAttente` | la même règle, seulement complète, arrondie |
| Ma journée, carte « À venir / À virer » et tendance « À venir » | — | la même règle, **mais plus rendues** (`JOURNEE_AVEC_WIDGETS = false` depuis le 2 nov.) : Ma journée ne disait plus l'argent à venir nulle part |
| Feuille « Trésorerie » | « En attente (porte-monnaie Vinted) » = la somme des `escrow`/`pending_balance` lus si > 0, SINON la règle | **deux sources pour une notion** — mais plus aucun bouton ne l'ouvre depuis le 13 nov. (`openTreasury` sans appelant) : incohérence morte, laissée telle quelle |
| Argent → Porte-monnaie (Compta) | « disponible · en attente » compte par compte | le solde LU chez Vinted (`porteMonnaieParCompte`) : une autre notion (le solde bloqué de Vinted, parfois plus ancien que les ventes, qui ne dit pas QUELLE vente) — désormais dite à côté de chaque compte dans l'écran, jamais additionnée |
| « Retirer mon argent » / « À virer » | `walletDispo` | déjà versé : une autre notion |

Une seule règle calculait l'argent à venir (depuis le 4 nov.) ; ce qui manquait : les étapes,
les dates sûres, la couverture dite proprement, et un endroit où tout voir.

### En base de production (lecture seule, SELECT de scalaires, 15 nov.)

- Vinted : 3 564 ventes lues dans les `orders_sold`, **0 sans prix**, **0 dans une autre devise**
  (le prix est l'objet `{amount, currency_code}` ; c'est le prix de l'article = ce que le vendeur
  reçoit, aucun frais de vente côté vendeur). ⇒ aucun « montant inconnu » réel : rien à corriger
  dans la lecture.
- Vinted en cours (liste ni finalisée ni annulée) : ~50 ventes ; leurs transactions : 230 (payée)
  pour presque toutes, 450 pour 3 (la liste en retard : déjà écartées par la règle). Par statut de la
  liste : ~6 à envoyer, ~29 en route (expédiée, déposée au relais, centre de vérification), ~11
  livrées en attente de confirmation. Aucune 430/440 parmi elles aujourd'hui.
- Vinted n'écrit **aucune date de versement prévue** : ni la transaction (`status`, `shipment.status`
  seulement), ni la liste. ⇒ « — Vinted n'écrit pas la date du versement ».
- Vestiaire : 2 ventes en cours, `montant` clé `sellerEarning` en EUR (sûr), une avec « paiement
  estimé » écrit en toutes lettres ; `etapesVc` présent sur l'une (frise du vendeur), absent sur
  l'autre. ⚠️ Une vente porte `aExpedier: true` ET `sellerShipment: done` : l'étape suit la frise
  de Vestiaire (le parcours, `src/parcoursVestiaire.js`), « à expédier » seulement à défaut.
- Leboncoin : 3 ventes prouvées (`isSeller`), toutes finalisées (`parcelColor: finished`) : rien à venir.
- eBay : `ebay_orders` vide.

## 2. La règle (src/argentAVenir.js) — étendue, pas dupliquée

Chaque vente à venir a **une** étape (`ETAPES_A_VENIR`) :
`envoyer` · `route` (relais et contrôle Vestiaire compris) · `livree` (attente de la confirmation de
l'acheteur) · `versement` (eBay retient, Vestiaire paie) · `autre` (le site ne dit pas l'étape,
jamais devinée). **Total = somme des étapes = somme des sites**, au centime.

- Vinted : l'étape vient de l'étiquette de la vente (`etapeVente`, la règle de Ventes et de la
  recherche) traduite par `etapeVintedAVenir` (App.jsx) — jamais une seconde lecture du statut.
  Transaction 430 (suspendue) ou 440 (retour) ⇒ **bloquée / litige, à part, hors total** (avant :
  écartée sans un mot). 450, 220, ≥ 500 ⇒ pas à venir (inchangé).
- Vestiaire : l'étape vient du parcours (`parcoursVenteVc`, passé par `R.parcoursVc`) ; refus au
  contrôle ⇒ bloquée ; date = « paiement estimé » lu.
- Leboncoin : `parcelStatus` (livré ⇒ livrée ; autre mot ⇒ en route ; rien ⇒ autre).
- eBay : montant = la retenue lue, sinon `montantRecuEbay` (dû − frais), sinon — frais pas encore
  lus — le dû au vendeur, ligne marquée `estime: 'fraisEbay'` (« frais eBay à déduire » : un montant
  CONNU, sa précision dite) ; non expédiée ⇒ à envoyer, sinon versement en cours ; date =
  `expectedReleaseDate`.
- Autre devise (Vinted, eBay, Vestiaire) ⇒ `nonComptees` sorte `devise`, écartée et dite, jamais
  convertie. Prix illisible ⇒ sorte `illisible` (défaut de lecture, nommé, jamais 0 €).
- `friseAVenir(A, maintenant)` : cette semaine · la suivante · plus tard (dates ÉCRITES seulement) ·
  sans date ; leur somme = le total.
- Nouveaux champs du résultat : `parEtape`, `parSite`, `bloquees`, `estimes`, et `titre`/`etape`
  sur chaque ligne. Les champs d'avant ne changent pas (carte des chiffres, widget, résumé Vinted).

## 3. L'affichage

- **L'écran « Argent à venir »** (src/ArgentAVenirEcran.jsx, une feuille montée par la coque,
  ouverte par l'événement `vrm:argent-a-venir`) : le total et sa couverture (« au moins » + le
  manque nommé, la devise écartée, les commandes eBay avant frais) ; les **deux autres sommes**
  nommées à part, jamais additionnées — porte-monnaie Vinted (déjà versé) et reçu du mois (daté au
  versement, la case `recu` de la carte des chiffres) ; **par étape** (barre de proportions, encre
  pleine → claire, aucune couleur ; la date « versement vers le … » seulement si chaque vente de
  l'étape a la sienne, sinon « — » + la raison) ; la ligne « Bloquée ou en litige » hors total ;
  **quand ça arrive** (seulement s'il y a des dates écrites) ; **par site** (sa marque,
  `Marque.jsx`) puis **par compte** (repliable ; à côté d'un compte Vinted, ce que son porte-monnaie
  dit « en attente », lu il y a N j — un recoupement, jamais un total). Chaque ligne déplie SES
  ventes (titre, compte, montant, date). Le même nombre n'est jamais écrit deux fois (un seul site,
  une seule étape, un seul compte : la ligne se tait sur le montant).
- **Le résumé compact** (`ArgentAVenirCarte`, refait) : « À venir · total », les sites, les étapes
  en une ligne (« 2 à envoyer · 2 en route · 2 livrées · 1 en litige, hors total »), le manque ;
  toute la carte se touche et ouvre l'écran. Sur **Ventes** (Tous, Vinted), **Ma journée** (sous la
  grille) et **Argent** (sous les quatre réponses). Les `data-a-venir*` d'avant restent (bancs,
  instantané de Ventes).
- Jetons et classes du studio seulement (`--sb-*`), aucun fond codé en dur : la couche « Verre
  dépoli » s'y appliquera. Textes : `avenir.*` (src/i18n/langues/{fr,en,es,it,de}/avenir.js).
  « Quoi de neuf » : `argent-a-venir-etapes`.

## 4. Preuves

- `scripts/audit-argent-a-venir.cjs` : section 7 (étapes, total = somme des étapes et des sites,
  bloquées hors total, illisible nommé, devises écartées, eBay avant frais, compte écarté, frise),
  et le branchement (étapes par les règles propriétaires, l'écran n'additionne rien, la coque
  monte l'écran). Mutations rouges : `tx450` `versement` `holds` `vcverse` `zero` `site` `libere`
  `etape-double` `bloquee-total` `inconnu-zero` `devise` `estime` `frise`.
- `scripts/bancs/argent-a-venir.cjs` (données inventées, vraie forme ; 390 tactile et 1512, clair et
  sombre) : résumé de Ventes, écran (étapes, ventes dépliées, bloquée, frise, sites, comptes, deux
  autres sommes jamais additionnées, total écrit une fois), Ma journée et Argent ouvrent le même
  écran, compte écarté, débordement et cibles 44 px.
- Passe du 15 nov. : `audit-argent-a-venir` 71 verts (sur l'arbre d'avant : 18 rouges, la règle
  d'avant comptait la vente Vestiaire refusée et laissait de côté les commandes eBay à retenue sans
  montant) ; banc `argent-a-venir` 91 verts sur 4 tailles × thèmes (sur le build d'avant : 7 rouges) ;
  verts aussi : `traduction`, `quoi-de-neuf`, `tdz`, `variables`, `studio`, `urssaf`, `identite`,
  `carte-chiffres`, `chiffres`, `une-regle`, `journee-coherence`, `vente-email-fraiche`, `coherence`,
  `composants`, `icones` ; bancs `argent` (268 verts), `studio-journee`, `colis-ventes-instantanes`. `ventes-e2` : V1 (« À
  venir », un montant une fois) vert ; ses 7 rouges V2/V5/G (l'état de chaque vente de « Tous » vide,
  un titre long) sont **les mêmes sur le build d'avant** (vérifié : arbre de
  `claude/project-review-nsk5su` construit et passé) — un défaut de la liste studio, pas de ce lot.

## 5. Ce qui reste / gestes de Julien

- Aucun geste. Regarder l'écran sur l'iPhone (Ventes → toucher « À venir »).
- Vinted n'écrit pas de date de versement : si un jour une réponse Vinted en porte une (lue par
  l'extension), elle entre dans `prevu` et la frise s'en sert ; rien n'est estimé d'ici là.
- La feuille « Trésorerie » (inaccessible) garde son ancien « en attente » à deux sources : à retirer
  si personne ne la rouvre.
