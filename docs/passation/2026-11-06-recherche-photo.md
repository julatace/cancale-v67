# Recherche par photo — 6 novembre (branche `v36-recherche-photo`)

> File de la vague 1. Julien a une paire en main, il la prend en photo : VRM
> propose les annonces et fiches dont la photo lui ressemble le plus (parmi SES
> photos d'annonces), **il choisit**. Rien n'est relié tout seul (§5 : une
> proposition peut utiliser la ressemblance, c'est toujours SON clic qui relie).

## Ce qui a changé (pour lui)

- **La loupe** gagne un **appareil photo** (à côté du micro) : sur ordinateur
  dans la barre du haut, sur téléphone dans l'en-tête de recherche.
- **Stock** gagne « **Par photo** » (ligne de titre, slot `right` de `ScreenHead`).
- Les deux ouvrent la feuille **« Chercher par photo »** (`SheetShell`) :
  « Prendre la paire en photo » (appareil du téléphone, `capture="environment"`)
  ou « Choisir une image ». La photo **ne quitte pas l'appareil**.
- Résultat : **les 5 plus ressemblantes**, la plus proche d'abord, chacune avec
  sa photo, son N° (ou « Sans N° »), son compte, son état (En ligne · À confirmer
  · Vendue (prouvée) · Pas en ligne sur Vinted · État pas lu) et **un mot** :
  « Très proche » / « Proche » / « Peu sûr ». **Jamais « c'est elle »** — la
  feuille le dit : deux paires du même modèle et de la même couleur se
  ressemblent autant.
- **Le clic** ouvre « Tout sur le N° » de CE numéro (`vrm:fiche-article`) ; une
  annonce sans N° mène à Annonces. **Aucune écriture** (banc D).
- En bas : combien de photos ont été comparées, combien **n'ont pas pu être
  lues** (dites, jamais classées à zéro), combien de fiches sont sans photo.

## Comment (le code)

| fichier | rôle |
|---|---|
| `src/empreintePhoto.js` | PUR (aucun DOM) : l'empreinte d'une image, la comparaison, le classement, les seuils |
| `src/indexPhotos.js` | l'index sur l'appareil (IndexedDB `vrm_empreintes_photos`, **clé = URL exacte** de la photo), le calcul à la demande, 3 lectures à la fois, borne 4 000 |
| `src/RecherchePhoto.jsx` | la feuille, **chargée à la demande** (`React.lazy`) |
| `src/App.jsx` | `RecherchePhoto` (lazy), `ouvrirRecherchePhoto` (`vrm:recherche-photo`), `lireCandidatsPhoto`, `BoutonPhotoRecherche`, le bouton du Stock |

**Les candidats** (`lireCandidatsPhoto`) : la 1re photo de chaque annonce **en
ligne** (la règle `lireLignesEnLigne`, §11 — « à confirmer » compris et dit) et
de chaque **fiche N°** (`vinted_annonce_numeros`), **une entrée par annonce**
(son id, jamais son titre). Le N° est celui de la fiche de CETTE annonce ;
« vendue » seulement **prouvée** (`lirePreuvesVenteVinted`). Ses comptes cherchés
seulement (`comptesRecherche`). Rien lu du tout ⇒ « je n'ai pas pu lire tes
annonces » (pas su ≠ aucune).

**L'empreinte** (≈ 330 nombres, ~30 ms par photo dans Node) :
- `couleur` : histogramme teinte × saturation (12 × 2) + 4 gris, pondéré par
  « ce qui n'est pas le fond » — le fond = jusqu'à 3 couleurs dominantes du bord
  (k-moyennes sur l'anneau de 4 px), chacune ≥ 12 % de l'anneau — et par le
  centre ; **balance des blancs** (chaque canal rapporté à son 97e centile, gains
  bornés 0,75–1,33) ; luminosité rapportée à l'objet (95e centile). Quand presque
  rien ne se distingue du fond (paire blanche sur mur blanc), un **plancher**
  garde un peu du fond ;
- `centre` : le même histogramme, centre seul (sert à reconnaître la même photo) ;
- `grille` : chromaticité moyenne de 4 × 4 cases ;
- `bords` : orientations des contours (8 × 5) ;
- `dh`/`ph` (+ `dhm`/`phm` en miroir) : dHash et pHash 64 bits.

**Le score** = 0,7 × couleur + 0,1 × bords + 0,2 × grille, + jusqu'à 0,15 quand
le hachage est presque identique **et** les couleurs aussi (la même photo,
recadrée/rééclairée/retournée). ⚠️ Le hachage **seul** ne compte jamais : ses
photos d'annonces sont toutes prises au même endroit, de la même façon — deux
paires de couleurs différentes y ont le même dessin en gris (l'audit l'a montré :
la première version, qui laissait le hachage décider, plaçait une AUTRE paire en
tête dans 4 cas sur 32).

**Le mot** dépend du score ET de sa place dans SON catalogue (`relatif` : 1 = la
plus ressemblante, 0 = la médiane) : « Très proche » = score ≥ 0,85 et relatif ≥
0,97 ; « Proche » = ≥ 0,78 et ≥ 0,8 ; sinon « Peu sûr ».

## Les photos Vinted sont-elles lisibles par la page ? Non.

- **Pas re-mesuré aujourd'hui** : depuis ce conteneur, `images1.vinted.net` est
  injoignable (le proxy ne laisse passer que le registre npm). La mesure qui fait
  foi est celle d'août (`docs/journal-2026.md`, « vérifié au `curl` : le CDN
  Vinted ne renvoie **aucun** en-tête CORS »), redite par `src/photosVinted.js`
  et `chargerPhotoBoite` (28 oct.) : une page peut AFFICHER la photo, pas en lire
  les pixels (canvas « sali »).
- ⇒ L'index passe par **le chemin que l'app utilise déjà** : `chargerPhotoBoite`
  — l'**extension** d'abord (`vmrPhoto`, la photo reste sur l'appareil), sinon la
  **route de VRM** `/api/compte?mode=photo` (session exigée, CDN Vinted seul,
  rien écrit). Aucune route ajoutée (plafond des 12 fonctions). Une photo `data:`
  / `blob:` est lue directement.
- Ce qui est possible : sur le téléphone **sans** extension, la route de VRM lit
  les photos (une requête Vercel par photo, **une seule fois** : ensuite
  l'empreinte est gardée sur l'appareil). Hors ligne ou session morte : les
  photos pas lues sont **dites**.

## Le modèle (MobileNet & co) : pas retenu — et pourquoi, chiffres à l'appui

- Sur le jeu inventé en 3D (ci-dessous), l'empreinte sans modèle met **la bonne
  paire dans les 5 proposées 120 fois sur 120** (top 5 = 100 %) : un modèle ne
  peut rien y gagner sur ce qui compte (c'est SON clic qui choisit parmi 5). Le
  top 1 (82,5 %) rate surtout des sosies faits exprès (tiges blanches à accent
  près) et la vue avec une main devant.
- **Je n'ai pas pu mesurer un modèle honnêtement ici** : les poids (MobileNet,
  EfficientNet…) ne sont joignables que par des hôtes bloqués depuis ce conteneur,
  et un réseau entraîné sur des photos naturelles jugé sur des chaussures
  dessinées en 3D mesurerait une fiction. Le coût, lui, est connu : 3,5 à 14 Mo de
  poids + ~10 Mo de moteur WebAssembly (onnxruntime-web, que le studio photo
  charge depuis cdn.jsdelivr.net — un tiers, ce que la consigne exclut ici).
- **Suite proposée** si Julien trouve les propositions trop souvent à côté sur
  ses vraies paires : un banc « sur tes photos » (lecture seule, ses photos
  d'annonce contre 20 photos prises à la main, rien dans le dépôt) pour comparer
  l'empreinte à un modèle hébergé dans `public/modeles/` (licence vérifiée, à la
  demande), et ne garder le modèle que s'il gagne en chiffres.
- `public/modeles/` contient aujourd'hui `u2netp.onnx` (détourage du studio,
  Apache 2.0) : **ce n'est pas un modèle de reconnaissance** (il sort un masque,
  pas une empreinte) — il n'a pas été réutilisé.

## Les preuves

### Mesure (`node scripts/mesure-recherche-photo.cjs`, ~3 min sous swiftshader ; `MESURE_CACHE=fichier` garde le rendu)
40 paires inventées dessinées en 3D (three.js) — dont 10 à tige blanche qui ne
diffèrent que par l'accent, et deux couples de **jumelles** (même modèle, même
couleur : l'une ou l'autre compte juste) — photographiées « pour l'annonce »
(profil, fond clair) puis **à la main** sous 3 vues : +25° fond sombre + bois +
lumière chaude + main ; −40° fond bleu-gris lumière froide ; plongée 45° + main.
120 recherches. Le vrai module, tel quel.

