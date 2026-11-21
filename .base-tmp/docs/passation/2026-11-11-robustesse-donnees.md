# 11 nov. 2026 — Robustesse des données (second agent, branche `claude/agent2-robustesse-donnees`)

Corrections des points critiques et hauts de la revue « couche données »
(`git show origin/claude/agent2-robustesse:docs/passation/robustesse/donnees.md`),
plus quelques « moyenne ». Pas d'extension. `emailSoldIds` (point 12), Colis et OAuth : hors zone, pas touchés.

## Ce qui a changé

| point de la revue | avant | maintenant |
|---|---|---|
| 1 (critique) `vinted_lbc_posted` pas lu | la cloche publiait une liste « à retirer de Leboncoin » VIDE pour le logo de leboncoin.fr | `postedIds = null` (pas lu) ⇒ rien jugé, rien publié ; le logo garde sa dernière liste |
| 2 (critique) vendeur A puis B dans le même onglet | des dizaines de caches de module (lignes 60 s, lectures publiques, comptes eBay, ventes de la coque, factures, parcours…) gardaient A | « Se déconnecter » recharge la page (`/?connexion`, 300 ms pour le message à l'extension) ; un vendeur remplacé par un autre sans déconnexion ⇒ rechargement aussi (`writeSession`) |
| 13 (haute) déconnexion avec une file d'envoi pleine | file effacée sans un mot | `seDeconnecter()` (src/deconnexionSure.js) : rien en attente ⇒ la question d'avant ; sinon « N changements pas encore envoyés » · **Envoyer d'abord** (attend la file vide, puis déconnecte ; échec ⇒ reste connecté et le dit) · Me déconnecter quand même · Annuler. Menu du profil, Réglages, « Changer de compte VRM », portes abonnement/équipe |
| 5 (haute) écran Leboncoin, `vinted_lbc_posted` pas lu | la file « à publier » listait tout, « Publier » en série republiait | file vide, « — à publier », bloc de panne : « ce qui est déjà sur Leboncoin … je ne propose rien à publier (risque de doublon) » |
| 11 (haute) achat écarté par le titre (« n 1234 ») | un vrai achat disparaissait | écarté seulement si la même transaction est dans SES ventes |
| 9 (haute) deux onglets | B renvoyait l'ancien jeton (révocation possible) | renouvellement sous `navigator.locks` ; dans le verrou, la session rangée par l'autre onglet est adoptée ; l'écouteur `storage` adopte aussi (src/sessionOnglets.js) |
| 3, 4 (haute) `vrm_room`, `vrm_email_owners` | réécrites entières depuis l'état lu à l'ouverture | relire → fusionner ce que l'écrivain a changé (fusion3) → PATCH conditionnel `data->>rev` (src/ligneCas.js), devancé ⇒ relu, refait ; la pièce : base = pièce lue par l'écrivain, résultat vérifié (toast si refusé), écran mis à jour avec la pièce écrite |
| fusion des listes | une liste d'objets à `id` fusionnée par contenu (doublons, point 38) | par `id`, champ par champ (src/fusionNuage.js) |
| 7 (haute) relais des commandes | page 2…12 ratée ⇒ liste partielle « ok » ; coupure muette à 1 200 | page ratée ⇒ `ok:false` ; 50 pages ; plafond sur page pleine ⇒ `ok:false` |
| 31 relais du dressing | lecture partielle datée « à l'instant » | partielle ⇒ `ok:false`, ni `lu` ni `complet` |
| 8, 28, 32 `fetchHarvest` | `null` pour « pas de ligne » ET « base en panne » ⇒ relais serveur sur un hoquet | `undefined` = pas su ; boîte et dressing rendent « pas su », 0 appel au relais |
| 57 `lireTout` | levait sur coupure / corps HTML | rend `null` |
| 49, 61 copie locale avant `save` | le geste n'entrait pas dans la file d'envoi | `ecrireCopieLocale` garde le texte d'avant (liens Leboncoin, « aucune paire », imprimante, lettre des N°, `saveTout`) |
| 24, 30, 41, 77 | liste noire illisible ⇒ comptes supprimés revenus ; « sans auteur » sur une coupure ; widget jamais réécrit après un refus ; échec gardé 60 s | dernière liste connue ; seulement si la grammaire est refusée ; empreinte retirée sur refus ; échec non gardé |

## Preuves
- `scripts/audit-robustesse-donnees.cjs` : 34 contrôles verts ; sur `origin/main` (git archive) **14 rouges** (fonctions d'App.jsx extraites et EXÉCUTÉES : relais, lireTout, fetchHarvestBrut, boîte/dressing, pièce, tri des achats) ; `--prouve` **11/11 mutations** attrapées.
- `scripts/bancs/robustesse-donnees.cjs` (app rendue, base à état, 390 tactile et 1512, clair et sombre) : **tout vert** (5 scènes) ; sur le build d'`origin/main` : lbc 1 rouge, leboncoin 8, deconnexion 6, vendeurs 3 (pas de rechargement : la page de A reste), onglets 2 (2 réutilisations de l'ancien jeton, un onglet lit avec le jeton périmé). Captures regardées (question de déconnexion, écran Leboncoin sombre).
- `npm run build` ; audits variables, tdz, coherence, identite, icones, lecture-groupee (mis à la règle « pas su ⇒ undefined »), lectures-lourdes, fusion, fusion-nuage, file-envoi : verts. Les ~475 audits relancés : aucun rouge nouveau.
- Bancs voisins : `numeros-reconnexion` vert ; `lbc-preuve` 10 rouges avant comme après (pré-existants) ; `file-envoi` 20 rouges déjà sur `main` (la saisie en série ne s'ouvre plus) — sa ligne « L : la saisie reste en attente » passait sur `main` grâce à une entrée parasite `vrm_reprise_ecrans`, pas à la saisie : à reprendre avec ce banc.

## Ce qui reste (revue, « moyenne »/« basse »)
14-23, 25-27, 29, 33-37, 39-40, 42-48, 50-56, 58-62 et les basses : voir la revue. Notamment `push_prefs`/`vrm_pro_facture`/`ebay_brouillons`/`studio_photos` sans comparer-et-échanger (même motif : `modifierLigneCas`), devises non-EUR (37, 50, 51), `save` différé de 500 ms sans vidage au `pagehide` (36).

## Gestes de Julien
Aucun.
