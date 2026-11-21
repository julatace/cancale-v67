# Règle d'offre eBay : ce que dit sa vraie base (9 octobre 2026)

Mesures faites en lecture seule, avec des SELECT projetés, sur le projet
`lgonxzrzjcqthjtbdpzo`, owner `74eea6e7-…`. Aucun jeton n'a été lu (seulement
les noms de clés et la présence de `refresh_token`). Aucun appel à eBay.
Rien n'a été écrit.

## 1. Les lignes `ebay*` en base (tous vendeurs confondus)

**4 lignes en tout, toutes chez Julien** (1 seul owner porte des lignes eBay).

| id | octets | capturedAt (Paris) | clés de premier niveau |
|---|---|---|---|
| `ebay_tokens` | — | `saved_at` = 06/10/2026 15:54:04 | `refresh_expires_days` (548), `refresh_token` (présent), `saved_at` |
| `ebay_listings` | 4 455 | 08/10/2026 19:20:29 | `ack` (Success), `capturedAt`, `items`, `status` (200) |
| `ebay_orders` | 58 | 08/10/2026 19:20:29 | `capturedAt`, `orders` (**0**), `status` (200) |
| `ebay_inventory` | 57 | 08/10/2026 19:20:29 | `capturedAt`, `items` (**0**), `status` (200) |

**Lignes ABSENTES** :
- `ebay_comptes` : le registre multi-comptes du worktree n'a jamais été écrit ;
- `ebay_tokens_{clé}` : aucun second compte ;
- `ebay_programmees` et `ebay_brouillons` ;
- `ebay_retraits_auto` ;
- toutes les autres lignes `ebay_*_{clé}`.

⇒ **Un seul compte eBay est relié** : le principal, la ligne `ebay_tokens` sans
suffixe. Son pseudo et son identité eBay (EIASToken via `GetUser`) ne sont
**jamais** passés en base. Le worktree lira ce registre absent comme
`{comptes: [], absent: true}`, c'est-à-dire le principal seul.

⚠️ **Pourquoi `ebay_programmees` manque, et pourquoi `ebay_listings` n'a pas de
clé `complet`.** La dernière synchro date du 08/10 à 19:20. Le code qui écrit
ces deux choses (c900286, « brouillons et planificateur ») n'est arrivé en
production qu'avec la PR #470, le 09/10 à 00:30. La synchro a donc tourné sur
l'ancien code. La prochaine synchro (« ↻ Rafraîchir depuis eBay ») écrira
`ebay_programmees` et `complet`.

## 2. Ses annonces eBay

| | actives | programmées | brouillons |
|---|---|---|---|
| compte principal (le seul) | **2** | **pas su** : ligne jamais écrite, aucune n'a donc jamais été lue | **0** : ligne absente, l'écran les lit comme « aucun » |

Détail des 2 annonces actives (`ebay_listings.items`) :

| itemId | titre | price | qty | sku | observateurs | vues | vendus | depuis | catégorie | état |
|---|---|---|---|---|---|---|---|---|---|---|
| 128086452103 | Nike Air Max 1 Aquatone Bleu Taille 44 | `"68.0"` | 1 | `""` | 1 | "1" | "" | 2026-09-18T20:24:04Z | 15709 (Homme : chaussures : Baskets) | Occasion - Parfait état |
| 128101592740 | Nike Air Max 1 Homme blanc bleu EU 44 (US 10/UK 9) FQ8048-133 | `"74.0"` | 1 | `""` | null | "" | "" | 2026-09-27T15:17:43Z | 15709 | Occasion - Très bon état |

Ce qui ressort de ce tableau :

- **Prix** : une chaîne (`"68.0"`), pas un nombre ni un objet.
- **Devise : AUCUN champ de devise n'est rangé.** `extraireItem` lit
  `g('CurrentPrice')`, dont la regex jette l'attribut `currencyID`. Ce qui donne
  une indication :
  - l'URL pointe vers `www.ebay.fr` ;
  - `AddItem` de VRM publie en `<Currency>EUR</Currency>`.

  L'euro est donc très probable, mais **il n'est écrit nulle part dans la
  ligne**.
- **SKU : 0 sur 2 relié à une paire.** Les deux SKU valent `""`. Ces annonces
  ont été créées sur le site eBay, pas par VRM (sinon elles porteraient
  `VRM-{n°}`).
- **Photos** : `detail.photos` en porte 12 et 13.

### Les clés d'un objet annonce (noms seulement)

- **Niveau annonce** : `depuis`, `detail`, `itemId`, `observateurs`, `photo`,
  `price`, `qty`, `sku`, `title`, `url`, `vendus`, `vues`. Le code du worktree
  écrit aussi `fin`, absente de la ligne parce qu'elle a été rangée par
  l'ancien code.
- **`detail`** : `categoryId`, `categoryName`, `condition`, `description`,
  `photos`, `specifics` (caractéristiques eBay : Marque, Modèle, Pointure EU,
  Couleur, Style, Type, Département…).

