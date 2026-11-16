# Sécurité des ventes — 15 nov. 2026 (branche `claude/securite-ventes`, partie de `claude/project-review-nsk5su`)

Julien a validé (« vas-y fais tout ») trois améliorations. Style « Verre dépoli » en place
(`src/design/studio-verre.css`). Aucune donnée réelle, base de prod non touchée, extension non touchée.

## Ce qui existait déjà (mesuré avant de coder)

Deux des trois demandes avaient déjà une RÈGLE dans le dépôt — on n'en a pas créé une seconde (§5 : une règle par
notion, un propriétaire) :

- **Alerte arnaque** : `src/antiArnaque.js` (11 nov., lot anti-arnaque), bannière `src/AlerteArnaque.jsx`, branchée sur
  Vinted, Leboncoin, Vestiaire, eBay et « Tous » ; audit `audit-anti-arnaque.cjs`. La demande citait `src/arnaque.js` :
  la règle reste `src/antiArnaque.js` (même propriétaire, aucun doublon).
  Il manquait : les QUATRE autres langues, le faux « j'ai payé, vérifie ton mail », « paie-moi hors de Vinted », une
  bannière en UNE phrase (elle en avait trois : titre, raison, geste + « signale-le »).
- **Objectif du mois** : `src/objectifMois.js` (4 → 14 nov.) : le réglage `vrm_objectif_mois` (SYNC_KEYS), vendu / reçu /
  bénéfice / ventes, retirable dans Argent (`ObjectifDuMois`, « Retirer »), la valeur = la case « Vendu · mois »
  (`ventesFaites`, comptes écartés exclus), le reste et le rythme (`resteObjectif`). Il manquait : l'ANNEAU sur Ma
  journée (c'était une barre fine).
- **Où vendre ?** : rien. Les règles de frais existaient (`fraisParPlateforme`, `fraisVc`, `montantRecuEbay`,
  `vintedPro.js`) — elles mesurent le PASSÉ ; aucune ne disait « à ce prix, tu toucherais ».

## 1. Alerte arnaque (cinq langues, une phrase)

- `src/antiArnaque.js` : chaque motif écrit aussi en anglais, espagnol, italien, allemand (code reçu par SMS, faux
  paiement bloqué, payer ailleurs — virement/transferencia/bonifico/Überweisung, Bizum, Satispay, Venmo, cartes cadeaux,
  PayPal « amis » —, envoyer d'abord, « son » transporteur, continuer ailleurs, portables étrangers en +44/+34/+39/+49) ;
  + un motif **`fauxPaiement`** (« j'ai payé » au passé ET « regarde tes mails », dans les cinq langues) ; + « hors de
  Vinted ». Toujours : seuls les messages PROUVÉS de l'autre personne sont lus, aucune action, aucun score.
- Faux positifs mesurés à zéro sur les messages normaux inventés (« toujours dispo ? », « tu fais 50 € ? », « J'ai payé,
  merci ! », « I paid via Vinted », « ¿Sigue disponible? », « Ho pagato su Vinted », « Meine Sendungsnummer ist … »,
  n° de suivi, n° de commande…).
- `src/AlerteArnaque.jsx` + `src/design/arnaque.css` : **« Attention : » + UNE phrase** (le risque ET le geste, le site
  nommé — ex. « un e-mail ne prouve aucun paiement. N'envoie rien avant la vente confirmée sur Vinted. ») + « Ouvrir sur
  Vinted » (son clic, jamais un signalement automatique). Voile ambre à 12 %, trait ambre, texte à l'encre ; jamais de
  rouge. Les autres signes vus restent dans `data-arnaque-motifs` et le survol.

## 2. « Où vendre ? » sur la fiche d'un article

- Règle pure **`src/ouVendre.js`** ; écran **`src/OuVendre.jsx`** (+ `src/design/ou-vendre.css`) ; la coque
  `OuVendreCoque` (App.jsx) le pose dans la fiche « Tout sur le N° », sauf pour une paire déjà vendue.
- Le prix : celui de SON annonce en ligne, par identité (`siVendue.prix` de la fiche, sinon le prix lu de la seule annonce
  en ligne), modifiable. Illisible (« 2k ») ⇒ « — » partout.
- Par site, AUCUN barème inventé :
  - **Vinted** : compte particulier LU ⇒ aucun frais vendeur (mesuré : `fraisPlateformes.js`, `vintedPro.js` — la
    Protection acheteurs est payée par l'acheteur). Compte Pro, comptes mixtes ou statut pas lu ⇒ « frais inconnus ».
  - **Leboncoin** : la règle du bénéfice (le prix capté est ce qu'il touche).
  - **eBay** : le taux MOYEN des frais LUS (`totalMarketplaceFee` / `totalDueSeller`, commandes engagées, en euros) de ses
    **20 dernières** ventes ; moins de 5 ⇒ « frais inconnus ». Le port est payé par l'acheteur (§2.8) : jamais compté.
  - **Vestiaire** : la commission LUE (`fraisVc` : prix affiché − versé) de ses 20 dernières ventes, même seuil.
  - Pourquoi « les dernières » : des sites tiers disent que eBay a retiré ses frais aux particuliers le 1er sept. 2026 et
    que Vestiaire a changé son barème en 2026 ; les pages officielles eBay/Vestiaire n'ont pas pu être ouvertes depuis la
    session (réseau). Leurs titres sont CITÉS (`SOURCES_FRAIS`), les adresses Vinted (`/pricelist`, `/help/550`) et
    Leboncoin (`/legal.htm`) aussi — aucun n'entre dans un calcul.
- Estimation ⇒ « ≈ » et « frais ≈ 19,5 % (16,3 à 21,9 %) sur tes 7 dernières ventes » ; frais arrondis vers le HAUT
  (jamais un centime promis de trop). Le plus haut parmi les sites reliés aux frais connus : « le plus » (capsule à
  l'encre, aucune couleur) ; ex æquo ⇒ tous ; un seul connu ⇒ aucun. Un site sans compte relié : grisé « pas relié »,
  jamais « le plus ». Un site relié aux frais inconnus ⇒ « Le plus haut parmi les sites aux frais connus. »

## 3. Objectif du mois : l'anneau

- `src/anneauObjectif.js` (pur) + `src/design/AnneauObjectif.jsx` (+ `anneau-objectif.css`) : sur **Ma journée**,
  `CarteStats` dessine l'anneau à la place de la barre (les autres cartes gardent la barre). Centre : la part
  (« 18 % », « ≥ 18 % » si « au moins », « — » si pas su — jamais « 0 % ») ; à côté : « Objectif 9 000 € vendus » et
  « encore 7 320 € · ≈ 458 € par jour jusqu'au 30 nov. ». Le montant vendu n'est pas réécrit (il est dans la case
  du mois, §7). Toucher l'anneau ⇒ le réglage « Objectif ». Les mêmes `data-objectif-*` que la barre.
- Le réglage reste celui d'avant : posé dans Argent (vendu, reçu, bénéfice ou ventes), synchronisé, « Retirer » le coupe.

## Preuves

| contrôle | résultat |
|---|---|
| `node scripts/audit-anti-arnaque.cjs --prouve` | vert (144 contrôles : 64 vrais positifs dont 30 neufs en 5 langues, 47 messages normaux, chaque motif muté ⇒ rouge) ; **rouge sur l'arbre de départ** (`cc0e7291`) : 29 contrôles |
| `node scripts/audit-securite-ventes.cjs --prouve` | vert ; 9 mutations ⇒ rouges ; rouge sur l'arbre de départ (règles absentes) |
| `scripts/bancs/securite-ventes.cjs` (base inventée : 1 000 paires, 1 000 conversations, 3 comptes) | **100 verts, 0 rouge** — 390 tactile, 1512, clair, sombre ; le contrôle « l'anneau ne couvre aucune case » était ROUGE sur le build d'avant le correctif d'ordinateur (il couvrait « Vendu » et « Reçu ») |
| `scripts/bancs/anti-arnaque.cjs` (adapté : voile ambre, jamais rouge) | vert, 4 vues |
| `scripts/bancs/objectifs-mois.cjs` (adapté : l'anneau sur Ma journée) | 68 verts |
| `scripts/bancs/verre.cjs` (`ECRANS=journee,messages,fiche`) | 120 verts |
| audits urssaf, chiffres, une-regle, identite, traduction, tdz, variables, studio, csp, objectif-mois, quoi-de-neuf, coherence | verts |

## Sur ordinateur (piège rencontré)

La tuile du mois de Ma journée a la hauteur d'UNE rangée (128 px) : l'anneau sous les cases était rogné. Il se pose à
droite des cases (`position: absolute` dans la tuile) et les cases laissent sa place — cette marge est dans la couche
`vrm-verre` (`@layer`), car la grille du studio pose `margin: 0 !important` dans SA couche et, pour un `!important`,
la couche nommée la première gagne : hors couche, la règle perdait sans bruit.

## Geste de Julien

Aucun. (Pour qu'eBay ait un montant dans « Où vendre ? », il faut 5 ventes eBay aux frais lus ; pour Vinted, que le
profil de chaque compte ait été lu par l'extension — sinon « frais inconnus », dit.)
