# VRM — audit « plateformes » : eBay, Leboncoin, compta, extension (1er nov. 2026)

Arbre audité : `origin/main` f04af748 (branche locale `audit-plateformes`, rien modifié, rien commité).
Hors champ (traité ailleurs, pas recompté) : Vestiaire dans double vente/CA/colis, N°/notifications/widget/« déclarer perdue », multi-vendeurs, deux appareils / >1000 lignes, chargement/hors ligne/iOS.

Comment j'ai prouvé :
- lecture du code (fichier:ligne ci-dessous) ;
- un banc jetable qui EXÉCUTE les vraies règles de compta tirées de `src/App.jsx`
  (même découpe que `audit-urssaf.cjs`) sur un jeu de ventes inventé à la vraie forme :
  `/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/plateformes/compta.cjs`
  (lancé avec `TZ=Europe/Paris node compta.cjs <racine> finished`) ;
- 18 audits du dépôt relancés sur cet arbre, tous verts (§D).

Gravité : **bloquant** · **grave** · **gênant** · **détail**. « vérifié » = prouvé par exécution ou par une lecture sans ambiguïté ; « à vérifier » = il manque une mesure réelle (compte eBay, texte officiel).

---

## A. Défauts, du plus grave au moins grave

### P1 — GRAVE · Une commande eBay remboursée en partie sort du CA déclaré, du « vendu » et du bénéfice, sans que rien ne le dise (vérifié, banc)
- **Scénario** : une commande eBay de 70 € (frais 9 €) ; Julien rembourse 10 € pour un défaut ⇒ eBay passe `orderPaymentStatus` à `PARTIALLY_REFUNDED`. Le mois d'après, la carte URSSAF ne la compte pas, ni au total ni dans « écartées » : elle n'existe plus nulle part.
- **Où** : `src/App.jsx:6290` (`ventesDeclarables` : `!== 'PAID'` ⇒ `continue`, avant la liste `ecartees`), `src/App.jsx:6368` (`ventesFaites`), `src/App.jsx:6119` (`ventesAutresBenefice`), et la copie du serveur `api/_lib/ventes-regle.js:148,188` (bilan de la semaine).
- **Preuve** : banc `compta.cjs`, commande `C` (`PARTIALLY_REFUNDED`, 70 € − 9 €) : absente de `lignes`, absente de `ecartees` (on n'y trouve que la commande en livres sterling), `ventesFaites.ecartees = 1`. Le détail d'une commande dit pourtant « Remboursement partiel à vérifier » (`api/_lib/ebay-etat-commande.js:10`, `src/ebayParcours.js:9`) : l'écran de la commande le sait, la compta l'oublie. C'est un total partiel présenté comme complet (§5 « Les chiffres »).
- **Correction** : une commande `PARTIALLY_REFUNDED` va dans `ecartees`, avec la raison « remboursement partiel — montant à vérifier » (tant que la forme réelle de `totalDueSeller` après remboursement n'est pas mesurée), dans les trois règles ; puis `--recopie` pour `ventes-regle.js`.

### P2 — GRAVE · Acceptation automatique Vinted : une offre est acceptée sur une paire déjà vendue ailleurs (vérifié par lecture ; aucun audit ne couvre le cas)
- **Scénario** : moteur allumé, prix mini à 60 € posé à côté du N° 42. La paire se vend sur eBay ou sur Leboncoin ; l'annonce Vinted est encore en ligne (« à retirer de Vinted »). Un acheteur Vinted propose 62 € ⇒ 3 à 20 min plus tard, l'extension accepte. L'acheteur paie : la paire est vendue deux fois.
- **Où** : `vinted-sync-extension/background.js:8337-8384` (`autoAccepterOffres`) ne lit que les réglages (`offreAutoReglages`, 8269) et les offres des conversations captées (`offresEnAttente`, 8286). Aucune lecture de « vendue / engagée ailleurs », de « à retirer », ni de l'état de l'annonce. Le mini reste rangé dans `vinted_annonce_numeros` après la vente. Les 17 contrôles de `audit-moteur-offres.cjs` (relancé, vert) ne contiennent pas ce cas.
- **Correction** : avant chaque acceptation, l'extension lit une liste publiée par l'app des items Vinted « à retirer / vendus ailleurs », et refuse d'accepter (sans rien deviner) si l'item y est ou si la liste n'a pas pu être lue.

### P3 — GRAVE · Un compte eBay au jeton refusé (mot de passe changé, accès retiré, 18 mois écoulés) reste affiché « relié », et chaque geste répond « Impossible de rafraîchir le jeton eBay » sans dire quoi faire (vérifié par lecture)
- **Scénario** : Julien change son mot de passe eBay. VRM affiche toujours « relié » ; Synchroniser, Publier, Retirer… répondent tous « Impossible de rafraîchir le jeton eBay ». La relecture de fond recule en silence (10, 20, 40, 60 min) : Colis, le bénéfice et l'anti double vente eBay se figent sur la dernière lecture, et rien ne le signale.
- **Où** : `api/_lib/ebay.js:496-513` (`accessToken` : un refus d'eBay, `invalid_grant` en 400, devient `reason:'refresh-failed'` avec un message sans geste) ; `api/ebay.js:2015` (`relie` = « un jeton est rangé », jamais « eBay l'accepte ») ; `src/App.jsx:21604` (« relié ») ; `src/App.jsx:19921` (seul `not-connected` est traité, le reste recule sans rien dire). Aucun code de `src/` ne lit `refresh-failed`.
- **Correction** : sur un 400/401 `invalid_grant`, le serveur répond `reason:'reconnecter'` et note `refusLe` sur le compte ; `status` rend alors `relie:false`, l'écran affiche « plus relié — reconnecte-le », et l'erreur porte ce geste.

### P4 — GRAVE si vrai · Le port eBay est peut-être compté dans le CA déclaré et le bénéfice (à vérifier : aucune commande eBay réelle mesurée)
- **Scénario** : avec la livraison gérée par eBay, l'acheteur paie le port. `paymentSummary.totalDueSeller` contient le port d'après la documentation d'eBay (prix, port, et taxes non collectées par eBay). eBay le reprend ensuite pour payer l'étiquette. Si c'est le cas, le CA déclaré compte une recette que Julien ne garde pas, ce qui contredit §2.8 (« le port n'est ni une recette ni une charge »).
- **Où** : `src/App.jsx:6098-6107` (`montantRecuEbay` = `totalDueSeller − totalMarketplaceFee`). L'historique le dit lui-même : `docs/passation/historique-ebay.md:1726` (« vraie forme de totalDueSeller non mesurée… s'il contenait le port, il faudrait le retirer aussi »).
- **Correction** : à la première commande réelle, comparer `totalDueSeller` avec `pricingSummary.priceSubtotal` et `pricingSummary.deliveryCost` ; si le port y est, retirer `deliveryCost` dans `montantRecuEbay` (une seule règle, puis `--recopie`).

