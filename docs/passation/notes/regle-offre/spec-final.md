# Spécification finale — eBay : « une règle sur chaque annonce, et au-dessus ça accepte »

Version du 9 octobre 2026, après la revue contradictoire (37 critiques, §13).
Document AUTONOME : un agent la construit sans autre contexte que le dépôt et
`CLAUDE.md`. Tout ce qui n'est pas mesuré est marqué **[non mesuré]** ; ce qui
vient de la doc d'eBay est marqué **[doc]** (détail : `doc.md` du même dossier).
Les numéros de ligne cités sont ceux de la branche `worktree-wf_d62e1db4-b5c-1`
(HEAD `0623451`) : ils bougeront, chercher par le nom.

---

## 0. La demande, et ce qui est déjà décidé

Julien, 9 octobre, mot pour mot : « Je veux juste définir une règle sur chaque
annonce et à chaque offre au-dessus ça accepte ». Il répondait à « une offre
n'est jamais acceptée toute seule » (à propos d'eBay).

**Décision prise (ne pas la rouvrir)** : on la fait **sur eBay seulement**, avec
le **réglage natif d'eBay** (Offre directe / Best Offer) :
`Item.ListingDetails.BestOfferAutoAcceptPrice` (eBay accepte toute offre ≥ X) et,
en option, `Item.ListingDetails.MinimumBestOfferPrice` (eBay refuse toute offre
< Y). **C'est eBay qui accepte, pas VRM** : VRM ne fait que poser un seuil sur
l'annonce, sur SON clic. VRM n'appelle **jamais** une route d'acceptation
(`RespondToBestOffer`, négociation…).

**Vinted n'est PAS touché.** L'acceptation automatique y a été retirée le
5 octobre à sa demande (§3 de `CLAUDE.md`). Rien dans
`vinted-sync-extension/`, rien côté Vinted dans l'app, aucune entrée
d'`EXT_CAPACITES`, aucune version d'extension, aucun zip.
`scripts/audit-offres-auto.cjs` et `scripts/bancs/capacites.cjs` restent verts.

| | décision | précisée en |
|---|---|---|
| D1 | une règle PAR ANNONCE eBay : « eBay accepte toute offre dès X € » ; option « refuse sous Y € » (vide par défaut) ; poser un seuil active les offres si besoin | §2, §3 |
| D2 | tout part sur SON clic ; confirmation qui dit la conséquence ; retirer = un clic | §6.3, §6.4 |
| D3 | le serveur ne croit pas le navigateur (session, vendeur, compte eBay de l'annonce ; relit chez eBay avant ; refuse X ≥ prix, Y ≥ X, montants mal formés ; `confirme:true` ; sans `<Ack>` ⇒ incertain ; message d'eBay tel quel sans jeton ; relit après et range, rangement gardé) — **précisé** : le prix et la règle que Julien a VUS sont des gardes (`prixVu`, `attendu`), un seuil sous la moitié du prix exige une confirmation explicite (`sousMoitie`), la base est marquée AVANT l'écriture chez eBay | §3 |
| D4 | trois états par annonce : connue · aucune · pas su (+ une lecture trop ancienne vaut « pas su ») | §5 |
| D5 | carte : une ligne ou une porte, modification en place ; au-dessus de la liste, UNE fois, ce que ça engage (les deux fenêtres où eBay peut vendre sans que VRM le voie) + le geste « retrait automatique » s'il est éteint | §6 |
| D6 | « une règle pour toutes » : %, aperçu (arrondi en faveur du VENDEUR), prix d'achat signalé, vue respectée, paires vendues exclues, une par une, bilan complet | §7 |
| D7 | création : formulaire, brouillons, planificateur ; vide ⇒ XML strictement identique | §8 |
| D8 | rien sur Vinted ni dans l'extension ; CLAUDE.md : une section courte + précision au §3 | §11 |

---

## 1. Où travailler, sur quoi construire

- **Base** : la branche `worktree-wf_d62e1db4-b5c-1` (multi-comptes eBay :
  registre `ebay_comptes`, lignes suffixées `ebay_*_{clé}`, `resoudreCompte`,
  sélecteur « Tous les comptes / un compte », compte validé à chaque action).
  Elle n'est pas fusionnée et **une autre passe y corrige des défauts en ce
  moment** dans `/home/user/cancale-v67/.claude/worktrees/wf_d62e1db4-b5c-1`.
  ⇒ **Ne pas éditer ce dossier-là.** Créer son propre arbre :
  ```
  cd /home/user/cancale-v67
  git worktree add -b claude/regle-offre-ebay /home/user/cancale-v67/.claude/worktrees/regle-offre worktree-wf_d62e1db4-b5c-1
  ln -s /home/user/cancale-v67/node_modules /home/user/cancale-v67/.claude/worktrees/regle-offre/node_modules
  ```
  Avant de finir : relire `git log worktree-wf_d62e1db4-b5c-1` et **rebaser** sur
  son dernier commit (commiter AVANT toute manipulation de branche : `CLAUDE.md`,
  « j'ai détruit mon propre travail en voulant rebaser »).
- **Ne rien pousser, ne rien fusionner** dans `claude/project-review-nsk5su`, ne
  rien déployer. Aucun appel à eBay pour de vrai, aucune écriture en production.
- `npm run build` jamais pendant qu'un banc sert `dist/`.
- 12 fonctions `api/` au plus (`audit-fonctions-api.cjs`) : tout passe par des
  **actions** de `api/ebay.js`, aucun nouveau fichier dans `api/` (un fichier dans
  `api/_lib/` n'est pas une fonction).

### 1.1 Ce qui est mesuré sur sa base (9 octobre, lecture seule)
- **Un seul compte eBay relié** (le principal, ligne `ebay_tokens`), aucune ligne
  suffixée, pas de `ebay_comptes`, pas de `ebay_programmees`, pas de brouillon.
- **2 annonces actives** (`ebay_listings`) : `128086452103` « Nike Air Max 1
  Aquatone Bleu Taille 44 » à `"68.0"` et `128101592740` « Nike Air Max 1 Homme
  blanc bleu EU 44 … » à `"74.0"`, catégorie 15709 (Baskets homme), **SKU vide sur
  les deux** ⇒ reliées à aucune paire, aucun prix d'achat connu pour elles.
- `ebay_orders` : **0 commande**, capturée le 8 octobre à 19:20 (Paris) — c'est
  la dernière fois que VRM a regardé ses ventes eBay.
- **Aucune donnée d'offre nulle part** : on ne sait PAS si l'Offre directe est
  déjà activée sur ces 2 annonces, ni si un seuil y est déjà posé à la main.
- Le prix rangé est une **chaîne** (`"68.0"`) ; la **devise n'est rangée nulle
  part** (la regex de `extraireItem` jette `currencyID`). VRM publie en
  `<Currency>EUR</Currency>`, site 71.
- Prix d'achat : 8 fiches sur 401 en portent un. `vrm_ebay_retrait_auto` est
  **absent** de `main` ⇒ éteint.

### 1.2 Ce que dit eBay (résumé de `doc.md`)
- Les seuils sont des champs d'annonce, posés par `AddFixedPriceItem` /
  `VerifyAddFixedPriceItem` / `ReviseFixedPriceItem` **[doc]**, dans
  `<ListingDetails>` ; l'Offre directe s'active par
  `<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>`.
- **Seul le vendeur voit les seuils** dans une réponse (`GetItem`)
  **[doc, W981]**. `GetMyeBaySelling` **ne les rend pas** ⇒ une annonce lue par
  cette seule liste a une règle « pas su ».
- `BestOfferDetails/BestOfferCount` = « le nombre d'offres faites sur l'objet »,
  absent s'il n'y en a aucune, rendu par `GetItem` **[W981]** (le TOTAL, pas
  celles en attente).
- Le seuil d'acceptation doit être **strictement sous le prix** (erreur 23004,
  **[tiers]**) ; le refus sous l'acceptation (21919263, **[tiers]**).
- Une offre **égale** au seuil est acceptée (« meets or exceeds », 3 sources
  sur 4) ; le refus porte sur ce qui est **strictement en dessous**.
- **Changer le prix d'une annonce peut faire tomber les seuils** (W981,
  `StartPrice` « for Revise calls ») — ou faire refuser le changement (23004).
  Ce que fait `ReviseInventoryStatus` (la voie de VRM) n'est **pas documenté** :
  VRM relit après, et ne dit jamais d'avance « eBay retire ».
- Retirer un seuil : `<DeletedField>Item.ListingDetails.BestOfferAutoAcceptPrice</DeletedField>`
  (frère de `<Item>`) **[doc actuelle]** — **absent de la liste blanche 2016 de
  `ReviseFixedPriceItem` : [non mesuré]**.
- Pas de « vérifier à blanc » pour `ReviseFixedPriceItem` : on relit après.
- Chaque `<Errors>` porte un `<ErrorClassification>` (`RequestError` = requête
  refusée, rien appliqué · `SystemError` = panne d'eBay, rien n'est prouvé)
  **[doc]**.
- Quota par défaut : 5 000 appels Trading / jour **pour toute l'application**.
- L'Inventory API (`bestOfferTerms`) ne sert pas : VRM est en Trading. Une seule
  voie d'écriture (§11 du dossier).

---

## 2. La règle, en une phrase (le vocabulaire)

Pour une annonce eBay en ligne, **sa règle d'offre** = `{ accepte, refuse }` :
- `accepte` (X) : eBay accepte, sans demander, toute offre **≥ X** ⇒ la paire est
  vendue à ce prix ;
- `refuse` (Y, facultatif) : eBay refuse toute offre **< Y** ;
- entre les deux (ou en dessous de X sans Y), l'offre arrive à Julien **sur eBay**
  (VRM ne capte pas les offres eBay reçues — il le dit, il ne promet rien).

Contraintes (une seule règle, `valideRegleOffre`, §3.2) : `0 < Y < X < prix`,
montants en euros, deux décimales au plus, `X ≤ 99 999,99`.

**Garde anti-faute de frappe** (une seule règle, `seuilTropBas`, §3.2) : un seuil
**sous la moitié du prix** (« 7 » au lieu de « 72 ») n'est accepté que s'il est
**confirmé explicitement** (`sousMoitie: true`), sur la carte, à la création et
côté serveur. Le geste groupé ne descend jamais sous 50 %.

**Un montant, pas un pourcentage** : ce qui part chez eBay est un montant fixe.
Il ne suit pas un changement de prix ; l'écran le dit au moment où le prix change
(§6.7).

À l'écran, le mot est **« règle d'offre »** ; la ligne de carte commence par
**« Offres reçues : »** (« Offres : » se confondrait avec le bouton voisin
« Faire une offre aux observateurs », qui est une offre ENVOYÉE).

⚠️ **Mots interdits dans `src/App.jsx`** (code sans commentaires, chaînes
comprises — `audit-offres-auto.cjs`, regex insensible à la casse
`accept\w*[^\n<>{}]{0,40}(automatiquement|tout(?:e)?\s+seule?)|acceptation\s+auto`) :
jamais « automatiquement » ni « tout seul / toute seule » dans les 40 caractères
qui suivent « accept… » sur la même ligne, jamais « acceptation auto… », jamais
« Min. accepté », jamais un champ `onCommit={…minPrice…}`. Les phrases de ce
document passent toutes ; **n'écrire « automatiquement » dans AUCUNE chaîne neuve**
(« retrait automatique » passe : pas de « -ment ») et **relancer l'audit après
chaque phrase ajoutée**. Les identifiants (`accepte`, `regleOffre`) passent.

---

## 3. Serveur — `api/ebay.js` (+ `api/_lib/ebay.js`)

### 3.1 Deux actions nouvelles dans `ACTIONS`

```js
regleoffre:     (ctx) => handleRegleOffre(b, ctx),
regleoffrelire: (ctx) => handleRegleOffreLire(b, ctx),
```
L'aiguillage existant fait déjà, AVANT le handler : session (`vendeurExige`,
401), base non cloisonnée ⇒ seul `VRM_OWNER_UID` (403), abonnement coupé (402),
clés eBay (503), compte eBay `resoudreCompte(b.compte, owner)` (400 clé mal
formée · 404 inconnue · 409 déconnectée · 503 registre illisible). Les handlers
reçoivent `ctx = { owner, compte }` et n'utilisent QUE `jetonDe(ctx)` et
`ligneDe(base, ctx)`.

### 3.2 Les règles partagées app ↔ serveur (§11)

