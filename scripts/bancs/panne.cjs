// ═══════════════════════════════════════════════════════════════════════════
// BANC : QUAND LA BASE NE RÉPOND PAS, L'APP LE DIT
//        node scripts/bancs/panne.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Le 10 septembre, la base Supabase était RÉELLEMENT injoignable — 522
// Cloudflare, trois essais, réponse HTML. Rendu dans cet état, l'app disait :
//   Ma journée   « Rien d'urgent — ta boutique tourne. 👌 · 🎉 Tout est à
//                  jour ! Rien à expédier, rien à retirer »   ← 14 à expédier
//   Colis/Achats « Aucun compte Vinted lié — installe l'extension Chrome »
//                                                            ← il en a NEUF
//   Tableau bord « Bienvenue 👋 · connecte ton compte pour commencer »
// C'est le mensonge le plus coûteux possible : il ouvre l'app le matin, lit
// « tout va bien », et ne poste pas ses colis.
//
// Cause : `fetchVintedAccounts` rendait `[]` À LA FOIS pour « aucun compte » et
// pour « la base n'a pas répondu ». §4.1 dit de rendre `[]` plutôt que de lever
// — oui, mais l'app doit SAVOIR que c'est un échec pour ne pas l'afficher comme
// un fait. Elle rend `null` sur échec, et `baseKO` porte l'information.
//
// ⚠️ CE BANC FORCE LA PANNE (aucune fixture ne la contient) ET vérifie l'autre
// sens : en marche normale, l'app ne doit PAS crier à la panne. Un contrôle qui
// n'aurait que la première moitié serait vert sur une app qui alerte tout le
// temps.
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
srv.listen(4479);

// ⚠️ LA VRAIE FORME DE LA PANNE : Cloudflare rend du HTML avec un 522, pas un
// JSON d'erreur. Servir `{"error":…}` mesurerait un cas qui n'arrive pas.
const HTML522='<!DOCTYPE html><html><head><title>522: Connection timed out</title></head><body>Connection timed out</body></html>';

