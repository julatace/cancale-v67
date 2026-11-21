# Intégration étape D ← main — résolution exacte des conflits `api/ebay.js`

Écrit par **Agent 2** pour **Agent 1** (le système m'interdit de modifier `api/ebay.js`
lui-même — c'est ta lane eBay/argent). J'ai fait le merge à blanc et analysé les 6
conflits. `_lib/ebay.js` et `_lib/numerotation.js` **mergent tout seuls** (leur
`export {…}` combiné porte déjà `exchangeCode` ET `lireComptes/montantOk/
valideRegleOffre/…`). Les handlers `programmer`/`revise`/`retirer` et leurs gardes
013 (`numerotationVendeur`/`numerotationRefus`/`numeroExterne(mk)`) sont **préservés
par l'auto-merge** — ne les retouche pas. `memePaire` est retiré par la 013
(commentaire L80) : après résolution il n'a **plus aucun usage**.

Principe des 6 résolutions : **garder les DEUX** — le multi-comptes + la règle
d'offre (étape D) ET la numérotation 013 (main). Signatures `(b, ctx)`, jetons par
`jetonDe(ctx)`, `owner` → `ctx.owner`.

### Conflit 1 — imports (haut du fichier)
Garde le bloc **étape D** (liste d'import complète + helpers `jetonDe`/`ligneDe`/
`nomCompte`) et AJOUTE dessous :
```js
import { numeroExterne } from './_lib/numerotation.js';
```
(`exchangeCode` n'est plus utilisé dans le corps — ne pas le réimporter.)

### Conflit 2 — `dejaChezEbay` + helpers + signature `handlePublish`
Garde, dans l'ordre : le **commentaire 013** (main) · `comptesAVerifier` (étape D,
inchangé) · le `dejaChezEbay` **combiné** ci-dessous · `numerotationVendeur` +
`numerotationRefus` (main, inchangés) · `async function handlePublish(b, ctx) {`.

`dejaChezEbay` = la boucle multi-comptes de l'étape D, mais le matcher devient
**013-aware** (plus `memePaire`) :
```js
async function dejaChezEbay(ctx, tokenCourant, sku, verbe, mk) {
  const v = await comptesAVerifier(ctx, tokenCourant);
  if (!v.ok) return v.err;
  const voulu = numDeSku(sku);
  const meme = (x) => !!voulu && numeroExterne(numDeSku(x.sku), x.itemId, 'ebayAnnonces', null, mk) === voulu;
  const plusieurs = v.liste.length > 1;
  for (const { compte, token } of v.liste) {
    const ou = plusieurs && nomCompte(compte) ? ` (compte eBay ${nomCompte(compte)})` : '';
    const L = await listeVendeur(token);
    if (!L.ok) return { status: 503, body: { ok: false, reason: 'pas-su', compte: compte.pseudo || '', error: plusieurs ? `Je n'ai pas pu relire tes annonces du compte eBay ${nomCompte(compte) || 'principal'} pour vérifier que cette paire n'y est pas déjà — rien n'a été envoyé.` : PAS_SU_LISTE } };
    if (!L.complet) return { status: 503, body: { ok: false, reason: 'pas-su', compte: compte.pseudo || '', error: `Tu as plus de 1 000 annonces sur eBay${ou} : je n'ai pas pu toutes les relire pour vérifier que cette paire n'y est pas déjà — rien n'a été envoyé.` } };
    const prog = L.programmees.find(meme);
    if (prog) return { status: 409, body: { ok: false, reason: 'deja-programmee', itemId: prog.itemId, compte: compte.pseudo || '', autreCompte: compte.suffixe !== (ctx.compte.suffixe || ''), debut: prog.depuis || null, error: `La paire ${sku} est déjà programmée sur eBay${ou}${prog.depuis ? ' (' + prog.depuis + ')' : ''} — rien n'a été ${verbe}.` } };
    const act = L.actives.find(meme);
    if (act) return { status: 409, body: { ok: false, reason: 'deja-en-ligne', itemId: act.itemId, compte: compte.pseudo || '', autreCompte: compte.suffixe !== (ctx.compte.suffixe || ''), error: `La paire ${sku} est déjà en vente sur eBay${ou} — rien n'a été ${verbe}.` } };
  }
  return null;
}
```

### Conflit 3 — début du corps de `handlePublish`
```js
  const ro = regleDeItem(it0);
  if (ro.err) return { status: 400, body: { ok: false, reason: ro.reason || 'offre', error: ro.err } };
  let num = { ok: true, mk: null };
  if (s.item.sku) { num = await numerotationVendeur(ctx.owner); const ref = numerotationRefus(b, num); if (ref) return ref; }
  const it = { ...s.item, regleOffre: ro.regle };
  const at = await jetonDe(ctx);
