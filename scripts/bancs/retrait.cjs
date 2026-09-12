// Le RETRAIT d'un colis, rendu sur les vraies données (copie du 6 septembre).
// Ce que ça prouve, qu'aucun audit statique ne peut voir :
//   • chaque colis à retirer porte un lien, et ce lien mène à SA conversation
//     (l'identifiant de la commande, pas un titre) ;
//   • les colis « non réclamés » sont affichés avec leur montant ;
//   • rien ne les annonce comme une perte.
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
const main=FX('main'), accounts=FX('accounts'), txn=FX('txn'); const purch=FX('purch');
const rows=[...FX('sold'),...purch,...FX('listings'),...FX('inbox')];
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.listen(4383);
// Ce que la VRAIE base contient, calculé ici pour comparer à l'écran.
const AT=(s)=>/d[ée]pos[ée]/i.test(s||'')&&/point\s+relais|bureau\s+de\s+poste/i.test(s||'');
// ⚠️ LE COMPTE VIENT DE L'IDENTIFIANT DE LIGNE, PAS DE LA COMMANDE. Mesuré :
// une commande Vinted moissonnée ne porte AUCUN champ de compte — c'est
// `harvest_{uid}_orders_purchased` qui le dit. Mon premier jet lisait
// `o.account || o.uid` : toujours vide, donc un Set de [''] de taille 1 — le
// banc annonçait « sur 1 compte(s) » en ne mesurant rien du tout. §6 : vérifier
// le NOM et la FORME du champ avant de conclure.
const cmds=[]; purch.forEach(r=>{ const uid=(/^harvest_([^_]+)_/.exec(r.id)||[])[1]||'';
  (((r.data||{}).payload||{}).my_orders||[]).forEach(o=>cmds.push(Object.assign({__uid:uid}, o))); });
const aRetirer=cmds.filter(o=>AT(o.status));
const nonRecl=cmds.filter(o=>/non r[ée]clam/i.test(o.status||''));
// Les codes DEJA en base (panel_colis_relais) : un colis qui en a un n'attend
// plus rien, donc il n'appelle aucune consigne de connexion.
let codes={}; try { const pr=main.find(r=>r.id==='panel_colis_relais'); const d=(pr&&pr.data)||{};
  for(const k in d) if(d[k]&&d[k].code) codes[k]=1; } catch(_){}
