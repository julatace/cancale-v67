# 16 nov. 2026 — Lectures en double et vitesse (lot `vitesse-lectures`)

Branche `claude/vitesse-lectures` (depuis `origin/main`), poussée à chaque commit. Aucune écriture en
base réelle, pas d'extension touchée, toujours 12 fonctions `api/`.

## ÉTAT À LA REPRISE

PR #1195 ouverte, **NON fusionnée** (règle de Julien du 16 nov. : zéro rouge pour fusionner). La CI de la PR
(commit a50e0bf) : `budget-vitesse` ne montre plus AUCUNE des adresses de ce lot (Messages : seulement le JS ;
Ma journée : `vrm_controle_nuit`/`installation` ×3 — corrigé ensuite, `src/veilleLigne.js`, lecture partagée
60 s) ; restent des rouges NÉS D'AUTRES LOTS sur `origin/main` : JS +342 Ko sur tous les écrans,
`email_bord_*`, `vinted_listing_dates`, octets d'Annonces, Achats ; et dans les autres jobs ~70 audits rouges
(identiques avant/après ce lot, comptés un par un pour ceux qui touchent ses fichiers), `regles`
(`lot-preparation-reprise` : React is not defined), `comptes-et-reception` (`memesPairesFiches`,
`codeParrainGarde` is not defined), navigation-tache, statut-colis, accessibilite. À la reprise : quand `main`
est revenu au vert, vrai merge de `origin/main`, relever le budget du JS (BUDGET_RELEVER, raison « JS des lots
du 16 nov. ») s'il reste rouge, attendre la CI, fusionner. Geste de Julien : aucun.

## 1. Ce qui change pour Julien

- Messages et Ma journée lisent une fois (au lieu de 2 à 3) le registre des comptes eBay et les dates
  des commandes eBay.
