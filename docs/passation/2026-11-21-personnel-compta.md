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

**Ouverture d'Argent : PAS MESURABLE, et un défaut trouvé, déjà là AVANT.** À la 1re mesure (21:52), Argent s'ouvrait en
6,3 s (CPU 6,3 s) puis 4,8 s. Après minuit, sur le build d'AVANT comme sur celui d'après, le toucher « Argent » après
Annonces → Ventes → Achats ne finit plus : **25 à 28 s de CPU, `Comptabilite` rendu en boucle** (profil : la fonction
`Comptabilite` 21 s inclusifs pendant que l'écran montré est Argent, 70 à 120 tâches longues), et les onglets suivants
restent bloqués. Pas reproduit sans bridage (sonde 390, base plus petite : chaque onglet en ~2 s). Hypothèse à vérifier :
un écran gardé (`src/ecransGardes.jsx`) qui n'est pas gelé ou qui est remonté en boucle (« périmé » à chaque
sauvegarde ?) quand la date de la base inventée franchit un seuil. Reproduire :
`ETAPES=onglets TOURS=1 PROFIL_ONGLETS=profil.json node scripts/bancs/iphone-rapide.cjs <dist> <port libre>`.

## 4. Pas fait

- **Les dérivés de `Comptabilite` en magasin** (`src/memoCourt.js`, `useStateVague`) : pas commencé. Avant, trouver le
  défaut ci-dessus (c'est lui qui coûte le plus) ; puis les `useMemo` qui repartent de zéro à chaque remontage.
- `scripts/decouper-app.cjs` ne dédoublonne pas les exports (fait à la main ici).
- Le 2e tour d'onglets et Argent avant/après : voir le défaut ci-dessus.
