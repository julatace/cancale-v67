# 19 nov. — « que l'app ne bug plus et que ça charge plus vite entre les onglets »

Branche `claude/vite-et-sans-bug` (partie de `ed9399cb`). Julien, mot pour mot : « la chose la plus importante est que
l'app ne bug plus et que ça charge plus vite entre les onglets, c'est beaucoup trop lent pour l'instant ».

## 1. Comment c'est mesuré (et comment refaire la mesure après la suppression des couches de design)

La machine des bancs est partagée par une dizaine d'agents : l'horloge murale varie du simple au double sur un même
build. On juge donc sur le **temps de fil** du fil principal pris dans une trace Chrome (`tdur`, le temps où le fil
travaille, ralentissement ×4 compris = « un iPhone de milieu de gamme »), sa décomposition (script · style · mise en
page · peinture) et des **comptes** qui ne dépendent pas de la charge (éléments restylés, rendus de `Comptabilite`,
nœuds, lectures).

```
node scripts/bancs/onglets-trace.cjs <dist>                     # 34 passages, 390 tactile ×4, 5 000 ventes, 1 000 annonces
RENDUS=1 JSON=a.json node scripts/bancs/onglets-trace.cjs <dist> # + rendus de Comptabilite, relevé complet
INVALIDATIONS=1 SUITE=liste:journee,achats,journee …            # QUI demande chaque recalcul (pile JS), le plus gros
SELECTEURS=1 …                                                   # coût par sélecteur (Chrome « selector stats »)
```

