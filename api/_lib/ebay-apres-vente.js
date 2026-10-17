// ── eBAY APRÈS LA VENTE : RETOURS, ANNULATIONS, PROMOTION, ACHATS (17 octobre) ─
// Julien : « absolument toutes les fonctionnalités d'eBay dans mon app, comme
// ça l'utilisateur reste sur l'app ». Ce module ajoute ce qui manquait :
//   · les demandes de RETOUR et d'ANNULATION (Post-Order API v2) ;
//   · la PROMOTION des annonces (Marketing API, campagnes « coût par vente ») ;
//   · ses ACHATS eBay (Trading GetMyeBayBuying, lecture seule).
// ⚠️ NON MESURÉ sur ses comptes : chemins, champs et en-têtes viennent de la
//   documentation d'eBay (Post-Order v2 : `Authorization: IAF <jeton OAuth>` ;
//   Marketing v1 : `Bearer`, droit `sell.marketing`). Une forme inattendue
//   rend « illisible », jamais une liste vide ; un refus d'autorisation dit
//   « reconnecte eBay », jamais « aucune demande ».
// Règles communes (celles de ebay-gestion.js) : tout geste exige `confirme`
// AVANT d'aller chercher le jeton ; l'état est RELU chez eBay juste avant
// d'écrire (montant, état, taux) ; une coupure ou un 5xx après l'envoi rend
// « incertain » (504), jamais « refusé » ni « fait ». Rien n'est automatique.
import {lireXmlEbay} from './ebay-gestion.js';

const liste=v=>v==null?[]:Array.isArray(v)?v:[v];
const texte=v=>v==null?'':typeof v==='object'?String(v['#text'] ?? ''):String(v);
const idNum=v=>/^\d{1,24}$/.test(String(v || ''));
const idRetour=v=>/^[0-9]{1,24}$/.test(String(v || ''));
const echec=(error,status=400,reason)=>({status,body:{ok:false,error,...(reason?{reason}:{})}});
const succes=body=>({status:200,body:{ok:true,...body}});
const incertain=quoi=>echec(`eBay n’a pas répondu — je ne sais pas si ${quoi}. Regarde sur eBay avant de recommencer.`,504,'incertain');
const enCentimes=v=>{const n=Number(String(v ?? '').replace(',','.'));return Number.isFinite(n)?Math.round(n*100):NaN;};
const montantOk=v=>/^\d{1,9}(?:[.,]\d{1,2})?$/.test(String(v ?? '').trim()) && enCentimes(v)>0;
const devise=v=>/^[A-Z]{3}$/.test(String(v || ''));
const dateDe=v=>{const s=v && typeof v==='object'?(v.value || v.formattedValue || ''):v;return typeof s==='string' && Number.isFinite(Date.parse(s))?s:null;};
const somme=(m)=>m && typeof m==='object' && montantOk(m.value) && devise(m.currency)?{value:(enCentimes(m.value)/100).toFixed(2),currency:m.currency}:null;

