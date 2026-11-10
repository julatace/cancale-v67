# 10 nov. — Lot I : marge par plateforme

Proposition 7 validée par Julien (« savoir où publier ; seulement sur les ventes
prouvées, couverture dite »). Les délais de litige du lot I ont été faits par BB.

## Ce qui a changé

Argent → Statistiques, juste après « D'où viennent mes achats » et « Vitesse
d'envoi » : une carte **Marge par plateforme**, une ligne par site, toujours les
quatre (Vinted, Leboncoin, eBay, Vestiaire Co) :

- en grand, le **bénéfice par paire (médiane)** ; une barre neutre proportionnelle à
  la médiane ; l'accent bleu seulement sur la meilleure médiane CONCLUE (deux sites
  avec au moins `SEUIL_CONCLUSION` = 5 ventes au bénéfice connu, et un écart) ;
- « 8 ventes · 460 € vendu · 170 € en tout » ;
- « sur 5 ventes finalisées · prix d'achat manquant pour 3 » (+ prix pas lu, frais
  pas lus, nommés) ;
- un site pas lu : « — » partout et la raison (« ventes Vestiaire pas lues ») ;
- « Saisir les prix d'achat › » (44 px) quand un prix manque : la porte de saisie
  en série de l'écran Annonces (`DEMANDE_SAISIE_PRIX`, la même que la carte du haut).

## D'où viennent les chiffres (aucun second calcul)

- **Ventes, vendu** : `liveStats.venduLignes` (`ventesFaites` — date de la vente,
  toutes plateformes, comptes sélectionnés, Solo/Pro par `excluAutreDe`). Une vente
  à l'argent pas lu (`venduNonComptees` : frais eBay pas lus, montant Vestiaire pas
  sûr, prix Vinted illisible) compte en vente, hors du montant, et fait dire
  « au moins » AU VENDU seulement ; un compte Vinted pas lu (`venduManque`) aussi.
- **Bénéfice** : le relevé `vrm_stats_ventes` publié par Ventes (ventes FINALISÉES,
  comptes écartés exclus), borné à la période de l'écran : par vente vente − achat −
  frais (`achatDe` + `chargesVente`, la règle de `beneficePaire`/`cascadeVente`,
  emballage compris) ; Leboncoin au prix final, eBay à l'argent reçu
  (`montantRecuEbay`, frais 0), Vestiaire au versé. Médiane et total sur les seules
  ventes au prix d'achat connu ; frais pas sus ≠ 0 ; jamais « au moins »
  (`src/beneficeNoms.js`). Relevé pas encore publié ⇒ « — », « ouvre Ventes ».
- Le mot affiché est « bénéfice par paire » (celui de `cascadeVente`) ; aucun
  `data-benef-notion` posé : ce n'est ni le « Bénéfice » net de Comptabilité ni un
  total de la période, pour ne pas mêler les notions du banc `benefice-unique`.

## Fichiers

- `src/margePlateforme.js` (règle pure : `margeParPlateforme`, `texteMarge`, `mediane`)
- `src/MargePlateforme.jsx`, `src/styles-marge-plateforme.css`
- `src/ecrans/Stats.jsx` : import, `onSaisirPrix` passé à `StatsVitrine`, la carte montée
- `scripts/audit-marge-plateforme.cjs` (23 contrôles, `--prouve` : 13/13 mutations
  rougissent ; rouge sur origin/main)
- `scripts/bancs/marge-plateforme.cjs` (390 tactile / 1512, clair et sombre)

## Reste

- Un site sans aucun compte relié s'affiche « 0 vente » (lu, vide) : pas de ligne
  « pas de compte ». À reprendre si Julien préfère cacher un site jamais utilisé.
- Geste de Julien : aucun.
