# 13 nov. (soir) — La vente Vestiaire captée juste sur Orion (iPhone) — extension 5.374.0

Branche `claude/vestiaire-vente-orion` (depuis `origin/main` 1fd4c452). Pas de PR.

Plainte de Julien (13 nov. soir) : « l'extension a mal capté la vente de Vestiaire Collective sur
Orion sur mon iPhone, je veux que ça soit mieux ».

## 1. Ce qui a été mesuré (lecture seule, base de Julien, 13 nov. vers 22 h)

Rien de personnel n'est recopié ici (ni identifiant d'article, ni montant d'une autre vente que
celle du 2 nov. déjà décrite dans `historique-vestiaire.md`).

| ligne | ce qu'elle dit |
|---|---|
| `ext_appareil_*` | trois appareils. Un seul a un flux **Vestiaire** : `nav: orion`, `paquet: orion`, version **5.368.0**, dernier succès Vestiaire le 13 nov. à 21:35:09 (Orion se déclare « mac » : c'est l'iPhone). Les deux autres (Chrome 5.329, Orion 5.336) n'ont jamais lu Vestiaire depuis. |
| `vc_messages` | `compteur` écrit le 13 nov. 21:35:09 (la même seconde que l'appareil Orion) ; `conversations` du fil des notifications relues le 12 nov. ; activité sur deux articles mis en ligne APRÈS le 2 nov. (absents de `vc_listings`). `compte` vide partout. |
| `vc_ventes` | **une seule vente, celle du 2 nov.** ; `capturedAt` et `lectures` du **2 nov. 20:00** : aucune vente n'a été lue depuis — ni par l'iPhone, ni ailleurs. |
| `vc_listings` | figé au 2 nov. (3 articles) ; `compte` vide. |
| `vc_session` | **n'existe pas** : aucun compte Vestiaire n'a jamais été rangé. |
| `vc_recon` | `vuAt` 13 nov. 21:35 (Orion) : l'iPhone voit bien passer des requêtes Vestiaire. |
| `vc_brut_*` (gardés par la 5.315, avant sa coupure du 6 nov.) | les formes exactes de « Mes ventes » (`/ots/sales`) et « à expédier » (`/users/me/awaiting-shipping-items`) du 2 nov., et la page `__NEXT_DATA__`. |

### Ce qui était mal capté — quatre défauts

1. **La vente récente est ABSENTE.** Depuis le 3 nov., seul l'iPhone (Orion) passe sur Vestiaire ;
   il range le fil des notifications et le compteur, jamais une vente. VRM ne montre donc que la
   vente du 2 nov. (preuve : `vc_ventes.capturedAt` = 2 nov. alors que l'appareil Orion a lu
   Vestiaire le 12 et le 13 nov.).
2. **La date de vente est l'heure d'une VISITE.** La vente du 2 nov. est rangée « 2026-11-02
   21:00:32 » ; Vestiaire dit `soldDate` « 2026-11-02 14:17:41 » dans « Mes ventes ». Mesuré dans
   la réponse « à expédier » gardée : son `soldDate` vaut « 2026-11-02 21:00:32 », **la seconde même
   de la lecture** (`vuAt` 20:00:32Z = 21:00:32 à Paris). La règle générale « première clé qui
   contient *date* » prenait ce champ, et chaque visite de « à expédier » redatait la vente
   (relue sur l'iPhone ce soir, elle aurait été « vendue le 13 nov. »).
3. **Aucun compte.** La page ne demande jamais `/users/me` : le compte connecté est servi DANS la
   page (`__NEXT_DATA__` → `props.pageProps.dehydratedState.queries[]`, requête `["user.user"]`,
   mesuré). `vc_session` n'a jamais été écrit, chaque vente porte `compte: ''`, et l'import de
   l'historique (qui exige le compte) n'a jamais pu servir.
4. **Une date sans fuseau.** « 2026-11-02 14:17:41 » est l'heure de Paris ; rangée telle quelle,
   le serveur (UTC) la lisait une heure trop tard (deux en été), et `Date.parse` de WebKit (Safari,
   Orion) ne garantit pas cette forme : sur l'iPhone, le capteur pouvait la jeter en silence (il
   la validait par `Date.parse`).

## 2. Pourquoi (la cause sur Orion iPhone)

- Sur Chrome, `vc-inject.js` est posé par le manifeste (monde MAIN, `document_start`) **avant** la
  page : il voit passer `/ots/sales` et `/awaiting-shipping-items`.
- Le paquet Orion (MV2, pas de monde MAIN) le posait par une **balise `<script src>`** : chargée
  plus tard, après les premières requêtes de la page. Les requêtes faites au chargement de « Mes
  ventes » (la liste des ventes) passaient AVANT lui ; celles qui reviennent au fil de l'eau (le
  compteur de notifications, le fil) étaient vues — exactement ce que la base montre.
  (`orion-main.js` posait déjà inject.js EN LIGNE pour Vinted depuis la 5.361, pas vc-inject.js.)
