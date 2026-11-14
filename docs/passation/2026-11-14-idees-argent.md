# 14 nov. 2026 — Idées argent : 159 dépense en photo · 160 vente en main propre · 161 Siri · 162 partager en image

Branche `claude/idees-argent` (depuis `origin/main` 578bd343). Aucune PR ouverte (consigne).
Tout le code neuf vit dans `src/ideesArgent/` et deux modules serveur `api/_lib/siri-*.js` ;
les écrans existants ne reçoivent que des points d'entrée d'une ou deux lignes.

## Ce qui a été trouvé AVANT de coder (une seule règle par notion, §5)

| demande | ce qui existait | décision |
|---|---|---|
| 159 dépense en photo, `vrm_depenses` | la **boîte à dépenses** de Compta (3 nov.) : `vrm_compta.depenses` (synchronisée), ticket dans SA ligne `depense_ticket_{id}`, comptée dans le bénéfice par `comptaChargesMois` / `comptaChargesAnnee` ; la lecture locale du ticket `src/depensesTicket.js` (TextDetector, sinon Tesseract dans la page) | **pas de `vrm_depenses`** : une seconde liste de charges aurait été comptée deux fois ou pas du tout. La feuille écrit LA MÊME dépense (`{ id, date, libelle, cat, montant, ticket? }`) dans `vrm_compta`, ajoute la lecture de la DATE (`dateDuTicket`, déjà écrite pour les achats) |
| 160 vente hors plateforme | « **Vendu ailleurs** » (11 nov., `src/venteAilleurs.js`) : `vrm_cycle_decisions[annonce] = { choix: 'vendu-main', … }`, comptée dans `ventesFaites` / `ventesDeclarables` (paramètre `main`), jamais deux fois avec la vente Vinted de la même annonce | **la même écriture** (`opsVenduAilleurs`), + le mode de paiement (`paiement`, `PAIEMENTS`). La feuille ajoute seulement la porte par N° |
| 161 Siri | `RaccourcisSiri.jsx` (liens qui OUVRENT VRM) ; `api/widget.js` (widget iPhone, clé `?k=` en clair dans `main`) ; l'index des jetons (`api/_lib/jeton-index.js`) | route `api/widget.js?mode=siri` (aucune fonction neuve), **jeton neuf haché** (jamais en clair, ni chez le vendeur ni dans l'index) |
| 162 image | rien | `src/ideesArgent/carteImage.js` (canvas, liste blanche) |

## 159 · Dépense en photo

- Portes : Compta → Dépenses → « Dépense en photo » (lien sous « Ajouter une dépense ») ; ⌘K / loupe
  « dépense », « ticket », « carton », « essence »… (action `depense-photo`).
- Feuille (`Feuilles.jsx`, `FeuilleDepensePhoto`) : « Prendre le ticket en photo » (le seul bouton plein) ou
  « Saisir sans photo ». La photo est réduite dans le navigateur (1100 px, puis 800 px si besoin) ; lue
  DANS la page (`lireTexteTicket` : détecteur du navigateur, sinon Tesseract `cdn.jsdelivr.net` déjà
  autorisé par la CSP — aucune IA, aucune clé, §2.9). Montant et date LUS pré-remplissent les champs
  (seulement ceux qu'il n'a pas touchés) ; il choisit la catégorie (les quatre de Compta, traduites) ;
  **rien n'est écrit avant « Enregistrer · 12,50 € »**.
- Lecture ratée : hors ligne / chargement / délai ⇒ « Lecture impossible… : tape le montant » ; rien
  trouvé ⇒ « Pas trouvé de total » ; le champ reste vide (jamais deviné).
- Photo : gardée si ≤ 450 Ko une fois réduite (`PHOTO_MAX_OCTETS`), sinon la dépense est rangée SANS
  photo et c'est dit.
- Écriture : `isCloudReady()` exigé (sinon « tes données ne sont pas encore chargées », rien noté) ;
  ticket dans `depense_ticket_{id}` (même forme `{ b64, at }` que Compta relit) ; `vrm_compta` relu puis
  `comptaAvecDepense` (une lecture illisible ⇒ `null` ⇒ rien écrit) ; Compta ouverte relit sa liste
  (`vrm:depense-ajoutee`). Après : « En novembre : 2 dépenses notées, 16,50 € » et « Retirée de ton
  bénéfice ; ton chiffre d'affaires ne change pas ».
