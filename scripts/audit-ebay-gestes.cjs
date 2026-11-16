// AUDIT : eBay complet 3 (15 nov., 2e tour) — les GESTES sur une annonce, exécutés par la vraie
// route `api/ebay.js` (§4.10) contre un FAUX eBay qui garde l'état d'une annonce et l'applique
// comme eBay (ReviseItem remplace l'ensemble des caractéristiques / photos fournies). Formes de la
// documentation (GetItem, ReviseItem, getListingViolations, Browse item_summary/search,
// GetBestOffers, RespondToBestOffer). Aucun appel réel, données inventées.
//   node scripts/audit-ebay-gestes.cjs            (le dépôt)
//   node scripts/audit-ebay-gestes.cjs --prouve   (chaque mutation doit rougir)
//   node scripts/audit-ebay-gestes.cjs --avant    (l'arbre de départ doit rougir)
// On exige :
//   D. `diagnostic` : caractéristiques manquantes et valeurs proposées, « évidentes » (une seule
//      valeur), peu de photos, prix au-dessus des comparables (médiane de ≥ 5 annonces actives, sa
//      propre annonce et une autre devise exclues), par ePID quand il existe sinon Marque + Modèle +
//      Pointure + catégorie + état ; < 5 comparables ⇒ rien d'affirmé ; produit du catalogue proposé ;
//      lecture seule (aucun ReviseItem) ;
//   C. `corrigeraspects` : sans clic ⇒ rien ; une valeur hors des propositions d'eBay ⇒ rien ; une
//      caractéristique déjà remplie n'est JAMAIS écrasée ; les autres caractéristiques restent ;
//      relu après : eBay qui accepte sans appliquer ⇒ « pas relu », jamais « fait » ; journalisé ;
//   P. `lierproduit` : seulement l'ePID que eBay propose (relu), sans photos ni texte du catalogue,
//      relu après ;
//   F. `ajouterphotos` : le nombre de photos vu à l'aperçu doit être celui d'eBay ; les photos
//      d'avant restent ; relu après ;
//   O. `repondreoffre` : le prix vu doit être celui de l'offre (sinon rien) ; relu après (encore en
//      attente ⇒ « pas relu ») ; aucune acceptation sans clic ;
//   G. §2.8 : aucune écriture ne touche la livraison (aucun ShippingDetails / FreeShipping).
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const PROPRIO = '11111111-1111-1111-1111-111111111111';
process.env.VRM_OWNER_UID = PROPRIO;
process.env.EBAY_APP_ID = 'app'; process.env.EBAY_CERT_ID = 'cert'; process.env.EBAY_RUNAME = 'ru'; process.env.SUPABASE_SERVICE_KEY = 'svc';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://base.banc.test';
const MAINTENANT = Date.now(), JOUR = 86400000;

