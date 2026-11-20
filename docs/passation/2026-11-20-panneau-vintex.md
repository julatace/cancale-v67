# 20 nov. 2026 — Le panneau de l'extension « comme Vintex » (ext. 5.410.0, branche `claude/panneau-vintex`)

Julien, 20 nov. : « pour l'extension, tu fais pareil que Vintex ». Puis : « toute action doit être faite dans
l'extension, on ne doit plus pouvoir faire d'action dans l'app ».

## Ce qui change dans la 5.410.0 (une seule version, zips NON régénérés)

- **Mise en page** (`vrm-badge.js`, `vxHtml`) : le grand panneau occupe l'écran (12 px de marge), barre latérale fixe
  232 px (Général : Accueil ; le site : Articles · Commandes · Messagerie · Favoris · Notifications · Automatisations ;
  Paramètres en bas), réductible aux icônes (64 px, gardé dans `vrmPanneauReduit`) ; en-tête « Page · pastille du
  compte » + « Mis à jour il y a … ⟳ » (l'heure de la lecture de CE que la page montre, « Mettre à jour » sinon).
  Téléphone / Orion : la barre devient une rangée défilante en bas, les tableaux s'empilent (libellé devant chaque valeur).
- **Accueil** (`accueilHtml`) : compte de l'onglet et sa liaison à VRM, compte VRM et version, tuiles du jour (ventes
  du jour, à expédier en ambre, non lus, en vente — « — » si pas su), jauge, ce qui a été capté APRÈS le marqueur « vu ».
- **Articles** (`annoncesGrandHtml`) : « Choisir une action ▾ » (gestes par site), recherche, « Statut ▾ » à cases et
  compteurs (tous statuts cochés par défaut, comme Vintex), « N article(s) », liste/grille, « Colonnes ▾ » ; tableau :
  case, vignette 48, N° en plaque + titre, Prix, En ligne, Vues, Favoris, Statut en étiquette douce (brouillon ambre),
  ⋯ ; tri par en-tête.
- **Commandes** (`ventesGrandHtml`) : même barre, statut Vinted sous le titre (`statutVinted` lu par `carteListes`),
  transporteur avec SON logo (`transporteurCle`, logos recopiés de `src/transporteursVisuels.js` par
  `scripts/recopier-logos-extension.cjs`, `--verifie`), état en étiquette (« À expédier » ambre).
- **Messagerie** : avatar (photo Vinted ou initiale), pseudo, « il y a … · texte », vignette de l'article ; volet vide dessiné.
- **Automatisations** : deux volets — la liste (Activé / Désactivé) et le détail MESSAGES / CIBLAGE / DÉLAIS (textes
  lus : `automatisationsCarte.favoris.textes`), paliers avec aperçu 100 → … → plancher ; « Démarrer » (favoris) ouvre
  le parcours du panneau ; « Modifier dans VRM » reste pour les réglages.
