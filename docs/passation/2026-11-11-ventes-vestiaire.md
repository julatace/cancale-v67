# 11 nov. (soir) — Le carré sur la photo · les frais Vestiaire (second agent, `claude/agent2-ventes-vestiaire`)

Deux demandes de Julien (11 nov., 22 h).

## (a) « Corrige le bug visuel du carré sur la photo »

**Constaté** (banc `case-photo`, capture 1512 px clair, avant) : sur chaque vignette de Ventes, un
carré blanc vide AU MILIEU de la photo ; sur Achats, dans le coin, sur fond blanc translucide. C'est la
case de sélection en série (`CaseSerie … surPhoto`), visible à 35 % au repos à la souris.

**Cause du « milieu »** : `styles-vitrine.css` étire chaque enfant du cadre photo de Ventes à 100 %
(`.vrm-ledger-photo-empty > * { width:100% !important; height:100% !important }`) ; la case
prenait toute la photo et son `<input>` (centré dans le `label` flex) tombait au milieu.

**Corrigé** (`src/selection-serie.css`, `src/composants/SelectionSerie.jsx`) :
- sélection FERMÉE : `opacity: 0` (souris), non rendue (doigt, comme avant) — rien sur la photo ;
- au survol de la ligne (souris), au focus clavier ou sélection ouverte : un ROND façon iOS dans le
  coin haut-gauche (22 px, bord blanc, ombre légère, fond sombre translucide) ; coché = rond plein de
  l'accent avec ✓ ;
- position et taille forcées par une spécificité répétée (plus forte que la règle de Vitrine) ;
- « coché » se lit sur `data-serie-on` posé par `CaseSerie` : le clic empêché (`preventDefault`)
  laisse `input.checked` en retard sur React — la case native ne montrait parfois pas sa coche.
Même règle partout où la case est `surPhoto` : Ventes, Achats, Stock (`.vrm-s2d-vig`, même classe —
le Stock n'est pas rendu par le banc, la règle CSS est la même).

**Preuves** : banc `scripts/bancs/case-photo.cjs` (Ventes et Achats, 390 tactile / 1512, clair /
sombre) : 48 verts ; sur `origin/main` (git archive, même banc) **14 rouges** ; mutation « opacité 0
retirée » ⇒ 2 rouges (repos, autres lignes nues). `actions-serie` : 70 verts (il a attrapé un premier
essai qui rendait la case au doigt sélection fermée : corrigé). Captures regardées : repos nu, survol
rond dans le coin, ouverte/cochée (clair et sombre, 390 et 1512).

## (b) « Sur Vestiaire Collective, je veux voir les frais que la plateforme prend »

⚠️ **Correction de vocabulaire** : `sellerPrice` est le PRIX de vente affiché (rangé en `prixVente`
depuis 5.340), et ce qui revient au vendeur est `sellerEarning` (rangé en `montant`). Frais =
`prixVente` − `montant`.

**Mesuré** (lecture seule, 11 nov. soir, projection scalaire) : `vc_ventes` porte 1 vente, `montant`
sous `sellerEarning`, **aucune** `prixVente` encore : le relais `vc.js` ne la recopiait pas — c'est
corrigé dans `claude/vestiaire-plus` (ext. 5.364, agent principal, pas encore sur `main`). Tant que la
5.364 n'est pas installée et qu'aucune vente n'est relue, l'écran dit « frais pas lus ».
`claude/vestiaire-plus` n'affiche PAS les frais (vérifié) : rien n'est refait.

**La règle, une seule** : `fraisVc(v)` dans `api/_lib/vestiaire-regle.js` (le module Vestiaire
partagé app/serveur) : prix (`prixVente`, clé `sellerPrice`, EUR, > 0) ET versé (`montantRecuVc`,
clé qui contient `earning`, EUR) lus, prix ≥ versé ⇒ `{ lu, cPrix, cVerse, cFrais, pct }` en
centimes ; sinon `{ lu:false, raison }` — jamais 0.

**À l'écran** :
- ligne de vente Vestiaire (Ventes · Vestiaire) : « 8 nov. · Frais Vestiaire 37,50 € (15 %) »,
  seulement quand ils sont lus ;
- fiche de la vente, « L'argent » : **Prix 250,00 € · Frais Vestiaire −37,50 € (15 %) · Pour toi
  212,50 €** ; pas lus ⇒ « Prix — · Frais Vestiaire — frais pas lus · Pour toi 203,23 € » ;
- Argent → Statistiques → **Frais par site** : Vestiaire = somme des frais LUS, « frais lus sur 2/3
  ventes », % sur le PRIX des seules ventes aux frais lus ; aucune lue ⇒ « commission pas lue »
  (comme avant). `fraisParPlateforme` reçoit les ventes (`vestiaire`) et la règle (`R.fraisVc`,
  injectée comme `commandeEbayEngagee` : le module reste sans import) ; relié par le n° de la vente
  (`vestiaire:{id}` du relevé), jamais par ressemblance.
- **Bénéfice et marge par plateforme : inchangés et justes** — ils partent déjà du VERSÉ (commission
  retirée) ; ajouter les frais une seconde fois les compterait deux fois. Le « vendu » Vestiaire reste
  le versé (changer la base du CA est une décision à part, non prise ici).

**Branche `claude/agent2-argent-parrainage`** (pas sur `main`) : son `src/coutPlateformes.js` dérive
de `fraisParPlateforme` et écrit « commission Vestiaire pas lue » quand `commissionPasLue` ; à
l'intégration : lui passer `vestiaire` + `R.fraisVc`, et ne plus forcer `plat === 'Vestiaire'` ⇒
« passu » dans sa boucle du relevé (sinon il redira « pas lue » alors qu'elle l'est). Rien dupliqué ici.

**Preuves** :
- `node scripts/audit-frais-vestiaire.cjs --prouve` : 18 verts (50 ventes inventées, 7 formes de
  manque : prix absent, versé absent, clé du versé, devise, clé du prix, versé > prix, prix pris pour
  le versé ; jamais 0 ; exemple 250/37,50/15 %/212,50 ; Frais par site au centime, couverture, %,
  « commission pas lue », identité par n°) ; **7/7 mutations** rougissent ; sur `origin/main` **5
  rouges**.
- `audit-frais-plateformes` 13 verts (mutation `vcpct` remise à la nouvelle règle : rouge).
- banc `scripts/bancs/frais-vestiaire.cjs` (390 tactile / 1512, clair / sombre) : 40 verts ; sur
  `origin/main` 5 rouges (1512 clair). Captures regardées (ligne, fiche lue, fiche pas lue, Frais par
  site).
- `variables`, `tdz`, `coherence`, `identite`, `icones`, `marge-plateforme`, `vestiaire-partout`,
  `extension-5340`, `factures-autres` verts ; `benefice` rouge identique sur `main` (MeilleuresSources) ;
  `vestiaire-parite` : 4 rouges identiques sur `main`.

## Reste
- Les frais n'apparaîtront qu'après la 5.364 (`claude/vestiaire-plus`) et une relecture des ventes.
- Le Stock n'est pas rendu par le banc `case-photo` (même classe CSS).

## Geste de Julien
Aucun ici (installer la 5.364 quand l'agent principal la publie).
