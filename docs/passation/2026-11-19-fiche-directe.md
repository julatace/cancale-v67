# 19 nov. 2026 — La fiche directe (branche `claude/fiche-directe`)

Julien, 19 nov., mot pour mot : « Il y a énormément de choses qui ne me plaisent pas, par exemple les fiches des paires
de chaussures : je dois cliquer sur la paire puis cliquer sur les points pour avoir des informations. Ce n'est pas
normal, ça doit être beaucoup plus accessible et beaucoup plus simple. […] le visuel doit être absolument parfait. »
Puis, le même jour : « dis-toi que l'outil doit être pratique, pas chiant » ; « Ce n'est pas parce que Vinted est ma
plateforme principale que c'est la plateforme principale des autres. Tout doit être parfait sur chaque application. »
Rappel : le 15 nov. il avait rejeté une fiche de six écrans (« C'est trop long ») — on n'empile pas, on montre
l'essentiel d'un coup.

## Ce qui change pour lui

1. **Un seul toucher.** Toucher la rangée d'un article ouvre directement SA fiche, partout :
   - Annonces (liste A et C du nouveau design : c'était déjà le cas ; ancienne liste, Leboncoin, eBay, Vestiaire, Stock
     d'avant : la rangée ne « monte » plus à sa place avec quatre chiffres et « ⋯ » — `src/paires/PaireAvant.jsx`) ;
   - Stock (nouveau design) : plus de feuille « N°… » puis « Tout sur la paire » ; sa place, « Voir », « Déplacer »,
     « Ranger » sont posés dans la fiche (`DansFiche`, place « contexte ») ;
   - Aujourd'hui : un colis de la bande ouvre sa fiche (il menait à l'écran Ventes) ;
   - la recherche : la rangée « L'article » de « Tout sur le N° » ouvre la fiche (elle menait à l'écran Annonces) ;
   - Ventes : déjà direct.
