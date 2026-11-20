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

## 2 bis. Le sélecteur de plateforme GLOBAL (décision du 20 nov.)

Julien demandait s'il faut « une application par plateforme ». Décision appliquée : les onglets restent par FONCTION, et
UN sélecteur de plateforme global se pose en tête de chaque écran principal.

- **Une source** : `src/siteCourant.js` — clé `vrm_site_courant` (dans `SYNC_KEYS` : son choix sur tous ses appareils),
  `lireSiteCourant`, `poserSiteCourant`, `useSiteCourant()` (le même site dans tous les écrans montés), `siteEffectif`
  (un site plus relié vaut « Tous »), `sitePourTache` (« Tous » rend le filtre d'avant de la tâche : Toutes pour Ventes
  et Messages, l'écran d'arrivée pour Annonces et Achats).
- **Un composant** : `src/natif/SelecteurSite.jsx` (segmenté natif, logos, « Tous » + les sites RELIÉS, rien sous deux
  sites ; au téléphone à cinq choix, le logo seul et le nom lu). Dans l'app : `SelecteurSiteCoque` (src/App.jsx), posé en
  tête d'Aujourd'hui et de chaque tâche (Annonces, Ventes, Achats, Messages — `rendreTache`).
- **Sites reliés** : un compte Vinted ; une lecture Leboncoin / eBay (ou un compte eBay au registre) / Vestiaire
  (`sitesLus`) ; filtrés par SES plateformes (`siteMontre`, la règle des filtres d'hier).
- **Remplacés** (plus de filtre local) : `FiltreSites` (retiré) et le menu de plateforme des tâches (le menu ne porte plus
  que le compte Vinted), la plateforme de Ventes natif (`filtreNatif` nul), le filtre « Site » des tableaux de travail
  (`filtreSiteTableau` rend []), le menu des sites d'Annonces (`AnnoncesEgalite` reçoit `site`, `VueAnnonces filtreSite={false}`).
  `filtreRetenuCompte` lit le site courant ; un lien qui vise un site (`&site=`) CHANGE le site courant.
- **Les chiffres suivent par les règles existantes** : Aujourd'hui pose la sélection `{ site }` de la carte des chiffres
  (`valeurChiffre`, la même question qu'Argent) ; « Tous » = `SEL_TOUT_V2` (les chiffres d'avant, `chiffres-volume`).
- **Plus** : une rangée par plateforme reliée (groupe « Plateformes ») ouvre ses réglages dans Paramètres (Vinted : comptes
  liés ; Leboncoin, Vestiaire : connexions ; eBay : son compte) — `groupePlateformes`.
- **Pas branché ici** : **Argent** (chantier `claude/argent-natif`) — il doit poser `<SelecteurSiteCoque/>` (ou
  `Natif.SelecteurSite` avec `useSiteCourant()` et les sites reliés `SITES_RELIES_COQUE.v`) en tête, retirer son menu de
  plateforme, et passer le site à SES questions : la sélection `{ site: siteEffectif(site, SITES_RELIES_COQUE.v), compte,
  periode }` de `valeurChiffre` (« Tous » = `'toutes'`, comportement d'avant). **E-mails** : aucune règle de site côté
  serveur (la liste est paginée par la base, ses nombres sont ceux de la base) ; un filtre par expéditeur (`siteExpediteur`)
  appliqué à la page chargée ferait des nombres partiels — à faire dans la requête (api), lot à part. L'écran **Colis**
  seul (`cat_bord`) garde son `SelecteurSites`.
- Banc : `node scripts/bancs/minimaliste.cjs --selecteur` (S1 sélecteur et sites reliés, S2 changer sur Ventes ⇒ Aujourd'hui,
  Annonces, Achats, Messages suivent, S3 « Tous » = mêmes chiffres, S4 Leboncoin seul ⇒ aucun sélecteur, S5 aucun filtre
  local ; `MUTATION=local` rougit S2).

## 2 ter. Annonces au téléphone, divisées par compte (Julien : « améliore le visuel », « divise par comptes »)

- `src/natif/ecrans/annoncesComptes.js` (`groupesParCompte`) : UN groupe natif par compte (logo · pseudo, « N annonces »,
  repliable — choix gardé sur l'appareil, `vrm_annonces_replis`) ; Vinted puis Leboncoin, eBay, Vestiaire ; dans un site,
  le compte qui a le plus d'annonces d'abord ; une paire en ligne sur deux comptes est sous les deux ; une recherche ne
  montre que les groupes qui ont un résultat. Le manque est dit UNE fois en tête du groupe (« 5 prix d'achat à compléter »,
  rangée ambre qui ouvre Compléter). Au tableau (1512) : un intertitre par compte (`TableauTravail` prop `groupe`) ; une
  action reçoit chaque article une fois.
- La rangée : vignette 56, titre 2 lignes, plaque N° · taille (· sur N sites · acheté X € seulement s'il est su), prix à
  droite, « mini X € » seulement s'il est su. Plus jamais « acheté — » ni « mini — » répétés (banc annonces-egalite P mis à
  la règle).
- « Actions » : un rond ⋯ (44) à côté de la recherche ; l'écran propre d'un site (« Tout l'écran Leboncoin ») vit dans
  cette feuille ; sous la liste, seul le MANQUE (un site pas lu) — plus les limites techniques.
- Téléphone : le plein est fixé en bas, 12 px au-dessus des onglets (`.n-page-contenu[data-n-avec-plein]`, posé par
  `Page`) ; « Mis à jour à … » ne flotte plus ; Achats : « Ajouter » en rond 44 (le rond « + » dessinait un cercle vide :
  `plus` ajouté aux traits de StudioVentes) ; le sélecteur est collant sous la barre du titre réduit.

## 2 quater. Fusion de `claude/argent-natif` (10da06092)

Un seul sélecteur : `src/natif/SelecteurSite.jsx` (le composant) + `src/siteCourant.js` (l'état, `vrm_site_courant`
synchronisé). `useSiteCourant` est ré-exporté par SelecteurSite.jsx ; « tous » (l'écriture d'argent-natif) est lu
« toutes ». Argent pose `SelecteurSiteCoque` (sites reliés) ; ses questions du mois, le Mois et la carte du bénéfice
passent `siteCourantCoque(site)` à `valeurChiffre` (« Tous » = les chiffres de toujours). Statistiques, Déclarer et
Factures n'ont pas de règle par site (la déclaration URSSAF porte sur toutes les ventes) : elles restent sur tous les sites.

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
