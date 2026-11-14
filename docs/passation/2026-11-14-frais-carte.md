# 14 novembre 2026 — Frais de l'année (123) et carte de tes ventes (124)

Branche `claude/frais-carte`. Deux propositions choisies par Julien :
- **123** « Ce que chaque plateforme t'a coûté dans l'année en frais : Vinted, eBay, Vestiaire, Leboncoin » ;
- **124** « Carte de tes ventes : où partent tes paires » — « tu peux même faire du monde ».

Les deux blocs sont dans **Argent** (écran Statistiques), juste sous « Ce que te coûte chaque site ».

## 1. La mesure de la vraie base (lecture seule, 14 nov.)

Requêtes projetées (`select=` scalaire, `jsonb_object_keys`, comptes `count(*)`), jamais `select=data` sur
une ligne lourde. **Chiffres seulement, aucune donnée personnelle.**

### Ce qui porte des frais

| source | champ | mesuré |
|---|---|---|
| eBay | `ebay_orders.orders[].totalMarketplaceFee` | **0 commande** rangée (la ligne existe, vide) |
| Vinted — commission vendeur | — | aucune (l'acheteur paie la protection, `service_fee` est la sienne ; règle du bénéfice inchangée) |
| Vinted — boosts / vitrine payés | relevé du porte-monnaie `harvest_*_billing` → `payload.invoice_lines` | **1 seule ligne lue en tout**, et c'est un virement vers la banque ; **aucune ligne de boost ni de vitrine** n'est rangée |
| Vinted / Leboncoin — frais notés sur une fiche | `vinted_sale_overrides` / `vinted_annonce_numeros` : `fees`, `commission`, `transportVendeur`, `autresFrais`, `emballage` | **0** fiche sur ~1 140 (overrides) et ~1 090 (fiches par N°) — rien noté |
| packs et options notés dans Dépenses | `main.vrm_compta.packs` | **0** pack, 0 abonnement |
| Vestiaire — commission | `vc_ventes.ventes[].prixVente` (prix) − `montant` (versé), règle `fraisVc` | **1 vente** rangée, **sans** le prix affiché ⇒ commission pas lue |
| Leboncoin — options payantes | — | rien de rangé (16 ventes, le prix capté est ce que le vendeur touche) |

⇒ Aujourd'hui, sur SA base, la carte « Frais de l'année » dira surtout « — » avec la raison : c'est la vérité.
Elle se remplit dès que des commandes eBay sont relues, que l'extension range le prix Vestiaire (5.364+),
ou qu'il note un boost (fiche) ou un pack (Dépenses).

### Ce qui donne le lieu d'une vente

| source | champ | mesuré |
|---|---|---|
| Vinted | détail de transaction `harvest_*_txn_*` → `transaction.buyer.country_code` (pays du **profil** de l'acheteur) | **1 373 / 1 374** détails côté vendeur le portent (10 pays : FR, IT, NL, DE, ES, IE, BE, PT, AT, LU) |
| Vinted | ville, code postal, point relais de destination d'une VENTE | **absents** : ni la transaction (`shipment` = id, statut), ni la liste des ventes, ni le suivi ne les portent ; seul le PDF du bordereau a l'adresse de l'acheteur — **jamais lu pour ça** |
| Vinted | couverture sur les ventes : listes `orders_sold` = **3 535** transactions distinctes ; avec un pays lu : **522** (15 %) — 2026 : 481 / 1 979 ; 2025 : 25 / 1 301 ; avant 2025 : 16 / 255 |
| eBay | `fulfillmentStartInstructions[0].shippingStep.shipTo.contactAddress.{city, postalCode, countryCode}` | 0 commande rangée (règle prête) |
| Leboncoin | `lbc_ventes` (16 ventes) | aucun lieu |
| Vestiaire | `vc_ventes` (1 vente) | aucun lieu |
| devise | `my_orders[].price.currency_code` | **EUR** partout (3 562 lignes) ; `order.currency` EUR ou absent |

⇒ La carte de Julien montrera aujourd'hui **un point par pays** (Vinted), la France sans ville, et
« N ventes sans lieu » pour le reste (détail de transaction pas encore lu). La vue France passe en villes
dès qu'il y a des ventes eBay.

**Ce qui manque côté extension (non fait ici, `vinted-sync-extension/` interdit à ce lot)** :
1. lire le détail de transaction de **toutes** les ventes (aujourd'hui 15 % l'ont) — c'est la même lecture que
   « Ce qui se vend » ; sans elle, pas de pays ;
2. les **boosts et vitrines payés** : la page du porte-monnaie (`wallet/invoices/current`) n'a été rangée
   qu'avec sa première ligne ; lire ses pages suivantes (`invoice_lines_has_more`) et l'historique mensuel
   rangerait les « Remontée » / « Dressing en vitrine » — la règle les compterait alors en frais LUS ;
3. le prix affiché des ventes Vestiaire (extension 5.364+, déjà écrit : l'installer).

## 2. Frais de l'année (123)

- Règle : `fraisAnnee` dans `src/fraisPlateformes.js` — **aucune règle neuve** : c'est `fraisParPlateforme`
  (la carte « Frais par site » et le tableau mois par mois) sur les bornes de l'année choisie. Même relevé de
  Ventes, mêmes commandes eBay, mêmes Dépenses, mêmes comptes sélectionnés ⇒ **le même chiffre partout**.
  `fraisParPlateforme` gagne deux compteurs (rien ne change à ses sorties d'avant) : la part « boost » notée
  sur la fiche ([11] du relevé, déjà comptée dans le total) et les commandes eBay **dans une autre devise**
  (`autreDevise`, `devises`) — écartées comme avant, désormais **dites**.
- États : `complet` · `auMoins` (couverture à côté : « frais connus sur 350 des 390 ventes ») · `inconnu`
  (« — » et la raison, jamais 0) · `passu` (source pas lue, ou année plus ancienne que le relevé de Ventes,
  qui part du 1er janvier de l'année d'avant sa publication).
- Vinted et Leboncoin : pas de commission au vendeur ; boosts, vitrine et options **pas lus chez le site** ⇒
  au mieux « au moins » (ce qui est noté), sinon « — ». §2.8 : le port eBay n'est ni recette ni charge.
- Écran : `src/FraisPlateformes.jsx` — titre de section hors de la carte, LE chiffre en grand
  (« au moins 5 731 € », couverture en une ligne), une rangée par site, l'explication repliée
  (« Comment c'est calculé »). Rien de connu ⇒ une ligne, pas de carte pour « — ».

## 3. Carte de tes ventes (124)

- Règle : `lieuxVentes` dans `src/lieuxVentes.js`, repères dans `src/lieuxTables.js`.
  Population = les ventes FAITES (`liveStats.venduLignes`, `ventesFaites` : comptes sélectionnés, ventes
  prouvées). Lieu par **identité** seulement (transaction ⇒ pays, commande ⇒ ville). Agrégat par pays ; en
  France par ville placée, sinon par département (préfecture, bulle en pointillés). Une vente française sans
  ville (Vinted) compte dans « France » au monde, et à part en vue France. Pays absent de la table ⇒
  « hors carte ». Sortie : N° (relevé de Ventes, par identité), date, montant, plateforme — **jamais** nom,
  pseudo, adresse, compte ni n° de transaction (l'audit le vérifie).
- Écran : `src/CarteVentes.jsx` — vues Monde / France, période (12 mois, année, année d'avant, tout),
  plateforme ; toucher une bulle ou une rangée ⇒ le lieu, le nombre, le montant, la liste (30 puis « Voir
  100 de plus ») ; « N ventes sans lieu » dit, raisons dans le repli.
- Fond : OpenFreeMap + MapLibre (`src/fondCarte.js`, celui des points relais), chargé quand la carte entre à
  l'écran, bulles posées AVANT le fond, fond clair comme les autres cartes. **Aucun géocodage par vente** :
  une recherche par VILLE (nom + code postal, jamais une rue) à la Base Adresse Nationale, en vue France
  seulement, une à la fois, 40 au plus par ouverture, gardée dans le navigateur (`vrm_geo_villes_v1`) ;
  Nominatim jamais appelé. CSP inchangée.

## 4. Preuves

- `node scripts/audit-frais-carte.cjs` : **31 verts** ; `--prouve` : **12/12 mutations tuées** ; rouge sur
  `origin/main` (règles absentes).
- `scripts/bancs/frais-carte.cjs` : 2 000 ventes INVENTÉES (1 600 Vinted, 400 eBay dont 10 en livres et ~30
  sans frais lus), 390 tactile et 1512, clair et sombre — voir le résultat au §5.
- Verts : build, `audit-traduction`, `audit-tdz`, `audit-coherence`, `audit-variables`, `audit-csp`,
  `audit-fonctions-api`, `audit-quoi-de-neuf`, `audit-urssaf`, `audit-frais-plateformes`, `audit-cout-vente`.

## 5. Résultat du banc

`scripts/bancs/frais-carte.cjs` (23 contrôles × 4 passes : 390 tactile et 1512, clair et sombre) :
- **branche** : 92 / 92 verts (passe complète avant le merge) ; après le merge de `origin/main`, 87 / 92 sur
  une machine saturée (charge 60–80, d'autres sessions y construisaient en même temps) : en 390 sombre, le fond
  OpenFreeMap n'est pas arrivé dans ses 12 s (la carte tombe alors en liste, comme prévu : « la liste reste
  juste ») et « Tout » a pris 1 078 ms à 1512 ; ces deux passes relancées seules : voir le rapport final ;
- **mutant** (`{s.frais == null ? '—' : …}` ⇒ `eur(s.frais || 0)`) : **rouge** (2 contrôles : Leboncoin
  écrit « 0 € ») ;
- **`origin/main`** : **rouge** (ni « Frais de l'année » ni « Carte de tes ventes »).

Vitesse (chronométrée DANS la page, du clic à la dernière bulle posée) : « Tout » = 1 959 ventes agrégées et
reposées en 233–535 ms. L'agrégat seul : 6 ms pour 2 000 ventes (audit). Un défaut trouvé et corrigé par le
banc : lire la largeur de la carte après chaque bulle posée forçait une mise en page de tout l'écran Argent
par bulle (2,2 s pour 11 bulles) — les bulles sont désormais mises à jour sur place, la largeur lue une fois.
Captures regardées (390/1512, clair/sombre : frais, monde, France, détail) — aucune donnée réelle.

Le banc sert aussi la famille `harvest_*_txn_*` **avec `Range`** (pages de 1 000, total) : le harnais
commun rendait tout d'un coup, et `lireTout` y voyait une page pleine sans fin (« pays pas su »).

## Geste de Julien

Aucun pour voir la carte. Pour des frais et des lieux plus complets : installer l'extension à jour, ouvrir
Ventes une fois, noter ses boosts / packs dans Dépenses.
