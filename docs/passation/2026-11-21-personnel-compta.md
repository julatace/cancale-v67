# 21 nov. — « personnel-compta » (branche `claude/personnel-compta`, partie de `claude/integration-21nov`)

Deux sujets de la passation du 20 nov. (§4 points 2 et 5), choisis par Julien.

## 1. Le compte « personnel » sort des totaux, aussi côté serveur

Julien (20 nov., « comme Bleam ») : Paramètres › Comptes liés › Gérer › « Compte personnel (hors URSSAF et livre des
recettes) » (`vrm_roles_comptes`, `src/rolesComptes.js`). L'app le sortait du CA déclaré et des totaux de Comptabilité ;
le bilan de la semaine, le bilan du mois et le widget le comptaient encore.

**La règle n'est pas recopiée à la main : elle est IMPORTÉE** (`comptesHorsTotaux`, src/rolesComptes.js — un propriétaire,
comme `api/_lib/comptes-exclus.js`, `plan-regle.js`, `src/venteAilleurs.js`). Elle ne touche pas `compteEcarteRegle` : le
miroir `api/_lib/ventes-regle.js` reste celui d'App.jsx au jeton près (`audit-bilan-semaine` 57/57, rien à refabriquer).

| où | avant | maintenant |
|---|---|---|
| `api/_lib/bilan-semaine.js` `calculerBilan` (semaine ET mois, `bilan-mois.js`, `argent-passes.js`) | comptes écartés = `vinted_accounts_hidden` | `comptesHorsTotaux(masquesComptes, roles)` : écartés + personnels, hors du VENDU et du REÇU, jamais réclamés (« au moins … sans perso ») |
| `api/ship-reminders.js` `lireDonneesBilan` | — | lit `vrm_roles_comptes` PROJETÉ sur `main` (`vrm_roles_comptes:data->vrm_roles_comptes`, jamais `select=data`) ⇒ `roles` ; illisible ⇒ aucun rôle (pas su ne retire rien) |
| `api/widget.js` (repli sur les e-mails de vente, CA du mois) | toutes les ventes (sauf hors offre Solo) | sans les comptes hors des totaux (écartés + personnels) ; `vrm_roles_comptes` ajouté à la projection `MAIN_WIDGET` |
| l'app, VENDU de la coque (`liveStatsVus` → Ma journée et `widget_stats`, que le contrôle de nuit compare au bilan) | sans les écartés | sans les écartés NI les personnels (`comptesHorsTotaux`, la règle de « Vendu et reçu » de Comptabilité) ; `masquesTick` suit aussi `vrm_roles_comptes` |

Ce qui ne bouge pas (§5 « un colis caché est un colis perdu ») : un compte personnel garde ses colis, ses listes, ses
alertes ; le contrôle de nuit « vente sans N° » le lit toujours (le rôle n'entre pas dans `masquesComptes`).
Le REÇU (`vinted_urssaf_mois`, CA déclaré) excluait déjà le compte personnel côté app (`venteOffDeclareOf`) : le widget le
lit tel quel.

**Preuve** — `node scripts/audit-personnel-serveur.cjs` (nouveau, 18 contrôles) EXÉCUTE les vraies routes (le cron du lundi
`api/ship-reminders.js`, `lireDonneesBilan` + `calculerBilanMois`, `api/widget.js`) contre une fausse base à la vraie forme
(`select=` projetés, `owner=eq.`), deux vendeurs Pro : P (compte 11 vente 40 € + compte 12 PERSONNEL 500 €) ⇒ 1 vente · 40 €
partout ; T témoin sans rôle ⇒ 2 ventes · 540 € (la donnée déclenche). La règle attendue est celle de `comptesHorsTotaux`.
- sur le code d'avant (`git archive origin/claude/integration-21nov`, banc copié dedans) : **9 rouges** (bilan semaine
  vendu/reçu, projection, bilan du mois vendu/reçu, widget, lecture, coque ×2) ;
- `--prouve` : 7 mutations (bilan, lecture, projection, widget, widgetLecture, règle, app), **toutes rouges**.
- verts après : audit-bilan-semaine 57, audit-bilan-mois 52, audit-urssaf 88, audit-fonctions-api 11 (aucune fonction
  ajoutée, 12 max), audit-suites-serveur 47.

