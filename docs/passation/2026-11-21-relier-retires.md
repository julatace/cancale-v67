# 21 nov. 2026 — Relier : seulement ce qui est chez lui · colis non retirés · remboursé hors dépenses

Branche `claude/relier-retires` (partie de `claude/relier-code`, + `claude/integration-21nov`, `claude/journee-stats` déjà dedans).
Aucun fichier de `vinted-sync-extension/`. Aucune écriture en base (mesures en lecture seule, projections et comptes).

## Ce que Julien a dit (21 nov.)
1. « Quand je veux relier, ça me propose des paires que je n'ai pas retirées. »
2. Des statistiques des colis qu'il n'est pas allé chercher.
3. « Ne compte pas dans les dépenses quand je suis remboursé. »

## Mesure sur sa base (lecture seule, nombres seulement)
- Achats Vinted lus (n° distincts) : **3 350** — 2 520 finalisés · 771 remboursés / annulés · 19 « Commande livrée ! » ·
  **21 en route** · **11 au point relais** (« colis déposé en bureau de Poste ou point relais ») · **8 payés / bordereau envoyé**.
  23 reliés à une fiche.
- **40 achats libres pas chez lui** (21 + 11 + 8, aucun relié) étaient PROPOSABLES : la règle pondérée
  (`src/liaisonAchat.js:306` sur `origin/main` : seul `A.annule || !A.dispo`) et la liste « Choisir un achat »
  (`src/suggestionsAchat.js:318`, `achatDisponible` seul) ne regardaient pas l'arrivée. Seule la grille façon Bleam et
  « Relier achats et ventes » filtraient (`recuDe`). Les autres chemins — l'affectation globale (Annonces « Sans achat
  relié », la proposition sous une vente, la série, le numérotage), la feuille « Relier un achat » d'avant, la fiche de la
  paire — proposaient ces 40 achats, les plus récents en tête.
- « Commande livrée ! » (19) : 3 ont un suivi lu, **3 sur 3** « Délivré » chez le transporteur APRÈS « Disponible pour
  retrait » ⇒ c'est le retrait ; gardé comme preuve (« chez lui »). 16 sans suivi lu : la phrase de Vinted fait foi.
- Remboursements : 4 e-mails « remboursement d'achat », tous du montant payé (aucun partiel aujourd'hui) ; 1 seul visait un
  achat dont la liste ne disait pas « remboursé » (déjà sorti par `avecRemboursementsProuves`). 0 fiche reliée à un achat
  remboursé. Transactions lues : 2 achats « non réclamée - retournée à l'expéditeur » dont la liste ne dit pas
  « remboursé » (230 et 430) — ils étaient comptés sans rien dire ; 0 achat annulé (≥ 500) que la liste ignorait.
- Non réclamés PROUVÉS côté achat : 2 (transaction lue). Les 771 « Remboursement validé / effectué » ne disent pas
  pourquoi : ils ne comptent pas comme « non retirés » (jamais deviné).

## Ce qui change
### 1. Une seule règle « chez moi » — `src/achatChezMoi.js`
`etatChezMoi(achat, { retireClic, finiSuivi, auPointSuivi })` → `{ chez, etat }` : finalisé (ou Leboncoin « Terminé ») ·
SON « Je l'ai retiré » / « Arrivé » · retiré prouvé par le suivi (`pickupUnion.txFinis`) · « Commande livrée ! » · livré à
domicile ⇒ chez lui. Au point relais (statut, ou suivi « disponible ») ⇒ `au-point`. En route / payé / pas su ⇒ non.
- L'écran Achats PUBLIE l'état par n° (`chezMoiParTx` → `publierChezMoi`) ; sans publication, le statut seul (jamais plus
  permissif). `auPointRelais` est le même texte que `isAtRelayStatus` de l'app (vérifié par l'audit C8).
- Consultée par : `affecterPropositions` (donc `propositionsArticle`, `pistesArticle`, `seriePropositions`,
  `meilleureSuggestion`), `suggestionsAchat`, `tousAchatsLibresDetail` (rend aussi `auPoint` et `pasChez`). L'achat déjà
  relié à CET article reste montré.
