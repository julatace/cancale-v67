# 16 nov. 2026 — lot `retirer-case-compact` : la case allumée, rien d'autre

## Les demandes de Julien (dans l'ordre)
1. « enlever la paire de sa case ça prend trop de place » ;
2. « ça doit juste être un pop up, la case dans l'onglet Stock doit juste être en surbrillance » ;
3. (remplace 2) « Dans l'onglet Stock, la case doit être en surbrillance si l'article n'est pas rangé/retiré — PAS DE POP-UP » ;
4. « Dans le Stock, quand une paire est vendue ET expédiée, elle est d'office supprimée du Stock ; il faut bien tout articuler ».

Une version avec fenêtre a été écrite (étape 2) puis retirée avant tout commit poussé : aucune fenêtre n'a jamais été en ligne.

## Ce qui prenait la place (mesuré, banc `stock-case-a-sortir` et `paire-a-sortir` sur le build de `main` du 16 nov.)
| écran | bloc | 390 px | 1512 px |
|---|---|---|---|
| Stock | « Vendues à sortir · N » (une ligne par paire, « Je l'ai sortie », « Le chemin pour les sortir », « Sélectionner ») — 2 paires | **988 px** (le texte s'y cassait lettre par lettre) | **276 px** |
| Ma journée | « La paire à sortir en premier » (grande photo, mini-plan, Avant / Maintenant) — 4 ventes | **737 px** | **621 px** |
| fiche d'une paire (Stock) | « Retirer de la case » + « Je l'ai sorti » (plein) | 1 rangée + 1 bouton plein | idem |