| empreinte | top 1 | top 5 |
|---|---|---|
| hachage seul (dHash/pHash) | 5 % | 15 % |
| bords seuls | 6,7 % | 12,5 % |
| grille seule | 64,2 % | 90,8 % |
| couleur du centre seule | 68,3 % | 96,7 % |
| couleur sans le fond seule | 84,2 % | 100 % |
| **retenu** | **82,5 %** | **100 %** |
| meilleur d'une grille de 144 jeux de poids | 83,3 % | 100 % |

Étapes mesurées : couleur avec fond = médiane du bord 51,7 % → fond en
k-moyennes 73,3 % → + balance des blancs 80,8 % (top 5 99,2 %) ; un « point
noir » par canal en plus : 74,2 % (retiré). Mots : « Très proche » est juste
82 % du temps (86 vraies sur 120 le reçoivent), « Proche » rattrape 27 vraies,
« Peu sûr » en garde 19 (les vues les plus dures).

### Audit (`node scripts/audit-recherche-photo.cjs`) — exécute le vrai module sur 32 images INVENTÉES
- A. la même image **recadrée (2 façons), plus sombre, plus claire et chaude,
  froide et voilée, bruitée, réduite, retournée, recadrée+sombre+bruitée** : **en
  tête 32/32 à chaque fois**, jamais « peu sûr », « très proche » ≥ 31/32 ;
