// COMBIEN COÛTE L'ÉCRAN VENTES ? Il fait 19 844 px de haut au banc : on mesure
// le nombre de nœuds, le temps de rendu, et ce que coûte un filtre.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs=require('fs'), http=require('http'), path=require('path');
// ⚠️⚠️ JAMAIS UN CHEMIN ABSOLU ICI. La méthode de preuve du dossier (§6.1)
// extrait le code d'AVANT dans /tmp/avN, y copie le banc et le lance DEPUIS
// cet arbre. Avec '/home/user/cancale-v67/dist' écrit en dur, le banc servait
// le build COURANT : il mesurait le correctif en croyant mesurer le code
// d'avant, et sortait VERT sur le défaut. Un banc qui ne peut pas échouer est
// pire qu'absent — il rassure (même leçon qu'audit-coherence.cjs, qui sortait
// toujours en 0). Le dist se déduit de l'emplacement DU BANC.
const DIST=require('path').join(__dirname,'..','..','dist');
// ⚠️ fx/ est une copie de SA base (jamais dans le dépôt). Ce banc de VITESSE
// mesure le coût de l'écran Ventes À SON VOLUME : il lui faut des centaines de
// ventes, pas les deux lignes d'un secours minimal. `_base-volume.cjs` fabrique
// une base À LA FORME et au POIDS mesurés (aucune donnée réelle, elle vit dans
// le dépôt) et `repondre` émule PostgREST — exactement comme ses bancs sœurs
// `vitesse.cjs` et `ventes-frappe.cjs`. Tourne donc partout, fx/ ou pas.
const { fabriquer, repondre } = require('./_base-volume.cjs');
const base = fabriquer();
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
const PORT=Number(process.env.BANC_PORT||process.env.PORT)||4411; srv.listen(PORT);
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
  for(const [W,H,tag] of [[390,844,'iPhone'],[1512,950,'ordinateur']]){
  const pg=await b.newPage({viewport:{width:W,height:H}});
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  await pg.route('**/rest/v1/**',async route=>{const rq=route.request();
    if(rq.method()!=='GET') return route.fulfill({status:201,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'});
    const h=await rq.allHeaders();
    const rep=repondre(rq.url(),h.range,base);
    return route.fulfill({status:rep.status,contentType:'application/json',headers:{'access-control-allow-origin':'*',...(rep.headers||{})},body:JSON.stringify(rep.body)});});
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  const t0=Date.now();
  await pg.goto('http://localhost:'+PORT+'/?tab=cat_ventes',{waitUntil:'domcontentloaded'});
  for(let i=0;i<400;i++){ const n=await pg.evaluate(()=>document.querySelectorAll(".vrm-sale-row[data-tx]").length); if(n>50) break; await pg.waitForTimeout(50); }
  const pret=Date.now()-t0;
  const m=await pg.evaluate(()=>({noeuds:document.querySelectorAll('*').length,
     haut:document.documentElement.scrollHeight,
     cartes:document.querySelectorAll(".vrm-sale-row[data-tx]").length,
     // ⚠️ On ne compte QUE les photos de CONTENU (vignettes de ventes). Le LOGO
     //    (`/logo-vrm*.png`, en-tête/rail) est de la CHROME au-dessus de la ligne
     //    de flottaison : il doit charger TOUT DE SUITE, pas en lazy (sinon il
     //    clignote). L'ancien compte prenait le logo → rouge dès son ajout (30
     //    sept.), alors que l'app a raison. On l'exclut par son src.
     // ⚠️ Même règle pour les LOGOS DE PLATEFORME du rail (`/brands/*.svg`,
     //    posés le 13 octobre, 13f6c89) : de la chrome locale, toujours
     //    visible, jamais une vignette de vente. Une photo de vente vient du
     //    CDN de Vinted (ou d'une URL objet) et reste comptée.
     images:[...document.querySelectorAll('img')].filter(i=>!/logo-vrm|vrm-logo|^\/brands\//i.test(i.getAttribute('src')||'')).length,
     pasLazy:[...document.querySelectorAll('img')].filter(i=>!/logo-vrm|vrm-logo|^\/brands\//i.test(i.getAttribute('src')||'') && i.getAttribute('loading')!=='lazy').length}));
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
  // ⚠️ LES TOTAUX DE L'ÉCRAN VENTES VIVENT DANS « ANALYSE DE TES VENTES »
  // depuis le 13 octobre (156c95c, « Recomposer les écrans autour des outils
  // et des listes » — décision écrite dans docs/design/ui-responsive.md :
  // « Les totaux et graphiques de Ventes sont accessibles dans Analyse »).
  // Le dépliant est replié par défaut ; on l'ouvre (SON geste) et on lit les
  // totaux là — étiquette « CA finalisé » puis « N ventes », « En attente »
  // puis « N en cours ». Avant, ce banc prenait « la première ligne avec un
  // € » : sous la forme actuelle c'était le prix d'une CARTE, et le contrôle
  // « les totaux ne bougent pas » était vert par vacuité.
  await pg.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Analyse de tes ventes/.test(x.textContent)); if(b && b.getAttribute('aria-expanded')!=='true') b.click();});
  await pg.waitForFunction(()=>(document.body.innerText||'').split('\n').some(l=>/^CA finalis/i.test(l.trim())),null,{timeout:8000}).catch(()=>{});
  const totaux=()=>pg.evaluate(()=>{
    const t=(document.body.innerText||'').split('\n').map(x=>x.trim()).filter(Boolean);
    const apres=(re,re2)=>{const i=t.findIndex(l=>re.test(l)); if(i<0) return null;
      for(let j=i+1;j<Math.min(t.length,i+4);j++){const m=re2.exec(t[j]); if(m) return m[1];} return null;};
    return {ca:apres(/^CA finalis/i,/^([\d\s\u202f\u00a0.,]+\s?€)$/), nb:apres(/^CA finalis/i,/^(\d+) ventes?$/)};
  });
  // (30 oct.) Les lignes se comptent par `.vrm-sale-row[data-tx]` : le champ
  // « prix d'achat » de « N° et frais » n'existe plus tant que « Saisir le prix »
  // est visible (même écriture), il ne compte plus les ventes.
  // ⚠️ ON NE DESSINE QU'UNE TRANCHE — mais RIEN n'est perdu : le bouton dit le
  // total, et un clic ouvre la suite. Et les totaux du haut portent TOUJOURS
  // sur l'ensemble, jamais sur la tranche affichée.
  const av=await pg.evaluate(()=>{
    const t=document.body.innerText||'';
    const b=[...document.querySelectorAll('button')].find(x=>/Voir plus/.test(x.textContent));
    return {n:document.querySelectorAll(".vrm-sale-row[data-tx]").length,
            bouton:b?b.textContent.trim():null};
  });
  Object.assign(av, await totaux());
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
  const ap=await pg.evaluate(()=>({n:document.querySelectorAll(".vrm-sale-row[data-tx]").length}));
  Object.assign(ap, await totaux());
  dit(ap.n > av.n, `${tag} : un clic ouvre la suite`, av.n+' -> '+ap.n+' cartes');
  dit(!!av.ca && !!av.nb && av.ca === ap.ca && av.nb === ap.nb,
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
    const lignes=L?[...L.children].filter(r=>!r.classList.contains('vrm-ledger-heading')):null; // (20 oct.) l'en-tête « Article · état » (#597) n'est pas une vente
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
