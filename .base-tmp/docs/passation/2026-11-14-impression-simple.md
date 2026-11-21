# 14 nov. 2026 — « Imprimer » en un toucher (chantier impression-simple)

Branche `claude/impression-simple` (depuis `claude/integration-refonte`, refusionnée par un vrai `git merge`).

Julien, mot pour mot : « le bouton imprimer donc clairement à améliorer, c'est n'importe quoi ça marche pas du tout,
tout le processus est horrible, pas du tout intuitif, c'est une catastrophe ».

## Ce qui ne marchait pas (mesuré sur le vrai parcours, avant)

Rejoué dans Chromium avec de vrais PDF de test (`bordereau-test.b64`), à 390 px tactile (iPhone) et 1512 px
(`scripts/bancs/_diag-impression.cjs`, jetable, gardé hors du dépôt ; les mêmes gestes sont joués par le banc
`impression-simple`, rouge sur la version d'avant) :

| étape | 390 iPhone | 1512 |
|---|---|---|
| 1 | « Tout imprimer (6) » ⇒ une feuille : papier (segment tronqué « 4 par p… »), deux phrases, « Tout sélectionner / Tout décocher », la liste, un aperçu schématique par bordereau avec un menu de tampon et « Retirer du lot » | idem |
| 2 | « Imprimer (6) » | idem |
| 3 | la question du N° « à vérifier » (règle §5, gardée) | idem |
| 4 | **la feuille « Place du tampon » s'ouvrait SEULE**, une fois par transporteur sans place gardée (« Bordereau 10×15 · Toujours ici · Imprimer ») — c'est elle qui « attendait » | idem |
| 5 | **un panneau plein écran « Imprimer les bordereaux · 6 sur 6 · Ce que VRM fait · Fermer »** (le suivi de travail, montré dès qu'un geste dépasse 1 s — donc toujours, avec les deux questions) | la visionneuse, puis le même panneau dessous |
| 6 | **AUCUN PDF ouvert** : sur iPhone `ouvrirPdfOnglet` rendait `false` (Safari refuse une fenêtre ouverte après une attente) ; il fallait fermer le panneau, trouver « Ouvrir le PDF » dans la feuille, puis Partager → Imprimer | « Imprimer » dans la visionneuse (5ᵉ toucher), puis « Fermer », puis la feuille « Tout est sorti ? » |

Chiffres : 4 touchers avant que le PDF existe (9,3 s à 390, 17 s à 1512), 6 à 7 jusqu'à l'imprimante.
Aucune route serveur n'est en jeu (tout se fait dans le navigateur : pdf-lib, pdf.js) ; l'outil Vercel n'était pas
nécessaire.

## Le nouveau parcours

1. **« Imprimer (N) »** (le seul bouton plein d'À expédier) ⇒ le PDF de tous les bordereaux qui partent, chacun
   tamponné de SON N° à la place gardée (sinon la place automatique), au papier retenu, **s'ouvre dans ce toucher** :
   iPhone/Android ⇒ la feuille de partage (« Imprimer » y est), sinon un onglet ; ordinateur ⇒ la visionneuse de VRM,
   qui lance l'impression seule. Plus aucune feuille « Place du tampon » d'office, plus de panneau de suivi.
2. **Le papier** (Classique · A4 / Thermique · 10×15 / 4 par page A4) est demandé **une seule fois** (le toucher sur un
   papier imprime aussitôt : 2 touchers la première fois, 1 ensuite), retenu (`vrm_imprimante`, synchronisé), et se
   change d'un toucher discret à côté du bouton (« Classique · A4 ▾ »), jamais une étape. À côté aussi : « Choisir »
   (« 2 autres · Choisir ») — la feuille d'avant, réduite à choisir ce qui part et à dire POURQUOI les autres n'y sont pas.
3. **Après**, une feuille légère : « Tout est sorti ? **Oui** / Il en manque », les vignettes (les VRAIES pages du PDF,
   rendues par pdf.js), et ce qui manque au PDF **nommé avec sa raison** (« N°25 Foxtrot — pas encore de bordereau :
   génère-le sur la vente »). « Il en manque » ⇒ toucher ceux qui manquent ⇒ « Réimprimer (k) » : leurs pages déjà
   tamponnées, eux seuls. Toucher une vignette ⇒ son tampon (N° seul, N° + titre, + taille, Rien) ou « Déplacer le
   tampon » (la feuille de placement, pour lui, sur sa demande ; « Toujours ici » la garde pour son type) ⇒
   « Réimprimer celui-ci ».

### Comment le PDF s'ouvre dans le geste (iPhone)

Safari n'ouvre la feuille de partage / une fenêtre que DANS le toucher ; un PDF fait après une attente arrive trop
tard. Au téléphone, le PDF du lot est donc **préparé d'avance** pendant qu'il regarde À expédier (`composerBordereaux`,
sans question, sans rien ouvrir), et « Imprimer » l'ouvre sans attendre (`ouvrirPdfLot`, règle `voieOuverture`).
Un PDF préparé ne sert que si sa **signature** est la même au toucher (`signatureLot` : le compte VRM, chaque
bordereau — clé, empreinte N°/état/compte, tampon choisi —, le papier, les places de tampon gardées, le réglage
d'impression) ; sinon il est refait, et le téléphone montre « Ouvrir le PDF » (SON toucher est le geste).
- **Seulement au téléphone** : sur ordinateur rien n'est lu avant son clic (la visionneuse s'ouvre au toucher,
  « Préparation… », puis le PDF et l'impression) — §4.4 tenu (banc B0 : 0 lecture de PDF avant le toucher).
- Au téléphone, seuls les bordereaux qui PARTENT sont lus d'avance, une fois par séance (`_octetsLot`, 60 au plus) —
  ce qu'il va imprimer de toute façon (banc A0 : 5 lectures pour 5 bordereaux). Exception assumée à « rien lu à
  l'ouverture » (banc `annuler-commandes` E1, joué sans téléphone simulé : inchangé).
- La version des N° (`assurerVersionNumerotation`, « relue il y a moins d'une minute ») est relue en fond toutes les
  45 s tant qu'un lot est à l'écran : c'est elle qui permet d'ouvrir dans le geste ; sinon, le chemin d'attente la relit.

### Règles intouchables, tenues

- §5 **N° à vérifier / porté par deux fiches** : `confirmerNumerosAVerifier` reçoit une **sonde** (`numerosDemandent`) :
  la même règle, exécutée sans rien demander (une fonction `async` s'exécute d'un trait jusqu'à son premier `await` :
  avec la sonde, aucun n'est atteint). Une question due ⇒ pas d'ouverture dans le geste : la question d'abord, puis le
  PDF (« Ouvrir le PDF » au téléphone). « Annuler » ⇒ rien d'ouvert (banc C1-C3, audit-impression-carton).
- **Identité** : rien de neuf — le lot est `lignesLotTous` / `cochesParDefaut` / `selectionImprimable` (les règles
  d'avant), le N° de chaque bordereau par son identité ; « Il en manque » reprend les pages par la CLÉ du bordereau
  (`pagesDe`, plages posées à la composition).
- **Absent dit** : chaque ligne du lot sans PDF dans le résultat est nommée avec sa raison (`absentsDuLot` : la base n'a
  pas répondu · pas encore de bordereau · PDF illisible).
- **eBay** : jamais dans le lot (ligne grisée dans « Choisir »), rien n'est acheté.
- Marqué « imprimé » quand le PDF est OUVERT (partage, onglet, visionneuse), jamais sur un PDF resté fermé.

### Design (règles des boutons de la direction t25)

Un seul bouton plein par écran/feuille (« Imprimer (N) », puis « Oui » / « Ouvrir le PDF » / « Réimprimer ») ;
le papier et « Choisir » sont des liens (zone 44 px) ; les papiers, les tampons et les vignettes sont des touches
qu'on touche entières, l'état choisi = enfoncé + diode ; aucun bouton d'explication ; le pied de la feuille d'après
reste au bas quand les vignettes défilent. Retirés : le segment de papier dans la feuille (tronqué à 390 px), les deux
phrases-guides, l'aperçu schématique, « Placer le tampon », la frise « Choisir · Imprimer · Déposer », les étapes
« C'est imprimé ? » / « Prêts à déposer » de la feuille. Tous les textes neufs par `tr()` (`src/i18n/langues/<l>/impression.js`,
5 langues ; `src/ImpressionSimple.jsx` dans la liste « migrés » d'`audit-traduction`). « Quoi de neuf » :
`imprimer-un-toucher`.

## Où c'est

- Règles pures : `src/impression/lotSimple.js` (`formatRetenu`, `signatureLot`, `voieOuverture`, `pagesDe`, `absentsDuLot`).
- Les deux feuilles : `src/ImpressionSimple.jsx` (`ChoixPapier`, `FeuilleImpression`), `src/styles-impression.css`.
- App.jsx : `composerBordereaux` (la fusion seule, avec les plages) et `extraireBordereaux` (« Il en manque ») ;
  `mergeAndDownloadBordereauxBrut` = garde + composer + ouvrir (gardé) ; `ouvrirPdfLot` ; la visionneuse lance
  l'impression seule (`v.auto`) ; `confirmerNumerosAVerifier(numeros, sonde)` + `numerosDemandent` ; dans le moteur de
  Colis : `imprimerLot`, `lancerImpression`, `attendrePuisOuvrir`, la préparation d'avance (`lotDefautRef`, posé par le
  rendu d'À expédier — dans le corps, la liste n'est pas encore calculable, §4.6), « Il en manque », le tampon d'un
  bordereau, `batchBordereaux` (actions en série) passe par `imprimerLot`.

## Preuves

- **Banc `scripts/bancs/impression-simple.cjs`** (390 tactile iPhone clair et sombre, 1512 clair et sombre, N° à
  vérifier) : **57 verts**. Touchers jusqu'au PDF : **2 la première fois** (A3), **1 ensuite** (B1) ;
  la feuille de partage s'ouvre **dans le geste** (`window.event` = le clic : A2, A12, C3) ; PDF relu par pdf.js :
  **4 pages A4, chaque page SON « ETIQUETTE » et SON « N° »** (A4-A6, B3) ; papier retenu (A7, B6) ; « Il en manque » ⇒
  **une page, la sienne** (A12) ; tampon corrigé après ⇒ une page sans N° ni titre (B5) ; l'absent nommé (A9) ;
  N° à vérifier : question AVANT tout PDF, « Annuler » ⇒ rien (C1-C2) ; ordinateur : 0 PDF lu avant le toucher (B0).
- **Rouge sur la version d'avant** (`git archive da660492`, banc copié dans l'arbre, dist reconstruit) : 7 rouges, 0 vert.
- **Mutations** (dist reconstruit à chaque fois) : ouverture hors du geste (`if (false && pret …)`) ⇒ A2, A4-A6, A8
  rouges (iPhone : « Ouvrir le PDF » au lieu du partage) ; garde §5 retirée du chemin du geste ⇒ C1 rouge.
- `audit-colis-plus` : 72 verts, `--prouve` 29/29 mutations rouges (6 neuves : « Il en manque » qui reprend tout ou pas
  branché, papier jamais demandé, lien du papier mort, ouverture hors geste au téléphone, tampon d'après ignoré).
- `audit-impression-carton` : la sonde dit « question due » sans rien demander ; le chemin du geste n'ouvre que si rien
  n'est dû.
- Bancs d'impression gardés verts, **adaptés parce qu'ils jugeaient l'ancien parcours** (dit dans chacun) :
  `tout-imprimer` (28 : la question du papier une fois), `tout-imprimer-garde` (8, inchangé), `tout-imprimer-compte`
  (18 : « Imprimer (2) » et « 2 autres · Choisir »), `colis-plus` A et F (le papier à côté du bouton, le tampon APRÈS,
  « Il en manque »), `selection-bordereaux` (48 sur 390, 1512, 1512 sombre : plus de feuille d'office ; « Déplacer le tampon » + « Toujours ici »
  ⇒ les deux Mondial Relay du lot suivant à la place posée).
- Audits : traduction, tdz, variables, coherence, identite, impression, impression-carton, colis-plus, quoi-de-neuf,
  rouge-doublon, violet, colis-trois (son 2g était rouge AVANT ce lot : réparé), selection-bordereaux,
  annuler-commandes, actions-serie — verts.

## Résultat final (après la fusion d'`origin/claude/integration-refonte`, dist reconstruit)

`impression-simple` 57 verts · `tout-imprimer` 28 · `tout-imprimer-garde` 8 · `tout-imprimer-compte` 18 ·
`colis-plus` (A, F) 16 · `selection-bordereaux` 48 · `npm run build` vert · audits traduction, tdz, variables,
coherence, identite, impression, impression-carton, colis-plus (72, `--prouve` 29/29), quoi-de-neuf, rouge-doublon,
violet, colis-trois, selection-bordereaux, annuler-commandes, actions-serie : tous verts. Captures regardées
(390 clair/sombre, 1512 clair/sombre : écran, papier, partage, feuille d'après, « Il en manque », tampon corrigé).

## Ce qui n'est pas fait (dit)

- WebKit n'est pas installé dans ce conteneur : Safari est simulé (agent iPhone, `window.event` exigé). À vérifier une
  fois sur son iPhone : « Imprimer (N) » ⇒ la feuille de partage ⇒ Imprimer.
- Les boutons « Imprimer » de chaque carte restent (imprimer UN bordereau) : la règle t25 les voudrait dans la carte
  ouverte ; c'est un chantier de la liste, pas de l'impression.
- Bancs non rejoués ici (ils cliquent l'ancien « Tout imprimer » de la barre ou ses étapes) : `colis-a-leur-place` (son
  contrôle I était déjà rouge avant), `accompagnement` (colis.imprimer), `accessibilite`, `annuler-commandes` (E1),
  `lot-bordereaux`, `retours-litiges`, `popups-propre`, `ventes-colis-premium`, `_ergonomie-gestes-liste`. Pour eux :
  `data-lot-ouvrir` est désormais « Choisir » (la feuille, son plein `data-lot-imprimer`), et le plein de la barre
  (`data-colis-barre-btn="imprimer"`, `data-impr-lot`) imprime directement.