let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
// Ce que l'app ne doit JAMAIS affirmer quand elle n'a rien pu lire.
const MENSONGES=[
  [/Tout est à jour/i,            '« Tout est à jour ! »'],
  [/Rien à expédier, rien à retirer/i, '« Rien à expédier, rien à retirer »'],
  [/Aucun compte Vinted lié/i,    '« Aucun compte Vinted lié »'],
  [/Bienvenue 👋/,                '« Bienvenue 👋 » (l\'accueil des nouveaux)'],
  [/Rien d'urgent/i,              '« Rien d\'urgent — ta boutique tourne »'],
  // ── Trouvés en élargissant ce banc aux 15 écrans joignables ───────────────
  // Il n'était posé que sur quatre. Huit écrans se taisaient, et ces cinq-là
  // affirmaient pour de bon — dont deux sur le panneau de SÉCURITÉ.
  [/Aucun compte détecté/i,       '« Aucun compte détecté · installe l\'extension » (il en a neuf)'],
  // ⚠️ CINQUIÈME FOIS qu'un de mes contrôles crie au loup. Posé en
  //    `/Tout est publié/i`, il attrapait la phrase HONNÊTE que je venais
  //    d'écrire (« …pas parce que tout est publié »). C'est la FÊTE qui est
  //    interdite, pas les trois mots : le 🎉 en fait partie.
  [/Tout est publié 🎉/,          '« Tout est publié 🎉 » (une file jamais lue)'],
  [/colonne absente/i,            '« Propriétaire des lignes · colonne absente » — un diagnostic jamais mesuré'],
  [/Copier la migration SQL/i,    'le bouton « Copier la migration SQL » — le remède sans le diagnostic'],
  // ⚠️ CELUI-LÀ EST UN FEU VERT : affirmer que le verrou est posé alors que RLS
  //    est désactivé et que la clé publique lit tout. Le pire des cinq.
  [/seule une session identifiée lit tes données/i, '« Lecture sans compte · fermée » — un FEU VERT sur une sonde ratée'],
  [/clé de service manquante/i,   '« Routes serveur · clé de service manquante » — jamais mesuré'],
  [/Sécurité des données\s+(partagées|cloisonnées)/i, 'le badge du panneau de sécurité tranche sans avoir mesuré'],
];
const AVEU=/Je n'arrive pas à joindre tes données|Je n'ai pas pu lire tes données/i;

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox']});
  const rendre=async(panne,t,depuisJours)=>{
    const ctx=await b.newContext({viewport:{width:1512,height:950}});
    const pg=await ctx.newPage();
    const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
    await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
    // Une panne qui DURE : l'app doit cesser de dire d'attendre.
    if(depuisJours) await pg.addInitScript(j=>{try{localStorage.setItem('vrm_base_ko_depuis',new Date(Date.now()-j*86400000).toISOString());}catch(_){}}, depuisJours);
    if(panne){
      await pg.route('**/rest/v1/**',r=>r.fulfill({status:522,contentType:'text/html',headers:{'access-control-allow-origin':'*'},body:HTML522}));
      await pg.route('**/api/**',r=>r.fulfill({status:522,contentType:'text/html',body:HTML522}));
    } else {
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
    }
    await pg.goto('http://localhost:4479/?tab='+t,{waitUntil:'domcontentloaded'});
    await pg.waitForTimeout(5000);
    if(panne) await pg.screenshot({path:SC+'/z-panne-'+t+'.png',fullPage:true});
    const txt=await pg.evaluate(()=>document.body.innerText||'');
    await ctx.close();
    return {txt, errs};
  };

  // ⚠️⚠️ LES 15 ÉCRANS JOIGNABLES, PAS QUATRE. Premier jet de ce banc :
  //      `journee`, `dashboard`, `cat_bord`, `cat_achats` — les quatre où
  //      j'avais posé la garde. Un banc qui ne rend que les écrans qu'on vient
  //      de corriger ne prouve que le correctif, jamais la RÈGLE. Élargi à la
  //      liste complète (celle d'`audit-bancs.cjs`), il a trouvé HUIT écrans
  //      muets et cinq affirmations de plus. Même leçon que l'île d'actions :
  //      trois écrans y échappaient parce qu'aucun banc ne les rendait.
  const ECRANS=['journee','dashboard','cat_annonces','cat_ventes','cat_achats','cat_bord','cat_msg','garage','invoices','settings','vintedaccounts','catalog','sales','leboncoin','stockvinted'];

  console.log('── BASE INJOIGNABLE (522, réponse HTML — la vraie forme)');
  for(const t of ECRANS){
    const {txt,errs}=await rendre(true,t);
    const mensonges=MENSONGES.filter(([re])=>re.test(txt)).map(([,q])=>q);
    dit(mensonges.length===0, `${t} : l'app n'affirme rien qu'elle n'a pas pu vérifier`,
      mensonges.length?('elle affiche '+mensonges.join(' + ')):'');
    dit(AVEU.test(txt), `${t} : et elle DIT qu'elle n'a pas pu lire`,
      AVEU.test(txt)?'':'un écran muet est pire : il ressemble à « rien à faire »');
    // ⚠️ Dire la panne ne suffit pas : il faut dire ce que ce n'est PAS et quoi
    //    faire (§2.7 — une alerte sans geste ne sert à rien).
    if(AVEU.test(txt)) dit(/Rien n'est perdu/i.test(txt) && /Recharger|recharge la page/i.test(txt),
      `${t} : elle rassure sur ses données et propose le geste`,
      "« rien n'est perdu » + un bouton");
    // ⚠️ §7 — LA MÊME PHRASE RÉPÉTÉE EST UNE PHRASE. Une fois le bloc posé sur
    //    la coque, Ma journée disait la panne TROIS FOIS : le bloc, la ligne
    //    sous « Bonjour Julien », puis la ligne de la liste vide. Le bloc se
    //    dit UNE fois, et au plus une ligne dit de quoi telle liste est vide.
    const nBloc=(txt.match(/Je n'arrive pas à joindre tes données/g)||[]).length;
    const nLigne=(txt.match(/Je n'ai pas pu lire/g)||[]).length;
    dit(nBloc===1 && nLigne<=1, `${t} : elle le dit une fois, pas trois`,
      `bloc ×${nBloc}, ligne ×${nLigne}`);
    dit(errs.length===0, `${t} : aucune erreur d'app pendant la panne`, errs.slice(0,2).join(' | '));
  }

  // ⚠️⚠️ « ÇA REVIENT TOUT SEUL » — FAUX AU TROISIÈME JOUR. La base est tombée
  //      le 9 septembre et n'est pas revenue ; l'app a répété pendant trois
  //      jours d'attendre, c'est-à-dire de ne RIEN faire, alors que le seul
  //      geste utile était d'ouvrir son tableau de bord d'hébergement. Une
  //      alerte qui dit d'attendre quand il faut agir est pire qu'une alerte
  //      muette. Le contrôle porte sur la DURÉE servie, pas sur la tournure.
  console.log('\n── ET QUAND ÇA DURE (3 jours)');
  {
    const {txt}=await rendre(true,'journee',3);
    dit(/3 jours/.test(txt), 'panne longue : elle dit depuis COMBIEN de temps', 'sinon « en ce moment » au 3ᵉ jour');
    dit(!/revient tout seul/i.test(txt), 'panne longue : elle ne promet plus que ça revient tout seul',
      /revient tout seul/i.test(txt)?"elle lui dit d'attendre":'');
    dit(/supabase\.com/i.test(txt), 'panne longue : et elle dit OÙ aller', 'une alerte sans geste ne sert à rien');
    dit(/Rien n'est perdu/i.test(txt), 'panne longue : elle rassure toujours sur ses données');
  }

  console.log('\n── EN MARCHE NORMALE (l\'autre sens : pas de fausse alerte)');
  for(const t of ECRANS){
    const {txt,errs}=await rendre(false,t);
    dit(!AVEU.test(txt), `${t} : aucune alerte de panne quand la base répond`,
      AVEU.test(txt)?'elle crie à la panne alors que tout va bien':'');
    dit(errs.length===0, `${t} : aucune erreur d'app`, errs.slice(0,2).join(' | '));
  }

  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):"\nUne lecture ratee ne se fait plus passer pour « rien a faire ».");
  process.exit(ko?1:0);
})();
