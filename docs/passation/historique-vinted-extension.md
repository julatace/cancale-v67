# Historique — vinted-extension

> Texte déplacé TEL QUEL depuis `CLAUDE.md` le 31 octobre 2026 (allègement du dossier : 1,36 Mo → moins de 60 Ko).
> Rien n'a été réécrit : les paragraphes gardent leur ordre d'origine. Le classement par thème est automatique (mots du titre) — en cas de doute, chercher par `grep` dans tous les `docs/passation/historique-*.md`.

> ⚠️⚠️ **29 octobre — PLAFOND D'ACTIONS PASSÉ DE 20 À 50 PAR HEURE ET PAR COMPTE (5.283), SA DÉCISION :** Julien :
> « augmente la limite à 50 par heure comme vintex » (après la 5.282, qui disait 5 republications/h au plus). Ce chiffre
> n'est pas mesuré chez Vinted : c'est son choix, le risque de blocage lui a été dit. `ACTIONS_MAX_HEURE` = **50** ; la
> réserve des gestes sur clic (`RESERVE_GESTES` = 5) reste ⇒ les commandes de l'app (Republier, bordereaux) s'arrêtent à
> **45** = **15 republications par heure et par compte** (3 actions chacune). Inchangés : compte de l'onglet, une requête à
> la fois, pause Vinted (429/403), `REPUB_PAR_JOUR` 50, budget de LECTURE (20/h). Tests mis au nouveau chiffre :
> `audit-exec`, `audit-relais` §7, `audit-compteurs-concurrents`, `audit-tout-generer`, `audit-recreer` §Q (tous verts).
> Ne PAS le redescendre à 20 sans qu'il le demande.

