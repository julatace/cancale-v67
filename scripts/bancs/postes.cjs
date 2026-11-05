// Cocher « Colis fait » ne fait disparaître PERSONNE en silence, et le compte
// du haut colle à la liste (§26 : un bloc conditionnel se vérifie RENDU, avec
// des données ; §5 : « un colis caché est un colis perdu »).
// ⚠️ LA FORME A CHANGÉ EXPRÈS LE 30 SEPTEMBRE (5853696, Julien : « les
// bordereaux doivent s'enlever quand les ventes sont expédiées ») : un colis
// coché « posté » QUITTE la liste affichée, et une ligne l'ANNONCE (« Afficher
// les N colis marqués « postés » ») ; un clic les remontre sous l'intertitre
// « Déjà postés · N » (`data-groupe="fait"`). Avec un seul groupe, la liste n'a
// volontairement aucun intertitre. Ce banc cherchait encore l'intertitre
// toujours visible : il juge maintenant la MÊME règle sur la forme actuelle —
// affichés + annoncés = la liste d'avant, et dérouler les postés montre
// exactement ceux qui ont été annoncés, rangés sous leur intertitre.
// ⚠️ Et il n'attend plus 3,5 s à l'aveugle : sous charge (bancs lancés
// ensemble) la liste n'était pas encore là, rien n'était coché, et six
// contrôles tombaient sur un artefact. Il attend que le RÉSEAU se taise et que
// l'écran ne bouge plus (plafond 20 s : une liste qui n'arrive jamais reste
// rouge).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const { dressingsDuJour } = require('./_instantane.cjs'); // fx/ est une photo datée : la lecture du dressing la plus récente = « il y a 1 min » (règle « en ligne » ≤ 24 h)
const fs=require('fs'), http=require('http'), path=require('path');
// ⚠️⚠️ JAMAIS UN CHEMIN ABSOLU ICI. La méthode de preuve du dossier (§6.1)
// extrait le code d'AVANT dans /tmp/avN, y copie le banc et le lance DEPUIS
// cet arbre. Avec '/home/user/cancale-v67/dist' écrit en dur, le banc servait
// le build COURANT : il mesurait le correctif en croyant mesurer le code
// d'avant, et sortait VERT sur le défaut. Un banc qui ne peut pas échouer est
// pire qu'absent — il rassure (même leçon qu'audit-coherence.cjs, qui sortait
// toujours en 0). Le dist se déduit de l'emplacement DU BANC.
const DIST=require('path').join(__dirname,'..','..','dist'), SC=__dirname;
const sc=require('./_scenario-colis.cjs');
const FX=f=>JSON.parse(fs.readFileSync(path.join(SC,'fx',f+'.json'),'utf8'));
const FXok=f=>{try{return FX(f);}catch(_){return [];}};
const present=sc.present(SC);
// ⚠️ fx/ absent : 6 ventes à expédier, dont 2 DÉJÀ cochées « posté »
// (`vinted_ship_done`). C'est la situation que ce banc mesure — il en coche 2 de
// plus, puis déroule « Déjà postés ». Statut `needs_action`+« paiement validé »
// = `aExpedier` vrai (mesuré dans App.jsx), aucune donnée réelle.
const PRE=['8801','8802']; const now=sc.NOW;
const soldSc = present ? [] : [sc.ligneSold(sc.UID[0], ['8801','8802','8803','8804','8805','8806'].map((tx,i)=>
  sc.ordre({tx, titre:'Nike Dunk Low '+(i+1), prix:40+i, statut:sc.STATUT_AEXP, tus:'needs_action', dateMs:now-(i+1)*86400e3})))];
