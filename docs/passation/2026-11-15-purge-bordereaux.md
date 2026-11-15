# 15 nov. 2026 — Le PDF d'un bordereau part après le versement

Décision de Julien, mot pour mot : « Tu supprimes les bordereaux lorsque la vente est finalisée et
que on a reçu l'argent. »

Branche `claude/purge-bordereaux`, partie de `claude/project-review-nsk5su` (`f782040f`). Pas de PR
(l'intégration la fusionne). Extension NON touchée.

## 1. Mesuré (lecture seule, base de production, 15 nov. au soir)

Bordereaux qui portent encore leur PDF : **103** (62 `email_bord_*`, 41 `harvest_*_label_*` dont
`label_latest`) + **1** `vc_label_*` (Vestiaire). Rangés par la règle ci-dessous, dans l'ordre où elle
les écarte :

| raison | nombre | e-mail / capté | poids |
|---|---|---|---|
| vente introuvable (ni dans la liste des ventes ni dans un détail) | 2 | 2 / 0 | 196 Ko |
| retour, annulation, remboursement ou suspension vu sur la vente | 24 | 14 / 10 | 2,7 Mo |
| pas finalisée selon la lecture la plus fraîche (en route, livrée, à expédier…) | 56 | 33 / 23 | 5,2 Mo |
| **finalisée, mais aucune date de versement connue** | **21** | 13 / 8 | **2,7 Mo** |
| Vestiaire : vente en cours (à expédier) | 1 | — | 96 Ko |
| **retirés aujourd'hui par cette règle** | **0** | | |

**Aujourd'hui, la règle ne retire rien.** Les 21 ventes que la liste dit « Commande finalisée » n'ont
AUCUNE date de versement : leur détail de transaction est figé à 230 (ou absent), le relevé du
porte-monnaie n'a encore aucune ligne en base (`harvest_*_releve_*` : 0), et ni conversation de
versement ni e-mail « Transaction finalisée » ne porte leur n°. C'est le même manque que le CA déclaré
(« à dater ») : confié au chantier des dates de versement (extension 5.378, relevé vérifié). Dès qu'une
de ces ventes reçoit sa date, son PDF part au cron suivant — sans rien toucher ici.

Ce que la règle aurait retiré si « finalisée » suffisait (sans date de versement) : ces 21 PDF
(2,7 Mo). Ce n'est PAS ce qui a été décidé (« et que on a reçu l'argent ») : la question est posée à
Julien en §5.

