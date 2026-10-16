# Travail non fini, figé le 16 octobre 2026 (passation)

La session qui a fait le travail du 2 au 16 octobre a atteint sa limite. Les
agents ci-dessous ont été coupés en plein travail : leur code est **partiel et
NON RELU**.

**Vérifié le 16 octobre : les 7 patchs s'appliquent À LA SUITE, dans l'ordre de
leur numéro, sans aucun conflit, et le build passe ensuite** (`audit-variables`
et `audit-tdz` verts). Les conflits avec la branche intégrée ont été résolus
avant l'export (retours : titre de « À retirer » de la barre d'actions ;
eBay-un-clic : lecture mémorisée des dressings + état Vinted ; tampons :
posés PAR-DESSUS « Tout imprimer », qui touche le même chemin d'impression).

```
git checkout claude/project-review-nsk5su
for p in docs/passation/wip/[1-7]-*.patch; do git am -3 "$p" || break; done
npm run build && node scripts/audit-variables.cjs && node scripts/audit-tdz.cjs
```

⚠️ Appliquer un patch ne veut PAS dire qu'il est juste : tous sont NON RELUS,
et 2 à 7 sont PARTIELS. Les appliquer d'abord, puis finir et relire chaque
chantier (voir PASSATION-2026-10-16.md), et SEULEMENT ENSUITE mettre en
production. Un chantier qu'on préfère refaire : `git revert` de son commit.

| patch | chantier | état |
|---|---|---|
| `1-p1-retours-3-commits.patch` | retour en litige au point relais : plus de « Imprimer le bordereau », le retour dans « colis à retirer » | construit, 3 relectures adverses JAMAIS faites |
| `2-p0-numerotation-WIP.patch` | la numérotation automatique ne numérote plus rien depuis le 11 oct. | partiel, non prouvé |
| `3-p0-imprimer-WIP.patch` | « Tout imprimer » | partiel, non prouvé |
| `4-p0-tampons-WIP.patch` | tampons titre + N° sur les bordereaux | partiel, non prouvé |
| `5-p1-ebay-auto-WIP.patch` | eBay en un clic (rien à remplir) | partiel, non prouvé |
| `6-p1-fiscal-WIP.patch` | corrections des défauts de la relecture fiscal | partiel — voir `defauts-relectures-15oct.md` |
| `7-p1-annonces-WIP.patch` | corrections des défauts de la relecture annonces | partiel — voir `defauts-relectures-15oct.md` |

Le plan complet est dans `docs/passation/PASSATION-2026-10-16.md`. Les rapports
bruts des agents (mesures sur la base de production) sont dans
`docs/passation/notes/15oct/`.