Après : **0 px** partout (les bancs le mesurent et l'exigent). Gain : 988 + 737 = **1 725 px** au téléphone, 276 + 621 = **897 px** à l'ordinateur, sur ce jeu de données.

## Ce qui reste
- **La case de la paire vendue encore rangée est EN SURBRILLANCE** (`is-vendue` : contour de l'accent bleu, jamais rouge) — c'était déjà le cas ; le badge « Vendue » DANS la case est retiré (`Vignette({ dansCase })`) : plus aucun mot en plus dans la case. Le mot reste sur la fiche et les listes, la légende du plan est inchangée.
- **Toucher la case allumée la sort** : le geste « Je l'ai sortie » d'avant (déclaration `vinted_pairs_lost` de CE N° par identité + case libérée, pile tassée par `sortieCaseStock`) devient un geste **annulable** (`gesteVrm`, pilule « Annuler » 5 s, `stock.sortir`) ; la descente d'une pile est dite une fois sur le meuble (le bandeau, comme au rangement). Aucune fenêtre, aucune fiche ne s'ouvre. Le N° n'est jamais touché (§5).
- « À faire » du Stock : « N ventes à sortir du stock » désigne leurs cases sur le plan (l'ancien « chemin pour les sortir », `data-vendues-chercher`). La section « À faire » ne pose plus son titre quand elle n'a aucun bloc.
- La série du Stock ne porte plus que « Plus en ligne ».
- Ma journée : plus de carte ; « Imprimer les N bordereaux » redevient le plein de l'écran. `src/paireASortir.js` (l'ordre, la case par identité) reste : les rangées de colis à l'ordinateur disent toujours la place du carton.
- `src/PaireASortir.jsx` supprimé.

## Le tableau des états (règle unique : `partieDuStock`, `src/stockSortie.js`)
| état de la paire rangée | preuve | dans le Stock |
|---|---|---|
| en ligne / pas vendue | — | case normale |
| **vendue, pas expédiée** | vente prouvée (§5) — `vrm_stock_vendus` | **case en surbrillance** ; son toucher la sort (annulable) |
| **expédiée prouvée** | statut de la plateforme parti (`venteSortieDuStock`, Leboncoin/eBay/Vestiaire) **ou** preuve du transporteur pour le n° EXACT du bordereau de CETTE transaction (`partisVinted` = `ventesPartiesParPreuve` : e-mail `email` de dépôt/en route/livré, `transporteur` prise en charge) | **sortie automatique** : case libérée, surbrillance éteinte, journal `vrm_stock_sortis` (« Cases libérées toutes seules », 60 j, « Remettre »), historique de la fiche « Case du Stock libérée (colis parti) — le N° reste » |
| « Colis fait » coché, « expédié » à la main, « traité » au panneau seuls | déclaration, pas une preuve du transporteur | **rien** (décision du 27 oct. : un colis coché peut ne jamais être parti) — la case reste allumée |
| vente annulée, retour, non réclamée (PAS_UNE_VENTE) | — | **jamais** sortie, même avec une preuve |
| lecture ratée (ventes, annonces, e-mails pas lus) | `null` | **rien** (l'effet attend tout lu ; une raison absente ne sort rien) |
| paire remise à la main (« Remettre ») | `vrm_stock_garder` | plus jamais sortie toute seule |
| retour d'une vente | geste existant (retour → stock) | « Remettre » rend SA case seulement si elle est libre ; prise par une autre paire ⇒ rien posé, il choisit |

Nouveau ici : la 2e ligne de preuve (l'e-mail / la prise en charge du transporteur, quand la liste Vinted dit encore « à expédier ») — avant, seul le statut Vinted sortait la paire. Le libellé du journal dit d'où vient la sortie (« colis déposé (e-mail du transporteur) » / « pris en charge par le transporteur »).

## Preuves
- `scripts/bancs/stock-case-a-sortir.cjs` (390 tactile et 1512, clair et sombre, `locale fr-FR`) : surbrillance exactement sur N°3 et N°7 (même titre, chacune sa case), à l'accent, sans mot ; aucun bloc ; la fiche sans « Retirer de la case » ni « Je l'ai sorti » ; le toucher sort N°3 sans fenêtre (case libérée, déclaration notée, pilule) ; « Annuler » la remet ; Ma journée sans carte. **56 OK** sur ce lot ; sur le build de `main` : **rouge** (13 KO : badge dans la case, bloc de 988 px, fiche avec les deux boutons, toucher qui ouvre la fiche…).
- `scripts/bancs/paire-a-sortir.cjs` : la règle R1–R5 et ses 6 mutations (inchangées) ; la partie A exige l'absence de la carte : vert ici, **rouge sur `main`** (737 / 621 px).
- `scripts/audit-sortie-expedition.cjs` : E1–E6 sur les vraies règles + `--prouve` (6 mutations, chacune rougit : annulée ignorée, « Colis fait » suffit, absence qui sort, preuve ignorée, « Remettre » qui écrase, App sans la preuve partagée).
- Bancs portés sur la RÈGLE : `stock-annonces` D (case allumée, aucun bloc), `stock-retrouver` (« À faire » désigne les vendues), `stock-etageres` E/F et `stock-planches` (la sortie d'une pile se fait par la case allumée d'une paire dite vendue), `fiche-partout` (la fiche Stock n'a plus `data-fiche-retirer`).
- Captures regardées : `s-390-clair-meuble` (N°3 et N°7 cerclés de bleu), `s-390-clair-apres` (N°3 sorti, « N°3 sorti du stock · Annuler »), `s-1512-clair-meuble`, avant/après Ma journée.

## Ce qui n'est pas fait (et pourquoi)
- « Plus en ligne » (une paire rangée qui n'est plus en ligne) garde son bloc avec « Je l'ai retirée » / « Encore là » : ce n'est pas une paire vendue, la case est déjà signalée à l'ambre, et « Encore là » n'a pas d'équivalent sur un simple toucher. À trancher par Julien si ce bloc doit aussi partir.
- Une paire rangée **pas vendue** ne se retire plus de sa case depuis la fiche (seul « Déplacer » reste) : c'est la consigne (« aucun retirer de la case dans la fiche ») ; si une paire sort pour une autre raison, « Vendu ailleurs » libère la case.
- L'annulation d'une sortie automatique se fait par « Remettre » dans « Cases libérées toutes seules » (Stock), pas encore depuis la fiche elle-même (l'historique de la fiche la montre).

## ÉTAT À LA REPRISE
- Branche `claude/retirer-case-compact`, **PR #1197 ouverte, PAS fusionnée** : règle de Julien du 16 nov. « zéro rouge pour fusionner, y compris les rouges déjà sur `main` des jobs touchés ». La CI de la PR a les MÊMES rouges que `main` (comparé job par job, liste par liste) : Audits 1–3 (68 audits KO, tous déjà KO sur `main` — 70 là-bas), Bancs 1 et 3 (accessibilite-clavier, annonces-actions, argent-mois, chiffres-coherents, colis-retirer-propre, iphone-reprise, nouveau-vendeur, retraits-suivi — identiques), Bancs 2 annulé au délai de 45 min (comme sur `main`), parcours-critiques (regles, comptes-et-reception, écrans…) rouges aussi sur `main`. **Aucun rouge nouveau** venant de ce lot. `journee-coherence` (banc de Ma journée) rejoué en local sur le build de `main` et sur celui du lot : les mêmes KO (1512 : « À faire » invisible, E3/E6/E7/E8/E9/E10), donc déjà là.
- Rouges corrigés en passant : `audit-stock-etageres` (il ne copiait pas les règles de `src/` qu'importe `api/_lib/argent-notif.js` ⇒ 56/56 vert).
- Pour fusionner : attendre que `main` soit vert sur ces jobs (lots `bancs-rouges-a/b`), refusionner `main`, relancer la CI.
- Conflit possible avec `claude/bancs-rouges-a` sur `scripts/bancs/stock-planches.cjs` (le helper `retirer` passe maintenant par la case allumée d'une paire dite vendue : la fiche n'a plus « Retirer de la case »).

## Correctif du train (16 nov., soir) — perte de rangement à 390 px
Mesuré (banc `stock-planches`, 390 px) : après des sorties par la case allumée puis « Modifier le meuble → Enregistrer », N°3 sortie réapparaissait et N°5 posée disparaissait. Cause : `relire` (sur `vrm:stock-slots`) REMPLAÇAIT les cases de l'écran par `vrm_slots` de l'appareil, qui peut être en retard (le Stock écrit 500 ms plus tard ; le geste annulable écrit après sa vue) ; et `sortirAnnulable` calculait ses opérations sur cette même copie périmée. L'éditeur réenregistrait ensuite l'état périmé.
Correctif (`src/ecrans/Stock.jsx`) : `relire` FUSIONNE PAR CASE (base = dernière lecture de l'appareil, `baseSlotsRef` ; une case que l'écran a changée garde la valeur de l'écran, les autres prennent celle de l'appareil) ; `sortirAnnulable` part de l'état courant (`slotsRef`, `opsSortieCases`). `stock-planches` vert à 390 et 1512 (rouge avant, mesuré par le train sur 14f030419) ; `stock-case-a-sortir` reste vert.
