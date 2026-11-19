# 19 nov. — « Aujourd'hui », propre et utile (branche `claude/aujourdhui-propre`)

## Ce que Julien a dit (19 nov., mot pour mot)

1. Une capture de son iPhone, puis : « ça ne me convient toujours pas, je veux que tout soit beaucoup mieux, le
   visuel de l'app doit être absolument parfait ».
2. Deux captures de la liste « À faire » : « honnêtement tout ça ne sert à rien, ça doit être rangé dans les onglets
   dédiés justement à ça. Par exemple les litiges dans les ventes, ou les retours en cours, pas forcément en plein
   milieu de ma journée, ça sert à rien, je pense qu'il y a d'autres choses plus intéressantes pour cet onglet. Sinon
   en fait il ne sert à rien. »
3. « dis-toi que l'outil doit être pratique, pas chiant ».
4. « la mise en page est catastrophique, revois absolument tout […] je veux quelque chose de drastique, nouveau,
   totalement différent » ⇒ UN seul design, « VRM natif » (`docs/design/NATIF.md`, branche `claude/natif-fondation`).
   La barre du bas, la tête et le rail appartiennent à ce lot-là ; ce lot-ci livre le FOND d'« Aujourd'hui » et de
   « À régler », et l'écran sur les composants natifs dès qu'ils existent.

## Ce qui change pour lui

- **« Aujourd'hui » ne montre plus la liste « À faire ».** À la place, de haut en bas : le vendu du jour (« 102 €
  vendus aujourd'hui · 2 ventes » ; le matin, s'il n'a encore rien vendu, le dernier jour utile : « vendus hier »),
  les sept derniers jours en barres (une barre se touche), le mois (Vendu · Reçu · Bénéfice), « À envoyer » (le
  nombre, des vignettes nettes avec leur plaque N°, « +N » pour le reste, le bouton « Imprimer les bordereaux »),
  « À retirer » (la passe : le point sur une ligne, le code en grand), les 5 dernières ventes, « Argent à venir ».
  Au plus UNE ligne ambre en tête, seulement si une date limite LUE tombe aujourd'hui ou demain.
- **Chaque chose à faire est dans SON onglet**, en tête, dans un bloc discret « À régler · N » : replié en une ligne
  s'il ne presse pas, ouvert (3 rangées puis « Tout voir ») si une rangée est ambre. Ventes : colis pressés, litiges,
  ventes annulées, retours, ventes sans prix d'achat. Achats : achats à numéroter, colis à vérifier. Annonces :
  prix à baisser, et UNE rangée « Compléter mes annonces · N » pour « sans numéro », « sans prix mini », « sans prix
  d'achat » (ce ne sont pas des alertes). Stock : inventaire en cours, nouveaux N° à écrire. « Tout va bien ? »
  (Paramètres) : les choses à trancher, les e-mails à trier. Le MÊME geste qu'avant sur chaque rangée.
- **Les pastilles** : celle d'un onglet = ce qu'elle comptait (colis à envoyer, à retirer, annonces de la cloche)
  + un par groupe « À régler » qu'elle ne comptait pas déjà. « N messages à lire » est la pastille de Messages.
- « 3 pas encore prêt » → « 3 pas encore prêts » (le pluriel recevait `r`, il choisit sur `n` : les 5 langues).

## Où est le code

