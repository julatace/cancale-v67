# 19 nov. 2026 — Le train du 19 nov. (branche `claude/integration-19nov`)

Intégrateur : fusion des lots du jour, extension **5.409.0** une seule fois, CLAUDE.md, preuves. Pas de PR, pas de fusion
sur `main` (le coordinateur met en ligne).

## 1. Fusions (toutes par un vrai `git merge`, dans l'ordre)

Déjà là : branche de session (codes de retrait en liste, colis sans « Relier »), `reprise-completer`, `annonces-a-egalite`,
`prix-sans-manuel`, `natif-fondation`, `lisible-partout`. Puis :

| branche | conflits et règle appliquée |
|---|---|
| `vite-et-sans-bug` | `fusion.css`, `styles-visuel-2.css` : les règles QUI SURVIVENT gardent la réécriture en drapeaux `data-vrm-d11` ; celles que la coque/lisible avaient RETIRÉES (`.vrm-header-brand`, le petit titre `.is-defile`) restent retirées. `styles-nav-v2.css` (sections 1–8, l'ancienne colonne) et `styles-premium.css` (pastilles de l'ancienne barre) : couches retirées ⇒ suppression gardée. Puis `alleger-has --ecrire --tout` (8 règles, design-v2 et fiche-d). |
| `aujourdhui-propre` (×3 passes) | `App.jsx` : Aujourd'hui à la demande (`aujourdhui/Branche.jsx`), sans l'import du style Apple (retiré) ; i18n `v2.passe.*` : les deux suppressions gardées ; Quoi de neuf : les entrées du 18 nov. restent retirées ; `natif/index.js` : les deux exports ; `Rangee.jsx` : `sousLignes` ET `pastilleSous`. |
| `capacite-3000` | aucun. |
| `compte-bloque`, `colis-achat-auto`, `extension-claire`, `extension-utile`, `publier-agent` (×2) | tables `EXT_CAPACITES` / `FONCTIONS` d'`audit-coherence` : UNION (vérifié par script : chaque capacité de chaque branche est dans la table finale avec SA version) ; `SYNC_KEYS` : union ; `BoutonProfilTete` (retiré par la coque) reste retiré. |
| `lisible-partout` (×2), `natif-fondation` (1cb8a2dff, a72a1f16c) | aucun. |
| `ventes-comme-avant` | `ECRANS_NATIFS = ['annonces','ventes']` ; `TeteNative` : `sansRecherche` ET `gestesLoupe` ; « À régler » posé sous les segments de Ventes natif (prop `avant`). |
| `project-review-nsk5su` (retraits-parfaits), `emails-mail`, `app-tableaux`, `liaison-sites-guidee`, `fiche-directe` (65c832b05) | CLAUDE.md §9 et Quoi de neuf : les deux côtés ; `gesteVrm` : durée de l'atelier OU du lien ; N° d'une annonce eBay : `propre` puis `article` ; `PrixPartout` : la feuille de prix-sans-manuel + `focusPrix` de fiche-directe ; `fiche-d.css` : celle de fiche-directe (la fiche est native) ; fichiers supprimés (vrm-*.css, designV2/Aujourdhui.jsx) : restent supprimés. |

`fiche-directe` 08fbb7099 (fiche refaite) : PAS prise — pas déclarée prête.

## 2. Corrections faites dans le train

