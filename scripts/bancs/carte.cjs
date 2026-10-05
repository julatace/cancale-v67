// LES POINTS RELAIS DE L'ÉCRAN ACHATS, quand c'est le PREMIER écran ouvert.
//
// Ce banc est né pour « la carte des points relais » (Julien : « pour chaque
// ville je veux renseigner ma ville et que l'app fasse la simulation »). Il
// vérifiait que la ville déjà renseignée (`vrm_ville`, réglage SYNCHRONISÉ)
// déclenchait la recherche `/api/relais` sur le premier écran ouvert : le nuage
// atterrit APRÈS le montage, et rien ne réveillait l'écran (§5 « La carte des
// points relais » : toute donnée synchronisée lue au montage passe par
// `onCloudReady`, et n'y remplace que ce qui est resté VIDE).
//
// ⚠️ CETTE CARTE N'EXISTE PLUS, ET C'EST VOULU. La recherche par ville a été
// retirée comme code mort qui tournait (§4.11 — commentaire « RECHERCHE DE
// RELAIS « PAR VILLE » RETIRÉE » dans src/App.jsx : son résultat n'était rendu
// NULLE PART, un appel réseau jeté à chaque ouverture), puis « Où déposer tes
// colis » qui l'avait remplacée a été retiré le 30 septembre à la demande de
// Julien (« c'est pas obligé, c'est pas ouf »). Exiger encore un appel à
// /api/relais, un bouton « Carte » et le nom de la ville, ce serait exiger le
// retour du code mort. Le banc vérifie donc la MÊME RÈGLE sur ce qui reste :
//   1. la recherche retirée ne repart pas (0 appel à /api/relais) ;
//   2. un colis coché « retiré » sur un AUTRE appareil — l'information n'existe
//      que dans le nuage — est pris en compte sur le premier écran ouvert d'un
//      appareil NEUF, exactement comme si on venait de le cocher ici : le total
//      « à retirer » baisse de un, et le colis reste visible en gris (un colis
//      caché est un colis perdu).
// La référence n'est pas une règle recopiée : c'est l'app elle-même. Passe 1,
// on coche pour de vrai et on relève ce que l'app écrit et affiche ; passe 2,
// appareil neuf, la même donnée n'arrive QUE par le nuage, en retard — et
// l'écran doit dire la même chose.
// Les données réelles restent dans fx/ (gitignoré). La réponse de /api/relais
// est INVENTÉE et embarquée (aucune fixture `relais-cancale.json` n'existe).
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
const mainFx=FX('main'), accounts=FX('accounts'), txn=FX('txn');
const purchFx=FX('purch');
// §6.3 : TOUTES les familles qu'Achats lit — sans les emails de suivi
// (`email_track_*`) ni les bordereaux (`email_bord_*`), l'écran affichait
// « 7 comptes ne reçoivent aucun email » : un artefact du banc, pas la base.
const autres=[...FX('sold'),...FX('listings'),...FX('inbox'),...FX('track'),...FX('bord')];
// Réponse de /api/relais INVENTÉE (même forme que api/relais.js :
// { city, center, points:[{nom,rue,type,carrier,locker,lat,lon}] }). Elle ne
// sert que si un appel repart — et dans ce cas il est compté (contrôle 1).
const RELAIS=JSON.stringify({city:'Ville-Témoin',center:{lat:47.5,lon:-2.5},points:[
  {nom:'Casier Témoin',rue:'1 rue de l’Exemple',type:'Casier à colis',carrier:'mondialrelay',locker:true,lat:47.501,lon:-2.501},
  {nom:'Tabac de la Place Témoin',rue:'2 place de l’Exemple',type:'Tabac',carrier:'chronopost',locker:false,lat:47.502,lon:-2.499},
  {nom:'Supérette Témoin',type:'Point relais',locker:false,lat:47.499,lon:-2.502}]});
// §6.3 : la PROJECTION `select=` compte autant que la ligne. Sans elle,
// `select=acc:meta->>account,…` lisait `row.acc` sur une ligne brute : tous les
// comptes paraissaient « sans aucun email » (bandeau ambre inventé par le banc).
// Même règle que capacites.cjs.
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
srv.on('error',e=>{ if(e.code==='EADDRINUSE'){ console.log('Le port 4393 est pris : relance ce banc seul.'); process.exit(2);} throw e; });
srv.listen(4393);
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
const W=+(process.env.W||1512), H=+(process.env.H||950);
const PNG1=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
// Libellé réel de Vinted pour un colis au relais — sert seulement si la vraie
// base n'en a plus aucun (la situation se PRÉPARE en mémoire, jamais sur disque).
const STATUT_RELAIS="La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";

