// Vraies fonctions, réseau simulé : pagination, conservation et minimisation.
const assert = require('node:assert/strict');
(async () => {
  const { commandeMinimale, fusionnerCommandes, lireCommandesEbay } = await import('../api/_lib/ebay-commandes.js');
  const maintenant = Date.parse('2026-10-12T12:00:00Z');
  const commande = (id, mod = '2026-10-12T11:00:00Z') => ({ orderId:id, creationDate:'2026-10-10T12:00:00Z', lastModifiedDate:mod, orderPaymentStatus:'PAID', buyer:{ username:'acheteur', taxIdentifier:'SECRET_TAX' }, fulfillmentStartInstructions:[{ shippingStep:{ shipTo:{ fullName:'SECRET_NOM', contactAddress:{ addressLine1:'SECRET_RUE' }, primaryPhone:{ phoneNumber:'SECRET_PHONE' }, email:'SECRET_MAIL' } } }], lineItems:[{ lineItemId:'l1', sku:'VRM-1', title:'Basket', deliveryAddress:'SECRET_LIGNE', fulfillmentInstructions:{ shipByDate:'2026-10-14T12:00:00Z', address:'SECRET_NESTED' } }], pricingSummary:{ total:{ value:'100.00',currency:'EUR' }, buyerSecret:'SECRET_PRIX' } });
  const ancien = commande('ancien'), nouveau = commande('nouveau');
  assert(!JSON.stringify(commandeMinimale(nouveau)).includes('SECRET_'));
  assert.equal(commandeMinimale(nouveau).lineItems[0].sku, 'VRM-1');
  assert.equal(commandeMinimale(nouveau).lineItems[0].fulfillmentInstructions.shipByDate, '2026-10-14T12:00:00Z');
  assert.equal(fusionnerCommandes([ancien], [nouveau]).length, 2);
  const maj = {...ancien, orderPaymentStatus:'FULLY_REFUNDED', lastModifiedDate:'2026-10-12T12:00:00Z'};
  assert.equal(fusionnerCommandes([ancien],[maj])[0].orderPaymentStatus,'FULLY_REFUNDED');
  assert.equal(fusionnerCommandes([maj],[ancien])[0].orderPaymentStatus,'FULLY_REFUNDED');
  let urls=[];
  const lire = async url => { urls.push(url); return {ok:true,status:200,data:urls.length===1 ? {orders:[ancien],next:'https://api.ebay.com/sell/fulfillment/v1/order?offset=50'} : {orders:[nouveau]}}; };
  const lu=await lireCommandesEbay(lire,'FAUX_JETON',maintenant-3600000,maintenant);
  assert(lu.ok); assert.equal(lu.data.orders.length,2); assert.equal(urls.length,2);
  assert(decodeURIComponent(urls[0]).includes('lastmodifieddate:[2026-10-12T10:58:00.000Z..2026-10-12T12:00:00.000Z]'));
  assert(!JSON.stringify(lu).includes('SECRET_'));
  const manque=await lireCommandesEbay(async()=>({ok:true,status:200,data:{orders:[ancien],total:51}}),'x',0,maintenant);
  assert(!manque.ok && !manque.data);
  let appels=0;
  const rate=await lireCommandesEbay(async()=> (++appels===1 ? {ok:true,status:200,data:{orders:[ancien],next:'https://api.ebay.com/sell/fulfillment/v1/order?offset=50'}} : {ok:false,status:503}),'x',0,maintenant);
  assert(!rate.ok && !rate.data); // aucune demi-liste à enregistrer
  for (const next of ['https://pirate.test/sell/fulfillment/v1/order','https://api.ebay.com/identity/v1/oauth2/token','https://user:pass@api.ebay.com/sell/fulfillment/v1/order']) {
    appels=0;
    const r=await lireCommandesEbay(async()=> { appels++;return {ok:true,status:200,data:{orders:[],next}}; },'SECRET_TOKEN',0,maintenant);
    assert(!r.ok); assert.equal(appels,1);
  }
  appels=0;
  const boucle=await lireCommandesEbay(async url=> {appels++;return {ok:true,status:200,data:{orders:[],next:url}};},'x',0,maintenant);
  assert(!boucle.ok); assert.equal(appels,1);
  appels=0;
  const plafond=await lireCommandesEbay(async()=> {appels++;return {ok:true,status:200,data:{orders:[],next:'https://api.ebay.com/sell/fulfillment/v1/order?offset='+appels*50}};},'x',0,maintenant);
  assert(!plafond.ok);assert.equal(appels,20);
  console.log('✅ Commandes eBay : pages complètes, historique conservé, annulations actualisées, aucune adresse, aucun jeton vers un autre hôte.');
})().catch(e => {console.error(e);process.exitCode=1;});
