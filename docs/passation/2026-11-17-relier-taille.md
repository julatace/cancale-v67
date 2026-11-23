# 17 nov. 2026 — La taille à côté de chaque achat à relier (lot `relier-taille`)

## La demande

Julien : « pour relier les achats je veux qu'il y ait la taille ou une description à côté des articles achetés pour
pouvoir relier ». Branche `claude/relier-taille`, partie de `origin/main` (après #1209 ; contient relier-fiable,
achats-retour, relier-glisser, relier-toucher).

## La mesure (vraie base, LECTURE SEULE, 17 nov. — projections, aucun contenu recopié)

| où | ce qu'il y a pour un ACHAT |
|---|---|
| `harvest_{uid}_orders_purchased` → `my_orders` (3 327 achats) | `title`, `price`, `date`, `status`, `transaction_user_status`, `transaction_id`, `conversation_id`, `photo` (706) — **ni taille, ni état, ni vendeur, ni description** |
| `harvest_{uid}_txn_{tx}` côté acheteur (`user_side` = buyer : 43 lignes, **35 de ses 3 327 achats**) | `order.items[].size_title` (49 articles sur 49), `order.items[].status` = l'ÉTAT (« Très bon état », « Bon état », « Satisfaisant », « Neuf sans étiquette »), `seller.login`, `items_count`, `catalog_id` — **aucune description, aucune couleur** |
| `vinted_item_details` | seulement SES annonces (`detailEstASoi`) : jamais l'annonce d'un vendeur chez qui il a acheté |

