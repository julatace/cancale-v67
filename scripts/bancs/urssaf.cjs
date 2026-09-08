// ═══════════════════════════════════════════════════════════════════════════
// BANC : LA CARTE URSSAF SE VÉRIFIE TOUTE SEULE
//        node scripts/bancs/urssaf.cjs
// ═══════════════════════════════════════════════════════════════════════════
// C'est l'écran où Julien décide ce qu'il verse. Vu en capture le 8 septembre,
// sur ses vraies données, la carte « SEPTEMBRE » disait :
//     Ventes 26 · À payer (13,5 %) 19,32 € · Net après paiement 123,78 €
//     « Calculé sur le CA des ventes finalisées de septembre (0,00 €) »
// Trois chiffres, trois sources différentes, et aucun ne se déduit des autres :
//   • 19,32 € vient de 143,10 € (la ligne publiée par l'écran Ventes),
//   • 0,00 € vient de l'ANCIENNE archive, vide depuis juillet 2026 — la phrase
//     n'avait pas suivi quand les chiffres ont été rebranchés,
//   • 26 est le nombre de ventes du mois, pas des 2 FINALISÉES qui font le CA.
// Un total partiel présenté comme complet est pire qu'un total absent (§5), et
// un chiffre qu'on ne peut pas vérifier est invendable (§2.7).
//
// ⚠️ CE BANC NE LIT AUCUN LIBELLÉ POUR JUGER. Il prend les nombres RENDUS et
// vérifie qu'ils se déduisent les uns des autres : CA × taux = à payer, et
// CA − à payer = net. Un contrôle qui porterait sur la phrase serait vert le
// jour où quelqu'un la reformule (§6.5) ; celui-ci ne peut l'être que si le
// calcul est juste.
//
// ⚠️ IL FAUT RENDRE L'ÉCRAN VENTES D'ABORD. C'est lui le propriétaire (§11) :
// il publie `vinted_urssaf_mois`, le tableau de bord consomme. Ouvrir le
// tableau de bord seul mesurerait un écran qui n'a pas encore sa source.
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
srv.listen(4474);

let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
// « 1 234,56 € » → 1234.56
const eur=(s)=>{ if(s==null) return null; const n=Number(String(s).replace(/\s| | /g,'').replace(/€/g,'').replace(',','.')); return isFinite(n)?n:null; };

(async()=>{
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

  // L'écran Ventes publie, le tableau de bord consomme (§11).
  await pg.goto('http://localhost:4474/?tab=cat_ventes',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(4000);
  const publie=await pg.evaluate(()=>{ try{ const v=JSON.parse(localStorage.getItem('vinted_urssaf_mois')||'null');
    if(!v||!Array.isArray(v.mois)) return null;
    const d=new Date(); const ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return v.mois.find(m=>m.ym===ym)||{ym,ca:0,n:0}; }catch(_){ return null; } });
  dit(!!publie, "l'écran Ventes publie `vinted_urssaf_mois`",
    publie?`mois courant : ${publie.n} vente(s) · ${publie.ca} €`:'sans lui, le tableau de bord n\'a pas de source');

  await pg.goto('http://localhost:4474/?tab=dashboard',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(4500);
  await pg.screenshot({path:SC+'/z-urssaf.png',fullPage:true});
  const t=await pg.evaluate(()=>document.body.innerText||'');

  // ── LES NOMBRES RENDUS, pas les phrases ─────────────────────────────────
  const taux   = eur((/À PAYER \(([\d,.]+) ?%\)/i.exec(t)||[])[1]);
  const aPayer = eur((/À PAYER \([\d,.]+ ?%\)\s*\n\s*([\d\s.,  ]+€)/i.exec(t)||[])[1]);
  const net    = eur((/NET APRÈS PAIEMENT\s*\n\s*([\d\s.,  ]+€)/i.exec(t)||[])[1]);
  const caCite = eur((/CA des ventes finalisées de [a-zûéô]+ \(([\d\s.,  ]+€)\)/i.exec(t)||[])[1]);
  const nFinal = Number((/VENTES FINALISÉES\s*\n\s*(\d+)/i.exec(t)||[])[1]);
  console.log(`   rendu : taux ${taux} % · CA cité ${caCite} € · à payer ${aPayer} € · net ${net} € · ${nFinal} vente(s) finalisée(s)`);

  dit(caCite!=null && aPayer!=null && net!=null && taux!=null,
    'la carte du mois affiche taux, CA, à payer et net',
    'un des quatre est introuvable dans le rendu');

  if(caCite!=null && aPayer!=null && taux!=null){
    // ⚠️ LE CŒUR DU BANC. « 19,32 € à payer » ne peut pas venir de « 0,00 € ».
    const attendu = caCite*taux/100;
    dit(Math.abs(attendu-aPayer) < 0.02,
      "le CA cité dans la phrase est bien celui qui produit le montant à payer",
      `${caCite} € × ${taux} % = ${attendu.toFixed(2)} €, affiché ${aPayer} €`);
  }
  if(caCite!=null && aPayer!=null && net!=null){
    dit(Math.abs((caCite-aPayer)-net) < 0.02,
      "et le net est bien ce CA moins ce montant",
      `${caCite} − ${aPayer} = ${(caCite-aPayer).toFixed(2)} €, affiché ${net} €`);
  }
  // Le CA cité doit être CELUI de la ligne publiée : même notion, un seul
  // propriétaire. Sans ça, deux calculs finissent par se contredire (§11).
  if(publie && caCite!=null) dit(Math.abs(publie.ca-caCite) < 0.02,
    "et il vient de la ligne publiée par l'écran Ventes",
    `publié ${publie.ca} € / affiché ${caCite} €`);
  // Le compte de ventes affiché à côté est celui des FINALISÉES, pas de toutes.
  // ⚠️ UN CONTRÔLE QUI NE TROUVE PAS SON NOMBRE NE DOIT PAS PASSER EN SILENCE.
  //    Sur l'arbre d'avant, la carte titrait « Ventes » : le nombre ressortait
  //    `NaN`, le `if` tombait à faux, et le banc se taisait sur exactement ce
  //    qu'il devait attraper (26 au lieu de 2). Un `if` de garde autour d'un
  //    contrôle est un contrôle qui s'éteint tout seul (§6.5).
  if(publie) dit(isFinite(nFinal) && publie.n===nFinal,
    "le nombre de ventes affiché est celui des FINALISÉES, la même base que le CA",
    isFinite(nFinal) ? `publié ${publie.n} / affiché ${nFinal}`
                     : 'introuvable dans le rendu — la carte ne dit pas sur combien de ventes elle porte');
  dit(errs.length===0, "aucune erreur d'app", errs.slice(0,2).join(' | '));

  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nChaque chiffre de la carte URSSAF se deduit des autres.');
  process.exit(ko?1:0);
})();
