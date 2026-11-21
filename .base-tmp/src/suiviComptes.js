const groupes={listings:'annonces',orders_sold:'ventes',orders_purchased:'achats',inbox:'messages'};
export function suiviComptes(comptes,lignes,maintenant=Date.now()){
 const donnees=Array.isArray(lignes)?lignes:null;
 const index=new Map();
 for(const ligne of donnees||[]){const m=/^harvest_(\d+)_(listings|orders_sold|orders_purchased|inbox)$/.exec(ligne.id||'');if(!m)continue;const groupe=index.get(m[1])||[];groupe.push({ligne,source:groupes[m[2]]});index.set(m[1],groupe);}
 return comptes.map(c=>{
  const id=String(c.vinted_user_id),sources={};
  for(const cle of Object.values(groupes))sources[cle]={etat:donnees?'non-observe':'inconnu',date:null};
  for(const {ligne,source:cle} of index.get(id)||[]){
   const t=Date.parse(ligne.cap||ligne.updated_at||'');
   if(!Number.isFinite(t)||t>maintenant+300000){if(sources[cle].etat!=='observe')sources[cle]={etat:'inconnu',date:null};continue;}
   if(!sources[cle].date||t>Date.parse(sources[cle].date))sources[cle]={etat:'observe',date:new Date(t).toISOString(),origineDate:ligne.cap?'capture':'enregistrement'};
  }
  return {id,nom:c.login||'Compte Vinted',sources};
 });
}

export const etatSourceMemoire=(ligne,champ)=>ligne===undefined?'Lecture impossible':ligne===null?'Pas encore de capture':champ&&!Array.isArray(ligne[champ])?'Format à vérifier':'Données enregistrées';
export function suiviLeboncoin({annonces,comptes,transactions}){
 if(![annonces,comptes,transactions].every(Array.isArray))return null;
 const items=annonces[0]?.items||{},ventes=Object.values(transactions[0]?.ventes||{});
 return Object.entries(comptes[0]?.accounts||{}).filter(([,c])=>c?.sessionAt).map(([id,c])=>{
  const cle=String(c.id||id),ads=Object.values(items).filter(a=>a&&String(a.account||'')===cle);
  const liees=ventes.filter(v=>v?.isSeller===true&&v.itemId!=null&&String(items[String(v.itemId)]?.account||'')===cle);
  return {id:cle,nom:c.pseudo||c.name||c.login||'Compte Leboncoin',session:c.sessionAt,annonces:ads.length,avecPhoto:ads.filter(a=>Array.isArray(a.images)&&a.images.some(p=>typeof p==='string'&&/^https:\/\//.test(p))).length,sansPhoto:ads.filter(a=>!Array.isArray(a.images)||!a.images.some(p=>typeof p==='string'&&/^https:\/\//.test(p))).length,ventes:liees.length};
 });
}

export function controlesSources(sources,maintenant=Date.now()){
 return Object.entries(sources).flatMap(([nom,s])=>{
  if(s.etat==='inconnu')return [{source:nom,raison:'Lecture non vérifiée',action:'Actualise le diagnostic avant de conclure.'}];
  if(s.etat==='non-observe')return [{source:nom,raison:'Aucune capture privée observée',action:'Ouvre cette rubrique sur le bon compte Vinted avec l’extension active.'}];
  if(s.date&&maintenant-Date.parse(s.date)>86400000)return [{source:nom,raison:'Enregistrement datant de plus de 24 h',action:'Relis cette rubrique sur Vinted pour vérifier son état actuel.'}];
  return [];
 });
}
