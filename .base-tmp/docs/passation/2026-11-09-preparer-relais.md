# 9 nov. — « Préparer mes colis » pas à pas et mode relais (lot AD, propositions 46 et 48)

Branche `claude/preparer-relais` (pas de PR, pas fusionnée par la session). Validé par Julien (« fais tout »).
Extension : rien touché. Rien de métier ne change : aucune règle nouvelle, les écritures sont celles des cartes.

## 1. « Préparer mes colis » (Colis → À envoyer)

- Bouton **« Préparer mes colis »** (`data-preparer-ouvrir`) dans sa propre rangée sous les onglets
  (`.vrm-pas-a-pas-rangee` — pas `.vrm-colis-outils`, que fusion.css range derrière « … »). « Emballer »
  reste où il était.
- Feuille plein écran en portail (`src/PreparerColis.jsx`, à la demande ; style : les classes `.vrm-emb*` du
  mode emballage + `src/styles-preparer-relais.css`), `FermeAuRetour`, Échap, ← →.
- **Liste et ordre** : `colisAEnvoyerRanges()` = exactement la liste « À envoyer » (le plus pressé d'abord,
  puis par transporteur). Jamais trié par emplacement (refus du 11 oct.). Le banc compare à l'ordre des cartes.
- **Chaque écran** (`colisPreparer`, App.jsx) : grande photo, N° en pastille, titre, taille, compte,
  transporteur (s'il est lu), date limite ; le bordereau : « Imprimer ce bordereau » (la règle du bouton de la
  carte, extraite dans `imprimerColisVinted` : PDF capté d'abord, e-mail en secours, tamponné, + facture pro)
  et « Scanner » (le scanner existant, avec `attendu`) ; « Colis fait » ; ‹ / « Suivant ».
- **Identité (§5)** : Vinted = la vente par son n° de transaction (`orderPhoto(o)`, `effEntry(o)`) ;
  Vestiaire = la vente par son id ; Leboncoin = la vente par son n° de transaction ; eBay = la commande.
  `paire: 'a-verifier'` (aucune photo, « Paire à vérifier » + raison) si aucune vente ne porte le colis —
  aujourd'hui impossible par construction (`expeditions()` n'admet pas de bordereau sans vente, Leboncoin
  lit la vente du même n°), gardé en défense. Le cas réel « la paire peut être fausse » est `numLitige`
  (l'e-mail dit un autre N° que la vente) : la photo reste celle de la VENTE, le N° passe ambre avec
  « L'e-mail du bordereau disait N°X, la vente dit N°Y… Vérifie le carton. » Deux paires sous un N° : rouge
  (`etatNumeroColis`, la règle de l'emballage).
- **« Colis fait »** = `deposeScan.demander` (le différé de 5 s du scanner et de la tournée), qui écrit
  `marquerColisFait` (`vinted_ship_done[tx]` + `vinted_bords_shipped`) ; Vestiaire `vrm_vc_colis_done`,
  Leboncoin `vrm_lbc_colis_done` (leurs coches de toujours) ; eBay : aucun bouton (l'étiquette et le dépôt
  se suivent dans eBay, §2.8). « Annuler » dans la feuille pendant les 5 s.
- **Scanner depuis l'étape** : `ScannerColis` prend `attendu` (la clé du colis montré). Le bordereau d'une
  autre vente ⇒ « Pas ce colis : ce bordereau est celui du N°… », aucun bouton ; le sien ⇒ « C'est le bon
  bordereau » et le geste habituel.
- **Progression et reprise** : « Colis 3 sur 18 · 2 faits », barre fine ; la séance (ordre, colis courant,
  faits + titre/N° des faits) est gardée sur l'appareil, par uid, 12 h (`src/preparerRelais.js`,
  `vrm_preparer_seance_{uid}`, rien dans le nuage). Fermer à tout moment ; rouvrir reprend sur le même colis.
  Un colis noté fait mais encore dans « À envoyer » sans attente a été annulé (feuille, scanner ou pilule) :
  la séance le remet « à faire » (elle suit l'écriture réelle).

## 2. Mode relais (Colis → À retirer, Achats, hors ligne)

- Bouton **« Mode relais »** (`data-relais-ouvrir`) sous les onglets de « À retirer » (rangée visible) et
  dans l'en-tête d'Achats / Colis à retirer à côté de « Scanner » (`gestesRetraitAchats`), quand
  `pickupUnion.total > 0`.
- **Liste** (`colisModeRelais`) : les cartes `groupe 'retirer'` sans `horsCompte` = `pickupUnion.emailList`
  + `pickupUnion.extra` = EXACTEMENT ce que publie `vrm_colis_retirer` (jamais à vérifier, en cours de
  vérification, comptés avec, finis). L'identité publiée est écrite UNE fois (`identRetraitEmail`,
  `identRetraitVinted`) et sert la publication et le mode relais. Ordre : par point (un comptoir), dans
  l'ordre des cartes ; puces « Tous · n / Point · n » quand il y a plusieurs points.
- **Écran** (`src/ModeRelais.jsx`, PAS paresseux pour s'ouvrir sans réseau) : nom du point, adresse, code
  (et identifiant) en très grand (mono, ≥ 56 px), QR s'il existe (`qrVivant` / `qrImage` du relais), n° de
  suivi, titre et vignette de l'achat. Fond blanc plein, encre noire, même en mode sombre. « Monte la
  luminosité au maximum : VRM ne peut pas la régler. » (+ « L'écran reste allumé. » quand le Wake Lock tient).
- **Wake Lock** demandé à l'ouverture, redemandé au retour sur l'onglet, rendu à la fermeture ; absent ⇒ rien.
- **Glisser** sur la carte du code (dans la feuille seulement) ou ‹ › / ← →.
- **« Retiré »** = `markCollected(t)` / `markPickupDone(o)` (le « J'ai retiré » des cartes, geste annulable
  `gesteVrm`) ; `gesteCollecte` et `markPickupDone` rendent maintenant l'id du geste ⇒ « Annuler » 5 s dans
  la feuille (`_gestes.annuler(id)`). Le colis retiré reste à sa place dans la séance, montré « Retiré ✓ ».
  La pilule globale passe au-dessus du pied pendant ces feuilles (elle couvrait la croix).
- **Hors ligne** : `vrm_codes_hors_ligne` (G9) porte maintenant `id` (identité publiée) et `compte`
  (vrai = dans « à retirer »). Le bloc « Tes codes de retrait (hors ligne) » (base injoignable, journée hors
  ligne) offre « Mode relais » sur les seuls codes `compte: true`, sans « Retiré » (« se note quand VRM
  répond »). Un QR hors ligne n'est pas gardé (dit). Une copie d'avant ce chantier (sans `compte`) n'offre
  pas le bouton.

## 3. Preuves

- `scripts/bancs/preparer-relais.cjs` (390 tactile sombre + clair, 1512 clair) : **131 verts**. 8 ventes au
  même titre : ordre = la liste, chaque étape la paire de SA vente (clé, N°, photo b{k}, « k sur 8 »),
  rien écrit en naviguant, « Colis fait » ⇒ Annuler puis la vente et son bordereau seulement, même forme que
  « Déposé » de la carte, « Annuler » ⇒ rien, reprise, scanner « Pas ce colis » / « bon bordereau » ;
  relais : liste = identités de `vrm_colis_retirer` (ni « à vérifier » ni retiré), fond blanc même sombre,
  code ≥ 56 px, Wake Lock demandé puis rendu, glisser / ›, « Retiré » sur le bon des deux achats au même
  titre (même forme que la carte), « Retiré » + « Annuler » ⇒ rien, hors ligne seulement les comptés ;
  cibles ≥ 44 px, rien ne déborde, aucune erreur.
- **Rouge sur origin/main** (2fa8e47b, git archive, banc copié dedans, 390-sombre) : 6 rouges (aucun
  bouton, codes hors ligne sans `compte`).
- **Mutations** (390-clair) : voir §5.
- Audits : `npm run build`, `audit-{variables,tdz,coherence,identite,statuts,icones,colis-trois}` verts ;
  bancs voisins §4.
- Captures (scratchpad de la session, hors dépôt) : `preparer-relais-{390-sombre,390-clair,1512-clair}-{1-preparer,2-colis-fait,3-scan-autre,4-recap,5-relais,6-retire}.png`, `-390-sombre-7-hors-ligne.png`.

## 4. Bancs voisins (build final, un à la fois)

Verts : `scanner-colis-achats` 204, `colis-retirer-propre` 129, `retraits-frais` 34.
Rouges AVANT ce chantier, autant sur origin/main (mêmes contrôles) : `codes-hors-ligne` 6 (le cache n'est
pas écrit dans ses fixtures), `emballage` 3 (clic qui n'aboutit pas) — domaine de `claude/zero-banc-rouge`.

## 5. Mutations (390-clair, build + banc, puis restauré)

- le mode relais garde les `horsCompte` ⇒ 4 rouges (liste ≠ publication, « à vérifier » montré) ;
- la photo de Préparer prise par TITRE (première vente au même titre) ⇒ 7 rouges (étapes 2 à 8) ;
- « Colis fait » écrit tout de suite (`marquerColisFait` sans les 5 s) ⇒ 3 rouges ;
- le Wake Lock jamais rendu ⇒ 1 rouge.

## 6. Ce qui reste

- Imprimer depuis « Préparer » : Vinted seulement (la règle de la carte) ; Vestiaire passe par son bouton
  `BoutonImprimerVc` dans la feuille ; Leboncoin renvoie à l'écran Colis Leboncoin (dit) ; eBay : lien.
- Le mode relais hors ligne ne montre pas les QR (pas gardés sur l'appareil) ni les colis sans code.
- Wake Lock et caméra non essayés sur un vrai iPhone (Safari 16.4+ a le Wake Lock).
- Geste de Julien : aucun (essayer au comptoir).
