// LE RISQUE N°1 DE L'APP, RENDU. Mesuré dans sa base le 7 septembre :
// **12 numéros portent chacun 2 à 4 paires, TOUTES EN LIGNE** (34 paires).
// La numérotation automatique a redonné N°1 à N°16 en août alors qu'ils étaient
// déjà dans le pool. Deux paires sous le même numéro = la mauvaise chaussure
// part. Ce banc vérifie que l'app le lui DIT, en rouge, là où se fait le geste.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs=require('fs'), http=require('http'), path=require('path');
const DIST='/home/user/cancale-v67/dist', SC=__dirname;
const FX=f=>JSON.parse(fs.readFileSync(path.join(SC,'fx',f+'.json'),'utf8'));
const main=FX('main'), accounts=FX('accounts'), txn=FX('txn');
const rows=[...FX('sold'),...FX('purch'),...FX('listings'),...FX('inbox'),...FX('track'),...FX('bord'),...FX('label'),...FX('billing')];
function projette(row,select){
  if(!select||select==='*') return row;
  const out={};
  for(const part of select.split(',')){
    const m=/^(?:([^:]+):)?(.+)$/.exec(part.trim()); if(!m) continue;
    const alias=m[1]||m[2].split('->').pop().replace(/^>/,''); const src=m[2];
    if(src==='id'||src==='updated_at'){ out[alias]=row[src]; continue; }
    if(src==='data'){ out[alias]=row.data; continue; }
    if(/^data(->|->>)/.test(src)){ const reste=src.replace(/^data(->>|->)/,''); let v=row.data;
      for(const seg of reste.split(/->>|->/)) v=(v==null?null:v[seg]); out[alias]=(v==null)?null:v; continue; }
    out[alias]=row[src];
  }
  return out;
}
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.listen(4417);
// ⚠️ CE QUI EST VRAIMENT EN LIGNE : `is_closed` écarte les annonces fermées.
// Compter tout le tableau (ce que fait `nItems`) donne 432 « en ligne » au lieu
// de 49 — et fait croire à douze conflits de numéros qui n'existent pas. C'est
// l'erreur que j'ai commise le 7 septembre avant de vérifier la forme du champ.
const num=JSON.parse(JSON.stringify((main[0].data.vinted_annonce_numeros)||{}));
const enLigne=new Set(); const idsEnLigne=[];
FX('listings').forEach(r=>{ const p=(r.data||{}).payload||{}; const it=p.items||p.listings||[];
  (Array.isArray(it)?it:[]).forEach(x=>{ if(x&&x.id!=null&&!x.is_closed){ enLigne.add(String(x.id)); idsEnLigne.push(String(x.id)); } }); });
// ⚠️ ON FORCE LE CAS. Aujourd'hui il n'a AUCUN conflit vivant (vérifié) — donc
// sans ça, ce banc ne prouverait rien : il constaterait une absence. On donne
// donc, DANS LA FIXTURE SEULEMENT (jamais en base, §2.3), le même numéro à deux
// annonces réellement en ligne. C'est la méthode d'`audit-identite.cjs`.
const NUM_TEST='7777';
const [a,b2]=idsEnLigne.filter(id=>num[id]).slice(0,2);
if(a&&b2){ num[a]={...num[a],numero:NUM_TEST}; num[b2]={...num[b2],numero:NUM_TEST};
  main[0].data.vinted_annonce_numeros=num;
  console.log('fixture : N°'+NUM_TEST+' pose sur DEUX annonces en ligne ('+a+' et '+b2+')'); }
const par={}; Object.keys(num).forEach(k=>{const n=String((num[k]||{}).numero||''); if(n)(par[n]=par[n]||[]).push(k);});
const vivants=Object.entries(par).filter(([,ks])=>ks.filter(k=>enLigne.has(String(k))).length>1);
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
(async()=>{
  console.log('base servie : '+vivants.length+' numeros portes par 2+ paires EN LIGNE ('+vivants.map(([n])=>'N°'+n).join(' ')+')');
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1512,height:950}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  await pg.route('**/rest/v1/**',route=>{const u=route.request().url();
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    if(route.request().method()!=='GET') return j([]);
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    const sel=(/[?&]select=([^&]*)/.exec(u)||[])[1]; const S=sel?decodeURIComponent(sel):null;
    if(/vinted_accounts/.test(u)) return j(accounts);
    if(/id=eq\.main/.test(u)) return j(main.map(r=>projette(r,S)));
    if(/transaction->>id/.test(u)) return j(txn);
    const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return j(rows.filter(r=>r.id===k).map(r=>projette(r,S)));}
    const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');
      return j(rows.filter(r=>re.test(r.id)).map(r=>projette(r,S)));}
    return j([]);});
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  const vus={};
  for(const t of ['cat_annonces','cat_bord','journee']){
    await pg.goto('http://localhost:4417/?tab='+t,{waitUntil:'domcontentloaded'});
    await pg.waitForTimeout(5000);
    await pg.screenshot({path:SC+'/z-conflit-'+t+'.png',fullPage:true});
    const t2=await pg.evaluate(()=>document.body.innerText||'');
    const diag=await pg.evaluate(()=>{
      try{ const n=JSON.parse(localStorage.getItem('vinted_annonce_numeros')||'{}');
        return {numeros:Object.keys(n).length,
                cartes:document.querySelectorAll('[data-annonce-card],[data-bord-card]').length,
                texte:(document.body.innerText||'').slice(0,120).replace(/\n/g,' | ')}; }catch(e){return {err:String(e)};}
    });
    console.log('      diag :', JSON.stringify(diag));
    const m=/(\d+)\s+num[ée]ros?\s+port[ée]s?\s+par\s+deux\s+paires/.exec(t2);
    vus[t]=m?+m[1]:0;
    console.log('   '+t.padEnd(14)+' → '+(m?m[0]:'RIEN'));
  }
  dit(Object.values(vus).some(v=>v>0), 'l\'app signale les numeros portes par deux paires',
    JSON.stringify(vus));
  dit(vus['cat_bord']>0, 'et elle le dit sur COLIS, la ou se ferme le carton',
    vus['cat_bord']+' signale(s) pour '+vivants.length+' construit(s)');
  dit(errs.length===0, "aucune erreur d'app", errs.slice(0,2).join(' | '));
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nLe risque n°1 est annonce la ou il faut.');
  process.exit(ko?1:0);
})();
