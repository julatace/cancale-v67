// BANC — « Publier » eBay en UN clic (28 oct.). Julien : « quand j'appuie sur
// publier, l'annonce se publie toute seule avec les critères et la description
// de la plateforme d'où elle vient ». Données INVENTÉES, eBay simulé, rendu réel
// (390 px). On juge le CORPS de ce qui part vers /api/ebay, jamais un libellé :
//   A. l'article a sa catégorie Vinted (Hommes › Chaussures › Baskets) : un clic
//      ⇒ vérification à blanc, UNE confirmation, « Annuler » n'envoie rien ;
//      « Oui » ⇒ UN `publish`, critères remplis par des FAITS de Vinted (marque,
//      pointure, couleur, Département = Homme d'après la catégorie Vinted, Type),
//      description de Vinted ;
//   B. sans catégorie Vinted : « Département » ne se devine pas ⇒ rien n'est
//      vérifié ni publié, et le critère manquant est NOMMÉ.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json' };
const srv = http.createServer((q,r)=>{ let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html'; const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p)); });
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 4951;
srv.listen(PORT);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGNk+M+ADzCOKgAAV7wDA8mm/lgAAAAASUVORK5CYII=','base64');
const CATALOGUE = JSON.stringify({ catalogs: [{ id: 5, title: 'Hommes', path: '', catalogs: [{ id: 1231, title: 'Chaussures', path: 'Hommes', catalogs: [{ id: 1242, title: 'Baskets', path: 'Hommes > Chaussures', catalogs: [] }] }] }] });
let ko = 0; const dit = (c,m,d)=>{ if(!c)ko++; console.log((c?'✅ ':'❌ ')+m+(d?' — '+d:'')); };
async function scenario(b, avecCategorie) {
  const NUMS = { '111': { numero:'401', title:'Nike Air Max 1 Aquatone bleu', photo:'https://img.example/cover.jpg', numberedAt: Date.now() } };
  const DETAILS = { '111': { description:'Air Max 1 portées deux fois, boîte d\'origine.', photos:['https://img.example/1.jpg','https://img.example/2.jpg'] } };
  const it = { id:'111', is_closed:false, nPhotos:2, status:'Très bon état', brand:'Nike', size:'44', color1:'Bleu', price:{ amount:'90.0', currency_code:'EUR' } };
  if (avecCategorie) it.catalog_id = 1242;
  const LISTINGS = { data:{ capturedAt: new Date().toISOString(), payload:{ items:[it] } } };
  const envois = [];
  const pg = await b.newPage({ viewport:{ width:390, height:1400 } });
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(([nums]) => { try{ localStorage.setItem('vrm_acces_direct','1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(nums)); localStorage.setItem('vinted_nums_physiques', JSON.stringify(['401'])); }catch(_){}}, [NUMS]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r)=>{ const t=r.request().resourceType(); if(t==='image') return r.fulfill({status:200,contentType:'image/png',body:PNG}); if(t==='media'||t==='font') return r.abort(); return r.continue(); });
  await pg.route('**/rest/v1/**', route=>{ const u=metaVersData(route.request().url()); const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    if(/\/vinted_accounts/.test(u)) return j([{ vinted_user_id:'u1', login:'moi' }]);
    if(/id=eq\.vinted_catalogue/.test(u)) return j([{ c: CATALOGUE }]);
    if(/id=eq\.vinted_item_details/.test(u)) return j([{ data: DETAILS }]);
    if(/id=eq\.harvest_u1_listings/.test(u)) return j([LISTINGS]);
    return j([]); });
  await pg.route('**/api/**', r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  await pg.route('**/api/ebay**', route=>{ const req=route.request(); const j=d=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(d)});
    if(req.method()!=='POST') return j({ ready:true, canConsent:true });
    let body={}; try{ body=JSON.parse(req.postData()||'{}'); }catch(_){}
    envois.push(body);
    if(body.action==='status') return j({ ok:true, connected:true });
    if(body.action==='pubverify') return j({ ok:true, fees:'0.35', frais:{ total:0.35, parNom:{ ListingFee:0.35 } }, avertissements: [] });
    if(body.action==='publish') return j({ ok:true, itemId:'110000000001', url:'https://www.ebay.fr/itm/110000000001', sku:'VRM-401', avertissements:[] });
    if(body.action==='pubinfo') return j({ ok:true, categorie:{ categoryId:'15709', suggeree:{ categoryId:'15709', categoryName:'Baskets homme' } }, categories:[{categoryId:'15709',categoryName:'Baskets homme'}],
      conditions:[{id:'1000',label:'Neuf'},{id:'3000',label:"D'occasion"}],
      attributs:[
        { nom:'Marque', requis:true, mode:'SELECTION_ONLY', valeurs:['Nike','Adidas'] },
        { nom:'Pointure EU', requis:true, mode:'SELECTION_ONLY', valeurs:['43','44','45'] },
        { nom:'Couleur', requis:true, mode:'SELECTION_ONLY', valeurs:['Bleu','Noir','Blanc'] },
        { nom:'Département', requis:true, mode:'SELECTION_ONLY', valeurs:['Homme','Femme','Unisexe adulte'] },
        { nom:'Type', requis:true, mode:'SELECTION_ONLY', valeurs:['Baskets','Bottes','Sandales'] },
      ], attributsObligatoires:['Marque','Pointure EU','Couleur','Département','Type'] });
    return j({ ok:true }); });
  await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`,{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(2500);
  try { await pg.getByRole('button', { name: 'Annonces', exact: true }).first().click({ timeout: 5000 }); await pg.waitForTimeout(1500); } catch (_) {}
  const ouvrir = await pg.$('text=Vendre un article sur eBay'); if (ouvrir) await ouvrir.click();
  await pg.waitForTimeout(500);
  const btn = await pg.$('[data-publier-un-clic="401"]');
  dit(!!btn, `${avecCategorie ? 'A' : 'B'} · chaque article a son bouton « Publier » (un clic)`);
  if (!btn) { await pg.close(); return; }
  await btn.click();
  const nom = avecCategorie ? 'A' : 'B';
  if (avecCategorie) {
    const feuille = pg.locator('div[style*="z-index"]').filter({ hasText: 'Publier cet article sur eBay ?' }).last();
    let vue = false; try { await feuille.waitFor({ timeout: 8000 }); vue = true; } catch (_) {}
    dit(vue, 'A · une confirmation s\'ouvre (après la vérification à blanc d\'eBay)');
    const txt = vue ? await feuille.innerText() : '';
    dit(/Département : Homme/.test(txt) && /Couleur : Bleu/.test(txt) && /Type : Baskets/.test(txt) && /Pointure EU : 44/.test(txt) && /Marque : Nike/.test(txt), 'A · la confirmation montre les critères remplis par Vinted (genre d\'après la catégorie Vinted)', txt.replace(/\s+/g, ' ').slice(0, 260));
    dit(/0,35/.test(txt), 'A · elle dit les frais annoncés par eBay');
    dit(envois.filter(x=>x.action==='pubverify').length === 1 && !envois.some(x=>x.action==='publish'), 'A · eBay a vérifié à blanc, rien n\'est publié avant « Oui »');
    if (vue) await feuille.getByRole('button', { name: 'Annuler' }).click();
    await pg.waitForTimeout(600);
    dit(!envois.some(x=>x.action==='publish'), 'A · « Annuler » : aucun publish');
    // Après « Annuler », l'article reste choisi, critères remplis : le bouton
    // principal publie (avec sa propre confirmation).
    try { await pg.getByRole('button', { name: /Publier sur eBay/ }).last().click({ timeout: 5000 }); } catch (_) {}
    try { await pg.getByRole('button', { name: 'Oui, publier' }).last().click({ timeout: 8000 }); } catch (_) {}
    await pg.waitForTimeout(1500);
    const pubs = envois.filter(x=>x.action==='publish');
    const it2 = pubs[0] && pubs[0].item || {};
    const a = it2.aspects || {};
    dit(pubs.length === 1, 'A · « Oui » : UN publish', 'publish=' + pubs.length);
    dit(a['Département'] === 'Homme' && a['Couleur'] === 'Bleu' && a['Type'] === 'Baskets' && a['Marque'] === 'Nike' && a['Pointure EU'] === '44', 'A · les critères partent remplis', JSON.stringify(a));
    dit(/portées deux fois/.test(String(it2.description || it2.desc || JSON.stringify(it2))), 'A · la description est celle de Vinted');
  } else {
    await pg.waitForTimeout(3500);
    const t = await pg.evaluate(()=>document.body.innerText);
    dit(!envois.some(x=>x.action==='pubverify' || x.action==='publish'), 'B · sans catégorie Vinted : rien n\'est vérifié ni publié');
    dit(/Département/.test(t) && /rien n'est publié/.test(t), 'B · le critère manquant est NOMMÉ (Département)', (t.match(/Il manque[^\n]{0,200}/) || [''])[0]);
  }
  dit(!errs.length, `${nom} · aucune erreur d'app`, errs.join(' | '));
  await pg.close();
}
(async()=>{
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server'] });
  await scenario(b, true);
  await scenario(b, false);
  await b.close(); srv.close();
  console.log(ko ? `\n${ko} contrôle(s) non conforme(s).` : '\nTout est conforme.');
  process.exit(ko ? 1 : 0);
})();
