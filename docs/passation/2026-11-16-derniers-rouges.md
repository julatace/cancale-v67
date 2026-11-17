# 16 nov. — lot `derniers-rouges` : les derniers rouges de main

Suite du lot `audits-vert-main` (69 → 3 audits rouges). Mission : `audit-vendeur-generaliste`,
`audit-vocabulaire-article`, `audit-infos-vinted`, `audit-notifs-redaction`, puis les bancs principaux
que personne ne traite (annonces-actions, chiffres-coherents, statut-colis, navigation-tache,
budget-vitesse) et la part 2 des bancs coupée à 45 min.

## 1. `audit-notifs-redaction` (rouge sur main, cause inconnue) — VRAI défaut, d'horloge

Cause : `sendPushToAll` (api/_lib/push.js) date chaque entrée du centre avec SON horloge
(`instantNotif()`, qui lit `VRM_NOTIF_HORLOGE` aux bancs), mais comptait les non lues des 24 h avec
`nonLuesDeGenre(…)` sur `Date.now()` (valeur par défaut). L'horloge du banc est le 15 nov. 13 h 28 :
le 16 nov. à 13 h 28 passé, les 8 offres « avaient plus de 24 h » ⇒ k = 1, jamais « 8 offres à
trancher ». En production les deux horloges sont la même ; la règle reste fausse dès qu'une horloge
est posée (bancs, rejeu). Correctif : `nonLuesDeGenre(rangee.entrees, genre.id, lu, t)`.
Preuve : 134 → 139 verts ; l'appel d'avant (sans `t`) ⇒ 5 rouges (section 4).

## 2. `audit-vocabulaire-article` et `audit-vendeur-generaliste` — vrais défauts

Mesuré : 143 textes « paire(s) » hors liste (sortie complète par `VOCAB_TOUT=1`), dont 82 phrases
de dictionnaire arrivées avec les lots des 14-15 nov. (deux comptes, atelier, fiche, idées, liste,
retrait ailleurs, numéros nouveaux…), 20 lignes de « Quoi de neuf », 2 vidéos d'aide, une carte de
Ma journée ; la SEMELLE demandée à tout vendeur (fiche « Infos à partager », « + semelle » dans la
réponse) ; « air max 90 », « dunk 42 » en exemple à tous.

- **Une règle** (src/i18n/index.js) : `t(clé)` choisit `clé.art` quand le vendeur ne vend pas (que)
  des sneakers (`vendCourant()` de src/profilVendeur.js) et que la variante existe. Sneakers : le
  texte d'avant, mot pour mot. Les variantes : `src/i18n/langues/{fr,en,es,it,de}/article.js`
  (82 clés × 5 langues, accords faits à la main : « cet article », « lequel », « retire-le »,
  « der Artikel », « gli articoli »…). Aucun appel à changer.
- « Quoi de neuf » : `nouveautesDuCompte` passe titre et phrase par `phraseVendeur` (« pas su » ⇒ le
  mot neutre) ; vidéos d'aide (AideVideo.jsx) et cartes de Ma journée (JourneePerso.jsx) aussi ;
  leurs 23 phrases ont leur version écrite en entier dans `PHRASES_ARTICLE`.
- Semelle : le champ ne se montre qu'à un vendeur de Sneakers, ou s'il est déjà rempli
  (InfosPaire.jsx) ; « + semelle » ne se propose qu'à lui (AideReponse.jsx).
- Exemples : « air max 90 » / « Nike » / « 42,5 / 43 » seulement pour Sneakers (AchatsPlus.jsx) ;
  « 124, B125 ou un mot du titre » sinon (`ia.vm.numeroExemple.art`).