2. **La fiche montre tout sans rien toucher** (premier écran d'un iPhone, 390 × 844) : photo (touchable : en grand,
   les autres photos), étiquette N°, titre sur 2 lignes, UNE ligne d'état (ambre seulement s'il y a un geste) ; la grille
   de **faits** — Prix (ou « Vendue ») · Prix mini · Achat · Bénéfice (ou « Bénéfice prévu ») · Taille · En ligne (jours)
   ou Vendue le · Place · Favoris · vues (s'ils sont lus) ; les **sites et comptes** (une rangée par site, qui ouvre
   l'annonce sur le site, sur UNE ligne : « Leboncoin · son compte », puis le prix s'il diffère, sinon l'état ; ce qui
   n'est pas lu est dit : « Pas lu : Leboncoin ») ; **UN bouton plein** selon l'état
   (Imprimer le bordereau / Relier · N € / Baisser le prix / Saisir le prix d'achat), la ligne qui le situe (« Bordereau
   prêt · 7 j pour poster », « Aucune offre en 20 jours ») posée SOUS l'état, dans l'en-tête ; les **gestes** en GRILLE de
   rangées (2 colonnes au téléphone, 3 à l'ordinateur, « Vendu ailleurs » en dernière rangée) (Prix,
   Photos, Note, Republier, Ailleurs, Dupliquer, Emballer, Bordereau, Son N°, Rappel, Certificat, Autre taille —
   seulement ceux qui ont un sens : pas de « Prix » sur une paire vendue, pas de doublon du bouton plein) ; l'**histoire**
   repliée à ses 3 dernières étapes puis « Tout voir » (le parcours entier, l'état, les frais, les infos, les
   republications — tout ce que portait l'ancien « Tout voir », maintenant SUR la fiche). L'achat relié y dit son
   vendeur, sa date, son prix, avec « Reçu » et « Délier ».
   Plus d'onglets Argent · Sites · Histoire. « ⋯ » (téléphone) ne garde que les gestes rares de la ligne et « Vendu
   ailleurs » ; à l'ordinateur ils sont posés en bas du volet, sans menu.
3. **Les valeurs se changent en les touchant, sur place** : « Achat » et « Prix mini » ouvrent leur champ à leur place
   (Entrée écrit, Échap annule ; un geste annulable, sans confirmation) ; « Prix » ouvre « Prix partout », le champ prêt ;
   « Place » ouvre le Stock sur ce N°. Un fait pas su s'écrit « — » avec sa raison courte (« à saisir », « pas lu »,
   « sans prix d'achat »), jamais 0 ; un bénéfice dont les frais ne sont pas tous confirmés reste « au plus ».
4. **L'article, pas l'annonce Vinted** : un N° que ne porte aucune annonce Vinted (Leboncoin seul, eBay seul) a la même
   fiche — son titre, sa photo, son prix, ses jours en ligne, ses favoris viennent de l'annonce de SON site.
5. Le message passager (« 24 nouvelles paires numérotées ») se pose en bas de l'écran pendant la fiche : il ne couvre
   plus ni la barre ni la photo.

## Gestes raccourcis (demande : « si un geste demande plus de 2 touchers, raccourcis-le »)

| geste | avant | maintenant |
|---|---|---|
| voir prix d'achat, bénéfice, sites, histoire | 1 à 2 touchers (onglets) | 0 |
| saisir le prix d'achat (paire en vente) | onglet Argent → « ? » → feuille → Enregistrer | toucher « Achat — », taper, Entrée |
| poser le prix mini | rangée → « ⋯ » → case « accepter dès » | toucher « Prix mini », taper, Entrée |
| Note, Photos, Dupliquer, Ailleurs, Rappel, Emballer… | « ⋯ » → tuile | la tuile |
| gestes rares d'une annonce (file Leboncoin, passeport, marquer vendue…) | « ⋯ » → « ⋯ » de la ligne → le geste | « ⋯ » → le geste (posés à plat, `MenuLigneFiche`) |
| place d'une paire du Stock | rangée → feuille → « Tout sur la paire » | rangée (la fiche porte sa place) |

Restent à 2 touchers : « Reçu » et « Délier » d'un achat relié quand l'achat n'est pas dans les 3 dernières étapes
(toucher « Achat » y mène) ; « Délier » garde sa confirmation (décision du 16 nov., geste annulable).

## Où est le code

- `src/ficheProduit.js` (PUR) : **`articleFiche(p, o)`** — LA seule entrée de la vue (voir « L'entrée de la fiche ») ;
  `faitsFiche` (la grille, l'ordre du contrat natif), `etatCourt`, `actionFiche`, `tuilesFiche`, `histoireFiche`.
  Aucune règle de calcul ne change : le bénéfice est celui de `parcoursPaire` (`beneficeArticle`), « si vendue » celui de
  `beneficeSiVendue`, l'achat proposé celui de `liaisonAchat`, les sites ceux de `sitesPrixDe` (identité).
- `src/FichePaire.jsx` : la vue. `src/design/fiche-d.css` : sa matière (jetons `--fd-*`).
- `src/App.jsx`, `rendreFichePaire` : les sites enrichis (id, prix mini, vues, adresse, titre, photo, date, favoris des
  autres sites), `sitesManques`, la taille, les photos, `edits` (achat, prix mini : les écritures d'avant, par `gesteVrm`),
  `achatParNum`, `siVendue`, `onRepublier` ; `MenuLigneFiche` ; la bande d'Aujourd'hui (`attrsFicheLigne`).
- `src/paires/PaireAvant.jsx`, `PaireAvantSite.jsx`, `src/stockV2/StockV2.jsx`, `src/ecrans/Loupe.jsx`,
  `src/designV2/Aujourdhui.jsx`, `src/PrixPartout.jsx` (`focusPrix`).
- Textes : `src/i18n/langues/*/fiched.js` (`fd.e.*`, `fd.f.*`, `fd.r.*`…), 5 langues. Quoi de neuf : `fiche-directe`.

## L'entrée de la fiche (pour le branchement « annonces à égalité »)

`articleFiche(p, o)` (src/ficheProduit.js) rend l'objet que la vue dessine ; elle ne lit rien d'autre.

- `p` : le parcours du N° (`histoireArticle`) — `{ num, titre, taille, photo, double, ancienNumero, etat, manques, idFiche,
  aPoster, txAPoster, limiteEnvoi, etapes[], resume{ achat, vente, benefice, benefPartiel, raisonBenef, siVendue{ prix,
  benefice, etat, raison }, detail } }` (montants en centimes, `null` = pas su) ;
- `o.sites` : UNE entrée par annonce ou par vente, tous sites confondus —
  `{ site: 'vinted'|'leboncoin'|'ebay'|'vestiaire', etat: 'en-ligne'|'vendue', id, compte, prix (centimes|null),
  date (ms, vente), depuis (ms, mise en ligne lue), favoris, vues, lien (https), titre, photo, mini (centimes|null),
  miniPorte (cette annonce peut porter un prix mini) }` ;
- `o.sitesManques` (noms des sites pas lus ; `undefined` = lecture en cours), `o.etat` (`etatArticle`), `o.taille`,
  `o.photos[]`, `o.neuve`, `o.achatParNum` (centimes, quand aucune fiche d'annonce ne porte le prix d'achat),
  `o.siVendue(prixCentimes, achatCentimes)` (la règle `beneficeSiVendue`), `o.relie`, `o.peut{ achat, relier, prix, mini,
  place }`, `o.dispo` (gestes fournis), `o.action{ proposition, peutRelier, peutBordereau, peutBaisser, peutSaisir }`.
- Sortie : `{ num, titre, taille, photo, photos, double, ancien, situation, etat, faits[], prixRef, sites, sitesManques,
  action, gestes[], histoire[], p }`.

Les écritures arrivent par `edits = { achat(texte), mini(idAnnonce, texte) }`. Aujourd'hui : `achat` écrit la fiche de
l'annonce (`poserPrixAchatVente`) ou, sans fiche, le prix PAR N° (`vinted_buyprice_by_num`) ; `mini` écrit `min` sur la
fiche de l'annonce Vinted. ⚠️ Limite d'aujourd'hui, dite : un SKU eBay « VRM-N » ne désigne un N° que si UNE fiche
numérotée le porte (`numEbayLu`) ; le N°, l'achat et le prix mini portés par l'annonce du site elle-même sont le travail
de `claude/annonces-a-egalite` — il n'a qu'à remplir `o.sites` (avec `miniPorte`), `o.achatParNum` et `edits`.

## Preuves

Banc `scripts/bancs/fiche-directe.cjs` (base inventée : `baseFiches()` + sans photo, titre très long et 1 250 €, 6 sites,
tout pas su, Leboncoin seul, eBay seul ; 390 tactile, 1512, 1280, clair et sombre), jugé par les `data-*` :
U un toucher depuis Annonces, Ventes, Stock, Aujourd'hui, la recherche ; F les faits, l'en-tête, les sites et le plein au
premier écran, « — » avec sa raison ; P rien seulement derrière « ⋯ », plus d'onglets ; S la saisie sur place ; Q un
plein, cibles, contrastes, débordements, 1,5 écran, message passager ; A l'article sans annonce Vinted.
Rouge sur le code d'avant (`BANC_DIST` = build d'`origin/main`) et sous mutation (`MUTATION=faits|photo|pleins|onglets|
plus|montee`).

### Chiffres (relance sous Opus, 19 nov. au soir)

- **Après** (build de `claude/fiche-directe`, natif-fondation fusionnée, DSF 2) : **1 130 ✅ · 0 ❌** — 9 cas × 390 / 1512 /
  1280 × clair / sombre, un toucher depuis Annonces (390, 1512), Ventes, Stock (390, 1512), Aujourd'hui, la recherche ;
  saisie sur place (achat, prix mini, prix) clair et sombre.
- **Avant** (build d'`origin/main` ad73a3c7c, 390 clair) : **78 ✅ · 133 ❌** — plus de faits visibles (onglets), photo
  310 px, gestes derrière « ⋯ », Leboncoin seul / eBay seul « N° jamais servi », un toucher depuis Stock, Aujourd'hui, la
  recherche et Annonces n'ouvre pas la fiche complète.
- **Mutations** : `faits`, `photo`, `pleins`, `onglets`, `montee`, `plus` — chacune rougit son contrôle (la mutation `plus`
  a été corrigée : la feuille « ⋯ » fermée n'est plus montée par le natif, elle ne mordait plus).
- Q2 (1,5 écran) : 3105 (6 sites) mesure 1 450 px ; le plafond compte une rangée de plus par site au-delà de deux (aucun
  site caché, F4).

### Ce qui a changé à la relance

- La règle globale `button { min-height: 34px; font-size: 13px }` (index.html, hors couche) écrasait les tailles natives
  (retour 30 px, plein 36 px) : le pont `src/coque-native.css` de `claude/natif-fondation` (revert-layer) la neutralise
  dans les pages natives — fusionné, plus rien à poser ici.
- « — » et sa raison sur UNE ligne (`Faits.jsx`, `.n-fait-ligne`) ; les gestes en grille de rangées (2 colonnes au
  téléphone, 3 à l'ordinateur) avec « Vendu ailleurs » en dernière rangée (bouton d'avant rendu en `Rangee`) ; la ligne
  qui situe le plein sous l'état ; un site par ligne avec son compte ; l'histoire avec son montant ou sa date à droite.
- À l'ordinateur : la fiche est un volet à droite (`.n-fiche`, 560–720 px), la liste reste visible et touchable ; aucun
  « ⋯ » (Certificat, Son N° dans la grille). Quand la coque à trois volets portera les écrans d'avant, la même page
  s'ouvrira dans son volet de détail (`PagePoussee` le fait déjà).
- La taille d'un article sans annonce Vinted se lit en fin du titre de SON annonce (Leboncoin, eBay).
- Banc `ecrans-verre-2` : ses vues `fiche-*` (fiche D) ne sont plus jouées par défaut — la fiche est jugée ici.
- Banc `fiche-paire` : il ouvre « Tout voir » puis « Étapes » (le parcours vit sur la fiche) : 92 OK · 2 KO — les deux KO
  (E, 390 et 1512) sont le bouton loupe de la recherche (`button[data-recherche-loupe]`), changé par la coque native.
- Restent rouges, pas de la fiche : `garde-ecrans` (17 ; 0 sur main) — la navigation et l'en-tête de la coque native ;
  `ecrans-verre-2` (Argent et Paramètres « en blanc sur le fond ») ; `fiche-partout` 52 KO (42 sur main) — des rangées
  d'avant introuvables (sélecteurs du Studio) et des délais « fiche posée en N ms » sur une machine saturée ; les « toucher
  la ligne ouvre LA fiche » à 390, rouges sur main, y passent. `design-v2` arrêté par la limite de 2 h (pas de verdict).

## 19 nov. au soir — la fiche refaite en FICHE PRODUIT

Julien, sur la planche 3102 : « c'est de la merde la fiche de la paire » (photo de 124 px à côté d'un gros titre, grandes
cases blanches « — à poser » : « on dirait l'app Réglages »). Puis : « il faut que ça rende bien sur iPhone et ordi ».
Direction D « fiche produit » (validée le 15 nov., `docs/design/maquettes-validees/fiche/`) dans le style « entre Vintex
et le natif » (`docs/design/NATIF.md` §2 bis). Le train `origin/claude/integration-19nov` a été fusionné d'abord (vrai merge).

- `src/natif/ecrans/Fiche.jsx` (vue pure) + `src/natif/fiche.css` (couche `vrm-natif`, jetons seulement) :
  1. **Galerie** pleine largeur, carrée (au plus 42 % de la hauteur ; 34 % si le titre est très long), toutes les photos
     en carrousel avec points, toucher = plein écran ; plaque N° sur la photo. Ordinateur : galerie à gauche (45 %),
     collée en défilant, miniatures dessous.
  2. **En-tête** : titre jamais coupé, étiquettes douces (état · « En ligne 9 jours » / « Vendue le … » · « Taille 40 »).
  3. **Prix en très grand**, pastilles « mini 70 € » « achat 40 € » « +45 € » ; chacune se touche (achat, mini : sur place).
     Une valeur qui se corrige et manque = « Ajouter » en bleu ; sinon « — » et sa raison. Jamais 0.
  4. **UN plein** contextuel + « Choisir une action ▾ » (toutes les actions dans une feuille, « Vendu ailleurs » compris) —
     en haut, à côté du prix ; au téléphone sur UNE rangée (« Actions ▾ »). Plus de grille de gestes, plus de « ⋯ ».
  5. **Informations** en tableau à filets (libellé gris / valeur, rangées 44) : place, favoris · vues (et taille / date
     quand elles ne sont pas sues — sues, elles sont des étiquettes, jamais écrites deux fois).
  6. **Sites** en tableau : site · compte · prix · vues · favoris · état (téléphone : deux lignes par site ; ordinateur :
     de vraies colonnes alignées, sous-grille). Toucher = l'annonce sur le site.
  7. **Histoire** en frise fine, dates à gauche, repliée à 3, « Tout voir ».
- **Les messages passagers ne couvrent plus jamais la fiche** : `src/natif/zoneMessages.js` — la fiche pose une zone DANS
  sa page, la pile des messages (`Toaster`, App.jsx) s'y range dans le flux (elle pousse la page).
- **Annonces** (liste unique, `src/ecrans/AnnoncesEgalite.jsx` + `src/natif/ecrans/Annonces.jsx`) : un toucher sur un
  article numéroté ouvre SA fiche complète (avant : une fiche courte puis « Toute la fiche »).
- Toutes les photos de l'article : celles de l'annonce Vinted (la série `photos` lue, `numData.stats[id].photos`) puis
  celles des autres sites.
- Banc `fiche-directe.cjs` réécrit pour la fiche produit (F2 : prix et pastilles au premier écran, le reste avant
  1,5 écran ; P2 « Choisir une action » au premier écran ; G : un toucher montre les gestes ; Q2 : 2 écrans au plus) et
  section **I** — appareils : iPhone 390 × 844 et 430 × 932 en application installée (zone sûre 47 / 34), iPhone 390 en
  onglet Safari (664 utiles), ordinateur 1512 × 900 et 1280 × 800, clair et sombre : photo pleine largeur sans bande vide,
  titre et prix jamais coupés, rien sous l'encoche, plein et « Actions » visibles sans défiler, cibles, contrastes, aucun
  défilement de côté. `PHOTOS_BANC=<dossier>` (design-passe) sert de vraies photos de chaussures (libres, jamais celles
  d'un vendeur, jamais dans le dépôt).
- Ventes et Aujourd'hui natifs (autres lots) ouvrent le DÉTAIL de la vente au toucher ; leurs chemins ne sont plus joués
  par défaut (`CHEMINS=ventes,journee`).
