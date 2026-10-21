// Banc réel de la réception, données synthétiques, aucun accès production.
const path = require('path'), http = require('http'), fs = require('fs');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4817;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '22222222-2222-2222-2222-222222222222', email: 'vendeuse@exemple.test' } };
const EMAILS = [
  { id: 'email_quarantaine_banc0001', sujet: 'Ton article est vendu ! (banc)', raison: 'adresse de réception inconnue', quand: '2026-10-05T09:00:00.000Z' },
  { id: 'email_quarantaine_banc0002', sujet: 'Bordereau de banc', raison: 'adresse de réception inconnue', quand: '2026-10-04T09:00:00.000Z' },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// `liste` : ce que rend la route — un tableau, ou 'panne' (503).
// `reponse(etat)` : la réponse ENTIÈRE de la route, calculée sur l'état du banc
//   (le registre que l'app vient d'écrire) — prioritaire sur `liste`.
// `registre` : les adresses que la lecture RLS de `vrm_email_owners` rend.
// `vues` : les lignes `email_inconnu_*` (`to`, `quand`) que la session lit.
async function ouvrir(nav, { liste, reponse, registre, vues = [], tab = 'settings', confidentialite = true, viewport = { width: 1512, height: 950 } }) {
  const ctx = await nav.newContext({ viewport });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  const lecturesRls = [];
  const etat = { registre: registre === undefined ? { 'vendeuse@exemple.test': { owner: SESSION.user.id, label: '' } } : registre, ecritures: [] };
  await pg.route('**/rest/v1/**', (r) => {
    const u = decodeURIComponent(r.request().url());
    if (/email_quarantaine/.test(u)) lecturesRls.push(u.replace(/^.*\/rest\/v1\//, ''));
    // Le registre du vendeur : ce qu'il a déclaré (à état : une écriture le change).
    if (/id=eq\.vrm_email_owners/.test(u) && r.request().method() === 'GET') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Object.keys(etat.registre).length ? [{ data: { adresses: etat.registre } }] : []) });
    }
    if (r.request().method() === 'POST' && /\/rest\/v1\/app_data/.test(u)) {
      let rows = []; try { rows = JSON.parse(r.request().postData() || '[]'); } catch (_) {}
      for (const x of (Array.isArray(rows) ? rows : [rows])) {
        etat.ecritures.push(x);
        if (x && x.id === 'vrm_email_owners' && x.data && x.data.adresses) etat.registre = x.data.adresses;
      }
      return r.fulfill({ status: 201, contentType: 'application/json', body: '' });
    }
    // SES emails déjà rangés : la projection `to`/`quand` (jamais l'email).
    if (/id=like\.email_inconnu_\*/.test(u) && r.request().method() === 'GET') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(vues) });
    }
    // Tout le reste — y compris la quarantaine lue sous RLS : `[]`, car les
    // lignes du propriétaire neutre sont invisibles à un vendeur.
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  const appels = [];
  let suiviPanne=false;
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if(u.includes('mode=confidentialite'))return r.fulfill({status:confidentialite===true?200:503,contentType:'application/json',body:JSON.stringify(confidentialite===true?{ok:true,uid:SESSION.user.id}:{ok:false,raison:confidentialite===false?'separation-non-confirmee':'verification-indisponible'})});
    if (u.includes('mode=reception')) return r.fulfill({status:suiviPanne?503:200,contentType:'application/json',body:JSON.stringify(suiviPanne?{ok:false}:SUIVI)});
    if (/\/api\/email-rattacher/.test(u)) {
      const m = r.request().method();
      let corps = null; try { corps = JSON.parse(r.request().postData() || 'null'); } catch (_) {}
      appels.push({ m, liste: /mode=liste/.test(u), auth: r.request().headers().authorization || '', corps });
      if (m === 'GET') {
        if (reponse) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reponse(etat)) });
        return liste === 'panne' ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"base-injoignable"}' })
          : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emails: liste }) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, resultat: { ok: true, type: 'vente' } }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  // Au téléphone (16 octobre), « Adresses de réception » est un SOUS-ÉCRAN de
  // Réglages (chevron) : on l'ouvre, comme lui. Sur ordinateur tout est déplié.
  const sousAdr = pg.locator('[data-sous-ouvrir="adresses"]').first();
  if (await sousAdr.isVisible().catch(() => false)) { await sousAdr.click(); await pg.waitForTimeout(600); }
  return { ctx, pg, erreurs, appels, lecturesRls, etat, panne:()=>suiviPanne=true, retablir:()=>suiviPanne=false };
}

