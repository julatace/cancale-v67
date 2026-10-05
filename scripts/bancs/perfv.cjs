// COMBIEN COÛTE L'ÉCRAN VENTES ? Il fait 19 844 px de haut au banc : on mesure
// le nombre de nœuds, le temps de rendu, et ce que coûte un filtre.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs=require('fs'), http=require('http'), path=require('path');
// ⚠️⚠️ JAMAIS UN CHEMIN ABSOLU ICI. La méthode de preuve du dossier (§6.1)
// extrait le code d'AVANT dans /tmp/avN, y copie le banc et le lance DEPUIS
// cet arbre. Avec '/home/user/cancale-v67/dist' écrit en dur, le banc servait
// le build COURANT : il mesurait le correctif en croyant mesurer le code
// d'avant, et sortait VERT sur le défaut. Un banc qui ne peut pas échouer est
// pire qu'absent — il rassure (même leçon qu'audit-coherence.cjs, qui sortait
// toujours en 0). Le dist se déduit de l'emplacement DU BANC.
const DIST=require('path').join(__dirname,'..','..','dist'), SC=__dirname;
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
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
  for(const [W,H,tag] of [[390,844,'iPhone'],[1512,950,'ordinateur']]){
  const pg=await b.newPage({viewport:{width:W,height:H}});
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  await pg.route('**/rest/v1/**',route=>{const u=metaVersData(route.request().url());
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    if(route.request().method()!=='GET') return j([]);
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    const sel=(/[?&]select=([^&]*)/.exec(u)||[])[1]; const S=sel?decodeURIComponent(sel):null;
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
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
     // ⚠️ On ne compte QUE les photos de CONTENU (vignettes de ventes). Le LOGO
     //    (`/logo-vrm*.png`, en-tête/rail) est de la CHROME au-dessus de la ligne
     //    de flottaison : il doit charger TOUT DE SUITE, pas en lazy (sinon il
     //    clignote). L'ancien compte prenait le logo → rouge dès son ajout (30
     //    sept.), alors que l'app a raison. On l'exclut par son src.
     images:[...document.querySelectorAll('img')].filter(i=>!/logo-vrm/i.test(i.getAttribute('src')||i.src||'')).length,
     pasLazy:[...document.querySelectorAll('img')].filter(i=>!/logo-vrm/i.test(i.getAttribute('src')||i.src||'') && i.getAttribute('loading')!=='lazy').length}));
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
  // ⚠️ On repère la LISTE une fois pour toutes (elle précède le bouton) : après
  // dépliage complet le bouton disparaît, et c'est elle qu'on comptera. Une
  // marque posée par le banc survit aux rendus tant que React ne remonte pas
  // le nœud — et s'il le remonte, la liste est introuvable et le contrôle
  // sort ROUGE, jamais vert.
  await pg.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Voir plus/.test(x.textContent));
    if(b && b.previousElementSibling) b.previousElementSibling.setAttribute('data-banc-liste','1');});
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
  // ⚠️ « ET CE TOTAL EST CELUI DE TOUTES LES VENTES ». Ce contrôle s'écrivait
  // `/sur 2\d\d/` : le nombre de ventes de la vraie base le jour où il a été
  // posé (287). La base a bougé (ventes masquées, et « Toutes » n'affiche plus
  // les annulées depuis le 28 septembre, décision de Julien) : 195 ventes,
  // toutes bien là — et le banc criait au défaut sur un écran juste. Un seuil
  // recopié d'un jour donné mesure la base de ce jour-là, pas la règle.
  // La RÈGLE, jugée sans aucun chiffre écrit en dur, par deux voies :
  //   1. on déplie TOUT : le nombre de lignes obtenu est celui écrit sur le
  //      bouton (rien n'est perdu, et le total n'est pas celui de la tranche) ;
  //   2. ce même nombre est celui que l'EN-TÊTE compte de son côté (il porte
  //      sur l'ensemble, §11) : finalisées + en cours, plus les colis
  //      « Retournée » qui reviennent (montrés dans « Toutes », hors de tout
  //      total d'argent). Une liste amputée dirait le même nombre sur son
  //      bouton et dans ses lignes — c'est l'en-tête qui la trahit.
  const tout=await pg.evaluate(async()=>{
    for(let k=0;k<30;k++){ const b=[...document.querySelectorAll('button')].find(x=>/Voir plus/.test(x.textContent));
      if(!b) break; b.click(); await new Promise(r=>setTimeout(r,300)); }
    const reste=!![...document.querySelectorAll('button')].find(x=>/Voir plus/.test(x.textContent));
    const L=document.querySelector('[data-banc-liste]');
    const lignes=L?[...L.children]:null;
    const retournees=lignes?lignes.filter(r=>(r.innerText||'').split('\n').some(l=>l.trim()==='Retournée')).length:null;
    const t=(document.body.innerText||'').split('\n').map(s=>s.trim());
    const apres=(re,re2)=>{const i=t.findIndex(l=>re.test(l)); if(i<0) return null;
      for(let j=i+1;j<Math.min(t.length,i+4);j++){const m=re2.exec(t[j]); if(m) return Number(m[1]);} return null;};
    return {reste, lignes:lignes?lignes.length:null, retournees,
            finalisees:apres(/^CA finalis/i,/^(\d+) ventes?$/), enCours:apres(/^En attente$/i,/^(\d+) en cours$/)};
  });
  const N=Number((/sur (\d+)/.exec(av.bouton||'')||[])[1]);
  // « En attente » ne s'affiche que s'il y a des ventes en cours : absent = 0.
  const entete=(tout.finalisees==null)?null:tout.finalisees+(tout.enCours||0)+(tout.retournees||0);
  dit(!!N && N>60 && !tout.reste && tout.lignes===N && entete===N,
    `${tag} : et ce total est celui de TOUTES les ventes`,
    `bouton « sur ${N||'?'} » · tout déplié : ${tout.lignes==null?'liste introuvable':tout.lignes+' lignes'}${tout.reste?' (le bouton reste)':''}`
    +` · en-tête : ${tout.finalisees==null?'illisible':tout.finalisees+' finalisées + '+(tout.enCours||0)+' en cours + '+(tout.retournees||0)+' retournées = '+entete}`);
  await pg.close();
  }
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):"\nL'ecran Ventes reste vif malgre ses 287 cartes.");
  process.exit(ko?1:0);
})();