- Feuille « Lier à un achat » (`LierAchatGrille`) et « Relier un achat » (`RelierAchatCorps`) : **« Pas encore retirés · N »**
  replié, au-dessus de la grille, chaque colis avec « Je l'ai retiré » (`markPickupDone`, le geste de Colis, annulable) ⇒
  il devient reliable. « Relier achats et ventes », le menu ⋯ d'un achat et le tableau des achats lisent la même règle.

### 2. Statistiques · Transporteurs › « Colis non retirés »
`src/statsTransporteurs.js` : `ligneNonRetire`, `statsNonRetires`. L'écran Achats publie TOUS ses achats lus
(`vrm_stats_non_retires`, sur cet appareil, compact : dates, transporteur, point, montants ; ni titre ni n°) — un compte pas
relu ⇒ rien n'est écrit. Carte : la période de l'écran ou « Tout » ; non retirés (prouvés : statut de la commande ou de SA
transaction, ligne du transporteur de SON n°) et leur part ; prix payé (« lu pour k sur n ») ; remboursé (lu) ; à rembourser ;
pas su ; délai qu'il restait (arrivée → limite de garde LUES, médiane/moyenne, « — » sous 3) ; par transporteur ; par point ;
« Au point en ce moment » (5 au plus, puis « … et N autres ») avec « limite passée », « N j restants », « — » sans limite lue.

### 3. Remboursé hors dépenses — `src/coutAchatNet.js`
Le propriétaire du coût d'un achat reste `buysBase` (écran Achats) : `avecRemboursements` remplace `avecRemboursementsProuves`.
Statut remboursé / annulé · transaction lue ANNULÉE (500–520) · e-mail ≥ payé ⇒ « Remboursement effectué » (sort par
`achatAnnule` partout) ; e-mail < payé ⇒ `_rembPartiel` (seul le reste compte) ; non réclamé / retour / suspendue sans
remboursement lu ⇒ `_rembAttente` : COMPTÉ, et « N remboursement(s) en attente encore compté(s) » dit sous « Dépensé du mois ».
- « Dépensé du mois », la case « Dépensé », `vrm_achats_jours` (Aujourd'hui / groupes) : `coutAchatNet`.
- Registre des achats (Comptabilité) : `avecRemboursementsPublies` (la même règle, publiée par Achats) ; une ligne partielle
  vaut le reste (`rembourse` dit sur la ligne).
- Bénéfice d'une paire : un prix posé DEPUIS LE REÇU (`buyPriceSource: 'recu'`) d'un achat remboursé ⇒ 0 / le reste
  (`coutFicheNet`) ; un prix TAPÉ par lui n'est jamais touché.
- Aucune copie serveur de cette règle (`api/` ne calcule pas les dépenses d'achat).

## Preuves
- `scripts/audit-relier-retires.cjs` : 38 contrôles verts, **15/15 mutations** rouges (`--prouve`) : au point ⇒ chez,
  en route ⇒ chez, clic ignoré, moteur et liste sans la règle, publication ignorée, partiel compté entier, en attente pris
  pour remboursé, transaction annulée ignorée, registre sans partiel, prix tapé touché, non retiré sans preuve, risque
  deviné sans limite, « Dépensé » brut, grille sans la règle.
- Bancs : `scripts/bancs/relier-retires.cjs` (390 tactile et 1512, base inventée) — voir le rapport de la session (captures
  dans le scratchpad, jamais dans le dépôt) ; rouge sur `origin/main` (même banc, arbre `git archive`).
- Audits suivis : `audit-liaison-achat` (les jeux sans statut deviennent « reçus » : un achat sans statut est « pas su »),
  `audit-relier-glisser` F6, `audit-plans-solo-pro` (forme de `buysBase`).
- Déjà rouges sur `main`, pas touchés : `audit-relier-fiable` D4, `audit-plans-solo-pro` « CA déclaré (URSSAF) ».

## Ce qui reste
- Leboncoin / Vestiaire : un achat sans statut lu n'est jamais proposé (« pas su ») — « Je l'ai retiré » le rend reliable.
- Les 771 remboursements sans motif : Vinted ne dit pas « non réclamé » dans la liste ; seule la transaction lue le dit.

## Geste de Julien
Aucun.
