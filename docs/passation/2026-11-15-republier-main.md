# 15 nov. 2026 — Republier à la main et publier à la main, guidés

Branche `claude/republier-main` (depuis `origin/main` ea152a4b). Pas de PR (consigne).
Ni `vinted-sync-extension/` ni `public/` touchés : aucune version d'extension montée.

Julien (15 nov., mot pour mot) : « pareil pour la republication à la main, tout doit être
beaucoup mieux, accompagné, même la publication tout court ; avec la republication à la main,
une fois que l'application a modifié les photos, envoie directement dans la galerie les photos
à l'utilisateur en lui disant que tout a été envoyé ».

⚠️ **La limite, tenue** : il a aussi écrit « modifié pour éviter de se faire bannir ». Modifier
des photos pour échapper à la détection de Vinted est **refusé** (§3, « Modifier les photos pour
tromper / changer de compte »). Rien de tel n'est construit : aucun bruit, aucun recadrage
aléatoire, aucune retouche qui change d'une photo à l'autre. Le réglage existant reste ce qu'il
était — de la PRÉSENTATION, un réglage pour toutes, choisi par lui (« Varier » et le réglage par
annonce restent retirés). Aucun texte de l'app ne parle de ban, de détection ou d'éviter Vinted ;
`scripts/audit-republier-guide.cjs` le vérifie dans les 5 langues et exécute la retouche (aucun
tirage au hasard).
⚠️ **À trancher par Julien (pas touché ici)** : l'option existante « Ajouter une lettre au hasard
tout en bas » de la description (6 nov., atelier ET main). Elle n'est pas une retouche photo, ce
chantier ne l'a ni créée ni étendue — mais son seul effet est de rendre la description différente
de l'ancienne. Elle reste repliée dans « Prix et titre · Changer », éteinte par défaut.

## 1. Mesure d'abord (code de `origin/main`)

**Republier à la main, une paire, iPhone**, depuis Annonces → Republier :

| # | avant (lu dans le code, ea152a4b) | moment où il ne sait pas quoi faire |
|---|---|---|
| 1 | cocher la paire | |
| 2 | « À la main · 1 » ⇒ le **kit** (cartes, « Pas à pas » / « Ouvrir Vinted ») | deux chemins, lequel ? |
| 3 | « Pas à pas » ⇒ feuille en 5 étapes, ouverte sur **Réglages** | un écran de réglages avant tout geste |
| 4 | « Suivant : Photos » | |
| 5 | « Préparer les 2 photos » | |
| 6 | « Enregistrer les 2 photos » (+ « Enregistrer 2 images » du système) | pourquoi deux boutons ? |
| 7 | « Suivant : Texte » | |
| 8-10 | Copier titre, description, prix | |
| 11 | « Suivant : Vinted » | |
| 12 | « Ouvrir Vinted — nouvelle annonce » | |
| — | supprimer l'ancienne : **une phrase**, aucun lien, rien vérifié | où est-elle ? est-ce fait ? |
| 13 | « Relire mes annonces » | |
| 14-15 | « C'est celle-ci » + « Oui, c'est elle » | |
| 16 | « Terminer » ; rien noté dans « Ce que VRM a fait » | c'est fini ? |

**15 touchers** jusqu'à la nouvelle annonce désignée (+1 système), 5 moments flous.

**Publier tout court** (fiche « À publier ») : « Créer sur Vinted » (l'extension prépare un
brouillon) ou « Copier » (un seul bloc de texte). Aucune photo vers la galerie, aucun champ à
copier un par un, rien ne dit si l'annonce est publiée.

## 2. Ce qui a changé

