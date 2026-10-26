// LE BLOC « COLIS JAMAIS RETIRÉS » (devenu « À VÉRIFIER » le 23 oct.), rendu au banc.
// Julien : « il n'y a pas tous les codes de retrait ». Mesuré sur la vraie
// base : 6 colis rangés ici, dont **3 portent un QR** — et le bloc n'affichait
// que le code. Le QR, seul moyen de retrait d'un casier Pickup, ne s'affichait
// nulle part. §26 : un bloc conditionnel ne vaut que RENDU, avec des données.
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
// ⚠️ fx/ absent : 3 colis « disponibles » vieux de 30 j, hors fenêtre de retrait
// — un avec code+QR, un QR seul, un code seul. C'est la plainte mesurée (« il
// n'y a pas tous les codes ») : le bloc « à vérifier » doit tous les montrer,
// code ET QR. QR via une URL /api/barcode/datamatrix (la seule que l'app accepte).
const trackSc = present ? [] : [
  sc.trackColis({n:1, code:'483921', qr:true}),
  sc.trackColis({n:2, qr:true}),
  sc.trackColis({n:3, code:'B4821'}),
];
const main=present?FX('main'):sc.ligneMain(), accounts=present?FX('accounts'):sc.comptes(), txn=present?FX('txn'):[];
const track=present?FX('track'):trackSc;
const rows=[...FXok('sold'),...FXok('purch'),...dressingsDuJour(FXok('listings')),...FXok('inbox'),...track];
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.zip':'application/zip'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.listen(4401);
// ce que la base contient vraiment, pour comparer à l'écran
// ⚠️ Les n° de suivi de SES bordereaux se lisent dans `bord` : `rows` ne porte
// aucune ligne `email_bord_*`, et l'ancien filtre sur `rows` rendait toujours un
// ensemble VIDE — la réplique n'écartait donc aucun colis sortant.
const env=new Set(FXok('bord').map(r=>String((r.data||{}).suivi||'').trim().toUpperCase()).filter(Boolean));
// ⚠️ UN QR EN BASE ≠ UN VRAI QR. `qrUrl` porte AUSSI des bannières et des
// mouchards Pickup (`/tracking/1/open/…`, `avn-prod/…_PARCEL`, `banner-mail`) :
// l'app les écarte à l'affichage (`URL_PAS_UN_QR`) — c'est VOULU (§5.28). Un
// contrôle qui compte `qrB64||qrUrl` mesure donc une fiction et sort rouge sur
// un app CORRECTE (3 vrais QR affichés, 1 mouchard écarté). On compte ici le QR
// comme l'app décide de le MONTRER : b64, ou un code-barres certain, ou une url
// qui n'est pas un mouchard connu.
const QR_PAS=/\/tracking\/|\/open\/|\/o\/|pixel|spacer|1x1|banner|banni[eè]re|logo|header|footer|enquete|enqu[eê]te|satisfaction|unsubscribe|desabonn|d[eé]sabonn|facebook|instagram|twitter|linkedin|youtube|email-messaging\.com|avn-prod|azureedge|drop[_-]?off|dropoff|_parcel|illustration|visuel|\.svg(\?|$)/i;
const QR_CERTAIN=/\/(?:api\/)?barcode\/(?:datamatrix|azteccode|aztec|qrcode|qr|pdf417|code128|code39|ean13)\b/i;
const qrReel=(d)=>!!(d.qrB64 || (d.qrUrl && (QR_CERTAIN.test(d.qrUrl) || !QR_PAS.test(d.qrUrl))));
// ⚠️ UN CODE EN BASE ≠ UN CODE AFFICHABLE. Une ligne porte le MOT « suivant »
// comme code (ancien motif trop large) : l'app l'écarte à l'affichage
// (`codeRetrait`, §5) — c'est VOULU. Exiger qu'il s'affiche serait rouge sur une
// app correcte. On compte le code comme l'app décide de le MONTRER.
const codeOk=c=>/^[A-Z]{0,2}\d{3,10}$/.test(String(c==null?'':c).trim());
// ── ⚠️ LA SITUATION N'EXISTE PLUS DANS LA VRAIE BASE : ON LA PRÉPARE ─────────
// Mesuré le 5 octobre sur les fixtures : 26 lignes « colis disponible », dont
// 25 cochées ✓ par Julien — la 26ᵉ est SA preuve de dépôt (« entre de bonnes
// mains »), que l'app écarte à raison (`sensColis` → 'sortant'). Plus aucun
// colis oublié : le bloc ne pouvait plus s'afficher, et le banc sortait rouge
// (« titre introuvable ») sur une app CORRECTE. Un contrôle qui ne peut plus se
// déclencher ne protège rien : on recrée la situation d'origine (6 colis jamais
// retirés, dont 3 avec un vrai QR — la mesure qui a fait naître ce bloc) en
// DÉCOCHANT EN MÉMOIRE de vrais colis qui la remplissent. Rien n'est écrit sur
// disque, aucune valeur réelle n'est recopiée dans ce fichier.
// On ne décoche QUE des colis que l'app DOIT ranger dans ce bloc : entrants
// (sujet sans ambiguïté, mêmes motifs que `sensColis`), hors bordereau, jamais
// confirmés retirés ailleurs, et HORS fenêtre de retrait (`isColisActive` :
// 14 j, ou limite + 10 j de grâce) — avec UN JOUR DE MARGE, pour que le passage
// ne dépende pas de l'heure.
const SUJET_SORTANT=/entre de bonnes mains|preuve de d[ée]p[ôo]t|confirmation du d[ée]p[ôo]t|d[ée]p[ôo]t de votre colis|colis est d[ée]pos[ée]|bordereau d.envoi/i;
const SUJET_ENTRANT=/est arriv|disponible|[àa] retirer|en consigne|en relais|pr[êe]t [àa] [êe]tre retir/i;
const entrant=d=>d.sens ? d.sens==='entrant' : (SUJET_ENTRANT.test(d.subject||'') && !SUJET_SORTANT.test(d.subject||''));
const joursAvant=l=>{ if(!l) return null; const f=new Date(String(l)+'T00:00:00'); if(isNaN(f)) return null; const a=new Date(); a.setHours(0,0,0,0); return Math.round((f-a)/86400000); };
const horsFenetre=d=>{ const age=(Date.now()-new Date(d.receivedAt).getTime())/86400000; if(!(age>15)) return false; const jl=joursAvant(d.limite); return jl==null || jl< -11; };
const UP=v=>String(v||'').trim().toUpperCase(), cle=d=>String(d.suivi||d.subject||'').trim();
const livres=new Set(track.map(r=>r.data).filter(d=>d&&d.status==='delivered'&&d.suivi).map(d=>UP(d.suivi)));
const cochesBase=new Set(((main[0].data.vrm_colis_collected)||[]).map(String));
const candidats=track.map(r=>r.data).filter(d=>d&&d.status==='available'&&cochesBase.has(cle(d))&&entrant(d)&&!env.has(UP(d.suivi))&&!livres.has(UP(d.suivi))&&horsFenetre(d)&&(qrReel(d)||codeOk(d.code)))
  .sort((a,b)=>new Date(b.receivedAt)-new Date(a.receivedAt));
