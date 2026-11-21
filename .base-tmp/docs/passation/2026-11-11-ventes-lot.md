# 11 nov. · Une vente de plusieurs articles = UNE vente, chaque article à sa place (lot ventes-lot)

Branche `claude/ventes-lot`. Aucune écriture en base réelle, aucune PR ni merge dans `main`.

## Ce qui a été mesuré (lecture du code et des relevés déjà documentés, aucun accès base)

- Une vente Vinted en lot est UNE transaction : `harvest_{uid}_txn_{tx}` → `data.payload.transaction`.
  `order.items[]` = les articles, chacun avec `id` (identifiant d'annonce — « 206 articles sur 206 ont
  `id` », mesuré le 12 sept., commentaire de `fetchLotItems`), `title`, `price` (`{ amount,
  currency_code }`, le prix AFFICHÉ de l'annonce, src/statsOffres.js), `photos[]`, `size_title` ;
  `items_count` = leur nombre. Le `item_id` du haut ne désigne qu'UN article.
- La liste des ventes (`my_orders`) n'a aucun champ de nombre : Vinted titre la commande
  « Lot 3 articles » (mesuré sur 734 achats le 3 nov., src/suggestionsAchat.js).
- Le bordereau capté par l'extension porte déjà tous les `items` (background.js, 5.x) — pas relu ici.
- `meta` (migration 004) ne contient PAS `items_count` : la lecture se fait en projection
  `id=in.(…)&select=id,nb:…->>items_count,items:…->order->items`, seulement pour les ventes au
  titre « Lot … » (jamais `select=data`, §4.4).

## Avant

- Un lot = une vente, mais avec l'identité d'UN article (`item_id`) : un seul N°, le prix d'achat
  d'un seul article ⇒ **bénéfice surestimé** (mesuré au banc par mutation : 20 € d'achat au lieu de
  « pas su »), les autres articles jamais sortis du stock par identité (seul le dressing les fermait),
  tampon avec un seul N°, facture Pro refusée ou à une ligne.
- « Voir le lot » interrogeait Vinted en direct (relais), sans rien garder.

## Ce qui est livré

- **Règle unique `src/venteLot.js`** (pure) : articles d'une transaction, identité (annonce ⇒ photo
  exacte ⇒ SON lien « Relier », jamais le titre ; deux articles du lot sous un même N° ⇒ aucun des
  deux), répartition du prix au centime (prorata des prix affichés, sinon parts égales DITES
  « réparti également, prix par article pas lu »), prix d'achat du lot (celui posé sur la vente,
  sinon la somme SEULEMENT si tous connus, sinon `null`), tampon « 124 · 131 · 140 + 1 sans N° »,
  lignes de facture. Une annonce seule titrée « Lot de 2 paires » n'est PAS un lot (sa transaction le dit).
- **App** : `fetchTransactionsLots` (projection, `null` = pas su), `lotDeVente(o)`,
  `entreeVenteLot(o, e)` (le prix d'achat du LOT) branché dans les totaux de Ventes, la publication
  `vrm_benefice_jours` (qui attend les lots : `if (!lotsTx) return;`) et le relevé `vrm_stats_ventes`.
  Le CA reste celui de la transaction (une vente, datée au versement) : rien n'est dédoublé.
- **Ligne de vente** : une ligne, les N° des articles (pastilles), « + 1 non relié » en ambre ; le
  titre « Lot 3 articles » n'est pas redit ; la taille d'un seul article n'est plus affichée.
- **Récapitulatif** : en-tête avec les N° ; section « Les articles » — chaque article, sa part, son
  achat, son bénéfice ; « Relier » (SON clic, il tape le N° écrit sur l'article ; « Délier »),
  rangé dans `vrm_lot_liens` `{ [tx]: { [item]: N° } }` (synchronisé). « Voir le lot » (direct)
  ne reste que pour un titre « Lot » dont la transaction n'est pas dans la base.
- **Stock** : chaque article prouvé du lot entre dans `annoncesVendues` (sortie du stock, N°
  « vendus partis ») ; un article relié à la main y entre par son N°.
- **Bordereau** : un colis, un bordereau ; le tampon liste les N° ; chaque N° est vérifié un par
  un (`confirmerNumerosAVerifier(opts.numeros)`) ; nom de fichier nettoyé.
- **Statistiques** : `eclaterReleveLots` (src/ceQuiRapporte.js) fait une ligne par article (sa part,
  son achat, sa part des frais, SON annonce) pour les marges et « ce qui part vite » ; les autres
  lecteurs du relevé gardent une ligne par vente.
- **Facture Pro (serveur)** : `emettre` lit la transaction AVANT de numéroter
  (`lignesLotFacture`, base KO ⇒ 503, aucun numéro pris) ; une facture, une ligne par article
  (`lignesDeVente`, src/facturePro/regle.js : somme = prix, sinon la ligne unique d'avant ; HT des
  lignes = HT de la facture). Le serveur ne dit pas le N° (il ne lit pas les fiches).
- **Copie serveur** `api/_lib/vente-lot-regle.js`, refabriquée par
  `node scripts/audit-ventes-lot.cjs --recopie` (jamais à la main ; l'audit exige l'égalité au caractère).
- Le bilan du mois et de la semaine consomment `vrm_benefice_jours` : ils suivent sans changement.

## Preuves

- `npm run build` vert.
- Audits imposés verts : variables, tdz, coherence, identite, icones, textes-courts, fonctions-api,
  secrets, bilan-semaine, urssaf. Voisins rouges **déjà rouges sur origin/main** (pas de ce lot) :
  `achats-export`, `facture-achat`, `preuve-vente`, `vente-verification`.
- `scripts/audit-ventes-lot.cjs` : **38 ✅** ; sur l'arbre d'origin/main : **8 ❌** (rapporte, ne
  plante pas). Mutations : achat partiel sommé ⇒ 2 ❌ · relier par titre ⇒ 3 · publication sans
  attendre ⇒ 2 · tampon d'un seul N° ⇒ 2 · parts sans plus grand reste ⇒ 3 · copie serveur
  retouchée ⇒ 2.
- Banc `scripts/bancs/ventes-lot.cjs` (données inventées, 390 tactile et 1512) : **35 ✅** ; sur le
  build d'origin/main : **14 ❌** ; mutation « le lot reprend l'achat d'un seul article » ⇒ 6 ❌
  (A3, C2, E1 aux deux tailles). Captures regardées (ligne, récapitulatif, « Relier », parts égales).

## Ce qui reste (non fait, dit)

- Leboncoin / Vestiaire : aucune forme multi-articles mesurée ⇒ rien changé. eBay : une commande à
  plusieurs lignes reste refusée pour la facture (« pas encore pris en charge ») et suit sa règle
  par SKU de ligne pour le bénéfice.
- Le widget et les notifications serveur comptent déjà par transaction (un colis) ; ils n'affichent
  pas encore les N° d'un lot.
- `items_count` n'est pas dans `meta` : un lot dont le titre ne commence pas par « Lot » (jamais vu)
  resterait une vente ordinaire, comme avant. Ajouter `items_count` à `vrm_meta` serait une migration
  (geste de Julien).
- Colis / Ma journée impriment par `imprimerBordereauVente` (tampon du lot) ; « Tout imprimer » en
  série passe par son propre chemin et tamponne encore le N° de la vente — à reprendre.

## Geste de Julien

Aucun. Sur une vente « Lot … », ouvrir la vente : les articles et leurs N° sont là ; « Relier »
sur un article que VRM ne sait pas désigner.
