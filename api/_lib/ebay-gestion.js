import {etatCommandeEbay} from './ebay-etat-commande.js';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',textNodeName:'#text',parseTagValue:false,trimValues:false,removeNSPrefix:true});
const liste=v=>v==null?[]:Array.isArray(v)?v:[v];
const texte=v=>v==null?'':typeof v==='object'?String(v['#text'] ?? ''):String(v);
const xml=v=>String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const id=v=>/^\d{1,24}$/.test(String(v || ''));
const idCommande=v=>/^[A-Za-z0-9-]{1,64}$/.test(String(v || ''));
const argent=v=>/^\d{1,9}(?:[.,]\d{1,2})?$/.test(String(v ?? '').trim()) && Number(String(v).replace(',','.'))>0;
const echec=(error,status=400,reason)=>({status,body:{ok:false,error,...(reason?{reason}: {})}});
const succes=body=>({status:200,body:{ok:true,...body}});
export function lireXmlEbay(source,appel) {
  if(typeof source!=='string' || source.length>4*1024*1024 || /<!DOCTYPE|<!ENTITY/i.test(source) || XMLValidator.validate(source)!==true)return null;
  try{return parser.parse(source)[appel+'Response'] || null;}catch(_){return null;}
}
export function messagesEbay(root) {
  return liste(root?.MemberMessage?.MemberMessageExchange).map(e=>{
    const q=e.Question || {},it=e.Item || {};
    return {id:texte(q.MessageID),itemId:texte(it.ItemID),titre:texte(it.Title),sender:texte(q.SenderID),subject:texte(q.Subject),body:texte(q.Body),responses:liste(e.Response).map(r=>typeof r==='object'?texte(r.Body ?? r.Message ?? r):texte(r)).filter(Boolean),status:texte(e.MessageStatus),date:texte(e.CreationDate)};
  }).filter(m=>m.id);
}
export function offresEbay(root) {
  const groupes=[...liste(root?.ItemBestOffers),...liste(root?.ItemBestOffersArray?.ItemBestOffers)];
  return groupes.flatMap(g=>liste(g.BestOffers?.BestOffer).map(o=>({id:texte(o.BestOfferID),itemId:texte(g.Item?.ItemID),titre:texte(g.Item?.Title),buyer:texte(o.Buyer?.UserID),price:texte(o.Price),currency:o.Price?.['@_currencyID'] || null,quantity:Number(texte(o.Quantity)),status:texte(o.Status),expiresAt:texte(o.ExpirationTime),message:texte(o.BuyerMessage)}))).filter(o=>o.id && o.itemId);
}
export function lignesRestantAExpedier(order,fulfillments) {
  if(!Array.isArray(order?.lineItems) || !Array.isArray(fulfillments))return null;
  const deja=new Map();
  for(const f of fulfillments)for(const l of (f.lineItems || [])){
    if(!id(l.lineItemId) || !Number.isInteger(l.quantity) || l.quantity<1)return null;
    deja.set(String(l.lineItemId),(deja.get(String(l.lineItemId)) || 0)+l.quantity);
  }
  const rest=[];
  for(const l of order.lineItems){
    if(!id(l.lineItemId) || !Number.isInteger(l.quantity) || l.quantity<1)return null;
    const quantity=l.quantity-(deja.get(String(l.lineItemId)) || 0);
    if(quantity<0)return null;
    if(quantity>0)rest.push({lineItemId:String(l.lineItemId),quantity});
  }
  return rest;
}

