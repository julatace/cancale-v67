# 15 nov. — « À expédier » : le transporteur est connu dès qu'une source existe

Julien (capture iPhone, Ventes → À expédier, 23 h) : tuiles « Tous 3 · Colissimo 1 colis ·
**Transporteur inconnu 2 colis** » — « Le transporteur inconnu n'est pas possible. »

Branche `claude/transporteur-connu` (partie de `claude/project-review-nsk5su`). Pas d'extension
(voir « Extension » plus bas).

## La cause, mesurée (lecture seule, aucune donnée personnelle reproduite ici)

Ventes « à expédier » des 30 derniers jours, toute la base : **4** (3 chez Julien, 1 chez un autre
vendeur). Pour chacune, les lignes qui portent le transporteur :

| vente | bordereau e-mail (`email_bord_{tx}`) | étiquette captée (`harvest_{uid}_label_{tx}`) | étiquette LUE (`vrm_bord_transporteurs.pdf[tx]`) | affichée |
|---|---|---|---|---|
| Julien, compte A | oui, transporteur rangé | oui | — | Colissimo ✓ |
| Julien, compte B (imprimée) | **non** (boîte du compte pas reliée) | oui | **oui : `{ t: 'chronopost', s: 'XW…TS' }`** | **« inconnu »** ✗ |
| Julien, compte B (2 j) | non | non | non | « inconnu » |
| autre vendeur | non | oui | **oui** | « inconnu » ✗ |

1. **Bug de lecture (2 ventes sur 4).** Les tuiles, la liste, la tournée et la publication
   `vrm_colis_aposter` lisaient le transporteur par `transporteurVente(x.b)` — le bordereau
   **e-mail** seul, sans le n° de transaction. Une vente sans e-mail (bordereau capté par
   l'extension) avait pourtant son étiquette lue au cron, rangée **par n° de transaction** ; la
   carte, elle, passait le n° (`transporteurVente(b, e.txn)`) et montrait le logo Chronopost —
   la carte et la tuile se contredisaient. Six appels de ce genre dans `App.jsx`.
2. **Vinted ne dit le transporteur nulle part avant l'étiquette.** Mesuré : 0 sur 1 432 détails de
   transaction (`transaction.shipment` = `id`, `status`, `status_title`, `status_updated_at` ;
   `order` = taille de colis, `custom_shipment`), 0 sur 934 conversations (`shipment_id`,
   `shipment_status`, `package_size_code`), 0 dans `my_orders`, 0 dans le corps des
   `PUT …/shipment/order` captés (`label_type`, `drop_off_type`, `seller_address_id`), et l'URL
   de l'étiquette est un stockage neutre. Le « mode d'envoi » n'existe donc dans aucune ligne :
   **l'étiquette (PDF, n° de suivi) est la source**. La vente de 2 j (statut « Bordereau envoyé
   au vendeur ») n'avait encore ni e-mail ni étiquette captée : son compte n'était pas ouvert
   dans le navigateur (la barre disait le compte ouvert : un autre).

## Ce qui change

Une règle, `src/colisEnvoyes.js` (§11) :

- `transporteurParTx(b, tx, …)` : la vente par SON n° — bordereau e-mail, puis étiquette relue,
  puis transporteur, e-mails du même n°, forme du n° (`transporteurDeVente`, inchangée).
  `transporteurVente` de l'app l'appelle ; **les 13 lectures de l'app passent le n°**.
