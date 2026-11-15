# 15 nov. — Ventes Vestiaire justes (état le plus frais, état en mots, prix de vente)

Branche `claude/vestiaire-ventes` (depuis `origin/main`). Extension **5.383.0**.

## Ce que Julien a envoyé (iPhone, 14 h 11)

1. VRM, Ventes → « Tes ventes Vestiaire » : le cabas Gucci « **À envoyer** · date limite passée (9 nov.) » sous la tête
   « **0 à expédier** (au moins) » ; la botte Dior « Vestiaire : « **IN_PROGRESS** » » ; « **n° 37451417** » sous
   chaque vente ; colonne de texte tassée (« cavalière / s » sur deux lignes) ; prix et « ⋯ » qui mangent la place.
2. vestiairecollective.com, la même vente Gucci : « Article expédié le 7 novembre », « EN COURS · Livraison à
   l'acheteur », Chronopost, « Paiement estimé 23 novembre ».
3. (en cours de lot) Vestiaire, « Ventes » : « Dior · 120 € (pour vous 96 €) », « Gucci · 209,52 € (pour vous
   203,23 €) » — « La botte n'est pas au bon prix, là c'est l'argent reçu ».

## Mesuré en base (lecture seule, `vc_ventes`)

- `lectures.ventes.at` = 15 nov. 13 h 10 ; `lectures['a-expedier'].at` = **2 nov. 20 h**, `complet: false`.
- Gucci : `aExpedier: true` (sources ventes + a-expedier), `etapesVc.sellerShipment: "done"`,
  `sellerDelivery: "ongoing"` (**mot jamais vu avant**), `statutVc: "deliveryInProgress"`, `etat: "IN_PROGRESS"`,
  `montant.sellerEarning`, `prixVente.sellerPrice`, `compte` = l'identifiant du compte Vestiaire.
- Dior : `etat: "IN_PROGRESS"`, `aExpedier: false`, aucune étape.

## Les causes

| défaut | cause |
|---|---|
| Gucci « À envoyer · date limite passée » | `aExpedier: true` posé par la liste « à expédier » du 2 nov. ; cette liste n'a jamais été relue EN ENTIER, donc jamais remise à faux (`rangerVcVentes`). Toutes les règles lisaient `v.aExpedier === true` tel quel : un fait du 2 nov. gagnait sur la frise du 15 nov. |
| « 0 à expédier » en tête, « À envoyer » sur la ligne | deux règles : la tête écartait `departLu` (le transporteur a pris le colis), la ligne (`etatLigneVc`) ne regardait que `aExpedier`. |
| « Vestiaire : « IN_PROGRESS » » | `etapeVenteVc` recopiait le mot brut quand aucune famille ne le rangeait. |
| « n° 37451417 » | `nomCompteVente('vestiaire')` écrivait l'identifiant du COMPTE faute de pseudo : il se lisait comme un n° de vente. |
| 96 € affiché pour une botte vendue 120 € | la ligne montrait `montant` (`sellerEarning`, ce que Vestiaire verse) comme chiffre principal. |
| titre coupé, « ⋯ » | la ligne Vestiaire n'avait pas la forme studio des ventes (`fusion`) : ancienne grille à colonnes au téléphone, geste « prix d'achat » sur la ligne (⇒ « ⋯ »). |

## Les corrections

### Une règle « à expédier » : l'état le plus FRAIS gagne (`api/_lib/vestiaire-regle.js`)

- `expeditionVc(v)` : une étape d'APRÈS l'envoi « done » (`sellerShipment`, `sellerDelivery`, `sellerConformity`,
  `sellerPayment`) ou `statutVc` = `deliveryInProgress` (mesuré). `pending`/`ongoing`/`upcoming` et
  `shipmentInProgress` (l'état mesuré d'une vente À ENVOYER) ne prouvent rien. Datée par `etapesAt`.
