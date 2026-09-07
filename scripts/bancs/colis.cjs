// L'ÉCRAN COLIS, RENDU COMME EN VRAI. ⚠️ Le piège qui a fausse tous mes bancs
// precedents : ils rendaient la ligne BRUTE ({id,data}) pour une requete qui
// demande une PROJECTION (`select=id,filename:data->>filename,…`). L'app lisait
// donc `r.filename` sur un objet qui ne l'a pas → TOUS les bordereaux tombaient,
// et l'ecran affichait « 0 bordereau pret a imprimer ». C'etait un artefact du
// banc, pas un defaut de l'app (§6.3 : servir TOUTES les formes de requete).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs=require('fs'), http=require('http'), path=require('path');
const DIST='/home/user/cancale-v67/dist', SC=__dirname;
const FX=f=>JSON.parse(fs.readFileSync(path.join(SC,'fx',f+'.json'),'utf8'));
const main=FX('main'), accounts=FX('accounts'), txn=FX('txn');
const rows=[...FX('sold'),...FX('purch'),...FX('listings'),...FX('inbox'),...FX('track'),...FX('bord'),...FX('label'),...FX('billing')];
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.zip':'application/zip'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.listen(4403);

// ── LA PROJECTION `select=` DE POSTGREST, honnêtement appliquée ────────────
const chemin=(obj,ch)=>ch.split('->').reduce((o,k)=>{ if(o==null) return null;
  const kk=k.replace(/^>/,'').replace(/^'|'$/g,''); return o[kk]; }, obj);
function projette(row,select){
  if(!select || select==='*') return row;
  const out={};
  for(const part of select.split(',')){
    const m=/^(?:([^:]+):)?(.+)$/.exec(part.trim()); if(!m) continue;
    const alias=m[1]||m[2].split('->').pop().replace(/^>/,''); const src=m[2];
    if(src==='id'||src==='updated_at'){ out[alias]=row[src]; continue; }
    if(src==='data'){ out[alias]=row.data; continue; }
    if(/^data(->|->>)/.test(src)){
      const reste=src.replace(/^data(->>|->)/,''); // « payload->my_orders » ou « nItems »
      let v=row.data;
      for(const seg of reste.split(/->>|->/)) v = (v==null?null:v[seg]);
      out[alias] = (v==null)?null:(/->>/.test(src.replace(/^data/,''))&&typeof v!=='object'?String(v):v);
      continue;
    }
    out[alias]=row[src];
  }
  return out;
}
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
// ce que la base contient vraiment
const bord=FX('bord'); const sold=FX('sold');
const parTx={}; bord.forEach(r=>{const d=r.data||{}; if(d.transaction&&d.filename) parTx[String(d.transaction)]=1;});
let ventes=[]; sold.forEach(r=>(((r.data||{}).payload||{}).my_orders||[]).forEach(o=>ventes.push(o)));
const aEnvoyer=ventes.filter(o=>/Bordereau envoyé au vendeur|Le paiement a été validé|en attente|à expédier/i.test(o.status||''));
const attendus=aEnvoyer.filter(o=>parTx[String(o.transaction_id)]).length;
(async()=>{
  console.log('base servie : '+aEnvoyer.length+' ventes a expedier · '+attendus+' ont deja leur PDF en base');
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
  await pg.goto('http://localhost:4403/?tab=cat_bord',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(5000);
  await pg.screenshot({path:SC+'/z-colis.png',fullPage:true});
  const v=await pg.evaluate(()=>({txt:document.body.innerText||'',
    imprimer:[...document.querySelectorAll('button')].filter(x=>/Imprimer/i.test(x.textContent)).length}));
  const mPret=/(\d+) bordereaux? prêts? à imprimer/.exec(v.txt);
  const mAtt=/(\d+) en attente de bordereau/.exec(v.txt);
  console.log('    en-tête : '+(v.txt.split('\n').find(l=>/bordereau/i.test(l))||'(rien)'));
  dit(mPret && +mPret[1]>0, 'l\'écran voit les bordereaux déjà en base',
    (mPret?mPret[1]:'0')+' annoncés prêts · '+attendus+' existent · '+(mAtt?mAtt[1]+' dits « en attente »':''));
  dit(v.imprimer>0, 'un bouton « Imprimer » est proposé', v.imprimer+' bouton(s)');
  dit(!/l'extension les récupère/i.test(v.txt) || (mPret&&+mPret[1]>0),
    'l\'app ne demande plus d\'aller les chercher quand elle les a déjà');
  dit(errs.length===0, "aucune erreur d'app", errs.slice(0,2).join(' | '));
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nL\'ecran Colis voit ses bordereaux.');
  process.exit(ko?1:0);
})();
