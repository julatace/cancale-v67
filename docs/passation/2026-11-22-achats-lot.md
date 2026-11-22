# 22 nov. · Achats en lot : diviser un achat, répartir son prix (lot achats-lot)

Branche `claude/achats-lot` (depuis `origin/main` 63a04526). Poussée à chaque commit. Pas de PR, pas de fusion.
Aucune écriture en base réelle, aucune donnée réelle dans le dépôt. L'extension n'est PAS touchée.

Julien : « quand je fais un achat en lot, l'app comprend que c'est un lot, divise l'achat et propose de répartir le prix ;
pareil pour un achat simple qui n'est pas appelé lot, je veux qu'on puisse le diviser ; fais ça bien ».

## Mesuré sur la vraie base (lecture seule, nombres seulement, 22 nov.)

- Transactions captées `harvest_{uid}_txn_{tx}` : **43 côté acheteur** (`user_side = buyer`) sur ~1 450 ; parmi elles
  **2 à plusieurs articles** (`items_count` 2 et 8, `order.items[]` de même longueur). Chaque article porte `id`
  (identifiant d'annonce), `title`, `price` (objet `{ amount, currency_code }`, EUR), `photos[]`, `size_title`, `status`.
  Le prix payé n'est PAS la somme des prix affichés (offre groupée : 379 € affichés pour le lot de 8, 26 € pour 21,70 €
  payés sur celui de 2) ⇒ les prix affichés servent de POIDS (prorata), jamais de montant.
- Listes d'achats (`_orders_purchased` + `_orders_bought`, 3 580 lignes) : clés `title, price, status, date, photo,
  transaction_id…` — **aucun nombre d'articles**. **115 titres commencent par « Lot »** (105 avec un nombre :
  « Lot 3 articles »). Le titre n'est donc qu'une suggestion (une annonce seule peut s'appeler « Lot de 2 paires »).
- Achats Leboncoin / eBay / Vestiaire (`achat_email_*`) : **0 ligne** ⇒ aucune forme multi-articles à lire ; rien de
  spécifique fait pour eux (un achat d'un autre site se divise à la main s'il apparaît dans la liste).

## La règle (une seule : `src/achatDivise.js`, pure)

| point | règle |
|---|---|
| détection | `lotDeLAchat` : `divise` (sa division) · `prouve` (≥ 2 articles lus dans SA transaction, ou `items_count` ≥ 2) · `peutEtre` (titre « Lot … », nombre lu s'il est écrit) · `simple`. Le titre n'AFFIRME jamais. |
| identité d'une part | `achat:{tx}#k` ; elle partage celles de l'achat (n° de transaction, suivi, code de retrait, reçu). |
| total | `totalADiviser` : le reçu de CET achat s'il tombe juste (articles + port + protection, ventilés) ; sinon le prix de la commande, DIT (« reçu pas lu : port et frais pas comptés ») ; remboursement partiel lu (`_rembPartiel`, src/coutAchatNet.js) déduit ; remboursé / autre devise ⇒ rien. |
| répartition | `repartirParts` : parts égales · prix affichés des articles (si TOUS lus) · prix de vente (si toutes les parts en ont un LU) · à la main (reste en direct, bloqué ≠ 0). Le centime : plus grand reste (`repartirPrixLot` de src/venteLot.js, la même règle), les parts qui ont reçu un centime d'arrondi DITES. Une paire choisie qui a déjà SON prix est « fixée » (le reste se répartit sur les autres). Port et frais : au prorata (défaut) ou à parts égales (réglage, quand le reçu les ventile). |
| plan | `planDivision` (SON toucher : `confirme`) : morceaux de la corbeille — une paire déjà numérotée reçoit `buyFromId`, `buyPart`, `buyFrom` (+ `buyPrice` seulement si vide) ; une part neuve = une fiche « À publier » (`vrm_fiches_neuves`, `origine: 'achat-divise'`, `partId`) + son coût `vinted_buyprice_by_num[N°]` ; `vrm_lots_declares[tx] = n` ; la division dans `vrm_achats_divises[tx]` (parts, morceaux, historique). Refus : deux parts sous un N°, paire reliée à un AUTRE achat, N° déjà servi, déjà divisé, lecture ratée, somme fausse, saisie ignorée. |
| changer | `planNouvelleRepartition` : de nouveaux montants (un prix retouché depuis est gardé). |
| regrouper | `peutRegrouper` : une part vendue ⇒ non (N° dit) ; ventes pas lues ⇒ non (pas su ≠ non). `planRegroupement` : l'inverse exact de ce qui est posé (un champ retouché depuis est gardé), la déclaration rendue, la division close et gardée dans l'historique ; **les N° restent au pool** (ils ont pu être écrits sur des cartons). |

