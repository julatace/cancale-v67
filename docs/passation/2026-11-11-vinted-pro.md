# 11 nov. 2026 — Lot `vinted-pro` : reconnaître les comptes Vinted Pro et compter juste pour eux

Branche `claude/vinted-pro` (depuis `origin/main` f04d4a58), poussée à chaque commit. Pas de PR.
**Rien dans `vinted-sync-extension/`** (aucun champ ne manquait : profil, transactions et relevé sont
déjà rangés par l'extension) ⇒ aucune version réservée. 12 fonctions `api/` inchangées.

## La demande (validée par Julien)
Reconnaître les comptes Vinted Pro et calculer juste pour eux : (1) Pro seulement si LU, jamais deviné,
« pas su » dit ; (2) frais Pro lus dans transactions/relevés, sinon « — » + raison, jamais un taux
inventé (barème public cité, « à vérifier ») ; (3) argent reçu et CA déclaré corrects pour un Pro ;
(4) un compte Pro relève de la facture Pro ; (5) pastille « Pro » dans Paramètres → Mes comptes + une phrase.

## Mesuré (lecture seule, formes et sommes, rien recopié dans le dépôt)
| quoi | mesure |
|---|---|
| profils `harvest_*_profile` | 19 lignes : **2 comptes `business: true`** (avec `business_account` objet), 14 `false`, 3 sans le champ (pas su) |
| e-mails `email_sale_*` `pro:true` | 21, chacun avec `uid` |
| transactions de vente des 2 comptes Pro | 77, **la même forme** que les 1 287 des comptes particuliers ; aucun champ de frais vendeur |
| `service_fee` | = 5 % du prix + 0,70 € (77/77 Pro) ; `total_amount_without_tax` = `offer.price` + `service_fee` (77/77) ⇒ protection acheteurs, payée par l'acheteur |
| relevés `harvest_*_releve_*` | **0** (aucun relevé rangé à ce jour) |
| liste des ventes (`my_orders.price`) vs `offer.price` | particuliers : égaux **468/468** ; **Pro : différents 56/77** (+0,47 € à +1,25 €, ventes de mai à septembre ; égaux depuis le 10 oct.) |
| barème public | vinted.fr injoignable depuis la session (réseau) ; sources web contradictoires (0 % ou 5 % de commission vendeur) ⇒ **cité, jamais utilisé** |

## Ce qui est fait
1. **`src/vintedPro.js`** (pur, la règle unique) :
   - `statutProVinted({ profil, emailsPro })` : profil lu fait foi (true ⇒ Pro, false ⇒ particulier) ; sinon
     un e-mail où Vinted écrit « membre Vinted Pro » pour CE compte ⇒ Pro (source e-mail) ; rien ⇒ « pas su ».
   - `argentVentePro(txn, ligneReleve)` / `resumeArgentPro` : CA = prix de l'article ; protection acheteurs
     seulement si Vinted l'ajoute au prix ; **commission et argent reçu seulement par la ligne du relevé de
     CETTE transaction** (`tx`, jamais un montant qui ressemble ; deux lignes au même n° ⇒ aucune choisie) ;
     sinon `null`. Autre devise ⇒ écartée. `BAREME_VINTED_PRO` cite vinted.fr/pricelist et /pro-guide, `aVerifier`.
   - `prixVentePro` / `appliquerPrixPro` : sur un compte Pro, prix de la liste ≠ prix de l'article ⇒ le relevé
     tranche (crédit = liste ⇒ compté ; crédit = article ⇒ prix de l'article, `_prixListe` gardé) ; pas de relevé
     ou transaction pas lue ⇒ `_prixPro.compter = false` + raison nommée.
2. **CA déclaré** (`ventesDeclarables`, App.jsx, miroir serveur refabriqué par `audit-bilan-semaine --recopie`) :
   une vente Pro au prix contredit, datée, est **mise à part et NOMMÉE** (« au moins », comme eBay) ; **une vente
   déjà déclarée garde son mois** (on ne retire rien d'une déclaration faite). Particuliers : rien ne change.
   `_prixPro` est posé dans `fetchVintedOrders` (ventes, harvest) par `appliquerPrixProCompte` : profil lu,
   puis — compte Pro seulement — scalaires des transactions (`SELECT_TXN_PRO`) et lignes de SON relevé, 60 s de cache.
   Profil pas lu ⇒ rien ne change (pas su ≠ Pro).
3. **Paramètres → Mes comptes** (`Reglages.jsx`, `src/VintedProCompte.jsx`) : la pastille « Pro » / « Particulier »
   vient de `statutProVinted` (profil ou e-mail) ; une phrase : « Compte Pro, lu sur ton profil Vinted : ses
   ventes ont la facture Pro. » (ou « lu dans un e-mail ») ; « Pro ou particulier : — · profil pas encore lu.
   Ouvre Vinted sur ce compte. » ; repli « L'argent de tes ventes Pro » lu À L'OUVERTURE : prix des articles
   (sur N), protection acheteurs (payée par tes acheteurs), commission Vinted (« — » : pas écrite dans tes
   ventes, le relevé la dira), argent reçu (relevé), lien vers le barème public « à vérifier ». Textes par `tr()`
   (fr, en, es, it, de).
4. **Facture Pro** (`FacturePro.jsx`) : `comptesPro` = profil + e-mails Pro là où le profil n'est pas lu
   (`comptesProFacture`, jamais un « false » écrasé) ; « Sur quels comptes ? » dit « Vinted : N comptes Pro, lus
   sur Vinted ». `comptesFacture` reste pour Leboncoin / eBay / Vestiaire (aucune ne dit « pro »).
5. « Quoi de neuf » : `vinted-pro-comptes`.

## Tranché sans demander (dans l'esprit de la demande)
- **CA = prix de l'article, brut** : en micro, une recette se déclare brute ; une commission est une dépense.
  La protection acheteurs n'est jamais dedans.
- Les 56 ventes Pro à deux prix (mai-sept.) : prix **pas su** tant que le relevé ne tranche pas (et seulement si
  elles ne sont pas déjà déclarées). Effet : le CA déclaré de ces mois dit « au moins » et les nomme. Le geste :
  ouvrir le porte-monnaie Vinted sur le compte Pro (l'extension range le relevé).
- TVA d'un Pro au régime réel (CA HT) : lot `tva-marge` (agent principal) — pas touché ici.

## Preuves
| contrôle | résultat |
|---|---|
| `scripts/audit-vinted-pro.cjs` (S statut, F frais, P prix, D le VRAI miroir serveur, B branchements) | **29 verts** |
| … `--prouve` (13 mutations : pas su ⇒ particulier, e-mail > profil, false écrasé, taux 5 % inventé, protection sans preuve, doublon de relevé choisi, deux prix comptés, relevé ignoré, particulier touché, CA ignore `_prixPro`, vente déclarée retirée, phrase absente, ventes sans `_prixPro`) | **13/13 rouges** |
| … sur `origin/main` (git archive) | **rouge** : D0 (le CA comptait 81,73 € au lieu de 40,00 €) + module absent |
| `audit-bilan-semaine` (miroir identique) | 54 verts |
| audits variables, tdz, coherence, identite, icones, textes-courts, fonctions-api, secrets, traduction, urssaf, facture-siret, facture-pro, etat-compte, quoi-de-neuf | verts |
| `scripts/bancs/vinted-pro.cjs` (390 clair/sombre, 1512) | voir « ÉTAT À LA REPRISE » |

## ÉTAT À LA REPRISE
Voir la fin de ce fichier (mise à jour à chaque étape).

## Geste de Julien
Sur chaque compte Vinted Pro : ouvrir le **porte-monnaie** Vinted (l'extension range le relevé) — c'est lui qui
dit la commission et tranche les ventes à deux prix.
