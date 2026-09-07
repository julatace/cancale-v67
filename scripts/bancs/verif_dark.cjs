// Banc : aucun écran vide, aucun débordement horizontal, aucune erreur.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs=require('fs'), http=require('http'), path=require('path');
const DIST='/home/user/cancale-v67/dist', SC=__dirname;
const FX=f=>JSON.parse(fs.readFileSync(path.join(SC,'fx',f+'.json'),'utf8'));
const main=FX('main'), accounts=FX('accounts');
const rows=[...FX('sold'),...FX('purch'),...FX('listings'),...FX('inbox'),...FX('track'),...FX('bord'),...FX('label'),...FX('billing')]; const txn=FX('txn');
// ── LA PROJECTION `select=` DE POSTGREST, honnêtement appliquée ─────────────
// ⚠️ SANS ÇA, CE BANC MESURE UNE FICTION. Il rendait la ligne BRUTE
// (`{id,data}`) pour une requête qui demande une projection
// (`select=id,filename:data->>filename,…`) : l'app lisait `r.filename` sur un
// objet qui ne l'a pas, TOUS les bordereaux tombaient, et l'écran Colis
// affichait « 0 bordereau prêt à imprimer » alors que dix étaient en base.
// C'est ce qui m'a fait chercher au mauvais endroit pendant plusieurs passes
// (7 septembre). §6.3 : servir toutes les FORMES de requête, pas seulement
// toutes les familles de lignes.
function projette(row,select){
  if(!select || select==='*') return row;
  const out={};
  for(const part of select.split(',')){
    const m=/^(?:([^:]+):)?(.+)$/.exec(part.trim()); if(!m) continue;
    const alias=m[1]||m[2].split('->').pop().replace(/^>/,''); const src=m[2];
    if(src==='id'||src==='updated_at'){ out[alias]=row[src]; continue; }
    if(src==='data'){ out[alias]=row.data; continue; }
    if(/^data(->|->>)/.test(src)){
      const reste=src.replace(/^data(->>|->)/,'');
      let v=row.data;
      for(const seg of reste.split(/->>|->/)) v=(v==null?null:v[seg]);
      out[alias]=(v==null)?null:v; continue;
    }
    out[alias]=row[src];
  }
  return out;
}

const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.listen(4322);
const TABS=['journee','dashboard','cat_annonces','cat_ventes','cat_achats','cat_bord','cat_msg','garage','invoices','settings'];
(async()=>{
  let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'✅ ':'❌ ')+m+(d?' — '+d:''));};
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox']});
  for(const [W,H,tag] of [[390,844,'390 px'],[1512,950,'1512 px']]){
    const pg=await b.newPage({viewport:{width:W,height:H}});
    const errs=[];
    pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
    pg.on('console',m=>{if(m.type()==='error'&&!/owner|ERR_|Failed to load|status of 4/.test(m.text()))errs.push('CONSOLE '+m.text().slice(0,140));});
    await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');localStorage.setItem('vinted_dark','true');}catch(_){}});
    await pg.route('**/rest/v1/**',route=>{const u=route.request().url();
      const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
      if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
      if(/vinted_accounts/.test(u)) return j(accounts);
      const sel=(/[?&]select=([^&]*)/.exec(u)||[])[1]; const S=sel?decodeURIComponent(sel):null;
      if(/id=eq\.main/.test(u)) return j(main.map(r=>projette(r,S)));
      if(/transaction->>id/.test(u)) return j(txn);
      const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return j(rows.filter(r=>r.id===k).map(r=>projette(r,S)));}
      const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');return j(rows.filter(r=>re.test(r.id)).map(r=>projette(r,S)));}
      return j([]);});
    await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
    const vides=[], deb=[], susp=[], sousIle=[], morts=[];
    for(const t of TABS){
      await pg.goto('http://localhost:4322/?tab='+t,{waitUntil:'domcontentloaded'});
      await pg.waitForTimeout(2200);
      const r=await pg.evaluate(()=>({n:(document.body.innerText||'').length,
        sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth,
        txt:(document.body.innerText||'')}));
      if(r.n<120) vides.push(t+':'+r.n);
      // ⚠️ MÊME TROU QUE `verif_visuel` : le garde-fou d'écran affiche un vrai
      // texte, sans débordement et sans `pageerror` — ce banc répondait « rendu
      // conforme » sur un écran mort. (Mesuré le 7 septembre sur Achats.)
      if(/n'a pas pu s'afficher|Cannot access|is not defined|is not a function/.test(r.txt)) morts.push(t);
      if(W>=1024) await pg.screenshot({path:SC+'/d-'+t+'.png',fullPage:true});
      if(r.sw>r.cw+1) deb.push(`${t} ${r.sw}>${r.cw}`);
      if(/undefined|NaN|\[object Object\]|\/\*|\*\//.test(r.txt)) susp.push(t);
      // ⚠️ L'île d'actions flotte en haut à droite : RIEN d'interactif ne doit
      // passer dessous (§ Factures, « ⚙ Réglages » invisible).
      if(W>=1024){
        const sous=await pg.evaluate(()=>{
          const h=document.querySelector('header'); if(!h) return [];
          const b=h.getBoundingClientRect(); const out=[];
          document.querySelectorAll('main button, main a, main input, main select').forEach(el=>{
            const r=el.getBoundingClientRect(); if(r.width<6||r.height<6) return;
            if(r.right>b.left-4 && r.left<b.right+4 && r.bottom>b.top-4 && r.top<b.bottom+4)
              out.push((el.innerText||el.getAttribute('aria-label')||el.tagName).trim().slice(0,28));
          });
          return out;
        });
        if(sous.length) sousIle.push(t+': '+sous.join(' | '));
      }
    }
    console.log(`── ${tag}`);
    dit(vides.length===0,'aucun écran vide',vides.join(', '));
    dit(morts.length===0,"aucun écran n'est tombé sur le garde-fou",morts.join(', '));
    dit(deb.length===0,'aucun débordement horizontal',deb.join(', '));
    dit(susp.length===0,"aucun artefact d'affichage",susp.join(', '));
    dit(sousIle.length===0,"rien ne passe sous l'île d'actions",sousIle.slice(0,3).join(' // '));
    dit(errs.length===0,"aucune erreur d'app",errs.slice(0,2).join(' | '));
    await pg.close();
  }
  await b.close(); srv.close();
  console.log(ko?`\n${ko} contrôle(s) non conforme(s).`:'\nRendu conforme sur les deux tailles.');
  process.exit(ko?1:0);
})();