- `aExpedierVc(v, lectures)` : pas de `aExpedier: true` ⇒ non ; pas de preuve ⇒ oui (« pas su » reste « pas su ») ;
  preuve ET liste « à expédier », les deux DATÉES ⇒ la plus fraîche gagne ; une des deux sans date (lignes d'avant la
  5.383) ⇒ la preuve gagne (Vestiaire n'écrit « envoi fait » qu'après l'envoi et ne range dans « à expédier »
  qu'avant). Heure de la liste : `aExpedierAt` sur la vente, sinon `lectures['a-expedier']` (`at`, `partielleAt`).
- `venteVcFraiche(v, lectures)` : la vente telle que les écrans la lisent (`aExpedier` = la règle, le mot rangé dans
  `aExpedierLu`, idempotente) ; `ventesVcDe` l'applique (totaux, stock, coque).
- Branchée dans `colisVcAPoster` (Colis, Ma journée, cloche, widget, rappels — le serveur importe ce module),
  `departsVc`, `stockVestiaire`, `vcVentePartie` (+ la preuve de la frise), `vcVenteAnnulee` ; `limiteVcTexte`,
  « Envoyés » de Colis (`colisVestiaire` : une vente dont la frise dit l'envoi fait et pas la livraison y entre),
  « Tous les sites », `InfosSms`, `parcoursVestiaire` (+ `ongoing` = en cours), `friseSites`.
- **Non touché exprès** : `numerosVestiaire.produitsANumeroter` (« doit porter un N° », pas « à expédier ») et
  `depart-colis.sortantsDuVendeur` (quels n° de suivi lire) gardent `aExpedier` brut — rien n'y est perdu.

### L'extension 5.383.0 (`background.js`)

`rangerVcVentes` pose `aExpedierAt` à chaque lecture de « à expédier » qui LISTE la vente et garde `etapesAt` ;
`rangerVcTimeline` pose `etapesAt` quand la frise (ou le statut) est lue. Rien n'est remis à faux par l'extension :
la règle décide côté app. Garde-fous inchangés (une écriture à la fois, lecture ratée ⇒ rien, compte de l'onglet).
Version : `CODE_VERSION`, manifeste, `EXT_ATTENDUE`, `lbc-inject`/`lbc-relay`, `extension-version.json`, Orion,
zips régénérés. Aucune capacité neuve : l'app n'a rien à promettre de plus (sans les heures, la preuve gagne déjà).

### L'état en mots (`src/etatVenteVc.js`, `src/etatVenteVcTexte.js`, `vcventes.*` en 5 langues)

Annulée · Colis fait · Envoyée — (transporteur) · À expédier avant le … / aujourd'hui / demain / date limite passée
(…) · Expédiée · en livraison · Contrôle par Vestiaire · Livrée · contrôle · Paiement le 23 nov. (`paiementEstime`
lu) · Validée · paiement à venir · Payée · Plus à expédier (envoyée ou annulée) · Vendue (`IN_PROGRESS`,
`ACTION_NEEDED`, vide) · **État Vestiaire non reconnu** (tout autre mot — jamais le mot). La tête « N à expédier »
compte les lignes dont l'état est « À expédier … » : une règle (§11). La ligne « Vestiaire écrit « … » » de la fiche
est retirée. Sur la rangée, l'état reste écrit sous la frise (sauf « Vendue », que la frise dit).

### La rangée (studio) et le prix

- Forme `fusion` des ventes du studio : vignette, titre sur **deux lignes** (coupé aux espaces), « N° · Vestiaire ·
  Réf. 72987282 », l'état ; à droite le **prix de vente** (`prixVente`, `sellerPrice`), « pour toi 203,23 € »
  (`sellerEarning`) et le bénéfice **seulement s'il est su** (prix d'achat connu) — sinon rien, pas de « — ».
  Aucun geste sur la rangée : le prix d'achat manquant se saisit dans la fiche. Les frais Vestiaire sont dans la
  fiche (« L'argent »). Ordinateur : colonne « Prix », sous-titre « Réf. · date · pour toi … ».
- `nomCompteVente('vestiaire')` : le pseudo lu, sinon **rien** (Vestiaire n'en donne pas aujourd'hui).
- Fiche : « Vestiaire · Réf. … ».

### Les totaux ne changent pas

Vérifié dans le code : « Vendu », le CA (daté au versement), le bénéfice, `caAutresParJour`, Statistiques (panier
moyen) lisent tous **`montantRecuVc`** (= `sellerEarning`, ce que Vestiaire verse) — inchangé. Le prix de vente
(`sellerPrice`) ne sert qu'à l'affichage de la ligne, aux frais (`fraisVc`) et à la facture Pro, comme avant.

## Preuves

- `scripts/audit-vestiaire-a-expedier.cjs` (NEUF) : formes mesurées, valeurs inventées ; « expédiée » ⇒ pas à
  expédier, hors Colis, sortie du stock, « Expédiée · en livraison » ; « vendue » ⇒ « Vendue » ; liste relue après
  la frise ⇒ à expédier ; `pending`/`ongoing`/`shipmentInProgress` ⇒ rien prouvé ; mot inconnu ⇒ jamais écrit ;
  l'extension réelle (`_fond-vm.cjs`) date les deux faits, bout en bout. **38 verts ; 8/8 mutations tuées** ; sur
  `origin/main` : rouge (11).
- `scripts/bancs/vestiaire-ventes.cjs` (NEUF) : 390 tactile et 1512, clair et sombre — aucun code machine, pas
  d'identifiant de compte, tête = lignes, prix de vente en principal et « pour toi » en second, bénéfice seulement
  s'il est su, aucun « — » nu, aucun geste sur la rangée, aucun titre coupé dans un mot, rien ne déborde, l'état
  ÉCRIT, la fiche sans code. **68 verts**. Captures regardées (390 clair/sombre, 1512 clair/sombre, fiche).
- Verts : audits `traduction`, `tdz`, `variables`, `studio`, `identite`, `coherence`, `extension-zip`, `csp`,
  `quoi-de-neuf`, `vestiaire-partout`, `frise-sites`, `vestiaire-plus`, `frais-vestiaire`, `argent-a-venir`,
  `numeros-vestiaire`, `colis-sortants`, `bilan-semaine`, `suivi-commandes`, `onglets-a`, `parite-plateformes`,
  `lien-vc`, `vestiaire-email`, `extension-navigateurs`, `export-zip` ; bancs `studio-ventes` (96), `frais-vestiaire` (40).
- Audits et bancs ajustés à la décision (le vieux comportement y était écrit) : `audit-plateformes-logo` D15 et banc
  `plateformes-logo` B (pseudo ou rien), `audit-frais-vestiaire` et banc `frais-vestiaire` L (frais dans la fiche),
  banc `vestiaire-fiches` (date limite dans l'état ; « paid » ⇒ « État Vestiaire non reconnu », plus recopié).
  `data-vc-vente-etape` garde la famille `a-expedier` (bancs d'avant) ; la clé précise est `data-vc-vente-etat`.
- Rouges **déjà rouges sur `origin/main`** (mesurés sur un arbre `git archive origin/main`, pas de ce lot) :
  `audit-plateformes-logo` D10, `audit-extension-5340` P1, `audit-safari` ; bancs `vestiaire-bout-en-bout`
  (sélecteur « Vestiaire » sans rien de capté), `vestiaire-parite` (photos d'annonces, pastille du transporteur ;
  « À expédier » y était ROUGE sur main, vert ici), `vestiaire-fiches` (Annonces), `vestiaire` (relevé, messages,
  achats), `onglets-a` (« ? »), `plateformes-logo` (A, C), `vestiaire-plus` (A Ma journée · offres),
  `vestiaire-colis` (messages). La machine était très chargée (charge 30 à 50) : plusieurs « Page crashed » se sont
  dissipés en relançant.

## Geste de Julien

Installer l'extension **5.383.0** (remplacer le dossier, ⟳ ; Orion : `VRM-Orion-dossier.zip`). Sans elle, le cabas
s'affiche déjà juste (la frise rangée gagne) ; avec elle, chaque fait est daté.
