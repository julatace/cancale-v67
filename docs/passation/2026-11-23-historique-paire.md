# 23 nov. 2026 — Historique de la paire : « Rangée dans le Stock » (lot `claude/historique-paire`)

Validé par Julien le 23 nov. (n° 6) : « ligne de temps de chaque paire (achetée, numérotée, rangée, mise en ligne par
site, baisses de prix, offres, vendue, envoyée, payée/versée) dans la fiche, chaque événement par IDENTITÉ (jamais par
titre), date lue ; « pas su » si absent ; réutilise l'« Historique » existant de la fiche ».

## Ce qui existait (mesuré dans le code, pas refait)

- La fiche de la paire (src/FichePaire.jsx) porte « Dans l'ordre » (vue par défaut depuis le 15 nov.) :
  `src/paireHistoire/ligneDeTemps.js` (14 nov., idée 154 ; complété le 15 nov.) range PAR IDENTITÉ achetée, reçue,
  numérotée / renumérotée, photographiée (studio), publiée par site, vue en ligne, republiée, baisse / hausse / prix,
  offres reçues et faites (avec leur état lu), masquée / de nouveau visible / disparue, vendue, bordereau, partie,
  au relais, livrée, retour, versement, annulée, retour reçu, remise en stock ; « date inconnue » à part ; ce qui
  n'est pas lu NOMMÉ ; deux paires sous un N° ⇒ aucune histoire mélangée.

## Ce qui manquait, fait ici : « Rangée »

- Nouvel événement **`rangee`** (« Rangée dans le Stock », preuve « sa case du Stock »), placé dans l'ordre du cycle
  après « Numérotée » (`QUOI`).
- Par IDENTITÉ seulement (`rangementDuNumero`, src/paireHistoire/ligneDeTemps.js) : la fiche de CE N° dans
  `vrm_fiches_neuves` (la clé du N° `cleNum` : « 007 » = « 7 »), sa `case` et sa date `caseAt` (Atelier), sinon
  `rangeAt` (rangement à l'arrivée, gros lot) ; sans fiche datée, une case notée pour ce N° dans `vrm_slots` (le Stock)
  ⇒ « date inconnue » (le Stock ne date pas la pose : jamais une date déduite). Deux fiches sous ce N° ⇒ rien (on ne
  choisit pas) ; fiches pas lues ⇒ « Pas encore lu : la case du Stock ».
- Branchement : la fiche passe `vrm_fiches_neuves`, `vrm_slots` et `cleNum` (src/App.jsx, `extraTemps`) ; la vue
  (src/paireHistoire/LigneDeTemps.jsx) calcule par la règle. Textes `lt.quoi.rangee`, `lt.src.rangement`,
  `lt.pasSu.rangement` (5 langues, `idees.js`).

## Preuves

- `node scripts/audit-historique-paire.cjs` : **14 verts** sur 50 fiches inventées au MÊME titre. Mutations rouges
  (6/6) : `titre`, `double`, `passu`, `date-deduite`, `ordre`, `branche`. Code d'avant : `rangementDuNumero` n'existe pas.
- `node scripts/audit-idees-paires.cjs` (la ligne de temps du 14 nov.) : 36 verts, inchangé.

## Textes et boutons (consigne de Julien relayée le 23 nov. : « trop de texte, pas assez de beaux boutons »)

- Au plus une phrase courte par bloc (≤ 8 mots), le détail sous « Pourquoi ? » (repli `vrm-repli`), les gestes en
  boutons communs (`Bouton` natif, icône + verbe court). La branche `claude/style-clair` n'ajoute pas d'autre composant
  bouton : c'est celui de `src/natif/Bouton.jsx`.

## Mesures de la vraie base (lecture seule)

Mesures base (lecture seule, 23 nov. ~11:55 UTC, projections scalaires) :
- ext_appareil_* : 19 lignes, 1 owner, 19/19 à la forme attendue (data->>atMs, data->appareil->>nav).
- vrm_meilleures_sources : 0 ligne en base (publication sur l'appareil, normal).
- studio_photos_* : 0 ligne (personne n'a encore rangé de photo au studio).
- email_invoice_* : 24 lignes.
- main : vrm_colis_retirer présent sur 4 lignes main (1 colis, tuple à 8 cases, limite lue AAAA-MM-JJ, transporteur vinted) ;
  vrm_colis_aposter ABSENT de la base (publication de CET appareil seulement : la liste des envois n'existe que là où Colis/Ma journée l'a calculée) ;
  vrm_fiches_neuves ABSENT partout ; vrm_slots : 1 ligne main, 8 cases.

## ÉTAT À LA REPRISE

- Branche poussée ; banc de rendu (fiche « Dans l'ordre », 390/1512) et PR après 15:30 UTC ; fusion pas avant le
  24 nov. 07:00 UTC.
- Ce qui reste : les paires rangées par le Stock 3D avant l'Atelier n'ont pas de date de pose (« date inconnue ») ;
  dater la pose demanderait d'écrire `caseAt` au geste du Stock — pas fait ici (une donnée nouvelle, pas une lecture).

Geste de Julien : aucun.
