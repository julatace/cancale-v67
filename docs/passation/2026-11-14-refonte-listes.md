# 14 nov. 2026 — Refonte des listes : Ma journée, Ventes (« À expédier »), Annonces

Branche `claude/refonte-listes` (depuis `origin/main`, refusionnée par un vrai `git merge origin/main` à la fin).
Pas de PR. Rien dans `vinted-sync-extension/`. Forme seulement : aucune règle métier, aucun chiffre calculé
autrement, aucune donnée supprimée (on déplace, on replie, on regroupe).

## Ce que Julien a dit (dans l'ordre)
1. « C'est moche. Continue à améliorer le design, rien n'a changé. » (captures d'Achats)
2. « Le design fait basique, il faut vraiment qu'on sorte des classiques » ⇒ direction « Atelier » (§4 de
   `styles-systeme.css`, posée par la coque, récupérée ici telle quelle).
3. « Il faut que ça soit pratique, imagine si j'ai 1000 articles » ⇒ rangées denses, ≥ 8 paires visibles.
4. (09:01, captures d'Annonces) « pas beau du tout : les couleurs, les formes, les boutons » ⇒ AJOUT 3 :
   la liste d'abord ; plus de carte sombre sur un écran de liste ; plus de carte vide « — » ; le compte en
   menu ; une barre d'outils ; de petites capsules ; les alertes en UNE ligne « À faire » ; la phrase sous le
   titre retirée. Puis une maquette « Paires » (coordinateur) montrée à Julien : visée pour Annonces.

## Ce qui change (visible)
| écran | avant | après |
|---|---|---|
| **Annonces** (téléphone) | titre + phrase de 2 lignes, segment des sites, rangée de pilules de comptes, carte sombre « 36 en ligne », carte « Qui dorment », 2 tuiles, 4 ronds gris + « 4 brouillons », vues en capsules grises 52 px, « Bénéfice — » en carte, « 2 nouveaux N° »… puis une grille de 2 grandes photos (4 paires par écran) | titre + « ? » ; « Tous les comptes ▾ » (un menu, `MenuCompte`) ; une **bande** de chiffres (≤ 72 px, sans carte, « — » absent, « Modifier » = « ⋯ ») ; une barre (champ de recherche + tri + ⋯, sans fonds gris) collée en haut de la liste ; les vues en petites capsules (34 px dessinées, 44 touchées, la choisie à l'encre) avec **« • À faire · N »** en tête (une feuille : brouillons à refaire, retirées de Vinted, prix d'achat N/M, nouveaux N°, propositions — les MÊMES éléments, `src/ui/AFaire.jsx`) ; une **liste groupée** par compte (en-tête gris 13 px collé), rangées de 70 px : vignette 52, nom 16/600 sur une ligne, pastille N° claire + état et chiffres, prix à droite. 1re paire à 419 px (sans la ligne de fraîcheur de la coque), contre ~1 300 avant. |
| **Annonces** (ordinateur) | idem en grand | même bande, même barre, la grille de vignettes garde 5–6 colonnes ; les alertes posées ensemble sous les vues |
| **Ventes** | « À expédier » en tête, cartes de colis de 138–158 px, la phrase « date estimée dépassée — vérifie la vraie limite sur Vinted » répétée 27 fois, la carte « Novembre 1 471 € » à 5 500 px du haut | la bande (1 471 € vendu · 26 ventes · 30 à envoyer · ⋯) en haut ; « À expédier » et ses gestes sur une rangée ; les gestes de préparation en petites capsules ; colis en rangées (~85–100 px, vignette 52, une ligne pour la limite, le compte et l'attente) ; « date estimée dépassée » sur la carte, « vérifie la vraie limite » UNE fois (bandeau « à envoyer en priorité », derrière ⓘ au téléphone, et au survol) ; toutes les ventes en rangées de 64 px |
| **Ma journée** | tête sombre + 3 widgets blancs dessous, « 30 colis à envoyer » cassé en deux lignes, icônes rondes grises | la tête sombre « atelier » (encre → bleu nuit) garde tout ; les 3 chiffres du mois DANS elle (verre) ; le chiffre du jour en affiche 56/64 ; phrase sur une ligne ; « Ensuite » : pastilles d'icônes teintées, point ambre de 8 px (il prenait la place d'un bouton de 44 px), sous-lignes d'une ligne |

## Les briques communes — `src/ui/` (pour les autres chantiers)
`BandeChiffres` · `MenuCompte` · `BarreOutils` + `BoutonIcone` · `Filtres` · `LigneAFaire` · `Ligne` ·
`Feuille` · `AFaire` (`AFaireHote` / `VersAFaire` / `AFaireLigne`, regrouper les alertes sans déplacer leur
code). Chacun dit en tête ce qu'il fait ; styles `src/ui/ui.css` (couche `vrm-premium`, jetons `--d-*`) ;
textes `listes.*` (5 langues, `src/i18n/langues/<l>/listes.js`). La carte réglable (`CarteMois`) a un mode
`bande` (CarteStatsApp `bande`) : mêmes chiffres, mêmes `data-*` de lecture (`.vrm-fu-grand`, `[data-fu-case]`).

## Code
- `src/styles-listes.css` (après `styles-systeme.css`) : héros de Ma journée, bande, titre + « ? », barre et
  vues d'Annonces, liste groupée d'Annonces au téléphone, rangées de colis et de ventes, Ma journée.
- `src/App.jsx` : la carte de Ventes montée en haut ; `limiteCourte` (la phrase de la date estimée dépassée,
  même source `TEXTE_ESTIMEE_DEPASSEE`) ; ⓘ du bandeau « à envoyer en priorité » ; `SelecteurCompte compact`
  (Annonces) ; Annonces enveloppé dans `AFaireHote`, ses alertes dans `VersAFaire`.
- `src/design/CarteMois.jsx`, `CarteStats.jsx` : le mode `bande`.
- `scripts/bancs/design-passe.cjs` : l'échelle admet l'affiche 48 · 56 · 64 (`--d-t-affiche-*`, §4 Atelier).

## Preuves
- Banc **`scripts/bancs/refonte-listes.cjs`** — forme (murs gris, débords, carte dans carte, accent sur un
  montant, phrase répétée, héros ; AJOUT 3 : 1re ligne ≤ 50 %, cases « — », un bouton plein, capsules grises,
  bandeaux flottants) et volume à 1 000 annonces / 1 000 ventes (rendu, CLS des rangées, nœuds, rangées
  visibles, recherche par N°), `BANC_REF=<dist d'origin/main>` pour comparer.
  Sur origin/main : **rouge** (390 clair : journée heros 1 · murs 1 ; ventes murs 6, phrases répétées 6 ;
  annonces débords 36… ; volume Annonces 4 rangées visibles). Après : voir le récit de fin (ci-dessous).
- Captures avant/après : `docs/design/avant-apres/{annonces,ventes,journee}-{avant,apres}.png` (390, dsf 2).
- Verts : `npm run build`, audits traduction, tdz, icônes, cohérence, variables, composants, violet,
  rouge-doublon, quoi-de-neuf ; `design-passe` (journée, ventes, colis, annonces).

## Restes (honnêtes)
- **Ventes** n'atteint pas encore « 1re ligne ≤ 50 % » au téléphone (~560 px sans la ligne de la coque) : il
  faudrait ranger « 15 à imprimer », « 28 à envoyer en priorité » et la tournée dans « À faire » et le « ⋯ »
  de « À expédier » (même mécanique `AFaire`), et passer les sites en menu comme sur la maquette.
- La maquette met le **site et le compte dans UN menu** (« Vinted · tous ▾ ») sur la rangée de la recherche,
  et le segment « Annonces | Stock | Achats » : ce sont la coque (onglets « Paires ») et le filtre des sites —
  à faire quand la coque est fusionnée.
- Le « 30 » de la bande de Ventes et celui du segment « À envoyer · 30 » : le même nombre deux fois (c'était
  déjà le cas avant, la carte était en bas) — la case « à poster » de la carte par défaut de Ventes est un
  choix de Julien (carteChiffres.js) : à lui de dire.
- `journee-premium` : « le premier geste au-dessus de la barre du bas » était déjà rouge sur origin/main
  (tête 592 px) ; inchangé.
- La ligne « Tout est à jour » et la pastille « Mis à jour » (coque) sont décomptées par le banc, et dites.