> ⚠️⚠️ **29 octobre — REPUBLIER « COMME VINTEX » (5.277), après la restriction de 24 h d'angeled92 :** Vinted a écrit
> « activité automatisée » après une republication de VRM. Mesuré (extension VRM Observateur, lecture seule, 266 requêtes
> de Vintex sur 2 articles) : Vintex fait TOUT depuis l'onglet vinted.fr (cookies du site, `x-csrf-token` de la page,
> aucun `Authorization`), GET de l'annonce → photos à 1,5–3 s → brouillon → suppression juste après → 1 à 3 min →
> GET du brouillon → completion, sans renvoi ni nouvel essai. VRM partait du service worker (Bearer, `credentials:omit`),
> supprimait AVANT le brouillon, et renvoyait photos/taille en rafale sur un refus. ⇒ `vintedPage` / `vintedPagePhoto`
> (`executeScript` dans le monde MAIN, `credentials:'include'`, FormData rebâti dans la page) pour TOUTE la republication
> (Republier, Refaire, Brouillons → en ligne, Modifier, lecture des recettes) ; sans onglet Vinted ⇒ `code:'onglet-vinted'`,
> RIEN n'est envoyé ; plus de création directe (toujours un brouillon) ; ordre L P… B S (pause 1–3 min) L M ; un refus
> s'arrête et DIT le geste (photos : « rajoute les photos » ; taille : Modifier) — `completionSecoursPhotos`,
> `photosNeuvesBrouillon`, `secoursTaille` RETIRÉS (ne pas les remettre) ; `PAUSES_REPUB` photo 1,5–3 s, brouillon 2–5 s,
> mise en ligne 60–180 s ; **10 paires par jour et par compte** (`REPUB_PAR_JOUR`, `vrmRepubJour`, 24 h glissantes,
> `quota-jour`). États du coffre : brouillon refusé/sans id ⇒ « toujours en ligne », rien supprimé ; suppression floue ⇒
> `incertain`, brouillon `a-publier` mais `supprime:false` (Refaire ne le met jamais en ligne). `EXT_CAPACITES.republierpage`
> = 5.277.0 (le texte « comme Vintex » de Republier n'est dit qu'à elle). Preuve : `audit-recreer.cjs` (135 ; 49 rouges
> sur la 5.276 — dont « toutes les requêtes partent de la page, sans Authorization »). ⚠️ Non mesuré : que ce soit ce qui
> a déclenché la restriction (probable, pas prouvé) ; que Vinted ne restreigne plus. **Geste de Julien** : laisser un
> onglet vinted.fr ouvert sur le bon compte pendant Republier ; ne pas republier sur angeled92 avant la fin des 24 h.
> **Suite (5.278), relu requête par requête contre le relevé de Vintex** : photos du brouillon en forme COURTE
> `{id, orientation}` (VRM envoyait la forme longue de la création directe : `ai_detected`, `c2pa_read_error`,
> `digital_source_type`), `feedback_id: null` comme Vintex, et les délais MESURÉS : lecture → 1re photo 1,5–4 s, entre
> deux photos 2–4,5 s, ~1 s avant le brouillon, 0,4–0,8 s avant la suppression, 1 à 3 min avant la mise en ligne. Écarts
> qui RESTENT, dits : en-têtes de Vintex jamais vus (l'Observateur ne les relève pas) ; VRM lit une fois par 24 h la
> grille des tailles (`/item_upload/attributes`, Vintex non) ; VRM renvoie des photos réencodées en JPEG ; Vintex fait les
> brouillons de plusieurs paires puis leurs mises en ligne, VRM une paire après l'autre.
> **Suite (5.279), « fais aussi les brouillons et tout à la suite comme Vintex »** : avec `msg.differer` (l'app l'envoie
> si l'extension sait `republierfile` = 5.279), après brouillon + suppression la mise en ligne est PLANIFIÉE à +1–3 min
> (`planifierMiseEnLigne`, `vrmRepubAttente` dans chrome.storage.local, minuterie + réveil par chaque alarme
> `miseEnLigneTick`) : la file Vinted est libre, la paire suivante passe ; à l'heure, UNE à la fois, `finRepubBrouillon`
> (lecture du brouillon, `completion`, mêmes gardes), job retiré AVANT d'agir (jamais deux mises en ligne), résultat
> envoyé à l'app (`maj · repub · etape:'fin'`, gardé 24 h `vrmRepubFins`). App : ligne « brouillon prêt · mise en ligne
> vers HH:MM » (`planifiee`), la file ne se dit finie qu'après elles, le N° est reporté à la fin. Le verrou 30 min de
> l'annonce est posé dès le brouillon. Preuve : `audit-recreer.cjs` §N (144 ; 5 rouges sur la 5.278). Reste différent :
> l'espacement entre deux paires est celui qu'il règle (Vintex : ~12 s) ; non mesuré : un vrai Chrome qui endort le
> service worker pendant l'attente (le réveil par alarme est au plus 30 s en retard).

> **29 octobre — TOUT ce que Vinted exige est vérifié AVANT la mise en ligne (5.276) :** Julien : « il ne doit pas y avoir
> d'erreur possible », « que toutes les catégories obligatoires soient remplies avant de valider la mise en ligne ».
> `champsManquantsAvant` (une règle pour Mettre en ligne un brouillon, Refaire, Republier par brouillon et direct) : titre, prix,
> photos, catégorie, description ≥ 5, couleur, taille du colis ; l'état si la grille de la catégorie en a un ; la taille (code
> présent dans la grille, sinon celle de la PAIRE au libellé exact, posée) ; tout attribut que la réponse marque obligatoire
> (`required`/`is_required`/`mandatory` — drapeau jamais vu, absent ⇒ rien d'exigé). Il manque quelque chose ⇒ RIEN n'est envoyé
> (Republier : avant photos, suppression et création — l'annonce reste en ligne), le champ est NOMMÉ avec le geste. Grille
> illisible ⇒ les champs connus seuls, et le secours après refus (5.275) reste. Lecture de la grille APRÈS le verrou. Preuve :
> `audit-recreer.cjs` (132 ; 10 rouges sur la 5.275). ⚠️ Vinted peut encore refuser pour une règle qu'il ne publie pas : la
> réponse le dit, rien n'est perdu.

> **29 octobre — Republier : la barre DÉTAILLE chaque étape, et la taille refusée par Vinted (5.272) :** Julien : « tout doit
> être détaillé dans la barre de progression » ; « pas faite · Vinted a refusé la mise en ligne (400 : size (Le champ Taille
> doit être renseigné)) ». Barre : `DetailEtapes` sous chaque barre (`data-etapes-detail`, `data-etape-detail`/`data-etape-etat`
> fait · encours · avenir · echec) — photo n sur N, nombre de photos parties, pause au hasard et son compte à rebours, nouvel
> essai des photos ; une paire qui n'aboutit pas GARDE son détail avec ✗ à l'étape où elle s'est arrêtée. MESURÉ : le brouillon
> de la Spezial 38 (10579996668) porte catalogue 2632 + taille 2033 (acceptés par Vinted le 15 oct.) ; une P-6000 du même
> catalogue passe avec 1197 ⇒ Vinted ne reconnaît plus ce code de taille. VRM ne choisit jamais une taille : `tailleRefusee` /
> `gesteRefus` ajoutent le geste (Mes brouillons → Modifier → taille → Publier) aux quatre refus de mise en ligne et gardent la
> forme (`rates.vinted_refus_taille` : catalogue + codes). `/api/v2/item_upload/attributes` est vu, sa forme jamais. Preuve :
> banc `republier.cjs` (221 ; détail par étape, ✗ sur la paire arrêtée).

> **29 octobre — BROUILLON MIS EN LIGNE À LA MAIN, et les RÉDUCTIONS lisibles (5.271) :** Julien : « elle n'a pas capté
> que j'avais fait passer un brouillon en ligne à la main », « j'ai encore un brouillon qu'elle ne capte pas », « les
> réductions je ne comprends rien ». MESURÉ (lecture seule) : Sacai 10577417715 et Zoom Fly 10576081722 EN LIGNE dans leur
> dressing (relu après) mais `coffre_*.versBrouillon.etat = a-publier` ⇒ toujours « à mettre en ligne » ; l'Air Max
> (brouillon 10576112830) mise en ligne par un AUTRE brouillon de la même ancienne annonce (10576051739, `publie`) ; ses
> requêtes montrent `POST …/drafts/{id}/completion` (mise en ligne à la main), que `inject.js` ignorait. ⇒ App
> (`useBrouillonsARefaire(actif, presentes)`) : une ligne est réglée si son brouillon est PRÉSENT (en ligne, à confirmer,
> masqué) ou si un autre brouillon de la même ancienne annonce est `publie`/présent — par IDENTITÉ, dit une fois
> (`data-refaire-en-ligne`). Extension : `RE_BROUILLON_FIN` → `brouillonPublie` → `noterBrouillonPublie` (2xx, onglet
> Vinted, compte du cookie, ligne d'un autre compte refusée) : `etat: publie`, coffre `fait`. Brouillon jamais vu
> (10563756470 sans titre, 10432342904) : la ligne dit le geste en deux temps (Ouvrir sur Vinted → « Enregistrer le
> brouillon »). Republier → Prix : boutons « Garder le prix · −5 · −10 · −15 · −20 % · Autre… », « Arrondir à l'euro »,
> un EXEMPLE écrit (`data-republier-exemple`) ; **par défaut le prix ne change plus** (avant : −10 % d'office). Preuves :
> banc `republier.cjs` (réductions, brouillons à refaire 9505/9506). ⚠️ Non mesuré : la vraie réponse de `/completion`.

> **28 octobre (nuit, fin) — DESCRIPTION trop courte, et le COMPTE RENDU d'une opération coupée (5.264) :** Julien
> (Air Max 1 Athletic Department, zoom fly 5) : « Vinted a refusé le brouillon (400 : … Le champ Description doit comprendre
> au moins 5 caractères) » ; puis « si l'app recharge ou est éteinte je veux un compte rendu de là où l'opération s'était
> arrêtée ». Cause : la description de la fiche et du coffre était vide — seule la lettre ajoutée partait. `recreerVinted` :
> une description de moins de 5 caractères (lettre retirée, `DESCRIPTION_MIN`) est reprise sur l'annonce Vinted
> (`apprendreRecetteVinted`) AVANT de supprimer ; introuvable ⇒ `description-absente`, RIEN supprimé ni créé.
> `refaireBrouillon` reprend la description de la fiche de l'annonce, la lettre gardée en bas (les deux paires se refont
> par « Brouillons à refaire »). App : la file de Republier écrit son avancée sur l'appareil (`vrm_operation_repub`) ;
> rouverte après un rechargement, Annonces montre `CompteRenduOperation` (faites, en cours = « à vérifier sur Vinted »,
> ratées, pas commencées) avec « Reprendre ». Et une confirmation ouverte juste après en avoir fermé une (« Noir —
> publier » après « Mettre en ligne ») était refermée par le retour d'historique de la première : un retour qui est le NÔTRE
> ne ferme plus rien (`_installerRetourFeuilles`). Preuves : `audit-recreer.cjs` (107 ; 4 rouges sur la 5.263), banc
> `republier.cjs` (journal, compte rendu, Reprendre).

> **28 octobre (nuit) — « pas de réponse » n'est plus « pas fait » (fiabilité) :** Republier, En ligne → brouillon,
> Brouillons → en ligne, Modifier, et « Refaire le brouillon » attendaient l'extension 1 à 3 min puis disaient
> « échec — l'extension n'a pas répondu » et ENCHAÎNAIENT la paire suivante — alors que l'extension (file Vinted
> occupée, photos lentes) a pu supprimer, créer ou publier entre-temps. `vmrCmdSuivi` : trois issues (réponse ·
> `envoye:false` aucune extension ici · `sansReponse` = PAS SU) ⇒ la ligne dit « incertain » (`TEXTE_SANS_REPONSE` :
> regarde sur Vinted avant de relancer), la file S'ARRÊTE (`code:'sans-reponse'`), et ni « Réessayer » (Brouillons à
> refaire) ni un second « Mettre en ligne » ne sont proposés. Banc `republier.cjs` « extension sans réponse »
> (`window.__VRM_ATTENTE_GESTE` raccourcit l'attente). App seule, extension inchangée.

> **28 octobre (nuit) — audit de la recréation avant son premier essai, comparée au marché (5.249) :** Julien :
> « refais des audits avant que je teste, inspire-toi de ce qui existe ». Outils regardés (Relister for Vinted,
> Relisto, VintHelper, GEAR, VintedCRM, Fripio, Vintex, Dotb — pages d'éditeurs, non vérifiées) : republier en
> priorité ce qui DORT, perte des favoris/vues dite, jamais deux annonces vivantes, 2-3 jours entre deux
> recréations d'une même paire. Corrigé : (1) ⚠️ une création sans réponse claire (5xx, coupure, 60 s) était dite
> « refusée — intacte » alors qu'elle a pu être créée ⇒ « incertain », l'ancienne n'est PAS supprimée, et une
> nouvelle tentative sur la MÊME annonce est refusée 30 min (`vrmRecreerEnCours`) ; (2) une suppression sans
> réponse claire dit « peut-être encore en ligne », jamais « refusée » ; (3) un lien de photo périmé prend l'autre
> copie (coffre ↔ fiche) ; (4) ⚠️ une annonce et SA recréation au même N° (suppression ratée, ou dressing pas
> encore relu) faisaient renuméroter une paire toute seule (`doublonsAReattribuer`) ⇒ jamais entre elles
> (`recreeDe`, une identité) ; (5) Republier : tri « plus anciennes / moins vues / moins de favoris », vues,
> favoris et ancienneté par paire, favoris PERDUS comptés avant de lancer (avec « baisser le prix les prévient »),
> « déjà recréée il y a moins de 2 jours » signalé, la file S'ARRÊTE sur une pause Vinted ou le plafond horaire.
> ORDRE DE REMISE EN LIGNE (sa demande, même soir : « je sélectionne P-6000, Spezial, Air Max 1… ça republie
> Spezial, Air Max 1, P-6000 ») : la file suit l'ordre de SA sélection (ordre des clics), « Mélanger » le change
> (mêmes paires), ↑ ↓ le règlent à la main. Chaque paire reste « recréée PUIS supprimée » : c'est l'ordre de
> PASSAGE qui change — supprimer d'abord pour recréer ensuite exposerait à perdre une paire (§3, tranché).
> TEMPS ALÉATOIRE entre deux paires (sa demande, même nuit) : « Fixe » (secondes) ou « Aléatoire » entre SON
> minimum et SON maximum (minutes, 1 à 3 par défaut, 60 au plus), tiré avant chaque paire, la première part tout
> de suite ; compte à rebours affiché (`data-republier-prochaine`), choix retenu (`vrm_republier_esp`, appareil).
> C'est lui qui le règle et qui lance (§3, l'atelier). Banc `republier.cjs` (horloge simulée).
> Preuves : `audit-recreer.cjs` 26 (5 rouges sur la 5.248/main), banc `republier.cjs` (8 rouges sur le build de main).

> **25 octobre — extension 5.226 :** parcours manuel opt-in, onglet Vinted
> unique, rapport local filtré, arrêt conversation/3min/100étapes ; commandes
> Enregistrer/Arrêter/Copier/Effacer dans la fenêtre de l’icône. Aucun message
> ni upload de rapport. Ne pas prétendre le favori réparé : outil d’observation.
> Voir `docs/passation/2026-10-25-favoris-parcours-local.md`.

## 5. Les règles métier intouchables


### L'identité d'une paire
**Jamais par titre, jamais par ressemblance.** Dans l'ordre :
1. **identifiant d'annonce Vinted** — `transaction_id` → détail de transaction →
   `item_id` (`identiteAnnonce`) ;
2. **photo** (`entryKeyByPhoto` : fichier exact, puis dossier **non ambigu**) ;
3. **n° de transaction**, **n° de suivi** — des identités elles aussi.

Mesuré : 22 % des ventes portent un titre en double, et le titre désignait la
**mauvaise** annonce dans 3 cas réels. **Mieux vaut un blanc qu'un faux** — un
numéro faux ne se voit pas, il envoie la mauvaise chaussure.
`scripts/audit-identite.cjs` pose 50 paires rigoureusement identiques et vérifie
qu'aucune règle n'en désigne une.


### Achats : le compte se nomme UNE fois quand c'est le même
Il a **neuf comptes** et l'extension ne travaille que pour celui qui est
connecté dans l'onglet : savoir lequel est **indispensable**, et ça ne se perd
jamais. Mais vu en capture le 8 septembre : « **compte julatace3535** » écrit
**cinq fois**, sous cinq titres différents, alors que les cinq colis du groupe
sont sur ce compte-là — et « Ouvrir la conversation **→ le code arrive tout de
suite** » cinq fois aussi, alors que l'en-tête du groupe l'explique déjà.
C'est §7 mot pour mot, sur un groupe **uniforme**.
- Le compte est nommé **dans l'en-tête du groupe** quand il est le même
  (« Ils sont tous sur `julatace3535`. »), **sur chaque ligne** quand le groupe
  est mixte — là seulement la ligne distingue.
- Le libellé long ne reste que s'il distingue (groupe mixte, ce colis-ci n'a pas
  son code alors que ses voisins l'ont). Mesuré : **3 098 → 2 875 caractères**.
- Le banc `retrait.cjs` exige **les deux à la fois** : le compte apparaît **au
  moins une fois** (jamais perdu) **et** pas une fois par colis quand ils sont
  tous sur le même. Un contrôle qui n'aurait que la première moitié serait vert
  sur le défaut. Prouvé : « julatace3535 » ×5 avant, ×1 après.
- ⚠️ **Deux erreurs dans mon propre banc, corrigées** : (1) une commande
  moissonnée **ne porte aucun champ de compte** — c'est l'identifiant de ligne
  (`harvest_{uid}_orders_purchased`) qui le dit ; `o.account || o.uid` valait
  toujours `''`, et un `Set([''])` a une taille de 1, donc le banc annonçait
  « sur 1 compte » **en ne mesurant rien**. (2) Sa fenêtre de texte débordait
  sur le bandeau voisin et y lisait un login sans rapport.
- ⚠️ **Et l'uniformité se juge PAR GROUPE, pas sur l'ensemble** : les 6 colis
  sans code sont sur **2** comptes, mais la liste se groupe par point relais et
  celui « à confirmer » en porte 5, tous sur le même. Poser la condition sur
  l'ensemble ne l'aurait jamais déclenchée.


### ⚠️⚠️ ET UNE LECTURE RATÉE POUVAIT EFFACER UN COMPTE VINTED
Douzième forme du même piège, et la plus coûteuse côté extension.
`captureDomain` efface la ligne `vinted_accounts` d'un compte quand il est dans
la **liste noire** ET qu'il n'a pas été **réautorisé**. Les deux listes se
lisaient en `res.ok ? … : []`, puis le résultat était **mis en cache** (5 min /
60 s) **comme une vraie mesure**. Un 522 devenait donc « liste vide », gardée.
- **Contre-ordre lu vide → la ligne du compte est EFFACÉE.** Un compte qu'il
  vient de réautoriser compte comme encore supprimé : ses jetons partent, il
  doit repasser sur Vinted. C'est mot pour mot « l'extension ne veut pas
  renvoyer mes nouveaux comptes », déclenché par 60 s de lecture ratée.
- **Liste noire lue vide → un compte supprimé se fait re-capter** (le cas
  `shop_cancale`, « il revenait tout le temps »).
⇒ `null` = « pas su » : on **ne met pas en cache un échec**, on garde la
dernière valeur connue, et `captureDomain` **n'efface que s'il SAIT** (les deux
listes lues). Au pire un compte supprimé est re-capté une fois — ça se répare
d'un clic ; un compte vivant qui perd ses jetons, non.
- ⚠️⚠️ **ET MON PREMIER CONTRÔLE NE REPRODUISAIT PAS LE DÉFAUT.** Il faisait
  échouer les **deux** listes à la fois — le compte n'était alors pas dans la
  liste noire non plus, donc aucun DELETE, donc **vert sur le code fautif**.
  Ce qui supprime est le cas **asymétrique** : liste noire lue, contre-ordre
  pas lu. `audit-comptes-noirs.cjs` le sert exprès. **2 échecs** sur le code
  d'avant, 0 après. *Même famille que « lecture KO, écriture OK » pour
  `push_subs` : la panne totale n'est presque jamais le cas dangereux.*


### ⚠️⚠️ ET UNE LECTURE RATÉE POUVAIT RESSUSCITER TOUS LES COMPTES SUPPRIMÉS
**Seizième forme de « rien lu ne vaut pas rien » — et la première dans l'APP qui
DÉTRUIT.** `vrm_blocked_accounts` est la liste que l'extension lit pour refuser
de recapter un compte supprimé. Le dossier décrivait ce cas comme corrigé : il
l'était **du côté qui lit**. C'est l'**app** qui écrit cette liste
(`deleteVintedAccount`), en **lire-fusionner-réécrire**, et la lecture s'écrivait
`r.ok ? await r.json() : []`.
⇒ Un simple timeout — la base debout par ailleurs, donc **l'écriture passe** —
repartait d'une liste vide et **réécrivait la ligne avec le seul compte du
moment**. Prouvé au banc sur le code d'avant : la ligne part avec `["333"]`,
**`shop_cancale` et l'autre compte effacés**. Tous les comptes supprimés avant
lui redeviennent capturables, **jetons compris** — c'est mot pour mot « il
revenait tout le temps ».
*La moitié qui écrit n'avait jamais appris la leçon de la moitié qui lit.*
- On ne fusionne **que si on a lu** ; sinon on n'écrit pas.
- Et **on le dit** : la fonction rend `{ok, memo}`, et le message devient
  « supprimé — mais la base n'a pas répondu pour le mémo. S'il réapparaît,
  resupprime-le. » Se taire ici, c'est le défaut d'origine.
- `audit-fusion.cjs` ne s'arrêtait qu'aux onze lire-fusionner-réécrire de
  l'extension. Il **exécute** maintenant la vraie fonction d'`App.jsx` dans un
  `vm`, sur le cas qui détruit (**lecture KO, écriture OK** — la panne totale
  n'est presque jamais le cas dangereux) et dans **l'autre sens**. **3 échecs**
  sur le code d'avant.


### ⚠️⚠️ ET LA CARTE DE BIENVENUE RÉCITAIT QUATRE GESTES SANS REGARDER LESQUELS ÉTAIENT FAITS
Suite immédiate : une liste de quatre étapes dont trois sont déjà faites fait
chercher au **mauvais endroit**. Or l'app SAIT — le pont dit si l'extension
tourne dans **ce** navigateur (`vmrExtPresent`), et `vmrAuthEtat()` sous **quel
compte** elle écrit. L'information existait depuis toujours ; elle n'était lue
que dans le panneau « Sécurité des données », tout au fond de Réglages, sur la
ligne « Extension identifiée · pas connectée » — là où quelqu'un dont l'app
reste vide n'ira jamais.
`etapePont` rend **cinq** états — `absente` · `demande` · `muette` ·
`pasconnectee` · `autrecompte` · `connectee` — et le TITRE de la carte nomme
celui qui bloque ; les étapes faites portent une coche.
- ⚠️⚠️ **LE CAS QUI SÉPARE LES VENDEURS, ET IL ÉTAIT MUET** : l'extension peut
  être connectée sous **une autre adresse** que celle de l'app. Ses captures
  partent alors dans **la boutique de quelqu'un d'autre**, et celle-ci reste
  vide **pour toujours** — sans un mot. C'est exactement ce que Julien craint
  (« que tout ne se mélange pas »), vu du côté de la personne qui y perd. La
  carte **nomme les deux adresses** : sans les deux, on ne sait pas laquelle
  changer. C'est une **identité** (la même adresse), pas une ressemblance.
- ⚠️⚠️ **VU AU RENDU, ET C'ÉTAIT LE PIRE DÉTAIL** (§6.2) : le bouton principal
  disait « **Ouvrir vinted.fr** » dans les trois cas — y compris quand l'étape
  qui bloque était la **connexion** de l'extension. Dans le cas « autre
  compte », y aller aurait capté dans la boutique de l'autre. *Une alerte qui
  ne dit pas quoi faire ne sert à rien ; une alerte qui dit le MAUVAIS geste
  est pire.* Le bouton suit l'étape qui débloque — et quand le geste se passe
  dans Chrome (cliquer l'icône de l'extension), une page web ne peut pas
  l'ouvrir : **aucun** bouton principal plutôt qu'un qui envoie ailleurs.
- ⚠️ **« Pas su » ne vaut ni oui ni non** : une extension présente qui ne répond
  pas ne s'accuse de rien — on dit qu'on n'a **pas pu demander**.
- Le banc rejoue le **vrai dialogue du pont** (`postMessage` `ready` /
  `authEtat`) : c'est la seule façon de rendre les cinq états sans Chrome.
  **36 contrôles** au total, **6 rouges** de plus sur le build d'il y a une heure.


### ⚠️⚠️ ET LA FENÊTRE DE L'EXTENSION NE DISAIT PAS QUEL MOT DE PASSE ELLE VOULAIT
C'est **l'étape qui sépare les vendeurs** : si quelqu'un se trompe de compte,
ses captures partent dans la boutique d'un autre. Or on arrive dans cette
fenêtre **juste après avoir été sur Vinted**, on lit « Email / Mot de passe »…
et on tape son mot de passe **Vinted**. Ça échoue — et on vient de le saisir
dans une fenêtre qui n'en a aucun besoin.
L'app le disait bien dans sa carte des premiers pas (« avec le même email que
sur VRM ») ; **la surface où le geste SE FAIT, elle, se taisait** — §11, sur la
seule étape où une erreur mélange deux boutiques.
⇒ La fenêtre nomme le compte (« ton compte **VRM**, le même que sur
vrm.center »), dit **ce que ce n'est pas** (« pas ton mot de passe Vinted,
l'extension n'en a jamais besoin »), met ça **dans les placeholders** — c'est
eux qu'on lit en tapant, pas le paragraphe — et offre un lien pour créer le
compte si on n'en a pas.
- ⚠️ **`popup.js` n'avait JAMAIS tourné** — §4.10, comme `lbc.js` et `ebay.js`
  avant lui. `scripts/bancs/popup.cjs` la charge dans une vraie page avec un
  faux `chrome.runtime` : **11 contrôles, 3 rouges** sur le code d'avant.
- Il vérifie les **trois états** de la fenêtre : pas connecté · connecté (elle
  **nomme** le compte — c'est ce qui permet de voir qu'on s'est trompé) ·
  **session expirée**, qui n'est pas « pas de compte » et n'appelle pas la même
  consigne.
- Extension en **5.64.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` : l'app ne promet rien de neuf.


### ⚠️⚠️ UN COMPTE SUPPRIMÉ DÉFINITIVEMENT ALIMENTAIT ENCORE LES FILES DE PUBLICATION
Mesuré le 19 septembre, en isolant `shop_cancale` (que Vinted a bloqué, uid
**199082413**). Il y a **TROIS** listes de comptes écartés, pas deux, et elles
ne se recouvrent pas :
- `vinted_accounts_hidden` — masqué à la main dans l'app ;
- `vinted_accounts_blocked` — « refusé par Vinted » (LOCAL à l'appareil, §5.31) ;
- `vrm_blocked_accounts` — **supprimé DÉFINITIVEMENT** (celle que l'extension lit
  pour refuser de recapter, celle où vit `shop_cancale`).

Les files de cross-posting — `buildLbcData`, `buildEbayData` **et l'écran
Leboncoin de l'app** — ne construisaient leur `off` que des **deux premières**.
Un compte supprimé définitivement n'y était donc **pas**, et ses paires
numérotées en ligne (mesuré : **96** pour `shop_cancale`) étaient proposées à la
republication sur Leboncoin/eBay — alors que les écrans d'annonces de l'app
l'écartent déjà (plus de ligne `vinted_accounts`, donc absent d'`accountUids`).
C'est la divergence §11 (« l'app annonçait 39, le panneau 40 »), sur la liste
des comptes morts : on ne propose pas de republier ailleurs les paires d'un
compte que Vinted a fermé.
⇒ Les trois lecteurs unionnent désormais `vrm_blocked_accounts` dans `off` —
côté extension via `blockedAccounts()` (dernière valeur connue, `null` sur
échec), côté app via une lecture dédiée. ⚠️ **`null`/échec ⇒ on n'exclut RIEN** :
sur-exclure cacherait les paires d'un compte VIVANT sur un simple hoquet — c'est
le **sens inverse** du cas d'écriture (sous-exclure revient au comportement
existant, sur-exclure fait perdre). `audit-places.cjs` sert un compte dans
`vrm_blocked_accounts` **seul** (ni hidden ni blocked) et exige les deux sens —
**3 rouges** sur le code d'avant (Leboncoin, eBay, app).
- **Aucune entrée d'`EXT_CAPACITES`** : c'est une correction, l'app ne promet
  rien de neuf. Extension en **5.81.0**, zip régénéré, `EXT_ATTENDUE` suivie.


### ⚠️⚠️ « ÇA NE FAIT PAS LA CATÉGORIE TOUT SEUL » — LES MENUS REACT SONT ENFIN REMPLIS (POINTURE + ÉTAT)
Julien, 19 sept., après son dépôt test. **Mesuré : son dépôt (5.89) n'a capté que
l'étape « titre »** — mais un dépôt antérieur avait capté l'étape ATTRIBUTS
entière (`lbc_recon.etapes`), et j'ai enfin sa **vraie forme** : chaque attribut
(Univers, Type, Pointure, Marque, Couleur, État) est un **`[role="combobox"]`**
(`:form-field-_r_XX_`) + une liste **`[role="option"]`** (les `-item-N`) — des
COMPOSANTS React, **zéro `<select>` natif**. C'est pour ça que `choisirListe`
(qui fait `querySelectorAll('select')`) ne remplissait **rien**.
⇒ `choisirComposant(motif, valeurExacte)` (lbc.js) **OUVRE le menu et CLIQUE
l'option** — le geste d'un humain, pas une valeur posée en douce. On trouve le
menu par son **libellé** (les ids `_r_XX_` changent à chaque rendu React), et on
ne clique QUE l'option au texte **EXACTEMENT** égal.
- Rempli automatiquement : **Pointure** (← `ad.taille`, « 40.5 »→« 40,5 ») et
  **État** (← `ad.etat` Vinted, exposé par `buildLbcAd`). ⚠️ **Correspondance
  EXACTE** : « Satisfaisant » (Vinted) ≠ « État satisfaisant » (Leboncoin) → laissé
  VIDE, exprès (mieux vaut un blanc qu'un faux, §5). Un attribut faux sur une
  annonce publiée est le coût le plus élevé (leçon eBay).
- **JAMAIS Univers/Type/Couleur/Marque** : ils ne se devinent pas depuis ses
  données. **JAMAIS le clic « Publier »** : il reste à lui.
- ⚠️ **Ce que je ne peux TOUJOURS pas prouver d'ici (403)** : que le combobox
  RÉEL de Leboncoin réponde au clic synthétique comme mon fixture. Le banc sert la
  vraie FORME mesurée (combobox + option), pas une fiction ; mais l'interaction se
  confirme à son prochain dépôt. Si un menu ne se remplit pas, c'est un no-op
  (VIDE), jamais un faux — il voit et complète.
- `scripts/bancs/leboncoin.cjs` sert un dépôt `etape3` avec la vraie forme
  (combobox React) : **Pointure 40 et État « Très bon état » choisis par clic ;
  une pointure absente et « Satisfaisant » laissés VIDES.** Extension en
  **5.90.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée d'`EXT_CAPACITES`
  (le panneau fait le geste et écrit le chiffre ; l'app ne promet rien de neuf).
- ⚠️ **La CATÉGORIE (l'arbre Mode > Chaussures), elle, n'est pas encore captée**
  (son dépôt 5.89 s'est arrêté au titre) : c'est l'étape en amont qui ouvre les
  attributs. À câbler quand un dépôt l'aura relevée — d'ici là, il choisit la
  catégorie, l'extension remplit le reste qu'elle peut.


### ⚠️⚠️ « CAPTE À QUI APPARTIENT CHAQUE ANNONCE + LE NOM DU COMPTE » — LA MOITIÉ QUE JE PEUX FAIRE
Demande de Julien, 19 sept. : « prépare une extension intelligente qui capte la
plateforme, à quel compte ça appartient et le nom du compte, pour lier toutes les
paires — un écosystème pour un vrai revendeur. »
**Mesuré : l'infra existait (`storeLbcAccount`, message `lbcCapture.account`) mais
`lbc_accounts` était VIDE** — le motif du tiroir `Nav` : le mécanisme est là, la
DÉTECTION manquait. `lbc.js` cherchait le compte dans les données EMBARQUÉES de la
page (`__NEXT_DATA__`/`__next_f`) — il n'y est pas. L'identité du compte connecté
vit dans une **réponse API** que `lbc-inject` relaie déjà, mais que `handleLbcRaw`
ne minait pas.
⇒ `detectLbcAccount(data, url)` (background) lit l'identité du compte connecté dans
n'importe quelle réponse Leboncoin : un objet qui porte un **id + un nom** ET un
**marqueur de « c'est moi »** (email, téléphone, siren, store_id, is_pro). Il rend
`{id, name, type: pro|particulier, platform:'leboncoin'}`.
- ⚠️ **PRUDENCE (§5) : un acheteur a aussi un id + un pseudo.** Sans marqueur
  personnel (ou hors d'une clé `user/account/store/me/pro`), on ne prend RIEN —
  taguer une annonce du **mauvais compte** serait pire que ne rien taguer. Le banc
  sert exprès une réponse de **messagerie** (acheteurs) et exige `null`.
- `handleLbcRaw` tague les annonces de son **tableau de bord** (chemin pro `Ads`)
  du compte connecté (`account`, `accountName`, `accountType`, `platform`), et les
  annonces d'une réponse générique de **leur PROPRE owner** (jamais du compte de
  session — un chalet du flux découverte n'est pas à lui). Le compte est mémorisé
  dans `lbc_accounts`.
- `lbc-inject` laisse désormais passer les réponses `/account`, `/user`, `/me`,
  `/pro`, `dashboard`… (`ACCOUNT_HINT`), pas seulement celles qui parlent
  d'annonces — c'est là que vit l'identité.
- `scripts/audit-lbc-comptes.cjs` EXÉCUTE le vrai `background.js` (HEAD vs arbre) :
  particulier reconnu, pro reconnu, **acheteur non pris**, annonces taguées +
  écrites dans `lbc_accounts`. **§6.1 : sur le code d'avant, 0 annonce taguée.**
- **Aucune entrée d'`EXT_CAPACITES`** : c'est de la COLLECTE (l'app ne promet rien
  de neuf tant que le lien n'est pas rendu). Extension en **5.88.0**, zip
  régénéré, `EXT_ATTENDUE` suivie.
- ⚠️ **CE QUI RESTE, et pourquoi je ne le câble pas encore** : je n'ai pas VU la
  vraie forme de sa réponse « mes annonces » (403). `detectLbcAccount` est
  défensif (plusieurs noms de champs), mais tant que sa vraie réponse n'a pas
  confirmé où vit l'id + le nom, l'app **n'affiche pas** « publiée sur tel
  compte ». La prochaine passe, sur `lbc_accounts` réellement rempli, câble
  l'affichage par paire + le « vendue ici → retire là ». *On collecte, on
  vérifie, PUIS on promet.*


### ⚠️⚠️ ONZE CARTES PARTAGÉES RESTAIENT FROIDES AU PREMIER RENDU D'UN APPAREIL NEUF (4 octobre)
Suite de la passe fiabilité, famille §5.49. **Mesuré dans le code** : le démarrage
(`useEffect` au montage d'`AppCoeur`) fait `cloudLoad`, restaure `localStorage`,
appelle `apply()` sur **une liste précise** d'états racine, puis `markCloudReady`.
Donc une clé **synchronisée** lue au montage (`useState(() => load(k))`) qui n'est
**ni** dans `apply()` **ni** re-lue par un `onCloudReady` reste à sa valeur par
défaut **jusqu'à ce qu'on quitte et revienne sur l'écran** — l'`AppCoeur` monte
AVANT que le nuage soit là (appareil neuf, cache vidé, PWA réinstallée).
⚠️⚠️ **Et ce n'est pas cosmétique** : ces cartes sont éditées au clic/à la saisie,
et leur setter réécrit `localStorage` depuis l'état courant. Un clic pendant la
fenêtre froide part donc d'une carte **vide** et **réécrit le nuage réduit à une
entrée** — la famille destructrice §5 (comme les numéros repartis de 1 au
montage). Croisé `SYNC_KEYS` × lectures-au-montage × couverture : **11 cartes
partagées** manquaient, dont `vinted_sale_overrides` (tes corrections de compta,
achats reliés), `vinted_achat_notes` (texte saisi), les états de bordereau
(`bords_printed/hidden/shipped`, `bord_links`, `bordereau_formats`), les retours
(`retours_recus/dismissed`), `pairs_lost`, `offvinted_buys`.
⇒ Ajoutées au bloc `onCloudReady` **déjà existant** (celui des numéros/points
relais, L19189), au **motif déjà béni** `setX(n => vide(n) ? load(k) : n)` : sûr
par construction — il ne remplit QUE ce qui est resté par défaut, **jamais une
saisie faite pendant le chargement** (sinon ce serait le pire défaut de l'app).
Build + 57 audits verts (`audit-tdz` compris : un callback d'`onCloudReady`
s'exécute après le montage, pas au rendu — pas de TDZ bien que `setOffBuys` soit
déclaré plus bas).
- ⚠️ **Non render-vérifié ici** (pas de fixtures dans ce conteneur) : le motif est
  identique à celui que `comptes.cjs` a validé pour les comptes exclus, et le
  `vide`-guard le rend non destructeur ; à re-regarder au rendu sur un appareil
  neuf dès qu'un banc a des fixtures.
- ✅ **FAIT dans la foulée (même passe)** : les clés dont le setter vit dans un
  autre composant ont reçu leur propre `onCloudReady` local (juste après leur
  `useState`, scope garanti) — `vinted_regime` (base du taux URSSAF),
  `vinted_urssaf_freq`, `vinted_account_labels/emails/phones`, `vinted_inventory`,
  `vinted_entreprise_active`. ⚠️ **Deux gardes selon le type** : carte/liste →
  « remplir si vide » ; **scalaire à défaut non vide** (régime `'micro'`,
  fréquence `'trimestriel'`, entreprise `'ent_1'`) → « remplacer SEULEMENT s'il
  est resté au défaut » — `v => v === DEFAUT ? load(k) : v` — jamais par-dessus un
  choix fait pendant le chargement. Build + 58 audits verts (`audit-tdz` compris).
  Non render-vérifié ici (pas de fixtures) ; sûr par construction (la garde ne
  remplace jamais une saisie). ⚠️ Reste `vinted_account_labels` lu EN LECTURE
  SEULE dans un second composant (`const [accountLabels]=useState(…)`, pas de
  setter) : cosmétique (affichage froid jusqu'au remontage), non destructif —
  laissé tel quel.


### L'extension prévient l'app de ce qui a VRAIMENT eu lieu (4 octobre, 5.155)
Aucune requête Vinted de plus ; tous les garde-fous du §3 inchangés.
- **Achats** : une écriture d'`orders_purchased` qui ABOUTIT (voie passive
  `storeHarvest` et active `storeHarvestRow`) envoie `maj · achats · uid` —
  comme `maj · ventes`. Écriture ratée ⇒ rien.
- **Code de retrait** : `noterRetrait(r, uid)` envoie `maj · retrait · uid · tx`
  uniquement si un code NEUF a été écrit ET accepté. Elle rendait `true` même
  quand l'écriture échouait (le journal disait « code récupéré » sur un code
  rangé nulle part). Un seul endroit pour les trois chemins (conversation
  passive, `capterRetraits`, direct).
- L'app les écoute (`vrm:ext`) : `achats` relit les achats en silence, `retrait`
  relit `panel_colis_relais` — un code lu dans une conversation apparaît sans
  recharger.
- **Capture plus pauvre refusée sur la voie active** : comptée
  (`ignore_partiel_actif_<type>`, même famille que `ignore_partiel_<type>`),
  elle se taisait.
- **« Relis mes ventes »** : `rafraichirVentes` rend `{ok, ecrit, raison}`
  (`compte · lecture · aucune · plus-pauvre · ecriture`) au lieu de `true` sans
  rien écrit. Lecture « ratée » = Vinted n'a rendu AUCUNE page (`pagesLues`), pas
  une liste vide. La commande `ventes` suit la forme de `bordereau` : accusé
  `file` + `jobId = ventes:{uid}`, puis `fait` · `rien` (avec la raison) ·
  `echec` dans `vrmCmds`. La garde des 90 s est **relâchée** sur un échec
  (lecture ou écriture : la demande suivante réessaie), **gardée** sur un succès
  ET sur un refus « plus pauvre » (sinon un refus durable relirait à chaque
  ouverture d'écran). Même règle pour la visite (`prendreGardeVentes` /
  `rendreGardeVentes`, qui ne relâche que SA marque).
  ⚠️ **Relâcher n'est pas effacer (§3)** : la visite tourne à chaque page
  Vinted — une garde effacée sur un échec DURABLE (jeton mort, base en panne)
  relirait `my_orders` à chaque page. Elle est ramenée à **20 s**
  (`VENTES_REESSAI_MS`), et quand c'est **Vinted qui freine (429/403)** elle
  reste entière (`raison: 'vinted-freine'`).
- **`supabaseUpsert`** : toujours un booléen, mais un refus est noté
  `ecriture_ratee_<famille>_<code HTTP|reseau>` — la famille ne garde que les
  mots de l'id (aucun n° de compte, de transaction, de suivi), jamais le corps.
  UN seul nouvel essai après un **401 sur base cloisonnée**, et seulement si
  `refreshSession` rend un jeton (un seul renouvellement en vol) ; jamais sur un
  5xx ni le réseau (l'écriture a pu passer).
  ⚠️ `noterDiag` n'y est **pas** attendu : `viderTampon` écrit par
  `supabaseUpsert` depuis la chaîne du tampon — l'attendre la bloquerait.
- **`viderTampon` vidait le tampon même quand son écriture échouait** (son
  commentaire disait le contraire) : les compteurs d'un tour partaient avec.
  Il ne vide plus que ce qui est arrivé en base.
- `scripts/audit-evt-extension.cjs` exécute le vrai `background.js` (base à
  état, projection `select=` appliquée) : **47 contrôles, 23 rouges sur
  c117b30**, et **14 mutations sur 14** repassent au rouge (un envoi retiré, la
  garde jamais rendue / effacée / rendue sur un 429, le compteur d'écriture
  retiré, un nouvel essai sur un 5xx, la famille qui laisse passer le n° de
  compte…). `--src chemin` lance l'audit sur une copie mutée.
- Extension **5.155.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` : rien de neuf n'est promis.


### ⚠️⚠️ REVUE DE LA 5.167 : SEIZE CONSTATS, QUATORZE DÉFAUTS REPRODUITS (11 octobre, 5.170)
Deux relecteurs adverses ont REPRODUIT chaque défaut (vrai `background.js` dans le
`vm`, vrai Chromium, app rendue sur données inventées) avant qu'il soit corrigé.
Extension en **5.170.0** : la 5.168 est en production (`main`, autre contenu) et
la 5.169 est prise par le chantier extension (`wf_4d08d5c8`, session adressée,
code périmé) — deux contenus ne portent jamais le même numéro. ⚠️ À la fusion des
deux chantiers, monter encore : ni l'un ni l'autre ne porte le code de l'autre.
⚠️⚠️ **Et `EXT_CAPACITES.enligne` passe de 5.167 à 5.170** : la 5.168 installée chez
lui (production) ne porte pas `relireAnnoncesAutresComptes` — avec le seuil à 5.167,
l'app lui aurait promis « tes autres comptes seront vérifiés à ta prochaine
visite », le défaut le plus coûteux du projet, refait par une collision de numéros.
- ⚠️⚠️ **UN 403 SUR UN SEUL COMPTE FAISAIT MONTER LA PAUSE VINTED À 4 H.** Après
  un échec, le compte réessayait dans 5 min (moins que la pause de 15 min) et
  restait le plus ancien : la première requête partie après CHAQUE pause était
  celle que Vinted venait de refuser — 15, 30, 60, 120, 240 min : **705 minutes de
  pause sur 738** en douze heures, bordereaux et réponses bloqués. C'est la forme
  exacte du §3. ⇒ un 403/429 sur une lecture publique écarte CE compte **24 h**
  (`vrmEnLigneFreins`) ; un **429**, ou un **second** compte freiné dans les 24 h,
  coupe toute la relecture du jour (c'est le lecteur qui est en cause) ; un
  compte en échec récent passe APRÈS les autres (`vrmEnLigneEchecs`).
- ⚠️⚠️ **L'ONGLET POUVAIT QUITTER VINTED PENDANT LA RELECTURE** : `executeScript`
  injecte dans le document COURANT — la page 2 partait CHEZ LEBONCOIN, avec le
  jeton CSRF de Vinted, et un 403 de Leboncoin posait la pause Vinted (prouvé
  dans Chromium). ⇒ l'onglet est revérifié avant chaque requête (sinon un autre,
  ou le service worker) ; la page injectée vérifie `location.hostname` AVANT tout
  `fetch` et rend son origine ; une réponse qui ne vient pas de Vinted vaut
  « rien lu », jamais une pause.
- ⚠️⚠️ **UNE LECTURE « DÉCHIRÉE » PASSAIT POUR COMPLÈTE** : une suppression entre
  la page 1 et la page 2 décale la liste — une annonce TOUJOURS en ligne n'est
  jamais vue, le total baisse d'autant, « lus = total » passait (et avec une
  suppression + une republication, le total ne bouge même pas). ⇒ chaque page
  doit annoncer le MÊME total que la page 1 (`mouvant`, la lecture s'arrête là),
  et à plusieurs pages la page 1 est RELUE à la fin (mêmes identifiants).
- **Le budget** : la relecture était dans la classe des photos — après une
  republication `tickPhotos` vidait le budget et les autres comptes attendaient
  une heure. ⇒ trois étages, total inchangé (20/h) : argent/colis, puis relecture
  (`gardeLecture(…,'enligne')`), puis photos ; la relecture note ce qui lui reste
  (`noterLecturesDues(uid,'enligne',…)`), « pas su » garde sa réserve (3).
- **Lignes illisibles côté extension** : des dressings illisibles (`|| []`) faisaient
  dire « à retirer de Leboncoin » toutes les paires du compte connecté ⇒ `echec`,
  les files ne calculent rien, le disent (`lecturesKO`), et la publication est
  refusée avec la raison. Des lectures publiques illisibles ⇒ dernière connue,
  sinon « pas su ».
- **La règle (`<enligne-regle>`, app = extension)** : une vendue (pour son vendeur)
  que la vue publique montre ouverte RESTE parmi les fermées (elle disparaissait
  de toutes les sorties, preuve de vente comprise) ; une suppression vue en 2xx
  n'est plus annulée par une lecture PUBLIQUE postérieure (la vue publique n'est
  pas mesurée, Vinted ne réutilise pas un identifiant) — le DRESSING de son
  vendeur, lui, fait toujours foi (5.165, `audit-supprimees` inchangé) ;
  `pub = { passu: true }` : sans les lectures publiques, seul un dressing de moins
  de `ENLIGNE_SUR_MS` (30 min = `ENLIGNE_DELAI_MS` : aucune lecture plus récente
  ne peut exister) décide.
- ⚠️⚠️ **« À CONFIRMER » N'EST PAS « PLUS EN LIGNE » POUR LES NUMÉROS.** Le champ N°
  disait « il était sur …, qui n'est plus en ligne — la même paire revient ? » et
  un « oui » SUPPRIMAIT la fiche d'une paire peut-être encore sur l'étagère (son
  prix d'achat déménageait) ; le bandeau ♻️ proposait la même reprise sur un
  simple titre. ⇒ les paires présentes = en ligne + à confirmer dans
  `porteursNum`, `numeroReprises` (`presentesAnnonceIds`) et
  `vinted_nums_physiques` (comme `numDoublons`, §11) ; le dialogue dit « une paire
  le porte PEUT-ÊTRE encore » (Annuler / numéro neuf). `onlineAnnonceIds` reste
  « en ligne » : relier une vente PROUVÉE à une annonce à confirmer est juste.
- **Les chiffres** : « Annonces en ligne » écrit « ≥ N » (ou « — » à zéro) quand
  des annonces sont à confirmer, et `widget_stats.online` part à `null` (le
  widget affiche un tiret, jamais « 0 » sur l'iPhone) ; la liste dépliée du
  tableau de bord porte les N° (elle écrivait « sans N° ») ; sans `numeros`, un
  blanc plutôt qu'un faux.
- ⚠️ **`harvest_{uid}_enligne` n'est pas une capture de SA session** : comptée
  dans « Comptes liés », elle faisait dire « À jour » à un compte figé depuis
  trois jours (en permanence, dès la 5.167), et la réparation automatique levait
  « Refusé par Vinted ». `ligneDeSaSession` l'écarte des deux balayages.
  ⚠️ **Le même lecteur existe tel quel sur `main` (production)** : `main` n'écrit
  aucune ligne `_enligne` (sa 5.168 ne relit pas les autres comptes), mais une
  extension de CE chantier installée face à l'app de production y produirait le
  même faux « À jour » — ce correctif doit partir AVEC l'extension, jamais après.
- **L'écran Leboncoin** dit combien d'annonces sont « à confirmer » au-dessus de la
  file, et n'affirme plus « tu n'as pas encore d'annonce en ligne » quand toutes
  le sont. **La promesse** « vérifiées à ta prochaine visite » (et « une
  suppression sort d'ici tout de suite ») n'est faite qu'à une extension
  CONNECTÉE à CE compte VRM (`connexionExtensionVrm`) ; sinon le geste.
- **Preuves** (§6.1 sur 18880b6) : `audit-enligne.cjs` **101 contrôles, 31 rouges**
  sur 18880b6, et **30 mutations sur 30** rouges (dont `frein`, `coupure`, `tri`,
  `ongletfige`, `hotepage`, `sansgarde`, `relit`, `pagetotal`, `budget2`,
  `dressingsko`, `pubko`, `vendue2`, `supprpublic`, `passupub`) — `_fond-vm.cjs`
  sert maintenant l'URL COURANTE de l'onglet (`chrome.tabs.get`, `location`, une
  requête hors de Vinted notée dans `j.horsVinted`) ; `audit-budget-lectures`
  §6 (2 rouges sur 18880b6). Banc `enligne.cjs` §8–13 et §5/7b révisés : **19
  rouges** sur le build de 18880b6, et **9 mutations de l'app** rouges
  (`SECTIONS=` pour ne rendre que la section concernée).
- ⚠️ **Non mesuré** : ce que Vinted répond vraiment à une lecture publique refusée
  (403 ou 404 ?) ; l'ordre réel du dressing public (une republication en tête —
  la relecture de la page 1 suppose ça) ; le script iOS du widget (absent du dépôt :
  `online: null` doit y afficher un tiret).


### Revue adverse de l'extension (17 octobre, 5.184) — trois défauts reproduits
Chacun REPRODUIT d'abord en exécutant le vrai `background.js` (`_fond-vm.cjs`,
harnais des audits), rouge sur 1872a1a (§6.1, arbre archivé, audit lancé depuis
lui), vert après.
- ⚠️⚠️ **Le plafond de 20 actions/heure cédait à deux gestes simultanés.**
  `compterAction` (et `compterLecture`) faisaient lire-ajouter-réécrire dans
  `chrome.storage.local` sans file : trois réponses lancées ensemble à 19
  actions partaient TOUTES les trois, et quatre gestes sur un budget vide n'en
  notaient qu'UN (la suite de l'heure dépassait encore). Le relais du téléphone
  rend ce cas réel (un geste du téléphone pendant un clic dans l'app). ⇒ une
  chaîne de promesses (`unCompteurALaFois`) sérialise le compte — ce n'est pas un
  tampon de données (§4.9), l'état reste dans le stockage.
  `audit-compteurs-concurrents.cjs` : 4 rouges sur l'avant.
- ⚠️⚠️ **Une marque Leboncoin ratée publiait la paire deux fois.** `markPosted`
  (après une publication réussie) et « Déjà publiée » (`lbcMarque`, `ebayMarque`)
  jetaient le résultat de l'écriture de `vinted_lbc_posted` : base qui hoquette ⇒
  l'app lisait « fait », la paire restait dans la file, et un nouveau « Publier »
  (le téléphone par le relais ne voit pas l'état des jobs) ouvrait un SECOND
  dépôt qui publie tout seul. ⇒ `writePosted`/`markLbcPosted` rendent le vrai
  résultat ; « Déjà publiée » ratée répond `lecture` ; une publication non notée
  garde `nonMarquee` sur sa commande, et `publierDepuisApp` retente la marque au
  clic suivant sans JAMAIS rouvrir de dépôt (`deja-publiee`, même confirmé).
  `audit-publier-app.cjs` : 4 rouges sur l'avant.
- **Relais : « en cours » écrasait « fait ».** `traiterRelais` inscrivait le
  suivi du bordereau AVANT d'écrire « en-cours » : un job rapide (PDF déjà prêt
  chez Vinted) écrivait « fait » pendant que « en-cours » traînait dans une base
  lente, et l'écrasait en arrivant — le téléphone restait « En cours sur ton
  ordinateur… ». Et « pdf » puis « fait » partaient en parallèle. ⇒ « en-cours »
  d'abord, puis le suivi, puis l'état relu (un job déjà fini est relayé) ;
  `relaisSuivreJob` passe ses étapes une à une. `audit-relais.cjs` §10 : 3 rouges
  sur l'avant.
- Cherché sans rien trouver de confirmé : helpers hors portée (balayage Babel de
  tous les fichiers de l'extension : 0), balayages non paginés (tous bornés par
  compte), lire-fusionner-réécrire sans garde de lecture ratée (tous gardés).
- Extension **5.184.0**, zip régénéré, `EXT_ATTENDUE` suivie. Aucune entrée
  d'`EXT_CAPACITES` : des corrections.


### Ce que sait faire l'extension dépend de SA version — `EXT_CAPACITES`
Le défaut le plus coûteux du projet (l'app promet ce que l'extension installée
ne sait pas faire) s'est reproduit **trois fois**. Il ne se traite pas au cas par
cas : l'app tient **une table**, chaque capacité portant **la version où elle est
arrivée** — vérifiée commit par commit sur `manifest.json`, pas devinée.

| capacité | fonction de l'extension | arrivée en | ce que l'app promet |
|---|---|---|---|
| `codes` | `capterRetraits` | **5.45.0** (27 août) | « l'extension va chercher les codes toute seule » |
| `releve` | `capterReleves` | **5.52.0** (5 sept.) | « l'extension récupère le relevé à ta prochaine visite » |
| `places` | `mpChoisi` | **5.54.0** (11 sept.) | « seules les annonces cochées partent sur Leboncoin » |
| `ebay` | `buildEbayData` | **5.55.0** (12 sept.) | « l'extension prépare tes annonces sur eBay » |
| `lbctitre` | `lbcTitre` | **5.55.4** (12 sept.) | « le titre exactement tel qu'il partira sur Leboncoin » |
| `photoslbc` | `photosEnOctets` | **5.58.0** (13 sept.) | « photos attachées au formulaire Leboncoin, rien sur ton ordinateur » |
| `photosebay` | `photosPourEbay` | **5.59.0** (13 sept.) | la même promesse, pour eBay |
| `repond` | `repondreAuxMessages` | **5.77.0** (19 sept.) | « elle répond aux questions posées sur tes annonces » |
| `commande` | `executerCommande` | **5.129.0** (2 oct.) | « Générer le bordereau » depuis l'app : l'app COMMANDE l'extension |
| `publication` | `publierDepuisApp` | **5.130.0** (3 oct.) | « Publier sur Leboncoin » / « Préparer sur eBay » depuis l'app |
| `lbcdate` | `dateVenteLbc` | **5.131.0** (3 oct.) | « ouvre Mes transactions, l'extension relève la date de vente » |
| `versement` | `capterDatesVersement` | **5.133.0** (3 oct.) | « l'extension va chercher la date de versement de tes ventes finalisées » |
| `messagerie` | `executerPourApp` | **5.135.0** (3 oct.) | lire un fil, accepter/refuser/faire une offre depuis l'app |
| `lbcpdf` | `pdfBordereauLbc` | **5.136.0** (3 oct.) | « 🖨 Imprimer le bordereau » Leboncoin, tamponné du titre et du N° |
| `lbcmsg` | `storeLbcMessages` | **5.153.0** (4 oct.) | Leboncoin → Messages : « l'extension relève tes non-lus, compte par compte » |
| `vestiaire` | `storeVcRecon` | **5.154.0** (4 oct.) | Vestiaire : « ouvre Vestiaire dans ce Chrome, l'extension apprend à le lire » |
| `vcmessages` | `rangerVcMessages` | **5.238.0** (27 oct.) | « elle relève le nombre de messages non lus Vestiaire en passant » |
| `vcachats` | `rangerVcAchats` | **5.239.0** (27 oct.) | « elle lit tes achats Vestiaire en passant » |
| ~~`detourage`~~ | `detourerPhotos` | ⛔ retiré de la table le 17 oct. (5.185) | Leboncoin/eBay ne détourent plus ; Vestiaire seul (`photosPourVestiaire`), sans réglage ni promesse |
| `supprimees` | `noterSuppression` | **5.165.0** (11 oct.) | « une suppression faite sur vinted.fr dans ce Chrome sort d'ici tout de suite » |
| `enligne` | `relireAnnoncesAutresComptes` | **5.170.0** (11 oct. — les 5.167/5.168 de production ne la portent pas) | « tes autres comptes sont relus à ta prochaine visite sur Vinted, sur n'importe lequel de tes comptes » — et seulement si l'extension est connectée à CE compte VRM (revue, 5.170) |
| `preuves` | `capterPreuvesVente` | **5.172.0** (11 oct. — ni la 5.167, ni la 5.168, ni la 5.170 publiées ne l'ont ; la 5.169 et la 5.171 sont prises par d'autres chantiers) | « l'extension lit toute seule la transaction des ventes en cours pas encore reliées (anti double vente) » |
| `relais` | `traiterRelais` | **5.183.0** (16 oct. — la 5.182 publiée par main, fiche Leboncoin, ne l'a pas) | « sur le téléphone : actions via ton ordinateur » (le relais lit le signe de vie, pas le pont) |
| `lbcpack` | `noterPackPhoto` | **5.185.0** (17 oct.) | « l'extension voit si tu as un pack photo Leboncoin » (`lbc_pack_photo`) |
| `vcpublier` | `publierVestiaire` | **5.235.0** (27 oct.) | « Préparer sur Vestiaire » depuis l'app |
| `annulee` | `purgeBordereauxAnnules` | **5.185.0** (17 oct.) | « le bordereau d'une vente annulée part tout seul » |
| `liaison` | `demanderLiaison` | **5.171.0** (11 oct. — la 5.170 de production ne la porte pas) | « je connecte l'extension à ton compte VRM — rien à taper » (session adressée) |
| `etatcompte` | `noterEtatCompte` | **5.181.0** (16 oct.) | « compte actif / banni par Vinted » relevé par l'extension (`panel_comptes_etat`) |
| `lbcfiche` | `appliquerAnnonceLbc` | **5.182.0** (16 oct.) | publier sur Leboncoin l'annonce CORRIGÉE dans la fiche de VRM (titre, prix, état, photos, description) |
| `confirmer` | `capterConfirmations` | **5.204.0** (21 oct.) | « relever les colis à confirmer (« Tout est OK ») avant leur date limite » |
| `retraitnotif` | `envoyerNotifsRetrait` | **5.204.0** (21 oct.) | « te prévenir quand elle lit un code de retrait dans une conversation » |
| `suivivinted` | `capterSuivisAchats` | **5.217.0** (24 oct. — ni la 5.214.0, ni la 5.215.0, ni la 5.216.0 publiées par `main` ne l'ont ; la table disait 5.216.0, le code dit 5.217.0) | « l'extension relève le suivi Vinted de tes achats » — seulement connectée à CE compte VRM, seule, au code à jour (revue du 24 oct.) |
| `transp` | `transpTick` | **5.291.0** (30 oct. — aucune version publiée ne l'a ; 5.290 était un numéro de branche) | « l'extension lit le statut chez le transporteur à la place du serveur quand celui-ci est refusé » |
| `lbcsupprime` | `supprimeLbcDepuisApp` | **5.291.0** (30 oct. — 5.288 était un numéro de branche) | « Supprimer de Leboncoin » depuis VRM, sur son clic et confirmé |
| `lbcstats` | `noterStatsAnnonceLbc` | **5.291.0** (30 oct.) | « favoris, vues et messages relevés sur tes annonces Leboncoin » |
| `favorisouvrir` | `ouvrirFavoriNatif` | **5.225.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |
| `favorisliste` | `lirePageFavoris` | **5.218.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |
| `favoris` | `executerMessageFavori` | **5.217.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |
| `offresauto` | `autoAccepterOffres` | **5.234.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |
| `vcauto` | `rangerVcAnnonces` | **5.236.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |
| `vcventes` | `rangerVcVentes` | **5.237.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |
| `republier` | `republierVinted` | **5.240.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |
| `republiermodif` | `corpsAvecPrixBaisse` | **5.247.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |
| `recreer` | `recreerVinted` | **5.248.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |
| `lettre` | `recreerVinted` | **5.250.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |
| `brouillon` | `publierBrouillon` | **5.251.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |
| `versbrouillon` | `recreerVinted` | **5.253.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |
| `republierbrouillon` | `recreerVinted` | **5.254.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |
| `refaire` | `refaireBrouillon` | **5.255.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |
| `republierpage` | `vintedPage` | **5.277.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |
| `republierfile` | `miseEnLigneTick` | **5.279.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |
| `favorisperso` | `erreurVariablesFavori` | **5.281.0** | (ligne ajoutée le 30 oct. : la table ne la portait pas — voir la section du jour de son arrivée, et `audit-coherence`) |

⚠️ **DEUX SEUILS POUR UNE MÊME NOTION, EXPRÈS.** Les photos s'attachent côté
Leboncoin depuis la 5.58 et côté eBay depuis la 5.59 : un seul seuil aurait
menti dans un sens (promettre à une 5.58 que ses annonces eBay partent avec leurs
photos — le défaut le plus coûteux du projet) ou dans l'autre (réclamer une mise
à jour qui ne change rien, ce que le dossier interdit aussi). Et comme
`audit-coherence.cjs` exige qu'une capacité cite une **fonction** de
`background.js`, le pont eBay passe par `photosPourEbay` — une ligne de pont ne
se date pas, une fonction si. `MP_PLACES` porte `capPhotos` place par place.

`extSait(quoi)` rend **trois états** — `absente` (téléphone, autre navigateur) ·
`retard` · `ok` — et **jamais deux**. Une extension **muette** sur sa version est
antérieure à la 5.26 (le pont l'annonce depuis) donc antérieure à tout : elle
compte comme `retard`. **« Pas su » ne vaut pas « oui ».**

⚠️ **Le seuil est la version d'ARRIVÉE, jamais la dernière publiée.** Premier
jet : `EXT_LIT_LES_CODES = '5.52.0'` — or `capterRetraits` date de la 5.45. Une
5.48 installée sait très bien lire les codes, et l'app lui aurait dit « celle
installée ne sait pas encore » : **faux dans l'autre sens**, et il aurait cherché
une mise à jour qui ne change rien. `audit-coherence.cjs` vérifie les deux sens :
la fonction citée existe encore dans l'extension, et le seuil est **atteignable**
(≤ manifeste — un seuil plus haut ne s'afficherait jamais).

⚠️⚠️ **ET `audit-coherence.cjs` NE POUVAIT PAS ÉCHOUER.** Il imprimait des ❌ et
sortait **toujours en 0** : le balayage `for f in scripts/audit-*.cjs` le comptait
vert quoi qu'il arrive. Prouvé en cassant `EXT_ATTENDUE` à 9.99.9 — « ❌ version
d'extension attendue » à l'écran, code de sortie 0. §8 annonçait pourtant « il
vérifie que la constante suit le manifeste » : il le **racontait**. Un contrôle
qui ne peut pas échouer est **pire qu'absent — il rassure**. Il compte
maintenant (`ko`/`dit`) et sort en 1.

⚠️⚠️ **ET LA LIGNE DES PLACES ÉCRIVAIT LA MÊME PHRASE DEUX FOIS.** Vu au rendu
le 13 septembre, sur l'écran Annonces : Leboncoin et eBay portaient chacun
« *Ton choix est enregistré. C'est l'extension, dans ton Chrome, qui prépare
ensuite chaque annonce sur X — ouvre l'app sur l'ordinateur où elle est
installée.* » — **150 caractères écrits deux fois**, dont seul le nom de la place
changeait, et il est déjà dans le titre de la ligne juste au-dessus. C'est §7 mot
pour mot (les 13 × « code pas encore reçu », les 14 × « l'extension le
récupère »), sur l'écran où il coche ses annonces. La phrase commune se dit
**une fois au-dessus des lignes** ; sur la ligne il ne reste que ce qui
distingue.
- ⚠️ **On juge sur la PHRASE RENDUE, pas sur l'état** : deux places « en retard »
  ne réclament pas la même version (5.54 et 5.55), donc leurs phrases
  **distinguent** et restent sur leur ligne. Fusionner sur l'état aurait donné
  une seule consigne, fausse pour l'une des deux. D'où une clé qui porte tout ce
  qui varie.
- Le banc `capacites.cjs` **cherche la répétition**, pas une formule — un
  contrôle posé sur le libellé serait vert le jour où quelqu'un reformule
  (§6.5). Et il exige **les deux moitiés** : aucun doublon **et** les deux places
  toujours nommées — un contrôle qui n'aurait que la première serait vert sur un
  écran qui a perdu eBay.
- ⚠️⚠️ **ET MON PREMIER JET DE CE CONTRÔLE NE POUVAIT PAS ÉCHOUER.** Il exigeait
  deux phrases **identiques** — or les deux lignes différaient d'un mot (« sur
  Leboncoin » / « sur eBay »). **Vert sur le défaut**, donc *pire qu'absent : il
  rassurait* (même famille que le `DIST` absolu des quatorze bancs et
  qu'`audit-coherence.cjs` qui sortait toujours en 0). Ce qui se répète n'est pas
  la phrase exacte mais sa **substance** : on mesure le plus long morceau de
  texte **commun** à deux phrases rendues, et **60 caractères identiques** valent
  une phrase écrite deux fois, quel que soit le mot qui change au milieu.
  **2 échecs** sur le code d'avant, 0 après — et le message cite le morceau
  répété. *Un contrôle se vérifie sur le code d'AVANT, toujours, même quand la
  règle paraît évidente.*

⚠️ **Le bandeau se pose UNE fois, pas sur chaque carte.** Les 43 cartes
d'Annonces portent chacune le champ « Min. accepté » ; la phrase qui dit que
l'extension ne l'appliquera pas vit **au-dessus de la grille**, et seulement si
**au moins un plancher est posé** (mesuré le 8 septembre : **0 sur 329**) — sinon
c'est du bruit permanent. Elle dit **combien**, pour qu'il puisse le vérifier.
Le compte vient de `annStats` (§11 : même base que la grille, un seul
propriétaire), pas d'un second calcul.


### Le zip de l'extension — le défaut le plus coûteux du projet
Pendant des semaines l'app a dit « ton extension est en retard, mets-la à
jour », alors que **le zip de cette version n'existait nulle part** : le
manifeste était en 5.52.0, le seul zip du dépôt datait du 30 août en 4.13.0, et
l'app n'offrait **aucun lien de téléchargement**. Pire, la consigne disait
« clique sur ⟳ dans chrome://extensions » — or ⟳ recharge le **dossier du
disque**, donc la même vieille version. Il ne pouvait pas mettre à jour, quoi
qu'il fasse — et tout ce que l'app lui promettait ensuite (les codes de retrait
lus dans ses conversations) en dépendait.
- Le zip vit dans `public/VRM-extension.zip`, se dézippe en **un seul dossier au
  nom stable** (`VRM-extension`) pour qu'il remplace l'ancien au même endroit.
- `scripts/audit-extension-zip.cjs` vérifie que le zip livré porte la version du
  manifeste, qu'`EXT_ATTENDUE` suit, qu'il tient en un dossier, qu'il contient
  tous les fichiers, que l'app le propose, et qu'aucun zip périmé ne traîne.
- **Après toute modification de `vinted-sync-extension/`, régénérer le zip.**


### L'extension sur tous les navigateurs qui l'acceptent, et sur Android (18 octobre, 5.188)
Julien : « si on doit la publier elle doit marcher sur tous les moteurs de recherche qui acceptent et sur téléphone ».
- **Deux paquets** (`zip-extension.cjs --store … --firefox …`) : Chromium (Chrome, Edge, Opera, Brave — le manifeste de la source tel quel) et Firefox ordinateur + Android (`manifesteFirefox` : page de fond `background.scripts`, `browser_specific_settings.gecko` id `vrm@vrm.center` — DÉFINITIF —, Firefox 128 min, `data_collection_permissions`, `gecko_android`, sans `externally_connectable`). Même code octet pour octet ; `scripts/extension-firefox/compat-firefox.js` en tête de chaque script non-MAIN et de la fenêtre : si `chrome.*` ne rend pas de promesse, un appel sans rappel part sur `browser.*`, un appel avec rappel et les écouteurs restent sur `chrome.*` ; sur Chrome il ne fait rien. `web-ext lint` (le validateur d'AMO) : **0 erreur, 0 avertissement** (les 6 `innerHTML =` passent par `poserHtml`, DOMParser, valeurs toujours par `esc`).
- **La liaison sans canal adressé** : sous Firefox la page n'a pas `chrome.runtime`. `versExtension` passe alors par le pont (`vmrDemandeUn('adresse', {ext, msg})`) ; `bridge.js` ne relaie que si `ext` est SON identifiant ; le fond (`action:'adresse'`) exige l'origine de l'app et appelle les MÊMES `demanderLiaison` / `recevoirSessionAdressee` / `deconnexionAdressee` (nonce 2 min, une fois, compte annoncé). L'ancien message `session` de la page reste refusé. `ID_EXT` accepte les identifiants Chrome et Firefox (aussi pour `?lier-extension=`). Chrome garde son canal, inchangé.
- **Téléphone** : un téléphone dont l'extension répond (Firefox Android) agit ICI (`raisonExtGlobale` : `sansSouris && !vmrExtPresent()` ; le relais s'éteignait déjà dans ce cas). iPhone : toujours le relais. Les bancs « TÉLÉPHONE » de `pont.cjs` servent désormais un iPhone SANS extension (avant : un pont qui répondait sur un téléphone — une forme impossible jusqu'ici).
- **Premiers pas selon le navigateur** (`src/navigateurExtension.js`) : `LIENS_BOUTIQUES` (vides tant que les fiches ne sont pas validées — jamais un lien deviné) ; lien rempli ⇒ « Installer depuis la boutique » ; Firefox sans lien ⇒ « pas encore en ligne, ouvre vrm.center dans Chrome/Edge/Brave/Opera » (le zip est un paquet Chromium, Firefox ne l'installe pas) ; Safari ⇒ pas accepté. Texte « l'extension ne répond pas » : `about:addons` sous Firefox, `edge://extensions` sous Edge.
- Preuves : `audit-extension-navigateurs.cjs` (43 contrôles ; **16 rouges sur 526a6c1** ; mutations « pont qui relaie sans regarder l'identifiant » et « compat absente des scripts de contenu » ⇒ rouges ; le fond SANS la compat dans un Firefox imité ne lit plus son stockage) ; `_fond-vm.cjs` option `firefox` (chrome à rappels seuls + browser à promesses) ; banc `pont.cjs` « FIREFOX » + « FIREFOX POUR ANDROID » : **5 rouges sur le build de 526a6c1**, vert après.
- ⚠️ **Non mesuré** : un vrai Firefox (bloqué d'ici) — le premier essai sera chez Julien ; Edge pour Android (extensions pas ouvertes à tous). Gestes de Julien : `docs/boutiques-extension.md` (comptes Edge/Opera/AMO gratuits, adresse de contact, puis remplir `LIENS_BOUTIQUES`).


### Fiabilité de l'extension, mesurée chez lui (19 octobre, 5.193)
**Mesuré** (lecture seule, `panel_diag_capture`, extension installée **5.188**,
captures du 17-18 oct. sur 7 comptes) : `ecriture_ratee_vinted_accounts_400` ×82,
`ecriture_ratee_harvest_{txn,conv,inbox,seen_urls,profile}_400` (~40),
`forme_inconnue_champ_conversation` ×246 avec `cles=[code,message,message_code]`,
`conversation_lecture_ou_forme_ratee` ×206, `photos_page_refuse_429` ×15,
`label_ko_statuts_200_200_200` ×32 (Vinted répond sans URL : pas un défaut de code).
Quatre défauts, reproduits sur le vrai `background.js` (`audit-fiabilite-fond.cjs`,
22 contrôles, **14 rouges sur la 5.192**, `--prouve` : 5/5 mutations rouges) :
- ⚠️⚠️ **Base cloisonnée, session VRM morte ou en pause ⇒ écriture vouée au 400.**
  `withOwner` sans `owner`, clé publique, cible `id`/`vinted_user_id` (aucun index
  unique) : la capture perdue, une requête pour rien. Et la session était relue
  par ligne puis pour l'en-tête (un renouvellement en route mélangeait `owner` et
  clé publique). `supabaseUpsert` lit la session UNE fois ; cloisonnée sans
  session ⇒ rien ne part, diagnostic `ecriture_ratee_<famille>_sans_session`, et
  le logo dit « ta session VRM n'a pas pu être renouvelée » (plus « ça réessaie
  tout seul »). `null` (pas su) garde le comportement d'avant.
- **Un refus de Vinted (`code ≠ 0` + `message_code`) n'est plus une capture**
  (`estErreurVinted`) : ni fausse alerte « Format d'un site », ni ligne rangée, ni
  recul de la base dans la moisson ; compté `ignore_erreur_vinted_<type>`.
- **`vinted_item_details` : une écriture à la fois** (`unItemDetailsALaFois`) —
  la capture photo réécrivait la ligne depuis sa copie du début de boucle et
  EFFAÇAIT une fiche rangée entre-temps (page ouverte, clic « Publier ») ; deux
  `saveItemDetail` simultanés aussi. Elle relit au moment d'écrire et ne pose que
  ses fiches ; relecture ratée ⇒ rien écrit, les annonces seront relues.
- **Capture photo : un 429/403/401/coupure ne pose plus le mémo de 6 h**
  (`memoApresEchec`, la règle des codes de retrait) et arrête la boucle.
- ⚠️ Onze audits servaient une base « cloisonnée » (sonde de schéma à 200) **sans
  session** — une forme où la production répond 400 (§6.3) : ils fournissent
  maintenant une session (`ctx.authToken`).
- **Geste de Julien** : installer la 5.193 (remplacer le dossier, puis ⟳ dans
  chaque Chrome) ; s'il voit « session VRM n'a pas pu être renouvelée » sur le
  logo, cliquer le logo pour se reconnecter.

