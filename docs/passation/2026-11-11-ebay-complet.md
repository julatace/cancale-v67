# 11 nov. — eBay complet (`claude/ebay-complet`)

Demande de Julien : « améliore eBay, on a la chance de l'avoir dans l'app ; améliore la page de
connexion du compte, absolument tout ; plus de pop-ups, de vraies améliorations pratiques ;
propose TOUS les paramètres qu'eBay propose pour la publication ; l'app doit DEMANDER si elle ne
trouve pas une catégorie, une couleur… ».

Tranché (sans lui redemander) : « plus de pop-ups » = davantage de **fenêtres guidées** (feuille
unique `SheetShell`, FermeAuRetour), pas moins. Les règles intouchables tiennent : §2.8 (livraison
gérée par eBay, l'acheteur paie le port, jamais d'étiquette achetée, jamais « livraison gratuite »,
prix envoyé = prix vu), offres auto = seuil natif `BestOfferAutoAcceptPrice` sur son clic SEULEMENT,
SKU `VRM-{n°}`, 12 fonctions `api/` (tout passe par `api/ebay.js`).

## Ce qui est livré

**Serveur** (`api/ebay.js`, `api/_lib/ebay-parametres.js`, `api/_lib/ebay.js`)
- `optionsPublication(item, compte)` relit `item.parametres` champ par champ contre les listes
  FERMÉES d'eBay : prix fixe / enchères (1-3-5-7-10 j, Achat immédiat ≥ +30 %, réserve),
  offres sans seuil, descripteurs d'état, délai d'envoi {0,1,2,3,4,5,10,15,20,30}, lieu + code
  postal, retours (acceptés/refusés — refus interdit à un pro —, 14/30/60 j, qui paie),
  politiques du compte (paiement, retour ; **l'expédition n'est jamais envoyée** en livraison
  gérée), TVA (pro CONSTATÉ seulement), sous-titre ≤ 55, seconde catégorie, annonce privée.
  Une valeur hors liste ⇒ 400 `parametres`, zéro appel eBay. Enchère + règle d'offre ⇒ refus.
- `itemXml` ne lit que `it.options` (posé par `avecSku`) : **sans réglage, l'XML est identique
  au caractère près** (banc X0, comparé à l'arbre d'avant). Enchère ⇒ `AddItem` / `VerifyAddItem`
  (`appelTrading`, seule exception permise par `audit-ebay-route` [INA]).
- `resoudreCompte` porte maintenant le `type` du registre (pro / particulier) : sans lui la TVA
  et l'obligation des retours ne pouvaient jamais se juger.
- Action **`parametres`** (lecture seule) : suggestions de catégories avec leur chemin (`q`),
  204 ⇒ `[]`, eBay muet ⇒ `null` ; pour SA catégorie (`categoryId`) les caractéristiques
  (`lireAspects` : requis, recommandée, MULTI, SELECTION_ONLY, valeurs) et les états
  (`lireConditions`, descripteurs) ; `avecCompte:true` ⇒ programme « politiques de vente »,
  politiques paiement/retour/expédition, emplacements, type. **La route ne choisit jamais de
  catégorie.** Dans `creeAnnonce` (marché du compte exigé).
- `status` : chaque compte porte `jeton` = `etatJeton(saved_at, refresh_expires_days)` lu en deux
  scalaires (`lireEtatJeton`, jamais le jeton) : `ok` · `bientot` (≤ 30 j) · `expire` ; pas de
  date ⇒ `null`.

