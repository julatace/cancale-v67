# 23 nov. 2026 — Le colis d'ACHAT scanné : son N° et le geste suivant (lot scan-achat, 2e passe)

Branche `claude/scan-achat` (depuis `origin/main` b5fc00bd). Mission : `docs/passation/file-attente-16nov/002-scan-achat.md`,
reprise le 23 nov. sur la demande de Julien « fais tout parfaitement » : scanner le bordereau / code d'un colis d'ACHAT
(QR, code-barres, n° tapé) ⇒ l'app dit ce qu'il y a dedans (photo, titre, vendeur, prix, date), **quel N° de rangement
l'attend**, et **le geste suivant** (« Ranger en … », « Numéroter », « Relier à une vente » / la vente si déjà vendue).

## Ce qui existait déjà (lu avant de coder) et qui reste
- 16 nov. (`2026-11-16-scan-achat.md`) : la fiche « Dans ce colis » du scanner pour retrouver (`FicheAchat`,
  `src/ScannerRetrouver.jsx`) : photo, titre, taille · état, lot ⇒ la liste, Payé, Acheté le, Vendeur, Ton compte ;
  « Ranger », « Signaler un problème », « Ce n'est pas ça ». Identité : le n° de suivi (`retrouverParSuivi`, égalité exacte).
- 19 nov. (`2026-11-19-colis-achat-auto.md`, Julien) : **plus aucun « Relier l'achat au colis » à la main** (0 lien
  produit en 4 jours, « perte de temps monumentale ») ⇒ je ne le remets PAS ; un colis inconnu se dit, avec que faire.
- 20 nov. (`2026-11-20-arrivee-scan.md`) : l'écran d'arrivée (N° servi relu, pool d'abord, case du Stock, étiquette) —
  « Ranger » de la fiche l'ouvre. Le scanner reste UN : Aujourd'hui → Scanner = `ouvrirRetrouver('journee')`.

## Mesuré (base de production, LECTURE seule, projections scalaires, rien recopié — 23 nov. 08:00)
| | nombre |
|---|---|
| achats Vinted des 30 derniers jours (`orders_purchased`, 2 vendeurs, 112 chez le propriétaire) | **114** |
| … avec une ligne de suivi Vinted (`harvest_*_suivi_{tx}`) ⇒ reconnus au scan | **29 (25 %)** |
| … avec SA transaction côté acheteur (`harvest_*_txn_{tx}`, vendeur, taille, état, articles d'un lot) | **0** |
| transactions côté acheteur dans toute la base / la plus récente | 43 / 4 nov. |
| … côté vendeur (pour comparaison) | 1 411 (186 en 30 j) |
| achats de 30 j reliés à une fiche numérotée (`buyFromId`) | **11** |
| … dont le N° est dans une case (`vrm_slots`) | 2 |
| … dont le N° est DÉJÀ VENDU (correction de vente : 6 ; transaction vendeur sur la même annonce : 7) | **7 sur 11** |

Formes des n° de suivi d'achat rangés (49 lignes) : Mondial Relay 8 chiffres ×20 ; 13 caractères alphanumériques
×8 (S10) ; 16 chiffres ×8 ; « PRO-CARRIER » 13 car. ×4 ; Chronopost 13 car. ×2 ; BRT 15 chiffres ; SEUR 14 chiffres ;
12 et 15 chiffres sans transporteur. Champs d'une commande d'achat : titre, prix `{amount}`, date, photo (108/114),
statut, `transaction_user_status`, `conversation_id` — **aucun vendeur, aucune taille, aucun état**.

Conséquences, dites telles quelles (rien deviné) :
- **Vendeur, taille, état** ne se lisent que dans la transaction côté acheteur, que l'extension ne range presque plus
  (0 sur 114) ⇒ la fiche dit « — » ; la photo, le titre, le prix payé et la date viennent de la commande (toujours là).
  Geste qui manque : rouvrir la conversation de l'achat sur vinted.fr range sa transaction (voir « Reste »).
- **Couverture attendue d'un scan** : 1 colis d'achat sur 4 est reconnu par son n° de suivi aujourd'hui (même chiffre
  que le 19 nov. : 31/111 par le suivi Vinted). Les autres ⇒ « Colis inconnu » + que faire, ou le n° de transaction /
  le code de retrait tapé (nouveau, ci-dessous).
- **Déjà vendue** n'est pas un cas rare : 7 des 11 achats reliés de 30 jours ont leur paire déjà vendue ⇒ le geste
  n'est pas « Ranger » mais « Ouvrir la vente » (l'envoyer).

