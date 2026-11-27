# 27 nov. · « Fait la compta » + « l'export comptable pour l'URSSAF » (`claude/compta-export`)

Julien (27 nov.) : « Fait la compta » et « Fais aussi l'export comptable pour l'URSSAF ».

## Ce qui existait (mesuré dans le code, rien dupliqué)
`src/exportComptable.js` (9 nov.), `src/exportComptableZip.js` (11 nov.), dépenses et reçu par site (23 nov.) :
Argent → Déclarer → « Pour mon comptable » (mois · trimestre · année ; zip PDF + xlsx + CSV + factures).
Le « récap comptable » retenu le 11 oct. EST cette carte : elle est ÉTENDUE, pas refaite.
Il manquait : le détail vente par vente (prix de vente, prix d'achat, port, bénéfice, référence de l'achat), les
ventes dans une autre devise listées à part, un fichier qu'un logiciel de compta importe, et toute la partie URSSAF.

## A. « Pour mon comptable » — étendu
- **Colonnes par vente** (CSV détaillé, feuille « Recettes » du xlsx) : date de vente, date de versement, plateforme,
  compte, N°, référence, titre, **prix de vente**, montant reçu, frais lus (eBay), **frais notés**, **prix d'achat**,
  **dont port**, **bénéfice**, **réf. achat**, note. Source : le relevé de Ventes (`vrm_stats_ventes`) retrouvé par
  l'IDENTITÉ de la vente (`cleReleve` = la clé de `recettesDe`) ; une identité portée deux fois ⇒ rien.
  Bénéfice = `margesPar` (src/statsVentes.js, la règle des marges de Statistiques : vente − achat − frais notés ;
  achat ou frais pas sus ⇒ vide). Total « Bénéfice de ces ventes » avec sa couverture « N sur M », jamais « au moins ».