- **Lien profond** (`lireLienPanneau`) : `https://www.vinted.fr/?vrm=panneau&page=<…>&ids=<…>&action=<…>` (pareil sur
  leboncoin.fr / vestiairecollective.com) ouvre le panneau à la page, sélection cochée, action PRÉ-choisie ;
  masquer/afficher arrivent sur la barre de confirmation ; RIEN ne part sans son toucher ; paramètres retirés de l'adresse.
  Contrat côté app : `src/ouvrirPanneau.js` — **le MÊME fichier, octet pour octet, que celui du chantier
  `claude/actions-extension`** (pas de conflit à la fusion) ; le lecteur comprend SON vocabulaire
  (`src/actionsExtension.js` : prix/changer|baisser|remettre, republier/republier|mettre-en-ligne|brouillon,
  publier/creer|publier, annonces/pause|supprimer, messages|offres/repondre, favoris/envoyer, automatisations/regler,
  vacances) et celui du panneau (articles, commandes, messagerie…). Une action n'est jamais FAITE : elle est
  pré-choisie dans « Choisir une action » quand ce geste y existe (« supprimer » ne l'est jamais). Tenu par
  `scripts/audit-lien-panneau.cjs` (lit `src/actionsExtension.js` s'il est là, sinon sa copie ; 9 mutations rouges).
- Capacités : `panneauvintex` (`vxHtml`), `lienpanneau` (`lireLienPanneau`) à 5.410.0 ; Quoi de neuf `panneau-vintex`.
- Garde-fous inchangés (`audit-actions-gardees` vert) : aucune nouvelle écriture dans `background.js`.

## Ce qui n'est PAS encore fait (dit honnêtement)

- Les boutons de l'app → `lienPanneau` : fait par le chantier `claude/actions-extension` (pas ici). Côté panneau, les
  pages `prix`, `republier`, `publier`, `offres`, `vacances` ouvrent l'onglet le plus proche (Articles, Messagerie,
  Paramètres) avec la sélection cochée ; une page dédiée par geste (saisie du prix, atelier Republier, publier) reste
  à construire dans le panneau. Le pilote du mode auto des favoris et la veille des republications programmées ne
  partent plus de l'app (actions-extension) : à porter par l'extension — pas fait dans ce lot.
- « Changer le prix » dans le panneau ouvre encore VRM pour la saisie du montant (le dépôt `cmd_prix_*` existe côté
  extension, l'interface de saisie dans le panneau reste à faire).


## Les réglages des automatisations écrits DEPUIS le panneau (Julien, 20 nov. : « les automatisations vivent dans l'extension »)

- **Clé retenue : la ligne dédiée `vrm_reglages_auto`** (une par compte VRM, comme `main` ; jamais `main` lui-même) :
  `{ v: 1, rev, at, par: 'extension'|'app', cles: { vinted_offres_auto, vinted_offre_refus_msg,
  vinted_offre_refus_variantes, vinted_offres_paliers, vinted_baisse_regle, vinted_cadence } }`.
- **Une seule règle de lecture** (`superposerReglagesAuto`, `src/reglagesAutoLigne.js`, bloc `<reglages-auto-ligne>`
  recopié dans background.js par `node scripts/audit-reglages-auto.cjs --recopie`) : une clé PRÉSENTE dans la ligne gagne
  sur `main` ; absente ⇒ `main` (les réglages d'avant restent valables) ; ligne illisible ⇒ `lireMain` rend null, le
  moteur ne fait rien.
- **Extension** : `lireMain` superpose la ligne dès qu'on lui demande une de ces clés (tous les moteurs passent par là) ;
  `reglageAutoCarte` (action `reglageAuto` du panneau) normalise (`reglageAutoNormalise` : bornes de l'écran de l'app,
  ALLUMER ⇒ `confirme`, éteindre immédiat), écrit par `modifierLigneCas` (comparer-et-échanger sur `rev`), relit, note au
  journal. Aucune requête vers Vinted.
- **App** : `appliquerReglagesAutoLigne` au chargement (après `markCloudReady`) et au retour sur l'onglet (après
  `relireNuage`) pose les valeurs de la ligne ; `save()` d'une de ces clés les recopie dans la ligne
  (`ecrireReglagesAutoLigne`). Le chantier `claude/actions-extension` (qui retire l'écran app) est prévenu de la clé.
- **Panneau · Automatisations** : offres auto (Allumer ⇒ « Oui, allumer » ; message de refus), négociation par paliers
  (paliers %, remise maximale, aperçu, allumer/éteindre), baisse par règle de CE compte (5/10/15 % après 7/14/30 j).
  Messages aux favoris : restent dans `vrm_favoris_reglages_{uid}` (ligne dédiée existante), « Modifier dans VRM » —
  pas encore écrits depuis le panneau. Vendue ailleurs ⇒ masquée n'a pas d'interrupteur (décision « 3 oui ») ;
  republication programmée : reste l'atelier — pas dans ce lot.
- Audit : `scripts/audit-reglages-auto.cjs` (vrais `lireMain` + `reglageAutoCarte` de background.js sur base en mémoire,
  règle de l'app ; `--mutation` 9/9 rouges).

## La cadence, SON réglage par compte (Julien, 20 nov. : « vas-y fais »)

- `vinted_cadence.comptes[uid]` dans la même ligne : messages aux favoris / h (défaut 15, 1–60), actions / h (défaut 50,
  10–100 ; la réserve de 5 reste), plafond par jour (absent = celui de « Discrétion », 200 ; 20–1000), pause entre deux
  messages (défaut 40–90 s, plage de 20 s à 4 min, toujours tirée au hasard, jamais deux fois la même). Plus vite que le
  défaut ⇒ « Oui, aller plus vite ». Paramètres du panneau : 5 curseurs + « Plus vite = plus de risque que Vinted
  restreigne le compte. »
- Moteur (`compterActionUn`) : plafond de l'heure = SA cadence (`cadenceCompte`, relue au plus une fois par minute,
  dernière lue sinon défauts), décalage de la réserve gardé, moitié quand les autres Chrome ne sont pas lus, captcha /
  Tout arrêter / prudence (20/h) / montée d'un compte neuf / plafond du jour inchangés. Favoris : `porteDiscretion` prend
  SA limite quand il l'a posée. Pause : envoyée avec `lancer` en plage (ms), validée par le serveur (`plageValide`,
  `api/_lib/favoris-file.js`) et tirée par `delaiRythme`.
- NON réglables : arrêt au captcha / refus + prudence 24 h, pause sur 403/429, un compte à la fois par ordinateur, une
  requête à la fois, compte de l'onglet, temps d'écriture.
- Audit : `scripts/audit-cadence.cjs` (vrai background.js : défauts 45 + 5, 60/h ⇒ 55 + 5, 61 favoris/h et 19 s refusés,
  captcha actif à 60/h, prudence 20/h même à 100, ligne illisible ⇒ défauts ; `--prouve` 7/7 rouges).

### Ligne « Plafond d'actions » de CLAUDE.md §3 proposée (à reporter par le coordinateur)

| **Plafond d'actions** | ⚠️⚠️ **50 actions/heure/compte PAR DÉFAUT (sa décision du 29 oct.), et depuis le 20 nov. (« vas-y fais ») SA CADENCE PAR COMPTE** dans Paramètres du panneau (5.410, `vinted_cadence` de `vrm_reglages_auto`) : actions/h 10–100, favoris/h 1–60 (déf. 15), plafond du jour (déf. Discrétion), pause entre messages 20 s–4 min toujours au hasard (déf. 40–90 s) ; plus vite ⇒ confirmation. `RESERVE_GESTES` = 5 reste ⇒ l'automatique s'arrête 5 avant ; une republication réserve ses 3 gestes. **Ne PAS changer les défauts sans qu'il le demande.** NON réglables : captcha/refus + prudence 24 h (20/h), pause 403/429, un compte à la fois, une requête à la fois, compte de l'onglet, temps d'écriture. Budget de LECTURE séparé (20/h). `audit-cadence`. |


## Ce que l'app ne fait plus, l'extension le porte (suite, après fusion de `claude/actions-extension`)

`origin/claude/actions-extension` est fusionné dans `claude/panneau-vintex` (vrai merge ; CLAUDE.md §9 et Quoi de neuf :
les deux lignes gardées). L'app ne fait plus aucun geste ; dans la 5.410.0 l'extension porte :

- **Le pilote du mode auto des favoris** (`piloteFavorisTick`, alarme `vrm-relais`) : le tour de l'app d'avant
  (`tourPiloteFavoris`), dans le fond : intervalle tiré au hasard 2–5 min, compte de l'ONGLET seulement
  (`compteOngletPourAuto`), mode auto relu chez VRM toutes les 30 min, gardes d'abord (`attenteAvantFavori` : discrétion,
  SA cadence, plafonds, réserve, captcha ⇒ arrêt, Tout arrêter), puis `auto` → `suivant` → `/vrm/favoris` → `terminer`.
  Une file de la carte en cours ⇒ il attend. État : `chrome.storage.local` `vrmPiloteFavoris`.
- **La veille des republications programmées** (`veilleRepubTick`, même alarme) : l'index léger d'abord
  (`attentes`, jamais `select=data` pour rien), puis la RÈGLE DE L'APP recopiée (`decision`, `conditionsDepart`,
  `prendreDepart`, `marquerPasPartie`, `marquerFinie`, `pairesAuDepart`, `apercuRepub`) : à SON heure (fenêtre 10 min),
  conditions mesurées ici (onglet, compte, frein de Vinted, place dans l'heure, 50 republications du jour, autre
  travail) ; une seule manque ⇒ « pas partie » avec la raison ; sinon départ PRIS (comparer-et-échanger) et les paires
  partent dans SON ordre par `executerCommande` (coffre → brouillon → suppression → mise en ligne, gardes comprises), avec
  SES réglages (titre, prix jamais sous l'achat, lettre). ⚠️ Réglages PHOTO non neutres : le fond ne retouche pas une
  photo ⇒ « pas partie (photo) », dit — à lancer depuis le panneau.
- **Les 3 gardes d'avant SON clic**, recopiées par `scripts/recopier-gardes-extension.cjs` (esbuild, bloc
  `<gardes-app>` de background.js, `--verifie`), jamais réécrites à la main, posées AU POINT D'EXÉCUTION (aucun appelant
  ne peut les sauter) :
  1. accepter une offre (`executerPourAppCoeur`, `…/offer_requests/{id}/accept`) : `avisAcceptationManuelle` — vendue
     ailleurs ⇒ refusé toujours ; « pas su » ⇒ `code: 'avis'`, seul son second toucher (`avisVu`) fait partir ;
  2. publier (`publierFicheSite`) : `problemesAnnonce` (+ `photosExigeesVc` pour Vestiaire) ⇒ `code: 'verification'`,
     seul `verifVu` publie quand même ;
  3. supprimer sur Leboncoin (`supprimeLbcDepuisApp`) : sans `sansRetour` ⇒ `code: 'sans-retour'` + la confirmation de
     l'app (`confirmationSupprimerLbc`, src/actionsExtensionGardes.js, le texte de `supprimerLbcJournee`).
  Le panneau : Articles sur leboncoin.fr → « Supprimer de Leboncoin » (une annonce) montre cette confirmation, puis
  « Oui, supprimer de Leboncoin ».