- Bénéfice : la règle de Compta (charges du mois, couverture déjà dite : « aucune dépense notée »,
  « tu as indiqué ne pas en avoir »). CA : aucune règle de vente ne lit `vrm_compta` (audit D9).

## 160 · Vente en main propre en 2 touchers

- Portes : ⌘K / loupe « vendu 124 », « main propre 124 » ⇒ « N°124 vendu en main propre » (la feuille
  s'ouvre sur ce N°, le champ prix au focus) ; « vente main propre » sans N° ; lien
  `https://vrm.center/?idee=vente-main[&num=124]` (Raccourci « Ouvrir les URL », Paramètres → Siri).
- Identité (§5) : `trouverParNumero` — le N° EXACT (`cleNum` : « 0124 » = « 124 », ≠ « 1240 », ≠
  « B124 ») sur `vinted_annonce_numeros`, en écartant les paires déjà sorties (`vinted_annonces_vendues`,
  décisions `vendu-main` / `separe`). Une ⇒ elle ; **deux et plus ⇒ la question** (« 2 paires portent le
  N°88 : laquelle as-tu vendue ? », plaques rouges `.sb-plaque.is-double`, aucun prix demandé avant son
  toucher) ; aucune ⇒ dit ; déjà sortie ⇒ dit. Des mots (« dunk 42 ») ⇒ des PROPOSITIONS par le titre
  (8 au plus), jamais une identité : son toucher choisit.
- Le prix (`montantTape`), le paiement (Espèces · Virement · Autre, segment), la date (aujourd'hui,
  « changer »). Phrase sous le prix : « Pas de versement d'une plateforme : comptée vendue et encaissée
  le 14 novembre. » Bouton plein « Vendue · 45 € ».
- Écriture : `opsVenteMain` → `opsVenduAilleurs` (décision datée + paiement, marquée vendue ⇒ sortie du
  stock et des annonces, case du Stock libérée, N° jamais touché) en geste annulable 5 s (`gesteVrm`,
  la pilule « Annuler »). Plus tard : « Annuler une vente en main propre » (repli de la feuille, 30 jours)
  ⇒ `opsAnnulerVenteMain` (décision et marque « vendue » retirées ; la case n'est pas reprise, il range).
- Totaux : vendu (`ventesFaites`) et CA déclaré (`ventesDeclarables`) au jour SAISI — pas de versement,
  donc l'encaissement est la date saisie (jamais « à dater ») ; la même annonce vendue sur Vinted ⇒ pas
  comptée deux fois (règle existante). Bénéfice : `ventesAutresBenefice` (prix d'achat de SON N°).
- Reçu (optionnel) : « Télécharger le reçu (PDF) » — pdf-lib chargé à la demande, A5 : date, vendu par
  (l'entité des Factures si remplie, sinon une ligne à remplir), article, N°, paiement, montant, mention
  d'occasion, signature. Ni acheteur (VRM ne le connaît pas), ni prix d'achat. N° de reçu
  `MP-AAAAMMJJ-{N°}`.

## 161 · « Dis Siri, combien j'ai vendu aujourd'hui ? »

Un fichier `.shortcut` signé ne se fabrique pas côté serveur : la page d'aide + un jeton personnel.

- **Jeton** (`api/_lib/siri-jeton.js`, `POST /api/widget?mode=siri` avec la session) : 32 octets
  aléatoires (`vs1_` + 43 signes), rendu UNE fois ; le serveur ne garde que son SHA-256 — dans la ligne
  du vendeur `vrm_siri` `{ h, at, debut, langue }` et l'index `jeton_siri_{h}` chez le propriétaire
  NEUTRE (aucune session ne l'écrit). Créer coupe l'ancien ; « Couper le jeton » retire l'index puis
  vide la ligne et `siri_retrait` (une suppression ratée ⇒ 503, jamais « coupé » à tort).
- **Réponse** (`GET /api/widget?mode=siri&q=vendu|retirer|envoyer|tout&l=fr&k=…`, ou en-tête
  `x-vrm-key`) : jeton mal formé ⇒ 401 sans aucune requête ; inconnu ⇒ 401 après la seule recherche de
  l'index ; index qui ne correspond plus (remplacé, coupé, forgé) ⇒ 401, index retiré ; empreinte
  re-comparée à durée constante ; débit `siri` 10/min, 120/h ; abonnement arrêté ⇒ 402 ; panne ⇒ 503.
  Texte brut que Siri lit (« 275 € vendus aujourd'hui, 3 ventes (d'après VRM à 14 h 05). »), dans la
  langue de VRM (5 langues, `api/_lib/siri-reponses.js`).
- **Aucun chiffre recalculé** (`api/_lib/siri-reponses.js`) : « vendu aujourd'hui » =
  `widget_stats.{jour, caJour, ventesJour, caJourNonComptees}` (ajoutés par la coque à la publication du
  widget, la règle `ventesFaites`, seulement un vendu COMPLET) ; « à envoyer » = `widget_stats.aExpedier`
  (la publication de Colis) ; « prochain colis à retirer » = la ligne `siri_retrait` publiée par l'app
  (`src/ideesArgent/siriPublication.js`, seulement si un jeton existe) : les colis COMPTÉS de
  `vrm_colis_retirer` relus avec `etatRetrait`, le code de LEUR commande pris dans `vrm_codes_hors_ligne`
  (deux codes différents ⇒ aucun dit). Publication d'un autre jour ou de plus de 12 h ⇒ « je n'ai pas
  encore… ouvre VRM une fois » — jamais « 0 € ».
- Lectures : deux petites lignes par leur clé exacte, en projections (`select=jour:data->>jour,…`),
  jamais `select=data`, jamais `main` (§4.4).
- Panneau : Paramètres → Siri et Raccourcis (en tête de `RaccourcisSiri.jsx`), `SiriJeton.jsx`.

### Geste de Julien : créer les trois raccourcis (une fois, sur l'iPhone)

1. VRM → Paramètres → **Siri et Raccourcis** → « **Créer mon jeton Siri** ». Trois liens s'affichent
   (ils ne s'afficheront plus) : « Combien j'ai vendu aujourd'hui », « Prochain colis à retirer »,
   « Combien de colis à envoyer ».
2. Touche « Copier le lien » du premier.
3. App **Raccourcis** → **+** → recherche « **Obtenir le contenu de l'URL** » → colle le lien à la place
   de « URL ».
4. Ajoute l'action « **Énoncer le texte** » ; dans son champ, choisis « Contenu de l'URL ».
5. Touche le nom en haut → « **Combien j'ai vendu aujourd'hui** » → OK.
6. Dis « **Dis Siri, combien j'ai vendu aujourd'hui** ». (La première fois, iOS demande d'autoriser
   vrm.center : « Toujours autoriser ».)
7. Refais 2 à 6 pour « Prochain colis à retirer » et « Combien de colis à envoyer ».
8. Facultatif : un 4ᵉ raccourci « Vente en main propre » avec « Ouvrir les URL » et
   `https://vrm.center/?idee=vente-main` (aucun jeton).
- Téléphone perdu, lien partagé par erreur : « Couper le jeton » (les raccourcis se taisent), puis
  « Nouveau jeton » et recoller les liens.
- Les chiffres sont ceux que VRM a publiés à sa dernière ouverture (Siri dit l'heure) : sans ouverture
  du jour, Siri dit qu'il ne sait pas encore.

## 162 · Partager en image

- Porte : la fiche d'une paire (« Tout sur le N° ») → Actions → « **Partager en image** » (seulement une
  paire connue ; deux paires sous ce N° ⇒ rien, on ne choisit pas).
- `contenuCarte` (liste BLANCHE) : photo, modèle, taille, prix AFFICHÉ (en ligne), N° seulement si la
  case « Montrer le N°124 » est cochée (décochée par défaut). Jamais acheteur, prix d'achat, bénéfice,
  compte, code, adresse — ces champs ne sont même pas lus.
- `dessinerCarte` : la lumière du Studio (dégradé `#EEF6FD → #C6DDF0`), tuile de porcelaine, photo
  recadrée sans déformation, modèle (Urbanist 600, deux lignes au plus, « … »), taille (Inter), prix
  (Urbanist 300), « vrm.center ». Story 1080×1920, carré 1080×1080. Toujours claire (vue sur l'écran des
  autres). Photo d'une adresse qui refuse la lecture (CORS) ⇒ carte sans photo, dit.
- « Partager » : la feuille du téléphone (Web Share, un PNG) ; sinon téléchargement ;
  « Télécharger l'image » en lien. Nom du fichier : le modèle seul.

## Fichiers

- Neufs : `src/ideesArgent/{venteMain,depensePhoto,carteImage,recuPdf,siriPublication}.js`,
  `src/ideesArgent/{Racine,Feuilles,SiriJeton}.jsx`, `src/ideesArgent/idees-argent.css`,
  `api/_lib/siri-reponses.js`, `api/_lib/siri-jeton.js`, `src/i18n/langues/{fr,en,es,it,de}/idees.js`,
  `scripts/audit-idees-argent.cjs`, `scripts/bancs/idees-argent.cjs`.
- Points d'entrée : `src/App.jsx` (import, `<IdeesArgentRacine/>` après la session, une ligne dans
  `lancerActionRecherche`, `vendusDuJourPublies` dans la publication `widget_stats`) ;
  `src/annulerCommandes.js` (trois actions ⌘K) ; `src/ecrans/Compta.jsx` (le lien + relire la liste) ;
  `src/FichePaire.jsx` (« Partager en image ») ; `src/RaccourcisSiri.jsx` (`<SiriJeton/>`) ;
  `api/widget.js` (`mode=siri`) ; `api/_lib/debit-vendeur.js` (débit `siri`) ; `src/venteAilleurs.js`
  (`paiement`) ; `src/nouveautes.js` (4 lignes) ; `scripts/audit-traduction.cjs` (MIGRES).
- Studio bleu clair : les classes `sb-*` du contrat (`sb-btn-plein--barre`, `sb-touche` avec
  `aria-pressed` + diode, `sb-lien`, `sb-plaque`/`is-double`, `sb-rangee`, `sb-vignette`, `sb-champ`,
  `sb-segment`) sont définies PROVISOIREMENT dans `idees-argent.css` sous `:where(.ia)` (spécificité
  d'une classe, couleurs lues d'abord dans `--sb-*`) : à retirer quand `src/design/studio.css` arrive.
  `data-espace` posé sur chaque feuille.

## Preuves

- `node scripts/audit-idees-argent.cjs` : **63 verts** (D dépense 13, V vente 17, S route Siri 20 — la
  vraie `api/widget.js` exécutée contre une base servie à la vraie forme —, I image 6, C branchement 6).
  `--prouve` : **17/17 mutations attrapées** (dépense rangée à la lecture, lecture ratée qui écrit,
  montant deviné, N° par préfixe, doublon choisi, paire restée au stock, paiement perdu, jeton en clair,
  index cru, jeton mal formé lu, `select=data`, vieille publication, panne prise pour rien, deux codes,
  couper sans retirer l'index, prix d'achat dessiné, N° sans la case).
- Sur `origin/main` (arbre extrait par `git archive`, l'audit copié dedans) : rouge (les modules
  n'existent pas ; et la règle « paiement » de `opsVenduAilleurs` manque).
- `node scripts/bancs/idees-argent.cjs` (après `npm run build`) : 390 tactile et 1512, clair et
  sombre — voir le compte rendu de la session et les captures `$TMPDIR/vrm-bancs/idees-argent/`.
- Audits passés : build, traduction, tdz, variables, coherence, identite, csp, fonctions-api, urssaf,
  violet, rouge-doublon, quoi-de-neuf, annuler-commandes, saisie-rapide.

## Ce qui reste / limites dites

- La feuille de vente cherche dans les fiches Vinted (`vinted_annonce_numeros`) : une paire qui n'existe
  qu'en Leboncoin / eBay sans fiche ⇒ « Aucune paire au N° » (rien deviné).
- Siri : « prochain colis » suppose que l'app a été ouverte avec un jeton actif (la publication
  `siri_retrait` est écrite par l'app). Le code dit est celui de la copie hors ligne de CE compte VRM.
- L'éventail du disque (direction Studio) n'existe pas encore : quand il arrive, y poser
  `ouvrirIdee('vente-main')` et `ouvrirIdee('depense-photo')` (src/ideesArgent/Racine.jsx).
