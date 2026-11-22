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

(complété en fin de session — voir le rapport)

## 6. Gestes de Julien

Aucun. « Plus vue » ne s'allume qu'avec l'extension 5.429 ou plus (le relevé quotidien) ; « Reprendre » marche dès le déploiement,
sur deux appareils connectés au même compte VRM.
