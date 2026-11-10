# 10 nov. — Baisse de prix en série (lot C) et « Paires qui dorment » (lot AW) — extension 5.336.0

Branche `claude/baisse-prix-serie` (depuis `origin/main`, `origin/main` refusionné avant la fin).
Validé par Julien (`2026-11-09-propositions.md` : « baisse de prix en série sur son clic » ;
`2026-11-09-file-des-lots.md` : C = 5.336, AW fusionné avec C). Rien n'est automatique.

## Ce que Julien voit

1. **Annonces → À relancer → Qui dorment** (la vue existante du 3 nov.) : une **case** devant
   chaque ligne, « Tout cocher », et **« Baisser le prix (N) »**. La liste reste celle d'avant :
   annonces EN LIGNE (`annBase`, `<enligne-regle>`), âge = date de mise en ligne LUE
   (`listedAgeDays` : « Ajouté il y a… » relevé, sinon la date Vinted ; inconnue ⇒ dans aucune
   liste), seuil 30/60/90 j, le plus ancien d'abord (compte de l'onglet en tête, comme la grille),
   photo, N°, prix, jours.
2. **Sélectionner → Actions → « Baisser le prix… »** : un lien sous les quatre tuiles (comme
   « Prix mini… »), seulement pour des annonces en ligne, grisé sans extension 5.336.
