# Paires qui dorment → plan du matin (24 nov. 2026, `claude/paires-dorment`)

Julien l'a choisi le 24 nov. (« Plan des paires qui dorment », RETENU le 11 oct.) : chaque matin, les paires en ligne
depuis longtemps avec peu de vues ou de favoris, et pour CHACUNE une action proposée sur ses vrais chiffres. Il valide
d'un toucher ; rien ne part tout seul.

Base de la branche : `origin/main` + `claude/style-clair` (#1326) + `claude/conseiller-ia` (#1318, qui contient #1316).
Le plan vit DANS le Conseiller (groupe « Plan du matin », colonne « pour gagner plus ») : pas d'écran neuf.

## 1. La mesure (base réelle, lecture seule, comptes et quantiles seulement)

Lignes `harvest_{uid}_listings` (683 annonces lues, 3 vendeurs avec des annonces en ligne). Annonce en ligne = ni
fermée, ni brouillon, ni masquée, sans `item_closing_action`. Âge = la date de la photo (`photo.high_resolution.timestamp`,
la même source que `createdTs` de `mapWardrobeItem`), `created_at_ts` n'est jamais présent.

Le vendeur aux 9 comptes (68 annonces en ligne, 67 datées) :

| âge | annonces | vues / jour (q1 · médiane · q3) | favoris (médiane) | favoris = 0 |
|---|---|---|---|---|
| < 7 j | 32 | 4,3 · 9,9 · 19,8 | 7,5 | 4 |
| 7–14 j | 13 | 0,65 · 2,0 · 6,5 | 5 | 1 |
| 14–21 j | 20 | 1,3 · 2,9 · 6,6 | 8 | 2 |
| ≥ 21 j | 2 | — | 19,5 | 0 |

Ce que ça veut dire :
- **Ses annonces sont jeunes** (il republie) : médiane 10 j, 90 % sous 17 j, **une seule à 30 j**. La règle « 30 jours »
  de la liste « Qui dorment » d'Annonces ne lui montre presque rien.
- **Les vues s'effondrent après la première semaine** (~10/j → ~2-3/j) puis restent à ce plateau ⇒ à **14 jours** une
  annonce « a eu sa chance » (`AGE_MIN_J = 14`, c'est aussi l'écart minimal entre deux baisses, `ECART_J`).
- Les favoris sont presque toujours là (7 annonces sur 67 à zéro) ⇒ « des favoris, pas de vente » est le cas courant.
- Aucun nombre fixe ne tient pour tous les vendeurs (les deux autres ont des annonces de 90 j à plusieurs années, à
  0,5-1 vue/j) ⇒ **« peu » = le QUART LE PLUS BAS de SES annonces de 14 j et plus**, recalculé chaque matin (vues par
  jour, favoris par jour). Moins de 8 annonces comparables ⇒ pas de plan (« pas assez de recul »), jamais un seuil deviné.
- **Effet attendu** : aucune source datée « geste ⇒ vente » en base (ni `vinted_prix_historique`, ni `vrm_prix_lus`, ni
  journal de republication relié aux ventes : seules 2 lignes `journal_vrm_*` de 5 entrées). Donc **aucune promesse
  affichée** ; « Pourquoi ? » le dit.
- Constat à part (pas corrigé, hors du lot) : `vinted_listing_dates` est rangé `{ id: nombre }` (150 clés) alors que
  `listedAgeDays` / `dateMiseEnLigneMs` lisent `d.ts` ⇒ cette source de date n'est jamais lue ; seule la date de la photo
  sert. À regarder par le lot qui possède cette ligne.

## 2. La règle (src/conseiller/planDorment.js, PURE)

- **Identité** : compte Vinted + identifiant d'annonce (chiffres). Sans identifiant lisible ⇒ hors du plan ; doublons
  fusionnés ; le titre ne sort jamais du plan.
- **États** : `jeune` (< 14 j) · `passu` (âge, vues ou favoris pas lus — Vinted rend 0 vue ⇒ `null`) · `dort` (vues/j ≤ q1
  OU favoris/j ≤ q1) · `eveillee`. Une ligne `passu` n'entre dans AUCUN quartile ni dans le plan ; elle est comptée à part.
- **UNE action par paire** (la première non bloquée ; toutes bloquées ⇒ la première, avec sa raison) :
  - peu vue ⇒ **Republier** (l'atelier dans le panneau, `republier-direct`), sinon **un autre de ses sites** où elle n'est
    PAS (lu : marque « publiée sur Leboncoin », SKU eBay, N° Vestiaire ; pas lu ⇒ pas proposé) ;
  - des favoris sans vente ⇒ **Offre aux favoris** (panneau, page favoris, 15/h) ; bloqué ⇒ la baisse si elle existe ;
  - vue sans favori ⇒ **Baisser à X €** si la baisse existe, sinon **Revoir prix et photos** (Republier « changer »,
    c'est lui qui tape).
- **La baisse** garde les bornes du 12 nov. (« pas abusif », src/conseilPrix.js) : en ligne ≥ 30 j, ≤ −10 %, pas dans les
  14 j d'une baisse lue, prix d'achat saisi obligatoire, jamais sous le plus haut de (achat + 10 %), (achat + frais connus,
  `plancherVente`), (SON prix mini posé à côté du N°). « Baisses irrégulières » : le pourcentage est tiré de l'identifiant
  entre 6 et 10 % (au centième ; stable pour une paire, différent d'une paire à l'autre), arrondi au dixième d'euro
  au-dessus. Moins d'1 € de marge sous le prix ⇒ aucune baisse.
- 8 paires au plus, triées de la moins vue par jour à la plus vue (puis favoris/j, puis l'âge, puis l'identité).

## 3. Le chemin

- **Annonces publie** (`src/ecrans/Comptabilite.jsx`, `planMatin`, sur `annBase` = la règle « en ligne ») le plan dans
  `vrm_plan_dorment` (localStorage, par compte VRM, daté ; `src/conseiller/publications.js publierPlan`). Aucun prix
  d'achat ni plancher publié. Trois lectures portent maintenant leur état (`lbcPostedLu`, `ebayNumsLu`, `vcNumsLu`) :
  avant, un Set vide voulait dire à la fois « pas lu » et « nulle part ».
- **Le Conseiller lit** (`sources.js`, < 24 h) et montre `PlanDuMatin` (src/conseiller/PlanDorment.jsx) ; le compte
  « N paires dorment » se tait quand le plan a des lignes (une notion, un endroit).
- **Le toucher** (`src/conseiller/planGestes.js agirPlan`) ouvre le chemin gardé EXISTANT, le même que `allerDormante`
  d'Annonces : le panneau de l'extension sur CETTE annonce (compte de l'onglet, `garde`, 45/h, frein) ; eBay ⇒ l'écran eBay
  de VRM (`DEMANDE_EBAY_PAIRE`). ⚠️ Le panneau ne reçoit pas le prix proposé (`lienPanneau` ne porte que page / ids /
  action, comme la liste « Qui dorment ») : il retape ou valide la proposition du panneau.
- **« Agir seulement si l'extension est connectée sur ce compte »** : `peutAgir` (`claude/agir-si-connecte`) n'est pas
  fusionné. `Branche.jsx` prend `src/agir/porte.js` par `import.meta.glob` (eager) : dès que la porte est dans l'arbre, chaque
  bouton Vinted lit `agirMaintenant('vinted', compte, geste)` et s'éteint avec SA raison ; sans elle, le panneau de
  l'extension n'agit qu'au nom du compte de son onglet. Un bouton dont la capacité manque à l'extension est éteint
  (« Mets l'extension à jour d'abord. »).

## 4. Visuel

Composants natifs (Groupe, Rangee, Vignette, Plaque, Bouton teinte + icône), gris clair, accent rare, **aucun orange**,
« Pourquoi ? » déplie les seuils (les nombres du jour), l'âge mesuré, les actions et « aucun effet promis ». `TuilePaire`
/ `CarteQuete` (`claude/visuel-jeu`, #1355) ne sont pas fusionnées : à brancher quand elles le seront. Textes : `tr()`,
clés `cplan.cp*` écrites en entier (une clé lue par préfixe ou suffixe part au démarrage), 5 langues.

## 5. Preuves

- `node scripts/audit-plan-dorment.cjs --prouve` : 46 contrôles verts ; 16 mutations (pas su compté, plancher retiré,
  achat inconnu, prix mini ignoré, identité, doublons, plafond, 14 j, même %, 30 j, seuil fixe, recul, jeunes, site pas su,
  geste sur plusieurs annonces, porte ignorée) rougissent chacune ; **rouge sur `origin/main`** (git archive, 12 rouges).
- `scripts/bancs/plan-dorment.cjs` (390 tactile et 1512, clair et sombre ; bases lu / peu / vide) : voir le récit du
  banc ci-dessous ; captures regardées.
- Build vert ; audits voisins verts : actions-app, baisse-conseillee, baisse-prix, conseil-mesure, conseiller,
  conseiller-ia, conseils, dormantes, icones, pluriels-croises, qui-dorment, republier*, vendre-plus, traduction,
  textes-courts, quoi-de-neuf. **Rouges hérités de la base (pas de ce lot, vérifié en retirant les ajouts)** :
  `audit-francais-differe` (part du démarrage 80,0 Ko pour 80) et `audit-republier-question` §6 (bloc d'extension).

## 6. Ce qui reste

- Brancher `TuilePaire` quand #1355 sera fusionnée ; la porte se branche seule à la fusion de `agir-si-connecte`.
- Mesurer l'effet (baisse ⇒ vente sous N jours) quand un historique daté existera ; alors seulement afficher une promesse.
- Passer le prix proposé au panneau (paramètre `prix` de `lienPanneau`, côté extension).
- Geste de Julien : aucun.
