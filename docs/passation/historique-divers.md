# Historique — divers

> Texte déplacé TEL QUEL depuis `CLAUDE.md` le 31 octobre 2026 (allègement du dossier : 1,36 Mo → moins de 60 Ko).
> Rien n'a été réécrit : les paragraphes gardent leur ordre d'origine. Le classement par thème est automatique (mots du titre) — en cas de doute, chercher par `grep` dans tous les `docs/passation/historique-*.md`.

# VRM — dossier de passation

> **31 octobre — tournée de TOUS les bancs (183) et audits (160), après les chantiers du 27-29 :** 5 défauts de l'app
> corrigés : (1) la purge d'un compte supprimé pour de bon ne vidait plus rien — le filtre `fetch` du 29 oct.
> (`src/comptesSupprimes.js`) lui cachait ses lignes ; une lecture qui doit les voir passe `{ vrmVoirSupprimes: true }`
> dans `init` (jamais un en-tête) ; (2) Leboncoin : `Card/Titre/Sous/Groupe` définis DANS le rendu de `LeboncoinScreen`
> remontaient les cartes à chaque rendu (le bouton « Publier » remplacé sous le doigt) ⇒ sortis du composant ;
> (3) la table « qui remplace qui » (reprise du N°) lue deux fois par ouverture d'écran ⇒ une fois ; (4) « Annonces à
> compléter » se tait à 0 (lecture complète) ; (5) `data-plantages` posé. ~25 bancs remis à la forme actuelle SANS
> retirer de contrôle — causes récurrentes à connaître : **les panneaux des Paramètres s'ouvrent en sous-écran AUSSI sur
> ordinateur depuis 77633d9 (28 oct.)** (`[data-sous-ouvrir="<id>"]` à cliquer à toutes les tailles) ; le tampon des
> bordereaux exige pdf.js (servi en local par les bancs, comme `imprimante.cjs`) ; le « téléphone épuré » (27 oct.) cache
> `vrm-aide` sous 768 px (juger `textContent`) ; délais fixes remplacés par l'attente d'un état ; `audit-retrait-fiable`
> fixe son horloge (il tombait avec le calendrier). Rouges laissés : `session` G/P (limite Chrome 153, connue) ;
> `mobile`, `profil-avatar` instables sous charge. `audit-preuve-vente` exige l'historique complet (`git fetch --unshallow`).
> `ebay-regle-offre` prend ~18 min (délai ≥ 25 min). ⚠️ Non corrigé, noté : la visionneuse du reçu ne se ferme pas à
> Échap quand le PDF a le focus, et un seul Échap ferme visionneuse ET reçu.

> **28 octobre (nuit, fin) — les ÉTAGÈRES À BACS aussi :** Julien : « fais pareil pour les étagères à bacs ».
> `plateauxReglables` inclut l'étagère à bacs (`ft.bacs`, build métal) : « Plateaux, colonne par colonne »
> (`ChoixPlanches`) ; sans plateau sous une case, son bac descend dans la case du dessous si elle est vide
> (`tasserPlateaux`, cap 1) ; numéros inchangés. 3D : `buildMetal` dessine les morceaux, aucun bac fantôme
> au-dessus d'un plateau qui manque. Banc `stock-finitions.cjs` XII (390/1512 ; règle d'avant ⇒ 2 rouges).

> **28 octobre (nuit, fin) — les PORTANTS aussi :** Julien : « fais pareil pour les portants ». Un portant à cintres
> peut avoir plusieurs BARRES (stepper « Barres », `data-reglage="barres"`, ~80 cm par barre, refusé au-delà du
> plafond ; la barre ajoutée l'est en haut) et « Barres, cintre par cintre » (`ChoixPlanches`). `"r:c"` = la barre de
> la rangée r−1 au cintre c ; la barre du bas est toujours là. Sans barre, le vêtement descend sur la barre du dessous
> si elle est libre (`tasserPlateaux`, cap 1) ; numéros inchangés. `plateauxReglables` inclut le portant ;
> `buildPortant(…, rows, barres)` dessine chaque barre en morceaux (sonde `plateaux` lit aussi un cylindre).
> Banc `stock-finitions.cjs` XI (390/1512 ; mutation « portant hors des plateaux réglables » ⇒ 2 rouges).

> **28 octobre (nuit, fin) — les TABLES aussi :** Julien : « fais pareil pour les tables ». Une table porte des
> plateaux SOUS son dessus : « Niveaux sous la table » (stepper `sous-table`, ajoutés/retirés en bas ; refusé si un
> niveau retiré porte une boîte ou si un niveau déborderait) et « Plateaux sous la table, place par place » (même
> `ChoixPlanches`, le dessus est FIXE : `'1:c'` toujours posé, `data-plateau-fixe`). Sans plateau sous une place, ses
> boîtes tombent au niveau du dessous ou au sol ; numéros inchangés. Capacité d'un niveau = sa hauteur
> (`capaciteCase`). 3D : `buildTable` dessine les plateaux du dessous, morceaux compris. Banc `stock-finitions.cjs` X
> (390/1512 ; mutation « table hors des plateaux réglables » ⇒ 2 rouges).

> **28 octobre (nuit, suite) — les planches COLONNE PAR COLONNE :** Julien : « rends les planches réglables
> colonne par colonne ». `m.planches` garde un NOMBRE pour une planche pleine largeur (forme d'avant, lue telle
> quelle) et une chaîne « r:c » pour un morceau sous la rangée r, colonne c. Une règle : `planchesCases` (lit) /
> `planchesRangees` (range) ; `tasserMeuble` prend les planches de CHAQUE colonne. Éditeur : un morceau par colonne
> entre deux rangées, ⟷ à gauche = toute la largeur. ⚠️ Trouvé au passage : la fenêtre du Stock était un composant
> défini dans `StockMeubles` (`<Modale />`) — chaque rafraîchissement la REMONTAIT et effaçait ce qu'on venait de
> toucher dans l'éditeur ⇒ appelée en fonction (`{Modale()}`). Banc `stock-planches.cjs` (mutation « morceaux
> ignorés » ⇒ 8 rouges).

