# 9 nov. — Vendre plus : paires qui dorment, favoris sans vente, ce qui part vite, compte qui vend le mieux (branche `claude/vendre-plus`)

Les chantiers « retenus le 11 oct. » (CLAUDE.md §3) : plan des paires qui dorment, favoris sans vente,
ce qui part vite, compte qui vend le mieux, bénéfice réel, boost rentable ?. Julien : « fais tout ».
**Pas de merge** (branche poussée, à fusionner par la session qui coordonne).

## Ce qui existait déjà (réutilisé, pas refait)
- « Articles qui dorment » (3 nov.) : `src/quiDorment.js` (`articlesQuiDorment`, 30/60/90 j, la base
  de la grille `annBase` = `<enligne-regle>`), `src/design/QuiDorment.jsx`, la feuille « Agir ».
- Statistiques : « Les modèles qui partent vite » (`delaisPar`/`plusRapides`), « Quel compte vend le
  mieux », « Les tailles qui se vendent », « Ce qui rapporte le plus » (`classementRapporte`, axes
  Modèle · Marque · Taille · Compte · Site, bénéfice BRUT et couverture).
- **Boost rentable ?** : EXISTE (`src/boostRentable.js`, carte de Statistiques). Les boosts SONT lus :
  le montant payé saisi sur la fiche (`vinted_annonce_numeros[id].fees`) et le drapeau `promoted` des
  annonces captées ; moins de 3 boostés comparables ⇒ « Pas assez de données ». Rien à ajouter.
  ⚠️ Mesuré dans `boostRentable.js` : 0 `promoted:true` sur 380 annonces (21 oct.) et 0 montant saisi
  sur 1 005 fiches ⇒ chez lui la carte dit aujourd'hui « Pas assez de données » : pour qu'elle parle,
  il faut saisir le « Boost payé » sur les fiches boostées.
- Ma journée : la case « En ligne depuis 30 j + » de Tendances (vers Statistiques).

## Ce qui est ajouté
**Règles pures : `src/vendrePlus.js`** (exécuté par `scripts/audit-vendre-plus.cjs`, 10 mutations).
- `compteurLu` / `texteCompteur` : un compteur pas lu ⇒ `null` ⇒ « vues pas lues », jamais 0.
- `favorisSansVente(annonces, seuil 3/5/10, défaut 5)` : base EN LIGNE (donc pas vendue), favoris LUS
  ≥ seuil ; une offre LUE l'écarte ; offres pas lues ⇒ elle reste et c'est compté (`offresPasLues`).
  Favoris pas lus ⇒ dans aucune liste (`favorisPasLus`). Tri : favoris décroissants, puis identifiant.
  ⚠️ **Les offres reçues PAR ANNONCE ne sont lues nulle part** (les conversations captées s'arrêtent au
  29 oct., `src/statsOffres.js`) : l'écran le dit une fois, en tête (« Offres reçues par annonce : pas
  lues par VRM »). L'App passe `offres:null`.
