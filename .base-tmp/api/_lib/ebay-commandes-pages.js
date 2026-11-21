import {randomUUID} from 'node:crypto';
import {fusionPageCommandesEbay} from './ebay-synchronisation.js';
const echec=(error,status=502,reason)=>({status,body:{ok:false,error,...(reason?{reason}:{})}});
const signature=data=>JSON.stringify([data?.rev??null,data?.capturedAt??null,data?.pagination?.generation??null,data?.pagination?.nextOffset??null]);
export function creerLectureCommandesEbay({lire,modifier,jeton,json,apiOrigin,identifier=randomUUID}){
 return async ctx=>{
  const ligne='ebay_orders'+(ctx.compte.suffixe || '');
  const previous=await lire(ligne,ctx.owner);
  if(previous===undefined)return echec('Les commandes sauvegardées n’ont pas pu être lues. Rien n’a été remplacé.');
  const p=previous?.pagination;
  if(p?.complete===true)return {status:200,body:{ok:true,lues:p.lues,total:p.total,complete:true,nextOffset:null,deja:true}};
  if(p && p.nextOffset==null)return echec('La liste ou sa pagination a changé. Actualise ce compte pour recommencer la lecture.',409);
  const offset=p?.nextOffset??0;
  if(!Number.isInteger(offset) || offset<0 || offset>10000)return echec('La pagination sauvegardée doit être relue.',409);
  const a=await jeton(ctx);if(!a.ok || !a.token)return echec(a.error || 'Compte eBay indisponible.',a.status || 502,a.reason);
  const page=await json(`${apiOrigin}/sell/fulfillment/v1/order?limit=50&offset=${offset}`,a.token);
  if(!page.ok)return echec('La page suivante n’a pas pu être lue. Les commandes déjà capturées sont conservées.');
  const generation=offset===0?identifier():p.generation,now=Date.now();
  if(!fusionPageCommandesEbay(previous,page.data,offset,now,generation))return echec('La page reçue ne correspond pas aux commandes attendues.');
  const before=signature(previous);let result,outcome='lecture';
  const saved=await modifier(ligne,ctx.owner,current=>{
   if(signature(current)!==before){outcome='conflit';return undefined;}
   result=fusionPageCommandesEbay(current,page.data,offset,now,generation);
   if(!result){outcome='forme';return undefined;}
   outcome='ok';return result;
  });
  if(outcome==='conflit')return echec('Une autre lecture a avancé sur ce compte. Actualise avant de continuer.',409);
  if(saved!==true || outcome!=='ok')return echec('La page lue n’a pas pu être sauvegardée. Les dernières commandes restent conservées.');
  const state=result.pagination;
  return {status:200,body:{ok:true,lues:state.lues,total:state.total,complete:state.complete,nextOffset:state.nextOffset,issue:state.issue}};
 };
}
