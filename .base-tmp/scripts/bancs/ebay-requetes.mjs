import assert from 'node:assert/strict';
import {appelerEbay} from '../../src/ebayRequetes.js';
import {lireReponseIncertaine,marquerReponseIncertaine} from '../../src/ebayEtatIncertain.js';
const headers=()=>({Authorization:'test'});
let calls=0;
const reponse=(body,status=200)=>async()=>{calls++;return {ok:status<400,status,json:async()=>body};};
assert.equal((await appelerEbay('messages',{},headers,{fetcher:reponse({ok:true,messages:[]})})).ok,true);
for(const [write,reason] of [[false,'lecture'],[true,'incertain']]){
 await assert.rejects(appelerEbay('repondre',{},headers,{write,fetcher:async()=>({ok:false,status:502,json:async()=>{throw new SyntaxError('HTML');}})}),e=>e.reason===reason);
 await assert.rejects(appelerEbay('repondre',{},headers,{write,fetcher:async()=>{throw new TypeError('réseau');}}),e=>e.reason===reason);
}
await assert.rejects(appelerEbay('repondre',{},headers,{write:true,fetcher:reponse({ok:false,error:'Erreur passerelle'},502)}),e=>e.reason==='incertain');
await assert.rejects(appelerEbay('repondre',{},headers,{write:true,fetcher:reponse({ok:false,error:'Refus confirmé'},409)}),e=>e.message==='Refus confirmé' && !e.reason);
await assert.rejects(appelerEbay('repondre',{},headers,{write:true,fetcher:reponse({autre:true})}),e=>e.reason==='incertain');
const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
assert.equal(marquerReponseIncertaine('A','principal','1',true,storage),true);
assert.equal(lireReponseIncertaine('A','principal','1',storage),true);
assert.equal(lireReponseIncertaine('B','principal','1',storage),false);
assert.equal(lireReponseIncertaine('A','secondaire','1',storage),false);
assert.equal(lireReponseIncertaine('A','principal','2',storage),false);
marquerReponseIncertaine('A','principal','1',false,storage);assert.equal(lireReponseIncertaine('A','principal','1',storage),false);
console.log('14 contrôles : réponses illisibles, résultats incertains, refus et isolation des états.');
