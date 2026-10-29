export function instantVinted(v){
 if(v==null||v==='')return null;
 const n=typeof v==='number'||/^\d{10,13}$/.test(String(v))?Number(v):NaN;
 const t=Number.isFinite(n)?(n<1e12?n*1000:n):Date.parse(v);
 return Number.isFinite(t)&&t>0&&Number.isFinite(new Date(t).getTime())?t:null;
}
export function auteurDernierConfirme(c,r){
 if(!r||r.der==null||r.opp==null||c.opposite_user?.id==null||String(r.opp)!==String(c.opposite_user.id))return null;
 const a=instantVinted(r.derTs),b=instantVinted(c.updated_at);
 const secondes=typeof r.derTs==='number'?r.derTs<1e12:/^\d{10}$/.test(String(r.derTs));
 if(a==null||b==null||(secondes?Math.floor(a/1000)!==Math.floor(b/1000):a!==b))return null;
 return String(r.der)===String(r.opp)?'eux':c._acc?.vinted_user_id!=null&&String(r.der)===String(c._acc.vinted_user_id)?'toi':null;
}
export function suiviNegociationVinted(c,uid,etatOffre){
 const natif=String(c?.transaction?.status_title||'').trim(),code=Number(c?.transaction?.status);
 if(code!==220&&code!==230&&!(code>=430)&&/^(?:en attente (?:du|de) paiement|paiement (?:en attente|attendu)|awaiting payment|pending payment|payment pending)(?: de l[’']acheteur)?[.!]?$/i.test(natif))return {libelle:'Paiement attendu',detail:natif};
 const uniques=new Map();
 for(const [i,m] of (c?.messages||[]).entries()){if(m?.entity_type!=='offer_request_message'||!m.entity)continue;const e=m.entity,k=e.transaction_id!=null&&e.offer_request_id!=null?e.transaction_id+':'+e.offer_request_id:'position:'+i,avant=uniques.get(k);if(avant&&['acceptee','refusee','terminee'].includes(etatOffre(avant.entity).etat)&&etatOffre(e).etat==='attente')continue;uniques.set(k,m);}
 const offres=[...uniques.values()].filter(m=>m?.entity_type==='offer_request_message'&&m.entity).map(m=>({e:m.entity,t:instantVinted(m.created_at_ts??m.created_at??m.entity.created_at_ts??m.entity.created_at)}));
 if(!offres.length)return null;
 if(offres.length>1&&offres.some(x=>x.t==null))return null;
 offres.sort((a,b)=>(a.t||0)-(b.t||0));
 const derniere=offres.at(-1);if(offres.length>1&&offres.at(-2).t===derniere.t)return null;
 const etat=etatOffre(derniere.e);if(etat.etat==='acceptee')return {libelle:'Prix accepté',detail:'Le prix est accepté. Le paiement n’est pas confirmé par cette acceptation.'};
 if(['inconnu','precedente'].includes(etat.etat))return null;
 if(etat.etat!=='attente')return {libelle:etat.libelle,detail:''};
 const opp=c?.opposite_user?.id;if(opp==null||derniere.e.user_id==null)return null;
 if(String(derniere.e.user_id)===String(opp))return {libelle:'Offre reçue',detail:'Une offre de l’acheteur attend une réponse.'};
 if(uid!=null&&String(derniere.e.user_id)===String(uid)){
  const avant=offres.slice(0,-1).some(x=>x.e.user_id!=null&&String(x.e.user_id)===String(opp));
  return {libelle:avant?'Contre-offre envoyée':'Offre envoyée',detail:'En attente de la réponse de l’acheteur.'};
 }
 return null;
}

export function reponseAttendueVinted(c,r,captureTraitee){
 if(auteurDernierConfirme(c,r)!=='eux')return false;
 const traitee=instantVinted(captureTraitee),actuelle=instantVinted(c.updated_at);
 return traitee==null||actuelle>traitee;
}
