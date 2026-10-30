import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import{createRequire}from'node:module';
// App.jsx et les écrans découpés (29 oct.) : la règle peut vivre dans src/Ecran*.jsx.
const source=createRequire(import.meta.url)('../_source-app.cjs').sourceApp();
const debut=source.indexOf('  const acctHealth = (acc) => {');
const fin=source.indexOf('  // Comptes exclus de la comptabilité',debut);
function lire(etat,refuse=false){
 const contexte={etatExt:etat,hiddenAccts:new Set(),blockedAccts:new Set(refuse?['35']:[]),lastCap:{},C:{muted:'gris',warn:'orange',danger:'rouge',text:'noir'}};
 return vm.runInNewContext(source.slice(debut,fin)+';acctHealth({vinted_user_id:35});',contexte);
}
test('un compte sans statut confirmé ne se présente jamais comme actif',()=>{
 for(const etat of [undefined,null,{}, {'35':{etat:'passu'}}])assert.equal(lire(etat).label,'État non vérifié');
});
test('un accès refusé ne prouve pas un bannissement',()=>{
 assert.equal(lire({},true).label,'Accès refusé');
});
test('le verdict explicite du profil prime sur un ancien refus local',()=>{
 assert.equal(lire({'35':{etat:'banni'}}).label,'Banni par Vinted');
 assert.equal(lire({'35':{etat:'actif'}},true).label,'Actif');
});
