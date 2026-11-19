# 19 nov. 2026 — « L'extension, claire et utile » (extension 5.409.0, partagée)

Branche `claude/extension-utile`, partie de `origin/claude/project-review-nsk5su`, avec un VRAI merge de
`origin/claude/extension-claire` (la page Extension de l'app, déjà finie : on bâtit dessus, on ne la refait pas).
Tout ce qui touche l'extension va dans la **5.409.0** (déjà posée par `extension-claire` : manifeste, `CODE_VERSION`,
`EXT_ATTENDUE`). **Zips NON régénérés** (version partagée) : à l'intégration, régénérer `public/VRM-extension.zip`
et le paquet Orion UNE fois, quand tous les chantiers 5.409 sont dedans.

## Ce que Julien a demandé (mot pour mot)
- « je veux que avec l'extension on puisse la mettre où on veut sur l'app, qu'elle capte absolument tout et que ses
  actions empêchent d'être bloqué »
- « je veux que quand je rentre sur l'app, et que l'extension a capté quelque chose, on est informé avec un pop up ;
  là l'extension a des infos à l'intérieur qui ne servent à rien donc améliorer »
- (précisé dans la journée) « Pour les messages aux favoris et toutes les actions […] je veux que l'extension prenne
  tout l'écran, ou une très grosse partie de l'écran sur Vinted […] "Sécuriser le compte" ça sert à rien, tu peux
  enlever l'onglet, et "Tout arrêter". Fais un onglet Messages (très important), Mes annonces / mon dressing, Favoris,
  et Ventes. Dès qu'on clique sur un élément, le grand déroulé s'affiche […] Inspire-toi de Vintex. Pour les messages
  aux favoris, un accompagnement parfait de A à Z »
- (rythme) « 4 min entre les messages c'est peut-être beaucoup, on garde toujours le temps aléatoire »

## 1. La feuille « Depuis ta dernière visite » (app)
- **Source** : celle du toast de la 5.377, `annoncerCapte` (une écriture RÉUSSIE, nouveau PAR IDENTITÉ, jamais au
  point de départ). Le lot de la 5.377 ne vivait que 2 min et ne portait que des NOMBRES : VRM fermé, il était perdu.
  Désormais `annoncerCapteUn` range aussi chaque identité nouvelle dans un journal court (`vrmCapteJournal`,
  chrome.storage.local, 14 jours, 400 entrées) publié dans la ligne DÉDIÉE **`capte_journal_{navigateur}`**
  (`journalCapte`, un seul écrivain par ligne, jamais `main`, écriture sérialisée, la ligne porte toujours la liste
  entière relue). Entrée = `{ p, c, s, id, t }` — jamais un titre, un pseudo, un texte, un montant.
- **Refus et pauses de Vinted** : `noterCarnet` (pause, vérification, prudence, modération, déconnexion) ajoute une
  entrée `refus` (une par heure et par cause).
- **L'app** (`src/capteNotif/arrivee.js` pur, `FeuilleArrivee.jsx`) : à l'ouverture et au retour après 2 min, lit
  `id=like.capte_journal_*&select=id,e:data->e` (petites lignes), fusionne tous les Chrome **par identité**
  (site|compte|sorte|identité), garde ce qui est né après le marqueur « vu », et montre UNE feuille native
  (`Feuille`, `Groupe`, `Rangee`) : un groupe par sorte (refus de Vinted d'abord, puis ventes, codes, bordereaux,
  achats, offres, messages, versements, annonces numérotées, nouvelles annonces), 5 rangées au plus puis « Voir les
  N autres ». **Chaque rangée mène à l'élément** par identité (`api/_lib/lien-notif.js`, le même contrat que les
  notifications : `cible=vente&tx`, `cible=retrait&tx`, `cible=colis&tx`, `cible=achat&tx`, `cible=conv&conv`…).
- **Marqueur « vu »** : ici (`vrm_capte_vu_ici`, localStorage) ET synchronisé (`vrm_capte_vu`, SYNC_KEYS) ; le plus
  récent gagne. Premier passage (aucun marqueur) ⇒ point de départ posé EN SILENCE (pas su ce qui est nouveau).
  « C'est vu » / fermer ⇒ marqueur = l'entrée la plus récente MONTRÉE (ce qui arrive pendant la lecture est dit la
  fois suivante). Un lot dit en direct par le toast (app au premier plan) avance le marqueur : pas redit.