let ROWS = {}, ECRITS = [], APPELS = [], EB = {}, ITEMS = {}, OFFRES = {};
const remettre = () => {
  ROWS = {
    ebay_comptes: { comptes: [{ principal: true, cle: 'aaaaaaaaaaaaaaaa', pseudo: 'vendeur_fr', type: 'particulier', typeLuLe: MAINTENANT, site: 'FR', ajouteLe: MAINTENANT - 300 * JOUR, vuLe: MAINTENANT }] },
    ebay_tokens: { refresh_token: 'RT', saved_at: MAINTENANT - 10 * JOUR, refresh_expires_days: 548 },
  };
  ITEMS = {
    '110000000001': { titre: 'Nike Air Max 90 blanche', specs: { Marque: ['Nike'], 'Modèle': ['Air Max 90'] }, photos: ['https://i.ebayimg.com/a1.jpg', 'https://i.ebayimg.com/a2.jpg'], prix: '120.00', cat: '15709', etat: '3000', epid: '' },
    '110000000002': { titre: 'Adidas Samba', specs: { Marque: ['Adidas'], 'Modèle': ['Samba'], Pointure: ['42'] }, photos: ['https://i.ebayimg.com/b1.jpg', 'https://i.ebayimg.com/b2.jpg', 'https://i.ebayimg.com/b3.jpg', 'https://i.ebayimg.com/b4.jpg', 'https://i.ebayimg.com/b5.jpg'], prix: '80.00', cat: '15709', etat: '3000', epid: '' },
  };
  OFFRES = { '7001': { itemId: '110000000002', prix: '70.00', status: 'Pending' } };
  ECRITS = []; APPELS = [];
  EB = { applique: true, offreApplique: true, comparables: 'ok' };
};
const json = (o, st = 200) => new Response(o === undefined ? '' : JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json' } });
const xml = (s) => new Response('<?xml version="1.0" encoding="utf-8"?>' + s, { status: 200 });
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dexml = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const itemXml = (id) => { const it = ITEMS[id]; if (!it) return ''; return `<Item><ItemID>${id}</ItemID><Title>${esc(it.titre)}</Title><ListingType>FixedPriceItem</ListingType><PrimaryCategory><CategoryID>${it.cat}</CategoryID></PrimaryCategory><ConditionID>${it.etat}</ConditionID><SellingStatus><CurrentPrice currencyID="EUR">${it.prix}</CurrentPrice><ListingStatus>Active</ListingStatus></SellingStatus><PictureDetails>${it.photos.map((u) => `<PictureURL>${esc(u)}</PictureURL>`).join('')}</PictureDetails>${it.epid ? `<ProductListingDetails><ProductReferenceID>${it.epid}</ProductReferenceID></ProductListingDetails>` : ''}<ItemSpecifics>${Object.entries(it.specs).map(([n, vs]) => `<NameValueList><Name>${esc(n)}</Name>${vs.map((v) => `<Value>${esc(v)}</Value>`).join('')}</NameValueList>`).join('')}</ItemSpecifics></Item>`; };
const VIOL = { ASPECTS_ADOPTION: { listingViolations: [{ complianceType: 'ASPECTS_ADOPTION', listingId: '110000000001', violations: [{ reasonCode: 'MISSING_OR_INVALID_REQUIRED_ASPECTS', violationData: [{ name: 'MISSING_ASPECT', value: 'Pointure' }, { name: 'MISSING_ASPECT', value: 'Couleur' }], correctiveRecommendations: { aspectRecommendations: [{ localizedAspectName: 'Pointure', suggestedValues: ['42'] }, { localizedAspectName: 'Couleur', suggestedValues: ['Blanc', 'Gris'] }] } }] }] },
  PRODUCT_ADOPTION: { listingViolations: [{ complianceType: 'PRODUCT_ADOPTION', listingId: '110000000001', violations: [{ reasonCode: 'PRODUCT_ADOPTION', correctiveRecommendations: { productRecommendation: { epid: '2254990123' } } }] }] } };
const COMP = (n, prix) => ({ total: n + 2, itemSummaries: [
  ...Array.from({ length: n }, (_, i) => ({ itemId: `v1|1200000000${i}|0`, legacyItemId: `1200000000${i}`, price: { value: String(prix[i % prix.length]), currency: 'EUR' } })),
  { itemId: 'v1|110000000002|0', legacyItemId: '110000000002', price: { value: '120.00', currency: 'EUR' } },   // la sienne : exclue
  { itemId: 'v1|1300|0', legacyItemId: '1300', price: { value: '10.00', currency: 'GBP' } },                     // autre devise : exclue
] });
global.fetch = async (url, opts = {}) => {
  const u = String(url), ud = decodeURIComponent(u), h = opts.headers || {};
  if (u.includes('/auth/v1/user')) return json({ id: PROPRIO, email: 'p@exemple.test' });
  if (u.includes('identity/v1/oauth2/token')) return json({ access_token: /client_credentials/.test(String(opts.body)) ? 'APP' : 'AT', expires_in: 7200 });
  if (u.includes('/rest/v1/rpc/')) return json(true);
  if (u.includes('/rest/v1/app_data')) {
    const id = (/id=eq\.([^&]*)/.exec(u) || [])[1];
    if (opts.method && opts.method !== 'GET') {
      let corps = null; try { corps = JSON.parse(opts.body); } catch (_) {}
      const ligne = Array.isArray(corps) ? corps[0] : corps; const lid = id || (ligne && ligne.id);
      ECRITS.push({ id: lid, data: ligne && ligne.data }); if (lid && ligne && ligne.data) ROWS[lid] = ligne.data;
      return opts.method === 'PATCH' ? json([{ id: lid }]) : json([], 201);
    }
    if (/select=owner&limit=1/.test(u)) return json([{ owner: PROPRIO }]);
    if (!id || !(id in ROWS)) return json([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || 'data';
    if (/^rev:/.test(sel)) return json([{ rev: ROWS[id].rev != null ? String(ROWS[id].rev) : null }]);
    if (/->>/.test(sel)) { const o = {}; for (const p of decodeURIComponent(sel).split(',')) { const m = /^(?:([^:]+):)?data->>(\w+)$/.exec(p); if (m) o[m[1] || m[2]] = ROWS[id][m[2]] == null ? null : String(ROWS[id][m[2]]); } return json([o]); }
    return json([{ data: ROWS[id] }]);
  }
  if (u.includes('/ws/api.dll')) {
    const nom = h['X-EBAY-API-CALL-NAME'] || '', corps = String(opts.body || '');
    APPELS.push({ hote: 'trading', nom, corps });
    const id = (/<ItemID>(\d+)<\/ItemID>/.exec(corps) || [])[1];
    if (nom === 'GetItem') return ITEMS[id] ? xml(`<GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack>${itemXml(id)}</GetItemResponse>`) : xml('<GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack><Errors><ShortMessage>x</ShortMessage><LongMessage>Item not found</LongMessage><ErrorCode>17</ErrorCode><SeverityCode>Error</SeverityCode><ErrorClassification>RequestError</ErrorClassification></Errors></GetItemResponse>');
    if (nom === 'ReviseItem') {
      const it = ITEMS[id];
      if (it && EB.applique) {
        const sp = /<ItemSpecifics>([\s\S]*?)<\/ItemSpecifics>/.exec(corps);
        if (sp) { const specs = {}; for (const m of sp[1].matchAll(/<NameValueList><Name>([\s\S]*?)<\/Name>([\s\S]*?)<\/NameValueList>/g)) specs[dexml(m[1])] = [...m[2].matchAll(/<Value>([\s\S]*?)<\/Value>/g)].map((x) => dexml(x[1])); it.specs = specs; }
        const pd = /<PictureDetails>([\s\S]*?)<\/PictureDetails>/.exec(corps);
        if (pd) it.photos = [...pd[1].matchAll(/<PictureURL>([\s\S]*?)<\/PictureURL>/g)].map((x) => dexml(x[1]));
        const ep = /<ProductReferenceID>(\d+)<\/ProductReferenceID>/.exec(corps);
        if (ep) it.epid = ep[1];
      }
      return xml(`<ReviseItemResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><ItemID>${id}</ItemID></ReviseItemResponse>`);
    }
    if (nom === 'GetBestOffers') {
      const oid = (/<BestOfferID>(\d+)<\/BestOfferID>/.exec(corps) || [])[1];
      const os_ = Object.entries(OFFRES).filter(([k]) => !oid || k === oid);
      return xml(`<GetBestOffersResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><ItemBestOffersArray>${os_.map(([k, o]) => `<ItemBestOffers><Item><ItemID>${o.itemId}</ItemID><Title>x</Title></Item><BestOffers><BestOffer><BestOfferID>${k}</BestOfferID><Price currencyID="EUR">${o.prix}</Price><Status>${o.status}</Status><Quantity>1</Quantity></BestOffer></BestOffers></ItemBestOffers>`).join('')}</ItemBestOffersArray></GetBestOffersResponse>`);
    }
    if (nom === 'RespondToBestOffer') {
      const oid = (/<BestOfferID>(\d+)<\/BestOfferID>/.exec(corps) || [])[1], act = (/<Action>(\w+)<\/Action>/.exec(corps) || [])[1];
      if (OFFRES[oid] && EB.offreApplique) OFFRES[oid].status = act === 'Accept' ? 'Accepted' : act === 'Decline' ? 'Declined' : 'Countered';
      return xml('<RespondToBestOfferResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack></RespondToBestOfferResponse>');
    }
    return xml(`<${nom}Response xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack></${nom}Response>`);
  }
  if (/^https:\/\/apiz?\.ebay\.com\//.test(u)) {
    APPELS.push({ hote: new URL(u).host, chemin: new URL(u).pathname, requete: ud.split('?')[1] || '', methode: opts.method || 'GET', jeton: String(h.Authorization || '') });
    if (u.includes('/sell/compliance/v1/listing_violation?')) {
      const t = (/compliance_type=(\w+)/.exec(u) || [])[1], lid = (/listing_id=(\d+)/.exec(u) || [])[1];
      const v = VIOL[t]; const l = v ? v.listingViolations.filter((x) => !lid || x.listingId === lid) : [];
      return l.length ? json({ total: l.length, listingViolations: l }) : new Response(null, { status: 204 });
    }
    if (u.includes('/buy/browse/v1/item_summary/search')) {
      if (EB.comparables === 'peu') return json(COMP(3, [60, 62, 64]));
      return json(COMP(8, [70, 72, 75, 78, 80, 82, 85, 90]));
    }
    return json({}, 404);
  }
  return json({}, 404);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.end = () => r; r.setHeader = () => r; return r; };
async function charger(racine) {
  const mod = await import(pathToFileURL(path.join(racine, 'api', 'ebay.js')).href + '?t=' + Math.random());
  return (body) => { const res = faireRes(); return mod.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer eyJh.banc-proprio.sig' }, body }, res).then(() => res); };
}
const revisions = () => APPELS.filter((a) => a.nom === 'ReviseItem');

async function verifier(racine) {
  const out = []; let ko = 0;
  const dit = (c, m, d) => { out.push((c ? 'OK  ' : 'KO  ') + m + (c || !d ? '' : '  → ' + String(d).slice(0, 240))); if (!c) ko++; };
  let route; try { route = await charger(racine); } catch (e) { dit(false, 'la route se charge', e.message); return { ko, out }; }
  const essai = async (t, f) => { try { await f(); } catch (e) { dit(false, t + ' : exception', e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e); } };

  await essai('D', async () => {
    remettre();
    const r = await route({ action: 'diagnostic', itemIds: ['110000000001', '110000000002'] });
    const a = ((r.corps && r.corps.annonces) || []).find((x) => x.itemId === '110000000001') || {};
    const cles = (a.raisons || []).map((x) => x.cle);
    dit(r.corps && r.corps.ok === true && cles.includes('caracteristiques') && a.propositions && a.propositions.manque.join() === 'Pointure,Couleur', 'D1. caractéristiques manquantes lues chez eBay : Pointure, Couleur', JSON.stringify(a.propositions));
    dit(a.evidentes && JSON.stringify(a.evidentes) === '{"Pointure":"42"}', 'D2. « évidente » = une seule valeur proposée (Pointure 42, pas Couleur)', JSON.stringify(a.evidentes));
    dit(cles.includes('photos') && a.photos === 2, 'D3. peu de photos : 2', JSON.stringify(a.photos));
    dit(cles.includes('catalogue') && a.propositions.epid === '2254990123', 'D4. produit du catalogue proposé par eBay (ePID)', JSON.stringify(a.propositions && a.propositions.epid));
    const b = ((r.corps && r.corps.annonces) || []).find((x) => x.itemId === '110000000002') || {};
    const rp = (b.raisons || []).find((x) => x.cle === 'prix');
    dit(b.comparables && b.comparables.n === 8 && b.comparables.mediane === 79 && !rp && b.comparablesBase === 'caracteristiques', 'D5. 80 € pour une médiane de 79 € (8 comparables, la sienne et la livre exclues) : PAS plus cher', JSON.stringify([b.comparables, b.raisons]));
    const ap = APPELS.find((x) => /item_summary\/search/.test(x.chemin || '') && /Samba/.test(x.requete));
    dit(ap && /aspect_filter=categoryId:15709,Marque:\{Adidas\},Modèle:\{Samba\},Pointure:\{42\}/.test(ap.requete) && /conditionIds:\{3000\}/.test(ap.requete) && ap.jeton === 'Bearer APP', 'D6. comparables : mêmes caractéristiques (Marque, Modèle, Pointure), même catégorie, même état, jeton d’APPLICATION', ap && ap.requete);
    // L'annonce 1 n'a pas de pointure : pas de comparables (rien d'affirmé sur le prix).
    dit(a.comparables === null && !cles.includes('prix'), 'D7. sans pointure ni ePID : aucune comparaison inventée', JSON.stringify(a.comparables));
    ITEMS['110000000002'].prix = '120.00';
    const r2 = await route({ action: 'diagnostic', itemIds: ['110000000002'] });
    const rp2 = ((r2.corps.annonces[0] || {}).raisons || []).find((x) => x.cle === 'prix');
    dit(rp2 && rp2.mediane === 79 && rp2.prix === 120 && rp2.n === 8, 'D8. 120 € pour une médiane de 79 € sur 8 : « plus cher que les comparables »', JSON.stringify(rp2));
    EB.comparables = 'peu';
    const r3 = await route({ action: 'diagnostic', itemIds: ['110000000002'] });
    dit(!((r3.corps.annonces[0] || {}).raisons || []).some((x) => x.cle === 'prix'), 'D9. moins de 5 comparables : rien d’affirmé sur le prix');
    ITEMS['110000000002'].epid = '999000111';
    await route({ action: 'diagnostic', itemIds: ['110000000002'] });
    const ae = [...APPELS].reverse().find((x) => /item_summary\/search/.test(x.chemin || ''));
    dit(ae && /epid=999000111/.test(ae.requete) && !/aspect_filter/.test(ae.requete), 'D10. un ePID connu : les comparables sont le MÊME produit du catalogue', ae && ae.requete);
    dit(revisions().length === 0, 'D11. le diagnostic n’écrit rien chez eBay');
  });

  await essai('C', async () => {
    remettre();
    const r0 = await route({ action: 'corrigeraspects', itemId: '110000000001', aspects: { Pointure: '42' } });
    dit(r0.corps && r0.corps.ok === false && r0.corps.reason === 'confirmation' && revisions().length === 0, 'C1. sans son clic (confirme) : rien n’est envoyé', JSON.stringify(r0.corps));
    const r1 = await route({ action: 'corrigeraspects', itemId: '110000000001', aspects: { Pointure: '45' }, confirme: true });
    dit(r1.corps && r1.corps.reason === 'hors-proposition' && revisions().length === 0, 'C2. une valeur que eBay ne propose pas (45) : rien n’est envoyé', JSON.stringify(r1.corps));
    const r2 = await route({ action: 'corrigeraspects', itemId: '110000000001', aspects: { Pointure: '42', Couleur: 'Blanc' }, confirme: true });
    const it = ITEMS['110000000001'];
    dit(r2.corps && r2.corps.ok === true && r2.corps.relu === true && it.specs.Pointure.join() === '42' && it.specs.Couleur.join() === 'Blanc', 'C3. ajoutées, RELUES chez eBay : Pointure 42, Couleur Blanc', JSON.stringify([r2.corps, it.specs]));
    dit(it.specs.Marque.join() === 'Nike' && it.specs['Modèle'].join() === 'Air Max 90', 'C4. les caractéristiques d’avant sont renvoyées telles quelles (Marque, Modèle restent)', JSON.stringify(it.specs));
    const j = ROWS.ebay_agent_journal && ROWS.ebay_agent_journal.items && ROWS.ebay_agent_journal.items[0];
    dit(j && j.action === 'corrigeraspects' && j.etat === 'reussi', 'C5. journalisé dans « Ce que VRM a fait »', JSON.stringify(j));
    const n = revisions().length;
    // Déjà remplie : jamais écrasée (la proposition est là, mais l'annonce porte déjà une valeur).
    VIOL.ASPECTS_ADOPTION.listingViolations[0].violations[0].correctiveRecommendations.aspectRecommendations.push({ localizedAspectName: 'Marque', suggestedValues: ['Adidas'] });
    const r3 = await route({ action: 'corrigeraspects', itemId: '110000000001', aspects: { Marque: 'Adidas' }, confirme: true });
    VIOL.ASPECTS_ADOPTION.listingViolations[0].violations[0].correctiveRecommendations.aspectRecommendations.pop();
    dit(r3.corps && r3.corps.reason === 'deja-rempli' && revisions().length === n && it.specs.Marque.join() === 'Nike', 'C6. une caractéristique déjà remplie n’est JAMAIS écrasée', JSON.stringify(r3.corps));
    remettre(); EB.applique = false;
    const r4 = await route({ action: 'corrigeraspects', itemId: '110000000001', aspects: { Pointure: '42' }, confirme: true });
    dit(r4.corps && r4.corps.ok === false && r4.corps.reason === 'pas-relu', 'C7. eBay dit « Success » sans appliquer : « pas relu », jamais « fait »', JSON.stringify(r4.corps));
    const xmlRev = (revisions()[0] || {}).corps || '';
    dit(!/ShippingDetails|FreeShipping|ShippingService/.test(xmlRev), 'G1. §2.8 : la révision ne touche jamais la livraison');
  });

  await essai('P', async () => {
    remettre();
    const r0 = await route({ action: 'lierproduit', itemId: '110000000001', epid: '2254990123' });
    dit(r0.corps.reason === 'confirmation' && revisions().length === 0, 'P1. sans son clic : rien');
    const r1 = await route({ action: 'lierproduit', itemId: '110000000001', epid: '1111111', confirme: true });
    dit(r1.corps.reason === 'hors-proposition' && revisions().length === 0, 'P2. un ePID que eBay ne propose pas : rien', JSON.stringify(r1.corps));
    const r2 = await route({ action: 'lierproduit', itemId: '110000000001', epid: '2254990123', confirme: true });
    const x = (revisions()[0] || {}).corps || '';
    dit(r2.corps.ok === true && r2.corps.relu === true && ITEMS['110000000001'].epid === '2254990123', 'P3. relié au produit proposé, RELU', JSON.stringify(r2.corps));
    dit(/<IncludeStockPhotoURL>false<\/IncludeStockPhotoURL>/.test(x) && /<IncludeeBayProductDetails>false<\/IncludeeBayProductDetails>/.test(x) && ITEMS['110000000001'].photos.length === 2, 'P4. sans les photos ni le texte du catalogue : ses photos restent', x.slice(0, 300));
  });

  await essai('F', async () => {
    remettre();
    const neuves = ['https://images1.vinted.net/t/a.jpg', 'https://images1.vinted.net/t/b.jpg'];
    const r0 = await route({ action: 'ajouterphotos', itemId: '110000000001', photos: neuves, nVu: 2 });
    dit(r0.corps.reason === 'confirmation' && revisions().length === 0, 'F1. sans son clic : rien');
    const r1 = await route({ action: 'ajouterphotos', itemId: '110000000001', photos: neuves, nVu: 3, confirme: true });
    dit(r1.corps.reason === 'photos-changees' && revisions().length === 0, 'F2. l’annonce n’a plus le nombre de photos vu à l’aperçu : rien', JSON.stringify(r1.corps));
    const r2 = await route({ action: 'ajouterphotos', itemId: '110000000001', photos: neuves, nVu: 2, confirme: true });
    const ph = ITEMS['110000000001'].photos;
    dit(r2.corps.ok === true && r2.corps.n === 4 && ph[0] === 'https://i.ebayimg.com/a1.jpg' && ph[3] === neuves[1], 'F3. 2 photos ajoutées APRÈS les siennes, relues : 4', JSON.stringify([r2.corps, ph]));
  });

  await essai('O', async () => {
    remettre();
    const r0 = await route({ action: 'repondreoffre', itemId: '110000000002', offerId: '7001', decision: 'Accept', expectedPrice: '70.00', currency: 'EUR' });
    dit(r0.corps.reason === 'confirmation' && !APPELS.some((a) => a.nom === 'RespondToBestOffer'), 'O1. accepter sans son clic : rien (aucune acceptation automatique)');
    const r1 = await route({ action: 'repondreoffre', itemId: '110000000002', offerId: '7001', decision: 'Accept', expectedPrice: '65.00', currency: 'EUR', confirme: true });
    dit(r1.corps.ok === false && !APPELS.some((a) => a.nom === 'RespondToBestOffer'), 'O2. le prix vu (65) n’est pas celui de l’offre (70) : rien', JSON.stringify(r1.corps));
    const r2 = await route({ action: 'repondreoffre', itemId: '110000000002', offerId: '7001', decision: 'Counter', price: '75', expectedPrice: '70.00', currency: 'EUR', confirme: true });
    dit(r2.corps.ok === true && r2.corps.relu === 'Countered', 'O3. contre-offre partie, RELUE (Countered)', JSON.stringify(r2.corps));
    remettre(); EB.offreApplique = false;
    const r3 = await route({ action: 'repondreoffre', itemId: '110000000002', offerId: '7001', decision: 'Decline', expectedPrice: '70.00', currency: 'EUR', confirme: true });
    dit(r3.corps.ok === false && r3.corps.reason === 'pas-relu', 'O4. eBay répond sans changer l’offre : « pas relu », jamais « fait »', JSON.stringify(r3.corps));
  });
  return { ko, out };
}

const MUTATIONS = {
  'ecrit-sans-clic': ['api/_lib/ebay-gestes.js', "    if (b.confirme !== true) return echec(\"Confirme l'ajout des caractéristiques", "    if (false) return echec(\"Confirme l'ajout des caractéristiques"],
  'hors-proposition': ['api/_lib/ebay-gestes.js', "      if (!vs || !vs.some((x) => norm(x) === norm(val))) return", '      if (false) return'],
  'ecrase': ['api/_lib/ebay-gestes.js', '    if (deja.length) return echec(', '    if (false) return echec('],
  'specs-perdues': ['api/_lib/ebay-gestes.js', '    const specs = { ...avant.specs };', '    const specs = {};'],
  'sans-relecture': ['api/_lib/ebay-gestes.js', "    const apres = await getItem(a.token, itemId);\n    const manquent", "    const apres = { ...avant, specs };\n    const manquent"],
  'epid-non-propose': ['api/_lib/ebay-gestes.js', '    if (p.epid !== epid) return', '    if (false) return'],
  'catalogue-photos': ['api/_lib/ebay-gestes.js', '<IncludeStockPhotoURL>false</IncludeStockPhotoURL>', '<IncludeStockPhotoURL>true</IncludeStockPhotoURL>'],
  'photos-nombre-vu': ['api/_lib/ebay-gestes.js', '    if (avant.photos.length !== b.nVu) return', '    if (false) return'],
  'photos-remplacees': ['api/_lib/ebay-gestes.js', '    const toutes = [...avant.photos, ...neuves', '    const toutes = [...neuves'],
  'comparables-sans-minimum': ['api/_lib/ebay-gestes.js', 'export const COMPARABLES_MIN = 5;', 'export const COMPARABLES_MIN = 1;'],
  'comparables-avec-soi': ['api/_lib/ebay-gestes.js', "x && String(x.legacyItemId || '') !== String(itemId) && ", 'x && '],
  'comparables-sans-etat': ['api/_lib/ebay-gestes.js', "${/^\\d{4}$/.test(a.etat) ? `,conditionIds:{${a.etat}}` : ''}", ''],
  'offre-prix-different': ['api/_lib/ebay-gestion.js', "    if((!argent(b.expectedPrice)", "    if(false && (!argent(b.expectedPrice)"],
  'offre-sans-relecture': ['api/_lib/ebay-gestion.js', "    if(o2 && ['Pending','Active'].includes(o2.status))return", '    if(false)return'],
};
function copie(mut) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ebay-gestes-'));
  for (const sous of ['api', 'src']) fs.cpSync(path.join(RACINE, sous), path.join(d, sous), { recursive: true });
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(d, 'node_modules')); } catch (_) {}
  const [f, a, b] = MUTATIONS[mut];
  const p = path.join(d, f), t = fs.readFileSync(p, 'utf8');
  if (!t.includes(a)) throw new Error(`ancre absente dans ${f}`);
  fs.writeFileSync(p, t.replace(a, b));
  return d;
}
function arbreAvant() {
  if (process.env.AVANT) return process.env.AVANT;
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ebay-gestes-avant-'));
  execFileSync('tar', ['-x', '-C', d], { input: execFileSync('git', ['archive', '7c5ddaf5', 'api', 'src'], { cwd: RACINE, maxBuffer: 1 << 28 }) });
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(d, 'node_modules')); } catch (_) {}
  return d;
}
(async () => {
  if (process.argv.includes('--avant')) { const { ko, out } = await verifier(arbreAvant()); out.forEach((l) => console.log(l)); console.log(`\nArbre de départ : ${ko} rouge(s) (attendu : beaucoup)`); process.exit(ko ? 0 : 1); }
  if (!process.argv.includes('--prouve')) {
    const { ko, out } = await verifier(RACINE);
    out.forEach((l) => console.log(l));
    console.log(`\n${out.length - ko} contrôle(s) OK, ${ko} en échec`);
    process.exit(ko ? 1 : 0);
  }
  let vertes = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let d; try { d = copie(m); } catch (e) { console.log(`KO  ${m} : ${e.message}`); vertes++; continue; }
    const { ko, out } = await verifier(d);
    console.log(`${ko ? 'OK ' : 'KO '} mutation « ${m} » : ${ko} rouge(s)${ko ? ' — ' + out.filter((l) => l.startsWith('KO')).map((l) => l.slice(4, 70)).slice(0, 2).join(' | ') : ''}`);
    if (!ko) vertes++;
  }
  console.log(`\n${Object.keys(MUTATIONS).length - vertes}/${Object.keys(MUTATIONS).length} mutations rougies`);
  process.exit(vertes ? 1 : 0);
})();
