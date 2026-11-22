# 22 nov. 2026 — Intégration finale avant la mise en ligne (app + extension 5.434.0)

Branche `claude/integration-finale`, partie de `claude/integration-21nov` (4bfc89921). **Pas de PR, pas de fusion sur
`main`** (le coordinateur la fera). UNE version d'extension : **5.434.0** (les capacités gardent leur version d'arrivée).

## 1. Les fusions (vrais merges `--no-ff`, un commit chacune, dans cet ordre)

| commit | branche | ce qui entre |
|---|---|---|
| 2b9fff69d | personnel-compta | compte personnel hors totaux côté serveur ; **Comptabilite sort d'App.jsx** (`src/ecrans/Comptabilite.jsx`) ; défaut « Argent bloqué » corrigé |
| c21b0a0e6 | style-vintex | 2ᵉ jet du style (accent sapin, plus de bleu ni de capitales) |
| 8d730ed69 | ux-reglages | Paramètres, E-mails, écrans vides, « Nouveau », « Bien démarrer » |
| 03f665e16 | relier-code | Relier plus facile, code de retrait en billet |
| ac821ef9e | fiche-sites | fiche « Sur les sites », relier en série depuis Achats |
| d7d8c4bd7 | transp-depenses | transporteurs sur tous les sites, « + Dépense » |
| b9e1ae005 | rentabilite | coût réel par vente, colonne Net, forfait d'emballage |
| c0c4552f6 | prio-recherche | paires à republier en priorité, recherche |
| 4884c6d16 | retours-suivi | suivi du colis retour d'une vente (ext. 5.431 ; contient ext-5420) |
| 722018537 | ext-5433 | une seule file d'actions (contient ext-5421, ext-5422, ext-5423 et leur arbitrage) |
| bfe006964 | ext-visuel | 5.427, la couche de style du panneau |
| 503a8d38f | ext-5432 | le prix partout, la garde du prix |
| d2c87ff1b | ext-5429 | brouillons préparés, photos dans l'ordre, boost rentable, republier à la main |
| 8ed241663 | ext-5424 | « Publier aussi sur… » Leboncoin et Vestiaire |
| e90fb56f8 (+1df0cb4fa) | ext-5425 | relances acheteurs, tri des conversations |
| 828e4d91e | ext-5426 | une paire vendue retirée partout |
| 6d64bca18 | ext-5428 | courbe de chaque annonce, « En direct », « Vinted a masqué » |
| 497e5fcb6 | ext-5430 | traduction sur l'appareil, note des acheteurs |
| 35320fd39 | relier-retires | relier seulement ce qui est chez lui, colis non retirés, remboursé hors dépenses (fusionnée à la fin, sur demande) |