- **Les réglages des messages aux favoris écrits depuis le panneau** : textes (message + 4 versions) et rythme dans
  LEUR ligne dédiée `vrm_favoris_reglages_{uid}` (celle que le serveur relit à chaque envoi et au mode auto — la mettre
  aussi dans `vrm_reglages_auto` aurait créé deux vérités), validés par la règle de l'app recopiée
  (`validerReglagesFavoris`) ; le MODE AUTO (allumé, horaires, quotas) par `auto_regler` du serveur (validé par
  `validerAutoFavoris` des deux côtés), allumer ⇒ « Oui, allumer ».
- Audit : `scripts/audit-extension-porte-app.cjs` (vrai background.js, 26 contrôles ; `--prouve` 11 mutations).

### Ce qui reste (dit honnêtement)
- Panneau : pas encore d'écran pour ACCEPTER une offre ni pour PUBLIER une fiche (les gardes sont au point d'exécution,
  prêtes) ; « Baisser » et « Republier » du menu Articles ouvrent encore vrm.center — or l'app renvoie maintenant au
  panneau : il faut une saisie de prix et l'atelier Republier DANS le panneau (prochain lot, avant l'intégration).
- Republication programmée avec réglages photo : « pas partie » (le fond ne retouche pas d'image).

## Preuves

- Bancs : `scripts/bancs/grand-panneau.cjs` (251 contrôles : 1512 clair/sombre, 1280, 390 clair/sombre, Orion émulé,
  base vide, 4 liens profonds), `grand-panneau-sites.cjs` (80 : Leboncoin, Vestiaire, 1512/390, clair/sombre).
- Audits verts : coherence, traduction, tdz, variables, extension-feuille, actions-gardees, quoi-de-neuf,
  carte-listes, panneau-carte, lien-panneau (--mutation), recopier-logos --verifie ; build OK.
- Planches côte à côte avec les captures Vintex : hors dépôt (bloc-notes de la session).