const SUIVI={ok:true,limite:100,plus:false,collecteur:{dernierSucces:new Date().toISOString(),dernierPassage:new Date().toISOString(),etat:'succes'},dernierEmail:new Date().toISOString(),emails:[{id:'suivi-1',subject:'Reçu d’achat de banc',from:'Vinted <noreply@exemple.test>',type:'achat',etat:'integre',at:new Date().toISOString()},{id:'suivi-2',subject:'Bordereau à vérifier',type:'bordereau',etat:'a-verifier',at:new Date().toISOString(),raison:'Contenu non reconnu'},{id:'suivi-3',subject:'Email à reprendre',type:'vente',etat:'erreur',at:new Date().toISOString()}]};
SUIVI.adresses=[{adresse:'un@example.test',declaree:true,comptes:[{id:'1',nom:'vendeur-un'}]},{adresse:'deux@example.test',declaree:true,comptes:[{id:'2',nom:'vendeur-deux'}]}];
SUIVI.emails.forEach((e,i)=>{e.adresses=[i?'deux@example.test':'un@example.test'];e.compte={id:i?'2':'1',nom:i?'vendeur-deux':'vendeur-un',bloque:!!i};});
(async()=>{
 await new Promise(r=>srv.listen(PORT,r));const nav=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const viewport of [{width:320,height:720},{width:390,height:844},{width:1512,height:950}]){
  await essaie('réception '+viewport.width,async()=>{
   const {ctx,pg,erreurs,panne,retablir,etat}=await ouvrir(nav,{liste:EMAILS,viewport,registre:{'vendeuse@exemple.test':{owner:SESSION.user.id},'un@example.test':{owner:SESSION.user.id},'deux@example.test':{owner:SESSION.user.id}}});
   const panel=pg.locator('[data-reception-emails]');await panel.waitFor();
   dit(await panel.locator('.vrm-reception-liste > li').count()===3,'les trois états sont rendus '+viewport.width);
   dit((await panel.innerText()).includes('Collecteur actif'),'passage récent confirmé');
   const lignes=panel.locator('.vrm-reception-liste > li');dit(await lignes.first().locator('.vrm-reception-compte-nom').innerText()==='vendeur-un','nom du compte affiché à côté du mail');dit(await lignes.first().locator('.vrm-reception-bloque').count()===0,'aucun badge de blocage sur un compte actif');dit(await lignes.nth(1).locator('.vrm-reception-bloque').innerText()==='Bloqué','badge uniquement pour le compte banni');
   await panel.getByLabel('Compte / adresse').selectOption('un@example.test');dit(await lignes.count()===1,'filtrage indépendant du premier compte');await panel.getByLabel('Compte / adresse').selectOption('toutes');

   await panel.getByRole('button',{name:'1 À vérifier',exact:true}).click();dit(await panel.locator('.vrm-reception-liste > li').count()===1,'le filtre ne garde que les vérifications');
   await panel.getByRole('button',{name:'Tous les états'}).click();
   await panel.getByRole('searchbox').fill('Reçu');dit(await panel.locator('.vrm-reception-liste > li').count()===1,'recherche par objet');
   await panel.getByRole('searchbox').fill('');await panel.locator('.vrm-reception-liste > li').first().locator('summary').click();dit((await panel.innerText()).includes('Suppression automatique non autorisée'),'conservation expliquée');await panel.locator('.vrm-reception-liste > li').first().locator('summary').click();
   await panel.getByRole('button',{name:'Vérifier les emails mis de côté'}).click();dit(await pg.locator('[data-emails-mis-de-cote]').isVisible(),'rattachement existant accessible');
   panne();await panel.getByRole('button',{name:'Actualiser',exact:true}).click();await panel.getByRole('alert').waitFor();dit((await panel.innerText()).includes('dernière lecture'),'une panne conserve les données et indique leur ancienneté');
   retablir();await panel.getByRole('button',{name:'Réessayer',exact:true}).click();await pg.waitForTimeout(150);dit(await panel.getByRole('alert').count()===0,'reprise après une panne');
   const guide=panel.locator('.vrm-reception-parcours');await guide.locator('summary').click();await guide.getByLabel('Adresse à configurer').selectOption('un@example.test');dit((await guide.innerText()).includes('vendeur-un'),'le guide accompagne la bonne adresse et son compte');dit(!(await guide.innerText()).includes('Un email a été traité sur cette adresse'),'aucune réception inventée avant observation');await guide.getByLabel('Ma messagerie').selectOption('outlook');dit(await guide.getByRole('link',{name:'Ouvrir Outlook'}).count()===1,'instructions adaptées à la messagerie');await guide.locator('summary').click();
   await pg.locator('[data-reglage-adresses]').getByRole('button',{name:'+ Ajouter une adresse',exact:true}).click();await pg.locator('form input').last().fill('nouveau-un@example.test, nouveau-deux@example.test');await pg.locator('form').last().getByRole('button',{name:'Ajouter',exact:true}).click();await pg.waitForTimeout(200);dit(!!etat.registre['nouveau-un@example.test']&&!!etat.registre['nouveau-deux@example.test']&&!!etat.registre['vendeuse@exemple.test'],'ajout groupé de deux adresses sans effacer la première');
   const debord=await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);dit(!debord,'aucun débordement horizontal');dit(erreurs.length===0,'aucune erreur JavaScript',erreurs.join(' '));
   await panel.scrollIntoViewIfNeeded();const dir=process.env.CAPTURE_DIR||'/tmp/vrm-reception-captures';fs.mkdirSync(dir,{recursive:true});await pg.screenshot({path:path.join(dir,'reception-'+viewport.width+'.png'),fullPage:true});await ctx.close();
  });
 }}finally{await nav.close();srv.close();}console.log({ok,ko});process.exit(ko?1:0);
})();
