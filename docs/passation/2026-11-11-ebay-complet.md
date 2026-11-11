# 11 nov. — eBay complet (`claude/ebay-complet`) — WIP, arrêté sur demande

## ÉTAT À LA REPRISE

**Fait (non prouvé, rien de visible encore)**
- `api/_lib/ebay-parametres.js` (règles pures serveur) : `optionsPublication(item, compte)` relit
  `item.parametres` champ par champ (format prix fixe / enchères 1-3-5-7-10 j + Achat immédiat ≥ +30 % +
  réserve ; offres sans seuil ; descripteurs d'état (ids) ; délai d'envoi {0,1,2,3,4,5,10,15,20,30} ;
  lieu + code postal ; retours acceptés/refusés (refus interdit à un pro), 14/30/60 j, qui paie ;
  politiques du compte (ids ; expédition JAMAIS envoyée en livraison gérée, §2.8) ; TVA (pro constaté
  seulement) ; sous-titre ≤ 55 ; seconde catégorie ; annonce privée). `xmlOptions` (morceaux vides sans
  option), `appelTrading` (enchère ⇒ AddItem/VerifyAddItem), `aspectsPropres`/`xmlAspects` (multi-valeurs),
  lecteurs `lireAspects` (requis/recommandé/MULTI/SELECTION_ONLY), `lireConditions` (+ descripteurs),
  `lirePolitiques`, `lireEmplacements`, `lirePolitiquesActivees`, `etatJeton` (prévenir 30 j avant).
- `api/ebay.js` : import ; `itemXml` lit `it.options` (sous-titre, catégorie 2, type/durée, lieu, CP,
  descripteurs, délai, retours, offres/profils/TVA/privée avant UUID ; doublon BestOffer évité si règle
  d'offre) ; aspects en liste ⇒ plusieurs `<Value>` ; `avecSku(it, compte)` appelle `optionsPublication`
  (+ quantité 1 pour une enchère, `aspectsVus`) ; les 3 appelants (publish, pubverify, programmer)
  passent `ctx.compte` et rendent `reason:'parametres'`. `node --check` OK.

**Pas encore prouvé** : `scripts/bancs/ebay-write.cjs` n'a pas pu tourner (`fast-xml-parser` absent de
`node_modules` dans ce conteneur ⇒ `npm ci` d'abord). À vérifier en premier : une annonce SANS
`parametres` produit le MÊME XML qu'avant (comparer `itemXml` sur origin/main, contrôle X0).

**Reste (dans l'ordre)**
1. `npm ci`, puis `ebay-write`, `ebay-programmer`, `ebay-regle-offre`, `audit-ebay-route` verts.
2. Action `parametres` dans `ACTIONS` (taxonomie : suggestions, aspects, conditions ; politiques,
   emplacements, programme SELLING_POLICY_MANAGEMENT) via les lecteurs ci-dessus ; `status` : ajouter
   `jeton: etatJeton(saved_at, refresh_expires_days)` (lecteur projeté à écrire dans `api/_lib/ebay.js`,
   `select=saved_at:data->>saved_at,jours:data->>refresh_expires_days`, jamais le jeton).
3. `src/ebay/parametres.js` (règles pures app, RÉUTILISABLE par `claude/publier-partout`) : catalogue
   des champs (une phrase chacun), défauts (Paramètres → eBay, clé synchronisée), fusion défauts +
   annonce, pré-remplissage des caractéristiques depuis Vinted SANS rien inventer (valeur hors liste
   SELECTION_ONLY ⇒ question ; pas de conversion EU→UK), questions à poser (catégorie, caractéristique,
   état, politique), `construireItem` ⇒ `item.parametres`, traduction des erreurs eBay (phrase + geste),
   état de compte (actif / expire bientôt / expiré / politiques manquantes).
4. Feuille `src/ebay/FeuilleParametresEbay.jsx`, connexion guidée `ConnexionEbayGuidee.jsx`
   (remplace le bloc « non connecté » d'`EbayConnexion`, src/ecrans/Ebay.jsx ~l.1504-1862),
   fenêtres guidées (1re publication, catégorie inconnue, caractéristique manquante, politique manquante,
   offre reçue, vente, retour) ; branchement dans `EbayPublier` (~l.669) : bouton « Tous les réglages
   eBay », `buildItem` ajoute `parametres`. Tout texte par `tr()` (5 langues), ligne `src/nouveautes.js`.
5. Banc route avec faux eBay + banc rendu 390/1512 (captures regardées), rouge sur l'avant + mutations.
6. Ligne dans `COORDINATION-AGENTS.md` (ce que Publier partout doit appeler), §9, `git merge origin/main`.

**Pièges**
- `itemXml` est partagé par publier ET vérifier à blanc : ne jamais lire `it.parametres` directement.
- §2.8 : aucun port, aucun transporteur, jamais « livraison gratuite » ; politique d'expédition seulement
  si `ebayGere === false`.
- La programmation exige `ETAT_OK` et le N° : ne pas affaiblir.
- Mon premier `checkout -B` partait d'un `origin/main` périmé (fetch échoué) : refetch avant de travailler.