---

### Les chiffres
- **Le chiffre faux est la porte pour le corriger.** « Coût d'achat · 1/184
  renseigné » ouvre la saisie en série ; on n'ajoute pas un bloc pour ça.
- **Un total partiel qui se présente comme complet est pire qu'un total absent.**
  On somme uniquement ce qu'on connaît, et on affiche la couverture à côté
  (« sur 1 vente sur 175 »). Vaut pour le bénéfice, l'argent en attente, l'URSSAF.
- **Une seule règle par notion, un seul propriétaire** : un écran publie
  (`vinted_nums_physiques`, `vinted_urssaf_mois`, `widget_stats`), les autres
  consomment. Ne jamais recalculer ailleurs.
- ⚠️ **LE CA DÉCLARÉ EST DATÉ AU JOUR DU VERSEMENT** (il l'a redemandé le
  3 octobre — voir « dater au versement » plus bas). Les autres écrans
  (Statistiques, Ma journée) restent datés au jour de la vente.
- **`vinted_urssaf_mois` est synchronisée (17 octobre)**. Elle ne vivait que dans
  le navigateur qui avait ouvert Ventes : Comptabilité ouverte ailleurs disait
  « ton CA déclaré arrive sur cet appareil » (rien ne l'y amenait) sous un
  « Reçu » chiffré. La carte Résultat la relit (nuage, `vrm:save`) et porte
  `data-compta-ca-etat` = `encours` · `passu` (« — », où elle se calcule) · `lu`.
  Banc `chiffres-croises.cjs` D : 3 rouges sur l'avant, rouge sous 2 mutations.
- Le rapport comptable dit « CA des ventes finalisées », **jamais « encaissé »** :
  l'URSSAF demande légalement les recettes encaissées, et l'app ne les connaît pas.
- ⚠️⚠️ **LA PHRASE QUI EXPLIQUE UN CHIFFRE DOIT VENIR DE LA MÊME SOURCE QUE LUI.**
  Vu en capture le 8 septembre, sur la carte du mois du Tableau de bord :
  « À payer (13,5 %) **19,32 €** », et juste dessous « Calculé sur le CA des
  ventes finalisées de septembre (**0,00 €**) ». 19,32 € vient bien de
  **143,10 €** — la ligne publiée par l'écran Ventes ; le `0,00 €` venait de
  l'**ancienne archive**, vide depuis juillet 2026. Les CHIFFRES avaient été
  rebranchés sur le bon propriétaire, **la phrase était restée en arrière** —
  et le commentaire du code disait pourtant que l'archive n'était plus la
  source. Sur l'écran où il décide ce qu'il verse à l'URSSAF.
  ⚠️ Même carte, même passe : « Ventes **26** » à côté d'un montant calculé sur
  **2** ventes finalisées. Un total partiel présenté comme complet est pire
  qu'un total absent : c'est « Ventes finalisées 2 · sur 26 vendues ce
  mois-ci » — la couverture À CÔTÉ, jamais à la place.
  ⇒ Le banc `urssaf.cjs` ne lit **aucun libellé pour juger** : il prend les
  nombres rendus et exige `CA × taux = à payer` et `CA − à payer = net`, plus
  l'égalité avec la ligne publiée. Un contrôle posé sur la formulation serait
  vert le jour où quelqu'un reformule (§6.5). 4 échecs sur le code d'avant.


### ⚠️⚠️ « TOUT PARAMÉTRÉ POUR L'ANNONCE » — LES CODES ARRIVAIENT COUPÉS À 9 000
Demande de Julien, 17 septembre : « qu'elle puisse publier, donc mettre le titre,
la description, les catégories au bon endroit, le prix, en gros tout paramétré
pour l'annonce ».

**Mesuré d'abord, et c'est ce qui bloquait.** Mettre une catégorie au bon endroit
suppose de connaître le **CODE** que Leboncoin attend (`{value,label}`), pas son
libellé. Ces codes passent par **deux** endpoints, tous deux **VUS** dans son
navigateur (`lbc_recon.paths`) : `api/frontend/v1/data/v7/fdata` (le dictionnaire
des attributs — mesuré :
`features.accessories_brand.values.simpleData[{value,label}]`) et
`api/frontend/v1/data/v5/fforms` (les formulaires par catégorie).
Or `lbc_recon.samples` n'a que **six places, prises en ordre d'arrivée** :

| réponse gardée | taille |
|---|---|
| `api.leboncoin.fr/…/v7/fdata` | **9 000** ← coupé |
| `/_next/data/…/nouveautes.json` · `/_next/data/…/my-searches.json` | 9 000 |
| `fast.nexx360.io/booster` · `ib.adnxs.com/openrtb2/prebidjs` · `hbopenbid.pubmatic.com/translator` | 9 000 · 9 000 · 7 119 |

**Trois sur six ne sont pas Leboncoin** : des enchères publicitaires. Elles
passent `AD_HINT` parce qu'une créative porte une adresse en `/ads` (mesuré :
c'est le seul mot qui matche, et il est **au-delà du 9 000ᵉ caractère**), et
elles évincent les seules réponses qui servent. `fforms` n'a **jamais** eu
d'échantillon.
⇒ On n'échantillonne plus que **leboncoin.fr** ; le catalogue a sa **propre
ligne** (`lbc_catalogue`), **une place par endpoint**, gardé **entier**, et il
**DIT s'il a été coupé** — la moitié d'un catalogue a l'air d'un catalogue.
⚠️ **ON N'ANALYSE RIEN POUR L'INSTANT** : 9 000 caractères de `fdata`, zéro de
`fforms`. Écrire l'analyseur aujourd'hui serait deviner. On collecte, la
prochaine passe branche — même méthode que `panel_ebay_form`.
⚠️ **Et `lbc_recon.etapes` est TOUJOURS absente** (dernière visite Leboncoin :
13 septembre, extension d'alors trop ancienne). **Le clic « Publier » ne
s'écrit pas avant d'avoir la carte des étapes** — ça n'a pas bougé.

- ⚠️⚠️ **TROIS LIRE-FUSIONNER-RÉÉCRIRE DE PLUS EFFAÇAIENT LEUR LIGNE.**
  `audit-fusion.cjs` listait les onze du panneau Vinted et s'arrêtait là :
  `storeLbcRecon`, `storeLbcListings` et `storeLbcAccount` écrivaient toutes les
  trois `(rows && rows[0] && rows[0].data) || {}`. Prouvé : `lbc_recon` repartait
  avec **`form:PERDU · etapes:PERDUES`** — c'est-à-dire **la carte du formulaire
  de dépôt**, celle qu'un seul dépôt fait à la main doit remplir. Un timeout
  pendant ce dépôt-là, et il faut le refaire. **3 rouges** sur le code d'avant.
  *Un banc qui énumère à la main ne couvre que ce qu'on a pensé à écrire.*
- §4.4 : `lbc_recon` pèse **67 Ko** et le panneau n'en veut qu'**une** valeur —
  **67 Ko / 725 ms** en entier, **16 octets / 165 ms** projetée, à chaque
  ouverture sur leboncoin.fr.
- `scripts/audit-lbc-catalogue.cjs` exécute le vrai `lbc-inject.js` dans un vrai
  navigateur **et** le vrai `background.js` dans un `vm` : **12 contrôles,
  9 rouges** sur le code d'avant.
  ⚠️ **MON PREMIER JET ÉTAIT VERT SUR LE DÉFAUT** : je servais un corps
  d'enchère **inventé**, qui ne contenait aucun des mots du filtre — il n'était
  donc pas relayé, et le contrôle passait. La forme servie vient maintenant de
  la **vraie ligne** (§6.3, sur le CONTENU cette fois, pas sur la projection).
  ⚠️ Et §6.6 payé cash dans le même banc : **Playwright prend la DERNIÈRE route
  enregistrée en premier** — le fourre-tout `**` avalait la route précise
  `/api/**` et servait du HTML, que `handle` écarte à raison ; le contrôle
  « l'autre sens » sortait rouge sur un code intact.


### ⚠️⚠️ ET LE SECOND DÉPÔT A ENREGISTRÉ TROIS ÉTAPES DE BRUIT
Rangement réparé, il refait le dépôt. **Mesuré** : 3 étapes, même dépôt, ordre et
horodatage corrects — et **aucune n'est le formulaire du milieu** :
- étape 1 : `/deposer-une-annonce`, **1 champ** (`subject`), 0 liste ;
- étapes 2 et 3 : `/deposer-une-annonce/**confirmation**` — la page de FIN — avec
  `high-contrast-toggle`, `search-header-mobile-input`,
  `search-header-extendable-input` et une volée de champs **cachés**
  (`id, ev, dl, rl, if, ts, iw, sw, sh, v, r`, du pistage). Les **quatre
  « listes »** étaient la **barre de recherche** de l'en-tête (« Valider votre
  recherche »).
**1 min 44 s** séparent l'étape 1 de l'étape 2 : l'observateur a tourné pendant
tout le dépôt, et le bruit a consommé les places pendant que la catégorie, les
photos et le prix passaient.
⇒ `estDuDepot` écarte l'en-tête, le pied, la zone de recherche, les `type=hidden`
et ce qui n'a aucune surface — c'est la garde `DANS_ENTETE` d'`ebay.js`, qu'il
fallait ici aussi. La page de **confirmation** n'est plus une étape. Plafond
porté à 24.
⚠️ **Et chaque étape porte désormais la VERSION de l'extension qui l'a écrite** :
sans elle je dois DEVINER si une étape manquante vient d'un défaut ou d'une
version trop ancienne — ce que le dossier interdit explicitement (§8). Trois
étapes, et aucun moyen de savoir laquelle des versions tournait.
- Le banc sert **le bruit réel mesuré** (cet en-tête-là, ces champs cachés-là) :
  sans lui il restait **vert sur le défaut**. **5 rouges** sur le code d'avant,
  qui reproduisent mot pour mot ce qu'il y avait dans sa base.
- ⚠️ §6.3 dans mon propre banc, encore : son faux `chrome.runtime` n'avait pas
  `getManifest`, donc le contrôle de version sortait rouge sur un code intact.


### ⚠️ « QU'UN RESELLER QUI FASSE AUTRE CHOSE QUE DES CHAUSSURES PUISSE L'UTILISER »
Julien, 20 sept. La boutique est en sneakers, et plusieurs endroits étaient
**codés « chaussures »**. Ce qui CORROMPT un article non-chaussure (donc traité
en premier) et ce qui est resté sûr :
- ⚠️⚠️ **LE TITRE FORÇAIT UN SUFFIXE « T{taille} » — même sur une taille LETTRE.**
  `lbcTitre` faisait `' T' + taille` : une taille « M » sortait en « **TM** », « L »
  en « TL ». Mesuré au banc sur le code d'avant : « Nike sweat tech fleece gris
  **TM** ». ⇒ Le « T » n'est une **pointure** que pour un **nombre** : `estPointure`
  (`/^\d{1,2}([.,]\d)?$/`) → numérique = « T42 » · lettre = « M » telle quelle. Et
  l'extraction ne retire le « T » de tête que **devant un chiffre** (`^t(?=\d)` :
  « T40 »→« 40 », mais « TU »/« M » intacts). **La MÊME fonction vit dans l'app
  ET l'extension** (§11) — les deux corrigées à l'identique, `audit-places` exige
  qu'elles rendent le même titre (11 cas, dont 3 non-chaussures).
