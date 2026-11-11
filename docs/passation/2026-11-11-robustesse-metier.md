# Robustesse métier — corrections (11 nov. 2026, second agent)

Branche `claude/agent2-robustesse-metier` (partie de `origin/main` 2084be1b9), **pas de PR, pas
de fusion** : l'agent principal intègre. Revue d'origine (lecture seule) :
`git show origin/claude/agent2-robustesse:docs/passation/robustesse/metier.md`.

Preuve commune : `node scripts/audit-robustesse-metier.cjs` (règles PURES exécutées + texte des
écrans sans commentaires) — **33 contrôles verts** ; `--prouve` : **12/12 mutations rouges** ;
sur `origin/main` (git archive) : **17 rouges**. `audit-urssaf` porte le point 3 (2 rouges sur
`origin/main`). Aucune donnée réelle.

| # | point (revue) | reproduit | corrigé | preuve |
|---|---|---|---|---|
| 1 | Critique 1 + haute 4 — Inventaire « Synchroniser les ventes » reliait par TITRE, sans clic ; une commande annulée au même titre remettait une autre paire « en ligne » ; une vente annulée restait « vendue » | A1-A6 rouges (règle absente) | `src/inventaireSynchro.js` : identité seulement (n° de transaction posé, transaction → annonce via `fetchTxnItemIds`, exporté d'App.jsx) ; deux paires sous une identité ⇒ rien ; la commande la plus fraîche décide ; annulée ⇒ seulement la paire qui porte CETTE transaction, retour « en stock » (jamais « en ligne ») ; sans identité ⇒ **proposition** « C'est la N°… », reliée par son clic (`relierProposition`) | A1-A7 ; mutations « synchro par titre », « annulée ⇒ en ligne » |
| 2 | Haute 5 — `emailSoldIds` retirait d'En ligne par titre + taille | B1 rouge | `src/venduesParEmail.js` : e-mail → transaction → annonce (`txnItem`), ou bordereau par identité (`bordForItem`) ; la liste persistée n'est réécrite que si « transaction → annonce » est LUE (`TXN_ETATS_LU`) | B1-B3, `audit-identite` (contrôle remplacé par la règle plus stricte) ; mutation « e-mail par titre » |
| 3 | Haute 6 — « J'ai déclaré ce mois » sur une lecture Vestiaire ratée | `audit-urssaf` : 2 rouges sur main | `lectureIncomplete` reçoit `vestiaire` (`undefined` en cours, `null` raté) ; le rapport et le geste passent `ventesVc` tel quel ; `ventesDeclarables` ne reçoit plus `[]` | `audit-urssaf` (cas « Vestiaire illisible / en cours » + geste) |
| 4 | Haute 7 — N° tapé à la main sur un achat hors plateforme pas réservé | C rouge | `Achats.jsx` : tout N° posé est réservé (`recordUsed`, append-only) | C ; `audit-achats-relier` 5 suivi ; mutation |
| 5 | Haute 8 — Ma journée lisait « 25,50 » comme NaN | D rouge (`renseignes: 0`) | `src/stockJournee.js` lit par `centimes` (règle du Stock) | D ; mutation |
| 6 | Haute 3 (+ basse 58) — supprimer la dernière facture redonnait son numéro | E1 rouge (module absent) | `src/factureNumero.js` : compteur `vrm_factures_pris` (synchronisé, ajouté à SYNC_KEYS) qui ne fait que monter ; la suppression note le numéro AVANT de retirer ; l'année est relue au moment d'ajouter | E1-E3 ; mutation |
| 7 | Haute 2 (+ moy. 9, 10) — achat inconnu = 0 € dans les ventes saisies | F rouges | `src/venteManuelle.js` : un N° du lot introuvable ou un achat vide ⇒ `null` ; bénéfice sommé sur les ventes au coût connu, « sur N ventes sur M » ; « — » sinon ; CSV `??` | F1-F6 ; mutation |
| 8 | Moy. 34 — `urssafInfo` sans `nonComptees` | G rouge | recopié dans `CarteUrssafMois` | G (la ligne exécutée) ; mutation |
| 9 | Moy. 50 — « Accepter » une offre à la main sans garde anti double vente | H rouges | `avisAcceptationManuelle` (src/offresGarde.js, MÊME `gardeRefuse`) : vendue ailleurs ⇒ rien ne part, message ; garde absente/périmée/incomplète ⇒ dit dans la confirmation | H1-H4 ; mutation |
| 10 | Moy. 29 — baisse « 1,10 € » refusée (flottant) | I1 rouge | `baisseTapee` juge le TEXTE (2 décimales au plus) | I1-I2 ; `audit-baisse-prix` vert ; mutation |
| 11 | Moy. 54 (+ 17) — « Prix conseillé » à la mise en ligne (refusé le 11 oct.) | J1 rouge | bloc retiré de « Aide à la vente » (restent titre et description ; champ prix d'achat retiré) ; le « X € conseillé » d'une paire qui DORT (chantier C, banc `annonces-coherence`) reste mais ne descend plus sous le prix d'achat | J1-J2 |
| 12 | §7 — bénéfice / marge négatif en rouge | K rouge (11 endroits) | encre neutre (Ventes, Bilan annuel, Rapport, Vérificateur, ventes saisies) ; « jours en stock > 60 » du catalogue : ambre | K ; mutation |
| 13 | Moy. 47, 22 — N° sans `cleNum` | L rouges | `bordForItem`, `bordPhoto`, inventaire (`numeroExists`, association) par `cleNum` | L1-L2 ; mutation |

## Banc des écrans rendus (demande de l'agent principal)
`scripts/bancs/robustesse-metier.cjs` (jeu inventé de `nouveau-vendeur.cjs`, 390 px tactile et 1512 px,
clair et sombre, captures regardées) :
- **Ventes saisies (Compta)** : achat inconnu « — », « Bénéf. 15 € sur 2 ventes sur 3 », mois « 30 € sur
  1 vente sur 2 », bénéfice négatif à l'encre — vert ; rouge sur `origin/main` (build à part, `BANC_DIST`).
- **« Accepter » à la main** : N°2 vendue sur Leboncoin ⇒ « Déjà vendue sur un autre site », aucune
  confirmation, rien envoyé ; Leboncoin pas relu ⇒ la confirmation dit « VRM n'a pas pu vérifier tes
  autres sites » — vert ; rouge sur `origin/main`.
  Le banc a trouvé deux défauts, corrigés : (1) la garde publiée n'existe que moteur d'offres ALLUMÉ
  (éteint par défaut) ⇒ elle est maintenant RECALCULÉE au clic (`chargerRetraitsMulti`) ; (2) une vente
  ailleurs PROUVÉE était masquée par « eBay pas relu » (garde incomplète ⇒ simple avertissement) ⇒ elle
  bloque maintenant (audit H1b, H5 ; 15/15 mutations).
- **Inventaire « Synchroniser les ventes »** : l'écran n'est monté par AUCUN chemin (lot DJ4 l'a retiré du
  menu, `inventory` n'est pas dans `ONGLETS_LIENS`, `?tab=inventory` ⇒ Ma journée) : rien à rendre ; le
  banc le constate et jouera tout le parcours si l'écran revient. La règle est jugée par l'audit (A1-A7).
- `messagerie.cjs` (touché par « Accepter ») : vert.

## Pas fait (noté pour la suite)
- Moy. 11 : deux appareils qui créent une facture au même instant (aucun comparer-et-échanger).
- `App.jsx` ~43391 : « délai dépassé » en rouge dans Colis — zone de l'agent principal (Colis).
- Dates UTC au lieu de Paris, totaux à 0 sans « au moins » (moy. 13-20, 23, 26, 27, 52) : pas faits.
- Les autres moyens/bas de la revue restent listés dans `robustesse/metier.md`.

## Geste de Julien
Aucun.