const decoches=[...candidats.filter(qrReel).slice(0,3), ...candidats.filter(d=>!qrReel(d)&&codeOk(d.code)).slice(0,3)];
{ const out=new Set(decoches.map(cle)); const md=main[0].data;
  md.vrm_colis_collected=(md.vrm_colis_collected||[]).filter(k=>!out.has(String(k)));
  if(md.vrm_colis_collected_at){ const at={...md.vrm_colis_collected_at}; out.forEach(k=>{delete at[k];}); md.vrm_colis_collected_at=at; } }
const coches=new Set(((main[0].data.vrm_colis_collected)||[]).map(String));
const j=(d)=>Math.round((Date.now()-new Date(d).getTime())/86400000);
// Un colis que TU as déposé (« entre de bonnes mains ») n'est pas un colis
// oublié : l'app l'écarte (`sensColis` → 'sortant'), la réplique aussi.
const sortant=d=>d.sens ? d.sens==='sortant' : (SUJET_SORTANT.test(d.subject||'') && !SUJET_ENTRANT.test(d.subject||''));
const vieux=track.map(r=>r.data).filter(d=>d.status==='available' && !coches.has(String(d.suivi)) && !env.has(String(d.suivi||'').trim().toUpperCase()) && !sortant(d) && j(d.receivedAt)>14);
const avecQR=vieux.filter(qrReel).length, avecCode=vieux.filter(d=>codeOk(d.code)).length;
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
(async()=>{
  console.log('situation préparée : '+decoches.length+' colis décoché(s) en mémoire ('+decoches.filter(qrReel).length+' avec QR, '+decoches.filter(d=>!qrReel(d)).length+' avec code seul) — aucun fichier écrit');
  console.log('base servie : '+vieux.length+' colis trop vieux · '+avecCode+' avec code · '+avecQR+' avec QR');
  // Sans au moins un QR ET un code dans la base servie, les contrôles QR/code
  // ci-dessous seraient VIDES (« 0 pour 0 ») — verts sans rien prouver.
  dit(avecQR>0 && avecCode>0, 'la base servie porte un colis oublié avec QR et un avec code', avecQR+' QR · '+avecCode+' code(s)');
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
  const pg=await b.newPage({viewport:{width:1512,height:950}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  await pg.route('**/rest/v1/**',route=>{const u=metaVersData(route.request().url());
    const jj=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    if(route.request().method()!=='GET') return jj([]);
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return jj(accounts);
    if(/id=eq\.main/.test(u)) return jj(main);
    if(/transaction->>id/.test(u)) return jj(txn);
    const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return jj(rows.filter(r=>r.id===k));}
    const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');return jj(rows.filter(r=>re.test(r.id)));}
    return jj([]);});
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  // ⚠️ LE BANC DOIT SERVIR LES IMAGES DE CODE-BARRES. Sans réseau, l'image
  // échoue, `noterImgMorte` retire le QR (comportement voulu de l'app) — et le
  // banc mesurait « 0 QR » sur un code parfaitement valide. On sert donc un
  // vrai PNG pour les URL de code-barres Pickup, les seules que l'app accepte.
  const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHUlEQVQoz2NgGAWjYBSMglEwCkbBKBgFo2AUUAcAB1QAAeYb1qEAAAAASUVORK5CYII=','base64');
  await pg.route('**/api/barcode/**',r2=>r2.fulfill({status:200,contentType:'image/png',body:PNG}));
  await pg.goto('http://localhost:4401/?tab=cat_achats',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(5000);
  await pg.screenshot({path:SC+'/z-oublies.png',fullPage:true});
  // ⚠️ ON JUGE DANS LE BLOC, PAS SUR TOUTE LA PAGE. Le même bouton QR existe
  // dans trois autres listes de l'écran (à retirer, cochés en gris…), et un code
  // de 4 à 6 chiffres peut traîner ailleurs : compté sur la page, un QR absent du
  // bloc pouvait être « trouvé » dans la liste voisine — vert par accident.
  // (23 oct.) Le bloc « colis jamais retirés » (> 14 j) est devenu « À VÉRIFIER »
  // (délai de retrait écrit dépassé, ou plus de 7 j au relais — la garde mesurée).
  // Il porte `data-a-verifier` ; ce qu'il doit montrer ne change pas : chaque
  // code, chaque QR, et combien peuvent encore être retirés. Un colis de plus de
  // 14 jours y est toujours (14 > 7) : les exigences de ce banc restent entières.
  const v=await pg.evaluate(()=>{
    const bloc=document.querySelector('[data-a-verifier]');
    return {txt:document.body.innerText||'', bloc:bloc?(bloc.innerText||''):'', n:bloc?bloc.getAttribute('data-a-verifier'):null,
      qr:bloc?bloc.querySelectorAll('button[aria-label="Afficher le QR de retrait en grand"]').length:0};
  });
  // ⚠️ On ne compare PAS au compte de ma propre réplique des règles : elle est
  // plus grossière que celle de l'app (le sens entrant/sortant se lit sur le
  // sujet de l'email). Ce qui doit être vrai, c'est qu'AUCUN code et AUCUN QR
  // ne reste caché — c'est exactement la plainte de Julien.
  dit(v.n!=null && +v.n>=vieux.length, 'le bloc des colis à vérifier (jamais retirés) est rendu, et les porte tous',
    v.n!=null?('affiché : '+v.n+' · ma réplique en comptait au moins '+vieux.length):'bloc introuvable');
  dit(v.qr>=avecQR, 'chaque QR encore disponible est affiché', v.qr+' bouton(s) QR pour '+avecQR+' QR en base');
  vieux.filter(d=>codeOk(d.code)).forEach(d=>
    dit(v.bloc.includes(String(d.code).trim()), 'le code '+d.code+' est affiché'));
  dit(/encore leur code ou leur QR|encore son code ou son QR/.test(v.bloc),
    'le bloc dit combien peuvent encore être retirés', 'au lieu d\'envoyer tout le monde en réclamation');
  dit(errs.length===0, "aucune erreur d'app", errs.slice(0,2).join(' | '));
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):"\nAucun code, aucun QR ne reste cache.");
  process.exit(ko?1:0);
})();
