# 16 nov. 2026 — Vitesse à 20 000 ventes (lot `vitesse-volume`)

Branche `claude/vitesse-volume`. Mission (13) : à 20 000 ventes, Ma journée ~12 s, Ventes ~14 s ; objectif
< 2 s après chargement des données. Ajout de Julien (par le coordinateur) : un garde-fou PERMANENT dans la CI
qui rougit si Ma journée ou Ventes dépasse 2 s après les données, prouvé rouge sur main d'avant.

## ÉTAT À LA REPRISE

- **Objectif < 2 s : PAS ATTEINT.** Gain mesuré en CI : **−26 % Ma journée, −24 % Ventes** (calcul, réseau mis à
  part). Il reste ~17–18 s de calcul à 20 000 ventes sur la machine de CI (processeur ×4).
- **Le garde-fou existe** (`scripts/bancs/volume-budget.cjs`, `scripts/budget-volume.json`, CI : « Bancs principaux
  part 3 ») et il est **rouge sur main ET sur cette branche** — c'est la vérité : 2 s ne sont pas tenues.
- **PR ouverte, NON fusionnée** : la règle de Julien du 16 nov. est « zéro rouge pour fusionner » ; ce banc est rouge
  (voulu, il dit le vrai), et main porte déjà des rouges dans les jobs touchés (audits parts 1–3, bancs part 1 et 3 :
  `colis-retirer-propre`, notifications groupées…, hors de ce lot).
- Deux branches de MESURE à ne jamais fusionner : `claude/vitesse-volume-preuve` (main + le banc seul) et
  `claude/vitesse-volume-mesure` (cette branche, CI réduite au banc). Elles peuvent être supprimées.
- Décision à prendre (Julien / coordinateur) : (a) fusionner les accélérations SANS le banc (ou banc non bloquant
  jusqu'à ce qu'il passe), (b) garder le banc à 2 s bloquant — alors plus rien ne fusionne tant que l'architecture
  (§4) n'est pas faite, (c) poser le budget au niveau atteint (~18 s + marge) comme anti-régression, et 2 s comme
  objectif écrit.

## 1. Ce que veut dire « après les données » — trois mesures, une seule honnête