## Les chiffres : une règle, jamais deux fois

- « Dépensé » (Argent, Achats, registre) lit la COMMANDE, une ligne (`coutAchatNet`) : la division n'y change rien.
- Le coût d'une vente lit SA part (`prixAchatDe` : la fiche, sinon le coût par N°) : la somme des parts = le total.
- L'achat divisé est déclaré lot ⇒ `prixAPoser` (src/prixAchatRecu.js) ne pose plus jamais le reçu ENTIER sur une part.
- URSSAF lit les recettes (ventes), pas les achats : rien ne change. Bénéfice, stats et Argent suivent par le coût des N°.
- Un remboursement partiel ARRIVÉ APRÈS la division ne se répartit pas tout seul (on ne sait pas quelle paire) : la
  feuille de l'achat divisé le dit en ambre (« Le total payé a changé : regroupe puis divise à nouveau ») — son geste.

## Écrans

- **Achats (téléphone)** : sur la rangée, une étiquette qui se touche (« Lot · 3 », « Lot ? », « 3 parts ») ouvre la
  feuille en UN toucher ; « ⋯ » → « Diviser en 3 » / « Diviser cet achat » / « Voir la division » (aussi dans la fiche
  de l'achat, `DansFiche`).
- **Achats (ordinateur, tableau)** : « Lot de 3 articles » / « Divisé en 3 · N°… » sous le titre ; « Diviser… » dans le
  menu de la ligne.
- **La feuille** (`src/natif/ecrans/DiviserAchat.jsx`, `src/natif/lot-achat.css`) : l'achat · « En combien de parts »
  (− N +, 2 à 20) · les articles (photo et titre de l'article du lot, sinon « Article k » à nommer ; N° neuf proposé à la
  suite ou « Paire déjà numérotée » choisie dans SES paires sans achat) · « Répartir le prix » (segmenté) · total payé et
  sa phrase · reste en direct · avant / après · UN plein « Diviser en N ». Divisé : les parts, « Changer la
  répartition », l'historique, « Regrouper » (deux touchers, ou la raison du refus).
- **Relier** : un achat divisé est complet (`liensAvecDivisions`) : il n'est plus proposé.
- **Saisie en série des prix** : les parts ont leur prix ⇒ elles n'y apparaissent pas.
- Textes : `src/i18n/langues/{fr,en,es,it,de}/lotAchat.js` ; Quoi de neuf : `achats-lot-diviser`.

## Preuves

(voir la fin de ce fichier : résultats mis à jour au dernier commit)

## Pas fait (dit)

- L'extension n'est pas touchée : seuls 43 détails de transaction d'achat sont captés ; un lot dont le détail n'est pas lu
  reste « peut-être » (titre) ou se divise à la main. Lire plus de détails d'achat = un lot de l'extension (5.438.0 réservé).
- « Prix de vente » ne lit que Vinted (annonce en ligne, vente) ; une part vendue sur eBay / Leboncoin n'empêche pas
  « Regrouper » si son N° n'est pas sur une vente Vinted (le coût redevient « pas su », jamais faux).
- Une vente sans N° ne se relie pas directement à une part : la part se relie par son N° (fiche) — c'est l'identité.