- Ventes natif (capture 390 du coordinateur) : titre sur 2 lignes, rangée = N° + date limite (place et taille dans la fiche),
  le plein collé au-dessus de la barre d'onglets : `studio.css` ne réserve plus 120 px sous l'écran dans la coque native,
  `.n-coque-ecran` à `padding-bottom: 0 !important` (le style en ligne de l'écran posait 20 px).
- Coque à l'ordinateur : le détail de Ventes né dans le volet devenait une page plein écran par-dessus Achats et la barre
  latérale (écran gardé : sa page ne se re-rend pas) ⇒ `PagePoussee` ne sort jamais de son volet (natif-coque K6).
- N° neufs : la pilule qui couvrait la fiche devient un Toast natif au-dessus des onglets, une fois, fermable, masqué tant
  qu'une fiche ou une feuille est ouverte ; le détail dans Stock « À écrire sur tes cartons · N » (`vrm_numeros_a_ecrire`,
  synchronisé, vidé sur « C'est écrit ») ; banc natif-coque K9.
- Paramètres → Apparence : réglage « Barre d'onglets » retiré (sans effet sur la barre native), `designV2/barre.*` supprimés,
  `v2.barre.*` retirés des 5 langues.
- Annonces « ⋯ » : « À compléter » une fois. Pastilles de la barre latérale à leur ton (« 27 » blanc sur fond, 1,12:1).
  Repli d'en-tête sans fond (4,09:1). Encre seconde du tableau d'Annonces au survol (4,43:1). Achats à l'ordinateur :
  le rond « retrouver » ne couvre plus « Ajouter », « Calculette » garde son air. Cibles de 44 px (contact MFA, « ↻»).
- Bancs remis sur la coque native : lisible-partout (cloche, loupe, profil par « Plus » ; Annonces `data-eg-*` ; « sous la
  barre » sur `[data-n-onglets]`), garde-ecrans (onglets, barre latérale, P6 sans objet sur Ventes natif), tout-imprimer
  (rangées `data-vn-rang`, « Choisir » dans « ⋯ »), natif-coque K8a (les drapeaux `data-vrm-dN` comptés avec les `:has()`
  qu'ils remplacent — la mutation `restyle` reste rouge), audit-liaison-sites I6 (expression fusionnée).

## 3. Budget de démarrage

Mesuré (`audit-poids-demarrage`) : **2 008 Ko** après toutes les fusions. Chargés à la demande : la feuille « Depuis ta
dernière visite », les tableaux Ventes/Achats, Ventes natif, l'accueil des nouveaux ⇒ **1 994 Ko**. Les lots du jour
ajoutent ~24 Ko répartis dans App.jsx (aucun écran hors des 5 onglets ne les porte seul) : budget relevé de 1 970 à
**2 000 Ko** (`scripts/budget-vitesse.json`). Après aujourdhui-propre (3e passe) : **1 997 Ko** ; après extension-utile (17/n), liaison guidée (91b688325) et stock-etiquetage : **2 002 Ko** — rien d'autre ne se charge à la demande sans le sortir d'un module partagé (MemePhoto essayé : 0 Ko gagné) ⇒ budget **2 005 Ko**.

## 4. Extension 5.409.0

Une seule version pour tout le train (capacités `prixattente` `baisseregle` `masquerailleurs` `comptebloque` `suivicolis`
`etatici` `captejournal` `publierfiche` `listesvinted` `lbcformulaire` `vcrelu`). Zips NON commités ; à régénérer à la mise
en ligne : `node scripts/zip-extension.cjs` (⇒ `public/VRM-extension.zip` en un dossier, `VRM-Orion.xpi`, `VRM-Orion.zip`,
`VRM-Orion-dossier.zip`, notice Orion). `audit-coherence`, `audit-extension-zip` verts avec les zips régénérés.

## 5. Après la première version de ce récit (fusions du soir)

`extension-utile` (17/n, paliers `vinted_offres_paliers` lus des deux côtés, `audit-negociation-paliers` vert), `app-tableaux`
(ede325ab6, `vinted_offres_nego` disparu), `liaison-sites-guidee` (91b688325), `emails-mail` (82d45cf9c), `stock-etiquetage`
(d9675c0b9), `aujourdhui-propre` (603e7da68), `fiche-directe` (916befb81, la fiche refaite). Tables de capacités : union.

Corrigé dans le train ce soir : la recherche s'ouvre aussi sur les écrans à trois volets à l'ordinateur (Ventes, Annonces :
pas de barre du haut, son panneau gardé posé au-dessus — garde-ecrans P5) ; Annonces natif sort les annonces d'un compte
bloqué EN PAUSE (compte-bloque D) ; tout écran d'avant prend toute la largeur à l'ordinateur (pas seulement le Stock), les
trois volets gardent la leur ; « Ouvrir Vestiaire ↗ » à l'encre du lien ; Messages en très grand texte : break-word ;
bancs remis à l'écran d'aujourd'hui : colis-achat-auto (l'échafaudage `vrm_banc_dom_ancien` le mettait sur l'ancien
écran ; + toucher la ligne ⇒ le code en grand), design-v2-messages (actions de la coque au-dessus du titre, accent natif),
natif-coque K3 (sans objet quand l'écran tient sans défiler).

Restent (dits, pas cachés) : natif-coque K8b (tâche de style 75–90 ms au retour sur un écran gardé ; mesuré aussi sur main,
chantier vite-et-sans-bug) ; design-v2-messages à 375 très grand texte (la colonne du nom se resserre : pseudos et
extraits coupés en milieu de mot) et « éteint » sans référence (l'ancien design n'existe plus) ; E-mails 1512 CLS 0,019
(le segmenté reçoit ses nombres après le premier rendu) — vus sur la passe précédente du banc.