Le banc d'avant (`vitesse-volume.cjs`, `_mesure-demarrage.cjs`) mesurait « prêt » (`data-attente`), qui tombe au
PLAFOND (~2,5 s d'attente) : ~12 s, dont ~5 s de JS et ~7 s de réseau (8 Mo lus en 4G simulée). Ce n'est pas un
temps de calcul.

Essayé puis écarté : `apresDonnees_ms` = écran complet − arrivée de la dernière lecture. **Main passe déjà** (CI :
Ma journée 0,8 s, Ventes 0,45 s) : la dernière lecture essentielle arrive tard PARCE QUE le processeur est saturé
(les lectures de fond partent au compte-gouttes entre deux rendus) ; le chiffre ne voit pas le problème. Un banc qui
ne peut pas rougir sur le code lent ne sert à rien (§6.1).

Retenu : **`donnees_ms` avec `RESEAU=libre`** — ni débit ni délai simulés (le réseau de la personne n'est pas le
sujet) ; de la PREMIÈRE lecture de la base à l'écran COMPLET (toutes ses données essentielles, `COMPLET=1`). C'est
le temps que l'app passe à demander, recevoir, calculer et rendre ses données. Processeur ×4, 390 px tactile,
20 000 ventes inventées (`_base-volume`). Médiane de 3 ouvertures. Une ouverture pas complète n'est jamais un feu
vert (« pas su »).

## 2. Mesures (CI GitHub, machine non partagée — la machine des sessions était à une charge de 40 à 60)

| | main d'avant (5a9abe571 + banc seul) | cette branche (c52b747cc ; relance f6a54aa11 : 19,2 s / 22,7 s, autre machine) |
|---|---|---|
| Ma journée, `donnees_ms` (3 passes) | 23 596 · 23 479 · 24 528 ⇒ **23,6 s** | 18 831 · 17 439 · 17 441 ⇒ **17,4 s** |
| Ventes, `donnees_ms` | 22 724 · 24 300 · 25 904 ⇒ **24,3 s** | 18 278 · 18 513 · 18 767 ⇒ **18,5 s** |
| tâches longues Ma journée | 22,3 – 24,1 s | 15,8 – 17,4 s |
| tâches longues Ventes | 22,6 – 25,8 s | 18,2 – 18,5 s |
| verdict du banc (2 000 + 750 ms) | ❌ rouge (les deux écrans) | ❌ rouge (les deux écrans) |

Avec le réseau 4G simulé (mesure d'avant), même CI : complet Ma journée 28,0 s (main) → 25,5 s ; Ventes 23,5 → 21,9 s.
Les derniers commits (dates, tri, `tsVenteADater`) sont postérieurs à la colonne de droite : la
relance CI est dans la PR.

## 3. Ce qui a changé (aucune règle métier, aucun chiffre)

Profil processeur (build non minifié, `PROFIL=`) : le moteur `Comptabilite` se rend 20 à 60 fois pendant
l'ouverture et chaque rendu refait des parcours des 20 000 ventes. Corrigé là où la réponse est PROUVÉE identique :

- `aExpedier` et `venteSortieDuStock` : gardées par vente (identité de l'objet — une commande lue n'est jamais modifiée
  en place, vérifié) tant que `TXN_ETATS` ne change pas (`TXN_ETATS.ver`, monté par `noterEtatsTxn`, seul écrivain).
- `tsCommande`, `msDateCommande` (nouvelle, `new Date(o.date).getTime()`), `tsVenteADater` (src/aDaterAnnee.js) :
  gardées par objet. Mêmes formules, NaN compris. La copie serveur `api/_lib/ventes-regle.js` refabriquée
  (`audit-bilan-semaine --recopie`).
- Tri des commandes par date (`triCommandesRecentes`) : le MÊME comparateur, chaque date lue une fois par tri au lieu
  de deux fois par comparaison (~600 000 dates construites par tri à 20 000 ventes). Tri stable, NaN ⇒ égalité : même
  ordre.
- `numFromTxn` : son index était rangé SUR la fonction, redéclarée à chaque rendu ⇒ refait à chaque rendu. Gardé
  par liste (WeakMap du module).
- `cartesColis`, `colisAEnvoyerBase`, `listeEnvoyes` : **une réponse par rendu** (`unParRendu`, src/lotRendus.js) —
  demandées jusqu'à 5 fois par rendu. Seulement PENDANT un rendu (détecté par le distributeur de crochets de React) :
  un geste ou un effet recalcule toujours.
- `listeEnvoyes` : la preuve de départ (`partisVinted`, une lecture de table) jugée avant `aExpedier`.
- Retirés après la CI (audits qui lisent la règle telle qu'écrite : `audit-coherence`, `audit-a-envoyer-preuves`) : la
  mémoire de `needsBordereau` et `expeditions` en un passage — gain faible, la règle reste écrite comme avant.

Essayé et RETIRÉ : rendre par lots les mises à jour d'état du moteur (`useStateLot`, file + compteur de lectures en
vol). Mesuré : 24 rendus avant comme après sur Ventes — les rendus ne viennent pas de là (magasin partagé, coque,
crochets propres). Rien n'en reste dans le code.

## 4. Pourquoi 2 s ne sont pas tenues, et ce qu'il faudrait

Après ces corrections, le profil reste étalé (aucune fonction > 10 %) : c'est le NOMBRE de rendus du moteur
(20 à 40 par écran, ×3 instances sur Achats) × le coût d'un rendu (~0,4–0,8 s à ×4 pour 20 000 ventes). Les lectures
de fond (txn, suivis, e-mails) partent au fil des minuteries et chacune redéclenche un rendu complet.
Le levier qui manque est le « pas 4 » de `2026-11-13-source-unique.md` : les calculs dérivés (`totals`, `declarables`,
`pairesVendues`, `expeditions`, `cartesColis`…) hors du rendu, calculés UNE fois par version des données dans un
module partagé (ou un Web Worker), les écrans consommant le résultat ; et les lectures de fond regroupées. Plusieurs
jours de travail sur un composant de 23 000 lignes, avec le banc `chiffres-volume` à chaque pas.

## 5. Preuves

- `volume-budget` : **rouge sur main d'avant** (CI, run 43839058650 : 23,6 s / 24,3 s) — et rouge sur la branche.
- Chiffres identiques : `chiffres-volume` + `compare-chiffres-volume` (voir la PR : relevés en CI sur les deux arbres,
  la machine des sessions ne finissait pas les écrans à cette charge).
- Audits qui extraient ces règles : `audit-statuts`, `audit-dac7-comptes`, `audit-onglets-d`,
  `audit-transporteur-connu` verts (ils ont fait rendre les mémoires autonomes : `fn.memo` comme
  `classifyOrderStatus`).
- ⚠️ Incident : un `pkill -f _mesure-demarrage.cjs` lancé ici a pu couper une mesure d'un autre agent sur la machine
  partagée (16 nov. ~8 h 30 UTC).

## 6. Fichiers

`src/App.jsx`, `src/lotRendus.js` (neuf), `src/aDaterAnnee.js`, `scripts/bancs/_mesure-demarrage.cjs` (`RESEAU=libre`,
`COMPLET_MAX_MS`, `apresDonnees_ms`, `donnees_ms`), `scripts/bancs/vitesse-volume.cjs` (médianes des deux),
`scripts/bancs/volume-budget.cjs` + `scripts/budget-volume.json` (neufs), `scripts/bancs/chiffres-volume.cjs`
(navigation 240 s), `scripts/lancer-bancs.cjs`, `.github/workflows/verifier.yml` (part 3).
`scripts/budget-vitesse.json` non touché (autre agent).
