# 6 nov. — Vague 2, point 9 : « vitesse » (fiches de page et commandes)

Branche locale `v36-vague2-vitesse` (depuis `claude/project-review-nsk5su`, 162659a6).
Point 9 de `2026-11-05-ameliorations-vague-2.md`. Rien poussé, extension non touchée.

## Ce qui a été mesuré sur sa base (lecture seule, SELECT de tailles, rien copié)

| ligne | avant | ce qui sert vraiment |
|---|---|---|
| `vinted_item_details` | 281 fiches, **349 Ko** de texte (photos 278 Ko, descriptions 27 Ko), lue **entière** (`select=data`) à 3 endroits | les fiches des **49** annonces en ligne (42 existent) : **~79 Ko** |
| famille `harvest_*_orders_*` | **2,11 Mo** lus en `select=id,data` au démarrage, pour tous les comptes | ventes + achats des 9 comptes liés : **1,68 Mo** (appareil connu), 1,85 Mo (appareil neuf) |
| dont `orders_bought` | 6 lignes, 253 Ko — jamais lues par l'app (`fetchHarvestOrders` ne prend que `sold`/`purchased`) | 0 |
| dont anciens comptes | 5 comptes plus dans `vinted_accounts` : ventes 75 Ko + achats 99 Ko | 0 (sauf « Tout sur le N° » et « Le prix qui marche », voir plus bas) |
| dont `wreq_*_orders_*` | 6 petites lignes (1,5 Ko) attrapées par le motif | 0 |