## 2. Vitesse : `Comptabilite` sort d'App.jsx

`Comptabilite` (Aujourd'hui, Ventes, Achats, Annonces, 25 300 lignes, 40 % d'App.jsx) vit dans
`src/ecrans/Comptabilite.jsx` (31 700 lignes avec ce qui ne servait qu'à lui : 386 déclarations), chargé par
`aLaDemande`. Découpe MÉCANIQUE (`node scripts/decouper-app.cjs src/App.jsx ecrans/Comptabilite.jsx Comptabilite
--appliquer`), avec deux retouches :
- **4 poseurs** (le module ne réaffecte pas une liaison importée) : `poserPendingBordPrint`, `poserDureeProchainGeste`,
  `poserAchatsMasques`, `poserGroupesDeuxFois`, déclarés à côté de leur `let` dans App.jsx ; les 11 affectations de
  `Comptabilite` passent par eux (lecture : liaison vivante, inchangée).
- **exports dédoublonnés** : l'outil a ajouté une 2e liste `export { … }` qui répétait 275 noms déjà exportés (le build
  refusait) ; chaque nom n'est plus exporté qu'une fois. ⚠️ `decouper-app.cjs` devrait le faire lui-même (pas corrigé ici).

Aujourd'hui en a besoin au premier écran, donc **pas d'attente ajoutée** :
- `Comptabilite.precharger()` dès l'évaluation d'App (src/App.jsx, à côté de la racine paresseuse) ;
- index.html le précharge en BASSE priorité (`data-js-ensuite`, vite.config.js `prechargerApp` ; `public/demarrage-app.js`
  pose `modulepreload` + `fetchpriority=low`) : le morceau App passe d'abord ;
- son français est compté « démarrage » (`scripts/_francais-differe.cjs`) : sinon fr-reste (150 Ko) partait avec lui.

§4.11 vérifié sur ce qui RESTE : 55 `tab===` avant et après (texte recollé `_source-app.cjs`), `audit-variables` 20,
`audit-tdz` 1, `audit-coherence` 612, `audit-identite` 59, `audit-icones` 6, `audit-francais-differe` verts ; captures
390 regardées (Aujourd'hui, Argent : `argent-natif` 67 verts, 1 rouge déjà là — contraste des petites légendes de
Statistiques, écran non touché).

### Mesures (base inventée `_base-volume`, aucune donnée réelle)

Poids (gzip -9, `audit-poids-demarrage`) : **démarrage 2 008 → 1 465 Ko** (morceau App 4,93 → 2,97 Mo bruts) ; plus le
morceau Comptabilite et ce qu'il importe, préchargés après : 573 Ko ⇒ **total pour Aujourd'hui 2 038 Ko (+30 Ko, +1,5 %)**
— 512 noms partagés entre deux morceaux ne se raccourcissent plus. Le gain est l'ORDRE (la coque n'attend plus
Comptabilite), pas les octets.


### Aucun chiffre ne change

`scripts/bancs/chiffres-volume.cjs` (Ma journée, Ventes, Achats, Colis, Argent Résumé + Déclarer, Statistiques, et tout ce
qui est publié dans le `localStorage`) sur le build d'avant puis celui d'après, **lancés l'un juste après l'autre**, puis
`scripts/compare-chiffres-volume.cjs` : **« aucun chiffre ne change : 35 relevés identiques »**.
⚠️ Deux passes espacées de 2 h différaient (« 63 colis » / « 67 colis », une prévision 9 300 / 9 400 €) — y compris AVANT
contre AVANT : la base inventée est datée par rapport à l'heure, le banc ne fige pas l'horloge. Comparer toujours deux
passes collées.

## 3. Temps (banc `iphone-rapide`, 390 @3, CPU ×4, 4G 150 ms / 9 Mbit/s, base de volume, machine partagée chargée)

Démarrage, avant / après lancés en alternance (avant, après, avant, après) :

