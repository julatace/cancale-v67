# 15 nov. — Publier partout : des catégories qui correspondent d'un site à l'autre (extension 5.381.0)

Branche `claude/publier-partout-categories` (partie de `origin/main` 70fbef70, extension 5.378.0). Aucune PR.
⚠️ Version : 5.379.0 (`claude/lbc-orion`) et 5.380.0 (`claude/carte-extension`) sont prises par d'autres lots
(coordinateur) ⇒ ce lot porte **5.381.0** ; si l'ordre de fusion change, remonter au-dessus de la plus haute et
régénérer les zips une fois.

Julien : « quand je poste une paire sur Vinted, je veux pouvoir la poster sans souci sur Leboncoin, eBay et
Vestiaire Collective, pour que les catégories correspondent parfaitement entre elles, parce que des fois ce n'est
pas la même catégorie d'une application à l'autre… quand on met en ligne sur Leboncoin tout doit être vraiment
parfait… il faut que les numéros soient bien attribués ».

## 1. Mesuré d'abord (lecture seule, base de production, 15 nov.)

**D'où venait la catégorie de chaque site** (« Publier partout », `src/publierPartout.js`, `src/PublierPartout.jsx`,
hôte `HotePublierPartout` d'App.jsx) :

| site | avant | où ça se trompait |
|---|---|---|
| Leboncoin | l'app : `categorieLbcDe(titre, desc, taille, '' , marque)` — **chemin Vinted jamais passé** ⇒ d'après le titre ; l'extension : la même règle AVEC le chemin (`lbcCategory`). Univers et Type : **jamais posés** par VRM — Leboncoin les **prédit** (photo + titre, `ad-prediction/v2/adparams`) et `choisirComposant` ne touche pas un menu déjà rempli | une basket femme pouvait partir en « Homme » (prédiction gardée) ; une basket d'enfant partait en « Vêtements enfants » (Vinted range les chaussures d'enfant sous « Vêtements pour filles / garçons > Chaussures ») ; « Neuf sans étiquette » était DEMANDÉ alors que Leboncoin l'a ; une taille de vêtement Vinted (« L / 40 / 12 ») ne trouvait jamais « 40 - L » |
| Vestiaire | l'extension, `categorieVcDe(familleArticle(…))` sur le catalogue de dépôt capté | « Chaussures et bottes de randonnée » ⇒ sous-famille « bottes » ⇒ **Vestiaire « Bottes »** (305 de ses ventes sont des chaussures de randonnée Salomon) |
| eBay | la **première suggestion** d'eBay pour le TITRE (`pubinfo`), prise d'office dans le brouillon | rien ne garantissait que la suggestion soit la bonne (randonnée ⇒ « Baskets » possible) |

**Les catégories Vinted portées chez lui** — 23, lues sous `vinted_item_details[*].codes.catalog_id` (56 fiches sur
330 ; **aucune** n'a `catalogId` : l'app lisait le mauvais champ — corrigé) et `catalog_id` de ses transactions,
chemins par `vinted_catalogue` : Femmes/Hommes › Baskets (2632, 1242 — l'essentiel), randonnée (2645, 2678), course
(2651, 1453), tennis (2686), basket (2672), bottines (2618), chaussures habillées (1238), mocassins (2656, 2954),
bottes de travail (2622, 2664), enfants : baskets fille/garçon (2719, 2752), t-shirt et jean garçon (1662, 1697) ;
femme : sac à main (156), doudoune (2614), blouse (1043) ; livres (5426) ; jouets (3317). Tailles vues dans ses
annonces : pointures EU (34 à 49, demi-pointures « 42,5 » et « 42.5 »), « L / 40 / 12 », « M », « 6 ans / 116 cm »,
« Taille unique ». États : les cinq de Vinted.

**La taxonomie RÉELLE de Leboncoin** : `lbc_catalogue` (capté par l'extension sur SA navigation) — fdata v7 du
8 nov. (rubriques Mode 72 / Famille 79 / Loisirs 24, catégories et leurs identifiants, critères et TOUTES leurs
valeurs) et le formulaire de dépôt de la catégorie 53 « Chaussures » du 15 oct. (champs `shoe_type` Univers,
`shoe_category` Type de chaussures, `shoe_brand`, `shoe_size`, `clothing_condition`, `clothing_color`).
**Vestiaire** : `vc_catalogue.deposit_catalog`, libellés relevés le 27 oct. (partiels : `audit-categories-plateformes`).
**eBay** : AUCUN identifiant vérifié n'existe dans la base ni dans le dépôt ⇒ aucun n'est écrit ; ils viennent de
l'API Taxonomy (`get_category_suggestions`, route `parametres` d'api/ebay.js, gratuite, sur SON jeton) au moment où
il choisit.

## 2. La table — `src/correspondances.js` (pure)

Clé : la catégorie Vinted (`catalog_id`). Ordre d'une valeur : **sa réponse** (cette annonce) > **sa mémoire**
(`vrm_correspondances`, synchronisée, par catégorie Vinted, écrite sur son clic seulement) > **la table** > la
**traduction** des faits Vinted. Une valeur hors de la liste du site n'est jamais rangée.

| | sûres | à demander | hors site |
|---|---|---|---|
| Leboncoin (catégorie + univers + type) | **18** | **5** (chaussures habillées, bottes de travail ×2, blouse : le type ; pâte à modeler : la catégorie) | — |
| Vestiaire (univers › catégorie › sous-catégorie) | **7** | **14** (la liste des sous-catégories Vestiaire n'a été relevée qu'en partie) | 2 (livre, jouet) |
| eBay | 0 écrite | **23** : choisie UNE fois parmi les catégories qu'eBay propose, puis retenue | — |

Traductions explicites : **taille** (pointure EU ⇒ libellé Leboncoin, « 42.5 » ⇒ « 42,5 », ≥ 50 ⇒ « 50 et plus » ;
femme « L / 40 / 12 » ⇒ « 40 - L », homme « M », enfant « 6 ans / 116 cm » ; jamais convertie en US/UK — la
conversion dépend de la marque) ; **état** (les 5 de Vinted ⇒ Leboncoin, « Satisfaisant » ⇒ « État satisfaisant » ;
eBay 1000/1500/3000) ; **couleur** (30 couleurs Vinted ⇒ les 21 groupes de Leboncoin, la principale d'abord ;
« Abricot » demandée) ; **marque** (libellé exact de la liste Leboncoin, « adidas » ⇒ « Adidas » ; « Nike SB » demandée,
sa réponse retenue par marque). Catégorie Vinted **pas lue** ⇒ tout ce qui en dépend est demandé (rien de retenu).

## 3. Le parcours

« Publier partout » (fiche de la paire → Actions, ou Annonces → Actions) : chaque case de site commence par **« Sur
Vinted : Femmes › Chaussures › Baskets — Sur Leboncoin : Mode › Chaussures · Femme · Baskets & Sneakers ✓ »**, puis
Pointure · État · Couleur · Marque dans les mots du site ; une correspondance pas sûre est une liste des valeurs du
site (Leboncoin : bloquante pour catégorie/univers/type/taille ; couleur et marque : sinon choisies pendant le dépôt) ;
eBay : « Voir les catégories eBay » ⇒ SES catégories (nom + chemin), son toucher choisit et retient.

- **Leboncoin** (`lignePartout`) : la case ne part pas tant qu'une demande bloque ; une extension sans `lbccriteres`
  ⇒ bloquée (« sinon Leboncoin les devinerait »). L'envoi porte `categorie` + `criteres` dans la fiche
  (`lbcPublier`, `annonce`). L'extension (`criteresFicheLbc`) n'accepte qu'une catégorie du vocabulaire Leboncoin et
  six critères nommés ; `lbc.js` **remplace la prédiction** de Leboncoin par le critère sûr (libellé exact,
  `choisirComposantSur`), et **ne publie pas** si un Univers/Type de la fiche n'a pas pu être posé (le bandeau le dit).
- **Vestiaire** : ce que l'extension retrouve seule (« posée ») part ; une réponse, une mémoire ou une sous-catégorie
  sans correspondance sûre ⇒ « à finir sur Vestiaire : Sous-catégorie « Baskets » » (dépôt ouvert sans publier) ;
  livre / jouet ⇒ pas de case.
- **eBay** : le brouillon porte SA catégorie (`pubinfo` avec SON id, pour les caractéristiques) ; aucune ⇒ aucune
  devinée, « la catégorie » manque dans le brouillon. Toujours un brouillon, aucun port (§2.8).
- **Numéros (§5)** : inchangés — rien ne part sans N° ; « Réf. VRM-{n°} » (Leboncoin, Vestiaire), SKU `VRM-{n°}`
  (eBay) ; aucun N° neuf. Garde-fous de l'extension intacts (compte de l'onglet, 50/h, une requête à la fois).

## 4. L'extension 5.381.0 (capacité `lbccriteres`) — ce qui a changé, pour la fusion

- `background.js` : `criteresFicheLbc` + `LBC_CATEGORIES_FICHE` (nouveau, juste avant `progresLbcSur`) ;
  `appliquerAnnonceLbc` l'appelle (3 lignes) ; bloc partagé `<annonce-lbc-regle>` (le MÊME dans App.jsx) :
  `LBC_ETATS` + « Neuf sans étiquette », `SOUS_FAMILLES` + `randonnee` (avant `bottes`), `familleArticle` lit le
  segment suivant « Vêtements pour filles/garçons » quand c'est « Chaussures » ; `CODE_VERSION`.
- `lbc.js` : `choisirComposantSur`, `criteresPasPoses`, `remplirComposants` (univers, type, taille traduite, marque et
  couleur de la fiche), garde dans `publierSansBooster`.
- `manifest.json`, `lbc-inject.js` (`CAPTEUR_VERSION`), `lbc-relay.js` (`relaisVersion`), `public/extension-version.json`,
  App.jsx `EXT_ATTENDUE` + `EXT_CAPACITES.lbccriteres`, `audit-coherence` (`FONCTIONS`). Zips régénérés une fois.

## 5. Preuves

- `scripts/audit-correspondances.cjs` : 45 contrôles (A–G), **16/16 mutations** rouges (univers inversé, cible
  inventée, id eBay écrit, enfant ⇒ adulte, randonnée ⇒ baskets, taille approchée, couleur hors liste, mémoire hors
  liste, pointure convertie, demande pas bloquante, extension ignorée, Vestiaire « hors » cochable, eBay deviné,
  famille enfant d'avant, synchro oubliée, critères envoyés à une vieille extension).
- `scripts/audit-lbc-criteres.cjs` : le VRAI `lbc.js` dans Chromium (menus à la forme mesurée) + `criteresFicheLbc`
  dans une VM : 14 verts, 4/4 mutations ; sur le `lbc.js` d'avant, A et C sont rouges (la prédiction « Homme » reste,
  la publication part).
- `audit-publier-partout` : 75/75, 26/26 mutations (fixtures : catégorie Vinted lue ; E3 : « Neuf sans étiquette »
  existe chez Leboncoin, l'état inconnu est un autre mot ; mutation `requis-invente` remise sur la nouvelle voie).
- Banc `scripts/bancs/publier-partout.cjs` : scénario I (correspondances, demande, réponse retenue, catégories eBay)
  et F (le brouillon porte SA catégorie, `pubinfo` une seule fois) — voir le rapport de session pour l'état des 4 tailles.

## 6. Ce qui reste à apprendre sur SON navigateur

- **Leboncoin** : le formulaire de dépôt n'a été capté que pour « Chaussures » (53). Pour Vêtements (22),
  Accessoires & Bagagerie (47), Chaussures/Vêtements enfants (1013/1011), les valeurs sont celles du fdata mais le
  formulaire n'a pas été vu (`vu: 'liste'`) : si un menu n'a pas l'option exacte, rien n'est choisi et la publication
  s'arrête (il finit à la main). Geste qui l'apprend : déposer UNE annonce de chacune sur leboncoin.fr avec
  l'extension (le formulaire est capté dans `lbc_catalogue`).
- **Vestiaire** : la liste entière des sous-catégories (`vc_catalogue`) — une lecture complète du catalogue de dépôt
  permettrait de passer « à demander » en « sûre » (randonnée, course, bottines, enfants…), et une extension qui
  recevrait la catégorie dans `vcPreparer` la poserait (aujourd'hui : « à finir sur Vestiaire »).
- **eBay** : chaque catégorie Vinted se choisit une fois parmi celles d'eBay (son jeton) ; ensuite c'est retenu.