`ext-5420`, `ext-5421`, `ext-5422`, `ext-5423` n'ont pas de commit de fusion à elles : elles étaient déjà entières dans
`retours-suivi` (5420) et `ext-5433` (5421-5423, avec l'arbitrage atelier 5.422 ⇄ 5.423 écrit dans son récit). Vérifié :
toutes les branches citées sont ancêtres de la tête (`git merge-base --is-ancestor`).

### La méthode pour App.jsx (le point dur)
personnel-compta a sorti `Comptabilite` d'App.jsx (25 300 lignes). Toutes les autres branches modifiaient encore App.jsx
dans la zone de Comptabilite. Pour chaque fusion : App.jsx et Comptabilite.jsx repris de la tête, puis les retouches
d'App.jsx de la branche rejouées **commit par commit** (hors fusions) avec `patch -F1` : ce qui s'applique dans App.jsx y
reste, ce qui est refusé est rejoué dans Comptabilite.jsx, le reste à la main. Contrôle après chaque fusion : chaque ligne
AJOUTÉE par la branche est retrouvée dans App.jsx ∪ Comptabilite.jsx (les écarts restants lus un par un), `audit-variables`,
`audit-tdz`, chemins relatifs du module (`../`), `node --check` de chaque fichier de l'extension, `npm run build`.
Un premier passage à `-F3` avait posé deux morceaux AU MAUVAIS ENDROIT (FeuilleNouveauApp dans Comptabilite,
`achatsVidePur` dans la liste d'exports d'App.jsx) : vus, remis à leur place, puis tout le reste à `-F1`.

### Conflits tranchés (au-delà des unions EXT_CAPACITES / FONCTIONS / nouveautes / i18n / §8)
- **background.js `gesteLbcInterface`** : entrée dans la file (5.433) PUIS garde du prix (5.432) — l'inverse aurait perdu
  le billet au retour par la file (la garde retire `ordre.garde`).
- **« Publier aussi sur… » (5.424) écrivait HORS de la file 5.433** : chaque dépôt `publierUnAussi` passe maintenant par
  `dansFile` (background.js, `deroulerAussi`) — « aucune écriture hors file ».
- **Deux `relancesCarte`** (5.421 relance des offres, 5.425 relances acheteurs) : l'extension ne se chargeait plus
  (« already been declared ») ⇒ la 5.425 devient `relancesAcheteursCarte` (fond, FONCTIONS, audit-relances, §8).
- **vrm-badge.js** : atelier = avant/après (5.423) + « Programmer à… » (5.422) + republier direct (5.429) + file (5.433) +
  `lignesPrix6` de la 5.432 (prix partout, garde) ; menu : `republier_direct` + `aussi` (5.424 remplace l'ancien
  « Publier sur… ») ; Accueil : publier aussi + « Vinted a masqué » + file ; automatisations : réponses, retirer, le reste.
  Trois fois une accolade manquait entre deux blocs ajoutés au même endroit (vrm-badge ×2, tableau.css) : remises.
- **vrm-ui.js** : dictionnaires réunis ; `VRM_UI` exporte MODIF (5.423) et noteAcheteur/nomLangue/traduction (5.430).
- **Page Extension** : « En direct » de la 5.428 (avec « Tout arrêter ») puis la file de la 5.433 renommée `FileEnDirect`,
  sans second « Tout arrêter ».
- **Fiche** : section « Sur les sites » (fiche-sites) + état « publiée par VRM » (5.424, reconnu par `src/ficheSites.js`)
  + bloc des retraits (5.426) ; FichePaire : paramètres des deux côtés.
- **Statistiques · Transporteurs** : filtre Site (transp-depenses) + « Colis non retirés » (relier-retires).
- `prendreVue` ramenée dans App.jsx (Annonces la lit aussi) ; `NET_VENTES` déclaré UNE fois dans App.jsx.

## 2. Bugs trouvés et corrigés (relecture du diff et contrôles)

| où | défaut | correction |
|---|---|---|
| `api/_lib/push-capte.js:163,173` | vente Leboncoin / Vestiaire relue par `data->ventes->123` : une clé numérique NUE est un INDICE pour PostgREST ⇒ la notification « Vente » ne trouvait jamais la vente | clé entre guillemets (`->%22id%22`) ; banc de l'audit à la vraie forme |
| `vinted-sync-extension/background.js` (5.425 × 5.421) | deux `async function relancesCarte` ⇒ le service worker ne démarre pas | `relancesAcheteursCarte` |
| background.js `deroulerAussi` | dépôts « Publier aussi » hors de la file | `dansFile` |
| `src/ecrans/Comptabilite.jsx:815` | `import('./studioPhoto.js')` (chemin vu d'App.jsx) dans le module découpé | `../studioPhoto.js` |
| `src/natif/tableau.css`, `vrm-badge.js` | accolades perdues à la fusion (build cassé / bloc ouvert) | refermées |
| `index.html`, `public/demarrage-theme.js`, `public/manifest.webmanifest` | l'écran de démarrage et la barre du navigateur au gris d'AVANT (#F2F2F7 / #000) : un éclair de fond différent à chaque ouverture | #F1F3F6 / #0F0F11 (jetons du 2ᵉ jet) |
| `src/natif/retraits.css:181`, `src/styles-cout-vente.css`, `src/styles-traduire.css` | bleu vif revenu (relier-code, rentabilite, 5.430) | gris neutre / sapin |
| `src/natif/courbe-annonce.css` | titre en capitales (5.428) | minuscules |
| `src/i18n/langues/*/vestiaireMessages.js` | « Compte ouvert dans ce Chrome » | « ce navigateur » (5 langues) |
| `vinted-sync-extension/vrm-ui.js` | « À confirmer » (état d'annonce, décision du 20 nov.) ; « confirm the figure » | « Pas revue » ; « check the figure » |
| nouveautés, CSS, commentaires de l'extension | « Vintex » nommé (texte livré) | `style-sobre`, `argent-rangees`, `src/natif/echelle-dense.css` |
| background.js (3 lectures `harvest_*_txn_*` / `email_bord_*`) | lues sans pagination | `sbGetTout` |
| `src/natif/natif.css` | au doigt, le champ « sur place » de la fiche à 14 px (2ᵉ jet) : Safari iOS zoome | ≥ 16 px sous `pointer: coarse` |
| `src/natif/courbe-annonce.css` | notes et axes de la courbe en `--n-encre-3` (2,5:1) | `--n-encre-2` |
| `src/aujourdhui/StatsBranche.jsx` | `useMemo` dépendant d'un objet neuf à chaque rendu (recalcul permanent) | dépend de `pubR` |
| background.js (gardes recopiées) | `GARDES_APP` n'était plus la copie de l'app | `node scripts/recopier-gardes-extension.cjs` |

Relecture ciblée sans défaut trouvé : identité par titre (aucune nouvelle comparaison de titres), `select=data` lourd
(un seul nouveau, `vinted_suivi_{uid}`, ligne petite et bornée, lecture ratée ⇒ rien n'est écrit), prix qui contournerait
la garde (toutes les offres et prix passent `interfaceVinted` / `gesteLbcInterface` / `executerPourAppCoeur` avec billet ;
`audit-garde-prix` 55 verts), écrans joignables (`tab===` : 54 avant et après, `menu` en plus), rouge hors doublon, violet
(`audit-style-vintex`, `audit-rouge-doublon` verts), helpers hors portée (analyse de portée Babel de chaque fichier de
l'extension : aucun identifiant sans déclaration hors du code injecté gardé par `typeof`), TDZ, variables fantômes.


## 2 bis. Annonces · « Vendue » et le filtre Site (retour de Julien sur la production, 22 nov.)
« J'ai fait 3 ventes mais pas que sur Leboncoin : applique un filtre par plateforme, les filtres ne sont pas précis » — Statut
« Vendue · 3 » ne montrait que 3 annonces Leboncoin. **Cause** : une annonce Vinted vendue SORT du dressing et `lireAnnoncesEgalite`
ne lisait que le dressing (en ligne, à confirmer, masquées, brouillons) ; les retirées Vinted non plus ; et la rangée d'un compte
portait l'état de l'ARTICLE (vendu sur Vinted, en ligne sur Leboncoin ⇒ deux rangées « En ligne »).
- `src/articles/sources.js` **`annoncesVintedVendues`** : une annonce Vinted est « vendue » seulement par la PREUVE
  (`lirePreuvesVenteVinted().vendus`, `<preuve-vente-regle>`), reliée à SA vente par le n° de transaction → item_id
  (`fetchTxnItemIds`) — jamais le titre (deux ventes au même titre = deux annonces) ; datée de SA vente ; preuves pas lues ⇒ rien ;
  une vente d'un compte non lu n'entre pas. Les annonces fermées « vendue » encore dans le dressing servent leurs données
  (`vendusDressing`, App.jsx `fetchVintedListings`). Une annonce déjà montrée « retirée » et prouvée vendue devient « vendue ».
- `src/ecrans/AnnoncesEgalite.jsx` : second temps (preuves + transactions + ventes de la coque `ventesCoqueLues`), les retirées Vinted
  (fermées sans vente) montrées ; **filtre « Site »** nommé, juste après Statut, chaque site avec son nombre de RANGÉES.
- `src/natif/ecrans/AnnoncesTableau.jsx` : la rangée d'un compte porte l'état de SON annonce ⇒ le nombre de chaque statut = ses rangées
  (plusieurs statuts = union ; Site/Compte/Ancienneté/Liaison = intersection) ; colonne Date : la date de vente pour une vendue.
- `src/natif/ecrans/Annonces.jsx` : plus de note des limites des sites sous le tableau ; « Publier un article » n'est plus un plein
  bleu seul en bas : une touche (contour) de la barre d'outils.
- Preuves : `scripts/audit-annonces-vendues.cjs` (17 verts ; **rouge sur `origin/main`** ; une mutation — la preuve retirée — rougit) ;
  banc `scripts/bancs/annonces-vendues.cjs` (outils/annonces-vendues, base inventée Vinted 2 comptes + Leboncoin + eBay, 1512 et 1280,
  clair et sombre) **36 verts**, **rouge sur l'arbre de `origin/main`** ; captures regardées (`scratchpad/fin/shots-vendues/`).
- Extension : vrm-badge.js portait **deux `function relancesHtml`** (5.421 relance des offres, 5.425 relances acheteurs) : la seconde
  écrasait la première sans erreur ⇒ la liste « À relancer » de Commandes restait vide ⇒ `relancesAcheteursHtml` (banc relances-panneau
  vert). Contrôle ajouté : aucune autre fonction déclarée deux fois dans le même bloc (extension et app).

## 3. Contrôles

**Build** vert (57 s). **Démarrage** 1 486 Ko pour 2 008 permis (la marge de 15 octets de style-vintex n'existe plus :
Comptabilite part après la coque). CLAUDE.md : 58 344 octets.

Audits demandés, tous **verts** : coherence, traduction (45), identite, urssaf, quoi-de-neuf, tdz, variables,
fonctions-api, actions-gardees (13), discretion (82), tout-interface (9), garde-prix (55), style-vintex, couleur-panneau
(19), relier-retires (38), personnel-serveur (18), poids-demarrage, demarrage (30). `audit-parcours-production.mjs` :
8/9 groupes, **le même 8/9 sur `origin/main`** (déjà là). `audit-extension-zip` : voir §4.

Tous les audits (805) lancés sur la tête : 154 rouges au premier passage ⇒ **60 au dernier**, dont 25 déjà rouges sur
`origin/main`, 11 déjà rouges sur `claude/integration-21nov` (la base, avant ce train) et 24 rouges restants venus des
branches du 21 nov. (§5). Ce qui a fait tomber les 94 autres :
- la découpe de Comptabilite : près de 70 audits lisaient `src/App.jsx` seul ⇒ `require('./_source-app.cjs').brancher()` en
  tête (le mécanisme prévu) ; `_source-app.cjs` recolle désormais sans doublon les écrans chargés PAR Comptabilite et les
  `export function` des écrans sans balise ; plafonds par fichier : Comptabilite.jsx compte comme App.jsx ;
- les fixtures des offres automatiques n'avaient pas de prix d'annonce lu : la garde du prix (5.432) refuse alors toute
  acceptation seule (« pas su ≠ oui ») ⇒ le dressing lu ajouté aux fixtures (moteur-offres, note-acheteur…) ;
- des audits/bancs en retard d'une décision fusionnée (six catégories de dépenses, menu « Publier aussi », liste des
  automatisations avec « Retirer partout », clé composée `pa_c_` + champ, « relancer », poseur `poserGroupesDeuxFois`…).

**Bancs** (un à la fois, port libre, `timeout`, captures regardées) :

| vert | rouge déjà vu ailleurs / limite du banc | rouge restant (nouveau) |
|---|---|---|
| onglets-menu, grand-panneau (après mise à jour : « Retirer partout », « Publier aussi »), panneau-telephone, interface-vinted, repub-formulaire, favoris-envoi, agent-panneau, alerte-moderation, depot-vinted, ext-5428, fiche-preparee, fiche-sites, file-actions, journee-stats, lbc-interface, modif-avant-apres, note-traduction-panneau, panneau-5428, panneau-depot, prix-partout-garde, publier-aussi, publier-aussi-panneau, recherche-partout, relances-panneau (après le correctif `relancesHtml`), relier-facile, rentabilite, republier-priorite, retirer-partout-panneau, retours-vente-suivi, retrait-billet, transp-depenses, vacances-interface, commandes-selection, relier-retires, **annonces-vendues** (36), **iphone-rapide étape `argent`** sous `BANC_MAINTENANT=2026-11-23T00:01:00+01:00` : Argent atteint en 7,1 s, 12 PDF, 0 signal | extension-surfaces (K/C : déjà rouge sur l'arbre d'avant, récit ext-visuel) ; couches-chargement, centre-notifs, prix-sans-manuel, ux-reglages : **coupés à 600 s** sur la machine partagée (pas de verdict) ; cout-vente : un `waitFor` de 30 s dépassé sous charge | fiche-directe S5 (390 : toucher le prix n'ouvre plus « Prix partout » sur la fiche — 1 520 verts, la note de courbe et le champ à 16 px corrigés) ; ventes-relances à 390 (le groupe « À relancer » est rendu à 1512, pas à 390) ; ventes-retours (titres < 200 px avec Site + Achat à 1280) ; repub-programmee à relancer (son libellé suit maintenant l'atelier 5.423/5.433) |

Captures : `scratchpad/fin/bancs-head/shots/`, `scratchpad/fin/bancs-2/shots/`, `scratchpad/fin/captures-bancs-repo/` (panneau de
l'extension, 8 pages × 390/1280/1512 × clair/sombre), `scratchpad/fin/shots-vendues/` (Annonces · Vendue) — regardées : Aujourd'hui,
Argent, Menu (390), Accueil du panneau (1512), Annonces Vendue / menu Site (1512, 1280 sombre).

## 4. Extension 5.434.0
Version partout (`CODE_VERSION`, manifeste, `CAPTEUR_VERSION` de lbc-inject.js, relais Leboncoin, `EXT_ATTENDUE`,
`public/extension-version.json`). Zips régénérés UNE fois à la fin (`node scripts/zip-extension.cjs`) : `public/VRM-extension.zip` (un dossier `VRM-extension/`, manifeste 5.434.0), `public/VRM-Orion-dossier.zip` (un dossier
`VRM-Orion/`), `public/VRM-Orion.xpi` ; copies : `scratchpad/VRM-extension-5.434.0.zip`, `scratchpad/VRM-Orion-dossier-5.434.0.zip`.
`audit-extension-zip` et `audit-coherence` verts. (Un audit a régénéré les zips en cours de route ; ils ont été refaits UNE fois à la fin.)

## 5. Ce qui reste rouge (nouveau par rapport à `origin/main`)
60 audits rouges au dernier passage :
- **25 déjà rouges sur `origin/main`** : arrivee-sans-gel, boutons-natifs, charge-rappels, cle-verifier, colis-trois, confiance-publique,
  config-facture, copie-annonces, coque-parametres, extension-porte-app, familles-extension, fiabilite-auto, infos-vinted, lbc-en-ligne,
  offres-auto, parametres, plans-solo-pro, portee-modules, preuve-vente, relier-fiable, republier-question, robustesse-metier,
  stockage-sur, vendeur-generaliste, vocabulaire-article.
- **11 déjà rouges sur `claude/integration-21nov`** (la base, avant ce train) : bancs (`menu` jamais rendu par verif_visuel),
  donnees-ecrans, finir-compta, plateformes-logo, reprise-ecran, signalement (`menu` pas un écran permis), ventes-e2, gestes-fluides,
  ordre-messages, profil-oauth, safari.
- **24 venus des branches du 21 nov., NON corrigés** (diagnostic) :
  - la **garde du prix (5.432)** refuse toute écriture AUTOMATIQUE sans prix actuel LU ou à plus de 40 % sous lui : les fixtures de ces
    audits n'ont pas le dressing lu (déjà rouges sur `claude/ext-5432` lui-même) — offres-sures, securite-comptes, robustesse-extension,
    favori-offre-message, favoris-vintex, favoris-offres-irreprochable, carte-extension, republier (plancher), recreer, ebay-route
    (409 garde-prix). Le comportement est voulu (pas su ≠ oui) ; c'est le dressing des fixtures qu'il faut ajouter, comme fait pour
    moteur-offres et note-acheteur (verts) ;
  - **regex en retard d'un écran fusionné** (le code a changé de forme, rien de cassé vu à l'écran) : achats-relier, annuler-commandes,
    argent-parrainage (E5), atelier-arrivee (N1), atelier, aujourdhui (S6), completer (S4), import-autre-outil, ligne-glissable,
    publier-partout (G16), purge-bordereaux (C5), retirer-site, studio, pont-session (délai de 2 s dépassé sous charge).
À reprendre avant toute nouvelle fonction ; aucun n'a montré de défaut à l'écran dans les bancs.

## 5 bis. Dernière passe (22 nov., avant la mise en ligne)

### Les 24 rouges venus des branches du 21 nov.
| audit | verdict | ce qui a été fait |
|---|---|---|
| offres-sures, securite-comptes, robustesse-extension, favoris-offres-irreprochable | audit en retard | fixtures : la note de l'acheteur LUE (5.430 : sans elle, aucune acceptation auto — c'était la vraie cause) + le prix de l'annonce dans le dressing (garde du prix 5.432) ; le refus reste voulu |
| favori-offre-message, favoris-vintex | audit en retard | jeton de session complet dans le faux fond (le plancher se lit en base) + ligne `main` |
| carte-extension | audit en retard | la session du faux fond porte le bon `user_id` (sinon `sbGet` rend null ⇒ plancher pas lu) |
| republier, recreer, ebay-route | audit en retard | une forte baisse ATTEND sans `gardeConfirmeC`, passe avec — les deux cas jugés |
| achats-relier, annuler-commandes, ligne-glissable, import-autre-outil, purge-bordereaux, atelier | audit en retard | lecture par `sourceApp`/`sourceAppCode` (Comptabilite découpée) ; un « image/* » dans un attribut faisait avaler du code au retrait des commentaires |
| argent-parrainage, atelier-arrivee, aujourdhui, completer, publier-partout | audit en retard | motifs portés sur la forme fusionnée (poseurs, `gardeConfirme`, `emballageForfait`) |
| retirer-site | audit en retard | texte recollé en français ; commentaires retirés ligne par ligne |
| studio | audit en retard | la cascade jugée sur les imports d'App.jsx SEULS (octets), sans les lignes « gardé à sa place » ; mutations S1/S2 sur la palette sapin |
| **pont-session** | **régression corrigée** | `etatPourApp` attendait À LA SUITE ici / santé / file / en direct (900 + 1 200 + 600 + 500 ms) : réseau muet ⇒ plus de 2,5 s, l'app abandonnait. Les quatre partent ensemble (bornes 900/250/250/250), la santé se range en fond (`_santeMemo`) |
Chaque audit porté : sa mutation rougit (`--prouve`/`MUTATION`), le comportement n'a pas été affaibli.

### Les bancs
- **ventes-relances 390** : régression corrigée — au téléphone « À relancer » vivait dans la feuille de la ligne d'accès, qui ne
  s'ouvre que s'il y a « À régler » ou des retours : ni rendu ni lu (14 rouges). Rendu à part sous la ligne d'accès (`relances`). 32/0.
- **ventes-retours 1280** : régression corrigée — avec Site ET Achat, « Date limite · N avant demain » poussait le tableau de 24 px
  (le « ⋯ » coupé) ; l'en-tête passe sur deux lignes. 102/0.
- **fiche-directe S5** : banc en retard — depuis le 20 nov. le champ de « Prix partout » n'existe que pour eBay (les autres sites :
  le panneau). S5 juge « un toucher ouvre Prix partout de CE N° (et, avec eBay, son champ prêt) ». 738/0.
- **cout-vente** : banc en retard, surface RETIRÉE — il juge le récapitulatif du registre d'avant (`.vrm-sale-row`,
  `.vrm-ledger-sale-toggle`) que « VRM natif » ne rend plus (Terminées = rangées « comme Vintex », le coût dans la fiche,
  `BeneficeArticleDetail`). Non porté (ce serait un autre banc) ; la règle est tenue par audit-rentabilite (30/0) et argent-plus (78/0).
- **repub-programmee** : 52/0.

### La chasse aux bugs (docs/passation/2026-11-22-chasse-bugs.md)
| # | correctif | preuve rouge avant / vert après |
|---|---|---|
| P1-1 | la fiche retient d'où elle vient (`ficheDeLoupe`) : Retour, Échap, geste ne rouvrent la loupe que pour une fiche ouverte DEPUIS la loupe | chasse-retour-loupe : avant « loupe = 365 » après Échap et sur Argent ; après « » |
| P1-2 | `<FermeAuRetour>` sur la fiche d'un N° et sur la fiche d'une ligne (achat, vente) | chasse-22nov 390 : Ventes « la fiche reste ouverte » avant, plus après ; le reste sur Achats est un faux positif du banc (la feuille « Achats » du menu est TOUJOURS montée, cachée par son hôte `hidden`) |
| P1-3 | `PhotoVinted` : le cadre d'attente garde `className`, `data-*` et `width`/`height` | captures tel-journee-bas : avant la vignette prend la moitié de la rangée (« Nike samba… »), après 56 px |
| P1-4 | `vinted_urssaf_mois.aDater.parMois` ; chaque mois passé dit « au moins N € · N à dater », « — · N à dater » à 0 € (jamais « au moins 0 € ») | banc **argent-mois-adater** (390 et 1512) : 4 rouges sur le build d'avant, 12 verts après |
| P1-5 | `liveStatsVus` calcule les ventes LUES même sans résumé des annonces (`liveStats` absent) | pas reproduit au banc (base inventée : le résumé se pose) ; la cause est le `return liveStats` (null) quand seules les ventes sont lues |
| P2-1 | `badgesNav` : Ventes = à envoyer, Achats = à retirer (plus de « + À régler ») ; la barre du bas l'était déjà | — |
| P2-2 | `compteAImprimer` : la sélection de Ventes (`pub.lot`, sinon `cochesParDefaut`) | audit-colis-prochain (+2 cas : 35 « pas imprimés » ⇒ 14 du lot) |
| P2-3 | la phrase des photos Vinted seulement sur Aujourd'hui et la page Extension | — |
| P2-4 | **la vraie cause** : `installerLectureBornee` posé APRÈS le partage ajoutait un `signal` à chaque lecture ⇒ aucune lecture partagée depuis le 21 nov. Posé dessous ; `lbc_ventes` projetée partout (`ventes:data->ventes`, §4.4) | banc de lectures (Ma journée, 14 s) : avant `lbc_ventes` ×13, `ebay_listings` ×14, `vc_listings` ×12, 0 partagée ; après 76 partagées, plus aucune au-delà de 3 ; audit-lecture-bornee (+ordre, + partage EXÉCUTÉ, `MUTATION_ORDRE=1` rouge) |
| P2-5 | `src/attenteBornee.js` (8 s) : En direct, boosts du mois, dates de mise en ligne, « Je lis tes colis… » finissent en « pas su » | sonde 6/12/20/30 s sous processeur ×4 + 4G : plus aucune attente ; les « encore là après 12 s » du banc chasse sont lus dès la fin des squelettes (pas après 12 s) |

## 6. Gestes de Julien (rassemblés)
1. **Installer l'extension 5.434.0** dans CHAQUE Chrome (remplacer le dossier, puis ⟳) ; Orion : `VRM-Orion-dossier.zip`.
2. Sur leboncoin.fr ET vestiairecollective.com, dans ce Chrome, connecté sur le compte où publier (un seul par site) :
   essayer « Publier aussi sur… » sur une annonce Vinted (relire la feuille, « Publier sur 2 sites » → confirmer).
3. Sur leboncoin.fr : mettre UNE annonce en pause à la main puis la réactiver (VRM apprend les deux gestes) ; Panneau →
   Automatisations → « Retirer partout quand c'est vendu » : allumer Leboncoin (« Oui, allumer »).
4. Mettre UNE fois un compte en vacances à la main sur vinted.fr (VRM retient la page).
5. Paramètres du panneau → « Garde du prix » : laisser 40 % ou régler. ⚠️ Une offre ≥ prix mini mais à plus de 40 % sous
   le prix de l'annonce n'est plus acceptée SEULE (moteur, Agent) : notifiée « Offre bloquée ».
6. Essayer : Articles → cocher → « Changer le prix » → avant/après → « Lancer » ; un atelier « Programmer à… » ;
   « Republier maintenant » sur une annonce ; Plus → File d'actions (« Pause après celle-ci »).
7. Commandes → « À relancer » ; Commandes → cocher → « Imprimer N bordereaux » (un seul PDF).
8. Garder un onglet leboncoin.fr ouvert sur le bon compte ; Vestiaire : retirer à la main ce que VRM nomme.
9. Rien à régler pour : courbes, « En direct », suivi des retours, note des acheteurs, traduction (Chrome récent),
   « Colis non retirés », remboursés hors dépenses.
Les gestes d'avant (facture Pro, Stripe, Supabase, éditeur, Gmail, Worker…) restent ceux de CLAUDE.md §9.
