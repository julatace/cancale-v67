# 23 nov. · Lot D — Export pour l'expert-comptable : dépenses notées et reçu par plateforme (`claude/export-comptable`)

Julien (validé le 23 nov.) : « export mensuel/annuel pour l'expert-comptable (CSV et PDF lisible) : ventes (date de
vente, date de versement, plateforme, montant reçu), achats, frais, versements ; règles de l'app (même source que
Compta/URSSAF, comptes sélectionnés, « Vendu ≠ reçu », jamais « encaissé ») ; couverture affichée (manques nommés) ».

## Ce qui existait (mesuré dans le code)
`src/exportComptable.js` (9 nov.) et `src/exportComptableZip.js` (11 nov.) : Comptabilité → « Exporter pour mon
comptable », mois · trimestre · année, CSV (Excel FR), PDF d'une page, zip (PDF + xlsx + CSV + factures). Les ventes
(livre des recettes, datées au VERSEMENT, montant reçu, frais lus eBay), les ventes à dater, les achats (coût saisi),
le CA déclaré par mois, l'URSSAF (micro seulement), la couverture. **Il manquait les FRAIS** (les dépenses qu'il note
dans Comptabilité, « + Dépense ») et une vue des **versements par plateforme**.

## Ce qui est fait
1. `depensesPeriode(compta, bornes)` : les dépenses ponctuelles (`vrm_compta.depenses`) et les packs (`packs`) dont le
   MOIS est dans la période (la règle de `comptaChargesMois`), triés par date ; montant illisible écarté (jamais 0) ;
   coûts fixes et abonnements NOMMÉS « pas détaillés ici » (leur historique n'est pas connu — Comptabilité les compte
   au tarif actuel ; l'export ne les invente pas) ; ligne pas lue ⇒ « — ».
2. `recuParPlateforme(ventes)` : les lignes de ventes de l'export regroupées par site (nombre, montant reçu, frais
   lus) ; un site sans montant lu ⇒ « — » ; un montant pas lu ⇒ « au moins », nommé dans la couverture.
3. CSV : sections « REÇU PAR PLATEFORME » et « DÉPENSES NOTÉES DE LA PÉRIODE » ; résumé : « Dépenses notées » ;
   classeur du zip : feuilles « Reçu par site » et « Dépenses ». Le PDF reprend le résumé et la couverture.
4. Compta passe `vrm_compta` (la même ligne que « + Dépense ») ; illisible ⇒ null.

## Preuves
`node scripts/audit-export-depenses.cjs` (24 contrôles) vert ; `--prouve` 7/7 mutations rougissent. Sur le code
d'avant : rouge (D0). `audit-export-zip`, `audit-achats-export`, `audit-pas-su`, `audit-dates-paris` : verts.

## ÉTAT À LA REPRISE
- Poussé sur `claude/export-comptable`. Build et banc de l'export (capture du résumé à 390/1512) après 15:30 UTC ; PR ;
  fusion demain après 07:00 UTC. Ligne CLAUDE.md §9 à poser à la fusion.
- Geste de Julien : aucun.