| quoi | où |
|---|---|
| le modèle des chiffres, des dernières ventes, de l'alerte (pur) | `src/aujourdhui/modele.js` |
| où va chaque groupe, « Compléter », pastilles, publication (pur) | `src/designV2/aRegler.js` |
| le bloc « À régler · N » | `src/designV2/ARegler.jsx` (un `Groupe` natif replié de `Rangee`) |
| l'écran | `src/natif/ecrans/Aujourdhui.jsx` (composants natifs seulement ; l'ancien `src/designV2/Aujourdhui.jsx` et ses CSS sont retirés) |
| ajoutés à `src/natif/` | `Barres`, `Vignettes`, `CodeRetrait`, `Colonnes` (`complements.css`, mode d'emploi dans `docs/design/NATIF-composants.md`) |
| le branchement | `src/App.jsx` : `AujourdhuiAvecChiffresV2` (les chiffres), la branche « Aujourd'hui » de `Comptabilite only="journee"` (groupes publiés, alerte, dernières ventes), `rendreTache` (UNE ligne : `<ARegler onglet={t}/>` pour Ventes, Achats, Annonces), `badgesNav` ; `src/stockV2/StockV2.jsx` et `src/ecrans/Reglages.jsx` (une ligne chacun) |
| les textes | `src/i18n/langues/{fr,en,es,it,de}/designV2.js` (`v2.jour.*`, `v2.mois.*`, `v2.dv.*`, `v2.alerte.*`, `v2.reg.*`) |

**Aucune règle neuve, aucun calcul changé (§5).** Chaque valeur est DEMANDÉE à son propriétaire :
`valeurChiffre` (`src/design/carteChiffres.js`) sur `useSourcesCarte` — les mêmes appels que l'écran Argent
(`ArgentMoisV2`) : `questionsArgent`, le brut et sa couverture ; les lignes de « Vendu » sont `ventesFaites` ; l'alerte
lit `toShip` (une limite ESTIMÉE n'alerte jamais), `pickupUnion.urgents`, les retours « à déposer ». Les groupes sont
les cartes `jobs` de Ma journée, avec LEUR geste (`avant` puis `tab`).

**« À régler » : qui publie, qui lit.** Les groupes sont calculés par « Aujourd'hui » (les cartes vivent dans
`Comptabilite only="journee"`, qui est gelé quand il n'est pas à l'écran — `src/ecransGardes.jsx`). Il les PUBLIE ;
les onglets et les pastilles les LISENT. La dernière publication est gardée en mémoire (avec les gestes) et, en
résumé, sur l'appareil (`vrm_a_regler_v1:<vendeur>`, 12 h au plus) : l'app rouverte directement sur Ventes montre
ses rangées, dont le geste OUVRE alors leur écran ; dès qu'Aujourd'hui recalcule, la publication fraîche remplace.
⚠️ Limite connue : une rangée réglée dans un onglet reste affichée jusqu'au prochain passage par « Aujourd'hui »
(qui recalcule). Le vrai remède est de sortir le calcul des cartes de `Comptabilite` (un sélecteur partagé) — à faire
avec le lot « VRM natif », pas ici.

**Le geste « Compléter ».** `brancherARegler({ completer })` reçoit l'atelier `ouvrirCompleter({ sujet })` (un autre
lot) ; tant qu'il n'est pas branché, la rangée fait le geste du premier manque (le geste d'avant).

## « 1 j de retard » sous « 2 colis pressés » (son point 7)

Vérifié, rien changé : ce texte vient de `texteLimiteEnvoi` (`api/_lib/limite-envoi.js`), qui ne dit « N j de retard »
que pour une limite LUE dans l'e-mail du bordereau ; une date ESTIMÉE dépassée y devient « date estimée dépassée —
vérifie… », et la carte de Ma journée la remplace par « À vérifier sur Vinted » (`verif`, App.jsx). Les vignettes
suivent la même règle (`echeanceJ` : « à vérifier » pour une estimée).

## Preuves

- `node scripts/audit-aujourdhui.cjs` — les règles EXÉCUTÉES (modèle et « À régler ») : 45 contrôles ; 19 mutations
  (`MUTATION=liste`), chacune rouge.
- `node scripts/bancs/aujourdhui-propre.cjs` — l'app rendue sur une base INVENTÉE qui reproduit sa capture
  (50 ventes dont 8 à envoyer, 5 bordereaux prêts, 2 pressés par une limite lue, 2 prix illisibles, 15 colis à
  retirer à 6 points dont un au nom très long, 19 messages) ; bases `capture`, `estimee`, `volume`, `vide` ; 390 × 844
  tactile avec zone sûre, 1512, 1280 ; clair et sombre. Fond : aucun « À faire », chaque groupe dans son onglet avec
  son geste, pastilles, vendu des 7 jours et du mois = les ventes semées (« au moins » avec les 2 prix illisibles),
  reçu / bénéfice / à venir = l'écran Argent. Dessin : bande sans chevauchement, plaques entières, passe sur une
  ligne, barre d'onglets, un seul plein, cibles, contraste lu dans les PIXELS de la capture.
- Sur le build de `origin/main` (`BANC_DIST`), 390 clair : **20 rouges, 4 verts** (7 chevauchements dans la bande,
  8 plaques hors de leur case, textes superposés, « 3 pas encore prêt », cibles de 36 px, « 15 » blanc sur blanc).

## Après l'écran natif (19 nov., fin d'après-midi)

- **L'écran** est `src/natif/ecrans/Aujourdhui.jsx`, composé seulement de composants natifs (aucun style en ligne, aucune
  classe à lui). Ajoutés à `src/natif/` : `Barres` (7 barres jointives, ≥ 46 px chacune à 390), `Vignettes` (chaque case
  SA plaque, « +N » mesuré), `CodeRetrait`, `Colonnes` (trois colonnes à 1280 et 1512 : les chiffres · À envoyer et
  À retirer · Dernières ventes ; effacées au téléphone ; le plein se pose à droite, à sa largeur).
- **Le plein « Imprimer N bordereaux » IMPRIME** (audit d'utilité) : il demande `'imprimer'` et le moteur des bordereaux
  de Ventes fait le geste de SON plein (`imprimerLot()` : l'aperçu de ce qui part d'office, puis « Imprimer ») ; la
  feuille du choix seulement s'il n'y a rien d'office. Contrôle `S6` de `audit-aujourdhui` (rouge sur le code d'avant).
