# 6 nov. 2026 — « Republier à la main » : les mêmes réglages que l'atelier, en cinq étapes

Branche locale `v36-republier-main` (depuis `claude/project-review-nsk5su`), **pas poussée,
pas de PR**. Ni `vinted-sync-extension/` ni `public/` touchés.

Julien (6 nov., mot pour mot) : « pour les republications à la main c'est bien mais je veux
que on puisse régler comme quand c'est VRM qui fait comme ça c'est bien, pareil améliore
l'interface stp ».

## 1. Inventaire EXACT des réglages de l'atelier (lu dans le code, pas supposé)

Atelier = `RepublierVinted`, étape « Modifier », actions `recreer` (Republier) et
`versBrouillon` (Mettre en brouillon). Ce que l'extension reçoit : `vmrCmdSuivi({ cmd:
'recreerVinted', prix, titre, plancher, reglages, lettre, viaBrouillon, … })`.

| réglage | où (avant ce chantier) | ce que l'extension en fait | à la main ? |
|---|---|---|---|
| **Photos** : redresser ±15°, luminosité 0,5–1,5, contraste 0,5–1,5, saturation 0–2, zoom 1–2 ; UN réglage pour toutes (« Varier » et le réglage par annonce RETIRÉS) ; préréglages nommés `vrm_photo_presets` | état React, **neutre à chaque ouverture** | `reglagesPhotoSurs` (bornes) puis `photoReglee` : fond blanc, filtre, rotation et zoom au centre, JPEG 0,92 | oui |
| **Prix** : garder · −5/−10/−15/−20 % · autre % · − X € · même prix pour toutes · arrondi à l'euro ; jamais sous le prix d'achat (`plancher`) | état React, neutre à chaque ouverture | prend `prix` tel quel (l'app calcule) | oui |
| **Titre** : ne pas changer · ajouter au début · à la fin · remplacer · supprimer ; jamais coupé (> 100 : la paire ne part pas) | état React | prend `titre` tel quel | oui |
| **Description** : reprise mot pour mot ; option « une lettre au hasard tout en bas » (une par annonce) | état React | retire toujours une lettre seule en dernière ligne (`sansLettre`), ajoute `\n\n{lettre}` | oui |
| Passage par un brouillon | état React | `viaBrouillon` | sans objet (c'est lui qui publie) |
| Temps entre deux annonces, ordre, « Je confirme » | `vrm_republier_esp` (appareil) | file de l'app | sans objet |
| **Le N° dans le texte** (`vrm_num_vinted`, src/etiquetteNumero.js) | Réglages → Numéros (synchronisé) | **pas appliqué** : l'extension ne l'écrit pas encore (passation 2026-11-05-numerotation-etiquette, « reste : extension ») | **oui, à la main seulement** (`poserEtiquette`) |

Divergences trouvées : « à la main » avait SES réglages photo (`vrm_main_reglages`, appareil) et
d'AUTRES bornes (`filtreReglages` : zoom ≤ 1,5, lumière ≤ 1,6) — une photo téléchargée à la main
pouvait ne pas être celle que l'extension envoie ; aucune baisse de prix, aucun réglage de titre,
aucune lettre ; le N° jamais posé ; une annonce à la fois.

## 2. Ce qui a changé

**Une source, une règle — `src/republierReglages.js` (neuf).** Bornes et curseurs
(`CURSEURS_PHOTO`, = `reglagesPhotoSurs` de l'extension), `filtrePhoto`/`cssApercuPhoto`,
`dessinerPhotoReglee` (les gestes de `photoReglee`), `appliquerCouleursPixels` (Safari),
`lotAppliquePrix`/`lotAppliqueTitre`/`TITRE_VINTED_MAX` (**déplacés** d'App.jsx : l'atelier des
lots, Republier et la main les importent), `REDUCTIONS_RAPIDES`, `MODES_TITRE`, `apercuRepub`
(l'aperçu que l'atelier envoie), `sansLettre`/`descriptionAvecLettre` (la règle de l'extension),
`annonceRepubliee` (= `apercuRepub` + lettre + `poserEtiquette`), `lireReglagesRepub`
(une valeur inconnue retombe au neutre), `resumeReglages`.
`annoncesActions.js` ne garde plus de copie : il ré-exporte `filtreReglages`, `nomPhotoReglee`,
`appliquerCouleursPixels`.

**Une clé synchronisée `vrm_republier_reglages`** (SYNC_KEYS) : `{ photo, lettre }` — **jamais un
prix ni un titre** (`reglagesGardes`). Lue et écrite par le crochet `useReglagesRepub()` (App.jsx)
— l'atelier (Republier, Mettre en brouillon) ET « à la main ». La retouche photo et la lettre
réglées dans l'un valent dans l'autre, sur tous ses appareils ; l'ancien réglage photo de la main
(`vrm_main_reglages`) est repris une fois.

**Décision (6 nov., coordinateur, qui respecte la sienne du 29 oct. : « le prix ne change plus par
défaut »)** : la BAISSE DE PRIX et la modification du TITRE repartent de « Garder » / « Ne pas
changer » à CHAQUE ouverture, dans l'atelier ET à la main (`reglagesAOuverture`) ; une relecture
du nuage ne les touche pas non plus. Dans une même série « à la main » (paire 2/5…), la baisse et le
titre choisis valent pour les paires suivantes (`encours`, tenu par la file `repubMainFile`), jamais
au-delà de la feuille. **« Modifier prix ou titre »** a des réglages à lui, tous neutres à chaque
ouverture. Dit dans l'interface : atelier « Mêmes réglages que « Republier à la main » : la retouche
des photos et la lettre valent aussi là-bas … ; le prix et le titre repartent de « Garder » à chaque
ouverture. Gardés : Photos retouchées · Lettre en bas » + « Tout remettre à zéro » ; main « Mêmes
réglages que Republier. La retouche des photos et la lettre valent aussi quand VRM republie pour toi
… Le prix et le titre repartent de « Garder » à chaque ouverture (ils valent pour toutes les paires
de cette série) ».

**L'atelier** n'a changé que de source : ses curseurs, réductions et titres sont lus dans le module
(`CURSEURS_PHOTO`, `REDUCTIONS_RAPIDES`, `MODES_TITRE`), son aperçu est `apercuRepub`, son aperçu
photo `cssApercuPhoto`. Une lettre gardée allumée est tirée pour chaque annonce choisie. Ce qui part
à l'extension est identique à avant pour un même réglage.

**« Republier à la main », refaite** (`RepublierALaMain`, `src/republier-main.css`) : `SheetShell`
(titre « Republier à la main » / « Remettre en vente », « Paire 2/5 » en sous-titre), la paire en
tête (photo ou `PhotoVide`, `Numero`, titre, compte), une progression de cinq pastilles
(courante au bleu, faite cochée — un geste FAIT, jamais deviné), une étape à la fois, un pied collé
(Retour · « Suivant : … » · à la dernière « Paire suivante · 3/5 » ou « Terminer ») :
1. **Réglages** — les mêmes que l'atelier (photos + préréglages, prix, titre, lettre), chaque bloc
   dit son résultat (« 49,00 € → 44,10 € », « ramené à ton prix d'achat » en ambre), et où le N° est
   posé (« Le N° « N°42 » est posé en bas de la description (Réglages → Numéros) ») ou pourquoi pas ;
2. **Photos** — l'aperçu réglé ; « Préparer / Enregistrer les N photos » : le MÊME dessin
   (`dessinerPhotoReglee`) ; iPhone : `navigator.share({ files })` dans le geste (Safari l'exige :
   préparer, puis « Enregistrer » ouvre le menu de partage) ; ailleurs, téléchargement
   `VRM-{N°}-01.jpg…` ; « N pas lues » en ambre ;
3. **Texte à copier** — l'aperçu de l'annonce telle qu'elle partira (photo réglée, prix — l'ancien
   barré —, titre, marque · taille · état, description avec le N° et la lettre), puis titre,
   description, prix (« 44,10 »), marque, taille, état : un « Copier » chacun, « Copié » puis
   « Recopier » ; « pas lu » dit quand VRM ne l'a pas (jamais « 0 ») ;
4. **Mettre en ligne sur Vinted** — les quatre gestes, ce qui n'est pas encore fait en ambre,
   « Ouvrir Vinted — nouvelle annonce ↗ » (note le début du suivi, mène à 5) ; « supprime
   l'ancienne, VRM ne supprime rien » (ou « rien à supprimer » pour une vente annulée) ;
5. **Relier la nouvelle annonce** — inchangé sur le fond (candidats du même compte, SON clic +
   confirmation, `liensRepubMain` → `repriseNumerosRecreation`).

**Plusieurs paires** : « à la main » n'est plus limité à une annonce (`parPaire` dans
`ACTIONS_SELECTION`) ; comptes mélangés permis (rien ne part d'ici, chaque paire nomme son compte),
mais chaque annonce doit avoir SON compte connu. La file (`repubMainFile`) tient l'ordre de ses
clics ; chaque paire repart de l'étape 1 avec les mêmes réglages et sa propre lettre.

Règles tenues : rien d'automatique côté Vinted, aucune suppression, identité par N° / identifiant
(le lien reste SON clic), pas su ⇒ dit.

## 3. Preuves

- `npm run build` vert.
- `node scripts/audit-republier-main.cjs` : **36 contrôles verts** (dont A7 et B1b-B1d : la clé ne
  reçoit que photo et lettre, prix et titre neutres à l'ouverture même si une baisse traînait dans la
  clé, la série garde ceux de son ouverture). Il EXÉCUTE la règle commune ET
  l'extension : `photoReglee` + `reglagesPhotoSurs` et `sansLettre` sont extraits de
  `vinted-sync-extension/background.js` et exécutés (fausse toile qui note chaque geste) — mêmes
  gestes, mêmes bornes que la toile « à la main » et l'aperçu de l'atelier ; un réglage posé
  dans l'atelier ⇒ même titre et même prix à la main (%, €, arrondi, prix commun, plancher,
  titre) ; N° dans la description (bas, haut, fin du titre, refus > 100 dit) ; branchement de
  l'app (les deux feuilles sur `useReglagesRepub`, aucune copie de prix/titre/filtre/rotation
  dans App.jsx ni annoncesActions.js, clé synchronisée, « Mêmes réglages » dit des deux côtés).
- `--prouve` : **22/22 mutations rouges**, dont 5 « une baisse gardée d'une ouverture à l'autre »
  (module qui la relit, module qui l'écrit, crochet qui écrit tout, relecture du nuage qui la reprend,
  série qui l'oublie), 9 « copies qui divergent » (prix recopié dans
  App.jsx, filtre et rotation écrits dans la main, aperçu de l'atelier recopié, texte de la main
  qui ignore la baisse, réglages locaux à la main ou à l'atelier, clé hors SYNC_KEYS, « Modifier »
  qui partagerait, `filtreReglages` recopié dans annoncesActions) et 8 règles affaiblies (bornes
  qui divergent de l'extension, rotation oubliée, baisse ignorée, N° oublié, lettre empilée,
  plancher oublié, prix pas lu = 0, valeur inconnue gardée).
- Arbre d'avant (`git archive 46f18482`, l'audit copié dedans) : **10 rouges sur 13** — pas
  seulement « module absent » : l'atelier et la main n'ont pas de source commune, App.jsx et
  annoncesActions.js portent chacun leur copie (prix, filtre, rotation), clé non synchronisée,
  rien n'est dit. Divergence MESURÉE sur cet arbre (sa `filtreReglages` contre la
  `reglagesPhotoSurs` de l'extension, exécutées) : zoom 1,8 réglé dans l'atelier ⇒ la main
  téléchargeait une photo zoomée à 1,5, l'extension à 1,8 ; lumière 1,55 ⇒ la main 1,55,
  l'extension 1,5.
- Banc `republier-main` sur le build de l'arbre d'avant (390 clair) : rouge — l'atelier ne dit
  pas « Mêmes réglages », n'écrit aucune clé commune, rien de « gardé » ; « Republier à la main »
  sur deux paires est refusé (« Une annonce à la fois : coche-n'en qu'une », capture regardée) et
  le parcours s'arrête.
- `audit-annonces-actions` 63/63 (B5 « à la main » plusieurs, B19 comptes mélangés, B20 compte
  inconnu, E1 bornes de l'extension) ; `--prouve` 21/21.
- Verts : `audit-coherence`, `audit-identite`, `audit-etiquette-numero`, `audit-republier`,
  `audit-republier-question`, `audit-republier-plusieurs-chrome`, `audit-tdz`, `audit-variables`,
  `audit-boutons`, `audit-icones`, `audit-rouge-doublon`, `audit-chrome-en-dur`.
- Banc `scripts/bancs/republier-main.cjs` (données inventées, 390 tactile et 1512, clair et
  sombre ; photos du CDN servies par une vraie petite image) — par vue : régler dans l'atelier
  (−10 %, zoom 1,2, lettre) ⇒ clé commune écrite, « Gardés : … » dit ; « à la main » sur deux
  paires : « Paire 1/2 », cinq étapes, la feuille à l'écran, zoom/lettre déjà réglés (et, depuis
  la décision ci-dessous, le prix à « Garder » puis SON clic −10 %), 44,10 €, aperçu photo `scale(1.2)`, description « … boîte d'origine.\n\nN°42\n\n{lettre} »,
  « Copier » ⇒ « 44,10 » dans le presse-papiers et « Copié », un seul bouton principal à
  l'étape 4, lien `https://www.vinted.fr/items/new` en nouvel onglet, « Paire suivante · 2/2 »
  (54 €, ancienne lettre « q » retirée), puis l'atelier rouvert (avant la décision : à −20 % ; depuis : à
  « Garder », retouche gardée), « Modifier prix ou titre » neutre, rien parti chez Vinted, 44 px, aucun débordement,
  aucune erreur. Résultat : 390 clair, 390 sombre, 1512 clair **0 rouge** (96 OK) ; 1512 sombre
  rejoué sur le build final avec 390 clair (`VUES=390-clair,1512-sombre`) : **65 OK, 0 rouge**.
  Captures regardées (390/1512, clair/sombre : réglages, photos, texte, Vinted, relier, atelier).
  ⚠️ Machine partagée très chargée pendant ce chantier (charge 40 à 60 sur 4 cœurs) : l'entrée
  de la feuille (320 ms) prenait plusieurs secondes ; le banc attend qu'elle soit posée et
  VÉRIFIE qu'elle est à l'écran (une feuille restée sous le bord passait tous les contrôles du DOM).
