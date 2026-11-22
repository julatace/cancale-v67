# 22 nov. 2026 — Ventes annulées comptées sur chaque site · Vestiaire « en attente de validation » (branche `claude/annulees-vc-validation`)

Julien : « les ventes annulées pour chaque plateforme doivent être comptabilisées » ; « sur Vestiaire Collective, voir
quand une annonce est en attente de validation ». Extension **5.439.0** (capacité `vcmoderation`), zip PAS régénéré
(l'intégrateur le fait).

## 0. Ce qui a été mesuré d'abord (base de production, lecture seule, nombres et noms de clés seulement)

| site | ce que la base dit d'une vente annulée | mesure du 22 nov. |
|---|---|---|
| Vinted | `harvest_{uid}_orders_sold.payload.my_orders[].status` (le mot) + `transaction_user_status` | 3 548 ventes lues, 331 « pas une vente » : 328 « Remboursement effectué » (`failed`), 2 « Commande non réclamée - Retournée à l'expéditeur », 1 « Retour initié ». **Vinted ne dit jamais QUI a annulé** dans cette liste. |
| Leboncoin | `lbc_ventes.ventes{}.stepStatus = 'cancelled'` | 5 annulées — **aucune ne porte `isSeller`** : on ne sait pas si ce sont des ventes ou des achats. |
| Vestiaire | `vc_ventes.ventes{}.etat = 'CANCELLED'` | 1 sur 3. Pas de motif. |
| eBay | `ebay_orders.orders[].cancelStatus.cancelState`, `orderPaymentStatus` | **0 commande rangée** : la forme de l'annulation n'a pas pu être mesurée ; le code lit celle de l'API Fulfillment (`cancelStatus.cancelRequests[].cancelInitiator / cancelReason / cancelCompletedDate`). |

Vestiaire, la modération d'une annonce :
- `users/me/product-listings` rend des enveloppes `{ type, [type]: { product… } }` ; l'extension range ce `type` dans
  `vc_listings.items[id].statut`. **Les 3 annonces de Julien disent `published` : le mot d'une annonce en attente n'a
  jamais été vu** (il n'en avait aucune ce jour-là).
- `users/me/products/count` (relevé dans `vc_recon`, pas encore capté) rend six nombres : `productOnSale`,
  `productWaitingPicture`, `productWaitingValidation`, `productSold`, `productRefused`, `productUnreceived`. C'est le
  vrai compteur de modération de Vestiaire — et il donne son vocabulaire (waiting validation / waiting picture / refused).

## 1. Ventes annulées — `src/ventesAnnulees.js` (UN propriétaire)

- `ventesAnnulees({ vinted, ko, lbc, ebay, vestiaire, R, ecarteVinted, excluAutre })` → `{ lignes, faites, couverture }`.
  « Annulée » n'est PAS redéfinie : chaque site garde SA règle, celle qui sort déjà la vente du Vendu, du Reçu et de
  l'URSSAF (`classifyOrderStatus` ⇔ `PAS_UNE_VENTE`, `lbcAnnulee` + vendeur PROUVÉ, `etatCommandeEbay`, `vcVenteAnnulee`),
  passées par `R`. Le module ajoute : l'identité `site:n°` (jamais un titre), le **motif** quand le site le dit
  (`acheteur`, `vendeur`, `non-payee`, `expiree`, `refusee`, `suspendue`, `remboursee`, `retour`, `non-reclamee`, `litige`,
  sinon `passu`), le montant annulé (`null` si pas lu ou autre devise), la date d'annulation quand elle est lue (eBay).
- **Retours à part** (`sorte: 'retour'` : retour, non réclamée, litige) : comptés à côté, hors du taux et du montant annulé.
- `bilanAnnulees(A, { de, a })` : par site, par compte, par mois — `taux = annulées / (faites + annulées)`.
  Site pas lu ⇒ tous ses nombres `null` et il est NOMMÉ (`manquantes`) ; Leboncoin « annulée sans rôle lu » et eBay
  « annulation demandée, pas tranchée » sont dites à part, jamais dans le taux.
- `annuleesDansArgent(A, lignes)` : garde-fou (aucune ligne du Vendu / Reçu ne porte l'identité d'une annulée).

Où ça se voit :
- **Statistiques → Annulations** (`AnnulationsEtNotes`, src/ecrans/Stats.jsx) : une ligne par compte de CHAQUE site (logo),
  `annulées/ventes · taux`, la liste dépliée avec le motif ; « Montant annulé : (au moins) X € » ; « Retours remboursés :
  N · à part » ; « Par mois » (quand la période couvre plusieurs mois) ; le pied nomme ce qui manque. La note « Leboncoin,
  eBay, Vestiaire : pas comptés » est retirée.
- **Ventes → Terminées** (`VentesToutes`, src/App.jsx) : les annulées Leboncoin (vendeur prouvé) étaient CACHÉES, elles sont
  là. Téléphone : la liste d'abord, puis UN groupe replié « Annulées · N » (logo du site, motif sous le titre).
  Ordinateur : le tableau garde son statut « Annulée » (compteur), Leboncoin compris.
- **Remettre en ligne** : déjà en place pour Vinted (src/annuleesChezToi.js : vente annulée AVANT l'envoi, prouvée par la
  transaction ; carte « à remettre en vente » publiée dans « À régler » ; Ventes · Vinted → « Annulées » → « Remettre en
  vente »). Rien n'est ajouté sur Aujourd'hui : depuis le 19 nov. (« ça doit être rangé dans les onglets dédiés ») les
  choses à faire ne sont plus posées sur cet écran, elles sont publiées dans « À régler » de leur onglet — c'est le cas.

## 2. Vestiaire : la modération — `api/_lib/vestiaire-regle.js` (UN propriétaire)

- `VC_ANNONCE_ETATS` : deux familles de plus, `refusee` (« Refusée par Vestiaire ») et `corriger` (« À corriger » : photos
  attendues, correction demandée), devant `attente`. « Refusée » n'est plus « retirée » : la paire est toujours chez lui.
- `moderationVc(it)`, `VC_MODERATION`, `vcModerationGeste` (l'ambre SEULEMENT pour « à corriger »), `compteursVc(lst,
  compte)` (les six nombres ; `inconnues` = ce que Vestiaire compte sans qu'une annonce lue le porte : « laquelle : pas
  su »), `transitionModerationVc(avant, après)` (validée · refusée · à corriger — jamais déduit d'une disparition).
- Une annonce en attente / à corriger / refusée est **présente, pas en ligne** : `annoncesVcEnLigne` n'accepte que
  `en-ligne` (inchangé, maintenant contrôlé par `audit-vc-moderation` R3).

Extension 5.439.0 :
- `vc-inject.js:noteArticlesCompte` lit `users/me/products/count` **au passage** (c'est la page qui fait la requête : aucune
  requête de VRM, rien dans le budget de lecture) ; relais `vc.js` (`vccompteurs`) ; fond : `vcCompteurs` →
  `vc_listings.compteurs[compte]`, sous le compte de l'ONGLET seulement.
- `rangerVcAnnoncesMaintenant` note sur l'annonce ce que Vestiaire a tranché entre deux lectures :
  `items[id].moderation = { vers, at, de }` (bloc `<vc-moderation-regle>`, le même que l'app — audit E1).
- `annoncerModerationVc` : la notification du navigateur est écrite MAIS **ne s'affiche pas** : le manifeste n'a pas la
  permission `notifications` (l'ajouter fait redemander l'accord à chaque navigateur : décision de Julien).

App :
- Écran Vestiaire (src/ecrans/Vestiaire.jsx) : l'état de modération sur la rangée (dans la langue), ambre + « Corriger sur
  Vestiaire » pour « à corriger », « Validée / Refusée par Vestiaire il y a … » (7 jours), et en tête
  `CompteursModerationVc` (« Chez Vestiaire · 2 en attente de validation · 1 refusée · lu il y a 1 h »).
- Fiche → « Sur les sites » : l'annonce Vestiaire de CE N° en attente / à corriger / refusée a sa rangée (src/App.jsx,
  src/ficheSites.js `RANG`, src/FichePaire.jsx `etatSite`), hors des totaux « en ligne ».

## 3. Preuves

- `node scripts/audit-ventes-annulees.cjs` : 29 contrôles (les vraies règles de chaque site, les vrais `ventesFaites` /
  `ventesDeclarables` du miroir serveur, 50 annulées au même titre, « pas su » ≠ 0, câblage) ; `--mutation=` role-lbc ·
  passu-zero · retour-taux · titre-identite · motif-devine · demandee-annulee · devise · exclu · argent-lbc · argent-vc ·
  argent-vinted : toutes rouges.
- `node scripts/audit-vc-moderation.cjs` : 29 contrôles (règle + vraie page + vrai relais + vrai fond) ; `--prouve` :
  11 mutations, 11 rouges.
- Bancs : `scripts/bancs/annulations-notes.cjs` (étendu aux 4 sites) et `scripts/bancs/annulees-vc-validation.cjs`
  (Ventes → Annulées, Vestiaire → modération ; 390 et 1512).

## 4. Pas fait / à savoir

- **Jamais vu sur un vrai compte** : le mot d'une annonce Vestiaire en attente (`type` de son enveloppe), ni si « Mes
  articles » liste les annonces en attente dans la même réponse. Si la forme diffère, l'annonce tombe en « État Vestiaire :
  « mot » » (jamais devinée) et les compteurs, eux, restent justes. Geste : ouvrir « Mes articles » sur Vestiaire avec une
  annonce en attente, extension 5.439 installée, puis relire `vc_listings.forme` / `formeInconnue`.
- **eBay** : aucune commande en base, la forme du motif d'annulation n'est pas mesurée.
- **Notification** : pas de push sur le téléphone ni d'entrée dans la cloche (le journal `push_journal` n'accepte que
  vente / offre / message : lot serveur à part) ; la notification du navigateur attend la permission `notifications`.
- **Panneau de l'extension et « Mes comptes »** : l'état de modération n'y est pas encore affiché.
- `comptesQuiAnnulent` (alerte « un compte annule plus que les autres », src/ventesEcran.js) lit toujours
  `annulationsParCompte` (Vinted, retours compris) : pas touché.
- Le motif n'est pas écrit dans le tableau de l'ordinateur (le statut « Annulée » y est) ; il l'est au téléphone et dans
  Statistiques.