// ── Lecture des retours (Post-Order `return/search`, rôle VENDEUR) ────────────
// États « à traiter » : ce que la doc nomme comme ouvert. Un état inconnu est
// gardé et montré tel quel (ne pas cacher une demande qu'on ne connaît pas).
export const RETOUR_FERME=/^(CLOSED|RETURN_CLOSED|REFUND_ISSUED|CLOSED_WITH_REFUND)$/i;
export function retoursEbay(data){
  if(!data || typeof data!=='object' || !Array.isArray(data.members))return null;
  return data.members.map(m=>{
    const ci=m.creationInfo || {},it=ci.item || {},s=m.sellerTotalRefund || {};
    return {
      returnId:String(m.returnId || ''),orderId:String(m.orderId || ''),acheteur:String(m.buyerLoginName || ''),
      etat:String(m.state || ''),statut:String(m.status || ''),
      itemId:String(it.itemId || ''),titre:String(it.itemTitle || ''),quantite:Number(it.returnQuantity) || null,
      motif:String(ci.reason || ''),commentaire:String(ci.comments?.content || ''),date:dateDe(ci.creationDate),
      remboursementPrevu:somme(s.estimatedRefundAmount),rembourse:somme(s.actualRefundAmount),
    };
  }).filter(r=>idRetour(r.returnId));
}
// ── Lecture des annulations (Post-Order `cancellation/search`) ────────────────
export const ANNULATION_A_DECIDER=/^(CANCEL_REQUESTED|CANCEL_PENDING)$/i;
export function annulationsEbay(data){
  if(!data || typeof data!=='object' || !Array.isArray(data.cancellations))return null;
  return data.cancellations.map(c=>({
    cancelId:String(c.cancelId || ''),orderId:String(c.legacyOrderId || ''),acheteur:String(c.buyerLoginName || ''),
    demandeur:String(c.requestorType || ''),etat:String(c.cancelState || ''),statut:String(c.cancelStatus || ''),
    motif:String(c.cancelReason || ''),date:dateDe(c.cancelRequestDate),montant:somme(c.requestRefundAmount),
  })).filter(c=>idRetour(c.cancelId));
}
// ── Promotion : campagnes « coût par vente » et leurs annonces ────────────────
export function campagnesEbay(data,marketplace='EBAY_FR'){
  if(!data || typeof data!=='object' || !Array.isArray(data.campaigns))return null;
  return data.campaigns.filter(c=>c && c.campaignId && String(c.campaignStatus || '').toUpperCase()==='RUNNING'
    && String(c.fundingStrategy?.fundingModel || '').toUpperCase()==='COST_PER_SALE' && (!c.marketplaceId || c.marketplaceId===marketplace))
    .map(c=>({id:String(c.campaignId),nom:String(c.campaignName || ''),taux:Number(c.fundingStrategy?.bidPercentage) || null}));
}
export function annoncesPromues(data){
  if(!data || typeof data!=='object' || !Array.isArray(data.ads))return null;
  return data.ads.filter(a=>a && idNum(a.listingId)).map(a=>({listingId:String(a.listingId),adId:String(a.adId || ''),taux:Number(a.bidPercentage),statut:String(a.adStatus || '')}));
}
// Le taux : de 2 à 100 %, une décimale (doc eBay « bidPercentage »).
export const tauxValide=v=>{const s=String(v ?? '').trim().replace(',','.');if(!/^\d{1,3}(?:\.\d)?$/.test(s))return null;const n=Number(s);return n>=2 && n<=100?n.toFixed(1):null;};
// ── Achats (Trading GetMyeBayBuying → WonList) ─────────────────────────────────
export function achatsEbay(root){
  if(!root)return null;
  const ot=liste(root.WonList?.OrderTransactionArray?.OrderTransaction);
  return ot.flatMap(o=>{
    const ts=o.Transaction?[o.Transaction]:liste(o.Order?.TransactionArray?.Transaction);
    return liste(ts).flat().map(t=>({
      itemId:texte(t.Item?.ItemID),titre:texte(t.Item?.Title),vendeur:texte(t.Item?.Seller?.UserID),
      prix:texte(t.TransactionPrice),devise:t.TransactionPrice?.['@_currencyID'] || null,date:texte(t.CreatedDate) || null,
      statut:texte(t.Status?.CompleteStatus || ''),
    }));
  }).filter(a=>idNum(a.itemId));
}

