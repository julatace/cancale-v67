// BANC : la route eBay, 11 novembre (lot `ebay-complet`) — TOUS LES PARAMÈTRES
// DE PUBLICATION, l'action `parametres`, et le jeton qui expire dit AVANT.
// EXÉCUTE la vraie route `api/ebay.js` (§4.10) contre un FAUX eBay (Trading,
// Taxonomy, Metadata, Account, Inventory) et une fausse base cloisonnée.
// Aucun appel réel à eBay ; données inventées.
//   node scripts/bancs/ebay-complet-route.cjs            (contre le code du dépôt)
//   node scripts/bancs/ebay-complet-route.cjs --prouve   (chaque mutation doit rougir)
//   AVANT=<arbre d'avant> : X0 compare l'XML d'une annonce SANS réglage à celui
//   que produit CET arbre (sinon : `git archive` du point de départ du lot).
// On exige :
//   X0. une annonce SANS réglage part AU CARACTÈRE PRÈS comme avant (vérifier ET publier) ;
//   P1. enchères 7 j : AddItem (jamais AddFixedPriceItem), Chinese, Days_7, Achat immédiat ;
//       une enchère avec un seuil d'offre, ou une quantité 2 ⇒ 400, zéro appel eBay ;
//   P2. offres, délai 1 j, lieu + code postal, retours 30 j vendeur, annonce privée ⇒ leurs balises ;
//   P3. politiques du compte (paiement, retour) ⇒ SellerProfiles, sans <ReturnPolicy> ;
//       la politique d'EXPÉDITION ne part jamais (§2.8 : livraison gérée par eBay) ;
//   P4. §2.8 sur toutes les annonces : aucun <ShippingDetails>, aucun FreeShipping ;
//   P5. valeurs hors liste (durée 4 j, délai 6 j, sous-titre 56 car., retours 21 j,
//       politique « abc ») ⇒ 400 `parametres`, zéro appel eBay ;
//   P6. TVA : refusée sur un compte particulier (400, zéro appel), posée pour un pro ;
//       un pro ne peut pas refuser les retours ;
//   Q.  `parametres` : suggestions avec leur chemin · aucune (204) ⇒ [] · eBay muet ⇒ null
//       (jamais []) ; caractéristiques (obligatoire, recommandée, plusieurs valeurs, liste
//       fermée) et états lus ; politiques du compte et programme lus ; JAMAIS de catégorie
//       choisie par la route ; lecture seule (aucun appel Trading) ;
//   J.  `status` : chaque compte dit son jeton (ok · bientôt · expiré), « pas su » ⇒ null ;
//   A.  l'app (src/ebay/parametres.js) : réglage d'usine ⇒ null ; ce qu'elle envoie, la
//       route l'accepte (aller-retour sur des combinaisons) ; une liste fermée n'accepte
//       qu'une valeur exacte ; chaque clé dynamique existe dans les 5 langues.
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..', '..');
const PROPRIO = '11111111-1111-1111-1111-111111111111';
process.env.VRM_OWNER_UID = PROPRIO;
process.env.EBAY_APP_ID = 'app'; process.env.EBAY_CERT_ID = 'cert'; process.env.EBAY_RUNAME = 'ru'; process.env.SUPABASE_SERVICE_KEY = 'svc';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://base.banc.test';
const MAINTENANT = Date.now();
const JOUR = 86400000;
const CLE_PRO = 'aaaaaaaaaaaaaaaa', CLE_PART = 'bbbbbbbbbbbbbbbb';

