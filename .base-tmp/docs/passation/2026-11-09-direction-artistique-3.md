# 9 nov. 2026 — Direction artistique, phase 3 : la grammaire de rangée sur les écrans restants

Branche `claude/direction-artistique-3` (depuis `origin/main` 312e116e, qui porte les phases 1 et 2).
Pas de PR, pas de merge. La grammaire elle-même (une page) : `2026-11-08-direction-artistique-2.md`.
Tout est dans `src/styles-premium.css`, section 11 (couche `@layer vrm-premium`, jetons `--p-g-*`),
plus un seul changement de balisage (Messages, ci-dessous). Aucun chiffre, aucune règle, aucun
`data-*` changés ; texte rendu (`innerText`) comparé avant/après sur chaque capture.

Hors périmètre, laissé aux autres chantiers : Ma journée et l'organisation Ventes/Colis
(`claude/journee-v2`), la configuration de départ (`claude/configuration-depart`), Leboncoin
côté extension (`claude/leboncoin-clair`), Réglages → Notifications (`claude/notifications`).

## Écrans

| écran | ce qui change |
|---|---|
| **Stock** | le chiffre des annonces actuelles 34/700 tabulaire, son mot en gris ; les faits en note 13 (nombres à l'encre), 72 caractères au plus ; rangées de la liste à la grammaire (vignette 44, titre 15/600, note 13, filet après la vignette) |
| **Favoris & offres** | le panneau partait centré dans 760 px (212 px de marge à gauche à l'ordinateur) : il part du bord comme les onglets et la liste ; « Assistance technique », « Comptes Vinted », « Données » en rangées de groupe de 48 px (plus de carte à moitié vide ni de texte coupé) |
| **Republier** | c'est Annonces en mode « Sélectionner » : déjà à la grammaire (phase 2). L'atelier (la feuille, ouverte après une sélection) n'a pas été capturé |
| **Statistiques** | tuiles : libellé 13 gris, chiffre 24/700 tabulaire (20 au téléphone), note 12 ; tableaux : nom 15 à l'encre, nombre 15 tabulaire à droite ; titre de carte 17/600 et sa précision à droite ; marge de page 16 au téléphone (12 avant). Aucune barre ni couleur de graphique changée |
| **Compta** | les replis en rangées de 48 px (60 à l'ordinateur et 44 au téléphone avant), titre 15/500, bords 16, marge 16 au téléphone, montants tabulaires |
| **E-mails** | rien à changer de visible sur la base inventée (la boîte n'y est pas lue) : seul l'en-tête commun s'applique |
| **Leboncoin / eBay / Vestiaire** | sans compte relié, l'écran renvoie vers Annonces/Ventes : rien de propre à mesurer sur la base inventée ; pas touchés |
| **Réglages** | la rangée de Réglages d'iOS : icône 30 rayon 8, titre 15/500, phrase 13 grise sur deux lignes au plus, chevron gris, 56 px ; en-tête de groupe 13/500 gris |
| **Coque** | en-têtes de groupe de la barre latérale (« Vendre », « Gérer », « Argent ») en casse de phrase 12/500 gris, sans espacement de lettres ; compteurs tabulaires. Feuilles, confirmations, toasts, états vides, barre du bas : pas touchés (voir Suite) |
| **Messages au téléphone** | la ligne « paire · N° · compte · motif » se coupait en trois (« Nike samba taille 36 · N°… · ve… ») : le N° devient son propre élément (`src/App.jsx`, même texte, même ordre) ; le modèle se coupe le premier, puis le compte, jamais le N° ni le motif. `innerText` : mêmes mots, une coupure de ligne de plus entre le modèle et le N° |

## Vérifications

Captures AVANT (`origin/main` 312e116e) et APRÈS, base inventée (`_base-volume.cjs`), iPhone 390
tactile et ordinateur 1512, clair et sombre ; planches dans le dossier de livraison
(`da3/comparer/`). Texte rendu identique sur toutes, sauf Messages (coupure de ligne, ci-dessus).
`npm run build` vert ; audits `violet`, `icones`, `boutons`, `variables`, `tdz`, `photos-vinted`
verts ; `coherence` : 1 rouge (« cartecadre 5.332.0 », extension), le même sur `origin/main`.
Bancs (un à la fois, base inventée ; rouges comparés à un arbre `git archive` de 312e116e avec son
propre `dist/`) : `messages-lisibles` 76 verts · `ecrans-gardes` 29 verts · `iphone-reprise`
5 rouges (O : le groupe « Plateformes » absent de la barre latérale sur la base inventée), les
mêmes 5 au départ (1 rouge B6 de plus au 1er passage, vert au 2e) · `chargement` (Stock,
Messages, Compta) : CLS Stock 0,034 et Messages 0,171 au téléphone lent, présents au départ
(0,034 et 0,167).

## Suite

- L'atelier « Republier » (feuille), les feuilles et confirmations, les toasts, les états vides,
  la barre du bas : à capturer en déclenchant chaque geste, puis à mettre à la grammaire.
- E-mails et les écrans Leboncoin/eBay/Vestiaire : à reprendre sur une base qui les remplit
  (boîte lue, comptes reliés), sinon on dessine à l'aveugle.
