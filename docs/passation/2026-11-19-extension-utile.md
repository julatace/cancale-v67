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