// Lecture de ce que l'écran REND : les boutons portent leur rôle dans
// title/aria-label (« J'ai retiré ce colis » / « Annuler : je ne l'ai pas
// encore récupéré »), le total se lit dans l'en-tête du bloc.
const LIRE=()=>{
  const txt=document.body.innerText||'';
  const m=/(\d+)\s+colis à retirer/.exec(txt);
  const actifs=document.querySelectorAll('button[aria-label="Retiré"][title="J\'ai retiré ce colis"]').length;
  const gris=document.querySelectorAll('button[aria-label="Annuler"][title^="Annuler : je ne l\'ai pas encore"]').length;
  return {total:m?+m[1]:null, actifs, gris, garde:/n'a pas pu s'afficher|Cannot access|is not defined/.test(txt)};
};

async function rendre(b,{main,purch,delaiMain}){
  const ctx=await b.newContext({viewport:{width:W,height:H}});   // appareil NEUF : localStorage vide
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const etat={relais:0};
  const rows=[...autres,...purch];
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  await pg.route('**/rest/v1/**',async route=>{const u=metaVersData(route.request().url());
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    if(route.request().method()!=='GET') return j([]);
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    const sel=(/[?&]select=([^&]*)/.exec(u)||[])[1]; const S=sel?decodeURIComponent(sel):null;
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    // Le nuage arrive APRÈS le montage (c'est tout le sujet) : on le retarde
    // pour que l'écran ait déjà lu son localStorage vide.
    if(/id=eq\.main/.test(u)){ if(delaiMain) await new Promise(r=>setTimeout(r,delaiMain)); return j(main.map(r=>projette(r,S))); }
    if(/transaction->>id/.test(u)) return j(txn);
    const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return j(rows.filter(r=>r.id===k).map(r=>projette(r,S)));}
    const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');return j(rows.filter(r=>re.test(r.id)).map(r=>projette(r,S)));}
    return j([]);});
  // ⚠️ PLAYWRIGHT PREND LA DERNIÈRE ROUTE ENREGISTRÉE EN PREMIER. Le fourre-tout
  // `**/api/**` posé APRÈS avalait donc /api/relais et répondait `{pret:true}` :
  // le banc mesurait « 0 appel » alors que l'app en faisait bien un. On pose le
  // général d'abord, le particulier ensuite — sinon le contrôle 1 serait vert
  // par construction.
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  await pg.route('**/api/relais**',r2=>{etat.relais++; r2.fulfill({status:200,contentType:'application/json',body:RELAIS});});
  // déterminisme : ni tuiles ni photos du CDN Vinted
  await pg.route('**tile.openstreetmap**',r2=>r2.fulfill({status:200,contentType:'image/png',body:PNG1}));
  await pg.route('**://*.vinted.net/**',r2=>r2.abort());
  await pg.goto('http://localhost:4393/?tab=cat_achats',{waitUntil:'domcontentloaded'});
  // on attend que le bloc « à retirer » soit rendu ET que le nuage soit là
  let v=null; const t0=Date.now();
  while(Date.now()-t0<20000){ await pg.waitForTimeout(500); v=await pg.evaluate(LIRE); if(v.total!=null && Date.now()-t0>(delaiMain||0)+2500) break; }
  await pg.waitForTimeout(1000); v=await pg.evaluate(LIRE);
  return {ctx,pg,errs,etat,v};
}

