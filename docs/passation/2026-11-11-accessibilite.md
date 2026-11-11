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

## Ce qui reste

- axe ne couvre qu'une partie de WCAG (≈ 30-40 %) : l'ordre du focus « logique », la
  pertinence des noms et VoiceOver sur iPhone restent à relire à la main (Safari calcule
  presque toujours les mêmes noms que Chrome, pas toujours).
- Les écrans hors des 11 (Statistiques, Communauté, plateformes Leboncoin/eBay/Vestiaire,
  feuilles autres que « ? ») ne sont pas passés au banc ; ajouter un écran = une ligne dans
  `ECRANS`.
- Les données inventées sont petites : un état rare (bandeau d'erreur, liste longue) peut
  porter un contraste que le banc ne voit pas.
