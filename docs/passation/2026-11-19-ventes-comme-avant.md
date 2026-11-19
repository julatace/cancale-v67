# Ventes « VRM natif » — 19 nov. 2026

Branche `claude/ventes-comme-avant`. Pas de PR (consigne). Rien changé dans l'extension, la base ou CLAUDE.md.

## Ce que Julien a dit, dans l'ordre

1. « Regarde les ventes, elles sont pas belles, j'aimais bien comme c'était avant » ; « sur l'app en mobile c'est pas
   fou du tout, même sur ordi là c'est une catastrophe, l'ergonomie est atroce ».
2. Puis : « la mise en page est catastrophique, revois absolument tout […] je veux quelque chose de drastique, nouveau,
   totalement différent » ⇒ UN seul design, « VRM natif » (`docs/design/NATIF.md`) ; les habillages « VRM », « Apple »
   et l'ancien design disparaissent.
3. Audit d'utilité (`docs/design/2026-11-19-audit-utilite.md` §2, ligne Ventes) : segments **À envoyer · En route ·
   Terminées**, un bouton **Filtrer** au lieu des rangées de sites, la recherche avec le scanner dans le champ, pas de
   « ? », plus de grande carte « À envoyer : 30 » (le segment porte le nombre).
4. Décision n° 6, Julien (« 4 oui ») : « Préparer mes colis », « Je dépose », la tournée de dépôt et « Emballer » sont
   RETIRÉS de Ventes ; le dépôt est constaté par le suivi. « Imprimer N bordereaux » reste LE plein.
5. Capture de Julien (iPhone, 17:54, « tout est moche ») : vignettes vides, rangées de ~190 px à 4 lignes avec la même
   phrase sur chaque ligne, plaque énorme ⇒ rangées de 72, une phrase commune = l'en-tête du groupe, vraies photos.

## Ce qui a été fait

- `src/designV2/VentesV2.jsx` et son banc `design-v2-ventes.cjs` : **retirés** (la liste v2 n'est plus le défaut,
  décision du 19 nov.).
- `src/ventes/modeleVentes.js` (pur, aucune règle neuve) : chaque colis en rangée-objet — échéance LUE (« avant le … ·
  dans N j ») ou ESTIMÉE (« vers le … », jamais « dans N j », jamais « en retard » : une estimée dépassée devient
  `estimee-depassee`), case du lot (cochée d'office par `cochesEffectives`, grisée et jamais cochée sans bordereau),
  place lue ou rien, état du bordereau, écart nommé, plein « Imprimer N bordereaux » (N = cochés, sinon sa raison),
  recherche par N° / titre / acheteur / suivi (contient, jamais « ressemble »), détail choisi (jamais une autre vente).
  Juge : `scripts/audit-ventes-modele.cjs` (31 verts, 12 mutations sur 12 rougissent).
- `src/App.jsx` (Comptabilite) : `rangsEnvoyerNatif` / `rangsRouteNatif` remplissent ces rangées avec les règles
  d'avant (`aExpedier`, `echeanceCourteColis`, `avantDemainColis`, `lignesLotTous`, `preuvesFriseDe`, `ouDansMeubles`) ;
  les gestes sont les fonctions d'avant (imprimer le lot, format, choisir, préparer, déposer, tournée, emballer,
  scanner, retrouver, la fiche par identité). Aucune règle ni calcul changé. `VENTES_NATIF` : la tête, la liste et
  « En route » d'avant ne sont plus rendues pour Ventes ; leurs feuilles (papier, impression, scanner…) restent.
