import {instantVinted} from './suiviMessagerieVinted.js';
export function etatCaptureVinted(row,{archive=null,favoris=false,maintenant=Date.now()}={}){
 if(!row&&!archive)return {date:null,libelle:'Aucune capture',action:'Ouvre ce compte sur Vinted avec l’extension connectée.'};
 const r=favoris&&archive&&(!row||Number(instantVinted(archive.cap))>=Number(instantVinted(row.cap)))?archive:row||archive;
 if(r.supprime===true||r.supprime==='true')return {date:null,libelle:'Données effacées',action:'Une nouvelle capture sur Vinted est nécessaire pour les réafficher.'};
 const date=instantVinted(r.cap);
 if(date==null||date>maintenant+120000)return {date:null,libelle:'Date non vérifiée',action:'Ouvre ce compte sur Vinted, puis actualise cet état.'};
 const complet=favoris?r===archive&&archive.sync?.complete===true&&archive.limite!==true&&archive.limite!=='true':Number(r.pages)===1;
 const partiel=favoris?(!!archive?.sync&&!complet||Number(r.pages)>1):Number(r.pages)>1;
 return {date,libelle:maintenant-date>86400000?'Capture ancienne':complet?'Historique récupéré':partiel?'Historique à compléter':'Étendue non vérifiée',action:complet&&maintenant-date<=86400000?'':favoris?'Ouvre la cloche sur ce compte, puis utilise « Récupérer toutes les pages » dans Favoris reçus.':'Ouvre la messagerie de ce compte sur Vinted avec l’extension, puis actualise VRM.'};
}
export async function lireSynchronisationVinted({uids,owner,ownerActuel,lire}){
 if(!owner||ownerActuel()!==owner)throw Error('Reconnecte-toi à VRM pour consulter la synchronisation.');
 const comptes=[...new Set(uids.map(String))];if(comptes.some(x=>!/^\d{1,20}$/.test(x)))throw Error('Un compte Vinted n’est pas identifié.');
 const rows=[];
 for(let i=0;i<comptes.length;i+=20){
  const ids=comptes.slice(i,i+20).flatMap(uid=>['inbox','notifications','favoris_archive'].map(type=>`harvest_${uid}_${type}`));
  const lu=await lire(`id=in.(${ids.join(',')})&owner=eq.${encodeURIComponent(owner)}&select=id,owner,cap:data->>capturedAt,pages:data->payload->pagination->>total_pages,sync:data->sync,limite:data->>limite,supprime:data->>supprime`);
  if(ownerActuel()!==owner)throw Error('La session a changé.');
  if(!Array.isArray(lu)||lu.some(r=>r.owner!==owner||!ids.includes(r.id))||new Set(lu.map(r=>r.id)).size!==lu.length)throw Error('La synchronisation de ces comptes n’a pas pu être vérifiée.');
  rows.push(...lu);
 }
 const parId=new Map(rows.map(r=>[r.id,r]));
 return comptes.map(uid=>({uid,messages:etatCaptureVinted(parId.get(`harvest_${uid}_inbox`)),favoris:etatCaptureVinted(parId.get(`harvest_${uid}_notifications`),{archive:parId.get(`harvest_${uid}_favoris_archive`),favoris:true})}));
}
