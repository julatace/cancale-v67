# 23 nov. · Détail des achats en lot + Vestiaire lu une fois (lot lots-vestiaire, extension 5.443.0)

Branche `claude/lots-vestiaire` (worktree `/home/user/wt/lots-vc`, depuis `origin/main` b5fc00bd4, extension servie 5.439.0).
Version réservée **5.443.0** (après 5.440/5.441 favoris-auto et 5.442 train d'intégration). Aucune écriture en base réelle,
aucune donnée réelle dans le dépôt.

## ÉTAT À LA REPRISE

- Code, audits et récit poussés sur la branche (dernier commit d39416e8b). **PR #1311 ouverte, PAS fusionnée** : l'ordre des
  versions impose d'attendre 5.440/5.441 (`claude/favoris-auto`, PR #1308 ouverte) et 5.442 (train d'intégration) ; puis gel
  des fusions du 23 nov. 15:00 UTC au 24 nov. 07:00 UTC (démo) et machine réservée jusqu'à 15:30 UTC.
- Pour fusionner : `git merge origin/main` (vrai merge) ; si 5.440-5.442 sont servies, garder 5.443.0 ; sinon prendre la
  plus haute servie + 1 (CODE_VERSION, manifeste, lbc-inject/lbc-relay, extension-version.json, Orion txt, EXT_ATTENDUE,
  EXT_CAPACITES `achatsdetail`/`vcunefois`, §8) ; `node scripts/zip-extension.cjs` ; CLAUDE.md < 60 000 ; build +
  passe d'audits (31 rouges le 23 nov., tous rouges aussi sur l'arbre de main) ; CI comparée job par job à main
  (CI du 23 nov. : seul rouge nouveau `audit-ext-arrets-formulaire`, test dépendant de l'ordre aléatoire des champs,
  porté sur la règle ; `ecrans (achats-sourcing)` rouge aussi sur main 1c33848cb) ; fusion ; Vercel success.
- Gestes de Julien : installer 5.443.0 ; laisser vinted.fr ouvert sur ses comptes acheteurs (les « Lot… » passent en
  premier, 8 par heure au plus) ; sur Vestiaire, ouvrir une fois la page de la commande EN LITIGE (voir §3).

## 1. Achats en lot : le détail de la transaction d'achat

### Mesuré (base de prod, lecture seule, projections scalaires, 23 nov.)

| quoi | nombre |
|---|---|
| achats dans les listes (`harvest_*_orders_purchased` + `_orders_bought`, dédoublonnés) | **3 479** |
| … avec leur transaction rangée (`harvest_{uid}_txn_{tx}`) | **144** (dont 43 côté acheteur) |
| … sans transaction | **3 335** |
| titres qui commencent par « Lot » | **112** |
| … sans transaction (⇒ « Lot ? ») | **107** |
| le plus gros compte acheteur | 2 026 achats, 45 « Lot », **0** transaction |

Forme des 43 transactions côté acheteur déjà rangées (noms de clés seulement) : `transaction.{id, user_side, items_count,
order{id, items[], item_count, item_ids…}}` ; un article : `id, title, price{amount,currency_code}, photos[]{url,
full_size_url, thumbnails…}, size_title, status, catalog_id, url`. `items_count` vu : 0, 1, 2, 8. Aucune forme neuve devinée.

### Ce qui change (extension, `capterDetailsAchats`, background.js)

- Lecture GET `/api/v2/transactions/{tx}` de SES achats sans transaction rangée, exactement la mécanique des dates de
  versement : compte de l'onglet (`gardeLecture`), une requête à la fois (`vintedGet`), pause aléatoire 2–5 s, 429/403 ⇒
  pause posée et série arrêtée (`memoApresEchec`), prudence ⇒ rien, un essai raté pas refait avant 24 h, un passage à la fois.
