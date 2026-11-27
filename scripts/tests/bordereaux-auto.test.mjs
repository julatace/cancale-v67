import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync('vinted-sync-extension/background.js','utf8');
// 5.410.4 : `bordereauxAutoActifs(uid)` lit d'abord SON réglage « Après-vente · bordereau » de CE compte
// (`bordereauAutoCompte`, réel, tiré du même fichier), puis la ligne VRM `vrm_bordereaux_auto`.
function extraire(debut,fin){const a=source.indexOf(debut),b=source.indexOf(fin,a);assert.ok(a>=0&&b>a,'fonction introuvable : '+debut);return source.slice(a,b);}
const fonction=extraire('async function bordereauxAutoActifs(uid)','async function genererBordereauxEnAttente(')+'\n'+extraire('async function bordereauAutoCompte(uid)','async function depotBordereau(');
async function verifier({session={access_token:'session',user_id:'vendeur'},rows=[],status=200,panne=false,uid,reglages={}}={}){
 let appels=0;const lus=[];
 const contexte=vm.createContext({authToken:async()=>session,SUPABASE_URL:'https://base.test',SUPABASE_KEY:'publique',encodeURIComponent,
  bleamCompte:async(u)=>{lus.push(u);const r=reglages[u];if(r instanceof Error)throw r;return r===undefined?null:r;},
  fetch:async(url,opts)=>{appels++;assert.match(url,/owner=eq.vendeur/);assert.equal(opts.headers.Authorization,'Bearer session');if(panne)throw Error();return {ok:status===200,json:async()=>rows};}});
 vm.runInContext(fonction,contexte);return {active:await contexte.bordereauxAutoActifs(uid),appels,lus};
}
test('absent, faux, texte vrai, panne ou plusieurs lignes : génération coupée',async()=>{for(const config of [{},{rows:[{data:{active:false}}]},{rows:[{data:{active:'true'}}]},{panne:true},{status:503},{rows:[{data:{active:true}},{data:{active:true}}]}])assert.equal((await verifier(config)).active,false);});
test('seule une activation explicite lue avec la session du vendeur permet de générer',async()=>{assert.equal((await verifier({rows:[{data:{active:true}}]})).active,true);assert.deepEqual(await verifier({session:null}),{active:false,appels:0,lus:[]});});
test('réglage du compte : seul actif === true de CE compte allume, sans relire VRM ; sinon la ligne VRM décide',async()=>{
 const a=await verifier({uid:42,reglages:{'42':{bordereau:{actif:true}}}});assert.deepEqual([a.active,a.appels,a.lus],[true,0,['42']]);
 for(const r of [undefined,{},{bordereau:{actif:'true'}},{bordereau:{actif:1}},{bordereau:{actif:false}},new Error('panne')]){
  assert.equal((await verifier({uid:42,reglages:{'42':r}})).active,false);
  assert.equal((await verifier({uid:42,reglages:{'42':r},rows:[{data:{active:true}}]})).active,true);}
 assert.equal((await verifier({uid:42,reglages:{'7':{bordereau:{actif:true}}}})).active,false,'le réglage d’un AUTRE compte ne compte pas');
});
test('contrôle à la frontière de mutation automatique ; commande manuelle conservée',()=>{assert.match(source,/if \(opts\.automatique && !\(await bordereauxAutoActifs\(uid\)\)\) return/);assert.match(source,/genererBordereau\(uid, tx, \{ automatique: true \}\)/);assert.match(source,/genererBordereau\(uid, tx, \{ gardeFaite: true \}\)/);});
