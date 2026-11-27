require('../_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs=require('fs'),assert=require('assert/strict');
// (6 nov., v36) `save(k, v, quand)` : la signature a gagné l'issue locale ; le vrai `save` et le vrai `_rendreQuand`
// sont tirés d'App.jsx. Ses voisins (journal des N°, file d'envoi, gestes hors ligne, fusion) sont posés neutres :
// ce test juge la sauvegarde LOCALE ratée, le changement de vendeur et l'envoi au nuage.
const app=fs.readFileSync('src/App.jsx','utf8');
const source=app.match(/const _rendreQuand = \(k, ok, raison\) => \{[^\n]*\n/)[0]+app.match(/const save = \(k,v,quand\) => \{[\s\S]*?\n};/)[0];
let fail=true,pushes=0;const tasks=[],errors=[];const AUTH={user:{id:'vendeur-a'}};
const api=new Function('AUTH','localStorage','setTimeout','clearTimeout','cloudPush','_emitSync',`
 const SYNC_KEYS=['reglage'];let _settingsRevision=0,_saveTimers={};const _failedLocalSaves=new Map();
 const readSession=()=>({user:AUTH.user});const window={dispatchEvent:()=>{}};const Event=class{};const CustomEvent=class{};
 const _saveQuand={},_saveRun={},_saveEnAttente={},_saveAvant={},_avantCopieLocale={},_clesRelues=new Map(),REGLAGES_AUTO_CLES=[],REGLES_GESTES={},HORS_FILE=[],_baseNuage=null,CLE_JOURNAL_NUMEROS='j';
 const fusionALaSauvegarde=(k,v)=>({v});const _lireJson=t=>{try{return t==null?undefined:JSON.parse(t);}catch(_){return undefined;}};const egalStable=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const sessionStorage={getItem:()=>null,setItem:()=>{}};const noterChangements=()=>false;const enFile=()=>false;const noterSaisie=()=>{};const signalerFile=()=>{};const emettreClesRelues=()=>{};
 const horsLigneMaintenant=()=>false;const gesteHLEnAttenteSur=()=>false;const noterGesteHL=()=>{};const noterJournalNumeros=()=>{};const ecrireReglagesAutoLigne=()=>{};const conflitNumerosNuage=()=>{};
 ${source};return {save,failed:_failedLocalSaves,revision:()=>_settingsRevision};
`)(AUTH,{getItem:()=>null,setItem:()=>{if(fail)throw Error('quota');}},fn=>{tasks.push(fn);return tasks.length;},()=>{},()=>pushes++,(_,message)=>errors.push(message));
let issue=null;api.save('reglage','valeur',(ok,raison)=>issue={ok,raison});tasks.shift()();assert.equal(issue&&issue.ok,false,'le geste apprend que l’appareil a refusé');assert.equal(pushes,0);assert.equal(api.failed.size,1);assert.match(errors[0],/stockage/);
fail=false;api.save('reglage',api.failed.get('reglage').v);tasks.shift()();assert.equal(pushes,1);assert.equal(api.failed.size,0);
api.save('reglage','nouvelle valeur');AUTH.user={id:'vendeur-b'};tasks.shift()();assert.equal(pushes,1,'Un changement de vendeur invalide la sauvegarde différée');
console.log('OK : échec local conservé et non envoyé, réessai possible, changement de vendeur protégé.');
