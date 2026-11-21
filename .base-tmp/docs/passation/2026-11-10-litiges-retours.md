# 10 nov. — « Litiges en cours » (lot BB) et « Retours par modèle » (lot BI) — branche `claude/litiges-marge`

Validé par Julien (file des lots du 9 nov., deuxième série du 10 nov. : « litige en cours c'est
bien ») : un écran qui rassemble les ventes en litige / retour, toutes plateformes lues, la date
limite de réponse quand elle est LUE, les preuves déjà rangées pour la vente ; et, par modèle,
combien de ventes prouvées ont fini en retour ou litige. Peu de texte, du visuel. Lecture et
ouverture seulement : aucun message, aucune action sur un site. Extension : rien changé.
La « marge par plateforme » du lot I n'est PAS dans ce chantier (le coût d'une vente est le
chantier `claude/cout-vente`).

## 1. Mesuré d'abord (lecture seule, sa base, 10 nov.)

| source | forme lue | conséquence |
|---|---|---|
| transactions Vinted (`harvest_*_txn_*`, `meta`) | 440 « Retour initié » **10** · 430 « Transaction suspendue - en attente de vérification » **2** (inchangé depuis le 3 nov.) ; clés de la transaction 440/430 qui ressemblent à une date : `status_updated_at`, `debit_processed_at` seulement — **aucune date limite** | la date limite d'un litige Vinted ne se lit PAS dans la transaction |
| `suspending_complaint_id` | non nul sur les 10 « 440 », 1 des 2 « 430 », et **4 ventes finalisées (450)** (litige tranché pour lui) ; **absent de `meta`** | un litige déjà clos ne se voit que dans le payload (30 Ko par transaction) : pas lu (voir § 5) |
| liste des ventes (`orders_sold`) | « Remboursement effectué » `failed` **330** ; « Commande non réclamée - Retournée à l'expéditeur » 2 | un remboursement seul **ne prouve pas** un retour (les annulations « article indisponible » 500 sont remboursées aussi) |
| e-mails | les trois sujets de `src/litiges.js` (5 « Action requise », 3+1 « annuler son achat », 2 « Retourne ta commande d'ici le … ») + **nouveau** : « Bordereau de retour - … » (1, 8 nov., côté ACHAT, même article que « Retourne ta commande d'ici le 16 nov. ») | rien de neuf côté VENTE ; le bordereau de retour d'achat n'est pas utilisé ici |
| Leboncoin (`lbc_ventes`) | `stepStatus` done / validation / cancelled ; aucun litige | **forme jamais vue** ⇒ l'écran dit « ne se lit pas encore » |
| Vestiaire (`vc_ventes`) | `ACTION_NEEDED` / `shipmentInProgress` seulement | idem |
| eBay (`ebay_orders`) | 0 commande ; les retours se lisent chez eBay (Post-Order, `respondByDate` d'après la doc, jamais observé) | eBay lu par la route existante |

## 2. Ce qui change pour lui

- **Un écran « Litiges en cours »** (`?tab=litiges`, le nom « Ventes » reste allumé dans la
  navigation, aucune entrée de menu de plus). Une **carte par vente** en litige ou en retour :
  la photo de SON annonce, son **N°** (identité) ou « Sans N° », ce qui se passe en un mot
  (« Retour », « Litige », « Transaction suspendue », « Annulation demandée », + « En route vers
  toi » / « Remboursé » quand le retour avance), et **« Avant le 14 nov. »** (date LUE : e-mail
  Vinted, eBay `respondByDate`) ou **« Date limite non lue »** — jamais inventée. Moins de 48 h :
  la date passe en ambre.
- **Les preuves déjà rangées, en quatre pastilles** (par le n° de transaction, §5) : **Photo** ✓ ·
  **Suivi** (le statut lu chez le transporteur pour le n° de SON bordereau, « pas lu » quand le
  transporteur n'a pas répondu, « — » sans n°) · **Bordereau** ✓ (e-mail ou capté par l'extension)
  · **Carton** « bientôt » (emplacement en pointillés : la photo du carton fermé viendra du lot AZ).
- **Un seul geste : un LIEN** vers la conversation / la transaction sur Vinted, ou le retour sur
  eBay (« Répondre sur Vinted ↗ », « Suivre le retour sur Vinted ↗ », « Répondre sur eBay ↗ »).
- **« Ce que VRM lit »** : Vinted ✓ (ou « — pas lu : tes ventes Vinted »), eBay, et pour
  Leboncoin / Vestiaire « — un litige … ne se lit pas encore : regarde sur … ». Il manque une
  source ⇒ « **Au moins** 3 en cours », jamais « Aucun litige ».
- **« Retours par modèle »** sous les cartes : une ligne par modèle (Nike Dunk, Adidas Samba…),
  une barre neutre et « **2 sur 15** » (« au moins 2 sur 15 » quand des remboursements du modèle
  ont une cause pas lue), « Autres » en dernier ; dessous : « N ventes remboursées : cause pas lue
  (annulation ou retour), pas comptées ». Aucune action sur une ligne.
- **Depuis Ventes** (tous les sites) : une rangée « **Litiges et retours** » avec le nombre en
  pastille ambre, qui ouvre l'écran. **Depuis À trancher** : un groupe « **Ventes** » (photo, N°,
  « Litige en cours : réponds à temps », « Voir » ⇒ l'écran, défilé jusqu'à la carte).