### Champ d'offre (BestOffer…)

**AUCUN, nulle part.** La recherche a parcouru récursivement toutes les clés de
`ebay_listings`, `ebay_orders` et `ebay_inventory` : aucune ne contient
« offer », « offre » ni « best ».

Le code ne connaît pas non plus cette notion. `grep BestOffer|bestOffer|AutoAccept`
sur `api/`, `src/` et `vinted-sync-extension/` du worktree ne renvoie **0
occurrence**. Concrètement :

- `extraireItem` (GetMyeBaySelling) ne lit ni `BestOfferDetails` ni
  `ListingDetails` ;
- le détail (`GetItem` en `DetailLevel ReturnAll`) les reçoit sans doute
  d'eBay, mais ne les garde pas ;
- `AddItem` et `ReviseFixedPriceItem` n'envoient aucun `<BestOfferDetails>`.

⇒ **On ne sait PAS** si l'offre est activée sur ces 2 annonces, ni si un seuil
d'acceptation ou de refus y est déjà posé à la main.

Deux autres points ne sont **pas mesurés** :

- si la catégorie 15709 autorise l'offre et l'acceptation automatique (c'est
  `GetCategoryFeatures` qui le dit : `BestOfferEnabled`,
  `BestOfferAutoAcceptEnabled`, `BestOfferAutoDeclineEnabled`) ;
- son compte n'a **jamais reçu d'offre captée** : `ebay_orders` est vide, et
  aucune ligne ne porte d'offre.

## 3. Prix d'achat des paires reliées

- **Annonces eBay reliées : 0.** Aucun N° ne peut donc être suivi jusqu'à
  `vinted_annonce_numeros`, et le prix d'achat est **inconnu pour 2 annonces
  sur 2**.
- Je n'ai **pas** cherché la paire au titre (§5 l'interdit). Le seul chemin
  est que Julien les relie lui-même (« Relier à une paire »).
- Les chiffres de `main.vinted_annonce_numeros` (projetés, agrégés) :
  - **401 fiches**, toutes avec un `numero` en chiffres ;
  - **8 seulement portent un `buyPrice`** : une chaîne, strictement positive
    dans les 8 cas, avec `buyFrom` et `buyFromId` ;
  - `mp` est présent sur 4 fiches, toutes `{lbc:false}` : **aucune paire n'a
    jamais été cochée pour eBay** ;
  - aucune clé `minPrice` dans ces fiches.
  - Clés d'une fiche : `photoK`, `price`, `photo`, `auto`, `size`,
    `accountId`, `numberedAt`, `title`, `numero` (401 chacune), `repriseAt`
    (17), `buyPrice`, `buyFromId`, `buyFrom` (8), `mp` (4).
- ⇒ Une règle comme « jamais un seuil d'acceptation sous le prix d'achat » ne
  pourrait s'appuyer aujourd'hui sur **aucune** annonce eBay. Même une fois les
  annonces reliées, il n'y aurait un prix d'achat que pour environ 2 % des
  paires (8 sur 401). Le seuil doit donc pouvoir exister **sans** prix d'achat
  connu. Ce n'est pas à VRM de le deviner (§2.5).

## 4. Réglages

| clé (ligne `main`) | valeur |
|---|---|
| `vrm_ebay_retrait_auto` | **ABSENTE** (jamais touchée) : l'app la lit avec son défaut `false`, donc **éteint** |
| `vrm_ebay_rythme` | absente |
| `vinted_offres_auto` | `false` (Vinted, retiré le 5 octobre, à ne pas toucher) |
| `vinted_offers_done` | présente (offres Vinted rangées « c'est fait ») |
| clés `main` contenant ebay / offre / offer / plancher / min_price | seulement `vinted_offers_done` et `vinted_offres_auto` |

La ligne `panel_min_prices` (planchers **Vinted** de l'ancien panneau) existe
aussi, avec 5 clés. ⚠️ Elle est sans effet depuis le 5 octobre (§3) : **ne pas
la réutiliser** comme règle eBay.

## 5. Ce que ça implique pour la règle « au-dessus, eBay accepte »

1. **Il n'y a aujourd'hui que 2 annonces**, sur un seul compte, sans SKU, sans
   prix d'achat connu, et sans aucune information d'offre captée.
2. Pour afficher « offre activée · accepte à X € · refuse sous Y € », il faut
   d'abord **capter** ces informations. `GetItem` → `ListingDetails`
   (`BestOfferAutoAcceptPrice`, `MinimumBestOfferPrice`) et
   `BestOfferDetails.BestOfferEnabled` pourraient le faire. Sans cette capture,
   l'écran ne peut pas distinguer « pas de seuil » de « pas su ».
3. La devise n'est pas rangée. Un seuil en euros posé sur une annonce dont la
   devise n'est pas lue suppose l'euro. Il faut ranger `currencyID` avant de
   comparer quoi que ce soit.
4. La règle ne peut pas exiger un prix d'achat : 0 annonce reliée, et 8 paires
   sur 401 seulement en ont un.
