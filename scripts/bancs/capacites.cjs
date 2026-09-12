// ═══════════════════════════════════════════════════════════════════════════
// BANC : L'APP NE PROMET QUE CE QUE L'EXTENSION INSTALLÉE SAIT FAIRE
//        node scripts/bancs/capacites.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Le défaut le plus coûteux du projet — l'app promet, l'extension ne sait pas —
// s'est reproduit TROIS fois : le zip qui n'existait pas, les codes de retrait,
// et le prix plancher. Les deux premiers ont été traités à la main, un par un.
// Ce banc traite la RÈGLE : pour chaque capacité de `EXT_CAPACITES`, l'app
// change de discours selon la version que le pont annonce.
//
// ⚠️ ON FORCE LE CAS, comme `conflit.cjs`. Mesuré le 8 septembre : **0 prix
// plancher sur 329 paires**. Sans plancher posé, le bandeau ne doit PAS
// s'afficher — donc un banc qui se contenterait de regarder mesurerait son
// absence légitime et passerait au vert sur le défaut qu'il doit attraper.
// On pose donc un plancher DANS LA FIXTURE (jamais en base, §2.3).
//
// ⚠️ ET ON SIMULE LE PONT. `bridge.js` annonce sa version par
// `postMessage({__vmr:'ready', version})`. Trois états à couvrir, pas deux :
// pont absent · pont ancien · pont à jour. L'état « muet » (présent, sans
// version) est le plus en retard de tous, et c'était le seul à ne rien
// déclencher — il est testé ici aussi.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
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
srv.listen(4472);

// ── LE PLANCHER FORCÉ, sur une annonce RÉELLEMENT en ligne ─────────────────
const num=JSON.parse(JSON.stringify((main[0].data.vinted_annonce_numeros)||{}));
const enLigne=new Set();
FX('listings').forEach(r=>{ const p=(r.data||{}).payload||{}; const it=p.items||p.listings||[];
  (Array.isArray(it)?it:[]).forEach(x=>{ if(x&&x.id!=null&&!x.is_closed) enLigne.add(String(x.id)); }); });
// ⚠️ SUR TOUTES LES ANNONCES EN LIGNE, PAS UNE SEULE. Premier jet : un
// plancher sur la premiere annonce numerotee en ligne → bandeau jamais affiche,
// et j'ai cru le code faux. La grille (`annBase`) ecarte les annonces d'un
// compte retire ou vendu a la main : l'annonce choisie n'y etait pas, donc
// `annStats.planchers` valait bien 0 — l'app avait RAISON. Un banc qui pose sa
// donnee a cote de ce que l'ecran rend mesure une fiction (§6.3).
// Bonus : en les posant toutes, le compte annonce par le bandeau doit egaler
// le nombre de cartes rendues — c'est §11 verifie pour de vrai (meme base, un
// seul proprietaire), pas seulement la presence d'une phrase.
let poses=0;
for(const k of Object.keys(num)) if(enLigne.has(String(k))){ num[k]={...num[k],minPrice:'42'}; poses++; }
main[0].data.vinted_annonce_numeros=num;
console.log('fixture : prix plancher 42 € pose sur '+poses+' annonces en ligne');

let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
// La phrase du bandeau, et la promesse. On cherche la SUBSTANCE, pas la
// formule : « rien ne les applique » d'un côté, « automatiquement » de l'autre.
const BANDEAU=/prix plancher[^\n]*rien ne les applique/i;

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox']});
  const lis=async (pont)=>{
    const pg=await b.newPage({viewport:{width:1512,height:950}});
    const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
    await pg.addInitScript((v)=>{
      try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}
      if(v===null) return;                       // pas d'extension du tout
      // Le pont répond au ping de l'app, comme `bridge.js`.
      window.addEventListener('message',(e)=>{
        if(e.source!==window||!e.data||e.data.__vmr!=='ping') return;
        const msg={__vmr:'ready'}; if(v) msg.version=v;   // '' = pont MUET
        window.postMessage(msg,'*');
      });
    }, pont);
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
    await pg.goto('http://localhost:4472/?tab=cat_annonces',{waitUntil:'domcontentloaded'});
    await pg.waitForTimeout(4500);
    const t=await pg.evaluate(()=>document.body.innerText||'');
    if(process.env.DEBUG) console.log('      diag:',JSON.stringify(await pg.evaluate(()=>{
      let n={}; try{n=JSON.parse(localStorage.getItem('vinted_annonce_numeros')||'{}');}catch(_){}
      const avec=Object.keys(n).filter(k=>n[k]&&n[k].minPrice!=null&&String(n[k].minPrice).trim()!=='');
      return {numeros:Object.keys(n).length, avecMin:avec.length, ex:avec[0]||null,
        planchTexte:/prix plancher/i.test(document.body.innerText||''), cartes:document.querySelectorAll('img').length};
    })));
    const nom=pont===null?'absente':(pont===''?'muette':pont);
    await pg.screenshot({path:SC+'/z-cap-'+nom.replace(/\./g,'_')+'.png',fullPage:true});
    await pg.close();
    return {t, errs};
  };

  // 5.38 est la version d'ARRIVÉE de `autoAccepterOffres` : 5.37 ne sait pas,
  // 5.38 sait. On teste des deux cotes de la frontiere, sinon on ne mesure
  // qu'un seuil, pas LE seuil.
  const cas=[
    {pont:'5.37.0', nom:'en retard (5.37, juste sous le seuil)', attendu:true},
    {pont:'5.38.0', nom:'a jour pour les offres (5.38, le seuil)', attendu:false},
    {pont:'5.52.0', nom:'a jour (5.52)',                          attendu:false},
    {pont:'',       nom:'MUETTE sur sa version (< 5.26)',         attendu:true},
    {pont:null,     nom:'absente (telephone)',                    attendu:true},
  ];
  for(const c of cas){
    const {t,errs}=await lis(c.pont);
    const vu=BANDEAU.test(t);
    console.log('   '+c.nom.padEnd(40)+' → bandeau '+(vu?'AFFICHE':'absent'));
    dit(vu===c.attendu, 'extension '+c.nom+' : '+(c.attendu?'l\'app dit que rien ne l\'applique':'l\'app ne crie pas pour rien'),
      vu===c.attendu?'':'bandeau '+(vu?'affiche':'absent')+' alors qu\'on attend '+(c.attendu?'affiche':'absent'));
    dit(errs.length===0, 'aucune erreur d\'app ('+c.nom+')', errs.slice(0,2).join(' | '));
    // ⚠️ Le bandeau doit DIRE COMBIEN : un chiffre qu'on ne peut pas verifier
    //    est invendable (§2.7). On en a pose exactement un.
    if(vu){
      const sans=t.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      const nBandeau=(/(\d+)\s+prix\s+planchers?\s+poses?/i.exec(sans)||[])[1];
      const nGrille =(/(\d+)\s+en\s+ligne/i.exec(sans)||[])[1];
      dit(!!nBandeau, 'et il dit COMBIEN de planchers sont poses',
        'un chiffre qu\'on ne peut pas verifier est invendable');
      // §11 : le bandeau compte sur la MEME base que la grille. Deux calculs
      // separes finiraient par se contredire — ici ils ne peuvent pas.
      dit(nBandeau && nGrille && nBandeau===nGrille,
        'et il compte sur la MEME base que la grille',
        'bandeau '+nBandeau+' / grille '+nGrille);
    }
  }
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nL\'app ne promet que ce que l\'extension installee sait faire.');
  process.exit(ko?1:0);
})();
