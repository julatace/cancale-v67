// La saisie EN SÉRIE des prix d'achat : ouverture, suggestions, un tap relie.
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
const accounts=FX('accounts'); const main=FX('main'); const txn=FX('txn');
const rows=[...FX('sold'),...FX('purch'),...FX('listings'),...FX('inbox')];
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.listen(4341);
const ecrits=[];
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1512,height:950}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  await pg.route('**/rest/v1/**',route=>{const u=route.request().url(); const req=route.request();
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    if(req.method()!=='GET'){ try{ecrits.push(req.postData());}catch(_){}; return j([]); }
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    if(/vinted_accounts/.test(u)) return j(accounts);
    if(/id=eq\.main/.test(u)) return j(main);
    if(/transaction->>id/.test(u)) return j(txn);
    const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return j(rows.filter(r=>r.id===k));}
    const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');return j(rows.filter(r=>re.test(r.id)));}
    return j([]);});
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  await pg.goto('http://localhost:4341/?tab=cat_ventes',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(4000);
  const n=await pg.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/Coût d'achat/i.test(b.textContent)).length);
  dit(n>0, 'la case « Coût d\'achat » est cliquable sur l\'écran Ventes', n+' trouvée(s)');
  if(!n){ await pg.screenshot({path:SC+'/s-ventes.png'}); await b.close(); srv.close(); process.exit(1); }
  const t0=Date.now();
  await pg.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/Coût d'achat/i.test(b.textContent)).click());
  for(let i=0;i<300;i++){ const ok=await pg.evaluate(()=>/Prix d'achat à compléter|prix d'achat/i.test(document.body.innerText||'')&&document.querySelectorAll('input').length>20); if(ok) break; await pg.waitForTimeout(20); }
  // ⚠️ PLANCHER MESURÉ. Avant `prepAchat`, la modale comparait 288 paires ×
  // 544 achats en ré-épluchant le titre à chaque fois — **3 530 ms** pour
  // s'ouvrir, sur l'écran qu'il doit utiliser 320 fois. Après : ~300 ms, à
  // barème identique (26 suggestions dans les deux cas).
  { const ms = Date.now()-t0;
    dit(ms < 1200, 'la modale s\'ouvre sous 1,2 s', ms + ' ms'); }
  await pg.waitForTimeout(2500);
  await pg.screenshot({path:SC+'/s-serie.png'});
  const info=await pg.evaluate(()=>{
    const t=document.body.innerText||'';
    const i=t.indexOf('rix d\'achat');
    return {lignes:document.querySelectorAll('input[inputmode="decimal"]').length,
            entete:t.slice(Math.max(0,i-60), i+260).replace(/\n+/g,' | ')};
  });
  dit(info.lignes>50, 'les paires sans prix sont listées', info.lignes+' champs');
  // ⚠️ LE NOMBRE DE SUGGESTIONS EST LA PREUVE QU'UNE OPTIMISATION NE CHANGE
  // RIEN. Le barème est un jugement métier (§5.23) : il doit rendre EXACTEMENT
  // les mêmes achats, quelle que soit la façon dont on l'exécute.
  const sug=await pg.evaluate(()=>{
    const t=document.body.innerText||'';
    const m=/(\d+)\s+achats?\s+retrouv/.exec(t);
    return m?+m[1]:null;
  });
  dit(sug!=null, 'des achats sont retrouvés', sug+' suggestions');
  console.log('    >>> SUGGESTIONS : '+sug);
  // ⚠️ L'EN-TÊTE COMPTAIT 320 PAIRES, LA LISTE EN RENDAIT 300 (plafond en dur) :
  // vingt paires n'étaient atteignables nulle part, et la chaîne « Entrée » —
  // qui passe à la suivante — s'arrêtait net à la 300ᵉ. Le compte annoncé doit
  // être celui qu'on peut vraiment saisir.
  const cmp=await pg.evaluate(()=>{
    const t=document.body.innerText||'';
    const m=/(\d+)\s+paires?\s+sans\s+co[ûu]t/.exec(t);
    return {annonce:m?+m[1]:null, rendus:document.querySelectorAll('[data-fillbuy]').length};
  });
  dit(cmp.annonce!=null && cmp.annonce===cmp.rendus,
    'toutes les paires annoncées sont vraiment saisissables',
    `${cmp.annonce} annoncées · ${cmp.rendus} rendues`);
  console.log('    ' + info.entete);
  // un tap sur une suggestion
  const avant=ecrits.length;
  const sugg=await pg.evaluate(()=>{
    const b=[...document.querySelectorAll('button')].filter(x=>/€/.test(x.textContent)&&/Adidas|Nike|Salomon|Baskets/i.test(x.textContent));
    if(!b.length) return null; const t=b[0].textContent.trim().slice(0,70); b[0].click(); return t;
  });
  await pg.waitForTimeout(3000);
  dit(!!sugg, 'une suggestion d\'achat est proposée et cliquable', sugg||'aucune');
  const local=await pg.evaluate(()=>{ try{const n=JSON.parse(localStorage.getItem('vinted_annonce_numeros')||'{}');
    const k=Object.keys(n).filter(k=>n[k]&&n[k].buyFromId); return k.length?`${k[0]} -> ${n[k[0]].buyPrice} €`:null; }catch(_){return null;} });
  dit(!!local, 'le prix d\'achat est écrit sur la paire', local||'rien écrit');
  dit(ecrits.length>avant, 'et poussé dans le cloud', (ecrits.length-avant)+' écriture(s)');
  dit(errs.length===0, 'aucune erreur d\'app', errs.slice(0,2).join(' | '));
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nLa saisie en serie fonctionne.');
  process.exit(ko?1:0);
})();
