# Intégration 11nov-g2 — 5 lots réunis sur integration-11nov-g1 (12 nov. 2026)

Branche : `claude/integration-11nov-g2`, partie de `origin/claude/integration-11nov-g1` (83c1d12e9), refusionnée
ensuite (69def3800) avec `integration-11nov-f` (ced354902). Pas de PR ici (le coordinateur fusionne).

## Ce qui est réuni (vrais `git merge`, dans cet ordre)
1. `lbc-rouges` (d1adb3810, contient `lbc-plus`, ext. 5.363) · 2. `vestiaire-plus` (47218a8d2, 5.364) ·
3. `securite-vinted` (c1bbdf633, 5.366) · 4. `annonce-vinted` (bc5f4fed1, 5.367) · 5. `republier-programme`
(74166d3b0, 5.368) · puis `origin/main` (f04d4a580, déjà dedans) et `integration-11nov-f`, puis `integration-11nov-g1`
refusionnée avant la passe finale.

## Extension
Version finale **5.368.0** (`audit-extension-zip` : jamais servie par `origin/main`). `CODE_VERSION`, manifeste,
capteur et relais Leboncoin, notice Orion, `EXT_ATTENDUE` alignés ; zips Chrome (`VRM-extension/`) et Orion
(`VRM-Orion/`, `.xpi`) refaits, un dossier chacun. `EXT_CAPACITES` = union : `lbcprix` 5.363, `vcprix` 5.364,
`securite` 5.366, `creervinted` 5.367, `repubdepart` 5.368 (+ celles de F/g1). Table §8 de CLAUDE.md recopiée
(il y manquait aussi `lbcprix`, `offrespage`, `offresgarde` : ajoutées).

## Conflits et résolution (les deux intentions gardées)
- `background.js` : git a réuni seul presque tout ; conflits restés : la version, l'état rendu à l'app
  (`lbcPrix: true, vcPrix: true`), l'état de la carte (`mois` de F **et** `secu` de securite-vinted), les commandes
  (`importSiteTout` **et** `secuArret`).
- `vc.js` : le relais des ventes Vestiaire passe par `ventesNettes` (import-historique-sites) ; le prix de vente
  (`prixVente`, vestiaire-plus 5.364) y est ajouté ; les deux écouteurs (`vcImportPage` 5.365, `vcPrix` 5.364) gardés.
- `vrm-badge.js` : la ligne « périmée » (F) puis la ligne « Sécurité du compte » (5.366) ; les lignes Leboncoin et
  « Mesure » restent là où F les a mises (tête et détails).
- `BaissePrixSerie.jsx` : `baisseInitiale` (prix partout) ET `site`/`modeDefaut`/`texteDefaut`/`onRelire`
  (Leboncoin) ; la baisse proposée l'emporte sur le défaut.
- Leboncoin.jsx : imports réunis ; textes de lbc-plus passés au vocabulaire du vendeur (`motsVendeur()`).
- Vestiaire.jsx : les photos exigées (vestiaire-plus) avant la vérification d'avant publication, avec le N° écrit (F).
- Ma journée : les offres Vestiaire (vestiaire-plus, `tab: 'messages'`) + `{...j.attrs}` sur la tâche + `data-plein`.
- Republier.jsx : `lotVerif`/`verifierLot`/`reglagesFiges` (programme) + `pickVerif` (verif-publication).
- App.jsx : imports (gros lot + Créer sur Vinted + programme/historique), exports (`pushNotif` ajouté),
  `<FichesNeuves annonces=…/>` + « Quelles annonces republier ? ».
- i18n (5 langues), `nouveautes.js`, `audit-traduction`, `audit-coherence` (FONCTIONS), `audit-relais-lbc-kinds` :
  union. CLAUDE.md §9 : une ligne pour ce paquet, les lignes des lots déplacées telles quelles dans
  `historique-divers.md` (fichier sous 59 000 octets).

## Branchements faits
**a) Sécurité des comptes (5.366) sur les gestes neufs.** Aucune prudence en double : `agent2-vinted-forme` n'est
pas dans l'arbre. 50/h, réserve 5, 20 lectures/h inchangés (E9).
- Baisse de prix **Vestiaire** (`baisserPrixVestiaire`) : `secuRobotDit` + `secuGeste('vestiaire', compte, 'baisse',
  'serie')` AVANT `compterAction` ; la page (`vc-inject.js`) rend `defi`/`ra` (`defiDe`, `raDe`), `vc.js` les relaie,
  `secuObserver` ⇒ robot : pause Vestiaire (Retry-After respecté) et refus dit.
- Baisse de prix **Leboncoin** (`baisserPrixLbc`) : idem (`'leboncoin'`, `baisse`, `serie`) ; `lbc-inject.js` reconnaît
  un défi anti-robot (règle de `defiDe`) sur la réponse, `lbc-relay.js` le relaie ; robot ⇒ pause des prix Leboncoin.
