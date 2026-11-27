# Historique — divers

> Texte déplacé TEL QUEL depuis `CLAUDE.md` le 31 octobre 2026 (allègement du dossier : 1,36 Mo → moins de 60 Ko).
> Rien n'a été réécrit : les paragraphes gardent leur ordre d'origine. Le classement par thème est automatique (mots du titre) — en cas de doute, chercher par `grep` dans tous les `docs/passation/historique-*.md`.

# VRM — dossier de passation

> **1er novembre — audit des parcours métier, défauts A5 à A14 (hors A1, A2, A4, A10 — autre chantier — et A3, qui
> attend Julien : même paire sur deux comptes Vinted).** Julien : « fais tout comme un pro, il ne doit y avoir aucune
> erreur possible ». Corrigé, chaque point EXÉCUTÉ par `scripts/audit-flux-divers.cjs` (26 rouges sur `origin/main`
> f04af748 rejoué par `git archive`, 17/17 mutations attrapées avec `--prouve`) :
> (A5) la notification « double vente » Leboncoin surlignait la PREMIÈRE ligne : `data-lbc-retirer` porte l'identifiant
> Leboncoin d'une annonce reliée, il ne répondait jamais au N° de la notification et le repli `[data-lbc-retirer]`
> prenait la première. Chaque ligne VENDUE porte `data-lbc-retirer-num` (la `cleNum` de chacun de ses N°, lot éclaté,
> séparés par des espaces, visé par `~=`) ; `src/cibleNotif.js` (`cleNumCible`) ne vise QUE ce N° (eBay : la ligne
> « vendue sur Vinted » ou « sur Leboncoin » de ce N°) ; sans N°, le bloc (`data-lbc-retirer-bloc`) ; absente ⇒ une
> phrase qui ne promet plus « réglée ». Banc `lbc-supprimer` § notification (N°14/N°18/N°99, 390 et 1512 px ; la
> N°18 rouge sur l'avant). (A6) « Vendus ailleurs » (`src/bilanSynchronisation.js`) compare par `cleNumSync` (= `cleNum`) :
> « 007 » = « 7 », « B 125 » = « B125 », lot « 12+15 » = les deux cartons ; un lot dont UN N° est ambigu est ambigu
> (compté, rien deviné). (A7) Le conseil d'une offre reçue par email (`api/email-inbound.js`) : `jugerPrixParTitre`
> juge l'ambiguïté sur TOUTES les fiches du titre (une homonyme sans prix rend le cas ambigu) ; plus jamais « ✅ Accepte :
> +X € net » — au mieux « une paire à ce titre a coûté X € (reconnue au titre seulement) : vérifie que c'est elle » ;
> ambigu ⇒ « N paires portent ce titre : ouvre la conversation » ; `buy` rangé seulement si une fiche, marqué
> `buySur: 'titre'`, `net` plus calculé (rien ne le lisait). (A8) Widget « Reçu ce mois » : l'app re-date
> `vinted_urssaf_mois` sur une lecture complète au-delà de 6 h ou au changement de mois (`URSSAF_REDATE_MS`), le
> widget juge donc une LECTURE ; le 1er du mois sans versement ⇒ 0 (`recu` sans le mois = un vrai zéro), plus « — ».
> (A9) « Déclarer perdue » et le récapitulatif de vente ne disent plus « numéro libéré » ni « reste dans ta compta comme
> perte » (aucun calcul ne lit `vinted_pairs_lost`) : « il sort du stock, sa case est vidée, son N° n'est jamais
> redonné, VRM ne compte aucune perte » ; le récap porte `{k, t}` (`data-retour-archive` = `retour`/`renvoi`).
> (A11) `ventesFaites` : une vente Leboncoin datée à la main (`dateSaisie`, rangée à midi) ou lue sans heure porte
> `heureLue: false` ⇒ « sans heure » dans Statistiques, plus dans la case « 12 h ». (A12) `classifyOrderStatus` sort
> aussi tout « …a échoué » (= `PAS_UNE_VENTE`, app ET extension) ; la copie serveur `api/_lib/ventes-regle.js`
> refabriquée (`audit-bilan-semaine --recopie`). ⚠️ Reste UN écart nommé dans l'audit, dans le sens sûr : « Échec du
> paiement » (mot « échec ») est pas vendu pour la compta mais vivant pour `PAS_UNE_VENTE` (extension non republiée
> ici) ; et `transaction_user_status === 'failed'` n'est lu que par la preuve de vente — à aligner à la prochaine
> version de l'extension. (A13) Sous une annonce PROUVÉE partie, même sans offre (`annonceDuFilPartie` : la règle de
> l'offre, datée de la dernière activité du fil), plus aucune réponse rapide « disponible » (`rapidesDuFil`).
> (A14) `api/widget.js` et `api/ship-reminders.js` ne projettent plus `vinted_sales_hidden`.
> Audits rouges sur main remis d'aplomb SANS affaiblir leur règle (c'était l'orthographe qui avait changé, le
> comportement était là) : `facture-achat`/`recu-achat` (l'index des reçus privé des seuls reçus DÉLIÉS par son clic),
> `numerotation-lecteurs` (`{k, t}`), `offre-annonce-partie` ×2 (`RapidesConv`, `badgesNav.messages`), `offres-email`
> (`attrs={{'data-conv': …}}`), `photos-vinted` (`PhotoVc` : https *.vestiairecollective.com seulement, raison écrite),
> `politique-hotes` (`CarteRelais.jsx` → BAN = la ligne « points relais » de la politique, déjà dans `connect-src` ;
> `maps.apple.com` = un lien « Ouvrir dans Plans »), `secrets` (l'adresse de contact publique EXACTE
> `vrm.vinted35+contact@gmail.com`, décision du 31 oct.). `vc-publier` vert seul (rouge sous charge), `renum-b` vert en
> 139 s (le dépassement de 90 s était la limite du lanceur). En passant : banc `double-vente` rouge sur main — la carte
> « vendu sur Leboncoin — encore sur Vinted » écrasait le titre à une lettre par ligne à 390 px (les deux gestes en
> largeur fixe) ⇒ la rangée passe à la ligne (texte ≥ 160 px) ; et le contrôle « rogné » excuse une RANGÉE DÉFILANTE
> (filtres de site, §7 : conteneur qui défile vraiment), jamais un `overflow: hidden`. Après le merge de main
> (multi-vendeurs, Vestiaire partout) : « Vendus ailleurs » garde le `cleNum` importé de main ET les lots éclatés ;
> `audit-xss-facture` (rouge sur main : `generatePDF` appelle `logoFacture`) extrait aussi `logoFacture`, session sans
> propriétaire (la mutation `sanscsp` rougit toujours). Rouge laissé, déjà sur main : le test
> `scripts/tests/bilan-synchronisation-adaptateur.test.mjs` (2 lectures au lieu d'1). Extension inchangée. Geste de
> Julien : aucun.

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


---

## 2 novembre 2026 — audit des données (« chaque donnée au bon endroit », liste E0c)

**Demande de Julien** : « Audite le site : toutes les données qui sont à un tel endroit doivent
correspondre à ce qui est attendu, il ne doit y avoir aucune erreur. Envisage tous les cas de figure
de tous les utilisateurs qu'on peut rencontrer. »

**Méthode.** Point de départ : les rapports du 1er nov. (`audits-2026-11-01/flux.md`, `utilisateurs.md`,
`limites.md`, `ecrans.md`) moins ce qui est déjà corrigé (CLAUDE.md §9, `etat-detaille-…`). Pour chaque
écran, chaque nombre a été suivi jusqu'à sa règle : Ma journée (vendu, reçu, CA, semaine, colis),
Statistiques (tuile Vendu, Finalisé sur Vinted, Finalisé par plateforme, CA par compte), Comptabilité
(périodes, couverture), Annonces (bandeau), Colis (états vides), widget (`caMois`, `caMoisNonComptees`)
et bilan du lundi (`api/_lib/bilan-semaine.js`). Profils joués sur données inventées : vendeur sans compte,
un compte, comptes masqués/exclus, Vinted + Leboncoin + eBay (frais pas encore lus, dollars) + Vestiaire
(montant sûr / pas sûr / annulée / illisible), base lente, prix illisibles, date illisible, 1er du mois à
0 h 30 (Paris). Les 215 audits du dépôt rejoués : 160 verts ; les autres rouges viennent tous de l'environnement
(`@babel/parser` absent, `web-push` 47 fois, `fast-xml-parser` 3, `@maplibre/maplibre-gl-style-spec` 1),
plus `audit-lectures` (sa regex ne trouve plus `recupererLabel` quand le repli sans Babel retire les
commentaires — faux rouge d'environnement : la fonction existe, background.js:13149) et `audit-facture-achat`
(la route email-inbound ne se charge pas sans `web-push`).

**Défauts trouvés et corrigés** (tous prouvés par `scripts/audit-donnees-ecrans.cjs` : **30 rouges sur
`origin/main`, 0 après, 13/13 mutations tuées**) :

- **G1 — eBay aux frais pas encore lus : un « vendu » partiel présenté complet.** `ventesFaites` comptait
  la commande dans `ecartees` (un nombre) et nulle part ailleurs : Ma journée, Statistiques, le widget
  (`caMoisNonComptees`) et le bilan du lundi disaient le total sans « au moins ». Chaque vente eBay récente
  était concernée (les frais arrivent après le paiement). ⇒ la commande va aussi dans `nonComptees`
  (raison « frais eBay pas encore lus » ou « devise USD », avec sa date) ; au CA déclaré elle est `manque`
  (carte URSSAF, widget, Compta disent « au moins »). La phrase de Compta « N commandes eBay écartées » est
  retirée : la même vente est dite dans « Pas dans « vendu » » (une phrase, §7). Miroir serveur
  `api/_lib/ventes-regle.js` modifié à l'identique (l'audit vérifie l'égalité ; `--recopie` d'audit-bilan-semaine
  exige `@babel/parser`, absent ici — le texte a été recopié mot pour mot et comparé).
- **G2 — « dimanche 1 novembre »** en tête de Ma journée ⇒ `dateJourFr` (« 1er »).
- **Finalisé par plateforme (Statistiques)** : Vestiaire affichait « pas encore de vente captée » EN DUR
  alors que ses ventes au montant sûr comptent dans Ma journée/Compta/URSSAF ; un prix Leboncoin inconnu y
  valait 0 €. ⇒ `caVestiaireFinalise` (mêmes règles `montantRecuVc`, étape versée/terminée ; pas sûr ⇒ « — »
  + raison ; illisible ⇒ « pas lues ») ; Leboncoin au prix inconnu ⇒ « — » + « N ventes au prix inconnu ».
- **Statistiques, tuile « Vendu »** : ne disait « au moins » que pour un compte non lu ; les ventes de la
  période au montant pas lu (`venduNonComptees`) ⇒ « au moins » et « N non comptées » (infobulle = la phrase).
- **« Finalisé sur Vinted » / CA par compte / par jour** : un prix illisible valait 0 € muet (ou `NaN`) dans
  la boucle de la coque ⇒ `montantCommandeLu`, compté à part (`prixPasLu`) et dit (« au moins », une ligne).
- **Annonces, bandeau** : « NaN € de valeur » sur un prix illisible (limites n°13) ⇒ seuls les prix lisibles,
  « au moins … (prix lu sur N) ».
- **« Invalid Date »** sur 9 dates de vente (Colis, Ventes, récap, exports) ⇒ `dateFr` (« date inconnue »).
- **Base lente (limites n°3)** : Ma journée disait « Lie un compte Vinted » avant le retour de la liste des
  comptes ⇒ seulement quand `accountsReady === true`. Colis disait « Aucun colis à envoyer » avant les ventes
  ⇒ « Je lis tes ventes… » / « pas pu être lues ».
- **Semaine de Ma journée (limites n°10)** : sept « 0 » quand aucune vente n'était lue ⇒ « ce n'est pas zéro » ;
  une partie lue ⇒ « au moins » sur le total.
- **Fuseau (limites n°19)** : charge de Comptabilité datée en UTC (le 1er à 0 h 30 = mois d'avant), récap
  mensuel, objectif proposé et « jours où tu as vendu » au jour UTC ⇒ `dateLocaleISO` / `cleJourLocal`.
  L'audit joue la règle sous `TZ=Europe/Paris` le 1er nov. à 0 h 30.

**Vérifié juste, rien à changer** : « vendu ce mois » de Ma journée = la coque (widget) = Statistiques
(même `ventesFaites`, minuit LOCAL du 1er, exécuté) ; miroir serveur identique pour `ventesFaites`,
`ventesDeclarables`, `montantRecuEbay`, `commandeEbayEngagee`, `montantCommandeLu` ; les comptes exclus ne
sont dans aucun total ; la même commande lue deux fois n'est dite qu'une fois.

**Laissés, avec la raison** :
- Bancs de rendu non lancés ici (pas de build Vite dans ce conteneur) : regarder Ma journée, Statistiques,
  Colis et Annonces après fusion (captures). Le build sera fait ailleurs.
- `audit-bilan-semaine --recopie`, `audit-tdz`, `audit-benefice`, `audit-statuts`, `audit-vendeur-neutre`
  exigent `@babel/parser` ; 47 audits exigent `web-push` : à relancer dans un conteneur qui les a.
- Limites n°2 (deux onglets), 6 (2 000 annonces), 7 (coupure réseau), 9 (iOS 15), 17 (lireTout non strict
  sur `TXN_META_SELECT`, stats, fraîcheur), 24 (île 960-1024) : chantier E1 de la liste (chargement, hors
  ligne, téléphone) — hors du périmètre « données au bon endroit » ou demandant un banc de rendu.
- Flux A3 (même paire sur deux comptes Vinted) : décision par défaut inchangée (nuit §4).
- Écrans N5 (« 372 € » trois fois), N11 (Reçu = CA côte à côte) : affichage, pas une donnée fausse — D2/D5.
- `liveStats.caEncaisse` (Finalisé sur Vinted) reste daté de la vente, sur Vinted seul : c'est dit à l'écran
  (« Vinted seul · au jour de la vente »), règle inchangée.

## 3 novembre — Comptes liés : Vinted, Vestiaire, Leboncoin et eBay sur un seul écran (branche `claude/parite-plateformes`)

Julien (3 nov., 10 h 05) : « pareil, Comptes liés : il doit y avoir les comptes Leboncoin,
Vestiaire et eBay ; je te laisse tout faire parfaitement ; tout ce qui est fait pour Vinted
doit être fait pour le reste des apps ».

**Mesuré d'abord sur sa base (lecture seule, 3 nov.)** — où vivent les comptes :
- Leboncoin : `lbc_accounts.accounts` = 3 entrées pour **2 comptes** (`8442…` et
  `lbc-account:8442…` sont le même, un particulier ; un compte « pro » vu seulement comme
  compte lié, sans `sessionAt`) ; `lbc_listings.lectures` n'existe pas encore chez lui ;
  `lbc_ventes.ventes` (objet) porte `account = lbc-account:…` sur chaque vente.
- Vestiaire : **`vc_session` n'existe pas** (Vestiaire n'a jamais chargé `/users/me` chez
  lui) ; toutes les lignes `vc_listings`/`vc_ventes` ont `compte = ''`. Aucun nom n'est
  jamais gardé (choix du 31 oct.).
- eBay : `ebay_comptes.comptes` (1 compte principal, `pseudo`, `type`, `site`,
  `deconnecteLe`) ; `ebay_orders{_clé}.capturedAt` en millisecondes.
- Les ventes Leboncoin, Vestiaire et eBay entraient TOUTES dans les totaux : aucun
  équivalent de « comptes sélectionnés » (`vinted_accounts_hidden`) hors Vinted.

**Ce qui est fait**
1. `api/_lib/comptes-exclus.js` (UNE règle, importée par l'app et le serveur) :
   `vrm_comptes_exclus = { leboncoin: [id], vestiaire: [id], ebay: [ref] }`, synchronisé,
   écrit seulement sur son geste. `ventesFaites`, `ventesDeclarables` (compte `exclues`),
   `ventesAutresBenefice` et `vcHorsBenefice` reçoivent `excluAutre` ; chaque écran qui
   calcule un total le passe (Compta, CA par période, facturation électronique, Ventes,
   la coque/Ma journée) ; le bilan de la semaine aussi (`main.vrm_comptes_exclus`, lu par
   `ship-reminders`) ; les commandes eBay lues par le serveur portent désormais `_compte`.
   Identité seulement : Leboncoin `account` (`lbc-account:` retiré), eBay `_compte`,
   Vestiaire `compte` (vide = la carte « non identifié »). Une vente Leboncoin/eBay SANS
   compte n'est jamais écartée. Seulement les TOTAUX : colis, annonces, alertes restent.
   Le miroir `api/_lib/ventes-regle.js` est refabriqué par `--recopie`.
2. Paramètres → Comptes liés (`VintedAccounts`, titre « Comptes liés ») : quatre groupes
   (Vinted, Vestiaire Collective, Leboncoin, eBay), la MÊME carte (`CarteCompteLie`) :
   avatar (photo Vinted si connue, sinon initiale), nom tel que lu (sinon `n° …`, jamais
   deviné ; Vestiaire sans compte : « Compte non identifié »), état (`src/comptesLies.js`,
   `etatCompteLie` : banni RELEVÉ · délié · ouvert · jamais lu · à relire > 24 h · lu + âge),
   Pro/Particulier tel que lu, interrupteur « dans les totaux » (Vinted = le masquage
   existant, avec sa confirmation ; autres = `vrm_comptes_exclus`), action : Vinted /
   Vestiaire / Leboncoin « Ouvrir » (le site), eBay « Relire » + « Délier » (confirmé,
   règles d'offre restantes dites) ou « Relier » (OAuth existant). Vinted garde « Gérer »
   (nom affiché, e-mail, téléphone, note, annonces/messages retirés, suppression ciblée).
   Retirés (sa demande, « aucun texte explicatif ») : le guide en 3 étapes, la phrase sous
   le titre, la ligne « Tes comptes : … » (ses nombres restent en `data-comptes-*`).
   Style Fusion (`src/comptes-lies.css`, jetons `--fu-*`), colonne 760 px.
3. Lecture : trois états par plateforme ; « pas su » ⇒ « — Réessayer », jamais « aucun
   compte » ; projections seulement (`a:data->accounts`, `l:data->lectures`, `cap:data->>capturedAt`).

**Preuves** : `scripts/audit-comptes-exclus.cjs` (17 contrôles exécutés ; `--prouve` :
8 mutations, toutes rouges) ; banc `scripts/bancs/comptes-lies.cjs` (données inventées,
390 tactile clair/sombre + 1512 : 4 groupes, identité Leboncoin, ouvert/à relire/délié,
interrupteur rangé, Comptabilité → Vendu 150 € → 100 € quand le second compte Leboncoin
est écarté) — vert ; 9 rouges sur origin/main ; mutations rouges (identité Leboncoin non
normalisée : 3 ; `excluAutre` oublié par le CA par période : 1). `type-compte`,
`audit-urssaf` (contexte complété), `audit-bilan-semaine` (2 rouges de main sur les
notifications, sans rapport), `audit-coherence` verts.

**Limites** : Vestiaire n'aura de comptes nommés (identifiants) que quand l'extension
lira `/users/me` (ou `user_id` Stream, 5.317) ; « ouvert » Leboncoin/Vestiaire = la session
relevée < 12 h par n'importe lequel de ses navigateurs. Geste de Julien : regarder
Paramètres → Comptes liés ; couper l'interrupteur d'un compte qu'il ne veut pas compter.


<!-- déplacé de CLAUDE.md §9 le 5 nov. (limite de 60 Ko) -->
- **4 nov., reprise Codex** — intégration des branches argent/mois, offres/objectif/questions eBay, achats/fournisseurs/lots, comptes/sécurité ; corrections des retenues eBay inconnues, lecture inachevée et corps HTTP des appareils. État précis, limites Vinted/Discord, corbeille non livrée : `docs/passation/2026-11-04-reprise-codex.md`. Migration 024 non appliquée.

<!-- déplacé de CLAUDE.md §9 le 5 nov. (limite de 60 Ko, groupes d'accompagnement) -->
- **3 nov.** — Ma journée « À faire » en PHOTOS (vignettes par identité, pile + « +k », plus de pastilles colorées ; `src/design/PileVignettes.jsx`) ; Colis en 3 onglets « À envoyer · Envoyés · À retirer », toutes plateformes ensemble groupées par transporteur ; « À retirer » en SECTIONS (aujourd'hui · prêts · code à venir · lieu à confirmer · à vérifier · en route · argent à vérifier), chaque colis une fois, sélecteur de VILLE (lue dans l'adresse) qui filtre carte, liste et carte sombre ; aucune phrase explicative. Bancs `journee-photos`, `colis-retirer-propre` (rouges sur main) ; R2 du récap corrigé (`deps` de `LigneVenteVinted`). → historique interface-stock. Geste : regarder Colis → À retirer et Ma journée.

<!-- déplacé de CLAUDE.md §9 le 5 nov. (limite de 60 Ko, lots v31) -->
- **3 nov.** — Statistiques « Ce qui rapporte le plus » (Modèle · Marque · Taille · Compte · Site : brut total/moyen, marge, temps pour vendre, couverture « prix d'achat connus N/M » ; modèle = statistique sûre, jamais une identité : `src/ceQuiRapporte.js`) ; « Articles qui dorment » unifiés avec Annonces → À relancer (30/60/90 j, une action qui ouvre l'écran existant) ; micro de recherche (Web Speech `fr-FR`, « numéro 124 » → 124, « bé 125 » → B125). Une vente Vinted au prix illisible est écartée (plus comptée 0 €). Audits `ce-qui-rapporte`/`qui-dorment`/`recherche-vocale`, banc `outils-stats`. → historique interface-stock. Geste : ouvrir Statistiques et toucher le micro.
- **3 nov.** — Annonces, 4 outils : « Changer le prix » d'un N° sur tous les sites où il est en ligne PAR IDENTITÉ (eBay `revise` confirmé ; Vinted par `republiermodif` si l'extension sait, sinon « À faire sur le site » ; Leboncoin/Vestiaire toujours « À faire sur le site » — requête jamais observée) ; « Dupliquer » ⇒ nouveau N° `prochainLibre`, aucune photo ni identité copiée (`vrm_fiches_neuves`) ; historique complet et prouvé d'un article (`src/histoireArticle.js`) ; « Mes modèles » de description (`vrm_modeles_desc`). `audit-annonces-outils` (43 rouges sur main, 17/17 mutations). → historique interface-stock. Geste : essayer « Changer le prix » sur un N°.
- **3 nov.** — Paramètres → Comptes liés pour les 4 plateformes (une carte par compte : nom lu, état ouvert/à relire/délié, Pro/Particulier, « dans les totaux », Ouvrir/Relire/Relier/Délier) ; écarter un compte Leboncoin/Vestiaire/eBay des totaux (`api/_lib/comptes-exclus.js`, `vrm_comptes_exclus`, une vente sans compte relevé n'est jamais écartée) ; Vestiaire = « Compte non identifié » tant que `vc_session` n'existe pas. `audit-comptes-exclus` (8 mutations), banc `comptes-lies` (9 rouges sur main). Matrice `docs/passation/parite-plateformes.md`. → historique divers. Geste : Paramètres → Comptes liés.

<!-- déplacé de CLAUDE.md §9 le 5 nov. (limite de 60 Ko, lots v31, suite) -->
- **3 nov.** — Offres et publication : contre-offre en un tap au prix mini (`contreOffreMini`, compte dans les 50/h) ; vérification avant de publier sur les 4 gestes (photos, taille, prix < achat, titre trop long, marque, catégorie ; « Publier quand même ») (`src/verifAnnonce.js`) ; une seule carte « Boost rentable ? » qui compare boostés/non boostés du même modèle (`src/boostRentable.js`). → historiques favoris-messages, interface-stock, compta. Geste : saisir le boost payé sur les fiches boostées.
- **3 nov.** — Villes des colis à retirer : ville reconnue même sans code postal (consignes Vinted Go), variantes d'une même ville regroupées dans le sélecteur, « Lieu à confirmer » toujours visible ; 43/47 emails ont leur ville (21 avant) (`src/villeRelais.js`, `audit-villes-colis` 32 rouges sur main, banc `colis-villes`). → historique colis-retraits. Geste : rouvrir Colis → À retirer.
- **3 nov.** — Double vente app fermée : à l'e-mail d'une vente Vinted ou Vestiaire, si le même N° (identité) est encore en ligne ailleurs ⇒ une notif « ⚠️ N°x vendu sur … · encore en ligne sur … » (`api/_lib/enligne-regle.js` copie refabriquée par `scripts/recopie-enligne-serveur.cjs`) ; aucun e-mail de vente Leboncoin/eBay n'a jamais été reçu (lecteurs à apprendre). Suggestions d'achat à relier (marque + taille obligatoires, couleur, modèle connu différent écarté, jamais la photo ; « Voir tous les achats » avec recherche ; lots « 2/3 reliés », prix saisi) (`src/suggestionsAchat.js`). « Exporter mes données » (7 CSV zippés, `src/exportDonnees.js`). Audits `double-vente-ailleurs`, `suggestions-achat`, `export-donnees`. → historiques sécurité et compta. Geste : toucher « Relier un achat » sur une vente.

<!-- déplacé de CLAUDE.md §9 le 5 nov. (limite de 60 Ko, lots v31/v32) -->
- **3 nov. (soir)** — Colis : « Scanner » (caméra, `BarcodeDetector` sinon ZXing local, clavier toujours là) ⇒ « Déposé » seulement si le n° lu = un seul colis (`src/scanColis.js`) — seuls 94/215 bordereaux ont un n° lu, Mondial Relay pas encore ; « Tout imprimer » toujours visible, trié par transporteur (`src/lotTransporteurs.js`), Vinted + Vestiaire + Leboncoin, tampon à la place gardée par type ; « Retour reçu ? » ⇒ « Remettre en stock » avec SON N° (`src/retoursStock.js`). `audit-colis-trois`, bancs `colis-scan` 42, `tout-imprimer` 26. → historique colis-retraits. Geste : essayer « Scanner » sur l'iPhone.
- **3 nov. (soir)** — Toute l'app au style Fusion : échelle fermée de tailles, graisses et rayons (`scripts/fusion-echelle.mjs --verifier`), carte sombre aussi dans Achats (Dépensé · En route · À retirer · Reçus, aucun chiffre de vente), plus de « ≥ » ni de libellé coupé dans les cases (« Au moins » dans le titre), nom du point relais sur une ligne. Bancs `fusion-app` 652, `carte-stats` 114. → historique interface-stock. Geste : regarder Achats au téléphone.
- **3 nov. (soir)** — Tampon LIBRE : au premier « Imprimer » d'un type de bordereau (transporteur + format + orientation), une feuille montre la page et le tampon ; il le glisse/redimensionne où il veut, même sur du texte (fond blanc opaque, puce ambre s'il couvre un code-barres) ; « Toujours ici » garde la place (`vrm_tampon_positions`), « Déplacer le tampon » la rouvre, « Tout imprimer » la reprend sans feuille (`PlaceurTampon`, `positionTampon`). Bancs `tampon-bordereau` 142, `tampon-libre` 38 (rouges sur main). → historique colis-retraits. Geste : imprimer un bordereau et poser le tampon.

<!-- déplacé de CLAUDE.md §9 le 5 nov. (limite de 60 Ko, intégration lot 1) -->
- **4 nov.** — Litiges, retours, annulations dans Ma journée « À faire » (identité = transaction ou conversation `links.vinted.com/t/…`, jamais le titre ; délai seulement LU — sujet « Retourne ta commande d'ici le … », eBay `respondByDate` — sinon « délai non lu », ambre < 48 h, lien vers le site) (`src/litiges.js`) ; recherche unique : N°, pseudo, n° de suivi, code de retrait, n° de transaction, titre (pour chercher seulement), plein écran au téléphone dès la frappe (`src/rechercheUnique.js`). `audit-litiges` 10/10, `audit-recherche-unique` 8/8, banc `litiges-recherche`. → historiques colis-retraits, interface-stock. Geste : dire si le plein écran de la recherche au téléphone lui va.
- **4 nov.** — Un seul N° pour un article sur Vinted ET Vestiaire : « Relier à Vinted / à Vestiaire » sur SON clic + confirmation, le N° Vinted reste, l'ancien N° Vestiaire n'est jamais redonné et passe dans « N° à barrer », « Délier » rend l'état d'avant (`main.vrm_vc_liens`, lu aussi par widget/rappels/e-mail) ; frise Vendue → Postée → Livrée → Payée sur Vestiaire et eBay, étapes prouvées seulement (`src/friseSites.js`). `audit-lien-vc` 11/11, `audit-frise-sites` 6/6, banc `lien-vc-frise` 62. → historiques vestiaire, numéros. Geste : relier un article en double, barrer l'ancien N°.
- **4 nov.** — Compta → Registres : livre des recettes (`ventesDeclarables`, daté au versement, « à dater » listées à part, comptes exclus dehors) et registre des achats (reçu juste au centime, sinon prix saisis des fiches reliées, sinon « article seul » ⇒ « au moins » ; dépenses jamais dedans), PDF + tableur (`src/registres.js`) ; Statistiques : « Bénéfice » de l'année par la règle de Compta, « Marge », « bénéfice brut » nommé. `audit-registres` 10/10 mutations, banc `registres` 84. → historique compta. Geste : télécharger les registres 2026 et les relire.
- **4 nov.** — **Extension 5.318.0** : Messages · Leboncoin lit les conversations (`lbcfil`) et y répond sur SON clic une fois la recette d'envoi APPRISE d'un envoi fait à la main (`lbcrepondre`, compte de l'onglet, 50/h, pause 429/403 ; sinon « Répondre sur Leboncoin ↗ ») ; eBay → Inactives : « Remettre en vente » vérifiée par eBay puis confirmée, seulement le n° d'annonce envoyé (même prix, même livraison gérée, SKU gardé) (`api/_lib/ebay-relance.js`). `audit-ebay-relance`, `audit-lbc-repondre`, banc `lbc-repondre`. → historiques ebay et leboncoin. Geste : installer la 5.318.0, puis envoyer UNE réponse à la main sur leboncoin.fr.

<!-- déplacé de CLAUDE.md §9 le 5 nov. (limite de 60 Ko, chantiers A et B) -->
- **4 nov. · Finitions bureau** : ventes en colonnes, fil lisible à 1024/1280, filtres et paramètres, téléphone conservé ; voir `docs/passation/2026-11-04-finitions-bureau.md`. Google Cloud reste à configurer par administrateur.
- **4 nov.** — **Extension 5.319.0** : offres Vestiaire dans Messages (montant, « tu touches », temps restant ; Accepter/Contre-offre/Refuser seulement une fois le geste APPRIS d'une réponse faite à la main, sinon « Répondre sur Vestiaire ↗ » ; `vcoffres`, `vcoffrerepondre`) ; Compta → Porte-monnaie Vinted par compte (lu, jamais déduit ; « au moins » si un compte manque) ; Annonces → « Masquées » (`is_hidden`, lien Corriger) ; avis Vinted lus 1×/24 h (`avis`, `harvest_{uid}_feedbacks`). `audit-vc-offres` 16/16, `audit-argent-offres-masquees` 13/13, `audit-avis-vinted`. À décider : purge de `wreq…payouts` du 13 oct. (bank_account_id) et noms d'acheteurs dans `vc_brut_*`. → historiques vestiaire, vinted-extension, compta. Geste : installer la 5.319.0, répondre une fois à la main à une offre Vestiaire.
- **4 nov.** — « Tout imprimer » : Vestiaire et Leboncoin ont TOUJOURS leur ligne cochable (cochée si bordereau, sinon « Sans bordereau » ambre et nommée dans le lot ; Leboncoin au téléphone = sans bordereau, PDF lu par l'extension de l'ordinateur), eBay grisé jamais cochable (`src/lotSelection.js`) ; à l'impression, la feuille du tampon s'ouvre UNE fois par type de bordereau du lot, la place vaut pour tous ceux du type, « Placer le tampon » redemande tout, Annuler n'imprime rien. `audit-selection-bordereaux` 9/9, banc `selection-bordereaux` 54 (11 rouges sur main). → historique colis-retraits. Geste : cocher une vente Vestiaire dans « Tout imprimer » et placer le tampon.
- **4 nov.** — Compta : prévision de la prochaine échéance URSSAF en tête de « Combien je dois déclarer ? » (« au moins » + « N à dater », mois déclarés pas recomptés, rythme jamais supposé) — la carte « Prochaine déclaration » était CACHÉE par fusion.css ; « Tes seuils 2026 » : projection seulement sur mois finis et total complet, DAC7 par plateforme (`src/seuilsAnnee.js`, `src/previsionUrssaf.js`) ; Statistiques : annulations par compte (Vinted ; autres sites « pas comptés ») et notes reçues lues du profil (`feedback_reputation`), avis détaillés à lire par l'extension 5.319 (`src/annulationsCompte.js`, `src/notesRecues.js`). 4 audits rouges sur main, bancs `seuils-prevision` 32, `annulations-notes` 30. → historiques compta, interface-stock. Geste : ouvrir Comptabilité puis le bas de Statistiques.
## 5 novembre — Audits rouges du 5 nov. (branche locale `v34-audits-rouges`, depuis `claude/project-review-nsk5su`)

Quinze audits étaient rouges sur `claude/project-review-nsk5su`. Pour chacun : vrai défaut de l'app
(corrigé au plus petit) ou audit périmé (mis à la forme d'aujourd'hui, la MÊME règle, prouvé par
mutation). Rien n'a été touché dans `vinted-sync-extension/` ni dans les zips de `public/`.

| audit | cause | nature | correction | preuve |
|---|---|---|---|---|
| `registres` | `pdfjs-dist/legacy/build/pdf.mjs` introuvable : la dépendance n'a JAMAIS été dans `package.json` (elle traînait installée à la main) | dépendance manquante | `pdfjs-dist` 4.10.38 en devDependency exacte (lu aussi par `audit-dac7-comptes` et des bancs) | après `npm ci` : 46/46 ; « au moins » retiré du PDF ⇒ R6 rouge |
| `entree-publier-ailleurs` | lit `dist/` : pas de build sur la machine | ni l'un ni l'autre | `npm run build` | vert après le build |
| `bilan-semaine` §6 | l'écran Notifications rend les FAMILLES de `api/_lib/notif-textes.js` depuis d957146e (3 nov.), plus de `{ id:'bilan', def:true }` | audit périmé | la règle exécutée : `decisionNotif({}, 'bilan')`, famille du bilan dans `GROUPES_NOTIF` et allumée par défaut, l'écran rend `FAMILLES`/`familleActive` du serveur, pour chaque catégorie l'état montré = la décision du serveur | 4 mutations rouges (Rappels `def:false`, bilan hors `FAMILLE_DE`, liste locale dans l'écran, Rappels absent de l'écran) |
| `chemin-json-guillemets` | `api/_lib/securite-compte.js` : `data->groupes->${uid}` NU | vrai défaut (latent) | `->${encodeURIComponent('"' + userId + '"')}` ; `audit-comptes-securite` 4.17 attend la forme | la faute du serveur disparaît du rouge ; reste `background.js:16034` (extension, voir plus bas) |
| `chiffres` | 2ef727df (libellés `NOM_BENEFICE_BRUT`/`NOM_APRES_FRAIS`), e0385ee3 (`escrowJ`, « À venir »), f1001d7a (bouton « Afficher les N suivantes · x/y », remise à 60 au changement de filtre seulement) | audit périmé | mêmes règles sur la forme actuelle (fenêtre de la carte 2 400 car.) | 5 mutations de l'app, 5 rouges |
| `donnees-ecrans` D7 | a7f1fac4 compte aussi par compte : `{ prixPasLu++; if(cc) cc.nPrixPasLu++; }` | audit périmé | regex et mutation D7 à la forme ; la mutation « Lie un compte » n'a plus de cible (phrase retirée le 3 nov.) | `--mutations` 12/12 |
| `ebay-route` [INA] | 1a81a91c : « Remettre en vente » sur son clic confirmé (`handleRelance`) ; `RelistedItemID` (champ lu) compté comme un appel | audit périmé | Relist*/AddItem seulement dans `handleRelance`, `confirme:true` avant tout appel, Relist après la vérification à blanc, seules `relanceverif`/`relancer` y mènent | 3 mutations rouges |
| `numerotation-lecteurs` | 1a81a91c ajoute `relancer` à `avecVersion` | audit périmé | `publish` et `programmer` toujours exigés, d'autres gestes permis ; mutation suivie | `--mutation=ebay-sans-version` rouge ; retirer `programmer` rouge |
| `photos-vinted` | deux `<img>` neufs hors de la liste fermée : `PhotosEbayEditeur :: e.apercu` (blob: du fichier choisi, 24d409ad) et l'icône locale de l'aperçu des notifications (0d961728) | liste fermée pas tenue | ajoutés AVEC leur raison | `img-brut` rouge ; une source inconnue dans l'aperçu rouge |
| `politique-hotes` | le navigateur contacte TOUT SEUL jsDelivr pour ZXing (scanner) et Tesseract (tickets) et 12 domaines de transporteurs (leurs favicons) sans que la politique le dise ; le reste = liens d'un clic | vrai défaut (politique) + liste | ligne jsDelivr : quatre outils ; une ligne « logos des transporteurs » ; date de mise à jour 5 nov. ; liens classés « lien » | `--prouve` 11/11 dont 2 neuves. **Julien : relire `public/legal/confidentialite.html`** |
| `qui-dorment` | 0b293942 (« Masquées ») : `) : annSort==='sleeping' ? (<QuiDorment` dans une chaîne de ternaires | audit périmé | même règle (liste dans cette vue, grille dans le dernier « sinon ») | mutation rouge ; `--prouve` 4/4 |
| `statut-transporteurs` | 217cf4dd : toute arrivée s'écrit « 📍 … t'attend » ; l'audit comptait les titres « disponible » | audit périmé | l'arrivée reconnue par la clé du fait (`tag` = `relais-{n°}-…`) | réservation `push_dedup` retirée ⇒ rouge ; « disponible » ne notifie plus ⇒ 5 rouges |
| `vc-offres` O5 | échéance de la fixture écrite en dur (`2026-11-05T19:23:33Z`) : passée, le fond refuse (« expiree », règle juste) | audit dépendant de l'horloge | échéance = heure du banc + 7 j ; un contrôle NEUF « offre EXPIRÉE ⇒ rien ne part » | mutation `fondExpiree` rouge ; `--prouve` 17/17 |
| `vendeur-neutre` B | la consigne « À poser sur Vercel… » (carte des e-mails de l'essai, 5a5c6648) est sous `{r.proprietaire ? …}`, réponse du serveur ; l'audit ne reconnaissait que `proprio` | audit périmé | `x.proprietaire` reconnu comme condition « propriétaire » | condition remplacée ⇒ rouge |
| `vc-recon` | voir plus bas | défaut de l'extension | NON corrigé (hors branche) | reste rouge |

### Ce qui reste rouge (extension, pas touchée ici)
- `chemin-json-guillemets` : `vinted-sync-extension/background.js:16034`
  `sbGet(\`app_data?id=eq.vc_offres&select=o:data->offres->${cleOffreVc(nego)}\`)`. La clé est `n<id>`
  (jamais numérique) : PostgREST la lit comme une clé, sans défaut constaté ; la règle veut
  `->"${cleOffreVc(nego)}"`. Une version d'extension à monter.
- `vc-recon` (CONFIDENTIALITÉ) : la capture brute 5.315 (sa demande du 2 nov. « capte tout Vestiaire »)
  fait sortir de la page la réponse ENTIÈRE. Chemin : `vc-inject.js:1369` `noteBrut` ⇒
  `post({ kind:'vcbrut', url, texte })` (`window.postMessage(…, '*')`, toute réponse JSON 2xx ≤ 400 Ko et
  `__NEXT_DATA__`) ⇒ `vc.js:45` ⇒ `chrome.runtime.sendMessage({ action:'vcBrut' })` ⇒
  `background.js:2700` ⇒ `rangerVcBrut` (15532) ⇒ upsert `app_data` `vc_brut_{empreinte}`.
  `sansSecretsVc` ne vide que les clés jetons/mot de passe/carte/`iban`/`bic` : nom, e-mail, adresse,
  téléphone et messages de l'acheteur, n° de commande et UUID de membre sont écrits en base ; un IBAN
  sous un autre nom de clé aussi. C'est la décision attendue de Julien (« noms d'acheteurs dans
  `vc_brut_*` », §9 du 4 nov.) : l'audit n'a pas été assoupli.

- `retrait` (rouge aussi au premier passage, hors de la liste des quinze) : « l'écran Achats dit pourquoi
  les codes manquent » cherche `<ExtEnRetard` dans les 1 800 premiers caractères de l'écran Achats ; il y
  est toujours (`src/App.jsx` vers 53555) mais à 3 700 caractères du début : fenêtre de l'audit trop
  courte, pas un défaut de l'app. Zone « écran Achats » d'une autre branche : décrit, pas touché.

### Passage complet
`npm run build` vert, puis les 288 `scripts/audit-*.cjs` (240 s chacun) : 3 rouges — `chemin-json-guillemets`
(extension), `vc-recon` (extension, confidentialité), `retrait` (fenêtre de l'audit, écran Achats).

### Constaté en passant
- `PUSH_DEFAUT` (`api/_lib/push.js`) n'est plus lu par aucune décision (`decisionNotif` décide) et
  contredit les familles (`message:false`, `facture:false` alors que leurs familles sonnent par défaut) :
  table morte, trompeuse.
- La carte « À venir / À virer » de Ma journée n'apparaît que s'il y a de l'argent À VENIR : un vendeur
  qui n'a que de l'argent À VIRER ne la voit pas (non corrigé, non jugé par un audit).

<!-- déplacé de CLAUDE.md §9 le 5 nov. au soir (limite de 60 Ko) -->
- **5 nov. · Réveil** : fin des heures calmes ⇒ une notification « ce qui est arrivé pendant » (`?moment=reveil`, GitHub toutes les 30 min). `docs/passation/2026-11-05-reveil-heures-calmes.md`. Geste : secret `CRON_SECRET` dans GitHub.
- **5 nov. · Audits rouges** : 15 → 3 (politique : ZXing, Tesseract, logos transporteurs déclarés ; `pdfjs-dist` en devDependency) ; restent 2 extension + `retrait` (Achats). `historique-divers.md` « Audits rouges du 5 nov. ». Julien : relire `public/legal/confidentialite.html`, décider `vc_brut_*`.
- **5 nov. · Achats et à retirer** : 33 → 10 sur sa copie (fin par le n° de la commande et le code ; doubles possibles à part ; un point = une carte) ; Achats : une carte, outils dans « … », « Arrivé ». `docs/passation/2026-11-05-achats-retraits.md`. Geste : dire à quel compte appartient l'adresse qui reçoit 16 e-mails Vinted.
- **5 nov. · Chantier B (composants partagés)** : `montant()` (src/format.js, « — » si pas su, alias fmt/fmtE/fmtE0/prixTxt), `src/libelles.js`, SheetShell unique (portail, opaque dès la 1re image, poignée), ChampRecherche, PhotoVide, Numero, EtatPanne, Bouton « danger » ambre ; écrans pas adaptés (C à H). API : `docs/passation/2026-11-05-chantier-b.md`.
- **5 nov. · Relais Vinted** : un « relire » relit la copie captée, plus le serveur ; relais freiné (24/30 min/compte, sur l'appareil ET au serveur, tous appareils). `docs/passation/2026-11-05-frein-relais-vinted.md`.
- **5 nov. · Numéros** : fiche numérotée du nuage jamais retirée par la fusion (plus de bloc « Recharger »). `docs/passation/2026-11-05-numeros-autre-appareil.md` ; demandes du jour : `demandes-2026-11-05.md`.
- **5 nov. · Orion 5.322.0** : base 5.319 confirmée installable par Julien, moteur/adaptateur repris ; seul le popup change hors versions, pour rester sur Vinted après connexion. Voir `docs/passation/2026-11-05-orion-base-validee.md`.
- **5 nov. · Référence Orion 5.319.0** : archives originales de 61304faf remises séparément, SHA-256 vérifiés ; refus persistant en 5.321, cause non établie et ancienne version installée inconnue. Diff complet : `docs/passation/2026-11-05-orion-comparaison-reference.md`.
- **5 nov. · Paquets 5.321.0** : archives normalisées 644/755 (la 5.320 exportait des fichiers 600), contrôle depuis sources privées, tous formats. Refus Orion réel non reproduit sur appareil ; `docs/passation/2026-11-05-orion-paquet.md`.
- **5 nov. · Extension 5.320.0** : mot de passe sans ouverture automatique de VRM, rappels/promesses Orion et délais de connexion ; capture après session conservée, limites écran d’accueil/iOS expliquées. Voir `docs/passation/2026-11-05-orion-connexion.md`. Installer le nouveau paquet Orion.

## 6 novembre — Audits après intégration v35 (branche locale `v36-audits-integration`, depuis `claude/project-review-nsk5su` 162659a6)

Après la fusion des chantiers v35 (C, D, E1, E2, F, G, H), quatre audits étaient rouges, et
`audit-frein-relais-serveur` l'était parfois sous charge. Rien touché dans `vinted-sync-extension/` ni `public/`.

| audit | cause | nature | correction | preuve |
|---|---|---|---|---|
| `brouillons-proposables` | le chantier C a retiré la feuille « Republier et brouillons » (son « N prêts sur M brouillons ») | audit périmé | même règle sur la forme actuelle : le compte `nPrets` de « Voir mes brouillons » (qui ouvre « En mettre plusieurs en ligne ») filtre `_place === 'proposable'`, la feuille « Actions » NOMME un brouillon pas proposable, aucun compte sur `_etat === 'pret'` | `--prouve` 12/12 (2 mutations neuves : compte sur `_etat`, Actions qui nomme le mauvais) |
| `chiffres` (×4) | E1 : la carte passe par `carteArgentJournee` (src/journeeArgent.js), plus d'`escrowJ && escrowJ.dispo > 0` ; E2 : « Afficher les 120 suivantes · encore 107 après » au lieu de « · 60/287 » | audit périmé | carte : `escrowJ` = porte-monnaie lu, la règle EXÉCUTÉE rend le `dispo` à côté de l'à-venir (aussi seul, « pas lu » = `null`), la moitié « virer » écrit `K.virer.valeur` ; bouton : son JSX est RENDU par Babel (287/60, 65/60, 61/60) et ses nombres doivent couvrir exactement ce qui n'est pas dessiné (ou dire le total) | 8 mutations (app et règle), 8 rouges |
| `commandes` | le bouton « rattacher » de la fiche fournisseur (bb4d63ad) n'a pour nom propre qu'un « + » (le reste vient de `LigneHors`) | régression (nom de bouton) | `aria-label` « Rattacher l'achat « … » à ce fournisseur » (src/AchatsOutils.jsx) ; l'audit refuse aussi un nom en dur sans lettre | 162659a6 rouge, après vert, nom retiré ⇒ rouge, nom « + » ⇒ rouge |
| `qr-capture-mr` E2/E4 | D a refait « En grand » : `const ck = carrierKey(qrView.carrier)` puis `titreQrAbsent(ck)` ; `() => retirerQrPose(...)` avec espaces | audit périmé | E2 juge le titre dans la vue en grand (direct ou par la constante du transporteur), E4 tolère les espaces et exige « Retirer ce QR » ; la mutation D3 (« Ouvrir Mondial Relay (QR) ») visait l'ancien lien : recâblée sur le `Bouton` | `--prouve` 20/20 (3 neuves) |
| `frein-relais-serveur` §2 | seul : vert 3 fois sur 3 ; sous charge les cinq appels n'ont pas la même milliseconde. `prendrePlaceRelais` ne comptait que `t <= maintenant` : une instance dont l'heure était prise 2 ms AVANT celle qui venait d'écrire ne voyait pas sa place, prenait la même dernière place ET l'effaçait en réécrivant (25 requêtes, 24 comptées) | vrai défaut (révélé par la charge) | src/freinRelaisVinted.js : une place compte si `|maintenant − t| <` la fenêtre (une date absurde reste ignorée) ; §5 neuf, déterministe (horloges croisées) | 162659a6 : §5 rouge à chaque passage ; après : 16 passages parallèles verts ; `--muter=horloge` rouge |

Passage final : `npm run build`, les 4 audits + `frein-relais-serveur`/`frein-relais-vinted`, `coherence`,
`identite`, `icones`, `fonctions-api` verts ; bancs `annonces-coherence`, `brouillons-avancee`,
`journee-coherence`, `ventes-e2`, `colis-envoi`, `colis-qr` (ports 9401–9406) verts. `fournisseurs` (écran
touché par le nom du bouton) était rouge AVANT ce changement, au premier sélecteur : depuis la revue 2.16 d'Achats,
les outils sont derrière « … » (`data-achats-plus`) ; le banc l'ouvre d'abord, puis 112/112.


## Lignes de « État actuel » du 5 nov. déplacées le 6 nov. (telles quelles)

- **5 nov. · Annonces → Sélectionner** : en ligne, masquées, brouillons par compte, « en vérification » non cochable ; UN carré « Actions » (moteurs de Republier, raisons dites, manques paire par paire) ; « Republier à la main » (photos réglées, texte à copier, SON clic relie, N° repris quand l'ancienne n'est plus du tout sur Vinted). Revue : `null` = pas lu, masquée ≠ partie. `docs/passation/2026-11-05-annonces-actions.md`.
- **5 nov. · Messages lisibles** : plus de « currency_code: EUR » (ses 587 offres) ni de HTML de Vinted ; l'extrait de chaque ligne est le dernier message réel (plus le titre de l'annonce), les offres marquées « Offre » avec leur montant à leur conversation (`src/messagesLisibles.js`) ; offres e-mail laissées hors de Messages (décision du 24 oct.). Voir `docs/passation/2026-11-05-messages-offres.md`.
- **5 nov. · Colis code + QR** : code et QR reliés par n° de suivi, « En grand » (écran allumé), QR de dépôt Leboncoin. ⚠️ Le QR Mondial Relay n'existe QUE dans l'app (« c'est que dans l'app ») : aucune promesse par navigateur/extension (`mr_colis_*` = codes seulement) ; « QR dans l'app Mondial Relay » + « Ajouter le QR » (capture lue dans la page, SON clic = l'identité, jamais un QR fabriqué ; `vrm_colis_qr_poses`). `docs/passation/2026-11-05-colis-qr.md` §7. Geste : ajouter une capture sur un colis.
- **5 nov. · N° sur l'annonce et N° changé** : réglage « Le N° sur tes annonces Vinted » (place, forme, aperçu, 2 questions ; `src/etiquetteNumero.js`, `vrm_num_vinted`) ; N° changé à la main ⇒ l'ancien dans « à écrire sur tes cartons » ; bloc « mise en ligne numérotée par VRM ». Branche `v31-numerotation`, `docs/passation/2026-11-05-numerotation-etiquette.md` (reste : extension). Geste : Paramètres → Numéros.
- **5 nov. · E-mails** : écran « E-mails » (boîte de réception : rubriques, compte, lecture, pièces, lien par identité) + « Relier ma boîte » animé, rien envoyé. `docs/passation/2026-11-05-onglet-emails.md`. Geste : poser la règle dans chaque boîte.
- **5 nov. · Compte sur chaque vente (v31, suite)** : UNE règle avec Plateformes : le compte par identité (`nomCompteVente`, `compteVenteLbc`, `compteVenteEbay`) écrit une fois par ligne (`CompteVente` : nom · « non relevé » · rien si non fourni) ; comptes Vinted relus sans recharger ; « CA Vinted par compte » complet. `docs/passation/2026-11-05-ventes-compte.md`.
- **5 nov. · Plateformes (v31)** : sélecteur À LOGOS unique (Annonces, Ventes, Achats, Messages, Colis ; les 4 sites, un site sans compte dit ce qui manque + le geste), le compte sur CHAQUE vente (identité, `src/plateformes.js`), « Publier ailleurs » guidé (vérifier · ce qui part · publier par le moteur existant · suivi par identité, `src/publierAilleurs.js`), filtres prix/réception/marque/taille pour relier un achat (relecture : dates de réception lues aussi depuis Ventes, brouillon eBay en ligne = « publiée », Leboncoin bloqué et dit hors Vinted, « ce qui part » = le texte du moteur). `docs/passation/2026-11-05-plateformes-logo.md`. Geste : Ventes, puis une fiche N° → « Publier ailleurs ».
- **5 nov. · Notifications et essai** : sept types, heures calmes, regroupement, cloche « centre des notifications » (lu/non lu, ouvre l'objet) ; e-mails j1/j3/j6 de l'essai par le cron du matin, désinscription en un clic ; revue : cloche = liste après purge, chemins des e-mails, heure limite du cron. `docs/passation/2026-11-05-notifications-relances.md`. Geste : poser les variables `RELANCES_*` sur Vercel.
- **5 nov. · DAC7 par compte** : Compta → Le détail → « DAC7 » (N/30, /2 000 €, rapport ou où le trouver, PDF/tableur). `docs/passation/2026-11-05-dac7-comptes.md`.
- **5 nov. · Communauté → Groupes** : groupes d'accompagnement (code/lien, validation par le créateur, partage choisi par le membre — rien par défaut, chiffres, détail — révocable et effacé ; relecture : total partiel dit, renvoi après effacement, verrou révocation/publication) ; migration **025 NON appliquée** (l'onglet le dit). `docs/passation/2026-11-05-communaute-groupes.md`. Geste : appliquer la 025.


## Autres lignes de « État actuel » du 5 nov. déplacées le 6 nov. (telles quelles)

- **5 nov. · Intégration lot 2** : mode stream, iPhone et reprise, Stock (annonces actuelles, 2D), Fournisseurs fusionnés ; une liste d'écrans (`ONGLETS_LIENS`, avec E-mails), la fiche dit « achat en gros » (règle `origineDuPrix`). Branche `integration-lot2`.
- **5 nov. · Mode stream** : bouton « Stream » à la place de l'œil des montants ; UNE règle programmée (montants, marques, « commence par », annonce entière « qui contient », comptes, acheteurs, adresses, IBAN) réécrit le texte partout, programme synchronisé ; revue : pseudos en mots entiers, codes de retrait cachés partout. `docs/passation/2026-11-05-mode-stream.md`. Geste : Réglages → Mode stream, écrire ses marques.
- **5 nov. · iPhone et reprise** : barre du bas revue (4 tâches + 5ᵉ place qui dit l'écran ouvert, « Plus » en tuiles au-dessus de la barre, retour = fermer, bord laissé au système) ; l'app rouverte revient au même écran, section, filtres, défilement (appareil, par vendeur ; `?tab=` gagne) ; rail coupé sur Edge = bloc « Recharger » borné à 1360 px, couvre tout (revue). `docs/passation/2026-11-05-iphone-reprise.md`. Geste : essayer sur l'iPhone.
- **5 nov. · Stock = annonces actuelles** : le Stock montre ses annonces en ligne (Vinted par la règle unique, eBay, Leboncoin), une fois par paire ; rangée plus en ligne ⇒ « Vendues à sortir » / « Plus en ligne », jamais si une lecture manque. `docs/passation/2026-11-05-stock-annonces.md`. Geste : ouvrir Stock, sortir les « Plus en ligne ».
- **5 nov. · Stock 2D** : une seule vue (étagères 2D, 3D gardée en base, ancienne place dite), case d'un vendu allumée puis libérée au départ du colis, « Voir l'état » ; relu (achat relié par la vente, « Voir/Ranger au stock »). `docs/passation/2026-11-05-stock-2d.md`. Geste : ranger les paires de l'ancienne pièce.
- **5 nov. · Fournisseurs** : des personnes qu'IL crée (`vrm_fournisseurs`), jamais un vendeur Vinted ; achat en gros, N° reliés par son clic (`buyGros`), prix saisi jamais remplacé sans lui. `docs/passation/2026-11-05-fournisseurs.md`. Geste : créer un fournisseur.
- **5 nov. · Notifications : le toucher mène à l'objet (v31)** : crochet unique `data-cible` (`src/cibleNotif.js`), l'objet défilé, ouvert et éclairé ~4 s ; offre ⇒ sa conversation et sa carte ; vente Vestiaire ⇒ sa ligne ; textes fabriqués une fois (`api/_lib/notif-apercus.js`, aussi l'aperçu des réglages) ; écriture refusée ⇒ interrupteur remis. `docs/passation/2026-11-05-notifs-cible.md`.
- **5 nov. · Agent eBay arrêté (v31)** : l'agent ne propose ni ne prépare plus rien (`agentebay` dans `CATEGORIES_RETIREES`, `publish`+`agent:true` ⇒ 410 ; ⚠️ ne pas le remettre sans qu'il le demande) ; Vendre sur eBay prend des photos de l'appareil ou de la galerie (`api/_lib/ebay-photo.js`). `docs/passation/2026-11-05-agent-ebay-arret.md`, récit `historique-ebay.md`.
- **5 nov. · Indicateur sobre (v31)** : point discret + nom du compte (ambre seulement si geste) ; navigateur nommé juste (`motsNavigateur()`, jamais « Chrome » en dur, `audit-chrome-en-dur`) ; « Tes comptes — dernière relecture » un compte par ligne (`src/fraicheurComptes.js`). `docs/passation/2026-11-05-indicateur-pro.md`.
- **5 nov. · E-mails plus clairs** : feuille de lecture opaque (plus de fondu d'opacité), chaque ligne dit d'abord ce que c'est (tiré du résumé rangé, jamais du sujet), jours, e-mails envoyés en un titre + un bouton ; v33 : ligne nature · essentiel · geste (ambre < 48 h), marque, états avec geste, code en grand. `docs/passation/2026-11-05-emails-clairs.md`. Geste : ouvrir un code de retrait dans E-mails.


## Lignes de « État actuel » du 5 nov. déplacées le 6 nov. (3ᵉ lot, telles quelles)

- **5 nov. · Chantier D, Colis côté envoi (v35)** : frise à l'encre sur la dernière étape faite ; barre du haut stable (Scanner · Tout imprimer · …) ; « En grand » en SheetShell lumineuse (titre = article ou « Colis <transporteur> ») ; « Tournée de dépôt » et « attend depuis N j » ; « Déposé », « En route ». `docs/passation/2026-11-05-chantier-d.md`. Geste : essayer la tournée au relais.
- **5 nov. · Chantier C (Annonces)** : une feuille « Actions » (Republier · Modifier prix ou titre · Mettre en brouillon · Mettre en ligne, raison dite une fois), carte = 2 gestes + « … », bandeau « Prix d'achat N/M », Numero/PhotoVide partout. `docs/passation/2026-11-05-chantier-c.md`. Geste : cocher deux annonces → Actions.
- **5 nov. · Chantier E1 (Ma journée, cartes sombres)** : « N gestes » = toutes les cartes, « Vendus ailleurs » et « N°x vendue, toujours rangée » dans la liste, « Voir » seul verbe, Semaine propre, tête lisible la nuit, « Modifier » hors de la courbe, « — » avec sa raison (Reçu « à dater »). `docs/passation/2026-11-05-chantier-e1.md`.
- **5 nov. · Chantier G (v35)** : Messages (filtres `.vrm-filtres`, liens de pied, colonne 368-420 px), UN écran E-mails (Paramètres y mène), `EtatPanne` E-mails/Communauté/Messages, offre Vestiaire < 6 h en ambre (jamais Vinted). `docs/passation/2026-11-05-chantier-g.md`.
- **5 nov. · Chantier F, Compta et Statistiques (v35)** : cartes vides repliées en une ligne, sous-onglets sous le titre, statut choisi à UN endroit, « — » + raison (Comparer, À déclarer) ; « À recopier sur l'URSSAF » (Copier), Bilan du mois (PDF), Délai de paiement par site. `docs/passation/2026-11-05-chantier-f.md`. Geste : déclarer depuis « À recopier ».
- **5 nov. · Petits plus (v34)** : accueil = vrais navigateurs (`navigateursServis`, Orion « en essai ») ; guide iPhone dans Notifications ; notif « compte Vinted pas relu » (Rappels, 1/jour) ; contrôle de prod (titre, santé, version extension). `docs/passation/2026-11-05-petits-plus.md`.
- **5 nov. · Stock + Vestiaire, registre + gros** : le Stock compte les annonces Vestiaire en ligne (N° par identité, `vrm_vc_liens` compris ; sans N° ou lecture absente/vieille nommée) ; registre des achats : un achat en gros = UNE ligne (total + frais, jamais ses parts). Passations stock-annonces et fournisseurs. Geste : ouvrir « Mes articles » sur Vestiaire.
- **5 nov. · Chantier A, jetons (v33)** : un bleu (`accent` aplat #0071E3/#0A84FF texte blanc, `accentTexte` liens) ; `danger` = ambre, rouge = jeton `doublon` seul (`audit-rouge-doublon`) ; `.vrm-seg-btn` = une règle (styles-coque) ; site : logo seul ; tnum aux nombres. `docs/passation/2026-11-05-chantier-a.md`.
- **5 nov. · Ventes (E2)** : revue 2.12-2.30 ; « Compte qui vend le mieux » dans Statistiques seul ; alerte d'annulations par compte. `docs/passation/2026-11-05-chantier-e2.md`.
- **5 nov. · Chantier H, coque (v35)** : en-tête = pastille de couleur (plus « ⓘ »), nuage seulement en panne ; « Dernière capture » = source de la liste ; Paramètres (icônes distinctes, Organisation en lien, plus de carte dans la carte, Statut) ; icônes de nav distinctes, un badge par colis ; cloche sur SheetShell + « Où ranger à l'arrivée » (`src/ouRanger.js`). `docs/passation/2026-11-05-chantier-h.md`.

- **6 nov. · Vague 2, comptes et e-mails** : Comptes liés, ligne « E-mails » par compte Vinted (reçoit · aucun depuis N j → Relier sa boîte) ; E-mails → Relier ma boîte : « adresse sans compte » (Relier un compte = `vinted_account_emails` sur son clic · compte acheteur) ; vente « avec Vérification de l'article » lue sans prix + étape « Au centre de vérification » (état de la transaction) ; Leboncoin « Suppression » gardé + 1 rappel/jour. `docs/passation/2026-11-06-vague2-comptes.md`. Geste : relier ses adresses sans compte.


## Lignes de « État actuel » du 5 nov. déplacées le 6 nov. (4ᵉ lot, telles quelles)




## Lignes de « État actuel » du 6 nov. déplacées le 6 nov. au soir (telles quelles)

- **6 nov. · Charge (v36)** : suppression eBay sans O(N) (0 ligne par notification d'inconnu ; `vrm_ebay_cibles`, migration **026 NON appliquée**, chemin filtré sans elle) ; factures du script Gmail en petites marches ; `src/rythmeLectures.js` : rien onglet caché, ×5 sans geste depuis 10 min (Mac au repos ~6 → 0,7 lecture/min). `docs/passation/2026-11-06-charge.md`. Geste : appliquer la 026.
- **6 nov. · Vague 3, en ligne deux fois** : carte ambre de Ma journée quand une paire (photo exacte ou `recreeDe`, jamais le titre ni le N° seul) est en ligne deux fois sur Vinted ; supprimer sur SON clic (`src/enLigneDeuxFois.js`). `docs/passation/2026-11-06-vague3-en-ligne-deux-fois.md`.
- **6 nov. · Vente vue par e-mail** : n° prouvé + compte lié + après la lecture d'`orders_sold` ⇒ ligne « Vue par e-mail » dans Ventes et VENDU (jamais CA déclaré), remplacée par la ligne Vinted ; indicateur « ventes relues hier » ; cause extension (2 000 en base) décrite. `docs/passation/2026-11-06-vente-email-fraiche.md`.
- **6 nov. · Vague 2 vitesse** : `vinted_item_details` lue fiche par fiche (`lireFichesPage`), commandes projetées sans `orders_bought` ni anciens comptes (`SEL_COMMANDES`, `vrm_comptes_lies`) ; −700 Ko par écran au banc, même texte ; `audit-lectures-lourdes`. `docs/passation/2026-11-06-vague2-vitesse.md`.
- **6 nov. · Republier à la main = réglages de l'atelier** : une source (`src/republierReglages.js`) ; retouche photo et lettre gardées et synchronisées (`vrm_republier_reglages`), baisse de prix et titre repartent de « Garder » à chaque ouverture (sa règle du 29 oct.) ; N° posé selon `vrm_num_vinted` ; feuille en 5 étapes, plusieurs paires une à une. `docs/passation/2026-11-06-republier-main.md`. Geste : essayer une série à la main.
- **6 nov. · Vague 2 Ventes (v36)** : « Remettre en vente » une vente annulée avant l'envoi (« à la main » depuis le coffre : `recreerVinted` supprime toujours l'ancienne ; N° repris, archive ⇒ neuf) ; « Prix mini… » sur une sélection ; Annonces « Sans achat relié » ; saisie en série sur `suggestionsAchat` ; Ventes : « Prix d'achat N/M » une fois. `docs/passation/2026-11-06-vague2-ventes.md`. Geste : Ventes → Annulées.
- **6 nov. · Stream (v36)** : bouton « Stream » au choix (Réglages → Mode stream, éteint ; sinon l'œil des montants, qui revient) ; photos d'article floutées par la règle du texte (`photoACacherSelon`), « toutes » au choix. `docs/passation/2026-11-06-stream-photos.md`. Geste : cocher le bouton s'il le veut.
- **6 nov. · Signaler + /etat** : « Signaler un problème » (Paramètres → Besoin d'aide, garde-fou d'écran ; `SignalerProbleme` réutilisable) : aperçu = ce qui part (une règle, `api/_lib/signalement.js`), rangé chez le propriétaire de l'installation, 5/h/compte tenu par la base, push regroupé > 3/h, « Signalements reçus » + Traité (lui seul) ; page publique `vrm.center/etat` (`public/etat.*`, `/api/sante` → `etat`, 30 s). `docs/passation/2026-11-06-signaler-etat.md`. Geste : s'envoyer un essai, ouvrir /etat.
- **6 nov. · Vague 3 écrans** : fraîcheur une voix (Annonces), « Ranger » vise sa case (cible `case`), compte exclu hors de Statistiques (`useCompteEcarte`), carte sombre aux jetons `surSombre*` (4,5:1). `docs/passation/2026-11-06-vague3-ecrans.md`.


- **6 nov. · Extension 5.323** : ventes/achats FUSIONNÉS par n° de transaction (une vente du matin jetée « plus pauvre », 320 lues contre 2 000) ; relevé du porte-monnaie par `wallet/invoices/current`, l'app date une vente par SON n° seulement ; capture brute Vestiaire COUPÉE. `docs/passation/2026-11-06-extension-5323.md`. Geste : installer la 5.323, ouvrir Porte-monnaie → Historique sur Vinted ; confirmer la suppression des 40 `vc_brut_*`.

- **6 nov. · Sauvegarde + prix au numérotage** : copie nocturne chiffrée du `public` (gpg, artefact 30 j, dépôt PUBLIC ⇒ jamais en clair), essai de restauration le dimanche (`scripts/sauvegarde/`) ; prix d'achat demandé à chaque N° par UNE écriture (`src/prixAuNumerotage.js`, vide ⇒ rien), carte Ma journée fusionnée. `docs/passation/2026-11-06-sauvegarde-prix.md`. Geste : poser `SUPABASE_DB_URL` (Session pooler) et `SAUVEGARDE_PHRASE` dans les secrets GitHub, puis Run workflow.


- **6 nov. · SMS Mondial Relay** : casiers annoncés par SMS ⇒ Raccourcis POST `/api/widget?mode=sms` (jeton `vrm_sms_token`, le vendeur = le jeton), rangés comme les e-mails. `docs/passation/2026-11-06-sms-colis.md`. Geste : Réglages → SMS Mondial Relay.


## Lignes du §9 de CLAUDE.md déplacées le 7 nov. (taille du fichier)

- **6 nov. · Films (motion design)** : la VRAIE app filmée image par image, données inventées (`scripts/films/`, vidéos hors dépôt). `docs/passation/2026-11-06-films.md`. Geste : regarder et publier.

- **6 nov. · Bancs rouges d'avant (v36)** : Facturation Pro ne plante plus (réponse sans boîte = pas su), « Ajouter » du stream dit pourquoi, Statistiques à l'échelle 28/20/15/13/11, transporteurs 2 × 2 au téléphone ; 15 bancs jugent la règle actuelle. `docs/passation/2026-11-06-bancs-preexistants.md`. Geste : aucun.
### Lignes du §9 de CLAUDE.md déplacées telles quelles (7 nov.)


- **6 nov. · Recherche par photo (v36)** : appareil photo dans la loupe et le Stock ; empreinte locale SANS modèle (`src/empreintePhoto.js` : couleur sans le fond + balance des blancs, grille, bords, hachages), index sur l'appareil par URL exacte, octets par `chargerPhotoBoite` ; 5 propositions « très proche / proche / peu sûr », SON clic ouvre « Tout sur le N° », rien relié ; mesure 3D inventée top 5 100 %, top 1 82,5 %. `docs/passation/2026-11-06-recherche-photo.md`. Geste : l'essayer dans le navigateur de l'extension.

- **6 nov. · Ouvrir aux clients** : pas-à-pas `docs/ouvrir-aux-clients.md` (mentions, Supabase SMTP, Vercel Pro, Stripe, verrou `abonnement_obligatoire`) ; « Découvrir avec des exemples » (`src/modeExemple.js` : tout en mémoire, 0 écriture) ; guide de démarrage coché sur preuve (`src/guideDemarrage.js`). `docs/passation/2026-11-06-clients.md`. Geste : suivre le pas-à-pas.

- **6 nov. · Filets anti-bug (v36)** : `verifier.yml` sur chaque PR (build, tous les audits en 3 parts — rouges connus dans `scripts/audits-exceptions.json` —, bancs, WebKit non bloquant), un garde-fou par écran et par feuille (`GardeEcran`), morceau d'un ancien déploiement compté à part (jamais un plantage), veille des plantages au cron du matin (propriétaire seul), `controle-prod.yml` après mise en ligne (lecture seule). `docs/passation/2026-11-06-filets-anti-bug.md`. Geste : rendre le contrôle obligatoire (règle de branche `main`, pas-à-pas dans la passation).

- **6 nov. · Onglets A (Ma journée, Ventes, Achats)** : « 0 € aujourd'hui » corrigé (la coque relit ses ventes par sa sonde, `src/sondeVentes.js`, le même « aujourd'hui » partout sans recharger) ; « lecture… » au lieu de « pas lu » pendant la lecture ; « Colis envoyés » jamais 0 sans gestes ; achat suspendu hors « en route » ; un nombre une fois ; « ? » « D'où viennent ces chiffres » (`AIDE_CHIFFRES`). `docs/passation/2026-11-06-onglets-a.md`. Geste : toucher le « ? » de Ventes.

- **6 nov. · Vitesse 2** : dressings projetés (`lireDressings`, comptes liés, vide ⇒ motif), achats des comptes liés (`lireAchatsLies` ; la cloche reprend ceux du démarrage), 15 morceaux à la demande (`aLaDemande` = `React.lazy`, leur CSS reste dans App) ; −700 Ko lus par écran, 1er chargement 1 405 → 1 299 Ko gz. `docs/passation/2026-11-06-vitesse2.md`.

- **6 nov. · Inventaire (v36)** : Stock → « Inventaire » (et Ma journée si en cours) : il tape les N° vus ⇒ « ✓ Attendu » neutre (pas de vert, §7) · ambre en trop / vendu · rouge deux paires sous un N° ; bilan manque / en trop / vendu rangé ; attendu = celui du Stock, pas su ≠ manque, aucun N° changé ; « N° + Entrée » ICI seulement ; ligne `vrm_inventaire` (rev). `docs/passation/2026-11-06-inventaire.md`. Geste : faire le tour des cartons.

- **6 nov. · Onglets C (E-mails)** : 3 comptes sur 9 muets, tous en relais d'Apple ; « Relier la boîte de <compte> » (pas-à-pas par compte, Yahoo et relais Apple, VÉRIFIÉ sur e-mail lu, `src/relierCompte.js`) depuis E-mails, Comptes liés, Colis, Ma journée (`relierBoiteDe`) ; recherche et « À vérifier » dans la boîte. `docs/passation/2026-11-06-onglets-c.md`. Geste : Transférer à une boîte reliée.

## Déplacé de CLAUDE.md §9 le 8 nov. (tel quel)
- **6 nov. · Finitions (v36)** : « Plus tard » revient après 7 j (et relu au nuage) ; N° d'archive remis en vente ⇒ « à écrire sur tes cartons » ; Actions à deux comptes dit « Prix mini : possible » ; Colis une voix de fraîcheur ; `data-aller-chercher` ; « — » de Compta au jeton ; une paire en ligne deux fois = ambre seul, plus le rouge ; banc transporteurs à la forme du 3 nov. + ambre sombre, phrase « code postal », « transporteur pas encore connu ». `docs/passation/2026-11-06-finitions.md`. Geste : aucun.
- **6 nov. · Onglets B (Colis, Stock)** : le prochain geste en une ligne en tête de Colis (urgent d'abord, colis comptés seuls, `src/prochainGesteColis.js`) ; « à imprimer » = pas encore imprimés (9→3 mesuré) ; un S10 étranger n'est plus « Chronopost » (« Colis international (pays) », Chronopost = forme XW/ZW…TS/SP) ; comptes muets → Comptes liés ; légende du Stock. `docs/passation/2026-11-06-onglets-b.md`. Geste : supprimer s'il veut les 3 `transp_chronopost_…IE` vides.
- **6 nov. · eBay + Leboncoin (v36)** : Leboncoin « en ligne » = la lecture COMPLÈTE de « Mes annonces » de son compte de moins de 24 h (`src/enLigneLbc.js`, règle de Vinted), sinon « à confirmer » hors des totaux (mesuré : 8 « Actives », 0 lecture complète jamais rangée) ; alertes anti double vente inchangées ; carte eBay = photo · titre · N° · prix · une ligne, UN geste + « … » (fiche : règle d'offre, modifier, supprimer). `docs/passation/2026-11-06-ebay-lbc.md` (§3 : correctifs extension à faire). Geste : se reconnecter à Leboncoin et ouvrir « Mes annonces » sur chaque compte.

## Lignes du §9 de CLAUDE.md déplacées le 8 nov. (telles quelles)

- **6 nov. · Onglets D (Annonces, Compta, Statistiques, Paramètres)** : sa base recalculée = l'app (25 mois de CA, 49 en ligne, 19 vendues) ; une vente « à dater » vendue ET lue finalisée la même année compte dans le CA de l'ANNÉE, jamais d'un mois (`src/aDaterAnnee.js` ; seuils, revenus, DAC7, « CA de l'année » de Ventes) ; « Déclarer » en 3 étapes avec « ? » ; Annonces « Prochain geste » ; Paramètres par intention, une phrase par réglage. `docs/passation/2026-11-06-onglets-d.md`. Geste : Compta → Déclarer octobre.
- **6 nov. · Facture Pro (v36)** : bouton « Envoyer la facture » sur la LIGNE de la vente seulement si l'acheteur est PROUVÉ (même n° de transaction Vinted + e-mail Pro, heure −2/+15 min, montant ; sinon la raison, `src/facturePro/rattachement.js`, relue par le serveur) ; envoi PAR VRM (From « … via VRM », Reply-To et Cc au vendeur, 50/jour) ; « Ma facture » avec aperçu en direct. `docs/passation/2026-11-06-facture-pro.md`. Geste : remplir Ma facture, poser `RELANCES_SMTP_*`.
- **6 nov. · Accompagnement (v36)** : visite à 4 bulles ; conseils = 1 bulle non modale sur le VRAI bouton (halo, Plus tard, Ne plus montrer), 2/jour, 1/écran, 3 j de repos, sur un chiffre publié par l'écran (`<ChiffreConseil>`, pas su ⇒ rien), « vu » écrit d'abord dans `vrm_accompagnement` (rev) ; `src/accompagnement.js`, `audit-conseils`. `docs/passation/2026-11-06-accompagnement.md`. Geste : aucun.
- **6 nov. · Boîte mail façon Mail (v36)** : lu / non lu (`api/_lib/emails-lus.js`, ligne `vrm_emails_lus`, glisser au doigt, « Tout marquer lu », rien de caché, pas d'« Archiver »), code de retrait copiable sur la ligne (lu seulement), piles des rafales, avatars (logos de l'app), carte « ce qu'il faut savoir » (code façon carte d'embarquement), gestes par identité, message rendu sans HTML, rubrique Offres, 50 par page au défilement. `docs/passation/2026-11-06-boite-mail.md`. Geste : copier un code depuis la ligne ; décider du HTML d'origine.
- **6 nov. · Chargement** : écran de démarrage dans `index.html` (avant le JS, retiré par `src/demarrage.js`) ; chaque écran attend ses données essentielles derrière son squelette (`src/AttenteEcran.jsx`, `ESSENTIELS_ECRAN`, plafond 2,5 s) ; « lecture… », jamais « pas lu », pendant qu'une publication se prépare ; banc `chargement.cjs`. `docs/passation/2026-11-06-chargement.md`.
- **6 nov. · « Annuler » partout (v36)** : geste interne instantané + pilule 5 s « Annuler » (`src/gesteAnnulable.js`, `PiluleAnnuler`, `gesteVrm`) sur 10 gestes ; refus ⇒ l'écran revient, « Pas enregistré — Réessayer » ; réseau ⇒ « pas encore envoyé » (file d'envoi) ; jamais sur un geste chez un tiers. `docs/passation/2026-11-06-annuler.md`. Geste : Colis → « J'ai retiré » → Annuler.

## Lignes déplacées telles quelles de CLAUDE.md §9 (8 nov., session bordereau des e-mails)

- **6 nov. · Hors réseau + temps réels (v36)** : Colis rouvert sans réseau (par point relais, codes, QR, « En grand »), « Hors connexion — dernier état du … », « J'ai retiré »/« Colis fait » en file ; temps réels anonymes (`src/mesuresTerrain.js`, `compte?mode=mesures`, 1 lot/min), panneau propriétaire, veille +30 % au p75. `docs/passation/2026-11-06-hors-reseau.md`.
- **6 nov. · Statut des colis** : règle d'état datée (`api/_lib/etat-colis.js` : fini prouvé gagne, une lecture plus vieille ne fait pas reculer, « en route » daté après l'arrivée ⇒ à vérifier) ; conversation des e-mails Vinted relus décodée dans le navigateur (À vérifier 34 → 2) ; date estimée par la garde. `docs/passation/2026-11-06-statut-colis.md`. Geste : aucun.
- **6 nov. · Visuel (v36)** : une ligne d'explication au plus, le reste en feuille (`Pourquoi`, ⓘ collé au texte) ; Réglages eBay en rangées iOS (`src/composants/Ios.jsx`), `Notice` en rangée, plus de barres latérales, listes en groupes iOS. `docs/passation/2026-11-06-visuel.md`.
## Lignes du §9 de CLAUDE.md déplacées telles quelles (8 nov.)
- **6 nov. · Visuel 2 (v36)** : grand titre qui se replie (téléphone ; barre de verre retirée : CLS au chargement) ; Colis (nom sur sa ligne, adresse dessous), eBay (À faire en Réglages, « Relier » au maillon, photo 64), Ma journée (À faire en UNE carte, paires du jour en pile), états vides dessinés, chiffre qui roule, `montant()` partout ; violet interdit (`audit-violet`, pastilles de compte). `docs/passation/2026-11-06-visuel-2.md`. Geste : regarder Colis et eBay sur l’iPhone.
## Ligne du §9 de CLAUDE.md déplacée le 8 nov., chantier clarté (telle quelle)
- **6 nov. · Loupe universelle (v36)** : une loupe pour tout (N°, pseudo, suivi, code ⇒ colis « En grand », transaction, montant au centime, titre, marque/taille, facture, e-mail par le moteur de l'écran E-mails) ; 50 jumelles = 50 lignes ; texte tapé hors de la coque (frappe 32 ms médiane au banc). `docs/passation/2026-11-06-recherche.md`. Geste : taper un code de retrait.


## Lignes du §9 de CLAUDE.md déplacées telles quelles (8 nov., garde-fous de la capture)

- **6 nov. · E-mails mis en page (v36)** : HTML d'origine ASSAINI des seuls e-mails à geste, 30 jours, ligne à part `email_html_*` (liste blanche, images sur geste, pixels retirés, 150 Ko ; jamais 503 pour lui ; purge au cron du matin ; relu et ré-assaini), cadre `sandbox` sans scripts, masqué en stream. `docs/passation/2026-11-06-emails-html.md`. Geste : aucun.
- **6 nov. · Audit des chiffres** : « à imprimer » = pas encore imprimés partout (`compteAImprimer`), Tournée « à déposer » = avec bordereau, widget sans colis sans n° (15→12) ; banc `chiffres-coherents`. `docs/passation/2026-11-06-audit-chiffres.md`. Geste : aucun.
- **6 nov. · Finition (v36)** : espace insécable avant « € » et « % » (`montant()` + 290 textes, `scripts/typo-insecables.cjs`), « e-mail » partout, milliers ; grand texte de l'appareil = échelle de l'app (`src/grandTexte.js`, `src/styles-lisible.css`) ; contrastes AA par les jetons (`onWarn`), axe-core 0 ; banc `finition.cjs`. `docs/passation/2026-11-06-finition.md`. Geste : Taille du texte de l'iPhone plus grande, rouvrir VRM.
- **7 nov. · PASSATION GÉNÉRALE** : prod = PR #1027 ; 4 chantiers finis ou presque en attente sur `claude/attente-*` (hors réseau, e-mails HTML, audit des chiffres, finition textes/grand texte/sombre — dans cet ordre) ; découpage d'App.jsx et relecture finale pas commencés ; au plus 2 agents de bancs (le conteneur tombe). `docs/passation/2026-11-07-passation-generale.md`.
## Ligne du §9 de CLAUDE.md déplacée le 8 nov., chantier boutiques d'extension (telle quelle)
- **7 nov. · Design 2026** : jetons `--d-*` (src/styles-design-2026.css, dernier CSS d'App.jsx) + DESIGN.md ; Colis : frise seulement si une étape est faite, logo du transporteur LU en badge (`BadgeTransporteur`), rangées à l'ordinateur. `docs/passation/2026-11-07-design-fondations.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée le 8 nov., chantier premières minutes (telle quelle)
- **7 nov. · Charge 1 000 vendeurs** : pages triées, jeton widget/SMS par index, `mesures_jour_` en 16 éclats, offres mini bornées, 503 sans clé de service, cron par lots (curseur). `docs/passation/2026-11-07-charge-1000.md`. Geste : migration 026.
## Déplacé de CLAUDE.md §9 le 8 nov. (CI verte), tel quel
- **7 nov. · Colis sans réseau : intégration** : branche `claude/attente-v36-hors-reseau` fusionnée ; purge à 90 jours des `mesures_jour_*` du propriétaire au cron du matin (`purgerMesuresAnciennes`, lecture `select=id` paginée, jour lu dans l'id, lecture ratée ⇒ rien supprimé ; `audit-purge-mesures` + `--prouve`). `docs/passation/2026-11-06-hors-reseau.md` §Purge. Geste : couper le réseau sur l'iPhone et rouvrir Colis.
- **7 nov. · Vitesse au téléphone** : Colis 20 → 6-9 s de gel, Ma journée 11,6 → 3,0 s (CPU ×4) — formateurs de dates créés une fois, `UneLigne` mesurée en groupe, règles d'identité mémorisées pour UN calcul (`memoRendu`), index des suivis ; reste : `Comptabilite` remonté à chaque écran (découpage) et `email_track` lu en entier. `docs/passation/2026-11-07-vitesse.md`. Geste : aucun.
## Ligne(s) du §9 de CLAUDE.md déplacée(s) le 8 nov., chantier aide-signalement (telles quelles)
- **8 nov. · Finition : intégration** : branche `claude/attente-v36-finition-integ` fusionnée avec main ; les 221 bancs restants lancés un à un et chaque rouge relancé sur main : 1 défaut corrigé (`UneLigne` perdait l'insécable de « 14 € » à la coupe), 5 bancs jugés à l'insécable/tournure (`rapport`, `mode-stream`, `stream-photos`, `messagerie`, `pave-vinted`), le reste identique sur main ; insécable avant « : ; ? ! » pas appliquée. `docs/passation/2026-11-07-finition-bancs.md`. Geste : aucun.
## Lignes déplacées du §9 de CLAUDE.md (8 nov., taille)
- **7 nov. · Je numérote moi-même (5.324)** : réglage `vrm_numero_ecrit`, éteint par défaut ; allumé, VRM ne DONNE plus aucun N° (annonce, vente à expédier, doublon, Vestiaire, réservation de l'extension) et LIT le sien (`src/numeroEcrit.js` : fin de description, titre, SKU eBay, CustomRef Leboncoin ; jamais un nombre nu ; deux N° = ambigu ; contredit = « à vérifier », son clic). Aperçu des 4 sites dans Réglages → Numéros. `docs/passation/2026-11-07-numero-ecrit.md`. Geste : aucun (Vinted pro à mesurer).
## Ligne du §9 de CLAUDE.md déplacée le 8 nov., chantier confiance (telle quelle)
- **8 nov. · Design 2026, passage 2** : `--d-*` appliqué à Ventes (groupe à rangées, état en mot + point ambre, tiroir groupé), Annonces (5 colonnes, bandes de chiffres), Achats, Messages, E-mails, Compta (statut d'abord), Stats, Stock, Réglages, plateformes, loupe ; DESIGN.md +6 composants. `docs/passation/2026-11-08-design-ecrans.md`. Geste : regarder Ventes et Annonces.
## Ligne du §9 de CLAUDE.md déplacée le 8 nov., chantier restes ventes (telle quelle)
- **8 nov. · Retraits : le suivi lu sort un colis en le disant** : un e-mail rangé « vinted »/« autre » se lit par la forme du n° (`carrierLuDeLigne`) ; deux `transp_` pour un n° ⇒ la lue (`indexTranspParSuivi`, app = serveur = cron) ; une lecture après 30 j ; Colis → À retirer « Sortis de « à retirer » » (« Mondial Relay : retiré le 5 nov. », 3 j, hors compte) et « pourquoi pas lu » + geste (`src/retraitSuivi.js`) ; widget : jamais un n° de ses bordereaux. `docs/passation/2026-11-08-retraits-suivi.md`. Geste : aucun.
- **8 nov. · Colis vendus partis d'après le transporteur** : vente « à envoyer » (Vestiaire, Vinted) dont le n° EXACT est pris en charge chez Chronopost/Vinted Go ⇒ « Envoyés » avec la raison, partout (Colis, Ma journée, cloche, widget, rappels) ; lignes à part `depart_*` (jamais `transp_`, jamais « à retirer ») ; Mondial Relay/Colissimo pas lus. `docs/passation/2026-11-08-colis-sortants.md`. Geste : aucun.
- **8 nov. · Démarrage léger** : 14 écrans sortis d'App.jsx vers `src/ecrans/*.jsx`, chargés à la demande (`scripts/decouper-app.cjs`, découpe mécanique ; balises `// ⟦→ ecrans/X.jsx #k⟧` à ne pas effacer) ; morceau App 1 223 → 808 Ko gz ; feuilles de l'app dans `src/stylesApp.js` (index.css 668 → 18 Ko, cascade identique) ; App préchargé par `public/demarrage-app.js` ; audits : `scripts/_source-app.cjs` (`brancher()`) recolle le texte d'origine. `docs/passation/2026-11-08-demarrage-leger.md`. Geste : aucun.
- **8 nov. · Démarrage : moins de lectures** : −12 à −15 lectures et −200 Ko par ouverture (dressings et boîtes en `in.(…)` par famille, petites lignes `select=data` groupées — `src/lectureGroupee.js` ; transactions plus relues — `src/memoEcritures.js` ; suivis sans l'image du QR des colis retirés — `src/suivisSansQr.js`) ; Ventes −1,2 s, Ma journée/Colis limitées par le processeur ; instantané de 2e ouverture : plan seulement. `docs/passation/2026-11-08-demarrage-lectures.md`. Geste : aucun.
## Ligne déplacée de CLAUDE.md §9 (8 nov., session « connexion-carte », telle quelle)
- **8 nov. · Extension 5.325 : Google / Discord** : la fenêtre propose « Continuer avec Google / Discord » (fournisseur activé chez Supabase seulement, pas su ⇒ caché) ; VRM part chez le fournisseur puis adresse sa session à CETTE extension ; carte du logo : cause du refus dite + 5 derniers refus datés. `docs/passation/2026-11-08-extension-google-discord.md`. Geste : activer Discord chez Supabase ; installer la 5.325.
## Déplacé de CLAUDE.md §9 le 8 nov. (tel quel)
- **8 nov. · « À envoyer » prouvé** : UNE règle `api/_lib/depart-vente.js` (Colis fait, expédié, panneau, e-mail transporteur du n° EXACT de SON bordereau, `depart_*` ; n° partagé/achat, entrant, étiquette seule ⇒ rien) lue par Colis, Ma journée, cloche, Ventes (« Envoyée »), loupe, widget, rappels, bilan. `docs/passation/2026-11-08-a-envoyer-preuves.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée le 8 nov., chantier beauté (telle quelle)
- **8 nov. · Ventes envoyées légères (5.326)** : la ligne `orders_sold` d'un gros compte (2 000 ventes ≈ 1 055 Ko) n'est plus relue ni réécrite depuis le téléphone (coupée sur iOS) : l'extension envoie la fenêtre abrégée + ce qui manque (61,5 Ko), `vrm.center` fusionne (même règle, `src/commandesFusion.js`) ; la ligne garde sa forme, aucun lecteur ne change. `docs/passation/2026-11-08-ventes-envoi-leger.md`. Geste : installer 5.326, ouvrir Mes commandes sur shop_cancale.
- **8 nov. · Clarté des onglets et des boutons** : UNE phrase de ≤ 10 mots revient sous chaque titre (`src/phrasesEcran.js`, décision du 3 nov. renversée par sa demande du 8 nov. ; vider l'entrée la retire) ; barre du bas = nom de l'écran (Statistiques, Paramètres) ; boutons au verbe explicite, icônes nommées ; « À envoyer » partout. `docs/passation/2026-11-08-clarte.md`. Geste : dire s'il garde les phrases.
- **8 nov. · Zéro audit rouge** : les 7 audits rouges depuis des jours sont verts — 1 vrai défaut corrigé (E-mails : la photo de la paire, une photo Vinted, passe par `PhotoVinted`), 5 contrôles mis à la règle actuelle (prop `reserve`, clé non numérique par construction, une phrase par réglage, chaque carte « À faire » comptée, liens partis dans `src/ecrans/`), `pdfjs-dist` absent du conteneur dit en clair. `docs/passation/2026-11-08-zero-audit-rouge.md`. Geste : aucun.
- **8 nov. · Bordereau dès l'e-mail** : vente vue par e-mail + bordereau du MÊME n° de transaction ⇒ colis « prêt à imprimer » partout (Colis, lot, Ma journée, cloche, ligne Ventes « Imprimer ») ; N° du tampon par identité seule (posé, Relier, annonce/photo, « nXX » écrit dans le titre, réglage écrit), jamais le N° retrouvé par titre ; sinon « Sans N° : à écrire à la main », puis « Imprimé sans N° » (`src/bordereauVenteEmail.js`, `vrm_bords_sans_num`) ; widget serveur pas encore. `docs/passation/2026-11-08-bordereau-des-email.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée le 8 nov., chantier vitesse-calcul-partage (telle quelle)
- **8 nov. · Parcours plus clairs** : repères partagés, synchronisation par compte, réponses/offres, code de retrait copiable, compte email incertain, reprise des lots et guide sans saut d’étape. `docs/passation/2026-11-08-parcours-clairs.md`. Aucune mise à jour d’extension.
- **8 nov. · À retirer : villes, carte, délai** : villes = seulement celles où un colis compté attend, triées par urgence, + « Autres » (`selecteurVilles`) ; carte AUSSI au téléphone (200 px, suit la ville, deux doigts, « Agrandir », hors réseau ⇒ rien) ; barre du délai arrivée lue → limite (lue, sinon « estimée »), ambre ≤ 24 h, jamais rouge, en tête du point si commune (`src/delaiRetrait.js`). `docs/passation/2026-11-08-retirer-carte-delai.md`. Geste : aucun.
- **8 nov. · Écrans gardés, onglets en fondu** : Ma journée, Colis, Ventes déjà vues (pas Annonces : plus lente rattachée) restent montées, GELÉES (Suspense : ni rendu, ni effet, ni publication, ni lecture) et détachées ; réutilisées au seul toucher de la barre, remontées si une donnée a changé (`src/ecransGardes.jsx`) ; fondu Web Animations + pastille qui glisse (`src/passageOnglet.js`) ; plus de classe sur `<main>` ni de View Transitions (recalcul de style de toute la page, mesuré). `docs/passation/2026-11-08-vitesse-calcul-partage.md`, banc `ecrans-gardes`. Geste : aucun.
## Déplacé de CLAUDE.md §9 (8 nov., tel quel)
## Déplacé de CLAUDE.md §9 le 8 nov. (nuit) — tel quel
- **8 nov. · Confiance** : Mon compte → « Ce que VRM lit et fait » (par site, quand l'extension agit, Irlande/Dublin, qui y a accès ; chaque phrase tenue par le code, `src/tesDonnees.js`) ; journal : chaque geste avec sa PREUVE + commandes du téléphone (`cmd_relais_*`, sans corps) ; page publique `/statut` + incidents posés à la main (`public/statut-incidents.json`) ; `audit-confiance --prouve`. `docs/passation/2026-11-08-confiance.md`. Geste : aucun.
- **8 nov. · Abonnement propre** : sans abonnement : extrait net, reste flouté, aucune action — décision de Julien du 8 nov. (027 : lire oui, écrire non ; `src/abonnement/apercu.js`) ; essai clair (J-3/J-1), page Abonnement en rangées, portail Stripe, résilier en 2 clics, parrainage éteint. `docs/passation/2026-11-08-abonnement-propre.md`. Geste : 027, portail + `invoice.paid`.
- **8 nov. · CI verte** : les 2 workflows qui envoyaient « run failed » (Parcours critiques, Reprise des chantiers) rejoués étape par étape, verts ; 3 vrais défauts corrigés (lien de récupération en Referer, `?vue=compte`/`?abonnement=` perdus par le découpage, menu ⋯ d'un achat recouvert) ; tests périmés remis à la même règle (mutations) ; jamais « /* » dans un commentaire d'App.jsx. `docs/passation/2026-11-08-ci-verte.md`. Geste : aucun.
## Déplacé de CLAUDE.md §9 le 8 nov. (place pour « Nouveau compte relié »)
- **8 nov. · Premières minutes** : parcours en 5 étapes cochées sur preuve lue (compte, extension, Vinted, boîte, 1re vente), « Plus tard » 7 j (`vrm_parcours_plus_tard`), choix de la numérotation au départ (jamais à un vendeur qui a des N°), « Voir VRM avec des exemples », « Vérifier mon installation » (guide + Paramètres → Aide) ; `src/guideDemarrage.js`, `audit-premieres-minutes` (--prouve 9), banc `premieres-minutes`. `docs/passation/2026-11-08-premieres-minutes.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée le 9 nov., chantier colis-envoyes-tri (telle quelle)
<!-- Ligne déplacée telle quelle du §9 de CLAUDE.md le 8 nov. (chantier notifications), pour tenir sous 59 000 octets. -->
- **8 nov. · Extension dans les boutiques** : fiches Chrome/Edge/Firefox prêtes à coller, visuels (mode exemple), paquets `scripts/paquets-boutiques.cjs` + audit (= code servi), politique `/legal/extension.html`, `installerExtensionIci` (lien boutique si `LIENS_BOUTIQUES`, sinon zip). `docs/passation/2026-11-08-extension-boutiques.md`. Geste : `docs/boutiques/README.md` (5 lignes).
- **8 nov. · Garde-fous de la capture (5.327)** : appareil publié par l'extension, alerte « compte pas relu » (ligne ambre + notification une fois par panne, `api/_lib/garde-capture.js`), Paramètres → « Tout va bien ? », voie de secours bornée, test « comme Orion » (CI). `docs/passation/2026-11-08-garde-fous-capture.md`. Geste : installer la 5.327 (Chrome ET Orion).

## Déplacé de CLAUDE.md §9 (9 nov., tel quel)
## Lignes du §9 de CLAUDE.md déplacées le 9 nov. (telles quelles)
- **8 nov. · Petits défauts des contrôles** : liens disabled bloqués, longs libellés contenus, boutons mobiles alignés, zéro explicite et seuil de recherche des mails expliqué. `docs/passation/2026-11-08-petits-defauts-controles.md`. Aucune extension à installer.
- **8 nov. · Recherche et filtres** : réinitialisation des filtres cumulés de la boîte mail, dictée annulée sans retour tardif et composition de texte protégée. `docs/passation/2026-11-08-recherches-filtres.md`. Aucune mise à jour d’extension.
- **8 nov. · Actions et offres** : repère au minimum saisi, liens occupés réellement bloqués, relecture sans double départ, indicateur lisible et mouvement réduit. `docs/passation/2026-11-08-actions-offres-finitions.md`. Aucune extension à réinstaller.
- **8 nov. · Restes ventes** : une phrase répétée sur ≥ 2 lignes de Ventes (note « vue par e-mail » par compte, refus de facture commun) dite une fois en tête ; widget, rappels et bilan comptent les ventes vues par e-mail avec leur bordereau (`api/_lib/colis-ventes-email.js` importe les règles de l'app) ; Mondial Relay au départ : aucune identité sûre, 3 mesures à faire. `docs/passation/2026-11-08-restes-ventes.md`. Geste : aucun.
> Déplacé TEL QUEL de CLAUDE.md §9 le 9 novembre 2026 (taille < 59 000 octets) :
## Déplacé tel quel de CLAUDE.md §9 (9 nov., taille du fichier)
## Lignes du §9 de CLAUDE.md déplacées telles quelles (9 nov.)
### Ligne déplacée telle quelle de CLAUDE.md §9 (9 nov., taille du dossier)
- **8 nov. · Beauté** : Ma journée : `data-prochain` sur la 1re ligne + phrase du jour sans compte redit (`src/phraseJour.js`, la forme est à `claude/direction-artistique`) ; vignettes en fondu (`src/fonduPhotos.js`) ; « Colis fait » au glisser à droite (`src/GlisserColis.js`, pilule Annuler) ; tournée « 3 / 7 » lisible debout ; Statistiques façon Santé (`src/GraphiqueSemaines.jsx`) ; icônes v5 ; Apparence Clair/Sombre/Automatique/Le soir (`src/apparence.js` = `public/demarrage-theme.js`). `docs/passation/2026-11-08-beaute.md`. Geste : aucun.
- **8 nov. · Aide et signalement** : « ? » après la phrase de chaque écran (3 questions, article, « Signaler ») ; signalement enrichi (capture SCHÉMATIQUE en nombres, 30 requêtes par famille, 50 erreurs, montants/pseudos masqués) ; centre d'aide `vrm.center/aide` (généré par `scripts/aide-generer.cjs`) ; alertes de plantage groupées (1/h) au propriétaire. `docs/passation/2026-11-08-aide-signalement.md`. Geste : ouvrir vrm.center/aide.
<!-- déplacé tel quel de CLAUDE.md §9 le 9 nov. (sécurité 2) -->
- **8 nov. · Adresse de réception unique (comme vtools)** : chaque vendeur a SA propre adresse `jeton@DOMAINE_RECEPTION` (24 car., ≈2^119) ; livré là ⇒ rangé chez lui AVANT toute autre règle (index neutre, jeton re-comparé, enveloppe `envelopeTo` fait foi) ; inconnue/remplacée/éteinte ⇒ quarantaine neutre non réclamable ; code Gmail affiché (Copier + lien Google) ; feuille « Ton adresse VRM » (E-mails → Relier ma boîte, Réglages → E-mails → Adresses). `docs/passation/2026-11-08-adresse-reception.md`. Geste : domaine dédié + Cloudflare catch-all → Worker + `DOMAINE_RECEPTION` sur Vercel.
### Déplacé de CLAUDE.md §9 le 9 nov. (tel quel)

<!-- déplacé tel quel de CLAUDE.md §9 le 9 nov. (leboncoin clair) -->
- **8 nov. · Extension 5.328 : connexion DANS l'extension** : carte du logo et fenêtre commencent par email + mot de passe VRM, puis Google/Discord en PKCE dans l'extension (retour `vrm.center/extension-retour.html`), « par le site » en dernier ; Orion : liaison par le pont d'emblée ; sans session rien ne part ni n'est « refusé ». `docs/passation/2026-11-08-connexion-carte.md`. Geste : Supabase → Redirect URLs `https://vrm.center/extension-retour.html`.
- **8 nov. · Vendeurs différents** : Affichage Simple/Complet (`vrm_affichage`, auto = 1 compte et < 30 ventes/30 j, jamais Julien, pas su ⇒ Complet ; ne cache que des entrées, aucun total) ; « Je vends » (`vrm_je_vends`) : hors sneakers taille/marque facultatives, « article » ; « ordinateur » seulement si vrai (Orion) ; équipe : 016 dite. `src/profilVendeur.js`, `docs/passation/2026-11-08-vendeurs-differents.md`. Geste : 016.
- **8 nov. · Accueil qui vend + bilan du mois par e-mail** : page publique refaite (promesse, journée en 4 moments, VRAIES captures en mode exemple `scripts/accueil-captures.cjs` + registre d'empreintes, prix et essai lus dans le code, FAQ, `/statut`) ; bilan du mois ÉTEINT par défaut (`api/_lib/bilan-mois.js`, règles de l'app, bénéfice recopié `benefice-regle.js`, 150/jour au plus) ; `docs/gestes-1000-vendeurs.md`. `docs/passation/2026-11-08-accueil-bilan.md`. Geste : `RELANCES_SMTP_*`, puis l'allumer dans Réglages → Notifications.

## Ligne du §9 de CLAUDE.md déplacée le 9 nov., chantier configuration-depart (telle quelle)
- **8 nov. · Direction artistique, phase 1 (à valider)** : Ma journée, Ventes, Colis refaits par une couche `@layer vrm-premium` (`src/styles-premium.css`, jetons `--p-*`, dernier mot sans surenchère de sélecteurs) : marge 16, 34/700, colis et ventes en groupes à rangées, ambre = un point, carte sombre calmée ; rien de métier changé. `docs/passation/2026-11-08-direction-artistique.md` (+ phase 2). Branche `claude/direction-artistique`, pas mergée. Geste : regarder les captures avant/après et dire oui/non.

## Lignes du §9 de CLAUDE.md déplacées telles quelles le 9 nov. (soir)
- **8 nov. (nuit) · Beaux e-mails** : un gabarit commun `api/_lib/mail-gabarit.js` (logo, préentête, 520, sombre toléré, UN bouton bleu, « Gérer mes e-mails » sur les facultatifs, éditeur seulement si rempli) pour essai j1/j3/j6, bilan du mois (couverture « sur N ventes de M », jamais « au moins 0 »), preuve d'adresse, facture Pro, essai de boîte ; « M’envoyer un e-mail d’essai » (Réglages → Notifications, 3/h) ; `audit-mails-envoyes` (+ `--mutations`), `scripts/mails-apercus.cjs`. `docs/passation/2026-11-08-mails-envoyes.md`. Geste : s'envoyer l'e-mail d'essai.
- **8 nov. · Nouveau compte relié** : feuille « shop_x est relié à VRM » une fois par compte (identité, ligne `vrm_comptes_relies`, point de départ posé par l'app ⇒ jamais pour les comptes déjà là), première lecture cochée sur preuve (annonces/ventes/achats/porte-monnaie, nombre lu ou « En cours », geste après 3 min), nom court · totaux · règle des N° ; notification famille « Nouveau compte relié » (`api/_lib/compte-relie.js`, via `/api/push` + cron), rattrapable dans Comptes liés. `docs/passation/2026-11-08-compte-relie.md`. Geste : aucun.
- **8 nov. · Notifications belles et utiles** : une forme pour tout ce qui sonne (`api/_lib/notif-belle.js` : sans emoji, titre ≤ 40 qui dit le fait, corps = geste + échéance, badge monochrome, actions, photo seulement prouvée) ; regroupement par genre et heures calmes 22 h → 8 h ALLUMÉS par défaut (sauf double vente et limite < 10 h) ; cloche regroupée pareil ; doublons locaux retirés. `docs/passation/2026-11-08-notifications.md`. Geste : aucun.
- **8 nov. · Navigation et plateformes choisies** : colonne par tâches sans doublons, choix au démarrage et Paramètres → Affichage → Mes plateformes ; connexions reconnues automatiquement, totaux inchangés. Saisies refusées conservées, boutons grisés expliqués au toucher et sélections d’impression détaillées. `docs/passation/2026-11-08-navigation-plateformes.md`. Aucun geste technique.
- **8 nov. · Périodes et garde Orion** : une ancienne plage montre ses dates réelles ; focus rendu à la fermeture du calendrier ; garde ajusté strictement au retour OAuth commun 5.328, avec huit altérations refusées. `docs/passation/2026-11-08-periodes-et-garde-orion.md`. Aucune extension à réinstaller.
- **8 nov. · Mot de passe oublié + e-mails FR/EN** : `/recuperation.html` à l'identité de l'app, accepte toutes les formes de lien Supabase (token_hash, access_token, `?code`, `#error=otp_expired`), « Enregistrer » ⇒ connecté ; lien raté ⇒ renvoi, « coller » seulement là ; 6 modèles fabriqués par `scripts/modeles-email.cjs` (FR, EN si `user_metadata.langue`=en ; code en grand dans Magic Link). `docs/passation/2026-11-08-recuperation-mails.md`. Geste : `docs/supabase-modeles-email.md`.
- **8 nov. · Fermetures involontaires** : une interruption de glissement ne ferme plus la feuille ; Échap de composition ne ferme plus un fil eBay. `docs/passation/2026-11-08-bugs-fermeture-fenetres.md`. Aucune extension à réinstaller.
- **8 nov. (soir) · Extension 5.329 : connexion DANS la carte, sans iframe ni onglet** : e-mail + mot de passe dessinés dans la shadow root fermée du logo (l'iframe de la 5.328 ne s'affichait pas sur Orion ⇒ « Se connecter avec VRM » ouvrait VRM) ; Google/Discord seulement en petite fenêtre (pas sur Orion) ; « déconnecté » = renouvellement lent affiché « expirée », verrou de renouvellement partagé, rangement vérifié. `docs/passation/2026-11-08-connexion-carte-2.md`. Geste : installer la 5.329.
### Ligne déplacée telle quelle de CLAUDE.md §9 (9 nov., Ma journée v2 : taille du dossier)
### Ligne déplacée telle quelle de CLAUDE.md §9 (9 nov., Ma journée v2 : taille du dossier)

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration DA5)
- **9 nov. · /statut automatique** : sondes toutes les 10 min (`ship-reminders?moment=sondes` via GitHub `sondes-statut.yml`, + crons matin/soir) sur base, connexion, e-mails reçus (silence comparé à l'historique), envoi SMTP, notifications, extension ; ligne neutre `statut_sondes` ; 2 ratées de suite ⇒ incident + 1 notification, retour ⇒ fermé avec durée ; page 30 jours, « pas su » gris ; bandeau discret dans l'app. `docs/passation/2026-11-09-statut-auto.md`. Geste : `CRON_SECRET` dans les secrets GitHub.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (soir, Solo par plateforme)
## Déplacé de CLAUDE.md §9 le 9 nov. (soir), tel quel
- **9 nov. · Contrôle quotidien de la prod en navigateur** : 7 h 10 Paris, Chromium iPhone + ordinateur en lecture seule (accueil, /statut, /aide, lien de récupération expiré, mode exemple sans base, /api/sante, zip, manifeste, en-têtes) ; rouge ⇒ rejoué après 5 min, puis UNE issue tenue à jour, fermée au vert ; captures en artefact. `docs/passation/2026-11-09-controle-prod.md`. Geste : facultatif (compte de démo, réglage des e-mails GitHub).

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration transporteurs/Solo)
- **9 nov. · Achats prêts à confirmer + export comptable** : saisie en série « Payé sur Vinted : 85,40 € » (reçu juste) ou « Article seul » — Garder / Corriger / Tout garder (confirmé), seulement par identité, rien écrit sans son clic ; Compta → « Exporter pour mon comptable » (mois/trimestre/année, CSV Excel + PDF 1 page : ventes datées au versement, à dater à part, achats au coût saisi, CA = ligne publiée, URSSAF seulement si micro). `src/exportComptable.js`, `docs/passation/2026-11-09-achats-export.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration journée instantanée)
- **9 nov. · Direction artistique 2 (à valider)** : une grammaire de rangée (vignette 44, N° à largeur fixe, titre 1 ligne, sous-ligne, colonnes fixes, montant à droite) sur Colis, Ventes, Ma journée, Annonces, Achats, Messages ; en-tête unique et barre de recherche pleine. `docs/passation/2026-11-08-direction-artistique-2.md`. Branche `claude/direction-artistique-2`. Geste : regarder les planches.

## Ligne déplacée de CLAUDE.md §9 (9 nov., taille du fichier)

- **9 nov. · Où est ton numéro ? + remise en ligne** : « je l'écris » choisit OÙ (fin de description · titre · référence plateforme, jamais zéro, `vrm_numero_ecrit.ou`) + essai ; extension 5.334 lit la description (dressing, Leboncoin entière ; `numEcrit`) ; annonce supprimée puis nouvelle ⇒ « même paire que N°X ? » (photo = forte, marque+taille+modèle = simple ; SON clic, `poserNumero`) — `src/remiseEnLigne.js`. `docs/passation/2026-11-09-numero-etiquette.md`. Geste : installer la 5.334 ; Vinted pro : capture à faire.
## Lignes déplacées du §9 de CLAUDE.md (9 nov., taille)
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (direction artistique 4, suite)
- **9 nov. · Ma journée v2** : la prochaine chose à faire EN TÊTE (dans la carte sombre, plus redite) ; la frise des 7 jours se TOUCHE (un jour ⇒ son vendu, ventes, versé, colis envoyés, pile des ventes en éventail ⇒ Ventes ; « Semaine du … » remplace la carte Semaine ; par défaut le dernier jour vendu, jamais un « 0 € » géant) ; « Ensuite » pour le reste ; articles supprimés de Vinted en UNE carte (menu par rangée, + « Remise en ligne », « Tous chez moi » confirmé) ; « + N ventes à dater » ; Ventes : transporteur de SON bordereau sur chaque vente, plus de 2e liste « À envoyer » (lien vers Colis). `docs/passation/2026-11-09-journee-v2.md`. Geste : regarder les planches.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (lot F, plancher-stock)

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **9 nov. · Vitesse du démarrage** : Tournée cachée plus calculée, achats des colis indexés, formats de date créés une fois, cache des ventes écrit hors de l'ouverture ; processeur −15 % à l'ouverture, Colis 1er passage 6,0 → 4,1 s ; « Ma journée < 3 s » PAS atteint (prête = montage + plafond 2,5 s, carte/notifs tardives). `docs/passation/2026-11-09-vitesse-demarrage.md`, banc `demarrage-vitesse`. Geste : aucun (décider du plafond).

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
## Déplacé de CLAUDE.md §9 le 9 nov. (taille)
- **9 nov. · Ma configuration (plein écran) + profil fiscal** : au 1er lancement (jamais pour le propriétaire, jamais chez un vendeur qui a déjà choisi ses plateformes), une étape par écran — je vends, plateformes, statut (particulier · micro achat-revente/prestations · société · je ne sais pas = `null`), micro (rythme, VL, ACRE ⇒ taux), TVA société (`vrm_societe_tva`), N° (`vrm_numero_ecrit` actif+`ou`), affichage, notifications ; rien n'est écrasé ; rejouable Réglages → Affichage → Ma configuration. `src/profilFiscal.js` = LA règle par statut (Compta, Ma journée DAC7, Notifications ; taux et seuils services vérifiés). `docs/passation/2026-11-09-configuration-depart.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **9 nov. · Vendre plus / Recherche ⌘K + fiche paire / Achats proposés + export comptable / Inventaire + hors ligne / Tableau du propriétaire / Fiabilité 5.331 / Charge + sauvegarde / Direction artistique 3** : une passation chacun (`docs/passation/2026-11-09-*.md`). Geste : aucun (sauf Vercel Pro vers ~70 vendeurs).

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **9 nov. · RGPD** : « Supprimer mon compte », clients partis (e-mail 11 mois, suppression 12 mois), export de ses données ouvert sans abonnement (sa décision). `docs/passation/2026-11-09-rgpd-compte.md`. Geste : relire la politique.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (fraîcheur unique)
- **9 nov. · Sécurité** : revue (aucune fuite entre vendeurs ; `/api/ai` exige une session) puis liaison Vinted prouvée (029) et carte en iframe hors Orion (5.332). `docs/passation/2026-11-09-securite.md`, `-securite-2.md`. Geste : requêtes SQL de contrôle, 029 avant 023.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (fraîcheur unique)
- **9 nov. · Offres Solo 16,99 € / Pro 19,99 €** : un compte vendeur Vinted en Solo (ventes des autres en aperçu, hors totaux) ; plan lu du prix Stripe ; migration 028. `docs/passation/2026-11-09-plans-solo-pro.md`. Geste : prix Pro Stripe + `STRIPE_PRIX_PRO`, 028.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
## Lignes du §9 de CLAUDE.md déplacées telles quelles le 9 nov. (soir, claude/config-facture, taille)

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **9 nov. · Leboncoin clair (5.335)** : rattrapage après connexion, `X` = `lbc-account:X`, « Mes annonces » relue en entier, « à retirer » seulement si vue en ligne < 24 h, carte en 3 lignes. `docs/passation/2026-11-09-leboncoin-clair.md`. Geste : 5.335 + « Mes annonces » sur chaque compte.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (soir, Colis et Ventes instantanés)

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **9 nov. (soir) · PASSATION GÉNÉRALE** : état, décisions, ce qui reste, gestes de Julien, leçons d'intégration — `docs/passation/2026-11-09-passation-generale.md` (à lire en premier).

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **9 nov. · Ma journée tout de suite + objectif du mois** : à l'ouverture, les derniers chiffres rendus sur CET appareil pour CE compte (≈ 1 s, « Mis à jour il y a N min », inertes, « Vérification… » sur le geste) puis l'écran vrai en place quand tout est relu (CLS 0) ; clé par uid, effacée à la déconnexion, rien de personnel (`src/journeeInstantanee.js`) ; objectif : « encore X € · ≈ Y €/jour d'ici le 30 », barre touchable, Réglages → Affichage. `docs/passation/2026-11-09-journee-instantanee.md`. Geste : aucun.
## Déplacé de CLAUDE.md §9 le 9 nov. 2026 (lot AF), tel quel

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **9 nov. · Direction artistique 5 (à valider)** : colonne de gauche refaite (panneau qui flotte, matière floutée, marque, pastille qui glisse, carte du compte, rail d'icônes 1024–1199 px) + boutons plus soignés + recherche du haut ; `src/styles-nav-v2.css`, banc `nav-v2`. `docs/passation/2026-11-09-direction-artistique-5.md`. Branche `claude/direction-artistique-5`. Geste : regarder les planches.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (fraîcheur unique, intégration)
- **9 nov. · Suites serveur** : l'offre Solo appliquée aussi par les bilans (semaine, mois), le repli e-mails du widget et le rappel des offres mini (`compteEcarteRegle`, recopiée d'App.jsx ; propriétaire = Pro ; pas su ⇒ rien bridé ; colis jamais bridés) ; double vente Leboncoin serveur seulement si vue en ligne < 24 h (`src/enLigneLbc.js`). `docs/passation/2026-11-09-suites-serveur.md`. Geste : aucun (028 pour que l'offre soit lue).

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (fraîcheur unique, intégration)
- **9 nov. · Pastille de l'icône (lot Z)** : l'icône de VRM (écran d'accueil, Dock) porte le nombre de colis à envoyer = le badge de Colis (`vrm_colis_aposter`, frais < 12 h) ; pas su ou 0 ⇒ effacée (`src/pastilleIcone.js`, banc `navigation-tache` Z, rouge par mutation). File des lots : `docs/passation/2026-11-09-file-des-lots.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (transporteurs parfaits)
- **9 nov. · Direction artistique 4** : feuilles et ateliers (Republier) en portail à la forme unique (groupes blancs, croix ronde, pied plein), confirmations à deux gestes égaux, toasts en carte sans rouge, états vides centrés, « pas su » en carte au bouton gris, barre du bas pleine (styles-premium.css §12). `docs/passation/2026-11-09-direction-artistique-4.md`. Geste : regarder les planches.

## Ligne(s) du §9 de CLAUDE.md déplacée(s) telle(s) quelle(s) le 10 nov. (ordre récent, lot AJ)
- **9 nov. (soir) · Transporteurs inconnus + e-mails Vestiaire + SMS** : le transporteur LU sur l'étiquette (PDF du bordereau, sans IA, un seul nom sinon rien ; réception + 6 PDF/jour au cron ; source `pdf`) ; e-mails Vestiaire rappel/annonce/offres ; SMS MRELAY (formes réelles), VintedGo (code = identité), Pickup et VestiaireCo (informations, jamais reliées seules), Chronopost prudent. `docs/passation/2026-11-09-transporteurs-emails.md` (requêtes SQL). Geste : 2ᵉ automatisation « article », copier un SMS Chronopost.
- **9 nov. · Scanner (lot V)** : le scan d'un bordereau MONTRE la paire attendue (identité seule), rien écrit sans « Colis fait » ; au retrait, n° de suivi ou code ⇒ l'achat, « Retiré ». `docs/passation/2026-11-09-scanner.md`. Geste : aucun.

## Ligne(s) du §9 de CLAUDE.md déplacée(s) telle(s) quelle(s) le 10 nov. (À trancher en cartes)
- **9 nov. (soir) · Solo par plateforme (lot E)** : Solo = UN compte vendeur PAR plateforme (Vinted, Leboncoin, eBay, Vestiaire) — **à confirmer par Julien** ; `venteAutreHorsPlan` + `excluAutreDe(v, regle)` (app = bilans serveur), feuille « Quel compte vend sur … ? », 30 j par plateforme, CGV. `docs/passation/2026-11-09-solo-plateformes.md`. Geste : confirmer, migration 030 (après 028).

## Ligne déplacée de CLAUDE.md §9 le 10 nov. (taille, colis propre)
- **9 nov. (soir) · Plancher + « déjà N » (lot F)** : sous chaque offre Vinted « En dessous de 103 € tu perds de l'argent » (prix d'achat SAISI + frais connus, règle `beneficePaire` ; pas de prix d'achat ⇒ porte de saisie ; sous ⇒ ambre ; mini sous le plancher dit, jamais changé ; Vestiaire : rien, commission pas lue) ; « Tu as déjà N paires de ce modèle en stock » à la saisie d'un achat (ressemblance, rien écrit). `docs/passation/2026-11-09-plancher-stock.md`. Geste : aucun.
- **9 nov. · Zéro banc rouge** : ~20 bancs remis au vert (périmés à la règle actuelle, fragiles rendus déterministes, aucun contrôle retiré) ; vrais défauts : note « adresse reliée à aucun compte » + son geste cachée sur Colis, limite d'envoi invisible au téléphone, filtre des sites qui sautait, « Préparer sur » un site masqué, paire partie « pas rangée ». `docs/passation/2026-11-09-zero-banc-rouge.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (taille, lots BA/BF)
- **9 nov. (soir) · DA4 suite** : focus piégé et rendu dans les feuilles, feuille refusée qui remonte (`bloque`), saisie gardée à la fermeture, confirmation `irreversible` en ambre (Leboncoin/eBay supprimer), messages au-dessus du clavier à durée lisible, zone `aria-live` toujours montée, Messages vide dessiné. `docs/passation/2026-11-09-direction-artistique-4.md` (Suite). Geste : aucun.

## Ligne(s) du §9 de CLAUDE.md déplacée(s) telle(s) quelle(s) le 10 nov. (Litiges en cours)
- **9 nov. (soir) · Direction artistique 6 « Widgets » (à valider)** : les cases de la carte sombre sortent en widgets blancs (bento ; Ma journée au téléphone : 3 sur une ligne, règle du 27 oct.), groupes rayon 24 + chevrons (plus de « Voir » gris), pilules, ronds, titres 34/800 ; `src/styles-widgets-ios.css`, banc `direction-artistique-6`, planches `docs/passation/planches-da6/`. `docs/passation/2026-11-09-direction-artistique-6.md`. Geste : regarder les planches.
## Ligne déplacée de CLAUDE.md §9 (10 nov., taille du dossier)
- **9 nov. · Lot B : « Annuler » 5 s + ⌘K qui agit** : gestes réversibles dans VRM (masquer un achat, marquer vendue, délier LBC/gros, relier un achat…) sans confirmation, pilule « Annuler » ; l'extérieur garde sa confirmation ; ⌘K propose des actions qui OUVRENT seulement. `docs/passation/2026-11-09-annuler-commandes.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **9 nov. · Retraits frais** : plus de « peut-être en double » — un témoin = un carton (compté avec, fini avec, ou à retirer) ; carte = ce que l'onglet compte ; statut relu /15 min (`?moment=colis`). `docs/passation/2026-11-09-retraits-frais.md`. Geste : `CRON_SECRET` GitHub.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (lot AQ, taille du dossier)
## Ligne déplacée de CLAUDE.md §9 le 10 nov. (taille, Ma semaine)
- **9 nov. · À trancher (lot AC)** : un écran (Gérer, badge) + une ligne dans Ma journée ; 13 sources publiées par leur écran (`vrm_a_trancher`, local), un geste qui ouvre ; pas su = « — ». `docs/passation/2026-11-09-a-trancher.md`. Geste : décider des ventes à dater.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **9 nov. · Préparer mes colis + mode relais (lot AD)** : Colis → À envoyer pas à pas (ordre de la liste, paire par n° de transaction, « Colis fait » = `deposeScan`, reprise) ; mode relais = `vrm_colis_retirer` exactement, code géant fond blanc, Wake Lock, « Retiré » + Annuler, hors ligne. `docs/passation/2026-11-09-preparer-relais.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **9 nov. · Hors ligne à froid + « déjà relié »** : sans réseau, VRM s'ouvre en LECTURE SEULE si CE compte et CETTE session ont été vérifiés sur l'appareil il y a < 7 j (`vrm_porte_ok_{uid}`, garde : aucune requête base/`/api/`, aucun message à l'extension ; refus serveur au retour ⇒ refermé, drapeau effacé ; sans abonnement ⇒ aperçu) ; le refus `vrm_vinted_litige_*` dit dans Comptes liés et Ma journée (pseudo, geste, jamais l'autre compte). `docs/passation/2026-11-09-hors-ligne-relie.md` (modèle de menace). Geste : aucun.

## Ligne §9 de CLAUDE.md déplacée telle quelle (10 nov., retraits irréprochables)
- **9 nov. · Lot AF : même annonce sur deux comptes + histoire du N°** : alerte ambre dans Annonces (compte, prix, depuis quand ; photo exacte, rien supprimé) ; fiche paire « L'histoire du N° » en lecture seule + journal append-only `vrm_numeros_journal`. `docs/passation/2026-11-09-doublons-historique.md`. Geste : aucun.

## Déplacé de CLAUDE.md §9 le 10 nov. (taille du fichier), tel quel

## Ligne(s) du §9 de CLAUDE.md déplacée(s) telle(s) quelle(s) le 10 nov. (lot AI, textes courts, taille)
- **9 nov. (soir) · Colis et Ventes tout de suite (lot AE)** : comme Ma journée, en ≈ 1,5–2 s les derniers chiffres et listes rendus sur CET appareil pour CE compte, « Mis à jour il y a N min », inertes (« Vérification… »), puis l'écran vrai en place (CLS ≈ 0) ; UNE règle d'instantané pour les trois écrans (`src/instantaneEcran.js`), rien de personnel rangé (liste blanche). `docs/passation/2026-11-09-colis-ventes-instantanes.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (lot AO, taille du dossier)
- **9 nov. (soir) · Ma facture + Ma configuration** : SIRET ⇒ « Recherche de l'entreprise… » puis « Vérifie ces informations » (rien écrit sans « C'est bon », écart montré ; TVA seulement si le registre la porte ; RCS jamais inventé), même carte à l'étape statut ; « Qu'est-ce que tu vends ? » en 18 tuiles (`vrm_je_vends.categories`, « paire » si sneakers seules) ; numéro de rangement sans « carton » ; affichage clair. `docs/passation/2026-11-09-config-facture.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **9 nov. (soir) · Fraîcheur unique (lot AG)** : UNE ligne en haut de l'app — « Tout est à jour · vérifié il y a N min » seulement si comptes, achats, extension, suivi transporteur et e-mails sont frais, sinon la source en retard nommée avec son geste (la plus grave d'abord, « + N autres ») ; hors ligne/base KO/pas su ⇒ jamais « à jour » ; seuils des propriétaires (`src/fraicheur.js`) ; puce « Relire » de Colis, tête Vinted de Ventes, ligne d'Achats et ligne ambre de capture fondues. `docs/passation/2026-11-09-fraicheur-unique.md`. Geste : aucun.

## Ligne(s) du §9 de CLAUDE.md déplacée(s) telle(s) quelle(s) le 10 nov. (taille, lot AN)
- **10 nov. · Transporteurs parfaits (lot AK)** : TOUTES les étiquettes lues (cron du matin borné en temps, passage de 15 min sur `pdfReste`, app ouverte `POST /api/relais?mode=etiquettes`, l'étiquette imprimée lue dans le navigateur) ; inconnus COMPTÉS avec leur raison ; MARQUES maison (SVG, aucune image ni requête, pas de licence officielle) à la place des noms ; carte : aucun géocodage sans code postal, marque sur l'épingle ; « inconnu » et jamais répondu relus /15 min. `docs/passation/2026-11-09-transporteurs-parfaits.md`. Geste : `CRON_SECRET` GitHub.
- **9 nov. (soir) · Le plus récent en haut, partout (lot AJ)** : ventes, achats, colis (à envoyer, envoyés, à retirer), Préparer : date décroissante, TOUS comptes mélangés, sans date en bas et dit — UNE règle `src/ordreRecent.js` ; ⚠️ remplace le tri par urgence d'« À envoyer »/Préparer (limite sur chaque carte, transporteur en pastilles) ; à retirer : un point = une carte, rangés par arrivée lue. `docs/passation/2026-11-09-ordre-recent.md`. Geste : aucun.
- **9 nov. (soir) · Navigation fusionnée (lot AL)** : « Republier » et « Favoris & offres » quittent la colonne, la barre et « Plus » (« Vendre » vide disparaît de la colonne) ; « Favoris & offres » = section de Messages, « Republier » = vue d'Annonces (cocher, « Republier · N » ⇒ l'atelier) ; anciens liens redirigés (`VUES_DEPLACEES`). `docs/passation/2026-11-09-navigation-fusion.md`. Geste : regarder.

## Ligne déplacée de CLAUDE.md §9 (10 nov., session « dépôt hors ligne »)
- **10 nov. · À trancher en cartes** : une carte par doute (photo de l'annonce par identité, N°, question ≤ 12 mots, gros boutons), groupes par type ; « Oui, chez moi » (supprimé de Vinted) annulable 5 s, le reste OUVRE ; ventes à dater ⇒ « Les dater » ; Ma journée idem. `docs/passation/2026-11-10-a-trancher-cartes.md`. Geste : regarder.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (baisse de prix en série, taille du dossier)
- **10 nov. · Colis propre + vrais logos + « Point relais changé »** : logos SVG (Mondial Relay tracé, UPS/DPD/DHL/FedEx/Vinted `simple-icons` CC0, mots-symboles pour Chronopost & co, `DESSINS_TRANSPORTEURS`) ; « inconnu » plus écrit en gros (« Transporteur à identifier ») ; Colis sans ligne « prochain geste » ni bandeaux e-mails (marque « sans e-mail » sur la carte) ; « Votre colis a changé de plan » = EN ROUTE (sujet d'abord, `changementDeRelais`, lignes rangées relues), alerte ambre + nouveau point LU + Itinéraire ; SMS de colis dans « Mes e-mails », en 6 étapes courtes. `docs/passation/2026-11-10-colis-propre-logos.md`. Geste : regarder les logos Chronopost & co.

## Ligne(s) du §9 de CLAUDE.md déplacée(s) telle(s) quelle(s) le 10 nov. (textes courts suite, taille du dossier)
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (factures Pro lot Q, taille du dossier)
- **10 nov. · Coût d'une vente + valeur du stock (BA, BF)** : récap d'une vente = barre vente − achat − frais − emballage = bénéfice (`beneficePaire` décomposée, `src/coutVente.js`) ; frais `emballage` dans `champsCharges`, vide = « non saisi » (porte ambre) ; valeur = Σ achats SAISIS des `annoncesPresentes` « au moins · sur N · K sans prix », publiée `vrm_valeur_stock` (Annonces), lue par Stock et Statistiques ; `stockValue` retiré. `docs/passation/2026-11-10-cout-vente-valeur-stock.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Vérification au scan + photo du carton (lot AZ + M)** : au bordereau, la photo de la paire et son N° en très grand (plein écran au téléphone, identité du lot V) ; après « Colis fait », « Photo du carton » facultative, rangée avec la vente (`colis_photo_v_{tx}`, SA ligne, lue au toucher ; `photoCartonDe(tx)` pour Litiges), visible sur la fiche de la vente. `docs/passation/2026-11-10-photo-colis-scan.md`. Geste : aucun.
- **10 nov. · Litiges en cours + Retours par modèle (BB, BI)** : écran `?tab=litiges` (entrée dans Ventes, groupe « Ventes » d'À trancher) — une carte par vente en litige/retour (photo, N° par identité, « Avant le … » LU sinon « Date limite non lue », preuves par transaction : photo · suivi + statut transporteur · bordereau · carton « bientôt » (lot AZ), un LIEN vers le site) ; Leboncoin/Vestiaire « ne se lit pas encore » (forme jamais vue) ; par modèle « 2 sur 15 » (retour = 440, remboursement seul ≠ retour, « au moins ») ; règle `src/litigesEcran.js`. `docs/passation/2026-11-10-litiges-retours.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (lots BJ, BM, BN, taille du dossier)
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (mois bouclé, taille du dossier)
- **10 nov. · « Ma semaine » (lot BC)** : un écran (`?tab=semaine&lundi=…`, notification du dimanche soir, Ma journée, Statistiques) : vendu + barre par jour, ventes, bénéfice brut, reçu, colis envoyés, qui dorment, flèche neutre vs la semaine d'avant AU MÊME MOMENT (aucune si « au moins » ou « — ») ; bornes et « qui dorment » = ceux du bilan (`api/_lib/bilan-semaine.js`), chiffres = `journalSemaine` (`src/maSemaine.js`). `docs/passation/2026-11-10-ma-semaine.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Mon adresse VRM (lot AQ, demande 6)** : Paramètres → Mes e-mails → « Mon adresse VRM » (juste avant SMS de colis) ouvre la feuille : le serveur crée SON adresse au 1er toucher, transfert pas à pas (7 messageries), e-mail d'essai « Reçu ✓ » par code ; Worker Cloudflare à coller, sans nouvelle fonction `api/`. `docs/passation/2026-11-10-emails-transfert.md`. Geste : `docs/emails-transfert-mise-en-service.md` (domaine, Worker, `DOMAINE_RECEPTION`).

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Colis à réceptionner irréprochables** : 97 colis croisés sur la vraie base (e-mails, transporteur, suivi et commandes Vinted, conversations ; 0 SMS) ; un faux « retiré » (changé de plan, perdu) ne retient plus l'arrivée (`retraitTenu`), colis redirigé relu chez le transporteur et gardant son nouveau point, carte : sources + « vérifié à », code « sûr » à deux voix, deux codes ⇒ ambre sans choix (`src/sourcesRetrait.js`, aussi mode relais). `docs/passation/2026-11-10-retraits-irreprochables.md`. Geste : `CRON_SECRET`, relier l'adresse des 17 moitiés sans compte.

## Ligne(s) du §9 de CLAUDE.md déplacée(s) telle(s) quelle(s) le 10 nov. (corbeille lot Y, taille du dossier)
- **10 nov. · Textes courts (lot AI)** : plus de murs de texte — états en pastilles d'une ligne, phrase ≤ 12 mots, détail sous « Pourquoi ? » (`src/composants/InfoPop.jsx`), « Même paire ? » en carte à deux photos [Oui] [Non], un seul « Tout imprimer », carte du compte ⇒ Paramètres, avatar au lieu du point. `docs/passation/2026-11-09-popups-propre.md`. Geste : regarder les planches.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Argent = Compta + Statistiques (lot AO)** : UNE entrée « Argent », quatre segments (Résumé · Statistiques · Déclarer · Factures) ; en tête du Résumé vendu · reçu · bénéfice · à déclarer, chiffres de leurs propriétaires (`valeurChiffre`, `previsionUrssaf`, `profilFiscal`), toucher = le détail ; « Documents et réglages » rangé dans Déclarer ; anciens liens (`dashboard`, `stats`, `invoices`, `argent_declarer`) redirigés ; règle `src/argent.js`, chiffres avant = après (banc `argent`). `docs/passation/2026-11-10-compta-stats.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (lot BO, taille du dossier)

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Note privée d'une paire + achat saisi deux fois (lots BD, BH)** : note ≤ 200 car. rangée par IDENTITÉ (`n:<N°>`, sinon `a:<annonce>` ; N° sur deux paires ⇒ cachée), visible Annonces/fiche/Ventes/Préparer/scan/Stock, clé `vrm_notes_paires` (main), jamais envoyée ; doublon d'achat par n° de transaction/commande/facture SEULEMENT (champ « N° de commande ou de facture »), « Garder celle-ci » masque l'autre (annulable, `vrm_achats_hors_masques`, hors des totaux), source À trancher. `docs/passation/2026-11-10-note-achat-double.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Frise d'une vente + D'où viennent mes achats (BE, BG)** : récap d'une vente Vinted = frise Vendue → Bordereau → Déposée → En route → Livrée → Finalisée → Versée, chaque étape par SA preuve (bordereau par transaction, règle du départ, transporteur/e-mails du n° de SON bordereau, 450, date de versement), JAMAIS déduite (« pas lu » gris), ambre = son geste, litige/retour/annulation en bifurcation (`src/friseProuvee.js`) ; Statistiques : bénéfice moyen par source (achat Vinted relié, fournisseur, « Où » d'un achat hors plateforme par SON N°, + « Magasin »), publié par Ventes `vrm_sources_ventes` (`src/sourceAchats.js`). `docs/passation/2026-11-10-frise-source.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (recherche universelle lot AX, taille du dossier)

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Lot AN : photo en grand + Achats DA6 + facture jointe** : toucher une vignette d'article ⇒ LA visionneuse (`src/Visionneuse.jsx`, la seule : la photo du carton du lot AZ y est fondue ; galerie par fichier, zoom, retour) ; rangées d'Achats DA6 (`src/styles-achats-photos.css`) ; facture PDF/photo jointe à un achat dans SA ligne `achat_facture_*` (RLS 021, aucune migration). `docs/passation/2026-11-10-photos-achats.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (lot N)

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Baisse de prix en série + Qui dorment (lots C + AW, extension 5.336)** : cases dans Annonces → À relancer · Qui dorment (et « Baisser le prix… » dans Sélectionner) ⇒ feuille −X € / −X %, arrondi à l'euro, ancien → nouveau, plancher du lot F (sous ⇒ ambre, décochée), autre compte que l'onglet ⇒ « Ouvre … sur Vinted », jamais envoyée ; « Baisser N prix » → confirmer → UNE commande `baisserPrixVinted` à la fois (garde, 45/h, pause, frein), seul le prix RELU s'affiche, Arrêter ; le nombre « qui dorment » publié = `articlesQuiDorment`. `docs/passation/2026-11-10-baisse-prix-serie.md`. Geste : installer 5.336.0.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (lot T)
- **10 nov. · « Je dépose » + hors ligne au relais (lots AU, AY)** : Colis → À envoyer → « Je dépose » : les colis de la liste par transporteur, scan du bordereau ⇒ « Colis fait » (5 s), hors liste ⇒ rien, « Tout est déposé » ; hors ligne : la photo de Ma journée (suivi, transporteur, verdict des codes) datée « vue à », « Déposé » en file d'envoi. `docs/passation/2026-11-10-depot-hors-ligne.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Factures Pro, lot Q** : Argent → Factures « À envoyer » (prouvées ⇒ « Tout envoyer » confirmé ; sinon la raison ; vente annulée ⇒ avoir proposé), registre d'une période (trous dits) + zip PDF/CSV ; envoi auto ÉTEINT par défaut (`envoiAuto` + date, son geste ; `?moment=factures` /30 min, pause dite). `docs/passation/2026-11-10-factures-pro-2.md`. Geste : `RELANCES_SMTP_*`, `CRON_SECRET`.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (factures Pro lot S, taille du dossier)

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (Annonces en grille lot AM, taille du dossier)
- **10 nov. · Textes courts, suite (lot AI)** : Réglages (hors « Sécurité des données »), eBay, Leboncoin, Vestiaire, Messages, Achats, Ventes et ~90 textes d'App.jsx réécrits en une phrase courte + son geste (≈ 270 textes > 90 car. en moins), sens gardé ; banc `popups-propre` étendu (239/0). `docs/passation/2026-11-10-textes-courts-suite.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Résumé du soir (lot AT)** : le rappel de la veille au soir (même cron, catégorie `soir`, UNE notification) ne dit plus que demain — colis à limite LUE demain (+ en retard, estimées passées), retraits au dernier jour lu demain, offres Vestiaire qui expirent ; rien demain ⇒ rien ne sonne ; lien vers le premier geste (`api/_lib/resume-soir.js`). `docs/passation/2026-11-10-resume-soir.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Revendu combien ? (lot AV)** : à la saisie d'un achat et dans ⋯ d'un achat Vinted, SES ventes finalisées du même modèle (`modeleSur`, ressemblance d'affichage) : prix médian, bénéfice médian (`beneficePaire`, « sur K des N »), délai, < 3 ⇒ « pas assez » ; le passé, jamais un conseil (`src/reventeModele.js`). `docs/passation/2026-11-10-revente-modele.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (lot L)

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Mois bouclé + Comparer deux mois (lots BK, BL)** : Argent → Déclarer → « Mois bouclé » : à dater, prix d'achat, comptes pas relus (ligne de fraîcheur PUBLIÉE), frais inconnus, chacun avec sa porte ; « prêt » + montant (`montantPeriodeUrssaf` du mois) seulement si tout est lu et complet (`src/moisBoucle.js`) ; Statistiques → Comparer : deux sélecteurs, vendu · reçu · bénéfice · ventes · achats (registre), flèche grise, aucune sur « au moins »/« — ». `docs/passation/2026-11-10-mois-boucle.md`. Geste : aucun.
## Déplacé de CLAUDE.md §9 le 10 nov. (lot AB, taille)
- **10 nov. · Dossier de litige PDF, vitesse d'envoi, avis (BJ, BM, BN)** : carte de Litiges → « Dossier PDF » fait DANS le navigateur (pdf-lib : N°, titre, compte, transaction, photos annonce + carton, n° de suivi, étapes PROUVÉES ; rien de l'acheteur ; page du bordereau seulement s'il coche) ; Statistiques + Ma semaine : « Vitesse d'envoi » vente → dépôt PROUVÉ (`partisVinted`), médiane par compte sur 30 j, « sur N colis », sans date nommés (`vrm_vitesse_envoi`) ; avis : forme mesurée SANS date désormais lue (20/compte, ordre de la page, évolution 10 vs 10, 5 derniers). `docs/passation/2026-11-10-litige-pdf-vitesse-avis.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Inventaire de fin d'année (lot W)** : Stock → « Inventaire de fin d'année » : paires de `annoncesPresentes` au prix SAISI, total = `valeurStock` (« au moins … sur N »), date choisie dite, « Je vérifie » = l'inventaire (+ caméra du lot V), écarts par N° seul, PDF/CSV ; rien changé. `docs/passation/2026-11-10-inventaire-annuel.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Recherche universelle (lot AX)** : la loupe / ⌘K met une correspondance EXACTE d'identité (N° `cleNum`, suivi normalisé, code, transaction, commande, facture — jamais titre, pseudo ni montant) EN TÊTE avec « Trouvé par son … », sortie de son groupe ; groupes Paires · Ventes · Achats · Colis · Retraits ; source pas lue DITE (« Achats pas encore lus » / « pas lus — la lecture n’a pas répondu », plus de `[]`) ; tout en mémoire. `docs/passation/2026-11-10-recherche-universelle.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (lot I)

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Siri / Raccourcis (lot AH)** : deux liens profonds que l'app Raccourcis ouvre — `?tab=achats&achat=1[&titre&prix&ou]` ouvre « Nouvel achat » pré-rempli (rien d'écrit sans son clic, prix illisible ⇒ vide) et `?tab=journee&q=` la loupe sur ce N° (dictée par `requeteDeLaVoix`) ; adresse effacée après lecture ; aide Paramètres → « Siri et Raccourcis » (`src/raccourcisSiri.js`). `docs/passation/2026-11-10-siri-raccourcis.md`. Geste : aucun.

### Lignes déplacées de CLAUDE.md §9 (10 nov., lot AR)
- **10 nov. · Textes courts, 3e série** : Argent (Super PDP, Factur-X, CFE, suivi des déclarations, rapport URSSAF), Colis/Achats/Messages de `Comptabilite`, Republier, Ma facture, Statistiques, Stock, page d'accueil : une phrase courte + le geste, détail sous « Pourquoi ? », sens et chiffres gardés ; banc `popups-propre` + Argent. `docs/passation/2026-11-10-textes-courts-3.md`. Geste : aucun.

- **10 nov. (20 h) · Pro illimité** : Pro 19,99 € = tous les comptes vendeurs, sans limite (sa décision, annule les « 10 comptes » du lot BO, défait : règle, route `pro` refusée 409, feuille, rangée, textes ; 031 supprimée, jamais appliquée) ; Solo inchangé ; CGV 10 nov. `docs/passation/2026-11-10-pro-illimite.md`. Geste : relire les CGV.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (intégration)
- **10 nov. · Livre de police (lot R)** : Argent → Déclarer, statut pro seulement ; n° d'ordre append-only sur SON clic (`vrm_livre_police`, CAS), lignes = registre des achats, pseudo Vinted côté acheteur, identité « à compléter », PDF/CSV, jamais « conforme » (`src/livrePolice.js`, sources citées). `docs/passation/2026-11-10-livre-police.md`. Geste : relire R321-3.

## Lignes du §9 de CLAUDE.md déplacées telles quelles le 10 nov. (lot H)
- **10 nov. · Corbeille 30 jours (lot Y)** : supprimer DANS VRM (achat hors plateforme, dépense/coût/pack/abonnement, modèle, réponse rapide, fiche à publier, note, fournisseur, achat en gros) ⇒ pilule « Mis à la corbeille · Annuler » 5 s, plus de « Tu es sûr ? » (fournisseur : confirmation gardée), puis Paramètres → Corbeille « Restaurer » 30 j ; UNE règle `src/corbeille.js` (`vrm_corbeille` dans `main`, morceaux conditionnels : ce qui a changé depuis est gardé, N° pris ⇒ refus, photo/ticket vidés à la purge seulement si pas revenus) ; sites, N°, factures : jamais. `docs/passation/2026-11-10-corbeille.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Atelier dans Organisation (lot N)** : Organisation s'ouvre sur « Atelier » — une colonne par étape (Reçue → Nettoyée → Photographiée → Mise en ligne, modifiables), une carte par IDENTITÉ (`a:`n° de transaction, `n:`N°), « → étape » / ⋯ / glisser, nombre par étape ; commandes `atelier.*` dans `vrm_operations_v1` (bornes du membre inchangées, il ne lit pas l'atelier) ; Ma journée : ligne ambre si > 7 j hors dernière étape. `docs/passation/2026-11-10-atelier-organisation.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Factures Pro Leboncoin et eBay (lot S)** : détail d'une vente d'un vendeur Pro (SIRET) ⇒ « Faire la facture » : prix et date LUS de CETTE vente (n° de transaction / commande, relue par le serveur), acheteur RECOPIÉ par lui (la plateforme ne le donne pas ; eBay : proposé depuis la commande), même suite de numéros que Vinted, registre d'Argent → Factures ; PDF, aucun e-mail ; Vestiaire : refus dit (seul le versé est relevé), eBay hors euros/plusieurs articles refusé (`src/facturePro/sources.js`, `/api/compte?mode=facture-autre`). `docs/passation/2026-11-10-factures-autres.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (lot adresse-vrm-simple)
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (lot P)
- **10 nov. · Facture en anglais + seuil de TVA (lot T)** : case « Facture en anglais » par facture (pré-cochée si l'adresse prouvée est hors de France) ⇒ facture BILINGUE, le français mot pour mot (loi Toubon art. 2), traduction figée dans l'instantané, toujours en euros (`src/facturePro/anglais.js`) ; Argent → Factures : jauge du CA de l'année (`jaugeSeuils`), alerte ambre à 80 % puis au dépassement si sans TVA, porte « Mon régime de TVA » (`src/seuilTvaFacture.js`). `docs/passation/2026-11-10-facture-en-tva.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Calculette d'achat + historique de prix + emballages (lot L)** : Achats/⌘K « Calculette » (achat X €, revente Y €, site ⇒ bénéfice net par `cascadeVente`, frais LUS : Vinted/Leboncoin 0, eBay part lue sur SES commandes « environ », Vestiaire « au plus » ; rien écrit, aucun prix conseillé) ; fiche paire : prix LUS dans le dressing datés par leur lecture (`vrm_prix_lus`) + escalier ; Stock : emballages (reste = compté − « Colis fait » datés après, ambre au seuil, coût dans une vente sur SON clic seulement). `docs/passation/2026-11-10-calculette-emballages.md`. Geste : noter ses emballages au Stock.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 10 nov. (textes courts 4)

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Annonces en grille, par compte (lot AM, demande 15)** : « Toutes » = vignettes comme le dressing Vinted (photo carrée, N°, titre 2 lignes, prix, état · vues · favoris · jours ; « En double », « À confirmer », « Boostée » sur la photo), un en-tête par compte (initiale), 2 colonnes à 390 / 4–6 à 1512, ordre et règle « en ligne » inchangés (`src/annoncesGrille.js`) ; toucher = la fiche entière EN PLACE pleine largeur, en rangées (rien retiré), photo ⇒ visionneuse ; « Même paire ? » sur SA vignette. `docs/passation/2026-11-10-annonces-grille.md`. Geste : regarder Annonces au téléphone.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Marge par plateforme (lot I)** : Argent → Statistiques, une barre par site (Vinted, Leboncoin, eBay, Vestiaire) : ventes et vendu (`venduLignes`, « au moins » si un argent pas lu, nommé), bénéfice par paire médian + total du relevé de Ventes (vente − achat − frais ; eBay = `montantRecuEbay`), couverture « sur N · prix d’achat manquant pour M », jamais « au moins » ; site pas lu ⇒ « — » + raison (`src/margePlateforme.js`). `docs/passation/2026-11-10-marge-plateforme.md`. Geste : aucun.

## Déplacé de CLAUDE.md §9 (10 nov., lot O)

- **10 nov. · Un seul fil par acheteur et par paire (lot AB)** : Messages → « Tous » : conversations Vinted, Leboncoin, Vestiaire regroupées seulement par identité (même interlocuteur de la plateforme + annonce/transaction/N° commun), marque de plateforme sur chaque message, « Répondre » ouvre la conversation du dernier message dans SON fil (règles d'envoi inchangées) ; sans identité commune VRM DEMANDE (« même paire ? », « même acheteur ? »), son clic relie (`vrm_fils_relies`), « délier » défait ; eBay non gardé, dit ; défaut de Messages toujours Vinted (`src/filUnique.js`). `docs/passation/2026-11-10-fil-unique.md`. Geste : aucun.
- **10 nov. · Annonces à compléter + avis par vente (lot U)** : Annonces → vue « À compléter » : annonces en ligne dont un manque est LU (< 5 photos, marque/taille/état vides, N° pas à la fin de la description si « je numérote moi-même », pas de prix d'achat), pastille ambre + « Modifier ↗ » (page Vinted) ou « Prix d'achat » ; pas lu ⇒ dit, jamais un manque (`src/annoncesACompleter.js`) ; récap d'une vente : « Avis reçu » relié par n° de transaction SEULEMENT — forme mesurée {id, rating, feedback} sans transaction ⇒ « pas relié », rien deviné (`src/avisVente.js`). `docs/passation/2026-11-10-annonces-avis.md`. Geste : aucun.

## Déplacé de CLAUDE.md §9 (11 nov., lot AA)

- **10 nov. · Communauté pour formateurs (lot AR, demande 7)** : sur les groupes de la 025 — page publique `vrm.center/f/<adresse>` (éteinte par défaut, groupes montrés sur SON geste, jamais un chiffre d'élève), « Demander à rejoindre » = la demande 025 (« rien »), programme d'étapes (coches vues SEULEMENT avec l'accord de l'élève), annonces, suivi « au moins … · X sur Y partagent » (`src/communaute/formateur.js`, `api/_lib/formateur.js`). `docs/passation/2026-11-10-communaute-formateurs.md`. Geste : migration **032** (essai en tête).

## Déplacé de CLAUDE.md §9 (11 nov., lot K)

- **10 nov. · Import tableur, partage de photo, aide par écran (lot J)** : Achats → « Nouvel achat » → « Importer un tableur » (CSV/.xlsx lus dans le navigateur sans dépendance, aperçu ligne à ligne, doublons par RÉFÉRENCE seulement, prix du fichier, N° par `numeroExterne`, coût posé seulement sur une fiche sans prix, rien écrit sans « Importer N achats ») ; VRM cible de partage (`share_target`, `public/sw.js` ⇒ « Nouvel achat » avec la photo ; pas sur iPhone/Safari) ; le « ? » ouvre 3–5 gestes (`scripts/aide-contenu.cjs` ⇒ `src/aideEtapes.js`). `docs/passation/2026-11-10-import-partage-aide.md`. Geste : aucun.

## Déplacé de CLAUDE.md §9 (11 nov., extension 5.340)

- **10 nov. · Échéances dans l'agenda + alerte « nouvel appareil » (lot H)** : Paramètres → Notifications → « Ajouter à mon agenda » = lien webcal secret (`vrm_agenda` + index, régénérable/coupable, `/agenda/<jeton>.ics` → `?mode=agenda`) : URSSAF (micro, non déclarée), dépôts LUS (`vrm_agenda_envoi` publié par Ma journée), retraits LUS ; rien de personnel (`api/_lib/agenda-ics.js`) ; à chaque ouverture `?mode=appareils {verifier}` relit ses sessions (024), signature jamais vue ⇒ push « Nouvel appareil : Chrome sur Mac. Ce n'est pas toi ? » ⇒ Appareils connectés, CETTE session en ambre (`api/_lib/appareil-nouveau.js`). `docs/passation/2026-11-10-ics-appareil.md`. Geste : aucun.

## Déplacé de CLAUDE.md §9 (11 nov., textes courts 5)
- **10 nov. · Republier à la main, conseillé (lot AP, demande 17)** : Annonces → Republier : carte « À la main : conseillé, le moins risqué », « À la main · N » principal, « Par VRM · N » second ; kit de plusieurs annonces (N° et description TELLE QU'ELLE PARTIRA à copier, une à une ou « Tout copier », photos réglées vers la galerie par le menu de partage, « Pas à pas », « Ouvrir Vinted » note le suivi : le N° suit par SON clic) ; une photo seule s'enregistre aussi (`src/republierKit.js`, `usePhotosReglees`) ; rien n'est envoyé à Vinted. `docs/passation/2026-11-10-republier-main.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Jauge du plafond + journal de l'extension (lot G, ext. 5.337)** : jauge « 12/50 cette heure · repart à 21 h 40 » (somme de tous les Chrome, « — » si rien publié, ambre à 45) dans Baisser le prix, Republier, Favoris, Offres auto et en tête de Paramètres → « Ce que VRM a fait » (`src/jaugeActions.js`) ; l'extension note offres, réponses, baisses, modifications dans `journal_vrm_*`, lues par `lireJournal` (preuve, sans doublon avec le téléphone). `docs/passation/2026-11-10-jauge-journal.md`. Geste : installer la 5.337.0.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. · Textes courts, 4e série** : Favoris (« Aucune garantie contre un blocage Vinted » et le rythme restent À L'ÉCRAN, le reste sous « Pourquoi ? »), Organisation, Communauté, Accompagnement, fil eBay, inventaire, studio, configuration, connexion et installation de l'extension : une phrase + `src/composants/PourquoiReplie.jsx` ; audit `textes-courts` (relevé statique), banc `popups-propre` + favoris/organisation/communauté. `docs/passation/2026-11-10-textes-courts-4.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (lot DJ3, taille)
- **10 nov. · Clavier + lecteur d'écran (lot P)** : ordinateur : « g » + lettre (j a v c m h s r t e p) ⇒ l'écran, « n » ⇒ Nouvel achat VIDE, « ? » ⇒ la liste (feuille, focus gardé), aussi Paramètres → « Raccourcis clavier » ; jamais dans un champ, ni sous une feuille, ni ⌘/Ctrl/Alt ; seulement naviguer/ouvrir (`src/raccourcisClavier.js`, `vrm:aller`). VoiceOver : bouton icône seule nommé à la racine (`BoutonBase`/`Segmente`/`Btn`), widgets lus « libellé : valeur » (« pas su » pour —), « Détails et gestes » dit sa paire. `docs/passation/2026-11-10-clavier-voiceover.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (lot retraits-fiables, taille)
## Déplacé de CLAUDE.md §9 (11 nov., lot DJ8)

- **11 nov. · Infos sur vinted.fr (lot AA, ext. 5.339)** : sous SES annonces « N°124 · acheté 60 € · en ligne depuis 23 j » (identifiant d'annonce, compte de l'onglet, pas su ⇒ rien) ; sur l'annonce d'un autre vendeur, encart « VRM » replié : calculette (règle de l'app) + « peut-être N paires proches » (lot F) ; lecture seule, aucune requête Vinted. `docs/passation/2026-11-10-extension-infos.md`. Geste : installer 5.339.0.

- **10 nov. · Mode vacances tous comptes (lot O, ext. 5.338)** : Paramètres → Mes comptes → « Mode vacances » : état LU par compte (`is_on_holiday` du profil, mesuré ; « — » pas su), « Tout mettre en vacances » / « Tout rouvrir » = UN compte par clic, celui de l'onglet ; le geste de Vinted jamais vu ⇒ appris sur SON geste (`noteVacances` → `vinted_vacances_recette`, `/users/{current|son n°}` seulement), relu après ; Leboncoin/eBay/Vestiaire « À faire sur le site ». `docs/passation/2026-11-10-mode-vacances.md`. Geste : installer 5.338.0, puis poser et retirer une fois le mode vacances à la main sur vinted.fr.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (lot DJ1)
## Déplacé de CLAUDE.md §9 (11 nov., extension 5.341)

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 9 nov. (intégration)
- **10 nov. (soir) · « Ton adresse VRM » en UN parcours** : en tête d'E-mails → Relier ma boîte (Paramètres → Mon adresse VRM : la même pièce en feuille) — barre 1·2·3·✓ avec reprise, adresse en grand, compte en puces, messagerie détectée par le domaine (une tuile, 3 pas, bouton vers la bonne page), relais Apple = liste des boîtes reliées, code Gmail affiché seul + « Confirmer dans Gmail » (son clic), essai « Reçu ✓ » ; plus de roue infinie ; adresses sans compte en une ligne (`src/AdresseReception.jsx`). `docs/passation/2026-11-10-adresse-vrm-simple.md`. Geste : aucun.

## Lignes du §9 de CLAUDE.md déplacées telles quelles le 11 nov. (lot retraits-fiables, taille, après fusion de main)

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (lot DJ2)
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (lot DJ2)

- **11 nov. · Ouverture plus légère (lot K)** : ventes/achats, dressings, boîtes de réception gardés sur l'appareil (IndexedDB, par compte VRM, effacés à la déconnexion), revalidés par leur VERSION scalaire (`data.rev`, capture, écriture) : rien changé ⇒ rien téléchargé (2e ouverture 2,5 Mo → 0,9 Mo), changé ⇒ cette ligne seule ; versions ratées ⇒ lecture d'avant ou « pas su », jamais la copie, « Vu à hh:mm · pas relu » (`src/copieLignes.js`). `docs/passation/2026-11-10-ouverture-legere.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (lot DJ6)

- **11 nov. · Textes courts, 5e série** : Réglages, eBay, Leboncoin, Accueil (FAQ question/réponse), réception des e-mails, carte des relais, Stock, Vestiaire, Compta… : une phrase, le détail sous « Pourquoi ? » ; « Tu ne paies jamais le port » et l'attribution de la carte restent à l'écran ; 133 → 42 textes longs ; audit `textes-courts` étendu à 24 fichiers. `docs/passation/2026-11-11-textes-courts-5.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (lot tampon-vrm)

- **11 nov. · Extension 5.340 (finitions)** : mode vacances au journal (accepté et relu seulement) ; prix de vente Vestiaire (`sellerPrice`) ⇒ facture Pro Vestiaire, sinon refus d'avant ; avis : historique daté par lecture (« +N avis », 90 j, nombres seuls) ; audits : imports recollés dédoublonnés. `docs/passation/2026-11-11-extension-5340.md`. Geste : installer 5.340.0.
## Déplacé de CLAUDE.md §9 (11 nov., lot decisions-11nov)

- **11 nov. · Achats (lot DJ5)** : à côté de chaque proposition d'achat (Sans achat relié, coût d'une vente, numérotage, saisie en série) « Choisir un autre achat » : recherche dans SES achats, libres d'abord, « Déjà relié à N°… » + « Déplacer ici », « Délier » ; SON clic relie par le n° de la ligne (`src/relierAutreAchat.js`) ; « Reçu » d'un achat relié OUVRE (feuille du reçu e-mail, sinon visionneuse PDF) ; « Nouvel achat » refait (photo d'abord, prix en grand, derniers lieux, N° proposé réservé au pool) ; icônes `vitrine` / `soleilLevant`. `docs/passation/2026-11-11-achats-relier.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (lot DJ3, taille)
- **11 nov. · Ventes sans date de versement (lot DJ7)** : mesuré, 1 751 sur UN compte, détail de transaction jamais relu ; relevé : 0 vente datable. « Déclarer » : « N datées ✓ · M sans date », une raison par ligne + geste (« Ouvrir Vinted » par compte, Leboncoin à la main) ; jamais devinée (`src/versementRaisons.js`). `docs/passation/2026-11-11-dates-versement.md`. Geste : ouvrir vinted.fr sur ce compte.
- **11 nov. · Offres auto sûres + republier à la main (lot DJ8, ext. 5.342)** : Messages → Favoris & offres → « Offres auto » (interrupteur, jauge, alerte 40/50, journée calme après un frein, « Tout arrêter » en 2 gestes, aperçu = règle du moteur `audit-offres-sures`, seuils par paire, historique) ; **5.342** : le moteur répond aux offres DEPUIS L'ONGLET vinted.fr (plus de `Bearer` du fond ; sans onglet l'offre attend), lit « 45,5 », se tait sur un compte freiné, s'arrête au 1er refus ; ses clics d'offre/réponse partent de l'onglet s'il est ouvert, sinon comme avant ; Republier à la main en tête, « Vinted ↗ » copie aussi la description (4 → 3 gestes par paire). Étude `2026-11-11-anti-ban.md` ; récit `2026-11-11-offres-sures.md`. Geste : installer 5.342.0.

## Lignes du §9 de CLAUDE.md déplacées telles quelles le 11 nov. (lot retraits-fiables, taille, 2e fusion de main)

## Lignes du §9 de CLAUDE.md déplacées telles quelles le 11 nov. (lot suivi-commandes, fusion ; l’ancienne version de la ligne DJ3 et la plus ancienne)
- **11 nov. · Colis à leur place (lot DJ3)** : plus d'onglet Colis — « À expédier » (À envoyer · Envoyés, bordereaux, Tout imprimer, Je dépose…) en tête de **Ventes**, « À retirer » (points, codes, Mode relais, outils) en tête d'**Achats** (barre : Journée · Annonces · Ventes · Achats · Plus) ; mêmes composants (`colisDans`), anciens chemins par `src/colisPlace.js` ; « InPost » = réseau Mondial Relay ⇒ logo Mondial Relay (bordereau, e-mail, clé rangée) ; codes des e-mails : 0 non affiché pour un colis au point (mesuré). `docs/passation/2026-11-11-colis-a-leur-place.md`. Geste : aucun.
- **11 nov. · Extension 5.341 : les dates de versement arrivent vite** : `capterDatesVersement` lit 10 détails par passage (5), 15/h au plus DANS les 20 lectures, un passage de fond toutes les 20 min onglet vinted.fr ouvert ; au-delà de 5 jamais la place des codes, preuves, relevés (« pas su » ⇒ réservée) ; pause aléatoire 2–5 s, une requête à la fois, 429 ⇒ arrêt et pause ; la plus récente d'abord ; la carte dit « N restantes · environ X jours ». 1 751 ventes ⇒ ≈ 6 jours onglet ouvert. `docs/passation/2026-11-11-extension-5341.md`. Geste : installer 5.341.0, laisser vinted.fr ouvert sur le grand compte.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (accompagnement nouveau vendeur)


## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (lot centre-aide)


- **11 nov. · Statistiques par catégorie (lot stats-categories)** : Argent → Statistiques, carte « Par catégorie » (ventes, vendu, brut « · N sans prix d'achat », jours, en ligne) ; catégorie = `catalog_id` Vinted de l'annonce (dressing, sinon fiche de page) via `vinted_catalogue`, ou SON choix (`vrm_categories_main`) — jamais le titre ; « Sans catégorie (N) » + « Poser la catégorie » en série ; montrée dès deux familles (`src/statsCategories.js`). `docs/passation/2026-11-11-stats-categories.md`. Geste : aucun.

- **11 nov. · Facture Pro (lot DJ1)** : SIRET cherché à la VALIDATION (squelette, arrêt 8 s) ⇒ « C'est bien toi ? » (Oui écrit, Non rien ; RCS = ville du greffe recopiée du Kbis, jamais inventée ; EI « pas de RCS ») ; le statut choisi montre ses mentions ; factures Leboncoin/eBay/Vestiaire seulement sur un compte dit pro (`comptesFacture`, serveur 409) ; « Bon de retour » sur chaque vente Pro ; plus de pied VRM (Reply-To) ; e-mails Pro relus app ouverte (bouton manquant). `docs/passation/2026-11-11-facture-siret.md`. Geste : aucun.

- **11 nov. · Pour mon comptable (lot export-comptable)** : Argent → « Pour mon comptable », défaut le dernier mois bouclé, UN clic ⇒ un zip (un dossier) : récap PDF (couverture « sur N », manques NOMMÉS, pièces absentes dites), .xlsx sans bibliothèque + CSV (date de versement, frais lus = eBay seul, vide sinon), factures Pro du mois, factures d'achat jointes ; partage natif sinon téléchargement ; 9 + 2n gestes ⇒ 2. `docs/passation/2026-11-11-export-comptable.md`. Geste : aucun.

- **11 nov. · Alertes de production** : un journal (`api/_lib/alertes-production.js`, ligne `alertes_production` du propriétaire) pour plantage · e-mails (silence, 3×503/h) · colis (2 passages en panne, transporteur refusé) · santé (sonde dégradée 2×, MUETTE 3× dite « pas su ») ; une alerte par heure + compteur, données filtrées, 30 jours, interrupteurs dans Tout va bien ? (`?mode=alertes`, propriétaire seul) ; aucune migration. `docs/passation/2026-11-11-alertes-production.md`. Geste : aucun.

- **11 nov. · Décisions tranchées (lot decisions-11nov, C4–C11)** : Factures au téléphone « + Nouvelle facture » + « … » (feuille) ; Comparer = PAIRES (achats en petit) ; médian une fois ; livre de police : identité sur l'export seul ; résumé du soir réglable 18–22 h (`push_prefs.soirHeure`, défaut inchangé) ; Messages « Tous » par défaut ; « À compléter » fondu ; site jamais utilisé caché. `docs/passation/2026-11-11-decisions-11nov.md`. Geste : `CRON_SECRET` GitHub.

- **11 nov. · Mention « Créé par VRM » sur les bordereaux (lot tampon-vrm)** : 6,5 pt gris, coin bas-droit, SEULEMENT en zone libre sûre (même recherche que le tampon ; hors étiquette à découper, codes/QR, ≥ 25 mm du N°) ; sinon rien (thermique 10×15, fiche, étiquette introuvable) ; serveur et extension inchangés · `docs/passation/2026-11-11-tampon-vrm.md` · geste : imprimer un vrai bordereau.

- **11 nov. · Profil (lot DJ6)** : photo = téléversée > Discord/Google relié > initiale ; « Masquer mon nom » ; Paramètres n'est plus dans la navigation : la photo ouvre le menu du profil (Paramètres en tête, « g p », `?tab=settings`) ; « Relier Discord/Google » = LIAISON Supabase (`identities/authorize`), jamais un compte neuf ; « Continuer avec Discord » sans compte ⇒ compte vide annulé par le serveur et dit. Photo relue en projection (`si=`). Geste : « manual linking ». `docs/passation/2026-11-11-profil-photo.md`

- **11 nov. · Pas que des sneakers (lot DJ2)** : 1re question « Tu vends quoi ? » (18 tuiles, Lunettes comprise, une fois, rien pré-coché) ; exemples, notes, placeholders, dessins (états vides, « Comment marche le Stock »), eBay (« Pointure » seulement pour Sneakers) suivent ce qu'il vend ; le N° « dit où est l'article » (plus « carton ») ; « Quel VRM te ressemble ? » en deux cartes. Sneakers seules = textes d'avant mot pour mot. `audit-vendeur-generaliste` (20 mutations), banc `vendeur-generaliste`. Récit : `2026-11-11-vendeur-generaliste.md`.

- **11 nov. · Objectif du mois (lot objectifs-mois)** : Vendu · Bénéfice (brut, « au moins … » prix connus) · Ventes ; barre « 2 000 € vendus ce mois · 1 340 € · encore 660 € en 19 jours · ≈ 35 €/jour » + « en avance / en retard » (jamais « en retard » sur un « au moins ») ; « Viser … » = moyenne de 3 mois pleins (trou ⇒ rien) ; bilan du mois passé du 1er au 7, une fois (`parMois`, `bilanVu`) ; détail sorti du volet d'Argent. `docs/passation/2026-11-11-objectifs-mois.md`. Geste : aucun.

- **11 nov. · Achat en photo du ticket (lot achat-photo)** : « Photo du ticket » en tête de Nouvel achat ; lecture LOCALE (`src/depensesTicket.js` amélioré : TVA incluse, « 60 € », remise, date, enseigne, articles ; raison dite si rien lu) ⇒ champs VIDES proposés en ambre, bouton « Valider 45,00 € et ajouter » (son clic seul écrit, §2.5), ticket joint comme facture ; 7 → 4 gestes. `docs/passation/2026-11-11-achat-photo.md`. Geste : aucun.


## Lignes du §9 de CLAUDE.md déplacées telles quelles le 11 nov. (lot import-depart)

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (lot audits-rouges)
- **11 nov. · Partager une fiche (lot partage-fiche)** : Annonces « … » / Stock → « Partager » ⇒ `vrm.center/p/<jeton>` (3 gestes, partage du téléphone sinon copie) : photos, titre, taille, état, prix, liens des annonces en ligne (par le N°) ; jamais prix d'achat, N°, compte, adresse ; pseudo seulement voulu ; 1/7/30 j, « Arrêter » ; « Vendu » par la preuve de l'app, jamais par absence ; page datée, « À confirmer » après 72 h ; mode `partage` de /api/compte (aucune fonction neuve), jeton indexé par empreinte, même 404 partout. `docs/passation/2026-11-11-partage-fiche.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (lot suivi-commandes, 2e fusion de main)
- **11 nov. · Centre d'aide intégré (lot centre-aide)** : le « ? » de chaque écran ouvre une animation SVG (une scène par geste, 3–5 s, pause, immobile si « réduire les animations ») puis 3 à 5 fiches « Comment faire » ; 69 fiches (`src/aideFiches.js`) avec « M'y emmener » (`?tab=`, `reglage=`) ; recherche tolérante dans la feuille et la loupe, sans IA ; mots selon « Tu vends quoi ? », fiches avancées tues en Simple (la recherche les trouve). `docs/passation/2026-11-11-centre-aide.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (ouverture-legere-2)
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (lot clics-directs)

- **11 nov. · Clics directs** : Ma journée, toucher la pile (photo comprise) ⇒ Ventes, plus de zoom (`data-sans-visionneuse`) ; Ventes, la photo (ligne et détail) s'ouvre DIRECTEMENT dans LA visionneuse (`ouvrirVisionneuse`, toutes les photos de l'article par fichier, `article` ⇒ mode stream), plus de loupe ni de second panneau. Banc `clics-directs` (rouge sur `main`). `docs/passation/2026-11-11-clics-directs.md`. Geste : aucun.
## Déplacé de CLAUDE.md §9 (11 nov., lot emails-ecran)

- **11 nov. · Ouverture plus légère 2** : transactions et fraîcheur des comptes gardées sur l'appareil, revalidées par leur version de famille (nombre + lignes écrites depuis 6 h, `lireFamilleAvecCopie`) ; version illisible ⇒ lecture d'avant, jamais la copie ; instantané d'Annonces (Vinted, « Tous ») ; 2e ouverture Ma journée 927 → 458 Ko, Annonces 1 108 → 638 Ko ; e-mails de suivi et fiches de page refusés (aucune version sûre). `docs/passation/2026-11-11-ouverture-legere-2.md`. Geste : aucun.


- **11 nov. · E-mails envoyés (lot emails-envoyes)** : gabarit 600 px sans image (en-tête « VRM » ou NOM DE LA BOUTIQUE), texte ≥ 14 px, AA clair/sombre ; facture/avoir : n° + montant du PDF, rien de VRM. Banc `emails-envoyes`. `2026-11-11-emails-envoyes.md`. Geste : aucun.
## Déplacé de CLAUDE.md §9 (11 nov., lot quoi-de-neuf, taille du dossier)

- **11 nov. · « Quoi de neuf » (lot quoi-de-neuf)** : `src/nouveautes.js` (date, titre ≤ 8 mots, phrase ≤ 12, `tab`, pour, mode) ⇒ carte discrète en haut de Ma journée → feuille (« Voir », « Tout vu ») + Paramètres → Aide ; « vu » dans SYNC_KEYS ; rien d'avant l'inscription ; selon ce qu'il vend, Simple/Complet, statut. ⚠️ **Chaque lot visible ajoute sa ligne en tête de `src/nouveautes.js`** (`audit-quoi-de-neuf`). `docs/passation/2026-11-11-quoi-de-neuf.md`. Geste : aucun.

- **11 nov. · Glisser pour agir (lot gestes-glisser)** : UN `LigneGlissable` (règle pure `src/glisserRegle.js`) — glisser à gauche révèle 1–2 actions, glisser long = la principale ; les MÊMES fonctions que les boutons : Ventes « Déposé »/« Imprimer », À retirer « Retiré »/« Le code », Qui dorment « Baisser » (ouvre la feuille)/« Agir » ; bord gauche exclu, souris non, tiroir `inert` fermé, indice une fois ; remplace `GlisserVente` ; Messages : aucun « Lu » existant, rien ajouté. `audit-ligne-glissable`, banc `gestes-glisser`. `docs/passation/2026-11-11-gestes-glisser.md`. Geste : aucun.

- **11 nov. · Page d’accueil publique (lot accueil-public)** : « pour qui » en tête, « Essayer gratuitement », 5 moments (+ Messages/offres), captures en catalogue mélangé, cartes Solo/Pro = `OFFRES` + CGV, FAQ en h3, SEO (OG `og-vrm.jpg`, JSON-LD sans avis). `docs/passation/2026-11-11-accueil-public.md`. Geste : aucun.

- **11 nov. · Parcours d'arrivée (accompagnement nouveau vendeur)** : plein écran, une étape à la fois (compte · « Tu vends quoi ? » = Ma configuration · extension connectée à CE compte · e-mails « Reçu ✓ » · Vinted « N annonces lues » · première vente ⇒ « C'est prêt »), réussite CONSTATÉE (relu 10 s), reprise exacte sur tout appareil (`vrm_parcours` dans SYNC_KEYS, aucune migration) ; petite carte sur Ma journée. `docs/passation/2026-11-11-accompagnement-nouveau-vendeur.md`. Geste : aucun.

- **11 nov. · VRM installable (lot app-installable)** : 2e ouverture instantanée (coquille servie du cache, relue derrière ; seules `/` et `/index.html`, une page statique ne remplace plus l'app) ; nouvelle version ⇒ « Mettre à jour » discret une fois (jamais de rechargement pendant une saisie, `src/miseAJour.js`) ; aide d'installation une fois (iPhone 2 gestes, Android « Installer », `src/aideInstallation.js`) ; écrans de démarrage iPhone clair/sombre, icônes toutes tailles, raccourcis, plus de rechargement au tirer ; clic de notification vers la fenêtre de l'app. `docs/passation/2026-11-11-app-installable.md`. Geste : aucun (reposer l'icône pour le nouvel écran de démarrage).

- **11 nov. · Import de départ (ext. 5.344)** : l'extension relit TOUT l'historique Vinted (ventes puis achats) d'un compte, 4 pages de 100 par passage onglet vinted.fr ouvert, dans les 20 lectures/h, 12 pages/h au plus, jamais la place de l'argent et des colis, reprise là où elle s'est arrêtée, fusion par n° ; base déjà complète ⇒ aucune lecture ; progression dans `import_vinted_{uid}` (carte du logo, Ma journée, Paramètres → Mon historique Vinted, « Tout récupérer ») ; état simple pour l'accompagnement : `etatSimpleImport` (`src/importDepart.js`). `docs/passation/2026-11-11-import-depart.md`. Geste : installer 5.344.0, laisser vinted.fr ouvert jusqu'à « Tout est récupéré ✓ ».

- **11 nov. · Parler à la loupe** : dictée DU NAVIGATEUR (`src/dicteeNavigateur.js`, fr-FR, en direct) ; un N° dit ouvre SA fiche si `cleNum` unique (`ficheDeLaVoix`), sinon la liste ; appui long sur la loupe ; refus ⇒ une phrase. `2026-11-11-recherche-vocale.md`. Geste : aucun.

- **11 nov. · E-mails denses comme Mail (lot emails-ecran)** : sur ordinateur UN panneau à deux colonnes qui remplit la fenêtre (liste 340–400 px, lecture à droite, chacune défile seule), lignes 14/13/12 px (51 px, 5 → 8 visibles à 1512), titre d'écran 26 px (couche `vrm-premium`), lecture 69 car./ligne, e-mail HTML à taille naturelle (1280 : 0,70 → 1), ↓ ↑ Échap ; téléphone : feuille moins grosse, 44 px tenus ; rien retiré. Banc `emails-densite`. `docs/passation/2026-11-11-emails-ecran.md`. Geste : aucun.

- **11 nov. · Audits rouges remis au vert** : ~35 audits rouges sur `main` ; vrais défauts corrigés (pilotage paginé sans ordre, « Chrome » en dur dans Mode vacances, icônes de Réglages en double, conseil « compte sans e-mail » sans cible, captures sans garde-fou, écrans refusés par « Signaler », `<img>` brutes) ; audits périmés remis à la même règle ; clone superficiel ⇒ versions publiées « pas su ». Restent : zone Colis, logos. `docs/passation/2026-11-11-audits-rouges.md`. Geste : aucun.

- **11 nov. · Ventes en lot (lot ventes-lot)** : une transaction à plusieurs articles = UNE vente « Lot · N », chaque article relié par identité (annonce ⇒ photo ⇒ SON « Relier », `vrm_lot_liens`), prix réparti au centime (prorata des prix affichés, sinon parts égales dites), achat du lot = somme si tout connu, tampon « 124 · 131 », sortie du stock, facture Pro une ligne par article ; CA inchangé (transaction) ; règle `src/venteLot.js`, copie `api/_lib/vente-lot-regle.js` (`audit-ventes-lot --recopie`), banc `ventes-lot`. `docs/passation/2026-11-11-ventes-lot.md`. Geste : aucun.

- **11 nov. · Tes meilleures sources** : Argent → Statistiques et Achats, par source d'achat (Vinted, eBay, brocante, fournisseur par son nom…) : achetés, investi, revendus PAR IDENTITÉ (`achatDeVente`), bénéfice/marge/délai des revendus, « pas encore revendu » depuis quand, classement bénéfice/vitesse, chaque ligne ouvre ses achats ; vente sans achat relié dans aucune source, dite (`src/meilleuresSources.js`, `vrm_meilleures_sources`). `docs/passation/2026-11-11-meilleurs-fournisseurs.md`. Geste : aucun.

- **11 nov. · Revue de sécurité adverse** : aucune fuite A→B (routes, RLS, SECURITY DEFINER relues) ; corrigés : lien `#access_token` piégé (adopté seulement si CE navigateur a demandé l'e-mail, jamais par-dessus un autre compte, `src/lienEmail.js`), hôte de `vinted-refresh`, balayage du widget, cache de l'onglet à la déconnexion, CSP jsDelivr figée, `discord-deja`, bombe PDF, SMTP interne ; 016 : « Confirm email » préalable. `docs/passation/2026-11-11-securite-revue.md`. Geste : aucun (vérifier aperçu PDF/ticket/détourage/scanner après déploiement).

- **11 nov. · Revenir en arrière** : Paramètres → Sécurité et sauvegarde ; points serveur `restore_0…23` (30 j, lus par `meta`) avant série, import, chaque jour ; aperçu, choix, plus récent ⇒ demandé ; un N° ne recule jamais ; « Annuler la restauration ». `2026-11-11-restauration.md`. Geste : migration 033 (optionnelle).

- **11 nov. · Santé de tes données (lot sante-donnees)** : Paramètres → « Santé de tes données » (+ ligne dans « Tout va bien ? ») : 12 vérifications, la plus grave d'abord (deux articles sous un N° SEUL en rouge), un nombre = la règle du propriétaire (À trancher, `vrm_sources_ventes`, `aVoirCapture`, e-mails), UN bouton qui ouvre le parcours ; pas su ⇒ « — » + « Ouvrir » ; « Tout est à jour ✓ » seulement tout lu (`src/santeDonnees.js`, audit + 8 mutations, banc). `docs/passation/2026-11-11-sante-donnees.md`. Geste : aucun.

- **11 nov. · Rapport du mois (PDF)** : Argent → Le détail → « Rapport du mois » (défaut : le dernier mois bouclé) ⇒ PDF A4 de 3 pages partagé (feuille native) sinon téléchargé : chiffres clés du bilan, vendu/reçu par jour, plateformes, comptes, catégories, top 10 (titre par identité), stock, achats, URSSAF du régime CHOISI (pas choisi ⇒ absente), manques nommés ; aucune règle neuve (`src/rapportMois.js`, lectures de catégories partagées `src/categoriesLecture.js`). `docs/passation/2026-11-11-rapport-mois.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (lot equipe-pret)

- **11 nov. · Équipe prête à activer** : la 016 ne referme plus la lecture sans abonnement si la 027 passe avant (les deux ordres marchent) ; « Envoyer l'invitation » à partager (aucun lien secret) ; l'aide sans la 016 lit « le vendeur doit l'activer » ; SQL à coller dans `scripts/equipe-sql/`. `docs/passation/2026-11-11-equipe-pret.md`. Geste : confirmation d'e-mail, puis les 3 SQL (pas à pas §4).

<!-- Déplacé tel quel de CLAUDE.md §9 le 11 nov. (lot actions-serie, sous 59 000 octets) -->
- **11 nov. · Clôturer l'année** : Argent → Déclarer (déc.–mai), 8 étapes CONSTATÉES (règles existantes) + portes ; « J'ai fini » = son clic (`vrm_cloture_annee`) ; Ma journée déc./janv. une fois. Sites officiels injoignables ici : cases/seuils non revérifiés. `2026-11-11-cloture-annee.md`.
- **11 nov. · iPad (branche `claude/ipad`)** : au doigt dès 744 × 600 px, coque ORDINATEUR (rail, île, liste + fiche) ; règle largeur + pointeur dans `src/coque.js`, recopiée mot pour mot dans les CSS (`audit-coque-tablette`) ; `data-tablette` (large/etroite) ⇒ `styles-tablette.css` : 44 px, rail libellé ≤ 1199, rien au survol ; rotation sans remontage ; iPhone couché = téléphone. Banc `ipad.cjs`. `docs/passation/2026-11-11-ipad.md`. Geste : aucun.

- **11 nov. · Banc e2e app + VRAIE extension (`scripts/bancs/e2e-extension.cjs`, `_e2e-monde.cjs`)** : vrai Chromium headless, extension MV3 chargée, `dist/`, faux vinted.fr + faux Supabase en local ; liaison, dressing ⇒ Annonces, vente ⇒ Ventes, baisse commandée par l'app (onglet, plafond, 429), autre compte ⇒ rien, extension 5.335 ⇒ rien promis ; `--prouve` (7 mutations) ; job CI `e2e-extension` NON bloquant. ⚠️ CONSTAT : double moisson à l'arrivée sur vinted.fr (`activeHarvest` hors `requeteVinted`, 2 requêtes en vol) — pas corrigé. `docs/passation/2026-11-11-e2e-extension.md`. Geste : aucun.

- **11 nov. · Parité des plateformes** : matrice remesurée (`parite-plateformes.md`) ; comptes écartés hors de « Finalisé par plateforme » ; rapport du mois, registre annuel, tableur : prix d'achat et N° Leboncoin/eBay/Vestiaire par identité ; « CA entre deux dates » toutes plateformes (`src/caAutresParJour.js`) ; Colis « au moins » si Leboncoin/Vestiaire pas lus. `2026-11-11-parite-plateformes.md`. Geste : aucun.

- **11 nov. · Safari fiable (lot webkit-fiable)** : app lisible par iOS 15.4+ (5 regex à lookbehind ôtées, prouvées équivalentes ; `AbortSignal.timeout` ⇒ `signalDelai`, `src/compatSafari.js`) ; `audit-safari` (dist : lookbehind, API absentes ; rouge sur main) ; bancs WebKit : faux Supabase avec CORS (`_navigateur.cjs`), « écran prêt » sur état (`_ecran-pret.cjs`) ; `iphone-reprise` n'était pas instable mais périmé (nav du 10-11 nov.) ; job WebKit + connexion, journée, ventes, retraits, impression, toujours non bloquant. `docs/passation/2026-11-11-webkit-fiable.md`. Geste : aucun.

- **11 nov. · « Me le rappeler » (rappels perso)** : posé PAR LUI sur un article (N°), une vente ou un achat (fiche, « … ») ; demain/3 j/7 j/date + note ; 9 h (Paris, après les heures calmes) UNE notification qui ouvre l'élément, « vendu entre-temps » dit ; carte Ma journée, Paramètres → Rappels, agenda .ics ; `vrm_rappels` (règle `api/_lib/rappels-perso.js`, cron existant) ; curseur du réveil par demi-heure. `2026-11-11-rappels-perso.md`. Geste : aucun.

- **11 nov. · Importer d'un autre outil** : Paramètres → Importer (+ lien facultatif sur la carte « Démarrer avec VRM ») : stock (N°, emplacement, prix d'achat, date, notes) et ventes passées en CSV/XLSX ; aperçu par tranches ; N° déjà servi ⇒ conflit, jamais écrasé ; N° importés au pool ; CA au versement (sans ⇒ « à dater ») ; Vinted sans n° ⇒ « à vérifier » ; « Annuler » ; annonce proposée, son clic relie. Pas encore affiché au Stock. `docs/passation/2026-11-11-import-autre-outil.md`. Geste : aucun.

- **11 nov. · Vendu ⇒ retiré des autres sites en un toucher (lot anti-double-vente)** : carte de Ma journée + tête de Ventes « Retirer des autres sites » ⇒ confirmation site par site ⇒ Leboncoin (`lbcSupprime`) et eBay (`retirer`, sans `auto`) une à la fois ; Vinted jamais (lien), Vestiaire « à faire sur le site » ; lecture > 24 h, état pas confirmé, 2 annonces sous un N° ⇒ « peut-être · vérifier », rien ne part ; « relu » = lecture complète du site APRÈS (`src/retirerAilleurs.js`). Notif serveur inchangée. `2026-11-11-anti-double-vente.md`. Geste : aucun.

- **11 nov. · Revue de design (aucun code d'app touché)** : 166 captures sur base inventée (`docs/revue-design-2026-11-11/`, banc `scripts/bancs/revue-design-captures.cjs`), 36 points P1–P3, 6 lots indépendants (A coquille · B Colis/impression · C listes · D Argent · E Paramètres/contrôles · F hors app), 5 règles ajoutées à DESIGN.md. `docs/passation/2026-11-11-revue-design.md`. Geste : aucun (choisir l'ordre des lots).

- **11 nov. · Base plus rapide (lot base-optimisee)** : 033 = une seule permissive par table (`vrm_proprietaire_permis`), restrictives et `equipe_lit` intactes, refuse tout si l'état diffère (matrice de 180 accès identique, `audit-politiques-uniques-sql`) ; 035 = index partiel `app_data_txn_owner` (transactions, pages ÷ 6 sur base jetable) ; 034 facultative (2 index inutiles) ; `sauvegarde` : rien ; pilotage paginé ordonné. Rien appliqué. `docs/passation/2026-11-11-base-optimisee.md`. Geste : appliquer 033, 035, réglage Auth en pourcentage.

## Ligne déplacée de CLAUDE.md §9 (11 nov., restes) — telle quelle

- **11 nov. · Chaque écran se rouvre comme on l'a laissé, sur tous ses appareils (lot reprise-ecrans)** : clé synchronisée `vrm_reprise_ecrans` (filtre, tri, période, recherche < 10 min après l'avoir quittée, compte par site, site d'une tâche, dernier écran < 30 min ; écrite datée, 1,5 s de délai, jamais au montage) ; défilement sur l'appareil seul ; un lien `?tab=` gagne ; le nuage ne remplace que ce qui n'a pas été touché ; « Affiché avec … · Effacer » + « Réinitialiser l'écran » sous la barre du haut. `audit-reprise-synchro` (15 mutations), banc `reprise-ecrans` (deux appareils). Récit : `2026-11-11-reprise-ecrans.md`. Geste : aucun.

## Lignes du §9 de CLAUDE.md déplacées telles quelles le 11 nov. (intégration du paquet colis, taille)

- **11 nov. · Rouges d'intégration + garde réseau** : contrôles GitHub de `main` remis au vert — défauts de l'app corrigés (barre d'objectif qui débordait, photos du mode relais/scanner hors `PhotoVinted`, rouge du doublon en dur, « · » en tête de ligne, hook mort) ; contrôles portés sur les formes voulues (Ma journée v2, Ma configuration, Argent dans Gérer, alerte nouvel appareil…), chacun rougi par mutation ; **garde réseau** : aucun banc ne joint la production ni Internet (`scripts/bancs/_garde-reseau.cjs`, sinon rouge). `docs/passation/2026-11-11-rouges-integration.md`. Geste : aucun.
- **11 nov. · Fiscalité ES/IT/DE/UK/IE (étude, aucun code)** : règles relevées avec leur source officielle (extraits de recherche, pages pas ouvertes : réseau fermé ⇒ tout est à relire avant d'entrer dans `src/`) et conception (`vrm_pays_fiscal`, régimes par pays hors de `vinted_regime`, `src/fiscal/<pays>.js` sourcé, « à vérifier avec ton comptable ») ; ordre : relire les sources → pays + particulier (DAC7) → Italie forfettario → Allemagne → Espagne ; Royaume-Uni exclu (livres). `docs/passation/2026-11-11-fiscalite-pays.md`. Facture Pro hors de France : Allemagne seule, sur le papier, rien de branché avant relecture par un expert local (tranché le 11 nov.). Geste : autoriser les hôtes officiels, confirmer que le 11 nov. remplace « International » (§3).
## Lignes du §9 de CLAUDE.md déplacées telles quelles le 11 nov. (lot ventes-achats-visuel, taille)

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (intégration ventes-achats-visuel, taille)

- **11 nov. · Restes (Déclarer, 3 bancs)** : Argent → Déclarer écrit chaque montant une fois (« 7,44 € » ×3 ⇒ la carte du haut ; DAC7 « 2 000,01 € » ×3 ⇒ l'en-tête), « 60 € » lisible dans la carte sombre ; ⌘K « Exporter » met vraiment le focus sur « Préparer » ; bancs `compta-abonnements` (issue, pas 1,5 s) et `annonces-ventes-brouillon` (écrans d'aujourd'hui) remis à la règle. Reste rouge : date limite coupée dans Colis au téléphone (zone Colis). `docs/passation/2026-11-11-restes.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (lot `notifs-groupees`, fusion e2)
## Ligne déplacée de CLAUDE.md §9 (11 nov., lot traduction — taille du fichier)


- **11 nov. · Plus de statistiques (lot stats-plus)** : carte sombre de Ma journée jusqu'à 6 chiffres (ajout, retrait, ordre ; pages 2×2 qui glissent au téléphone ; + valeur du stock, objectif %, URSSAF à payer) ; Statistiques : « En bref » (ventes, panier, marge connue, ± %) et « Plus de chiffres » (vendu et reçu, âge du stock, mes records, comparer deux comptes, 10 meilleures ventes), règles `src/statsPlus.js`. ⚠️ styles des widgets en `@layer vrm-premium`. `docs/passation/2026-11-11-stats-plus.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (lot journee-perso)

- **11 nov. · Ma journée composée (lot journee-perso)** : « Modifier ma journée » (bas de Ma journée, Paramètres → Affichage) : interrupteur + poignée (doigt, clavier) par carte, « Revenir au réglage d’origine » ; `vrm_journee_perso` synchronisé, par-dessus Simple/Complet ; cachée mais urgente ⇒ revient (« Affichée car urgent ») ; alertes jamais cachables ; compteurs cachés publiés. `2026-11-11-journee-perso.md`. Geste : aucun.

- **11 nov. · Robustesse serveur (second agent)** : quarantaine qui garde les PDF (lignes `email_qpj_*`, rendus au rejeu) ; un 2e e-mail sans PJ n'efface plus un bordereau ; versements jamais fondus ; l'enveloppe décide avant To/Cc ; webhook Stripe 503 si pas su, ancien abonnement sans effet ; effacement à 12 mois seulement après l'avis PROUVÉ ; cron : échec retenté ; délais Stripe/eBay/IA. `docs/passation/2026-11-11-robustesse-serveur.md`. Geste : aucun.

## Déplacé de CLAUDE.md §9 le 11 nov. (lot traduction, taille)


## Déplacé de CLAUDE.md §9 (11 nov., lot suivi-travail)

### Déplacé de CLAUDE.md §9 (11 nov., ci-vert — fichier au-delà de 59 000 octets), tel quel

## Déplacé tel quel de CLAUDE.md §9 (11 nov., pour rester sous 59 000 octets)


- **11 nov. · États vides (banc `etats-vides`)** : 13 écrans × vide / pas su / base injoignable / hors ligne ; aucun compte relié PROUVÉ ⇒ « aucun compte relié » (plus « lecture… » à l'infini), Messages et Stock disent « Relier un compte », plus de « au moins 0 », la sonde de Paramètres n'écrit plus base injoignable, au retour du réseau les listes « pas relues » sont relues. `docs/passation/2026-11-11-etats-vides.md`. Geste : aucun.

- **11 nov. · Réseau instable (sous-sol du point relais)** : toute écriture de l'app vers la base (et ses lectures de fusion) est BORNÉE (`src/reseauBorne.js` : 20 s écriture, 15 s lecture, 30 s facture) — une requête qui pend vaut « pas su », jamais un envoi bloqué à vie ; 408/425/429/5xx = passager (la pilule ne défait plus le geste) ; 401 d'un jeton vieux ⇒ renouvelé puis renvoyé ; « Enregistré » dit après « en attente d'envoi » ; « Ma facture » gardée sur l'appareil et renvoyée seule. Banc `reseau-instable`, `audit-reseau-instable --prouve` (8/8). `docs/passation/2026-11-11-reseau-instable.md`. Geste : aucun.

- **11 nov. · Budget de vitesse** : banc `budget-vitesse` (8 écrans, 390 px, appareil neuf + 2ᵉ ouverture : lectures, octets, doublons par adresse, `select=data`, JS gzip ; aucun ms) contre `scripts/bancs/budget-vitesse.json`, CI part 2 ; relever : `BUDGET_RELEVER=1 BUDGET_RAISON=…` + commit du seul .json. `2026-11-11-budget-vitesse.md`. Geste : aucun.
- **11 nov. · Stock juste (lot DJ4)** : Stock = paires EN LIGNE, une fois par identité (N°, photo, annonce), une pastille par site ; « à confirmer », masquées et gardées À PART (replis), jamais supprimées ; Ma journée compte aussi par N° ; la valeur du stock dit « chez toi » (même base que l'inventaire de fin d'année). « Répartir un lot », « Inventaire physique », « Audit du stock » hors du menu (données gardées) ; plus d'onglet « À trancher » (`?tab=trancher` ⇒ Ma journée, carte ouverte, d'office si ≤ 3). Supprimée de Vinted : « L'enlever du stock ? » ⇒ UN toucher (séparée, case libérée, N° gardé), « Non, je l'ai », « Plus tard » (20 h), annulables 5 s ; la pilule « Annuler » ne se fige plus (focus relu, pause ≤ 60 s). `docs/passation/2026-11-11-stock-juste.md`.

## Déplacé tel quel de CLAUDE.md §9 (11 nov., intégration extension 5.355.0 — CLAUDE.md sous 60 Ko)

- **11 nov. · « Article » hors Sneakers partout (ext. 5.347)** : une source `motsVendeur()` (src/profilVendeur.js) ; app, aide, serveur (`api/_lib/mots-vendeur.js`), extension (`vrm-mots.js`) ; Sneakers mot pour mot (`audit-vocabulaire-article`). `2026-11-11-vocabulaire-article.md`. Geste : installer 5.347.0.
- **11 nov. · Vinted cache, supprime ou restreint (ext. 5.350)** : alerte sur PREUVE seulement, depuis ce que l'extension lit DÉJÀ (deux lectures COMPLÈTES du dressing ; profil banni ; refus « restricted ») : masquée (`is_hidden`), disparue « peut-être retirée par Vinted » (ni vente ni suppression vue), compte limité/fermé ⇒ frein 24 h ; ligne `moderation_vinted_{uid}`, UNE notification regroupée (`/api/push` action `moderation` + cron, mémoire `vrm_moderation_notifie`), carte en tête de Ma journée (« C'est vu » `vrm_moderation_vu`), « Ce que VRM a fait ». `audit-alerte-moderation` (18 mutations), banc `alerte-moderation`. `2026-11-11-alerte-moderation.md`. Geste : installer 5.350.0.
- **11 nov. · Extension 5.351 : aussi belle et pratique que l'app (lot extension-visuel)** : carte du logo = UNE ligne d'état (« shop_x · à jour à 14:05 ✓ », pause Vinted en gris), détail replié (ouvert sur un geste), « Ouvrir VRM » + Colis · Messages · Offres à un clic ; logo déplaçable (place par site) et réductible ; teinte choisie dans VRM (carte + fenêtre). Aucune requête neuve. `docs/passation/2026-11-11-extension-visuel.md`. Geste : installer 5.351.0.
- **11 nov. · Avis de 3★ ou moins reçu (lot avis-negatif, ext. 5.352)** : avis REÇUS (aucun rappel d'évaluation) ; après sa lecture des avis (aucune requête de plus), l'extension prévient `/api/push {action:'avis'}`, le serveur compare à `vrm_avis_bas` (1re lecture = ligne de base, neuf = avant le 1er avis connu, une fois par avis ; filet : cron) ⇒ « Avis 2★ reçu sur shop_x » (famille « Avis négatif reçu », seuil 1–4★ `push_prefs.avisSeuil`, défaut 3) + carte « À faire » de Ma journée (texte rangé, sinon « Lis l'avis sur Vinted ») ; la vente seulement par le n° de transaction de l'avis (jamais vu), sinon le profil des avis sur Vinted. `docs/passation/2026-11-11-avis-negatif.md`. Geste : installer 5.352.0.

## Déplacé tel quel de CLAUDE.md §9 (11 nov., intégration extension-2 — CLAUDE.md sous 59 000 octets)

- **11 nov. · Prévenir avant de publier (lot verif-publication, ext. 5.353)** : la vérification d'avant publication (Leboncoin, eBay, Vestiaire, Republier, brouillons) dit en plus « N° absent de la fin de la description » (seulement s'il numérote lui-même : réglage ou habitude PROUVÉE 4/5 sur 5 lues) et « déjà en ligne » (même N°, lecture < 24 h ; pas su ⇒ rien) ; chaque alerte a son pourquoi et « Ne plus me le dire » (`vrm_verif_coupees`, rallumée dans Paramètres) ; encart sur vinted.fr/items/new (sans requête Vinted, photos non jugées) ; banc `verif-publication` réparé. `docs/passation/2026-11-11-verif-publication.md`. Geste : installer 5.353.0.
- **11 nov. · Sélectionner plusieurs lignes, agir une fois (lot actions-serie)** : UN mécanisme (`src/selectionSerie.js`, `SelectionSerie.jsx`) : appui long au doigt / case + Maj-clic, barre « N sélectionnés », Tout sélectionner (filtre), Échap. Achats (Retiré · Relier → « Sans achat relié » · Exporter · Masquer), Ventes (Imprimer · Je dépose · Exporter · Facture Pro), Stock (Enlever confirmé · Exporter), E-mails (Lu/Non lu) ; même écriture que l'unitaire, UN « Annuler », résumé « 8 faits · 2 pas faits : raison ». Annonces inchangé. `audit-actions-serie`, banc `actions-serie`. `2026-11-11-actions-serie.md`.

## Déplacé de CLAUDE.md §9 (11 nov., lot suppression-oauth)


## Déplacé de CLAUDE.md §9 (11 nov., relecture OAuth : fusion connexions-oauth + suppression-oauth)


## Déplacé tel quel de CLAUDE.md §9 (11 nov., intégration extension-2 + relecture-oauth — sous 59 000 octets)

- **11 nov. · Extension 5.354 : mini-résumé du mois dans la carte du logo (lot extension-resume)** : « Ce mois : 1 340 € vendus · 42 ventes · 3 à expédier » replié sous « Ce mois dans VRM », lu dans `widget_stats` (l'app y recopie le badge de Colis, `aExpedier`, `src/resumeCarte.js`), 1 lecture projetée / 15 min, « — » si pas su ; seulement si le compte de l'onglet est prouvé à CE compte VRM (eBay : jamais) ; masquable. `docs/passation/2026-11-11-extension-resume.md`. Geste : installer 5.354.0.
- **11 nov. · Intégration extension 5.355.0** : vocabulaire-article (5.347), alerte-moderation (5.350), extension-visuel (5.351), avis-negatif (5.352), verif-publication (5.353), extension-resume (5.354) réunis par vrais `git merge` ⇒ un seul contenu, **5.355.0** (aucune des six publiée ; chaque capacité garde la version de son chantier) ; notifications : dix familles (« Vinted cache ou limite » + « Avis négatif reçu ») ; textes « paire » des lots du paquet passés par `motsVendeur()`. Branche `claude/integration-extension` ; la ligne de chaque chantier : `historique-divers.md` (fin). Geste : installer 5.355.0.
- **11 nov. · Pire cas** (banc `pire-cas`, 2 000 lignes, textes et montants extrêmes) : montants tenus dans leur carte, fiche ouverte lisible, Messages/Annonces/Stock sans gel. CSS dans `@layer vrm-premium`. `docs/passation/2026-11-11-pire-cas.md`. Geste : aucun.

- **11 nov. · Supprimer mon compte selon le compte (lot suppression-oauth)** : compte Discord/Google sans mot de passe ⇒ jamais de champ mot de passe ; récent ⇒ « Tu viens de te connecter avec Discord. Tape SUPPRIMER » ; ancien ⇒ « Me reconnecter avec Discord » (reconnexion, retour ici, autre compte refusé) ; même calcul que le serveur (`api/_lib/preuve-connexion.js`, règle inchangée). `docs/passation/2026-11-11-suppression-oauth.md`. Geste : aucun.

- **11 nov. · VRM figé pendant un travail long (lot `suivi-travail`)** : Republier, Republier sur Leboncoin, Publier Leboncoin/eBay/Vestiaire, Baisser le prix, Retirer des autres sites, Mode vacances ⇒ feuille plein écran (reste `inert`, Échap/retour/onglet retenus), « N sur M » + barre + étape de l'annonce (dite par l'extension), « environ » au rythme réel (« — » avant), pause de sécurité à rebours, jauge 50/h, journal horodaté copiable sans rien de personnel, « Mettre en pause » / « Arrêter » confirmé, récap, gardé dans « Ce que VRM a fait » ; rechargé ⇒ « Interrompu », l'annonce en cours à vérifier (jamais déclarée faite). API : `docs/passation/2026-11-11-suivi-travail.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (lot sante-comptes)

- **11 nov. · Santé des comptes (lot sante-comptes)** : En forme / À surveiller par compte Vinted, 7 points lisibles, seuils écrits (`src/santeComptes.js`), Paramètres · Statistiques · Ma journée si un compte glisse ; aucune notification. `docs/passation/2026-11-11-sante-comptes.md`. Geste : aucun.
## Lignes de CLAUDE.md §9 déplacées telles quelles (11 nov., photos-comptes)

- **11 nov. · Photos en double entre comptes (ext. 5.358)** : empreinte perceptuelle locale sans IA (dHash + pHash, 3 recadrages, `src/photoEmpreinte.js`, seuil 16 MESURÉ : même photo recompressée/recadrée ≤ 11, autre photo ≥ 19) calculée par l'extension (budget de lecture, une image/45 s) ; Annonces → Outils « Photos en double », carte ambre Ma journée, encart avant de publier ; un RISQUE montré, jamais une identité (§5) ; « Republier avec d'autres photos » = Republier à la main ; rien supprimé ni modifié. `docs/passation/2026-11-11-photos-comptes.md`. Geste : installer 5.358.0, laisser vinted.fr ouvert.

- **11 nov. · Connexions Google/Discord (lot connexions-oauth, ext. 5.346)** : bug de prod « code challenge does not match » corrigé (un vérificateur PKCE PAR tentative, `vrm_essai`, `src/auth/essaisPkce.js`) ; refus traduits PAR CODE (`src/auth/erreursOAuth.js`, recopiée dans l'extension) ; même adresse ⇒ relié et dit ; Délier dit l'e-mail qui change ; l'extension n'adopte plus un compte neuf. Banc `connexions-oauth`. Récit `2026-11-11-connexions-oauth.md`. Geste : Redirect URLs, installer 5.346.0.
## Ligne déplacée de CLAUDE.md §9 (11 nov., lot tva-marge, taille)

- **11 nov. · TVA sur marge (lot `tva-marge`)** : régime « marge » choisi dans Ma facture (jamais deviné) ⇒ Argent → Factures : TVA due du mois/trimestre vente par vente (marge × 20/120, perte ⇒ 0 non imputée, sans prix d'achat ⇒ nommée + « Saisir les prix d'achat », « au moins »), export CSV/PDF ; prix d'achat par identité, prix de vente eBay/Vestiaire = prix payé (règle des factures) ; facture en marge sans TVA apparente, refusée sinon AVANT le numéro ; rien pour les autres régimes ; sources CGI/BOFiP « à vérifier » (pages officielles injoignables). `docs/passation/2026-11-11-tva-marge.md`. Geste : aucun (choisir « TVA sur la marge » s'il y est).

- **11 nov. · Achats Leboncoin / eBay / Vestiaire par e-mail (lot `achats-auto`)** : expéditeur OFFICIEL + sujet d'achat ⇒ UNE ligne `achat_email_{site}_{n° de commande}` (n° libellé seul, article/port/protection/total en euros, suivi relié par le n°, annulé/remboursé posés ; jamais par le titre) ; sinon (sans n°, deux n°, total faux, autre devise, e-mail transféré) « à vérifier », rien créé, e-mail gardé entier ; écriture ratée ⇒ 503. Achats → « Achats lus dans tes e-mails » : « Ajouter » / « Compléter » sur SON clic (prix lu marqué e-mail). Formes SUPPOSÉES (aucun vrai e-mail vu). `docs/passation/2026-11-11-achats-auto.md`. Geste : transférer un premier e-mail d'achat de chaque site à son adresse VRM.

- **11 nov. · Accessibilité WCAG 2.1 AA (lot accessibilite)** : bancs `accessibilite` (axe-core 4.14.0 : 17 écrans + 5 feuilles, 390/1512, clair et sombre, rouge sur « serious »/« critical », rôle ARIA, feuille sans nom ; 44 px ; focus rendu) et `accessibilite-clavier` (zoom 200 % : rien de perdu ni coupé ; Tab atteint chaque écran ; focus visible ≥ 3:1), dans la CI, exceptions VIDES ; corrigés : noms = texte visible, contrastes, rôles, feuilles nommées, N° des vignettes du Stock ; contour de focus de la case de sélection en sombre (la règle de `styles-bureau.css` 0,3,1 gagnait). `docs/passation/2026-11-11-accessibilite.md`. Geste : relire à VoiceOver sur iPhone.

- **11 nov. · Intégration extension-2 (5.355.0)** : `claude/integration-extension` (6 chantiers) + `claude/relecture-oauth` (connexions Google/Discord, ext. 5.346, suppression de compte OAuth) réunis par vrais `git merge` sur e4 ; un seul contenu **5.355.0** (aucune publiée, production 5.344.0) ; l'avis négatif est une carte de Ma journée comme les autres (`avis-bas`, cachable, comptée) ; Regrouper en Segmente + seuil d'avis. Branche `claude/integration-extension-2`. Geste : installer 5.355.0.
<!-- Ligne déplacée telle quelle de CLAUDE.md §9 (lot vinted-pro, 11 nov.). -->

- **11 nov. · Comptes Vinted Pro (lot `vinted-pro`)** : Pro seulement si LU (profil `business`, sinon mention « membre Vinted Pro » d'un e-mail de CE compte ; rien ⇒ « — ») — pastille + une phrase dans Mes comptes, repli « L'argent de tes ventes Pro » (prix des articles, protection acheteurs payée par l'acheteur, commission et reçu SEULEMENT par la ligne du relevé de la vente, sinon « — » ; barème cité « à vérifier », jamais calculé) ; mesuré : liste ≠ prix de l'article sur 56/77 ventes Pro ⇒ le relevé tranche, sinon mise à part et nommée dans le CA déclaré (une vente déjà déclarée garde son mois) ; facture : comptes Pro par profil + e-mail (`src/vintedPro.js`). `docs/passation/2026-11-11-vinted-pro.md`. Geste : ouvrir le porte-monnaie Vinted sur chaque compte Pro.

- **11 nov. · eBay complet (lot `ebay-complet`)** : connexion guidée (étapes dites avant, retour constaté ou erreur traduite + geste, jeton qui expire dit 30 j AVANT + « Reconnecter ») ; « Tous les réglages eBay » (enchères, offres, délai, lieu, retours, politiques — jamais l'expédition —, TVA pro, programmation, sponsorisée éteinte d'origine avec son coût, options payantes) + défauts dans Paramètres → Comptes eBay (`vrm_ebay_publication_defaut`) ; l'app DEMANDE catégorie / caractéristique / état / politique (`src/ebay/parametres.js`, réutilisable) ; remises eBay (période, quantité, fin dite) ; messages eBay dans Messages · Tous ; une annonce sans réglage part au caractère près comme avant. `docs/passation/2026-11-11-ebay-complet.md`. Geste : aucun (reconnecter un compte quand VRM le dit).

- **11 nov. · Publier partout + prix partout (lot `publier-partout`)** : depuis l'annonce Vinted vers Leboncoin, Vestiaire, eBay (fiche ⋯ et Annonces → Actions) ; TOUS les paramètres réglables par défaut (`vrm_partout_params`) puis par annonce, introuvable ⇒ demandé ; un choix que la voie ne porte pas encore ⇒ Leboncoin bloqué et dit, Vestiaire « à finir sur le site » (pas d'extension dans ce lot) ; VRM figé (SuiviTravail fusionné) ; réglages eBay d'ebay-complet nommés ; « Changer le prix » : ajustement par site, eBay relu, Vinted PROPOSÉ (Baisser le prix, son clic). `docs/passation/2026-11-11-publier-partout.md`. Geste : aucun.
## Ligne de CLAUDE.md §9 déplacée telle quelle (11 nov., lot visuels-reseaux)

- **11 nov. · Visuels réseaux (lot `visuels-reseaux`)** : Annonces → « … » → « Visuel réseaux », ou Sélectionner → Actions → « Nouveautés de la semaine » : carré 1080 et story 1080 × 1920 dessinés DANS le navigateur (canvas, sans IA ni serveur), 3 modèles, 5 couleurs, nom de SA boutique (vide par défaut, `vrm_visuels_reglages`) ; photos par le chemin de l'app (`lirePhotoVisuel` : route photo, copie de l'extension, extension — jamais le `<img>` du CDN) ; pas lisible ⇒ dit, jamais une image vide ; jamais N° ni prix d'achat ; Partager (fichiers) ou Télécharger, rien publié. `docs/passation/2026-11-11-visuels-reseaux.md`. Geste : aucun.
## Déplacé de CLAUDE.md §9 (11 nov., lots suivi-travail et import-historique-sites)

## Déplacé de CLAUDE.md §9 (11 nov., lot import-historique-sites)

- **11 nov. · Traduction (fr, en, es, it, de)** : `src/i18n/` (`tr()`, pluriels Intl, formats, chargement à la demande), Paramètres → Langue (`vrm_langue`, SYNC_KEYS) ; migrés : coque, menu du profil, Paramètres (liste), connexion, écrans d'erreur, accueil public ; le reste écran par écran (méthode, ordre) : `docs/passation/2026-11-11-traduction.md`. Geste : aucun.

- **11 nov. · Notifications groupées (lot `notifs-groupees`)** : la 1re sonne, les suivantes (événements par objet) attendent 15 min (réglable : Non · 15 · 30 · 60) puis UN résumé « 2 colis à poster · 1 colis à retirer » (`api/_lib/notif-groupe.js`, passage `?moment=groupe` toutes les 15 min) ; urgent (< 24 h, double vente) tout de suite ; jamais deux fois (objet + jour) ; heures calmes respectées ; **jours calmes** (week-end, jours cochés, congés : seul l'urgent passe, le reste groupé au premier matin non calme) ; colis ⇒ Ventes / Achats, plus jamais `cat_bord` (à intégrer avec DJ3). `docs/passation/2026-11-11-notifs-groupees.md`. Geste : aucun.

- **11 nov. · CI verte (ci-vert)** : rouges de « Vérifier avant fusion » repris sur e2 (bancs de navigation et argent-mois à la règle actuelle, rouges de doublon par `--vrm-doublon`, `_source-app` sans double import, Chrome en dur, icônes, coque) ; installations de navigateur réessayées ; Parcours critiques : garde réseau après le checkout. `docs/passation/2026-11-11-ci-vert.md`. Geste : aucun.

- **11 nov. · Tout au vert (vert-11nov)** : les bancs s'ouvrent en **fr-FR** par défaut (l'app suit la langue du navigateur ; un runner en-US affichait « Today · Listings » : `_garde-reseau.cjs` pose la langue quand le banc n'en pose pas) ; audits portés à `tr()` (`scripts/_tr-fr.cjs` : un libellé se juge dans fr.js par sa clé), à DJ4 (`?tab=trancher` ⇒ Ma journée), journee-perso, impression sans confirmation ; Argent lit `vrm_pro_facture` une fois (`lireReglageMontage`) ; budgets hors de `scripts/bancs/`. Reste `audit-colis-envoi` B (zone Colis, `claude/revue-colis`). `docs/passation/2026-11-11-vert-11nov.md`. Geste : aucun.

- **11 nov. · Vraie base, étape 1** : migration **038** (pas appliquée) : tables typées (annonces, ventes, achats, colis, emails, numeros append-only, comptes sans jeton…), clé = identité, RLS, remplies À CÔTÉ d'`app_data` par déclencheur ; l'app ne les lit pas encore. `audit-tables-typees-sql.cjs`, `2026-11-11-base-tables.md`. Geste : §6 du récit.

## Lignes du §9 de CLAUDE.md déplacées telles quelles le 12 nov. (ecriture-humaine, fusion de main — sous 59 000 octets)

- **11 nov. · Robustesse de l'extension (5.356, second agent, branche `claude/agent2-robustesse-extension`, PAS fusionnée)** : geste seulement depuis l'onglet du DOMAINE du compte, cookie relu au départ de la requête ; moteur d'offres sous verrou (`vrmOffresVerrou`) ; N° réservé par comparer-et-échanger (`modifierLigneCas`), une réservation montrée n'expire plus (fond + app) ; canal PRIVÉ inject.js ↔ content.js (`MessageChannel`), plus de moisson ni de `.click()` dans la page ; délais Supabase ; `garde` refuse un compte illisible. `docs/passation/2026-11-11-robustesse-extension.md`. Geste : aucun avant intégration.
- **11 nov. · Forme Vinted + prudence (ext. 5.357, second agent, branche `claude/agent2-vinted-forme`, CONTIENT la 5.356, PAS fusionnée)** : réponse Vinted d'une forme inattendue ⇒ rien d'écrit, forme rangée sans valeur, ligne ambre « Vinted a changé sa page des ventes… » ; refus de Vinted ⇒ 24 h de prudence (20/h, délais ×2, lectures de fond suspendues sauf codes, jauge « Prudence jusqu'à … ») ; revue : visite sous verrou, `vinted_item_details` bornée (ses annonces seules), `corpsCV` sous `try`. `docs/passation/2026-11-11-vinted-forme.md`. Geste : aucun avant intégration.
- **11 nov. · Restes de la revue de l'extension (ext. 5.361, second agent, branche `claude/agent2-familles-extension`, CONTIENT 5.356 + 5.357, PAS fusionnée)** : refus auto au corps relevé (`reply.body`), place rendue si refusé ; boîte aux lettres du relais adressée à l'onglet, jamais rejouée ; photos : hôtes exacts, 15 max, taille lue avant ; Orion : capteur posé EN LIGNE (canal sûr) sinon « douteux » sans preuve ni état ; familles : rejets notés, alarmes à la bonne période, minuteries de page arrêtées, registres `chrome.storage` bornés, « pas su » au lieu de `[]`. `docs/passation/2026-11-11-familles-extension.md`. Geste : aucun avant intégration.
- **11 nov. · Accueil : le temps gagné (lot temps-gagne)** : calculateur public (5 curseurs ⇒ minutes/semaine, 7 gestes), durées RAISONNÉES justifiées dans `src/accueil/tempsGagne.js`, dit « Estimation », jamais un résultat de client ni « le seul » ; morceau à part. `docs/passation/2026-11-11-temps-gagne.md`. Geste : aucun.
- **11 nov. · Tout l'historique Leboncoin, Vestiaire, eBay (lot import-historique-sites, ext. 5.365)** : eBay par la route (`historique` : fenêtres de 90 j, jusqu'à ce qu'eBay refuse, fusion par `orderId`, commandes sans acheteur ni adresse ; achats : 60 j, dit) ; Leboncoin/Vestiaire par l'extension (modèle de pagination vu sur le site, compte de l'onglet, 12/20 lectures, détails Leboncoin, fusion par n°) ; Paramètres → Mon historique. `docs/passation/2026-11-11-import-historique-sites.md`. Geste : installer 5.365.0, ouvrir « Mes transactions » / « Mes ventes » « Mes achats » et aller page 2 une fois.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (robustesse-extension)


## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (familles-extension)


## Lignes du §9 de CLAUDE.md déplacées telles quelles le 12 nov. (agent2-discretion, fusion d’agent2-ecriture-humaine)


## Ligne du §9 de CLAUDE.md déplacée telle quelle le 12 nov. (agent2-discretion, sous 59 000 octets)

- **11 nov. · Intégration 11nov-f (ext. 5.365.0)** : 14 lots réunis sur vert-11nov (suivi-travail, sante-comptes, photos-comptes, tva-marge, achats-auto, accessibilite, base-tables — 038 pas appliquée, vinted-pro, publier-partout, offres-vc, temps-gagne, visuels-reseaux, import-historique-sites, extension-2) ; rouges croisés corrigés ; barre « VRM travaille » = fait/total une fois fini ; `--vrm-card` ⇒ `--vrm-surface`. `docs/passation/2026-11-11-integration-11nov-f.md`. Geste : installer 5.365.0.
- **12 nov. · Moyennes de la revue extension (5.362, second agent, `claude/agent2-extension-moyennes`, CONTIENT 5.356+5.357+5.361, PAS fusionnée)** : places d'actions justes, lectures et moisson plafonnées au compte, file Vinted à durée max, canal privé des ordres Leboncoin, popup encadré seulement par un site permis. `docs/passation/2026-11-11-extension-moyennes.md`. Geste : aucun.
- **12 nov. · Temps d'écriture + messages variés (ext. 5.369, second agent, `claude/agent2-ecriture-humaine`, CONTIENT `agent2-extension-moyennes`, PAS fusionnée)** : avant chaque envoi automatique, le temps de le taper puis l'envoi d'un coup (jamais de touche) ; jusqu'à 5 versions écrites par lui, jamais la même deux fois de suite. `docs/passation/2026-11-12-ecriture-humaine.md`. Geste : écrire ses versions (Offres auto, Favoris → Message).
- **12 nov. · Discrétion (ext. 5.370, second agent, `claude/agent2-discretion`, CONTIENT `agent2-ecriture-humaine`, PAS fusionnée)** : plafond du jour, rythme, attente après l'ouverture, un compte à la fois, compte neuf en douceur, arrêt sur captcha / modération / déconnexion + « Reprendre », « Tout arrêter », 15/h favoris et offres, Republier par groupes, baisses variées et étalées, relecture « seulement le nouveau », freins 7 j dans la Santé des comptes ; l'icône ouvre VRM dans un onglet. `docs/passation/2026-11-12-discretion.md`. Geste : installer 5.370.0.
## Lignes du §9 de CLAUDE.md déplacées telles quelles le 11 nov. (intégration E3 dans revue-colis, taille)

- **11 nov. · Ventes et Achats sobres (lot `ventes-achats-visuel`)** : un seul bleu plein par écran (« Tout imprimer ») ; le bordereau d'une vente = petite action grise « 🖨 Imprimer » (44 px au doigt, 36 px à la souris) + logo 20 px ; frise FINE (3 px, l'étape actuelle nommée une fois « Vendue · 9 nov. », passées neutres, bleu = actuelle, ambre = geste dû, noms lus par VoiceOver) ; Ventes à l'ordinateur en grille alignée (photo 56 · N° + titre · état + frise · prix · bénéfice, en-tête des colonnes une fois, plus de « Bénéf. »/« Achat »/« à saisir » par ligne : « 4 prix d'achat à saisir » en tête) · `docs/passation/2026-11-11-ventes-achats-visuel.md` · geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (intégration journee-perso dans revue-colis, taille)

- **11 nov. · Retraits fiables (lot `retraits-fiables`)** : cause du « tout à Super U » = les listes « Points de proximité » des e-mails (le 1er en-tête lu) — ignorées (`sansSuggestions`), le point de CE colis seul ; identité d'un point = nom + CP + rue, nom seul jamais fondu, plus de complétion par nom ; code lisible sur la ligne, point changé avec SON code, « pas confirmé depuis » > 48 h · `2026-11-11-retraits-fiables.md` · geste : aucun.

- **11 nov. · Colis à leur place (lot DJ3)** : plus d'onglet Colis — « À expédier » (À envoyer · Envoyés, bordereaux, Tout imprimer, Je dépose…) en tête de **Ventes**, « À retirer » (points, codes, Mode relais, outils) en tête d'**Achats** (barre : Journée · Annonces · Ventes · Achats · Plus) ; mêmes composants (`colisDans`), anciens chemins par `src/colisPlace.js` ; « InPost » = réseau Mondial Relay ⇒ logo Mondial Relay (bordereau, e-mail, clé rangée) ; codes des e-mails : 0 non affiché pour un colis au point (mesuré) ; « Tout imprimer » ne propose plus une paire DÉPOSÉE (le n° de SON étiquette + l'e-mail de dépôt prouvent, `bordsAvecEtiquettes`) et se fait en 3 temps (choisir · aperçu A4 · « C'est imprimé ? » ⇒ Je dépose) ; logos relevés sur de vrais bordereaux (Mondial Relay framboise, cube Chronopost = Shop2Shop) ; titres entiers ; plus de « g c », `?tab=colis` ⇒ Ventes. `docs/passation/2026-11-11-colis-a-leur-place.md`. Geste : aucun.

- **11 nov. · Suivi des commandes en cours (lot `suivi-commandes`)** : Ventes · Envoyés et Achats en route : n° copiable, « Suivre ↗ », dernier statut lu (source, heure) ; incohérences PROUVÉES en ambre, une phrase + un geste ; Ma journée « N commandes à vérifier » ; colis vendus (`depart_`, jamais `transp_`) relus toutes les 6 h jusqu'à la livraison, Mondial Relay vendu jamais (CP de l'acheteur) (`api/_lib/suivi-commandes.js`). `docs/passation/2026-11-11-suivi-commandes.md`. Geste : aucun.

## Lignes du §9 de CLAUDE.md déplacées telles quelles le 11 nov. (lot thermique, taille)



- **11 nov. · Revue adverse + intégration du paquet colis** (`claude/revue-colis`) : 3 défauts corrigés (« Tout imprimer » avalé par Achats caché, Achats · eBay montrait les colis Vinted, écran blanc Leboncoin) ; fusion `integration-11nov-e2` + `ventes-achats-visuel` ; outils de retrait filtrés par site, emplacement sous chaque paire de « Tout imprimer », code d'un point changé seulement s'il est d'après le changement ; bancs du lot DJ3 portés, prouvés par mutation. `docs/passation/2026-11-11-revue-colis.md`. Geste : aucun.

- **11 nov. · Bordereaux thermiques personnalisables (lot thermique)** : Paramètres → Impression des bordereaux (`vrm_impression`, SYNC_KEYS) : papier 10×15/4×6, 10×10, Dymo 4XL, Brother 62 mm, autre l × h ; une étiquette par page, recadrée, jamais rognée ni déformée, noir pur ; tampon N° seul (défaut thermique : le titre se verrait du transporteur) · + titre · + taille · rien, jamais sur un code ni une adresse, sinon fiche de préparation DANS le colis ; aperçu sur un bordereau inventé ; « Changer » dans Tout imprimer. `docs/passation/2026-11-11-thermique.md`. Geste : choisir son papier.

- **11 nov. · Retours et litiges (lot `retours-litiges`)** : e-mail « Bordereau de retour » rangé par SON n° (`email_bordretour_{tx}`, PDF entier, limite heure de Paris ; illisible ⇒ « à vérifier ») ; Achats → « Retours » (N° par l'achat, « À déposer avant le … », suivi, remboursé PROUVÉ par `email_rembachat_{tx}` sinon « Pas encore remboursé ») + « Imprimer le bordereau » tamponné « RETOUR · N°… », aussi dans « Tout imprimer » ; Litiges → « Pas à pas » (délais avec leur source, dossier PDF, « Paire revenue » = SON N°, contester) ; achat remboursé prouvé ⇒ hors des coûts. `docs/passation/2026-11-11-retours-litiges.md`. Geste : aucun.

- **11 nov. · Toute l'app hors ligne (lot `hors-ligne`)** : hors ligne, chaque écran se lit depuis la copie de l'appareil (« Hors ligne · vu à hh:mm ») ; les gestes sûrs (retiré, colis fait, déposé, prix, notes, rappel, nouvel achat photo comprise, N° à la main, « C'est écrit ») vont dans une file IndexedDB par compte (`src/gestesHorsLigne.js`), rejouée un par un sur `data.rev`, jamais deux fois (`vrm_gestes_faits`) ; changé ailleurs ⇒ « à trancher » avec les deux versions ; extension, paiement, N° neuf, suppression refusés et dits ; banc `gestes-hors-ligne` (réseau coupé). `docs/passation/2026-11-11-hors-ligne.md`. Geste : aucun.

- **11 nov. · Gros lot à l'achat (lot `gros-lot`)** : « Nouvel achat » → « Un lot » : prix total + frais, N articles, coût réparti à SON choix (parts égales · prix visé · à la main, cases vides = le reste), juste au centime (plus grand reste de `venteLot.js`, le reste dit et placé) ; N fiches « À publier » (titre, taille, photo facultative), N° consécutifs relus et réservés au pool (ou tapés, refusés s'ils ont servi) ; UN achat relié à ses N fiches, N coûts par N° ; annulable 5 s (les N° restent au pool). `src/grosLot.js`, `docs/passation/2026-11-11-gros-lot.md`. Geste : aucun.
## Ligne retirée de CLAUDE.md §9 le 11 nov. (taille)

- **11 nov. · Ranger un achat à son arrivée (lot rangement-guide)** : « J'ai retiré » (colis ou commande, achat par identité ; au comptoir après le scanner / mode relais) ⇒ feuille « Ranger cet achat » : photo, prochain N° (`prochainLibre`, servis relus, jamais un trou ; « Je numérote moi-même » ⇒ tapé, servi/archive refusés), case libre à la suite de sa dernière (meuble · niveau · case, gravité respectée, une autre d'un toucher), fiche pré-remplie (prix LU, lot = N lignes sans prix divisé), UN « Rangé » ⇒ fiche à publier liée au n° de transaction + case + coût, annulable 5 s ; le N° montré entre au pool et y RESTE après « Annuler » ; plusieurs ⇒ Ma journée « N achats à ranger ». `docs/passation/2026-11-11-rangement-guide.md`. Geste : aucun.
## Déplacé de CLAUDE.md §9 (11 nov., lot livre-registre)

- **11 nov. · Livre des recettes et registre des achats complets (lot `livre-registre`)** : Argent → Déclarer → Registres → « Voir » : par mois, filtrable, client (facture Pro › pseudo › « Particulier »), fournisseur, nature, règlement (espèces à part), pièce (facture, ticket, reçu par SON n°, référence) ; manques nommés ; PDF · CSV · Excel horodatés ; sources (CGI 50-0, L./D. 123-205-1, BOFiP, F36018) **à vérifier** (pas ouvertes) (`src/registresConformes.js`). `docs/passation/2026-11-11-livre-registre.md`. Geste : relire les sources.
## Ligne déplacée de CLAUDE.md §9 (11 nov., lot anti-arnaque)

- **11 nov. · Alerte arnaque dans les messages (lot `anti-arnaque`)** : sans IA (`src/antiArnaque.js`, 8 motifs : code SMS, faux « paiement bloqué », faux site, lien raccourci, paiement hors plateforme, « envoie d'abord », « mon transporteur », WhatsApp/e-mail/06) ; seuls les messages PROUVÉS de l'autre ; bannière ambre + geste + « Signale-le sur… » dans les fils Vinted, Leboncoin, Vestiaire, eBay, Tous ; compteur discret ; aucune action. `docs/passation/2026-11-11-anti-arnaque.md`. Geste : aucun.

- **11 nov. · Messages aux favoris en trois temps (lot `favoris-clair`)** : Qui (annonces, NOMBRE de personnes, jamais qui ; nouveaux favoris depuis le dernier envoi par défaut) · Quoi (message + offre, aperçu tel que l'acheteur le verra, « son pseudo » en pastille) · Quand (comme Vintex / espacé, mode auto) ; récap « 5 messages · 3 annonces · environ 32 s · 15 gestes dans la limite de 45/h », marge avec SON prix d'achat (à perte / sous le mini ⇒ bloqué sauf « Je confirme ») ; suivi par la feuille commune « VRM travaille » ; historique « acheté après un message » par annonce ET personne ; « Ce qui marche » ; offre groupée dite « à faire sur Vinted » ; carte Ma journée « N annonces ont de nouveaux favoris ». Aucun nombre fixe de messages par envoi (seule borne : les 45 gestes de l'heure ; au-delà la file attend une place, `quota_extension` sans écriture) ; « Plus d'outils » sans pseudos. `docs/passation/2026-11-11-favoris-clair.md`. Geste : aucun.

- **11 nov. · Prix mini manquants (lot prix-mini)** : Messages · Vinted → Favoris & offres → Offres auto refait (la règle en trois lignes, titres 20/700, tout par `tr()`) ; sous l'interrupteur, les annonces EN LIGNE sans « Accepter dès » lu par le moteur (photo, N°, prix, achat relié, bénéfice à SON prix) et la saisie en série (clavier décimal, Entrée = suivante, « Sous ton coût » achat + frais redemandé, UN « Enregistrer » ⇒ `poserSeuils`) ; jamais un mini proposé ; Ma journée « N annonces sans prix mini » seulement allumée ; « Régler par paire » ouvre enfin Vinted (`cat_msg`), pas le fil « Tous ». `docs/passation/2026-11-11-prix-mini.md`. Geste : aucun.
## Déplacé de CLAUDE.md §9 (11 nov., lot quoi-republier, tel quel)

- **11 nov. · « Quelles annonces republier ? » (lot `quoi-republier`)** : en tête d'Annonces → Republier et de « Republier sur Leboncoin », les annonces anciennes (`articlesQuiDorment`) ET peu vues ET peu mises en favori (plafonds réglables, chiffres LUS ; un compteur pas lu ⇒ « à vérifier » à part, jamais mêlé), une raison par ligne (« 95 j en ligne · 0 favori · 10 vues ») ; un toucher COCHE dans l'atelier, c'est lui qui lance ; Ma journée : une ligne s'il y en a (carte `republier`, cachable). `src/quoiRepublier.js`, `docs/passation/2026-11-11-quoi-republier.md`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (11 nov., lot pas-en-ligne)

- **11 nov. · Achetés, pas en ligne (lot `pas-en-ligne`)** : les articles achetés/rangés depuis plus de 7·14·30·60 j (réglable) sur AUCUN site, PROUVÉS (`src/pasEnLigne.js`) : par SON N° (achat hors plateforme, stock importé) ou SON achat Vinted relié, jamais le titre ; seulement si chaque compte/site est relu en entier < 24 h et qu'aucune annonce sans N° (ou pas reliée à un achat) ne peut être lui — sinon « à confirmer », jamais compté, le manque nommé (« compte_beta pas relu depuis 3 j ») ; carte Ma journée seulement s'il y en a, entrée sur Achats ; « Créer sur Vinted » attend `annonce-vinted` (le geste ouvre l'achat). `docs/passation/2026-11-11-pas-en-ligne.md`. Geste : relier ses annonces à leurs achats (10 sur 564 le sont).

- **11 nov. · Alertes d'achat eBay (lot `alertes-ebay`, eBay SEULEMENT)** : « Me prévenir » sur une recherche du fil (`veille.alerte`, son prix de revente facultatif) ; le serveur relit chaque heure (`ship-reminders?moment=alertes`, GitHub ; Browse, jeton d'APPLICATION ; 4/h/vendeur, part auto fil + alertes ≤ 150, mêmes critères = 1 appel) ; nouvelle annonce = `itemId` jamais signalé, 1re lecture muette ; une notification « Alertes d'achat eBay » (heures calmes) + liste dans eBay → Achats avec la marge POSSIBLE (calculette : son prix sinon médiane de ses ventes du modèle), jamais un verdict, aucun achat. État `ebay_tokens_alertes` (serveur seul). `docs/passation/2026-11-11-alertes-ebay.md`. Geste : aucun.

- **11 nov. · Revue adverse + intégration du paquet colis** (`claude/revue-colis`) : 3 défauts corrigés (« Tout imprimer » avalé par Achats caché, Achats · eBay montrait les colis Vinted, écran blanc Leboncoin) ; fusions e2, ventes-achats-visuel, e3, `main`, `journee-perso` (À retirer : plus de carte, code + n° écrits, Itinéraire vers l'adresse LUE seulement) ; Ventes : logo du transporteur connu au même endroit sur chaque ligne, plus de vide sous la frise, envoi prouvé ⇒ plus de bordereau (banc `ventes-achats-visuel` L/V/P). `docs/passation/2026-11-11-revue-colis.md`. Geste : aucun.
## Lignes de CLAUDE.md §9 déplacées telles quelles (11 nov., lbc-rouges)
> Ligne déplacée telle quelle de CLAUDE.md §9 le 11 nov. (lot vestiaire-plus, taille du fichier) :
## Déplacé de CLAUDE.md §9 (11 nov., lot republier-programme), tel quel

## Lignes de CLAUDE.md §9 déplacées telles quelles (12 nov., intégration 11nov-g2, taille)

- **11 nov. · Republier à SON heure + historique par annonce (lot `republier-programme`, ext. 5.368)** : dans l'atelier, « Programmer… » (après « Je confirme ») : SON heure, SES paires, ordre et réglages figés ; une seule par compte, Modifier / Annuler (carte d'Annonces) ; à l'heure (fenêtre 10 min, jamais rattrapée), sur l'appareil dont l'extension voit CE compte : onglet vinted.fr, extension, 50/h, frein, quota du jour, aucun autre travail — un manque ou « pas su » ⇒ RIEN ne part, « pas partie » + notification ; départ pris par UN appareil (comparer-et-échanger, `vrm_repub_programme`) ⇒ l'atelier part, feuille « VRM travaille ». Historique : « republiée 3 fois · dernière il y a 12 j · +4 favoris » (atelier, fiche), par identité (`recreeDe`, extension, `vrm_repub_journal`), jamais par titre. `docs/passation/2026-11-11-republier-programme.md`. Geste : installer 5.368.0.
- **11 nov. · Créer sur Vinted depuis une fiche (lot `annonce-vinted`, ext. 5.367)** : Annonces → « À publier » : « Créer sur Vinted » (une fiche ou plusieurs cochées) ⇒ photos ajoutées dans VRM, compte de l'onglet affiché, confirmé, suivi par `lancerTravail` ; l'extension prépare UN BROUILLON (jamais en ligne) ; catégorie/taille/état/couleur/marque posées seulement au libellé exact de Vinted, sinon DEMANDÉES (recherche dans le catalogue, « je choisirai sur Vinted ») ; N° en bas de la description si « je numérote moi-même », sinon l'étiquette réglée ; « Publier » depuis la fiche (`publierBrouillon`). `docs/passation/2026-11-11-annonce-vinted.md`. Geste : installer 5.367.0.
- **11 nov. · Sécurité des comptes Vinted ET Vestiaire (lot securite-vinted, ext. 5.366)** : une règle (`src/securiteComptes.js`, recopiée dans l'extension) AVANT le 50/h inchangé : repos de nuit PAR COMPTE (23 h → 8 h, ±9 min chaque jour, réveil étalé), plafond/jour optionnel et par type/heure, pas de rafale, délais jamais ronds, prudence au 1er refus (Retry-After respecté), arrêt net sur contrôle anti-robot (DataDome/captcha) jusqu'à une lecture normale, « si tu es là » (30 min), journée calme, rodage d'un compte récent lu, « Tout arrêter » (VRM + carte) ; Paramètres → Mes comptes → Sécurité des comptes (une phrase par compte, tableau du journal). `docs/passation/2026-11-11-securite-vinted.md`. Geste : installer 5.366.0.
- **11 nov. · Vestiaire plus (ext. 5.364)** : récapitulatif d'une vente « Chez Vestiaire » (envoyé → arrivé → authentification → validé/refusé → payé, chaque étape LUE dans `etapesVc`, « pas su » dit ; l'argent : versé ⇒ mois du CA, estimé ⇒ hors CA) ; « Photos Vestiaire » avant « Préparer » (manque : étiquette, nombre ; le reste « à vérifier ») ; « Baisser des prix » appris de SON geste (sinon « Fais-le une fois à la main ») ; offres Vestiaire dans Ma journée (expire le plus tôt d'abord, « Répondre » ⇒ Messages · Vestiaire, plus Annonces). `docs/passation/2026-11-11-vestiaire-plus.md`. Geste : installer 5.364.0, changer UNE fois un prix à la main sur Vestiaire.
- **11 nov. · Leboncoin : 6 bancs rouges remis à la règle (lot `lbc-rouges`)** : aucun défaut de l'app ; bancs qui servaient sans `id=in.` (Leboncoin « pas relié » ⇒ Vinted), jugeaient « Lecture en cours… », une opacité en animation, un ancien libellé, la règle du 22 oct. remplacée le 9 nov. (`lbcIdentiteSortie`) ; app : `data-favoris-lbc-qui`. `docs/passation/2026-11-11-lbc-rouges.md`. Geste : aucun.
- **11 nov. · Leboncoin + (lot `lbc-plus`, ext. 5.363)** : « Baisser le prix » en série (proposées : 0 favori en 30 j, −5 %) sur son clic, requête APPRISE de son propre changement de prix, prix lu avant / RELU après, 45/h, compte de l'onglet (`lbcprix`) ; remise en main propre (jour, heure, lieu, rappel 1 h avant au passage de 15 min, « Remis » ⇒ stock par identité + `vrm_lbc_dates`) ; Republier Leboncoin comme Vinted (ordre, espacement, extension ou à la main, coffre d'abord, relecture, une fois / 30 j réglable) ; revue Leboncoin (tableau dans le récit). `docs/passation/2026-11-11-lbc-plus.md`. Geste : installer 5.363.0, puis changer UN prix à la main sur leboncoin.fr.
- **12 nov. · Intégration 11nov-g1 (ext. 5.365.0 inchangée)** : 14 lots réunis sur 11nov-f (revue-colis, thermique, retours-litiges, hors-ligne, gros-lot, rangement-guide, livre-registre, anti-arnaque, favoris-clair, prix-mini, quoi-republier, pas-en-ligne, alertes-ebay, ebay-rouges) ; un gros lot reçoit ses cases en série (règle du rangement guidé) ; Messages : « Lire mes messages eBay » ne vide plus toutes les lectures (`vrmEcritLignes`) ; vocabulaire « article » étendu aux textes neufs. `docs/passation/2026-11-12-integration-11nov-g1.md`. Geste : aucun.
- **11 nov. · Bordereaux, transporteurs, retraits** : feuille « Bordereaux à imprimer » allégée (plus de case « Contrôlé » ni de confirmation) ; InPost = Mondial Relay ; étiquette InPost/MR lue par son code « 56… » (n° MR) ; logo Chronopost = celui des bordereaux ; un achat que Vinted dit encore au point relais reste « à retirer ». `2026-11-11-bordereaux-transporteurs-retraits.md`. Geste : vérifier À retirer après fusion.





## Ligne du §9 de CLAUDE.md déplacée telle quelle le 11 nov. (agent2-ventes-vestiaire)



## Déplacé tel quel de CLAUDE.md §9 (12 nov., intégration — fichier sous 59 000 octets)

- **12 nov. · Intégration 11nov-g2 (ext. 5.368.0)** : sur 11nov-g1, réunis lbc-rouges (+ lbc-plus 5.363), vestiaire-plus (5.364), securite-vinted (5.366), annonce-vinted (5.367), republier-programme (5.368) ; sécurité des comptes branchée sur les gestes neufs (baisse Vestiaire et Leboncoin, republication Leboncoin, présence leboncoin.fr, Créer sur Vinted, départ programmé = mode `programme`) ; « Créer sur Vinted » depuis À publier (fiches rangées, gros lot) et en série depuis « Achetés, pas en ligne » (champs manquants tapés). Les lignes de ces lots : `historique-divers.md`. `docs/passation/2026-11-12-integration-11nov-g2.md`. Geste : installer 5.368.0.

## Déplacé tel quel de CLAUDE.md §9 (12 nov., intégration 12nov-a — fichier sous 59 000 octets)

- **12 nov. · Conseil de baisse mesuré (second agent, contient agent2-revue-fin)** : le « X € conseillé » devient « Baisser à 92 € ? · en ligne depuis 45 j · 3 favoris » — 30 j en ligne (âge lu), −10 % max à l'euro, une proposition tous les 14 j (baisse lue ou proposée, `vrm_conseil_prix`), jamais sous achat + 10 %, achat inconnu ⇒ rien ; fiche et repricing (et eBay en proportion) = une règle `src/conseilPrix.js`, `audit-conseil-mesure`. `docs/passation/2026-11-12-conseil-mesure.md`. Geste : aucun.
- **12 nov. · Fin de la revue de robustesse (second agent, contient familles-serveur, serveur-migrations, familles-app, robustesse-metier)** : serveur M54 frein des sessions en base, M75 dernier n° de facture abandonné repris (jamais deviné), M78 verrou des actions eBay, M79 plafond du bilan dans le contexte, M92 relances lues en lot, B113/B114/B135/B137/B138/B143 ; app : 18 « prix Vinted absent ⇒ 0 » → 0, facture sans prix refusée, case de carte partielle « au moins » (Vendu · mois Leboncoin), stockage nu 15 → 4, n° de facture saisie réservé en base (deux appareils), `audit-benefice` vert. `audit-revue-fin --prouve`. `docs/passation/2026-11-12-revue-fin.md`. Geste : aucun.
- **11 nov. · Serveur : migration 042 et écritures atomiques (second agent, contient familles-serveur)** : M50 relier un compte Vinted sous verrou (`vrm_vinted_relier`, le second reçoit « déjà relié ») ; M72 envoi léger des commandes par squelette (`vrm_commandes_lire`/`_ecrire`, plus de liste entière relue) ; H18 statut Stripe en PATCH conditionnel ; H14 bail du cron (`cron_bail_{moment}`) ; M82 favoris projetés ; H28 eBay relit la version seule. 042 absente ⇒ chemin d'avant. `docs/passation/2026-11-11-serveur-migrations.md`. Geste : coller essai, 042, vérification.
- **11 nov. · Serveur par familles (second agent)** : chaque appel sortant a un délai (`fetchAvecDelai`, aucun `fetch` nu dans `api/`) ; lectures `Range` finies à un 416 de frontière, « pas su » au plafond, pagination par clé ; comparer-et-échanger unique (`api/_lib/cas.js` : journal e-mails, mémos du cron réservés AVANT l'envoi, relances, avoir, `rev` chaîne) ; « pas su » ≠ « rien » (compte de l'e-mail, vinted-pris, essai) ; clés de ligne e-mail 64 bits (vente = transaction, anciennes relues) ; gardien `audit-familles-serveur --prouve`. `docs/passation/2026-11-11-familles-serveur.md`. Geste : aucun.
- **11 nov. · Familles de défauts de l'app (second agent)** : moyens/bas réglés par FAMILLE, une règle + un audit gardien chacune — dates à l'heure de Paris (`src/dateParis.js`), « pas su » ≠ 0 (`src/sommeConnue.js`), deux N° par `cleNum`, une règle par notion (Trésorerie « En attente » = argent à venir ; bénéfice Leboncoin/Vestiaire = `beneficePaire`), stockage protégé (`src/stockageSur.js`) ; gardiens `audit-dates-paris`, `-pas-su`, `-numeros-clenum`, `-une-regle`, `-stockage-sur` (rouges sur main, `--prouve`). `docs/passation/2026-11-11-familles-app.md`. Geste : aucun.
- **11 nov. · Robustesse métier (second agent)** : identité seulement pour « Synchroniser les ventes » de l'inventaire (sinon proposition, son clic) et le retrait d'« En ligne » par e-mail ; Vestiaire raté bloque « J'ai déclaré ce mois » ; tout N° d'achat réservé ; factures jamais renumérotées ; achat inconnu = « — » ; garde anti double vente sur « Accepter » à la main ; plus de prix conseillé à la mise en ligne ni de bénéfice rouge. `docs/passation/2026-11-11-robustesse-metier.md`. Geste : aucun.
- **12 nov. · Données, la suite (second agent)** : `push_prefs`, `vrm_pro_facture` écrits PAR DIFFÉRENCE (`ecrireDifference`), `ebay_brouillons` (projeté) et `studio_photos` par comparer-et-échanger ; sauvegardes en attente vidées à la fermeture (`pagehide`, page masquée, `keepalive`) ; session renouvelée passée aux onglets par IndexedDB (l'ancien jeton revenait 1 fois sur 3) ; un prix = « 1 changement » ; autre devise écartée et dite (porte-monnaie, dépensé). `docs/passation/2026-11-12-donnees-suite.md`. Geste : aucun.
- **11 nov. · Robustesse des données (second agent)** : « Se déconnecter » dit les changements pas envoyés (« Envoyer d'abord ») puis RECHARGE la page (aucun cache du vendeur parti) ; un seul onglet renouvelle le jeton (verrou, adoption) ; `vinted_lbc_posted` pas lu ⇒ rien publié au logo, file Leboncoin « — » ; achat jamais écarté par le titre ; `vrm_room`, `vrm_email_owners` par comparer-et-échanger (`src/ligneCas.js`), listes à `id` fusionnées par id ; relais : page ratée ⇒ « pas su » ; `fetchHarvest` pas su = `undefined` (jamais le relais) ; `lireTout` ne lève plus. `docs/passation/2026-11-11-robustesse-donnees.md`. Geste : aucun.
- **11 nov. · Lignes floutées regroupées par compte** : compte regardé d'abord (« Compte choisi » / « ouvert dans Chrome » : X · N), autres comptes repliés ; suit le flou ; pas su ⇒ comme avant. `docs/passation/2026-11-11-regroupe-comptes.md`. Geste : aucun.
- **11 nov. · Carré sur la photo · frais Vestiaire (second agent)** : la case de sélection ne dessine plus rien sur la photo au repos ; survol / sélection ouverte ⇒ rond iOS dans le coin (banc `case-photo`) ; Vestiaire : « Prix · Frais Vestiaire (%) · Pour toi » LUS (`fraisVc` = prix − versé ; sinon « frais pas lus »), ligne, fiche et Frais par site (bénéfice inchangé, déjà au versé). `docs/passation/2026-11-11-ventes-vestiaire.md`. Geste : 5.364 (vestiaire-plus).
- **11 nov. · Temps réel (second agent, `claude/agent2-temps-reel`)** : ce que l'extension capte (n'importe quel navigateur) arrive sans recharger en ≤ 25 s — veille des VERSIONS des lignes du vendeur (scalaires, `owner=eq.`, 10 min, onglet visible, rythme commun), signal `vrm:neuf` ⇒ l'écran relit la seule ligne changée (ventes, achats, annonces, suivi, jauge, import) ; ≤ 1 relecture/ligne/10 s ; lecture ratée ⇒ rien ; pastille flottante « Mis à jour à hh:mm ». Realtime prêt (migration 040, diffusion privée id + version, jamais `data`) mais PAS appliqué. `docs/passation/2026-11-11-temps-reel.md`. Geste : migration 040 (facultative).
- **11 nov. · Veille (second agent, `claude/agent2-veille`)** : chiffre qui chute sans raison (stock, CA/ventes d'un mois passé) ⇒ carte ambre dans Ma journée + notification (`src/veilleChiffres.js`, ligne `vrm_veille_chiffres`, jamais sur un « pas su ») ; contrôle de nuit en lecture seule (N° en double en ligne, versement > 30 j, comptes > 48 h, quarantaine, Stripe) ⇒ « Tout est en ordre ✓ » ou chaque problème ; plantages : 20/h, vue propriétaire triée par comptes touchés. `docs/passation/2026-11-11-veille.md`. Geste : aucun.
- **11 nov. · Cloisonnement (agent2)** : `audit-cloisonnement` exécute chaque route `api/` (2 vendeurs, base à RLS, usurpation, `in.()`, jeton forgé) : 0 trou ; banc onglet A→B ; Réglages (propriétaire) → « Simuler une création de compte » ; `verif-prod` après mise en ligne. `docs/passation/2026-11-11-cloisonnement.md`. Geste : compte démo + 2 secrets.
- **11 nov. · Limites par client (second agent)** : un client de 5 000 annonces / 20 000 ventes ne ralentit plus les autres — Annonces par paquets de 72 (« 72 sur 5 000 », la suite en descendant, recherche sur tout ; DOM 451 021 → 6 992), cron : temps d'un vendeur borné à 60 s (reporté, repris, jamais « fait »), 416 à la frontière = fin de liste (widget à 1 000 e-mails de vente en panne), 429 propre par vendeur (widget, envoi léger), usage par vendeur dans « Ton entreprise ». `docs/passation/2026-11-11-limites-client.md`. Geste : appliquer la migration 041 (lecture seule).
- **11 nov. · Saisie rapide** : vente PROUVÉE sans prix d'achat ⇒ notification une fois (jamais la nuit) + carte Ma journée + feuille à un champ ; « Vendu ailleurs » sur la fiche (dans CA, bénéfice, URSSAF ; jamais en double) ; « vendues en octobre » (voix ou frappe) ; cron et bilans serveur aussi. `docs/passation/2026-11-11-saisie-rapide.md`. Geste : aucun.
- **11 nov. · Prévision du mois, coût par site, parrainage (second agent)** : « À ce rythme, novembre finira vers … » (rythme réel des ventes prouvées, fourchette, « pas encore su » < 5 jours, bénéfice brut seulement si prix d'achat ≥ 80 %, `src/previsionMois.js`) dans Statistiques + une ligne de Ma journée ; « Frais par site » ⇄ « Mois par mois » (`src/coutPlateformes.js`, source de chaque montant, eBay étiquette = acheteur) ; parrainage : lien `vrm.center/r/CODE`, « N personnes venues par toi · M abonnées », mode test dit, pas d'auto-parrainage par la même carte (037). `docs/passation/2026-11-11-argent-parrainage.md`. Geste : passer la 037, relire la phrase CGV, Stripe (`invoice.paid`).
- **11 nov. · Messages plus récent en haut, fiable, plus simple (agent2-messages)** : toutes les vues par horodatage (`src/ordreConversations.js` sur `ordreRecent`), compte de l'onglet en tête seul groupe dit, sans date en bas et dit ; doublons de boîte retirés (30 mesurés) ; envoi « Envoi… → Envoyé ✓ / Pas envoyé · Réessayer » ; réponses rapides une entrée ; « Proposer un prix » replié ; fiche avec le fil. `docs/passation/2026-11-11-messages.md`. Geste : aucun.
- **12 nov. · Messages Leboncoin, Vestiaire, eBay comme Vinted** : envoi vu dans le fil (`src/envoiFil.js`, règles d'envoi inchangées), fil vide = « pas encore lu · Relire », lecture ratée = « Réessayer », doublons eBay fondus, offre Vestiaire dans sa conversation. `docs/passation/2026-11-12-messages-sites.md`. Geste : aucun.
- **12 nov. · Sécurité des comptes (second agent)** : mots qui font bannir (`src/messageSur.js`) — message à la main ⇒ ambre + « Envoyer quand même », automatique (favoris, refus auto) ⇒ jamais envoyé, annonce ⇒ ligne de « vérifier avant » ; « Copie de mes annonces » (zip par compte, dans le navigateur) ; carte « Protège ton compte VRM » ; aucun jeton Vinted vers la page (proxy, connect, liste projetée). `docs/passation/2026-11-12-securite-comptes.md`. Geste : aucun.
- **12 nov. · Intégration 11nov-g2 (ext. 5.368.0)** : Leboncoin, Vestiaire, sécurité des comptes, Créer sur Vinted, republication programmée. Détail : `historique-divers.md` (déplacé tel quel) et `2026-11-12-integration-11nov-g2.md`. Geste : installer 5.368.0.

## Déplacé tel quel de CLAUDE.md §9 (12 nov., intégration 12nov-b)

- **12 nov. · Ouverture aux clients (second agent, `agent2-ouverture-clients`)** : Réglages → « Ouvrir les paiements » (propriétaire seul, 10 prérequis LUS : clé, webhook relu chez Stripe + 5 événements, prix Solo/Pro, mentions, contact, CGV, accueil Pro, mode réel) ; banc paiement de bout en bout (Stripe simulé, vraie route) ; compte neuf + abonnement obligatoire = « Bienvenue », plus « a pris fin » ; export RGPD complet côté serveur (`mode=mes-donnees`) ; « Réponds-moi par e-mail » + FAQ 10 questions. Guide `2026-11-12-guide-paiement-julien.md`, récit `2026-11-12-ouverture-clients.md`. Geste : les 9 champs d’`editeur.js`, prix Stripe + `STRIPE_SECRET_KEY`/`STRIPE_PRIX_PRO`, puis mode réel.
- **12 nov. · Fiabilité prod (agent2)** : export chiffré par vendeur chaque soir (seau Storage privé `sauvegardes`, 14 j, restauration prouvée sur Postgres jetable) ; `/api/sante` ne dit la configuration qu'au propriétaire ; base d'essai `vrm-essai` (31 migrations, Preview via `VITE_SUPABASE_URL`) ; surveillance 5 min (issue = e-mail) ; « Revenir à la version d'avant ». Mesuré : la copie GitHub n'a jamais tourné. `docs/passation/2026-11-12-fiabilite-prod.md`. Geste : `docs/passation/2026-11-12-guide-fiabilite-julien.md` (secrets de sauvegarde, UptimeRobot, vrm-essai).
- **12 nov. · Facture au téléphone (second agent)** : l'aperçu de « Envoyer la facture » est une miniature (facture à 520 px, réduite pour tenir, toucher ⇒ PDF en grand) ; tableau à largeurs fixes (plus de « Désignation » à une lettre par ligne) ; boîte choisie mais pas connectée ⇒ « Envoyer avec VRM » (`via:'vrm'`, son clic, réglage inchangé). `docs/passation/2026-11-12-facture-mobile.md`. Geste : aucun.
## Déplacé tel quel de CLAUDE.md §9 (12 nov., intégration 12nov-a — fichier sous 59 000 octets)
## Déplacé tel quel de CLAUDE.md §9 (12 nov., finitions 2e passe — fichier sous 59 000 octets)

- **12 nov. · Restes (agent2-restes)** : points relais tous transporteurs (rue sans n°, repli extrait), « Voir l'e-mail », « Où vous livrer… » = en route, « livré ici » relu, SMS, bancs. `2026-11-12-restes.md`. Geste : aucun.
- **12 nov. · Finitions (2 passes)** : défauts écran par écran, ligne unique d'« À retirer » (logo et nom du transporteur), cartes « À expédier », couleurs §7. `docs/passation/2026-11-12-finitions.md`. Geste : aucun.

## Déplacé tel quel de CLAUDE.md §9 (12 nov., intégration de l’extension 5.372)

- **12 nov. · Favoris par compte + suivi des achats (ext. 5.372, `claude/agent2-favoris-compte`, CONTIENT `agent2-ext-boutique` + main 7c94382c4)** : favoris = une liste par compte (onglet d'abord), du plus récent au plus ancien, une case 44 px par favori, vendus / plus en ligne retirés, « à vérifier » si lecture ancienne, envoi au seul compte de l'onglet ; « Vintex » retiré de tout texte (« Rapide (6–10 s) », `audit-sans-vintex`) ; 8–20 s entre offre et message ; n° de suivi et codes de retrait de chaque achat en cours. `docs/passation/2026-11-12-favoris-compte.md`. Geste : installer 5.372.0.
- **12 nov. · Boutique + carte du logo (ext. 5.371, `claude/agent2-ext-boutique`, CONTIENT `agent2-discretion`)** : « Nouvelle version disponible » (zip ⇒ Télécharger + 3 étapes ; boutique ⇒ rien), carte en 4 lignes, Réparer, rapport sans donnée (`mode=rapport-extension`), gestes hors ligne en file 24 h, logo jamais sur une barre fixe. `docs/passation/2026-11-12-ext-boutique.md`. Geste : publier (`2026-11-12-chrome-web-store.md`).
- **12 nov. · Paquets G2 (ext. 5.368) et 12nov-a (ext. 5.369), mis en ligne par le second agent** : `2026-11-12-integration-11nov-g2.md`, `2026-11-12-integration-12nov-a.md`. Geste : installer 5.369.0 ; migration 042 (facultative).

## Déplacé tel quel de CLAUDE.md §9 (12 nov., intégration vert-vitesse)

- **12 nov. · Vert et vitesse** : CI de main au vert ; « Tout imprimer (N) » = « Imprimer (N) » ; une vente ne relit que son compte (1 350 → 268 Ko). Reste : 20 000 ventes. `docs/passation/2026-11-12-vert-vitesse.md`. Geste : aucun.

- **12 nov. · Paquets G2 (ext. 5.368), 12nov-a (ext. 5.369) et 12nov-b, mis en ligne par le second agent** : `2026-11-12-integration-11nov-g2.md`, `-12nov-a.md`, `-12nov-b.md`. Geste : installer 5.369.0 ; migration 042 (facultative).

- **12 nov. · G2 (5.368), 12nov-a (5.369), 12nov-b, vert-vitesse, vitesse-volume en ligne** : 20 000 ventes −20 %. `2026-11-12-*.md`. Geste : migration 042 (facultative).

- **12 nov. · G2 (5.368), 12nov-a (5.369), 12nov-b, vert-vitesse, vitesse-volume, extension 5.372 (discrétion, boutique, favoris par compte, une prudence par compte) en ligne** : `2026-11-12-*.md`. Geste : installer 5.372.0 ; migration 042 (facultative).


- **13 nov. · Moteur-compta (second agent)** : moins de calculs refaits, chiffres 35/35 ; < 2 s non atteint (2–3 `Comptabilite` par écran). `2026-11-13-moteur-compta.md`. Geste : aucun.

- **13 nov. · Source unique (second agent)** : ventes, achats, suivis et dates de versement en UNE copie pour tous les `Comptabilite` montés (`src/magasinPartage.js`) ; chiffres 35/35, lectures en baisse (budget abaissé), lecture KO sans perte (banc `source-unique`) ; une date de versement lue ne redevient jamais vide (banc `versements-course`) ; pas de gain de vitesse prouvé, publieur pas fait. `2026-11-13-source-unique.md`. Geste : aucun.

- **13 nov. · CI (intégration, étape 1)** : sous WebKit le service worker échappait aux routes des bancs (la vraie base répondait) ⇒ bancs sans service worker ; Safari : toucher un onglet avec « Plus » ouvert y mène enfin (B5) ; e2e-extension 39/41. `2026-11-13-integration-ci.md`. Geste : aucun.

- **13 nov. · Passation du second agent** : ce qui n'est pas fini (CI → traduction → découpe d'App.jsx ; colis : rappels, un colis une fois, rappels veille/jour J, horaires), décisions de Julien du 12-13 nov., gestes. `2026-11-13-passation-agent2.md`. Geste : extension 5.372, sauvegarde.

- **13 nov. · Un colis = une fois, rappels, horaires (second agent)** : plus de carte « N colis changent de point relais » (chaque redirigé = une ligne sous son point, En route) ; rappels des transporteurs = le même colis, rien d'effacé (`api/_lib/rappel-colis.js`) ; date limite Vinted Go en gras lue ; rappel de retrait la veille et le jour J au nom de l'article ; horaires des points (`api/_lib/horaires-relais.js`). `2026-11-13-horaires-relais.md`. Geste : aucun.

- **13 nov. · Traduction lot 2 (intégration, étape 2)** : Ma journée, Ventes, Achats, Annonces, Stock, Argent, Statistiques, Messages, E-mails en 5 langues sur le main du jour (migration rejouée par `i18n-migrer`, 150 clés neuves) ; français identique mot pour mot (18 relevés). `2026-11-13-integration-traduction.md`. Geste : aucun.

- **13 nov. · Horaires Mondial Relay** : lus par le serveur dans le suivi du colis (n° de point), 7 j, même code postal, sans requête de plus. `2026-11-13-lot11-horaires-mr.md`. Geste : aucun.
- **13 nov. · Rappels de colis au nom de la paire (second agent)** : « Demain dernier jour », « Dernier jour », « t'attend » portent le titre de l'achat relié par IDENTITÉ (n° de suivi, code, conversation : jonction de l'écran dans `api/_lib/commande-colis.js`, app et serveur), jamais par ressemblance ; le résumé du soir saute un colis déjà rappelé le matin (une notification par colis et par jour) ; banc `ventes-colis-premium` à la règle « Colis dans Ventes ». `docs/passation/2026-11-13-rappels-paire.md`. Geste : aucun.

- **13 nov. · Récap 1 page + URSSAF la veille** : « Récap de <mois> » → Imprimer (A4, noir et blanc, données du Rapport du mois) ; la veille « Demain : déclaration URSSAF · X € à déclarer » (règle de « Copier », une fois). `2026-11-13-lot1617.md`. Geste : aucun.

- **13 nov. · Prévision lissée, « Tes comptes Vinted » (lot 36-27)** : du 1er au 4, rythme des 4 dernières semaines ; tableau par compte (30 j/90 j/année : ventes, jours, prix moyen, offres). `2026-11-13-lot3627.md`. Geste : aucun.

- **13 nov. · Bénéfice « si vendue » et paires qui dorment (points 14-15)** : fiche « En ligne à · Si vendue » (`beneficePaire`, au plus, achat pas saisi ⇒ « — » + « Saisir ») ; Qui dorment rangées par ce qui rapporte, UN geste chacune (baisse mesurée, favoris, Republier, Leboncoin ; « … » le reste), `src/dormantes.js`. `docs/passation/2026-11-13-lot1415.md`. Geste : aucun.

- **13 nov. · Lot 89** : Colissimo et UPS lus par le serveur dès leur clé (sinon rien d'appelé, « lu par e-mail seulement ») ; DPD/GLS non mesurés. `2026-11-13-lot89-suivi-transporteurs.md`. Geste : `…-guide-cles-transporteurs.md`.

- **13 nov. · Lot 45 : le Stock et l'Inventaire sans réseau (garage)** : hors réseau le Stock se dessine avec sa DERNIÈRE lecture gardée par vendeur (`src/stockHorsLigne.js`, `vrm_hl_stock_{uid}`, effacée à la déconnexion), « Hors connexion — dernier état du … », N°, case, photos déjà vues (service worker `/hl-photo`, réserve `vrm-hl-photos`, 120), recherche par N°, inventaire par la feuille du Stock ; changer un N° / publier dit une fois ; aucune lecture ni N° écrit hors réseau. `docs/passation/2026-11-13-lot45.md`. Geste : ouvrir le Stock une fois en ligne.

- **13 nov. · Très aimées, pas vendues (lot 31)** : Favoris, par compte, ≥ N favoris lus, ≥ 14 j ; « Proposer » pré-remplit le flux (pas recontacté, −x %, jamais sous achat + 10 %). `2026-11-13-lot31.md`. Geste : aucun.

- **13 nov. · Lot 51 (données du compte)** : « Supprimer mon compte » = 30 jours de grâce (demande neutre `vrm_effacement_prevu_*`, abonnement résilié, « Annuler » en un geste, bandeau ; cron du matin efface par `effacerCompte` ; compte vide : tout de suite) ; export RGPD inchangé. `2026-11-13-lot51.md`. Geste : aucun.

- **13 nov. · /confiance + /etat** : page publique « ce que VRM fait et ne fait jamais » (preuves : `audit-confiance-publique`) ; /etat sans réponse ⇒ « État inconnu ». `docs/passation/2026-11-13-lot5052.md`. Geste : aucun.

- **13 nov. · Logos des transporteurs** : Chronopost et Pickup = cube bleu sur blanc, jamais jaune ; DPD, DHL, FedEx, Relais Colis en variante neutre ; gabarit commun mesuré. `2026-11-13-logos-transporteurs.md`. Geste : aucun.

- **13 nov. · Retour → stock sans rien saisir (lot 29)** : un retour Vinted PROUVÉ (transaction 440 / non réclamée) puis REMBOURSÉ (ou noté reçu) revient en stock sous SON N° (n° de transaction → annonce → N°) : « Retour du <date lue> — à vérifier et remettre en ligne », « Remettre en ligne » (son clic, Republier à la main) ; en route ⇒ « Retour en route » ; sans N° ⇒ « à numéroter » ; N° déjà porté en ligne ⇒ rien ; ancien (> 45 j) et eBay inchangés (`retourRevenuSeul`). `docs/passation/2026-11-13-lot29.md`. Geste : aucun.

- **13 nov. · Bilan mensuel + support (lot 53/55)** : bilan activé par défaut si compte créé ≥ 13 nov., bénéfice sans « au moins », temps gagné si mesuré ; « Écrire au support » (5 faits techniques, rangé chez lui, scellé). `docs/passation/2026-11-13-lot5355.md`. Geste : `RELANCES_SMTP_*`.

- **13 nov. · Parrainage (lot 54)** : lien copier/partager, mois gagnés, état par filleul, « Offert par <nom choisi> » à l'inscription, « Parrainer » dans Plus ; mois offert si compte Vinted jamais vu. `docs/passation/2026-11-13-lot54.md`. Geste : appliquer la 029.


- **13 nov. · Vente Vestiaire sur Orion (5.374)** : capteur en ligne + rattrapage, compte lu dans la page, date = `soldDate` de « Mes ventes » (Paris), jamais l'heure de lecture. `docs/passation/2026-11-13-vestiaire-vente-orion.md`. Geste : 5.374 dans Orion, ouvrir Mes ventes.

- **13 nov. · Lot 56/58** : Solo + comptes Vinted vendeurs payés (`PRIX_COMPTE_SUP_CENTIMES` 3 € à confirmer, prix `vrm_compte_sup`, quantité bornée serveur, « Bientôt » sans prix) ; équipe : « pas encore activé sur ton installation », retrait en un geste. `2026-11-13-lot5658.md`. Geste : 016 (3 gestes), prix Stripe.

## Déplacé de CLAUDE.md §9 le 14 nov. (taille du fichier)


- **13 nov. · Lot 49 (vidéos du « ? »)** : 10 vidéos 720p tournées dans la vraie app, données inventées (`scripts/films/aide-videos.cjs`), ≤ 0,8 Mo, demandées au toucher seulement. `docs/passation/2026-11-13-lot49.md`. Geste : les regarder sur l’iPhone.

- **13 nov. · Démarrage en 3 étapes + exemple (lot 46/48)** : compte · extension reliée à CE compte · Vinted lu (ventes, sinon dressing), cochées sur preuve, geste exact, carte disparue à 3/3, jamais chez un installé ; « Découvrir avec des exemples » sur l'accueil et la connexion, bandeau « Créer mon compte ». `docs/passation/2026-11-13-lot4648.md`. Geste : aucun.

- **13 nov. · Import de ton passé (lot 47, ext. 5.375.0)** : 12 derniers mois (ventes, achats ; annonces = dressing complet d'un trait), dans les 20 lectures/h étalées (« suite dans 40 min »), reprise page suivante, souci dit et reprise seule ; « Ton passé est importé (12 mois) » une fois (`vrm_import_passe_vu`). `docs/passation/2026-11-13-lot47.md`. Geste : installer 5.375.0.

- **13 nov. · Design système** : jetons `--d-*` (`src/styles-systeme.css`) lus par toutes les familles ; contient 20 · se touche capsule · montre 12 · N° 6 ; 400/600/700 ; 44 doigt / 36 souris. `docs/design/DESIGN.md`, `2026-11-13-design-systeme.md`. Geste : aucun.

- **13 nov. · Lot 7 : le nom de la paire sur chaque colis à retirer** : une jonction par IDENTITÉ (`commandeRetrait` ; `commandeUnique` dans `api/_lib/commande-colis.js`, deux commandes ⇒ personne) pour Colis (nom + photo), mode relais, Ma journée (les noms dans la case), hors ligne, codes, et le widget (`pickupColis`, nom publié en [7]) ; mesuré 8/12 reliables, les 4 autres n'ont aucune identité en base (attendent la 5.372). `docs/passation/2026-11-13-lot7-nom-paire.md`. Geste : installer la 5.372 ; le script du widget lit `pickupColis`.

- **14 nov. · Design, passe écran par écran** : fiche « Tout sur le N° » et loupe au système, 500 → 400/600, tailles à l'échelle, un gris, contrastes ≥ 4,5 (« 36 »), 44 doigt / 36 souris (filtres compris), titres insécables au trait d'union ; banc `design-passe` (avant 1 839 défauts, après 0). `docs/passation/2026-11-14-design-passe.md`. Geste : aucun.

- **14 nov. · Design, passe 2** : Messages, E-mails, Achats, eBay, Leboncoin, Vestiaire, 15 sous-pages de Paramètres, feuilles, connexion, accueil, exemple, démarrage au système (banc `design-passe-2.cjs` : 1 766 défauts ⇒ 0) ; la loupe n'écrit le N° qu'une fois. `docs/passation/2026-11-14-design-passe-2.md`. Geste : aucun.

- **14 nov. · Bancs au vert** : 14 bancs + job `comptes-et-reception` verts sans affaiblir (faux PostgREST à la vraie forme, `in.(…)`, attentes sur condition, porte de banc à jeton JWT) ; 3 défauts de l'app corrigés (⌘K « Imprimer » ouvre la feuille, rail allumé sur Organisation, « Statut » dans Factur-X). `docs/passation/2026-11-14-bancs-au-vert.md`. Geste : aucun.

- **14 nov. · Design, passe 3** : bande Leboncoin dans la colonne, Notifications au segmenté, pas de barre vide, fraîcheur sans cadre, 28 sous-pages, feuilles, e-mail et fil au système ; la feuille de vente ne cache plus l'écran (banc `design-passe-3.cjs` : 1 531 défauts ⇒ 0). `docs/passation/2026-11-14-design-passe-3.md`. Geste : aucun.

- **14 nov. · Argent, quatre choix (75, 80, 81, 82)** : coller « N° ; prix » dans la saisie en série (aperçu, rien d’écrasé) ; « Modèle et taille » + « À racheter » sur les ventes reliées ; objectif sur le REÇU + « X € par jour d'ici le 30 » ; « Ta déclaration de revenus » en tête de Déclarer avec case et source. `docs/passation/2026-11-14-argent-choix.md`. Geste : aucun.

- **14 nov. · Confort et sécurité (117–130)** : journée selon l’heure, écran d’atelier, connexion par QR (iPhone approuve, session neuve serveur, MFA gardée), lien d’aide 24 h sans 016, échanges au dossier de litige, code local, aperçu, inventaire tournant, carte merci. `2026-11-14-confort-securite.md`. Geste : aucun.

- **14 nov. · Une seule fiche partout (proposition 62)** : toucher une ligne (Ventes, À expédier, Annonces Vinted/LBC/eBay/Vestiaire, Stock, Achats, À retirer) ouvre LA fiche de la paire, désignée par identité (`src/ficheLigne.js`), la partie du contexte en haut et les gestes de la ligne dedans (`src/DansFiche.jsx`) ; sans identité ⇒ fiche de la ligne, « pas de paire reliée ». `docs/passation/2026-11-14-fiche-partout.md`. Geste : aucun.

- **14 nov. · Frais de l'année + carte de tes ventes (123, 124)** : Argent — `fraisAnnee` (= `fraisParPlateforme` sur l'année : au moins / — / couverture, livres écartées et dites, boosts Vinted pas lus) et `lieuxVentes` (pays du profil Vinted par la transaction, ville de livraison eBay par la commande, jamais un nom ; Base Adresse une fois par ville). Mesuré : pays sur 522 / 3 535 ventes Vinted, 0 frais lus. `docs/passation/2026-11-14-frais-carte.md`. Geste : aucun.

- **14 nov. · Fiabilité prod (mesurée)** : 64 écrans tombés sur un module « undefined » (main.jsx ne fait plus `preventDefault` sur `vite:preloadError`) ; plus de requête au jeton expiré (`src/jetonFrais.js`, 100–150 refus 401/jour) ; /api/sante relance les sondes que GitHub oublie ; garde des bancs sans `keepalive` vers la prod. `docs/passation/2026-11-14-fiabilite-prod.md`. Geste : recoller le script Gmail (il lit encore la base avec l'ancienne clé).
- **14 nov. · Accueil des nouveaux** : bilan en une minute, parcours Leboncoin/Vestiaire/eBay, premier colis accompagné, « Nouveau » (comptes neufs), langue du téléphone au 1er lancement (jamais `vrm_langue`), notifications après un colis suivi (plus au démarrage), page /tarifs. `docs/passation/2026-11-14-accueil-nouveaux.md`. Geste : aucun.
## Déplacé tel quel de CLAUDE.md §9 (14 nov., consolidation de l’extension 5.376.0 — fichier sous 59 000 octets)
- **14 nov. · Refonte d'Achats** : liste d'abord (bande de chiffres ≤ 72 px, « À retirer » rangé, sa case l'ouvre), rangées 68 px (8 achats/écran), comptes en liste groupée iOS, sources en tuiles + « Comment c'est calculé », recherche collée, le N° trouve l'achat. `docs/passation/2026-11-14-refonte-achats.md`. Geste : aucun.
- **14 nov. · Messages et achats, en plus (108-111, 125, 131 ; ext. 5.376.0)** : infos de la fiche et réponses aux questions fréquentes insérées d'un toucher (mots fermés, sans IA) ; catalogue privé (`/catalogue/<jeton>`, 7 j, révocable, sans prix d'achat) ; liste de recherche et « déjà achetée » dans l'encart (0 requête Vinted) ; carnet des vendeurs. `docs/passation/2026-11-14-messages-achats-plus.md`. Geste : installer 5.376.0.
- **14 nov. · Photos et fiches (102-107)** : avis « floue ? / sombre ? » mesuré sur le téléphone (worker, jamais bloquant) ; séance photo par N° ; recherche par couleur des photos (5 langues) ; note dictée (navigateur) ; certificat rangé avec la paire ; fusion de deux fiches sur son clic (aucun N° changé, alias, 30 j). `docs/passation/2026-11-14-photos-fiches.md`. Geste : aucun.
- **14 nov. · Argent et prix (112–116, 121, 122)** : deux taux par modèle (retours · litiges) ; offres acceptées ET payées par compte (par la transaction) ; soldes « Jusqu'au… » remis sur SON clic (Ma journée propose, ext. 5.376 `remiseprix`) ; lien lecture seule signé pour le comptable (`/c/…`, compta seule, journal) ; révision du mois ; même N° à deux prix ; prix à afficher pour toucher X €. `docs/passation/2026-11-14-argent-prix.md`. Geste : installer 5.376.0.
- **14 nov. · Extension, capture (5.376.0)** : bordereau Vinted relancé seul (10 min → 6 h, visite + fond, budget de lecture, compte de l'onglet), envois ratés gardés puis rejoués (jamais sur plus frais), Orion sans alarms reprend les files, carte « 3 bordereaux pas encore récupérés · Ouvre tes ventes à expédier ». `docs/passation/2026-11-14-extension-capture.md`. Geste : 5.376 sur CHAQUE navigateur (Chrome en 5.329, iPhone en 5.368).
- **14 nov. · Retrait Vinted Go réacheminé** : l'e-mail « Nouveau relais : il est temps de récupérer » est une arrivée (son QR Vinted Go atteint À retirer, montré seulement s'il porte le n° et le code du colis, `api/_lib/qr-retrait.js`) ; le point lu le plus récent gagne, l'ancien nom ne reste pas ; AUCUN colis sans code dans « À retirer » (⇒ « À vérifier ») ; un retour ouvert (440) sur l'achat = retiré. `docs/passation/2026-11-14-retrait-vinted-go.md`. Geste : aucun.
- **14 nov. · Ouverture instantanée (84)** : l'instantané de Ma journée peint AVANT l'app (porte hors ligne, uid, daté, inerte), gardé hors ligne et en panne ; SW : coquille rangée dès la 1re ouverture, `/demarrage-*.js` en cache. `2026-11-14-ouverture-instantanee.md`. Geste : aucun.
- **14 nov. · Colis plus (96-101) + impression guidée** : carton PROPOSÉ par modèle, fournitures « à chaque colis », Tout imprimer guidé (imprimante classique / 4 par A4 / thermique, tampon par bordereau, « Tout est sorti ? »), douchette (identité exacte), mains libres, temps par colis. `2026-11-14-colis-plus.md`. Geste : aucun.
- **14 nov. · Dates de versement, quatre sources** : mesuré, 0 des 1 741 avait une source en base ; LA règle `datesDeVersement` (transaction 450 > relevé > conversation « Ta vente est finalisée. » > e-mail, par n° seulement, recopiée au serveur) ; extension 5.376.0 lit la conversation (plus anciennes d'abord) ; Ma journée : « … en cours de lecture · N datées ✓ · environ 7 jours ». `docs/passation/2026-11-14-dates-versement.md`. Geste : 5.376 puis vinted.fr ouvert sur le grand compte.

## Déplacé tel quel de CLAUDE.md §9 (14 nov., intégration de la refonte — fichier sous 59 000 octets)
- **14 nov. · Carte du logo (5.376.0)** : la carte n'ouvre plus VRM (liens du MÊME site : ventes, messages, dressing du compte de l'onglet ; Vestiaire aucun) ; « N favoris à qui écrire · Voir » ⇒ aperçu calculé par le serveur (règles de l'app) ⇒ « Lancer » = la file d'avant conduite par le fond (15/h, 50/h, pause, autre compte ⇒ rien) ; app : guide des favoris, Créer sur Vinted guidé. `docs/passation/2026-11-14-extension-carte.md`. Geste : installer la 5.376.

## Déplacé tel quel de CLAUDE.md §9 (14 nov. au soir, refonte des listes — fichier sous 59 000 octets)


## Déplacé tel quel de CLAUDE.md §9 (14 nov., intégration de la refonte — fichier sous 59 000 octets)
- **14 nov. · Mode exemple : photos et impossible à confondre** : 21 vraies photos (Commons, CC0 / domaine public, crédits `public/exemple/CREDITS.md`, une par paire, titre = la photo) ; bandeau « Exemple — données inventées » + « J’ai déjà un compte · Me connecter », cadre hachuré au-dessus de tout, « exemple » sur codes et adresses, « Relais Exemple, rue Imaginaire » (capture d’accueil refaite). `2026-11-14-exemple-photos.md`. Geste : aucun.
## Ligne déplacée de CLAUDE.md §9 le 14 nov. (taille du fichier)

## Déplacé tel quel de CLAUDE.md §9 (14 nov., intégration de la refonte — fichier sous 59 000 octets)
- **14 nov. · Refonte de la coque (n° 61)** : 4 onglets (Aujourd'hui · Paires · Ventes · Argent ; Paires = Annonces|Stock|Achats, `src/navPaires.js`), barre du haut loupe · cloche (point) · avatar (qui ouvre le reste des écrans), « à revoir » dans la cloche, §3/§4 `styles-systeme.css`. `2026-11-14-refonte-coque.md`. Geste : aucun.

## Déplacé tel quel de CLAUDE.md §9 (14 nov., intégration de la refonte — fichier sous 59 000 octets)
- **14 nov. · Extension 5.376.0 consolidée** : quatre branches en UNE version (carte du logo + capture, messages-achats-plus, argent-prix `remiseprix`, dates-versement `versementconv`), zips refaits une fois. `docs/passation/2026-11-14-extension-5376.md`. Geste : installer la 5.376.0 sur chaque navigateur.

## Ligne déplacée de CLAUDE.md §9 (14 nov., soir, taille)

- **14 nov. · Accueil, le reste (133 134 136 139 140 143 145 146 147)** : « J'ai déjà mes N° sur mes cartons » (aucun N° neuf avant sa réponse, N° écrit en double ⇒ rouge, rien adopté), « Ce que VRM a trouvé », visite de 4 écrans, mots expliqués, conseil du jour 30 j, essai en chiffres prouvés, vidéo 45 s, Apple prêt et ÉTEINT, appel de bienvenue Pro ; « À trancher » ne recouvre plus Ma journée. `docs/passation/2026-11-14-accueil-reste.md`. Geste : coller son lien de réservation (Paramètres → Aide) ; Apple si voulu (99 €/an).
## Lignes du §9 de CLAUDE.md déplacées telles quelles le 14 nov. (refonte des listes, taille du dossier)

## Lignes du §9 de CLAUDE.md déplacées telles quelles le 14 nov. (listes : phrase, glisser, épingles, comparer — taille du dossier)

## Déplacé tel quel de CLAUDE.md §9 (14 nov., intégration de la refonte — fichier sous 59 000 octets)
## Lignes du §9 de CLAUDE.md déplacées telles quelles le 14 nov. (ergonomie des gestes, 2ᵉ fusion)

## Déplacé tel quel de CLAUDE.md §9 (14 nov., lot accompagnement)

## Déplacé tel quel de CLAUDE.md §9 (14 nov., intégration de la refonte — fichier sous 59 000 octets)
- **14 nov. · Refonte visible des sites et des Paramètres** : Leboncoin, eBay, Vestiaire « liste d'abord » (« À faire · N › » en feuille gardée montée, une barre, rangées denses) ; Paramètres façon iOS (recherche en haut, avancés repliés) ; connexion et accueil atmosphériques. `2026-11-14-refonte-plateformes-reglages.md`. Geste : aucun.
- **14 nov. · Refonte Messages, E-mails, Stock** : la liste d'abord (Stock : 1re paire à 1 541 px ⇒ < 422, bande, « À faire · N › », rangées 68 px ; Messages : recherche, « À relier », rangées 72 px, fil iOS ; E-mails : rangées 72 px, code à droite), briques `src/ui` ; banc `refonte-messages-stock` (13 défauts ⇒ 0). `docs/passation/2026-11-14-refonte-messages-stock.md`. Geste : aucun.

## Déplacé tel quel de CLAUDE.md §9 (14 nov., intégration de la refonte — fichier sous 59 000 octets)
- **14 nov. · Refonte des listes** : Annonces et Ventes « la liste d'abord » (bande de chiffres au lieu de la carte sombre, compte en menu, barre + petites capsules, alertes dans « • À faire · N », phrase sous le titre retirée), Annonces en liste groupée de 70 px, colis en rangées, Ma journée : héros atelier ; briques communes `src/ui/` ; banc `refonte-listes`. `docs/passation/2026-11-14-refonte-listes.md`. Geste : aucun.
- **14 nov. · Listes : phrase, glisser, épingles, comparer (92–95)** : « nike 42 pas vendue depuis 2 mois » ⇒ capsules modifiables sans IA (5 langues, Annonces + ⌘K, `src/recherchePhrase.js`) ; cocher en glissant depuis la case ; 20 épingles par identité (`vrm_epingles`, synchronisées) ; comparer deux cochées. `docs/passation/2026-11-14-listes-recherche.md`. Geste : aucun.

- **14 nov. · Ergonomie des gestes (mesurée)** : banc `ergonomie-gestes` joue 15 gestes au pouce (390 tactile) depuis l'ouverture ; ⌘K « Republier N°x à la main » (kit, 5 → 3 touchers) et « Publier N°x partout » (4 → 3) ; les 15 dans leur plafond. `docs/passation/2026-11-14-ergonomie-gestes.md`. Geste : aucun.

## Déplacé tel quel de CLAUDE.md §9 (14 nov., version studio — fichier sous 59 000 octets)
- **14 nov. · Intégration des refontes** : coque, listes (Annonces, Ventes, Ma journée), Messages/Stock, plateformes/Réglages, recherche, gestes et accompagnement réunis en une version (vrais merges, 44 écrans montés avant/après) ; loupe : pas un bug (la feuille « bilan en une minute » couvrait le banc). `git log origin/claude/integration-refonte`. Geste : aucun.

<!-- déplacé tel quel de CLAUDE.md §9 le 15 nov. 2026 -->
- **14 nov. · Ma journée « Studio bleu clair »** : tête + affiche (vendu du jour fin, € remonté, semaine), grille Bento fixe (chaque tuile son geste ; « Imprimer » seul plein, parcours inchangé ; codes en plaques), déplier sur place (tassé au téléphone, dessous sur ordinateur), « À faire » dessous. Idée 148 (ranger les tuiles) NON retenue. `docs/passation/2026-11-14-studio-journee.md`. Geste : aucun.

<!-- déplacé tel quel de CLAUDE.md §9 le 15 nov. 2026 -->
- **14 nov. · Vente en main propre en 2 touchers (160 seule, choix de Julien ; 159/161/162 retirées)** : loupe « vendu 124 » ⇒ prix ⇒ « Vendue » ; UN verdict fiche + feuille (`verdictVenteMain` sur `histoirePaire` : N° exact, doublon ⇒ question, « B… » proposé, déjà vendue partout ⇒ refus, compte exclu, pas su ⇒ refus), écriture = « Vendu ailleurs » + paiement, reçu PDF. `docs/passation/2026-11-14-vente-main-propre.md`. Geste : aucun.
- **14 nov. · Correctif « À faire » (iPhone bloqué)** : la feuille d'un site, montée fermée (`hidden`), restait dessinée (le `display:flex !important` du voile passait devant `[hidden]`) ; la section Vestiaire centrait ses cartes (`align-items:center` d'une grille) ⇒ page décalée. `Feuille` : 4 fermetures (OK, voile, glisser, retour), fermée = jamais dessinée, un geste qui ouvre une autre couche la referme. `docs/passation/2026-11-14-correctif-afaire.md`, banc `afaire-feuille`. Geste : aucun.

<!-- déplacé tel quel de CLAUDE.md §9 le 15 nov. 2026 -->
- **14 nov. · Idées 154, 157, 158 (155 et 156 retirées, sa décision)** : fiche de la paire « Dans l’ordre » (ligne de temps par identité ; rien sur un N° en double), « Dans une autre taille » (N° neuf par `numerosServisLus`, corrige l’oubli des cases du Stock dans Dupliquer), meilleure heure dans « Programmer » (suggestion, son clic). `docs/passation/2026-11-14-idees-paires.md`. Geste : aucun.

<!-- déplacé tel quel de CLAUDE.md §9 le 15 nov. 2026 -->
- **14 nov. · Retraits d'achat cachés (« je n'ai plus les retraits d'achat »)** : mesuré, la règle comptait 3 colis à retirer AVEC code (publication), mais la refonte d'Achats les rangeait dans un repli fermé sans ligne ; règle `src/repliRetirer.js` : ≥ 1 colis ⇒ « À retirer » ouvert en tête, fermer ne vaut que pour la liste vue, « à vérifier » nommés. `docs/passation/2026-11-14-retraits-achats.md`. Geste : aucun.
- **14 nov. · Imprimer en un toucher** : « Imprimer (N) » ouvre le PDF tamponné DANS le toucher (iPhone : partage, préparé d'avance ; ordinateur : visionneuse qui lance l'impression, rien lu avant) ; papier demandé une fois puis retenu (lien à côté) ; après : « Tout est sorti ? Oui / Il en manque », tampon corrigé sur la vignette ; plus de « Place du tampon » d'office. `docs/passation/2026-11-14-impression-simple.md`. Geste : essayer « Imprimer » sur son iPhone.

<!-- déplacé tel quel de CLAUDE.md §9 le 15 nov. 2026 -->
- **14 nov. · Studio bleu clair — Ventes (À expédier) et Achats (À retirer)** : grand chiffre « 5 colis à envoyer · 2 avant demain », UN plein « Imprimer N » (= `ouvrirLot`, parcours d'impression intouché), tuiles-filtres enfoncées + diode, rangées sans bouton (gestes dans la fiche), « À retirer » EN TÊTE et ouvert dès qu'un colis attend (« À vérifier » ouvert dessous), codes en grandes plaques ; couche CSS `vrm-studio` (ordre posé dans index.html). `docs/passation/2026-11-14-studio-ventes.md`. Geste : aucun.

<!-- déplacé tel quel de CLAUDE.md §9 le 15 nov. 2026 -->
- **14 nov. · Studio bleu clair : Paires (Annonces, Stock, la fiche)** : rangées 64 px sur plan de verre (plaque N° · vignette · titre/méta · prix), la paire touchée MONTE à sa place (prix, acheté, jours, favoris, Baisser · Republier · ⋯ ⇒ la fiche), ordinateur : fiche en plan à droite ; grille au choix ; aucun geste perdu (inventaire). `docs/passation/2026-11-14-studio-paires.md`, banc `studio-paires`.

<!-- déplacé tel quel de CLAUDE.md §9 le 15 nov. 2026 -->
- **14 nov. · Studio bleu clair, écrans « reste »** : Argent (Bento), Messages, Paramètres, Communauté, E-mails, connexion, accueil, tarifs, feuilles ; 4 formes de bouton, rien retiré (sauf un doublon). `2026-11-14-studio-reste.md`.

<!-- déplacé tel quel de CLAUDE.md §9 le 15 nov. 2026 -->
- **14 nov. · Studio bleu clair — la fondation** : jetons `--sb-*`, quatre formes de bouton, coque (lumière, barre en verre, pastille enfoncée + diode, disque « + » ⇒ Chercher · Scanner · Publier · Imprimer N), polices Urbanist/Inter embarquées, `src/ui` migré ; `docs/passation/2026-11-14-studio-fondation.md`. Geste : regarder sur iPhone, dire ce qui gêne.

<!-- déplacé tel quel de CLAUDE.md §9 le 15 nov. 2026 -->
- **15 nov. · Version « Studio bleu clair » en ligne** : les chantiers studio + impression en un toucher + idées 154/157/158/160 + correctif « À faire », intégrés ; passe complète (26 audits, 22 bancs) ; corrigé à la fusion : étiquette « Choisir » en double sur le plein, moments pendant/après/échec de l'impression rebranchés (`accompagner`), « Bénéfice : — ». `docs/passation/2026-11-15-version-studio.md`. Geste : fermer/rouvrir l'app, essayer « Imprimer » sur l'iPhone.


## Ligne déplacée de CLAUDE.md §9 (16 nov.)

- **15 nov. · Publier partout : catégories exactes (5.381.0)** : table `src/correspondances.js` par `catalog_id` Vinted (lu sous `codes.catalog_id`, l'app cherchait `catalogId`) ⇒ Leboncoin 18 sûres/5 à demander, Vestiaire 7/14, eBay demandé à eBay ; réponses retenues par catégorie (`vrm_correspondances`). `2026-11-15-publier-partout-categories.md`. Geste : installer 5.381.0, répondre une fois aux questions.


## Ligne déplacée de CLAUDE.md §9 (16 nov.)

- **15 nov. · Vitrine publique refaite + notifications claires** : accueil (« Tes ventes Vinted, Leboncoin, eBay et Vestiaire au même endroit. », un plein « Essayer gratuitement », vraie capture du mode exemple, tarifs, FAQ des vrais garde-fous, aucun faux), OG refait ; lien partenaire `/p/CODE` ⇒ la vitrine d'abord, code gardé dès l'arrivée (`src/main.jsx`) ; notifications : `api/_lib/notif-redaction.js` (titre ≤ 40, corps ≤ 90, dates de Paris en clair, ni pseudo ni identifiant, 5 langues), « from VRM » = iOS. `2026-11-15-site-public.md`, `2026-11-15-notifications-belles.md`. Geste : aucun.


## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)

- **15 nov. · Programme partenaire (3 €/mois/client payant, à vie)** : `api/_lib/partenaires-regle.js`, lien `vrm.center/p/CODE`, page `/pa/<jeton>` (nombres seuls), Réglages → Abonnement → Partenaires (« Versé » sur son clic, rien ne part seul). Migration **043 PAS appliquée**. `2026-11-15-partenaires.md`. Geste : contrat écrit, migration 043, 5 événements webhook Stripe, créer le partenaire (copier sa page privée tout de suite).
- **15 nov. · Extension 5.380.0 : carte du logo + Leboncoin sûr (5.379 jamais publiée seule)** : « Mes ventes » (`/my_orders/sold`, jamais attestée) retiré, liens sur liste blanche `CHEMINS_ATTESTES` ; favoris listés même sans message ; plaque N° seulement si connue ; studio ; LBC : lecture bornée (`lisible`), enveloppes `commeNatif`, disjoncteur `vrm_lbc_de_cote`, cadres étrangers ignorés ; Vinted : plus de double envoi sur exception. `2026-11-15-carte-extension.md`, `2026-11-15-lbc-orion.md`. Geste : installer 5.380.0 ; donner l'URL de sa page « Mes ventes » Vinted.


## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)

- **15 nov. · Retours : reconnus, une seule carte « À renvoyer »** : bordereaux de retour et « Retourne ta commande d'ici le … » reconnus (sens lu dans le corps), e-mails gardés « inconnu » reclassés tout seuls (`api/_lib/reclasser-retours.js`, mode de `/api/email-rattacher`) ; `src/retoursAchat.js` : une liste « À renvoyer » (Achats + tête de Ma journée), photo, date limite en clair, « Imprimer le bordereau », « Déposé ». `2026-11-15-retours.md`. Geste : aucun.


## Lignes déplacées de CLAUDE.md §9 (16 nov., lot achats-qr)
## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)

- **15 nov. · Retirer ailleurs, finition, republier guidé, « Sans achat relié »** : vendue sur un site ⇒ UNE entrée « À retirer ailleurs » accompagnée (plus de faux « colis retiré », Vestiaire « c'est fait »), aucune extension neuve ; finition écran par écran (`src/design/studio-finition.css`, couche `vrm-finition` nommée la première) ; republier/publier à la main guidés, photos retouchées envoyées à la galerie, aucune retouche d'évitement ; Annonces → prix d'achat : barre collée opaque, cartes `vrm-aar-*` (plus de débordement). `2026-11-15-retrait-ailleurs.md`, `-finition-ecrans.md`, `-republier-main.md`, `-annonces-achats.md`. Geste : dire s'il garde « lettre au hasard » en fin de description.


## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)

- **15 nov. · Vestiaire juste, même photo, fiabilité, retours suivis (extension 5.385.0)** : Vestiaire — l'état le plus frais gagne (`expeditionVc`, `api/_lib/vestiaire-regle.js`), état en mots (jamais « IN_PROGRESS »), prix de VENTE en grand, « pour toi » en second (totaux inchangés : `sellerEarning`) ; même photo entre plateformes à relier (`src/memePhoto.js`) ; une lecture publique vide qui contredit un dressing < 24 h vaut « pas su » (19 paires perdues le 15 nov., navigateur en 5.273 inconnu) ; retours d'achat suivis par le n° de LEUR bordereau (`api/_lib/retour-suivi.js`), e-mail d'un n° de retour toujours sortant. `2026-11-15-vestiaire-ventes.md`, `-meme-photo.md`, `-audit-fiabilite.md`, `-retours-suivi.md`. Gestes : installer 5.385.0 ; retrouver le navigateur en 5.273 ; décider purge PDF > 30 j, compte copié du 2 oct., `vc_brut_*` (SQL prêts dans l'audit).
- **15 nov. · Nouvelles annonces numérotées (extension 5.382.0)** : une annonce publiée hors de VRM (app Vinted) reçoit son N° à la prochaine lecture (« VRM numérote » : dit une fois — bandeau, notification, carte du logo — et « Nouveaux N° à écrire » avec « C'est écrit ») ; « je numérote moi-même » ⇒ l'app demande le N° de chaque nouvel article (photo en tête). Mots « paires »/« articles » selon le profil. `2026-11-15-numeros-nouvelles.md`. Geste : installer 5.382.0.


## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)

- **15 nov. · « Verre dépoli » partout + Stock en étagères** : Julien a choisi la proposition 9 sur 30 ; couche `studio-verre.css` (contrastes mesurés, banc `verre`) ; Stock en meubles/cases/piles avec sites + compte par identité sur chaque case (`src/stockAnnonces.js`). Maquettes validées de tous les écrans (sauf l'étagère, v3 en cours) ; refonte des dispositions écran par écran en cours. `2026-11-15-verre-depoli.md`, `2026-11-15-stock-etageres.md`. Geste : aucun.


## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)

- **16 nov. · Écrans refaits sur les maquettes validées (vague A)** : Ma journée (seulement les gestes, « Tout va bien ? · N points », retours et litiges ensemble, paire à sortir en premier), Annonces 72 px, Ventes/Achats (colis cochés d'office, place du Stock par N°, code au comptoir), fiche D (un geste : « Relier · N € » sur son toucher), Argent, Messages (plein « Proposer N € »), Paramètres, rail ordinateur Vendre/Ranger/Compter ; « À envoyer » partout (`src/libelles.js`). `2026-11-15-refonte-journee.md`, `-refonte-ventes.md`, `-fiche-d.md`. Geste : aucun.


## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)

- **16 nov. · Nouveautés (vague B)** : transporteur lu sur l'étiquette (jamais « inconnu », `src/colisEnvoyes.js`) ; plus de rangement sur un achat — l'atelier d'arrivée donne le N° puis la case sur la fiche (`casesProposees`) ; contrôle de nuit + santé des comptes + extension en retard (`src/fiabilite/`) ; baisse conseillée, relance des favoris, loupe universelle ; bilan du mois, alertes de seuils, bénéfice réel, sauvegarde zip ; écran de chargement verre. Récits `2026-11-15-*.md`. Geste : aucun.


## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)

- **16 nov. · Extension 5.393.0 (vague C)** : verre de la carte du logo, du site et des e-mails ; « même photo · sûr » vérifiée sur les deux images ; dates de versement ; Vestiaire « aimés » comme Vinted ; scanner pour retrouver (disque « + ») ; banc `sante-donnees` réparé (aucune donnée réécrite à l'ouverture d'Achats). Geste : installer 5.393.0.


## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)

- **16 nov. · CI « Parcours critiques » + « Reprise des chantiers » au vert (PR #1183, `claude/parcours-vert`)** : vrais défauts corrigés (photo Vinted des fils par `PhotoVinted`, deux noms en double dans le texte recollé, 44 px des questions eBay, titre des ventes à 1024 px, fil ≥ 400 px) ; bancs portés sur les écrans refaits (impression en un toucher, Argent à venir, Ma journée en colonnes, Envoyer en dégradé, journal vide caché). ⚠️ `NODE_OPTIONS` n'est plus accepté dans `$GITHUB_ENV` : la garde réseau du job `comptes-et-reception` ne s'applique pas (non touchée). `verifier.yml` reste rouge sur main (dizaines d'audits). Geste : aucun.


## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)

- **16 nov. · iPhone : Ventes sans flou sur ses listes (lot stabilite-iphone)** : ses mesures (Ventes · tél. · toucher) : 7/9 entre 1,25 et 4 s le 16, ≤ 650 ms le 15 ; flou retiré des listes et du segment de Ventes (invisible sur le dégradé), barre du bas lisible (son fondu passait devant son verre), eBay « À traiter / Offres / Promotion » sur une carte, Argent « au moins » une fois. `docs/passation/2026-11-16-stabilite-iphone.md`. Geste : aucun.
- **16 nov. (soir) · PASSATION GÉNÉRALE — À LIRE EN PREMIER** : tout ce que Julien a demandé du 11 au 16 nov., ce qui est en ligne, les 18 PR prêtes à fusionner (ordre et arbitrages), les 15 chantiers mis en pause (limite d'usage à 90 %) avec leur branche, la file validée, les refus et ses gestes : `docs/passation/2026-11-16-passation-generale.md`.
- **16 nov. · Stock : la case allumée, rien d'autre (lot retirer-case-compact)** : plus de bloc « Vendues à sortir », de carte « La paire à sortir » (Ma journée) ni de « Retirer de la case » (fiche) — 1 725 px rendus au téléphone ; la case d'une vendue rangée est en surbrillance, son toucher la sort (annulable) ; expédiée PROUVÉE (statut ou preuve du transporteur, `partieDuStock`) ⇒ sortie toute seule. `2026-11-16-retirer-case-compact.md`. Geste : aucun.
- **16 nov. · Bancs rouges (lot b)** : bancs d'impression portés sur « Imprimer en un toucher » ; e2e-extension vert (la feuille « VRM travaille » se ferme par SON « Fermer ») ; titre d'un colis entier, Achats sans « au moins 0 € », fiche fermée ⇒ focus rendu à la rangée, contrastes de Republier ; bancs neufs `accessibilite-feuilles`, `volume-lbc-vestiaire`. `docs/passation/2026-11-16-bancs-rouges-b.md`. Geste : aucun.
- **16 nov. · Rouges connus (lot bancs-rouges-a)** : défauts app corrigés — carte des ventes déclarée dans la politique (BAN), `CLES_PUBLIEES` + 2 publications d'Achats, fiche D (« ? » d'Achetée = saisie ; Retirer de la case sous ⋯), chemin de Paramètres, planches 44 px, icône du zoom ; bancs enligne (règle du 2 nov.), vestiaire B2, sante-donnees, stock-planches, lot1415, stock-2d sur la règle d'aujourd'hui. `2026-11-16-bancs-rouges-a.md`. Geste : aucun.
- **16 nov. · Relier un achat fiable (lot relier-fiable)** : en ligne, seule la « très probable » (taille ET couleur des deux côtés, modèle) et EXCLUSIVE (un achat ⇄ un article, égalité ⇒ rien) ; couleur : champ, sinon titre, sinon couleur dominante de la photo lue sur l'appareil ; « Possible » retiré, les autres en « Autres pistes » repliées dans la feuille ; même règle partout (`src/liaisonAchat.js`). Fiche → Argent : « Reçu » (par n° de transaction, sinon « Pas de reçu ») et « Délier » (confirmé, annulable, refus mémorisé). Sa base : 986 propositions → 9, ventes sous plusieurs achats 161 → 0. `docs/passation/2026-11-16-relier-fiable.md`. Geste : aucun.
- **16 nov. · Vente vue par e-mail absente de Ventes (lot vente-email-absente)** : mesuré, l'e-mail de vente d'un compte PARTICULIER n'a jamais de n° (0/13 depuis le 1er nov.) ⇒ la règle du 6 nov. n'admettait que le Pro ; il entre, identifié par SA ligne `email_sale_*` (jamais le titre), sort à la relecture, « bordereau à venir » ; offre Vinted : plus jamais « expire dans 24 h » (Vestiaire seul). `docs/passation/2026-11-16-vente-email-absente.md`. Geste : aucun.
- **16 nov. · Achats → À retirer (lot achats-qr)** : « Afficher le QR » visible (icône + texte, 44 px) à côté de « J'ai retiré », seulement avec un QR ; toucher le code ouvre le QR ; plus d'icône grise ni de rond « scanner » ; jours ligne = feuille (`joursRestantsRetrait`, jours de Paris) ; n° de suivi copiable ; QR agrandi au toucher ; colis sans identité : « Achat pas encore relié · Relier » (SON clic, n° mémorisé, `src/relierColis.js` / `achatDuSuivi`) — mesuré : 6 colis sur 7 sans achat, aucune identité ailleurs (suivi pas encore relu). `docs/passation/2026-11-16-achats-qr.md`. Geste : aucun (relier ses colis Mondial Relay d'un toucher).
- **16 nov. · Barre du bas (lot barre-achats)** : Aujourd'hui · Annonces · Achats · « + » · Ventes · Argent (Achats a son onglet, allumé sur son écran ; Paires = Annonces · Stock) ; ⚠️ passer d'un onglet de la barre à un autre REMPLACE l'entrée d'historique (`src/navHistorique.js`) — le glisser-retour d'iPhone montrait l'onglet d'avant à moitié ; feuilles et écrans du menu empilent toujours ; `<main>` sans rebond de côté. `docs/passation/2026-11-16-barre-achats.md`. Geste : aucun.
- **16 nov. · Audits verts sur main (lot audits-vert-main)** : 69 → 3 audits rouges sur main — vrais défauts corrigés (noms en double recollés, notifications coupées qui perdaient le montant / « ne poste pas », carte des ventes dans la politique, CSS verre sur iPhone couché, jour UTC, cleNum) ou audits portés sur la règle écrite des refontes. Restent : vocabulaire-article et vendeur-generaliste (textes paire/semelle hors Sneakers), infos-vinted (recopie d'extension, version à monter) ; bancs principaux rouges à reprendre. `docs/passation/2026-11-16-audits-vert-main.md`. Geste : aucun.
- **16 nov. · Sélection en série (lot ventes-selection, bug iPhone)** : « Tout sélectionner » = les lignes DESSINÉES du compte mis en avant (`clesSelectionnables`), jamais l'historique (2 185) ; filtre/compte/période changés ⇒ sélection vidée ; un défilement annule l'appui long ; « Imprimer · 0 sur 3 » grisé (`portee`) ; barre opaque qui prend la place de la barre du bas au téléphone. `docs/passation/2026-11-16-ventes-selection.md`. Geste : aucun.


## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)

- **16 nov. · Personnalisation simple** : « Modifier ma journée » = une liste en 3 groupes, une phrase, le nom seul, poignée + ↑ ↓ + interrupteur, enregistré tout de suite, « Revenir au réglage de départ » (281 → 106 mots) ; un ordre égal au départ est oublié ; « La paire à sortir » SUPPRIMÉE de Ma journée et de l'éditeur (décision de Julien au train : la case allumée du Stock fait le travail, réglage ancien qui la nomme ignoré). `docs/passation/2026-11-16-personnalisation-simple.md`. Geste : aucun.

<!-- déplacé tel quel de CLAUDE.md §9 le 16 nov. (train) -->


## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)



## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)



## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)

- **16 nov. · eBay → À traiter réparé (lot ebay-a-traiter)** : « Tâches à traiter » envoyait `compte:'principal'` (⇒ « Compte eBay mal désigné ») à l'action `agent` arrêtée (410) : nouvelle action `taches` (lecture seule, `ebay_orders` projetée, messages/offres en parallèle), « principal » = le principal côté serveur ; retours/annulations : corps vide, 204 ou total 0 ⇒ « aucun » (forme inconnue reste illisible, dit où les voir) ; refus ⇒ bouton « Reconnecter ». `docs/passation/2026-11-16-ebay-a-traiter.md`. Geste : aucun.
- **16 nov. · Favoris et offres irréprochables (ext. 5.398)** : revue adverse ; arrêt anti-robot À LA SOURCE (`requeteVinted`, toute requête) ; « Tout arrêter »/captcha pendant l'écriture ; offre auto RELUE depuis l'onglet juste avant le geste (`relireOffre`) ; annonce réservée/masquée/fermée/supprimée prouvée ⇒ ni acceptation ni favori (`annonceIndisponible`) ; refus après écriture jamais recontacté ; temps fixe jamais une minute ronde ; jamais 2 fois le même texte (seule la salutation change, `texteJamaisRepete`). `docs/passation/2026-11-16-favoris-offres-irreprochable.md`. Geste : installer 5.398.0.
- **16 nov. · Captures iPhone (lot bugs-captures-16nov)** : ses captures datent d'avant les mises en ligne du 16 (à dater, frise, « Transporteur inconnu » déjà retirés) ; restait : « à trancher » qui recomptait les autres cartes de Ma journée, « Colis à vérifier » sans geste, icône orpheline et bordereau en double dans la fiche, titres coupés. `2026-11-16-bugs-captures.md`. Geste : rouvrir l'app si l'ancien écran revient.
- **16 nov. · Relier en glissant (lot relier-glisser)** : Achats, Annonces → Sans achat relié, feuille « Relier » : achats libres d'un côté, annonces/ventes sans achat de l'autre ; appui long 400 ms (un doigt qui bouge avant = défilement), achat soulevé, cible éclairée, « Relier N°… à cet achat de … € ? Oui · Annuler », écrit par identité, annulable 5 s ; clavier : choisir puis « Relier ici ». Après chaque liaison : pilule « Achat relié » + bénéfice EN ENTIER dessous (plus coupé par « … ») · Reçu · Annuler. Vibration seulement si `navigator.vibrate` existe (pas sur iPhone). `docs/passation/2026-11-16-relier-glisser.md`. Geste : aucun.
- **16 nov. · Achat renvoyé jamais proposé à relier (lot achats-retour)** : retour (bordereau `email_bordretour_{tx}`, avis par conversation), remboursement prouvé (≥ payé), litige ouvert ou statut litige ⇒ absent de « Relier », propositions, pistes, numérotage, « Achetés, pas en ligne », atelier ; litige clos sans retour (finalisée) ⇒ redevient proposable ; reste dans Retours/Litiges (`src/achatsHorsRelier.js`). `docs/passation/2026-11-16-achats-retour.md`. Geste : aucun.
- **16 nov. · Ventes plus clair** (captures iPhone) : la bande du mois au lieu des tuiles illisibles (le segment porte « À envoyer / En route »), « N choses à regarder » replie les cartes d'info (jamais une panne ni la raison d'un bouton grisé), filtres sur une ligne, une vente en trois lignes sans « ⋯ » (toucher ⇒ fiche, puce « Prix d'achat ? » seulement si manque), puce courte du bordereau. 1re vente à 640 px au lieu de 982. `2026-11-16-ventes-clair.md`. Geste : aucun.


## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)

- **16 nov. · Restes des écrans (lot ecrans-restes)** : stock importé visible (Stock, loupe, fiche ; bilan serveur avec les ventes importées) ; date limite d'envoi dans la fiche et la loupe « à expédier » (règle de Colis) ; « Tout imprimer » tamponne les N° d'un lot ; « Plus tard » MFA synchronisé ; code mort retiré (instantané de Colis, recherche manuelle de relais : tranché) ; iPad/900/1512 corrigés. `docs/passation/2026-11-16-ecrans-restes.md`. Geste : aucun.


## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)



## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)



## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)



## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)



## Lignes déplacées de CLAUDE.md §9 (16 nov., train de mise en ligne)


## Lignes déplacées de CLAUDE.md §9 (17 nov., lot scan-bordereau-vente)

- **16 nov. · Lectures en double et vitesse (lot vitesse-lectures)** : registre eBay et `ebay_orders*` lus une fois (Messages, Ma journée) ; la veille réveille Messages (boîte d'un compte), Leboncoin et Vestiaire (signal rejoué, `src/passerelleVeille.js`), e-mails (« Actualiser ») ; sonde des ventes GARDÉE (4 cas que la veille ne couvre pas) ; `vrm_comptes_relies` à l'ouverture = point de départ voulu, une fois ; entrée de l'accueil 37,7 → 25,8 Ko (exemple, aide d'installation, plantages derrière un tampon, offres à part). `docs/passation/2026-11-16-vitesse-lectures.md`. Geste : aucun.
- **16 nov. · Retours dans « Imprimer » (lot impression-retours)** : les bordereaux de retour (achats renvoyés) partent dans le MÊME PDF que les ventes, section « RETOUR · tu renvoies un achat » (N°, vendeur, « À déposer … »), cartouche RETOUR en grand sur le PDF ; jamais dans « à envoyer » ni le nombre du bouton (« + N retours », « dont N retours ») (`src/impression/retoursLot.js`). `docs/passation/2026-11-16-impression-retours.md`. Geste : aucun.
- **16 nov. · Suivi transporteurs (lot `transporteurs-suivi`)** : Mondial Relay lu pour un colis VENDU (code postal LU sur SON étiquette, gardé seulement sur l'ÉCHO de Mondial Relay, ligne `depart_` jamais `transp_`, texte jamais gardé) ; ⛔ **aucun suivi Colissimo / UPS par clé** (décision de Julien : « on laisse tomber, on garde le suivi de Vinted » — le chemin du 13 nov. par variables Vercel est retiré aussi ; `audit-suivi-cles` rougit s'il revient) ; DPD/GLS/Relais Colis : rien. `docs/passation/2026-11-16-transporteurs-suivi.md`. Geste : aucun (il peut supprimer `LAPOSTE_OKAPI_KEY` / `UPS_CLIENT_*` de Vercel).

## Lignes déplacées de CLAUDE.md §9 (17 nov., lot relier-taille)

- **16 nov. · Plateformes, restes (ext. 5.399.0 ; 5.397 sur la branche)** : douchette eBay (n° de commande, SKU `VRM-{N°}`) et Leboncoin (n° de bordereau Mondial Relay, mesuré) ; achats Leboncoin/Vestiaire dans « Relier » ; catégorie Vestiaire reçue par l'extension ; Vestiaire « finalisé » = une règle (« au moins ») ; facture eBay multi-articles. « Vendu ! » Leboncoin/eBay/Vestiaire d'après ce que VRM lit (15 min, une fois par vente, jamais l'historique) ; aucun e-mail de ces sites en base ⇒ aucun lecteur ; notif « achat » non faite (catégorie retirée). `2026-11-16-plateformes-restes.md`. Gestes : 5.397.0 ; laisser arriver ces e-mails.

## Lignes déplacées de CLAUDE.md §9 (17 nov., lot suivi-multi-transporteurs)

- **16 nov. · Extension 5.400.0 (lot extension-restes ; 5.395 sur la branche, avec la recopie des règles d'achat #1210)** : « Mondial Relay by InPost » = Mondial Relay ; N° de la fiche à côté de « Publier » ; empreintes eBay par l'extension ; Créer sur Vinted reprend le studio ; anti-arnaque compte « Tous » ; avis bas datés dans la santé des comptes ; « pas partie » prévenu par le serveur (passage de 15 min) ; offres « par VRM ». `docs/passation/2026-11-16-extension-restes.md`. Geste : installer 5.395.0.
- **16 nov. · Compta et données (lot compta-donnees)** : URSSAF du 1er ⇒ Argent → Déclarer ; `ecrireReglage` en comparer-et-échanger (`frais` passé) ; file par clé `modifierCle` (liens eBay, prix Vestiaire, colis Leboncoin) ; jours de Paris (`decalerJour`) ; série Facture Pro « Envoyer avec VRM » boîte pas connectée ; commission partenaire au PRORATA d'un remboursement partiel (043 retouchée, pas appliquée) ; « Quoi de neuf » `pour: 'proprietaire'`. `docs/passation/2026-11-16-compta-donnees.md`. Geste : aucun de neuf (043 toujours à coller).
- **16 nov. · Extension 5.400.0 (lot extension-restes ; 5.395 sur la branche, avec la recopie des règles d'achat #1210)** : « Mondial Relay by InPost » = Mondial Relay ; N° de la fiche à côté de « Publier » ; empreintes eBay par l'extension ; Créer sur Vinted reprend le studio ; anti-arnaque compte « Tous » ; avis bas datés dans la santé des comptes ; « pas partie » prévenu par le serveur (passage de 15 min) ; offres « par VRM ». `docs/passation/2026-11-16-extension-restes.md`. Geste : installer 5.395.0.
- **16 nov. · Restes du design** : Leboncoin/eBay/Vestiaire/Stock — la rangée touchée monte à sa place (`src/paires/PaireAvantSite.jsx`, « acheté » du N° par `achatDuNumeroLu`) ; recherches courtes à 390 ; encre claire sur le fond ; un meuble se glisse au doigt (`placerMeuble`). `2026-11-16-design-restes.md`. Geste : aucun.

## Lignes déplacées de CLAUDE.md §9 (17 nov., lot design-v2)

- **17 nov. · Un colis, deux transporteurs (lot suivi-multi-transporteurs, ext. 5.403.0)** : un envoi international (Shop2Shop puis Chronopost) a DEUX n° pour le même colis ; l'extension range tous les n° du trajet, l'app ET le serveur relient le colis du transporteur à l'achat par n'importe lequel (`api/_lib/suivis-multiples.js`) ⇒ UNE ligne au nom de l'article, avec code et QR, plus d'« incident » d'un autre n° du trajet. En attendant la liste (lignes d'avant) : « C'est sans doute le même colis — Relier » seulement si un colis + un achat au même point, même groupe de transporteur, arrivé après l'achat, aucun autre achat en route (`src/memeColis.js`) — SON toucher relie ; « Ce n'est pas le même » gardé (`vrm_colis_pas_meme`) ; une liste LUE qui contredit un lien manuel ⇒ « délier ? ». `2026-11-17-suivi-multi-transporteurs.md`. Geste : installer 5.403.0, ouvrir vinted.fr.
- **17 nov. · La taille à côté de chaque achat à relier (lot relier-taille)** : Relier un achat, Relier achats et ventes, colis à relier : taille LUE chez Vinted (détail de transaction, par n°) sinon « (titre) », « ✓ Taille 42 » / « ≠ 42 » face à l'article (encre neutre, jamais un lien auto), état, vendeur ; « N achats sans taille lue » une fois. Description : rangée nulle part (reste, extension). `docs/passation/2026-11-17-relier-taille.md`. Geste : aucun.
- **17 nov. · Scanner un bordereau de vente (lot scan-bordereau-vente, URGENT)** : mesuré sur son étiquette Mondial Relay : 3 grands codes « lettre + 19 chiffres » SANS le n° de suivi (le téléphone lit celui-là) + un « 55… » de 26 chiffres sur le bord ; les étiquettes captées n'ont aucun n°. Un code inconnu est cherché, lettres et chiffres, dans le texte des étiquettes de SES ventes (`src/etiquettesScan.js`, identité exacte) ⇒ sa vente ; caméra, douchette ; inconnu ⇒ « Code lu » + quoi faire ; « 55… » = Mondial Relay. `2026-11-17-scan-bordereau-vente.md`. Geste : aucun.
- **16 nov. · Scanner un colis d'achat (lot scan-achat)** : le n° de suivi scanné (caméra, douchette, saisie) ⇒ « Dans ce colis » : photo, titre, taille · état, lot en liste (lus dans SA transaction), payé, date, vendeur ; « Ranger » (atelier d'arrivée), « Signaler un problème » (sa conversation Vinted), « Ce n'est pas ça » ; inconnu ⇒ « Colis inconnu · Relier à un achat » (SON toucher, n° gardé comme identité). Mesuré : 43 achats sur 135 (30 j) ont un n°. `2026-11-16-scan-achat.md`. Geste : aucun.
- **16 nov. · Argent lisible (lot argent-mieux)** : cartes de verre à l'encre du verre (`src/design/verre-argent.css`, 0 texte < 4,5:1), « Copier » plein ; ventes non comptées groupées (une ligne par raison, « au moins », détail replié, `src/composants/NonComptees.jsx`) ; règle inchangée. Piste « deux prix » (écart +0,47–1,45 €, pas la protection) : `docs/passation/2026-11-16-argent-mieux.md`. Geste : décider la piste.

## Lignes déplacées de CLAUDE.md §9 (17 nov., lot accessibilite)

- **16 nov. · Tampons des bordereaux (lot tampons-parametres)** : UN réglage `vrm_tampons` (SYNC_KEYS, migration des choix d'avant) lu par TOUTES les impressions ; « Créé par vrm.center » juste AU-DESSUS du QR, centrée (sinon dessous, sinon sous l'adresse) ; la sélection ouvre l'APERÇU AVANT IMPRESSION (vignettes, tampon déplacé au doigt, codes/QR/adresse refusés, « tous de ce type ») ; Paramètres → Imprimante : galerie de tous les types × papiers, même éditeur. `docs/passation/2026-11-16-tampons-parametres.md`. Geste : aucun.

## Lignes déplacées de CLAUDE.md §9 (17 nov., lot stock-rangement)

## Lignes du §9 de CLAUDE.md déplacées le 17 nov. (lot extension-favoris-liste), telles quelles
- **17 nov. · Scanner un bordereau de vente (lot scan-bordereau-vente, URGENT)** : mesuré sur son étiquette Mondial Relay : 3 grands codes « lettre + 19 chiffres » SANS le n° de suivi (le téléphone lit celui-là) + un « 55… » de 26 chiffres sur le bord ; les étiquettes captées n'ont aucun n°. Un code inconnu est cherché, lettres et chiffres, dans le texte des étiquettes de SES ventes (`src/etiquettesScan.js`, identité exacte) ⇒ sa vente ; caméra, douchette ; inconnu ⇒ « Code lu » + quoi faire ; « 55… » = Mondial Relay. `2026-11-17-scan-bordereau-vente.md`. Geste : aucun.
- **16 nov. · Scanner un colis d'achat (lot scan-achat)** : le n° de suivi scanné (caméra, douchette, saisie) ⇒ « Dans ce colis » : photo, titre, taille · état, lot en liste (lus dans SA transaction), payé, date, vendeur ; « Ranger » (atelier d'arrivée), « Signaler un problème » (sa conversation Vinted), « Ce n'est pas ça » ; inconnu ⇒ « Colis inconnu · Relier à un achat » (SON toucher, n° gardé comme identité). Mesuré : 43 achats sur 135 (30 j) ont un n°. `2026-11-16-scan-achat.md`. Geste : aucun.
- **17 nov. · Relier en touchant (lot relier-toucher)** : plus jamais d'appui long obligatoire — un toucher choisit l'achat (ou la vente/annonce), bandeau fixe « Achat choisi · Changer », la liste d'en face prend la place, un toucher ⇒ « Relier N°… ? » ⇒ bénéfice + Reçu, Annuler 5 s ; « ⋯ » d'un achat (et sa fiche) : « Relier à une vente / annonce ». `docs/passation/2026-11-17-relier-toucher.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée le 17 nov. (lot extension-carte-v2, après fusion de main), telle quelle


## Lignes déplacées telles quelles de CLAUDE.md §9 (17 nov., fusion de main dans design-v2-argent, pour rester sous 59 000 octets)

- **17 nov. · La taille à côté de chaque achat à relier (lot relier-taille)** : Relier un achat, Relier achats et ventes, colis à relier : taille LUE chez Vinted (détail de transaction, par n°) sinon « (titre) », « ✓ Taille 42 » / « ≠ 42 » face à l'article (encre neutre, jamais un lien auto), état, vendeur ; « N achats sans taille lue » une fois. Description : rangée nulle part (reste, extension). `docs/passation/2026-11-17-relier-taille.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée le 17 nov. (lot extension-favoris-liste, après fusion de main), telle quelle
- **17 nov. · La taille à côté de chaque achat à relier (lot relier-taille)** : Relier un achat, Relier achats et ventes, colis à relier : taille LUE chez Vinted (détail de transaction, par n°) sinon « (titre) », « ✓ Taille 42 » / « ≠ 42 » face à l'article (encre neutre, jamais un lien auto), état, vendeur ; « N achats sans taille lue » une fois. Description : rangée nulle part (reste, extension). `docs/passation/2026-11-17-relier-taille.md`. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée le 17 nov. (PR #1250, après fusion de main), telle quelle
- **17 nov. · Scanner un bordereau de vente (lot scan-bordereau-vente, URGENT)** : mesuré sur son étiquette Mondial Relay : 3 grands codes « lettre + 19 chiffres » SANS le n° de suivi (le téléphone lit celui-là) + un « 55… » de 26 chiffres sur le bord ; les étiquettes captées n'ont aucun n°. Un code inconnu est cherché, lettres et chiffres, dans le texte des étiquettes de SES ventes (`src/etiquettesScan.js`, identité exacte) ⇒ sa vente ; caméra, douchette ; inconnu ⇒ « Code lu » + quoi faire ; « 55… » = Mondial Relay. `2026-11-17-scan-bordereau-vente.md`. Geste : aucun.

## Ligne déplacée telle quelle de CLAUDE.md §9 (17 nov., fusion de design-v2 dans design-v2-argent, sous 59 000 octets)

- **17 nov. · Un colis, deux transporteurs (lot suivi-multi-transporteurs, ext. 5.403.0)** : un envoi international (Shop2Shop puis Chronopost) a DEUX n° pour le même colis ; l'extension range tous les n° du trajet, l'app ET le serveur relient le colis du transporteur à l'achat par n'importe lequel (`api/_lib/suivis-multiples.js`) ⇒ UNE ligne au nom de l'article, avec code et QR, plus d'« incident » d'un autre n° du trajet. En attendant la liste (lignes d'avant) : « C'est sans doute le même colis — Relier » seulement si un colis + un achat au même point, même groupe de transporteur, arrivé après l'achat, aucun autre achat en route (`src/memeColis.js`) — SON toucher relie ; « Ce n'est pas le même » gardé (`vrm_colis_pas_meme`) ; une liste LUE qui contredit un lien manuel ⇒ « délier ? ». `2026-11-17-suivi-multi-transporteurs.md`. Geste : installer 5.403.0, ouvrir vinted.fr.

## Ligne du §9 de CLAUDE.md déplacée le 17 nov. (lot emails-beaux, 2e fusion de main), telle quelle
- **17 nov. · La taille à côté de chaque achat à relier (lot relier-taille)** : Relier un achat, Relier achats et ventes, colis à relier : taille LUE chez Vinted (détail de transaction, par n°) sinon « (titre) », « ✓ Taille 42 » / « ≠ 42 » face à l'article (encre neutre, jamais un lien auto), état, vendeur ; « N achats sans taille lue » une fois. Description : rangée nulle part (reste, extension). `docs/passation/2026-11-17-relier-taille.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée le 18 nov. (lot tampon-qr, fusion de main), telle quelle
- **17 nov. · Un colis, deux transporteurs (lot suivi-multi-transporteurs, ext. 5.403.0)** : un envoi international (Shop2Shop puis Chronopost) a DEUX n° pour le même colis ; l'extension range tous les n° du trajet, l'app ET le serveur relient le colis du transporteur à l'achat par n'importe lequel (`api/_lib/suivis-multiples.js`) ⇒ UNE ligne au nom de l'article, avec code et QR, plus d'« incident » d'un autre n° du trajet. En attendant la liste (lignes d'avant) : « C'est sans doute le même colis — Relier » seulement si un colis + un achat au même point, même groupe de transporteur, arrivé après l'achat, aucun autre achat en route (`src/memeColis.js`) — SON toucher relie ; « Ce n'est pas le même » gardé (`vrm_colis_pas_meme`) ; une liste LUE qui contredit un lien manuel ⇒ « délier ? ». `2026-11-17-suivi-multi-transporteurs.md`. Geste : installer 5.403.0, ouvrir vinted.fr.

## Ligne du §9 de CLAUDE.md déplacée le 18 nov. (lot stock-rangement, fusion de main), telle quelle
- **17 nov. · Accessibilité WCAG 2.1 AA (lot accessibilite)** : focus double encre+blanc partout (`src/design/accessibilite.css`, couche `vrm-a11y` nommée AVANT `vrm-verre`), fiche « Tout sur le N° » qui garde et rend le focus, encre claire sur le bleu (Meilleures sources, résumé d'Annonces), « Aller au contenu » + colonne avant l'écran, 44 px, noms lus ; banc `accessibilite.cjs` partie E (49 rouges sur main, 0 après). `2026-11-17-accessibilite.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée le 18 nov. (lot vitesse-poids, 3e fusion de main), telle quelle
- **17 nov. · Fiabilité et vitesse** : démarrage 2 344 → 2 087 Ko de JS+CSS (pdf-lib hors du morceau App, 30 blocs rares à la demande) ; `vrm_avis_bas` lue une fois ; QR plus jamais lus hors CSP ; audits `morceau-app`, `avis-bas-partage`, `qr-csp`. `2026-11-17-fiabilite-vitesse.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée le 18 nov. (lot groupes-coucou, après fusion de main), telle quelle
- **17 nov. · Accessibilité WCAG 2.1 AA (lot accessibilite)** : focus double encre+blanc partout (`src/design/accessibilite.css`, couche `vrm-a11y` nommée AVANT `vrm-verre`), fiche « Tout sur le N° » qui garde et rend le focus, encre claire sur le bleu (Meilleures sources, résumé d'Annonces), « Aller au contenu » + colonne avant l'écran, 44 px, noms lus ; banc `accessibilite.cjs` partie E (49 rouges sur main, 0 après). `2026-11-17-accessibilite.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée le 18 nov. (lot stock-rangement, fusion de main), telle quelle
- **17 nov. · Scanner instantané (lot scan-instantane)** : Safari n'a pas `BarcodeDetector` — ZXing JS figeait l'écran (418 ms/s) et ne lisait un Code 128 que tout près. Lecteur zxing-cpp WebAssembly (`zxing-wasm`, MIT) dans un worker (`src/lecteurCodes.worker.js`), milieu du viseur agrandi ×2, zoom 2× posé, « Ouvrir la vente » ⇒ LA fiche à l'instant (plus rouverte 3 fois). Banc `scan-instantane`. `2026-11-17-scan-instantane.md`. Geste : essayer à 30–40 cm.
- **17 nov. · Extension 5.406 (lot extension-carte-v2)** : « prochain dans 10 min » = refus d'attente (ouverture de Vinted, 15/h, 50/h) payé 10 min FIXES par le serveur ⇒ la vraie attente et sa raison ; carte design v2, feuille commune `vrm-ui.js`, écran « action en cours » ; aucune garde retirée. `2026-11-17-extension-carte-v2.md`. Geste : installer 5.406.

## Ligne du §9 de CLAUDE.md déplacée le 18 nov. (lot chasse-bugs, fusion de main), telle quelle
- **17 nov. · Onglets rapides (PR #1250)** : l'anneau d'ondulation n'est plus inséré à chaque toucher (une insertion sous <body> restylait tout le document via les `html:has`, 2,5–4,2 s au ×4) ; `vrm_a_trancher` ne fait plus remonter Achats/Ventes gardés ; `panel_num_reserves` une lecture en vol (`src/lectureEnVol.js`) ; instantané de Ma journée : chiffres du mois dans l'ordre de l'écran vrai. Bancs `onglets-rapides`, `journee-stable`. `2026-11-17-onglets-rapides.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée le 18 nov. (lot design-v2-ventes, fusion de main), telle quelle
- **17 nov. · E-mails envoyés (lot emails-beaux)** : 13 e-mails de VRM dans la langue du compte (fr/en/es/it/de, `api/_lib/mail-textes.js`), bouton VML pour Outlook, « Envoyé par VRM · vrm.center » au pied, sujet du bilan avec le vendu ; modèles Supabase en 5 langues (`audit-emails-beaux`, planche `scripts/emails-planche.cjs`). `2026-11-17-emails-beaux.md`. Geste : recoller les 6 modèles `supabase/templates/` dans Supabase.

## Ligne du §9 de CLAUDE.md déplacée le 18 nov. (lot moteur-rapide, fusion de main), telle quelle
- **17 nov. · « Créé par vrm.center » juste au-dessus du code, et ne s'enlève plus (lot tampon-qr)** : centrée sur le plus grand QR/DataMatrix/MaxiCode (sinon le code-barres), 3 mm au-dessus, dans le SENS de l'étiquette, police réduite jusqu'à 4,5 pt, sinon rien — jamais dessous ni à côté ; aucune case/place/taille, un « sans mention » rangé ignoré ; Paramètres → Tampons montre SON dernier bordereau par transporteur (sinon « Exemple »). Bancs `tampon-qr` 33/33, `tampons-page`. `2026-11-17-tampon-qr.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée le 18 nov. (lot vitesse-cache, fusion de main), telle quelle
- **17 nov. · Nouveau design « Studio Premium » ALLUMÉ PAR DÉFAUT (lot design-v2, #1246) + plus de disque « + » + barre d'onglets en 5 styles** : Aujourd'hui, Annonces (A/C), Achats (passes, liste propre, « Annulés · N »), chargement immobile, l'AIR ; « Ancien design » (Paramètres → Apparence) ramène l'apparence d'avant, identique à main ; « Barre d'onglets » C par défaut (A, B, D, E au choix, synchronisé). Les bancs d'hier voient l'ancien design (`_garde-reseau.cjs`). Détail : `docs/passation/2026-11-17-design-v2.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée le 18 nov. (lot design-v2-argent, fusion de main), telle quelle
- **17 nov. · Vitesse : le poids du démarrage (lot vitesse-poids)** : Ma journée 2 087 → 1 945 Ko de JS+CSS (budget-vitesse VERT) — le français des écrans à la demande part avec eux (`fr-reste`, au build : `scripts/_francais-differe.cjs`, fr.js reste complet), noms courts par terser (mangle seul), QR à la demande. CSS morte : 0,3 Ko prouvable, rien retiré. `2026-11-17-vitesse-poids.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée le 18 nov. (lot relier-tout-achat, fusion de main), telle quelle
- **17 nov. · Groupes : créer en 3 étapes, et le coucou (lot groupes-coucou)** : feuille guidée (photo · règles dites, RIEN partagé par défaut · inviter : QR, Partager, lien Discord) ; page du groupe ; coucou 👋 sans aucun texte, UN geste « Lui écrire sur Discord » (profil signé, sinon salon du groupe, sinon « Pas de Discord lié »), 1/paire/24 h, 20/jour, sourdine, même groupe seulement ; migration **046 PAS APPLIQUÉE** (« bientôt » d'ici là). `2026-11-17-groupes-coucou.md`. Geste : appliquer la 046, coller le lien Discord du groupe.

## Ligne du §9 de CLAUDE.md déplacée le 18 nov. (lot carte-coucou, fusion de main), telle quelle
- **17 nov. · Stock « Ranger » naturel (lot stock-rangement, nouveau design, `vrm_design_v2`, allumé par défaut depuis #1246)** : la liste d'abord (rangée A, glisser = Ranger), « Ranger N » = séance une paire à la fois (la case proposée suit la dernière place, mouvement « fait »), « Où est N° » = l'étiquette kraft de sa place, Paires · Places ; règles inchangées, éteint = identique. `2026-11-17-stock-rangement.md`. Geste : l'essayer.

## Ligne du §9 de CLAUDE.md déplacée le 18 nov. (lot extension-favoris-liste, fusion de main), telle quelle
- **17 nov. · Nouveau design, phase 2 : Ventes (lot design-v2-ventes, ESSAI)** : titre + « Imprimer N » + cloche sur une ligne, segmenté, « N colis à envoyer » + écart nommé, recherche (scanner dedans), groupes par échéance, rangées A à 3 lignes, barre de sélection neuve, facture = icône verte ; frise : le transporteur tranche (2 designs). `2026-11-17-design-v2-ventes.md`. Geste : aucun.
- **18 nov. · Style « Apple » (lot theme-apple), ÉTEINT par défaut** : Paramètres → Apparence → Style « Apple » / « Studio bleu » (`vrm_style`, cet appareil) ; couche `vrm-apple` (première) sous `html[data-theme-style="apple"]` : fond #F2F2F7/#000, cartes pleines, système, un bleu, barre translucide — jetons seulement. Banc `theme-apple`. `2026-11-18-style-apple.md`. Geste : l'allumer sur l'iPhone.
- **17 nov. · Chasse aux bugs (lot chasse-bugs)** : « Imprimer N » compte EXACTEMENT ce qui est coché et part (retours compris, « · dont 1 retour ») et « Choisir » nomme les absents ; un écran ouvert par un geste/segment s'ouvre EN HAUT (`src/defilementNavigation.js`, retour par la barre = sa position) ; achats annulés cachés, filtre « Annulés · N » ; puce « Code pas encore lu » (plus « Incident ») ; bancs périmés portés. `2026-11-17-chasse-bugs.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée le 18 nov. (lot republication-parfaite, fusion de main), telle quelle
- **17 nov. · Ouvrir une vente (PR #1253, lot vitesse-cache)** : une vente Vinted de « Toutes » ouvre SA fiche par son n° de transaction (2,6–3,2 s → 0,34–0,55 s), « Ses gestes dans Ventes · Vinted » dedans ; l'histoire des N° gardée entre deux fiches (`src/histoireGardee.js`, périmée au moindre changement). `2026-11-17-vitesse-cache.md`. Geste : aucun.
- **18 nov. · Moteur rapide (1a #1265, 1b)** : Ma journée cachée ne recalcule plus ses 2 200 lignes à chaque lecture (`journeeGelee`) ; « commandes à vérifier » refait seulement si une de ses entrées change (clé générée et vérifiée : `audit-cle-verifier` ; stockage lu suivi : `src/versionDonnees.js`, `audit-version-donnees`). 2e ouverture ×4 : tâches longues 11,3 → 8,9 s ; chiffres identiques. `2026-11-18-moteur-rapide.md`. Geste : aucun.


## Lignes « État actuel » du 17 nov., déplacées de CLAUDE.md §9 le 19 nov. (telles quelles)

- **17 nov. · Republication parfaite (ext. 5.408)** : mesuré 10 republiées, 0 en ligne du 1er coup (refus 400 photos), 5 supprimées jamais en ligne ⇒ étapes datées, « Reprendre », « Recréer depuis le coffre », chaîne/plan/bilan dans l'atelier. `2026-11-17-republication-parfaite.md`. Geste : 5.408, « Reprendre » les 5.
- **17 nov. · Favoris en liste à cocher (lot extension-favoris-liste, ext. 5.407)** : « il faut une liste avec les favoris pour pouvoir les sélectionner » ⇒ la carte liste TOUS les favoris encore en vente (`apercu.tous`, règle du serveur = celle de l'app), coche, filtre, récapitulatif (offre, message, durée au vrai rythme), 15 par heure (les autres restent cochés) ; prix mini à côté du N° ; écran plein continu (plus d'« éclair » quand Vinted bloque, rechargement, SPA), défilement verrouillé ; captcha ⇒ file en PAUSE, « Reprendre » sur SON toucher une fois la vérification faite ; l'extension refuse tout favori non cochable ; aucune garde retirée. `2026-11-17-extension-favoris-liste.md`. Geste : installer 5.407.
- **17 nov. · Carte : le coucou remplace les messages (lot carte-coucou)** : plus d'« Écrire », de fil ni de « non lus » (route 410) ; « 👋 Coucou » sans texte, mêmes bornes que les groupes, « Lui écrire sur Discord » ; historique gardé en base. Migration **047 PAS APPLIQUÉE** (après la 046). `2026-11-17-carte-coucou.md`. Geste : appliquer 046 puis 047.
- **17 nov. · Relier : tous ses achats, déjà reliés, lots ; iPhone réparé (lot relier-tout-achat)** : « Suggestions » puis « Tous mes achats » (recherche large, filtres, tranches de 60) ; un achat RELIÉ n'est plus proposé, « Déjà reliés » ⇒ « Le détacher de N°… ? » ; LOT (`nombreLot`) relié jusqu'à N fois, prix « à saisir » ; hors relier comptés. « Relier achats et ventes » au téléphone : un seul défilement, une liste à la fois, deux touchers, poignée. `2026-11-17-relier-tout-achat.md`. Geste : aucun.
- **17 nov. · Messages et E-mails, nouveau design (lot design-v2-messages)** : un segmenté, comptes SÉPARÉS façon Mail (onglet d'abord), étiquette N°, bulles ; e-mails À traiter · Colis · Ventes · Achats · Tout, « Ranger », « C'est à moi » ; A8. `2026-11-17-design-v2-messages.md`. Geste : aucun.
- **17 nov. · Nouveau design, phase 2 : Argent et Paramètres (lot design-v2-argent, ESSAI)** : « X € reçus en novembre », six mois, 4 faits (un fait pas su nommé sur une ligne), un seul plein, versements à étiquette N° (acheté → marge si connu) ; Factures et Paramètres refaits ; aucun calcul changé. `2026-11-17-design-v2-argent.md`. Geste : aucun.

### Lignes du 19 nov. déplacées de CLAUDE.md §9 le 20 nov. (intégration 20nov), telles quelles
- **19 nov. · Ventes natif (ventes-comme-avant)** : À envoyer · En route · Terminées, rangée = titre sur 2 lignes + N° + date limite (la place dans la fiche), plein collé au-dessus des onglets, détail à droite à l'ordinateur. `2026-11-19-ventes-comme-avant.md`. Geste : aucun.
- **19 nov. · Prix d'achat repris du reçu (décision « 2 oui »)** : achat relié par identité + reçu lu et juste ⇒ son montant posé seul (`src/prixAchatRecu.js`, `champsSiVide` : une saisie gagne toujours), jamais un lot, dit une fois ; l'atelier « Compléter » n'en garde pas de copie. `2026-11-19-completer-infos.md` (fin). Geste : aucun.
- **19 nov. · Codes de retrait parfaits** : 5 colis sur 16 jamais lus chez Mondial Relay (code postal du point refusé, reproposé sans fin) ⇒ l'essai par le code postal prouvé ; codes de consigne, mêlés, en groupes, UPS/InPost lus ; consigne ≠ comptoir (deux passes) ; « Nouveau code de retrait » en direct (veille `email_track_*`, `panel_colis_relais`). `2026-11-19-retraits-parfaits.md`. Geste : aucun. Geste : aucun.
- **19 nov. · Page Extension (extension-claire puis extension-utile)** : UN endroit pour l'extension et les comptes, dit avant le geste (ext. `etatici`) ; grand panneau, feuille « Depuis ta dernière visite » (ext. `captejournal`), rythme favoris 40–90 s, `audit-actions-gardees`. `2026-11-19-extension-claire.md`, `2026-11-19-extension-utile.md`. Geste : aucun.
- **19 nov. · Capacité 3 000 vendeurs (capacite-3000)** : mesures et plan ; Vercel reste Hobby, 048 appliquée, trains 1–2/jour. `docs/capacite-3000.md`. Geste : aucun.


### CLAUDE.md §9 — lignes du 19 nov. déplacées telles quelles le 20 nov. (intégration 5.410)

- **19 nov. soir · L'app en tableaux de travail (NATIF §2 bis)** : `TableauTravail` (Statut à compteurs, colonnes mémorisées, tri, sélection) sur Annonces, Ventes « Toutes », Achats, Notifications à l'ordinateur ; écran Automatisations (réglages des moteurs existants ; négociation par paliers rangée `vinted_offres_nego`, « bientôt », rien envoyé ; pas de boost de favoris). `2026-11-19-app-tableaux.md`. Geste : aucun.
- **19 nov. · Publier sur… : fiche neutre + agent sans IA (ext. `publierfiche`, 5.409)** : tables par champ et par site dans les deux sens, Vinted cible par `creerVintedFiche`, une question groupée par article, réponses retenues (`vrm_agent_publier`), l'extension publie, catégorie relue, formulaires Leboncoin appris. `2026-11-19-publier-agent.md`. Geste : publier UN article Leboncoin → Vestiaire et regarder.
- **19 nov. · Fiche d'un article refaite (fiche-directe)** : un toucher ⇒ la fiche produit (page poussée au téléphone, volet à l'ordinateur), les messages passagers rangés DANS la fiche (`src/natif/zoneMessages.js`). `2026-11-19-fiche-directe.md`. Geste : aucun.
- **19 nov. · Stock en meubles et étiquetage (stock-etiquetage)** : meubles dessinés pleine largeur, méthode d'étiquetage (`vrm_etiquetage`). `2026-11-19-stock-etiquetage.md`. Geste : choisir sa méthode d'étiquetage.
- **19 nov. · Relier mes annonces, une à la fois (liaison-sites-guidee)** : photo contre photo, annulable 10 s ; publiées Leboncoin/Vestiaire retenues par identifiant (ext. `lbcpubliee` `vcpubliee`). `2026-11-19-liaison-sites-guidee.md`. Geste : aucun.
- **19 nov. · Train du 19 nov. (ext. 5.409.0, branche `claude/integration-19nov`)** : un seul lot d'extension pour tout le train ; budget de démarrage relevé à 2 000 Ko ; N° neufs en Toast + Stock « À écrire sur tes cartons ». Décisions « 1, 2, 3, 4 oui » : §3. `2026-11-19-integration.md`, `2026-11-19-demandes-julien.md`. Geste : installer 5.409, appliquer rien de neuf (048 déjà appliquée).
- **19 nov. · VRM natif, coque (natif-fondation)** : 5 onglets égaux en bas, titre et barre latérale natifs, « Plus » derrière la photo du profil (`src/natif/`). `2026-11-19-natif-fondation.md`. Geste : aucun.
- **19 nov. · Lisible partout (lisible-partout)** : un seul style, habillages « VRM »/« Apple »/ancien design retirés, aucun texte blanc sur clair. `2026-11-19-lisible-partout.md`. Geste : aucun.
- **19 nov. · Vite et sans bug (vite-et-sans-bug)** : `:has` de racine remplacés par des drapeaux `data-vrm-dN` (`src/drapeauxRacine.js`, banc `drapeaux-justes`). `2026-11-19-vite-et-sans-bug.md`. Geste : aucun.
- **19 nov. · Aujourd'hui natif (aujourdhui-propre)** : tes chiffres d'abord (jour, semaine, mois), « À régler » rangé dans chaque onglet. `2026-11-19-aujourdhui-propre.md`. Geste : aucun.
- **19 nov. · Compléter (reprise-completer)** : une question à la fois (prix d'achat, prix mini, N°) ; prix d'achat repris du reçu. `2026-11-19-completer-infos.md`. Geste : aucun.
- **19 nov. · Annonces à égalité (annonces-a-egalite)** : Leboncoin, eBay, Vestiaire portent prix mini, achat, N° comme Vinted (`vrm_articles_sites`). `2026-11-19-annonces-a-egalite.md`. Geste : aucun.
- **19 nov. · Changer le prix en un geste, baisse par règle, vendue ailleurs masquée (prix-sans-manuel)** : ext. `prixattente` `baisseregle` `masquerailleurs`. `2026-11-19-prix-sans-manuel.md`. Geste : allumer la règle s'il la veut.
- **19 nov. · Compte bloqué par Vinted (compte-bloque)** : VRM demande pause/garder, remet seul au déblocage (ext. `comptebloque`). `2026-11-19-compte-bloque.md`. Geste : répondre à la question pour le compte bloqué.
- **19 nov. · Colis : ce qu'il y a dedans, seul (colis-achat-auto + codes de retrait en liste, PR #1273)** : plus de « Relier l'achat » (ext. `suivicolis`). `2026-11-19-colis-achat-auto.md`. Geste : aucun.
- **19 nov. · E-mails comme Mail (emails-mail)** : segments en haut, liste en grand, l'e-mail à côté ; « Relier ma boîte » pas à pas (Gmail, Outlook, iCloud), essai vérifié en direct. `2026-11-19-emails-mail.md`. Geste : aucun.

### Lignes de CLAUDE.md §9 déplacées telles quelles le 20 nov. (fusion de main dans instantane)
## Lignes du 20 nov. retirées de CLAUDE.md §9 (déplacées telles quelles)
- **20 nov. · Colis à retirer visuels (retraits-visuel)** : une carte par point, le contenu d'abord (photo de l'achat relié), barre du trajet sur dates LUES (`src/retraitTrajet.js`), QR à droite du code ; rétention : un « à vérifier » (date limite dépassée) garde code et QR jusqu'à une fin PROUVÉE ; « Je suis au point » retiré (sa décision). `2026-11-20-retraits-visuel.md`. Geste : aucun.
- **20 nov. · Ce qui manque (ce-qui-manque)** : vues et favoris lus dans le dressing (aucune requête de plus, `vrm_vues_lues`, carte d'Aujourd'hui, colonnes du tableau) ; stock au prix affiché (`vrm_stock_valeur`, une paire comptée une fois) ; Messages très grand texte ; compte bloqué : changer d'avis depuis la page Extension ; Stock « Personnaliser », « La pièce », glisser à la souris. `2026-11-20-ce-qui-manque.md`. Geste : aucun.
- **20 nov. · L'arrivée d'un achat : N°, case, étiquette (arrivee-scan)** : « J'ai retiré » (porte principale) ou le scan « Arrivée » (Achats, Stock, recherche) ⇒ l'écran d'arrivée de CET achat (identité seule), « Ranger ici » en un geste annulable 10 s ; hors ligne : aucun N° donné. `2026-11-20-arrivee-scan.md`. Geste : aucun.
- **20 nov. · Bien démarrer, démo, Tout va bien ? en points, Chrome Web Store 5.409 (demarrage-store)** : parcours de 5 min en pages poussées (sites, extension en direct, comptes captés, étiquetage, import), démo d'exemple natif, « Tout va bien ? » = un point, un geste ; dossier Store à jour. `2026-11-20-demarrage-store.md`. Geste : publier sur le Chrome Web Store (pas à pas en tête de `docs/chrome-web-store/README.md`).
- **20 nov. · Chasse aux bugs 2 (chasse-bugs-2)** : saisie des nombres d'Automatisations, pastille Messages vivante, bénéfice « pas calculé » au lieu de 0 €, pluriels croisés (5 langues), cibles 44 px ; bancs hors-ligne / froid / réseau-instable sur la vraie forme ; nouveau banc `parcours-chasse`. `2026-11-20-chasse-bugs-2.md`. Geste : aucun (« Je dépose » encore présent : à trancher).
- **20 nov. · Chasse aux bugs (chasse-bugs)** : dates sans année lues au jour de l'e-mail, regroupement des offres, lecture `capte_journal_*` avant la porte, « pas su » de Ma journée/Annonces, borne de préparation, accueil hors portée (nouvel `audit-portee-modules`), pont 048 ; ~30 audits périmés remis sur la règle ; restes nommés. `2026-11-20-chasse-bugs.md`. Geste : aucun.

- **20 nov. · Train du 20 nov. (intégration, branche `claude/integration-20nov`)** : boutons-natifs, relier-depuis-liste, retraits-visuel, ce-qui-manque, arrivee-scan, demarrage-store, chasse-bugs + chasse-bugs-2 ; extension inchangée (5.409.0) ; manifeste au fond natif ; N° du meuble jamais coupé ; budget de démarrage 2 020 Ko. `2026-11-20-integration.md`. Geste : aucun.
- **20 nov. · Des boutons beaux et fiables partout (boutons-natifs)** : `BoutonBase`/`Btn`/`BoutonV2`/segmentés d'avant dessinent le `Bouton`/`Segmente` natif ; un geste qui rend une promesse ne se double pas et dit son résultat ; 261 `vrm-b` bruts convertis ; banc `boutons-inventaire`, `audit-boutons-natifs` (plafonds). `2026-11-20-boutons-natifs.md`. Geste : aucun.

- **20 nov. · Republier = copie fidèle + contrôle avant ; favoris qui sautent ce qui serait refusé (ext. `repubfidele` `repubverif` `messagesmalins`, 5.410)** : brouillon = formulaire de l'annonce en ligne champ par champ (seules les photos renvoyées) ; atelier « N à corriger avant de lancer » (Lancer fermé) ; versions de message sûres (`src/messageSur.js` recopiée par script), version refusée jamais retirée, vendus / sous prix mini / conversation refusée sautés, bilan. `2026-11-20-repub-messages-malins.md`. Geste : un essai d'une paire.
- **20 nov. · Leboncoin : les intéressés ; Vestiaire : date et baisse par règle (lbc-vc-interesses, ext. 5.410 `lbcinteresses` `lbcecrireinteresses` `vcdatemise` `baissevc`)** : intéressé = la personne qui a ÉCRIT sur l'annonce (jamais un favori, jamais un nom) ; « Leur écrire » = geste du PANNEAU (`ecrireInteressesLbc`, 40–90 s, une fois par personne) ; Vestiaire : `listingDate` lue, sinon « vue en ligne depuis au moins le … » ; paliers Vestiaire pas branchés (aucune offre lue). `2026-11-20-lbc-vc-interesses.md`. Geste : répondre une fois à la main sur Leboncoin, changer un prix une fois sur Vestiaire.
- **20 nov. · Panneau de l'extension comme Vintex + lien profond (ext. 5.410.0, `claude/panneau-vintex`)** : barre latérale, pages en tableau, Accueil, automatisations à deux volets ; l'app ouvrira le panneau par `src/ouvrirPanneau.js` (`?vrm=panneau&page=&ids=&action=`, rien ne part sans son toucher). `2026-11-20-panneau-vintex.md`. Geste : installer la 5.410 quand elle sera servie.
- **20 nov. · Toute action se fait dans l'extension (actions-extension)** : chaque geste Vinted/Leboncoin/Vestiaire de l'app = « … dans l'extension » (`lienPanneau`, `src/ouvrirPanneau.js`) ; le pont refuse `CMDS_PLATEFORME` et toute écriture (`src/actionsExtension.js`) ; ateliers et écran Automatisations retirés (Paramètres : une rangée) ; eBay reste. `audit-actions-app --mutation`. `2026-11-20-actions-extension.md`. Geste : aucun.
- **20 nov. · Annonces divisées par compte + téléphone revu + Argent fusionné (minimaliste)** : un groupe par compte, rangée courte, manque dit une fois, plein détaché des onglets ; `claude/argent-natif` fusionné, UN sélecteur. `2026-11-20-minimaliste.md` §2 ter-quater. Geste : aucun.
- **20 nov. · Sélecteur de plateforme global (décision, RETIRÉ le soir même — voir « sans-selecteur »)** : onglets par fonction + UN segmenté « Tous · sites reliés » (`src/siteCourant.js`, `vrm_site_courant`, `src/natif/SelecteurSite.jsx`) qui remplace les filtres de site locaux ; Argent à brancher (`claude/argent-natif`). `2026-11-20-minimaliste.md` §2 bis. Geste : aucun.
- **20 nov. · Tout le site simple « comme Paramètres » + mêmes dispositions sur chaque site (minimaliste)** : cartes → groupes, ombres de carte retirées (`src/natif/minimaliste.css`), Ventes · eBay et · Leboncoin dans la liste native de Vinted ; banc `minimaliste`. `2026-11-20-minimaliste.md`. Geste : aucun.
- **20 nov. · Argent au style convenu + barre du haut (argent-natif)** : barre avec fond au défilement sur tous les écrans (refs relues), grand titre « Argent », Mois/Déclarer/Statistiques/Factures en cartes natives, sélecteur de plateforme `src/natif/SelecteurSite.jsx` (`vrm_site_courant`). `2026-11-20-argent-natif.md`. Geste : aucun.
- **20 nov. · L'app rapide sur iPhone (iphone-rapide)** : banc `iphone-rapide` (390@3, CPU ×4, 4G, service worker, base de volume) ; feuilles livrées « rangées » au build (`scripts/_selecteurs-ranges.cjs` : `:is(a, b)` déplié, styles calculés identiques — banc `styles-identiques`), recalcul de style −57 à −62 % ; formateurs Intl gardés (`src/formatsRapides.js`) ; « Quoi de neuf » hors du démarrage (budget 1 998 Ko) ; objectifs PAS atteints, la suite chiffrée : `2026-11-20-iphone-rapide.md` §5. Geste : aucun.
- **20 nov. · 2ᵉ train du 20 nov. (ext. 5.410.0, branche `claude/integration-5410`)** : panneau-vintex (avec actions-extension, repub-messages-malins, lbc-vc-interesses) + minimaliste (avec argent-natif) ; écrans de gestes retirés gardés retirés, style minimaliste sur ce qui reste ; « Relier » d'Annonces · eBay laissé au bandeau (sa réponse attendue) ; paquets 5.410.0. `2026-11-20-panneau-vintex.md`, `2026-11-20-minimaliste.md`. Geste : installer la 5.410.0 dans CHAQUE Chrome.
- **20 nov. · Affichage instantané (instantane)** : chaque onglet s'ouvre sur SA copie (`src/copieEcran.js`, IndexedDB `vrm_copie_{owner}_{ecran}`, du jour, par compte, effacée à la déconnexion), inerte et datée, peinte même avant l'app ; base injoignable ⇒ « Pas à jour · Réessayer » ; squelettes natifs ≤ 6 %. `2026-11-20-instantane.md`. Geste : aucun.
- **20 nov. · Ext. 5.410.2 : le panneau reste ouvert, bordereau et livreur, « pas revue »** : seuls son × / Échap le ferment (hôte replacé, état par onglet en `storage.session` via `panneauEtat`) ; Commandes et Accueil : transporteur, suivi, date limite, « Imprimer le bordereau » (`bordereauCarte`, lecture seule) ; « à confirmer » ⇒ « Pas revue depuis N j » (app et extension). `2026-11-20-extension-5412.md`. Geste : installer la 5.410.2.
- **20 nov. · Ventes en tableau de travail (ventes-tableau)** : à l'ordinateur, À envoyer / En route = `TableauTravail` (transporteur en logo, statut en étiquette, cases = le lot, « Imprimer N » dans la barre, détail au toucher seulement) ; téléphone : logo + étiquette ; Terminées garde le segmenté. `2026-11-20-ventes-tableau.md`. Geste : aucun.
- **20 nov. · Lectures légères (lectures-legeres)** : commandes par `/api/compte?mode=commandes-lire` (session, compressées, ETag/304 ; repli sur la lecture d'avant) 2 069 → 303 Ko à froid ; dressings après les commandes ; preuves de vente sur la famille `txn2` gardée ; `src/memoCourt.js`. `2026-11-20-lectures-legeres.md`. Geste : aucun.
- **20 nov. · Relier achats et ventes : toutes les paires (relier-achats)** : plus récent d'abord des deux côtés, pastilles plateforme/marque/taille gardées, seuls les achats arrivés ; ventes > 12 mois, masquées, Leboncoin/eBay/Vestiaire ajoutées ; Achats (ordi) : colonne n° de suivi. `2026-11-20-relier-achats.md`. Geste : aucun.
- **20 nov. soir · Plus de sélecteur de plateforme (sans-selecteur)** : tout mélangé, logo du site sur chaque rangée, filtre « Site » seulement dans les filtres des tableaux à l'ordinateur ; `vrm_site_courant` ignoré. `2026-11-20-sans-selecteur.md`. Geste : aucun.
- **20 nov. nuit · Tout comme Bleam (ext. 5.410.3 + 5.410.4)** : formulaire Vinted, favoris, après-vente, négo par tranches, cycle de vie, dressing amélioré, rôle de compte (personnel hors CA). `2026-11-20-comme-bleam.md`, `2026-11-20-bleam-suite.md`. Geste : installer 5.410.4, essayer UNE republication ; évaluation auto et boîte aux lettres apprises d'un geste à la main.
- **20 nov. · Ventes : retours et litiges, en-tête collant, Relier (ventes-retours)** : UN groupe « Retours et litiges » replié, rangées du tableau ; en-tête opaque collant ; colonne « Achat » (les maillons, son toucher) ; méta d'En route = étape prouvée. `2026-11-20-ventes-retours.md`. Geste : aucun.
- **20 nov. nuit · Vérification visible, envois comme Bleam (ext. 5.410.5)** : faux « anti-robot » (`is_suspicious` d'une réponse 200) corrigé ; onglet de travail VRM pour tous les envois, séquence favoris = Bleam (fil relu, sans `mark_as_read` ni transaction), délais VRM jamais plus courts ; panneau replié devant une vraie vérification. `2026-11-20-captcha-visible.md`. Geste : installer 5.410.5, laisser la petite fenêtre VRM ouverte.

## Lignes du §9 de CLAUDE.md déplacées le 22 nov. (intégration finale), telles quelles

- **21 nov. · Favoris corrigés (ext. 5.410.8)** : file annulée ⇒ à nouveau « à envoyer » (cases), file d'hier dite (Reprendre / Annuler / « Annuler l'ancienne et envoyer à N »), onglet de travail VOILÉ en permanence sur /inbox, cloche lue avant chaque favori (trop ancien ⇒ sauté), écritures par XHR ; ⚠️ décision de Julien : **l'offre part TOUJOURS** (remontée au plancher prix mini / achat + 10 %, au % réglé sans plancher), texte qui annonce l'offre ⇒ offre avant. `2026-11-21-favoris-corrections.md`. Geste : installer la 5.410.8.
- **21 nov. · Favoris en tableau + onglet de travail d'abord (ext. 5.410.7)** : page Favoris du panneau = tableau comme Commandes (état par rangée en direct, segments, barre « Envoyer à N », feuilles Réglages / confirmation, refus dit sur la rangée) ; onglet vinted.fr épinglé à droite, sans focus, ouvert avant tout envoi/republication, fermé ⇒ arrêt dit. `2026-11-21-favoris-tableau.md`. Geste : installer la 5.410.7.
- **21 nov. · Ext. 5.410.6 : plus de fausse « vérification »** : les cadres reCAPTCHA invisibles de vinted.fr déclenchaient « fais-la sur la page » ; une vérification ne compte que VISIBLE (≥ 120 × 60, à l'écran, `vrmVerifVisible`), banc `captcha-visible`. Geste : installer 5.410.6, puis « Reprendre ».

- **21 nov. · train du 21 nov. (`claude/integration-21nov`)** : intégration de l'app sur l'ext. 5.419.0 (ext-5419 : favoris envoyés dès « Valider », taux et message pré-rempli, Commandes en lot) — fluidite (photos par `PhotoVinted`, `lectureBornee`), onglets-menu (5 onglets gardés, Menu sous la photo), annonces-dressing (liste/grille, compte bloqué, tableaux qui tiennent), ventes-lisibles, journee-stats (dont Transporteurs), argent-vintex ; relue pour les bugs. `2026-11-21-integration-21nov.md`. Geste : installer la 5.419.0.
- **21 nov. · Extension 5.418.0 : tout le travail du 21 nov. en un zip (`claude/integration-ext-5418`)** : ci-offres-panneau, relais-prevision, vestiaire-messages, panneau-telephone, extension-interface (plus aucune écriture Vinted par requête), extension-connexion, lbc-interface, favoris-perso. `2026-11-21-integration-ext-5418.md`. Geste : installer la 5.418.0, apprendre une fois Vestiaire et Leboncoin, essayer UNE republication et UN favori.
- **21 nov. · Panneau de l'extension au téléphone (ext. 5.413.0, `claude/panneau-telephone`)** : 5 onglets en bas + « Plus », rangées empilées, feuilles du bas, 16 px ; présentation seule, banc `panneau-telephone`. `2026-11-21-panneau-telephone.md`. Geste : installer la 5.413 (après l'intégration).

## Lignes du §9 de CLAUDE.md déplacées le 22 nov. (soir), telles quelles
- **22 nov. · Offres, photos, résumé (`claude/offres-photos-resume`)** : offres sans réponse (Messages, Aujourd'hui), « Doublons » de photo (Annonces), résumé du mois par e-mail (si l'envoi est configuré). `2026-11-22-offres-photos-resume.md`.
- **22 nov. · Après la finale, app (`claude/apres-finale-app`)** : Statistiques d'un compte neuf, zéro saut à l'ouverture, fluidité (écrans gardés), « Reprendre sur l'autre appareil », « Plus vue depuis N j ». `2026-11-22-apres-finale-app.md`.
- **22 nov. · train du 21–22 nov. (app + ext. 5.434) (`claude/integration-finale`)** : personnel-compta (« Argent bloqué » corrigé, compte personnel hors totaux côté serveur, Comptabilite sort d'App.jsx), style-vintex, ux-reglages, relier-code, fiche-sites, transp-depenses, rentabilite, prio-recherche, retours-suivi ; extension 5.420 à 5.433 (et 5.427 visuel) réunies en UNE version **5.434.0** ; atelier : avant/après + « Programmer à… » + republier direct + file d'actions + garde du prix ; relier-retires ; Annonces « Vendue » = toutes les ventes PROUVÉES, tous sites, filtre Site compté ; dernière passe : 24 rouges classés, chasse aux bugs P1-1→P2-5 (lectures partagées réparées : la borne passe SOUS le partage) — `2026-11-22-integration-finale.md` §5 bis, `2026-11-22-chasse-bugs.md`. Geste : installer la 5.434.0 dans CHAQUE Chrome (Orion : dossier 5.434.0).
- **22 nov. · À distance (`claude/a-distance`)** : l'iPhone commande, SON ordinateur (extension) exécute — file `cmd_dist_*` (24 h, une fois, compte de l'onglet), miroir par compte, prix (baisse, plancher), masquer, republier, bordereau ; aucun cloud, aucune IP. `2026-11-22-a-distance.md`.
- **22 nov. · Après la finale, extension (`claude/apres-finale-ext`)** : sauvegarder / restaurer ses réglages (aucun secret, rien sans « Oui ») ; Leboncoin et Vestiaire à égalité (pause, hors ligne, offres, retours, loupe). `2026-11-22-apres-finale-ext.md`.
- **22 nov. · Anti-robot ALLUMÉ** : clé de site Turnstile sur Vercel (`VITE_TURNSTILE_SITE_KEY`, production), CAPTCHA activé dans Supabase par Julien ; retour arrière : éteindre dans Supabase d'abord, puis vider la clé. Détail : `historique-securite-base-serveur.md` (20 oct.). Geste : aucun.
- **22 nov. · Intégration 2 (ext. 5.436.0, `claude/integration-22nov-2`)** : les 4 chantiers ci-dessous, une seule version d'extension **5.436.0** (contient la 5.435). Geste : installer la 5.436.0 dans CHAQUE Chrome (Orion : dossier 5.436.0) et laisser Chrome ouvert pour « À distance ».
- **22 nov. · Achats en lot** : lot prouvé par SA transaction, « Diviser » sur son toucher, prix réparti au centime (`src/achatDivise.js`). `2026-11-22-achats-lot.md`. Geste : aucun.
## Lignes du §9 de CLAUDE.md déplacées le 23 nov., telles quelles
- **23 nov. · Design noir encre, finitions (`claude/style-clarte-3`)** : le grand chiffre d'Aujourd'hui suit la fenêtre (7 j · 30 j · Mois), « En direct » rien ou une puce, Publier / Relier dans les actions, toast qui réserve sa place. `docs/passation/2026-11-22-style-clarte.md` §7. Geste : aucun.
- **23 nov. · Latence** : listes de colis par paquets (`src/composants/ParPaquets.jsx`) ; Achats 1,98 → 0,82 s, Ventes 1,12 → 0,74 s (390 ×4), chiffres identiques. `2026-11-22-latence.md`. Geste : aucun.
- **23 nov. · Design noir encre, tranche 2 (`claude/style-clarte-2`)** : Ventes/Annonces en tableau dense à bord fin (en-tête gris, rangées 60), barre de sélection NOIRE (plein blanc), fiche au prix énorme, une seule recherche sur Annonces (⌘K garde celle de la coque) ; CSS seulement (`src/natif/encre-tableaux.css`), banc `style-clarte-2`. `docs/passation/2026-11-22-style-clarte.md` §6. Geste : aucun.
- **22 nov. soir · Design noir encre, tranche 1 (`claude/style-clarte`)** : les maquettes de Julien : en-tête d'Aujourd'hui à l'ordinateur (date, « Mis à jour il y a … » = dernière lecture réussie de la veille, relire, loupe, cloche), héros en courbe 7 j / 30 j / Mois (« vs octobre au même jour »), pied Vendu · Reçu · À venir, Colis en deux cases, Notifications dans Gestion, « N comptes Vinted · Pro » en pied, « Une mise à jour est prête » dans la feuille de l'extension. `docs/passation/2026-11-22-style-clarte.md`. Geste : aucun.
- **22 nov. · Train de l'extension (ext. 5.438.0, `claude/ext-5438`, contient la 5.437 jamais servie seule)** : note de santé par compte (cadence qui baisse seule par palier, remonte par marches), « compte précieux », « à nouveau visible » + gestes, relance des offres acceptées sans achat, lot seul, brouillons seuls + « Publier » en un toucher ; 5.437 : prix mini à la publication, négo intelligente, formulaire en ordre variable, pause « en vérification » (programmation d'avant comprise), la nuit aussi ; favoris débloqués (cloche à plusieurs ancres, favori introuvable sauté, la file continue). `2026-11-22-ext-5438.md`, `2026-11-22-ext-5437.md`. Geste : installer la 5.438.0 dans CHAQUE Chrome (Orion : dossier 5.438.0).

## Lignes du §9 de CLAUDE.md déplacées le 23 nov. (finitions du design), telles quelles
- **22 nov. soir · Design noir encre, tranche 1 (`claude/style-clarte`)** : les maquettes de Julien : en-tête d'Aujourd'hui à l'ordinateur (date, « Mis à jour il y a … » = dernière lecture réussie de la veille, relire, loupe, cloche), héros en courbe 7 j / 30 j / Mois (« vs octobre au même jour »), pied Vendu · Reçu · À venir, Colis en deux cases, Notifications dans Gestion, « N comptes Vinted · Pro » en pied, « Une mise à jour est prête » dans la feuille de l'extension. `docs/passation/2026-11-22-style-clarte.md`. Geste : aucun.

## Lignes du §9 de CLAUDE.md déplacées le 23 nov. (le gris de vrm.center), telles quelles
- **23 nov. · Design noir encre, finitions (`claude/style-clarte-3`)** : le grand chiffre d'Aujourd'hui suit la fenêtre (7 j · 30 j · Mois), « En direct » rien ou une puce, Publier / Relier dans les actions, toast qui réserve sa place. `docs/passation/2026-11-22-style-clarte.md` §7. Geste : aucun.
- **23 nov. · Latence** : listes de colis par paquets (`src/composants/ParPaquets.jsx`) ; Achats 1,98 → 0,82 s, Ventes 1,12 → 0,74 s (390 ×4), chiffres identiques. `2026-11-22-latence.md`. Geste : aucun.
- **23 nov. · Design noir encre, tranche 2 (`claude/style-clarte-2`)** : Ventes/Annonces en tableau dense à bord fin (en-tête gris, rangées 60), barre de sélection NOIRE (plein blanc), fiche au prix énorme, une seule recherche sur Annonces (⌘K garde celle de la coque) ; CSS seulement (`src/natif/encre-tableaux.css`), banc `style-clarte-2`. `docs/passation/2026-11-22-style-clarte.md` §6. Geste : aucun.
## Ligne du §9 de CLAUDE.md déplacée le 23 nov. (annulées + validation Vestiaire), telle quelle

## Lignes du §9 de CLAUDE.md déplacées le 23 nov. (tranche 4), telles quelles
- **23 nov. · Latence** : listes de colis par paquets (`src/composants/ParPaquets.jsx`) ; Achats 1,98 → 0,82 s, Ventes 1,12 → 0,74 s (390 ×4), chiffres identiques. `2026-11-22-latence.md`. Geste : aucun.
- **23 nov. · Audit « chaque bouton marche » (`claude/audit-boutons`)** : robot `chaque-bouton.cjs` sur les 25 racines à 390 tactile et 1512 (vendeur inventé) ; corrigés : poignée des feuilles (toucher = Fermer/Agrandir), Échap de « Relier un achat », « + Ajouter » et menu « … » d'Achats, case « À retirer », « Nouveau meuble » (dialogue), retour de Paramètres au téléphone, Catalogue (« 12,50 », boutons désactivés avec raison), liens morts. `docs/passation/2026-11-23-audit-boutons.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée le 23 nov. (favoris-auto), telle quelle
- **23 nov. · Ventes annulées partout + Vestiaire « en attente de validation » (ext. 5.439.0)** : annulées comptées par site (`src/ventesAnnulees.js`, chaque site par SA règle, jamais dans le CA ni le bénéfice) dans Statistiques → Annulations et Ventes → « Annulées · N » ; Vestiaire : attente / à corriger / refusée = états distincts (pas « hors ligne », pas « en ligne »), sur la rangée, la fiche et les compteurs. `2026-11-22-annulees-vc.md`. Geste : installer 5.439.0, ouvrir « Mes articles » sur Vestiaire avec une annonce en attente.
- **23 nov. · Design noir encre, tranche 4 (`claude/style-clarte-4`)** : les N° neufs = une carte en ligne d'Aujourd'hui (plus de toast) ; messages courts dans la place du bas (jamais sur un chiffre) ; loupe et cloche rondes en haut de chaque écran à l'ordinateur ; Achats à 16 px. `docs/passation/2026-11-22-style-clarte.md` §8. Geste : aucun.
- **23 nov. · Design noir encre, finitions (`claude/style-clarte-3`)** : le grand chiffre d'Aujourd'hui suit la fenêtre (7 j · 30 j · Mois), « En direct » rien ou une puce, Publier / Relier dans les actions, toast qui réserve sa place. `docs/passation/2026-11-22-style-clarte.md` §7. Geste : aucun.


### Lignes de la table §8 de CLAUDE.md déplacées le 23 nov. (taille du fichier), mot pour mot

| `vcecrireui` `vcfilpanneau` `vcaimespanneau` | `vc-ecrire.js:ecrire` · `filVcCarte` · `aimesVcCarte` | **5.412.0** (21 nov.) | Vestiaire au panneau : fil, réponse par l'INTERFACE (champ, bouton, adresse appris de SON envoi, vu sinon arrêt), « aimés » ⇒ leur conversation ; plus de requête d'écriture — `2026-11-21-vestiaire-messages.md` |
| `relaisprevu` | `relaisDestinationEscrow` | **5.411.0** (21 nov.) | point relais d'arrivée d'un achat en route (expédition de SA commande, budget lecture) ⇒ « En route vers ce point » — `2026-11-21-relais-prevision.md` |

### Lignes du §9 de CLAUDE.md déplacées le 23 nov. (taille du fichier), mot pour mot

- **23 nov. · Mode présentation (`claude/presentation`)** : Paramètres → Apparence et langue (aussi menu du compte, « Plus », bouton à côté de l’œil de la barre latérale) : montants, pseudos, adresses, codes, n° de suivi cachés, comptes « Compte 1, 2… » ; photos, titres, N° visibles ; pastille « Présentation » ; propre à l’appareil, rien en base ; règle du stream à programme fixe + composants marqués. Banc `mode-presentation`. `docs/passation/2026-11-23-presentation.md`. Geste : aucun.
- **23 nov. · Achats à l'ordinateur, moitié gauche vide (`claude/achats-ordi-casse`)** : la grille deux colonnes d'Achats (codes à gauche) ne s'allume plus avec le tableau de travail ; banc `largeur-ordi` (app telle qu'en production). `2026-11-23-achats-ordi-casse.md`. Geste : aucun.
- **23 nov. · Favoris sans geste (ext. 5.440)** : Vinted a basculé sa messagerie (uuid, `inquiries`) ; cloche trouvée seule (`vrm-trouver.js`), plus de « touche le bouton », fenêtre refaite. `2026-11-23-favoris-auto.md`. Geste : installer 5.440.0.


## Lignes déplacées de CLAUDE.md §9 (23 nov. soir, passation)
- **23 nov. · Mode présentation (`claude/presentation`)** : Paramètres → Apparence et langue (aussi menu du compte, « Plus », bouton à côté de l’œil de la barre latérale) : montants, pseudos, adresses, codes, n° de suivi cachés, comptes « Compte 1, 2… » ; photos, titres, N° visibles ; pastille « Présentation » ; propre à l’appareil, rien en base ; règle du stream à programme fixe + composants marqués. Banc `mode-presentation`. `docs/passation/2026-11-23-presentation.md`. Geste : aucun.

## Ligne du §9 de CLAUDE.md déplacée le 23 nov. (scan-achat), telle quelle
- **23 nov. · Achats à l'ordinateur, moitié gauche vide (`claude/achats-ordi-casse`)** : la grille deux colonnes d'Achats (codes à gauche) ne s'allume plus avec le tableau de travail ; banc `largeur-ordi` (app telle qu'en production). `2026-11-23-achats-ordi-casse.md`. Geste : aucun.
- **23 nov. · Photos nettes (`claude/photos-nettes`)** : chaque photo Vinted prend la plus petite taille DÉJÀ LUE du même fichier qui donne 2 px réels par point (`src/photoTaille.js`) ; visionneuse progressive (petite puis grande) ; aucune adresse fabriquée (chaque taille a sa signature). Achats : souvent 150x210 seule. `docs/passation/2026-11-23-photos-nettes.md`. Geste : aucun.
- **23 nov. · Bugs (`claude/bugs-totale`)** : vente par e-mail partout — le bordereau reçu d'une vente pas relue (particulier : vente sans n°) fait le colis (Colis, Ma journée, jamais Ventes ni CA), la photo exacte tranche la fenêtre ambiguë ; colis à retirer sans photo (`Icon`) ; boucle de rendus : `onVmrExt` ne prévient que sur changement d'empreinte (11 → 6 validations/10 s au téléphone, banc `rendus-repos`). `2026-11-22-bugs-totale.md`. Geste : aucun.
- **23 nov. · Isolement + colis en direct** : RLS prouvée par vendeur (0 ligne d'un autre, 8 vendeurs) ; un bordereau reçu par e-mail paraît sur Colis sans changer d'écran (veille `bordereaux`). `docs/passation/2026-11-23-isolement-temps-reel.md`. Geste : aucun.
- **23 nov. (nuit) · Favoris 5.440.1** : la cloche de son compte porte un lien d'application (`vintedfr://messaging?item_id&user_id`) que la 5.440 refusait avant tout clic (« Conversation pas vérifiée ») ; reconnu par ses DEUX identités, identité par la commande si la conversation n'a pas d'article, un refus local saute CE favori (compteur remis à zéro à chaque envoi/Reprendre), phrase entière, un mot par état. `2026-11-23-favoris-identite.md`. Geste : installer la 5.440.1, relancer, dire ce que dit chaque ligne.
- **23 nov. · Gris clair étagé (`claude/style-clair`)** : variante A validée (gris froid, accent ardoise), sombre = gris choisi ; iPhone compact ; dessin fin ; pop-up d'événement + galerie du propriétaire. `docs/passation/2026-11-23-style-clair.md`. Geste : essayer le pop-up sur un vrai iPhone.
- **24 nov. · Morceaux périmés (`claude/morceaux-perimes`)** : la page ouverte pendant une mise en ligne ne repart plus — elle fait ranger les fichiers de SA version au repos (`src/reserveMorceaux.js`), le ménage du service worker garde ceux d'une page ouverte ; un écran introuvable recharge SUR cet écran, jamais pendant une saisie ou une feuille (sinon page cachée) ; un 404 /assets/ de la prod porte `immutable`. Banc `morceaux-perimes`, audit. `2026-11-24-morceaux-perimes.md`. Geste : aucun.
- **24 nov. · CI ≈ 222 → ≈ 121 min-machine par PR, job le plus long 68 → 17 min (`claude/ci-rapide`)** : mêmes contrôles (`python3 -I scripts/ci-controles.py --diff origin/main`), bancs 3 à la fois (`BANCS_PARALLELE`), ventes-e2, accessibilite et budget-vitesse en morceaux, parts rééquilibrées, `dist/` partagé pour les écrans ; la part 2/3 (annulée à 45 min à chaque PR) finit. `2026-11-24-ci-rapide.md`. Geste : aucun.

- **23 nov. · Photos nettes (`claude/photos-nettes`)** : chaque photo Vinted prend la plus petite taille DÉJÀ LUE du même fichier qui donne 2 px réels par point (`src/photoTaille.js`) ; visionneuse progressive (petite puis grande) ; aucune adresse fabriquée (chaque taille a sa signature). Achats : souvent 150x210 seule. `docs/passation/2026-11-23-photos-nettes.md`. Geste : aucun.

## « Extension servie » : historique des versions, déplacé tel quel de CLAUDE.md §9 (23 nov. soir, train)
**Extension servie : 5.440.0** (23 nov., favoris sans geste ; avant, 5.439.0 ; avant, 5.438.0, 22 nov., train de l'extension : note de santé, compte précieux, relances, lots et brouillons seuls ; 5.437 jamais servie seule ; avant, 5.436.0, intégration 2 : « À distance », sauvegarde des réglages, Leboncoin/Vestiaire à égalité ; 5.435 jamais servie seule ; avant, 5.434.0 : les 5.420 à 5.433 en une version — file d'actions, garde du prix, avant/après, programmation, publier aussi, retirer partout, relances, courbes, note des acheteurs, traduction sur l'appareil, suivi des retours ; avant, 5.419.0, 21 nov. nuit : favoris immédiats, taux et message pré-rempli, Commandes en lot ; avant, 5.418.0, 21 nov. soir : 5.418.0 rassemble les 5.410.9 à 5.417 — interface seule, connexion, Leboncoin et Vestiaire par l'interface, favoris personnalisés, panneau au téléphone, points relais ; avant, 5.410.8, 21 nov. : favoris corrigés, onglet voilé, offre toujours ; 5.410.7 : favoris en tableau, onglet de travail épinglé ouvert d'abord ; 5.410.6 : fausse vérification corrigée ; 5.410.5 : onglet de travail comme Bleam, faux anti-robot ; 20 nov. nuit : tout « comme Bleam », 5.410.3 contenue ; avant, 5.410.2, 20 nov. soir : le panneau reste ouvert jusqu'à son ×, bordereau et livreur de chaque vente, « Pas revue depuis N j » ; avant, 5.410.1, 20 nov. : panneau de l'extension « comme Vintex », toute action de plateforme dedans, cadence par compte, republier fidèle + contrôle, intéressés Leboncoin, baisse Vestiaire ; avant, 5.409.0, 19 nov. : un seul lot pour le train — prix en attente, baisse par règle, vendue ailleurs masquée, compte bloqué, suivi des achats expédiés, page Extension, « Depuis ta dernière visite » ; avant, 17 nov. : 5.408 republication parfaite — chaque étape visible, reprise ; 5.407 favoris en liste à cocher ; 5.406 carte v2 ; 5.403 tous les n° de suivi d'un achat à deux transporteurs ; avant, 5.400.0 extension-restes — InPost = Mondial Relay, N° de la fiche à « Publier », empreintes eBay ; règles d’achat recopiées ; contient 5.399 plateformes-restes — catégorie Vestiaire à « Publier partout » ; contient 5.398 favoris et offres, et aussi 5.386 verre de la carte, 5.388 même photo sûre, 5.390 versements, 5.392 deux comptes/aimés Vestiaire — jamais servies seules). **À lire en premier : `docs/passation/2026-11-22-passation-generale.md`** (22 nov.), puis `2026-11-20-passation-generale.md`, puis `docs/passation/2026-11-16-passation-generale.md` (la plus complète : en ligne, prêt, en pause, en file, refusé, gestes), puis `2026-11-16-passation.md`, `2026-11-10-passation-finale.md` et `2026-11-09-passation-generale.md` (puis, pour l'ancien, `2026-11-07-passation-generale.md` et `2026-11-02-liste.md`). **Production** : https://vrm.center,

- **23 nov. · Photos nettes (`claude/photos-nettes`)** : chaque photo Vinted prend la plus petite taille DÉJÀ LUE du même fichier qui donne 2 px réels par point (`src/photoTaille.js`) ; visionneuse progressive (petite puis grande) ; aucune adresse fabriquée (chaque taille a sa signature). Achats : souvent 150x210 seule. `docs/passation/2026-11-23-photos-nettes.md`. Geste : aucun.

- **23 nov. · Isolement + colis en direct** : RLS prouvée par vendeur (0 ligne d'un autre, 8 vendeurs) ; un bordereau reçu par e-mail paraît sur Colis sans changer d'écran (veille `bordereaux`). `docs/passation/2026-11-23-isolement-temps-reel.md`. Geste : aucun.

- **23 nov. · Bugs (`claude/bugs-totale`)** : vente par e-mail partout — le bordereau reçu d'une vente pas relue (particulier : vente sans n°) fait le colis (Colis, Ma journée, jamais Ventes ni CA), la photo exacte tranche la fenêtre ambiguë ; colis à retirer sans photo (`Icon`) ; boucle de rendus : `onVmrExt` ne prévient que sur changement d'empreinte (11 → 6 validations/10 s au téléphone, banc `rendus-repos`). `2026-11-22-bugs-totale.md`. Geste : aucun.
## Lignes du §9 de CLAUDE.md déplacées le 24 nov. (gains-reels), telles quelles
<!-- déplacée telle quelle de CLAUDE.md §9 le 24 nov. (lot connexions-extension) -->
<!-- déplacé tel quel de CLAUDE.md §9 le 24 nov. (lot agir-si-connecte) -->
<!-- déplacé tel quel de CLAUDE.md §9 le 24 nov. (lot agir-si-connecte, après la fusion de main) -->
<!-- déplacé tel quel de CLAUDE.md §9 le 24 nov. (lot agir-tout) -->
- **23 nov. (nuit) · Favoris 5.440.1** : la cloche de son compte porte un lien d'application (`vintedfr://messaging?item_id&user_id`) que la 5.440 refusait avant tout clic (« Conversation pas vérifiée ») ; reconnu par ses DEUX identités, identité par la commande si la conversation n'a pas d'article, un refus local saute CE favori (compteur remis à zéro à chaque envoi/Reprendre), phrase entière, un mot par état. `2026-11-23-favoris-identite.md`. Geste : installer la 5.440.1, relancer, dire ce que dit chaque ligne.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., ci-rapide)
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., morceaux-perimes)
- **23 nov. (soir) · PASSATION GÉNÉRALE** : lire en premier `docs/passation/2026-11-23-passation-generale.md` (en ligne, train de fusions du 24 nov. et son ordre, décisions de Julien du 23 : gris clair sans orange, iPhone minimaliste, peu de texte / beaux boutons ; refus : débogueur, gestes « humains », IP par compte, cloud). Geste : installer l'extension finale du train.
<!-- déplacé tel quel de CLAUDE.md §9 le 24 nov. (lot style-graphite) -->
- **23 nov. · « Vinted a agi » regroupée (`claude/moderation-carte`)** : disparues d'un compte = un groupe (compte et dates une fois, « Pourquoi ? », un bouton « Vérifier sur Vinted », lignes photo + N° + « Vu ») ; ni orange ni trait de bord ; règle inchangée. `docs/passation/2026-11-23-moderation-carte.md`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., vente-mail-annonce)
- **23 nov. · Gris clair étagé (`claude/style-clair`)** : variante A validée (gris froid, accent ardoise), sombre = gris choisi ; iPhone compact ; dessin fin ; pop-up d'événement + galerie du propriétaire. `docs/passation/2026-11-23-style-clair.md`. Geste : essayer le pop-up sur un vrai iPhone.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion #1377)
- **24 nov. · Bugs terrain (`claude/bugs-terrain-24nov`)** : mesuré (Vercel 0 erreur/72 h ; 3 plantages app/72 h dont `Icon` déjà corrigé) ; une photo Leboncoin n'est plus demandée par `fetch` (refusée par `connect-src` : `src/lisibleParLaPage.js`, `audit-lecture-csp`) ; restent : morceaux périmés au téléphone (~15/jour), suivi `escrow` de l'extension jamais reconnu. `2026-11-24-bugs-terrain.md`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion #1377)
- **24 nov. · Français du démarrage 79,96 → 73,6 Ko** (budget 80 inchangé) : l'accueil des nouveaux à la demande. `2026-11-24-francais-demarrage.md`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion #1386)
- **24 nov. · Favoris 5.440.2 (`claude/favoris-ancien`)** : « trop ancien » faux (rangs 1, 2, 4 de la liste) ⇒ liste de Vinted indexée et lue jusqu'au bout, ligne pas montrée ⇒ son adresse native ouverte (onglet en arrière-plan), sinon « en recherche ». `2026-11-24-favoris-ancien.md`. Geste : installer 5.440.2.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion #1386)
- **24 nov. · Vente vue par e-mail ↔ son annonce (`claude/vente-mail-annonce`)** : l'annonce EN LIGNE qu'un e-mail de vente du même compte désigne (SON clic « Relier à l'annonce », sinon l'image exacte dossier+fichier ; dressing lu avant l'e-mail) passe « Vendue · par e-mail, en attente de Vinted » (hors d'« en ligne » et des totaux, rien supprimé) et la vente reçoit son N° ; « Délier » défait ; fiche « pas su » dite une fois + « Pourquoi ? ». `src/venteMailAnnonce.js`, `2026-11-24-vente-mail-annonce.md`. Geste : aucun.
- **23 nov. · Revue UX (`claude/revue-ux`)** : Achats iPhone liste d'abord (retraits à 0 tus, gestes rares dans « ⋯ », « Filtres »), Relier distinct (n° court + heure), fiche « Prix d'achat » en ligne, sélection Annonces à un toucher, Argent une ligne ambre, verdict extension, logos (audit). `docs/passation/2026-11-23-revue-ux.md`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion de #1346 dans visuel-jeu)
- **23 nov. · Revue UX (`claude/revue-ux`)** : Achats iPhone liste d'abord (retraits à 0 tus, gestes rares dans « ⋯ », « Filtres »), Relier distinct (n° court + heure), fiche « Prix d'achat » en ligne, sélection Annonces à un toucher, Argent une ligne ambre, verdict extension, logos (audit). `docs/passation/2026-11-23-revue-ux.md`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion de #1346 dans visuel-jeu)
- **24 nov. · Observer Vinted (ext. 5.440.3, `claude/observation-vinted`)** : interrupteur 10 min (carte du logo, page Extension) ; la page note pages, requêtes (clés et types), clics (`isTrusted`), cloche — formes seulement, rebâties par le fond, ligne `observation_vinted_{compte}_{nav}`, « Envoyer l'observation » ; rien envoyé à Vinted. `2026-11-24-observation-vinted.md`. Geste : installer, Observer, un envoi (Bleam ou main), Envoyer l'observation.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion #1341)
- **23 nov. · Retours d'achat suivis ; À retirer en C, choisie (`claude/retours-suivi`, après #1326)** : étape plus loin ⇒ précédentes « faites, date pas vue » ; point Vinted Go nommé (« Relais Vinted Go, … »), sinon le transporteur en titre ; en-tête sur une ligne, logo entier, plus d'orange (nuit comprise). `2026-11-23-retours-suivi.md`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion #1373)
- **24 nov. · Chargement sans tirets (`claude/livrable`)** : un chiffre EN COURS de lecture se dessine en squelette (composants natifs : héros, tuiles, cases, rangées d'Argent), « — » et sa raison rendus au bout de 15 s ; pas su = « — » dit, inchangé ; ⚠️ un banc sans `BANC_DESIGN_V2=defaut` voit l'ancien DOM. `2026-11-24-livrable.md`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion #1361)
- **24 nov. · « Vinted a agi » : UNE carte** (#1321+#1346) : ligne par compte, feuille aux photos (N°), un geste. `2026-11-23-moderation-carte.md`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion #1380)
- **24 nov. · Visuel « jeu vidéo » (`claude/visuel-jeu`)** : pop-ups en notifications de jeu (photo par identité, étiquette N°, médaillon, ressort, balayage, « +2 », vente fêtée) ; disparues en grille ; anneau des colis prêts ; ventes en tuiles ; pièces `src/natif/Jeu.jsx` (README `src/natif/visuel/`). `2026-11-24-visuel-jeu.md`. Geste : regarder la galerie des pop-ups sur l'iPhone.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion #1380)
- **24 nov. · Livrable 2 (`claude/livrable-2`)** : Argent ne dit plus « pas calculé / ouvre Ventes » pendant la lecture (publication pas encore relue = en lecture) ; Ventes sans ligne coupée ; Aujourd'hui sans saut (places tenues, 0 px mesuré à 390 et 1512). `2026-11-24-livrable.md` (Suite). Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion #1351)
- **24 nov. · Argent, Messages, Paramètres visuels (`claude/visuel-argent`)** : anneau, jauges micro/TVA, « À venir » en cartes, tuiles de paire ; affichage seul. `2026-11-24-visuel-argent.md`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion #1351)
- **24 nov. · Annonces + Stock (`claude/visuel-annonces`)** : la LISTE reste par défaut, rangée nette 72 px (photo 60, étiquette N°, ♡ 👁, jamais « 0 j »), glisser ⇒ Baisser/Republier, puces au pouce, liste virtualisée, sans latence ; « Détaillé » (tuiles) dans ⋯ ; Stock : étiquette papier, creux. `2026-11-24-visuel-annonces.md`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion #1378)
- **24 nov. · Styles au choix (`claude/style-graphite`, PR #1380)** : Paramètres → Apparence → Style, tuiles (Actuel + 11 styles dont Monochrome), clair/sombre, un toucher applique ; jetons par `scripts/styles-generer.cjs` (table, AA, zéro orange), famille de boutons `src/natif/styles-choix.css`. Banc `styles-choix`. `2026-11-24-style-graphite.md`. Geste : essayer, dire lequel garder.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion #1381)
- **24 nov. · Parcours iPhone (`claude/parcours-iphone`, APRÈS #1326)** : un robot joue sa journée au doigt (banc `parcours-iphone`, WebKit dans `iphone-webkit.yml`) ; corrigés : le code au comptoir que le « retour » ne fermait pas (VRM quitté), « Colis mondial_relay » dans la loupe ; rapportés : sauts d'Achats/Argent/loupe (données lues après). `2026-11-24-parcours-iphone.md`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion #1369)
- **24 nov. · À retirer parfait (`claude/retrait-parfait`, après #1341, #1351, #1326)** : le COMPTOIR d'un point (toucher un code : tous ses colis à glisser, code énorme et QR max sur blanc, « Retiré » / Annuler, écran allumé, retour, hors ligne), ouverture calculée sur les horaires lus, date lue par colis, « à vérifier » + un geste ; rappel exact (heure limite lue seule). `2026-11-24-retrait-parfait.md`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion #1369)
- **24 nov. · Audit boutons, 2ᵉ passe** : retour piégé après « Relier eBay », rond « Retrouver » sur les segments eBay, 2 exceptions du robot. `2026-11-23-audit-boutons-2.md`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., agir-tout 5.450.1, fusion de main)
- **24 nov. · Simulations de bout en bout (`claude/ext-simulations`, ext. 5.449.0)** : la vraie extension chargée contre des sites simulés aux formes mesurées (`scripts/bancs/sim-extension.cjs`) ; suivi des achats : l'expédition d'une commande à sa forme réelle (sans point) n'est plus « inattendue », le transporteur est rangé (`audit-suivi-escrow-forme`). `2026-11-24-simulations-extension.md`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., agir-tout 5.450.1, fusion de main)
- **24 nov. · Connexions de l'extension (`claude/connexions-extension`)** : Paramètres → « Connexions de l'extension » : chaque navigateur (nom, version « à jour » ou « 5.418 → 5.440 », vu quand, comptes lus, dernier problème + son geste), chaque compte (lu par qui, quand, jauge 50/h), vieilles installations repliées ; une ligne sur Aujourd'hui seulement si un geste attend ; champs 5.448 (`sante`, `arret`, `servie`) lus présents, sinon « — ». `2026-11-24-connexions-extension.md`. Geste : aucun.
## Lignes déplacées telles quelles de CLAUDE.md §9 (25 nov., fusion de #1388 dans #1393, < 60 000)
- **23 nov. · Colis en danger (`claude/colis-danger`)** : colis VENDU Vinted Go relu jusqu'à sa remise ; date de départ LUE (`expiration_time`) gardée sur `depart_vinted_*`, relu toutes les 2 h ; famille « Colis en danger » la veille et le jour (`api/_lib/colis-danger.js`) ; 0 vente Vinted Go en base au 23 nov. `2026-11-23-colis-danger.md`. Geste : aucun.
- **24 nov. · Observer Vinted (ext. 5.440.3, `claude/observation-vinted`)** : interrupteur 10 min (carte du logo, page Extension) ; la page note pages, requêtes (clés et types), clics (`isTrusted`), cloche — formes seulement, rebâties par le fond, ligne `observation_vinted_{compte}_{nav}`, « Envoyer l'observation » ; rien envoyé à Vinted. `2026-11-24-observation-vinted.md`. Geste : installer, Observer, un envoi (Bleam ou main), Envoyer l'observation.
## Ligne déplacée telle quelle de CLAUDE.md §9 (24 nov., train : fusion #1394)
- **24 nov. · Suivi des envois (`claude/suivi-ventes`)** : la piste d'un colis vendu (Déposé → En route → Au point « nom », à retirer avant → Retiré → finalisée = argent versé), chaque étape LUE ou « pas encore su » (`api/_lib/suivi-envoi.js`) ; « Mes envois » en 4 groupes ; notifications « au point » / « retiré » (famille `envois`). Mesuré : Vinted Go 0 vente, XU jamais lus, aucune date limite hors Vinted Go. `2026-11-24-suivi-ventes.md`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (25 nov., lot achats-retours-design)
## Ligne déplacée telle quelle de CLAUDE.md §9 (25 nov., logo-vinted-pp, < 60 000)
## Ligne déplacée telle quelle de CLAUDE.md §9 (25 nov., style-c3)
- **24 nov. · Vitesse PR B (`claude/vitesse-lectures-toucher`)** : 1re visite d'Achats 4,7 → 3,5 s (calculs refaits une fois par version des données), relevés « plus vue » groupés ; à froid = PR A (pas de comparaison pendant le 1er nuage) ; chiffres 35/35. `2026-11-24-vitesse-ecran-montre.md` §8. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (25 nov., ventes-rangee)
- **25 nov. · Banc `e2e-extension` vert (`claude/e2e-extension-vert`)** : étapes 3/4 lisaient l'ancien écran (Ventes, « Qui dorment ») ⇒ portées sur le natif et le panneau ; vrais défauts corrigés : extension **5.440.4** (copie du dressing oubliée quand il est rangé : le panneau perdait la paire du lien), app (« Baisser » refusé et « mets à jour » pour une extension d'avant le lien du panneau). `2026-11-25-e2e-extension-vert.md`. Geste : installer la 5.440.4.
## Ligne déplacée telle quelle de CLAUDE.md §9 (25 nov., gris-moyen)
- **25 nov. · Style « C3 doux » (mélange C3 × Vintex) (`claude/style-c3`, au choix, PAS par défaut)** : 12e style (gris `#DADDE2`, cartes blanches, plaque gravée, capsule du bas ; forme chargée seulement si choisi) ; Monochrome fond `#E2E4E8` ; À retirer, loupe, Argent nettoyés pour tout style choisi. `docs/passation/2026-11-25-style-c3.md`. Geste : regarder les planches.
- **25 nov. · Achats : retours compacts (`claude/achats-retours-design`)** : carte en cours ~1/3 d'écran (état écrit une fois, frise en points, UN bouton + liens), remboursé = rangée repliée, « À vérifier » = une rangée, ✓ ⋯ dans la tête ; aucune règle touchée. `2026-11-25-achats-retours-design.md`. Geste : regarder les planches.
- **25 nov. · Logo Vinted + photo du compte (`claude/logo-vinted-pp`)** : en tête de compte d'Annonces, le V de Ventes (`src/natif/LogoSite.jsx`, couleur de marque ; l'ancien était à l'encre ⇒ noir) puis la photo de profil du compte (`harvest_{uid}_profile` du même uid, une lecture, `src/natif/visuel/photosProfil.js`), sinon l'initiale. `docs/passation/2026-11-25-logo-vinted-pp.md`. Geste : aucun.
## Lignes déplacées telles quelles de CLAUDE.md §9 (25 nov. soir, agir-tout : fusion de main, < 60 000)
- **24 nov. · Agir si connecté + Agir tout (ext. 5.450)** : tous les gestes depuis VRM par `peutAgir` (sinon « Lecture seule »). `2026-11-24-agir-si-connecte.md`, `-agir-tout.md`. Geste : installer.
- **25 nov. · Aujourd'hui, moitié moins de texte (`claude/aujourdhui-moins-texte`)** : titres courts (« 5 annonces disparues », « En pause », « Ordinateur éteint · 07:37 », « 24 N° à écrire »), ±0 % neutre sans flèche, « ≥ » pour « au moins » (plus coupé), « Par site » seulement à 2 sites ; 213 → 100 mots (390 px), 249 → 123 (1512). `2026-11-25-aujourdhui-moins-texte.md`. Geste : regarder les planches.
- **25 nov. · Le clair par défaut passe au GRIS MOYEN (`claude/gris-moyen-essai`, Julien : « gris moyen c'est d'accord »)** : page #878B92, cartes #F1F2F4, encre #0E0F12, secondaire #1F2226 (posé sur la page : 4,67:1), accent = plein #19222C ; la nuit ne change pas ; tout texte posé sur la page est à l'encre. `2026-11-25-gris-moyen.md`, NATIF.md §0 ter. Geste : aucun.
- **25 nov. · Le clair par défaut passe au GRIS MOYEN (`claude/gris-moyen-essai`, Julien : « gris moyen c'est d'accord »)** : page #878B92, cartes #F1F2F4, encre #0E0F12, secondaire #1F2226 (posé sur la page : 4,67:1), accent = plein #19222C ; la nuit ne change pas ; tout texte posé sur la page est à l'encre. `2026-11-25-gris-moyen.md`, NATIF.md §0 ter. Geste : aucun.
- **25 nov. · Envoi des messages et des offres (ext. 5.452)** : refus de Vinted (200) jamais « fait » ; plafond/pause/onglet/session attendent (heure dite) ; l'app suit l'issue, jamais deux dépôts. `2026-11-25-envoi-messages-offres.md`. Geste : installer 5.452.
- **25 nov. · Régressions iPhone (`claude/regressions-25nov`)** : 3 cartes grises d'Aujourd'hui (versements eBay en attente muette), barre du haut opaque, ligne d'une vente en rangée (ordre des feuilles), « Pas revue récemment » une fois par compte, copie sans squelette ni heure. `2026-11-25-regressions.md`, banc `regressions-25nov`. Geste : aucun.
## Ligne déplacée telle quelle de CLAUDE.md §9 (25 nov., sombre-par-defaut, < 60 000)
- **25 nov. · Ventes, la rangée compacte (`claude/ventes-rangee`)** : photo par SES sources (identité), titre + prix, UN état, logo entier, ~84 px ; achat au balayage et dans la fiche. `2026-11-25-ventes-rangee.md`. Geste : aucun.
- **25 nov. · Favoris tapés comme lui, popup refaite (ext. 5.453.0)** : `2026-11-25-favoris-gestes-humains.md`. Geste : installer la 5.453.0.
- **25 nov. soir · Sombre par défaut (`claude/sombre-par-defaut`, Julien : « La deuxième couleur est pas mal, mets en mode sombre »)** : aucun choix ⇒ sombre (règle, démarrage, `<html>`, theme-color, manifeste #1C1C20) ; un choix déjà posé ne change pas. `historique-interface-stock.md` (fin). Geste : aucun.
- **26 nov. · Colis en double au point (`claude/retrait-double-code`)** : un « à vérifier » au même code de retrait qu'un colis compté = ce colis, une carte (`absorberAVerifierParCode`, `src/retraitPreuves.js`, `audit-retrait-preuves` A8–A10). Geste : aucun.
- **23 nov. · Scan d'un colis d'achat : son N° et le geste** : N° de CET achat (par son n° de transaction), « Rangé · case », « Ranger en … », « Numéroter » ou « déjà vendue » ⇒ la vente ; transaction / code de retrait tapés. `2026-11-23-scan-achat.md`. Geste : aucun.
- **24 nov. · Scanner universel (`claude/scanner-universel`)** : un code lu ⇒ la vente, le colis, l'achat ou la paire, par identité EXACTE seulement (suivi, transaction, code de retrait, N°/SKU `VRM-` avec la coupure 013 : « 230 » ⇒ 230 ET B230 proposées) ; une boîte (EAN) n'ouvre jamais rien ; code lu 1 s puis ouverture directe depuis la barre du haut / la loupe ; rafale. `2026-11-24-scanner-universel.md`. Geste : aucun.
- **23 nov. · Photos en un geste (`claude/photos-un-geste`)** : Studio › lumière, recadrage, fond uni sur toutes les photos, dans la page, original gardé. `2026-11-23-photos-un-geste.md`. Geste : l'essayer.
- **23 nov. · Rentabilité par source d'achat (`claude/rentabilite-source`)** : « Ce que tu vends le mieux » › Source : bénéfice moyen, taux de revente, délai (par identité). `2026-11-23-rentabilite-source.md`. Geste : aucun.
- **24 nov. · Ce que tu gagnes vraiment (`claude/gains-reels`)** : Statistiques › Gains — par paire, modèle, source, compte : net réel (`netDeVenteRangee`), délai moyen, meilleur/moins bon (≥ 3 ventes au prix connu), « À racheter » (`scoreRachat`) ; « sur K des N », manque nommé + « Saisir ». Base : 160/2 278 ventes au prix connu. `2026-11-24-gains-reels.md`. Geste : saisir ses prix d'achat.
- **23 nov. · Historique de la paire : « Rangée » (`claude/historique-paire`)** : la case du Stock de CE N° entre dans la ligne de temps (par identité). `2026-11-23-historique-paire.md`. Geste : aucun.
- **24 nov. · Connexions de l'extension (`claude/connexions-extension`)** : Paramètres → « Connexions de l'extension » : chaque navigateur (nom, version « à jour » ou « 5.418 → 5.440 », vu quand, comptes lus, dernier problème + son geste), chaque compte (lu par qui, quand, jauge 50/h), installations plus vues depuis 3 j repliées ; `etatConnexionCompte` (connecté par compte, pour la porte `peutAgir`) ; une ligne sur Aujourd'hui seulement si un geste attend ; champs 5.448 (`sante`, `arret`, `servie`) lus présents, sinon « — ». `2026-11-24-connexions-extension.md`. Geste : aucun.
- **23 nov. · Republier à la main refait** : une étape à la fois, grille de toutes les photos (glisser), un plein en bas, vrais curseurs, aucun orange ; « Supprimer » cochée sur lecture complète seulement. `2026-11-23-republier-main-feuille.md`. Geste : aucun.
- **23 nov. · Appareils connectés : navigateurs de l'extension (`claude/appareils-connectes`)** : lignes `ext_appareil_*` (`owner=eq.`) sous les sessions. `2026-11-23-appareils-connectes.md`. Geste : aucun.
- **23 nov. · Scan d'un colis d'achat : son N° et le geste** : N° de CET achat (par son n° de transaction), « Rangé · case », « Ranger en … », « Numéroter » ou « déjà vendue » ⇒ la vente ; transaction / code de retrait tapés. `2026-11-23-scan-achat.md`. Geste : aucun.


## Déplacé de CLAUDE.md §9 « Gestes encore attendus de Julien » le 26 nov. (taille du fichier)

- Les 6 paires renumérotées le 2 oct. (543→266…, historique numéros) : regarder le carton.


### Geste « Installer l’extension » tel qu’il était dans CLAUDE.md jusqu’au 26 nov.
- Installer l’extension **5.440.1** (23 nov. nuit ; avant 5.440.0, 23 nov. ; avant 5.436.0, 22 nov., intégration 2 ; avant 5.434.0, puis 5.419.0, 21 nov. nuit ; avant 5.418.0, 21 nov. soir ; avant 5.410.8, 21 nov. ; avant 5.410.2, 20 nov. : remplacer le dossier, puis ⟳ dans CHAQUE Chrome ; Orion : `VRM-Orion-dossier.zip` ; mesuré le 19 nov. : Chrome 5.406, 5.400, 5.329, Orion 5.377, 5.368, 5.336). La liste complète et à jour des gestes : `docs/passation/2026-11-09-passation-generale.md` §5.
- **26 nov. · COULEURS (Julien : « 14 en sombre, 15 en clair »)** : clair = monochrome (#FFFFFF, encre noire) ; sombre = graphite et vert (#22262B, accent #5BD68F). `src/natif/jetons.css`. Geste : aucun.
- **26 nov. · Favoris réparés, ext. 5.453.2** : fenêtre d’offre, frappe `execCommand`, « C’est parti / Pas parti ». `2026-11-25-favoris-sequence-repare.md`. Geste : 5.453.2.
- **26 nov. · Vestiaire/LBC fiables** : vente VC annulée ≠ « Vendue », lecture VC > 24 h = « à confirmer », Annonces lit `vc_ventes`, « LBC n » pas su sans ventes. `2026-11-26-fiabilite-vc-lbc.md`. Geste : aucun.
- **24 nov. · Textes, aide, traduction (`claude/textes-restes`)** : chaque chemin de l'aide (aide publique, fiches, textes de l'app) JOUÉ dans l'app rendue par le banc `chemins-aide` (49 faux sur main : Colis → À retirer, Paramètres → Aide…) ; Appareils connectés, porte de confidentialité, « Comptes liés » passés par `tr()` (5 langues) ; « paire » dite « pair/par/paio/Paar » partout. `2026-11-24-textes-restes.md`. Geste : aucun.
- **23 nov. · eBay en série (`claude/plateformes-repub-favoris`)** : offre aux observateurs au prix vu relu chez eBay, une par annonce en 48 h ; offres et remises en vente en série. LBC/Vestiaire : plan, attend la 5.441. `docs/passation/2026-11-23-plateformes-repub-favoris.md`. Geste : aucun.


### Lignes §9 de CLAUDE.md déplacées telles quelles le 26 nov. au soir
- **26 nov. · Favoris réparés, ext. 5.453.2** : fenêtre d’offre, frappe `execCommand`, « C’est parti / Pas parti ». `2026-11-25-favoris-sequence-repare.md`. Geste : 5.453.2.
- **26 nov. · COULEURS (Julien : « 14 en sombre, 15 en clair »)** : clair = monochrome (#FFFFFF, encre noire) ; sombre = graphite et vert (#22262B, accent #5BD68F). `src/natif/jetons.css`. Geste : aucun.


### 26 nov. soir — détail de la ligne de CLAUDE.md §9
- **26 nov. soir · EXTENSION : 5.454.0 RETIRÉE, 5.454.1 SERVIE** : la 5.454.0 (6 lots réunis, #1424) « vibrait » et n'envoyait aucun favori chez Julien ⇒ annulée (#1425) ; 5.454.1 = 5.453.2 + « Enregistrer dans un fichier » (Observer Vinted, #1426). Les 6 lots restent sur `claude/ext-5454`, à ne remettre qu'après la cause trouvée ET un essai réel. **VRM Observateur 2.0** (extension à part, `vrm-observateur-extension/`, `public/VRM-Observateur.zip`, #1427) : requêtes + gestes de la page (vrai doigt / script) pendant que Bleam ou Vintex travaille, pour reproduire leur chemin. Geste : 5.454.1, puis un rapport d'Observateur pendant un envoi Bleam et un Vintex. En attente de SA réponse : #1333 #1343 #1316 #1318 #1368 (touchent Aujourd'hui), #1379 #1320 (couleurs) ; #1359 à reprendre (démarrage léger) ; bug « deux codes Vinted Go, même colis » : capture demandée.

Rapports d'Observateur (26 nov., 17 h) : Vintex (compte c8c919) envoie chaque favori depuis l'onglet vinted.fr, sans clic : POST api.vinted.fr/messaging/main/inquiries {item_ids, receiver_id} → GET conversation → GET www.vinted.fr/api/v2/transactions/{tx} → POST …/offers {offer:{currency,price}} → POST …/conversations/{uuid}/replies {content, is_personal_data_sharing_check_skipped:false, photo_temp_uuids:null}, ~15 s entre deux. Bleam (compte 7e6c56) : republication par /items/new (clics de script, photos vers core.vinted.fr/api/v2/photos, catégorie) puis renvoyé 12 fois vers /users/verification/phone ⇒ abandon « la page s'est rechargée plusieurs fois » ; ses messages aussi. Cause : Vinted exige la vérification du téléphone sur ce compte.

### 26 nov. soir — favoris par requêtes « comme Vintex » (ext. 5.455.0)
Julien, après avoir lu le risque (requêtes sans le « bruit » de la page vs clics de script détectables et fragiles) : « A, fais comme Vintex ». Remplace, POUR LES SEULS FAVORIS, la règle du 21 nov. « on ne fait plus les requêtes » (5.414).
- `vintedPageFavori` (background.js) : fetch depuis la page (executerMain, cookies + x-csrf-token de la page, jamais `Authorization`), liste blanche `ECRITURES_FAVORI` : `POST api.vinted.fr/messaging/main/inquiries`, `POST /api/v2/transactions/{tx}/offers`, `POST api.vinted.fr/messaging/main/conversations/{uuid}/replies`. Toute autre écriture : refusée, rien ne part.
- Branche `cheminFavoris()==='vintex'` (défaut) dans `executerMessageFavori` : autorisation serveur → inquiries `{item_ids:[id], receiver_id}` → relecture de la conversation (une seule personne = le destinataire, l'article s'il est listé, aucun message écrit) → transaction (`txConversationMessagerie`, sinon ancienne conversation par `core_id_deprecated`) relue : article = celui du favori, acheteur s'il est dit → offre `{offer:{currency, price « 45.0 »}}` (plancher, garde du prix) → attente offre→message, temps d'écriture → message `{content, is_personal_data_sharing_check_skipped:false, photo_temp_uuids:null}`. Plafonds réservés d'avance, freins 403/429/captcha, une requête à la fois : inchangés. Formes inconnues notées (`noterFormeFavori`, diag `favori_vintex_*`).
- Réserve : `chrome.storage.local.vrmFavorisChemin = 'interface'` remet le chemin par clics (5.453.2). Les anciens audits jugent ce chemin (`_fond-vm.cjs` pose 'interface' par défaut) ; `audit-favoris-requetes-vintex.cjs` (V1–V10, 6 mutations rouges, rouge sur le code d'avant) juge le nouveau.
- Rapport Bleam du 26 nov. 17:14 (après validation du téléphone de jujuf38) : Bleam envoie AUSSI par requêtes depuis la page, avec l'ANCIENNE messagerie : `POST /api/v2/conversations {initiator, item_id, opposite_user_id}` → `GET /api/v2/conversations/{id}` → ~5 s → `POST …/replies {reply:{body, photo_temp_uuids:null}}` → ~13 s → `POST /api/v2/transactions/{tx}/offers {offer:{currency, price}}` (message AVANT offre). Les 400 de la première capture venaient de la vérification du téléphone, pas d'une API morte. Republication Bleam : formulaire /items/new par clics de script (photos, catégorie, titre, description, taille, couleurs, colis, état, prix, marque).

### 26 nov. — « article » hors Sneakers, partout (audit-vocabulaire-article vert, ext. 5.455.1)
`audit-vocabulaire-article` S1 était rouge sur `main` (312 textes « paire(s) » hors Sneakers, surtout depuis le découpage de `fr.js` en `fr/*.js` et les lots du 14 au 26 nov.). Fait sans élargir la liste fermée à l'aveugle :
- **Clés à deux formes dans `t()`** (`src/i18n/index.js`) : `cle` dit « paire » (Sneakers, mot pour mot), `cle.art` dit « article » ; hors Sneakers `t(cle)` rend `cle.art` quand elle existe. Source posée par l'app à côté de `poserSourceVend` : `poserVarianteArticle(() => vendCourant() !== 'sneakers')` ; sans source (banc, serveur) ⇒ textes d'avant. Une langue qui a la clé sans sa forme « article » garde SA phrase. `scripts/_francais-differe.cjs` : `cle.art` part avec `cle` (démarrage ou reste).
- **136 clés** `.art` ajoutées dans fr/en/es/it/de (`src/i18n/langues/*/…`). Les variantes par profil déjà là (`nn.*.sneakers` / `.autre`) sont reconnues telles quelles.
- **« Quoi de neuf »** : `titreArt` / `phraseArt` sur 42 nouveautés, `pourSonMot` (src/nouveautes.js) les montre hors Sneakers.
- **App** : getters `motsVendeur()` (annulerCommandes `vente-main`/`republier-num`, aideVideos `garage`/`messages`, journeePerso `meme-photo`). **Serveur** : `texteRetourArrive` et `texteRetraits` prennent `motsServeur` (ligne `main`, `vrm_je_vends` projeté) ; « retire-las » corrigé en « retire-les ».
- **Extension 5.455.1** : `T()` de vrm-ui.js et vrm-depot.js prend `cle_art` hors Sneakers (`VRM_MOTS.vend()`), 16 clés `_art` (5 langues) ; background.js par `motsExt()` (reprise de republication, « commencée », journal des programmations, `PHRASES_PRECIEUX['repub-serie']` en getter).
- **L'audit** : S1 accepte une forme Sneakers seulement si sa sœur (`cle.art`, `cle_art`, `champArt`, `.sneakers`→`.autre`) existe et ne dit pas « paire », ou une nouveauté `pour: 'sneakers'` ; ne compte plus les clés de traduction (`a.b.c`), les commentaires CSS, les noms de code collés (`data-atelier-paire`, `nav.paires`), les attributs `data-*`, le bloc `<gardes-app>` (recopié de src/, jugé là-bas), la garde `.nom === 'paire' ?`. Trois PERMIS nouveaux, chacun avec sa raison (mots-clés d'un message d'ACHETEUR ×2, mots vides de la recherche, justification jamais affichée de tempsGagne). Nouveaux : E4 (t() exécuté dans les 5 langues : forme article sans « pair »), E5 (Sneakers mot pour mot), E6 (Quoi de neuf), B11, B12 ; 11 mutations de plus ; `VOCAB_MUT=<regex>` pour n'en rejouer que quelques-unes. Rouge sur l'arbre d'avant (E4, E6, S1, B11, B12).
- Reste connu : le bloc `<gardes-app>` de background.js embarque sa propre copie de `profilVendeur.js` dont la source n'est jamais posée (elle dit donc toujours « paire » dans l'extension) — à brancher sur `motsExt()` si un texte de ce bloc s'affiche.

## 27 nov. — extension 5.455.2 : la police du panneau, le mot du bloc `<gardes-app>`

« Extension servie », déplacé tel quel de CLAUDE.md §9 (27 nov.) : **Extension servie : 5.455.1** (26 nov. ; avant 5.455.0, 5.454.1, 5.453.2 ; 5.440.3, 24 nov., « Observer Vinted » ; avant 5.440.2, favoris : liste lue jusqu'au bout ; avant 5.440.1, lien d'application ; 5.440.0, favoris sans geste ; versions servies avant : `historique-divers.md`, « Extension servie », fin).

- **La police du panneau.** La pile du panneau (vrm-badge.js, vrm-ui.js) commence par « Inter VRM », Inter, -apple-system…
  mais l'extension ne chargeait jamais « Inter VRM ». Sur une machine sans Inter, SF ni Segoe UI (la CI), Chromium prenait
  DejaVu Sans, bien plus large : à 390 px, les rangées des favoris « offre … (remontée au prix mini) » montaient à 149 px
  (seuil 140). Le banc `panneau-favoris-tableau` contournait en chargeant Inter lui-même.
  **Correctif** : l'Inter de l'app (`src/design/polices/inter-latin-wght-normal.woff2`, licence OFL) est recopiée dans
  l'extension (`inter-vrm.woff2`, avec `LICENCE-Inter-OFL.txt`), déclarée web-accessible (sites de l'extension), et
  `vrm-ui.js` `police()` la donne au document par `FontFace` sur ses OCTETS (fetch de `chrome.runtime.getURL`, aucune URL
  chargée par la page, sa CSP n'entre pas en jeu), sous le seul nom « Inter VRM » (qu'aucune règle du site n'emploie) —
  une @font-face dans une shadow root n'est pas lue par Chrome. Demandée par `monter()` (les pièces de l'extension
  seulement), une fois par page. Le contournement du banc est retiré ; le banc sert le fichier de l'extension jugée et
  exige « la police vient de l'extension ».
  **Preuve** (`FONTCONFIG_FILE` qui refuse Inter) : sans le correctif, rangées 149 px, 2 rouges ; avec, 164 verts ;
  mutation (`police()` retiré de `monter`) : 3 rouges (police absente, 149 px).
- **« paire » dans `<gardes-app>`.** Le bloc recopié de src/ par `scripts/recopier-gardes-extension.cjs` empaquette SA copie de
  `src/profilVendeur.js` ; rien n'y posait la source du mot (`poserSourceVend`), donc `vendCourant()` ⇒ « sneakers » : par ex.
  le geste « Une seule annonce par paire : vérifie l’autre » (`problemesAnnonce`) à tout vendeur. **Correctif** dans le
  générateur (jamais à la main) : il exporte `poserSourceVend` et ajoute au bloc
  `GARDES_APP.poserSourceVend(() => (motsExt() === MOTS_ARTICLE.autre ? 'autre' : 'sneakers'))` — le vocabulaire de
  l'extension (`vrm_vend_ext`), lu à chaque texte. **Preuve** : `audit-vocabulaire-article` X8 (vendeur « autre » ⇒
  « article »), X9 (rien de su ⇒ « paire »), X10 (un changement de « Je vends » est suivi), EXÉCUTÉS sur le vrai
  background.js ; le background.js d'origin/main rend « … par paire … » ; deux mutations (source retirée, source figée
  sur Sneakers) rouges.
- **Le panneau après la connexion ne coupe plus une page qui charge** (banc e2e, commit 27ebb4d32 de
  `claude/zero-rouge-bancs-2`). Depuis la 5.453, une liaison demandée ouvre le panneau 300 ms après la session
  (`ouvrirPanneauAccueil`) ; sans onglet de départ, il prenait N'IMPORTE QUEL onglet vinted.fr ouvert (l'actif d'abord) et
  le menait par `chrome.tabs.update` sur `/?vrm=panneau` : une page qu'il chargeait était coupée (net::ERR_ABORTED).
  **Correctif** : `ongletEnCharge` (`status` ≠ `complete` ou `pendingUrl`) n'est jamais touché ; l'onglet de DÉPART d'abord
  (s'il ne charge pas), sinon un onglet vinted.fr au repos (`ongletAuRepos` : chargé, pas actif), sinon un onglet NEUF
  (sur le site de l'onglet de départ s'il est connu). **Preuve** : `audit-connexion-simple` S8 (5 contrôles, vrai
  background.js par `_fond-vm.cjs`) : 5 rouges sur la 5.455.1, verts après ; mutation (`ongletAuRepos` sans les gardes) :
  5 rouges ; S7 (5.453) inchangé et vert. Banc `e2e-extension` (attend `panneau_apres_connexion_*`, repris de 27ebb4d32).
## Ligne déplacée telle quelle de CLAUDE.md §9 (27 nov., pour rester sous 60 Ko)

- **26 nov. · Vestiaire/LBC fiables** : vente VC annulée ≠ « Vendue », lecture VC > 24 h = « à confirmer », Annonces lit `vc_ventes`, « LBC n » pas su sans ventes. `2026-11-26-fiabilite-vc-lbc.md`. Geste : aucun.

## Ligne déplacée telle quelle de CLAUDE.md §9 (27 nov., retour-fonctions, < 60 000)

- **25 nov. · PASSATION GÉNÉRALE** : lire en premier `docs/passation/2026-11-25-passation-generale.md` (en ligne le 24-25 nov., train en cours et son ordre, décision du 24 nov. « tout faire depuis VRM si l'extension est connectée », maquettes C3/Monochrome dans `docs/design/maquettes-25nov/`), puis `2026-11-23-passation-generale.md`. Geste : extension 5.440.4 dès qu'elle est en ligne.
- **26 nov. · « article » hors Sneakers partout (ext. 5.455.1)** : `historique-divers.md`, fin.

### Passations à lire, d'avant le 22 nov. (déplacé tel quel de CLAUDE.md §9 le 27 nov., taille)

puis `2026-11-20-passation-generale.md`, puis `docs/passation/2026-11-16-passation-generale.md` (la plus complète : en ligne, prêt, en pause, en file, refusé, gestes), puis `2026-11-16-passation.md`, `2026-11-10-passation-finale.md` et `2026-11-09-passation-generale.md` (puis, pour l'ancien, `2026-11-07-passation-generale.md` et `2026-11-02-liste.md`).

## Ligne déplacée telle quelle de CLAUDE.md §9 (27 nov. soir, < 60 000)

## Ligne de CLAUDE.md §9 déplacée telle quelle le 27 nov. (place sous 60 Ko)

- **26 nov. soir · FAVORIS PAR REQUÊTES « comme Vintex » (Julien : « A, fais comme Vintex »), ext. 5.455.0** : inquiries → conversation → transaction → offre → message, depuis la page, SEULES écritures permises (`ECRITURES_FAVORI`) ; garde-fous inchangés ; clics en réserve (`vrmFavorisChemin: 'interface'`). Bleam fait pareil (ancienne messagerie). `historique-divers.md`, fin. Geste : installer 5.455.0.

## Ligne déplacée telle quelle de CLAUDE.md §9 (27 nov., < 60 000)

## Lignes de CLAUDE.md §9 déplacées telles quelles le 27 nov. soir (place pour la 5.455.3, sous 60 Ko)

- **27 nov. · ext. 5.455.2** : police « Inter VRM » du panneau ; `<gardes-app>` dit « article » ; le panneau ne coupe plus un onglet qui charge. `historique-divers.md`, fin. Geste : installer 5.455.2.
- **27 nov. · « 978 216 » deux fois, un point en deux cartes** : un colis = ses identités (code lu aussi dans SA commande, n°, transaction), « à vérifier » compris ; un point = son adresse. `historique-colis-retraits.md`, fin. Geste : aucun (après fusion).

## 27 nov. · Améliorations (branche `claude/ameliorations-27nov`, Julien : « Vas-y fais tout »)

1. **Contenu d'un colis à retirer (codes 713 080 et 703 693, Vinted Go, 10 Rue du Bois Aurant).** Cause trouvée dans le code :
   l'e-mail du transporteur (n° de suivi, code) et l'e-mail Vinted de SA commande (conversation, MÊME code) sont réunis par le
   code (`fusionnerParCode`, src/retraitPreuves.js) ; la réunion (`fusionLignesMemeSuivi`, src/ecrans/Comptabilite.jsx) gardait
   la ligne du transporteur (`...m`) et PERDAIT `conv` : `commandeDuColis` ne trouvait plus l'achat ⇒ « Contenu pas encore lu ».
   La ligne réunie garde la conversation (une seule ; deux conversations différentes au même code ⇒ aucune, rien n'est choisi).
   Jamais le titre. Sans identité : « pas encore lu » et sa raison sous « Pourquoi ? » (inchangé). Banc `retrait-contenu-code`
   (témoin au même titre, deux conversations au même code) ; `retrait-double-code` reste vert. Pas mesuré sur la vraie base
   (aucun accès en lecture depuis cette session) : si ses deux colis restent « pas lu », c'est que l'e-mail Vinted de la commande
   n'a pas porté le code — le n° de suivi lu côté achat (extension) reste alors la seule identité.
2. **Bénéfice « — » sur Aujourd'hui** : la publication `vrm_benefice_jours` porte déjà `n` et `nCout` ; `valeurChiffre('brut')`
   (src/design/carteChiffres.js) rend `prixManquants = n − nCout` (et pour les ventes faites, `vendus.prixManquants`) ; le héros
   (fenêtre 7 j / 30 j / mois) et les tuiles Brut / Net disent « N prix manquants », la porte ouvre la saisie en série
   (`onSaisirPrix`). Rien n'est deviné, un lot = une vente.
3. **« Vinted pas lu depuis N jours »** : src/lectureAncienne.js (pur) lit la PUBLICATION de la ligne de fraîcheur
   (`fraicheurPubliee`, src/fraicheur.js — comptes au-delà de 24 h ou en panne, date de LEUR lecture) ; une rangée sur
   Aujourd'hui (src/aujourdhui/LigneLectureAncienne.jsx), le geste dessous, le compte et les autres sous « Pourquoi ? ».
   « Compris » range CE compte à CETTE date de lecture (`vrm_lecture_ancienne_rangee`, confort de l'appareil) : elle ne
   revient que si la lecture change.
4. **« Ordinateur éteint · 21:20 »** (src/aDistance/LigneOrdinateur.jsx) : « Rien ne part tant qu'il est éteint » (7 mots) ;
   « Pourquoi ? » : les gestes « À distance » attendent 24 h au plus, Vinted n'est plus relu, et le geste (allumer, Chrome
   avec l'extension). Budget de mots d'`aujourdhui-moins-texte` + 8 (déjà rouge sur main avant : 118 > 117 et la coupure
   « Saisis 2 prix › », réglée par main entre-temps).
Banc `aujourdhui-portes-27nov` (390/1512, clair/sombre) : rouge sur l'avant (24) et sous mutation de chacune des règles.
CI de la PR #1451 : « Chrome » en dur remplacé par « le navigateur où est l'extension VRM » (audit-chrome-en-dur, 5 langues : la
phrase parle de l'ORDINATEUR, pas du navigateur d'ici) ; `conv` posé APRÈS `code:` dans `fusionLignesMemeSuivi`
(audit-retraits-irreprochables lit `codesLus,` puis `code: src.code`) ; banc chiffres-coherents E : attendre le nombre réel
de l'onglet « À expédier » (vide sous charge à 1512, §6.5).

## Ligne de CLAUDE.md §9 déplacée telle quelle le 27 nov. soir (ameliorations-27nov, place sous 60 Ko)
## Ligne déplacée telle quelle de CLAUDE.md §9 (27 nov. soir, < 60 000)

- **27 nov. · TROIS FONCTIONS RENDUES (Julien)** : filtre « Compte » de Ventes au téléphone (retenu par vendeur), alerte « un compte annule plus » dans Statistiques (règle du 5 nov. importée, un compte pas lu jamais comparé), questions eBay sans réponse en tête de Messages « À répondre ». `2026-11-27-retour-fonctions.md`. Geste : aucun.

## Ligne de CLAUDE.md §9 déplacée telle quelle le 27 nov. nuit (place pour la 5.455.4, sous 60 Ko)

- **27 nov. · Aujourd'hui à 1008 px (Edge 150 %)** : les colonnes suivent la largeur de LA GRILLE (`@container sj-journee` : 3 dès 860 px, sinon 1 + 2, une sous 560) ; le compte d'« À envoyer » s'abrège. Bancs `iphone-reprise` O3 et `journee-coherence` E12 (`_journee-tient.cjs`). `historique-interface-stock.md`, fin. Geste : aucun.

## Ligne de CLAUDE.md §9 déplacée telle quelle le 27 nov. nuit (place pour la 5.455.5, sous 60 Ko)

- **27 nov. · Scan au relais ⇒ en stock ; « Ce matin »** : `2026-11-27-scan-ce-matin.md`.
- **27 nov. soir · FAVORIS RÉPARÉS (Julien : « tu dois faire comme les concurrents »), ext. 5.455.3** : l'identité est celle de la DEMANDE (`inquiries` article + personne) ; transaction rendue par la création ; relecture ×3 pour l'historique ; refus seulement sur contradiction LUE, raison nommée, CE favori sauté, la file continue. `2026-11-27-favoris-identite.md`. Geste : installer 5.455.3.
## Ligne de CLAUDE.md §9 déplacée telle quelle le 27 nov. soir (ameliorations-27nov, 2ᵉ fusion, place sous 60 Ko)

- **27 nov. · Aujourd'hui à 1008 px (Edge 150 %)** : les colonnes suivent la largeur de LA GRILLE (`@container sj-journee` : 3 dès 860 px, sinon 1 + 2, une sous 560) ; le compte d'« À envoyer » s'abrège. Bancs `iphone-reprise` O3 et `journee-coherence` E12 (`_journee-tient.cjs`). `historique-interface-stock.md`, fin. Geste : aucun.

### Déplacé de CLAUDE.md §9 le 27 nov. (taille)
- **27 nov. · « Vas-y fais tout »** : À retirer garde la conversation de SA commande à la réunion par code (713 080 : photo, titre) ; « N prix manquants » ; « pas lu depuis N jours » (« Compris ») ; « Ordinateur éteint » + « Pourquoi ? ». `historique-divers.md`, fin.
- **27 nov. · Scan au relais ⇒ en stock ; « Ce matin »** : `2026-11-27-scan-ce-matin.md`.
