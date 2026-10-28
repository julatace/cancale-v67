const groupes={listings:'annonces',orders_sold:'ventes',orders_purchased:'achats',inbox:'messages'};
export function suiviComptes(comptes,lignes,maintenant=Date.now()){
 const donnees=Array.isArray(lignes)?lignes:null;
 return comptes.map(c=>{
  const id=String(c.vinted_user_id),sources={};
  for(const cle of Object.values(groupes))sources[cle]={etat:donnees?'non-observe':'inconnu',date:null};
  for(const ligne of donnees||[]){const m=/^harvest_(\d+)_(listings|orders_sold|orders_purchased|inbox)$/.exec(ligne.id||'');if(!m||m[1]!==id)continue;
   const cle=groupes[m[2]],t=Date.parse(ligne.cap||ligne.updated_at||'');
   if(!Number.isFinite(t)||t>maintenant+300000){if(sources[cle].etat!=='observe')sources[cle]={etat:'inconnu',date:null};continue;}
   if(!sources[cle].date||t>Date.parse(sources[cle].date))sources[cle]={etat:'observe',date:new Date(t).toISOString()};
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
  return {id:cle,nom:c.pseudo||c.name||c.login||'Compte Leboncoin',session:c.sessionAt,annonces:ads.length,avecPhoto:ads.filter(a=>Array.isArray(a.images)&&a.images.some(p=>typeof p==='string'&&/^https:\/\//.test(p))).length,ventes:liees.length};
 });
}
