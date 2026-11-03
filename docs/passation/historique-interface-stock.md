# Historique — interface-stock

> Texte déplacé TEL QUEL depuis `CLAUDE.md` le 31 octobre 2026 (allègement du dossier : 1,36 Mo → moins de 60 Ko).
> Rien n'a été réécrit : les paragraphes gardent leur ordre d'origine. Le classement par thème est automatique (mots du titre) — en cas de doute, chercher par `grep` dans tous les `docs/passation/historique-*.md`.

> **28 octobre (nuit, fin) — « de brouillon à en ligne ça marche pas » (5.265) :** mesuré sur l'Air Max 1 refaite à 20:25 :
> brouillon rangé, puis la mise en ligne refusée pour les PHOTOS (`refaire_mise_en_ligne_refusee_400`,
> `vinted_refus_champs_photos`) — des photos neuves en JPEG, acceptées par le brouillon. Cause NON mesurée.
> `completionSecoursPhotos` (Republier, Refaire, Brouillons → en ligne) : attente, nouvel essai avec la forme courte des photos
> (`{id, orientation:0}`, celle des brouillons du navigateur) ; toujours refusé ⇒ photos renvoyées, dernier essai ; le texte exact
> du refus est gardé (`rates.vinted_refus_photos`) pour la passe suivante. Preuve : `audit-recreer.cjs` (110 ; 9 rouges sur la 5.264).

> **28 octobre (nuit, fin) — plus LENT et AU HASARD, et le brouillon disparu (5.263) :** Julien : « la création du
> brouillon a l'air très très rapide, va beaucoup plus doucement pour pas que je me fasse bannir » puis « il doit être
> aléatoire ton comportement ». C'est SA décision (atelier §3, il lance). `pauseRepub` : une pause TIRÉE AU HASARD
> entre deux photos (3–9 s), avant le brouillon ou la création (6–15 s), avant la mise en ligne (15–40 s, était 5 s
> fixe), avant de retenter (8–20 s). Garde-fous inchangés (20 actions/h, file, pause Vinted). L'app attend 8 min
> (republier, refaire) et 6 min (brouillon → en ligne). Et « Brouillons à refaire » disait « rien à refaire » : il avait
> cliqué « C'est réglé » sur la N°72 — une ligne réglée reste joignable (« Le remettre dans la liste »). Le brouillon
> 10574536209 n'est plus dans son dressing (lu complet à 19 h 22, après le passage) : `refaireBrouillon` en refait un
> NEUF depuis le coffre quand une lecture COMPLÈTE du dressing faite APRÈS le passage ne le montre plus (pas su ⇒ comme
> avant). Preuves : `audit-recreer.cjs` (103 ; 3 rouges sur la 5.262), banc `republier.cjs` (« Le remettre »).
> ⚠️ Le contrôle « Noir — publier » du banc `republier` est tombé deux fois sans se reproduire (instable, à surveiller).

> **28 octobre (nuit, fin) — « Erreur lors du chargement de la photo » (5.262) :** Julien, Jordan 3 (brouillon
> 10574927717) : « Vinted a refusé la mise en ligne (400 : Erreurs trouvées — les photos (Erreur lors du chargement de
> la photo…)) ». Cause : `photoReglee` rendait l'ORIGINAL quand les réglages étaient neutres — souvent un WEBP (forme
> `/f800/…webp` du coffre) envoyé sous le nom `photo-N.jpg` ; Vinted le prend puis refuse la mise en ligne. ⇒ un vrai
> JPEG part toujours (réencodé si besoin). Et `publierBrouillon`, sur un refus qui porte sur les PHOTOS d'un brouillon
> fait par VRM (`photosRefusees`), renvoie les photos du coffre de l'ancienne annonce (`photosNeuvesBrouillon`, une par
> photo, ses réglages), remplace celles du brouillon et réessaie UNE fois ; pas de photo dans VRM ⇒ dit, avec le geste
> Vinted. Les brouillons N°2 et N°72 se mettent donc en ligne par « Brouillons → en ligne ». Preuve :
> `audit-recreer.cjs` (99 ; 3 rouges sur la 5.261). ⚠️ Non mesuré : que Vinted accepte les photos renvoyées dans un
> brouillon existant (même `upload_session_id`).

> **28 octobre (nuit, fin) — le nombre max sur les ANCIENS MEUBLES :** « fais pareil pour les anciens meubles ».
> Grille de boîtes, commode, étagère d'avant, casiers, armoire (physique « colonne ») : une boîte par case
> (`capaciteCase`) ⇒ une plaque « max 1 » en façade, en haut de chaque case, taille dans la pièce. Sonde
> `maxCases`. Banc `stock-finitions.cjs` XV (+3 par taille ; plaques retirées ⇒ 6 rouges).

> **28 octobre (nuit, fin) — le nombre max sur les ÉTAGÈRES À BACS :** « fais pareil pour les étagères à bacs ».
> Une plaque « max 1 » en façade, en haut de chaque case (un bac par case), taille dans la pièce ; pas sur une case
> sans plateau dessous (son bac tomberait). Sonde `maxCases`. Banc `stock-finitions.cjs` XII (+2 par taille ; plaques
> retirées ⇒ 4 rouges).

> **28 octobre (nuit, fin) — le nombre max sur les PORTANTS :** « fais pareil pour les portants ». Un cintre porte UN
> vêtement : la plaque « max N » est par BARRE (N = ses cintres où la barre existe), au-dessus de la barre, en façade,
> taille dans la pièce ; barre raccourcie ⇒ N baisse ; barre absente partout ⇒ pas de plaque. Sonde `maxCases`
> (`barre_r`). Banc `stock-finitions.cjs` XI (+2 par taille ; plaques retirées ⇒ 5 rouges).

> **28 octobre (nuit, fin) — le nombre max sur les TABLES aussi :** « fais pareil pour les tables ». Dessus : la plaque
> flotte au-dessus de la plus haute pile possible (comme une pile au sol) ; sous la table : en façade, en haut de chaque
> niveau. Même règle que les étagères (`cap`, pas de plaque sans plateau dessous). Banc `stock-finitions.cjs` X (+3 par
> taille ; table exclue ⇒ 6 rouges).

> **28 octobre (nuit, fin) — le nombre max dans chaque case des ÉTAGÈRES :** Julien : « fais pareil pour les étagères ».
> Étagère métal et bois : une plaque « max N » en façade, en haut de chaque case (N = la capacité de la case, la règle du
> rangement), à taille DANS la pièce (une plaque par case : à taille fixe à l'écran elles couvriraient le meuble vu de
> loin — lisibles en s'approchant). Pas sur une case sans plateau dessous (elle ne tient rien), ni sur une table ou des
> bacs (1). Sonde `maxCases`. Banc `stock-finitions.cjs` IX et XIII (+3 par taille ; plaques retirées ⇒ 4 rouges).

> **28 octobre (nuit, fin) — le NOMBRE max au-dessus de chaque pile :** Julien : « affiche le nombre max au-dessus
> de chaque pile ». `buildPile` pose, au-dessus du couvercle, une plaque « max N » (`plaqueMaxPile`, sprite à taille
> FIXE à l'écran — `sizeAttenuation: false` —, encre sombre, décor seul, raycast vide). Sonde `hauteursMax` rend
> `texte` et `texteY`. Banc `stock-finitions.cjs` XIV (+2 par taille ; plaque retirée ⇒ rouge).

> **28 octobre (nuit, fin) — la HAUTEUR MAX de chaque pile en 3D :** Julien : « montre la hauteur max de chaque pile
> en 3D ». `buildPile` (Room3D) dessine, par pile, un cadre fin gris ardoise jusqu'à `hauteurPile(rows, hauteurs, c)` (la
> règle du réglage, §11) et un couvercle pâle au sommet — décor seul (raycast vide, aucune couleur d'accent). Sonde
> `hauteursMax`. Banc `stock-finitions.cjs` XIV (+4 ; cadre qui ignore `hauteurs` ⇒ 2 rouges).

> **28 octobre (nuit, fin) — l'étagère EN BOIS, et « fais pour tout » :** l'étagère bois (`build: 'metal'`, `bois`)
> avait déjà les plateaux réglables (IX) ; le banc `stock-finitions.cjs` XIII le prouve sur elle (plateau de bois
> dessiné en morceaux, la boîte descend). Tous les meubles à étages de la palette l'ont donc : métal, bois, bacs,
> portant, table. Pas les « Boîtes au sol » (aucun plateau) ni les anciens types cachés (grille, commode, étagère
> d'avant, casiers, armoire : physique « colonne », toute la colonne tombe déjà — y poser des plateaux changerait
> la physique de sa pièce réelle sans qu'il l'ait demandé).

> **28 octobre (nuit, fin) — les PLATEAUX de la pièce 3D, colonne par colonne :** Julien : « fais pareil pour les
> planches de la vue 3D ». Étagère métal ou bois (pas à bacs, pas la table) : `it.planches`, même forme que « Mes
> meubles » (règle déplacée dans `src/stockRegles.js` : `planchesCases`, `planchesRangees`, `plateauxMeuble`,
> `tasserPlateaux`). ABSENT ⇒ tous les plateaux (comme avant). Sans plateau sous une case, ses boîtes tombent dans la
> case du dessous tant qu'elle a de la place (`graviteCases(…, it)`, et `updateItem` tasse toute écriture) ; aucune
> boîte perdue, aucun numéro changé. Réglage : Aménager → toucher l'étagère → « Plateaux, colonne par colonne »
> (`ChoixPlanches plateau`, le même dessin que « Mes meubles »). La 3D dessine les morceaux (`buildMetal`, sonde
> `plateaux`) et ne montre plus de place libre au-dessus d'un plateau qui manque. Ajouter un niveau (en haut) décale
> les plateaux réglés. Banc `stock-finitions.cjs` IX (390/1512 ; `tasserPlateaux` neutralisé ⇒ 4 rouges).

> **28 octobre (nuit) — les PLANCHES et les articles EMPILÉS (Stock → Mes meubles) :** Julien : « quand on enlève un
> article, ceux du dessus descendent — il faut pouvoir faire des barres », puis « pas imaginaires justement ». Les
> planches sont celles de son vrai meuble, DESSINÉES (`data-planche`) : dans l'éditeur, toucher entre deux rangées pose
> ou enlève une planche (`m.planches` = rangées sous lesquelles il y en a une ; le bas du meuble en est une), « Une à
> chaque rangée » / « Aucune ». Case « Articles empilés » (`m.gravite`, éteinte par défaut) : `tasserMeuble` — dans
> chaque colonne, entre deux planches, les articles posent sur celui du dessous ; retirer, sortir, déplacer ou poser
> dans une case du haut passe par elle (`ecrireSlots`), le N° ne change jamais, seule la case. L'article qui descend
> glisse (`vrm-case-tombe`, rien si « réduire les animations »). Changer le nombre de colonnes garde rangée et colonne
> de chaque paire. Banc `stock-planches.cjs` (390/1512 ; mutation « planches ignorées » ⇒ 6 rouges).

> **28 octobre (soir) — Stock sans shop_cancale, et vue « de loin » :** Julien : « je veux pas les annonces de shop
> cancale » et « la vue d'un peu plus loin ». `comptesStockEcartes` (Mes meubles ET En photos) écarte une fiche dont
> le compte (`accountId`) est masqué, retiré pour de bon, ou n'est plus LIÉ (`vinted_accounts` de l'appareil ; liste
> vide ⇒ seulement masqués/retirés ; fiche sans compte ⇒ gardée). Rien n'est effacé ; c'est dit une fois
> (`data-stock-ecartes`). Taille des cases « De loin » (64 px, défaut) · « Normale » (100) · « De près » (150),
> mémorisée sur l'appareil (`vrm_meubles_zoom`) ; de loin et normale, les meubles se rangent côte à côte. Banc
> `stock-retrouver.cjs` (compte supprimé jamais montré ; de loin par défaut, « De près » agrandit).

> **28 octobre (nuit) — UN bouton « Actions », et seulement les brouillons qui sont sur Vinted (5.252) :** Julien :
> « un bouton Actions dans lequel on a republier, mettre de brouillon à en ligne, de en ligne à brouillon… » puis
> « l'extension capte un ancien brouillon, je veux les brouillons qui sont sur Vinted ». Annonces → **Actions** (un
> seul bouton, `data-actions-ouvrir`, menu `data-actions-menu`) : **Republier** (supprimer et recréer, inchangé) ·
> **Modifier prix ou titre** sur place (`republierVinted`, PUT mesuré, favoris gardés) · **Brouillons → en ligne** à
> la suite, temps fixe ou aléatoire (`publierBrouillon`, seuls les brouillons PRÊTS se cochent) · **En ligne →
> brouillon** (`recreerVinted` + `versBrouillon` : brouillon rangé, son id lu, PUIS l'annonce supprimée ; jamais de
> mise en ligne ; suppression sans réponse ⇒ « peut-être encore en ligne ») · **Voir mes brouillons**. Les quatre files
> = UN composant (`RepublierVinted`, prop `action`, `ACTIONS_REPUB`). La liste des brouillons (`useBrouillonsVinted`,
> §11) : ceux du DRESSING de son compte, datés de cette lecture (« vu sur Vinted il y a 3 h » ; supprimé après la
> lecture ⇒ retiré), + ceux que l'extension a vu enregistrer APRÈS cette lecture ; « Plus sur Vinted » le retire de la
> liste (`vrm_brouillons_ecartes`, synchronisé) jusqu'à ce qu'une lecture PLUS RÉCENTE de son dressing le montre
> encore. Mesuré : le brouillon « Air Max 1 dark teal » (tomj, 3171228253) est bien `is_draft` dans le dressing lu le
> 28 à 11 h — s'il n'est plus sur Vinted, le geste est « Plus sur Vinted » ou rouvrir ce compte sur vinted.fr.
> Preuves : `audit-recreer.cjs` P (56 ; 6 rouges sur la 5.251), banc `republier.cjs` (menu, 3 gestes, « plus sur
> Vinted »). `audit-commandes.cjs` rouge déjà sur main (App.jsx, Stock), pas ce chantier.

> **28 octobre (après-midi) — Republier : photos PAR annonce, temps montrés avant, lettre en bas (5.250) :**
> Julien : « je sélectionne 3 annonces, je modifie toutes les photos des 3 pour qu'elles ne soient pas similaires,
> avec un visuel ; je choisis le temps (aléatoire, 1,23 puis 1,56…) » puis « la même description, absolument tout ;
> une lettre aléatoire tout en bas de chaque annonce ». Étape « 2. Modifier » — RECTIFIÉ le même jour par lui :
> « le réglage que j'applique s'applique à toutes celles que j'ai sélectionnées, toutes les photos de chaque annonce ;
> on ne voit qu'une photo pour éviter que ça encombre l'écran » ⇒ UN réglage pour toutes les photos de toutes les
> annonces choisies, une seule photo (la couverture) par annonce à l'écran, avec « N photos ». Plus de réglage par
> annonce ni de « Varier » (retirés — ne pas les remettre).
> Étape 3 : les temps aléatoires sont TIRÉS avant de lancer et écrits sur chaque ligne (« tout de suite », « +1 min
> 23 s »), « Tirer d'autres temps » ; le moteur suit le temps montré. Description : reprise mot pour mot ; option
> « lettre au hasard tout en bas » (extension 5.250, `msg.lettre`, `EXT_CAPACITES.lettre`) : « \n\n<lettre> » en fin,
> la lettre d'une recréation précédente (`coffre.lettreVRM`) retirée d'abord — jamais d'empilement. (Le brouillon puis
> publier : fait le 28 au soir, voir au-dessus.) Preuves : `audit-recreer.cjs` J (2 rouges sur la 5.249), banc
> `republier.cjs` (rouge sur le build de main).

