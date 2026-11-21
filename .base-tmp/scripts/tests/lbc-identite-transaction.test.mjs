import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const s=fs.readFileSync(new URL('../../vinted-sync-extension/background.js',import.meta.url),'utf8'),a=s.indexOf('function extraireVentesLbc('),b=s.indexOf('// ⚠️⚠️ (20 oct.',a);
const c={labelInfoDe:()=>null,imageDeVente:()=>'',dateVenteLbc:()=>''};vm.createContext(c);vm.runInContext(s.slice(a,b),c);
const d={purchase_id:42,is_seller:true,item:{id:7,prices:{final:2500,total:2928}},step:{status:'done'}};
test('un identifiant de transaction contradictoire ne peut pas remplacer une autre vente',()=>{
 assert.equal(c.extraireVentesLbc('https://api.leboncoin.fr/api/consumergoods/proxy/v2/pages/transactions/43',d).length,0);
 const r=c.extraireVentesLbc('https://api.leboncoin.fr/api/consumergoods/proxy/v2/pages/transactions/42',d);assert.equal(r[0].txId,'42');assert.equal(r[0].itemId,'7');assert.equal(r[0].price,2500);
});
test("un identifiant d'annonce seul ne devient jamais un numéro de transaction",()=>{
 const sans={...d};delete sans.purchase_id;assert.equal(c.extraireVentesLbc('https://www.leboncoin.fr/compte/part/mes-transactions',sans).length,0);
});
