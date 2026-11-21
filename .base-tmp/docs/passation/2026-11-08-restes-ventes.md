# 8 nov. — Restes des ventes : une phrase par groupe, widget et rappels = Ma journée, Mondial Relay (branche `claude/restes-ventes`)

## 1. Une phrase répétée sur les lignes de Ventes ⇒ une fois en tête (CLAUDE.md §7)
Capture de Julien : chaque vente « Vue par e-mail » répétait « Facture : acheteur pas prouvé : la vente
n'est pas (encore) lue dans tes ventes Vinted — ouvre Vinted sur ce compte. » et « Vendue — vue par
e-mail, pas encore relue sur Vinted · ventes de ce compte relues le … Ouvre Vinted › Mes commandes… ».

**La règle** : une phrase identique sur DEUX lignes affichées ou plus se dit une fois, au-dessus de la
liste ; si elle dépend du compte, une fois PAR compte. Une phrase sur une seule ligne y reste.
- Note « vue par e-mail » : `groupesVentesEmailEnTete` (src/venteEmailFraiche.js, pure) ⇒
  `NoteVentesEmailTete` (App.jsx) : « 3 ventes vues par e-mail, pas encore relues sur Vinted · compte ·
  ventes de ce compte relues … » + le geste (même source : `statutVentesEmail`, `gesteVenteEmail`,
  `quandRelu`). `data-ventes-email-tete`, `-n`, `-txs`, `-lu`, `data-ventes-email-tete-geste`. La ligne
  porte `data-vente-email-tete={uid}` et ne garde que son état court (« Vue par e-mail ») et, si elle
  en a un, son bordereau (« Imprimer », mention sans N°). Une ligne seule de son compte garde
  `NoteVenteEmail` (`data-vente-email`, inchangé : bancs `vente-email-fraiche`, `bordereau-des-email`).
