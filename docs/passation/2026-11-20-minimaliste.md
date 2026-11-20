# 20 nov. — Tout le site simple et minimaliste « comme Paramètres » (branche `claude/minimaliste`)

Julien, 20 nov. : « en gros tout le site doit être comme la fiche Paramètres, simple et minimaliste » (règle écrite dans
`docs/design/NATIF.md` §1 bis), puis : « tu dois appliquer les mêmes dispositions sur toutes les plateformes ».

Branche partie d'`origin/main` (dd3336382), avec de vrais `git merge` de `claude/boutons-natifs`, `claude/relier-depuis-liste`
et `claude/project-review-nsk5su` (NATIF §1 bis). Argent, la barre du haut et le bloc « À retirer » d'Achats n'ont PAS été
touchés (chantiers `claude/argent-natif`, `claude/retraits-visuel`).

## 1. Mesurer — le banc `scripts/bancs/minimaliste.cjs`

Le vrai `dist/`, base inventée de volume (`ecrans-verre-2.baseFiches()`), base vide, et trois bases « un seul site »
(Leboncoin seul, eBay seul, Vestiaire seul : 24 annonces, 5 ventes, aucun compte Vinted). Il ouvre Aujourd'hui, Annonces,
Ventes, Achats, Stock, Messages, E-mails, Paramètres (+ une sous-page), Notifications, Automatisations, Extension, la fiche
d'un article, Compléter, Relier mes annonces, Publier sur…, Tout va bien ?, Communauté — fenêtres `390` (tactile 390 × 844),
`safari` (390 × 664 tactile), `1512`, `1280`, clair et sombre — et relève dans l'écran (la coque n'est pas comptée) :
cartes décorées (ombre, dégradé à deux couleurs, filet sur quatre côtés, fond teinté), ombres, liens soulignés, textes gris
de plus de deux lignes, pleins, boutons gris pleine largeur, contraste < 4,5:1, cibles < 44 (32 souris), texte coupé et
débordement. Exceptions NOMMÉES : la feuille et le volet eux-mêmes (leur ombre, NATIF §1), barres de la coque, plaque,
pastille, interrupteur, champs, images. Il relève aussi la FORME de l'écran (natif ou d'hier, segments, en-têtes de groupe,
colonnes du tableau, pleins) pour comparer chaque site à Vinted.

```bash
BANC_DIST=<build> SORTIE=<dossier> FENETRES=390 THEMES=clair BASES=volume node scripts/bancs/minimaliste.cjs   # ≈ 10 min / passage
node scripts/bancs/minimaliste.cjs --compare <avant…> -- <après…>     # tableau avant / après par écran
node scripts/bancs/minimaliste.cjs --planches <avant…> -- <après…>    # planches des 12 écrans principaux (390 et 1512)
node scripts/bancs/minimaliste.cjs --formes <dossiers…>               # chaque site contre Vinted
MUTATION=ombre|carte|souligne …                                        # pose le défaut dans l'écran : le compteur monte
```

## 2. Ce qui a changé

- **La carte native est un groupe** (`src/natif/complements.css`) : en-tête au-dessus, en petites capitales grises sur le
  fond ; corps blanc arrondi, sans filet ni ombre. Tuiles de chiffres d'Aujourd'hui : pavés blancs unis. Champ, liste à
  réordonner, tableau de travail (`n-tt-cadre`), volet des Automatisations : plus de filet.
- **`src/natif/minimaliste.css`** (couche `n-anciens`, importée par `src/natif/anciens.js`) : les jetons d'ombre de carte
  d'hier valent « rien » partout (`--fu-ombre`, `--w-ombre`, `--vrm-ombre-carte`, `--p-ombre`, `--d-ombre-douce`, `--cm-ombre`,
  `--bx-ombre`…) ; plaque gravée de Messages à plat ; « Mis à jour » de Paramètres sans pastille flottante ; carte du profil
  en groupe uni ; liens d'action et « summary » sans soulignement ; « ⋯ » d'un achat et « Voir » du bandeau à 44 ; Publier
  ailleurs : la liste des articles est UN groupe à filets décalés (plus de cartes empilées) ; texte des boutons teintés
  d'hier au bleu de la teinte (contraste 4,47 → ≥ 4,5 une fois la carte du profil remise en blanc).
- `EtatPanne` : « Réessayer » en texte bleu (plus de bouton teinté pleine largeur).
- Stock : plus d'explication permanente quand aucun meuble n'existe ; « Comment ça marche ? » l'ouvre (bancs
  `compta-stock-ui` et `vendeur-generaliste` la font ouvrir avant de la lire).
- **Les mêmes dispositions sur toutes les plateformes** :
  - Ventes · eBay ouvre la liste NATIVE (À envoyer · En route · Terminées), comme Vinted et Vestiaire ; Commandes passe en
    tête de `SOUS_SECTIONS["ventes.ebay"]` (`src/navigationTache.js`) ; Tableau, À traiter, Offres, Argent, Santé sont un
    groupe de rangées sous la liste (`data-tache-sections`), chacune ouvre sa section.
  - Ventes · Leboncoin : `LeboncoinColis` en section de Ventes rend des rangées natives (vignette, N°, titre sur 2 lignes,
    transporteur, prix à droite ; toucher = imprimer ou ouvrir la vente sur leboncoin.fr ; balayage « Colis fait ») sous le
    MÊME segment que Vinted (`ongletColis` : À envoyer · En route · Terminées) ; la liste des ventes d'avant n'est que sous
    « Terminées » (comme Vinted) ; la limite du site (bordereau généré sur leboncoin.fr) est dite une fois, en pied du
    groupe. Mêmes règles (`lbcColisAPoster`, `lbcExpediee`, `vrm_lbc_colis_done`), même modale du bordereau.
  - Au téléphone, Ventes d'un site ne répète plus le grand titre (ni la date) que la coque montre déjà.
- Aucune règle de calcul ne change (`chiffres-volume`, §4).

## 3. Les preuves

Voir le rapport de fin de lot (tableau avant / après, planches, bancs et audits). Fichiers de sortie hors dépôt.

## 4. Ce qui reste (honnête)

- **Messages filtré sur un site** garde la disposition de chaque site (Leboncoin : Conversations · Favoris reçus ; eBay :
  Questions · Tout ; Vestiaire : une phrase). Le défaut de Messages est « Tous » (un fil par acheteur, toutes plateformes),
  qui est la même liste pour tous ; ramener les écrans par site à cette liste est le prochain lot.
- Achats · Leboncoin / eBay / Vestiaire : même coque (titre, « Ajouter », filtre) que Vinted, mais le bloc « À retirer » est
  au chantier `claude/retraits-visuel` : pas touché ici.
- Les textes gris d'une ou deux lignes (pieds de groupe) restent là où ils disent une limite ou un geste ; le relevé ne
  compte que ceux de plus de deux lignes.
