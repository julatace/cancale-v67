import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync('vinted-sync-extension/background.js','utf8');
const fonction=source.slice(source.indexOf('async function bordereauxAutoActifs()'),source.indexOf('async function genererBordereauxEnAttente('));
async function verifier({session={access_token:'session',user_id:'vendeur'},rows=[],status=200,panne=false}={}){
 let appels=0;
 const contexte=vm.createContext({authToken:async()=>session,SUPABASE_URL:'https://base.test',SUPABASE_KEY:'publique',encodeURIComponent,fetch:async(url,opts)=>{appels++;assert.match(url,/owner=eq.vendeur/);assert.equal(opts.headers.Authorization,'Bearer session');if(panne)throw Error();return {ok:status===200,json:async()=>rows};}});
 vm.runInContext(fonction,contexte);return {active:await contexte.bordereauxAutoActifs(),appels};
}
test('absent, faux, texte vrai, panne ou plusieurs lignes : génération coupée',async()=>{for(const config of [{},{rows:[{data:{active:false}}]},{rows:[{data:{active:'true'}}]},{panne:true},{status:503},{rows:[{data:{active:true}},{data:{active:true}}]}])assert.equal((await verifier(config)).active,false);});
test('seule une activation explicite lue avec la session du vendeur permet de générer',async()=>{assert.equal((await verifier({rows:[{data:{active:true}}]})).active,true);assert.deepEqual(await verifier({session:null}),{active:false,appels:0});});
test('contrôle à la frontière de mutation automatique ; commande manuelle conservée',()=>{assert.match(source,/if \(opts\.automatique && !\(await bordereauxAutoActifs\(\)\)\) return/);assert.match(source,/genererBordereau\(uid, tx, \{ automatique: true \}\)/);assert.match(source,/genererBordereau\(uid, tx, \{ gardeFaite: true \}\)/);});
