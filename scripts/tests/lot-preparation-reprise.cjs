// Exécute le vrai contrôleur de lot ; aucun PDF ou compte réel.
// (16 nov., parcours-vert) Le moteur « Tout imprimer » d'avant (`batchBordereaux` seul) est remplacé depuis le
// 14 nov. (impression-simple) par `imprimerLot` → `lancerImpression` → `attendrePuisOuvrir` ; `batchBordereaux`
// (l'« Imprimer » des actions en série) passe par lui. Le banc exécute CE bloc-là, d'un morceau, avec les vraies
// règles pures (`lotSimple.js`, `lotSelection.js`) et juge les mêmes règles qu'avant :
//   1. la progression avance APRÈS la lecture de chaque bordereau (jamais avant) ;
//   2. un bordereau raté est NOMMÉ (absent, avec sa raison) et n'est pas marqué « imprimé » ;
//   3. une panne de lecture n'ouvre rien, ne marque rien, et « Réessayer » reprend la MÊME sélection ;
//   4. un changement de compte pendant la préparation : rien ouvert, rien marqué.
const fs=require('fs'),vm=require('vm'),path=require('path'),url=require('url'),assert=require('assert/strict');
const racine=path.resolve(__dirname,'..','..');
const src=fs.readFileSync(path.join(racine,'src/App.jsx'),'utf8'),a=src.indexOf('  const batchBordereaux ='),b=src.indexOf('  // « Déplacer le tampon » (depuis « Bordereau prêt »)',a);
assert(a>0&&b>a,'le bloc du lot (batchBordereaux … imprimerLotRef.current = imprimerLot) est introuvable');
const bloc=src.slice(a,b);
assert(/imprimerLotRef\.current = imprimerLot;/.test(bloc)&&/const attendrePuisOuvrir =/.test(bloc),'le bloc ne porte plus imprimerLot / attendrePuisOuvrir');
// useState nommé par son setter : le banc lit chaque état posé.
// (16 nov., lot tampons-parametres) La sélection ouvre l'APERÇU AVANT IMPRESSION : la lecture des PDF (et sa progression,
// ses pannes, le changement de compte) se fait pour l'aperçu ; « Imprimer » de l'aperçu (`imprimerApercu`) ouvre le PDF.
// Le banc joue ce toucher (`imprimer()`), la réf de l'aperçu posée comme le rendu la poserait.
const code=bloc.replace(/const \[(\w*), (set\w+)\] = useState\(/g,(_,v,s)=>`const [${v||'_'+s}, ${s}] = __etat('${s}', `)+'\nglobalThis.executer = batchBordereaux;\nglobalThis.imprimerApercu = imprimerApercu;\nglobalThis.__apercuRef = apercuRef;\n';
let regles=null;
// Les objets nés dans le contexte vm n'ont pas le même prototype : on compare leur forme JSON.
const eg=(x,y,m)=>assert.equal(JSON.stringify(x),JSON.stringify(y),m);
function banc(){
 const rows=['a','b'].map(cle=>({cle,site:'vestiaire',num:cle,titre:cle,v:{id:cle,bordereau:{id:'vc_label_'+cle}}}));
 const poses={},marques=[],echecs=[],erreurs=[];let fini;const c={};
 const fin=()=>new Promise(r=>{fini=r;});
 Object.assign(c,{...regles,Set,Map,Array,Number,String,Date,Error,Math,Object,JSON,Promise,Uint8Array,Blob,
  URL:{createObjectURL:()=>'blob:banc',revokeObjectURL:()=>{}},
  React:{useRef:(v)=>({current:v}),useEffect:()=>{}},
  __etat:(nom,init)=>[init,(v)=>{(poses[nom]=poses[nom]||[]).push(v);if(nom==='setApercuImpr'&&c.__apercuRef)c.__apercuRef.current=v;if(nom==='setImprBusy'&&v===null&&fini)fini();}],
  TAILLES_TAMPON:{S:0.8,M:1,L:1.25},reglageTamponsChoisi:()=>({}),ecrireReglageTampons:()=>{},avecPlace:(r)=>r,avecChoix:(r)=>r,resoudreTampon:()=>({texteMention:'M'}),aEcrire:(r)=>r,
  AUTH:{user:{id:'A'}},SUPABASE_URL:'https://base.example.test',imprimante:null,imprMode:(f)=>f||'normale',
  _octetsLot:new Map(),_verNum:{etat:'attente',at:0},_visionneuse:null,_pendingBordPrint:false,emailBords:[],only:'bordereaux',colisDans:'',labelsPrets:true,sales:{items:[]},
  tr:(k)=>k,toast:(m)=>{if(/^Erreur/.test(String(m)))erreurs.push(m);},
  imprTouchee:{current:false},choisirImprimante:()=>{},ouvrirLot:()=>{},isCloudReady:()=>true,load:()=>'normale',save:()=>{},
  lignesLotTous:()=>rows,sigLigneLot:(l)=>l.cle,
  positionsTampon:()=>({}),reglageImpressionChoisi:()=>({}),
  numerosDemandent:()=>false,assurerVersionNumerotation:async()=>true,confirmerNumerosAVerifier:async()=>true,
  NUMEROS_PERIMES_IMPRESSION:'N° périmés',NUM_A_VERIFIER_ANNULE:'annulé',
  estIOS:()=>false,estAndroid:()=>false,reserverOngletPdf:()=>{},libererOngletPdf:()=>{},estTamponAnnule:()=>false,
  accompagner:()=>{const acc={pendant:()=>acc,oublier:()=>{},echec:(err,o)=>{echecs.push({err,o:o||{}});}};return acc;},
  b64ToBytes:()=>new Uint8Array([1]),posForFormat:()=>null,
  lireBaseRelue:async()=>[{b64:'YQ=='}],
  composerBordereaux:async(items)=>({bytes:new Uint8Array([1]),count:items.length,reussis:items.map((_,i)=>i),rates:[]}),
  ouvrirPdfLot:()=>'visionneuse',
  setBordsPrinted:()=>{},noterImprimeSansNum:()=>{},signalerBordereauImprime:()=>{},
  marquerVc:(_,id)=>marques.push(id)});
 vm.createContext(c);vm.runInContext(code,c);
 const dernier=(nom)=>{const l=poses[nom]||[];return l[l.length-1];};
 // Son toucher sur « Imprimer » de l'aperçu (s'il est ouvert) ; rend la fin du geste.
 const imprimer=async()=>{if(!c.__apercuRef||!c.__apercuRef.current)return false;const f2=fin();c.imprimerApercu();await Promise.race([f2,new Promise(r=>setTimeout(r,50))]);return true;};
 return{c,poses,marques,echecs,erreurs,fin,dernier,imprimer};
}
(async()=>{
 const imp=async(f)=>(await import(url.pathToFileURL(path.join(racine,f)).href));
 const ls=await imp('src/impression/lotSimple.js'),sel=await imp('src/lotSelection.js'),th=await imp('src/impression/thermique.js');
 regles={formatRetenu:ls.formatRetenu,signatureLot:ls.signatureLot,absentsDuLot:ls.absentsDuLot,cochesParDefaut:sel.cochesParDefaut,selectionImprimable:sel.selectionImprimable,TAMPONS_IMPR:th.TAMPONS};
 // 1 + 2 : progression après lecture ; le 2e bordereau illisible est nommé, seul le 1er est marqué.
 {
  const f=banc();let liberer;let n=0;f.c.lireBaseRelue=()=>new Promise(r=>{liberer=r;n++;});
  f.c.composerBordereaux=async()=>({bytes:new Uint8Array([1]),count:1,reussis:[0],rates:[1]});
  const fin=f.fin();f.c.executer(new Set(['a','b']));await new Promise(setImmediate);
  eg(f.dernier('setImprBusy'),{fait:0,total:2},'rien n’est compté avant la lecture');
  liberer([{b64:'YQ=='}]);await new Promise(setImmediate);
  assert.equal(n,2);eg(f.dernier('setImprBusy'),{fait:1,total:2},'la progression avance après la 1re lecture');
  liberer([{b64:'Yg=='}]);await fin;
  assert.ok(await f.imprimer(),'l’aperçu avant impression s’est ouvert');
  const e=f.dernier('setImprEtat');assert.ok(e&&e.res,'la feuille d’après s’ouvre');
  eg(e.res.reussies,['a']);eg(e.absents.map(x=>[x.cle,x.raison]),[['b','illisible']],'le raté est NOMMÉ avec sa raison');
  eg(f.marques,['a'],'seul le bordereau sorti est marqué imprimé');assert.equal(f.echecs.length,0,'aucun échec : '+JSON.stringify(f.echecs.map(x=>String(x.err&&x.err.message||x.err))));eg(f.erreurs,[],'aucune erreur de code avalée');
 }
 // 3 : panne de lecture ⇒ rien ouvert, rien marqué, « Réessayer » reprend la même sélection.
 {
  const e=banc();e.c.lireBaseRelue=async()=>{throw Error('Réseau');};
  let fin=e.fin();e.c.executer(new Set(['a','b']));await fin;
  assert.equal(e.poses.setImprEtat,undefined,'rien ne s’ouvre sur une panne');assert.equal(e.marques.length,0);
  assert.equal(e.echecs.length,1);assert.equal(e.echecs[0].err.message,'Réseau','la vraie panne est dite (pas une erreur de code)');assert.equal(typeof e.echecs[0].o.reessayer,'function','la panne est dite avec « Réessayer »');
  e.c.lireBaseRelue=async()=>[{b64:'YQ=='}];fin=e.fin();e.echecs[0].o.reessayer();await fin;
  assert.ok(await e.imprimer(),'Réessayer rouvre l’aperçu');
  eg(e.marques,['a','b'],'Réessayer reprend la même sélection');eg(e.dernier('setImprEtat').absents,[]);
 }
 // 4 : le compte change pendant la préparation ⇒ rien ouvert, rien marqué.
 {
  const o=banc();o.c.composerBordereaux=async(items)=>{o.c.AUTH.user.id='B';return{bytes:new Uint8Array([1]),count:items.length,reussis:items.map((_,i)=>i),rates:[]};};
  const fin=o.fin();o.c.executer(new Set(['a','b']));await fin;
  assert.equal(o.marques.length,0);assert.equal(o.poses.setImprEtat,undefined);assert.equal(o.echecs.length,1);assert.equal(o.echecs[0].err.message,'impr.change');
 }
 console.log('OK : progression après lecture, raté nommé et seul le sorti marqué, panne sans rien ouvert puis « Réessayer » sur la même sélection, aucun marquage après changement de compte.');
})().catch(e=>{console.error(e);process.exitCode=1;});