- `gestesDormeuse` : les gestes qui EXISTENT, sur SON clic — Ajouter à Republier (l'atelier, la paire
  pré-choisie, rien n'est lancé), Baisser le prix (Republier « modifier » : il tape la baisse), Ouvrir
  sur Vinted (changer le prix lui-même), Préparer sur Leboncoin / eBay / Vestiaire (les écrans
  existants : `DEMANDE_LBC_FICHE`, `DEMANDE_EBAY_PAIRE`, `DEMANDE_VC_PAIRE`), Envoyer une offre aux
  favoris (Messages → Favoris reçus du compte de l'annonce, `demanderVue('favoris')`) **seulement si
  des favoris sont LUS** (> 0). Aucun geste ne porte un prix. Un geste bloqué dit pourquoi (version
  d'extension `EXT_CAPACITES`, lien pas lu, N° manquant).
- `classerSansConclureTropVite(D, 5)` : un groupe à moins de 5 ventes datées est MONTRÉ, jamais classé.
- `compteQuiVendLeMieux(comptes, 5)` : « X vend le plus » seulement à 5 ventes ou plus ET strictement
  devant le suivant ; égalité ou moins de 5 ⇒ rien (phrase « pas de meilleur compte »).
- `brutParCompte` / `cleBrutCompte` : le brut de `classementRapporte(lp, 'compte')` (LA règle du
  « Bénéfice brut », `src/beneficeNoms.js`) rangé par compte, couverture `nCout/n`.
- `cartePairesQuiDorment(stockDort, seuil)` : le nombre de Ma journée, depuis `stockQuiDort` (la base
  de la grille) ; 0, aucune date lue ou rien lu ⇒ pas de carte ; dates partielles ⇒ « Au moins ».

**Écrans** (aucun nouveau style global ; les classes `vrm-qd-*` de `src/design/outils-stats.css`) :
- Annonces → « À relancer » : un `Segmente` « Qui dorment · Favoris sans vente » (avec leurs nombres),
  seuil 30/60/90 j ou 3/5/10 favoris (confort de l'appareil : `vrm_qd_mode`, `vrm_qd_seuil_fav`).
  Chaque ligne dit « vues pas lues » / « favoris pas lus » au lieu de rien. La feuille « Agir » rend
  les gestes de `gestesDormeuse`, chacun avec une ligne qui dit ce qu'il fait. Le bouton « À relancer »
  paraît aussi quand seuls des favoris sans vente existent.
- Ma journée : la tâche `paires-dorment` (« 2 paires en ligne depuis 30 j ou plus », le mot de
  `motsArticle`) ⇒ Annonces → Qui dorment. Quand elle est là, la case « dort » de Tendances se tait
  (le même nombre jamais deux fois, §7).
- Statistiques : « Ce qui part vite » (ex-« Les modèles qui partent vite ») par Modèle · Marque (LUE
  sur l'annonce, `marqueLue`, jamais devinée du titre) · Taille · Compte ; la note « pas assez pour
  conclure » nomme les groupes à moins de 5 ventes datées. « Quel compte vend le mieux » : la règle
  du minimum, et sur chaque ligne Vinted « brut 140 € · 4 sur 6 » (`data-benef-notion="brut"`).
  Un site à plusieurs comptes (deux Leboncoin) ne reçoit pas de brut par compte (il n'en a qu'un commun).

## Bancs dont l'attente a changé (la règle a changé, pas un affaiblissement caché)
- `stats-vitrine` : le mois n'a que des groupes à 1–2 ventes datées ⇒ plus rien de classé (`rapides:''`).
- `ventes-par-compte` : 3 ventes contre 1 ⇒ plus de « vend le plus » (moins de 5).
- `emails-stats-clairs` : « vend le plus » attendu seulement à 5 ventes ou plus.
- `outils-stats` (D) : les gestes `republier,prix,vinted,lbc,ebay,vestiaire`.
- `audit-qui-dorment` : la branche « qui dorment » est toujours `articlesQuiDorment` (forme à 2 listes).

## Preuves
- `node scripts/audit-vendre-plus.cjs --prouve` : 30 contrôles, dont **50 annonces au même titre ⇒
  50 lignes, chacune par son identifiant**, aucune règle ne lit un titre ; 10/10 mutations rouges.
- `scripts/bancs/vendre-plus.cjs` (base inventée, 20 nov. 2026, 1512 et 390 tactile, clair et sombre) :
  À relancer (2 listes, pas lu, gestes, 50 au même titre), Ma journée, Statistiques (part vite par
  axe, meilleur compte, brut et couverture). **Rouge sur `origin/main`** (arbre `git archive`).
- Audits verts : variables, tdz, icones, boutons, violet, coherence, identite, statuts, enligne,
  qui-dorment, ce-qui-rapporte, stats-ventes, boost-rentable. `npm run build` vert.
- Captures : `/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/vendre-plus/`.

## Ce qui reste / à savoir
- Les offres reçues par annonce : à lire un jour (les conversations captées portent `offer_request_message`
  mais la capture s'est arrêtée et l'annonce n'y est pas projetée) — alors `favorisSansVente` les prendra
  (`offres` lu) sans autre changement.
- Aucun prix conseillé, aucun badge, aucune saisonnalité, aucun acheteur fidèle (refusés le 11 oct.).
- Geste de Julien : aucun (pas d'extension à réinstaller).
