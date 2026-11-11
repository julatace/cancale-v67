# 11 nov. 2026 — Budget de vitesse : l'app ne peut plus redevenir lente sans qu'on le voie

Branche `claude/budget-vitesse` (depuis `origin/main` `fc3883d`). Aucune ligne de l'app
changée, aucune écriture en base, pas de PR (consigne de la session).

## Ce qui est livré
- **`scripts/bancs/budget-vitesse.cjs`** — un budget par écran principal (Ma journée,
  Ventes, Annonces, Achats, Stock, Messages, Argent, E-mails), à 390 px tactile,
  processeur ×4, deux ouvertures : **appareil neuf** (rien de rangé, aucun compte lié
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

## Le budget = le plus haut de 3 passages + la marge
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

## La fenêtre d'observation (le piège trouvé)
Premier relevé avec le « calme » de vitesse.cjs (3 s sans lecture) : **bimodal** —
Annonces 95 OU 111 lectures, Argent 100 OU 108, Messages (2ᵉ) 1 339 OU 2 599 Ko. Cause :
une vague de relectures part ~15 s après l'ouverture (lbc_*, vc_*, ebay_*, vinted_accounts,
harvest_*) ; le calme coupait tantôt juste avant (écart de 2,8 s à 3,1 s), tantôt après.
Le budget observe donc **au moins 25 s**, et ne compte rien de ce qui part **après 50 s**
(les relectures à la minute). Après : écarts de 0 à 4 lectures entre passages.
`BUDGET_AU_MOINS=ms` change le plancher (à ne pas baisser sous ~20 s).

## Budgets figés (main `fc3883d`, base inventée au poids réel)
| écran | ouverture | lectures | octets | doublons | entières | JS+CSS |
|---|---|---|---|---|---|---|
| Ma journée | appareil neuf | 120 → **138** | 2643 → **3040** Ko | 24 → **25** (17 adr.) | 0 | 1496 → **1646** Ko |
| Ma journée | 2ᵉ ouverture | 113 → **130** | 756 → **869** Ko | 21 → **22** (17 adr.) | 0 | 1496 → **1646** Ko |
| Ventes | appareil neuf | 103 → **119** | 2605 → **2995** Ko | 22 → **23** (18 adr.) | 0 | 1496 → **1646** Ko |
| Ventes | 2ᵉ ouverture | 94 → **109** | 826 → **950** Ko | 16 → **17** (13 adr.) | 0 | 1496 → **1646** Ko |
| Annonces | appareil neuf | 113 → **130** | 2824 → **3247** Ko | 29 → **30** (24 adr.) | 0 | 1496 → **1646** Ko |
| Annonces | 2ᵉ ouverture | 109 → **126** | 936 → **1077** Ko | 29 → **30** (24 adr.) | 0 | 1496 → **1646** Ko |
| Achats | appareil neuf | 118 → **136** | 2605 → **2996** Ko | 29 → **30** (25 adr.) | 0 | 1515 → **1667** Ko |
| Achats | 2ᵉ ouverture | 116 → **134** | 826 → **950** Ko | 30 → **31** (25 adr.) | 0 | 1515 → **1667** Ko |
| Stock | appareil neuf | 93 → **107** | 2531 → **2911** Ko | 12 → **13** (10 adr.) | 0 | 1535 → **1689** Ko |
| Stock | 2ᵉ ouverture | 90 → **104** | 752 → **865** Ko | 12 → **13** (10 adr.) | 0 | 1561 → **1718** Ko |
| Messages | appareil neuf | 121 → **140** | 3226 → **3710** Ko | 28 → **29** (23 adr.) | 0 | 1530 → **1683** Ko |
| Messages | 2ᵉ ouverture | 115 → **133** | 1339 → **1540** Ko | 26 → **27** (21 adr.) | 0 | 1530 → **1683** Ko |
| Argent | appareil neuf | 108 → **125** | 3182 → **3659** Ko | 21 → **22** (17 adr.) | 0 | 1595 → **1755** Ko |
| Argent | 2ᵉ ouverture | 97 → **112** | 1403 → **1613** Ko | 13 → **14** (11 adr.) | 0 | 1595 → **1755** Ko |
| E-mails | appareil neuf | 91 → **105** | 2531 → **2911** Ko | 12 → **13** (10 adr.) | 0 | 1537 → **1691** Ko |
| E-mails | 2ᵉ ouverture | 88 → **102** | 752 → **865** Ko | 12 → **13** (10 adr.) | 0 | 1537 → **1691** Ko |

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
3 passages, le plus haut + la marge réécrits pour les écrans nommés (ou tous), la raison
et la date ajoutées à `releves`. Puis **UN commit qui ne touche que le .json**, message
« budget-vitesse : relever messages — <raison> ». Sans `BUDGET_RAISON`, le banc refuse.
Un budget qui monte sans commit justifié est un défaut, pas un réglage. Après un gain,
baisser de la même façon (sinon le gain peut se reperdre sans bruit).

## Preuves
(complétées en fin de session, voir « Résultats »)

## Résultats
