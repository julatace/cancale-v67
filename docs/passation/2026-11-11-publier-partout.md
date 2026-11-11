# « Publier partout » depuis l'annonce Vinted — 11 nov. 2026 (branche `claude/publier-partout`)

Demande de Julien (validée) : « Publier partout en un geste — mais ça doit PARTIR DE L'ANNONCE VINTED ».
L'annonce Vinted est la source ; VRM la reporte sur Leboncoin, Vestiaire et eBay avec LEURS champs.
**Aucun changement d'extension** (aucune version réservée). Aucune PR, aucune fusion.

## Ce qui est construit
- **`src/publierPartout.js`** (règle PURE) : prix par site (`vrm_partout_prix`, SYNC_KEYS ; égal par défaut,
  ± € / ± %, ≤ 0 ⇒ rien ; Vestiaire jamais réglé : `vcPreparer` part du prix Vinted, c'est dit) ; vocabulaire
  (état Vinted → mot Leboncoin `LBC_ETATS` ou id eBay 1000/1500/3000, sinon DEMANDÉ ; catégorie : Leboncoin
  `categorieLbcDe`, eBay « suggérée au départ », Vestiaire « à choisir sur Vestiaire ») ; `lignePartout`
  (manques de `manquesEnvoi`, prix pas lu / état Leboncoin inconnu ⇒ demandés et bloquants ; « déjà en ligne »
  par identité ⇒ pas de case ; liste pas lue ⇒ cochable mais jamais cochée d'office) ; `planPartout` (site par
  site, rien sans N° ni référence) ; `executerPartout` (l'un après l'autre : chaque dépôt attend la FIN du
  précédent — l'extension n'a qu'UN dépôt en attente par site, `vrmPendingAd`/`vrmPendingVc` ; dépôt pas fini
  ⇒ « à finir sur le site » et ce site s'arrête ; refus plafond/pause/429 ⇒ ce site s'arrête ; eBay ⇒ toujours
  « à finir », jamais « publié ») ; `aussiSur` (pastilles prouvées seulement).
- **`src/PublierPartout.jsx`** + `src/styles-publier-partout.css` : la feuille (réglage du prix, une carte par
  annonce, une ligne par site, « Ce qui part », demandes, état par case, bilan, UN bouton). Tout le texte par
  `tr()` (clés `partout.*` dans les 5 langues ; ajoutée à MIGRES d'`audit-traduction`).
- **App.jsx** : `HotePublierPartout` (près de `HotePublierAilleurs`) — voies existantes : Leboncoin
  `vmrCmd lbcPublier` + fiche `valideAnnonceLbc` (prix réglé refusé si l'extension n'a pas `lbcfiche`),
  Vestiaire `vmrCmd vcPreparer` (publier = `vcauto`), eBay `preparerBrouillonPartout` ; gardes
  `raisonExtGlobale` (publication, vcpublier) ; « déjà en ligne » par `sitesPrixDe`/`enLigneSur` ;
  `attendreFinJob` lit `__vmrJobs` (6 min). Coque : événement `vrm:publier-partout` `{nums}` ; entrée
  « Publier partout » dans le ⋯ de la carte Annonces (`data-fiche-partout`) ; Actions en série
  (`annoncesActions.js` k `partout`, lien sous les tuiles, comptes mélangés permis) ; pastilles « aussi sur »
  Leboncoin · eBay · **Vestiaire** (nouveau : `vcNumsAnn`, `numeroVcIdentite` sur `vc_listings` publiées).
- **`src/ecrans/Ebay.jsx`** : `preparerBrouillonPartout` exporté — pubinfo → catégorie, `autoRemplirAttributs`
  (faits Vinted seulement), `etatEbayDeVinted`, brouillon `origine:'partout'` par `modifierBrouillonsEbay`
  (lecture ratée ⇒ rien), jamais un 2e brouillon de la même paire, N° lisible exigé (SKU `VRM-{n°}`), aucune
  publication, aucun port (§2.8).

## Prouvé
- `npm run build` OK.
- `scripts/audit-publier-partout.cjs` : 48/48 verts, **13/13 mutations** (`--prouve`), 1/13 vert sur `origin/main`.
- `audit-annonces-actions` remis à la règle (B2, B15, B18 : « Publier partout » ignore le compte Vinted comme
  « Prix mini ») : vert, 24/24 mutations. Verts aussi : traduction, variables, tdz, coherence (avec VRM_GIT),
  quoi-de-neuf, icones, violet, fonctions-api, retirer-ailleurs, identite.

## ÉTAT À LA REPRISE
- **Fait et poussé** : tout ce qui est ci-dessus.
- **PAS fait** :
  1. Banc `scripts/bancs/publier-partout.cjs` ÉCRIT (copie du service de `plateformes-logo.cjs`, scénarios A–G)
     mais **jamais allé au bout** (lancé, arrêté sur demande) : le lancer après `npm run build`
     (`SHOTS=… node scripts/bancs/publier-partout.cjs`), corriger, **regarder les captures 390/1512 clair/sombre**.
     Pièges probables : au téléphone, le ⋯ est dans le repli de la carte (le banc clique `data-fiche-plus-bouton`) ;
     la forme de `lireBrouillonsEbay` (projection `items:data->items`) dans le service du banc ;
     `enLigneSur('ebay')` = `null` si `rn.manques` contient « tes annonces eBay » ⇒ case eBay pas cochée d'office.
  2. Ligne « Quoi de neuf » (`src/nouveautes.js`, titre ≤ 8 mots, écran Annonces) — `audit-quoi-de-neuf`.
  3. Ligne §9 de CLAUDE.md (< 59 000 o ; il pèse ~58 600 : déplacer la ligne la plus ancienne si besoin).
  4. Vrai `git merge origin/main` puis `git diff origin/main --stat`.
- **À savoir** : les textes des manques/raisons venant de la règle pure restent en français (comme
  `publierAilleurs.js`). Vestiaire : le prix réglé n'est pas possible par la voie actuelle (l'extension relit
  l'annonce Vinted) — une extension qui accepterait `prix` dans `vcPreparer` le permettrait (réserver 5.359+).
  eBay multi-comptes : le brouillon part sur le compte principal (pas de `compte` posé).

## Précisions de Julien reçues APRÈS l'arrêt (message de la session principale, 11 nov. ~18 h) — à faire à la reprise
1. Proposer **tous** les paramètres de publication de chaque site. Leboncoin : catégorie, sous-catégorie, critères de la catégorie (marque, taille, couleur, état, matière…), prix, livraison / remise en main propre, lieu, options. Vestiaire : catégorie, marque, taille, état, matière, couleur, prix, authenticité… Un réglage **par défaut** pour tous, puis modifiable **par annonce**. Aujourd'hui, la feuille ne règle que le prix par site et l'état Leboncoin.
2. Quand VRM ne trouve pas une catégorie, une couleur ou une taille, il la **demande** (jamais inventée). C'est déjà le principe de `lignePartout` (`demandes`), à étendre à chaque champ.
3. Pendant la publication, VRM reste **figé**, avec le détail de chaque étape et une barre de progression : utiliser le composant commun **`SuiviTravail`** (branche `claude/suivi-travail`, son API dans le fichier de coordination), en le fusionnant ici. N'en pas refaire un autre : `executerPartout(surEtat)` donne déjà l'état par case pour le nourrir.
4. Les paramètres eBay viennent de **`claude/ebay-complet`** (`src/ebay/parametres.js`) : y brancher la partie eBay (aujourd'hui `preparerBrouillonPartout`, dans `src/ecrans/Ebay.jsx`). Périmètre de cette branche : la feuille + Leboncoin + Vestiaire.

## Reprise du 11 nov. (soir) — les précisions de Julien appliquées
- **Tous les paramètres, par défaut puis par annonce** (`src/publierPartout.js`, `CHAMPS_PARTOUT`, `champsSite`,
  `reglageParams`, clé synchronisée `vrm_partout_params`) :
  Leboncoin = catégorie, sous-catégorie (vocabulaire mesuré `LBC_CAT_*` : Mode / Famille / Loisirs), marque, taille,
  couleur, état (`LBC_ETATS`), matière, livraison, remise en main propre, lieu, options payantes (affichées « aucune »,
  jamais réglables : le boost est impossible par construction, 17 oct.) ; Vestiaire = univers (Mode femme / homme),
  catégorie, marque, taille, état, couleur, matière, preuve d'authenticité ; prix : réglage par site + prix de CETTE
  annonce (Leboncoin, eBay ; Vestiaire reste le prix Vinted). Valeur = annonce > défaut > ce que la voie pose
  d'elle-même (« Auto · … ») > rien ⇒ **demandé** (requis), jamais inventé. Une valeur hors liste n'est jamais rangée.
- **Tranché (pas d'extension dans ce lot, aucune version libre réservée)** : chaque champ dit COMMENT la voie
  d'aujourd'hui le pose (`porte` : fiche · vinted · reglages · fixe · site). La voie Leboncoin ne prend de la fiche
  que titre, description, prix, photos, état (`appliquerAnnonceLbc`) ; le reste vient de l'annonce Vinted, de la ville
  des Réglages (`vrm_ville`), ou n'est pas posé. Donc :
  · Leboncoin (publie tout seul) : un choix que la voie CONTREDIRAIT (livraison « non », autre marque, autre lieu)
    ⇒ case bloquée et dite (`hors-voie-*`) ; un requis introuvable ⇒ « à choisir sur Leboncoin pendant le dépôt » (le
    dépôt l'attend, VRM attend sa fin) ; un facultatif que la voie ne pose pas (matière, main propre) ⇒ « ne partira
    pas », dit AVANT (`perdu-*`, non bloquant) ;
  · Vestiaire : un choix que la voie ne porte pas, ou un requis introuvable ⇒ `vcPreparer` part avec
    `publier: false` et la case finit « à finir sur Vestiaire : Matière « Cuir », … » ; ce site s'arrête ensuite (un
    seul dépôt en attente).
  ⚠️ Une extension qui saura recevoir ces champs n'aura qu'à passer leur `porte` à `'fiche'` (et la fiche à les
  porter) : à faire dans un lot extension avec une version réservée dans COORDINATION-AGENTS.md.
- **VRM figé pendant l'envoi** : la feuille ne se ferme plus (×, voile, Échap, **retour du navigateur** — la garde
  `FermeAuRetour` est remontée après un retour), `beforeunload` posé ; une barre fine « N sur M ».
  **SuiviTravail** : d'abord pas fusionné (WIP à 18 h), puis **FUSIONNÉ** (tête f1bb866, audit 48/48, banc, feuille
  montée seule dans `AppCoeur`). Branchement : `src/suiviBranchement.js` (`import.meta.glob('./suiviTravail.js')` : rien tant
  que le fichier n'existe pas, s'allume tout seul à la fusion) + `src/publierPartoutSuivi.js` (pur : envoi ⇒ debut +
  étape, attente ⇒ étape « depot », publié ⇒ ok, à finir ⇒ main, refus ⇒ refus, pas envoyé ⇒ saute ; Pause /
  Arrêter lus ENTRE deux envois par `executerPartout({ doitSArreter })` ; « Reprendre » relance ce qui est « pas
  envoyé »). Il reste au lot suivi-travail de monter `SuiviTravailHote` dans `AppCoeur` (son étape 3).
- **eBay** : `src/ebay/parametres.js` n'existe pas encore sur `claude/ebay-complet` (seulement
  `api/_lib/ebay-parametres.js`, côté serveur). Laissé : `preparerBrouillonPartout` (brouillon, catégorie suggérée,
  critères des faits Vinted) ; la feuille dit « eBay : catégorie et critères se règlent dans le brouillon eBay ».
  Point de branchement : `HotePublierPartout` → `envoyer.ebay` (App.jsx) et la ligne `partout.ebay.params`.
- Preuves : `audit-publier-partout` **69/69**, **22/22 mutations** (9 nouvelles : paramètre pas bloqué, annonce
  ignorée, valeur hors liste, Vestiaire publié quand même, arrêt ignoré, catégorie inventée, « à finir » compté fait,
  `publier` de l'app, synchro oubliée). Banc : scénario H ajouté (défaut Vestiaire ⇒ à finir ; livraison « non » par
  annonce ⇒ bloquant ; tous les champs Leboncoin présents).

## Fusions (11 nov., soir)
- `claude/suivi-travail` fusionné (conflits = ajouts des deux côtés dans les 5 dictionnaires et `nouveautes.js`, gardés
  tous les deux). Publier partout : `suivi.demarrer` (articles = une case annonce × site), `continuer()` lu ENTRE deux
  envois (la pause attend Reprendre / Arrêter ; rien n'est relancé deux fois).
- `claude/ebay-complet` fusionné (conflit `Ebay.jsx` : la fin de `publier` garde le suivi ET `erreurEbay(j)` ; l'export
  garde `preparerBrouillonPartout`, `GuidesEbay`, `EbayRemises`). Publier partout NOMME les réglages eBay par défaut
  (`resume(defautsDepuis(vrm_ebay_publication_defaut))`) ; le brouillon les reprend à sa mise en ligne (écran eBay) ;
  catégorie et caractéristiques restent demandées là (`questions`), jamais ici.

## « Un prix modifié dans VRM change partout » (validé par Julien, même branche)
- `src/prixPartout.js` (la feuille « Changer le prix » du 3 nov., fiche d'un N°) : le prix tapé est celui de Vinted ;
  chaque site reçoit SON ajustement (`prixParSite`, le réglage `vrm_partout_prix` de Publier partout ; Vestiaire = le
  prix tapé) ; ≤ 0 € ⇒ ce site ne part pas, dit.
- eBay : route `revise` existante (confirmée, prix vu), puis **relu** : la route relit déjà l'annonce (`regle.lecture.prix`) ;
  relu = demandé ⇒ « Fait ✓ relu » ; relu autre ⇒ « Pas sûr » + le prix vu ; pas relu ⇒ « Fait » sans « relu ».
- Vinted : **VRM PROPOSE** — état « Proposé », bouton « Baisser sur Vinted » qui ouvre la feuille « Baisser le prix »
  existante (montée aussi dans `AppCoeur`, `baisseInitiale` = l'écart en €) ; c'est SON clic là-bas qui envoie
  (`baisserPrixVinted`, extension 5.336, relu). Une hausse ne se propose pas (« à faire sur le site »). L'envoi direct
  `republierVinted` d'avant n'est plus utilisé ici (décision de Julien).
  ⚠️ La baisse lancée depuis la coque ne note pas `vinted_prix_historique` (c'est l'état de l'écran Annonces : l'écrire
  d'ici pourrait être écrasé) — le prix relu arrive à la prochaine lecture du dressing.
- Leboncoin, Vestiaire : aucune voie de changement de prix ⇒ « À faire sur le site » avec « À mettre : 45 € » et le lien.
- Preuves : `audit-annonces-outils` 48/48 (P8, P10, P12 remis à la décision ; P15-P17 neufs) ; `audit-publier-partout`
  section J (5) + 4 mutations (ajustement oublié, Vinted envoyé, relu ignoré, réglage pas passé par l'app).

## ÉTAT FINAL (11 nov., ~19 h 30)
- `npm run build` vert. Banc `scripts/bancs/publier-partout.cjs` **110/110 verts** (390 tactile et 1512, clair et
  sombre ; A–H : feuille, gardes sans extension — au téléphone « depuis ton ordinateur » —, déjà en ligne par N°, prix
  par site gardé, série, brouillon eBay sans port ni publication, paramètres par défaut et par annonce, VRM figé sous
  le suivi commun puis « Fermer »). Banc `annonces-outils` vert (« Changer le prix »). Captures regardées.
  Corrigé en passant : choisir « ± euros » faisait disparaître le champ (un écart nul se range « prix Vinted ») — le
  mode choisi est tenu par la feuille jusqu'à la saisie.
- Audits verts : publier-partout 75/75 (26/26 mutations), annonces-outils 48/48, suivi-travail 48/48, ebay-route 530,
  annonces-actions, retirer-ailleurs, traduction, quoi-de-neuf, variables, tdz, coherence, identite, icones,
  textes-courts, fonctions-api, secrets.
- Reste : une extension qui porterait les paramètres Leboncoin/Vestiaire (porte → 'fiche') ; le prix réglé sur
  Vestiaire ; un changement de prix Leboncoin/Vestiaire depuis VRM (aucune voie : « à faire sur le site »).
