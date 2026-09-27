// BANC de rendu du formulaire « Vendre sur eBay » (EbayPublier), EXÉCUTÉ dans un
// vrai navigateur avec un eBay CONNECTÉ simulé (§4.10). On publie EN CHOISISSANT
// une paire (ses photos captées partent toutes seules — plus AUCUN lien à coller,
// demande de Julien), on choisit le MODE DE LIVRAISON, et eBay vérifie avant de
// publier. La logique d'envoi est couverte par ebay-write.cjs / ebay-api.cjs ;
// ici c'est le RENDU + le flux « comme dans l'app ».
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json' };
const srv = http.createServer((q,r)=>{ let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html'; const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p)); });
srv.listen(4331);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGNk+M+ADzCOKgAAV7wDA8mm/lgAAAAASUVORK5CYII=','base64');
// La paire à vendre : sa fiche numéro (localStorage) + ses photos captées (base).
const NUMS = { '111': { numero:'401', title:'Nike Air Max 1 Aquatone Bleu Taille 44', photo:'https://img.example/cover.jpg', numberedAt: Date.now() } };
const DETAILS = { '111': { description:'Basket Nike', photos:['https://img.example/1.jpg','https://img.example/2.jpg','https://img.example/3.jpg'] } };
let ko = 0; const dit = (c,m,d)=>{ if(!c)ko++; console.log((c?'✅ ':'❌ ')+m+(d?' — '+d:'')); };
(async()=>{
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--use-angle=swiftshader','--no-sandbox'] });
  const pg = await b.newPage({ viewport:{ width:390, height:1500 } });
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(([nums]) => { try{ localStorage.setItem('vrm_acces_direct','1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(nums)); localStorage.setItem('vinted_nums_physiques', JSON.stringify(['401'])); }catch(_){}}, [NUMS]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r)=>{ const t=r.request().resourceType(); if(t==='image') return r.fulfill({status:200,contentType:'image/png',body:PNG}); if(t==='media'||t==='font') return r.abort(); return r.continue(); });
  await pg.route('**/rest/v1/**', route=>{ const u=route.request().url(); const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    if(/id=eq\.vinted_item_details/.test(u)) return j([{ data: DETAILS }]);
    return j([]); });
  await pg.route('**/api/**', r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  // IA de rédaction (api/ai) : disponible, et renvoie un titre optimisé.
  await pg.route('**/api/ai**', route=>{ const req=route.request(); const j=d=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(d)});
    if(req.method()!=='POST') return j({ ok:true, ready:true });
    return j({ ok:true, title:'Nike Air Max 1 Aquatone bleu T44 — très bon état', desc:'Sneakers Nike Air Max 1, coloris Aquatone.', why:'Titre optimisé pour la recherche eBay.' }); });
  // ⚠️ enregistré APRÈS le catch-all → Playwright le prend en PREMIER (§6.6).
  await pg.route('**/api/ebay**', route=>{ const req=route.request(); const j=d=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(d)});
    if(req.method()!=='POST') return j({ ready:true, canConsent:true });
    let body={}; try{ body=JSON.parse(req.postData()||'{}'); }catch(_){}
    if(body.action==='status') return j({ ok:true, connected:true });
    if(body.action==='pubinfo') return j({ ok:true, categorie:{ suggeree:{ categoryId:'15709', categoryName:'Baskets' } },
      // eBay renvoie chaque caractéristique AVEC ses valeurs (la « même interface »).
      attributs:[
        { nom:'Marque', requis:true, mode:'SELECTION_ONLY', valeurs:['Nike','Adidas','New Balance','Salomon'] },
        { nom:'Pointure EU', requis:true, mode:'SELECTION_ONLY', valeurs:['42','43','44','45'] },
        { nom:'Couleur', requis:true, mode:'FREE_TEXT', valeurs:[] },
        { nom:'Département', requis:true, mode:'SELECTION_ONLY', valeurs:['Homme','Femme','Enfant'] },
        { nom:'Style', requis:false, mode:'SELECTION_ONLY', valeurs:['Basket','Running','Ville'] },
        { nom:'Matière extérieure', requis:false, mode:'SELECTION_ONLY', valeurs:['Cuir','Textile','Synthétique'] },
      ],
      attributsObligatoires:['Marque','Pointure EU','Couleur','Département'] });
    if(body.action==='finances') return j({ ok:false, reason:'scope', error:'x' });
    return j({ ok:true }); });
  await pg.goto('http://localhost:4331/?tab=plat_ebay',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(2500);
  const T = async () => (await pg.evaluate(()=>document.body.innerText));

  const openBtn = await pg.$('text=Vendre une paire sur eBay');
  dit(!!openBtn, 'le bouton d\'ouverture dit « Vendre une paire sur eBay »');
  if (openBtn) await openBtn.click();
  await pg.waitForTimeout(400);
  let txt = await T();
  dit(/La paire à vendre/i.test(txt), 'le formulaire s\'ouvre sur « La paire à vendre » (on choisit, on ne colle pas)');

  // ⚠️ Plus AUCUN champ « colle le lien » : c'était la demande de Julien.
  const linkInput = await pg.$('input[placeholder*="Colle le lien"]');
  dit(!linkInput, 'aucun champ « colle un lien de photo » (photos automatiques)');

  // Choisir la paire N°401 → titre + photos auto
  const pairBtn = await pg.$('text=N°401');
  dit(!!pairBtn, 'la paire numérotée apparaît dans le sélecteur (N°401)');
  if (pairBtn) await pairBtn.click();
  await pg.waitForTimeout(400);
  const titleVal = await pg.$eval('input[placeholder^="Nike Air Max"]', el=>el.value).catch(()=>'');
  dit(/nike/i.test(titleVal), 'choisir la paire remplit le titre tout seul', 'titre=' + titleVal.slice(0,30));
  const nImgs = await pg.evaluate(()=>document.querySelectorAll('img[src^="https://img.example/"]').length);
  dit(nImgs >= 3, 'les photos de la paire arrivent toutes seules (≥3 vignettes)', 'images=' + nImgs);
  dit(/couverture/.test(await T()), 'la 1ʳᵉ photo est marquée « couverture »');

  // IA : optimiser le titre (à partir des vraies infos de la paire)
  const aiBtn = await pg.$('text=Optimiser le titre avec l\'IA');
  dit(!!aiBtn, 'le bouton « Optimiser le titre avec l\'IA » est proposé (IA branchée)');
  if (aiBtn) { await aiBtn.click(); await pg.waitForTimeout(500);
    const t2 = await pg.$eval('input[placeholder^="Nike Air Max"]', el=>el.value).catch(()=>'');
    dit(/très bon état/i.test(t2), 'l\'IA remplit le titre optimisé', 'titre=' + t2.slice(0,40)); }

  // Analyser la catégorie → sections + pointure pré-remplie depuis la paire
  await (await pg.$('text=Trouver la catégorie eBay')).click();
  await pg.waitForTimeout(900);
  txt = await T();
  dit(/Baskets/.test(txt), 'la catégorie eBay suggérée s\'affiche (Baskets)');
  dit(/Prix & livraison/.test(txt), 'section « Prix & livraison » présente');
  // Même interface qu'eBay : les caractéristiques à valeurs sont des LISTES
  // déroulantes portant les valeurs d'eBay, et la pointure de la paire s'y
  // sélectionne (valeur autorisée par eBay).
  const champ = await pg.evaluate(()=>{ const labs=[...document.querySelectorAll('label')]; const l=labs.find(x=>/pointure/i.test(x.textContent)); if(!l)return {}; const box=l.parentElement; const sel=box&&box.querySelector('select'); return { tag: sel?'select':(box&&box.querySelector('input')?'input':''), val: sel?sel.value:'', opts: sel?[...sel.options].map(o=>o.value).join(','):'' }; });
  dit(champ.tag === 'select', 'la caractéristique eBay est une LISTE (comme sur eBay), pas un champ libre', 'tag=' + champ.tag);
  dit(/(^|,)44(,|$)/.test(champ.opts), 'la liste porte les valeurs d\'eBay (…,44,…)', champ.opts);
  dit(champ.val === '44', 'la pointure de la paire est sélectionnée dans la liste eBay (44)', 'val=' + champ.val);
  const plusBtn = await pg.$('text=/Plus de caractéristiques/');
  dit(!!plusBtn, 'les caractéristiques FACULTATIVES sont sous un dépliant (comme eBay)');
  // Plus intelligent : la MARQUE se remplit toute seule depuis le titre, en
  // visant une valeur AUTORISÉE par eBay (Nike), jamais devinée.
  const marque = await pg.evaluate(()=>{ const labs=[...document.querySelectorAll('label')]; const l=labs.find(x=>/marque/i.test(x.textContent)); if(!l)return ''; const s=l.parentElement&&l.parentElement.querySelector('select'); return s?s.value:''; });
  dit(marque === 'Nike', 'la marque se pré-remplit depuis le titre (valeur eBay « Nike »)', 'marque=' + marque);
  // Département (Homme/Femme/Enfant) n'apparaît pas dans le titre → laissé VIDE.
  const dep = await pg.evaluate(()=>{ const labs=[...document.querySelectorAll('label')]; const l=labs.find(x=>/département/i.test(x.textContent)); if(!l)return 'x'; const s=l.parentElement&&l.parentElement.querySelector('select'); return s?s.value:'x'; });
  dit(dep === '', 'ce qui ne se prouve pas reste VIDE (Département, mieux vaut un blanc qu\'un faux)', 'dep=' + dep);
  dit(/requis/i.test(await T()), 'un compteur dit combien de champs obligatoires restent');

  // Mode de livraison : un vrai sélecteur (comme sur eBay)
  const shipOpts = await pg.evaluate(()=>{ const sels=[...document.querySelectorAll('select')]; for(const s of sels){ const t=[...s.options].map(o=>o.textContent).join('|'); if(/Mondial Relay|Colissimo/i.test(t)) return t; } return ''; });
  dit(/Colissimo/i.test(shipOpts) && /Mondial Relay/i.test(shipOpts), 'on CHOISIT le mode de livraison (Colissimo, Mondial Relay…)', shipOpts.slice(0,60));

  await pg.fill('input[placeholder="ex. 74"]', '74');
  await pg.waitForTimeout(250);
  txt = await T();
  dit(/74,00 €/.test(txt), 'l\'aperçu montre le prix formaté (74,00 €)');
  dit(/Vérifier sans publier/.test(txt) && /Publier sur eBay/.test(txt), 'les deux gestes sont là (vérifier à blanc + publier)');
  dit(errs.length === 0, 'aucune erreur d\'app', errs.slice(0,1).join(''));

  console.log(ko ? ('\n'+ko+' contrôle(s) non conforme(s).') : '\nOn publie en CHOISISSANT une paire (photos auto, aucun lien) et en CHOISISSANT la livraison — comme sur eBay, dans l\'app.');
  await b.close(); srv.close();
  process.exit(ko ? 1 : 0);
})();