- Budget de LECTURE partagé (20/h, tous Chrome), nouvelle classe `achat` au même étage que la relecture : SOUS la réserve
  des codes de retrait, preuves, versements, relevés et suivis (« pas su » ⇒ réserve entière) ; au plus **6 par passage**
  et **8 par heure**. Les photos lui laissent sa place (`lecteursAvantPhotos.achat`, seulement ce qu'il a noté).
- Ordre : les « Lot… » d'abord (le plus récent d'abord), puis les autres sans détail (le plus récent d'abord).
- Rangé seulement si la réponse est CETTE transaction (`id` = le n°) vue CÔTÉ ACHETEUR ; sinon rien (diag noté).
- Appelé à la visite (après l'argent et les colis) et au passage de fond (`tickVersements`, onglet vinted.fr ouvert).
- L'app est prévenue (`maj · achatsdetails`) : Achats relit les transactions (`detailsAchatsRelus`) ⇒ « Lot · N » prouvé
  (règle existante `lotDeLAchat`, src/achatDivise.js) et la feuille « Diviser » montre les articles du lot. Le partage
  reste son toucher.
- Rythme : 107 « Lot » ≈ 14 h de vinted.fr ouvert sur le compte (8/h) ; les 3 335 autres bien plus (c'est voulu : jamais la
  place de l'argent ni des colis).
- Pas fait : `capterSuivisAchats` lit déjà la transaction d'un achat payé pas encore expédié et ne la range pas — la ranger
  au passage serait gratuit (aucune requête de plus) ; laissé pour ne pas changer ce lecteur sans banc (à faire).

### Preuves

- `node scripts/audit-achats-details.cjs` : **19 ✅ · 0 ❌** ; sur la 5.439 de main (`--src`) : **14 ❌** ;
  `--mutations` : **7/7** rougissent (titre ignoré, sans plafond horaire, côté ignoré, identité ignorée, réserve ignorée,
  garde ignorée, déjà détaillé relu).

### Ajout du 23 nov. (mesure de l'agent scan-achat) : TOUS les achats, en cours d'abord

- Mesuré (lecture seule) : 114 achats des 30 derniers jours, **0** avec leur transaction ; **59 achats en cours** (ni
  finalisés, ni annulés, ni remboursés), **59 sans transaction**. La dernière transaction côté acheteur rangée date du
  **4 nov.** ; côté vendeur elles continuent chaque jour (lues par l'extension elle-même : versements, preuves).
- Pourquoi « arrêtée » : il n'y a jamais eu de lecteur des transactions d'ACHAT. Les 43 venaient de la capture PASSIVE
  (`/api/v2/transactions/{id}` que la page charge quand il ouvre un achat sur vinted.fr) — quelques-unes par semaine, plus
  aucune depuis le 4 nov. (il n'en a plus ouvert, ou la page d'achat de Vinted ne charge plus ce chemin : pas su sans sa
  navigation). Et `capterSuivisAchats` lisait DÉJÀ la transaction d'un achat payé pas encore expédié… sans la ranger.
- Changé : l'ordre de `capterDetailsAchats` = achats EN COURS d'abord (à recevoir, à retirer), puis « Lot… », puis le
  reste, le plus récent d'abord ; et la transaction lue par le suivi est rangée au passage (`rangerTransactionAchat`, même
  identité : ce n°, côté acheteur — aucune requête de plus). Le n° de suivi, le point relais, le code de retrait restent
  ceux des lecteurs existants (suivi des achats expédiés, codes) ; le détail apporte vendeur, articles, état, taille, prix.
- Preuves : `audit-achats-details` 20/20, `--mutations` 9/9 (dont « en cours ignorés », « suivi sans ranger ») ; voisins
  suivi-vinted 133, suivi-colis-ext 14, suivi-numero-achats 18, suivi-multi-transporteurs 16, relais-dest 28,
  budget-lectures 20, avis-vinted : verts.

## 2. Vestiaire « relit ses ~1 000 annonces 5 à 6 fois »

### D'où vient ce chiffre — et les vrais chiffres

Le constat vient du banc de volume du 16 nov. (`volume-lbc-vestiaire.cjs`, **1 000 annonces INVENTÉES**,
`2026-11-16-bancs-rouges-b.md`) : la projection `items` de `vc_listings` relue 5 à 6 fois à l'ouverture par une dizaine de
lecteurs de l'APP. Ce n'est pas le compte de Julien. Mesuré en base (lecture seule, 23 nov.) :

- `vc_listings` : **3 annonces** (une ligne, 1 Ko), toutes lues sur `users/me/product-listings` (le chemin « me » = SES
  annonces ; l'extension ne range aucune autre liste Vestiaire — catalogue, favoris, recommandations ne vont jamais dans
  `vc_listings`), état `published`, dernière lecture le **2 nov.**, compte de l'onglet pas su à l'époque (`compte: ''`).
  Aucune annonce d'un autre vendeur, aucun doublon. Julien dit en avoir 5 ou 6 : la liste n'a pas été relue depuis le
  2 nov. (geste : ouvrir « Mes articles » sur Vestiaire avec la 5.443).
- `vc_catalogue` (408 Ko) : les marques et catégories de dépôt (pour publier), pas des annonces.
- `vc_ventes` : **3 ventes** — `72989201` **CANCELLED** (rangée « Annulée » par `src/ventesAnnulees.js`, jamais dans le CA
  ni le bénéfice) ; `72987282` IN_PROGRESS, `deliveryInProgress`, frise `sellerConformity: upcoming`,
  `sellerPayment: upcoming` ; `73402461` IN_PROGRESS sans frise. Aucune n'est versée ⇒ aucune dans « reçu » ni dans le CA
  déclaré (seules `versee`/`terminee` y entrent), elles sont « à venir ».

### La vente EN LITIGE (Julien : « Vestiaire examine le problème »)

**Pas su.** Aucune forme de litige Vestiaire n'a jamais été vue : ni dans `vc_ventes` (aucun mot litige/claim/dispute), ni
dans la mesure du site `vc_recon` (5.377, 20 nov. : seuls `orders/current-light` et `ots/orders` vus). Laquelle des deux
ventes « en cours » est le litige : pas su (rien ne l'identifie) — rien n'est deviné. La mesure passive existe déjà :
vc-inject relève chemins et noms de clés de toute réponse que la page charge (`vc_recon`, jamais une valeur). **Geste :**
ouvrir une fois, extension à jour, la page de la commande en litige sur Vestiaire ; la forme arrivera dans `vc_recon`,
et un état « En litige · Vestiaire examine » (hors reçu et CA, montant « en attente ») pourra être rangé sur SON mot.
Aujourd'hui elle est déjà hors du reçu et du CA (pas versée).

### Ce qui change

1. **App** (`src/lecturesPartagees.js`, `projectionCommune`) : toute lecture `id=eq.vc_listings` dont chaque champ est un
   des chemins connus (`items, liens, capturedAt, complet, total, formeInconnue, compteurs, lectures`) part sous UNE
   projection commune, partagée ; chacun reçoit SES noms, mêmes valeurs. Autre filtre ou chemin inconnu ⇒ comme avant.
   Échecs, écritures, signaux de l'extension : les règles du partage, inchangées.
2. **Extension** (`rangerVcAnnonces`) : chaque réponse « Mes articles » relisait toute la ligne (`select=data`), la
   réécrivait et réveillait l'app. Les réponses d'une visite sont mises en file et rangées ENSEMBLE (une lecture, chaque
   réponse appliquée dans l'ordre — la règle page par page d'avant, `appliquerPatchVc` —, une écriture, un réveil) ; la
   file part à la liste entière (`complet`), sur un lien de publication, après 2,5 s de calme, au plus tard 15 s ; elle
   vit aussi dans chrome.storage.local (§4.9, reprise au réveil). Lecture ratée ⇒ rien écrit, la page apprend « pas rangé ».

### Preuves

- `node scripts/audit-vc-annonces-une-fois.cjs` (vrai vc-inject + vrai relais + vrai fond, 1 000 annonces inventées en 5
  pages + compteurs) : **après : 1 lecture complète · 1 écriture · 1 réveil** ; **avant (5.439 de main, `--src`) : 6 · 6 · 6**
  (11/14, 3 ❌). Liste entière, compteurs, partielle après complète (rien retiré), lecture ratée (rien écrit), page seule
  rangée, lien immédiat : verts. `--prouve` : **4/4** mutations rougissent.
- `node scripts/audit-lectures-partagees.cjs --prouve` : partie 14 (7 projections ⇒ 1 lecture, mêmes valeurs, autre
  filtre/chemin/session à part, échec reste échec) verte ; mutations `commune-off`, `commune-noms-faux` rougissent. La
  mutation `fond-partout` (motif périmé depuis le 22 nov. sur main : « motif introuvable ») portée sur la règle actuelle.
- Voisins : coherence, vc-moderation, capture-vc-lbc, fiabilite-annonces, lbc-vc-lecture verts (suite dans la PR).

## 3. Porte-monnaie Vinted dans « Ma journée » (demande ajoutée le 23 nov.) — DÉJÀ CAPTÉ, rien à ajouter à l'extension

Mesuré (lecture seule) : **14 comptes** ont une ligne `harvest_{uid}_billing` (la plus fraîche le 23 nov. au matin), rangée
par l'extension au passage (porte-monnaie et `/payouts` que la page charge — aucune requête de plus). Deux formes, les deux
avec montant + devise :

| forme | disponible | EN ATTENTE | autres |
|---|---|---|---|
| solde (5 comptes) | `data.payload.main` `{amount, currency_code}` | `data.payload.escrow` `{amount, currency_code}` | — |
| versement (9 comptes) | `data.payload.balance` `{amount, currency_code}` | `data.payload.pending_balance` `{amount, currency_code}` | `previous_balance`, `history`, `invoice_lines`… |

Date de lecture : `data.capturedAt`. Une ligne dédiée `harvest_{uid}_portemonnaie` serait un doublon : non créée.
Lecteur de l'app (une seule règle, déjà utilisée par Argent) : `fetchWalletEscrow(uidsVivants)` (src/App.jsx) →
`{ total` (EN ATTENTE, euros), `dispo` (disponible), `accounts`, `avecSolde` (Set d'uid lus), `parCompte: [{ uid, attente,
dispo, jours }]`, `plusVieuxJours`, `autreDevise` (uid hors euros, jamais convertis) `}` ; `null`/`accounts: 0` = pas su.
À afficher dans Ma journée par l'agent design (avec l'âge de la lecture : `jours`).
