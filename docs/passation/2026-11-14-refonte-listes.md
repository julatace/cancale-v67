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
  annonces débords 36… ; volume Annonces 4 rangées visibles). **Après (arbre fusionné avec origin/main)** : forme
  12 écrans × règles : tout vert SAUF « Ventes : 1re ligne à 577 px » (390, clair et sombre — le reste ci-dessous) ;
  Annonces : 1re paire à 419 px (≤ 422) ; volume : Annonces 8 rangées visibles (avant 4), Ventes 10 (avant 9), CLS des
  rangées ≈ 0, nœuds égaux. ⚠️ Les TEMPS (rendu, recherche par N°) n'ont pas pu être jugés : la machine tournait à
  une charge de 43 (autres sessions) — avant comme après > 300 ms et 20–30 s de rendu ; à remesurer au calme
  (`BANC_REF=<dist d'origin/main> PARTIES=volume node scripts/bancs/refonte-listes.cjs`).
- Captures avant/après : `docs/design/avant-apres/{annonces,ventes,journee}-{avant,apres}.png` (390, dsf 2).
- Verts : `npm run build`, audits traduction, tdz, icônes, cohérence, variables, composants, violet,
  rouge-doublon, quoi-de-neuf ; `design-passe` (journée, ventes, colis, annonces : 0 défaut sur l'arbre fusionné).

## Deuxième tour (demandes du coordinateur après les captures)
- **Annonces** : la bande garde 3 chiffres au plus au téléphone (« Qui dorment » à 0 n'y est que lu), « ⋯ »
  au bout de la même rangée ; le NOM tient sa ligne et la taille écrite en fin de titre passe dans la
  sous-ligne (« T. 37 », `tailleEnFin`, affichage seulement : le titre reste entier dans le DOM), le prix
  dessous à droite ; la sous-ligne = taille, favoris, jours (l'état et les vues dans la fiche ouverte).
- **Ventes** : au téléphone « 15 à imprimer », « N à envoyer en priorité », « Préparer mes colis · Je
  dépose », la tournée et « Bordereau téléchargé il y a N min » vont dans « • À faire · N » (capsule à côté
  des onglets, `AFaireHote` posé sur la section « À expédier ») ; « À expédier » + scanner + « Tout imprimer »
  (seul bouton plein) + « ⋯ » sur une rangée ; N° + titre du colis sur UNE ligne. 1re vente à 414 px.
- **Panne trouvée et corrigée** : une coupe automatique avait laissé la requête « souris » de `ui.css`
  ouverte : au téléphone AUCUNE règle des capsules ni d'« À faire » ne s'appliquait (« À faire » en boîte à
  bord noir). Refermée, la règle de la ligne rétablie.
- **`annonces-grille`** : les 2 délais à 1512 venaient du banc (le menu « … » refermé par Échap, son voile
  encore là 400 ms après sur une machine chargée) : il attend maintenant que le menu soit parti (règle 5 du
  §6). Les 6 contrôles du téléphone sont réécrits pour la liste (une colonne, rangées 64–76 px hors
  proposition « Même paire ? », nom sur sa ligne et taille dessous, en-tête nom + nombre) : **rouges sur
  origin/main (6 ❌), verts ici (96 ✅)**.
- Le site + compte en UN menu sur Ventes (« Vinted · tous ▾ ») n'est pas fait : le filtre des sites est
  celui de la coque (onglets « Paires ») ; la règle des 50 % est tenue sans lui.

## Bancs relancés (un à la fois, sur la branche fusionnée ; « main » = origin/main construit à part)
| banc | branche | origin/main | note |
|---|---|---|---|
| refonte-listes (forme) | vert (1re ligne : Ventes 414, Annonces ≤ 422) | rouge | le banc de ce lot |
| annonces-grille | 96 ✅ / 0 | 6 ❌ (les contrôles téléphone réécrits) | 1512 : délai du banc corrigé |
| annonces-outils · ventes-une-phrase · carte-stats · tout-imprimer · retirer-nom-paire · ventes-colis-premium | verts | — | |
| annonces-coherence | 10 → (B, P corrigés) | 8 rouges | G (« Ouvrir sur Vinted » bleu) et F (feuille Actions 36 px à l'ordinateur) : rouges sur main aussi |
| colis-heure | 8 | 16 | « carte absente » et l'ambre de nuit : rouges sur main aussi |
| journee-v2 | 8 | 8 | « Ventes · Vinted : lien vers Colis » : identique sur main |
| journee-premium | 1 | 1 | tête 592 px : identique sur main |
| vague2-ventes | 3 | 4 | « ouvrir la remise n'écrit rien » : rouge sur main aussi |
| colis-envoi | 6 → (tournée depuis « À faire » corrigée) | 1 (le scénario tombe) | G 1512 (boutons 36 px souris) : de main |
| annonces-actions | 2 | 4 | F 1512 (cibles 36 px souris) : de main |
| design-passe-2 | 8 coupes (« Tout imprimer » secondaire, corrigé) + 26 écrans non mesurés (délai) | — | relancé en fin de lot |

## Restes (honnêtes)
- La maquette met le **site et le compte dans UN menu** (« Vinted · tous ▾ ») sur la rangée de la recherche,
  et le segment « Annonces | Stock | Achats » : ce sont la coque (onglets « Paires ») et le filtre des sites —
  à faire quand la coque est fusionnée.
- Le « 30 » de la bande de Ventes et celui du segment « À envoyer · 30 » : le même nombre deux fois (c'était
  déjà le cas avant, la carte était en bas) — la case « à poster » de la carte par défaut de Ventes est un
  choix de Julien (carteChiffres.js) : à lui de dire.
- `journee-premium` : « le premier geste au-dessus de la barre du bas » était déjà rouge sur origin/main
  (tête 592 px) ; inchangé.
- La ligne « Tout est à jour » et la pastille « Mis à jour » (coque) sont décomptées par le banc, et dites.
- Le « de ouf » (photo en vedette façon Nike, affiches façon Revolut/Oura, finition Linear — skill
  `references-design`) n'a pas été appliqué : arrivé en fin de session, à prendre par le chantier suivant
  sur la base posée ici (structure « liste d'abord » de la maquette, briques `src/ui/`).
- Les bancs des écrans touchés : voir « Bancs relancés » ci-dessous.
