# 21 nov. 2026 — Intégration de l'app : le train du 21 nov. (branche `claude/integration-21nov`)

Pas de PR, pas de fusion sur `main` (l'orchestrateur décide). Base : `claude/integration-ext-5418` (ef3a766be : ci-offres-panneau,
relais-prevision, vestiaire-messages, panneau-telephone, extension-interface, extension-connexion, lbc-interface, favoris-perso,
ext. 5.418.0). Puis de VRAIS merges `--no-ff`, un commit chacun, dans cet ordre :

| merge | commit | conflits |
|---|---|---|
| `claude/fluidite` | a78fe9773 | `nouveautes.js` (les deux lignes gardées) |
| `claude/onglets-menu` | 65e622fc1 | `nouveautes.js` |
| `claude/annonces-dressing` | 6eca96d3c | `src/ecrans/AnnoncesEgalite.jsx` (voir 1.), `nouveautes.js` |
| `claude/ext-5419` (demandé en cours de route) | d1f5bf41a | `nouveautes.js` ; **5.419.0 servie**, zips de sa branche gardés tels quels (aucun merge suivant ne touche `vinted-sync-extension/`) |
| `claude/ventes-lisibles` | 322f30057 | i18n `*/tableau.js` (les deux blocs de clés, virgule remise), `nouveautes.js` |
| `claude/journee-stats` | fef515ad6 | `src/App.jsx` (imports), `src/natif/ecrans/Aujourdhui.jsx` (voir 2.) ; import en double à la main (voir 3.) |
| `claude/argent-vintex` | a201c607d | `nouveautes.js` |

Après chaque merge : `npm run build` vert. `TableauTravail.jsx` et `Rangee.jsx` sont fusionnés sans conflit et gardent TOUT :
les photos par `PhotoVinted` (`photoParApp`, fluidite), les colonnes repliables / `carteGrille` (annonces-dressing), la vignette 64
et le `pied` (ventes-lisibles). CLAUDE.md : 59 578 octets (trois lignes du 20 nov. déplacées telles quelles à la fin de
`historique-divers.md`), §8 `favorisenvoi9` `commandeslot` 5.419.0, servie 5.419.0, rythme 20–60 s (sa demande, 5.419), §9 une ligne.

## 1. Les fusions qui demandaient du soin

1. **Annonces (`AnnoncesEgalite.jsx`)** : fluidite bornait chaque lecture (`borneLecture`, 8 s) et gardait la dernière lecture en
   mémoire ; annonces-dressing lisait AUSSI les comptes bloqués (`pause`, `bannis`) et ajoutait leurs fiches en second temps.
   Fusion : les deux — la lecture de chaque compte est bornée ; la clé de la mémoire porte AUSSI les comptes bloqués (une pause
   change la liste) ; les fiches du second temps mettent à jour la mémoire si elle est encore celle de cette lecture.
