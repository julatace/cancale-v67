# 14 nov. 2026 — Mode exemple : des photos, et impossible à confondre

Branche `claude/exemple-photos` (depuis `origin/main` a8220150, puis vrai `git merge origin/main`).
Pas de PR (consigne). Rien dans `vinted-sync-extension/`, aucune migration, aucune fonction `api/`.

Julien, devant le mode « Découvrir avec des exemples » sur ordinateur : « fais des exemples avec des
photos pour les annonces ». Et il a cru que « Le Fournil, Rennes » (le point relais d'exemple) était un
de SES colis : l'exemple ne se voyait pas assez.

## 1. Les photos — PAS FAITES : le réseau du conteneur les bloque

Consigne : 20 à 30 vraies photos de sneakers d'occasion sous licence CC0 / domaine public
(Wikimedia Commons, Openverse filtré CC0), Unsplash License ou Pexels License, licence vérifiée sur
la page source, crédit par photo, WebP 400×400 et 120×120 < 40 Ko.

**Mesuré le 14 nov.** : le proxy de la session refuse le tunnel (`CONNECT … 403 Forbidden`) vers
**tous** les hôtes des sources permises :

| hôte | réponse |
|---|---|
| `commons.wikimedia.org` | 403 au CONNECT (WebFetch : hôte hors des domaines permis) |
| `upload.wikimedia.org` | 403 au CONNECT |
| `api.openverse.org`, `openverse.org` | 403 au CONNECT |
| `unsplash.com`, `images.unsplash.com` | 403 au CONNECT |
| `www.pexels.com`, `images.pexels.com`, `api.pexels.com` | 403 au CONNECT |
| (aussi essayés) `www.flickr.com`, `live.staticflickr.com`, `pixabay.com`, `cdn.pixabay.com`, `huggingface.co` | 403 au CONNECT |

Seuls les registres de paquets passent (npm, PyPI) : aucune photo vérifiable par sa page source.
L'environnement de la session est le « Default » (réseau limité, aucune hôte ajouté).
**Rien de faux n'a été mis** : aucune photo d'origine inconnue, aucune image générée.

### Ce qui est prêt pour le jour où le réseau les laisse passer
- `src/exemplePhotos.js` — `PHOTOS_EXEMPLE` (vide), `LICENCES_PERMISES` (licence ⇒ site de la page
  source), `photoDeLaPaire(k, origine)`, `descriptionDeLaPaire(k)`.
- `src/exempleDonnees.js` — chaque paire d'exemple a un numéro fixe `k` (annonces 0-11, ventes
  12-15, achats 16-18 : **19 paires**). Avec une photo propre, l'article reçoit
  `photo: { url: {origine}/exemple/{fichier}-400.webp, thumbnails: [-120.webp] }` et son titre
  devient « {marque} {modèle} {couleur} taille {t} » — **ce que montre la photo**. La même paire
  garde la même photo partout (vente 62000 ⇔ son bordereau, achat 73000 ⇔ son code au relais : par
  n° de transaction, jamais par titre). **Une photo n'est jamais prêtée à deux paires** (VRM tient
  deux fiches au même fichier pour la même paire, `jumellesParPhoto`) : au-delà de la liste, la
  vignette neutre reste. Sans origine, ou avec le catalogue mélangé des captures de l'accueil :
  aucune photo. Liste vide : le jeu est exactement celui d'avant.
- `src/modeExemple.js` — passe `window.location.origin` au jeu (les photos viennent de `public/`,
  même origine, CSP `img-src 'self'`).
- `public/exemple/CREDITS.md` — les règles et le tableau (vide).

### Pour ajouter les photos (session suivante, réseau ouvert)
1. Ouvrir les hôtes (Julien : environnement de la session → réseau → hôtes permis
   `commons.wikimedia.org`, `upload.wikimedia.org`, et/ou `unsplash.com`, `images.unsplash.com`,
   `www.pexels.com`, `images.pexels.com`).
2. Pour chaque photo (19 suffisent pour les 19 paires, 20-30 demandées) : lire la licence SUR la
   page source (Commons : « Licensing » = CC0 ou Public domain ; Unsplash : « Unsplash License »,
   pas « Unsplash+ » ; Pexels : « Free to use »), refuser toute personne identifiable et toute
   capture d'annonce, noter auteur + URL de la page + licence + date.
3. Recadrer carré, fond simple, profil : `convert src.jpg -resize 400x400^ -gravity center -extent
   400x400 -quality 72 -strip x-400.webp` puis `-resize 120x120` (ImageMagick est là ;
   `cwebp` absent) ; vérifier < 40 Ko.
