import test from 'node:test';import assert from 'node:assert/strict';
import {preuveRecuperation,erreurRecuperation,requeteRecuperation} from '../../public/recuperation.js';
import {configurationAuthPublique} from '../../api/_lib/auth-public.js';
const jwt=role=>'a.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.c';
test('une récupération fonctionne depuis le fragment ou un ancien lien Supabase, sans naviguer vers son domaine',()=>{
 assert.deepEqual(preuveRecuperation('https://vrm.center/recuperation.html#type=recovery&token_hash=abcdefghijklmnopqrstuvwxyz'),{token_hash:'abcdefghijklmnopqrstuvwxyz'});
 assert.deepEqual(preuveRecuperation('https://projet.supabase.co/auth/v1/verify?type=recovery&token=abcdefghijklmnopqrstuvwxyz'),{token_hash:'abcdefghijklmnopqrstuvwxyz'});
 assert.equal(preuveRecuperation('http://localhost:3000/#type=recovery&access_token=header.payload.signature')?.access_token,'header.payload.signature');
 for(const s of ['https://evil.test/#type=signup&token_hash=abcdefghijklmnopqrstuvwxyz','javascript:alert(1)','https://vrm.center/#type=recovery&access_token=nonvalide','https://vrm.center/#type=recovery&token_hash=<script>'])assert.equal(preuveRecuperation(s),null);
});
test('panne, quota et réponse incomplète ne déclarent jamais un lien expiré',()=>{
 for(const r of [{status:503,ok:false},{status:429,ok:false},{status:200,ok:true,json:{}}]){
  assert.doesNotMatch(erreurRecuperation(r),/expiré|déjà été utilisé/);
 }
 assert.match(erreurRecuperation({status:403,ok:false,json:{error_code:'otp_expired'}}),/expiré/);
 assert.match(erreurRecuperation({status:503,ok:false},'enregistrement'),/pas confirmé/);
 assert.match(erreurRecuperation({status:200,ok:true},'enregistrement'),/pas confirmé/);
});
test('délai de récupération sans AbortSignal.timeout, sans réessai automatique',async()=>{
 let appels=0;
 await assert.rejects(requeteRecuperation('https://exemple.test',{},async(_,opt)=>{
  appels++;return new Promise((_,reject)=>opt.signal.addEventListener('abort',()=>reject(Object.assign(Error('délai'),{name:'AbortError'}))));
 },5),{name:'AbortError'});
 assert.equal(appels,1);
 const r=await requeteRecuperation('https://exemple.test',{},async()=>Response.json({id:'fictif'}));
 assert.equal(r.status,200);assert.equal(r.json.id,'fictif');
});
test('la configuration publique ne divulgue jamais une clé de service',()=>{
 assert.equal(configurationAuthPublique('https://projet.supabase.co',jwt('anon')).cle,jwt('anon'));
 for(const k of [jwt('service_role'),'sb_secret_ne-jamais-publier','cle-invalide'])assert.equal(configurationAuthPublique('https://projet.supabase.co',k),null);
 for(const u of ['http://projet.supabase.co','https://projet.supabase.co.evil.test','https://user:pass@projet.supabase.co','https://projet.supabase.co/chemin'])assert.equal(configurationAuthPublique(u,jwt('anon')),null);
});
