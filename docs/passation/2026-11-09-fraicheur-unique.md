# 9 nov. — Une seule ligne de fraîcheur en haut de l'app (lot AG, proposition 47)

Branche `claude/fraicheur-unique` (depuis `origin/main`), poussée à chaque commit, **pas de PR ni de
merge** (consigne). Aucune migration, aucune route ajoutée (12 fonctions inchangées), **extension
inchangée**. Aucune base réelle lue : tout est mesuré sur le code et sur des données INVENTÉES de la
vraie forme (projections `select=`, `meta->>`).

Validé par Julien (proposition 47) : « savoir d'un coup d'œil si ce qu'il voit est sûr ».

## 1. Ce que dit la ligne

En haut de l'app, téléphone et ordinateur, sous la barre du haut, au-dessus des bandeaux :

| état | quand | ce qui est écrit |
|---|---|---|
| `a-jour` | toutes les sources lues, aucune en retard | « Tout est à jour · vérifié il y a 3 min » (point encre, sans fond) |
| `retard` | au moins une source en retard | la plus grave NOMMÉE avec son geste court (« compte_a (Vinted) pas relu depuis 3 j — ouvre vinted.fr sur ce compte »), « + N autres », un bouton (« Voir », « Comptes », « Relire », « Réglages ») ; au toucher, le détail : chaque source, son geste ENTIER (le navigateur où est l'extension…), dans l'ordre de gravité |
| `passu` | une source pas lue, aucune en retard | « Pas pu tout vérifier : l'extension — rien n'est affirmé pour ça. » + « Réessayer » ; jamais « à jour » |
| `encours` | une source encore en lecture | « Vérification de tes données… » (même hauteur : rien ne saute) |
| caché | base injoignable (`BaseInjoignable` parle), hors ligne mesuré ou mode hors ligne à froid (le bandeau hors ligne / `JourneeHorsLigne` parlent), rien de relié (le guide de démarrage parle) | rien |

Relecture : 1,8 s après l'ouverture (jamais pendant l'ouverture), toutes les 5 min page visible, à chaque
capture de l'extension (`vrm:ext` maj, regroupées 4 s), à chaque relecture du transporteur
(`vrm:transp-lu`, `vrm:transp-maj`). Pendant une relecture, la dernière réponse reste affichée.

## 2. Les sources et les seuils — recensés, AUCUN inventé (`src/fraicheur.js`, `SEUILS`)