4. Une ligne dans `PHOTOS_EXEMPLE` (`fichier`, `marque`, `modele`, `couleur` = ce qu'on voit) et
   une dans `CREDITS.md` (`| fichier | ce qu'on voit | auteur | page source | licence | AAAA-MM-JJ |`).
5. `node scripts/audit-exemple-photos.cjs --complet` puis le banc `exemple-photos` (P1 doit passer).

## 2. Impossible à confondre (fait)

- **Bandeau** (`BandeauExemple`, `src/GuideDemarrage.jsx`, sur tous les écrans de la coque) :
  étiquette « EXEMPLE » à l'encre pleine, « Exemple — données inventées », « Rien n’est à toi,
  rien n’est envoyé. », un liseré hachuré dessous. Sans compte : « Créer mon compte » (seul bouton à
  l'accent) et, À CÔTÉ, « J’ai déjà un compte · Me connecter » (→ `/?connexion`, l'exemple sort, la
  clé de l'onglet est retirée). Connecté : « Passer à mes vraies données » comme avant. Au
  téléphone : deux lignes (texte + bouton, puis le lien), 44 px au doigt.
- **Cadre** (`CadreExemple`, portail dans `<body>`) : un filet hachuré de 3 px tout autour de
  l'écran et une languette « Exemple · données inventées » qui pend du bord haut — au-dessus de
  TOUT (z 2147483647, le plus haut : feuilles, confirmations, loupe, pastille « Ouverture… » à 2147483000), `pointer-events: none`, `aria-hidden`
  (le bandeau le dit aux lecteurs d'écran), caché à l'impression.
- **« exemple » sur les codes et les adresses** : la racine porte `data-vrm-exemple` (posé par
  `installerModeExemple`) ; la feuille de style ajoute une petite marque grise « EXEMPLE » après
  chaque élément que l'app marque déjà sensible (`data-stream-type="code"` / `"adresse"`, le mode
  en direct), chaque `.vrm-rp-code` et chaque adresse de point relais (`[data-relais-adresse]`).
  C'est un `::after` : rien ne change dans le texte copié ni lu par les bancs ; le mot vient de
  `tr('exemple.mot')` (`--vrm-exemple-mot`).
- **Lieux fictifs** : « Le Fournil, 8 Rue de la Paix » (peut-être une vraie boulangerie) devient
  **« Relais Exemple, 12 rue Imaginaire, 35000 Rennes »** (`LIEU_EXEMPLE`) ; la ville reste pour
  que le code postal se lise.
- Textes : 9 clés `exemple.*` en fr, en, es, it, de ; `BandeauExemple` et `CadreExemple` ajoutés
  aux écrans migrés d'`audit-traduction` (un texte en dur y rougit).
- « Quoi de neuf » : `exemple-impossible-a-confondre`.

## Preuves

- `npm run build` vert (après le vrai `git merge origin/main`).
- **Audit `audit-exemple-photos`** (nouveau) : C1-C2 crédits (licence permise, page source sur le
  site de SA licence), F1-F2 fichiers (WebP 400/120, < 40 Ko, crédités), L1 liste, B1-B2 branchement
  sur 20 entrées SIMULÉES dans une copie temporaire (19 paires, jamais deux sur la même photo, titre =
  ce que montre la photo, vente ⇔ bordereau, rien sans origine ni avec le catalogue de l'accueil, liste
  vide = jeu d'avant), S1 aucune image en dur ni hôte externe. **Vert** ; `--prouve` : témoin (photo en
  règle) vert, **10/10 mutations rouges** (licence CC BY-SA, page source d'un autre site, image sans
  crédit, image de 41 Ko, mauvaise taille, photo prêtée par modulo, titre qui ne suit pas la photo,
  vente sans photo, hôte externe, photo sans origine). Sur origin/main : rouge (module absent).
  `--complet` (≥ 20 photos) : rouge tant que la liste est vide — c'est voulu.
- **Banc `exemple-photos`** (nouveau ; 390 tactile et 1512, clair et sombre, 4 passes de < 9 min) :
  B1 bandeau + cadre + languette au-dessus de tout sur 9 écrans, B2 loupe ouverte, B3 « exemple » sur
  codes et adresses (Achats « À retirer », une ligne ouverte), B4 plus de « Le Fournil » ni « rue de la
  Paix », « Relais Exemple », C1 « Me connecter » (44 px, libre, mène à `?connexion`, l'exemple
  disparaît, aucune session réelle), W1 **0 requête vers la base ni /api, 0 écriture sortie**, rien ne
  déborde, 0 erreur JS : **66 OK par passe, tous verts** ; seuls rouges : **P1 (4 par passe : Annonces,
  Ventes, Achats, Colis — « 0 photo d'exemple pour 9 articles »)**, attendus tant que les photos
  manquent. Sur **origin/main** (390 clair) : **47 KO** (B1 × 36, B2, B3, B4, C1, P1). Mutations sur le
  `dist` (CSS du cadre à z 1, marque `content: none`) : B1 × 9, B2, B3 rouges.
- Bancs touchés, verts : `exemple-accueil` (52 OK, 390 + 1512 clair), `mode-exemple` (116 OK).
- Audits verts : `traduction` (45 ; `BandeauExemple`/`CadreExemple` ajoutés aux écrans migrés),
  `tdz`, `csp`, `mode-exemple`, `quoi-de-neuf`, `textes-courts`, `violet`, `boutons`.
- **Captures regardées** (390 et 1512, clair et sombre) : bandeau au téléphone (phrase + « Créer mon
  compte », lien dessous), à l'ordinateur (étiquette EXEMPLE, phrase, gestes à gauche de l'île), la
  languette (haut gauche au téléphone, bas centre à l'ordinateur), le cadre hachuré, la loupe ouverte
  (languette au-dessus), la fiche d'un colis à retirer, l'écran de connexion après « Me connecter ».
- Le banc attend la fin de l'écran de démarrage (`#vrm-demarrage`, z 2147483000) sur une condition :
  sans cela, « rien ne couvre » jugeait le chargement (machine chargée : 4 s).

## Limite connue
- Dans la fiche d'un colis (« Une seule fiche partout »), le code est écrit DANS la phrase du haut
  (« Colis à retirer · 582913 ») : pas d'élément propre, donc pas de marque « exemple » à côté. Le cadre
  et la languette restent au-dessus de la fiche.

## Restes
- **Les photos** (§1) : bloquées par le réseau. Geste de Julien : ouvrir les hôtes, puis une
  session les pose (méthode ci-dessus).
- Les captures de la page d'accueil (`public/accueil/`) montrent encore « Le Fournil » (prises avant
  ce lot, et leurs textes alternatifs `accueil.moment.colis.alt` le nomment) : à reprendre avec
  `scripts/accueil-captures.cjs` dans un lot qui touche l'accueil.
