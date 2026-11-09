# 9 nov. 2026 — Vitesse du démarrage (Julien : une app rapide pour ses clients payants)

Branche `claude/vitesse-demarrage` (depuis `origin/main` `b3ec1b17`). Rien de métier, aucun
chiffre ni aucune règle changés : ce qui change, c'est ce qui est CALCULÉ (et écrit) pendant
l'ouverture. Pas de PR ni de fusion (consigne de la session).

## 1. Mesure d'abord

Outil : `scripts/bancs/_mesure-demarrage.cjs` (existant), enrichi ce jour de :
`PROFIL=<préfixe>` (profil CPU du démarrage, agrégé par fonction, `PROFIL_BRUT=1` pour le
`.cpuprofile`), `TRACE=<préfixe>` (trace Chrome, compilation V8 comprise), `RENDUS=1`
(chaque rendu de `Comptabilite` avant « prêt »), `JALONS=1` (tâches longues + chaque
`vrm:save` daté), `COMPLET=1` (l'heure où TOUTES les données essentielles sont là).
Profil : 390 px tactile, 4G (9 Mb/s, 60 ms), processeur ×4, base inventée au poids réel.
⚠️ Conteneur partagé : charge 1 à 2 au début, **30 à 45 ensuite** (autres agents) ; les
temps absolus varient du simple au double, d'où les passages entrelacés et les médianes.

**Avant** (`origin/main`, charge ~2, 3 passages) : Ma journée « prête » en **6,7–7,2 s**
(médiane 6,8 s), Colis ouvert directement 6,0–6,9 s ; 77 lectures (2,2 Mo) avant « prêt » ;
tâches longues 5,4–7,6 s ; **13 rendus de `Comptabilite`** avant « prêt ».

Le déroulé d'une ouverture de Ma journée (avant) :
- 0 → 1,3 s : téléchargement du morceau App (850 Ko compressés, 2,6 Mo) ;
- 1,3 → 1,9 s : son évaluation (0,6 s) ; 1,9 s : la sonde du schéma ;
- 2,0 → 3,2 s : UNE tâche de 1,2 s = le premier rendu (AppCoeur + `Comptabilite`), dont une
  grande part de **compilation paresseuse** V8 (trace : `V8.CompileCode` ~1,6 s sur le fil
  principal avant 5 s, 3 169 fonctions compilées à leur premier appel) ;
- 3,0 s : l'écran est monté (squelette) ; ses lectures partent ;
- puis les réponses arrivent une par une et chacune refait un rendu de `Comptabilite`
  (~250 ms au téléphone) ;
- **« prêt » = le PLAFOND** (`AttenteEcran`, ~2,5 s après le montage, retardé par les tâches
  longues) : sur cette base, les données essentielles `notifs` et `carte` n'arrivent qu'à
  8,5 s et 12,6 s (la carte attend `vrm_benefice_jours`, publié quand Leboncoin/eBay sont
  lus, ~12 s). Mesuré sans plafond (build d'essai, plafond 60 s) : Ma journée complète à
  12,7 s.

### Les 10 plus gros postes (avant, CPU ×4, du chargement au calme ; temps inclusifs)
| # | poste | coût mesuré | suite donnée |
|---|---|---|---|
| 1 | Rendus de `Comptabilite` (13 avant « prêt ») | 3,2 s | réduit (2, 5, 6) → 1,75 s |
| 2 | **La Tournée** de Ma journée, retirée de l'écran le 1er nov. (`TOURNEE_SUR_JOURNEE = false`) mais encore CALCULÉE à chaque rendu : toutes les cartes de Colis (`cartesColis`), les points, les étapes — résultat jeté | ~1,0 s (dont `cartesColis` 0,76 s) | **retiré** |
| 3 | Premier rendu (montage, compilation paresseuse du morceau App) | tâche de 1,2 s | pas touché (voir §4) |
| 4 | Téléchargement + évaluation du morceau App (2,6 Mo) | ~1,3 s + 0,6 s | pas touché (voir §4) |
| 5 | Écriture du cache des ventes (`sessionStorage` `vrm_acct_cache`, ~1,5 Mo : `JSON.stringify` + `setItem`) pendant l'ouverture | 0,53 s | **déplacé** hors de l'ouverture |
| 6 | `achatDuColis` / `suivisAchat` / `entreeIndexAchat` : chaque colis relisait tous les achats et leurs n° | ~0,8 s | **indexé** |
| 7 | Recalculs de style (feuille App de 1,08 Mo : 9 651 règles, 280 `:has`) | 1,1 s + 0,16 s d'analyse | pas touché (chantier style en cours, consigne) |
| 8 | Enveloppes de `fetch` (partage, garde d'écriture, filtre des comptes supprimés, mémo) | ~0,3 s | pas touché |
| 9 | Formats de date refaits à chaque appel : `dateJourFr` (`toLocaleDateString` ×2), `murParis`, `dateParis` | 0,23 + 0,07 s | **créés une fois** |
| 10 | Mesures de mise en page : `UneLigne` (`vider`/`tient`) 0,22 s, `CarteMois.ajuste` 0,15 s | 0,37 s | pas touché (mesures utiles, coût = la mise en page elle-même) |

## 2. Ce qui a changé
1. **La Tournée cachée n'est plus calculée** (`App.jsx`, `const tournee` : `if (!TOURNEE_SUR_JOURNEE) return null`).
   Rien ne l'affichait (le build la gardait seulement parce que l'appel pouvait avoir des
   effets ; il n'en a aucun : `lignesLot`, `cartesColis`, `colonnesColis`, `pointsARetirer`,
   `etapesTournee`, `arretsTournee` sont des calculs). Si Julien redemande la Tournée,
   repasser le drapeau à `true` suffit.
2. **`achatDuColis` et `suivisAchat` indexés pour UN calcul synchrone** (`src/liensColis.js`,
   la règle de `memoRendu` : vidé à la microtâche suivante). Même règle : la boucle d'origine
   reste (`achatDuColisCalc`) et sert de référence ; l'index rend les MÊMES candidats (clé
   « compte:transaction », le dernier gagne comme `Map.set`, deux achats ⇒ personne).
   Preuve : `scripts/tests/liens-colis-memo.test.mjs` (3 000 colis au hasard sur des achats
   piégés — même transaction sur deux comptes, même n° sur deux achats, entrée d'un autre
   compte, n° écrits autrement — identiques à la boucle ; copie rendue ; jamais un résultat
   d'avant une modification). Les mutations d'`audit-suivi-colis` portent toujours (la règle
   vit dans `suivisAchatCalc`/`entreeIndexAchat`).
3. **Le cache des ventes s'écrit hors de l'ouverture** (`_persistAcctCacheBientot`) : quand
   la page est quittée ou cachée (`pagehide`, `visibilitychange` → caché : rechargement,
   autre onglet, iPhone qui la met de côté), sinon ~15 s plus tard quand le navigateur est
   libre (`requestIdleCallback`, 5 s au plus). Un EFFACEMENT reste écrit tout de suite. Le
   cache ne sert qu'au rechargement de cet onglet : une écriture perdue relit la base.
4. **Formats de date créés une fois** : `dateJourFr` (App.jsx), `murParis` et `dateParis`
   (`api/_lib/bilan-semaine.js`, aussi utilisé par le serveur). Même texte : vérifié sur
   2 503 instants de 2025-2026 (`dateParis`) et sur les jours/mois (`dateJourFr`) ;
   `audit-bilan-semaine` 50/50.
5. Photos Vinted `decoding="async"` (décodées hors du fil qui dessine).

## 3. Mesures (après)
RÉSULTATS_AB

## 4. Ce qui reste — et pourquoi « < 3 s » n'est pas atteint
- **« Prêt » vaut aujourd'hui « montage + plafond »** : tant qu'une donnée essentielle
  manque, l'écran attend ~2,5 s après son montage (règle d'`AttenteEcran`, demande de Julien
  du 6 nov. : « de vrais écrans de chargement »). Sur ce profil, le montage arrive à ~3 s et
  `carte`/`notifs` bien après le plafond ; Ma journée ne peut donc pas être « prête » avant
  ~5,5 s sans (a) changer ce plafond — une décision de Julien, pas prise ici — ou (b) que la
  carte et les notifications soient là plus tôt : la carte attend `vrm_benefice_jours`, qui
  attend que Leboncoin ET eBay soient lus (~12 s ici). Piste : publier/afficher la carte
  depuis la dernière publication rangée (elle est synchronisée) et la compléter en place.
- **Le premier rendu (1,2 s) et le morceau App (2,6 Mo)** : la compilation paresseuse de
  milliers de fonctions au premier appel. Remèdes : sortir de `App.jsx` ce que Ma journée
  n'utilise pas (passation générale §2.1, `scripts/decouper-app.cjs`) ; `Comptabilite` EST
  Ma journée (`only='journee'`), le découper ne sert que si la section journée devient un
  composant à part.
- **Le nombre de rendus** : chaque réponse de la base refait un rendu de `Comptabilite`
  (13 à 17 avant « prêt »). Regrouper les arrivées (un seul état « données de départ ») ou
  rendre la section journée mémorisable diviserait ce poste.
- **La feuille de style** (1,08 Mo, 280 `:has`) : à reprendre après le chantier style.
- Le service worker met déjà les morceaux `/assets/` en cache d'abord (`public/sw.js`) ;
  les écrans paresseux sont déjà des morceaux à part.

## 5. Preuves
PREUVES

## 6. Geste de Julien
Aucun.
