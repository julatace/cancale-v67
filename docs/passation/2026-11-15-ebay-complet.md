# 15 nov. — eBay complet 2 : « tu peux faire 10 fois mieux » (`claude/ebay-complet`)

Julien, mot pour mot : « Pour l'app eBay je pense que tu peux faire 10 fois mieux. On a la chance
d'avoir l'application dans l'app, donc je veux que tu regardes tout ce que tu peux mettre dedans et
que tu l'intègres, tout peut être bien pour l'utilisateur. »

Le premier lot eBay complet (11 nov.) est raconté dans `2026-11-11-ebay-complet.md` (réglages de
publication, questions, connexion guidée, remises, messages dans Messages · Tous). Ce lot-ci part de
l'**inventaire** de ce que les API officielles d'eBay permettent à un vendeur, ajoute ce qui est utile
et sûr, et refait l'entrée de l'espace eBay en **tableau de bord** sur le « Verre dépoli ».

## Ce qui a été constaté AVANT de coder (base de production, lecture seule)
- **Aucune ligne `ebay_finances` n'a jamais été écrite** : la lecture du solde (« solde à virer »)
  n'a jamais abouti. Deux causes, toutes deux dans la documentation d'eBay : la Finances API vit sur
  **`apiz.ebay.com`** (l'appel partait vers `api.ebay.com`), et pour un vendeur établi dans l'UE
  (eBay.fr) **chaque appel de la Finances API doit être SIGNÉ** (guide « Digital Signatures for APIs »).
  Le refus (403) était dit « reconnecte-toi » — un faux geste.
- La même exigence de signature vaut pour le **remboursement d'un retour** (`issue_refund`) et la
  décision sur une **annulation** (Post-Order) : le bouton « Rembourser » d'À traiter aurait été refusé.
- `ebay_orders` : 0 commande à ce jour ; `ebay_listings` : quelques annonces ; `ebay_messages` présent.
  Rien de réel n'a donc pu servir de forme : **toutes les formes viennent de la documentation**.
- `developer.ebay.com` n'est pas joignable depuis la session (réseau) : pages lues par la recherche
  web (résumés) ; les adresses citées ci-dessous sont celles de la documentation officielle.

## L'inventaire (API officielles d'eBay ⇒ décision)
| API (doc developer.ebay.com) | ce qu'elle donne au vendeur | utile ? | avant ce lot | risque (§2.8 / §2.9 / §3) | décision |
|---|---|---|---|---|---|
| **Finances** `getSellerFundsSummary`, `getPayouts`, `getTransactions` (`/api-docs/sell/finances/…`) | solde, **versements** (date, état, montant, compte •••• 4321), **frais réels par vente**, frais hors vente (sponsorisation) | oui, beaucoup : CA daté au versement, frais réels | solde seulement, **jamais abouti** (mauvais hôte, pas de signature) | lecture seule ; signature obligatoire (UE) | **AJOUTÉ** : `argent`, hôte `apiz`, signature Ed25519 ; `ebay_versements` (dates par n° de commande) ⇒ CA eBay **daté au versement** |
| **Key Management** `createSigningKey` (`/api-docs/developer/key-management/…`) | la clé de signature | nécessaire à la Finances API | — | clé privée = secret | **AJOUTÉ** : `scripts/ebay-cle-signature.mjs` (une fois) ⇒ variables Vercel `EBAY_SIGNATURE_PRIVEE`, `EBAY_SIGNATURE_JWE` ; jamais en base |
| **Analytics** `getTrafficReport` (`/api-docs/sell/analytics/resources/traffic_report/…`) | affichages, vues, ventes par annonce | oui : « annonces qui ne se voient pas » | non (seulement `WatchCount` = observateurs) | lecture ; droit `sell.analytics.readonly` | **AJOUTÉ** : `trafic` (30 jours, par annonce, lu par CLÉ de métrique) |
| **Analytics** `findSellerStandardsProfiles`, `getCustomerServiceMetric` | niveau vendeur (Top Fiabilité / au-dessus / sous le standard), taux de défauts, réclamations comparées | oui : santé du compte | non | lecture | **AJOUTÉ** : `sante` |
| **Compliance** `getListingViolationsSummary`, `getListingViolations` (`/api-docs/sell/compliance/…`) | annonces à corriger : **caractéristiques manquantes** et valeurs suggérées par eBay | oui (c'est le vrai « conseil d'annonce ») | non | lecture ; droit `sell.inventory` (déjà accordé) | **AJOUTÉ** dans `sante` (« Annonces à corriger ») |
| **Recommendation** `findListingRecommendations` | seulement le **taux de sponsorisation** conseillé (Promoted Listings) | faible : c'est un coût | non | pousser une dépense (§2.9 : rien de payant sans son clic) | **PAS AJOUTÉ** : la promotion existe déjà sur son clic avec le taux qu'il choisit ; un « taux conseillé » par eBay pousse à payer plus |
| **Trading** `GetFeedback` | évaluations **reçues** (score, % positif, 12 mois, dernières) | oui | non (seulement celles à LAISSER) | lecture ; aucune relance (refusé le 11 oct.) | **AJOUTÉ** : `evaluationsrecues` ; le pseudo de l'évaluateur n'est jamais rangé |
| **Fulfillment** `getPaymentDisputeSummaries` | litiges de paiement (motif, montant, date limite) | oui | non | lecture ; droit `sell.payment.dispute` | **AJOUTÉ** : `litiges` (répondre se fait chez eBay, lien) |
| **Post-Order** `inquiry/search`, `casemanagement/search` | réclamations « pas reçu », cas ouverts | oui | non | lecture | **AJOUTÉ** : `litiges` |
| Post-Order retours / annulations | demandes de retour et d'annulation, décision, remboursement | oui | **déjà là** (À traiter) | remboursement et annulation : signature (UE) | **CORRIGÉ** : `issue_refund` et approve/reject **signés** |
| Fulfillment `createShippingFulfillment` (n° de suivi chez eBay) | pousser le suivi | oui | **déjà là** (`expedier`) | l'étiquette reste celle d'eBay (§2.8) | inchangé |
| Negotiation `send_offer_to_interested_buyers` | offre aux observateurs | oui | **déjà là** (`offreinfo`/`offre`, sur son clic) | — | inchangé |
| Trading `GetBestOffers` / `RespondToBestOffer` | offres reçues, y répondre | oui | **déjà là** (Offres) | accepter = vendre : sur son clic seulement | le **nombre** d'offres en attente monte au tableau (lecture) |
| Trading `GetMemberMessages` / `AddMemberMessageRTQ` | messages acheteurs | oui | **déjà là** (Messages · Tous) | réponse sur son clic | le **nombre** sans réponse monte au tableau (le résumé rangé, pas relu) |
| Trading `GetItemsAwaitingFeedback` / `LeaveFeedback` | évaluations à laisser | oui | **déjà là** | sur son clic | inchangé |
| Marketing (campagnes, remises `item_price_markdown`, `VOLUME_DISCOUNT`) | promotion, soldes | oui | **déjà là** (Promotion, Remises) | coût ⇒ son clic ; `applyFreeShipping:false` toujours | inchangé |
| Inventory / Trading `AddFixedPriceItem`, `ReviseItem`, `EndItem`, `RelistItem` | publier, modifier, retirer, relancer | oui | **déjà là** | prix vu = prix envoyé | inchangé |
| Taxonomy / Metadata / Account (catégories, aspects, états, politiques) | publication exacte | oui | **déjà là** (`parametres`) | — | inchangé |
| Logistics (acheter une étiquette) | étiquettes | — | refusé | **§2.8 : VRM n'achète JAMAIS une étiquette** | **REFUSÉ** (inchangé) |
| Notification (eBay pousse les événements) | ventes en temps réel | moyen | non | une 13ᵉ route serait nécessaire (12 max) ou un mode dans `api/ebay.js` ; vérification d'abonnement à faire chez eBay | **PAS AJOUTÉ** : la synchro existante suffit ; à reprendre si Julien veut le « temps réel » |
| Feed (rapports en masse) | exports | faible | non | — | pas ajouté |
| Post-Order « créer une annulation » côté vendeur | annuler une vente | rare | non | compte comme défaut vendeur chez eBay | pas ajouté (eBay → Commandes reste le chemin, et le dit) |

**Droits OAuth ajoutés** (`api/_lib/ebay.js`) : `sell.analytics.readonly`, `sell.payment.dispute`. Comme
`sell.finances` et `sell.marketing` avant eux, ils n'arrivent qu'au **prochain consentement** ; un jeton
sans eux reçoit un 403 que l'écran dit « Reconnecter eBay » pour CETTE partie, le reste marche.

## Ce qui est livré
**Serveur** (12 fonctions inchangées : tout passe par `api/ebay.js`, `action`)
- `api/_lib/ebay-signature.js` : signature RFC 9421 (Ed25519) — `x-ebay-signature-key`, `Signature-Input`,
  `Signature`, `Content-Digest` pour un corps ; `@path` sans la requête ; `refusSignature` (codes 2151xx
  ou le mot « signature ») ⇒ raison `signature`, jamais « reconnecte ».
- `api/_lib/ebay-tableau.js` (LECTURE SEULE) : lecteurs purs à la forme de la doc (`soldeEbay`,
  `versementsEbay`, `transactionsEbay`, `parCommande`, `fraisHorsVente`, `traficEbay`, `annoncesInvisibles`,
  `santeVendeur`, `serviceClient`, `resumeConformite`, `violationsEbay`, `evaluationsRecues`,
  `litigesPaiement`, `reclamationsEbay`) et la fabrique des actions `argent`, `trafic`, `sante`,
  `evaluationsrecues`, `litiges`, `tableau` (tout en UN aller-retour, chaque partie avec son état).
- `finances` corrigé (apiz + signature) ; `rembourserretour` et `decannulation` signés.
- `ebay_versements{suffixe}` : `dates` (n° de commande ⇒ AAAA-MM-JJ du versement ARRIVÉ), le détail par
  commande (net, frais, devise, état), les versements, le solde, les frais hors vente — **aucun acheteur**.
  Fusion : une date déjà lue n'est pas effacée par une lecture qui ne la couvre plus (90 jours) ; une
  commande remboursée PERD sa date ; bornée à 3 000.

**Règles de l'argent** (rien de recalculé autrement)
- Le montant d'une vente eBay reste `montantRecuEbay` (dû au vendeur − frais eBay, jamais le port).
- **CA déclaré daté au versement** : l'app pose `_versementEbay` (lu par projection `d:data->dates`, §4.4)
  sur la commande ; `ventesDeclarables` date la vente au versement ARRIVÉ quand eBay l'a dit, sinon comme
  avant (date de la commande). Miroir serveur refabriqué (`audit-bilan-semaine.cjs --recopie`).
- « Versé ce mois » : versements `SUCCEEDED` du mois **à Paris**, en euros ; « en route » (`INITIATED`) à
  part ; une autre devise n'est jamais additionnée ; pas lu ⇒ « — ».
- Les frais hors vente (sponsorisation `AD_FEE`…) sont **montrés** dans Argent ; ils ne changent PAS le
  bénéfice (une décision à prendre par Julien : les compter dans la marge d'une paire ?).

**App — l'espace eBay** (`src/ebay/EspaceEbay.jsx`, `src/ebay/tableau.js`, `src/ebay/espace-ebay.css`)
- Ventes · eBay : **Tableau** · Commandes · À traiter · Offres · **Argent** · **Santé** ;
  Annonces · eBay : Annonces · **Trafic** · Promotion (`src/navigationTache.js`). `?tab=plat_ebay&section=ventes`
  et `ebay_ventes` mènent toujours aux Commandes (PLACE_SECTION).
- **Tableau** : la bande (à expédier — la règle `colisEbay` —, offres en attente, messages sans réponse,
  versé ce mois) ; « À faire · N » (expédier, litige qui attend sa réponse, annonce à corriger, annonce qui
  ne se voit pas, niveau en danger, reconnecter, signature) ; trois cartes de verre : Argent (disponible,
  en cours, retenu, en route, dernier versement), Trafic 30 jours, Santé (niveau, à corriger, litiges,
  évaluations). Chaque rangée mène à sa section.
- **Argent** : versements, puis par vente (titre et N° de SA commande, par n° de commande — jamais le
  titre), frais réels, « versée le », sponsorisation de la vente ; « mises à part » (autre devise,
  remboursée, montant pas sûr) ; autres frais eBay.
- **Trafic** : « ne se voient pas » (≥ 7 j en ligne, < 50 affichages ; absente du rapport ⇒ « pas de
  chiffres », jamais 0) ; toutes les annonces (40 dessinées, « Tout afficher ») ; lien vers l'annonce.
- **Santé** : niveau et prévu, métriques et seuils, réclamations comparées, annonces à corriger (« Manque :
  Pointure — eBay propose 42, 43 », lien), litiges (à toi d'abord, date limite, lien eBay), évaluations reçues.
- Verre dépoli : titres de groupe en encre claire sur le fond, cartes de verre, ambre = geste, aucun flou
  sur une rangée, 44 px ; 5 langues (`ebt.*`, `nav.sous.ebay.*`) ; « Quoi de neuf » : `ebay-tableau`.
- Rien de perdu : Commandes, À traiter, Offres, Annonces, Promotion, Remises, Messages, Achats, Compte
  sont les mêmes composants, mêmes `data-*`.

## Preuves
- `scripts/audit-ebay-tableau.cjs` — EXÉCUTE `api/ebay.js` contre un faux eBay à la forme de la doc ;
  le faux eBay **vérifie la signature** Ed25519 avec la clé publique : **44 verts** ; `--prouve` **16/16
  mutations rougies** ; `--avant` (arbre de départ 7c5ddaf5) **34 rouges**.
- `scripts/audit-ebay-tableau-app.cjs` — règles du tableau + CA daté au versement (miroir) : **17 verts**,
  **9/9 mutations** (dont le mois de Paris : un versement du 1er à 0 h 30 compte dans le bon mois).
- `scripts/bancs/ebay-tableau.cjs` — rendu réel, 390 tactile clair + 1512 sombre, 1 002 annonces :
  **32 verts** (bande, À faire, cartes, Argent par vente, mises à part, Trafic, Santé, pannes « scope » et
  « signature », aucun débordement, aucun libellé coupé, 44 px, un plein au plus, 40 rangées dessinées sur
  1 002). Le contrôle « libellé coupé » (V8) était ROUGE sur la première version (« 145,40 € ver… ») :
  la bande passe en deux rangées au téléphone. Captures `scripts/bancs/captures/ebay-tableau-*.png`.
- Audits verts : ebay-route (547), offres-auto (26), fonctions-api (12 max), identite, urssaf, traduction
  (45), variables, tdz, studio, csp, icones, coherence, quoi-de-neuf, bilan-semaine (57, miroir refabriqué).
  Rouges HÉRITÉS (les mêmes sur l'arbre de départ) : audit-secrets (une adresse dans src/exempleDonnees.js),
  audit-dates-paris (achatMemeAnnonce, recherchePhrase, soldes — la ligne de src/ebay/tableau.js a été
  retirée), audit-comptes-exclus (module src/versementReleve.js absent de sa copie).
- Bancs eBay voisins, l'arbre de départ (7c5ddaf5, construit à part) puis ce lot, l'un après l'autre :
  ebay-comptes 2 KO / 2 KO (mêmes libellés), ebay-achats-recherche 36 KO / 36 KO, ebay-apres-vente-ecran 7 KO / 7 KO (mêmes libellés ; la
  machine est saturée, les clics « Promotion », « Achats » expirent des deux côtés). Un premier passage
  avait rougi ebay-comptes (« Tous les comptes : ventes ») : `?tab=plat_ebay` ouvrait le Tableau ⇒ un
  ancien lien vers l'espace eBay mène de nouveau aux Commandes (le Tableau s'ouvre par le filtre des sites).

## Gestes de Julien
1. **Clé de signature** (sinon l'Argent eBay reste « eBay demande une signature ») : une session lance
   `EBAY_APP_ID=… EBAY_CERT_ID=… node scripts/ebay-cle-signature.mjs` et pose les deux valeurs sur Vercel
   (`EBAY_SIGNATURE_PRIVEE`, `EBAY_SIGNATURE_JWE`, Production), puis redéploie.
2. **Reconnecter eBay une fois** (Réglages → Comptes eBay) : eBay demande les deux nouveaux droits en
   lecture (trafic/santé, litiges de paiement).
3. Décider : les frais de sponsorisation entrent-ils dans le bénéfice d'une paire ?

## Non mesuré
Toutes les formes (Finances, Analytics, Compliance, Post-Order inquiry/case, payment_dispute, GetFeedback)
et la base de signature (notamment `@path` sans la requête) viennent de la documentation ; aucune réponse
réelle n'a été vue. Une forme inattendue rend « illisible » / « pas su », jamais une liste vide ni 0.

---

# 2e tour (même jour) — « tu peux encore faire mieux » : de la LECTURE aux GESTES

Demande relayée par le coordinateur : passer aux gestes utiles, toujours sur SON clic, aperçu avant,
relu après, journal « Ce que VRM a fait », dans §2.8/§2.9. Fusion d'abord de `origin/claude/project-review-nsk5su`
(dont « Dictionnaires : un seul export default ») : build vert, `audit-traduction` 45 verts.

## Point par point
| # | demande | état |
|---|---|---|
| 1 | Corriger en un toucher les caractéristiques manquantes | **AJOUTÉ** : `corrigeraspects` (api/_lib/ebay-gestes.js). La valeur doit être une de celles que eBay PROPOSE pour CETTE annonce (Compliance relue juste avant) ; une caractéristique déjà remplie n'est jamais écrasée ; toutes les autres sont renvoyées telles quelles (ReviseItem remplace l'ensemble) ; RELU après (GetItem). App : « Pourquoi elle ne se voit pas » ⇒ « Ajouter Pointure : 42 » ; Santé ⇒ « Compléter en un toucher » (les caractéristiques à valeur UNIQUE proposée, la liste montrée dans la confirmation, une annonce après l'autre, arrêt sur un résultat incertain). |
| 2 | Annonces qui ne se voient pas : la raison mesurée et LE geste | **AJOUTÉ** : `diagnostic` (lecture, 10 annonces au plus) : caractéristiques manquantes, moins de 4 photos, prix au-dessus de 115 % de la médiane d'au moins 5 annonces actives COMPARABLES (Browse, jeton d'application : même ePID, sinon Marque + Modèle + Pointure + catégorie + même état ; la sienne et une autre devise exclues) — un CONSTAT sur une annonce en ligne, jamais un prix proposé à la mise en ligne. Gestes : compléter, « Ajouter N photos de ta fiche » (photos de LA fiche du N°, par identité, lues en projection), changer le prix (le prix TAPÉ, `revise` avec le prix vu), relier au catalogue, offre aux observateurs (le geste existant, Annonces). |
| 3 | Catalogue eBay (ePID) | **AJOUTÉ** : `lierproduit` — seulement l'ePID que eBay propose (Compliance PRODUCT_ADOPTION, relu), sans photos ni texte du catalogue (`IncludeStockPhotoURL`, `UseStockPhotoURLAsGallery`, `IncludeeBayProductDetails` à false), relu après, photos vérifiées. |
| 4 | Offres reçues : accepter / refuser / contre-offre | **DÉJÀ LÀ** (Ventes · eBay · Offres, `repondreoffre` : confirmation, offre relue avant, prix vu = prix de l'offre). **Ajouté** : RELU APRÈS (encore en attente ⇒ « pas relu », jamais « fait »). Aucune acceptation automatique (§3 : seul le seuil natif eBay). Raccourci depuis le Tableau. |
| 5 | Remettre en vente (relist) | **DÉJÀ LÀ** (`relanceverif` / `relancer`, Annonces · eBay · inactives, frais lus avant). « Avec les corrections » : la nouvelle annonce se corrige ensuite par « Pourquoi elle ne se voit pas » (ce que eBay demande est relu sur la NOUVELLE annonce). Raccourci depuis le Tableau. |
| 6 | Soldes eBay (remise sur le prix) | **DÉJÀ LÀ** (Annonces · eBay · Promotion · Remises : `item_price_markdown`, `applyFreeShipping:false` toujours, confirmation, 0 € de frais). La sponsorisée reste montrée avec son coût (inchangé). Raccourci « Soldes eBay · 0 € de frais » depuis le Tableau. |
| 7 | Calendrier des versements | **AJOUTÉ** : Argent ⇒ « Calendrier des versements » (en route avec sa date, « au prochain versement » = le disponible, arrivés depuis 7 jours, ratés en ambre) ; Ma journée ⇒ UNE ligne quand un versement eBay est en route ou arrivé depuis 3 jours (lue dans `ebay_versements`, aucun appel à eBay à l'ouverture ; le Tableau y range les versements lus). eBay ne dit PAS la date du prochain versement non lancé (pas dans la Finances API) : « au prochain versement, selon ton rythme eBay », jamais une date devinée. |
| 8 | Multi-sites (.de/.it/.es) | **CONSTAT, rien construit** — voir ci-dessous. |

## Multi-sites : ce qui existe, ce qui manque
- **Existe** : un compte eBay par site (FR, UK, US, DE, IT, ES — `api/_lib/ebay-marches-table.js`) ; chaque
  requête parle au marché DU compte (SiteID, marketplace, devise, domaine) ; publier sur un compte d'un site
  non géré ou pas relu est refusé ; le CA écarte et nomme une vente en GBP/USD ; .de/.it/.es sont en EUR donc
  comptés. Le Tableau, l'Argent, le Trafic et la Santé suivent le marché du compte (`marcheCourant`).
- **Manque** : publier la MÊME paire depuis le compte FR sur .de/.it/.es (une annonce par site : titre et
  description traduits — §2.9 : sans IA payante, ou le traducteur de Chrome —, catégories et noms de
  caractéristiques du site, politiques de retour du pays) ; la visibilité internationale native d'eBay
  (option payante par annonce : sur son clic, coût dit) ; les comparables de prix par site. À décider par Julien.

## Preuves (2e tour)
- `scripts/audit-ebay-gestes.cjs` — EXÉCUTE la route contre un faux eBay qui GARDE l'état de l'annonce et
  l'applique comme eBay : **30 verts**, `--prouve` **14/14** mutations rougies (écrire sans clic, valeur hors
  propositions, écraser, perdre les autres caractéristiques, sans relecture, ePID non proposé, photos du
  catalogue, nombre de photos vu, photos remplacées, comparables sans minimum / avec la sienne / sans l'état,
  offre à un prix différent de l'aperçu, offre sans relecture), `--avant` **23 rouges**.
- `scripts/bancs/ebay-tableau.cjs` : G1–G7 (pourquoi, Annuler ⇒ rien, confirmé ⇒ une caractéristique avec
  `confirme`, photos de LA fiche + nombre vu, liste des évidentes montrée avant, calendrier, Ma journée) ;
  G1b (titres de la feuille lisibles) **rouge** sur la build d'avant la correction CSS.
- Après le 2e tour (build neuve) : ebay-tableau **40/40** ; ebay-comptes 3 KO (« déconnecter le compte 3 » ×2,
  « publier une paire libre » — les mêmes libellés que l'arbre de départ, qui en a donné 2 ou 3 selon la charge) ;
  ebay-apres-vente-ecran 7 KO (= l'arbre de départ). Audits verts : variables, tdz, identite, urssaf, studio, csp,
  icones, ebay-route (547), offres-auto, fonctions-api (12), quoi-de-neuf, traduction (45), coherence,
  ebay-tableau (44), ebay-tableau-app (17), ebay-gestes (30), bilan-semaine (57).
- Gestes de Julien inchangés (clé de signature, reconnecter eBay une fois) ; aucun nouveau droit OAuth au 2e tour
  (Compliance et ReviseItem utilisent `sell.inventory` / le jeton Trading déjà accordés ; Browse : jeton d'application).
