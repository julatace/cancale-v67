# 11 nov. — Les lignes floutées regroupées par compte (`claude/agent2-regroupe-comptes`, second agent)

## La demande (Julien, 11 nov., 22 h 10, mot pour mot)
« C'est très bien de flouter les ventes et infos des autres comptes lorsqu'on est connecté à un compte ou
qu'on regarde un compte, mais les ventes ne sont pas regroupées et donc ce n'est pas très lisible : peux-tu
regrouper ça mieux ».

Précision transmise par l'agent principal (capture Achats → Vinted, 1512 px) : l'en-tête de l'app disait
« angeled92 » alors que les lignes NETTES étaient celles de « shop_cancale ».

## Ce qui décide « le compte regardé » (vérifié avant de coder)
- **Vinted** : `selEff = compteEffectif(compteSel, compteConnecte, …)` (App.jsx) — **son choix d'abord**
  (puce de compte, mémorisée PAR SITE et suivie d'un appareil à l'autre par la reprise d'écran), sinon le
  compte ouvert dans Chrome (`etatActionsExt(...).niveau === 'ok'`), sinon rien (« pas su » ⇒ aucun flou).
  Le flou (`estFloute`) et désormais les groupes lisent CE `selEff`.
- ⇒ La capture de Julien s'explique par un choix mémorisé (shop_cancale) qui prime sur le compte de Chrome
  (angeled92). Rien de faux dans le flou ; c'était seulement **non dit**. L'en-tête du groupe le dit
  maintenant : « **Compte choisi** : shop_cancale · N achats » avec, à droite, « **Chrome : angeled92 ›** »
  (un toucher passe au compte de Chrome) ; sans choix : « **Compte ouvert dans Chrome** : … ».
- **Leboncoin** : `compteLbcOuvert` (session relevée < 12 h) · **Vestiaire** : `compteVcOuvert`
  (`vc_session` < 12 h) — src/flouCompte.js, inchangés.

## Ce qui change
- `src/regroupeComptes.js` (pur) : `grouperParCompte(lignes, { ouvert, floute, compteDe })` — l'écran passe
  **son** prédicat de flou ; groupe 1 = lignes nettes du compte ouvert ; groupe « compte pas relevé » = lignes
  nettes sans ce compte (jamais attribuées) ; puis un groupe par autre compte (lignes floutées), dans l'ordre
  de leur ligne la plus récente. L'ordre reçu (le plus récent en haut, `ordreRecent`) est gardé DANS chaque
  groupe. Aucun compte ouvert, ou rien de flouté ⇒ `null` : la liste reste exactement comme avant.
  `entreesGroupees` : la liste à dessiner (en-têtes + lignes), autres comptes **repliés** par défaut, la
  tranche « Afficher les suivantes » porte sur les lignes nettes, les autres comptes suivent en bas.
- `src/GroupesComptes.jsx` + `src/styles-groupes-comptes.css` : en-têtes DA6 (13/600 gris, nom en encre),
  « Autres comptes · 2 comptes · 33 ventes », une rangée de 48 px par compte (« compte_b   17 ventes › »,
  chevron qui pivote, `aria-expanded`). Aucun accent sauf le geste « Chrome : … › ». `ListeParCompte` pour
  les listes simples (`enLi` : un `<li>` pleine largeur dans les grilles d'annonces).
- Branché sur : Ventes et Achats Vinted (Comptabilite ; pas dans « Colis à retirer »), Ventes et Achats
  Leboncoin, Annonces Leboncoin (`AnnoncesLeboncoin.jsx`), Ventes, Achats et Annonces Vestiaire.
  Les annonces Vinted étaient déjà rangées par compte (grille du lot AM) : pas touchées. Messages : sujet
  `agent2-messages`, pas touché.
- **Aucun total ne bouge** : `ventesAffichees` / `achatsAffiches` restent la liste entière (compteur
  « N résultats », bandeau prix d'achat, fiabilité, série) ; seul le dessin change.
- ⚠️ Nuance avec la règle du 9 nov. (« du plus récent au plus vieux, peu importe le compte », lot AJ) :
  elle reste vraie sans compte mis en avant (« Tous les comptes », téléphone, lecture seule) ; avec un compte
  mis en avant ET des lignes floutées, la dernière demande de Julien regroupe (date gardée dans chaque groupe).

## Preuves
- `scripts/audit-regroupe-comptes.cjs` : 17 contrôles de la règle (50 ventes inventées, 3 comptes : rien
  perdu ni doublé, mêmes totaux, ordre par date dans chaque groupe, pas su ⇒ null, suit le prédicat de
  l'écran) + 8 contrôles des écrans. **8 rouges sur origin/main** (f04d4a580) ; `--prouve` : 6 mutations
  (groupe sans regarder le flou, sans-compte rangé dans le compte ouvert, pas su groupé, déplié par défaut,
  ligne perdue, ordre perdu) toutes rouges.
- `scripts/bancs/regroupe-comptes.cjs` (nouveau, données inventées, 50 ventes + 12 achats sur 3 comptes,
  faux pont connecté sur compte_a) : Ventes à 1512/390 tactile, clair/sombre, Achats 1512 clair et 390
  sombre, « Tous les comptes », choix ≠ Chrome. **0 rouge ; 27 rouges sur le build d'origin/main.**
  Captures regardées (avant : lignes nettes et floues alternées ; après : compte ouvert, puis « Autres
  comptes » repliés, dépliés floutés par date). `SHOTS=dossier`, `BANC_DIST`, `BANC_PORT`.
- Bancs existants adaptés à la nouvelle règle (ils déplient les groupes avant de juger le flou, et
  vérifient que l'autre compte est bien regroupé, replié) : `filtre-compte` (3 rouges restants = les mêmes
  que sur origin/main, Messages), `lbc-flou-compte` (1 rouge « Favoris reçus » 1512 = déjà sur origin/main,
  intermittent), `vestiaire-fiches` (6 rouges = les mêmes que sur origin/main).
- `npm run build` ; audits variables, tdz, coherence, identite, icones, chiffres, ordre-recent, retrait,
  vente-email-fraiche, ventes-prix-achat : verts.

## Ce qui reste
- Leboncoin/Vestiaire : le nom du compte reste écrit sur chaque ligne (déjà dit dans l'en-tête) — le
  retirer demande de distinguer « compte pas su » de « dit dans l'en-tête » dans `CarteLbc` /
  `LigneVenteVc` ; laissé tel quel (même risque vu sur Vinted : `compte={null}` y affiche « compte Vinted non
  relevé », faux).
- Les comptes dépliés ne sont pas retenus d'une visite à l'autre (état d'écran seulement).

## Geste de Julien
Aucun.
