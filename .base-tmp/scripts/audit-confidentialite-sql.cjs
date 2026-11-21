// Exécute la migration 021 sur PostgreSQL JETABLE, jamais sur Supabase.
// Deux vendeurs synthétiques, deux tables et des politiques permissives trop
// larges : les verrous restrictifs doivent encore bloquer les accès croisés.
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync,execFileSync}=require('child_process');
const RACINE=path.join(__dirname,'..');
const candidats=[process.env.PG_BIN];
try{for(const v of fs.readdirSync('/usr/lib/postgresql'))candidats.push(`/usr/lib/postgresql/${v}/bin`);}catch(_){}
const BIN=candidats.find(d=>d&&['initdb','pg_ctl','postgres','psql'].every(n=>fs.existsSync(path.join(d,n))));
if(!BIN){console.error('PostgreSQL absent : audit NON exécuté (PG_BIN requis).');process.exit(1);}
let identite={};
if(process.getuid?.()===0){try{identite={uid:Number(execFileSync('id',['-u','postgres'])),gid:Number(execFileSync('id',['-g','postgres']))};}catch(_){console.error('Utilisateur postgres absent : audit NON exécuté.');process.exit(1);}}
const DIR=fs.mkdtempSync(path.join(os.tmpdir(),'vrm-confidentialite-sql-'));
if(identite.uid!==undefined)fs.chownSync(DIR,identite.uid,identite.gid);
const PORT=String(53000+process.pid%1000),base=['-h',DIR,'-p',PORT,'-U','postgres','-d','postgres','-X','-q','-At','-v','ON_ERROR_STOP=1'];
const serveur=(n,args)=>spawnSync(path.join(BIN,n),args,{encoding:'utf8',...identite});
let demarre=false,ok=0,ko=0;
const nettoyer=()=>{if(demarre){serveur('pg_ctl',['-D',DIR+'/data','-m','immediate','stop']);demarre=false;}fs.rmSync(DIR,{recursive:true,force:true});};
process.on('exit',nettoyer);process.on('SIGINT',()=>process.exit(1));process.on('SIGTERM',()=>process.exit(1));
const run=sql=>{const r=spawnSync(path.join(BIN,'psql'),base,{input:sql,encoding:'utf8'});return{ok:r.status===0,out:(r.stdout||'').trim(),err:r.stderr||''};};
const Q=sql=>{const r=run(sql);if(!r.ok)throw Error(r.err);return r.out;};
const dit=(c,n)=>{c?ok++:ko++;console.log(`${c?'✅':'❌'} ${n}`);};
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const comme=u=>`set role authenticated;set "request.jwt.claim.sub"='${u}';`;
try{
 let r=serveur('initdb',['-D',DIR+'/data','-U','postgres','--auth=trust','-E','UTF8','--locale=C','--no-sync']);if(r.status!==0)throw Error(r.stderr);
 r=serveur('pg_ctl',['-D',DIR+'/data','-o',`-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off`,'-l',DIR+'/journal','-w','start']);if(r.status!==0)throw Error(r.stderr);demarre=true;
 Q(`create schema auth;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create role anon;create role authenticated;grant usage on schema auth,public to anon,authenticated;
 create table app_data(owner uuid not null,id text not null,data jsonb,primary key(owner,id));
 create table vinted_accounts(owner uuid not null,id text not null,data jsonb,primary key(owner,id));
 grant all on app_data,vinted_accounts to anon,authenticated;`);
 for(const t of ['app_data','vinted_accounts'])Q(`create policy ancienne_trop_large on ${t} for all to authenticated,anon using(true) with check(true);
 insert into ${t} values('${A}','principal','{"vendeur":"A"}'),('${B}','principal','{"vendeur":"B"}');`);
 const migration=fs.readFileSync(path.join(RACINE,'supabase/migrations/021-confidentialite-boutiques.sql'),'utf8');Q(migration);Q(migration);
 dit(true,'migration 021 applicable deux fois sans perte');
 for(const t of ['app_data','vinted_accounts']){
  for(const [u,v] of [[A,B],[B,A]]){
   const prefix=comme(u),nom=`${t}, vendeur ${u===A?'A':'B'}`;
   dit(Q(prefix+`select count(*) from ${t}`)==='1',nom+' : une seule ligne visible, malgré la politique large');
   dit(Q(prefix+`select count(*) from ${t} where owner='${v}'`)==='0',nom+' : lecture explicite étrangère vide');
   dit(!run(prefix+`insert into ${t} values('${v}','injection','{}')`).ok,nom+' : insertion chez autrui refusée');
   dit(Q(prefix+`with x as(update ${t} set data='{}' where owner='${v}' returning *)select count(*) from x`)==='0',nom+' : modification étrangère sans effet');
   dit(!run(prefix+`update ${t} set owner='${v}' where owner='${u}'`).ok,nom+' : changement de propriétaire refusé');
   dit(Q(prefix+`with x as(delete from ${t} where owner='${v}' returning *)select count(*) from x`)==='0',nom+' : suppression étrangère sans effet');
   dit(run(prefix+`insert into ${t} values('${u}','nouveau','{}');update ${t} set data='{"ok":true}' where id='nouveau';delete from ${t} where id='nouveau';`).ok,nom+' : ses propres écritures fonctionnent');
  }
  dit(Q(`set role anon;select count(*) from ${t}`)==='0',t+' : lecture anonyme vide');
  dit(!run(`set role anon;insert into ${t} values('${A}','anon','{}')`).ok,t+' : écriture anonyme refusée');
  for(const droit of ['TRUNCATE','TRIGGER','REFERENCES'])dit(Q(`select has_table_privilege('authenticated','${t}','${droit}')`)==='f',t+' : droit '+droit+' révoqué');
  dit(Q(comme('')+`select count(*) from ${t}`)==='0',t+' : identité absente, aucune ligne');
 }
 Q(`create policy abonnement_test on app_data as restrictive for all to authenticated using(false) with check(false);`);
 dit(Q(comme(A)+'select count(*) from app_data')==='0','restriction d’abonnement conservée et prioritaire');
 Q('drop policy abonnement_test on app_data');
 // Branche équipe : seule la ligne explicitement autorisée est lisible ;
 // aucune écriture sur la boutique déléguée n'est ajoutée par la migration.
 Q(`create function vrm_equipe_vendeur() returns uuid language sql stable as $$select '${B}'::uuid$$;
 create function vrm_equipe_id_permis(text) returns boolean language sql stable as $$select $1='partage'$$;
 create policy equipe_lit on app_data for select to authenticated using(owner=vrm_equipe_vendeur() and vrm_equipe_id_permis(id));
 insert into app_data values('${B}','partage','{}');`);Q(migration);
 dit(Q(comme(A)+`select count(*) from app_data where owner='${B}'`) === '1','équipe : seule la ligne autorisée est visible');
 dit(Q(comme(A)+`select count(*) from vinted_accounts where owner='${B}'`) === '0','équipe : aucun accès aux comptes Vinted de l’autre');
 dit(Q(comme(A)+`with x as(update app_data set data='{}' where owner='${B}' returning *)select count(*) from x`)==='0','équipe : aucune écriture déléguée accordée par ce verrou');
}catch(e){ko++;console.error('❌ Audit interrompu : '+e.message);}
console.log(`\n${ok} contrôles SQL réussis, ${ko} échec(s). Base locale supprimée.`);process.exitCode=ko?1:0;