// Prépare EN MÉMOIRE un colis au relais si la vraie base n'en a plus aucun.
function prepareRelais(purch){
  const copie=JSON.parse(JSON.stringify(purch)); let n=0;
  for(const r of copie){ const L=(r.data&&r.data.payload&&r.data.payload.my_orders)||[];
    const o=L.find(x=>x&&x.transaction_id); if(o){ o.status=STATUT_RELAIS; delete o.transaction_user_status; n++; } }
  return {copie,n};
}

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
  let purch=purchFx, main=mainFx;
  // ── Passe 1 : Achats ouvert en premier, puis on coche UN colis ici ─────────
  let p1=await rendre(b,{main,purch,delaiMain:1500});
  if(p1.v.actifs===0){
    // la vraie base n'a plus de colis au relais : on en fabrique, en mémoire
    const {copie,n}=prepareRelais(purch); purch=copie;
    const vide=JSON.parse(JSON.stringify(mainFx)); if(vide[0]&&vide[0].data){ vide[0].data.vinted_pickup_done={}; vide[0].data.vrm_colis_collected=[]; }
    main=vide; await p1.ctx.close();
    console.log('(aucun colis au relais dans la base : '+n+' préparé(s) en mémoire)');
    p1=await rendre(b,{main,purch,delaiMain:1500});
  }
  dit(p1.etat.relais===0, 'la recherche de points relais par ville, retirée (§4.11), ne repart pas', p1.etat.relais+' appel(s) à /api/relais');
  dit(!p1.v.garde && p1.errs.length===0, "l'écran Achats s'affiche (ni garde-fou ni erreur de page)", p1.errs.slice(0,2).join(' | '));
  dit(p1.v.total!=null && p1.v.actifs>=1, 'il y a au moins un colis à retirer à cocher', `total=${p1.v.total} · boutons ✓ Retiré=${p1.v.actifs} · en gris=${p1.v.gris}`);
  const CLES=['vinted_pickup_done','vrm_colis_collected'];
  const lireLS=(pg)=>pg.evaluate(k=>{const o={};for(const x of k)o[x]=localStorage.getItem(x);return o;},CLES);
  const avant=await lireLS(p1.pg);
  const cliqué=await p1.pg.evaluate(()=>{const x=document.querySelector('button[aria-label="Retiré"][title="J\'ai retiré ce colis"]'); if(!x) return false; x.click(); return true;});
  await p1.pg.waitForTimeout(1200);
  const ref=await p1.pg.evaluate(LIRE);
  const apres=await lireLS(p1.pg);
  // ce que l'app a ÉCRIT en cochant : la clé qui a changé, et sa valeur entière
  const changees=CLES.filter(k=>apres[k]!==avant[k]);
  dit(cliqué && changees.length===1, 'cocher « ✓ Retiré » écrit un réglage synchronisé', changees.join(',')||'rien écrit');
  dit(p1.v.total!=null && ref.total===p1.v.total-1 && ref.gris===p1.v.gris+1, 'référence : coché ici, le total baisse de un et le colis reste en gris', `total ${p1.v.total}→${ref.total} · gris ${p1.v.gris}→${ref.gris}`);
  await p1.pg.screenshot({path:SC+'/z-carte'+(W<500?'-tel':'')+'.png',fullPage:true});
  await p1.ctx.close();

  // ── Passe 2 : appareil NEUF, la même coche n'existe QUE dans le nuage ──────
  if(changees.length===1){
    const k=changees[0];
    const main2=JSON.parse(JSON.stringify(main));
    main2[0].data[k]=JSON.parse(apres[k]);
    const p2=await rendre(b,{main:main2,purch,delaiMain:1500});
    const lsK=await p2.pg.evaluate(x=>localStorage.getItem(x),k);
    dit(lsK===apres[k], 'le nuage a bien livré la coche à cet appareil', lsK===apres[k]?k:'localStorage ≠ nuage');
    dit(p2.v.total===ref.total, 'premier écran ouvert : le colis coché ailleurs ne compte plus dans « à retirer »', `affiché ${p2.v.total} · attendu ${ref.total} (comme après la coche locale)`);
    dit(p2.v.gris===ref.gris && p2.v.actifs===ref.actifs, '… et il reste visible en gris, pas caché', `en gris ${p2.v.gris}/${ref.gris} · à cocher ${p2.v.actifs}/${ref.actifs}`);
    dit(p2.etat.relais===0 && !p2.v.garde && p2.errs.length===0, 'appareil neuf : aucune recherche par ville, aucun écran tombé', `${p2.etat.relais} appel(s) · ${p2.errs.slice(0,2).join(' | ')}`);
    await p2.pg.screenshot({path:SC+'/z-carte-neuf'+(W<500?'-tel':'')+'.png',fullPage:true});
    await p2.ctx.close();
  } else {
    dit(false, 'premier écran ouvert : la coche venue du nuage est prise en compte', 'impossible à vérifier — la passe 1 n\'a rien écrit');
  }
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nLes points relais d\'Achats suivent le nuage dès le premier écran.');
  process.exit(ko?1:0);
})().catch(e=>{ console.log('KO  le banc a levé : '+(e&&e.stack||e)); try{srv.close();}catch(_){} process.exit(1); });