- L'alerte tient sur une ligne : « 2 pressés · 1 j de retard » (5 langues).
- **Budget de démarrage** : l'écran, son modèle (`src/aujourdhui/Branche.jsx` + `modele.js`), le bloc « À régler » et
  les composants natifs avec leur CSS partent dans des morceaux chargés à la demande ; la publication « À régler »
  (pastilles) reste au démarrage (`src/designV2/useARegler.js`). 11 clés `v2.*` devenues mortes retirées.
  `audit-poids-demarrage` : **1982 Ko ≤ 1982** (1996 avant ce lot de chargement).

### Chiffres

- `node scripts/audit-aujourdhui.cjs` : **46 verts, 0 rouge**.
- `node scripts/bancs/aujourdhui-natif.cjs` (le vrai écran dans la vraie coque native, 390 zone sûre / 1512 / 1280,
  clair et sombre, bases capture, volume, vide, attente, plus « À régler ») : **270 verts, 0 rouge**. Sous mutation
  (capture · 390 · clair) : `bande` 2 rouges, `plaque` 1, `passe` 1, `barre` 2 — chacune rougit SA mesure ; `sous`,
  `plein`, `contraste` pas relancées ce jour (file des bancs saturée, tâche arrêtée au bout de 2 h).
- `node scripts/bancs/aujourdhui-propre.cjs` (l'APP rendue, bases capture / estimée / volume / vide, 390 / 1512 / 1280,
  clair et sombre) : **160 verts, 0 rouge**.
- Audits traduction, tdz, variables, studio, composants, icones, violet, rouge-doublon, csp, quoi-de-neuf : verts.
- Le contrôle de contraste ne juge plus un texte transparent (le titre réduit de la barre) ni RECOUVERT (une rangée sous
  le plein collé) : c'est le fond de ce qui le recouvre qu'il lisait.

### Ce qui reste (à l'intégration de « VRM natif »)