```

### Conflit 4 — appel `dejaChezEbay` dans `handlePublish`
```js
    const deja = await dejaChezEbay(ctx, at.token, it.sku, 'publié', num.mk);
    if (deja) { await rangerRetrouvee(ctx, at.token, deja, it); return deja; }
```

### Conflit 5 — corps de `handleProgrammer` (bloc `it`/`num`/`at`/`deja`)
```js
  const it = { ...s.item, regleOffre: ro.regle, scheduleTime: quand };
  const num = await numerotationVendeur(ctx.owner);
  { const ref = numerotationRefus(b, num); if (ref) return ref; }
  const at = await jetonDe(ctx);
  if (!at.ok) return { status: at.status || 502, body: { ok: false, reason: at.reason, error: at.error } };
  // ── UNE PAIRE, UNE ANNONCE : relue chez eBay, maintenant, sur TOUS ses
  // comptes (une liste INCOMPLÈTE ne prouve pas l'absence : on ne programme pas).
  const deja = await dejaChezEbay(ctx, at.token, it.sku, 'envoyé', num.mk);
  if (deja) { await rangerRetrouvee(ctx, at.token, deja, it); return deja; }
```

### Conflit 6 — `handleSku` (garde « numéro-ambigu » 013)
Garde le bloc 013 de main, mais `numerotationVendeur(ctx.owner)`, puis le jeton par
l'étape D :
```js
  // (013) une annonce qui portait déjà ce SKU à la remise à zéro désigne l'ANCIENNE paire.
  { const num = await numerotationVendeur(ctx.owner);
    if (!num.ok) return { status: 503, body: { ok: false, reason: 'numerotation-pas-su', error: 'Je n\'ai pas pu relire ta numérotation — rien n\'a été envoyé à eBay.' } };
    const voulu = numDeSku(sku);
    if (num.mk && /^\d+$/.test(voulu) && numeroExterne(voulu, itemId, 'ebayAnnonces', null, num.mk) !== voulu) {
      return { status: 409, body: { ok: false, reason: 'numero-ambigu', error: `Cette annonce eBay portait déjà « ${sku} » à la remise à zéro de tes numéros : elle désigne l'ANCIENNE paire. Pour la nouvelle ${voulu}, termine cette annonce et republie la paire — rien n'a été envoyé à eBay.` } };
    } }
  const at = await jetonDe(ctx);
```

### App.jsx (11 conflits), bancs, CLAUDE.md, README
9 des 11 conflits App.jsx sont G9/G35/Vitesse (hors eBay) vs étape D → **garde les
deux**. `main` a sorti `Room3D`+`RoomPerspective` dans `src/Room3D.jsx` (lazy) : à
leur ancienne place (~16890) il n'y a qu'un `const Room3D = React.lazy(() =>
import('./Room3D.jsx'))` — ne réintroduis pas les 1250 lignes. `annonces-carte.cjs`,
`ebay-annonces.cjs`, `README.md`, `CLAUDE.md` : union.

### À lancer après résolution (le gate)
`npm run build && node scripts/audit-tdz.cjs && node scripts/audit-ebay-route.cjs &&
node scripts/bancs/ebay-regle-offre.cjs && node scripts/audit-numerotation-lecteurs.cjs &&
node scripts/audit-offres-auto.cjs && node scripts/bancs/verif_visuel.cjs`
— plus tes autres bancs eBay. Tout vert ⇒ PR `wip-d-regle-offre` → main.
