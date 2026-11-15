// ════════════════════════════════════════════════════════════════════════════
//  BANC « LEBONCOIN NE S'AFFICHE PAS SUR ORION » (5.379.0, 15 nov.)
//
//  Julien (iPhone, Orion, extension VRM installée) : « Leboncoin marche pas » —
//  leboncoin.fr reste une page NOIRE, seuls un bandeau du site et le logo VRM
//  s'affichent. Orion = WebKit ; WebKit n'est pas dans ce conteneur : Chromium sert
//  les DEUX mondes que les navigateurs donnent aux scripts de l'extension —
//    · « chrome » : lbc-inject.js dans le monde de la PAGE (world: MAIN) dès le début,
//      le relais dans un monde ISOLÉ ;
//    · « orion »  : le paquet Orion retire `world` — lbc-inject.js tourne d'abord dans le
//      monde ISOLÉ (avec orion-main.js et le relais) et se pose dans la page par une balise.
//  La page est INVENTÉE, de la même mécanique que leboncoin.fr (Next.js) : React hydrate
//  un écran vide, puis va chercher ses données (fetch POST JSON, `Request`, flux lu au fil
//  de l'eau, appel non lié, abandon, image, XHR json / document / POST) et les dessine.
//  Servie sous https://www.leboncoin.fr par des routes (rien ne sort de la machine).
//
//  Exige :
//   A. la page se dessine, chaque étape de sa mécanique répond comme sans VRM, aucune
//      erreur de page — avec VRM « chrome » et « orion », avec et sans règle de sécurité
//      (CSP), hydratation d'un bloc ou du document entier ;
//   B. `fetch` / XHR gardent le texte de l'original (un script qui vérifie qu'ils sont ceux
//      du navigateur n'y voit pas VRM) ;
//   C. aucune COPIE de réponse lue qui ne peut pas servir (image, flux de la page, HTML) ;
//   D. rien de VRM dans un cadre leboncoin.fr posé par un AUTRE site ; tout dans un cadre
//      leboncoin.fr posé par leboncoin.fr ;
//   E. le repli Orion (monde isolé) : jamais le capteur dans le monde isolé, l'ordre du fond
//      arrive au capteur de la PAGE (celui qui a vu le compte), et une balise refusée par
//      la page ne reste pas plantée dans le document ;
//   F. le DISJONCTEUR : page qui reste vide ⇒ VRM se met de côté, UN rechargement, rien de
//      VRM dans la page ensuite, verdict « vide-sans-vrm » ; page cassée par VRM ⇒ verdict
//      « affichee-sans-vrm » ; page normale ⇒ rien ; la carte le DIT et « Rebrancher VRM
//      ici » efface la marque.
//  Données INVENTÉES (dépôt public). Captures : BANC_CAPTURES (ou bancs/captures).
//  ⚠️ Ce banc ne prouve RIEN sur WebKit lui-même : ce qui reste à voir sur l'iPhone est
//     dans docs/passation/2026-11-15-lbc-orion.md.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const racine = path.resolve(__dirname, '..', '..');
const EXT = path.join(racine, 'vinted-sync-extension');
const lire = (f) => fs.readFileSync(path.join(EXT, f), 'utf8');
const NM = path.dirname(require.resolve('react/package.json', { paths: [racine] }));
const REACT = fs.readFileSync(path.join(NM, 'umd/react.production.min.js'), 'utf8');
const REACT_DOM = fs.readFileSync(path.join(path.dirname(require.resolve('react-dom/package.json', { paths: [racine] })), 'umd/react-dom.production.min.js'), 'utf8');
const ORION_MAIN = fs.readFileSync(path.join(racine, 'scripts/extension-orion/orion-main.js'), 'utf8');
const LOGO = fs.readFileSync(path.join(EXT, 'logo-vrm-96.png'));
const SORTIE = process.env.BANC_CAPTURES || path.join(__dirname, 'captures');
fs.mkdirSync(SORTIE, { recursive: true });

let ok = 0, ko = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };

