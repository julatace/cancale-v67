# 16 nov. 2026 — Argent lisible et sans « mur » (lot `argent-mieux`)

Branche `claude/argent-mieux`. Julien (5 captures iPhone de l'écran Argent en ligne) : « Corrige et améliore ».
CLAUDE.md §5 « Les chiffres » est intouchable : seule la LECTURE change, aucune règle d'argent.

## ÉTAT À LA REPRISE

- Fait et poussé : voir « Ce qui a changé ». Banc `scripts/bancs/argent-mieux.cjs` vert (390 tactile et 1512, clair
  et sombre, Résumé · Déclarer · Factures, replis fermés puis ouverts) ; ROUGE sur l'arbre d'avant (46 ❌) et sur les
  deux mutations.
- PR et CI : voir la fin de ce récit (« Mise en ligne »).
- ~~Décision attendue de Julien~~ : **décidée le 16 nov. au soir et appliquée** (branche `claude/deux-prix-compter`,
  à fusionner APRÈS #1216) — voir « Décision de Julien : les deux prix COMPTÉS » à la fin.

## Le constat, reproduit sur une base inventée (avant)

Le banc pose un compte Vinted PRO dont 60 ventes versées le mois dernier ont « deux prix chez Vinted » (la liste ≠
l'article, aucun relevé), un compte particulier (30 versées le mois dernier, 8 ce mois-ci, 12 finalisées sans date de
versement), micro 13,4 %, rythme mensuel. Captures d'avant : les mêmes écrans que ses captures.

| mesure (Déclarer, 390, clair) | avant | après |
|---|---|---|
| hauteur de l'onglet Déclarer | 10 815 px | ≈ 8 650 px |
| mots | 2 263 | ≈ 1 280 |
| textes sous 4,5:1 (le pire) | 32 (1,04:1) | 0 |
| Résumé : textes sous 4,5:1 | 3 (1,04:1) | 0 |
| Factures : textes sous 4,5:1 | 1 (1,39:1, « Chercher » inactif) | 0 |
| « deux prix » : lignes à l'écran | 60 phrases dans UN paragraphe (Déclarer et Résumé) | 1 ligne groupée par endroit |
| « Copier » : forme visible (bord ou fond / ce qui l'entoure) | 1,29:1 (blanc sur blanc) | bouton plein (encre) |

(Chiffres exacts : la ligne `MESURES` du banc, relancé avant et après.)

Les trois causes du contraste (mesurées par la mesure de `scripts/bancs/verre.cjs`, réutilisée telle quelle) :
1. une CARTE posée dans un conteneur « sur le fond » (studio-verre §6 lui passe l'encre CLAIRE) sans être dans la
   liste des surfaces (§7) : « Déclarer octobre », « Mois bouclé », les tuiles de la Révision — blanc sur verre ;
2. la carte du mois (« Novembre, en cours ») et « Ton bénéfice » peintes en NUIT par un `::before`
   (`styles-widgets-ios.css`) alors que leur encre est celle du verre — bleu foncé sur nuit ;
3. des replis (Ta micro-entreprise, Tes déclarations URSSAF, DAC7, « Comment c'est calculé ») posés sur le bleu sans
   carte : encre sombre ou ambre sur le fond.

La cause du « mur » : chaque vente Pro mise à part portait ses DEUX PRIX dans sa raison
(« deux prix chez Vinted (47,61 € et 46,80 €) : ouvre ton porte-monnaie… »). Les ventes non comptées se groupent par
raison (`phraseNonComptees`, la ligne publiée `nonComptees.par`) : 60 ventes = 60 groupes = 60 phrases.

## Ce qui a changé

- `src/vintedPro.js` `prixVentePro` : la raison est UNE phrase par cas (`RAISON_DEUX_PRIX`,
  `RAISON_DEUX_PRIX_RELEVE`, `RAISON_PRO_PAS_LU`) + un `code` ; les prix vivent à côté (`listeC`, `artC`, `releveC`,
  centimes). `compter: false` inchangé : la vente reste hors du total, exactement comme avant.
- `ventesDeclarables` (App.jsx, recopié dans `api/_lib/ventes-regle.js` par `audit-bilan-semaine --recopie`) : la vente
  mise à part garde `deux` (les deux prix lus) et `auMoinsC` (le plus bas). Le total ne bouge pas.
- La ligne publiée `vinted_urssaf_mois.nonComptees` gagne `parC` (par raison, la somme « au moins » si CHAQUE vente la
  porte, sinon `null`) et `det` (300 au plus : identité, date, les deux prix, l'annonce pour son N° ; jamais de titre).
- `src/composants/NonComptees.jsx` : une ligne par site et par raison (« 60 ventes Vinted à deux prix · au moins
  3 090 € »), UN geste (« Ouvre ton porte-monnaie Vinted : le relevé tranchera. »), « Pourquoi ? » replié, et le détail
  par vente REPLIÉ en liste (N° · date · les deux prix). Une raison d'avant (prix dans le texte, publication ancienne)
  est reconnue et groupée (`codeRaison`). Branché sur la carte du mois (Déclarer) et « Vendu et reçu » (Résumé) ; les
  autres phrases (`phraseNonComptees`, Statistiques, Ma journée) deviennent courtes d'elles-mêmes.
- `src/design/verre-argent.css` (couche `vrm-verre`, famille des feuilles du verre) : dans Argent, ces blocs deviennent
  du VERRE (`--sv-verre`, rayon 22, l'ombre du verre) avec l'encre du verre (jetons `--sv-*`, clair et sombre) ; la
  nuit en `::before` retirée ; « Copier » plein ; un bouton inactif garde sa matière ; libellés entiers (« Vendues et
  finalisées cette année », plus de « … »).
- « Mois bouclé » : chaque ligne à régler dit son geste en une ligne (`nc.mb.*`) — les dates de versement :
  « L'extension les lit petit à petit, onglet vinted.fr ouvert. »
- Textes neufs par `tr()`, 5 langues (`src/i18n/langues/*/argentMieux.js`). « Quoi de neuf » : `argent-lisible`.

## La règle des « deux prix » — la piste pour décision (rien changé)

Mesuré en LECTURE SEULE sur sa base (projections scalaires, rien recopié dans le dépôt), le 16 nov. :
- 2 comptes Pro, 89 transactions de vente lues. La liste des ventes (`my_orders.price`) et le prix de l'article
  (`offer.price`) diffèrent sur **66** ; elles sont égales sur 23 (21 pas encore finalisées, statut 230, et 2 finalisées).
  Les 66 qui diffèrent sont **toutes** finalisées (statut 450).
- L'écart : toujours la liste AU-DESSUS de l'article, de **+0,47 € à +1,45 €** (35 entre 0,47 et 0,59 · 25 entre 0,60
  et 0,99 · 5 entre 1,00 et 1,25 · 1 au-dessus), quel que soit le prix (3 € → +0,47 ; 50 € → +0,48).
- **Ce n'est PAS la protection acheteurs** : elle vaut 5 % + 0,70 € (`service_fee`, 0,85 € à 5,70 € ici) et elle est
  ajoutée au total payé par l'acheteur (`total_amount_without_tax` = article + protection) ; l'écart ne vaut ni elle
  ni une part fixe d'elle (15 % à 55 %). Ce n'est pas non plus un lot (`items_count` = 1 partout).
- Somme : liste 2 909,35 € contre article 2 864,98 € (écart total 44,37 € sur 66 ventes).
- Relevés du porte-monnaie sur ces comptes : **0** — « le relevé tranchera » ne peut pas trancher aujourd'hui.

Ce que ça permet de proposer (décision de Julien) : le prix de l'ARTICLE est lu sans ambiguïté sur la transaction,
et `src/vintedPro.js` §3 dit déjà que le CA d'une vente Pro est le prix de l'article. Compter ces ventes au prix de
l'article (2 864,98 €), avec l'écart nommé (« + 44,37 € que Vinted ajoute à la liste après la finalisation, pas
expliqué »), serait un minimum sûr au lieu de 66 ventes hors total. Je ne l'ai PAS fait (consigne : ne pas changer la
règle) ; l'écran dit « au moins » la somme des plus bas, qui EST cette somme.

## Les preuves

- `scripts/bancs/argent-mieux.cjs` (base inventée ; mesures `C` contraste par la mesure de verre.cjs, `G` groupes,
  `B` Copier, `L` libellés) : après, vert aux 4 tailles/thèmes ; avant (`BANC_DIST=` l'arbre d'`origin/main`) : 46 ❌
  (contraste 1,04:1, mur de 60, Copier 1,29:1, « … »).
- Mutations (arbres copiés, rebâtis) : (1) le groupement par VENTE (`cle` + id) ⇒ G rouge ; (2) l'encre du verre
  retirée de verre-argent.css ⇒ C rouge.
- `audit-vinted-pro` : P2 porté sur la RÈGLE (les deux prix en champs, plus dans le texte) + P8 (la raison ne dépend
  pas des montants) ; 31 verts.
- Captures regardées : Déclarer 390 clair et sombre, 1512 clair, Résumé, Factures.

## Reprise du 16 nov. (soir) — aucun chiffre n'a changé (prouvé)

- `git merge origin/main` (vrai merge ; conflit CLAUDE.md §9 réglé en gardant les deux lignes ; deux lignes du 15 nov.
  déplacées telles quelles dans `historique-divers.md`, CLAUDE.md < 59 000 octets).
- Le banc relève maintenant CHAQUE montant rendu (`MONTANTS=<fichier>` : segment fermé, replis ouverts, et le détail
  replié par vente). Lancé sur l'arbre d'`origin/main` (avant) et sur la branche (après), 390 et 1512, clair et
  sombre, Résumé · Déclarer · Factures. Comparaison (montants « 30 € » et « 30,00 € » confondus) :
  - hors prix par vente : **tous les montants sont identiques** avant/après sur les 24 vues ; le SEUL montant neuf est
    « au moins 3 090 € » de la ligne groupée (= la somme des prix les plus bas, déjà vérifiée par G) ;
  - les 120 prix par vente (2 × 60) qui faisaient le mur sont **tous** dans le détail replié (aucun manquant).
  - Factures : identiques (11 montants).
- Banc : après 64 ✅ · 0 ❌ ; avant 18 ✅ · 46 ❌.

### La question à poser à Julien (une phrase, deux choix)

« Sur tes comptes Pro, Vinted affiche pour 66 ventes un prix dans la liste un peu plus haut (+0,47 € à +1,45 €) que le
prix de l'article sur la vente — ce n'est PAS la protection acheteurs : veux-tu (A) qu'on les compte au prix de
l'article (2 864,98 € en plus dans ton CA, l'écart de 44,37 € nommé à côté) ou (B) qu'elles restent à part tant que
ton relevé Vinted ne tranche pas (comme aujourd'hui) ? »

## Décision de Julien : les deux prix COMPTÉS (16 nov. au soir, lot `deux-prix-compter`)

Sa réponse à la question ci-dessus : (A). **Sur ses comptes Vinted Pro, une vente dont le prix de la LISTE dépasse
le prix de l'ARTICLE de quelques centimes à 2 € est COMPTÉE au prix de l'article (le plus bas), partout ; l'écart
(liste − article) est écrit à côté, discret (« dont 44,37 € d'écart non compté »), jamais ajouté.** Rien d'autre ne
change : une vente à un seul prix ne bouge pas ; un écart négatif, au-delà de 2 €, une transaction pas lue, ou un relevé
qui dit un troisième prix ⇒ à part comme avant, et dit.

Remesuré le 16 nov. au soir (lecture seule, projections et sommes) : 89 ventes Pro lues, 66 à liste > article
(+0,47 à +1,45 €, somme liste 2 909,35 € / article 2 864,98 € / écart 44,37 €), 23 égales, aucune hors de ces deux cas.
Les 21 e-mails de vente Pro reçus portent TOUS le prix de l'article (21/21 = article = liste, ventes pas encore
finalisées) : l'écart apparaît après la finalisation.

### Ce qui change (la règle UNE fois)
- `src/vintedPro.js` `prixVentePro` : nouveau cas `deux-prix-ecart` — `compter: true`, `prixArticle` (le prix de la
  vente devient celui de l'article au chargement, `_prixListe` garde l'autre, exactement comme « relevé = article »),
  `ecartC` (centimes). Borne `ECART_MAX_C` = 200 (2,00 € compris). `ecartNonCompte(lignes, garde)` somme l'écart.
- `ventesDeclarables` et `ventesFaites` (App.jsx, recopiés dans `api/_lib/ventes-regle.js` par
  `audit-bilan-semaine --recopie`) : la ligne porte `ecartC` ; son montant est le prix de l'article. Le CA déclaré
  reste daté au versement.
- La ligne publiée `vinted_urssaf_mois.mois[]` gagne `nEcart` / `ecartC` (seulement quand il y en a : la ligne d'un
  vendeur sans ces ventes ne change pas d'un octet).
- Écrit à côté (clé `nc.ecart`, 5 langues) : Argent → Résumé (« Vendu et reçu », sous la couverture), Déclarer (carte
  du mois, et « Mois bouclé » pour le mois choisi), le rapport du mois (sous « CA des ventes finalisées »).
- Facture Pro : la vente se prouve désormais (« même montant » : l'e-mail porte le prix de l'article) et la facture
  est au prix de l'article. AVANT, une vente Pro finalisée à deux prix était refusée (« le prix diffère »).
- Ma journée, Statistiques, le widget : ils lisent les mêmes lignes ; les 66 ventes sortent d'elles-mêmes de « pas
  comptées ».

### Ce qui n'est PAS fait (dit)
- Le serveur ne pose PAS `_prixPro` (depuis le 11 nov., la règle Pro vit au chargement dans l'app) : le bilan de la
  semaine / du mois (`api/ship-reminders.js`) compte ces ventes au prix de la LISTE — comme avant (il les comptait déjà
  au prix de la liste quand l'app les mettait à part). Écart ≈ quelques euros par mois. Le corriger demande de lire
  profil + transactions Pro côté serveur et une copie de `typeCompteVinted` : un lot à part.
- L'envoi AUTOMATIQUE des factures Pro par le serveur (`api/_lib/factures-auto.js`) compare aussi au prix de la liste :
  pour une vente déjà finalisée à deux prix, il refuse (comme avant) ; l'envoi depuis l'app, lui, passe.
- Une vente déjà DÉCLARÉE (registre « J'ai déclaré ce mois ») restait comptée dans son mois au prix de la LISTE ;
  elle y compte maintenant au prix de l'article (même règle partout). Le montant qu'il a noté lors de sa déclaration
  n'est pas réécrit.

