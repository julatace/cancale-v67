import test from 'node:test';import assert from 'node:assert/strict';
import {preuveRecuperation} from '../../public/recuperation.js';
import {configurationAuthPublique} from '../../api/_lib/auth-public.js';
const jwt=role=>'a.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.c';
test('une récupération fonctionne depuis le fragment ou un ancien lien Supabase, sans naviguer vers son domaine',()=>{
 assert.deepEqual(preuveRecuperation('https://vrm.center/recuperation.html#type=recovery&token_hash=abcdefghijklmnopqrstuvwxyz'),{token_hash:'abcdefghijklmnopqrstuvwxyz'});
 assert.deepEqual(preuveRecuperation('https://projet.supabase.co/auth/v1/verify?type=recovery&token=abcdefghijklmnopqrstuvwxyz'),{token_hash:'abcdefghijklmnopqrstuvwxyz'});
 assert.equal(preuveRecuperation('http://localhost:3000/#type=recovery&access_token=header.payload.signature')?.access_token,'header.payload.signature');
 for(const s of ['https://evil.test/#type=signup&token_hash=abcdefghijklmnopqrstuvwxyz','javascript:alert(1)','https://vrm.center/#type=recovery&access_token=nonvalide','https://vrm.center/#type=recovery&token_hash=<script>'])assert.equal(preuveRecuperation(s),null);
});
test('la configuration publique ne divulgue jamais une clé de service',()=>{
 assert.equal(configurationAuthPublique('https://projet.supabase.co',jwt('anon')).cle,jwt('anon'));
 for(const k of [jwt('service_role'),'sb_secret_ne-jamais-publier','cle-invalide'])assert.equal(configurationAuthPublique('https://projet.supabase.co',k),null);
 for(const u of ['http://projet.supabase.co','https://projet.supabase.co.evil.test','https://user:pass@projet.supabase.co','https://projet.supabase.co/chemin'])assert.equal(configurationAuthPublique(u,jwt('anon')),null);
});