| | avant (2 passes) | après (2 passes) |
|---|---|---|
| à froid : coque | 7 197 · 6 156 ms | 5 474 · 6 463 ms |
| à froid : écran utile (Aujourd'hui) | 9 302 · 8 311 ms | 7 826 · 8 660 ms |
| JS + CSS reçus à froid | 2 014 Ko (17 fichiers) | 2 045 Ko (52 fichiers) |
| 3e ouverture (service worker) : coque | 4 726 · 2 919 ms | 2 512 · 2 279 ms |
| 3e ouverture : écran utile | 14 420 · 11 590 ms | 10 393 · 10 077 ms |

Lecture honnête : la coque arrive plus tôt (−0,5 à −2 s à chaud), Aujourd'hui un peu plus tôt, le bruit de la machine
(charge 15) est du même ordre que l'écart à froid. Les objectifs (chaud < 1 s, froid < 3 s) restent loin.

Changements d'onglet (1er tour) : annonces 6 987 → 6 775 ms CPU, ventes 5 663 → 5 811, achats 10 223 → 9 807 :
pareil (le calcul de `Comptabilite` n'a pas changé, seulement son fichier).

**Défaut « Argent bloqué » (trouvé ici, déjà là AVANT, PRÉSENT EN PRODUCTION) — corrigé le 22 nov., voir §5.**

## 4. Pas fait

- **Les dérivés de `Comptabilite` en magasin** (`src/memoCourt.js`, `useStateVague`) : pas commencé (les `useMemo` qui
  repartent de zéro à chaque remontage).
- `scripts/decouper-app.cjs` ne dédoublonne pas les exports (fait à la main ici).

## 5. Le défaut « Argent bloqué » (22 nov.)

**Ce qu'on voyait** (banc `iphone-rapide`, iPhone 390, CPU ×4, base de volume) : Annonces → Ventes → Achats, puis toucher
« Argent » : l'onglet s'allume mais l'écran reste Achats ; 25 à 35 s de calcul, 80 à 120 validations de React, et les
onglets suivants bloqués aussi. Même chose sur le build d'AVANT la découpe : ce n'est pas la découpe.

**La cause exacte** (trouvée par le profil, puis par une sonde dans la page : `COMMITS=1` du banc compte les validations de
React et les états qui changent, et note la PILE de l'appel qui les pose) :
1. Au téléphone, l'écran des colis de Ventes PRÉPARE D'AVANCE le lot à imprimer (`src/ecrans/Comptabilite.jsx`,
   « LA PRÉPARATION D'AVANCE (au téléphone) », `composerLot` → `lireOctetsLigne` → `octetsBordereau` → `lirePdfLigne`) :
   il lit les PDF du lot l'un après l'autre (14 dans la base du banc).
2. Chaque PDF lu passe par `lireEtiquetteIci` (`src/App.jsx`, à côté de `lirePdfLigne`) qui envoyait un signal
   `vrm:etiquette-lue-ici` PAR PDF.
3. Chaque `Comptabilite` montée — l'écran montré ET les écrans gardés (Aujourd'hui, Ventes, Achats : `src/ecransGardes.jsx`)
   — écoutait ce signal et RECOPIAIT sa liste de bordereaux (`redessiner` : `setEmailBords(v.slice())`) et son compteur
   (`setEtiqLuesTic`). Un écran gardé est gelé par une `Suspense`, mais React rend QUAND MÊME, en arrière-plan, un arbre
   caché qui reçoit une mise à jour : chaque PDF lu = un rendu COMPLET de chaque `Comptabilite` (≈ 0,5 à 1,5 s chacune au
   téléphone). 14 PDF × 3 écrans ⇒ 40 rendus complets, enchaînés pendant que l'utilisateur change d'onglet : le toucher
   d'Argent passe derrière.
   Mesuré : l'état n° 135 de `Comptabilite` (la liste `emailBords`) changeait 3 fois par validation, la pile de l'appel
   remontait à `lireEtiquetteIci` → `redessiner`.

**Pourquoi « depuis minuit »** : ce n'est pas un calcul de date de l'app. La base inventée (`_base-volume.cjs`) date tout
depuis « le dernier midi » et la préparation ne part que quand la lecture des étiquettes est finie AVANT qu'on quitte
Ventes (`lotLu()`) : selon l'heure et la charge de la machine, la rafale tombait pendant Achats/Argent ou non. Le
mécanisme, lui, est indépendant de l'heure.

**La production est touchée** : `origin/main` a exactement le même code (`lireEtiquetteIci` qui signale à chaque PDF,
`redessiner` sans garde, la préparation d'avance au téléphone, les écrans gardés). Julien, sur iPhone, avec un lot de
bordereaux à imprimer, peut voir un onglet qui ne vient pas pendant plusieurs secondes.

**Le correctif (à la racine)** :
- `src/App.jsx` `avecRafaleEtiquettes` + `signalerEtiquetteLueIci` : pendant la composition d'un lot (`composerLot`) ET tant
  qu'une étiquette est en cours de lecture, aucun signal ; UN seul à la fin. Hors rafale, un signal 800 ms après la
  dernière étiquette (3 s au plus). ⚠️ Un 1er essai avec le minuteur seul ne suffisait pas : au téléphone les PDF arrivent à
  plus d'une seconde d'écart (et chaque rendu les espace encore) — mesuré 11 signaux pour 11 PDF, Argent pas atteint ;
- `src/ecrans/Comptabilite.jsx` (les deux écoutes) : un écran gardé CACHÉ ne recopie rien ; il note, et redessine une seule
  fois à son retour (`vivant.surRetour`).
Rien d'autre ne change (le transporteur apparaît comme avant, au plus 0,8 à 3 s plus tard).

**Le contrôle** : étape `argent` du banc `iphone-rapide` (`ETAPES=argent`), horloge FIXÉE par `BANC_MAINTENANT=<date>`
(la page : `ctx.clock.install` ; la base inventée : la même heure, `_base-volume.cjs`) : Annonces → Ventes (on repart dès
le 1er PDF lu, la rafale continue) → Achats → Argent. Jugé : Argent atteint en moins de 20 s ET au plus un signal pour trois
PDF (le code d'avant : un par PDF). Lancer : `BANC_MAINTENANT=2026-11-22T00:01:00+01:00 ETAPES=argent node
scripts/bancs/iphone-rapide.cjs dist <port libre>`. Résultats : §6.

## 6. Résultats du contrôle « Argent après Annonces → Ventes → Achats » (22 nov.)

Banc `iphone-rapide`, `ETAPES=argent`, horloge fixée (page ET base inventée), iPhone 390 @3, CPU ×4, 4G, machine partagée.

| horloge | AVANT (build d'avant le correctif) | APRÈS |
|---|---|---|
| sam. 21 nov. 23:59 | — | ✅ 6,8 s · 11 PDF, 1 signal |
| dim. 22 nov. 00:01 | (8,2 s, 12 signaux pour 13 PDF : la règle « un par PDF » le fait rouge) | ✅ 5,4 s · 12 PDF, 1 signal |
| lun. 23 nov. 00:01 | ❌ PAS atteint en 60 s · 11 PDF, 11 signaux, 129 validations | ✅ 5,9 s puis 6,8 s · 11 PDF, 0–1 signal |
| lun. 30 nov. 23:59 (fin de mois) | — | ✅ 7,6 s · 10 PDF, 1 signal |
| mar. 1er déc. 00:01 (1er du mois) | ❌ PAS atteint en 60 s · 10 PDF, 11 signaux, 127 validations | ✅ 5,3 s · 11 PDF, 1 signal |

Le 1er correctif (minuteur seul, commit 9c2828026) laissait encore passer le défaut (23 nov. : 11 signaux, Argent pas
atteint) : c'est le regroupement par composition de lot (74f448bb0) qui le règle. La sonde de React (`COMMITS=1`) pèse
sur la mesure : l'étape `argent` ne compte que les validations, sans parcourir l'arbre.
⚠️ Avec l'horloge fixée, la 3e ouverture (« chaud 2 ») attend ~260 s avant la coque (artefact de l'horloge simulée avec le
service worker) : ne pas lire les temps de démarrage d'un passage `BANC_MAINTENANT`.
