// AUDIT : eBay complet 2 (15 nov.) — l'argent réel, le trafic, la santé du compte, les
// annonces à corriger, les évaluations reçues, les litiges, et la SIGNATURE des appels.
// EXÉCUTE la vraie route `api/ebay.js` (§4.10) contre un FAUX eBay qui répond à la forme
// de la documentation officielle (pages citées dans api/_lib/ebay-tableau.js) et une
// fausse base. Aucun appel réel, données inventées.
//   node scripts/audit-ebay-tableau.cjs            (le code du dépôt)
//   node scripts/audit-ebay-tableau.cjs --prouve   (chaque mutation doit rougir)
//   AVANT=<arbre> node scripts/audit-ebay-tableau.cjs --avant   (doit rougir sur l'arbre de départ)
// On exige :
//   S. la Finances API part vers apiz.ebay.com, SIGNÉE (Ed25519, RFC 9421) : le faux eBay
//      VÉRIFIE la signature avec la clé publique ; sans clé posée, le 403 de signature est
//      dit « signature » (jamais « reconnecte ») ; le solde de `finances` est enfin rangé ;
//   A. `argent` : net, frais RÉELS et date de versement par commande (SUCCEEDED seulement) ;
//      un versement lancé n'est pas « versé » ; une commande remboursée n'a plus de date ;
//      une autre devise n'est jamais additionnée ; frais hors vente (sponsorisation) à part ;
//      la ligne rangée ne contient AUCUN acheteur ; une lecture ratée n'écrit rien et ne
//      rend jamais [] ;
//   T. `trafic` : lu par CLÉ de métrique (ordre quelconque), `applicable:false` ⇒ null,
//      « ne se voient pas » = ≥ 7 j en ligne et < 50 affichages ; absente du rapport ⇒
//      « pas de chiffres », jamais 0 ; droit manquant ⇒ « scope » ;
//   H. `sante` : niveau, niveau prévu, note des réclamations, annonces à corriger avec les
//      caractéristiques manquantes et les valeurs suggérées ; 204 ⇒ [] ;
//   E. `evaluationsrecues` : score, négatives sur 12 mois, dernières (retirées écartées) ;
//   L. `litiges` : litiges de paiement, réclamations, cas ; une partie refusée n'efface pas
//      les autres ;
//   D. `tableau` : tout en un aller-retour, une partie en panne porte `ko` ;
//   W. aucune de ces actions n'écrit chez eBay (GET seulement ; Trading : GetFeedback seul) ;
//   R. le remboursement d'un retour part SIGNÉ, l'empreinte du corps exacte.
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const PROPRIO = '11111111-1111-1111-1111-111111111111';
process.env.VRM_OWNER_UID = PROPRIO;
process.env.EBAY_APP_ID = 'app'; process.env.EBAY_CERT_ID = 'cert'; process.env.EBAY_RUNAME = 'ru'; process.env.SUPABASE_SERVICE_KEY = 'svc';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://base.banc.test';
const MAINTENANT = Date.now(), JOUR = 86400000;
const iso = (t) => new Date(t).toISOString();

// La paire de clés du banc (Ed25519), comme celle que rend la Key Management API.
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PRIVEE = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
const JWE = 'eyJ.banc-jwe.cle-publique';

