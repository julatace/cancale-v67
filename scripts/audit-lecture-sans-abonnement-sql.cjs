// Migration 050 (25 nov., « lecture sans abonnement ») sur PostgreSQL JETABLE, jamais sur Supabase.
// Modèle : scripts/audit-politiques-uniques-sql.cjs.
// On rebâtit l'état de production (021 + 027 : sans abonnement on LIT, on n'écrit pas), puis
// on joue une MATRICE d'accès AVANT et APRÈS la VRAIE migration 050 :
//   · C (abonnement coupé) écrit SES lignes de capture (harvest_*, lbc_listings, vc_ventes…)
//     et relie un compte Vinted — AVANT : refusé ; APRÈS : permis ;
//   · C n'écrit toujours AUCUNE ligne de l'app (main, cmd_dist_*, vinted_cadence, coffre_*),
//     n'efface rien, n'écrit jamais chez autrui ;
//   · A (abonné), B, anonyme, identité absente : matrice IDENTIQUE avant/après ;
//   · la 050 refuse de s'appliquer sur une base où la 027 n'est pas passée (rien changé).
// Mutation : un WITH CHECK `true` sur app_data (tout ouvrir) DOIT rougir la matrice.
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync,execFileSync}=require('child_process');
const RACINE=process.env.AUDIT_RACINE||path.join(__dirname,'..');
const candidats=[process.env.PG_BIN];
try{for(const v of fs.readdirSync('/usr/lib/postgresql'))candidats.push(`/usr/lib/postgresql/${v}/bin`);}catch(_){}
const BIN=candidats.find(d=>d&&['initdb','pg_ctl','postgres','psql'].every(n=>fs.existsSync(path.join(d,n))));
if(!BIN){console.error('PostgreSQL absent : audit NON exécuté (PG_BIN requis).');process.exit(1);}
let identite={};
if(process.getuid?.()===0){try{identite={uid:Number(execFileSync('id',['-u','postgres'])),gid:Number(execFileSync('id',['-g','postgres']))};}catch(_){console.error('Utilisateur postgres absent : audit NON exécuté.');process.exit(1);}}
const DIR=fs.mkdtempSync(path.join(os.tmpdir(),'vrm-050-sql-'));
if(identite.uid!==undefined)fs.chownSync(DIR,identite.uid,identite.gid);
const PORT=String(55000+process.pid%1000);
const serveur=(n,args)=>spawnSync(path.join(BIN,n),args,{encoding:'utf8',...identite});
let demarre=false,ok=0,ko=0;
const nettoyer=()=>{if(demarre){serveur('pg_ctl',['-D',DIR+'/data','-m','immediate','stop']);demarre=false;}fs.rmSync(DIR,{recursive:true,force:true});};
process.on('exit',nettoyer);process.on('SIGINT',()=>process.exit(1));process.on('SIGTERM',()=>process.exit(1));
let BASE='postgres';
const run=(sql,db=BASE)=>{const r=spawnSync(path.join(BIN,'psql'),['-h',DIR,'-p',PORT,'-U','postgres','-d',db,'-X','-q','-At','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'});return{ok:r.status===0,out:(r.stdout||'').trim(),err:r.stderr||''};};
const Q=(sql,db)=>{const r=run(sql,db);if(!r.ok)throw Error(r.err);return r.out;};
const dit=(c,n,d)=>{c?ok++:ko++;console.log(`${c?'✅':'❌'} ${n}${d&&!c?' — '+d:''}`);};
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
const M021=fs.readFileSync(path.join(RACINE,'supabase/migrations/021-confidentialite-boutiques.sql'),'utf8');
const F050=path.join(RACINE,'supabase/migrations/050-lecture-sans-abonnement.sql');
const M050=fs.existsSync(F050)?fs.readFileSync(F050,'utf8'):'';
let nBase=0;
function batir({abo='027'}={}){
 const db='essai'+(++nBase);Q(`create database ${db}`,'postgres');BASE=db;
 Q(`create schema auth;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 do $r$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; create role authenticated; create role service_role; end if; end $r$;
 grant usage on schema auth,public to anon,authenticated;
 create table app_data(owner uuid not null,id text not null,data jsonb,primary key(owner,id));
 create table vinted_accounts(owner uuid not null,id text not null,data jsonb,primary key(owner,id));
 grant all on app_data,vinted_accounts to anon,authenticated;
 create table abonnes(owner uuid primary key);insert into abonnes values('${A}'),('${B}');
 create function public.vrm_acces_ok() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.abonnes a where a.owner=auth.uid()) $$;
 grant execute on function public.vrm_acces_ok() to authenticated;
 alter table app_data enable row level security;alter table vinted_accounts enable row level security;
 create policy "chacun ses lignes" on app_data using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
 create policy "chacun ses comptes" on vinted_accounts using (owner = (select auth.uid())) with check (owner = (select auth.uid()));`);
 for(const t of ['app_data','vinted_accounts']){
  Q(abo==='006'
   ?`create policy abonnement_requis on ${t} as restrictive for all to authenticated using ((select vrm_acces_ok())) with check ((select vrm_acces_ok()));`
   :`create policy abonnement_requis on ${t} as restrictive for all to authenticated using (true) with check ((select vrm_acces_ok()));
     create policy abonnement_requis_effacer on ${t} as restrictive for delete to authenticated using ((select vrm_acces_ok()));`);
 }
 for(const u of [A,B,C])Q(`insert into app_data values('${u}','main','{}'),('${u}','harvest_99_listings','{}'),('${u}','lbc_listings','{}');insert into vinted_accounts values('${u}','99','{}');`);
 Q(M021);
 return db;
}
const acteurs={A,B,C,anon:'anon',vide:''};
function comme(a){return a==='anon'?`set local role anon;`:`set local role authenticated;set local "request.jwt.claim.sub"='${acteurs[a]}';`;}
function op(a,sql){const r=run(`begin;${comme(a)}${sql};rollback;`);return r.ok?(r.out.split('\n').pop()||'∅'):'REFUS';}
const IDS_CAPTURE=['harvest_12345_orders_sold','harvest_12345_txn_987654','harvest_12345_label_987654','lbc_listings','vc_ventes','vc_label_ab12'];
const IDS_APP=['main','cmd_dist_42','vinted_cadence','coffre_12345','vrm_reglages_auto','harvest_'];
function matrice(){
 const l=[];
 for(const a of Object.keys(acteurs)){
  const moi=acteurs[a]&&acteurs[a]!=='anon'?acteurs[a]:A;
  for(const [cible,u] of [['soi',moi],['B',B]]){
   for(const id of [...IDS_CAPTURE,...IDS_APP])l.push([a,cible,'inserer',id,op(a,`with x as(insert into app_data values('${u}','${id}','{}') on conflict(owner,id) do update set data=excluded.data returning 1) select count(*) from x`)]);
   l.push([a,cible,'modifier','harvest_99_listings',op(a,`with x as(update app_data set data='{"m":1}' where owner='${u}' and id='harvest_99_listings' returning 1) select count(*) from x`)]);
   l.push([a,cible,'modifier','main',op(a,`with x as(update app_data set data='{"m":1}' where owner='${u}' and id='main' returning 1) select count(*) from x`)]);
   l.push([a,cible,'effacer','harvest_99_listings',op(a,`with x as(delete from app_data where owner='${u}' and id='harvest_99_listings' returning 1) select count(*) from x`)]);
   l.push([a,cible,'lire','*',op(a,`select count(*) from app_data where owner='${u}'`)]);
   l.push([a,cible,'relier','vinted',op(a,`with x as(insert into vinted_accounts values('${u}','777','{}') on conflict(owner,id) do update set data=excluded.data returning 1) select count(*) from x`)]);
   l.push([a,cible,'modifier','vinted',op(a,`with x as(update vinted_accounts set data='{"t":1}' where owner='${u}' returning 1) select count(*) from x`)]);
   l.push([a,cible,'effacer','vinted',op(a,`with x as(delete from vinted_accounts where owner='${u}' returning 1) select count(*) from x`)]);
  }
 }
 return l;
}
const v=(m,a,c,o,id)=>(m.find(x=>x[0]===a&&x[1]===c&&x[2]===o&&x[3]===id)||[])[4];
try{
 let r=serveur('initdb',['-D',DIR+'/data','-U','postgres','--auth=trust','-E','UTF8','--locale=C','--no-sync']);if(r.status!==0)throw Error(r.stderr);
 r=serveur('pg_ctl',['-D',DIR+'/data','-o',`-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off`,'-l',DIR+'/journal','-w','start']);if(r.status!==0)throw Error(r.stderr);demarre=true;
 dit(!!M050,'la migration 050 existe (supabase/migrations/050-lecture-sans-abonnement.sql)');
 batir();
 const avant=matrice();
 // L'état de départ (027) : C lit, n'écrit RIEN (c'est ce qui bloquait la lecture de l'extension).
 dit(v(avant,'C','soi','lire','*')==='3'&&v(avant,'C','soi','inserer','harvest_12345_orders_sold')==='REFUS'&&v(avant,'C','soi','relier','vinted')==='REFUS','départ (027) : C lit ses lignes, mais sa capture et sa liaison sont REFUSÉES',JSON.stringify(avant.filter(x=>x[0]==='C'&&x[1]==='soi').slice(0,3)));
 const rr=run(M050);
 dit(rr.ok&&/vrm_050 : OK/.test(rr.err),'la 050 passe en entier (contrôle interne OK)',rr.err.slice(0,300));
 const apres=matrice();
 for(const id of IDS_CAPTURE)dit(v(apres,'C','soi','inserer',id)==='1',`après : C (sans abonnement) range « ${id} »`,v(apres,'C','soi','inserer',id));
 dit(v(apres,'C','soi','modifier','harvest_99_listings')==='1','après : C met à jour sa capture (upsert d’une moisson)',v(apres,'C','soi','modifier','harvest_99_listings'));
 dit(v(apres,'C','soi','relier','vinted')==='1'&&v(apres,'C','soi','modifier','vinted')==='1','après : C relie son compte Vinted (jetons rangés à SON nom)');
 for(const id of IDS_APP)dit(v(apres,'C','soi','inserer',id)==='REFUS',`après : C n’écrit toujours PAS « ${id} » (ligne de l’app)`,v(apres,'C','soi','inserer',id));
 dit(v(apres,'C','soi','modifier','main')==='REFUS','après : C ne modifie pas main');
 dit(v(apres,'C','soi','effacer','harvest_99_listings')==='0'&&v(apres,'C','soi','effacer','vinted')==='0','après : C n’efface rien (capture ni compte)');
 dit([...IDS_CAPTURE,'main'].every(id=>v(apres,'C','B','inserer',id)==='REFUS')&&v(apres,'C','B','relier','vinted')==='REFUS'&&v(apres,'C','B','lire','*')==='0','après : C n’écrit ni ne lit RIEN chez B');
 const autres=apres.filter(x=>x[0]!=='C');
 const diff=autres.filter(x=>v(avant,x[0],x[1],x[2],x[3])!==x[4]);
 dit(diff.length===0,`après : A, B, anonyme, identité absente — matrice IDENTIQUE (${autres.length} accès)`,diff.slice(0,4).map(x=>x.join('|')).join(' ; '));
 const diffC=apres.filter(x=>x[0]==='C'&&v(avant,x[0],x[1],x[2],x[3])!==x[4]).map(x=>x[2]+':'+x[3]);
 dit(diffC.every(k=>/^(inserer:(harvest_12345|lbc_|vc_)|modifier:(harvest_99|vinted)|relier:vinted)/.test(k)),'après : pour C, SEULS changent la capture et la liaison',diffC.join(', '));
 // Rejouée : la 027 n'est plus « telle quelle », mais USING reste true ⇒ elle repasse sans rien changer.
 const r2=run(M050);dit(r2.ok&&JSON.stringify(matrice())===JSON.stringify(apres),'rejouée une 2e fois : rien ne bouge');
 // Sur une base où la 027 n'est pas passée (006) : refus, rien changé.
 batir({abo:'006'});
 const pol=Q(`select string_agg(policyname||':'||coalesce(with_check,''),';' order by policyname) from pg_policies where tablename='app_data'`);
 const r3=run(M050);
 dit(!r3.ok&&/027/.test(r3.err)&&Q(`select string_agg(policyname||':'||coalesce(with_check,''),';' order by policyname) from pg_policies where tablename='app_data'`)===pol&&Q(`select count(*) from pg_proc where proname='vrm_ligne_capture'`)==='0','027 pas passée : la 050 s’arrête, rien n’est changé',r3.err.slice(0,200));
 // Mutation : tout ouvrir (with check true sur app_data) DOIT se voir.
 batir();Q(M050);Q(`alter policy abonnement_requis on app_data with check (true);`);
 const mut=matrice();
 dit(v(mut,'C','soi','inserer','main')==='1','mutation (WITH CHECK true) : main passerait sans abonnement — le contrôle ci-dessus l’aurait vu (le banc sait échouer)');
}catch(e){ko++;console.error('❌ Audit interrompu : '+e.message);}
console.log(`\n${ok} contrôles SQL réussis, ${ko} échec(s). Base locale supprimée.`);process.exitCode=ko?1:0;
