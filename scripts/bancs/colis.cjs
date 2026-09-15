// L'ÉCRAN COLIS, RENDU COMME EN VRAI. ⚠️ Le piège qui a fausse tous mes bancs
// precedents : ils rendaient la ligne BRUTE ({id,data}) pour une requete qui
// demande une PROJECTION (`select=id,filename:data->>filename,…`). L'app lisait
// donc `r.filename` sur un objet qui ne l'a pas → TOUS les bordereaux tombaient,
// et l'ecran affichait « 0 bordereau pret a imprimer ». C'etait un artefact du
// banc, pas un defaut de l'app (§6.3 : servir TOUTES les formes de requete).
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

// ── LA LIGNE `label_latest` PÈSE CE QU'ELLE PÈSE EN VRAI ────────────────────
// ⚠️⚠️ UN BANC QUI SERT UNE LIGNE LÉGÈRE NE PEUT PAS VOIR UN DÉFAUT D'ÉGRESS.
// Les fixtures tronquent `pdfB64` à quatre caractères (elles ne montent jamais
// dans le dépôt, et un PDF pèse). Servie ainsi, la lecture `select=data` qui
// coûtait **1,6 Mo à chaque ouverture de cet écran** — mesuré le 15 septembre
// sur sa vraie base : 7 lignes `label_latest`, **1 663 Ko dont 1 658 Ko de
// `pdfB64` (99,7 %)**, une seule à 713 Ko — ne coûte ici que 28 octets, et le
// banc serait VERT sur le défaut. C'est la leçon de la projection `select=`
// (§6.3) appliquée au POIDS : un banc qui ne sert pas le bon ordre de grandeur
// mesure une fiction. On regonfle donc chaque PDF à sa taille mesurée.
const PDF_KO = 237;                       // 1 663 Ko / 7 lignes, mesuré
const MAINTENANT = Date.now();
const labelRows = FX('label').map((r) => {
  if (!/_label_latest$/.test(r.id)) return r;
  const d = { ...(r.data || {}) };
  if (d.pdfB64) d.pdfB64 = 'JVBERi0'.repeat(Math.ceil((PDF_KO * 1024) / 7));
  return { ...r, data: d };
});
// Deux états qu'il FAUT servir pour que le bandeau « tamponner en 1 clic » soit
// mesurable : un bordereau frais AVEC son PDF (le bandeau doit s'afficher et
// nommer CE compte), et un bordereau ENCORE PLUS frais dont le PDF n'est jamais
// arrivé (la ligne existe, `pdfB64` est vide — Vinted a répondu sans URL, cas
// mesuré : `label_url_introuvable` 61 contre `label_url_trouve` 29). C'est ce
// second cas qui PROUVE que le filtre `data->>pdfB64=not.is.null` est appliqué :
// sans lui le bandeau nomme le mauvais compte, celui qui n'a rien à tamponner.
const FRAIS = 'harvest_147827838_label_latest';   // julatace3535 — avec son PDF
const SANS  = 'harvest_3175765377_label_latest';  // angeled92 — PDF jamais arrivé
labelRows.forEach((r) => {
  if (r.id === FRAIS) r.data.capturedAt = new Date(MAINTENANT - 7 * 60000).toISOString();
  if (r.id === SANS) { r.data.capturedAt = new Date(MAINTENANT - 2 * 60000).toISOString(); r.data.pdfB64 = null; }
});
const nomDe = (uid) => { const a = accounts.find((x) => String(x.vinted_user_id) === String(uid)); return (a && (a.login || a.username)) || uid; };
const NOM_FRAIS = nomDe(FRAIS.split('_')[1]), NOM_SANS = nomDe(SANS.split('_')[1]);

// Ce que la page a réellement rapatrié comme octets de PDF.
const PDF = { octets: 0, ou: [] };
const pesePdf = (d) => {
  let n = 0;
  const voir = (x) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(voir);
    for (const k in x) { if (k === 'pdfB64' && typeof x[k] === 'string') n += x[k].length; else voir(x[k]); }
  };
  voir(d); return n;
};

