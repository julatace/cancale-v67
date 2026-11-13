# 13 nov. — Moteur-compta (second agent, branche `claude/agent2-moteur-compta`)

Partie de `claude/agent2-vitesse-volume` (8fd24494e), `origin/main` fusionné (vrai merge) au début et à la fin.
But demandé : Ma journée / Ventes / Achats prêts en < 2 s à 20 000 ventes, sans changer un chiffre.
**Objectif non atteint.** Ce qui suit dit ce qui a été mesuré, ce qui est gardé, ce qui est retiré.

## 1. Ce qui a été mesuré (avant de coder)
- La première lecture de la base part à ~2,5 s (JS de 1,9 Mo en 4G, ×4) : « prêt < 2 s » est impossible
  tel quel, quel que soit le calcul.
- Ventes monte **2** `Comptabilite` (À expédier + la liste), Achats **3** (À retirer, ses outils, la liste) :
  chaque instance lit ses propres copies des ventes et refait tout. Comptés : `<Comptabilite` 7 fois dans
  App.jsx, `tab===` 41 — inchangés par ce lot.
- Journal des dépendances (instrumentation locale, non commitée) : `autresBenefice` changeait à **chaque**
  rendu, ~25 fois au chargement de Ma journée, et avec lui le bénéfice par jour, le relevé des ventes, les
  sources et les meilleures (4 effets qui parcourent les 20 000 ventes). Cause : `lbcItemsBenef` valait un
  `{}` NEUF à chaque rendu quand aucune annonce Leboncoin n'est à lire.
- Profil par fenêtre de temps : après l'arrivée des ventes, chaque rendu de Ma journée refait
  `listeEnvoyes` / `commandesAVerifier` / `cartesColis` sur les 20 000 ventes (étape de vente, `aExpedier`,
  `venteExpediee` qui reparcourt les bordereaux), alors que seules les 45 dernières jours comptent.

## 2. Gardé
1. **Un seul objet « aucune annonce Leboncoin »** (`LBC_AUCUNE_ANNONCE`, lu seulement) : `autresBenefice` ne
   change plus qu'avec ses vraies entrées (journal : il ne bouge plus aux rendus où rien ne change).
2. **La fenêtre des 45 jours d'abord** (`cartesColis` « Partis », `listeEnvoyes`) : même règle, trois filtres
   purs dans un autre ordre ; `aExpedier` et `venteStage` ne tournent plus sur les vieilles ventes.
3. **Trésorerie, Courbes par marque, Sourcing** : aucun bouton n'ouvre plus ces feuilles (`setShowTreasury(true)`
   n'est appelé que par `openTreasury`, jamais appelé ; les deux autres jamais) — leurs calculs ne tournent que
   feuille ouverte. `perf` seulement sur l'écran Ventes (seul lecteur). `audit-une-regle` garde son texte.
4. `compare-chiffres-volume` retire `data-photos-perdues` : c'est le bandeau des IMAGES que le navigateur du banc
   ne charge pas (il coupe les hôtes extérieurs) ; le MÊME build passé deux fois le pose sur Ventes (3) puis sur
   Ma journée (12). Pas un chiffre de VRM.

## 3. Retiré (pas prouvé)
- **Publications regroupées** (`useEffetPublication` : URSSAF du mois, bénéfice par jour, sources, meilleures,
  envois/vitesse lancés 1,2 s après le calme de leurs entrées). Chiffres 35/35 identiques, mais le gain n'est pas
  sorti du bruit de vitesse-volume et cela décalait les publications : retiré (commit « retire l'étape 2 »).
- (a) publieur sans écran et (b) écrans qui consomment au lieu de monter `Comptabilite` : **pas faits**. Chaque
  instance lit ses données elle-même ; un publieur dans AppCoeur ajouterait une instance de plus tant que les
  écrans gardent la leur. Il faut d'abord une source de données partagée (ventes, achats, N°, corrections) lue
  une fois, que les instances consomment — chantier à part, qui touche les ~300 états de `Comptabilite`.
- (d) regrouper les arrivées : pas fait. Les arrivées tardives dépendent les unes des autres (les ventes
  déclenchent la lecture des lots, des articles de transaction, la numérotation auto) ; les regrouper demande
  de changer l'ordre des lectures.

## 4. Preuves
- `chiffres-volume` + `compare-chiffres-volume`, deux builds passés à la suite dans la même heure :
  étapes 1 et 3 contre le build d'avant — **35/35 identiques à 20 000 ventes et sur la base par défaut**.
  Mutation : voir §6.
- `vitesse-volume` (médiane de 5, 390 tactile, ×4, 4G, builds alternés) : la machine change d'allure d'une
  heure à l'autre (le même build d'avant : Ma journée 12,0 s puis 8,0 s après le redémarrage du conteneur) et
  les écrans sont **bimodaux** (Achats : 7–9 s ou 15–20 s selon l'ordre d'arrivée). Résultats :
  - étape 1 contre avant : Ma journée 12,0 → 12,0 s (tâches longues 14,8 → 13,3 s), Ventes 15,2 → 14,8 s,
    Achats 17,4 → 8,2 s (tâches longues 17,7 → 6,0 s, plus longue 8,1 → 1,1 s) ;
  - fin (avec main fusionné) contre avant, au même moment : Ma journée 8,0 → 8,0 s, Ventes 8,3 → 12,2 s
    (passes 7,9–15,6 s : bimodal), Achats 9,5 → 9,2 s. **Aucun gain de médiane prouvé** sur la fin.
  - `_mesure-demarrage RENDUS=1` (fin) : rendus de `Comptabilite` avant prêt : Ma journée 15, Ventes 14,
    Achats 35 (trois instances).
- Audits verts après fusion : tdz, variables, coherence, identite, icones, bilan-semaine (54/0), une-regle,
  plans-solo-pro, numerotation-lecteurs, prix-achat-propose, bordereau-des-email, urssaf, flux-divers,
  achats-export, ce-qui-rapporte. `api/_lib/ventes-regle.js` non touché (aucune règle recopiée changée).
- `budget-vitesse.json` (lectures, octets, JS) : rien changé (ce lot ne touche aucune lecture).
- Captures : aucun rendu visible n'a changé (seules des feuilles injoignables et un calcul repoussé) ; les
  relevés de chiffres-volume (1512) couvrent les écrans.

## 5. Pour reprendre
- Le vrai levier : **une seule copie des données** pour toutes les instances de `Comptabilite` (Ventes en monte
  2, Achats 3). Puis seulement le publieur unique (a) et les écrans consommateurs (b).
- Mesurer avec `RENDUS=1` et un compteur d'exécutions plutôt qu'avec la médiane de « prêt » (bimodale).
- Outils locaux utilisés (scratchpad, non commités) : journal des dépendances par rendu, profil par fenêtre
  de temps (`.cpuprofile` découpé par 1,5 s).

## 6. Mutation et contrôle final
- Mutation (fenêtre « Partis » de `cartesColis` 45 → 20 j) contre le build final : **rouge** — 6 différences à
  20 000 ventes, 8 sur la base par défaut (compteurs de Colis dans Ventes, `vrm_stats_ventes`…).
- Build final (avec `origin/main` fusionné) contre le build d'avant : 20 000 ventes 35/35 ; base par défaut
  34/35 — la seule différence est `data-temps-reel-neuf=<heure>` sur Achats, attribut arrivé avec `main`
  (lot temps réel), une heure, pas un chiffre. Le build de l'étape 3 (avant fusion) : 35/35 sur les deux bases.

## 7. Gestes de Julien
Aucun.
