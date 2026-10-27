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
const path=require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs=require('fs'), http=require('http');
// ⚠️⚠️ JAMAIS UN CHEMIN ABSOLU ICI. La méthode de preuve du dossier (§6.1)
// extrait le code d'AVANT dans /tmp/avN, y copie le banc et le lance DEPUIS
// cet arbre. Avec '/home/user/cancale-v67/dist' écrit en dur, le banc servait
// le build COURANT : il mesurait le correctif en croyant mesurer le code
// d'avant, et sortait VERT sur le défaut. Un banc qui ne peut pas échouer est
// pire qu'absent — il rassure (même leçon qu'audit-coherence.cjs, qui sortait
// toujours en 0). Le dist se déduit de l'emplacement DU BANC.
const DIST=path.join(__dirname,'..','..','dist'), SC=__dirname;
const PORT=Number(process.env.BANC_PORT)||4474;
// ── DES VENTES INVENTÉES, PAS `fx/` (16 octobre) ─────────────────────────────
// Ce banc lisait la copie de sa base (`fx/`, gitignorée). Une copie vide ou
// absente ne donne AUCUNE vente : l'écran Ventes ne peut rien publier (un
// compte lié sans ventes lisibles bloque à raison la publication, §5) et le
// banc sortait rouge sur une app intacte — il mesurait la fixture, pas l'app.
// Les ventes sont donc inventées ICI (le banc vit dans le dépôt, qui est
// public : aucune donnée réelle), avec la FORME que l'app lit : la liste des
// ventes (`harvest_{uid}_orders_sold`, prix en objet `{amount}`) et la
// transaction finalisée (`harvest_{uid}_txn_{tx}`, statut 450 +
// `status_updated_at` = la date du VERSEMENT, qui date le CA déclaré).
const maintenant=new Date();
const ceMois=(j,h=12)=>{ const d=new Date(maintenant.getFullYear(),maintenant.getMonth(),Math.min(j,Math.max(1,maintenant.getDate())),h); return d>maintenant?new Date(maintenant.getTime()-3600e3):d; };
const moisPasse=(j)=>new Date(maintenant.getFullYear(),maintenant.getMonth()-1,j,12);
const iso=(d)=>d.toISOString();
const accounts=[
  { id:1, vinted_user_id:'111', login:'atelier_sneak', domain:'www.vinted.fr', updated_at:iso(maintenant), created_at:iso(moisPasse(1)), owner:null },
  { id:2, vinted_user_id:'222', login:'paris_kicks', domain:'www.vinted.fr', updated_at:iso(maintenant), created_at:iso(moisPasse(1)), owner:null },
];
const main=[{ id:'main', data:{ vinted_regime:'micro', vinted_urssaf_taux:13.5 } }];
// [compte, tx, prix, statut, date de vente, date de versement (null = pas de transaction captée)]
const VENTES=[
  ['111','90001',48.5,'Commande finalisée',moisPasse(27),ceMois(1,9)],   // vendue le mois dernier, versée ce mois-ci
  ['111','90002',61,  'Commande finalisée',ceMois(1,10),ceMois(2,15)],
  ['222','90003',39.9,'Commande finalisée',ceMois(1,11),ceMois(2,16)],
  ['222','90004',72.4,'Commande finalisée',ceMois(1,12),null],            // finalisée, pas de date de versement ⇒ « à dater »
  ['111','90005',55,  'Le paiement a été validé',ceMois(2,13),null],      // en cours : pas de CA
  ['222','90006',44,  'Commande finalisée',moisPasse(3),moisPasse(9)],     // versée le mois dernier
];
const vente=(v)=>({ transaction_id:Number(v[1]), id:Number(v[1]), title:'Baskets inventées '+v[1], price:{amount:String(v[2]),currency_code:'EUR'}, status:v[3], date:iso(v[4]) });
const rows=[];
for(const a of accounts){
  const uid=a.vinted_user_id;
  rows.push({ id:`harvest_${uid}_orders_sold`, data:{ capturedAt:iso(maintenant), payload:{ my_orders:VENTES.filter(v=>v[0]===uid).map(vente) } } });
  rows.push({ id:`harvest_${uid}_listings`, data:{ capturedAt:iso(new Date(maintenant.getTime()-60000)), payload:{ items:[] } } });
}
for(const v of VENTES) if(v[5]) rows.push({ id:`harvest_${v[0]}_txn_${v[1]}`, data:{ capturedAt:iso(maintenant), payload:{ transaction:{ id:Number(v[1]), item_id:Number(v[1])+500000, status:450, status_title:'Commande finalisée', status_updated_at:iso(v[5]) } } } });
// Ce que le banc ATTEND (calculé ici, jamais lu dans l'app) : ventes Vinted
// finalisées dont le VERSEMENT tombe ce mois-ci.
const ymDe=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const attenduMois=VENTES.filter(v=>v[5]&&ymDe(v[5])===ymDe(maintenant));
const caAttendu=Math.round(attenduMois.reduce((s,v)=>s+v[2],0)*100)/100;
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
srv.on('error',(e)=>{ console.log('KO  le port '+PORT+' est pris ('+e.code+') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
// « 1 234,56 € » → 1234.56
const eur=(s)=>{ if(s==null) return null; const n=Number(String(s).replace(/\s| | /g,'').replace(/€/g,'').replace(',','.')); return isFinite(n)?n:null; };

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
  const pg=await b.newPage({viewport:{width:1512,height:950}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  await pg.route('**/rest/v1/**',route=>{const u=metaVersData(route.request().url());
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':`0-${Math.max(0,d.length-1)}/${d.length}`},body:JSON.stringify(d)});
    if(route.request().method()!=='GET') return j([]);
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    const sel=(/[?&]select=([^&]*)/.exec(u)||[])[1]; const S=sel?decodeURIComponent(sel):null;
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    if(/id=eq\.main/.test(u)) return j(main.map(r=>projette(r,S)));
    // ⚠️ LE NAVIGATEUR ENCODE `>` DANS LA REQUÊTE (`-%3E%3E`) : les motifs se
    //    testent sur l'URL DÉCODÉE (§6.3). Les transactions (`_txn_`) passent
    //    par `id=like.` avec leur projection : c'est la transaction qui DATE le
    //    CA déclaré (5.133) — sans elle, « CA × taux = à payer » se vérifierait
    //    sur 0 × 13,5 % = 0, vert sur n'importe quel défaut.
    const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return j(rows.filter(r=>r.id===k).map(r=>projette(r,S)));}
    const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');
      return j(rows.filter(r=>re.test(r.id)).map(r=>projette(r,S)));}
    return j([]);});
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));

  // L'écran Ventes publie, le tableau de bord consomme (§11).
  await pg.goto('http://localhost:'+PORT+'/?tab=cat_ventes',{waitUntil:'domcontentloaded'});
  // ⚠️ On attend la PUBLICATION, pas un délai. Depuis la 5.133, Ventes ne
  //    publie qu'une fois les dates de versement lues (`declarables` reste
  //    `undefined` avant) : servies pour de vrai, elles arrivent après les 4 s
  //    d'avant — le banc concluait « pas de source » sur un écran qui allait
  //    publier. Pas de publication au bout de 25 s ⇒ le contrôle suivant est
  //    rouge, comme avant.
  await pg.waitForFunction(()=>{ try{ const v=JSON.parse(localStorage.getItem('vinted_urssaf_mois')||'null');
    return !!(v&&Array.isArray(v.mois)); }catch(_){ return false; } },null,{timeout:25000}).catch(()=>{});
  const publie=await pg.evaluate(()=>{ try{ const v=JSON.parse(localStorage.getItem('vinted_urssaf_mois')||'null');
    if(!v||!Array.isArray(v.mois)) return null;
    const d=new Date(); const ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return v.mois.find(m=>m.ym===ym)||{ym,ca:0,n:0}; }catch(_){ return null; } });
  dit(!!publie, "l'écran Ventes publie `vinted_urssaf_mois`",
    publie?`mois courant : ${publie.n} vente(s) · ${publie.ca} €`:'sans lui, le tableau de bord n\'a pas de source');
  // Et ce qu'il publie est le CA des ventes VERSÉES ce mois-ci, calculé ici
  // depuis les ventes inventées (ni la vente en cours, ni celle sans date de
  // versement, ni celle versée le mois dernier).
  if(publie) dit(publie.n===attenduMois.length && Math.abs(publie.ca-caAttendu)<0.005,
    "la ligne publiée compte les ventes versées ce mois-ci, et seulement elles",
    `attendu ${attenduMois.length} vente(s) · ${caAttendu} € — publié ${publie.n} · ${publie.ca} €`);

  await pg.goto('http://localhost:'+PORT+'/?tab=compta',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(4500);
  await pg.screenshot({path:SC+'/z-urssaf.png',fullPage:true});
  const t=await pg.evaluate(()=>document.body.innerText||'');

  // ── LES NOMBRES RENDUS, pas les phrases ─────────────────────────────────
  const taux   = eur((/À PAYER \(([\d,.]+) ?%\)/i.exec(t)||[])[1]);
  const aPayer = eur((/À PAYER \([\d,.]+ ?%\)\s*\n\s*([\d\s.,  ]+€)/i.exec(t)||[])[1]);
  const net    = eur((/NET APRÈS PAIEMENT\s*\n\s*([\d\s.,  ]+€)/i.exec(t)||[])[1]);
  // Le CA CITÉ : le montant entre parenthèses de la phrase qui commence par
  // « CA des ventes finalisées », sur la même ligne. Depuis la 5.131/5.133 la
  // phrase dit « …finalisées (argent versé) en octobre, toutes plateformes
  // (157,00 €)… » : l'ancien motif exigeait « de {mois} (X €) » collés et ne
  // trouvait plus rien. On prend la première parenthèse qui porte un MONTANT
  // (« (argent versé) » n'en porte pas) ; sans phrase de CA (« ce chiffre se
  // calcule sur l'écran Ventes »), rien n'est trouvé et le contrôle est rouge.
  const caCite = eur((/CA des ventes finalisées[^\n]*?\(([\d\s.,  ]+€)\)/i.exec(t)||[])[1]);
  const nFinal = Number((/VENTES FINALISÉES\s*\n\s*(\d+)/i.exec(t)||[])[1]);
  console.log(`   rendu : taux ${taux} % · CA cité ${caCite} € · à payer ${aPayer} € · net ${net} € · ${nFinal} vente(s) finalisée(s)`);

  dit(caCite!=null && aPayer!=null && net!=null && taux!=null,
    'la carte du mois affiche taux, CA, à payer et net',
    'un des quatre est introuvable dans le rendu');

  if(caCite!=null && aPayer!=null && taux!=null){
    // ⚠️ LE CŒUR DU BANC. « 19,32 € à payer » ne peut pas venir de « 0,00 € ».
    const attendu = caCite*taux/100;
    // L'à payer affiché est CE produit arrondi au centime (au plus un
    // demi-centime d'écart), pas un nombre voisin.
    dit(Math.abs(attendu-aPayer) <= 0.005 + 1e-9,
      "le CA cité dans la phrase est bien celui qui produit le montant à payer",
      `${caCite} € × ${taux} % = ${attendu.toFixed(2)} €, affiché ${aPayer} €`);
  }
  if(caCite!=null && aPayer!=null && net!=null){
    // ⚠️ AU CENTIME PRÈS, SUR LES NOMBRES AFFICHÉS. Tolérer 0,02 € laissait
    // passer « 157,00 − 21,20 = 135,81 » (vu le 5 octobre) : un calcul qu'il
    // refait à la main et qui ne tombe pas juste (§2.7).
    dit(Math.round(caCite*100) - Math.round(aPayer*100) === Math.round(net*100),
      "et le net est bien ce CA moins ce montant, au centime près",
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
