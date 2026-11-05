# 5 novembre 2026 — Plateformes : logos, compte de la vente, « Publier ailleurs », filtres d'achat

Branche `v31-plateformes-logo` (depuis `claude/project-review-nsk5su`, à jour avec `main`).
Demandes de Julien : `docs/passation/demandes-2026-11-05.md` §6 et « Précisions du vocal »
(« ventes, achats, codes de retrait de Leboncoin, eBay et Vestiaire dans les MÊMES onglets que
Vinted, séparés par le logo » ; « le cross-post beaucoup plus accompagné, pro, pointilleux et
fiable » ; « Achats : relier un achat à une annonce ou une vente en sélectionnant par prix, par
date de reçu… » ; « le bot eBay, arrête-le »).

## Ce qui est fait

### 1. Un sélecteur à logos, partout (`src/SelecteurSites.jsx`, règles `src/plateformes.js`)
- **Une seule forme** pour choisir un site : Annonces, Ventes, Achats, Messages (`FiltreSites`)
  et les DEUX rangées de Colis (colonnes, et Colis · Leboncoin). Plus aucune rangée de sites écrite
  à la main dans `App.jsx` (`audit-plateformes-logo` D1).
- **Un logo par site**, servi localement (`public/brands/`), dessiné en **masque CSS** : il prend la
  couleur du texte (encre ; blanc sur le segment choisi en sombre) — aucune couleur de marque (§7).
  Vestiaire n'avait pas de logo libre : un monogramme « VC » dessiné pour VRM
  (`public/brands/vestiaire.svg`, noté dans `public/brands/README.md` — ce n'est PAS le logo officiel).
  « Tous » = quatre petits carrés.
- Au téléphone, une rangée de 4-5 segments : **le nom seulement sur le segment choisi** (le logo
  suffit aux autres ; le nom reste dans `aria-label`/`title`). Segments ≥ 44 px.
- **Les quatre sites, toujours** (« les mêmes onglets que Vinted ») : un site sans compte relevé
  reste dans le sélecteur, estompé (`data-sans-compte`). Choisi, son onglet dit **ce qui manque et
  le geste** (`OngletManque`, textes `ONGLET_SANS_DONNEE`) : Leboncoin/Vestiaire → « Ouvrir le site »,
  eBay → « Relier eBay » (le geste et l’attribut `data-vers-comptes-ebay` de l’écran eBay, qui mène à Paramètres → Comptes eBay ; banc `vendeur-neuf` le vérifie). Vaut pour Annonces, Ventes, Achats, Messages et Colis.
  ⚠️ `sitesPresents` (la coque) n'est PAS changé : le menu, la barre et « Tous les sites » gardent
  leur règle ; seul le sélecteur montre les quatre.
- Colis : la rangée de sites était **cachée au téléphone** par `design/fusion.css` (« ce que la
  maquette ne montre pas ») ; elle est visible désormais (`:not([data-selecteur-logos])`).
- « Tous les sites » (Ventes) : le logo du site sur chaque ligne (`LogoSite`).

### 2. Le compte sur chaque vente (`nomCompteVente`, `src/plateformes.js`)
- `LigneVenteCompacte` / `LigneVente` prennent `compte` : écrit dans la ligne repliée (après la
  date) et sur la carte Fusion (`data-fu-compte`, classe `vrm-sensible`), attribut `data-vente-compte`.
- **Par identité, jamais deviné** : Vinted = le compte qui a lu la vente (`accNameOf(o._acc)`,
  désormais **même avec un seul compte vendeur** — avant il n'était écrit qu'à partir de deux) ;
  Leboncoin = `account` de la transaction (« lbc-account:ID » = ID), nom lu dans `lbc_accounts`
  (hook `useAnnuaireLbc`, lu une fois) ; eBay = la référence de la ligne de commandes (`_compte`,
  absente = principal) → pseudo du registre ; Vestiaire = `compte` relevé par l'extension → son
  identifiant (« n° 7781234 » : Vestiaire ne donne pas de nom). Aucune identité ⇒ rien d'écrit.
- « Tous les sites » : Leboncoin et Vestiaire avaient `compte: ''` en dur ; eBay sans `_pseudo` n'avait rien.

### 3. « Publier ailleurs » — le parcours guidé (`src/publierAilleurs.js`, `src/PublierAilleurs.jsx`)
- Entrées : **la fiche d'un N°** (« Publier ailleurs », à côté de « Changer le prix ») et
  **Annonces · Leboncoin / eBay / Vestiaire** (« Publier une annonce Vinted sur … », en tête).
  Événement `vrm:publier-ailleurs` `{ num?, site? }`.
- Choisir l'article : la source partagée `useEbayPaires` (en ligne sur Vinted ou « toujours chez
  moi », §11). Un N° tapé désigne la paire **exacte** ; le titre ne sert qu'à chercher.