- ⚠️ **PLUS DE DÉFAUT « Chaussures » CODÉ EN DUR.** `lbcCategory` renvoyait
  `'Chaussures'` pour tout ce qu'aucun mot-clé ne reconnaissait — un reseller de
  vêtements aurait vu « Chaussures » proposée partout. Désormais : familles par
  mot-clé élargies (sacs, vêtements, accessoires, livres, **chaussures**), puis
  **pointure numérique 34–50** (ce qui garde l'auto-catégorie de SES sneakers,
  dont le titre ne dit pas « chaussure »), **sinon `''`** — Leboncoin propose la
  catégorie (il la devine du titre), l'utilisateur choisit. Une catégorie fausse
  fait plus de mal que pas de catégorie (§5, leçon eBay). Les **vêtements sont
  testés AVANT** la pointure (« jean taille 40 » = vêtement, pas du 40).
- ⚠️ **Le panneau ne coche plus « Chaussures » par défaut** : `choisirCategorie`
  et `choisirListe` avaient un repli `'Chaussures'` — retiré. Catégorie inconnue
  ⇒ on ne coche RIEN (l'utilisateur choisit), et le message dit « Choisis la
  catégorie » au lieu de « Vérifie la catégorie « » ».
- **Déjà GÉNÉRIQUE, vérifié** : `remplirComposants` choisit la taille par
  `/pointure|taille|size/` **exact-match** — donc une taille lettre « M » clique
  l'option « M » d'un menu Taille de vêtement, ou ne clique rien (jamais un
  faux). L'ÉTAT, la description structurée (Marque/Taille/État/Couleur), la
  référence `VRM-{n°}`, l'upload photo, eBay (qui réutilise `lbcTitre`) : tous
  indépendants de la catégorie.
- `audit-places.cjs` : **§6.1 prouvé** sur le build d'avant (« sweat … **TM** »,
  « polo … **TL** ») ; après, « … M » / « … L », et app == extension sur les cas
  non-chaussures. Extension **5.96.0**, zip régénéré, `EXT_ATTENDUE` suivie.
  Aucune entrée d'`EXT_CAPACITES` (généralisation, pas promesse neuve).
