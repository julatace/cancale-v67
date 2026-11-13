# 11 nov. 2026 · Tout l'historique Leboncoin, Vestiaire et eBay (extension 5.365.0)

Branche `claude/import-historique-sites` (depuis `origin/main`). Aucune PR (la session principale intègre).
Extension **5.365.0** (numéro réservé pour ce lot).

Julien (demande validée) : « récupérer TOUT l'historique de ventes et d'achats sur Leboncoin, eBay
et Vestiaire, comme pour Vinted, pour avoir stats et compta complètes dès le premier jour ».

## ÉTAT À LA REPRISE

Fait et poussé : route eBay (`historique`), extension 5.365 (Leboncoin + Vestiaire), carte
Paramètres → Comptes → **Mon historique** (Vinted + les trois sites), traductions 5 langues, Quoi de
neuf, zip régénéré, audits et bancs ci-dessous. Restes : voir « Limites ».

## eBay — côté serveur (`api/_lib/ebay-historique.js`, action `historique` de `api/ebay.js`)

- Une **action distincte et petite** (2 lignes dans `api/ebay.js` : l'import et `historique:` dans
  `ACTIONS`) pour limiter les conflits avec le lot `ebay-complet`. Aucune fonction `api/` en plus (12).
- Fulfillment `getOrders` par **fenêtres de 90 jours** (`filter=creationdate:[de..a]`), 200 par page,
  de la plus récente à la plus ancienne. **Un appel = une étape bornée** (3 pages au plus) ;
  **reprise** dans la ligne `import_ebay{suffixe}` (curseur : fin de fenêtre + offset).
- **Période maximale** : celle qu'eBay SERT — une fenêtre qu'eBay refuse (400 qui parle de la date)
  arrête la lecture là (`raisonFin: 'ebay'`, « Tout ce qu'eBay garde est récupéré ✓ ») ; borne de
  sûreté de 3 ans quoi qu'il arrive. Pas mesuré sur un vrai compte (aucune lecture de la vraie API
  dans ce lot) : la règle ne devine pas la limite, elle la lit dans le refus.
- **Fusion par `orderId`** dans `ebay_orders{suffixe}` (comparer-et-échanger, `modifierDonnee`) :
  une commande déjà rangée n'est **jamais remplacée** ; une commande neuve entre **allégée** (ni
  `buyer`, ni `shipTo`, ni note — rien de personnel) mais avec tout ce que lisent les règles de l'app
  (montant reçu, frais, statut, lignes et SKU, annulation, dates), marquée `_historique: true`.
  ⇒ Ventes, stats, bénéfice et CA les comptent par les règles existantes (`montantRecuEbay`,
  `numLigneEbay`…), sans rien changer à l'app.
- Une page que la base n'a pas prise n'avance pas ; une forme inconnue n'écrit rien ; déjà fini ⇒
  **aucun appel à eBay** ; `depuisDebut` (son clic « Tout récupérer ») repart de maintenant.
- **Achats eBay** : eBay ne les sert que sur **60 jours** (`GetMyeBayBuying`, `DurationInDays` ≤ 60).
  Ils restent lus en direct (eBay → Achats) ; la ligne et la carte le DISENT (« eBay ne garde que
  60 jours »). Rien de plus n'est promis.
- Qui pilote : la carte « Mon historique » ouverte enchaîne les étapes (une à la fois, 1,5 s
  d'écart, 40 au plus par compte et par ouverture) pour chaque compte eBay qui a `ebay_orders*` et
  n'a pas fini. (Pas de cron : choix pour ne pas toucher `ship-reminders.js`.)

## Leboncoin et Vestiaire — par l'extension (bloc « L'HISTORIQUE LEBONCOIN ET VESTIAIRE » de `background.js`)

- **Le modèle** : l'adresse EXACTE d'une page « Mes transactions » (Leboncoin) / « Mes ventes »,
  « Mes achats » (Vestiaire) que le **site** a lui-même demandée, avec un paramètre de pagination que
  le site a mis (`page`, ou `offset` + `limit`). La page la signale (`lbcimportmodele`,
  `vcimportmodele`), le fond la range **par compte** (`vrmImportModeles`), seulement pour le compte
  prouvé de l'onglet (Leboncoin : identité privée `vrmLbcTransport` ; Vestiaire : onglet ET page,
  `compteVcCapture`). **Jamais une adresse devinée, jamais un paramètre ajouté** : sans modèle, rien
  ne part et la carte dit le geste (« va à la page 2 une fois »). Vestiaire : seulement une liste
  **sans filtre** (`sansFiltre`).