- **eBay** : prix de vente « — » (VRM lit ce que tu reçois, `montantRecuEbay`, pas le prix payé par l'acheteur).
- **Frais plateforme** Vinted/Leboncoin/Vestiaire : vides (décision du 11 nov., inchangée).
- **Réf. achat** : la ligne du registre des achats dont les fiches reliées (`buyFromId`, SON clic) portent le N° de
  la vente — UNE seule, Vinted seulement ; « (reçu Vinted) » quand le montant vient de SON reçu (par son n°).
- **Autre devise** : sortie des lignes et des totaux, listée à part (« jamais convertie »), nommée dans la couverture.
- **Fichier pour un logiciel** (Pennylane, Tiime, Indy) : `Ventes-<période>-import.csv`, UNE ligne d'en-tête, une
  ligne par vente versée (date où elle compte, montant reçu, colonnes ci-dessus), « ; », virgule, BOM. Ni à dater, ni
  montant pas lu, ni autre devise (le récap les nomme). Aussi dans le zip (`3-Import-logiciel-…csv`).
  ⚠️ Pas essayé dans ces logiciels (aucun accès) : à tester une fois par Julien ou son comptable.
- Correctif de cause : la carte (et « Registres ») attendent les **dates de versement** (`versements === undefined` ⇒
  en cours) — avant, elle s'affichait « lu » avec **0 vente Vinted** le temps de la lecture (vu au banc, 390 sombre).

## B. « Pour l'URSSAF » — nouveau (`src/exportUrssaf.js`, carte `ExportUrssafCarte` dans « Combien je dois déclarer »)
- Périodes selon SON rythme **enregistré** (`vinted_urssaf_freq`) ; pas enregistré ⇒ « Tu déclares par mois ou par
  trimestre ? » et SON clic l'écrit. Défaut : la dernière période finie. Date limite : `calendrierUrssaf`.
- Montant = `caDeclare` (ligne publiée par Ventes, `montantPeriodeUrssaf` : le chiffre de « Prochaine déclaration »),
  « au moins » quand c'est un minimum. Ligne : « Ventes de marchandises (BIC) — achat-revente ». Taux 12,4 % par
  défaut (`tauxUrssaf`), cotisation `aPayerUrssaf` — micro seulement ; statut `null` ⇒ « régime à choisir », « — ».
- Les ventes derrière le chiffre : `ventesDeclarables` AVEC le registre `vrm_urssaf_declare` (`avecDeclarations`) —
  une vente déclarée compte dans le mois de SA déclaration (« déclarée en … (versée en …) »). À dater : à part.
  Mois déjà notés « déclarés » marqués. Seuils 2026 (`caAnnee` + `seuilsDe`) et note DAC7 (`dac7ParPlateforme`).
- PDF « à recopier sur autoentrepreneur.urssaf.fr » (cases, mois, à savoir, puis les ventes ligne par ligne) + CSV.
- `api/_lib/urssaf-regle.js` non touché.

## Preuves
- Banc `scripts/bancs/compta-export.cjs` (neuf, dans la CI part 2) : 1512/390 × clair/sombre, **171 verts**.
  Export comptable : CA et URSSAF = carte « Prochaine déclaration » = ligne publiée ; ventes = « Registres » ;
  N°12 : prix 61, achat 20, port 3, bénéfice 38, réf. 7100001 (reçu) ; compte exclu dans aucun fichier ; 91004 « à
  dater » seulement ; fichier logiciel : une ligne d'en-tête, somme = l'écran. URSSAF : montant et cotisation = l'écran ;
  91009 (déclarée le mois d'avant) hors du mois et dans le sien ; rythme jamais deviné ; « régime à choisir ».
- Rouge sur `origin/main` (arbre `git archive`, banc copié dedans, 1512 sombre + 390 clair) : 13 rouges (aucune carte
  URSSAF, aucun bénéfice, et « 0 vente » le temps de lire les versements). Sous mutation (1512 sombre) : registre des
  déclarations ignoré 9 rouges · « à dater » comptée 8 · compte exclu compté 8 · bénéfice sans frais 2 · rythme deviné
  (trimestriel) 21 · « à dater » ajoutée au montant URSSAF 9.
- Audits compta/URSSAF/bénéfice/bilan/DAC7/argent/export, traduction, quoi-de-neuf, cohérence, icônes, boutons :
  verts. `audit-achats-export` (copie de statsVentes.js) et `audit-export-depenses` (motif suivi) remis au code étendu,
  `--prouve` 8/8 et 7/7. `npm run build`. `ci-controles --diff origin/main` : un banc bloquant ajouté, rien retiré.
- Bancs compta voisins verts : chiffres-coherents, argent-mois, livre-registre, recap-mois, rappel-urssaf.

## Rouges DÉJÀ sur `origin/main` (pas de ce lot, identiques ligne à ligne avant/après)
achats-export (A, saisie en série : 8), registres (achat en gros dans le tableur : 4), urssaf (carte du mois
introuvable : 2), suivi-urssaf (8, `scrollIntoView` expiré), declare-urssaf (26), dac7-comptes (12 : la vente « à
dater » vendue cette année est comptée par la règle du 6 nov. — `aDaterAnnee` — le banc attend l'ancienne), export-donnees
(4), compta-claire (16, `data-benef-etat="lu"` caché), statut-fiscal (4), seuils-prevision (4). Et `audit-pas-su
--prouve` 6/7, `audit-registres --prouve` 17/18 (motifs disparus). Aucun n'est dans la CI bloquante. Premier
diagnostic : sélecteurs d'avant le design natif et données datées qui ont vieilli, pas une erreur de calcul vue — à
reprendre banc par banc dans un lot à part.

## Décisions pour Julien
1. Ailleurs dans l'app (`lireFreqUrssaf`, Suivi des déclarations), le rythme non choisi vaut **trimestriel** par défaut.
   L'export URSSAF, lui, ne devine pas. Garder ce défaut ailleurs, ou demander partout ?
2. Le livre des recettes (Registres, export comptable) range les ventes au mois du VERSEMENT, le CA déclaré au mois
   de la DÉCLARATION ; quand une vente a été déclarée un autre mois, l'export le dit (« diffèrent »). L'export URSSAF
   suit la déclaration. Aligner aussi le livre des recettes sur les déclarations ?
3. Le fichier « pour un logiciel » : à essayer une fois dans Pennylane / Tiime / Indy.
4. Le contenu des fichiers (PDF, CSV) reste en français (documents pour l'administration française) ; l'écran est traduit.

## Geste de Julien
Aucun pour que ça marche. (Choisir son rythme dans la carte s'il ne l'a jamais fait.)
