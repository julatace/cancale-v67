# Lot accessibilité — WCAG 2.1 AA vérifiée automatiquement (11 novembre 2026)

Branche `claude/accessibilite`. Mission : un contrôle **axe-core** sur chaque écran principal,
rouge sur toute violation « serious »/« critical », et corriger ce qu'il trouve **sans refonte**
(ajuster au plus juste, §7 : une couleur d'accent rare, 44 px).

## Le banc

`scripts/bancs/accessibilite.cjs` — données INVENTÉES (celles du banc `clavier-voiceover` : un
compte, quatre annonces, une vente, un achat), aucune `fx/`, aucune écriture réelle.

- **A. axe-core** (`axe-core` **4.14.0** exact, devDependency) injecté dans la page (Playwright,
  `bypassCSP`), règles `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, sur **11 écrans** : Ma journée,
  Annonces, Ventes, Colis, Messages, Achats, Stock, Argent, À trancher, E-mails, Paramètres —
  à **390 px tactile et 1512 px**, **clair ET sombre**. Les animations d'entrée sont terminées
  avant la mesure (`document.getAnimations().finish()` : un texte à opacité 0 serait sauté).
  Une violation `serious`/`critical` ⇒ ❌ ; `moderate`/`minor` ⇒ seulement dites (aucune
  aujourd'hui). **Liste d'exceptions : VIDE** (`EXCEPTIONS`, une par une avec sa raison si un
  jour il en faut une).
- **B. 44 px au doigt** (390 px) : chaque bouton / onglet / case visible offre 44 × 44 px (sa
  boîte, son `::before`/`::after` étendu, ou le `<label>` d'une case).
- **C. Feuille** (1512, clair et sombre) : un bouton focalisé, « ? » ouvre la feuille des
  raccourcis, axe passe DANS la feuille ouverte, Échap la ferme et **le focus revient au bouton
  d'avant** (le piège de focus lui-même — Tab/Maj+Tab qui tournent dedans — est tenu par
  `clavier-voiceover` B3).
- **D. La page** : `<html lang="fr">` et un `<title>` qui nomme VRM.

Options : `BANC_PORT`, `BANC_DIST`, `BANC_CAPTURES`, `BANC_LARGEUR=390|1512`,
`BANC_ECRANS=compta,journee`, `BANC_DUMP=1` (chaque violation en entier).
Branché dans `.github/workflows/verifier.yml` (Bancs principaux, part 2) et dans le `LOT` de
`scripts/lancer-bancs.cjs`.

## Ce qu'axe a trouvé sur `origin/main` (ed0529c) — 46 ❌

| règle | où | correction |
|---|---|---|
| `label-content-name-mismatch` (WCAG 2.5.3, nom ≠ texte visible) | barre du bas : `aria-label="Annonces · 1 à faire"` alors que le bouton ÉCRIT « 1 » et « Annonces » | plus d'`aria-label` : le nom vient du libellé visible + « · 1 à faire » lu (`vrm-sr-seul`) |
| idem | « Plus » quand la 5ᵉ place montre l'écran courant (« Messages ») | nom « Plus · Messages » (les bancs qui visaient `[aria-label="Plus"]` visent `[aria-label^="Plus"]`) |
| idem | colonne d'ordinateur : `aria-label="Annonces"` mais le badge écrit « 1 » | nom « Annonces · 1 à faire » (`suffixeBadgeNav`) ; `BadgeNav` : le chiffre dessiné est `aria-hidden`, son sens lu à part, une espace le sépare du libellé (un `aria-label` sur un `<span>` sans rôle n'était pas lu) |
| idem | pastille d'état (« V » + « Extension » ; le pseudo du compte absent du nom) | le nom commence par ce qu'elle écrit (pseudo, « Extension », « · sauf publier ») puis l'état complet ; l'initiale de l'avatar est dessinée (`data-initiale`, CSS) |
| idem | Ma journée, les sept jours (« J » « 5 » contre « Jeudi 5 novembre · … ») | la lettre du jour est dessinée (`data-lettre`, CSS) ; le nom contient « 5 » |
| idem | Ma journée, les cartes de gestes (texte COUPÉ à l'écran par `UneLigne`, « Voir » absent du nom) | plus d'`aria-label` : le texte entier est lu (`vrm-sr-seul`), la ligne coupée est cachée au lecteur, « Voir » reste dans le nom ; `data-plein` garde le texte entier (banc `double-vente`) |
| idem | Argent, les quatre widgets (« Combien j'ai vendu ce mois ? 80 € » contre « Vendu en nov. 80 € ») | le nom commence par le libellé ÉCRIT, puis le chiffre, la note, puis la question ; un « — » se dit « pas su », après le texte écrit |
| `color-contrast` | Argent, libellés et notes gris sur le remplissage du widget (#6E6E73 sur ≈ #E3E3E9 = 3,97:1) | en CLAIR seulement, `--w-gris` du widget à #5E5E63 (5,0:1) ; le sombre passait |
| idem | Stock, la puce ambre « à faire » (#B25000 sur son fond à 12 % = 4,40:1) | en clair, #A14800 (5,2:1) ; le sombre passait |
| idem | Annonces, « Vérifier » (#0066CC sur le remplissage = 4,36:1) | en clair, #005BB8 (5,1:1), même teinte |
| idem | Stock en sombre, « Ajouter » (calculette d'emballages) en `--vrm-accent` #0071E3 sur #1C1C1E = 3,62:1 | `--vrm-accent-texte` (la règle du thème : tout TEXTE bleu prend l'accent-texte) |
| `scrollable-region-focusable` | le corps d'une feuille (`SheetShell`) défile sans rien de focalisable | `tabIndex={0}` sur `.vrm-fs-corps` |

Déjà en place, vérifié et non retouché : `<html lang="fr">`, le titre de page, le piège de
focus des feuilles et le focus rendu à la fermeture (`SheetShell`, lot P), les noms des boutons
icônes (`BoutonBase`), les images d'annonce (aucune violation `image-alt`).

## Preuves

- **Branche : 111 ✅ · 0 ❌** (11 écrans × 390/1512 × clair/sombre, + 44 px, + feuille, + page).
- **`origin/main` (ed0529c, `git archive`, banc copié dedans, build de cet arbre) : 65 ✅ · 46 ❌.**
- **Mutations** (page réelle, éléments injectés) : un bouton de 30 px ⇒ B rouge (« 30×44 ») ;
  un texte #CCC sur blanc ⇒ `color-contrast` serious ; un bouton icône sans nom ⇒
  `button-name` critical. Sans `finish()` des animations, l'élément en fondu était sauté
  (corrigé dans le banc).
- Captures regardées (390/1512, clair et sombre) : rendu inchangé — lettres des jours,
  initiale de l'avatar, badges, widgets Argent (gris un cran plus sombre en clair).
- `npm run build` vert ; audits `variables`, `tdz`, `coherence`, `identite`, `icones`,
  `textes-courts`, `fonctions-api`, `secrets`, `csp` verts.

- **Bancs voisins** (les noms changés touchent leurs sélecteurs : `[aria-label="Plus"]` ⇒
  `[aria-label^="Plus"]` dans 9 bancs ; `double-vente` lit `data-plein`) : `garde-ecrans`,
  `morceau-perime`, `journee-coherence`, `clavier-voiceover`, `argent`, `achats-messages-premium`
  **verts**. `navigation-tache` (8), `iphone-reprise` (13), `double-vente` (9), `nav-v2` (4) sont
  **rouges à l'identique sur `origin/main`** (mêmes lignes, arbre `git archive`) : groupes du menu
  (« Argent », Paramètres passés dans le menu du profil, lot DJ6) et croisement eBay→Leboncoin —
  d'autres lots. Deux lignes B7 (balayage, sombre) d'`iphone-reprise` sont sorties rouges une fois
  sur la machine chargée, vertes à la relance (instables, pas ce lot).
- `audit-coherence` exige l'historique complet de `main` (clone superficiel ⇒ « rien n'est
  conclu ») : `git fetch --unshallow origin main`, puis vert.

## Suite (même jour) — contrôle complet demandé par Julien

Demande : couvrir les écrans et feuilles restants, ajouter zoom 200 % et clavier seul, corriger,
mêmes preuves. Les deux bancs partagent un socle **`scripts/bancs/_a11y.cjs`** (données inventées,
serveur de `dist/`, ouverture d'un écran avec largeur/thème/zoom/lien, axe, cibles au doigt).

### Ce qui est couvert maintenant

- **`accessibilite.cjs`** (CI part 2, ≈ 10 min ici) : **17 écrans** — les 11 d'avant + Statistiques,
  Communauté, Leboncoin (`?tab=leboncoin`), eBay (`?tab=ebay_annonces`), Vestiaire
  (`?tab=annonces&site=vestiaire`), Organisation — et **5 feuilles** : fiche d'une paire (« Tout sur
  le N° », `vrm:fiche-paire`), fiche d'une vente (tiroir de Ventes → Vinted), Nouvel achat
  (`?tab=achats&achat=1`), « Tout imprimer », la confirmation avant impression ; 390/1512, clair
  et sombre ; axe passé DANS la feuille ouverte. Le socle sert en plus une annonce Leboncoin, eBay
  et Vestiaire et une vente à expédier avec son bordereau (sans elles, ces écrans retombent sur
  Vinted et « Tout imprimer » n'existe pas). Deux règles axe « bonnes pratiques » sont tenues
  ROUGES quel que soit leur impact : `aria-allowed-role` (rôle ARIA interdit) et
  `aria-dialog-name` (feuille sans nom). 225 contrôles.
- **`accessibilite-clavier.cjs`** (CI part 3, ≈ 6 min ici) :
  - **Zoom 200 %** (1512 px zoomé = 756 px CSS, 2 px par pixel CSS), 17 écrans : Z1 la page ne
    défile pas en largeur ET rien ne sort par la droite (un parent qui rogne cache le défilement
    mais perd le contenu) ; Z2 aucun texte rogné (overflow hidden/clip, ellipse) sans `title` ni
    nom qui le contienne — une rangée qui défile se lit en la faisant défiler.
  - **Clavier seul** : K1 depuis le haut de la page, Tab atteint chaque entrée de la colonne et
    Entrée l'ouvre (11 écrans) ; K2 sur les 17 écrans, clair et sombre, les 40 premiers arrêts de
    Tab : jamais un élément invisible ou caché au lecteur, Tab entre dans `<main>`, et un
    indicateur qui APPARAÎT au focus (outline, ombre, bordure ou fond — sur l'élément, ses
    pseudo-éléments, un parent proche ou un enfant direct) avec un contraste ≥ 3:1 contre ce qui
    l'entoure (2.4.7 ; 2.4.11 de WCAG 2.2). Un `<select>` transparent posé sur son habillage
    compte comme visible si l'habillage le couvre. 207 contrôles.
  - `BANC_MUTATION=focus|largeur|coupe` sabote la page (aucun contour ; un bloc de 2000 px ; un
    texte rogné sans `title`) : K2, Z1, Z2 sortent rouges. La mutation « largeur » a montré que Z1
    (défilement de la page) seul ne voyait rien (`<main>` rogne) : d'où le contrôle « rien ne sort
    par la droite ».

### Ce qui a été trouvé et corrigé

| règle | où | correction |
|---|---|---|
| `aria-allowed-role` | Ventes → Tous : chaque vente était un `<button role="listitem">` (plus annoncé comme un bouton) | rôles `list`/`listitem` retirés, la liste reste une suite de boutons |
| `label-content-name-mismatch` | Ventes → Tous : `aria-label` sans le texte affiché (tout le dessin `aria-hidden`) | le nom est LU dans un `vrm-sr-seul` (titre, site, compte, jour, état, prix, N° — le N° manquait) |
| idem | eBay : `aria-label` « titre — N° — ouvrir la fiche » sans l'état affiché | plus d'`aria-label` : nommé par ce qu'il montre ; ouvert/fermé par `aria-expanded` |
| idem | Nouvel achat : « Ajouter une photo » contre « Photo de l'article » affiché | « Photo de l'article : ajouter une photo » / « Changer la photo de l'article » |
| idem | fiche d'une vente : « Fiche N°21 » contre « Fiche de la paire » | « Fiche de la paire N°21 » (et « Fiche de l'article N°… » sur Vestiaire) |
| `aria-dialog-name` | les quatre confirmations (`vrm-confirmation`) sans nom | `aria-label` = leur titre affiché |
| `role-img-alt` | fiche d'une vente : barre de coût `role="img"` au nom vide (aucun segment) | sans segment, la barre est décorative (`aria-hidden`) |
| `color-contrast` | « Ajouter une note » sur le remplissage gris (3,96:1) | en clair #5E5E63 (5,0:1) |
| idem | « Vendus ailleurs » → « Voir le détail » à opacité 0,7 (2,8:1) | le gris secondaire du thème au lieu de l'opacité |
| `label-content-name-mismatch` | Ma journée : la carte « Au moins N choses à trancher » (arrivée par `main` pendant ce lot ; le banc l'a vue à la fusion) — « Trancher »/« Fermer » absent du nom | comme les autres cartes : texte entier lu (`vrm-sr-seul`), ligne affichée cachée au lecteur, le mot du geste reste dans le nom ; `data-plein` |
| `label-content-name-mismatch` | Achats → meilleures sources (arrivée par `main`) : « source : ouvrir ses achats » taisait les chiffres affichés | nommé par ce qu'il montre, « — ouvrir ses achats » lu à la fin |
| K2 (contour < 3:1) | la case « Sélectionner » des listes (lot actions-serie, arrivée par `main`) : contour de Chrome à 2,97:1 en sombre | contour bleu-texte du thème (`--vrm-accent-texte`) au focus |
| Z2 (texte coupé, toutes tailles) | Stock : « N°12 » coupé en « N°1… » dans les vignettes de 44 px | pastille resserrée en vignette mini (3 chiffres tiennent), N° entier en `title`, `aria-hidden` (la ligne l'écrit en clair) |

Rien d'autre au zoom 200 % ni au clavier : aucune page ne défile en largeur, chaque écran est
atteint au clavier, et chaque arrêt de Tab montre un contour ≥ 3:1 (le « ? » d'aide porte le sien
sur sa pastille, le tri d'Annonces sur son habillage).

### Preuves (suite)

- Branche (après `git merge origin/main`) : **`accessibilite` 225 ✅ · 0 ❌**, **`accessibilite-clavier`
  207 ✅ · 0 ❌**.
- **`origin/main` (2084be1b, `git archive`, les trois fichiers de banc copiés dedans, build de cet
  arbre) : `accessibilite` 141 ✅ · 84 ❌ ; `accessibilite-clavier` 206 ✅ · 1 ❌** (le N° coupé du
  Stock).
- Mutations : `focus` ⇒ K2 rouge (31 arrêts « aucun contour ») ; `largeur` ⇒ Z1 rouge ; `coupe` ⇒
  Z2 rouge.
- Bancs voisins (noms et structures touchés) : `ventes-e2`, `stock-2d`, `achats-hors-plateforme`,
  `ebay-lbc-visuel`, `journee-coherence` **verts** ; `tout-imprimer` rouge (B « groupes de l'écran »
  vides) **à l'identique sur `origin/main`** — pas ce lot.
- `npm run build` ; audits `variables`, `tdz`, `coherence`, `identite`, `icones`, `textes-courts`,
  `fonctions-api`, `secrets`, `csp` verts (sur l'arbre fusionné).
- Captures regardées : zoom 200 % (Stock), confirmation 390 sombre, fiches.
- `CLAUDE.md` au-dessus de 59 000 octets après la fusion : la ligne la plus ancienne du §9
  (« VRM installable ») est déplacée telle quelle dans `historique-divers.md`.

### ⚠️ Signalé, pas corrigé : la langue de la page en anglais

Depuis le lot « Traduction » (arrivé par `main` pendant ce lot), un navigateur réglé en anglais
(ou allemand, espagnol, italien) reçoit `<html lang="en">` alors que seule la navigation est
traduite : le contenu des écrans reste en français. Un lecteur d'écran lit alors du français avec
une voix anglaise (WCAG 3.1.1). Le banc simule l'utilisateur réel (`locale: 'fr-FR'`, VRM reste sur
la France, §3) et ne voit donc plus ce cas ; il ne l'a mesuré qu'une fois, en Chromium anglais.
À trancher par le lot Traduction : soit `lang` reste `fr` tant qu'un écran n'est pas traduit, soit
chaque morceau traduit porte son `lang`. (Note : §3 de CLAUDE.md dit « pas de traduction ».)

## Ce qui reste

- axe ne couvre qu'une partie de WCAG (≈ 30-40 %) : l'ordre du focus « logique », la
  pertinence des noms et VoiceOver sur iPhone restent à relire à la main (Safari calcule
  presque toujours les mêmes noms que Chrome, pas toujours).
- Ajouter un écran = une ligne dans `ECRANS` (`_a11y.cjs`) ; une feuille = une entrée de `FEUILLES`.
  Pas encore couverts : Republier, Publier ailleurs, les feuilles de Paramètres, le centre d'aide.
- Durées : ~10 min (`accessibilite`) et ~6 min (`accessibilite-clavier`) sur la machine chargée ;
  si une part de la CI dépasse 20 min, déplacer un banc vers la part la moins chargée.
- Les données inventées sont petites : un état rare (bandeau d'erreur, liste longue) peut
  porter un contraste que le banc ne voit pas.

## ÉTAT À LA REPRISE (arrêt demandé, 11 nov.)

**Fait et poussé** (branche `claude/accessibilite`, aucune PR) : bancs `accessibilite` (17 écrans +
5 feuilles) et `accessibilite-clavier` (zoom 200 %, clavier seul) sur le socle `_a11y.cjs`,
branchés en CI (parts 2 et 3) et dans `LOT` de `lancer-bancs.cjs` ; corrections listées plus haut.

**Prouvé (dernier passage, arbre fusionné avec `origin/main` du 11 nov. au soir)** :
`accessibilite` **225 ✅ · 0 ❌** ; `accessibilite-clavier` **206 ✅ · 1 ❌** ; audits demandés verts ;
rouge sur `origin/main` 2084be1b (84 ❌ et 1 ❌) ; mutations focus/largeur/coupe rouges.

**Reste (le seul rouge)** : K2 sombre, Achats — la case `<input type="checkbox" aria-label="Sélectionner
Achat Vinted banc">` garde un contour à 2,97:1. La règle ajoutée dans `src/selection-serie.css`
(`.vrm-serie-case input:focus-visible`) **n'a pas pris** : soit cette case n'est pas une
`CaseSerie` (chercher `Sélectionner ${` dans `src/App.jsx` l. ~14736 `vrm-sel-case` et ~47712),
soit une règle plus forte l'écrase. Lancer :
`BANC_ECRANS=achats BANC_SEUL=K BANC_DUMP=1 node scripts/bancs/accessibilite-clavier.cjs`.

**Prochaines étapes** : 1) corriger cette case puis relancer les deux bancs ; 2) `git merge
origin/main` (main bouge vite : chaque fusion a apporté de nouveaux rouges que le banc attrape) ;
3) garder `CLAUDE.md` < 59 000 octets (déplacer telle quelle la plus ancienne ligne du §9 dans
`historique-divers.md`) ; 4) faire trancher la langue de la page en anglais (section ⚠️ ci-dessus).

**Pièges** : `lang="en"` si le navigateur est en anglais (le socle force `locale: 'fr-FR'`) ;
`audit-coherence` exige l'historique complet (`git fetch --unshallow origin main`) ; ne jamais
reconstruire `dist/` pendant qu'un banc le sert ; `tout-imprimer` et 4 bancs de navigation sont
rouges à l'identique sur `main` (pas ce lot) ; durées ~10 et ~6 min sur machine chargée.
