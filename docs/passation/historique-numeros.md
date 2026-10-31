# Historique — numeros

> Texte déplacé TEL QUEL depuis `CLAUDE.md` le 31 octobre 2026 (allègement du dossier : 1,36 Mo → moins de 60 Ko).
> Rien n'a été réécrit : les paragraphes gardent leur ordre d'origine. Le classement par thème est automatique (mots du titre) — en cas de doute, chercher par `grep` dans tous les `docs/passation/historique-*.md`.

> **29 octobre — 5.287, numéros sur les profils visités :** Julien a précisé que
> l’affichage semble seulement sur Vinted, l’import dans VRM n’est pas confirmé.
> `/member/{id}` : aucun numéro renvoyé sans égalité avec le PROFIL du compte
> connecté ; aucun numéro créé par une visite. Les pastilles sont purgées après
> navigation et les réponses tardives ignorées ; cache du fond séparé par owner VRM.
> Huit contrôles UI + trois tests du fond ; ancien affichage reproduit. Pas de
> nettoyage de stock ni de réattribution. `docs/numeros-profils-vinted.md`.

> ⚠️ **29 octobre — LE STATUT LU CHEZ LE TRANSPORTEUR remis sur `main` (extension 5.281), PAS FINI :** Julien : « tu as
> juste à regarder sur le site du transporteur… le statut », « ça marche si je n'ai pas l'extension allumée ? ». Le chantier
> du 24 octobre (`v24-transp` : serveur + app ; `v24-transp-ext` : extension, numérotée « 5.217 » sur sa branche) est
> fusionné sur `main` (a0d43bd) dans `v29-colis`. Le SERVEUR lit seul Mondial Relay (`_mvc` de mondialrelay.fr, n° + code
> postal du relais, voie `mr-fr-mvc`), Chronopost (`ws.chronopost.fr` trackSkybillV2, `cp-ws2`) et Vinted Go
> (`carrier.vintedgo.com/public/v3/tracking_events`, `vg-v3`), User-Agent honnête `VRM-suivi/1.0 (+https://vrm.center)` —
> sans l'extension (`api/_lib/transporteurs.js` règles pures, `transporteurs-lecture.js` réseau, `api/relais.js` modes
> `transp` · `transp-a-lire` · `transp-brut`, matin et soir dans `ship-reminders`, widget, `email-inbound`). Lignes
> `transp_{carrier}_{n°}` (serveur seul, compare-et-échange), règle des fins dans `suivi-colis.js` (`finsDesLignes`
> + `transp`, `fusionTransporteur`, `sortiParSuivis` → `a_verifier`), app : `LigneTransporteur`, `TeteTransporteurs`,
> `useRelectureTransporteurs`. L'extension n'est qu'un SECOURS (C3 : ce que le transporteur refuse au serveur ; C4 : la
> réponse brute, jugée par la MÊME fonction serveur ; `transpTick`, `transp-page.js`). Version : la « 5.217 » du chantier
> était déjà PUBLIÉE par `main` avec un autre contenu, et la 5.280 prise par `main` pendant la fusion ⇒ **5.281.0** (`EXT_ATTENDUE`, `EXT_CAPACITES.transp`,
> `CODE_VERSION`, `CAPTEUR_VERSION`, `relaisVersion`, zips). ⚠️⚠️ **Le 29 oct. au soir, `main` a publié 5.281, 5.283 et
> 5.284 sans ce code** : à l'intégration, monter l'extension (≥ 5.285, jamais servie) ET `EXT_CAPACITES.transp` ensemble
> (`audit-coherence`, `audit-extension-zip` le disent rouge d'ici là) — **fait au tour 2 : 5.290.0**. **Les 19 défauts du tour 2 (relecture du 29 oct. au soir) sont corrigés** — « tour 2 » en fin de dossier. Des 21 défauts reproduits le 24 oct., **les n° 1 à 11
> (règles, états, écran) sont corrigés** — « Statut chez le transporteur, tour 1 » en fin de dossier ; **les n° 12 à 21
> (notifications) aussi** — « tour 1, les notifications », juste après (nouvelle arrivée, « pas su » qui ne consomme rien,
> une notification pour suivi Vinted + transporteur + e-mail, pause globale par transporteur, bail, C4 daté, bornes, 72 h ;
> `audit-transp-notif` 17/17). Côté extension (Chronopost 14 caractères,
> `mr-be` en repli de `mr-fr-mvc`, corps 192 Ko, conversations UUID, achats au point relais lus d'abord) : branche
> `v29-colis-ext`. Preuves de la fusion : 174 audits (sans les 5 Postgres), mêmes rouges que `main`
> (`audit-politique-hotes` 1, `audit-preuve-vente` 18 — déjà là) ; `audit-statut-transporteurs` (`--prouve` 29/29),
> `audit-mondialrelay-serveur` (24/24), `audit-transp-ext` (11/11) verts, rouges sur `main` (24 · 6 · 54) ; banc
> `transporteurs` vert (49 rouges sur le build de `main`) ; bancs colis, widget, rappels, notifications, popup, badge, pont,
> premierjour verts.

> **29 octobre — plus de saisie « N° + Entrée », et la carte reste claire :** Julien : « enlève N°+entrée sur
> chaque onglet, il y a déjà la barre de recherche » et « la carte est en sombre quand on met le mode sombre, je
> veux que ça ne change pas la couleur de la carte ». `SaisieNumeroPlateforme` (Ventes, Colis, Annonces Vinted,
> Leboncoin, eBay) est RETIRÉE avec ses écoutes de chiffres (`chercherNum*`, `DEMANDE_NUM_PLAT`) et son CSS ; la
> recherche par numéro reste la loupe (« Tout sur le N° ») et le Stock garde la sienne. La carte de la communauté
> et la mini-carte des points relais gardent le style CLAIR (`positron`) en mode sombre ; le reste de l'écran suit
> le thème. Bancs `pave-vinted.cjs` et `pave-plateformes.cjs` réécrits (aucune saisie, un chiffre + Entrée ne
> change ni l'écran ni la section) : 8 et 4 rouges sur main ; `communaute.cjs` exige `positron` en sombre.

> **29 octobre — « les photos sont déjà là, pourquoi Vinted les refuse ? » (5.274) :** MESURÉ : sur ses brouillons faits par
> VRM, Vinted refuse les photos à la mise en ligne ; le nouvel essai avec les MÊMES photos n'a jamais passé (0 sur 5), les photos
> RENVOYÉES ont passé 5 fois sur 5. Cause pas encore mesurée (les numéros de photo que VRM rattache au brouillon). ⇒
> `completionSecoursPhotos` renvoie tout de suite les photos du coffre (« essai 2 sur 2 », « photo n sur N »), plus d'essai inutile ;
> si la mise en ligne bloque ensuite sur autre chose (la taille), les photos neuves sont GARDÉES dans le brouillon enregistré ; la
> forme de la réponse de `POST /api/v2/photos` est relevée (`photo_reponse_forme`, clés et types) pour trouver la cause. Preuve :
> `audit-recreer.cjs` (3 contrôles revus + « taille après photos »).

> **28 octobre (nuit, fin) — la paire REPUBLIÉE garde son numéro, et les N° revus sur Vinted (5.265) :** Julien :
> « quand la paire est republiée elle ne conserve pas son numéro, sur Vinted il n'y a plus les numéros ». Mesuré :
> Jordan 3 N°2→107, Air Max 1 N°53→108, zoom fly N°94→109 (toutes `auto`, données après la mise en ligne d'un brouillon :
> seule la création directe reportait le N°). ⇒ `src/repriseNumero.js` : la table nouvelle → ancienne annonce vient des
> lignes de l'extension (`vinted_brouillon_*.ancienId`, l'id du brouillon = l'annonce publiée ; `coffre_*.recreeDe`) —
> une IDENTITÉ ; la numérotation automatique attend cette table (`recreesNum` pas lue ⇒ on attend, illisible ⇒ comme avant)
> et donne à la republiée le N° de l'ancienne (plus en ligne, une seule remplaçante, N° sur aucune autre paire en ligne) ;
> une republiée renumérotée AUTOMATIQUEMENT le retrouve (`numeroRendu`, l'autre reste brûlé) — jamais un N° posé à la
> main ni porté par une vente. Sur Vinted, la pastille posée DANS un lien qui recouvre la photo passait SOUS la photo :
> elle s'épingle sur la carte (`carteDe`, jamais la grille). Preuves : `audit-reprise-numero.cjs` (4 mutations rouges),
> banc `numero-vinted.cjs` (2 rouges sur l'avant).

> **28 octobre (nuit, fin) — la COULEUR, et la barre de progression (5.259) :** Julien : « ça a laissé
> l'annonce en brouillon » (N°72) puis « 400 : Erreurs trouvées ». Mesuré : le brouillon de VRM ne différait
> d'un brouillon accepté par Vinted que par `color_ids: []` — Vinted RANGE un brouillon sans couleur mais
> REFUSE sa mise en ligne. ⇒ `idsCouleurVinted` lit `color_ids`, `colors[].id`, `color1_id`/`color2_id` ;
> `itemPourRecreer` exige la couleur (modèle ou codes, sinon lue chez Vinted par `apprendreRecetteVinted`,
> même avec un modèle) — inconnue ⇒ `couleur-absente`, RIEN supprimé ni créé ; `publierBrouillon` et
> `refaireBrouillon` refusent un brouillon sans couleur avant d'envoyer ; `raisonRefusVinted` nomme les
> champs de `errors[]` (plus seulement « Erreurs trouvées »), diag `vinted_refus_champs_*`,
> `recette_sans_couleur_<clés>`. Barre : l'extension annonce chaque étape (`maj · repub` : photos n/N,
> enregistrement, suppression, brouillon, attente, en-ligne ; direct : photos, creation, suppression) ;
> `RepublierVinted` dessine une barre d'ensemble (`data-republier-total`) et une par paire en cours
> (`data-republier-progression`, `progressionRepub`) ; `lecturesPartagees` ne se vide pas sur ces
> évènements. Preuves : `audit-recreer.cjs` (92 ; 10 rouges sur la 5.258), banc `republier.cjs` (barre).
> N°72 : le brouillon 10574536209 est dans ses brouillons Vinted, SANS couleur — à finir sur Vinted.
> **Suite (5.260), « ça ne publie pas, ça me met ce message »** : un brouillon sans couleur ⇒ l'extension
> répond `couleur-absente` avec `couleurs` = celles dont l'identifiant est MESURÉ (`COULEURS_VINTED_SURES`,
> aujourd'hui `{1:'Noir'}`, lu sur son « Nike p-6000 noir » accepté) ; l'app DEMANDE (« Noir — publier » /
> « Autre couleur », `avecCouleurBrouillon`) et renvoie la commande avec `couleur` (publierBrouillon,
> refaireBrouillon, Brouillons → en ligne). Une couleur non mesurée n'est jamais envoyée.

> **28 octobre (nuit, fin) — la PHOTO de la paire sur chaque carton (3D) :** « mettre les photos avec les numéros sur
> les boîtes ». Face avant : la photo à gauche de l'étiquette (dessinée carrée malgré la face allongée), le N° à droite,
> toujours en gros. La photo d'un N° (`photoParNum`, Stock) : seulement si TOUTES les fiches qui portent ce N° montrent
> la même photo (`photoKey`) — deux paires sous un N° ⇒ aucune photo, rien demandé (§5). Octets par l'extension, sinon
> `/api/compte?mode=photo` (`chargerPhotoBoite` : le CDN n'envoie pas de CORS, une image directe salirait la toile WebGL) ;
> gardés pour la session (`IMAGES_BOITES`) ; illisible ⇒ le numéro seul. Sonde `photosBoites`. Banc `stock-finitions.cjs`
> XVI (+3 par taille ; garde « une seule photo » retirée ⇒ 2 rouges). ⚠️ Non mesuré : sur sa vraie pièce, le nombre
> d'appels à la route photo (un par carton, une fois par session ; 3 en vol au plus).

> **28 octobre (nuit, fin) — BOÎTES AU SOL : une hauteur par pile :** Julien : « fais le point 1 » (pas de plateau
> imaginaire sur une pile au sol — refusé exprès, rien ne tient un carton par terre). `it.rows` reste le PAS de `nums`
> (la plus haute pile) ; `it.hauteurs[c]` (absent ⇒ `rows`, comme avant) = combien de cartons la pile c accepte.
> Sélection de la pile → « Hauteur de chaque pile » (±, `data-pile-col`/`data-pile-h`, dès 2 piles). `changerHauteurPile` :
> chaque carton garde sa pile et sa place, les autres piles ne bougent pas ; réduire sous ses cartons est refusé et dit.
> `ajouterAPile(…, rows, hauteurs)` ne comble jamais une place au-dessus de la hauteur d'une pile. « Boîtes de haut
> (toutes les piles) » re-empile tout et remet une seule hauteur. Preuves : `audit-stock-plan.cjs` (+6, 3 mutations
> rouges ; ancre périmée de `place_haut_dabord` réparée), banc `stock-finitions.cjs` XIV (390/1512).

> **28 octobre (suite) — retrouver encore plus vite :** les meubles portent leurs REPÈRES (colonnes numérotées
> au-dessus, rangées à gauche, `data-regle-*`) ; micro dans la recherche (`MicDictee`, « numéro 12 » ⇒ N°12) ;
> pendant une recherche, un meuble sans résultat se replie (« rien ici ») et l'autre dit « N ici » ; « Les montrer
> toutes (N) » et Entrée sur plusieurs résultats ⇒ liste « À aller chercher » triée dans l'ordre du chemin
> (meuble, puis de haut en bas, de gauche à droite), chaque ligne mène à SA case ; « N vendues à sortir — où
> sont-elles ? » fait pareil pour les vendues. Badge VENDU en bas de la vignette (il couvrait le N°). Banc
> `stock-retrouver.cjs` : 34 contrôles.

> **28 octobre — RETROUVER N'IMPORTE QUEL ARTICLE dans Stock → Mes meubles :** Julien : « je veux pouvoir
> retrouver facilement n'importe quel article ». Grande recherche collée en haut (`data-stock-recherche`) : plusieurs
> mots, sans accent (« nike 42 noir ») ; un N° seul par IDENTITÉ (« 12 » ≠ N°128 ; un nombre peut aussi être une
> taille, mot entier du titre) ; chaque résultat dit OÙ (« Étagère salon · rangée 2, colonne 3 », ou « pas encore
> rangé ») ; le toucher referme la liste, défile jusqu'à SA case qui clignote, et la place reste écrite (« À aller
> chercher »). Un N° hors stock est DIT. Ordinateur : un chiffre tapé n'importe où ouvre la recherche. La fiche dit
> « rangée X (en partant du haut) · colonne Y (depuis la gauche) » au lieu de « case N ». Colis (« où sont ces
> paires ») et la loupe globale (« Tout sur le N° ») mènent maintenant à « Mes meubles » (`ouDansMeubles`, avant la
> pièce 3D). Meuble plafonné à 150 px par colonne sur ordinateur. Banc `stock-retrouver.cjs` (390/1512 ; mutation
> « N° par sous-chaîne » ⇒ 2 rouges).

> **28 octobre — le tour de Ma journée et de Colis sur ses vraies données :** Julien : « fais pareil pour
> Ma journée et Colis ». Croisé (lecture seule) : 9 à envoyer (11 ventes `needs_action` moins 2 « colis
> déposé » = litiges), N°30 tomj683 vraiment 5 j de retard (limite 23/10 10 h, ventes relues ce matin).
> Corrigé : (1) sur TÉLÉPHONE « Vendu en octobre » n'affichait que « ≥ » — une règle de `styles-epure.css`
> cachait le premier enfant du montant partiel (elle visait un mot « au moins » qui n'existe plus) ⇒ le
> montant reste, « ≥ » devant (`vendu-recu.cjs`, 1 rouge sur l'avant) ; (2) Ma journée disait « 1 paire
> vendue sur Vinted, encore en vente sur eBay » (VRM-81 lue N°81) quand l'écran eBay disait, à raison,
> « pas reliée » : la mémoire de 800 ms de `fichesPourEbay` gardait des fiches VIDES lues juste avant le
> nuage ⇒ elle est relue quand le nuage arrive (`audit-ebay-lien-identite`, 1 rouge sur l'avant) ;
> (3) « Détail › » du bénéfice à 44 px au doigt. Textes de Ma journée NON touchés (autre agent).

> **27 octobre — un article parti sort tout seul du Stock :** Julien : « enlever le numéro si
> l'article est expédié ». Tranché avec lui : la PLACE (case ou pile) se libère, le NUMÉRO reste
> (bordereau, achat, bénéfice, retour ; jamais redonné). Seulement quand VINTED dit le colis parti
> (`venteSortieDuStock` : acheminement, déposé, livré, finalisé — jamais « Colis fait » ni un
> bordereau reçu ; annulée ou retour ⇒ non), et si plus rien de présent ne porte le N°
> (`porteursNum`). Ventes, annonces ou plan pas lus ⇒ rien ne bouge ; écriture au nuage ratée ⇒ rien
> n'est dit retiré. Le Stock dit « Sortis du stock car partis » (`vrm_stock_sortis`, synchronisé)
> avec « Remettre » ; une paire remise n'est plus retirée (`vrm_stock_garder`). Une « boîte seule »
> reste à la main. Banc `stock-partis.cjs` : 10 rouges sur main, 4 sous mutation (les deux gardes
> « à poster » retirées).

> **27 octobre — le pavé numérique sur Achats et Annonces (Vinted) :** même saisie. Achats : un
> achat n'a un N° que s'il a été RELIÉ à une paire sur son clic (`buyFromId` d'une fiche ou d'une
> vente) — jamais deviné ; N° + Entrée montre cet achat (onglet « Tous », filtres et « Voir plus »
> levés) ; aucun achat relié ⇒ dit. Annonces : la carte en ligne de ce N° (vue rapide ou recherche
> levées) ; plus en ligne ⇒ sa vente nommée. Sur Annonces la saisie vit DANS la barre d'outils
> (`barre`) : une ligne de plus faisait passer la première carte sous le seuil du 26 oct. (684 px).
> Banc `pave-vinted.cjs` : 8 rouges sur main pour ces deux écrans, 30 verts après ; filtres non
> levés ⇒ 3 rouges.

> **26 octobre — Statistiques, Compta, et le grand titre sur téléphone :** un titre d'écran
> IDENTIQUE à celui de la barre du haut se tait sur téléphone (`ScreenHead` →
> `vrm-screen-head-doublon`, comparé à `TITRE_BARRE` posé par la coque ; un titre différent,
> ou l'ordinateur, le garde). Statistiques passe par `ScreenHead` (sa phrase « Tes ventes, ton
> évolution… » est partie). « Vendu · 12 mois » : la légende du graphique (`legende`) redisait
> les mois écrits juste dessous, arrondis autrement — retirée. Compta : « ⓘ À quoi ça sert ? »
> écrit (`Pourquoi ecrit`), plus un ⓘ seul sous chaque carte ; le tableau par période ne
> s'allonge plus de mois anciens sans aucune vente (`n === 0` partout). Banc
> `annonces-ventes-brouillon.cjs` (vues `dashboard`, `compta`, `cat_bord`) : 9 rouges sur main,
> vert après. Même règle sur Paramètres (`vrm-set-tete`) et Organisation (`ops-entete-doublon`,
> vendeur seul) : 2 rouges sur main, vert après.

> **26 octobre — bordereaux sur ordinateur :** « bègues, ne s'ouvrent pas ». L'onglet
> vide réservé au clic prenait le premier plan, cachait la confirmation du N° (à
> vérifier, deux paires) et se refermait au bout de 25 s. Le PDF s'ouvre maintenant
> DANS VRM (`VisionneusePdf`, z 9500, sous les confirmations) : cadre sur le PDF,
> « Imprimer », « Ouvrir dans un onglet », « Télécharger ». iPhone inchangé.
> Banc `ventes-bordereau.cjs` : 4 rouges sur main, vert après.

> **30 octobre — refonte visuelle en ligne (première passe, `v29-refonte` sur #911/#912) :** trois formes de
> bouton seulement — `vrm-b-primaire` · `vrm-b-secondaire` · `vrm-b-discret` (`src/styles-boutons.css`, composant
> `Bouton` ; `Btn` est secondaire par défaut, un primaire se DEMANDE ; plus de rouge hors doublon de N°, Annuler
> en discret). `Avancement` (une barre : où j'en suis, combien, ce qui a raté) pour Republier. Une ligne de texte
> par bloc, le détail derrière ⓘ ; menus « Outils » en feuille du bas sur téléphone. Écrans traités : coque, Ma
> journée, Ventes, Achats, Republier, Stock, Statistiques, Communauté, Réglages (et une première touche sur
> Annonces, Colis, Compta). L'écran de connexion/inscription est celui de #911/#912, non retouché. **Reste (seconde
> passe)** : Annonces, Messages, Leboncoin, eBay, Colis, Compta ; et UN primaire par écran, par le slot principal
> de `ScreenHead`.
> **Même passe — la mise en page sur Edge sous Windows** (mesuré : `scratchpad/edge/rapport.md`, Chromium à barres de
> défilement classiques) : (1) fenêtre basse, le bas du rail (Stats, Compta, Communauté) disparaissait sans indice →
> rail resserré `(min-width:768px) and (max-height:800px)` (logo 40 px, entrées 38 px), fondu `data-rail-suite` posé
> par `SideBar`, entrée active ramenée dans la vue ; (2) Messages faisait défiler la PAGE en plus de la liste (un
> `.vrm-sr` repéré sur <body>) → `.vrm-main{position:relative}` et `html{overflow:hidden}` à TOUTES les largeurs
> (styles-epure) ; (3) 768–1023 px à la SOURIS = coque ordinateur : `MQ_ORDINATEUR` = `(min-width:1024px),
> (min-width:768px) and (hover:hover) and (pointer:fine)` dans `useOrdinateur` ET les media queries de COQUE
> (île, en-tête, barre du bas, 44 px, fondus des rangées, `.vrm-rangee`/carrousel) — leur complément au doigt ; les
> règles de CONTENU restent à la largeur ; une tablette au doigt garde la coque téléphone ; (4) colonne des
> conversations `minmax(340px,36%)`, filtres qui reviennent à la ligne ; (5) une seule hauteur `--vrm-msg-h` pour liste
> et panneau ; (6) l'île FLOTTE (`absolute`, plus de rangée de 66 px) — chaque première ligne qui n'est pas un
> `ScreenHead` lui réserve `--vrm-ile` (résumé de plateforme, Organisation, Communauté, Réglages, « Modifier » de Ma
> journée) ; titres à 26 px si `max-height:760px` ; (7) Ma journée 1024–1279 : « À faire » en 2 colonnes, une tâche
> seule (ou à côté du rappel URSSAF pleine largeur) prend la ligne ; widgets à 6 colonnes seulement dès 1280. Banc
> `scripts/bancs/edge-tailles.cjs` (8 tailles, souris/doigt, rail, double défilement, coque, débordement, île
> mesurée sur les LETTRES, case vide) : 73 rouges sur un build d'origin/main, 0 après. ⚠️ Non mesuré : un vrai Edge
> sous Windows (polices ClearType, barres « Fluent »).

### Les numéros de rangement
- **Un numéro n'est JAMAIS réattribué** (il est écrit sur un carton réel). Le pool
  est append-only ; `freedNums` a été supprimé — ne pas le réintroduire.
- Le compteur qui monte à 330 pour 30 paires en stock est **normal** : ça veut
  dire 329 paires passées. Ne pas « corriger ». « Renuméroter à la suite » n'est
  plus proposé nulle part.
- **Rien ne change un numéro tout seul.** Les seuls chemins : les champs N° (annonce
  ou vente), le bouton d'un doublon, le bandeau ♻️ de reprise — **tous sur son clic**.
  Seule exception : une annonce **sans** numéro en reçoit un automatiquement.
- **Deux paires présentes sous le même numéro** est le seul risque irréversible de
  l'app : c'est le seul endroit où le rouge est justifié.
- ⚠️⚠️ **LES DOUBLONS SE RÈGLENT TOUT SEULS (20 octobre, décision de Julien :
  « l'app fait elle-même les changements… elle ne doit plus jamais se tromper,
  j'ai failli perdre 100 euros »).** Seule exception à « rien ne change un numéro
  tout seul ». Règle pure `doublonsAReattribuer` (App.jsx) : une vente À POSTER
  garde le N° (les annonces qui le portent changent) ; sinon, entre annonces en
  ligne, le N° saisi à la main gagne, puis le plus ANCIEN (`numberedAt`) ; garage
  ou vente annulée en jeu ⇒ rien n'est deviné, le bloc rouge reste. Le numéro
  neuf vient de `prochainLibre` (jamais servi), est brûlé, et la fiche porte
  `reattribue: {de, vers, at, ecrit?}`. « Pas su » ne change rien (nuage pas
  chargé, numérotation pas relue, annonces ou ventes d'un compte pas lues). Une
  fois par paire et par ouverture (`DOUBLONS_FAITS`) ; au chargement, une
  réattribution faite sur l'appareil et pas encore au nuage GAGNE
  (`fusionNumerosAuChargement`), sinon chaque rechargement redonnait un AUTRE
  numéro. La liste « nouveaux numéros à écrire sur tes cartons »
  (`data-numeros-a-ecrire`, Annonces et Colis) reste jusqu'à « C'est écrit » ;
  l'impression demande si un N° est porté par deux fiches ou si son nouveau N°
  n'est pas encore écrit (`confirmerNumerosAVerifier`). Preuves : banc
  `numeros-doublons.cjs` (7 rouges sur l'avant ; sans la garde du chargement ⇒
  rouge), `audit-impression-carton.cjs` (4 rouges sur l'avant). Mesuré le
  20 oct. : N°51, 52, 59, 73 en double (une paire du 14 oct., une renumérotée le
  18) — la seconde de chaque paire reçoit un numéro neuf à la prochaine
  ouverture de VRM.
  ⚠️⚠️ **22 OCTOBRE — CETTE PROMESSE N'ÉTAIT PAS TENUE : LES ANNONCES MASQUÉES
  PAR VINTED N'ÉTAIENT PAS DES PAIRES PRÉSENTES.** Mesuré (lecture seule) :
  seuls 58→91 et 70→92 avaient été réglés. Le dressing de julatace35260
  (3156028798, lu le 17/10) porte 6 annonces **`is_hidden: true`**
  (`is_closed: false`, `is_draft: false`, `item_closing_action` vide) ; sa
  lecture publique du 22/10 est complète et vide. La règle « en ligne » les
  range parmi les FERMÉES : ni « en ligne », ni « à confirmer » — donc absentes
  de `porteursNum`. Les N°**51, 52, 59, 73** (masquées, numérotées le 14/10
  15:47) restaient portés aussi par 4 paires en ligne numérotées le 18/10 08:26,
  toutes automatiques. ⇒ `<masquees-regle>` (`masqueeSurVinted`,
  `masqueesDuCompte` : prises dans les fermées rendues par `enLigneDuCompte` —
  jamais le dressing brut, une démasquée depuis est déjà « en ligne » — ; une
  suppression vue après la lecture la retire ; « pas su » n'écarte rien) et UNE
  liste `annoncesPresentes` (en ligne + à confirmer + masquées, une fois chacune)
  pour `porteursNum`, `numDoublons`, le règlement des doublons,
  `vinted_nums_physiques`, `presentesAnnonceIds`, les cartons à vérifier et à
  réécrire, et la recherche « Tout sur le N° » (état `masquee`). La règle du
  20 octobre est INCHANGÉE : à la prochaine ouverture (ventes et annonces de tous
  les comptes lues), les 4 paires en ligne du 18/10 reçoivent un numéro neuf,
  dit dans « nouveaux numéros à écrire sur tes cartons » ; les masquées gardent
  le leur. Une masquée n'est **pas** « en ligne » (totaux, grille, files
  Leboncoin/eBay inchangés). L'écran la nomme « masquée par Vinted, toujours chez
  toi ». Une entrée de cache d'annonces d'avant ce correctif est relue (elle ne
  sait pas lesquelles sont masquées). Preuves : banc `numeros-doublons.cjs`
  F/G/H (**6 rouges** sur `main` d198bca, vert après ; sous mutation —
  suppression ignorée + masquées hors du règlement — **5 rouges**) ;
  `audit-masquees-numeros.cjs` (13 contrôles, **3 rouges** sur `main`, 3
  mutations sur 3 attrapées) ; `audit-identite.cjs` lisait 2 200 caractères fixes
  de `porteursNum` et criait au loup : il lit le corps du `useMemo` (rouge si la
  règle « annulée avant l'envoi » disparaît, prouvé). **Non mesuré** : le rendu
  sur sa vraie base (aucune fixture ici) ; une masquée vendue hors Vinted fait
  renuméroter l'autre pour rien (un carton à réécrire, jamais deux paires sous
  un N°) — le geste « Elle n'est plus là » (ci-dessous) la règle. Les annonces
  « disparues » d'une lecture publique (`_vrmAbsente` : supprimées, vendues OU
  masquées après la lecture du dressing) ne sont PAS comptées : rien ne dit
  qu'elles sont masquées.
  ⚠️⚠️ **RELECTURE (22-23 octobre) — DEUX DÉFAUTS DE CE CORRECTIF, REPRODUITS,
  CORRIGÉS.** (1) Une masquée DÉCLARÉE partie (« Retirer » des annonces
  disparues, `vinted_pairs_lost`) redevenait « toujours chez toi » : `porteursNum`,
  `annoncesPresentes`, « à vérifier » et `vinted_nums_physiques` ne lisaient pas
  `pairsLost` — un numéro brûlé et un carton à réécrire pour rien (reproduit :
  N°51 masquée déclarée partie ⇒ la paire en ligne passait N°53). (2) Le geste
  « elle n'est plus là » que ce paragraphe nommait **n'existait pas** (0
  occurrence dans le build) : une masquée sans doublon, ou d'un compte sans
  annonce en ligne, n'avait aucun chemin. ⇒ Dans `<masquees-regle>` :
  `annonceDeclareePartie` (IDENTITÉ d'abord : une entrée qui porte `id` ne vise
  que cette annonce ; une entrée ANCIENNE, numéro seul, ne vaut que si AUCUNE
  autre fiche ne porte ce N° — sinon gardée présente, le sens sûr),
  `cleDeclarationPartie` (clé nue quand le N° est à elle seule, sinon `N°@id` :
  les files Leboncoin/eBay et les retours lisent `vinted_pairs_lost` PAR NUMÉRO,
  la clé nue en sortirait l'AUTRE paire, qui garde ce N°) et `masqueesPresentes`.
  `masqueesSurEtagere` (un seul endroit, §11) alimente `annoncesPresentes`,
  `porteursNum`, « à vérifier » et la recherche ; « Retirer » range désormais
  l'identifiant ; les masquées sortent de « disparues sans vente » (deux voix
  contraires sur la même paire). Le geste **« Elle n'est plus là »**, confirmé
  (il dit que l'autre paire au même N° le garde), est sur la ligne « à vérifier »,
  le bloc des doublons d'Annonces, le bloc rouge de Colis, « à écrire », et dans
  un bloc **« N paires masquées par Vinted, comptées sur ton étagère »**
  (Annonces → Stock et ajustements → Conseils & signalements ; sous « Aucune
  annonce en ligne » quand tout est masqué), qui garde aussi les déclarées
  parties avec **« Elle est encore là »** (compté parmi les signalements 7 jours
  après la déclaration, pas au-delà). Mesuré (lecture seule) :
  `vinted_pairs_lost` de Julien ne porte que des numéros B (B23…B540) — aucune
  entrée ancienne ambiguë sur 15, 39, 51, 52, 59, 73. **Tranché** : le cas
  « entrée ancienne sans identifiant + deux fiches au même N° » (le R3 du
  relecteur) garde la masquée présente et renumérote l'autre — on ne devine pas
  laquelle est partie. Preuves : `numeros-doublons.cjs` I/J/J2/K/K2/L (**20
  rouges** sur fcc80cb, tout vert après ; règle débranchée, `masqueesSurEtagere`
  = toutes les masquées ⇒ **11 rouges**) ; `audit-masquees-numeros.cjs` F/G
  (23 contrôles, 2 rouges sur fcc80cb, 6 mutations sur 6 dont `sans_identite`,
  `ancienne_sans_garde`, `cle_nue`) ; `audit-supprimees.cjs` servait une forme
  que le code ne lit plus (§6.3 : `dressingEnLigne` appelle `masqueesDuCompte`,
  absent du `vm` ⇒ l'écran rendait `[]`, 3 rouges depuis fcc80cb) — il charge le
  bloc. **Non mesuré** : le rendu sur sa vraie base ; la mutation `filelbc`
  d'`audit-supprimees` a une ancre périmée, déjà sur `main`.


### Les prix d'achat : aucun pont automatique, mesuré
**Mesuré le 7 septembre**, en cherchant s'il existait un rapprochement CERTAIN
paire ↔ achat : sur **320 paires numérotées**, seules **4** partagent le nom de
fichier photo d'un achat — il rephotographie ses paires avant de les mettre en
ligne. `panel_buyprices` est vide, `vinted_buyprice_by_num` aussi. **Il n'y a
rien à automatiser** : il les saisit, comme sa règle le dit.
- Ce qui EST juste : la modale trie **les paires vendues d'abord, au CA
  décroissant**. Mesuré : **150 des 320** portent au moins une vente reliée par
  identité (42 % des ventes se relient), et **les 20 premières couvrent 33 % du
  CA reliable**. Vingt saisies rattrapent donc un tiers des chiffres.
- ⚠️ Elle plafonnait à **300 lignes pour 320 paires** : vingt paires n'étaient
  atteignables nulle part alors que l'en-tête les comptait, et la chaîne
  « Entrée » s'arrêtait net à la 300ᵉ. Plus de plafond.
- ⚠️ **`prepAchat` : chaque achat épluché UNE fois.** Le barème comparait
  288 paires × 544 achats = **156 672 appels**, chacun ré-extrayant marque,
  taille, modèle, couleurs et titre normalisé **du même achat**. La modale
  mettait **3,5 s** à s'ouvrir — sur l'écran qu'il doit utiliser 320 fois.
  Après : **~300 ms**, et **exactement les mêmes 26 suggestions** (c'est la
  preuve qu'un jugement métier n'a pas bougé). Le barème vit dans
  `scoreAchatPrep`, qui ne doit **jamais** ré-extraire quoi que ce soit.
  ⚠️ `audit-identite.cjs` cherchait la ligne `const cs = extractColors(t)` et a
  crié au loup : **un audit doit suivre la RÈGLE, pas son orthographe**.


### ⚠️⚠️ LA LIGNE `main` PÈSE 197 Ko, ET HUIT LECTEURS LA PRENAIENT EN ENTIER
Mesuré le 15 septembre : `main` — la ligne des réglages synchronisés — fait
**197 Ko** (127 Ko de `vinted_annonce_numeros`, 25 Ko de
`vinted_sale_overrides`), et **huit** endroits la lisaient en `select=data` :
- le **panneau sur Vinted** (`buildPanelData`), à **chaque visite** ;
- les files **Leboncoin** et **eBay** du panneau, sur chaque page de ces sites ;
- l'**écran Leboncoin** de l'app ;
- la sauvegarde des numéros, `getPairPhotos`,
- et **le widget de son iPhone**, qui n'en lit que **trois clés pesant 1 Ko**.

C'est §4.4 mot pour mot (« jamais `select=data` sur une ligne lourde ») sur la
ligne la plus lue du projet — et c'est de l'**égress**, sur la route même dont le
dossier dit qu'un `select=data` avait **crevé le quota (5,7 Go)**. *La leçon
avait été apprise pour les commandes, jamais pour `main`.*
- **Mesuré, valeurs identiques** : widget **197 Ko / 1 070 ms → 1 Ko / 494 ms** ·
  écran Leboncoin **197 → 133 Ko** · panneau **197 → 161 Ko**.
- Exécuté sur la vraie base (le `vm` avant/après) : `buildPanelData` **1,5× plus
  vite**, `buildLbcData` **1,6×**, **résultat identique** dans les trois cas
  (file 40 → 40). Gagner du temps en perdant une paire serait le pire échange.
- **L'alias porte le nom de la clé** (`vinted_annonce_numeros:data->vinted_annonce_numeros`) :
  la ligne rendue se lit exactement comme avant, donc aucun appelant à renommer
  — donc aucune chance d'en oublier un.
- Un seul lecteur a le droit de tout prendre : **`cloudLoad`**, qui restaure
  toutes les clés synchronisées. C'est le **propriétaire** de la ligne (§11).
⚠️⚠️ **ET LA MOITIÉ QUI MANQUERAIT À UN CONTRÔLE POSÉ SUR LES OCTETS** : projeter
**trop peu** ne coûte rien et ne lève rien — la clé oubliée vaut `undefined`,
c'est-à-dire un compte exclu qui revient dans la file, ou une paire retirée du
stock qu'on republie, **en silence**. `audit-lectures.cjs` relit donc le corps de
chaque fonction, y cherche les clés de `main` qu'elle utilise **vraiment**, et
exige que la liste projetée les contienne toutes. **8 échecs** sur le code
d'avant, et rouge dès qu'on retire une clé d'une liste (prouvé).
⚠️ **Et ce défaut existait déjà : `vinted_pairs_lost` manquait à la file
Leboncoin du panneau.** L'app l'écartait, `buildEbayData` l'écartait — le panneau
proposait de publier une paire qu'il a déclarée **retirée du stock**. Mesuré :
**0 paire retirée aujourd'hui**, donc 0 cas réel, mais c'est le motif exact de
« l'app annonçait 39, le panneau 40 » (§11). Les trois lecteurs, une seule règle.
⚠️ **DEUXIÈME FOIS QUE MON PROPRE BANC SERT LA MAUVAISE FORME** (§6.3) :
`audit-places.cjs` rendait la ligne **brute** pour `id=eq.main`. Dès que les
files ont projeté, `main.vinted_annonce_numeros` se lisait sur un objet qui ne
l'a pas → **file vide**, et l'audit criait au loup sur un code intact. Même
piège que « 0 bordereau prêt à imprimer » sur l'écran Colis. Il projette.
⚠️ **Et deux allers-retours de plus, pour rien** : `harvest_*_billing` était lu
**deux fois** sur Ma journée (les soldes, puis les boosts) — **4 Ko**, mais
**710 ms × 2**. Ici ce n'est pas l'égress qui coûte, c'est le **voyage**.
`fetchBillingRows` partage la requête en vol (`cachedRow`).


### « J'ai déclaré ce mois » — le registre de ses déclarations URSSAF (6 octobre)
Proposition n° 13, acceptée le 5 octobre. Le passage au versement (3 octobre)
crée un risque mesuré : **30 ventes vendues en août et versées en septembre
(657,80 €)** — s'il a déclaré août à la date de vente, elles sont dans août ET
dans septembre (~89 € de cotisations payés deux fois, sans rien voir).
- `vrm_urssaf_declare` (synchronisé) = `{ [ym]: { ids, n, ca, montant, regle, at } }`,
  écrit **uniquement sur son clic** dans le rapport comptable (« J'ai déclaré ce
  mois » / « retirer »). L'app ne coche jamais « déclaré » à sa place.
- **Une vente déclarée compte dans le mois de sa déclaration, plus nulle part
  ailleurs** — par son identité `plateforme:id` (§5). Une vente d'un mois déclaré
  qui n'est dans **aucune** déclaration est « à régulariser » (comptée, dite,
  jamais cachée) ; une vente déclarée dans deux mois compte une fois et le dit ;
  le mois du versement dit ce qui est déjà déclaré ailleurs.
- Pour un mois ≤ septembre 2026, le formulaire écrit **les deux totaux côte à
  côte** (versement · date de vente, l'ancienne règle) et c'est LUI qui dit lequel
  il a déclaré ; le montant de son espace URSSAF, s'il le tape, est comparé.
- **« Pas su » ne déplace rien** : avant l'arrivée du nuage le registre vaut
  `null` (`isCloudReady` + `onCloudReady`), et l'écran le dit.
- §11 : le rapport mensuel et le bilan annuel refaisaient leur propre boucle
  Vinted — ils lisent maintenant `declarables`, comme le tableau de bord (une
  règle, un propriétaire). `audit-urssaf.cjs` suit le nom jusqu'à sa définition.
- Preuves : `audit-urssaf.cjs` **11 rouges** sur le code d'avant, **5** en
  réaffaiblissant la règle (le registre ignoré) ; banc `rapport.cjs` déroule le
  geste aux deux tailles (déclare août à la date de vente → septembre ne recompte
  plus la vente de fin août, et le dit).
- ⚠️ **À lui** : dire ce qu'il a réellement déclaré pour août et septembre — le
  geste est dans Ventes → Outils → Rapport comptable → choisir le mois.

**Revue contradictoire du 6 octobre — cinq défauts réels, tous dans ce registre**
(chacun vérifié en EXÉCUTANT le vrai code avant d'être corrigé) :
- ⚠️⚠️ **« À régulariser » ne regardait pas la RÈGLE de la déclaration.** Un mois
  noté « à la date de vente » ne retient que les ventes Vinted VENDUES ce mois-là
  (`ancienneRegle`) ; les ventes vendues le mois d'avant et versées ce mois-ci
  étaient dites « arrivées après ta déclaration — à ajouter (régularisation) ».
  Exécuté : les **30 ventes d'août versées en septembre (657,90 €)** — le cas même
  qui a motivé le registre, ~89 € payés deux fois en suivant le conseil.
  ⇒ `place()` : à la date de vente, une vente Vinted vendue un mois plus tôt
  relève de SON mois de vente (`moisVenteAvant`, dite à part : « rien à
  régulariser, note ce mois-là ») ; elle ne redevient « à régulariser » que si
  son mois de vente est noté SANS elle (elle n'est alors dans aucune déclaration).
  Et le libellé ne dit plus « arrivées après » (aucune date n'est comparée) mais
  « ne figure(nt) dans aucune de tes déclarations » — vrai dans les deux règles,
  et pour Leboncoin/eBay, que l'ancienne règle ne comptait pas.
- ⚠️⚠️ **Dates de versement illisibles ⇒ rapports à « 0,00 € · Aucune vente
  finalisée »**, présenté comme un fait, et Leboncoin/eBay (lus correctement)
  perdus avec ; le bilan annuel ne rendait pas `enCours` (« 0 € » pendant le
  simple chargement). ⇒ `declRapport` (une source pour les deux rapports) :
  `encours` · `passu` (Leboncoin et eBay comptés, « sans Vinted » dit, aucune
  cotisation ni marge chiffrée dessus — « — ») · `lu`. La publication et Ma
  journée gardent `declarables === null` (« pas su », rien de « reçu »). Les
  exports CSV/PDF emportent la mention.
- ⚠️⚠️ **« J'ai déclaré ce mois » s'enregistrait sur une lecture ratée** :
  `{ ids: [], n: 0, ca: 0 }` écrit (prouvé au banc), puis tout le mois « à
  régulariser ». `lectureIncomplete` (dates, ventes, un compte non lu hors comptes
  exclus, Leboncoin, eBay, registre) grise le bouton avec la raison **et** le
  GESTE refuse lui-même (`declarerMois`) — une lecture peut tomber formulaire
  ouvert ; il dit alors « rien n'est noté ».
- ⚠️ **« Reçu en {mois} » se jugeait au mois de DÉCLARATION** (`l.ym`) : une vente
  versée en octobre et déclarée en septembre en sortait, pendant que la barre
  « reçu » du jour la comptait — deux « reçu » sur un écran (§11). ⇒ `recuDuMois`
  (au mois du versement, la date des barres), et la phrase dessous dit « dont X €
  déjà dans ta déclaration de septembre ». La carte URSSAF du tableau de bord
  (« argent versé en octobre ») dit ce qui en est EXCLU parce que déclaré ailleurs
  (`nAilleurs`/`caAilleurs`/`ailleurs`, de la même ligne publiée) et lit
  `declare: 'pasSu'` (registre pas encore lu au calcul).
- Preuves : `audit-urssaf.cjs` **13 rouges** sur f53df91 ; bancs `rapport.cjs`
  **16 rouges** et `vendu-recu.cjs` **3 rouges** sur le build de f53df91. Et
  chaque règle réaffaiblie seule repasse au rouge (au banc ET à l'audit) :
  « absente ⇒ à régulariser » quelle que soit la règle (2 rouges au banc) · reçu
  au mois de déclaration (1) · dates illisibles non bloquantes (1 — le geste,
  lui, refuse encore : défense en profondeur) · garde du geste retirée (2, la
  déclaration vide est écrite) · rapports sans Leboncoin/eBay (3) · bilan annuel
  qui ne rend plus le chargement (1).


### ⚠️⚠️ VITESSE POUR 1 000 VENDEURS : LA COLONNE `meta` (3 octobre, 5.134)
Mesuré dans `pg_stat_statements` : les requêtes les plus coûteuses (400 à
950 ms, des milliers d'appels) lisaient UN petit champ (statut, n° de
transaction, date de capture) dans des lignes de **29 Ko** (`txn_*`) ou
**100 à 200 Ko** (`email_bord_*`, `label_*` : le PDF). Postgres décompresse la
ligne ENTIÈRE pour en sortir un champ. Et deux écrans relisaient `capturedAt`
sur **les ~5 000 lignes** `harvest_*`.
- **`app_data.meta`**, rempli par un **déclencheur** à chaque écriture
  (`vrm_meta(id, data)`) : les scalaires de premier niveau ≤ 600 car., `_pdf`
  (la ligne porte un PDF), et pour `harvest_{uid}_txn_*` les champs de la
  transaction (`id, item_id, status, status_title, status_updated_at,
  ship_status_title`). Rattrapé sur les 5 959 lignes, **0 écart** avec `data`.
- **Toute lecture d'un petit champ passe par `meta->>`** (app, extension), et
  la présence d'un PDF se teste par `meta->>_pdf=eq.true` (pas
  `data->>pdfB64=not.is.null`, qui décompresse le PDF pour rien). Mesuré :
  transactions **2 140 → 8 ms**.
- RLS : `owner = (select auth.uid())` (identité évaluée une fois, recommandation
  Supabase) + index `(owner, id text_pattern_ops)`. Migration consignée dans
  `supabase/migrations/004-meta-et-rls-rapide.sql`.
- ⚠️ L'outil SQL de la session attend une **confirmation humaine** pour tout
  `DROP` : il expire sans rien dire. Les politiques en double (`tout_*`) restent
  donc en place (mêmes droits, coût négligeable désormais).
- Les bancs servent des lignes `{id, data}` : `scripts/bancs/_meta.cjs`
  (`metaVersData`) retraduit `meta->>k` vers le chemin d'origine, avec la MÊME
  règle que le SQL. Tous les bancs et audits à faux Supabase l'appliquent.
- La cloche lisait 3 lignes par compte **à la queue leu leu** : elles partent
  ensemble (lectures de NOTRE base, pas de Vinted).


### « L'onglet Annonces est trop brouillon » (3 octobre)
Vu au rendu : huit pastilles encadrées en rang (lues comme huit choses à faire),
puis cinq blocs avant la première carte, et sur CHAQUE carte le N° et le prix
d'achat **écrits deux fois** (le texte, puis une ligne de champs de saisie).
- Les **chiffres** (en ligne, valeur, favoris, vues) sont une **ligne de texte
  neutre** (`data-ann-resume`) ; ne restent en pastilles que les **gestes**
  (sans N°, à recapturer, qui dorment, sans prix d'achat, Aide à la vente).
- Le N° et l'achat se **modifient en place** (`EnLigne` : le texte reste, un clic
  en fait un champ, Entrée enregistre, Échap annule). La ligne de saisie sous
  chaque carte est retirée ; « Marquer vendue » passe dans « ⋯ ».
- « Publier aussi ailleurs » tient sur une ligne (Leboncoin · eBay côte à côte).
- Banc `annonces-carte.cjs` : aucune saisie visible hors « ⋯ » au repos, et
  modifier « achat — » → « achat 30,00 € » pour de vrai (rouge sur l'avant).


### Numéros à lettres : B125, C123… (3 octobre, 5.137)
Demande du 2 octobre : « toutes les personnes n'utilisent pas les mêmes numéros :
des fois B125, C123 ; rends la chose adaptable ». Cartographie complète d'abord
(tout ce qui supposait un ENTIER), et trois défauts **critiques** trouvés :
- ⚠️⚠️ **un numéro à lettres n'était jamais brûlé** (`recordUsed` faisait
  `parseInt`) **et la numérotation automatique EFFAÇAIT du pool tout ce qui
  n'était pas un entier** en le réécrivant — « jamais réattribué » ne tenait pas ;
- ⚠️⚠️ **« b125 » et « B125 » étaient deux numéros** (comparaison de chaînes
  exactes) : deux paires, un carton, sans alerte ;
- ⚠️⚠️ **« VRM-B125 » se lisait « 125 »** dans l'extension (`/(\d{1,5})/`) : la
  paire N°125 — une AUTRE — sortait de la file Leboncoin comme « déjà en ligne »,
  et B125 était proposée une seconde fois.
Ce qui est en place :
- **Une identité** : `cleNum` (majuscules, sans espace ni tiret, « 007 » = « 7 »),
  la MÊME dans l'app et l'extension (`audit-numeros-lettres.cjs` compare leurs
  sorties). `NUM_OK` : des chiffres, ou 1 à 3 lettres puis des chiffres.
- **Le pool** garde un entier pour un numéro en chiffres (comme avant — tous les
  lecteurs le comprennent) et la clé texte pour un numéro à lettres
  (`entreePool`). `applyRenum` (injoignable) part désormais du pool existant.
- **La pose à la main** (`poserNumero`) juge par clé, refuse une forme invalide,
  et **demande** quand le numéro a déjà servi sans fiche (avant : repris sans un
  mot, y compris en chiffres).
- **Réglages → « Tes numéros de rangement »** : Chiffres (défaut, rien ne change)
  ou une série à lettre (B1, B2…). Ne porte que sur les **prochains** numéros
  (`prochainLibre`, `vrm_num_prefixe` synchronisé, rattrapé par `onCloudReady`).
  Avec une série, les champs N° ouvrent le clavier à lettres (`clavierNum`).
- Mesuré chez lui : **0 numéro à lettres, 0 zéro de tête** — rien ne change pour
  ses données. Extension **5.137.0**, zip régénéré, aucune entrée
  d'`EXT_CAPACITES` (l'app ne promet rien de neuf).
- Preuves sur le code d'avant : banc `numeros-lettres.cjs` **3 rouges** (B125 perdu
  du pool, « b125 » accepté sur le même carton, pas de série) ;
  `audit-numeros-lettres.cjs` **3 rouges** (« VRM-B125 » → `["125"]`).
- ⚠️ **Trouvé au passage** : trois lecteurs (Garage 3D « à ranger », la fiche
  par numéro, le sélecteur de paires à publier) testaient `Array.isArray(phys)`
  sur `vinted_nums_physiques`, publiée en `{ nums, at }` — toujours faux, donc
  le filtre « paires présentes » **n'a jamais joué** : le Garage 3D proposait de
  ranger tout l'historique. Une règle, `numsPresents()` ; l'audit refuse le motif.
- ⚠️ **Pas couvert, volontairement** : les piles du Garage 3D se numérotent en
  entiers (`pileNums`) ; une boîte seule accepte « B125 ». Les titres Vinted
  « n125 » restent lus en chiffres (c'est une suggestion, pas une identité).
  `api/email-inbound` ne lit pas « nB125 » dans un email.


### ⚠️⚠️⚠️ UNE RECONNEXION POUVAIT RENUMÉROTER SES CARTONS (3 octobre)
Trouvé en cartographiant la numérotation. Trois migrations « une seule fois »
d'août réécrivaient les numéros (`vinted_num_fix1` : purge de TOUS les numéros
auto ; `vinted_num_compact_v1` : renumérotation des annonces auto > 42 au plus
petit numéro libre, SANS regarder le pool ; `vinted_used_cleaned_v1` : pool
rétréci, déjà désactivé). Leur drapeau « déjà fait » vivait dans le
**navigateur** — et `authSignOut` efface tout `vinted_*`. Après une reconnexion
(ou sur un appareil neuf), le nuage remplissait le navigateur, l'onglet Vinted se
montait, et la migration **repartait** sur ses vraies données.
- **Prouvé** (`scripts/bancs/numeros-reconnexion.cjs`, aucune fixture) : sur le
  code d'avant, les numéros 50…54 repartaient au nuage en **1…5** — des numéros
  déjà écrits sur des cartons de paires passées. Mesuré chez lui : **401 numéros
  dont 384 auto**. Pas de dégât récent (1 seule annonce en ligne « auto ≤ 42 ») —
  c'était à une reconnexion près.
- Les trois sont **retirées**, pas « re-gardées » : leur travail est fait depuis
  août, et un numéro ne change JAMAIS tout seul (§5).
- ⚠️ **Règle** : aucune migration ne s'arme sur un drapeau du `localStorage` —
  il ne survit ni à une déconnexion ni à un autre appareil. Une migration de
  données appartient au serveur (SQL), une fois, avec une sauvegarde.
- Mesuré au passage, **laissé tel quel** : 13 numéros portés par plusieurs
  entrées (1…16), l'héritage connu d'août ; la détection de doublons de l'app
  (`conflitsNum`) les juge sur les paires PRÉSENTES.

- ⚠️⚠️ **ET ÇA S'EST PRODUIT — MESURÉ LE 8 OCTOBRE** (lecture seule, sauvegardes
  `sauvegarde.app_data_20260930` et `_20261002`) : **8 paires numérotées
  automatiquement le 29 septembre ont changé de numéro entre le 30 septembre et
  le 2 octobre**, `numberedAt` inchangé — la signature de la migration de
  compactage, avant son retrait du 3 octobre :
  543→266 · 544→267 · 545→268 (`3179807757`), 548→269 (`3170801262`),
  549→270 · 550→271 (`3171228253`), 551→276 · 552→285 (`24602614`).
  **266 à 285 étaient déjà dans le pool** : des numéros déjà écrits sur des
  cartons de paires passées. 6 des 8 sont encore en ligne ; aucune n'a de vente
  prouvée. **Rien n'a changé depuis le 2 octobre** (0 écart avec la base du
  8 octobre). ⇒ **Geste de Julien** : regarder le carton de ces 6 paires ; s'il
  porte 543…552, remettre ce numéro dans le champ N° (l'app demande une
  confirmation, le numéro étant déjà au pool). **Ne pas corriger sa base à sa
  place** : seul le carton dit quel numéro est le vrai.

### ⚠️⚠️⚠️ Anciens numéros en B — la remise à zéro (migration 013, 9-11 octobre)
Julien, 9 octobre : « tous les anciens numéros, tu les fais commencer par B1,
B2… on commence à partir de zéro à partir du moment où je recommence à
reposter ». 10 octobre : « j'ai tout supprimé et je reposte, regarde par
rapport à la DATE DE MISE EN LIGNE », puis : « les anciens c'est que les paires
vendues, car je vais tout republier — c'est pour ça que je veux de nouveaux
numéros ». **Ce sont SES décisions, pas des options à reproposer.**
- **La règle** : une annonce mise en ligne APRÈS la coupure T est NOUVELLE et
  reçoit 1, 2, 3… dans l'ordre de mise en ligne — même si c'est physiquement une
  paire qui avait un numéro (il réétiquette le carton). Tout le reste passe en
  « B + l'ancien » et ne sert plus qu'à l'HISTOIRE (ventes, compta, bordereaux,
  fiches des paires supprimées). **Un ancien numéro ne se redonne JAMAIS** — ni
  « B230 », ni « 230 » : ni par une vente, ni par une photo ou un dossier de
  photo, ni par la bannière ♻️, ni à la main.
- **La date de mise en ligne**, dans l'ordre (la migration ET l'app,
  `dateMiseEnLigneMs`, §11) : `created_at_ts` du dressing, l'heure de dépôt de
  la photo (`photo.high_resolution.timestamp`), `vinted_listing_dates`, puis
  (migration seulement) `numberedAt`. Une fiche numérotée avant T ne devient
  jamais nouvelle sur une date contraire (`contradictions`, compté).
- **La migration** (`supabase/migrations/013-anciens-numeros-en-b.sql`) ne
  convertit RIEN à l'installation. L'appel est à part : MESURE
  (`vrm_numerotation_mesurer`) → ESSAI ANNULÉ (`node
  scripts/renum-b/essai-annule.cjs --coupure=… > essai.sql`, qui rend le plan :
  chaque annonce jugée nouvelle avec sa date, sa source et si une capture la
  montre en ligne) → APPLICATION (`vrm_numerotation_archiver`, avec la mesure)
  → `vrm_numerotation_rattraper`. Retour arrière ciblé :
  `vrm_numerotation_annuler`, refusé dès qu'un numéro a bougé depuis.
  ⚠️ **Le choix de T** : une annonce mise en ligne après T puis supprimée
  prendrait quand même un numéro neuf — le plan le signale
  (`nouvellesPasEnLigne`). À regarder avant d'appliquer.
- **Le marqueur** `main.vrm_numerotation` = `{version, coupure, appliqueLe,
  archive, renum, lbcAnnonces, ebayAnnonces, annule?}` n'est écrit QUE par le
  serveur : le garde-fou de la base le recopie depuis la ligne d'avant, quoi
  qu'envoie un navigateur. `renum` = {numéro provisoire → nouveau} (les 553+
  donnés avant la migration) : un appareil qui réécrirait « 553 » sur une fiche
  devenue « 1 » est refusé (`vrm_numeros_perimes`).
- **Les garde-fous de la base** (écritures `authenticated`/`anon` seulement) :
  `vrm_pool_retreci` (le pool ne rétrécit jamais, même avant la coupure),
  `vrm_numeros_perimes` (B230 qui redevient 230, une clé B385 qui redevient
  385, le numéro provisoire qui revient), `vrm_fiche_perdue` (une fiche
  numérotée qui disparaît sans `repriseDe`), `vrm_garage_perime` (garage sans la
  version), `vrm_prefixe_archive` (« B » comme lettre des nouveaux numéros).
  Une saisie à la main datée d'après la conversion (`manuelAt`) passe.
- **L'app** lit le marqueur (`archiveNumeros`, `coupureNumerotation`,
  `versionNumerotation`) : la version est relue toutes les 60 s et au retour au
  premier plan ; la numérotation automatique n'agit que sur une version relue
  depuis moins de 3 min (`numerotationPermise`). Un refus nommé de la base, ou
  une version qui a changé, couvre l'écran (`BlocNumerosPerimes`) : « Recharger »
  met de côté ce qui a été tapé (prix d'achat, colis cochés…) et le rejoue par
  IDENTIFIANT après le rechargement — jamais les numéros.
- **Un « 230 » écrit AVANT la coupure désigne l'ANCIENNE paire** : le SKU d'une
  annonce eBay ou la référence d'une annonce Leboncoin qui le portaient à la
  coupure, une commande eBay passée avant T. Sans ça, la vente Vinted de la
  NOUVELLE 230 faisait retirer d'eBay l'annonce de l'ancienne (`numeroExterne`,
  la même règle dans l'app, `api/_lib/numerotation.js` et l'extension pour
  Leboncoin, `numeroLbcLu`). Le retrait eBay automatique relit le marqueur chez
  le serveur ; illisible ⇒ rien.
  ⚠️ Le marqueur garde, PAR ANNONCE, chaque numéro qu'elle portait à la coupure
  ET ce qu'il devient : `ebayAnnonces = { "<itemId>": { "553": "1", "12": "B12" } }`
  (même forme pour `lbcAnnonces`). Un numéro donné APRÈS T (provisoire, dans
  `renum`) suit SA paire ; un numéro donné à plusieurs paires nouvelles rend
  `''` (personne). Et on ne traduit que si l'annonce porte ENCORE ce numéro :
  un SKU réécrit après T (« Relier à une paire ») se lit tel quel.
- **Les emails** : après la conversion, le « nXXX » d'un TITRE n'est retenu que
  s'il désigne une fiche actuelle de la nouvelle série AU MÊME TITRE ; sinon il
  part dans `numeroTitre` (jamais tamponné). Le repli par titre ne rend jamais
  un numéro d'archive (`numeroDEmail`, serveur ; `numeroEmailAdmis`, app).
- Preuves : `audit-renum-b.cjs` (la migration EXÉCUTÉE sur un Postgres jetable,
  ~5 min, et l'essai annulé qui ne laisse rien) ; `audit-numerotation-lecteurs.cjs`
  (les règles de l'app, du serveur et de l'extension exécutées, 18 mutations) ;
  `audit-ebay-route.cjs` (le retrait automatique : 3 rouges sur le code d'avant).
- **Relecture du 11 octobre — seize défauts reproduits, corrigés** (chacun rouge
  sur d8c688b, vert après, rouge sous mutation) :
  - ⚠️⚠️ **le RETOUR ARRIÈRE était refusé sur SA forme réelle** : il n'a pas de
    ligne `ebay_brouillons` ; une ligne absente (NULL SQL) comparée au `null`
    JSON rangé par la conversion valait « des numéros ont bougé ».
    `vrm_proj_aucun` ramène absent / `null` / `[]` à une seule forme. Rejoué sur
    la PROJECTION de sa base (lecture seule du 11 octobre, Postgres 16 jetable) :
    avant « REFUSÉ (ebay_brouillons) », après il passe et `main`, emails et
    garage reviennent exactement.
  - ⚠️⚠️ **ses DEUX annonces eBay étaient lues « B553 » et « B559 »** (numéros
    provisoires du 10 octobre, devenus 1 et 7) : plus aucune paire, l'anti
    double vente coupé. Le marqueur par annonce (ci-dessus) les rend à 1 et 7,
    sur sa projection. « Relier » une annonce d'avant au MÊME chiffre est
    refusé (409 `numero-ambigu` : rien ne distinguerait plus la B22 de la 22) ;
    `publish`/`programmer` lisent le marqueur et refusent un écran d'une autre
    version de numérotation (409 `numerotation-perimee`, l'app envoie la sienne).
  - **3 ventes d'après T (564/565/568) n'avaient que leur BORDEREAU capté** :
    `harvest_{uid}_label_{tx}` (`meta.tx` → `meta.item`, la copie `label_latest`
    écartée, un `meta.tx` qui contredit sa ligne aussi) relie maintenant comme la
    transaction : sur sa projection 564/565/568 → **1/12/13**, comme leurs
    voisines. ⚠️ **À faire confirmer par Julien** : ces trois numéros étaient
    `autoShip` (tamponnés sur le bordereau expédié). Toutes les ventes d'après T
    suivent désormais leur paire — pas un mélange selon ce qui a été capté.
  - **Une ANCIENNE annonce encore en ligne vendue après T** recevait un numéro
    NEUF (la photo ET l'identité étaient jetées) : seule la photo l'est, Vinted
    (transaction → annonce) dit la paire, la vente garde « B7 ».
  - La mesure nomme les **comptes dont le dressing date d'avant T** (`dressings`,
    et `attention` dans l'essai) : le plan n'y voit aucune annonce republiée.
    Mesuré le 11 octobre à 12:15 : les 7 comptes recaptés, tomj683 et arthuror2
    compris.
  - Le rattrapage épargne un chiffre porté par une fiche ACTUELLE au même titre
    (la règle `numeroDuTitreApresCoupure`) ; le plan n'est calculé qu'UNE fois
    (`main` verrouillée ~6 s sur sa projection : **l'essai et l'application se
    lancent VRM fermé partout**).
  - App : « Retape son numéro » / « garde le N°B… » / ⧉ ne s'affichent plus à
    côté d'un numéro d'archive (« numéro neuf »), et la paire revenue sort de la
    liste quand elle est republiée (identité ou photo) ; Réglages n'enregistre
    plus de lettre au clic sur « Avec une lettre » et ne propose plus « B125 » ;
    le bloc relit la version au refus (« remise à zéro », jamais « un autre
    appareil » au hasard) ; une sauvegarde d'avant la remise à zéro est refusée
    AVANT d'écrire, avec la vraie cause ; effacer un N° garde la fiche ; les
    gestes d'un écran périmé se rejouent en DIFFÉRENCE (un colis décoché ailleurs
    ne redevient pas « posté »).
  - Preuves : `audit-renum-b.cjs` (126) et ses mutations ; `audit-numerotation-
    lecteurs.cjs` (38/38 mutations) ; `audit-ebay-route.cjs` (10 rouges sur
    d8c688b) ; banc `numeros-remise-a-zero.cjs` sections E-F-G (9 rouges sur le
    build de d8c688b) ; et un banc de rendu sur la projection de sa base convertie
    par la vraie migration (hors dépôt : vraies données), 18 rouges avant, 0 après.
- ⚠️ **Non mesuré** : la migration n'a JAMAIS tourné sur sa vraie base (données
  inventées à la forme des siennes). Une annonce republiée SANS date lisible ne
  se numérote pas toute seule (elle reste « sans N° »). Le « nXXX » d'un titre
  Vinted republié reste lu tel quel par la file Leboncoin de l'extension
  (`vintedKeys`) : ancien ou nouveau numéro, VRM ne peut pas le savoir.

- **Fusion du 11 octobre (après-midi)** : la numérotation corrigée (99fd0a7 : retour
  arrière sans `ebay_brouillons`, annonces eBay/LBC publiées après T sous un N°
  provisoire traduites par annonce, ventes d'après T reliées par leur bordereau
  capté, dressings figés signalés, rattrapage, fiche vidée gardée, plan calculé une
  fois, ancienne annonce vendue après T qui garde son B, `api/ebay` qui lit le
  marqueur) arrive sur une production où la **5.167.0** est déjà publiée : son code
  d'extension change (`numeroLbcLu`), donc **5.168.0**, zip régénéré,
  `EXT_ATTENDUE` suivie. Une version publiée ne change jamais de contenu.
  **Tranché à la place de Julien (il ne veut plus de questions)** : les ventes
  d'après T suivent leur paire (564/565/568 → 1/12/13, B564/B565/B568 restent au
  pool) ; relier une ancienne annonce eBay au nouveau numéro du même chiffre reste
  refusé (409 `numero-ambigu` : terminer et republier) ; une sauvegarde faite avant
  la remise à zéro ne se restaure plus.

- ✅ **APPLIQUÉE EN PRODUCTION LE 11 OCTOBRE À 14:58:07 UTC** (T = 2026-10-09T00:00:00Z,
  marqueur version 2). Ordre suivi : déploiement du serveur et de l'app qui
  lisent le marqueur (PR #472) → mesure (7 dressings relus le jour même, aucun
  avant T ; 24 nouvelles, toutes datées par la photo ; 0 contradiction ; les 6
  « pas en ligne » = 6 ventes) → essai ANNULÉ sur sa vraie base (7,2 s, rien
  restant, vérifié) → application en UNE transaction : mesure refaite, refus si
  l'empreinte md5 du plan diffère de celle de l'essai, conversion, garde-fous
  posés dans la même transaction → rattrapage (0 email). Résultat : pool
  558 B + 1…24 ; fiches 401 B + 24 ; ventes 503 B + 6 (1, 7, 9, 14, 16, 17 :
  nouvelles déjà vendues) ; eBay 128127336988 {553→1}, 128086452103 {559→10} ;
  ventes 571/572/573 sans identité → B571/B572/B573 (vendues, historique).
  ⚠️ **Comment c'est passé** : l'outil SQL ne prend pas de fichier, et 92 Ko d'un
  bloc ne passent pas. Les fonctions (sections 1 à 6, sans effet tant qu'on ne les
  appelle pas) ont été installées en 6 morceaux d'instructions entières
  (commentaires hors corps retirés), puis **chaque corps comparé par md5(prosrc)**
  à celui du fichier : 28/28 identiques. Les deux `drop trigger if exists` ont été
  retirés (déclencheurs absents, et un DROP attend une confirmation humaine dans
  l'outil). Retour arrière : `sauvegarde.vrm_numerotation_annuler(owner)` (125
  copies prises), refusé dès qu'un numéro a bougé.


### ⚠️⚠️ La ligne `main` ne s'enregistrait plus depuis la 013 — migration 017 (18 octobre)
Mesuré (journaux Postgres, lecture seule) : depuis le 11 octobre 14:58, CHAQUE
écriture de `main` par un navigateur était annulée à 8 s (57014) dans
`vrm_garde_numeros()` — jointure `jsonb_each … join jsonb_each` où le filtre du
côté nouveau (`vrm_cle_num`, non inlinable) était rejoué ~450 × 509 fois. Les
fiches N°25+, prix d'achat et réglages ne vivaient que dans ses navigateurs
(cause probable du 80/81 et de la file Leboncoin plus courte qu'eBay).
`017-garde-numeros-rapide.sql` : même règle, mêmes refus, mêmes messages ;
chaque côté calculé une fois (CTE matérialisées). **Appliquée en production le
18 octobre** (corps md5 identique au fichier ; celui d'avant était identique à
la 013). `audit-garde-numeros-rapide.cjs` (Postgres jetable, volume mesuré,
données inventées) : 8 cas, mêmes verdicts que la 013, 0,2 s au lieu de 6,5 s.
⚠️ Julien ne doit ni se déconnecter ni vider ses données de navigateur tant que
chaque appareil n'a pas réécrit `main` (la première ouverture le fait).


### ⚠️⚠️⚠️ La panne de synchro a RENUMÉROTÉ 36 paires — le chargement fusionne désormais (18 octobre)
Mesuré (lecture seule, `sauvegarde.journal_ecritures`, fiches de `main`) : aucune
écriture de `main` n'a réussi du 11 oct. 14:58 au 18 oct. 08:26 (017). Pendant ce
temps, **chaque ouverture de l'app recopiait le nuage par-dessus le navigateur**
(`SYNC_KEYS.forEach → localStorage.setItem`) : les numéros donnés sur l'appareil
depuis le 11 disparaissaient, la numérotation automatique en redonnait — y compris
des numéros déjà écrits sur des cartons (le pool du nuage ne les connaissait pas).
Le 18 à 08:26:45, le Mac a renuméroté **36 paires (N°49 à 84)** d'un coup. Preuves
par identité : la Vapor Pro (annonce 10389789504) a reçu le N°82 de l'Air Max 1
noire en ligne sur eBay sous VRM-82 ; eBay VRM-81 / VRM-48 sont aujourd'hui 80 / 53.
- **Le chargement FUSIONNE** `vinted_used_numeros` (union, toujours sûre) et
  `vinted_annonce_numeros` (fiche de l'appareil inconnue du nuage gardée, numéro de
  l'appareil comblant une fiche du nuage sans numéro ; le nuage gagne si les deux en
  ont un ; `repriseDe` respecté), seulement à version de numérotation égale
  (`fusionNumerosAuChargement`), puis repousse.
- **`prochainLibre` part du plus haut**, jamais d'un trou : un trou peut être un
  numéro perdu du pool mais écrit sur un carton.
- **« N numéros à vérifier sur tes cartons »** (Annonces, `data-numeros-a-verifier`) :
  les fiches auto numérotées pendant la fenêtre `PANNE_NUMEROS`, preuve eBay par
  identité (brouillon `pairId` → annonce → SKU), « Le carton dit N°X » ou corriger
  (vers le N° d'une autre paire de la liste : elle prend un numéro neuf et reste à
  vérifier ; sinon le geste `poserNumero`). `cartonVerifie` sur la fiche.
- Banc `numeros-panne.cjs` : 6 rouges sur l'avant (« 1002 → 11 »), vert après.
- **Geste de Julien** : passer la liste carton par carton ; n'imprimer aucun bordereau
  de ces paires avant. Les numéros 25 à 48 de la semaine ne sont plus nulle part en
  base : seul le carton les dit.
- **Impression gardée (18 oct.)** : tamponner un bordereau dont le N° est encore « à vérifier sur son carton » (`ficheAVerifier`) DEMANDE d'abord — `confirmerNumerosAVerifier`, sur les trois chemins (un bordereau, un lot, bordereau + facture) ; « Annuler » n'imprime rien. `audit-impression-carton.cjs` (rouge sur l'avant).
- **Mémoire de défilement (18 oct.)** : `MemoireDefilement` observait le premier enfant de la zone (un bandeau de 74 px) et s'arrêtait au premier succès — l'écran qui se raccourcit le temps d'un chargement ramenait la position à 0. Elle se tient 2,5 s, réessayée à chaque image, et cède dès que la personne fait défiler (molette, doigt, clavier, clic). Banc `revendeurs.cjs` (rouge sur l'avant : 250 → 0).
- La ligne « Ventes Vinted à jour / capture ancienne » sort du résumé Vinted replié sur téléphone (une alerte cachée n'en est pas une).


### Le numéro VRM sur Vinted : à côté de « Publier », sur l'annonce, dans les ventes (20 octobre, 5.201)
Julien : « quand on publie sur Vinted je veux que le numéro soit écrit à côté du
bouton Publier, et après, sur Vinted, qu'il y ait le numéro dessus ; pareil dans
les ventes ». Rien ne clique et rien ne part chez Vinted : on pose une étiquette
dans la page (`vinted-capture.js`), et le fond lit et écrit NOTRE base.
- **Page de dépôt** (`/items/new`) : le fond RÉSERVE le prochain numéro jamais
  servi (`prochainNumeroDe` : après le plus haut du pool, des fiches et des ventes
  corrigées ; série à lettre respectée) dans `panel_num_reserves.attente` AVANT de
  l'afficher, une réservation par onglet (3 h). Base illisible ou écriture ratée
  ⇒ aucun numéro montré (« VRM n'a pas pu réserver de numéro »).
- **Publication** : `inject.js` lit l'identifiant de l'annonce dans la réponse 2xx
  de `POST /api/v2/item_upload/items` (chemin vu dans ses `seen_urls`) ; le fond
  LIE la réservation de l'onglet à CETTE annonce (`items[itemId]`) ; une écriture
  ratée est gardée et liée au geste suivant.
- **L'app** (`numerosReserves`, même règle que l'extension) : l'annonce publiée
  prend le numéro réservé (s'il n'est pas déjà sur une autre fiche), aucune autre
  paire ne prend un numéro réservé, et réservations illisibles ⇒ une annonce neuve
  attend (pas de numéro deviné).
- **Sur les pages Vinted** : étiquette « N°x » sur les liens d'annonce (dressing),
  de conversation et de transaction (ventes, « Commande traitée »), et à côté du
  titre d'une annonce — uniquement par identité (fiche, transaction → annonce,
  vente corrigée, conversation → transaction). Inconnu ⇒ rien. Les ACHATS n'ont
  pas de numéro VRM : rien n'y est affiché.
- Preuves : `audit-numero-vinted.cjs` (vrai `background.js` + vrai `inject.js` +
  règle de l'app, 20 contrôles, 4 rouges sur l'avant) ; banc `numero-vinted.cjs`
  (vrai `vinted-capture.js` dans une fausse page Vinted, 390 et 1512 px, et l'app
  qui donne le numéro réservé, 15 rouges sur l'avant).
- ⚠️ **Non mesuré** : le DOM réel de Vinted (403 d'ici) — le libellé du bouton
  (« Ajouter » / « Publier » cherchés), la forme exacte de la réponse de création
  (`item.id` ou `id` lus ; une autre forme note `publication_forme_inconnue` et ne
  lie rien), et les liens des pages de ventes. Si l'étiquette n'apparaît pas à
  côté du bouton, elle se pose en bas à gauche de l'écran.
- **Geste de Julien** : installer la 5.201, puis publier une annonce et regarder
  à côté du bouton.


### « Vendu » et « reçu » : deux notions, deux mots (n° 20, 4 octobre)
Julien, 3 octobre : « il y a les ventes que l'on fait en une journée et
l'argent que l'on reçoit — je veux un graphique avec les ventes de la journée ».
Le héros de Ma journée écrivait « **Chiffre d'affaires** » sur les ventes FAITES
(en cours comprises, Vinted seul, `liveStats` figé au montage) — le mot du CA
déclaré, qui est l'argent reçu.
- **VENDU** = `ventesFaites` : date de VENTE, toutes plateformes, en cours
  comprises, hors annulées et hors ventes/comptes cachés (`isHidden`).
  Leboncoin sans `dateVente` n'est dans aucun jour (`sansDate`). Propriétaire
  dans l'écran : `vendus` → `bilanVentes` (« Vendu aujourd'hui », « Vendu en
  {mois} ») et la colonne VENDU du graphique — une seule liste.
- **REÇU** = `ventesDeclarables` (le CA déclaré, date de VERSEMENT). Le memo
  `declarables` est partagé par la publication `vinted_urssaf_mois` ET l'écran :
  « Reçu en {mois} » est le même nombre que la carte URSSAF du tableau de bord.
- Carte **« Tes 14 derniers jours »** (`BarresVenduRecu`, qui remplace
  `MiniBarres` jamais rendue) : deux barres par jour, VENDU à l'accent, REÇU à
  l'encre neutre, même échelle. Versements illisibles ⇒ **aucune** barre
  « reçu », jamais des zéros ; une vente finalisée sans date de versement est
  dite une fois sous le graphique.
- « Vendu aujourd'hui » dit des **ventes**, plus des « paires » (un lot vaut 1).
- Statistiques : « CA du mois » → « **Vendu ce mois** » (même chiffre, bon mot).
- Banc `vendu-recu.cjs` (ventes inventées, 30 contrôles, juge les `data-*`).
  Réaffaibli (annulée comptée + reçu daté à la vente) → **11 rouges**.
- ✅ **Fermé le 4 octobre** : `liveStats` (Statistiques « Aujourd'hui », « Vendu
  ce mois », la courbe des mois, la jauge d'objectif, le widget `caMois`) était
  un SECOND calcul du vendu — Vinted seul, comptes bloqués exclus, Leboncoin et
  eBay oubliés. Mesuré au banc sur le code d'avant : « Aujourd'hui » **50 €** au
  lieu de **90 €**, « Vendu ce mois » **175 €** au lieu de **275 €**, et le
  widget pareil. ⇒ La coque relit les ventes de TOUS les comptes liés (même
  lecture, `_acc` posé) et `liveStatsVus` passe par **`ventesFaites` puis
  `resumeVendu`** — la même règle que Ma journée ; un compte s'écarte par
  `compteEcarte` (masqué dans l'app ou éteint dans l'ancien panneau, une seule
  définition pour la compta et la coque). Le widget n'écrit plus depuis l'effet
  de lecture : il publie `widgetBase` + le vendu unifié, et seulement quand
  le JSON change. Ventes illisibles ⇒ on garde l'ancien calcul (« rien lu » ne
  vaut pas « rien »). Banc `vendu-recu.cjs` : **36 contrôles**, et **4 rouges**
  sur le code d'avant **instrumenté des mêmes attributs** (« la fonction
  n'existait pas » n'aurait rien prouvé).


### La page d'accueil publique (n° 22, 4 octobre)
Julien : « une vraie page d'accueil… qui donne envie… avant d'arriver sur la
connexion », avec une vidéo en motion design, inspirée de Vinteer.
- `src/Accueil.jsx`, rendue par `main.jsx` (`Racine`) **seulement sans
  session** ; l'app (`App.jsx`, ~340 Ko gzip) est un morceau à part, chargé au
  clic et préchargé au survol des boutons. Une session, `?code=`,
  `#access_token=`, `?tab=`, `?connexion`, `?inscription` ⇒ droit dans l'app,
  **sans éclair** de page d'accueil. « Créer mon compte » ouvre le formulaire
  d'inscription (`?inscription`), et l'écran de connexion a « ← Découvrir VRM ».
- La démo est une **fonction pure du temps** (6 scènes × 4,2 s, dessinée en
  720×470, ou 420×500 sous 560 px de large), arrêtée hors écran, immobile avec
  « réduire les animations ». ⚠️ Le temps suit l'**horloge**, pas le nombre
  d'images : bornée à 0,05 s par pas, elle tournait à moitié vitesse à 9 images/s
  (mesuré en rendu logiciel à 1512 px).
- ⚠️ `overflow-x:hidden` sur la racine empêchait la barre du haut de rester
  collée : `overflow-x:clip` (repli `hidden` si non supporté).
- **Honnêteté** : le prix « gratuit » vient des CGV, « aucune donnée revendue »
  de la politique de confidentialité, aucun chiffre de clientèle ni étoile —
  le banc `accueil.cjs` (36 contrôles) le vérifie.
- **La vidéo** : `?film` rend l'animation seule ; `scripts/film-accueil.cjs`
  l'exporte image par image en MP4 (1920×1080 et 1080×1920, 25,2 s, ~1 Mo).
  Les MP4 ne montent pas dans le dépôt : ils se régénèrent après chaque
  changement de la démo (`npm run build` puis le script).


### Double vérification de connexion (TOTP, 16 octobre)
Retenue par Julien le 11 octobre (n° 17). **Facultative** : Réglages → Mon
compte → Connexion → « Double vérification ». Rien ne change pour qui ne
l'active pas.
- **L'API MFA native de GoTrue, à la main** (comme le reste de l'auth, aucune
  bibliothèque) : `POST /factors` (totp) → QR (`data:image/svg+xml`, affiché en
  `<img>`, jamais en HTML) + clé à recopier ; `challenge` + `verify` (rend des
  jetons `aal2`) ; `DELETE /factors/{id}` ; `GET /user` (porte `factors`).
  Helpers : `totpVerifies`, `aalDuJeton`, `etatMfa`, `mfaPasse`, `mfaAppel`,
  `mfaVerifierCode`, `mfaLireFacteurs`.
- **La session porte `totp`** (les facteurs TOTP VÉRIFIÉS), lu dans le `user` de
  chaque réponse de jeton (mot de passe, renouvellement, PKCE, lien email par
  `fetchMe`). `etatMfa` : `aal2` ⇒ entrer · `totp` non vide ⇒ le code · `[]` ⇒
  entrer · absent (session rangée avant cette fonction) ⇒ on relit `/user`.
- **La porte vit dans `App`, AVANT le cœur** (`PorteMfa`) : tant que le code
  n'est pas passé, `AppCoeur` ne monte pas, aucune lecture au nom du vendeur ;
  ni l'extension (`assurerSessionExtension`), ni le relais du téléphone
  (`relaisUtile`), ni l'abonnement aux notifications (`main.jsx`) ne partent.
  Vaut pour une session restaurée au rechargement.
- **« Activée » ne s'écrit qu'après un premier code juste.** Désactiver :
  confirmation + code (la session repasse en `aal2`, ce que GoTrue exige pour
  supprimer un facteur vérifié).
- **Personne enfermé dehors** : GoTrue injoignable ⇒ « le service de connexion
  ne répond pas », « Réessayer » (et nouvel essai seul toutes les 15 s quand on
  ne sait pas s'il faut un code) ; jamais de déconnexion automatique. Téléphone
  perdu : l'écran dit que ça ne se retire pas d'ici et donne l'adresse de
  contact (`src/contact.js` — vide aujourd'hui ⇒ « adresse de contact à venir »).
  Aucune procédure inventée.
- **L'extension** : sa session (`/api/compte?mode=session-extension`, lien
  magique) est en `aal1`, et c'est sans effet sur ce qu'elle fait — RLS ne
  regarde pas `aal`. Elle n'est simplement plus fabriquée avant le code.
  Extension NON modifiée, pas de bump.
- ⚠️ **Limite à connaître** : la double vérification protège l'APP (l'écran),
  pas l'API. Une session `aal1` (mot de passe seul) lit encore la base en
  direct : RLS n'exige pas `aal2`. L'exiger (règle restrictive `aal = aal2`
  quand un facteur existe) couperait l'extension, dont la session est `aal1`.
  À trancher plus tard, avec une session extension en `aal2`.
- Preuves : banc `bancs/double-verification.cjs` (port 4981, faux GoTrue à la
  forme documentée, 390 tactile + 1512 px) — sans MFA comme avant (connexion et
  session d'avant), activation (QR, clé, code faux refusé, « activée » après),
  désactivation (code faux, DELETE en `aal2`), connexion protégée (zéro lecture
  au nom du vendeur avant le code, rechargement compris, code faux refusé),
  GoTrue injoignable (ni « activée », ni déconnexion). **63 contrôles** ; sur le
  build d'avant (§6.1, banc copié dans l'arbre de 0969738) **20 rouges** — les 8
  verts sont les cas « sans double vérification », comme attendu. Le banc ne
  compte que les lectures faites AVEC le jeton du vendeur (les sondes anonymes
  de l'écran de connexion ne lisent rien de lui). `audit-photos-vinted` admet
  le `<img>` du QR (source fermée : `qrEnSrc`). ⚠️ `demarrage.cjs` sort 1 rouge
  (« une vraie nouvelle vente est annoncée ») — **déjà rouge sur 0969738**, sans
  lien avec cette passe.
- **Non mesuré** : le vrai GoTrue de production (formes tirées de la doc
  Supabase) ; que TOTP soit activé dans le projet (Authentication → MFA —
  **geste de Julien : vérifier**, rien n'a été écrit en production) ; « mot de
  passe oublié » sur un compte protégé (`PUT /user` en `aal1` : GoTrue peut le
  refuser, l'erreur est affichée, puis le code est demandé) ; un compte qui
  active la double vérification sur un appareil voit ses AUTRES sessions `aal1`
  demander le code au renouvellement suivant de leur jeton (≤ 1 h).

---


### Studio photo : cadre guide + détourage DANS le navigateur (fonction n°33, 17 octobre)
Retenue le 11 octobre (« studio photo + détourage »), sous §2.9 : rien de payant
sur la clé de Julien. Annonces → « ⋯ Outils » → **Studio photo**
(`src/StudioPhoto.jsx`, `src/studioPhoto.js`, chargés au clic par `React.lazy`).
- **Le cadre** : on choisit une paire PRÉSENTE (la liste de l'inventaire
  physique, `porteursNum` — jamais un numéro tapé), la caméra s'ouvre
  (`getUserMedia`, caméra arrière) dans une zone 3:4 avec un gabarit SVG (bord,
  ligne de sol, axe). La photo prise est exactement ce que montre le cadre,
  rangée dans `studio_photos_{N°}` (une ligne par paire, 12 photos au plus,
  lire-fusionner-réécrire GARDÉ : une lecture ratée n'écrit rien et le dit).
  Caméra refusée ou absente ⇒ la phrase le dit et le champ fichier
  (`capture=environment`) prend le relais, recadré au même format.
- **VRM ne publie rien sur Vinted** : « Enregistrer » télécharge la photo, il
  l'ajoute lui-même dans l'app Vinted (l'écran le dit).
- **Le détourage, local, sans clé, sans envoi** : modèle **U²-Netp**
  (`public/modeles/u2netp.onnx`, 4,6 Mo, servi par VRM, chargé au clic).
  ⚠️ **LICENCES vérifiées à la source le 16 octobre** : U²-Net = **Apache 2.0**
  (fichier LICENSE de github.com/xuebinqin/U-2-Net) ; conversion ONNX de rembg =
  **MIT** (sha256 `309c8469…`) ; moteur **onnxruntime-web 1.22.0 = MIT**, chargé
  depuis cdn.jsdelivr.net au clic. Notices dans `public/modeles/LICENCES-u2netp.txt`.
  **Écartés** : `@imgly/background-removal` (AGPL), RMBG-1.4 (non commercial),
  le paquet npm `@rmbg/model-u2netp` (aucune licence déclarée). L'originale est
  TOUJOURS gardée à côté de la détourée ; aucune route ajoutée (12 fonctions).
- **Décision** : le chemin Photoroom existant (`api/_lib/detourage.js`,
  `PHOTOROOM_POUR`) n'est pas touché ; la clé PAR VENDEUR (modèle Super PDP)
  n'a pas été écrite, le détourage local la rend non nécessaire pour ce studio.
  Extension non touchée.
- **Preuves** : banc `scripts/bancs/studio-photo.cjs` (port 4991, données
  inventées, fausse caméra Chromium, 390 tactile et 1512) — **55 contrôles** :
  cadre par-dessus la caméra, photo rangée pour la BONNE paire et au format
  3:4, détourée avec transparence (≈ 75 % transparent / 23 % opaque sur
  l'image de la fausse caméra), aucune requête payante (Photoroom, POST
  `/api/ai`, `mode=detourage`), rien du moteur avant le clic, seul hôte
  extérieur cdn.jsdelivr.net, caméra refusée ⇒ repli + phrase, lecture KO ⇒
  rien écrit. **Rouge sur le build d'avant** (le studio n'existe pas, 2 KO) ;
  deux mutations (alpha forcé à 255, lecture ratée lue « vide ») ⇒ **4 rouges**.
  Le moteur est servi au banc depuis une copie locale (`BANC_ORT_DIR`, sinon
  téléchargé une fois par curl dans le dossier temporaire).
- **Non mesuré** : la QUALITÉ sur de vraies chaussures (aucune photo réelle
  joignable d'ici — u2netp est léger, bords doux : l'écran demande de vérifier) ;
  Safari iOS réel (getUserMedia en PWA, encodage WebP — repli PNG prévu) ; le
  temps de calcul sur un vrai téléphone (≈ 16 Mo téléchargés au premier
  détourage) ; le poids des lignes `studio_photos_*` dans la sauvegarde
  complète (elles y entrent, comme toute donnée captée).


### Stock, finitions (chantier 11, 17 octobre) — la pile ne « décolle » plus, deux modes, ranger d'un geste
Julien : « cet onglet doit être revu intégralement » (pile qui décolle, hauteur des étagères, rangement plus simple, refonte).
- **La pile** : retirer le carton du bas ne fait descendre que SA colonne d'un cran (`retirerDePile`, local à la colonne ; avant, la liste entière se décalait et « tout décollait »), sans rebond ; `ajouterAPile`, `cartonsDePile`, `prochainePlaceMeuble` (la plus BASSE place libre d'abord) dans `src/stockRegles.js`.
- **Réglages d'un meuble** (mode Aménager) : nombre de niveaux, hauteur d'un niveau (`changerNiveau` : refusé au-delà du plafond, ou si une boîte déjà rangée ne tient plus — dit, un seul toast : un même message ne s'empile plus), largeur, profondeur. Étagère à bacs (1 par case), cintres de face.
- **Deux modes** (`data-mode-stock`) : **Ranger** (défaut ; aucun réglage à l'écran) et **Aménager** (le dépliant et les réglages). Une pièce VIDE s'ouvre en Aménager (rien à ranger). Barre au-dessus de la 3D : modes + recherche d'un N° qui nomme le meuble et la case. Onglet « Ranger » renommé « Liste des cases ».
- **Ranger d'un geste** : toucher une place libre range directement (le meuble n'a plus à être choisi d'abord ; toucher une boîte, elle, choisit) ; bande « À ranger » (`data-bande-a-ranger`, seulement quand la liste des paires présentes est LUE) — toucher une paire puis une place, « Ranger ici » (prochaine place libre), ou la glisser (souris ou doigt) dans la pièce (`viseurRef` de `Room3D` : la cible est celle que vise la 3D). Un N° déjà rangé ailleurs n'est pas reposé (`dejaPoseOu`). Aucun numéro ne change.
- **Sans WebGL** : la forme libre est dessinée (`PlanSecours`) ; étiquettes 3D à taille constante, sans chevauchement ; photo du local retirée.
- Preuves : `audit-stock-plan.cjs` (`--prouve` 8/8) ; banc `stock-finitions.cjs` (sections I–VIII, 78 contrôles, 390 et 1512 px) — VII et VIII : **9 rouges sur 6c73bfd** (§6.1, banc copié dans l'arbre, build refait là) ; mutation « place libre jamais touchée d'un geste + dépôt ignoré » ⇒ 4 rouges. `stock-piece` (B choisit l'étagère par une boîte), `garage3d`, `rangement`, `premierjour` verts. `compta-stock-ui` : 2 rouges sur le placeholder SIRET de la Compta (#561, hors Stock).
- **Non mesuré** : un vrai téléphone et un vrai WebGL (banc en rendu logiciel) ; sa pièce réelle porte des étagères métal qui se chevauchent (laissées telles quelles, à lui de les déplacer).


### « Tout sur le N° » : la recherche par numéro (21 octobre)
Julien : « une recherche par numéro, partout ». La loupe de l'en-tête (la
recherche globale existante, `gsOpen`) : un **numéro** tapé (« 128 », « B128 »,
« n128 », « N°128 », « #128 », « 007 ») fait passer devant le bloc
**`ToutSurLeNumero`** — la fiche (en ligne · à confirmer · plus en ligne), ses
ventes Vinted / Leboncoin / eBay, l'annonce eBay, le bordereau (prêt · imprimé ·
posté · en attente du PDF), le carton du Stock (meuble + case), le double
(rouge, §5 — seul rouge du bloc) et la réattribution (`reattribue` : « remplacé
par N°X » / « remplace N°Y, pas encore écrit sur le carton »). Chaque ligne
(44 px) mène à son écran ; le Stock s'ouvre sur le carton coloré.
- **Une règle pure** `toutSurLeNumero(q, données, règles, séries)`
  (`src/rechercheNumero.js`) : par CLÉ (`cleNum`), jamais par sous-chaîne
  (« 12 » ≠ 128), jamais par titre. Vente Vinted = correction posée sur la vente
  (`vinted_sale_overrides.numero`), sinon transaction → annonce (`txnItem`) →
  fiche. eBay (`numLigneEbay`, `numEbayLu` : lien, SKU + carte 013), Leboncoin
  (`numeroLbcIdentite`), double (`conflitsDeNumeros`, annonce + vente à poster +
  vente annulée avant l'envoi + Stock), Stock (`ouEstNumero`) : les règles de
  l'app, injectées, pas réécrites (§11). « n128 » vaut 128 sauf si « N » est une
  vraie série (préfixe ou archive).
- **Archive B (013)** : « 128 » et « B128 » ne se mélangent jamais ; si l'ancien
  existe, une ligne le dit (« L'ancien N°B128 existe aussi — le voir »).
- **Trois états** : `trouve` · `rien` (tout lu, jamais servi) · `passu` (rien
  trouvé et une source illisible — jamais « jamais servi ») ; ce qui n'a pas pu
  être lu est nommé (`data-tout-manques`). Les sources sont lues UNE fois à
  l'ouverture de la recherche (`numData`, chaque source `null` sur échec) :
  dressings + règle « en ligne », ventes, transactions (scalaires,
  `TXN_META_SELECT`), bordereaux (`meta->>_pdf`), ventes Leboncoin (annonces
  seulement si une vente n'a pas de lien), commandes et annonces eBay (tous les
  comptes, un illisible ⇒ pas su), et **le Stock dans sa ligne `vrm_room`** (la
  copie de l'appareil peut manquer). La paire exacte n'est plus répétée dans la
  liste « Paires numérotées » en dessous (§7).
- Preuves : `audit-recherche-numero.cjs` (vraies règles d'App.jsx + module, 34
  contrôles, deux paires au même titre N°40/N°41 jamais mélangées ; `--prouve`
  **6/6** : sous-chaîne, titre, archive mélangée, pas su = rien, double ignoré,
  correction ignorée) ; banc `bancs/recherche-numero.cjs` (port 8431, données
  inventées, 390 tactile + 1512) — rouge sur le build d'avant, vert après.
- **Non mesuré** : sa vraie base (données inventées) ; une vente reliée par sa
  seule PHOTO (`entryKeyByPhoto`) n'est pas reprise par la recherche (manque, pas
  faux) ; un carton posé dans deux cases n'est signalé qu'une fois.


### L'extension prête pour le captcha Turnstile (21 octobre, 5.202 → 5.203)
⚠️ **5.203.0** : `main` a publié une autre 5.202.0 (nouvelles icônes VRM, codex #629) sans ce code ; l'ensemble captcha + icônes porte 5.203.0 (deux contenus, deux numéros).
Le jour où Julien allume Turnstile dans Supabase, GoTrue refuse `grant_type=password` sans jeton (400, `captcha_failed`, « captcha protection: request disallowed ») — et une page d'extension MV3 ne peut pas charger le script distant de Turnstile.
- **Fenêtre de l'extension et carte du logo** : le geste principal reste « Se connecter avec VRM ». Le repli « avec mon mot de passe VRM » reste tant que le captcha est éteint ; un refus captcha (`authLogin` rend `captcha: true` + la phrase ; la fenêtre reconnaît aussi le refus BRUT d'un service worker d'avant) devient « La connexion par mot de passe n'est plus possible depuis l'extension : utilise « Se connecter avec VRM ». », les champs se replient et le bouton est proposé là (`captchaLierBtn`, `data-captcha="refus"`). Aucune session rangée. Un mauvais mot de passe reste « incorrect ».
- **Pas touchés par le captcha** (lu dans le code, vérifié par l'audit) : le renouvellement (`grant_type=refresh_token`), la session fabriquée par le serveur (`admin/generate_link` clé de service, puis `verify`) — donc « Se connecter avec VRM » (5.169+), la session adressée et la voie `page` des 5.164/5.170.
- Preuves : `audit-extension-captcha.cjs` (vrai `background.js` dans `_fond-vm`, 11 contrôles, 4 rouges sur la 5.201) ; banc `popup.cjs` +18 contrôles (fenêtre et carte, refus brut et traduit, le bouton lance la liaison, l'autre sens) : **13 rouges sur la 5.201**, 90 verts après. Aucune entrée d'`EXT_CAPACITES` (l'app ne promet rien de neuf). Extension **5.202.0**, zip régénéré, `EXT_ATTENDUE` suivie.
- ⚠️ Une extension ANCIENNE (≤ 5.201) restera, captcha allumé, sur le message brut de GoTrue dans sa fenêtre : sa reconnexion par l'app (voie `page`, session adressée) marche toujours.


### Ma journée hors ligne : une photo par vendeur, sur l'appareil (21 octobre)
Ouvrir VRM sans réseau (métro, point relais sans 4G) montre Ma journée telle qu'à
la dernière ouverture RÉUSSIE : colis à expédier (N°, compte, date limite), colis
à retirer avec leurs codes et QR, la liste du soir — en lecture seule, sous UNE
ligne « Hors ligne — ce que tu vois date de {heure} ; rien ne peut être envoyé ».
- **Règle pure** `src/journeeHorsLigne.js` : `lectureComplete` (comptes lus, base
  qui répond, ventes ET achats de tous les comptes d'aujourd'hui sans échec,
  emails de suivi et de bordereau, `panel_colis_relais` LU — nouvel état
  `colisRelaisLu` —, eBay lu) ; sinon AUCUNE photo. `lirePhoto(uid)` : clé
  `vrm_hl_photo_{user.id}` ET contenu au même vendeur, sinon rien.
  `wipeLocalData` (déconnexion, changement de vendeur) efface les photos (`vrm_*`)
  et la réserve des QR.
- **Hors ligne = `navigator.onLine === false`** (`useHorsLigne`) : la coque rend
  `JourneeHorsLigne` À LA PLACE de tous les écrans (aucun geste qui envoie n'y
  existe ; « Colis fait » / « Je l'ai retiré » grisés, la raison dite une fois
  dans la ligne). Sans photo : « aucune copie gardée sur cet appareil » — jamais
  « Tout est à jour ». Retour du réseau : la ligne part ; si rien n'avait pu être
  lu (`baseKO`), rechargement (relecture normale). Une base qui hoquette EN
  ligne garde `BaseInjoignable` (et ses codes G9).
- **Session** : un jeton expiré hors ligne ne déconnecte pas (déjà vrai :
  `authRefresh` rend `null`). ⚠️ Une session rangée sans `totp` (avant le 16 oct.)
  passe par `PorteMfa`, qui ne peut pas vérifier hors ligne : pas de photo pour
  elle tant qu'elle n'est pas renouvelée en ligne (volontaire : on ne contourne
  pas la double vérification).
- **QR** : les QR hébergés sont mis en réserve par la page (`fetch` no-cors →
  cache `vrm-hl-qr`) ; le service worker sert `/hl-qr?u=…` depuis la réserve et
  la garde à l'activation. Un `data:image` va dans la photo (≤ 60 Ko). Refusé ⇒
  « QR pas gardé ici — donne le code ».
- **Service worker** : une adresse AVEC paramètres n'entre plus dans le cache —
  la vérification de version (`/?_v=<horodatage>`, chaque minute) y laissait une
  copie de la page à chaque fois. Cache `vrm-shell-v6` inchangé, `/assets/` cache
  d'abord, le reste réseau d'abord.
- Preuves : banc `hors-ligne.cjs` (port `BANC_PORT`, 4961 ; données inventées ;
  `context.setOffline` ; 390 tactile + 1512 ; lecture complète → hors ligne jeton
  expiré → retour du réseau · lecture partielle · photo d'un autre vendeur) —
  **28 rouges sur le build d'avant**, 0 après ; mutations « photo d'un autre
  vendeur servie » ⇒ 4 rouges, « photo écrite sur lecture partielle » ⇒ 6 rouges.
  `audit-journee-hors-ligne.cjs` (`--prouve` 4/4). `sw-cache.cjs` vert.
- ⚠️ **Non mesuré** : un vrai iPhone (Safari ne déclare pas toujours
  `navigator.onLine === false` sur un réseau qui ne passe pas — c'est alors
  `BaseInjoignable`) ; le CDN réel des QR Pickup (une réponse opaque refusée par
  CORP ⇒ le code seul) ; la liste du soir est calculée sur les dates limites
  rangées, pas relue.


### Le reçu d'achat : toutes les lignes, la somme vérifiée, au-dessus de la barre (23 octobre)
Julien, capture iPhone (Vinted → Achats → ⋯ → « Reçu d'achat ») : « le reçu s'affiche
mal » — la barre du bas passait par-dessus la feuille (« N° de transaction » coupé, la
fin inatteignable), et 24,93 € payés pour 20,00 + 3,23 affichés.
- **Mesuré (lecture seule, 117 lignes `email_achat_*`)** : 81 vrais reçus (« Ton reçu
  pour la commande … »). Le bloc « Montant payé » → « Mode de paiement » porte Article,
  Frais de port, puis « Frais Vinted » (55) OU « Frais de Protection acheteurs » (26),
  et « Réduction -X,XX € » (8, négative) ; la somme vaut le Montant payé sur 81/81.
  L'ancien parseur ne lisait que trois libellés : 55 reçus perdaient leurs frais, 8
  leur réduction. 36 lignes ne sont PAS des reçus (« Commande mise à jour pour … » 18,
  « … - Confirmation requise » 16, « Retourne ta commande … » 2 ; du 16 juillet au
  3 août, aucune avec un Montant payé) : la vraie route `email-inbound` ne les crée
  plus (prouvé). `transaction` est vide sur les 81 (l'astérisque de « *N° de
  transaction* » casse le motif du serveur) alors que le texte porte le n° sur 81/81 :
  61 se relient ainsi à un achat capté, 0 doublon. Toutes ont `pdfB64` vide.
- **Une règle** `<recu-achat-regle>` (App.jsx) : `ventilationRecuAchat` (toutes les
  lignes « Libellé ±X,XX € », libellé de Vinted, en centimes, aucune jetée — une ligne
  illisible est GARDÉE ; `juste` · `ecart` · `passu`), `txRecuAchat` (le n° lu sur sa
  ligne), `estRecuAchat` (⚠️ revue ci-dessous : tout email rangé comme achat SAUF les
  trois sujets de statut mesurés, sans Montant payé ni PDF),
  `recusAchatDe` (`undefined`/`null` passés tels quels). `champsRecuAchat` sert la
  feuille ET la fenêtre PDF (§11) ; `phraseSommeRecu` dit l'écart ou le « pas su » en
  une ligne neutre, jamais un total partiel présenté comme complet.
- **Liste et menu** : « Reçus d'achat par email » ne liste que les vrais reçus et dit
  combien d'autres emails n'en sont pas (`data-recus-autres`) ; le menu ⋯ d'un achat
  (`receiptFor`) relie par n° de transaction, et le titre ne relie plus qu'un reçu SANS
  n° (§5 : un reçu au même titre et à un autre n° est celui d'un autre achat).
  `ordersFromEmailAchats` (mort depuis août, seconde règle « reçu ») est retiré.
- **La feuille** (`FeuilleRecuAchat`) est portée sur `<body>` : sur iPhone, `<main>`
  (qui défile) forme un contexte d'empilement et la barre du bas passait dessus. ‹ et
  PDF à 44 px, zone de sécurité en bas, hauteur en `dvh` ; « Visa •••• 4242 » (sans
  les étoiles de l'email, on lisait « Visa, 4242 ») ; montant payé à l'encre (§7),
  bande à `COULEUR_PLATEFORME.vinted`. ⚠️ Le « zoom 0,8 » du téléphone (§7, 19 oct.)
  est en réalité ANNULÉ par `styles-iphone.css` (`.vrm-app-shell .vrm-main{zoom:1}`).
- **Preuves** : `audit-recu-achat.cjs` (la règle dans un vm + la vraie route
  email-inbound) 43 contrôles, 18 rouges sur bf0a9c8 (la règle n'existait pas : pas
  une preuve seule) et 7 mutations rouges (`connus` 10, `somme` 2, `signe` 6,
  `nonrecu` 2, `jete` 2, `txtexte` 3, `mode` 1). Banc `recu-achat.cjs` (ports 9201 à
  9210 ; 390 × 560 tactile clair, 390 × 700 sombre, 1512) 86 contrôles : **48 rouges
  sur le build de bf0a9c8**, 0 après ; feuille rendue sans portail ⇒ 12 rouges,
  libellés connus seulement ⇒ 21. ⚠️ Chromium ne fait pas de `<main>` un contexte
  d'empilement : le banc l'impose sur téléphone (`.vrm-main{isolation:isolate}`) pour
  rejouer l'iPhone — sans ça il était VERT sur le défaut.
- **Non mesuré** : un vrai iPhone ; la propriété exacte qui fait de `<main>` un
  contexte d'empilement dans WebKit ; un reçu à deux moyens de paiement (forme vue une
  fois, montants gardés).
- **Pas fait** : le serveur range toujours `transaction` vide — corriger son motif
  changerait la CLÉ des nouveaux reçus (un email renvoyé ferait un doublon) ; l'app lit
  le n° dans le texte.
- **Revue du 23 octobre — défauts reproduits, corrigés** (chacun rouge avant le
  correctif — sur 7ba9670 —, vert après, rouge sous mutation) :
  - **Le banc `csp.cjs` ne jugeait plus la fenêtre du reçu** : il extrayait
    `parseReceiptFields` (retiré), sortait « ❌ le code du reçu se retrouve dans
    App.jsx » et SAUTAIT ses 18 contrôles (impression une fois, Fermer, aucune
    violation, onglet rechargé, journal « fenetre:recu »). Il extrait ce que lit
    `openReceipt` (`COULEUR_PLATEFORME`, `<recu-achat-regle>`, `modePaiementRecu`,
    `phraseSommeRecu`, `champsRecuAchat`), son reçu a la forme mesurée, et un
    contrôle de plus exige les vraies lignes dans la fenêtre (Frais Vinted, somme
    juste, « Visa •••• 4242 ») : 2 rouges sur 7ba9670, vert après, 2 rouges quand la
    fenêtre ne garde que les trois anciens libellés.
  - **Un email que la ROUTE range comme achat disparaissait de la liste** :
    `estRecuAchat` exigeait un Montant payé, un sujet « reçu pour la commande » ou un
    PDF, alors que la route (branche 2b) range aussi « Merci pour ton achat », « Tu as
    acheté », « Confirmation d'achat » (et notifie « justificatif archivé ») — ils
    étaient comptés parmi « les mises à jour, confirmations, retours », et un reçu dont
    Vinted changerait la tournure aurait suivi. « Pas un reçu » = les trois sujets de
    statut MESURÉS (`SUJET_STATUT_ACHAT` : « Commande mise à jour pour » 18, « -
    Confirmation requise » 16, « Retourne ta commande » 2 ; aucun avec un Montant payé
    ni un PDF), rien d'autre. Sans bloc Montant payé, la feuille et la fenêtre
    montrent le TEXTE de l'email (`hasStructured` = `v.trouve` : avant, un n° de
    transaction suffisait à afficher un reçu vide). `audit-recu-achat.cjs` fait
    passer ces emails par la vraie route puis par la vraie règle (§11) : 6 rouges sur
    7ba9670 ; mutations `positif` 4, `nonrecu` 2, `texte` 1. Banc `recu-achat.cjs` :
    « Merci pour ton achat » listé et lu en texte, 12 rouges sur le build de 7ba9670.
  - **Une ligne de frais au libellé « Transaction … » ou « Vendeur … » finissait le
    bloc** (« Transaction sécurisée 0,50 € » : elle ET « Frais Vinted » qui suivait
    étaient jetées — la feuille disait l'écart, mais la promesse « aucune ligne jetée »
    ne tenait pas). Ces deux mots ne sont une borne que sans montant en fin de ligne
    (`FIN_SI_SANS_MONTANT_RECU`) ; « Mode de paiement », « Date du paiement », « N° de
    transaction » restent des bornes quoi qu'il arrive (mesuré : aucune des 81 ne finit
    par « € »). Audit : 2 rouges avant ; mutations `borne` 2, `bornetoutes` 1. Aucun
    reçu réel n'avait ce libellé.
  - **À 320 px, un montant ou la carte se coupaient** (« 11,20 » / « € » avec la
    police du banc, « MasterCard •••• » / « 9999 » avec des métriques d'Arial, et
    « 10 h » / « 47 ») : la valeur d'une ligne était en `overflowWrap:'anywhere'`,
    qui casse même une espace insécable, et la fenêtre PDF, elle, posait `nowrap`.
    Les montants de la feuille ne passent plus à la ligne (`Row montant`, comme la
    fenêtre), et `•••• 9999` et `10 h 47` portent des espaces insécables
    (`modePaiementRecu`, `champsRecuAchat` — la feuille ET la fenêtre). Banc
    `recu-achat.cjs` : deux vues 320 × 568 (police du banc, métriques d'Arial) et un
    reçu aux libellés les plus longs mesurés : 4 rouges sur le build de 7ba9670, 3
    sous la mutation « nowrap et insécable retirés » ; audit, mutation `nbsp` 1.
  - **Au clavier, la feuille laissait partir le focus** (au 3ᵉ Tab sur `<body>`,
    derrière le voile — et Échap, écouté sur le seul dialogue, ne fermait plus rien),
    ↓ et Page bas ne faisaient pas défiler le reçu (le focus était sur le dialogue, qui
    ne défile pas), et à la fermeture le focus tombait sur `<body>`. Déjà vrai sur
    bf0a9c8 (pas une régression). `FeuilleRecuAchat` : focus sur la zone qui défile
    (`data-recu-defile`, `tabIndex 0`), Tab / Maj+Tab tournent dans la feuille, Échap
    écouté sur le document, le focus rendu à « Voir › » (le motif de `MenuEcrans`).
    Banc `recu-achat.cjs` K (ouverture au clavier, Page bas, Tab ×5 + Maj+Tab ×4,
    Échap après cinq Tab, focus rendu) : 10 rouges sur le build de 7ba9670 ; 10 sous
    « piège, écoute du document et retour retirés », 3 sous « retour du focus retiré ».

---


### Revue argent de l'app (20 octobre) — trois défauts, reproduits puis corrigés
Relecture adverse des chemins qui coûtent de l'argent (N° tamponné, double vente, colis à poster, URSSAF, bénéfice, emails, factures). Chaque défaut est REPRODUIT dans `scripts/audit-revue-argent.cjs` (vraies fonctions de l'app dans un `vm`) : **9 rouges sur le code d'avant**, 15 verts après, `--prouve` 5 mutations sur 5 rouges.
- ⚠️⚠️ **Une commande eBay ANNULÉE comptait dans le CA déclaré, le vendu et le CA payé** : `annulerCommandeRangee` (serveur) pose `cancelState: 'CANCELED'` et garde `orderPaymentStatus: 'PAID'`. `ventesDeclarables`, `ventesFaites` et `caEbayPayees` passent par `commandeEbayEngagee` (une règle, §11 ; le miroir `ventes-regle.js` refabriqué par `--recopie`).
- ⚠️⚠️ **`CANCEL_REJECTED` (annulation refusée, la vente tient) n'engageait pas la paire** : `/CANCEL/` l'attrapait. Plus d'alerte « retire-la de Vinted » ni de garde de double vente. Corrigé dans `commandeEbayEngagee` (même lecture que `etatCommandeEbay` côté serveur).
- **Une facture manuelle faite AVANT la remise à zéro 013 pour « 12 » se joignait au bordereau de la NOUVELLE N°12** (identité d'un autre acheteur) : `facturesDuNumero` ne retient que les factures créées depuis `appliqueLe` ; sans date, rien ; sans marqueur, comme avant.
- `audit-urssaf.cjs` et `audit-ebay-route.cjs` chargent `commandeEbayEngagee` (§6.3).
- **Rejetés après vérification** : `label_latest` sans transaction (la transaction est exigée), ordre de `numForBord`, lot d'impression (gardé par la version de numérotation et les N° à vérifier), URSSAF (arrondi une fois), bénéfice Leboncoin/eBay (passait déjà par l'engagement).
- ✅ ~~Noté, pas corrigé : le CA et le bénéfice eBay lisent `pricingSummary.total`~~ — corrigé le 20 octobre (section suivante).


### Les bancs rouges sur `main` au 20 octobre — causes, et ceux laissés rouges
Chaque banc lancé SEUL, la cause trouvée avant de toucher quoi que ce soit.
- ⚠️⚠️ **`numeros-remise-a-zero` — défaut de l'APP, sur les numéros.** Après le bloc « Recharger » (écran périmé, écriture refusée par `vrm_numeros_perimes`), le « 999 » tapé sur l'écran périmé REPARTAIT au nuage : la fusion du chargement du 18 octobre (`fusionNumerosAuChargement`) gardait la fiche de l'appareil « inconnue du nuage ». `rechargerEnGardantLesSaisies` pose maintenant `vrm_recharge_sans_fiches` (sessionStorage) et le chargement suivant ne fusionne pas les FICHES (le pool reste une union, les saisies sont rejouées sans numéro par `rejouerSaisies`). Rouge sur le build d'avant, vert après ; `numeros-panne` (la fusion qui sauve les numéros de la panne) reste vert.
- **Bancs périmés, mis à jour sans les affaiblir** : `numeros-lettres` (série « B » : B126 après le plus haut, règle « jamais dans un trou » du 18 oct.) · `sauvegarde` (`framenavigated` part aussi pour un `pushState`/`back` d'une feuille qui se ferme : un vrai rechargement se juge sur `load`, et un contrôle positif « l'écriture réussie recharge » prouve que l'autre n'est pas vacant) · `lbc-publier-app` H (un téléphone dont l'extension répond agit ici depuis la 5.188 : H rend un iPhone SANS extension, H2 l'autre sens) · `photos-vinted` O (passer par Vinted affichait Ventes, l'extension en mettait les photos en cache, et Ma journée ne demandait rien hors ligne : le scénario n'était plus réel) · `compact`, `mobile` (vente repliée depuis fc4c73e/5cdffcb : on OUVRE la ligne ; vignette 36 × 48 du design ; le menu des écrans s'ouvre par « Gestion » en bas) · `dictee` (le champ se trouve par son `aria-label`) · `serie` (la case s'appelle « Bénéfice », reconnue à son titre ; la « suggestion » cliquée était la ligne de vente derrière la modale — on ne prend qu'un « C'est ça » d'une ligne de la saisie).
- **Instables sous charge seulement** (verts lancés seuls) : `pont`, `session`.
- **Laissés rouges, choix de design de Julien** : `stats-premium` (866a90d) et `mobile` — « navigation lisible » : les libellés de la barre du bas sont à **9 px** depuis 0bbc78e (`styles-mobile-studio.css`, 19 oct.) contre 11 px exigés. Tout le reste du banc est vert (vérifié en neutralisant ce seul contrôle). À trancher par Julien : remonter la taille, ou accepter 9 px.


### Suivi des colis par n° et par Vinted, notifications (23 octobre)
Julien : « quand on reçoit un mail comme quoi on a retiré un colis, le numéro de suivi est comparé à ceux dans les colis à retirer et ça retire les concernés » ; « enregistrer le numéro de suivi et tracer le colis » ; « que ça me prévienne dès qu'il y a une mise à jour d'un colis » ; « il ne doit plus y avoir de problème avec les retraits, je me suis déplacé pour rien ».
- **Mesuré d'abord** (lecture seule, sa base) : le même n° vit sous plusieurs clés (`email_track_mondialrelay_N` « disponible », `email_track_vinted_…` « retiré ») ; **23 lignes « info » n'ont leur n° QUE dans le sujet**, après « # » (Vinted Go : « Ton colis arrive aujourd'hui ! #… », « Libère de la place… #… », « Rappel… ») ; « Uw pakket is afgehaald door de ontvanger » (NL) était rangé « info » ; « Tu envío ha sido recogido » (ES) est **ambigu** — 6 lignes sur 8 portent le n° d'une « Confirmation du dépôt » (la relève par le transporteur) : il ne compte PAS comme un retrait ; **0 transaction sur 1 290** ne porte `shipment.tracking_code` (lecture morte, retirée) ; l'adresse Chronopost « tracking-no-cdn » est morte, « tracking-no-cms » est celle que Leboncoin range.
- **UNE règle** (`api/_lib/suivi-colis.js`, §11), lue par Achats, Ma journée, la publication `vrm_colis_retirer` (elle porte maintenant `finis`, les colis que l'app SAIT finis), le widget, la photo hors ligne, l'écran d'équipe et le cron du matin : `suiviDeLigne` (le `suivi`, sinon le n° du sujet après « # »), `finsDesLignes` (par n° normalisé : un « retiré » de n'importe quelle clé, NL compris, relu avec la règle d'aujourd'hui ; un « retour » avec sa date ; jamais le colis qu'IL a envoyé), `sortiParSuivis` (**un retiré reste retiré** : un rappel ou un « disponible » traité après ne le ressuscite pas ; un retour ne compte que s'il est écrit APRÈS l'arrivée, sinon ce n'est pas ce passage-là). Un achat Vinted sort aussi par SON n° (ligne de suivi Vinted ou n° relié à la main). `email-inbound` range désormais le n° du sujet dans `suivi` quand le corps n'en a pas, et la clé du « retiré » est la sienne (`retire-N`) : le premier « en transit » ne la consomme plus. Un « disponible » dont une AUTRE ligne dit déjà retiré/reparti ne sonne pas « 📍 » (lecture ratée ⇒ comme avant : on ne sait pas).
- **Suivre ↗** (`BoutonSuivreColis`, 44 px) sur chaque colis à retirer ou à vérifier qui a un n° : Mondial Relay (`numeroExpedition`, et `codePostal` seulement s'il est LU dans le lieu de l'e-mail ou tapé par lui — jamais deviné), Chronopost (`tracking-no-cms`), sinon une RECHERCHE du n°, dite comme telle. Il ne promet rien.
- **« Vinted : « … » »** (`LigneNouvelleVinted`) : la dernière étape de la ligne `harvest_{uid}_suivi_{tx}` (contrat du 23 oct., écrite par l'extension — autre chantier), lue en scalaires (`lireTout` strict : trois états), recopiée TELLE QUELLE avec sa date et l'âge de la lecture. Rendue seulement sur la carte de SON achat — l'index est rangé sous « compte:transaction » (une transaction Vinted est vue des deux côtés, acheteur et vendeur) — ou sur l'e-mail relié à la commande par le **code de retrait** ou le **n° de suivi** (deux identités ; la consigne demandait le code, le n° égal est accepté aussi). Jamais par le titre. Lecture ratée ⇒ « n'a pas pu être lu ». Ce qui manque est dit UNE fois, et « l'extension le relève » seulement si `extSait('suivivinted') === 'ok'` (`EXT_CAPACITES.suivivinted = '5.215.0'` depuis la revue du 24 oct., `capterSuivisAchats`) ; l'app relit sur `maj · suivi`.
- **Ajouter un n° de suivi** (Achats → À retirer, `SuivisManuels`) : le transporteur se lit à la FORME du n° (8 chiffres ⇒ Mondial Relay ; 2 lettres, 9 chiffres, 2 lettres ⇒ Chronopost ; « VGS… » ⇒ Vinted Go), ambigu ⇒ on DEMANDE ; code postal facultatif ; une ligne par n° (`colis_suivi_{transporteur}_{n°}`, lire-fusionner-réécrire gardé : une lecture ratée n'écrit rien) ; relié à un achat seulement par SON clic ; **jamais « à retirer »** (« Suivi ajouté — en attente d'une nouvelle », ou la dernière nouvelle des e-mails au même n°).
- **Le cron du matin** (`api/ship-reminders.js`, 08:00 UTC, par vendeur, `rappelsColisRetrait`) : « 📍 Dernier jour pour retirer <lieu> » quand la date limite LUE est aujourd'hui (Paris), et « Colis à vérifier — sans doute reparti : n°… » le jour où il passe la limite ou la garde de son transporteur (`etatRetrait`, `gardeDe` — un jour de rattrapage si le cron a sauté). Jamais un colis retiré sous une autre clé, coché « Je l'ai eu », fini pour l'app (`finis`), ou qu'il a envoyé. Catégorie « colis » ; une fois par colis et par état (`colis_retrait_dedup`, écrit AVANT l'envoi et vérifié, 60 jours) ; mémo, lignes de suivi ou `main` illisibles ⇒ rien ; préférence coupée ou abonnement coupé ⇒ rien. La réponse du cron ne porte que des nombres.
- **Notifications d'un e-mail** : « ✅ » d'un retiré et « ↩️ » d'un retour sonnent une fois, avec le n°. ⚠️ Le retiré est dans la catégorie « Suivi du colis » (coupée par défaut, **activée chez lui le 11 oct.**) ; le retour dans « colis ».
- Preuves : `audit-suivi-colis.cjs` (règle partagée, règles de l'app par Babel, vraie route `email-inbound`, vraie route `ship-reminders`, vraie route `widget`, base à état) — **11 rouges sur 743585d** (dont 3 parce que la règle n'existe pas : 8 sur le COMPORTEMENT des routes), vert après, `--prouve` **21/21** mutations rouges. Banc `bancs/suivi-colis.cjs` (données inventées, 390 tactile clair et sombre, 1512 ; + la vraie route du cron) — **44 rouges sur le build de 743585d**, vert après ; mutations « nouvelle par le titre » 7, « n° du sujet ignoré » 10, « Suivre absent » 15 rouges. `colis-fiables` (défaut 14 : Ma journée ne lit plus aucune transaction pour un n°, elle lit les lignes de suivi en scalaires), `colis-arrivee` mis à la forme (le n° dans la ligne de suivi, plus dans la transaction).
- **Vitesse** : Ma journée ne décompresse plus aucune transaction pour un n° ; les deux lectures de suivi (lignes Vinted, n° ajoutés) partent ensemble et se posent dans le MÊME rendu. `vitesse.cjs` juge la nouvelle forme (0 transaction lue pour un n°, 2 lectures en scalaires) ; rendus de Ma journée au téléphone : médiane **13** (15 sur 743585d, plafond 13).
- ⚠️ **Rouges connus** : `audit-coherence` est ROUGE tant que ce chantier n'est pas fusionné avec celui de l'extension (`capterSuivisAchats` absente, seuil au-dessus du manifeste) — c'est voulu, la capacité est déclarée avant la fonction. `colis-arrivee` en mode `BANC_RETRAITS=1` sort 2 rouges, **déjà sur 743585d** : son e-mail « Votre colis a été retiré par l’acheteur » est la forme d'un colis qu'IL a envoyé (sortant), il ne retire donc pas un achat. `retrait.cjs` (12), `colis.cjs` (7) et `panne.cjs` (23) sortent les MÊMES rouges sur 743585d (fixtures datées) : notés, pas touchés.
- **Non mesuré** : le paramètre `codePostal` de la page Mondial Relay (mondialrelay.fr bloqué d'ici) ; le filtre PostgREST `or=(id.like…,meta->>suivi.eq…,meta->>subject.ilike…)` de `email-inbound` contre SA base (grammaire documentée, servie par le faux de l'audit ; refusé ⇒ « pas su » ⇒ la notification part comme avant) ; la forme réelle d'une ligne `harvest_{uid}_suivi_{tx}` (jamais vue : servie à la forme du contrat) ; l'écran d'équipe ne lit pas les lignes de suivi Vinted (liste blanche de la 016) : ses achats Vinted ne sortent pas par n°, seulement par e-mail.
- **Gestes de Julien** : rien ici ; le relevé du suivi Vinted arrive avec l'extension **5.216** (autre chantier ; les 5.214 et 5.215 publiées par `main` ne l'ont pas).

#### Revue du 24 octobre (chantier app et serveur) — seize constats reproduits, corrigés
Chacun REPRODUIT d'abord (vraies routes sur la base à état d'`audit-suivi-colis`, app rendue sur données inventées), corrigé à la racine, ROUGE sur le code d'avant, VERT après, ROUGE sous une mutation.
- **Serveur** :
  - ⚠️ « Ton colis arrive aujourd'hui ! #N » devenait « 📍 arrivé au point de retrait » : le n° lu dans le sujet faisait sauter la garde « disponible sans suivi ⇒ info ». Une arrivée annoncée au futur est un transit (`ARRIVEE_A_VENIR`, `etat-colis-email.js`) et un n° lu dans le SEUL sujet, sans code, QR ni lieu, ne prouve pas un colis au relais (`suiviDuSujetSeul` ⇒ info). Mesuré : 13 lignes de prod à ce sujet, toutes « Info ».
  - Le cron disait « Colis à vérifier — sans doute reparti » d'un colis que l'app dit en transit : la relecture d'une ligne (code ou lieu dans l'extrait, lieu au futur, sujet qui dit retour ou arrivée) vivait dans l'app seule. Une règle, `relireLigneSuivi` / `relireLigneMeta` (`api/_lib/suivi-colis.js`), pour l'app (`reclassifyTrack`), le cron et le widget, lus en `SELECT_SUIVI_META`.
  - « 📍 Dernier jour » d'un achat dont la commande est finie, quand la publication de l'app manquait ou datait : le cron relie lui-même le colis à sa transaction (code de retrait de `panel_colis_relais`, n° de la ligne de suivi Vinted ou d'un n° relié à la main — `txDuColis`, `liensDesLignes`, jamais le titre ni le lieu) et lit l'état de la commande (`finDeCommandeAchat`, la règle de l'app) ; une de ces lectures ratée ⇒ rien n'est envoyé. L'app ne publie `finis` que si `panel_colis_relais` et les deux lectures de suivi sont LUES, sinon `null`.
  - Un retour traité avant l'e-mail d'arrivée laissait le colis « à retirer » : l'arrivée (`arriveLe`) et la date d'un retour suivent la date de l'e-mail (`emailAt`), plus l'heure de traitement.
  - « ✅ Colis livré » (vers Achats) sonnait pour un colis qu'il a VENDU : le sens est rangé sur la ligne (`sens: 'sortant'` quand le n° est celui d'un de ses bordereaux ou d'une autre ligne sortante — mesuré : 0 ligne sur 229 le portait) ; la notification dit « ✅ Ta vente : colis retiré par l'acheteur », ouvre Ventes, sous la clé d'avant.
- **App** :
  - ⚠️⚠️ `EXT_CAPACITES.suivivinted = '5.216.0'` (5.215 dans la revue, montée à la fusion du 24 oct.) : la 5.214.0 PUBLIÉE par `main` (ad1b43b, PR #661) n'a pas `capterSuivisAchats`, et c'est elle qui tourne chez lui (`panel_diag_capture.ver`). Le numéro de l'extension, le zip et `EXT_ATTENDUE` : chantier extension.
  - À 390 px, « Suivre sur le site du transporteur ↗ » poussait le code de retrait hors de l'écran dans « colis à vérifier » : `BoutonSuivreColis court` (« Suivre ↗ », le texte long en `aria-label` / `title`), et `.vrm-oublie-gestes` revient à la ligne sous 768 px.
  - La promesse « l'extension le relève à ta prochaine visite » (`EtatSuiviVinted`, la forme de `ligneSansPreuve`) n'est faite qu'à une extension de CE navigateur qui sait le faire (`extSait`), que rien ne bloque (`raisonExtGlobale`, la phrase de l'indicateur), connectée à CE compte VRM, au code à jour, seule. « Au fil de tes visites » quand un compte a plus de colis que `SUIVI_PAR_VISITE` (3 = `SUIVI_MAX_PAR_VISITE` de l'extension, comparé par `audit-suivi-colis` dès que background.js a `capterSuivisAchats`) ; les comptes sont nommés.
  - `panel_formes_suivi.journey.etat === 'inconnue'` (la page de suivi vue, pas lisible) remplace la promesse par « l'extension a vu la page de suivi de Vinted mais ne sait pas encore la lire — touche « Suivre le colis » » (lu au rendu du bloc seulement, trois états). Une ligne relevée SANS étape datée n'est plus « pas encore relevé » : dite à part (« Vinted ne donne pas de date pour ses étapes »), sa dernière étape (`etapes[0]`) recopiée sur la carte, « étape sans date ».
  - Un n° ajouté à la main disait « il est dans « à retirer » » d'un colis retiré ou à vérifier : `etapeDuSuiviManuel` lit la liste de `pickupUnion` (à retirer · à vérifier, avec sa raison · reparti · retiré, fini ou coché · sinon le dernier e-mail, sans dire de quelle liste).
  - Choix du transporteur : trois cas, trois phrases (reconnu à la forme · « Tu as choisi Y (la forme faisait penser à X) » · ambigu) ; le choix est un `Segmente` (en sombre, plus d'aplat blanc).
  - « (relevé il y a N) », plus « (lu il y a N) » : `capturedAt` ne bouge que quand l'étape change. « Retirer » (un n° ajouté) devient « Ne plus suivre ce n° », confirmation gardée.
- **Preuves** : `audit-suivi-colis.cjs` (+ revue n° 1 à 7 et 10) — 19 rouges sur f20cd4e (le chantier avant la revue), 22 sur 743585d, vert après, `--prouve` 33/33 ; banc `suivi-colis.cjs` (+ sections E à K, 390 tactile clair et sombre, 1512 ; `BANC_SEUL=E,F` pour une section) — 30 rouges sur le build de f20cd4e, 67 sur 743585d (le suivi n'y existe pas ; la section F, elle, y est VERTE : la régression venait du chantier), vert après (144 contrôles) ; douze mutations de l'app, chacune rouge sur sa section (12/12 : libellé court 4, promesse sans garde 3, « prochaine visite » toujours 1, forme inconnue ignorée 1, ligne sans date ignorée 1, étape du dernier e-mail 4, phrase du choix 2, choix en aplat 1, « lu il y a » 3, « Retirer » 2, `finis` toujours publié 1, seuil 5.214 1).
- **Non mesuré** : la forme réelle de `panel_formes_suivi` et d'une ligne `harvest_{uid}_suivi_{tx}` (servies à la forme du contrat et de la passe extension) ; la comparaison du rythme ne tourne qu'après la fusion avec le chantier extension (prouvée sur une copie de son background.js : « 5 par visite » ⇒ rouge).


### Extension 5.216 — le suivi Vinted des achats (23-24 octobre)
Julien : « enregistrer le numéro de suivi et tracer le colis, avec les applis de chaque transporteur » ; « que ça me prévienne dès qu'il y a une mise à jour d'un colis ». **Mesuré d'abord (lecture seule)** : aucune ligne captée ne porte le n° de suivi d'un ACHAT — 0 sur 1 290 transactions, 0 dans 1 400 conversations, 0 dans les commandes (le commentaire d'`inject.js` qui le disait dans la transaction était FAUX, corrigé). Son navigateur a déjà vu passer trois chemins (chemin + statut, jamais le contenu) : `…/transactions/{id}/shipment/journey_summary` (le bouton « Suivre le colis »), `…/escrow_orders/{id}/shipment` (la page d'une commande), `…/transactions/{id}/shipment/parcel_collection_code`. **Leur forme n'a jamais été vue** : l'extension la MESURE et ne range que ce qu'elle reconnaît.
- ⚠️⚠️ **5.216.0, ni 5.214.0 ni 5.215.0** : à la fusion du 24 octobre, `main` avait publié une AUTRE 5.215.0 (messages aux favoris, PR #667) — le suivi passe en 5.216.0, qui porte les deux. Avant : `main` a publié une AUTRE 5.214.0 (sans ce code) pendant le chantier. Deux contenus ne portent jamais le même numéro (`CODE_VERSION`, manifeste, `EXT_ATTENDUE`, `CAPTEUR_VERSION` de `lbc-inject.js`, `relaisVersion`, zip). `EXT_CAPACITES.suivivinted` (posée par le chantier de l'écran Achats) doit valoir **'5.215.0'**.
- **Une règle, deux exécutions** (`<suivi-regle>`, texte identique dans `inject.js` et `background.js`, §11) : `formeSuivi` (noms de clés + types, jamais une valeur ; une clé qui ressemble à une donnée devient `{k}`) · `allegerSuivi` (LISTE BLANCHE : libellés, statuts, dates, transporteur, n° de suivi, nom du point relais ; tout le reste — nom, adresse, e-mail, téléphone, code de retrait, QR — est retiré, et un texte gardé qui CITE une valeur retirée la perd : « … ») · `contratSuivi` (étapes `{t, at, code}`, 30 au plus, la plus récente d'abord ; `dernier` = la plus récente DATÉE ; aucune étape reconnue ⇒ `null`, « pas su »).
- **Voie passive** (`noteSuivi`, `inject.js`) : une réponse GET 2xx de Vinted sur l'un des trois chemins — AUCUNE requête de plus (§3). Il part la forme et, pour le suivi et l'expédition, le contenu allégé (le code de retrait : sa forme SEULEMENT). `content.js` relaie le message entier.
- **Le fond** (`noterSuiviPage`) : compte = celui du COOKIE de l'onglet, compte refusé ou supprimé ⇒ rien ; le contenu est re-allégé (un message forgé ne range rien de personnel) ; la forme va dans `panel_formes_suivi` (`{v:1, journey|escrow|code: {forme, etat: reconnue|inconnue|forme, at, ver, n}}`, lire-fusionner-réécrire GARDÉ) ; le contenu dans `harvest_{uid}_suivi_{tx}` = le CONTRAT `{v:1, tx, source: journey|escrow|passif, capturedAt, etapes, dernier, n, transporteur, suivi, forme}` **seulement pour un ACHAT de CE compte** (par identité ; jamais une vente, jamais un autre compte). `n` = le nombre d'étapes (un scalaire : la base le recopie dans `meta`, l'app sait qu'une ligne existe sans étape datée sans décompresser les étapes). `capturedAt` = l'instant du dernier CHANGEMENT rangé (la ligne n'est écrite que si une étape change). L'app est prévenue (`maj · suivi · uid · tx`).
- **Voie active** (`capterSuivisAchats`, à chaque visite Vinted, APRÈS les preuves, codes, colis à confirmer, versements et relevés) : les achats pas finis (en route, au point relais, `needs_action`), jamais un achat « livré », jamais un achat dont la dernière étape rangée est déjà une ARRIVÉE (`SUIVI_ARRIVE` : le retrait, c'est lui qui le fait) ; le plus récent d'abord ; `GET …/journey_summary`, **3 par visite, 6 par heure et par compte** (`vrmSuiviLus`), file Vinted (une en vol), pause/frein, garde du compte, pas deux fois la même transaction en 3 h (`vrmSuiviFaits`, ôté sur un échec passager), achats ou suivis illisibles ⇒ rien lu.
- **La notification** : seulement quand la dernière étape datée change de LIBELLÉ et qu'elle est plus récente (la toute première lecture d'un colis est la ligne de base), datée de moins de 72 h et pas dans l'avenir. File `vrmSuiviNotifs` (`chrome.storage.local`), `POST /api/push { action: 'suivi', tx, uid }` avec la session VRM — ni libellé ni titre ; sans session ou en échec, gardée et renvoyée, 24 h au plus après l'étape à annoncer. La route (`api/_lib/suivi-vinted.js`, toujours 12 fonctions) relit AU NOM du vendeur (`owner=eq.`) : le compte `uid` doit être à lui (sinon 403), sa ligne de suivi (illisible ⇒ 503), la commande ACHETÉE pour le titre (sinon 404), la préférence **« suivi »** (coupée par défaut), l'arrivée au point relais déjà annoncée (ci-dessous), puis la **réservation de l'étape** (ci-dessous) : « 📦 {titre de l'achat} » / « Vinted : « {étape} » », ouvre Achats. Abonnement coupé ⇒ rien.

#### Revue du 24 octobre — quatorze défauts reproduits, corrigés (extension et route)
Chacun REPRODUIT d'abord (vrai `background.js` dans `_fond-vm`, vrai `inject.js` dans un `vm`, vraie route `api/push.js`), rouge sur le code d'avant, vert après, rouge sous mutation.
- ⚠️⚠️ **Deux appels simultanés pour la même étape envoyaient deux notifications** : la route lisait `push_dedup` puis l'écrivait. ⇒ La réservation est ATOMIQUE : une ligne par transaction, `push_suivi_{tx}`, écrite par **comparer-et-échanger** sur `data.rev` (`modifierCas` : PATCH filtré `data->>rev=eq.N|is.null` avec `return=representation`, insertion `resolution=ignore-duplicates`) ; seul l'appel dont l'écriture est revenue envoie ; illisible ⇒ 503. **La clé est la transaction + le LIBELLÉ normalisé**, jamais l'instant ni le code (la même étape vue par le suivi puis par la page de la commande à 10 min d'écart ne sonne qu'une fois).
- ⚠️⚠️ **L'arrivée au point relais sonnait deux fois** (l'e-mail du transporteur ou la conversation, puis le suivi). Une étape « disponible » (`etatColisDepuisTexte`) ne sonne pas si une IDENTITÉ dit qu'elle est déjà annoncée dans `push_dedup` : `relais-tx{tx}-*` (la conversation), `relais-{n° de suivi de la ligne}-*` (l'e-mail), `retrait-code-{CODE}` (le code lu dans la conversation de CETTE transaction, `panel_colis_relais`) ; sinon elle sonne et pose `relais-tx{tx}-sans` et `relais-{n°}-sans`, pour qu'un e-mail ou une conversation SANS code venus ensuite se taisent (un message qui apporte le CODE sonne une fois de plus, la règle du 21 oct.). `push_dedup` ou `panel_colis_relais` illisibles ⇒ 503. ⚠️ Limite : un e-mail d'arrivée sans n° de suivi, la ligne de suivi sans n° et aucun code lu ⇒ aucune identité commune, deux notifications possibles (§5 : jamais le titre, la date ou le point relais).
- **Une étape datée dans l'AVENIR** (une livraison estimée) devenait `dernier` et sonnait. La règle ne range jamais une étape datée seulement au-delà de 10 min (`SUIVI_FUTUR_MS`), et la route refuse aussi (`raison: 'futur'`).
- **Deux réponses en même temps** (le bouton « Suivre le colis » rouvert) : deux écritures, deux appels. `rangerSuivi` passe par une chaîne PAR colis ; la file des notifications (`mettreNotifSuivi`, `envoyerNotifsSuivi`) par UNE chaîne, et l'envoi relit la file avant de l'écrire et ne touche qu'aux entrées qu'il a traitées et qui n'ont pas changé (deux achats en même temps : l'un partait deux fois, l'autre jamais) ; `panel_formes_suivi` aussi (la forme du suivi et celle du code, reçues ensemble : la seconde effaçait la première, 4 fois sur 4) ; même chaîne pour `vrmRetraitNotifs`.
- **La page de la commande (escrow, UNE étape) remplaçait les quatre étapes du suivi**, sonnait une seconde fois pour le même évènement, et le suivi relu ensuite était refusé « plus ancien ». ⇒ On FUSIONNE (`fusionEtapesSuivi`) : même libellé à moins de 6 h (ou sans date), ou deux voies différentes au même instant = la même étape, qui ne reçoit que ce qui lui manquait ; la source « escrow » ne remplace jamais celle du suivi.
- **Une ligne de base sans dates** : la première lecture DATÉE sonnait. Elle ne sonne que si son libellé n'était pas déjà rangé.
- **La borne de 24 h** était celle de la première mise en file de l'achat : une étape neuve après 25 h d'échecs était abandonnée. Elle repart de l'étape à annoncer.
- ⚠️⚠️ **Le suivi mangeait les lectures de l'argent et des colis** : lecteur prioritaire (classe « colis »), il revenait sur chaque achat en route toutes les 3 h — avec 35 achats en route (un de ses comptes), il prenait les 20 lectures de l'heure et **le code d'un colis arrivé au point relais n'était plus lu** (0 lecture de sa conversation au banc). Il a sa classe `'suivi'` : sous la réserve de l'argent et des colis (comme la relecture), 6 par heure, et il sort de `lecteursPrioritaires` — **la réserve revient à 13** (16 pour les photos avec la relecture, plus 19) ; `audit-enligne` et `audit-photos-etalees` reprennent leurs scénarios d'avant la 5.214.
- **Une forme jamais reconnue** était relue sur chaque achat toutes les 3 h (12 lectures par période au banc) : une lecture de mesure par jour et par compte (`vrmSuiviMesure`), tant que CETTE version la dit « inconnue » (`vrmFormesSuivi.journey.ver === CODE_VERSION`), et une réponse inconnue n'est pas relue avant 24 h.
- **La liste blanche laissait passer** un nom dans le libellé (« Colis remis à Jeanne … », « remis à : M INVENTEE », « déposé par Marc … »), un code « est le 482913 », un code sous une clé d'état (`status: 'Code de retrait : 482913'` devenait le `code` de l'étape), et le nom d'un contact sous un parent « pickup ». ⇒ « remis à / déposé par / livré à » perdent la personne (« … », ce qui suit « au point relais » reste) ; « est (le|la) » reconnu ; un code d'étape n'est gardé que s'il a la forme d'un code machine (`SUIVI_CODE_MACHINE`) ; un parent qui nomme une personne (`SUIVI_PARENT_PERSONNE`) n'est jamais un transporteur ni un relais.
- **Non retenu, et pourquoi** : « (lu il y a N) » date le dernier CHANGEMENT, pas la dernière lecture — écrire l'heure de chaque lecture dans la ligne (`luAt`) coûterait une écriture par lecture (jusqu'à 6 par heure et par compte) pour un champ d'affichage. L'app dit « relevé le … » (dernier changement) ; ce n'est pas l'extension qui change.
- Preuves : `audit-suivi-vinted.cjs` **127 contrôles** (sections H à K neuves), **46 rouges** sur 1957c54 (le code relu, après la fusion et le numéro, §6.1 : l'audit copié dans l'arbre d'avant) ; **31 mutations sur 31** rouges (`--mutation ?` les liste), dont `cas` 3, `relais` 3, `cle-instant` 1, `futur` 2, `futur-route` 1, `chaine-suivi` 1, `chaine-notifs` 2, `chaine-formes` 1, `borne-24h` 1, `base-sans-date` 1, `escrow-remplace` 6, `budget` 3, `forme-inconnue` 1, `arrive` 1, `remis-a` 6, `code-machine` 2, `est-le` 2, `personne` 2. `audit-budget-lectures.cjs` section 7 (le suivi sous la réserve) : 8 rouges sur 1957c54 ; « suivi remis dans les prioritaires » 8 rouges, « classe suivi lue comme les photos » 2. ⚠️ Sur la base 743585d (5.213) le suivi n'existe pas : ses rouges ne prouvent rien.
- ⚠️ **Non mesuré** : la forme réelle des trois réponses (bloquées d'ici ; `panel_formes_suivi` la dira) ; le PATCH conditionnel sur `data->>rev` contre SA PostgREST (la grammaire de `modifierDonnee`, déjà en production) ; le délai réel entre une étape chez le transporteur et son affichage par Vinted.
- **Gestes de Julien** : installer la **5.216** (remplacer le dossier, puis ⟳ dans chaque Chrome), ouvrir une fois « Suivre le colis » d'un achat en route ; pour être prévenu, Réglages → Notifications → « Suivi du colis ».


### Statut chez le transporteur, tour 1 : les notifications (n° 12 à 21, 29 octobre)
Les dix défauts de notification reproduits le 24 octobre, chacun REPRODUIT d'abord
(faux PostgREST à état, faux Chronopost / Vinted Go / Web Push), corrigé à la racine.
- **Nouvelle arrivée (12)** : une arrivée = le point relais (lieu normalisé) + l'heure
  de l'évènement qui l'a créée (`occurrenceArrivee`) ; la ligne garde les 5 dernières
  (`arrivees`). Un autre point relais, ou le retour au relais après « a quitté le
  point relais », sonne sous `relais-{n°}-r{empreinte}` ; la PREMIÈRE arrivée garde
  `relais-{n°}-sans` et se tait devant toute annonce (`relais-{n°}-*`, `relais-tx{tx}-*`,
  le code de l'e-mail). Le même point relu ne re-sonne jamais (`clefEtat` porte le lieu
  seulement pour « disponible »).
- **« Pas su » ne consomme rien (13)** : `push_transp_{n°}` est RETIRÉ. Ce qui doit
  sonner est écrit DANS la ligne `transp_` (`notif` + le scalaire `notifEnAttente`, lu
  en `meta->>`) par le MÊME comparer-et-échanger que le changement ; la notification
  l'efface une fois faite ou décidée (déjà annoncée, préférence, abonnement), jamais
  sur un `push_dedup` illisible ou non écrit. Reprise en tête de passage
  (`reprendreNotifs`, 6 au plus), seulement dans les 72 h et pour le même état.
- **Une notification pour trois voies (14, 16)** : vérifier ET réserver en UN
  comparer-et-échanger sur `push_dedup` (`envoyerNotifTransp` : le modificateur relit
  les clés au moment d'écrire et abandonne si l'une est apparue). Clés partagées par
  transaction (`clesEtapeTx`) : transporteur `{retire|retour|track}-tx{tx}[-jour]`,
  suivi Vinted `vs-…` ; chacun vérifie celles de l'autre (`suivi-vinted.js`, étape 5 bis :
  `transporteur-deja`) ; l'e-mail `relais-{n°}-*` et `retrait-code-{CODE}` restent la
  frontière avec la route des e-mails.
- **Pause globale (15)** : `transp_pause` au propriétaire NEUTRE
  (`00000000-…`, `PROPRIETAIRE_NEUTRE`, clé de service) — un 403 de Chronopost arrête
  les requêtes de TOUS les vendeurs depuis l'adresse de Vercel ; plus une mémoire
  d'instance posée dans la file du transporteur au moment du refus et lue juste avant
  chaque requête (`pauseEnCours`, une règle pour les deux points d'arrêt). Une pause en
  cours ne monte pas d'un palier (`pauseApresRefus`).
- **Deux passages (17)** : un bail de 30 s sur la ligne (`enVol`, comparer-et-échanger)
  — un n° n'est lu que par un passage à la fois.
- **C4 (18, 19)** : la réponse relayée porte son heure (`at`, bornée à 30 min) ; plus
  vieille que la dernière lecture ⇒ 409 `perime`, rien n'est rangé ; un n° en
  « fermeture » se tait (`raisonDu`, la règle du serveur). Un état final (retiré, livré,
  rendu) ne redescend jamais sur une lecture plus ancienne (`ligneApresEssai`).
- **Bornes (20)** : un n° n'est lancé que s'il tient dans le budget (délai + écart +
  marge de rangement) ; `fin` et `signal` vont jusqu'à la requête ; le cron arrête le
  passage dès qu'il répond (`AbortController`, `finally`) — plus aucune écriture ni
  notification après la réponse « délai ».
- **72 h (21)** : `etatAt` = l'évènement qui CRÉE l'état (Chronopost : premier retour,
  ou rendu après lui ; Vinted Go : début de la phase de retour), `dernierAt` à part.
- Preuves : `audit-transp-notif.cjs` (N1-N10, ~50 s) **24 rouges sur 87188ff4** (§6.1,
  audit copié dans l'arbre d'avant), `--prouve` **17/17** ; `audit-statut-transporteurs`
  (`--prouve`, dont `notif-sans-push-dedup`, `notif-sans-reservation`, `pause-ignoree`
  réancrées) et `audit-mondialrelay-serveur` (`pause-ignoree`, `essai-compte-introuvable`
  réancrées sur la règle actuelle) verts ; bancs serveur, colis, retrait, widget,
  rappels, notifications verts.
- ⚠️ **Non mesuré** : aucun appel réel aux transporteurs ; `Retry-After` réel de
  Chronopost ; un vrai envoi Web Push. Une notification en attente d'un n° qu'aucun
  passage ne relit (vendeur sans app ni cron) attend le cron suivant (matin ou soir).



### Statut chez le transporteur, tour 2 : les 19 défauts des relecteurs (29 octobre, 5.290 — numéro de branche, remplacé par 5.291.0 à l'intégration du 30 oct.)
Relecture du chantier remis sur `main` (94f4d515) sur SA base (copie lecture seule) et
de bout en bout (vraies routes, vrai fond). Chaque défaut REPRODUIT, corrigé à la
racine, rouge sur 94f4d515 (§6.1 : audits et banc copiés dans l'arbre d'avant, build
refait là-bas), vert après, rouge sous mutation.
- **Publication `vrm_colis_retirer` (1)** : elle n'est écrite que quand les codes des
  conversations (`colisRelaisLu`), les n° des achats (`suivisVinted`) et les n° ajoutés
  (`suivisManuels`) sont LUS. Rendue depuis Colis (qui ne les lit pas), elle passait de
  22 à 38 « complet » : les achats « en vérification » et les colis fondus par n° y
  revenaient. Pas lu ⇒ rien n'est écrit (la dernière photo complète reste).
- **Code postal Mondial Relay (2)** : un code refusé par un ESSAI alors qu'il reste un
  code prouvé à essayer ⇒ `cpCherche` (calculé au rangement par
  `codePostalPourMondialRelay`, la règle du passage) ⇒ « VRM cherche le code postal du
  point relais », sans geste. Le geste (« ajoute ce n° avec son code postal ») n'est dit
  qu'une fois en tête (`texteCodePostalMr`), seulement quand plus rien n'est à essayer.
- **Ordre de lecture (3)** : `ordreAInterroger` — page demandée, puis les DISPONIBLES
  par limite la plus proche puis arrivée la plus ancienne, puis les autres actifs, puis
  les anciens n° ; les places du passage se réservent PAR TRANSPORTEUR dans cet ordre
  (`placesParTransporteur`) : le colis du « dernier jour » n'attend plus derrière de
  vieux n° Chronopost.
- **Une voix (4, 6)** : le bloc « en cours de vérification » ne promet plus rien de
  l'extension (le geste vit dans « Suivi Vinted », gardé par `extSait`). Une carte « à
  retirer » dont le transporteur confirme « disponible » (même limite) ne garde qu'une
  marque courte (« Confirmé chez Chronopost il y a 3 min », `court`) ; une étape Vinted
  plus ancienne que l'évènement du transporteur ne s'affiche plus sous lui
  (`nouvelleDepassee`).
- **N° sans transporteur (5)** : un n° du suivi Vinted sans transporteur rangé ⇒ la
  carte dit « Transporteur pas encore connu » (jamais rien) ; avec « Vinted Go » rangé
  (nom ou code), il est lu chez Vinted Go. Jamais deviné par la forme. (L'extension qui
  range le transporteur courant de `journey_summary` : `v29-colis-ext`.)
- **« À vérifier » relus par le widget (7)** : la publication porte `verif` (même forme
  que `colis`) ; `retirerPublie` les relit par la même règle (`sorti`).
- **Achats → « Reçus 1,7 k » (8)** : `nowrap`, et au-delà de 999 « 1,7 k » (le nombre
  exact en infobulle et dans `data-n`).
- **Version (9)** : 5.281 à 5.286 publiées par `main` avec un autre contenu ⇒ **5.290.0**
  (5.287 à 5.289 prises ou réservées) : manifeste, `CODE_VERSION`, `CAPTEUR_VERSION`,
  `relaisVersion`, `EXT_ATTENDUE`, `EXT_CAPACITES.transp`, notice Orion, zips.
- **Une forme des deux côtés (10)** : Vinted Go à 12 chiffres et Chronopost à 14
  caractères acceptés par l'extension comme par le serveur ; les adresses permises en
  DÉRIVENT. `audit-transp-ext` : tout n° que C3 annonce est lu.
- **C4 Mondial Relay de bout en bout (11)** : la route accepte un corps jusqu'à
  `CORPS_MAX_MR` (192 Ko) pour Mondial Relay (`corpsMaxDe`), 64 Ko pour les autres ;
  l'extension ne compte `transp_lu_*` que si le serveur a jugé `ok` (sinon
  `transp_relaye_{res}_*`). La borne d'ENVOI de l'extension à 192 Ko : `v29-colis-ext`.
- **L'extension dit ce qu'elle ne peut pas (12)** : `TeteTransporteurs` lit `nav.indispo`
  de l'état du pont — `transporteurs` ⇒ le geste « Autoriser » ; `transporteurs-passu` ⇒
  aucune promesse ; sinon « l'extension de ce Chrome les lit à la place ».
- **`audit-extension-zip` (13)** : l'historique se lit par `VRM_GIT` puis la racine ;
  illisible ⇒ ROUGE (il sortait vert « sans conclusion » depuis une copie §6.1).
- **Une borne n'est pas une arrivée, partout (14)** : `arriveesDeLigne` (sûre ⇒ arrivée ;
  « TR : », rappel, sujet inconnu ⇒ borne) dans `sortiParSuivi` / `incidentDeLigne`
  (app : Achats, Ma journée, colis de l'équipe, compteur de la coque), le rappel du
  matin et le widget — les trois disent le même nombre.
- **E-mail et transporteur en même temps (15)** : `shouldNotify` (email-inbound) vérifie
  ET réserve en un `modifierCas('push_dedup')` (garde `rev`, relit au moment d'écrire) :
  plus de double « retiré », plus de clé du transporteur effacée.
- **Suivi Vinted « disponible » (16)** : les alias `relais-tx{tx}-sans` / `relais-{n°}-sans`
  vérifiés et posés en UN comparer-et-échanger AVANT l'envoi.
- **Mondial Relay `_mvc` puis `.be` (17)** : une arrivée qui ne fait que s'enrichir (lieu
  vide → connu) n'est pas un changement (`etatAChange`), et deux occurrences à la même
  minute sont la même (`memeOccurrence`).
- **Ancien n° dont la 1re lecture rate (18)** : relu à son recul tant qu'aucune lecture
  n'a réussi (`jamaisLueAvecSucces`, 5 essais au plus), en silence (`raisonDu`).
- **N° Chronopost dans un e-mail shipping@ (19)** : une forme Chronopost stricte n'est
  jamais lue chez Vinted Go (`carrierLisible`) ; un transporteur NOMMÉ l'emporte sur le
  « vinted » par défaut (`carrierPrefere`), quel que soit l'ordre des lignes.
- Preuves : `audit-statut-transporteurs` §10 (**12 rouges sur 94f4d515**, `--prouve`
  57/57) ; `audit-transp-notif` N11-N14 (**7 rouges**, `--prouve` 22/22 — `change-sans-lieu`
  réancrée sur `etatAChange`) ; `audit-transp-ext` (**2 rouges**, 13/13, dont
  `lu-sans-jugement`) ; `audit-extension-zip` (rouge depuis une copie ; l'ancien y était
  vert « sans conclusion ») ; banc `transporteurs` §A + §F (**15 rouges sur le build de
  94f4d515**) et `node scripts/prouve-banc-transporteurs.cjs` : 9 mutations de l'app de
  plus (publication sans lecture, promesse, n° sans transporteur, carte qui redit tout,
  étape Vinted dépassée, `verif` absent, onglet coupé, `nav` ignoré, geste du code
  postal absent), chacune rouge sur SON contrôle.
- ⚠️ **Deux faux PostgREST servaient une forme que le code ne lit plus (§6.3)** :
  `audit-suivi-colis` et `audit-retrait-fiable` rendaient un POST
  `return=representation` VIDE (et aucun PATCH conditionnel) — le comparer-et-échanger
  de `shouldNotify` (n° 15) y lisait « créé entre-temps », relisait ses propres clés et
  se taisait. Ils rendent les lignes vraiment écrites et honorent `data->>rev`.
  `audit-retrait-fiable` et `audit-suivi-colis` : deux ancres de mutation périmées chacun
  (déjà sur 94f4d515) suivies jusqu'au code actuel (`--prouve` 29/29 et 30/30). Banc `suivi-colis` K : `panel_colis_relais`
  illisible ⇒ **aucune** publication (avant : une publication à `finis: null`).
- Rouges restants, tous déjà rouges sur `main` ou sur 94f4d515 : `audit-politique-hotes`
  (1), `audit-preuve-vente` (18), banc `journee-widgets` (8, mêmes contrôles sur le build
  de 94f4d515).
- ⚠️ **Non mesuré** : aucun appel réel aux transporteurs (formes de `mesures.json`) ;
  rien lu en production pour ce tour ; la vraie forme de `nav.indispo` sur un Firefox
  réel.