// ── LA PAGE INVENTÉE (mécanique de leboncoin.fr) ─────────────────────────────
const APP = `
(function(){
 const e=React.createElement;
 window.__etapes={};const note=(k,v)=>{window.__etapes[k]=v;};
 // le cas « VRM casse la page » : lu au moment de charger (le capteur Orion arrive par une balise, plus tard)
 const casseeParVrm=()=>location.pathname==='/casse-avec-vrm'&&!!window.__vrmLbcInjected;
 const jamais=location.pathname==='/vide';                                               // le cas « elle reste vide, VRM ou pas »
 function App(){
  const [ads,setAds]=React.useState(null);
  React.useEffect(()=>{ setTimeout(()=>{ if(jamais||casseeParVrm())return; (async()=>{
   try{
    const r1=await fetch('https://api.leboncoin.fr/finder/search',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',api_key:'cle-site'},body:JSON.stringify({limit:35,filters:{category:{id:'3'}}})});
    note('instance',r1 instanceof Response);
    const j1=await r1.json();note('json',j1.ads.length);
    const r2=await fetch(new Request('https://api.leboncoin.fr/api/dashboard/v1/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filters:{owner:{user_id:'aaaaaaaa-0000-4000-8000-000000000001'}},limit:35,offset:0})}));
    note('request',(await r2.json()).total);
    const r3=await fetch('/_rsc?flux=1');const lec=r3.body.getReader();let n=0;for(;;){const {done,value}=await lec.read();if(done)break;n+=value.length;}note('flux',n);
    const f=window.fetch;const r4=await f('https://api.leboncoin.fr/api/account/v2/members/me/account');note('nonlie',r4.status);
    const r5=await fetch.call(undefined,'https://api.leboncoin.fr/api/adfinder/v2/myads');note('call',(await r5.text()).length>0);
    const ac=new AbortController();const p6=fetch('https://api.leboncoin.fr/lent',{signal:ac.signal});ac.abort();try{await p6;note('abort','non');}catch(x){note('abort',x.name);}
    const r7=await fetch('/image.png');note('blob',(await r7.blob()).size);
    await new Promise((ok,ko)=>{const x=new XMLHttpRequest();x.open('GET','https://api.leboncoin.fr/api/xhr-json');x.responseType='json';x.onload=()=>{note('xhrjson',!!(x.response&&x.response.ok));ok();};x.onerror=ko;x.send();});
    await new Promise((ok,ko)=>{const x=new XMLHttpRequest();x.open('GET','/doc.html');x.responseType='document';x.onload=()=>{note('xhrdoc',!!x.response);ok();};x.onerror=ko;x.send();});
    await new Promise((ok,ko)=>{const x=new XMLHttpRequest();x.open('POST','https://api.leboncoin.fr/api/xhr-post');x.setRequestHeader('Content-Type','application/json');x.onreadystatechange=()=>{if(x.readyState===4){note('xhrpost',x.status);ok();}};x.send('{"a":1}');});
    note('natif',/\\[native code\\]/.test(String(window.fetch))&&/\\[native code\\]/.test(String(XMLHttpRequest.prototype.send))&&/\\[native code\\]/.test(String(XMLHttpRequest.prototype.open)));
    note('nom',window.fetch.name+'/'+window.fetch.length);
    setAds(j1.ads);
   }catch(err){note('ERREUR',String(err&&err.message||err));setAds([]);}
  })();},300);},[]);
  return e('div',{id:'__next'},e('main',{id:'contenu'},ads?[e('header',{key:'h'},'leboncoin — '+'Toutes les catégories · Immobilier · Véhicules · Mode · Maison & Jardin · Famille · Électronique · Loisirs · Autres'.repeat(2))].concat(ads.map(a=>e('article',{key:a.list_id,className:'annonce'},a.subject+' — '+a.price[0]+' € — chaussures d’occasion en bon état, envoi possible, remise en main propre à Paris'))):null),e('div',{className:'bandeau'},'📦 Livraison à partir de 0,49 €. Les frais de livraison baissent dans 18 catégories, profitez en !'));
 }
 if(window.__MODE_DOC){ReactDOM.hydrateRoot(document,e('html',{lang:'fr'},e('head',null,e('meta',{charSet:'utf-8'}),e('title',null,'leboncoin')),e('body',null,e(App))));}
 else ReactDOM.hydrateRoot(document.getElementById('racine'),e(App));
})();`;
const STYLE = '<style>html,body{margin:0;background:#1b1c1e;color:#e8e8e8;font:15px -apple-system,sans-serif}.bandeau{position:fixed;left:0;right:0;bottom:70px;padding:12px 16px}article{padding:10px 16px;border-bottom:1px solid #333}header{padding:12px 16px}</style>';
const pageHtml = (modeDoc) => modeDoc
  ? `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><title>leboncoin</title></head><body><div id="__next"><main id="contenu"></main><div class="bandeau">📦 Livraison à partir de 0,49 €. Les frais de livraison baissent dans 18 catégories, profitez en !</div></div><script>window.__MODE_DOC=1</script><script src="/_next/react.js"></script><script src="/_next/react-dom.js"></script><script src="/_next/app.js"></script></body></html>`
  : `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>leboncoin</title>${STYLE}</head><body><div id="racine"><div id="__next"><main id="contenu"></main><div class="bandeau">📦 Livraison à partir de 0,49 €. Les frais de livraison baissent dans 18 catégories, profitez en !</div></div></div><script src="/_next/react.js"></script><script src="/_next/react-dom.js"></script><script src="/_next/app.js"></script></body></html>`;