- Refus de facture : `refusCommuns(groupe, d)` (src/FacturePro.jsx, la règle de la ligne
  `preuveAcheteur`) ⇒ `FactureRaisonsTete` : « Facture · 3 ventes de vendeuse_a : acheteur pas prouvé :
  … » (`data-fp-tete-code`, `-n`, `-txs`). Groupé par compte pour les codes `vinted` et `compte`.
  Un refus propre à la ligne (écart d'heure, deux prix) reste sur elle. `FactureVente` reçoit
  `groupe` (les ventes affichées) et rend `null` pour un refus commun.
- Les deux se calculent sur les lignes AFFICHÉES (`ventesAffichees.slice(0, ventesMax)`), après
  `ventesMax` (TDZ) ; `preparerLigneVente` reçoit les deux clés (ligne mémorisée).
- **Colis non touché** : la seule mention répétée possible sur une carte est « Sans N° : à écrire à la
  main » — elle dit QUELLE carte n'a pas de N° (propre à la carte), courte.

## 2. Widget iPhone, rappels et bilan voient les ventes vues par e-mail (+ leur bordereau)
Avant : Ma journée comptait la vente e-mail dont le bordereau est là (`colisVentesEmail`) ; le widget
et les rappels ne lisaient que la liste Vinted ⇒ l'iPhone disait un colis de moins.
- `api/_lib/colis-ventes-email.js` : **importe telles quelles** les règles de l'app
  (`ventesEmailFraiches`, `colisVentesEmail`, `requeteVentesEmail`) + `ventesPartiesParPreuve`
  (preuves de départ) + `compteEcarte` (api/_lib/ventes-regle.js, copie refabriquée). Aucune règle
  nouvelle. Lecture projetée `meta->>` (la requête de l'app), jamais `select=data`.
- Widget : lecture des e-mails de vente + `panel_accounts_off` ; `capturedAt` par compte
  (`lueParUid`). Le résumé de l'extension ne porte que les ventes « à expédier » ⇒ si une vente e-mail
  candidate existe, la liste ENTIÈRE de SON compte est relue (`id=in.(harvest_{uid}_orders_sold)`,
  `my_orders` seul) pour juger « n° absent de la liste » ; ratée ⇒ ce compte « pas su ⇒ rien ».
  Les dates limites : le bordereau de la vente (lue), sinon l'arrivée de l'e-mail (estimée).
- Rappels matin/soir (`lireDonneesColis`) et bilan (`lireDonneesBilan`) : listes entières déjà lues,
  + `cap`, e-mails de vente, panneau, `vinted_accounts_hidden` ; `ventesEmailColis(d)` ajouté à
  `txsAExpedier` et `ventesParTx`.
- Exclusions = celles de l'app : n° dans la liste Vinted (elle gagne, une annulée sort), e-mail plus
  vieux que la lecture, compte non lié / écarté, pas de bordereau avec PDF au MÊME n°, parti (Colis
  fait, expédié, panneau, e-mail du transporteur pour SON n°, `depart_*`). Toute lecture ratée ⇒ aucun
  colis e-mail (pas su), jamais un colis inventé.

## 3. Mondial Relay au départ — AUCUNE source d'identité sûre aujourd'hui (rien n'est relié)
Cherché dans le code et les passations :
| source | ce qu'on sait | sûre ? |
|---|---|---|
| e-mail du bordereau Vinted (`parseBordereauEmail`) | ne lit qu'un n° à deux lettres ; mesuré le 2 nov. : 94 n° sur 214, tous Chronopost, 120 vides | non (le n° MR n'y est pas lu) |
| détail de transaction (`harvest_*_txn_*`) | `shipment` = id/statut ; 0 n° sur 1 290 (mesuré 23 oct.) | non |
| conversations | 0 n° sur 1 400 (mesuré 23 oct.) | non |
| `…/transactions/{tx}/shipment/journey_summary` | porte `current_carrier.tracking_code` pour les ACHATS (mesuré, 7 suivis) ; pour une VENTE l'extension ne garde que la FORME (`panel_formes_suivi`, voies mêlées) | **pas mesuré** pour une vente |
| e-mail MR « entre de bonnes mains » | rangé `email_track_mondialrelay_{n°}` ; aucun champ transaction ; son corps n'est pas gardé en scalaire | **pas mesuré** (porte-t-il le n° de transaction Vinted ?) |
| le PDF du bordereau MR (`email_bord_{tx}.pdfB64`, InPost PDFsharp 595×842) | même document que la transaction (pièce « Bordereau-Vinted-{tx} ») ; le n° MR est imprimé sur l'étiquette | **pas mesuré** (couche texte ?) |

⇒ Rien n'est relié (ni titre, ni date, ni ressemblance). La vente MR reste « à envoyer » jusqu'à
« Colis fait » ou la relecture Vinted. **À mesurer (lecture seule, vraie base VRM — le projet
Supabase de cette session est « mes-sejours », pas celui de VRM : rien lu)** :
1. sur 3 `email_bord_*` au `suivi` vide : la couche texte du PDF porte-t-elle le n° MR (8 chiffres
   précédés de « expédition »/« colis ») ? Si oui : le lire à la réception (même e-mail = même
   transaction), le ranger dans `suivi` ⇒ `depart-vente.js` s'applique seul (e-mail de dépôt MR).
2. un e-mail MR « entre de bonnes mains » : le corps cite-t-il le n° de transaction Vinted ?
3. ouvrir « Suivre le colis » d'une VENTE dans Chrome et regarder `panel_formes_suivi.journey` :
   `current_carrier.tracking_code` présent ? Si oui : l'extension pourrait ranger le n° d'une vente
   de CE compte (URL = SA transaction) — nouvelle version d'extension, nouveau chantier.

## Preuves (§6)
- `scripts/audit-colis-ventes-email.cjs` — la règle, la route `api/widget` (résumé et liste
  entière, 5 pannes), rappels, bilan, et app (Ma journée, mêmes fonctions) = widget = rappels = bilan
  (3 colis : 1 liste + 2 e-mail ; 50 ventes e-mail au même titre, un seul bordereau ⇒ une seule).
  22 verts ; `--prouve` **8/8 mutations** (dont « relier par le titre ») ; branche de départ : **8 rouges**.
- `scripts/bancs/ventes-une-phrase.cjs` — 390 tactile et 1512 : 18 verts ; dist de départ :
  **10 rouges** ; mutations (seuil des deux règles à 99) : 6 rouges chacune. Captures regardées.
- Verts : `npm run build`, `audit-identite`, `-statuts`, `-a-envoyer-preuves`, `-bordereau-des-email`,
  `-vente-email-fraiche`, `-coherence`, `-fonctions-api` (12), `-variables`, `-tdz`, `-bilan-semaine`,
  `-email-formes`, et les 35 audits qui lisent widget/rappels. Bancs verts : `vente-email-fraiche`,
  `bordereau-des-email`, `facture-pro` (128). Rouges préexistants identiques sur la branche de départ :
  `audit-photos-vinted` (2), banc `compact` (« ligne repliée cat_ventes … nom entier »).

## Geste de Julien
Aucun. (Pour Mondial Relay : les trois mesures ci-dessus, par une session qui a la base VRM.)
