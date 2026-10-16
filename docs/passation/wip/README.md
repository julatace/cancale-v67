# Travail non fini, figé le 16 octobre 2026 (passation)

La session qui a fait le travail du 2 au 16 octobre a atteint sa limite. Les
agents ci-dessous ont été coupés en plein travail : leur code est **partiel et
NON RELU**. Chaque patch est UN commit (sauf p1-retours : 3 commits construits,
non relus), à appliquer sur la branche intégrée :

```
git checkout claude/project-review-nsk5su
git am -3 docs/passation/wip/<patch>.patch     # en cas de conflit : résoudre, git add, git am --continue
```

| patch | chantier | état |
|---|---|---|
| `p1-retours-3-commits.patch` | retour en litige au point relais : plus de « Imprimer le bordereau », le retour dans « colis à retirer » | construit, 3 relectures adverses JAMAIS faites |
| `p0-numerotation-WIP.patch` | la numérotation automatique ne numérote plus rien depuis le 11 oct. | partiel, non prouvé |
| `p0-imprimer-WIP.patch` | « Tout imprimer » | partiel, non prouvé |
| `p0-tampons-WIP.patch` | tampons titre + N° sur les bordereaux | partiel, non prouvé |
| `p1-ebay-auto-WIP.patch` | eBay en un clic (rien à remplir) | partiel, non prouvé |
| `p1-fiscal-WIP.patch` | corrections des défauts de la relecture fiscal | partiel — voir `defauts-relectures-15oct.md` |
| `p1-annonces-WIP.patch` | corrections des défauts de la relecture annonces | partiel — voir `defauts-relectures-15oct.md` |

Le plan complet est dans `docs/passation/PASSATION-2026-10-16.md`. Les rapports
bruts des agents (mesures sur la base de production) sont dans
`docs/passation/notes/15oct/`.