const rows=[...FX('sold'),...FX('purch'),...FX('listings'),...FX('inbox'),...FX('track'),...FX('bord'),...labelRows,...FX('billing')];
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.zip':'application/zip'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.listen(4403);

// ── LA PROJECTION `select=` DE POSTGREST, honnêtement appliquée ────────────
const chemin=(obj,ch)=>ch.split('->').reduce((o,k)=>{ if(o==null) return null;
  const kk=k.replace(/^>/,'').replace(/^'|'$/g,''); return o[kk]; }, obj);
function projette(row,select){
  if(!select || select==='*') return row;
  const out={};
  for(const part of select.split(',')){
    const m=/^(?:([^:]+):)?(.+)$/.exec(part.trim()); if(!m) continue;
    const alias=m[1]||m[2].split('->').pop().replace(/^>/,''); const src=m[2];
    if(src==='id'||src==='updated_at'){ out[alias]=row[src]; continue; }
    if(src==='data'){ out[alias]=row.data; continue; }
    if(/^data(->|->>)/.test(src)){
      const reste=src.replace(/^data(->>|->)/,''); // « payload->my_orders » ou « nItems »
      let v=row.data;
      for(const seg of reste.split(/->>|->/)) v = (v==null?null:v[seg]);
      out[alias] = (v==null)?null:(/->>/.test(src.replace(/^data/,''))&&typeof v!=='object'?String(v):v);
      continue;
    }
    out[alias]=row[src];
  }
  return out;
}
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
// ce que la base contient vraiment
const bord=FX('bord'); const sold=FX('sold');
const parTx={}; bord.forEach(r=>{const d=r.data||{}; if(d.transaction&&d.filename) parTx[String(d.transaction)]=1;});
let ventes=[]; sold.forEach(r=>(((r.data||{}).payload||{}).my_orders||[]).forEach(o=>ventes.push(o)));
const aEnvoyer=ventes.filter(o=>/Bordereau envoyé au vendeur|Le paiement a été validé|en attente|à expédier/i.test(o.status||''));
const attendus=aEnvoyer.filter(o=>parTx[String(o.transaction_id)]).length;
(async()=>{
  console.log('base servie : '+aEnvoyer.length+' ventes a expedier · '+attendus+' ont deja leur PDF en base');
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox']});
  // Un SECOND navigateur pour la comparaison accueil ↔ Colis : il lui faut un
  // `localStorage` VIERGE (l'appareil neuf), et celui du premier a déjà servi.
  const b2=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1512,height:950}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  const brancher=async(p)=>{
    // ⚠️ `vrm_acces_direct` DOIT être posé sur CHAQUE page, pas seulement la
    //    première : sans lui l'app reste sur son écran d'accueil de connexion
    //    et le banc mesure une page vide en croyant mesurer un écran.
    await p.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
    await p.route('**/rest/v1/**',route=>{const u=route.request().url();
    const j=d=>{const n=pesePdf(d); if(n){PDF.octets+=n; PDF.ou.push(decodeURIComponent(u.split('/rest/v1/')[1]||'').slice(0,90));}
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});};
    if(route.request().method()!=='GET') return j([]);
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    const sel=(/[?&]select=([^&]*)/.exec(u)||[])[1]; const S=sel?decodeURIComponent(sel):null;
    // ⚠️ LE FILTRE COMPTE AUTANT QUE LA PROJECTION (§6.3). PostgREST ne rend que
    //    les lignes qui passent ses filtres ; `data->>pdfB64=not.is.null` en est
    //    un. Un banc qui les ignore sert des lignes que l'app ne verrait jamais
    //    — c'est le même artefact que la ligne BRUTE rendue pour un `select=`.
    const U=decodeURIComponent(u);
    const filtres=[...U.matchAll(/[?&]data->>(\w+)=(not\.)?is\.null(?=&|$)/g)].map(x=>({champ:x[1],nul:!x[2]}));
    const passe=r=>filtres.every(f=>{const v=(r.data||{})[f.champ];
      const estNul=(v===null||v===undefined||v===''); return f.nul?estNul:!estNul;});
    if(/vinted_accounts/.test(u)) return j(accounts);
    if(/id=eq\.main/.test(u)) return j(main.filter(passe).map(r=>projette(r,S)));
    if(/transaction->>id/.test(u)) return j(txn);
    const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return j(rows.filter(r=>r.id===k).filter(passe).map(r=>projette(r,S)));}
    const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');
      return j(rows.filter(r=>re.test(r.id)).filter(passe).map(r=>projette(r,S)));}
    return j([]);});
    await p.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  };
  await brancher(pg);
  await pg.goto('http://localhost:4403/?tab=cat_bord',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(5000);
  await pg.screenshot({path:SC+'/z-colis.png',fullPage:true});
  const v=await pg.evaluate(()=>({txt:document.body.innerText||'',
    imprimer:[...document.querySelectorAll('button')].filter(x=>/Imprimer/i.test(x.textContent)).length}));
  const mPret=/(\d+) bordereaux? prêts? à imprimer/.exec(v.txt);
  const mAtt=/(\d+) en attente de bordereau/.exec(v.txt);
  console.log('    en-tête : '+(v.txt.split('\n').find(l=>/bordereau/i.test(l))||'(rien)'));
  dit(mPret && +mPret[1]>0, 'l\'écran voit les bordereaux déjà en base',
    (mPret?mPret[1]:'0')+' annoncés prêts · '+attendus+' existent · '+(mAtt?mAtt[1]+' dits « en attente »':''));
  dit(v.imprimer>0, 'un bouton « Imprimer » est proposé', v.imprimer+' bouton(s)');
  dit(!/l'extension les récupère/i.test(v.txt) || (mPret&&+mPret[1]>0),
    'l\'app ne demande plus d\'aller les chercher quand elle les a déjà');
  dit(errs.length===0, "aucune erreur d'app", errs.slice(0,2).join(' | '));

  // ══════════════════════════════════════════════════════════════════════════
  // OUVRIR COLIS NE RAPATRIE PAS UN SEUL OCTET DE PDF
  // ══════════════════════════════════════════════════════════════════════════
  // Mesuré le 15 septembre sur sa vraie base : ouvrir cet écran lisait
  // `harvest_{uid}_label_latest&select=data` UNE FOIS PAR COMPTE — 1 282 ms et
  // 713 Ko pour le plus gros — alors que les deux seules questions posées sont
  // « y a-t-il un PDF ? » et « de quand date-t-il ? ». La version scalaire
  // existait déjà, avec un commentaire qui interdisait exactement ça ; c'est le
  // CALLER qui n'avait pas été retiré. *Une suppression « terminée » se vérifie
  // sur ce qui RESTE* — la leçon du pipeline Factures et du tiroir `Nav`.
  //
  // ⚠️ CE CONTRÔLE PORTE SUR LES OCTETS, PAS SUR LE NOM DE LA FONCTION : il
  //    compte ce qui a traversé le réseau. Renommer, déplacer ou réécrire la
  //    lecture ne peut pas le rendre vert (§6.5) — seul ne pas demander le PDF
  //    le peut. Les octets ont le droit de partir AU CLIC (`startBordereau`),
  //    que le banc ne fait pas.
  const pdfOuverture = PDF.octets;
  dit(pdfOuverture === 0, 'ouvrir Colis ne télécharge aucun octet de PDF',
    pdfOuverture ? `${Math.round(pdfOuverture/1024)} Ko rapatriés par ${[...new Set(PDF.ou)].slice(0,2).join(' | ')}`
                 : `${labelRows.filter(r=>/_label_latest$/.test(r.id)).length} lignes servies à ${PDF_KO} Ko pièce`);

  // ══════════════════════════════════════════════════════════════════════════
  // ET LE BANDEAU « TAMPONNER EN 1 CLIC » MARCHE TOUJOURS, SUR LE BON COMPTE
  // ══════════════════════════════════════════════════════════════════════════
  // La moitié qui manquerait à un contrôle posé seulement sur les octets : ne
  // rien lire du tout est le moyen le plus simple de ne rien télécharger. Le
  // bandeau doit donc TOUJOURS s'afficher pour un bordereau frais — et nommer
  // le compte dont le PDF existe, pas le compte plus frais qui n'en a pas.
  // C'est la donnée qui déclenche : deux lignes `label_latest` fraîches, une
  // seule avec son PDF.
  {
    const ligne = v.txt.split('\n').map(x=>x.trim()).find(l=>/Bordereau téléchargé il y a/i.test(l)) || '';
    console.log(`    bandeau frais : ${ligne||'(aucun)'}`);
    dit(!!ligne, 'un bordereau capté il y a 7 min ouvre le tamponnage en 1 clic',
      `${NOM_FRAIS} a son PDF — sans ce bandeau, il refait le tamponnage à la main`);
    dit(!!ligne && ligne.includes(NOM_FRAIS), 'et il nomme le compte dont le PDF est là',
      `attendu ${NOM_FRAIS}`);
    dit(!ligne.includes(NOM_SANS), "et jamais celui dont le PDF n'est pas arrivé",
      `${NOM_SANS} est plus frais de 5 min, mais sa ligne n'a pas de PDF — le filtre l'écarte`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MA JOURNÉE NE DOIT PAS ANNONCER MOINS DE BORDEREAUX PRÊTS QUE COLIS
  // ══════════════════════════════════════════════════════════════════════════
  // Mesuré le 8 septembre sur ses vraies données : l'accueil disait « 8
  // bordereaux prêts à imprimer », Colis « 9 » — même formule, mêmes données.
  // Cause : la règle « prêt » a deux moitiés (PDF reçu par email · bordereau
  // capté par l'extension) et Ma journée ne demande JAMAIS les lignes
  // `label_*` : 18 requêtes sur Colis, zéro sur l'accueil. Son compte est donc
  // un MINORANT, et il était présenté comme un total.
  //
  // ⚠️ CE CONTRÔLE PORTE SUR LES NOMBRES, PAS SUR LA PHRASE. Il compare les
  // deux écrans ; une reformulation ne peut pas le rendre vert (§6.5).
  // ⚠️ ET IL TESTE L'APPAREIL NEUF, l'ordre le plus risqué : Ma journée
  // ouverte EN PREMIER, avant que Colis ait rien publié. C'est là que le
  // minorant sort — dans l'autre sens le défaut est invisible.
  {
    // ⚠️ DEUX FORMULATIONS, PAS UNE — et mon premier jet n'en couvrait qu'une.
    //    La carte de Ma journée écrit « N bordereaux prêts à imprimer » quand
    //    rien n'est en retard, mais « 1 en retard · N prêts à imprimer » dès
    //    qu'un colis l'est. Les données ont vieilli d'un jour, un colis est
    //    passé en retard, et le banc a crié au loup sur une app intacte.
    //    C'est §6.5 à mes dépens : on lit le NOMBRE devant « prêt(s) à
    //    imprimer », quelle que soit la phrase autour.
    const lit = (t) => { const m=/((?:au moins )?)(\d+)\s+(?:bordereaux?\s+)?pr[êe]ts?\s+[àa]\s+imprimer/i.exec(t);
      return m ? { n:+m[2], approx:!!m[1].trim() } : null; };
    const ctx = await b2.newContext({viewport:{width:1512,height:950}});
    const p2 = await ctx.newPage();
    await brancher(p2);
    await p2.goto('http://localhost:4403/?tab=journee',{waitUntil:'domcontentloaded'});
    await p2.waitForTimeout(5500);
    const av = lit(await p2.evaluate(()=>document.body.innerText||''));
    await p2.goto('http://localhost:4403/?tab=cat_bord',{waitUntil:'domcontentloaded'});
    await p2.waitForTimeout(5500);
    const colis = lit(await p2.evaluate(()=>document.body.innerText||''));
    await p2.goto('http://localhost:4403/?tab=journee',{waitUntil:'domcontentloaded'});
    await p2.waitForTimeout(5500);
    const ap = lit(await p2.evaluate(()=>document.body.innerText||''));
    console.log(`    accueil seul : ${av?(av.approx?'au moins ':'')+av.n:'—'} · Colis : ${colis?colis.n:'—'} · accueil ensuite : ${ap?(ap.approx?'au moins ':'')+ap.n:'—'}`);
    dit(!!(av && colis && ap), 'les deux écrans annoncent un nombre de bordereaux prêts');
    if (av && colis) {
      // Le seul mensonge possible : annoncer un nombre EXACT plus petit.
      dit(av.n >= colis.n || av.approx,
        "sur un appareil neuf, l'accueil n'annonce pas un total exact qu'il n'a pas mesuré",
        `accueil ${av.n}${av.approx?' (annoncé comme minorant)':' (annoncé exact)'} · Colis ${colis.n}`);
    }
    if (ap && colis) dit(ap.n === colis.n && !ap.approx,
      "et une fois Colis ouvert, les deux écrans disent le même nombre",
      `accueil ${ap.n}${ap.approx?' (minorant)':''} · Colis ${colis.n}`);
    await ctx.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // « LES PLUS URGENTS SONT EN HAUT DE LA LISTE » — vrai seulement PARFOIS
  // ══════════════════════════════════════════════════════════════════════════
  // La liste se groupe sur CE QU'IL PEUT FAIRE (prêts à imprimer, puis en
  // attente de bordereau) ; l'urgence n'est que le tri À L'INTÉRIEUR de chaque
  // groupe. Le bandeau affirmait pourtant « les plus urgents sont en haut de
  // la liste ». Vu en capture le 8 septembre : le seul « à poster demain »
  // était dans le SECOND groupe, dix cartes plus bas — et c'était justement
  // celui qu'il ne peut pas imprimer. La structure avait été corrigée, la
  // phrase qui la décrit était restée en arrière.
  //
  // ⚠️ C'EST LA POSITION QUI DÉCLENCHE, PAS LA FORMULATION : s'il existe un
  // colis pressé APRÈS l'intertitre « En attente de leur bordereau », alors le
  // bandeau doit dire où il est. Une reformulation ne peut pas rendre ce
  // contrôle vert (§6.5).
  {
    const lignes = v.txt.split('\n').map(x=>x.trim());
    const iAttente = lignes.findIndex(l=>/^En attente de leur bordereau/i.test(l));
    const presse = /à poster demain|à poster aujourd'hui|en retard/i;
    const presseEnBas = iAttente>=0 && lignes.slice(iAttente).some(l=>presse.test(l));
    const bandeau = lignes.find(l=>/(en retard|aujourd'hui|demain)\s+—/.test(l)) || '';
    console.log(`    bandeau d'urgence : ${bandeau||'(aucun)'}${presseEnBas?'  [un pressé est dans le 2e groupe]':''}`);
    if (presseEnBas && bandeau) {
      dit(/En attente de leur bordereau/i.test(bandeau),
        "quand un colis pressé attend encore son bordereau, le bandeau dit où il est",
        `il annonce : « ${bandeau} »`);
      dit(!/les plus urgents sont en haut de la liste/i.test(bandeau),
        "et il ne promet pas de le trouver en haut de la liste",
        'la liste se groupe sur ce qu\'il peut faire, pas sur l\'urgence');
    } else if (bandeau) {
      dit(true, 'aucun colis pressé hors du premier groupe — le bandeau peut renvoyer en haut');
    }
  }

  await b.close(); await b2.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nL\'ecran Colis voit ses bordereaux.');
  process.exit(ko?1:0);
})();