- **L'ordre** `importpage` part du fond vers la page (`lbc-relay.js`/`vc.js` → `lbc-inject.js`/
  `vc-inject.js`), cadre principal, au nom du compte de CETTE page (la page refuse sinon) ; la page
  lit par `origFetch` (des **GET**), et rend la réponse au fond — Leboncoin : le corps allégé (≤ 200 Ko),
  Vestiaire : le paquet lu par **la même fonction que la visite** (`paquetVentes`, `paquetAchats` ;
  `noteVentes`/`noteAchats` les appellent aussi) et nettoyé par **la même liste blanche** dans `vc.js`
  (`ventesNettes`, `achatsNets`).
- **Fusion par identité** : Leboncoin par n° de transaction (`rangerLbcVentes`), Vestiaire par
  identifiant de vente / d'achat (`rangerVcVentes`, `rangerVcAchats`). Le fond vérifie encore le
  compte (`sessionDeListe`, `compteVcCapture`) même si la page ne l'a pas fait.
- **Leboncoin, les détails** : la liste ne dit ni vendeur/acheteur ni le prix final ⇒ chaque
  transaction lue (sauf annulée, sauf déjà en détail en base : `isSeller` projeté) est relue en
  détail `v2/pages/transactions/{id}` (l'adresse que `lireDetails` utilise déjà), dans le même budget.
  `lbc_ventes` passe de 500 à **3 000** transactions (`LBC_VENTES_MAX`, ≈ 1,5 Mo au plus).
- **Garde-fous (§3)** : budget de **LECTURE** (20/h) du compte (`compterLecture('{site}:{compte}')`),
  l'import en prend **12 au plus** ⇒ 8 restent toujours aux lectures de l'argent et des colis ;
  une lecture à la fois (un passage à la fois, `_impSiteEnCours`), 3 par passage, pause **aléatoire
  3–8 s** ; 401/403/429 ⇒ **pause 30 min**, la série s'arrête ; reprise à la même page.
- **Fin d'une liste** : page vide, page identique à la précédente (le site ignore la pagination ⇒ pas
  de boucle), ou total atteint (Vestiaire donne `meta.count`). Une forme inconnue n'est **jamais** une fin.
- **Quand** : l'alarme `vrm-import` (5 min) lance aussi `tickImportSites` (onglet du compte ouvert,
  session VRM, base qui répond) ; 1 min après un modèle neuf. « Tout récupérer » (app, commande
  `importSiteTout`) : le compte d'un onglet ouvert de ce site seulement, repart de la page 1.
- **Progression** dans SA ligne `import_{site}_{compte}` (jamais `main`) :
  `{ etat, types: { transactions, details } | { ventes, achats }, attend: 'modele'|null, repriseA, cause, resteMin, fin, at }`.
- ⚠️ Vestiaire : `vc_ventes.lectures.ventes.complet` ne dit pas DE QUEL compte (ligne commune) ⇒
  « pas su » ne vaut pas « complet » : on lit (la fusion ne perd rien). Le raccourci « base complète ⇒
  aucune lecture » n'est donc vrai que par l'état de l'import lui-même (fini ⇒ plus rien).
- `EXT_CAPACITES.importsites = '5.365.0'` (fonction `importerSite`, `audit-coherence`).

## L'app

- `src/importSites.js` (règle, lecture projetée `or=(id.like.import_leboncoin_*,…)`, jamais
  `select=data`) ; `src/HistoriqueSites.jsx` (dessin, classes `vrm-imp-*` de la carte Vinted).
- Paramètres → Comptes → **Mon historique** (nom changé, 5 langues) : Vinted, puis chaque site où le
  vendeur a quelque chose (`lbc_accounts`, `vc_ventes`/`vc_achats`, `ebay_orders*`). « Pas su » ⇒ « — ».
- `etatSimpleImportSite(l)` → `{ etat, n, N }`, même forme que `etatSimpleImport` de Vinted (pour le lot
  accompagnement).