- ⚠️ **Ce qui reste chaussure-spécifique et MESURÉ tel quel** : `extraireTaille`
  du barème des prix d'achat (§« prix d'achat ») compare des pointures — c'est de
  la SUGGESTION interne, pas une publication, et ça ne casse rien pour un autre
  article (au pire 0 suggestion). Non touché, pas de risque.


### Repère d'achat par modèle (proposition 10, 6 octobre)
Ventes → Analyse de tes ventes → « Repère d'achat par modèle » : par modèle
reconnu dans le titre (`extractModel`), prix moyen de revente (ventes non
annulées, comptes exclus écartés) moins prix moyen d'achat (achats non annulés).
- ⚠️ **Un repère pour acheter, JAMAIS de la compta** : deux moyennes, pas la
  marge d'une paire ; aucune paire n'est reliée à un achat (§5) ; n'entre dans
  aucun total, rapport ni export — l'écran le dit.
- Moins de 3 ventes OU 3 achats d'un modèle ⇒ pas de ligne. Les achats ne sont
  lus qu'à l'ouverture du bloc ; illisibles ⇒ rien n'est calculé, et c'est dit.
- Mesuré chez lui le 5 octobre : Samba +4,60 € (47 achetées / 26 vendues),
  Spezial +20,60 €, Air Max 1 +29,10 €, XT-6 +39,30 €. Seules **8 de ses 401
  paires** ont un prix d'achat saisi : ce repère ne remplace pas la saisie.
- Banc `rapport.cjs` : Samba +20 € (l'annulée à 999 € écartée), Gazelle à une
  seule paire absente ; réaffaibli (annulée comptée) ⇒ rouge.


### Revue contradictoire des trois commits du 4 octobre au soir — 8 défauts confirmés (5 octobre)
Trois relecteurs (un par commit), puis deux sceptiques indépendants par défaut :
**8 confirmés, 0 rejeté**. Tous corrigés, chacun prouvé rouge sur le code d'avant.
- ⚠️⚠️ **« Vendu » inventait des zéros quand les ventes étaient illisibles.** Si
  AUCUNE lecture de ventes n'aboutissait mais qu'une lecture d'annonces
  réussissait, la coque posait `liveStats` à zéro : « Pas encore de vente
  aujourd'hui · Vendu ce mois 0 € », et le **widget de l'iPhone publiait 0 €**.
  Pas su ⇒ chaque chiffre tiré des ventes vaut `null` (`VENDU_PAS_SU`),
  l'écran dit « — » et pourquoi. Un total **partiel** (un compte, Leboncoin ou
  eBay illisibles) **nomme ce qui manque** (`venduManque`), et le widget n'écrit
  **que** un vendu complet — sinon il garde sa dernière photo complète.
  `lbcCoqueLu` et `ebayCommandes` ont maintenant **trois états**.
