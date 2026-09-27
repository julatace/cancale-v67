// BANC de rendu du formulaire « Vendre sur eBay » (EbayPublier), EXÉCUTÉ dans un
// vrai navigateur avec un eBay CONNECTÉ simulé (§4.10 : ni `npm run build` ni
// `node --check` ne rendent ce composant). Il vérifie que le formulaire présente
// bien l'annonce comme la feuille de vente eBay : vignettes photo + couverture,
// aperçu vivant (titre/prix), sections numérotées, catégorie + attributs dictés
// par eBay, et les deux gestes (vérifier / publier). Aucune logique d'envoi
// n'est touchée (couverte par ebay-write.cjs / ebay-api.cjs) — ici c'est le RENDU.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json' };
const srv = http.createServer((q,r)=>{ let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html'; const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p)); });
srv.listen(4331);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGNk+M+ADzCOKgAAV7wDA8mm/lgAAAAASUVORK5CYII=','base64');
let ko = 0; const dit = (c,m,d)=>{ if(!c)ko++; console.log((c?'✅ ':'❌ ')+m+(d?' — '+d:'')); };
(async()=>{
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--use-angle=swiftshader','--no-sandbox'] });
  const pg = await b.newPage({ viewport:{ width:390, height:1400 } });
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{ try{ localStorage.setItem('vrm_acces_direct','1'); }catch(_){}} );
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r)=>{ const t=r.request().resourceType(); if(t==='image') return r.fulfill({status:200,contentType:'image/png',body:PNG}); if(t==='media'||t==='font') return r.abort(); return r.continue(); });
  await pg.route('**/rest/v1/**', route=>{ const u=route.request().url(); const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    return j([]); });
  await pg.route('**/api/**', r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  // ⚠️ enregistré APRÈS le catch-all → Playwright le prend en PREMIER (§6.6).
  await pg.route('**/api/ebay**', route=>{ const req=route.request(); const j=d=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(d)});
    if(req.method()!=='POST') return j({ ready:true, canConsent:true });
    let body={}; try{ body=JSON.parse(req.postData()||'{}'); }catch(_){}
    if(body.action==='status') return j({ ok:true, connected:true });
    if(body.action==='pubinfo') return j({ ok:true, categorie:{ suggeree:{ categoryId:'15709', categoryName:'Baskets' } }, attributsObligatoires:['Marque','Pointure EU','Couleur','Département','Style','Type'] });
    if(body.action==='finances') return j({ ok:false, reason:'scope', error:'x' });
    return j({ ok:true }); });
  await pg.goto('http://localhost:4331/?tab=plat_ebay',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(2500);
  const T = async () => (await pg.evaluate(()=>document.body.innerText));

  const openBtn = await pg.$('text=Vendre une paire sur eBay');
  dit(!!openBtn, 'le bouton d\'ouverture dit « Vendre une paire sur eBay »');
  if (openBtn) await openBtn.click();
  await pg.waitForTimeout(400);
  const titleInput = await pg.$('input[placeholder^="Nike Air Max"]');
  dit(!!titleInput, 'le formulaire s\'ouvre (champ Titre présent)');
  if (!titleInput) { console.log('\n'+ko+' KO'); await b.close(); srv.close(); process.exit(1); }

  await pg.fill('input[placeholder^="Nike Air Max"]', 'Nike Air Max 1 Aquatone Bleu Taille 44');
  await pg.fill('input[placeholder^="Colle le lien"]', 'https://img.example/1.jpg https://img.example/2.jpg https://img.example/3.jpg');
  await (await pg.$('text=Ajouter')).click();
  await pg.waitForTimeout(300);

  // Vignettes + couverture (comme la grille photo d'eBay)
  // 3 vignettes + 1 aperçu (la couverture est reprise dans la carte d'aperçu).
  const nImgs = await pg.evaluate(()=>document.querySelectorAll('img[src^="https://img.example"]').length);
  dit(nImgs >= 3, 'les 3 photos deviennent des vignettes (+ l\'aperçu)', 'images=' + nImgs);
  dit(/couverture/.test(await T()), 'la 1ʳᵉ photo est marquée « couverture »');

  // Trouver la catégorie → chip + sections attributs/prix/description
  await (await pg.$('text=Trouver la catégorie eBay')).click();
  await pg.waitForTimeout(900);
  let txt = await T();
  dit(/Cat[ée]gorie eBay/.test(txt) && /Baskets/.test(txt), 'la catégorie eBay suggérée s\'affiche (Baskets)');
  dit(/Caract[ée]ristiques/.test(txt), 'section « Caractéristiques » présente');
  dit(/Prix & livraison/.test(txt), 'section « Prix & livraison » présente');
  dit(/Pointure EU/i.test(txt) && /Marque/i.test(txt), 'les attributs dictés par eBay sont rendus');

  // Aperçu vivant : titre + prix
  await pg.fill('input[placeholder="ex. 74"]', '74');
  await pg.waitForTimeout(250);
  txt = await T();
  dit(/74,00 €/.test(txt), 'l\'aperçu de l\'annonce montre le prix formaté (74,00 €)');
  dit(/Vérifier sans publier/.test(txt) && /Publier sur eBay/.test(txt), 'les deux gestes sont là (vérifier à blanc + publier)');
  dit(errs.length === 0, 'aucune erreur d\'app', errs.slice(0,1).join(''));

  console.log(ko ? ('\n'+ko+' contrôle(s) non conforme(s).') : '\nLe formulaire eBay se présente comme une vraie feuille de vente : vignettes, aperçu, sections, catégorie + attributs, vérifier puis publier.');
  await b.close(); srv.close();
  process.exit(ko ? 1 : 0);
})();
