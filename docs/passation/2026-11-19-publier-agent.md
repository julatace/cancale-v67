# 19 nov. 2026 — « Publier sur… » : la fiche article neutre et l'agent de publication sans IA

Branche `claude/publier-agent` (partie de `origin/claude/integration-19nov`, train du 19 nov. qui contient
`annonces-a-egalite`). Aucune PR, aucune fusion. Extension : tout est dans la **5.409.0** partagée (manifeste et zips
non touchés), capacité **`publierfiche`**.

Julien (demandes du 19 nov., §G, G bis, G ter de `2026-11-19-demandes-julien.md`) : « je vais pouvoir transvaser une
annonce de Vinted, Leboncoin, eBay à Vestiaire Collective, mais je veux être sûr que pour chaque article, peu importe ce
que c'est, ça publie au bon endroit dans la bonne catégorie » ; « il faut un agent totalement intelligent capable de
poster, peu importe ; s'il y a un doute il regarde, et s'il ne trouve pas il demande » ; « tu n'intègres pas d'IA » ;
« c'est l'extension qui va publier dans tous les cas ».

## 1. Mesuré d'abord (base de production, lecture seule, projections scalaires, 19 nov.)

| quoi | mesuré |
|---|---|
| Fiches de page Vinted (`vinted_item_details`) | **349** fiches ; `codes` sur 154 ; **`catalog_id` sur 74** (21 %) ; `brand_id` 74, `brand` (texte) 65 ; `color_ids` 73 (32 à une couleur, 41 à deux) ; `item_attributes` 74 : `size` 74, `condition` 74, **`material` 12** — en IDENTIFIANTS seulement ; `package_size_id` 74. **Aucun** `size_id`, `status_id`, `color1_id`, `is_unisex` rangé. Le champ texte `couleur` existe sur 171 fiches et est **vide sur les 171**. Description 349, photos 349. |
| Annonces Vinted lues (`harvest_*_listings`, 15 comptes) | **407** annonces : titre, prix, `size` (texte : 404 pointures EU, 3 vides), `brand` (texte : 405, **30 marques**), `status` (386 « Très bon état », 14 « Bon état », 4 « Satisfaisant », 1 « Neuf sans étiquette », 2 vides) ; 156 ont une fiche de page, **54 un `catalog_id`**, 85 un champ couleur, 10 une matière (codes). |
| Catégories Vinted du stock (fiches avec `catalog_id`) | 7 : 2632 Baskets femme (38), 1242 Baskets homme (17), 2645 Randonnée femme (8), 2651 Course femme (6), 2618 Bottines (3), 1238 Habillées homme (1), 2678 Randonnée homme (1). |
| Listes que les sites servent | `vinted_catalogue` : l'arbre des catégories seulement (**ni couleurs, ni matières, ni marques, ni tailles**). Leboncoin `lbc_catalogue` fdata v7 (relue le 19 nov.) : `shoe_brand_a` **793 marques**, couleurs, états, tailles, univers, types (et `accessories_material`… pour d'autres catégories). Vestiaire `vc_catalogue` : **`deposit_catalog` COMPLET** (5 univers, 15 catégories — l'ancienne table n'en avait relevé qu'une partie) et **`deposit_brands` : 17 183 marques, dont 3 486 « banned »**. |
| Ses 30 marques face aux listes | Leboncoin : **339 / 407** annonces ont une marque exacte de la liste (hors liste : Autry, Nike SB, collaborations « Nike x … », On Cloud, Onitsuka Tiger, Crime London, Lumberjack, « no marque »…). Vestiaire : **20 / 30** marques présentes (372 / 407 annonces), **0 bannie** ; absentes : Nike SB, On Cloud, « no marque », 4 collaborations Nike, J.M. Weston, « adidas Stan Smith ». |
| Leboncoin (`lbc_listings`) | 194 annonces rangées (69 avec un compte) : `category` (libellé) sur toutes (39 « Chaussures » sur ses comptes), `subject`, `body`, `price`, `images`, `ref` ; **aucun critère** (univers, type, marque, taille, état, couleur) n'est rangé. |
| eBay (`ebay_listings`) | 4 annonces : `detail.categoryId/categoryName` (« … Homme : chaussures:Baskets »), `condition` (« Occasion - Très bon état »), `specifics` (Marque, Pointure EU, Couleur, Type, Département, Style…). |
| Vestiaire (`vc_listings`) | 3 annonces : titre, prix, photo, statut — **pas de catégorie ni de marque**. |
| Réponses retenues | `vrm_correspondances` : **aucune** (il n'a encore jamais répondu). |

## 2. Ce qui est livré

### La fiche article neutre — `src/publier/agent.js` (`ficheArticle`)
Catégorie VRM (neutre : « chaussures/baskets/homme »), genre, marque, pointure (EU, jamais convertie), état, couleurs,
matières, dimensions, titre, description, photos, prix, prix mini. Remplie à la LECTURE des annonces de l'article
(article central `construireArticles`) : Vinted (`catalog_id`, texte de l'annonce, fiche de page), eBay (chemin de
catégorie, `specifics`, état), Leboncoin (catégorie de l'annonce : la FAMILLE seulement, jamais le type), Vestiaire (rien
de plus que titre/prix/photo). Chaque champ dit d'où il vient ; pas lu ⇒ vide (`manques`), **jamais tiré du titre** ;
deux annonces qui se contredisent ⇒ `conflit`, demandé. Les annonces de `construireArticles` portent maintenant leur
titre, photo, taille, état et marque (ajout, rien d'enlevé ; `annoncesVinted` lit `brand`).

### Les tables par champ et par site, dans les deux sens — `src/publier/tables.js`, `src/publier/listes.js`
- Catégorie : **23 catégories VRM**, chacune liée à SON `catalog_id` Vinted (bijection vérifiée) ; entrant eBay =
  seulement un chemin VU ; entrant Leboncoin = la famille et ses candidates (**jamais « sûre », même à une seule
  candidate**) ; sortant Leboncoin = la table vérifiée existante (`ficheSite`, src/correspondances.js) ; sortant
  Vestiaire = le **catalogue de dépôt complet** (chaque valeur existe telle quelle) ; livres et jouets ⇒ Vestiaire « hors ».
- Marque : Leboncoin = les **793 libellés exacts** (chaussures) ; hors liste ⇒ demandée, facultative, **jamais « Autre »** ;
  Vestiaire = les 20 marques de son stock vérifiées présentes, les 9 vérifiées absentes ⇒ « pas vendable sous ce nom »,
  une marque jamais vue ⇒ cherchée par l'EXTENSION dans la liste entière du site au moment de l'envoi.
- État : le vocabulaire neutre = les 5 mots de Vinted ; Leboncoin et eBay par table ; eBay entrant : seulement les
  libellés vus (« Occasion » seul ne dit pas lequel).
- Pointure : EU, « 42.5 » ⇒ « 42,5 » ; une taille US reste texte, la pointure est alors demandée.
- Couleur, matière : traduites quand elles sont lues ; Vinted ne range que des CODES (aucune liste de libellés rangée) ⇒
  pas lues ; jamais bloquantes.

### L'agent — `planSite`, `questionsArticle`, `retenirReponses`, `envoiPour`, `relireEnvoi`
Ordre de confiance : (1) tables vérifiées ; (2) SES réponses passées (`vrm_agent_publier`, synchronisée : par article, par
catégorie VRM, par marque — et `vrm_correspondances` d'avant, honorées) ; (3) ce qui se lit sur le site cible (catégories
qu'eBay propose, libellé exact cliqué par l'extension sur le formulaire Leboncoin, liste des marques Vestiaire).
Doute restant ⇒ **UNE question groupée par article** (catégorie, état, pointure une seule fois pour tous les sites, puis
par site) ; sa réponse est retenue (hors de la liste du site ⇒ jamais retenue). Rien ne part sans N°, sans catégorie
sûre, sans champ obligatoire sûr. Un site qui refuse (livre sur Vestiaire, marque hors liste) ⇒ « Pas vendable ici »,
dit, sans question inutile.

**L'extension publie** — commande **`publierFiche`** (background.js, `publierFicheSite`, 5.409, capacité `publierfiche`) :
fiche revérifiée en entier (`ficheAgentValide` : N°, « VRM-{n°} » dans la description, titre ≤ 50/80, prix, 1 à 10 photos
https d'un site connu, état du vocabulaire du site, **catégorie sûre** — Leboncoin : `criteresFicheLbc` ; Vestiaire :
`categorieVcDemandee` sur le catalogue capté) ; Vestiaire : la marque cherchée dans `deposit_brands` (`marqueVcListee` :
absente ou « banned » ⇒ rien ne part) ; **compte de l'onglet** (un seul compte ouvert sur ce site, sinon rien),
`secuRobotDit` + `secuGeste` + pause Leboncoin + **50 actions/heure**, **un dépôt à la fois par site** (verrou + dépôt en
attente < 30 min ⇒ refusé) ; paire prouvée vendue sur Vinted ⇒ refusée. Puis le dépôt existant (lbc.js, vc-depot.js)
avec `publier: true`. eBay : un brouillon (`preparerBrouillonPartout`, sa catégorie), jamais publié d'ici (§2.8).

**Relecture** : l'envoi accepté est noté (`envois['site:N°']`, la catégorie VOULUE) ; à chaque lecture, la catégorie
ENREGISTRÉE par le site est relue par identité (« Réf. VRM-{n°} » Leboncoin, SKU `VRM-{n°}` eBay) : conforme · écart
(« Leboncoin a enregistré « Vêtements » au lieu de « Chaussures » : corrige la catégorie… ») · pas encore relue · pas su
(jamais « conforme »). Vestiaire ne rend pas la catégorie dans ses annonces lues : « posée, pas relue », dit.

### L'écran — `src/ecrans/PublierAgent.jsx` (design natif §2 bis)
Annonces → Actions → **« Publier sur… »** (articles avec N° et une annonce en ligne, cochés). Page poussée : barre
d'outils (Articles | Couverture · Sites · Relire), « N articles », **tableau à l'ordinateur** (article · catégorie · un
état par site, étiquettes douces : Prêt, N questions, Pas vendable ici, Déjà en ligne, Envoyé, Relu, Catégorie
différente…), **rangées au téléphone** (catégorie, sites prêts, une étiquette de résumé) ; toucher ⇒ la question groupée
(feuille) ou la fiche neutre (d'où vient chaque champ, ce que chaque site recevra et pourquoi) ; UN plein « Publier N
annonces » (l'un après l'autre : chaque dépôt attend la fin du précédent ; « Annuler » arrête entre deux). Vue
**Couverture** : chaque catégorie du stock × site, sûre / à demander / impossible. Textes `tr()` 5 langues
(`src/i18n/langues/*/publierAgent.js`), ligne « Quoi de neuf » `publier-agent`.

## 3. Preuves

- `scripts/audit-publier-agent.cjs` : **47 contrôles** (A fiche, B tables, C plan, D réponses, E relecture, F couverture,
  G extension — le VRAI background.js dans `_fond-vm.cjs` : refus sans catégorie / catégorie inconnue / sans « VRM-42 » /
  photo d'un site inconnu, sous-catégorie Vestiaire absente du catalogue, marque absente ou bannie, deux comptes
  Leboncoin ⇒ aucun onglet, un dépôt à la fois —, H câblage) ; `--prouve` : **17/17 mutations rouges** (titre deviné,
  conflit ignoré, partielle Leboncoin « sûre », pointure convertie, marque forcée Leboncoin / Vestiaire, envoi sans
  catégorie, relecture aveugle, « pas su » ⇒ conforme, réponse hors liste retenue, réponse oubliée, réponse qui fuit vers
  un autre article, extension sans catégorie, marque Vestiaire ignorée, deux comptes, deux dépôts, synchro oubliée) ;
  sur le code d'avant (`git archive origin/claude/integration-19nov`) : **0 vert, 9 rouges**.
- `scripts/bancs/publier-agent.cjs` (outils/publier-agent/, App.jsx et eBay remplacés par des faux qui comptent) :
  **99 verts**, 390 × 844 tactile et 1512, clair et sombre — tableau à 5 colonnes et un état par case, un plein, cibles
  ≥ 44, contrastes ≥ 4,5:1, aucun débordement, aucune erreur ; la question groupée (catégorie + état + pointure + marque
  dans UNE feuille) ⇒ réponse retenue ⇒ l'article Leboncoin passe « Prêt » vers Vestiaire ; « Publier 5 » ⇒ 5 commandes
  `publierFiche`, **une seule en vol**, chacune avec sa catégorie et « VRM-n° », rien pour l'article sans catégorie ni le
  livre vers Vestiaire ; couverture ; extension sans `publierfiche` ⇒ aucun Leboncoin/Vestiaire prêt ; `--prouve` 2/2.
  **Captures regardées** (corrigé sur elles : contraste de « Prêt » 4,47 ⇒ encre sur teinte ; cellule article qui
  cassait les filets du tableau ; rangée de téléphone trop bavarde ⇒ étiquette de résumé ; « Sites · 3 » au téléphone).
- Verts : `npm run build`, audit-traduction (45), audit-coherence, audit-tdz, audit-variables, audit-identite,
  audit-parite-sites (96), audit-correspondances (45), audit-publier-partout (75), audit-actions-gardees (12),
  audit-quoi-de-neuf, audit-icones.

## 4. Ce qui reste (honnête)

- **Rien n'a été essayé dans son vrai navigateur.** Le dépôt Leboncoin/Vestiaire d'une fiche venue d'un AUTRE site que
  Vinted réutilise lbc.js / vc-depot.js avec des photos d'un autre hôte (img.leboncoin.fr, i.ebayimg.com…) : leur
  téléchargement par la page de dépôt n'a pas été mesuré. Geste : installer la 5.409, publier UN article Leboncoin vers
  Vestiaire, regarder.
- Vestiaire : la catégorie n'est pas relue (ses annonces lues ne la portent pas) — il faudrait capter la fiche
  d'annonce Vestiaire après dépôt.
- Vers **Vinted** : la catégorie VRM ⇒ `catalog_id` est connue (bijection), mais l'envoi passe toujours par « Créer sur
  Vinted » (fiche À publier) ; pas branché dans « Publier sur… ».
- Couleur et matière Vinted : rangées en CODES seulement, aucune liste de libellés captée ⇒ jamais traduites (ni
  devinées). Les capter (formulaire de dépôt Vinted) les rendrait sûres.
- Leboncoin : les critères des catégories autres que « Chaussures » viennent du fdata, formulaire pas vu
  (`vu: 'liste'`, inchangé) ; marques hors chaussures « à lire sur le formulaire ».
- eBay : un seul chemin de catégorie vu chez lui ; chaque catégorie se choisit une fois parmi celles qu'eBay propose.
- 79 % de ses fiches Vinted n'ont pas de `catalog_id` lu : leur catégorie se demande (une fois, retenue par article) ;
  ouvrir l'annonce sur vinted.fr avec l'extension la lit.
