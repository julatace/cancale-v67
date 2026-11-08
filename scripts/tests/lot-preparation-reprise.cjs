// Exécute le vrai contrôleur de lot ; aucun PDF ou compte réel.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const src=fs.readFileSync('src/App.jsx','utf8'),a=src.indexOf('  const batchBordereaux ='),b=src.indexOf('  // Deep-link « Tout imprimer »',a);
assert(a>0&&b>a);const code=src.slice(a,b).replace('const batchBordereaux =','globalThis.executer =');
function banc(){
 const rows=['a','b'].map(cle=>({cle,site:'vestiaire',num:cle,titre:cle,v:{id:cle,bordereau:{id:'vc_label_'+cle}}}));
 const etats=[],marques=[],resultats=[];const c={Set,Map,Array,Number,String,Date,Error,Math,Uint8Array,AUTH:{user:{id:'A'}},batchBusy:false,imprimante:null,SUPABASE_URL:'https://base.example.test',lot:{coches:new Set(['a','b']),echecs:[],verifications:{a:'preuve'}},lotActuel:{current:{lignes:()=>rows,sig:l=>l.cle}},selectionImprimable:(l,s)=>l.filter(x=>!s||s.has(x.cle)),lignesLotTous:()=>rows,sigLigneLot:l=>l.cle,controlePreparation:()=>({reste:0}),libererOngletPdf:()=>{},toast:()=>{},setProgressionLot:p=>etats.push(p),setBatchBusy:v=>c.batchBusy=v,setLot:f=>c.lot=f(c.lot),setBordResult:r=>resultats.push(r),marquerVc:(_,id)=>marques.push(id),setBordsPrinted:()=>{},estTamponAnnule:()=>false,b64ToBytes:()=>new Uint8Array([1]),posForFormat:()=>null,texteSansBordereau:()=>'',lireBaseRelue:async()=>[{b64:'YQ=='}],mergeAndDownloadBordereaux:async(items,_,opts)=>{opts.avantOuverture();return{count:items.length,reussis:items.map((_,i)=>i),rates:[]};}};
 vm.createContext(c);vm.runInContext(code,c);return{c,etats,marques,resultats};
}
(async()=>{
 const f=banc();let liberer;let n=0;f.c.lireBaseRelue=()=>new Promise(r=>{liberer=r;n++;});
 const vol=f.c.executer(new Set(['a','b']));assert.equal(f.etats.at(-1).fait,0);liberer([{b64:'YQ=='}]);await new Promise(setImmediate);assert.equal(n,2);assert.equal(f.etats.at(-1).fait,1);
 f.c.mergeAndDownloadBordereaux=async(_,__,opts)=>{opts.avantOuverture();return{count:1,reussis:[0],rates:[1]};};liberer([{b64:'Yg=='}]);await vol;
 assert.deepEqual([...f.c.lot.coches],['b']);assert.deepEqual(f.marques,['a']);assert.equal(f.c.batchBusy,false);
 const e=banc();e.c.lireBaseRelue=async()=>{throw Error('Réseau');};await e.c.executer(new Set(['a','b']));assert.deepEqual([...e.c.lot.coches],['a','b']);assert.ok(e.c.lot.erreur);assert.equal(e.resultats.length,0);assert.equal(e.c.batchBusy,false);
 e.c.lireBaseRelue=async()=>[{b64:'YQ=='}];await e.c.executer(new Set(e.c.lot.coches));assert.equal(e.c.lot,null);assert.deepEqual(e.marques,['a','b']);
 const o=banc();o.c.mergeAndDownloadBordereaux=async(_,__,opts)=>{opts.avantOuverture();o.c.AUTH.user.id='B';return{count:2,reussis:[0,1],rates:[]};};await o.c.executer(new Set(['a','b']));assert.equal(o.marques.length,0);assert.equal(o.resultats.length,0);
 console.log('OK : progression après lecture, reprise des seuls échecs, sélection conservée après panne, aucun marquage après changement de compte.');
})().catch(e=>{console.error(e);process.exitCode=1;});
