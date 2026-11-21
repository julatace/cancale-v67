# 11 nov. 2026 — Budget de vitesse : l'app ne peut plus redevenir lente sans qu'on le voie

Branche `claude/budget-vitesse` (depuis `origin/main` `fc3883d`). Aucune ligne de l'app
changée, aucune écriture en base, pas de PR (consigne de la session).

## Ce qui est livré
- **`scripts/bancs/budget-vitesse.cjs`** — un budget par écran principal (Ma journée,
  Ventes, Annonces, Achats, Stock, Messages, Argent, E-mails), à 390 px tactile,
  processeur NON ralenti (voir « Les pièges »), deux ouvertures : **appareil neuf** (rien de rangé, aucun compte lié
  retenu : c'est le démarrage) puis **2ᵉ ouverture** (le même onglet rechargé : ce que
  l'app a rangé elle-même est là). Mesures, aucune en millisecondes :
  `lectures` (GET de NOTRE base), `octets` lus, `doublons` (lectures identiques : le
  total ET adresse par adresse), `entieres` (lignes entières `select=data`, toujours 0),
  `js` (JS+CSS de l'app téléchargés, gzip, Ko — tout ce que l'ouverture de l'écran a
  téléchargé, morceaux à la demande compris).
- **`scripts/bancs/budget-vitesse.json`** — les budgets, et à côté de chacun la mesure
  d'où il vient (`*_mesure`), et le registre des relevés (`releves` : date, écrans, raison).
- **`scripts/bancs/vitesse.cjs` rendu réutilisable** (rien dupliqué) : `module.exports`
  (`ouvrir`, `bilan`, `demarrer`, `fermer`, `ECRANS`…) ; le serveur n'écoute qu'à la
  demande quand il est requis ; lancé seul, il fait exactement ce qu'il faisait. Options
  neuves de `ouvrir` : `deuxieme` (la 2ᵉ ouverture), `fenetre` (voir plus bas),
  `initScript` ; `bilan` rend aussi `doublonsCles`.
- CI : `.github/workflows/verifier.yml`, job « Bancs principaux », part 2 ;
  `scripts/lancer-bancs.cjs` (lot par défaut). README des bancs : une ligne.

## Le budget = le plus haut de 4 passages (2 processeur ×1, 2 ×4) + la marge
- lectures, octets : + 15 % (au moins +1 lecture, +8 Ko) ;
- js : + 10 % (`marge_js` ; le gzip d'un build ne dépend pas de la machine, au moins +2 Ko) ;
- doublons (total) : le plus haut + 1 ;
- **doublons adresse par adresse : sans marge** — `doublonsParAdresse` liste chaque adresse
  aujourd'hui lue plusieurs fois et son plus haut. Une adresse NEUVE lue en double, ou une
  adresse lue une fois de plus que son budget, est rouge. C'est ce contrôle qui attrape
  « une lecture en double ajoutée » (le total, lui, varie de ±1 selon l'ordre d'arrivée des
  réponses) ;
- entieres : 0, toujours (§4.4).

Un rouge dit l'écran, l'ouverture, la mesure, la valeur, le budget et de combien
(« Messages (appareil neuf) · lectures ≤ 140 — 152 — DÉPASSÉ de 12 (+9 %) », ou
« NOUVELLE lecture en double (×2) : app_data?id=eq.… »).

## Les pièges trouvés (ce qui rendait les comptes instables)
### 1. Le processeur émulé ×4
Le partage des lectures (`src/lecturesPartagees.js`) ne réunit deux lectures identiques
que si la seconde part < 2 s (`FENETRE_MS`) après la fin de la première : le nombre de
lectures en double dépend donc du TEMPS PROCESSEUR. Mesuré, même build : processeur ×4 sur
une machine chargée (4 bancs en parallèle, charge 15) ⇒ Ventes (2ᵉ ouverture) 16 → 21
lectures en double, Ma journée 2 adresses en double neuves (`lbc_ventes`,
`vc_ventes,vc_listings`) — `main` rouge sans une ligne changée. Le budget juge des COMPTES :
il tourne processeur non ralenti (le temps qui compte est celui du réseau simulé, 150 ms,
fixe). Les écarts entre passages tombent à 0–1 lecture (sauf Messages 2ᵉ : 105–113).
`VITESSE_CPU=4` le remet, pour comparer.
### 2. Le remesurage
Un écran hors budget est remesuré (jusqu'à 3 essais, `BUDGET_ESSAIS`) ; chaque mesure est
jugée sur son MEILLEUR essai, chaque adresse en double sur son plus petit nombre. Un défaut
ajouté est là à chaque essai (il reste rouge) ; un passage bruité ne l'est pas trois fois.
Une erreur de page est rouge dès qu'elle arrive ; un écran tombé ou jamais affiché ne
fournit aucune mesure (il lit MOINS : il passerait sous le budget).
### 3. La fenêtre d'observation
Premier relevé avec le « calme » de vitesse.cjs (3 s sans lecture) : **bimodal** —
Annonces 95 OU 111 lectures, Argent 100 OU 108, Messages (2ᵉ) 1 339 OU 2 599 Ko. Cause :
une vague de relectures part ~15 s après l'ouverture (lbc_*, vc_*, ebay_*, vinted_accounts,
harvest_*) ; le calme coupait tantôt juste avant (écart de 2,8 s à 3,1 s), tantôt après.
Le budget observe donc **au moins 25 s**, et ne compte rien de ce qui part **après 50 s**
(les relectures à la minute). Après : écarts de 0 à 4 lectures entre passages.
`BUDGET_AU_MOINS=ms` change le plancher (à ne pas baisser sous ~20 s).

## Budgets figés (main `2084be1` après fusion, base inventée au poids réel)
mesure (le plus haut des 4 passages) → **budget**
| écran | ouverture | lectures | octets | doublons | entières | JS+CSS |
|---|---|---|---|---|---|---|
| Ma journée | appareil neuf | 120 → **138** | 2721 → **3129** Ko | 22 → **23** (19 adr.) | 0 | 1538 → **1692** Ko |
| Ma journée | 2ᵉ ouverture | 114 → **132** | 287 → **330** Ko | 21 → **22** (18 adr.) | 0 | 1538 → **1692** Ko |
| Ventes | appareil neuf | 105 → **121** | 2681 → **3083** Ko | 21 → **22** (18 adr.) | 0 | 1534 → **1688** Ko |
| Ventes | 2ᵉ ouverture | 94 → **109** | 355 → **408** Ko | 14 → **15** (12 adr.) | 0 | 1534 → **1688** Ko |
| Annonces | appareil neuf | 113 → **130** | 2899 → **3334** Ko | 26 → **27** (23 adr.) | 0 | 1534 → **1688** Ko |
| Annonces | 2ᵉ ouverture | 106 → **122** | 466 → **536** Ko | 24 → **25** (23 adr.) | 0 | 1534 → **1688** Ko |
| Achats | appareil neuf | 119 → **137** | 2681 → **3083** Ko | 27 → **28** (24 adr.) | 0 | 1557 → **1713** Ko |
| Achats | 2ᵉ ouverture | 115 → **133** | 355 → **408** Ko | 27 → **28** (24 adr.) | 0 | 1557 → **1713** Ko |
| Stock | appareil neuf | 95 → **110** | 2607 → **2998** Ko | 11 → **12** (10 adr.) | 0 | 1573 → **1731** Ko |
| Stock | 2ᵉ ouverture | 91 → **105** | 281 → **324** Ko | 11 → **12** (10 adr.) | 0 | 1573 → **1731** Ko |
| Messages | appareil neuf | 120 → **138** | 3302 → **3797** Ko | 24 → **25** (20 adr.) | 0 | 1568 → **1725** Ko |
| Messages | 2ᵉ ouverture | 118 → **136** | 868 → **999** Ko | 27 → **28** (20 adr.) | 0 | 1568 → **1725** Ko |
| Argent | appareil neuf | 109 → **126** | 3258 → **3746** Ko | 19 → **20** (16 adr.) | 0 | 1646 → **1811** Ko |
| Argent | 2ᵉ ouverture | 97 → **112** | 932 → **1072** Ko | 11 → **12** (10 adr.) | 0 | 1646 → **1811** Ko |
| E-mails | appareil neuf | 92 → **106** | 2607 → **2998** Ko | 10 → **11** (9 adr.) | 0 | 1577 → **1735** Ko |
| E-mails | 2ᵉ ouverture | 88 → **102** | 281 → **324** Ko | 10 → **11** (9 adr.) | 0 | 1577 → **1735** Ko |

Deux relevés dans `releves` : les budgets initiaux (`fc3883d`), puis, après la fusion de
`main` (`2084be1`), un relevé de TOUS les écrans — le banc était rouge sur Ma journée :
**`app_data?id=like.email_reception_*&select=id&limit=1` lue deux fois** (arrivée avec
`main` entre les deux, à chaque essai : un vrai doublon, à corriger dans l'app, puis
baisser le budget) ; et l'app installable fait lire à la 2ᵉ ouverture 60–70 % d'octets en
moins (Ma journée 756 → 287 Ko) : budget BAISSÉ, pour que ce gain ne se reperde pas.

⚠️ **Ce que ces chiffres disent (constat, rien corrigé ici)** : 12 à 30 lectures
IDENTIQUES par écran sur 25 s, dont la vague des ~15 s (lbc_accounts, lbc_listings,
vc_session, vc_listings, vc_ventes, ebay_comptes, ebay_orders* relus tels quels) ;
`vrm_blocked_accounts`, `ebay_comptes`, `panel_num_reserves` et la 1re page des
transactions lues 3 fois. Les plafonds de `vitesse.cjs` (Ma journée ≤ 62) ne voient que
le calme sur l'appareil de tous les jours : ils ne comptent pas cette vague. Le budget
la fige : elle ne peut plus GRANDIR. La réduire est un chantier à part (puis baisser le
budget, voir ci-dessous) — liste exacte des adresses : `doublonsParAdresse` du .json.

## Relever (ou baisser) un budget volontairement
```
npm run build
BUDGET_RELEVER=1 BUDGET_RAISON="Messages lit les avis Vinted (lot X)" ECRANS=messages \
  node scripts/bancs/budget-vitesse.cjs
```
4 passages (×1, ×1, ×4, ×4), le plus haut + la marge réécrits pour les écrans nommés (ou tous), la raison
et la date ajoutées à `releves`. Puis **UN commit qui ne touche que le .json**, message
« budget-vitesse : relever messages — <raison> ». Sans `BUDGET_RAISON`, le banc refuse.
Un budget qui monte sans commit justifié est un défaut, pas un réglage. Après un gain,
baisser de la même façon (sinon le gain peut se reperdre sans bruit).

## Preuves (tout lancé dans ce conteneur, build de `main` fc3883d)
- **Mutation intégrée** `BUDGET_MUTATION=doublon` (l'app relance une fois sa première
  lecture de `vinted_accounts`) : **rouge sur les 16 ouvertures** (« lue 3 fois (budget 2) :
  vinted_accounts… »), 16 rouges, sous charge (4 bancs en parallèle).
- **Mutation du code de l'app** (arbre à part, `src/App.jsx` : `email_journal` relu 3 s
  après sa lecture, puis `vite build`) : **rouge sur les 16 ouvertures** (« NOUVELLE lecture
  en double (×2) : app_data?id=eq.email_journal… »). ⚠️ La même mutation relue
  IMMÉDIATEMENT restait verte — et c'est juste : le partage des lectures de l'app la sert
  sans requête (aucune lecture ne part). Le banc compte ce qui part sur le réseau.
- **`main` inchangé** : vert seul (relevés et vérifications) ; sous charge extrême (4 bancs
  en parallèle, charge 6–15) : un passage vert (112/112), un passage avec 1 rouge
  (`lbc_ventes&select=data` en double sur Ventes, une adresse jamais doublée au relevé — le
  partage de 2 s raté sous la charge). La CI lance les bancs un par un (`lancer-bancs.cjs`) :
  ce cas ne la concerne pas, mais un rouge isolé qui disparaît au relancement vient de là.
  Si ça arrive en CI : relancer ; s'il revient, c'est un vrai défaut.
- Avant ces réglages (processeur ×4, calme de 3 s) : `main` était rouge 5 fois sur un
  passage — d'où les trois pièges ci-dessus.

## Résultats
- Lancer : `npm run build && node scripts/bancs/budget-vitesse.cjs` (~6–10 min ; 112 contrôles).
- CI : voir le récit de la session (lancée par `workflow_dispatch` sur la branche).