let ROWS = {}, EB = {}, appels = [];
const remettre = () => {
  ROWS = {
    ebay_comptes: { comptes: [
      { principal: true, cle: CLE_PRO, pseudo: 'vendeur_pro', type: 'pro', typeLuLe: MAINTENANT, site: 'FR', ajouteLe: MAINTENANT - 500 * JOUR, vuLe: MAINTENANT },
      { principal: false, cle: CLE_PART, pseudo: 'vendeur_perso', type: 'particulier', typeLuLe: MAINTENANT, site: 'FR', ajouteLe: MAINTENANT - 30 * JOUR, vuLe: MAINTENANT },
    ] },
    // principal : rangé il y a 530 j pour 548 ⇒ expire dans 18 j ; l'autre : frais.
    ebay_tokens: { refresh_token: 'RT-pro', saved_at: MAINTENANT - 530 * JOUR, refresh_expires_days: 548 },
    ['ebay_tokens_' + CLE_PART]: { refresh_token: 'RT-perso', saved_at: MAINTENANT - 10 * JOUR, refresh_expires_days: 548 },
    ebay_listings: { items: [{ itemId: '110000000001', title: 'A', price: '50' }, { itemId: '110000000002', title: 'B', price: '80' }], capturedAt: MAINTENANT },
  };
  EB = { suggestions: 'ok', aspects: 'ok', politiques: 'ok' };
  appels = [];
};
const lire = (obj, chemin) => { let v = obj; for (const seg of chemin.split(/->>|->/)) v = v == null ? null : v[seg.replace(/^"|"$/g, '')]; return v; };
const projette = (id, data, sel) => {
  if (!sel || sel === 'data') return { data };
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = id; continue; }
    if (src === 'data') { out[alias] = data; continue; }
    const v = lire(data, src.replace(/^data(->>|->)/, ''));
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const json = (o, st = 200) => new Response(o === undefined ? '' : JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json' } });
const xml = (s) => new Response('<?xml version="1.0" encoding="utf-8"?>' + s, { status: 200 });
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url)); const h = opts.headers || {};
  if (u.includes('/auth/v1/user')) return json({ id: PROPRIO, email: 'p@exemple.test' });
  if (u.includes('identity/v1/oauth2/token')) return json({ access_token: 'AT', expires_in: 7200 });
  if (u.includes('/rest/v1/rpc/')) return json(true);
  if (u.includes('/rest/v1/app_data')) {
    if (opts.method && opts.method !== 'GET') return json([], 201);
    if (/select=owner&limit=1/.test(u)) return json([{ owner: PROPRIO }]);
    const id = (/id=eq\.([^&]*)/.exec(u) || [])[1];
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1];
    if (!id) return json([]);
    if (!(id in ROWS)) return json([]);
    if (ROWS[id] === 'PANNE') return json({ m: 'panne' }, 500);
    return json([projette(id, ROWS[id], sel)]);
  }
  if (u.includes('/ws/api.dll')) {
    const nom = h['X-EBAY-API-CALL-NAME'] || '';
    const corps = String(opts.body || '');
    appels.push({ nom, corps });
    if (/^(Verify)?Add(FixedPrice)?Item$/.test(nom)) return xml(`<${nom}Response xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><ItemID>110555000333</ItemID><Fees><Fee><Name>ListingFee</Name><Fee currencyID="EUR">0.00</Fee></Fee></Fees></${nom}Response>`);
    return xml(`<${nom}Response xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack></${nom}Response>`);
  }
  if (u.includes('api.ebay.com') || u.includes('api.sandbox.ebay.com')) {
    appels.push({ nom: 'REST ' + u.replace(/^https:\/\/[^/]+/, '').split('?')[0], methode: opts.method || 'GET', corps: opts.body ? JSON.parse(opts.body) : null });
    if (u.includes('/sell/marketing/v1/promotion?')) return json({ promotions: [
      { promotionId: '9001', name: 'Soldes', promotionStatus: 'RUNNING', promotionType: 'MARKDOWN_SALE', startDate: '2026-11-01T00:00:00Z', endDate: '2026-11-20T00:00:00Z' },
      { promotionId: '9002', name: 'Lot', promotionStatus: 'SCHEDULED', promotionType: 'VOLUME_DISCOUNT', startDate: '2026-12-01T00:00:00Z', endDate: '2026-12-10T00:00:00Z' },
      { promotionId: '9003', name: 'Code', promotionStatus: 'RUNNING', promotionType: 'CODED_COUPON', startDate: '2026-11-01T00:00:00Z', endDate: '2026-11-30T00:00:00Z' }] });
    if (/\/sell\/marketing\/v1\/(item_price_markdown|item_promotion)$/.test(u.split('?')[0]) && opts.method === 'POST') return new Response('', { status: 201, headers: { location: 'https://api.ebay.com/sell/marketing/v1/item_price_markdown/9100' } });
    if (/\/promotion\/\d+\/pause$/.test(u)) return new Response(null, { status: 204 });
    if (/\/sell\/marketing\/v1\/(item_price_markdown|item_promotion)\/\d+$/.test(u) && opts.method === 'DELETE') return new Response(null, { status: 204 });
    if (u.includes('get_default_category_tree_id')) return json({ categoryTreeId: '71' });
    if (u.includes('get_category_suggestions')) {
      if (EB.suggestions === 'muet') return json({ errors: [{ message: 'panne' }] }, 500);
      if (EB.suggestions === 'aucune') return new Response(null, { status: 204 });
      return json({ categorySuggestions: [
        { category: { categoryId: '15709', categoryName: 'Baskets' }, categoryTreeNodeAncestors: [{ categoryName: 'Chaussures homme' }, { categoryName: 'Vêtements, accessoires' }] },
        { category: { categoryId: '95672', categoryName: 'Baskets femme' }, categoryTreeNodeAncestors: [{ categoryName: 'Chaussures femme' }] },
      ] });
    }
    if (u.includes('get_item_aspects_for_category')) {
      if (EB.aspects === 'muet') return json({ errors: [{ message: 'panne' }] }, 503);
      return json({ aspects: [
        { localizedAspectName: 'Marque', aspectConstraint: { aspectRequired: true, aspectMode: 'FREE_TEXT', itemToAspectCardinality: 'SINGLE' }, aspectValues: [{ localizedValue: 'Nike' }, { localizedValue: 'Adidas' }] },
        { localizedAspectName: 'Couleur', aspectConstraint: { aspectRequired: true, aspectMode: 'SELECTION_ONLY', itemToAspectCardinality: 'MULTI' }, aspectValues: [{ localizedValue: 'Noir' }, { localizedValue: 'Blanc' }, { localizedValue: 'Bleu' }] },
        { localizedAspectName: 'Matière', aspectConstraint: { aspectRequired: false, aspectUsage: 'RECOMMENDED', aspectMode: 'FREE_TEXT' }, aspectValues: [] },
      ] });
    }
    if (u.includes('get_item_condition_policies')) return json({ itemConditionPolicies: [{ categoryId: '15709', itemConditionRequired: true, itemConditions: [{ conditionId: '1000', conditionDescription: 'Neuf avec étiquettes' }, { conditionId: '3000', conditionDescription: 'Occasion' }] }] });
    if (u.includes('get_opted_in_programs')) return EB.politiques === 'muet' ? json({}, 403) : json({ programs: [{ programType: 'SELLING_POLICY_MANAGEMENT' }] });
    if (u.includes('payment_policy')) return EB.politiques === 'muet' ? json({}, 403) : json({ paymentPolicies: [{ paymentPolicyId: '6200000001', name: 'Paiement immédiat' }] });
    if (u.includes('return_policy')) return EB.politiques === 'muet' ? json({}, 403) : json({ returnPolicies: [] });
    if (u.includes('fulfillment_policy')) return EB.politiques === 'muet' ? json({}, 403) : json({ fulfillmentPolicies: [{ fulfillmentPolicyId: '6200000009', name: 'Livraison gérée', handlingTime: { value: 2 } }] });
    if (u.includes('/sell/inventory/v1/location')) return json({ locations: [{ merchantLocationKey: 'depot', location: { address: { city: 'Rennes', postalCode: '35000', country: 'FR' } } }] });
    return json({}, 404);
  }
  return json({}, 404);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.end = () => r; r.setHeader = () => r; return r; };

