# Scanner un colis d'ACHAT : ce qu'il y a dedans — 16 novembre 2026 (branche `claude/scan-achat`)

Mission : `docs/passation/file-attente-16nov/002-scan-achat.md` (validée par Julien) : « quand on scanne un
bordereau d'ACHAT (le colis qu'il reçoit), l'app doit pouvoir dire, avec les infos du bordereau, ce qu'il y a dans
le colis ».

## Ce qui existait (et reste)
Le scanner pour retrouver (15 nov., `src/ScannerRetrouver.jsx`, `docs/passation/2026-11-15-scanner-colis.md`) :
caméra iPhone (BarcodeDetector, sinon ZXing dans la page — aucune IA, §2.9), saisie du n°, `lireCodeColis` (formes
documentées ou mesurées : Mondial Relay, Chronopost S10, Colissimo, GeoLabel DPD, Vinted Go, UPS, ISO 15434…),
`retrouverParSuivi` (égalité EXACTE, jamais un titre). Un achat trouvé montrait une petite fiche (titre, N°, code
de retrait) et « Ouvrir l'achat ». La feuille « Achat pas encore relié · Relier » (16 nov., achats-qr,
`src/relierColis.js`) écrivait déjà un n° comme identité d'un achat (`colis_suivi_*`, SON clic).
**L'OCR n'est pas fait** : seul le code-barres (ou le n° tapé) est lu — dit dans la phrase « vise l'autre code ».

## Mesuré (lecture seule, sa base, rien recopié)
- Commandes d'achat (`orders_purchased`) : titre, prix `{amount}`, date, photo, statut, `conversation_id` — **ni
  marque, ni taille, ni état**.
- Transaction (`harvest_{uid}_txn_{tx}`, côté acheteur) : `seller.login` et `order.items[]` = titre, `size_title`,
  `status` (« Très bon état », « Bon état », « Satisfaisant », « Neuf sans étiquette »), prix, photos ; un lot va
  jusqu'à **8 articles**. Aucune marque nulle part ⇒ la marque n'est dite que si le titre la nomme (`extractBrand`,
  affichage seulement, jamais une identité).
- N° de suivi des achats : **43 achats sur 135 des 30 derniers jours** ont leur ligne de suivi Vinted
  (`harvest_*_suivi_*` : Mondial Relay 8 chiffres ×20, 16 chiffres ×8, S10 ×7, Chronopost Pickup, BRT, SEUR) ;
  0 n° relié à la main. Les autres ⇒ « Colis inconnu · Relier à un achat ».

## Ce qui change
1. **Fiche d'un achat scanné** (`FicheAchat`) : « Dans ce colis » — la photo en grand, le titre, taille · état
   (lus dans SA transaction, une ligne projetée, à l'affichage : `detailsAchatScan`) ; un lot ⇒ la liste de ses
   articles (photo, titre, taille · état · prix) ; Marque (si le titre la nomme), Payé, Acheté le, Vendeur (son
   pseudo de la plateforme), Ton compte ; l'état du colis et le code de retrait comme avant. « — » pour ce qui
   manque.
2. **Les gestes** : « Ranger » (plein) ⇒ le scanner se ferme et l'atelier d'arrivée s'ouvre (N° puis case,
   `ouvrirAtelierArrivee`, prix payé repris) ; « Signaler un problème » ⇒ la conversation de CET achat sur Vinted
   (là où Vinted prend le signalement) ; « Ouvrir l'achat » ; « Ce n'est pas ça » ⇒ retour au scanner, aucune fiche.
3. **Colis inconnu** : « Colis inconnu : n° …, aucun achat avec ce n° » + « Relier à un achat » (plein) ⇒ la feuille
   de choix d'Achats s'ouvre sur CE n° (`vrm:relier-colis`, la première instance d'Achats qui a lu ses achats la
   prend — une seule feuille ; sinon Achats s'ouvre et la reprend) ; SON toucher écrit le n° comme identité
   (`colis_suivi_*`, `relieDepuis: 'scan'`) ; le même n° rescanné ouvre cet achat. Un colis à retirer sans achat
   (sorte `colis`) a aussi « Relier à un achat ».
4. **Douchette** : un code qui n'est pas une vente ouvre le scanner pour retrouver sur son résultat (fiche d'achat,
   ou colis inconnu) ; scanner déjà ouvert ⇒ le code y est résolu (`vrm:retrouver-code`).

## Preuves
- Banc **`scripts/bancs/scan-achat.cjs`** (390 tactile, clair et sombre, caméra refusée ⇒ n° tapé, base inventée
  de la forme mesurée) : **34/34 verts** — 50 achats au MÊME titre, trois n° ⇒ chaque fois SA fiche ; détails lus
  dans SA transaction (vendeur, taille, état, prix) ; lot ⇒ 3 articles ; « Ce n'est pas ça » ; n° inconnu ⇒ phrase
  + Relier ⇒ feuille ⇒ rien écrit avant son toucher ⇒ son toucher écrit le n° (tx de CET achat) ⇒ douchette ⇒ la
  fiche ; « Ranger » ⇒ atelier ; 44 px ; rien ne déborde ; aucune erreur. Captures regardées (fiche, lot, inconnu,
  feuille de choix).
- Code d'avant (`origin/main`, banc copié dans l'arbre d'avant) : **10 rouges** (aucun détail, aucun « Ranger »,
  aucun lot, aucun « Relier »). Mutations (détails lus dans une AUTRE transaction ; la demande « Relier » jamais
  prise), un build : **8 rouges**. Après fusion de `main` : rebâti, **34/34 verts**.
- Audits : scan-colis 52/52, studio, relier-colis 22/22, traduction, tdz, identite, icones, variables, quoi-de-neuf.

## ÉTAT À LA REPRISE
- Branche poussée, PR ouverte (voir le rapport). Pas fusionnée (le train fusionne).
- Pas fait : lecture de texte (OCR) d'une étiquette sans code lisible — non nécessaire tant que le code-barres se lit,
  et seulement possible dans la page (§2.9) ; Leboncoin / Vestiaire / eBay : leurs achats ne portent aucun n° de
  suivi rangé chez VRM (mesuré au 15 nov.) ⇒ « Colis inconnu », reliable à la main seulement pour Vinted.
