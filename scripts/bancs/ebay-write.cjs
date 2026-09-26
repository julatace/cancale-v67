// BANC des ÉCRITURES eBay (publier / modifier), EXÉCUTÉ (§4.10) avec un faux
// eBay (Trading API) + faux Supabase. Vérifie que :
//   • publish → AddFixedPriceItem, renvoie l'itemId créé ;
//   • un refus eBay (Ack Failure) REMONTE en échec (jamais un faux succès) ;
//   • publish sans titre/catégorie/prix → 400 (on ne tente pas un appel vide) ;
//   • revise → ReviseInventoryStatus OK, et un refus remonte.
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
let tradingMode = 'ok', lastCall = '', lastBody = '';
global.fetch = async (url, opts = {}) => {
  const u = String(url); const h = opts.headers || {};
  if (u.includes('identity/v1/oauth2/token')) return new Response(JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_in: 7200 }), { status: 200 });
  if (u.includes('/rest/v1/app_data')) {
    if (opts.method === 'POST') return new Response('', { status: 201 });
    return new Response(JSON.stringify([{ refresh_token: 'RT' }]), { status: 200 });   // accessToken lit ça
  }
  if (u.includes('/ws/api.dll')) {
    lastCall = h['X-EBAY-API-CALL-NAME'] || ''; lastBody = String(opts.body || '');
    if (tradingMode === 'fail') return new Response('<?xml version="1.0"?><r xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Failure</Ack><Errors><ShortMessage>Missing required aspect</ShortMessage><LongMessage>L\'attribut Pointure EU est obligatoire.</LongMessage></Errors></r>', { status: 200 });
    if (/AddFixedPriceItem/.test(lastCall)) return new Response('<?xml version="1.0"?><r xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><ItemID>110555000111</ItemID></r>', { status: 200 });
    return new Response('<?xml version="1.0"?><r xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack></r>', { status: 200 });
  }
  return new Response('{}', { status: 200 });
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.end = () => r; return r; };
const item = { title: 'Nike Air Max 1 Aquatone Bleu T44', categoryId: '15709', price: '68', quantity: 1, conditionId: '3000', photos: ['https://x/1.jpg', 'https://x/2.jpg'], aspects: { Marque: 'Nike', 'Pointure EU': '44', Couleur: 'Bleu', 'Département': 'Homme', Style: 'Basket', Type: 'Basket' }, shippingCost: '5', description: 'Basket Nike' };

(async () => {
  process.env.EBAY_APP_ID = 'app'; process.env.EBAY_CERT_ID = 'cert'; process.env.EBAY_RUNAME = 'ru'; process.env.SUPABASE_SERVICE_KEY = 'svc';
  const mod = await import('file://' + path.join(RACINE, 'api', 'ebay.js'));
  const handler = mod.default;

  // 1. Publier OK
  tradingMode = 'ok';
  { const res = faireRes(); await handler({ method: 'POST', query: {}, body: { action: 'publish', item } }, res);
    dit(res.code === 200 && res.corps && res.corps.ok === true && res.corps.itemId === '110555000111', 'publish → AddFixedPriceItem, renvoie l\'itemId', `HTTP ${res.code} id=${res.corps && res.corps.itemId}`);
    dit(/AddFixedPriceItem/.test(lastCall), 'l\'appel est bien AddFixedPriceItem');
    dit(/<Name>Pointure EU<\/Name>/.test(lastBody) && /<Name>Marque<\/Name>/.test(lastBody), 'les attributs obligatoires sont envoyés dans ItemSpecifics');
    dit(/<PictureURL>/.test(lastBody), 'les photos sont envoyées'); }

  // 2. Refus eBay → remonte (jamais faux succès)
  tradingMode = 'fail';
  { const res = faireRes(); await handler({ method: 'POST', query: {}, body: { action: 'publish', item } }, res);
    dit(res.code >= 400 && res.corps && res.corps.ok === false && /Pointure EU|obligatoire/i.test(res.corps.error || ''), 'un refus eBay REMONTE avec son message', `HTTP ${res.code} : ${res.corps && res.corps.error}`); }

  // 3. Champs manquants → 400 (pas d'appel vide)
  tradingMode = 'ok';
  { const res = faireRes(); await handler({ method: 'POST', query: {}, body: { action: 'publish', item: { title: 'x' } } }, res);
    dit(res.code === 400 && res.corps && res.corps.ok === false, 'publish sans catégorie/prix → 400'); }

  // 4. Modifier prix/stock OK
  { const res = faireRes(); await handler({ method: 'POST', query: {}, body: { action: 'revise', itemId: '110555000111', price: '72', quantity: '1' } }, res);
    dit(res.code === 200 && res.corps && res.corps.ok === true, 'revise → ReviseInventoryStatus OK');
    dit(/ReviseInventoryStatus/.test(lastCall) && /<StartPrice>72\.00<\/StartPrice>/.test(lastBody), 'le nouveau prix est envoyé (72.00)'); }

  // 5. Refus de modification → remonte
  tradingMode = 'fail';
  { const res = faireRes(); await handler({ method: 'POST', query: {}, body: { action: 'revise', itemId: '1', price: '9' } }, res);
    dit(res.code >= 400 && res.corps && res.corps.ok === false, 'un refus de modification REMONTE'); }

  console.log(ko ? ('\n' + ko + ' controle(s) non conforme(s).') : '\nPublier et modifier passent par l\'API Trading, envoient les bons champs, et un refus eBay ne devient jamais un faux succès.');
  process.exit(ko ? 1 : 0);
})();
