# 7 novembre 2026 — « Je numérote moi-même dans mes annonces »

Branche `claude/numero-ecrit` (depuis `origin/main` 2590619c). Extension **5.324.0**.

## La demande (mot pour mot)

> « pour Vinted par exemple, redéfinir que la personne met son numéro d'étiquetage à la
> fin de sa description. Donc veuillez capter ce numéro-là pour l'intégrer dans
> l'application et n'attribuer donc pas de numéro automatiquement ; pareil ça peut être
> dans le titre également ou dans le numéro d'étiquetage pour les comptes professionnels
> Vinted ; on peut appliquer ça à Leboncoin, eBay et Vestiaire Collective. On peut faire
> un meilleur accompagnement. »

## Ce qui est livré

1. **Un réglage par vendeur, ÉTEINT par défaut** : `vrm_numero_ecrit` = `{ actif, depuis }`,
   dans `SYNC_KEYS` (ligne `main`, jamais un drapeau du navigateur seul). Éteint = rien ne
   change chez personne (Julien compris).
2. **La règle, un seul propriétaire** : `src/numeroEcrit.js` (JS pur).
   - Où lire, dans l'ordre : (a) un champ de référence natif **prouvé dans le code de
     capture** — SKU eBay (`sku`), `CustomRef` Leboncoin (tableau de bord pro,
     `background.js` « CAS PRO LEBONCOIN ») ; (b) la **fin** de la description (dernière
     ligne non vide ; la lettre seule de Republier est sautée) ; (c) le titre (n'importe
     où, une seule fois).
   - Formes acceptées : `N° 123`, `N°123`, `Nº 123`, `No 123`, `No. 123`, `Réf 123`,
     `Ref. 123`, `Réf : 123`, `#123`, `Réf. VRM-123` ; numéros à lettres (`N° B125`,
     `#C40`) par la clé (= `cleNum`, vérifié par l'audit).
   - Jamais lu : un nombre nu (pointure 42, prix 45 €, « 2 paires », une année), un prix
     ou une mesure marqués (`#45 €`, `N° 3 cm`), une référence de modèle (`Réf.
     CW2288-111`, `Réf DD1391`, `Réf B75806`, `Réf 315122`) ; `(12)`, `[12]`, `n12` (les
     formes « parenthèses / crochets / n » de `src/etiquetteNumero.js`) ne sont **pas**
     lues : trop proches d'une taille.
   - Deux numéros différents dans un texte, ou entre deux sources (titre ≠ fin de
     description, SKU ≠ titre) ⇒ **ambigu**, dit, rien lu.
   - Décisions : `decisionEcrite` (annonce SANS N° chez VRM) — N° écrit ⇒ lui ; rien
     d'écrit ⇒ l'identité seule (même annonce vendue, même photo), sinon **rien** ;
     archive (« B… », `numeroReprenable`) ⇒ rien ; N° écrit ≠ identité ⇒ rien.
     `etatAnnonce` : a-poser · accord · contredit · garde · archive · avant (annonce
     d'avant la remise à zéro 013) · ambigu · rien · sans-ecrit.
3. **Allumé, VRM ne DONNE plus aucun numéro** (`numeroEcritActif()` dans `src/App.jsx`) :
   - numérotation des annonces en ligne : passe par `decisionEcrite` puis `continue` —
     jamais `prochainLibre`, jamais le N° réservé à côté de « Publier » ;
   - vente à expédier sans N° (`autoShip`) : seulement le N° écrit dans le TITRE de la
     vente (après la coupure), jamais un N° neuf ;
   - doublons (`doublonsAReattribuer`) : plus réglés seuls — le bloc rouge reste, il
     corrige le texte de l'annonce ;
   - Vestiaire (`numeroterVestiaire`) : aucun N° donné ; `numeroVcIdentite` lit le titre ;
   - Leboncoin (`clesAnnonceLbc`, `numeroLbcIdentite`) : `numeroEcritLbc` (CustomRef,
     fin de description si VRM l'a EN ENTIER, titre) ;
   - eBay (`numEbayLu`) : un SKU qui est son numéro (`123`, `B125`, `N° 123`) compte comme
     `VRM-123`, **avec les mêmes gardes** (une seule fiche le porte, déjà avant la
     publication) ;
   - extension **5.324.0** : `reserverNumeroPourOnglet` lit `vrm_numero_ecrit`
     (`numeroEcritAllume`) — aucun N° réservé ni affiché à côté de « Publier ».
4. **La description Vinted** : lue là où elle existe déjà (`vinted_item_details`, par
   `fetchDescLens`, projeté par clé) ; seule la LECTURE (quelques octets) est gardée
   (`it.numEcritDesc`), jamais le texte (§34). Une annonce jamais ouverte sur vinted.fr
   n'a pas de description captée : « description pas encore lue », dit.
5. **Contradiction ⇒ rien ne change** : la paire va dans « N numéros écrits à vérifier »
   (Annonces, au-dessus des paires masquées) avec les deux numéros ; **son clic** choisit :
   « Prendre N°Y » (fiche `manuelAt`, `reattribue` ⇒ « à écrire sur tes cartons », pool)
   ou « Garder N°X » (`ecritRefuse` : ce N° écrit n'est plus proposé).
6. **Accompagnement** : Réglages → Stock et rangement → Numéros de rangement, en tête :
   la bascule (44 px), « Termine ta description par : N° 123 », les formes dans un
   « Pourquoi », un mode d'emploi en 3 étapes, et **l'aperçu « Ce que VRM lit »** sur les
   quatre sites — compté et nommé (N° lus · sans N° écrit · ambigus · à vérifier · pas
   pris ; doublons en rouge) ; Vinted vient de l'écran Annonces (publié en mémoire,
   `publierApercuEcrit`), Leboncoin / Vestiaire / eBay sont relus projetés à l'ouverture.
   Pas lu ⇒ « pas encore lu » / « — », jamais 0. Le guide de démarrage le mentionne
   (étape « Numéroter tes paires »).

## Mesuré vs supposé

- **Mesuré dans le code** (pas dans sa base : aucun accès ici) : la forme de
  `vinted_item_details` (description), `lbc_listings` (`subject`, `body` coupé à
  **400 caractères**, `customRef`), `vc_listings` (`titre` 120 car., `ref` = un « VRM-… »
  trouvé n'importe où — pas une référence du vendeur), eBay (`sku`, `title`).
- **À mesurer chez Julien** :
  - **Vinted pro** : aucun champ « numéro d'étiquetage » / référence n'apparaît dans les
    données captées ; tous ses comptes sont particuliers (`business: false`, historique
    Leboncoin). Rien n'est lu là. Il faut la réponse d'une annonce d'un compte PRO
    (`item_upload/items/{id}` ou `items/{id}`) pour savoir si le champ existe et son nom.
  - **Vestiaire** : pas de description ni de référence vendeur captées — titre seul.
  - **Leboncoin** : `CustomRef` n'existe que sur le tableau de bord PRO ; la fin d'une
    description de plus de 400 caractères n'est pas sue (l'extension n'en range que le
    début). Correctif possible (extension) : ranger aussi les 120 derniers caractères.
  - Combien de ses annonces portent déjà un « N° … » écrit : l'aperçu le dira.

## Preuves

- `node scripts/audit-numero-ecrit.cjs` : 35 vérifications (formes, 50 annonces
  identiques sans N° écrit ⇒ aucune n'en reçoit, 50 avec ⇒ chacune le sien, contradiction
  ⇒ rien, doublon ⇒ rouge, archive, clé = `cleNum`, app, extension EXÉCUTÉE).
  **Rouge sur l'arbre d'avant** (`--src`, 10 rouges) ; `--mutation=toutes` : 11/11
  mutations attrapées (prix, ambigu, fin, contredit, archive, modèle, N° neuf, doublons,
  Vestiaire, vente, extension).
- `audit-identite`, `audit-numerotation-lecteurs` (jugé réglage éteint : stubs de la
  règle, documentés), `audit-coherence` (capacité `numeroecrit` → `numeroEcritAllume`),
  `audit-etiquette-numero`, `audit-extension-zip` : verts.
- `audit-double-vente`, `audit-ebay-deja-vendue`, `audit-lbc-a-retirer` extraient les
  lecteurs Leboncoin/eBay dans une vm : ils reçoivent `numeroEcritActif = () => false`
  et `numeroEcritLbc = () => ""` (réglage éteint = la règle d'avant, inchangée).
- `lancer-audits` : seuls les rouges déjà sur `main` restent (argent-a-venir,
  export-donnees, journee-coherence, photos-vinted, politique-hotes, registres,
  chemin-json-guillemets connu).
- Banc `scripts/bancs/numero-ecrit.cjs` (390 tactile clair, 1512 sombre) : **48/48**
  (captures regardées : carte éteinte « pas encore lu », bloc « 2 numéros écrits à
  vérifier » en tête d'Annonces, aperçu « 3 N° lus · 2 sans N° écrit · 1 ambigu sur 6 »).
  `annonces-coherence` : rouges P (« Prix d'achat 2/6 ») et G identiques sur `main`
  (même banc sur un build de `origin/main`) ; `chargement` : aucun rouge.
- Reste à faire (petit) : allumé, « Prochain geste » d'Annonces dit encore « Des annonces
  n'ont pas de numéro : donne-leur un N° » — il pourrait dire « écris-le dans l'annonce ».

## Gestes de Julien

- Rien n'est obligatoire : le réglage est éteint chez lui.
- S'il veut l'essayer : Réglages → Numéros de rangement → « Je numérote moi-même », puis
  ouvrir Annonces et regarder l'aperçu.
- Installer l'extension **5.324.0** (sinon la pastille « N° » à côté de « Publier »
  continue d'apparaître quand le réglage est allumé — l'app, elle, ne la prend plus).

## Questions ouvertes

1. Vinted pro : a-t-il (ou un client) un compte pro ? Il faut une capture pour trouver le
   champ « numéro d'étiquetage ».
2. Allumé, faut-il continuer à proposer le N° réservé à côté de « Publier » comme simple
   SUGGESTION (« écris N°57 ») ? Aujourd'hui : rien n'est affiché.
3. Leboncoin : ranger la fin des descriptions longues (extension) ?
4. `(12)` / `n12` : formes refusées exprès (taille) — à confirmer.
