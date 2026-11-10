# 10 novembre — Lot AO : la Comptabilité reliée aux Statistiques (« Argent »)

Branche `claude/compta-stats`. Demande 8 du 9 nov. (21 h, `2026-11-09-propositions.md`) :
« Compta trop floue : la relier à Statistiques. » Et son retour le plus récent : peu de
texte, du visuel. L'extension n'est pas touchée.

## Ce qui change pour Julien

- **UNE entrée « Argent »** (icône €) remplace « Statistiques » et « Compta » dans la
  colonne et la barre du bas. Titre « Argent », quatre segments dessous, d'un toucher :
  **Résumé · Statistiques · Déclarer · Factures**.
- **Résumé** : en tête, quatre réponses en widgets (2 × 2 au téléphone, 4 sur une ligne à
  l'ordinateur) — « Vendu en nov. », « Reçu en nov. », « Bénéfice en nov. »,
  « À déclarer » (+ sa date). Toucher un widget = son détail : Vendu ⇒ Statistiques ;
  Reçu ⇒ « Vendu et reçu » ouvert ; Bénéfice ⇒ « Ton bénéfice » ouvert ; À déclarer ⇒
  Déclarer. Puis l'anneau et les six mois, puis le détail replié (bénéfice, vendu et reçu,
  bilan du mois, délai de paiement, porte-monnaie, dépenses, packs) — un titre et une
  phrase de ≤ 12 mots par repli.
- **Statistiques** : l'écran d'avant, entier (valeur du stock du lot BF comprise), sous
  le même titre ; « Mes ventes · Prix qui marche » reste sa rubrique.
- **Déclarer** : la prochaine déclaration URSSAF (« À recopier »), le suivi, DAC7 ;
  « Pour ton comptable » (export, registres, récap mensuel) ; « Ton statut ». L'ancien
  repli « Documents et réglages » n'existe plus : ses cartes sont rangées ici.
- **Factures** : l'écran Factures, sous le titre Argent.

## Les règles (rien de recalculé)

- `src/argent.js` (JS pur) : les segments, les chemins, et `questionsArgent` qui MET EN
  MOTS des chiffres déjà calculés par leurs propriétaires :
  vendu / reçu / bénéfice = `valeurChiffre` (src/design/carteChiffres.js, les mêmes
  valeurs que la carte de Ma journée), à déclarer = `previsionUrssaf` (la carte
  « Prochaine déclaration », lue par UN hook `usePrevisionUrssaf` partagé),
  statut = `profilFiscal`. Trois états (§5) : valeur · « — » + raison · texte (« Rien »
  pour un particulier, « Export » pour une société). Jamais « au moins 0 », jamais
  « encaissé ».
- Les deux écrans restent les mêmes composants (`dashboard`, `compta`) : mêmes lectures,
  mêmes publications (`vinted_urssaf_mois`, `vrm_benefice_jours`…), mêmes `data-*`. Un
  segment caché reste monté (`hidden`) : rien n'est supprimé.
- Anciens chemins : `?tab=dashboard|stats|statistiques|prixmarche` ⇒ Statistiques ;
  `?tab=compta|argent` ⇒ Résumé ; `?tab=compta&section=declarer` et `argent_declarer`
  (rappels URSSAF et DAC7 de Ma journée) ⇒ Déclarer ; `?tab=invoices` ⇒ Factures
  (`CHEMINS_ARGENT` dans `ONGLETS_DEPLACES` et la liste blanche des liens). Un geste qui
  vise une carte d'un autre segment y va d'abord (`vrm:argent-vue`) : « Les dater »
  (Déclarer) ouvre « Vendu et reçu » dans le Résumé ; « Dater » d'À trancher aussi.

## Preuves

- `scripts/audit-argent.cjs` (24 contrôles ; `--prouve` : 8/8 mutations rougissent).
- `scripts/bancs/argent.cjs` : statuts A (pas choisi) / B (micro, mensuel) / C
  (particulier), 390 px tactile et 1512 px, clair ET sombre. **AVANT = APRÈS** : les
  chiffres relevés (bénéfice et son calcul, prévision URSSAF, résultat, charges, vendu et
  reçu, bilan, « Comparer ») sur le build de `origin/main` (`BANC_DIST=… BANC_JSON=…
  BANC_STRUCTURE=0`) puis exigés à l'identique (`BANC_REFERENCE=…`). Structure : titre,
  quatre segments sous le titre et **aucun segment coupé** (« Statisti… » vu en capture
  à 1512 px, corrigé : la piste prend ses 640 px), les quatre réponses égales à leurs
  sources, toucher = détail, anciens liens, 44 px, ≤ 12 mots, aucune erreur JS.
- Bancs remis à la règle d'Argent : `compta-stats-coherence`, `_compta.cjs`
  (`allerSegment`), `compta-simple`, `menu-range`.
- Audits verts : variables, tdz, coherence, identite, icones, urssaf, benefice,
  cout-vente, argent.

## Ce qui reste

- Le libellé « Statistiques » du segment se lit en entier ; si Julien le veut plus court
  (« Stats »), c'est `SEGMENTS_ARGENT` (src/argent.js), une ligne.
- Geste de Julien : aucun.
