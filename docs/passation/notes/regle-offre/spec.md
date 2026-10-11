# Spécification — eBay : « une règle sur chaque annonce, et au-dessus ça accepte »

Version du 9 octobre 2026. Document AUTONOME : un agent la construit sans autre
contexte que le dépôt et `CLAUDE.md`. Tout ce qui n'est pas mesuré est marqué
**[non mesuré]** ; tout ce qui vient de la doc d'eBay est marqué **[doc]**.

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
`scripts/audit-offres-auto.cjs` et `scripts/bancs/capacites.cjs` doivent rester
verts.

Les décisions D1–D8, précisées dans les sections indiquées :

| | décision | précisée en |
|---|---|---|
| D1 | une règle PAR ANNONCE eBay : « eBay accepte toute offre dès X € » ; option « refuse sous Y € » (vide par défaut) ; poser un seuil active les offres sur l'annonce si besoin | §2, §3 |
| D2 | tout part sur SON clic ; confirmation qui dit la conséquence ; retirer = un clic | §6.3, §6.4 |
| D3 | le serveur ne croit pas le navigateur (session, vendeur, compte eBay de l'annonce ; relit chez eBay avant ; refuse X ≥ prix, Y ≥ X, montants mal formés ; `confirme:true` ; sans `<Ack>` ⇒ incertain ; message d'eBay tel quel sans jeton ; relit après et range, rangement gardé) | §3 |
| D4 | trois états par annonce : connue · aucune · pas su | §5 |
| D5 | carte : une ligne ou une porte, modification en place ; au-dessus de la liste, UNE fois, ce que ça engage + le geste « retrait automatique » s'il est éteint | §6 |
| D6 | « une règle pour toutes » : %, aperçu, prix d'achat signalé, vue respectée, une par une, bilan | §7 |
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
  Avant de finir : `git fetch` / relire `git log worktree-wf_d62e1db4-b5c-1`, et
  **rebaser** sur son dernier commit (commiter AVANT toute manipulation de
  branche : `CLAUDE.md`, « j'ai détruit mon propre travail en voulant rebaser »).
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
  les deux** (créées sur le site eBay) ⇒ reliées à aucune paire, aucun prix
  d'achat connu pour elles.
- **Aucune donnée d'offre nulle part** (ni rangée, ni lue par le code) : on ne
  sait PAS si l'Offre directe est déjà activée sur ces 2 annonces, ni si un seuil
  y est déjà posé à la main.
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
  **[doc, W981]**. `GetMyeBaySelling` (ce que VRM lit aujourd'hui) **ne les rend
  pas** ⇒ une annonce lue par cette seule liste a une règle « pas su ».
- Le seuil d'acceptation doit être **strictement sous le prix** (erreur 23004,
  **[tiers]**) ; le refus sous l'acceptation (21919263, **[tiers]**).
- Une offre **égale** au seuil est acceptée (« meets or exceeds », 3 sources sur
  4) ; le refus porte sur ce qui est **strictement en dessous**.
- **Changer le prix d'une annonce fait tomber les seuils** (W981, `StartPrice`
  « for Revise calls ») — ou fait refuser le changement (23004). VRM change un prix
  par `ReviseInventoryStatus` (`handleRevise`), qui ne sait pas porter les seuils.
- Retirer un seuil : `<DeletedField>Item.ListingDetails.BestOfferAutoAcceptPrice</DeletedField>`
  (frère de `<Item>`) **[doc actuelle]** — **absent de la liste blanche 2016 de
  `ReviseFixedPriceItem` : [non mesuré]**.
- Pas de « vérifier à blanc » pour `ReviseFixedPriceItem` : on relit après.
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

À l'écran, le mot est **« règle d'offre »** ; la ligne de carte commence par
**« Offres reçues : »** (précision de D5 : « Offres : » se confondrait avec le
bouton voisin « Faire une offre aux observateurs », qui est une offre ENVOYÉE).

⚠️ **Mots interdits dans `src/App.jsx`** (code sans commentaires, chaînes
comprises — `audit-offres-auto.cjs`, regex insensible à la casse
`accept\w*[^\n<>{}]{0,40}(automatiquement|tout(?:e)?\s+seule?)|acceptation\s+auto`) :
jamais « automatiquement » ni « tout seul / toute seule » dans les 40 caractères
qui suivent « accept… » sur la même ligne, jamais « acceptation auto… », jamais
« Min. accepté », jamais un champ `onCommit={…minPrice…}`. Les phrases de ce
document passent toutes ; **relancer l'audit après chaque phrase ajoutée**. Les
noms d'identifiants (`accepte`, `regleOffre`) passent.

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

### 3.2 La règle de validation, partagée app ↔ serveur (§11)

Dans `api/_lib/ebay.js`, exportée (pour que l'audit la compare à celle de l'app,
comme `suffixeCompte`) :

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
```
La copie d'App.jsx est **identique** (même nom, mêmes codes, mêmes messages).
Les montants partent en JSON **nombres** ; une chaîne (`"72"`) est refusée
(`montant`).

### 3.3 Une seule lecture de la règle dans un `GetItem` (§11)

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
  if (p.v == null || Number.isNaN(p.v)) return null;                 // pas de prix : réponse incomplète
  const a = montantXmlLu(ld, 'BestOfferAutoAcceptPrice'), r = montantXmlLu(ld, 'MinimumBestOfferPrice');
  if (Number.isNaN(a.v) || Number.isNaN(r.v)) return null;
  const en = bo == null ? null : (/<BestOfferEnabled>\s*true\s*<\/BestOfferEnabled>/i.test(bo) ? true : (/<BestOfferEnabled>\s*false\s*<\/BestOfferEnabled>/i.test(bo) ? false : null));
  const deviseAnnonce = p.dev || lireBalise(blk, 'Currency') || '';
  return {
    lecture: { lu: true, offresActives: en, accepte: a.v, refuse: r.v, devise: a.dev || r.dev || deviseAnnonce, prix: p.v, lueA: Date.now() },
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
exige `<CurrentPrice` juste après `<`).

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
      lueA:    1760000000000,
      par:     "sync" | "regle" | "relire" | "revise" | "publication"
    }
    | { lu: false, raison: "lecture-ratee" | "apres-ecriture" | "incertain", lueA, par }
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
async function rangerReglesOffre(ctx, lectures, garder) {
  const id = ligneDe('ebay_offres', ctx);
  const d = await lireDonnee(id, ctx.owner);
  if (d === undefined) return null;
  const items = { ...((d && d.items && typeof d.items === 'object' && !Array.isArray(d.items)) ? d.items : {}) };
  for (const [k, v] of Object.entries(lectures || {})) if (ID_EBAY.test(k) && v && typeof v === 'object') items[k] = v;
  if (garder instanceof Set) for (const k of Object.keys(items)) if (!garder.has(k) && !(lectures && lectures[k])) delete items[k];
  const cles = Object.keys(items).sort((x, y) => (Number(items[y].lueA) || 0) - (Number(items[x].lueA) || 0)).slice(0, REGLES_MAX);
  return storeData(id, { items: Object.fromEntries(cles.map((k) => [k, items[k]])), capturedAt: Date.now() }, ctx.owner);
}
```
`lireDonnee` lit `select=data` : acceptable ici (ligne bornée à 300 entrées
d'environ 150 octets, ≈ 45 Ko au pire ; quelques centaines d'octets chez lui).

### 3.5 `handleRegleOffre` — poser, changer, retirer

