# 19 nov. — « VRM natif » : la fondation (livraison 1) et la coque branchée (livraison 2)

Branche `claude/natif-fondation`. Contrat : `docs/design/NATIF.md`. Mode d'emploi : `docs/design/NATIF-composants.md`.
Décision de Julien (19 nov.) : « la mise en page est catastrophique, revois absolument tout » ; « l'outil doit être
pratique, pas chiant » ; « que ça charge plus vite entre les onglets ». Modèle : Apple (Wallet, Réglages).
Audit d'utilité du même jour (`claude/audit-utilite`, §1–2) : UNE navigation (5 onglets + « Plus » par la photo du
profil), UNE recherche avec le scanner dedans, plus de menu ☰, aucun état technique hors de Plus › Tout va bien ?.

## Livraison 1 — la bibliothèque (commit « FONDATION PRÊTE », 6be64ba57)

`src/natif/` : jetons (`--n-*`, une couche `@layer vrm-natif`, clair/sombre par `vinted_dark`), 16 composants
présentationnels (`Page`, `Groupe`, `Rangee` avec balayage → actions, `Bouton`, `Segmente`, `Feuille`, `Faits`,
`Plaque`, `Pastille`, `Affiche`, `Vide`, `Attente`, `Toast`, `BarreOnglets`, `BarreLaterale`, `Coque`), la galerie
`outils/natif-galerie/` et son banc `scripts/bancs/natif-galerie.cjs`.

## Livraison 2 — la coque branchée (`src/App.jsx`)

Ajouts d'API (rien de renommé) : `TetePage`, `CoqueRacine`, `CoqueEcran`, `ActionsCoque`, `FeuillePlus`, et `attrs`
sur `BarreOnglets` / `BarreLaterale` et leurs entrées.

- **Téléphone** : la barre d'onglets native (Aujourd'hui · Annonces · Ventes · Achats · Argent, même largeur, libellé,
  pastille), DANS le flux sous `<main>` qui défile (jamais au milieu de l'écran sur iPhone) ; en haut la barre de titre
  native (le titre y apparaît au défilement ; Messages avec sa pastille ; la photo du profil ⇒ « Plus ») et le champ de
  recherche avec le scanner dedans. « Plus » : Stock, Messages, E-mails · Tout va bien ?, Notifications, Paramètres,
  Communauté (Parrainage s'il existe) · Mon profil, État des actions, Cacher les montants (Mode stream s'il est montré) ;
  la synchronisation en pied quand elle a un souci.
- **Ordinateur** : la barre latérale native, FIXE à gauche (la racine lui garde sa place) : les 5 onglets, puis Stock,
  Messages, E-mails, puis Tout va bien ?, Notifications, État des actions, Paramètres, Communauté ; en pied la
  synchronisation, l'œil (ou Stream) et le profil. Plus d'île flottante en haut à droite. Trois volets : un écran
  refait ajoute son id à `ECRANS_NATIFS` ⇒ grand titre + volet de détail (sa `PagePoussee` s'y pose) ; un écran
  d'avant garde « liste + reste ».
- **Retirés** (git log pour l'ancien) : `MenuEcrans` (☰), `SideBar`, `BoutonProfilTete`, l'île de l'ordinateur,
  l'ondulation au changement d'espace, l'import de démarrage de `designV2/barre.jsx` (le réglage « Barre d'onglets »
  de Réglages n'a plus d'effet : l'agent `claude/lisible-partout` retire les réglages de style), les sections 1–8 de
  `styles-nav-v2.css` (la colonne d'avant).
- **Changement d'onglet** : plus aucun attribut qui dépend de l'onglet sur la racine (`data-espace` reste sur `<main>`).
- **Le pont** `src/coque-native.css` (SANS couche) : `all: revert-layer` sur les contrôles des pièces natives. Mesuré
  (CDP getMatchedStylesForNode) : `button, a.vrm-btn {13px/600}` et `:where(.vrm-app-shell) button {background}`,
  sans couche, repeignaient les onglets et « Plus ». À retirer quand plus aucune règle d'avant n'est sans couche.
- Pièges trouvés : un enfant `position: fixed` d'un conteneur flex suit `align-self` (la barre latérale faisait 691 px
  sur 950) ⇒ `align-self: stretch`.

## Bancs et audits

Voir le rapport final de la session (chiffres) et `scripts/bancs/natif-coque.cjs` (K1–K8b, mutations `dessous`,
`largeur`, `restyle`). Bancs de coque mis à jour : `barre-onglets` et `studio-coque` (retirés, ils lancent
natif-coque), `design-v2` (sélecteurs natifs, ordre des onglets), `theme-apple` (cibles), aides `_ecran-pret`,
`_mesure-onglets`, `_a11y-mesure`, `onglets-rapides`. Audits réécrits (décision du 19 nov.) : `studio` (S2 data-espace
sur `<main>` seul ; S3 plus d'ondulation), `reprise-ecran` (« Plus » = FeuillePlus), `profil-oauth`, `barre-achats`,
`coque-tablette`.

## Ce qui reste

- K8b (> 50 ms de thread au retour sur un écran gardé) : la tâche lourde est l'écran qui ré-apparaît (moteur
  `src/ecransGardes.jsx`, chantier `claude/vite-et-sans-bug`) ; le build d'avant (main ad73a3c7c) mesure pareil.
- Les écrans eux-mêmes (autres agents) : pour passer en natif, `<Page>` + une ligne dans `ECRANS_NATIFS`.
- Le fond bleu nuit au-dessus de la coque au téléphone vient des couches d'avant (verre) : `claude/lisible-partout`.
