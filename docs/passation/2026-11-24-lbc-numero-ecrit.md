# 24 nov. — Leboncoin : le N° écrit à la fin de la description relie l'annonce à sa paire

Branche `claude/lbc-numero-ecrit` (base `main`), **à fusionner après #1348** (ext. 5.446, « même photo
d'origine », qui introduit `liensLbcLus()`). Aucune modification de l'extension.

## La décision

La question ouverte de `2026-11-23-passation-generale.md` §3 « Leboncoin » : relier une annonce Leboncoin à sa
paire par le N° écrit en fin de description. Julien, 24 nov. : **« Oui, relie par le N° »**. Une annonce dont la
description finit par « N°132 » est reliée à la paire 132. Sans N° écrit, rien n'est deviné.

## La règle (`src/lbcNumeroEcrit.js`, pure)

Une annonce est reliée par son N° écrit seulement si :

- la description est lue **en entier** : la lecture de l'extension (`numEcrit`, 5.334, description entière) ou un
  texte gardé en entier (< 400 caractères) ; la lecture est celle de `src/numeroEcrit.js`, **description seule**
  (le réglage « où est ton numéro » n'y change rien) ;
- elle porte **un seul** N° (`cleNum`) : un autre N° dans la description ou dans le titre ⇒ « deux numéros » ;
- elle est sur **un de ses comptes Leboncoin** prouvés (session vue `sessionAt`, ou une vente où il est vendeur) ;
- le N°, traduit par la remise à zéro du 11 oct. (`numeroExterne(k, id, 'lbcAnnonces', date de publication)` :
  « 3 » écrit avant la coupure = B3, l'ancienne paire), est celui d'**une** paire connue (fiches Vinted, fiches
  neuves, articles des autres sites, liens eBay, N° Vestiaire), pas de deux (`lireNumerosAmbigus`) ;
- aucune autre de ses annonces Leboncoin ne porte ce N° (écrit, ou relié à la main) ;
- il n'a rien décidé pour cette annonce : **son lien gagne** (même vide = défait, jamais refait) ;
  **« Délier » = « pas la même paire » pour CE N°**, retenu dans le journal du parcours
  (`vrm_liaison_sites`, clé `nonEcrit:Leboncoin:<id>` = `{ numero, at }`, annulable 10 s) ; s'il écrit plus
  tard un autre N°, celui-là se relit.

Sinon rien n'est relié ; « Relier mes annonces » montre l'annonce « à relier » avec la raison
(`deux-numeros`, `partielle`, `inconnu`, `deux-paires`, `deux-annonces`, `delie`), une phrase neutre (le gris des
faits de l'annonce, jamais ambre). Jamais le titre (un « N°124 » dans le titre seul ne relie rien).

**Rien n'est écrit en base** : l'identité est calculée à chaque lecture (`chargerNumerosEcritsLbc`, App.jsx :
lit `lbc_listings`, `lbc_accounts`, `lbc_ventes` en projection ; lecture ratée ⇒ rien publié) et superposée aux
liens posés par `liensLbcAvecNumeroEcrit` (même forme que `liensLbcAvecPhoto` de #1348).

## Le branchement : une règle, un propriétaire

`liensLbcLus()` (App.jsx, exporté) = `liensLbcAvecNumeroEcrit(liensLbcPoses(), identité publiée, journal)`.
Il remplace la lecture brute de `vrm_lbc_liens` exactement aux endroits que #1348 a changés (le même nom, les
mêmes lignes) : retirer ailleurs (Vinted, eBay, Vestiaire : `aRetirerDeLbcVinted`, `aRetirerDeLbcEbay`),
ventes croisées, N° donnés aux annonces Leboncoin (`numeroterSites`), bénéfice et ventes Leboncoin,
recherche par N°, la fiche (`sitesAutresFiche`), Leboncoin (`avecNumeroEcritLbc` sur la carte fusionnée),
eBay, Annonces à égalité, Réglages. Les N° « déjà pris » et les gestes (écrire) lisent toujours les liens posés.

- Numérotation : une annonce reconnue par son N° écrit porte déjà le N° de sa paire ; une annonce dont la fin
  porte un N° qui n'a **pas** relié ne reçoit **jamais** un N° neuf (son carton en porte déjà un).
  Une description partielle sans lecture entière garde le comportement d'avant.
- « Relier mes annonces » (`annoncesAutresMemePhoto` → `autresAvecNumeroEcrit`) : reliée, preuve
  `numero-ecrit` (« N° écrit dans l'annonce ») en tête ; « Délier » (`src/liaisonActions.js`) note le journal.
- Réglage « Je numérote moi-même » allumé : l'ancienne lecture (`numeroEcritLbc`, titre et référence compris)
  reste dans `numeroLbcIdentite` comme avant ; elle n'est pas touchée par ce lot.

### Après #1348

Les deux PR définissent `liensLbcLus()` et `liensLbcPoses()` dans App.jsx et changent les mêmes lignes de
lecture (même texte `liensLbcLus()` : pas de conflit sur ces lignes). Conflit attendu sur la définition, à
résoudre ainsi (ses liens, puis le N° écrit, puis la photo d'origine) :

```js
function liensLbcLus() { return liensLbcAvecPhoto(liensLbcAvecNumeroEcrit(liensLbcPoses(), identEcritDuCompte(), load(CLE_LIAISON, {}) || {}), identPhotoDuCompte()); }
```

et sur l'export (`export { liensLbcLus, avecPhotoLbc }` / `export { liensLbcLus, liensLbcPoses, chargerNumerosEcritsLbc }` :
les garder tous une fois). `delier` (`liaisonActions.js`) : les deux branches (photo d'origine, N° écrit) se
suivent. L'audit B4 (`audit-lbc-numero-ecrit`) attend le texte ci-dessus en tête : à ajuster si la composition
change (le N° écrit avant la photo : c'est SON écriture).

## Mesuré (base réelle, lecture seule, 24 nov.)

`lbc_listings` : 194 annonces ; 19 sur ses comptes (session vue) ; 9 portent une lecture entière `numEcrit`
(toutes « rien d'écrit ») ; 53 descriptions coupées à 400 caractères (1 seule des siennes sans lecture entière).
Aucune ne porte aujourd'hui un « N°… » écrit à la main à la fin. 2 finissent par « Réf. VRM-n » (écrit par
VRM à la publication), sur un de ses comptes, en entier : leur N° est celui de leur référence (`ref`) et d'une
fiche (pas de deux) ⇒ la règle les relie au **même** N° qu'aujourd'hui (aucun changement). Donc : reliées 2
(identiques à avant), ambiguës 0, inconnues 0, partielle 1, sans N° 16.

## Preuves

- `node scripts/audit-lbc-numero-ecrit.cjs` : 34 verts — 50 annonces identiques ⇒ 50 liens, chacun le sien ; sans
  N° ⇒ 0 ; titre seul ⇒ rien ; partielle, deux numéros, deux paires, inconnu, autre vendeur, deux annonces,
  remise à zéro, pas su ; sa main (lien, lien défait, « Délier » retenu et relu à l'instant, un autre N° relu) ;
  `delier` exécuté ; branchement (30 lectures `liensLbcLus()`, aucune lecture brute là où une identité se
  décide, jamais réécrit, numérotation, écran, 5 langues).
- `--mutations` : relier par le titre, ignorer « Délier », accepter une lecture partielle, ignorer un lien posé ⇒
  chacune ROUGE. Sur `origin/main` (git archive) : rouge.
- Banc `scripts/bancs/lbc-numero-ecrit.cjs` (390 tactile, 1512, clair) : reliée sans toucher (preuve
  `numero-ecrit`, rien écrit dans les liens), « deux paires » et « inconnu » dits en gris neutre (contraste
  ≥ 4,5:1, jamais ambre), titre seul ⇒ rien, « Délier » ⇒ journal, rouverte « tu as dit que ce n'est pas la même ».
- Voisins verts : audit-identite, audit-liaison-sites, audit-liaison-numero, audit-numero-ecrit,
  audit-numero-etiquette, audit-traduction, audit-coherence, audit-fiche-sites (regex élargie à `liensLbcLus()`),
  audit-meme-photo, audit-parite-sites, audit-renum-b, audit-restauration, audit-lbc-restes, audit-quoi-de-neuf…

## Geste de Julien

Écrire « N°132 » (ou « N° 132 », « #132 ») sur la **dernière ligne** de la description de ses annonces
Leboncoin, puis ouvrir « Mes annonces » sur leboncoin.fr (l'extension lit la description entière).
