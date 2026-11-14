# 14 nov. — « L'extension a capté » et la carte en trois onglets (extension 5.377.0)

Branche `claude/popup-capte`. Deux demandes de Julien, mot pour mot :

1. « quand on se connecte dans un compte par exemple, l'extension capte des nouvelles choses, on a un
   petit popup qui dit que l'extension a capté ça » ;
2. (même version) « je veux que tu regardes l'extension pour qu'elle fasse tout parfaitement quand on
   clique dessus : que l'on puisse voir les favoris du plus récent au plus vieux pour envoyer des messages
   aux favoris, voir les annonces et ventes à chaque fois sur le compte connecté ; les autres comptes sont
   floutés sauf si la personne met tous les comptes sélectionnés, mais aucune action n'est possible
   dessus. Je veux que tout soit parfait. »

## Ce que Julien voit

**Sur vinted.fr / leboncoin.fr / vestiairecollective.com** : quand une lecture RÉUSSIE range du nouveau
pour le compte de l'onglet, une petite bulle près du logo VRM : « VRM a capté · shop_x » puis
« 2 nouvelles ventes · 1 bordereau · 3 messages » et « Voir › » (la page du SITE : Mes ventes, Messages,
le dressing — jamais VRM). Elle part seule après ~6 s (le temps s'arrête sous la souris), se ferme d'un
toucher (la bulle, ou la croix de 44 px), ne revient pas. À la connexion d'un compte : « Compte relié ·
julien_kicks » puis « 3 ventes · 14 annonces lues ». Rien de nouveau, lecture ratée, réglage coupé ⇒ rien.

**Dans VRM ouvert** : le même genre de message en bas (au-dessus de la barre sur iPhone, en bas à droite
sur ordinateur) : « L'extension a capté · shop_x » · « 2 nouvelles ventes » · « Voir » ⇒ l'écran concerné
(Ventes, Achats, Colis, Retraits, Messages, Annonces). Jamais par-dessus une feuille ouverte (il attend).
Réglage : Paramètres → Notifications → « Dire ce que l'extension capte » — le MÊME que la carte du logo
(Détails → « Ne plus dire ce que VRM capte »).

**En touchant le logo VRM (la carte)** : sous les quatre lignes, « shop_sophie · Tous les comptes » puis
trois onglets **Favoris · Annonces · Ventes** (touches de 44 px, l'actif enfoncé avec sa diode) :
- **Favoris** : « 30 favoris à qui écrire » ⇒ l'aperçu : le message, l'offre, puis la liste du plus RÉCENT
  au plus ancien (photo, pseudo, « il y a 2 h », article, prix → offre), chaque rangée se coche en la
  touchant, « Tout cocher / Tout décocher », et UN seul bouton plein « Envoyer le message (N) » (grisé à 0,
  la phrase dit pourquoi). La file est celle d'avant (offre réelle, 15/h favoris, 50/h, attente, temps
  d'écriture, variantes, pause, autre compte ⇒ rien). Après : « ✓ envoyé à N personnes · Ensuite : les
  réponses arrivent dans tes messages Vinted ; les nouveaux favoris reviendront ici. » Leboncoin et
  Vestiaire : « … ne dit pas qui a mis tes annonces en favori : il n'y a personne à qui écrire d'ici. »
- **Annonces** : celles du compte de l'onglet, en ligne selon `<enligne-regle>` (photo, N°, prix,
  « en ligne depuis 12 j », favoris ♥) ; toucher une rangée ouvre l'annonce sur Vinted. Lecture de plus de
  24 h ⇒ « À confirmer · lues il y a … » ; de plus d'une heure ⇒ relue dans le budget de lecture.
- **Ventes** : les 40 plus récentes du compte de l'onglet, état (à expédier en ambre, en route, finalisée,
  « annulée — pas une vente »), N°, « bordereau prêt / pas encore là ».
