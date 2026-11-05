// Commodités locales : aucun jeton, aucun message et aucune identité devinée.
export const cleParcours=(owner,nom)=>owner?`vrm_parcours:${encodeURIComponent(owner)}:${nom}`:null;
export function lireParcours(storage,owner,nom,defaut=null,now=Date.now()){
 try{const k=cleParcours(owner,nom),x=k&&JSON.parse(storage.getItem(k)||'null');return x?.owner===owner&&Number.isFinite(x.at)&&now>=x.at&&now-x.at<7*86400000?x.valeur:defaut;}catch{return defaut;}
}
export function garderParcours(storage,owner,nom,valeur,now=Date.now()){
 try{const k=cleParcours(owner,nom);if(!k)return false;storage.setItem(k,JSON.stringify({owner,at:now,valeur}));return true;}catch{return false;}
}
export function resumeSelection(lignes,coches){
 const vus=new Set(),selection=(lignes||[]).filter(l=>l&&l.cochable!==false&&coches?.has(l.cle)&&!vus.has(l.cle)&&vus.add(l.cle));
 const comptes=new Set(selection.map(l=>l.compte||l.e?.o?._acc?.vinted_user_id||l.lo?.account||l.v?.compte).filter(v=>typeof v==='string'||typeof v==='number').filter(Boolean).map(String));
 return {total:selection.length,prets:selection.filter(l=>l.pdf!==false).length,sansPdf:selection.filter(l=>l.pdf===false).length,dejaImprimes:selection.filter(l=>!!l.imprime).length,comptes:comptes.size,sites:[...new Set(selection.map(l=>l.site).filter(Boolean))],lignes:selection};
}
const CHAMPS={vinted_annonce_numeros:{numero:'Numéro de rangement',buyPrice:'Prix d’achat',buyFromId:'Achat relié'},vinted_sale_overrides:{numero:'Numéro de rangement',buyPrice:'Prix d’achat',buyFromId:'Achat relié'},vinted_buyprice_by_num:{$:'Prix d’achat'},vrm_lbc_liens:{$:'Association Leboncoin'}};
export function changementsImportants(cle,avant,apres,at=new Date().toISOString()){
 const champs=CHAMPS[cle];if(!champs||!avant||typeof avant!=='object'||!apres||typeof apres!=='object')return[];
 const scalar=v=>v==null?'':typeof v==='string'?v.slice(0,120):typeof v==='number'&&Number.isFinite(v)?v:null;
 const r=[];for(const id of new Set([...Object.keys(avant),...Object.keys(apres)]))for(const [champ,label]of Object.entries(champs)){
  const a=scalar(champ==='$'?avant[id]:avant[id]?.[champ]),b=scalar(champ==='$'?apres[id]:apres[id]?.[champ]);
  if(a===null||b===null||a===b)continue;
  r.push({cle,id,champ,label,avant:a,apres:b,numero:cle==='vinted_buyprice_by_num'?id:String(apres[id]?.numero||avant[id]?.numero||''),at});
 }return r.slice(-100);
}
export function noterChangements(storage,owner,cle,avant,apres){
 try{const n=changementsImportants(cle,avant,apres);if(!n.length)return false;const anciens=lireParcours(storage,owner,'modifications',[]);return garderParcours(storage,owner,'modifications',[...n.reverse(),...(Array.isArray(anciens)?anciens:[])].slice(0,100));}catch{return false;}
}
export const motifRecherche=par=>({pseudo:'Pseudo correspondant',suivi:'Numéro de suivi correspondant',code:'Code de retrait correspondant',transaction:'Transaction correspondante',numero:'Numéro VRM correspondant',titre:'Titre correspondant',title:'Titre correspondant'})[par]||'Correspondance de recherche';
export function periodeReutilisable(v){
 if(!v||!v.from||!v.to)return null;const a=new Date(v.from),b=new Date(v.to);return Number.isFinite(a.getTime())&&Number.isFinite(b.getTime())&&a<=b?{from:a.toISOString(),to:b.toISOString()}:null;
}
export function viderParcours(storage,garderOwner=null){try{for(let i=storage.length-1;i>=0;i--){const k=storage.key(i);if(k?.startsWith('vrm_parcours:')&&(!garderOwner||!k.startsWith(cleParcours(garderOwner,''))))storage.removeItem(k);}}catch{}}
export function restaurerVue(storage,owner,nom,initial){
 const v=lireParcours(storage,owner,'vue:'+nom);
 if(typeof initial==='string')return typeof v==='string'&&v.length<=2000?v:initial;
 if(typeof initial==='number')return Number.isFinite(v)&&v>=initial&&v<=10000?v:initial;
 if(initial===null&&nom.includes('periode')){const p=periodeReutilisable(v);return p?{from:new Date(p.from),to:new Date(p.to),...(typeof v.label==='string'?{label:v.label.slice(0,100)}:{})}:null;}
 return initial;
}