**Requête** (le navigateur n'envoie JAMAIS de prix) :
```
{ action: 'regleoffre', itemId: '<chiffres>', accepte: <nombre|null>, refuse: <nombre|null> | (clé absente), confirme: true, compte?: '<clé16hex>' }
```
- `accepte` nombre ⇒ poser/changer ; `accepte: null` ⇒ **retirer** (acceptation
  ET refus).
- `refuse` nombre ⇒ poser/changer le refus ; `refuse: null` ⇒ pas de refus (le
  retirer s'il existe) ; **clé absente** ⇒ ne pas toucher au refus existant (geste
  groupé, §7).

**Ordre — toutes les gardes avant le moindre appel d'écriture chez eBay :**

```
1.  b.confirme !== true                       → 400 { reason:'confirmation', error:'Confirme la règle d\'offre : rien n\'a été envoyé à eBay.' }   (zéro appel eBay)
2.  !ID_EBAY.test(itemId)                     → 400 { error:'annonce eBay invalide' }
3.  accepte absent du corps (undefined)        → 400 { reason:'montant', … }
    v = valideRegleOffre({ accepte, refuse: ('refuse' in b) ? b.refuse : undefined, prix: null })
    !v.ok                                     → 400 { reason: v.code, error: v.err }                    (zéro appel eBay)
4.  at = await jetonDe(ctx); !at.ok           → at.status { reason: at.reason, error: at.error }
5.  L = await listeVendeur(at.token)
    !L.ok                                     → 503 { reason:'pas-su', error:'Je n\'ai pas pu relire tes annonces eBay — rien n\'a été envoyé.' }
    L.programmees has itemId                  → 409 { reason:'programmee', error:'Elle n\'est pas encore en ligne : pose la règle dans son brouillon avant de la programmer, ou quand elle sera en ligne.' }
    !L.actives has itemId && L.complet        → 409 { reason:'pas-sur-ce-compte', compte: pseudo, error:`Cette annonce n'est pas en vente sur ton compte eBay ${nom} — rien n'a été envoyé.` }
    !L.actives has itemId && !L.complet       → 503 { reason:'pas-su', error:'Tu as plus de 1 000 annonces sur ce compte eBay : je n\'ai pas pu vérifier que celle-ci y est — rien n\'a été envoyé.' }
6.  pre = await lireRegleOffre(at.token, itemId)
    !pre.ok                                   → 503 { reason:'pas-su', error:'Je n\'ai pas pu relire l\'annonce chez eBay (prix, état) — rien n\'a été envoyé.' }
    !/^(FixedPriceItem|StoresFixedPrice)$/.test(pre.annonce.type)
                                              → 409 { reason:'format', error:'Ce n\'est pas une annonce à prix fixe : eBay n\'y propose pas d\'offres.' }
    pre.annonce.statut && pre.annonce.statut !== 'Active'
                                              → 409 { reason:'plus-en-vente', error:'Elle n\'est plus en vente sur eBay — rien n\'a été envoyé.' }
    pre.annonce.devise !== 'EUR'              → 409 { reason:'devise', error:'Annonce dans une autre devise que l\'euro : VRM ne pose pas de règle dessus.' }
    v2 = valideRegleOffre({ accepte, refuse, prix: pre.annonce.prix })   // LE PRIX D'eBAY, maintenant
    !v2.ok                                    → 409 { reason: v2.code, prix: pre.annonce.prix, error: v2.err }   (seuil-prix ⇒ 409)
    refuse clé absente && accepte != null && pre.lecture.refuse != null && round(pre.refuse) >= round(accepte)
                                              → 409 { reason:'refuse-existant', refuse: pre.lecture.refuse, error:`eBay refuse déjà les offres sous ${eur(refuse)} : la règle doit être au-dessus. Rien n'a été envoyé.` }
7.  Idempotence (aucune révision inutile : 250 révisions/jour/annonce chez eBay) :
    accepte != null && pre.accepte === accepte && (refuse absent || pre.refuse === refuse) && pre.offresActives !== false
    OU accepte === null && pre.accepte == null && pre.refuse == null
                                              → rangerReglesOffre(ctx, { [itemId]: { ...pre.lecture, par:'regle' } })
                                                200 { ok:true, inchange:true, verifie:true, lecture: pre.lecture, avertissements:[], range }
8.  L'écriture (XML §3.6) :  r = await tradingCall(at.token, 'ReviseFixedPriceItem', inner)
    sansAck(r)                                → rangerReglesOffre(ctx, { [itemId]: { lu:false, raison:'incertain', lueA, par:'regle' } })
                                                504 { reason:'incertain', error:'eBay n\'a pas répondu clairement — je ne sais pas si la règle est posée. « Relire chez eBay » avant de recommencer.' }
    !r.ok                                     → 422 { reason:'refus', error: messageEbaySur(r.err) || 'eBay a refusé la règle — rien n\'a changé.', erreurs: r.erreurs }
                                                (RIEN n'est rangé : l'annonce n'a pas changé, l'ancienne lecture reste vraie)
9.  La vérité d'eBay : post = await lireRegleOffre(at.token, itemId)
    !post.ok                                  → range { lu:false, raison:'apres-ecriture', … }   // l'ancienne lecture est périmée
                                                200 { ok:true, verifie:null, lecture:null, avertissements: r.avertissements, range }
    sinon                                     → range { ...post.lecture, par:'regle' }
                                                verifie = memeRegle(post.lecture, demandé)
                                                200 { ok:true, verifie, lecture: post.lecture, avertissements: r.avertissements, range, compte: pseudo }
```
`memeRegle` : `accepte` demandé = lu (centimes égaux, `null` = `null`) ET, si
`refuse` était dans le corps, refus demandé = lu ; pour un retrait : lu
`accepte == null` et lu `refuse == null`.

`verifie:false` reste **200 `ok:true`** (eBay a dit « fait » ; ce qui est rangé
est ce qu'eBay montre ; l'écran dit l'écart). Un avertissement 21992 (« le refus
automatique a sauté ») arrive dans `avertissements` et se voit dans `verifie`.

Les messages renvoyés passent tous par `messageEbaySur` (aucun `Bearer …`, aucun
`v^1.1#…`, 300 caractères).

### 3.6 Le XML exact envoyé à `ReviseFixedPriceItem`

Montant : `montantXml(v) = (Math.round(v * 100) / 100).toFixed(2)`. `currencyID="EUR"`
toujours (une annonce non-EUR a été refusée à l'étape 6).

**Poser / changer** (`accepte` nombre) :
```xml
<Item><ItemID>{itemId}</ItemID>{BO}<ListingDetails><BestOfferAutoAcceptPrice currencyID="EUR">{X}</BestOfferAutoAcceptPrice>{MIN}</ListingDetails></Item>{DEL}
```
- `{BO}` = `<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>`
  **seulement si** `pre.lecture.offresActives !== true` (« si besoin », D1 : ne
  pas renvoyer le booléen quand il est déjà vrai — eBay verrouille ce booléen
  quand des offres sont en attente **[doc]**).
- `{MIN}` = `<MinimumBestOfferPrice currencyID="EUR">{Y}</MinimumBestOfferPrice>`
  si `refuse` est un nombre ; sinon rien.
- `{DEL}` = `<DeletedField>Item.ListingDetails.MinimumBestOfferPrice</DeletedField>`
  si `refuse === null` (clé présente) ET `pre.lecture.refuse != null` ; sinon rien.

**Retirer** (`accepte: null`) :
```xml
<Item><ItemID>{itemId}</ItemID></Item><DeletedField>Item.ListingDetails.BestOfferAutoAcceptPrice</DeletedField>{DELMIN}
```
- `<DeletedField>Item.ListingDetails.BestOfferAutoAcceptPrice</DeletedField>` si
  `pre.lecture.accepte != null` ; `{DELMIN}` = celui du refus si
  `pre.lecture.refuse != null`.
- On ne touche **pas** à `BestOfferEnabled` : retirer la règle, c'est « les offres
  t'arrivent, c'est toi qui décides », pas couper les offres.
- **[non mesuré]** : `DeletedField` sur ces chemins avec `ReviseFixedPriceItem`.
  Si eBay refuse, l'étape 8 rend son message tel quel (422) et l'écran dit
  « retire-la sur eBay (Voir sur eBay ↗) ». Aucun repli automatique (pas de
  `BestOfferEnabled=false` à la place — ce n'est pas le même geste).

### 3.7 `handleRegleOffreLire` — « Relire chez eBay »

Requête : `{ action:'regleoffrelire', itemIds:['…', …], compte? }` (1 à 20
identifiants, dédoublonnés).
```
ids invalides (pas un tableau, 0, > 20, un non-ID_EBAY) → 400 { reason:'annonces', error:'Liste d\'annonces eBay invalide (1 à 20).' }   (zéro appel)
jetonDe ; listeVendeur(token) KO                      → 503 { reason:'pas-su', … }   (RIEN n'est rangé)
aMoi = ids de L.actives ∪ L.programmees
pour chaque id (l'un après l'autre, jamais en parallèle) :
  id ∉ aMoi  → rendu[id] = { lu:false, raison: L.complet ? 'pas-sur-ce-compte' : 'pas-su' }   (pas rangé : avec un autre jeton, eBay ne montrerait pas les seuils)
  sinon      → g = await lireRegleOffre(token, id)
               lecture = g.ok ? { ...g.lecture, par:'relire' } : { lu:false, raison:'lecture-ratee', lueA, par:'relire' }
               rendu[id] = lectures[id] = lecture
range = Object.keys(lectures).length ? await rangerReglesOffre(ctx, lectures) : true
200 { ok:true, lectures: rendu, range }
```

### 3.8 La synchro (`handleSync`) lit la règle SANS appel de plus

`handleSync` fait déjà `tradingGetItem(token, itemId)` (`DetailLevel ReturnAll`)
pour les 20 premières annonces actives. Changer `tradingGetItem` pour qu'il rende
aussi `_regle: lectureRegleDe(res.xml, itemId)` (même réponse, zéro appel de
plus). Dans la boucle :
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
20ᵉ n'est pas lue : son entrée précédente reste (avec sa date) — ou elle est « pas
su » à l'écran (jamais « aucune »). **Aucune boucle de `GetItem` ajoutée** : les
lectures supplémentaires ne partent que sur clic (« Relire chez eBay ») ou après
une écriture.

### 3.9 Le changement de prix (`handleRevise`) dit si eBay a fait tomber la règle

`handleRevise` (ReviseInventoryStatus : prix/stock) ne peut pas porter les seuils
et eBay les fait tomber quand le prix change **[doc]** (ou refuse le prix :
23004 **[tiers]**). Sans rien dire, l'écran continuerait d'afficher « eBay accepte
dès 72 € » — un faux. Ajout, **seulement quand `b.price` est fourni** :
- avant l'appel : `avant = (await lireDonnee(ligneDe('ebay_offres', ctx), ctx.owner))` →
  l'entrée de cet itemId (ou `undefined` si la ligne est illisible) ;
- après un succès (`r.ok`) : `post = await lireRegleOffre(at.token, itemId)` ;
  ranger `post.ok ? { ...post.lecture, par:'revise' } : { lu:false, raison:'apres-ecriture', … }` ;
- réponse 200 : `{ ok:true, ack, regle: { lecture: post.ok ? post.lecture : null, tombee } }`
  avec `tombee = (avant && avant.lu && avant.accepte != null) ? (post.ok ? post.lecture.accepte == null : null) : false`
  (`null` = pas su).
Les branches `sansAck` (504) et refus (422) ne changent pas — le message d'eBay
(23004) remonte tel quel. Une annonce sans prix fourni (stock seul) : rien de
neuf.

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
    const v = valideRegleOffre({ accepte: o.accepte === undefined ? null : o.accepte, refuse: o.refuse === undefined ? null : o.refuse, prix: Number.isFinite(prix) ? prix : null });
    if (!v.ok) return { err: 'Règle d\'offre : ' + v.err + ' Rien n\'a été envoyé à eBay.' };
    return { regle: v.accepte == null ? null : { accepte: v.accepte, refuse: v.refuse == null ? null : v.refuse } };
  }
  ```
- `handleVerify`, `handlePublish`, `handleProgrammer` : juste après `avecSku`,
  `const ro = regleDeItem(it0); if (ro.err) return { status: 400, body: { ok:false, reason:'offre', error: ro.err } };`
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
- Après un `publish` / `programmer` réussi **avec** une règle : `post =
  lireRegleOffre(token, itemId)`, rangé (`par:'publication'`, ou
  `{lu:false, raison:'apres-ecriture'}`), et la réponse porte
  `offre: { verifie: true|false|null, lecture }`. Sans règle : aucun appel de plus,
  réponse inchangée.

### 3.11 Ce que le serveur ne fait jamais
- Aucun appel `RespondToBestOffer`, aucune route de négociation qui accepte, aucun
  `bestOfferTerms` (Inventory). Les seuils ne s'écrivent QUE par
  `ReviseFixedPriceItem` (§3.6) et `itemXml` (§3.10).
- Aucune boucle de fond, aucun cron, aucune pose sans corps venu d'un clic.

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
- « Relire chez eBay » et le geste groupé : regroupés par compte, un compte après
  l'autre, chacun avec son `compte`.
- Le sélecteur ne change que ce qu'on voit : le bloc, la ligne « pas su » et le
  geste groupé portent sur `itemsVue` (§7).

---

## 5. Les trois états (D4) — une fonction, consommée partout (§11)

Dans `src/App.jsx`, au niveau module, près de `doublesVenteEbay` :

```js
// L'ÉTAT DE LA RÈGLE D'OFFRE D'UNE ANNONCE eBAY — trois états, jamais deux.
//   regles : Map(`${ref}:${itemId}` → entrée de `ebay_offres`) ; `illisibles` :
//   Set des refs de compte dont la ligne n'a pas pu être lue.
// Rend { etat:'connue', accepte, refuse, offresActives, lueA }
//    | { etat:'aucune', refuse, offresActives, lueA }
//    | { etat:'pas-su', raison:'illisible'|'jamais'|'lecture-ratee'|'apres-ecriture'|'incertain'|'prix-change'|'devise' }
function etatRegleOffre(it, regles, illisibles) {
  const ref = (it && it._compte) || 'principal';
  if (illisibles && illisibles.has(ref)) return { etat: 'pas-su', raison: 'illisible' };
  const e = regles && regles.get(ref + ':' + String(it && it.itemId));
  if (!e) return { etat: 'pas-su', raison: 'jamais' };
  if (e.lu !== true) return { etat: 'pas-su', raison: e.raison || 'lecture-ratee' };
  if (e.devise && e.devise !== 'EUR') return { etat: 'pas-su', raison: 'devise' };
  const p = Number(String(it.price == null ? '' : it.price).replace(',', '.'));
  if (e.prix != null && Number.isFinite(p) && Math.round(p * 100) !== Math.round(Number(e.prix) * 100)) return { etat: 'pas-su', raison: 'prix-change' };
  if (e.accepte != null && e.offresActives !== false) return { etat: 'connue', accepte: e.accepte, refuse: e.refuse, offresActives: e.offresActives, lueA: e.lueA };
  return { etat: 'aucune', refuse: e.refuse, offresActives: e.offresActives, lueA: e.lueA };
}
```
- **« pas su » n'affiche aucun montant et ne dit pas « aucune »**, nulle part.
- `prix-change` : le prix rangé dans `ebay_listings` (dernière synchro) ≠ celui
  vu à la lecture de la règle ⇒ eBay a pu la faire tomber ⇒ « pas su ».
- Les gestes posent un état LOCAL (Map `reglesLocales`, même clé) qui prime sur
  la ligne lue jusqu'au prochain chargement : réponse `ok` avec `lecture` ⇒ la
  lecture ; `verifie:null`, `incertain`, coupure ⇒ `{ lu:false, raison:'incertain' }` ;
  refus (422) ⇒ rien ne change.

Fonctions de l'app à ajouter (module, une seule fois chacune) :
- `valideRegleOffre` — copie EXACTE de §3.2.
- `montantSaisi(s)` : `''` ⇒ `null` ; `/^\s*\d{1,5}([.,]\d{1,2})?\s*$/` ⇒ nombre ;
  sinon `NaN` (⇒ message « Un montant en euros… »).
- `seuilDePourcent(prix, pct)` : `prix` nombre > 0, `pct` entier 50–99 ⇒
  `Math.floor(Math.round(prix * 100) * pct / 10000)` (euros entiers, arrondi vers
  le bas) ; rend `null` si le résultat est ≤ 0 ou ≥ prix.
- `resultatRegleOffre({ code, j })` — la règle des issues, pour la carte ET le
  geste groupé :
  - `j.ok && j.verifie === true` ⇒ `{ etat:'ok', lecture: j.lecture }` ;
  - `j.ok && j.verifie === false` ⇒ `{ etat:'ecart', lecture: j.lecture }` ;
  - `j.ok && j.verifie == null` ⇒ `{ etat:'non-relu' }` ;
  - `code === 0 || !j || code === 504 || j.reason === 'incertain'` ⇒ `{ etat:'incertain', msg }` ;
  - sinon ⇒ `{ etat:'ko', msg: j.error || 'eBay a refusé la règle — rien n\'a changé.' }`.
- `achatParNum(fiches, buyByNum)` : Map N° (`cleNum`) → prix d'achat
  (`prixAchatDe`), **seulement si UNE seule fiche porte ce N°** (sinon absent :
  un N° porté par deux fiches est ambigu, rien n'est dit). Le prix d'achat ne se
  devine jamais : inconnu ⇒ rien n'est dit.

---

## 6. L'écran eBay → Annonces (D5)

Peau `EBAY_SKIN` uniquement : `E.accent` (#3665F3) pour UN bouton principal,
`E.warn` pour ce qui demande un geste, `E.muted`, `E.text`. **Pas de vert, pas de
rouge** (ne pas recopier `INV_STATUS.online.color` ni `E.danger`). Tous les
champs à `fontSize: 16` (iOS ne zoome pas). Aux deux tailles : aucun
débordement horizontal (lignes en `flexWrap: 'wrap'`, titres en ellipse).

### 6.1 Lecture des règles dans `EbayAnnonces`
- États : `const [regles, setRegles] = React.useState(undefined)` (undefined en
  cours · objet `{ map: Map, illisibles: Set }`) et
  `const [reglesLocales, setReglesLocales] = React.useState(() => new Map())`.
- Chargement dans `charger` (à côté de `ebay_listings`), même `comptesEbay` :
  `lireEbayParCompte('ebay_offres', 'items:data->items,capturedAt:data->>capturedAt', comptesEbay)` ;
  registre illisible ⇒ tous les comptes dans `illisibles` ; `ligne === undefined`
  ⇒ ce compte dans `illisibles` ; `null` ⇒ aucune entrée (⇒ « jamais »).
- `buyByNum` : `React.useMemo(() => load('vinted_buyprice_by_num', {}) || {}, [nuage, items])`
  et `achats = achatParNum(fiches, buyByNum)` — **déclarés APRÈS `fiches` et
  `pris`** (§4.6 : un `useMemo` s'exécute tout de suite). Tous les hooks neufs
  vont **avant** le premier `return` de `EbayAnnonces` (`if (baseKO) return …`).
- L'état de chaque annonce se calcule APRÈS `itemsVue` (une fonction simple, pas
  un hook) ; l'état local d'un geste prime sur la ligne lue :
  ```js
  const etatDe = (it) => {
    if (regles === undefined) return null;                       // en cours : ni ligne, ni bloc (pas de clignotement)
    const cle = ((it && it._compte) || 'principal') + ':' + String(it.itemId);
    const l = reglesLocales.get(cle);
    return l ? etatRegleOffre(it, new Map([[cle, l]]), null) : etatRegleOffre(it, regles.map, regles.illisibles);
  };
  ```
  `etatDe(it) === null` ⇒ la carte n'affiche pas la ligne d'offre, et ni §6.5 ni
  §6.6 ne s'affichent.

### 6.2 La ligne de la carte (`EbayAnnonceCard`, props neuves `regle`, `achat`, `onRegle`)

Sous la rangée de gestes existante (Relier / Offre aux observateurs), une ligne
`data-regle-offre-ligne={itemId}` portée par un élément
`data-regle-offre={etat}` (+ `data-regle-accepte="72.00"` et
`data-regle-refuse="60.00"|""` en état connu, `data-regle-raison={raison}` en
« pas su »), 12,5 px :

| état | rendu | gestes |
|---|---|---|
| connue | `Offres reçues : eBay accepte dès 72,00 €` (+ ` · refuse sous 60,00 €`) | bouton `Modifier` (`data-regle-modifier`) |
| aucune | (si un refus existe seul : `Offres reçues : eBay refuse sous 50,00 €`) | bouton `Définir une règle d'offre` (`data-regle-ouvrir`) |
| pas su | `Offres reçues : —` (muted, aucun montant, jamais « aucune ») | bouton `Définir une règle d'offre` (`data-regle-ouvrir`) |

La raison d'un « pas su » ne s'écrit PAS sur la carte (§7 : elle serait la même
sur chaque carte) : elle est dans la ligne au-dessus de la liste (§6.6).

### 6.3 Le panneau en place (`data-regle-panneau={itemId}`)
Ouvert par `Modifier` / `Définir une règle d'offre` (ferme les panneaux Relier et
Offre de la même carte, comme eux entre eux). Fond `E.card2`, rayon 12.
- Texte (muted, 12 px) : « Prix de l'annonce : 90,00 €. Une offre égale ou
  supérieure au montant ci-dessous est acceptée par eBay sans te demander : la
  paire est vendue à ce prix. En dessous, l'offre t'arrive sur eBay. »
  (+ en « pas su » : « Règle actuelle : pas encore lue chez eBay. »)
- Champ `Accepter les offres dès (€)` — `data-regle-saisie-accepte`,
  `inputMode="decimal"`, pré-rempli avec `accepte` (connue) sinon vide ;
  placeholder `montant en €`.
- Champ `Refuser les offres sous (€) — facultatif` — `data-regle-saisie-refuse`,
  pré-rempli avec le refus lu, sinon vide.
- Validation en direct (`montantSaisi` puis `valideRegleOffre` avec
  `prix = Number(it.price)`) ; message `data-regle-erreur` (E.warn) avec le
  texte de `err`. Bouton désactivé tant qu'il y a une erreur ou que
  « accepte » est vide.
- Prix d'achat connu (`achat` ≠ null) et `accepte < achat` : `data-regle-sous-achat`
  (E.warn, non bloquant) « C'est sous ton prix d'achat (85,00 €) : une offre à ce
  montant te ferait vendre à perte. »
- Boutons : `Enregistrer la règle` (`data-regle-enregistrer`, E.accent) ·
  `Annuler` (`data-regle-annuler` : ferme, **n'envoie rien**) · si une règle
  existe (lu `accepte` ou `refuse` non nul) : `Retirer la règle`
  (`data-regle-retirer`).
- **Enregistrer** ⇒ `askConfirm` (feuille de l'app) :
  - titre : ``eBay acceptera seul les offres dès ${eur(X)} ?``
  - texte (lignes, seules celles qui s'appliquent) :
    1. ``« ${titre} » est à ${eur(prix)} sur eBay${plusieursComptes ? ` (compte ${nom})` : ''}. Toute offre de ${eur(X)} ou plus sera acceptée par eBay sans te demander : la paire sera vendue à ce prix, et l'acheteur devra la payer.``
    2. refus saisi : ``Toute offre sous ${eur(Y)} sera refusée par eBay.`` ; refus effacé alors qu'il existait : ``Le refus sous ${eur(ancien)} sera retiré.``
    3. `offresActives !== true` : `Les offres seront activées sur cette annonce : les acheteurs pourront t'en faire.`
    4. pas de N° (`numero` vide) : `Cette annonce n'est reliée à aucune paire : si eBay la vend, VRM ne saura pas quelle paire retirer de Vinted. « Relier à une paire » d'abord.`
    5. sous le prix d'achat : ``C'est sous ton prix d'achat (${eur(achat)}).``
    6. X < 50 % du prix : ``C'est moins de la moitié du prix de l'annonce.``
  - boutons : `Oui, poser la règle` / `Annuler`. **Annuler n'envoie rien.**
  - Oui ⇒ `appelEbay(...)` avec **exactement** (ordre des clés compris) :
    `{ action: 'regleoffre', itemId: String(it.itemId), accepte: X, refuse: Y (nombre) ou null, confirme: true, ...corpsCompteEbay(it._compte) }`
    — pour le principal, pas de clé `compte`.
- **Retirer** ⇒ un clic, pas de feuille (D2 : retirer rend la main, ça n'engage
  rien) : `{ action: 'regleoffre', itemId, accepte: null, refuse: null, confirme: true, ...corpsCompteEbay(it._compte) }`.
- Pendant l'envoi : bouton « Envoi… », désactivé (jamais deux envois).

### 6.4 Après la réponse (`resultatRegleOffre`) — dit sur la carte (`data-ebay-info`)
| issue | message (E.text si ✓, E.warn sinon) | état local |
|---|---|---|
| ok, posée | `✓ eBay accepte maintenant les offres dès 72,00 €.` (+ ` Refus sous 60,00 €.`) | la lecture |
| ok, retirée | `✓ Règle retirée : les offres t'arrivent sur eBay, c'est toi qui décides.` | la lecture |
| ok `inchange` | `✓ C'était déjà la règle sur eBay.` | la lecture |
| écart | `eBay a répondu « fait », mais l'annonce montre : {état lu en clair}. Regarde-la sur eBay.` + avertissements d'eBay | la lecture (la vérité) |
| non relu | `eBay a répondu « fait », mais je n'ai pas pu le relire — « Relire chez eBay » plus haut.` | `pas-su` |
| incertain | le `error` de la route (sinon : `eBay n'a pas répondu clairement — je ne sais pas si la règle est posée. « Relire chez eBay » avant de recommencer.`) | `pas-su` |
| refus | `error` de la route (le message d'eBay) ; pour un retrait refusé, ajouter ` Retire-la sur eBay :` + le lien existant `Voir sur eBay ↗` | inchangé |

Les avertissements d'eBay (`j.avertissements`) s'ajoutent après « ✓ … » :
``eBay signale : « … ».``

### 6.5 Le bloc « ce que ça engage », UNE fois au-dessus de la liste
Seulement si au moins une annonce de `itemsVue` est en état **connue** ; placé
avec les phrases existantes au-dessus de la liste (à côté de
`data-ebay-non-reliees`), `data-regles-engagement={n}` :
- « Règle d'offre active sur {n} annonce{s} : eBay accepte, sans te demander, toute
  offre à partir du montant fixé — une offre acceptée est une vente, au prix de
  l'offre. En dessous, l'offre t'arrive sur eBay. »
- Si `retraitAuto === false` : « Si une de ces paires se vend sur Vinted, elle
  reste en vente ici et une offre peut encore y être acceptée. » + bouton
  séparé (élément à part : le texte d'un bouton ne doit pas suivre « accepter »
  dans la même chaîne) `Retrait automatique d'eBay ↓`
  (`data-regles-vers-retrait`) qui **fait défiler** jusqu'à `[data-ebay-retrait-auto]`
  et met le focus sur `[data-ebay-retrait-auto-bouton]` — **il n'allume rien**
  (allumer garde sa propre confirmation), aucune requête.
- Si k de ces n annonces ont un `numero` vide : « {k} de ces annonces n'{est|sont}
  reliée{s} à aucune paire : si eBay en vend une, VRM ne saura pas laquelle retirer
  de Vinted. » (la porte reste « Relier à une paire » sur la carte).

### 6.6 La ligne « pas su », UNE fois au-dessus de la liste
Seulement si au moins une annonce de `itemsVue` est en « pas su »,
`data-regles-pas-su={n}` et `data-regles-causes="jamais:1,prix-change:1"` (les
raisons brutes non nulles, dans l'ordre fixe `illisible, jamais, prix-change,
lecture-ratee, apres-ecriture, incertain, devise`) :
- « Règle d'offre pas encore lue pour {n} annonce{s} ({causes}) » + bouton
  `Relire chez eBay` (`data-regles-relire`), désactivé pendant la lecture
  (« Lecture… »).
- Causes (séparées par « · », une cause à zéro n'est pas écrite) : `jamais` ⇒
  « jamais lue » ; `prix-change` ⇒ « prix changé depuis : eBay retire la règle
  quand le prix change » ; `lecture-ratee` / `apres-ecriture` / `incertain` ⇒
  « dernière lecture pas claire » ; `illisible` ⇒ « je n'ai pas pu relire ce que
  VRM en sait » ; `devise` ⇒ « autre devise que l'euro ».
- Le clic : pour chaque compte RELIÉ (`comptesRelies`) qui a des annonces « pas
  su » dans la vue, par paquets de 20, l'un après l'autre :
  `{ action:'regleoffrelire', itemIds:[…], ...corpsCompteEbay(ref) }` ; puis
  relire `ebay_offres` (et appliquer `j.lectures` en local en attendant). Un
  compte qui n'a pas répondu est nommé : « eBay n'a pas répondu pour le compte
  {nom} — réessaie dans un moment. » ; un compte non relié est sauté et nommé.
- Rien n'est relu tout seul à l'ouverture de l'écran (la synchro existante, au
  plus toutes les 6 h, lit déjà les 20 premières annonces sans appel de plus).

⚠️ Ne pas réutiliser `data-ebay-pas-su` (c'est la ligne « je n'ai pas pu lire tes
ventes », que `ebay-annonces.cjs` exige absente en marche normale). Aucune
phrase neuve ne contient « pas reliée » hors du bloc §6.5, ni « pas
d'observateur à qui l'envoyer ».

### 6.7 Le changement de prix sur la carte (et la baisse des paires qui dorment)
- `enregistrer` (✏️ Modifier le prix / le stock) : si l'état est **connue** et le
  nouveau prix ≤ `accepte` ⇒ rien n'est envoyé, message : « Ta règle d'offre
  accepte dès 72,00 € : le prix doit rester au-dessus. Change ou retire d'abord la
  règle. »
- `resultatReviseEbay` (une règle pour les deux endroits qui changent un prix) :
  en `ok`, si `j.regle && j.regle.tombee === true` ⇒ `msg` « ✓ Prix changé — mais
  eBay a retiré ta règle d'offre (il le fait quand le prix change). Repose-la :
  « Définir une règle d'offre ». » ; `tombee === null` ⇒ « ✓ Prix changé — je n'ai
  pas pu relire ta règle d'offre ». La carte affiche ce `msg` à la place de
  « ✓ Modifié sur eBay » quand il n'est pas vide, et passe l'état local à la
  `j.regle.lecture` (ou `pas-su`).

### 6.8 Ce qu'on ne touche pas
`EbayProgrammees` (les programmées), l'offre aux observateurs, Relier, le retrait
automatique (sauf le lien de §6.5), l'onglet Compte eBay, tout Vinted.

---

## 7. « Une règle pour toutes » (D6)

Composant `EbayReglesToutes` (props : `items` = `itemsVue` (annonces EN LIGNE de
la vue), `etatDe`, `achats`, `comptesEbay`, `plusieursComptes`, `vueSeule`,
`onFini`). Porte : bouton `Une règle pour toutes` (`data-regles-toutes-ouvrir`)
sur la même ligne que §6.6 (ou seul s'il n'y a ni §6.5 ni §6.6), visible si
`connected === true` et `itemsVue.length > 0`.

### 7.1 Le panneau `data-regles-toutes`
- Texte : « Un pourcentage du prix de chaque annonce, arrondi à l'euro du
  dessous. Rien ne part avant ta confirmation. »
- Champ `Accepter les offres dès … % du prix` (`data-regles-pct`,
  `inputMode="numeric"`), entier **50 à 99** ; sinon `data-regles-pct-erreur` :
  « Entre 50 et 99 % (en dessous, fixe le montant annonce par annonce). » et pas
  d'aperçu (garde contre la faute de frappe « 9 » au lieu de « 90 »).
- Le refus n'est **pas** touché par ce geste (la clé `refuse` n'est pas envoyée).

### 7.2 L'aperçu `data-regles-apercu`, une ligne par annonce de la vue
`data-regles-ligne={itemId}`, `data-regles-statut`, `data-regles-seuil` (euros
entiers, `""` si exclue). Colonnes : case (`data-regles-choix`), titre (une ligne,
ellipse), « 90,00 € → dès 81 € », note, et le compte **seulement si la vue en
mélange plusieurs**.

| statut | quand | case | note |
|---|---|---|---|
| `nouvelle` | aucune règle connue (aucune ou pas su) | cochée | — |
| `remplace` | règle connue d'un AUTRE montant | cochée | « remplace 70,00 € » |
| `inchange` | règle connue du MÊME montant | absente | « déjà 72,00 € » |
| `exclue` | `seuilDePourcent` rend null | absente | « prix trop bas » |
| `exclue` | un refus connu ≥ seuil | absente | « eBay refuse déjà sous 75,00 € : baisse d'abord ce refus » |

En plus, sur une ligne cochable : prix d'achat connu et seuil < achat ⇒
`data-regles-sous-achat` « sous ton prix d'achat (85,00 €) » (E.warn) — **signalé,
pas décoché** (D6) ; pas de N° ⇒ « pas reliée » (muted).

### 7.3 Appliquer
- Bouton `Appliquer à {n} annonce{s}` (`data-regles-appliquer`), n = cases
  cochées ; désactivé si n = 0 ; **au plus 50 par lot** (quota eBay de 5 000 appels
  par jour pour toute l'application, ~4 appels par annonce) : au-delà, désactivé
  avec « 50 au plus à la fois : décoche-en, ou choisis un compte en haut. »
- `askConfirm` : titre ``Laisser eBay accepter les offres sur ${n} annonce${s} ?`` ;
  texte : ``Sur chacune, toute offre égale ou supérieure au montant affiché sera acceptée par eBay sans te demander : la paire sera vendue à ce prix.`` +
  (k sous le prix d'achat : ``\n${k} sous ton prix d'achat.``) + (r pas reliées :
  ``\n${r} reliée${r>1?'s':''} à aucune paire : si eBay en vend une, VRM ne saura pas laquelle retirer de Vinted.``) +
  ``\nVRM les règle une par une et te dit le résultat de chacune.`` ;
  boutons `Oui, régler les {n}` / `Annuler` — **Annuler n'envoie rien**.
- Oui ⇒ **une par une** (`await` chaque appel avant le suivant, jamais
  `Promise.all`), dans l'ordre de l'aperçu, chacune avec SON compte :
  `{ action: 'regleoffre', itemId, accepte: seuil, confirme: true, ...corpsCompteEbay(it._compte) }`
  (pas de clé `refuse`).
- Progression `data-regles-progres="i/n"` + bouton `Arrêter`
  (`data-regles-arreter`) : s'arrête après l'annonce en cours, le reste n'est pas
  envoyé (et le bilan le dit : « 2 non envoyées »).
- Chaque ligne affiche son issue (`resultatRegleOffre`) ; l'état local de chaque
  carte suit.
- **Bilan** `data-regles-bilan` avec `data-regles-total`, `data-regles-ok`,
  `data-regles-ecart`, `data-regles-incertain`, `data-regles-ko`,
  `data-regles-non-envoyees` :
  « {ok} sur {n} réglée{s}{ · e pas confirmée(s) par eBay}{ · i sans réponse claire
  d'eBay : relis-les}{ · ko refusée(s) : « {message d'eBay} » (×{nb}) …}{ · x non
  envoyée(s)} ». Les refus sont groupés par message. Puis relecture de
  `ebay_offres` (`onFini`).

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
- `brouillonCourant()` ajoute
  `offreAccepte: offreA.trim() || undefined, offreRefuse: offreR.trim() || undefined`
  (⚠️ `undefined`, pas `''` : `{...avant, ...brouillonCourant()}` doit EFFACER une
  ancienne valeur quand il vide le champ, et `JSON.stringify` jette `undefined` ⇒
  un brouillon sans règle garde exactement la forme d'aujourd'hui).
- Rouvrir un brouillon : `setOffreA(String(d.offreAccepte || ''))`,
  `setOffreR(String(d.offreRefuse || ''))`.
- `itemDeBrouillon(d)` (LA règle brouillon → annonce, §11), après le contrôle du
  prix :
  ```js
  const offreA = String(d.offreAccepte == null ? '' : d.offreAccepte).trim();
  const offreR = String(d.offreRefuse == null ? '' : d.offreRefuse).trim();
  let offre;
  if (offreA || offreR) {
    const a = montantSaisi(offreA), r = montantSaisi(offreR);      // null (vide) · nombre · NaN (illisible ⇒ refusé par valideRegleOffre)
    const v = valideRegleOffre({ accepte: a, refuse: r, prix: Number(String(d.prix).replace(',', '.')) });
    if (!v.ok) return { err: 'Règle d\'offre : ' + v.err };
    if (v.accepte != null) offre = { accepte: v.accepte, refuse: v.refuse == null ? null : v.refuse };
  }
  return { item: { …comme aujourd'hui…, ...(offre ? { offre } : {}) } };
  ```
  ⇒ sans règle, l'`item` est **exactement** celui d'aujourd'hui (même clé de
  vérification `cleVerifEbay`, mêmes corps envoyés : les bancs existants restent
  verts).
- `publier()` : si `b.item.offre` ⇒ **toujours** une confirmation (même s'il n'y a
  qu'un compte) : titre ``Publier, et laisser eBay accepter les offres dès ${eur(X)} ?`` ;
  texte : la ligne 1 de §6.3 adaptée (« Toute offre de … ou plus sera acceptée par
  eBay sans te demander : la paire sera vendue à ce prix. ») + le compte si
  plusieurs ; `Oui, publier` / `Annuler` (n'envoie rien). Sans règle : comportement
  d'aujourd'hui (confirmation seulement si plusieurs comptes).
- Résultat : `j.offre.verifie === true` ⇒ ajouter au message de réussite
  « Règle d'offre : eBay accepte dès 66,00 €. » ; `false` ⇒ « eBay n'a pas gardé la
  règle d'offre — définis-la sur la carte de l'annonce. » ; `null` ⇒ « Règle
  d'offre pas encore relue. »
- « Vérifier sans publier » envoie l'`item` avec son `offre` : la vérification à
  blanc d'eBay l'emporte (catégorie qui n'accepte pas les offres ⇒ son message).

### 8.2 Brouillons et planificateur
- `EbayBrouillons` : dans la ligne de méta d'un brouillon qui a une règle,
  `` · offres dès 66,00 €`` (`data-brouillon-offre="66.00"`).
- `EbayPlanificateur` : rien à changer dans l'envoi (`l.item` porte `offre` via
  `itemDeBrouillon`) ; la confirmation du lot ajoute, si k > 0 annonces du lot ont
  une règle : ``\n${k} avec une règle d'offre : eBay acceptera seul les offres dès le montant fixé sur chacune.``
- Côté serveur, vérification à blanc ET ajout portent le même bloc (§3.10).

---

## 9. Les preuves attendues

Méthode de `CLAUDE.md` §6 : un contrôle doit être **rouge sur le code d'avant**
(`git archive worktree-wf_d62e1db4-b5c-1 | tar -x -C /tmp/avant-regle`, y copier le
script, le lancer DEPUIS cet arbre) **et** rouge quand on réaffaiblit la règle
(mutations nommées). « La fonction n'existait pas avant » ne suffit pas. Un
audit/banc **ne meurt pas, il rapporte** (`essaie` partout).

### 9.1 `scripts/audit-ebay-route.cjs` — la route EXÉCUTÉE (étendre, ne pas dupliquer)

**Faux eBay à étendre** (données inventées) :
- `annonce(...)` accepte en `extra` : `regle: { actives: bool, accepte: '70.0'|null, refuse: '50.0'|null }`,
  `type` (défaut `FixedPriceItem`), `statut` (défaut `Active`), `devise` (défaut `EUR`).
- `GetItem` : rend une annonce **complète** quand le jeton est celui du compte qui
  la possède : `ItemID`, `SKU`, `ListingType`, `Currency`,
  `<StartPrice currencyID>`, `<SellingStatus><CurrentPrice currencyID>…<ListingStatus>`,
  `<BestOfferDetails><BestOfferEnabled>true</…>` si `regle.actives`,
  `<ListingDetails><StartTime>…[<BestOfferAutoAcceptPrice currencyID="EUR">][<MinimumBestOfferPrice …>]</ListingDetails>`,
  `<Description>`. Annonce d'un AUTRE compte : même chose **sans** les deux seuils
  (eBay ne les montre qu'au vendeur). Garder `mode.getitem === 'autre'` (retrait
  automatique) et l'émission du SKU/StartTime (les contrôles existants en
  dépendent). Modes neufs : `mode.getitem = 'ko' | 'reseau' | 'tronque'`
  (`tronque` = Ack Success, `<Item><ItemID>id</ItemID></Item>` seul) et
  `mode.getitemApres = 'ko'` (seulement les GetItem qui suivent une révision).
- `ReviseFixedPriceItem` : en plus de `ScheduleTime`, lit `BestOfferEnabled`,
  `BestOfferAutoAcceptPrice`, `MinimumBestOfferPrice`, chaque `<DeletedField>`, et
  les applique **seulement si l'annonce appartient au compte du jeton** (sinon
  `XML_ECHEC(ERR('21916590', 'Error', "Tu n'es pas le vendeur de cet objet (message inventé)."))`).
  Modes : `mode.regle = 'ok' | 'refus-prix'` (`ERR('23004','Error','Invalid AutoAccept price. The Best Offer Auto Accept Price must be less than the Buy It Now price. Bearer at-J v^1.1#SECRET-QUI-FUIRAIT')`)
  `| 'warning-21992'` (applique, Ack Warning + `ERR('21992','Warning','AutoDecline has been disabled or is no longer available.')`)
  `| '503-apres'` (applique puis HTML 503) `| 'reseau-apres'` (applique puis lève)
  `| 'ignore'` (Ack Success, n'applique rien).
- `ReviseInventoryStatus` (aujourd'hui dans la branche par défaut) : applique le
  prix ; si `mode.prix = 'efface'` (défaut) et que le prix change, **retire les
  deux seuils** (le comportement documenté) ; `mode.prix = 'refus-23004'` ⇒ échec 23004.
- Base : `mode.offresKo` ⇒ la lecture de `ebay_offres*` répond 500.
- `remettre()` remet ces modes ; les annonces neuves ne sont ajoutées que DANS la
  section (`ebay['at-J'].actives.push(...)`) pour ne pas changer les contrôles
  existants.

Fixtures de la section (inventées) :
```
R1 = annonce('110000000301', 'Nike Air Max 1 bleu taille 44', 'VRM-41', '80.0', debut)                                   // aucune règle, offres non activées
R2 = annonce('110000000302', 'Adidas Samba blanc taille 42', 'VRM-42', '90.0', debut, { regle: { actives: true, accepte: '70.0', refuse: '50.0' } })
R3 = annonce('110000000303', 'Salomon XT-6 noir taille 43', '', '120.0', debut, { type: 'Chinese' })
R4 = annonce('110000000304', 'Puma Suede gris taille 42', 'VRM-44', '60.0', debut, { statut: 'Completed' })
R5 = annonce('110000000305', 'Vans Old Skool noir taille 41', 'VRM-45', '50.0', debut, { devise: 'USD' })
R6 = annonce('120000000306', 'Asics Gel 1130 argent taille 39', 'VRM-46', '70.0', debut)   // sur le compte julien_pro (at-A2)
R7 = annonce('110000000307', 'New Balance 550 gris taille 44', 'VRM-47', '100.0', iso(Date.now() + 2*JOUR))   // PROGRAMMÉE sur at-J
```

**Contrôles neufs** (section « 12. LA RÈGLE D'OFFRE — c'est eBay qui accepte »),
chacun avec le compte d'appels chez eBay (`auCompte`) :

| # | situation | exigé |
|---|---|---|
| R-sess | `regleoffre`, `regleoffrelire` sans session | 401, zéro appel (ajouter les deux à `TOUTES`) |
| R-conf | `confirme` absent / `'true'` / `1`, pour une pose ET un retrait | 400 `confirmation`, zéro appel (boucle §3 existante) |
| R-id | `itemId` `'12a'`, `'110</ItemID><X>'`, `''` | 400 « annonce eBay invalide », zéro appel (boucle §4 existante) |
| R-mont | `accepte` 0, -5, `'72'` (chaîne), 72.555, 1e9, `accepte` absent ; `accepte:null` avec `refuse:60` ; `refuse` ≥ `accepte` (60/60, 60/70) ; `refuse` 0 | 400 (`montant`, `refuse-seul`, `refuse`, `refuse-montant`), zéro appel |
| R-prix | R1 à 80 € : `accepte` 80 puis 80.01 | 409 `seuil-prix`, `prix: 80`, appels = `GetMyeBaySelling,GetItem` (aucune révision) ; 79.99 passe |
| R-pose | R1, `accepte` 72, `refuse` null | appels `GetMyeBaySelling,GetItem,ReviseFixedPriceItem,GetItem` ; le corps de la révision contient **exactement** `<Item><ItemID>110000000301</ItemID><BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails><ListingDetails><BestOfferAutoAcceptPrice currencyID="EUR">72.00</BestOfferAutoAcceptPrice></ListingDetails></Item>` et aucun `DeletedField` ; 200 `ok`, `verifie:true`, `lecture.accepte === 72` ; ligne `ebay_offres` écrite owner J, `items['110000000301']` = lecture `par:'regle'` |
| R-refus | R1, `accepte` 72, `refuse` 60 | `<MinimumBestOfferPrice currencyID="EUR">60.00</MinimumBestOfferPrice>` DANS `ListingDetails`, après l'acceptation |
| R-actif | R2 (offres déjà actives), `accepte` 75, `refuse` 50 | **pas** de `<BestOfferDetails>` dans le XML |
| R-idem | R2, `accepte` 70, `refuse` 50 | 200 `inchange:true`, **aucune** `ReviseFixedPriceItem` |
| R-retrait | R2, `accepte:null, refuse:null` | XML `<Item><ItemID>110000000302</ItemID></Item><DeletedField>Item.ListingDetails.BestOfferAutoAcceptPrice</DeletedField><DeletedField>Item.ListingDetails.MinimumBestOfferPrice</DeletedField>`, aucun `BestOfferEnabled` ; relu aucune ⇒ `verifie:true` |
| R-garde-refus | R2, `accepte` 72, clé `refuse` ABSENTE | ni `MinimumBestOfferPrice` ni `DeletedField` (le refus d'eBay est gardé) ; et R2 avec refus 75 en base eBay, `accepte` 72, clé absente ⇒ 409 `refuse-existant`, aucune révision |
| R-ack | `mode.regle = '503-apres'` puis `'reseau-apres'` | 504 `incertain`, **jamais** 422 ; l'entrée rangée devient `{ lu:false, raison:'incertain' }` (l'ancienne lecture ne survit pas) |
| R-ebay-refus | `mode.regle = 'refus-prix'` | 422, `erreurs[0].code === '23004'`, `sansJeton(o)` vrai (aucun `Bearer`, aucun `v^1.1#`) ; **rien** n'est écrit dans `ebay_offres` |
| R-warning | `mode.regle = 'warning-21992'` sur une pose avec refus | 200 `ok`, `avertissements` contient le message ; `verifie` suit la relecture |
| R-ecart | `mode.regle = 'ignore'` | 200 `ok`, `verifie:false`, `lecture.accepte === null` rangée (la vérité d'eBay) |
| R-relu-ko | `mode.getitemApres = 'ko'` | 200 `ok`, `verifie:null`, entrée rangée `{ lu:false, raison:'apres-ecriture' }` — **jamais** `{ lu:true, accepte:null }` |
| R-avant | GetItem avant KO / `tronque` ; liste KO ; R7 (programmée) ; annonce absente d'une liste complète ; R4 ; R3 ; R5 | 503 `pas-su` / 503 `pas-su` / 409 `programmee` / 409 `pas-sur-ce-compte` / 409 `plus-en-vente` / 409 `format` / 409 `devise` — **aucune** révision |
| R-range | ligne `ebay_offres` pré-remplie (une entrée pour `110000000302`) + `mode.offresKo` + pose OK sur R1 | 200 `ok`, `range:null`, **aucune** écriture de `ebay_offres` (l'entrée de 302 intacte) ; l'autre sens : sans panne, l'entrée de 302 est GARDÉE et celle de 301 ajoutée |
| R-compte | R6 (at-A2) avec `compte: CLE_A2` | tous les appels avec le jeton `at-A2`, ligne `ebay_offres_{CLE_A2}` écrite, `ebay_offres` (principal) jamais touchée ; R6 SANS `compte` (principal) ⇒ 409 `pas-sur-ce-compte` et **aucune** `ReviseFixedPriceItem` (ni `at-J` ni `at-A2`) ; B avec `compte: CLE_A2` ⇒ 404/403, zéro appel (ajouter `regleoffre` à la boucle « B désigne le compte eBay de Julien ») |
| R-lire | `regleoffrelire` `['110000000301','110000000302','990000000001']` | 301 et 302 lus (`lu:true`, 302 `accepte 70`) et rangés ; 990… rendu `{ lu:false, raison:'pas-sur-ce-compte' }`, **non rangé** ; 21 ids / pas un tableau / un id invalide ⇒ 400 zéro appel ; liste KO ⇒ 503, rien rangé ; GetItem `tronque` ⇒ `{ lu:false, raison:'lecture-ratee' }` (jamais « aucune ») ; GetItem en série (jamais deux en vol) |
| R-sync | `sync` avec R1, R2 en ligne | le nombre de `GetItem` est **le même** qu'avant (≤ 20, un par annonce active) ; `ebay_offres` écrite avec R1 `accepte null` et R2 `accepte 70` (`par:'sync'`) ; `ebay_listings.items[*].detail` sans clé `_regle` ni `regle` ; `mode.offresKo` ⇒ `ebay_listings` écrite, `ebay_offres` NON écrite ; `getitem` KO pour une ⇒ son entrée `{ lu:false }` |
| R-prix-change | R2 avec règle, `revise` `price: '95'` (mode `efface`) | 200 `ok`, `regle.tombee === true`, entrée rangée `accepte null` ; `mode.prix = 'refus-23004'` ⇒ 422 avec le message d'eBay ; `revise` sur R1 (sans règle) ⇒ `tombee === false` ; `revise` stock seul ⇒ aucun GetItem de plus. Les contrôles `revise` existants restent verts |
| R-crea | `pubverify` avec `item.offre {accepte:66, refuse:null}`, prix 74 | le `<Item>` de la vérification contient le bloc §3.10 ; `item.offre {accepte:74}` (= prix) ⇒ 400 `offre`, zéro appel ; `item.regleOffre {accepte:1}` (glissé par le navigateur) ⇒ **aucun** bloc ; `programmer` avec `offre` ⇒ vérif et ajout portent le même bloc (le contrôle existant « même `<Item>` à l'UUID près » reste vert) ; `publish` avec `offre` ⇒ un `GetItem` après l'ajout, réponse `offre.verifie` |
| R-vide | `pubverify`, `publish`, `programmer` sans `offre`, puis avec `offre: null` | XML de la vérification/de l'ajout **identiques** entre les deux, et sans `BestOffer`, `ListingDetails`, `MinimumBestOffer` |
| R-§11 | `valideRegleOffre` de l'app (extraite d'App.jsx, exécutée dans le `vm` comme `suffixeCompteEbay`) vs celle de `api/_lib/ebay.js` | mêmes sorties (JSON) sur au moins : `{72,prix 80}`, `{80,80}`, `{79.995,80}`, `{0}`, `{-1}`, `{'72'}`, `{72.5, refuse 72.5}`, `{72, refuse 60}`, `{null, refuse 60}`, `{null, null}`, `{72, refuse undefined}`, `{1e6}`, `{NaN}`, `{72.555}` |
| R-nc | base NON cloisonnée (processus fils) | B ⇒ 403 pour `regleoffre` (ajouter à la boucle `np autre vendeur`) |

### 9.2 `scripts/audit-offres-auto.cjs` — ajouter une section, il doit rester vert
« 5. eBay : c'est eBay qui accepte » : lire `api/*.js` et `api/_lib/*.js` **sans
commentaires** et exiger : aucun `RespondToBestOffer`, aucun chemin
`negotiation/v1/…accept…` ni `respond_to_offer`, aucun `bestOfferTerms` /
`autoAcceptPrice` (voie Inventory) ; `BestOfferAutoAcceptPrice` n'apparaît que
dans `api/ebay.js`. Rouge sur un fichier `api/` muté qui ajoute
`tradingCall(token, 'RespondToBestOffer', …)` (le prouver une fois).
Les sections 1–4 ne changent pas ; la phrase finale reste « rien n'accepte une
offre tout seul » côté Vinted.

### 9.3 `scripts/prouve-regle-offre.cjs` — les mutations (route) et « le même XML qu'avant »

Un seul script, qui ne touche jamais le dépôt : il copie l'arbre courant
(`git archive HEAD` + fichiers modifiés non commités, ou `cp -r api src scripts`)
dans `os.tmpdir()/mut-regle-{nom}`, applique UNE mutation par remplacement de
texte (ancre exacte ; **ancre introuvable ⇒ le script sort rouge « mutation non
appliquée »**, sinon la preuve serait vide), lance
`node scripts/audit-ebay-route.cjs --src <copie>` et exige une sortie ≠ 0 ET la
présence des contrôles nommés en rouge :

| mutation | ce qu'elle change | contrôles qui doivent passer au rouge |
|---|---|---|
| `seuil-prix` | retire le refus `seuil-prix` contre le prix relu chez eBay (étape 6) | R-prix |
| `confirme` | retire `if (b.confirme !== true)` de `handleRegleOffre` | R-conf |
| `sans-ack` | remplace `if (sansAck(r))` de l'étape 8 par `if (r.status === 0)` (le défaut de `handleSku`) | R-ack (« 503 lu refusé ») |
| `compte` | retire le contrôle « l'annonce est dans les annonces actives DE CE compte » | R-compte (une révision part avec un jeton qui n'est pas celui de l'annonce) |
| `rangement` | `if (d === undefined) return null;` → `const d0 = d === undefined ? {} : d;` (repartir de vide) | R-range |
| `relu-aucune` | sur relecture ratée, ranger `{ lu:true, accepte:null, refuse:null }` | R-relu-ko |
| `sync-detail` | la synchro range `detail` AVEC `_regle` dans `ebay_listings` | R-sync |

Et un contrôle « **même XML qu'avant** » (D7) : un petit script
`scripts/_xml-publication.cjs --src X` (même faux eBay minimal que
`bancs/ebay-write.cjs`) qui appelle `pubverify`, `publish` et `programmer` sur 3
items SANS `offre` et imprime les corps XML envoyés. `prouve-regle-offre.cjs` le
lance sur `/tmp/avant-regle` (la base d'avant) et sur l'arbre courant : les sorties
doivent être **identiques au caractère près**.

Sur le code d'avant (`--src /tmp/avant-regle`), la section 12 sort rouge
(« action inconnue » ⇒ 400) — à noter dans le bilan avec le nombre exact.

### 9.4 `scripts/bancs/ebay-regle-offre.cjs` — le RENDU, données inventées, port 4731

Il vit dans le dépôt (aucune fixture réelle). Même squelette que
`ebay-annonces.cjs` / `ebay-comptes.cjs` : `DIST = path.join(__dirname,'..','..','dist')`,
Chromium `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
(`--use-angle=swiftshader --no-sandbox --no-proxy-server`), `metaVersData`,
projection `select=` appliquée, écritures GARDÉES dans `rows`, images externes
coupées, `**/api/ebay**` enregistré APRÈS le fourre-tout `**/api/**` (§6.6),
`essaie()` partout, port pris ⇒ rapporte et sort. Deux tailles
`{390×844, isMobile, hasTouch}` et `{1512×950}`. Juge les `data-*` et le **corps
exact** envoyé (`JSON.stringify` égal à l'attendu, ordre des clés compris), jamais
une formulation (sauf la présence d'un montant dans la feuille de confirmation).

**Données** :
- Registre `ebay_comptes` : `K1='aaaaaaaaaaaaaaa1'` `paire_perso` (principal),
  `K2='bbbbbbbbbbbbbbb2'` `paire_pro`. `status` ⇒ `{ ok:true, connected:true, comptes:[…, relie:true] }`.
- `ebay_listings` (principal) :
  `A1 130000000001` « Nike Air Max 1 bleu taille 44 » `"80.0"` `VRM-41` ;
  `A2 130000000002` « Adidas Samba blanc taille 42 » `"90.0"` `VRM-42` ;
  `A3 130000000003` « Salomon XT-6 noir taille 43 » `"120.0"` sku `''` ;
  `A4 130000000004` « Asics Gel 1130 argent taille 39 » `"70.0"` `VRM-44`.
- `ebay_listings_K2` : `B1 130000000101` « New Balance 550 gris taille 44 » `"100.0"` `VRM-45` ;
  `B2 130000000102` « Puma Suede rouge taille 41 » `"1.00"` `VRM-46`.
- `ebay_offres` : A1 `{lu:true, offresActives:true, accepte:72, refuse:60, devise:'EUR', prix:80}` (connue) ;
  A2 `{lu:true, offresActives:null, accepte:null, refuse:null, devise:'EUR', prix:90}` (aucune) ;
  A3 absente (pas su « jamais ») ; A4 `{lu:true, accepte:65, refuse:null, devise:'EUR', prix:75}` (prix 70 aujourd'hui ⇒ pas su « prix-change »).
- `ebay_offres_K2` : B1 et B2 aucune.
- `main.vinted_annonce_numeros` : fiches pour 41, 42, 44, 45, 46 ; `buyPrice` 85
  pour la 42 (sous-achat à 90 %), 50 pour la 41 ; `vrm_ebay_compte_pub: K1`
  (pour attraper une carte qui enverrait le compte de publication) ;
  `vrm_ebay_retrait_auto` absent (éteint).
- Ventes/commandes vides ; un compte Vinted inventé (`ACCS`).
- Faux `/api/ebay` : tient l'état eBay du banc (`regleEbay[itemId]`), compte les
  requêtes EN VOL (`enVol`, `maxEnVol`), retarde chaque `regleoffre` de 250 ms ;
  `regleoffre` ⇒ applique et répond `{ ok:true, verifie:true, lecture, avertissements:[] }`
  et met à jour `rows` (`ebay_offres*`) comme le ferait la route ; scénarios
  forcés par itemId : `130000000003` ⇒ 422 `{ ok:false, reason:'refus', error:'La catégorie de cette annonce n\'accepte pas les offres.' }` (une seule fois),
  `130000000101` (2ᵉ envoi) ⇒ 504 `{ reason:'incertain' }` ;
  `regleoffrelire` ⇒ `{ ok:true, lectures:{…}, range:true }` (A3 :
  `{lu:true, accepte:null, refuse:null, devise:'EUR', prix:120}` ; A4 :
  `{lu:true, offresActives:true, accepte:65, refuse:null, devise:'EUR', prix:70}`)
  + mise à jour de `rows`.
  Tout envoi `regleoffre` / `regleoffrelire` est poussé dans `envois`. Les
  compteurs de scénario repartent à zéro avec l'état, à chaque bloc.

**Contrôles, aux deux tailles** (préparer l'état à neuf à chaque bloc) :
1. **Trois états** : A1 `data-regle-offre="connue"`, `data-regle-accepte="72.00"`,
   `data-regle-refuse="60.00"` ; A2, B1, B2 `aucune` avec `data-regle-ouvrir` et
   **aucun « € »** dans leur ligne ; A3 `pas-su`, `data-regle-raison="jamais"` ;
   A4 `pas-su`, `prix-change` — **son ancien « 65 » n'apparaît nulle part sur la
   carte** ; aucune ligne de carte en « pas su » ne contient « aucune ».
2. **Une fois** : `[data-regles-engagement]` ×1 (n = 1) avec
   `[data-regles-vers-retrait]` (retrait éteint) ; cliquer ⇒ `[data-ebay-retrait-auto-bouton]`
   a le focus, **aucune** requête `/api/ebay`, aucune écriture de `main`.
   `[data-regles-pas-su]` ×1, `data-regles-pas-su="2"`, causes `jamais:1,prix-change:1`.
   Variante `vrm_ebay_retrait_auto: true` ⇒ bloc présent, lien absent. Variante sans
   règle connue (entrée A1 retirée) ⇒ bloc absent.
3. **« Relire chez eBay »** : un seul envoi pour le principal
   `{"action":"regleoffrelire","itemIds":["130000000003","130000000004"]}` (pas de
   clé `compte`), rien pour K2 ; ensuite A3 `aucune`, A4 `connue`, la ligne « pas
   su » disparaît.
4. **Poser (A2)** : ouvrir ⇒ `[data-regle-panneau]` ; taper `90` (= prix) ⇒
   `[data-regle-erreur]` et `[data-regle-enregistrer]` désactivé ; `81` ⇒
   `[data-regle-sous-achat]` (achat 85) ; Enregistrer ⇒ la feuille contient
   `81,00 €` ; **Annuler ⇒ aucun envoi** ; Oui ⇒ un seul envoi, exactement
   `{"action":"regleoffre","itemId":"130000000002","accepte":81,"refuse":null,"confirme":true}` ;
   la carte passe `connue`, `data-regle-accepte="81.00"`, `[data-ebay-info]` posé.
5. **Refus et retrait (A1)** : `Modifier` ⇒ champs pré-remplis 72 / 60 ; refus `75`
   ⇒ erreur, bouton désactivé ; `Retirer la règle` ⇒ **pas de feuille**, un envoi
   exactement `{"action":"regleoffre","itemId":"130000000001","accepte":null,"refuse":null,"confirme":true}` ;
   la carte passe `aucune`.
6. **Compte de l'annonce** : vue « Tous » ; poser `90` sur B1 ⇒ corps exact
   `{"action":"regleoffre","itemId":"130000000101","accepte":90,"refuse":null,"confirme":true,"compte":"bbbbbbbbbbbbbbb2"}`
   (alors que `vrm_ebay_compte_pub` vaut K1). Vue K1 (`#vrm-sel-compte-ebay`) ⇒
   aucune carte ni ligne d'aperçu de K2.
7. **Issues** : poser 90 sur B1 (réussit), puis la changer en 85 ⇒ 504 ⇒ B1
   repasse `pas-su`, aucun montant, message E.warn ; poser 100 sur A3 ⇒ 422 ⇒ le
   message de la route est affiché, A3 reste `pas-su` (`jamais`).
8. **Geste groupé**, vue « Tous » : pct `45` ⇒ `[data-regles-pct-erreur]`, aucun
   aperçu, `[data-regles-appliquer]` désactivé ; pct `90` ⇒ statuts / seuils :
   A1 `inchange` (connue 72, et 80 × 90 % = 72) ; A2 `nouvelle` 81 +
   `data-regles-sous-achat` (achat 85) ; A3 `nouvelle` 108 ; A4 `nouvelle` 63 (un
   « pas su » compte comme sans règle connue) ; B1 `nouvelle` 90 ; B2 `exclue`
   (1,00 € ⇒ 0, « prix trop bas ») ; `Appliquer à 4 annonces` ; feuille ⇒
   **Annuler ⇒ aucun envoi** ; Oui ⇒ 4 envois dans l'ordre A2, A3, A4, B1, chacun
   SANS clé `refuse`, B1 avec `"compte":"bbbbbbbbbbbbbbb2"` ; `maxEnVol === 1` ;
   bilan `data-regles-total="4"`, `data-regles-ok="3"`, `data-regles-ko="1"` (A3,
   avec le message de la route). Vue K2 ⇒ aperçu B1 et B2 seulement ; « Arrêter »
   pendant le 1ᵉʳ envoi ⇒ `data-regles-non-envoyees="3"`.
9. **Panne** : `ebay_offres*` en 500 ⇒ toutes les cartes `pas-su`
   (`illisible`), aucun montant, aucun « aucune », pas de bloc d'engagement, ligne
   « pas su » ×1.
10. Partout : `scrollWidth ≤ clientWidth`, aucune `pageerror`, aucun « n'a pas pu
    s'afficher / Cannot access / is not defined ». Captures dans `os.tmpdir()`
    (regardées, §6.2 : la capture fait partie du test).

**Mutations du banc** (copie de l'arbre, `src/App.jsx` muté, `npm run build`
dans la copie, banc copié dedans et lancé DEPUIS elle) — chacune rouge :
`pas-su-aucune` (`etatRegleOffre` rend `aucune` sans entrée) ⇒ contrôles 1 et 9 ;
`compte-vue` (la carte envoie `corpsCompteEbay(compteDefautPub)`) ⇒ contrôle 6 ;
`parallele` (le geste groupé en `Promise.all`) ⇒ contrôle 8 (`maxEnVol`) ;
`annuler-envoie` (l'envoi avant `askConfirm`) ⇒ contrôles 4 et 8 ; `vue-ignoree`
(l'aperçu prend `items` au lieu de `itemsVue`) ⇒ contrôle 8.
Sur le build de la base d'avant : rouge (aucun `data-regle-offre`).

### 9.5 Bancs existants à étendre (D7) et à garder verts
- `scripts/bancs/ebay-form.cjs` (port 4331) : champ `[data-publier-offre-accepte]` ;
  vide ⇒ le corps `pubverify` n'a **pas** de clé `item.offre` (égal à celui
  d'avant) ; `66` avec prix 74 ⇒ `item.offre` = `{"accepte":66,"refuse":null}` ;
  `80` ⇒ rien n'est envoyé, `[data-publier-offre-erreur]` ; « Publier » avec règle
  ⇒ feuille même avec un seul compte, Annuler n'envoie pas `publish`.
- `scripts/bancs/ebay-programmer.cjs` (port 4721) : un brouillon inventé avec
  `offreAccepte: '70'` (prix 85) ⇒ `pubverify` ET `programmer` portent
  `item.offre` `{"accepte":70,"refuse":null}` ; les brouillons sans règle : corps
  inchangés (contrôles existants verts). `[data-brouillon-offre="70.00"]` sur la
  ligne du brouillon.
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
3. Que `GetItem` (sans `DetailLevel` et en `ReturnAll`) rende les seuils au
   jeton du vendeur, et qu'**absent** = pas de seuil (« Conditionally » dans la
   doc) — c'est la relecture après sa première pose qui le dira (`verifie`).
4. Que la catégorie **15709** sur EBAY_FR accepte l'acceptation / le refus
   automatiques (`getNegotiatedPricePolicies` / `GetCategoryFeatures` non appelés).
5. « Seuil strictement sous le prix » (23004) et « refus sous l'acceptation »
   (21919263) : sources tierces ; VRM est plus strict (refus ≥ acceptation refusé).
6. Ce que fait `ReviseInventoryStatus` à une annonce qui a des seuils : les
   effacer en silence, ou refuser (23004). Les deux issues sont tenues (§3.9).
7. `VerifyAddFixedPriceItem` avec seuils (« Add/Revise/Relist/Verify » dans le
   guide, pas dans la liste 2016).
8. Une offre **égale** au seuil acceptée (≥) : 3 sources sur 4 ; et la règle
   s'applique aussi aux contre-offres de l'acheteur.
9. Le délai de l'acceptation par eBay, et si l'objet est réservé avant paiement
   sur eBay.fr (l'aide américaine dit que non sans paiement automatique) : rien
   n'est promis (« instantané », « réservé »).
10. L'état de SES 2 annonces : offres déjà activées ? seuil déjà posé à la main ?
    — inconnu jusqu'à la première lecture (synchro ou « Relire chez eBay »).
11. La tolérance d'eBay à l'ordre des éléments dans `<Item>` (la pratique actuelle
    de `itemXml` passe ; le bloc est ajouté en fin, avant `<UUID>`).
12. Une annonce PROGRAMMÉE : la révision de ses seuils n'est pas tentée (409) ; la
    lecture `GetItem` d'une programmée après `programmer` est **[non mesurée]**.

**Les premiers gestes de Julien** (à mettre dans le dossier) : (1) eBay → Compte
eBay → « ↻ Rafraîchir depuis eBay » : ses 2 annonces passent de « — » à leur
vrai état ; (2) relier ses 2 annonces à leur paire (sinon une vente eBay ne sort
pas la paire de Vinted) ; (3) poser une règle sur UNE annonce et regarder le
message (« ✓ … relu » ou l'écart) ; (4) la retirer — si eBay refuse, le message
le dira ; (5) ne pas changer le prix d'une annonce à règle sans lire le message
qui suit.

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
  (lire-fusionner-réécrire gardé) ; la synchro lit la règle dans les GetItem
  qu'elle faisait déjà ; carte « Offres reçues : eBay accepte dès X € » ou
  « Définir une règle d'offre » ; « Une règle pour toutes » (%, aperçu, une par
  une, bilan) ; champ à la création, dans les brouillons et le planificateur.
- **Décisions** : D1–D8 (spécification du 9 octobre) — trois états (connue ·
  aucune · pas su, jamais un montant ni « aucune » sur un « pas su ») ; X < prix
  relu chez eBay, Y < X ; `confirme:true` ; sans `<Ack>` ⇒ incertain ; le compte
  de L'ANNONCE ; retirer = un clic ; un changement de prix dit si eBay a fait
  tomber la règle.
- **Preuves** : `audit-ebay-route.cjs` (section 12, {n} contrôles, {r} rouges sur
  la base d'avant) ; `prouve-regle-offre.cjs` (7 mutations, chacune rouge ; XML
  de publication identique à celui d'avant sans règle) ; banc
  `ebay-regle-offre.cjs` (port 4731, {n} contrôles, 5 mutations) ; `ebay-form`,
  `ebay-programmer` étendus ; `audit-offres-auto.cjs` section 5.
- **Non mesuré** : la liste du §10 de la spécification (noms XML, `DeletedField`,
  catégorie 15709, effet d'un changement de prix, ≥ au seuil, délai, réservation).
  Premiers gestes : rafraîchir, relier ses 2 annonces, poser UNE règle, la retirer.
```
Mettre à jour les compteurs du §6/§9 (« N audits », « N bancs ») d'après
`ls scripts/audit-*.cjs | wc -l` et `ls scripts/bancs/*.cjs | wc -l`, et ajouter la
ligne du banc dans `scripts/bancs/README.md`.

---

## 12. Liste de contrôle de livraison

1. Arbre de travail propre, basé sur `worktree-wf_d62e1db4-b5c-1`, rebasé à la fin.
2. `api/ebay.js` : `lectureRegleDe`, `lireRegleOffre`, `rangerReglesOffre`,
   `handleRegleOffre`, `handleRegleOffreLire`, `regleDeItem`, `montantXml`, ajouts
   dans `itemXml`, `avecSku`, `handleVerify`, `handlePublish`, `handleProgrammer`,
   `handleSync`, `handleRevise`, `tradingGetItem`, `ACTIONS`.
   `api/_lib/ebay.js` : `valideRegleOffre` exportée.
3. `src/App.jsx` : `valideRegleOffre` (copie), `montantSaisi`, `seuilDePourcent`,
   `etatRegleOffre`, `resultatRegleOffre`, `achatParNum` ; `EbayAnnonceCard`
   (ligne, panneau, gestes, garde du prix) ; `EbayAnnonces` (lecture, états locaux,
   bloc, ligne « pas su », Relire) ; `EbayReglesToutes` ; `EbayPublier`,
   `itemDeBrouillon`, `EbayBrouillons`, `EbayPlanificateur` ; `resultatReviseEbay`.
4. Aucun changement dans `vinted-sync-extension/`, aucun `EXT_CAPACITES`, aucun
   zip, aucune ligne Vinted.
5. Preuves §9 : vertes sur l'arbre, rouges sur la base d'avant et sous chaque
   mutation ; captures regardées aux deux tailles.
6. `CLAUDE.md` §11 ; `scripts/bancs/README.md`.
7. Commit sur la branche de travail ; rien poussé, rien fusionné dans
   `claude/project-review-nsk5su`.