- Bancs voisins, sur le build final :
  · `vague2-ventes` (scène R, « Remettre en vente » ouvre la main) : **vert** (lecture du N° :
    `[data-main-num]`, le titre de la feuille n'écrit plus le N° une seconde fois) ;
  · `annonces-actions` : 116 OK, 1 rouge en 1512 sombre à l'étape R (« Republier s'ouvre… »,
    avant toute feuille « à la main » : un clic qui a agi sous charge, puis le repli du banc ne
    trouve plus la tuile). Corrigé dans ce banc : B/A « à la main » possible sur plusieurs et sur
    deux comptes ; les « nouvelles » annonces datées à la LECTURE (sous charge, une vue passait
    10 min après le départ et `candidatsNouvelle` les écartait : faux rouge de minuterie) ;
  · `republier` (atelier) : 2 rouges au 1er passage, 9 au 2ᵉ, sur le MÊME build — minuteries
    sous charge (journal pris « en pleine file », clics à 30 s). Le rouge constant, « 1 article
    sur tes autres comptes » au lieu de « paire », vient d'un texte que ce chantier ne touche pas
    (déjà dans 46f18482). Les contrôles du banc sur les réglages de l'atelier (−10 % ⇒ 44,10 €,
    plancher 47 €, zoom 1,2 dans l'aperçu, une photo par annonce, pas de réglage par annonce)
    sont verts aux deux passages. À rejouer sur une machine calme.

