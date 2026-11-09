# 9 nov. 2026 — Direction artistique, phase 4 : feuilles, confirmations, toasts, états vides, barre du bas

Branche `claude/direction-artistique-4` (depuis `origin/claude/youthful-wozniak-v71bap`, puis
`git merge origin/main` réel après la PR #1069). Pas de PR, pas de merge. Phases précédentes :
`2026-11-08-direction-artistique.md`, `-2.md`, `2026-11-09-direction-artistique-3.md`.
La colonne de gauche et la règle de base des boutons appartiennent à `claude/direction-artistique-5`
(pas touchées ici : les boutons ne sont stylés qu'À L'INTÉRIEUR d'une feuille, d'une confirmation
ou d'un « pas su », par leur conteneur).

Tout le dessin est dans `src/styles-premium.css`, **section 12** (couche `@layer vrm-premium`,
jetons `--p-*`). Rien de métier : aucun texte, chiffre, règle, `data-*` ni geste changé.

## Une forme par fonction

| fonction | forme |
|---|---|
| **feuille** | sol gris groupé (fond de l'écran), rayon 20 en haut (téléphone, collée en bas) ; à l'ordinateur posée au milieu, quatre coins à 20 ; titre 20/700 ; croix d'icône dans un rond gris de 30 (cible 44) ; contenu en **groupes blancs sans cadre** (rayon 12, liseré 0,5) — une case grise sur le sol gris ne se voyait pas |
| **atelier** (Republier, brouillon, lots, file) | la même forme que la feuille unique : portail sur `<body>`, tête 20/700 + étapes, croix ronde, filet 0,5 ; chaque réglage (Photos, Description, Publication, Prix, Titre, Temps entre deux articles) en groupe blanc, libellé 13/600 gris en casse de phrase (plus de capitales espacées) ; listes (choix, aperçu, file) en groupe blanc à filets 0,5 ; pied collé à fond plein ; choix à 44 au doigt et à la souris ; « Continuer / Republier » pas encore permis = un bouton gris qui se voit (avant : un mot gris sans forme) |
| **feuille Actions** | quatre tuiles blanches 15/600 + 13 gris ; « Avant de lancer » : groupes blancs, le manque dit par un **point ambre** devant la phrase (plus de trait ambre à gauche) |
| **confirmation** | question 17/600 à l'encre, conséquence 15 grise, **deux gestes de même taille côte à côte** (50 px) : « Annuler » en bouton gris plein, la réponse en bleu ; aucun rouge ; 420 px au plus à l'ordinateur |
| **toast** | une carte (rayon 14, plus une pilule qui cassait deux lignes), texte 15 à l'encre, icône grise ; un échec : icône **ambre**, jamais rouge ni cadre coloré (avant : icône rouge, cadre rouge) |
| **état vide** | centré, titre 17/600 encre, phrase 15 grise (36 caractères par ligne au plus) — `.vrm-vide-dessin`, `.vrm-empty-state`, `.vrm-toutes-vide` |
| **« pas su »** | `EtatPanne` en carte blanche ; `LoadError` (« Impossible de charger ces données ») en même carte, son « Réessayer » en **gris** (avant : bleu plein — relire n'est pas l'action principale de l'écran) |
| **barre du bas** (téléphone, tous les écrans) | fond PLEIN (plus de flou à travers), filet 0,5 ; libellés 10/500 gris, l'actif 600 encre et son icône bleue, les autres icônes grises ; compteur = pastille ambre de 18 px tabulaire (avant : seulement sur trois écrans) |

## JSX (forme seulement)

- `src/ecrans/Republier.jsx` : les quatre ateliers faits main (`AtelierBrouillon`, `AtelierLots`,
  `AtelierFile`, `RepublierVinted`) passent par `VoileAtelier` — un **portail** sur `<body>` (§7) avec
  la classe `vrm-atelier-voile`. `AtelierLots` et `AtelierFile` n'avaient **pas** `FermeAuRetour` :
  ajouté (le geste « retour » et Échap les ferment).
- `src/App.jsx` : `className="vrm-confirmation"` sur les quatre feuilles de `ConfirmHost` ;
  `className` sur `LoadError` et son bouton. Aucun texte changé.

## Preuves

Banc `scripts/bancs/direction-artistique-4.cjs` (données inventées, faux pont d'extension de
`republier.cjs`, 390 tactile et 1512, clair et sombre) : juge des valeurs CALCULÉES (rayons, tailles,
graisses, fonds opaques, écart de luminance groupe/sol, filets, cibles 44, portail, `z-index`,
aucun rouge, l'icône bleue seule à l'actif) — jamais un libellé.
- build d'AVANT (`dist` de `origin/claude/youthful-wozniak-v71bap`, `node … <dist>`) : **70 rouges** ;
- cette branche : **164 verts, 0 rouge**.

Planches AVANT | APRÈS (40, dossier de la session, hors dépôt) :
`/tmp/claude-0/-home-user-cancale-v67/58c455bc-1453-511d-b34c-22764476ca7c/scratchpad/comparer/`
(`{390,1512}-{clair,sombre}-{colis,actions,toast,republier-reglages,republier-choix,republier-lancer,vide-ventes,vide-messages,vide-achats,confirmation}.png`) ;
captures seules : `…/scratchpad/avant/` et `…/scratchpad/apres/`. Pour les refaire :
`SHOTS=<dossier> node scripts/bancs/direction-artistique-4.cjs [dist]`.

`npm run build` vert ; audits `variables`, `tdz`, `coherence`, `icones`, `violet`, `boutons`,
`rouge-doublon` verts. Bancs existants (un à la fois) : `republier` 235 verts · `beaute` vert ·
`journee-premium` 15 verts · `ventes-colis-premium` 32 verts · `feuilles-coque` 23 rouges, **les
mêmes 23 sur le build d'avant** (déclencheurs « la feuille s'ouvre » introuvables sur sa base
inventée, « Tout imprimer sans PDF », « Supprimer des données ») — pas de cette branche.

## Ce qui reste

- Les feuilles de Leboncoin / eBay / Vestiaire et les feuilles rares (Reçu d'achat, Tournée, lot)
  héritent de la feuille unique mais leur contenu n'a pas été passé un par un (base inventée sans
  comptes reliés).
- La pastille grise derrière l'onglet actif de la barre du bas (glisse animée, `vrm-tab-pastille`)
  est gardée : la retirer est un choix de Julien (iOS n'en a pas).
- Les états vides des écrans Leboncoin/eBay/Vestiaire et la grille du Stock (« Comment marche le
  Stock ») n'ont pas été repris.
- Phase de nettoyage des anciennes couches (fusion, finition, visuel…) toujours à faire.

## Suite (9 nov., soir) — ce que la forme ne disait pas encore

Branche `claude/direction-artistique-4` reprise depuis `origin/main` (1087f9fd, qui porte déjà la
phase 4 ci-dessus via la PR #1072). Ajouts **de comportement de la forme**, rien de métier :
aucun texte, chiffre, règle ni `data-*` existant changé (deux attributs AJOUTÉS :
`data-confirmation="irreversible"`, et la saisie nommée par `aria-label`).

| quoi | où | ce qui change |
|---|---|---|
| **focus piégé** | `src/composants/SheetShell.jsx` | Tab / Maj+Tab tournent DANS la feuille du dessus (rien derrière le voile ne se prend au clavier) ; à la fermeture, le focus revient à ce qui l'avait avant (lu au premier rendu : un `autoFocus` d'un enfant ne le fausse pas) |
| **feuille qui refuse de se fermer** | idem | glissée vers le bas puis refusée (une saisie à garder, un envoi), elle **remonte** — avant, elle restait cachée sous le bord de l'écran ; prop `bloque="phrase"` : croix grisée qui dit pourquoi, voile et glisser sans effet |
| **saisie gardée** | `AskTextSheet` (`src/App.jsx`) | Échap, le glisser, le voile ou « retour » ferment sans perdre ce qui a été tapé : la même question rouverte retrouve la saisie (mémoire de la page, rien d'écrit) ; « Annuler » / « Valider » l'oublient |
| **confirmation irréversible** | `ConfirmHost` + 3 appels | `askConfirm({ irreversible: true })` ⇒ la réponse en **ambre plein** (`styles-premium.css` §13.1), jamais rouge ; posé seulement sur « Supprimer de Leboncoin » (×2) et « Supprimer d'eBay » (terminer une annonce) — toutes les autres restent bleues |
| **messages** | `toast` / `Toaster` (`src/App.jsx`) | durée lisible (4 s, + ≈ 15 signes/s, 10 s au plus ; échec 6 s au moins) ; le temps s'arrête sous la souris, au focus clavier, onglet caché ; la zone `aria-live` reste montée même vide (VoiceOver n'annonce pas une zone créée avec son texte) ; au téléphone, au-dessus du **clavier** (`--vrm-clavier`, lu de `visualViewport`) ; sous la pilule « Annuler », monte d'un cran au lieu de la couvrir (§13.3) |
| **état vide de Messages** | `data-msg-vide` | la forme commune (dessin `courrier`, titre 17/600, phrase 15 grise) au lieu d'une ligne 13 |

### Vérifications

`npm run build` vert ; audits `violet`, `icones`, `boutons`, `variables`, `tdz`, `coherence`,
`composants`, `rouge-doublon` verts ; `photos-vinted` : 1 rouge (« tout `<img>` passe par
PhotoVinted, 47 vus »), **le même sur `origin/main`** (arbre `git archive`). Banc
`direction-artistique-4` : **168 verts, 0 rouge** sur cette branche. Captures AVANT/APRÈS
(confirmation, choix, feuilles Actions et Brouillons, atelier, Messages vide ; 390/1512,
clair/sombre) dans le dossier de la session : `scratchpad/da4/{avant,apres,comparer}/`
(hors dépôt).

### Ce qui reste (inchangé)

- Les ateliers faits main (`VoileAtelier`) n'ont pas de poignée qu'on prend au doigt : les passer
  par `SheetShell` (prop `bloque` prête pour « Mets en pause pour fermer ») est le geste suivant.
- Un pied d'actions collé (`position: sticky`) pour les feuilles longues hors ateliers : à faire
  feuille par feuille (la zone sûre se règle par feuille).
