// Banc « eBay après la vente » (17 octobre) : retours, annulations, promotion,
// achats. Faux eBay à la forme de la DOCUMENTATION (Post-Order v2, Marketing v1,
// Trading GetMyeBayBuying) — aucune requête réelle. Il juge ce qui PART chez
// eBay (méthode, chemin, en-têtes, corps) et ce que la route en dit.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {etatCommandeEbay} from '../../api/_lib/ebay-etat-commande.js';
const ici=path.dirname(fileURLToPath(import.meta.url));
let M;try{M=await import('../../api/_lib/ebay-apres-vente.js');}catch(_){M=null;}
let n=0,ko=0;const check=(v,m)=>{if(v){n++;console.log('✅ '+m);}else{ko++;console.log('❌ '+m);}};
if(!M){check(false,'le module ebay-apres-vente existe');console.log(`\n${n} verts, ${ko} rouges`);process.exit(1);}
const {creerApresVenteEbay,annulerCommandeRangee,tauxValide}=M;
const API='https://api.example.test';
const retourOuvert={returnId:'5000123',orderId:'12-11111-22222',buyerLoginName:'acheteur_a',state:'RETURN_REQUESTED',status:'RETURN_REQUESTED',creationInfo:{item:{itemId:'3001',itemTitle:'Paire A',returnQuantity:1},reason:'DOES_NOT_FIT',comments:{content:'Trop petit'},creationDate:{value:'2026-10-15T10:00:00.000Z'}},sellerTotalRefund:{estimatedRefundAmount:{value:'80.00',currency:'EUR'}}};
const annul={cancelId:'7000456',legacyOrderId:'12-33333-44444',buyerLoginName:'acheteur_b',requestorType:'BUYER',cancelState:'CANCEL_REQUESTED',cancelStatus:'CANCEL_REQUESTED',cancelReason:'BUYER_ASKED_CANCEL',cancelRequestDate:{value:'2026-10-16T09:00:00.000Z'},requestRefundAmount:{value:'55.00',currency:'EUR'}};
function banc({retour=retourOuvert,annulation=annul,campagnes=[{campaignId:'C1',campaignName:'VRM',campaignStatus:'RUNNING',marketplaceId:'EBAY_FR',fundingStrategy:{fundingModel:'COST_PER_SALE',bidPercentage:'5.0'}}],ads=[{adId:'A1',listingId:'3001',bidPercentage:'5.0',adStatus:'ACTIVE'}],ecriture=200,lecture=200,forme=true,coupure=false}={}){
  const appels=[],ecritures=[],marques=[];
  const fetcher=async(url,opts={})=>{
    const u=new URL(url),m=(opts.method || 'GET').toUpperCase();
    appels.push({m,p:u.pathname+u.search,h:opts.headers,body:opts.body?JSON.parse(opts.body):undefined});
    const rep=(status,data,headers={})=>new Response(data==null?'':JSON.stringify(data),{status,headers:{'content-type':'application/json',...headers}});
    if(m!=='GET'){ecritures.push({p:u.pathname,body:opts.body?JSON.parse(opts.body):undefined});if(coupure)throw new Error('coupure');
      if(u.pathname.endsWith('/ad_campaign'))return rep(ecriture===200?201:ecriture,null,{location:API+'/sell/marketing/v1/ad_campaign/C9'});
      if(/bulk_/.test(u.pathname))return rep(ecriture===200?200:ecriture,ecriture===200?{responses:[{listingId:'3002',statusCode:ecriture===200?201:400}]}:null);
      return rep(ecriture,ecriture===200?{}:null);}
    if(lecture!==200)return rep(lecture,null);
    if(u.pathname==='/post-order/v2/return/search')return rep(200,forme?{members:[retour],total:1}:{autre:1});
    if(u.pathname.startsWith('/post-order/v2/return/'))return rep(200,{summary:retour});
    if(u.pathname==='/post-order/v2/cancellation/search')return rep(200,forme?{cancellations:[annulation]}:{x:1});
    if(u.pathname.startsWith('/post-order/v2/cancellation/'))return rep(200,{cancelDetail:annulation});
    if(u.pathname==='/sell/marketing/v1/ad_campaign')return rep(200,{campaigns:campagnes});
    if(/\/ad_campaign\/[^/]+\/ad$/.test(u.pathname))return rep(200,{ads});
    return rep(404,null);
  };
  const won='<WonList><OrderTransactionArray><OrderTransaction><Transaction><Item><ItemID>4001</ItemID><Title>Achat A</Title><Seller><UserID>vendeur_x</UserID></Seller></Item><TransactionPrice currencyID="EUR">42.00</TransactionPrice><CreatedDate>2026-10-01T10:00:00.000Z</CreatedDate></Transaction></OrderTransaction></OrderTransactionArray></WonList>';
  const gestion=creerApresVenteEbay({apiOrigin:API,fetcher,accessToken:async ctx=>{appels.push({jeton:ctx});return {ok:true,token:'jeton-synthetique'};},
    tradingCall:async(t,call,inner)=>({ok:true,ack:'Success',status:200,xml:`<${call}Response><Ack>Success</Ack>${won}</${call}Response>`}),
    lireAnnonces:async()=>[{itemId:'3001',titre:'Paire A',prix:'90'},{itemId:'3002',titre:'Paire B',prix:'60'}],
    marquerCommandeAnnulee:async(orderId)=>{marques.push(orderId);return true;}});
  return {gestion,appels,ecritures,marques};
}
const ctx='vendeur-A';
// ── Lectures ────────────────────────────────────────────────────────────
let b=banc(),r=await b.gestion.retours({},ctx);
check(r.body.ok && r.body.retours.length===1 && r.body.retours[0].returnId==='5000123' && r.body.retours[0].remboursementPrevu?.value==='80.00','retours lus (identité, montant prévu)');
const lu=b.appels.find(a=>a.p&&a.p.startsWith('/post-order/v2/return/search'));
check(lu && /^IAF /.test(lu.h.Authorization) && lu.h['X-EBAY-C-MARKETPLACE-ID']==='EBAY_FR' && /role=SELLER/.test(lu.p),'Post-Order : en-tête IAF + marché EBAY_FR + rôle vendeur');
b=banc({lecture:403});r=await b.gestion.retours({},ctx);check(!r.body.ok && r.body.reason==='scope' && !Array.isArray(r.body.retours),'droit refusé ⇒ « reconnecte », jamais « aucun retour »');
b=banc({forme:false});r=await b.gestion.retours({},ctx);check(!r.body.ok && r.body.reason==='illisible','forme inattendue ⇒ illisible, jamais une liste vide');
b=banc({lecture:503});r=await b.gestion.annulations({},ctx);check(!r.body.ok && r.body.reason==='pas-su','annulations illisibles ⇒ pas su');
b=banc();r=await b.gestion.annulations({},ctx);check(r.body.ok && r.body.annulations[0].orderId==='12-33333-44444','annulations lues');
// ── Gestes : confirmation AVANT le jeton ─────────────────────────────────
for(const g of ['deciderRetour','rembourserRetour','deciderAnnulation','promouvoir','changerTaux','arreterPromotion']){b=banc();r=await b.gestion[g]({},ctx);check(r.status===400 && !b.appels.length,g+' exige la confirmation avant de lire le jeton');}
// ── Retour : décider ─────────────────────────────────────────────────────
b=banc();r=await b.gestion.deciderRetour({returnId:'5000123',decision:'DECLINE',confirme:true},ctx);check(r.status===400 && !b.ecritures.length,'refuser un retour exige un motif');
b=banc({retour:{...retourOuvert,state:'ITEM_SHIPPED'}});r=await b.gestion.deciderRetour({returnId:'5000123',decision:'ACCEPT',confirme:true},ctx);check(r.status===409 && !b.ecritures.length,'retour qui n’attend plus de décision : rien ne part');
b=banc();r=await b.gestion.deciderRetour({returnId:'5000123',decision:'ACCEPT',confirme:true},ctx);check(r.body.ok && b.ecritures.length===1 && b.ecritures[0].p==='/post-order/v2/return/5000123/decide' && b.ecritures[0].body.decision==='ACCEPT','accepter un retour : UNE décision envoyée');
b=banc({ecriture:500});r=await b.gestion.deciderRetour({returnId:'5000123',decision:'ACCEPT',confirme:true},ctx);check(r.body.reason==='incertain','5xx après l’envoi ⇒ incertain, jamais « refusé »');
b=banc({coupure:true});r=await b.gestion.deciderRetour({returnId:'5000123',decision:'ACCEPT',confirme:true},ctx);check(r.body.reason==='incertain' && b.ecritures.length===1,'coupure ⇒ incertain, aucun renvoi');
// ── Retour : rembourser ──────────────────────────────────────────────────
b=banc();r=await b.gestion.rembourserRetour({returnId:'5000123',montantVu:'70',devise:'EUR',confirme:true},ctx);check(r.status===409 && !b.ecritures.length,'montant vu ≠ montant eBay ⇒ rien ne part');
b=banc();r=await b.gestion.rembourserRetour({returnId:'5000123',montantVu:'80',devise:'USD',confirme:true},ctx);check(r.status===409 && !b.ecritures.length,'autre devise ⇒ rien ne part');
b=banc({retour:{...retourOuvert,sellerTotalRefund:{...retourOuvert.sellerTotalRefund,actualRefundAmount:{value:'80.00',currency:'EUR'}}}});r=await b.gestion.rembourserRetour({returnId:'5000123',montantVu:'80',devise:'EUR',confirme:true},ctx);check(r.body.ok && r.body.deja && !b.ecritures.length,'déjà remboursé ⇒ rien ne repart');
b=banc();r=await b.gestion.rembourserRetour({returnId:'5000123',montantVu:'80,00',devise:'EUR',montant:'999',confirme:true},ctx);
check(r.body.ok && b.ecritures.length===1 && b.ecritures[0].body.refundDetail.totalAmount.value==='80.00' && b.ecritures[0].body.refundDetail.totalAmount.currency==='EUR','remboursement : le montant RELU chez eBay, jamais celui du navigateur');
// ── Annulation ───────────────────────────────────────────────────────────
b=banc();r=await b.gestion.deciderAnnulation({cancelId:'7000456',decision:'accepter',confirme:true},ctx);
check(r.body.ok && b.ecritures[0]?.p==='/post-order/v2/cancellation/7000456/approve' && b.marques[0]==='12-33333-44444' && r.body.commandeRangee===true,'accepter une annulation : approve envoyé, commande marquée annulée');
b=banc();r=await b.gestion.deciderAnnulation({cancelId:'7000456',decision:'refuser',confirme:true},ctx);check(r.body.ok && b.ecritures[0]?.p==='/post-order/v2/cancellation/7000456/reject' && !b.marques.length,'refuser : reject envoyé, commande pas touchée');
b=banc({annulation:{...annul,cancelState:'CANCEL_CLOSED_WITH_REFUND'}});r=await b.gestion.deciderAnnulation({cancelId:'7000456',decision:'accepter',confirme:true},ctx);check(r.status===409 && !b.ecritures.length && !b.marques.length,'annulation déjà tranchée : rien ne part');
b=banc({coupure:true});r=await b.gestion.deciderAnnulation({cancelId:'7000456',decision:'accepter',confirme:true},ctx);check(r.body.reason==='incertain' && !b.marques.length,'coupure : incertain, la commande n’est PAS marquée annulée');
b=banc();r=await b.gestion.deciderAnnulation({cancelId:'7000456',decision:'accepter',orderId:'12-99999-99999',confirme:true},ctx);check(r.status===409 && !b.ecritures.length,'commande vue ≠ commande eBay : rien ne part');
// La commande marquée sort des colis à faire (règle partagée).
const cmd={orderId:'12-33333-44444',orderPaymentStatus:'PAID',orderFulfillmentStatus:'NOT_STARTED',cancelStatus:{cancelState:'CANCEL_REQUESTED'}};
const d2=annulerCommandeRangee({orders:[cmd,{orderId:'autre',orderPaymentStatus:'PAID',orderFulfillmentStatus:'NOT_STARTED'}]},'12-33333-44444');
check(d2 && etatCommandeEbay(d2.orders[0]).kind==='cancelled' && !etatCommandeEbay(d2.orders[0]).peutExpedier && etatCommandeEbay(d2.orders[1]).peutExpedier,'commande annulée ⇒ hors des colis à faire, la voisine reste');
check(annulerCommandeRangee({orders:[cmd]},'inconnue')===undefined,'commande absente ⇒ rien n’est écrit');
// ── Promotion ────────────────────────────────────────────────────────────
b=banc();r=await b.gestion.promotion({},ctx);check(r.body.ok && r.body.promues[0]?.listingId==='3001' && Number(r.body.promues[0].taux)===5 && r.body.annonces.length===2,'promotion lue : annonce promue et son taux');
check(b.appels.some(a=>a.p&&a.p.startsWith('/sell/marketing/v1/ad_campaign') && /^Bearer /.test(a.h.Authorization)),'Marketing : jeton Bearer');
b=banc({lecture:403});r=await b.gestion.promotion({},ctx);check(!r.body.ok && r.body.reason==='scope','sans droit marketing ⇒ « reconnecte »');
check(tauxValide('5')==='5.0' && tauxValide('1.9')===null && tauxValide('101')===null && tauxValide('5,55')===null && tauxValide('12,5')==='12.5','taux : 2 à 100 %, une décimale');
b=banc();r=await b.gestion.promouvoir({listingId:'3001',taux:'6',confirme:true},ctx);check(r.status===409 && !b.ecritures.length,'annonce déjà promue ⇒ rien ne part');
b=banc();r=await b.gestion.promouvoir({listingId:'3002',taux:'6',confirme:true},ctx);check(r.body.ok && b.ecritures.length===1 && /bulk_create_ads_by_listing_id$/.test(b.ecritures[0].p) && b.ecritures[0].body.requests[0].bidPercentage==='6.0','promouvoir : une annonce, le taux choisi');
b=banc({campagnes:[]});r=await b.gestion.promouvoir({listingId:'3002',taux:'6',confirme:true},ctx);check(r.body.ok && b.ecritures.length===2 && b.ecritures[0].p==='/sell/marketing/v1/ad_campaign' && b.ecritures[0].body.fundingStrategy.fundingModel==='COST_PER_SALE' && /C9/.test(b.ecritures[1].p),'aucune campagne ⇒ une campagne « coût par vente » créée sur ce clic, puis l’annonce');
b=banc();r=await b.gestion.changerTaux({listingId:'3001',taux:'8',tauxVu:'4',confirme:true},ctx);check(r.status===409 && !b.ecritures.length,'taux vu périmé ⇒ rien ne part');
b=banc();r=await b.gestion.changerTaux({listingId:'3001',taux:'8',tauxVu:'5',confirme:true},ctx);check(r.body.ok && /bulk_update_ads_bid_by_listing_id$/.test(b.ecritures[0].p),'changer le taux');
b=banc();r=await b.gestion.arreterPromotion({listingId:'3001',confirme:true},ctx);check(r.body.ok && /bulk_delete_ads_by_listing_id$/.test(b.ecritures[0].p),'arrêter la promotion');
b=banc();r=await b.gestion.arreterPromotion({listingId:'3002',confirme:true},ctx);check(r.body.ok && r.body.deja && !b.ecritures.length,'annonce pas promue ⇒ rien à arrêter, rien ne part');
b=banc({coupure:true});r=await b.gestion.promouvoir({listingId:'3002',taux:'6',confirme:true},ctx);check(r.body.reason==='incertain','promotion coupée ⇒ incertain');
// ── Achats ───────────────────────────────────────────────────────────────
b=banc();r=await b.gestion.achats({},ctx);check(r.body.ok && r.body.achats[0]?.itemId==='4001' && r.body.achats[0].vendeur==='vendeur_x' && !b.ecritures.length,'achats eBay : lecture seule');
// ── La route : actions branchées, journalisées, sous la garde commune ─────
const route=readFileSync(path.join(ici,'..','..','api','ebay.js'),'utf8');
for(const a of ['retours','annulations','deciderretour','rembourserretour','decannulation','promotion','promouvoir','changertaux','arreterpromo','achats'])check(new RegExp('\\n\\s+'+a+':').test(route),'route : action « '+a+' »');
const comm=(route.match(/const commerciales=new Set\(\[([^\]]+)\]\)/) || [,''])[1];
check(['deciderretour','rembourserretour','decannulation','promouvoir','changertaux','arreterpromo'].every(a=>comm.includes("'"+a+"'")),'les gestes d’argent passent par le journal');
check(/sell\.marketing/.test(readFileSync(path.join(ici,'..','..','api','_lib','ebay.js'),'utf8')),'le droit sell.marketing est demandé au consentement');
console.log(`\n${n} verts, ${ko} rouges`);process.exit(ko?1:0);
