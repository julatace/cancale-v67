import test from 'node:test';
import assert from 'node:assert/strict';
import { lirePlateformes, plateformesAffichees } from '../../src/plateformesAffichage.js';
import { siteMontre } from '../../src/profilVendeur.js';
test('un nouveau vendeur ne voit pas les sites qu’il n’a pas choisis', () => {
  assert.deepEqual(plateformesAffichees(null, { ebay: null }), ['vinted']);
  assert.deepEqual(plateformesAffichees({sites:['ebay','inconnu','ebay']}), ['ebay']);
  assert.equal(siteMontre('vinted', { mode:'complet', plateformes:['ebay'], choisi:'vinted' }), false);
  assert.equal(siteMontre('toutes', { plateformes:['ebay'] }), true);
});
test('un compte réellement relié apparaît sans prendre une panne pour une connexion', () => {
  assert.deepEqual(plateformesAffichees({sites:['vinted']}, {leboncoin:true,ebay:null,vestiaire:false}), ['vinted','leboncoin']);
  assert.deepEqual(lirePlateformes({sites:['ebay',null,'autre']}), {sites:['ebay'],at:null});
  assert.equal(lirePlateformes({sites:'ebay'}), null);
});

test('le profil publié du vendeur précédent reste invisible au propriétaire suivant', async () => {
  const {readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');
  const app=readFileSync(new URL('../../src/App.jsx',import.meta.url),'utf8');
  const a=app.indexOf('function useProfilVendeur() {');
  // La fonction seule (jusqu'à son accolade de fin) : un bloc rangé après elle ne doit pas entrer dans le test.
  const fin=app.indexOf('\n}\n',a)+2;
  assert.ok(a>0&&fin>a);
  const profil={uid:'A',plateformes:['ebay'],contexte:{proprietaire:true}};
  const ctx={PROFIL_VENDEUR:profil,AUTH:{user:{id:'B'}},React:{useReducer:()=>[0,()=>{}],useEffect(){}},_ecoutesProfil:new Set()};
  const code=app.slice(a,fin)+';useProfilVendeur();';
  const suivant=runInNewContext(code,ctx);assert.equal(suivant.plateformes,null);assert.deepEqual(Object.keys(suivant.contexte),[]);
  ctx.AUTH.user.id='A';assert.equal(runInNewContext(code,ctx),profil);
});
