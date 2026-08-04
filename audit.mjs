import { chromium } from 'playwright'; import fs from 'fs';
const S=process.argv[2]; const J=f=>{try{return JSON.parse(fs.readFileSync(`${S}/${f}`,'utf8'));}catch{return [];}};
const F={main:J('main.json'),listings:J('listings.json'),sold:J('sold.json'),purch:J('purch.json'),accounts:J('accounts.json'),inbox:J('inbox.json'),profile:J('profile.json'),sale:J('e_sale.json'),bord:J('e_bord.json'),track:J('e_track.json'),final:J('e_final.json'),achat:J('e_achat.json')};
const cap=r=>(Array.isArray(r)?r:[]).map(x=>({...x,cap:x.data&&x.data.capturedAt}));
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:844}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/rest/v1/**',route=>{const u=new URL(route.request().url());const id=u.searchParams.get('id')||'';const sel=u.searchParams.get('select')||'';
 const send=d=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(d)});
 if(sel==='owner')return route.fulfill({status:400,body:'{}'});
 if(u.pathname.includes('vinted_accounts'))return send(F.accounts.map(a=>({...a,access_token:'x',refresh_token:'x',anon_id:'x',csrf_token:'x'})));
 if(id==='eq.main')return send(F.main);
 if(/^eq\.harvest_(\d+)_listings$/.test(id)){const uid=id.match(/harvest_(\d+)_/)[1];return send(cap(F.listings.filter(r=>r.id===`harvest_${uid}_listings`)));}
 if(/^eq\.harvest_(\d+)_inbox$/.test(id)){const uid=id.match(/harvest_(\d+)_/)[1];return send(cap(F.inbox.filter(r=>r.id===`harvest_${uid}_inbox`)));}
 if(/^eq\.harvest_(\d+)_profile$/.test(id)){const uid=id.match(/harvest_(\d+)_/)[1];return send(cap(F.profile.filter(r=>r.id===`harvest_${uid}_profile`)));}
 if(/orders_/.test(id)){const uid=(id.match(/harvest_(\d+)_/)||[])[1];return send(cap([...F.sold,...F.purch].filter(r=>!uid||r.id.startsWith(`harvest_${uid}_`))));}
 if(/email_bord/.test(id))return send(F.bord); if(/email_sale/.test(id))return send(F.sale);
 if(/email_track/.test(id))return send(F.track); if(/email_final/.test(id))return send(F.final); if(/email_achat/.test(id))return send(F.achat);
 return send([]);});
await p.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
await p.route(/nominatim|api-adresse/,r=>r.fulfill({status:200,body:'[]'}));
await p.addInitScript(()=>localStorage.setItem('vrm_acces_direct','1'));
await p.goto('http://localhost:4341/',{waitUntil:'networkidle'}); await p.waitForTimeout(3500);
const screens=[['Ma journée','journee'],['Stats','dashboard'],['Annonces','annonces'],['Republier','republier'],['Ventes','ventes'],['Achats','achats'],['Bordereaux','bordereaux'],['Messages','messages'],['Garage','garage'],['Factures','factures']];
for(const [label,key] of screens){
  try{ await p.locator('button').filter({hasText:new RegExp('^'+label+'$')}).last().click({timeout:4000}); }catch{ errs.push('NAV:'+label); continue; }
  await p.waitForTimeout(2600); await p.screenshot({path:`au_${key}.png`});
}
console.log('ERREURS:',errs.length?[...new Set(errs)].join(' || '):'aucune');
await b.close();