| source | lecture (existante) | seuil (son propriétaire) | gravité |
|---|---|---|---|
| compte qui n'arrive plus alors que l'extension travaille | `ext_appareil_*` + comptes (`useEtatCapture`, src/ToutVaBien.jsx) | `PANNE_MS` = `ACTIF_MS` 12 h, preuve lue (`pannesCapture`, api/_lib/garde-capture.js) | 1 |
| extension (toutes, tous navigateurs) | `ext_appareil_*` (5.327+) et `panel_diag_capture` (plus ancienne) | `ACTIF_MS` 12 h (garde-capture : la même que le cron qui notifie) ; jamais vue + des comptes ⇒ « installe-la » | 2 |
| comptes reliés (Vinted, Leboncoin, Vestiaire, eBay) | `lignesFraicheur` (src/fraicheurComptes.js) | `A_RELIRE_MS` 24 h (src/comptesLies.js, la règle « en ligne ») ; délié ; jamais relu | 3 (le plus ancien d'abord) |
| ventes d'un compte Vinted | `harvest_{uid}_orders_sold` vs `_listings` | `RETARD_VENTES_MS` 1 h derrière les annonces (src/fraicheurComptes.js) | 3 |
| achats d'un compte Vinted | `harvest_{uid}_orders_purchased` (ajouté à `lireCapturesDetail`) | `FRAICHEUR_ACHATS_J` 2 j (était dans App.jsx, ligne d'Achats du 23 oct. ; DÉPLACÉ dans src/fraicheur.js, App.jsx l'importe) | 3 |
| suivi chez le transporteur | `transp_*` (`fetchTranspLignes`, projeté) | colis actif (au point relais, en route, pas fini) pas relu depuis `RYTHME_MS[état]` (15 min / 1 h) + `CADENCE_COLIS_MS` 15 min (le passage GitHub) + `MARGE_RYTHME_MS` 1 min — les trois dans api/_lib/transporteurs.js (les deux derniers y ont été DÉPLACÉS depuis api/_lib/colis-frequent.js, qui les importe et les réexporte : le module serveur importe `crypto`, la page ne peut pas le charger) | 4 |
| e-mails reçus | `etatEmailsComptes` (App.jsx, `useEtatEmailsComptes`) | un compte MUET prouvé (des ventes sans leur e-mail, `CSE_MIN_VENTES` depuis `CSE_MIN_JOURS`) — pas une durée : un vendeur qui ne vend rien ne reçoit rien, « rien reçu depuis 2 j » serait faux chez lui | 5 |
| version de l'extension sur un appareil actif | `ext_appareil_*` | `etatVersion` < `EXT_ATTENDUE` (garde-capture) | 6 |

Jamais nommés : un compte masqué, banni, ou retiré des totaux (son choix, `estExclu`) — « ne plus lui
parler des comptes retirés ». « Pas su » (une lecture ratée, rendue `null`) passe dans `passu`, jamais
dans « à jour ». Les gestes courts viennent de `gesteCourt` (src/fraicheurComptes.js, à côté de
`gesteRelire` dont ils sont la forme courte).

## 3. Les mentions retirées ou fondues (une phrase une fois, §7)

| mention | où | ce qui change | pourquoi |
|---|---|---|---|
| la ligne ambre « compte_x (Vinted) n'arrive plus dans VRM » (`AlerteCapture`) | coque, en haut | FONDUE dans la ligne : une panne est la source la plus grave, avec sa cause, son appareil, « Voir » → Tout va bien ? ; `data-alerte-capture` / `data-alerte-voir` gardés. `AlerteCapture` et `vrm_alerte_capture_fermees` retirés de src/ToutVaBien.jsx | deux lignes en haut de l'app pour la même chose |
| « ✓ Ventes Vinted à jour » / « N comptes pas relus depuis N j — repasse sur Vinted » (`VintedResume` → `FraicheurDonnees`) | Ventes · Vinted | plus rendue (`VintedResume` n'est plus appelé : ses montants étaient déjà retirés le 3 nov.) | les mêmes comptes, le même geste que la ligne du haut |
| puce « Relire compte_a · 3 j » / « N comptes à relire » et son détail | Colis | retirée (et la puce « N en route », morte depuis le 3 nov.) | le compte est nommé en haut avec le même geste ; la puce ne regardait d'ailleurs que les VENTES (passation générale §4 : « un compte dont seuls les achats sont vieux n'est pas nommé ») — la ligne regarde aussi les achats |
| « Achats relus il y a N j sur compte_a — ouvre Vinted sur ce compte » (`data-fraicheur-achats`) | Achats → En attente | retirée | même seuil (2 j), même geste, en haut |

**Gardées** (une information propre à l'écran, pas une redite) :
- « Suivi vérifié il y a N min » sous Colis → À retirer (`data-retirer-verifie`) : l'âge du statut chez
  le transporteur des colis DE CETTE LISTE, à la minute, même quand il est frais (la ligne du haut ne
  parle du suivi que s'il est en RETARD) — c'est ce que Julien regarde avant d'aller au point relais.
- `FraicheurAnnonces` (Annonces, Statistiques) : la date du dressing qui GOUVERNE la liste « en ligne »
  (« N à confirmer — dernière lecture… »), une conséquence propre à la liste.
- « État lu par Vinted il y a 1 j » sur un achat (`data-capture-age`, sous le seuil de 2 j) : propre à
  la ligne de cet achat.
- Le panneau de la pastille d'état (compte par compte, `data-fraicheur-comptes`) et Paramètres → Tout va
  bien ? : le DÉTAIL, ouvert sur demande ; la ligne du haut y mène (« Voir »).
- Leboncoin « à confirmer (comptes pas relus depuis 24 h) », eBay « liste inactive pas relue » : la
  conséquence pour la liste de l'écran.

## 4. Les fichiers

- `src/fraicheur.js` — LA règle (pure) : `fraicheurUnique`, `suiviTransporteur`, `signeExtension`,
  `SEUILS`, `GRAVITE`, `FRAICHEUR_ACHATS_J`.
- `src/LigneFraicheur.jsx` — la forme (chargée à la demande ; sa place est tenue par le repli de
  `Suspense`, même hauteur) ; `src/styles-fraicheur.css` — la forme du bandeau (`vrm-bandeau-abo`,
  DA6), importée avec la coque (après `styles-design-2026.css`).
- `src/App.jsx` — la coque rend `<LigneFraicheurParesseuse>` sous `{!baseKO && …}` dans la branche en
  ligne ; exporte `fetchTranspLignes`, `relireTransporteursSiVieux` ; `lireCapturesDetail` rend aussi
  `achats` ; mentions retirées (§3).
- `src/ToutVaBien.jsx` — `useEtatCapture` garde la date de la lecture (`at`) et les achats ; `AlerteCapture` retirée.
- `src/fraicheurComptes.js` — `gesteCourt` ; `ligneFraicheur` rend aussi `lu` (le tri « le plus ancien d'abord »).
- `api/_lib/transporteurs.js`, `api/_lib/colis-frequent.js` — `CADENCE_COLIS_MS`, `MARGE_RYTHME_MS` à un seul endroit.
- Audits mis à la règle : `scripts/audit-vague3-ecrans.cjs` (F), `scripts/audit-finitions-v36.cjs` (C).

## 5. Preuves

- **`scripts/audit-fraicheur-unique.cjs`** : la RÈGLE exécutée (35 contrôles) — tout frais ⇒ à jour ;
  compte de 3 j nommé avec son geste ; frontière 23 h / 25 h ; seuils = ceux des propriétaires ; base
  injoignable, hors ligne ⇒ caché ; Vinted, suivi, e-mails, extension, achats pas lus ⇒ « pas su » ; en
  cours ⇒ « Vérification » ; panne > compte, extension > compte > e-mails ; deux comptes : le plus ancien
  d'abord ; colis fini ignoré ; en route à 70 min encore frais ; exclu et masqué jamais nommés ; la coque
  branchée une fois, plus de seconde voix. `--prouve` : **11/11 mutations attrapées** (hors ligne ignoré,
  base ignorée, pas su = à jour, en cours = à jour, gravité oubliée, seuil à 3 j, exclu nommé, extension
  muette tue, suivi jamais en retard, e-mails muets ignorés, coque qui ne rend plus la ligne).
- **`scripts/bancs/fraicheur-unique.cjs`** (la vraie app `dist`, fausse base qui projette ; 390 tactile
  SOMBRE et 1512 clair) : **86/86 verts** — A tout frais ⇒ « Tout est à jour · vérifié à l'instant »,
  point sans ambre ; B compte_a de 3 j ⇒ nommé « pas relu depuis 3 j — ouvre vinted.fr sur ce compte »,
  compte_b (40 min) pas nommé, le détail donne le geste entier ; C vinted_accounts en 522 ⇒ le bloc de
  panne, aucune ligne, jamais « à jour » ; D réseau coupé après l'ouverture ⇒ « Hors connexion… », aucune
  ligne ; E extension pas vue 2 j + compte_a 3 j ⇒ l'extension d'abord, « + 1 autre », détail dans
  l'ordre ; F appareils en 503 ⇒ « Pas pu tout vérifier » + « Réessayer ». Partout : UNE ligne, aucune
  seconde voix, hauteur identique de « Vérification… » à la réponse, cibles 44 px, aucun débordement,
  aucune erreur. Captures regardées (`captures/fraicheur-unique-*.png`).
  - **Sur `origin/main`** (archive de `origin/main` + build, banc copié DEDANS) : **28 rouges** (aucune
    ligne : ni « à jour », ni compte nommé, ni ordre, ni « pas su »).
  - **Mutation** (build muté : `if (passu.length) return 'passu'` retiré ET tri de gravité retiré) :
    **8 rouges** — « pas su » devient « Tout est à jour · vérifié à l'instant » (390 et 1512), et le compte
    passe avant l'extension (« compte:vinted:111, extension:muette »).
- Lectures de la ligne : elles partent quand l'écran a reçu ses données essentielles
  (`data-attente="pret"`, src/AttenteEcran.jsx) ou au plus tard 15 s après l'ouverture, au repos du
  navigateur — jamais en concurrence avec celles de l'écran.
- `scripts/bancs/tout-va-bien.cjs` : **71/71** (la panne : nom, « réseau coupé », « Orion · iPhone »,
  « Voir » → Tout va bien ? — désormais portés par la ligne unique).
- Bancs relancés un à la fois : `iphone-reprise` 139/139 (un B5 rouge au 1er passage, vert au second —
  toucher « Plus » puis « Ventes », instable, rien à voir avec la ligne), `nav-v2` 54/54,
  `direction-artistique-6` 184/184, `journee-instantanee` 0 rouge (CLS au remplacement 0,0000 aux 4
  combinaisons), `hors-ligne-froid` 80/80, `retraits-frais` 34/34 (F6 lit la ligne du haut),
  `colis-fiables` vert, `colis-retirer-propre` 129/129, `vague3-ecrans` F 15/15 (K : 18 rouges de contraste
  de la carte sombre, sans rapport — jetons de couleur, aucun fichier touché ici), `chargement` : voir §6.
- `npm run build` ; audits `variables tdz coherence identite statuts icones` verts ; `vague3-ecrans`,
  `finitions-v36`, `vente-email-fraiche`, `colis-frequent` verts.

## 6. Ce qui reste

- Les bancs qui lisaient la puce de Colis ou la ligne d'Achats lisent maintenant la ligne du haut
  (`data-fraicheur-a-relire`, `data-fraicheur-a-relire-noms`, `title` = toutes les phrases) :
  `retraits-frais`, `colis-fiables`, `colis-retirer-propre`, `vague3-ecrans` — verts. `revue-30oct` est
  mis à la règle mais ne tourne pas ici (il lit les fixtures réelles `fx/`, absentes du dépôt).
- **`chargement`, 390 px réseau lent** : Ventes, Colis, Achats sortent rouges (CLS 0,024 · 0,072 · 0,033 ;
  0 sur `origin/main`). Mesuré : le décalage n'est PAS la ligne (elle garde 44 px de « Vérification… » à la
  réponse) mais l'arrivée tardive, après le plafond d'attente, d'un bloc de l'écran AU-DESSUS de sa carte
  (« 35 bordereaux à imprimer » sur Colis : la carte passe de 294 à 407 px). Ce saut existe aussi sur
  `origin/main` (captures du même banc à 35 s puis 37 s : la carte passe de 238 à 352 px) mais l'API
  `layout-shift` de Chromium ne l'y rapporte pas ; une simple case vide de 54 px en haut (expérience : la
  ligne remplacée par un `div` statique de même taille, aucune lecture) suffit à ce qu'il soit compté —
  c'est la géométrie, pas la ligne. Les lectures de la ligne attendent déjà l'écran. Le vrai correctif est
  dans l'écran (réserver la place du bloc, ou l'attendre avant de se montrer) : chantier
  `claude/colis-ventes-instantanes` en cours sur ces écrans — à vérifier à l'intégration.
- La ligne ne lit pas l'état du COLLECTEUR d'e-mails (service relevé il y a > 20 min) : c'est un état du
  service, dit par `/statut` et `BandeauStatut` ; si Julien le veut dans la ligne, c'est `etatCollecteur`
  (src/receptionEmail.js), à brancher en source de gravité 5.
- eBay : un compte eBay « à relire » dit « touche « Relire » (Comptes liés) » — le bouton de la ligne
  mène à Comptes liés Vinted (`vintedaccounts`) ; un lien direct vers la carte eBay serait plus juste.