let ROWS = {}, ECRITS = [], APPELS = [], EB = {};
const remettre = () => {
  ROWS = {
    ebay_comptes: { comptes: [{ principal: true, cle: 'aaaaaaaaaaaaaaaa', pseudo: 'vendeur_fr', type: 'particulier', typeLuLe: MAINTENANT, site: 'FR', ajouteLe: MAINTENANT - 300 * JOUR, vuLe: MAINTENANT }] },
    ebay_tokens: { refresh_token: 'RT', saved_at: MAINTENANT - 10 * JOUR, refresh_expires_days: 548 },
    ebay_listings: { items: [
      { itemId: '110000000001', title: 'Vieille', depuis: iso(MAINTENANT - 40 * JOUR) },
      { itemId: '110000000002', title: 'Vue', depuis: iso(MAINTENANT - 40 * JOUR) },
      { itemId: '110000000003', title: 'Neuve', depuis: iso(MAINTENANT - 2 * JOUR) },
      { itemId: '110000000004', title: 'Absente du rapport', depuis: iso(MAINTENANT - 20 * JOUR) },
    ], capturedAt: MAINTENANT },
    ebay_messages: { nonLus: 3, ids: ['1', '2', '3'], complet: true, capturedAt: MAINTENANT },
  };
  ECRITS = []; APPELS = [];
  EB = { finances: 'ok', payout: 'ok', analytics: 'ok', dispute: 'ok', conformite: 'ok' };
};
const json = (o, st = 200) => new Response(o === undefined ? '' : JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json' } });
const xml = (s) => new Response('<?xml version="1.0" encoding="utf-8"?>' + s, { status: 200 });
// Vérifie la signature comme eBay : la base refaite depuis les EN-TÊTES reçus et l'URL.
function signatureValide(url, opts) {
  const h = opts.headers || {};
  const si = h['Signature-Input'] || '', sg = h['Signature'] || '', jwe = h['x-ebay-signature-key'] || '';
  const m = /^sig1=(\((?:"[^"]+"\s?)+\);created=(\d+))$/.exec(si), s = /^sig1=:([A-Za-z0-9+/=]+):$/.exec(sg);
  if (!m || !s || jwe !== JWE) return false;
  if (Math.abs(Number(m[2]) * 1000 - Date.now()) > 300000) return false;
  const comps = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  const u = new URL(url);
  if (opts.body != null && opts.body !== '') {
    const d = 'sha-256=:' + crypto.createHash('sha256').update(String(opts.body)).digest('base64') + ':';
    if (h['Content-Digest'] !== d || !comps.includes('content-digest')) return false;
  }
  const val = { 'content-digest': h['Content-Digest'], 'x-ebay-signature-key': jwe, '@method': String(opts.method || 'GET').toUpperCase(), '@path': u.pathname, '@authority': u.host };
  for (const c of ['x-ebay-signature-key', '@method', '@path', '@authority']) if (!comps.includes(c)) return false;
  const base = comps.map((c) => `"${c}": ${val[c]}`).concat(`"@signature-params": ${m[1]}`).join('\n');
  try { return crypto.verify(null, Buffer.from(base), publicKey, Buffer.from(s[1], 'base64')); } catch (_) { return false; }
}
const REFUS_SIG = { errors: [{ errorId: 215120, domain: 'ACCESS', category: 'REQUEST', message: 'Signature validation failed' }] };
const TRANSACTIONS = { total: 6, transactions: [
  { transactionId: 'T1', transactionType: 'SALE', bookingEntry: 'CREDIT', orderId: '01-11111-11111', payoutId: 'P1', buyer: { username: 'acheteur_secret' }, amount: { value: '85.40', currency: 'EUR' }, totalFeeAmount: { value: '12.60', currency: 'EUR' }, totalFeeBasisAmount: { value: '98.00', currency: 'EUR' }, transactionDate: iso(MAINTENANT - 9 * JOUR), transactionStatus: 'PAYOUT' },
  { transactionId: 'T2', transactionType: 'SALE', bookingEntry: 'CREDIT', orderId: '01-22222-22222', payoutId: 'P2', buyer: { username: 'acheteur_secret' }, amount: { value: '50.00', currency: 'EUR' }, totalFeeAmount: { value: '7.10', currency: 'EUR' }, transactionDate: iso(MAINTENANT - 3 * JOUR), transactionStatus: 'PAYOUT' },
  { transactionId: 'T3', transactionType: 'SALE', bookingEntry: 'CREDIT', orderId: '01-33333-33333', payoutId: 'P1', buyer: { username: 'acheteur_secret' }, amount: { value: '40.00', currency: 'GBP' }, totalFeeAmount: { value: '5.00', currency: 'GBP' }, transactionDate: iso(MAINTENANT - 9 * JOUR), transactionStatus: 'PAYOUT' },
  { transactionId: 'T4', transactionType: 'SALE', bookingEntry: 'CREDIT', orderId: '01-44444-44444', payoutId: 'P1', buyer: { username: 'acheteur_secret' }, amount: { value: '60.00', currency: 'EUR' }, totalFeeAmount: { value: '8.00', currency: 'EUR' }, transactionDate: iso(MAINTENANT - 12 * JOUR), transactionStatus: 'PAYOUT' },
  { transactionId: 'T5', transactionType: 'REFUND', bookingEntry: 'DEBIT', orderId: '01-44444-44444', amount: { value: '60.00', currency: 'EUR' }, transactionDate: iso(MAINTENANT - 6 * JOUR), transactionStatus: 'COMPLETED' },
  { transactionId: 'T7', transactionType: 'NON_SALE_CHARGE', bookingEntry: 'DEBIT', feeType: 'AD_FEE', orderId: '01-33333-33333', amount: { value: '1.50', currency: 'GBP' }, transactionDate: iso(MAINTENANT - 8 * JOUR), transactionStatus: 'COMPLETED' },
  { transactionId: 'T6', transactionType: 'NON_SALE_CHARGE', bookingEntry: 'DEBIT', feeType: 'AD_FEE', orderId: '01-11111-11111', amount: { value: '3.20', currency: 'EUR' }, transactionDate: iso(MAINTENANT - 8 * JOUR), transactionStatus: 'COMPLETED' },
] };
global.fetch = async (url, opts = {}) => {
  const u = String(url), ud = decodeURIComponent(u), h = opts.headers || {};
  if (u.includes('/auth/v1/user')) return json({ id: PROPRIO, email: 'p@exemple.test' });
  if (u.includes('identity/v1/oauth2/token')) return json({ access_token: 'AT', expires_in: 7200 });
  if (u.includes('/rest/v1/rpc/')) return json(true);
  if (u.includes('/rest/v1/app_data')) {
    const id = (/id=eq\.([^&]*)/.exec(u) || [])[1];
    if (opts.method && opts.method !== 'GET') {
      let corps = null; try { corps = JSON.parse(opts.body); } catch (_) {}
      const ligne = Array.isArray(corps) ? corps[0] : corps;
      const lid = id || (ligne && ligne.id);
      ECRITS.push({ id: lid, data: ligne && ligne.data });
      if (lid && ligne && ligne.data) ROWS[lid] = ligne.data;
      return opts.method === 'PATCH' ? json([{ id: lid }]) : json([], 201);
    }
    if (/select=owner&limit=1/.test(u)) return json([{ owner: PROPRIO }]);
    if (!id || !(id in ROWS)) return json([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || 'data';
    if (/^rev:/.test(sel)) return json([{ rev: ROWS[id].rev != null ? String(ROWS[id].rev) : null }]);
    if (/->>/.test(sel)) { const out = {}; for (const p of decodeURIComponent(sel).split(',')) { const m = /^(?:([^:]+):)?data->>(\w+)$/.exec(p); if (m) out[m[1] || m[2]] = ROWS[id][m[2]] == null ? null : String(ROWS[id][m[2]]); } return json([out]); }
    return json([{ data: ROWS[id] }]);
  }
  if (u.includes('/ws/api.dll')) {
    const nom = h['X-EBAY-API-CALL-NAME'] || '';
    APPELS.push({ hote: 'trading', nom, methode: 'POST' });
    if (nom === 'GetFeedback') return xml(`<GetFeedbackResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><FeedbackScore>212</FeedbackScore>
      <FeedbackDetailArray>
        <FeedbackDetail><CommentingUser>client_ravi</CommentingUser><CommentText>Parfait, merci !</CommentText><CommentTime>2026-11-10T10:00:00.000Z</CommentTime><CommentType>Positive</CommentType><ItemID>110000000009</ItemID><ItemTitle>Nike Air Max 90</ItemTitle><Role>Seller</Role><FeedbackID>9001</FeedbackID></FeedbackDetail>
        <FeedbackDetail><CommentingUser>client_decu</CommentingUser><CommentText>Pas la bonne taille</CommentText><CommentTime>2026-11-08T10:00:00.000Z</CommentTime><CommentType>Negative</CommentType><ItemID>110000000008</ItemID><ItemTitle>Adidas Samba</ItemTitle><Role>Seller</Role><FeedbackID>9002</FeedbackID></FeedbackDetail>
        <FeedbackDetail><CommentingUser>x</CommentingUser><CommentText>retirée</CommentText><CommentTime>2026-11-01T10:00:00.000Z</CommentTime><CommentType>Withdrawn</CommentType><FeedbackID>9003</FeedbackID></FeedbackDetail>
      </FeedbackDetailArray>
      <FeedbackSummary><PositiveFeedbackPercent>99.1</PositiveFeedbackPercent>
        <PositiveFeedbackPeriodArray><FeedbackPeriod><PeriodInDays>30</PeriodInDays><Count>12</Count></FeedbackPeriod><FeedbackPeriod><PeriodInDays>365</PeriodInDays><Count>140</Count></FeedbackPeriod></PositiveFeedbackPeriodArray>
        <NeutralFeedbackPeriodArray><FeedbackPeriod><PeriodInDays>365</PeriodInDays><Count>2</Count></FeedbackPeriod></NeutralFeedbackPeriodArray>
        <NegativeFeedbackPeriodArray><FeedbackPeriod><PeriodInDays>365</PeriodInDays><Count>1</Count></FeedbackPeriod></NegativeFeedbackPeriodArray>
      </FeedbackSummary></GetFeedbackResponse>`);
    if (nom === 'GetBestOffers') return xml(`<GetBestOffersResponse xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><ItemBestOffersArray><ItemBestOffers><Item><ItemID>110000000002</ItemID><Title>Paire vue</Title></Item><BestOffers><BestOffer><BestOfferID>7001</BestOfferID><Price currencyID="EUR">70.00</Price><Status>Pending</Status><Quantity>1</Quantity></BestOffer><BestOffer><BestOfferID>7002</BestOfferID><Price currencyID="EUR">65.00</Price><Status>Pending</Status><Quantity>1</Quantity></BestOffer></BestOffers></ItemBestOffers></ItemBestOffersArray><PaginationResult><TotalNumberOfPages>1</TotalNumberOfPages></PaginationResult></GetBestOffersResponse>`);
    return xml(`<${nom}Response xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack></${nom}Response>`);
  }
  if (/^https:\/\/apiz?\.ebay\.com\//.test(u)) {
    const signe = !!h['Signature'];
    APPELS.push({ hote: new URL(u).host, chemin: new URL(u).pathname, requete: ud.split('?')[1] || '', methode: opts.method || 'GET', signe, valide: signe ? signatureValide(u, opts) : false, corps: opts.body || null });
    const exigeSig = /\/sell\/finances\//.test(u) || /\/issue_refund$/.test(new URL(u).pathname);
    if (exigeSig && (!signe || !signatureValide(u, opts))) return json(REFUS_SIG, 403);
    if (u.startsWith('https://api.ebay.com/sell/finances/')) return json({ errors: [{ message: 'Not found' }] }, 404);   // la Finances API n'est pas sur api.
    if (u.includes('/sell/finances/v1/seller_funds_summary')) return EB.finances === 'panne' ? json({}, 500) : json({ totalFunds: { value: '235.40', currency: 'EUR' }, availableFunds: { value: '120.00', currency: 'EUR' }, processingFunds: { value: '115.40', currency: 'EUR' }, fundsOnHold: { value: '0.00', currency: 'EUR' } });
    if (u.includes('/sell/finances/v1/payout')) return EB.payout === 'panne' ? json({}, 500) : json({ total: 2, payouts: [
      { payoutId: 'P1', payoutStatus: 'SUCCEEDED', payoutDate: '2026-11-10T03:00:00.000Z', amount: { value: '145.40', currency: 'EUR' }, transactionCount: 3, payoutInstrument: { instrumentType: 'BANK', nickname: 'Compte', accountLastFourDigits: '4321' } },
      { payoutId: 'P2', payoutStatus: 'INITIATED', payoutDate: '2026-11-14T03:00:00.000Z', amount: { value: '50.00', currency: 'EUR' }, transactionCount: 1 } ] });
    if (u.includes('/sell/finances/v1/transaction')) return EB.transactions === 'panne' ? json({}, 500) : json(TRANSACTIONS);
    if (u.includes('/sell/analytics/v1/traffic_report')) {
      if (EB.analytics === 'scope') return json({ errors: [{ errorId: 1100, message: 'Insufficient permissions' }] }, 403);
      if (EB.analytics === 'panne') return json({}, 500);
      return json({ startDate: iso(MAINTENANT - 30 * JOUR), endDate: iso(MAINTENANT - JOUR), lastUpdatedDate: iso(MAINTENANT - JOUR),
        header: { dimensionKeys: [{ key: 'LISTING_ID', dataType: 'STRING' }], metrics: [{ key: 'TRANSACTION', dataType: 'INTEGER' }, { key: 'LISTING_IMPRESSION_TOTAL', dataType: 'INTEGER' }, { key: 'LISTING_VIEWS_TOTAL', dataType: 'INTEGER' }] },
        dimensionMetadata: [{ metadataHeader: { key: 'LISTING_ID', metadataKeys: [{ key: 'LISTING_TITLE' }] }, metadataRecords: [{ value: { value: '110000000001' }, metadataValues: [{ value: 'Vieille paire' }] }, { value: { value: '110000000002' }, metadataValues: [{ value: 'Paire vue' }] }] }],
        records: [
          { dimensionValues: [{ value: '110000000001', applicable: true }], metricValues: [{ value: 0, applicable: true }, { value: 12, applicable: true }, { value: 3, applicable: true }] },
          { dimensionValues: [{ value: '110000000002', applicable: true }], metricValues: [{ value: 1, applicable: true }, { value: 940, applicable: true }, { value: 61, applicable: false }] },
          { dimensionValues: [{ value: '110000000003', applicable: true }], metricValues: [{ value: 0, applicable: true }, { value: 4, applicable: true }, { value: 0, applicable: true }] },
        ] });
    }
    if (u.includes('/sell/analytics/v1/seller_standards_profile')) return EB.analytics === 'panne' ? json({}, 500) : json({ standardsProfiles: [
      { program: 'PROGRAM_GLOBAL', defaultProgram: true, standardsLevel: 'ABOVE_STANDARD', cycle: { cycleType: 'CURRENT', evaluationDate: '2026-11-01T00:00:00.000Z' }, metrics: [
        { metricKey: 'DEFECTIVE_TRANSACTION_RATE', name: 'Transaction defect rate', value: { numerator: 1, denominator: 80, value: '1.25' }, level: 'ABOVE_STANDARD', thresholdUpperBound: { value: '2.0' }, type: 'RATE' },
        { metricKey: 'SHIPPING_MISS_RATE', name: 'Late shipment rate', value: '0.5', level: 'TOP_RATED', type: 'RATE' } ] },
      { program: 'PROGRAM_GLOBAL', defaultProgram: true, standardsLevel: 'TOP_RATED', cycle: { cycleType: 'PROJECTED', evaluationDate: '2026-12-01T00:00:00.000Z' }, metrics: [] } ] });
    if (u.includes('/sell/analytics/v1/customer_service_metric/ITEM_NOT_AS_DESCRIBED')) return EB.analytics === 'panne' ? json({}, 500) : json({ marketplaceId: 'EBAY_FR', dimensionMetrics: [{ dimension: { dimensionKey: 'LEAF_CATEGORY', name: 'Baskets homme', value: '15709' }, metrics: [{ metricKey: 'CNT_INAD', value: 3 }, { metricKey: 'RATE_INAD', value: 0.04, benchmark: { rating: 'HIGH' } }] }] });
    if (u.includes('/sell/analytics/v1/customer_service_metric/ITEM_NOT_RECEIVED')) return EB.analytics === 'panne' ? json({}, 500) : new Response(null, { status: 204 });
    if (u.includes('/sell/compliance/v1/listing_violation_summary')) return EB.conformite === 'aucune' ? new Response(null, { status: 204 }) : json({ violationSummaries: [{ complianceType: 'ASPECTS_ADOPTION', marketplaceId: 'EBAY_FR', listingCount: 1 }, { complianceType: 'HTTPS', marketplaceId: 'EBAY_FR', listingCount: 0 }] });
    if (u.includes('/sell/compliance/v1/listing_violation')) return json({ total: 1, listingViolations: [{ complianceType: 'ASPECTS_ADOPTION', listingId: '110000000001', sku: 'VRM-12', violations: [{ reasonCode: 'MISSING_OR_INVALID_REQUIRED_ASPECTS', message: 'Pointure manquante', complianceState: 'OUT_OF_COMPLIANCE', violationData: [{ name: 'MISSING_ASPECT', value: 'Pointure' }], correctiveRecommendations: { aspectRecommendations: [{ localizedAspectName: 'Pointure', suggestedValues: ['42', '43'] }] } }] }] });
    if (u.includes('/sell/fulfillment/v1/payment_dispute_summary')) return EB.dispute === 'scope' ? json({ errors: [{ message: 'Insufficient permissions' }] }, 403) : json({ total: 1, paymentDisputeSummaries: [{ paymentDisputeId: '5000000001', orderId: '01-11111-11111', reason: 'ITEM_NOT_RECEIVED', paymentDisputeStatus: 'ACTION_NEEDED', openDate: iso(MAINTENANT - 2 * JOUR), respondByDate: iso(MAINTENANT + 5 * JOUR), amount: { value: '98.00', currency: 'EUR' }, buyerUsername: 'acheteur_secret' }] });
    if (u.includes('/post-order/v2/inquiry/search')) return json({ members: [{ inquiryId: '5100000001', itemId: '110000000009', inquiryStatusEnum: 'WAITING_SELLER_RESPONSE', creationDate: { value: iso(MAINTENANT - JOUR) }, respondByDate: { value: iso(MAINTENANT + 2 * JOUR) }, claimAmount: { value: '70.00', currency: 'EUR' }, buyer: 'acheteur_secret' }] });
    if (u.includes('/post-order/v2/casemanagement/search')) return json({ members: [] });
    if (/\/post-order\/v2\/return\/\d+$/.test(new URL(u).pathname)) return json({ summary: { returnId: '5200000001', orderId: '01-11111-11111', state: 'RETURN_REQUESTED', sellerTotalRefund: { estimatedRefundAmount: { value: '98.00', currency: 'EUR' } }, creationInfo: { item: { itemId: '110000000009' } } } });
    if (/\/issue_refund$/.test(u)) return json({ refundStatus: 'SUCCESS' });
    return json({}, 404);
  }
  return json({}, 404);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.end = () => r; r.setHeader = () => r; return r; };
async function charger(racine) {
  const mod = await import(pathToFileURL(path.join(racine, 'api', 'ebay.js')).href + '?t=' + Math.random());
  return (body) => { const res = faireRes(); return mod.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer eyJh.banc-proprio.sig' }, body }, res).then(() => res); };
}
const avecCle = (oui) => { if (oui) { process.env.EBAY_SIGNATURE_PRIVEE = PRIVEE; process.env.EBAY_SIGNATURE_JWE = JWE; } else { delete process.env.EBAY_SIGNATURE_PRIVEE; delete process.env.EBAY_SIGNATURE_JWE; } };

async function verifier(racine) {
  const out = []; let ko = 0;
  const dit = (c, m, d) => { out.push((c ? 'OK  ' : 'KO  ') + m + (c || !d ? '' : '  → ' + String(d).slice(0, 220))); if (!c) ko++; };
  let route;
  try { route = await charger(racine); } catch (e) { dit(false, 'la route se charge', e.message); return { ko, out }; }
  const essai = async (titre, f) => { try { await f(); } catch (e) { dit(false, titre + ' : exception', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e); } };

  await essai('S', async () => {
    remettre(); avecCle(true);
    const r = await route({ action: 'finances' });
    const fin = APPELS.filter((a) => /\/sell\/finances\//.test(a.chemin || ''));
    dit(fin.length > 0 && fin.every((a) => a.hote === 'apiz.ebay.com'), 'S1. la Finances API part vers apiz.ebay.com (jamais api.ebay.com)', JSON.stringify(fin.map((a) => a.hote)));
    dit(fin.length > 0 && fin.every((a) => a.signe && a.valide), 'S2. chaque appel Finances est SIGNÉ et la signature se vérifie avec la clé publique (Ed25519, RFC 9421)', JSON.stringify(fin.map((a) => [a.signe, a.valide])));
    dit(r.corps && r.corps.ok === true && r.corps.dispo === 120 && r.corps.enAttente === 115.4 && ECRITS.some((e) => e.id === 'ebay_finances'), 'S3. `finances` : le solde est enfin lu et rangé (120,00 disponibles, 115,40 en cours)', JSON.stringify(r.corps));
    dit(!APPELS.filter((a) => !/\/sell\/finances\//.test(a.chemin || '') && a.hote !== 'trading').some((a) => a.signe), 'S4. seuls les appels qui l’exigent sont signés');
    remettre(); avecCle(false);
    const r2 = await route({ action: 'finances' });
    dit(r2.corps && r2.corps.ok === false && r2.corps.reason === 'signature' && /signature/i.test(r2.corps.error || ''), 'S5. sans clé posée, le refus d’eBay est dit « signature » — jamais « reconnecte »', JSON.stringify(r2.corps));
    dit(!ECRITS.some((e) => e.id === 'ebay_finances'), 'S6. un solde pas lu n’écrit rien');
  });

  await essai('A', async () => {
    remettre(); avecCle(true);
    const r = await route({ action: 'argent' });
    const b = r.corps || {};
    const c = b.commandes || {};
    dit(b.ok === true && c['01-11111-11111'] && c['01-11111-11111'].net === 85.4 && c['01-11111-11111'].frais === 12.6 && c['01-11111-11111'].versement === '2026-11-10T03:00:00.000Z', 'A1. par commande : net 85,40, frais RÉELS 12,60, versée le 10 nov.', JSON.stringify(c['01-11111-11111']));
    dit(c['01-22222-22222'] && c['01-22222-22222'].versement === null && c['01-22222-22222'].statut === 'INITIATED', 'A2. un versement LANCÉ (pas arrivé) ne vaut pas « versé »', JSON.stringify(c['01-22222-22222']));
    dit(c['01-44444-44444'] && c['01-44444-44444'].rembourse === true && c['01-44444-44444'].sur === false, 'A3. une commande remboursée est marquée, son net n’est plus sûr', JSON.stringify(c['01-44444-44444']));
    dit(c['01-33333-33333'] && c['01-33333-33333'].devise === 'GBP' && b.horsVente && b.horsVente.EUR && b.horsVente.EUR.total === 3.2 && b.horsVente.GBP && b.horsVente.GBP.total === 1.5, 'A4. une autre devise reste à part (GBP), frais hors vente en euros : 3,20 (sponsorisation)', JSON.stringify(b.horsVente));
    const ligne = ROWS.ebay_versements;
    dit(ligne && ligne.dates && ligne.dates['01-11111-11111'] === '2026-11-10' && !('01-22222-22222' in ligne.dates) && !('01-44444-44444' in ligne.dates), 'A5. la ligne rangée `ebay_versements` : la date de versement des seules commandes VERSÉES et sûres', JSON.stringify(ligne && ligne.dates));
    dit(ligne && !JSON.stringify(ligne).includes('acheteur_secret'), 'A6. aucun acheteur dans la ligne rangée');
    // Fusion : une date déjà lue n'est pas effacée par une lecture qui ne la couvre plus.
    ROWS.ebay_versements = { ...ligne, dates: { ...ligne.dates, '01-99999-99999': '2026-08-01', '01-44444-44444': '2026-11-01' } };
    await route({ action: 'argent' });
    dit(ROWS.ebay_versements.dates['01-99999-99999'] === '2026-08-01', 'A7. une date de versement ancienne (hors fenêtre de 90 jours) reste rangée');
    dit(!('01-44444-44444' in ROWS.ebay_versements.dates), 'A7b. une commande remboursée PERD sa date déjà rangée (son argent n’est plus sûr)', JSON.stringify(ROWS.ebay_versements.dates));
    remettre(); avecCle(true); EB.payout = 'panne';
    const r2 = await route({ action: 'argent' });
    dit(r2.corps && r2.corps.ok === false && r2.corps.reason === 'pas-su' && !Array.isArray(r2.corps.commandes) && !ECRITS.some((e) => e.id === 'ebay_versements'), 'A8. versements illisibles ⇒ « pas su », rien d’écrit, jamais une liste vide', JSON.stringify(r2.corps));
    remettre(); avecCle(true); EB.transactions = 'panne';
    const r3 = await route({ action: 'argent' });
    dit(r3.corps && r3.corps.ok === false && r3.corps.reason === 'pas-su' && !('commandes' in r3.corps) && !ECRITS.some((e) => e.id === 'ebay_versements'), 'A8b. détail des ventes illisible ⇒ « pas su », rien d’écrit (une page ratée n’est jamais « aucune vente »)', JSON.stringify(r3.corps));
    const vs = (r.corps.versements || []);
    dit(vs.length === 2 && vs[0].vers === 'BANK •••• 4321' && !JSON.stringify(vs).includes('nickname'), 'A9. versements : date, état, montant ; le compte bancaire réduit à ses 4 derniers chiffres', JSON.stringify(vs[0]));
  });

  await essai('T', async () => {
    remettre(); avecCle(true);
    const r = await route({ action: 'trafic' });
    const b = r.corps || {}; const a = (id) => (b.annonces || []).find((x) => x.itemId === id) || {};
    dit(b.ok === true && a('110000000001').affichages === 12 && a('110000000001').vues === 3 && a('110000000001').ventes === 0 && a('110000000002').affichages === 940, 'T1. les métriques sont lues par CLÉ (ordre rendu par eBay quelconque)', JSON.stringify(b.annonces));
    dit(a('110000000002').vues === null, 'T2. `applicable:false` ⇒ « pas su » (null), jamais 0', JSON.stringify(a('110000000002')));
    const inv = b.invisibles || {};
    dit(Array.isArray(inv.invisibles) && inv.invisibles.map((x) => x.itemId).join() === '110000000001', 'T3. « ne se voient pas » : la seule annonce de plus de 7 jours sous 50 affichages (pas la neuve, pas la vue)', JSON.stringify(inv));
    dit(Array.isArray(inv.sansChiffres) && inv.sansChiffres.includes('110000000004'), 'T4. absente du rapport ⇒ « pas de chiffres », jamais « 0 affichage »', JSON.stringify(inv.sansChiffres));
    const ap = APPELS.find((x) => /traffic_report/.test(x.chemin || ''));
    dit(ap && /marketplace_ids:\{EBAY_FR\}/.test(ap.requete) && /date_range:\[\d{8}\.\.\d{8}\]/.test(ap.requete) && /dimension=LISTING/.test(ap.requete), 'T5. le rapport est demandé pour le marché du compte (EBAY_FR), par annonce, sur une plage de dates', ap && ap.requete);
    remettre(); EB.analytics = 'scope';
    const r2 = await route({ action: 'trafic' });
    dit(r2.corps && r2.corps.ok === false && r2.corps.reason === 'scope' && !('annonces' in r2.corps), 'T6. droit Analytics pas encore accordé ⇒ « reconnecte » (scope), jamais une liste vide', JSON.stringify(r2.corps));
  });

  await essai('H', async () => {
    remettre(); avecCle(true);
    const r = await route({ action: 'sante' });
    const b = r.corps || {};
    dit(b.niveau && b.niveau.niveau === 'ABOVE_STANDARD' && b.niveau.prevu === 'TOP_RATED', 'H1. niveau vendeur lu (au-dessus du standard), niveau prévu (Top Fiabilité)', JSON.stringify(b.niveau && { n: b.niveau.niveau, p: b.niveau.prevu }));
    const m = b.niveau && (b.niveau.metriques || []).find((x) => x.cle === 'DEFECTIVE_TRANSACTION_RATE');
    dit(m && m.valeur === 1.25 && m.seuil === 2, 'H2. une métrique en objet {value} est lue (1,25 % pour un seuil de 2 %)', JSON.stringify(m));
    dit(b.nonConforme && b.nonConforme.note === 'HIGH' && b.nonRecu && b.nonRecu.note === null, 'H3. réclamations « pas conforme » : note HIGH ; « pas reçu » : 204 ⇒ rien à comparer (null, pas « bon »)', JSON.stringify([b.nonConforme, b.nonRecu]));
    const c = (b.aCorriger || [])[0];
    dit(c && c.itemId === '110000000001' && c.problemes[0].manque.includes('Pointure') && c.problemes[0].suggestions[0].valeurs.join() === '42,43', 'H4. annonce à corriger : la caractéristique manquante (Pointure) et les valeurs suggérées par eBay', JSON.stringify(c));
    dit(APPELS.filter((a) => /listing_violation\b/.test(a.chemin || '') && !/summary/.test(a.chemin || '')).length === 1, 'H5. le détail n’est demandé que pour les types qui ont des annonces (1 sur 2)');
    remettre(); EB.conformite = 'aucune';
    const r2 = await route({ action: 'sante' });
    dit(Array.isArray(r2.corps.conformite) && r2.corps.conformite.length === 0, 'H6. aucune annonce à corriger (204) ⇒ [] (lu, rien)', JSON.stringify(r2.corps.conformite));
  });

  await essai('E', async () => {
    remettre();
    const r = await route({ action: 'evaluationsrecues' });
    const b = r.corps || {};
    dit(b.ok === true && b.score === 212 && b.pourcent === 99.1 && b.an.negatives === 1 && b.an.positives === 140, 'E1. score 212, 99,1 %, sur 12 mois : 140 positives, 1 négative', JSON.stringify({ s: b.score, p: b.pourcent, an: b.an }));
    dit(Array.isArray(b.dernieres) && b.dernieres.length === 2 && b.dernieres[1].type === 'Negative' && b.dernieres[1].texte === 'Pas la bonne taille', 'E2. les dernières évaluations (une retirée écartée)', JSON.stringify(b.dernieres));
    dit(!ECRITS.some((e) => JSON.stringify(e.data || {}).includes('client_')), 'E3. aucun pseudo d’évaluateur rangé en base');
  });

  await essai('L', async () => {
    remettre();
    const r = await route({ action: 'litiges' });
    const b = r.corps || {};
    dit(Array.isArray(b.paiement) && b.paiement[0].etat === 'ACTION_NEEDED' && b.paiement[0].montant.v === 98, 'L1. litige de paiement : à traiter, 98,00 €', JSON.stringify(b.paiement));
    dit(Array.isArray(b.reclamations) && b.reclamations[0].etat === 'WAITING_SELLER_RESPONSE' && b.reclamations[0].repondreAvant, 'L2. réclamation « pas reçu » : en attente de TA réponse, avec sa date limite', JSON.stringify(b.reclamations));
    dit(Array.isArray(b.cas) && b.cas.length === 0, 'L3. aucun cas ouvert (lu, vide)');
    dit(!JSON.stringify(b).includes('acheteur_secret'), 'L4. aucun pseudo d’acheteur rendu');
    remettre(); EB.dispute = 'scope';
    const r2 = await route({ action: 'litiges' });
    dit(r2.corps.paiement && r2.corps.paiement.ko && r2.corps.paiement.ko.raison === 'scope' && Array.isArray(r2.corps.reclamations), 'L5. un droit manquant sur les litiges de paiement n’efface pas les réclamations', JSON.stringify(r2.corps));
  });

  await essai('D', async () => {
    remettre(); avecCle(true); EB.analytics = 'panne';
    const r = await route({ action: 'tableau' });
    const b = r.corps || {};
    dit(b.ok === true && b.argent && b.argent.solde && b.argent.solde.dispo.v === 120 && b.trafic && b.trafic.ko && b.evaluations && b.evaluations.score === 212 && b.litiges && Array.isArray(b.litiges.paiement), 'D1. `tableau` : tout en un aller-retour ; le trafic en panne porte `ko`, le reste est là', JSON.stringify({ a: !!b.argent, t: b.trafic, e: !!b.evaluations }));
    dit(b.offres && b.offres.n === 2 && b.messages && b.messages.n === 3, 'D3. offres en attente (2, lues chez eBay) et messages sans réponse (3, le résumé rangé)', JSON.stringify([b.offres, b.messages]));
    delete ROWS.ebay_messages;
    const r2 = await route({ action: 'tableau' });
    dit(r2.corps.messages && r2.corps.messages.ko && !('n' in r2.corps.messages), 'D4. messages jamais lus ⇒ « pas lu », jamais 0', JSON.stringify(r2.corps.messages));
    dit(b.sante && b.sante.niveau && b.sante.niveau.ko, 'D2. la santé en panne est dite (ko), jamais « bon niveau »', JSON.stringify(b.sante && b.sante.niveau));
  });

  await essai('W', async () => {
    remettre(); avecCle(true);
    for (const a of ['argent', 'trafic', 'sante', 'evaluationsrecues', 'litiges', 'tableau']) await route({ action: a });
    const ecr = APPELS.filter((a) => a.hote !== 'trading' && a.methode !== 'GET');
    const tr = APPELS.filter((a) => a.hote === 'trading').map((a) => a.nom);
    dit(ecr.length === 0 && tr.every((n) => n === 'GetFeedback' || n === 'GetBestOffers'), 'W1. lecture seule : aucune requête autre que GET chez eBay, Trading : GetFeedback et GetBestOffers (lectures) seuls', JSON.stringify([ecr.map((a) => a.chemin), [...new Set(tr)]]));
    dit(!ECRITS.some((e) => e.id && !/^ebay_(versements|finances|tokens|acces|comptes)/.test(e.id)), 'W2. en base : seulement `ebay_versements` (et le jeton)', JSON.stringify(ECRITS.map((e) => e.id)));
  });

  await essai('R', async () => {
    remettre(); avecCle(true);
    const r = await route({ action: 'rembourserretour', confirme: true, returnId: '5200000001', montantVu: '98.00', devise: 'EUR' });
    const ap = APPELS.find((a) => /\/issue_refund$/.test(a.chemin || ''));
    dit(r.corps && r.corps.ok === true && ap && ap.signe && ap.valide, 'R1. le remboursement d’un retour part SIGNÉ (empreinte du corps exacte) et passe', JSON.stringify([r.corps, ap && [ap.signe, ap.valide]]));
  });
  avecCle(false);
  return { ko, out };
}

const MUTATIONS = {
  'finances-sur-api': ['api/_lib/ebay-tableau.js', "apizOrigin = 'https://apiz.ebay.com'", "apizOrigin = 'https://api.ebay.com'"],
  'finances-non-signees': ['api/_lib/ebay-tableau.js', "Object.assign(h, signer ? entetesSignes(", "Object.assign(h, false ? entetesSignes("],
  'chemin-avec-requete': ['api/_lib/ebay-signature.js', "'@path': u.pathname,", "'@path': u.pathname + u.search,"],
  'signature-prise-pour-droit': ['api/_lib/ebay-tableau.js', '    if (signer && refusSignature(r)) return', '    if (false) return'],
  'lance-vaut-verse': ['api/_lib/ebay-tableau.js', "c.versement = p && p.statut === 'SUCCEEDED' ? p.date : null;", 'c.versement = p ? p.date : null;'],
  'rembourse-garde-date': ['api/_lib/ebay-tableau.js', '    else if (c.rembourse) delete dates[id];', ''],
  'devises-melangees': ['api/_lib/ebay-tableau.js', "    if (t.type !== 'NON_SALE_CHARGE' || !t.montant) continue;\n    const d = parDevise[t.montant.c]", "    if (t.type !== 'NON_SALE_CHARGE' || !t.montant) continue;\n    const d = parDevise.EUR || (parDevise.EUR = { total: 0, n: 0, types: {} }); if (0) parDevise[t.montant.c]"],
  'metrique-par-position': ['api/_lib/ebay-tableau.js', "const lu = (k) => { const i = cles.indexOf(k);", "const lu = (k) => { const i = METRIQUES_TRAFIC.indexOf(k);"],
  'non-applicable-zero': ['api/_lib/ebay-tableau.js', "return x && x.applicable !== false ? nombre(x) : null;", 'return x ? nombre(x) : null;'],
  'absente-vaut-zero': ['api/_lib/ebay-tableau.js', '    if (!t) { sansChiffres.push(id); continue; }', '    if (!t) { out.push({ itemId: id, affichages: 0 }); continue; }'],
  'neuve-invisible': ['api/_lib/ebay-tableau.js', '    if (Number.isFinite(debut) && maintenant - debut < 7 * 86400000) continue;', ''],
  'pas-su-vide': ['api/_lib/ebay-tableau.js', "      if (!r.ok) { const x = raison(r, 'le détail de tes ventes eBay', true);", "      if (!r.ok) { out.transactions = []; break; const x = raison(r, 'le détail de tes ventes eBay', true);"],
  'acheteur-range': ['api/_lib/ebay-tableau.js', "    detail[id] = { net: c.net,", "    detail[id] = { acheteur: 'acheteur_secret', net: c.net,"],
  'retiree-gardee': ['api/_lib/ebay-tableau.js', ".filter((f) => f.id && /^(Positive|Neutral|Negative)$/.test(f.type))", '.filter((f) => f.id)'],
  'messages-zero': ['api/_lib/ebay-tableau.js', ": { ko: { raison: 'pas-lu', erreur: 'Messages pas encore lus.' } },", ": { n: 0 },"],
  'remboursement-non-signe': ['api/_lib/ebay-apres-vente.js', '/issue_refund`,a.token,{method:\'POST\',iaf:true,signer:true,', '/issue_refund`,a.token,{method:\'POST\',iaf:true,'],
};
function copie(mut) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ebay-tableau-'));
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
  let b = ''; try { b = execFileSync('git', ['merge-base', 'HEAD', 'origin/claude/project-review-nsk5su'], { cwd: RACINE }).toString().trim(); } catch (_) { return ''; }
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ebay-tableau-avant-'));
  execFileSync('tar', ['-x', '-C', d], { input: execFileSync('git', ['archive', b, 'api', 'src'], { cwd: RACINE, maxBuffer: 1 << 28 }) });
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(d, 'node_modules')); } catch (_) {}
  return d;
}

(async () => {
  if (process.argv.includes('--avant')) {
    const d = arbreAvant();
    const { ko, out } = await verifier(d);
    out.forEach((l) => console.log(l));
    console.log(`\nArbre de départ : ${ko} rouge(s) (attendu : beaucoup)`);
    process.exit(ko ? 0 : 1);
  }
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
