# 6 nov. — Vague 3 : la même paire en ligne deux fois (Ma journée)

File de la vague 1. Branche LOCALE `v36-vague3-doublons-en-ligne`, partie de
`claude/project-review-nsk5su` (be6b7179). Rien dans `vinted-sync-extension/`, `public/`
intact. Rien poussé.

## Ce qui existait déjà (mesuré dans le code avant d'écrire)

| cas | qui le dit déjà |
|---|---|
| Vinted + Leboncoin/eBay/Vestiaire, même N° | **voulu** (« Publier ailleurs », `src/publierAilleurs.js`) ; quand l'une se vend, « Vendus ailleurs » (`src/VendusAilleurs.jsx`, carte de Ma journée) la fait retirer |
| Deux annonces Vinted sous le même N° | le bloc **rouge** « N numéros portés par deux paires » (`conflitsDeNumeros`, Colis + Ma journée) et le règlement automatique des doublons (`doublonsAReattribuer`, décision du 20 oct.) |
| Une annonce et SA recréation (`recreeDe`) en ligne ensemble | le règlement ne renumérote pas (28 oct.) ; le bloc rouge reste |
| La même paire (photo exacte) en ligne deux fois sur Vinted, N° différents ou sans N° | **personne** — le cas qui manquait |

## Mesuré sur sa base (SELECT seulement — aucun nom, titre ni pseudo ici)

- 14 lignes `harvest_*_listings` ; 11 lues dans les 24 h ; **57 annonces ouvertes** (56 lues
  dans les 24 h, 7 masquées), toutes numérotées.
- Parmi les annonces lues dans les 24 h : **0** groupe de même photo exacte, **0** groupe de
  même `photoK`, **0** même N° sur deux annonces (ni sur deux comptes), **0** même dossier de
  photo. **Aujourd'hui, aucun cas réel.**