> **28 octobre — « Republier » sur Vinted, un seul parcours (5.247) :** Julien : « les republications sont
> très bizarres… je veux un bouton républier, la liste de toutes mes paires en ligne, je sélectionne, j'applique
> les modifications et l'annonce se republie ». Cause : « Lots » rangeait des brouillons que la « File » ignorait
> (elle ne faisait qu'une baisse en %). Désormais Annonces → **Republier** (`RepublierVinted`) : choisir les
> paires en ligne → prix (%, fixe, commun, arrondi, terminaison, jamais sous le prix d'achat) et titre
> (préfixe/suffixe/remplacer/supprimer) avec aperçu par paire → case de confirmation → envoi une par une
> (espacement, pause, arrêt), chaque paire dit « republiée » ou « pas faite » + la raison de l'extension. Le prix
> et le titre EXACTS partent (`republierVinted` + `corpsAvecPrixBaisse(…, voulu)`), toujours un `PUT` EN PLACE
> (même annonce, même N°, rien supprimé — §3). « ✨ Préparer », « Lots », « File » ne sont plus proposés
> (composants gardés, injoignables). `EXT_CAPACITES.republiermodif = '5.247.0'`. Preuve : banc `republier.cjs`
> (8 rouges sur l'avant). ⚠️ Exige Chrome sur le bon compte, une sauvegarde coffre et le format de CETTE annonce
> appris (une modification à la main sur Vinted d'abord) ; sinon « pas faite » et la raison.

> **27 octobre (soir) — boutons et disposition revus, couleurs GARDÉES, animation de connexion :**
> Julien : « je veux juste que les boutons, les dispositions soient modifiés… j'aimais bien
> celle d'avant un peu vert » — une palette violette essayée puis REFUSÉE : ne pas la
> reproposer, la palette Perle (pétrole et sauge, `src/themeMineral.js`) reste. 
> `src/styles-disposition.css` (chargé en dernier, aucune teinte neuve, que des variables) :
> grands titres serrés, cartes à 18 px, boutons à 12 px qui s'enfoncent, les 4 compteurs de
> Ma journée en tuiles séparées, trait sur l'écran actif du rail ; et corrige « 0 vente »
> écrit une lettre par ligne sur téléphone quand les ventes sont illisibles. Connexion
> (`AuthScreen`) : aurore de trois halos qui dérivent, étiquettes flottantes décoratives
> (≥ 1200 px, aucun chiffre), entrée en cascade ; rien si « réduire les animations ».
> Verts : journee-widgets, journee-premium, coque-mobile, formes-communes, tdz, csp.

> **27 octobre (soir) — l'ARRIVÉE guidée et le MOUVEMENT :** Julien : « univers personnalisable en un clic,
> avec une voix, une démonstration » et « des effets entre les pages ». `src/Bienvenue.jsx` : pour un compte
> neuf (`premierJour`, après le nuage), une fois — univers Clair/Nuit en un clic (`vinted_dark`), cinq écrans
> de démonstration marqués « exemple », lus à voix haute sur demande (`speechSynthesis` du navigateur, fr-FR,
> gratuit ; la fin de la lecture passe à l'écran suivant ; pas de voix ⇒ pas de bouton), puis « Commencer »
> (Ma journée et ses premiers pas). Jamais le statut fiscal ni une plateforme imposés. Vue ⇒ `vrm_bienvenue_vue`
> (SYNC_KEYS) ; Réglages ne la propose plus (retirée le 27 oct., sa demande). `_porte-banc.cjs`
> la marque vue pour les autres bancs (sauf `vrm_banc_bienvenue`). Mouvement (`styles-mouvement.css`) : entrée
> en fondu de 220 ms à chaque écran (classe rejouée sur `<main>`, rien remonté, animation sans remplissage),
> boutons qui s'enfoncent, rien avec « réduire les animations ». Banc `bienvenue.cjs` (22 contrôles, 390/1512 ;
> rouge sur main ; mutation « sans styles-mouvement » ⇒ 2 rouges). ⚠️ Non mesuré : la voix réelle d'un iPhone.

> **27 octobre (soir) — les ANNONCES en fiches produit, la photo en grand :** Julien : « les annonces sont
> beaucoup trop petites, on ne voit même pas la première photo… on est obligé d'appuyer dessus — fais ça
> comme les pros ». Décision du 26 (« compacte ») RENVERSÉE : chaque annonce est une fiche (première photo
> 4:5 sur toute la largeur, « Boostée » posé dessus, titre, prix + N°, état + logos, achat · mini · refus ·
> Préparer, vues/favoris/âge, « Gérer l'annonce » en bas) ; grille de fiches sur ordinateur, deux par rangée
> au téléphone ; une fiche dépliée prend toute la largeur. `src/styles-annonces-pro.css` chargé EN DERNIER
> (aucun JSX touché, tous les `data-*` gardés) ; entrée en fondu décalé, soulèvement au survol (souris
> seule), rien si « réduire les animations ». Cibles 44 px gardées. Bancs : `annonces-carte` (fiches côte à
> côte, photo pleine largeur), `annonces-ventes-brouillon` (photo ≥ 180 px, 1ʳᵉ annonce ≤ 680 px : 4 rouges
> sur main — 84 px, 685/707 —, vert après), `plateformes-premium` vert.

> **26 octobre — Stock : un assistant, et tout au pavé numérique :** Julien : « le stock 3D n'est
> pas pratique, ne fait pas gagner de temps ; pas d'agent pour créer la pièce et gérer le
> rangement » et « la plupart utilisent un ordi avec un pavé numérique ». Assistant À RÈGLES
> (aucune IA, rien de payant), qui PROPOSE et attend un « oui », ne touche jamais un numéro :
> « Créer ma pièce en 3 questions » (taille, meuble, nombre d'articles → `proposerPiece`,
> src/stockRegles.js : rangées le dos aux murs, allée de 1 m, porte et passage libres ; ce qui
> ne tient pas est dit ; pièce déjà meublée ⇒ une NOUVELLE pièce) ; « Tout ranger » (Ma pièce et
> Liste des cases : `proposerToutRanger`, dans l'ordre des N°, la place la plus basse d'abord,
> les N° qui se suivent ensemble). Au clavier (ordinateur) : un chiffre tapé n'importe où sur
> le Stock ouvre la saisie, N° + Entrée ⇒ déjà rangé : montré ; à ranger : posé à la prochaine
> place libre ; hors stock : jamais rangé ; Échap le ressort. Verr Num éteint compris (le pavé
> envoie « Clear » : on lit `e.code` `Numpad5`). La carte « pièce vide » passe AU-DESSUS de la
> 3D (sur téléphone elle était hors écran) ; feuilles en portail. Banc `stock-assistant.cjs`,
> audit `audit-stock-plan.cjs` (+ 3 mutations).

> **26 octobre — Annonces et Ventes « trop brouillon » (avis d'un ami de Julien) :** dans
> l'espace Vinted, plus de second titre (« Ventes », « Vos ventes », « Annonces en ligne »), ni
> « Annonces de N comptes » sous le sélecteur (sauf connexion refusée) ; « À faire aujourd'hui »
> tient sur une ligne ; « Retirer mon argent » se tait sans argent ; « Bordereaux auto » et « Mes
> vues » dans « ⋯ Outils » à toutes les tailles. Une vente dit sa date et son compte
> (`LigneVenteCompacte sous`) et « À expédier » est en ambre (`data-ton="action"`). Une annonce :
> état + logos sur une ligne (taille seulement si absente du titre, `tailleDansTitre`), vues et âge
> à côté de l'achat, « ⋯ » dans la carte. Mise en page finale de ces deux listes :
> `src/styles-annonces-ventes.css`, chargé EN DERNIER. Banc `annonces-ventes-brouillon.cjs`
> (16 rouges sur main, vert après ; CSS et ton retirés ⇒ 5 rouges). Première vente 844 → 609 px
> (ordinateur), une annonce 159 → 105 px.

> **25 octobre — VRM Capture 1.0.0 indépendant :** source
> `vrm-capture-extension/`, bouton directement visible, sans connexion ni moteur
> VRM. Archives dédiées Chrome et Orion, stockage et indicateur distincts.
> Voir `docs/passation/2026-10-25-extension-capture-independante.md`.

> **25 octobre — Orion iPhone/iPad :** paquet d’import dédié MV2, fond non
> persistant, compat API et chargeur de page. XPI + ZIP identiques et notice
> dans public/. Aucun changement du moteur Chrome 5.222.
> Tests et validateur verts, mais installation Orion/iOS réelle non exécutée.
> Voir `docs/passation/2026-10-25-orion-iphone-ipad.md`.

### L'écran Ventes : 287 cartes, et la frappe qui saccade
**Mesuré le 7 septembre au banc `perfv.cjs`, sur ses vraies données** : l'écran
rend **287 cartes et 8 840 nœuds** d'un coup (page de 19 885 px sur ordinateur,
**46 209 px sur iPhone**). Chaque lettre tapée dans la recherche les refiltrait
toutes : **293 ms par frappe sur ordinateur, 179 sur téléphone** — taper
« salomon » coûtait deux secondes de saccade.
`React.useDeferredValue(ordSearch)` garde le champ instantané et laisse React
refiltrer juste après → **~150 ms**, et le changement de filtre passe de 334 à
~155 ms. Aucun changement de comportement.
- Les **286 photos sont déjà toutes en `loading="lazy"`** — vérifié, ce n'était
  pas là que ça coûtait.
- **La liste ne dessine plus que 60 cartes** (`ventesAffichees.slice(0, ventesMax)`),
  le reste s'ouvre au bouton **« Voir plus — 60 affichées sur 287 »** : le total
  est écrit dessus, rien n'est caché, et **les totaux du haut portent toujours
  sur l'ensemble** (vérifié au banc : 6 695 € / 224 ventes, identiques avant et
  après avoir déplié). Une recherche ou un changement de filtre remet la tranche
  à 60. Mesuré : **8 840 → 2 194 nœuds**, iPhone **46 209 → 11 577 px**, frappe
  ~150 → **~88 ms**.
- La chaîne de filtres vivait **en plein milieu du JSX** : impossible de savoir
  combien de ventes elle rendait sans la recopier. Elle est dans un `useMemo`
  (§11 : une seule règle, un seul propriétaire).
- `perfv.cjs` garde des planchers (frappe < 250 ms, filtre < 300 ms, zéro image
  non paresseuse) aux deux tailles, et vérifie que « Voir plus » ouvre bien la
  suite sans changer les totaux.
  ⚠️ **Piège du banc** : ses mesures de frappe tapent « salomon » et cliquent un
  filtre — la liste tombe à six cartes et le bouton disparaît légitimement. Il
  faut **remettre l'écran à zéro** avant de vérifier la pagination, sinon le
  banc mesure son absence comme un défaut.


### L'écran Achats : même tranche, et un piège TDZ payé cash
Onglet « Tous », mesuré au banc : **72 880 px de page sur iPhone** — quatre-vingt-six
écrans — pour **544 commandes rendues d'un coup**. Même traitement que les
ventes : `achatsAffiches` dans un `useMemo`, 60 cartes dessinées, bouton
**« Voir plus — 60 affichés sur 534 »**. Mesuré : **8 844 → 1 261 nœuds**,
**72 880 → 9 415 px**, recherche 227 → **69 ms**.
- Le prix s'écrivait **à l'anglaise** (« 21.0 € », « 6.73 € ») : le montant brut
  de Vinted recopié tel quel. Deux décimales et une virgule.
- ⚠️ **§4.6 payé cash** : posé trop haut, ce `useMemo` s'exécute avant
  `trackForBuy`/`achatStage` → **« Cannot access 'Xc' before initialization »**,
  écran Achats mort. Il vit après `achatStage`.
- ⚠️⚠️ **ET LE BANC N'A RIEN VU** : le garde-fou d'écran affiche un vrai texte,
  sans débordement et sans `pageerror` (React attrape l'exception) — donc
  « aucun écran vide », « aucune erreur d'app », **rendu conforme**. C'est la
  CAPTURE qui l'a vu. `verif_visuel.cjs` teste désormais la présence de
  « n'a pas pu s'afficher / Cannot access / is not defined ».


### Le mode sombre s'arrêtait aux composants
Mesuré le 9 septembre, app **en sombre** : les cartes étaient bien à
`rgb(26,31,39)` … et **`document.body` à `rgb(246,247,249)`**, le gris clair.
Cause : `index.html` ne gérait le sombre que par **`prefers-color-scheme`**,
c'est-à-dire la préférence du **système** — alors que le mode sombre de VRM est
un **choix** rangé dans `vinted_dark` (§7 : « mode sombre choisi, pas inversé
automatiquement »). `C` était bien remplacé pour React ; le **document**, lui,
restait clair. Téléphone en clair + app en sombre, et il obtenait :
- une **barre d'état blanc cassé** au-dessus d'une app noire (`theme-color`
  valait `#F6F7F9`) — sur l'iPhone où il l'a ajoutée à l'écran d'accueil ;
- un **éclair de gris clair au rebond de défilement** : iOS peint le fond du
  BODY quand on tire au-delà de la page ;
- des **champs natifs en clair** (`color-scheme` n'était posé nulle part) — la
  date d'« Import des emails » sortait en boîte blanche dans l'app sombre.

⇒ Le thème est **estampillé sur la racine** (`data-theme`), par un script de
démarrage d'`index.html` **avant le premier rendu** (sinon l'app s'affiche en
clair puis bascule) et tenu à jour par un effet au clic. Les deux lisent
`vinted_dark` : une seule source (§11).
⚠️ Le média utilisait `#0E1116` alors que `THEMES.dark.bg` vaut `#11151B` — une
**troisième** valeur de fond sombre traînait dans le projet. Une seule reste.
⚠️ Le banc `verif_dark.cjs` mesure la **luminance**, pas une chaîne : comparer à
« #11151B » serait vert le jour où la palette change de teinte. Ce qui doit
rester vrai : le fond du document est sombre, la barre d'état suit, les champs
natifs suivent, et la **hiérarchie rail < page < carte** tient (0,0029 <
0,0073 < 0,0135). **8 échecs** sur le code d'avant (4 contrôles × 2 tailles).


### « Les annonces que l'on sélectionne » — le cross-posting part d'un CHOIX
Demande de Julien, 11 septembre : « lorsqu'une annonce est publiée sur n'importe
quel compte associé à VRM, je veux que ça publie les annonces que l'on
**sélectionne** sur Leboncoin, eBay, etc. »
Mesuré avant de coder : le « peu importe le compte » **était déjà vrai**
(`buildLbcData` balaie `harvest_*_listings`, tous comptes confondus). Ce qui
manquait, c'est le **choix** : la file prenait TOUTE annonce numérotée en ligne.
- Le choix vit dans `vinted_annonce_numeros[id].mp` — **la même ligne** que le
  numéro, le prix d'achat et le prix plancher. L'app en est propriétaire,
  l'extension le LIT (§11, exactement comme `minPrice`).
- ⚠️ **`undefined` (jamais touché) ≠ `false` (retiré exprès)**, et le défaut de
  Leboncoin vaut **oui** : passer d'un coup à « rien n'est sélectionné » aurait
  vidé sa file du jour au lendemain. *Une nouveauté ne doit pas éteindre ce qui
  marchait.*
- ⚠️ `updatePair` **effaçait l'entrée** quand numéro et prix d'achat étaient
  vides : cocher une annonce sans numéro perdait le choix à la ligne suivante.
  `mp` compte maintenant comme une valeur.
- ⚠️ §7 : « Aussi sur » écrit sur 44 cartes est UNE phrase. Elle vit **au-dessus
  de la grille** (avec le compte, calculé dans `annStats` — même base que la
  grille, §11) ; sur la carte il ne reste que la **puce**, dont l'état change
  d'une carte à l'autre — c'est elle qui distingue, pas le libellé.
- ⚠️ **Une annonce retirée ne disparaît pas en silence** : l'écran Leboncoin dit
  combien et où ça se règle, et « Tout est publié 🎉 » ne s'affiche plus quand
  la file est vide **parce que tout a été décoché** (deux causes, deux phrases).
- ⚠️⚠️ **C'EST L'EXTENSION QUI FILTRE** : une version antérieure à la **5.54**
  enregistre bien le choix mais prépare TOUTES les annonces. D'où
  `EXT_CAPACITES.places = '5.54.0'` — sans quoi l'app promettrait « la puce
  décide » à une extension qui ne sait pas le faire, pour la **quatrième** fois.
  `audit-coherence.cjs` l'a d'ailleurs attrapé tout seul : j'avais déclaré la
  capacité sans l'inscrire dans `FONCTIONS`, il est sorti rouge.
- `scripts/audit-places.cjs` exécute le VRAI `buildLbcData()` dans un `vm` sur
  trois annonces de **deux comptes** : choisie → dans la file · retirée → pas
  dans la file · jamais touchée → dans la file. Il vérifie aussi que **l'app et
  l'extension appliquent la même règle** (elles calculent la file chacune de leur
  côté — le panneau tourne sur leboncoin.fr, où l'app n'est pas chargée).
  **6 échecs** sur le code d'avant.


### ⚠️⚠️ « TROUVE UN MOYEN DE LE FAIRE » — ET LE MUR QUE J'ANNONÇAIS N'EXISTAIT PAS
Julien, 13 septembre : « ça me fait télécharger des photos dans mon ordi, ça ne
met pas la catégorie ni le reste donc bon », puis « **trouve un moyen de le
faire** ».

J'avais refusé la publication automatique sur **deux** arguments. Le premier
était **faux**, et je l'avais écrit deux fois dans ce dossier sans jamais
l'essayer : « un navigateur interdit de remplir un champ fichier par
programme ». **Mesuré dans Chromium** : ce qui est interdit, c'est
`input.value = '/chemin/photo.jpg'`. **`input.files = dataTransfer.files`
marche** — la page reçoit un vrai `File` (nom, taille, type), l'événement
`change` part, et le glisser-déposer synthétique marche aussi.
⇒ *Une impossibilité qu'on n'a pas mesurée est une opinion.* Avant d'écrire
« c'est impossible », l'essayer — ça coûtait dix lignes et un banc.

**Ce qui est livré (mesuré au banc sur le VRAI `lbc.js`)** :
- **Les photos s'ATTACHENT au formulaire** — plus rien ne touche son disque. Le
  fond lit les octets (le CDN Vinted n'a pas d'en-tête CORS, la page seule ne
  peut pas), le panneau fabrique les `File` nommés `VRM-{n°}-{i}.jpg` et les
  attache. **3 photos attachées, 0 téléchargement** au banc ; **6 échecs** sur le
  code d'avant, dont « il a demandé 3 téléchargements » et « 0 fichier attaché ».
- **La catégorie et l'état sont choisis.** Les listes déroulantes ne sont pas des
  `input` : `findField` ne les voyait même pas — c'est *exactement* pourquoi « ça
  ne met pas la catégorie ». `choisirListe` ne retient une option que si son
  libellé **correspond vraiment** ; sinon elle laisse vide. *Une catégorie fausse
  fait plus de mal que pas de catégorie* (leçon eBay), et on ne prend jamais « le
  premier de la liste ».
- **Le bandeau écrit le CHIFFRE** : « 3 photos attachées », ou la raison quand il
  n'y en a aucune. Jamais « ton annonce est prête ».

⚠️ **CE QUI MANQUE ENCORE POUR PUBLIER TOUT SEUL, ET C'EST MESURABLE** : le dépôt
Leboncoin est un formulaire **en étapes**, et je n'en ai jamais vu qu'**une**
(`lbc_recon`, 2 août : un seul champ, `name="subject"`). L'extension enregistre
désormais **chaque étape distincte** (`lbc_recon.etapes` — noms de champs,
libellés d'options, présence d'un champ fichier ; **aucun contenu saisi**). Un
seul dépôt fait à la main suffit à me donner la carte complète. **Ne pas écrire
le clic « Publier » avant d'avoir ces étapes** : ce serait promettre ce qu'on n'a
pas mesuré, le défaut le plus coûteux du projet.


### ⚠️⚠️ « 64 EN LIGNE » ET « 63 » — LE COMPTE EXCLU N'ÉTAIT PAS ENCORE ARRIVÉ
Vu **au rendu, sur ses vraies données** : l'écran Annonces annonçait **64 en
ligne**, le Tableau de bord **63**. Une notion, deux nombres (§11) — et le
commentaire du tableau de bord affirmait pourtant, en toutes lettres, « compte
EXACTEMENT ce que montre l'onglet Annonces ».
⚠️ **Et ni l'un ni l'autre n'avait tort.** La cause n'était dans aucun des deux
calculs : le compte **`liliand653`, exclu**, est déclaré **dans le nuage**, et
les deux écrans lisent cette liste **dans le navigateur, au MONTAGE**
(`useState(() => load('vinted_accounts_hidden'))`). Sur un **appareil neuf** elle
est vide — donc le compte exclu compte, jusqu'à ce qu'un second passage trouve
le `localStorage` rempli par `cloudLoad`. Mesuré : l'écran Annonces rendait
**64 au premier passage et 63 au second**, et le tableau de bord l'inverse.
C'est §5.49 mot pour mot (la carte des points relais), sur la donnée qui dit
**quels comptes il a mis de côté**.
⇒ Rattrapage par **`onCloudReady`** des deux côtés, et le calcul du tableau de
bord **attend le nuage** (ce sont des réglages synchronisés, pas des réglages
d'appareil). ⚠️ On ne remplace que ce qui est resté **VIDE** : sinon une
exclusion faite pendant le chargement serait écrasée. Mesuré après, sur la vraie
base : **63 / 63 dans les deux ordres** (avant : 64/63 et 64/63).
⚠️⚠️ **ET J'AI D'ABORD CORRIGÉ LE SYMPTÔME.** Premier jet : faire *publier* le
nombre par Annonces et le faire *consommer* par le tableau de bord (le motif de
`vrm_colis_prets`). Ça marchait dans **un** ordre et pas dans l'autre — et
surtout ça **figeait un 64 périmé**. *Un écart entre deux écrans n'est pas
toujours un problème de propriétaire : ici les deux lisaient la même chose, au
mauvais moment.* Retiré, et la cause corrigée.
⚠️⚠️ **ET LE CONTRÔLE NE PEUT SE DÉCLENCHER QUE SUR LE PREMIER ÉCRAN RENDU** :
dès le second, `cloudLoad` a rempli le navigateur et tout s'accorde. Mes deux
premiers jets enchaînaient les onglets dans la même page — **verts sur le
défaut**. `comptes.cjs` ouvre donc **deux contextes NEUFS**, un par écran, avec
l'exclusion déclarée **uniquement dans le nuage**. Sur le code d'avant :
**Annonces 48 · Tableau de bord 47** — rouge. *Un contrôle qui ne peut pas
échouer est pire qu'absent.*
⚠️ **Et j'ai avalé `projette()` en découpant un banc** (§4.11) : le bloc que je
remplaçais s'étendait jusqu'à la fonction suivante, et `verif_visuel.cjs` est
mort sur « projette is not defined ». *Une coupe se vérifie sur ce qui RESTE.*


### ⚠️⚠️ « BONJOUR JULIEN » — LE PREMIER ÉCRAN D'UNE NOUVELLE PERSONNE MENTAIT TROIS FOIS
Demande de Julien, 16 septembre : « continue à améliorer l'app pour qu'elle
accueille bientôt de nouvelles personnes. »

**Mesuré AU RENDU, pas dans le code** (§6.2), sur une installation neuve : base
**cloisonnée**, session valide, **zéro ligne**. Ce que voit la première vendeuse
qui ouvre VRM, en haut du tout premier écran :
> **Bonjour Julien**
> Rien d'urgent — ta boutique tourne. 👌
> 🎉 **Tout est à jour !** Rien à expédier, rien à retirer, aucun message en attente.
> *Profite — ou va sourcer de nouvelles paires.* 👟

Trois affirmations fausses d'affilée — **son prénom**, l'état de **sa boutique**,
l'état de **ses données** — et la seule ligne vraie (« Lie un compte Vinted »)
était en gris, 13 px, tout en bas. C'est « Tout est publié 🎉 » sur une file
jamais lue (écran Leboncoin), posé sur l'écran d'accueil de quelqu'un qui
découvre l'app.

- **Le prénom est un réglage synchronisé** (`vrm_prenom`, champ dans Réglages →
  Ton compte), **vide par défaut** : l'accueil dit alors « Bonjour » tout court.
  ⚠️ **On ne le déduit PAS de l'email** — « vinted35260 » n'est pas un prénom, et
  un prénom inventé est un faux : *mieux vaut un blanc qu'un faux* (§5). Lu au
  montage, donc rattrapé par `onCloudReady`, et seulement s'il est resté VIDE
  (§5.49). ⚠️ **Julien devra taper le sien une fois** — jusque-là son accueil dit
  « Bonjour ».
- **Une boutique jamais branchée ne se fête pas.** La liste vide a ici une
  **cause connue**, et une cause connue se dit : la carte des premiers pas
  nomme les quatre gestes dans l'ordre (dézipper · charger dans
  `chrome://extensions` · **se connecter à l'extension avec le même email que
  sur VRM** · ouvrir vinted.fr une fois), avec le **lien de téléchargement du
  zip**. Le geste, jamais la promesse : l'app ne sait pas si l'extension est
  installée sur cet appareil ni si la personne passera sur Vinted, elle ne
  promet donc aucun délai.
- ⚠️ **TROIS ÉTATS, JAMAIS DEUX** : `premierJour` exige `accountsReady` (la
  lecture est revenue) **et** `!baseKO` (elle a réussi). Sans ça une base qui
  hoquette accueille quelqu'un qui a **neuf comptes** par « installe
  l'extension » — le mensonge du 10 septembre, retourné. `journee` ne recevait
  d'ailleurs **pas** `accountsReady` (elle est montée à part, `tab==='journee'`,
  hors de la table `map` — exactement comme lors du premier correctif de
  `baseKO`).
- ⚠️ §7 : une fois la carte posée, la ligne grise « Lie un compte Vinted
  (⚙️ → Comptes liés) » disait la même chose en plus petit. Elle ne reste que
  pour le cas où la journée a **quand même** des actions sans aucun compte lié
  (des colis repérés par email) — là seulement elle apprend quelque chose.
- `scripts/bancs/premierjour.cjs` : **42 contrôles**, et 10 rouges de plus sur le build d'avant (§6.1). ⚠️ **Il n'a besoin d'AUCUNE fixture** — une installation
  neuve, c'est une base vide : rien de réel ne transite, il vit donc entièrement
  dans le dépôt.
  - Le contrôle du prénom ne cherche **pas le mot « Julien »** (ce serait posé
    sur l'orthographe, et vert le jour où quelqu'un met un autre prénom en dur) :
    il rend **deux fois, avec deux valeurs du réglage**, et exige que le bonjour
    **suive la donnée**.
  - Et il vérifie **les deux autres sens**, sans quoi *ne rien fêter du tout*
    passerait tous les contrôles : un compte lié et rien à faire ⇒ la fête
    revient ; base injoignable ⇒ ni fête, ni « installe l'extension ».
  - Le lien du zip est vérifié **par son `href`** (un geste qui se clique ne se
    voit pas dans `innerText`) **et** par l'existence du fichier pointé — un
    bouton qui mène à un 404 est le défaut du pipeline Factures.
- ⚠️ **VINGT-ET-UNIÈME fois qu'un de mes contrôles crie au loup**, et c'est mon
  balayage d'exploration : `/NaN/i` attrapait « mainte**nan**t ». `NaN` se
  cherche **sensible à la casse**.


### ⚠️⚠️ « CE N'EST PAS NATUREL » — L'ACCUEIL ÉTAIT UNE NOTICE DE MONTAGE
Julien, 16 septembre, en regardant le premier écran : « bien mais pas encore
parfait, **ce n'est pas naturel** ». Il avait raison, et c'est §2.7 mot pour
mot : quatre étapes numérotées d'un coup, « dézippe », « Mode développeur »,
« extension non empaquetée » — du vocabulaire d'informaticien sur la toute
première page, à quelqu'un qui n'en est pas un.
⇒ **UNE seule étape à la fois**, en gros et en français ; les autres restent
visibles **en sourdine** (on veut savoir ce qui reste, pas tout lire). Une barre
de progression à trois segments, et l'écran **avance tout seul** — le pont
prévient dès que l'extension répond, et **on le dit** : c'est ça qui fait qu'on
se sent accompagné plutôt que mis au travail. Quatre étapes sont devenues
**trois** : télécharger et installer, c'est UN geste vu de l'utilisateur.
- **Le prénom se demande à l'inscription**, pas dans Réglages : c'est la
  question la plus naturelle du monde à ce moment-là, et personne ne va la
  chercher dans un écran de réglages. **Facultatif** — un champ obligatoire de
  plus pour un bonjour serait un péage. Même réglage `vrm_prenom` que le champ
  de Réglages (§11).
- ⚠️⚠️ **IL Y AVAIT DEUX ONBOARDINGS, ET ILS NE DISAIENT PAS LA MÊME CHOSE.**
  Le tableau de bord récitait « 3 étapes » — **sans lien de téléchargement**,
  en nommant « Shop Cancale35 – Vinted Sync » (**la boutique de quelqu'un
  d'autre**, pour un nouveau venu), et **sans l'étape qui sépare les vendeurs**
  (se connecter à l'extension avec le même email). Ma journée en disait quatre,
  mesurées. Deux écrans, deux consignes, sur les deux premières pages. §11.
  ⇒ `PremiersPas` porte la règle, les deux écrans la **rendent**. Le banc exige
  que **les trois gestes soient nommés sur les DEUX** — chacun identifié par ce
  qu'il DÉSIGNE (une adresse, une notion, un domaine), jamais par sa phrase.
- ⚠️⚠️ **ET LE TABLEAU DE BORD FÊTAIT « ✅ Tout est à jour » JUSTE SOUS LA CARTE
  QUI VENAIT D'EXPLIQUER QUE RIEN N'ÉTAIT BRANCHÉ** — un écran qui se contredit
  à deux centimètres d'écart. C'est le **troisième** « tout est à jour » du même
  écran (§ « ce banc ne rendait que les 4 écrans »), et le premier vu sur une
  installation neuve. La carte du dessus dit déjà quoi faire : ici on se tait
  (§7, une cause une phrase).
  ⇒ « c'est son premier jour » est UNE notion : elle est décidée **dans la
  coque** (`premierJour`) et consommée par les trois écrans.
- ⚠️ **Leboncoin fêtait « Tout est publié 🎉 (toutes tes paires numérotées en
  ligne sont sur Leboncoin) » sur une base à ZÉRO annonce.** Troisième cause
  d'une file vide, après « lecture ratée » et « tout décoché » : *il n'y a
  encore rien*. Une cause connue se dit. Quatrième cause au passage : des
  annonces en ligne mais **aucune numérotée**.
- ⚠️ **« Réception des emails · 3 transporteurs silencieux »**, en ambre, avec
  trois « aucun email reçu » en ROUGE — à quelqu'un qui vient de créer son
  compte. Rien ne se tait : **rien n'a commencé**. Trois états, jamais deux —
  et une fausse alerte est ce qui fait cesser de lire les vraies.
  ⚠️ **§4.6 PAYÉ CASH, ENCORE** : posé après `detail` (un élément JSX construit
  IMMÉDIATEMENT), `aucunEmailDeSuivi` a tué l'écran Achats sur « Cannot access
  before initialization ». **C'est le RENDU qui l'a vu**, pas le build.
- ⚠️ **VINGT-TROISIÈME fois qu'un de mes contrôles crie au loup**, et quatre
  d'un coup : ils cherchaient les PHRASES d'avant (« pas connectée à ton
  compte », « AUTRE compte », « n'a pas répondu »). Les états étaient tous
  corrects — seul le texte avait changé, et il devait changer, c'était la
  demande. ⇒ **La carte PORTE l'état décidé** (`data-etape`) et le banc juge
  **l'état et ses conséquences** (quel bouton, quelles adresses nommées) ; le
  texte reste libre. C'est la seule forme qui survive à une réécriture.
- ⚠️ **Et le banc MOURAIT sur un port déjà pris** (EADDRINUSE) au lieu de
  rapporter — septième fois. Il dit maintenant « le port est pris, relance-le
  seul ».
- **10 rouges** sur le build d'il y a une heure, 0 après.


### ⚠️⚠️ ET SUR SON IPHONE, L'ACCUEIL DEMANDAIT L'IMPOSSIBLE
Mesuré au rendu à **390 px avec `isMobile + hasTouch`**, juste après la passe
« naturel » : la carte des premiers pas déroulait quand même « va sur
`chrome://extensions` », « allume Mode développeur », « Charger l'extension non
empaquetée » — **et proposait de TÉLÉCHARGER un zip sur un téléphone**, où il
ne sert à rien. La seule ligne vraie (« fais-le une fois sur un ordinateur »)
était en tout petit, tout en bas, sous la barre de navigation.
C'est l'écran que Julien ouvre le plus souvent, et c'est du travail impossible.
⇒ **On ne devine PAS « c'est un téléphone » : on mesure l'ENTRÉE.**
`useSansSouris()` = `(pointer: coarse)` **ET** `(hover: none)` — aucune souris du
tout. C'est vrai des téléphones comme des tablettes, et ça reste vrai le jour
où la marque change ; un portable tactile, lui, déclare `pointer: fine` et **rien
ne change pour lui**. Vérifié dans le Chromium du banc : `coarse/nohover` valent
`true/true` en mobile et `false/false` en bureau.
⇒ Dans ce cas, **aucune marche à suivre Chrome, aucun bouton de téléchargement**,
et on dit **où** ça se passe (« ouvre vrm.center dans le Chrome de ton
ordinateur — tu y retrouveras exactement cet écran »). Un `matchMedia` qui lève
rend `false` : « pas su » garde le comportement d'avant.
- ⚠️ **Le banc vérifie L'AUTRE SENS** : *tout retirer partout* passerait le
  contrôle. Sur ordinateur, la marche à suivre **et** le zip doivent rester.
- ⚠️ **Et « Taux marge 0% » sur le premier tableau de bord** : sans aucune
  vente, c'est **0 ÷ 0** — un chiffre fabriqué présenté comme un fait. §7 : un
  zéro qui veut dire « on ne sait pas » s'écrit `—`, avec la raison (« dès ta
  première vente »).
  ⚠️ **VINGT-QUATRIÈME cri au loup, attrapé avant de partir** : mon premier jet
  interdisait « 0% » sur **toute la page** — il attrapait « Remplissage garage
  0% », qui est une **vraie** mesure (rien n'est rangé). On juge la carte
  concernée, pas la page.
- **3 rouges** de plus sur le build d'il y a une heure ; `premierjour.cjs` est à
  **48 contrôles**.


### ⚠️⚠️ LA PORTE D'ENTRÉE PROMETTAIT UNE PROTECTION QU'ELLE N'AVAIT PAS MESURÉE
Même passe, même écran d'accueil — mais **avant** la connexion. La dernière
phrase que lit quelqu'un juste avant de confier ses jetons Vinted disait :
> « Chaque vendeur ne voit que ses propres données.
> **L'isolation est appliquée par la base, pas par l'application.** »

Elle s'affichait dès que **`CLOISONNE`** était vrai — et `CLOISONNE` mesure une
seule chose : **la colonne `owner` EXISTE**. Or la migration autorise
explicitement de s'arrêter là (« *garde RLS désactivé, n'applique que l'étape
1* »). Dans cet état la porte promettait l'isolation pendant que le panneau de
Réglages disait, **sur la même base**, « la clé publique permet encore de tout
écrire et effacer ». **Deux verdicts sur une notion (§11)** — et le faux était
celui qu'une nouvelle personne lit en premier.
⇒ La porte **mesure** : `sondeLectureSansCompte()` (une lecture, zéro écriture,
§2.3) rend **trois états** — encore lisible · fermée · **pas su**. On n'affirme
rien tant qu'on ne sait pas, et on n'accuse pas non plus.
⇒ **La règle est extraite et PARTAGÉE** : le panneau de sécurité la consomme au
lieu de la réécrire. Une seule des deux corrigée, et les deux écrans divergent
de nouveau.
- ⚠️ **VINGT-DEUXIÈME fois qu'un de mes contrôles crie au loup**, et c'est la
  récidive exacte de `sbGetTout` : `audit-chiffres.cjs` exigeait le mot `null`
  **dans l'expression** de la sonde. Devenue un appel de fonction partagée, la
  règle était **mieux tenue qu'avant** et l'audit tombait au rouge. Il suit
  maintenant l'expression **jusqu'à sa définition** — et il reste rouge quand on
  réaffaiblit la fonction (prouvé).
- Le banc couvre les **trois** états, y compris « sonde muette : aucune promesse
  **et** aucune accusation ». Sur le build d'avant, c'est la sonde muette qui
  échouait aussi : elle promettait l'isolation sans avoir rien pu mesurer.


### ⚠️⚠️ « LE BOUTON TÉLÉCHARGER MES DONNÉES ME RENVOIE SUR "COMPTE BLOQUÉ" »
Demande de Julien, 19 septembre : son **compte pro Vinted est bloqué**, il a
besoin de l'export de ses données pour le récupérer, et le bouton des réglages
le renvoie sur la page « ton compte est bloqué ». Il a une **session** — c'est
l'interface qui refuse, pas la connexion.

⚠️ **CE QU'IL NE FAUT PAS FAIRE, ET LA RAISON EST UNE MESURE.** Sur les
**41 chemins d'API** que son extension a observés en tout (`harvest_*_seen_urls`,
11 lignes), **aucun** ne concerne un export. Cet endpoint n'a **jamais été vu**.
Écrire un appel vers une adresse devinée est exactement ce que ce dossier
interdit partout — et ici ça partirait depuis la session d'un compte **déjà
bloqué**, c'est-à-dire au pire endroit possible : du trafic inhabituel sur ce
compte-là est ce qui transforme un blocage contestable en blocage définitif.
⇒ **C'est son navigateur qui mesure et qui rapporte** — la méthode du formulaire
eBay et des étapes Leboncoin : *faire mesurer par ce qui y a accès.*

⚠️⚠️ **ET LA MESURE QUI MANQUAIT EST LE STATUT.** Deux situations
**indistinguables** de l'extérieur, et qui n'appellent pas du tout le même geste :
- la requête d'export **part** et le serveur la refuse (**403**) ⇒ aucun
  contournement côté navigateur ne servira jamais, la voie écrite est la seule ;
- la requête **ne part pas** parce que c'est seulement la page qui redirige ⇒ la
  donnée est peut-être atteignable.

Le mouchard notait le **chemin** et **pas le statut** ; et il ignorait tout ce
qui n'est pas `/api/`, donc une page de réglages ne laissait **aucune trace**.
⇒ `noteSeen(url, method, status)` relève `MÉTHODE chemin → statut` (dernier
statut vu + combien de fois : « 403 une fois » et « 403 à chaque essai » ne se
lisent pas pareil), et note aussi les **pages** qui parlent d'export, de données
ou de compte — pas les autres (§7 vaut aussi pour un diagnostic).
- **La promesse de confidentialité ne bouge pas** : chemin + méthode + statut,
  **jamais** le corps, **jamais** les paramètres d'URL, et les identifiants
  numériques deviennent `{id}`. Le banc tape un corps et une adresse email dans
  la requête et exige qu'ils **ne partent pas**.
- ⚠️⚠️ **ET `storeSeenUrls` ÉCRASAIT LA LIGNE À CHAQUE VISITE.** Une page ne fait
  qu'une poignée d'appels : le passage suivant remplaçait donc tout ce qui avait
  été appris ailleurs. C'est ce qui explique les **41 chemins seulement** sur
  11 comptes alors que chaque visite en voit une dizaine. Pour un diagnostic dont
  le but est d'attraper **UN endpoint vu UNE fois**, écraser était fatal. Il
  fusionne, et **ne réécrit pas sur une lecture ratée** — `audit-fusion.cjs`
  porte le cas (la quinzième ligne de cette famille).
- `scripts/audit-endpoints-vus.cjs` **charge le vrai `inject.js` dans une vraie
  page** (§4.10) et regarde ce qu'il ENVOIE : **13 contrôles**, dont **5 rouges** sur le
  code d'avant — dont « et avec son CODE DE RÉPONSE : `[]` ».
- **Aucune entrée d'`EXT_CAPACITES`** : l'app ne promet rien de neuf, c'est une
  mesure. Extension en **5.78.0**, zip régénéré, `EXT_ATTENDUE` suivie.
- ⚠️ **Ce qu'on détient DÉJÀ du compte bloqué**, mesuré : l'identifiant de
  moisson `3170782324` porte le login **`vanessa5723`** et sa capture s'arrête
  net le **11 août** — 2 annonces (dont une à 49 € encore en ligne), 1 vente,
  4 achats, 10 conversations, un porte-monnaie. **132 Ko que Vinted ne lui montre
  plus**, exportés et envoyés. Ne PAS mettre cet export dans le dépôt : vrais
  acheteurs, vrais messages, dépôt public.
- La voie écrite est prête et ne dépend pas de l'interface :
  `docs/demande-rgpd-vinted.md` (art. 15 · art. 15.1.h · **art. 22.3, droit à
  une intervention humaine** quand un automate a décidé · sommes retenues).
  ⚠️ **Ne pas demander l'effacement** : la CNIL dit que ce n'est pas un droit
  absolu après un blocage, et ça **contredit** une demande de récupération.
  ⚠️ **L'adresse du DPO n'est pas affirmée** : je n'ai pas pu la lire depuis une
  source primaire, le document renvoie donc à la page de la CNIL qui la porte
  (`cnil.fr/fr/cnil-direct/question/1991`). *Mieux vaut un blanc qu'un faux.*

⚠️⚠️⚠️ **IL A CLIQUÉ, ET LE RELEVÉ EST ARRIVÉ VIDE — DEUX DÉFAUTS, TOUS DEUX DE MOI.**
Mesuré dans la minute : `harvest_199082413_seen_urls` écrite par la **5.79.0**,
donc la liste noire ne bloquait bien rien (c'était juste). Mais **0 réponse**, et
les 5 chemins relevés étaient ceux de son **dressing**, pas de la page de
réglages.

1. ⚠️⚠️ **`content.js` RELAYAIT UNE LISTE DE CHAMPS FIXE.** `inject.js` envoyait
   bien `reponses` ; le relais recopiait `kind, type, id, url, method, body,
   csrf, b64, paths` — **et rien d'autre**. La donnée mourait **entre deux
   fichiers qui avaient tous les deux raison**. C'est `storeLbcRecon` (qui
   rangeait clé par clé et perdait `etapes`) **une couche plus tôt**.
   ⇒ Le relais recopie désormais **tout** ce que la page envoie, sauf son
   étiquette ; `from` et `domain` restent posés par NOUS (la page ne les dicte
   pas). *Un raccord qui énumère ne transporte que ce qu'on a pensé à écrire.*
   ⚠️ **ET MON BANC NE POUVAIT PAS LE VOIR** : il lisait le `postMessage` **dans
   la page**. Il prouvait donc que `inject.js` ENVOIE, jamais que ça ARRIVE.
   *Un contrôle qui s'arrête au message prouve le message, jamais la donnée* —
   le dossier l'écrivait déjà pour `storeLbcRecon`, et j'y suis retombé. Le banc
   charge maintenant le **VRAI `content.js`** et juge ce qui en sort.
2. ⚠️⚠️ **LE VIDAGE À 5 s NE LAISSE AUCUNE CHANCE À UNE PAGE QUI REBONDIT.** Il
   clique, Vinted le renvoie **aussitôt** sur « compte bloqué » : la page est
   déchargée bien avant les 5 s, et `pagehide` ne sauve rien (un `sendMessage`
   depuis une page qui se décharge part rarement). C'est **exactement** le cas
   qu'on cherche à mesurer, et c'était le seul qu'on ne pouvait pas voir.
   ⇒ Ce qui est intéressant part **sur-le-champ** : tout appel qui **échoue**
   (≥ 400) ou tout appel sur un chemin de compte/export déclenche le vidage
   immédiatement.
- `audit-endpoints-vus.cjs` est à **18 contrôles**, et les deux nouveaux défauts
  sortent **7 rouges** sur la 5.79.0 — dont « les codes de réponse survivent au
  relais : `[]` » et « rien relayé après 800 ms ».
- ⚠️ **Le même motif dort dans `lbc.js`** : son relais énumère aussi, kind par
  kind. Complet aujourd'hui, mais c'est la même fragilité — à recopier en entier
  le jour où on y touche.
- Extension en **5.80.0**, zip régénéré, `EXT_ATTENDUE` suivie.

⚠️⚠️ **ET C'EST LUI QUI A VU LE TROU : « le compte shop cancale devait être
ignoré par l'extension ».** Il avait raison de demander — `shop_cancale`
(uid **199082413**) est dans `vrm_blocked_accounts`, la liste des comptes
supprimés DÉFINITIVEMENT, et c'est elle qui l'empêchait de « revenir tout le
temps ». **Mesuré, en exécutant le vrai `background.js`** : cette liste ne porte
que sur `captureDomain`, c'est-à-dire sur les **JETONS**. Ni `storeSeenUrls` ni
`storeHarvest` ne la consultent — ils ne lisent que le cookie de session
(`activeAccountId`). Donc le relevé partira, et **le compte ne réapparaît pas
dans l'app** : elle lit ses comptes dans la table `vinted_accounts`, jamais dans
`app_data`. Vérifié aussi : `content.js` tourne sur **toutes** les pages Vinted
quel que soit le compte connecté.
- `audit-endpoints-vus.cjs` porte les deux moitiés : le relevé **EST** écrit pour
  un compte de la liste noire, **et aucun jeton ne l'est**. Sans la seconde,
  « faire marcher le diagnostic » pourrait ressusciter le compte — exactement ce
  qu'il ne veut pas. Et sans la première, quelqu'un « compléterait » la liste
  noire un jour en l'étendant au diagnostic, rendant muet le seul compte qu'on
  cherche à documenter.
- ⚠️ **EFFET DE BORD À LUI ANNONCER, PAS À DÉCIDER POUR LUI** : comme
  `storeHarvest` n'est pas filtré non plus, passer sur `shop_cancale` va aussi
  **remoissonner ses annonces, ventes et messages** dans `harvest_199082413_*`.
  C'est une LECTURE sur ses propres données (§3 l'autorise), et ça peut lui
  servir pour récupérer le compte — mais des annonces d'un compte écarté peuvent
  ressortir dans certaines listes, comme le fait déjà l'orphelin `3170782324`.
  *Je n'invente pas une règle de plus sans qu'il ait tranché.*

⚠️⚠️ **ET J'AI DÉTRUIT MON PROPRE TRAVAIL EN VOULANT REBASER.** La recette de
rebase de ce dossier (`git checkout -B branche origin/main && git checkout <sha>
-- .`) est écrite pour du travail **COMMITÉ**. Lancée sur un arbre qui portait
cinq fichiers **non commités**, elle les a remplacés par la version du commit :
`inject.js`, `background.js`, `manifest.json`, `EXT_ATTENDUE`, `CLAUDE.md` et
`audit-fusion.cjs` sont repartis en arrière d'un coup, sans un mot. Seul le
fichier **non suivi** (`audit-endpoints-vus.cjs`) a survécu — l'inverse de
l'intuition.
⇒ **On commite AVANT toute manipulation de branche**, jamais après. C'est §2.1
(« pousse à chaque modification ») qui protège aussi de ça, et c'est la seule
fois où l'avoir oublié a coûté du travail.


### ⚠️⚠️ « IL N'Y A QUE 5 PHOTOS » — ET MA « MESURE » DE COMPTE PRO ÉTAIT UN FRAGMENT D'URL
Julien, 19 sept. : « sur les comptes **particuliers** tu peux en mettre jusqu'à
**15** ; c'est sur les comptes **pro** où tu peux en mettre que **5** si tu
n'achètes pas le pack. Je veux toutes les photos de l'annonce Vinted sur
Leboncoin si c'est du compte particulier. » Puis, quand je lui ai répondu « ton
compte est pro » : **« non là c'est compte particulier »**. Il a raison, il
possède le compte.
⚠️⚠️ **MON PREMIER JET AFFIRMAIT « son compte Leboncoin est PRO
(`online_store_id`) » — c'était FAUX, et c'est le piège §6 mot pour mot.** En
remesurant : `lbc_accounts` est **vide** (`[]`) — le type de compte n'a **jamais
été capté** — et `online_store_id` n'était qu'un **bout de chemin d'URL** dans
`lbc_recon.paths` (`.../online_store_id"`), pas un champ de compte. J'ai lu le
mauvais champ et j'en ai tiré une affirmation, exactement ce que ce dossier
interdit. *Avant d'affirmer un fait sur ses données, vérifier le NOM et la FORME
du champ ; un fragment de chaîne n'est pas une mesure.*
**Ce qui EST mesuré, sur sa vraie base** : ses annonces Vinted captées portent
**au plus 6 photos** (`vinted_item_details`, 118 objets : `1→14 · 3→1 · 4→5 ·
5→38 · 6→60`, **aucune au-dessus de 6**). Et **ce n'est pas une troncature de
notre côté** : la capture garde jusqu'à **20** photos (`background.js:2610`,
`slice(0,20)`), le `slice(0,6)` de `lbc.js:489` ne concerne que les **vignettes
d'aperçu** du panneau. Donc ses paires ont réellement ≤ 6 photos — cohérent avec
« 5 en moyenne » mesuré le 12 sept.
⇒ **Le « 5 » qu'il voit = le nombre réel de photos de CETTE annonce-là** (38 de
ses annonces en ont exactement 5, 60 en ont 6). Ce n'est ni un plafond de
compte, ni un `slice` : l'extension envoie déjà **toutes** les photos qu'elle a.
- `attacherPhotos` **envoie jusqu'à 15** (`slice(0,15)`, `photoBytes … max:15`,
  contre 10 avant). C'est **correct pour un compte particulier** (15 autorisés),
  et sans risque : sur-fournir ne fait que laisser Leboncoin ignorer le surplus.
- ⚠️⚠️ **CE QUE JE CROYAIS ÊTRE LA VÉRITÉ ÉTAIT ENCORE FAUX** : j'avais écrit
  « ses annonces portent ≤ 6 photos ». C'était le compte **CAPTÉ**, pas le réel.
  Vinted DIT le vrai nombre dans `nPhotos` : **mesuré, ses annonces ont 7 à 16
  photos** (médiane ~12 ; distribution sur 784 : le gros entre 11 et 14). On n'en
  captait que **≤ 6** — il en manquait donc **la moitié**. Le « 15 » n'est PAS
  latent : c'est la **capture** qui plafonnait (voir la section suivante).
- **Aucune entrée d'`EXT_CAPACITES`** : le pont `photoBytes` respecte déjà `max`
  (`photosEnOctets(urls, max)`), rien de neuf n'est promis à l'app.


### ⚠️⚠️ ET C'ÉTAIT BIEN LA CAPTURE — LE CARROUSEL VINTED CHARGE SES IMAGES AU FUR ET À MESURE
Julien, 19 sept. : « c'est peut-être parce que la capture Vinted ne prend que
5 photos ». **Il avait raison.** `readListingDetailFromPage` (dans
`vinted-panel.js`) lisait les photos **du DOM**, et seulement `img[src*="vinted.net"]`.
Or le carrousel Vinted est **lazy** : les slides pas encore affichées n'ont pas
de `src` (leur URL vit dans `srcset`/`data-src`), donc elles étaient **perdues**.
D'où le plafond mesuré à 6 (les seules chargées d'emblée), qui n'a **rien** à
voir avec le type de compte.
⇒ `ajoute(u)` collecte désormais `src`, `srcset`, `data-srcset`, `data-src` des
`<img>` **et** les `<source srcset>`, toujours filtré au même domaine + grand
format (`f800|f1200|tc`). Et il **dédoublonne par IDENTITÉ de photo**
(`cle` = URL sans la query ni le segment de format) : une même photo vue en f800
**et** f1200 ne compte qu'une fois — sinon Leboncoin recevrait un doublon (défaut
que l'ancien code avait **aussi** : il ajoutait la photo principale deux fois).
- ⚠️ **§4.10 : cette fonction n'avait jamais tourné hors de Chrome.**
  `scripts/bancs/photos.cjs` extrait la VRAIE fonction (AVANT = `HEAD`, APRÈS =
  arbre) et les exécute sur **le même** carrousel synthétique où seules 5 images
  ont un `src` et le reste vit en lazy : **AVANT perd les 3 slides lazy et
  double la principale ; APRÈS capte les 9, sans doublon.** C'est un vrai
  avant/après (§6.1), pas « la fonction n'existait pas ».
- ⚠️⚠️ **CE QUE JE NE PEUX PAS PROUVER D'ICI, ET QUI RESTE À MESURER** : que le
  DOM réel de Vinted expose bien ses slides lazy dans `srcset`/`data-src`. Le
  banc prouve que **si** elles y sont, on les prend ; il ne prouve pas qu'elles
  y sont (je n'atteins pas Vinted, 403). *Le seul verdict : qu'il rouvre, avec
  la 5.87, une annonce qui a plus de 6 photos sur Vinted — puis on relit
  `vinted_item_details` et on compte.* Si ça reste à 6, les photos vivent dans
  la DONNÉE de la page (JSON embarqué), pas le DOM, et c'est la prochaine passe :
  faire mesurer par ce qui y a accès, comme le formulaire eBay.
- **Aucune entrée d'`EXT_CAPACITES`** : c'est une correction de capture, pas une
  promesse neuve. Extension en **5.87.0**, zip régénéré, `EXT_ATTENDUE` suivie.


### ⚠️⚠️ « ÇA NE CLIQUE PAS SUR LA CATÉGORIE » — VU AU RENDU : DES RADIOS + UN « CONTINUER »
Julien, 20 sept., capture d'écran de l'étape 1 du dépôt à l'appui : « ça ne clique
pas sur la bonne catégorie, et ça ne clique même pas ; je veux que ça fasse ça,
tout le reste, et que ça appuie sur Continuer ». **Mesuré au rendu (§6.2)** : la
catégorie n'est PAS une liste — c'est **trois boutons radio** (« Mode >
Chaussures », « Loisirs > Sport & Plein air », « Mode > Vêtements »), plus un
champ « Ou choisissez une autre catégorie », et un bouton **Continuer** dessous.
`choisirComposant` (combobox) et `choisirListe` (`<select>`) ne voyaient donc
**rien** ici.
⇒ **`choisirCategorie(ad)`** clique le RADIO dont le libellé contient sa
catégorie (`ad.category` = « Chaussures ») — une correspondance, jamais « le
premier ». **`cliquerContinuer()`** enchaîne l'étape : il clique un bouton
**« Continuer »/« Suivant »** et **JAMAIS** un bouton qui **publie/dépose/valide/
paye/finalise** (`BTN_PUBLIER` l'écarte, §3/§5). **`avancer()`** l'appelle une
fois par étape (signature), avec quelques essais puis abandon — si ça n'avance
pas, c'est qu'un champ **obligatoire non devinable** manque (ex. **Univers***),
et on le **DIT** (« un champ obligatoire reste à choisir ») au lieu de tourner en
rond. Câblé dans `fillNow` (passif), `prefill` et `fillNowForce`.
- ⚠️ **« Publier » reste À LUI**, toujours (aucune publication à l'aveugle). Ce
  qui part tout seul : titre, description, prix, référence, photos, pointure,
  état, **catégorie**, et l'enchaînement **Continuer**. Ce qui reste manuel :
  les attributs qu'on ne devine pas (Univers/Type/Couleur/Marque) et le clic
  final Publier.
- `bancs/leboncoin.cjs` sert l'étape catégorie (radios + Continuer + Publier) :
  **le radio « Mode > Chaussures » est coché, « Continuer » cliqué une fois,
  « Publier » JAMAIS** (0 clic). Extension en **5.92.0**, zip régénéré,
  `EXT_ATTENDUE` suivie. Aucune entrée d'`EXT_CAPACITES` (l'app ne promet rien
  de neuf : c'est le panneau qui agit, et le manifeste continue de dire « c'est
  toi qui cliques sur Publier »).


### ⚠️ « FLOUTER LES DÉJÀ PUBLIÉES » + « LE DESIGN FAIT SIMPLE » + « JUSTE UN BOUTON QUI PUBLIE »
Demande de Julien, 19 sept. Trois points, traités selon ce qui est HONNÊTE :
1. **Flouter les annonces déjà republiées** (« les Nike Sacai, on les a déjà mises
   sur Leboncoin »). `cardHtml` estompe (`.card.deja` : opacity .5 + grayscale) et
   **désactive « Tout préparer »** toute paire dont NOTRE `VRM-{n°}` est repéré sur
   la page Leboncoin (`pageRefs`, une IDENTITÉ, jamais un titre — §5), avec un
   badge « ✓ déjà en ligne ». ⚠️ Le signal PERSISTANT (ref trouvée dans ses
   annonces captées) ne s'allumera qu'une fois ses ads captées (5.88 + sa visite) ;
   d'ici là c'est le scan de page qui l'alimente.
2. **Design aligné sur la signature de VRM (§7)** : fini l'orange Leboncoin
   partout — encre ardoise `#10151B`, **UNE** couleur d'accent (bleu `#1E5FCC`,
   rare), fond gris froid `#F6F7F9`, ombres à deux couches, et **une seule forme
   de bouton** (hauteur/rayon/graisse). CSS only, aucune logique touchée ; le banc
   `leboncoin.cjs` reste vert.
3. ⚠️⚠️ **« juste appuyer sur un bouton et que ça publie » — PAS écrit, et c'est
   la règle du projet.** Le clic « Publier » et le remplissage des listes
   d'attributs (Univers/Type/Pointure/Marque/Couleur/État) sont des **composants
   React** dont je n'ai **jamais vu** le DOM de sélection (Leboncoin me renvoie
   403), et la valeur soumise est un **CODE**, pas le libellé. Un mauvais attribut
   sur une annonce **publiée** est le coût le plus élevé du projet (leçon eBay).
   *Écrire le clic « Publier » à l'aveugle serait le défaut le plus coûteux.* Ce
   que fait déjà « Tout préparer » (mesuré, sûr) : attache les photos, remplit
   titre + description + prix (en centimes) + référence, ouvre la page. **Ce qui
   débloque le bouton unique** : qu'il fasse UN dépôt à la main avec la 5.88+ (la
   capture `optcodes` + `lbc_recon.etapes` relève alors le DOM réel des listes) —
   ensuite on câble le remplissage des attributs code-certains (Pointure, État) et
   l'enchaînement des étapes, prouvé au banc sur la vraie forme. On ne promet pas
   avant d'avoir mesuré.