2. **Ma journée (`Aujourdhui.jsx`)** : journee-stats remplace par défaut « À envoyer » + « À retirer » par UNE carte « Colis » ;
   la rangée de PRÉVISION des points relais (relais-prevision, « Demain : 1 colis chez … ») vivait dans « À retirer » ⇒ elle
   disparaissait de Ma journée. Corrigé : la même rangée (même source `retraits.prevision`) dans « Colis », jamais deux fois
   (pas si « À retirer » est aussi montrée). **Preuve** : banc `relais-prevision` vert (52) ; build mutant sans la rangée
   (`vite build --outDir`, banc `BANC_DIST=`) ⇒ **J 390 rouge** (« Aujourd'hui prévoit … — null »).
3. **`src/App.jsx`** : onglets-menu et journee-stats importaient chacun `automatisationsActives` ⇒ build cassé
   (« already been declared ») ; un seul import.

## 2. Bugs trouvés à la relecture et au rendu, corrigés (avec le contrôle qui les attrape)

| bug | fichier | contrôle |
|---|---|---|
| **Statistiques · Pilotage · Finances · Transporteurs ~4 900 px plus bas** : enfant de la grille de l'écran, `order: 7` au téléphone (src/styles-captures.css) et vitrine rangée en 2ᵉ rangée à l'ordinateur (src/stats-vitrine.css) — le banc du lot rendait l'écran SEUL. Posé dans la tête d'Argent, sous la barre. | src/ecrans/Stats.jsx (`sous` de `ScreenHead`) | **nouveau banc `stats-pilotage-place`** (l'APP, design par défaut, 390 + 1512) : avant 0/6 (P1, P2 rouges), après 6/6 |
| … et, posé dans la tête, ses titres de cartes passaient à 32 px (règles `!important` du titre d'écran) | src/styles-coque.css | même banc, P3 : rouge 32 px avant, vert 13 px après |
| Repères des séries de Pilotage (« il y a 29 j », « max 4 », « aujourd'hui ») à 3,26:1 / 2,84:1 | src/natif/ecrans/stats.css (encre-3 ⇒ encre-2) | banc `argent-natif` C (8 rouges ⇒ vert) |
| **Défilement perdu au retour d'onglet (Annonces, Ventes à l'ordinateur, 700 → 0 px), au hasard de la charge** : l'écran lit le toucher de la barre quand il est MONTÉ, valable 1,5 s ; un tableau de 1 000 lignes se monte parfois plus tard (vu sur m4 = après ventes-lisibles comme sur HEAD, selon la charge de la machine). Fenêtre portée à 4 s. | src/defilementNavigation.js:22 | banc couches-chargement C (ordi, Ma journée · Ventes · Annonces) : rouge 2 fois sous charge, vert après (machine calme : la preuve est moins forte, la cause est un délai) |
| « Lier à un achat » : date figée en `fr-FR` | src/natif/ecrans/LierAchatGrille.jsx:21 (`localeCourante()`) | relu (audit-traduction vert) |
| Pluriels : `v2.pt.nColis`, `v2.ps.jours` (journee-stats) signalés | vérifiés à la main : `n` = le même nombre (StatsTransporteurs.jsx:80, StatsPilotage.jsx:63) ⇒ ajoutés à la liste vérifiée de l'audit | audit-pluriels-croises |
| Audits / bancs restés sur l'ancienne extension (rouges NOUVEAUX vs main, venus de `integration-ext-5418`, présents sur sa branche) : E10 Vestiaire (l'envoi s'arrêtait à « pas appris » avant la garde anti-robot), contre-offre (jugée sur l'offre qu'on venait d'accepter, `deja`), Vestiaire · Favoris servi par un `{ ok: true }` vide (TypeError dans le banc), copie d'Annonces comptée par `.n-rangee` (les rangées sont `[data-ad-rangee]` depuis annonces-dressing) | scripts/audit-securite-comptes.cjs, scripts/audit-extension-porte-app.cjs, scripts/bancs/grand-panneau-sites.cjs, scripts/bancs/copie-ecran.cjs | E10 : la garde jugée de nouveau (mutation sans robot ⇒ rouge) ; tous verts |

## 3. Captures regardées (390 tactile et 1512, clair et sombre, base inventée de volume `design-passe`, DESIGN PAR DÉFAUT)

⚠️ Les bancs passent par `_garde-reseau` qui sert l'ANCIEN DOM sauf `BANC_DESIGN_V2=defaut` : une première série de captures
montrait l'ancien écran (rangée à part, jamais rapportée). Le script : scratchpad `integ21/captures-onglets.cjs`
(`BANC_DESIGN_V2=defaut`). 12 écrans (Aujourd'hui, Annonces, Ventes, Achats, Argent Mois, Statistiques, Menu, Messages, Stock,
Paramètres, E-mails, Extension) × 2 largeurs × 2 thèmes : aucun débordement horizontal, aucune erreur de page, aucun rouge
(hors doublon), aucun violet. Vu et laissé (déjà ainsi sur main ou hors de ce train) : « Statistiqu… » coupé quand l'onglet
est choisi à 390 (segment de 88 px, identique sur main) ; à 1512 Achats, la bande grise avec un « € » seul et la colonne
« Code » coupée à droite du tableau d'Achats (identiques sur main) ; titres de groupe en capitales dans les tableaux de l'ordinateur.

## 4. Contrôles

Audits (82 lancés) — verts sauf, à l'identique sur origin/main : audit-boutons-natifs (AchatsTableau.jsx:30, Reglages.jsx 42/41),
audit-confiance-publique (G2, G5, G10), audit-copie-annonces (C4), audit-coque-parametres (icône search), audit-extension-porte-app
(« gardes : la copie de l'extension est celle de l'app »). Dont audit-coherence, -traduction, -identite, -urssaf, -quoi-de-neuf,
-tdz, -variables, -fonctions-api, -extension-zip, `audit-parcours-production.mjs` : verts.

Bancs (35) — verts : argent-natif 608, tableaux-largeur 100, onglets-menu 108, annonces-dressing 80, ventes-lisibles 47, journee-stats 118,
argent-vintex 46, relais-prevision 52, arrivee-scan 236, commandes-selection 52, connexion-extension 52, favoris-envoi 68,
favoris-perso 54, grand-panneau 438, grand-panneau-sites 112, interface-vinted 24, journee-perso, lbc-interface 30, natif-ventes 58,
onglet-travail-voile 24, panneau-favoris-tableau 134, panneau-telephone 179, popup 85, relier-achats 68, ventes-tableau 180,
vestiaire-messages-comptes 22, ventes-retours 102, copie-ecran 20, drapeaux-justes 66, stats-pilotage-place 6.
Rouges À L'IDENTIQUE sur main : app-tableaux (`/brands/*.svg` non résolu à la construction), argent-mois (16), panneau-persistant (2).

`couches-chargement` (le banc de fluidite) — **avec le design par défaut** (`BANC_DESIGN_V2=defaut`, Ma journée · Ventes · Annonces) :
journee · ventes · annonces : origin/main **12 rouges**, cette branche **4** puis 0 sur l'ordinateur après le défilement.
Complet (6 écrans × ordi + tel, machine calme, fin de session) : origin/main **36 rouges** (9 images superposées, 21
clignotements) ; cette branche **12** (0 superposée, 2 clignotements). `integration-ext-5418` seule (achats, ventes, journée,
argent) : 23. ⚠️ Le banc passe par l'ANCIEN DOM sans `BANC_DESIGN_V2=defaut` (les mesures du récit de fluidite le sont).

## 5. Ce qui reste

Rouges de `couches-chargement` (design par défaut) qui restent ici :
- **Achats à l'ouverture et au 1er toucher** (390 : CLS 0,68 et une zone vide ~2 s ; 1512 : 0,40) — la section « À retirer »
  rétrécit de ~530 px quand les achats arrivent (`details.vrm-repli`, `vrm-achats-retirer-repli`). **Déjà sur
  `integration-ext-5418`** (relais-prevision : CLS 0,82 et 6 s de vide au 1er toucher) ; un peu moins ici. À reprendre dans
  src/natif/RetraitsPoints.jsx / la carte « En route · point pas encore dit » (réserver sa place, ne pas déplier puis replier).
- **Argent à l'ouverture** (1512 : 0,47, 390 : 0,058) — `vrm-argent-partie` et le Mois ; 0,44 / 0,19 sur integration-ext-5418.
- **Ventes au téléphone, ouverture** : CLS 0,16–0,18 — des rangées entières changent (−126 / +136 px) quand les ventes arrivent
  (l'ordre et le contenu des rangées bougent, pas le pied « Relier » : essayé, réserver le pied ne change rien). Nouveau (main a
  0,26 au 1er toucher à la place).
- **Ma journée au téléphone** : CLS 0,050–0,053 (limite 0,05) — une barre d'outils de 44 px (`n-ecran-outils`) retirée au-dessus
  des cartes ~3 s après.
- Messages au 2ᵉ retour : 0,063 (identique sur main).

Extension (relue par d'autres, pas modifiée ici) : `aimesVcHtml` (vrm-badge.js:3198) lit `d.articles.length` sans garde — une
réponse `{ ok: true }` sans `articles` ferait planter le panneau Vestiaire · Favoris ; le fond réel la donne toujours.
À garder en tête pour la 5.420.

Statistiques garde sous Pilotage toutes les anciennes cartes (le récit de journee-stats le dit) : deux choix de période à
l'écran (7/30/90 j, puis Semaine/Mois/Année des anciennes cartes).

Geste de Julien : installer l'extension **5.419.0** (Chrome : remplacer le dossier puis ⟳ ; Orion : `VRM-Orion-dossier.zip`).
