# 6 nov. — Les bancs servent les projections comme PostgREST (branche `v36-bancs-projections`)

Partie de `claude/project-review-nsk5su` (622b6eb0). Rien dans `src/`, `api/`,
`vinted-sync-extension/`, `public/`.

## Le défaut (§6.3, « servir la vraie FORME »)

Le faux PostgREST de 16 bancs lisait un champ projeté par
`/^([a-z]+):data->(.+)$/` puis `m[2].split(/->>?/)`. Pour une projection de
premier niveau `alias:data->>x`, `m[2]` vaut `>x` : la clé « >x », toujours absente.
L'app reçoit donc `cap`, `rev`, `id`, `at`, `ver`… vides là où la vraie base les
remplit (`SEL_MOISSON` `cap:data->>capturedAt`, `rev:data->>rev`, `vc_session`
`id:data->>id`, `vc_ventes` `cap:data->>capturedAt`…). Les chemins imbriqués
(`data->payload->>x`) étaient justes : seul le premier niveau tombait.

## La correction

Comme `navigation-tache` (cf4caad8) : `getPath` de `scripts/bancs/_minipgrest.cjs`
(`->>` = texte, clé absente ⇒ `null`), réutilisé, pas recopié ; `updated_at` servi
dans les deux bancs à liste de champs (`iphone-reprise`, `tous-boutons`). `rapport`
accepte maintenant `BANC_PORT` (il avait 4331 en dur).

Bancs corrigés : benefice-brut-net, compta-abonnements, compta-stock-ui,
coque-mobile, dater-lbc, facturx, finition-premium, iphone-reprise, journee-premium,
rapport, stats-compta, stats-premium, superpdp, tous-boutons, vendu-recu,
ventes-compte.

Regardés et laissés : les familles `split('->').pop().replace(/^>/,'')` + `reste.split(/->>|->/)`
(argent-mois, capacites, colis…), `expr.split(/->>?/)` sur une expression qui
commence par `data` (bilan-semaine, colis-tous-sites, rappel-soir, double-vente-push),
seuils-vinted : le premier niveau y est lu juste. compact, mobile, revendeurs
(`data->>?(.+)`) lisent la bonne clé mais ne rendent pas `->>` en texte ni `null` ;
ebay-relecture-cron rend `d[a]` pour `data->a->b` (seuls des chemins de premier
niveau lui sont demandés aujourd'hui). Les audits `audit-*.cjs` qui découpent ainsi
n'ont pas été touchés (hors du lot demandé).

## Avant / après (même `dist/`, même machine, arbre d'avant par `git archive`)

| banc | avant | après |
|---|---|---|
| **iphone-reprise** | **4 rouges** (R3 ×2, clair et sombre) | **139 verts, 0 rouge** |
| tous-boutons 390 | 5 défauts (E2, E4, E10×3) | les mêmes 5 |
| tous-boutons 1512 | 8 défauts (E0×3, E2, E4, E10×3) | les mêmes 8 |
| vendu-recu | 13 rouges | les mêmes 13 (rejoué seul : identiques) |
| rapport | 16 rouges | les mêmes 16 (rejoué seul : identiques) |
| stats-premium | 8 | les mêmes 8 |
| stats-compta | 6 | les mêmes 6 |
| compta-stock-ui | 2 (stock, délai 25 s) | les mêmes 2 |
| finition-premium | 2 | les mêmes 2 |
| journee-premium | 1 (tête sombre 376 px) | la même |
| ventes-compte, coque-mobile, facturx, compta-abonnements, superpdp, benefice-brut-net, dater-lbc | verts | verts |

Aucun banc n'est passé du vert au rouge : la fiction ne cachait pas de défaut de
l'app dans ce lot. Les rouges identiques des deux côtés sont antérieurs et
d'autres sujets (non traités ici). Les écarts vus en première passe (vendu-recu +3,
rapport arrêté sur un délai) venaient de la charge (moyenne 20 à 47 sur 4 cœurs) :
rejoués seuls, ils sont identiques.

## iphone-reprise : R3 venait de là, B7 non

- **R3** (Annonces rouverte, même recherche) : sur l'arbre d'avant, le dressing servi
  n'avait pas de date de lecture (`cap` vide) ⇒ toutes les annonces « À confirmer »,
  pas de champ de recherche ⇒ R3 rouge. Capture regardée : « À confirmer » sur chaque
  carte avant, « N°31, N°32… » et « Prix d'achat 0/42 » après.
  **Mutation** : `SEL_MOISSON` sans `cap:data->>capturedAt` (build à part) ⇒ R3
  rouge à nouveau avec le banc corrigé : le banc voit maintenant la vraie régression.
- **B7** (balayage Ventes → Colis) : vert des deux côtés, deux passes chacun ; il ne
  venait pas des projections (sa place de balayage est cherchée depuis le 5 nov.).
- L'exception `iphone-reprise` de `scripts/audits-exceptions.json` est retirée.