Dans `api/_lib/ebay.js`, exportées (l'audit compare leurs sorties à celles de
l'app, comme `suffixeCompte`) :

```js
// La règle d'offre est-elle bien formée ? UNE règle, la même dans l'app
// (`valideRegleOffre` d'App.jsx) — l'audit compare leurs sorties.
// accepte : number | null (null = pas de règle d'acceptation)
// refuse  : number | null | undefined (undefined = « ne touche pas au refus »)
// prix    : number | null (null = pas encore connu : la route le relit chez eBay)
// Rend { ok:true, accepte, refuse } (montants arrondis au centime) ou
//      { ok:false, code, err }.
const MONTANT_MAX = 99999.99;
function montantOk(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MONTANT_MAX
    && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
}
function valideRegleOffre({ accepte, refuse, prix }) {
  if (accepte !== null && !montantOk(accepte)) return { ok: false, code: 'montant', err: 'Un montant en euros, par exemple 72 ou 72,50.' };
  if (refuse !== undefined && refuse !== null && !montantOk(refuse)) return { ok: false, code: 'refuse-montant', err: 'Le refus : un montant en euros, par exemple 50.' };
  const A = accepte === null ? null : Math.round(accepte * 100);
  const R = (refuse === undefined || refuse === null) ? refuse : Math.round(refuse * 100);
  if (A === null && R != null) return { ok: false, code: 'refuse-seul', err: 'Le refus va avec un montant d\'acceptation.' };
  if (A !== null && R != null && R >= A) return { ok: false, code: 'refuse', err: 'Le refus doit être sous le montant d\'acceptation.' };
  if (A !== null && prix != null && Number.isFinite(prix) && A >= Math.round(prix * 100)) return { ok: false, code: 'seuil-prix', err: `Ce montant doit rester sous le prix de l'annonce (${(prix).toFixed(2).replace('.', ',')} €) : eBay refuse une règle égale ou supérieure au prix.` };
  return { ok: true, accepte: A === null ? null : A / 100, refuse: R === undefined ? undefined : (R === null ? null : R / 100) };
}
// Un seuil sous la MOITIÉ du prix : la faute de frappe « 7 » au lieu de « 72 ».
// Il n'est accepté que confirmé explicitement (`sousMoitie: true`). En centimes
// entiers : 50 % pile n'est PAS « trop bas ».
function seuilTropBas(accepte, prix) {
  if (typeof accepte !== 'number' || !Number.isFinite(accepte) || typeof prix !== 'number' || !Number.isFinite(prix) || !(prix > 0)) return false;
  return 2 * Math.round(accepte * 100) < Math.round(prix * 100);
}
```
Les copies d'App.jsx sont **identiques** (mêmes noms, mêmes codes, mêmes
messages). Les montants partent en JSON **nombres** ; une chaîne (`"72"`) est
refusée (`montant`).

### 3.3 Une seule lecture de la règle dans un `GetItem` (§11)

`erreursTrading` lit en plus `classe: String(g('ErrorClassification')).trim()`
(`'RequestError'` · `'SystemError'` · `''`) dans chaque `<Errors>` — clé ajoutée,
rien d'autre ne change. Et, à côté :

```js
// La CLASSE d'un échec : 'refus' seulement si TOUTES les erreurs de sévérité
// Error sont des RequestError (eBay a refusé la requête : rien n'est appliqué).
// Une SystemError, une classe absente, ou pas d'erreur lisible : 'incertain'
// (eBay est peut-être tombé APRÈS avoir écrit).
function classeEchec(r) {
  const errs = (r && Array.isArray(r.erreurs) ? r.erreurs : []).filter((e) => e.severite === 'Error');
  return errs.length && errs.every((e) => e.classe === 'RequestError') ? 'refus' : 'incertain';
}
```

Dans `api/ebay.js`, à côté de `tradingGetItem` (utilise `conteneur`,
`lireBalise`, `ID_EBAY` existants) :

```js
// LA RÈGLE D'OFFRE D'UNE ANNONCE, lue dans la réponse d'un GetItem fait avec le
// jeton DU VENDEUR (seul lui voit les seuils — doc eBay). UNE lecture pour la
// synchro, la relecture après une pose, « Relire chez eBay », la relecture
// après un changement de prix et après une publication (§11).
// Rend null quand la réponse ne prouve pas qu'on a lu L'annonce entière (pas
// d'<Item>, autre ItemID, pas de prix, montant illisible) : « pas su », jamais
// « aucune ».
function montantXmlLu(src, t) {
  const m = new RegExp('<' + t + '(\\s[^>]*)?>([^<]*)</' + t + '>').exec(String(src || ''));
  if (!m) return { v: null, dev: '' };
  const n = Number(String(m[2]).trim());
  return { v: Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN, dev: ((/currencyID="([A-Z]{3})"/.exec(m[1] || '') || [])[1]) || '' };
}
function lectureRegleDe(xml, itemId) {
  const b0 = (/<Item>([\s\S]*)<\/Item>/.exec(String(xml || '')) || [])[1];
  if (b0 == null) return null;
  const blk = b0.replace(/<Variations>[\s\S]*?<\/Variations>/g, '');
  if (lireBalise(blk, 'ItemID') !== String(itemId)) return null;
  const ss = conteneur(blk, 'SellingStatus') || '', ld = conteneur(blk, 'ListingDetails') || '', bo = conteneur(blk, 'BestOfferDetails');
  let p = montantXmlLu(ss, 'CurrentPrice'); if (p.v == null) p = montantXmlLu(blk, 'StartPrice');
  if (p.v == null || Number.isNaN(p.v) || !(p.v > 0)) return null;     // pas de prix : réponse incomplète
  const a = montantXmlLu(ld, 'BestOfferAutoAcceptPrice'), r = montantXmlLu(ld, 'MinimumBestOfferPrice');
  if (Number.isNaN(a.v) || Number.isNaN(r.v)) return null;
  const en = bo == null ? null : (/<BestOfferEnabled>\s*true\s*<\/BestOfferEnabled>/i.test(bo) ? true : (/<BestOfferEnabled>\s*false\s*<\/BestOfferEnabled>/i.test(bo) ? false : null));
  const nb = bo == null ? null : (/<BestOfferCount>\s*(\d+)\s*<\/BestOfferCount>/.exec(bo) || [])[1];
  const deviseAnnonce = p.dev || lireBalise(blk, 'Currency') || '';
  return {
    lecture: { lu: true, offresActives: en, accepte: a.v, refuse: r.v, devise: a.dev || r.dev || deviseAnnonce, prix: p.v, offresFaites: nb == null ? null : Number(nb), lueA: Date.now() },
    annonce: { prix: p.v, devise: deviseAnnonce, type: lireBalise(blk, 'ListingType'), statut: lireBalise(ss, 'ListingStatus'), sku: lireBalise(blk, 'SKU') },
  };
}
// GetItem SANS DetailLevel ni OutputSelector : la doc dit que les seuils sont
// rendus dès « DetailLevel none » ; un OutputSelector mal écrit rendrait une
// annonce tronquée qu'on lirait « aucune règle » — on ne prend pas ce risque.
async function lireRegleOffre(token, itemId) {
  const r = await tradingCall(token, 'GetItem', `<ItemID>${itemId}</ItemID>`);
  if (sansAck(r) || !r.ok) return { ok: false };
  const l = lectureRegleDe(r.xml, itemId);
  return l ? { ok: true, ...l } : { ok: false };
}
```
⚠️ Ne PAS lire `BuyItNowPrice` comme prix (sur une annonce à prix fixe, eBay le
rend souvent à `0.0`). `<ConvertedCurrentPrice>` n'est pas attrapé (la regex
exige `<CurrentPrice` juste après `<`). `offresFaites` = `BestOfferCount` : le
TOTAL des offres faites, **jamais présenté comme « en attente »**.

```js
// La relecture APRÈS une écriture : eBay peut mettre un instant à montrer la
// révision [non mesuré]. Si la première relecture ne montre pas ce qui a été
// demandé, on attend puis on relit UNE fois. Délai lu dans
// process.env.EBAY_RELECTURE_MS (défaut 2000 ; l'audit le met à 20).
const cents = (v) => (v == null ? null : Math.round(Number(v) * 100));
// Trois issues : true (eBay montre la demande) · false (eBay montre autre chose)
// · null (montants conformes mais on ne sait pas si les offres sont actives).
function memeRegle(lu, demande, pre) {
  if (!lu) return null;
  if (demande.accepte === null) return lu.accepte == null && lu.refuse == null;
  const refAttendu = ('refuse' in demande) ? (demande.refuse == null ? null : demande.refuse) : (pre ? pre.refuse : null);
  if (cents(lu.accepte) !== cents(demande.accepte) || cents(lu.refuse) !== cents(refAttendu)) return false;
  if (lu.offresActives === true) return true;
  return lu.offresActives === false ? false : null;
}
async function relireApres(token, itemId, demande, pre) {
  let post = await lireRegleOffre(token, itemId);
  if (post.ok && memeRegle(post.lecture, demande, pre) === false) {
    await new Promise((ok) => setTimeout(ok, Number(process.env.EBAY_RELECTURE_MS) || 2000));
    const p2 = await lireRegleOffre(token, itemId);
    if (p2.ok) post = p2;
  }
  return post;
}
```

### 3.4 Le rangement : `ebay_offres{suffixe}`, lire-fusionner-réécrire GARDÉ

Une ligne **dédiée** par compte eBay (jamais `main`, jamais dans `ebay_listings`
— la synchro réécrit `ebay_listings` en entier, une règle rangée là serait
écrasée) :

```
id    : 'ebay_offres' + suffixe        (principal : 'ebay_offres' ; autre : 'ebay_offres_{clé16hex}')
owner : le vendeur de la session (portee/storeData existants)
data  : {
  items: {
    "<itemId>": {                                  // une lecture réussie chez eBay
      lu: true,
      offresActives: true | false | null,          // BestOfferEnabled ; null = absent de la réponse
      accepte: 72 | null,                           // BestOfferAutoAcceptPrice ; null = absent
      refuse:  60 | null,                           // MinimumBestOfferPrice ; null = absent
      devise:  "EUR",                               // currencyID du seuil, sinon devise de l'annonce
      prix:    80,                                  // le prix lu DANS LA MÊME réponse
      offresFaites: 2 | null,                       // BestOfferCount (total, pas « en attente »)
      lueA:    1760000000000,                       // l'heure de la RÉPONSE d'eBay
      par:     "sync" | "regle" | "relire" | "revise" | "publication"
    }
    | { lu: false, raison: "lecture-ratee" | "apres-ecriture" | "incertain" | "en-cours", lueA, par }
  },
  capturedAt: <ms>
}
```
Aucun jeton, aucune donnée d'acheteur.

```js
const REGLES_MAX = 300;
// Trois issues : true écrit · false écriture ratée · null pas su (la LECTURE de
// la ligne a échoué ⇒ RIEN n'est écrit : repartir d'un objet vide effacerait
// les règles lues des autres annonces — la famille « lecture KO, écriture OK »).
// ⚠️ Une entrée n'en remplace une autre que si elle est au moins aussi RÉCENTE
// (`lueA`) : une synchro lancée avant une pose ne réécrit pas, après elle, la
// lecture d'avant. Seule exception : `_force: true` (jamais rangé), posé par
// la requête qui a écrit le marqueur « en-cours » pour le remplacer.
async function rangerReglesOffre(ctx, lectures, garder) {
  const id = ligneDe('ebay_offres', ctx);
  const d = await lireDonnee(id, ctx.owner);
  if (d === undefined) return null;
  const items = { ...((d && d.items && typeof d.items === 'object' && !Array.isArray(d.items)) ? d.items : {}) };
  for (const [k, v0] of Object.entries(lectures || {})) {
    if (!ID_EBAY.test(k) || !v0 || typeof v0 !== 'object') continue;
    const { _force, ...v } = v0;
    const avant = items[k];
    if (!_force && avant && (Number(avant.lueA) || 0) > (Number(v.lueA) || 0)) continue;
    items[k] = v;
  }
  if (garder instanceof Set) for (const k of Object.keys(items)) if (!garder.has(k) && !(lectures && lectures[k])) delete items[k];
  const cles = Object.keys(items).sort((x, y) => (Number(items[y].lueA) || 0) - (Number(items[x].lueA) || 0)).slice(0, REGLES_MAX);
  return storeData(id, { items: Object.fromEntries(cles.map((k) => [k, items[k]])), capturedAt: Date.now() }, ctx.owner);
}
```
`lireDonnee` lit `select=data` : acceptable ici (ligne bornée à 300 entrées
d'environ 170 octets, ≈ 50 Ko au pire ; quelques centaines d'octets chez lui).

### 3.5 `handleRegleOffre` — poser, changer, retirer

**Requêtes** (le navigateur n'envoie JAMAIS de prix à appliquer ; `prixVu` et
`attendu` sont des GARDES : ce que Julien a vu quand il a confirmé) :
```
pose    : { action:'regleoffre', itemId, accepte:<nombre>, [refuse:<nombre|null>], prixVu:<nombre>, attendu:<objet|'inconnu'>, [sousMoitie:true], confirme:true, [compte] }
retrait : { action:'regleoffre', itemId, accepte:null, refuse:null, confirme:true, [compte] }
```
- `refuse` nombre ⇒ poser/changer le refus ; `refuse: null` ⇒ pas de refus (le
  retirer s'il existe) ; **clé absente** ⇒ garder le refus existant (§3.6 : il est
  RENVOYÉ, pas omis).
- `attendu` = la règle que l'écran affichait : `{ accepte: n|null, refuse: n|null }`
  (état « connue » ou « aucune »), ou `'inconnu'` (état « pas su »).
- `prixVu` = le prix de l'annonce affiché dans la confirmation (nombre).
- Retrait : `prixVu`, `attendu`, `sousMoitie` sont ignorés (retirer réduit le
  risque ; la règle peut avoir changé, on la retire quand même).

**Ordre — toutes les gardes avant le moindre appel d'écriture chez eBay :**

```
1.  b.confirme !== true                       → 400 { reason:'confirmation', error:'Confirme la règle d\'offre : rien n\'a été envoyé à eBay.' }   (zéro appel eBay)
2.  !ID_EBAY.test(itemId)                     → 400 { error:'annonce eBay invalide' }
3.  accepte absent du corps (undefined)        → 400 { reason:'montant', … }
    v = valideRegleOffre({ accepte, refuse: ('refuse' in b) ? b.refuse : undefined, prix: null })
    !v.ok                                     → 400 { reason: v.code, error: v.err }
    SI pose (accepte nombre) :
      prixVu pas un nombre fini > 0           → 400 { reason:'prix-vu', error:'Le prix affiché manque : rouvre l\'écran — rien n\'a été envoyé.' }
      attendu ni 'inconnu' ni { accepte: null|montantOk, refuse: null|montantOk }
                                              → 400 { reason:'attendu', error:'Je ne sais pas quelle règle tu voyais : rouvre l\'écran — rien n\'a été envoyé.' }
      seuilTropBas(accepte, prixVu) && b.sousMoitie !== true
                                              → 400 { reason:'sous-moitie', prix: prixVu, error:`${eur(accepte)}, c'est moins de la moitié du prix (${eur(prixVu)}) : confirme-le explicitement — rien n'a été envoyé.` }
                                              (toutes ces gardes : zéro appel eBay)
4.  at = await jetonDe(ctx); !at.ok           → at.status { reason: at.reason, error: at.error }
5.  L = await listeVendeur(at.token)
    !L.ok                                     → 503 { reason:'pas-su', error:'Je n\'ai pas pu relire tes annonces eBay — rien n\'a été envoyé.' }
    L.programmees has itemId                  → 409 { reason:'programmee', error: pose
                                                  ? 'Elle n\'est pas encore en ligne : pose la règle dans son brouillon avant de la programmer, ou quand elle sera en ligne.'
                                                  : 'Elle n\'est pas encore en ligne : annule sa programmation (le brouillon garde la règle, tu pourras la changer), ou retire la règle dès qu\'elle sera en ligne.' }
    !L.actives has itemId && L.complet        → 409 { reason:'pas-sur-ce-compte', compte: pseudo, error:`Cette annonce n'est pas en vente sur ton compte eBay ${nom} — rien n'a été envoyé.` }
    !L.actives has itemId && !L.complet       → 503 { reason:'pas-su', error:'Tu as plus de 1 000 annonces sur ce compte eBay : je n\'ai pas pu vérifier que celle-ci y est — rien n\'a été envoyé.' }
6.  pre = await lireRegleOffre(at.token, itemId)
    !pre.ok                                   → 503 { reason:'pas-su', error:'Je n\'ai pas pu relire l\'annonce chez eBay (prix, état) — rien n\'a été envoyé.' }
    !/^(FixedPriceItem|StoresFixedPrice)$/.test(pre.annonce.type)
                                              → 409 { reason:'format', error:'Ce n\'est pas une annonce à prix fixe : eBay n\'y propose pas d\'offres.' }
    pre.annonce.statut && pre.annonce.statut !== 'Active'
                                              → 409 { reason:'plus-en-vente', error:'Elle n\'est plus en vente sur eBay — rien n\'a été envoyé.' }
    pre.annonce.devise !== 'EUR'              → 409 { reason:'devise', error:'Annonce dans une autre devise que l\'euro : VRM ne pose pas de règle dessus.' }
 6b. pose && cents(prixVu) !== cents(pre.annonce.prix)
                                              → range { [itemId]: { ...pre.lecture, par:'regle' } } ;
                                                409 { reason:'prix-change', prix: pre.annonce.prix, lecture: pre.lecture,
                                                      error:`Le prix sur eBay est maintenant de ${eur(pre.annonce.prix)} (VRM affichait ${eur(prixVu)}) : rien n'a été envoyé. Revois le montant.` }
 6c. v2 = valideRegleOffre({ accepte, refuse, prix: pre.annonce.prix })   // LE PRIX D'eBAY, maintenant
    !v2.ok                                    → 409 { reason: v2.code, prix: pre.annonce.prix, error: v2.err }
 6d. Idempotence (aucune révision inutile : 250 révisions/jour/annonce chez eBay) :
    pose    : pre.offresActives === true && cents(pre.accepte) === cents(accepte) && (refuse absent || cents(pre.refuse) === cents(refuse))
    retrait : pre.accepte == null && pre.refuse == null
                                              → range { ...pre.lecture, par:'regle' } ; 200 { ok:true, inchange:true, verifie:true, lecture: pre.lecture, avertissements:[], range }
 6e. pose, la règle a changé depuis ce que Julien a vu :
    attendu objet && (cents(attendu.accepte) !== cents(pre.accepte) || cents(attendu.refuse) !== cents(pre.refuse))
                                              → range pre ; 409 { reason:'regle-changee', lecture: pre.lecture, error:'La règle sur eBay a changé depuis : {état lu en clair}. Rien n\'a été envoyé — revois-la.' }
    attendu === 'inconnu' && (pre.accepte != null || pre.refuse != null)
                                              → range pre ; 409 { reason:'regle-existante', lecture: pre.lecture, error:'eBay a déjà une règle sur cette annonce : {état lu en clair}. Rien n\'a été envoyé — dis-moi si tu la remplaces.' }
 6f. refuse clé absente && accepte != null && pre.refuse != null && cents(pre.refuse) >= cents(accepte)
                                              → 409 { reason:'refuse-existant', refuse: pre.refuse, lecture: pre.lecture, error:`eBay refuse déjà les offres sous ${eur(refuse)} : la règle doit être au-dessus. Rien n'a été envoyé.` }
7.  LE MARQUEUR, AVANT d'écrire chez eBay (la base ne doit jamais garder l'ancien
    état d'une annonce qu'eBay a peut-être changée) :
    m = await rangerReglesOffre(ctx, { [itemId]: { lu:false, raison:'en-cours', lueA: Date.now(), par:'regle', _force:true } })
    m !== true                                → 503 { reason:'note', error:'Je n\'ai pas pu le noter dans VRM — rien n\'a été envoyé à eBay. Réessaie dans un moment.' }   (zéro révision)
8.  L'écriture (XML §3.6) :  r = await tradingCall(at.token, 'ReviseFixedPriceItem', inner)
9.  Les issues — TOUJOURS une relecture, et toujours un rangement qui remplace le marqueur (_force) :
 9a. r.ok (Ack Success | Warning) :
     post = await relireApres(at.token, itemId, demande, pre.lecture)
     post.ok  → range { ...post.lecture, par:'regle', _force:true }
                200 { ok:true, verifie: memeRegle(post.lecture, demande, pre.lecture), lecture: post.lecture, avertissements: r.avertissements, erreurs: r.erreurs, range, compte: pseudo }
     !post.ok → range { lu:false, raison:'apres-ecriture', lueA, par:'regle', _force:true }
                200 { ok:true, verifie:null, lecture:null, avertissements: r.avertissements, range }
 9b. sansAck(r) || (!r.ok && classeEchec(r) === 'incertain')    // pas de réponse claire, ou panne d'eBay (SystemError, classe absente)
     post = await relireApres(...)
     post.ok && memeRegle(...) === true
              → range post ; 200 { ok:true, verifie:true, apresIncertain:true, lecture: post.lecture, avertissements: r.avertissements || [], range }
     post.ok (autre)
              → range post ; 504 { reason:'incertain', lecture: post.lecture, erreurs: r.erreurs,
                                    error:'eBay n\'a pas répondu clairement. L\'annonce montre aujourd\'hui : {état lu en clair}. Relis-la dans un moment avant de recommencer.' }
     !post.ok → range { lu:false, raison:'incertain', lueA, par:'regle', _force:true }
                504 { reason:'incertain', error:'eBay n\'a pas répondu clairement — je ne sais pas si la règle est posée. « Relire chez eBay » avant de recommencer.' }
 9c. !r.ok && classeEchec(r) === 'refus'        // RequestError : la requête est refusée, rien n'est appliqué
     post = await lireRegleOffre(at.token, itemId)       // une seule fois, sans attente
     range post.ok ? { ...post.lecture, par:'regle', _force:true } : { ...pre.lecture, par:'regle', _force:true }
     422 { reason:'refus', error: messageEbaySur(r.err) || 'eBay a refusé la règle — rien n\'a changé.', erreurs: r.erreurs, lecture: post.ok ? post.lecture : pre.lecture }
```
`demande` = `{ accepte, ...('refuse' in b ? { refuse: b.refuse } : {}) }`.
`eur(n)` = `n.toFixed(2).replace('.', ',') + ' €'`. « {état lu en clair} » =
`etatEnClair(lecture)` (une fonction, §11) : « eBay accepte dès 72,00 € · refuse
sous 60,00 € », « aucune règle », « offres activées, sans montant
d'acceptation », « offres coupées ».

Un écart (`verifie:false`) reste **200 `ok:true`** : eBay a dit « fait », ce qui
est rangé est ce qu'eBay montre, et l'écran dit l'écart. Cas typique (catégorie
qui n'accepte pas le seuil **[non mesuré]**) : eBay active les offres et ignore
le montant (Ack Warning) ⇒ relu `offresActives:true, accepte:null` ⇒ écart, que
l'écran dit en clair (§6.4).

Les messages renvoyés passent tous par `messageEbaySur` (aucun `Bearer …`, aucun
`v^1.1#…`, 300 caractères).

**Quota, compté honnêtement** : une pose = `GetMyeBaySelling` (1 page jusqu'à
200 annonces, 5 au plus) + `GetItem` + `ReviseFixedPriceItem` + `GetItem` (+1 sur
un écart) ⇒ **4 à 9 appels**. Le geste groupé est plafonné en conséquence (§7.3).

### 3.6 Le XML exact envoyé à `ReviseFixedPriceItem`

