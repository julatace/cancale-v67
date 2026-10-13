// Contrats : Trading GetOrders / ShippingDetailsType (1455), Sell Metadata 1.12.1.
// Les valeurs d'adresse ne sont jamais conservées : clés présentes et pays seuls.
const bool = v => typeof v === 'boolean' ? v : null;
const propre = v => typeof v === 'string' && v.length <= 120 ? v : null;
export function transportMinimal(t) {
  if(!t || typeof t!=='object') return null;
  return {
    politiqueEtiquette: ['EBAY_ONLY','aucune'].includes(t.politiqueEtiquette) ? t.politiqueEtiquette : null,
    politiqueLueLe: Number.isFinite(t.politiqueLueLe) ? t.politiqueLueLe : null,
    servicePaye: propre(t.servicePaye), pickup:bool(t.pickup), authentification:bool(t.authentification),
    pays: typeof t.pays==='string' && /^[A-Z]{2}$/.test(t.pays) ? t.pays : null,
    referenceProgramme:bool(t.referenceProgramme), instructionsType:propre(t.instructionsType),
    champsShipTo: Array.isArray(t.champsShipTo) ? t.champsShipTo.filter(k=>typeof k==='string' && /^[a-zA-Z][a-zA-Z0-9_.]{0,100}$/.test(k)).slice(0,50) : [],
  };
}
export function faitsTransport(o) {
  if(o.transport) return transportMinimal(o.transport);
  const instructions=Array.isArray(o.fulfillmentStartInstructions) ? o.fulfillmentStartInstructions : null;
  const i=instructions && instructions.length===1 ? instructions[0] : null;
  const shipTo=i && i.shippingStep && i.shippingStep.shipTo;
  const champs=shipTo && typeof shipTo==='object' ? Object.keys(shipTo) : [];
  if(shipTo && shipTo.contactAddress && typeof shipTo.contactAddress==='object') champs.push(...Object.keys(shipTo.contactAddress).map(k=>'contactAddress.'+k));
  return transportMinimal({politiqueEtiquette:null,politiqueLueLe:null,servicePaye:null,
    pickup:instructions ? instructions.some(x=>x && Object.hasOwn(x,'pickupStep')) : null,
    authentification:!!(o.program && o.program.authenticityVerification) || (Array.isArray(o.lineItems) && o.lineItems.some(l=>!!(l.program && l.program.authenticityVerification))),
    pays:shipTo && shipTo.contactAddress && shipTo.contactAddress.countryCode,
    referenceProgramme:i ? !!(i.shippingStep && (i.shippingStep.shipToReferenceId || shipTo && shipTo.shipToReferenceId)) : null,
    instructionsType:i && i.fulfillmentInstructionsType, champsShipTo:champs.sort(),
  });
}
const decode=s=>String(s).replace(/&lt;|&gt;|&quot;|&apos;|&amp;/g,m=>({'&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&amp;':'&'})[m]);
const balise=(s,n)=>decode((new RegExp('<'+n+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+n+'>').exec(s)||[])[1] || '').trim();
export async function politiqueTransport(order,token,appeler) {
  const id=order.legacyOrderId || order.orderId;
  if(typeof id!=='string' || !/^[0-9-]{1,64}$/.test(id)) return {politiqueEtiquette:null,politiqueLueLe:null,servicePaye:null};
  const r=await appeler(token,'GetOrders',`<OrderIDArray><OrderID>${id}</OrderID></OrderIDArray><OrderRole>Seller</OrderRole><DetailLevel>ReturnAll</DetailLevel>`,{compatibilite:1455});
  if(!r || !r.ok) return {politiqueEtiquette:null,politiqueLueLe:null,servicePaye:null};
  const ordres=[...String(r.xml || '').matchAll(/<Order(?:\s[^>]*)?>([\s\S]*?)<\/Order>/g)].map(m=>m[1]);
  const cible=ordres.find(x=>balise(x,'OrderID')===id);
  if(!cible) return {politiqueEtiquette:null,politiqueLueLe:null,servicePaye:null};
  // L'ordre et ses lignes peuvent porter des politiques ; la plus restrictive gagne.
  const politiques=[...cible.matchAll(/<ShippingLabelPolicy(?:\s[^>]*)?>([\s\S]*?)<\/ShippingLabelPolicy>/g)].map(m=>decode(m[1]).trim());
  const politique=politiques.includes('EBAY_ONLY') ? 'EBAY_ONLY' : politiques.length===0 ? 'aucune' : null;
  const service=balise((/<ShippingServiceSelected(?:\s[^>]*)?>([\s\S]*?)<\/ShippingServiceSelected>/.exec(cible)||[])[1] || '','ShippingService');
  return {politiqueEtiquette:politique,politiqueLueLe:politique===null?null:Date.now(),servicePaye:service || null};
}