async function preparer(browser, { csp = false, modeDoc = false, mobile = false } = {}) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: 'dark' } : { viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e.message).slice(0, 200)));
  const clones = [];
  await page.exposeBinding('bancClone', (_s, ct, url) => { clones.push({ ct: String(ct || ''), url: String(url || '') }); });
  // L'espion des copies, posé AVANT tout (monde de la page) : chaque `clone()` d'une réponse.
  await page.addInitScript(() => { try { const o = Response.prototype.clone; Response.prototype.clone = function () { try { window.bancClone(this.headers.get('content-type'), this.url); } catch (_) {} return o.apply(this, arguments); }; } catch (_) {} });
  await page.route('https://www.leboncoin.fr/**', (r) => {
    const u = new URL(r.request().url());
    const entetes = csp ? { 'content-security-policy': "script-src 'self' 'unsafe-inline'" } : {};
    if (u.pathname === '/_next/react.js') return r.fulfill({ contentType: 'application/javascript', body: REACT });
    if (u.pathname === '/_next/react-dom.js') return r.fulfill({ contentType: 'application/javascript', body: REACT_DOM });
    if (u.pathname === '/_next/app.js') return r.fulfill({ contentType: 'application/javascript', body: APP });
    if (u.pathname === '/_rsc') return r.fulfill({ contentType: 'text/x-component', body: '0:"x"\n'.repeat(5000) });
    if (u.pathname === '/image.png') return r.fulfill({ contentType: 'image/png', body: Buffer.alloc(20000, 1) });
    if (u.pathname === '/doc.html') return r.fulfill({ contentType: 'text/html', body: '<p>x</p>' });
    if (u.pathname === '/cadre') return r.fulfill({ contentType: 'text/html', body: '<!doctype html><body>cadre</body>' });
    if (u.pathname === '/avec-cadre') return r.fulfill({ contentType: 'text/html', body: '<!doctype html><body><iframe id="c" src="https://www.leboncoin.fr/cadre"></iframe></body>' });
    if (/logo-vrm-96\.png/.test(u.pathname)) return r.fulfill({ contentType: 'image/png', body: LOGO });
    return r.fulfill({ contentType: 'text/html; charset=utf-8', headers: entetes, body: pageHtml(modeDoc) });
  });
  await page.route('https://www.pub-exemple.test/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><body>pub<iframe id="c" src="https://www.leboncoin.fr/cadre"></iframe></body>' }));
  await page.route('https://api.leboncoin.fr/**', async (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/lent') { await new Promise((f) => setTimeout(f, 400)); return r.fulfill({ body: 'x' }).catch(() => {}); }
    const corps = u.pathname.includes('members/me') ? { account: { account_id: 35, type: 'private' }, member: { account_id: 35, nickname: { value: 'Compte inventé' } } }
      : u.pathname.includes('dashboard') ? { total: 1, ads: [{ list_id: 3000000001, owner: { user_id: 'aaaaaaaa-0000-4000-8000-000000000001' } }] }
      : /pages\/transactions$/.test(u.pathname) ? [{ purchase_id: 9000000001, step: 'done', created_at: '2026-11-01T10:00:00Z' }]
      : { ok: true, ads: [{ list_id: 3000000001, subject: 'Paire inventée A', price: [80] }, { list_id: 3000000002, subject: 'Paire inventée B', price: [120] }] };
    return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://www.leboncoin.fr', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*' }, body: JSON.stringify(corps) });
  });
  await page.route('https://ext.vrm.test/**', (r) => r.fulfill({ contentType: 'application/javascript', body: lire(new URL(r.request().url()).pathname.slice(1)) }));
  // Le monde ISOLÉ de l'extension : un faux `chrome` (le fond répond « ok »), ses messages
  // remontent au banc ; les ordres du fond passent par les écouteurs que le relais a posés.
  const relayes = [];
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Runtime.addBinding', { name: 'bancRelais', executionContextName: 'vrm-isole' });
  const reponses = [];
  cdp.on('Runtime.bindingCalled', (e) => { if (e.name !== 'bancRelais') return; try { const m = JSON.parse(e.payload); if (m.__reponse) reponses.push(m.__reponse); else relayes.push(m); } catch (_) {} });
  const STUB = `globalThis.__ecoutes=[];globalThis.chrome={runtime:{id:'banc',getURL:(p)=>'https://ext.vrm.test/'+p,getManifest:()=>({version:'0.0.0'}),lastError:null,
    sendMessage:(m,cb)=>{try{bancRelais(JSON.stringify(m));}catch(_){}try{cb&&cb(m&&m.action==='etat'?null:{ok:true});}catch(_){}},onMessage:{addListener(f){__ecoutes.push(f);}}},
    storage:{local:{get:()=>Promise.resolve({}),set:()=>Promise.resolve()},onChanged:{addListener(){}}}};
    globalThis.__bancOrdre=(m)=>{for(const f of __ecoutes){try{f(m,{id:'banc'},(r)=>{try{bancRelais(JSON.stringify({__reponse:r}));}catch(_){}});}catch(_){}}};`;
  const isole = (src) => cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: src, worldName: 'vrm-isole' });
  const evalIsole = async (expression) => {
    const arbre = await cdp.send('Page.getFrameTree');
    const { executionContextId } = await cdp.send('Page.createIsolatedWorld', { frameId: arbre.frameTree.frame.id, worldName: 'vrm-isole' });
    const r = await cdp.send('Runtime.evaluate', { contextId: executionContextId, expression, returnByValue: true, awaitPromise: true });
    return r.result && r.result.value;
  };
  return { ctx, page, erreurs, clones, relayes, reponses, isole, evalIsole, STUB };
}
// Les scripts de l'extension sur leboncoin.fr, comme le manifeste les pose (matches compris).
const SEUL_LBC = (src) => `if(/(^|\\.)leboncoin\\.fr$/i.test(location.hostname)){${src}\n}`;
const APRES_DOM = (src) => `(function(){const go=()=>{${src}\n};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go,{once:true});else go();})();`;
async function brancher(env, mode, { banc = null, idle = false } = {}) {
  const reglages = banc ? `globalThis.__vrmBancDisjoncteur=${JSON.stringify(banc)};` : '';
  const idleSrc = idle ? APRES_DOM(lire('vrm-mots.js') + '\n' + lire('lbc.js')) : '';
  if (mode === 'chrome') {
    await env.page.addInitScript({ content: SEUL_LBC(lire('lbc-inject.js')) });
    await env.isole(SEUL_LBC(env.STUB + reglages + lire('lbc-relay.js') + '\n' + idleSrc));
  } else if (mode === 'orion') {
    await env.isole(SEUL_LBC(env.STUB + reglages + ORION_MAIN + '\n' + lire('lbc-inject.js') + '\n' + lire('lbc-relay.js') + '\n' + idleSrc));
  }
}
const etapesAttendues = { instance: true, json: 2, request: 1, flux: 30000, nonlie: 200, call: true, abort: 'AbortError', blob: 20000, xhrjson: true, xhrdoc: true, xhrpost: 200 };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    // ── A, B, C : la page se dessine, rien ne change pour elle ─────────────────
    let reference = null;
    for (const modeDoc of [false, true]) for (const mode of ['aucune', 'chrome', 'orion']) for (const csp of [false, true]) {
      const nom = `${modeDoc ? 'document' : 'bloc'} · ${mode} · ${csp ? 'CSP' : 'sans CSP'}`;
      console.log(`\n── ${nom}`);
      const env = await preparer(browser, { csp, modeDoc });
      await brancher(env, mode);
      await env.page.goto('https://www.leboncoin.fr/', { waitUntil: 'domcontentloaded' });
      let dessinee = false;
      try { await env.page.waitForSelector('article.annonce', { timeout: 6000 }); dessinee = true; } catch (_) {}
      await env.page.waitForTimeout(600);
      const etapes = await env.page.evaluate(() => window.__etapes || {});
      if (mode === 'aucune' && !modeDoc && !csp) reference = etapes;
      dit(dessinee, 'la page se dessine (2 annonces)');
      const ecarts = Object.entries(etapesAttendues).filter(([k, v]) => etapes[k] !== v).map(([k]) => `${k}=${JSON.stringify(etapes[k])}`);
      dit(!ecarts.length && !etapes.ERREUR, 'chaque étape de la page répond comme sans VRM', ecarts.join(' ') + (etapes.ERREUR ? ' ERREUR=' + etapes.ERREUR : ''));
      dit(!env.erreurs.length, 'aucune erreur de page', env.erreurs.join(' | '));
      dit(etapes.natif === true && reference && etapes.nom === reference.nom, '`fetch` et XHR gardent le texte et le nom de l’original', `natif=${etapes.natif} nom=${etapes.nom} (sans VRM : ${reference && reference.nom})`);
      const inutiles = env.clones.filter((c) => !/json/i.test(c.ct) || !/leboncoin\.fr/.test(c.url));
      dit(!inutiles.length, 'aucune copie lue d’une réponse qui ne sert pas (image, flux, HTML)', inutiles.map((c) => c.ct + ' ' + c.url.replace(/^https:\/\//, '')).join(' | '));
      if (mode !== 'aucune' && !csp) dit(env.relayes.some((m) => m.action === 'lbcRaw') && env.relayes.some((m) => m.action === 'lbcSessionPrivee'), 'la capture marche toujours (annonces et compte relayés)', [...new Set(env.relayes.map((m) => m.action))].join(','));
      if (mode === 'orion') {
        const iso = await env.evalIsole('({inj: globalThis.__vrmLbcInjected === true})');
        dit(iso && iso.inj === false, 'repli Orion : le capteur ne tourne JAMAIS dans le monde isolé', JSON.stringify(iso));
        const reste = await env.page.evaluate(() => [...document.querySelectorAll('script[src^="https://ext.vrm.test/"]')].length);
        dit(reste === 0, 'aucune balise de l’extension laissée dans le document', String(reste));
      }
      if (mode === 'orion' && !csp && !modeDoc) {
        // L'ordre du fond (une page de l'historique) doit arriver au capteur de la PAGE — celui qui a vu le compte.
        await env.evalIsole(`__bancOrdre({from:'vrm-fond',action:'lbcImportPage',url:'https://api.leboncoin.fr/api/consumergoods/proxy/v3/pages/transactions?page=1',compte:'35'})`);
        const fin = Date.now() + 4000; while (!env.reponses.length && Date.now() < fin) await new Promise((f) => setTimeout(f, 50));
        const r = env.reponses[0] || {};
        dit(r.ok === true && r.statut === 200 && !r.erreur && /purchase_id/.test(String(r.corps || '')), 'Orion : l’ordre du fond arrive au capteur de la page (compte vu, page lue)', JSON.stringify(r).slice(0, 200));
      }
      if (mode === 'chrome' && !csp && !modeDoc) await env.page.screenshot({ path: path.join(SORTIE, 'lbc-orion-page-dessinee.png') });
      await env.ctx.close();
    }

    // ── E (suite) : WebKit pose la racine AVANT les scripts « document_start » ──
    // Le repli isolé joué une fois la racine là, la page refusant les scripts de l'extension (CSP).
    {
      console.log('\n── repli Orion, racine déjà là, balise refusée par la page');
      const env = await preparer(browser, { csp: true });
      await env.page.goto('https://www.leboncoin.fr/', { waitUntil: 'domcontentloaded' });
      await env.evalIsole(env.STUB + lire('lbc-inject.js'));
      await env.page.waitForTimeout(500);
      const reste = await env.page.evaluate(() => [...document.querySelectorAll('script[src^="https://ext.vrm.test/"]')].map((s) => s.parentNode.nodeName).join(','));
      dit(reste === '', 'la balise refusée se retire (rien de planté dans <head> ni <html>)', reste);
      await env.ctx.close();
    }

    // ── D : les cadres ─────────────────────────────────────────────────────────
    for (const [haut, attendu, quoi] of [['https://www.pub-exemple.test/', false, 'un cadre leboncoin.fr posé par un AUTRE site : rien de VRM dedans'], ['https://www.leboncoin.fr/avec-cadre', true, 'un cadre leboncoin.fr posé par leboncoin.fr : le capteur y est']]) {
      console.log(`\n── cadre sous ${haut}`);
      const env = await preparer(browser);
      await brancher(env, 'chrome');
      await env.page.goto(haut, { waitUntil: 'load' });
      await env.page.waitForTimeout(300);
      const cadre = env.page.frames().find((f) => /\/cadre$/.test(f.url()));
      const dedans = cadre ? await cadre.evaluate(() => window.__vrmLbcInjected === true) : null;
      dit(dedans === attendu, quoi, `capteur dans le cadre : ${dedans}`);
      await env.ctx.close();
    }

    // ── F : le disjoncteur ─────────────────────────────────────────────────────
    const BANC = { pas: 200, attente: 1200, essais: 3, fin: 20000 };
    const disjoncteur = async (chemin, mode) => {
      const env = await preparer(browser, { mobile: true });
      await brancher(env, mode, { banc: BANC, idle: true });
      let navigations = 0;
      env.page.on('framenavigated', (f) => { if (f === env.page.mainFrame()) navigations++; });
      await env.page.goto('https://www.leboncoin.fr' + chemin, { waitUntil: 'load' });
      const fin = Date.now() + 9000;
      let marque = null;
      while (Date.now() < fin) {
        await env.page.waitForTimeout(250);
        marque = await env.page.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('vrm_lbc_de_cote') || 'null'); } catch (_) { return 'illisible'; } }).catch(() => null);
        if (marque && marque.apres) break;
      }
      await env.page.waitForTimeout(800);
      const page = await env.page.evaluate(() => ({ capteur: window.__vrmLbcInjected === true, annonces: document.querySelectorAll('article.annonce').length })).catch(() => ({}));
      const lbcJs = await env.evalIsole('globalThis.__vrmLbcLoaded === true').catch(() => null);
      return { env, navigations, marque, page, lbcJs, signaux: env.relayes.filter((m) => m.action === 'lbcDisjoncteur').map((m) => m.quoi) };
    };
    for (const mode of ['chrome', 'orion']) {
      console.log(`\n── disjoncteur · page qui reste vide · ${mode}`);
      let r = await disjoncteur('/vide', mode);
      dit(r.marque && r.marque.quoi === 'page-vide', 'VRM se met de côté (marque posée dans l’onglet)', JSON.stringify(r.marque));
      dit(r.navigations === 2, 'la page est rechargée UNE fois, pas plus', `${r.navigations} chargement(s)`);
      dit(r.page.capteur === false && r.lbcJs === false, 'après le rechargement, rien de VRM dans la page (capteur, lbc.js)', JSON.stringify({ capteur: r.page.capteur, lbcJs: r.lbcJs }));
      dit(r.marque && r.marque.apres === 'vide' && JSON.stringify(r.signaux) === '["mis-de-cote","vide-sans-vrm"]', 'verdict « vide même sans VRM » (ce n’est pas VRM), dit au fond', JSON.stringify(r.signaux));
      { const i = r.env.relayes.findIndex((m) => m.action === 'lbcDisjoncteur'); const apres = i < 0 ? ['(jamais mis de côté)'] : r.env.relayes.slice(i).map((m) => m.action).filter((a) => a !== 'lbcDisjoncteur');
        dit(!apres.length, 'mis de côté : plus rien ne part de la page vers le fond (relais arrêté)', apres.join(',')); }
      await r.env.ctx.close();
      console.log(`\n── disjoncteur · page cassée par VRM · ${mode}`);
      r = await disjoncteur('/casse-avec-vrm', mode);
      dit(r.navigations === 2 && r.page.annonces === 2, 'VRM de côté, la page se dessine après le rechargement', JSON.stringify({ nav: r.navigations, annonces: r.page.annonces }));
      dit(r.marque && r.marque.apres === 'affichee' && JSON.stringify(r.signaux) === '["mis-de-cote","affichee-sans-vrm"]', 'verdict « s’affiche sans VRM » (VRM était en cause), dit au fond', JSON.stringify(r.signaux));
      if (mode === 'chrome') await r.env.page.screenshot({ path: path.join(SORTIE, 'lbc-orion-de-cote-page.png') });
      await r.env.ctx.close();
      console.log(`\n── disjoncteur · page normale · ${mode}`);
      r = await disjoncteur('/', mode);
      dit(!r.marque && r.navigations === 1 && r.page.annonces === 2 && !r.signaux.length && r.page.capteur === true, 'page normale : rien (ni marque, ni rechargement), VRM branché', JSON.stringify({ marque: r.marque, nav: r.navigations, signaux: r.signaux }));
      await r.env.ctx.close();
    }

    // ── F (suite) : la carte le DIT ─────────────────────────────────────────────
    for (const apres of ['vide', 'affichee']) {
      console.log(`\n── carte · mis de côté · ${apres}`);
      const env = await preparer(browser, { mobile: true });
      await env.page.goto('https://www.leboncoin.fr/vide', { waitUntil: 'load' });
      const etat = { ok: true, plateforme: 'leboncoin', capte: true, version: '5.379.0', code: '5.379.0', vrm: { ok: true, connecte: true, email: 'essai@vrm.test', cloisonne: true }, site: { id: null, nom: '' }, flux: {}, bascule: null };
      await env.page.evaluate(({ e, js, apres }) => {
        sessionStorage.setItem('vrm_lbc_de_cote', JSON.stringify({ t: Date.now(), quoi: 'page-vide', chemin: '/vide', apres }));
        const orig = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
        window.chrome = { runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: '5.379.0' }), lastError: null,
          sendMessage: (msg, cb) => setTimeout(() => cb && cb(msg.action === 'etat' ? e : { ok: true }), 0) }, storage: { onChanged: { addListener() {} } } };
        const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
      }, { e: etat, js: lire('vrm-badge.js'), apres });
      await env.page.waitForTimeout(300);
      await env.page.tap('#vrm-badge').catch(() => {});
      await env.page.waitForTimeout(400);
      const l = await env.page.evaluate(() => {
        const r = document.getElementById('vrm-badge').shadowRoot, c = r && r.querySelector('.carte');
        const b = r && r.querySelector('[data-lbc-rebrancher]');
        return { texte: c ? c.innerText : '', ligne: r && r.querySelector('[data-lbc-de-cote]') ? r.querySelector('[data-lbc-de-cote]').getAttribute('data-lbc-de-cote') : null, bouton: b ? Math.round(b.getBoundingClientRect().height) : 0 };
      });
      await env.page.screenshot({ path: path.join(SORTIE, `lbc-orion-carte-${apres}.png`) });
      dit(/VRM s’est mis de côté sur cette page : elle ne s’affichait pas/.test(l.texte) && l.ligne === apres, 'la carte dit « VRM s’est mis de côté sur cette page : elle ne s’affichait pas »', l.texte.replace(/\n/g, ' · ').slice(0, 300));
      dit(apres === 'vide' ? /ce n’est pas VRM/.test(l.texte) : /Sans VRM, elle s’affiche/.test(l.texte), apres === 'vide' ? '… et « même sans VRM, elle reste vide : ce n’est pas VRM »' : '… et « sans VRM, elle s’affiche », relue à la prochaine visite', l.texte.replace(/\n/g, ' · ').slice(0, 300));
      dit(l.bouton >= 44, '« Rebrancher VRM ici » fait au moins 44 px', String(l.bouton));
      if (l.bouton) {
        const nav = env.page.waitForNavigation({ timeout: 4000 }).catch(() => null);
        await env.page.evaluate(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-lbc-rebrancher]').click());
        const recharge = await nav;
        const apresClic = await env.page.evaluate(() => sessionStorage.getItem('vrm_lbc_de_cote'));
        dit(apresClic === null && !!recharge, '« Rebrancher VRM ici » efface la marque et recharge la page', String(apresClic));
      } else dit(false, '« Rebrancher VRM ici » efface la marque et recharge la page', 'aucun bouton « Rebrancher VRM ici »');
      dit(!env.erreurs.length, 'aucune erreur de page', env.erreurs.join(' | '));
      await env.ctx.close();
    }
  } finally { await browser.close(); }
  console.log(ko ? `\n❌ lbc-orion-page : ${ok} verts, ${ko} rouges` : `\n✅ lbc-orion-page : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc a levé : ' + (e && e.stack || e)); process.exit(1); });
