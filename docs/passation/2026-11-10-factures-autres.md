# 10 nov. 2026 — Factures Pro des ventes Leboncoin, eBay et Vestiaire (lot S)

Branche `claude/factures-autres` (depuis `origin/main` ae0e418d, `origin/main` refusionné ensuite, lot Q
compris). Proposition 28 validée par Julien : « Factures Pro aussi pour Leboncoin, eBay et Vestiaire (même
règle de preuve : n° de commande de la plateforme) ». Le lot Q (envoi auto, À envoyer, avoir, registre +
zip) n'est pas touché : ce lot n'apporte que les SOURCES de vente.

## Mesuré sur la vraie base (lecture seule, noms de champs et chiffres seulement)

| source | mesure |
|---|---|
| `lbc_ventes.data.ventes` | **16** transactions, clé = `txId` (9 chiffres) ; `price` en **CENTIMES** (`prices.final` du détail : 750 à 7 500), `prixListe` à part (total acheteur, frais et port : 1 348 vs 750) ; `dateVente` ISO 16/16 ; `stepStatus` done · validation · cancelled (5 annulées) ; `isSeller`, `title`, `account` |
| … l'acheteur | **AUCUN** champ : ni nom, ni adresse, ni e-mail (le `label` = qrUrl, reference, trackingUrl, voucherUrl) |
| `vc_ventes.data.ventes` | **1** vente ; `montant` = `{valeur, devise, cle:'sellerEarning'}` = ce que Vestiaire VERSE, pas le prix payé ; aucun acheteur (seul `id_client` dans la page brute, jamais rangé) |
| `ebay_orders` | **0** commande (lecture complète, `total` 0) : la forme vient de l'API Fulfillment, déjà lue ailleurs dans VRM (`ebay-a-expedier.js`, `ebay-suppression.js`, `ventes-regle.js`) — jamais vue en base |
| e-mails de vente Leboncoin / eBay / Vestiaire | **0** (seulement publicités et alertes de sécurité) |

Conséquence : aucune de ces plateformes ne PROUVE l'acheteur comme l'e-mail Vinted Pro. Une facture à un
particulier exige son nom et son adresse : **le vendeur les recopie** (bordereau, messagerie) — c'est sa
déclaration, rangée comme telle (`acheteurSource: 'saisi'`), jamais inventée par VRM. Sans adresse e-mail
prouvée, **VRM n'envoie pas ces factures** : PDF à joindre au colis ou à partager.

## La règle (`src/facturePro/sources.js`, pure, la même dans l'app et le serveur)

- **Identité** = le n° de la plateforme (Leboncoin : n° de transaction, clé ET `txId` identiques ; eBay :
  `orderId`, une seule commande sur tous les comptes — deux ⇒ rien). Jamais le titre.
- **Leboncoin** : vente prouvée (`isSeller === true`), pas annulée (`lbcAnnulee` recopiée au caractère près,
  vérifiée par l'audit), `price` entier lu (jamais `prixListe`), `dateVente` lue. Sinon la raison.
- **eBay** : payée (`PAID`), pas annulée ni remboursée, UN article en UN exemplaire (sinon « pas encore pris en
  charge »), `lineItemCost` en **euros** (§3 International : GBP/USD refusé, jamais converti) — le prix de
  l'article, sans le port (§2.8). L'acheteur de CETTE commande (`buyerRegistrationAddress`, sinon `shipTo`)
  est seulement **proposé** dans les champs ; son clic l'émet.
- **Vestiaire** : refus dit — « Vestiaire ne donne pas le prix payé par l'acheteur (seulement ce qu'il te
  verse) ». Une facture au montant versé serait fausse. Pour l'ouvrir : l'extension devrait ranger
  `sellerPrice`/`productPrice` (vus dans la page, `vc_ventes.forme`) — chantier d'extension, pas fait ici.

## Ce qui a changé

- **Serveur** `api/_lib/facture-autres.js`, servi par `/api/compte?mode=facture-autre` (aucune fonction
  `api/` de plus) : `emettre` relit la vente LUI-MÊME (projection `data->ventes`, `cs` sur `data->orders`),
  refait la règle, exige l'acheteur recopié et la fiche complète, puis prend le numéro par
  **`prendreNumero` de `facture-pro.js` sur `vrm_invoice_counter`** (clé `lbc{n°}`/`ebay{n°}`) : **la même
  suite continue que Vinted**, journal compris (écriture ratée ⇒ le clic suivant garde le même n°).
  Lecture ratée ⇒ 503, rien numéroté. Ligne `email_invoice_lbc{n°}` / `email_invoice_ebay{n°}`,
  `type: 'facture_pro'` : le **registre du lot Q** (Argent → Factures, zip, trous) la lit sans changement.
- **App** `src/FactureAutres.jsx` : dans le **détail** d'une vente Leboncoin (`CarteLbc`, prop `suite` ajoutée
  à `LigneVente`) et d'une commande eBay (`Ebay.jsx`) : vendeur Pro (SIRET valide dans « Ma facture ») ⇒
  « Faire la facture » → feuille (acheteur, désignation, prix et date lus, aperçu exact, « Émettre » confirmé)
  ; refus ⇒ la raison ; émise ⇒ « Facture FA-… » (PDF, Partager). Vestiaire : UNE phrase sous la liste des
  ventes (§7), au vendeur Pro seulement. Le navigateur n'envoie jamais ni prix ni date.

## Preuves

| contrôle | résultat |
|---|---|
| `scripts/audit-factures-autres.cjs` | **41 verts** (règle par plateforme, route, suite partagée, 50 ventes identiques, registre du lot Q sans faux trou, aucun SMTP) |
| … sur `origin/main` d'avant (git archive) | **rouge** (modules absents) |
| … 13 mutations (prixListe, côté pas su, devise, plusieurs articles, prix du navigateur, lecture ratée = absente, clé seule, deux commandes eBay, numéro rebrûlé, adresse incomplète, Vestiaire au versé, annulation affaiblie, journal ignoré) | **13/13 rouges** |
| `scripts/bancs/factures-autres.cjs` (390 tactile et 1512, clair et sombre + vendeur sans SIRET) | voir le rapport final ; captures regardées |
| `audit-facture-pro` 95 · `audit-factures-pro-2` 48 · variables · tdz · coherence · identite · icones · fonctions-api · `npm run build` | verts |

## Reste

- Vestiaire : faire ranger le prix payé par l'extension (version à réserver), puis ouvrir la règle.
- eBay : forme jamais vue en base — à revérifier sur la première vraie commande.
- Avoir d'une facture Leboncoin/eBay (le lot Q fait l'avoir Vinted par n° de transaction) ; colonne
  « Transaction Vinted » du CSV vide pour ces pièces (la référence est dans le PDF).

## Geste de Julien

Aucun (SIRET dans « Ma facture » pour voir le bouton).
