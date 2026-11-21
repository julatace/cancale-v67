// Migrations 034 (facultative) et 035 (index des transactions) sur PostgreSQL
// JETABLE, jamais sur Supabase. Modèle : scripts/audit-confidentialite-sql.cjs.
// 035 : app_data synthétique à la forme de la vraie (owner, id, data, meta ; RLS de
// la 033 : une permissive + restrictives), 2 vendeurs × 6 000 transactions et
// 20 000 autres captures `harvest_` chacun. Les requêtes du code (mêmes motifs que
// PostgREST envoie) sont jouées en `authenticated` AVANT et APRÈS l'index :
// mêmes réponses, l'index est pris, moins de pages lues. 034 : rejouable, et la
// requête par owner garde un index (celui de la contrainte unique).
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync,execFileSync}=require('child_process');
const RACINE=path.join(__dirname,'..');
const candidats=[process.env.PG_BIN];
try{for(const v of fs.readdirSync('/usr/lib/postgresql'))candidats.push(`/usr/lib/postgresql/${v}/bin`);}catch(_){}
const BIN=candidats.find(d=>d&&['initdb','pg_ctl','postgres','psql'].every(n=>fs.existsSync(path.join(d,n))));
if(!BIN){console.error('PostgreSQL absent : audit NON exécuté (PG_BIN requis).');process.exit(1);}
let identite={};
if(process.getuid?.()===0){try{identite={uid:Number(execFileSync('id',['-u','postgres'])),gid:Number(execFileSync('id',['-g','postgres']))};}catch(_){console.error('Utilisateur postgres absent : audit NON exécuté.');process.exit(1);}}
const DIR=fs.mkdtempSync(path.join(os.tmpdir(),'vrm-index-sql-'));
if(identite.uid!==undefined)fs.chownSync(DIR,identite.uid,identite.gid);
const PORT=String(55000+process.pid%1000),base=['-h',DIR,'-p',PORT,'-U','postgres','-d','postgres','-X','-q','-At','-v','ON_ERROR_STOP=1'];
const serveur=(n,args)=>spawnSync(path.join(BIN,n),args,{encoding:'utf8',...identite});
let demarre=false,ok=0,ko=0;
const nettoyer=()=>{if(demarre){serveur('pg_ctl',['-D',DIR+'/data','-m','immediate','stop']);demarre=false;}fs.rmSync(DIR,{recursive:true,force:true});};
process.on('exit',nettoyer);process.on('SIGINT',()=>process.exit(1));process.on('SIGTERM',()=>process.exit(1));
const run=sql=>{const r=spawnSync(path.join(BIN,'psql'),base,{input:sql,encoding:'utf8',maxBuffer:64<<20});return{ok:r.status===0,out:(r.stdout||'').trim(),err:r.stderr||''};};
const Q=sql=>{const r=run(sql);if(!r.ok)throw Error(r.err);return r.out;};
const dit=(c,n)=>{c?ok++:ko++;console.log(`${c?'✅':'❌'} ${n}`);};
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const comme=u=>`set role authenticated;set "request.jwt.claim.sub"='${u}';`;
// Les requêtes du code, telles que PostgREST les écrit (like : `*`/`%25` → `%`).
const REQ={
 'transactions (App.jsx, Stats.jsx)':`select meta->>'id' from app_data where id like 'harvest_%_txn_%'`,
 'transactions d’un vendeur (ship-reminders, owner=eq.)':`select meta->>'id' from app_data where id like 'harvest_%_txn_%' and owner='${A}'`,
 'versements finalisés (extension, status=eq.450)':`select id from app_data where id like 'harvest_%_txn_%' and meta->>'status'='450'`,
 'par n° (ship-reminders, meta->>id=in.)':`select meta->>'status' from app_data where id like 'harvest_%_txn_%' and meta->>'id' = any('{9000017,9000042,123}')`,
};
function mesure(sql,role=comme(A)){
 const plan=JSON.parse(Q(role+`explain (analyze, buffers, format json) ${sql}`).split('\n').filter(Boolean).join(''))[0];
 const noeuds=[];(function f(n){noeuds.push(n['Index Name']||n['Node Type']);(n.Plans||[]).forEach(f);})(plan.Plan);
 const pages=(plan.Plan['Shared Hit Blocks']||0)+(plan.Plan['Shared Read Blocks']||0);
 return{noeuds,pages,ms:plan['Execution Time'],rep:Q(role+`select md5(coalesce(string_agg(x::text,',' order by x::text),'')) from (${sql}) s(x)`)};
}
try{
 let r=serveur('initdb',['-D',DIR+'/data','-U','postgres','--auth=trust','-E','UTF8','--locale=C','--no-sync']);if(r.status!==0)throw Error(r.stderr);
 r=serveur('pg_ctl',['-D',DIR+'/data','-o',`-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off`,'-l',DIR+'/journal','-w','start']);if(r.status!==0)throw Error(r.stderr);demarre=true;
 Q(`create schema auth;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create role anon;create role authenticated;grant usage on schema auth,public to anon,authenticated;
 create table app_data(owner uuid not null,id text not null,data jsonb,meta jsonb,updated_at timestamptz default now(),primary key(owner,id));
 grant select,insert,update,delete on app_data to authenticated;
 create index app_data_owner_id_prefixe on app_data (owner, id text_pattern_ops);
 create index app_data_id_motif on app_data (id text_pattern_ops);
 alter table app_data enable row level security;
 create function vrm_acces_ok() returns boolean language sql stable as $$ select true $$;
 create policy vrm_proprietaire_permis on app_data as permissive for all to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
 create policy abonnement_requis on app_data as restrictive for all to authenticated using (true) with check ((select vrm_acces_ok()));
 create policy vrm_lecture_privee on app_data as restrictive for select to authenticated using (owner = (select auth.uid()));
 create policy vrm_anon_ferme on app_data as restrictive for all to anon using (false) with check (false);`);
 for(const [o,uid] of [[A,'111'],[B,'222']]){
  // 6 000 transactions (statuts variés ; data volumineuse comme la vraie) + 20 000 autres captures harvest_.
  Q(`insert into app_data(owner,id,data,meta)
   select '${o}','harvest_${uid}_txn_'||(9000000+g), jsonb_build_object('payload',jsonb_build_object('transaction',jsonb_build_object('id',9000000+g,'status',(array[450,230,520,540])[1+g%4],'buyer',repeat('x',400)))),
          jsonb_build_object('id',(9000000+g)::text,'status',((array[450,230,520,540])[1+g%4])::text,'capturedAt','2026-11-01')
     from generate_series(1,6000) g;
   insert into app_data(owner,id,data,meta)
   select '${o}','harvest_${uid}_'||(array['items_','label_','suivi_','pickup_'])[1+g%4]||g, jsonb_build_object('payload',repeat('y',300)), jsonb_build_object('capturedAt','2026-11-01')
     from generate_series(1,20000) g;`);
 }
 Q('analyze app_data;');
 const avant={};for(const [n,sql] of Object.entries(REQ))avant[n]=mesure(sql);
 // La clé de service (ship-reminders) ne passe pas par RLS : owner=eq. explicite.
 const SERV={'serveur : transactions d’un vendeur (owner=eq.)':REQ['transactions d’un vendeur (ship-reminders, owner=eq.)'],'serveur : par n° (meta->>id=in., owner=eq.)':REQ['par n° (ship-reminders, meta->>id=in.)']+` and owner='${A}'`};
 for(const [n,sql] of Object.entries(SERV))avant[n]=mesure(sql,'');
 // La migration telle qu'écrite : hors transaction (CONCURRENTLY), seule.
 const m035=fs.readFileSync(path.join(RACINE,'supabase/migrations/035-index-transactions.sql'),'utf8');
 dit(run(m035).ok&&run(m035).ok,'035 : create index concurrently passe hors transaction, rejouable');
 dit(Q(`select indisvalid from pg_index where indexrelid='app_data_txn_owner'::regclass`)==='t','035 : index valide');
 dit(!run('begin;'+m035.replace('if not exists app_data_txn_owner','if not exists autre_nom')+'commit;').ok,'035 : dans une transaction, CONCURRENTLY est refusé (d’où le mode d’emploi)');
 Q('analyze app_data;');
 for(const [n,sql,role] of [...Object.entries(REQ).map(([n,s])=>[n,s,comme(A)]),...Object.entries(SERV).map(([n,s])=>[n,s,''])]){
  const ap=mesure(sql,role),av=avant[n];
  dit(ap.rep===av.rep,`${n} : mêmes réponses avant/après`);
  dit(ap.noeuds.includes('app_data_txn_owner'),`${n} : l’index est pris (${ap.noeuds.join(' > ')})`);
  dit(ap.pages<av.pages,`${n} : pages lues ${av.pages} → ${ap.pages} · ${av.ms.toFixed(1)} ms → ${ap.ms.toFixed(1)} ms`);
 }
 // Un autre vendeur ne voit toujours rien de A (l'index ne contourne pas RLS).
 dit(Q(comme(B)+`select count(*) from app_data where id like 'harvest_%_txn_%' and owner='${A}'`)==='0','035 : RLS inchangée (B ne lit aucune transaction de A)');

 // ── 034 : rejouable, et owner = … garde un index (la contrainte unique).
 Q(`create table vrm_ebay_titulaires(cle_ebay text primary key,owner uuid not null,compte text not null default '',constraint vrm_ebay_titulaires_libelle unique(owner,compte));
 create index vrm_ebay_titulaires_owner on vrm_ebay_titulaires(owner);
 create table vrm_agent_journal(id bigint generated always as identity primary key,owner uuid not null,at timestamptz not null default now(),cible text);
 create index vrm_agent_journal_owner_at on vrm_agent_journal(owner,at desc);create index vrm_agent_journal_owner_cible on vrm_agent_journal(owner,cible);
 insert into vrm_ebay_titulaires select lpad(to_hex(g),16,'0'),('00000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'c'||g from generate_series(1,5000) g;
 insert into vrm_agent_journal(owner,cible) select ('00000000-0000-4000-8000-'||lpad((g%50)::text,12,'0'))::uuid,'x'||g from generate_series(1,5000) g;analyze;`);
 const m034=fs.readFileSync(path.join(RACINE,'supabase/migrations/034-index-inutiles-facultatif.sql'),'utf8');
 dit(run(m034).ok&&run(m034).ok,'034 : drop index concurrently passe hors transaction, rejouable');
 const restants=Q(`select string_agg(indexname,',' order by indexname) from pg_indexes where tablename in ('vrm_ebay_titulaires','vrm_agent_journal')`);
 dit(restants==='vrm_agent_journal_owner_cible,vrm_agent_journal_pkey,vrm_ebay_titulaires_libelle,vrm_ebay_titulaires_pkey','034 : seuls les deux index visés partent ('+restants+')');
 const p1=Q(`explain select 1 from vrm_ebay_titulaires t where t.owner='00000000-0000-4000-8000-000000000007'`);
 const p2=Q(`explain delete from vrm_agent_journal x where x.owner='00000000-0000-4000-8000-000000000007'`);
 dit(/vrm_ebay_titulaires_libelle/.test(p1),'034 : titulaires par owner ⇒ index de la contrainte unique');
 dit(/vrm_agent_journal_owner_cible/.test(p2),'034 : effacement du journal d’un vendeur ⇒ index (owner, cible)');
}catch(e){ko++;console.error('❌ Audit interrompu : '+e.message);}
console.log(`\n${ok} contrôles SQL réussis, ${ko} échec(s). Base locale supprimée.`);process.exitCode=ko?1:0;