- **Le vendu était figé à l'ouverture** : masquer une vente (✕), une vente rangée
  par l'extension, minuit (une PWA reste ouverte) ne changeaient rien. `save()`
  émet `vrm:save`, la coque écoute `vrm:ext maj ventes` (relit CE compte) et
  une horloge de jour (`jourCle`). Banc `vendu-recu.cjs` : **51 contrôles, 11
  rouges** sur le build d'avant (minuit compris, avec l'horloge de Playwright).
- ⚠️ **Le relais (`/api/vinted-proxy`) range lui-même les jetons qu'il vient de
  renouveler**, avec la session du vendeur (`modifierCommeVendeur`, RLS : sa
  ligne seulement). Depuis qu'il relit les jetons en base, l'écriture laissée au
  navigateur — qui ne regardait pas `r.ok` — laissait un refresh_token CONSOMMÉ
  en base sur un simple hoquet : compte cassé côté relais. `refreshed.persiste`
  dit s'il a rangé ; sinon l'app réécrit et vérifie. `proxy.cjs` : **4 rouges**.
- ⚠️⚠️ **Le N° d'une paire pouvait être tamponné sur l'étiquette d'une autre.**
  (1) `fetchCapturedLabel` lisait la transaction puis le PDF de `label_latest` en
  DEUX requêtes — l'extension réécrit cette ligne à chaque capture. Une seule
  lecture désormais (`lirePdfLigne(id, 'tx:meta->>tx,…')`). (2) l'index des
  bordereaux captés retenait `label_latest` : `labelsParTransaction` ne garde
  que les `label_{tx}`. `audit-label-latest.cjs` **exécute** les vraies fonctions
  contre une base qui change de version entre deux lectures : sur l'avant,
  « tx annoncée A · PDF de B ».
- **« Tout imprimer » annonçait « 2 sur 3 imprimés »** quand la fusion avait
  écarté un PDF abîmé (commence par %PDF, refusé par pdf-lib) : il compte
  `r.count`, et nomme le PDF illisible. Banc `lot-bordereaux.cjs` (**2 rouges**).
- **Registre annuel** : un compte dont le reçu était illisible disparaissait dès
  qu'un autre compte avait un reçu. Banc `recus.cjs` (**1 rouge**).
- ⚠️ **VINGT-SIXIÈME fois qu'un de mes contrôles crie au loup** :
  `audit-lectures.cjs` exigeait l'orthographe `` select=b:data->>pdfB64` `` ; le
  lecteur accepte maintenant des scalaires dans la même requête. Il suit la
  règle (rien d'autre que `pdfB64` dans `data`, et chaque appel n'ajoute que des
  `meta->>`) — rouge quand on ajoute `pdfTamponneB64` à un appel (prouvé).


### Relier un achat DEPUIS la vente (3 octobre)
Julien : « dans les ventes finalisées / en cours, relier les achats avec les
ventes — un gain de temps de ouf ; même si l'app ne trouve pas, elle fait une
sélection et je tranche. »
- **Mesuré dans le code** : tout existait déjà — le picker `openPicker`/
  `choosePick` (écran Annonces), le classement par `scoreAchat` (même marque/
  taille en tête), `AchatRelie` (photo + reçu), et la carte de vente AFFICHAIT
  déjà l'achat relié (`<AchatRelie entry={e}/>`). **Le seul trou : aucun moyen de
  CRÉER le lien depuis la vente** — on ne pouvait le faire que depuis Annonces.
- Ajouté sur chaque carte de vente (sauf annulée) : **« Relier l'achat »** quand
  aucun coût n'est connu, **« changer »** quand un achat est déjà relié. Le clic
  ouvre le MÊME picker (§11), trié par pertinence — « la sélection » qu'il
  demande ; c'est toujours SON clic qui relie, **jamais un rapprochement
  automatique par titre** (§5, garanti par `audit-identite`).
