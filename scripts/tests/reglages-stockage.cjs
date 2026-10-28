const fs=require('fs'),assert=require('assert/strict');
const source=fs.readFileSync('src/App.jsx','utf8').match(/const save = \(k,v\) => \{[\s\S]*?\n};/)[0];
let fail=true,pushes=0;const tasks=[],errors=[];const AUTH={user:{id:'vendeur-a'}};
const api=new Function('AUTH','localStorage','setTimeout','clearTimeout','cloudPush','_emitSync',`
 const SYNC_KEYS=['reglage'];let _settingsRevision=0,_saveTimers={};const _failedLocalSaves=new Map();
 const readSession=()=>({user:AUTH.user});const window={dispatchEvent:()=>{}};const Event=class{};const CustomEvent=class{};
 ${source};return {save,failed:_failedLocalSaves,revision:()=>_settingsRevision};
`)(AUTH,{setItem:()=>{if(fail)throw Error('quota');}},fn=>{tasks.push(fn);return tasks.length;},()=>{},()=>pushes++,(_,message)=>errors.push(message));
api.save('reglage','valeur');tasks.shift()();assert.equal(pushes,0);assert.equal(api.failed.size,1);assert.match(errors[0],/stockage/);
fail=false;api.save('reglage',api.failed.get('reglage').v);tasks.shift()();assert.equal(pushes,1);assert.equal(api.failed.size,0);
api.save('reglage','nouvelle valeur');AUTH.user={id:'vendeur-b'};tasks.shift()();assert.equal(pushes,1,'Un changement de vendeur invalide la sauvegarde différée');
console.log('OK : échec local conservé et non envoyé, réessai possible, changement de vendeur protégé.');