## Ce qui change
1. **Son N° et le geste suivant** (règle PURE `src/scanAchatSuite.js`, `suiteAchatScan`), lus au moment où la fiche
   s'affiche (`e.suite()`, bâti par la source d'Achats, `src/ecrans/Comptabilite.jsx` `dansLeColis`) :
   - les N° de CET achat **par identité seulement** : une fiche reliée à SON n° de transaction (`buyFromId`) ou rangée à
     l'arrivée sous SON n° de transaction (`vrm_fiches_neuves` `achat.tx`, retirée ⇒ plus rien) — `numerosDeLAchat` ;
     fiches pas lues ⇒ pas su (la fiche garde le « Ranger » d'avant, l'écran d'arrivée relit tout) ;
   - **rangé** (chaque N° dans une case) ⇒ étiquette verte « N°13 · Rangé · Étagère A · rangée 2, colonne 3 », aucun plein ;
   - **à ranger** (N° sans case) ⇒ « Case prévue : … » = la 1re case LIBRE de la règle du Stock (`casesProposees`) ;
     plein « **Ranger en Étagère A · R1 C2** » ⇒ l'écran d'arrivée de CET achat (qui propose la même case, relue) ;
     un lot ⇒ une ligne par N°, des cases différentes, « Ranger les 2 paires » ; aucun meuble / cases pas lues ⇒ dit ;
   - **déjà vendue** (une vente LUE, pas annulée, porte ce N° par son annonce ou sa correction — `numerosVendus`) ⇒
     étiquette ambre « N°15 déjà vendue : ne la range pas, envoie-la. », plein « **Ouvrir la vente** » (la fiche de
     CETTE vente, le chemin rapide du 17 nov.) ; ventes pas lues ⇒ rien n'est dit de la vente (`venteSu: false`) ;
   - **à numéroter** (aucun N°) ⇒ « Pas encore de N° : il est donné en le numérotant. », plein « **Numéroter** » (l'écran
     d'arrivée) + « **Déjà vendue ? Relier à une vente** » ⇒ la feuille d'Achats « Relier à une vente / annonce » sur CET
     achat (SON toucher relie ; rien n'est écrit avant).
   - Le N° de l'en-tête de la fiche n'est plus écrit deux fois (§7 : un nombre, une fois).
2. **Aucun N° « prévu » n'est montré sans être servi** (décision prise seul) : un N° montré peut être écrit sur un carton ;
   l'écran d'arrivée l'écrit au pool AVANT de le montrer (append-only, jamais réattribué, §5). Montrer « N°16 prévu »
   depuis le scan sans le réserver permettrait de le donner ensuite à une autre paire. ⇒ « Numéroter » à la place.
3. **Identité tapée** (`achatParIdentite`) : un n° TAPÉ (ou lu par la douchette) qui n'est pas un n° de suivi connu est
   cherché comme **n° de transaction** d'un achat (9 à 13 chiffres, égalité exacte avec SA clé) ou **code de retrait** d'un
   colis (4 caractères au moins, égalité exacte, espaces et casse ignorés) ; deux fiches au même code ⇒ la question ;
   jamais pour une lecture de la caméra (un code quelconque n'ouvre rien), jamais un début de n°, jamais un titre. Vaut
   aussi pour le scanner de l'arrivée (achats seulement).
4. **Colis inconnu** : la phrase d'avant + que faire : « Ouvre l'achat sur vinted.fr : l'extension y lit son n° de suivi.
   Ou tape son n° de transaction ou son code de retrait. » Aucun lien à la main (décision du 19 nov.).
5. Textes par `tr()`, 5 langues (`src/i18n/langues/*/scanRetrouver.js`) ; « Quoi de neuf » `scan-achat-numero`.
   Style : étiquettes pastel du « noir encre » (vert = fait, ambre = geste à faire), un seul plein à l'encre.

OCR (texte d'une étiquette sans code lisible) : toujours pas fait — le code-barres se lit (scanner du 17 nov.) et la
lecture d'un texte ne se ferait que dans la page (§2.9) ; le n° tapé couvre le cas.

## Preuves
- `node scripts/audit-scan-achat-suite.cjs` : **22 verts** (I1 50 achats au même titre, seul le relié a un N° ; I2 fiche
  d'arrivée / retirée ; I3 pas lu ⇒ pas su ; I4 transaction tapée parmi 50, n° voisin / début ⇒ rien, code de retrait,
  deux au même code ⇒ question, titre ⇒ rien ; S1 rangé et sa case ; S2 1re case libre, cases pas lues, aucun meuble ;
  S3 vendue par l'annonce et par la correction, annulée ⇒ non, ventes pas lues ⇒ jamais « vendue » ; S4 lot ⇒ 3 cases
  différentes ; B branchements). `--prouve` : **12/12 mutations rouges**. Arbre d'avant (`git archive origin/main`) : rouge.
- Banc `scripts/bancs/scan-achat-suite.cjs` (Aujourd'hui → Scanner — au téléphone l'icône du champ de recherche, à
  l'ordinateur l'événement du bouton —, 390 tactile et 1512, clair et sombre, caméra refusée ⇒ n° tapé, base inventée
  de la forme mesurée) : **172 verts** sur le commit `67ea18da8` (avant la dernière retouche : lot, chaque N° sur sa ligne),
  4 vues : A rangé / à ranger (1re case libre, plein « Ranger en Étagère A · R1 C2 » ⇒ l'écran d'arrivée de CET achat) /
  déjà vendue (« Ouvrir la vente ») / 3 achats au même titre sans fiche ⇒ « Numéroter » + « Relier à une vente » ⇒ la
  feuille de CET achat, rien d'écrit ; L lot ⇒ N°20, N°21, deux cases ; T n° de transaction tapé ⇒ CET achat, voisin ⇒
  rien ; I inconnu ⇒ phrase + que faire ; un seul plein, 44 px, rien ne déborde, aucune clé brute, aucune erreur.
  Le premier passage a trouvé deux défauts, corrigés : une clé du nuage jamais écrite (`vrm_fiches_neuves`, `vrm_slots`)
  valait « pas su » (tout le monde sans arrivée gardait l'ancien « Ranger ») ⇒ vide une fois le nuage lu ; le lot disait
  « Plus aucune case libre » et le N° de la vente était écrit deux fois (§7). Captures regardées (390/1512, clair/sombre :
  rangé, à ranger, vendue, numéroter, feuille Relier, lot, inconnu, arrivée), non commitées.
- PAS ENCORE FAIT (machine saturée avant la démo, consigne du coordinateur : aucune commande lourde avant 15:30 UTC) :
  le banc sur la dernière retouche du lot (ligne par N°), les bancs voisins `scan-achat.cjs` et `arrivee-scan.cjs` sur ce
  build, la passe complète `lancer-audits.cjs`, le banc sur le build de `origin/main` (rouge attendu : aucun
  `data-scan-a-suite`). Audits légers verts : scan-achat-suite 22/22 (+ 12 mutations), traduction, tdz, variables,
  identite, textes-courts, style-vintex, studio, scan-colis 52/52, arrivee-scan 44, quoi-de-neuf.

## ÉTAT À LA REPRISE
- Branche `claude/scan-achat` poussée, `origin/main` fusionné (vrai merge), PR ouverte en brouillon (voir le rapport).
- **Pas fusionnée** : gel des fusions de 15:00 UTC (23 nov.) à 07:00 UTC (24 nov.) pour la démo de Julien, et aucune
  commande lourde avant 15:30 UTC. À faire à la reprise, dans l'ordre (via lourd.sh) : build ; `scan-achat-suite.cjs`,
  `scan-achat.cjs`, `arrivee-scan.cjs` sur ce build ; le banc `scan-achat-suite.cjs` sur un build de `origin/main`
  (doit rougir) ; `AUDITS_PARALLELE=2 node scripts/lancer-audits.cjs` ; comparer la CI de la PR à celle de main ;
  vrai merge de main si elle a bougé ; fusion après 07:00 UTC le 24 nov. si aucun rouge nouveau ; statut Vercel.

## Reste
- Vendeur / taille / état d'un achat récent : « — » tant que sa transaction côté acheteur n'est pas rangée (0 sur 114).
  Geste pour Julien : ouvrir la conversation d'un achat sur vinted.fr (l'extension range sa transaction) ; chantier
  possible côté extension (lire la transaction des achats comme celle des ventes, dans le budget de lecture 20/h).
- 75 % des colis d'achat n'ont pas de n° de suivi rangé : même cause que le 19 nov. (extension, comptes pas rouverts).
- Leboncoin / Vestiaire / eBay : aucun n° de suivi d'achat chez VRM ⇒ « Colis inconnu ».