À noter : 24 PDF de ventes **remboursées / retournées / annulées** restent aussi (2,7 Mo). Ce n'est pas
cette règle (pas d'argent reçu) ; la purge des annulées de l'extension (`purgeBordereauxAnnules`) ne
prend que les transactions ≥ 500 dont le colis n'a pas bougé. À décider à part si Julien le veut.

## 2. La règle (une seule, serveur : `api/_lib/purge-bordereaux.js`)

Le PDF d'un bordereau est retiré quand, ET SEULEMENT quand :

1. **finalisée** selon la lecture LA PLUS FRAÎCHE (§5) : la liste des ventes (`orders_sold`,
   `classifyOrderStatus` = `completed`) ou le détail (`txn`, statut 450), chacune datée par SA capture
   (`capturedAt`). Une lecture sans date, ou deux lectures du même instant qui se contredisent ⇒ pas su ;
2. **argent reçu** : une date de versement connue et passée — LA règle du CA déclaré
   (`versementsDeLignes`, la copie serveur de `datesDeVersement`) ;
3. **aucun retour, litige, annulation, remboursement, suspension** dans AUCUNE lecture, même ancienne
   (220, 430, 440, ≥ 500, `PAS_UNE_VENTE` via `classifyOrderStatus`, `failed`), ni bordereau de retour
   (`email_bordretour_{tx}`) au même n°. Un 440 reste 440 pour toujours : c'est voulu (« récent » compris) ;
4. « pas su » sur un point ⇒ gardé. Une source illisible (ventes, transactions, relevé, conversations,
   e-mails de versement, retours, ligne des transporteurs, journal, ventes Vestiaire) ⇒ RIEN écrit.

Ceintures : le bordereau a au moins 7 jours (sa propre date, lisible) ; son PDF a déjà été lu pour son
transporteur (`candidatsPdf` d'`api/_lib/transporteur-anciens.js` : encore à lire ⇒ gardé).

Vestiaire (`vc_label_{produit}`) : les règles d'`api/_lib/vestiaire-regle.js` (une seule vente au même
produit ; ni annulée ni à expédier ; étape « versée » ou « terminée » ; `verseLe` lu). Leboncoin et eBay ne
rangent aucun bordereau (eBay : l'étiquette est chez eBay, §2.8) : rien à faire. Les bordereaux de RETOUR
ne sont jamais touchés (l'identifiant est refusé, dans la règle ET dans la base).

## 3. Ce qui part, ce qui reste

Part : `pdfB64` et `pdfTamponneB64` (e-mail), `pdfB64` (capté), `b64` (Vestiaire) — mis à `null`.
Reste : la LIGNE et tout le reste (n° de suivi, transporteur, date limite, `filename`, `tx`, `item`…).
Marque : `pdfPurged: true`, `pdfPurgedAt`, `pdfPurgeRaison: 'versement'`.

Vérifié que rien ne dépend du PDF lui-même : la preuve de vente (`preuvesParBordereau`) lit `meta->>tx`
et `meta->>item` ; Colis, le widget, la date limite et le retrait lisent des scalaires ; la facture Pro ne
lit pas le bordereau ; la lecture du transporteur sur l'étiquette passe AVANT (ceinture). Le témoin
« porte un PDF » des captés (`meta->>_pdf`) tombe tout seul (déclencheur de la 004).
⚠️ `filename` n'est plus à lui seul le témoin du PDF d'un `email_bord_*` : `filename` ET pas `pdfPurged`.

L'app :
- Colis → « bordereaux déjà traités » : plus de « Réimprimer » mort, la phrase « Bordereau supprimé après
  le versement » (`colis.bordSupprimeVersement`, cinq langues) ; `hasPdf: false` partout ailleurs.
- Vestiaire : le bouton dit la même phrase (au lieu de « plus rangé »).
- `colisVentesEmail` : un bordereau sans PDF n'est jamais « prêt ».
- « Quoi de neuf » : une ligne.

## 4. Où, comment

- Cron du matin, par vendeur (`traiterVendeur` d'`api/ship-reminders.js`), APRÈS la lecture des
  étiquettes. Aucune 13e fonction.
- Lectures projetées seulement (`meta->>`, `data->`), paginées (`fetchPaginated`, `Range`), `owner=eq.`.
  Jamais `select=data` sur une ligne lourde.
- Écriture : la fonction `vrm_bordereau_retirer_pdf` (**migration 044, PAS appliquée**) fait
  `data || patch` DANS la base, sur UNE ligne, avec liste blanche (seuls les champs PDF à null + la marque),
  identité attendue (`data @> {transaction|tx|productId}`), et seulement si la ligne porte encore un PDF.
  Rend la taille avant/après. Essayée sur une base Postgres jetable (PGlite, hors dépôt) : retire, refuse un
  bordereau de retour, une autre clé, un PDF non nul ; ne touche pas la même ligne d'un autre vendeur.
  Sans la 044 : 404 ⇒ rien écrit, la réponse dit `migration: 'absente'`.
- 20 par passage au plus, les plus anciens d'abord.
- Coût : rien n'est lu au-delà des bordereaux quand aucun ne porte de PDF ; sinon les listes des ventes
  (`data->payload->my_orders`, la lecture du bilan et de Colis) et les scalaires des transactions —
  une fois par jour et par vendeur (chez Julien ≈ 400 Ko + les `meta` des transactions).
- Journal : `vrm_purge_bordereaux` (`dernier` : candidats, retirés, octets, gardés par raison ;
  `supprimes` : les 200 derniers ids et tailles). La réponse du cron : des nombres seulement.

## 5. Gestes et questions pour Julien

- **Appliquer la migration 044** (`supabase/migrations/044-bordereau-retirer-pdf.sql`, une fonction, aucune
  donnée modifiée à l'application). Sans elle, rien n'est retiré.
- **Question** : 21 bordereaux de ventes « Commande finalisée » n'ont pas de date de versement (§1). Les
  garder jusqu'à ce que la date arrive (la règle d'aujourd'hui), ou considérer « finalisée » sur Vinted
  comme « argent reçu » pour la seule purge (2,7 Mo de plus, tout de suite) ?

## 6. Preuves

- `node scripts/audit-purge-bordereaux.cjs` : la règle (A1-A17) et la route du cron (B1-B16) EXÉCUTÉES sur
  une fausse base à la vraie forme (projections, `meta` refait comme la 004, `Range`, `owner=eq.`, la 044
  jouée comme le SQL), branchement, migration, app (C1-C8).
- `--prouve` : ROUGE sur l'arbre de départ ; 12/12 mutations attrapées (oublier le versement, oublier le
  retour, oublier le bordereau de retour, ignorer la liste, « n'importe quelle lecture finalisée »,
  supprimer la ligne entière, `select=data`, lecture ratée qui écrit, lignes de tous les vendeurs, PDF pas
  lu pour son transporteur, ceinture des 7 jours, bouton gardé dans l'app).
- Banc `scripts/bancs/bordereau-supprime-versement.cjs` (390 px tactile, 1512 px, captures regardées) :
  Colis → « bordereaux déjà traités » : la ligne au PDF retiré dit la phrase, sans bouton ; l'autre garde
  « Réimprimer ». `bordereau-vestiaire-ouverture` vert.
- Verts : fonctions-api, identite, urssaf, coherence, tdz, variables, traduction, quoi-de-neuf,
  familles-serveur, bilan-semaine ; `npm run build`.
