import {sbCle} from './cle.js';
import {PROPRIETAIRE_NEUTRE} from './proprietaire-email.js';
import {modifierNeutre} from './neutre-cas.js';
import {initialiserFile} from './favoris-file.js';

// Queue rows live under the protected neutral owner. Closing a VRM account
// must erase its group there too, while preserving other owners and quota.
export async function effacerFavorisDe(owner){
  if(!/^[0-9a-f-]{36}$/i.test(owner||'')||!process.env.SUPABASE_SERVICE_KEY)return null;
  const base=process.env.SUPABASE_URL||'https://lgonxzrzjcqthjtbdpzo.supabase.co';let nombre=0;
  for(let page=0;page<50;page++){
    let rows;
    try{
      const r=await fetch(`${base}/rest/v1/app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=like.favoris_file_*&data->proprietaires=cs.${encodeURIComponent(JSON.stringify([owner]))}&select=id&limit=100`,{headers:sbCle(process.env.SUPABASE_SERVICE_KEY),signal:AbortSignal.timeout(12000)});
      if(!r.ok)return null;rows=await r.json();
    }catch{return null;}
    if(!Array.isArray(rows)||rows.some(x=>!/^favoris_file_[a-f0-9]{64}$/.test(x.id||'')))return null;
    for(const row of rows){
      const r=await modifierNeutre(row.id,d=>{
        d=initialiserFile(d);if(!d.groupes[owner])return {valeur:0};
        delete d.groupes[owner];d.proprietaires=Object.keys(d.groupes);if(d.enCours?.owner===owner)d.enCours=null;
        return {data:d,valeur:1};
      });
      if(!r)return null;nombre+=r.valeur;
    }
    if(rows.length<100)return nombre;
  }
  return null;
}
