# 11 novembre 2026 — Tes meilleures sources : où acheter ce qui se revend le mieux

## La demande

Savoir où acheter ce qui se revend le mieux : par SOURCE d'achat (Vinted,
Leboncoin, eBay, Vestiaire, brocante, vide-grenier, magasin, fournisseur nommé…),
le nombre d'articles achetés, le montant investi, combien sont revendus (reliés par
identité), le bénéfice et la marge sur les revendus, le délai moyen de revente, ce
qui n'est pas encore revendu et depuis quand ; un classement « tes meilleures
sources » par bénéfice et par vitesse ; chaque ligne ouvre la liste des achats
correspondants ; la couverture dite partout ; une vente non reliée à un achat ne
compte dans aucune source (dit). Rien deviné.

## Ce qui existe maintenant

### La règle — `src/meilleuresSources.js` (module pur)

« D'où viennent mes achats » (`src/sourceAchats.js`, 10 nov.) part des VENTES ; ce
module part des ACHATS :

- **Les achats** : les achats Vinted LUS (`buysBase`, sans compte écarté, sans achat
  masqué), hors annulés/remboursés (`achatAnnule`, la règle de « Dépensé ») ; les
  achats hors plateforme (`vinted_offvinted_buys`, source = « Où » qu'il a saisi) ;
  les achats en gros chez un fournisseur QU'IL a créé (`vrm_fournisseurs`,
  src/fournisseurs.js) — un achat hors plateforme rattaché à un fournisseur va chez
  ce fournisseur. Un fournisseur est une ligne à SON NOM (« Karim · Fournisseur »).
- **La source** : `sourceSaisie` (src/sourceAchats.js) reconnaît maintenant aussi
  « eBay »/« Ebay » et « Vestiaire » écrits à la main (avant : « Ebay » devenait une
  source libre « Ebay »). Rien de saisi ⇒ « Source pas saisie », comptée, toujours
  en dernier.
- **Les articles** : un achat Vinted compte ses articles reliés par `buyFromId`
  (fiches + corrections de vente), 1 au moins (un lot relié à 3 fiches = 3) ; un
  achat en gros, ses `paires` ; un achat hors plateforme, 1. L'investi compte chaque
  achat UNE fois (un lot une fois, jamais la somme des parts).
- **Revendu = une vente rattachée par identité** (`achatDeVente`, le même ordre que
  `sourceDeVente`) : `buyFromId` (n° de transaction Vinted relié par SON clic),
  `buyGros.id`, ou le N° d'un achat hors plateforme s'il n'en désigne qu'UN.
  Jamais le titre. Un achat de N articles n'a jamais plus de N revendus. Les ventes :
  Vinted prouvées pas annulées (`classifyOrderStatus`), Leboncoin/eBay/Vestiaire de
  `ventesAutresBenefice` (une commande eBay à plusieurs N° n'est attribuée à rien).
- **Bénéfice** : celui de la règle unique (`beneficeLigneVente`,
  `ventesAutresBenefice`), calculé par l'écran et passé ; « au plus » quand des frais
  ne sont pas confirmés ; inconnu ⇒ la vente reste « revendue » mais hors bénéfice,
  dit (« bénéfice connu pour N »). **Marge** = Σ bénéfice ÷ Σ prix de vente sur les
  seuls revendus au bénéfice connu. **Délai** = date de vente − date d'achat (les
  deux lues ; « sur N » si toutes ne le sont pas).
- **« Pas encore revendu »** (jamais « en stock » affirmé) : aucune vente RELIÉE ;
  depuis combien de jours en moyenne, le plus ancien ; une vente pas reliée à son
  achat laisse l'achat ici, et c'est écrit sous la carte.
- **Hors sources, dit** : « N ventes sans achat relié : comptées dans aucune
  source » ; ventes reliées à un achat Vinted pas lu ici ; achats Vinted pas lus.
- **Classement** : par bénéfice réalisé, ou par vitesse (délai le plus court) ; une
  source sans la mesure n'est jamais classée dessus (après les autres).

### La publication

Un propriétaire : l'écran Ventes/Achats (`App.jsx`, à côté de la publication de
« D'où viennent mes achats ») publie `vrm_meilleures_sources` (cet appareil, comme
`vrm_sources_ventes`). Rien n'est publié tant qu'une lecture manque (ventes, achats,
un compte raté, Leboncoin/eBay pas lus) : la dernière publication reste. Jamais
publiée ⇒ la carte dit « — · ouvre Achats pour les calculer ».

### L'écran — `src/MeilleuresSources.jsx`

Une carte « Tes meilleures sources », montée dans **Argent → Statistiques** (sous
« D'où viennent mes achats ») et dans **Achats** (sous la carte du haut). Elle LIT
la publication (aucun second calcul). Segment « Bénéfice / Vitesse » ; par ligne :
le chiffre du classement, investi, marge, délai (ou bénéfice), « 12 revendus sur 30
achetés · 4 sans prix d'achat », « N articles pas encore revendus · depuis … ». La
source en tête seule à l'accent (bleu Apple ; #0A84FF en sombre), aucun rouge ; 44 px.
Toucher une ligne ouvre une feuille (portail, `FermeAuRetour`, Échap, croix) : SES
achats, du plus récent, avec date, prix (ou « prix pas saisi »), N°, « revendu le … ·
+50 € » ou « pas encore revendu · depuis 30 jours » ; 60 lignes puis « Voir plus ».

## Preuves

- `npm run build` vert. Audits de base verts (variables, tdz, coherence, identite,
  icones, textes-courts, fonctions-api, secrets) ; voisins verts (frise-source,
  achats-sourcing, fournisseurs, achats-relier).
- `scripts/audit-meilleures-sources.cjs` EXÉCUTE la règle (26 contrôles : 50 achats
  identiques, seuls les reliés revendus ; vente sans achat comptée à part et dite ;
  achat annulé ; prix illisible « au moins » ; « au plus » ; lot plafonné ; N° ambigu ;
  « Ebay » ; fournisseur par son nom ; délai ; attente ; classements) et lit les
  écrans. **Rouge sur origin/main** (module absent) ; `--prouve` : **12/12 mutations**
  rouges (rattachement par titre, plafond retiré, prix illisible = 0, annulé compté,
  « au plus » tu, « pas saisie » classée, source sans mesure classée, N° ambigu relié,
  vente sans achat tue, second calcul dans la carte, rouge, carte retirée d'Achats).
- Banc `scripts/bancs/meilleures-sources.cjs` (données inventées, 390 tactile et
  1512, clair et sombre, Achats ET Argent) : 108 verts. Sur le build d'origin/main :
  voir la fin de ce récit. Captures regardées (390 clair/sombre, 1512 sombre,
  feuille 390 sombre) : défaut vu et corrigé (accent trop sombre en mode sombre,
  retrait parasite des lignes).

## Ce qui reste / limites

- La publication vit sur l'appareil (comme « D'où viennent mes achats ») : sur un
  appareil neuf, ouvrir Achats une fois.
- Les achats Leboncoin/eBay/Vestiaire n'existent dans VRM que saisis à la main
  (achat hors plateforme, « Où ») : c'est cette saisie qui fait leur source.
- Toute la période (depuis le début) : pas de filtre de période sur cette carte.

Geste de Julien : aucun.
