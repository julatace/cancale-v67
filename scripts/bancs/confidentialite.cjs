require('./_porte-banc.cjs');
// Banc réel de la réception, données synthétiques, aucun accès production.
const path = require('path'), http = require('http'), fs = require('fs');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4829;
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
  const lecturesRls = [],lecturesPrivees=[];
  const etat = { registre: registre === undefined ? { 'vendeuse@exemple.test': { owner: SESSION.user.id, label: '' } } : registre, ecritures: [] };
  await pg.route('**/rest/v1/**', (r) => {
    const u = decodeURIComponent(r.request().url());
    if(!/select=owner&limit=1|select=id&limit=1/.test(u))lecturesPrivees.push(u.replace(/^.*rest\/v1\//,''));
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
    if(u.includes('mode=confidentialite')){const verdict=typeof confidentialite==='object'?confidentialite.valeur:confidentialite;return r.fulfill({status:verdict===true?200:503,contentType:'application/json',body:JSON.stringify(verdict===true?{ok:true,uid:SESSION.user.id}:{ok:false,raison:verdict===false?'separation-non-confirmee':'verification-indisponible'})});}
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
  return { ctx, pg, erreurs, appels, lecturesRls, lecturesPrivees, etat, panne:()=>suiviPanne=true, retablir:()=>suiviPanne=false };
}


const SUIVI={ok:true,emails:[],adresses:[],collecteur:{}};
(async()=>{await new Promise(r=>srv.listen(PORT,r));const nav=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{for(const viewport of [{width:390,height:844},{width:1512,height:950}]){for(const etat of [false,'panne',true])await essaie('protection '+etat+' '+viewport.width,async()=>{
const {ctx,pg,lecturesPrivees,erreurs}=await ouvrir(nav,{liste:[],viewport,confidentialite:etat});
if(etat===true){dit(await pg.locator('[data-confidentialite]').count()===0,'contrôle validé : l’espace peut s’ouvrir');dit(await pg.locator('[data-reception-emails]').isVisible(),'écran utilisateur disponible après contrôle');}else{const garde=pg.locator('[data-confidentialite]');dit(await garde.getAttribute('data-confidentialite')===(etat===false?'protection':'indisponible'),'refus et panne distingués');dit(lecturesPrivees.length===0,'aucune lecture de boutique avant la validation',lecturesPrivees.join(' '));dit(await pg.locator('[data-reception-emails]').count()===0,'le cœur de l’application n’est pas monté');}
dit(erreurs.length===0,'aucune erreur JavaScript',erreurs.join(' '));await ctx.close();});
await essaie('revalidation au retour '+viewport.width,async()=>{
 const verdict={valeur:true};const {ctx,pg}=await ouvrir(nav,{liste:[],viewport,confidentialite:verdict});
 dit(await pg.locator('[data-reception-emails]').isVisible(),'espace initialement ouvert');
 verdict.valeur=false;
 await pg.evaluate(()=>{const ancien=Date.now;Date.now=()=>ancien()+61000;window.dispatchEvent(new Event('focus'));});
 await pg.locator('[data-confidentialite="protection"]').waitFor({timeout:5000});
 dit(await pg.locator('[data-reception-emails]').count()===0,'un refus ultérieur démonte l’espace privé');await ctx.close();
});}}finally{await nav.close();srv.close();}console.log({ok,ko});process.exit(ko?1:0);})();