3. **La feuille « Baisser le prix »** (`src/BaissePrixSerie.jsx`) : « − € » / « − % » et le
   montant (défaut −5 €), arrondi à l'euro ; pour chaque annonce « ancien → nouveau » ; le
   plancher du lot F (`plancherVente`, prix d'achat SAISI + frais connus) sous la ligne ; sous le
   plancher ⇒ **ambre et décochée** (il peut la recocher) ; prix d'achat pas saisi ⇒ aucun
   plancher inventé ; annonce d'un autre compte que celui de l'onglet ⇒ « Ouvre <compte> sur
   Vinted », case grisée, **jamais envoyée** (une phrase par compte en tête).
   « Baisser N prix » → « Baisser N prix sur Vinted ? » → **« Oui, baisser »**.
4. **Pendant** : une annonce à la fois, « 1 sur 2 », jauge, **Arrêter** (après celle en cours),
   une pause de 3 à 8 s entre deux annonces. **Après** : « 80 € → 72 € relu sur Vinted · Fait »,
   « Autre prix » (le prix que Vinted montre), « Pas relu » (« 60 € → — », jamais le prix voulu),
   « Refusé » / « Pas envoyée » + la raison ; bilan d'une ligne ; la liste montre le prix relu.
5. Extension absente, en retard ou pas connectée à CE compte VRM (`raisonExtGlobale`, capacité
   `baisseprix`) : la feuille le dit (« Mets l'extension à jour (5.336.0)… »), le bouton est grisé.

## Les règles

- **App, pure** — `src/baissePrix.js` : `baisseTapee` (−90 % au plus, au centime), `prixBaisse`
  (euros entiers, toujours sous l'ancien, jamais sous 1 €), `lignesBaisse` (compte de l'onglet
  `undefined` pas su ⇒ rien coché ; `null` ⇒ « Ouvre vinted.fr sur … »), `issueBaisse` (« fait »
  seulement avec un `prixVu` relu ; plafond, pause, frein, onglet, autre compte, pas de réponse ⇒
  la série S'ARRÊTE ; un refus propre à une annonce ⇒ la suivante continue), `bilanBaisse`.
- **Extension 5.336.0** — `baisserPrixVinted` (background.js, routée par `executerCommande`,
  origine vrm.center seulement) : confirmée · prix < ancien · frein après refus (`lireFreinRepub`)
  · `gardeStricte(uid, acc, { reserve: RESERVE_GESTES })` (compte de l'onglet = compte de
  l'annonce, 45/h sur 50, UNE action par baisse) · sauvegarde coffre vérifiée · modèle de CETTE
  annonce appris (`vrm_vinted_modele`, la règle de `republierVinted`) · puis DANS la file
  (`avecVinted`) : frein et compte relus, `GET item_upload/items/{id}` depuis l'onglet
  (`vintedPage`) — le prix lu doit être celui de l'aperçu (sinon `prix-change`, rien envoyé, prix
  lu rendu) ; le modèle doit montrer le même titre, la même description, les mêmes photos que
  l'annonce lue (sinon `modele-ancien` : le rejouer effacerait ses retouches) ; `PUT` du corps
  appris où SEUL le prix change (`corpsAvecPrixBaisse(…, { prix })`) ; refus ⇒ `poserFreinRepub`
  (30 min, 24 h si restreint) ; puis `GET` de relecture ⇒ `fait` / `ecart` / `incertain`.
  Tout arrêt avant le PUT REND sa place dans l'heure (`rendreActions`). Un 429/403 pose la pause
  (`requeteVinted` → `vrmPauseVinted`). Les deux lectures font partie du geste (comme la lecture de
  la page « Modifier » de `recreerVinted`) : elles ne sont pas comptées dans le budget de lecture.
- **Qui dorment (AW)** — le nombre publié pour le bilan de la semaine (`vrm_paires_dorment`, lu
  par `dormentDe`) sort maintenant de `articlesQuiDorment(…, 30)` (la règle de la vue), plus d'une
  seconde comparaison d'âge dans `annStats`. Mêmes nombres qu'avant (même base, même âge).
- **Versions** : `CODE_VERSION`, manifeste, `lbc-inject.js` / `lbc-relay.js` (transports qui
  suivent le manifeste), `EXT_ATTENDUE` = 5.336.0, `EXT_CAPACITES.baisseprix = '5.336.0'`,
  `audit-coherence` (`baisseprix: 'baisserPrixVinted'`), zips refaits par
  `node scripts/zip-extension.cjs` (`public/VRM-extension.zip` en UN dossier, Orion). 5.336.0 n'a
  jamais été publiée : `audit-extension-zip` (« numéro neuf ») et `git log --remotes -S` sur le
  manifeste (aucune branche ne la porte).

## Preuves

- `node scripts/audit-baisse-prix.cjs` : **39 contrôles** sur le VRAI background.js dans un vm
  (`_fond-vm.cjs`) + la règle de l'app. `--prouve` : **17/17 mutations** rouges (extension :
  autre compte, dépasse le plafond, sans réserve, prix supposé sans relecture, sans lecture avant,
  pause ignorée, place gardée, rafale, modèle rejoué, frein ignoré ; règle : autre compte coché,
  sous le plancher coché, « incertain » dit « fait », « fait » sans prix relu, continue après le
  plafond, arrondi qui remonte, pas su = oui) ; sur le background.js d'`origin/main` : 22 rouges.
- Banc `scripts/bancs/baisse-prix.cjs` (données inventées, faux pont qui RETIENT chaque commande) :
  **106 verts** (390 tactile et 1512, clair et sombre ; D arrêter, E plafond, F extension 5.335,
  G Sélectionner). Sur le build d'`origin/main` (git archive) : **9 rouges**. Mutations de l'app
  rebâties (1512) : voir le résultat en bas.
- Captures regardées (`BANC_CAPTURE`) : liste avec cases, feuille (aperçu, envoi, bilan),
  extension ancienne, depuis Sélectionner — 390 tactile et 1512, clair et sombre. Défaut vu et
  corrigé : la case cassait la grille de la ligne « Qui dorment » à 1512 (colonne ajoutée).
- `npm run build` ; audits `variables`, `tdz`, `coherence`, `identite`, `icones`,
  `extension-zip`, `plancher-stock`, `annonces-actions` (B23–B26 ajoutés : deux comptes permis,
  extension sans `baisseprix` ⇒ grisé, brouillon ⇒ grisé, un lien pas une tuile), `qui-dorment`,
  `ma-semaine`, `bilan-semaine`, `annonces-coherence`, `journee-coherence`, `annonces-outils`,
  `republier`, `republier-main`, `republier-plusieurs-chrome`, `republier-question`, `recreer`,
  `compteurs-concurrents`, `frein-vinted`, `frein-relais-vinted`, `frein-relais-serveur`,
  `budget-lectures`, `argent-vinted`, `moteur-offres`, `extension-navigateurs`,
  `paquets-boutiques` : verts.

## Ce qui reste / limites dites

- La baisse exige, comme « Modifier prix ou titre », que VRM ait APPRIS le format de CETTE
  annonce (une modification enregistrée à la main sur Vinted) et sa sauvegarde coffre ; sinon la
  ligne dit « Pas envoyée » et le geste. La forme de la réponse `GET item_upload/items/{id}` est lue
  défensivement (`price` objet ou nombre, `price_numeric`) : une forme inconnue n'envoie RIEN
  (`baisse_forme_inconnue` dans le diagnostic).
- Leboncoin, eBay, Vestiaire : pas de baisse en série (eBay a déjà « Changer le prix » par N°).
- Rien n'est programmé ni répété ; aucune baisse sans son clic et sa confirmation.

## Geste de Julien

Installer l'extension **5.336.0** (remplacer le dossier, puis ⟳ dans chaque Chrome), garder un
onglet vinted.fr ouvert sur le compte des annonces à baisser.
