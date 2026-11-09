# Recherche universelle et fiche d'une paire — 9 novembre (branche `claude/recherche-fiche`)

> Julien : « fais tout ». Une seule barre qui reconnaît ce qu'on tape et mène au bon
> écran ; une fiche par paire qui raconte sa vie, étape par étape, chaque étape
> prouvée par une identité.

La loupe « Tout sur le N° » (21 oct.), la loupe universelle (6 nov.,
`docs/passation/2026-11-06-recherche.md`) et la fiche complète d'une paire
(1er et 3 nov., `parcoursPaire` → `histoireArticle`) existaient déjà : **elles sont
ÉTENDUES ici, rien n'est doublé.** Même champ, même panneau, même fiche.

## Ce qui change pour lui

**La loupe**
- **⌘K (Mac) / Ctrl+K** l'ouvre de n'importe où (même depuis un champ), le texte est
  sélectionné ; « / » marche toujours ; sur iPhone, la loupe en haut, inchangée.
- **Clavier complet** (ordinateur) : ↓ du champ va à la 1re ligne, ↑ ↓ Début Fin
  passent d'une ligne à l'autre, ↑ depuis la 1re revient au champ, **Entrée dans le
  champ ouvre la 1re trouvaille** (la fiche du N° quand un N° est tapé), Échap ferme.
  Une composition en cours (accents) n'est jamais coupée.
- **Ce qu'elle reconnaît en plus** :
  - les **n° de commande eBay** (« 12-34567-89012 », avec ou sans tirets),
    **Leboncoin** (l'id de la vente) et **Vestiaire** (l'id de la vente ou la réf.
    du produit) ⇒ groupe **Ventes**, la ligne ouvre SA vente sur SON site (eBay :
    la commande elle-même ; Vestiaire : la ligne `vcvente` ; Leboncoin : Ventes →
    Leboncoin) ;
  - les **conversations Vinted** ⇒ nouveau groupe **Messages** : par SA transaction,
    SON interlocuteur, les mots de la paire ; la ligne ouvre CETTE conversation
    (compte + n°).
- **« Je cherche un N°, un n° de transaction… »** : une ligne sous le champ dit ce
  que la requête a l'air d'être (`reconnaitreRequete`) — dit, jamais décidé : tout
  est cherché quand même.
- **État vide utile** : champ vide ⇒ ce qu'on peut taper (+ les touches sur
  ordinateur) ; aucun résultat ⇒ la requête rappelée et des exemples.

**La fiche d'une paire**
- La frise se termine par une étape **Bénéfice** : « +34 € — vente 70 € − achat
  36 € (− frais) », ou « — » et le manque NOMMÉ (« prix d'achat pas saisi »,
  « tes ventes pas toutes lues »), ou grisée « rien de vendu ». Jamais 0.
- L'étape **Colis** devient une vraie frise, chaque ligne datée par SA donnée :
  **bordereau** (l'e-mail du bordereau de CETTE transaction, sa date, son n° de
  suivi) · **déposé** (SON clic « Colis fait », une date seulement si elle est
  écrite) · **arrivé au relais de l'acheteur / retiré par l'acheteur** (les e-mails du
  transporteur de CE n° de suivi). Bordereaux ou suivis illisibles ⇒ « — bordereau
  et suivi pas lus » / « e-mails du transporteur pas lus ».
- **« Ouvrir dans … › »** sous chaque étape qui a une source : l'achat (Achats, SA
  transaction), la vente (Ventes, SA transaction), le colis (Colis, SA carte),
  l'argent (Compta), l'annonce (Annonces, SA carte), le stock (« Voir au Stock »).
- **« Fiche de la paire »** d'une vente (Ventes et Vestiaire) ouvre maintenant la
  fiche elle-même (avant : la loupe sur le N°). Elle s'ouvre aussi depuis la loupe
  (une paire, Entrée sur un N°), « Tout sur le N° », Annonces (« Histoire »), le
  Stock, le mode emballage, les Fournisseurs — comme avant.

## Identité (§5) — ce qui relie quoi

| quoi | relié par | jamais par |
|---|---|---|
| vente eBay ↔ N° | SON SKU `VRM-{n°}` (`numLigneEbay`) | le titre |
| vente Leboncoin ↔ N° | SON lien / SA référence (`numeroLbcIdentite`) | le titre |
| vente Vestiaire ↔ N° | `ventesVcDe` (lien, réf., N° du produit) | le titre |
| conversation | (compte, n° de conversation) ; trouvée par SA transaction | le titre |
| bordereau ↔ vente | `email_bord_*.transaction` = LA transaction | la date, le titre |
| suivi transporteur ↔ vente | n° de suivi EXACT écrit sur CE bordereau | un suivi qui ressemble |
| déposé | `vinted_ship_done[tx]` (SON clic) | — |