**App — règles pures `src/ebay/parametres.js`** (aucun texte, aucune lecture ; clés `tr()`)
- `DEFAUTS_USINE` (= ce qu'une annonce portait avant), `CATALOGUE` (chaque paramètre, son
  groupe, payant ou non, pro seulement), `defautsDepuis` (défauts relus, valeur hors liste ⇒
  usine), `fusionner(defauts, annonce)`, `parametresServeur(r, compte)` (ce que la route relit,
  `null` si rien ne diffère d'avant), `apresPublication(r)` (sponsorisée ⇒ `promouvoir`),
  `coutsOptions`, `resume`.
- `preRemplir(aspects, faits, deja)` : seulement des FAITS de Vinted (marque, taille, couleur,
  genre, type, matière, modèle) ; une liste fermée n'accepte qu'une valeur EXACTE (sans casse ni
  accent) ; **une seule valeur hors liste ⇒ rien n'est rempli** (« Noir, Bleu ciel » ne devient
  pas « Noir ») et la question porte « Vinted dit : … ».
- `questions(p)` : catégorie (aucune choisie) · caractéristique obligatoire vide · état hors liste ·
  descripteur requis · politique de paiement/retour absente (programme actif, liste LUE vide ;
  pas lue ⇒ rien affirmé).
- `traduireErreur(j)` : raison de la route, puis codes Trading (931/932/17470 jeton, 87/107
  catégorie, 21919303 caractéristique avec son nom, 21916884 état, …), puis le sens du message ;
  chaque cas a sa phrase ET son geste (`ebay.err.<cle>`, `.geste`). ⚠️ Codes tirés de la doc
  Trading, **non mesurés** sur son compte ; le message d'eBay reste dit sous « Pourquoi ? ».
- `raisonConnexion` (retour `?ebay=…&raison=…`), `etatCompte`, `GUIDES` / `etapesGuide`.

**App — écrans** (`src/ebay/*.jsx`, branchés dans `src/ecrans/Ebay.jsx`)
- `ConnexionEbayGuidee` remplace le bloc « non relié » : 3 étapes dites AVANT, un bouton.
  `RetourConnexionEbay` : ce qui a été CONSTATÉ (pseudo) ou l'erreur traduite + geste +
  « Réessayer » (remplace `RAISON_CONNEXION_EBAY`). `EtatJetonEbay` sur chaque compte (un ou
  plusieurs) : date de fin, « expire dans N jours » en ambre + « Reconnecter » (un geste, §7).
- Paramètres → Comptes eBay : « Réglages de publication » ⇒ `FeuilleParametresEbay` mode
  `defauts` (clé synchronisée `vrm_ebay_publication_defaut`, SYNC_KEYS), « Revenir au réglage
  d'origine ». Vendre sur eBay → Prix & livraison : « Tous les réglages eBay » ⇒ la même feuille
  mode `annonce` (format, durée, Achat immédiat, réserve, offres, délai, lieu, retours, politiques,
  TVA si pro, programmation ⇒ brouillon + « Programmer », sponsorisée **éteinte d'origine** avec
  son coût en %, sous-titre, seconde catégorie, privée ; options payantes nommées, le montant lu à
  « Vérifier »). Le brouillon garde `reglages` + `typeCompte` (rien si rien ne diffère).