### P5 — GÊNANT · ACRE : 6,3 % est peut-être un taux périmé (à vérifier sur urssaf.fr)
- **Où** : `src/App.jsx:5735` (`TAUX_MICRO.acre = 6.2`, soit 6,3 % avec la formation professionnelle), proposé dans Comptabilité → micro-entreprise (`src/App.jsx:35089-35114`).
- **Ce que je crois savoir (à confirmer)** : pour une micro-entreprise créée à partir du 1er juillet 2025, l'exonération ACRE passe de 50 % à 25 % (loi de financement de la sécurité sociale 2025 et son décret). Cela donne environ 9,2 % + 0,1 % au lieu de 6,2 % + 0,1 %. Un vendeur qui crée en 2026 et coche « ACRE » sous-estimerait ses cotisations d'un tiers. De plus, l'ACRE ne dure pas « la première année » : elle court jusqu'à la fin du 3ᵉ trimestre civil qui suit la création.
- **Correction** : vérifier le taux sur urssaf.fr, puis distinguer « créée avant ou après le 1er juillet 2025 » (une question de plus), et dire la vraie durée.

### P6 — GÊNANT · CFE : le rappel s'adresse aussi aux micro-entrepreneurs qui n'en paient pas (vérifié par lecture ; règle fiscale à reconfirmer)
- **Où** : `src/microEntreprise.js:186-192` (`rappelCfe` : du 1er novembre au 15 décembre, pour tous) et `src/App.jsx:35243` (« l'avis est à payer… Exonérée l'année de création »).
- **Défaut** : un micro-entrepreneur dont le CA de N-2 est sous 5 000 € n'a pas de cotisation minimum de CFE (art. 1647 D du CGI). Un petit revendeur lit « à payer » alors qu'il ne doit rien. Ça tombe dès aujourd'hui (fenêtre ouverte le 1er nov.).
- **Correction** : ajouter « sauf si ton chiffre d'affaires d'il y a deux ans était sous 5 000 € — tu ne reçois alors pas d'avis » ; ou, mieux, se taire quand le CA N-2 publié est sous 5 000 €.

