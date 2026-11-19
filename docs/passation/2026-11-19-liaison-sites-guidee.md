# 19 nov. — « Relier mes annonces » : la liaison guidée des annonces d'un même article

Branche `claude/liaison-sites-guidee` (partie d'`origin/main` ed9399cb, fondation « VRM natif » fusionnée). Aucune PR.
**Extension non modifiée** (ce qu'elle devrait faire est décrit au §6). Base de production : lecture seule.

Julien, 19 nov. : « je veux vraiment que tu fasses le chantier sur l'amélioration de la liaison des articles entre les
différentes applications : ça doit vraiment être accompagné par l'application, absolument parfaitement. Ça doit être
irréprochable. Il ne peut pas y avoir d'erreur » — puis : « l'outil doit être pratique, pas chiant » — « Ce n'est pas parce
que Vinted est ma plateforme principale que c'est la plateforme principale des autres » — et, sur une photo de l'ancienne
feuille « Relier à Vinted » : « C'est vraiment pas ouf ».

Ce lien décide quelle annonce VRM dit de retirer ailleurs quand l'article est vendu, et sous quel N° il est rangé.

## 1. Mesuré d'abord (base de production, SELECT seuls, 19 nov. — des nombres et des formes, aucune donnée)

| site | annonces à lui, en ligne | reliées, et par quoi | pas reliées, et pourquoi |
|---|---|---|---|
| **Leboncoin** (2 comptes avec session ; 194 annonces rangées dont 19 à lui) | 9 (vues le 18 nov.) | **1** par référence (des chiffres, annonce du 15 oct., donc de la nouvelle série) · **0** par lien posé (les 3 liens existants sont sur des annonces qui ne sont plus vues, tous en « B… », un N° par lien, cohérents avec le marqueur 013) | **8** : publiées les 15–16 nov., aucune référence (`ref` nul, aucun « VRM- » ni « réf » dans les 400 premiers caractères, `numEcrit` « rien ») — publiées sans passer par VRM |
| **eBay** (lu le 19 nov., liste complète) | 4 | **1** par lien (posé depuis un brouillon) | **3** : 1 sans SKU · 1 SKU `VRM-n` dont la fiche a reçu ce N° APRÈS la publication (15 → 18 oct., la panne : `numEbayLu` rend « pas su ») · 1 SKU `VRM-n` qu'aucune fiche ne porte |
| **Vestiaire** (lu le 2 nov., liste partielle) | 3 | **0** | 3 : chacune a reçu SON N° de VRM. Les **3 liens de publication** existent mais sont rangés sous un identifiant de 36 caractères, alors que les annonces lues portent un identifiant de 8 chiffres : aucun ne se rattache (§6) |

- **Même photo** : 9 / 9 annonces Leboncoin et 4 / 4 eBay ont une empreinte ; mais seulement **43 annonces Vinted sur 348**
  en ont une (61 photos, 10 comptes). Résultat : **1** annonce Leboncoin a une candidate par photo (distance 0, un seul N°),
  les 8 autres sont à 16–24 (pas la même photo, ou paire pas encore empreinte) ; eBay : 27–31. Aucune ligne `photo_meme_verif`
  (rien n'est encore « sûr »). ⇒ aujourd'hui la photo ne suffit pas : l'ORDRE des candidates et la recherche comptent.
- 8 titres Leboncoin sur 9 portent une pointure ; 385 fiches Vinted sur 591 portent une taille.
- **Liens qui se contredisent** : **1 sur eBay** (le lien dit un N°, le SKU écrit sur l'annonce en dit un autre, et une
  fiche porte chacun des deux) · 1 annonce Leboncoin (plus en ligne) qui portait deux N° à la coupure · 0 doublon (deux
  annonces d'un site sous un N°) · prix des 4 couples reliés lisibles : rapports 1,00 · 1,07 · 1,10 · 1,62.

## 2. Ce qui est livré

| pièce | rôle |
|---|---|
| `src/liaisonSites.js` (pur) | les GARDES (`jugerLien`), la file et les candidates (`construireLiaison`, `candidatesPour`), les opérations (`opsRelier`, `opsRelierLot`, `opsDelier`, `opsPropre`, `opsPlusTard`, `opsGarder`), la relecture (`verifierLien`), les contradictions |
| `src/liaisonActions.js` (chargé à la demande) | lire, relier, délier, avec ce que l'app lui passe (`deps`) — exécuté tel quel par l'audit |
| `src/LiaisonSites.jsx` + `src/liaison-sites.css` | LE parcours, en « VRM natif » (`PagePoussee`, `Groupe`, `Rangee`, `Bouton`, `Plaque`, `Vide`, `ChampRecherche`) |
| `src/liaisonEtat.js`, `src/LiaisonEntree.jsx` | ce que les autres écrans lisent et posent (§5) |
| `src/App.jsx` | `LiaisonCoque` (l'hôte), `ACTIONS_LIAISON` (les seules portes vers une écriture), `pairesVintedLiaison`, `pistesLiaison`, `donnerNumeroLiaison` ; `annoncesAutresMemePhoto` rend aussi prix, identités lues, « en vente » ; `numEbayLu` lit un lien vers un article sans Vinted ; clé synchronisée `vrm_liaison_sites` |
| `src/gesteAnnulable.js` | la pilule « Annuler » tient la durée demandée par un geste (un lien : **10 s**) |
| `src/ecrans/Leboncoin.jsx` | l'ancienne feuille « Relier à Vinted » (`ChoixVintedLbc`) est RETIRÉE ; « Relier » d'une rangée ouvre le parcours |

**L'article au centre.** Une annonce se relie à un ARTICLE (un N°) : celui d'une annonce Vinted, ou celui d'une annonce d'un
autre site (`articlesDe`). Un vendeur sans Vinted relie son annonce Leboncoin à son annonce eBay. Ce qui est écrit :
Leboncoin `vrm_lbc_liens[annonce] = N°` ; eBay `vrm_ebay_liens[itemId] = { pairId, numero, at, par }` avec une annonce
Vinted, `{ numero, article: true, at, par }` sans ; Vestiaire `vrm_vc_liens[produit] = { numero, item ('' sans Vinted), de,
at, ecrit, par }` ; et, pour chaque lien, sa preuve et sa date dans `vrm_liaison_sites['lien:Site:id']`.

## 3. Ce que voit Julien

1. **Une seule entrée** : « N annonces à relier » (Annonces → Leboncoin / eBay / Vestiaire, Annonces → Outils, la carte du
   jour) et, s'il y en a, « N liens à vérifier ». Rien quand il n'y a rien ; « plus tard » sort du compteur.
2. **Une annonce à la fois** : en haut l'annonce du site (photo, site · compte, titre, taille · prix), qui reste en vue ;
   dessous les articles candidats en grandes cartes (photo, N°, prix, titre, taille, site · compte, place dans le stock).
   L'ordre : le N° tapé · « même photo · sûr » · « même photo · à vérifier » · « publiée par VRM sur ce site » · puis du plus
   proche au moins proche (même taille, mots communs du titre). La puce « T. 42 » ne garde que cette taille.
3. **Toucher une candidate relie.** La « sûre » unique est mise en avant, photo contre photo, avec le seul bouton plein
   (« Relier à N°124 ») : **1 toucher**. Une autre candidate : **1 toucher** sur sa carte (2 avec la recherche). L'annonce
   suivante arrive seule ; la pilule dit « Relié à N°124 · Annuler » pendant 10 s ; la bande dit « Relié à N°124 · vérifié »
   quand la relecture l'a confirmé (ou « la relecture dit autre chose · Voir »).
4. **Une question seulement sur un vrai doute**, une seule, qui montre les deux photos : prix du simple au double, marque
   différente, taille « peut-être » lue dans un titre, référence écrite sur le site qui dit un autre N°, **deux N° en jeu**
   (« Quel N° est écrit sur le carton ? » : N°a / N°b / « Je regarde le carton »).
5. **Un refus expliqué** : tailles lues différentes, annonce déjà reliée, article qui a déjà une annonce sur ce site
   (avec « Le même article, en deux annonces » pour le déclarer), N° porté par deux articles, données pas lues.
6. **Le lot** : dès 2 « sûres », « Relier les N sûres » ouvre la relecture (chaque ligne photo contre photo, cochée,
   décochable) ; « Relier ces N » s'allume une fois le bas de la liste vu ; UN geste.
7. **Les sorties** : « Aucune de celles-ci » (les candidates par photo ne reviennent plus), « Elle n'est que sur
   {site} » (elle devient un article à elle seule ; une annonce Leboncoin sans N° reçoit le SIEN), « Plus tard ».
8. **La fin** : « Tout est relié », puis ce qui reste — « N liens à vérifier », « Plus tard » (toucher = reprendre),
   les sites pas lus. **Une annonce reliée** s'ouvre sur son lien : les deux photos, la preuve (« même photo, sûre »,
   « choisie par toi »…), la date, « Délier ».
9. **Les liens qui se contredisent** : chaque cas montre ses deux côtés (l'annonce, chaque N° avec sa photo et d'où il
   vient : « Lien posé dans VRM », « Écrit dans l'annonce ») ; « Garder celui-ci », « C'est N°… », « Délier », « Garder les
   deux ». Rien n'est tranché seul.
10. **À l'ordinateur** : trois volets (la file · l'annonce · les candidates) ; ← → la candidate, ↑ ↓ l'annonce, Entrée
    relie la candidate en surbrillance, « / » cherche, Échap revient.

## 4. Les garde-fous et leur preuve

`node scripts/audit-liaison-sites.cjs` — **96 contrôles** (44 mutations, toutes rouges), qui EXÉCUTENT la règle, les gestes (avec le vrai moteur
`ecrireOps`), la vraie règle « même photo », les vraies `numeroExterne` et `prochainLibre` d'App.jsx.
`--mutation=toutes` : chaque garde réaffaiblie ⇒ rouge. Sur `git archive origin/main` : rouge (les modules n'existent pas).

| garde | contrôle |
|---|---|
| 50 paires au même titre / taille / photo proche ⇒ aucune mise en avant, à égalité, dans l'ordre de leurs N° | B1 |
| un titre identique parmi 30 ⇒ première (ordre de proposition, jamais un lien) | B1 |
| « même photo · sûr » unique ⇒ en tête, mise en avant, jamais reliée par le calcul ; une seule mesure, un doute, deux paires, deux N° ⇒ jamais mise en avant | B2, B4, J3, H1 |
| déjà reliée ⇒ jamais reproposée ; deuxième lien sur la même annonce ⇒ refusé (même sur un écran périmé) | B3, C1, H4 |
| un article, une annonce par site (sauf déclaration) ; « pas su si elle est en ligne » compte comme en ligne | C3 |
| tailles LUES différentes ⇒ refus sans passage ; taille « peut-être » (nombre isolé d'un titre) ⇒ question | A1–A3, C2 |
| prix du simple au double ET 20 €, marque différente, référence écrite ≠ ⇒ UNE question | A4, A5, C4 |
| N° d'avant le 11 oct. ⇒ désigne l'ANCIENNE paire (B230), jamais la nouvelle 230 | G1–G3 |
| lecture ratée d'UNE carte ⇒ rien d'écrit (relier, lot, délier, plus tard, « que sur ce site », garder) ; même au moment d'écrire | C5, E3, H6, H7 |
| délier, et « Annuler », rendent exactement l'état d'avant (3 sites) ; une identité écrite sur le site ne se « délie » pas | D1, D2, H5 |
| le lot ne relie que les « sûres », chacune rejugée après la précédente | E1–E3 |
| les contradictions sont listées, jamais tranchées ; « garder » les fait taire | F1–F4 |
| deux N° en jeu ⇒ DEMANDÉ ; l'autre N° reste servi ; garder le N° de l'annonce quand l'article a une annonce Vinted ⇒ refus expliqué | J2, J3, J4 |
| « que sur ce site » ne redonne jamais un N° servi (`prochainLibre` : après le plus haut, jamais un trou), jamais un deuxième N° | H8, J4 |
| une annonce que l'ancien écran disait « pas d'article à relier » (reliée, sans N°) ⇒ « que sur ce site », hors de la file | J5 |
| relier n'est appelé que par les actions du parcours ; le calcul ne relie rien | I1–I6 (et `audit-meme-photo` F6) |

Banc de rendu `scripts/bancs/liaison-sites.cjs` (390 × 844 tactile et 1512, clair et sombre, base inventée) : compte les
touchers, lit les liens écrits, mesure contrastes (≥ 4,5:1 sur le fond rendu), cibles (≥ 44), débordements, un seul plein,
grandes photos, aucun texte superposé. `scripts/bancs/meme-photo.cjs` lance désormais ce banc (la feuille est remplacée).
**244 verts, 0 rouge** (19 nov., après la reprise sous Opus). Touchers mesurés : **1** pour une « sûre » (le plein), **1** pour
une candidate touchée dans la liste (y compris la capture de Julien : « Adidas Spezial vert 39,5 » ⇒ N°234 PREMIÈRE parmi 30,
un toucher), **2** quand il y a UN vrai doute (deux N° en jeu : la question puis « N°300 »), **1** pour le lot entier après
la relecture qu'on fait défiler.

Ce que le banc a attrapé à la reprise (corrigé) :
- **Toucher la photo d'une candidate ouvrait la visionneuse** (« la photo en grand, partout ») au lieu de relier : la carte,
  la ligne du lot et la file portent `data-sans-visionneuse` — toucher la carte, photo comprise, relie.
- **Les composants natifs rendus à 34 px** : les règles « bouton » d'`index.html` (hors couche) écrasaient la couche
  `vrm-natif` (plein 50 → 34, « Retour » 30). Réglé par la fondation (`src/coque-native.css`, `all: revert-layer` dans
  `.n-poussee` et les autres pièces natives) : fusionnée, mon correctif d'`index.html` est retiré.
- **« Relier » d'une rangée Leboncoin montrait la PREMIÈRE annonce, pas celle touchée** : l'effet « reprendre sur la
  première » écrasait l'annonce demandée dans le même rendu (mise à jour fonctionnelle, l'annonce demandée gagne ; une
  annonce demandée absente d'un calcul d'avant l'ouverture attend le calcul relancé).
- **La fin oubliait « Plus tard »** (l'annonce écartée par son geste sortait aussi de cette liste) ; « reprendre » la remet.
- Téléphone : la relecture du lot coupait le titre lettre à lettre (photos sur toute la largeur, texte dessous) ; la puce
  « T. 39,5 » passait sur deux lignes.
- L'audit a gagné **J5** : une annonce que l'ancien écran disait « pas d'article à relier » (reliée, sans N°) est « que sur
  ce site », hors de la file — jamais « reliée » à un N° fantôme.

## 5. Pour les autres écrans (ne rien recalculer)

```js
import { ouvrirRelierAnnonces, compteurLiaisonLu, etatLienLu, abonnerLiaison, demanderLiaison } from './liaisonEtat.js';
ouvrirRelierAnnonces({ site: 'Leboncoin', id })       // le parcours sur UNE annonce (reliée : son lien, « Délier »)
ouvrirRelierAnnonces()                                 // là où il s'est arrêté ; { vue: 'contradictions' } : les liens à vérifier
compteurLiaisonLu()   // null = pas su · { n, surs, contradictions, plusTard }
etatLienLu(site, id)  // { etat: 'relie' | 'aRelier' | 'aVerifier' | 'propre' | 'passu', numero, preuve, lieLe }
```
En React : `useLiaison()`, `<LigneLiaison site/>`, `<EtatLien site id/>` (src/LiaisonEntree.jsx). Une annonce qui porte SON N°
(donné par l'écran Annonces) se passe au parcours dans `numeroSite` : la relier à un autre article pose la question des
deux N°.

## 6. Prévenir : ce que fait chaque chemin qui publie, et ce qui demande l'extension

| chemin | identité posée | relue après ? | ce qui manque |
|---|---|---|---|
| eBay (publication, brouillons) | SKU `VRM-{n°}` + lien par `itemId` (`noterLienEbay`, 'publication' / 'brouillon') | oui (le lien est par identifiant d'annonce) | rien côté app |
| Leboncoin (Publier partout, « Créer sur ») | « Réf. VRM-{n°} » en tête et en fin de description (+ champ référence des comptes pro) ; la paire est marquée `vinted_lbc_posted` | seulement si la référence est RELUE dans « Mes annonces » ; l'identifiant de l'annonce créée n'est pas gardé | **extension** : à la confirmation du dépôt, garder l'identifiant de l'annonce Leboncoin créée avec le N° et l'annonce Vinted (ligne dédiée, ex. `lbc_publiees = { [idAnnonce]: { numero, vinted, at } }` — l'extension n'écrit pas `main`), que l'app lira comme identité « publication » |
| Vestiaire | lien `vc_listings.liens[id] = N°` posé par `vcPublie` | **non** : l'identifiant envoyé au dépôt (36 caractères) n'est pas celui des annonces lues (8 chiffres) — mesuré : 3 liens, 0 rattaché, et chaque annonce a reçu un 2e N° | **extension** : `vc-depot.js` doit envoyer l'identifiant NUMÉRIQUE du produit (ou la lecture des annonces doit ranger l'identifiant long dans `cles`), et `numVcAnnonce` le lira |
| Republier (Vinted) | la nouvelle fiche reprend le N° (`repriseNumero.js`) ; les liens Leboncoin sont par N° ; le lien eBay pointe l'ancienne fiche, qui garde son N° | oui | le lien Vestiaire garde l'ancien `item` : la fiche Vinted neuve propose encore « Relier à Vestiaire » (le N° reste juste) |

Côté app, en attendant : les paires que VRM a publiées sur un site et dont aucune annonce lue ne porte le N° (marque
`vinted_lbc_posted`, liens de publication Vestiaire orphelins) sont proposées « Publiée par VRM sur {site} » (à vérifier,
jamais mises en avant, 6 au plus — `pistesLiaison`).

## 7. « Fais tout » (19 nov. au soir) — extension 5.409, eBay, sens inverse, N°

### 7.1 Le lien eBay qui ne se posait pas (Julien : « ça aurait dû se relier tout seul »)
Mesuré (lecture seule) sur ses 4 annonces eBay en ligne : **aucun lien « publication »** ; 1 seul lien, posé par le
chemin « brouillon ». Trois annonces sur quatre datent d'**avant le 19 oct.** (27 sept., 15 oct. ×2) : jusque-là, la
publication ne posait AUCUN lien, seulement le SKU `VRM-{n°}` (commit 2f456f89f du 19 oct.). Les deux SKU du 15 oct. sont
écrits pendant la panne des numéros (11–18 oct.) : la fiche a reçu ce N° APRÈS la publication, ou plus aucune fiche ne le
porte — la règle (`numEbayLu`, et le serveur) refuse exprès d'y croire. La 4ᵉ (27 sept.) n'a pas de SKU.
Depuis le 19 oct., un défaut restait : le lien n'était posé que si l'écran connaissait encore la paire (`pairId`) ; l'annonce
construite (`itemDeBrouillon`) ne la porte pas. Corrigé : `src/ebay/lienPublication.js` — la paire choisie, sinon LA fiche
qui porte le N° envoyé en SKU (une seule), sinon rien. Rattrapage : un SKU que les règles ne croient pas propose l'article
de ce N° **en tête, « N° écrit sur l'annonce · à vérifier »** (une seule fiche sous ce N°), jamais relié sans SON toucher.
Une annonce eBay sans SKU est dans la file comme les autres (photo `i.ebayimg.com`, titre, taille) ; SON toucher pose
`vrm_ebay_liens[itemId]`. Après le lien, « Écrire VRM-N° sur eBay » (route existante `sku`, deux touchers : le second
confirme) pour que la liaison tienne seule. Preuves : `audit-ebay-lien-publication` (8 contrôles, 4 mutations rouges, rouge
sur `origin/main`), `audit-liaison-sites` M1–M2 (+3 mutations).

### 7.2 Ce que l'extension 5.409 ajoute (aucun zip : la version n'est pas encore servie)
| capacité | fonction | ce qui change |
|---|---|---|
| `lbcpubliee` | `garderPublieeLbc` | la soumission Leboncoin `adsubmit/v2/classifieds` répond `{ status: 'created', ad_id }` (forme mesurée dans `lbc_catalogue`) ; retenue dans l'onglet du dépôt, rangée à la page de confirmation du MÊME onglet : `lbc_publiees.publiees[ad_id] = { numero, source, at }`. L'app la lit avec les annonces (une seule requête) ; `numeroLbcIdentite` la compte comme une identité ; la liaison la montre « publication » |
| `vcpubliee` | `retenirPublieeVc` | Vestiaire : à la publication, l'identifiant NUMÉRIQUE du brouillon (`/product-drafts/{n}`, `productDraftId`, `preduct.id` — formes de `vc_recon`) et les fichiers des photos envoyées sont retenus (30 j) ; à la lecture suivante de « Mes annonces », l'annonce qui porte le même identifiant ou le même fichier photo — et elle seule — reçoit `vc_listings.liens[id] = N°`. Les 3 liens d'avant (identifiant IA de 36 caractères, ni brouillon ni photo gardés) ne sont pas retrouvables : ils restent « publiée par VRM · à vérifier » |
Preuves : `audit-publiees-sites` (19 contrôles, exécute le vrai `background.js` ; rouge sur celui d'`origin/main`).
⚠️ À vérifier au premier dépôt réel : que le fichier photo du brouillon Vestiaire est bien celui de l'annonce publiée (si
non, rien n'est relié — un blanc, jamais un faux) ; l'identifiant du brouillon est accepté seulement s'il est ÉGAL à celui
de l'annonce.

### 7.3 Le reste de la commande
- **Sens inverse** : « Relier à Vestiaire » de la fiche Vinted ouvre LE parcours (site Vestiaire, l'article en tête de
  chaque annonce par son N° « tapé ») ; l'ancienne feuille n'est plus ouverte. `ouvrirLiaison({ site, article: { id, numero } })`
  est prêt pour « Relier à Leboncoin / eBay » sur la fiche (chantier de la fiche).
- **`choixVinted`** sorti de `src/ecrans/Leboncoin.jsx`.
- **Serveur** : `api/_lib/double-vente.js` lit un lien eBay vers un article sans Vinted (`article` / `propre`), comme l'app.
- **N° donnés par l'écran Annonces** (`vrm_articles_sites`, chantier « annonces à égalité ») : le N° d'une annonce à elle,
  jamais « reliée », jamais retiré par « Délier » (eBay le reprend en `propre`) — `audit-liaison-sites` K1–K3.
- **`donnerNumero`** (« Elle n'est que sur ce site ») sorti tel quel vers `src/liaisonDonnees.js` et EXÉCUTÉ par
  `audit-liaison-numero` avec les vraies `cleNum`, `prochainLibre`, `entreePool`, `triPool`, `ajouterNumerosHorsEcran`
  d'App.jsx : après le plus haut servi, jamais un trou, réserves / liens / références / stock importé servis, lecture ratée ou
  écriture en attente ⇒ rien (13 contrôles, 7 mutations rouges).

## 8. Ce qui reste

- **Budget du démarrage** : 1 981 Ko (≤ 1 982) avant d'amener `main` le 19 nov. au soir ; **1 985 Ko** après (37 commits de
  `main` + la fondation native, pas encore sur `main`). Les lectures du parcours (`pairesVintedLiaison`, `pistesLiaison`) sont
  sorties d'App.jsx vers `src/liaisonDonnees.js` (chargé avec le parcours) ; ce qui reste au démarrage est l'hôte
  (`LiaisonCoque`, `ACTIONS_LIAISON`) et la ligne d'entrée ; `donnerNumero` est sorti aussi (§7.3). À trancher à l'intégration (relevé daté, comme les précédents, ou une coupe ailleurs).
- `garde-ecrans` est rouge sur l'arbre fusionné avec la fondation native (« l'entrée Ventes est dans la navigation » : la
  coque native a remplacé la navigation que le banc cherche) — au chantier de la fondation, rien dans ce parcours.

- **Garder le N° de l'annonce quand l'article a une annonce Vinted** : refusé et expliqué (renuméroter une fiche Vinted
  touche prix d'achat, case, notes — à faire sur la fiche). À décider avec le chantier « annonces à égalité ».
- **eBay « que sur ce site »** : notée, sans N° neuf (son N° vient de son SKU ou de l'écran Annonces).
- « Corriger la référence sur eBay » depuis une contradiction : le geste existe sur la carte eBay (« Relier à une
  paire », qui écrit le SKU), pas encore dans le parcours.
- Empreintes Vinted : 43 annonces sur 348 — tant que l'extension n'a pas lu les autres, peu de « même photo ».