- Les audits portés sur la RÈGLE, rien d'affaibli : une clé de traduction passée à `tr()` n'est pas
  un texte (son texte est jugé dans le dictionnaire) ; une phrase de dictionnaire n'est gardée que
  si sa variante `.art` (ou `.autre` pour une clé `.sneakers`) existe ET ne dit pas le mot ;
  A1 EXÉCUTE `t()` (Sneakers ⇒ texte d'avant, autre ⇒ variante, clé sans variante inchangée) ;
  B11 exige la version « article » de chaque phrase de vidéo, carte, nouveauté, et que l'écran la
  prenne. Les permis ajoutés, chacun avec sa raison : libellés exacts des catégories Leboncoin /
  Vestiaire et chemins Vinted (src/correspondances.js), mots de LECTURE (questions d'acheteur,
  recherche des réglages, mots vides), expression de lecture d'une taille, variantes féminines
  `…F`, projection PostgREST, critère « Pointure » d'une catégorie chaussure.
- Preuves : vocabulaire-article 1 rouge → vert ; `--prouve` 24/24 mutations (4 neuves :
  `t()` sans variante, Quoi de neuf sans phraseVendeur, vidéo sans phraseVendeur, variante qui
  redit « paire » ; la vidéo d'abord VERTE sous mutation, le contrôle resserré, puis rouge).
  vendeur-generaliste 2 rouges → vert ; `--prouve` 23/23 (3 neuves : semelle pour tous,
  « dunk 42 » remis, « air max 90 » pour tous). traduction, quoi-de-neuf, annuler-commandes,
  journee-perso, aide-videos, vendeurs-differents, textes-courts, variables, tdz : verts.

## 3. `audit-infos-vinted` — recopie, sans version (PR séparée #1210)

`node scripts/regles-achat-extension.cjs --recopie` ⇒ `vinted-sync-extension/vrm-regles-achat.js`
(frais par plateforme : boosts, commandes eBay dans une autre devise écartées). Contenu d'extension
changé ⇒ `audit-extension-zip` rouge tant qu'elle part seule (5.393.0 déjà servie). Branche
`claude/regles-achat-recopie`, PR #1210 « à fusionner avec la dernière montée de version » ; ligne
écrite dans le fichier des versions réservées du 16 nov. (le train qui monte 5.399/5.400 la prend
dans sa DERNIÈRE version, puis régénère les zips). Aucune version montée ici.

## 4. Bancs

- **Part 2 coupée** : mesuré sur la CI du 16 nov. (job 133301529302) : navigation-tache 9 min,
  budget-vitesse 18 min (3 essais par écran hors budget), accessibilite 8 min et pas finie au délai
  de 45 min ; part 1 : 6 min. Rééquilibré dans `.github/workflows/verifier.yml` (budget-vitesse en
  part 1) : ~25 / ~25 / ~33 min, plutôt qu'un délai allongé (une part rouge coupée ne dit même pas
  quels bancs sont rouges).
- **annonces-actions F à 1512** : vrai défaut — les gestes du carré (« Republier à la main »,
  « Prix mini… », « Baisser le prix… », « Publier partout… », « Nouveautés de la semaine ») sont
  des `Bouton` de 40 px au bureau, ajoutés au carré après le banc (11 nov.) ; 44 px à toute largeur
  dans le carré (styles-annonces-coherence.css), comme les tuiles.

- **navigation-tache** (13 rouges sur la CI) : banc PÉRIMÉ — il jugeait la barre du 11 nov. (DJ3 : Journée ·
  Annonces · Ventes · Achats · Plus) ; la barre a changé le 14 nov. (choix n° 61 : quatre onglets, le reste dans
  le menu de l'avatar) puis le 16 (barre-achats : Achats revient). Porté sur la RÈGLE : la barre rendue doit être
  `BOTTOM_TABS` tel que src/App.jsx le déclare (ordre, libellé `nav.<id>` dans la langue, 44 px, aucun « Plus » ;
  le disque « + » du centre n'est pas un onglet) ; le menu de l'avatar porte Messages, Stock, E-mails, Communauté et
  Paramètres ; le rail de l'ordinateur (15 nov., refonte-journee) : Ma journée, Vendre · Ranger · Compter, Paramètres
  et la carte du compte au pied ; les sous-sections eBay sont lues dans `SOUS_SECTIONS` (src/navigationTache.js :
  Tableau d'abord depuis le 15 nov.). Local (dist d'avant le merge de barre-achats) : 13 → 3 rouges (la barre, D).
  D « deux paires au même titre » : le titre se lit désormais dans le `textContent` de la ligne (à confirmer CI).
- **statut-colis** (33 rouges locaux) : banc PÉRIMÉ sur deux règles du 14 nov. — (1) f86e3b0b2 : un colis arrivé
  SANS code n'est plus « à retirer » mais « À vérifier » (raison `sans_code`, jamais compté) ⇒ C5, C15, la carte
  Tabavap à 3, total 9 ; (2) « Fiche partout » (proposition 62) : toucher un colis ouvre LA fiche, son détail y est
  rendu (`DansFiche`) ⇒ `detail()` lit `[data-fiche-paire] [data-rp-detail]` puis ferme la fiche.
- **chiffres-coherents** (4 rouges) : banc PÉRIMÉ — Ma journée est la grille Studio (14 nov.) : « 2 à imprimer »
  est le geste de la tuile À envoyer (`data-sj-imprimer`) ; son exactitude est maintenant écrite
  (`data-sj-imprimer-exact`, la même règle `emballer.exact` qu'avant) ; « Préparer la tournée de dépôt » est rangé
  dans « À faire · N » (refonte des listes, 14 nov.) : le banc ouvre « À faire » avant de toucher la tournée.
- **budget-vitesse** : trois lectures en double retirées dans l'app — les bordereaux e-mail (`email_bord_*`,
  « NOUVELLE lecture en double » sur Annonces, Ventes, Achats) en une lecture en vol partagée ; `vrm_controle_nuit` /
  `vrm_controle_installation` (3 lectures pour un budget de 2 à l'ouverture de Ma journée : VeilleJournee et
  Fiabilite) partagées pour l'affichage ; `vinted_listing_dates` par `fetchMemo`. Le JS « appareil neuf » mesuré
  par la CI : 2 310 Ko pour un budget de 1 966 (+17 %, `App-*.js` seul ≈ 1,85 Mo compressé) — pas relevé ici.

## 5. Reprise du 16 nov. (soir)

CI de la PR sur a1a33f6c1 : statut-colis 81/0 et navigation-tache 162/0 VERTS (bancs portés confirmés) ; part 2 finie en
27 min (part 1 26, part 3 31 : le rééquilibrage suffit, aucune part coupée). Restaient :

- **budget-vitesse, JS + 18 % — vrai défaut trouvé** : pdf-lib (+ pako, polices, upng ≈ 1,1 Mo brut) dans le morceau
  `App` depuis le 9 nov. — App.jsx importe `api/_lib/transporteur-anciens.js` ⇒ `transporteur-pdf.js` ⇒ `texte-pdf.js`
  ⇒ pdf-lib, en tête de fichier : chaque appareil neuf le téléchargeait au démarrage. `transporteur-pdf.js` charge
  désormais `texte-pdf.js` à la lecture d'un PDF (`import()`), le serveur aussi (audits transporteur-pdf,
  transporteurs-parfaits, logos-bordereaux, retour-parfait, fonctions-api verts). Mesuré (plugin d'analyse du build) :
  App-*.js 1 858 → 1 674 Ko compressés ; banc : 2 317 → 2 140 Ko. Le reste est le code des lots du 13 au 16 nov.
  (CSS de la refonte verre/Studio, dictionnaires) : budget JS relevé à **2 250** (+5 %, pas +10 % : le build d'avant, 2 317,
  y reste rouge) ; 2ᵉ ouverture 20 → 26 (coquille 23 Ko). Lectures, octets, doublons NON relevés.
- **annonces-actions F à 1512** : le correctif d'avant (`min-height: 44px` hors couche) perdait contre
  `--d-h-ctrl` (36 px à la souris, styles-systeme.css §2.3 dans `@layer vrm-premium` + `!important` : en `!important`, la
  couche gagne). Le carré pose `--d-h-ctrl: 44px` : vert (banc entier, 1512 et 390, clair et sombre).
- **chiffres-coherents D** : banc PÉRIMÉ — la tournée est derrière « … » des Ventes en verre (ventes-verre.css §9) ; le
  banc ouvre « … » (`data-colis-outils-bascule`) comme lui. 26/26.
- **nouveau-vendeur** (18 rouges) : vrais défauts — touches de site d'Annonces/Achats 38 px (puits 50, touches 44 au
  doigt), « 30 j / 90 j » 40 px de large (44), « 2 prix à saisir » 24 px avec un `::after` (le lien fait 44 px, marges
  négatives : place inchangée), « · aucun compte relié » en tête de ligne (note posée en bloc ; en ligne désormais),
  Paramètres à l'ordinateur : le bureau plafonné à 880 px (`.vrm-set > *`, styles-reglages.css) contre la maquette
  « toute la largeur » ⇒ « Supprimer mon compte » sur deux lignes. Banc précisé : un élément `pointer-events: none`
  (la plaque N° d'une rangée de liste — « la rangée est le geste ») n'est pas une cible ; un bouton touchable petit
  reste rouge. Sonde utilisée : CDP `CSS.getMatchedStylesForNode` (quelle règle donne la hauteur).

## 6. 17 nov. — après les fusions de main

- **ventes-e2 « annul »** (rouge NOUVEAU avec #1202 « Ventes plus clair », sous WebKit ET Chromium — CI de #1222, et
  ici 8 rouges) : banc PÉRIMÉ, pas un défaut — l'alerte « vendeuse_b annule plus » est rangée, comme voulu, dans
  « 3 choses à regarder » (src/ventes/ARegarder.jsx, repli fermé : la liste d'abord) ; capture regardée : l'alerte, ses
  3 ventes annulées, rien de rouge. Le banc ouvre le repli comme lui et exige en plus que N la compte (N ≥ 1, fermé).
  annul, egal, exclu : verts.
- audit-vocabulaire-article après fusion : « Délier » (relier-fiable) et « la paire monte » (design-restes) ont leur
  version « article » ; B11 : « Modifier ma journée » ne montre plus de description (personnalisation-simple), la règle
  tient tant qu'aucune n'est rendue sans `phraseVendeur`.
- veilleLigne : vitesse-lectures a fait la même lecture partagée, sa version gardée.

## ÉTAT À LA REPRISE

- PR #1215 (`claude/derniers-rouges`) ; PR #1210 (`claude/regles-achat-recopie`, recopie de vrm-regles-achat.js) à
  fusionner AVEC la dernière montée de version du train (ligne dans le fichier des versions réservées).
- Audits du lot verts en local après le merge de main (8d8196d38) : vocabulaire-article, vendeur-generaliste,
  notifs-redaction, traduction, quoi-de-neuf, transporteur-connu, veille, lectures*, tdz, variables.
- (soir) Reste : budget-vitesse — doublons d'Achats (`panel_num_reserves` 5/4 sur la CI, quatre lecteurs : App.jsx
  5624, 13385, 18580, 37800 — le dernier en `fetch` nu, hors lecture partagée) et Annonces 2ᵉ ouverture octets +11 % (CI) :
  pas traités. Les autres bancs rouges de la CI (colis-retirer-propre, iphone-reprise, retraits-suivi, ventes-e2,
  journee-coherence, morceau-perime, accessibilite*) sont à d'autres lots.
- Bancs : machine partagée saturée (charge 18-20, ~12 commandes lourdes en file) ⇒ un banc local attend 30 à 60 min
  son créneau et un navigateur a été tué en cours de route (annonces-actions, « Target page closed ») ; la preuve
  des bancs portés se lit sur la CI de la PR.
- Reste (voir le rapport) : budget-vitesse JS (+17 %, à mesurer avant tout relevé : un relevé masquerait une
  régression), doublons restants d'Achats (panel_num_reserves 5/4, brouillons 3/2, coffre 3/2), et les bancs
  rouges traités par d'autres lots (nouveau-vendeur, colis-retirer-propre, ventes-e2, journee-coherence,
  accessibilite…).
