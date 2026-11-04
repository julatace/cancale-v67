import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('const seDeconnecterPartout = async () => {'), source.indexOf('function AppareilsConnectes()')) + ';globalThis.lancer=seDeconnecterPartout;';
function fixture() {
  let confirmer, terminer, appels=0, sorties=0;
  const timers=[];
  const c = vm.createContext({ SUPABASE_URL:'https://base.invalid',SUPABASE_KEY:'fictive', AUTH:{user:{id:'A'},session:{access_token:'A'}}, vmrExtPresent:()=>false,extSait:()=> 'ok', texteConfirmationPartout:()=>'', askConfirm:()=>new Promise(r=>confirmer=r), deconnecterPartout:()=>{appels++;return new Promise(r=>terminer=r);}, toast(){}, authSignOut:()=>sorties++,location:{reload(){}},setTimeout:fn=>timers.push(fn) });
  vm.runInContext(code,c);
  return {c,timers,confirm:()=>confirmer(true),done:()=>terminer('ok'),calls:()=>appels,logouts:()=>sorties};
}
test('une confirmation ouverte par A ne déconnecte pas B après une bascule', async()=>{
 const f=fixture(), p=f.c.lancer();f.c.AUTH.user.id='B';f.confirm();await new Promise(r=>setImmediate(r));if(f.calls())f.done();await p;assert.equal(f.calls(),0);
});
test('un retour tardif de la déconnexion de A ne ferme pas la session de B', async()=>{
 const f=fixture(), p=f.c.lancer();f.confirm();await new Promise(r=>setImmediate(r));assert.equal(f.calls(),1);f.c.AUTH.user.id='B';f.done();await p;assert.equal(f.timers.length,0);assert.equal(f.logouts(),0);
});
test('la fermeture différée protège aussi une nouvelle session ; le vendeur courant peut se déconnecter', async()=>{
 for(const bascule of [false,true]){const f=fixture(),p=f.c.lancer();f.confirm();await new Promise(r=>setImmediate(r));f.done();await p;assert.equal(f.timers.length,1);if(bascule)f.c.AUTH.user.id='B';f.timers[0]();assert.equal(f.logouts(),bascule?0:1);}
});