- Dans l'historique des 522 fiches (`vinted_annonce_numeros`) : **7** photos exactes portées
  par deux fiches — toutes au même N°, même compte, dont 6 par `recreeDe` (des
  républications : l'ancienne fiche reste après la suppression). Le cas arrive donc quand une
  suppression de Republier échoue. 24 numéros portés par deux fiches (anciens doublons).
- Vinted + eBay sous le même N° : 1 (voulu). eBay 5 annonces (4 SKU `VRM-`), Leboncoin 186
  entrées, Vestiaire 3.

⇒ Décision : une carte AMBRE dans Ma journée, seulement quand un cas existe (rien sinon).

## Ce qui change

### 1. `src/enLigneDeuxFois.js` (module pur)
`enLigneDeuxFois({ vinted, fiches, autres, clePhoto, cle, maintenant })` rend
`{ su, manque, vinted, numeroSeul, sites, auMoins }` :
- **entrée** : par compte Vinted les annonces que la règle `<enligne-regle>` dit EN LIGNE
  (jamais « à confirmer », jamais masquées) ; un compte en échec, sans heure de lecture ou lu
  il y a plus de 24 h ne conclut RIEN et est nommé dans `manque` (`raisonPasSu`) ;
- **`vinted`** (le geste) : deux annonces Vinted de même **photo exacte** (`photoKey` d'App.jsx
  sur la photo de l'annonce, ou `photoK` de sa fiche — jamais le dossier seul) ou reliées par
  **`recreeDe`** ; union-find, preuves nommées (`photo`, `recree`) ;
- **`numeroSeul`** : le même N° sur deux paires Vinted d'identités différentes — PAS « en ligne
  deux fois » (c'est peut-être deux paires) : déjà dit par le bloc rouge, aucune carte ;
- **`sites`** : Vinted + un autre site sous le même N° — voulu, aucune carte ;
- `texteCarte(groupes)` : titre + ligne d'UNE ligne chacun à 390 px (« N°12 en ligne deux
  fois » · « 2 comptes · supprimes-en une »), le reste dans `complet` (infobulle).

### 2. Ma journée (`Comptabilite`, App.jsx)
`enLigneDeux` (useMemo après `annoncesPresentes`) passe `listings.items`, `listings.lues`,
`listings.ko`, sans les comptes écartés (`acctOff`). Carte `data-en-ligne-deux-fois` dans
« À faire », comptée dans « N gestes », ligne en ambre (`is-urgent`). « Voir » ouvre une
`SheetShell` (`src/EnLigneDeuxFois.jsx`, `src/en-ligne-deux-fois.css`) : chaque annonce
(photo, titre, compte, N°, id) avec « Ouvrir sur Vinted » (nouvel onglet). **Aucune
suppression depuis VRM** (§3) : il supprime celle en trop sur vinted.fr ; la lecture suivante
du dressing la sort.

### 3. `doublonsAReattribuer` : la même paire n'est pas renumérotée
Deux annonces au même N° ET à la même `photoK` (fiches) sont UNE paire : comme pour
`recreeDe`, on ne donne pas de numéro neuf (sinon : un carton, deux N°, « écris le nouveau sur
le carton » à tort). Le bloc rouge reste ; la carte ambre dit d'en supprimer une. Deux paires
au même N° avec des photos différentes (ou sans photo connue) : règle du 20 oct. inchangée.

## Preuves

- `node scripts/audit-en-ligne-deux-fois.cjs` : 34/34 ; exécute la VRAIE règle, la VRAIE
  `photoKey` et le VRAI `doublonsAReattribuer` (extraits d'App.jsx). 50 paires au même titre
  ⇒ aucun doublon ; photo exacte (deux tailles d'URL ou `photoK`) ⇒ un groupe ; `recreeDe` ⇒
  un groupe ; même N° seul ⇒ `numeroSeul` ; même dossier ⇒ rien ; lecture de 30 h, sans heure
  ou ratée ⇒ rien, nommée ; Vinted + eBay ⇒ `sites`. Sur l'arbre d'avant : 9 rouges sur 11.
  `--prouve` : **13/13 mutations** rouges (titre, dossier, photo ignorée, `photoK` ignorée,
  `recreeDe` ignoré, N° qui unit, lecture vieille/sans heure/ratée qui conclut, `sites` en
  alerte, manque tu, renumérotation de la même paire, Ma journée qui lit « à confirmer »).
- Banc `scripts/bancs/en-ligne-deux-fois.cjs` (données inventées, port 9651, 390 tactile et
  1512) : 42/42. Carte présente, une ligne par texte, ambre, comptée ; feuille aux deux
  annonces, liens vinted.fr ≥ 44 px, aucune écriture ; 50 titres identiques ⇒ aucune carte ;
  second compte lu il y a 30 h ⇒ aucune carte. **4 rouges** sur le build de be6b7179 ;
  mutation « par titre » ⇒ 2 rouges. Captures regardées (390, 1512, feuille).
- `npm run build`, `audit-identite`, `audit-coherence`, `audit-rouge-doublon`,
  `audit-conflits-numeros` (et `--prouve`) verts.

## Ce qui reste

- Une republication À LA MAIN (hors VRM) re-téléverse les photos : fichier différent, même
  dossier. Le dossier seul n'est pas une identité (§5) : ce cas n'est vu que si la paire porte
  le même N° (bloc rouge). Rien de plus sans identité neuve.
- Deux annonces de même photo exacte ET même N° : le bloc rouge (« deux paires ») et la carte
  ambre (« en ligne deux fois ») s'allument ensemble. Le rouge n'a pas été touché
  (`conflitsDeNumeros` ne connaît pas la photo) ; à décider s'il doit se taire pour une paire
  prouvée la même.
- Deux annonces eBay (ou Leboncoin) du même N° sur le même site : hors de ce chantier.
- Geste de Julien : aucun (la carte n'apparaît que si le cas existe).