## Preuves

- `npm run build` vert ; audits obligatoires verts (variables, tdz, coherence, identite, icones,
  textes-courts, fonctions-api, secrets, quoi-de-neuf, traduction) + `extension-zip`.
- **`scripts/audit-import-sites.cjs`** (vrai `background.js` dans `_fond-vm.cjs`, deux faux sites) :
  **44 verts** ; **16 rouges sur origin/main** ; **13/13 mutations** mordent (`--mutations`).
- **`scripts/audit-ebay-route.cjs`** (vraie route, faux eBay par fenêtres, 450 commandes inventées,
  refus au-delà de 2 ans) : **546 verts** ; sur `origin/main` **8 rouges** ; 9 mutations de
  `ebay-historique.js` (remplacer une commande rangée, garder l'acheteur, garder l'adresse, avancer sur
  refus de la base, lire une forme inconnue, relire chez eBay une fois fini, sans borne par appel,
  panne = fin) : toutes rouges.
- Banc **`scripts/bancs/import-sites.cjs`** (390 tactile et 1512, clair et sombre, `locale fr-FR`) :
  **88 verts**. Il a trouvé deux défauts de banc (navigateur en anglais ⇒ textes anglais, juste ; écritures
  d'autres écrans comptées) ; la carte elle-même n'a rien eu à corriger. Captures regardées (390 clair,
  1512 sombre) : Vinted puis Leboncoin « Toto » (120 lues · encore…), Vestiaire « 120 sur 400 » et le geste
  en ambre, eBay « Tout ce qu'eBay garde est récupéré ✓ », achats « eBay ne garde que 60 jours ».

## « Tout récupérer » suivi dans la feuille commune (demande du coordinateur)

Branche `claude/suivi-travail` fusionnée (API `lancerTravail`, `src/suiviTravail.js`). « Tout récupérer »
lancé À LA MAIN fige VRM avec la feuille de suivi (`sorte: 'import-historique'`) :
- **eBay** : chaque étape de la route, « N commandes · M pages », jusqu'à « fini » ; pause / arrêt lus
  entre deux étapes ; un refus d'eBay ou de la base est dit avec le geste (la lecture reprendra à la
  même page) ;
- **Leboncoin / Vestiaire** : la commande à l'extension (refus ⇒ sa raison + « ouvre le site sur ce
  compte »), puis les pages lues RELUES dans SA ligne `import_*` (2 min au plus), et « la suite continue
  toute seule, onglet du site ouvert (12 pages par heure au plus) » — la feuille ne reste pas figée des
  heures sur un travail de fond.
- La lecture automatique (alarme, carte ouverte pour eBay) ne fige rien. Le « Tout récupérer » de
  Vinted (`ImportDepart.jsx`, lot import-depart) n'est pas branché ici.
- Banc : B4 (eBay jusqu'à « fini » dans la feuille), C3 (pages relues, « continue toute seule »),
  E1 (refus de l'extension DIT dans la feuille). Captures regardées (390 clair Leboncoin, 1512 sombre refus).

## Limites

- Aucune forme mesurée sur les vraies pages « Mes transactions » / « Mes ventes » : la pagination est
  celle que le site MONTRE (modèle) ; si Leboncoin/Vestiaire paginent par curseur, rien n'est importé
  et la carte reste sur le geste — à mesurer chez Julien (lecture de `vrmImportModeles`).
- Le prix de vente Vestiaire (`prixVente`, 5.340) n'est pas relayé par `vc.js` (déjà le cas avant ce
  lot : la liste blanche n'a pas la clé) — à corriger dans un lot Vestiaire (pas touché ici).
- L'eBay avance seulement carte ouverte (pas de cron).
- Les page-scripts (`lbc-inject.js`, `vc-inject.js`) ne sont pas exécutés par un banc (contrôlés par
  `node --check` et relecture) : le fond est exécuté, la page simulée.

## Geste de Julien

Installer l'extension **5.365.0** ; sur leboncoin.fr ouvrir « Mes transactions » et aller à la page 2
une fois (chaque compte), sur Vestiaire « Mes ventes » et « Mes achats », page 2 une fois ; laisser
l'onglet ouvert. eBay : ouvrir Paramètres → Comptes → Mon historique.