const totNR=nonRecl.reduce((t,o)=>t+parseFloat(String((o.price&&o.price.amount)||0)||0),0);
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
(async()=>{
  console.log('base servie : '+aRetirer.length+' colis a retirer · '+nonRecl.length+' non reclames ('+totNR.toFixed(2)+' EUR)');
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1512,height:950}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  await pg.route('**/rest/v1/**',route=>{const u=route.request().url();
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    if(route.request().method()!=='GET') return j([]);
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    if(/vinted_accounts/.test(u)) return j(accounts);
    if(/id=eq\.main/.test(u)) return j(main);
    if(/transaction->>id/.test(u)) return j(txn);
    const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return j(rows.filter(r=>r.id===k));}
    const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');return j(rows.filter(r=>re.test(r.id)));}
    return j([]);});
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  await pg.goto('http://localhost:4383/?tab=cat_achats',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(4000);
  await pg.screenshot({path:SC+'/z-retrait.png',fullPage:true});
  const v=await pg.evaluate(()=>{
    const liens=[...document.querySelectorAll('a[href*="/inbox/"]')].map(a=>({h:a.getAttribute('href'),t:(a.innerText||'').trim()}));
    return {liens, txt:document.body.innerText||''};
  });
  // 1) une porte par colis a retirer
  // ⚠️ On reconnaît le lien par ce qu'il FAIT (ouvrir la conversation), pas par
  // une formule exacte : le libellé a changé pour dire ce que ça rapporte
  // (« le code revient ici »), et le banc mesurait alors 3 liens sur 6.
  const codeLiens=v.liens.filter(l=>/conversation|code de retrait/i.test(l.t));
  dit(codeLiens.length>=aRetirer.length,
    'chaque colis a retirer offre une porte vers son code',
    codeLiens.length+' lien(s) pour '+aRetirer.length+' colis');
  // 2) chaque lien porte un VRAI identifiant de conversation de la base
  const convs=new Set(aRetirer.concat(nonRecl).map(o=>String(o.conversation_id)));
  const inconnus=v.liens.filter(l=>!convs.has(String((/inbox\/(\d+)/.exec(l.h)||[])[1])));
  dit(inconnus.length===0, 'aucun lien ne pointe vers une conversation inventee',
    inconnus.slice(0,2).map(x=>x.h).join(' '));
  // 3) les colis non reclames sont dits, avec leur montant
  const attendu=totNR.toFixed(2).replace('.',',')+' €';
  dit(v.txt.includes(attendu), 'le montant des colis non reclames est affiche', attendu);
  dit(new RegExp(nonRecl.length+' colis (sont repartis|est reparti)').test(v.txt),
    'ils sont annonces par leur nombre', nonRecl.length+'');
  nonRecl.forEach(o=>dit(v.txt.includes(String(o.title||'').slice(0,20)),
    'la paire « '+String(o.title||'').slice(0,26)+' » est nommee'));
  // 4) on n'annonce pas une perte qu'on ne sait pas prouver
  dit(!/perdu|perte/i.test(v.txt), "aucun ecran n'annonce une perte non prouvee");
  dit(/a verifier|à vérifier/i.test(v.txt), 'le montant est presente « a verifier »');
  dit(errs.length===0, "aucune erreur d'app", errs.slice(0,2).join(' | '));

  // ── 5. MA JOURNÉE DIT SUR QUEL COMPTE SE CONNECTER ────────────────────────
  // L'extension va chercher les codes toute seule (`capterRetraits`), mais
  // seulement pour le compte connecte dans l'onglet. « Passe sur Vinted avec le
  // bon compte » sans dire lequel est une consigne qu'on ne peut pas suivre :
  // il en a NEUF. Rendu avec les vraies donnees (§26 : un bloc conditionnel ne
  // compte que RENDU).
  await pg.goto('http://localhost:4383/?tab=journee',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(4000);
  await pg.screenshot({path:SC+'/z-retrait-journee.png',fullPage:true});
  const j2=await pg.evaluate(()=>document.body.innerText||'');
  // ⚠️ LE CONTROLE SE DECLENCHE SUR LA DONNEE, PAS SUR LA FORMULE. Premiere
  // version : « si la phrase parle d'attendre un code, alors elle doit nommer un
  // compte ». Sur le code d'AVANT, la phrase etait autre — la condition tombait
  // a faux et le banc annoncait « rien a nommer », donc VERT sur le defaut
  // qu'il devait attraper. C'est la base qui decide : s'il existe un colis sans
  // code, la ligne DOIT nommer un compte, quelle que soit la formulation.
  const logins=[...new Set(accounts.map(a=>String(a.login||'')).filter(Boolean))];
  const ligne=(/Retirer \d+ colis[\s\S]{0,220}/.exec(j2)||[''])[0];
  const sansCode=aRetirer.filter(o=>!codes[String(o.transaction_id||'')]);
  console.log('base servie : '+sansCode.length+' colis sans code, sur '
    +[...new Set(sansCode.map(o=>o.__uid).filter(Boolean))].length+' compte(s)');
  if(sansCode.length===0){ console.log('--  (aucun colis sans code dans ces fixtures)'); }
  else {
    dit(/Retirer \d+ colis/.test(j2), 'Ma journee annonce les colis a retirer');
    dit(!/Ouvre la conversation UNE fois/.test(j2),
      "et ne reclame plus d'ouvrir chaque conversation",
      "l'extension va les chercher toute seule depuis le 27 aout");
    dit(logins.some(l=>ligne.includes(l)),
      'elle NOMME le compte sur lequel se connecter',
      ligne.replace(/\n/g,' · ').slice(0,120));
  }

  // ── 5 bis. LE COMPTE EST NOMMÉ UNE FOIS, PAS SUR CHAQUE LIGNE ────────────
  // Il a NEUF comptes et l'extension ne travaille que pour celui qui est
  // connecté dans l'onglet : savoir lequel est indispensable, et ça ne se perd
  // jamais. Mais vu en capture le 8 septembre, sur l'écran Achats :
  // « compte julatace3535 » écrit CINQ fois, sous cinq titres différents,
  // alors que les cinq colis sont sur ce compte-là. C'est §7 mot pour mot.
  //
  // ⚠️ LA BASE DÉCLENCHE, PAS LA FORMULATION. Deux exigences, et elles
  // s'opposent — c'est ce qui rend le contrôle utile :
  //   • le compte doit apparaître AU MOINS une fois (jamais perdu) ;
  //   • et pas une fois par colis quand ils sont tous sur le même.
  // Un contrôle qui n'aurait que la première serait vert sur le défaut.
  {
    const comptes = [...new Set(sansCode.map(o => o.__uid).filter(Boolean))];
    // ⚠️ LA FENÊTRE S'ARRÊTE À LA FIN DU BLOC. Premier jet : 1 400 caractères à
    // partir de « Point relais » — ça débordait sur le bandeau voisin « 2
    // comptes Vinted ne reçoivent aucun email — tomj606, angeled92 », et le
    // banc y trouvait un login qui n'a rien à voir avec ce groupe.
    const dep = v.txt.indexOf('Point relais');
    const suite = dep < 0 ? -1 : v.txt.indexOf('Coche \u2713 quand tu l', dep);
    const bloc = dep < 0 ? '' : v.txt.slice(dep, suite > 0 ? suite : dep + 1400);
    // ⚠️ ET C'EST LE GROUPE QUI COMPTE, PAS L'ENSEMBLE. Mesuré : les 6 colis
    // sans code sont sur DEUX comptes, mais la liste se groupe par point
    // relais — et le groupe « Point relais à confirmer » en porte 5, tous sur
    // le même. Poser la condition sur l'ensemble ne l'aurait jamais déclenchée.
    // On lit donc ce que le bloc RENDU contient.
    const vus = {};
    for (const a of accounts) { const l = String(a.login || ''); if (!l) continue;
      const n = bloc.split(l).length - 1; if (n > 0) vus[l] = n; }
    const noms = Object.keys(vus);
    const nColis = (bloc.match(/Ouvrir la conversation/g) || []).length;
    console.log(`    bloc « point relais » : ${nColis} colis · comptes nommés ${noms.length ? noms.map(l => `${l}\u00d7${vus[l]}`).join(', ') : '(aucun)'}`);
    if (nColis > 1) {
      dit(noms.length >= 1, "l'écran Achats nomme le compte sur lequel se connecter",
        "il en a neuf, et l'extension ne travaille que pour celui de l'onglet");
      // Groupe uniforme (un seul compte nommé) ⇒ la phrase est celle du GROUPE :
      // une fois. Groupe mixte ⇒ chaque ligne distingue, la répétition est due.
      if (noms.length === 1) dit(vus[noms[0]] === 1,
        "et il ne le répète pas sur chaque colis du même compte",
        `« ${noms[0]} » écrit ${vus[noms[0]]} fois pour ${nColis} colis, tous sur ce compte`);
    }
  }

  // ── 6. LES TROIS ÉCRANS DISENT LE MÊME NOMBRE ─────────────────────────────
  // Mesuré le 7 septembre : le tableau de bord annonçait « 1 colis à retirer »
  // pendant que Ma journée en comptait 5. Cause : le centre de notifications
  // RECALCULAIT la règle et sa version ne voyait que les colis venus d'un email
  // transporteur — les colis « déposés en point relais » vus côté Vinted
  // n'apparaissaient nulle part sur cet écran (§5.43 : un colis caché est un
  // colis perdu). `pickupUnion` publie maintenant, le tableau de bord consomme.
  const nombres = {};
  for (const t of ['cat_achats','journee','dashboard']) {
    await pg.goto('http://localhost:4383/?tab='+t,{waitUntil:'domcontentloaded'});
    await pg.waitForTimeout(5000);
    const txt = await pg.evaluate(()=>document.body.innerText||'');
    const m = /(\d+)\s+colis à retirer/.exec(txt) || /Retirer\s+(\d+)\s+colis/.exec(txt);
    if (m) nombres[t] = Number(m[1]);
  }
  // ⚠️ ET LES TROIS DOIVENT PARLER. Premier jet : « tous ceux qui annoncent un
  // nombre disent le meme » — sur le code d'avant le tableau de bord n'affichait
  // AUCUNE ligne, la comparaison portait sur deux ecrans et passait au VERT sur
  // le defaut a attraper. Un ecran muet sur un colis, c'est justement le
  // probleme (§5.43). C'est la BASE qui declenche, comme au point 5.
  const vus = Object.values(nombres);
  const detail = ['cat_achats','journee','dashboard'].map(k=>k+'='+(k in nombres?nombres[k]:'(muet)')).join(' · ');
  if (aRetirer.length === 0) { console.log('--  (aucun colis a retirer dans ces fixtures)'); }
  else {
    dit(vus.length === 3, 'les TROIS ecrans annoncent le colis a retirer', detail);
    dit(new Set(vus).size === 1,
      'et ils annoncent le MEME nombre', detail);
  }

  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nLe retrait a toujours une porte, et rien ne repart en silence.');
  process.exit(ko?1:0);
})();
