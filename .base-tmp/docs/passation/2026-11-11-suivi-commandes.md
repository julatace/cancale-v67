# 11 nov. — Lot `suivi-commandes` : les n° de suivi sur les commandes en cours, et leur cohérence

Branche `claude/suivi-commandes` (depuis `claude/colis-a-leur-place`, DJ3, + `claude/retraits-fiables`).
Pas de PR : la session principale intègre.

Julien, mot pour mot : « intègre les numéros de suivi sur les commandes en cours, comme ça tu regardes leur
statut pour voir la cohérence ; est-ce que tu regardes les infos de suivi ? ».

Extension : **rien changé** (aucune version). Fonctions `api/` : aucune ajoutée (12/12).


## ⚠️ EN TÊTE — La ligne de suivi compacte (capture de Julien en production, Achats, ordinateur)
Julien : « c'est nul, le logo prend toute la page, c'est moche, je veux que tout soit mieux ; si tu peux mettre le
numéro de suivi à côté de chaque achat ce serait top ». Avant : une puce grise PLEINE LARGEUR, le logo Mondial
Relay centré, puis la phrase du transporteur sur trois lignes.
- **Maintenant** (`LigneSuivi`, src/SuiviCommande.jsx + src/design/suivi-ligne.css) : UNE ligne de 24 px au plus,
  13 px gris — `[logo 18 px] Mondial Relay · N° 30000201 ↗ · Pris en charge · Lieusaint · il y a 47 min ›`.
  Le n° se copie d'un tap (cible de 44 px au doigt par un bord invisible, le dessin reste fin), « ↗ » ouvre la page
  publique du transporteur, « › » déplie la phrase EXACTE du transporteur (et sa source). Au téléphone (colonne
  ≈ 230 px) : deux lignes fines (le n°, puis le statut entier ; l'heure dans le détail) — jamais « P… ».
- **Sur CHAQUE achat qui a un n° prouvé** (Payé, en route, livré, finalisé) ; aucun n° ⇒ aucune ligne. Plus de puce
  grise ni de logo agrandi dans Achats. Même ligne dans Ventes · Envoyés (et l'incohérence d'À envoyer).
- « Pris en charge · Lieusaint » vient de la phrase du transporteur (`lieuDuLibelle`, `statutCourt`,
  api/_lib/suivi-commandes.js), recopiée en court — jamais devinée ; rien de lisible ⇒ rien.
- Preuves : banc `suivi-commandes` 112 verts (390/1512, clair/sombre : ligne ≤ 24 px — deux fines ≤ 48 px au
  téléphone —, logo ≤ 20 px, 13 px, statut ENTIER, rien ne déborde, n° présent sur l'achat livré, aucune ligne sans
  n°, plus de puce, détail = phrase exacte, cible au doigt) ; sur la tête d'avant (5fdd506) : 28 rouges.
  `audit-suivi-commandes` 59 verts. Captures regardées.

## Réponse à sa question : oui, et maintenant aussi pour ses ventes

Avant : les ACHATS étaient lus chez le transporteur jusqu'au bout (`transp_`) ; les VENTES ne l'étaient que
jusqu'à la prise en charge (`depart_`, lot du 8 nov.), puis plus jamais.

### Pourquoi les n° SORTANTS sont exclus de `suivisAInterroger` (historique, 8 nov.)
1. **Le cloisonnement de « à retirer »** : une ligne `transp_` nourrit « À retirer », le widget, le rappel du
   matin et les notifications. Un colis VENDU arrivé au relais de l'ACHETEUR serait devenu « à retirer » chez
   Julien, avec une notification. D'où des lignes À PART, `depart_{transporteur}_{n°}`, que rien de tout ça ne
   lit (`ligneTranspDeMeta` n'accepte que `transp_`).
2. **Mondial Relay** : sa seule route lisible (`_mvc`) exige le code postal du point de DESTINATION — celui de
   l'acheteur, que VRM ne connaît pas et ne devine jamais.

La raison 1 n'interdit pas de lire plus longtemps : elle impose la voie sûre, qui existe déjà. **Décision** :
on garde `depart_` et on la prolonge jusqu'à la fin du colis. `suivisAInterroger` (les achats) n'est pas touché.
La raison 2 tient toujours : un colis vendu par Mondial Relay ne se lit pas chez le transporteur ; sa carte
le dit (« Mondial Relay ne se lit pas pour un colis vendu. Vinted et les e-mails font foi. »).

## Ce qui change pour lui

| où | quoi |
|---|---|
| Ventes · Envoyés | chaque colis en cours : `N° XW…` (un tap = copié), « Suivre ↗ » (page publique), le dernier statut lu, sa source et l'heure : « En transit · Lyon · hier 18:02 — lu chez Chronopost il y a 2 h ». Une incohérence prouvée : un encart ambre, une phrase + un geste. |
| Ventes · Envoyés | + les ventes Vestiaire « envoyée » / « en contrôle » qui portent un n° (avant : absentes d'Envoyés). |
| Ventes · À envoyer | seulement « Bordereau imprimé, pas encore déposé. Limite demain. » (prouvé). |
| Achats (en route) | le n° copiable, « Suivre ↗ » et l'incohérence ; le statut reste dit une fois par la ligne du transporteur. Au relais ⇒ « À retirer » (lot `retraits-fiables`), rien ici. |
| Ma journée | « N commandes à vérifier » (ambre, « 2 ventes · 1 achat »), « Voir » ⇒ Ventes · Envoyés (ou Achats). |

## La règle — `api/_lib/suivi-commandes.js` (pure, §11)
- `dernierStatut({ transporteur, email, vinted, sens })` : la source dont l'ÉVÈNEMENT est le plus récent ;
  à égalité, le transporteur. Vinted sans date d'évènement (l'état de la transaction ne date pas le colis :
  `status_updated_at` est celui de la transaction) dit son texte et « lu sur Vinted il y a … », ne passe
  devant personne, et n'affiche jamais une heure inventée. Rien de lu ⇒ `null` (« Statut pas encore lu »).
- `incoherencesVente` : `pas-pris` (noté déposé / Vinted dit envoyé depuis ≥ 3 j, lecture du transporteur
  RÉUSSIE de moins de 24 h et faite après ces 3 j, pas de prise en charge) · `livre-pas-finalise` (livré/retiré
  ≥ 3 j, Vinted lu APRÈS ces 3 j et pas finalisé — 220/≥ 430 = « pas su », jamais une incohérence) ·
  `imprime-pas-depose` (imprimé daté, lu après l'impression, pas pris, limite LUE dans l'e-mail aujourd'hui ou
  demain ; une limite estimée ne compte pas) · `retour` (le colis revient, Vinted ne le dit pas) · `incident`
  (jamais « a quitté le relais » : c'est le relais de l'acheteur).
- `incoherencesAchat` : `pas-depose-vendeur` (étiquette créée ≥ 3 j, lecture fraîche) · `retour` · `incident`.
  « Livré, pas confirmé » côté achat n'est PAS ici : c'est le chantier « à confirmer » (`capterConfirmations`).
- `estEnCours` : livré, retiré, rendu ou finalisé ⇒ sort des « en cours » (la carte n'en garde que
  l'incohérence, ex. « livré, Vinted pas finalisé »).
- `lienPublic` : InPost ⇒ Mondial Relay, Shop2Shop/Pickup ⇒ Chronopost, La Poste/Colissimo et UPS ⇒ leur page
  publique (formes stables, **non mesurées d'ici** : le conteneur ne les joint pas), DPD, GLS, Relais Colis ⇒
  une RECHERCHE du n°, dite comme telle (aucune forme mesurée).
- Chaque phrase ≤ 12 mots (contrôlé).

## L'identité (§5)
Le n° vient toujours d'une identité prouvée : le bordereau de SA transaction (`b.suivi`, `email_bord_{tx}`),
la vente Vestiaire (`v.suivi`), le suivi Vinted / la saisie reliée d'un achat (`suivisAchat`). La carte lit la
ligne du MÊME n° normalisé ; jamais un titre (audit : 50 ventes au même titre, une seule dit « Lyon » ; banc :
deux ventes au même titre, seule celle dont le n° est lu porte le statut transporteur).

## Le serveur — `api/_lib/depart-colis.js`, `api/_lib/transporteurs-lecture.js`
- Pris en charge ⇒ relu toutes les **6 h** (`RYTHME_SUIVI_MS`) jusqu'à `clos` (livré, retiré, rendu, n° mort).
  `fini` garde son sens du 8 nov. (preuve de départ acquise ou n° mort) ; les lignes du 8 nov. déjà `fini`
  avec une prise en charge sont reprises par le suivi.
- Ordre : d'abord les colis PAS ENCORE pris en charge (ils ont une limite d'envoi), les plus anciens d'abord ;
  puis le suivi des partis, le moins récemment relu d'abord. Mêmes bornes (3 par passage de l'app, 6 par cron),
  même file par transporteur, même pause 403/429/défi, User-Agent honnête, aucune redirection, bail 30 s.
- Rangés en plus (scalaires, lus par `meta->>`) : `derLib`, `derLieu`, `derAt` (le dernier évènement),
  `lieuNom`, `lieuVille`, `clos`. Le passage rend `change` ⇒ l'app relit les départs.
- Sortants : + les ventes Vestiaire « envoyée » / « en contrôle » (`etapeMotVc`) avec un n°.
- Toujours aucune ligne `transp_`, aucune notification pour un colis vendu.

## L'app — `src/App.jsx`, `src/SuiviCommande.jsx`
`suiviVente`, `suiviAchat`, `commandesAVerifier` (Comptabilite) ; `vintedDeTx` lit l'état de la transaction
(`TXN_META_SELECT` + `cap:meta->>capturedAt` : une incohérence se fonde sur une lecture DATÉE) ;
`colisVestiaire().envoyees` ; `departsCle` change aussi quand l'état ou le dernier évènement bouge.

## Preuves (§6)
- `npm run build` vert.
- `node scripts/audit-{variables,tdz,coherence,identite,icones,textes-courts,fonctions-api,secrets,csp}.cjs` verts.
- `scripts/audit-suivi-commandes.cjs` — **54 verts** : réponses SIMULÉES Chronopost/Shop2Shop, Vinted Go, Mondial
  Relay/InPost (`_mvc`) passées par les VRAIS analyseurs ; Colissimo/La Poste, UPS, DPD, GLS, Relais Colis jamais
  interrogés, statut par e-mail, lien ou recherche ; chaque incohérence et ses « pas su » ; serveur ; identité ;
  câblage de l'app. Sur l'arbre d'avant (git archive) : **17 rouges**. `--prouve` : **7/7 mutations attrapées**
  (lecture périmée acceptée, lecture d'avant le fait, limite estimée, Vinted lu avant, suivi arrêté à la prise,
  partis d'abord, source la plus fraîche).
- `scripts/audit-statut-transporteurs.cjs` — nouvel essai serveur « (11 nov.) » (faux Supabase + faux
  Chronopost / Vinted Go) : les pas-encore-partis d'abord, relu après 6 h, dernier évènement rangé, pas relu
  avant 6 h, livré ⇒ `change` puis `clos`, plus jamais relu, aucune `transp_`, aucune notification. Vert.
- `scripts/audit-colis-sortants.cjs` : le contrôle « fermée ⇒ jamais » devient « pris en charge ⇒ 6 h ; retiré ⇒
  clos, jamais » (35 verts).
- `scripts/bancs/suivi-commandes.cjs` — 390 tactile et 1512, clair et sombre : **88 verts** (Envoyés, copie,
  44 px, Achats, Ma journée « 3 commandes à vérifier », « pas su » sans incohérence). Captures regardées.

## Reste / non fait
- Leboncoin et eBay : aucun n° de suivi sortant relevé (`lbc_ventes` n'en porte pas ; eBay n'a pas d'étiquette
  avant FULFILLED) — rien à lire, rien inventé.
- Un colis vendu Mondial Relay : jamais lu chez le transporteur (code postal de l'acheteur). Une voie sûre
  future : un code postal LU pour CE colis (ex. la transaction Vinted, s'il y figure un jour — non mesuré).

## Ajouts (fin de journée, demandés par la session principale)
- **« Relier » dépassait de sa carte à 1512 px** (12 px sous la carte, vu par DJ3) : la règle 13.4 de
  `src/styles-premium.css` (le geste prend la colonne de l'état) ne visait plus que l'ancien écran Colis
  (`data-ecran="cat_bord"`) ; elle vise aussi `.vrm-colis-section` (Ventes, DJ3). Banc neuf
  `scripts/bancs/colis-relier-carte.cjs` (chaque bouton DANS sa carte, 390/1512, clair/sombre) : 2 rouges avant
  (« Relier (12 px) » à 1512 clair et sombre), 20 verts après ; captures regardées.
- **Banc `tout-imprimer`** : le contrôle B jugeait les groupes par transporteur de l'ÉCRAN, retirés par décision
  (9 nov., lot AJ : le plus récent en haut, transporteur en pastille). Porté sur la règle actuelle : l'aperçu a trois
  groupes par transporteur, chacun dans l'ordre de l'écran. 26 conformes.
- **`achats-retraits`** (« Peut-être en double · 9 » rend 3, « à vérifier » 0/3) : logique des retraits (lots
  `retraits-fiables` / DJ3), pas celle du suivi des commandes — non touché, signalé.
- **Mondial Relay sans extension** (demande relayée) : le SERVEUR lit déjà Mondial Relay pour les ACHATS (route
  `_mvc`, mesurée le 24 oct., `LECTURE_SERVEUR_TRANSP.mondialrelay = true`) ; l'extension n'est qu'un secours sur
  refus. Pour un colis VENDU, la route exige le code postal du point de l'acheteur. Piste sûre repérée, PAS
  branchée : le code postal imprimé sur SON étiquette Mondial Relay (PDF relié par le n° de transaction, déjà lu
  au cron pour le transporteur), vérifié par l'ÉCHO de la route. Mesure en base demandée (lecture seule, comptes
  seulement) puis interrompue avant d'être approuvée : rien mesuré, rien branché.

| transporteur | serveur | Vinted | e-mail | extension |
|---|---|---|---|---|
| Chronopost / Shop2Shop | oui, achats ET ventes (`cp-ws2`, n° seul) | état de la transaction | oui (même n°) | secours sur refus |
| Vinted Go | oui, achats ET ventes (`vg-v3`, n° seul) | état de la transaction | oui | secours sur refus |
| Mondial Relay / InPost | achats : oui (`_mvc`, CP du point lu) ; ventes : non (CP de l'acheteur inconnu) | état de la transaction | oui | secours (même route, même CP exigé) |
| Colissimo, La Poste, UPS, DPD, GLS, Relais Colis | non (aucune route publique mesurée, aucune clé) | état de la transaction | oui | non |
