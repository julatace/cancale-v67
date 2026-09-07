// COMBIEN COÛTE L'ÉCRAN VENTES ? Il fait 19 844 px de haut au banc : on mesure
// le nombre de nœuds, le temps de rendu, et ce que coûte un filtre.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs=require('fs'), http=require('http'), path=require('path');
const DIST='/home/user/cancale-v67/dist', SC=__dirname;
const FX=f=>JSON.parse(fs.readFileSync(path.join(SC,'fx',f+'.json'),'utf8'));
const main=FX('main'), accounts=FX('accounts'), txn=FX('txn');
const rows=[...FX('sold'),...FX('purch'),...FX('listings'),...FX('inbox'),...FX('track'),...FX('bord'),...FX('label'),...FX('billing')];
const chemin=null;
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
srv.listen(4411);
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox']});
  for(const [W,H,tag] of [[390,844,'iPhone'],[1512,950,'ordinateur']]){
  const pg=await b.newPage({viewport:{width:W,height:H}});
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
  const t0=Date.now();
  await pg.goto('http://localhost:4411/?tab=cat_ventes',{waitUntil:'domcontentloaded'});
  for(let i=0;i<400;i++){ const n=await pg.evaluate(()=>document.querySelectorAll("input[placeholder*='prix']").length); if(n>50) break; await pg.waitForTimeout(50); }
  const pret=Date.now()-t0;
  const m=await pg.evaluate(()=>({noeuds:document.querySelectorAll('*').length,
     haut:document.documentElement.scrollHeight,
     cartes:document.querySelectorAll("input[placeholder*='prix']").length,
     images:document.querySelectorAll('img').length,
     pasLazy:[...document.querySelectorAll('img')].filter(i=>i.getAttribute('loading')!=='lazy').length}));
  // ce que coûte un filtre : on clique « Sans prix d'achat »
  const t1=Date.now();
  await pg.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Sans prix/.test(x.textContent)); if(b)b.click();});
  await pg.waitForTimeout(60);
  const filtre=Date.now()-t1;
  // et une frappe dans la recherche
  const t2=Date.now();
  await pg.evaluate(()=>{const i=document.querySelector('input[placeholder^="Rechercher"]'); if(i){const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,'salomon'); i.dispatchEvent(new Event('input',{bubbles:true}));}});
  await pg.waitForTimeout(60);
  const rech=Date.now()-t2;
  console.log(`${tag.padEnd(11)} · pret en ${String(pret).padStart(5)} ms · ${String(m.noeuds).padStart(6)} noeuds · page ${String(m.haut).padStart(6)} px · ${m.cartes} cartes · ${m.images} images (${m.pasLazy} sans lazy) · filtre ${filtre} ms · recherche ${rech} ms`);
  // ⚠️ PLANCHERS MESURÉS. Avant `useDeferredValue` : 293 ms par frappe sur
  // ordinateur, 179 sur téléphone — taper « salomon » coûtait deux secondes de
  // saccade. Après : ~150 ms. Le seuil est à 250 ms : assez large pour ne pas
  // clignoter d'une exécution à l'autre, assez serré pour rattraper la
  // régression exacte qu'on vient de corriger.
  dit(rech < 250, `${tag} : une frappe dans la recherche reste sous 250 ms`, rech+' ms');
  dit(filtre < 300, `${tag} : changer de filtre reste sous 300 ms`, filtre+' ms');
  dit(m.pasLazy === 0, `${tag} : toutes les photos se chargent à la demande`, m.pasLazy+' sans lazy');
  // ⚠️ ON REMET L'ÉCRAN À ZÉRO. Les mesures ci-dessus ont tapé « salomon » et
  // cliqué « Sans prix d'achat » : la liste est descendue à six cartes, et le
  // bouton « Voir plus » n'avait plus lieu d'être. Le banc mesurait donc son
  // absence comme un défaut. On efface la recherche et on revient sur
  // « Toutes » avant de vérifier la pagination.
  await pg.evaluate(()=>{
    const i=document.querySelector('input[placeholder^="Rechercher"]');
    if(i){const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,''); i.dispatchEvent(new Event('input',{bubbles:true}));}
    const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Toutes'); if(b)b.click();
  });
  await pg.waitForTimeout(500);
  // ⚠️ ON NE DESSINE QU'UNE TRANCHE — mais RIEN n'est perdu : le bouton dit le
  // total, et un clic ouvre la suite. Et les totaux du haut portent TOUJOURS
  // sur l'ensemble, jamais sur la tranche affichée.
  const av=await pg.evaluate(()=>{
    const t=document.body.innerText||'';
    const b=[...document.querySelectorAll('button')].find(x=>/Voir plus/.test(x.textContent));
    return {n:document.querySelectorAll("input[placeholder*='prix']").length,
            bouton:b?b.textContent.trim():null,
            ca:(t.split('\n').find(l=>/€/.test(l)&&/\d/.test(l))||'').trim()||null,
            nb:(/(\d+) ventes/.exec(t)||[])[1]||null};
  });
  dit(!!av.bouton, `${tag} : le bouton « Voir plus » dit le total`, av.bouton||'absent');
  dit(av.bouton && /sur 2\d\d/.test(av.bouton), `${tag} : et ce total est celui de TOUTES les ventes`, av.bouton||'');
  await pg.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Voir plus/.test(x.textContent)); if(b)b.click();});
  await pg.waitForTimeout(400);
  const ap=await pg.evaluate(()=>{
    const t=document.body.innerText||'';
    return {n:document.querySelectorAll("input[placeholder*='prix']").length,
            ca:(t.split('\n').find(l=>/€/.test(l)&&/\d/.test(l))||'').trim()||null,
            nb:(/(\d+) ventes/.exec(t)||[])[1]||null};
  });
  dit(ap.n > av.n, `${tag} : un clic ouvre la suite`, av.n+' -> '+ap.n+' cartes');
  dit(av.ca === ap.ca && av.nb === ap.nb,
    `${tag} : les totaux du haut ne bougent pas — ils portent sur tout`,
    `CA ${av.ca} -> ${ap.ca} · ${av.nb} -> ${ap.nb} ventes`);
  await pg.close();
  }
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):"\nL'ecran Ventes reste vif malgre ses 287 cartes.");
  process.exit(ko?1:0);
})();