Le titre ne sert qu'à PROPOSER (« trouvé par le titre »). 50 commandes eBay, 50
conversations, 50 paires au même titre = 50 lignes ; la fiche d'une paire n'emprunte
rien à une autre (même quand la carte du colis porte toutes les ventes lues).

## Comment (le code)

| fichier | quoi |
|---|---|
| `src/rechercheUnique.js` | `reconnaitreRequete` + `GENRES_REQUETE` ; type `message` ; sources `autres` (ventes hors Vinted, identité `commande`) et `messages` ; `destinationResultat` (eBay, Vestiaire, Leboncoin, conversation, `sub`) |
| `src/rechercheEcran.js` | `ventesAutresPourRecherche`, `messagesPourRecherche`, `voisinClavier`, pastille « Commande … » |
| `src/histoireArticle.js` | colis daté (bordereau, déposé, relais, retiré), étape `benefice`, `source` de chaque étape, `colisDesVentes` (assemblage PUR par identité) |
| `src/FichePaire.jsx`, `src/styles-fiche-paire.css` | « Ouvrir dans … › » (`data-fiche-source`), icône du bénéfice |
| `src/App.jsx` | lectures de la loupe (+ conversations projetées, + ventes Vestiaire partagées), index, lignes Ventes hors Vinted / Messages, clavier (`clavierChamp`, `clavierPanneau`, ⌘K), « Je cherche », état vide ; `lireColisDesVentes` (fiche) ; `onSource` |

## Lectures et vitesse

Rien au démarrage : tout est lu **à l'ouverture** de la loupe ou de la fiche.
- Loupe, en plus : `harvest_*_conv_*` **projetée** (n° de transaction, titre de la
  paire, pseudo de l'interlocuteur — 3 scalaires), paginée ; les ventes Vestiaire
  par la lecture PARTAGÉE de l'app (`lireVentesVestiaire`, mémorisée 5 s). Les
  commandes eBay et ventes Leboncoin étaient déjà lues par « Tout sur le N° ».
  Comptes retirés de Messages écartés (`messagesRetires`), comptes cherchés seulement.
- Fiche, en plus : `email_bord_*` filtrés sur SES transactions
  (`meta->>transaction=in.(…)`), puis `email_track_*` filtrés sur SES n° de suivi
  (`meta->>suivi=in.(…)`) — scalaires, toutes les pages (`lireTout`, strict).
- L'index reste mémorisé tant que ses sources sont les mêmes objets (`indexMemo`,
  clés `autres` et `messages` ajoutées ; `memoSur('gs-autres')`).

## Preuves

- `node scripts/audit-recherche-fiche.cjs` : **66/66** (reconnaissance « b125 »,
  « 007 », commande eBay, transaction, suivi, code, montant, pseudo, mots ; ventes
  eBay/Leboncoin/Vestiaire par SON n° et SON N° d'identité ; conversations ; 50 au
  même titre ⇒ 50 ; clavier ; fiche du N°227 vs N°211/N°228 : achat, vente,
  bordereau, dépôt, retrait, bénéfice, sources ; « pas su » ; branchement et lectures
  projetées dans App). `--prouve` : **13/13 mutations** (clé par titre ×2, n° de
  commande court, eBay sans commande, N° eBay pris dans le titre, colis d'une autre
  vente, suivi « à peu près », « pas lu » tu, bénéfice 0, ↑ qui ne revient pas,
  sans ⌘K, index sans les nouvelles sources, conversations lues entières). Sur
  `origin/main` (b3ec1b17) : rouge (« ne savent pas encore : reconnaitreRequete … »).
- Banc `scripts/bancs/recherche-fiche.cjs` (base inventée, 390 tactile / 1512,
  clair / sombre) : voir le résultat et les captures plus bas.
- Audits verts : identite, statuts, variables, tdz, icones, boutons, violet,
  coherence, recherche-universelle (65/65), recherche-unique, recherche-numero,
  cibles-notif, mode-stream, lectures-lourdes, flux-divers, annonces-outils,
  ebay-recherche, fournisseurs, stock-2d. `npm run build` vert.
- Banc `fiche-paire.cjs` : l'ordre attendu inclut maintenant `benefice` ; son rouge
  « rangée dans le Stock (par N°) » existe **aussi sur origin/main** (pas de cette
  branche).

## Geste de Julien

Aucun. Essayer : ⌘K puis un n° de commande eBay, un pseudo d'acheteur (la
conversation sort), « b125 » puis Entrée ; dans une fiche, descendre jusqu'au
Bénéfice et toucher « Ouvrir dans Ventes ».
