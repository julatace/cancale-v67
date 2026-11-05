# 5 novembre 2026 — Fournisseurs : les personnes à qui il achète en gros

## Ce que Julien a dit (mot pour mot)

> « le fournisseur dans achat, c'est pas du tout ça c'est une personne à qui tu
> achètes en gros pas des vendeurs particuliers sur vinted »

## Ce qui était faux

Achats → outils → « Fournisseurs » (4 nov.) faisait un fournisseur de **chaque
vendeur Vinted** chez qui il avait acheté (`fournisseurVinted` : le pseudo lu dans
la transaction, sinon « Vinted »), plus un groupe par « source » d'achat hors
plateforme. Mesuré sur le build d'avant (banc `fournisseurs`, capture
`z-fo-390-1-vide.png` de l'arbre d'avant) : la feuille listait `grossiste_y`,
`vendeuse_x` et « Fournisseur », triables par dépense.

## Ce qui existe maintenant

### Les règles — `src/fournisseurs.js` (module pur)

- **Un fournisseur est une personne qu'IL crée** : nom (obligatoire), téléphone,
  e-mail, note (en option, refusés s'ils sont illisibles). Il le modifie ou le
  retire. Le registre vit dans la ligne `main`, clé synchronisée
  **`vrm_fournisseurs`** (ajoutée à `SYNC_KEYS` : fusion à trois voies clé par clé
  comme les autres réglages, `useStateCle` + `onCloudReady`, écrit par `save`) :

  ```
  { personnes: { [id]: { nom, tel, email, note, creeLe } },
    achats:    { [id]: { fournisseur, date, paires, total, frais,     // centimes
                         repartition: { mode: 'egal'|'main', base: 'prix'|'frais'|'' },
                         parts: { [clé de fiche]: centimes },          // paire par paire
                         gardes: { [clé de fiche]: centimes },         // ses « Garder ce prix »
                         creeLe } },
    hors:      { [id d'achat hors plateforme]: { fournisseur, at } } }
  ```

  **Aucun paramètre de la règle ne reçoit les achats Vinted** : la liste ne peut
  venir que de ce registre. `bilanFournisseurs` ignore tout `achats` qu'on lui
  passerait (l'audit le vérifie, une mutation qui l'écoute rougit).

- **Un achat en gros** se crée depuis la fiche du fournisseur : date, nombre de
  paires, montant total, frais en option (transport…). Les « Lots » d'achats Vinted
  (`estLot`, `ecrituresRepartition`) n'ont pas été réutilisés tels quels : ils sont
  bâtis sur le n° de transaction Vinted (`buyFromId`, `^\d{4,20}$`) et le prix de la
  commande lue ; un achat en gros n'a ni l'un ni l'autre. On réutilise leurs
  briques (`partsEgales`, `centimesDe`) et leur principe (proposition, rien
  d'écrit sans son clic, état d'avant rendu en déliant).

- **Les paires se relient à leurs N° par SON clic** : le lien est posé sur la
  fiche de la paire, `buyGros: { id, at, part, avant }` (jamais par titre, marque,
  taille ou photo). Une fiche déjà reliée à un achat Vinted (`buyFromId`) ou à un
  autre achat en gros ne se relie pas ; un achat de 10 paires n'en relie pas une
  11ᵉ. Les N° proposés sont ceux de « Relier » (`asoFichesLibres`), qui écarte
  maintenant aussi les paires reliées à un achat en gros. La fiche dit « 5 sur 20
  reliées ».

- **Le prix d'une paire vient de SA répartition** :
  - *Part égale* : `partsEgales(base, N)` sur les N paires de l'achat — la somme des
    N parts = le total, au centime (100 €/3 = 33,34 + 33,33 + 33,33) ; une paire
    reliée prend la part de son rang (ordre du lien), le reste des centimes aux
    premières ;
  - *Paire par paire* : ce qu'il tape ; tant que toutes ne sont pas reliées, la
    somme peut rester sous le total (« Reste 210 € pour les 7 paires pas encore
    reliées ») mais jamais le dépasser ; toutes reliées : juste au centime ;
  - *Frais* : « Prix seul » ou « Avec les frais » — **son choix** ; sans choix,
    aucune part n'est proposée (« Choisis le montant à répartir »).
- **Un prix saisi à la main n'est JAMAIS remplacé sans lui** (`origineDuPrix`) :
  « saisi à la main » = un prix sur la fiche qui n'est pas celui que CE lot a écrit
  (`buyGros.part`), ou un prix saisi par N° (`vinted_buyprice_by_num`). Relier pose
  le prix seulement sur une fiche sans prix ; « Poser le prix d'achat » confirme la
  liste, puis DEMANDE paire par paire « Remplacer » / « Garder 35 € ». « Garder » est
  retenu (`gardes`) : la question ne revient que s'il retape un autre prix. Délier
  rend le prix d'avant (`avant`) si le lot l'avait remplacé, retire le prix posé par
  le lot, garde un prix saisi à la main. Retirer un achat (ou un fournisseur) délie
  ses paires de la même façon.

- **Les achats d'avant** : un achat hors plateforme déjà saisi avec la source
  « Fournisseur » est PROPOSÉ au rattachement sur la fiche d'un fournisseur ; rien
  n'est rattaché tout seul ; « Détacher » l'enlève. Une vente lui est attribuée par
  le N° de l'achat, seulement si ce N° ne désigne qu'un achat hors plateforme (la
  règle d'avant). Les achats Vinted restent des achats Vinted.

### La fiche d'un fournisseur

| chiffre | règle |
|---|---|
| Dépensé | ses achats en gros (total + frais) + ses achats rattachés ; un prix illisible ⇒ « au moins 520 € » et « 1 prix illisible » ; rien de lisible ⇒ « — » |
| Paires achetées | N de chaque achat en gros + 1 par achat rattaché ; « 3 reliées à un N° » |
| Prix moyen | dépensé / paires au prix connu (jamais / toutes), « — » sans achat |
| Revendues | ventes Vinted prouvées (pas annulées, compte pas écarté) dont la fiche porte `buyGros` d'un de ses achats, + ventes Leboncoin/eBay/Vestiaire de `ventesAutresBenefice` par la fiche unique de leur N° |
| Bénéfice | somme des bénéfices CONNUS (`beneficeLigneVente`, `ventesAutresBenefice`), « au plus » si des frais ne sont pas confirmés, « — » si aucun ; couverture « sur 12 vendues, prix d'achat connu pour 9 » |

⚠️ **Jamais « au moins » sur un bénéfice** : la demande disait « “au moins” quand
c'est partiel » ; la règle de l'app (`src/beneficeNoms.js`, 3 nov.) l'interdit — une
paire au prix d'achat inconnu peut avoir été vendue à perte, ce n'est pas un
plancher. « Au moins » est donc dit sur le **dépensé** (une somme de montants
positifs), et le bénéfice partiel porte sa couverture à côté. Si Julien veut
autre chose, c'est `texteBeneficeFournisseur` / `texteCouverture`.

### L'écran — `src/AchatsOutils.jsx`

Liste (vide : « Ajoute ton premier fournisseur : la personne à qui tu achètes en
gros. » + « Ajouter un fournisseur ») → fiche (contact cliquable, chiffres, achats
en gros, « Nouvel achat en gros », achats déjà saisis, Modifier / Retirer) → achat
en gros (Part égale / Paire par paire, Prix seul / Avec les frais, paires reliées
avec leur part et d'où vient leur prix, « Relier un N° », « Poser le prix
d'achat (n) », Modifier / Retirer). Feuille en portail, Échap ferme, « ‹ » revient.
Styles `vrm-fo-*` dans `src/styles-achats-outils.css` (échelle Fusion).

`src/achatsSourcing.js` ne porte plus `fournisseurs`, `fournisseurVinted`,
`fournisseurHors`, `trierFournisseurs`, `TRIS_FOURNISSEURS`.

## Preuves

- `node scripts/audit-fournisseurs.cjs` — **50 contrôles verts** (V aucun vendeur
  Vinted, R répartition au centime, M prix saisi jamais écrasé, I identité, C
  chiffres, A l'app). `--prouve` : **27/27 mutations rouges**. Copié dans l'arbre de
  `claude/project-review-nsk5su` (`git archive`) : **rouge** (V1 : l'ancienne
  dérivation fait encore des fournisseurs de `vendeuse_*` ; le module n'existe pas).
- `node scripts/bancs/fournisseurs.cjs` (`BANC_PORT`, défaut 8347 ; `CAPTURES=`) —
  données inventées, 390 tactile et 1512, clair et sombre : **112 verts**. Sur le
  build de la base : **12 rouges** (la feuille liste grossiste_y et vendeuse_x).
  Mutation de l'écran (« Relier » remplace le prix saisi à la main) : **16 rouges**.
  Captures regardées : liste vide, formulaire, achat, paires reliées (« saisi à la
  main : 35 € » en ambre), question Remplacer/Garder, « prix gardé », fiche (300 €,
  10, 30 €, 1 revendue, « au plus +60 € », « sur 1 vendue, prix d'achat connu
  pour 1 »), rattachement (11 paires, 360 €).
- `scripts/audit-achats-sourcing.cjs` mis à jour (section F retirée, F1 : plus de
  dérivation exportée) : 32 verts, 12/12 mutations ; banc `achats-sourcing` : 104
  verts (la feuille Fournisseurs y est vide, sans pseudo).
- Verts : `coherence`, `identite`, `icones`, `fonctions-api`, `benefice` (48),
  `benefice-unique` (56), `annonces-outils`, `comptes-exclus`, `lien-vc`, `urssaf`.
  Rouges **déjà rouges sur la base** (pas touchés) : `numerotation-lecteurs` (1),
  `bilan-semaine` (2), `fusion-echelle --verifier` (5 fichiers).
- `npm run build` vert.

## Ce qui reste

- Le registre des achats (Compta → Registres, `src/registres.js`) ne lit pas encore
  les achats en gros : il compte les achats Vinted et hors plateforme. Un achat en
  gros y entrerait comme UNE ligne (total + frais), jamais la somme de ses parts —
  à décider avec lui.
- Les ventes Vestiaire/Leboncoin/eBay ne comptent que si `ventesAutresBenefice` est
  lu (sinon la fiche dit « ventes Vinted seulement »).
- Geste de Julien : Achats → Fournisseurs → « Ajouter un fournisseur », créer un
  achat en gros depuis sa fiche, relier quelques N°.