**Pour l'agent qui supprime les couches de design** (`claude/lisible-partout`) : lancer le banc sur le build d'avant
et sur le build d'après, en ALTERNANT (avant, après, avant, après — 4 min par passe), puis comparer par passage
`trace.cpu.utile.style` (ms de recalcul de style jusqu'à l'écran utile) et `trace.compte.elements` (éléments
restylés). Les médianes « 2e passage » du résumé suffisent pour une décision ; la dispersion d'un même build entre deux
passes est donnée ci-dessous (colonnes « passe 1 / 2 »). Compter les règles et `:has` : `node scripts/alleger-has.cjs`
(liste chiffrée, rien n'est écrit).

## 2. Ce qui coûtait (mesuré sur `ed9399cb`)

1. **Les `:has()` portés par une racine** (html, body, #root, `.vrm-app-shell`, `.vrm-main`) : 197 sur 602. Blink
   marque ces ancres « dépend d'un `:has` » ; toute modification du DOM qui touche un mot d'un argument de `:has`
   (une classe, un attribut, une balise) invalide le SOUS-ARBRE ENTIER de l'ancre : tout le document restylé
   (13 000 éléments sur Achats) au toucher d'un onglet comme à la moindre insertion.
2. **Une lecture de `scrollTop` au mauvais moment** (`MemoireDefilement`, src/App.jsx) : le nettoyage de son effet
   lisait la position au MILIEU du rendu validé du changement d'onglet, document fraîchement invalidé, écran quitté
   encore dans la page ⇒ recalcul FORCÉ de tout (13 186 éléments en quittant Achats, ~6 000 en quittant Annonces).
3. **Remettre Achats dans la page** (écran gardé, DOM détaché puis rattaché) : 7 983 nœuds dont le style et la mise en
   page sont refaits en entier, ~1,2–1,4 s de mise en page au ×4. Pas corrigé (voir §5).

## 3. Ce qui est livré

- **Défilement** : la position se SUIT (lue à chaque défilement), elle ne se relit plus en partant. Mêmes règles, mêmes
  valeurs. Quitter Achats : 2 238 → 851 ms (vers Ma journée), 2 505 → 1 054 (vers Ventes), 3 185 → 1 294 (vers Argent).
- **Drapeaux de racine** (`src/drapeauxRacine.js`, `src/drapeauxRacine.table.js`, `scripts/alleger-has.cjs`) : chaque
  `:has(ARG)` de racine devient l'attribut `data-vrm-<mot>` de l'ancre, posé par le JS avec `element.matches(':has(ARG)')`
  (la même réponse que la règle d'avant), tenu à jour par un observateur qui ne réagit qu'aux classes/attributs nommés.
  Spécificité identique (`--prouve`, 13 cas dont nié et balise seule). Appliqué aux **184 règles des feuilles libres** ;
  les **13 des feuilles réservées** (studio-verre, design-v2, interface/vrm-interface, fiche-d) attendent l'intégration :
  `node scripts/alleger-has.cjs --ecrire --tout` (la table garde déjà leurs mots). ⚠️ Tant qu'il en reste UNE, les
  ancres restent marquées : le gain de style n'arrive qu'après ce passage.
- `AttenteEcran` rafraîchit les drapeaux avant que l'écran se mesure (aucun changement de ce qui s'affiche ni de quand :
  le cache affiché d'abord, l'instantané et les squelettes sont intacts — pour l'agent de `claude/capacite-3000`).
- Bancs : `onglets-trace` (mesure), `parcours-erreurs` (tous les écrans, trois bases), `extension-detectee`.

## 3 bis. Preuves que rien ne change à l'écran ni dans les chiffres

- **Au pixel** (`node scripts/alleger-has.cjs --verifier <avant> <après>`, 10 écrans × 390 et 1512, base de volume) :
  18 captures sur 20 identiques ; Annonces différait — mais le MÊME build comparé à lui-même diffère aussi sur Annonces
  (A/A et B/B rouges, A/B vert sur la même passe) : écran instable dans ce banc, pas un effet de la réécriture. Le
  bandeau « les photos de Vinted ne s'affichent pas » (bruit connu) est retiré des deux captures.
- **Drapeaux jamais en retard** (`scripts/bancs/drapeaux-justes.cjs`) : à chaque écran (7 chargements, 13 changements
  dans la page, 60 ms après le toucher puis au calme, 390 et 1512), chaque `data-vrm-<mot>` posé = la réponse en direct
  de `:has()` : 66 vérifications, 0 faux. Mutation `MUTATION=sourd` (observateur coupé) : 327 faux, rouge.
- **Chiffres** (`chiffres-volume`, main ⇄ branche, deux relevés de chaque) : tout ce qui est publié est identique
  (`vrm_num_doublons`, `vrm_colis_aposter`, `vrm_stats_ventes`, `vrm_benefice_jours`, `vinted_nums_physiques`), aucune
  erreur. Deux écarts, stables d'un relevé à l'autre et SANS valeur changée : Argent, l'ordre de deux attributs
  identiques (un attribut posé après coup) ; Ventes, un « 30 € » de moins dans le texte rendu — le prix d'une carte de
  colis caché par la règle d'origine `.vrm-main:has(.vrm-fu-colis) … .vrm-colis-prix {display:none}` : chargé
  directement, main et la branche montrent tous deux 7 prix sur 14 (sonde) ; dans la suite du banc, main en montrait un
  de plus le temps du chargement. Totaux à l'écran identiques (5 174 €, 8 470 €).
- Bancs `source-unique` (24 verts), `versements-course` (26 verts), `temps-reel` (38 verts) ; audits `identite`, `tdz`,
  `variables`, `traduction` verts. `alleger-has --prouve` : 13 cas, spécificité identique.

## 4. Avant / après, par passage (temps de fil ×4 jusqu'au contenu utile, ms)

« main » = `ed9399cb` · « défilement seul » = la correction du défilement · « tout réécrit » = + les 197 `:has` de
racine réécrits (ce que donnera l'intégration), deux passes du même build pour la dispersion.

| # | passage | main | défilement seul | tout réécrit (passe 1 / 2) | éléments restylés main → tout |
|---|---|---|---|---|---|
| 0 | 1er Ma journée → Annonces (remonté) | 3539 | 3626 | 4195 / 3496 | 15362 → 12962 / 12958 |
| 1 | 1er Annonces → Achats (remonté) | 7493 | 6538 | 6526 / 5973 | 24738 → 18178 / 18234 |
| 2 | 1er Achats → Ventes (remonté) | 3728 | 2269 | 1990 / 2382 | 22853 → 8791 / 4445 |
| 3 | 1er Ventes → Argent (remonté) | 775 | 833 | 478 / 534 | 5132 → 2608 / 2813 |
| 4 | 1er Argent → Messages (remonté) | 1870 | 1968 | 1779 / 1590 | 5259 → 3080 / 3050 |
| 5 | 1er Messages → Stock (remonté) | 246 | 235 | 230 / 229 | 6697 → 5430 / 5453 |
| 6 | 1er Stock → Paramètres (remonté) | 430 | 438 | 257 / 404 | 7787 → 2488 / 5098 |
| 7 | 2e Paramètres → Ma journée (remonté) | 1841 | 1616 | 1488 / 1478 | 5830 → 4603 / 4590 |
| 8 | 2e Ma journée → Annonces (remonté) | 1487 | 1854 | 912 / 1054 | 8695 → 6561 / 6559 |
| 9 | 2e Annonces → Ma journée (gardé) | 1716 | 1673 | 660 / 776 | 7615 → 1367 / 1285 |
| 10 | 2e Ma journée → Achats (gardé) | 2535 | 2667 | 2440 / 2196 | 4248 → 3403 / 3388 |
| 11 | 2e Achats → Ma journée (gardé) | 2238 | 851 | 697 / 775 | 14557 → 1455 / 1349 |
| 12 | 2e Ma journée → Ventes (gardé) | 1086 | 969 | 983 / 1109 | 3135 → 2249 / 2284 |
| 13 | 2e Ventes → Ma journée (gardé) | 1053 | 951 | 454 / 675 | 3125 → 1398 / 1236 |
| 14 | 2e Ma journée → Argent (remonté) | 1302 | 1117 | 674 / 829 | 3536 → 1822 / 1846 |
| 15 | 2e Argent → Annonces (remonté) | 1219 | 1177 | 1000 / 1191 | 7741 → 6581 / 6584 |
| 16 | 2e Annonces → Achats (gardé) | 3821 | 3570 | 2555 / 2494 | 9350 → 3267 / 3274 |
| 17 | 2e Achats → Annonces (remonté) | 4223 | 2766 | 1132 / 1208 | 33425 → 6566 / 6601 |
| 18 | 2e Annonces → Ventes (gardé) | 1885 | 3027 | 1050 / 1196 | 8437 → 2272 / 2308 |
| 19 | 2e Ventes → Annonces (remonté) | 1477 | 1643 | 1113 / 924 | 10287 → 6593 / 6576 |
| 20 | 2e Annonces → Argent (remonté) | 2269 | 2177 | 982 / 972 | 8932 → 2216 / 1932 |
| 21 | 2e Argent → Achats (gardé) | 2348 | 2529 | 2498 / 2391 | 3624 → 3267 / 3291 |
| 22 | 2e Achats → Ventes (gardé) | 2505 | 1054 | 1588 / 1199 | 15444 → 2251 / 2327 |
| 23 | 2e Ventes → Achats (gardé) | 2209 | 2714 | 2476 / 2382 | 5238 → 3462 / 3616 |
| 24 | 2e Achats → Argent (remonté) | 3185 | 1294 | 1211 / 1305 | 16358 → 2045 / 2066 |
| 25 | 2e Argent → Ventes (gardé) | 905 | 837 | 911 / 1071 | 2472 → 2269 / 2306 |
| 26 | 2e Ventes → Argent (remonté) | 1314 | 940 | 842 / 961 | 5236 → 2256 / 2140 |
| 27 | 2e Argent → Ma journée (gardé) | 789 | 684 | 706 / 684 | 1571 → 1488 / 1309 |
| 28 | 2e Ma journée → Messages (remonté) | 2284 | 1414 | 822 / 894 | 4057 → 2699 / 5238 |
| 29 | 2e Messages → Ma journée (gardé) | 1174 | 1437 | 565 / 1412 | 1306 → 1283 / 1100 |
| 30 | 2e Ma journée → Stock (remonté) | 446 | 309 | 252 / 254 | 4821 → 5449 / 4310 |
| 31 | 2e Stock → Ma journée (gardé) | 1126 | 844 | 588 / 775 | 3413 → 1496 / 1610 |
| 32 | 2e Ma journée → Paramètres (remonté) | 720 | 515 | 552 / 510 | 4366 → 2770 / 2770 |
| 33 | 2e Paramètres → Ma journée (gardé) | 543 | 631 | 490 / 537 | 1682 → 1292 / 1337 |

Médianes des 27 seconds passages : **main 1 487 ms** (style 507, 5 236 éléments restylés) · défilement seul 1 294 ·
**tout réécrit 912 / 1 054 ms** (style 139 / 157, 2 269 / 2 308 éléments restylés). Rendus de `Comptabilite` : médiane
5 → 3 / 5 (inchangés à la dispersion près). Premier passage : Annonces → Achats reste à ~6 s (montage d'Achats).

## 5. Ce qui reste (le plus gros d'abord)

1. **Revenir sur Achats** : 2,2–2,5 s ×4, dont 1,2–1,4 s de MISE EN PAGE de 7 983 nœuds rattachés. Deux pistes,
   mesurables avec le même banc : (a) moins de nœuds dans Achats (liste sous la ligne de flottaison en
   `content-visibility:auto`, ou paginée) — corps d'écran, hors de mon périmètre ; (b) garder l'écran DANS la page en
   `content-visibility:hidden` (Chrome garde alors style et mise en page) au lieu de le détacher — possible seulement
   une fois les 13 `:has` réservés réécrits, ET en excluant les écrans cachés de l'évaluation des drapeaux, ET en
   vérifiant chaque `document.querySelector` de l'app (aujourd'hui un écran caché est invisible aux sélecteurs : c'est
   une promesse du 8 nov.).
2. **Budget de démarrage** : 1 983 Ko pour 1 982 (+0,5 Ko : +1,2 Ko du correctif « extension pas détectée », +0,55 Ko
   des drapeaux, −0,03 Ko de CSS). À arbitrer à l'intégration.
3. **Supprimer les couches de design** : décidé (« VRM natif ») et confié à `claude/lisible-partout` ; méthode au §1.
   Ce que montre la colonne « tout réécrit » est la part du style due aux `:has` de racine ; la suppression des couches
   retire en plus des règles (≈ 10 900 aujourd'hui) — à mesurer par lui avec le même banc.

## 6. Bugs réels

- **Plantages de prod (7 jours, lecture seule, `app_data` `plantage_*`)** : 3 types, tous du 12 au 16 nov., aucun
  depuis. « CSP connect-src ← p.vintedgo.com / pickup-services.com » (Achats, iOS Safari) : la copie locale d'un QR
  d'un autre site — **déjà corrigé sur main** (`qrLisibleParLaPage`). « Cannot read properties of undefined (reading
  'default') » (Ma journée › modération, Mac Chrome, version du 12 nov.) : un morceau périmé — **déjà corrigé sur main**
  (`lazySur`, 15 nov.).
- **Erreurs serveur Vercel (7 jours)** : aucune (`get_runtime_errors`), aucune dans la dernière heure des journaux.
- **« Extension à installer » alors qu'elle est là** (photo du Mac de Julien) : corrigé, `0deda8fb3` (déjà fusionné).
- **Parcours de tous les écrans** (`parcours-erreurs`, 44 écrans + leurs segments, 390 et 1512) : base de volume et
  base vide **sans aucun relevé** (ni erreur, ni promesse rejetée, ni écran blanc, ni requête en boucle) ; base en
  panne (lectures en 503) : **un bug, toujours sur `origin/main`** — l'écran Comptes (Réglages → Comptes, `vintedaccounts`)
  tombait sur « Cet écran a un souci » : `GroupeComptes` disait bien « — Réessayer » pour une liste « pas su » (`null`),
  mais `ComptesAutresSites` calculait `liste.length` quand même. En vrai : une lecture de Vestiaire, Leboncoin ou eBay
  ratée (réseau, base lente) faisait tomber tout l'écran des comptes. Corrigé (src/ecrans/Reglages.jsx) ; contrôle :
  `BASES=panne ECRANS=vintedaccounts node scripts/bancs/parcours-erreurs.cjs <dist>` — rouge sur le build d'avant
  (garde-fou affiché, 390 et 1512 ; la « mutation » est le code d'avant, une seule expression), vert après (panne et vide,
  Comptes, Paramètres, Ma journée : 0 relevé).
