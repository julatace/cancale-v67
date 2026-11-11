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