- Pour chaque site (Leboncoin, Vestiaire, eBay ; celui d'où il vient en premier), **quatre étapes
  visibles** : Vérifier · Ce qui part · Publier · Suivi.
  - **Vérifier** : `problemesAnnonce` (la vérification des moteurs) + ce qui bloque avant elle :
    pas de N°, aucune photo, **retiré de Leboncoin par son choix** (`mp.lbc === false`, jamais remis
    tout seul : le geste est dit). Un manque bloquant grise le bouton et arrête la frise à « Vérifier »
    (ambre : un geste à faire).
  - **Ce qui part** : construit par les règles des moteurs — titre `lbcTitre` (x/50), description
    `descriptionLbcDe` (avec « Réf. VRM-{n°} »), description eBay `descriptionEbayPropre`, photos
    (15 au plus pour Leboncoin, 24 pour eBay), prix, et **la référence qui porte le N°** (Leboncoin et
    Vestiaire : `VRM-{n°}` ; eBay : SKU `VRM-{n°}`) ⇒ le N° est identique sur toutes les annonces.
  - **Publier** : ouvre le **moteur existant** sur CET article, avec toutes ses gardes — la fiche
    Leboncoin (`DEMANDE_LBC_FICHE`), le formulaire eBay « Vendre une paire » (`DEMANDE_EBAY_PAIRE`),
    la ligne Vestiaire, ramenée et mise en évidence (`DEMANDE_VC_PAIRE`, nouveau ; route
    `vestiaire_annonces` ajoutée à `ONGLETS_DEPLACES`). **Le parcours n'envoie rien lui-même**
    (audit B18 : ni `vmrCmd`, ni appel eBay). L'agent eBay n'est pas réintroduit (B19).
  - **Suivi** : préparée (dépôt de l'extension < 30 min, brouillon eBay de la paire) · publiée
    (`job.etape === 'fait'`, « Déjà publiée » : `vinted_lbc_posted` / `vinted_vc_posted`) · **vue en
    ligne** (l'annonce du site porte CE N° : `sitesDuNumero`, la règle de « Changer le prix »).
    Liste du site pas lue ⇒ « En ligne ? pas su » (jamais « à publier » : il l'a peut-être publiée à la main).
  - En tête : « N°12 en ligne sur [Vinted] [Vestiaire] » — les sites où ce N° est vu.

### 4. Relier un achat : filtres (`src/suggestionsAchat.js`, `RelierAchatCorps`)
- « Voir tous les achats » → bouton **Filtres** : prix payé de/à (la règle `prixPayeAchat`), **reçu
  du/au** (la date de réception LUE : livraison lue ou « Je l'ai retiré », `dateReception`), marque,
  taille (lues du titre). Ce sont des filtres de la liste : c'est **toujours SON tap « Relier »** qui relie.
- « Pas su ≠ oui » : sous un filtre de date, un achat sans réception lue n'est pas gardé, il est
  **compté** (« N achats sans date de réception lue, pas dans cette liste »).
- `tousAchatsLibresDetail` (nouveau) ; `tousAchatsLibres` et `filtresAchats` gardent leur forme (+ `marques`, `tailles`).

## Preuves
- `npm run build` vert.
- `node scripts/audit-plateformes-logo.cjs` : **48/48** ; `--prouve` : **17/17 mutations** rougissent
  (logo manquant, « Tous » partout, compte deviné, préfixe Leboncoin, vue en ligne sans identité, pas su
  → à publier, manque bloquant ignoré, pas de N°, référence sans N°, titre avant N°, réception pas lue
  gardée, prix ignoré, taille ignorée, rangée écrite à la main, compte Leboncoin/Vestiaire oublié, le
  parcours qui enverrait). Sur le code d'avant (`85dad5b0`) : rouge (les modules n'existent pas).
- Audits voisins verts : `audit-suggestions-achat`, `audit-verif-annonce`, `audit-coherence`,
  `audit-icones`, `audit-fonctions-api` (aucune fonction `api/` ajoutée), `audit-annonces-outils`,
  `audit-comptes-exclus`, `audit-colis-trois`, `audit-recherche-unique`. `fusion-echelle --verifier` :
  les mêmes 4 fichiers hors échelle que sur `main` (aucun ajouté).
- Banc `scripts/bancs/plateformes-logo.cjs` (données inventées, `BANC_PORT=7967`, 390 tactile et
  1512, clair et sombre) : **182 verts, 0 rouge** ; le même banc sur le code d'avant (`85dad5b0`,
  construit à part, `git archive`) : **72 rouges** (pas de logos, pas de compte sur les ventes,
  sélecteur de Colis invisible au téléphone, pas de parcours, pas d'onglet « ce qui manque »).
- Bancs voisins : `navigation-tache` — 2 rouges « K. Colis : porte vers un détail », **les mêmes
  sur le code d'avant** (qui en avait 4 : « colis leboncoin » ne se cliquait pas, réparé par le
  sélecteur commun) ; `vendeur-neuf` — les 2 rouges « base injoignable », **les mêmes sur le code
  d'avant** ; le rouge eBay qu'avait ajouté la première version (« Relier eBay ») est réparé :
  l'onglet sans compte eBay reprend le geste de l'écran eBay.
- Captures regardées (390 clair/sombre, 1512 clair/sombre) : Ventes · Tous (logos, compte en tête
  de la ligne), Ventes · Vinted (« 4 nov. · compte_a »), Colis (sélecteur visible), « Publier
  ailleurs » N°12 (frise, ce qui part, VRM-12), N°13 (Vestiaire « Vue en ligne », frise cochée),
  N°14 (« Aucune photo » en ambre, bouton grisé), Annonces · Vestiaire (ligne N°12 cerclée),
  Achats · eBay sans compte. Le logo eBay (un mot dans un carré) a été agrandi après la première
  capture, et le compte remonté avant la date dans « Tous les sites » (coupé à 390 px sinon).
- `navigation-tache.cjs` : seul son commentaire d'en-tête change (« un site sans compte n'y est
  pas » ⇒ les quatre sites, sa décision du 5 nov.) ; aucun de ses contrôles ne l'exigeait.

## Ce qui reste / à faire côté extension (pas touchée : une autre session y travaille)
- **Vestiaire : le nom du compte.** L'extension relève l'identifiant (`compte` des ventes,
  `vc_session.comptes`) mais aucun nom : VRM écrit « n° {id} ». À ajouter dans l'extension :
  `noterSessionVc` (capacité `vcsession`, 5.295) range déjà `/users/me` quand Vestiaire le charge ;
  y garder aussi le pseudo (`firstname`/`pseudo` de la réponse `/users/me`, forme à observer) dans
  `vc_session.noms[id]`, et une capacité `EXT_CAPACITES.vcnoms` à la version qui le fait. Côté app,
  `nomCompteVente('vestiaire', v, { vestiaire: noms })` le lira sans autre changement.
- **eBay : « préparée »** se lit sur `ebay_brouillons` (pairId) ; une annonce mise en ligne par le
  formulaire est « vue en ligne » quand `ebay_listings` porte le SKU `VRM-{n°}` (relecture de l'app).
- **Leboncoin « publiée → vue en ligne »** attend la prochaine lecture complète de « Mes annonces »
  (l'extension) ; la feuille le dit.
- Pas fait ici (autres lots du 5 nov.) : codes de retrait Leboncoin/eBay/Vestiaire dans Colis
  (§4), photo eBay depuis la galerie (§6), retrait de l'agent eBay (autre lot).
- Geste de Julien : ouvrir Ventes (le compte sur chaque ligne), puis une fiche N° → « Publier ailleurs ».
