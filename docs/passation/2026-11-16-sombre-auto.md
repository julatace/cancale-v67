# 16 nov. — Mode sombre automatique (lot `sombre-auto`)

Mission : `docs/passation/file-attente-16nov/9-sombre-auto.md` (validée par Julien).

## Ce qui existait
- 8 nov. (`src/apparence.js`) : Clair · Sombre · Automatique · Le soir, CHOISIS ; rien de choisi ⇒ l'ancien
  `vinted_dark` lu avec `false` par défaut ⇒ clair. Le mode Automatique suivait déjà le système EN DIRECT
  (`useSystemeSombre`, écoute de `prefers-color-scheme`), la barre d'état (`theme-color`) suivait.
- Script de démarrage `public/demarrage-theme.js` (copie de la règle, aucun flash, `audit-apparence`).

## Ce qui change
- **Rien de choisi ⇒ Automatique** (`APPARENCE_DEFAUT = 'auto'`), dans `src/apparence.js` ET la copie du
  démarrage. Migration sans écriture : `vinted_dark` n'est écrit que par SON geste ⇒ présent (true OU false)
  = ancien choix explicite, gardé ; absent = jamais choisi ⇒ Automatique. App.jsx lit `vinted_dark` avec `null`.
- Paramètres → Apparence : « Automatique (par défaut) » en premier, puis Clair, Sombre, Le soir ; libellés et
  phrases par `tr()` en 5 langues (ils étaient en français en dur).
- Pages statiques (aide, statut, état, confiance) : déjà « choix de l'app, sinon le système » — inchangées.
- **Pas fait** (décidé au §4 de la passation mais hors du texte de la mission) : retirer l'interrupteur
  « Mode sombre » en doublon d'Apparence (5 bancs le touchent : `coque-parametres`, `nuage`, `deux-appareils`,
  `benefice-journee`, `studio-reste-inventaire`) et ranger « Affichage ». À faire dans un lot à part.

## Preuves
- `audit-apparence --prouve` : vert, 10/10 mutations (3 neuves : ancien « clair » oublié, démarrage absent ⇒
  clair, app lit `false` par défaut) ; sur `origin/main` : 4 rouges.
- Banc neuf `sombre-auto` (390 tactile + 1512, `emulateMedia`) : 16/16 — sombre dès le démarrage sans jamais
  « light » (aucun flash), bascule en direct clair ⇄ sombre (data-theme + theme-color), ancien « clair » gardé,
  « Sombre » choisi prioritaire, Apparence « Automatique (par défaut) » coché ; contraste des couleurs du thème
  (texte et texte secondaire sur cartes et fond) ≥ 4,5:1 dans les deux modes. Captures regardées.
  (axe-core n'est pas installé dans `node_modules` : le contraste est mesuré sur les couleurs du thème.)
- `audit-traduction` vert.

## ÉTAT À LA REPRISE
Fini, PR ouverte. Reste : interrupteur en doublon + rangement « Affichage » (voir plus haut). Geste : aucun.