- **Republier sur Leboncoin** : l'app envoie `repub: true` à `lbcSupprime` ⇒ `secuGeste('leboncoin', compte,
  'republication', 'serie')` (une suppression seule reste `clic`) ; robot vérifié avant ; `secuObserver` sur la réponse.
  La publication qui suit est la fin d'un geste commencé (comme `finRepubBrouillon`) : pas de garde de plus.
- **Présence** sur leboncoin.fr : le bloc 5.366 de `vc.js` copié dans `lbc.js` (le fond lisait déjà l'hôte).
  « Mes annonces » lue en entier ⇒ `secuLectureNormale('leboncoin', …)`.
- **Créer sur Vinted** (`creerVintedFiche`) : `gardeStricte(…, { secu: { sorte: 'publication', mode: serie ? 'serie'
  : 'clic' } })` (avant : `autre`/`clic`) ; la feuille envoie `serie: true` quand il crée plusieurs fiches.
- **Départ programmé** (republier-programme) : l'atelier en départ envoie `programme: true` ⇒ `republierVinted` et
  `recreerVinted` passent en mode `programme` (repos de nuit, journée calme, réveil progressif). Lancé à l'écran ⇒
  `serie`. La réservation de la paire dans `recreerVinted` passait en `clic` (sorte « autre ») : désormais
  `republication`.
- Preuve : `audit-securite-comptes` E11–E18 (vrai `background.js` dans le vm pour E11–E16) — **43 verts** ;
  `--src` sur le `background.js` d'avant le branchement : **E11–E18 rouges** ; `--mutation=toutes` 14/14 ; `--recopie` :
  copie inchangée.

**b) « Créer sur Vinted »** :
- Les fiches « Rangé à l'arrivée » (rangement-guide) et du gros lot vont dans `vrm_fiches_neuves` : elles sont
  dans « À publier » avec « Créer sur Vinted » (et la série cochée). Le brouillon rendu est noté sur la fiche
  (`vinted.draftId`) et le N° lié à cet identifiant par l'extension : c'est l'identité.
- La feuille (`CreerSurVinted`, `saisie`) laisse TAPER le titre, le prix et la description quand la fiche ne les a
  pas (rien deviné ; gardés sur sa fiche) — sans ça, une fiche rangée ou de lot n'avait aucune description.
- « Achetés, pas en ligne » : une case par article PROUVÉ à N° (rien coché d'office), « Créer sur Vinted · N » ;
  la fiche « À publier » de CE N° (par `cleNum`) si elle existe, sinon une fiche écrite seulement au brouillon rendu.
  Sans N° : pas de case.
- Une seule feuille pour les deux (`FeuilleCreerVinted`, App.jsx).

**c) `--vrm-card`** : `grep -rn -- '--vrm-card[^2]' src` ne rend rien.

## Vérifications (intégrateur — second agent, 12 nov. matin)
L'agent principal s'est arrêté (100 % d'utilisation) avant cette section ; la mise en ligne a été faite par le second
agent (PR #1138), après #1137 (F).
- `origin/main` (184f46c2f, F en ligne) fusionné ; `integration-11nov-f` (budget Annonces relevé) et g1 refusionnées.
- Build ; audits variables, tdz, coherence, identite, icones, fonctions-api, extension-zip, politique-hotes verts.
- **Rouges de la CI nés de g1/g2, corrigés** :
  - **Une annonce numérotée DEUX fois** (banc `achats-sourcing` : N°7 puis N°8, et le N°7 perdu du pool) : Ventes monte
    deux écrans depuis revue-colis (« À expédier » en tête + la liste), chacun numérotait avec son état. Bissection :
    vert sur main, rouge dès la fusion de `revue-colis` dans g1. Le numéroteur reprend d'abord les N° et le pool déjà
    rangés sur l'appareil (App.jsx). Rouge avant, vert après (4 variantes).
  - `audit-coherence` : `vcprix`/`lbcprix` promises à 5.364/5.363 alors que la 5.365 publiée par main ne les a pas
    ⇒ 5.368.0 (App.jsx, §8, audit-vc-prix P9, faux ponts des bancs vestiaire-plus et lbc-plus).
  - banc `nouveau-vendeur` : « · vendue aujourd’hui » en début de ligne à 390 px ⇒ espace insécable avant « · ».
- **Restent (notés, non bloquants pour Julien)** : `comptes-et-reception` (test d'interface de l'ANCIEN écran Favoris,
  refait par favoris-clair — dictionnaire et bouton portés, le reste à réécrire) ; `colis-retirer-propre` (zone Colis :
  « Phone Cash » rogné de 6 px à 390 px, 41 px au lieu de 40 avant « Argent à vérifier ») ; `ecrans (parcours-quotidien)`
  et `audit-colis-envoi` B, déjà rouges sur main.
