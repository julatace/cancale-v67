# 28 nov. 2026 — Avant de publier (achat, prix mini), dossier « À publier », N° avant, « Publier aussi » en file · branche `claude/publier-achat-prixmini`

Pas de PR (l'intégrateur). Extension **5.458.0** (`aussifile`) : `CODE_VERSION`, manifeste, `CAPTEUR_VERSION`, `relaisVersion`,
`EXT_ATTENDUE`, `EXT_CAPACITES`, `audit-coherence`, zips régénérés. Aucun code des favoris ni de la connexion touché.

## Les demandes de Julien (28 nov.)
1. « Quand on publie, à côté, AVANT de publier, je veux pouvoir relier à un achat, et un bouton pour dire quel est le prix le
   plus bas à accepter. Tout doit être parfait, comme ça l'extension peut faire des contre-offres. »
2. « Un dossier avec les articles à publier : on sélectionne des photos et, dès que c'est publié, le site comprend que ce sont
   les photos qu'on avait reliées à un achat. » — 3. « ça permet aussi de pouvoir étiqueter avant ».
4. « Publier partout depuis le dossier À publier » ; « imagine que les onglets Vinted et Vestiaire ne sont pas allumés en même temps ».

## Ce qui existait
- Le prix mini : UN champ, `vinted_annonce_numeros[id].min` (+ `minAt`), et la clé `vrm_prix_mini` de la ligne
  `vrm_reglages_auto` (par N° / annonce, 5.437 `prixminipublier`, règle `pmMiniDe`, superposée par `lireMain`). Vérifié en
  EXÉCUTANT le vrai fond : `offreAutoReglages`→`reg.mins` (moteur des offres, `palierContreOffre`, négo intelligente, Agent VRM
  `agDecisionOffre`), `plancherFavori`, `plancherBaisse`, `gardePlancher` lisent tous ce champ. Rien à unifier côté extension.
- Le panneau demandait déjà le prix mini à ses publications (5.437). La fiche de la paire avait un fait « Prix mini » modifiable
  et « Relier » seulement pour une paire VENDUE (proposition) ; Annonces avait « accepter dès » et la feuille « Lier à un achat ».
- La reprise d'un N° par une republication copie la fiche entière (`repriseNumerosRecreation`) : achat et prix mini suivent.
- La photo que VRM a fabriquée pour un N° est reconnue à la republication (`vrm_photos_vrm`, `SEUIL_PHOTO_VRM` 8, mesuré).

## Ce qui a changé
- **`src/publier/avantPublier.js`** (règle pure) + **`AvantPublier.jsx`** (`BlocAvantPublier`, `RelierAchatFeuille`) +
  **`AvantPublierHote.jsx`** (sur une annonce existante) + **`outilsAchat.js`** (Comptabilite publie SA liste d'achats, SES liens,
  SA proposition du reçu : une règle, un propriétaire).
  - « Relier à un achat » : ses achats pas reliés, du plus récent au plus ancien, suggestions en tête (`suggestionsAchat` :
    une autre marque ou aucun mot de modèle commun écarte) ; SEUL le bouton « Relier » appelle `ecritureLien`. Prix posé
    seulement depuis le REÇU de CET achat (`propositionPrixAchat`, source `recu`, même tx) ; un lot jamais divisé
    (« prix d'achat à saisir ») ; une saisie jamais écrasée (`champsLien`). Ensuite `prixAPoser` (moteur du reçu) fait le reste.
  - « Prix minimum accepté » : un champ vide (jamais pré-rempli ; « achat + 10 % = X € » sous « Pourquoi ? »), passé par
    `gardePrixRegle` (mode main) : 0 / au-dessus du prix refusés ; ×10 ÷10 et sous l'achat ⇒ SA confirmation du chiffre.
    Écrit `min` + `minAt` (`ecritureMini`, la forme « 45.5 » lisible par toutes les versions) ; sans identifiant Vinted, aussi par
    N° dans `vrm_prix_mini` (`poserPrixMiniLigne`, App.jsx, comparer-et-échanger).
  - La ligne « Offres : contre-offre auto jusqu'à 60 € » (`ligneOffres`, par `plancherDe` : ce que les moteurs feront).
  - Posé dans : Préparer (`PreparerFiche`), « Publier aussi sur… » de l'app (`PublierAilleurs`, prop `avant`), la fiche de la
    paire (bloc `avant`, le fait « Prix mini » n'est plus répété), le dossier. Annonces garde « accepter dès » et « Lier à un achat ».
- **Le dossier « À publier »** (`src/aPublier/`) : `dossier.js` (règle), `fichiers.js` (SHA-256 + empreinte perceptuelle de
  chaque fichier, photo recadrée comme le studio, vignette), `DossierAPublier.jsx`, `HoteDossier.jsx` (Annonces).
  Un brouillon = une fiche `vrm_fiches_neuves` avec `dossier` ; ses photos dans `studio_photos_d…` (lire-fusionner-réécrire) ;
  la liste lit la seule vignette par projection (`data->photos->0->>vig`). Regrouper : 1 sélection = 1 article ; SA coupure ;
  « Proposer » (heure de prise, dossier) ne s'applique qu'après SON « Appliquer ».
- **Le N° avant** : « Donner un N° » (`donnerNumerosBrouillons`, App.jsx) = `numerosServisLus` + `numerosEnSerie` (le chemin de
  « Rangé », aucun second compteur), par paquets de 40 qui partent au-dessus des N° déjà donnés (`prisAvec`), pool append-only
  D'ABORD ; ses photos recopiées dans `studio_photos_{N°}` (le dépôt de l'extension les lit là). « Imprimer » : les étiquettes
  existantes, après `confirmerNumerosAVerifier`. Un brouillon retiré garde son N° servi.
- **La publication reconnue** (bloc `<numerotation-passage>` de Comptabilite) : `decisionNumeroBrouillon` avant tout N° neuf —
  photo d'un brouillon NUMÉROTÉ ≤ 8 et aucun autre brouillon ≤ 16, aucune autre nouvelle annonce, N° libre ⇒ l'annonce PREND son
  N° (jamais un second) ; empreinte pas lue / ambigu ⇒ elle ATTEND (24 h au plus, puis la règle normale). Puis `correspondance` :
  par N°, sinon (brouillon sans N°) par photo dans les deux sens, annonce créée après le brouillon ⇒ `heritage` (achat, prix mini ;
  rien d'écrasé) et le brouillon passe dans « Publiées ». Ambigu ⇒ « Publiée ? Relie-la », SON toucher (`patchChoix`).
- **« Publier aussi » en file (ext. 5.458.0)** : `src/aPublier/fileAussi.js` (bloc `<file-aussi-regle>` recopié dans le fond),
  `PublierAussiDossier.jsx` (feuille avant/après de `feuilleAussi`, SES réponses, « Mettre en file »), ligne `vrm_aussi_file`
  (une tâche par site et par N°). Fond : `aussiFileTick` (alarme commune + onglet Leboncoin/Vestiaire chargé) ; tâche notée
  « en cours » AVANT le dépôt ; `deroulerAussi` → `publierUnAussi` (gardes, plafond, formulaire par la page, relu, AUSSI_FAITS) ;
  « faite » sur l'identifiant du site ; passager ⇒ attend ; pas su ⇒ jamais relancée ; vendue (vente Vinted prouvée d'une
  annonce de ce N°, ou la liste « à retirer partout ») ⇒ annulée et dite. `src/publier/aussi.js` et `agent.js` acceptent un
  BROUILLON comme source (identité `brouillon`, photos `data:image` du studio) ; GARDES_APP recopiées.

## Ce qui est fiable — et ce qui ne l'est pas — après le ré-encodage de Vinted
- **Le fichier exact (SHA-256) ne survit JAMAIS à Vinted** : la capture ne lit qu'une adresse vinted.net (ni nom, ni octets
  d'origine) et l'empreinte perceptuelle (`photo_emprunte_{uid}`, couverture d'abord). Il sert à dire « même photo dans deux
  articles » (alors rien n'est relié seul).
- **Fiable** : publié PAR VRM (Déposer) ⇒ par le N° (identité) ; publié à la main ⇒ par la photo au seuil mesuré de la photo
  fabriquée par VRM (≤ 8 ; même photo passée par Vinted ≤ 7 ; autre photo de la même paire ≥ 23 ; autre paire ≥ 19), avec marge
  (aucun autre brouillon ≤ 16) et unicité dans les deux sens.
- **Pas fiable, donc jamais seul** : deux prises quasi identiques de la même paire (9–16), le même fichier dans deux articles,
  une annonce dont la date est inconnue, une empreinte pas encore captée ⇒ attente puis SON choix. Les seuils viennent d'un jeu
  INVENTÉ (banc photos-vrm-seuil) : à remesurer sur ses vraies photos (lecture seule) si un faux « Publiée ? » revient souvent.
- Vestiaire : la marque est revérifiée par l'extension à l'ouverture de Vestiaire (l'app ne lit pas sa liste).

## Preuves
- `audit-publier-achat-mini` (34 verts, 6/6 mutations) — 50 achats identiques, reçu par identité, lot, garde, vrai fond (moteur,
  contre-offre, Agent, favoris, baisse) lisant LE champ.
- `audit-dossier-a-publier` (36 verts, 8/8 mutations) — 50 articles identiques reliés chacun au sien par la photo seule, titres
  échangés sans effet, ambiguïtés, N° (prochain libre, 50 distincts, trou et retiré jamais redonnés), numérotation EXÉCUTÉE
  (reprise du N°, attente, aucun doublon, héritage, « Publiées »).
- `audit-file-aussi` (17 verts, 5/5 mutations) — vrai background.js : file sans onglet ⇒ attend ; onglet ouvert ⇒ part avec les
  photos du brouillon ; jamais deux ; vendue ⇒ annulée ; preuves pas lues ⇒ rien ; plafond ⇒ attend ; pas su ⇒ jamais relancée.
- Banc `scripts/bancs/avant-publier.cjs` (111 verts) : preparer, feuille, dossier, regrouper, fiche, aussi, choix, annonce ×
  390/1512 × clair/sombre — captures regardées (titres raccourcis, « OK » qui se coupait, recherche collée au bord : corrigés).
- `_numerotation-vm.cjs` charge `src/aPublier/dossier.js` (null dans un arbre d'avant).

## Gestes de Julien
- Installer l'extension **5.458.0** (pour la file « Publier aussi » ; le reste est dans l'app).
- Remesurer (lecture seule) la distance « photo du dossier ⇄ annonce Vinted » sur ses premières publications à la main.
