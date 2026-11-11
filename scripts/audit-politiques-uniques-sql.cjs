// Migration 033 (une permissive par table) sur PostgreSQL JETABLE, jamais sur Supabase.
// Modèle : scripts/audit-confidentialite-sql.cjs.
// On rebâtit l'état de production DÉCRIT par l'assistant Supabase (11 nov.) :
// permissives en double + toutes les restrictives (006/027, 021), puis on joue une
// MATRICE d'accès (vendeurs A et B abonnés, C abonnement expiré, anonyme,
// identité absente ; lire, insérer, modifier, changer de propriétaire, effacer,
// chez soi et chez autrui) AVANT et APRÈS la migration : elle doit être identique.
// Variantes : abonnement 006 (expiré ne lit rien) et 027 (expiré lit, n'écrit pas),
// avec et sans la permissive équipe (016). Mutations : une migration qui retire
// AUSSI vrm_proprietaire_permis doit être vue (matrice différente) ; une
// permissive plus large (using true) doit faire tout refuser par la 033.
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync,execFileSync}=require('child_process');
const RACINE=path.join(__dirname,'..');
const candidats=[process.env.PG_BIN];
try{for(const v of fs.readdirSync('/usr/lib/postgresql'))candidats.push(`/usr/lib/postgresql/${v}/bin`);}catch(_){}
const BIN=candidats.find(d=>d&&['initdb','pg_ctl','postgres','psql'].every(n=>fs.existsSync(path.join(d,n))));
if(!BIN){console.error('PostgreSQL absent : audit NON exécuté (PG_BIN requis).');process.exit(1);}
let identite={};
if(process.getuid?.()===0){try{identite={uid:Number(execFileSync('id',['-u','postgres'])),gid:Number(execFileSync('id',['-g','postgres']))};}catch(_){console.error('Utilisateur postgres absent : audit NON exécuté.');process.exit(1);}}
const DIR=fs.mkdtempSync(path.join(os.tmpdir(),'vrm-politiques-sql-'));
if(identite.uid!==undefined)fs.chownSync(DIR,identite.uid,identite.gid);
const PORT=String(54000+process.pid%1000);
const serveur=(n,args)=>spawnSync(path.join(BIN,n),args,{encoding:'utf8',...identite});
let demarre=false,ok=0,ko=0;
const nettoyer=()=>{if(demarre){serveur('pg_ctl',['-D',DIR+'/data','-m','immediate','stop']);demarre=false;}fs.rmSync(DIR,{recursive:true,force:true});};
process.on('exit',nettoyer);process.on('SIGINT',()=>process.exit(1));process.on('SIGTERM',()=>process.exit(1));
let BASE='postgres';
const run=(sql,db=BASE)=>{const r=spawnSync(path.join(BIN,'psql'),['-h',DIR,'-p',PORT,'-U','postgres','-d',db,'-X','-q','-At','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'});return{ok:r.status===0,out:(r.stdout||'').trim(),err:r.stderr||''};};
const Q=(sql,db)=>{const r=run(sql,db);if(!r.ok)throw Error(r.err);return r.out;};
const dit=(c,n)=>{c?ok++:ko++;console.log(`${c?'✅':'❌'} ${n}`);};
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
const M033=fs.readFileSync(path.join(RACINE,'supabase/migrations/033-politiques-uniques.sql'),'utf8');
const M021=fs.readFileSync(path.join(RACINE,'supabase/migrations/021-confidentialite-boutiques.sql'),'utf8');
let nBase=0;
// Une base neuve, dans l'état de production décrit (variante d'abonnement, équipe ou non).
function batir({abo,equipe,large}){
 const db='essai'+(++nBase);Q(`create database ${db}`,'postgres');BASE=db;
 Q(`create schema auth;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 do $r$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; create role authenticated; end if; end $r$;
 grant usage on schema auth,public to anon,authenticated;
 create table app_data(owner uuid not null,id text not null,data jsonb,primary key(owner,id));
 create table vinted_accounts(owner uuid not null,id text not null,data jsonb,primary key(owner,id));
 grant all on app_data,vinted_accounts to anon,authenticated;
 create table abonnes(owner uuid primary key);insert into abonnes values('${A}'),('${B}');
 create function vrm_acces_ok() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.abonnes a where a.owner=auth.uid()) $$;
 grant execute on function vrm_acces_ok() to authenticated;
 alter table app_data enable row level security;alter table vinted_accounts enable row level security;
 -- 002 (sans TO : rôle public) puis 004 (select auth.uid())
 create policy "chacun ses lignes" on app_data using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
 create policy tout_select on app_data for select using (owner = (select auth.uid()));
 create policy tout_insert on app_data for insert with check (owner = (select auth.uid()));
 create policy tout_update on app_data for update using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
 create policy "chacun ses comptes" on vinted_accounts using (owner = (select auth.uid())) with check (owner = (select auth.uid()));`);
 for(const t of ['app_data','vinted_accounts']){
  Q(abo==='006'
   ?`create policy abonnement_requis on ${t} as restrictive for all to authenticated using ((select vrm_acces_ok())) with check ((select vrm_acces_ok()));`
   :`create policy abonnement_requis on ${t} as restrictive for all to authenticated using (true) with check ((select vrm_acces_ok()));
     create policy abonnement_requis_effacer on ${t} as restrictive for delete to authenticated using ((select vrm_acces_ok()));`);
  Q(`insert into ${t} values('${A}','principal','{"v":"A"}'),('${A}','second','{}'),('${B}','principal','{"v":"B"}'),('${C}','principal','{"v":"C"}');`);
 }
 if(equipe){ // 016 : B a invité A comme aide ; A lit la ligne « partage » de B.
  Q(`create function vrm_equipe_vendeur() returns uuid language sql stable as $$ select case when auth.uid()='${A}' then '${B}'::uuid end $$;
  create function vrm_equipe_id_permis(text) returns boolean language sql stable as $$ select $1='partage' $$;
  create policy equipe_lit on app_data for select to authenticated using (owner = (select vrm_equipe_vendeur()) and vrm_equipe_id_permis(id));
  insert into app_data values('${B}','partage','{}');`);
 }
 Q(M021); // vrm_anon_ferme, vrm_proprietaire_permis, vrm_*_privee (la vraie migration)
 if(large)Q(`create policy trop_large on app_data for select to authenticated using (true);`);
 return db;
}
const acteurs={A,B,C,anon:'anon',vide:''};
function comme(a){return a==='anon'?`set local role anon;`:`set local role authenticated;set local "request.jwt.claim.sub"='${acteurs[a]}';`;}
// Une opération dans une transaction annulée : l'état reste le même pour la suivante.
function op(a,sql){const r=run(`begin;${comme(a)}${sql};rollback;`);return r.ok?(r.out.split('\n').pop()||'∅'):'REFUS';}
function matrice(){
 const lignes=[];
 for(const t of ['app_data','vinted_accounts'])for(const a of Object.keys(acteurs)){
  const moi=acteurs[a]&&acteurs[a]!=='anon'?acteurs[a]:A;
  for(const [cible,u] of [['soi',moi],['A',A],['B',B],['C',C]]){
   lignes.push([t,a,cible,'lire',op(a,`select string_agg(id,',' order by id) from ${t} where owner='${u}'`)]);
   lignes.push([t,a,cible,'inserer',op(a,`with x as(insert into ${t} values('${u}','neuf','{}') returning 1) select count(*) from x`)]);
   lignes.push([t,a,cible,'modifier',op(a,`with x as(update ${t} set data='{"m":1}' where owner='${u}' returning 1) select count(*) from x`)]);
   lignes.push([t,a,cible,'effacer',op(a,`with x as(delete from ${t} where owner='${u}' returning 1) select count(*) from x`)]);
  }
  lignes.push([t,a,'-','vers B',op(a,`with x as(update ${t} set owner='${B}' where owner='${moi}' returning 1) select count(*) from x`)]);
  lignes.push([t,a,'-','tout lire',op(a,`select count(*) from ${t}`)]);
 }
 return lignes;
}
const cle=m=>m.map(l=>l.join('|')).join('\n');
const politiques=()=>Q(`select tablename||':'||policyname||':'||permissive||':'||cmd from pg_policies where schemaname='public' order by 1`).split('\n');
const permissives=t=>Q(`select string_agg(policyname,',' order by policyname) from pg_policies where tablename='${t}' and permissive='PERMISSIVE'`);
try{
 let r=serveur('initdb',['-D',DIR+'/data','-U','postgres','--auth=trust','-E','UTF8','--locale=C','--no-sync']);if(r.status!==0)throw Error(r.stderr);
 r=serveur('pg_ctl',['-D',DIR+'/data','-o',`-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off`,'-l',DIR+'/journal','-w','start']);if(r.status!==0)throw Error(r.stderr);demarre=true;
 for(const abo of ['006','027'])for(const equipe of [false,true]){
  const nom=`abonnement ${abo}${equipe?' + équipe 016':''}`;
  batir({abo,equipe});
  const avant=matrice(),restrAvant=politiques().filter(x=>x.includes(':RESTRICTIVE:'));
  dit(permissives('app_data').split(',').length>=5,`${nom} : état de départ — app_data a ${permissives('app_data').split(',').length} permissives (${permissives('app_data')})`);
  // L'état de départ doit être LE BON (sinon la matrice ne prouve rien).
  const v=(t,a,c,o)=>avant.find(l=>l[0]===t&&l[1]===a&&l[2]===c&&l[3]===o)[4];
  dit(v('app_data','A','soi','lire')==='principal,second'&&v('app_data','A','B','lire')===(equipe?'partage':'∅')&&v('app_data','B','A','lire')==='∅','  départ : A lit ses lignes, rien de B'+(equipe?' sauf « partage » (équipe)':''));
  dit(v('app_data','A','B','inserer')==='REFUS'&&v('app_data','A','B','modifier')==='0'&&v('app_data','A','B','effacer')==='0'&&v('app_data','A','-','vers B')==='REFUS','  départ : A n’écrit pas chez B');
  dit(v('app_data','anon','A','lire')==='∅'&&v('app_data','anon','A','inserer')==='REFUS'&&v('app_data','vide','-','tout lire')==='0','  départ : anonyme et identité absente : rien');
  dit(abo==='006'?v('app_data','C','soi','lire')==='∅':v('app_data','C','soi','lire')==='principal'&&v('app_data','C','soi','modifier')==='REFUS'&&v('app_data','C','soi','inserer')==='REFUS'&&v('app_data','C','soi','effacer')==='0',`  départ : abonnement expiré — ${abo==='006'?'ne lit rien':'lit, n’écrit pas'}`);
  Q(M033);
  const apres=matrice();
  const diff=avant.filter((l,i)=>cle([l])!==cle([apres[i]]));
  dit(diff.length===0,`${nom} : matrice identique après la 033 (${avant.length} accès comparés)`+(diff.length?' — écarts : '+diff.slice(0,4).map((l,i)=>l.join('|')+' → '+apres[avant.indexOf(l)][4]).join(' ; '):''));
  dit(permissives('app_data')===(equipe?'equipe_lit,vrm_proprietaire_permis':'vrm_proprietaire_permis')&&permissives('vinted_accounts')==='vrm_proprietaire_permis',`${nom} : une permissive par table (${permissives('app_data')} / ${permissives('vinted_accounts')})`);
  dit(cle(restrAvant.map(x=>[x]))===cle(politiques().filter(x=>x.includes(':RESTRICTIVE:')).map(x=>[x])),`${nom} : les ${restrAvant.length} restrictives sont toutes là, inchangées`);
  Q(M033);dit(cle(matrice())===cle(avant),`${nom} : rejouée une 2e fois, rien ne bouge`);
 }
 // Mutation 1 : une « 033 » qui retire aussi la gardée DOIT se voir.
 batir({abo:'027',equipe:false});const ref=matrice();
 Q(`drop policy "chacun ses lignes" on app_data;drop policy tout_select on app_data;drop policy tout_insert on app_data;drop policy tout_update on app_data;drop policy vrm_proprietaire_permis on app_data;`);
 dit(cle(matrice())!==cle(ref),'mutation : retirer aussi vrm_proprietaire_permis change la matrice (le banc sait échouer)');
 // Mutation 2 : une permissive plus large présente ⇒ la 033 refuse TOUT.
 batir({abo:'027',equipe:false,large:true});const avantLarge=politiques();
 const rr=run(M033);
 dit(!rr.ok&&/vrm_politiques_033/.test(rr.err)&&cle(politiques().map(x=>[x]))===cle(avantLarge.map(x=>[x])),'permissive inconnue (using true) : la 033 s’arrête, aucune politique retirée');
 // Mutation 3 : sans la 021 (pas de vrm_proprietaire_permis) ⇒ refus, rien retiré.
 const db='essai'+(++nBase);Q(`create database ${db}`,'postgres');BASE=db;
 Q(`create schema auth;create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;create table app_data(owner uuid,id text);create table vinted_accounts(owner uuid,id text);
 alter table app_data enable row level security;create policy "chacun ses lignes" on app_data using (owner = (select auth.uid()));`);
 const r3=run(M033);
 dit(!r3.ok&&/absente/.test(r3.err)&&Q(`select count(*) from pg_policies where tablename='app_data'`)==='1','sans la 021 : la 033 s’arrête et ne retire rien');
}catch(e){ko++;console.error('❌ Audit interrompu : '+e.message);}
console.log(`\n${ok} contrôles SQL réussis, ${ko} échec(s). Base locale supprimée.`);process.exitCode=ko?1:0;
