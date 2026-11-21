# 12 nov. — Finitions : chaque écran passé comme un vendeur (2 passes) et « À retirer » rendu simple

## La règle d'« À retirer » (Julien : « fais quelque chose de simple et de parfait »)

Propriétaire unique (données + affichage) : cette branche, depuis la fin de `claude/agent2-restes` (fusionnée,
5a1f635f5).

1. **Un colis = un n° de suivi** (son identité). Tout ce qui porte ce n° (e-mail transporteur, e-mail Vinted, SMS,
   suivi lu chez le transporteur, et bientôt le panneau Détails Vinted lu par l'extension 5.372) se fond en UNE
   ligne. Un achat Vinted sans n° reste une ligne à part jusqu'à ce que son n° soit connu — jamais relié par
   ressemblance (§5 : au même point qu'un colis du transporteur, il est « peut-être le même », gardé à part, jamais
   compté deux fois).
2. **Le point** = celui écrit dans la source la plus récente (changement de point compris). Groupe = point.
3. **Le code et le QR** = ceux de la source. Arrivé sans code : la ligne dit où il est — « Code sur Vinted » (le
   dépli : « sur Vinted — l'extension le lira à ta prochaine visite ») ou « Code pas encore reçu » (le dépli :
   « dans l'e-mail de {transporteur} — pas encore reçu »). Un QR qui ne charge pas : « QR pas chargé — Réessayer »,
   jamais un rond vide (copie locale gardée dès qu'il a été lu).
4. **L'état** = arrivé / en route / retiré ; la source la plus fraîche gagne, le transporteur tranche ; « changé de
   plan » vérifié chez lui ⇒ « Vérification en cours », neutre.
5. **Une seule forme de ligne** : vignette (photo de l'article relié, sinon le logo du transporteur) avec le logo
   TOUJOURS au coin ; 1 · nom de l'article relié ou « Colis {transporteur} » (« Colis Chronopost Pickup », jamais un
   n° de suivi) ; 2 · le code en gros ou où il est ; 3 · le n° de suivi (ou le nom du transporteur sous un article) ;
   4 · la barre du délai toujours (« encore N j », « · estimée », « Date limite inconnue »). En-tête du point :
   « N colis · K codes à venir » dès K > 0. Le dépli est une fiche étiquetée (Arrivé · À retirer avant · Code ·
   Compte · Vérifié) et des gestes d'une seule forme (44 px). Aucune couleur si rien à faire. Chronopost Pickup sur
   le jaune Pickup (le cube noir sur blanc était pris pour un logo générique). UN logo par vignette (badge sur une
   photo, sinon la vignette est le logo) ; le QR = une petite icône à côté du code. Fiche : rien de technique
   (« pas encore lu — VRM le lit… » retiré), « Vérifié · e-mail, hier 11:19 », gestes « Copier le code » · « QR en
   grand » · « Suivre » (le code n'est pas redit, plus d'« En grand » en double). Le nom des enseignes connues
   s'écrit à leur orthographe officielle (Intermarché, E.Leclerc, Super U… — tableau fixe dans src/CarteRelais.jsx).

Bancs : `retirer-scene-julien.cjs` (la scène de production rejouée sur une base synthétique de même forme : Super U
Accueil, Intermarché « changé de plan », « Où vous livrer… », Maison de la Presse, un retiré), `retirer-ligne-unique.cjs`,
`colis-retirer-propre.cjs`, `retirer-carte-delai.cjs` (remis à la nouvelle règle sans être affaiblis).

Branche `claude/agent2-finitions` (partie de `origin/main` + `claude/integration-11nov-g2`, puis
`origin/main` refusionné : `main` contenait déjà g2). Aucune écriture en base, aucune donnée réelle.

## Comment

- **Tous les écrans montés** (63 chemins : les 4 tâches, Ma journée, Stock, E-mails, Argent ×4,
  Communauté, Litiges, Ma semaine, Prix qui marche, Organisation, Masqués, Comptes liés, Catalogue,
  Stock Vinted, ancien écran Ventes, les sections plateformes, les 21 panneaux de Réglages
  ouverts par `reglage=`, et les feuilles Tout imprimer, Mon profil, Mon compte, Notifications,
  Appareils, Tout va bien ?, Ma facture), en **390 tactile et 1512, clair et sombre** :
  ≈ 450 captures, sur la base INVENTÉE de `revue-design-captures.cjs` (`_base-volume.cjs`, 3 comptes),
  chacune REGARDÉE. Un relevé automatique par écran en plus (débordement hors d'un conteneur qui
  défile, cibles < 44 px, « n/d », « NaN », « undefined », « 0,00 € », « encaiss… », texte rouge,
  erreurs JS) : **0 erreur JS, 0 débordement, 0 texte interdit** ; les cibles < 44 px trouvées sont
  des liens dans une phrase (« Ventes », « Voir les instructions Orion ») et les cases à cocher de
  Republier (la rangée entière se touche).
- **Les 535 `scripts/audit-*.cjs`**, un par un : **tous verts** sur la branche (aucun rouge propre
  à la branche, aucun rouge hérité de `main`). Après la fusion finale : variables, tdz, coherence,
  identite, icones, onglets-d, chiffres verts ; `npm run build` vert.

## Ce qui a été trouvé

| défaut | écran | état |
|---|---|---|
| « Aucune facture en attente » et « + Nouvelle facture » centrés dans un tableau de 700 px : coupés au bord sur téléphone | Argent → Factures (vide) | **corrigé** (le vide se dit hors du tableau) |
| colonne « N° Article » en ambre (couleur du geste à faire, §7) | Argent → Factures | **corrigé** (gris / encre) |
| « Chercher » coupé en deux lignes « Cherc / her » | Catalogue (et la même barre d'Invoices / Ventes ancien écran) | **corrigé** |
| contenu collé aux bords (titre à 0 px, « Ajouter » coupé à droite) | Stock Vinted | **corrigé** (marge 16 px, champ qui rétrécit) |
| « Aucune vente » centré dans un tableau large, coupé | Ventes (ancien écran `sales`) | **corrigé** (à gauche) |
| « À expédier » collé au bord gauche puis « Colis Leboncoin » en grand juste dessous (deux titres) | Ventes · Leboncoin | **corrigé** |
| « Ouvrir mes annonces » (bouton bordé, marge négative) posé SUR la phrase « Pas encore lu… » | Réglages → Numéros de rangement | **corrigé** (sur sa ligne, 44 px) |
| « 15 à imprimer » sous « Tout imprimer (15) » : le même nombre deux fois (§7) | Ventes · À expédier | **corrigé** (la case ne paraît que si elle dit autre chose que le bouton ; banc `chiffres-coherents` lit le bouton quand la case se tait) |
| un lien « Favoris » (`?tab=favoris`, `vue=favoris`, `vrm:aller`) ouvrait Messages sur « Conversations » : le fil « Tous », monté le premier, consommait la demande | Messages | **corrigé** (comme `offresauto`) |
| le « … » d'une carte (Colis fait, marquer imprimé, suivre) passe SOUS le bouton « Imprimer » / « Générer le bordereau sur Vinted » : deux points visibles sur « Imprimer », le menu ne se touche plus (1512 : tous les colis ; 390 : ceux à générer). Le bouton du bordereau est devenu un bouton à libellé (lot ventes-achats-visuel) alors que « … » est placé pour un rond de 44 px, dans un autre conteneur | Ventes · À expédier | **à décider / zone Colis** — non corrigé : la place du « … » dépend de la largeur du bouton voisin (103 px, 183 px…), il faut les mettre dans le même conteneur (DOM de la carte), pas un `right:` de plus |
| sur le segment eBay (aucun compte eBay) : « 15 à imprimer », « À envoyer · 30 », « 69 bordereaux déjà traités… dès que Vinted confirme » alors que « Tout imprimer » n'a rien et « Envoyés · 0 » | Ventes · eBay | **à décider / zone Colis** : les cases de la section ne suivent pas toutes le filtre de site |
| « Tout imprimer (15) » ouvre une feuille « Ce qui part · 6 » / « Imprimer (6) » | Ventes → Tout imprimer | **à vérifier** (peut-être un lot par transporteur ; la feuille ne le dit pas) |
| « Affiché avec · Tri : Republier · Effacer » s'affiche quand on vient de toucher « Republier » dans le menu ; « Republier » est un filtre, nommé « Tri » | Annonces · Republier | **à décider** (le bandeau de reprise dit un choix qu'on vient de faire) |
| « Prix d'achat 0/36 connus : bénéfice minimum. » — avec 0 prix connu le bénéfice n'est pas un minimum, il est inconnu | Annonces | **à décider** (phrase de `src/prochainGesteAnnonces.js`, lue par `audit-onglets-d`) |
| « Récap JSON », « e-reporting », « Super PDP » : mots techniques hors du panneau Sécurité | Argent → Factures → Facturation électronique | **à décider** (vocabulaire réglementaire de la facture électronique) |
| ambre d'ancien code sur des textes d'information (« 📋 Affichage complet », « 🔍 Recherche active », colonnes « × ») | Catalogue, Ventes ancien écran, Factures | **à décider** (écrans hérités ; seule la colonne N° des factures a été rendue neutre) |
| la carte « Pas encore lu : ouvre « Mes transactions »… » n'a presque pas de marge intérieure, et la même consigne est redite par la carte « Tes ventes Leboncoin ne sont pas encore lues » juste dessous | Ventes · Leboncoin | **à décider** (le banc `navigation-tache` L exige `[data-lbc-colis-vide]` dans la section : « rien lu ≠ rien ») |
| « Plus » au téléphone ne montre que 5 entrées (Messages, Stock, E-mails, Argent, Communauté) ; le banc `navigation-fusion` C en attend ≥ 8 (390 sombre seulement) | menu « Plus » | **à décider** : banc périmé ou entrée perdue — rouge aussi sans mes corrections |

## Preuves

- `scripts/bancs/finitions-12nov.cjs` (nouveau, base inventée, 390 tactile / 1512, clair / sombre,
  jugé sur les boîtes rendues) : **22 rouges** sur le build d'avant (A Catalogue 2, B Stock Vinted 4,
  C Factures 2, D Ventes 2, E Leboncoin 4, F Numéros 4, G « à imprimer » 4), **0 après** (56 verts).
  Chaque contrôle ne dépend que de sa correction : le build d'avant est la mutation de chacune.
- `scripts/bancs/navigation-fusion.cjs` partie L : **10 rouges** avant (les 5 chemins vers Favoris,
  390 sombre et 1512), **0 après** ; reste le rouge C ci-dessus, déjà là avant.
- `scripts/bancs/chiffres-coherents.cjs` : 26 verts, 0 rouge (base où la case « à imprimer » 2 ≠ le
  bouton 4 : elle reste dite).
- Captures regardées avant/après (Factures, Catalogue, Stock Vinted, Numéros, Leboncoin, À expédier),
  clair et sombre, puis supprimées (disque).

## Fichiers

`src/ecrans/Compta.jsx` (Factures vides, colonne N°, « Chercher », « Aucune vente »),
`src/ecrans/Stock.jsx` (Stock Vinted), `src/ecrans/Leboncoin.jsx` + `src/App.jsx` (section Leboncoin,
« à imprimer », Favoris), `src/ecrans/Reglages.jsx` (Numéros), `scripts/bancs/finitions-12nov.cjs`,
`scripts/bancs/chiffres-coherents.cjs`, `scripts/bancs/README.md`.
Rien touché dans `vinted-sync-extension/`, `api/_lib/retrait-colis.js`, `api/_lib/sms-*.js`, ni les
bancs baisse-prix / republier / abonnement-propre / colis-envoi.

Geste de Julien : aucun.

## 2e passe (demande du coordinateur : les « à décider » relèvent des règles)

| défaut | écran | état |
|---|---|---|
| « Prix d'achat 0/36 connus : bénéfice minimum » | Annonces | **corrigé** : « Bénéfice — » sans aucun prix connu, « Bénéfice au moins » avec la couverture sinon (`audit-onglets-d` D5, rouge sur l'avant) |
| information en ambre / rouge (affichage complet, recherche active, ×, âge, Vendu, bénéfice) | Catalogue, Ventes ancien, Factures | **corrigé** (`audit-couleurs-anciens-ecrans`, 5 rouges sur l'avant) |
| « Récap JSON », « e-reporting », « Factur-X » | Argent → Factures → Facturation électronique | **corrigé** en mots du quotidien, fichiers produits inchangés (banc finitions H) |
| « Affiché avec · Tri : Republier » juste après l'avoir choisi | Annonces | **corrigé** : « Republier » est un Filtre ; un choix fait à l'instant n'est pas redit (`audit-reprise-synchro`, 2 rouges sur l'avant ; banc finitions I) |
| « ouvre Mes transactions » deux fois | Ventes · Leboncoin | **corrigé** : une fois (`navigation-tache` L le juge) |
| `navigation-fusion` C (« Plus » à 5 entrées) | menu Plus | **banc périmé** : la liste voulue (GROUPES_PLUS) a 5 entrées depuis DJ6/DJ4/AL — aucune perdue ; le contrôle exige maintenant ces 5 entrées, une par une |
| « … » sous « Imprimer » / « Générer le bordereau » ; « Générer » coupé dans un rond (« rer le b ») ; « sur Vinted ↗ » hors de la carte | Ventes · À expédier | **corrigé** : « … » dans la rangée du bordereau (banc finitions J) |
| cases Vinted sur Ventes · eBay | Ventes · eBay | **corrigé** : « À envoyer · N » et « N à imprimer » du site choisi ; bordereaux des e-mails Vinted seulement sur Vinted |
| « Tout imprimer (15) » ⇒ « Imprimer (6) » | Ventes → Tout imprimer | **à vérifier** : la feuille travaille par transporteur ; pas modifié (même source `lignesLotTous`) |
| À retirer « rien n'est cohérent » | Achats · À retirer | **refait** (la règle ci-dessus) |
| `colis-qr` (16 rouges avant comme après) | Achats · À retirer | **remis à la règle du 11 nov.** (« un QR qu'on n'a pas ne se commente plus » : aucun QR montré ni commenté), le reste intact — 100/0 |

Preuves de la 2e passe : `retirer-scene-julien` 48/0, `retirer-ligne-unique` 88/0 (32 rouges sur l'avant),
`colis-retirer-propre` 132/0 (11 rouges sur l'avant), `retirer-carte-delai` 0 rouge (15 sur l'avant),
`finitions-12nov` A–J, `navigation-fusion` 45/0, `audit-onglets-d`, `audit-couleurs-anciens-ecrans`,
`audit-reprise-synchro`.
