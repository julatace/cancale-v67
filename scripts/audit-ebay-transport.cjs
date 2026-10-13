const assert=require('node:assert/strict');
(async()=>{
 const {faitsTransport,politiqueTransport}=await import('../api/_lib/ebay-transport.js');
 const {commandeMinimale}=await import('../api/_lib/ebay-commandes.js');
 const o={orderId:'01-0001',fulfillmentStartInstructions:[{fulfillmentInstructionsType:'SHIP_TO',shippingStep:{shipToReferenceId:'SECRET_REFERENCE',shipTo:{fullName:'SECRET_NOM',contactAddress:{addressLine1:'SECRET_RUE',countryCode:'FR'},email:'SECRET_EMAIL'}}}],lineItems:[{sku:'VRM-1'}]};
 const f=faitsTransport(o);assert.equal(f.pays,'FR');assert.equal(f.referenceProgramme,true);assert.equal(f.pickup,false);assert(f.champsShipTo.includes('contactAddress.addressLine1'));assert(!JSON.stringify(commandeMinimale(o)).includes('SECRET_'));
 assert.equal(faitsTransport({...o,fulfillmentStartInstructions:[{pickupStep:{}}]}).pickup,true);
 assert.equal(faitsTransport({...o,fulfillmentStartInstructions:undefined}).pays,null);
 assert.equal(faitsTransport({...o,lineItems:[{program:{authenticityVerification:{}}}]}).authentification,true);
 let appels=[];
 const lire=async(t,n,xml,options)=>{appels.push({t,n,xml,options});return {ok:true,xml:'<GetOrdersResponse><Ack>Success</Ack><OrderArray><Order><OrderID>01-0001</OrderID><ShippingDetails><ShippingLabelPolicy>EBAY_ONLY</ShippingLabelPolicy></ShippingDetails><ShippingServiceSelected><ShippingService>FR_MondialRelay</ShippingService></ShippingServiceSelected></Order></OrderArray></GetOrdersResponse>'};};
 let r=await politiqueTransport(o,'FAUX_JETON',lire);assert.equal(r.politiqueEtiquette,'EBAY_ONLY');assert.equal(r.servicePaye,'FR_MondialRelay');assert.equal(appels[0].options.compatibilite,1455);assert.equal(appels[0].n,'GetOrders');assert(appels[0].xml.includes('<OrderID>01-0001</OrderID>'));
 r=await politiqueTransport(o,'x',async()=>({ok:true,xml:'<OrderArray><Order><OrderID>01-0001</OrderID></Order></OrderArray>'}));assert.equal(r.politiqueEtiquette,'aucune');
 for(const xml of ['<OrderArray/>','<Order><OrderID>99-9999</OrderID></Order>','<Order><OrderID>01-0001</OrderID><ShippingLabelPolicy>FUTURE_POLICY</ShippingLabelPolicy></Order>']) {r=await politiqueTransport(o,'x',async()=>({ok:true,xml}));assert.equal(r.politiqueEtiquette,null);}
 r=await politiqueTransport(o,'x',async()=>({ok:false}));assert.equal(r.politiqueEtiquette,null);
 const {metadataTransport}=await import('../api/_lib/ebay-metadata-transport.js');
 process.env.SUPABASE_SERVICE_KEY='FAUX_SERVICE';let valeur=null,ecrits=0,lectures=0,ko=false;
 global.fetch=async(url,opt={})=>{if(opt.method==='POST'){ecrits++;valeur=JSON.parse(opt.body).valeur;return {ok:true};}return {ok:true,json:async()=>valeur?[{valeur}]:[]};};
 const metadata=async url=>{lectures++;if(ko)return {ok:false};return {ok:true,data:url.endsWith('get_shipping_carriers')?{shippingCarriers:[{shippingCarrier:'LaPoste',description:'La Poste'}]}:{shippingServices:[{shippingService:'FR_Colissimo',shippingCarrier:'LaPoste',description:'Colissimo',minShippingTime:2,maxShippingTime:4}]}};};
 let m=await metadataTransport(metadata,async()=>({ok:true,token:'FAUX_APP_TOKEN'}));assert(m.ok);assert.equal(m.transporteurs[0].code,'LaPoste');assert.equal(lectures,2);assert.equal(ecrits,1);
 m=await metadataTransport(metadata,async()=>{throw Error('pas de jeton si cache frais');});assert(m.ok && m.cache);assert.equal(lectures,2);
 const ancien=JSON.parse(valeur);ancien.lu-=31*86400000;valeur=JSON.stringify(ancien);const avant=valeur;ko=true;
 m=await metadataTransport(metadata,async()=>({ok:true,token:'x'}));assert(!m.ok);assert.equal(ecrits,1);assert.equal(valeur,avant);
 console.log('✅ Transport eBay : 1455 dédié, politique à trois états, identité de commande exigée, noms des champs sans adresse, Metadata mensuelle sans écrasement sur panne.');
})().catch(e=>{console.error(e);process.exitCode=1;});