## 3. Les règles (une par notion)

- `src/litigesEcran.js` (pur) **ne redécide rien** : les litiges sont ceux de `src/litiges.js`
  (`litigesEnCours`, ses lignes `sens: 'vente'`), un retour est `etapeRetourVinted` (origine
  « retour ») de `src/retoursStock.js`, le modèle est `modeleSur` de `src/ceQuiRapporte.js`
  (regroupement, jamais une identité).
- `preuvesVente` : preuves par la transaction (`bordParTx`, `labelsCaptes`, l'étiquette relue
  `pdfEtiquettesParTx`) ; statut du n° lu dans `transp_*` (`transpMap`) — trois états.
- `retoursParModele` : **retour** = transaction 440 / « Retour initié » (non réclamé exclu) ;
  **litige** = 430 / « suspendue » / e-mail « Action requise » relié par SA conversation (une seule
  vente porte cette conversation, sinon aucune — jamais le titre) ; **annulée** (500+, 220) hors du
  dénominateur ; « Remboursement effectué » sans transaction lue ⇒ `inconnues` (« au moins »).
- **À trancher** : nouvelle source `litiges-en-cours` (type « Ventes ») publiée par Comptabilité
  (écrans Litiges, Ma journée, Ventes Vinted) avec ses choses (`ex` : id = clé du litige, N°,
  photo). `nombreLitigesPublie` ne publie RIEN quand Vinted (ventes ou e-mails) ou eBay ne sont pas
  lus : un compte partiel ne se présente pas complet. Hors de l'écran Litiges, eBay compte comme
  « utilisé » tant que ses retours n'ont pas été lus.
- `App.jsx` : `only="litiges"` monte `Comptabilite` (comme Colis/Ventes) ; les lectures existantes
  s'ouvrent à cet écran (e-mails de litige, retours eBay, bordereaux e-mail et captés, suivis).
  `titreEcran`, `ONGLETS_LIENS`, `BAR_GROUPE` connaissent `litiges`.

## 4. Preuves

- `scripts/audit-litiges-ecran.cjs` : **21/21** sur la vraie règle (avec les vraies `litiges.js`,
  `retoursStock.js`, `ceQuiRapporte.js`), `--prouve` **11/11** mutations (remboursement = retour,
  litige par titre, conversation ambiguë, cause pas lue rangée en vente, annulation comptée, date
  inventée, achats mêlés, Leboncoin/Vestiaire tus, transporteur « pas lu » tu, publication
  partielle, « Autres » classé).
- Banc **neuf** `scripts/bancs/litiges-ecran.cjs` (ventes inventées à la forme mesurée ; 390 px
  tactile et 1512 px, clair ET sombre ; ventes illisibles) : **vert** sur la branche ; sur
  `origin/main` (git archive, build, banc copié dedans) : **74 rouges** (l'écran n'existe pas ; l'audit,
  lui : « règle absente ») ; sur un build MUTÉ (achats mêlés + date inventée + remboursement = retour) :
  **32 rouges** (carte du retour d'achat, « Avant le 15 nov. », Dunk 3, Samba 2 sur 2, nombre publié 4…).
- Banc touché : `a-trancher.cjs` (la nouvelle source semée à 0) — vert.
- Audits : variables, tdz, coherence, identite, icones, statuts, a-trancher, litiges,
  retours-stock, ce-qui-rapporte : verts. `npm run build` vert.
- Captures regardées (390 clair/sombre, 1512 clair/sombre, entrée Ventes, À trancher, pas su) :
  cartes blanches DA6 (#1C1C1E la nuit), pastilles 2 × 2, liens ambre, aucun rouge, rien ne déborde.

## 5. Ce qui reste

- **Date limite Vinted** : aucune n'est écrite ni dans la transaction ni dans l'e-mail au vendeur
  (« sous 5 jours ouvrés » est le délai de l'acheteur) ⇒ « Date limite non lue » sur toutes les
  cartes Vinted aujourd'hui. Ne pas la déduire.
- **Litiges clos** (`suspending_complaint_id` sur 4 ventes finalisées) : lisibles seulement dans
  le payload de la transaction. Les ajouter à `meta` (fonction SQL `vrm_meta`, une migration,
  geste de Julien) permettrait à « Retours par modèle » de compter aussi les litiges gagnés.
- **Leboncoin / Vestiaire** : aucune forme de litige jamais vue ; à mesurer quand il en arrivera un.
- **Photo du carton** (lot AZ) : `preuvesVente({ carton: { photo, at } })` la range dans
  l'emplacement déjà dessiné (aujourd'hui toujours « bientôt »).
- Un litige est aussi une carte de Ma journée « À faire » (lot du 3 nov.) ET compte dans « N
  choses à trancher » : la même vente peut être dite deux fois sur Ma journée (à arbitrer si
  Julien le trouve gênant).
