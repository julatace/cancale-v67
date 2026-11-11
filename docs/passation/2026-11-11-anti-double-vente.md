# 11 nov. — Vendu sur un site ⇒ retiré des autres en un toucher (lot anti-double-vente)

Branche `claude/anti-double-vente` (partie d'`origin/main` fc3883d). Aucune écriture en base
réelle, aucune PR, rien dans `vinted-sync-extension/` (pas de nouvelle version d'extension).

## Ce qui existait déjà (lu dans le code avant d'écrire)

| morceau | où | état |
|---|---|---|
| Notification immédiate, regroupée : « ⚠️ N°124 vendu sur Vinted · encore en ligne sur Leboncoin et eBay » | `api/_lib/double-vente.js` (`notificationDoubleVente`), branchée sur l'e-mail de vente Vinted / Vestiaire (3 nov.) | **livré**, inchangé ici. Identité seulement (fiche N°, SKU `VRM-{n°}` relu par `numeroAnnonceEbay`, réf. / lien posé Leboncoin — jamais le « nXXX » du titre), Leboncoin seulement si `etatEnLigneLbc` = « en ligne » (lecture complète < 24 h), une notif par vente, « retiré d'eBay » si le retrait automatique l'a fait. Pas de lecteur d'e-mail de vente Leboncoin/eBay (aucune forme reçue, mesuré le 3 nov.). |
| La vérification « Vendus ailleurs » | `src/bilanSynchronisation.js` (`articlesVendusAilleurs`), crochet `useVerifVendusAilleurs` (`src/VendusAilleurs.jsx`), lecture `chargerRetraitsMulti` (App.jsx) | **livré** : vente PROUVÉE (transaction Vinted engagée, commande eBay engagée, vente Leboncoin vendeur, vente Vestiaire par référence) × annonce active ailleurs, reliées par le N° de leur fiche ; N° porté par deux paires ⇒ écarté (`ambigus`). Carte de Ma journée « N annonces vendues ailleurs » ⇒ feuille, chaque ligne « Gérer le retrait ». |
| Retirer, site par site | Leboncoin : `supprimeLbcDepuisApp` (extension, capacité `lbcsupprime` 5.291, plafond horaire, compte de l'onglet) ; eBay : route `retirer` (EndFixedPriceItem, `confirme:true`) ; eBay automatique (ALLUMÉ chez lui) : `retirerEbayAuto` | **livré**, réutilisé tel quel, le retrait automatique n'est pas touché. |
| Vestiaire | aucune voie de retrait | « à faire sur le site ». |
| Vinted | §3 : supprimer automatiquement est REFUSÉ | lien seulement. |

**Manquait** : le geste unique (« Retirer des autres sites ») qui enchaîne ces voies sur SON clic,
avec un résultat honnête par site, et le « peut-être » pour ce qui n'est pas lu.

## Ce qui change

### `src/retirerAilleurs.js` (module pur)
- `lignesPeutEtre(data, sures)` : les annonces à l'état **pas confirmé** (`active: null` — lecture
  Vestiaire > 24 h, état Leboncoin pas confirmé) passées dans la MÊME règle
  (`articlesVendusAilleurs`) : même identité, jamais affirmées. Le crochet les range dans
  `v.peutEtre`, avec `v.completes` (les lectures complètes par site et compte).
- `planRetirerAilleurs(v, { lbcOk, lbcPourquoi, ebayOk })` : par article (N°), chaque site dans
  une voie :
  - `auto` — Leboncoin si l'extension de CE navigateur sait supprimer (`extSait('lbcsupprime') ===
    'ok'`) et l'identifiant est lisible ; eBay (identifiant numérique, session) ;
  - `main` — Vinted (jamais automatique, lien direct `vinted.fr/items/…`), Vestiaire, Leboncoin sans
    extension à jour (la raison est dite) ;
  - `verifier` — lecture > 24 h, état pas confirmé, paire remise en vente (`aConfirmer`), **deux
    annonces sous ce N° sur le même site** (VRM ne choisit pas). Rien n'y part.
- `phraseArticle` : « N°7 vendu sur Vinted · encore en ligne sur Leboncoin et eBay », et
  « · peut-être encore en ligne sur eBay et Vestiaire · vérifier » pour le pas-su.
- `executerRetraits(plan, voies, continuer)` : seules les lignes `auto`, une à la fois,
  `continuer()` relu avant chaque appel (la session n'a pas changé) ; une issue qui n'est pas
  « retiré » arrête CE site (plafond, compte pas connecté, « pas su » : la suivante échouerait
  pareil), les autres continuent.
- `issueLbc` / `issueEbay` : les réponses des voies existantes ⇒ `retire` · `incertain` (pas de
  réponse claire : « regarde sur le site avant de recommencer », jamais « retiré ») · `refuse`.
  eBay « déjà terminée » (1047) = retiré.
- `avecRelecture(resultats, v)` : **« retiré ✓ relu »** seulement si une lecture COMPLÈTE de CE site
  et de CE compte faite APRÈS le retrait (`v.completes`) ne la montre plus. La note que VRM écrit
  lui-même après un « oui » du site (Leboncoin : l'extension la marque supprimée ; eBay : la route
  la sort de `ebay_listings`) n'est **pas** une relecture : d'ici là, « retiré · … · pas encore relu ».

### App (`Comptabilite`)
- Ma journée : quand VRM peut retirer quelque chose, la carte « Vendus ailleurs » devient
  « N°42 vendu sur Vinted · Encore en ligne sur Leboncoin et eBay » + **« Retirer des autres sites »**
  (variante `danger` = ambre, §7) ; toucher le texte ouvre toujours la feuille. Sinon, la carte d'avant.
- Ventes : le même bloc en tête (`blocRetirerAilleurs(false)`) ; la lecture « Vendus ailleurs » part
  aussi sur Ventes (une par session, mémoire partagée).
- Feuille « Vendus ailleurs » : le bloc en haut (résultats par site), seulement s'il apporte quelque
  chose (un retrait possible, un résultat, un « peut-être ») — le détail d'en dessous ne se redit pas.
- Le geste : `askConfirm` (chaque site et ce qui y sera fait, « sans retour ») ⇒ refus ⇒ rien ne part ;
  Leboncoin `vmrCmd({ cmd: 'lbcSupprime', id, confirme: true })` ; eBay `POST /api/ebay
  { action: 'retirer', itemId, confirme: true }` — **jamais `auto`** (c'est son clic : la route ne
  relit pas l'interrupteur) ; une annonce déjà prise par le retrait automatique de ce passage
  (`__retraitEbayAutoTentes`) n'est pas doublée. Après : eBay se relit chez eBay (`action: 'relire'`,
  une lecture, par compte retiré), puis la vérification est refaite ; la feuille s'ouvre sur les
  résultats.

## Mesuré / pas mesuré
- Pas de lecture de la vraie base pour ce lot : il ne lit aucune forme neuve (il range la sortie de
  `articlesVendusAilleurs`, déjà mesurée les 1er–5 nov.).
- Leboncoin n'est relu en entier que par l'extension (« Mes annonces », ou sa relecture de fond 6 h) :
  le « relu ✓ » Leboncoin arrive à la vérification suivante après cette lecture (« Revérifier »).

## Preuves
- `node scripts/audit-retirer-ailleurs.cjs` : **41/41** ; exécute la VRAIE règle sur la VRAIE
  `articlesVendusAilleurs`. 50 articles au même titre sur Vinted/Leboncoin/eBay ⇒ seul le N° vendu ;
  Vinted jamais appelé ; Vestiaire à faire ; lecture de 30 h, état pas confirmé ⇒ « vérifier » ; N°
  porté par deux paires ⇒ rien ; deux annonces sous le N° ⇒ « vérifier » ; extension absente ⇒
  Leboncoin à la main ; refus ⇒ ce site s'arrête ; `continuer()` faux ⇒ rien ; « relu » exige une
  lecture complète du site APRÈS. `--prouve` : **18/18 mutations** rouges. Sur `origin/main` :
  règle absente + 6 rouges sur 7.
- Banc `scripts/bancs/retirer-ailleurs.cjs` (harnais `nouveau-vendeur`, extension et route eBay
  simulées, port 9676, 390 tactile et 1512) — résultats ci-dessous.
- `journee-coherence` vert (il avait rougi 4 fois sur une première version : la feuille redisait les
  annonces — corrigé).

## Reste
- Lecteurs d'e-mail de vente Leboncoin / eBay (aucune forme reçue) : la notif serveur ne part que
  pour une vente Vinted ou Vestiaire apprise par e-mail ; les autres se voient app ouverte.
- Vestiaire : pas de voie de retrait (ni d'URL d'annonce rangée : le lien ouvre Vestiaire).