- `src/natif/ecrans/Ventes.jsx` : l'écran, composé des composants natifs, sans style en ligne ni classe de mise en page.
  `Page` · `Segmente` (À envoyer N · En route N · Terminées) · liste groupée de `Rangee` 72 (case, vignette, plaque N°,
  titre sur 2 lignes, « T · avant le … · dans N j », prix et transporteur à droite, 3e ligne : place · bordereau ·
  compte · site — retirée après la capture : la rangée fait 72, titre sur 1 ligne, « N° · T40 · avant le … » dessous,
  prix et place à droite ; bordereau absent = case grisée + « 15 sans bordereau » dans l'en-tête) · plein collé
  « Imprimer N bordereaux » · balayage = Imprimer (franc) / Déposé (rattrapage) · toucher = la fiche
  de la vente poussée (`PagePoussee`) : faits (vendu, pour toi, date limite, place, transport, acheteur), étapes
  prouvées, gestes en rangées. En route : une rangée par colis, son étape « 2/4 · Déposé », balayage « Suivre ».
  Filtrer (feuille des plateformes), « ⋯ » (Format, Choisir, Scanner).
- Photos : la vignette native chargeait l'image Vinted avec le référent ⇒ le CDN refuse ⇒ carré vide. `Vignette` reçoit
  `image` (ajout) et l'écran lui passe la `<PhotoVinted>` de l'app (sans référent, relais de l'extension si l'adresse a
  expiré) ; sans photo, l'icône dessinée. `Vignette` seule charge aussi sans référent.
- `src/design/jetons.css` : le défaut `:where(.vrm-app-shell) button` / `a` (hors couche) battait les composants natifs
  (`@layer vrm-natif`) — le plein sortait gris. Exclu pour les classes `n-…` ; tous les écrans natifs en profitent.
- La coque : `sansRecherche` sur `TeteNative` (Ventes porte la sienne : une seule recherche) ; la barre du haut d'avant
  n'est plus posée au-dessus d'un écran à trois volets ; les filtres de site d'avant ne sont plus portés dans la barre.
- `src/natif/Rangee.jsx` (ajouts, rien renommé) : `selection` (la case à gauche, 44 × 44, à côté du corps) et `note`
  (3e ligne grise).
- Ventes est dans `ECRANS_NATIFS` (App.jsx, coque de la fondation, livraison 2) : la coque dessine le grand titre ; à
  l'ordinateur, trois volets — la liste (380–520) et le détail à droite, la liste toujours visible ; sans vente touchée,
  le volet dit « Touche une vente pour la voir ici. ». Terminées garde la liste d'avant (deux volets).
- Textes par `tr()` (fr, en, es, it, de) ; ligne « Quoi de neuf » `ventes-natif`.

## Preuves

`scripts/bancs/natif-ventes.cjs` — base inventée (`design-passe.cjs`), 390 × 844 tactile, 1512 et 1280, clair et
sombre, base vide. Dernière exécution (build de la branche, `BANC_DIST`) : **180 verts, 2 rouges** — les 2 rouges à
1280 (titre 128 px, ligne de la date 122 px, sous le seuil d'alors de 140 ; la capture montre « vers le 22 nov. » entier :
seuil ramené à 120). Code d'avant (`git archive origin/main`, build à part) : **24 rouges**. Mutations : `case` (case
cochée sans bordereau) ⇒ rouge, `plein` (second plein) ⇒ rouge, `largeur` (liste non bornée) ⇒ rouge ; `estimee` n'a pas
rougi le banc (la base n'a pas d'estimée dépassée lisible) — cette garde est prouvée par `audit-ventes-modele --prouve`
(12/12). Le contrôle « titre et date lisibles » a rougi sur le build qui écrasait le titre (44 / 0 px). Après la dernière
exécution, « pour toi » (redit sur chaque rangée En route) a été retiré de la rangée (il reste dans le détail) : pas
re-photographié. Captures : `scratchpad/ventes-apres/`.

## Le dépôt constaté sans geste (décision n° 6)

Un colis Vinted quitte « À envoyer » par `aExpedier` : dès que la liste des ventes relue porte un statut « déposé /
expédié / en transit / livré » (`COLIS_DEJA_BOUGE`) ou un `transaction_user_status` autre que `needs_action`, il passe
« En route ». Cas où RIEN ne le constate tout de suite : (a) tant que l'extension n'a pas relu les ventes du compte
(onglet vinted.fr fermé, compte pas relu) — le colis reste « À envoyer » jusqu'à la lecture ; (b) les colis
Leboncoin / eBay / Vestiaire suivent leurs propres lectures (non vérifié ici) ; (c) un bordereau sans n° de suivi lu
(Vinted Go sans e-mail de suivi) n'a que le statut Vinted. Le balayage « Déposé » (rattrapage) reste sur la rangée.

## Ce qui reste

- À 1280, la coque garde 41 px de marge de chaque côté de la colonne de liste : le titre se coupe tôt (« New Balance
  xt-6… »). La date limite est entière. À voir avec la fondation (marge de `.n-coque-ecran` en trois volets).
- Au téléphone, la place dans le stock suit la date sur la 2e ligne et se coupe souvent (« à vérifier · Étag… ») ; elle
  est entière dans le détail.
- Bancs d'avant qui ouvraient « Préparer », « Je dépose », la tournée par Ventes (colis-plus, preparer-relais,
  photo-colis-scan, calculette-emballages, studio-ventes, ventes-verre, theme-apple) : non relancés (machine saturée) ;
  ils jugent l'écran d'avant, retiré par décision du 19 nov.

- « Terminées » montre encore la liste d'avant (elle n'est pas refaite en natif) ; l'audit veut « la date de versement ».
- La décision n° 6 (gestes de « ⋯ ») attend Julien.
- Le code d'avant de Ventes (VentesVerre, ARegarder, la tête v2) n'est plus rendu mais reste dans App.jsx : à retirer
  quand Terminées sera natif.