- `transporteurDeLigne(x, deVente)` / `txDeLigne(x)` : une ligne de « À expédier ».
- `pourquoiSansTransporteur({ site, bord, pdf, vu, capte, compte })` : la raison, jamais
  « inconnu » — `pas-encore-lu` (aucune source : + le compte à ouvrir sur vinted.fr), `a-lire`
  (étiquette captée pas encore relue), `muette` / `plusieurs` / `illisible` / `sans-pdf`
  (`raisonInconnu`), `site` (eBay, Vestiaire, Leboncoin n'ont rien dit).
- `tuilesTransporteursConnus(liste, tr)` : les tuiles ne regroupent QUE des transporteurs
  connus ; `reste` = le reste, rien de caché. `resumePasLus` : le reste compté par raison.

Écran (Ventes → À expédier) :

- tuiles : « Tous · Chronopost · Colissimo · … », plus jamais « Transporteur inconnu » ;
  un ancien filtre « inconnu » mémorisé revient à « Tous » ;
- **une ligne discrète** au-dessus de la liste : « 1 colis : transporteur pas encore lu — ouvre
  vinted.fr sur {compte} » (ou « 1 étiquette en cours de lecture », etc.) ; `data-envoyer-pas-lus`,
  `data-pas-lu-raison`, `data-pas-lu-comptes` ;
- la carte sans source : pictogramme neutre, libellé « Transporteur pas encore lu » (le badge prend
  `pasLu`) ; la tournée de dépôt nomme ce groupe « Transporteur pas encore lu ».
- `tr()` 5 langues : `src/i18n/langues/{fr,en,es,it,de}/transporteurConnu.js` (clés `tc.*`).
- « Quoi de neuf » : `transporteur-connu`.

Hors périmètre, inchangé : Colis → « Envoyés » (ses pastilles et sa ligne « N colis sans
transporteur lu » ont leur banc, `colis-envoyes-tri`, 92 verts).

## Extension : pas touchée (pas indispensable)

Elle lit déjà le détail qui porte le transporteur : l'étiquette de chaque vente à expédier
(`recupererLabel`, budget de lecture « colis », compte de l'onglet), relue ensuite au cron
(`passeTransporteursPdf`). Un relevé `journey_summary` des ventes ne dirait rien de plus tôt : il
demande lui aussi le compte ouvert, et sa forme n'a jamais été vue pour une vente avant
l'étiquette (deviner un champ est interdit). Le geste dit à l'écran est donc le bon : ouvrir
vinted.fr sur le compte de la vente.

## Preuves

- `node scripts/audit-transporteur-connu.cjs` — **27 verts** : la règle EXÉCUTÉE sur la forme
  réelle (valeurs inventées) — étiquette captée et lue ⇒ Chronopost par SON n° ; PDF e-mail ⇒
  Colissimo ; n° 8 chiffres ⇒ Mondial Relay ; XW…TS ⇒ Chronopost ; l'étiquette d'une vente ne nomme
  pas une autre ; rien ⇒ `pas-encore-lu` + compte ; captée non relue ⇒ `a-lire` ; lue muette ⇒
  `muette` ; eBay ⇒ `site` ; tuiles connues seulement, rien caché ; chaque `transporteurVente` de
  l'app passe le n°. **7 mutations** (n° ignoré, inconnu gardé en tuile, compte perdu, reste caché…)
  ⇒ rouge chacune. Sur l'arbre de départ : **rouge** (6 lectures par le seul bordereau).
- `scripts/bancs/transporteur-connu.cjs` (390 tactile, 1512) — **24 verts** ; sur l'arbre de départ
  **14 rouges** : il reproduit la capture (« Colissimo 1 · Mondial Relay 1 · Transporteur inconnu 2 »
  pendant que la carte porte le logo Chronopost). Captures regardées.
- Inchangés et verts : `studio-ventes` 96, `colis-envoyes-tri` 92, `audit-transporteur-pdf` 34,
  `audit-transporteurs`, `audit-colis-envoi` 54, `audit-colis-plus` 72, `audit-colis-trois` 31,
  `audit-colis-sortants`, `audit-traduction` 45, `audit-quoi-de-neuf`, `audit-coherence`,
  `audit-icones`, `audit-studio`, `npm run build`.
- `transporteurs-logos` : 10 rouges **identiques sur l'arbre de départ** (la puce « à gauche du
  bouton bordereau » : la rangée n'a plus de bouton depuis le Studio du 14 nov. ; banc périmé, pas
  touché ici).

## Geste de Julien

Aucun pour le code. Pour la vente sans aucune source : ouvrir vinted.fr sur le compte que la ligne
nomme (l'extension y prend l'étiquette, le transporteur suit). Relier la boîte e-mail de ce compte
évite d'attendre le passage sur Vinted.