- **Deux chemins, une seule info** : une vente AVEC identité d'annonce
  (`identiteAnnonce` → item_id) relie la **paire** (`numeros[id]`, partagé avec la
  compta et l'écran Annonces) ; une vente SANS identité relie la **vente**
  elle-même (override `saleOv[tx]`, `_saleTx`). `choosePick` branche sur `_saleTx`,
  `effEntry` fait ressortir `buyFromId`/`buyFrom` de l'override, `linkedBuyIds`
  inclut les deux (un achat déjà relié ne se repropose pas). `withBuyByNum` ne
  remplit que si vide → l'override n'est jamais écrasé.
- Le coût rempli alimente la marge, le bénéfice et la compta par les voies
  existantes (`buyOf`/`benef`), sans second calcul.
- ⚠️ **Non render-vérifié ici** (pas de fixtures dans ce conteneur) : build +
  `audit-identite/chiffres/variables/icones/coherence` verts, la logique réutilise
  le flux déjà éprouvé de l'écran Annonces, mais le rendu de la carte de vente est
  à regarder au banc dès qu'il y a des fixtures. C'est de la plomberie + UI, pas
  une nouvelle règle de rapprochement.


### La version de l'app était tapée à la main, et figée
`BUILD_ID` valait `'v83/00 · Rafraîchissement auto…'` **depuis le 25 août —
81 commits**. C'est le seul chiffre qui réponde à « **est-ce que j'ai bien la
dernière version ?** », la question qu'il pose après chaque déploiement, et le
bouton « Forcer la mise à jour » est juste à côté. Un numéro qui ne bouge
jamais répond donc **le contraire** de ce à quoi il sert.
⚠️ **Et le mécanisme existait déjà** : `vite.config.js` injecte `__BUILD__`,
l'horodatage réel de la compilation, avec en commentaire « sert de version
visible pour diagnostiquer les problèmes de cache » — **lu nulle part**. Même
famille que le tiroir `Nav` défini et jamais rendu (§4.11) : le code est là,
personne ne l'appelle, rien ne lève d'erreur. **Avant d'ajouter un mécanisme,
vérifier que celui qui existe est branché.**
- L'ISO complet est injecté et formaté **côté app**, dans SON fuseau : la
  chaîne tronquée était en UTC et aurait annoncé 12:32 pour un déploiement de
  14:32 — deux heures d'écart sur le seul chiffre censé le rassurer.
- Horodatage illisible ⇒ « **inconnue** », jamais une date inventée.
- `audit-diagnostic.cjs` vérifie la règle : ce qui est affiché doit **dépendre**
  de `__BUILD__`, une chaîne littérale échoue. 2 échecs sur le code d'avant.
- ⚠️ `audit-variables.cjs` a crié au loup : `__BUILD__` n'est déclaré nulle part
  dans le source (Vite le remplace au build). Corrigé en lui faisant **lire les
  `define:` de `vite.config.js`** — pas en mettant ce nom en liste blanche : un
  `__FOO__` non défini doit continuer d'échouer, et c'est vérifié.


### La carte sans clé d'API : OpenFreeMap (21 octobre)
Julien : « trouve autre chose pour la carte, il y a besoin d'une API key ». CARTO
(`basemaps.cartocdn.com`) et les tuiles OSM directes sont retirés partout.
- **Fond** : OpenFreeMap (instance publique : aucune inscription, aucune clé,
  aucun cookie, usage commercial permis), styles `liberty` (clair) et `dark`
  (sombre — « pas encore complet » selon ses auteurs) — ⚠️ remplacés le 22 oct.
  par `positron`/`dark`, MapLibre seul (section suivante). Attribution affichée :
  OpenFreeMap · © OpenMapTiles · © OpenStreetMap. Conditions lues dans les dépôts
  `hyperknot/openfreemap(-styles)` (openfreemap.org bloqué d'ici).
- **Moteur** : `maplibre-gl` 6.11.2 (BSD-3) + `@maplibre/maplibre-gl-leaflet`
  0.1.4 (ISC), calque sous Leaflet (épingles et regroupement inchangés).
  `src/fondCarte.js` (une règle : style, attribution, chargement, WebGL).
  Chargé à l'ouverture de la carte SEULEMENT : 289 Ko compressés + worker 508 Ko
  + CSS 10 Ko ; aucun morceau d'entrée ne le contient (l'audit le vérifie).
- **Repli** : WebGL absent, style ou tuiles en erreur, ou rien au bout de 12 s ⇒
  la communauté en liste (jamais une carte grise). Mini-carte des points relais
  (`FondMiniCarte`) ⇒ fond uni, épingles gardées — ⚠️ elle est injoignable
  aujourd'hui (`openRelayPicker` n'a aucun appelant) : pas de banc.
- **CSP** (✅ fait le 22 oct., « La CSP finie ») : `vercel.json` ne pose que `frame-ancestors` ⇒ rien à changer. Si une
  CSP complète est posée : `connect-src`/`img-src https://tiles.openfreemap.org`,
  `worker-src 'self' blob:`.
- Preuves : banc `communaute.cjs` (OpenFreeMap servi par le banc, `liberty` puis
  `dark` demandés, aucune requête `cartocdn`/`tile.openstreetmap`, fond coupé ⇒
  liste) 144 verts, **8 rouges sur le build d'avant** ; `audit-fond-carte.cjs`
  6 contrôles, 3 rouges sur l'avant.
- **Non mesuré** : la vraie instance OpenFreeMap depuis son téléphone ; WebGL sur
  un vrai iPhone ; le rendu du style `dark`.