## 4. Ce qui reste

- **Extension** (non touchée, consigne) : écrire le N° (`vrm_num_vinted`) dans l'annonce lors de
  `recreerVinted` — aujourd'hui seule la main le pose ; l'audit compare déjà la photo et la lettre
  à l'extension, il faudra y ajouter l'étiquette quand elle l'écrira.
- La main ne lit que la description du coffre (l'extension préfère celle de la fiche de l'annonce
  quand elle est plus longue) : sans description au coffre, la main le dit et renvoie à Vinted.

## Geste de Julien

Annonces → Sélectionner : cocher deux annonces → Actions → Republier, régler une retouche et la
lettre puis fermer ; Actions → « Republier à la main » : la même retouche et la même lettre sont là,
le prix repart de « Garder » (choisir la baisse pour la série), suivre les cinq étapes ; sur iPhone, étape 2 → « Préparer » puis « Enregistrer les photos ».

## Mise à jour (6 nov., décision « prix et titre jamais gardés »)

Commit 5e82ee71 puis la passation : `reglagesGardes` / `reglagesAOuverture` / `resumeGardes`
(src/republierReglages.js), crochet `useReglagesRepub(encours)`, file `repubMainFile.encours`.
Banc `republier-main` adapté : la clé commune n'a ni prix ni titre ; à la main, retouche et lettre
reprises, prix à « Garder » (49 €) puis SON clic −10 % ⇒ 44,10 €, paire 2/2 à 54 € (la série) ;
rouvert, l'atelier repart de « Garder » (le −20 % de la main ne survit pas), la retouche gardée.
Résultat sur le build de ce commit (`VUES=390-clair,1512-sombre`) : **67 OK, 0 rouge** ; capture 390 clair regardée (bandeau « Mêmes réglages que Republier … le prix et le titre repartent de « Garder » à chaque ouverture »). Audits : `audit-republier-main` 36 verts, 22/22 mutations ; `audit-annonces-actions` 63 verts, 21/21 ; les douze autres audits listés plus haut verts.
