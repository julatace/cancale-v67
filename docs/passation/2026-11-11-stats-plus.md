# 11 nov. 2026 · Plus de statistiques (lot stats-plus)

Demande de Julien : « on a la possibilité d'avoir qu'une seule stat dans le carré bleu ; dans
l'onglet Argent → Statistiques il n'y en a pas assez à mon goût ». Principe : « plus beau, simple,
surtout PRATIQUE ». Branche `claude/stats-plus` (pas de PR, pas de merge dans `main` : consigne du lot).

## 1. La carte sombre de Ma journée : jusqu'à 6 chiffres

- `src/design/carteChiffres.js` : `PAGES_CARTE.journee.max = 6`, `maxCases(page)` (3 ailleurs).
  `reglageDePage` garde le NOMBRE de cases rangé (1 à 6) sur une page à `max` ; une case invalide
  au-delà du défaut est retirée (jamais complétée en douce) ; jamais deux fois le même chiffre.
  `reglageAEnregistrer` rogne à `maxCases`. Rangé dans `vrm_carte_stats` (déjà synchronisé).
- Trois chiffres neufs au catalogue (proposés sur toutes les pages, « tous les sites ») :
  - `stock` « Valeur du stock » : la publication `vrm_valeur_stock` d'Annonces (`useValeurStock`),
    une paire sans prix d'achat ⇒ « au moins » + « 7 sur 10 » ; aucun prix connu ⇒ « — » ;
    jamais publiée ⇒ « — · ouvre Annonces ».
  - `objectif` « Objectif du mois » (en %) : `valeurObjectif` + `progressionObjectif`, la barre de
    la carte ; pas d'objectif ⇒ « — · aucun objectif ».
  - `urssafapayer` « URSSAF à payer » : `montantPeriodeUrssaf` sur la prochaine échéance
    (`nextUrssafDeadline`, `vinted_urssaf_freq`), la règle du rappel URSSAF de Ma journée ;
    période pas finie ⇒ « au moins » ; statut sans cotisations ⇒ hors sujet. ⚠️ L'id n'est PAS
    `apayer` : Ventes · Vinted a déjà une case LOCALE `apayer` (« à payer »).
- La feuille « Modifier » (`src/design/CarteStats.jsx`) : « + Ajouter » (jusqu'à 6), et pour la
  case choisie « ↑ Avant · Après ↓ · Retirer » (une case au moins reste). Chaque geste est rangé
  tout de suite. Le type `pct` s'écrit « 62 % ».
- Rendu (`src/design/CarteMois.jsx`, `CasesEnPages`, `src/design/carte-pages.css`) : ≤ 3 cases =
  la rangée d'avant ; 4 = 2×2 ; 5–6 au téléphone = pages de 2×2 qui glissent (aimantées, points
  « Page n sur N », 44 px de large, `data-noswipe`) ; ordinateur = rangées de 3 (4 : une de 4).
  ⚠️ Les cases restent ENFANTS DIRECTS de `.vrm-fu-cases` (les règles des widgets s'y appliquent) ;
  chacune porte `--pr`/`--pc`. ⚠️ Les règles des widgets sont dans `@layer vrm-premium` : un
  `!important` en couche bat un `!important` hors couche quelle que soit la spécificité — les
  règles de carte-pages.css sont donc dans la même couche (sinon la colonne restait `auto`).
- Chaque case ouvre l'écran propriétaire (`aller` : Annonces, Argent, Compta…).

## 2. Argent → Statistiques : « En bref » et « Plus de chiffres »

Règles : `src/statsPlus.js` (assemble les propriétaires, ne lit rien) ; écran : `StatsPlus` dans
`src/ecrans/Stats.jsx`, sous les tuiles ; styles `src/stats-plus.css`.
- **En bref** (3 tuiles) : Ventes (± % au même point, `venduPeriode`, le MÊME que la tuile
  « Vendu »), Panier moyen (vendu ÷ ventes ; moins de 3 ventes ⇒ « pas assez de données » ; des
  ventes au montant pas lu ⇒ « — »), Marge connue (`classementRapporte` sommé : brut ÷ ventes au
  prix d'achat connu, « N ventes sur M », moins de 3 ⇒ pas assez).
- **Plus de chiffres** (volet repliable, ouvert par défaut, `RepliStats ouvertDefaut`) :
  - Vendu et reçu : par barre de `barresPeriode` (jours / 8 semaines / mois), VENDU (date de vente)
    et REÇU (`recuPublieEntre` sur `vinted_urssaf_mois`, au jour du versement) côte à côte, jamais
    additionnés ; reçu pas su ⇒ filet pointillé et « — » ; ventes « à dater » dites. sans bibliothèque
    (barres HTML/CSS, comme « Vendu par semaine »), chaque colonne est un bouton : toucher / Tab / survol souris écrit ses deux
    valeurs (aria-live).
  - L'âge de ton stock : 0–30 / 30–90 / 90 j et plus depuis `vrm_stats_stock` (seuils cumulés de
    `stockQuiDort`) ; sans date dites ; 90 j et plus en ambre seulement si non vide.
  - Tes 10 meilleures ventes : vente − prix d'achat (la règle du brut), seulement au prix connu ;
    « classées sur N ventes au prix d'achat connu (sur M) ».
- Déjà là avant ce lot (non refait) : ce qui part vite, quel compte vend le mieux, par plateforme
  (marge), par catégorie, offres (taux, remise), annulations/notes, frais par site, comparer deux
  mois, objectif, vitesse d'envoi, taux de vente et rotation (volet « Ce qui se vend »).
- Refusé (§3) : saisonnalité — rien fait.

## Preuves
- `npm run build` vert ; audits `variables, tdz, coherence, identite, icones, textes-courts,
  fonctions-api, secrets, carte-chiffres` verts (carte-chiffres : la ligne REGLES_CARTE acceptée
  avec ses deux règles neuves, exigeant `montantPeriodeUrssaf`).
- `node scripts/audit-stats-plus.cjs` : 44 verts — exécute chaque règle sur des données inventées
  (couverture, pas su, compte exclu, vendu ≠ reçu, 6 cases). Rouge sur `origin/main` (module
  absent) et sous 7 mutations (`--mutation=achat|pasassez|recu|tranches|six|stock|stockpartiel`).
- Banc `scripts/bancs/stats-plus.cjs` : 96 verts (390 clair/sombre, 1512 clair/sombre) ; captures
  regardées (pages 1 et 2 du carrousel, feuille, 1512, âge du stock, meilleures ventes, sombre).
- Bancs voisins : `stats-vitrine` 112/0 ; `carte-stats` 3 rouges et `journee-premium` 1 rouge —
  les MÊMES sur `origin/main` (grand chiffre de Ma journée caché par la frise depuis le 9 nov. ;
  hauteur de tête), pas de ce lot.

## Geste de Julien
Aucun. Ma journée → « Modifier » → « + Ajouter » pour passer à 4, 5 ou 6 chiffres.