- Extension en **5.89.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` : estompage + design, rien de neuf n'est promis.


### ⚠️ « CAPTE TOUTES LES PHOTOS EN PASSIF » — L'EXTENSION LIT LE DÉTAIL, SANS OUVRIR L'ANNONCE
Julien, 20 sept. : « je veux que ça capture toutes les photos en passif, dès que
j'ouvre Vinted, je veux pas aller sur l'annonce ». **Mesuré sur sa base** : la
liste du dressing (`harvest_{uid}_listings`, ce qui charge quand il ouvre Vinted)
ne porte, par annonce, que **la couverture** (`photo` = UN objet) + le **vrai
compte** (`nPhotos`, ex. 9). Le jeu complet ne vit **que** dans le détail de
l'annonce. Lire les photos « du DOM » (5.87) exige donc d'ouvrir chaque annonce —
exactement ce qu'il ne veut plus.
⇒ `capterPhotosAnnonces(uid)` (background) tourne à **chaque visite Vinted**,
après la moisson : il prend SES annonces **en ligne** (`harvest_{uid}_listings`)
dont `nPhotos > photos déjà captées`, et va lire `/api/v2/items/{id}` pour en
extraire **toutes** les photos (`saveItemDetail`). C'est une **lecture sur ses
propres annonces** (§3 l'autorise), la forme exacte de `capterRetraits` /
`capterReleves`, avec les **mêmes garde-fous** : compte connecté (`garde`),
**3 par visite**, une par une, pas de nouvel essai avant 24 h. En quelques
visites, tout se remplit **tout seul** — la pastille « X/Y photos » de l'écran
Annonces passe au vert sans qu'il ouvre rien.
- ⚠️ **L'endpoint de détail n'a jamais été observé d'ici (403).** `urlsPhotosDeItem`
  lit `item.photos[].full_size_url|url` **et**, si cette forme ne donne rien,
  balaie la réponse pour toute URL d'image `vinted.net` — puis note un diag
  (`photos_annonce_ecrit` / `_refuse_{status}` / `_vide`) + un échantillon des
  **clés** (jamais le corps). Si l'extraction rate, la prochaine visite me dira
  la vraie forme (*faire mesurer par ce qui y a accès*), sans deviner.
- **On n'écrit jamais moins qu'on a** (`saveItemDetail` ne remplace pas par du
  vide) ; une lecture ratée de `vinted_item_details` (`null`) ⇒ on ne rejoue pas.
- `scripts/audit-photos-passif.cjs` **exécute** le vrai `background.js` dans un
  `vm` : complète les annonces à qui il manque des photos (jeu **complet**, pas
  la couverture), **ignore** fermées / 1 photo / déjà complètes, **borne à 3**,
  s'arrête si `garde` refuse. **§6.1 prouvé en RÉAFFAIBLISSANT** (retirer le
  filtre « en ligne » ⇒ une annonce fermée est lue → le contrôle mord). **11
  contrôles.** ⚠️ §6.3 dans mon propre banc : le mock devait honorer la
  **projection** `items:data->payload->items` (sinon `rows[0].items` = undefined,
  0 photo sur un code intact) **et** la lecture-après-écriture.
- **Aucune entrée d'`EXT_CAPACITES`** : c'est de la CAPTURE (l'app ne promet rien
  de neuf, la pastille lit ce qui est là). Extension en **5.95.0**, zip régénéré,
  `EXT_ATTENDUE` suivie.


### ⚠️ « SUR QUELLE PLATEFORME EST CHAQUE PAIRE » + PAIRES QUI DORMENT (écran Annonces)
Julien, 20 sept. : « dans les annonces, dis sur quelle plateforme est chaque
paire » + « paires qui dorment ». **Le « paires qui dorment » existait déjà**
(`annStats.sleeping`, `SLEEP_DAYS=30`, tri « Qui dorment 😴 », bandeau,
assistant de baisse de prix) — on l'a **rendu visible par carte**, pas refait.
- **Sur quelle plateforme — ce qui est PROUVÉ seulement.** Pastille **« ✓ sur
  Leboncoin »** quand `vinted_lbc_posted.ids` contient `item.id` (l'id d'annonce
  Vinted, exactement ce que `markPosted` écrit → correspondance directe, §5,
  jamais par titre). Chargé comme `listingDates` ; **lecture ratée/vide ⇒ Set
  vide ⇒ aucune pastille** : on n'affirme JAMAIS « publiée » à tort (sous-affirmer
  ne trompe pas, une fausse pastille verte si). Rendu en pastille ardoise pleine
  (`C.text`/`C.card`) — **pas de nouvelle couleur** (§7 : une seule teinte
  d'accent ; pas de vert en dur).
- **Pastille « 😴 en ligne depuis X j »** sur les paires qui dorment (âge de
  `listedAgeDays`, la date de mise en ligne captée ; `null` ⇒ rien, on n'invente
  pas d'ancienneté, §5.34). Le chiffre, jamais la promesse.
- ⚠️⚠️ **« SUR QUEL COMPTE Leboncoin » RESTE MESURÉ IMPOSSIBLE** (§ « où est la
  paire »). `lbc_accounts` vide, `lbc_listings` = des annonces qui ne sont pas
  les siennes : tant que ses PROPRES annonces LBC ne sont pas captées (5.98 + une
  vraie visite « mes annonces » sur Leboncoin, forme à voir), l'app **n'affiche
  pas** le compte ni un « publiée » déduit d'une capture. La seule source
  honnête aujourd'hui est SA marque `vinted_lbc_posted`. *On collecte, on
  vérifie, PUIS on promet.* **Rien touché dans l'extension** cette passe (pas de
  bump, pas de zip) : ce serait du code spéculatif sur une donnée absente.
- `npm run build`, `verif_visuel` (annonces rendues aux deux tailles, aucun
  crash/blanc/débordement), `audit-chiffres/variables/boutons/icones` : verts.


### ⚠️ « CAPTE TOUTES MES PHOTOS » — TROIS VOIES, ZÉRO RAFALE (3 octobre, 5.144)
Julien : « tu peux pas tout capter d'un coup ? imagine 100 annonces ». **Non — un
envoi de 100 requêtes à Vinted en quelques secondes = signature de robot =
blocage** (`vanessa5723`, §3). On refuse « tout d'un coup » définitivement. Les
trois voies SÛRES, mesurées dans le code :
1. **À l'affichage (gratuit, illimité, déjà là)** — `vinted-capture.js` lit photos
   + description **de la page qu'il ouvre lui-même** : **zéro requête** à Vinted
   (c'est lui qui l'a chargée). `onPage()` tourne à la 1re page ET à chaque
   navigation, re-essais lazy. C'est le vrai levier de vitesse : parcourir ses
   annonces les capte en entier, instantanément. Rien à coder.
2. **Au clic « Publier » (1 lecture, sur son clic)** — `completerPhotosSiManque`
   dans `publierDepuisApp`, AVANT de construire l'ad : si la paire n'a aucune
   photo captée, on va la chercher tout de suite (`completerPhotos` → page de
   l'annonce, sous garde de LECTURE, dans la file Vinted). Il ne publie plus sans
   photos, sans attendre le fond. §4.10 : exécuté au banc (capte si manque, ne
   relit pas si déjà là).
3. ⚠️⚠️ **La capture de fond AFFAMAIT les vraies actions.** `capterPhotosAnnonces`
   passait par `garde` → **budget d'ACTIONS** (20/h, partagé avec accepter une
   offre, générer un bordereau). `tickPhotos` tourne chaque minute, 20/tour : elle
   **vidait le budget**, et les offres/bordereaux tombaient en « 20 actions dans
   l'heure ». Or lire la page de SES annonces est une **LECTURE** (§messagerie
   5.135 : « une lecture ne consomme pas le plafond d'actions »). ⇒ `gardeLecture`
   + `compterLecture` : un **budget de lecture séparé** (20/h aussi). Ça
   n'ACCÉLÈRE pas (monter le chiffre = deviner le seuil de Vinted, refusé §3) —
   ça **empêche la capture d'affamer les actions**.
- `audit-photos-passif.cjs` : **21 contrôles**. §6.1 prouvé — budget d'actions
  PLEIN : code d'avant **0 lecture** (2 rouges), après **lit quand même** et le
  budget d'actions reste intact. Extension **5.144.0**, zip régénéré,
  `EXT_ATTENDUE` suivie. Aucune entrée d'`EXT_CAPACITES` (pacing interne +
  lecture à la demande ; l'app ne promet rien de neuf gaté sur une version).


### Logo iPhone : icônes PWA régénérées (3 octobre)
`apple-touch-icon.png` + `icon-192/512/maskable` portaient encore l'ancien logo
orange ; régénérées depuis `logo-vrm.png` (VRM Noir), maskable avec marge sur
fond `#07090D`. iOS cache l'icône d'accueil : retirer le raccourci et le rajouter.


