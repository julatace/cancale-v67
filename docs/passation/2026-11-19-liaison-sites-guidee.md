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

## 7. Ce qui reste

- **Garder le N° de l'annonce quand l'article a une annonce Vinted** : refusé et expliqué (renuméroter une fiche Vinted
  touche prix d'achat, case, notes — à faire sur la fiche). À décider avec le chantier « annonces à égalité ».
- **eBay « que sur ce site »** : notée, sans N° neuf (son N° vient de son SKU ou de l'écran Annonces).
- Le serveur (notification de double vente) ne lit pas encore un lien eBay `{ numero, article }` (sans Vinted).
- « Corriger la référence sur eBay » depuis une contradiction : le geste existe sur la carte eBay (« Relier à une
  paire », qui écrit le SKU), pas encore dans le parcours.
- Le sens inverse depuis la fiche Vinted (« Relier à Vestiaire ») garde l'ancienne feuille (`HoteLienVc`, sens 'vinted').
- `src/ecrans/Leboncoin.jsx` : `choixVinted` est encore calculé (plus lu) ; les rangées sont au chantier « annonces à égalité ».
- Empreintes Vinted : 43 annonces sur 348 — tant que l'extension n'a pas lu les autres, peu de « même photo ».