**La règle : `src/republierGuide.js`** (pure, exécutée par l'audit) — étapes par mode
(`republier` : photos → supprimer → créer → fini ; `remettre` et `publier` : photos → créer →
fini), `etatsEtapes` (une étape cochée sur une PREUVE ou un geste FAIT : photos toutes envoyées,
ancienne absente de la lecture, nouvelle désignée par son clic, N° relu ; « pas su » jamais
« fait »), `etatAncienne` (la lecture de ses annonces, la même que la reprise du N°), `champsAnnonce`
(l'ordre du formulaire « Vendre » : titre, description, catégorie, marque, taille, état, couleur,
prix ; un champ pas lu se dit, ne se copie jamais vide), `resultatFin`, `travailFait`.

**La feuille guidée (`RepublierALaMain`, src/ecrans/Republier.jsx)** — refaite :
1. **Photos** : préparées DÈS L'OUVERTURE (le même dessin que l'atelier, `dessinerPhotoReglee`) ;
   UN toucher « Enregistrer les 2 photos » ouvre le partage de fichiers DANS le geste (Safari
   l'exige ; « Enregistrer 2 images » les met dans Photos) ; ordinateur : téléchargement
   `VRM-42-01.jpg…`. Après : « Tes 2 photos sont prêtes dans ta galerie : tout a été envoyé. »
   (ordinateur : « enregistrées dans tes téléchargements »). Échec : « Pas fait : 1 photo pas lue.
   Ouvre l'annonce sur Vinted… » ; partage refusé : dit, « Touche de nouveau Enregistrer ».
   La présentation (curseurs, préréglages, « Photos d'origine ») est repliée sous « Présentation :
   telle quelle · Régler ».
2. **Supprimer l'ancienne sur Vinted** (mode republier) : « Ouvrir l'ancienne annonce ↗ »
   (vinted.fr/items/{id}) — c'est LUI qui supprime ; mises en garde si les photos ne sont pas
   encore enregistrées ou si VRM n'a pas la description. État lu : « encore en ligne » / « n'est
   plus dans la dernière lecture : c'est fait » / « pas su ». De retour dans VRM (onglet au premier
   plan), VRM **relit ses annonces tout seul** (une lecture, rien ne part).
3. **Créer la nouvelle** : « Ouvrir Vinted · Vendre ↗ » copie le titre au passage ; chaque champ
   son « Copier » (« 3 sur 6 copiés ») ; le N° posé selon Réglages → Numéros ET, nouveau,
   « Je numérote moi-même » (fin de description, `annonceRepubliee({ numeroEcrit })`, la règle de
   « Créer sur Vinted ») ; prix, titre et lettre repliés sous « Prix et titre : gardés · Changer ».
4. **C'est republié ?** : la nouvelle annonce lue est proposée ; SON clic + la confirmation
   d'avant (`askConfirm`, inchangée) ; le N° passe par `repriseNumerosRecreation` (par identité) ;
   « C'est republié : la nouvelle annonce porte le N°42, relu par VRM. » et une ligne dans
   « Ce que VRM a fait » (`noterGesteFait`, src/suiviTravail.js, une fois par nouvelle annonce).

Un seul plein par étape : le geste de l'étape tant qu'il n'est pas fait, puis « Suivant ».
Plusieurs paires : une feuille par paire (« Paire 1/3 »), le kit (toutes d'un coup) reste à un
toucher : « Voir les 3 d'un coup ». « À la main · N » et la loupe « republier 124 » ouvrent la
feuille guidée directement (plus le kit).

**Publier à la main (`PublierALaMain`)** — sur chaque fiche « À publier », bouton « À la main » :
photos de la fiche dans la galerie (un toucher, telles quelles), champs à copier (le texte de
`texteAnnonceVinted` : N° selon ses réglages), puis « C'est publié » quand une annonce lue porte
le N° de la fiche (la preuve qui la sort de « À publier ») — sinon « pas encore vue », jamais
deviné. Le N° est celui que `prochainLibre` a donné à la fiche à sa création : rien n'est attribué
ici (le banc vérifie le pool inchangé).

Textes : tout par `tr()` (`src/i18n/langues/<l>/republierGuide.js`, 5 langues, clés `rg.*` ;
une photo ⇒ clé `.un` sans nombre). Accompagnement : `republier.main`, `publier.main` dans
`GESTES_ACC` (AccApres / AccEchec, aucun « Annuler », aucune confirmation neuve). Styles :
`src/republier-guide.css` (jetons `--sb-*`). « Quoi de neuf » : `republier-main-guide`.

## 2 bis. « On me propose qu'une seule photo » (capture de Julien, 15 nov., « Remettre en vente », N°B546)

Ses mots : « on me propose qu'une seule photo, ce n'est pas possible, je veux TOUTES les photos, et que
toutes les photos subissent les mêmes modifications que j'ai apportées ; je veux que les barres pour
modifier les photos soient beaucoup mieux ».

**Pourquoi (lu dans le code)** : la feuille ne prenait QUE le coffre (`coffre_{uid}_{id}.photos`, écrit
par l'atelier quand VRM republie) et retombait sur la VIGNETTE du dressing (`paire.photo`). Une vente
retournée ou annulée, ou une annonce jamais passée par l'atelier, n'a pas de coffre ⇒ une seule photo.
Les photos existaient pourtant ailleurs, par l'identité de l'annonce : `vinted_item_details[id].photos`
(la fiche lue sur la page de l'annonce par l'extension) et les photos portées par la lecture du dressing
(`photosDetail` / `photos`), que `annSelectionnables` ne transmettait pas.

**Ce qui a changé** :
- `photosDeLAnnonce` (src/republierGuide.js) : coffre, fiche de la page (lue en PROJECTION de cette seule
  annonce, `select=ph:data->"<id>"->photos`, jamais la ligne entière), dressing, la vignette en dernier —
  la source qui en porte le plus, dans l'ordre de Vinted (la 1re = la couverture), sans doublon ;
  `annSelectionnables` porte maintenant `photos` et `nPhotos`.
- S'il en manque (Vinted en annonce 8, VRM en a lu 3) ou si VRM n'a que la couverture : dit en ambre, avec
  « Ouvrir l'annonce sur Vinted ↗ » (l'extension lit alors sa fiche et toutes ses photos) et « Relire les
  photos » (relit coffre et fiche, sans recharger).
- La grille montre TOUTES les photos avec la même présentation ; une photo se touche pour la retirer /
  la remettre (case cochée, retirée = estompée) ; « 7 sur 8 photos choisies » ; « Couverture » sur la
  première qui part ; « Enregistrer les 7 photos » ⇒ le partage iOS porte les 7 fichiers, dans le geste.
- Les barres (`CurseursPresentation`) : « Le même réglage pour toutes tes photos », la couverture
  retouchée en aperçu, chaque barre son nom (Redresser, Luminosité, Contraste, Couleurs, Recadrer) et sa
  valeur en clair (« +10 % », « −2° », « ×1,25 »), une prise de 44 px, un pouce de 28 px, le zéro marqué ;
  double-toucher (ou double-clic) = remise à zéro de cette barre ; « Réinitialiser » en lien. Un seul
  réglage pour toutes (jamais par photo), aucune valeur tirée au hasard (audit C1/C2, mutation
  `hasard_curseur`).
- « Publier à la main » : la même grille (les photos de la fiche, à retirer d'un toucher).

## 3. Après (mesuré par le banc)

Republier, une paire, iPhone : **12 touchers** (+1 système) de la vue Republier à « C'est
republié », la suppression comprise et guidée (lien, vérification) — contre 15 sans guide de
suppression. Publier une fiche : **5 touchers** de « À la main » à « C'est publié ».

## 4. Preuves

- `npm run build` vert.
- `scripts/audit-republier-guide.cjs` (neuf) : **22 verts** ; `--prouve` **19/19 mutations**
  rouges (étape cochée sur un lien ouvert, « pas su » = partie, photos cochées sans envoi, copies =
  créée, publié deviné, ordre des champs, prix « 0 », un texte « éviter le ban » en fr, « Erkennung
  vermeiden » en de, « contourner Vinted » dans App.jsx, hasard dans le dessin / les couleurs /
  la préparation, « varier » remis, kit au lieu du guide, partage hors du geste, commande envoyée
  à Vinted, texte en dur, clé absente en it).
- Banc `scripts/bancs/republier-guide.cjs` (neuf, données inventées, 390 tactile + 1512, clair
  et sombre ; `navigator.share`/`canShare` simulés, activation du geste notée) : R1-R5 republier
  (feuille guidée tout de suite, 4 étapes, photos préparées d'avance, UN partage DANS le geste avec
  les 2 fichiers, « prêtes dans ta galerie : tout a été envoyé », lien de l'ancienne, relu au retour,
  champs dans l'ordre de Vinted, N°42 en fin de description, N°42 passé sur la nouvelle, « C'est
  republié », « Ce que VRM a fait ») ; G (annonce de 8 photos, vignette seule au dressing ⇒ les 8,
  même réglage sur les 8 — grille ET couverture —, valeurs « +10 % » / « ×1,25 », 5 barres de 44 px,
  double-toucher = 0 %, partage de 8 fichiers, une retirée ⇒ 7 prêtes et 7 fichiers, « Tes 7
  photos… » ; une annonce dont VRM n'a pas tout ⇒ « VRM a lu 1 sur 2 photos », lien, « Relire ») ;
  P (fiche « À publier » : 3 étapes, la photo d'un toucher, N°45, « C'est publié », pool inchangé).
  Résultat : **390 clair + 390 sombre + 1512 clair : 139 OK** ; 1512 sombre rouge une fois sous
  charge (la case cochée avant que la liste soit posée : le banc recoche maintenant), rejoué
  **1512 clair + 1512 sombre : 91 OK, 0 rouge**. Machine partagée à une charge de 40 à 60.
  **Sur l'arbre d'avant** (ea152a4b, build à part, banc copié dedans) : **rouge** dès R1 (« À la main
  · 1 » ouvre le kit, pas de feuille guidée). Captures regardées (photos, envoyées, supprimer, créer,
  republié, publier, 8 photos + barres, 7 photos, photos qui manquent ; clair et sombre, 390 et 1512).
- Bancs voisins (adaptés à la feuille guidée) : `republier-main` 390 ×2 + 1512 ×2 verts (100 + 65
  OK ; ses contrôles 44 px ne valent plus qu'au doigt, la souris fait 32 px depuis le Studio — rouge
  déjà sur ea152a4b, mesuré) ; `republier-kit` vert sur les quatre vues (82 OK ; deux rouges de
  minuterie sous charge à 1512, verts rejoués seuls).
- Audits suivis : `traduction` 45/0, `tdz`, `variables`, `studio`, `identite`, `csp`,
  `coherence`, `accompagnement` 40/0, `quoi-de-neuf`, `republier-main` 36 (21/22 mutations : la
  22ᵉ, `modifier_partage`, a perdu son ancre AVANT ce chantier, même résultat sur ea152a4b),
  `republier-kit` 17 (13/13), `annonces-actions` 70 (24/24), `etiquette-numero`, `numero-ecrit`,
  `annonce-vinted`, `icones`, `boutons` verts. `suivi-travail` : 1 rouge (B1, bordereaux) déjà
  rouge sur ea152a4b.
- Audits adaptés (la règle, pas l'orthographe) : `audit-republier-kit` B3/B4 (les photos de la
  feuille vivent dans `SectionPhotos`, l'appel prend `{ auto }`), `audit-republier-main` mutation
  `sans_numero` (ancre `let description`), banc `republier-kit` (« À la main · 2 » ⇒ feuille
  guidée ⇒ « Voir les 2 d'un coup » ⇒ le kit).
- `annonces-actions` F6 (« ne relie jamais par le titre ») attrapait un faux positif du
  placeholder du titre : le code passe par `PH_TITRE`, la règle de l'audit est intacte.

## 5. Ce qui reste

- Une nouvelle annonce lue avant d'être désignée reçoit d'abord un N° neuf (puis le N° de
  l'ancienne passe dessus) : ce N° neuf reste servi (le pool ne recule jamais, §5) — comportement
  d'avant, mesuré dans le banc (pool 42, 43, 45, **46**).
- « Publier à la main » : si l'extension montre un AUTRE N° réservé à côté de « Publier » sur
  Vinted, la fiche ne sort pas de « À publier » (rien n'est deviné) ; lier une fiche à une annonce
  par SON clic serait le prochain pas.
- La lettre au hasard (ci-dessus) : sa décision.

## Geste de Julien

Aucun technique. Sur l'iPhone : Annonces → Republier, cocher une paire → « À la main · 1 » ;
toucher « Enregistrer les N photos » puis « Enregistrer N images » ; suivre les étapes.