- Ce que l'extension range pour **Leboncoin**, **Vestiaire** et la **boîte Vinted** arrive à l'écran
  resté ouvert sans recharger — y compris sur l'iPhone ou quand la lecture vient d'un autre ordinateur.
  Un **e-mail** rangé fait paraître « Actualiser » dans la boîte e-mail (rien n'est relu sans son geste).
- La page d'accueil publique est plus légère : le fichier d'entrée passe de 37,7 Ko à 25,8 Ko
  compressés (sous le budget de 26 Ko du banc `accueil`).

## 2. Point par point (mission du 16 nov.)

### (10) Ma journée lisait `email_reception_*` deux fois
Mesuré avec une sonde de piles (`initScript` qui note la pile de chaque lecture visée, traduite par les
cartes de source du build) : sur `origin/main` d'aujourd'hui, Ma journée ne lit plus du tout
`email_reception_*&select=id&limit=1` (le guide de démarrage ne la lit plus depuis le parcours du
15 nov. ; seule « Vérifier mon installation », dans Paramètres, la lit). L'exception du budget était
périmée : **retirée** (neuf et 2ᵉ ouverture).

### (11) Messages : `ebay_comptes` ×3 et `like.ebay_orders*` ×2
Cause (piles) : deux lecteurs du registre eBay — `lireComptesEbay` (sa liste des comptes actifs) et
`useComptesAutresSites` (les comptes reliés des autres sites, monté par la feuille « compte relié » de
la coque, Solo, l'indicateur, Comptes liés, « Tout va bien ? ») — et plusieurs montages de
`useComptesAutresSites` à plus de 2 s d'écart (hors du partage de `lecturesPartagees`).
- `lireRegistreEbayBrut` (src/App.jsx) : la ligne brute du registre, lue UNE fois pour ses deux
  lecteurs ; même vie que la liste (jusqu'à `signalerComptesEbay`) ; une lecture ratée n'est pas gardée.
- `lireAutresSitesLignes` : les sept lectures de `useComptesAutresSites` partent une fois pour tous ses
  montages, servies 30 s ; oubliées AVANT les relectures par `vrm:ext` (Leboncoin, Vestiaire, eBay) et
  `vrm:ebay-comptes` (écoute posée au premier appel, donc avant celles des crochets) ; « relire » d'un
  écran ⇒ lecture neuve ; une ligne ratée ⇒ rien gardé.
- Sonde de piles après : Ma journée et Messages, neuf et 2ᵉ ouverture : **1** lecture de chaque.
- Exceptions retirées du budget : `ebay_comptes` (×3) et `ebay_orders*` (×2) sur Messages ET Ma journée.

### (12) temps-reel à 1512 px : relecture de tous les comptes après une vente
Mesuré sur `origin/main` d'aujourd'hui (build d'avant ce lot) : **l'explosion n'existe plus** (après
l'écriture : 2 lectures lourdes, du SEUL compte touché, 363 Ko ; 548 Ko en tout, sous les 600) — réglée
par « source unique » (13 nov.) et `oublierCommandesCompte`. Mais le banc était **rouge** à 390 et 1512
(« la vente neuve est à l'écran — jamais ») : Ventes s'ouvre sur « À envoyer » depuis la refonte g1
(VentesVerre) et la vente écrite par le banc (copie d'une vente finie) est dans « Toutes ». Le banc va
d'abord dans « Toutes » (`data-ventes-seg-choix="toutes"`) et le vérifie (nouveau contrôle).

### (14) Fichier d'entrée de la page d'accueil
`fr-accueil.js` ne porte en fait que des clés de la page d'accueil (176 clés : `accueil.*` construites
dynamiquement, erreur, maj, légal) — aucune clé de l'app à sortir. Le poids venait d'ailleurs (mesuré
avec un greffon de build qui liste les modules du morceau d'entrée) :
- **le mode exemple** emportait ses données inventées (exempleBase, exempleDonnees, exemplePhotos) dans
  le fichier d'entrée de TOUS les visiteurs : elles sont maintenant un morceau à part, chargé quand
  l'exemple s'installe ; chaque lecture de la base de l'exemple attend ces données (`ETAT.pret`) ;
  l'identité (`UID_EXEMPLE`, `EMAIL_EXEMPLE`) vit seule dans `src/exempleIdentite.js` ;
- **l'aide d'installation et « Mettre à jour »** (rendus seulement DANS l'app) : `React.lazy`, chargés
  avec l'app ; un morceau absent ne montre rien ;
- `navigateurIci` / `estOrionIci` sortis de `navigateurExtension.js` vers `src/navigateurIci.js`
  (ré-exportés à l'identique).
- **le journal des plantages** (`src/plantages.js`) derrière un tampon minuscule (`src/plantagesTampon.js`) :
  le tampon écoute dès le démarrage (erreurs, rejets, violations CSP, morceaux périmés, AVEC le contexte de
  l'instant), le vrai journal arrive à l'inactivité (≤ 4 s) ou au premier plantage et reprend tout, dans
  l'ordre, une fois (`scripts/tests/plantages-tampon.test.mjs`, 3/3) ;
- **les offres** (`OFFRES`, `prixCompteSupTexte`, `PRIX_COMPTE_SUP_CENTIMES`) dans `api/_lib/plan-offres.js`,
  ré-exportées par `plan-regle.js` (une seule source) : un module partagé avec l'app tombait ENTIER dans le
  fichier d'entrée (règle de Rollup) — la règle des plans complète y était ; les mutations de
  `audit-comptes-sup` / `audit-plans-solo-pro` copient le petit module à côté (toujours rouges) ;
- même raison : les deux préférences lues par l'accueil (`src/accueil-media.js`, hors du moteur de mouvement
  du film) et la présentation du code partenaire (`src/partenaires/presenter.js`, l'app seule).
Résultat : **37,7 Ko → 25,8 Ko** compressés (26 410 octets ; budget 26 Ko) — banc `accueil` : le contrôle
de poids est vert.

### (15) La sonde de 60 s des ventes — TRANCHÉ : elle reste
Elle double la veille seulement quand tout va bien. Elle seule couvre encore (lu dans le code) :
1. une installation sans comptes séparés (`MULTI_USER` faux) : la veille n'est pas montée ;
2. un appareil dont l'horloge retarde de plus de 10 min (la fenêtre de la veille part de l'heure de
   CET appareil ; la sonde compare la date de capture, sans fenêtre) ;
3. un signal de la veille arrivé pendant que l'écran était GARDÉ caché (`cache()` ⇒ jeté) : la sonde
   repart au retour de l'écran (`vivant.surRetour`) ;
4. une veille en panne plus de 10 min : à la reprise, une ligne écrite avant la fenêtre n'est plus vue.
Coût : une lecture scalaire < 1 Ko par minute, onglet visible, partagée avec l'âge des ventes de la
coque. La raison est écrite à côté du code (src/App.jsx, au-dessus de `sonde`).

### (16) La veille ne signalait ni Messages, ni Leboncoin, ni Vestiaire, ni les e-mails
Ajouté seulement ce dont l'écran a déjà un chemin de relecture (src/tempsReel.js, `REGLES`) :
- `harvest_{uid}_inbox` ⇒ `messages` (par compte) : Messages / Ma journée oublient la boîte de CE
  compte et relisent (`loadConvs`, moisson seulement, aucune requête Vinted) ;
- `lbc_(listings|ventes|accounts|messages)` ⇒ `lbc` (jamais `lbc_a_retirer` : l'APP l'écrit — mesuré au banc, son signal
  rejoué faisait relire puis réécrire, en boucle, et la pastille restait allumée pour rien), `vc_(listings|ventes|session|offres|
  messages|achats)` ⇒ `vestiaire` : la passerelle (`src/passerelleVeille.js`) rejoue le signal de
  l'extension `vrm:ext {type:'maj', quoi, source:'veille'}` — chaque écran Leboncoin/Vestiaire relit
  par son chemin habituel. Une famille au plus une fois / 20 s, et jamais juste après un VRAI signal
  de l'extension (pas deux relectures pour une écriture) ;
- `email_reception_*` ⇒ `emails` : la boîte e-mail montre « Actualiser » (aucun appel à la route sans
  son geste ; rien ne bouge sous ses yeux).
Laissés de côté (pas sûrs) : les fils `lbc_fil_*`, `vc_fil_*`, `harvest_*_conv_*` (forme d'identifiant
non mesurée / écran du fil ouvert seulement), et les lignes de recette (`*_recon`, `*_envoi`).

### (58) messages-sites : un `POST app_data` à l'ouverture de Messages
Trouvé (corps de l'écriture capturé par une copie du banc) : `vrm_comptes_relies` — la mémoire des
comptes reliés (src/CompteRelie.jsx). La base du banc n'avait pas cette ligne : chaque ouverture était
la **toute première de la vie du vendeur**, et l'app posait son point de départ. Cette écriture est
**utile** (une fois par vendeur) : sans elle, un compte relié plus tard par un vendeur ancien serait
pris pour un compte d'avant (jamais accueilli, jamais notifié). Elle n'est pas faite par Messages mais
par la coque, à n'importe quel écran. **Gardée** ; le banc sert maintenant la ligne d'un vendeur qui a
déjà ouvert VRM. Une 2ᵉ écriture du banc (`diag_photos`, Vestiaire 1512) venait des photos COUPÉES par
le banc (le diagnostic des photos s'écrit quand elles échouent vraiment) : le banc sert une image d'un
pixel.

## 3. Preuves

- Sonde de piles (`initScript` + cartes de source, script jetable) : Ma journée et Messages, neuf et 2ᵉ
  ouverture : `ebay_comptes` ×1, `ebay_orders*` ×1, `email_reception_*` ×0 (avant : ×3, ×2, ×2 permis au budget).
- `budget-vitesse` (journee, messages), machine locale à charge 45 : plus aucune des adresses retirées ;
  Messages 24 → 14 lectures en double. Restent rouges, nés d'autres lots sur `origin/main` (identiques sur le
  build d'avant) : le JS (+342 Ko) et des doubles `vrm_controle_nuit`/`vrm_controle_installation` ×3,
  `lbc_ventes&select=data`, `photo_emprunte_*`, `in.(vc_ventes,vc_listings)` — voir la CI de la PR.
- `temps-reel` (390 tactile clair, 1512 sombre) : **38 verts, 0 rouge** (vente 14 s / 13 s, après l'écriture
  2 lectures lourdes du SEUL compte touché, 548 Ko ; F : boîte du seul compte, Leboncoin et Vestiaire rejoués
  une fois, e-mail signalé, aucune écriture). Avant le retrait de `lbc_a_retirer` : la pastille 390 manquait
  (boucle) — le banc l'a vu.
- `messages-sites` : plus aucune écriture (avant : 5 rouges « aucune écriture » + 1 `diag_photos`) ; reste 1
  rouge d'avant (eBay 1512, la ligne e1 pas cliquable).
- `accueil` : poids 25,8 Ko ≤ 26 Ko (vert ; avant 37,7 Ko rouge).
- Tests : `temps-reel.test.mjs` 11/11, `plantages-tampon.test.mjs` 3/3. Audits verts : mode-exemple,
  exemple-photos, vendeurs-differents (porté : `navigateurIci.js`), comptes-sup et plans-solo-pro (`--prouve`
  compris), traduction, lancement, ouverture, variables, tdz, coherence, identite, lectures*, quoi-de-neuf.
  Rouges identiques sur `origin/main` : chrome-en-dur, signalement, vendeur-generaliste, morceau-perime,
  bilan-semaine, suites-serveur.

## 4. Ce qui reste

- Banc `accueil` : le poids est vert (25,8 Ko) mais la marge est mince (0,2 Ko). Piste suivante : différer
  l'initialisation de main.jsx pour charger `modeExemple.js` seulement quand l'exemple est demandé (≈ 3 Ko).
  Autres rouges du banc, sans rapport avec ce lot (machine du banc chargée, charge 45) : LCP 3,1 s, le
  bouton d'inscription doublé dans la barre à 1512, le film « fonction pure du temps ».
- `messages-sites` : deux rouges d'avant, sans rapport avec les écritures (eBay 1512 : la ligne
  `[data-ebay-message="e1"]` jamais cliquable ; Leboncoin 1512 : « le compte, SON nombre de non-lus »).
