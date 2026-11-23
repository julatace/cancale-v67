# 16 nov. — « Apparence et langue » rangée, plus d'interrupteur « Mode sombre » (lot `apparence-rangee`)

Décidé par Julien (passation générale du 16 nov., §4) : retirer l'interrupteur « Mode sombre » en doublon
d'« Apparence » et ranger « Affichage » (17 lignes). Branche partie de `claude/sombre-auto` (PR #1227, pas encore
sur `main`) : cette PR la contient.

## Ce qui change
- Paramètres → **Apparence et langue** : plus de rangée « Mode sombre » (`id:'sombre'`, interrupteur). Le choix vit
  seul dans « Apparence » : Automatique (par défaut) · Clair · Sombre · Le soir. Choisir Clair ou Sombre écrit
  toujours `vinted_dark` (src/apparence.js) : un autre appareil pas à jour garde la bonne teinte.
- La catégorie est rangée en groupes **titrés** (avant : un premier groupe sans titre de cinq rangées mêlées) :
  **Apparence** (Apparence, Taille du texte, Zoom) · **Langue** · **Écrans** (Simple/Complet, Ma journée,
  Atelier, Ma configuration) · **Quand tu filmes** (stream) · **Raccourcis** (widget, Siri, clavier).
  Titres `parametres.g.apparence` / `parametres.g.langue` dans les cinq langues ; clés `reglages.sombre.*` retirées.
- « Je vends », « Plateformes affichées », « Objectif du mois » restent dans leurs catégories (Stock, Mes
  plateformes, Argent) : inchangés.
- Quoi de neuf : `apparence-rangee`.

## Les bancs qui touchaient l'interrupteur (sans les affaiblir)
Le même geste au bon endroit, par `scripts/bancs/_choisir-apparence.cjs` (`choisirApparence(pg, mode)`,
`basculerSombre(pg)`) : la rangée « Apparence » (dans sa catégorie), puis « Clair » ou « Sombre » — ce qui écrit
`vinted_dark` comme avant. `coque-parametres` (nuage après une sauvegarde ratée), `nuage`, `deux-appareils`
(B : « Apparence → Sombre » est là et touché ; E : « Clair »), `benefice-journee` (repère « Paramètres chargé » =
ses catégories), `studio-reste` (le geste `data-reglage-sombre` déclaré RETIRÉ EXPRÈS, avec sa place :
`data-apparence=clair|sombre`, déjà dans l'inventaire).

## Preuves
- `audit-parametres` 22/22 ; deux contrôles neufs (plus d'interrupteur ; groupes titrés dans les cinq langues),
  **rouges sur `claude/sombre-auto`** (20/22) ; `--prouve` 7/7 mutations (2 neuves : `sombre-remis`,
  `groupe-sans-titre`).
- `audit-apparence` vert, `audit-traduction` 45/0, `audit-quoi-de-neuf` vert.
- Bancs : voir la PR (résultats et captures 390 / 1512, clair et sombre).

## ÉTAT À LA REPRISE
Fini, PR ouverte (contient #1227). Geste de Julien : aucun.
