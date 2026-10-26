// La saisie EN SÉRIE des prix d'achat : ouverture, suggestions, un tap relie.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
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
// ⚠️ fx/ absent : 60 paires numérotées sans prix d'achat + leurs achats (18 au
// titre identique → « C'est ça », 42 marque+taille → « à vérifier »), dont 20
// aussi vendues pour que l'écran Ventes ait sa case « Bénéfice ». Le moteur de
// suggestion (§5.23) est réellement exercé — aucune donnée réelle.
const S=present?null:sc.achatsScenario();
const accounts=present?FX('accounts'):S.accounts, main=present?FX('main'):S.main, txn=present?FX('txn'):[];
const rows=[...(present?FX('sold'):S.sold),...(present?FX('purch'):S.purch),...dressingsDuJour(present?FX('listings'):S.listings),...FXok('inbox')];
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.listen(4341);
const ecrits=[];
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
  const pg=await b.newPage({viewport:{width:1512,height:950}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  await pg.route('**/rest/v1/**',route=>{const u=metaVersData(route.request().url()); const req=route.request();
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    if(req.method()!=='GET'){ try{ecrits.push(req.postData());}catch(_){}; return j([]); }
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    if(/id=eq\.main/.test(u)) return j(main);
    if(/transaction->>id/.test(u)) return j(txn);
    const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return j(rows.filter(r=>r.id===k));}
    const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');return j(rows.filter(r=>re.test(r.id)));}
    return j([]);});
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  await pg.goto('http://localhost:4341/?tab=cat_ventes',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(4000);
  // (30 sept.) Sans aucun prix d'achat, la case « Coût d'achat » se tait et c'est
  // « Bénéfice estimé — » qui ouvre la saisie : une absence, une case (§7).
  // (20 oct.) La case s'appelle « Bénéfice » (« — ») depuis la carte brut/net du 19 octobre ; on la reconnaît à
  // ce qu'elle FAIT (son titre « … prix d'achat, paire par paire »), pas à son seul libellé.
  const PORTE=/Coût d'achat|Bénéfice/i;
  // Les totaux vivent dans « Analyse de tes ventes » (repliée par défaut).
  await pg.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Analyse de tes ventes/.test(x.textContent)&&/voir/.test(x.textContent)); if(b) b.click();});
  await pg.waitForTimeout(600);
  const n=await pg.evaluate((src)=>{const re=new RegExp(src,'i');return [...document.querySelectorAll('button')].filter(b=>re.test(b.textContent)&&/prix d'achat/i.test(b.title||'')).length;}, PORTE.source);
  dit(n>0, 'la case qui ouvre la saisie des prix d\'achat (« Coût d\'achat » ou « Bénéfice estimé ») est cliquable sur l\'écran Ventes', n+' trouvée(s)');
  if(!n){ await pg.screenshot({path:SC+'/s-ventes.png'}); await b.close(); srv.close(); process.exit(1); }
  const t0=Date.now();
  await pg.evaluate((src)=>{const re=new RegExp(src,'i');[...document.querySelectorAll('button')].find(b=>re.test(b.textContent)&&/prix d'achat/i.test(b.title||'')).click();}, PORTE.source);
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
  // ⚠️ L'EN-TÊTE A CHANGÉ EXPRÈS. Il disait « N achats retrouvés » quand la
  // modale ne gardait que LA suggestion sûre (>= SEUIL_SUGGERE) par paire. Depuis
  // que chaque paire montre aussi ses pistes « à vérifier » (>= SEUIL_CANDIDAT,
  // jusqu'à 3 — voir `fillBuySugg` et le banc `prixachat.cjs` : 111 sûres → 236
  // avec une piste), l'en-tête compte les PAIRES : « N paires avec une piste ».
  // Chercher l'ancienne phrase rendait `null` sur une app intacte.
  // On juge la même règle sur la forme actuelle, et on la serre : le nombre
  // annoncé doit être celui des lignes qui portent VRAIMENT une piste rendue
  // (§5 : la phrase qui explique un chiffre vient de la même source que lui).
  // Et on attend la fin de « recherche de tes achats… » : l'en-tête ne dit le
  // nombre qu'une fois les achats lus.
  for(let i=0;i<80;i++){ const enCours=await pg.evaluate(()=>/recherche de tes achats/i.test(document.body.innerText||'')); if(!enCours) break; await pg.waitForTimeout(100); }
  const sugInfo=await pg.evaluate(()=>{
    const t=document.body.innerText||'';
    const m=/(\d+)\s+(?:paires?|articles?)\s+avec\s+une\s+piste/.exec(t);
    // une ligne = le plus haut ancêtre du champ qui ne contient QUE ce champ
    const ligne=inp=>{ let n=inp; while(n.parentElement && n.parentElement.querySelectorAll('[data-fillbuy]').length===1) n=n.parentElement; return n; };
    const rendues=[...document.querySelectorAll('[data-fillbuy]')].map(ligne)
      .filter(n=>[...n.querySelectorAll('button')].some(b=>/C'est [çc]a|à v[ée]rifier/i.test(b.innerText||''))).length;
    return {annonce:m?+m[1]:null, rendues};
  });
  const sug=sugInfo.annonce;
  dit(sug!=null && sug>0, 'des achats sont retrouvés', sug+' paires avec une piste');
  dit(sug!=null && sug===sugInfo.rendues, 'le nombre de paires « avec une piste » est celui des lignes qui en montrent une',
    `${sug} annoncées · ${sugInfo.rendues} rendues`);
  console.log('    >>> SUGGESTIONS : '+sug);
  // ⚠️ L'EN-TÊTE COMPTAIT 320 PAIRES, LA LISTE EN RENDAIT 300 (plafond en dur) :
  // vingt paires n'étaient atteignables nulle part, et la chaîne « Entrée » —
  // qui passe à la suivante — s'arrêtait net à la 300ᵉ. Le compte annoncé doit
  // être celui qu'on peut vraiment saisir.
  const cmp=await pg.evaluate(()=>{
    const t=document.body.innerText||'';
    const m=/(\d+)\s+(?:paires?|articles?)\s+sans\s+co[ûu]t/.exec(t);
    return {annonce:m?+m[1]:null, rendus:document.querySelectorAll('[data-fillbuy]').length};
  });
  dit(cmp.annonce!=null && cmp.annonce===cmp.rendus,
    'toutes les paires annoncées sont vraiment saisissables',
    `${cmp.annonce} annoncées · ${cmp.rendus} rendues`);
  console.log('    ' + info.entete);
  // un tap sur une suggestion
  const avant=ecrits.length;
  const sugg=await pg.evaluate(()=>{
    // ⚠️ (20 oct.) Chercher « un bouton avec € et une marque » sur toute la page attrapait la LIGNE DE VENTE repliée
    //    de l'écran derrière la modale (« N°25 · adidas spezial… 54 € ⋯ », 5cdffcb) : le banc cliquait une vente, pas
    //    une suggestion. On ne prend qu'un bouton « C'est ça » rendu DANS une ligne de la saisie en série.
    const ligne=inp=>{ let n=inp; while(n.parentElement && n.parentElement.querySelectorAll('[data-fillbuy]').length===1) n=n.parentElement; return n; };
    const b=[...document.querySelectorAll('[data-fillbuy]')].map(ligne).flatMap(n=>[...n.querySelectorAll('button')]).filter(x=>/C'est [çc]a/i.test(x.innerText||''));
    if(!b.length) return null; const t=b[0].textContent.trim().slice(0,70); b[0].click(); return t;
  });
  await pg.waitForTimeout(3000);
  dit(!!sugg, 'une suggestion d\'achat est proposée et cliquable', sugg||'aucune');
  const local=await pg.evaluate(()=>{ try{const n=JSON.parse(localStorage.getItem('vinted_annonce_numeros')||'{}');
    const k=Object.keys(n).filter(k=>n[k]&&n[k].buyFromId); return k.length?`${k[0]} -> ${n[k[0]].buyPrice} €`:null; }catch(_){return null;} });
  dit(!!local, 'le prix d\'achat est écrit sur la paire', local||'rien écrit');
  // ⚠️ PLUS DE CONTRÔLE « poussé dans le cloud » ICI. Depuis le durcissement du
  //    4 octobre, `cloudPush` sort d'emblée sans une VRAIE session cloisonnée
  //    (`if (!owner || !AUTH.session?.access_token || !CLOISONNE) return`). Ce
  //    banc rend l'app en ACCÈS DIRECT (`vrm_acces_direct`, sans session) : le
  //    push y est désactivé PAR CONCEPTION. Exiger un POST ici ne mesurerait plus
  //    l'app, mais l'absence de session du banc — un contrôle qui ne peut JAMAIS
  //    passer est aussi trompeur qu'un qui ne peut jamais échouer. Le prix est
  //    bien écrit (contrôle au-dessus) ; la synchro cloud, gardée par la session,
  //    est prouvée par `demarrage.cjs` (qui en simule une). §6.3 dans l'autre sens.
  console.log('    (synchro cloud gardée par la session — hors accès direct ; voir demarrage.cjs)');
  dit(errs.length===0, 'aucune erreur d\'app', errs.slice(0,2).join(' | '));
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nLa saisie en serie fonctionne.');
  process.exit(ko?1:0);
})();
