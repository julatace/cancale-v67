// Codes observés dans les conversations Vinted : 10 attente, 20 acceptée, 30 refusée.
const texte=v=>typeof v==='string'?v.trim():'';
export function etatOffreVinted(e={}){
 const titre=texte(e.status_title),lisible=titre&&!/^[a-z]+(?:_[a-z]+)+$/.test(titre);
 if(e.status===20)return {etat:'acceptee',libelle:'Offre acceptée'};
 if(e.status===30)return {etat:'refusee',libelle:'Offre refusée'};
 if(/accept/i.test(titre))return {etat:'acceptee',libelle:lisible?titre:'Offre acceptée'};
 if(/refus|reject|declin/i.test(titre))return {etat:'refusee',libelle:lisible?titre:'Offre refusée'};
 if(/expir|annul|cancel|retir/i.test(titre))return {etat:'terminee',libelle:lisible?titre:'Offre terminée'};
 if(e.current===false)return {etat:'precedente',libelle:'Offre précédente'};
 if(e.status===10)return {etat:'attente',libelle:'En attente'};
 return {etat:'inconnu',libelle:lisible?titre:'Statut à vérifier'};
}
export function offreVintedEnAttente(c={}){
 const opp=c.opposite_user?.id;if(opp==null)return null;
 const index=new Map();
 for(const m of Array.isArray(c.messages)?c.messages:[]){
  if(m?.entity_type!=='offer_request_message')continue;const e=m.entity||{};
  if(e.transaction_id==null||e.offer_request_id==null)continue;
  const cle=String(e.transaction_id)+':'+String(e.offer_request_id),avant=index.get(cle);
  // Une capture plus pauvre ne réouvre pas une offre dont la fin est connue.
  if(avant&&['acceptee','refusee','terminee'].includes(etatOffreVinted(avant.entity).etat)&&e.status===10)continue;
  index.set(cle,m);
 }
 const offres=[];
 for(const m of index.values()){
  const e=m.entity;
  if(e.user_id==null||String(e.user_id)!==String(opp)||e.status!==10||etatOffreVinted(e).etat!=='attente')continue;
  if(!/^\d+$/.test(String(e.transaction_id))||!/^\d+$/.test(String(e.offer_request_id)))continue;
  if(c.transaction?.id!=null&&String(c.transaction.id)!==String(e.transaction_id))continue;
  const brut=e.price&&typeof e.price==='object'?e.price.amount:e.price;
  if(!/^\d+(?:[,.]\d{1,2})?$/.test(String(brut??'').trim()))continue;
  const prix=Number(String(brut).replace(',','.'));if(!(prix>0)||!Number.isFinite(prix))continue;
  const devise=e.price?.currency_code||e.price?.currency;if(devise&&devise!=='EUR')continue;
  const date=m.created_at_ts??e.created_at_ts??m.created_at??e.created_at,nb=Number(date);
  const ts=date==null||date===''?null:Number.isFinite(nb)?(nb<1e12?nb*1000:nb):(Date.parse(date)||null);
  offres.push({prix,tx:String(e.transaction_id),oid:String(e.offer_request_id),ts});
 }
 // Deux offres prétendument courantes : aucune identité choisie arbitrairement.
 return offres.length===1?offres[0]:null;
}
export const cleOffreVinted=(uid,off)=>`${uid}:${off.tx}:${off.oid}`;
export function appliquerOffresConfirmees(c,uid,preuves){
 if(!Array.isArray(c?.messages))return c;
 return {...c,messages:c.messages.map(m=>{
  const e=m?.entity;if(m?.entity_type!=='offer_request_message'||!e||e.status!==10)return m;
  const statut=preuves.get(cleOffreVinted(uid,{tx:e.transaction_id,oid:e.offer_request_id}));
  return statut===20||statut===30?{...m,entity:{...e,status:statut,status_title:statut===20?'Offre acceptée':'Offre refusée'}}:m;
 })};
}