Montant : `montantXml(v) = (Math.round(v * 100) / 100).toFixed(2)`. `currencyID="EUR"`
toujours (une annonce non-EUR a été refusée à l'étape 6).

**Poser / changer** (`accepte` nombre) :
```xml
<Item><ItemID>{itemId}</ItemID>{BO}<ListingDetails><BestOfferAutoAcceptPrice currencyID="EUR">{X}</BestOfferAutoAcceptPrice>{MIN}</ListingDetails></Item>{DEL}
```
- `{BO}` = `<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>`
  **seulement si** `pre.lecture.offresActives !== true` (« si besoin », D1 ; eBay
  verrouille ce booléen quand des offres sont en attente **[doc]**).
- `{MIN}` = `<MinimumBestOfferPrice currencyID="EUR">{Y}</MinimumBestOfferPrice>`
  - si `refuse` est un nombre : Y = `refuse` ;
  - **si la clé `refuse` est ABSENTE et que `pre.lecture.refuse != null`** : Y =
    `pre.lecture.refuse` (le refus d'eBay est RENVOYÉ dans le même appel — l'article
    880 d'eBay : un `ListingDetails` envoyé sans lui peut le faire sauter, 21992) ;
  - sinon rien.
- `{DEL}` = `<DeletedField>Item.ListingDetails.MinimumBestOfferPrice</DeletedField>`
  si `refuse === null` (clé présente) ET `pre.lecture.refuse != null` ; sinon rien.

**Retirer** (`accepte: null`) :
```xml
<Item><ItemID>{itemId}</ItemID></Item><DeletedField>Item.ListingDetails.BestOfferAutoAcceptPrice</DeletedField>{DELMIN}
```
- `<DeletedField>…BestOfferAutoAcceptPrice</DeletedField>` si `pre.lecture.accepte != null` ;
  `{DELMIN}` = celui du refus si `pre.lecture.refuse != null`.
- On ne touche **pas** à `BestOfferEnabled` : retirer la règle, c'est « les offres
  t'arrivent, c'est toi qui décides », pas couper les offres.
- **[non mesuré]** : `DeletedField` sur ces chemins avec `ReviseFixedPriceItem`.
  Si eBay refuse, l'étape 9c rend son message tel quel (422) et l'écran dit
  « retire-la sur eBay (Voir sur eBay ↗) ». Aucun repli automatique.

### 3.7 `handleRegleOffreLire` — « Relire chez eBay »

Requête : `{ action:'regleoffrelire', itemIds:['…', …], compte? }` (1 à 20
identifiants, dédoublonnés).
```
ids invalides (pas un tableau, 0, > 20, un non-ID_EBAY) → 400 { reason:'annonces', error:'Liste d\'annonces eBay invalide (1 à 20).' }   (zéro appel)
jetonDe ; listeVendeur(token) KO                      → 503 { reason:'pas-su', … }   (RIEN n'est rangé)
aMoi = ids de L.actives ∪ L.programmees
pour chaque id (l'un après l'autre, jamais en parallèle) :
  id ∉ aMoi  → rendu[id] = { lu:false, raison: L.complet ? 'pas-sur-ce-compte' : 'pas-su' }   (pas rangé)
  sinon      → g = await lireRegleOffre(token, id)
               lecture = g.ok ? { ...g.lecture, par:'relire' } : { lu:false, raison:'lecture-ratee', lueA, par:'relire' }
               rendu[id] = lectures[id] = lecture
range = Object.keys(lectures).length ? await rangerReglesOffre(ctx, lectures) : true
200 { ok:true, lectures: rendu, range }
```
(La règle `lueA` de `rangerReglesOffre` s'applique : une relecture n'écrase pas
un marqueur posé après elle.)

### 3.8 La synchro (`handleSync`) lit la règle SANS appel de plus

`handleSync` fait déjà `tradingGetItem(token, itemId)` (`DetailLevel ReturnAll`)
pour les 20 premières annonces actives. `tradingGetItem` rend aussi
`_regle: lectureRegleDe(res.xml, itemId)` (même réponse, zéro appel de plus).
Dans la boucle :
```js
const lecturesRegle = {};
for (const it of lst.slice(0, 20)) {
  const d = await tradingGetItem(token, it.itemId);
  if (d && !d._err) {
    const { _regle, ...detail } = d;                 // ⚠️ la règle ne va JAMAIS dans ebay_listings (§11 : une ligne, un propriétaire)
    it.detail = detail; …
    lecturesRegle[it.itemId] = _regle ? { ..._regle.lecture, par: 'sync' } : { lu: false, raison: 'lecture-ratee', lueA: Date.now(), par: 'sync' };
  } else lecturesRegle[it.itemId] = { lu: false, raison: 'lecture-ratee', lueA: Date.now(), par: 'sync' };
}
```
Après l'écriture de `ebay_listings` (seulement si `liste.ok`) :
```js
const garder = liste.complet ? new Set([...lst, ...liste.programmees].map((x) => String(x.itemId))) : null;
const rangeRegles = (Object.keys(lecturesRegle).length || garder) ? await rangerReglesOffre(ctx, lecturesRegle, garder) : true;
```
Réponse : `lu.regles: rangeRegles === true` en plus. Une annonce au-delà de la
20ᵉ n'est pas lue : son entrée précédente reste (avec sa date, qui vieillit —
§5) — ou elle est « pas su ». **Aucune boucle de `GetItem` ajoutée.**

### 3.9 Le changement de prix (`handleRevise`) dit ce qu'il advient de la règle

`handleRevise` (ReviseInventoryStatus : prix/stock) ne peut pas porter les
seuils. Ce qu'eBay en fait n'est pas documenté (les effacer, les garder, ou
refuser le prix : 23004) : **on relit et on dit ce qu'on voit**. Ajouts,
**seulement quand `b.price` est fourni** :
1. `ligne = await lireDonnee(ligneDe('ebay_offres', ctx), ctx.owner)` →
   `avant = ligne === undefined ? undefined : ((ligne && ligne.items && ligne.items[itemId]) || null)` ;
   `aRegle = !!(avant && avant.lu === true && (avant.accepte != null || avant.refuse != null))`.
2. Si `aRegle` : marqueur `{ lu:false, raison:'en-cours', par:'revise', _force:true }`
   rangé AVANT l'appel ; ≠ `true` ⇒ **503 `note`**, aucun `ReviseInventoryStatus`.
   (Une annonce sans règle connue ne peut pas en GAGNER une par un changement de
   prix : pas de marqueur.)
3. `sansAck(r)` (504, inchangé) : si `avant` est un objet, ranger
   `{ lu:false, raison:'incertain', par:'revise', _force: aRegle }`.
4. `!r.ok` (422) : la réponse porte en plus `erreurs: r.erreurs` (le code 23004 se
   lit côté app). Si `aRegle` : relecture ; rangée si réussie, sinon
   `classeEchec(r) === 'refus' ? { ...avant, _force:true } : { lu:false, raison:'incertain', _force:true }`.
5. `r.ok` : `post = await lireRegleOffre(at.token, itemId)` (toujours, une seule
   fois) ; ranger `post.ok ? { ...post.lecture, par:'revise', _force: aRegle } : { lu:false, raison:'apres-ecriture', par:'revise', _force: aRegle }`
   (sans `_force`, la règle `lueA` s'applique) ; réponse
   ```
   200 { ok:true, ack, avertissements: r.avertissements, erreurs: r.erreurs,
         regle: { lecture: post.ok ? post.lecture : null,
                  tombee: aRegle ? (post.ok ? post.lecture.accepte == null : null)
                                 : ((avant && avant.lu === true) ? false : null),   // « pas su » ne devient jamais « pas tombée »
                  avant: aRegle ? { accepte: avant.accepte, refuse: avant.refuse } : null } }
   ```
Une modification de stock seul : rien de neuf (aucune lecture de `ebay_offres`,
aucun `GetItem`).

### 3.10 La création (D7) dans `itemXml`, `avecSku`, `publish`, `pubverify`, `programmer`

- `avecSku` : `propre = { ...it, scheduleTime: '', uuid: '', regleOffre: null }`
  (un `regleOffre` glissé par le navigateur est jeté, comme `scheduleTime`).
- Nouveau :
  ```js
  // La règle d'offre d'une NOUVELLE annonce (`item.offre`), validée par la
  // route contre le prix de l'item (l'annonce n'existe pas encore chez eBay).
  function regleDeItem(it0) {
    const o = it0 ? it0.offre : undefined;
    if (o === undefined || o === null) return { regle: null };
    if (typeof o !== 'object' || Array.isArray(o)) return { err: 'Règle d\'offre mal formée : rien n\'a été envoyé à eBay.' };
    const prix = Number(String(it0.price).replace(',', '.'));
    if (!Number.isFinite(prix) || !(prix > 0)) return { err: 'Règle d\'offre : le prix de l\'annonce est illisible. Rien n\'a été envoyé à eBay.' };
    const v = valideRegleOffre({ accepte: o.accepte === undefined ? null : o.accepte, refuse: o.refuse === undefined ? null : o.refuse, prix });
    if (!v.ok) return { err: 'Règle d\'offre : ' + v.err + ' Rien n\'a été envoyé à eBay.' };
    if (v.accepte != null && seuilTropBas(v.accepte, prix) && o.sousMoitie !== true) return { err: 'Règle d\'offre : moins de la moitié du prix, et pas confirmé. Rien n\'a été envoyé à eBay.', reason: 'sous-moitie' };
    return { regle: v.accepte == null ? null : { accepte: v.accepte, refuse: v.refuse == null ? null : v.refuse } };
  }
  ```
- `handleVerify`, `handlePublish`, `handleProgrammer` : juste après `avecSku`,
  `const ro = regleDeItem(it0); if (ro.err) return { status: 400, body: { ok:false, reason: ro.reason || 'offre', error: ro.err } };`
  puis `it = { ...s.item, regleOffre: ro.regle, … }` (AVANT tout appel eBay).
- `itemXml`, **juste avant** `(it.uuid ? '<UUID>…' : '')` :
  ```js
  (it.regleOffre
    ? '<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>'
      + `<ListingDetails><BestOfferAutoAcceptPrice currencyID="EUR">${montantXml(it.regleOffre.accepte)}</BestOfferAutoAcceptPrice>`
      + (it.regleOffre.refuse != null ? `<MinimumBestOfferPrice currencyID="EUR">${montantXml(it.regleOffre.refuse)}</MinimumBestOfferPrice>` : '')
      + '</ListingDetails>'
    : '')
  ```
  ⇒ `item.offre` absent ou `null` : **le XML est caractère pour caractère celui
  d'aujourd'hui** (preuve §9.3). Vérification à blanc et ajout passent par le
  même `itemXml` : le contrôle « même `<Item>` à l'UUID près » reste vrai.
- Après un `publish` / `programmer` réussi **avec** une règle : la réponse porte
  `offre: { envoyee: { accepte, refuse } }` ; pour `publish` seulement,
  `post = lireRegleOffre(token, itemId)`, rangé (`par:'publication'`, ou
  `{lu:false, raison:'apres-ecriture'}`), et `offre.verifie: true|false|null`
  (`memeRegle`), `offre.lecture`. Une programmée n'est PAS relue (lecture d'une
  annonce pas encore commencée **[non mesuré]**). Sans règle : aucun appel de plus,
  réponse inchangée.
- Les avertissements d'eBay sont déjà dans les réponses `pubverify` et `publish`
  (`avertissements`) : c'est l'app qui les ignorait (§8.1).

### 3.11 Ce que le serveur ne fait jamais
- Aucun appel `RespondToBestOffer`, aucune route de négociation qui accepte, aucun
  `bestOfferTerms` (Inventory). Les seuils ne s'écrivent QUE par
  `ReviseFixedPriceItem` (§3.6) et `itemXml` (§3.10).
- Aucune boucle de fond, aucun cron, aucune pose sans corps venu d'un clic.
- Il ne juge pas la vente Vinted (il ne lit pas les transactions) : comme pour
  `publish`, c'est l'app qui porte le verdict partagé (`numerosDejaVendus`,
  `doublesVenteEbay`) et refuse le geste (§6.2).

---

## 4. Multi-comptes eBay

- Chaque appel part avec `...corpsCompteEbay(it._compte)` : le compte **de
  l'annonce**, jamais celui de la vue ni le dernier compte de publication
  (`vrm_ebay_compte_pub`).
- Le serveur valide le compte (aiguillage existant) **puis** exige que l'annonce
  soit dans les annonces actives **de ce compte-là**, relues chez eBay avec SON
  jeton (§3.5 étape 5). Une annonce d'un autre compte ⇒ 409, zéro révision.
- Rangement dans `ebay_offres{suffixe}` du compte de l'annonce ; jamais dans la
  ligne d'un autre compte.
- L'app lit `lireEbayParCompte('ebay_offres', 'items:data->items,capturedAt:data->>capturedAt', comptesEbay)`
  (projection, §4.4) et indexe par `${compte.ref}:${itemId}` : une lecture n'est
  appliquée qu'à l'annonce du MÊME compte.
- « Relire chez eBay », « Relire mes ventes eBay » et le geste groupé : regroupés
  par compte, un compte après l'autre, chacun avec son `compte`.
- Le sélecteur ne change que ce qu'on voit : le bloc, la ligne « pas su » et le
  geste groupé portent sur `itemsVue` (§7).

---

## 5. Les trois états (D4) — une fonction, consommée partout (§11)

Dans `src/App.jsx`, au niveau module, près de `doublesVenteEbay` :

```js
// L'ÉTAT DE LA RÈGLE D'OFFRE D'UNE ANNONCE eBAY — trois états, jamais deux.
//   regles : Map(`${ref}:${itemId}` → entrée de `ebay_offres`) ; `illisibles` :
//   Set des refs de compte dont la ligne n'a pas pu être lue.
// Rend { etat:'connue', accepte, refuse, offresActives:true, offresFaites, lueA }
//    | { etat:'aucune', refuse, offresActives, offresFaites, lueA }
//    | { etat:'pas-su', raison, risque }
// `risque` : une règle peut être ACTIVE chez eBay sans que VRM le sache (la
// ligne « pas su » passe alors en E.warn ; sinon elle reste en E.muted).
const REGLE_ANCIENNE_MS = 30 * 86400000;
function etatRegleOffre(it, regles, illisibles, maintenant) {
  const now = Number.isFinite(maintenant) ? maintenant : Date.now();
  const ref = (it && it._compte) || 'principal';
  if (illisibles && illisibles.has(ref)) return { etat: 'pas-su', raison: 'illisible', risque: false };
  const e = regles && regles.get(ref + ':' + String(it && it.itemId));
  if (!e) return { etat: 'pas-su', raison: 'jamais', risque: false };
  if (e.lu !== true) { const r = e.raison || 'lecture-ratee'; return { etat: 'pas-su', raison: r, risque: r === 'incertain' || r === 'apres-ecriture' || r === 'en-cours' }; }
  const avaitRegle = e.accepte != null;
  if (e.devise && e.devise !== 'EUR') return { etat: 'pas-su', raison: 'devise', risque: false };
  const lueA = Number(e.lueA) || 0;
  if (!lueA || now - lueA > REGLE_ANCIENNE_MS) return { etat: 'pas-su', raison: 'ancienne', risque: avaitRegle };
  const p = Number(String(it.price == null ? '' : it.price).replace(',', '.'));
  // ⚠️ Un prix absent vaut 0 pour Number('') : on ne juge « prix changé » que
  //    sur un prix LISIBLE (> 0), sinon on montre l'état lu tel quel.
  if (e.prix != null && Number.isFinite(p) && p > 0 && Math.round(p * 100) !== Math.round(Number(e.prix) * 100)) return { etat: 'pas-su', raison: 'prix-change', risque: avaitRegle };
  const offresFaites = Number.isFinite(e.offresFaites) ? e.offresFaites : null;
  if (avaitRegle && e.offresActives === true) return { etat: 'connue', accepte: e.accepte, refuse: e.refuse, offresActives: true, offresFaites, lueA };
  if (avaitRegle && e.offresActives == null) return { etat: 'pas-su', raison: 'offres-inconnues', risque: true };
  return { etat: 'aucune', refuse: e.refuse, offresActives: e.offresActives, offresFaites, lueA };
}
```
- **« pas su » n'affiche aucun montant et ne dit pas « aucune »**, nulle part.
- Un montant gardé avec des offres COUPÉES (`offresActives === false`) ne joue
  pas : « aucune » (poser une règle réactive les offres).
- Les gestes posent un état LOCAL (Map `reglesLocales`, même clé) qui prime sur
  la ligne lue jusqu'au prochain chargement : la `lecture` rendue par la route
  quand il y en a une (succès, écart, 409 `prix-change`/`regle-*`, 422, 504 avec
  lecture) ; sinon `{ lu:false, raison:'apres-ecriture' }` (non relu) ou
  `{ lu:false, raison:'incertain', lueA: Date.now() }` (incertain). Un 422 SANS
  lecture ne change rien.
- Une 409 `prix-change` pose aussi le prix d'eBay dans `prixLocaux` (Map, même
  clé) : l'état se calcule sur `{ ...it, price: prixLocaux.get(cle) ?? it.price }`
  (sinon la carte resterait « prix changé » jusqu'à la synchro suivante).

Fonctions de l'app à ajouter (module, une seule fois chacune) :
- `valideRegleOffre`, `seuilTropBas` — copies EXACTES de §3.2.
- `etatEnClair(lecture)` — l'état lu en clair (§3.5), pour les messages d'écart,
  de 409 et d'incertain.
- `montantSaisi(s)` : `''` ⇒ `null` ; `/^\s*\d{1,5}([.,]\d{1,2})?\s*$/` ⇒ nombre ;
  sinon `NaN` (⇒ message « Un montant en euros… »).
- `seuilDePourcent(prix, pct)` — **arrondi au centime SUPÉRIEUR** (jamais sous le
  pourcentage qu'il a choisi ; l'arrondi à l'euro du dessous perdait jusqu'à
  3 points sur les petits prix, toujours au profit de l'acheteur) :
  ```js
  function seuilDePourcent(prix, pct) {
    const C = Math.round(Number(prix) * 100);
    if (!(C > 0) || !Number.isInteger(pct) || pct < 50 || pct > 99) return null;
    const X = Math.ceil(C * pct / 100);
    return (X > 0 && X < C) ? X / 100 : null;
  }
  ```
  (50 % pile ⇒ jamais `seuilTropBas`.)
- `prixCompatibleRegle(nouveauPrix, etat)` — UNE garde pour la carte (✏️) ET la
  baisse des paires qui dorment (§11) : `etat.etat === 'connue'` et
  `cents(nouveauPrix) <= cents(etat.accepte)` ⇒ `{ ok:false, msg:'Ta règle d'offre accepte dès 72,00 € : le prix doit rester au-dessus. Baisse ou retire d'abord la règle.' }` ;
  sinon `{ ok:true }`. « pas su » ne bloque pas (la route relit après).
- `resultatRegleOffre({ code, j })` — la règle des issues, pour la carte ET le
  geste groupé ; SIX issues :
  - `j.ok && j.verifie === true` ⇒ `ok` (`lecture`, `inchange`, `apresIncertain`) ;
  - `j.ok && j.verifie === false` ⇒ `ecart` (`lecture`) ;
  - `j.ok && j.verifie == null` ⇒ `non-relu` (`lecture` si présente) ;
  - `code === 409 && ['prix-change','regle-changee','regle-existante','refuse-existant'].includes(j.reason)` ⇒ `a-revoir` (`lecture`, `prix`, `msg`) ;
  - `code === 0 || !j || code === 504 || j.reason === 'incertain'` ⇒ `incertain` (`msg`, `lecture` si présente) ;
  - sinon ⇒ `ko` (`msg: j.error || 'eBay a refusé la règle — rien n'a changé.'`, `lecture` si présente).
  Et `nonNote: j && j.ok && j.range !== true` (eBay l'a fait, VRM n'a pas pu le noter).
- `achatParNum(fiches, buyByNum)` : Map N° (`cleNum`) → prix d'achat
  (`prixAchatDe`), **seulement si UNE seule fiche porte ce N°** (sinon absent :
  ambigu, rien n'est dit). Le prix d'achat ne se devine jamais. Sur la carte, la
  prop `achat` vaut : un nombre (connu) · `null` (paire reliée, prix pas saisi) ·
  `undefined` (pas reliée ou N° ambigu : rien n'est dit).
- `compterReglesEbay(comptesEbay, ref?)` : lit `ebay_offres{suffixe}`
  (projection `items:data->items`) du compte `ref` (ou de tous) et compte les
  entrées `lu === true && accepte != null && offresActives === true` ; rend un
  nombre, ou `null` si une ligne n'a pas pu être lue (§6.10).

---

## 6. L'écran eBay → Annonces (D5)

Peau `EBAY_SKIN` uniquement : `E.accent` (#3665F3) pour UN bouton principal,
`E.warn` pour ce qui demande un geste, `E.muted`, `E.text`. **Pas de vert, pas de
rouge** (ne pas recopier `INV_STATUS.online.color` ni `E.danger`). Tous les
champs à `fontSize: 16` (iOS ne zoome pas). Aux deux tailles : aucun
débordement horizontal (lignes en `flexWrap: 'wrap'`, titres en ellipse).

### 6.1 Lecture des règles et états dans `EbayAnnonces`
- États neufs (tous **avant** le premier `return` de `EbayAnnonces`,
  `if (baseKO) return …`) :
  `regles` (`undefined` en cours · `{ map: Map, illisibles: Set }`),
  `reglesLocales` (Map), `prixLocaux` (Map), `ventesEbayLues`
  (`undefined` · Map ref → `capturedAt` ms | `null` absente | `undefined` illisible),
  `enLot` (Set des itemIds du lot en cours), `lotInterrompu` (lu de
  `sessionStorage`, §7.5).
- Chargement dans `charger` (à côté de `ebay_listings`), même `comptesEbay` :
  `lireEbayParCompte('ebay_offres', 'items:data->items,capturedAt:data->>capturedAt', comptesEbay)` ;
  registre illisible ⇒ tous les comptes dans `illisibles` ; `ligne === undefined`
  ⇒ ce compte dans `illisibles` ; `null` ⇒ aucune entrée (⇒ « jamais »).
  La lecture des commandes devient
  `lireEbayTous('ebay_orders', 'orders:data->orders,capturedAt:data->>capturedAt', 'orders', comptesEbay)`,
  et `ventesEbayLues` se remplit de ses `lignes` (projection : rien de lourd).
- `buyByNum` : `React.useMemo(() => load('vinted_buyprice_by_num', {}) || {}, [nuage, items])`
  et `achats = achatParNum(fiches, buyByNum)` — **déclarés APRÈS `fiches` et
  `pris`** (§4.6 : un `useMemo` s'exécute tout de suite).
- `regleBloquee(it)` — fonction simple (pas un hook), déclarée après `dv`,
  `ventesConnues` et `surDeuxComptes` ; elle LIT le verdict que l'écran calcule
  déjà (§11), elle n'en écrit pas un second :
  ```js
  const regleBloquee = (it) => {
    const n = numDeSkuEbay(it && it.sku);
    if (!n) return null;            // pas reliée : la preuve de vente ne s'applique pas (le risque est dit à part, §6.5)
    const id = String(it.itemId);
    if (dv.aRetirerEbay.some((d) => String(d.annonce && d.annonce.itemId) === id)) return { k: 'vendue', t: 'Vendue sur Vinted : retire-la d\'eBay plutôt que d\'y poser une règle d\'offre.' };
    const ou = ventesConnues.vendus.get(n);
    if (ou) return { k: 'vendue', t: `Déjà vendue sur ${ou} : pas de règle d'offre sur une paire partie.` };
    if (surDeuxComptes.some((d) => d.numero === n)) return { k: 'deux-comptes', t: 'En vente sur deux de tes comptes eBay : retire l\'une des deux annonces d\'abord.' };
    if (ventesConnues.enCours || vendusVinted === undefined) return { k: 'en-cours' };
    if (ventesConnues.pasSu.length || vendusVinted === null) return { k: 'pas-su' };
    return null;
  };
  ```
  `en-cours` et `pas-su` sont communs à toutes les cartes reliées : leur phrase
  se dit **une fois** au-dessus de la liste (`data-regles-bloquees-commun`, avec
  la même énumération que `gardePublier` : « Je n'ai pas pu vérifier tes ventes
  Vinted ni … : pas de règle d'offre tant que je ne sais pas si la paire est déjà
  vendue. »). `vendue` / `deux-comptes` se disent sur la carte (ils distinguent).
- L'état de chaque annonce se calcule APRÈS `itemsVue` (fonction simple) :
  ```js
  const etatDe = (it) => {
    if (regles === undefined) return null;                       // en cours : ni ligne, ni bloc (pas de clignotement)
    const cle = ((it && it._compte) || 'principal') + ':' + String(it.itemId);
    const itP = prixLocaux.has(cle) ? { ...it, price: prixLocaux.get(cle) } : it;
    const l = reglesLocales.get(cle);
    return l ? etatRegleOffre(itP, new Map([[cle, l]]), null) : etatRegleOffre(itP, regles.map, regles.illisibles);
  };
  ```
- **Relire les ventes eBay quand une règle est posée** (eBay vend sans attendre
  VRM) : un effet, une fois par montage (`useRef`), quand `connected === true`,
  `regles` et `ventesEbayLues` sont lus : pour chaque compte RELIÉ qui a au moins
  une entrée `lu:true, accepte != null, offresActives:true` dans `regles.map` et
  dont `ebay_orders.capturedAt` est absent ou a plus de **6 h** (le seuil de
  l'onglet Compte eBay), `await resync(ref)` — l'un après l'autre. Aucune boucle,
  aucun autre déclencheur. Sans règle, rien ne change.

### 6.2 La ligne de la carte (`EbayAnnonceCard`, props neuves `regle`, `bloquee`, `achat`, `onRegle`, `enLot`, `prixAffiche`)

Sous la rangée de gestes existante (Relier / Offre aux observateurs), une ligne
`data-regle-offre-ligne={itemId}` portée par un élément
`data-regle-offre={etat}` (+ `data-regle-accepte="72.00"` et
`data-regle-refuse="60.00"|""` en état connu, `data-regle-raison={raison}` en
« pas su », `data-regle-bloquee={k}` si bloquée), 12,5 px :

| état | rendu | gestes |
|---|---|---|
| connue | `Offres reçues : eBay accepte dès 72,00 €` (+ ` · refuse sous 60,00 €`) (+ ` · lue il y a 10 j` si > 7 jours, `data-regle-age="10"`) | `Modifier` (`data-regle-modifier`) |
| aucune | (si un refus seul existe ET offres actives : `Offres reçues : eBay refuse sous 50,00 €`) | `Définir une règle d'offre` (`data-regle-ouvrir`) |
| pas su | `Offres reçues : —` (muted, aucun montant, jamais « aucune ») | `Définir une règle d'offre` (`data-regle-ouvrir`) |

- **Bloquée** (`bloquee` non nul) : `Définir` / `Modifier` sont **grisés, jamais
  cachés** (`disabled`). `vendue` / `deux-comptes` : la phrase `bloquee.t` sur la
  ligne (E.warn, 11,5 px). Et si la règle est **connue**, un bouton direct
  `Retirer la règle` (`data-regle-retirer-direct`) **reste actif** : retirer
  réduit le risque.
- `enLot === true` (l'annonce est dans un lot en cours, §7) : gestes de règle
  désactivés.
- La raison d'un « pas su » ne s'écrit PAS sur la carte (§7 : elle serait la même
  sur chaque carte) : elle est dans la ligne au-dessus de la liste (§6.6).
- Le prix à droite de la carte porte `data-ebay-prix="90.00"` et suit
  `prixAffiche` (= `prixLocaux` s'il existe, sinon `it.price`).

### 6.3 Le panneau en place (`data-regle-panneau={itemId}`)
Ouvert par `Modifier` / `Définir une règle d'offre` (ferme les panneaux Relier et
Offre de la même carte, comme eux entre eux). Fond `E.card2`, rayon 12.
- Texte (muted, 12 px) : « Prix de l'annonce : 90,00 €. Une offre égale ou
  supérieure au montant ci-dessous est acceptée par eBay sans te demander : la
  paire est vendue à ce prix. En dessous, l'offre t'arrive sur eBay. »
  (+ en « pas su » : « Règle actuelle : pas encore lue chez eBay — si elle existe,
  rien ne sera remplacé sans te le redemander. »)
- Prix illisible (`!(prixAffiche > 0)`) : « Prix de l'annonce pas lu — rouvre
  l'écran. » et `Enregistrer` désactivé (le serveur exige `prixVu`).
- Champ `Accepter les offres dès (€)` — `data-regle-saisie-accepte`,
  `inputMode="decimal"`, pré-rempli avec `accepte` (connue) sinon vide ;
  placeholder `montant en €`.
- Champ `Refuser les offres sous (€) — facultatif` — `data-regle-saisie-refuse`,
  pré-rempli avec le refus lu (connue ou aucune), sinon vide.
- Validation en direct (`montantSaisi` puis `valideRegleOffre` avec
  `prix = prixAffiche`) ; message `data-regle-erreur` (E.warn). `Enregistrer`
  désactivé tant qu'il y a une erreur ou que « accepte » est vide.
- **Sous la moitié du prix** (`seuilTropBas`) : une case
  `data-regle-sous-moitie` « Je fixe volontairement 7,00 € — 9 % du prix de
  l'annonce. » (E.warn) ; `Enregistrer` désactivé tant qu'elle n'est pas cochée ;
  elle se décoche à chaque changement du montant. Seule cette case pose
  `sousMoitie: true` dans le corps.
- **Prix d'achat** (`data-regle-achat`, trois issues) :
  `achat` nombre et `accepte < achat` ⇒ E.warn « C'est sous ton prix d'achat
  (85,00 €), avant frais eBay : une offre à ce montant te ferait vendre à perte. »
  (non bloquant) · `achat` nombre sinon ⇒ muted « Prix d'achat : 50,00 €. » ·
  `achat === null` ⇒ muted « Prix d'achat pas saisi (Vinted → Annonces → Coût
  d'achat). » · `undefined` ⇒ rien.
- `offresFaites > 0` (lu chez eBay) : muted « eBay compte 2 offres déjà faites
  sur cette annonce : si l'une attend encore ta réponse et atteint le montant,
  eBay peut l'accepter dès que la règle est posée. »
- Boutons : `Enregistrer la règle` (`data-regle-enregistrer`, E.accent) ·
  `Annuler` (`data-regle-annuler` : ferme, **n'envoie rien**) · si une règle
  existe (lu `accepte` ou `refuse` non nul) : `Retirer la règle`
  (`data-regle-retirer`).
- **Enregistrer** ⇒ `askConfirm` (feuille de l'app) :
  - titre : ``eBay acceptera seul les offres dès ${eur(X)} ?``
  - texte (lignes, seules celles qui s'appliquent) :
    1. ``« ${titre} » est à ${eur(prixAffiche)} sur eBay${plusieursComptes ? ` (compte ${nom})` : ''}. Toute offre de ${eur(X)} ou plus sera acceptée par eBay sans te demander : la paire sera vendue à ce prix, et l'acheteur devra la payer.``
    2. (état connue ou aucune) refus saisi : ``Toute offre sous ${eur(Y)} sera refusée par eBay.`` ; refus LU effacé : ``Le refus sous ${eur(ancien)} sera retiré.``
    3. `offresActives === false` : `Les offres seront activées sur cette annonce : les acheteurs pourront t'en faire.` · `offresActives == null` ou « pas su » : `Les offres seront activées si elles ne le sont pas déjà.`
    4. pas de N° : `Cette annonce n'est reliée à aucune paire : si eBay la vend, VRM ne saura pas quelle paire retirer de Vinted. « Relier à une paire » d'abord.`
    5. sous le prix d'achat : ``C'est sous ton prix d'achat (${eur(achat)}), avant frais eBay.``
    6. sous la moitié : ``C'est ${pct} % du prix de l'annonce — tu l'as confirmé.``
    7. `offresFaites > 0` : ``Une offre déjà faite peut être acceptée dès la pose.``
  - boutons : `Oui, poser la règle` / `Annuler`. **Annuler n'envoie rien.**
  - Oui ⇒ `appelEbay(...)` avec **exactement** (ordre des clés compris) :
    ``{ action:'regleoffre', itemId: String(it.itemId), accepte: X, [refuse], prixVu: prixAffiche, attendu, [sousMoitie: true], confirme: true, ...corpsCompteEbay(it._compte) }``
    - `refuse` : un nombre si saisi ; `null` si un refus LU a été effacé ; **clé
      absente** sinon (champ vide sans refus lu, ou état « pas su » — on ne retire
      jamais un refus qu'on n'a pas vu) ;
    - `attendu` : `{ accepte: lu ou null, refuse: lu ou null }` en connue/aucune ;
      `'inconnu'` en « pas su » ;
    - pour le principal, pas de clé `compte`.
- **Retirer** ⇒ un clic, pas de feuille (D2 : retirer rend la main, ça n'engage
  rien) : `{ action:'regleoffre', itemId, accepte:null, refuse:null, confirme:true, ...corpsCompteEbay(it._compte) }`.
- Pendant l'envoi : bouton « Envoi… », désactivé (jamais deux envois, même sur un
  double clic).

### 6.4 Après la réponse (`resultatRegleOffre`) — dit sur la carte (`data-ebay-info`)
Couleur du message **fixée** : `E.text` pour un ✓ sans réserve, `E.warn` pour
tout le reste (jamais le vert d'`INV_STATUS`, jamais `E.danger`). Un message qui
demande un geste **ne commence jamais par ✓**.

| issue | message | état local |
|---|---|---|
| ok, posée | `✓ eBay accepte maintenant les offres dès 72,00 €.` (+ ` Refus sous 60,00 €.` d'après `j.lecture`) | la lecture |
| ok, retirée | `✓ Règle retirée : les offres t'arrivent sur eBay, c'est toi qui décides.` | la lecture |
| ok `inchange` | `✓ C'était déjà la règle sur eBay.` | la lecture |
| écart, offres activées sans montant (`lecture.offresActives === true && accepte == null`) | `eBay a activé les offres mais n'a pas gardé le montant : les offres t'arrivent, c'est toi qui décides.` + avertissements | la lecture |
| écart, autre | `eBay a répondu « fait », mais l'annonce montre : {etatEnClair}. Regarde-la sur eBay.` + avertissements | la lecture |
| non relu | `eBay a répondu « fait », mais je n'ai pas pu le relire — « Relire chez eBay » plus haut.` | `pas-su` (`apres-ecriture`) |
| à revoir `prix-change` | le `error` de la route ; prix de la carte ← `j.prix` ; le panneau reste ouvert (`data-regle-prix-change`) | la lecture |
| à revoir `regle-changee` / `regle-existante` | ``eBay a déjà une règle : ${etatEnClair}. La remplacer par ${eur(X)} ? Enregistre à nouveau.`` (`data-regle-existante`) ; panneau ouvert, saisie gardée ; le prochain envoi porte `attendu` = cette lecture | la lecture |
| incertain | le `error` de la route (sinon : `eBay n'a pas répondu clairement — je ne sais pas si la règle est posée. « Relire chez eBay » avant de recommencer.`) | la lecture si présente, sinon `pas-su` (`incertain`) |
| refus | `error` de la route (le message d'eBay) ; pour un retrait refusé, ajouter ` Retire-la sur eBay :` + le lien existant `Voir sur eBay ↗` | la lecture si présente, sinon inchangé |

- `nonNote` ⇒ ajouter : `eBay l'a fait, mais VRM n'a pas pu le noter : « Relire chez eBay ».`
- Les avertissements d'eBay (`j.avertissements`) s'ajoutent : ``eBay signale : « … ».``
  — un code 21992 dans `j.erreurs` (sévérité Warning) s'écrit
  `eBay signale que le refus automatique a sauté.`

### 6.5 Le bloc « ce que ça engage », UNE fois au-dessus de la liste
Seulement si au moins une annonce de `itemsVue` est en état **connue** ; placé
juste au-dessus de la liste, après `data-ebay-non-reliees`
(`data-regles-engagement={n}`, E.warn sur le bord, comme `bloc(E.warn)`) :
1. « Règle d'offre active sur {n} annonce{s} : eBay accepte, sans te demander,
   toute offre à partir du montant fixé — une offre acceptée est une vente, au
   prix de l'offre. En dessous, l'offre t'arrive sur eBay. »
   (+ si k > 0 : « Dont {k} lue{s} il y a plus de 7 jours. »)
2. **Les deux fenêtres où eBay peut vendre sans que VRM le voie — TOUJOURS dites,
   que le retrait automatique soit allumé ou non** :
   - `data-regles-fenetre-ventes` : « eBay vend sans attendre VRM : VRM ne voit
     cette vente qu'en relisant tes ventes eBay — dernière lecture il y a {âge}. »
     L'âge = le plus ancien `capturedAt` des `ebay_orders` des comptes qui ont une
     règle connue (`data-regles-ventes-age-h={heures}`) ; absent ⇒ « pas encore
     lues » ; illisible ⇒ « je n'ai pas pu savoir quand ». Au-delà de 6 h, la
     phrase passe en E.warn. Bouton `Relire mes ventes eBay`
     (`data-regles-relire-ventes`) : `resync(ref)` sur ces comptes, l'un après
     l'autre ; « Lecture… » pendant.
   - `data-regles-fenetre` : « Si une de ces paires se vend sur Vinted, VRM ne la
     retire d'eBay que quand tu ouvres VRM et que la vente Vinted a été captée{ —
     et seulement si le retrait automatique est allumé : sinon c'est toi qui
     cliques}. Entre les deux, eBay peut encore accepter une offre ici. »
     Aucun délai n'est promis.
     Si `retraitAuto === false` : bouton séparé (élément à part : le texte d'un
     bouton ne doit pas suivre « accepter » dans la même chaîne)
     `Voir le retrait automatique` (`data-regles-vers-retrait`) qui **fait
     défiler** jusqu'à `[data-ebay-retrait-auto]` (il est PLUS HAUT, dans les
     alertes) et met le focus sur `[data-ebay-retrait-auto-bouton]` — **il
     n'allume rien** (allumer garde sa propre confirmation), aucune requête.
3. **Rien sur « pas reliée » ici** (§7 : la cause est déjà dite par
   `data-ebay-non-reliees`, la pastille de la carte et la ligne 4 de la
   confirmation). À la place, la phrase existante `data-ebay-non-reliees` gagne
   UN morceau quand k > 0 annonces non reliées de la vue ont une règle connue :
   « …et, pour {k} qui {a|ont} une règle d'offre, si eBay en vend une, VRM ne saura
   pas laquelle retirer de Vinted. » (`data-ebay-non-reliees-regles={k}`).
- Dans le bloc existant « vendue sur Vinted — encore en vente sur eBay »
  (`data-ebay-a-retirer`), la ligne d'une annonce dont la règle est connue ajoute
  « · elle a une règle d'offre : eBay peut la vendre à tout moment »
  (`data-ebay-doublon-regle`).

### 6.6 La ligne « pas su », UNE fois au-dessus de la liste
Seulement si au moins une annonce de `itemsVue` est en « pas su »,
`data-regles-pas-su={n}` et `data-regles-causes="jamais:1,prix-change:2"` (les
raisons brutes non nulles, dans l'ordre fixe `illisible, jamais, prix-change,
ancienne, offres-inconnues, lecture-ratee, apres-ecriture, incertain, en-cours,
devise`) :
- « Règle d'offre pas encore lue pour {n} annonce{s} ({causes}) » + bouton
  `Relire chez eBay` (`data-regles-relire`).
- **Couleur** : E.warn si au moins une de ces annonces a `risque === true` (une
  règle peut être active sans qu'on le sache) ; sinon E.muted — une fonction
  jamais touchée (« jamais lue » sur les annonces au-delà de la 20ᵉ) n'allume pas
  une alerte permanente.
- Causes (séparées par « · », une cause à zéro n'est pas écrite) : `jamais` ⇒
  « jamais lue » ; `prix-change` ⇒ « prix changé depuis la dernière lecture : la
  règle a pu tomber ou rester » ; `ancienne` ⇒ « dernière lecture il y a plus d'un
  mois » ; `offres-inconnues` ⇒ « offres activées ou non : pas lu » ;
  `lecture-ratee` / `apres-ecriture` / `incertain` / `en-cours` ⇒ « dernière
  lecture pas claire » ; `illisible` ⇒ « je n'ai pas pu relire ce que VRM en sait
  — rouvre l'écran » ; `devise` ⇒ « autre devise que l'euro ». **Jamais « eBay
  retire la règle »** (non mesuré).
- Le clic « Relire chez eBay » :
  - **désactivé tant que `comptesStatut === undefined`** (on ne sait pas encore
    quels comptes sont reliés) ; si `comptesStatut === null` : « Je n'ai pas pu
    vérifier tes connexions eBay — rouvre l'écran. », aucun envoi, et **aucun
    compte n'est dit « non relié »** ;
  - ne relit QUE les raisons qui se relisent chez eBay — pas `illisible` (la
    lecture qui a raté est la nôtre : « rouvre l'écran ») ni `devise` ;
  - **au plus 50 annonces par clic** ; au-delà : « 50 relues sur N — relance pour
    les suivantes » ;
  - pour chaque compte RELIÉ (`comptesRelies`) qui a des annonces à relire, par
    paquets de 20, l'un après l'autre :
    `{ action:'regleoffrelire', itemIds:[…], ...corpsCompteEbay(ref) }` ; applique
    `j.lectures` en local, puis relit `ebay_offres` ;
  - un compte qui n'a pas répondu est nommé : « eBay n'a pas répondu pour le
    compte {nom} — réessaie dans un moment. » ; un compte que `comptesStatut`
    déclare non relié est sauté et nommé ;
  - « Lecture… » pendant, bouton désactivé.
- Rien n'est relu tout seul à l'ouverture de l'écran (la synchro existante, au
  plus toutes les 6 h, lit déjà les 20 premières annonces sans appel de plus) —
  y compris les lectures anciennes : on garde « Relire chez eBay » sur son clic.

⚠️ Ne pas réutiliser `data-ebay-pas-su` (c'est la ligne « je n'ai pas pu lire tes
ventes », que `ebay-annonces.cjs` exige absente en marche normale). Aucune
phrase neuve ne contient « pas reliée », ni « pas d'observateur à qui
l'envoyer ».

### 6.7 Le changement de prix sur la carte (et la baisse des paires qui dorment)
- **Carte, `enregistrer` (✏️ Modifier le prix / le stock)** :
  - la clé `price` n'est envoyée **que si le prix a changé** (au centime) : changer
    le stock seul ne touche pas la règle ;
  - `prixCompatibleRegle(nouveau, etat)` refuse ⇒ rien n'est envoyé, son message ;
  - état **connue** : le panneau ✏️ rappelle, en direct, ``Ta règle d'offre :
    eBay accepte dès 72,00 € — ${pct} % du nouveau prix. Changer le prix peut la
    faire tomber : VRM la relit après et te le dit.`` (`data-regle-rappel`).
- **`resultatReviseEbay`** (UNE règle pour les deux endroits qui changent un
  prix) — en `ok`, d'après `j.regle` :
  - `tombee === true` ⇒ E.warn ``Prix changé — ta règle d'offre (dès ${eur(avant.accepte)}) n'est plus sur l'annonce eBay : repose-la si tu la veux (« Définir une règle d'offre »).`` ;
  - `lecture && lecture.accepte != null` ⇒ ``✓ Prix changé — ta règle d'offre reste à ${eur(a)} (${pct} % du nouveau prix).`` (E.text) ; si `seuilTropBas` ⇒ en plus `C'est moins de la moitié du prix : change-la si besoin.` et E.warn ;
  - `lecture == null && avant` (une règle était connue) ⇒ E.warn `Prix changé — je n'ai pas pu relire ta règle d'offre : « Relire chez eBay ».` ;
  - sinon `''` (la carte écrit `✓ Modifié sur eBay`, en E.text).
  - un avertissement 21992 ⇒ ` eBay signale que le refus automatique a sauté.`
  - en `ko`, un code **23004** dans `j.erreurs` ⇒ `eBay refuse ce prix : il doit
    rester au-dessus de ta règle d'offre. Baisse ou retire d'abord la règle.`
    (au lieu du message brut d'eBay, en anglais).
  - Il rend aussi `regleLecture` : la carte pose l'état local (la lecture, ou
    `pas-su`).
- **La baisse des paires qui dorment** (`Comptabilite`, `baisseEbayDe` /
  `baisserSurEbay`) suit la MÊME règle (§11) :
  - à côté d'`ebayVivantes`, lire `lireEbayParCompte('ebay_offres', 'items:data->items', …)`
    (même ouverture du panneau ; illisible ⇒ « pas su », rien ne bloque) ;
  - `baisseEbayDe` calcule l'état (`etatRegleOffre({ itemId, price: prixConnu, _compte: e.compte }, …)`)
    et, si `prixCompatibleRegle(sugg, etat)` refuse, ne propose **pas** la baisse :
    « Ta règle d'offre accepte dès X € : baisse-la ou retire-la d'abord (eBay →
    Annonces). » (`data-reprice-ebay-regle`) ;
  - en état connue, la feuille de baisse ajoute ``Ta règle d'offre (dès ${eur(X)})
    peut tomber avec le changement de prix : VRM la relit après et te le dit.`` ;
  - en `ok`, l'état garde `res.msg` (`fait.regleMsg`) et l'affiche à la place du
    « ✓ » quand il n'est pas vide (E.warn s'il ne commence pas par ✓).

### 6.8 L'offre aux observateurs, sous la règle
Dans le panneau « Faire une offre aux observateurs » de la carte : si l'état est
connu et que `prixRemise < accepte`, une ligne E.warn
(`data-offre-sous-regle`) : ``C'est sous ta règle d'offre (${eur(accepte)}) : si
l'une accepte, la paire part à ${eur(prixRemise)}.`` (la règle ne joue pas sur les
offres qu'il ENVOIE). Rien d'autre ne change dans ce panneau.

### 6.9 Les annonces programmées
- `EbayProgrammees` : sur la ligne d'une programmée dont le brouillon d'origine
  (`d.programme.itemId === itemId`) porte `offreAccepte`, afficher
  ``· offres dès ${eur(offreAccepte)}`` (`data-programmee-offre="66.00"`) — c'est ce
  que VRM a ENVOYÉ, dit comme tel (eBay ne la relit pas avant le départ).
- L'alerte « à annuler » (`data-ebay-a-annuler-paire`) : si son brouillon porte
  une règle, ajouter `· elle part avec une règle d'offre (dès 66,00 €)`
  (`data-ebay-a-annuler-offre`).
- Un retrait demandé sur une programmée reçoit le message propre au retrait
  (§3.5 étape 5).

### 6.10 Quand VRM ne suit plus le compte
- **Déconnecter un compte eBay** (`EbayConnexion`, `deconnecter`) : avant la
  feuille, `n = await compterReglesEbay(comptesEbay, ref)` ; la feuille ajoute
  - n > 0 : ``\n\n${n} annonce${s} de ce compte ${a|ont} une règle d'offre : eBay continuera d'accepter les offres dès le montant fixé, et VRM ne verra plus ces ventes. Retire les règles d'abord (eBay → Annonces) si tu ne veux plus vendre ainsi.`` ;
  - `null` : ``\n\nJe n'ai pas pu vérifier si des annonces de ce compte ont une règle d'offre : regarde eBay → Annonces avant.`` ;
  - 0 : rien.
- **Fermer mon compte** (Réglages → Mon compte) : la même phrase, comptée sur
  tous les comptes eBay (« Tes règles d'offre eBay (n annonces) restent posées
  sur eBay après la fermeture : … »), ou « je n'ai pas pu vérifier… ».

### 6.11 Ce qu'on ne touche pas
Relier, le retrait automatique (sauf le lien de §6.5), l'onglet Compte eBay (sauf
la feuille de déconnexion), tout Vinted.

---

## 7. « Une règle pour toutes » (D6)

Composant `EbayReglesToutes` (props : `items` = `itemsVue` (annonces EN LIGNE de
la vue), `etatDe`, `regleBloquee`, `achats`, `comptesEbay`, `plusieursComptes`,
`vueSeule`, `onRelire` (§6.6), `onLot` (pose/retire `enLot`), `onRegle`,
`onFini`). Porte : bouton `Une règle pour toutes` (`data-regles-toutes-ouvrir`),
visible si `connected === true` et `itemsVue.length > 0` ; **désactivé tant que
`regles === undefined`** (libellé « Lecture des règles… ») ; placé sur la ligne du
§6.6 si elle existe, sinon sous le bloc §6.5, sinon seul au-dessus de la liste.

### 7.1 Le panneau `data-regles-toutes`
- Texte : « Un pourcentage du prix de chaque annonce. Le montant est calculé
  maintenant, arrondi au centime supérieur, puis fixé : il ne suit pas un
  changement de prix. Rien ne part avant ta confirmation. »
- Champ `Accepter les offres dès … % du prix` (`data-regles-pct`,
  `inputMode="numeric"`), entier **50 à 99** ; sinon `data-regles-pct-erreur` :
  « Entre 50 et 99 % (en dessous, fixe le montant annonce par annonce). » et pas
  d'aperçu.
- Le refus n'est **pas** touché par ce geste (la clé `refuse` n'est pas envoyée ;
  le serveur RENVOIE le refus existant, §3.6).

### 7.2 L'aperçu `data-regles-apercu`, une ligne par annonce de la vue
`data-regles-ligne={itemId}`, `data-regles-statut`, `data-regles-seuil` (montant
à deux décimales, `""` si aucun). Colonnes : case (`data-regles-choix`), titre
(une ligne, ellipse), « 90,00 € → dès 81,00 € (90 %) » (le pourcentage RÉEL),
note, et le compte **seulement si la vue en mélange plusieurs**.

| statut | quand | case | note |
|---|---|---|---|
| `nouvelle` | état « aucune » | cochée (décochée si pas de N°) | sans N° : « sans paire reliée » (muted) |
| `remplace` | règle connue d'un AUTRE montant, nouveau PLUS HAUT | cochée | « remplace 70,00 € » |
| `remplace` | règle connue d'un AUTRE montant, nouveau PLUS BAS | **décochée** | « remplace 95,00 € — plus bas » |
| `inchange` | règle connue du MÊME montant | absente | « déjà 72,00 € » |
| `a-relire` | état « pas su » (sauf `devise`) | absente | « règle actuelle pas lue — relis-la d'abord » |
| `exclue` | `regleBloquee` non nul | absente | `vendue` : « vendue — retire-la d'eBay » · `deux-comptes` : « en vente sur deux de tes comptes » · `pas-su`/`en-cours` : « vente pas vérifiée » |
| `exclue` | `seuilDePourcent` rend null | absente | « prix trop bas » |
| `exclue` | un refus connu ≥ seuil | absente | « eBay refuse déjà sous 75,00 € : baisse d'abord ce refus » |
| `exclue` | « pas su » `devise` | absente | « autre devise que l'euro » |

- **Ordre de décision** (la première qui s'applique) : bloquée (`exclue`) · « pas
  su » `devise` (`exclue`) · autre « pas su » (`a-relire`) · `seuilDePourcent` nul
  (`exclue`) · refus connu ≥ seuil (`exclue`) · même montant (`inchange`) · autre
  montant (`remplace`) · sinon `nouvelle`.
- Au-dessus de l'aperçu, s'il y a des `a-relire` : bouton `Relire ces {k}
  annonces chez eBay` (`data-regles-toutes-relire`) — la même fonction que §6.6
  (mêmes bornes) ; l'aperçu se recalcule ensuite.
- En plus, sur une ligne cochable : prix d'achat connu et seuil < achat ⇒
  `data-regles-sous-achat` « sous ton prix d'achat (85,00 €) » (E.warn) —
  **signalé, pas décoché** (D6).

### 7.3 Appliquer
- Bouton `Appliquer à {n} annonce{s}` (`data-regles-appliquer`), n = cases
  cochées ; désactivé si n = 0 ; **au plus 25 par lot** (4 à 9 appels eBay par
  annonce, §3.5, sur un quota de 5 000 par jour pour TOUTE l'application) :
  au-delà, désactivé avec « 25 au plus à la fois : décoche-en, ou choisis un
  compte en haut. » ; désactivé aussi pendant un lot.
- `askConfirm` : titre ``Laisser eBay accepter les offres sur ${n} annonce${s} ?`` ;
  texte : ``Sur chacune, toute offre égale ou supérieure au montant affiché sera acceptée par eBay sans te demander : la paire sera vendue à ce prix.``
  puis, une ligne chacune, seulement si non nulle :
  - ``${k} remplace${k>1?'nt':''} une règle existante${j ? ` (dont ${j} plus basse${j>1?'s':''})` : ''}.``
  - ``${o} où les offres seront activées si elles ne le sont pas déjà.`` (`offresActives !== true`)
  - ``${s} sous ton prix d'achat (avant frais eBay).``
  - ``${p} sans prix d'achat saisi.`` (paires reliées, prix inconnu)
  - ``${r} sans paire reliée : si eBay en vend une, VRM ne saura pas laquelle retirer de Vinted.``
  - plusieurs comptes dans la sélection : ``Sur tes comptes ${nom} (${n1}), ${nom} (${n2}).``
  - ``VRM les règle une par une et te dit le résultat de chacune.``
  boutons `Oui, régler les {n}` / `Annuler` — **Annuler n'envoie rien**.
- Oui ⇒ **l'aperçu est FIGÉ** : `lot = lignes cochées.map(l => ({ itemId, compte, seuil, prixVu, attendu, titre }))`,
  copié ; la progression et le bilan ne lisent que `lot` (l'état local des
  cartes, la vue et `onFini` peuvent changer pendant le lot sans le fausser).
  `onLot(Set des itemIds)` désactive les gestes de règle de ces cartes.
- Puis **une par une** (`await` chaque appel avant le suivant, jamais
  `Promise.all`), dans l'ordre de l'aperçu, chacune avec SON compte :
  `{ action:'regleoffre', itemId, accepte: seuil, prixVu, attendu, confirme:true, ...corpsCompteEbay(it._compte) }`
  (pas de clé `refuse`, jamais `sousMoitie` : ≥ 50 % par construction ; `attendu`
  = la règle lue, l'aperçu n'envoie jamais un « pas su »).
- **En tête du panneau** (collant à 390 px : `position: sticky; top: 0`) :
  progression `data-regles-progres="i/n"` + bouton `Arrêter`
  (`data-regles-arreter`) : s'arrête après l'annonce en cours, le reste n'est pas
  envoyé ; puis le bilan, au même endroit.
- Chaque ligne affiche son issue (`resultatRegleOffre`) ; l'état local de chaque
  carte suit (`onRegle`).
- **Bilan** `data-regles-bilan` avec `data-regles-total`, `data-regles-ok`,
  `data-regles-ecart`, `data-regles-non-relu`, `data-regles-a-revoir`,
  `data-regles-incertain`, `data-regles-ko`, `data-regles-non-envoyees` — **leur
  somme vaut le total**, toujours :
  « {ok} sur {n} réglée{s}{ · e pas confirmée(s) par eBay}{ · x posée(s) par eBay
  mais pas relue(s) : « Relire chez eBay »}{ · r à revoir : la règle ou le prix a
  changé sur eBay}{ · i sans réponse claire d'eBay : relis-les}{ · ko refusée(s) :
  « {message d'eBay} » (×{nb}) …}{ · y non envoyée(s)} ». Les refus sont groupés
  par message. Seul `ok` (`verifie === true`) compte « réglée ». Puis relecture de
  `ebay_offres` (`onFini`) et `onLot(vide)`.

### 7.4 Démontage pendant le lot
- Un `ref` « vivant » (posé à `false` au démontage) arrête la boucle : plus aucun
  envoi après le démontage (changer de sous-onglet démonte `EbayAnnonces`).
- Les annonces non envoyées sont notées dans `sessionStorage`
  (`vrm_regles_lot_interrompu` = `{ n, at }`, lu et écrit en `try/catch`).
- À la réouverture : « Le dernier lot a été interrompu : {n} annonce{s} non
  envoyée{s}. Rouvre « Une règle pour toutes » pour les reprendre. »
  (`data-regles-lot-interrompu={n}`) + ✕ qui l'efface.

---

## 8. La création (D7)

### 8.1 `EbayPublier`, bloc « 4 — Prix & livraison »
- Sous la grille Prix / Quantité, deux champs (même style `inp`, `fontSize: 16`) :
  `Accepter les offres dès (€) — facultatif` (`data-publier-offre-accepte`) et
  `Refuser les offres sous (€) — facultatif` (`data-publier-offre-refuse`).
  `onChange` ⇒ `setCheck(null)` (comme le prix).
- Quand « accepte » est rempli : une ligne muted « eBay acceptera seul toute offre
  de ce montant ou plus : la paire sera vendue à ce prix. » ; erreur
  `data-publier-offre-erreur` (texte de `valideRegleOffre` contre le prix saisi).
- Sous la moitié du prix : case `data-publier-offre-sous-moitie` « Je fixe
  volontairement 7,00 € — 9 % du prix. » ; décochée à chaque changement du
  montant OU du prix.
- `brouillonCourant()` ajoute
  `offreAccepte: offreA.trim() || undefined, offreRefuse: offreR.trim() || undefined, offreSousMoitie: (tropBas && coche) || undefined`
  (⚠️ `undefined`, pas `''` : `{...avant, ...brouillonCourant()}` doit EFFACER une
  ancienne valeur, et `JSON.stringify` jette `undefined` ⇒ un brouillon sans
  règle garde exactement la forme d'aujourd'hui).
- Rouvrir un brouillon : `setOffreA(String(d.offreAccepte || ''))`,
  `setOffreR(String(d.offreRefuse || ''))`, case ← `d.offreSousMoitie === true`.
- `itemDeBrouillon(d)` (LA règle brouillon → annonce, §11), après le contrôle du
  prix :
  ```js
  const offreA = String(d.offreAccepte == null ? '' : d.offreAccepte).trim();
  const offreR = String(d.offreRefuse == null ? '' : d.offreRefuse).trim();
  let offre;
  if (offreA || offreR) {
    const a = montantSaisi(offreA), r = montantSaisi(offreR);      // null (vide) · nombre · NaN (illisible ⇒ refusé par valideRegleOffre)
    const prix = Number(String(d.prix).replace(',', '.'));
    const v = valideRegleOffre({ accepte: a, refuse: r, prix });
    if (!v.ok) return { err: 'Règle d\'offre : ' + v.err };
    if (v.accepte != null) {
      const bas = seuilTropBas(v.accepte, prix);
      if (bas && d.offreSousMoitie !== true) return { err: 'Règle d\'offre : moins de la moitié du prix — coche « je fixe volontairement » dans le brouillon.' };
      offre = { accepte: v.accepte, refuse: v.refuse == null ? null : v.refuse, ...(bas ? { sousMoitie: true } : {}) };
    }
  }
  return { item: { …comme aujourd'hui…, ...(offre ? { offre } : {}) } };
  ```
  ⇒ sans règle, l'`item` est **exactement** celui d'aujourd'hui (même clé de
  vérification `cleVerifEbay`, mêmes corps envoyés : les bancs existants restent
  verts). Le planificateur écarte déjà un brouillon dont `itemDeBrouillon` rend
  `err`, **avec sa raison**.
- `publier()` : si `b.item.offre` ⇒ **toujours** une confirmation (même avec un
  seul compte) : titre ``Publier, et laisser eBay accepter les offres dès ${eur(X)} ?`` ;
  texte : la ligne 1 de §6.3 adaptée (« Toute offre de … ou plus sera acceptée par
  eBay sans te demander : la paire sera vendue à ce prix. ») + le compte si
  plusieurs + les lignes 2 (refus), 4 (pas de N°), 5 (prix d'achat de la paire
  choisie, si connu) et 6 (sous la moitié) de §6.3 ; `Oui, publier` / `Annuler`
  (n'envoie rien). Sans règle : comportement d'aujourd'hui.
- Résultat : `j.offre.verifie === true` ⇒ ajouter au message de réussite
  « Règle d'offre : eBay accepte dès 66,00 €. » ; `false` ⇒ « eBay n'a pas gardé la
  règle d'offre — définis-la sur la carte de l'annonce. » ; `null` ⇒ « Règle
  d'offre pas encore relue. »
- **Les avertissements d'eBay se voient** : `verifier` garde
  `j.avertissements` dans `check` et les affiche sous les frais
  (`data-publier-avertissements`) ; `publier` les ajoute au résultat. (Aujourd'hui
  la route les rend et l'écran les jette.)
- « Vérifier sans publier » envoie l'`item` avec son `offre` : la vérification à
  blanc d'eBay l'emporte (catégorie qui n'accepte pas les offres ⇒ son message ou
  son avertissement, affiché).

### 8.2 Brouillons et planificateur
- `EbayBrouillons` : dans la ligne de méta d'un brouillon qui a une règle,
  `` · offres dès 66,00 €`` (`data-brouillon-offre="66.00"`).
- `EbayPlanificateur` : rien à changer dans l'envoi (`l.item` porte `offre` via
  `itemDeBrouillon`) ; la confirmation du lot liste, si k > 0 annonces du lot ont
  une règle, **chaque montant** :
  ``\n${k} avec une règle d'offre — eBay acceptera seul les offres dès :`` puis une
  ligne par paire ``« ${titre} » ${eur(prix)} → dès ${eur(X)} (${pct} %)${sousMoitie ? ' — moins de la moitié, confirmé dans le brouillon' : ''}``.
  Un brouillon sous la moitié et non confirmé est écarté par `itemDeBrouillon`,
  avec sa raison.
- Côté serveur, vérification à blanc ET ajout portent le même bloc (§3.10).

---

## 9. Les preuves attendues

Méthode de `CLAUDE.md` §6 : un contrôle doit être **rouge sur le code d'avant**
(`git archive worktree-wf_d62e1db4-b5c-1 | tar -x -C /tmp/avant-regle`, y copier le
script, le lancer DEPUIS cet arbre) **et** rouge quand on réaffaiblit la règle
(mutations nommées). « La fonction n'existait pas avant » ne suffit pas. Un
audit/banc **ne meurt pas, il rapporte** (`essaie` partout).

### 9.1 `scripts/audit-ebay-route.cjs` — la route EXÉCUTÉE (étendre, ne pas dupliquer)

`process.env.EBAY_RELECTURE_MS = '20'` en tête.

**Faux eBay à étendre** (données inventées) :
- `ERR(code, sev, msg, params, classe)` : 5ᵉ argument facultatif ⇒
  `<ErrorClassification>{classe}</ErrorClassification>` (les appels existants ne
  changent pas).
- `annonce(...)` accepte en `extra` : `regle: { actives: true|false|null, accepte: '70.0'|null, refuse: '50.0'|null, offresFaites: n|null }`,
  `type` (défaut `FixedPriceItem`), `statut` (défaut `Active`), `devise` (défaut `EUR`).
- `GetItem` : rend une annonce **complète** quand le jeton est celui du compte qui
  la possède : `ItemID`, `SKU`, `ListingType`, `Currency`,
  `<StartPrice currencyID>`, `<SellingStatus><CurrentPrice currencyID>…<ListingStatus>`,
  `<BestOfferDetails><BestOfferEnabled>{true|false}</…>[<BestOfferCount>n</…>]</BestOfferDetails>`
  (conteneur ABSENT si `actives === null`),
  `<ListingDetails><StartTime>…[<BestOfferAutoAcceptPrice currencyID="EUR">][<MinimumBestOfferPrice …>]</ListingDetails>`,
  `<Description>`. Annonce d'un AUTRE compte : même chose **sans** les deux seuils.
  Garder `mode.getitem === 'autre'` et l'émission du SKU/StartTime. Modes neufs :
  `mode.getitem = 'ko' | 'reseau' | 'tronque' | 'sans-bestoffer'` ;
  `mode.getitemApres = 'ko' | 'ancien-puis-nouveau'` (seulement les GetItem qui
  suivent une révision ; `ancien-puis-nouveau` rend l'état d'AVANT la révision au
  premier, le nouveau ensuite).
- `ReviseFixedPriceItem` : en plus de `ScheduleTime`, lit `BestOfferEnabled`,
  `BestOfferAutoAcceptPrice`, `MinimumBestOfferPrice`, chaque `<DeletedField>`, et
  les applique **seulement si l'annonce appartient au compte du jeton** (sinon
  `XML_ECHEC(ERR('21916590', 'Error', "Tu n'es pas le vendeur de cet objet (message inventé).", [], 'RequestError'))`).
  `mode.regle` :
  `'ok'` · `'refus-prix'` (`ERR('23004','Error','Invalid AutoAccept price. The Best Offer Auto Accept Price must be less than the Buy It Now price. Bearer at-J v^1.1#SECRET-QUI-FUIRAIT', [], 'RequestError')`, n'applique rien) ·
  `'warning-21992'` (applique l'acceptation, SAUTE le refus, Ack Warning + `ERR('21992','Warning','AutoDecline has been disabled or is no longer available.')`) ·
  `'warning-partiel'` (applique `BestOfferEnabled=true`, ignore les seuils, Ack Warning) ·
  `'503-apres'` (applique puis HTML 503) · `'503-avant'` (n'applique rien, HTML 503) ·
  `'reseau-apres'` (applique puis lève) ·
  `'failure-systeme-applique'` (applique puis Ack Failure `ERR('10007','Error','Internal error to the application.', [], 'SystemError')`) ·
  `'failure-systeme'` (n'applique rien, même échec) ·
  `'failure-sans-classe'` (n'applique rien, Ack Failure sans `ErrorClassification`) ·
  `'ignore'` (Ack Success, n'applique rien).
- `ReviseInventoryStatus` : applique le prix ; `mode.prix` : `'efface'` (défaut :
  le prix change ⇒ les deux seuils sont retirés) · `'garde'` (le prix change, les
  seuils restent) · `'refus-23004'` (échec 23004, `RequestError`).
- Base : `mode.offresKo` (la LECTURE de `ebay_offres*` répond 500) ;
  `mode.offresEcritureKo` (toute ÉCRITURE de `ebay_offres*` répond 500) ;
  `mode.offresEcritureKoApres` (la 1ʳᵉ écriture passe, les suivantes 500).
- Le journal commun (base + eBay) porte un numéro d'ordre `seq` (pour prouver
  « le marqueur AVANT la révision »).
- `remettre()` remet ces modes ; les annonces neuves ne sont ajoutées que DANS la
  section (`ebay['at-J'].actives.push(...)`).

Fixtures de la section (inventées) :
```
R1 = annonce('110000000301', 'Nike Air Max 1 bleu taille 44', 'VRM-41', '80.0', debut, { regle: { actives: false, accepte: null, refuse: null } })
R2 = annonce('110000000302', 'Adidas Samba blanc taille 42', 'VRM-42', '90.0', debut, { regle: { actives: true, accepte: '70.0', refuse: '50.0', offresFaites: 2 } })
R3 = annonce('110000000303', 'Salomon XT-6 noir taille 43', '', '120.0', debut, { type: 'Chinese' })
R4 = annonce('110000000304', 'Puma Suede gris taille 42', 'VRM-44', '60.0', debut, { statut: 'Completed' })
R5 = annonce('110000000305', 'Vans Old Skool noir taille 41', 'VRM-45', '50.0', debut, { devise: 'USD' })
R6 = annonce('120000000306', 'Asics Gel 1130 argent taille 39', 'VRM-46', '70.0', debut)   // sur le compte julien_pro (at-A2)
R7 = annonce('110000000307', 'New Balance 550 gris taille 44', 'VRM-47', '100.0', iso(Date.now() + 2*JOUR))   // PROGRAMMÉE sur at-J
```

**Contrôles neufs** (section « 12. LA RÈGLE D'OFFRE — c'est eBay qui accepte »),
chacun avec le compte d'appels chez eBay (`auCompte`). Corps de pose par défaut :
`{ action:'regleoffre', itemId, accepte, prixVu: <prix>, attendu: <état d'eBay>, confirme:true }`.

| # | situation | exigé |
|---|---|---|
| R-sess | `regleoffre`, `regleoffrelire` sans session | 401, zéro appel (ajouter les deux à `TOUTES`) |
| R-conf | `confirme` absent / `'true'` / `1`, pour une pose ET un retrait | 400 `confirmation`, zéro appel |
| R-id | `itemId` `'12a'`, `'110</ItemID><X>'`, `''` | 400 « annonce eBay invalide », zéro appel |
| R-mont | `accepte` 0, -5, `'72'`, 72.555, 1e9, absent ; `accepte:null` + `refuse:60` ; `refuse` ≥ `accepte` (60/60, 60/70) ; `refuse` 0 | 400 (`montant`, `refuse-seul`, `refuse`, `refuse-montant`), zéro appel |
| R-prixvu | pose sans `prixVu` / `prixVu:'80'` / `prixVu:0` ⇒ 400 `prix-vu`, zéro appel ; R1 relu à 120 (faux eBay changé après la synchro) avec `prixVu:80` | 409 `prix-change`, `prix: 120`, `lecture` rendue, appels `GetMyeBaySelling,GetItem`, **aucune** révision |
| R-sous-moitie | R1 (80), `accepte:7` sans `sousMoitie` | 400 `sous-moitie`, zéro appel ; avec `sousMoitie:true` ⇒ révision partie avec `7.00` ; `accepte:40` (50 % pile) sans drapeau ⇒ passe |
| R-attendu | `attendu` absent / `'x'` / `{accepte:'70'}` | 400 `attendu`, zéro appel ; R2 (70/50) + `attendu:{accepte:null,refuse:null}` + `accepte:75` ⇒ 409 `regle-changee`, `lecture.accepte === 70`, aucune révision ; R2 + `'inconnu'` + 75 ⇒ 409 `regle-existante`, aucune révision ; R1 (rien) + `'inconnu'` + 72 ⇒ passe ; R2 + `'inconnu'` + 70/50 ⇒ 200 `inchange` (l'idempotence passe avant) |
| R-prix | R1 à 80 : `accepte` 80 puis 80.01 | 409 `seuil-prix`, `prix: 80`, appels `GetMyeBaySelling,GetItem` ; 79.99 passe |
| R-pose | R1, `accepte` 72, `refuse` absent, `attendu:{null,null}` | appels `GetMyeBaySelling,GetItem,ReviseFixedPriceItem,GetItem` ; le corps de la révision contient **exactement** `<Item><ItemID>110000000301</ItemID><BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails><ListingDetails><BestOfferAutoAcceptPrice currencyID="EUR">72.00</BestOfferAutoAcceptPrice></ListingDetails></Item>` et aucun `DeletedField` ; 200 `ok`, `verifie:true`, `lecture.accepte === 72` ; ligne `ebay_offres` écrite owner J, `items['110000000301']` = lecture `par:'regle'` |
| R-marque | R-pose | dans le journal, l'écriture `ebay_offres` `{lu:false, raison:'en-cours'}` a un `seq` **inférieur** à celui de `ReviseFixedPriceItem` ; `mode.offresEcritureKo` ⇒ 503 `note`, **aucune** révision ; `mode.offresKo` ⇒ 503 `note`, aucune révision, ligne pré-remplie intacte |
| R-refus | R1, `accepte` 72, `refuse` 60 | `<MinimumBestOfferPrice currencyID="EUR">60.00</MinimumBestOfferPrice>` DANS `ListingDetails`, après l'acceptation |
| R-actif | R2 (offres actives), `accepte` 75, `refuse` 50, `attendu:{70,50}` | **pas** de `<BestOfferDetails>` dans le XML |
| R-idem | R2, `accepte` 70, `refuse` 50 | 200 `inchange:true`, **aucune** `ReviseFixedPriceItem` ; `mode.getitem='sans-bestoffer'` ⇒ l'idempotence NE joue PAS (offres non prouvées actives) |
| R-retrait | R2, `accepte:null, refuse:null` (sans `prixVu` ni `attendu`) | XML `<Item><ItemID>110000000302</ItemID></Item><DeletedField>Item.ListingDetails.BestOfferAutoAcceptPrice</DeletedField><DeletedField>Item.ListingDetails.MinimumBestOfferPrice</DeletedField>`, aucun `BestOfferEnabled` ; relu aucune ⇒ `verifie:true` |
| R-garde-refus | R2 (70/50), `accepte` 72, clé `refuse` ABSENTE, `attendu:{70,50}` | le XML contient `<MinimumBestOfferPrice currencyID="EUR">50.00</MinimumBestOfferPrice>` (RENVOYÉ) et aucun `DeletedField` ; `verifie:true` ; `mode.regle='warning-21992'` (le refus saute) ⇒ `verifie:false` et l'avertissement rendu ; R2 avec 80/75 chez eBay, `accepte` 72, clé absente ⇒ 409 `refuse-existant`, aucune révision |
| R-ack | `'503-apres'` (relecture OK) | 200 `ok`, `verifie:true`, `apresIncertain:true`, entrée = la lecture ; `'503-avant'` ⇒ 504 `incertain` avec `lecture` (l'ancienne), rangée ; `'503-apres'` + `getitemApres:'ko'` et `'reseau-apres'` + `getitemApres:'ko'` ⇒ 504, entrée `{ lu:false, raison:'incertain' }` — **jamais** 422, jamais l'ancienne lecture `lu:true` |
| R-systeme | `'failure-systeme-applique'` | **jamais** 422 « rien n'a changé » : 200 `ok`, `verifie:true`, entrée = relecture ; `'failure-systeme'` ⇒ 504 `incertain` + `lecture` ; `'failure-sans-classe'` ⇒ 504 (jamais « refusé ») ; `erreurs[*].classe` rendu |
| R-ebay-refus | `'refus-prix'` (RequestError) | 422, `erreurs[0].code === '23004'`, `classe === 'RequestError'`, `sansJeton(o)` vrai ; entrée finale = la relecture (`lu:true`, valeurs d'avant), **jamais** `en-cours` ; + `getitemApres:'ko'` ⇒ entrée = `pre` (`lu:true`, valeurs d'avant) |
| R-warning | pose avec refus, `'warning-21992'` | 200 `ok`, `avertissements` contient le message ; `verifie:false` |
| R-partiel | R1, `'warning-partiel'` | 200 `ok`, `verifie:false`, entrée `offresActives:true, accepte:null` |
| R-ecart | `'ignore'` | 200 `ok`, `verifie:false`, `lecture.accepte === null` rangée ; **2** GetItem après la révision (la relecture différée) |
| R-delai | `getitemApres:'ancien-puis-nouveau'` | 200 `ok`, `verifie:true` (la 2ᵉ relecture), 2 GetItem après la révision |
| R-offres-inconnues | R1 + `getitem='sans-bestoffer'` après la pose | `verifie:null`, `lecture.offresActives === null` |
| R-relu-ko | `getitemApres:'ko'` | 200 `ok`, `verifie:null`, entrée `{ lu:false, raison:'apres-ecriture' }` — **jamais** `{ lu:true, accepte:null }` |
| R-ordre | ligne `ebay_offres` pré-remplie pour `110000000302` avec `lueA` = dans 1 h ; `regleoffrelire` de 302 | l'entrée plus récente n'est PAS écrasée ; une pose (marqueur `_force`) la remplace bien |
| R-avant | GetItem avant KO / `tronque` ; liste KO ; R7 (programmée), pose ET retrait ; annonce absente d'une liste complète ; R4 ; R3 ; R5 | 503 `pas-su` / 503 / 409 `programmee` (le message du retrait parle d'annuler la programmation) / 409 `pas-sur-ce-compte` / 409 `plus-en-vente` / 409 `format` / 409 `devise` — **aucune** révision |
| R-range | ligne pré-remplie (entrée de 302) + pose OK sur R1 | l'entrée de 302 est GARDÉE et celle de 301 ajoutée ; `mode.offresEcritureKoApres` ⇒ 200 `ok`, `range:false`, l'entrée rangée de 301 reste `en-cours` (jamais l'ancien « aucune ») |
| R-compte | R6 (at-A2) avec `compte: CLE_A2` | tous les appels avec le jeton `at-A2`, ligne `ebay_offres_{CLE_A2}` écrite, `ebay_offres` jamais touchée ; R6 SANS `compte` ⇒ 409 `pas-sur-ce-compte`, **aucune** révision ; B avec `compte: CLE_A2` ⇒ 404/403, zéro appel |
| R-lire | `regleoffrelire` `['110000000301','110000000302','990000000001']` | 301 et 302 lus et rangés (302 `offresFaites:2`) ; 990… `{ lu:false, raison:'pas-sur-ce-compte' }`, **non rangé** ; 21 ids / pas un tableau / un id invalide ⇒ 400 zéro appel ; liste KO ⇒ 503, rien rangé ; GetItem `tronque` ⇒ `{ lu:false, raison:'lecture-ratee' }` ; GetItem en série |
| R-sync | `sync` avec R1, R2 en ligne | le nombre de `GetItem` est **le même** qu'avant ; `ebay_offres` écrite avec R1 `accepte null` et R2 `accepte 70` (`par:'sync'`) ; `ebay_listings.items[*].detail` sans `_regle` ni `regle` ; `mode.offresKo` ⇒ `ebay_listings` écrite, `ebay_offres` non ; `getitem` KO pour une ⇒ son entrée `{ lu:false }` |
| R-prix-change | `revise` `price:'95'` sur R2 avec règle rangée | marqueur `en-cours` AVANT `ReviseInventoryStatus` ; `'efface'` ⇒ 200, `regle.tombee === true`, `regle.avant.accepte === 70`, entrée `accepte null` ; `'garde'` ⇒ `tombee === false`, `lecture.accepte === 70`, `lecture.prix === 95` ; `'refus-23004'` ⇒ 422 + `erreurs[0].code === '23004'`, entrée = relecture (jamais `en-cours`) ; réseau coupé ⇒ 504 + entrée `{ lu:false, raison:'incertain' }` ; `offresEcritureKo` ⇒ 503 `note`, aucun `ReviseInventoryStatus` ; R1 (aucune rangée) ⇒ `tombee === false`, aucun marqueur ; annonce sans entrée ⇒ `tombee === null`, la lecture rangée ; ligne illisible ⇒ `tombee === null` ; stock seul ⇒ aucun GetItem, aucune écriture `ebay_offres`. Les contrôles `revise` existants restent verts |
| R-crea | `pubverify` avec `item.offre {accepte:66, refuse:null}`, prix 74 | le `<Item>` de la vérification contient le bloc §3.10 ; `{accepte:74}` ⇒ 400 `offre`, zéro appel ; `price:'abc'` + offre ⇒ 400, zéro appel ; `{accepte:7}` (prix 74) ⇒ 400 `sous-moitie` ; avec `sousMoitie:true` ⇒ bloc présent ; `item.regleOffre {accepte:1}` ⇒ **aucun** bloc ; `programmer` avec `offre` ⇒ vérif et ajout portent le même bloc, réponse `offre.envoyee`, **aucun** GetItem après l'ajout ; `publish` avec `offre` ⇒ un `GetItem` après l'ajout, `offre.verifie` |
| R-vide | `pubverify`, `publish`, `programmer` sans `offre`, puis avec `offre: null` | XML **identiques** entre les deux, et sans `BestOffer`, `ListingDetails`, `MinimumBestOffer` |
| R-§11 | `valideRegleOffre` et `seuilTropBas` de l'app (extraites d'App.jsx, exécutées dans le `vm`) vs celles de `api/_lib/ebay.js` | mêmes sorties (JSON) sur au moins : `{72,prix 80}`, `{80,80}`, `{79.995,80}`, `{0}`, `{-1}`, `{'72'}`, `{72.5, refuse 72.5}`, `{72, refuse 60}`, `{null, refuse 60}`, `{null, null}`, `{72, refuse undefined}`, `{1e6}`, `{NaN}`, `{72.555}` ; `seuilTropBas` sur `(7,80)`, `(40,80)`, `(39.99,80)`, `(0.03,0.05)`, `(72,null)`, `(NaN,80)` |
| R-nc | base NON cloisonnée (processus fils) | B ⇒ 403 pour `regleoffre` |

### 9.2 `scripts/audit-offres-auto.cjs` — ajouter une section, il doit rester vert
« 5. eBay : c'est eBay qui accepte » : lire `api/*.js` et `api/_lib/*.js` **sans
commentaires** et exiger : aucun `RespondToBestOffer`, aucun chemin
`negotiation/v1/…accept…` ni `respond_to_offer`, aucun `bestOfferTerms` /
`autoAcceptPrice` (voie Inventory) ; `BestOfferAutoAcceptPrice` n'apparaît que
dans `api/ebay.js`. Rouge sur un fichier `api/` muté qui ajoute
`tradingCall(token, 'RespondToBestOffer', …)` (le prouver une fois). Les sections
1–4 ne changent pas.

### 9.3 `scripts/prouve-regle-offre.cjs` — les mutations (route) et « le même XML qu'avant »

Un seul script, qui ne touche jamais le dépôt : il copie l'arbre courant
(`git archive HEAD` + fichiers modifiés non commités) dans
`os.tmpdir()/mut-regle-{nom}`, applique UNE mutation par remplacement de texte
(ancre exacte ; **ancre introuvable ⇒ rouge « mutation non appliquée »**), lance
`node scripts/audit-ebay-route.cjs --src <copie>` et exige une sortie ≠ 0 ET la
présence des contrôles nommés en rouge :

| mutation | ce qu'elle change | contrôles qui doivent passer au rouge |
|---|---|---|
| `seuil-prix` | retire le refus `seuil-prix` contre le prix relu (6c) | R-prix |
| `confirme` | retire `if (b.confirme !== true)` | R-conf |
| `prix-vu` | retire la garde 6b (`prixVu` ≠ prix d'eBay) | R-prixvu |
| `sous-moitie` | retire la garde `seuilTropBas` de l'étape 3 ET de `regleDeItem` | R-sous-moitie, R-crea |
| `attendu` | retire l'étape 6e | R-attendu |
| `sans-marque` | retire le marqueur de l'étape 7 | R-marque, R-range |
| `sans-ack` | 9b ne prend plus que `r.status === 0` (le reste part en 9c, « refus clair ») | R-ack (« 503 lu refusé ») |
| `systeme-refus` | `classeEchec` rend toujours `'refus'` | R-systeme |
| `offres-actives` | `memeRegle` et l'idempotence ignorent `offresActives` | R-partiel, R-idem, R-offres-inconnues |
| `refus-non-renvoye` | ne renvoie plus le refus existant quand la clé `refuse` est absente | R-garde-refus |
| `ordre-luea` | `rangerReglesOffre` remplace toujours | R-ordre |
| `compte` | retire le contrôle « l'annonce est dans les annonces actives DE CE compte » | R-compte |
| `rangement` | `if (d === undefined) return null;` → repartir de `{}` | R-marque (ligne pré-remplie effacée) |
| `relu-aucune` | sur relecture ratée, ranger `{ lu:true, accepte:null, refuse:null }` | R-relu-ko |
| `tombee-pas-su` | `tombee` vaut `false` quand l'entrée était absente ou illisible | R-prix-change |
| `sync-detail` | la synchro range `detail` AVEC `_regle` dans `ebay_listings` | R-sync |

Et un contrôle « **même XML qu'avant** » (D7) : `scripts/_xml-publication.cjs --src X`
(même faux eBay minimal que `bancs/ebay-write.cjs`) appelle `pubverify`,
`publish` et `programmer` sur 3 items SANS `offre` et imprime les corps XML
envoyés. `prouve-regle-offre.cjs` le lance sur `/tmp/avant-regle` et sur l'arbre
courant : sorties **identiques au caractère près**.

Sur le code d'avant (`--src /tmp/avant-regle`), la section 12 sort rouge
(« action inconnue » ⇒ 400) — à noter dans le bilan avec le nombre exact.

### 9.4 `scripts/bancs/ebay-regle-offre.cjs` — le RENDU, données inventées, port 4731

Il vit dans le dépôt (aucune fixture réelle). Même squelette que
`ebay-annonces.cjs` / `ebay-comptes.cjs` : `DIST = path.join(__dirname,'..','..','dist')`,
Chromium `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
(`--use-angle=swiftshader --no-sandbox --no-proxy-server`), `metaVersData`,
projection `select=` appliquée, URL **décodée** avant de juger une route, écritures
GARDÉES dans `rows`, images externes coupées, `**/api/ebay**` enregistré APRÈS le
fourre-tout `**/api/**` (§6.6 du dossier), `essaie()` partout, port pris ⇒
rapporte et sort. Deux tailles `{390×844, isMobile, hasTouch}` et `{1512×950}`.
Juge les `data-*`, les couleurs CALCULÉES (`getComputedStyle`) et le **corps
exact** envoyé (`JSON.stringify` égal à l'attendu, ordre des clés compris),
jamais une formulation (sauf la présence d'un montant dans une feuille).

**Données** (`T0` = maintenant ; `H` = une heure ; `J` = un jour) :
- Registre `ebay_comptes` : `K1='aaaaaaaaaaaaaaa1'` `paire_perso` (principal),
  `K2='bbbbbbbbbbbbbbb2'` `paire_pro`. `status` ⇒ `{ ok:true, connected:true, comptes:[…, relie:true] }`.
- `ebay_listings` (principal), toutes `qty:'1'` :
  `A1 130000000001` « Nike Air Max 1 bleu taille 44 » `"80.0"` `VRM-41` ;
  `A2 130000000002` « Adidas Samba blanc taille 42 » `"90.0"` `VRM-42` ;
  `A3 130000000003` « Salomon XT-6 noir taille 43 » `"120.0"` sku `''` ;
  `A4 130000000004` « Asics Gel 1130 argent taille 39 » `"70.0"` `VRM-44` ;
  `A5 130000000005` « Reebok Club C blanc taille 42 » `"60.0"` `VRM-47` (paire vendue sur Vinted) ;
  `A6 130000000006` « Converse Chuck 70 noir taille 43 » `"100.0"` `VRM-48` ;
  `A7 130000000007` « Vans Old Skool noir taille 41 » `"50.0"` sku `''`.
- `ebay_listings_K2` : `B1 130000000101` « New Balance 550 gris taille 44 » `"100.0"` `VRM-45` ;
  `B2 130000000102` « Puma Suede rouge taille 41 » `"0.05"` `VRM-46` ;
  `B3 130000000103` « Nike Dunk Low gris taille 42 » `"80.0"` `VRM-49`.
- `ebay_offres` (principal), toutes `devise:'EUR'`, `lu:true` sauf mention, `lueA: T0 - 1H` sauf mention :
  A1 `{offresActives:true, accepte:72, refuse:60, prix:80, offresFaites:2}` (connue) ;
  A2 `{offresActives:null, accepte:null, refuse:null, prix:90}` (aucune) ;
  A3 absente (pas su « jamais ») ;
  A4 `{offresActives:true, accepte:65, refuse:null, prix:75}` (prix 70 ⇒ pas su `prix-change`, risque) ;
  A5 `{offresActives:true, accepte:54, refuse:null, prix:60}` (connue, mais bloquée `vendue`) ;
  A6 `{offresActives:true, accepte:95, refuse:null, prix:100, lueA: T0 - 10J}` (connue, lue il y a 10 j) ;
  A7 `{offresActives:false, accepte:null, refuse:null, prix:50}` (aucune).
- `ebay_offres_K2` : B1 `{offresActives:null, accepte:null, refuse:null, prix:100}` ;
  B2 `{offresActives:null, accepte:null, refuse:null, prix:0.05}` ;
  B3 `{offresActives:true, accepte:null, refuse:null, prix:85}` (prix 80 ⇒ pas su `prix-change`, sans risque).
- `ebay_orders` : principal et K2 `{orders:[], capturedAt: T0 - 1H}` (aucune
  relecture des ventes à l'ouverture ; seul le bloc 3 vieillit celle du principal).
- `main.vinted_annonce_numeros` : fiches `9041`→41 (`buyPrice` 50), `9042`→42
  (`buyPrice` 85), `9044`→44, `9045`→45, `9046`→46, `9047`→47, `9048`→48
  (`buyPrice` 92), `9049`→49 ; `vrm_ebay_compte_pub: K1` ;
  `vrm_ebay_retrait_auto` absent (éteint).
- Ventes Vinted : la paire N°47 **prouvée vendue** (une ligne `harvest_111_txn_*`
  dont `meta.item_id = 9047` et `status_title` non vide, la forme de
  `ebay-annonces.cjs`) ; annonces Vinted en ligne : toutes sauf 9047. Un compte
  Vinted inventé (`ACCS`). Ventes Leboncoin `{}`.
- Faux `/api/ebay` : tient l'état eBay du banc (`regleEbay[itemId]` = les entrées
  ci-dessus, + des règles CACHÉES par bloc), compte les requêtes EN VOL (`enVol`,
  `maxEnVol`), retarde chaque `regleoffre` de 250 ms et se comporte comme la
  route : `prixVu` ≠ prix ⇒ 409 `prix-change` ; `attendu` ≠ état ⇒ 409
  `regle-changee` ; `'inconnu'` et une règle ⇒ 409 `regle-existante` ; sinon
  applique et répond `{ ok:true, verifie:true, lecture, avertissements:[], range:true }`
  en mettant à jour `rows` (`ebay_offres*`). `regleoffrelire` ⇒
  `{ ok:true, lectures, range:true }` (+ `rows`). `sync` ⇒ `{ ok:true }` et
  `ebay_orders{suffixe}.capturedAt = now` (ou 500 si le bloc le demande).
  `revise` ⇒ selon le bloc. Chaque bloc déclare ses **scénarios forcés** par
  itemId ; tout envoi `regleoffre` / `regleoffrelire` / `sync` / `revise` est
  poussé dans `envois` ; tout repart à zéro à chaque bloc.

**Contrôles, aux deux tailles** (préparer l'état à neuf à chaque bloc) :
1. **Trois états** : A1 `connue`, `data-regle-accepte="72.00"`, `data-regle-refuse="60.00"` ;
   A2, A7, B1, B2 `aucune` avec `data-regle-ouvrir` et **aucun « € »** dans leur
   ligne ; A3 `pas-su`/`jamais` ; A4 `pas-su`/`prix-change` — **son « 65 »
   n'apparaît nulle part sur la carte** ; B3 `pas-su`/`prix-change` ; A6 `connue`
   avec `data-regle-age="10"` ; aucune ligne « pas su » ne contient « aucune ».
   Variante : A1 `lueA = T0 - 40J` ⇒ `pas-su`/`ancienne`, aucun « 72 ». Variante :
   A2 `price` absent dans `ebay_listings` ⇒ PAS `prix-change` (état lu), et
   `Enregistrer` désactivé (« prix pas lu »).
2. **Une fois** : `[data-regles-engagement]` ×1, n = 3 (A1, A5, A6), « 1 lue il y
   a plus de 7 jours » ; `[data-regles-fenetre]` ×1 et `[data-regles-vers-retrait]`
   (retrait éteint) ; cliquer ⇒ `[data-ebay-retrait-auto-bouton]` a le focus,
   **aucune** requête `/api/ebay`, aucune écriture de `main`.
   `[data-regles-pas-su]` ×1, `= "3"`, causes `jamais:1,prix-change:2`, couleur
   calculée = `E.warn` (A4 a un risque) ; variante sans A4 ⇒ couleur `E.muted`.
   Variante `vrm_ebay_retrait_auto: true` ⇒ bloc présent, **`[data-regles-fenetre]`
   présent**, lien absent. Variante sans règle connue (entrées A1, A5, A6
   retirées) ⇒ bloc absent. Variante A7 `connue` (accepte 40) ⇒
   `[data-ebay-non-reliees-regles="1"]` ; « pas reliée » et « reliée à aucune »
   ×1 au plus au-dessus de la liste.
3. **Fenêtre des ventes** (`ebay_orders` principal à `T0 - 3J`) : à l'ouverture,
   **exactement un** `sync` pour le principal (ses ventes ont 3 jours et il a des
   règles), **zéro** pour K2
   (lues il y a 1 h) ; ensuite `data-regles-ventes-age-h="0"`. Variante `sync`
   en 500 : `data-regles-ventes-age-h="72"`, couleur `E.warn`,
   `[data-regles-relire-ventes]` présent ; le cliquer ⇒ un `sync` principal.
   Variante sans règle connue ⇒ **aucun** `sync` à l'ouverture.
4. **« Relire chez eBay »** : deux envois exactement,
   `{"action":"regleoffrelire","itemIds":["130000000003","130000000004"]}` et
   `{"action":"regleoffrelire","itemIds":["130000000103"],"compte":"bbbbbbbbbbbbbbb2"}` ;
   ensuite A3 `aucune`, A4 `connue` (65), B3 `aucune` ; la ligne « pas su »
   disparaît. Variante `status` lent (3 s) ⇒ bouton désactivé puis actif.
   Variante `status` en 500 ⇒ aucun envoi, et le texte ne contient ni
   « non relié » ni « pas relié ».
5. **Poser (A2)** : ouvrir ⇒ `[data-regle-panneau]` ; `90` ⇒ `[data-regle-erreur]`,
   `[data-regle-enregistrer]` désactivé ; `40` ⇒ `[data-regle-sous-moitie]`,
   enregistrer désactivé jusqu'à la case ; `81` ⇒ `[data-regle-sous-achat]` (achat
   85) ; Enregistrer ⇒ la feuille contient `81,00 €` ; **Annuler ⇒ aucun envoi** ;
   Oui (double clic) ⇒ **un seul** envoi, exactement
   `{"action":"regleoffre","itemId":"130000000002","accepte":81,"prixVu":90,"attendu":{"accepte":null,"refuse":null},"confirme":true}` ;
   la carte passe `connue`, `data-regle-accepte="81.00"`, `[data-ebay-info]`
   couleur `E.text`. Variante `40` + case ⇒ le corps porte `"sousMoitie":true`
   juste avant `"confirme"`.
6. **Refus et retrait (A1)** : `Modifier` ⇒ champs pré-remplis 72 / 60, et la
   ligne `offresFaites` (2) ; refus `75` ⇒ erreur, bouton désactivé ; refus vidé +
   `74` ⇒ la feuille dit « Le refus sous 60,00 € sera retiré », corps
   `{"action":"regleoffre","itemId":"130000000001","accepte":74,"refuse":null,"prixVu":80,"attendu":{"accepte":72,"refuse":60},"confirme":true}` ;
   `Retirer la règle` ⇒ **pas de feuille**, corps
   `{"action":"regleoffre","itemId":"130000000001","accepte":null,"refuse":null,"confirme":true}` ;
   la carte passe `aucune`.
7. **Compte de l'annonce** : vue « Tous » ; poser `90` sur B1 ⇒
   `{"action":"regleoffre","itemId":"130000000101","accepte":90,"prixVu":100,"attendu":{"accepte":null,"refuse":null},"confirme":true,"compte":"bbbbbbbbbbbbbbb2"}`
   (alors que `vrm_ebay_compte_pub` vaut K1). Vue K1 ⇒ aucune carte ni ligne
   d'aperçu de K2.
8. **Issues (carte)** :
   - B1 posée à 90 puis changée en 85 (scénario : 504) ⇒ `pas-su`, aucun montant,
     message `E.warn`, le 2ᵉ corps porte `"attendu":{"accepte":90,"refuse":null}` ;
   - A3 (pas su) posée à 100 avec une règle CACHÉE à 110 chez le faux eBay ⇒ 1ᵉʳ
     corps sans clé `refuse` et avec `"attendu":"inconnu"` ⇒ 409 `regle-existante`
     ⇒ `[data-regle-existante]`, carte `connue` 110, panneau ouvert ; Enregistrer +
     Oui ⇒ 2ᵉ corps `"attendu":{"accepte":110,"refuse":null}` ⇒ `connue` 100 ;
   - A2 avec prix CACHÉ à 95 chez le faux eBay ⇒ 409 `prix-change` ⇒
     `[data-regle-prix-change]`, `data-ebay-prix="95.00"`, aucun ✓, carte `aucune`
     (pas `prix-change` : le prix local suit) ;
   - A7 (scénario 422 « La catégorie de cette annonce n'accepte pas les offres. »)
     ⇒ ce message, couleur `E.warn`, A7 reste `aucune` ;
   - A2 (scénario `{ok:true, verifie:false, lecture:{offresActives:true, accepte:null, …}}`)
     ⇒ le message « activé les offres mais pas gardé le montant », aucun ✓,
     `aucune` ; (scénario `{ok:true, verifie:null, lecture:null}`) ⇒ `pas-su`, aucun
     ✓ ; (scénario `{ok:true, verifie:true, …, range:false}`) ⇒ `connue` ET la note
     « VRM n'a pas pu le noter ».
9. **Geste groupé**, vue « Tous » : pct `45` ⇒ `[data-regles-pct-erreur]`, aucun
   aperçu, `[data-regles-appliquer]` désactivé ; pct `90` ⇒ statuts / seuils :
   A1 `inchange` 72.00 ; A2 `nouvelle` 81.00 coché + `data-regles-sous-achat` ;
   A3 `a-relire` ; A4 `a-relire` ; A5 `exclue` (vendue) ; A6 `remplace` 90.00
   **décoché** (« plus bas ») + sous-achat (92) ; A7 `nouvelle` 45.00 **décoché**
   (sans paire reliée) ; B1 `nouvelle` 90.00 coché ; B2 `exclue` (prix trop bas) ;
   B3 `a-relire` ⇒ `Appliquer à 2 annonces`. Cocher A6 et A7 ⇒ `Appliquer à 4
   annonces` ; la feuille contient « 1 remplace » « (dont 1 plus basse) »,
   « 2 sous ton prix d'achat », « 1 sans prix d'achat saisi » (B1),
   « 1 sans paire reliée », les deux noms de compte ; **Annuler ⇒ aucun envoi** ;
   Oui ⇒ 4 envois dans l'ordre A2, A6, A7, B1, chacun SANS clé `refuse` ni
   `sousMoitie`, chacun avec `prixVu` et `attendu` (A6 `{"accepte":95,"refuse":null}`),
   B1 avec `"compte":"bbbbbbbbbbbbbbb2"` ; `maxEnVol === 1`. Scénarios : A2 OK ;
   A6 `{ok:true, verifie:null, lecture:null}` ; A7 422 ; B1
   `{ok:true, verifie:false, lecture:{offresActives:true, accepte:null, …}}` ⇒
   bilan `total 4 · ok 1 · non-relu 1 · ko 1 · ecart 1 · incertain 0 · a-revoir 0 ·
   non-envoyees 0` (somme = total) ; ni B1 ni A6 ne sont `connue`, aucun ✓ sur
   eux. Pendant le lot, `data-regle-ouvrir` de A2 est désactivé.
   Variantes : « Arrêter » pendant le 1ᵉʳ envoi (4 cochées) ⇒
   `data-regles-non-envoyees="3"` ; vue K2 ⇒ aperçu B1, B2, B3 seulement,
   `Appliquer à 1 annonce` ; changer de sous-onglet pendant le 2ᵉ envoi ⇒ plus
   aucun envoi après, et au retour `[data-regles-lot-interrompu="2"]` ;
   `ebay_offres` retardé de 3 s ⇒ `[data-regles-toutes-ouvrir]` désactivé puis
   actif.
10. **Bloquée** : A5 ⇒ `data-regle-bloquee="vendue"`, `[data-regle-modifier]`
    désactivé (présent), `[data-regle-retirer-direct]` actif ; le bloc
    `data-ebay-a-retirer` porte `[data-ebay-doublon-regle]` pour la N°47.
    Variante « deux comptes » (une annonce `VRM-42` ajoutée à K2) ⇒ A2
    `data-regle-bloquee="deux-comptes"`, `exclue` dans l'aperçu.
    Variante ventes Vinted en 500 ⇒ `[data-regles-bloquees-commun]` ×1 et les
    cartes reliées n'ont pas de `[data-regle-ouvrir]` actif ; A3, A7 (non reliées)
    restent actives.
11. **Prix (✏️) sur A1** (connue 72) : nouveau prix `72` ⇒ aucun `revise`, message ;
    `85` ⇒ `[data-regle-rappel]` contient `85 %` ; envoi ⇒ corps avec `"price":"85"` ;
    scénario `regle:{tombee:false, lecture:{…accepte:72, prix:85}}` ⇒ message
    couleur `E.text` commençant par ✓ et contenant `72,00 €` ; scénario
    `tombee:true` ⇒ message `E.warn` sans ✓, carte `aucune` ; stock seul (`2`) ⇒
    corps **sans** clé `price`. Scénario 422 avec `erreurs:[{code:'23004'}]` ⇒ le
    message traduit (pas l'anglais).
12. **Offre aux observateurs** (A1 éligible) : remise 30 % ⇒ 56,00 € <
    72 ⇒ `[data-offre-sous-regle]` ; remise 5 % ⇒ absent.
13. **Panne** : `ebay_offres*` en 500 ⇒ toutes les cartes `pas-su`/`illisible`,
    aucun montant, aucun « aucune », pas de bloc d'engagement, ligne « pas su »
    ×1 ; `[data-regles-relire]` ne provoque **aucun** envoi.
14. Partout : `scrollWidth ≤ clientWidth`, aucune `pageerror`, aucun « n'a pas pu
    s'afficher / Cannot access / is not defined ». Captures dans `os.tmpdir()`
    (regardées, §6.2 du dossier).

**Mutations du banc** (copie de l'arbre, `src/App.jsx` muté, `npm run build`
dans la copie, banc copié dedans et lancé DEPUIS elle) — chacune rouge :
`pas-su-aucune` (`etatRegleOffre` rend `aucune` sans entrée) ⇒ 1, 13 ;
`compte-vue` (la carte envoie `corpsCompteEbay(compteDefautPub)`) ⇒ 7 ;
`parallele` (le lot en `Promise.all`) ⇒ 9 (`maxEnVol`) ;
`annuler-envoie` (l'envoi avant `askConfirm`) ⇒ 5, 9 ;
`vue-ignoree` (l'aperçu prend `items`) ⇒ 9 ;
`garde-vendue` (`regleBloquee` rend toujours `null`) ⇒ 10 ;
`refuse-null-pas-su` (la carte envoie toujours `refuse`) ⇒ 8 ;
`verifie-ignore` (`j.ok` suffit pour « ok ») ⇒ 8, 9 ;
`relire-sans-compte` (Relire envoie sans `compte`) ⇒ 4 ;
`couleur-vert` (message coloré par `/✓/` en vert) ⇒ 5, 11 ;
`fenetre-masquee` (le bloc cache les fenêtres quand le retrait est allumé) ⇒ 2.
Sur le build de la base d'avant : rouge (aucun `data-regle-offre`).

### 9.5 Bancs existants à étendre (D7, §6.7) et à garder verts
- `scripts/bancs/ebay-form.cjs` (port 4331) : champ `[data-publier-offre-accepte]` ;
  vide ⇒ le corps `pubverify` n'a **pas** de clé `item.offre` ; `66` avec prix 74 ⇒
  `item.offre` = `{"accepte":66,"refuse":null}` ; `80` ⇒ rien n'est envoyé,
  `[data-publier-offre-erreur]` ; `30` ⇒ case `[data-publier-offre-sous-moitie]`,
  rien n'est envoyé tant qu'elle n'est pas cochée, puis `"sousMoitie":true` ;
  « Publier » avec règle ⇒ feuille même avec un seul compte, Annuler n'envoie pas
  `publish` ; une réponse `pubverify` avec `avertissements` ⇒
  `[data-publier-avertissements]`.
- `scripts/bancs/ebay-programmer.cjs` (port 4721) : un brouillon inventé avec
  `offreAccepte: '70'` (prix 85) ⇒ `pubverify` ET `programmer` portent
  `item.offre` `{"accepte":70,"refuse":null}` ; la feuille du lot contient
  `70,00 €` ; un brouillon `offreAccepte:'30'` (prix 85) SANS `offreSousMoitie` ⇒
  écarté avec sa raison ; les brouillons sans règle : corps inchangés.
  `[data-brouillon-offre="70.00"]` sur la ligne du brouillon ; une programmée
  issue du brouillon ⇒ `[data-programmee-offre="70.00"]`.
- `scripts/bancs/annonces-carte.cjs` (la baisse eBay des paires qui dorment) :
  sert une ligne `ebay_offres` avec une règle connue à 58 € sur l'annonce baissée
  à 53 € ⇒ la baisse n'est pas proposée, `[data-reprice-ebay-regle]` ; règle à
  40 € ⇒ proposée, la feuille rappelle la règle, et une réponse `revise`
  `tombee:true` ⇒ le message de la règle à la place du « ✓ ». Ses contrôles
  existants restent verts.
- Restent verts, relancés : `ebay-annonces.cjs`, `ebay-comptes.cjs`,
  `ebay-write.cjs`, `capacites.cjs`, `verif_visuel.cjs`, `verif_dark.cjs` ;
  audits `audit-ebay-route`, `audit-offres-auto`, `audit-tdz`, `audit-lectures`,
  `audit-fonctions-api` (12/12), `audit-variables`, `audit-icones`,
  `audit-coherence`, `audit-ebay-retrait-auto`, `audit-ebay-deja-vendue`,
  `audit-bancs` (le nouveau banc : `DIST` déduit de `__dirname`, aucune fixture
  réelle), et `npm run build`.

---

## 10. Ce qui reste NON MESURABLE d'ici (eBay et la production sont bloqués)

À écrire tel quel dans le dossier ; ne rien promettre à l'écran qui en dépende.
1. Les noms/places des éléments dans `ReviseFixedPriceItem` et
   `AddFixedPriceItem` (`BestOfferDetails`, `ListingDetails/BestOfferAutoAcceptPrice`,
   `MinimumBestOfferPrice`, `currencyID="EUR"`) — doc d'eBay, jamais envoyés.
2. `DeletedField` sur ces chemins avec `ReviseFixedPriceItem` (absent de la liste
   blanche 2016). Si eBay refuse, l'écran le dit et renvoie sur eBay.
3. Que `GetItem` (sans `DetailLevel` et en `ReturnAll`) rende les seuils et
   `BestOfferDetails` au jeton du vendeur, et qu'**absent** = pas de seuil
   (« Conditionally ») — c'est la relecture après sa première pose qui le dira.
4. Que la catégorie **15709** sur EBAY_FR accepte l'acceptation / le refus
   automatiques (`GetCategoryFeatures` non appelé, exprès : §13). Si elle ne les
   accepte pas, eBay active peut-être les offres sans le montant : l'écran le dit
   (écart, §6.4).
5. « Seuil strictement sous le prix » (23004) et « refus sous l'acceptation »
   (21919263) : sources tierces ; VRM est plus strict (refus ≥ acceptation refusé).
6. Ce que fait `ReviseInventoryStatus` à une annonce qui a des seuils : les
   effacer, les garder, ou refuser (23004). Les trois issues sont tenues (§3.9) et
   l'écran ne dit que ce qu'il a relu.
7. `VerifyAddFixedPriceItem` avec seuils (« Add/Revise/Relist/Verify » dans le
   guide, pas dans la liste 2016).
8. Une offre **égale** au seuil acceptée (≥) : 3 sources sur 4 ; et la règle
   s'applique aussi aux contre-offres de l'acheteur.
9. Le délai de l'acceptation par eBay, et si l'objet est réservé avant paiement
   sur eBay.fr : rien n'est promis (« instantané », « réservé »).
10. L'état de SES 2 annonces : offres déjà activées ? seuil déjà posé à la main ?
    — inconnu jusqu'à la première lecture (synchro ou « Relire chez eBay »).
11. La tolérance d'eBay à l'ordre des éléments dans `<Item>` (le bloc est ajouté
    en fin, avant `<UUID>`).
12. Une annonce PROGRAMMÉE : la révision de ses seuils n'est pas tentée (409),
    `ReviseFixedPriceItem` + `DeletedField` sur une programmée non plus ; la lecture
    `GetItem` d'une programmée n'est pas tentée.
13. Le délai de propagation d'une révision avant qu'un `GetItem` la montre (VRM
    relit une 2ᵉ fois après 2 s, puis dit l'écart).
14. Une offre déjà faite (`BestOfferCount` > 0) et encore en attente, au-dessus du
    nouveau seuil, acceptée dès la pose : possible, non documenté — la feuille le
    dit comme une possibilité.
15. `ErrorClassification` toujours présent dans les réponses d'eBay.fr : une
    classe absente est traitée comme « incertain » (relecture), jamais comme un
    refus.

**Les premiers gestes de Julien** (à mettre dans le dossier) : (1) eBay → Compte
eBay → « ↻ Rafraîchir depuis eBay » : ses 2 annonces passent de « — » à leur
vrai état ; (2) relier ses 2 annonces à leur paire (sinon une vente eBay ne sort
pas la paire de Vinted) ; (3) poser une règle sur UNE annonce et regarder le
message (« ✓ … relu », ou « activé les offres mais pas gardé le montant » : la
catégorie ne le permet pas) ; (4) la retirer — si eBay refuse, le message le dira ;
(5) changer le prix d'une annonce à règle et lire ce que VRM a relu.

---

## 11. `CLAUDE.md` (D8)

### 11.1 La ligne du §3, remplacée par (même tableau)
```
| **accepter une offre automatiquement — SUR VINTED** — ⛔ **RETIRÉ, sa décision** | (texte actuel inchangé jusqu'à « refuse tout autre chemin vers `/accept`. ») **Sur eBay, à sa demande du 9 octobre, c'est eBay qui accepte** : le réglage natif de l'annonce (Offre directe, seuil `BestOfferAutoAcceptPrice`), posé par VRM sur SON clic, annonce par annonce, au montant qu'IL fixe. VRM n'appelle jamais une route d'acceptation (`audit-offres-auto.cjs` le vérifie aussi pour `api/`). Ce n'est **pas** un retour de l'acceptation automatique sur Vinted : ne pas l'y reproposer. |
```

### 11.2 La section courte (après « Plusieurs comptes eBay par vendeur… », 9 octobre)
```
### eBay : « au-dessus, ça accepte » — c'est eBay qui accepte, au seuil qu'il fixe (9 octobre)
Julien : « je veux juste définir une règle sur chaque annonce et à chaque offre
au-dessus ça accepte ». Fait SUR eBAY seulement, avec le réglage natif d'eBay ;
Vinted et l'extension ne changent pas (§3).
- **Fait** : action `regleoffre` (pose, change, retire ; `ReviseFixedPriceItem`,
  `DeletedField` pour retirer) et `regleoffrelire` ; ligne `ebay_offres{_clé}`
  (lire-fusionner-réécrire gardé, une lecture n'écrase pas une plus récente) ; la
  synchro lit la règle dans les GetItem qu'elle faisait déjà ; carte « Offres
  reçues : eBay accepte dès X € » ou « Définir une règle d'offre » ; « Une règle
  pour toutes » (%, aperçu, une par une, bilan complet) ; champ à la création,
  dans les brouillons et le planificateur ; un changement de prix (carte ET baisse
  des paires qui dorment) relit la règle et dit ce qu'il en reste.
- **Décisions** : trois états (connue · aucune · pas su ; une lecture de plus de
  30 jours vaut « pas su ») ; le prix et la règle que Julien a VUS sont des gardes
  serveur (`prixVu`, `attendu` : 409 s'ils ont changé chez eBay) ; un seuil sous
  la moitié du prix exige `sousMoitie` ; la base est marquée « en cours » AVANT
  l'écriture chez eBay ; sans `<Ack>` ou panne d'eBay (SystemError) ⇒ relecture,
  jamais « refusé » ; le compte de L'ANNONCE ; pas de règle sur une paire vendue
  ailleurs ou en vente sur deux comptes (retirer reste possible) ; retirer = un
  clic ; l'écran dit les deux fenêtres où eBay vend sans que VRM le voie (ventes
  eBay relues à l'ouverture au-delà de 6 h ; retrait automatique seulement VRM
  ouvert).
- **Preuves** : `audit-ebay-route.cjs` (section 12, {n} contrôles, {r} rouges sur
  la base d'avant) ; `prouve-regle-offre.cjs` (16 mutations, chacune rouge ; XML
  de publication identique à celui d'avant sans règle) ; banc
  `ebay-regle-offre.cjs` (port 4731, {n} contrôles, 11 mutations) ; `ebay-form`,
  `ebay-programmer`, `annonces-carte` étendus ; `audit-offres-auto.cjs` section 5.
- **Non mesuré** : la liste du §10 de la spécification (noms XML, `DeletedField`,
  catégorie 15709, effet d'un changement de prix, ≥ au seuil, délai de relecture,
  offre en attente acceptée à la pose, réservation). Premiers gestes : rafraîchir,
  relier ses 2 annonces, poser UNE règle, la retirer, changer un prix.
```
Mettre à jour les compteurs du §6/§9 (« N audits », « N bancs ») d'après
`ls scripts/audit-*.cjs | wc -l` et `ls scripts/bancs/*.cjs | wc -l`, et ajouter la
ligne du banc dans `scripts/bancs/README.md`.

---

## 12. Liste de contrôle de livraison

1. Arbre de travail propre, basé sur `worktree-wf_d62e1db4-b5c-1`, rebasé à la fin.
2. `api/ebay.js` : `classeEchec`, `lectureRegleDe`, `lireRegleOffre`,
   `memeRegle`, `relireApres`, `rangerReglesOffre`, `handleRegleOffre`,
   `handleRegleOffreLire`, `regleDeItem`, `montantXml`, `etatEnClair` (serveur),
   ajouts dans `erreursTrading`, `itemXml`, `avecSku`, `handleVerify`,
   `handlePublish`, `handleProgrammer`, `handleSync`, `handleRevise`,
   `tradingGetItem`, `ACTIONS`. `api/_lib/ebay.js` : `valideRegleOffre`,
   `seuilTropBas` exportées.
3. `src/App.jsx` : `valideRegleOffre`, `seuilTropBas` (copies), `etatEnClair`,
   `montantSaisi`, `seuilDePourcent`, `prixCompatibleRegle`, `etatRegleOffre`,
   `resultatRegleOffre`, `achatParNum`, `compterReglesEbay` ; `EbayAnnonceCard`
   (ligne, panneau, gestes, bloquée, garde et rappel du prix, offre aux
   observateurs, couleurs du message) ; `EbayAnnonces` (lectures, états locaux,
   `regleBloquee`, relecture des ventes, bloc, ligne « pas su », Relire, porte) ;
   `EbayReglesToutes` ; `EbayPublier` (champs, case, feuille, avertissements),
   `itemDeBrouillon`, `EbayBrouillons`, `EbayPlanificateur`, `EbayProgrammees`,
   l'alerte « à annuler » ; `resultatReviseEbay` ; la baisse des paires qui
   dorment (`baisseEbayDe`, `baisserSurEbay`, son rendu) ; la feuille de
   déconnexion eBay et « Fermer mon compte ».
4. Aucun changement dans `vinted-sync-extension/`, aucun `EXT_CAPACITES`, aucun
   zip, aucune ligne Vinted.
5. Preuves §9 : vertes sur l'arbre, rouges sur la base d'avant et sous chaque
   mutation ; captures regardées aux deux tailles.
6. `CLAUDE.md` §11 ; `scripts/bancs/README.md`.
7. Commit sur la branche de travail ; rien poussé, rien fusionné dans
   `claude/project-review-nsk5su`.

---

## 13. La revue contradictoire du 9 octobre — ce qui a été intégré, ce qui ne l'a pas été

Intégrés (37 critiques ; les doublons sont fusionnés) :

| critique | gravité | où |
|---|---|---|
| Le seuil est confirmé sur un prix périmé (`prixVu`) — et son double « le prix montré dans la confirmation » | haute + moyenne | §3.5 (3, 6b), §6.3, §6.4, §7.3, R-prixvu, mutation `prix-vu`, banc 8 |
| Faute de frappe « 7 » au lieu de « 72 » (`seuilTropBas`, `sousMoitie`) | haute | §2, §3.2, §3.5 (3), §3.10, §6.3, §8.1, §8.2, R-sous-moitie, mutation `sous-moitie`, banc 5 |
| Une règle existante inconnue écrasée (`attendu`, `regle-existante`, `a-relire`) — et « pas su écrasé en nouvelle » | moyenne ×2 | §3.5 (6e), §6.3 (`refuse` omis en « pas su », lignes 2–3), §6.4, §7.2 (`a-relire`), R-attendu, mutations `attendu` / `refuse-null-pas-su`, bancs 8, 9 |
| Le retrait automatique ne tourne qu'à l'ouverture — et « ce que ça engage » cache la synchro des ventes eBay | moyenne + haute | §6.1 (relecture des ventes > 6 h), §6.5 (deux fenêtres, toujours), bancs 2, 3, mutation `fenetre-masquee` |
| Montant fixe vs pourcentage ; une hausse rend la règle plus basse sans le dire | moyenne | §2, §6.7 (rappel, `resultatReviseEbay`), §6.6 (« prix changé : a pu tomber ou rester »), §7.1, R-prix-change (`garde`) |
| « Vérifié » sans regarder les offres actives | moyenne | §3.3 (`memeRegle` à trois issues), §3.5 (6d), §5 (`offres-inconnues`), §6.4 (écart en clair), §8.1 (avertissements), R-partiel, R-offres-inconnues — **sauf le point (5)**, voir plus bas |
| Ack Failure lu « rien n'a changé » | moyenne | §3.3 (`classeEchec`), §3.5 (9b, 9c), R-systeme, mutation `systeme-refus` |
| Le refus absent peut s'effacer | moyenne | §3.6 (`{MIN}` renvoyé), `memeRegle`, R-garde-refus, mutation `refus-non-renvoye` |
| La baisse des paires qui dorment ignore la règle (fusionnée avec « la règle tombe sans un mot ») | moyenne ×2 | §3.9 (`tombee` « pas su », 504, `erreurs`), §5 (`prixCompatibleRegle`), §6.7, banc `annonces-carte` |
| Programmée avec règle : invisible et pas retirable (fusionnée avec « affichée nulle part ») | moyenne + basse | §3.5 (5, message du retrait), §3.10, §6.9, §10.12 |
| Relecture trop tôt après la révision | basse | §3.3 (`relireApres`), §10.13, R-delai |
| Une synchro plus ancienne écrase la lecture | basse | §3.4 (`lueA`, `_force`), R-ordre, mutation `ordre-luea` |
| L'arrondi favorise l'acheteur | basse | §5 (`seuilDePourcent`, centime supérieur), §7.2 (pourcentage réel) |
| Quand VRM ne suit plus le compte | basse | §6.10 — partiel, voir plus bas |
| La règle n'est pas un plancher (offre aux observateurs) | basse | §6.8, banc 12 |
| Offres déjà en attente ; quota sous-estimé | basse | §3.3 (`offresFaites`), §6.3, §10.14, §3.5 et §7.3 (quota 4–9, lot de 25) — partiel, voir plus bas |
| `regleDeItem` et un prix illisible | basse | §3.10, R-crea |
| Une lecture ancienne présentée comme du jour (deux critiques) | basse + moyenne | §5 (`ancienne`, 30 j), §6.2 (`lue il y a`), §6.5 (« dont k »), banc 1 |
| Règle posée sur une paire déjà vendue / sur deux comptes | haute | §3.11, §6.1 (`regleBloquee`), §6.2, §6.5 (`data-ebay-doublon-regle`), §7.2, banc 10, mutation `garde-vendue` |
| `range` jamais lu : la base contredit eBay (marqueur « en cours ») | haute | §3.5 (7, 9), §3.9 (2), §5 (`en-cours`), §6.4 (`nonNote`), R-marque, R-range, mutation `sans-marque` |
| Le geste groupé remplace par défaut, la confirmation ne compte pas | moyenne | §7.2 (`remplace` plus bas décoché, non reliées décochées), §7.3 (comptes de la feuille), banc 9 |
| Le bilan oublie « posée mais pas relue » | moyenne | §5 (six issues), §7.3 (somme = total), banc 9, mutation `verifie-ignore` |
| Le message « règle tombée » en vert, le refus en rouge | moyenne | §6.4, §6.7, bancs 5, 11, mutation `couleur-vert` |
| « Relire chez eBay » : faux « non relié », pas de plafond, alerte permanente | moyenne | §6.6, banc 4 |
| Le geste groupé n'a pas de cycle de vie | moyenne | §7.3 (aperçu figé, en tête, `enLot`), §7.4, banc 9 |
| Des contrôles du banc ne pouvaient pas échouer | moyenne | §9.4 (B3 sur K2, `verifie:false/null` forcés, §6.7 au rendu, « Arrêter » en vue Tous, double clic) |
| Le lien « ↓ » pointe vers le bas | basse | §6.5 (« Voir le retrait automatique ») |
| « Pas reliée » dit quatre fois | basse | §6.5 (point 3 : un morceau ajouté à `data-ebay-non-reliees`) |
| Prix d'achat inconnu : le silence vaut « pas à perte » | basse | §6.3 (trois issues, « avant frais eBay »), §7.3 (« sans prix d'achat saisi ») — partiel, voir plus bas |
| La porte « Une règle pour toutes » cliquable pendant le chargement | basse | §7 (désactivée, place fixée), banc 9 |
| `etatRegleOffre` et un prix absent | basse | §5 (`p > 0`), §3.3 (`p.v > 0`), banc 1 |

Écartés, en une ligne chacun :
- **`GetCategoryFeatures` avant la première pose** (critique « vérifié sans regarder si les offres sont actives », point 5) : sa réponse se lit par héritage (SiteDefaults, puis catégorie parente) et n'a jamais été mesurée ; une fausse lecture « non » bloquerait toute pose, une fausse « oui » ne protège de rien — le cas est dit après coup par l'écart en clair (§6.4) et la confirmation annonce déjà que les offres seront activées (§10.4).
- **Variante « lot » de `regleoffre` qui relit la liste une fois pour 10 annonces** (critique quota) : elle multiplierait les gardes sur le chemin qui engage de l'argent ; le plafond de 25 par lot (≤ 225 appels au pire) suffit au volume mesuré (2 annonces).
- **Geste « Retirer les règles d'abord » dans les feuilles de déconnexion et de fermeture** : ce serait un second chemin d'écriture groupée ; la feuille dit le nombre et où les retirer (un clic chacune, §6.10).
- **Phrase sur les règles quand l'abonnement est coupé (402)** : la porte d'abonnement ferme l'app et le serveur n'appelle plus eBay pour ce vendeur — VRM ne peut ni lire ni dire l'état de ses règles à ce moment-là.
- **Porte « vers la saisie du prix d'achat » depuis la carte eBay** : la saisie en série vit sur l'écran Annonces Vinted, sans cibler la paire, et `EbayAnnonces` n'a pas de navigation vers lui ; la ligne dit où la saisir.