- **Tous les comptes** : les autres comptes, en dessous, FLOUTÉS (nom et nombres lisibles, détail flou),
  `inert`, détail `aria-hidden`, aucun bouton ni lien ni case : « Connecte-toi à ce compte pour agir ».
La **fenêtre de l'extension** (clic droit sur l'icône → « État de l'extension ») montre le même bloc
(lecture seule ; les favoris partent de l'onglet vinted.fr).

## Comment c'est fait

### Fond (`background.js`)
- `annoncerCapte(plateforme, compte, sorte, items)` — appelé SEULEMENT après un `supabaseUpsert` qui a
  rendu `true` : ventes, achats, annonces, messages (conversation NON LUE + date de son dernier message)
  dans `storeHarvest` et `storeHarvestRow` (la RÉPONSE lue, jamais la liste fusionnée), bordereaux
  (`storeLabel`, `recupererLabel`), codes de retrait (`noterRetrait`, code neuf), dates de versement
  (`rangerTransaction` 450, `rangerVersementConversation`), Leboncoin (annonces, ventes, messages — compte
  de la SESSION `vrmLbcCompte` v2 seulement), Vestiaire (ventes, achats, annonces, offres reçues, messages).
- **Nouveau par identité** : `vrmCapteVu` (chrome.storage.local, §4.9) garde par compte et par sorte les
  identités déjà rangées (6 000 au plus, 40 comptes). Une sorte jamais vue pour un compte = point de
  départ, en SILENCE (pas su ⇒ rien) ; ensuite, une identité inconnue n'est nouvelle que si sa date
  (lue dans la réponse) est après ce point de départ (marge 6 h) — sans date lisible, rien n'est dit.
  Bordereaux, codes, versements = événements (la fonction qui range a déjà prouvé qu'ils manquaient).
- **Connexion** (3 min) : autre compte que le dernier vu sur ce site, première écriture d'un compte ici
  (`signalerCompteRelie`), session VRM qui arrive (`saveSession`) ⇒ la première lecture de chaque sorte se
  dit en entier (« Compte relié · 14 annonces lues »), puis seulement le nouveau.
- **Lots** `vrmCapteLots` (un par compte, 2 min de vie s'il n'est pas montré) ; `notifierApp({ type:
  'capte', lot })` vers l'app ; `capteLot` / `capteVu` pour la carte, au nom du compte de L'ONGLET
  (`compteOngletCapte`, jamais un compte nommé par le message) ; `capteReglage` (carte), `reglageCapte`
  (app, canal adressé et pont) ; `etatSite.capteCoupe`, `etatPourApp.capte`.
- **Listes** `carteListes(msg, sender)` (lecture seule) : compte du cookie de l'onglet ; annonces par
  `donneesInfosPage` + `enLigneDuCompte` + `infosDuCompte` ; ventes PROJETÉES une par une
  (`o0:data->payload->my_orders->0` … 40, §4.4), état par `A_EXPEDIER` / `PAS_UNE_VENTE`, bordereaux par
  `meta->>tx` ; relecture par `retourSurVinted` (garde, budget de lecture) si la lecture a plus d'1 h ;
  autres comptes seulement avec `tous: true`, 4 lignes chacun, `lectureSeule`. Les favoris passent par
  `favorisCarte` (sa garde : un autre uid que l'onglet ⇒ refusé, rien ne part ; sans `confirme` ⇒ refusé).
- Aucune requête Vinted de plus pour la bulle ; aucun garde-fou touché.

### Carte (`vrm-badge.js`) et fenêtre (`popup.js`)
- Bulle `.capte` dans la shadow root fermée ; places essayées autour du logo (au-dessus, à côté, en
  dessous) : la première qui ne recouvre AUCUN élément actionnable du site (grille de 10 px,
  `elementsFromPoint` sous notre hôte) ; sinon elle attend (4 essais). Chrome, Edge, Firefox, Orion :
  stockage et messages seulement (`chrome.storage.onChanged` ⇒ `capteLot`), aucun `chrome.alarms`.
- Listes : `listesHtml` / `brancherListes`, état `vrmCarteOnglet` / `vrmCartePortee` (ce navigateur).
  Aperçu des favoris : `listeFavTriee` (date décroissante), cases, `selFav`, la sélection envoyée = ce
  qui est coché. Mode « listes » (`__vrmListes`) pour `popup.html?mode=onglet`.
- Direction « bleu clair, porcelaine » pour le neuf : touche en porcelaine, actif enfoncé + diode, plaque
  N° gravée, lien, un seul plein.

### Serveur
`api/_lib/favoris-carte.js` : chaque favori de l'aperçu porte `date` et `photo`.

### App
`src/capteNotif/` : `regle.js` (pur : nombres, reste à dire par lot, écran, réglage partagé),
`CapteNotif.jsx` (le toast, portail, `vrm:ext`), `capte.css`, `useReglageCapte.js`. Branché par
`brancherExtensionCapte(...)` + `<CapteNotif …/>` dans la coque (App.jsx) et une ligne dans Paramètres.
Textes `capte.*` (5 langues, `src/i18n/langues/*/capte.js`). « Quoi de neuf » : 2 lignes.

## Capacités (`EXT_CAPACITES`, 5.377.0)
| capacité | fonction | ce que l'app promet |
|---|---|---|
| `popupcapte` | `annoncerCapte` | « L'extension a capté » (bulle sur le site, toast dans l'app), réglage partagé |
| `cartelistes` | `carteListes` | Favoris · Annonces · Ventes du compte de l'onglet ; autres comptes floutés, lecture seule |
| `favoriscoches` | `vrm-badge.js:listeFavTriee` | favoris du plus récent au plus ancien, cochés un par un, « Envoyer le message (N) » |

## Preuves
- `scripts/audit-popup-capte.cjs` (vrai `background.js`) : 24/24 ; `--prouve` : rouge sur origin/main,
  6 mutations rouges (identité ignorée, annonce avant l'écriture, compte de l'onglet ignoré, réglage
  ignoré, lot vu qui revient, point de départ annoncé).
- `scripts/audit-carte-listes.cjs` (vrai `background.js` + vraie règle serveur) : 18/18 ; `--prouve` :
  rouge sur origin/main, 7 mutations rouges.
- Bancs (390 tactile et 1512, clair et sombre, captures regardées) :
  - `scripts/bancs/popup-capte.cjs` 51/51 — sur la 5.376 (`BANC_EXT=<arbre d'avant>`) : 37 rouges ;
    mutations « place sans contrôle des boutons » 14 rouges, « lot jamais noté vu » 33 rouges ;
  - `scripts/bancs/carte-listes.cjs` 72/72 — sur la 5.376 : 56 rouges ; mutations « autre compte sans
    `inert` », « favoris non triés », « sélection ignorée » : 4 rouges chacune ;
  - `scripts/bancs/toast-capte.cjs` 44/44 (le VRAI `CapteNotif.jsx` assemblé par esbuild) — mutations
    `BANC_MUTANT=feuille` 4 rouges, `unefois` 8 rouges ; le composant n'existait pas avant ;
  - `scripts/bancs/carte-favoris.cjs` 79/79 (mis à « Envoyer le message (3) »).
- Audits verts : coherence, extension-zip, extension-navigateurs, traduction, quoi-de-neuf, tdz, variables,
  csp, violet, rouge-doublon, carte-extension, extension-ui, garde-fous-capture, ventes-envoi-leger,
  inbox-fusion, moisson-dressing, endpoints-vus, favoris-ecritures, identite, fonctions-api, lbc-clair,
  versement-sources (suit désormais la version : la capacité reste à 5.376.0), extension-capture,
  evt-extension, robustesse-extension, fiabilite-fond, notifications-vinted, securite-comptes ;
  `npm run build`.

## Geste de Julien
Installer la 5.377.0 sur chaque navigateur (remplacer le dossier, ⟳ ; Orion : `VRM-Orion-dossier.zip`).
