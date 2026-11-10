# 10 nov. · Lot N — l'Atelier dans Organisation

Julien (validé) : « Étapes d'atelier pour le stock … ça doit être dans Organisation ».

## Ce qui est livré
- **Organisation** (Réglages → Stock et rangement → Organisation) s'ouvre sur une
  nouvelle première section **Atelier**. L'équipe (« Mes missions ») et eBay
  (« Recherches enregistrées ») gardent leur section.
- Une **colonne par étape** — par défaut Reçue → Nettoyée → Photographiée → Mise en
  ligne — et en haut le **nombre par étape** (pastilles qui mènent à la colonne).
  « Modifier les étapes » : renommer, ordonner, ajouter, retirer (2 à 8 ; une étape
  qui porte des paires ne se retire pas : « avance-les d'abord »). Une étape gardée
  garde son id, donc ses paires.
- **Une carte par paire, par identité** : `a:{n° de transaction}` (achat Vinted, ou
  `a:ob_…` achat hors plateforme), ou `n:{N°}` tapé (même normalisation que partout :
  « 007 » = 7, B125). Jamais un titre : deux achats identiques = deux cartes.
  Le N° s'affiche seulement si un geste a relié l'achat (`buyFromId`).
- **Avancer** : bouton « → étape suivante » (44 px, au doigt), liste « Changer
  d'étape » (dont « Sortir de l'atelier »), et à l'ordinateur **glisser** une carte
  dans une colonne. Dernière étape : « Sortir de l'atelier ».
- « + Ajouter une paire » : les achats des 90 derniers jours (hors annulés) pas
  encore dans l'atelier, publiés par Comptabilité (Ma journée / Achats) dans
  `vrm_atelier_achats` sur CET appareil, seulement quand les achats sont lus en
  entier. Pas encore publiés ⇒ « — Achats pas encore lus sur cet appareil », jamais 0.
- **Ma journée** : une ligne **ambre** seulement si une étape (hors la dernière) a
  des paires depuis plus de 7 jours (« 1 paire à « Nettoyée » depuis plus de 7 j ») ;
  elle ouvre Organisation. Lecture projetée `select=a:data->atelier` (jamais
  `select=data` : la ligne porte le journal). Date illisible ⇒ ne compte pas.
- Rien n'est envoyé à Vinted ni à l'extension.

## Où
- Règles pures : `src/operations/atelier.js` (étapes par défaut, identités,
  résumé, ligne de Ma journée, achats publiés).
- Écritures : `src/operations/metier.js`, commandes `atelier.etapes`,
  `atelier.placer`, `atelier.sortir`, dans SA ligne `vrm_operations_v1` par la route
  Organisation existante (`/api/compte?mode=operations`) — journal, révision,
  idempotence comme le reste. Aucune nouvelle fonction `api/`, aucune migration.
- Écran : `src/operations/Atelier.jsx`, styles en fin de `operations.css`.
- App.jsx : publication des achats (après `buyNumByTxn`), `useAtelierJournee`, la
  ligne `atelier-attente` de Ma journée, `uid` passé à Organisation.

## Mode équipe
Le modèle des missions (`mission.etat`/`mission.etape`, une checklist par mission)
n'est pas le même (une file par paire) : l'atelier a ses propres commandes. Les
bornes du membre sont **inchangées** : il ne fait que `mission.etat`/`mission.etape`
(toute commande `atelier.*` est refusée « Action réservée au responsable ») et sa
projection ne porte que ses missions (il ne lit pas l'atelier).

## Preuves
- `node scripts/audit-atelier.cjs` (19 contrôles, la VRAIE route avec fetch simulé) :
  50 achats au même titre ⇒ 50 cartes ; avancer une carte ne bouge qu'elle ; un titre
  refusé comme identité ; membre refusé et sans lecture ; > 7 j hors dernière étape ;
  Ma journée projette `data->atelier`. Échoue sur origin/main (module absent) et par
  mutation : `membre`, `titre`, `septjours`, `derniere`, `projection`, `selectdata`
  (chacune rouge).
- Banc `scripts/bancs/atelier-organisation.cjs` (app réelle `dist/`, base inventée,
  390 tactile et 1512, clair et sombre, `BANC_CAPTURE`) : Organisation s'ouvre sur
  l'Atelier, nombres par étape, ambre à 9 j, « — » sans achats publiés, ligne de Ma
  journée, publication par n° de transaction, Ajouter / → étape / N° tapé / glisser,
  ni débordement ni cible < 44 px, aucune requête vers Vinted.
  Il a trouvé un vrai défaut avant livraison : Organisation tombait sur le garde-fou
  dès que l'atelier existait (`donnees[section].filter` sur un objet).
- `scripts/tests/operations-interface.cjs` : ouvre « Missions » après le chargement
  (le responsable arrive sur l'Atelier) ; il s'arrête, comme sur origin/main, à
  « capability status honest » (déjà rouge avant ce lot).

## Geste de Julien
Aucun. S'il veut changer les étapes : Atelier → « Modifier les étapes ».