// Toutes les fonctions agissent sur le jeton eBay du vendeur prouvé par la route.
// Les intentions engageantes exigent confirme AVANT d'aller chercher ce jeton.
export function creerGestionEbay({accessToken,ebayJson,tradingCall,apiOrigin,fetcher=(...a)=>fetch(...a)}) {
  const jeton=async owner=>{const r=await accessToken(owner);return r.ok && r.token?r:echec(r.error || 'Compte eBay indisponible.',r.status || 502,r.reason);};
  const lire=async(call,inner,token)=>{
    const r=await tradingCall(token,call,inner);
    if(!r.ok)return echec(r.err || 'eBay n’a pas pu lire ces données.',r.status>=400?r.status:502);
    const root=lireXmlEbay(r.xml,call);return root && ['Success','Warning'].includes(texte(root.Ack).trim())?{root}:echec('Réponse eBay illisible.',502);
  };
  const ecrire=async(call,inner,token)=>{
    const r=await tradingCall(token,call,inner);
    if(!r.ack)return echec('État incertain : actualise les données avant de recommencer.',504,'incertain');
    const root=lireXmlEbay(r.xml,call);
    if(!root)return echec('État incertain : actualise les données avant de recommencer.',504,'incertain');
    if(!r.ok || !['Success','Warning'].includes(texte(root.Ack).trim()) || r.erreurs?.some(e=>e.severite==='Error'))return echec(r.err || 'eBay a refusé cette action.',r.status>=400?r.status:422);
    return succes({avertissements:r.avertissements || []});
  };
  const ordre=async(orderId,token)=>{
    const r=await ebayJson(`${apiOrigin}/sell/fulfillment/v1/order/${encodeURIComponent(orderId)}`,token);
    return r.ok && r.data?.orderId===orderId?{order:r.data}:echec('Impossible de lire cette commande eBay.',r.status>=400?r.status:502);
  };
  async function commande(b,owner){
    if(!idCommande(b.orderId))return echec('Commande invalide.');const a=await jeton(owner);if(!a.token)return a;
    const o=await ordre(b.orderId,a.token);if(!o.order)return o;
    const f=await ebayJson(`${apiOrigin}/sell/fulfillment/v1/order/${encodeURIComponent(b.orderId)}/shipping_fulfillment`,a.token);
    return succes({order:o.order,fulfillments:f.ok && Array.isArray(f.data?.fulfillments)?f.data.fulfillments:null});
  }
  async function transporteurs(b,owner){
    const a=await jeton(owner);if(!a.token)return a;
    const r=await lire('GeteBayDetails','<DetailName>ShippingCarrierDetails</DetailName>',a.token);if(!r.root)return r;
    return succes({carriers:liste(r.root.ShippingCarrierDetails).map(c=>({code:texte(c.ShippingCarrier),label:texte(c.Description) || texte(c.ShippingCarrier)})).filter(c=>c.code)});
  }
  async function expedier(b,owner){
    if(b.confirme!==true)return echec('Confirme l’expédition.',400,'confirmation');
    const tracking=String(b.trackingNumber || '').trim(),carrier=String(b.shippingCarrierCode || '').trim();
    if(!idCommande(b.orderId) || !/^[A-Za-z0-9][A-Za-z0-9 -]{3,99}$/.test(tracking) || !/^[A-Za-z0-9_-]{2,50}$/.test(carrier))return echec('Indique la commande, le transporteur et le numéro de suivi.');
    const a=await jeton(owner);if(!a.token)return a;const o=await ordre(b.orderId,a.token);if(!o.order)return o;
    if(o.order.orderPaymentStatus!=='PAID' || (o.order.cancelStatus?.cancelState && !['NONE_REQUESTED','CANCEL_REJECTED'].includes(o.order.cancelStatus.cancelState)))return echec('Le paiement de cette commande n’est pas confirmé, ou elle est annulée.',409);
    const f=await ebayJson(`${apiOrigin}/sell/fulfillment/v1/order/${encodeURIComponent(b.orderId)}/shipping_fulfillment`,a.token);
    if(!f.ok || !Array.isArray(f.data?.fulfillments))return echec('Le suivi existant n’a pas pu être vérifié. Rien n’a été envoyé.',502);
    if(f.data.fulfillments.some(x=>x.shipmentTrackingNumber===tracking && String(x.shippingCarrierCode).toLowerCase()===carrier.toLowerCase()))return succes({deja:true});
    if(!etatCommandeEbay(o.order).peutExpedier)return echec('L’état d’expédition de cette commande doit être vérifié. Actualise son suivi.',409);
    const lineItems=lignesRestantAExpedier(o.order,f.data.fulfillments);
    if(!lineItems)return echec('Les quantités à expédier ne sont pas lisibles.',502);
    if(!lineItems.length)return echec('Toutes les pièces ont déjà une expédition.',409);
    try{
      const r=await fetcher(`${apiOrigin}/sell/fulfillment/v1/order/${encodeURIComponent(b.orderId)}/shipping_fulfillment`,{method:'POST',headers:{Authorization:`Bearer ${a.token}`,'Content-Type':'application/json'},body:JSON.stringify({lineItems,shippingCarrierCode:carrier,trackingNumber:tracking,shippedDate:new Date().toISOString()})});
      if(r.status!==201){if(r.status>=500)return echec('État incertain : actualise la commande avant de recommencer.',504,'incertain');return echec('eBay a refusé le suivi. Vérifie le transporteur et le numéro.',r.status>=400?r.status:502);}
      return succes({fulfillmentId:(r.headers.get('location') || '').split('/').pop() || null});
    }catch(_){return echec('État incertain : actualise la commande avant de recommencer.',504,'incertain');}
  }
  async function contacterAcheteur(b,owner){
    if(b.confirme!==true)return echec('Confirme le destinataire et le message.',400,'confirmation');
    const body=String(b.body || '').trim(),subject=String(b.subject || '').trim();
    if(!idCommande(b.orderId) || !body || body.length>2000 || !subject || subject.length>200)return echec('Indique un objet et un message (2 000 caractères maximum).');
    const a=await jeton(owner);if(!a.token)return a;const o=await ordre(b.orderId,a.token);if(!o.order)return o;
    const recipient=o.order.buyer?.username,item=o.order.lineItems?.[0]?.legacyItemId;
    if(!recipient || !id(item))return echec('eBay n’a pas fourni l’identité permettant de contacter cet acheteur.',409);
    return ecrire('AddMemberMessageAAQToPartner',`<ItemID>${item}</ItemID><MemberMessage><RecipientID>${xml(recipient)}</RecipientID><Subject>${xml(subject)}</Subject><Body>${xml(body)}</Body><QuestionType>General</QuestionType><EmailCopyToSender>true</EmailCopyToSender></MemberMessage>`,a.token);
  }
  async function messages(b,owner){
    const page=b.page==null?1:Number(b.page);if(!Number.isInteger(page) || page<1 || page>1000)return echec('Page invalide.');
    const a=await jeton(owner);if(!a.token)return a;
    const fin=new Date(),debut=new Date(fin.getTime()-90*86400000);
    const r=await lire('GetMemberMessages',`<MailMessageType>All</MailMessageType><StartCreationTime>${debut.toISOString()}</StartCreationTime><EndCreationTime>${fin.toISOString()}</EndCreationTime><Pagination><EntriesPerPage>50</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination>`,a.token);if(!r.root)return r;
    const total=Number(texte(r.root.PaginationResult?.TotalNumberOfPages));
    return succes({messages:messagesEbay(r.root),page,totalPages:Number.isInteger(total)&&total>=0?total:null});
  }
  async function message(b,owner){
    if(!id(b.itemId) || !/^[A-Za-z0-9_-]{1,64}$/.test(String(b.messageId || '')))return echec('Message invalide.');
    const a=await jeton(owner);if(!a.token)return a;
    const r=await lire('GetMemberMessages',`<MailMessageType>All</MailMessageType><ItemID>${b.itemId}</ItemID><MemberMessageID>${b.messageId}</MemberMessageID>`,a.token);if(!r.root)return r;
    const m=messagesEbay(r.root).find(m=>m.id===String(b.messageId) && m.itemId===String(b.itemId));
    return m?succes({message:m}):echec('Ce message n’est plus disponible pour cette annonce.',404);
  }
  async function offre(b,owner){
    if(!id(b.itemId) || !id(b.offerId))return echec('Offre invalide.');
    const a=await jeton(owner);if(!a.token)return a;
    const r=await lire('GetBestOffers',`<BestOfferID>${b.offerId}</BestOfferID>`,a.token);if(!r.root)return r;
    const o=offresEbay(r.root).find(o=>o.id===String(b.offerId) && o.itemId===String(b.itemId));
    return o?succes({offre:o}):echec('Cette offre n’est plus disponible pour cette annonce.',404);
  }
  async function repondre(b,owner){
    if(b.confirme!==true)return echec('Confirme la réponse.',400,'confirmation');
    const body=String(b.body || '').trim();
    if(!id(b.itemId) || !/^[A-Za-z0-9_-]{1,64}$/.test(String(b.messageId || '')) || !body || body.length>2000)return echec('Message ou annonce invalide.');
    const a=await jeton(owner);if(!a.token)return a;
    const r=await lire('GetMemberMessages',`<MailMessageType>AskSellerQuestion</MailMessageType><ItemID>${b.itemId}</ItemID><MemberMessageID>${b.messageId}</MemberMessageID>`,a.token);if(!r.root)return r;
    const original=messagesEbay(r.root).find(m=>m.id===String(b.messageId) && m.itemId===String(b.itemId));
    if(!original)return echec('Ce message n’est plus disponible pour cette annonce.',409);
    return ecrire('AddMemberMessageRTQ',`<ItemID>${b.itemId}</ItemID><MemberMessage><ParentMessageID>${b.messageId}</ParentMessageID><Body>${xml(body)}</Body><DisplayToPublic>false</DisplayToPublic><EmailCopyToSender>true</EmailCopyToSender></MemberMessage>`,a.token);
  }
  async function offres(b,owner){
    const page=b.page==null?1:Number(b.page);if(!Number.isInteger(page) || page<1 || page>1000)return echec('Page invalide.');
    const a=await jeton(owner);if(!a.token)return a;
    const r=await lire('GetBestOffers',`<BestOfferStatus>Active</BestOfferStatus><Pagination><EntriesPerPage>50</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination>`,a.token);if(!r.root)return r;
    const total=Number(texte(r.root.PaginationResult?.TotalNumberOfPages));return succes({offres:offresEbay(r.root),page,totalPages:Number.isInteger(total)&&total>=0?total:null});
  }
  async function repondreOffre(b,owner){
    if(b.confirme!==true)return echec('Confirme la réponse à cette offre.',400,'confirmation');
    if(!id(b.itemId) || !id(b.offerId) || !['Accept','Decline','Counter'].includes(b.decision) || (b.decision==='Counter' && !argent(b.price)))return echec('Offre ou prix invalide.');
    const a=await jeton(owner);if(!a.token)return a;
    const r=await lire('GetBestOffers',`<BestOfferID>${b.offerId}</BestOfferID>`,a.token);if(!r.root)return r;
    const offer=offresEbay(r.root).find(o=>o.id===String(b.offerId) && o.itemId===String(b.itemId));
    if(!offer || !['Pending','Active'].includes(offer.status) || (offer.expiresAt && (!Number.isFinite(Date.parse(offer.expiresAt)) || Date.parse(offer.expiresAt)<=Date.now())))return echec('Cette offre n’est plus en attente.',409);
    if((!argent(b.expectedPrice) || !argent(offer.price) || Math.round(Number(String(b.expectedPrice).replace(',','.'))*100)!==Math.round(Number(offer.price)*100)) || b.currency!==offer.currency || !/^[A-Z]{3}$/.test(offer.currency || '') || !Number.isInteger(offer.quantity) || offer.quantity<1)return echec('L’offre a changé ou ses montants ne sont pas lisibles. Actualise-la.',409);
    let inner=`<ItemID>${offer.itemId}</ItemID><BestOfferID>${offer.id}</BestOfferID><Action>${b.decision}</Action>`;
    if(b.decision==='Counter')inner+=`<CounterOfferPrice currencyID="${offer.currency}">${Number(String(b.price).replace(',','.')).toFixed(2)}</CounterOfferPrice><CounterOfferQuantity>${offer.quantity}</CounterOfferQuantity>`;
    return ecrire('RespondToBestOffer',inner,a.token);
  }
  async function modifierAnnonce(b,owner){
    if(b.confirme!==true)return echec('Confirme la modification de l’annonce.',400,'confirmation');
    const changes=['price','quantity','title','description'].filter(k=>b[k]!=null && b[k]!=='');
    if(!id(b.itemId) || !changes.length)return echec('Annonce invalide ou aucune modification.');
    if((changes.includes('price') && !argent(b.price)) || (changes.includes('quantity') && !/^\d{1,6}$/.test(String(b.quantity))) || (changes.includes('title') && (typeof b.title!=='string' || !b.title.trim() || b.title.length>80)) || (changes.includes('description') && (typeof b.description!=='string' || !b.description.trim() || b.description.length>100000)))return echec('Vérifie le prix, le stock et le titre (80 caractères maximum).');
    const a=await jeton(owner);if(!a.token)return a;
    const r=await lire('GetItem',`<ItemID>${b.itemId}</ItemID><DetailLevel>ReturnAll</DetailLevel>`,a.token);if(!r.root)return r;
    const item=r.root.Item;
    if(!item || texte(item.ItemID)!==String(b.itemId) || texte(item.ListingType)!=='FixedPriceItem' || item.Variations)return echec('Cette annonce nécessite une modification sur eBay (enchère ou variantes).',409);
    const currency=item.SellingStatus?.CurrentPrice?.['@_currencyID'] || item.StartPrice?.['@_currencyID'];
    if(changes.includes('price') && !/^[A-Z]{3}$/.test(currency || ''))return echec('La devise de cette annonce n’a pas pu être vérifiée.',502);
    const actualPrice=texte(item.SellingStatus?.CurrentPrice || item.StartPrice);
    if(changes.includes('price') && (!argent(b.expectedPrice) || Number(String(b.expectedPrice).replace(',','.'))!==Number(actualPrice)))return echec('Le prix a changé sur eBay. Actualise l’annonce avant de modifier.',409);
    const sold=texte(item.SellingStatus?.QuantitySold).trim()?Number(texte(item.SellingStatus?.QuantitySold)):NaN,total=texte(item.Quantity).trim()?Number(texte(item.Quantity)):NaN;
    if(changes.includes('quantity') && (!Number.isInteger(sold) || sold<0 || !Number.isInteger(total) || total<sold || !/^\d+$/.test(String(b.expectedQuantity ?? '')) || Number(b.expectedQuantity)!==total-sold))return echec('Le stock a changé ou ne peut pas être vérifié. Actualise l’annonce.',409);
    if(changes.includes('title') && b.expectedTitle!==texte(item.Title))return echec('Le titre a changé sur eBay. Actualise l’annonce.',409);
    let inner=`<Item><ItemID>${b.itemId}</ItemID>`;
    if(changes.includes('price'))inner+=`<StartPrice currencyID="${currency}">${Number(String(b.price).replace(',','.')).toFixed(2)}</StartPrice>`;
    if(changes.includes('quantity'))inner+=`<Quantity>${Number(b.quantity)+sold}</Quantity>`;
    if(changes.includes('title'))inner+=`<Title>${xml(b.title.trim())}</Title>`;
    if(changes.includes('description'))inner+=`<Description>${xml(b.description)}</Description>`;
    return ecrire('ReviseFixedPriceItem',inner+'</Item>',a.token);
  }
  async function terminerAnnonce(b,owner){
    if(b.confirme!==true)return echec('Confirme la fin de l’annonce.',400,'confirmation');
    if(!id(b.itemId))return echec('Annonce invalide.');const a=await jeton(owner);if(!a.token)return a;
    return ecrire('EndFixedPriceItem',`<ItemID>${b.itemId}</ItemID><EndingReason>NotAvailable</EndingReason>`,a.token);
  }
  return {commande,transporteurs,expedier,contacterAcheteur,messages,message,repondre,offres,offre,repondreOffre,modifierAnnonce,terminerAnnonce};
}