- Les réponses ont la même forme sur iPhone (même site Next.js, `deviceType` mobile, même API
  `apiv2`) : ce n'est pas une « forme inconnue » — rien n'a été vu.
- ⚠️ Non mesuré d'ici (le site est injoignable depuis la machine) : si la page mobile porte un jour
  les ventes dans `dehydratedState` au lieu de les demander, elles sont maintenant lues (voir 3.c).

## 3. La correction (extension 5.374.0)

a. **Paquet Orion** : `scripts/zip-extension.cjs` (`sourcesEnLigne`) copie aussi la source de
   `vc-inject.js` dans `orion-main.js`, qui la pose **EN LIGNE** à `document_start` (refusée par la
   page ⇒ la balise `src` comme avant). Le paquet refuse de se fabriquer sans elle.
   `scripts/tests/orion-base-validee.py` : ce changement est approuvé nommément (sources en ligne =
   inject.js + vc-inject.js du paquet, rien d'autre).
b. **Rattrapage** (`vc-inject.js`, `rattraperVentes`) : si le capteur arrive après la page (le
   minutage des ressources du navigateur, `performance`, dit qu'une liste de ventes a été demandée
   AVANT sa pose), il la relit **une fois**, à l'adresse EXACTE que la page a demandée — GET, `apiv2`
   de Vestiaire, deux adresses au plus par page, avec les en-têtes que la page vient d'envoyer
   (gardés en mémoire dans la page, jamais transmis). C'est la lecture de SES ventes sur SON compte
   dans SON onglet (§3 : « toute lecture sur ses propres données ») ; sur Chrome rien ne la
   déclenche. Échec ⇒ rien d'écrit, `vc_rattrapage_<source>_<code>` au diagnostic.
c. **La page** (`notePageVc`) : `__NEXT_DATA__` au chargement et `/_next/data/…json` à chaque
   changement de page : le compte (`user.user` → son `id` SEUL, jamais nom/e-mail/adresse) ⇒
   `vcmoi` source « page » ⇒ `vc_session` et `compte` de chaque vente (le fond n'accepte le compte
   que si l'onglet et la page disent le même, règle 5.299). Une requête dont la CLÉ nomme les ventes
   (`sales`, `sold`, `awaiting-shipping` ; ni `recap`, ni `status`, ni achats) est lue comme « Mes
   ventes », **partielle** (ni total, ni liste entière : rien ne sort de « à expédier ») ; forme
   inconnue ⇒ `vc_ventes.forme['inconnu-page-…']`, rien d'écrit, aucune lecture datée.
d. **La date** : « Mes ventes » → `soldDate` (sinon `orderConfirmationDate`) ; « à expédier » → le
   JOUR de `orderConfirmationDate` seulement (« November 13, 2026 » ⇒ `2026-11-13`). Lue chiffre
   par chiffre (`dateLue`, plus de `Date.parse`). Le fond (`dateVcIso`) pose le fuseau de Paris à
   cette date (`…T14:17:41+01:00`, `+02:00` l'été) ; `dateVenteVcRangee` : une date de « Mes
   ventes » gagne toujours, le jour de « à expédier » ne remplit qu'un vide, une date rangée avant
   la 5.374 (sans `dateDe`) cède à toute date sûre, et une extension d'avant qui enverrait encore le
   `soldDate` de « à expédier » (sans `dateCle`) ne date rien.
e. **Lecture partielle** : n'écrase plus une lecture ENTIÈRE dans `vc_ventes.lectures` (la lecture
   entière garde sa date et son « complet », la partielle est datée à côté `partielleAt`, lue par
   « lues il y a… » de Ventes · Vestiaire).
f. **L'argent, inchangé et juste** : ce que Vestiaire verse = `sellerEarning` (`montant`, compté) ;
   `sellerPrice` est le PRIX de vente (`prixVente`, frais = différence). ⚠️ La consigne disait « ce
   que le vendeur reçoit (`sellerPrice`) » : c'est l'inverse (corrigé le 11 nov.,
   `2026-11-11-ventes-vestiaire.md`), rien n'a été changé là. Clé non lue ⇒ « montant pas sûr »
   comme avant. Identité : `productId` (un article Vestiaire ne se vend qu'une fois ; c'est la clé
   de `vc_ventes` depuis la 5.237, et celle de l'e-mail de vente) — `/ots/sales` ne porte aucun
   autre n° de commande.
g. **L'app** : `tempsVc` (`api/_lib/vestiaire-regle.js`) lit une date sans fuseau à l'heure de Paris
   (lignes rangées avant la 5.374 ; serveur en UTC, Safari) ; `dateVenteVc` et `dateCourteVc` s'en
   servent (affichée à l'heure de Paris).
h. Version **5.374.0** partout (`CODE_VERSION`, manifeste, `EXT_ATTENDUE`, `lbc-inject`/`lbc-relay`,
   `public/extension-version.json`, notice Orion) ; `EXT_CAPACITES.vcventeorion` et `vcventedate`
   (5.374.0 ; `audit-coherence` FONCTIONS : `vc-inject.js:rattraperVentes`, `dateVenteVcRangee`) ;
   zips Chrome (`VRM-extension.zip`) et Orion (`VRM-Orion.xpi/.zip`, `VRM-Orion-dossier.zip`,
   un dossier chacun) régénérés.

## 4. Preuves

- `node scripts/audit-vc-vente-orion.cjs` : **37 verts** — VRAI vc-inject.js + vc.js + background.js
  (`scripts/_vc-vente-orion.cjs`, `_fond-vm.cjs`), réponses de la forme mesurée (valeurs inventées),
  page « ordinateur » (capteur avant la page) ET « Orion » (capteur après la page, `Date.parse` de
  WebKit qui refuse « AAAA-MM-JJ HH:MM:SS »), mobile (ventes portées par la page) : O1-O13 (vente
  rattrapée, date, versé, prix, compte, une lecture par adresse, deux au plus, rien relu sur
  ordinateur, rien de personnel), D1-D7 (date de « Mes ventes », « à expédier » ne redate pas, jour
  seul, été), C1-C3 (compte de la page, rien d'inventé sans lui), P1-P7 (partielle, forme inconnue,
  recap/status écartés, rien retiré de « à expédier », lecture entière gardée), X1-X2 (extension
  d'avant, date d'avant), K1-K2 (paquet Orion en ligne), A1-A2 (Paris côté app/serveur).
- Sur `origin/main` (git archive 1fd4c452, audit copié DEDANS) : **27 rouges** (dont O1 vente absente
  sur Orion, D2 date écrasée par « à expédier », C1 aucun compte, K2 balise `src`).
- `--prouve` : **20/20 mutations** rougissent (capteur, relais, fond, paquet, règle de l'app).
- Banc `scripts/bancs/vestiaire-vente-orion.cjs` (390 tactile / 1512, clair / sombre) : la base reçoit
  ce que le VRAI code de l'extension range en jouant la page d'Orion, puis l'écran Ventes · Vestiaire
  est mesuré (ligne datée du 13 nov., frais 6,29 €, fiche Prix 209,52 · Frais −6,29 · Pour toi
  203,23, « Vendue 13 nov. »). Résultats : voir la fin de ce fichier.
- Audits existants relancés, verts : voir la fin de ce fichier.

## 5. Le geste de Julien

1. Sur l'iPhone, dans **Orion** : ouvrir **https://vrm.center/VRM-Orion-dossier.zip**, l'ouvrir dans
   l'app **Fichiers** (ça donne un dossier `VRM-Orion`), puis dans Orion → Réglages → Extensions :
   retirer l'ancienne VRM et **installer depuis le dossier `VRM-Orion`** (la version dit 5.374.0).
2. Toujours dans Orion, connecté à Vestiaire : ouvrir **Mon compte → Mes ventes** (et l'onglet
   « Articles à expédier »), attendre deux secondes. La vente apparaît dans VRM → Ventes · Vestiaire,
   datée du jour de la vente, avec ce que Vestiaire te verse et ses frais.
3. Sur l'ordinateur (Chrome) : installer aussi la 5.374.0 (remplacer le dossier, ⟳).

## 6. Résultats (13 nov., sur la branche)

- `audit-vc-vente-orion` **37/37** ; `--prouve` **20/20** ; sur `origin/main` **27 rouges**.
- Banc `vestiaire-vente-orion` : **33 verts, 0 rouge** (390 tactile / 1512, clair / sombre) ; captures
  regardées (ligne « 13 nov. · à envoyer avant le 20 nov. · Frais Vestiaire 6,29 € (3 %) », fiche
  Prix / Frais / Pour toi, « Vendue 13 nov. »). Le même banc avec l'extension d'`origin/main` :
  **rouge** — la base ne reçoit aucune vente, l'écran dit « Pas encore lues : ouvre « Mes ventes »… ».
- Verts : `audit-capture-vc-lbc`, `audit-vestiaire-partout`, `audit-frais-vestiaire`, `audit-vc-prix`,
  `audit-vc-recon`, `audit-vc-messages`, `audit-vc-offres`, `audit-vc-conversations`,
  `audit-numeros-vestiaire`, `audit-lbc-vc-lecture`, `audit-vc-publier` (sa vente inventée d'octobre,
  forme « à expédier » avec `createdAt` : le JOUR en est gardé — jamais `soldDate`),
  `audit-vestiaire-email`, `audit-familles-extension`, `audit-robustesse-extension`,
  `audit-extension-navigateurs`, `audit-coherence`, `audit-extension-zip`, `audit-variables`,
  `audit-tdz`, `audit-identite`, `audit-safari` (après `npm run build`), `audit-secrets`,
  `audit-bilan-semaine`, `audit-marge-plateforme`, `audit-factures-autres`, `audit-traduction` ;
  `tests/orion-base-validee.py`, `tests/orion-garde-regression.py` (13), `tests/orion-paquet` (135),
  `tests/orion-injection` (8), `tests/orion-pont-canal`, `tests/orion-cors-reel` (23) ; bancs
  `frais-vestiaire` (20) et `vestiaire-plus` (54) verts. `npm run build` vert.

## 7. Reste (dit)

- La forme d'une page Vestiaire MOBILE n'a jamais été vue d'ici : si elle porte un jour les ventes
  dans `dehydratedState`, elles sont lues (partielles) ; sous une autre forme, `vc_ventes.forme`
  (`inconnu-page-*`, `requete-page-*`) le dira — à relire après le geste de Julien.
- La vente du 2 nov. garde sa date fausse (21:00:32) jusqu'à la prochaine lecture de « Mes ventes »
  (alors remplacée par 14:17:41, `dateDe: 'ventes'`) — le jour, lui, est juste.
- Si Vestiaire refuse aussi la relecture (rattrapage) sur l'iPhone : `vc_rattrapage_*` au diagnostic ;
  repasser par « Mes ventes » depuis un autre onglet de la page (requête au vol) devrait suffire — non prouvé sur l'appareil.