const ITEM = { title: 'Nike Air Max 1 bleu taille 44', categoryId: '15709', price: '68', quantity: 1, conditionId: '3000', photos: ['https://i.ebayimg.com/a/2.JPG'], aspects: { Marque: 'Nike', Couleur: 'Bleu' }, description: 'Belle paire.' };

async function charger(racine) {
  const mod = await import(pathToFileURL(path.join(racine, 'api', 'ebay.js')).href + '?t=' + Math.random());
  return (body) => { const res = faireRes(); return mod.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer eyJh.banc-proprio.sig' }, body }, res).then(() => res); };
}
const nTrading = () => appels.filter((a) => !/^REST /.test(a.nom)).length;
const dernier = (re) => [...appels].reverse().find((a) => re.test(a.nom));

async function avantXml(racineAvant) {
  // L'XML d'une annonce sans réglage, produit par l'arbre d'AVANT (vérifier, publier).
  remettre();
  const h = await charger(racineAvant);
  await h({ action: 'pubverify', item: ITEM });
  const v = dernier(/^VerifyAddFixedPriceItem$/);
  await h({ action: 'publish', confirme: true, item: ITEM });
  const p = dernier(/^AddFixedPriceItem$/);
  return { v: v && v.corps, p: p && p.corps };
}

async function verifier(racine, avant) {
  let ko = 0; const out = [];
  const dit = (c, m, d) => { if (!c) ko++; out.push((c ? 'OK  ' : 'KO  ') + m + (d !== undefined && d !== '' ? ' — ' + String(d).slice(0, 300) : '')); };
  const essaie = async (q, f) => { try { await f(); } catch (e) { dit(false, q + ' (a levé)', String((e && e.stack) || e).split('\n').slice(0, 3).join(' | ')); } };
  let h = null;
  try { h = await charger(racine); } catch (e) { dit(false, 'api/ebay.js se charge', e.message); return { ko, out }; }
  const pub = async (parametres, extra = {}, compte) => { remettre(); const r = await h({ action: 'publish', confirme: true, item: { ...ITEM, ...extra, ...(parametres !== undefined ? { parametres } : {}) }, ...(compte ? { compte } : {}) }); return { r, a: dernier(/^(Verify)?Add/) }; };

  await essaie('X0', async () => {
    remettre();
    await h({ action: 'pubverify', item: ITEM });
    const v = dernier(/^VerifyAddFixedPriceItem$/);
    await h({ action: 'publish', confirme: true, item: ITEM });
    const p = dernier(/^AddFixedPriceItem$/);
    dit(!!(avant && avant.v && v && v.corps === avant.v), 'X0. vérifier une annonce SANS réglage : XML identique à avant, au caractère près', v && avant && avant.v ? (v.corps === avant.v ? '' : 'diffère') : 'pas d’XML');
    dit(!!(avant && avant.p && p && p.corps === avant.p), 'X0. publier une annonce SANS réglage : XML identique à avant', p && avant && avant.p ? (p.corps === avant.p ? '' : 'diffère') : 'pas d’XML');
  });
  await essaie('P1', async () => {
    const { r, a } = await pub({ format: 'enchere', dureeJours: 7, achatImmediat: '100' });
    dit(r.code === 200 && a && a.nom === 'AddItem', 'P1. une enchère part par AddItem (jamais AddFixedPriceItem)', `HTTP ${r.code} ${a && a.nom} ${r.corps && r.corps.error || ''}`);
    const c = (a && a.corps) || '';
    dit(/<ListingType>Chinese<\/ListingType><ListingDuration>Days_7<\/ListingDuration>/.test(c) && /<BuyItNowPrice currencyID="EUR">100\.00<\/BuyItNowPrice>/.test(c) && !/BestOffer/.test(c), '    Chinese · Days_7 · Achat immédiat 100,00 · aucune offre', c.slice(0, 0));
    const r2 = await pub({ format: 'enchere', dureeJours: 7 }, { offre: { accepte: 60 } });
    dit(r2.r.code === 400 && nTrading() === 0, '    une enchère avec un seuil d’offre ⇒ 400, zéro appel eBay', `HTTP ${r2.r.code} appels=${nTrading()}`);
    const r3 = await pub({ format: 'enchere', dureeJours: 7 }, { quantity: 2 });
    dit(r3.r.code === 400 && r3.r.corps.reason === 'parametres' && nTrading() === 0, '    une enchère de 2 articles ⇒ 400 `parametres`, zéro appel eBay', `HTTP ${r3.r.code} ${r3.r.corps && r3.r.corps.reason}`);
    const r4 = await pub({ format: 'enchere', dureeJours: 5, achatImmediat: '70' });
    dit(r4.r.code === 400 && nTrading() === 0, '    « Achat immédiat » à moins de +30 % ⇒ 400 (règle d’eBay), zéro appel', `HTTP ${r4.r.code}`);
  });
  await essaie('P2', async () => {
    const { r, a } = await pub({ offres: true, delaiEnvoi: 1, lieu: 'Rennes', codePostal: '35000', retours: { acceptes: true, jours: 30, payePar: 'Seller' }, privee: true, sousTitre: 'Boîte d’origine' });
    const c = (a && a.corps) || '';
    dit(r.code === 200 && a && a.nom === 'AddFixedPriceItem', 'P2. prix fixe avec réglages : AddFixedPriceItem', `HTTP ${r.code} ${r.corps && r.corps.error || ''}`);
    dit(/<BestOfferDetails><BestOfferEnabled>true<\/BestOfferEnabled><\/BestOfferDetails>/.test(c) && !/BestOfferAutoAcceptPrice/.test(c), '    offres acceptées SANS seuil (eBay demande au vendeur)');
    dit(/<DispatchTimeMax>1<\/DispatchTimeMax>/.test(c) && /<Location>Rennes<\/Location><PostalCode>35000<\/PostalCode>/.test(c), '    délai 1 j · lieu Rennes · code postal 35000');
    dit(/<ReturnsWithinOption>Days_30<\/ReturnsWithinOption><ShippingCostPaidByOption>Seller<\/ShippingCostPaidByOption>/.test(c), '    retours 30 j, renvoi payé par le vendeur');
    dit(/<PrivateListing>true<\/PrivateListing>/.test(c) && /<SubTitle>Boîte d’origine<\/SubTitle>/.test(c), '    annonce privée · sous-titre');
  });
  await essaie('P3', async () => {
    const { r, a } = await pub({ politiques: { paiement: '6200000001', retour: '6200000002', expedition: '6200000009' }, retours: undefined });
    const c = (a && a.corps) || '';
    dit(r.code === 200 && /<SellerProfiles><SellerPaymentProfile><PaymentProfileID>6200000001<\/PaymentProfileID><\/SellerPaymentProfile><SellerReturnProfile><ReturnProfileID>6200000002<\/ReturnProfileID><\/SellerReturnProfile><\/SellerProfiles>/.test(c), 'P3. politiques paiement + retour ⇒ SellerProfiles', `HTTP ${r.code} ${r.corps && r.corps.error || ''}`);
    dit(!/<ReturnPolicy>/.test(c), '    la politique de retour REMPLACE le bloc <ReturnPolicy>');
    dit(!/SellerShippingProfile|6200000009/.test(c), '    §2.8 : la politique d’EXPÉDITION ne part jamais (livraison gérée par eBay)');
    const r2 = await pub({ politiques: { retour: '6200000002' }, retours: { acceptes: true, jours: 30, payePar: 'Buyer' } });
    dit(r2.r.code === 400 && nTrading() === 0, '    une politique de retour ET un réglage de retour ⇒ 400 (il choisit l’un), zéro appel', `HTTP ${r2.r.code}`);
  });
  await essaie('P4', async () => {
    const variantes = [undefined, { offres: true }, { format: 'enchere', dureeJours: 3 }, { politiques: { expedition: '6200000009' } }, { delaiEnvoi: 0, lieu: 'Lyon' }];
    const fautes = [];
    for (const p of variantes) { const { a } = await pub(p); const c = (a && a.corps) || ''; if (!a || /<ShippingDetails>|FreeShipping|ShippingServiceCost|SellerShippingProfile/.test(c)) fautes.push(JSON.stringify(p) + (a ? '' : ' : pas d’XML')); }
    dit(fautes.length === 0, 'P4. §2.8 : aucune annonce ne porte de port, de transporteur, ni « livraison gratuite »', fautes.join(' · '));
  });
  await essaie('P5', async () => {
    const mauvais = [{ format: 'enchere', dureeJours: 4 }, { delaiEnvoi: 6 }, { sousTitre: 'x'.repeat(56) }, { retours: { acceptes: true, jours: 21, payePar: 'Buyer' } }, { politiques: { paiement: 'abc' } }, { format: 'loterie' }, { tva: '20' }, 'enchère'];
    const passes = [];
    for (const p of mauvais) { const { r } = await pub(p, {}, CLE_PART); if (!(r.code === 400 && r.corps && r.corps.reason === 'parametres' && nTrading() === 0)) passes.push(`${JSON.stringify(p)} ⇒ ${r.code} ${r.corps && r.corps.reason} appels=${nTrading()}`); }
    dit(passes.length === 0, 'P5. chaque valeur hors des listes d’eBay ⇒ 400 `parametres`, zéro appel eBay (TVA sur un particulier comprise)', passes.join(' · '));
  });
  await essaie('P6', async () => {
    const { r, a } = await pub({ tva: '20' });
    dit(r.code === 200 && /<VATDetails><VATPercent>20<\/VATPercent><\/VATDetails>/.test((a && a.corps) || ''), 'P6. un compte PRO constaté (registre) pose la TVA', `HTTP ${r.code} ${r.corps && r.corps.error || ''}`);
    const r2 = await pub({ retours: { acceptes: false } });
    dit(r2.r.code === 400 && nTrading() === 0, '    un pro ne refuse pas les retours (14 j de rétractation) ⇒ 400, zéro appel', `HTTP ${r2.r.code}`);
    const r3 = await pub({ retours: { acceptes: false } }, {}, CLE_PART);
    dit(r3.r.code === 200 && /ReturnsNotAccepted/.test((r3.a && r3.a.corps) || ''), '    un particulier peut les refuser', `HTTP ${r3.r.code} ${r3.r.corps && r3.r.corps.error || ''}`);
  });
  await essaie('Q', async () => {
    remettre();
    const r = await h({ action: 'parametres', q: 'nike air max' });
    const c = r.corps || {};
    dit(r.code === 200 && Array.isArray(c.categories) && c.categories.length === 2 && c.categories[0].chemin === 'Vêtements, accessoires › Chaussures homme', 'Q. suggestions d’eBay avec leur chemin', JSON.stringify(c.categories));
    dit(c.categoryId == null && c.aspects == null, '    la route ne CHOISIT jamais de catégorie (aucune caractéristique sans son choix)', `${c.categoryId} ${JSON.stringify(c.aspects)}`);
    dit(nTrading() === 0, '    lecture seule : aucun appel Trading', appels.map((x) => x.nom).join(','));
    EB.suggestions = 'aucune';
    const r2 = await h({ action: 'parametres', q: 'objet introuvable' });
    dit(r2.code === 200 && Array.isArray(r2.corps.categories) && r2.corps.categories.length === 0, '    aucune suggestion (204) ⇒ [] (l’app DEMANDE)', JSON.stringify(r2.corps.categories));
    EB.suggestions = 'muet';
    const r3 = await h({ action: 'parametres', q: 'nike' });
    dit(r3.code === 200 && r3.corps.categories === null, '    eBay muet ⇒ null (« pas su »), jamais []', JSON.stringify(r3.corps.categories));
    remettre();
    const r4 = await h({ action: 'parametres', categoryId: '15709' });
    const asp = (r4.corps && r4.corps.aspects) || [];
    const co = asp.find((x) => x.nom === 'Couleur') || {}, ma = asp.find((x) => x.nom === 'Matière') || {};
    dit(co.requis === true && co.multi === true && co.mode === 'SELECTION_ONLY' && co.valeurs.join() === 'Noir,Blanc,Bleu' && ma.recommande === true && ma.requis === false, '    caractéristiques : obligatoire, plusieurs valeurs, liste fermée, recommandée', JSON.stringify(asp));
    dit(r4.corps.conditions && r4.corps.conditions.obligatoire === true && r4.corps.conditions.etats.map((e) => e.id).join() === '1000,3000', '    états permis pour CETTE catégorie', JSON.stringify(r4.corps.conditions));
    EB.aspects = 'muet';
    const r5 = await h({ action: 'parametres', categoryId: '15709' });
    dit(r5.corps.aspects === null, '    caractéristiques illisibles ⇒ null, jamais []', JSON.stringify(r5.corps.aspects));
    remettre();
    const r6 = await h({ action: 'parametres', avecCompte: true });
    const cp = (r6.corps && r6.corps.compte) || {};
    dit(r6.code === 200 && cp.politiquesActivees === true && cp.paiement.length === 1 && Array.isArray(cp.retour) && cp.retour.length === 0 && cp.emplacements[0].ville === 'Rennes' && cp.type === 'pro', '    compte : politiques (une de paiement, AUCUNE de retour), emplacement, type pro', JSON.stringify(cp));
    EB.politiques = 'muet';
    const r7 = await h({ action: 'parametres', avecCompte: true });
    const cp7 = (r7.corps && r7.corps.compte) || {};
    dit(cp7.politiquesActivees === null && cp7.paiement === null && cp7.retour === null, '    droit refusé ⇒ politiques null (« pas lues »), jamais « aucune »', JSON.stringify(cp7));
    remettre();
    const r8 = await h({ action: 'parametres', categoryId: '15709x' });
    dit(r8.code === 400 && appels.length === 0, '    catégorie mal formée ⇒ 400, rien demandé à eBay', `HTTP ${r8.code}`);
  });
  await essaie('J', async () => {
    remettre();
    const r = await h({ action: 'status' });
    const cs = (r.corps && r.corps.comptes) || [];
    const p = cs.find((c) => c.principal) || {}, a = cs.find((c) => !c.principal) || {};
    dit(r.code === 200 && p.jeton && p.jeton.etat === 'bientot' && p.jeton.joursRestants >= 17 && p.jeton.joursRestants <= 18, 'J. le principal (jeton rangé il y a 530 j sur 548) : « bientôt », dit AVANT', JSON.stringify(p.jeton));
    dit(a.jeton && a.jeton.etat === 'ok', '    l’autre compte (rangé il y a 10 j) : ok', JSON.stringify(a.jeton));
    dit(!JSON.stringify(r.corps).includes('RT-'), '    aucun jeton dans la réponse');
    ROWS.ebay_tokens.saved_at = MAINTENANT - 600 * JOUR;
    const r2 = await h({ action: 'status' });
    dit(((r2.corps.comptes || []).find((c) => c.principal) || {}).jeton?.etat === 'expire', '    rangé il y a 600 j ⇒ « expiré »');
    remettre(); delete ROWS.ebay_tokens.saved_at;
    const r3 = await h({ action: 'status' });
    dit(((r3.corps.comptes || []).find((c) => c.principal) || {}).jeton === null, '    pas de date rangée ⇒ null (« pas su »), jamais « ok »');
  });
  await essaie('R', async () => {
    const rest = (re, m) => appels.filter((a) => re.test(a.nom) && (!m || a.methode === m));
    const base = { listingIds: ['110000000001', '110000000002'], debut: new Date(MAINTENANT + 3600000).toISOString(), fin: new Date(MAINTENANT + 8 * JOUR).toISOString() };
    remettre();
    const l = await h({ action: 'remises' });
    dit(l.code === 200 && (l.corps.remises || []).map((x) => x.id + ':' + x.type).join() === '9001:periode,9002:quantite', 'R. remises lues (période, quantité), avec leur fin ; un code promo n’est pas une remise VRM', JSON.stringify(l.corps.remises));
    remettre();
    const r0 = await h({ action: 'poserremise', type: 'periode', remise: 10, ...base });
    dit(r0.code === 400 && appels.length === 0, '    sans confirmation ⇒ 400, rien demandé à eBay', `HTTP ${r0.code}`);
    remettre();
    const r1 = await h({ action: 'poserremise', confirme: true, type: 'periode', remise: 10, ...base });
    const p1 = rest(/item_price_markdown$/, 'POST')[0];
    const c1 = (p1 && p1.corps) || {};
    dit(r1.code === 200 && r1.corps.fin === base.fin && c1.applyFreeShipping === false && c1.selectedInventoryDiscounts[0].discountBenefit.percentageOffItem === '10' && c1.endDate === base.fin && c1.selectedInventoryDiscounts[0].inventoryCriterion.listingIds.join() === base.listingIds.join(), '    remise sur une période : −10 %, ses annonces, date de fin, JAMAIS la livraison gratuite (§2.8)', JSON.stringify(c1).slice(0, 220));
    remettre();
    const r2 = await h({ action: 'poserremise', confirme: true, type: 'quantite', paliers: [5, 10], ...base });
    const c2 = ((rest(/item_promotion$/, 'POST')[0] || {}).corps) || {};
    dit(r2.code === 200 && c2.promotionType === 'VOLUME_DISCOUNT' && c2.applyFreeShipping === false && c2.discountRules.map((x) => x.discountSpecification.minQuantity + ':' + x.discountBenefit.percentageOffOrder).join() === '1:0,2:5,3:10', '    remise par quantité : 2 ⇒ −5 %, 3 ⇒ −10 %', JSON.stringify(c2.discountRules));
    const refus = [];
    for (const [nom, extra] of [['annonce étrangère', { listingIds: ['110000000999'] }], ['40 jours', { fin: new Date(MAINTENANT + 41 * JOUR).toISOString() }], ['paliers décroissants', { type: 'quantite', paliers: [10, 5] }], ['remise 90 %', { remise: 90 }], ['début passé', { debut: new Date(MAINTENANT - JOUR).toISOString() }]]) {
      remettre();
      const r = await h({ action: 'poserremise', confirme: true, type: 'periode', remise: 10, ...base, ...extra });
      if (!(r.code === 400 && rest(/marketing/).length === 0)) refus.push(`${nom} ⇒ ${r.code}`);
    }
    dit(refus.length === 0, '    annonce qui n’est pas à lui, 40 jours, paliers décroissants, 90 %, début passé ⇒ 400, rien envoyé', refus.join(' · '));
    remettre(); ROWS.ebay_listings = 'PANNE';
    const r3 = await h({ action: 'poserremise', confirme: true, type: 'periode', remise: 10, ...base });
    dit(r3.code === 503 && rest(/marketing/).length === 0, '    annonces illisibles ⇒ 503 « pas su », rien envoyé', `HTTP ${r3.code}`);
    remettre();
    const r4 = await h({ action: 'retirerremise', confirme: true, id: '9001' });
    const r5 = await h({ action: 'retirerremise', confirme: true, id: '9002' });
    const r6 = await h({ action: 'retirerremise', confirme: true, id: '9003' });
    dit(r4.corps.geste === 'pause' && rest(/\/promotion\/9001\/pause$/, 'POST').length === 1, '    retirer une remise EN COURS ⇒ pause chez eBay', JSON.stringify(r4.corps));
    dit(r5.corps.geste === 'supprimee' && rest(/item_promotion\/9002$/, 'DELETE').length === 1, '    retirer une remise programmée ⇒ supprimée', JSON.stringify(r5.corps));
    dit(r6.code === 409 && rest(/9003/, 'POST').length + rest(/9003/, 'DELETE').length === 0, '    un code promo (pas une remise VRM) n’est jamais retiré', `HTTP ${r6.code}`);
  });
  await essaie('A', async () => {
    const P = await import(pathToFileURL(path.join(racine, 'src', 'ebay', 'parametres.js')).href + '?t=' + Math.random());
    const S = await import(pathToFileURL(path.join(racine, 'api', '_lib', 'ebay-parametres.js')).href + '?t=' + Math.random());
    dit(P.parametresServeur(P.DEFAUTS_USINE) === null && P.parametresServeur(P.fusionner({}, {})) === null, 'A. réglage d’usine ⇒ rien n’est envoyé (l’annonce part comme avant)');
    const combos = [];
    for (const format of ['fixe', 'enchere']) for (const offres of [false, true]) for (const delaiEnvoi of [0, 3, 30]) for (const ret of [{ acceptes: true, jours: 14, payePar: 'Buyer' }, { acceptes: true, jours: 60, payePar: 'Seller' }, { acceptes: false }]) for (const pol of [{}, { paiement: '6200000001', expedition: '6200000009' }]) for (const type of ['pro', 'particulier'])
      combos.push({ r: { format, dureeJours: 10, offres, delaiEnvoi, retours: ret, politiques: pol, tva: '20', sponsorisee: true, tauxSponsor: '7.5', privee: offres, lieu: offres ? 'Lyon' : '', codePostal: '69001' }, type });
    const refus = [];
    for (const { r, type } of combos) {
      const pa = P.parametresServeur(r, { type });
      const o = S.optionsPublication({ price: '68', parametres: pa || undefined }, { type });
      const attendu = type === 'pro' && r.retours.acceptes === false;   // seul refus légitime : un pro qui refuse les retours
      if (!!o.err !== attendu) refus.push(`${JSON.stringify(r)} ${type} ⇒ ${o.err || 'accepté'}`);
      if (pa && (pa.politiques || {}).expedition) refus.push('expédition envoyée');
      if (pa && pa.tva && type !== 'pro') refus.push('TVA envoyée pour un particulier');
    }
    dit(refus.length === 0, `    aller-retour app ⇒ route sur ${combos.length} combinaisons : la route accepte ce que l’app envoie, jamais d’expédition, TVA du pro seul`, refus.slice(0, 3).join(' · '));
    const asp = [{ nom: 'Couleur', requis: true, multi: true, mode: 'SELECTION_ONLY', valeurs: ['Noir', 'Blanc', 'Bleu'] }, { nom: 'Marque', requis: true, mode: 'FREE_TEXT', valeurs: [] }, { nom: 'Type', requis: true, mode: 'SELECTION_ONLY', valeurs: ['Baskets'] }, { nom: 'Pointure EU', requis: true, mode: 'SELECTION_ONLY', valeurs: ['42', '43'] }];
    const pr = P.preRemplir(asp, { couleur: 'Noir, Bleu ciel', marque: 'Nike', taille: '42' });
    dit(pr.valeurs.Couleur === undefined && pr.valeurs.Marque === 'Nike' && pr.valeurs['Pointure EU'] === '42', '    une liste fermée : « Bleu ciel » n’est PAS posé (ni « Noir » seul) ; Nike et 42 le sont', JSON.stringify(pr.valeurs));
    const qs = P.questions({ categoryId: '15709', aspects: asp, valeurs: pr.valeurs, indices: pr.indices });
    dit(qs.map((q) => q.nom).join() === 'Couleur,Type' && qs[0].vinted === 'Noir, Bleu ciel', '    l’app DEMANDE Couleur (avec « Vinted dit ») et Type', JSON.stringify(qs.map((q) => [q.nom, q.vinted])));
    dit(P.questions({ categoryId: '', categories: [] })[0].type === 'categorie' && P.questions({ categoryId: '', categories: null })[0].pasSu === true, '    pas de catégorie ⇒ la 1re question est « Quelle catégorie ? » (« pas su » dit)');
    dit(P.questions({ categoryId: '1', compte: { politiquesActivees: true, paiement: [{ id: '1' }], retour: [] } }).some((q) => q.type === 'politique' && q.quoi === 'retour') && !P.questions({ categoryId: '1', compte: { politiquesActivees: true, paiement: null, retour: null } }).some((q) => q.type === 'politique'), '    politique de retour manquante ⇒ demandée ; politiques pas lues ⇒ rien affirmé');
    const e1 = P.traduireErreur({ erreurs: [{ code: '21919303', message: 'The item specific Brand is missing.', params: ['Brand'], severite: 'Error' }] });
    const e2 = P.traduireErreur({ error: 'Auth token is hard expired.' });
    const e3 = P.traduireErreur({ reason: 'deja-en-ligne' }), e4 = P.traduireErreur({ error: 'Quelque chose' });
    dit(e1.cle === 'caracteristique' && e1.nom === 'Brand' && e2.cle === 'jeton' && e3.cle === 'deja' && e4.cle === 'autre', '    erreurs d’eBay traduites (caractéristique nommée, jeton, déjà en vente, autre)', JSON.stringify([e1, e2, e3, e4]));
    dit(P.etatCompte({ relie: true, jeton: { etat: 'bientot' } }) === 'bientot' && P.etatCompte({ relie: true, jeton: null }) === 'relie-sans-date' && P.etatCompte({ relie: null }) === 'pas-su' && P.etatCompte({ relie: false }) === 'plus-relie', '    état d’un compte : bientôt · sans date · pas su · plus relié');
    // Chaque clé dynamique existe dans les 5 langues.
    const manque = [];
    const cles = [];
    for (const c of P.CATALOGUE) if (!['categorie', 'caracteristiques', 'etat', 'photos', 'description', 'quantite'].includes(c.cle)) { cles.push(`ebay.param.${c.cle}`); if (c.cle !== 'dureeJours') cles.push(`ebay.param.${c.cle}.aide`); }
    for (const g of ['vente', 'envoi', 'retours', 'compte', 'visibilite']) cles.push(`ebay.groupe.${g}`);
    for (const id of Object.keys(P.GUIDES)) { cles.push(`ebay.guide.${id}.titre`, ...P.etapesGuide(id)); }
    for (const id of ['offre', 'vente', 'retour']) cles.push(`ebay.guide.${id}.court`);
    for (const k of ['confirmation', 'prix', 'livraison', 'numero', 'offre', 'reglage', 'site', 'injoignable', 'incertain', 'jeton', 'droit', 'deja', 'categorie', 'caracteristique', 'etat', 'photo', 'limite', 'politique', 'retours', 'autre']) cles.push(`ebay.err.${k}`, `ebay.err.${k}.geste`);
    for (const k of ['refus', 'navigateur', 'code', 'cles', 'identite-illisible', 'principal-inconnu', 'comptes-pas-su', 'registre-ko', 'store-failed', 'echange', 'autre']) cles.push(`ebay.cx.err.${k}`, `ebay.cx.err.${k}.geste`);
    for (const t of ['categorie', 'caracteristique', 'etat', 'descripteur', 'politique']) cles.push(`ebay.q.titre.${t}`);
    for (const r of P.resume({ format: 'enchere', offres: true, delaiEnvoi: 1, lieu: 'x', retours: { acceptes: false }, politiques: { paiement: '6200000001' }, privee: true })) cles.push(r.cle);
    for (const l of ['fr', 'en', 'es', 'it', 'de']) {
      const d = (await import(pathToFileURL(path.join(racine, 'src', 'i18n', 'langues', l + '.js')).href + '?t=' + Math.random())).default;
      for (const k of cles) if (!(k in d)) manque.push(`${l}:${k}`);
    }
    dit(manque.length === 0, `    les ${cles.length} clés dynamiques (champs, groupes, fenêtres, erreurs, résumés) existent dans les 5 langues`, manque.slice(0, 6).join(' '));
  });
  return { ko, out };
}

// Les mutations : chacune réaffaiblit UNE règle ; le banc doit rougir.
const MUTATIONS = {
  'xml-vide-pas-vide': ['api/_lib/ebay-parametres.js', "  if (!o) return vide;", "  if (!o) return { ...vide, apresEtat: ' ' };"],
  'expedition-envoyee': ['api/_lib/ebay-parametres.js', "    if (out.expedition && it.ebayGere !== false) delete out.expedition;", ''],
  'enchere-fixe': ['api/_lib/ebay-parametres.js', "  return (verif ? 'Verify' : '') + (enchere ? 'AddItem' : 'AddFixedPriceItem');", "  return (verif ? 'Verify' : '') + 'AddFixedPriceItem';"],
  'tva-particulier': ['api/_lib/ebay-parametres.js', "    if (compte.type !== 'pro') return { err: 'La TVA", "    if (false) return { err: 'La TVA"],
  'duree-libre': ['api/_lib/ebay-parametres.js', '    if (!DUREES_ENCHERE.includes(d)) return', '    if (!(d > 0)) return'],
  'categorie-choisie': ['api/ebay.js', "  if (treeId && categoryId) {", "  const choisie = categoryId || (categories && categories[0] && categories[0].id) || '';\n  if (treeId && choisie) { const categoryId = choisie;"],
  'pas-su-vide': ['api/ebay.js', "    aspects = ap.ok ? lireAspects(ap.data) : null;", "    aspects = ap.ok ? lireAspects(ap.data) : [];"],
  'jeton-toujours-ok': ['api/_lib/ebay-parametres.js', "etat: expireLe <= maintenant ? 'expire' : reste <= PREVENIR_JOURS ? 'bientot' : 'ok'", "etat: 'ok'"],
  'type-oublie': ['api/_lib/ebay.js', ", ...(p && p.type ? { type: p.type } : {}) } };", ' } };'],
  'app-usine-envoyee': ['src/ebay/parametres.js', '  return Object.keys(p).length ? p : null;\n}', '  return p;\n}'],
  'app-hors-liste': ['src/ebay/parametres.js', '      if (ok.length !== vus.length) {', '      if (ok.length === 0) {'],
  'app-sans-categorie': ['src/ebay/parametres.js', "  if (!p.categoryId) out.push({ type: 'categorie'", "  if (false) out.push({ type: 'categorie'"],
  'app-expedition': ['src/ebay/parametres.js', '  delete pol.expedition;', ''],
  'remise-port-gratuit': ['api/_lib/ebay-remises.js', "  if (d.type === 'periode') return { ...base, applyFreeShipping: false,", "  if (d.type === 'periode') return { ...base, applyFreeShipping: true,"],
  'remise-annonces-de-tous': ['api/_lib/ebay-remises.js', '  if (etrangeres.length) return', '  if (false) return'],
  'remise-en-cours-supprimee': ['api/_lib/ebay-remises.js', "  const enCours = /^(RUNNING)$/i.test(p.etat);", '  const enCours = false;'],
};

const BASE = () => { try { return execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: RACINE }).toString().trim(); } catch (_) { return ''; } };
function arbreAvant() {
  if (process.env.AVANT) return process.env.AVANT;
  const b = BASE(); if (!b) return '';
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ebay-avant-'));
  const tar = execFileSync('git', ['archive', b, 'api', 'src'], { cwd: RACINE, maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', d], { input: tar });
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(d, 'node_modules')); } catch (_) {}
  return d;
}
function copie(mut) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ebay-complet-'));
  for (const sous of ['api', 'src']) fs.cpSync(path.join(RACINE, sous), path.join(d, sous), { recursive: true });
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(d, 'node_modules')); } catch (_) {}
  const [f, a, b] = MUTATIONS[mut];
  const p = path.join(d, f), t = fs.readFileSync(p, 'utf8');
  if (!t.includes(a)) throw new Error(`mutation ${mut} : ancre absente`);
  fs.writeFileSync(p, t.replace(a, b));
  return d;
}

(async () => {
  const av = arbreAvant();
  const avant = av ? await avantXml(av).catch((e) => { console.log('KO  l’arbre d’avant ne publie pas : ' + e.message); return null; }) : null;
  if (!process.argv.includes('--prouve')) {
    const { ko, out } = await verifier(RACINE, avant);
    out.forEach((l) => console.log(l));
    console.log(`\n${out.length - ko} contrôle(s) OK, ${ko} en échec`);
    process.exit(ko ? 1 : 0);
  }
  let vertes = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let d; try { d = copie(m); } catch (e) { console.log(`KO  ${m} : ${e.message}`); vertes++; continue; }
    const { ko, out } = await verifier(d, avant);
    console.log(`${ko ? 'OK ' : 'KO '} mutation « ${m} » : ${ko} rouge(s)${ko ? ' — ' + out.filter((l) => l.startsWith('KO')).map((l) => l.slice(4, 70)).slice(0, 2).join(' | ') : ''}`);
    if (!ko) vertes++;
  }
  console.log(`\n${Object.keys(MUTATIONS).length - vertes}/${Object.keys(MUTATIONS).length} mutations rougies`);
  process.exit(vertes ? 1 : 0);
})();