### Le stock 3D à la souris (4 octobre)
Julien : « améliore le stock en 3D pour que ce soit facile à la souris, mets-toi
à la place de l'utilisateur ». **Mesuré d'abord** : quatre réglages posés sur
OrbitControls, tout le reste aux défauts — sur sa pièce (17 × 10 m) un carton
faisait ~11 px, la molette avançait de 5 % par cran vers le CENTRE de la pièce
(le meuble visé sortait de l'écran), la vue traînait 9 images derrière la main.
- **Réglages** (`Room3D`) : amortissement 0,2, rotation 0,6 à la souris,
  `zoomToCursor` + `zoomSpeed 3` (≈ 14 %/cran vers le point visé), déplacement
  au sol, distance max = 1,35 × la vue d'ensemble (44 m → ~27 m chez lui), cible
  **bornée à la pièce** (on ne passe plus sous le plancher). Ce sont des valeurs
  de RESSENTI : à ajuster avec sa main, sans toucher à la logique.
- ⚠️⚠️ **UN CLIC DROIT POUVAIT RETIRER UN CARTON.** `pd`/`pu` ne regardaient pas
  le bouton : un clic droit sans bouger (le début d'un déplacement de vue) sur
  une pile choisie ouvrait la saisie « laisse VIDE pour la retirer ». Seul le
  bouton gauche « tape » désormais.
- ⚠️⚠️ **LE SURLIGNAGE NE TOUCHAIT JAMAIS LES CARTONS** : il teintait
  `material.emissive`, or un carton porte un TABLEAU de six matériaux — une pile
  n'était jamais surlignée, et dans une grille c'étaient les cases VIDES qui
  s'allumaient (matériaux partagés en prime). Remplacé par des **contours**
  posés sur la boîte englobante, couleur d'accent (§7 : plus de rouge, réservé
  au doublon de numéro). La recherche vise **le carton précis** (`pileIdx`/`num`),
  plus toute la pile.
- **Survol** (souris seulement) : curseur main / attraper, contour, et une bulle
  dont le texte vient **des données** (nom du meuble, N° du carton). Les
  étiquettes flottantes ne volent plus les clics (`raycast` vide).
- **Double-clic** : se mettre en face d'un meuble ou d'une case (vol de 420 ms,
  sortie douce, **interrompu dès qu'on attrape la vue**). ⚠️ Sur une case d'un
  meuble DÉJÀ choisi, le clic simple attend 280 ms : sans ça le 1er clic du
  double-clic ouvrait la saisie et le 2ᵉ tombait dessus (vu au banc). Choisir un
  meuble reste instantané.
- **Clavier** (la zone prend le focus) : ← → tourner, ↑ ↓ + − zoomer, Début
  toute la pièce, F de face, Échap désélectionner. **Mouvement réduit** respecté
  (pas de vol, pas d'inertie).
- ⚠️ **La carte de l'audit disait « ← → font quitter le Stock » : FAUX** — le
  Stock n'est pas dans les onglets du bas, `slideTab` l'ignore. Le contrôle que
  j'avais écrit pour ça ne pouvait pas échouer (prouvé en retirant la garde : il
  restait vert) : retiré. *Un contrôle qui ne peut pas échouer est pire
  qu'absent.*
- **Pas fait, et pourquoi** : le rendu à la demande (la boucle tourne en continu,
  ombres 2048 à chaque image) — c'est l'étape qui peut FIGER l'écran sans erreur
  si une mutation oublie de redemander une image ; à faire seule, avec son
  propre banc. Les étiquettes à taille constante à l'écran, l'aide au premier
  passage, un canvas plus haut sur ordinateur.
- Banc `garage3d.cjs` (pièce inventée, il vit dans le dépôt) : survol, clic
  droit, surlignage du carton cherché, molette, clavier, double-clic. Preuve par
  **réaffaiblissement** (la sonde n'existe pas sur le build d'avant, donc « rouge
  avant » n'y prouverait rien) : remettre le clic droit qui tape → **2 rouges** ;
  retirer l'attente du clic → le double-clic **rouge**.


### ⚠️⚠️ « ANNONCES = LES PAIRES EN LIGNE MAINTENANT » — LA RELECTURE PUBLIQUE DE SES AUTRES COMPTES (11 octobre, 5.167)
Julien : « j'avais supprimé mes annonces sur Vinted… il y avait encore toutes mes
annonces sur VRM… trois fois la même paire alors qu'il n'y a qu'une seule
annonce. Il faut que ce soit les paires qui sont en ligne actuellement. »
**Mesuré (lecture seule)** : le dressing d'un compte n'est relu que quand Chrome
est CONNECTÉ dessus (un seul jeton vivant à la fois). `arthuror2` (10 annonces
« en ligne ») et `tomj683` (6) n'avaient pas été relus depuis le 8 octobre
22 h 30 : tout ce qu'il y avait supprimé ou republié depuis restait affiché.
- **L'extension relit ses AUTRES comptes à chaque visite** — la vue PUBLIQUE de
  leur dressing (`GET /api/v2/wardrobe/{profil}/items`, ce que voit n'importe
  quel visiteur), avec les cookies de l'onglet, **jamais** le jeton d'un autre
  compte (`activeFetchAll` reste retiré). `relireAnnoncesAutresComptes` :
  uniquement des comptes À LUI (`vinted_accounts`), jamais un masqué ni un
  supprimé (`vrm_blocked_accounts`, `hidden` — une de ces listes illisible ⇒
  personne ; « refusé par Vinted » est une liste PROPRE À L'APPAREIL, que
  l'extension ne voit pas — revue ci-dessous) ; 3 comptes par visite, pas un
  compte relu depuis moins de 30 min ; une requête à la fois dans
  `requeteVinted`, pause/frein respectés (un 403/429 écarte le compte 24 h —
  revue ci-dessous) ; budget de LECTURE (`gardeLecture`, classe `enligne` :
  après l'argent et les colis, AVANT les photos — revue) ; toutes les pages jusqu'à
  `total_entries`, un article d'un AUTRE membre ⇒ lecture rejetée, et une
  réponse **sans total annoncé** (forme inattendue, page vide sans pagination)
  ne décide RIEN — rangée, elle aurait fait « partir » toutes ses annonces.
  Incomplète ⇒ **rien n'est écrit**, nouvel essai dans 5 min. Complète ⇒
  `harvest_{uid}_enligne` `{ids, n, items, complet:true, capturedAt, source:'public'}`
  — une ligne À PART, jamais par-dessus `harvest_{uid}_listings` — puis
  `maj · annonces` à l'app.
- **UNE règle, la même texte pour texte dans l'app et l'extension**
  (`<enligne-regle>` : `enLigneDuCompte`, `enLigneDesLignes`) : la lecture
  COMPLÈTE la plus récente fait foi (son dressing ou la vue publique), datée par
  `dateLectureDressing` (`capturedAt`, jamais `updated_at` — la revue de la
  5.165, §11) ; une annonce absente de la vue publique plus récente **sort toute
  seule** (ce n'est pas une preuve de VENTE : elle ne devient pas « vendue ») ;
  une annonce republiée (seulement dans la vue publique) apparaît, avec ce que
  la vue publique en sait (titre, prix, photo) ; une suppression vue après la
  lecture la retire (`supprimeeApres`). Lecteurs : écran Annonces (`annBase`,
  via `dressingEnLigne`), tableau de bord, file et alertes Leboncoin de l'app,
  recherche, prix du marché, numérotation automatique (elle ne voit que
  `listings.items`), et côté extension `buildLbcData` / `buildEbayData`.
  `retirerSupprimees(Lignes)` n'existe plus : la règle les remplace partout.
- **Une lecture de plus de 24 h (ou sans date) ne compte plus « en ligne »** :
  ses annonces sont « à confirmer » — hors de la grille et des totaux, **rien
  n'est supprimé**, son numéro reste (pool append-only, §5). UNE ligne repliée
  au-dessus de la grille, dans `FraicheurAnnonces` (la même voix que les
  supprimées et les lectures anciennes, §7) : « ▸ N annonces de X à confirmer —
  dernière lecture il y a 3 j », qui s'ouvre au clic ; plusieurs comptes : TOUS
  nommés, chacun avec son nombre et son âge (revue de la 5.165). UN geste selon
  `extSait('enligne')` : à jour ⇒ « vérifiées à ta prochaine visite sur Vinted,
  sur n'importe lequel de tes comptes » ; en retard ⇒ mettre à jour, d'ici là
  ouvrir le compte ; téléphone ou sans extension ici ⇒ « avec l'extension VRM à
  jour, sur l'ordinateur où elle est installée ». La promesse « une suppression
  sort d'ici tout de suite » et l'avertissement « deux extensions » de la revue
  de la 5.165 restent, dans la même phrase. Pendant ce temps la file Leboncoin
  ne propose pas de les retirer (pas su) et l'anti double vente les compte
  encore. Lecture des lignes `enligne` ratée ⇒ la dernière connue (app : la
  session ; extension : le service worker), sinon « pas su » : seul un dressing
  de moins de 30 min décide, le reste est « à confirmer » et c'est DIT (revue
  ci-dessous — « on retombe sur le dressing seul » ressuscitait les supprimées).
- **Les bancs à fixtures** (`fx/`, une photo datée) recalent en mémoire la date
  de leurs dressings (`_instantane.cjs`, écarts entre comptes gardés) : sans ça
  une copie de la semaine passerait toute « à confirmer » et le banc mesurerait
  l'horloge.
- **Preuves** (méthode §6.1, sur la tête d'`integ-11oct`, ef03dc8) :
  `audit-enligne.cjs` (le VRAI `background.js` dans un `vm`, la vraie règle des
  deux fichiers, mêmes sorties) **62 contrôles, 16 rouges sur ef03dc8**, et
  **16 mutations sur 16** rouges (lecture la plus récente, « à confirmer »
  retiré, divergence app/extension, vendue, exclus, pas su, 3 par visite,
  30 min, total, sans total, page ratée, budget, file, écrasement de
  `listings`, autre membre, retrait sur une lecture partielle). Banc
  `enligne.cjs` (données inventées, 390 et 1512 px : 3 annonces d'une paire
  dont 2 supprimées ⇒ 1 seule, la republiée ; compte figé ⇒ « à confirmer »,
  hors grille et hors compteur ; republiée ⇒ affichée ; lecture ratée ⇒ rien
  ne disparaît ; téléphone) **25 rouges** sur le build d'ef03dc8 et rouge sous
  3 mutations (lecture publique ignorée 16, « à confirmer » retiré 14, ligne
  muette 14). `audit-supprimees` §7 compare les QUATRE lecteurs sur une ligne
  sans date (rien en ligne, la même liste « à confirmer ») ; banc `supprimees`
  2 rouges sur ef03dc8 (le geste).
- `EXT_CAPACITES.enligne` : **'5.170.0'** depuis la revue (`relireAnnoncesAutresComptes` — les 5.167 et 5.168 parties en production ne la portent pas). La 5.167 de cette branche
  porte aussi la numérotation (013), les suppressions et la revue de la 5.165.
- ⚠️ **Non mesuré** (aucun appel à Vinted d'ici) : la forme réelle de la vue
  publique (une annonce vendue y figure-t-elle, `total_entries` y est-il
  cohérent avec `items` ?) — si le total y compte des annonces que la liste ne
  rend pas, aucune lecture ne sera jamais « complète » et ses autres comptes
  resteront « à confirmer » (le sens sûr) ; la réaction de Vinted à 3 lectures
  publiques par visite ; le premier tour réel chez lui ; la copie de
  l'extension sans session (§ mesure du 11 oct.) qui lit arthuror2 et tomj683.
- **Geste de Julien** : installer la **5.170** (la revue ci-dessous — UN seul
  dossier, retirer toute autre copie de VRM dans `chrome://extensions`, dans
  chaque profil Chrome), puis ouvrir vinted.fr sur n'importe lequel de ses
  comptes — trois autres comptes sont relus à chaque visite.


### ⚠️⚠️ LA 5.170 DE PRODUCTION DITE « PÉRIMÉE », ET « RIEN D'AUTRE À FAIRE » SOUS « LECTURE SEULE » (11 octobre, 5.171)
Deux défauts de la revue du chantier ci-dessus, reproduits après la fusion
d'`integ-11oct` (annonces en ligne, photos) dans ce chantier.
- **Extension 5.171.0** : `main` a publié une **5.170** (PR #473) SANS ce
  chantier. Deux contenus ne portent jamais le même numéro.
- ⚠️⚠️ **Collision de numéros.** `CODE_DANS_ETAT`, `EXT_CAPACITES.liaison` et
  `jugeable` (pont, logo) étaient à 5.169 — en dessous de la 5.170 publiée, dont
  l'état n'a PAS `code` : sa 5.170 était dite « périmée » (« Lecture seule »,
  aucune commande ni session, « clique ⟳ » — faux : ⟳ recharge la même 5.170) et
  l'app lui promettait « je la connecte » sur un canal qu'elle n'ouvre pas.
  Les quatre frontières passent à **5.171.0**. **Invariant** : chaque frontière
  reste STRICTEMENT au-dessus de toute version publiée sans le champ.
  `scripts/audit-planchers-code.cjs` exécute `codePerime` et `extSait('liaison')`
  sur 5.168, 5.170 et ce que dit `origin/main` (sa version, `code:` dans son état,
  `demanderLiaison`) ⇒ **après un `git fetch`, il passe au rouge tout seul** si
  `main` publie encore une version sans ce code au niveau de la frontière : monter
  alors les quatre ensemble.
- **Le bandeau de liaison** disait « connectée ✓ — elle capte maintenant pour
  toi. Rien d'autre à faire. » AU-DESSUS de « Lecture seule » (une copie ancienne
  vivante : la session part adressée, les commandes restent coupées). Il lit
  l'état de l'extension (`raisonExtGlobale`, §11) et dit ce qui reste, avec le
  geste (`data-liaison-reste` : plusieurs · périmé · muette · absente · trop
  ancienne). La session VRM, elle, vient d'être posée : pas jugée ; une pause de
  Vinted n'appelle aucun geste.
- ⚠️⚠️ **TROUVÉ EN FUSIONNANT les deux chantiers** : l'écran Annonces
  (`FraicheurAnnonces`, chantier « en ligne ») promettait « elles seront
  vérifiées à ta prochaine visite » et « une suppression sort d'ici tout de
  suite » à une extension dont le CODE est périmé, pendant que la pastille disait
  « Lecture seule — clique ⟳ ». Un code d'avant ne fait pas ce que la version
  annoncée sait faire : périmé ⇒ aucune promesse, le même geste ⟳
  (`data-perime`). Et les bancs `enligne` et `supprimees` servaient un état
  « à jour » SANS `code` — une fiction depuis la frontière (§6.3) : ils servent
  la vraie forme (`code` à partir de `CODE_DANS_ETAT`, lu dans la source).
  `enligne.cjs` 13b : **2 rouges** sur le build de b4a7bc8, mutation rouge.
- Preuves : `audit-planchers-code.cjs` **6 rouges** sur 7187f88 et sur la fusion
  (7899211), 5 mutations rouges · `pont.cjs` (5.170 de production) **3 rouges**
  et `premierjour.cjs` **2** sur le build de 7899211 · `deux-extensions.cjs`
  (rendu COMBINÉ bandeau + pastille, Ma journée, 390 et 1512 px ; l'autre sens)
  **6 rouges** sur le build de 7899211, 3 mutations rouges.
- Vérifié après : 90 audits verts ; bancs rejoués un par un sur le build final —
  pont, premierjour, deux-extensions, badge, popup, publier, signal-annonces,
  tout-generer, filtre-compte, session, capacites, enligne, supprimees : verts.
  ⚠️ `publier` (3) et `signal-annonces` (1) sont sortis rouges UNE fois, sous une
  charge de 16 à 20 (d'autres sessions sur la machine) ; verts relancés seuls, et
  verts sur le build de la fusion : instables sous charge, pas un défaut.
- ⚠️ **Non mesuré** : la 5.170 réellement installée chez lui (les bancs simulent
  sa FORME : version sans `code`, pas de canal adressé — lue dans le code de
  `main`, jamais vue répondre).
- **Geste de Julien** : installer la **5.171** (pas la 5.169, jamais livrée) dans
  UN seul dossier, puis ⟳ dans CHAQUE Chrome.


### L'ATELIER DE REPUBLICATION — cinq tranches (27 octobre, « FAIS TOUT »)
Demande de Julien (dossier de 40 sections + clarifications) : préparer/éditer ses
annonces DANS VRM, en lots, et republier sur Vinted. Livré tranche par tranche,
chacune son banc §6.1. **Non destructif sauf la 5, qui ne fait que BAISSER un
prix en place.** Ouvre depuis **Annonces → ⋯ Outils**.
- **T1 — `AtelierBrouillon`** (bouton « ✨ Préparer » par carte) : brouillon VRM
  (titre, prix, photos) gardé dans `vinted_annonce_drafts`, **clé = N° VRM**
  (jamais recréé, §5). Rien n'est envoyé à Vinted.
- **T2 — réglages photo** (dans la modale) : rotation **fine ±15°** (le saut de
  90° était trop brutal, 27 oct.), luminosité/contraste/saturation/zoom, aperçu
  **CSS** (le CDN Vinted est *tainted*, pas d'export pixels — §15 : des VALEURS,
  pas des pixels ; la photo finale repart de l'original à la publication).
  Réglages communs à la sélection + exceptions, préréglages `vrm_photo_presets`.
- **T3 — `AtelierLots`** (« Lots — titres & prix ») : titre (préfixe/suffixe/
  remplacer/supprimer/insérer, pas de doublon, limite signalée **jamais coupée**)
  et prix (ordre explicite non cumulatif : ajustement %/€ ou commun → arrondi →
  terminaison → **plancher §19**), aperçu avant→après, écrit dans les brouillons.
- **T4 — `AtelierFile`** (« File de publication ») : ordre (monter/descendre/
  mélanger/trier), espacement fixe/variable **borné 1 h**, pause/reprise/arrêt,
  **reprise après interruption** (état gardé SYNCHRONEMENT dans `vrm_atelier_file`,
  jamais via `save` anti-rebondé, restauré EN PAUSE), éligibilité revérifiée
  **juste avant** chaque article (incomplet/vendu ⇒ sauté), verrou un-à-la-fois.
- **T5 — `republierVinted`** (extension) + mode réel de la file : **baisser le
  prix SUR VINTED, en place** (`PUT …/item_upload/items/{id}`), jamais supprimer
  ni créer. Double opt-in dans la file (case « Publier pour de vrai » + « Je
  confirme »). L'extension revérifie TOUT : confirmation · garde stricte · coffre
  vérifié · **modèle de CETTE annonce appris** (le corps que Vinted a accepté,
  capté dans `noterFicheVinted` → `vrm_vinted_modele`) — sinon refus, on ne
  devine pas. `EXT_CAPACITES.republier = '5.240.0'`.
  ✅ **Fait le 28 oct. (5.248, `recreerVinted`, voir la note en tête) — ce qui suit est l'historique** : le **delete+recreate** « brouillon→
  publier » (remonter une annonce en tête) demande de re-téléverser les photos
  (`POST /api/v2/photos`) et les champs EXACTS du `POST item_upload/items` — leur
  forme n'a jamais été mesurée d'ici (Vinted 403). **À câbler après qu'un dépôt
  manuel l'aura fait capter** (comme les formulaires eBay/Leboncoin) ; l'écrire
  à l'aveugle serait le défaut le plus coûteux du projet. La baisse de prix en
  place, elle, est sûre et livrée.
  ⚠️ **Et le modèle `PUT` n'est encore appris pour AUCUNE annonce** tant que
  Julien n'a pas modifié une annonce à la main avec la 5.240 : d'ici là la file
  réelle ressort « échec : format pas encore vu » (dit à l'écran), rien n'est
  touché. Premier geste : modifier une annonce à la main une fois.
- Preuves : `audit-republier.cjs` (vm, 13 contrôles, §6.1 `--prouve`),
  `bancs/atelier-file.cjs` (retiré le 28 oct., remplacé par `bancs/republier.cjs`),
  `bancs/annonces-carte.cjs` (T1/T2/T3). Extension **5.240.0**, zip régénéré.


### La pièce du Stock : vue du dessus, forme libre, meubles qui ne se traversent pas (17 octobre)
Julien : « la créer avec une vue du dessus… la forme que l'on veut… étagères métal,
bois, portants, tables… si on enlève celui du dessous, celui du dessus descend…
une petite animation vers une vue 2D du dessus… un bouton dans Colis qui met en
couleur les numéros vendus ». Les règles vivent dans **`src/stockRegles.js`**
(pur, exécuté par `audit-stock-plan.cjs`) ; l'écran, la 3D et l'audit les appellent.
- **Forme libre** : `room.poly` (coins en mètres, cadre 0..w × 0..h, normalisée au
  coin 0,0 — tout ce qui est posé suit le décalage). Absente = le rectangle d'avant,
  rendu à l'identique. `PlanDessus` (dans « Aménager la pièce ») : tirer un coin
  (calé à 25 cm), « + » au milieu d'un mur, retirer un coin, formes Rectangle / L /
  U / T, cotes des murs ; on glisse aussi les meubles. Une forme qui se recoupe ou
  de moins d'1 m² est refusée ; une forme qui laisserait un meuble dehors aussi.
  La 3D (`Room3D`) dessine sol, murs et plinthes de la forme ; « coller au mur »
  vise le mur DROIT le plus proche.
- **Meubles** : palette réduite à Étagère métal (montants, plateaux, croix), Étagère
  bois, Portant à cintres, Table, Cartons au sol, + Murs (porte, fenêtre) et Décor.
  Les anciens types (grille, commode, étagère d'avant, casiers…) sont `hidden` —
  **gardés** : sa pièce en porte (mesuré : 2 grilles, 1 étagère, 1 commode, 2 tables,
  1 pile) et ses numéros rangés ne bougent pas. Les onglets Grille et Photos du
  Stock sont retirés (mesuré vides chez lui) ; un choix mémorisé retombe sur la pièce.
  Une table d'avant VIDE reçoit des places sur son plateau (migration sans perte).
- **Deux physiques de case** (`modeCase`) : `colonne` (mur de boîtes : la colonne
  tombe, comme avant) et `pile` (plateau : les boîtes s'empilent DANS la case, 2
  par case sur une étagère métal, plusieurs sur une table ; rien ne tombe d'un
  plateau à l'autre) ; `cintre` = un numéro par cintre. L'assistant « Ranger » 2D
  suit les deux.
- **Non-traversée** (`placerSansTraverser`) : ajouter, déplacer (3D ou plan),
  dupliquer, pivoter, élargir — poussé jusqu'à la place libre la plus proche, ou
  refusé et dit (jamais posé en travers, jamais hors de la pièce, coin rentrant
  d'un L/U compris). Ce qui est POSÉ sur un meuble le suit ; meuble retiré ⇒ ce
  qui était dessus redescend au sol. Une pile glissée dans le plan se pose sur la
  table visée, sinon au sol.
- **Gravité vue** : la 3D note la hauteur de chaque boîte numérotée avant de se
  reconstruire ; une boîte du même meuble et du même numéro qui se retrouve plus
  bas TOMBE (300 ms, rien si « réduire les animations »).
- **Vue du dessus** : après un changement de disposition, la caméra monte à la
  verticale (~620 ms) ; « ↩ 3D » revient.
- **Aperçu** : la feuille « Ranger » montre le meuble vu de face, la case visée en
  accent (`ApercuMeuble`). Toucher une boîte : changer son N° ou la sortir.
- **Colis → Stock** : « Où sont ces N paires dans le stock » (N° des colis à faire,
  lus sur la ligne) ouvre le Stock, colore chaque carton (un contour par paire) et
  dit où est chacun — ou « rangée nulle part » (`DEMANDE_STOCK_CHERCHE`, module).
- Preuves : `audit-stock-plan.cjs` (32 contrôles, `--prouve` 5/5 mutations au
  rouge) ; banc `stock-piece.cjs` (port 6311, 1512 + 390 px) **11 rouges sur le
  build d'avant**, 0 après, et 6 réaffaiblissements de l'app chacun rouge (la pile
  ne suit plus la table · reste en l'air · pas de chute · Colis sans couleur · sans
  vue du dessus · meubles qui se traversent). `garage3d`, `rangement`,
  `compta-stock-ui` restent verts.
- **Non mesuré** : un vrai téléphone (le WebGL du banc est logiciel) ; la lisibilité
  de la vue du dessus sur une très grande pièce ; Julien n'a pas encore ouvert sa
  pièce réelle avec ce code (lecture seule de sa base : 2 pièces, 8 meubles).


### Revue de tous les écrans après les sept chantiers (17 octobre)
Banc `revue-ecrans.cjs` (fixtures, chaque écran et chaque section, 390 tactile
et 1512, clair · sombre · mode stream). **32 rouges sur a80f584, 0 après.**
- ⚠️⚠️ **Le mode sombre CHOISI repassait en clair** sur un appareil neuf, après
  une reconnexion ou un cache vidé : une « bascule Minéral » armée sur un drapeau
  du `localStorage` (`vrm_bascule_mineral_v1`) remettait `vinted_dark` à faux au
  premier écran — et le POUSSAIT dans le nuage (tous ses appareils en clair).
  Trois bancs posaient ce drapeau à la main pour ne pas le voir. Retirée (§5 :
  aucune migration ne s'arme sur le `localStorage`).
- **Leboncoin → Achats était un écran blanc** sans achat capté (`AchatsLeboncoin`
  rendait `null` sous une section toujours dans la navigation) : il dit
  maintenant « jamais lu » ou « lu, aucun achat » (`data-lbc-achats-vide`).
- **eBay → Ventes disait « 0 · 0 · 0,00 € »** sans aucune ligne de commandes
  rangée (jamais synchronisé) : rien lu ⇒ « — » et la phrase qui dit de relier
  le compte. Les brouillons ne disent plus « prépare une annonce ci-dessus »
  quand il n'y a rien au-dessus (compte pas relié).
- **Replis avec le triangle du navigateur** (Statistiques, Compta « Comment
  c'est calculé », Réglages, Comptes liés « Gérer ce compte », frais d'une
  vente) : même chevron partout — un filet CSS pour tout `<summary>` sans forme
  à lui (pas de classe, pas de `list-style`, pas d'icône étiquetée), les trois
  `listStyle:'revert'` retirés.
- §7 : « Retirer mon argent » ne redit plus le disponible écrit juste au-dessus
  (il dit où il est), et passe SOUS la navigation de Vinted ; la carte Résultat
  de Compta renvoie à « Ta déclaration URSSAF » au lieu de redire « 162 ventes
  sans date de versement (6983,57 €) ».
- **Constaté, laissé** : la scène 3D du Stock garde son ambiance (claire par
  défaut) en mode sombre — c'est un réglage à part (« Ambiance ») ; la fixture
  du 5 octobre n'a pas de pièce (« Ta pièce est vide » au banc).


### Le zoom mobile à 80 % : la compensation complétée (19 octobre)
Le 18 (« densifier le mobile »), `.vrm-main { zoom:.8 }` sur téléphone, avec une
compensation (55 px) posée seulement sur la règle générale des boutons. Mesuré
par les bancs le 19 : toute règle plus précise « 44 px » l'emportait et
retombait à **35 px affichés** (sous-onglets des plateformes, filtres, segments,
interrupteurs, champs, liens, `style={{minHeight:44}}` en ligne) — `coque-mobile`,
`plateformes-premium`, `reglages-premium`, `ventes-colis-premium` rouges. Et la
vue 3D du stock, réduite à 80 %, avait ses commandes (◀ + − ▶) PAR-DESSUS le bas
de l'étagère : toucher une boîte du bas touchait un bouton (`stock-finitions`,
bissecté jusqu'à a808208). ⇒ Bloc de fin de `styles-mineral.css` : 55 px (44
affichés) à tout ce qui se touche dans `.vrm-main`, la 3D à sa taille affichée
d'avant. La densité voulue ne change pas. ⚠️ **Toute nouvelle cible tactile ou
hauteur en `vh`/px dans `.vrm-main` se pense ×1,25 sur téléphone.**
- Écran **Organisation** (nouveau) : accepté par `?tab=`, rendu par
  `verif_visuel`/`verif_dark` ; une réponse non JSON (panne) est dite en
  français, et la lecture ratée UNE fois.


### Revue de tous les écrans après les fusions du 19 octobre
Rendu de chaque écran et section (390 tactile, 1512, clair, sombre), captures
hautes regardées. Corrigé, chacun prouvé par `scripts/bancs/revue-19oct.cjs`
(**15 rouges sur le build de 47e9249**, 0 après ; `EXPLORE=dossier` fait les
captures et liste les cibles < 44 px) :
- ⚠️ **Ma journée « En attente » comptait l'argent des comptes SUPPRIMÉS** (2 240 €,
  « 9 porte-monnaie », « lu il y a 69 j » ; le résumé Vinted disait 1 995,80 €) :
  la lecture partait au montage, avant les comptes (liste vide = aucun filtre),
  et n'était jamais refaite. Elle attend les comptes et suit leur liste (`_cle`).
- Annonces : « elle ne est pas comptée » ; et le bouton « N annonces à
  confirmer » trouait le paragraphe (`margin:0` en ligne battait la marge
  négative de compensation : il porte `vrm-lien-action`).
- Achats, colis jamais retirés : « Je l'ai eu » changeait de place d'une ligne à
  l'autre (groupe de gestes `vrm-oublie-gestes`, poussé à droite, sa ligne sur
  téléphone), l'âge était coupé (« il y a… »), « Vérifier » faisait 21 px, et le
  bloc était ROUGE (§7 : rouge = deux paires sous un N°) ⇒ ambre.
- Colis : « ✅ 15 colis partis » en vert menthe `#0F8A6A`, juste sous « Partis —
  Vinted suit le colis · 26 » (une autre notion) ⇒ « 15 bordereaux déjà
  traités », neutre. En lignes (1512), « Colis fait » glissait de la 3ᵉ à la 2ᵉ
  place quand « Imprimé ? » manquait ⇒ une colonne par geste (`data-geste`).
- Compta, prochaine échéance : « CA finalisé 0,00 € » sous un tableau qui dit
  « Finalisé 4 224,77 € » pour le même mois — le montant est le **reçu (versé)** ;
  libellé corrigé, et « au moins » quand la ligne publiée porte des ventes sans
  date de versement (`data-echeance-partiel`).
- Cibles au doigt : les valeurs éditables en place (« achat — » 10 px de large,
  « N°2 » 25 px), « Déclarer sur l'URSSAF » (26 px), le « voir » de Colis, le
  lien « Ouvrir la conversation ↗ » d'Achats (`.vrm-pickup-lien`, banc
  `achats-messages-premium`, rouge avant).
- **Laissés, avec la raison** : `stats-premium` rouge (3) depuis 866a90d (commit de
  Julien du 18 oct. : la courbe « Vendu » replie son explication sur téléphone,
  tailles 12/14 px) — son choix de design ; sur téléphone, les gestes secondaires
  d'un colis se partagent la ligne (décision du 16 oct.), donc « Colis fait » n'y
  a pas de place fixe ; `INV_STATUS.online.color` (le vert menthe) reste dans 60
  endroits (pastilles « Reçu », boutons à texte blanc : un neutre y rendrait du
  blanc sur blanc en sombre — à reprendre site par site) ; « 162 ventes sans
  date de versement » est dit trois fois sur Compta (trois cartes, trois
  chiffres) ; eBay « Réponse eBay incomplète » ×4 sur À traiter vient du banc
  (il sert `{pret:true}` à toute route `/api`, une forme que la route ne rend pas).


### Les photos de fond ne font plus freiner Vinted, et sa description enregistrée est gardée (22 octobre — propositions 3 et 13, extension non montée)
**Mesuré (lecture seule, `panel_diag_capture` de Julien, extension 5.211)** :
`vinted_frein_429` = 23 = `photos_page_refuse_429` = 23 — les 23 « trop de
demandes » venaient TOUS d'une page d'annonce lue pour ses photos ; paliers de
pause 1/2/3 : 24/2/1, soit **27 pauses = 23 (les 429, tous d'une page photo) + 4
(des 403, `vinted_frein_403` = 4, sur d'AUTRES requêtes : aucun
`photos_page_refuse_403`)** — rien n'est promis sur la disparition des pauses ;
`visite_en_pause` = 119 visites sautées ; dernière pause le
22 à 05:10 (`quoi: page`). Cause : `capterPhotosAnnonces` lisait jusqu'à 20 pages
d'affilée, sans écart, à chaque minute (`tickPhotos`) ET à la fin de chaque visite.
Et sur ses **49 annonces en ligne, 4** ont leur description dans
`vinted_item_details`, **0** leur catégorie ou leurs couleurs
(`fiche_codes_absents` = 804) — alors que ses modifications partent en
`PUT /api/v2/item_upload/items/{id}` avec `{item:{id, description, catalog_id,
brand_id, color_ids, item_attributes…}}` (6 modifications mesurées : l'`id` du
corps est toujours celui de l'adresse). `vinted_item_details` est bien la ligne
de la publication (`buildLbcData`, `buildEbayData`, l'app, le coffre) — pas le
coffre seul.
**Tranché (3)** : une page photo par tour d'alarme (`PHOTOS_PAR_TOUR` = 1), jamais
deux à moins de 45 s (écart FIXE, §3), aucune pendant qu'il navigue sur Vinted
(2 min de calme, vu par `chrome.tabs.onUpdated` et la visite, zéro requête), plus
aucune dans la visite ; un 429/403 sur une page photo pose la pause habituelle
(le reste de l'extension la suit) ET coupe les photos de fond 24 h
(`vrmPhotosFrein`). Le budget horaire n'a pas bougé (`gardeLecture`). Le clic
« Publier » (`completerPhotos`) ne subit ni l'écart, ni le calme, ni le frein
photos. La liste à compléter est calculée une fois par 15 min (`vrmPhotosPlan`)
et les fiches lues partent en UNE écriture pour 5 pages (`vrmFichesAttente`,
§4.4) — sinon la ligne de 283 Ko redescendait pour chaque page.
**Tranché (13)** : `inject.js` transmet la fiche après un 2xx de Vinted seulement,
sous l'identifiant de l'ADRESSE (modification) ou de la RÉPONSE (publication) ;
le fond n'en garde que la description et les codes (catégorie, marque, couleurs,
taille, état, format), jamais les photos envoyées ni la session de dépôt ; une
valeur vide ne remplace jamais une pleine ; un `id` de corps qui contredit
l'adresse ne range RIEN. Même file que les pages (`noterFicheVinted` →
`viderFiches`), rangée tout de suite ; base illisible ⇒ rien n'est écrit, la
fiche attend (et le rangement automatique attend 10 min après un échec).
La couleur AFFICHÉE (« Blanc ») n'est pas dans le corps : seuls ses codes sont
rangés, rien n'est inventé.
**Prouvé** : `audit-photos-etalees.cjs` (30 contrôles, horloge pilotée) — **17
rouges** sur `origin/main` (20 pages à la minute 0, 17 pages dans la visite,
19 pages pendant la « pause finie », versements affamés à 0) et 7 mutations qui
rougissent ; `audit-fiche-modif.cjs` (22) — **12 rouges** sur `origin/main`
(la file Leboncoin partait avec « Envoi rapide et soigné… ») et 4 mutations.
Adaptés à « une page par tour » sans affaiblir la règle : `audit-photos-passif`,
`audit-budget-lectures`, `audit-fiabilite-fond` (une relecture ratée ne fait
plus relire Vinted : la fiche attend). `_fond-vm.cjs` rejoue `tabs.onUpdated`.
**Non mesuré** : le rythme réel que tolère Vinted (aucun appel d'ici) ; la forme
du `PUT` hors des 6 modifications vues ; que la page de dépôt envoie la
publication en `fetch` ou XHR (les deux sont couverts). **Version et zip non
montés** (à l'intégration) : `audit-extension-zip` et le contrôle de version
d'`audit-preuve-vente` sont rouges tant que la 5.211 n'est pas montée et le zip
régénéré ; les 65 autres audits qui exécutent l'extension sont verts. **Geste de Julien**, une fois l'extension installée : ouvrir
« Modifier » puis « Enregistrer » sur ses annonces déjà en ligne.

## 7. Le visuel

Règle unique, posée après six passes ratées :

> **UNE SEULE couleur d'accent, et elle est RARE.** Tout le reste est neutre. Un
> chiffre ne porte une couleur que s'il y a **vraiment quelque chose à rattraper**.

Famille actuelle (30 septembre, **« VRM Noir » tirée du logo de Julien** —
`public/logo-vrm.png` : carré noir, « VRM » argent, liseré bleu) : sombre
`#07090D` / cartes `#10141B` / rail `#030406`, **un seul accent bleu
électrique `#3D7BFF`** (clair : fond `#F4F6FA`, accent `#2458E6`). Le logo
(image) est en petit en haut (en-tête téléphone, rail ordinateur) ; la pièce
3D de l'accueil est RETIRÉE (demande de Julien, elle chevauchait le titre sur
téléphone). La menthe est abandonnée. Mode sombre choisi, pas inversé
automatiquement.
Rayons **5 / 8 / 10 / 12** (plus de 2-3-4 px éparpillés), ombres à **deux
couches** (contact serré + diffusion large et pâle).


### Les boutons — une seule forme (`audit-boutons.cjs`)
Mesuré : **22 hauteurs, 22 paddings, 13 tailles de texte** sur 561 boutons, dont
47 à la police PAR DÉFAUT du navigateur. C'est la dispersion qui se lit « pas
fini », pas la couleur. Une règle de base dans `index.html` pose police, taille,
graisse, hauteur plancher et transition — et **rien d'autre** :
⚠️ **ne jamais y mettre `display:inline-flex`.** Un `<button>` centre déjà son
contenu ; le forcer a centré le rail de navigation et aplati le chiffre
cliquable « Coût d'achat » sur une seule ligne (vu en capture).
Les styles **en ligne** gagnent sur une classe : la règle ne pose donc que ce
qu'un bouton ne fixe pas lui-même.


### L'extension au doigt, et le bon geste selon le téléphone (19 octobre, 5.192)
Julien : « l'extension pour iPhone et Samsung ». **Mesuré** (détail et sources :
`docs/boutiques-extension.md`, section Téléphone ; `developer.samsung.com` et
`help.kagi.com` bloqués d'ici, lus par extraits indexés) : Samsung → **Firefox
pour Android** seulement (paquet 5.188, fiche AMO à publier) ; **Samsung
Internet impossible** (programme d'extensions fermé, Galaxy Store) ; Chrome
Android ❌ ; Edge Android : catalogue choisi par Microsoft ❌ ; Kiwi abandonné ;
Lemur/Quetta/Yandex non essayés (jamais proposés) ; iPhone : Safari exige une app
iOS (Xcode, programme Apple 99 $/an, revue) ❌ sans chantier ; **Orion** expérimental
(fiche publiée exigée) ; sinon **le relais** de l'ordinateur.
- **Badge au doigt** (`vrm-badge.js`) : `pointerType` du dernier geste (repli
  `hover: none`) — au doigt, toucher le logo OUVRE la carte (plus d'ouverture de
  VRM à l'aveugle), qui porte « Ouvrir VRM » / « Se connecter avec VRM » et une
  croix (≥ 44 px) ; toucher ailleurs la referme ; le survol reste à la souris
  (`pointerenter` filtré). Le retour sur un « Non » (« Capter ce compte ») se fait
  au toucher. Cartes `min(300px, 100vw − 32px)`, hauteur bornée à l'écran. À la
  souris, rien ne change.
- **Popup** : meta viewport, au doigt la largeur suit l'écran et les champs
  passent à 16 px (iOS ne zoome pas).
- **App** : `mobileIci()` (`ios · firefox-android · samsung · android · autre`,
  Samsung lu par « SamsungBrowser » AVANT Chrome) ; les premiers pas disent ce que
  CE navigateur accepte (`data-premiers-mobile`), « Installer Firefox pour
  Android » seulement quand `LIENS_BOUTIQUES.firefox` est rempli (aucun lien
  deviné), l'iPhone apprend le relais (`data-premiers-relais`) ; Orion seulement
  sur iPhone. Le panneau d'état (`raisonExtGlobale`, repli téléphone) ne propose
  la boutique Firefox que publiée.
- Preuves (§6.1, bancs copiés dans l'arbre de 65eec06, build refait là) :
  `badge.cjs` **4 rouges** avant (le premier toucher ouvrait VRM, aucun bouton
  dans la carte), `popup.cjs` **9 rouges** (300 px figés, champs 14 px, pas de
  viewport), `premierjour.cjs` rouges sur les attributs Samsung/Android/iPhone ;
  `pont.cjs` + Samsung Internet / Firefox Android / iPhone sans extension (aucune
  boutique promise). `web-ext lint` du paquet Firefox : 0 / 0 / 0.
- ⚠️ **Non mesuré** : un vrai Firefox Android, un vrai Orion, un vrai Samsung.
- **Gestes de Julien** : publier `VRM-firefox.zip` sur AMO (cocher Firefox pour
  Android) puis remplir `LIENS_BOUTIQUES.firefox` ; sur iPhone, rien (relais).


### Revue de tous les écrans après #596-#598 (20 octobre)
Rendu de chaque écran et section (390 tactile clair, 1512 sombre, fixtures), captures regardées, 115 audits et tous les bancs relancés un par un ; chaque rouge comparé au build d'avant #596 (ed066d3). Banc `revue-20oct.cjs` (port 7795) : **20 rouges sur le build d'avant, 0 après**.
- ⚠️ **La marge négative des liens-textes suivait encore l'ancien zoom** (-16 px pour 44 px de zone) : « Retirer mon argent » sortait de sa carte, « voir », « tout voir », « Compléter les prix d'achat » mordaient sur leurs voisins ⇒ -12 px (`styles-iphone.css`). « Retirer mon argent » n'est plus pris pour un lien-texte.
- **Statistiques** : « Ventes enregistrées ·aujourd'hui 0,00 €· ce mois » (un `<summary>` en flex avale les espaces de bord) ⇒ en bloc. La carte « Vendu · 12 derniers mois » écrivait le mois en cours deux fois (« 2 338 € » et « 2337,80 € », la légende de `CourbeMois` ajoutée le 18) ⇒ `legende={false}` là. L'anneau disait « 6984 € » au centre et « 6983,57 € » dans sa légende ⇒ le montant exact ; à 390 la légende tombait à « Vin… » ⇒ elle passe sous l'anneau.
- **Cibles au doigt** tombées à 28-32 px avec les listes compactes : « Gérer l'annonce », et dans une vente OUVERTE « Bordereau », « Saisir le prix », « Relier un achat », « Modifier », la facture (et les gestes d'une commande eBay ou d'un colis Leboncoin) ⇒ 44 px, marge négative pour garder la ligne fine (`styles-mobile-studio.css`).
- **eBay → Ventes** : la vente compacte cachait son statut (le point de couleur) et le compte eBay dans le détail replié ⇒ `etatNoeud` de `LigneVenteCompacte` : statut + point + pseudo (plusieurs comptes) sur la ligne repliée (ebay-comptes vert ; ebay-visuel, rouge avant #596, vert aussi). Les listes Ventes/Annonces eBay ne peignent plus une dalle de fond par-dessus la page.
- **Compta** : le tableau « par période » coupait sa 4ᵉ colonne à 390 ⇒ tient dans la carte (`.vrm-ca-table`) ; ses titres gardent la casse normale (`vrm-titre-compta` : les capitales espacées sont celles des groupes de Réglages).
- **Leboncoin → Colis** disait « Aucun colis » sans lecture de « Mes transactions » ⇒ « pas encore lu » (`data-lbc-colis-vide`). **Organisation** : la lecture ratée n'est plus rouge (§7) et dit que rien n'est perdu.
- Bancs mis à la forme « une ligne par vente » sans les affaiblir (ouvrir la vente comme lui, viser le bouton VISIBLE) : achats-hors-plateforme, deux-extensions (+ `BANC_PORT`), menu-range (le bouton caché « Tous les écrans » de l'en-tête), ventes-bordereau, revendeurs, perfv (logo renommé `/vrm-logo-*`, l'en-tête « Article · état » n'est pas une vente), journee-premium (le bonjour à 0 px sur téléphone est compact), prouve-regle-offre (5 ancres suivies jusqu'au code actuel).
- **Rouges AVANT #596, laissés (cause à part, notés)** : compact, dictee, lbc-publier-app (H : téléphone), mobile, numeros-lettres, numeros-remise-a-zero, photos-vinted, pont, sauvegarde, serie (la porte « Coût d'achat » introuvable sur Ventes), session, stats-premium (choix de Julien du 18 oct.), prouve-regle-offre (« base d'avant » : l'arbre `/tmp/avant-regle` n'existe que chez qui le fabrique).


### Une vente, une photo : la ligne et le détail montrent la même (20 octobre)
Julien : « quand je clique sur la vente d'une paire, il y a une AUTRE photo qui apparaît ».
- **Cause** : la ligne repliée de Ventes affichait la PREMIÈRE source (`PhotoVente src={photo}`), le détail déplié choisissait la sienne parmi plusieurs (`PhotoVenteSources` : la première qui CHARGE). Dès que la vignette de la commande ne chargeait pas, les deux images divergeaient ; et la ligne retombait sur `photoArticle(resolvedEntry(o))`, qui peut venir d'un ancien verrou `vinted_txn_link` posé par TITRE (§5).
- **Mesuré (lecture seule)** : sur 606 ventes, les sources par identité (commande, annonce par `txnItem`, coffre) portent toutes la MÊME photo (même dossier CDN : 0 écart) — c'est le CHOIX entre elles qui différait, pas les données. 8 fiches ont un achat relié, dont 5 avec sa photo (celle du vendeur à qui il a acheté).
- **Correctif** : une liste de sources pour la ligne ET le détail (`photosVenteVintedCandidates` + la fiche N° de CETTE annonce, par `txnItem` seulement) ; le choix et les échecs vivent dans un magasin partagé par vente (`cle` = [compte, transaction], `__choixPhotoVente`) : ce que l'un affiche, l'autre l'affiche. Plus de repli sur `resolvedEntry`. La photo de l'achat relié est dite « Photo de l'achat » / « Achat relié · … ».
- Preuves : banc `photo-vente.cjs` (données inventées, CDN servi par le banc, 390 tactile + 1512) — **7 rouges sur le build d'avant**, vert après ; mutations « ligne sur `PhotoVente` » ⇒ 2 rouges, « repli sur la fiche du verrou » ⇒ 2 rouges.
- ⚠️ Non mesuré : l'écran chez lui (aucun cas réel où les deux images diffèrent n'a pu être capté d'ici — le défaut vient d'un échec de chargement, propre à l'appareil).


### L'extension sur Orion iPhone, Safari et tous les navigateurs — capacités mesurées, vrais replis (20 octobre, 5.199)
Julien : « qu'elle marche sur Orion sur l'iPhone, pareil que sur Chrome », puis « tous les navigateurs ». Table des API par navigateur, sources et marche à suivre : **`docs/boutiques-extension.md`** (sections 1 à 7). Sources : copie publique des pages d'aide de Kagi (`kagisearch/kagi-docs`), notes de version d'Orion (`orion-updates-cdn`), extraits du forum d'Orion (bloqué d'ici), **MDN browser-compat-data** pour Safari et Firefox Android.
- **Le fond MESURE ses API** (`mesurerCapacites`, `CAP`), jamais l'agent utilisateur. Présente ⇒ le chemin de Chrome à l'identique. Absente ⇒ un vrai remplacement qui garde la fonction :
  · `cookies` → content.js lit `document.cookie` sur vinted.fr et donne les 3 cookies utiles (`vrm-cookies`, onglet Vinted et SON domaine seulement, rangés dans `vrmCookiesPage`) ; une session neuve relance la capture. Sur Chrome : un seul message `veux` → non ;
  · `alarms` → `PERIODES` (une liste pour les deux chemins), minuteries + `vrmMinuteries` daté dans `chrome.storage.local` ; au réveil (iOS a suspendu le fond) ce qui est en retard repart **une fois** (`rattraperMinuteries`) ;
  · `scripting` / monde MAIN → `executerMain` : la MÊME fonction, ses requêtes partent de la page par le relais (fond → content.js par `tabs.sendMessage`, sinon boîte aux lettres `vrmPageReq`/`vrmPageRep` → inject.js `CANCALE_VINTED_REQ`, GET `/api/` seulement, en-têtes `accept`/`x-csrf-token` seuls). Un refus ORDINAIRE d'`executeScript` (onglet fermé) reste un refus ;
  · scripts `world: MAIN` ignorés → `lbc-inject.js`/`vc-inject.js` se posent eux-mêmes par `<script>` (signe : `chrome.runtime.id` sans `document.currentScript`) ; `vc-inject.js` devient web-accessible ;
  · `externally_connectable` qui refuse (Orion, ticket 13767) → `versExtension` repasse par le pont sur un refus CERTAIN (`lastError`/levée), jamais sur un délai ;
  · `downloads` → les deux autres portes du bordereau ; `tabs` refusé dans la fenêtre → `window.open`.
- **L'extension le DIT** : `etatPourApp` porte `nav: {remplace, indispo}` (absent sur Chrome) ; le panneau d'état de l'app l'écrit en une phrase (`phraseNavigateur`, `data-etat-nav`). `indispo: ['cookies']` = la page n'a montré aucune session (déconnecté, ou cookies HttpOnly) — jamais une identité devinée.
- **Paquets** : `zip-extension.cjs --safari` (dossier `VRM-safari/` pour `xcrun safari-web-extension-converter` : fond non persistant, `downloads` retiré, Safari 16.4+). Orion : le paquet **Firefox** d'abord (`boutiqueOrion`, Orion préfère `background.scripts`). `web-ext lint` du paquet Firefox : 0 / 0 / 0.
- **App** : `navigateurIci` reconnaît DuckDuckGo, Yandex, Vivaldi (marqueurs UA) et Orion (`window.KAGI`, documenté par Kagi) ; `extensionIci` dit ce que chaque navigateur accepte ; premiers pas : DuckDuckGo « aucune extension », Orion iPhone sa consigne (`data-premiers-orion="dans-orion"`).
- **Au doigt** : le bandeau de dépôt Leboncoin tient à 390 px et ses boutons font 44 px (`pointer: coarse` + `hover: none` seulement — rien ne change à la souris). Banc `leboncoin.cjs` (`BANC_PORT`).
- Preuves : `audit-extension-navigateurs.cjs` sections G-I (profils `chromium`, `firefox-android`, `safari-ios`, `orion-ios`, `orion-ios-pire` dans `_fond-vm.cjs` — option `retirer`, `storage.onChanged` à état) : **30 rouges sur origin/main** (§6.1) ; `--mutation cookies|alarms|main` ⇒ 1 · 4 · 2 rouges ; parité : sans `scripting` ni `tabs.sendMessage`, exactement les mêmes requêtes Vinted que Chrome.
- ⚠️ **Non mesuré** : aucun vrai Orion, iPhone, Safari ni Firefox Android ; la liste officielle d'API d'Orion (feuille Google, bloquée) ; si les cookies de session de Vinted sont HttpOnly (déterminant sans API `cookies`) ; WebKit absent du conteneur. **Gestes de Julien** : publier `VRM-firefox.zip` sur AMO (kit prêt, section 3), puis essayer Orion sur l'iPhone (section 2) ; Safari : Mac + Xcode + compte Apple 99 $/an (section 4).


### Fiabilité laissée ouverte le 22 octobre : Ma journée relit moins, la barre des Ventes tient sur téléphone, les photos d'une extension muette (22 octobre)
Les trois points « reste ouvert » de `docs/passation/2026-10-22.md`.
- **Mesuré (bissection de `main`, une construction par fusion, banc `vitesse.cjs`)** :
  Ma journée à 390 px est passée de 54 à 64 lectures et de ~13 à 15-16 rendus
  entre le 21 et le 22 octobre. Cinq causes, toutes retirées (aucun plafond
  touché, 62 et 13) :
  1. #634 lisait les n° de suivi de **tous** les achats (560, six requêtes) pour
     n'en utiliser que ceux au point relais ⇒ sur Ma journée, seulement
     `vintedToPickup` (`demandesSuivis`, une clé stable) ;
  2. #635 lisait `vrm_blocked_accounts` à **deux** adresses (filtrée sur le
     vendeur et non) : le partage des lectures ne les réunit pas ⇒
     `purgerComptesSupprimes` lit à la même adresse que `fetchVintedAccounts` ;
  3. les brouillons eBay étaient lus pour « numéros à vérifier », qui ne vit que
     sur Annonces ⇒ lus sur Annonces seulement ;
  4. un signal `vrm:colis` re-rendait toute la coque (`colisTick`) puis la cloche
     reposait une liste identique ⇒ le signal relance la passe directement, et
     une liste, un index ou des réserves IDENTIQUES ne sont pas reposés ;
  5. `lireReceptionLeboncoin` passait `signal` et `cache:'no-store'` : la lecture
     sortait du partage (`lbc_ventes` lue trois fois) ⇒ attente bornée par une
     course, plus de signal.
  Mesuré après : **55 à 57 lectures (64 à 390 px et 63 à 1512 avant)** ;
  rendus médiane 13, de 12 à 14 (19/16/15 avant) ; texte de Ma journée
  **identique caractère pour caractère** à celui de `main` aux deux tailles
  (`VITESSE_REFERENCE`). ⚠️ Les deux textes se produisent à la MÊME heure : le
  bonjour suit l'heure (« Bon après-midi » contre « Bonsoir » a fait un faux
  écart au premier essai).
- ⚠️⚠️ **LE PLAFOND GLOBAL NE VOIT PAS LAQUELLE REVIENT** : les causes 1 à 4
  remises ensemble donnent **exactement 62 lectures et une médiane de 13
  rendus** — le banc était VERT sur la régression. D'où quatre contrôles, un par
  cause (n° de suivi ⊆ achats au relais, une seule adresse pour la liste noire,
  aucun brouillon eBay, 0 rendu sur le second signal) : **12 rouges** sur `main`
  (d198bca), 8 rouges sous les quatre mutations. La cinquième est prouvée par
  `scripts/tests/rafraichissement-leboncoin.test.mjs` (2 lectures pour 2
  demandes sur l'ancien code, 1 après).
- **Barre d'outils des Ventes, décidé** : sous 768 px, « Bordereaux auto » et
  « Mes vues » passent dans « ⋯ Outils » ; sur ordinateur rien ne bouge. Mesuré
  à 390 px : **273 → 113 px** de barre avant la première vente. Seuil du banc
  `revendeurs.cjs` revenu à 150.
  ⚠️ **Trouvé en le faisant, et c'était déjà cassé sur `main`** : sous 1024 px le
  menu « ⋯ Outils » s'ouvrait DANS la rangée qui défile (`.vrm-rangee`,
  `overflow-x:auto`) — coupé, Rapport comptable et Registre annuel
  intouchables au doigt. Il s'ouvre sous la barre ; le bouton reste collé à
  droite de la rangée. `revendeurs.cjs` : **8 rouges sur `main`**, 210 verts
  après ; menu remis dans la rangée ⇒ rouge, outils remis dans la barre ⇒ rouge.
- **`photos-vinted.cjs` : 40 rouges qui ne mesuraient aucune photo** — l'écran
  de connexion. La porte de banc (`_porte-banc.cjs`, chargée par `_meta.cjs`) se
  posait sur `require('playwright')` ; or le banc lance
  `/home/user/cancale-v67/node_modules/playwright`, et dans un **worktree dont
  `node_modules` est un lien vers un autre arbre** ce sont DEUX modules : la
  porte sur l'un, le navigateur de l'autre. Même cause pour `rapport.cjs` (7
  rouges) et `seuils-vinted.cjs` (13) — verts une fois la porte posée aussi sur
  le chemin absolu (dans la porte elle-même, pas banc par banc). ⚠️ Les
  workflows lancent leurs agents dans des worktrees : *un banc rouge en masse
  dans un worktree, regarder d'abord l'écran capturé*. Porte posée, 6 rouges :
  - ⚠️ **U, un vrai défaut d'app** (depuis e4a755f, 13 oct.) : avec une session,
    le secours des photos vaut « oui » en permanence (la route serveur). Serveur
    qui échoue + extension MUETTE ⇒ chaque photo partait en « délai », jamais
    comptée perdue : des pictogrammes **sans aucune phrase**. Une extension
    muette n'est plus interrogée (refus, jamais définitif), et son retour
    redemande les photos refusées même quand le secours ne change pas
    (`secoursChange`, contrôle ajouté à `audit-photos-vinted.cjs`, rouge sur
    l'ancien code et sous la mutation `ext-revenue`). U : 3 rouges sur `main`
    et sous mutation, verts après.
  - **O et N, le banc en retard** : hors ligne, la coque remplace TOUS les écrans
    par la copie de Ma journée (5588c02, 21 oct.) — plus de liste de photos ni de
    navigation de sections pendant la coupure. Les deux scénarios jugent
    maintenant ce qui existe : la coque dit « hors ligne », aucune phrase de
    photos fausse, et au retour du réseau tout s'affiche sans phrase.
- **« À envoyer 0 » avant la liste des comptes** (trouvé en relançant
  `statuts-colis.cjs`, rouge sur `main`) : la tuile de Ma journée n'était « pas
  su » que si les QUATRE lectures manquaient ET que des comptes étaient connus —
  avant le retour de la liste des comptes, elle disait « 0 », puis « 2 » une
  seconde plus tard. Un zéro inventé (§5) : « — » tant que les comptes, les
  ventes (ou, pour « À retirer », les achats) ne sont pas lus. Rouge sur `main`
  à 390 px (deux passages sur deux), et sur la mutation aux deux tailles ; vert
  deux fois après. `ebay-colis`, `ebay-messages-journee`, `journee-premium`
  (qui lisent la même tuile) restent verts.
- ⚠️ **Disque plein pendant la passe** (`/` à 20 Mo libres) : Chromium mourait
  (« No space left on device » dans ses journaux) et le banc disait seulement
  « Target page, context or browser has been closed ». Un banc qui meurt ainsi,
  c'est la machine : regarder `df -h /` avant d'accuser l'app.
- **Non mesuré** : les rendus varient de 12 à 14 sous la charge de la machine
  partagée (4 cœurs) — la médiane tient le plafond, un tirage isolé peut le
  dépasser ; la route serveur des photos en production (le défaut U ne se voit
  que si elle échoue) ; rien n'a été vu sur un vrai téléphone.
- **Revue du soir (22 octobre) — trois défauts de cette passe, reproduits, corrigés.**
  Chacun : rouge sur 204618c (copie `git archive`, contrôle lancé depuis elle),
  vert après, rouge sous mutation.
  1. ⚠️ **Une lecture PENDUE captait toutes les suivantes** (régression de la
     cause 5) : sans `signal`, `lbc_ventes` entre dans le partage, qui gardait
     une lecture EN COURS sans limite. Une requête perdue (réseau qui change,
     iPhone qui se réveille) : « ↻ Actualiser » de l'écran Leboncoin ne
     relançait plus rien, l'écran restait « — » jusqu'à une écriture. Une
     lecture en cours ne se partage plus que `VOL_MAX_MS` = **8 s** (plus court
     que les 12 s de `lireReceptionLeboncoin`) ; deux lectures simultanées
     restent UN appel. `audit-lectures-partagees.cjs` §10 (mutation
     `vol-sans-fin` rouge) ; `rafraichissement-leboncoin.test.mjs` 6/6 (« une
     lecture pendue ne capte pas Actualiser », rouge sur 204618c).
  2. **« 0 À retirer » sur un échec des achats** : la correction « — tant que
     les achats ne sont pas lus » ne couvrait que l'attente (`items:null`) ; un
     ÉCHEC rend `items:[]` + `error` + `failedUids`, et Achats disait
     « Impossible de charger » au même moment (§5, §11). La tuile vaut « pas
     su » si les achats sont en échec (`buys.error`, ou un compte non exclu
     dans `failedUids`), comme « À envoyer » pour les ventes.
     `statuts-colis.cjs` §3c (lecture groupée des commandes et relais en 503,
     ventes lues) : **2 rouges sur 204618c** (« lu 0 »), 2 sous la mutation
     « échec ignoré », vert après ; l'autre sens (achats lus ⇒ « 1 ») ajouté.
  3. **Extension qui alterne muette/présente** : son retour rouvrait toutes les
     photos refusées SANS le recul — chaque lien mort redemandé à chaque retour
     (16 demandes par lien en 10 min contre 3 sur `main`, la borne « quinze
     retours, quinze demandes » du 11 octobre contournée). `rouvrirTout(true)` :
     une photo jamais rouverte l'est tout de suite (U reste vert), un lien mort
     attend son recul ⇒ **4** demandes par lien. `audit-photos-vinted.cjs` :
     contrôle « extension qui alterne », rouge sur 204618c ([16,…]) et sous
     `ext-revenue-sans-recul` et `retour-sans-borne`.
  Bancs relancés un par un (ports 6431-6434) : statuts-colis, photos-vinted U,
  journee-premium (17 ✅), ebay-colis, ebay-messages-journee, vitesse (lectures
  inchangées, 57/55). ⚠️ vitesse a donné une fois une médiane de 14 rendus sur
  Ma journée 390 px (12/14/15) pendant le passage complet ; relancé seul deux
  fois : 13/14/12 et 13/13/14, contre 13/14/13 et 13/13/13 sur 204618c — le
  bruit de la machine partagée déjà noté, la tuile ne crée aucun état.
  **Non mesuré** : la durée réelle d'une lecture lente sur un vrai téléphone
  (une lecture de plus de 8 s n'est plus partagée : au pire une requête de
  plus, jamais une réponse fausse).
- **Revue du 22-23 octobre — deux défauts reproduits, corrigés** :
  1. ⚠️ **Une date ESTIMÉE (vente + 7 j, sans email) dépassée était « en retard »** : titre « ⏰ … du retard ! » du matin, « dont déjà en retard » du soir,
     `overdue` du widget, « 1 j de retard » sur la carte de Colis — alors que la vraie limite tombe jusqu'à 3 jours plus tard (62/202). Nouveau dans les
     notifications et le widget (ils ne lisaient que les emails), ancien dans l'app. ⇒ Le module : `retard` = dépassée **et lue dans l'email** ; une estimée
     dépassée a sa classe (`estimeeDepassee`), sa phrase (`TEXTE_ESTIMEE_DEPASSEE`, « date estimée dépassée — vérifie la vraie limite sur Vinted »), reste
     dans les totaux et se dit à part : matin « N à vérifier sur Vinted — date estimée dépassée » (`aVerifier`, jamais le titre ⏰), soir « N à vérifier sur
     Vinted (date estimée passée) » (les estimées d'aujourd'hui comprises), widget `estimeeDepassee` (hors `overdue`). L'app suit la même règle (§11) :
     tuile et notice de Ma journée, publication `vrm_colis_aposter.enRetard`, bandeau d'urgence de Colis, liste du soir hors ligne (`aVerifier`, la photo porte
     `estimee`). Un retard LU passe devant une estimée dépassée sur la ligne `colis-limite`.
  2. **La ligne `colis-limite` de Ma journée était ROUGE** (icône, sous-titre, « Voir › ») sur un retard — §7 : ambre, comme `data-colis-urgence`.
  - Preuves : `audit-colis-heure.cjs` section 8 (32 contrôles) — **9 rouges sur 8d164f1** (+ « l'autre sens », vacant avant : le champ `retard` n'existait
    pas) ; mutations « estimée = retard » (module) 7 rouges, « soir sans les estimées d'aujourd'hui » 2, « widget overdue + estimées » 1. Banc
    `colis-heure.cjs` (+ la vente 9205, estimée dépassée ; + la teinte de la ligne) — **6 rouges sur le build de 8d164f1** (« 1 j de retard », rgb(192,57,43)),
    vert après ; mutations « ligne rouge » 2, « estimée = retard » 4. Verts : tous les audits hors SQL, `rappel-soir`, `widget-colis`, `ship-multi`,
    `widget-multi`, `bilan-semaine`, `serveur`, `ebay-relecture-cron`, `hors-ligne`, `poste-sans-depart`, `ebay-colis`, `comptes-sans-email`,
    `tout-generer`. ⚠️ `statuts-colis` sort rouge (tuile « À envoyer » lue 0) — **déjà rouge sur le build d'origin/main et de 8d164f1**, pas ce lot.
  - ⚠️ Non mesuré : le texte réel sur l'iPhone (le script du widget lit-il `estimeeDepassee` ? rien ne l'y oblige).


## 31 octobre 2026 — Le style « Vitrine » (son choix), à l'échelle de l'app

**Sa demande** : « installe le skill taste afin que tu t'éloignes de ce que tu fais que je
n'aime pas trop », puis « lance le changement de style maintenant ». La compétence
`taste-skill` (`.claude/skills/taste-skill/`, références `app-screens.md` et `tells.md`)
a servi de grille. Une première direction (« Registre » : Perle gardée, achromatique) a
été montée puis **abandonnée** : Julien a vu quatre maquettes (Perle, Registre, Entrepôt,
Vitrine) et a choisi la quatrième — « j'aime énormément le 4, tu peux appliquer ça,
améliore simplement pour le téléphone ». **Vitrine remplace Perle** (CLAUDE.md §3 et §7).

**Ce qu'est Vitrine** : une boutique de sneakers — blanc franc, grandes photos,
typographie serrée, la paire avant tout. Bricolage Grotesque (texte et titres, 500–800,
axe optique) ; Geist Mono 500 pour les N° et les codes. Clair : fond `#FFFFFF`, surface
`#F5F5F3`, encre `#0F0F0E`, atténué `#56564F`, filets `#E4E4DF`, accent cobalt `#2442B8`
(texte blanc dessus), ambre `#8A5300`, photo vide `#ECECE8`. Sombre dérivé : fond
`#0E0E0D`, surface `#1A1A18`, encre `#F2F2EE`, cobalt éclairci `#6F86E8` (texte FONCÉ
dessus : 5,4:1 ; le blanc n'y tient que 3,5:1), ambre `#F0B44C`. Rayons 14 px (cartes,
photos, boutons pleins), 999 px (pastilles). Une couleur d'accent, rare ; ambre = geste ;
rouge = deux paires sous un N° ; le violet reste refusé (`blue` et `purple` du thème
retombent sur l'atténué).

**Comment c'est posé (pour pouvoir le relire ou le retirer d'un coup)**
- `src/themeMineral.js` : les jetons (noms d'exports inchangés, App.jsx n'a rien à
  changer pour les lire). `variablesTheme` publie en plus `--vrm-danger`, `--vrm-warn`,
  `--vrm-warn-soft`, `--vrm-photo`.
- `src/styles-vitrine.css`, **chargée en dernier** (`src/main.jsx`) : polices, coque,
  navigation, surfaces, titres, étiquettes, boutons, filtres, fiches d'annonce, sombre.
  Elle surpasse les couches d'avant (styles-iphone, -mobile-studio, -telephone,
  -disposition, -annonces-fiche…) sans les réécrire.
- Polices **auto-hébergées** dans `src/fonts/` (woff2 latin + licences OFL) : la CSP de
  `vercel.json` n'autorise que `font-src 'self' data:` — Google Fonts aurait été bloqué.
- Retouches ailleurs, toutes de forme : `index.html` (police, grain retiré, titres,
  `.vrm-label` en minuscules, bouton principal à plat, plus de carte qui se soulève, plus
  d'entrée en cascade, anneau de focus cobalt) ; `styles-mobile-studio.css` (14 aplats
  pétrole en dur → l'encre) ; `styles-epure.css`, `styles-gestion.css`,
  `styles-mineral.css` (restes pétrole/bleu en dur) ; `RepartitionAnneau.jsx` (sa
  palette sauge → neutres + l'accent).
- `src/App.jsx`, localisé : `SideBar` (chaque entrée porte son libellé, icônes 18 px, logo
  32 px, `NAV_LARGEUR` 160 → 200) ; `Notice` (voile en dégradé retiré) ; la légende
  « Vendu » de la courbe de la semaine (`#5d948b` en dur → `C.accent` : la pastille ne
  correspondait plus au trait).

**Les « tells » retirés** (relevés par `inspect.mjs --app` de la compétence sur une base
inventée — `_base-volume.cjs`) : rail pétrole en dégradé et bandeau pétrole à halo flou
du téléphone, Space Grotesk, ~80 étiquettes en capitales espacées (en ligne et par
classe), ombres molles des cartes et des boutons, grain de papier, cartes qui se
soulèvent au survol, entrée en cascade, pavés d'icônes teintés devant les tâches et les
réglages, voile en dégradé des notices, flou de verre sous les feuilles. Mesuré sur Ma
journée : 7 FAIL → 4 (restent : pas de `<h1>` — sémantique, `ScreenHead` rend un `h2` ;
un texte de 9 px caché au téléphone ; deux défauts de mise en page d'avant).

**Téléphone (sa demande d'amélioration)** : bonjour de Ma journée en titre 34 px (44 px
sur ordinateur) ; barre du bas blanche, icône cobalt + libellé encre 700 à l'onglet
actif, 52 px, zone sûre respectée ; Ventes et Colis en lignes aérées (filet, pas de
cartes) ; N° d'un colis en pastille NOIRE pleine, Geist Mono 16 px ; « Tout imprimer »
pleine largeur, 52 px, cobalt ; Annonces en 2 colonnes à photo de 190 px ; filtres et
rangée de comptes en pastilles, la choisie noire pleine (en sombre : marche claire cernée
d'encre — la règle du 16 oct. « pas de pastille blanche pleine », banc formes-communes).

**Défaut trouvé au passage (existait avant)** : dans une carte de Colis, le bouton
« Imprimer » était BLANC SUR BLANC (fond retiré par styles-gestion, texte « sur accent »
forcé par styles-boutons) — corrigé dans `styles-vitrine.css` §12.

**Pas fait (décision à lui)** : fixer « Tout imprimer » AU-DESSUS de la barre du bas
(la maquette v2) — un bouton fixe couvre la dernière ligne (banc coque-mobile) ; le N°
posé SUR la photo d'une fiche (il reste dans la ligne du prix : déplacer le champ
d'édition en place touchait le JSX de la fiche) ; la rétrospective « Wrapped » garde ses
dégradés multicolores ; la page d'accueil publique (`Accueil.jsx`) n'est pas touchée.

**Captures** (base inventée, aucune donnée réelle) : `docs/style-2026-10-31/avant/` et
`docs/style-2026-10-31/apres/` — Ma journée, Annonces, Ventes, Colis, Stock, Réglages, à
390 et 1512 px, clair et sombre.

## 31 octobre 2026 (soir) — Vitrine, les finitions ; Ventes et Annonces plus lisibles

Suite du premier passage « Vitrine » (ci-dessus). Tout est de la FORME : aucune règle
métier, aucune donnée, rien dans `vinted-sync-extension/` ni `api/`.

**Ce qui restait du premier passage**
- **Le N° sur la photo** (fiche d'annonce Vinted) : une pastille blanche à chasse fixe
  (Geist Mono) en haut à gauche de la photo, comme la maquette. Elle est HORS du lien de
  la photo (un bouton dans un lien ne se touche pas) et c'est la MÊME édition en place
  qu'avant (`EnLigne data="numero"` → `poserNumero`) : un tap sur la pastille, on tape,
  Entrée. Cible étendue à 44 px affichés (pseudo-élément). En sombre, la pastille reste
  claire (l'encre claire du thème) : sur une photo, c'est l'étiquette qui se lit.
  « Boostée » descend en bas à gauche de la photo. Le prix reste seul sur sa ligne —
  la pastille que `styles-annonces-pro` posait sur le DERNIER élément de la ligne (le
  N°) ne l'habille pas (`span[data-prix]` remis à plat, `styles-vitrine.css`).
- **Ventes au téléphone sans cadre** : le conteneur `.vrm-ventes-liste` gardait l'aplat
  « surface » et un cadre de 8 px de rayon ; il est retiré (à toutes les largeurs) — les
  lignes sont sur le blanc, séparées d'un filet, comme Colis. La vignette « photo vide »
  était BLANCHE (invisible sur le blanc) : elle prend `--vrm-photo`.
- **`ScreenHead` rend un `h1`** — sauf dans un espace de plateforme (Vinted, Leboncoin,
  eBay), où le `h1` est le nom de la plateforme (`EntetePlateforme`) et l'écran une
  section : `h2`. Un contexte (`DansEspacePlateforme`, posé par `EspacePlateforme`, qui
  remplace les trois `<section className="vrm-market-space">`) le dit. Les feuilles
  visent `.vrm-screen-head :is(h1, h2)` ; aucun banc ne cherchait `h2` comme titre
  d'écran (vérifié : `revendeurs.cjs` passe par `getByRole('heading')`, sans niveau).
- **Page d'accueil publique en Vitrine** : jetons de `src/accueil-jetons.js` (blanc,
  encre, cobalt sur le bouton principal SEUL), Bricolage Grotesque partout (plus de Space
  Grotesk ni d'Inter dans la page, la carte, les écrans dessinés et le film), plus de
  halos en dégradé, de reflet balayé sur le bouton, de verre dépoli sous la barre, de
  héros ardoise à grain, de pastilles de couleur devant « Vinted · Leboncoin · eBay ».
  Une feuille `src/styles-accueil-vitrine.css`, chargée APRÈS `styles-accueil-studio.css`,
  a le dernier mot (même principe que l'app). Le banc `accueil.cjs` compte désormais le
  cobalt dans son budget d'accent (`BLEUS`) : il est plus strict, pas moins.
- **Rétrospective « Wrapped »** : plus de dégradés multicolores ni de violet (la bascule
  Mois/Année écrivait en `#7a3cff`) — chaque carte est un aplat d'encre, l'ouverture et
  la fin en cobalt ; les grands emojis décoratifs sont retirés ; l'en-tête dit
  « Rétrospective · … ».
- **Passe de cohérence** : l'écran de connexion (ardoise pétrole en dégradé, halos
  sauge) passe sur l'encre — l'« aurore » qu'il a demandée le 27 oct. reste, ses halos
  en neutres + cobalt ; la barre de chargement est un aplat d'accent ; le vieux bloc
  « Matières mobiles » de `styles-iphone.css` (pétrole, grain, dégradés) et le bandeau
  pétrole de `styles-telephone.css` renvoient aux jetons ; le fil de conversation en
  sombre n'est plus vert pétrole (`styles-mobile-studio.css`) ; les replis de `var()`
  pétrole (`#244E54`, `#2b4548`, `#21343e`) deviennent cobalt/encre ; une constante de
  sept couleurs inutilisée (dont un violet) est retirée du Stock. Restent, assumés : les
  dégradés FONCTIONNELS (masque de défilement, fondu sous une barre collante, squelette
  de chargement, voile du film), la pièce 3D du Stock, et `styles-accueil-studio.css`
  (entièrement recouverte par la feuille Vitrine de l'accueil).

**Demande du soir (Julien)** : « il faut vraiment améliorer la mise en page des ventes…
les icônes devant sont beaucoup trop petites, on voit même pas ce que c'est, il n'y a
même pas le nom de la paire en entier avec la taille ; on est obligé d'appuyer sur les
points pour remplir le prix d'achat ou relier un achat — améliore ça, pour eBay aussi ;
les annonces sont moches ».
- **Une ligne de vente** (Vinted, Leboncoin, eBay, Vestiaire : la même
  `LigneVenteCompacte`) : photo 64 × 80 au téléphone, 80 × 100 sur ordinateur (elle
  faisait 28 × 36) ; le nom EN ENTIER sur autant de lignes qu'il faut (il était coupé à
  une ligne), date · compte dessous ; montant fort, état dessous (téléphone) ou en
  colonne (ordinateur) ; « ⋯ » à 24 px. Vinted : la taille de la fiche est ajoutée au
  nom quand le titre ne la dit pas (`tailleDansTitre`).
- **Prix d'achat et « Relier un achat » SUR la ligne** quand le coût manque : nouvelle
  prop `gestes` de `LigneVenteCompacte`, rendue sous le bouton de la ligne (un champ ne
  vit pas dans un bouton). Ce sont les MÊMES composants et les MÊMES écritures que dans
  le tiroir (`CoutAchatVente` → `setSaleOverride(tx,{buyPrice})` ; `openPicker` pour
  relier — c'est SON clic qui choisit l'achat, rien par ressemblance). Le tiroir n'est
  pas touché (un autre chantier le rend paresseux). eBay : le prix d'achat se tape sur la
  ligne quand `bilanCommandeEbay` dit « achat inconnu » (même écriture que « Bénéfice de
  l'article » : `costs.buyPrice` via `sauverCouts`) ; eBay n'a AUCUNE liaison à un achat
  dans VRM, donc seul le prix est proposé (`onRelier` devient facultatif).
- **Annonces** : Vinted — le titre en entier, la taille au bout (elle était perdue dans la
  ligne des statistiques), prix 22 px (18 au téléphone), N° sur la photo. Leboncoin
  (« Mes annonces ») — les lignes à vignette de 36 px deviennent des FICHES (grille, photo
  4:5, titre entier, prix fort, état discret, gestes dessous) ; eBay — photo 80 × 100,
  titre entier, prix 18 px (ses cartes gardent leurs réglages).

**Vérifié** : `npm run build` ; audits icones, tdz, variables, boutons, csp ; les bancs
et leur état sont dans le rapport de la session (journal `b1/`). Captures (base
INVENTÉE `_base-volume.cjs`, aucune donnée réelle) : `docs/style-2026-10-31/finitions/`.
### Statistiques détaillées, Tendances dans Ma journée, cartes rangées dans Ma journée (31 octobre)

**Demandes de Julien** : « je veux que tu proposes beaucoup plus de statistiques dans Ma
journée et même dans Statistiques, de la vraie data » ; et, de la carte « Bénéfice dans Ma
journée » : « pour cette case je ne pense pas qu'il soit nécessaire de faire un bouton de
validation dans les paramètres… pourquoi pas les autres ? ».

**Mesuré avant de coder** : la seule carte de Ma journée qui s'allumait par une case des
Paramètres était le bénéfice (`BeneficeJourneeSetting`, Réglages → Affichage,
`vrm_journee_benefice`, défaut éteint) ; les widgets, eux, se rangeaient déjà dans Ma journée
(« Modifier » : retirer, glisser, « + Ajouter », 21-22 oct.).

**Ce qui change pour les cartes** :
- L'interrupteur « Bénéfice dans Ma journée » est **retiré** de Réglages → Affichage.
  `vrm_journee_benefice` a trois états : absent = **par défaut**, la carte se montre dès
  qu'un bénéfice est publié avec au moins une vente du mois au prix d'achat connu (sinon
  rien — jamais une case de « — » non demandée) ; `false` = masqué par lui, bouton
  « Masquer le bénéfice » **en mode « Modifier » seulement** (touchable malgré le
  `pointer-events:none` du corps des widgets, ignoré par le glisser) ; `true` = remis par
  « + Ajouter » → « Ton bénéfice » (feuille des widgets). Le lien « + Afficher mon
  bénéfice » sous la grille est retiré. La règle de `styles-epure.css` qui cachait
  « Masquer » sur téléphone est retirée (il n'existe plus qu'en mode « Modifier »).
  La ligne « Aujourd'hui » du bénéfice n'est dessinée que s'il y a une vente aujourd'hui
  (vide, elle ajoutait un filet).
- **Une carte nouvelle arrive d'elle-même, une carte retirée ne revient pas** : la
  disposition enregistrée porte `connus` (le catalogue au moment du rangement,
  `dispoAEnregistrer`) ; un widget de la disposition d'origine absent de `connus` est ajouté
  à la fin (`normaliserDispoJournee`). Une disposition d'avant ce champ connaît
  `CATALOGUE_AVANT_31_OCT`.
- Nouveau widget **« Tendances »** (dans la disposition d'origine, pleine largeur, en
  dernier — le banc `journee-widgets` garde « toute la journée visible sans défiler » à
  1512 px) : 4 cases qui ouvrent Statistiques — aujourd'hui contre la moyenne des 28 jours
  d'avant (l'ÉCART, pas le montant : « +X € aujourd'hui » est déjà dans « Vendu », §7),
  7 jours contre les 7 d'avant, paires en ligne depuis 30 j et plus (« — » sans aucune date
  de mise en ligne), et « En attente » — remplacé par le panier moyen 30 j quand la carte
  « Argent en attente » est sur l'écran (le même nombre ne s'écrit pas deux fois).

**Statistiques** : nouvelle section (`StatsDetaillees`) entre « CA sur mesure » et « Ce qui
se vend » — rythme (aujourd'hui, moyenne, 7 j/7 j, panier, ventes/jour, 12 semaines en
barres), bénéfice et marge par marque/modèle/taille/plateforme/compte, temps de vente
(médiane/moyenne par marque, tranche de prix, compte), quand tu vends (jour, heure), paires
qui dorment 30/60/90 j avec valeur affichée et coût connu, rotation, taux de vente du mois,
annulations. Sources et règles : historique compta (même date). Graphiques en SVG maison,
une seule teinte d'accent, survol natif (`<title>`), échelle de texte 28/20/15/13/11 du
banc `stats-premium` (le 11,5 px de la couverture du boost ramené à 11).

**Preuves** : `scripts/audit-stats-ventes.cjs --prouve` (29 contrôles à la main, 10/10
mutations) ; `scripts/bancs/stats-detail.cjs` (44 verts, 1512 et 390 tactile ; chiffres
calculés à la main dans l'en-tête ; cas partiel « 3/4 », cas « pas su » ; mutation « prix
d'achat inconnu = 0 € » dans le relevé ⇒ 3 rouges) ; `benefice-journee` réécrit (A défaut
sans publication = rien, Réglages sans interrupteur ; B défaut avec publication = carte ;
D masquer/remettre dans Ma journée) 62 verts ; `journee-widgets` (K mis à jour, disposition
par défaut avec « tendances ») 167 verts ; `journee-premium`, `stats-premium`,
`stats-compta`, `benefice-brut-net`, `reglages-premium`, `chiffres-croises` verts.
Captures regardées (390/1512, clair/sombre).
## 31 octobre 2026 — Vitesse : le tiroir des ventes à l'ouverture, les lectures en double du démarrage

**1. Le tiroir d'une vente n'est monté qu'à sa première ouverture, puis gardé**
(`LigneVenteCompacte`). Depuis le 21 oct. chaque ligne (Vinted, Leboncoin, eBay)
montait d'avance son tiroir complet, caché (photo, coûts, bordereau, facture,
`EbayCommande`) : l'essentiel du rendu différé d'une lettre tapée dans Ventes.
Fermé, il n'existait que `hidden` : rien de visible ne change. Le montant de la
ligne porte aussi `data-prix-vente` (centimes) : il y était déjà affiché.
Banc `ventes-frappe` (lancé seul, machine partagée) : processeur « tout compris »
des 21 lettres 6,4 s → 4,8 s (−25 %), éléments `.vrm-sale-row` recréés par frappe
78/106/120 → 39/53/60 (deux par vente avant : la ligne et la copie du tiroir).
Le temps jusqu'à l'image de la frappe (rendu URGENT, plancher 90 ms) ne bouge pas
(60 → 58 ms) : depuis le 16 oct. le rendu urgent ne recrée aucune ligne ; le tiroir
pesait sur le rendu DIFFÉRÉ qui suit. Les « ~80 ms » vus avant venaient de la charge
de la machine (75 ms mesuré pendant qu'un autre banc tournait). Les bancs qui lisaient un tiroir FERMÉ l'ouvrent d'abord, comme une
personne : `scripts/bancs/_tiroirs.cjs` (`monterTiroirs` : clic, attente de l'état,
second clic) — `ventes-bordereau`, `deux-extensions`, `pont`, `statuts-colis`,
`double-vente`. Aucun contrôle affaibli : ce qui était jugé « absent d'un tiroir »
(pas de bordereau sur 9002, pas de bénéfice sur la vente non reliée) l'est sur un
tiroir réellement monté.

**2. Banc `vitesse` : ce que chaque lecture coûtait, et ce qui a été retiré.**
Mesuré lecture par lecture (pile d'appel sur un build non minifié) :
- `lecturesPartagees` : une écriture de LIGNES NOMMÉES de `app_data` (upsert avec
  `id`, PATCH/DELETE `id=eq.`/`in.`) ne vide plus que les lectures qui peuvent les
  porter (`idsEcrits`, `lecturePeutPorter`) ; `main`, un `like`, une autre table, un
  corps illisible vident tout comme avant. Les publications `widget_stats` et
  `lbc_a_retirer` du démarrage faisaient relire `lbc_ventes`, `ebay_*`…
- Un passage de FOND déclaré (`vrmFond: true` : la cloche, l'agent eBay en fond)
  accepte une réponse réussie de moins de 15 s (`FENETRE_FOND_MS`), jamais d'avant
  une écriture de la ligne ni un signal de l'extension. Un écran garde 2 s.
- `POST /api/compte?mode=photo` (lecture d'une photo du CDN, n'écrit rien) le déclare
  (`vrmInvalideSiChange`) : ses douze appels sur Ventes vidaient le partage.
- Une projection par ligne eBay (`SEL_EBAY_COMMANDES/ANNONCES/PROGRAMMEES`) :
  `ebay_orders` partait sous quatre projections, `ebay_listings` trois.
- `lbc_ventes` en `select=data` partout (la ligne ne porte que `ventes` et sa date).
- `harvest_*_orders_sold` : une orthographe (`*`), plus `%` d'un côté.
- « Comptes sans email » : UNE lecture `email_*` au lieu de sept à la suite.
- `panel_num_reserves` relue quand l'ENSEMBLE des annonces change (comme la table
  « qui remplace qui »), plus à chaque référence neuve de la liste.
- L'agent eBay en fond relit la fraîcheur de son résumé APRÈS le nuage.
- `lbc_listings` projetée (`items`, `lectures`) au lieu de `select=data` (§4.4) ;
  `api/email-inbound.js` la projetait déjà.
Contrôle : `audit-lectures-partagees.cjs` §11-12 (+5 mutations, rouge sur l'ancien
`lecturesPartagees.js`).

**Avant → après** (lectures de la base, 390 / 1512 px ; plafonds inchangés) :
Ma journée 73/71 → 63/61 (plafond 62) · Ventes 87/90 → 76/74 (82) · Colis 88/86 →
78/76 (82) · Annonces 75/72 → 68/65 (66) · Achats 89/85 → 75/73 (78) · Messages
77/75 → 69/67 (68) · Statistiques 71/70 → 65/63 (60) ; identiques refaites 3-8 → 0-1.
Restent rouges : Ma journée 390, Annonces 390, Messages 390, Statistiques (et ses
3 balayages), « brouillons eBay lus sur Ma journée » — tous par l'agent en fond
ci-dessous.

**Reste au-dessus, à trancher par Julien** : l'agent eBay en FOND
(`AgentEbayFond`, une fois toutes les 20 h, sur tout écran sauf l'agent ; son résumé
sert la cloche et la notification du matin) lit ~8 lignes que personne d'autre ne lit
à l'ouverture : `ebay_brouillons`, `ebay_programmees` (complet), la famille des
transactions une 2ᵉ fois (preuve de vente, 2 pages — le 3ᵉ balayage de Statistiques
avec le pays des acheteurs), `harvest_*_label_*`, `harvest_*_orders_sold` (216 Ko),
`vinted_item_details` (103 Ko), `coffre_*` (668 Ko). Sans lui (résumé de moins de
20 h, le cas courant), Ma journée, Annonces, Messages et Statistiques passent sous
leurs plafonds. Ses lectures sont utiles (anti double vente de la proposition) : on
ne les a pas retirées. `relais_ext` ×2 : le battement du relais (voulu).
## 31 octobre 2026 — Navigation par tâche (« A · par tâche, en améliorant encore »)

**Décision de Julien** (maquettes A validées : téléphone, ordinateur, Ventes · Vinted), puis « pour l'espace, il
faut totalement réorganiser les onglets différemment… tout peut être amélioré ». La barre ne range plus les
écrans par SITE (Accueil · Vinted · Leboncoin · eBay · Gestion) mais par CE QU'IL FAIT.

**La carte** (règle : `src/navigationTache.js` ; listes : `BOTTOM_TABS`, `NAV_TACHES`, `GROUPES_PLUS` dans `App.jsx`)
- Téléphone, barre du bas : **Journée · Annonces · Ventes · Colis · Plus** (icône cobalt + libellé encre à l'actif, 52 px).
- Ordinateur, colonne : **Ma journée · Annonces · Ventes · Messages · Colis**, puis les groupes, **Paramètres** en bas.
- « Plus » (feuille « Ton espace ») et colonne, groupés par tâche, rien en double avec la barre, aucun groupe vide,
  aucune entrée d'un site sans compte (pas su ⇒ montrée) :
  - **Vendre** : Messages (téléphone), Republier (ouvre Annonces · Vinted sur l'atelier), Favoris & offres (Messages · Vinted, zone favoris) ;
  - **Expédier** : Retraits (Achats sur « À retirer ») ;
  - **Gérer** : Stock, Achats (Achats sur « Tous ») ;
  - **Argent** : Statistiques, Comptabilité ;
  - **Plateformes** : eBay (à traiter, offres, promotion, achats, compte), Leboncoin (achats, colis), Vestiaire (sa page) ;
  - **Moi** : Communauté, Paramètres (en bas de la colonne sur ordinateur).
- **Annonces, Ventes, Messages** portent une rangée de filtres de site (pastilles `vrm-filtres`) : Toutes (Ventes
  seulement) · Vinted · Leboncoin · eBay · Vestiaire, seulement les sites où il a un compte, le dernier filtre retenu
  par écran (`vrm_filtre_site`, localStorage, commodité de l'appareil). Filtre « Vinted » = l'ancien écran Vinted
  (les MÊMES fonctions `rendreVinted/rendreLeboncoin/rendreEbay` rendent l'espace du site et la tâche filtrée :
  comptes, flou, états, période, bordereaux, tiroir). Sous la tâche filtrée, une porte « Aussi sur eBay : à traiter… ».
- **Liens profonds** : `ONGLETS_DEPLACES` + `redirigerOnglet` — `plat_vinted`/`cat_ventes` → Ventes · Vinted ;
  `cat_annonces`/`vinted_annonces` → Annonces · Vinted ; `plat_leboncoin` → Ventes · Leboncoin ; `leboncoin` →
  Annonces · Leboncoin ; `plat_ebay`/`ebay_ventes` → Ventes · eBay ; `ebay_annonces` → Annonces · eBay ;
  `cat_msg` → Messages · Vinted ; `ebay_messages` → Messages · eBay ; `ebay_agent` → espace eBay, À traiter ;
  `plat_vestiaire` → la page Vestiaire ; `?tab=ventes&site=leboncoin` accepté. La redirection est calculée HORS de la
  fonction de mise à jour (mode strict de React : rejouée deux fois).
- **Badges** : Colis = le nombre PUBLIÉ `vrm_colis_aposter` (< 12 h, sinon rien : pas su ≠ 0), ambre ; Messages =
  un POINT (trois règles de comptage des non-lus coexistent, un chiffre pourrait contredire l'écran) — et sur « Plus ».

**« Toutes » (Ventes) — mesuré avant de coder.** Sources déjà lues par la coque, avec leurs trois états :
Vinted `ventesCoque` (+ `ventesKO`, comptes écartés par `compteEcarte`), Leboncoin `lbcVentes`/`lbcCoqueLu`
(`isSeller===true`, annulées exclues), eBay `ebayCmdTous` (+ `illisibles`), Vestiaire `vc_ventes` (lu par la vue).
Chaque ligne = UNE vente sous SON identité (transaction Vinted, `txId` Leboncoin, `orderId` eBay, clé Vestiaire) :
rien n'est fusionné, deux paires au même titre sur deux sites = deux lignes. N° seulement par identité (SKU eBay,
lien/référence Leboncoin, référence Vestiaire) ; Vinted sans N° (il faudrait la transaction : un blanc plutôt qu'un
faux). Montants Vestiaire non écrits (prix ou versement : pas su). Un site illisible est nommé en tête. La ligne ouvre
SON site (eBay : sa commande, `DEMANDE_EBAY_CIBLE`).
**Pas de « Toutes » pour Annonces ni Messages** : chaque site a sa règle « en ligne » (Vinted <enligne-regle>,
Leboncoin listes complètes et disparues, eBay statut, Vestiaire lecture complète) — une liste mélangée devrait les
recopier hors de leur écran (§11) ou dire « en ligne » ce que l'écran du site dit « à confirmer ». Messages : pas de
boîte unique fiable (Vinted, Leboncoin, eBay par compte, Vestiaire n'ont ni la même forme ni le même « non lu »).

**Rien ne disparaît** : écrans montés `tab==='…'&&` 14 → 17 (+ `ventes`, `annonces`, `messages`), ceux de la table (`cat_achats`, `cat_bord`, `cat_expedition`…) inchangés ; `audit-bancs`
vert (verif_visuel/verif_dark rendent les 3 nouveaux). Les espaces de site restent montés (`plat_*`), leurs sections
propres derrière « Plateformes ». Décisions tenues : ni « Autres outils » ni « Dans Vinted », Organisation hors du
menu (Réglages), pas de « N° + Entrée ».

**Preuve** : `scripts/bancs/navigation-tache.cjs` (390 et 1512 px, données inventées). Bancs adaptés sans affaiblir la
règle : `menu-range` (« Plus », `?tab=plat_ebay` → Ventes · eBay, « eBay » écrit une fois), `coque-mobile` (onglets
attendus), `glisser-onglet` (voisins de la nouvelle barre, jamais Vestiaire), `retour-historique` (« retour » rend le
filtre de site d'avant).

## 31 octobre 2026 — Statistiques mises en page comme la maquette choisie (images/4.png)

**Demande de Julien** : il a choisi la maquette « Statistiques » (4 tuiles, « Vendu par
semaine » / « Ce qui part vite » / « Par compte », « Par taille » / « Boost rentable ? »,
sélecteur Semaine · Mois · Année à droite du titre) : « applique ça », puis « fais exactement
cette mise en page ». La barre de recherche et les filtres de site du haut de la maquette
sont l'en-tête commun (autre chantier) : pas touchés ici.

**Ce qui change** : un bloc `StatsVitrine` (App.jsx, avant `StatsDetaillees`, styles dans
`src/stats-vitrine.css`) monte juste sous le titre ; le reste de l'écran suit sous « Tout le
détail », inchangé. Le sélecteur de période passe par le slot `right` de `ScreenHead`
(`Segmente`, `data-sv-choix`). UNE règle de période pour tout le bloc
(`bornesPeriode`, src/statsVentes.js) : semaine du lundi, mois du 1er, année du 1er janvier,
minuit local ; la comparaison se fait avec la période d'avant **au même point** (même
nombre de jours écoulés, même heure — `prevCoupe`), le sous-titre le dit (« Octobre ·
comparé à septembre · au même jour »).

**D'où vient chaque chiffre (aucune règle neuve sur l'argent, §11)** :
- **Vendu** : `liveStats.venduLignes` (`ventesFaites`), montant, nombre, écart %. Un compte
  illisible ⇒ « au moins », écart retiré, le compte manquant nommé ; rien lu ⇒ « — ».
- **Bénéfice** : `vrm_benefice_jours` (`beneficeDesJours`) — brut des seules ventes au prix
  d'achat connu, « au moins X € » et « N ventes sur M avec prix d'achat » dès qu'il en manque
  un ; aucun prix ⇒ « — ».
- **Délai médian** : relevé `vrm_stats_ventes` + date de mise en ligne de l'annonce reliée par
  SA transaction (Vinted seulement), couverture « sur N ventes sur M ». Affiché à la
  demi-journée (médiane de 3 et 10 = « 6,5 jours », jamais « 7 »).
- **En ligne** : `texteEnLigne` (la coque) + « dont N qui dorment (30 j et plus) »
  (`vrm_stats_stock`). Le `data-dash-stat="online"` a quitté le résumé replié « Stock et
  volume de ventes » pour la tuile : le nombre n'est écrit qu'une fois sur l'écran (§7).
- **Barres** : semaine ⇒ ses 7 jours ; mois ⇒ les 8 dernières semaines (`s` + n° ISO, comme la
  maquette) ; année ⇒ ses 12 mois. Grises ; la barre en cours seule en cobalt ; un jour à
  venir n'a pas de barre (`barresPeriode`).
- **Ce qui part vite** : `delaisPar` par modèle sur la période, du plus court au plus long
  (`plusRapides`), barre pleine = rapide.
- **Par compte** : les MÊMES lignes que la tuile Vendu (`ventesPar`) ⇒ la somme des comptes =
  la tuile. `ventesFaites` porte maintenant `compte` (Vinted : login ; Leboncoin :
  `account` ; eBay : pseudo) — le miroir serveur `api/_lib/ventes-regle.js` est refabriqué
  par `audit-bilan-semaine.cjs --recopie` (jamais à la main). Site écrit pour Leboncoin et
  eBay ; délai médian par compte Vinted.
- **Par taille** : relevé de la période, 6 tailles les plus vendues rangées par pointure, la
  plus vendue en cobalt ; « N ventes · délai médian ».
- **Boost rentable ?** : `boostRentable` sur les ventes de la période ; nouveau champ
  `coutBoost` (somme des boosts SAISIS des paires vendues, couverture `avecMontant` sur
  `boostees`). « Vendues en X j vs Y j » seulement si `assez` (5 + 5, même tranche) ; sinon
  « — » et la phrase qui dit pourquoi. Aucune vente boostée connue ⇒ la carte dit pourquoi
  (Vinted ne dit « boostée » que pendant le boost ; saisir le boost payé).

Téléphone : même contenu empilé (tuiles 2 × 2) ; `styles-captures.css` range les cartes de
Statistiques par `order` sur téléphone — le bloc reçoit `order:0` pour rester sous le titre.
Grille 12 colonnes ≥ 1200 px (`styles-gestion.css`) : le bloc prend la rangée 2, le reste
descend d'une rangée.

**Preuves** : `scripts/audit-stats-ventes.cjs --prouve` (périodes, barres, semaines ISO,
comptes, « part vite » calculés à la main ; 14/14 mutations dont `periode_entiere`,
`semaine_dimanche`, `barre_en_cours_decalee`, `rapides_du_plus_lent`) ;
`audit-boost-rentable.cjs --prouve` (coût 18 €, 8/8 mutations) ; nouveau banc
`scripts/bancs/stats-vitrine.cjs` (horloge FIXÉE au jeudi 29 oct. 2026 15 h, chiffres de
chaque tuile et carte calculés à la main pour Mois, Semaine et Année, cas partiel, cas « pas
su » ; 112 verts à 1512 et 390 tactile ; 22 rouges sur `origin/main` ; mutation « période
d'avant entière » ⇒ 4 rouges). `stats-detail` 44, `stats-premium` 42, `stats-compta` 58,
`boost-rentable` 32, `chiffres-croises` 48, `journee-widgets` 167 (un rouge de placement à
4 px au 1ᵉʳ passage, vert au second : instable), `enligne`, `comptes` verts. Captures
1512/390, clair et sombre, regardées à côté de la maquette.

---

## 31 octobre — La recherche EN PLACE (plus d'écran blanc) et l'ergonomie autour

**Demande de Julien** : « Quand on appuie sur la barre de recherche, ça fait un grand écran
blanc ; je veux que ça reste sur la page et que ça permette juste d'écrire. »

**Avant** : la barre du haut (ordinateur) et la loupe (téléphone) ouvraient
`.vrm-global-search`, une couche `position:fixed; inset:0` au fond plein — un écran blanc
avec son propre champ. **Maintenant** :

- **Ordinateur** : la barre du haut porte un VRAI champ (`[data-recherche-champ]`, rôle
  combobox). Toucher la barre, ou « / » depuis n'importe où, met le focus dedans ; les
  résultats tombent dans un panneau déroulant sous le champ (`.vrm-recherche-panneau`,
  max 70 % de la hauteur, il défile seul, `overscroll-behavior: contain`). La page derrière
  reste visible et ne bouge pas. La barre du haut est désormais **collante** (`sticky`) :
  la recherche reste joignable quand on a descendu la page, et son panneau tombe toujours
  dans la fenêtre (avant, « / » en bas de page ouvrait un panneau hors de vue).
- **Téléphone** : la loupe ouvre le champ DANS l'en-tête (il recouvre le logo et le titre,
  avec « Fermer » à droite, 44 px) ; le focus est posé dans le même geste (`flushSync`)
  pour que le clavier d'iOS monte ; les résultats sont une liste sous l'en-tête (fixe,
  70 dvh au plus), pas une feuille plein écran. Champ à 16 px (pas de zoom d'iOS).
- **Fermer** : Échap, un toucher hors du champ et du panneau, « Fermer », ou « retour »
  (le panneau garde `FermeAuRetour` : le geste retour le ferme sans changer d'écran).
- Les **règles de recherche ne changent pas** : le N° par identité (`lireNumeroCherche`,
  `cleNum`, bloc « Tout sur le N° » de `src/rechercheNumero.js`), les modèles/marques par
  texte — c'est une recherche, rien n'y RELIE quoi que ce soit (§5).
- `WebkitOverflowScrolling:'touch'` qui traînait sur la liste de l'ancienne couche est parti
  avec elle (§7).

**Ergonomie corrigée sur le chemin** (changements localisés) :
1. Une **vente** trouvée par la recherche OUVRE cette vente (son tiroir), au lieu de laisser
   Ventes en haut de liste ; un **achat** trouvé mène à SA ligne dans Achats (vue complète).
2. Dans « Tout sur le N° », la vente Vinted ouvre SA vente, le bordereau mène à SA carte
   dans Colis (sauf un colis déjà posté).
3. « / » met le focus dans le champ sans faire défiler la page ; un deuxième « / » dans le
   champ s'écrit normalement.
4. Le double cadre de focus (champ + barre) est remplacé par un seul, sur la barre.

**Preuves** : `scripts/bancs/recherche-en-place.cjs` (390 tactile et 1512 : focus dans un
champ sans changer d'écran, aucune couche fixe ne couvre ≥ 85 % de la fenêtre, panneau
< 80 % de la hauteur, défilement de la page inchangé, résultats à la frappe, « Tout sur le
N° » dans le panneau, Échap, toucher dehors, lignes ≥ 44 px, aucun débordement) — 30 verts ;
**11 rouges sur `origin/main`**, **7 rouges sous mutation** (`BANC_MUTATION=plein` : le
panneau redevient un écran plein). `recherche-numero.cjs` (50 verts) et
`retour-historique.cjs` (18 verts) suivent le nouveau champ ; `colis-colonnes.cjs`,
`compte-supprime.cjs`, `scripts/tests/iphone.cjs` lisent le champ par `[data-recherche-champ]`.
Captures 390/1512 regardées : le contenu reste derrière le panneau.

Fichiers : `src/App.jsx` (coque : `champRechercheOrdi`, `champRechercheMobile`,
`panneauRecherche`, `BarreHaut({ champ })`), `src/styles-recherche.css` (nouveau).
## 31 octobre 2026 (soir) — Achats à côté de « Colis à retirer », deux écrans distincts, « Plateformes » réparti

**Ses trois demandes, mot pour mot** : « je veux qu'il y ait Achats à côté de À retirer » ; « et que dans les deux
onglets il n'y ait pas la même chose » ; « il faut que tu réfléchisses comment enlever Plateforme en bas des onglets
glissants, ils doivent être répartis avec les onglets du haut si possible ». Puis, sur ses maquettes ordinateur
(« fais exactement cette mise en page ») et une capture (« plus de mini-notifications jaunes comme le 10 »).

**1. « Expédier » = Colis à retirer + Achats, l'un sous l'autre** (colonne ET « Plus »). « Gérer » ne garde que Stock.

**2. Deux écrans** (mêmes lectures, aucune copie — `Comptabilite only="achats"` avec `vueAchats`) :
- **Colis à retirer** (`?tab=retraits`, `data-ecran-achats="retraits"`) : l'étape « À retirer » seule — codes de
  retrait, dates limites, points relais et carte (`CarteRelaisColis`/`regrouperRelais`), colis attendus, « à
  confirmer » (« Tout est OK » avant la date limite), « à vérifier », suivi Vinted, suivis manuels, réception des
  emails, colis repartis ; une phrase « Aucun colis à aller chercher » quand TOUT est lu (pas su ≠ rien). Ni onglets
  d'étapes, ni période, ni recherche, ni chiffres, ni liste, ni reçus, ni achats hors plateforme.
- **Achats** (`?tab=achats`) : une TÂCHE avec la rangée de filtres de site (Vinted · Leboncoin · eBay · Vestiaire, pas
  de « Toutes » : chaque site lit ses achats à sa façon). Vinted = En route · Reçus · Tous (Tous par défaut), période,
  recherche, chiffres, liste (prix, reçus, liaison au stock), litiges « à renvoyer » (en tête, Tous compris), achats
  hors plateforme, reçus d'achat par email, sélecteur de compte ; Leboncoin = `AchatsLeboncoin` ; eBay =
  `EbayAchatsOnglet` ; Vestiaire = `AchatsVestiaire`. Ni le résumé CA/argent (des montants de ventes), ni « À retirer ».
- `cat_achats` (notifications de code de retrait, colis livré, rappel du soir — toutes parlent d'un colis à aller
  chercher) ⇒ « Colis à retirer ». Ce qui parle d'un ACHAT vise `achats` : le litige de Ma journée, le reçu d'achat
  (journal des emails, retour de la page du reçu), la recherche. Les liens des `api/*.js` (`/?tab=cat_achats`) ne
  sont pas touchés : ils mènent à « Colis à retirer », ce dont ils parlent (un nouvel achat, `email-inbound` l.2206,
  y mène aussi — à trancher).

**3. « Plateformes » réparti dans les tâches** (src/navigationTache.js : `SOUS_SECTIONS`, `sectionDeTache`,
`redirigerOnglet`). La valeur d'écran s'écrit « site » ou « site.section » (« ebay.agent ») : un seul état, que
le retour rejoue. Aucun espace de site n'est plus monté (`plat_vinted/leboncoin/ebay/vestiaire` ⇒ redirections).

| section d'hier | nouveau chemin |
|---|---|
| eBay · Ventes | Ventes · eBay · **Commandes** |
| eBay · À traiter (agent, retours, évaluations) | Ventes · eBay · **À traiter** |
| eBay · Offres | Ventes · eBay · **Offres** (une offre acceptée VEND la paire : c'est la vente qui se négocie) |
| eBay · Annonces | Annonces · eBay · **Annonces** |
| eBay · Promotion | Annonces · eBay · **Promotion** |
| eBay · Messages | Messages · eBay |
| eBay · Achats | Achats · eBay |
| eBay · Compte | Paramètres → Réglages → Comptes Vinted → **Comptes eBay** (panneau, skin eBay) ; « Comptes eBay » de « État des connexions » l'ouvre |
| Leboncoin · Ventes / Annonces / Messages | Ventes / Annonces / Messages · Leboncoin |
| Leboncoin · Achats | Achats · Leboncoin |
| Leboncoin · Colis | Colis → pastille **Leboncoin** de la rangée de sites (barre du haut) : `LeboncoinColis` (bordereau, QR) ; les autres pastilles ramènent aux 4 colonnes filtrées |
| Vestiaire · Ventes / Messages | Ventes / Messages · Vestiaire |
| Vestiaire · Publier | Annonces · Vestiaire |
| Vestiaire · Achats | Achats · Vestiaire |
| Vestiaire · clé Photoroom, dernier passage de l'extension | Annonces · Vestiaire, sous Publier (⚠️ PAS dans Paramètres : sa décision du 17 oct., `detourage-reglage.cjs`) |
| Vinted · Achats | Achats · Vinted |

Liens profonds : `plat_ebay&section=agent|offres|promo|achats|compte`, `plat_leboncoin&section=colis|achats`,
`plat_vestiaire` (⇒ Annonces · Vestiaire), `ebay_agent` (⇒ Ventes · eBay · À traiter), `plat_*` sans section (⇒ Ventes
du site), `cat_achats` (⇒ Colis à retirer). Composants retirés parce que plus rendus nulle part (§4.11) : `Plateforme`
(la page Vestiaire, ses morceaux sont dans les tâches) et `EntetePlateforme`.

**Téléphone** : la feuille « Plus » n'a PLUS de groupe Plateformes (Vendre · Expédier · Gérer · Argent · Moi).
**Ordinateur** (sa maquette) : la colonne garde « Plateformes » (eBay ⇒ Ventes · eBay · À traiter, Leboncoin ⇒
Annonces · Leboncoin, Vestiaire ⇒ Annonces · Vestiaire) — les deux chemins coexistent. « VRM » écrit en haut,
Paramètres en dernier dans « Moi », 236 px, entrées de 38 px : tout tient sans défiler à 900 px (au-dessous, la zone
défile avec son fondu, rien ne se recouvre — le « Paramètres » collé en bas qui recouvrait « Comptabilité » n'existe
plus).

**Compteurs** (pastille ambre contour + chiffre, « comme le 10 », colonne, barre du bas, « Plus ») — seulement un
nombre PUBLIÉ par son propriétaire (§11, les mêmes que Ma journée), jamais un 0 : Ventes et Colis = `vrm_colis_aposter` ;
Colis à retirer = `vrm_colis_retirer` ; Annonces = lignes de la cloche qui visent une annonce (sans N°, N° porté deux
fois, à retirer de Vinted car vendue ailleurs, marquées `annonces`) ; eBay = résumé de l'agent ; Leboncoin = « à retirer
de Leboncoin » (`lbcRetirer`) ; Messages = un POINT (trois règles de non-lus coexistent). Favoris & offres, Republier,
Vestiaire : aucune source ne publie ce nombre hors de leur écran ⇒ pas de pastille (à construire si voulu).

**Écrans montés** (`{tab==='…'`) : 21 → 18 identifiants directs (− `plat_vinted`, `plat_leboncoin`, `plat_ebay`,
`plat_vestiaire` ; + `achats`) ; table `Comptabilite` : `cat_achats` → `retraits` (5 entrées des deux côtés) ; Colis
gagne la variante Leboncoin. Rien ne disparaît : chaque section ci-dessus a son chemin.

**Après fusion avec la branche Colis 4 colonnes / barre du haut** : les filtres de site passent dans la barre du
haut (ordinateur), les sous-onglets du site restent sous le titre de la tâche ; Colis · Leboncoin passe par la
pastille de la rangée de sites (plus de sous-rangée à part) ; un colis Vestiaire ouvre Ventes · Vestiaire
(`vestiaire_ventes`) ; « Leboncoin » (colonne) pose la cible « à retirer de Leboncoin » comme la cloche ; la
pastille N° des fiches Annonces fait 44 px de haut au téléphone (§7, `plateformes-premium` vert) ; la porte
« Compléter les prix d'achat » revient dans Paramètres → Stock et rangement (retirée par la refonte du 31 oct. ;
même destination, `compta-stock-ui`).

**Preuve** : `scripts/bancs/navigation-tache.cjs` (J : pas de Plateformes dans « Plus », Plateformes dans la colonne,
Expédier = retraits|achats, compteurs publiés, 900 px ; K : écrans distincts ; L : chaque section joignable depuis sa
tâche ; F : anciens liens). Rouge sur le code d'avant, vert après, rouge sous mutation (voir le rapport de la session).

**Décision suivante (31 oct., soir, Julien : « l'onglet Colis à retirer sert à rien si dans Colis on a les codes
de retrait ; en plus il y a les colis à retirer dans Achats, règle ce souci »)** — remplace « deux écrans
distincts » : plus d'entrée « Colis à retirer » ni de groupe « Expédier » ; **Achats** passe dans « Gérer »
(Stock, Achats). Les colis à retirer vivent dans **Colis** : la colonne « À retirer » (branche Colis 4 colonnes)
et, dessous, leur **détail** (`data-colis-retraits`) — l'ancienne vue « À retirer », mêmes composants et mêmes
lectures : codes et QR, dates limites, points relais et carte, « J'ai retiré », « Tout est OK » à confirmer,
à vérifier, suivi Vinted, n° de suivi à la main, réception des e-mails, colis repartis. Il se monte à la demande
(bouton « Codes, QR et points relais des colis à retirer », une carte « À retirer », un ancien lien
`cat_achats`/`retraits`, une notification, une ligne de Ma journée) et défile jusqu'à lui (`AncreDefilement`) :
la relecture des achats n'est payée que quand il sert. **Achats** ne montre plus aucun bloc « à retirer » : au
plus la ligne « N colis à retirer → Colis » (`data-achats-vers-colis`, `pickupUnion.total`, seulement e-mails
lus). Banc `navigation-tache.cjs` (K) mis à jour : 163 verts ; mutations (entrée remise, étape « À retirer »
remise dans Achats, `cat_achats` qui ne mène plus au détail) ⇒ rouges.

## 1er novembre 2026 — La fiche complète d'une paire (maquette « numero-B-fiche-paire » validée)

**Demande** : depuis « Tout sur le N° » (et donc la vente « Fiche N° », le journal des e-mails),
le mode emballage, une fiche qui raconte le PARCOURS de la paire par identité seulement : Achat →
Stock → Annonce(s) → Vente → Colis → Argent ; « pas su » dit « — » + la raison ; une étape absente
est grisée, jamais inventée.

**Ce qui est fait** :
- `rechercheParNumero(q, numData, comptes)` (App.jsx) : la lecture de `ToutSurLeNumero` sortie en
  fonction ; le bloc de la recherche ET la fiche la lisent (une règle, §11).
- `src/fichePaire.js` (pur) : `parcoursPaire(rn, …)` à partir du résultat de `toutSurLeNumero`
  (N° par `cleNum`, vente Vinted par transaction → `item_id`, eBay par SKU, Leboncoin par lien/réf.).
  La fiche de la paire = celle de l'annonce vendue (par la transaction), sinon une fiche portant
  ce N°. `fusionEntreeVente` = la fusion d'`effEntry` (fiche ← correction posée sur la vente ←
  prix par N°) : **`effEntry` l'appelle désormais**, plus de seconde copie. Bénéfice =
  `beneficePaire` (l'écran Ventes) ; frais pas confirmés ⇒ « frais pas tous confirmés » sous le
  montant (un bénéfice d'une paire aux frais inconnus est un PLAFOND, pas un plancher : on n'écrit
  pas « au moins »). eBay : `montantRecuEbay` ; autre devise ⇒ écartée et dite. Versement :
  transaction finalisée (450, `status_updated_at`), lu dans la MÊME réponse que le pont
  transaction → annonce (aucune requête de plus). Ventes illisibles ⇒ vente, colis, argent « pas
  su » (jamais « pas encore vendue »).
- La coque lit `numData` quand la recherche OU la fiche est ouverte (`besoinNumData`) ; elle y
  ajoute les vues/favoris des annonces lues (`stats`, un nombre seulement s'il est écrit), les
  dates de versement et le compte de chaque vente (`_uid`).
- `src/FichePaire.jsx` + `src/styles-fiche-paire.css` : portail plein écran, « ‹ Tout sur le N° »
  (retour au bloc de recherche), grand N° mono, trois tuiles Achat / Vente / Bénéfice (« — » quand
  pas su), frise (pastille pleine à l'encre = lue ; au trait, gris = pas su ou pas arrivée), et
  « Bordereau » / « Emballer » quand la vente est à poster. Rouge seulement pour deux paires sous
  ce N°. Ouverture : événement `vrm:fiche-paire` (bouton « Toute l'histoire du N° » de
  `ToutSurLeNumero`, lien du mode emballage).

**Preuves** : banc `scripts/bancs/fiche-paire.cjs` (390 + 1512, 48 contrôles) : N°117 complet
(achat 52 € relié, Meuble B, vendue 95 € par SA transaction, colis livré, versé, +43 € « frais pas
tous confirmés ») ; N°118 partiel (en ligne, 14 fav., 150 vues ; le reste grisé, « — ») ; 50 paires
au même titre : N°227 = 36 € + tx 9226, N°228 = 37 € sans vente, N°211 = tx 9210 ; ventes en panne
⇒ « pas su » ; recherche → fiche → retour. Sur `origin/main` : 9 rouges. Mutations rouges : fiche
choisie par titre (C), ventes inconnues prises pour « pas vendue » (D).
Non fait (pour ne pas croiser les chantiers parallèles du tiroir de vente et des cartes
d'annonce) : un bouton « parcours » direct sur la carte d'annonce et la carte de colis — on y
arrive par « Fiche N° » → « Toute l'histoire du N° ». Le reçu d'achat n'est pas relu ici (il vit
dans Achats) : l'étape dit seulement « achat relié par son n° de transaction ».

**Geste de Julien** : aucun. Taper un N° dans la recherche → « Toute l'histoire du N° ».
## 1er novembre 2026 — Ma journée « Tournée » ; Ventes : bénéfice sur la ligne et « Déposé » au glissé

Maquettes validées : `journee-A-tournee`, `journee-mode-tournee`, `ventes-B-journal`, `ventes-ordi`.

**La tournée (Ma journée, en tête, après les alertes qui coûtent de l'argent)** — `src/tournee.js` (règle pure),
`src/Tournee.jsx` (carte + plein écran), `src/styles-tournee.css`. Quatre étapes, AUCUNE règle de comptage neuve :
- ① **Imprimer** : les lignes de « Imprimer les N prêts » de Colis (`lignesLot`). Ma journée ne lit pas les
  bordereaux captés par l'extension (choix du 8 sept., coût) : comme la case « À envoyer », le nombre publié par
  Colis (`vrm_colis_prets`) s'il parle du même lot, sinon « au moins ». Toucher l'étape ouvre l'impression
  EXISTANTE (drapeau `_pendingBordPrint`, le même que `?print=bord`). Cochée quand tous les prêts sont imprimés
  par VRM (`vinted_bords_printed`) — jamais tant que le nombre est « au moins ».
- ② **Emballer** et ③ **Déposer** : `toShip` + ventes eBay à poster — le nombre de la case « À envoyer » =
  `vrm_colis_aposter`. Les N° des paires dans l'ordre de leur date limite (⛔ jamais par emplacement, refusé le
  11 oct.). Déposer regroupe par transporteur (lu sur la FORME du n° de suivi du bordereau,
  `transporteurDeForme`) ; le point de dépôt n'est relié à un colis par aucune identité : jamais deviné. Les
  deux se cochent quand plus rien n'est à poster ET qu'un colis a été marqué déposé aujourd'hui
  (`vinted_ship_done`) : rien ne garde la trace de l'emballage seul, c'est dit dans le code. ② ouvre le mode
  emballage s'il existe (il répond à l'événement `vrm:ouvrir-emballage` en posant `detail.pris = true` — contrat
  pour le chantier « mode emballage ») ; sinon Colis, colonne « Prêts ».
- ④ **Retirer** : les points de la colonne « À retirer » (`pointsARetirer`), nombre = `pickupUnion.total` =
  `vrm_colis_retirer`. Cochée quand plus rien à retirer ET un colis noté retiré aujourd'hui
  (`vrm_colis_collected_at`, `vinted_pickup_done`). Ouvre Colis → « À retirer ».
- « Pas su » ⇒ « — », jamais 0 ni coché. Rien à faire du tout ⇒ pas de carte.
- **Plein écran** (« Voir la tournée ») : `CarteRelaisColis` (compacte, nouvelles options `sansListe` et
  `etiquette`) avec les seuls points relais, épingle = numéro de l'arrêt ; la liste des arrêts (dépôts par
  transporteur + points relais) rangée par **date limite la plus proche, dit « pas un itinéraire »** ; aucune
  distance ni durée (les « 4,2 km · 22 min » de la maquette ne sont pas mesurables : retirés). « Ouvrir dans
  Plans » sur un point relais à adresse.

**Ventes (liste Vinted)** — `src/beneficeLigne.js`, `src/GlisserDepose.jsx`, `src/styles-ventes-ligne.css`.
- **Bénéfice sur la ligne** (`LigneVenteCompacte`, prop `benef`) : la règle du tiroir (`beneficePaire` = prix −
  achat − frais connus, celle de `vrm_benefice_jours`). Prix d'achat manquant ⇒ « — » (le geste « Prix d'achat »
  reste sur la ligne). Frais pas confirmés ⇒ **« au plus »** : ce qui manque ne peut que BAISSER le bénéfice
  (la demande disait « au moins » : ce serait faux dans ce sens — à trancher par Julien si besoin). Téléphone :
  le bénéfice sous le prix ; ordinateur : colonnes Prix · Achat · Bénéfice avec leur en-tête.
- **« Déposé »** sur une vente À EXPÉDIER seulement : glisser vers la gauche (doigt) OU le bouton « Déposé » de
  la ligne (jamais un geste caché seul). Rien n'est écrit pendant 5 s, barre « Annuler » (⇒ rien écrit). Puis LE
  geste « ✓ Colis fait » de Colis, factorisé en `marquerPoste(o, b)` (`vinted_ship_done` + `vinted_bords_shipped`),
  appelé désormais par Colis aussi. Écran quitté pendant le délai : la même écriture, faite hors état React.

**Mise en page et §7** : les étapes Emballer / Déposer / Retirer ne réécrivent PAS leur total (c'est le
nombre des cases « À envoyer » / « À retirer », déjà à l'écran) — seulement les détails (N°, par transporteur,
par point). Sur ordinateur (≥ 1024 px) la carte est UNE rangée de quatre étapes (une ligne de texte chacune,
le détail au survol) : sinon Ma journée ne tenait plus sans défiler (banc `journee-widgets`, 966 px > 950).

**Preuves** : bancs `scripts/bancs/tournee.cjs` et `scripts/bancs/ventes-benefice-glisser.cjs` (nombres calculés
à la main dans leur en-tête), rouges sur `origin/main`, rouges sous mutation (voir le rapport de session).

## 1er novembre 2026 — Quatre défauts : barre du haut, fiche d'annonce au téléphone, Colis sans nombres redits, tiroir de vente

**1. La barre du haut recouvrait un filtre (banc `revendeurs`, 1512 px).** Mesuré : ce n'était pas la
colonne de gauche mais le bouton « eBay » des filtres de site, au bout de la barre du haut, passé SOUS
l'île d'actions (x 1364-1405 contre une île à 1376-1496 ; trois écrans : Vinted, Leboncoin, eBay). Cause :
`--vrm-ile` était mesurée en pixels ZOOMÉS (`getBoundingClientRect`, réglage « Taille » à 0,65 sur
`<html>`) puis appliquée en `padding-right` avant le zoom (réserve à 65 %), et les 24 px entre l'île et le
bord n'étaient pas comptés. Désormais la réserve = du bord droit du contenu au bord gauche de l'île, divisée
par le zoom de `.vrm-main` (`currentCSSZoom`), remesurée au zoom (observateur sur l'attribut `style` de
`<html>`) et au redimensionnement. Collée, la barre gardait sa marge du haut : le contenu défilait dans
cette bande (marge de 8 px et rembourrage du haut de `.vrm-main`, que Chrome laisse au-dessus d'un élément collé) — la marge devient un rembourrage, la bande se couvre du fond (ombre pleine) ; une ancre visée s'arrête sous la barre
(`scroll-padding-top`). Banc : rouge sur `origin/main` (3 recouvrements), vert après. Le banc était aussi
en retard sur la navigation du 31 oct. (porte « Aussi sur eBay » disparue, Colis Leboncoin en pastille,
bulles avec l'heure dedans, trois volets de Messages) : ses chemins suivent l'app, aucune règle retirée ;
« Tab inverse » juge maintenant le DERNIER contrôle ACTIF du fil (le micro de dictée est arrivé après le
champ), jamais l'envoi désactivé. 213 contrôles.

**2. La fiche d'annonce au téléphone (maquette Vitrine).** Fermée : photo + N° sur la photo, nom + taille,
prix, une ligne discrète (état en clair · vues · favoris · âge), et le prix d'achat seulement s'il MANQUE
(ambre, §7). « Plus d'actions » (44 px au doigt, `data-fiche-plus-bouton`, `aria-expanded`) déplie l'état
en jauge, mini, refuse, boost, marge, l'achat relié, le stock, la file Leboncoin, Relier, Passeport,
Marquer vendue — les MÊMES éléments (repliés par CSS, `data-fiche-ouverte`), mêmes écritures, mêmes
`data-*`. L'ordinateur ne change pas (bouton caché). Bancs : `vinted-ui` juge la fiche fermée (4 contrôles,
rouges sur main) puis dépliée ; `annonces-carte` déplie au téléphone avant de lire. Restent rouges, déjà
rouges sur main : `vinted-ui` « achat à côté de l'état » à 390 (Vitrine empile la paire) et « Achats : le
même calendrier » ; `annonces-carte` « recherche et retour au stock » (la barre du bas se cache clavier
ouvert).

**3. Colis : plus de nombres redits sous les colonnes.** « 4 colis à envoyer · 3 bordereaux prêts · 1 en
attente », les intertitres « Prêts à imprimer · 3 », « Partis … · 3 » et « Où sont ces 4 articles »
redisaient les colonnes. Le récapitulatif (même règle, mêmes « au moins » / « pas su ») reste dit au
lecteur d'écran (`.vrm-lu-seulement`, `role=status`) — les bancs qui le lisent (colis, postes,
formes-communes…) gardent leur juge ; restent visibles l'urgence, la ligne eBay (sans nombre), « Tout
générer », l'imprimante, le lot, les retours, les conflits de N°. Le repli « Colis par colis » fermé sur
ordinateur n'a PAS été fait : les cartes des colonnes y conduisent (défilement vers la carte, ancre des
retraits) et l'impression par lot y vit.

**4. Le tiroir d'une vente se conduit comme une feuille (banc `compact`).** Au téléphone la feuille du bas
couvrait « À expédier » (le centre du bouton à 521 px, la feuille à 522). Ouvert, le tiroir : se referme sur
un toucher de la PAGE hors de lui (le toucher atteint sa cible ; jamais dans le tiroir, sur sa ligne, ni
dans une autre feuille ou confirmation) ; au téléphone, réserve sa hauteur au bas de la page et remonte la
ligne ouverte au-dessus de lui. Banc : rouge sur main (« intercepts pointer events »), vert après, avec un
contrôle neuf « un toucher hors du tiroir le referme et atteint sa cible ». Le banc jugeait aussi le repli
« Chiffres » sur Compte eBay, passé dans Paramètres : il le juge sur Ventes.

### Paramètres, arrivée guidée et communauté : « logique et simple » (1er novembre)

Demande de Julien : « continue à améliorer toute l'app, tout doit être parfait, logique et
simple d'utilisation ». Tournée de Paramètres (Réglages, Mon compte, Abonnement, chaque
sous-écran), de l'arrivée guidée et de la Communauté, à 390 et 1512 px. Aucune fonction ni
décision retirée (Photoroom reste sur l'écran Vestiaire ; « Compléter les prix d'achat » reste
dans Paramètres ; « Présentation de VRM » reste retirée des Réglages, sa demande du 27 oct.).

| avant | après | pourquoi |
|---|---|---|
| groupe « Comptes Vinted » (qui rangeait aussi eBay, emails, sécurité) | « Comptes et emails » | le titre dit ce que le groupe contient |
| « Import des emails Vinted » sous Comptabilité | à côté de « Réception des emails » | les deux réglages des emails ensemble |
| « Ventes et achats masqués » | « Achats masqués · Retirés de la compta, à réafficher » | une vente ne se masque plus depuis le 29 oct. |
| « Régime fiscal » sans valeur | le statut choisi à droite, « À choisir » sinon | savoir sans ouvrir ; jamais deviné (`vinted_regime`) |
| « Compléter les prix d'achat » sans phrase | « Saisie en série, pour un bénéfice juste » | dire à quoi sert le geste |
| « Mode stream » muet au téléphone (`vrm-aide` cachée) | sa phrase reste visible | le libellé seul ne dit rien |
| Notifications : « Serveur prêt à envoyer · appareil abonné » (nombre absent) au-dessus d'« Activer sur cet appareil » | le nombre seulement s'il est lu, « … en tout » | on lisait « cet appareil est abonné » |
| message d'essai : « Réglages → Ton abonnement » | « Paramètres → Abonnement » | chemin réel |
| « Réglages → Extension » (n'existe pas), « Réglages → Mon compte » | « Paramètres → État des connexions », « Paramètres → Mon compte » | chemins réels |
| État des connexions : « Dernière version observée dans ma boutique », « Données de l'extension », « Données des emails », « Aucune donnée enregistrée pour cette source », « Horodatage à vérifier », « Mise à jour observée » | « Version qui a lu en dernier », « Ce que l'extension a lu », « Emails reçus », « Rien reçu pour l'instant », « Date à vérifier », « Dernière arrivée » | vocabulaire de développeur (hors Sécurité des données, qui garde le sien) |
| Mon compte : « Photo de profil » (titre) + carte « Ta photo de profil » dans une seconde carte, lettre « V » quand l'en-tête dit « C » | une carte, la lettre de l'en-tête | double titre, double cadre, lettre venue de nulle part |
| deux lignes « Discord » (connexion rapide, profil) | « Discord » et « Profil Discord · ton pseudo et ton avatar Discord dans VRM » | deux fonctions, deux noms |
| Arrivée guidée : plateformes « Vinted, Leboncoin et eBay » | + Vestiaire Collective | VRM le gère depuis le 27 oct. |
| Arrivée guidée : « Terminer » au 5ᵉ écran, puis encore un écran | « Suivant » | « Terminer » ne terminait rien |
| Arrivée guidée sombre : texte blanc sur #6F86E8 (~3:1) | encre sombre (`onAccent` de Vitrine) | lisibilité |
| « changer quand tu veux dans Réglages » | « … dans Paramètres → Affichage » | chemin exact |
| Communauté : « Me retirer de la carte » sans demander | demande d'abord (sa place et « premier de ta ville » sont effacées) | comme bloquer, classement, groupe |

Bancs : `reglages-premium` (+ lignes masqués/régime/import, photo de profil, push sans nombre),
`communaute` (« Annuler » ne retire rien), `connexions-reglages`, `abonnement` (le groupe se
reconnaît par `data-groupe-reglages`, plus par son titre), `bienvenue` et `compta-simple`
remis sur la navigation par tâche (« Ventes », menu « Plus » : ils cherchaient « Vinted » et
« Gestion », disparus le 31 oct.). Détail compta : historique compta (même date).
Non fait, signalé : Communauté utilise encore les boîtes du navigateur (`window.confirm`) ;
Republier dit « Réglages → Rédaction d'annonces par l'IA », qui n'existe pas (écran d'un autre
chantier).

## 1er novembre — Stock, Republier, Annonces (ordinateur) : gestes fréquents plus courts, chaque geste se dit

Demande de Julien : « continue à améliorer toute l'app, tout doit être parfait, logique et simple
d'utilisation ». Périmètre de cette passe : Stock, l'atelier Republier, Favoris & offres, Achats,
Annonces sur ordinateur. Aucune règle neuve, aucune fonction retirée, aucun numéro touché.

| écran | avant | après | pourquoi |
|---|---|---|---|
| Stock → Cases | taper le N° d'une paire à ranger disait « Aucune case ne porte la N°2 » ; Entrée la rangeait, sans le dire (placeholder « (Entrée : la ranger) ») | « N°2 n'est pas encore rangée — prochaine case libre : … » + **Ranger ici** / **Autre case** ; un N° hors stock le dit (« … n'est pas parmi tes articles en stock ») ; placeholder « Où est la N° … ? » (Entrée marche toujours) | le geste le plus fréquent (ranger une paire qu'on a en main) se faisait par une touche cachée |
| Stock → Meubles, case vide | « Case 6 · choisis l'article » | « Rangée 2, colonne 3 · choisis l'article » (`data-placer-case`) | le reste de l'écran parle en rangée/colonne (règle du meuble, recherche, fiche) |
| Stock → Meubles, pose | rien ne se disait (la case clignote, parfois hors de l'écran sur téléphone) | message « N°31 rangée : Étagère salon · rangée 1, colonne 2. » | retour après un geste réussi |
| Stock → Meubles, fiche d'une paire PAS rangée | « Déplacer » et « Retirer de la case » (sans objet) | « Ranger dans une case » seul (`data-fiche-ranger`) | bouton ambigu |
| Stock → Meubles, « Retirer de la case » / « Je l'ai sorti du stock » | rien ne se disait | « N°… retirée de … : elle repasse dans « À ranger ». » / « N°… sortie du stock — son numéro reste pris, jamais redonné. » | retour ; rappelle la règle §5 (le numéro n'est jamais redonné). « Remettre en stock » reste le chemin de retour (Achats → retours) |
| Annonces (Vinted) | en tête : CA finalisé · Disponible · En attente (des « — » tant que rien n'est lu) + « À faire aujourd'hui » | rien de tout ça sur Annonces (la ligne de fraîcheur reste) ; Ventes · Vinted les garde | l'argent ne dit rien de la tâche « annonces », Ma journée est dans la barre ; les cartes remontent d'environ 100 px sur ordinateur |
| Annonces, astuce N° | « Chaque article a un numéro , jamais redonné. » (l'écart d'un conteneur flex posait une espace avant la virgule) | « … un numéro, jamais redonné. » | coquille visible |
| Republier (menu) | bouton « Republier… » ouvrait une feuille titrée « Actions sur Vinted » | feuille « Republier et brouillons » | le titre dit ce qu'on vient de toucher. Entrées, ordre (coffre → supprimer → brouillon → mise en ligne) et réglages inchangés ; rien n'est remis (« Varier », réglage photo par annonce, secours) |

**Contrôles** : banc neuf `scripts/bancs/stock-gestes.cjs` (390 tactile et 1512 px, données
inventées) — **18 rouges** sur le build d'avant (3b60a48d), vert après ; `republier.cjs` + 1 contrôle
(l'astuce N° ne passe pas par un conteneur flex) — 2 rouges avant, vert après. Rejoués verts :
`republier`, `stock-retrouver`, `rangement`, `stock-planches`, `stock-partis`, `navigation-tache`,
`messages-volets`, `lbc-comme-vinted`, `achats-messages-premium`. Rouges DÉJÀ là sur 3b60a48d, non
touchés : `stock-piece` B (« la paire choisie… rien d'autre ne bouge », `4_0:[401,402]`) et C
(instable), `garage3d` (molette, 2 rouges). Audits tdz, variables, icones, boutons, identite,
moteur-offres, offres-auto, republier, stock-plan : verts.

**Geste de Julien** : aucun.
## 1er novembre 2026 — Finition « premium » (sans nouvelle palette ni dégradé)

Demande de Julien : « améliore le rendu visuel surtout, le site doit être beaucoup plus
premium ». Il avait refusé 25 directions de style et toutes les variantes de dégradé :
Vitrine reste (blanc, encre, cobalt rare, ambre = geste). Le gain vient de la finition,
dans une feuille dédiée chargée en dernier, `src/styles-finition.css` (une seule à
retirer pour revenir en arrière), plus trois retouches de JSX sans règle métier.

Défauts corrigés (vus sur captures, avant/après) :
1. **Envoyer** (fil de Messages) : champ vide, il était cobalt à 45 % d'opacité — on le
   croyait cassé. Désactivé : fond neutre, icône grise, opacité pleine, et l'infobulle
   dit pourquoi (`ComposeConv` : « Écris d'abord ta réponse », « Envoi en cours… », ou
   « la raison est écrite au-dessus ») ; `aria-label` inchangé (« Envoyer »). Actif :
   cobalt plein ; en sombre l'icône passe en `--vrm-on-accent` (blanc sur #6F86E8 = 3,4:1).
2. **Paramètres coupé** en bas de la colonne (16 entrées + 6 groupes dépassent 720–800 px) :
   le groupe « Moi » (Communauté, Paramètres) est rendu dans `.vrm-rail-pied`, hors de la
   zone qui défile (même ordre, mêmes entrées, mêmes `data-nav-groupe`) ; un filet le
   sépare quand la zone défile ; le fondu `data-rail-suite` reste l'indice (edge-tailles).
3. **Fil** : filet sous l'en-tête, bulles 15/1.45 à coin « queue », heure discrète,
   séparateur de jour centré, encart d'offre à filet (le dégradé vert de « acceptée »
   retiré), pied à filet, champ arrondi qui s'allume en cobalt au focus, pastilles 36 px.
   Au téléphone, la pastille d'icône générique de l'en-tête s'efface : le titre de la
   paire n'est plus coupé en « Sal… ».
4. **Liste des conversations** : la ligne choisie touchait le bord et portait barre + fond ;
   une seule marque (fond arrondi), marge de 12 px ; filtres en pastilles comme ailleurs.
5. **« Traduire »** : plus d'emoji 🌐, lien gris souligné au lieu d'un cobalt sous chaque
   message (§7 : l'accent reste rare).
6. **États vides** : plus d'emoji (🛍️, 🔌, 🟢) ni de pavé teinté d'accent — icône au trait
   dans un disque neutre (`EmptyState` accepte un nom d'`ICON_PATHS`).
7. **Boutons désactivés** (`:disabled` ou `aria-disabled`) : à 40–55 % d'opacité ils
   tombaient sous 2:1 (« Générer le bordereau », « Corriger ») ; ils restent lisibles,
   texte gris sur l'aplat neutre. Interrupteurs, onglets et choix segmentés exclus.
8. **Choix segmentés** : « Semaine » débordait de sa pastille (Statistiques, 390 px).
9. **Typographie** : étiquettes de chiffres à 10,5–11 px (bande « CA finalisé », N° de la
   tournée, barre de Ma journée) portées à 12 px ; chiffres en tabulaire.
10. **Focus clavier** : un seul anneau cobalt de 2 px partout.

Piège : le système de boutons (`styles-boutons.css`) passe par `:is(…, body > :not(#root))`,
donc porte une spécificité d'ID ; une règle de finition sur un bouton sans classe doit
ajouter `:not(#_)` pour l'emporter.

Banc neuf : `scripts/bancs/finition-premium.cjs` (données inventées) — A. colonne à
1512×950, 1440×800, 1280×720 (Paramètres et Communauté visibles sans défiler, chaque
entrée atteignable) ; B. Envoyer vide/saisi, 390 et 1512, clair et sombre (fond neutre et
`title` ; cobalt plein, contraste ≥ 4,5) ; C. bulles ≥ 12 px de marge, pied dans le fil ;
D. huit écrans × 2 tailles × 2 thèmes, captures `SHOTS=`. **7 rouges sur le build
d'avant (f7437534), 0 après.** Sonde : `SONDE='<expr>' SONDE_TAB= SONDE_VP=`.
Bancs relancés : messages-volets, navigation-tache, colis-colonnes, stats-vitrine, tournee,
ventes-benefice-glisser, coque-mobile, formes-communes, plateformes-premium,
ventes-colis-premium, traduire-messages verts ; `messages-sites` (1 rouge : un POST
`app_data` à l'ouverture) et `edge-tailles` (6 rouges « île d'actions » à 1024/960 px)
étaient déjà rouges avant, identiques après. Non touché : la barre du haut
(`styles-barre-haut.css`, un autre chantier).

## 1er novembre — Chiffres de Ma journée : la semaine en barres, moins d'écritures

**Demande de Julien** : « je n'aime pas le graphique, il n'est pas beau, je veux que tu le
changes ; pareil pour le CA, le bénéfice : il y a des écritures partout qui gâchent tout, je
veux que tout soit parfait ». Référence : la maquette A « Semaine en barres », simplifiée.
Style Vitrine inchangé.

**Ce qui change (forme seulement, aucune règle de calcul)** :
- `CourbeSemaine` (cubique monotone, aire en dégradé, série « reçu » en pointillé, légende,
  graduations) et `DayWeekNote` (« Vendu : jour de la vente · Reçu : jour du versement… »)
  sont RETIRÉS. `BarresSemaine` : une barre par jour PASSÉ (montant vendu, angles droits,
  cobalt), la valeur au-dessus seulement si elle tient dans sa colonne, un « 0 » discret pour
  un jour sans vente, rien après aujourd'hui, aujourd'hui = libellé en encre + trait cobalt.
  Le « reçu » du jour reste porté (`data-recu`, infobulle) mais ne se dessine plus. La
  hauteur suit celle que la carte laisse (148–240 px ordinateur, 136 px téléphone).
  `src/courbeMonotone.js` reste (test `syntheses`), App ne l'importe plus.
- Carte « Vendu en … » : UN grand chiffre (le vendu du mois, `data-vendu-mois` — ce que
  l'écran publie déjà), une ligne « 7 ventes · 2 aujourd'hui » (le nombre, pas le montant du
  jour : il est déjà sur la barre « auj. »), puis une rangée de cases de même forme partagée
  par des filets : **Bénéfice · Reçu en … · À mettre de côté (micro) · CA {année}**. Chaque
  case : libellé, montant (Geist Mono tabulaire, « € » plus petit, `Montant`), au plus une
  ligne : « au moins · 1 à dater », « au moins », « 2 sur 4 · 2 prix d'achat › » (ambre, ouvre
  la saisie), « avant tes dépenses », « pas lu ». Les explications longues passent en `title`.
  Deux colonnes en étroit, une colonne par case dès 560 px de carte (requête de conteneur).
- Bénéfice (`BeneficeJournee`) : le net quand il se calcule, sinon le BRUT des ventes au prix
  d'achat connu avec sa couverture et la porte ; montants arrondis à l'euro (les data-* gardent
  les centimes, Comptabilité le détail). La ligne « Aujourd'hui : … brut · … net » est retirée
  (dans l'infobulle et les data-*). « Masquer le bénéfice » reste en mode « Modifier » ; le
  choix « Pas de dépenses · Ajouter une dépense » reste (une fois, caché au téléphone).
- « Cette semaine » : le total à droite du titre (tu, si c'est le même nombre que le grand
  chiffre : jamais deux fois, §7), `data-total-semaine` porté par la carte.
- Tendances : 4 cases sans cadres, base nommée en une ligne courte (« contre 29 €/j »,
  « contre 153 € »), le reste en infobulle. La carte « En attente » voisine prend les mêmes
  montants en chasse fixe.
- Styles : `src/styles-journee-chiffres.css`, chargée après Vitrine ; les cartes portent
  `.vrm-jc` (les couches d'avant posaient grille, dégradé et notes cachées au téléphone).

**Preuve** : banc neuf `scripts/bancs/journee-chiffres.cjs` (390 et 1512 px, clair et
sombre) — 7 jours, aucune `path` (ni lissée ni seconde série), une barre par jour passé dont
la hauteur suit le montant, aucun texte hors de sa boîte, lignes de texte du bloc ≤ 30 (390)
/ ≤ 34 (1512), un seul chiffre ≥ 30 px, data-* publiés présents, jamais « encaissé ». Sur
l'arbre d'avant (68c9fe12, copié et lancé depuis cet arbre) : 18 rouges (tracés `C`, 3 séries,
aucune barre, 35 et 45 lignes). Après : 52 verts. `benefice-journee` adapté sans l'affaiblir
(« en barres » au lieu de « monotones » ; la couleur du net lue sur le montant, et rouge si
le montant est absent) ; `scripts/tests/iphone.cjs` vise `.vrm-jc-rangee` au lieu de
`.vrm-day-recu`.

**Geste de Julien** : regarder Ma journée (téléphone et ordinateur).

## Récapitulatif d'une vente — 1er novembre 2026

**Demande** : « je n'aime pas trop le récapitulatif de la vente », puis, devant
quatre maquettes (0 actuel, A « fiche en lignes nettes », B « photo en vitrine »,
C « deux colonnes, cascade ») : « applique tout, je veux que ce soit clair ».
Appliqué : **A**, style Vitrine inchangé.

**Où** : le tiroir qui s'ouvre quand on touche une vente dans Ventes · Vinted
(feuille du bas au téléphone, panneau de droite sur ordinateur). La coque
(`LigneVenteCompacte`) prend une prop `recap` (fonction qui rend tout le contenu) ;
sans elle, le tiroir d'avant (Leboncoin, eBay — non touchés). « Tous les sites »
n'a pas de tiroir : une ligne y mène à l'écran de son site.

**De haut en bas** :
1. photo carrée de taille constante (84 px téléphone, 96 px ordinateur), pastille
   `N°…` seulement si l'identité donne le N° (`effEntry`), sinon « Sans N° VRM » ;
   nom complet ; taille si elle n'est pas déjà dans le titre ; état de l'article
   seulement si SON annonce est trouvée par identité (`txnItem`) ;
2. UNE phrase d'état (`phraseVente`) et la frise Vendue → Bordereau → Déposée →
   Livrée → Argent reçu (`friseVente`, `src/recapVente.js`, sans React). Preuves :
   bordereau = PDF relié par n° de transaction (`bordParTx`, `labelsCaptes`) ;
   déposée = « Colis fait » (`vinted_ship_done`) ou un statut qui dit que le colis a
   bougé (`COLIS_DEJA_BOUGE`, `waiting`, au relais) ; livrée = « livré / remis /
   réceptionné » ou finalisée ; argent = finalisée (450, texte ou champ machine),
   date = `fetchVersementsVinted`. Une étape plus loin prouvée coche les
   précédentes (`preuve: 'deduite'`, sans date) ; sinon « à venir ». La frise
   REMPLACE la pastille de statut (retirée le 28 sept. parce qu'elle redisait la
   pastille) : jamais les deux. Annulée / remboursée / retour / suspendue : pas
   de frise, la phrase dit l'état (avec l'issue du N° qui existait déjà) ;
3. l'argent en lignes, chiffres Geist Mono à droite : Prix · Frais (si saisis) ·
   Prix d'achat (sinon le geste ambre « Saisir le prix d'achat » = `CoutAchatVente
   recap`, « ou relier un achat » à côté) · trait · Bénéfice (règle de la ligne,
   `beneficeLigneVente` : « — » sans achat, « au plus » frais pas confirmés) ·
   Versé (date, « oui — date pas lue », ou « — pas encore »). Aucune règle de
   calcul changée ; `data-benef-vente` garde son sens ;
4. détails : acheteur (si lu), compte, date de vente (seulement sans frise : la
   frise la porte), n° de suivi du bordereau, rangement, achat relié ;
5. gestes : un seul principal (le bordereau, tant que le colis doit partir), puis
   Conversation (cible `conv` → Messages, le chemin des notifications), Fiche de
   la paire, Voir sur Vinted ↗, Voir au stock, Voir le lot, Article perdu / Il est
   revenu, la facture, et « N° et frais » replié (mêmes champs et écritures :
   `CoutsVente`, N°, correction du prix, reçu d'achat, changer l'achat relié).

**Redites retirées** : la date de vente n'est plus écrite deux fois (frise), le
prix d'achat n'est plus redit dans « Achat relié » (montant dans l'argent), la
date du versement n'est que dans « Versé », le N° une fois (« Fiche de la paire »
porte `aria-label="Fiche N°…"`). « 🖨 » retiré du libellé du grand bouton
bordereau (l'icône le dit déjà).

**Contrôles** : banc `scripts/bancs/recap-vente.cjs` (390 clair, 390 sombre,
1512) — frise cochée seulement sur preuve (payée seule / bordereau / livrée +
colis fait / finalisée versée le 25), jamais pastille + frise, « — » sans prix
d'achat, « au plus 42,05 € », un nombre une fois, ni « encaissé » ni « n/d »,
aucun débordement, montants entiers, cibles 44 px, toucher à côté qui referme,
annulée sans frise. **Rouge avant** (dist d'avant : 30 rouges) et **rouge par
mutation** (frise qui coche « Déposée » sans preuve). Bancs adaptés sans
affaiblir : `compact` (photo du récapitulatif 84 × 84 à gauche, en-tête < 200 px),
`revendeurs` (« estimé » → `data-recap-benef-etat` partiel/ok, mêmes montants),
`mobile` (photo du récapitulatif 84 × 84 à toutes les largeurs). Verts : compact,
revendeurs, ventes-colis-premium, double-vente, ventes-benefice-glisser,
ventes-frappe, coque-mobile, photo-vente, ventes-bordereau, notifs-destination,
pont, deux-extensions, lbc-comme-vinted. Rouges DÉJÀ rouges avant (mêmes lignes
sur le dist d'avant) : `feuilles-coque` (27), `achats-hors-plateforme` (4),
`annonces-ventes-brouillon` (15, clics de navigation), `mobile` (« navigation
hors du contenu » à 320 px, avant d'arriver au tiroir).

**Geste de Julien** : regarder une vente (téléphone et ordinateur).
## 1er novembre — Ma journée calme : une colonne, une hiérarchie, des listes à filets

**Demande de Julien**, après la refonte des chiffres : « pour Ma journée tu peux faire mieux
encore », puis sur sa capture à 1512 px : « tu ne trouves pas que ça fait bordel ? », « c'est
pas pro », « tu peux faire 15 fois mieux, là ça fait bâclé ». Ce qu'on voyait : le même nombre
trois fois (Tournée « Imprimer 10 b… », case « 10 À envoyer », carte « Emballer les colis
prêts — 10 bordereaux »), tous les sous-titres de la Tournée coupés au milieu d'un mot, « À
faire » en mosaïque (cartes de largeurs et hauteurs différentes, textes de 3-4 lignes), les
chiffres sur la moitié gauche de l'écran, « Tendances » qui écrivait « — aucune date » comme un
chiffre, et « eBay » grisé dans la colonne de gauche.

**Méthode** : un croquis HTML de l'écran entier (390 et 1512) avant de coder
(`taste-skill`, `references/app-screens.md` : une colonne tenue, couleur sur les données, des
filets plutôt que des aplats, une hiérarchie de lecture) ; puis boucle capture → correction.

**Ce qui change (forme seulement ; aucune règle de calcul, aucune alerte ni cible retirée)** :
- **La colonne** : sur ordinateur, Ma journée tient dans 1120 px centrés (plus de cartes
  étirées sur 1 300 px). Ordre : le bonjour (titre de page 32 px, 28 au téléphone ; date et
  « N choses à faire » sur une ligne ; « Modifier » à droite) → **Urgent** (les alertes qui
  coûtent, toujours en tête, maintenant sous un titre) → **Ta tournée** → les gestes restants
  → **À faire** → les chiffres. Chaque section : un titre de 15 px, 8 px au-dessus de sa
  boîte, 32 px entre deux sections (24 au téléphone).
- **« À faire » et l'urgent en liste** : une boîte blanche à filet d'1 px, une ligne de 64 px
  par alerte (icône 20 px · titre · une ligne de détail · « Voir › »). Le titre est la partie
  de la phrase AVANT « — » (« 3 colis pressés »), le détail le reste + le sous-titre
  (« Le plus urgent à poster aujourd'hui · N°60 · … »). `src/UneLigne.jsx` coupe une ligne trop
  longue à la fin du dernier MOT entier (« … »), jamais au milieu ; le texte entier est dans
  l'infobulle et le nom du bouton. Au téléphone (`lignesTel`), titre et détail peuvent
  prendre DEUX lignes avant d'être coupés : un N°, une heure limite (« c'était avant 7 h »),
  un nom de paire ou de compte ne disparaissent pas (bancs `colis-heure`, `double-vente`,
  `ebay-messages-journee`) ; toutes les lignes y ont la hauteur de deux (84 px). « Voir »
  devient « › ». Le rappel URSSAF
  garde son bouton « Noter ma déclaration » à droite (dessous au téléphone).
- **La Tournée porte « à envoyer » et « à retirer »** (§7, le même nombre jamais deux fois) :
  quand elle est affichée (`tournee.utile`), les cases « À envoyer » / « À retirer » se taisent
  (rendues `hidden`, leurs `data-tuile`/`data-n` restent pour les bancs) ; ce que disait leur
  couleur (colis en retard, dernier jour de retrait) est dit par l'étape elle-même : sa ligne
  « le plus pressé » passe en AMBRE quand c'est aujourd'hui, demain ou dépassé
  (`data-tournee-presse`) — pas de ligne d'alerte en plus (les actions de « À faire » restent
  exactement celles d'avant, banc `journee-widgets`). La ligne « Emballer les colis prêts »
  n'est plus redite (l'étape Emballer ouvre le même mode). Une PETITE case « À envoyer » qu'il
  a ajoutée lui-même (Modifier → Ajouter) reste : c'est son choix. Restent dans la barre
  « Messages » et « Prix à baisser », en une rangée à filets.
- ⚠️ **Décision à confirmer par Julien — « tout visible sans défiler »** : la règle d'avant
  (banc `revendeurs`, `journee-widgets` : photos et stock visibles sans défiler à 1512×900) ne
  tient plus avec un écran aéré en sections (≈ 1 300 px de haut). Elle reste exigée en densité
  resserrée (0,65, Réglages) ; en densité normale, les gestes (Tournée, À faire) et le haut des
  chiffres se voient sans défiler, les photos et le stock suivent. S'il préfère tout voir d'un
  coup, la densité 0,65 le fait.
- **Tournée** : titres courts (« 10 à imprimer », « 7 à emballer », « 3 à déposer », « 13 à
  retirer · 5 relais »), deux lignes au plus (deux noms et « +N », le plus pressé), une ligne
  ne se coupe qu'après « · » ou « : » (`morceaux`) ; la phrase longue d'avant
  (`texteEtapeLong`) reste en infobulle. « Voir la tournée · N arrêts » est un lien dans
  l'en-tête de la section (il ne mange plus la rangée). Une boîte à filets : 4 colonnes sur
  ordinateur, une liste au téléphone (les N° en pastilles).
- **Aucune rangée à moitié vide** : `GrilleJournee` élargit les widgets AFFICHÉS d'une rangée
  que la disposition ne remplit pas (une carte retirée ou muette) — 6 colonnes dès 1280 px,
  2 de 1024 à 1279 (`data-etire6`/`--etire6`). Pas en mode « Modifier » (la vraie taille s'y
  voit). La disposition par défaut et `connus` ne changent pas.
- **Chiffres** : cartes blanches à filet d'1 px (plus d'aplats gris empilés), barres de la
  semaine plus larges (jusqu'à 44 px, la moitié de la colonne) ; « En attente » à côté de
  cartes plus hautes : son montant en haut, sa phrase au pied. **Tendances** : une case sans
  base (« — aucune date », « pas de moyenne ») n'est plus posée comme un chiffre ; la carte mène
  à Statistiques qui le dit avec sa raison. Les cases gardent leurs `data-tendance`/`data-v`.
- **Dernières ventes** : le titre de la paire coupé au mot (`UneLigne`). « Vendus ailleurs » au
  pied : même boîte à filet.
- **Colonne de gauche** : le fondu (`mask-image`, `data-rail-suite`) pâlissait la dernière
  entrée visible (« eBay » avait l'air désactivé) : retiré, un filet d'1 px dit la suite.
- Styles : `src/styles-journee-mieux.css`, chargée en tout dernier ; `src/styles-tournee.css`
  (carte) réécrite.

**Preuve** : banc neuf `scripts/bancs/journee-mieux.cjs` (390 clair/sombre, 1512 clair/sombre,
1440×600, 1280, et 1512 avec une disposition sans « En attente ») : en-tête visible ; titre et
détail d'UNE ligne (deux au plus au téléphone), hauteurs égales, coupe au mot avec le texte
entier en infobulle ;
Tournée sans rien de coupé ; pas de case « à envoyer/à retirer » visible à côté de la Tournée ni
de ligne « Emballer » ; chiffres ≥ 90 % de la largeur et même hauteur par rangée ; aucune case
Tendances « — » ; aucune entrée de la colonne fondue ; contraste ≥ 4,5. Sur `origin/main`
(001983fa, arbre copié, banc lancé depuis lui) : 38 rouges (dont 1512 sans « En attente » : 66 % de la largeur ; 1440×600 : la
colonne masquée). Après : 118 verts. Rouges laissés, identiques sur `origin/main` (même
arbre copié) : `transporteurs` (13), `statuts-colis` (2), `poste-sans-depart` (2). Bancs adaptés sans affaiblir la règle : `emballage`
(H : la séance s'ouvre par l'étape Emballer de la Tournée quand elle est là, et pas deux
fois), `ebay-colis`, `vestiaire-colis`, `tournee`, `colis-fiables`, `transporteurs` (la case
porteuse est attendue « attachée », plus « visible ») ; `revendeurs` et `journee-widgets` : la
vue globale sans défiler exigée en densité 0,65, les gestes et le haut des chiffres en densité
normale (voir la décision ci-dessus).

**Geste de Julien** : regarder Ma journée (téléphone et ordinateur).

## 1er novembre 2026 — Cohérence de tous les onglets et de chaque bouton (banc `tous-boutons`)

Julien : « continue à regarder la cohérence de tous les onglets, de chaque bouton ».
Au lieu de regarder écran par écran, un banc les visite TOUS et clique tout :
`scripts/bancs/tous-boutons.cjs` (données inventées, mêmes formes que
`navigation-tache.cjs` ; aucune écriture n'a d'effet, aucune confirmation n'est
acceptée — une feuille ouverte est seulement refermée). À 390 px tactile et
1512 px : la coque (colonne, barre du bas, « Plus »), Ma journée et sa Tournée,
chaque filtre de site et sous-onglet d'Annonces, Ventes, Messages, Achats et
Colis, Republier, Favoris & offres, Stock, Statistiques (+ Prix qui marche),
Comptabilité (+ Factures), Communauté, Comptes liés, Achats masqués,
Organisation, Paramètres et CHACUN de ses panneaux — 99 écrans, ~820 éléments
cliqués un par un. Il juge : erreur JS, écran tombé/blanc, onglet inconnu,
bouton mort, lien sans adresse, feuille qui ne se ferme pas (et Échap sur
ordinateur), texte qui nomme un écran et en ouvre un autre, « Réglages »/« Stats »
au lieu du nom de la colonne, cible < 44 px au doigt, désactivé sans raison ;
et (demande du coordinateur, capture de Julien) aucune entrée de la colonne à
moitié visible à 1512×1000, 1512×880, 1440×800, 1280×720, 1280×650, et Vestiaire
dans les filtres de Colis quand le compte existe. Exceptions commentées dans le
banc (onglet « Réglages » DANS Paramètres, barres du graphique des mois…).

Sur `origin/main` (66ad4d3, arbre `git archive`, même banc) : 29 défauts + 5
feuilles ciblées ; après : 0. Corrigé :
- **Échap ferme la feuille du dessus** sur ordinateur (`_installerRetourFeuilles`,
  App.jsx) : Republier, prix d'achat à compléter, Relier un achat, Passeport,
  Marquer vendue, offres automatiques, Nouvelle facture, Comptes liés… ne se
  fermaient qu'à la souris. Un écran qui gère déjà Échap a refermé SA feuille
  avant ce tour : rien de plus (jamais deux feuilles pour un Échap). Le panneau
  « Synchronisation » (pas une feuille) se ferme aussi à Échap.
- **« Ouvrir l'annonce sur Vinted »** (photo d'une fiche d'annonce) n'avait
  aucune adresse quand `url` n'était pas lue : l'adresse se refait par
  l'identité (id + domaine du compte) ; sans id, la photo n'est plus un lien.
- **Un nom par destination** : « Réglages » désignait l'écran Paramètres dans
  ~25 phrases et boutons (« Mets-la à jour depuis Réglages », « ‹ Réglages »,
  le bouton du panneau de synchronisation…) ⇒ « Paramètres », et pour
  l'extension « Paramètres → État des connexions » (là où sont les liens de mise
  à jour). Chemins qui n'existaient pas : « Réglages → Rédaction d'annonces par
  l'IA » (aucun réglage ne pose la clé IA — la phrase le dit), « Réglages → Mes
  adresses de réception » (⇒ « Paramètres → Réception des emails »), « Paramètres
  → Facturation Pro » (le bouton est sur l'écran Factures), « Réglages →
  Restaurer » (⇒ « Paramètres → Restaurer une sauvegarde »). Le bouton
  « Réglages » des Factures (réglages locaux) devient « Réglages des factures ».
  Inchangés : l'onglet « Réglages » DANS Paramètres (à côté de « Mon compte »),
  « Réglages » de l'iPhone.
- **Désactivés qui disent pourquoi** : « Voir ce que je comprends » (agent
  eBay), « Afficher les favoris », « Actualiser » (Organisation), « Chercher »
  des Factures (était un bouton MORT champ vide : désactivé, avec la raison).
  Les zones « En attente / Comptabilisées » portent `aria-pressed`.
- **Cibles au doigt** : le « ⓘ » des explications passe de 32 à 44 px au doigt
  (sans rien pousser) ; « ↻ Actualiser » de Leboncoin ne rétrécit plus à 35 px
  pendant la lecture.
- **La colonne ne coupe jamais une entrée** (capture de Julien : « Vestiaire »
  coupé par le filet du pied) : SideBar mesure et pose `data-rail-densite` 1-4
  (espaces resserrés d'abord, entrées à 34 px gardées ; 30 puis 28 px seulement
  quand sinon une ligne serait coupée) ; si même serrée elle ne tient pas
  (< ~640 px de haut), TOUTE la colonne défile (`data-rail-defile`), pied compris.
- **Colis : les filtres de site suivent la règle d'Annonces/Ventes** — un site
  où il a un compte (`sitesPresents`, « pas su » ⇒ montré) a sa pastille, même
  sans colis ce jour-là (Vestiaire manquait).

Laissé (et pourquoi) : la rangée de filtres de Colis défile à l'horizontale à
1280 px (la 4ᵉ pastille est sous le bord, comme toute rangée défilante) ; le
banc ne clique jamais un lien externe (il vérifie seulement son adresse) ; les
écrans qui dépendent de l'extension (Messages Vinted) sont visités dans leur
état « non lu ». Lancer : `BANC_PORT=9150 node scripts/bancs/tous-boutons.cjs`
(≈ 1 h en série ; `BANC_TAILLE`, `BANC_ECRANS` pour une partie ; 4 processus
en parallèle ≈ 30 min).

## 1er novembre — Ma journée sans redite (« je trouve cet endroit très répétitif »)

Capture de Julien (iPhone 390 px, sa vraie base) : « 10 À envoy… · 13 À retirer ·
35 Messag… · 2 Prix à b… » (libellés COUPÉS), puis dans « À faire » : « 3 colis
pressés — Le plus urgent… », « 2 colis à vérifier — Délai de retrait dépassé… »,
« 2 achats au point relais en cours de vérification — Vinted les dit… », « Emballer
les colis prêts — 10 bordereaux prêts à imprimer… », « Nouveau mois : déclaration
URSSAF octobre 2026 à faire avant le 30… — Au moins 2670,97 € reçus · à payer ≈ au
moins 331,20 € ». Le même nombre deux fois (10), la même famille trois fois.

**Ce qui change (aucune règle de calcul, mêmes sources : `toShip`, `colisEb`,
`pickupUnion`, `vrm_colis_aposter`, `vrm_colis_retirer`, `rappelUrssaf`)** :
- **Les cases** : grille 2 × 2 au téléphone, quatre colonnes sur ordinateur ;
  libellés ENTIERS (« À envoyer », « À retirer », « Messages », « Prix à baisser »),
  plus d'ellipse CSS, un libellé long passe à la ligne. Chaque case est un
  `div.vrm-day-case[data-case]` qui contient le bouton `[data-tuile]` (data-* gardés,
  plus `data-presses`, `data-limite-heure`, `data-a-verifier`) et son geste.
- **Envoyer** : la case porte une sous-ligne « dont N aujourd'hui » (ambre ; « dont N
  demain » en neutre) quand les colis pressés ne sont PAS en retard, et le bouton
  secondaire **« Emballer »** (`data-job="emballer"`, même `DEMANDE_EMBALLAGE` que
  l'ancienne ligne ; « Emballer les N prêts » si tous ne le sont pas). Les lignes
  « N colis pressés » (non urgente) et « Emballer les colis prêts » ne sont plus
  dans « À faire » tant qu'une case « À envoyer » se voit (barre ou petite case). Un
  colis EN RETARD reste une alerte de tête (Urgent, jamais retirable) et la case se
  tait alors sur les pressés. Sans case, les deux lignes reviennent (rien d'injoignable).
- **Retirer** : « + N à vérifier » (ambre) sous « À retirer » — **« + » et pas
  « dont »** (demandé « dont 4 à vérifier ») : ces colis ne sont PAS comptés dans
  « à retirer » (règle du 23 oct.), « dont » aurait été faux (§5). « À vérifier » et
  « en cours de vérification » tiennent en UNE ligne : « Colis à vérifier » + « 2
  délais dépassés · 2 pas encore reliés » (+ « N incidents » quand le transporteur
  signale un problème) ; `data-job="retrait-a-verifier"` (`data-n` = délais dépassés,
  `data-n-relier` = achats pas encore reliés), ou `retrait-en-verification` s'il n'y a
  qu'eux. Sans case « À retirer », le titre reprend le nombre (« 4 colis à vérifier »).
- **Lignes d'« À faire »** : titre et détail sur UNE ligne chacun, téléphone compris
  (`UneLigne lignesTel={1}` pour le détail ; un titre peut encore passer à deux
  lignes à 320 px). La phrase longue va dans l'infobulle et le nom du bouton
  (`plein`). URSSAF : « Déclarer l'URSSAF d'octobre » + « Avant le 30 nov. · ≈ 331 € à
  payer (au moins) » (« Dans 3 jours · … » quand l'échéance est proche) ; le reçu de
  la période n'est plus redit ici (écran URSSAF) — `urssafCourt`, mêmes valeurs que
  `rappelUrssaf`, `data-urssaf-*` inchangés.
- **Stock actuel** : « 0 sur 6 avec un prix d'achat · 6 à compléter » écrivait 6 deux
  fois (le total est juste au-dessus) ⇒ « Aucune avec un prix d'achat · Compléter › »,
  « N avec un prix d'achat · M à compléter › », « Toutes avec un prix d'achat ».

**Banc `journee-mieux`** (jeu au 2 novembre, rythme URSSAF mensuel, quantités toutes
différentes : 3 choses, 4 à envoyer dont 1 aujourd'hui, 5 à retirer, 7 délais
dépassés + 1 pas relié = 8 à vérifier, 2 ventes, 6 en cours, 9 annonces) : I. aucun
libellé ni sous-ligne de case coupé à 320/375/390/430 (scrollWidth, « … », ellipse
CSS) ; J. aucun nombre de comptage ≥ 2 écrit deux fois (montants, %, dates, heures,
N°, tailles, « 30 j », « 7 derniers jours », semaine et dernières ventes à part) ;
K. pas de ligne « Emballer » ni « colis pressés » à côté de la case, une ligne « à
vérifier » au plus, « Emballer » joignable (≥ 44 px) dans la case, sous-lignes
présentes ; B. une ligne de détail au plus, téléphone compris. Sur `origin/main` :
67 rouges (I, J « 2, 4, 9 », K, B) ; après : 224 verts. Mutation (dédoublonnage
coupé + ellipse remise) : 5 rouges. `transporteurs.cjs` lit la ligne fusionnée
(`data-n-relier`, phrase dans l'infobulle). Planche AVANT/APRÈS 390 clair :
capture de session.

## 2 novembre — Visite en bulles, onglets nus, une phrase par écran

Julien : « une démo visuelle un peu comme Vinteer : des petits nuages qui montrent les
fonctionnalités quand tu crées ton compte, mais il ne doit pas y avoir des écritures
partout à côté des onglets ». Fait par un agent (branche `claude/demo-bulles`),
intégré sur `claude/demo-bulles-integ`.
- `src/visiteBulles.js` (la règle, sans React) + `src/VisiteBulles.jsx` : une bulle à la
  fois, posée sur l'onglet RÉEL (barre du bas / colonne), Suivant · Passer · points ;
  Échap, « Passer », un toucher dehors la ferment et la notent vue ; onglet absent ⇒
  bulle sautée (jamais dans le vide) ; focus gardé, `aria-live`, 44 px, mouvement réduit.
- Ouverte une fois, après Bienvenue, pour une personne neuve, quand le nuage est arrivé ;
  « vue » = `vrm_visite_vue` (SYNC_KEYS). Rejouable : Paramètres → Aide → « Revoir la visite ».
- Onglets nus : plus de `desc` sous les entrées de « Plus », plus de `title` explicatif
  dans la colonne.
- `src/phrasesEcran.js` : une phrase (≤ 10 mots, sans jargon) sous le titre de Journée,
  Annonces, Ventes, Colis, Messages, Paramètres.
- Banc `scripts/bancs/demo-bulles.cjs` (390 px tactile, 1512 px) : vert le 2 nov. dans
  un bac à sable Vercel (Chromium installé là). Les captures n'ont pas pu être regardées
  depuis la session (le proxy refuse l'adresse du bac à sable) : Julien la regarde.

## 2 nov. — tournée de tous les bancs

Demande de Julien : « continue à tout auditer ». Branche `claude/tournee-bancs`
(partie de `origin/main` à ea3c7ca4). Les bancs tournent dans des bacs à sable
Vercel (4 vCPU, 3 bancs à la fois) ; ici, ni vite ni les dépendances de l'app.

**Ce qui a tourné : 128 bancs sur 257** (lots 0 et 1, répartis en tourniquet sur
la liste triée). **94 verts, 34 rouges.** Les 129 autres (lots 2 et 3, dont
`tous-boutons`) n'ont PAS tourné : le quota Sandbox du plan Hobby est épuisé
(« Hobby plan usage limit exceeded », remis à zéro le 1er déc.) — geste de Julien
s'il veut la suite avant (passer le projet en Pro, ou attendre). Aucune
classification « rouge avant tel commit » n'a pu être faite pour la même raison.

### Rouges corrigés : bancs périmés, revérifiés VERTS dans le bac
- `achats-hors-plateforme` — `main` s'écrit par PATCH conditionnel sur `data.rev`
  (« Données sûres », 1er nov.) et SEULEMENT sur une base cloisonnée : le banc ne
  gardait que les POST et sa sonde de schéma répondait « pas migrée ».
- `nuage`, `numeros-panne` — même cause (PATCH `id=eq.main`).
- `cartes-vivantes` — Vitrine (31 oct., son choix) a retiré l'élévation au
  survol et l'entrée en cascade : on juge que la carte d'accueil publique
  RÉPOND (fond), et que dans l'app rien ne se soulève ni n'entre en cascade
  (réafficher la cascade ⇒ rouge).
- `compta-simple` — « Paramètres » partout (1er nov.).
- `audit-reel-20oct`, `fluidite`, `ebay-annonces`, `pave-vinted` — navigation par
  tâche (31 oct.) : lien profond `?tab=plat_…&section=…`, Achats =
  `?tab=cat_achats&vue=achats`.

### Corrigés mais PAS revérifiés (quota épuisé avant la relance)
`ebay-comptes` (aide `sousOnglet` reprise d'`ebay-regle-offre`), `feuilles-coque`
(sections Vinted par lien profond), `panne` (mode d'emploi Supabase réservé au
propriétaire depuis le 1er nov. : jugé pour lui, et l'autre sens ajouté pour un
autre vendeur ; écran Achats ajouté), `photos-vinted` (Achats par `vrm:aller`),
`verif_visuel` (Vestiaire dit « pas encore de vente finalisée » depuis E0c).
`reglages` : à moitié — les panneaux sont des sous-écrans (1er nov.), le banc les
ouvre et lit leur texte, mais il reste 6 rouges (le bloc « réglages pas lus »
n'apparaît plus) : à sonder, la cause n'est pas trouvée.

### Rouges NON corrigés
- Domaine colis (branche `claude/colis-clair`, pas touchés) : `colis-fiables`,
  `emballage` (attend Geist Mono, police système depuis le style Apple),
  `postes`, `retrait-carte`, `transporteurs`, `suivi-colis`, `vendeur-neuf`,
  `oublies` (`cat_achats` mène à Colis → À retirer), et `panne` sur `cat_achats`
  (Colis → À retirer dit la panne deux fois).
- Environnement : `capacites` (exige `fx/`), `pont` (exige l'historique git, le
  bac clone en profondeur 1).
- À examiner (défaut possible de l'app, non tranché) : `vitesse` (lectures au-dessus
  du plafond : Ma journée 70 > 62 à 390 px, Achats 97 > 78, brouillons eBay lus sur
  Ma journée, famille des transactions balayée 3 fois) ; `verif_dark` (rail plus
  clair que la page en sombre : 0,8855 vs 0,0044) ; `mobile` (320 px, Ma journée :
  `main` passe sous la barre du bas) ; `recherche-en-place` (1512 : « / » remet la
  page en haut, 120 → 0) ; `journee-mieux` (titres sur 2 lignes au téléphone) ;
  `lbc-pause` (Ma journée : « 1 à retirer de Leboncoin » sans « N°18 » sur la
  même ligne) ; `imprimante` (aperçus Chronopost, lecteur PDF injoignable) ;
  `annonces-carte` (390 : le bouton « Annonces » de la barre introuvable après
  Stock ; 1512 : deux fiches décalées de 6 px, une fois sur deux).
- Décision de Julien contre le banc : `finition-premium` — Envoyer en bleu Apple
  sombre `#0A84FF` sous une icône blanche = contraste 3,65, le banc exige 4,5
  (la norme pour une icône seule est 3). À lui de dire.

## 2 novembre (nuit) — Le parcours d'un nouveau vendeur, et la carte qui ne bouge plus

Julien : « mets-toi à la place d'une personne qui crée son compte […] les points relais bougent un tout
petit peu dès qu'on bouge la caméra : pour moi c'est important ».
- **Carte** : deux causes, toutes deux nécessaires — une `transition: transform .12s` sur tous les boutons
  (`src/styles-mouvement.css`) faisait traîner l'épingle (un bouton que MapLibre déplace à chaque image) ;
  et l'arrondi au pixel de MapLibre à l'arrêt (0,5 px CSS). Corrigé : aucune transition sur
  `.maplibregl-marker`, `subpixelPositioning: true` (`CarteRelais.jsx`, `communaute/Communaute.jsx`).
  Écart mesuré image par image : 0,33 à 1,71 px avant, 0,00 px après. Banc `carte-stable` (13 rouges sur
  l'avant ; mutations : une seule des deux corrections laisse du rouge).
- **Nouveau vendeur** (banc `nouveau-vendeur`, compte vide puis petit jeu inventé, 390/1512, clair/sombre,
  aucune écriture en base) : 13 défauts corrigés — « 0 € au moins » / « au moins 0,00 € » remplacés par
  « — », fautes et majuscules, puces orphelines, cibles de 40 px, carte collée au sélecteur, « 0 à relire »
  sans compte, emoji, décalages d'Annonces, impasse « ouvre Ventes » sans compte (maintenant « Relier mon
  compte »), « Marquer imprimé » sur deux lignes.
- À trancher par Julien : Vestiaire visible pour qui ne l'utilise pas ; « Vérifications » sans compte
  Vinted ; chiffres d'un vendeur sans Vinted. Relevés non corrigés : onglets de Stock coupés à 390 px,
  barres de mois de 25 px, traits d'union insécables espacés (police du banc ?).

### 2 nov. (soir) — E-mails et Statistiques plus clairs (branche `claude/emails-stats`)
Julien, 20 h 41 : « beaucoup d'incompréhension quand je vais dans les emails ou dans les
statistiques […] ça doit être beaucoup plus intuitif ». Présentation, mots, ordre et
regroupement seulement : **aucune règle ne change** (mêmes routes `reception`/`liste`/`preuves`/
`journal`, `etatCollecteur`, `resumeReceptionComptes`, mêmes sources des chiffres).
- **E-mails** (Paramètres → « E-mails », ex-« Réception des emails ») : onglets NUS Aperçu · E-mails ·
  Adresses · À rattacher (plus de nombre ni d'explication ; le nom accessible garde l'ancien mot).
  L'**Aperçu** (`src/emailsApercu.js`, `ApercuEmails` dans `src/ReceptionEmails.jsx`) répond dans
  l'ordre : « Oui, tes e-mails arrivent dans VRM » / « à vérifier » / « pas pu lire » + le dernier
  arrivé ; « À faire » (une ligne par cause et SON geste en ambre : mis de côté, à vérifier, adresse
  à confirmer ou sans compte, aucune adresse) ou « Rien à faire » seulement si tout a été LU ;
  « Ce que VRM en a fait » (rangés par famille, une ligne ouvre le journal filtré sur ce type) ;
  « Par adresse » (dès 2 adresses). L'ancienne liste (recherche, filtre par adresse) est repliée
  sous « Chercher un e-mail précis » ; ses compteurs par état, son bandeau « Service de réception »
  et l'aide en double sont retirés ; la synthèse par adresse a quitté l'onglet Adresses. Mots :
  « Intégré » → « Rangé », « À réessayer » → « En attente », plus de « collecteur »/« suivis ».
  Journal : titre « Tes e-mails, un par un », couverture sans recompter les états (ils sont sur les
  filtres). « À rattacher » : « Réessayer cet e-mail » au singulier.
- **Statistiques** : tuiles en phrases (« +213 % par rapport à septembre », « il manque le prix
  d'achat des autres », « Temps pour vendre : la moitié de tes paires partent plus vite »),
  « Quel compte vend le mieux » (phrase sans chiffre, avant le graphique au téléphone), « Les modèles
  qui partent vite », « Les tailles qui se vendent », semaines dites par leur lundi (« 26/10 », plus
  « s44 »). Tout le reste est rangé en **deux volets repliés** (`RepliStats`) : « L'argent depuis le
  début » et « Ce qui se vend, ton rythme, le stock qui dort » — montés seulement ouverts, état gardé
  sur l'appareil (`vrm_stats_replis`, commodité). Le montant vendu de la période n'est plus écrit
  3 fois. « × moyen » → « Multiplicateur moyen (vente ÷ achat) », « Détails » → « Moyennes ».
- Preuves : banc `emails-stats-clairs` (390 tactile clair + 1512 sombre, 53 verts ; **17 rouges sur
  origin/main** ; mutation « tout compter comme rangé » ⇒ rouge). Remis à la nouvelle présentation,
  en le disant dans le banc : `reception-emails` (ouvre la liste repliée ; les compteurs par état
  sont jugés sur l'Aperçu), `stats-detail`, `stats-premium`, `stats-compta` (ouvrent les volets),
  `stats-vitrine` (semaines datées), `scripts/tests/espace-emails-interface.cjs` (liste attachée
  mais repliée ; bouchons manquants `useStateCle`… — il échouait déjà sur `main`).
- À trancher par Julien : retirer la liste technique repliée (doublon du journal, mais seule
  recherche plein texte) ; les deux « Boost rentable ? » (période en haut, tout le temps dans le
  volet) ; « Articles ajoutés par jour » et les deux courbes mensuelles du volet « argent ».

## 2 nov. (nuit) — Le style « Fusion » (branche `claude/design-fusion`)

Julien a choisi « Fusion » sur les maquettes (FusionJournee, FusionVentes, FusionColis,
FusionCompta) : « j'aime la barre de progression pour le suivi », « la première photo avec
les stats novembre », puis « sans trop de couleur non plus, ça doit être premium ». Base
neutre (fond #f2f2f7, cartes blanches rayon 20, ombre très douce), UNE carte sombre par
écran (dégradé #1f3a5f → #1d1d1f), le bleu d'Apple seulement pour le bouton principal et
les segments franchis, l'ambre seulement pour un geste urgent.

**Composants partagés** (`src/design/`) :
- `CarteMois.jsx` — la carte sombre : surtitre, UN grand chiffre (« — » si `null`), sous-ligne,
  cases translucides, courbe monotone (`courbeMonotone.js`) quand c'est une tendance. Elle
  n'invente rien : chaque valeur lui est passée par l'écran, qui la tient de SA règle.
- `Frise.jsx` + `friseFusion.js` — la frise à 4 segments. AUCUNE règle neuve : pour une vente,
  projection des cinq étapes de `friseVente` (src/recapVente.js) en Vendue · Postée
  (= Déposée) · Livrée · Payée (= Argent reçu) ; pour un colis, Imprimé · Déposé · En route ·
  Livré avec la même loi (faite si SA preuve est lue ou si une étape plus loin l'est ; « pas
  su » jamais coché). Chaque segment porte `data-fu-etape`, `data-fait`, `data-preuve`,
  `data-cours`.
- `fusion.css` — jetons (`--fu-*`, clair et sombre CHOISI), chargée en tout dernier.

**Ma journée** : la tête devient la carte sombre (date, bonjour, la semaine avec un point sous
un jour qui a vendu, « Vendu aujourd'hui » = `bilanVentes` et le bénéfice du mois =
`BeneficeJournee` sur `vrm_benefice_jours`). Le bénéfice n'est plus redit dans « Vendu en … »
ni en carte de secours (§7). « À faire » en cartes : pastille chiffrée NEUTRE (encre ; ambre
pâle seulement si urgent), le geste en pilule. Les cases du jour en cartes blanches.

**Ventes** : carte du mois (vendu du mois toutes plateformes = `bilanVentes` sur `vendus`,
« au moins » si un compte n'est pas lu ; courbe = cumul jour par jour ; cases « à poster »
= `aExpedier` pas encore déposée, « en route » / « argent à venir » = la frise de chaque
vente). Les preuves de la frise sont lues UNE fois (`preuvesFriseDe`, au niveau de
l'écran) pour le tiroir (cinq étapes), la ligne (quatre segments) et la carte.

**Colis** : carte « Aujourd'hui » (`vrm_colis_aposter`, `lignesLot`, `gestesDepuis(shipDone)`,
`vrm_colis_retirer` — aucun nombre recalculé), frise par colis, cartes blanches.

**La puce transporteur** (Julien, 21 h 36, « laide ») : `PastilleTransporteur` (non `seul`)
devient une puce de 44 px, fond #f2f2f7 (sombre #2c2c2e), rayon 12, tuile du logo 20 px
(rayon 5, blanche), nom 13 px 600 ; « Transporteur pas lu » = même puce sans tuile, en gris.
Elle vit dans `.vrm-rangee-bord`, À GAUCHE du bouton bordereau, même rangée, jamais à la
ligne : le libellé passe de « Imprimer le bordereau » à « Imprimer » par une requête de
conteneur sur le bouton (≤ 236 px). Partout : Colis (Vinted, Vestiaire, en lignes sur
ordinateur), ligne de vente, récapitulatif (Vinted et Vestiaire), Leboncoin, achats.

**Compta** (structure « trois questions » de `claude/compta-simple`, gardée) : la carte de
« Combien j'ai gagné ? » devient la carte sombre (CSS seulement) ; dessous, `ComptaFusion` :
l'anneau (parts EN %, jamais un montant redit) seulement quand le net du mois se calcule,
et les six derniers mois en barres (bénéfice sur les ventes, `beneficeDesJours`, montant en
infobulle, « pas su » en pointillé). `compta-claire` 98/98.

**Preuves** : banc `scripts/bancs/design-fusion.cjs` (Ma journée, Ventes, Colis, Compta ×
390/1512 × clair/sombre) : frise = prouvé seulement (mutation `FUSION_MUTATION=1` ⇒ rouge),
rangée puce + bordereau (même ligne, 44 px, rayon 12, une ligne), débordement, violet,
« encaissé », erreurs. Bancs voisins : `recap-vente`, `compta-claire`, `vestiaire-parite`.
Revue de contraste (ui-ux-pro-max §1) : aucun texte gris sous 4,5:1.

**Reste** : la frise sur les lignes Leboncoin, eBay et Vestiaire (il leur faut leurs preuves
propres, pas de règle à inventer) ; Annonces, Achats, Messages, Paramètres dans le même esprit.

### 2 nov., 22 h — « recopie à l'identique, sans textes explicatifs » (Julien)

Julien : « j'aime beaucoup la Fusion carte sombre mais le problème c'est que tu ne recopies pas
à l'identique et que tout le temps tu ajoutes des textes explicatifs partout, ce qui est
horrible ». Les quatre écrans suivent maintenant les maquettes (valeurs relevées dans les
`.dc.html`), comparées côte à côte à 390 × 844 (`compare-*.png`) :

- **Ma journée** : la tête sombre bord à bord (rayon 30 en bas), « Bonsoir … » puis « Ma
  journée » 34/800, les sept derniers jours (aujourd'hui à droite, cercle blanc), « Vendu
  aujourd'hui » et « Bénéfice du mois » (`BeneficeJournee fusion`). Puis « À faire · N gestes » :
  une carte par geste — les cases du jour (Colis à poster / à retirer, Messages, Prix à baisser,
  mêmes compteurs, mêmes `data-tuile`), les alertes, le rappel URSSAF ; pastille 42 px encre
  (ambre si pressé), pilule d'action bleue. **La grille des widgets (Vendu du mois, semaine,
  attente, dernières ventes, stock, tendances) n'est plus rendue** : drapeau
  `JOURNEE_AVEC_WIDGETS = false` (src/App.jsx), un mot pour la remettre. Les bancs de ces
  widgets (`journee-chiffres`, `journee-mieux`, `journee-premium`, `journee-widgets`,
  `vendu-recu`, une partie de `chiffres-croises` et `benefice-journee`) sont rouges tant que
  le drapeau est éteint : à trancher.
- **Ventes** : la date au-dessus du titre, plus de phrase, ni « Chiffres », ni « À faire
  aujourd'hui », ni recherche, ni période, ni raison commune ; la carte du mois (« N ventes ·
  bénéfice X € » quand le net se calcule ; cases à poster · en route · à payer, qui filtrent la
  liste d'un toucher) ; chaque vente a la forme de la maquette (`LigneVenteCompacte fusion`) —
  les filtres et « Outils » restent (des boutons).
- **Colis** : la date et le titre, la carte « Aujourd'hui », « J'envoie · N / Je reçois · N »,
  les colis **rangés par transporteur** (en-tête : tuile du logo, nom, « N colis »), le bouton
  rond en haut à droite = le bouton bordereau lui-même ; ni « Emballer », ni « Tout générer »,
  ni imprimante, ni intertitres, ni aide. La carte Vestiaire garde sa rangée puce + bordereau.
- **Compta** : « Novembre 2026 » / « Compta » ; la carte sombre « Ce que tu as gagné » (une
  ligne courte, trois cases : à déclarer · URSSAF · ventes) ; l'anneau (parts en %) ; les six
  mois (mois courant en bleu) ; l'encart ambre « Déclaration URSSAF » + « J'ai déclaré »
  (`rappelUrssaf`). Les intitulés des trois questions, la carte URSSAF du mois et le détail du
  calcul ne s'affichent plus ; « Le détail » (replis) reste dessous.
- Phrases d'écran retirées pour journee/ventes/colis (`src/phrasesEcran.js`).
- Bancs mis à jour (note « retiré à la demande de Julien, 2 nov. 22 h ») : `compta-claire`,
  `demo-bulles`, `design-fusion`.

### 2-3 nov. — Revue du coordinateur, cas extrêmes, Ma journée sur ordinateur (`claude/design-fusion`)

**Revue (6 points)** : aucune fonction perdue — recherche et période dans le menu
« Outils » de Ventes ; Factures dans « Documents et réglages » ; « Déclaration URSSAF »
en lien sur l'encart de Compta ; sur chaque carte Colis, « … » ouvre « Marquer imprimé /
Suivre / Colis fait » ; « … » de l'en-tête Colis ouvre Emballer, Tout générer, imprimante.
Relier / Poser N° en pilule seulement quand il le faut. Ventes « à expédier » : puce
transporteur + Imprimer (ou Générer) sur une rangée, « Déposé » après ; titre court + taille
sur la ligne N°/site. « Vendus ailleurs » en carte À faire.

**Publications vérifiées** (retrait de la grille de Ma journée, `JOURNEE_AVEC_WIDGETS =
false`) : `vrm_benefice_jours` et `vinted_urssaf_mois` sont écrites par les effets de
Comptabilité, `widget_stats` par la coque — aucune ne vivait dans la grille.

**Bancs Ma journée réalignés** (journee-chiffres, benefice-journee, chiffres-croises,
journee-mieux, vendu-recu, journee-premium, journee-widgets, demo-bulles) : l'affichage
retiré est noté « retiré à la demande de Julien, 2 nov. 22 h » ; les CHIFFRES restent jugés
(vendu du jour sur la tête, vendu du mois sur la carte de Ventes, bénéfice = Comptabilité,
reçu et cotisations sur Compta).
⚠️ `chiffres-croises` garde UN rouge, **déjà rouge sur `main`** (mesuré sur
`git archive origin/main`, banc de main) : Statistiques (`data-dash-stat="caMois"`) ne pose
pas de montant dans ce jeu de données (`liveStatsVus.caMois` = null) alors que Ventes et
Comptabilité disent 228,30 €. Hors du chantier de style — à regarder à part.

**Cas extrêmes** (Julien, 3 nov. : « tout doit être parfait, regarde tous les cas de figure
du monde ») : `design-fusion` prend `FUSION_JEU` = base · vide (0 vente) · une · deux-cents
· longs (titres de 120 caractères) · gros (montants à 5 chiffres) · passu (ventes,
transactions et bordereaux en 503). Sur chaque jeu, 4 écrans × 390/1512 × clair/sombre :
pas de débordement, gestes 44 px, jamais « encaissé », pas de violet, **aucun montant
rogné**, et en « passu » aucune carte ne dit « 0 € ». Corrigé en route :
- « 35 211,9… » sur la carte du mois : `CarteMois` réduit la taille du grand chiffre pixel
  par pixel jusqu'à ce qu'il tienne (plancher 22 px), mesuré, recalculé au redimensionnement ;
- « Vérifications » sous la liste des ventes (4 composants, 3 retraits, 3 hauteurs de
  chevron) : une liste groupée façon Réglages ; « 1 comptes » → « 1 compte » ;
- « Outils » de Ventes : la pilule des filtres voisins (était un carré gris décalé) ;
- bénéfice du mois sur une partie des ventes : plus de « ≥ » (une vente au prix d'achat
  inconnu peut être à perte, ce n'est pas un plancher) — « Bénéfice brut du mois » et la
  couverture « · 1 sur 3 » à côté ;
- sombre : la page était #0e0e0d entourée de bandes #000 (règle Vitrine plus forte) — un
  seul fond.

**Ma journée sur ordinateur** (Julien, 3 nov. 07 h 47, capture : « j'aime pas trop cet
endroit » — ligne coupée sous la barre collée, bloc Urgent + 4 tuiles vides + longue liste,
« paires », jargon) : la maquette FusionJournee à 720 px, centrée ; pas de bloc Urgent ni
de tuiles (l'urgent = pastille ambre dans la liste) ; mots courts par
`src/design/tacheCourte.js` (« 2 annonces à retirer de Leboncoin · N°18, N°23 · vendus sur
Vinted », « Vente Vestiaire à envoyer », « 5 articles pour eBay », « 3 e-mails à trier »,
« paire(s) » → « article(s) ») — la phrase entière reste dans l'infobulle et le nom du
bouton, aucun compteur ni cible ne change (`scripts/audit-journee-court.cjs`, 47 contrôles,
rouge sur main et par mutation). La barre de recherche collée prend le fond de la page,
voilée et floutée, avec un filet : le texte qui défile dessous n'est plus tranché sur une
bande blanche (partout sur ordinateur). Banc : `design-fusion` vérifie à 1512 clair et
sombre une colonne ≤ 760 px centrée, aucune tuile ni bloc Urgent, jamais « paire », la
barre au fond de la page.
⚠️ Le jeu du banc ne fabrique pas encore les sources de la capture de Julien (Leboncoin à
retirer, Vestiaire, agent eBay, e-mails mis de côté) : la forme courte est prouvée par
l'audit, la mise en page par le banc avec les gestes du jeu de base.

### 3 nov. — Critique complète (coordinateur), points traités sur les 4 écrans Fusion

Rapport : `scratchpad/critique/RAPPORT.md` (hors dépôt). Traités ici :
- **#2** Téléphone : sur Ma journée, Ventes, Colis et Compta, la barre du haut ne redit plus le
  titre (ni tuile logo, ni titre centré) ; icônes seules, sur le fond de l'écran (le noir de la
  tête sur Ma journée). **« Compta » partout** (colonne, menu Plus, titre) ; `tous-boutons`,
  `compta-simple`, `menu-range`, `mobile`, `revendeurs`, `annonces-ventes-brouillon` suivent.
- **#3** Leboncoin et eBay : `KpiVentes` rend la carte sombre (`CarteMois`) avec les MÊMES valeurs
  et attributs (`data-kpi`), « — » quand ce n'est pas lu ; les ventes Leboncoin portent la frise
  (`friseVenteLue` : « Postée » = expédiée, « Livrée »/« Payée » = finalisée, lu par l'extension).
  Reste : la frise sur les lignes eBay et Vestiaire (statuts à projeter un par un).
- **#5** Une carte de vente = deux commandes (puce + bordereau) ; « Prix d'achat », « Relier un
  achat », « Déposé », « sur Vinted » derrière « … » (comme Colis) ; l'état sous le titre ne redit
  plus la frise (seule l'urgence « À expédier ») ; transporteur pas lu ⇒ pas de puce, le bouton
  prend la rangée.
- **#6** Le récapitulatif porte LA frise de la ligne (`RecapFrise` → `Frise.jsx`, 4 étapes, mêmes
  mots) ; « Bordereau reçu le … » devient une ligne de détail. `recap-vente` relit les 4 segments
  sous les noms de `friseVente` (même règle jugée).
- **#10** Sombre : fond #000 (la règle Vitrine `:root[data-theme=dark] .vrm-main` gagnait), cartes
  #1C1C1E, filet clair autour des cartes sombres, pastilles #3A3A3C (plus de carré blanc pur).
- **#11** Ma journée : pastilles 42/13/800 17 — ambre = dû aujourd'hui, encre, gris #c7c7cc pour
  « à saisir » ; le titre ne redit plus le nombre de la pastille (`titreSansNombre`, audité) ;
  URSSAF au même gabarit (« Noter » en pilule, la phrase en infobulle) ; « Vendus ailleurs » 600.
- **#12** Courbe : rien sous 3 points (2 points faisaient un trait plat sur un bloc).
- **#13** Ordinateur : les 4 écrans dans une colonne de 760 px centrée ; plus d'en-têtes de
  colonnes sur Ventes ; étiquettes 13 px, frise 12 px (11 au téléphone).
- **#15** (Colis seulement) le groupe « Transporteur pas lu » s'appelle « Autres ».

Non faits ici (annoncés pour le chantier suivant) : palette globale (#1), phrases des autres
écrans (#4), pastilles de site (#8), échelle typographique globale (#9), autres écrans.

**Fin du 3 nov. (fusion de main « bénéfice unique » comprise)** : la tête de Ma journée, la carte
Compta et la ligne de Ventes suivent `chiffreBenefice` (« — » si pas su ; « Bénéfice brut du mois »
retiré) ; les barres des 6 mois de Compta disent « bénéfice brut ». Trouvé en route : au téléphone, le
menu « Outils » de Ventes (recherche, période) tombait sous la règle qui range la barre — corrigé.
Rouges connus, **déjà rouges sur `main`** (mesurés sur `git archive origin/main`) : `chiffres-croises`
(1) et `vendu-recu` (10) — Statistiques ne pose pas son montant du mois dans ces jeux ;
`demo-bulles` (boutons de la visite à 43 px) ; `mobile` (s'arrête plus loin sur main, au menu Colis).
Restent rouges ici : `mobile` à l'étape « 7 jours » de la période dans « Outils », `compta-simple` E
(saisie de dépense pendant que le nuage est retenu, 2), `annonces-ventes-brouillon` (16 rouges sur main,
quelques-uns de plus ici, écrans Annonces/Messages surtout).

### 3 nov. — « À faire » en photos, Colis en trois onglets, « À retirer » propre (`claude/journee-photos`)

Julien (09 h 49, capture de Ma journée) : « les couleurs… j'aime pas trop ; il faut que ce soit les PHOTOS en
tout petit — s'il y en a plusieurs, des photos SUPERPOSÉES » ; « je veux des colis ENVOYÉS, et dans un autre
onglet ; Vestiaire : tout va être ensemble » ; puis (10 h 19 / 10 h 23 / 10 h 27) sur Colis → À retirer :
« beaucoup trop brouillon », « tout doit être parfait », « sélectionner une ville ».

- **Ma journée** : la pastille chiffrée colorée devient une vignette (`src/design/PileVignettes.jsx`, 44 px,
  rayon 10) ; plusieurs articles ⇒ pile de 2-3 décalées + « +k » neutre ; sans photo, tuile neutre + icône.
  Les photos sont posées par l'écran, PAR IDENTITÉ (`photosCase` : la vente/achat/conversation/annonce
  elle-même, `cmdParColis` pour un colis d'e-mail, txId Leboncoin, vente Vestiaire ; jobs : `photos` des
  mêmes listes ; « à retirer de Leboncoin » : l'annonce `lbcId`, sinon la fiche N° de l'annonce Vinted). Le
  titre reprend le nombre (« 5 colis à poster ») ; urgence = sous-ligne ambre ou point ambre ; un seul fond de
  carte ; pilules neutres, bleu seulement sur « Imprimer » ; « Vendus ailleurs » au même gabarit. La carte
  « Vente Vestiaire à envoyer » n'est plus redite (déjà dans « N colis à poster »). `titreSansNombre` reste
  exporté mais n'est plus appelé (audit-journee-court §6 à réaligner si besoin).
- **Colis** : « À envoyer · N / Envoyés · N / À retirer · N ». À envoyer : Vinted, Vestiaire (`CarteColisVc`,
  même rond, « … », frise), eBay et Leboncoin (`CarteColisSite`) dans UNE liste rangée par transporteur ; plus
  de bloc eBay ni « Ventes Vestiaire à envoyer » séparé. Envoyés (`listeEnvoyes`) : l'ancien « Partis » (Vinted,
  45 j) + cochés « Colis fait » + Vestiaire faits + Leboncoin en livraison, frise ne cochant que le prouvé ;
  attributs `data-colis-partis`/`data-parti`/`data-annuler-poste` gardés. eBay expédiés : pas de liste lue.
- **À retirer** (`ColonneRetirer fusion`, src/CarteRelais.jsx) : carte sombre « N colis à retirer » (dernier
  jour · avec code · à vérifier) ; puces « N en route » (liste au toucher, `groupesRelais.sansRelais`) et
  « N comptes à relire » ; sélecteur de ville (CP + ville LUS dans l'adresse, `villesDesPoints`, choix mémorisé
  `vrm_retirer_ville`, la carte sombre suit) ; une carte par point, une ligne par colis (vignette, titre,
  échéance en puce : « dernier jour » ambre / « jusqu'au jj/mm » / rien si inconnue, « Code » ou « Code à
  venir », « J'ai retiré ») ; détail au toucher ; « Lieu à confirmer » gris à la fin ; « À vérifier · N » replié,
  statut en puce (« Fin d'instance » ⇒ « Retour à l'expéditeur ? ») ; repartis = « Remboursement à vérifier ·
  19,64 € » + « Ouvrir » ; plus de bandeaux (fraîcheur, achats relus, suivi Vinted, réception e-mails) ;
  « Suivre un colis par son n° » dans le « … » de Colis ; attribution de carte en tout petit DANS la carte.
- **Preuves** : bancs `journee-photos` (Ma journée + Colis, jeux base · zero · un · trente · sansphoto, mutation
  `JP_MUTATION=titre` ⇒ rouge, rouge sur origin/main) et `colis-retirer-propre` (le cas de Julien inventé, jeux
  base · zero · un · neuf · trente, rouge sur origin/main 14/25).
### 3 nov. — La carte sombre réglable PAR PAGE (branche `claude/carte-stats`)

Julien, 3 nov. 09 h 54 : « je veux l'onglet avec les statistiques, mais qu'il soit réglable sur
chaque page comme il est déjà là, mais modifiable en fonction de ce qu'on a sélectionné » ;
« je veux juste le CA, le bénéfice etc. dans cette case sombre sur chaque onglet ».

**Fait** :
- `src/design/carteChiffres.js` (pur) : le CATALOGUE (CA vendu, nombre de ventes, panier moyen 30 j,
  reçu, bénéfice, bénéfice brut, à déclarer, URSSAF, ventes finalisées, à poster, à retirer, argent en
  attente, disponible, annonces en ligne, qui dorment), ce que chacun SUIT (site, compte, période), le
  DÉFAUT de chaque page (maquettes Fusion), le réglage rangé `vrm_carte_stats` (`{v:1, pages:{page:{g,c}}}`,
  synchronisé dans `main`, rattrapé par `onCloudReady`), le PÉRIMÈTRE (« Novembre · Vinted · Bruno »),
  et `valeursCarte` : chaque valeur TIRÉE DE SA RÈGLE, passée par l'app (`REGLES_CARTE`) —
  `bilanLignes` (sortie de `bilanVentes` de Ventes, la même fonction) sur les lignes de `ventesFaites`
  de la coque (`liveStatsVus.venduLignes`), `rythmeVendu` (panier), `beneficeDe` (sortie de
  `useBeneficeCalcul` : la lecture de Compta) + `chiffreBenefice`/`chiffreBrut`, `beneficeDesJours`,
  les publications `vrm_colis_aposter` (par site), `vrm_colis_retirer`, `vinted_urssaf_mois` (le reçu,
  lu comme le widget `recuDuMoisPublie`), `vrm_paires_dorment`, le porte-monnaie et les annonces de
  liveStats. Trois états : `null` = « — » ; `partiel` = « au moins » + manque NOMMÉ (jamais « au moins
  0 ») ; `hors` = pas de sens pour la sélection (bénéfice, URSSAF, reçu par site ; un compte Vinted sur
  eBay) ⇒ « — » et pas proposé dans la feuille.
- `src/design/CarteStats.jsx` : la carte (`CarteMois`, + `action`, `nu`, `grandAttrs`), « Modifier »
  (44 px, en haut à droite) ⇒ feuille en portail (`FermeAuRetour`) : 4 places (grand, cases 1-3), la
  liste des chiffres proposés avec leur valeur, la période du chiffre quand la page n'a pas de filtre
  de période, « Par défaut », « OK ». Chaque choix est rangé tout de suite. Le même chiffre à la même
  période n'est jamais deux fois sur la carte (échange des places).
- Branchement (App.jsx, `CarteStatsApp`, contexte `LiveStatsCarte`) : Ma journée (dans la tête, nue :
  vendu aujourd'hui · bénéfice du mois · vendu du mois · reçu du mois), Ventes Vinted (vendu du mois
  Vinted · à poster · en route · à payer ; la plage du calendrier « Outils » l'emporte), Ventes tous les
  sites, Leboncoin et eBay (`KpiVentes` : ses trois cases deviennent les cases PROPRES de la page,
  mêmes `data-kpi` ; périmètre « Depuis le début »), Vestiaire, Colis (le site choisi en tête),
  Compta (dans la carte « Ce que tu as gagné », la période du segment l'emporte), Annonces et Achats
  (Vinted). La bande « CA finalisé · Disponible · En attente » de l'espace Vinted ne redit plus ces
  montants (§7) : ils se choisissent dans la carte. Attributs gardés sur LEUR chiffre :
  `data-fu-vendu-mois`, `data-fu-vendu-jour`, `data-journee-benef…`, `data-compta-chiffre="gagne"`.
- Statistiques : PAS de carte (l'écran EST les statistiques, ses tuiles et sa période ; une carte
  redirait ses nombres).

**Écarts dits** : « Vendu » de la carte de Ventes · Vinted est maintenant VINTED seul (avant : toutes
plateformes sous l'onglet Vinted) — c'est la sélection. Les bancs qui lisent `data-fu-vendu-mois` sur
un jeu multi-sites liront le vendu Vinted. Messages et Favoris ne sont pas au catalogue : aucune
source publiée hors de leur écran (trois règles de non-lus coexistent, un chiffre ici pourrait
contredire Messages).

**Preuves** : `scripts/audit-carte-chiffres.cjs` (203 contrôles : chaque chiffre × site × compte ×
période = la règle propriétaire ET le calcul à la main ; « — » sans source ; réglage ; branchement
lu dans le code). Mutations rouges : `site` 44, `recalc` 73, `zero` 3, `benef` 5, `recu` 1, `compte` 18,
`aumoins` 1. Sur `origin/main` : rouge (module et `bilanLignes`/`beneficeDe` absents). Banc
`scripts/bancs/carte-stats.cjs` (390 tactile clair/sombre, 1512) : Vinted 257 € → tous les sites 297 €
→ Leboncoin 40 €, périmètre qui suit, feuille (portail, 44 px, pas de bénéfice sur Vinted seul),
réglage gardé au rechargement, Colis au défaut.

### 3 nov. — Fusion sur TOUTE l'app (`claude/fusion-app`, critique #1, #2, #4, #7, #8, #9, #14, #15)

Julien a choisi « Fusion carte sombre » ; seuls quatre écrans la portaient (rapport de critique du
3 nov., hors dépôt). Ce chantier l'étend à toute l'app, SANS changer une règle (chiffres, identité,
numéros, e-mails) et sans ajouter un mot.

- **#1 Une palette** : `src/themeMineral.js` = les valeurs Fusion (fond #F2F2F7, cartes #FFF, encre
  #1D1D1F, gris #6E6E73 ; sombre #000/#1C1C1E/#2C2C2E). Accent du TEXTE #0066CC en clair (5,3:1 sur le
  fond gris ; #0071E3 reste l'aplat `--fu-bleu`), #409CFF en sombre avec texte NOIR dessus (le blanc sur
  #0A84FF tombait à 3,6:1). Deux passes de remplacement (gris chauds Vitrine, gris « pétrole », ambres
  #A15C00/#9A4A00/#C25400 → #B25000, anciens bleus) dans `src/` — sauf facture PDF, Stock 3D, Studio
  photo, carte des relais, logos des transporteurs. Bouton secondaire = remplissage d'iOS
  `rgba(118,118,128,.12)`, lisible sur blanc ET sur le gris.
- **#2 Un nom par écran** : au téléphone la barre du haut n'a plus ni logo ni titre centré, sur TOUS les
  écrans ; le grand titre reste partout (il était caché quand il « doublait » la barre) ; Stock et
  Communauté reçoivent un titre ; « Paramètres » est un titre 34/800.
- **#4 Textes** : phrases d'écran (Annonces, Messages, Paramètres) retirées (`src/phrasesEcran.js`) ;
  Vestiaire (Photoroom : coût/usages derrière « Coût et aide », « Mettre en vente » sans paragraphe),
  eBay (états vides = une ligne + « Relier eBay »), Statistiques (définitions retirées, manques gardés),
  Paramètres (2ᵉ ligne des réglages retirée, une alerte reste), Stock, Messages Vestiaire, Colis eBay,
  Leboncoin, Communauté, états vides « Aucun compte Vinted lié » + « Relier un compte ». Raisons
  d'extension raccourcies (« Depuis ton ordinateur », « Extension VRM pas détectée dans ce navigateur »).
- **#7** Annonces : « Offres automatiques » et « Annonces à compléter » dans « Outils » (…), astuce
  retirée, « Stock et ajustements » / « Publier aussi ailleurs » SOUS la grille, une rangée recherche ·
  tri · Republier (icône) · … ; Messages : ni « Chiffres », ni « À faire aujourd'hui », « Comptes
  Vinted » sous la liste.
- **#8** Le sélecteur de site = contrôle segmenté iOS (une rangée, 44 px, actif blanc / #636366 en
  sombre, « Tous » au lieu de « Tous les sites », nom complet en `aria-label`).
- **#9** `src/design/jetons.css` (chargé en dernier) : échelle fermée 11·12·13·15·17·20·22·28·34
  (+38/44), graisses 400–800, rayons 6·12·14·20·24·999, cartes blanches r20, segmentés, filtres,
  menus, colonne 760 px pour les écrans de lecture sur ordinateur (`data-ecran` sur `<main>`).
  `scripts/fusion-echelle.mjs` ramène les valeurs écrites sur l'échelle (`--verifier` en contrôle).
- **#14/#15** « paire » → « article » (Stock, Statistiques, eBay agent + notification, Republier,
  Vestiaire, Messages) ; « Transporteur inconnu », « Comptes Vinted · N à vérifier », « Données ·
  À vérifier », « N à vérifier sur Vinted », « Leboncoin (Leboncoin) » → « Leboncoin », « Pas lu »
  pour les lectures eBay ratées.
- **Finitions (coordinateur)** : « Modifier » de la tête de Ma journée en haut à droite (ligne du
  titre) ; cases de la carte en capitale initiale, « CA finalisé » → « Finalisé », libellé de case
  court (le détail en infobulle) ; plus de « Aucune vente finalisée ce mois-ci » sous la carte de Compta.
- **Laissés** : Messages → Favoris (chantier `claude/favoris-fusion`) ; Ma journée hors du bouton
  Modifier (autre chantier) ; textes réglementaires de Compta « Le détail » ; page publique ;
  « sans suivi Vinted relevé » de Colis → À retirer.

**Preuves** : banc `scripts/bancs/fusion-app.cjs` (F1 palette calculée ∈ jetons, F2 aucun texte de
l'inventaire, F3 un nom, F4 premier élément y < 300 — Annonces < 600 depuis la carte réglable —,
F5 cibles 44, F6 contraste, F7 débordement, F8 échelle, F9 segmenté, F10 erreurs ; 390 clair, 390
sombre, 1512) : **652 verts** ; rouge sur l'arbre d'avant et par mutation (`FUSION_MUTATION=1`,
jetons.css retiré : 21 rouges à 390 clair). Bancs suivis (note « retiré à la demande de Julien,
3 nov. ») : demo-bulles, photoroom-carte, vinted-ui, tout-generer, vendeur-neuf, transporteurs-logos,
ebay-agent, agent-ebay-push, audit-agent-ebay, brouillons-avancee, garage3d, vestiaire,
glisser-onglet, compta-claire, tests synchronisation-vinted.
**3 nov., après revue (13 h)** — fusion de main (carte sombre réglable `CarteStatsApp` gardée sur Colis/Ma journée ;
sur « À retirer » la carte dit les colis à retirer) ; « Bénéfice du mois 0 € » venait d'une base d'avant
`benefice-urssaf` : la fusion rend « — » (`chiffreBenefice`). **« À retirer » en SECTIONS** (Julien, 13 h 02 :
« tu dois mieux SÉPARER ») : « À retirer aujourd'hui » (jours ≤ 0, ambre discret) · « Prêts à retirer » (code ou
QR, par point) · « Code à venir » · « Lieu à confirmer » · « À vérifier » (replié) · « En route » (replié, à la fin)
· « Argent à vérifier » (repartis) ; 28 px d'air ; chaque colis une fois (`sectionDuColis`, priorité aujourd'hui >
prêts > code à venir > lieu > à vérifier) ; la carte (plan) au-dessus du sélecteur de ville. Titre d'une ligne :
l'achat relié par identité, sinon `artTitle` (« Ton achat t'attend… », `source:'vinted-commande'`), sinon le n°
court « n°…8456 ». Bancs réécrits pour la nouvelle mise en page (règles et compteurs gardés) : `colis-colonnes`,
`postes`, `poste-sans-depart`, `fluidite`, `vestiaire-parite`, `retrait-autre-ville`, `transporteurs-logos` ;
`audit-journee-court` §6 : le titre GARDE son nombre (`titreSansNombre` n'est plus appelé).
### LE CYCLE D'UN ARTICLE : « N°x SUPPRIMÉ DE VINTED », PROPOSITIONS eBAY/LEBONCOIN, RETRAIT eBAY APRÈS UNE VENTE AILLEURS (3 novembre, branche `claude/cycle-article`)
Julien, 3 nov. 9 h 40 : il craint « plein de cas où il peut y avoir une ambiguïté et des erreurs
avec les articles ». Décisions (rapportées par la session qui pilote) et ce qui est fait :
- **Mesuré (lecture seule, sa base)** : 505 fiches numérotées, **263 absentes** de tout dressing
  lu, dont **211 au N° d'archive (B…)** sans transaction rangée (vendues avant les captures) ;
  10 suppressions vues en 2xx par l'extension, **toutes faites par Republier** (coffre
  `versBrouillon`) ; **0** supprimée hors VRM sans vente aujourd'hui. Lectures : 47 annonces
  en ligne, 7 masquées, 8 comptes. Retrait eBay automatique : **ALLUMÉ**. Ventes Leboncoin :
  16, liste relue le **22 oct.** (périmée pour le retrait automatique, 48 h). Ventes Vestiaire : 1.
  ⇒ Une règle « absente et pas vendue ⇒ question » aurait posé ~230 questions fausses le premier
  matin : une absence ne compte que si VRM a **VU** l'annonce en ligne avant (registre synchronisé
  `vrm_vus_en_ligne`, tenu sur les lectures COMPLÈTES et fraîches, `majVusEnLigne`) ou si
  l'extension a vu la suppression (2xx). Le registre démarre vide : les suppressions passées ne
  sont jamais demandées.
- **1. Supprimé de Vinted sans preuve de vente** (`src/cycleArticle.js`, `etatCycle`, PUR) :
  vendu prouvé (toutes plateformes, par identité) AVANT « en ligne » (Vinted ne ferme pas
  toujours une annonce vendue) → en ligne / masquée / à confirmer → republié (même N°, même
  fichier photo, table de recréation, sur n'importe quel compte : le N° suit, aucune question) →
  retour remis en stock / retour en cours → « Toujours chez moi » → retiré par VRM (Republier,
  coffre `versBrouillon` : jamais de question) → lecture COMPLÈTE de moins de 24 h exigée → vu en
  ligne puis absent ⇒ **« à demander »**. Toute lecture ratée ⇒ « pas su », aucune carte.
  Sans réponse l'article reste **chez lui** (`chezLui`). Ma journée : une carte par article
  (`data-job="supprime-vinted"`, photo, « N°x supprimé de Vinted », titre de l'article, trois
  pilules 44 px **Toujours chez moi · Vendu en main propre · Je m'en sépare**, aucun texte
  explicatif). Calcul dans la coque (`setCycleCartes`) : d'abord sur les lectures en mémoire ;
  les lectures lourdes (preuves, recréations, coffre, ventes eBay/Leboncoin/Vestiaire) ne partent
  que s'il reste une question. Réponses (son clic seul) : `vrm_cycle_decisions[id]` ;
  « Vendu en main propre » demande le montant (`montantSaisi`, jamais deviné) et marque l'annonce
  « vendue à la main » (`vinted_annonces_vendues`, le mécanisme existant) ; « Je m'en sépare »
  confirme puis déclare l'article parti (`vinted_pairs_lost`, par identité, `cleDeclarationPartie`).
  ⚠️ **Le montant d'une vente en main propre N'ENTRE PAS dans le CA ni l'URSSAF** : aucune règle
  existante de vente manuelle chiffrée (mesuré : `ventesFaites`/`ventesDeclarables` ne lisent que
  Vinted, Leboncoin, eBay, Vestiaire) — il est gardé dans la décision, à brancher quand Julien
  aura dit comment il la déclare (c'est une recette).
- **2. Ce que VRM propose pour eBay / Leboncoin** (`src/propositionsSites.js`, corrigé par
  Julien à 9 h 45 : « je ne vois pas comment tu peux me proposer des paires en stock mais pas en
  ligne si je n'ai pas fait de photo sur Vinted ») : (a) EN LIGNE sur Vinted + (b) supprimé et
  « Toujours chez moi » (photos et fiche de sa dernière annonce lue). Exclus : déjà sur ce site,
  vendu, « Je m'en sépare », « Vendu en main propre », lecture incertaine ; sans photo ni fiche :
  jamais. Branché sur l'**agent eBay** (`propositionAgent` reçoit `chezMoi`) et la liste des
  paires eBay (`useEbayPaires` ajoute les « chez moi » depuis la fiche, `vinted_item_details`,
  le coffre). ⚠️ **Leboncoin (b) n'est PAS branché** : la file Leboncoin est calculée par
  l'extension (`buildLbcData`, annonces en ligne seulement) et la publication part de cette file
  — il faut une version d'extension (lire `vrm_cycle_decisions`, construire l'annonce depuis le
  coffre). (a) est déjà la règle de Leboncoin.
- **3. Vendu sur un site ⇒ annonces des autres sites** : le retrait automatique d'eBay ne
  couvrait QUE les ventes Vinted. `src/retraitAilleurs.js` (`retraitsEbayAutoAilleursPermis`,
  la même rigueur) : vente Leboncoin (vendeur, pas annulée, annonce reliée par identité) ou
  Vestiaire (N° de l'annonce Vestiaire), aucune vente annulée de ce N°, jamais revenue, liste
  relue < 48 h, N° porté par un seul article, eBay publiée AVANT la vente, pas déjà terminée.
  Branché dans le passage de la coque (`passageRetraitEbayAuto({ ventes, ailleurs })`) ; la route
  `api/ebay.js` range le site dans le journal (`ou`), l'écran eBay dit « vendue sur Leboncoin ».
  Leboncoin et Vinted restent sur SON clic (§3) : la carte « à retirer de Leboncoin » de Ma
  journée porte maintenant **« Supprimer »** (= « Supprimer de Leboncoin », confirmé, une annonce
  à la fois, arrêt au premier doute) quand l'extension de ce Chrome sait (`lbcSupprime`) et que
  l'annonce est désignée par identité (vendue sur Vinted, eBay ou Vestiaire).
- **Cas ambigus et règle** (tous exécutés par `audit-cycle-article.cjs`) : C1 republiée avec
  d'autres photos ⇒ le N° suit (reprise / table de recréation), illisible ⇒ pas su ; C2 republiée
  sur un autre compte ⇒ republiée si même fichier photo ou même N°, **sinon on demande** (aucune
  identité, jamais le titre — limite connue : le nouvel article prendra un N° neuf) ; C3 masquée ⇒
  jamais « supprimée » ; C4 lecture partielle, de plus de 24 h, absente, « à confirmer », ventes
  illisibles ⇒ pas su ; C5 vendue Vinted + Leboncoin ⇒ « vendue » (l'alerte rouge de double vente
  existante n'est pas touchée) ; C6 vente annulée/retour ⇒ « revenue », remis en stock ⇒ chez lui ;
  C7 50 articles identiques, un supprimé ⇒ UNE carte, la sienne ; C8 vente Vestiaire sans N°
  commun ⇒ on demande (et aucun retrait eBay automatique) ; C9 sur eBay puis supprimé de Vinted
  ⇒ on demande, « chez moi » ⇒ pas reproposé à eBay ; C10 achat retourné après mise en ligne ⇒
  on demande, « Je m'en sépare ».
- **Preuves** : `audit-cycle-article.cjs` **56 contrôles**, `--prouve` : **56 rouges sur
  origin/main**, **16/16 mutations** attrapées. Banc `cycle-supprime.cjs` (390 tactile clair +
  1512 sombre) : une carte (N°12) parmi 9 cas, 3 pilules 44 px, « Toujours chez moi » range la
  réponse sans vendre ni sortir l'article ; **18 verts** ; `CYCLE_MUTATION=1` (vente de 7004 non
  servie) ⇒ rouge. Captures regardées. Voisins verts : identite, numeros-vestiaire,
  vestiaire-partout, benefice-unique, agent-ebay (77), coherence, places, supprimees, enligne,
  journee-court, masquees-numeros, fusion-nuage, ebay-deja-vendue, preuve-vente, donnees-ecrans,
  icones ; banc design-fusion (Ma journée) 40 verts. **Pas lancés ici** : `audit-ebay-retrait-auto`
  (@babel/parser absent) et `audit-ebay-route` (fast-xml-parser absent). Le bouton « Supprimer »
  de la carte Leboncoin n'a pas de banc (il faut simuler l'extension).
- **Geste de Julien** : confirmer (1) l'interprétation des propositions (corrigée à 9 h 45),
  (2) comment déclarer une vente en main propre (CA/URSSAF), (3) s'il veut (b) sur Leboncoin
  (version d'extension), (4) garder le retrait eBay automatique ALLUMÉ maintenant qu'il couvre
  Leboncoin et Vestiaire ; ouvrir « Mes transactions » Leboncoin pour rafraîchir la liste.
