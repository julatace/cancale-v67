# Lot Y — Corbeille 30 jours — 10 nov. 2026

Branche `claude/corbeille` (depuis `origin/main`). Validé par Julien : proposition 38
(« Corbeille 30 jours pour ce qui est supprimé DANS VRM — récupérable ; un N° n'est jamais
redonné pour autant »), lot Y de `2026-11-09-file-des-lots.md`.

## Ce qui change pour lui

- Supprimer quelque chose **dans VRM** ne demande plus « Tu es sûr ? » : ça part tout de suite,
  la pilule du bas dit **« Mis à la corbeille »** et offre **« Annuler »** 5 s (lot B, inchangé).
- Ensuite, **Paramètres → Sécurité et sauvegarde → Corbeille** : la plus récente en haut, ce que
  c'était, « supprimé le 10 nov. · encore 30 j », et **« Restaurer »** (un toucher, 44 px). La
  restauration est elle-même annulable 5 s.
- Après 30 jours, l'entrée est purgée (et sa photo / son ticket vidés), pour de bon.

## Inventaire des suppressions (10 nov.)

| suppression | où | clé | branchée | note |
|---|---|---|---|---|
| achat hors plateforme | Achats → l'achat → « Supprimer cet achat » | `vinted_offvinted_buys` (liste, `id`) | ✅ corbeille, plus de confirmation | photo `achat_hors_photo_{id}` gardée, vidée à la purge |
| dépense, coût fixe, pack, abonnement | Argent → charges → « × » | `vrm_compta.{depenses,fixes,packs,abonnements}` | ✅ corbeille, plus de confirmation | ticket `depense_ticket_{id}` gardé, vidé à la purge |
| modèle de description | Paramètres → Annonces → Mes modèles | `vrm_modeles_desc` | ✅ corbeille, plus de confirmation | |
| réponse rapide | Messages → réponses rapides → 🗑 | `vinted_quick_replies` (textes ; liste par défaut si jamais rangée) | ✅ corbeille | n'avait pas de confirmation |
| fiche à publier | Achats → À publier → « × » | `vrm_fiches_neuves[id].retireeAt` | ✅ corbeille, plus de confirmation | le N° reste servi ; restaurer = même N° |
| note privée effacée | partout où la note s'affiche | `vrm_notes_paires` | ✅ corbeille | une note modifiée n'y va pas |
| fournisseur | Achats → Fournisseurs → « Retirer » | `vrm_fournisseurs` (personne, ses achats en gros, ses rattachements) + champs `buyGros`/`buyPrice` de ses paires | ✅ corbeille, **confirmation gardée** (plusieurs prix d'un coup, §2.5, décision lot B « prix-achat ») | restaurer remet les liens ; un prix retapé depuis est gardé |
| achat en gros | Achats → Fournisseurs → l'achat → « Retirer » | idem | ✅ idem | |
| supprimer sur Leboncoin / eBay / Vinted / Vestiaire | — | — | ❌ exprès | irréversible chez le site, confirmation gardée (§3) |
| N° de rangement | — | — | ❌ exprès | jamais rendu (§5) ; une fiche restaurée garde son N° |
| facture émise | — | — | ❌ exprès | jamais supprimée (avoir) |
| brouillon eBay | eBay → Brouillons | ligne dédiée (`modifierBrouillonsEbay`) | ❌ à faire | confirmation gardée ; il faudrait un restaurateur sur sa ligne |
| meuble, pièce, grille, N° d'une case | Stock | plan du Stock (sa ligne, `planLu`) | ❌ à faire | confirmation gardée (même raison que lot B) |
| vente saisie, article catalogue, article d'inventaire | anciens écrans `sales`, `catalog`, `inventory` | `vinted_sales`, `vinted_catalog`, `vinted_inventory` | ❌ | écrans hors menu (seulement par lien) ; confirmation gardée |
| suivi ajouté, QR posé, déclaration URSSAF retirée | Colis, Argent | — | ❌ | pas des « choses » qu'il a créées à garder ; inchangé |

`src/annulerCommandes.js` (`CONFIRMATIONS`) dit ce partage : `corbeille` pour les branchées,
`suppr` (gardée) pour le reste.

## La règle — `src/corbeille.js` (pur)

- Une entrée = `{ id, type, libelle, numero, at, morceaux, lignes? }`. Un **morceau** = la
  sous-valeur d'avant et d'après d'UNE clé : `cle` (clé d'objet, `sous` possible), `element`
  (élément de liste reconnu par `idCle`, ou par sa valeur exacte — jamais par ressemblance),
  `champs` (champs d'une fiche, jamais créée).
- Supprimer = les morceaux + l'entrée posée dans `vrm_corbeille` ; « Annuler » = l'inverse ;
  restaurer = les mêmes morceaux retournés + l'entrée retirée (`morceauxRestaurer`).
- **Conditionnel** : un morceau ne s'écrit que si la valeur est encore celle de départ — ce qui
  a changé depuis (prix retapé, élément revenu par un autre appareil) est gardé et compté ;
  idempotent (rejouer ne change rien). L'écran, lui, suit par identité (`force`).
- **§5** : un élément à N° ne revient pas si un AUTRE élément de sa liste porte ce N°
  (`planRestauration` ⇒ `conflit`, rien n'est écrit, c'est dit).
- **Lecture ratée ⇒ rien écrit** (`ecrireMorceaux` lit toutes les clés d'abord).
- `vrm_corbeille` est une carte `{ [id]: entrée }` dans la ligne `main` (SYNC_KEYS) : fusion
  par entrée entre appareils, comparer-et-échanger sur `data.rev` (`cloudPush`).
- Purge (`aPurger`) : > 30 jours ou au-delà des 300 plus récentes, une fois le nuage lu, au
  chargement (+5 s) et à l'ouverture de la corbeille ; lignes annexes (préfixes
  `achat_hors_photo_`, `depense_ticket_` seulement) vidées **seulement si l'élément n'est pas
  revenu** (`annexesAVider`) — c'était le défaut repéré sur l'essai `claude/relais-corbeille`
  du 4 nov.

## Le code

| fichier | quoi |
|---|---|
| `src/corbeille.js` (nouveau) | la règle (ci-dessus) |
| `src/App.jsx` | clé `vrm_corbeille` synchronisée ; `gesteMorceaux`, `gesteCorbeille`, `restaurerCorbeille`, `purgerCorbeille`, `viderLigneAnnexe`, `CorbeilleSetting` ; branchés : `delOffBuy`, réponses rapides, `FichesNeuves`, `editerNotePaire`, fournisseurs (`morceauxDelierFo`) |
| `src/ecrans/Achats.jsx`, `Compta.jsx`, `Reglages.jsx` | suppressions branchées ; ligne « Corbeille » dans Sécurité et sauvegarde |
| `src/styles-corbeille.css` | la liste (variables DA6) |
| `src/annulerCommandes.js`, `scripts/audit-annuler-commandes.cjs` | décision `corbeille` acceptée |

Les écritures passent par l'écrivain du lot B (`_ecrivainVrm`, `save`) ; après chacune,
`noterAvantDistant` + `emettreClesRelues` : un écran qui tient la clé dans son état se relit et
sa prochaine sauvegarde fusionne à trois voies (sinon un écran ouvert pouvait réécrire
l'élément restauré).

## Preuves

- `node scripts/audit-corbeille.cjs` : **30/30** (le vrai module : supprimer/restaurer exact
  pour liste, sous-liste, clé, champs, textes ; Annuler et rejeu idempotents ; prix retapé
  gardé ; élément revenu ni doublé ni écrasé ; N° pris ⇒ refus ; lecture ratée ⇒ 0 écriture ;
  purge 30 j / 300 ; photo d'un élément revenu jamais vidée ; branchements, confirmations des
  sites gardées). Sur `origin/main` : tombe (module absent). Mutations : champs non
  conditionnels ⇒ C1 rouge ; purge sans vérifier le retour ⇒ F3 rouge.
- Bancs mis à la règle (l'ancienne confirmation était leur contrôle) :
  `achats-hors-plateforme` (pilule, corbeille dans `main` avec la valeur exacte, photo pas
  vidée, « Annuler », Paramètres → Corbeille → « Restaurer ») et `compta-abonnements`
  (pilule, « Annuler », entrée dans `vrm_corbeille`).
- `npm run build`, audits variables, tdz, coherence, identite, icones, annuler-commandes,
  geste-annulable, fournisseurs, registres, fusion-nuage verts.

## Reste

Brouillons eBay et plan du Stock (lignes dédiées) ; anciens écrans hors menu.

## Geste de Julien

Aucun. Essayer : Argent → une dépense → « × », puis Paramètres → Corbeille → « Restaurer ».
