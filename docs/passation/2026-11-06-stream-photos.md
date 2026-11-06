# Stream : bouton au choix et photos floutées — 6 novembre 2026 (branche `v36-stream-photos`)

Demande de Julien (6 nov., mot pour mot) : « pour le bouton stream tu peux faire une option
qui n'apparaît que si on le sélectionne dans les paramètres ; je veux que on puisse aussi
flouter les photos en lien avec ce que on veut cacher ».

Base : le mode stream programmé du 5 nov. (`docs/passation/2026-11-05-mode-stream.md`,
`src/modeStream.js`). Rien de l'extension ni de `public/` n'a été touché.

## Ce qui est fait

### 1. Le bouton « Stream » n'apparaît que s'il est choisi
- Réglages → Affichage → Ce que le stream cache : **« Afficher le bouton Stream »**, éteint
  par défaut (`data-stream-option="bouton"`).
- Le choix vit DANS le programme synchronisé (`vrm_stream_regles.bouton`, ligne `main`,
  SYNC_KEYS) : même ligne que le programme, pas un drapeau du `localStorage`. Seul un
  `true` explicite montre le bouton (`normaliserRegles`).
- **Décision — l'œil des montants revient.** Avant la fusion du 5 nov., l'en-tête avait
  l'œil « Cacher les montants » (`data-bouton-montants`, 4 nov.) ; « Stream » l'avait
  remplacé. Cacher « Stream » sans rien remettre aurait fait perdre la seule façon de
  cacher ses chiffres d'un geste. Donc : sans le bouton « Stream », **l'œil est dans
  l'en-tête**. Il applique la MÊME règle réduite aux montants (`regleEffective()` →
  `R_MONTANTS` : ni pseudo, ni marque, ni bloc, ni photo ; `data-stream="m"` sur la
  racine). Propre à l'appareil (`vrm_montants_caches`, la clé du 4 nov.). La conversion
  « œil allumé ⇒ stream allumé » du 5 nov. est retirée (l'œil existe de nouveau).
- **Décision — stream allumé et option décochée : le bouton RESTE tant que le mode est
  allumé.** L'éteindre d'office aurait tout montré d'un coup pendant qu'il filme ; le
  garder sans bouton l'aurait laissé sans moyen rapide de l'éteindre. Un tap l'éteint, le
  bouton part, l'œil revient. Pendant un stream, l'œil se tait (le stream cache déjà les
  montants : une seule porte dans l'en-tête ; l'œil reste affiché s'il est lui-même allumé).
- Règle dans l'en-tête (`AppCoeur`) :
  `(bouton || streamOn) ? <BoutonStream/>` · `((!bouton && !streamOn) || œilAllumé) ? <BoutonMontants/>`.
  L'interrupteur « Mode stream » de Réglages marche toujours, bouton ou pas.

### 2. Les photos floutées, par LA MÊME règle que le texte
- `src/modeStream.js` : `compilerRegle` construit `rePhoto` avec les MÊMES listes et le
  MÊME `motif()` que le texte — ses marques (mot entier), ses « commence par… », ses
  « annonce entière qui contient… ». `photoACacherSelon(article, R)` (pur, testé) et
  `photoACacher(article)` (état du module : faux si le stream est éteint, faux avec l'œil
  seul). `texteArticle()` lit une phrase ou une fiche (titre, marque…), jamais l'adresse de
  la photo (« …/nike-air.jpg » n'est pas l'article).
- Deux réglages (synchronisés, dans le programme) : **« Flouter aussi les photos »**
  (`photos`, allumé par défaut : « pas su » ne montre rien) et **« Flouter toutes les
  photos »** (`photosToutes`, éteint par défaut).
- **Décision — les pseudos et noms de comptes ne floutent pas les photos.** La catégorie
  « comptes » est cochée par défaut et le nom du compte s'écrit sur presque chaque ligne :
  toutes les photos l'auraient été, sans que ses mots y soient pour rien. Pour tout flouter,
  il y a « Flouter toutes les photos ».
- **Un seul endroit dans la page** : la couche DOM du mode stream (`installerStream`, étape
  « 2 bis ») passe chaque `img` d'adresse distante, `blob:` ou `data:` (et tout élément
  marqué `data-stream-photo-cible`, ex. le canvas de recadrage du studio photo), retrouve le
  texte d'ORIGINE de son article — `data-stream-article` posé par l'écran (visionneuse
  « Agrandir », recadrage), sinon le texte de SA ligne (`ligneDe`, la règle des lignes
  entières : carte d'annonce, vente, achat, colis, conversation…), sinon le premier ancêtre
  proche qui porte du texte — et pose `data-stream-photo` si `photoACacherSelon` dit oui.
  Aucune vignette n'a besoin d'être modifiée : `PhotoVinted`, `PhotoVente`, `PileVignettes`,
  Leboncoin, eBay, Vestiaire, `QuiDorment`… sont des `<img>`. Contrôlé par grep : aucune
  photo posée en image de fond (`backgroundImage`) dans `src/`.
- Pas des photos : logos de VRM et des sites (fichiers de l'app, `.vrm-brand-icon`,
  `.vrm-brand-asset`, `.vrm-logo`), QR et bordereaux (`data-stream-image`, `alt^="QR"`,
  `data-mfa-qr`) — leurs flous restent ceux de leurs cases (codes, bordereaux) : pas de
  régression sur les codes de retrait.
- CSS (index.html, avant le premier rendu) : `[data-stream="1"] [data-stream-photo]` →
  `blur(22px) saturate(.7)`, gardé dans le cadre (`clip-path`) ; en GRAND (visionneuse,
  recadrage : sous `data-stream-article`) `blur(48px)` — à 22 px, la forme d'un logo de
  700 px se devinait (vu sur la capture de la visionneuse).
- **Textes alternatifs** : `alt` et `aria-label` suivent désormais la règle du texte comme
  `title` et `placeholder` ; l'`alt` d'une photo floutée est caché entier. (« Agrandir la
  photo de Adidas… » se lisait au lecteur d'écran.) Le texte alternatif d'un QR reste tel
  quel (le CSS le reconnaît à son début, il ne dit rien de secret).

### 3. L'aperçu dans les réglages
Sous l'aperçu du texte : deux vignettes INVENTÉES (une chaussure dessinée en SVG, « LOGO »)
— l'une avec le premier mot du programme (floutée), l'autre « Autre paire » (nette) —
décidées par `photoACacherSelon` sur la règle de l'aperçu, avec le même flou CSS que les
écrans (`[data-apercu-photo="floue"] img`). Sans aucun mot programmé, l'exemple prend
« Marque » et le dit.

## Preuves
- `npm run build` vert.
- `node scripts/audit-stream-photos.cjs` (nouveau) : 41 contrôles verts — programme (bouton
  caché, photos allumé, toutes éteint par défaut ; seuls les choix explicites changent),
  règle EXÉCUTÉE (marque cachée ⇒ floue ; autre marque ⇒ nette ; mot entier ; « commence
  par », « contient » ; pseudo seul ⇒ nette ; fiche objet ; adresse de photo ignorée ;
  « toutes » ⇒ floue ; photos éteintes ⇒ nette mais texte caché ; même source texte/photo),
  état du module (stream éteint ⇒ nette ; œil seul ⇒ nette et seuls les montants ; allumé ⇒
  la règle), branchement (en-tête, réglages, aperçu par la même règle, aucune autre règle de
  photo dans l'app, CSS, visionneuse, couche DOM, alt, QR et logos exclus, flou doublé en
  grand). `--prouve` : **15/15 mutations** passent au rouge. Sur l'arbre d'avant
  (`git archive be6b7179`, audit copié dedans) : rouge (module sans `photoACacherSelon`).
- `node scripts/audit-mode-stream.cjs` : vert ; 5.1 suit la décision (l'œil ne revient que
  sans « Stream ») ; la mutation « code en grand sans marqueur » visait un texte disparu
  (chantier D) : elle suit la forme actuelle. `--prouve` : **16/16**.
- Banc `scripts/bancs/stream-photos.cjs` (nouveau, port 9750 ; jeu inventé de
  `nouveau-vendeur.cjs` + photos SVG inventées marquées par marque ; programme « Adidas »),
  390 tactile et 1512, clair et sombre : A défaut sans « Stream », l'œil (44 px), l'œil ne
  cache que les montants ; B option et aperçu (floue/nette, flou calculé), option cochée ⇒
  « Stream » dans l'en-tête, POST de `main.vrm_stream_regles.bouton` ; C sur Annonces,
  Ventes, Colis, Messages, Achats : chaque photo Adidas floutée (attribut ET flou calculé
  ≥ 16 px), AUCUNE autre floutée, « Adidas » ni dans le texte ni dans alt/aria-label/title,
  visionneuse « Agrandir » floutée ; D « toutes » ⇒ toutes, « aussi » décoché ⇒ aucune ;
  E option décochée en plein stream ⇒ le bouton reste, l'œil se tait, un tap éteint tout.
  Résultats : voir « Mesures » ci-dessous. Captures REGARDÉES (aperçu, Annonces, Messages,
  visionneuse).
- Bancs voisins mis à jour (le bouton « Stream » est maintenant au choix) : `mode-stream`
  (programme avec `bouton: true`), `comptes-securite` et `compte-supprime` (leur base
  choisit le bouton), `coque-parametres` H1 (par défaut : l'œil, pas « Stream »).

## Mesures
- `stream-photos.cjs` **après** : **162 OK, 0 KO** (390 tactile et 1512, clair et sombre,
  parties A à E). Une première passe sous charge avait 3 rouges à 390 sombre (écran encore
  « pas lu » à 2,4 s, capture regardée) : le banc attend désormais qu'une photo du jeu soit
  à l'écran (15 s au plus) avant de juger — relancé : vert.
- **Avant** (`git archive be6b7179`, banc copié dedans, construit et lancé depuis cet arbre) :
  **16 KO** à 390 clair et **16 KO** à 1512 sombre — « Stream » toujours là et pas d'œil, pas
  d'option ni d'aperçu, aucune photo Adidas floutée (Annonces 3, Ventes 2, Colis 1,
  Messages 1, visionneuse), « Adidas » lisible dans un `aria-label` et l'`alt` de la
  visionneuse, « toutes » sans effet, le bouton ne part pas à l'extinction.
- **Mutation** (couche DOM qui ne demande plus `photoACacherSelon`, arbre reconstruit) :
  **5 KO** (les quatre écrans et la visionneuse).
- Bancs voisins relancés après (dist de la branche) : `mode-stream` (A, B, D, E ; 390 et
  1512 clair) **27 OK** ; `comptes-securite` (B, 390 clair) **16 OK** ; `compte-supprime`
  **22 OK** ; `coque-parametres` (390 et 1512 clair) **60 OK** (H1 : par défaut l'œil, pas
  « Stream »). Audits : `audit-coherence`, `audit-identite`, `audit-composants`,
  `audit-secrets`, `audit-icones` verts.
- Captures regardées : aperçu des réglages (une vignette floutée, l'autre nette, légende
  « ••• Air Max 90 »), Annonces 1512 sombre (la carte Adidas floutée entre Asics et New
  Balance nettes), Colis 1512 clair, Messages 390 (la conversation Adidas floutée, Nike et
  New Balance nettes), visionneuse (flou doublé : ni lettres ni forme), en-tête par défaut
  (l'œil, pas « Stream »).

## Ce qui reste / limites dites
- Une photo dont l'article n'a AUCUN texte autour (une grille de vignettes nues sous un titre
  général) prend le texte de l'ancêtre proche : elle peut être floutée en trop (jamais en
  moins si le titre porte le mot). Le banc n'en a vu aucune sur les cinq écrans.
- Stock 3D (canvas WebGL, photos peintes dans la scène) : pas flouté photo par photo.
- Une marque visible SUR la photo d'un article dont le texte ne la nomme pas : non reconnue
  (on ne lit pas l'image) — « Flouter toutes les photos » est là pour ça.
- Notifications push du serveur, PDF ouverts dans un autre onglet : inchangé (voir le 5 nov.).
- Geste de Julien : Réglages → Ce que le stream cache → cocher « Afficher le bouton Stream »
  s'il le veut en haut ; écrire ses marques ; regarder l'aperçu des photos.