- `QuestionsEbay` : une question à la fois (catégorie : recherche par SES mots via
  `parametres` q ; caractéristique : valeurs d'eBay, plusieurs si MULTI ; état ; descripteur ;
  politique + lien eBay). Ouverte : quand eBay ne propose aucune catégorie, par « Chercher une
  autre catégorie », et quand « Publier » en un clic trouve une obligatoire vide (la publication
  reprend toute seule quand tout est répondu ; « Plus tard » l'arrête et le dit).
- Fenêtres guidées : 1re publication (une fois, `vrm_ebay_guide_vu`), politique manquante,
  « Comment faire ? » offre (Offres), vente ⇒ étiquette prépayée dans eBay (Ventes, À traiter),
  retour (À traiter) — `GuidesEbay`, exporté d'Ebay.jsx et monté par App.jsx à la demande.
- Erreurs de `pubverify` / `publish` : phrase + geste + « eBay dit : … ».
- Confirmation : les réglages qui diffèrent d'avant et le coût de la sponsorisée sont dits (même
  avec un seul compte dès qu'une option payante/sponsorisée est posée) ; après la publication,
  `promouvoir` part sur l'annonce créée (son refus ne défait rien et se dit).
- 220 clés de traduction × 5 langues (`src/i18n/langues/*.js`, bloc « ebay-complet »).
- « Quoi de neuf » : `ebay-tous-reglages`.

## Preuves
- `scripts/bancs/ebay-complet-route.cjs` (vraie route, faux eBay Trading/Taxonomy/Metadata/
  Account, fausse base cloisonnée à deux comptes pro/particulier) : **46 contrôles verts** ;
  **29 rouges sur l'arbre d'avant** (copie `git archive` de la base du lot, banc lancé depuis
  elle) ; `--prouve` **13/13 mutations rougies** (XML vide non vide, expédition envoyée, enchère
  en prix fixe, TVA d'un particulier, durée libre, catégorie choisie par la route, « pas su »
  rendu `[]`, jeton toujours ok, type oublié, usine envoyée, hors-liste posé, catégorie pas
  demandée, expédition côté app).
- `audit-ebay-route` 530 verts (contrôle [INA] ajouté : AddItem seulement pour une enchère).
- `scripts/bancs/ebay-complet.cjs` (rendu, 390 tactile + 1512 sombre, faux eBay) — voir le
  résultat chiffré dans « ÉTAT À LA REPRISE » ; captures `scripts/bancs/captures/ebay-complet-*.png`.
- Audits : variables, tdz, coherence, identite, icones, textes-courts, fonctions-api, secrets,
  quoi-de-neuf, traduction — verts.

## Non mesuré (rien n'a été envoyé à eBay)
Formes de `get_category_suggestions` (ancêtres), `get_item_aspects_for_category`,
`get_item_condition_policies`, `get_opted_in_programs`, politiques, `ConditionDescriptors`,
`SellerProfiles`, `VATDetails`, `BuyItNowPrice`/`ReservePrice` et les codes d'erreur Trading :
tirés de la documentation d'eBay. Les adresses du Seller Hub des fenêtres (politiques, commandes,
retours) sont des replis, pas des promesses. Qu'un compte en politiques de vente accepte encore
`ReturnPolicy`/`DispatchTimeMax` sans `SellerProfiles` : le comportement d'avant, inchangé.

## Pour `publier-partout` (ce qu'il doit appeler)
- Règles : `import { DEFAUTS_USINE, CATALOGUE, defautsDepuis, fusionner, parametresServeur,
  preRemplir, questions, traduireErreur, coutsOptions, resume, apresPublication } from
  'src/ebay/parametres.js'` — pures, sans texte (clés `ebay.*` dans les 5 dictionnaires).
- Défauts du vendeur : `load('vrm_ebay_publication_defaut')` → `defautsDepuis`.
- Annonce eBay : `item.parametres = parametresServeur(fusionner(defauts, choixAnnonce), { type })`
  (rien si `null`) ; la route relit tout (`optionsPublication`) — ne jamais construire l'XML ailleurs.
- Catégorie / caractéristiques : `POST /api/ebay {action:'parametres', q}` puis `{categoryId}` ;
  `preRemplir(aspects, faitsVinted)` puis `questions({...})` ; afficher avec `QuestionsEbay`
  (`src/ebay/FenetresEbay.jsx`, `Feuille` = SheetShell de l'app).
- Feuille : `FeuilleParametresEbay` (`src/ebay/FeuilleParametresEbay.jsx`), props
  `Feuille, C, mode, valeurs, onChange, onClose, compte, typeCompte, devise, onProgrammer, onUsine`.
- Sponsorisée : après `publish` réussi, `apresPublication(r)` ⇒ `{action:'promouvoir', confirme:true, listingId, taux}`.

## ÉTAT À LA REPRISE
(voir la ligne du bas, mise à jour à chaque étape)