### Les formes communes (revue du 16 octobre) — banc `formes-communes.cjs`
Une fonction, une forme. Avant d'écrire un contrôle, **réutiliser** celui-ci :
- **Contrôle segmenté** : `Segmente` (App.jsx) = `.vrm-seg` + `.vrm-seg-btn`
  (styles-coque.css), le même dessin que les sous-onglets des plateformes ;
  `aria-pressed` pour un choix d'écran, `aria-current` pour une section ;
  `plein` = segments égaux. **Jamais de segment bleu plein** (§7). Colis
  (imprimante), Achats, Compta (période), Stock (vues), Réglages (taille de
  l'affichage, détourage) y passent.
- **Filtres** : la rangée porte `vrm-filtres` ; pastille neutre, l'active à
  l'encre (clair) ou en surface élevée bordée (sombre — jamais blanc plein).
- **Replis** : `className="vrm-repli"` sur le `<details>` (et `vrm-label-help`,
  `vrm-quick-settings`, `vrm-ann-stock-tools`, `vrm-platform-summary`) = une
  rangée de 44 px à l'encre, chevron › qui tourne ; ni texte gris, ni triangle
  du navigateur. Ne pas remettre de style en ligne sur le `<summary>`.
- **Lien-texte au doigt** : sans fond, sans bordure, `padding:0` (ou la classe
  `vrm-lien-action`) ⇒ la boîte garde 44 px, une marge négative rend la place
  à la ligne (« tout voir » ne gonfle plus sa rangée à 44 px).
- **Rangée qui défile** (`.vrm-rangee`, `.vrm-carrousel`, `.vrm-defile`) : un
  fondu sur le bord droit, posé seulement si elle DÉBORDE — c'est
  `src/rangeesDefilantes.js` qui mesure (`data-defile="suite"`).
- Sombre : le logo porte un liseré ; un bouton grisé (« Tout générer »,
  « Bordereau ») = l'encre à 46 %, plus « texte secondaire à 55 % en gris ».
- ⚠️ `conflitsDeNumeros` : une **case du garage est un emplacement, pas une
  paire**. Une annonce rangée dans sa case allumait le bloc rouge sur Colis
  (« 5 numérox portés par deux paires », la coquille comprise) pour chaque paire
  rangée. `audit-conflits-numeros.cjs` : 3 rouges sur l'avant.


### Le texte : une ligne, le reste derrière ⓘ
Sur chaque bloc, **au plus UNE ligne visible** (≈ 90 caractères). L'explication
passe derrière `<Pourquoi label="…">` (ⓘ, replié) ou un `<details className=
"vrm-repli">`, ou disparaît si un autre élément de l'écran la dit déjà (§7). Les
libellés sont des mots, les états des pastilles courtes (« À expédier », « Pas
lu »). ⚠️ NE DISPARAÎT JAMAIS (on raccourcit) : un « pas su / pas pu lire », la
couverture d'un total partiel (« au moins », « sur X »), le geste d'une alerte,
le rouge du doublon de N°, les confirmations d'argent (« une offre acceptée vend
la paire »), le panneau Sécurité des données. ⚠️ `innerText` ne lit pas le
contenu d'un `<details>` fermé : un banc qui jugeait une phrase déplacée derrière
ⓘ doit juger la RÈGLE (`data-*`, présence de l'information), jamais être retiré.
Appliqué d'abord à la coque (panneau « Actions possibles / Lecture seule »,
confirmations `askConfirm`/`askText`/choix, feuille « Ranger »).

- Une couleur en dur qui n'est pas dans `THEMES` ne suivra pas un changement de
  palette : `grep -oE '#[0-9a-fA-F]{6}' src/App.jsx` après chaque passe.
- Un emoji utilisé **comme icône** devient une icône au trait (`ICON_PATHS`, qui
  attend du **JSX**, pas une chaîne — sinon rien ne se dessine).
  ⚠️ **Et un nom absent de `ICON_PATHS` ne dessine rien non plus** : `Icon` rend
  `null`, sans erreur ni console. Mesuré le 7 septembre — l'onglet **« Grille »**
  du Garage était sans icône entre « Ma pièce » et « Photos », depuis des
  semaines, parce que `grid` n'avait jamais été défini. C'est la CAPTURE qui l'a
  vu. `audit-icones.cjs` vérifie maintenant tous les noms, y compris ceux qui
  passent par une variable (il regarde ce qui alimente le `<Icon name={…}/>`
  juste au-dessus). ⚠️ Ses deux premiers jets étaient faux dans les deux sens :
  trop timide il ratait `grid`, trop large il criait au loup sur les pays et les
  transporteurs.
- **Quand il dit trois fois « c'est pareil », arrêter de retoucher les teintes et
  aller mesurer la composition** à sa résolution de travail (1512 px, ordinateur).
  Les deux vrais défauts trouvés comme ça : une app mobile étirée sur 1440 px, et
  un accueil qui s'arrêtait au tiers de l'écran.