- B. deux paires **différentes au même titre** (« Nike Air Force 1 blanc taille
  42 ») : chacune désigne la sienne, deux lignes, deux N° ; des titres tous
  identiques ne changent ni l'ordre ni les scores ; deux annonces à la même photo
  ⇒ deux lignes au même score ;
- C. les mots : jamais « c'est elle » ; D. aucune requête, aucune écriture, aucune
  adresse tierce dans les trois fichiers ; chargement à la demande ; octets par
  `chargerPhotoBoite` ; index par URL ; E. une photo pas lue n'est pas classée.
- **Rouge sur l'arbre d'avant** (`git archive claude/project-review-nsk5su`) : le
  module n'existe pas ⇒ KO. **Mutations** (`AUDIT_MUTATION=`) : `titre` (fusion
  par titre) ⇒ 13 KO ; `aveugle` (score qui ne regarde pas l'image) ⇒ 10 KO ;
  `lumiere` (luminosité non rapportée à l'objet + bonus « même photo » retiré) ⇒ 3 KO.
- Il a attrapé deux vrais défauts pendant le chantier : le hachage qui décidait
  seul (autre paire en tête), et la paire blanche sur mur blanc qu'un recadrage
  faisait perdre (d'où le plancher).

### Banc (`BANC_PORT=10352 node scripts/bancs/recherche-photo.cjs`, après `npm run build`)
390 px tactile et 1512 px souris ; photos dessinées dans la page et servies
comme le CDN (sans en-tête CORS) ; la prise de photo = un fichier posé dans le
champ de l'appareil photo. **58 contrôles verts** :
- A : l'appareil photo de la loupe (barre / en-tête) et « Par photo » du Stock
  ouvrent la feuille ;
- B : la N°13 photographiée « à la main » (fond sombre, sépia, zoom, main) est
  **en tête** (0,745 contre 0,633 pour la suivante — dite « Peu sûr » : le mot
  reste prudent quand la photo est très différente), 5 lignes, photo affichée,
  N°, compte, état, mot ; la fiche N°99 sans photo comptée « sans photo » ;
- C : la N°15 (même titre que la N°14) en tête, « Très proche » (0,852) ; la
  N°14 3e, sa ligne et son N° à elle ;
- D : **aucune écriture** pendant la recherche ; le clic ouvre « Tout sur le
  N°15 » ; après le clic, aucune écriture d'identité ni de lien (seul le résumé
  `lbc_a_retirer`, publié par l'app comme sur tout écran) ;
- E : **aucune requête tierce**, aucun modèle ni moteur chargé, le CDN Vinted
  seulement pour AFFICHER les vignettes (balises image), les 8 photos lues par
  la route de VRM une fois chacune ;
- F : 2e recherche ⇒ 0 photo relue ; **après rechargement** ⇒ 0 photo relue
  (IndexedDB) ; G : une photo refusée (503) est comptée « pas lue », jamais
  classée ; H : lignes 74 px, rien ne déborde, aucune erreur de page.
- **Rouge sur le build d'avant** (aucun appareil photo, aucune feuille) ;
  `BANC_MUTATION=sans-index` (index effacé avant le rechargement) ⇒ 2 rouges.
- Captures regardées (390 et 1512 : feuille avec résultats, même titre, « Tout
  sur le N°15 »).
Il a attrapé un défaut : l'effet qui libérait l'aperçu arrêtait aussi la
recherche (la feuille restait sur « Je compare… »).

### Poids au premier chargement : 0
Build d'avant (`claude/project-review-nsk5su`) contre build d'après : l'entrée
`index-*.js` est **identique** (82 732 o) ; le morceau `App-*.js` n'a pas grossi
(3 998 464 → 3 997 356 o, la différence vient du minifieur) ; tout le reste est
au même octet. Le seul ajout est `RecherchePhoto-*.js` (16 468 o, 7 032 o
gzip : la feuille, l'empreinte, l'index), téléchargé **au premier clic** sur
l'appareil photo. Aucun modèle, aucun moteur.

### Autres audits
`npm run build`, `audit-identite`, `audit-coherence`, `audit-csp` (aucun modèle
chargé : rien à ouvrir), `audit-secrets`, `audit-icones`, `audit-boutons`,
`audit-rouge-doublon` : verts.

## Limites (à dire à Julien)

- **Ressemble ≠ est** : deux paires du même modèle et de la même couleur sortent
  ensemble, au même score. C'est voulu. Le N° et le carton tranchent.
- Une main devant, une lumière très chaude, une autre pièce : le score baisse
  (c'est la vue la plus ratée de la mesure). Conseil à l'écran : photographier
  la paire **de profil, sur un fond uni**.
- Les paires **blanches** se départagent mal par la couleur (le détail d'une
  virgule pèse peu) : « Proche » plus souvent que « Très proche ».
- La **première** recherche lit toutes ses photos (une par annonce) : quelques
  secondes à une minute selon le nombre ; ensuite, seulement les nouvelles.
- Seules les photos **Vinted** sont indexées (annonces en ligne + fiches N°).
  Leboncoin, eBay, Vestiaire et les photos du studio : pas encore (leurs CDN
  n'ont pas été mesurés ; le studio garde des photos lourdes en base).
- L'index vit **dans ce navigateur** : un autre appareil le recalcule.

## Gestes de Julien
1. Ouvrir VRM **sur le navigateur où l'extension est installée** la première
   fois (les photos passent par elle, rien ne sort de l'appareil).
2. Loupe → appareil photo → photographier une paire de profil → choisir.
