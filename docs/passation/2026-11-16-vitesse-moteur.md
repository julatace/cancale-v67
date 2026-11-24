# 16 nov. 2026 — Calculs du moteur une fois par version des données (lot `vitesse-moteur`)

Branche `claude/vitesse-moteur` (partie de `claude/vitesse-volume`, PR #1200 : elle CONTIENT ses accélérations).
But (passation générale §3) : les calculs dérivés du moteur `Comptabilite` (rendu 20–40 fois) faits une fois par
version des données, hors du rendu ; mêmes chiffres ; mesuré à 20 000 ET ~2 200 ventes.

## ÉTAT À LA REPRISE

- **Fini, à intégrer** (PR ouverte). À fusionner APRÈS #1200 ou à sa place (elle la contient) : le récit et les
  bancs de #1200 restent valables.
- **Objectif < 2 s : toujours pas atteint** (Ma journée ~25 s à 20 000 ventes, processeur ×4, machine chargée) ;
  gain mesuré ci-dessous. Le levier suivant : les lectures de fond qui redessinent tout le moteur une à une
  (voir §4).
- Rien de visible ne change (aucun texte, aucun écran) ⇒ ni `tr()` ni « Quoi de neuf ».

## 1. Mesurer avant de coder : POURQUOI le moteur se redessine

Crochet de diagnostic (local, non commité : le crochet `RENDUS` de `_mesure-demarrage.cjs` + la liste des états
du moteur qui ont changé à chaque rendu, avec « ≡ » quand le contenu est le même). Ma journée, 20 000 ventes,
38 rendus dus à un état du moteur :
- **le cache de géocodage des points relais** (`geo`, un point à la fois, raté ou trouvé : 8 changements, 5 rendus en moins une fois retiré, 38 → 33) — un
  état que seul le planificateur de tournée lisait (feuille fermée à l'ouverture) ;
- des états **reposés au même contenu** : les N° d'annonces (`vinted_annonce_numeros`), les N° utilisés, le
  n° de transaction ⇒ annonce (1 190 entrées, relu à chaque arrivée de ventes), des `{}` remplacés par `{}`.
  Un objet neuf au même contenu change l'identité de la donnée : CHAQUE `useMemo` et chaque mémoire par version
  qui la lit (`identiteAnnonce`, `resolvedEntry`, `effEntry`, `pairesVendues`…) refait les 20 000 ventes.

## 2. Ce qui a changé (aucune règle, aucun chiffre)

1. `src/memeValeur.js` (`gardeSiMeme`) : un état reposé au MÊME contenu garde sa valeur (comparaison stricte :
   objets simples, tableaux, `Set`, `Map` ; tout le reste n'est égal qu'à lui-même ; jamais `JSON.stringify`,
   qui écrit « {} » pour deux `Set` différents). Posé sur `useStateCle` (toute clé relue du nuage) et sur
   `setTxnItem`.
2. Le cache de géocodage n'est plus un état du moteur : écrit dans `vrm_geo_cache_v2` seul ; le planificateur
   de tournée le relit, feuille ouverte (`audit-variables` l'a rattrapé).
3. `src/calculParVersion.js` (`parVersion`) : un calcul fait EN PLEIN RENDU, gardé tant que chaque clé est la
   même (identité), mémoire du module partagée par les moteurs, 4 versions par nom, `jusqua` pour une réponse
   qui expire avec l'heure. Posé sur le CA de l'année de Ma journée (clés `declarables`, année ; expire quand
   l'heure rattrape une vente à dater datée dans le futur) et sur `rythmeVendu` (clés lignes, minuit du jour :
   la règle ne lit l'heure que par son minuit).
4. Les mémoires par vente (`memoVersion`, ventes visibles) lues en une fois au lieu de deux.
5. (commit d'avant, même lot) `src/indexVentes.js` : fenêtre des 45 jours, ventes à expédier et preuve de départ
   par index (sur-ensemble, dans l'ordre de la liste) — `audit-index-ventes`.

## 3. Preuves

**Vitesse** (`vitesse-volume.cjs`, médiane de 5, builds alternés main 005844c68 / branche, 390 tactile, ×4,
`RESEAU=libre COMPLET=1`, machine partagée très chargée — charge 15 à 34 sur 4 processeurs) :

| écran complet (ms) | main | branche | tâches longues main → branche |
|---|---|---|---|
| Ma journée · 20 000 ventes | 32 509 | **25 394** (−22 %) | 31 602 → 21 558 |
| Ventes · 20 000 ventes | 34 548 | **23 898** (−31 %) | 32 835 → 21 807 |
| Ma journée · 2 200 ventes | 14 409 | **12 720** (−12 %) | 11 123 → 8 965 |
| Ventes · 2 200 ventes | 18 703 | **14 774** (−21 %) | 16 657 → 13 013 |

Le gain mélange #1200 (contenue dans la branche) et ce lot ; « prêt » (au plafond) ne bouge pas.

**Rendus** (`_mesure-demarrage RENDUS=1`, une passe, rendus de `Comptabilite` jusqu'au calme) :
20 000 ventes — Ma journée 52 → 43, Ventes 54 → 40, Achats 158 → 138 ; 2 200 ventes — 54 → 45, 52 → 40, 154 → 136.

**Chiffres** (`chiffres-volume` + `compare-chiffres-volume`, deux passes par build, dans la même heure, 20 000 et
2 200 ventes) : le banc n'est PAS déterministe sur cette machine (main contre main : 12 différences à 20 000,
3 à 2 200 — Ma journée ouverte à froid, « 30 € » vu 2 ou 3 fois sur Ventes, une prévision de Statistiques
850 000/860 000, l'ordre de trois attributs). Croisé valeur par valeur (script local) : **aucune publication
différente** ; chaque relevé de la branche est une valeur vue sur main, sauf des combinaisons de deux
variations déjà vues sur main (Ma journée à froid ; Ventes : trois « 30 € » vus sur main2 ET les totaux vus
sur main1) et, à 2 200, le même jeu d'attributs dans un autre ordre.
Les règles touchées ont leur contrôle exécuté, rouge par mutation :
- `audit-meme-valeur` (24 cas, dont deux `Set` différents que JSON dirait égaux ; 5 mutations rouges) ;
- `audit-calcul-par-version` (exécute la clé du rythme et le calcul du CA de l'année LUS dans App.jsx, heure
  pilotée sur deux jours et demi et au passage de l'année ; 4 mutations rouges, dont « jour retiré de la clé ») ;
- `audit-index-ventes` (4 mutations rouges).
Audits verts : tdz, variables, coherence, identite, statuts, onglets-d, stats-ventes, une-regle, traduction,
quoi-de-neuf, bilan-semaine, dac7-comptes. Build vert.

**Captures** : rien de visible ne change ; captures du banc `chiffres-volume` (nouveau : `CAPTURES=`, `LARGEUR=390`,
`SOMBRE=1`) regardées sur Ma journée et Ventes, 390 clair et 1512 sombre.

## 4. Pour aller plus loin
- Les lectures de fond arrivent une par une (relais, txn, suivis, e-mails) et redessinent chacune tout le moteur :
  les regrouper (une écriture par vague) est le prochain levier mesurable avec le même diagnostic.
- Achats monte 3 moteurs (138 rendus) : un seul moteur pour l'écran, ou des écrans consommateurs.
- Web Worker : pas fait — les calculs restants lisent des closures du moteur (états, réglages du module) ; il
  faudrait d'abord des règles pures par donnée.

## 5. Fichiers
`src/memeValeur.js`, `src/calculParVersion.js`, `src/indexVentes.js` (neufs), `src/App.jsx`,
`scripts/audit-meme-valeur.cjs`, `scripts/audit-calcul-par-version.cjs`, `scripts/audit-index-ventes.cjs` (neufs),
`scripts/bancs/chiffres-volume.cjs` (captures), `scripts/bancs/_mesure-demarrage.cjs` (rendus venus du parent).
Geste de Julien : aucun.

## 24 nov. — reprise seule : `main` refusionnée, banc des 20 000 ventes rendu fiable, un vrai défaut corrigé

**Fusion** (vrai `git merge origin/main`, 6 fichiers en conflit). Le moteur `Comptabilite` vit depuis le découpage dans
`src/ecrans/Comptabilite.jsx` : les 30 morceaux du lot dans `App.jsx` ont été relus un par un (script : ancien texte ⇒
nouveau, appliqué seulement s'il se trouve UNE fois). 19 sont passés tels quels dans `Comptabilite.jsx` ; `cartesColis` et
`listeEnvoyes` gardent la mémoire « une fois par rendu » que `main` leur a donnée le 20 nov. (celle du lot n'y est pas
remise, et la fin de `cartesColisCalc` qu'un morceau avait refermée en `});` est remise en `};`) ; la preuve de départ par
n° (`parTransaction`) et le géocodage hors des états sont reportés à la main. CLAUDE.md laissé à `main` (règle de
l'intégration du 23 nov.) ; historique-divers : les deux côtés.

**Le défaut trouvé (réel, fait par la fusion)** : `main` (18 nov., `src/versionDonnees.js`) a réécrit `noterEtatsTxn` —
la version de la table passe par `toucherMemoire()`, et `TXN_ETATS.ver` n'était plus jamais montée. Or `aExpedier`,
`venteSortieDuStock` et l'index « à expédier » du lot gardent leur réponse tant que `TXN_ETATS.ver` ne bouge pas :
une vente jugée « à expédier » le restait après qu'une lecture des transactions l'a dite finalisée ou annulée (colis
fantôme dans « À envoyer », paire jamais sortie du Stock). Corrigé : `noterEtatsTxn` monte `TXN_ETATS.ver` ET appelle
`toucherMemoire()` quand une ligne change (la table seule, pas toute la mémoire : moins de calculs refaits).
- Contrôle EXÉCUTÉ (`audit-index-ventes`) : la vraie `aExpedier` / `noterEtatsTxn` / `venteSortieDuStock` lues dans le
  texte de l'app recollé ; une vente jugée, puis sa transaction lue finalisée, puis rejugée ⇒ la réponse change.
- Rouge avant : l'arbre fusionné sans la correction ⇒ `aExpedier` reste `true` après « finalisée », sortie du stock
  `false` (2 rouges). Mutations rouges : `aExpedier` ou `venteSortieDuStock` qui ignorent la version, `noterEtatsTxn` qui
  ne la monte plus.
- `chiffres-volume` ne le voit PAS (build avec le défaut = mêmes chiffres que `main`) : dans sa base, les états des
  transactions arrivent avant le premier jugement. Seul l'audit le garde.
- Audits du lot (`audit-index-ventes`, `audit-meme-valeur`, `audit-calcul-par-version`) portés sur le texte RECOLLÉ
  (`_source-app.cjs`) : sur `App.jsx` seul, deux rougissaient et un (« plus de `setGeo` ») passait à vide.

**Le banc des 20 000 ventes (`chiffres-volume`)** — lancé seul (aucun autre banc de cette session en même temps ; la machine
restait à une charge de 18 à 32 pour 4 cœurs, d'autres agents).
- Ce qui le rendait non fiable, mesuré : 4 passes à l'ancienne, même build ⇒ « branche-1 » ≠ « branche-2 » sur Ventes
  (« 14 bordereaux », « 35 bordereaux », `data-file-envoi=1132` absents de l'une). « Aucune lecture depuis 4 s » ne dit
  pas que l'écran a fini : le calcul et le rendu continuent sans lecture.
- Correction du banc : le relevé de chaque écran est refait toutes les 3 s jusqu'à DEUX relevés identiques de suite sans
  lecture entre eux (3 min au plus) ; jamais stable ⇒ `instable`, et `compare-chiffres-volume` le dit ROUGE (vérifié sur
  un relevé marqué instable). Aucun écart n'est effacé : un écran stable mais différent reste rouge.
- **Verdict** : 1512 px, 4 passes alternées (main, branche, main, branche) : les 4 identiques deux à deux (41 relevés,
  6 comparaisons) ; 390 px tactile, une passe chacun : identiques (41 relevés). Captures 390 regardées (Aujourd'hui,
  Ventes : mêmes chiffres, écran complet).
- Vitesse : PAS remesurée — sur une machine à charge 20+, une mesure de temps ne prouve rien. Les chiffres du 16 nov.
  plus haut restent ceux d'avant la fusion. `volume-budget` (dans le lot de la CI depuis vitesse-volume) juge 2 s après
  les données : à surveiller en CI, il peut y être rouge (objectif jamais tenu le 16 nov.).