- **La même phrase répétée sur chaque ligne est UNE phrase.** Quand l'en-tête d'un
  groupe la dit déjà, la ligne ne la reprend que si le groupe est **mixte** — là
  seulement elle distingue. (Achats : 13 × « code pas encore reçu » ; Colis :
  14 × « l'extension le récupère ».) C'est le §11 à l'échelle de l'écran.
- **Une rangée de pastilles défile au doigt, revient à la ligne à la souris** :
  classe `.vrm-rangee` (`nowrap`, puis `wrap` au-delà de 1024 px). ⚠️ Un style
  **en ligne** gagne sur une classe — retirer `flexWrap`/`overflowX` du `style`.
- **Un bouton en `flex:'1 1 …'` sans `maxWidth` s'étire sur 500 px** sur un écran
  large. Toujours plafonner.
- **Sur ordinateur, les actions du haut sont une ÎLE flottante** en haut à droite
  (le bandeau pleine largeur était 56 px de vide au-dessus de chaque titre).
  ⚠️ Tout ce qu'un écran pose sur sa ligne de titre doit passer par le slot
  `right` de `ScreenHead` — sinon ça glisse SOUS l'île et disparaît. Le banc
  `verif_visuel.cjs` mesure ce recouvrement.
  ⚠️⚠️ **ET TROIS ÉCRANS Y ÉCHAPPAIENT PARCE QU'AUCUN BANC NE LES RENDAIT.**
  Mesuré le 7 septembre : les deux bancs de rendu couvraient **10 onglets sur
  15**. `vintedaccounts` (« Comptes liés », ses neuf comptes), `catalog` et
  `stockvinted` se fabriquaient chacun leur propre `<h2>` + bouton — donc
  « ↻ Actualiser », « Exporter Excel » et « Coller en masse » atterrissaient
  **pile sous l'île, invisibles**. Mesure directe sur `vintedaccounts` : bouton
  à `left 1311 · right 1410 · top 30`, île à `left 1301 · top 12 · bottom 59` —
  entièrement dedans. Le contrôle existait depuis des semaines ; ces écrans n'y
  passaient jamais. Les trois écrans sont repassés sous `ScreenHead`, et
  `audit-bancs.cjs` exige désormais que les bancs rendent **tout écran
  joignable** (dans le rail ou visé par un `setTab`).
  ⚠️ *Deux écrans montés restent INJOIGNABLES* (`comptabilite`, `inventory`) :
  aucun appelant, comme le tiroir `Nav`. Ils ne sont pas exigés au banc — tester
  un chemin mort ne prouve rien.
  ⚠️⚠️ **CAUSE ÉLUCIDÉE — et elle corrige ce que j'avais écrit d'abord.** En
  séquence complète, le banc ne signalait pas `vintedaccounts` ; j'en avais
  conclu « le banc peut être aveugle, un écran vert peut être faux ». **C'est
  faux.** Le banc mesurait juste : le bouton était bien à `left 1311` dans les
  deux cas, mais à `top 30` seul (donc SOUS l'île) et à `top 154` en séquence
  (donc dégagé). Ce qui le pousse : le bandeau **« 1 compte est exclu de
  l'application »**, qui n'apparaît qu'une fois `vinted_accounts_hidden` écrit
  dans le navigateur par un onglet précédent.
  ⇒ La vraie leçon : **un écran qui se fabrique sa ligne de titre n'est sous
  l'île que PARFOIS** — selon ce qui s'affiche au-dessus. C'est exactement
  pour ça que le défaut a survécu si longtemps, et pourquoi passer par
  `ScreenHead` compte plus, pas moins.
  ⇒ Et une propriété des bancs à connaître : `localStorage` **survit d'un
  onglet à l'autre** dans le même contexte, donc l'ORDRE des onglets change ce
  qui est rendu. Un banc n'est pas moins fiable pour autant — il faut juste
  savoir qu'il mesure un état, pas une vérité éternelle. *(Corollaire : l'état
  le plus risqué est l'APPAREIL NEUF, celui où rien n'a encore été écrit — c'est
  là que « ↻ Actualiser » disparaissait, et c'est le même terrain que les
  numéros repartis de 1 au montage.)*
  ⚠️ **Cherché, et il n'en reste pas** : deux lignes de titre sont encore
  fabriquées à la main, mais aucune n'est ce défaut — **Leboncoin** est centré
  (`maxWidth 600`), donc structurellement loin de l'île ; **« Ventes (n) »** de
  l'ancienne appli est un titre de SECTION en milieu de page, pas un en-tête
  d'écran. Onze écrans passent par `ScreenHead`. Ne pas refaire cette
  recherche.
- **Le sombre tient par la hiérarchie, pas par la teinte** : rail le plus sombre,
  page au-dessus, cartes encore au-dessus. Quatre unités d'écart, et la barre
  latérale se confond avec la page.
- **Le même nombre ne s'écrit jamais deux fois sur un écran** — surtout pas
  arrondi différemment (« 296 € » et « 296,40 € » le même jour). Et **un `0,00 €`
  qui veut dire « on ne sait pas » s'écrit `—` avec la raison à côté**.
- **Pas de « n/d »** ni d'autre vocabulaire d'informaticien : il n'est pas
  développeur. Un tiret dit « on ne sait pas », la raison en clair dit quoi
  faire. `audit-chiffres.cjs` compte les `n/d` restants — il y en avait encore
  **quatre** sur l'écran Statistiques le 7 septembre, des semaines après la
  règle. ⚠️ Et remplacer un `n/d` par **`0,00 €` est pire**.
- **Une carte qui ne peut RIEN afficher, jamais, n'apprend rien — TRANCHÉ.**
  « CA / jour actif » se calculait sur `receiveDate`, la date d'encaissement
  **retirée exprès de l'app** : 0 jour, donc un tiret que ni une saisie ni une
  synchro ne pourrait jamais remplir. La date de **VENTE**, elle, est connue
  pour toutes les ventes : la carte est devenue **« CA / jour de vente »** —
  mesuré sur ses données, **117,46 € sur 57 jours où il a vendu**. `joursVente`
  est publié par le **même calcul** que `caEncaisse` (§11), sur exactement les
  mêmes ventes finalisées : numérateur et dénominateur parlent des mêmes lignes.
- **« saisis tes prix d'achat » s'écrivait SIX fois sur l'écran Statistiques**,
  en ambre, dans trois groupes — six alertes pour une seule cause, ça se lit
  comme six problèmes. Les cartes gardent leur `—` ; la raison et la **porte**
  vivent une fois par groupe (« La valeur du stock, le bénéfice et la marge
  attendent tes prix d'achat — les saisir → », qui ouvre la saisie en série).
  Mesuré au rendu : **6 → 1**. Et « prix d'achat manquants » disait la même
  chose avec d'autres mots : une cause, une phrase.
  ⚠️ Le drapeau `DEMANDE_SAISIE_PRIX` vit au niveau **module** : au moment du
  clic l'écran Annonces n'est pas monté, un `dispatchEvent` serait perdu.


## 9. Chemins utiles

```
src/App.jsx                     l'app (grep avant de lire — le fichier est énorme)
vinted-sync-extension/          background.js · inject.js · vinted-panel.js · content.js
api/                            email-inbound · push · widget · ship-reminders · ai
scripts/audit-*.cjs             les 84 audits
scripts/bancs/                  les 76 bancs (leur README dit comment les lancer)
scripts/audit-*.cjs             les 156 audits
scripts/bancs/                  les 201 bancs (leur README dit comment les lancer)
docs/journal-2026.md            l'historique complet (pourquoi chaque règle existe)
SECURITE.md · .env.example      ce qui doit rester hors du dépôt
```

Chromium du banc : `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
(`--use-angle=swiftshader --no-sandbox`).