### P7 — GÊNANT · eBay : le CA déclaré est daté à la commande, pas au versement (vérifié, banc)
- **Scénario** : une commande eBay passée le 31 octobre à 23 h 30 UTC, payée au vendeur début novembre. Elle tombe dans le mois de la commande, alors que Vinted est daté au versement (« LE CA DÉCLARÉ EST DATÉ AU JOUR DU VERSEMENT », §5).
- **Où** : `src/App.jsx:6299` (`Date.parse(e.creationDate)`). Le commentaire 6158 l'assume (« eBay : date de la commande payée »), mais l'écran ne le dit pas à côté du total, contrairement à Leboncoin (« date de vente, et l'écran le DIT »).
- **Preuve** : banc, commande `A` (31/10 23:30Z) ⇒ rangée en `2026-11` (minuit à Paris) ; aucune date de versement eBay n'est lue nulle part.
- **Correction** : au minimum, la phrase « eBay : daté au jour de la commande » sous le total (comme Leboncoin) ; à terme, la date de versement lue dans l'API Finances (`payouts`).

### P8 — GÊNANT · eBay ne supprime aucune donnée quand un utilisateur eBay ferme son compte (vérifié par lecture ; conformité)
- **Où** : `api/ebay.js:1811` : `POST ?mode=deletion` ⇒ `200 {ok:true}`, rien d'autre. Ni signature vérifiée, ni données effacées.
- **Défaut** : l'engagement pris en s'inscrivant aux notifications « Marketplace Account Deletion » est d'effacer les données de l'utilisateur eBay désigné. Or VRM garde les pseudos et adresses des acheteurs dans `ebay_orders`, et le pseudo du vendeur dans le registre des comptes.
- **Correction** : vérifier la signature (`x-ebay-signature`), puis effacer ou anonymiser, chez tous les vendeurs, les commandes et messages de ce `userId` ou `username`. La ligne n'est réécrite que si la lecture a réussi (§5 « Lectures et écritures »).

### P9 — GÊNANT (à vérifier) · eBay : un jeton neuf est demandé à chaque appel
- **Où** : `api/_lib/ebay.js:496` (`accessToken`) est appelé à chaque action. Une publication en fait 1 + 1 par autre compte (`comptesAVerifier`, `api/ebay.js:877-896`). La relecture de fond toutes les 10 min (`src/App.jsx:19871`) en fait 144 par jour et par compte, app ouverte. Le jeton utilisateur (~2 h) n'est jamais gardé, alors que le jeton d'application l'est (`jetonApplication`).
- **Risque** : les échanges `refresh_token` comptent sur l'identifiant d'application de VRM, qui est le même pour tous les vendeurs. Avec plusieurs vendeurs, un plafond d'appels OAuth d'eBay ferait tout échouer d'un coup, avec le message de P3. Le plafond réel est **à vérifier** dans « Application Growth Check » chez eBay.
- **Correction** : garder le jeton utilisateur côté serveur (ligne `ebay_tokens{suffixe}`, `access`, `expireA`) et le réutiliser jusqu'à 5 min avant son expiration.

### P10 — DÉTAIL · Le plafond d'actions s'ouvre si le stockage de l'extension ne répond pas (vérifié par lecture)
- **Où** : `vinted-sync-extension/background.js:10500` (`compterActionUn`) et `10540` (`compterLectureUn`) : `catch ⇒ { ok: true, n: 0 }`. Si `chrome.storage.local` lève une erreur (quota plein, profil abîmé), toutes les actions passent sans être comptées.
- **Correction** : `catch ⇒ { ok:false, code:'stockage' }`. Le garde-fou se ferme : un geste refusé coûte moins qu'un compte bloqué par Vinted.

### P11 — DÉTAIL · Un refus automatique avec message coûte 2 requêtes Vinted mais n'en compte qu'une (vérifié par lecture)
- **Où** : `vinted-sync-extension/background.js:8327-8333` : après le `PUT …/reject` (compté par `garde`), le `POST …/replies` part par `vintedSend` sans être compté.
- **Correction** : faire passer le message par `garde` (ou réserver 2 places avec `compterAction(uid, plafond, 2)`).

### P12 — DÉTAIL · eBay : trois gestes « qui engagent » ne demandent pas de confirmation côté serveur (vérifié par lecture)
- `publish` sans `agent:true` (`api/ebay.js:937`) et `revise` (changement de prix, `api/ebay.js:622`) n'exigent pas `confirme:true`, alors que `programmer`, `retirer`, `regleoffre` et `modifierannonce` l'exigent. La garde « l'agent ne publie qu'après ton oui » repose donc sur un drapeau que le navigateur choisit d'envoyer.
- **Correction** : exiger `confirme:true` pour `publish` et pour `revise` avec prix, comme pour le reste.

### P13 — DÉTAIL · eBay : une description contenant `]]>` casse le XML de la publication (vérifié par lecture)
- **Où** : `api/ebay.js:711` (`<![CDATA[${description}]]>`, sans échappement).
- **Correction** : découper `]]>` en `]]]]><![CDATA[>`.

---

## B. Les calculs refaits à la main (banc `compta.cjs`, vraies fonctions de `App.jsx`, heure de Paris)

Jeu de données inventé à la vraie forme : Vinted `price:{amount}` et versements par `transaction_id` ; eBay `paymentSummary.totalDueSeller`/`totalMarketplaceFee` ; Leboncoin `isSeller`, `txId`, prix en centimes, `parcelColor`, date posée à la main par `vrm_lbc_dates`.

| vente | attendu à la main | l'app | |
|---|---|---|---|
| Vinted 1 · vendue le 30/09, versée le 02/10 · 80,00 € | octobre | octobre, 80 | ✅ |
| Vinted 2 · versée le 01/11 à 00 h 30 (Paris) · 45,50 € | novembre | novembre | ✅ |
| Vinted 3 · « Remboursement effectué » · 999 € | hors CA | hors CA | ✅ |
| Vinted 4 · finalisée, sans date de versement · 33,33 € | « à dater » | `aDater` | ✅ |
| Leboncoin · datée à la main le 15/10 · 5 000 c | octobre, 50,00 | octobre, 50 | ✅ |
| eBay A · 100,00 − 13,20 € de frais, commande le 31/10 23:30Z | 86,80 € | novembre, 86,80 (date de commande, voir P7) | ⚠️ |
| eBay B · en livres sterling | écartée et dite | `ecartees`, « devise GBP » | ✅ |
| eBay C · `PARTIALLY_REFUNDED` | au moins dite | **absente partout** | ❌ P1 |

Totaux : octobre 130,00 € ⇒ 130 × 12,4 % = 16,12 € (l'app : 16,12 ✅) ; novembre 132,30 € ⇒ 16,4052 ⇒ 16,41 € (l'app : 16,41 ✅).
Arrondis : 157 € ⇒ 19,47 € ✅ (19,468) ; 0,1 + 0,2 ⇒ 0,04 ✅ ; 1 234,56 € ⇒ 153,09 € ✅ (153,0854).
Taux : 12,4 % par défaut ✅ ; libératoire 13,4 % ✅ ; ACRE 6,3 % (⚠️ P5).
Calendrier (lu dans `api/_lib/urssaf-regle.js`, copie jugée identique par `audit-rappel-urssaf`) : mensuel ⇒ dernier jour de M+1 ✅ ; trimestriel ⇒ 30/04, 31/07, 31/10, 31/01 ✅ ; le rappel se tait tant que la période n'est pas finie ✅. Une note : l'URSSAF fait saisir le CA à l'euro près, d'où le « ≈ » devant « à payer », qui est juste.
Seuils 2026 (`src/microEntreprise.js:27-34`) : plafond 203 100 €, TVA 85 000 € et 93 500 €, avec la règle N-1 ⇒ TVA au 1er janvier et la règle du dépassement du seuil majoré ⇒ TVA tout de suite ✅. Sortie du régime après deux années au-dessus du plafond ✅.
DAC7 (`src/App.jsx:6444-6447`) : 30 ventes ou plus, OU strictement plus de 2 000 €, comparés en centimes ✅ (le texte européen exclut « pas plus de 2 000 € »).
« Encaissé » : absent de l'écran (`audit-urssaf` vert). « Au moins » : posé sur la couverture partielle (`montantPeriodeUrssaf`) ✅.
Abonnement : 16,99 € partout (`api/compte.js:171` `PRIX_CGV` 1699, `src/App.jsx:57189`, `src/accueil-reglages.js:28`, `public/legal/cgv.html:19,25`) ✅ ; `audit-abonnement` vert (104 contrôles).

---

## C. Vérifié sans défaut (pour ne pas y revenir)

**eBay**
- Prix vu = prix envoyé (`prixLu` strict, « 1.250 » et « 74 € » refusés). `revise` exige `prixVu` relu chez eBay dans la même devise (`api/ebay.js:622-650`). `modifierannonce` exige `expectedPrice` (`ebay-gestion.js:175`).
- Jamais « livraison gratuite » : livraison gérée par eBay par défaut, et un port non nul obligatoire sinon (`livraisonDe`, `api/ebay.js:840`). Aucun appel d'achat d'étiquette (aucune route `shipping/label` dans `api/`).
- Offres : seul `BestOfferAutoAcceptPrice` est posé, après confirmation et avec une garde sous la moitié du prix. Aucune route `RespondToBestOffer` n'accepte toute seule : il faut `repondreoffre` + `confirme`.
- Une paire, une annonce : relu chez eBay, sur tous les comptes, sur chaque site (`dejaChezEbay`). Plus de 1 000 annonces ⇒ refus « pas su ».
- Multi-sites : un marché inconnu ou illisible ⇒ rien n'est publié (`api/ebay.js:2097-2104`) ; une autre devise ⇒ écartée.
- Retrait automatique : SKU relu chez eBay, date de mise en ligne antérieure à la vente Vinted, réglage relu côté serveur, journal en comparer-et-échanger (`audit-ebay-retrait-auto` : 62 verts).
- Agent : `confirme` exigé pour publier, journal avant et après, résultat incertain ⇒ « relis » (`api/_lib/ebay-agent.js`).
- Gestes après la vente (`expedier`, `rembourserretour`…) : `confirme` vérifié avant même d'aller chercher le jeton.

**Leboncoin**
- Supprimer : `confirme`, 10 par heure en `chrome.storage` (sous §4.9), compte de l'onglet vérifié, une action à la fois, issue incertaine dite (`background.js:15821-15890` ; `audit-lbc-supprimer` : 30 verts).
- Publier sans booster : options décochées puis revérifiées, bouton qui nomme une option jamais cliqué, prix de la page comparé à celui de VRM (`lbc.js:1131-1290`).
- Date posée à la main : une date lue gagne toujours (`avecDatesLbc`, `App.jsx:6219`).
- Argent : `audit-argent-lbc` (12) et `audit-lbc-finalisee` (20) verts.

**Extension**
- Plafonds 50 actions/h et 20 lectures/h en `chrome.storage.local`, une écriture à la fois (`audit-compteurs-concurrents` : 11 verts). Réserve de 5 gestes. Une republication réserve ses 3 places, et les rend si elle s'arrête.
- Mises en ligne planifiées : la file vit dans `vrmRepubAttente` et se relance après la mort du service worker. Un job resté « en cours » est repris comme « incertain ».
- Offres auto : éteintes par défaut, `null` (pas su) ⇒ éteintes, délai aléatoire de 3 à 20 min, chaque offre une fois, `garde` à chaque geste (`audit-moteur-offres` 18, `audit-offres-auto` 27 verts). Seule faille trouvée : P2.
- Zip = un dossier `VRM-extension/` en 5.299.0, avec la même version dans `CODE_VERSION` (`background.js:18`) et `EXT_ATTENDUE` (`App.jsx:163`) (`audit-extension-zip` : 19 verts). Firefox et Orion : manifestes fabriqués à part par `scripts/zip-extension.cjs` (`background.scripts`, `gecko.id vrm@vrm.center`) ; `audit-extension-navigateurs` : 124 verts. L'installation sur un vrai iPhone reste à faire.
- Relais du téléphone (`audit-relais` : 32), favoris « comme Vintex » (`audit-favoris-vintex` : 18), republication dans l'ordre coffre → supprimer → brouillon → mise en ligne (`audit-republier` : 14) : verts.
- §4.9 : les variables de module de `background.js` (environ 90, relues) ne sont que des verrous, des chaînes de promesses ou des mémos à perte sans danger. Le tampon `_lbcCatTampon` est documenté : son empreinte n'est notée qu'une fois écrit.

---

## D. Audits relancés sur cet arbre (tous à 0, aucun ❌)
`audit-moteur-offres` 18 · `audit-compteurs-concurrents` 11 · `audit-extension-zip` 19 · `audit-extension-navigateurs` 124 · `audit-republier` 14 · `audit-favoris-vintex` 18 · `audit-relais` 32 · `audit-offres-auto` 27 · `audit-ebay-route` 536 · `audit-ebay-retrait-auto` 62 · `audit-lbc-supprimer` 30 · `audit-urssaf` 87 · `audit-suivi-urssaf` 22 · `audit-benefice` 47 · `audit-abonnement` 104 · `audit-argent-lbc` 12 · `audit-lbc-finalisee` 20 · `audit-ebay-colis` (vert).
Journaux : `/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/plateformes/*.log`.
Aucun de ces audits ne couvre P1, P2 ou P3 : chacun demande un contrôle neuf, qui doit échouer sur le code actuel (§6.1).

## E. Ce qui reste à vérifier (mesures réelles)
1. La forme réelle de `totalDueSeller` sur une commande eBay en livraison gérée (P4) et sur une commande remboursée en partie (P1).
2. Le taux ACRE 2026 et sa durée (P5) ; l'exonération de CFE sous 5 000 € (P6) — sur urssaf.fr et impots.gouv.fr.
3. Le plafond OAuth d'eBay pour l'application VRM (P9).
4. Le comportement d'Orion sur un vrai iPhone avec `VRM-Orion.xpi` (MV2 et `compat-orion.js`).
