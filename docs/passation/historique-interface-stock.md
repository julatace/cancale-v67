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
