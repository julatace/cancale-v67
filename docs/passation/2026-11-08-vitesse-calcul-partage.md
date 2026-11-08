# 8 nov. 2026 — Changer d'onglet sans tout recalculer, en fondu (Julien : « tout doit aller beaucoup plus vite », « des petites animations entre chaque onglet, vraiment fluide, pas robotique »)

Branche `claude/vitesse-calcul-partage` (depuis `claude/amazing-lovelace-xd7obl`). Rien de
métier, aucune règle de chiffre touchée : ce qui change, c'est QUAND un écran se calcule.

## 1. Mesure d'abord (avant)

Outil nouveau : `node scripts/bancs/_mesure-onglets.cjs <dist> [port]` — 390 px tactile, 4G,
CPU ×4, base inventée au poids réel (`_base-volume`, `volumeReel`, `qr`), la méthode de
`2026-11-07-vitesse.md`. Ouvre Ma journée puis touche la barre : Colis, Ventes, Annonces,
Journée, deux tours (le 2e revient sur des écrans DÉJÀ VUS). Par toucher : `affiche_ms`
(première image où l'écran visé est posé), squelettes, tâches longues, lectures, sauvegardes.
`PROFIL=` (profil CPU par fonction), `TRACE=` (trace Chrome du dernier toucher),
`REDUIT=1` (mouvement réduit : le calcul seul), `DEBUG_GARDE=1`, `EVAL=`.
⚠️ Conteneur partagé (charge 5 à 12 sur 4 cœurs pendant tout le chantier, d'autres agents
lançaient des bancs) : les temps varient du simple au double d'un passage à l'autre ; les
LECTURES et les traces (ce qui se recalcule, combien d'éléments) sont stables.

Avant (branche de départ), retour sur un écran déjà vu, CPU ×4 :
- tout l'écran est REMONTÉ (`AttenteEcran key={tab}`, `Comptabilite key=…`) : ses ~150
  `useMemo` repartent de zéro, le DOM est refait, **13 à 45 lectures** repartent ;
- tâches longues : Colis 2,3–4,2 s, Annonces 3,7–5,8 s, Ma journée 2,9–4,0 s ;
- **chaque changement d'onglet** posait une classe sur `<main>` (`vrm-ecran-anime`, après
  une lecture forcée `offsetWidth`) : la trace montre un recalcul de style de TOUT l'écran
  (5 317 éléments, 0,8–1,1 s au téléphone), dû aux règles `.vrm-main:has(…)`.

Les 10 calculs les plus chers de `Comptabilite` (profil, ouverture de Colis puis de Ma
journée, temps inclusif à CPU ×4) : `pickupUnion` (0,6–0,8 s, dont `achatDuColis` 0,45–0,64 s
et `commandeDuColis` 0,42–0,59 s), la section « journée » du rendu (~0,5 s), `cartesColis`
(0,23–0,35 s), la liste des colis par point (`(anonyme):63294`, ~0,55 s), `propositionsPrix`,
`effEntry`/`identiteAnnonce` (mémorisés par calcul), `jours14`, `etatColisVinted`,
`etatRetrait`, `UneLigne` (mesure, 0,2–0,5 s). Tous recalculés à chaque retour.

## 2. Ce qui a changé

### Les écrans gardés — `src/ecransGardes.jsx`
Ma journée, Colis et Ventes déjà vues restent MONTÉES et reviennent telles quelles (pas
Annonces, voir §3) :
- **gelées** : un écran caché est suspendu (React.Suspense, une promesse jamais résolue) —
  React ne le rend plus, ne valide plus rien, ses effets ne tournent plus. Donc **aucune
  publication** (`vrm_colis_aposter`, `widget_stats`…) ni écriture depuis un écran caché :
  les publieurs restent uniques, ceux de l'écran montré. Ses mises à jour d'état attendent
  et s'appliquent à son retour ;
- **hors de la page** : son DOM est détaché du document (un portail vers un conteneur qu'on
  retire). ⚠️ Essayé et écarté : le garder dans la page caché (`content-visibility: hidden`)
  — ~200 règles `.vrm-main:has(.vrm-fu-colis) …`, `.vrm-app-shell:has(.vrm-fu-journee) …`
  s'appliqueraient alors aux AUTRES écrans, et le retour n'était pas plus rapide (mesuré) ;
- **réutilisé seulement au toucher de la barre** (`noterNavigationSimple`, BottomBar,
  SideBar/« Plus » pour une entrée sans demande). Un lien, une notification, une carte de
  Ma journée posent souvent une demande lue AU MONTAGE : l'écran est remonté, comme avant ;
- **jamais périmé** : une sauvegarde d'une clé qui compte (toutes sauf trois préférences
  d'affichage), une relecture du nuage, un signal de l'extension (`vrm:ext` maj), des
  transporteurs, d'eBay, des suivis, un retour au premier plan après 20 s, ou 10 min
  caché ⇒ l'écran est remonté à son retour, comme avant ;
- **une feuille ouverte** (portail vers `<body>`, qu'un écran suspendu ne cache pas —
  essayé) ⇒ l'écran n'est pas gardé, il se démonte avec elle ;
- **mémoire bornée** : 4 écrans au plus (3 gardables aujourd'hui) ; changement de compte VRM ⇒ tout est oublié ;
- ses écoutes qui LISENT se taisent quand il est caché (`useVivant()`/`estCache`, dans
  `Comptabilite` et `useVentesVestiaireBrut`) ; caché, il ne PREND pas une demande
  (`vrm:vue`, `vrm:emballer`) destinée à l'écran qui s'ouvre ; à son retour il refait ce
  qu'il faisait en s'ouvrant (`surRetour` : demander les ventes à l'extension, sonder l'âge
  des ventes captées — un scalaire par compte) ;
- le même élément rendu par la coque (équivalence `egalRendu` : types, valeurs, mêmes
  références de données, fonctions au même texte) n'est pas redescendu. ⚠️ Une fonction
  passée à ces écrans par la coque ne doit capturer que des poseurs d'état (ou lire l'état
  par `prev =>`) ; une valeur capturée doit AUSSI passer en prop ;
- la section de l'écran visé est posée avant qu'il revienne (`subPose`, AppCoeur) : jamais
  rendu une image avec la section de l'écran d'avant (qui aurait démonté sa liste).

### Le passage d'un onglet à l'autre — `src/passageOnglet.js`, `src/styles-ecrans-gardes.css`
- plus de classe sur `<main>` : le nouvel écran arrive en fondu par Web Animations (opacité
  seule, 200 ms, `cubic-bezier(.22,1,.36,1)` ; à l'ordinateur 0,9 → 1 en 180 ms comme avant),
  posé avant l'affichage (plus d'image pleine puis vide), aucun `transform` sur `<main>` ;
- **la pastille** de l'onglet choisi (capsule neutre, l'encre à 7 % — l'accent reste à
  l'icône, §7) **glisse** vers l'onglet touché (`transform`, 280 ms, courbe iOS
  `cubic-bezier(.32,.72,0,1)`, une transition : un second toucher la reprend d'où elle est).
  Les places des onglets sont relevées quand la barre change de taille, jamais au toucher ;
- mouvement réduit : ni fondu, la pastille saute ;
- ⚠️ **essayé et retiré : le fondu enchaîné par View Transitions.** Trace Chrome du retour
  sur Colis : il ajoute un SECOND recalcul de style de toute la page à la fin du fondu
  (5 325 éléments, ~0,7 s à CPU ×4), et l'affichage passait de ~1,1 s à 1,3–2,5 s. Plus
  lent que ce qu'il embellit. Ne pas le remettre sans remesurer.

### Deux coûts retirés au passage
- `UneLigne` ne re-pose pas une ligne au même texte et à la même largeur (ses effets sont
  rebranchés au retour d'un écran gardé : la re-poser refaisait la mise en page) ;
- `rangeesDefilantes` ne mesure jamais une rangée d'un écran caché.

## 3. Mesures (après)

`_mesure-onglets.cjs`, 390 px, 4G, CPU ×4, trois passages ENTRELACÉS avant/après (avant =
`2fb6058f`, la branche de départ), médiane ; charge du conteneur 9 à 15 (les temps
absolus sont gonflés, l'écart avant/après tient d'un passage à l'autre).

Retour sur un écran déjà vu (2e tour) :
| écran | affiché (avant → après) | tâches longues (avant → après) | lectures (avant → après) |
|---|---|---|---|
| Colis | 1,6 s → 1,6 s | 3,1 s → **1,4 s** | 13 → **1** (la sonde) |
| Ventes | 0,85 s → **0,54 s** | 1,3 s → **0,39 s** | 2 → **0** |
| Ma journée | 1,2 s → **0,9 s** | 2,3 s → **0,7 s** | 20 (jusqu'à 45) → **1–4** |
| Annonces | 1,0 s → 1,7 s *(gardée)* | 2,8 s → 1,9 s | 13 → 0 |

⇒ **Annonces n'est PAS gardée** : sa grille rattachée d'un bloc (style et mise en page de
toutes les fiches, une seule tâche de 1,4–1,7 s) s'affichait ~0,6 s plus tard qu'un écran
remonté qui dessine d'abord le haut. Elle reste remontée comme avant (elle gagne seulement
la classe retirée de `<main>`).

Premier passage (1er tour, l'écran se calcule) : Colis 6,3 → 5,2 s, Ventes 1,9 → 1,2 s,
Annonces 4,1 → 1,9 s, Ma journée 1,6 → 1,2 s (la classe et la lecture forcée sur `<main>`
retirées, `UneLigne` et les rangées qui ne remesurent plus rien de caché). Démarrage
inchangé (~8 s ; c'est le calcul de `Comptabilite`, l'autre chantier).

En mouvement réduit (le calcul seul, sans le fondu ; charge 5–8) : retour Colis 1,16 →
1,11 s affiché, tâches longues 2,5 → **1,05 s** ; Ventes 1,4 → **0,44 s** ; Ma journée
1,4 → **0,74 s** (tâches 2,9 → 0,6 s).

Ce que coûte encore un retour sur Colis (trace) : une tâche de ~0,9–1,3 s = le recalcul de
style de l'écran rattaché (5 318 éléments, ~0,4–0,7 s : le DOM rattaché + les règles
`.vrm-main:has(.vrm-fu-colis)` qui basculent) + la mise en page (~0,1 s) + 1–2 rendus de
`Comptabilite` (~0,3 s : ses effets de mise en page sont rebranchés au retour et re-posent
des états). Avant, ce même recalcul y était AUSSI, plus 2 s de calcul et 13 lectures ensuite.

Au banc `ecrans-gardes` (prod, sans bridage CPU) : retour posé en 110–260 ms (premier
passage 260–660 ms), même nœud, 0 lecture, 0 montage.

## 4. Preuves
- `scripts/bancs/ecrans-gardes.cjs` (nouveau) : au retour par la barre, le MÊME nœud,
  aucun squelette, aucune lecture (hors la sonde), `Comptabilite` pas remonté ; caché :
  aucun rendu de `Comptabilite` (crochet React posé avant l'app : ses états changent
  d'objet), aucune publication, aucune lecture que ferait l'écran montré ; un signal ⇒
  remonté ; un lien ⇒ remonté ; un seul écran dans la page ; fondu sur `<main>` ; mouvement
  réduit (ni fondu, ni glissé). **Vert** ici ; **14 rouges** sur la branche de départ
  `2fb6058f` ; rouge sur les mutations (`scripts/bancs/ecrans-gardes.cjs`, faites sur le
  code du commit `ff744098`) : écoutes de `Comptabilite` non tues ⇒ lectures en double
  (`panel_colis_relais`, `colis_suivi_*`…) ; gel retiré ⇒ rendus de `Comptabilite` cachés
  (annonces, bordereaux, journée, à chaque signal) ; garde retirée ⇒ 13 rouges (remontage,
  lectures, montages) ; péremption sauvegarde/extension retirée ⇒ rouge (contrôle 2).
  ⚠️ La péremption par les AUTRES signaux (transporteurs, suivis…) garde le contrôle 3
  vert même sans celle-là : une mutation complète de `perimer` reste à faire.
- Bancs (un à la fois, build de la branche ; chaque rouge relancé sur la branche de
  départ `2fb6058f` ou sa base) : verts `iphone-reprise`, `fluidite`, `garde-ecrans`
  (rouge P4 au premier passage : un écran tombé était gardé tombé — corrigé : un écran dont
  le garde-fou est affiché n'est pas gardé), `journee-chiffres`, `journee-widgets`,
  `colis-envoi`, `ecrans-gardes`. Rouges IDENTIQUES au départ (même nombre, mêmes lignes) :
  `chiffres-coherents` (2, widget 503 sans clé de service — corrigé sur la base plus récente
  par `b789fa48`), `journee-coherence` (1, E9 « Voir » ouvre le Stock sur le N°42),
  `journee-mieux` (25), `journee-premium` (1), `journee-photos` (3), `colis` (4),
  `colis-colonnes` (3), `colis-tous-sites` (12, widget 503), `ventes-colis-premium` (4) ;
  `chargement` : 2 CLS sur Stock/garage (0,034 / 0,02 ; Stock n'est pas un écran gardé,
  déjà vu passager sur main le 8 nov.).
- Audits : `npm run build`, `audit-variables`, `audit-tdz`, `audit-identite`,
  `audit-statuts`, `audit-coherence` verts.
- Captures regardées (390, clair et sombre) : la barre avec sa pastille sous Colis puis
  sous Journée, Ma journée et Colis au retour identiques à leur premier passage.

## 5. Ce qui reste
- Le retour sur Colis/Annonces paie encore le recalcul de style de l'écran rattaché
  (~5 300 éléments, les règles `:has(.vrm-fu-colis)` basculent) et 1–2 rendus de
  `Comptabilite` (ses effets de mise en page rebranchés re-posent des états). Pistes :
  remplacer les règles `.vrm-main:has(.vrm-fu-colis)` par un attribut posé par l'écran ;
  rendre ces effets de mise en page idempotents.
- Le PREMIER passage sur un écran n'est pas plus rapide (sauf le recalcul de style de
  `<main>` retiré) : c'est le découpage de `Comptabilite` (passation générale §2.1).
- Ma journée → carte → Colis passe par un lien : remonté (demande lue au montage). Rendre
  ces demandes lisibles au retour (un évènement) permettrait de garder l'écran aussi là.