const main=present?FX('main'):sc.ligneMain({vinted_ship_done:Object.fromEntries(PRE.map(t=>[t,sc.iso(now-3*86400e3)]))});
const accounts=present?FX('accounts'):sc.comptes(), txn=present?FX('txn'):[];
const rows=[...(present?FX('sold'):soldSc),...FXok('purch'),...dressingsDuJour(FXok('listings')),...FXok('inbox')];
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.listen(4379);
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
  const pg=await b.newPage({viewport:{width:1512,height:950}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  let derniere=Date.now();
  await pg.route('**/rest/v1/**',route=>{derniere=Date.now(); const u=metaVersData(route.request().url());
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    if(route.request().method()!=='GET') return j([]);
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    if(/id=eq\.main/.test(u)) return j(main);
    if(/transaction->>id/.test(u)) return j(txn);
    const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return j(rows.filter(r=>r.id===k));}
    const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');return j(rows.filter(r=>re.test(r.id)));}
    return j([]);});
  await pg.route('**/api/**',r2=>{derniere=Date.now(); return r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'});});
  await pg.goto('http://localhost:4379/?tab=cat_bord',{waitUntil:'domcontentloaded'});
  // Ce que l'écran DIT, lu sur le rendu :
  //  · entete  — le nombre du haut (« N colis à envoyer » ; « Aucun » = 0) ;
  //  · cartes  — les cartes affichées ;
  //  · postes  — le nombre ANNONCÉ par la ligne « … les N colis marqués postés »
  //              (0 si la ligne n'est pas là) ; montres = la liste les montre ;
  //  · sep     — le nombre écrit sur l'intertitre du groupe « fait ».
  // (2 nov., colis clair) Un colis coché « posté » quitte la liste de travail et
  // va dans « Partis » (replié), sous un intertitre — une ligne en tête le dit
  // (`data-voir-postes`, son nombre). Même règle qu'avant : personne ne disparaît
  // (cartes + postés = la liste d'avant), le compte du haut colle aux cartes.
  // (3 nov., nouvelle mise en page) « Partis » est l'onglet « Envoyés » : le compte lit « À envoyer », puis
  // l'onglet « Envoyés » (les cochés y sont, marqués `data-postes-pas-partis` / `data-postes-recents`).
  const lireEnvoyer=()=>pg.evaluate(()=>{
    const t=document.body.innerText||'';
    const m=/(\d+)\s*\n?\s*colis à envoyer/.exec(t);
    return {entete: m?+m[1]:(/Aucun colis à envoyer/.test(t)?0:null),
            cartes: document.querySelectorAll('[data-bord-card]').length,
            cartesPostees: [...document.querySelectorAll('[data-bord-card]')].filter(el=>/Pas encore/.test(el.innerText)).length};
  });
  const lirePartis=()=>pg.evaluate(()=>{
    const partis=document.querySelector('[data-colis-partis]');
    return {postes: partis&&partis.hasAttribute('data-partis-coches')?+partis.getAttribute('data-partis-coches'):0,
            dansPartis: partis?partis.querySelectorAll('[data-parti="coche"]').length:0,
            sousIntertitre: [...document.querySelectorAll('[data-colis-partis] [data-postes-pas-partis][data-parti="coche"], [data-colis-partis] [data-postes-recents][data-parti="coche"]')].length};
  });
  const compte=async()=>{
    await pg.click('[data-colis-onglet-choix="envoyer"]').catch(()=>{}); await pg.waitForTimeout(150);
    const e=await lireEnvoyer();
    await pg.click('[data-colis-onglet-choix="envoyes"]').catch(()=>{}); await pg.waitForTimeout(250);
    const p=await lirePartis();
    await pg.click('[data-colis-onglet-choix="envoyer"]').catch(()=>{}); await pg.waitForTimeout(150);
    return {...e,...p};
  };
  const stable=async(besoinCartes)=>{
    const t0=Date.now(); let prev='', n=0, s=null;
    while(Date.now()-t0<20000){
      await pg.waitForTimeout(250);
      s=await compte(); const k=JSON.stringify(s);
      if(k===prev) n++; else {n=0; prev=k;}
      if(n>=6 && Date.now()-derniere>1200 && (!besoinCartes || s.cartes>0)) return s;
    }
    return s;
  };
  const a=await stable(true);
  dit(a.cartes>0, 'la liste des colis est rendue', a.cartes+' cartes · en-tête '+a.entete+' · '+a.postes+' postés annoncés');
  dit(a.entete===a.cartes && a.postes===a.dansPartis && a.dansPartis===a.sousIntertitre && a.cartesPostees===0,
      'au départ déjà : le compte du haut = les cartes, et les postés annoncés sont tous dans « Partis », sous leur intertitre',
      JSON.stringify(a));
  for(let i=0;i<2;i++){
    await pg.evaluate(()=>{/* (5 nov., chantier D) le geste « Colis fait » s'appelle « Déposé » : on le prend par son data-geste */ const b=[...document.querySelectorAll('[data-bord-card] button[data-geste="fait"]')].find(x=>!/Pas encore/.test(x.textContent)); if(b)b.click();});
    await pg.waitForTimeout(700);
  }
  const c=await stable(false);
  dit(c.postes===a.postes+2 && c.dansPartis===a.dansPartis+2, 'l\'annonce des colis « postés » monte de 2, et « Partis » les porte',
      `${a.postes} -> ${c.postes} · Partis ${a.dansPartis} -> ${c.dansPartis}`);
  dit(c.cartes+c.dansPartis===a.cartes+a.dansPartis, 'aucun colis ne disparaît en le cochant (cartes + « Partis »)',
      `${c.cartes} + ${c.dansPartis} (avant ${a.cartes} + ${a.dansPartis})`);
  dit(c.entete===a.entete-2 && c.entete===c.cartes, "l'en-tête ne compte plus que les colis qui restent", `${a.entete} -> ${c.entete}`);
  dit(c.cartesPostees===0, 'aucun colis posté ne reste dans la liste de travail (chaque colis une fois)', String(c.cartesPostees));
  // « ↺ Pas encore posté » le remet dans la liste.
  await pg.click('[data-colis-onglet-choix="envoyes"]').catch(()=>{}); await pg.waitForTimeout(400);
  await pg.evaluate(()=>{const b=document.querySelector('[data-colis-partis] [data-annuler-poste]'); if(b) b.click();});
  await pg.click('[data-colis-onglet-choix="envoyer"]').catch(()=>{}); await pg.waitForTimeout(300);
  const d=await stable(false);
  await pg.screenshot({path:SC+'/z-postes.png',fullPage:true});
  dit(d.cartes===c.cartes+1 && d.dansPartis===c.dansPartis-1, '« ↺ Pas encore posté » le remet dans la liste, une fois', JSON.stringify(d));
  const ordre=await pg.evaluate(()=>{
    const g=[...document.querySelectorAll('[data-bord-card]')][0]?.parentElement;
    if(!g) return null;
    // (3 nov., nouvelle mise en page) l'intertitre de la liste = l'en-tête de SON transporteur (`data-groupe-transp`).
    return [...g.children].map(el=>el.hasAttribute('data-bord-card') ? 'carte' : el.hasAttribute('data-groupe') ? 'SEP:'+el.getAttribute('data-groupe') : el.hasAttribute('data-groupe-transp') ? 'SEP:'+el.getAttribute('data-groupe-transp') : 'AUTRE').join(',');
  });
  dit((ordre||'').startsWith('SEP'), 'la liste s\'ouvre par un intertitre', ordre);
  dit(errs.length===0, "aucune erreur d'app", errs.slice(0,2).join(' | '));
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nLe compte du haut et la liste disent la meme chose.');
  process.exit(ko?1:0);
})();
