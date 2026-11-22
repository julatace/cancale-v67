# 22 nov. 2026 — Après la finale (app) : Statistiques d'un compte neuf, zéro saut à l'ouverture, reprendre sur l'autre appareil, annonces plus vues

Branche `claude/apres-finale-app`, partie de `claude/integration-finale` (vrais merges, dernier : `3f4dceeca`). Choix de Julien
du 22 nov. n° 1, 3, 23 et 27 (côté app). Aucune modification de `vinted-sync-extension/` (une autre session fait la 5.435).

## 1. Statistiques pour un nouveau compte — `src/statsNouveau.js`, `StatsNouveau` (src/App.jsx)

Avant : un compte VRM sans compte relié voyait l'ancien « Bienvenue » (logo, guide de démarrage, « Déjà des données ? »)
AU-DESSUS de toutes les cartes de Statistiques, remplies de « — » et de 0. Maintenant UN état à la fois, par la règle
`etatStatsNouveau({ comptesLus, baseKO, nComptes, ventes })` :
- `attente` (comptes pas encore lus, aucune vente connue) ⇒ `Attente` natif (faits) ;
- `pasSu` (base injoignable, aucune vente connue) ⇒ `Vide` « Je n'ai pas pu lire tes comptes. » + « Réessayer » — jamais « vide » ;
- `vide` (comptes lus, aucun compte, aucune vente d'AUCUN site) ⇒ `Vide` : icône graphique, « Tes statistiques arriveront avec
  tes premières ventes. », « Relier un compte » ;
- `null` ⇒ les statistiques. Une vente Leboncoin, eBay ou Vestiaire suffit (CLAUDE.md §2.11 : un vendeur Leboncoin n'est pas « neuf »).
La tête (titre Argent et ses segments) reste celle de l'écran plein. `Onboarding` est retiré (plus rendu nulle part).

## 2. Zéro saut à l'ouverture (choix 3)

Mesuré au banc `couches-chargement` (BANC_DESIGN_V2=defaut, DEBUG=1, rafales de 100 ms REGARDÉES), causes trouvées :

| écran | ce qui sautait (avant) | cause | correction |
|---|---|---|---|
| Ventes, téléphone | rangées −126 / +136 px (CLS 0,15) | la copie instantanée peinte SANS `ventes-lisibles.css` (feuille du morceau Ventes) : case seule sur sa ligne, « Prix d'achat » pleine largeur, puis la mise en page à l'arrivée du morceau | la copie retient les feuilles `/assets/*.css` de la page (`feuillesDocument`) et n'est peinte qu'avec elles (`chargerFeuillesCopie` : avant l'app dans `peindreCopie`, et dans l'app avant qu'un toucher ne la montre) ; une feuille d'un autre build (404) est ignorée |
| Argent, téléphone | « Reçu en novembre » en texte brut puis mis en page (0,058) | idem : `argent.css` vient avec le morceau Compta | idem |
| Ventes, ordinateur | lignes du tableau +8 px (0,023) | idem (`ventes-lisibles.css`) | idem |
| Achats (390 et 1512) | la section « À retirer » repoussée / remplacée 7–10 s après (0,10 à 0,68 ; zone vide ~2 s) | les cartes par point (`RetraitsPoints`) et « À régler » (`ARegler`) sont des morceaux à la demande qui ne partaient qu'à l'arrivée des données — sur un téléphone ×4 occupé à calculer, 7 à 10 s | ces morceaux partent DÈS l'ouverture de l'onglet (Achats, Ventes, Annonces) ; « À régler » ajouté aux préchargements au repos |
| Ventes, ordinateur, toucher | le tableau repoussé de 120 px | « À régler » arrivé tard au-dessus | idem |
| Ma journée (390 et 1512) | « Toutes les statistiques » et « Personnaliser » poussés hors de la fenêtre (0,05) ; colonnes réordonnées (0,04) | ces deux rangées étaient posées AVANT les cartes, qui arrivaient ensuite au-dessus d'elles | posées avec les cartes (`pret`) |
| Messages, téléphone | la liste remonte de 52 px (0,041 à 0,063) | « À relier · 1 050 » posé sur une lecture partielle (les paires des conversations pas encore relues), puis retiré | les questions « même fil ? » attendent toutes les sources ET les paires (`pairesLues`) |

Le banc est resserré : **CLS < 0,02** par visite (`SEUIL_CLS`, 0,05 avant), et chaque source de décalage est décrite avec sa
position avant / après et son bloc (`{data-v2-bloc}`), pour lire la cause sans rafale.

Résultats : voir §5.

## 2 bis. « Je veux que tout soit beaucoup plus fluide » (Julien, ajout du 22 nov.) — banc `fluidite-generale`

Nouveau banc `scripts/bancs/fluidite-generale.cjs` (iPhone simulé 390 × 844 densité 3, tactile, CPU ×4, 4G pour les fichiers ET
la base ; ordinateur 1512) : L lectures répétées à l'ouverture de Ma journée ; I réponse au toucher (du doigt posé à l'image
suivante) pour les onglets et les segments, et onglet → contenu utile ; D défilement d'Annonces et Ventes (images/s, tâches
longues). `PROFIL=1` : le profil CPU de chaque toucher d'onglet (fonctions les plus chères).

**(e) Lectures répétées — la cause, et elle est à la racine.** `src/lectureBornee.js` (21 nov., fluidité) est posée PAR-DESSUS
le partage des lectures (`src/lecturesPartagees.js`, 16 oct.) et donne un `signal` à CHAQUE lecture de la base ; or une
lecture à signal ne se partage jamais. Depuis le 21 nov., plus AUCUNE lecture n'était partagée (c'est le P2-4 de la chasse
aux bugs du 22 nov. : « intégration seulement, prod 0 » — la prod n'a pas encore la borne). Correction : la borne marque SON
signal (`vrmBorne: true`), le partage le reconnaît ; le signal d'un appelant reste jamais partagé. En plus, les lignes des
SITES (`ebay_listings|orders|programmees`, `vc_listings|ventes`, `lbc_ventes|accounts|listings|a_retirer`, `vinted_lbc_posted`)
reçoivent une lecture identique réussie pendant 15 s (`FENETRE_FOND_MS`, la fenêtre des passages de fond) — vidée par toute
écriture de la ligne et par tout signal de l'extension, comme avant.

| ouverture de Ma journée, 390 ×4 | base `3f4dceeca` | cette branche |
|---|---|---|
| lectures de la base | 223 | 155 |
| la même lecture (identique) | `lbc_ventes` (select=data) ×11, `ebay_listings` ×11, `vc_listings` ×10, `ebay_orders` ×9, `vinted_lbc_posted` ×8 | 3 au plus (lectures comparer-et-échanger `no-store`, relectures après écriture) |
| une ligne de site, toutes projections | `ebay_listings` ×13, `lbc_ventes` ×12, `ebay_orders` ×12, `vc_listings` ×12 | 3 au plus |

**Écrans gardés remontés à chaque passage.** Le banc nomme ce qui rend les écrans gardés (Ma journée, Ventes, Achats)
« périmés » (`window.__vrmPerimes`) : une trentaine de PUBLICATIONS réécrites à chaque passage (`vrm_colis_aposter`,
`vrm_stats_*`, `vrm_benefice_jours`, `vinted_nums_physiques`…) — chacune faisait remonter les écrans gardés et tout recalculer
(2 à 5 s au téléphone). Une valeur réécrite À L'IDENTIQUE ne périme plus rien (`vrm:save` porte `inchange`). Une valeur qui
change vraiment fait toujours remonter (règle « jamais périmé » d'ecransGardes.jsx inchangée).

**Ce qui reste (mesuré, pas atteint) — I et D.** Sur cette machine partagée, les mesures de toucher varient d'un passage à
l'autre (un même onglet de 43 ms à 2,4 s) : le profil dit où part le temps — les `useMemo` de `Comptabilite`
(src/ecrans/Comptabilite.jsx, 3 à 6 s de calcul cumulé au retour sur un écran), `relaisPrevision`, `atelier` ; l'écran remonte
avec `key={tab}` sur `AttenteEcran` (src/App.jsx) et Achats met 5 à 9 s à redevenir « prêt » même données là. Défilement :
48 images/s avec des tâches de 200 ms (cible 60 / < 100 ms). Pistes chiffrées pour la suite : (1) les publications qui portent
une heure (`at`) changent à chaque passage et périment encore les écrans gardés — séparer l'heure de la valeur, ou lister ces
publications comme neutres en vérifiant que chaque lecteur écoute `vrm:save` ; (2) sortir de `Comptabilite` les mémos dont les
dépendances sont des objets recréés à chaque rendu de la coque ; (3) un profil React (sonde `COMMITS=1` d'iphone-rapide) par
onglet.

## 2 ter. Deuxième passe « beaucoup plus fluide » (même jour, demandes 1 à 3 du coordinateur)

**CLS.** Ventes 1512 (le tableau remontait de 320 px vers 9 s) : trois cartes d'attente du morceau « À relancer » posées
au-dessus du tableau, puis parties — `RelancesVentes` est désormais discret (rien pendant son chargement) et préchargé dès le
morceau de Comptabilite ; `RetoursVentes` préchargé à l'ouverture de l'onglet. Messages 390 : la ligne « Lecture… » garde son
texte (un squelette ici était compté comme un trou entre la copie et l'écran), la ligne « pas pu lire » ne se pose qu'après la
liste ⇒ 0,008. Ma journée 1512 : le fondu d'attente partait de l'opacité 0 (une image vide de ~100 ms au toucher) ⇒ part de
0,85. La copie retient aussi les drapeaux `data-vrm-*` de `<html>`/`<body>` (`poserDrapeauxCopie`). **Reste rouge : Argent à
l'ouverture à 1512, 0,054** (`vrm-argent-partie` +21 px et la tête +8 px ~1,3 s après) : la cause n'est pas trouvée (ni les
feuilles, ni les drapeaux de la racine) — à reprendre avec une rafale et un relevé DOM sous CPU ×4.

**Changement d'onglet — les causes trouvées (profils CPU et compteur de validations React, `scratchpad/dbg/achats.cjs`).**
1. **Une boucle de géocodage** (Comptabilite, effet des points relais) : la cache `vrm_geo_cache_v2` passe par `save` (500 ms
   plus tard), l'effet dépend de `trackingRetrait` recréé à chaque rendu ⇒ il relisait une cache pas encore écrite, regéocodait,
   `setGeo`, re-rendait… Comptabilite était re-rendu toutes les ~0,6 s AU REPOS sur Achats (deux instances alternaient 5 et 6
   points). Sur un téléphone ×4, la transition vers l'onglet suivant était recommencée sans fin : **sur la base, deux passages
   de 5 tours sur deux, aucun onglet ne s'ouvrait plus après Achats** (12 à 190 s par toucher). ⇒ une tentative par point et
   par heure dans la page (`GEO_TENTES`).
2. **Les écrans gardés n'étaient jamais gardés** : `vinted_masquer_ailleurs` et `vrm_retirer_partout` republiées avec une heure
   neuve à chaque passage ⇒ chaque toucher remontait Ventes, Achats, Ma journée. ⇒ `src/publierSiNeuf.js` (même contenu hors `at` :
   réécrit au plus une fois l'heure ; l'extension les juge fraîches 48 h). Plus aucune clé ne périme les écrans après le 1er tour.
3. **La copie d'écran** (clone + mesure de chaque élément) refaite à chaque mutation ⇒ au plus une par 30 s et par écran.
4. **La mise en page forcée** au retour sur un onglet (lecture de `scrollTop` dans `MemoireDefilement`, 0,6 à 0,9 s sur
   Achats/Ventes) : les rangées natives hors de la fenêtre ne sont plus mises en page (`content-visibility: auto` sur `.n-rangee`).

**Médianes sur 5 tours** (390 × 844 densité 3, tactile, CPU ×4, 4G, base au volume de la sienne ; données déjà là). Deux
passages complets ici (`dist15` avec les 4 corrections, `dist17` = la tête, `content-visibility` dès la 20ᵉ rangée) :

| onglet | toucher → image, base `3f4dceeca` | ici (dist15 · dist17) | contenu utile, base | ici (dist15 · dist17) |
|---|---|---|---|---|
| Annonces | 367 ms | 64 · 64 ms | ne s'ouvre pas | 1 491 · 1 896 ms |
| Ventes | 345 ms | 1 352 · 1 728 ms | ne s'ouvre pas | 1 085 · 1 735 ms |
| Achats | 328 ms | 2 696 · 3 064 ms | 5 989 ms | 2 648 · 3 086 ms |
| Argent | 379 ms | 120 · 152 ms | ne s'ouvre pas | 984 · 1 219 ms |
| Ma journée | 334 ms | 1 000 · 1 008 ms | ne s'ouvre pas | 1 025 · 1 000 ms |

Lecture honnête : sur la base, après Achats, AUCUN onglet ne s'ouvrait plus (deux passages de 5 tours sur deux, 12 à 190 s par
toucher, capture : l'onglet allumé, l'écran resté sur Achats) — le « toucher » n'y mesure que le gestionnaire du clic. Ici, chaque
onglet s'ouvre à chaque tour… sauf un passage (`dist16`, sans `content-visibility`) où le blocage est revenu : la boucle de
géocodage en était UNE cause, la mise en page de toutes les rangées d'Achats en est une autre (réduite par `content-visibility`
dès la 20ᵉ rangée, gardé : couches-chargement inchangé). **Les objectifs < 100 ms et < 300 ms ne sont PAS atteints** pour
Ventes, Achats, Ma journée : le coût restant est le rendu de `Comptabilite` (un seul composant de 25 000 lignes, non
interruptible) à chaque retour, et la mise en page de l'écran gardé rattaché. Prochaine étape chiffrée : découper ses calculs
par onglet (ne calculer Achats que sur Achats) ou les sortir du rendu, puis remesurer avec ce banc (`TOURS=5`).

**Défilement** (6 balayages au doigt) : Annonces 51 · 40 images/s (plus longue tâche 185 · 308 ms), Ventes 56 · 58 images/s
(123 · 106 ms) — base : 3 images/s et des tâches de 0,9 à 1 s quand l'app tournait en boucle, 48/51 images/s et 237/204 ms au
mieux. Cible 60 / < 100 ms pas encore tenue (Annonces surtout).

**couches-chargement à la tête** (`dist17`, 390 + 1512, seuil 0,02) : **254 verts, 2 rouges** — Argent à l'ouverture à 1512
(0,054, cause non trouvée) et un clignotement de Messages au 2ᵉ toucher (390 : l'écran montré au plafond avec la seule ligne
« Lecture… » 0,3 s, entre la copie et la liste).

## 3. Reprendre sur l'autre appareil (choix 23) — `src/reprise.js`, `src/RepriseAppareil.jsx`

- **La ligne `vrm_reprise`** (à son nom, comparer-et-échanger sur `data.rev`, `src/ligneCas.js` — une lecture ratée n'écrit rien) :
  `{ v: 1, d: { [appareil]: { e, t, id, at, f } } }` — l'écran, la sorte (`fiche`), le N° (`cleNum`), l'heure, la forme de
  l'appareil (`iphone` · `ipad` · `telephone` · `ordinateur`). RIEN d'autre : `entreeReprise` est une liste blanche (titre, prix,
  photo, compte, acheteur ne passent jamais, même si un autre appareil en avait écrit). Au plus 8 appareils, un jour gardé.
- **L'appareil** : un identifiant tiré au hasard, `localStorage.reprise_appareil`, jamais synchronisé (il ne dit rien de l'appareil).
- **Publier** : quand une fiche s'ouvre ici (`ficheNum` de la coque), 1,5 s après ; la même fiche dans les 10 min n'écrit plus.
- **Montrer** (en haut d'Aujourd'hui, au-dessus de « Bien démarrer ») : la plus récente d'un AUTRE appareil, ouverte il y a 30 min au
  plus, pas masquée, pas déjà ouverte ici — « Reprendre : Nike Air Max 1 taille 42 · Ouvert sur l'iPhone à 21:04 › ». Le titre est
  retrouvé SUR CET appareil par le N° (une seule fiche porte ce N°, sinon « N° 124 » — jamais par ressemblance). Toucher = la fiche
  exacte (`vrm:fiche-paire`). « × » (44 px) ou balayer = masquer (`reprise_masquee`, cet appareil).
- **Aucun saut** : la lecture est une donnée ESSENTIELLE d'Aujourd'hui (`useEssentiel('reprise')`, bornée à 4 s ⇒ rien) : l'écran vrai
  ne paraît qu'avec elle ; une fois peint, la rangée est figée — seule une lecture du RETOUR sur l'app (`visibilitychange`) peut l'ajouter.
- Limite : seule la fiche d'une paire (par N°) est publiée — la fiche est l'objet central (§2.11) ; le détail d'une vente ou d'un achat
  n'a pas d'identité commune simple aux deux appareils dans la coque (à faire si Julien le demande).

## 4. Annonces qui ne sont plus vues (choix 27, côté app) — `src/plusVue.js`

- **La source** (mesurée le 22 nov. sur la vraie base, lecture seule) : ni `vinted_suivi_{uid}` ni `courbes_annonces_{uid}_{nav}`
  n'existent encore chez lui (les extensions 5.428/5.429 ne sont pas installées). UNE source retenue : **`vinted_suivi_{uid}`** — une
  ligne par compte, un relevé par annonce et par jour de Paris, lue projetée par 60 annonces (`src/boostLecture.js lireSeries`,
  `src/plusVueLecture.js`), après la liste, gardée 10 min. Le journal `vrm_vues_lues` n'est PAS une source : il n'écrit qu'un point qui
  change, un jour sans point y est indiscernable d'un jour non lu.
- **La règle** `plusVue(serie, { jours, maintenant })` : dernier relevé d'aujourd'hui ou d'hier, sinon pas su ; le palier = les relevés
  de la fin au même nombre de vues ; « en gagnait avant » = un relevé avant le palier avec MOINS de vues (aucun ⇒ pas su ; plus ⇒
  compteur remis ⇒ pas su) ; « plus vue » si le palier couvre ≥ N jours entre deux lectures (N : 3/5/7/10/14, défaut 5,
  `vrm_plus_vue_jours`, réglé dans la feuille de « Republier ») ; le nombre dit est MESURÉ (jamais compté jusqu'à aujourd'hui sans
  lecture d'aujourd'hui).
- **Écrans** : étiquette « Plus vue depuis 6 j » sur la carte (ordinateur, tableau) et dans la ligne méta de la rangée (téléphone) ;
  vue « Republier » : la raison ajoutée à la ligne (« … · plus vue depuis 6 j »), et les annonces plus vues qui ne sont pas encore
  « endormies » dites une fois dans « Plus vues depuis 5 j ou plus » ; « Republier dans l'extension » (au pied de la rangée) ouvre la
  feuille Avant | Après de CETTE paire dans le panneau (`ACTIONS_EXTENSION.republierMaintenant`, `republier-direct`), seulement sur
  son toucher.
- Corrigé en passant : `lireSerie` (src/boostPeriode.js) lisait un relevé VIDE (« pas dit par Vinted », l'extension écrit `,,`) comme
  0 vue (`Number('')`). Un vide reste `null` (le verdict des boosts en profitait aussi).

## 5. Preuves

- **`couches-chargement`** (BANC_DESIGN_V2=defaut, DEBUG=1, seuil CLS resserré à **0,02**) :
  - base d'avant (`claude/integration-finale` `d86d45dde`, construite telle quelle) — 390 : Ma journée 0,053 · Ventes 0,15 ·
    Achats 0,675 (et 0,102 au toucher) · Argent 0,058 · Messages 0,041 / 0,063 ; 1512 : Achats 0,401 · Ma journée 0,041 · Ventes
    0,023 / 0,04 — **rouge** ;
  - cette branche — **390 : 127 verts, 1 rouge** (Messages au 2ᵉ toucher 0,028 : le « Lecture… » poussé — corrigé après, rangées
    d'attente natives et la ligne « pas pu lire » posée après la liste, non remesuré) ; ouvertures : Ma journée 0,012, Annonces 0,
    Ventes 0, Achats 0, Argent 0,003, Messages 0,007 ; **1512 : 126 verts, 2 rouges** (Argent à l'ouverture 0,054 : `vrm-argent-partie`
    +21 px à 1,7 s ; Ventes au 1er toucher 0,088 : le tableau remonte de 320 px à ~9 s) — à reprendre.
- **`apres-finale-app`** (390 tactile et 1512, clair et sombre) : **74 OK · 0 KO**. Captures regardées : Statistiques neuves (Vide +
  « Relier un compte »), pas su (Réessayer), « Reprendre : Nike Air Max 1 taille 42 · Ouvert sur l'iPhone à 12:11 » + « × »,
  la fiche ouverte au toucher, « Plus vue depuis 6 j » (rangée, tableau), la vue Republier avec la raison et « Republier dans
  l'extension ». Sur la base d'avant ces écrans n'existent pas (rouge).
- **`fluidite-generale`** 390 : base 223 lectures (L1/L2 rouges, ×11 identiques) ⇒ ici 155, L1/L2 verts ; I et D : voir §2 bis.
- **`audit-apres-finale-app`** : 39 verts, `--prouve` **20/20 mutations rouges** (S stats, R reprise sans fuite, P plus vue,
  F partage des lectures bornées / lignes de site / valeur inchangée).
- Verts : audit-traduction (45), audit-quoi-de-neuf, audit-tdz, audit-variables, audit-demarrage (30), audit-poids-demarrage
  (**1 490 Ko** pour 2 008 permis ; 1 486 sur la base), audit-lectures-partagees, audit-lecture-bornee (10), audit-ext-5429 (45 —
  `lireSerie` corrigé), audit-republier-priorite, audit-ux-reglages, audit-garde-ecrans ; build.

## 6. Gestes de Julien

Aucun. « Plus vue » ne s'allume qu'avec l'extension 5.429 ou plus (le relevé quotidien) ; « Reprendre » marche dès le déploiement,
sur deux appareils connectés au même compte VRM.