- **Dans la coque d'aujourd'hui** (l'ancienne), les feuilles d'habillage non rangées en couche (`design-v2.css`,
  `interface/vrm-*.css`, `studio*.css`) passent DEVANT `@layer vrm-natif` : le plein y sort gris, les barres et les
  `Faits` dans des cases grises (vu sur les captures du banc de l'app). Les composants n'y sont pour rien : cela
  disparaît quand la coque native remplace l'ancienne et que les habillages sont retirés (décision du 19 nov.). Ne pas
  « corriger » avec des `!important` dans `src/natif/`.
- Les bancs de l'ANCIEN design (studio-journee, journee-retours, journee-coherence, accompagnement, fiabilite-auto) voient
  `vrm_design_v2 = '0'` (`_garde-reseau.cjs`) : l'ancienne Ma journée et sa liste « À faire » y sont inchangées ; ils
  partiront avec l'ancien design.
- « À régler » est calculé par Aujourd'hui puis publié (limite connue ci-dessus) : à sortir dans un sélecteur partagé.


## Les chiffres Jour · Semaine · Mois (19 nov., soir)

Julien : « je veux peut-être plus de stats dans l'onglet Ma journée, par exemple le CA, le bénéfice etc. — là il y a
beaucoup d'infos qui ne servent à rien et qui doivent être rangées autre part ».

- En tête d'Aujourd'hui : un segmenté **Jour · Semaine · Mois**, le **CA vendu** en grand avec son **écart nommé**
  (« +85 % vs hier à cette heure », « −12 % vs la semaine dernière », « vs octobre » — la période d'avant coupée au MÊME
  moment), puis **Bénéfice · Ventes · Panier moyen**. Toucher un chiffre ouvre Argent sur la période
  (`vrm_compta_periode`). Le reste de l'écran : À envoyer, À retirer, Dernières ventes. « Reçu », « Argent à venir » et
  les 7 barres sont dans Argent.
- Aucune règle neuve (`statsPeriodes`, `src/aujourdhui/modele.js`) : vendu et ventes = `valeurChiffre('vendu' | 'ventes')`
  (`ventesFaites`) ; bénéfice du mois = celui d'Argent (net, sinon brut avec sa couverture) ; jour et semaine = `brut`
  (`vrm_benefice_jours`), « au moins · 8/10 prix d'achat » quand des prix d'achat manquent ; panier = vendu ÷ ventes
  seulement si les deux sont lus en entier (sinon « — ») ; écart seulement entre deux vendus complets et une période
  d'avant qui a vendu. Une vente au prix illisible n'est pas une ligne de « Vendu » : le nombre de ventes dit alors
  « au moins ». La boîte garde la même hauteur en lecture, lue, pas sue, et d'une période à l'autre.
- Preuves : `audit-aujourdhui` 52 verts (E1–E6), mutations `panier_partiel`, `ecart_sans_avant`,
  `stats_zero_pour_passu` rouges ; `aujourdhui-natif` (capture, vide, attente · 390 / 1512 · clair / sombre) 110 verts,
  0 rouge ; `aujourdhui-propre` (l'app, capture et vide, 390 / 1512, clair et sombre) 118 verts, 0 rouge — vendu, ventes
  et panier des trois périodes = les ventes semées, bénéfice du mois = l'écran Argent ; budget de démarrage 1982 Ko ≤ 1982.

## « Entre Vintex et celui-là », puis « applique ce que tu proposes » (19 nov., nuit)

Julien, sur la capture : « je veux que ce soit mieux, plus dans le style de Vintex, entre Vintex et celui-là ». Puis il
valide la direction : « applique ce que tu proposes ».

- **Le style** (pris des captures de Vintex, rien copié) : fond gris très clair, **cartes à filet** de 1 px (rayon 12, aucune
  ombre), l'en-tête DANS la carte en petites capitales grises avec son compte, des rangées denses (vignette 44, titre,
  « N° · transporteur », l'échéance en pastille, le prix à droite). Accent bleu VRM rare, ambre pour ce qui presse, aucun
  rouge ni vert vif. À l'ordinateur : une grille de deux colonnes de cartes, les chiffres en pleine largeur.
- **Les chiffres** : quatre **tuiles** (CA vendu · Bénéfice · Ventes · Panier moyen), l'écart en petit sous le CA, le
  segmenté Jour · Semaine · Mois au-dessus (à droite à l'ordinateur). **L'objectif du mois** sous les tuiles :
  « 1 840 € / 3 000 € · 61 % · il reste 11 jours » (la règle de la carte des chiffres, `src/objectifMois.js`) ; pas
  d'objectif ⇒ « Fixer un objectif du mois », discret ; le toucher ouvre une feuille (un montant, « Enregistrer »,
  « Retirer l'objectif ») qui écrit `vrm_objectif_mois` comme avant.
- **« À envoyer »** : la carte-tableau, « Imprimer N bordereaux » compact dans son en-tête (il imprime), 4 rangées puis
  « N autres colis à envoyer ». **« À retirer »** : une rangée par point (le nom sur une ligne, le code en chiffres
  tabulaires), la date limite dans l'en-tête, « N autres points ». **« Dernières ventes »** : la carte compacte.
- **Les cartes en plus** (aucune règle neuve, `src/aujourdhui/modele.js`) : la **courbe des 30 jours** (`courbe30`, le vendu
  de chaque jour ; toucher ou glisser choisit un jour, ses chiffres dans l'en-tête, « Voir les ventes ») ; **par compte et
  par site** (`parCompteEtSite` : `valeurChiffre` avec la sélection { site, compte }, rangé par CA, la période choisie) ;
  **sur tes annonces aujourd'hui** (`capteDuJour` sur `capte_journal_*`, une entrée par identité par `fusionner` de
  `src/capteNotif/arrivee.js`, pris TEL QUEL de `claude/extension-utile` : offres et messages captés depuis minuit ; les
  favoris ne sont pas dans ce journal ⇒ « — · pas capté ») ; **ce que VRM a fait aujourd'hui** (`vrmDuJour` : les gestes
  ACCEPTÉS du journal `journal_vrm_*` depuis minuit, « 3 baisses · 12 messages aux favoris · 1 offre acceptée », « — » si
  le journal n'est pas lu).
- **Personnaliser** (lien en bas de l'écran) : une feuille, une rangée par carte avec son interrupteur, le balayage la
  monte ou la descend, « Remettre par défaut ». Rangé dans `vrm_aujourdhui_cartes` (SYNC_KEYS : le même sur ses appareils).
  Par défaut : les chiffres, À envoyer, À retirer, la courbe, Dernières ventes.
- **Composants natifs ajoutés** : `Carte`, `Tuiles`/`Tuile` (src/natif/Carte.jsx), `Courbe`, `Progression`, `Champ`
  (src/natif/Courbe.jsx), `Colonne pleine`. **Budget de démarrage** : le modèle, les lectures (journal, capté), les cartes
  et les glyphes natifs vivent dans le morceau d'Aujourd'hui chargé à la demande (`src/aujourdhui/Branche.jsx`) :
  2 029 557 octets pour 2 029 568 permis (−11) — c'est juste ; le prochain ajout au démarrage devra retirer d'abord.
- **Preuves** : `audit-aujourdhui` 61 verts (F1–F9 : courbe, table, journal, capté, cartes) et les mutations
  `courbe_zero_pour_passu`, `table_toute_vide`, `vrm_refus_compte`, `cartes_perdues` rouges. Bancs : voir le rapport.