- Rien de neuf, lecture ratée, réglage « Dire ce que l'extension capte » coupé ⇒ rien. Jamais par-dessus une autre
  feuille (elle attend). Compte retiré (`lireComptesExclus`) ⇒ jamais dit.
- Capacité `captejournal: '5.409.0'` (`journalCapte`) dans `EXT_CAPACITES` et `audit-coherence`.

### Mesures sur la vraie base (lecture seule, projections scalaires ; aucune donnée réelle ici)
- Lignes de capture du propriétaire : ~1 400 `harvest_*_txn_*`, ~1 380 `harvest_*_conv_*`, 161 bordereaux, 45 suivis,
  15 comptes avec `inbox` / `orders_sold` / `orders_purchased` (relus à chaque visite).
- Fréquence (date de capture, 10 jours) : 0 à 17 détails de transaction par jour, 0 à 2 bordereaux par jour, des
  conversations par vagues. ⇒ un journal de 400 entrées sur 14 jours suffit largement ; l'écriture n'a lieu QUE
  quand une identité est nouvelle (quelques fois par jour).
- `journal_vrm_*` : **aucune ligne** pour ce propriétaire (« Ce que VRM a fait » n'a rien reçu) — à regarder par le
  chantier qui possède `noterJournal` (pas touché ici). `actions_compte_*` : 12 lignes, `ext_appareil_*` : 6.
- Boîte rangée : `harvest_{uid}_inbox` porte `payload.conversations[]` = `id, unread, updated_at, description,
  item_photos[{url}], opposite_user{id,login,photo}` (300 par compte) — la forme lue par l'onglet Messages.

## 2. La carte (pastille + panneau sur vinted.fr) et la fenêtre de l'icône
### Inventaire avant → après
| ligne d'avant (5.408) | répond à… | après (5.409) |
|---|---|---|
| tête : compte · point · état | « sur quel compte, ça marche ? » | **gardée** (titre du panneau) |
| ligne principale (envoi de favoris en cours, « Arrêter l'envoi ») | « qu'est-ce qui se passe ? » | **gardée** (le geste d'arrêter CETTE action reste) |
| sous-ligne jauge · lu · capté | « qu'est-ce qui vient d'être capté ? » | **gardée** |
| bandeau « Version x disponible » | « que dois-je faire ? » | gardé |
| « Sécurité du compte » + phrase | rien (sa décision : « ça sert à rien ») | **retirée** de l'affichage (les garde-fous restent tous actifs) |
| « Tout arrêter » (lien) | — (sa décision) | **retiré** ; s'il a été posé depuis VRM, « Reprendre les gestes automatiques » reste dans Paramètres |
| Favoris · Annonces · Ventes (3 onglets) | « que dois-je faire ? » | **Messages · Annonces · Favoris · Ventes · Paramètres** |
| Détails : « Compte VRM utilisé », « Compte Vinted », « Tes données » (envois), version | jargon technique | **Paramètres → Détails**, replié |
| Détails : réduire le logo, logo en bas à droite, dire ce que VRM capte, résumé du mois, changer de compte VRM, envoyer un rapport | réglages | **Paramètres** (groupes « Le logo VRM sur ce site », « Ce qui s'affiche », « Réglé dans VRM », Détails) |
| Fenêtre de l'icône : « Diagnostic des favoris » (enregistrer le parcours, rapport JSON) toujours visible | jargon technique | **derrière « Détails »**, replié |
| Leboncoin / Vestiaire : Compte · Annonces · Ventes | « ça marche ? » | inchangé (petite carte) |

### Le grand panneau (sur vinted.fr, connecté, compte de l'onglet reconnu)
- ≥ 76 % de la largeur (1 100 px au plus) à l'ordinateur, **plein écran** au téléphone (≤ 760 px) ; voile sur la page ;
  ✕ et **Échap** ferment. Design natif (NATIF.md : fond #F2F2F7/#000, cartes blanches/#1C1C1E, accent #0068D6 rare,
  rangées 72 avec vignette 56) : les jetons `--vu-*` sont redéfinis DANS le panneau, les pièces existantes suivent.
- À l'ordinateur (≥ 1024) : onglets en **barre latérale** à gauche ; **Messages en deux volets** (liste · conversation,
  « Choisis une conversation » dessiné quand rien n'est choisi), filtre « Non lus · N », recherche. Au téléphone :
  liste empilée, la conversation dépliée sous sa rangée.
- **Messages** : `carteListes` lit maintenant `harvest_{uid}_inbox` (40 conversations les plus récentes, projection
  par index, compte de l'onglet SEULEMENT, aucune requête Vinted) ; « Répondre sur Vinted » ouvre la conversation.
- **Fiche dépliée** (Annonces, Ventes) : toucher une rangée ⇒ photos (jusqu'à 8, défilement), N°, prix, **prix mini
  accepté** (`vinted_annonce_numeros[id].min`), acheté, prix − achat, taille, marque, état, en ligne depuis, favoris,
  vues, description ; « pas su » ⇒ « — ». Gestes : « Ouvrir sur Vinted », « Gérer dans VRM » (les gestes gardés de
  l'app). Ventes : état en mots clairs (« Action requise : à expédier » en ambre, « En route : rien à faire »,
  « Terminée », « Annulée — pas une vente »), bordereau, « Ouvrir la conversation ».
- **Favoris** : les étapes numérotées 1 Choisir · 2 Offre et message · 3 Rythme · 4 Confirmer · 5 Suivi au-dessus
  du parcours de la 5.407, et UNE phrase qui dit quoi faire. Le récapitulatif (étape 4) porte le choix du rythme.
- **Paramètres** : le logo (glisser, « Remettre le logo en place », réduire), ce qui s'affiche, liens vers les réglages
  de VRM (rythme des favoris, notifications, langue), Détails replié.

## 3. « La mettre où on veut »
Déjà là depuis la 5.371 : la pastille se **glisse** (doigt ou souris, au-delà de 6 px), sa place est **gardée par
site** (`vrmBadgePos[vinted|leboncoin|vestiaire|ebay]`, chrome.storage.local), elle s'écarte des barres fixes du site
(`eviterBarres`). Ajouté : la phrase qui le dit et « Remettre le logo en place » dans Paramètres.

## 4. « Capte absolument tout » — ce qui manque encore (par site)
| site | ce que l'app montre | capté ? | raison / suite |
|---|---|---|---|
| Vinted | conversations (texte complet d'un fil) dans le panneau | dernier message seulement | le fil complet n'est lu qu'à l'ouverture d'une conversation ; répondre depuis le panneau demande la même file que les favoris : à faire |
| Vinted | transporteur d'une vente dans le panneau | non | pas rangé dans `orders_sold` ; il est dans le détail de transaction : à joindre par identité |
| Vinted | statut « Brouillon / Masqué / Réservé » pour un filtre à compteurs | partiel | `listings` porte `is_draft`/`is_hidden`/`is_reserved` ; le filtre n'est pas encore bâti |
| Vinted | nouveaux favoris (qui a aimé) dans la feuille d'arrivée | non | les favoris sont lus par la cloche (`favoris_archive`) mais pas annoncés par `annoncerCapte` : petite suite sûre |
| Leboncoin | messages, annonces, ventes | oui (compte de la session) | — |
| Leboncoin | qui a mis en favori | impossible | le site ne le dit pas |
| Vestiaire | ventes, achats, annonces, offres, messages | oui | — |
| eBay | — | API (pas l'extension) | hors de ce chantier |

## 5. « Ses actions empêchent d'être bloqué » — `scripts/audit-actions-gardees.cjs`
- Charge le VRAI `background.js` (`_fond-vm.cjs`), lit le texte compilé de chaque fonction, repère **chaque écriture**
  (`vintedPage`/`vintedSend` non-GET, `vintedPagePhoto`, gestes confiés à un onglet Leboncoin/Vestiaire, `favoriPage`)
  et exige, dans la fonction ou dans **tous** ses appelants jusqu'à la racine, un **compteur** (`compterAction`,
  `garde`, `gardeStricte` — 50/h, réserve 5, plafond du jour, prudence, captcha) **ET** la **sécurité**
  (`secuGeste` — anti-robot, Tout arrêter, repos, plafonds par type). Un appel `lecture: true` / `compter: false` ne
  garde rien. Vérifie aussi que `vintedPage`/`vintedSend` passent par `requeteVinted` (une à la fois, pause 429/403),
  et EXÉCUTE : « Tout arrêter » + 50/50 ⇒ 0 écriture vers Vinted.
- **Trouvé et corrigé (5.409)** : la **réponse Leboncoin** (`repondreLeboncoin`) et la **pause d'une annonce
  Leboncoin** (`pauseLbcDepuisApp`) passaient le plafond mais **pas** `secuGeste` ni le contrôle anti-robot ⇒ ajoutés
  (comme Vestiaire).
- **Exceptions nommées** (chacune vérifiée) : `genererBordereau` (autorisé et automatique, §3 ; file + pause),
  `grilleTailles` (une LECTURE en POST, `gardeLecture`), `finRepubBrouillon` (place réservée au départ de la paire,
  rendue si rien ne part, `secuGeste` avant), `reprendreMessagesFavoris` (place réservée à l'offre,
  `arretAvantMessageFavori` avant).
- Preuves : 12/12 vert ; rouge sur l'arbre de départ (les deux routes Leboncoin) ; `--prouve` **10/10 mutations**.

## 6. Le rythme des messages aux favoris (décision du 19 nov.)
- Par défaut **au hasard entre 40 et 90 s** (à la seconde), **jamais deux fois de suite la même valeur**, PLUS le
  temps d'écriture de l'extension (inchangé) ; « **Plus prudent** » : 2 à 4 min. Tiré par la file serveur
  (`api/_lib/favoris-file.js` `delaiRythme`, déterministe sur le jeton + le temps précédent : une décision rejouée
  tire le même temps). `perso` (ses minutes, ou une file d'avant) reste possible dans l'app.
- Réglage : `src/reglagesFavoris.js` `rythme` ('normal' par défaut, 'prudent', 'perso') ; app : deux nouveaux choix
  dans « Temps entre deux messages » ; carte : choix à l'étape 4, envoyé avec `lancer` (`rythme`), seul 'normal' ou
  'prudent' accepté par l'extension. La durée affichée tient compte des **15 par heure** (au-delà, l'heure d'après).
- **Aucun plafond touché** (15/h favoris et offres, 50/h, réserve 5, 200/jour, prudence 20/h, arrêt captcha).
- `scripts/audit-rythme-favoris.cjs` : exécute la vraie file sur 400 envois (40–90 s, jamais < 40, jamais deux égaux,
  50 valeurs sur 51), prudent 2–4 min, perso inchangé, rejeu, réglages ; plafonds sur le vrai background.js et la
  porte exécutée (15 passent, le 16e attend). Rouge sur l'arbre d'avant (6) ; `--prouve` 5/5.
- **Ligne à reporter dans CLAUDE.md §3** (Messages aux favoris) : « … rythme : **au hasard 40 à 90 s** entre deux
  messages par défaut (jamais deux fois le même temps), « Plus prudent » 2 à 4 min, plus le temps d'écriture —
  décision du 19 nov. (« on garde toujours le temps aléatoire ») ; plafonds inchangés (15/h, 50/h, jour, prudence). »

## Preuves
- Audits verts : actions-gardees (12, 10 mutations), rythme-favoris (16, 5 mutations), traduction, coherence, tdz,
  variables, fonctions-api, quoi-de-neuf, violet, rouge-doublon, extension-feuille, carte-listes, popup-capte,
  carte-extension, extension-ui, garde-fous-capture, discretion, securite-comptes, et les 12 audits favoris.
- Build : vert.
- `scripts/audit-arrivee-capte.cjs` (vrai background.js + règles de l'app) : 14/14 ; rouge sur l'arbre d'avant (3) ;
  `--prouve` 4/4 (journal coupé, doublon, marqueur ignoré, lien sans identité).
- Banc `scripts/bancs/grand-panneau.cjs` (vrai vrm-badge.js + vrm-ui.js, 390 tactile et 1512, clair et sombre) :
  **76/76**, captures regardées (Messages deux volets, fiche dépliée au téléphone, Favoris étape 1 et étape 4 avec le
  rythme, Paramètres). Corrigé après lecture des captures : onglets coupés à 390 (« Mess… »), engrenage sans nom dans
  la barre latérale, lien « Messages › » de la petite carte redit sous le panneau, « N° N° 121 », étapes sur 3 lignes.

## Ce qui reste (honnête)
- Pages **Notifications** (tableau filtrable) et **Automatisations** (messages multiples, ciblage, délais, offres
  auto, baisse auto avec leur état) du modèle Vintex : pas faites dans le panneau (liens vers VRM à la place).
- « Choisir une action » (gestes en série), filtre Statut avec compteurs, liste/grille, choix des colonnes, cases par
  ligne dans Annonces : pas faits.
- Répondre DANS le panneau (il faut le fil complet et la file d'envoi) ; transporteur dans Ventes.
- Langue de l'extension réglable (elle suit la langue du navigateur) : lien vers VRM seulement.
- Banc de RENDU de la feuille d'arrivée dans l'app (390/1512, clair/sombre) : pas écrit — ses règles et le journal
  sont exécutés par `audit-arrivee-capte`, le rendu ne l'est pas encore.
- Banc Orion iPhone du panneau : pas joué (le banc tactile 390 l'approche).
- Régénérer les zips 5.409 à l'intégration.

---

## Suite du 19 nov. (même branche, même 5.409, sans zips)

### 7. Annonces du panneau (modèle « Articles »)
« Choisir une action ▾ » (gestes en série PERMIS : Republier et Baisser le prix ouvrent leurs ateliers GARDÉS dans VRM ;
« Offre à leurs favoris » mène au parcours des favoris de la carte ; « Ouvrir sur le site » pour une seule annonce ;
**jamais de suppression en série**, §3), recherche (titre ou N°), filtre **Statut à compteurs LUS** dans la réponse de
Vinted (`is_draft`, `is_closed`/`item_closing_action`, `is_hidden`, `is_reserved` ; « en vente » seulement par
`<enligne-regle>`, sinon « à confirmer »), **liste / grille**, **Colonnes ▾** (N°, Prix, Prix mini, Acheté, En ligne,
Vues, Favoris, Statut) gardé dans `chrome.storage.local` (`vrmPanneauAnnonces`), cases + « tout ». « Place au
stock » : pas dans ce que la carte lit (reste). Au téléphone : liste empilée, colonnes en ligne sous le titre.

### 8. Automatisations (état LU, jamais écrit d'ici)
Messages aux favoris (versions, rythme, mode auto : délais, plafonds, horaires — lus dans `vrm_favoris_reglages_{uid}`
et la file `favoris_file_*`), offres auto (`vinted_offres_auto`, prix mini posés, message de refus), **négociation par
paliers** (ci-dessous), baisse auto « Bientôt » (pas livrée). « Modifier dans VRM » : l'extension n'écrit JAMAIS
`main` (§5) — les réglages se changent dans l'app (mêmes clés). « Envoyer pas à pas » ouvre le parcours A→Z.

### 9. Notifications (journal capté)
Tableau filtrable (type, statut « nouveau » / « vu » selon le marqueur `vrm_capte_vu`), 7 jours, compte de l'onglet ;
chaque ligne ouvre VRM par identité.

### 10. Ventes : transporteur lu, par identité
`email_bord_*` (n° de transaction → n° de suivi) puis `email_track_*` (n° de suivi → transporteur). Mesuré : 43 ventes
reliées ainsi (39 Chronopost, 4 Mondial Relay). Rien relié, ou « autre » ⇒ aucun transporteur (jamais « inconnu »).
Vestiaire : le transporteur de `vc_ventes`.

### 11. Répondre depuis le volet Messages
`repondreCarte` (fond) : sur SON toucher (`confirme`), seulement une conversation de la boîte RANGÉE du compte de
l'onglet, depuis l'onglet vinted.fr, par le MÊME chemin que la réponse depuis l'app (`executerPourAppCoeur` →
`gardeStricte` : sécurité, 50/h, réserve, pause, compte de l'onglet ; liste blanche `ENDPOINTS_APP`). Capacité
`repondrecarte: '5.409.0'`.

### 12. Négociation des offres par PALIERS, sans IA (décision du 19 nov.)
- Règle pure `src/negociationPaliers.js` ; copie dans le moteur (`palierContreOffre`), comparée sur 13 cas.
- Plancher = prix mini du N° ; sinon prix − remise maximale (%) ; sinon rien. Palier i = prix − (prix − plancher) ×
  pct_i, arrondi à l'euro, jamais sous le plancher, jamais ≤ l'offre. Aperçu « 100 → 93 → 88 → 85 · plancher 85 ».
- Moteur `autoAccepterOffres` : entre le seuil de refus et le prix mini ⇒ contre-offre du palier suivant ; MÊME chemin
  (délai aléatoire 3–20 min, offre RELUE, `secuGeste`, `garde` : compte de l'onglet, 15/h offres, 50/h, réserve,
  pause, captcha ; une à la fois) ; une par palier et par négociation (mémo `vrmContreOffres` AVANT le geste, rendu si
  rien ne part) ; message optionnel (ses versions, jamais la précédente, garde de mots) ; journal `contre_offre`.
  **Éteinte par défaut** (`vinted_offres_paliers.actif`), l'allumer DEMANDE. Réglage : Offres auto → « Négocier par
  paliers ». Capacité `contreoffres: '5.409.0'`.
- « Boost favoris auto » : **non fait** (engagement simulé, refusé).

### 13. Leboncoin et Vestiaire dans le grand panneau
Compte de l'onglet de CE site ; annonces (`lbc_listings`, `vc_listings`) et ventes (`lbc_ventes`, `vc_ventes`) qui
portent CE compte seulement — **celles lues sans compte sont comptées et dites, jamais montrées** (mesuré : 124 des 194
annonces Leboncoin rangées n'ont pas de compte). Ce que le site ne permet pas est dit UNE fois (Leboncoin : pas de
favoris nominatifs ni d'offres ; Vestiaire : « aimés » depuis VRM) ; « Choisir une action » n'y propose ni Republier ni
Offre aux favoris. Messages Leboncoin/Vestiaire : pas recopiés dans le panneau (reste).

### Le journal `journal_vrm_*` vide chez Julien — pourquoi (pas corrigé : ce n'est pas mon fichier)
Aucune ligne n'a jamais été écrite (journal d'écritures de la base : 0), alors que la base l'accepterait (aucun
déclencheur ni règle ne la refuse) : **`noterJournal` n'est appelé que pour un geste ACCEPTÉ par Vinted, et ses lignes
`actions_compte_*` ne montrent presque aucun geste** (0 aujourd'hui sur les Chrome en 5.377–5.408 ; 1 à 2 gestes sur
des lignes écrites par des versions sans champ `v`, d'avant la 5.337 qui a créé le journal). Les écritures de
`actions_compte_*` (342) viennent de la jauge publiée à CHAQUE visite, « 0 compris ».

### Preuves de la suite
- `audit-panneau-carte` : 14/14 (statuts lus, transporteur par identité, automatisations, notifications, réponse
  gardée, Leboncoin/Vestiaire par compte) ; rouge sur l'arbre d'avant (7) ; `--prouve` 6/6.
- `audit-negociation-paliers` : 11/11 (13 cas app = extension, moteur exécuté : éteint ⇒ rien ; 93 → 88 → 85 puis
  rien ; jamais sous le plancher ; journal ; 50/50 ⇒ rien) ; rouge sur l'arbre d'avant (5) ; `--prouve` 5/5.
- Bancs : `grand-panneau` **145/145** (Vinted 1512 et 390 clair/sombre + **Orion iPhone 390**, émulé dans Chromium :
  WebKit n'est pas installé ici), `grand-panneau-sites` **68/68** (Leboncoin, Vestiaire), `feuille-arrivee` **41/41**
  (vrai `FeuilleArrivee.jsx` ; mutations doublon / marqueur ⇒ 12 rouges chacune). Captures regardées ; corrigé après
  lecture : tableau des annonces (grille CSS invalide), « Baisse auto : Pas su » ⇒ « Bientôt ».
- La croix et les chevrons de la `Feuille` native sont vides dans le banc de l'app (les glyphes sont posés par la coque,
  absente du banc) : à vérifier dans l'app réelle.
- Build vert ; audits verts (liste ci-dessus + moteur-offres, offres-sures).

### Reste après la suite
- Interrupteurs des automatisations DANS le panneau (aujourd'hui : état lu + « Modifier dans VRM ») ; ciblage des
  favoris (note minimale, limite par article, période) ; plusieurs messages éditables (✎ 🗑) dans le panneau.
- Masquer / Afficher en série (aucun chemin gardé n'existe encore ; décision 3 = autre chantier).
- Messages Leboncoin / Vestiaire dans le panneau ; baisse auto (décision 1) ; paliers pour Vestiaire.
- Place au stock dans les colonnes.

---

## Troisième passe (19 nov. soir) — après le merge de `claude/prix-sans-manuel`

- **Merge** réel de `origin/claude/prix-sans-manuel` (baisse par règle, masquer « vendue ailleurs », prix en attente) ;
  conflits réglés par UNION : `EXT_CAPACITES`/`audit-coherence` (toutes les capacités 5.409 des deux branches), clés
  synchronisées (`vinted_offres_paliers` + `vinted_baisse_regle` + `vinted_masquer_ailleurs`), « Quoi de neuf » (les
  lignes des deux) ; la page Extension d'`extension-claire` gardée (le bouton profil).
- **Masquer / Afficher** dans « Choisir une action » (Vinted) : `masquerCarte` — sur SON clic CONFIRMÉ (barre de
  confirmation dans le panneau), 10 annonces au plus, chacune du dressing de CE compte, par le geste APPRIS
  (`masquerAppris` ; pas appris ⇒ rien ne part, dit comment l'apprendre), une à la fois (file Vinted), chacune par la
  garde stricte (sécurité, 50/h, pause, compte de l'onglet), état RELU dans la réponse, journal `masquee`/`demasquee`.
  Un masquage À LA MAIN n'entre PAS au registre `vinted_masquees_vrm` (la règle automatique ne démasque jamais ce
  qu'il a masqué lui-même). Capacité `masquercarte: '5.409.0'`.
- **Messages Leboncoin / Vestiaire** : Vestiaire — les conversations rangées (`vc_messages`) de CE compte ; Leboncoin —
  le nombre de non lus de CE compte (`lbc_messages`) et les fils rangés à leur ouverture (`lbc_fil_*`). **Répondre**
  depuis le volet par LEUR chemin gardé (`repondreVestiaire` / `repondreLeboncoin` : recette apprise, compte du fil =
  compte de l'onglet, sécurité, plafond, pause), une conversation de CE compte seulement ; « incertain » n'est jamais dit
  « envoyé ». (Corrigé au banc : l'onglet Messages de ces sites affichait la phrase des annonces.)
- **Baisse automatique sur Leboncoin** : `regleBaisseLbcTick` — la MÊME règle (`vinted_baisse_regle.comptes['lbc:{compte}']`,
  éteinte par défaut, réglée dans l'app sur la fiche du N° → Prix, une ligne par compte Leboncoin), le MÊME plancher
  (prix mini, sinon achat + 10 %) lu sur la fiche du N° que LUI a relié à l'annonce (`vrm_lbc_liens` ; pas de lien ⇒
  pas de baisse), « depuis » = mise en ligne lue ou dernière baisse, 12 par jour ; DÉPOSE une commande `cmd_prix_*`
  exécutée par `prixAttenteTick` → `baisserPrixLbc` (recette, prix relu, sécurité). Capacité `baisselbc: '5.409.0'`.
  **Vestiaire : pas de baisse automatique** — aucune date de mise en ligne n'est lue (jamais inventée) ; dit.
- **Paliers sur Vestiaire : « pas encore »** — l'extension lit et répond aux offres Vestiaire sur SON clic, mais aucun
  moteur ne les traite en continu ; dit dans le panneau (Automatisations du site).
- **Place au stock** : colonne « Place » et ligne de la fiche (« Étagère · 2-2 » = rangée-colonne), lue comme
  `ouDansMeubles` de l'app (`vrm_slots` → `vrm_meubles`, par `cleNum`).
- Automatisations (Vinted) : la baisse par règle de CE compte est maintenant LUE (« −5 % tous les 14 jours sans vente »,
  Activé/Désactivé), plus « Bientôt ».

### Preuves
- `audit-panneau-carte` **27/27** (G masquer : pas appris, sans confirmation, hors dressing, 50/50 ⇒ rien ; 2 PUT
  relus ; pas au registre — H messages et réponse Vestiaire/Leboncoin par compte — I baisse Leboncoin : éteinte, sans
  lien ⇒ rien ; allumée ⇒ 100 → 90 déposée — J place) ; `--prouve` **11/11** ; rouge sur l'arbre d'avant.
- Bancs : `grand-panneau` **155/155** (Masquer : confirmation puis `confirme`, résultat dit), `grand-panneau-sites`
  **80/80** (Messages Leboncoin et Vestiaire, réponse Vestiaire), captures regardées.
- Build vert ; audits verts (traduction, coherence, tdz, variables, extension-feuille, actions-gardees, carte-listes,
  negociation-paliers, quoi-de-neuf, regles-auto, prix-attente, fonctions-api).