// La commande rangée (`ebay_orders`) d'une annulation ACCEPTÉE : marquée
// « CANCELED » — `etatCommandeEbay` la sort alors des colis à faire. Rend
// `undefined` (rien à écrire) si la commande n'y est pas.
export function annulerCommandeRangee(d,orderId,at=new Date().toISOString()){
  if(!d || !Array.isArray(d.orders) || !orderId)return undefined;
  let vu=false;
  const orders=d.orders.map(o=>{if(o && (o.orderId===orderId || o.legacyOrderId===orderId)){vu=true;return {...o,cancelStatus:{...(o.cancelStatus || {}),cancelState:'CANCELED'},_annuleeParVrm:at};}return o;});
  return vu?{...d,orders}:undefined;
}
export function creerApresVenteEbay({accessToken,tradingCall,apiOrigin,fetcher=(...a)=>fetch(...a),marketplace='EBAY_FR',lireAnnonces,marquerCommandeAnnulee}){
  const jeton=async ctx=>{const r=await accessToken(ctx);return r.ok && r.token?r:echec(r.error || 'Compte eBay indisponible.',r.status || 502,r.reason);};
  // Une requête JSON. `post` : un 5xx ou une coupure ⇒ `incertain:true`.
  async function json(url,token,{method='GET',body,iaf=false}={}){
    try{
      const r=await fetcher(url,{method,headers:{Authorization:(iaf?'IAF ':'Bearer ')+token,Accept:'application/json','Content-Type':'application/json','X-EBAY-C-MARKETPLACE-ID':marketplace},...(body!==undefined?{body:JSON.stringify(body)}:{})});
      const txt=await r.text().catch(()=>'');let data=null;try{data=txt?JSON.parse(txt):null;}catch(_){}
      return {status:r.status,ok:r.status>=200 && r.status<300,data,headers:r.headers};
    }catch(_){return {status:0,ok:false,data:null,coupure:true};}
  }
  const lectureRatee=(r,quoi)=>r.status===401 || r.status===403
    ? echec(`eBay n’a pas autorisé VRM à lire ${quoi}. Reconnecte ton compte eBay (Compte → Connecter) pour donner ce droit.`,200,'scope')
    : echec(`eBay n’a pas rendu ${quoi}.`,r.status>=400?r.status:502,'pas-su');
  const ecritureRatee=(r,quoi,refus)=>(r.coupure || r.status>=500)?incertain(quoi):echec(refus,r.status>=400?r.status:502,'refus');
  const PO=`${apiOrigin}/post-order/v2`;

  async function retours(b,ctx){
    const a=await jeton(ctx);if(!a.token)return a;
    const r=await json(`${PO}/return/search?role=SELLER&limit=50&sort=CREATION_DATE_DESC`,a.token,{iaf:true});
    if(!r.ok)return lectureRatee(r,'tes demandes de retour');
    const l=retoursEbay(r.data);if(!l)return echec('Réponse eBay illisible pour les retours.',502,'illisible');
    return succes({retours:l});
  }
  async function annulations(b,ctx){
    const a=await jeton(ctx);if(!a.token)return a;
    const r=await json(`${PO}/cancellation/search?role=SELLER&limit=50`,a.token,{iaf:true});
    if(!r.ok)return lectureRatee(r,'tes demandes d’annulation');
    const l=annulationsEbay(r.data);if(!l)return echec('Réponse eBay illisible pour les annulations.',502,'illisible');
    return succes({annulations:l});
  }
  const relireRetour=async(id,token)=>{
    const r=await json(`${PO}/return/${encodeURIComponent(id)}`,token,{iaf:true});
    if(!r.ok || !r.data)return {ko:lectureRatee(r,'cette demande de retour')};
    const s=r.data.summary || r.data,l=retoursEbay({members:[s]});
    return l && l[0] && l[0].returnId===String(id)?{retour:l[0]}:{ko:echec('Cette demande de retour n’est plus lisible chez eBay.',409)};
  };
  // Accepter ou refuser un retour. Refuser exige un motif (eBay le transmet).
  async function deciderRetour(b,ctx){
    if(b.confirme!==true)return echec('Confirme ta décision sur ce retour : rien n’a été envoyé.',400,'confirmation');
    const decision=String(b.decision || '').toUpperCase(),commentaire=String(b.commentaire || '').trim();
    if(!idRetour(b.returnId) || !['ACCEPT','DECLINE'].includes(decision) || commentaire.length>1000 || (decision==='DECLINE' && !commentaire))return echec(decision==='DECLINE'?'Dis pourquoi tu refuses (1 000 caractères au plus).':'Demande de retour invalide.');
    const a=await jeton(ctx);if(!a.token)return a;
    const v=await relireRetour(b.returnId,a.token);if(v.ko)return v.ko;
    if(RETOUR_FERME.test(v.retour.etat))return echec('Cette demande de retour est déjà close chez eBay.',409,'close');
    if(String(v.retour.etat).toUpperCase()!=='RETURN_REQUESTED')return echec('eBay n’attend plus ta décision sur ce retour (état : '+(v.retour.etat || 'inconnu')+'). Actualise.',409,'etat');
    const r=await json(`${PO}/return/${encodeURIComponent(b.returnId)}/decide`,a.token,{method:'POST',iaf:true,body:{decision,...(commentaire?{comments:{content:commentaire}}:{})}});
    if(!r.ok)return ecritureRatee(r,'ta décision est partie','eBay a refusé cette décision sur le retour.');
    return succes({decision});
  }
  // Rembourser un retour : le montant que tu as VU doit être celui qu'eBay
  // annonce ENCORE, dans la même devise — sinon rien ne part (409).
  async function rembourserRetour(b,ctx){
    if(b.confirme!==true)return echec('Confirme le remboursement : rien n’a été envoyé.',400,'confirmation');
    if(!idRetour(b.returnId) || !montantOk(b.montantVu) || !devise(b.devise))return echec('Montant ou demande de retour invalide.');
    const a=await jeton(ctx);if(!a.token)return a;
    const v=await relireRetour(b.returnId,a.token);if(v.ko)return v.ko;
    if(v.retour.rembourse)return succes({deja:true,montant:v.retour.rembourse});
    if(RETOUR_FERME.test(v.retour.etat))return echec('Cette demande de retour est déjà close chez eBay.',409,'close');
    const m=v.retour.remboursementPrevu;
    if(!m)return echec('eBay n’annonce pas de montant à rembourser pour ce retour — rien n’a été envoyé.',409,'montant-inconnu');
    if(enCentimes(m.value)!==enCentimes(b.montantVu) || m.currency!==b.devise)return echec(`Le montant a changé chez eBay (${m.value} ${m.currency}). Relis-le avant de rembourser.`,409,'montant-change');
    const r=await json(`${PO}/return/${encodeURIComponent(b.returnId)}/issue_refund`,a.token,{method:'POST',iaf:true,body:{refundDetail:{itemizedRefundDetail:[{refundAmount:{value:m.value,currency:m.currency},refundFeeType:'PURCHASE_PRICE'}],totalAmount:{value:m.value,currency:m.currency}},comments:{content:'Remboursement du retour'}}});
    if(!r.ok)return ecritureRatee(r,'le remboursement est parti','eBay a refusé le remboursement.');
    return succes({montant:m});
  }
  const relireAnnulation=async(id,token)=>{
    const r=await json(`${PO}/cancellation/${encodeURIComponent(id)}`,token,{iaf:true});
    if(!r.ok || !r.data)return {ko:lectureRatee(r,'cette demande d’annulation')};
    const d=r.data.cancelDetail || r.data,l=annulationsEbay({cancellations:[d]});
    return l && l[0] && l[0].cancelId===String(id)?{annulation:l[0]}:{ko:echec('Cette demande d’annulation n’est plus lisible chez eBay.',409)};
  };
  // Accepter une annulation : eBay rembourse l'acheteur, la commande ne part
  // pas. Elle SORT des colis à faire (commande rangée marquée annulée).
  async function deciderAnnulation(b,ctx){
    if(b.confirme!==true)return echec('Confirme ta décision sur cette annulation : rien n’a été envoyé.',400,'confirmation');
    const decision=String(b.decision || '');
    if(!idRetour(b.cancelId) || !['accepter','refuser'].includes(decision))return echec('Demande d’annulation invalide.');
    const a=await jeton(ctx);if(!a.token)return a;
    const v=await relireAnnulation(b.cancelId,a.token);if(v.ko)return v.ko;
    if(!ANNULATION_A_DECIDER.test(v.annulation.etat))return echec('eBay n’attend plus ta décision sur cette annulation (état : '+(v.annulation.etat || 'inconnu')+'). Actualise.',409,'etat');
    if(b.orderId!=null && String(b.orderId)!==v.annulation.orderId)return echec('La commande de cette annulation a changé — actualise.',409,'commande');
    const r=await json(`${PO}/cancellation/${encodeURIComponent(b.cancelId)}/${decision==='accepter'?'approve':'reject'}`,a.token,{method:'POST',iaf:true,body:{}});
    if(!r.ok)return ecritureRatee(r,'ta décision est partie','eBay a refusé cette décision sur l’annulation.');
    let commandeRangee=null;
    if(decision==='accepter' && v.annulation.orderId && marquerCommandeAnnulee)commandeRangee=await marquerCommandeAnnulee(v.annulation.orderId,ctx).catch(()=>false);
    return succes({decision,orderId:v.annulation.orderId,commandeRangee});
  }

  // ── PROMOTION ────────────────────────────────────────────────────────────
  const MK=`${apiOrigin}/sell/marketing/v1`;
  async function lirePromotion(token){
    const c=await json(`${MK}/ad_campaign?campaign_status=RUNNING&limit=100`,token);
    if(!c.ok)return {ko:lectureRatee(c,'tes campagnes de promotion')};
    const campagnes=campagnesEbay(c.data,marketplace);if(!campagnes)return {ko:echec('Réponse eBay illisible pour la promotion.',502,'illisible')};
    const ads=[];
    for(const cp of campagnes){
      const r=await json(`${MK}/ad_campaign/${encodeURIComponent(cp.id)}/ad?limit=500`,token);
      if(!r.ok)return {ko:lectureRatee(r,'les annonces promues')};
      const l=annoncesPromues(r.data);if(!l)return {ko:echec('Réponse eBay illisible pour les annonces promues.',502,'illisible')};
      for(const x of l)ads.push({...x,campagne:cp.id});
    }
    return {campagnes,ads};
  }
  async function promotion(b,ctx){
    const a=await jeton(ctx);if(!a.token)return a;
    const p=await lirePromotion(a.token);if(p.ko)return p.ko;
    const annonces=lireAnnonces?await lireAnnonces(ctx).catch(()=>undefined):undefined;
    return succes({campagnes:p.campagnes,promues:p.ads,annonces:Array.isArray(annonces)?annonces:null});
  }
  const resultatLot=(r)=>{const x=Array.isArray(r.data?.responses)?r.data.responses[0]:null;return x && x.statusCode>=200 && x.statusCode<300;};
  async function promouvoir(b,ctx){
    if(b.confirme!==true)return echec('Confirme la promotion : rien n’a été envoyé.',400,'confirmation');
    const taux=tauxValide(b.taux);
    if(!idNum(b.listingId) || !taux)return echec('Taux de promotion entre 2 et 100 % (une décimale).');
    const a=await jeton(ctx);if(!a.token)return a;
    const p=await lirePromotion(a.token);if(p.ko)return p.ko;
    if(p.ads.some(x=>x.listingId===String(b.listingId)))return echec('Cette annonce est déjà promue — change son taux plutôt.',409,'deja');
    let camp=p.campagnes[0]?.id;
    if(!camp){
      const c=await json(`${MK}/ad_campaign`,a.token,{method:'POST',body:{campaignName:'VRM',startDate:new Date(Date.now()+60000).toISOString(),marketplaceId:marketplace,fundingStrategy:{fundingModel:'COST_PER_SALE',bidPercentage:taux}}});
      if(!c.ok)return ecritureRatee(c,'la campagne de promotion a été créée','eBay a refusé de créer la campagne de promotion.');
      camp=String((c.headers && c.headers.get && c.headers.get('location') || '').split('/').pop() || '');
      if(!camp)return incertain('la campagne de promotion a été créée');
    }
    const r=await json(`${MK}/ad_campaign/${encodeURIComponent(camp)}/bulk_create_ads_by_listing_id`,a.token,{method:'POST',body:{requests:[{listingId:String(b.listingId),bidPercentage:taux}]}});
    if(!r.ok && !(r.status===207))return ecritureRatee(r,'la promotion est partie','eBay a refusé de promouvoir cette annonce.');
    if(!resultatLot(r))return echec('eBay a refusé de promouvoir cette annonce.',422,'refus');
    return succes({taux,campagne:camp});
  }
  async function changerTaux(b,ctx){
    if(b.confirme!==true)return echec('Confirme le nouveau taux : rien n’a été envoyé.',400,'confirmation');
    const taux=tauxValide(b.taux),vu=tauxValide(b.tauxVu);
    if(!idNum(b.listingId) || !taux || !vu)return echec('Taux de promotion entre 2 et 100 % (une décimale).');
    const a=await jeton(ctx);if(!a.token)return a;
    const p=await lirePromotion(a.token);if(p.ko)return p.ko;
    const ad=p.ads.find(x=>x.listingId===String(b.listingId));
    if(!ad)return echec('Cette annonce n’est plus promue.',409,'pas-promue');
    if(Number(ad.taux).toFixed(1)!==vu)return echec(`Le taux a changé chez eBay (${ad.taux} %). Relis-le.`,409,'taux-change');
    const r=await json(`${MK}/ad_campaign/${encodeURIComponent(ad.campagne)}/bulk_update_ads_bid_by_listing_id`,a.token,{method:'POST',body:{requests:[{listingId:String(b.listingId),bidPercentage:taux}]}});
    if(!r.ok && r.status!==207)return ecritureRatee(r,'le nouveau taux est parti','eBay a refusé le nouveau taux.');
    if(!resultatLot(r))return echec('eBay a refusé le nouveau taux.',422,'refus');
    return succes({taux});
  }
  async function arreterPromotion(b,ctx){
    if(b.confirme!==true)return echec('Confirme l’arrêt de la promotion : rien n’a été envoyé.',400,'confirmation');
    if(!idNum(b.listingId))return echec('Annonce invalide.');
    const a=await jeton(ctx);if(!a.token)return a;
    const p=await lirePromotion(a.token);if(p.ko)return p.ko;
    const ad=p.ads.find(x=>x.listingId===String(b.listingId));
    if(!ad)return succes({deja:true});
    const r=await json(`${MK}/ad_campaign/${encodeURIComponent(ad.campagne)}/bulk_delete_ads_by_listing_id`,a.token,{method:'POST',body:{requests:[{listingId:String(b.listingId)}]}});
    if(!r.ok && r.status!==207)return ecritureRatee(r,'l’arrêt est parti','eBay a refusé d’arrêter la promotion.');
    if(!resultatLot(r))return echec('eBay a refusé d’arrêter la promotion.',422,'refus');
    return succes({});
  }

  // ── ACHATS (lecture seule) ──────────────────────────────────────────────
  async function achats(b,ctx){
    const a=await jeton(ctx);if(!a.token)return a;
    const r=await tradingCall(a.token,'GetMyeBayBuying','<WonList><Include>true</Include><DurationInDays>60</DurationInDays><Pagination><EntriesPerPage>100</EntriesPerPage><PageNumber>1</PageNumber></Pagination></WonList>');
    if(!r.ok)return echec(r.err || 'eBay n’a pas rendu tes achats.',r.status>=400?r.status:502,'pas-su');
    const root=lireXmlEbay(r.xml,'GetMyeBayBuying');
    if(!root || !['Success','Warning'].includes(texte(root.Ack).trim()))return echec('Réponse eBay illisible pour tes achats.',502,'illisible');
    return succes({achats:achatsEbay(root) || []});
  }
  return {retours,annulations,deciderRetour,rembourserRetour,deciderAnnulation,promotion,promouvoir,changerTaux,arreterPromotion,achats};
}
