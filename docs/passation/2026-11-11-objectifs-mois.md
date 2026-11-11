# 11 nov. 2026 — Objectif du mois : la mesure, le rythme, la proposition, le bilan

Lot `objectifs-mois` (branche `claude/objectifs-mois`). Principe : « plus beau, simple,
surtout PRATIQUE ». On AMÉLIORE l'objectif du 4 nov. (un réglage, `vrm_objectif_mois`,
`src/objectifMois.js`), on ne le double pas.

## Ce qui change pour Julien
- **Trois mesures** au choix : **Vendu** (date de vente, `ventesFaites`), **Bénéfice**
  (la case « Bénéfice brut » du mois : seulement les ventes au prix d'achat connu ;
  « au moins … », la couverture dite « pour 12 sur 15 ventes »), **Ventes** (nombre).
- **La barre** (Ma journée, carte sombre, toujours fine, 4 px) dit
  « 2 000 € vendus ce mois · 1 340 € », puis « encore 660 € en 19 jours · ≈ 35 €/jour »,
  puis « En avance de 80 € sur ton rythme » / « En retard de … » / « Dans ton rythme ».
- **La proposition en 1 geste** : dans « Modifier → Objectif » (et Argent), « Viser 1 830 € ·
  Ta moyenne sur 3 mois. ». Un mois pas su, partiel ou d'avant l'historique ⇒
  « Pas assez d'historique pour te proposer un chiffre. » Rien d'inventé.
- **Le bilan de fin de mois, une fois** : du 1er au 7, sous la barre de Ma journée (et dans
  Argent) : « Octobre : objectif atteint ✓ » ou « Octobre : 1 640 € sur 2 000 € · il a manqué
  360 € ». « OK » ⇒ plus jamais dit (`bilanVu`, synchronisé).
- **Le détail dans Argent** (Argent → Mes ventes) : sorti du volet replié « L'argent depuis le
  début » (il y était caché), sous la vitrine : où il en est, reste, rythme, ses 3 derniers mois
  (même règle) avec « visé 2 000 € » quand un objectif tenait ce mois-là.

## Les règles (une notion, un propriétaire)
- Valeur du mois en cours : `valeurObjectif` (carteChiffres) = `valeurChiffre` sur `vendu` /
  `brut` / `ventes`, période « mois », `SEL_OBJECTIF` (tous sites). Les lignes viennent de la
  coque (`liveStats.venduLignes` = `ventesFaites` des **comptes sélectionnés**) ; le bénéfice de
  `vrm_benefice_jours` publié par Ventes (mêmes comptes). Aucune seconde somme.
- Mois passés : `valeurObjectifMois` = la MÊME `valeurChiffre` sur la plage [1er, 1er suivant).
  `couvert` : une vente lue AVANT ce mois (sinon un « 0 » ne prouve rien) ; bénéfice : publié
  depuis le 1er janvier de l'an passé seulement.
- Rythme (`rythmeObjectif`) : attendu = objectif × part du mois écoulée (à l'heure, heure de
  l'appareil) ; ± 5 % ⇒ « dans ton rythme ». **Tranché** : une valeur « au moins » peut dire « en
  avance », jamais « en retard » (le manque peut combler). Pas su ou atteint ⇒ rien.
- Reste (`phraseResteObjectif`) : aujourd'hui compte parmi les jours ; le €/jour s'arrondit vers
  le haut ; « au moins » ⇒ « au plus ».
- Proposition (`propositionObjectif`) : moyenne des 3 mois pleins, arrondie à 10 € (ventes : à
  l'unité) ; un trou ⇒ null.
- Histoire (`parMois` dans le réglage) : chaque pose d'un type/montant note le mois ; un objectif
  tient jusqu'au changement ; retiré ⇒ `null` ce mois-là ; six mois gardés. Le bilan juge le mois
  passé sur l'objectif d'ALORS. **Tranché** : un objectif posé avant ce lot n'a pas de date ⇒
  aucun bilan pour lui (jamais supposé) ; le premier « OK »/« Viser » le date.
- Toute écriture part du réglage RANGÉ (`objectifBrut`) : la feuille de la carte, Argent et
  Réglages (qui garde maintenant le type choisi au lieu de le forcer en « vendu »).

## Tranché aussi
- Le bénéfice suit la case « Bénéfice brut » (ventes **finalisées** au prix d'achat connu, sans
  dépenses ni URSSAF), pas le « Bénéfice » net : c'est la seule notion qui se somme jour par jour
  avec sa couverture. Dit « au moins … » comme la mission le demande.
- Défaut d'avant corrigé : la barre-bouton portait `width: 100%` + 20 px de marge de chaque côté
  dans la tête de Ma journée (`styles-widgets-ios.css`) ⇒ elle débordait de 40 px (le « 700 € » à
  droite était coupé, capture). `width: auto` + étirement.
- Objectif par compte : refusé par Julien le 10 nov., pas fait.

## Preuves
- `node scripts/audit-objectif-mois.cjs` : 64 verts. Section 7 neuve (bénéfice, rythme,
  proposition, histoire, bilan, branchement). Rouge sur l'arbre de `main` (3 rouges) ; 14
  mutations, toutes rouges (`--mutation=type|zero|cache|defaut|arrondi|saisie|retirer|benefice|
  retard|propose|couvert|histoire|bilanvu|perte`).
- Banc neuf `scripts/bancs/objectifs-mois.cjs` : 68 verts (390 tactile / 1512, clair / sombre) —
  barre fine et DANS la carte (rouge avant la correction CSS), 700 € / 2 000 €, reste, rythme
  (+525 €), bilan d'octobre et « OK » rangé puis absent au rechargement, « Viser 1 830 € » en un
  geste (octobre garde 2 000 €), bénéfice sans publication ⇒ aucune proposition, Argent (même
  valeur, 3 mois, « visé 2 000 € » en octobre seulement). Captures regardées.
- `journee-instantanee` : 0 rouge (phrase mise à jour). `offres-objectif` : 100 verts.
  `stats-premium` : 4 rouges, les MÊMES que sur `main` (échelle de texte, couverture), mon bloc
  n'en ajoute aucun (ses textes sont sur l'échelle 28/15/13/11).
- `npm run build` vert ; audits variables, tdz, coherence, identite, icones, textes-courts,
  fonctions-api, secrets verts.

## Geste de Julien
Aucun. (Pour avoir le bilan de novembre : poser ou reposer l'objectif une fois ce mois-ci.)
