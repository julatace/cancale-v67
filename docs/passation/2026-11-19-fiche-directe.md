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
   l'annonce sur le site ; ce qui n'est pas lu est dit : « Pas lu : Leboncoin ») ; **UN bouton plein** selon l'état
   (Imprimer le bordereau / Relier · N € / Baisser le prix / Saisir le prix d'achat) ; les **gestes en tuiles** (Prix,
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
plus|montee`). Chiffres : voir le rapport de la session (fin de ce fichier).
