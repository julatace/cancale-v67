# 21 nov. 2026 — Rentabilité : « Ce que tu vends le mieux » (n° 36) et « Le coût réel de chaque vente » (n° 41)

Branche `claude/rentabilite` (partie de `claude/integration-21nov`). Pas de PR ni de fusion (l'intégrateur le fait).
`claude/transp-depenses` et `claude/style-vintex` sont fusionnées (vrai merge, 22 nov.) : conflits seulement documentaires et le `return` de `beneficePeriode` (netConnu + dépenses du jour gardés).

## Ce que Julien a choisi (21 nov.)

- **36 · Ce que tu vends le mieux** : dans Statistiques › Finances, un classement par modèle, marque, taille, et croisé
  modèle × taille : nombre vendu, prix de vente moyen, marge moyenne (sur les ventes au prix d'achat connu, « sur N »),
  temps de vente médian (dates lues), taux de vente (vendues ÷ mises en ligne sur la période) ; tri marge · vitesse ·
  volume ; « à racheter en priorité » = meilleur score marge × vitesse avec au moins 3 ventes ; le modèle regroupé par
  une normalisation prudente (affichage seulement, jamais une identité) et la liste de ce qui a été regroupé visible.
- **41 · Coût réel de chaque vente** : « prix − commission/frais du site − boost − emballage (saisi, ou forfait qu'il
  règle, éteint par défaut) − port s'il le paie (jamais sur eBay) − prix d'achat = bénéfice net de la paire », chaque
  ligne lue ou absente et dite ; dans la fiche de vente et en colonne « Net » du tableau à l'ordinateur ; agrégé dans
  Argent (net du mois = somme des nets connus − dépenses non rattachées, couverture affichée), sur LA règle du bénéfice.

## Ce qui est fait

### 36 — Statistiques › Finances (`src/vendsMieux.js`, `src/natif/ecrans/StatsVendsMieux.jsx`)
- Les trois listes « marques · modèles · tailles » du lot journee-stats sont remplacées par UNE carte (rien en double) :
  deux segments (Regrouper par : Modèle · Marque · Taille · Mod. × T. ; Trier par : Marge · Vitesse · Volume, gardés sur
  l'appareil `vrm_stats_mieux_axe` / `_tri`), « À racheter en priorité » (3 au plus), le classement (8 rangées), une
  ligne de couverture (« Marge sur 29 des 39 ventes (prix d'achat connu) · taux de vente sur 28 annonces Vinted datées ·
  23 non reconnues (Autres) »), puis « Ce qui a été regroupé » replié (chaque groupe, ses écritures « … » × n).
- Sur une rangée, le chiffre du tri est à droite et ne se redit pas dessous (le même nombre jamais deux fois).
- **Aucune règle de chiffre neuve** : le groupe et ses nombres = `classementRapporte` (src/ceQuiRapporte.js, « Ce qui
  rapporte ») sur le relevé de Ventes ; le tri = `trierRachat` ; « à racheter » = `quoiRacheter` (src/quoiRacheter.js),
  ÉTENDU : `scoreRachat(g)` = bénéfice brut moyen par paire ÷ délai médian (jours, au moins 1), seulement avec 3 ventes
  reliées ET datées et un bénéfice moyen positif ; `prioritaires` = les 3 meilleurs ; option `axe`. L'ancienne liste
  `aRacheter` (seuils médians, carte « Quoi racheter » d'Argent) est gardée telle quelle.
- Seule règle propre : le **taux de vente** — parmi les annonces Vinted mises en ligne dans la période (date lue), la
  part vendue ; une annonce n'est comptée qu'une fois (par SON identifiant d'annonce), une annonce sans date est dehors
  et comptée (« sur N annonces datées »). Les annonces lues viennent de l'index du dressing (`annoncesLues`,
  src/aujourdhui/lectures.js) ; la ligne du relevé porte maintenant l'identifiant de L'ANNONCE vendue (`item`).
- **Le modèle n'est qu'une statistique** : `modeleSur` (catalogue fermé, marque lue) ; vendsMieux.js n'est importé que
  par `src/aujourdhui/pilotage.js` et la vue ; il n'écrit rien, ne pose aucun N° ni lien d'achat (audit C3–C5).

### 41 — Le coût réel (`src/coutReel.js`, `src/beneficePaire.js`, `src/beneficeArticle.js`, `src/ForfaitEmballage.jsx`)
- **Une seule règle** : `coutReelVente` DÉCOMPOSE la règle du bénéfice (`beneficePaire` / `coutsVente`) ; son net est
  `beneficePaire(base, ficheDeLaRegle(site, fiche))` — par construction le même nombre que la ligne de vente,
  `vrm_benefice_jours` et le relevé.
- **`ficheDeLaRegle(site, fiche)`** (nouveau, src/coutReel.js) : LA fiche que la règle compte pour un site — eBay : jamais
  le port (§2.8) ni une commission notée (elle est lue, `totalMarketplaceFee`) ; Vestiaire : jamais la commission notée
  (le versé l'a retirée). Utilisée par la compta (`fraisFicheAutres` de `ventesAutresBenefice`), la fiche de l'article
  (`beneficeArticle`) et le coût réel. **Défaut corrigé** : avant, la fiche d'un article eBay retirait les frais notés
  (port compris) alors que la compta comptait 0 — deux bénéfices pour la même vente ; et la fiche Vestiaire recomptait
  une commission notée. Maintenant : eBay compte boost/emballage/autres notés, jamais le port, partout pareil.
- **Le forfait d'emballage** : `vrm_forfait_emballage` = { actif, montant } (SYNC_KEYS), ÉTEINT par défaut ; allumé,
  `coutsVente` l'ajoute à chaque vente dont l'emballage n'est pas saisi (un emballage saisi passe devant) — donc dans
  TOUS les totaux. Posé par l'app (`poserForfaitEmballage`, relu au démarrage, au nuage, à chaque écriture). Réglé par
  lui dans la fiche d'une vente (ligne « Forfait emballage · Régler », sous le détail, seulement quand l'emballage de
  cette vente n'est pas noté) ; « Éteindre » le retire. Lien neutre (pas ambre : ce n'est pas un geste à faire).
- **Dans la fiche de vente** (FichePaire, « Tout voir ») : la ligne « Frais notés » est remplacée par son détail — boost,
  emballage (noté / forfait / pas noté), port (« pas noté : d'habitude l'acheteur le paie » ; eBay « pas compté »),
  commission notée, autres — chaque « — » avec sa raison (`lignesBeneficeArticle(b, T, { detail: true })`).
  La fiche de vente d'avant (Comptabilite, `.vrm-recap-argent`) porte le même détail (lignes `data-cr-*`), mais elle
  n'est plus affichée en design natif.
- **Colonne « Net »** du tableau des ventes à l'ordinateur (`VentesTableau`, prop `netDe`) : Vinted par SON n° de
  transaction (`coutReelVente`, posé par Ventes : `NET_VENTES.de`), les autres sites par la vente rangée de la règle
  (`netDeVenteRangee`) ; « — » sans prix d'achat, « au plus » tant que des frais ne sont pas confirmés.
- **Argent › Mois** : quand des prix d'achat manquent, « Bénéfice des ventes connues » (`beneficePeriode().netConnu` =
  Σ nets des ventes au prix connu − dépenses du mois − URSSAF de CES ventes, sur `caCouvert`) au lieu du brut ; sa
  couverture est la phrase des prix à saisir (« 13 prix d'achat à saisir sur 15 », même source) ; `data-benef-notion`
  `connu`, `data-arg-net-connu` k/n. Quand tout est connu : « Bénéfice » (`netFinal`), inchangé. Jamais « au moins ».

## Preuves

- `node scripts/audit-rentabilite.cjs` : **29 verts**. Mutations (`--mutation=`), chacune rouge : `port-ebay`,
  `commission-vc`, `forfait-defaut`, `forfait-ecrase`, `net-recopie`, `lot`, `min`, `taux`, `date-devinee`, `identite`,
  `connu`, `ebay-app`, `vue` (13/13).
- `scripts/bancs/rentabilite.cjs` (390 tactile et 1512, clair et sombre) : **82 verts, 0 rouge** après les fusions —
  Statistiques (M1–M5, N : chaque nombre recompté à part) et Ventes/Argent sur le vrai `dist/` (V1 détail de la fiche,
  V2 forfait éteint · réglé · emballage saisi prioritaire · éteint, V3 colonne Net, V4 Bénéfice connu 79,20 € · 3/4).
  Rouge sur le code d'avant (M1 : la carte n'existe pas) ; mutations `net`, `regroupe` rouges.
- `audit-argent-plus` 78 · `audit-argent-choix` 40 · `audit-journee-stats` 34 · `audit-urssaf` · `audit-identite` ·
  `audit-benefice` 50 · `audit-cout-vente` 28 · `audit-traduction` 45 · `audit-quoi-de-neuf` · `audit-coherence` ·
  `audit-icones` : verts ; banc `journee-stats` 118 verts ; build vert.
- Défauts vus sur les captures et corrigés : clé « cr.emballage » affichée telle quelle (contrôle C8 ajouté), « Bénéfice
  des vente… » coupé dans la case d'Argent (libellé court « Bénéfice connu »), « − 0 € », titres regroupés coupés.
- Le banc `cout-vente` (fiche de vente d'avant, `.vrm-sale-row`) est rouge AVANT ce lot : cet écran n'est plus monté
  en design natif ; le détail vit maintenant dans la fiche natif (FichePaire).
- Banc `journee-stats` : S1b suit la nouvelle carte (blocs `ventes,stock,sites,mieux`, modèles lus sur les rangées).

## Ce qui reste

- Une commande eBay à plusieurs articles : le forfait d'emballage est compté par article (un par fiche reliée), pas par
  colis — à revoir si ce cas existe vraiment chez lui.
- Les « dépenses rattachées à une vente » (lot transp-depenses, pas encore fusionné) : quand elles existeront, leur
  montant doit entrer dans les frais de LA vente et sortir des dépenses du mois (sinon compté deux fois).
- Le taux de vente ne couvre que Vinted (les autres sites n'ont pas de date de mise en ligne lue).
- La fiche d'une vente SANS N° relié ne montre pas encore le coût réel (elle dit « Pas de paire reliée ») ; la colonne
  « Net » du tableau le montre.

Geste de Julien : aucun (le forfait d'emballage reste éteint tant qu'il ne le règle pas).
