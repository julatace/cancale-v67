# 16 nov. 2026 — La loupe pardonne une faute de frappe (lot `recherche-tolerante`, mission 8)

Branche `claude/recherche-tolerante` (depuis `origin/main`). Mission :
`docs/passation/file-attente-16nov/8-recherche.md` (validée par Julien). Rien dans `vinted-sync-extension/`.

## Ce qui existait (lu avant de coder)
La loupe (`src/rechercheUnique.js`, `src/rechercheEcran.js`, panneau dans `App.jsx`) trouvait déjà
tout ce que la mission cite, par IDENTITÉ : N° (« 124 », « B124 », « 007 » par `cleNum`, bloc
« Tout sur le N° »), pseudo (« tomj606 »), n° de suivi, code de retrait, n° de transaction / commande,
facture, montant au centime, mots du titre / marque / taille **sans accent** (`normaliser`), en
groupes (Paires, Ventes, Achats, Colis, Retraits, Messages, Annonces, Factures, Stock, Retours), le
plus probable d'abord (`ordre`), exactes en tête. **Il manquait la faute de frappe** : « air mxa »,
« jordn chicgo » ne trouvaient rien.

## Ce qui change
- `src/rechercheUnique.js` : quand rien d'exact ne trouve une entrée, un mot du TITRE tapé avec une
  faute la trouve « à une faute près » :
  - 3-4 lettres : deux lettres voisines inversées seulement (« mxa » = max, « nkie » = nike) ;
  - 5-7 lettres : une faute (lettre en trop, en moins, changée, ou deux inversées) ;
  - 8 lettres et plus : deux fautes.
  Distance de Damerau bornée (`distanceFautes`), sur un **vocabulaire** des mots du titre préparé
  AVEC l'index (`indexMemo` ⇒ `vocabulaire`, gardé dans un `WeakMap` : même index, même vocabulaire),
  les mots proches d'un mot tapé gardés aussi (une lettre ajoutée ne refait que ce mot).
- Un **pseudo** à une faute près (5 signes et plus), mais **jamais sur un chiffre** : « tmoj606 » ⇒
  tomj606 ; « tomj660 » n'est PAS tomj606, ni « acheteur_1998 » acheteur_1999 (deux personnes).
- Une trouvaille approchée : `proche: true`, **jamais `exact`**, jamais « correspondance exacte »,
  rangée APRÈS toute trouvaille exacte (`RANG_PROCHE` 4,6 pseudo / 4,8 titre), et elle ouvre SON
  objet (sa transaction, sa fiche) comme les autres.
- **§5 tenu** : aucune identité n'est tolérée — N°, n° de suivi, code de retrait, transaction,
  commande, facture, montant : égalité (ou sous-chaîne, comme avant) seulement ; un mot à CHIFFRES
  (« 42 », « 90 ») non plus (la 43 n'est pas la 42). Rien n'est relié ni modifié : c'est une lecture.
- Écran : la pastille de la ligne dit le mot compris (« ≈ jordan ») ; l'infobulle
  `vp.loupe.proche` (« Trouvé à une faute de frappe près : « {mot} » ») en 5 langues ;
  `data-recherche-proche="1"` sur la ligne. Une ligne « Quoi de neuf » (`loupe-faute-frappe`).
- Option `tolerance: false` de `chercherPartout` : la règle d'avant (utilisée par la mesure).

## Preuves
- `node scripts/audit-recherche-tolerante.cjs` (NEUF) : 34 contrôles verts — fautes (« air mxa »,
  « jordn chicgo » ⇒ les 50 jumelles, « gazele », « salomn », « nkie air », « medicis »/« MÉDICIS »),
  combien de fautes (« nikr », « slmon » : rien), identités jamais tolérées (suivi, code inversé
  « 500132 », transaction, « 142 » ≠ N°124, « 52,10 € », « air max 43 »), « 124 » parmi 50 paires au
  même titre ⇒ LA N°124 seule en tête (et la 1124 dessous), « b124 », « 007 », ordre exact puis
  proche (« kayano » / « Kayamo »), pseudos, destination, pastille, vitesse.
  **Rouge sur le code d'avant** (9 rouges avec le `rechercheUnique.js` d'origin/main) ;
  `--prouve` : **12/12 mutations** attrapées.
- Vitesse (20 000 ventes + 2 000 fiches, 22 000 entrées, 51 frappes lettre à lettre, machine
  partagée chargée à 25-35) : **13 à 20 ms par frappe en moyenne** (sans tolérance : 4 à 17 ms) ;
  le vocabulaire se prépare avec l'index, pas à la frappe.
- `audit-recherche-unique` 24/24 ; `audit-recherche-exacte` 43/43 ; `audit-traduction`,
  `audit-quoi-de-neuf` verts. `audit-recherche-universelle` : ses deux contrôles de TEMPS (frappe
  < 16 ms, index + frappe < 300 ms) sont rouges **aussi avec le code d'origin/main** sur cette machine
  chargée (27,9 ms / 483 ms avant, 21-27 ms / 406-505 ms après) — la charge, pas le lot.
- Banc `scripts/bancs/recherche-universelle.cjs` : bloc « fautes de frappe » ajouté (« jordn chicgo »
  ⇒ 50 paires « ≈ … », « nike air mxa » ⇒ ventes « ≈ max », « 1924 » parmi 50 jumelles ⇒ LA N°1924
  seule, « 500132 » ne sort pas le colis du code 500123). Résultat : voir « ÉTAT À LA REPRISE ».

## ÉTAT À LA REPRISE
- Fait, poussé, PR #1220 ouverte (pas fusionnée : l'agent « train » fusionne).
- Banc `recherche-universelle` (17 nov., 4 tours 390/1512 clair/sombre) : le bloc « fautes de frappe » est VERT
  partout (« jordn chicgo » ⇒ 50 paires « ≈ jordan », « nike air mxa » ⇒ « ≈ max », « 1924 » parmi 50 jumelles ⇒ LA
  N°1924 seule, « 500132 » ne sort pas le colis 500123) ; une mesure de temps rouge (874 ms, 1512 sombre, machine
  chargée ; 126-295 ms ailleurs). Ses autres rouges (« onitsuka 44,5 » en deux lignes par « phrase », « Voir les 38
  autres » 58/50, « deux ventes au même titre », code « En grand », boutons 36 px, temps) sont **les mêmes sur
  origin/main** (1b358a738, banc d'origine : 26 rouges) — sans lien avec ce lot. Captures `loupe-faute-*.png` regardées.
- Lancer un banc avec `TMPDIR` dans le scratchpad fait échouer Chromium (chemin de socket trop long) : garder /tmp.
- Rien à faire pour Julien.
