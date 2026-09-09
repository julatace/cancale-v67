// ═══════════════════════════════════════════════════════════════════════════
// BANC : UN CHOIX N'EST PAS UNE PANNE   —   node scripts/bancs/comptes.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Vu en capture le 9 septembre, sur l'écran « Comptes Vinted liés » :
//     État des comptes : ✓ 0 à jour · ⏱ 7 à rafraîchir · 🚫 2 EN PANNE
// …alors qu'un des deux « en panne » était `liliand653`, le compte que Julien a
// lui-même EXCLU de l'application — le bandeau juste au-dessus le disait
// (« 1 compte est exclu »), et sa carte portait le badge « Masqué (annonces +
// compta) » à côté d'un « Pas capté (il y a 38 j) » en ROUGE, avec la consigne
// « repasse sur vinted.fr » : exactement ce qu'il ne faut PAS faire pour un
// compte qu'on a mis de côté.
// Même famille que le panneau de sécurité : une fausse alerte est ce qui fait
// cesser de lire les vraies.
//
// ⚠️ ON FORCE LE CAS. Aucun compte n'est masqué dans les fixtures : sans ça, le
// banc constaterait une absence et passerait au vert sur le défaut. On écrit
// donc `vinted_accounts_hidden` dans le navigateur (c'est un réglage local, pas
// une donnée de production) — la méthode de `conflit.cjs`.
//
// ⚠️ ET ON VÉRIFIE LES DEUX SENS, sinon le contrôle est faux :
//   • le compte exclu ne compte PAS parmi les pannes ;
//   • mais il reste NOMMÉ (un compte caché en silence serait pire) ;
//   • et le compte réellement en panne, lui, est toujours signalé.
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
srv.listen(4477);

let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox']});
  // On masque le compte le PLUS EN RETARD : c'est celui qui, sans la garde,
  // ressort en rouge « en panne ». Masquer un compte frais ne prouverait rien.
  const parUid={}; accounts.forEach(a=>{ parUid[String(a.vinted_user_id)]=String(a.login||''); });
  const ages={};
  for(const r of rows){ const m=/^harvest_(\d+)_/.exec(String(r.id||'')); if(!m) continue;
    const t=Date.parse(((r.data)||{}).capturedAt||0)||0; if(t) ages[m[1]]=Math.max(ages[m[1]]||0,t); }
  const vieux=Object.keys(parUid).sort((x,y)=>(ages[x]||0)-(ages[y]||0))[0];
  console.log(`fixture : on masque « ${parUid[vieux]} » (le moins frais), comme Julien l'a fait pour liliand653`);

  const lire=async(masque)=>{
    const ctx=await b.newContext({viewport:{width:1512,height:950}});
    const pg=await ctx.newPage();
    const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
    await pg.addInitScript((uid)=>{ try{ localStorage.setItem('vrm_acces_direct','1');
      if(uid) localStorage.setItem('vinted_accounts_hidden', JSON.stringify([uid])); }catch(_){} }, masque);
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
    await pg.goto('http://localhost:4477/?tab=vintedaccounts',{waitUntil:'domcontentloaded'});
    await pg.waitForTimeout(4500);
    if(masque) await pg.screenshot({path:SC+'/z-comptes.png',fullPage:true});
    const L=(await pg.evaluate(()=>document.body.innerText||'')).split('\n').map(x=>x.trim());
    const k=L.findIndex(x=>x.startsWith('État des comptes'));
    const tete=k<0?'':L.slice(k,k+6).join(' · ');
    const n=(re)=>{ const m=re.exec(tete); return m?+m[1]:0; };
    const q=L.findIndex(x=>x===parUid[vieux]);
    const carte=q<0?'':L.slice(q,q+5).join(' · ');
    await ctx.close();
    return { tete, carte, errs,
      panne:n(/(\d+) en panne/), exclu:n(/(\d+) exclus? —/), aJour:n(/(\d+) à jour/), rafr:n(/(\d+) à rafraîchir/) };
  };

  const av = await lire(null);        // personne de masqué : l'état de référence
  const ap = await lire(vieux);       // le compte est mis de côté par Julien
  console.log(`    sans masque : ${av.panne} en panne · ${av.exclu} exclu(s)`);
  console.log(`    masqué      : ${ap.panne} en panne · ${ap.exclu} exclu(s)`);
  console.log(`    sa carte    : ${ap.carte}`);

  dit(av.panne >= 1, 'la base sert bien au moins un compte en panne',
    'sinon ce banc ne prouve rien — il faut un compte réellement en retard');
  // ⚠️ LE CŒUR : masquer un compte le SORT des pannes.
  dit(ap.panne === av.panne - 1,
    "un compte exclu ne compte plus parmi les comptes en panne",
    `${av.panne} avant, ${ap.panne} après — attendu ${av.panne - 1}`);
  dit(ap.exclu === 1, "et il est compté à part, comme un choix",
    `« ${ap.tete.slice(0, 110)} »`);
  // ⚠️ MAIS IL RESTE VISIBLE. Un compte écarté en silence serait pire que
  //    l'alerte qu'on vient de retirer.
  dit(/Exclu de l'app|Masqué/i.test(ap.carte),
    "et sa carte dit qu'il est hors de l'app, pas qu'il est cassé",
    ap.carte || '(carte introuvable)');
  dit(!/Pas capté/i.test(ap.carte),
    "elle ne lui réclame plus une capture qu'il ne veut pas",
    ap.carte);
  dit(av.errs.length===0 && ap.errs.length===0, "aucune erreur d'app",
    [...av.errs,...ap.errs].slice(0,2).join(' | '));

  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):"\nUn compte mis de cote ne se fait plus passer pour une panne.");
  process.exit(ko?1:0);
})();
