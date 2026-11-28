# 28 nov. · Compta finitions (`claude/compta-finitions`)

Julien (28 nov.) : « fais tout le reste parfaitement ». Cela tranche les cinq points « À décider » des bancs compta
(`2026-11-27-bancs-compta.md`) et le reste d'orange (décision du 23 nov. : « pas d'orange »).

⚠️ **Piège à connaître** : les bancs compta (et ~180 autres) jugent le DOM d'AVANT le 17 nov. (`vrm_banc_dom_ancien`,
posé par `scripts/bancs/_garde-reseau.cjs` sauf `BANC_DESIGN_V2=defaut`). Julien voit le design natif : Argent → « Mois »
(`ArgentMoisV2`, `DepensesMois`), pas les `ArgentQuestions` d'avant (montées, cachées). Les points ont été vérifiés sur
l'écran natif, puis aussi dans l'ancien DOM quand le composant y vit.

## Ce qui change
| point | avant | maintenant | où |
|---|---|---|---|
| 1 « avant tes dépenses » | Aujourd'hui le disait déjà (Net du mois, natif) ; Argent → Mois : « Bénéfice 22,56 € » sans mention, « 0 € de charges ce mois-ci » (un zéro qui ne veut pas dire zéro), le choix caché (fusion.css §15) | la rangée Bénéfice dit « avant tes dépenses » ; « Dépenses du mois » : UNE phrase (« Ton bénéfice est compté avant tes dépenses. ») + UNE rangée « Je n'ai pas de dépenses » (`repondreSansDepenses`) ; « + Dépense » reste. Réponse posée ⇒ plus rien, même rechargé (§2.10) | `src/natif/ecrans/DepensesMois.jsx` (`jamais`, `onAucune`), `ArgentMois.jsx` (`avantDepenses`), `Compta.jsx` (`comptaVide`, `depenses === 'jamais'` après le nuage) |
| 2 montant redit | ancien Résumé : « 12,4 % de 60 € reçus » sous l'URSSAF ; Mois natif : la barre « Octobre 60 € » redisait l'affiche « Reçu 60 € » | la base URSSAF s'ouvre sous « Pourquoi ? » ; la barre du mois en cours ne montre plus son montant (lecteur d'écran seulement, `n-lu-seul`) | `Compta.jsx` `ArgentQuestions`, `ArgentMois.jsx` |
| 3 deux « J’ai déclaré » | carte « Déclarer septembre » (J'ai déclaré, Ouvrir l'URSSAF) + « Prochaine déclaration » (300 €, 37,20 €, « Déclarer sur l'URSSAF », « Noter ma déclaration ») | quand la carte du haut porte la période ouverte (même lecture `usePrevisionUrssaf`), « Prochaine déclaration » ne dit que l'échéance et la période | `Compta.jsx` `CarteUrssafMois` (`parcoursLa`) ; le lien de la carte du haut porte aussi `data-declarer-urssaf` (banc statut-fiscal C) |
| 4 rapport comptable | atteignable seulement par « J'ai déclaré » | rangée « Rapport comptable » dans Déclarer → Récap du mois (sur le mois choisi), sans le formulaire | `demanderDeclaration(ym, onNav, { rapport: true })` (App.jsx), `Comptabilite.jsx` (`rapportSeul`), `RecapComptableMensuel` |
| 5 aide d'export | 10 mots | « Ventes, achats, annonces : un fichier, pour toi. » (7), 5 langues ; `TesDonnees` aussi | `src/i18n/langues/*.js` |
| 6 orange | 559 couleurs orange/ambre écrites dans src/ (et pages statiques), le sombre de l'ancien code `warn`/`danger` = #FFC266 | 513 remplacées par les jetons du geste (`--n-ambre`, `-fond`, `-bord`, `--n-sur-ambre`) selon la propriété ; « À venir » : à envoyer = accent du geste, en route = gris fort des graphes ; themeMineral sombre neutre ; pages statiques à l'ardoise | codemod (voir plus bas), `audit-style-vintex` S6 |
| « Ton bénéfice » / « Par mois » | — | « Ton bénéfice » a son « Pourquoi ? » : « Daté au jour de la vente ; dépenses et URSSAF déduites. » ; « Reçu / Par mois » avait déjà « Daté au jour du versement » | `BeneficeCompta` |

Restent permis (couleur d'un OBJET ou d'une MARQUE, marqueurs `logo-marque` / `couleur-objet`, `couleur-objet:debut…fin`) :
logos des transporteurs et des sites, le « G » de Google, Leboncoin, la case-carton du plan 2D, les meubles et ambiances
du garage 3D, la couleur qu'il peint sur ses cases, les teintes de SA facture, la détection de couleur d'une photo.

## Preuves
- **Banc `compta-finitions`** (nouveau, CI part 3) : écran natif, 390 tactile et 1512, clair et sombre — D, U, J, R, O
  (couleurs CALCULÉES de chaque élément visible de Ventes, Aujourd'hui, Argent → Mois / Déclarer), E. 4 modes : **77 verts** (dont : revenu sur Argent, le choix à l’écran une fois, hors écran caché `.vrm-attente-cache`).
- **Rouge avant** (arbre `git archive 64ffbdff4` = main + bancs-compta, construit) : 20 rouges sur 2 modes (D, U barre,
  J, R, O — l'orange de « Prochaine déclaration » en sombre —, E).
- **Mutations** (une construction, toutes posées) : choix des dépenses éteint, « avant tes dépenses » retiré, `parcoursLa`
  faux, rapport avec formulaire, barre du mois qui redit l'affiche, un orange dans `argent.css` ⇒ chaque contrôle rougit
  (9 rouges à 390).
- `audit-style-vintex` : S6 rouge sur l'arbre d'avant (586 rouges), vert ici ; `--mutation` : 11/11 (trois mutations S6
  ajoutées ; les trois mutations de jetons visaient encore #3D4B5B, remises aux valeurs d'aujourd'hui).
- `compta-claire` : « À DÉCIDER » de la base URSSAF devenu un contrôle ; `declare-urssaf` : son « À DÉCIDER » pointe vers
  compta-finitions (le DOM d'avant garde le choix caché, pour ne pas le doubler avec le natif).
- Captures (regardées) : `compta-finitions-*.png` (SHOTS=…, ici `scratchpad/cf/captures-finales`), Argent Mois / Déclarer / rapport / Aujourd'hui / Ventes.

## Codemod « pas d'orange »
Lancé une fois (non gardé dans le dépôt) : pour chaque CSS de src/, les commentaires masqués, chaque déclaration d'un bloc
le plus intérieur ; teinte 18–50°, saturation ≥ 55 %, luminosité 20–97 %. Texte/trait → `--n-ambre` (alpha < 0,5 :
`--n-ambre-bord`) ; fond teinté (alpha < 0,6 ou très clair) → `--n-ambre-fond` ; aplat → `--n-ambre` avec un texte blanc
→ `--n-sur-ambre`, ou, si le texte du bloc était foncé, l'aplat devient la teinte et le texte l'ambre. Les sélecteurs
`[style*="…"]` ne sont pas touchés (ils ne colorent rien). L'audit S6 tient la règle désormais.

## Geste de Julien
Aucun.