Aux deux lieux de la consigne s'en ajoutaient deux autres, plus lourds : le
préchargement du démarrage (`prechargerDemarrage`, lu à CHAQUE ouverture d'écran)
et la lecture par compte (`fetchHarvestOrdersBrut`).

## Ce qui a changé (src/App.jsx seulement côté app)

1. **`lireFichesPage(ids, lire?)`** : une fiche par clé, `select=f0:data->"<id>",…`
   (la clé ENTRE GUILLEMETS : un nombre nu est un rang de tableau chez PostgREST,
   et au-delà de 2³¹ un 400 — mesuré le 28 oct., `scripts/_chemin-json.cjs`), par lots
   de 3 500 caractères de `select=` (~120 fiches ; ses 49 tiennent en une lecture).
   Un lot raté ⇒ `null` (« pas su »), jamais `{}` présenté comme « aucune fiche ».
   - Annonces (`fetchDescLens(ids)`) : seules les annonces de la liste ; retenues par
     annonce pour la session (une lecture ratée n'est PAS retenue, avant elle l'était
     pour toute la session sous forme de `{}`).
   - Vendre sur eBay (`useEbayPaires`) : seules les paires retenues (même sélection,
     faite d'abord, puis la lecture, puis la construction — ordre et règles inchangés).
   - Leboncoin (`LeboncoinScreen`) : seules les annonces en ligne numérotées (les
     seules qui passent par `itemFileLbc`), lues par `lireBaseRelue` comme avant.
   - eBay, « chercher les photos » d'UNE paire : plus de repli sur la ligne entière ;
     base muette ⇒ « la base ne répond pas » (avant : « Vinted n'a rendu aucune photo »).
2. **Commandes** : `SEL_COMMANDES` = `id,updated_at,cap:data->>capturedAt,supprime:data->supprime,payload:data->payload` ;
   `ligneCommandes` rebâtit `row.data` (ce que lisent `fetchHarvestOrders`, `harvestTs`,
   `ligneVideeParToi`) — exécutée par l'audit. Motif `harvest_{uid}_orders_*d` :
   `sold`/`purchased` finissent par « d », `bought` par « t ».
   - Préchargement : les comptes liés de la dernière lecture réussie de
     `vinted_accounts` sur cet appareil (`vrm_comptes_lies`, `{qui, uids}`, écrit par
     `fetchVintedAccounts`) ⇒ `id=in.(…sold,…purchased)` ; sinon `id=like.harvest_*_orders_*d`.
     ⚠️ Ce n'est qu'un indice de quoi précharger, jamais une décision : un compte lié
     depuis est relu à part, un compte retiré n'est jamais servi, et une réponse
     VIDE (§4.1) fait relire chaque compte à part.
   - Lecture par compte : `id=like.harvest_{uid}_orders_*d`, projetée.
   - Recherche globale (`gsData`) : `id=in.(comptes cherchés)` + `mo:data->payload->my_orders`,
     vide ⇒ relue par motif puis filtrée comme avant ; liste des comptes pas lue ⇒ tous.
   - « Tout sur le N° » (`numData`) et « Le prix qui marche » (`pqmData`) : PROJETÉS
     mais **tous les comptes, exprès** — rien n'y filtre les ventes par compte, une
     vente d'un ancien compte y apparaît aujourd'hui ; la restreindre changerait l'écran.
3. `api/*.js` : vérifiés — aucune lecture entière de ces lignes (widget, ship-reminders,
   suivi-vinted lisent déjà `data->payload->my_orders` / `resume`).

## Preuves

**Banc `vitesse`** (base inventée au poids réel, `_base-volume.cjs` option `volumeReel`,
désormais par défaut ; BANC_PORT 9551 avant / 9552 après ; même banc copié dans l'arbre
d'avant, `git archive 162659a6`). Octets lus par écran, téléphone 390 px (1512 px : mêmes
octets, lectures 72–96 identiques avant/après) :

| écran | lectures | total | fiches de page | commandes | lignes entières | lignes jamais montrées |
|---|---|---|---|---|---|---|
| Ma journée | 79 → 77 | 3 505 → 2 798 Ko | 363 → 108 Ko | 2 432 → 1 981 Ko | 2 → 0 | 559 → 108 Ko |
| Ma journée, appareil neuf | 77 → 77 | 3 505 → 2 987 Ko | 363 → 108 Ko | 2 432 → 2 170 Ko | 2 → 0 | 559 → 297 Ko |
| Ventes | 84 → 84 | 3 509 → 2 802 Ko | 363 → 108 Ko | 2 432 → 1 981 Ko | 2 → 0 | 559 → 108 Ko |
| Annonces | 74 → 74 | 3 525 → 2 818 Ko | 363 → 108 Ko | 2 432 → 1 981 Ko | 2 → 0 | 559 → 108 Ko |
| Achats | 102 → 102 | 3 543 → 2 836 Ko | 363 → 108 Ko | 2 432 → 1 981 Ko | 2 → 0 | 559 → 108 Ko |
| Colis (bordereaux) | 93 → 92 | 3 600 → 2 893 Ko | 363 → 108 Ko | 2 432 → 1 981 Ko | 2 → 0 | 559 → 108 Ko |
| Messages | 75 → 75 | 4 002 → 3 295 Ko | 363 → 108 Ko | 2 432 → 1 981 Ko | 2 → 0 | 559 → 108 Ko |
| Tableau de bord | 71 → 71 | 3 247 → 2 795 Ko | 0 → 0 | 2 432 → 1 981 Ko | 1 → 0 | 559 → 108 Ko |

≈ **−700 Ko par écran ouvert** au banc (−20 %), sans lecture de plus. Sur sa base :
fiches 349 → ~79 Ko, commandes du démarrage 2,11 → 1,68 Mo.
Les 108 Ko « jamais montrés » qui restent ne viennent PAS de la lecture des commandes
(contrôle à 0) : c'est la cloche « où ranger » (voir plus bas).

Contrôles nouveaux du banc, ROUGES sur 162659a6 et verts après : aucune lecture entière
de ces lignes ; au plus la moitié de `vinted_item_details` ; la lecture des commandes ne
rapporte aucune ligne jamais montrée (appareil connu) ; Ma journée « appareil neuf » au
même texte.

**Texte rendu identique** (`VITESSE_TEXTES` / `VITESSE_REFERENCE`) sur Ma journée,
Ventes, Annonces, Achats, Colis, Messages, tableau de bord, aux deux tailles. ⚠️ À
1512 px, Achats et Messages ont d'abord différé : le BUILD D'AVANT lui-même rend deux
textes selon la course (la numérotation automatique des 84 annonces sans N° part de
N°78 ou de N°368, et « 14 numéros portés par deux articles » paraît ou non) — relancé,
l'avant rend exactement le texte de l'après. Défaut d'avant, pas de ce chantier.

**Audit `scripts/audit-lectures-lourdes.cjs`** (`--prouve`) : `src/` et `api/`, sans
commentaires, constantes `select=${…}` résolues ; ROUGE sur 162659a6 (10 lectures
entières : 1917, 4711, 5782, 23023, 23808, 62461, 68673, 68675, 68725, 69026), vert après,
et ROUGE sous chacune des 5 mutations (lecture par compte, constante, fiches, prix qui
marche, `ligneCommandes` sans la marque « vidée »).

`npm run build` ; `audit-lectures-partagees`, `audit-coherence`, `audit-identite`,
`audit-fonctions-api` : verts. `scripts/tests/relectures-interface-source.test.mjs` : vert.

**Bancs touchés pour servir la vraie forme (§6.3)** : `->"<id>"` est une CLÉ dans
`_minipgrest`, `_base-ecritures`, `_base-volume` et 14 bancs à projection locale ;
`_meta.cjs` gagne `fichesDePage` (ebay-form, ebay-un-clic rendaient `[{data}]` quel que
soit le `select=`). `ligneCommandes` lit telle quelle une ligne rendue entière (une
fausse base qui ne projette pas).

## Rouges du banc qui existaient AVANT (non traités ici)

Plafonds de lectures dépassés (journée 73–79 pour 62, Annonces 72–74 pour 66, Achats
96–102 pour 78…), `utile` et « héros » de Ma journée (`data-vendu-mois` n'est plus rendu
par l'écran actuel), un rendu sur le second signal `vrm:colis`, rendus au démarrage
16–20 pour 13, 3 balayages des transactions sur Colis/tableau de bord. Mêmes valeurs avant et après.

## Ce qui reste

- **La cloche « où ranger »** (`calculerOuRanger`) relit à chaque écran les achats de
  TOUS les comptes (projetés) : ~100 Ko d'anciens comptes au banc. Il lui faut la liste
  des comptes (elle n'en a pas) ; idem `lireAchatsRegistre`, `sourcesExportDonnees`.
- **Les annonces** `harvest_*_listings` sont encore lues en `select=id,data` (recherche,
  « Tout sur le N° », Leboncoin, prix qui marche) : 298 Ko sur sa base, dont 47 Ko
  d'anciens comptes. Hors de ce chantier.
- **L'extension** (`background.js`) lit et réécrit `vinted_item_details` entière (elle
  la fusionne) : pas touchée (consigne). Un changement là demande une nouvelle version.
- Les plafonds du banc `vitesse` ne sont plus ceux du 29 oct. : à remesurer et reposer
  dans un chantier à part.