Le détail de transaction d'un achat n'est rangé que quand la page de la commande (ou de sa conversation) est ouverte
sur vinted.fr, extension connectée (capture passive, `background.js` `rowId = harvest_{uid}_txn_{id}`). La lecture du
suivi des achats (5.372, `capterSuivisAchats`) LIT bien `/api/v2/transactions/{tx}` pour les achats en cours mais n'en
garde que le suivi (`rangerSuivi`), pas la transaction : **la taille de ces achats n'est donc pas rangée** — voir
« Reste » (une modification d'extension, hors de ce lot).

## Ce qui change (`src/faitsAchat.js` règles pures, `src/FaitsAchat.jsx` la ligne)

Sur chaque ligne d'achat proposée, sous le titre, une ligne « ce qu'on sait » qui passe à la ligne (rien de coupé) :
- **la taille d'abord** : LUE chez Vinted (`size_title` du détail, par le n° de transaction — jamais par le titre) ;
  sinon celle que le vendeur a ÉCRITE dans son titre, dite « (titre) » (EU écrite seulement : jamais une conversion
  US, jamais devinée) ; sinon rien ;
- face à l'article visé (vente ou annonce de la feuille, ou celle choisie dans « Relier achats et ventes ») :
  **« ✓ Taille 42 »** (en gras) quand c'est la même (« 42 » = « 42,0 » = « EU 42 »), **« Taille 42,5 ≠ 42 »** (gris)
  sinon ; encre neutre, aucune couleur d'accent ni rouge (§7) ; aucun tri, aucun lien automatique : c'est toujours
  son toucher qui relie (§5) ;
- puis l'**état** lu, la date, le **vendeur** (« de … »), les couleurs écrites dans le titre, la marque si le titre la
  NOMME, le compte ;
- **une phrase, une fois, en tête de liste** : « N achats sans taille lue chez Vinted : elle se lit quand tu ouvres la
  commande sur vinted.fr (extension connectée). En attendant, la taille écrite dans le titre est montrée, « (titre) ». »
- « Relier achats et ventes » : un achat choisi ⇒ chaque vente / annonce dit « ✓ même taille que l'achat » ou
  « taille ≠ achat (41) » ; les ventes / annonces montrent leur taille.

Où : la feuille « Relier un achat » / « Choisir un achat » (`RelierAchatCorps` — ouverte depuis Ventes, la puce
« Relier un achat » d'Annonces, « Sans achat relié » → « Choisir un achat », la fiche), « Relier achats et ventes »
(`RelierGlisser`), et la feuille « Relier ce colis à un achat » (colis à retirer sans achat, `relierColis`, sans
article visé : pas de « ✓ »).

La lecture (`App.jsx`, `Comptabilite`) : `lireTout(SELECT_DETAILS_ACHATS)` — `id=like.harvest_%_txn_%` filtré
`data->payload->transaction->>user_side=eq.buyer`, projection scalaire (`t0..t3` = `order->items->i->>size_title`,
`e0..e3` = `->>status`, `seller->>login`, `items_count`), jamais `select=data` (§4.4), paginée (§4.5) ; une fois à
l'ouverture d'une des trois feuilles, relue à la suivante. Trois états : pas encore lu (rien), `null` pas su (rien,
jamais « pas de taille »), carte lue.

**La description** : elle n'est rangée NULLE PART pour un achat (mesure ci-dessus). Rien n'est montré plutôt qu'un
extrait inventé ; c'est le reste n° 1.

Textes : `faits.*` dans `src/i18n/langues/{fr,en,es,it,de}/liaison.js`. Quoi de neuf : `relier-taille`.

## Preuves

- `node scripts/audit-faits-achat.cjs` : **29 verts** (D forme projetée et « pas su », T taille lue > titre > rien, US
  jamais convertie, 50 achats au même titre chacun SA taille, A accord 42 = 42,0 = EU 42 et 42,5 / 42 2/3 ≠ 42, lettres,
  lot, M marque seulement nommée, vendeur, état, S branchement). Sur `origin/main` : **rouge** (module absent).
  `--prouve` : **9/9 mutations** attrapées (détails ignorés, accord par l'entier, titre avant Vinted, forme pas
  vérifiée, échec = vide, marque devinée, `select=data`, feuille sans la ligne, glisser sans l'article choisi).
- Banc `scripts/bancs/relier-taille.cjs` (390 tactile clair et sombre, 1512 clair et sombre) : **92 / 0**. 50 achats
  « Adidas Spezial noire » (titre sans taille, la forme réelle) aux tailles 40 / 41 / 42 / 42,5 / 43 dans leur détail de
  transaction servi en PROJECTION, plus 3 achats sans détail (dont un « taille 42 » dans le titre), une transaction
  côté vendeur jamais servie : chaque ligne montre SA taille lue, son état, son vendeur ; les 10 en 42 et eux seuls
  « ✓ » ; les autres « ≠ 42 » (42,5 compris) ; sans détail ⇒ aucune taille ; « (titre) » ; la phrase « 3 achats sans
  taille lue » une fois ; rien de coupé ; aucune écriture de lien ; la lecture est la projection côté acheteur ;
  « Relier achats et ventes » : les 10 « ✓ », et un achat en 42 choisi ⇒ la vente « ✓ même taille ».
  - Build de `origin/main` : **48 rouges** sur 92. Build muté (détails ignorés) : **9 rouges** (390) ; build muté
    (accord par l'entier : 42,5 = 42) : **3 rouges** (1512).
  - Captures regardées (feuille 390 clair / sombre, 1512 ; Relier achats et ventes 390 et 1512 sombre, achat choisi).
- Bancs voisins : `relier-glisser` **63 / 0** (il a d'abord rougi une fois : la phrase « N achats sans taille lue » en
  tête de la colonne et des cartes de trois lignes repoussaient le 3e achat sous le bas de la liste, le doigt du banc
  tombait hors de la liste ⇒ la phrase passe au BAS de la liste et les cartes de « Relier achats et ventes » omettent
  couleurs et marque, déjà dans le titre — `court`) ; `relier-sans-retour` **18 / 0** ; `relier-achat-suggestions` et
  `relier-achat-filtres` rouges à l'entrée (« Relier un achat » introuvable) **aussi sur le build d'`origin/main`** :
  sans rapport avec ce lot.
- Audits touchés verts : traduction, quoi-de-neuf, relier-glisser, relier-fiable (43, une extraction fragile du code —
  un `image/*` lu comme début de commentaire — m'a fait déplacer un commentaire JSX en commentaire de ligne),
  achats-relier, liaison-achat, achats-a-relier, identite, achats-hors-relier, relier-colis, relier-compte,
  suggestions-achat, geste-annulable.

## Reste

1. **Description et taille des achats en cours** — une modification d'EXTENSION (pas dans ce lot) : (a) dans
   `capterSuivisAchats` (5.372), ranger la transaction déjà lue (`rangerTransaction(uid, acc, tx, rt.json, 'suivi')`)
   au lieu de la jeter ⇒ la taille et l'état de chaque achat en cours arrivent sans aucune lecture de plus ; (b) la
   DESCRIPTION n'est que sur la page de l'annonce achetée (`item_id` connu par la transaction) : une lecture par achat,
   dans le budget de lecture (20/h), rangée courte (≈ 300 caractères) sous une ligne dédiée — à décider avec Julien
   (budget). Tant que ce n'est pas fait, rien n'est montré pour la description.
2. La carte « Sans achat relié » (proposition « très probable ») et la proposition dans la fiche montrent toujours la
   taille du titre (leur proposition exige déjà la même taille) : elles ne lisent pas encore l'état / le vendeur.
3. Vu au banc, hors de ce lot (non creusé) : ouverte depuis « Relier un achat » de la ligne d'une VENTE (puce « Prix
   d'achat ? »), « Relier achats et ventes » ne présélectionne pas cette vente : il faut la toucher. Le banc la touche.

## ÉTAT À LA REPRISE

Branche `claude/relier-taille` poussée, PR ouverte (« Fini, à intégrer »). Aucun geste de Julien.
