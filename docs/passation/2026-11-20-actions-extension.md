# 20 nov. · « Toute action se fait dans l'extension » (branche `claude/actions-extension`)

**Décision de Julien (20 nov.)** : « Toute action doit être faite dans l'extension, on ne doit plus pouvoir faire d'action dans
l'app » ; précision : « les automatisations ne doivent pas forcément être dans l'application mais plutôt dans l'extension ».
Lecture retenue : `docs/passation/2026-11-19-demandes-julien.md` (fin). L'app MONTRE (prix, réglages lus, journal, progression)
et chaque ancien geste sur Vinted / Leboncoin / Vestiaire devient UN bouton « … dans l'extension » qui ouvre le PANNEAU de
l'extension sur le site : `lienPanneau({ site, page, ids, action })` → `https://www.vinted.fr/?vrm=panneau&page=…&ids=…&action=…`
(`src/ouvrirPanneau.js`, format partagé avec `claude/panneau-vintex`). Sans extension ici (iPhone Safari), la même URL ouvre le
site (Orion porte l'extension) et une phrase discrète dit « s'ouvre sur Vinted avec l'extension ».

Restent dans l'app : prix d'achat / prix mini / N°, ranger, relier, imprimer les bordereaux reçus (et les générer : autorisé,
§3), compta, réglages de l'app, **eBay** (API serveur : « Changer le prix » coche et applique eBay seul, « Publier partout » garde
la case eBay), « Tout arrêter » (arrêt d'urgence : éteindre ne fait aucun geste sur un site).

## Les pièces
- `src/actionsExtension.js` — `ACTIONS_EXTENSION` (15 gestes : page + action du panneau + libellé), `CMDS_PLATEFORME` (21 commandes
  d'extension qui agissent), `refusPanneau`. **Le pont refuse** : `vmrCmd` (commande de la liste), `vmrExec` et `vmrExecUn`
  (toute méthode ≠ GET, relais compris) rendent `{ accepte:false, envoye:false, code:'panneau' }` — défense en profondeur
  derrière les écrans, qui ne les envoient plus.
- `src/BoutonExtension.jsx` — `BoutonExtension`, `RangeeExtension`, `FeuilleExtension` (l'état en lecture + UN plein).
- `src/automatisationsEtat.js` — le nombre d'automatisations actives, LU (offres auto, baisse par règle, paliers).
- Retirés (fichiers supprimés) : CreerSurVinted, LbcBaissePrix, BaissePrixSerie, BaissePrixVestiaire, ModeVacances,
  NegociationPaliers, PiloteFavorisAuto, FavorisVinted (+ AutomatisationFavoris, ModeAutoFavoris, FavorisEtapes,
  FavorisListeCompte, FavorisSansVente, DiagnosticFavoris), l'écran Automatisations (`src/automatisations/Branchement.jsx`,
  `src/natif/ecrans/Automatisations.jsx`) ; dans les écrans : fiche et atelier « Republier sur Leboncoin », composer des
  réponses (Vinted, Leboncoin, Vestiaire), gestes d'offre (Vinted, Vestiaire), feuilles Republier / Brouillons / File, veille
  des republications programmées. Règles GARDÉES (l'extension les recopie ou les écrans les lisent) : `reglesAuto.js`,
  `negociationPaliers.js`, `prixPartout.js`, `prixAttente.js`, `soldes.js`, `publier/agent.js`.
- **Automatisations** : plus d'écran, plus d'entrée Annonces ; Paramètres → une rangée « Automatisations · dans l'extension »
  (`page: 'automatisations'`), « N actives » à droite. Un ancien lien `?tab=automatisations` montre la feuille qui ouvre le
  panneau. Clé retenue par `claude/panneau-vintex` (ext. 5.410) pour les réglages écrits depuis le panneau : la ligne dédiée
  `app_data` **`vrm_reglages_auto`** (`{ v:1, rev, at, par, cles:{ vinted_offres_auto, vinted_offre_refus_msg,
  vinted_offre_refus_variantes, vinted_offres_paliers, vinted_baisse_regle, vinted_cadence } }`, lue par
  `superposerReglagesAuto(main, ligne)`, `src/reglagesAutoLigne.js`, jamais `main`). Ce chantier n'écrit aucun réglage ;
  `automatisationsActives` lit les clés par `load` — après la fusion de 5.410, l'app y superpose la ligne
  (`appliquerReglagesAutoLigne`), le compte reste juste. Messages aux favoris : `vrm_favoris_reglages_{uid}` (inchangé).
- ⚠️ Changement de comportement à connaître : le **mode automatique des favoris** et les **republications programmées** ne
  partent plus de l'app ouverte (pilote et veille retirés) — à porter par l'extension (`claude/panneau-vintex`).

## Preuves
- `node scripts/audit-actions-app.cjs` (24 contrôles) · `--mutation` : 12 mutations, toutes rouges (bouton remis, commande
  retirée du registre, refus du pont retiré, atelier remis/remonté, écran Automatisations remonté, lien changé, commande
  d'extension nouvelle non classée…) · `--arbre <origin/main>` : 20 rouges sur l'arbre d'avant.
- `scripts/bancs/actions-extension.cjs` (390 tactile + 1512, vrais composants) : les 23 anciens gestes portent et ouvrent le
  bon lien (page, ids, action écrits dans le banc), phrase sans extension, eBay seul appliqué dans « Changer le prix »,
  onglet refusé au téléphone ⇒ même URL dans la page. 28 verts. Captures regardées.
- Audits traduction, tdz, variables, coherence, identite, quoi-de-neuf : verts. Inventaire : `node scripts/inventaire-actions-app.cjs`.

## Inventaire — AVANT (origin/main)
| geste | écran | chemin | fichier:ligne (fonction) | tests |
|---|---|---|---|---|
| offre aux « aimés » (Vestiaire) | Vestiaire (publier, prix, répondre, offres) | commande vcOffreAimes | src/AimesVestiaire.jsx:28 (lancer) | audit-favoris-sites.cjs, bancs/deux-comptes.cjs |
| mettre un brouillon en ligne | Annonces → Republier / Brouillons (atelier) | commande publierBrouillon | src/App.jsx:4747 (publier) | audit-actions-gardees.cjs, audit-annulees-chez-toi.cjs, audit-coherence.cjs, audit-recreer.cjs, audit-republication-parfaite.cjs, bancs/annonces-actions.cjs |
| changer un prix (en attente) | Fiche → « Changer le prix » (feuille Prix partout) | ligne cmd_prix_* rangée pour l'extension | src/App.jsx:19372 (envoisPrixVrm) | — |
| baisse par règle | Fiche → « Changer le prix » (feuille Prix partout) | réglage REGLE_CLE | src/App.jsx:19475 (onRegle) | — |
| messages aux favoris | Messages → Favoris (messages aux favoris, mode auto) | écriture brute /vrm/favoris | src/App.jsx:22963 (PiloteFavorisAutoConnecte) | — |
| écriture Vinted | App.jsx · executer | écriture brute  | src/App.jsx:23006 (executer) | — |
| publier sur Leboncoin | Annonces → Publier partout | commande lbcPublier | src/App.jsx:28081 (HotePublierPartout) | audit-confiance.cjs, audit-lbc-fiche.cjs, audit-plateformes-logo.cjs, audit-pont-session.cjs, audit-publier-app.cjs, audit-publier-partout.cjs |
| publier sur Vestiaire | Annonces → Publier partout | commande vcPreparer | src/App.jsx:28093 (HotePublierPartout) | audit-publier-partout.cjs, audit-vc-publier.cjs, audit-verif-annonce.cjs, audit-vestiaire-plus.cjs, bancs/publier-partout.cjs, bancs/vc-publier.cjs |
| supprimer (Leboncoin) | Ma journée / À retirer ailleurs → Supprimer de Leboncoin | commande lbcSupprime | src/App.jsx:35191 (supprimerLbcJournee) | audit-actions-gardees.cjs, audit-lbc-supprimer.cjs, audit-publier-partout.cjs, audit-retirer-ailleurs.cjs, audit-securite-comptes.cjs, bancs/a-retirer-ailleurs.cjs |
| message de refus auto | Messages → Offres auto | réglage vinted_offre_refus_msg | src/App.jsx:36555 (ecrireRefusMsg) | — |
| message de refus auto | Messages → Offres auto | réglage vinted_offre_refus_msg | src/App.jsx:36556 (Comptabilite) | — |
| variantes du refus | Messages → Offres auto | réglage vinted_offre_refus_variantes | src/App.jsx:36563 (changerRefusVariantes) | — |
| allumer / éteindre les offres auto | Messages → Offres auto | réglage vinted_offres_auto | src/App.jsx:36565 (basculerOffresAuto) | — |
| allumer / éteindre les offres auto | Messages → Offres auto | réglage vinted_offres_auto | src/App.jsx:36568 (basculerOffresAuto) | — |
| refaire un brouillon | Annonces → Republier / Brouillons (atelier) | commande refaireBrouillon (choisie) | src/App.jsx:38431 (refaireBrouillon) | audit-coherence.cjs, audit-recreer.cjs, bancs/republier.cjs |
| répondre (Vinted) | Messages → Vinted (répondre) | écriture brute /api/v2/conversations/${oc.convId}/replies | src/App.jsx:43755 (sendReply) | — |
| accepter / refuser / contre-offre (Vinted) | Messages → Vinted (offre reçue) | écriture brute offer_requests (accept/reject/offre) | src/App.jsx:43801 (actionOffre) | — |
| allumer / éteindre les offres auto | Messages → Offres auto | réglage vinted_offres_auto | src/App.jsx:55951 (Comptabilite) | — |
| messages aux favoris | Messages → Favoris (messages aux favoris, mode auto) | écriture brute /vrm/favoris | src/App.jsx:55960 (Comptabilite) | — |
| changer / baisser un prix Vinted | Annonces → Actions → Baisser le prix (série) | commande baisserPrixVinted | src/App.jsx:59911 (Comptabilite) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-argent-prix.cjs, audit-baisse-conseillee.cjs, audit-baisse-prix.cjs, audit-coherence.cjs |
| baisse programmée Vinted | Annonces → Actions → Baisser le prix (série) | commande planifierBaisses | src/App.jsx:59922 (Comptabilite) | audit-discretion.cjs |
| annuler une baisse programmée | Annonces → Actions → Baisser le prix (série) | commande annulerBaisses | src/App.jsx:59923 (Comptabilite) | audit-discretion.cjs |
| mettre un brouillon en ligne | Annonces → Republier / Brouillons (atelier) | commande publierBrouillon | src/App.jsx:59970 (Comptabilite) | audit-actions-gardees.cjs, audit-annulees-chez-toi.cjs, audit-coherence.cjs, audit-recreer.cjs, audit-republication-parfaite.cjs, bancs/annonces-actions.cjs |
| republier (recréer) | Annonces → Republier / Brouillons (atelier) | commande recreerVinted | src/App.jsx:60007 (publierR) | audit-actions-gardees.cjs, audit-annulees-chez-toi.cjs, audit-coherence.cjs, audit-confiance-publique.cjs, audit-photo-vrm.cjs, audit-prix-mini.cjs |
| reprendre une republication | Annonces → Republier / Brouillons (atelier) | commande reprendreRepub | src/App.jsx:60025 (Comptabilite) | audit-coherence.cjs, audit-republication-parfaite.cjs |
| modifier sur place / republier | Annonces → Republier / Brouillons (atelier) | commande republierVinted | src/App.jsx:60040 (publierModif) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-coherence.cjs, audit-recreer.cjs, audit-republier.cjs, audit-securite-comptes.cjs |
| republier (recréer) | Annonces → Republier / Brouillons (atelier) | commande recreerVinted | src/App.jsx:60050 (publierVersB) | audit-actions-gardees.cjs, audit-annulees-chez-toi.cjs, audit-coherence.cjs, audit-confiance-publique.cjs, audit-photo-vrm.cjs, audit-prix-mini.cjs |
| mettre un brouillon en ligne | Annonces → Republier / Brouillons (atelier) | commande publierBrouillon | src/App.jsx:60060 (publierEnLigne) | audit-actions-gardees.cjs, audit-annulees-chez-toi.cjs, audit-coherence.cjs, audit-recreer.cjs, audit-republication-parfaite.cjs, bancs/annonces-actions.cjs |
| modifier sur place / republier | Annonces → Republier / Brouillons (atelier) | commande republierVinted | src/App.jsx:60109 (publierReel) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-coherence.cjs, audit-recreer.cjs, audit-republier.cjs, audit-securite-comptes.cjs |
| supprimer (Leboncoin) | Ma journée / À retirer ailleurs → Supprimer de Leboncoin | commande lbcSupprime | src/App.jsx:61317 (retirerUnSiteRA) | audit-actions-gardees.cjs, audit-lbc-supprimer.cjs, audit-publier-partout.cjs, audit-retirer-ailleurs.cjs, audit-securite-comptes.cjs, bancs/a-retirer-ailleurs.cjs |
| messages aux favoris (file serveur / mode auto) | Messages → Favoris (messages aux favoris, mode auto) | /api/compte?mode=favoris (POST) | src/AutomatisationFavoris.jsx:59 (api) | bancs/favoris-clair.cjs, tests/favoris-automatisation-interface.cjs |
| Créer sur Vinted | À publier → Créer sur Vinted / Publier sur… | commande creerVintedFiche | src/CreerSurVinted.jsx:166 (executerUn) | audit-annonce-vinted.cjs, audit-coherence.cjs, audit-confort-securite.cjs, audit-extension-restes.cjs, audit-morceau-app.cjs, audit-politique-hotes.cjs |
| changer un prix Leboncoin | Annonces → Actions → Baisser | commande lbcPrix | src/LbcBaissePrix.jsx:53 (onBaisser) | audit-actions-gardees.cjs, audit-donnees-ecrans.cjs, audit-lbc-plus.cjs, audit-prix-attente.cjs, audit-securite-comptes.cjs, bancs/lbc-plus.cjs |
| messages aux favoris (file serveur / mode auto) | Messages → Favoris (messages aux favoris, mode auto) | /api/compte?mode=favoris (POST) | src/ModeAutoFavoris.jsx:29 (api) | audit-stockage-sur.cjs |
| mode vacances | Réglages → Mode vacances | commande vacancesVinted | src/ModeVacances.jsx:109 (lancer) | audit-actions-gardees.cjs, audit-extension-5340.cjs, audit-mode-vacances.cjs, audit-politique-hotes.cjs, audit-suivi-travail.cjs, bancs/mode-vacances.cjs |
| négociation par paliers | Messages → Offres auto | réglage CLE_PALIERS | src/NegociationPaliers.jsx:17 (ecrire) | — |
| messages aux favoris (file serveur / mode auto) | Messages → Offres auto | /api/compte?mode=favoris (POST) | src/OffresAuto.jsx:121 (toutArreter) | audit-offres-sures.cjs, audit-prix-mini-manquants.cjs, audit-traduction.cjs, audit-vocabulaire-article.cjs |
| offre / contre-offre (Vestiaire) | Vestiaire (publier, prix, répondre, offres) | commande vcOffre | src/OffresVestiaire.jsx:36 (faire) | audit-actions-gardees.cjs, audit-favoris-sites.cjs, audit-offres-expirent.cjs, audit-politique-hotes.cjs, audit-traduction.cjs, audit-vc-offres.cjs |
| messages aux favoris (file serveur / mode auto) | Messages → Favoris (messages aux favoris, mode auto) | /api/compte?mode=favoris (POST) | src/PiloteFavorisAuto.jsx:71 (api) | — |
| messages aux favoris (file serveur / mode auto) | Paramètres → Automatisations | /api/compte?mode=favoris (POST) | src/automatisations/Branchement.jsx:102 (BranchementAutomatisations) | — |
| message de refus auto | Paramètres → Automatisations | réglage vinted_offre_refus_msg | src/automatisations/Branchement.jsx:151 (enregistrerOffres) | — |
| variantes du refus | Paramètres → Automatisations | réglage vinted_offre_refus_variantes | src/automatisations/Branchement.jsx:151 (enregistrerOffres) | — |
| négociation par paliers | Paramètres → Automatisations | réglage CLE_PALIERS | src/automatisations/Branchement.jsx:156 (enregistrerOffres) | — |
| allumer / éteindre les offres auto | Paramètres → Automatisations | réglage vinted_offres_auto | src/automatisations/Branchement.jsx:174 (BranchementAutomatisations) | — |
| allumer / éteindre les offres auto | Paramètres → Automatisations | réglage vinted_offres_auto | src/automatisations/Branchement.jsx:175 (BranchementAutomatisations) | — |
| baisse par règle | Paramètres → Automatisations | réglage REGLE_CLE | src/automatisations/Branchement.jsx:231 (poserRegle) | — |
| mettre en pause (Leboncoin) | Annonces (natif) → Actions → Pause Leboncoin | commande lbcPause | src/ecrans/AnnoncesEgalite.jsx:188 (pauserLbc) | audit-actions-gardees.cjs, audit-extension-moyennes.cjs, audit-lbc-plus-vue-pause.cjs, audit-lbc-supprimer.cjs, audit-publier-agent.cjs, bancs/a-retirer-ailleurs.cjs |
| publier sur Leboncoin | Leboncoin (publier, republier, pause, supprimer) | commande lbcPublier | src/ecrans/Leboncoin.jsx:255 (envoyer) | _source-app.cjs, audit-annuler-commandes.cjs, audit-anti-arnaque.cjs, audit-confiance.cjs, audit-envoi-fil.cjs, audit-favoris-sites.cjs |
| supprimer (Leboncoin) | Leboncoin (publier, republier, pause, supprimer) | commande lbcSupprime | src/ecrans/Leboncoin.jsx:1096 (lancer) | _source-app.cjs, audit-actions-gardees.cjs, audit-annuler-commandes.cjs, audit-anti-arnaque.cjs, audit-envoi-fil.cjs, audit-favoris-sites.cjs |
| publier sur Leboncoin | Leboncoin (publier, republier, pause, supprimer) | commande lbcPublier | src/ecrans/Leboncoin.jsx:1111 (lancer) | _source-app.cjs, audit-annuler-commandes.cjs, audit-anti-arnaque.cjs, audit-confiance.cjs, audit-envoi-fil.cjs, audit-favoris-sites.cjs |
| mettre en pause (Leboncoin) | Leboncoin (publier, republier, pause, supprimer) | commande lbcPause | src/ecrans/Leboncoin.jsx:1872 (mettreEnPause) | _source-app.cjs, audit-actions-gardees.cjs, audit-annuler-commandes.cjs, audit-anti-arnaque.cjs, audit-envoi-fil.cjs, audit-extension-moyennes.cjs |
| supprimer (Leboncoin) | Leboncoin (publier, republier, pause, supprimer) | commande lbcSupprime | src/ecrans/Leboncoin.jsx:1905 (supprimerSurLbc) | _source-app.cjs, audit-actions-gardees.cjs, audit-annuler-commandes.cjs, audit-anti-arnaque.cjs, audit-envoi-fil.cjs, audit-favoris-sites.cjs |
| répondre (Leboncoin) | Messages → Leboncoin (répondre) | commande lbcRepondre | src/ecrans/MessagesLeboncoin.jsx:59 (envoyer) | _source-app.cjs, audit-actions-gardees.cjs, audit-anti-arnaque.cjs, audit-envoi-fil.cjs, audit-extension-moyennes.cjs, audit-favoris-sites.cjs |
| changer un prix Vestiaire | Vestiaire (publier, prix, répondre, offres) | commande vcPrix | src/ecrans/Vestiaire.jsx:347 (AnnoncesVestiaire) | audit-actions-gardees.cjs, audit-anti-arnaque.cjs, audit-compta-donnees.cjs, audit-envoi-fil.cjs, audit-favoris-sites.cjs, audit-frais-vestiaire.cjs |
| publier sur Vestiaire | Vestiaire (publier, prix, répondre, offres) | commande vcPreparer | src/ecrans/Vestiaire.jsx:550 (preparer) | audit-anti-arnaque.cjs, audit-compta-donnees.cjs, audit-envoi-fil.cjs, audit-favoris-sites.cjs, audit-frais-vestiaire.cjs, audit-message-sur.cjs |
| répondre (Vestiaire) | Vestiaire (publier, prix, répondre, offres) | commande vcRepondre | src/ecrans/Vestiaire.jsx:969 (envoyer) | audit-actions-gardees.cjs, audit-anti-arnaque.cjs, audit-compta-donnees.cjs, audit-envoi-fil.cjs, audit-favoris-sites.cjs, audit-frais-vestiaire.cjs |
| changer / baisser un prix Vinted | Fiche → « Changer le prix » (feuille Prix partout) | commande baisserPrixVinted | src/prixAttente.js:75 (prixAttCommande) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-argent-prix.cjs, audit-baisse-conseillee.cjs, audit-baisse-prix.cjs, audit-coherence.cjs |
| changer un prix Leboncoin | Fiche → « Changer le prix » (feuille Prix partout) | commande lbcPrix | src/prixAttente.js:79 (prixAttCommande) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-donnees-ecrans.cjs, audit-lbc-plus.cjs, audit-prix-attente.cjs, audit-securite-comptes.cjs |
| changer un prix Vestiaire | Fiche → « Changer le prix » (feuille Prix partout) | commande vcPrix | src/prixAttente.js:82 (prixAttCommande) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-prix-attente.cjs, audit-securite-comptes.cjs, audit-vc-prix.cjs, bancs/prix-sans-manuel.cjs |
| changer / baisser un prix Vinted | Fiche → « Changer le prix » (feuille Prix partout) | commande baisserPrixVinted | src/prixPartout.js:247 (envoisPrix) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-argent-prix.cjs, audit-baisse-conseillee.cjs, audit-baisse-prix.cjs, audit-coherence.cjs |
| changer un prix Leboncoin | Fiche → « Changer le prix » (feuille Prix partout) | commande lbcPrix | src/prixPartout.js:248 (envoisPrix) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-donnees-ecrans.cjs, audit-lbc-plus.cjs, audit-politique-hotes.cjs, audit-prix-attente.cjs |
| changer un prix Vestiaire | Fiche → « Changer le prix » (feuille Prix partout) | commande vcPrix | src/prixPartout.js:249 (envoisPrix) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-politique-hotes.cjs, audit-prix-attente.cjs, audit-publier-partout.cjs, audit-securite-comptes.cjs |
| Créer sur Vinted | À publier → Créer sur Vinted / Publier sur… | commande creerVintedFiche | src/publier/agent.js:377 (envoiPour) | audit-annonce-vinted.cjs, audit-coherence.cjs, audit-publier-agent.cjs, audit-revue-fin.cjs, audit-securite-comptes.cjs, bancs/annonce-vinted.cjs |
| Publier sur… (agent) | À publier → Créer sur Vinted / Publier sur… | commande publierFiche | src/publier/agent.js:382 (envoiPour) | audit-coherence.cjs, audit-publier-agent.cjs, audit-revue-fin.cjs, bancs/publier-agent.cjs |
| Publier sur… (agent) | À publier → Créer sur Vinted / Publier sur… | commande publierFiche | src/publier/agent.js:387 (envoiPour) | audit-coherence.cjs, audit-publier-agent.cjs, audit-revue-fin.cjs, bancs/publier-agent.cjs |
| changer / baisser un prix Vinted | Argent → Soldes → Remettre les prix | commande baisserPrixVinted | src/soldes.js:120 (commandeRemise) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-argent-prix.cjs, audit-baisse-conseillee.cjs, audit-baisse-prix.cjs, audit-coherence.cjs |
| changer un prix Leboncoin | Argent → Soldes → Remettre les prix | commande lbcPrix | src/soldes.js:121 (commandeRemise) | audit-actions-gardees.cjs, audit-argent-prix.cjs, audit-donnees-ecrans.cjs, audit-lbc-plus.cjs, audit-prix-attente.cjs, audit-securite-comptes.cjs |
| changer un prix Vestiaire | Argent → Soldes → Remettre les prix | commande vcPrix | src/soldes.js:122 (commandeRemise) | audit-actions-gardees.cjs, audit-argent-prix.cjs, audit-prix-attente.cjs, audit-securite-comptes.cjs, audit-vc-prix.cjs, bancs/prix-sans-manuel.cjs |

## Inventaire — APRÈS (restent : règles partagées, jamais envoyées — le pont refuserait — et l'arrêt d'urgence)
| geste | écran | chemin | fichier:ligne (fonction) | tests |
|---|---|---|---|---|
| allumer / éteindre les offres auto | Messages → Offres auto | réglage vinted_offres_auto | src/App.jsx:55718 (Comptabilite) | — |
| messages aux favoris (file serveur / mode auto) | Messages → Offres auto | /api/compte?mode=favoris (POST) | src/OffresAuto.jsx:119 (toutArreter) | audit-offres-sures.cjs, audit-prix-mini-manquants.cjs, audit-traduction.cjs, audit-vocabulaire-article.cjs |
| changer / baisser un prix Vinted | Fiche → « Changer le prix » (feuille Prix partout) | commande baisserPrixVinted | src/prixAttente.js:75 (prixAttCommande) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-argent-prix.cjs, audit-baisse-conseillee.cjs, audit-baisse-prix.cjs, audit-coherence.cjs |
| changer un prix Leboncoin | Fiche → « Changer le prix » (feuille Prix partout) | commande lbcPrix | src/prixAttente.js:79 (prixAttCommande) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-donnees-ecrans.cjs, audit-lbc-plus.cjs, audit-prix-attente.cjs, audit-securite-comptes.cjs |
| changer un prix Vestiaire | Fiche → « Changer le prix » (feuille Prix partout) | commande vcPrix | src/prixAttente.js:82 (prixAttCommande) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-prix-attente.cjs, audit-securite-comptes.cjs, audit-vc-prix.cjs, bancs/prix-sans-manuel.cjs |
| changer / baisser un prix Vinted | Fiche → « Changer le prix » (feuille Prix partout) | commande baisserPrixVinted | src/prixPartout.js:247 (envoisPrix) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-argent-prix.cjs, audit-baisse-conseillee.cjs, audit-baisse-prix.cjs, audit-coherence.cjs |
| changer un prix Leboncoin | Fiche → « Changer le prix » (feuille Prix partout) | commande lbcPrix | src/prixPartout.js:248 (envoisPrix) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-donnees-ecrans.cjs, audit-lbc-plus.cjs, audit-politique-hotes.cjs, audit-prix-attente.cjs |
| changer un prix Vestiaire | Fiche → « Changer le prix » (feuille Prix partout) | commande vcPrix | src/prixPartout.js:249 (envoisPrix) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-politique-hotes.cjs, audit-prix-attente.cjs, audit-publier-partout.cjs, audit-securite-comptes.cjs |
| Créer sur Vinted | À publier → Créer sur Vinted / Publier sur… | commande creerVintedFiche | src/publier/agent.js:377 (envoiPour) | audit-annonce-vinted.cjs, audit-coherence.cjs, audit-publier-agent.cjs, audit-revue-fin.cjs, audit-securite-comptes.cjs, bancs/annonce-vinted.cjs |
| Publier sur… (agent) | À publier → Créer sur Vinted / Publier sur… | commande publierFiche | src/publier/agent.js:382 (envoiPour) | audit-coherence.cjs, audit-publier-agent.cjs, audit-revue-fin.cjs, bancs/publier-agent.cjs |
| Publier sur… (agent) | À publier → Créer sur Vinted / Publier sur… | commande publierFiche | src/publier/agent.js:387 (envoiPour) | audit-coherence.cjs, audit-publier-agent.cjs, audit-revue-fin.cjs, bancs/publier-agent.cjs |
| changer / baisser un prix Vinted | Argent → Soldes → Remettre les prix | commande baisserPrixVinted | src/soldes.js:120 (commandeRemise) | audit-actions-gardees.cjs, audit-annonces-outils.cjs, audit-argent-prix.cjs, audit-baisse-conseillee.cjs, audit-baisse-prix.cjs, audit-coherence.cjs |
| changer un prix Leboncoin | Argent → Soldes → Remettre les prix | commande lbcPrix | src/soldes.js:121 (commandeRemise) | audit-actions-gardees.cjs, audit-argent-prix.cjs, audit-donnees-ecrans.cjs, audit-lbc-plus.cjs, audit-prix-attente.cjs, audit-securite-comptes.cjs |
| changer un prix Vestiaire | Argent → Soldes → Remettre les prix | commande vcPrix | src/soldes.js:122 (commandeRemise) | audit-actions-gardees.cjs, audit-argent-prix.cjs, audit-prix-attente.cjs, audit-securite-comptes.cjs, audit-vc-prix.cjs, bancs/prix-sans-manuel.cjs |
