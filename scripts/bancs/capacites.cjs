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
  // `diagVer` : ce que la ligne de diagnostic dit de la version qui a capté en
  // DERNIER — `undefined` la ligne n'existe pas · 'KO' la lecture échoue ·
  // sinon la version. C'est un CONSTAT, jamais une capacité (voir ci-dessous).
  const lis=async (pont, onglet, diagVer)=>{
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
      if(/id=eq\.panel_diag_capture/.test(u)){
        if(diagVer==='KO') return route.fulfill({status:522,contentType:'text/html',headers:{'access-control-allow-origin':'*'},body:'<html>522</html>'});
        if(diagVer===undefined) return j([]);
        return j([{ver:diagVer, verAt:new Date(Date.now()-3*3600e3).toISOString()}]);
      }
      const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return j(rows.filter(r=>r.id===k).map(r=>projette(r,S)));}
      const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');
        return j(rows.filter(r=>re.test(r.id)).map(r=>projette(r,S)));}
      return j([]);});
    await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
    await pg.goto('http://localhost:4472/?tab='+(onglet||'cat_annonces'),{waitUntil:'domcontentloaded'});
    await pg.waitForTimeout(4500);
    const t=await pg.evaluate(()=>document.body.innerText||'');
    if(process.env.DEBUG) console.log('      diag:',JSON.stringify(await pg.evaluate(()=>{
      let n={}; try{n=JSON.parse(localStorage.getItem('vinted_annonce_numeros')||'{}');}catch(_){}
      const avec=Object.keys(n).filter(k=>n[k]&&n[k].minPrice!=null&&String(n[k].minPrice).trim()!=='');
      return {numeros:Object.keys(n).length, avecMin:avec.length, ex:avec[0]||null,
        planchTexte:/prix plancher/i.test(document.body.innerText||''), cartes:document.querySelectorAll('img').length};
    })));
    const nom=(onglet||'ann')+'-'+(pont===null?'absente':(pont===''?'muette':pont))+(diagVer===undefined?'':'-diag'+String(diagVer).replace(/\./g,'_'));
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
    {pont:'5.52.0', nom:'a jour (5.52)',                          attendu:false, places:'mixte'},
    {pont:'',       nom:'MUETTE sur sa version (< 5.26)',         attendu:true},
    {pont:null,     nom:'absente (telephone)',                    attendu:true,  places:'uniforme'},
    {pont:'5.59.0', nom:'a jour pour tout (5.59)',                attendu:false, places:'uniforme'},
  ];
  // ⚠️ §7 : LA MEME PHRASE REPETEE SUR CHAQUE LIGNE EST **UNE** PHRASE.
  // Vu au rendu le 13 septembre : les deux places (Leboncoin, eBay) portaient
  // mot pour mot la meme explication de 150 caracteres, dont seul le nom de la
  // place changeait — et il est deja dans le titre de la ligne juste au-dessus.
  // ⚠️ ON NE COMPTE PAS UNE FORMULE, ON CHERCHE LA REPETITION : un controle pose
  //    sur le libelle serait vert le jour ou quelqu'un reformule (§6.5).
  // ⚠️⚠️ ET MON PREMIER JET NE POUVAIT PAS ECHOUER — il exigeait deux phrases
  //    IDENTIQUES, or les deux lignes differaient d'un mot (« sur Leboncoin » /
  //    « sur eBay »). Vert sur le defaut, donc pire qu'absent : il rassurait.
  //    Ce qui se repete, ce n'est pas la phrase exacte, c'est sa SUBSTANCE : on
  //    mesure le plus long morceau de texte commun a deux phrases rendues.
  //    Soixante caracteres identiques dans deux phrases, c'est une phrase
  //    ecrite deux fois, quel que soit le mot qui change au milieu.
  const COMMUN=60;
  const communLong=(a,b)=>{
    for(let i=0;i+COMMUN<=a.length;i++) if(b.indexOf(a.substr(i,COMMUN))>=0) return a.substr(i,COMMUN);
    return null;
  };
  const repetees=(t)=>{
    const phs=String(t).split(/\n/).map(x=>x.trim()).filter(x=>x.length>=45);
    const out=[];
    for(let i=0;i<phs.length;i++) for(let j=i+1;j<phs.length;j++){
      const c=communLong(phs[i],phs[j]);
      if(c) out.push(c);
    }
    return out;
  };
  for(const c of cas){
    const {t,errs}=await lis(c.pont);
    const vu=BANDEAU.test(t);
    console.log('   '+c.nom.padEnd(40)+' → bandeau '+(vu?'AFFICHE':'absent'));
    dit(vu===c.attendu, 'extension '+c.nom+' : '+(c.attendu?'l\'app dit que rien ne l\'applique':'l\'app ne crie pas pour rien'),
      vu===c.attendu?'':'bandeau '+(vu?'affiche':'absent')+' alors qu\'on attend '+(c.attendu?'affiche':'absent'));
    dit(errs.length===0, 'aucune erreur d\'app ('+c.nom+')', errs.slice(0,2).join(' | '));
    // ── §7 : une phrase commune se dit UNE fois ─────────────────────────────
    if(c.places){
      const dbl=repetees(t);
      if(c.places==='uniforme'){
        dit(dbl.length===0, 'places dans le MEME etat ('+c.nom+') : aucune phrase n\'est ecrite deux fois',
          dbl.length?('60 caracteres communs a deux phrases : « '+dbl[0]+' »'):'');
      }
      // ⚠️ ET L'AUTRE MOITIE : la place ne disparait jamais. Un controle qui
      //    n'aurait que « pas de doublon » serait vert sur un ecran qui a perdu
      //    eBay — meme piege que le compte nomme sur les colis a retirer.
      dit(/Leboncoin/.test(t) && /eBay/.test(t), 'et les deux places restent NOMMEES ('+c.nom+')',
        'une place effacee serait pire que la repetition qu\'on vient de retirer');
      if(c.places==='mixte'){
        // Deux places « en retard » ne reclament pas la meme version (5.54 /
        // 5.55) : la phrase DISTINGUE, elle doit rester sur la ligne. Fusionner
        // la aurait donne une seule consigne, fausse pour l'une des deux.
        dit(/5\.54\.0/.test(t) && /5\.55\.0/.test(t),
          'places dans des etats DIFFERENTS ('+c.nom+') : chaque ligne garde sa consigne',
          'les deux versions attendues doivent etre nommees, 5.54 et 5.55');
      }
    }
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
  // ══════════════════════════════════════════════════════════════════════════
  // L'ECRAN LEBONCOIN DOIT CONNAITRE LES **TROIS** ETATS, PAS DEUX
  // ══════════════════════════════════════════════════════════════════════════
  // ⚠️⚠️ VU AU RENDU LE 15 SEPTEMBRE, SUR SES VRAIES DONNEES. Sa phrase
  // d'introduction s'ecrivait `extSait('photoslbc')==='ok' ? A : B` — donc DEUX
  // etats pour une fonction qui en rend TROIS. Le troisieme est celui de son
  // iPhone : **absente**. L'ecran lui annoncait alors « photos telechargees dans
  // un dossier » — la description d'un comportement qui ne peut PAS avoir lieu
  // (sans extension, rien n'est ni telecharge ni attache) — au lieu du vrai
  // geste : ouvrir l'app sur l'ordinateur ou elle est installee.
  // C'est le trou du premier jet d'`extSaitLireCodes` (« l'extension la plus en
  // retard etait la seule a ne rien declencher »), et l'ecran Annonces, lui,
  // traitait deja les trois.
  //
  // ⚠️ ON NE JUGE PAS SUR UN MOT — interdire « telecharg » attraperait la phrase
  //    HONNETE (c'est la 11e fois que ce piege est note dans le dossier). On juge
  //    sur la SUBSTANCE : les trois etats doivent rendre trois phrases
  //    DIFFERENTES. Deux etats qui se ressemblent, c'est un etat oublie.
  {
    console.log('\n── L\'ECRAN LEBONCOIN : TROIS ETATS, TROIS PHRASES');
    const intro = async (pont) => {
      const { t } = await lis(pont, 'leboncoin');
      const l = t.split('\n').map(x => x.trim())
        .find(x => /La file de publication est construite/i.test(x)) || '';
      // ⚠️ DIX-NEUVIEME FOIS QU'UN DE MES CONTROLES CRIE AU LOUP : la PREMIERE
      //    moitie de cette phrase decrit la FILE (« construite a partir de tes
      //    annonces reellement en ligne… ») — elle est la meme dans les trois
      //    etats, et c'est normal. Ce qui doit distinguer, c'est ce qui decrit
      //    l'EXTENSION. On compare donc la clause d'etat, pas le paragraphe.
      return l.replace(/^.*?paires? retir[ée]es? exclues?\)\.?\s*/i, '');
    };
    const absente = await intro(null);
    const retard  = await intro('5.57.0');   // juste sous la 5.58 (arrivee des photos attachees)
    const ajour   = await intro('5.62.0');
    dit(!!absente && !!retard && !!ajour, 'la phrase d\'introduction est rendue dans les trois etats',
      `absente ${absente.length} car · retard ${retard.length} · a jour ${ajour.length}`);
    // ⚠️ ET LE SEUIL DE §7 NE S'APPLIQUE PAS TEL QUEL ICI : cette phrase a TROIS
    //    morceaux (la file · ou ca se passe · les photos), et les deux premiers
    //    sont legitimement communs — c'est le meme fait vrai dans les trois
    //    etats. Ce qui doit distinguer, c'est CE QU'ELLE DIT DES PHOTOS.
    //    On mesure donc le recouvrement RELATIF : deux phrases dont la plus
    //    courte est contenue a plus de 80 % dans l'autre n'ajoutent rien l'une
    //    a l'autre — c'est un etat oublie. Mesure sur le defaut : « absente »
    //    rendait MOT POUR MOT la phrase de « en retard » (100 %).
    const recouvrement = (a2, b2) => {
      if (!a2 || !b2) return 0;
      const [court, long] = a2.length <= b2.length ? [a2, b2] : [b2, a2];
      let best = 0;
      for (let i = 0; i < court.length; i++) {
        for (let j = court.length; j > i + best; j--) {
          if (long.indexOf(court.slice(i, j)) >= 0) { best = Math.max(best, j - i); break; }
        }
      }
      return best / court.length;
    };
    const paires = [['absente', absente, 'en retard', retard],
                    ['en retard', retard, 'a jour', ajour],
                    ['absente', absente, 'a jour', ajour]];
    for (const [na, a2, nb, b2] of paires) {
      const r = recouvrement(a2, b2);
      dit(r <= 0.8, `« ${na} » et « ${nb} » ne disent pas la meme chose`,
        `${Math.round(r * 100)} % de la plus courte est dans l'autre`);
    }
    // Et l'autre sens : sans extension, on ne se tait pas non plus — il doit
    // savoir OU se fait la publication, sinon la liste n'a pas de mode d'emploi.
    dit(/ordinateur/i.test(absente), 'et sans extension, l\'ecran dit OU ca se passe',
      'se taire laisserait croire que le bouton existe ici');
    // La version qui change le comportement est NOMMEE quand elle manque.
    dit(/5\.58\.0/.test(retard), 'et en retard, il NOMME la version qui attache les photos',
      '« mets-la a jour » sans numero ne dit pas quoi verifier');
  }

  // ── DEPUIS SON iPHONE, QUELLE VERSION A VRAIMENT CAPTE ? ─────────────────
  // Le pont n'existe que dans le Chrome ou l'extension est installee : sur son
  // telephone, l'app ne pouvait PAS repondre « est-elle a jour ? » — la
  // question qu'il pose justement la. L'extension inscrit desormais sa version
  // dans sa ligne de diagnostic a chaque capture.
  // ⚠️ C'EST UN CONSTAT, PAS UNE CAPACITE : cette version est celle de
  // l'extension qui a capte EN DERNIER, quelque part. Le banc exige donc les
  // deux moitiés — qu'elle soit DITE quand on la connait, et qu'elle ne
  // devienne JAMAIS une promesse sur ce navigateur-ci.
  {
    const EXT = (/const EXT_ATTENDUE = '([^']+)'/.exec(fs.readFileSync(path.join(__dirname,'..','..','src','App.jsx'),'utf8'))||[])[1]||'';
    // ⚠️⚠️ ON LIT LA PHRASE, PAS LA PAGE. Mon premier jet cherchait le numero de
    //    version dans TOUT l'ecran : or « Telecharger l'extension 5.62.0 » y est
    //    deja, et « · a jour » aussi. Les deux controles passaient donc au VERT
    //    sur le code d'avant — verts par accident, c'est-a-dire pires qu'absents
    //    (meme famille que le DIST absolu des quatorze bancs). On decoupe la
    //    phrase qui parle de la DERNIERE CAPTURE et on juge dedans.
    const phrase = (t) => { const m = /derni[eè]re capture[\s\S]{0,260}/i.exec(t); return m ? m[0] : ''; };

    const aJour = await lis(null, 'settings', EXT);
    const pA = phrase(aJour.t);
    dit(!!pA, 'sans extension ici, l\'app dit d\'ou vient la DERNIERE capture');
    dit(pA.includes(EXT), 'et cette phrase-la NOMME la version qui a capte', 'attendu ' + EXT + ' dans « ' + pA.slice(0, 90) + ' »');
    dit(/[àa] jour/i.test(pA), 'a jour : elle le dit dans la meme phrase, et ne reclame rien', pA.slice(0, 90));
    dit(aJour.errs.length===0, 'aucune erreur d\'app (version a jour)', aJour.errs.slice(0,2).join(' | '));

    const vieille = await lis(null, 'settings', '5.41.0');
    const pV = phrase(vieille.t);
    dit(pV.includes('5.41.0'), 'une vieille version captee est nommee dans cette phrase', pV.slice(0, 90));
    dit(/remplacer|remplace/i.test(pV), 'et le geste y est le REMPLACEMENT du dossier, pas un rechargement', pV.slice(0, 90));

    // ⚠️ RIEN LU NE VAUT PAS RIEN, et « aucune ligne » ne vaut pas « ancienne ».
    //    Dans les deux cas on n'invente aucune version.
    const absente = await lis(null, 'settings', undefined);
    dit(!/derni[eè]re capture/i.test(absente.t), 'ligne de diagnostic absente : aucune version inventee');
    const ko2 = await lis(null, 'settings', 'KO');
    dit(!/derni[eè]re capture/i.test(ko2.t), 'lecture ratee : aucune version inventee non plus');

    // ⚠️ ET SURTOUT : connaitre la version ne doit RIEN promettre ici. Sans
    //    extension dans ce navigateur, l'ecran ne peut pas annoncer qu'elle
    //    travaille sur cette page.
    dit(/pas d[ée]tect[ée]e ici/i.test(aJour.t),
      'et l\'ecran dit toujours qu\'aucune extension ne tourne DANS CE navigateur',
      'une version connue ne vaut pas une extension presente');
    dit(!/branch[ée]e sur cette page/i.test(aJour.t),
      'il ne promet pas qu\'elle est branchee sur cette page');
  }

  // ── L'ONGLET « CE QU'IL TE RESTE A FAIRE » (bas a droite) ──────────────────
  // Il ne s'affiche QUE tant que l'extension de CE navigateur n'est pas a jour
  // (donc ne capte pas encore tout), et DISPARAIT des qu'elle l'est.
  {
    const EXT = (/const EXT_ATTENDUE = '([^']+)'/.exec(fs.readFileSync(path.join(__dirname,'..','..','src','App.jsx'),'utf8'))||[])[1]||'';
    const vieille = await lis('5.10.0', 'cat_annonces');   // extension tres en retard
    dit(/Ouvrir R[ée]glages pour la t[ée]l[ée]charger/i.test(vieille.t),
      'l\'onglet « reste a faire » s\'affiche quand l\'extension est en retard',
      'attendu le bouton, ecran : ' + vieille.t.replace(/\n/g,' ').slice(0,80));
    dit(new RegExp(EXT.replace(/\./g,'\\.')).test(vieille.t),
      'et il NOMME la version a installer', 'attendu ' + EXT);
    const ajour = await lis(EXT, 'cat_annonces');          // extension a jour
    dit(!/Ouvrir R[ée]glages pour la t[ée]l[ée]charger/i.test(ajour.t),
      'et il DISPARAIT quand l\'extension est a jour (pas de badge permanent)');
    dit(vieille.errs.length===0 && ajour.errs.length===0, 'aucune erreur d\'app avec l\'onglet', (vieille.errs[0]||ajour.errs[0]||''));
  }

  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nL\'app ne promet que ce que l\'extension installee sait faire.');
  process.exit(ko?1:0);
})();
