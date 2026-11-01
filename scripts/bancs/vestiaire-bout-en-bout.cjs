// Banc : VESTIAIRE DE BOUT EN BOUT — ce que l'extension écrit DOIT s'afficher (1er nov., 5.299)
//
// Retour de Julien : la carte de l'extension dit « Annonces : lues à l'instant ·
// Envoyées à VRM à l'instant », et « rien n'apparaît dans VRM ». Et : « même s'il
// n'y a rien de capté par l'extension, je veux qu'il y ait les onglets etc. comme
// avec Vinted, Leboncoin ».
// Ce banc ne sert PAS des lignes écrites à la main : il fait tourner
//   1. le VRAI `vc-inject.js` (la page vestiairecollective.com) sur des réponses
//      Vestiaire inventées de la forme connue (`{meta, data}`), le VRAI relais
//      `vc.js`, le VRAI `background.js` (`_fond-vm.cjs`, base à état) — et sert
//      à l'app EXACTEMENT les lignes que le fond a écrites ;
//   2. puis l'app (dist/), 390 px tactile et 1512 px, qui doit les montrer.
// Il exige (data-* et nombres rendus) :
//   A. Annonces · Vestiaire : les 2 annonces écrites par l'extension, en fiches ;
//      Ventes · Vestiaire : la vente à expédier ; Messages · Vestiaire : la
//      conversation et les 3 non-lus ;
//   B. AUCUNE ligne Vestiaire en base : le filtre « Vestiaire » est là dans
//      Annonces, Ventes, Messages et Achats, chaque écran dit « pas encore lu »
//      (jamais un écran blanc, jamais l'absence du filtre) ;
//   C. l'extension connectée à un AUTRE compte VRM : chaque écran Vestiaire le dit
//      en tête (c'est pourquoi rien n'arriverait ici) ;
//   D. aucune erreur, aucun débordement. Données INVENTÉES (dépôt public).
//   E. (1er nov., audit A4/A2) la vente Vestiaire à expédier COMPTE ailleurs que
//      sur son écran : Ma journée « À envoyer » (`data-vestiaire`), la cloche
//      (`vrm_colis_aposter.vestiaire`), la colonne de Colis — le MÊME nombre
//      (§11) ; et son montant, pas sûr, n'entre dans aucun « vendu » : il est
//      NOMMÉ (`data-vendu-non-comptees`), jamais compté ni tu.
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os'), vm = require('vm');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { faireFond } = require('../_fond-vm.cjs');
const RACINE = path.join(__dirname, '..', '..');
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 8574;
const CAPTURES = process.env.BANC_CAPTURES || os.tmpdir();
const VERSION = JSON.parse(fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'manifest.json'), 'utf8')).version;
const copie = (x) => JSON.parse(JSON.stringify(x));
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

// ── 1. L'EXTENSION : page → relais → fond → base ───────────────────────────
async function ecrireParExtension() {
  const INJ = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'vc-inject.js'), 'utf8');
  const RELAIS = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'vc.js'), 'utf8');
  const f = faireFond({ store: { vrmSession: { access_token: 'jeton.banc', refresh_token: 'r', user_id: '11111111-2222-3333-4444-555555555555', email: 'vendeur@exemple.test', expires_at: Date.now() + 864e5 } } });
  const ONGLET = 12, sender = { tab: { id: ONGLET, url: 'https://fr.vestiairecollective.com/members/profile/' }, frameId: 0, url: 'https://fr.vestiairecollective.com/members/profile/' };
  // Le relais : ce qu'il envoie part au VRAI fond, comme `chrome.runtime.sendMessage`.
  const enVol = [];
  let ecoute = null;
  const winR = { addEventListener: (t, fn) => { if (t === 'message') ecoute = fn; }, postMessage() {} }; winR.top = winR;
  const ctxR = { window: winR, self: {}, chrome: { runtime: { id: 'banc', sendMessage: (m, cb) => { enVol.push(f.envoyer(copie(m), sender)); if (cb) cb(); }, lastError: null, onMessage: { addListener() {} } } }, location: { href: 'https://fr.vestiairecollective.com/' }, URL, console, setTimeout, clearTimeout, JSON, Date, Math, Map, Set };
  vm.createContext(ctxR); vm.runInContext(RELAIS, ctxR, { filename: 'vc.js' });
  // La page : ses posts vont au relais.
  const routes = {};
  const win = {
    postMessage: (m) => { if (ecoute && m && m.__tag === 'CANCALE_VC') ecoute({ source: winR, data: copie(m) }); },
    fetch: async (u) => { const b = JSON.stringify(routes[String(u)] || {}); return { status: 200, ok: true, headers: { get: () => 'application/json' }, clone() { return this; }, text: async () => b }; },
    addEventListener() {},
  }; win.top = win; win.self = win;
  const ctx = { window: win, document: { currentScript: {}, createElement: () => ({}), head: { appendChild() {} }, addEventListener() {}, getElementById: () => null },
    location: { origin: 'https://fr.vestiairecollective.com', hostname: 'fr.vestiairecollective.com', pathname: '/members/profile/', href: 'https://fr.vestiairecollective.com/members/profile/' }, history: { pushState() {}, replaceState() {} },
    URL, console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, JSON, Date, Math, Map, Set, Promise, encodeURIComponent };
  vm.createContext(ctx); vm.runInContext(INJ, ctx, { filename: 'vc-inject.js' });
  const API = 'https://apiv2.vestiairecollective.com';
  const charge = async (u, corps) => { routes[u] = corps; await win.fetch(u); await attendre(20); await Promise.all(enVol.splice(0)); await attendre(10); };
  await charge(`${API}/users/me`, { data: { id: 'compteBanc', type: 'user', attributes: { firstname: 'NePasLire' } } });
  await charge(`${API}/users/me/product-listings?offset=0&limit=48`, { meta: { count: 2, offset: 0 }, data: [
    { id: 'P101', name: 'Baskets Nike Dunk Low', status: 'on_sale', price: { cents: 9900, currency: 'EUR' }, description: 'Réf. VRM-41', pictures: [{ path: 'https://images.vestiairecollective.com/produit/banc-P101.jpg' }] },
    { id: 'P102', name: 'Adidas Samba OG', status: 'on_sale', price: 70, description: 'Sans référence' },
  ] });
  await charge(`${API}/users/me/awaiting-shipping-items`, { meta: { count: 1, offset: 0 }, data: [{ id: 'V201', product: { id: 'P101', description: 'Réf. VRM-41' }, status: 'to_ship', shipByDate: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10) }] });
  await charge(`${API}/notification-feed-counter/v2`, { data: { unseen: { messages: 3 } } });
  await charge(`${API}/conversations`, { meta: { count: 1, offset: 0 }, data: [{ id: 'C301', product: { id: 'P101' }, unread: true, lastMessage: { body: 'Bonjour, toujours dispo ?' }, updatedAt: new Date().toISOString() }] });
  return f.lignes;
}

// ── 2. L'APP ───────────────────────────────────────────────────────────────
const SESSION = { access_token: 'jeton-de-l-app', refresh_token: 'r-app', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeur@exemple.test' } };
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: new Date().toISOString() }];
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let fch = q.url.split('?')[0]; if (fch === '/' || !path.extname(fch)) fch = '/index.html';
  const p = path.join(DIST, fch);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    const texte = /->>[^>]*$/.test(src);
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^(data|meta)(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (texte && v != null && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
};
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version, id: 'ext-banc' });
    if (d.__vmr === 'authEtat') post({ __vmr: 'authEtat:result', reqId: d.reqId, etat: o.vrm });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'ext-banc', vrm: o.vrm, vinted: null, cmds: {} } });
    if (d.__vmr === 'cmd') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'banc' } });
  });
  post({ __vmr: 'ready', version: o.version, id: 'ext-banc' });
};
async function ouvrir(b, vp, lignes, vrm) {
  const rows = [{ id: 'main', data: { vinted_annonce_numeros: {} } }, ...Object.entries(lignes).map(([id, data]) => ({ id, data }))];
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sess) => { try { localStorage.setItem('vrm_session', JSON.stringify(sess)); } catch (_) {} }, SESSION);
  await pg.addInitScript(PONT, { version: VERSION, vrm });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => {
    const chemin = new URL(r.request().url()).pathname.replace(/^.*\/auth\/v1\//, '');
    const corps = chemin === 'user' ? { id: SESSION.user.id, email: SESSION.user.email, aud: 'authenticated' } : { ...SESSION, expires_in: 3600 };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    if (!/\/rest\/v1\/app_data/.test(u)) return j([]);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel) && sel !== 'data,updated_at,cap:data->>capturedAt') ? projette(r, sel) : ({ ...r, updated_at: new Date().toISOString(), cap: (r.data || {}).capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=annonces&site=vestiaire`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
}
const aller = async (pg, tache, sel) => {
  await pg.goto(pg.url().split('?')[0] + `?tab=${tache}&site=vestiaire`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pg.waitForSelector(sel, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(700);
};
const ECRANS = [['annonces', 'data-vc-annonces'], ['ventes', 'data-vc-ventes'], ['messages', 'data-vc-messages'], ['achats', 'data-vc-achats']];
const lireEcran = (pg, attr) => pg.evaluate((a) => {
  const e = document.querySelector('[' + a + ']');
  const filtre = document.querySelector('[data-filtre-site] [data-site="vestiaire"]');
  const tache = document.querySelector('[data-tache-vestiaire]');
  return { etat: e ? e.getAttribute(a) : null, txt: e ? e.innerText.slice(0, 300) : '', filtre: !!filtre, presse: filtre ? filtre.getAttribute('aria-pressed') : null,
    vide: tache ? tache.innerText.trim().length === 0 : true, ext: (document.querySelector('[data-vc-ext]') || { getAttribute: () => null }).getAttribute('data-vc-ext'),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
}, attr);

(async () => {
  let b;
  try {
    const lignes = await ecrireParExtension();
    dit(lignes.vc_listings && Object.keys(lignes.vc_listings.items || {}).length === 2 && lignes.vc_ventes && lignes.vc_messages && lignes.vc_session, "l'extension (vrai code) a écrit vc_listings, vc_ventes, vc_messages, vc_session", Object.keys(lignes).join(','));
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const MOI = { ok: true, connecte: true, expiree: false, email: SESSION.user.email, user_id: SESSION.user.id, cloisonne: true };
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px · A. ce que l'extension a écrit`);
      const o = await ouvrir(b, vp, lignes, MOI);
      await aller(o.pg, 'annonces', '[data-vc-annonces="lu"]');
      const an = await o.pg.evaluate(() => [...document.querySelectorAll('[data-vc-annonce]')].map((x) => ({ id: x.getAttribute('data-vc-annonce'), num: x.getAttribute('data-vc-annonce-num'), etat: x.getAttribute('data-vc-annonce-etat') })));
      dit(an.length === 2 && an.some((x) => x.id === 'P101' && x.num === '41'), "Annonces · Vestiaire : les 2 annonces écrites par l'extension sont là (P101 reliée au N°41)", JSON.stringify(an));
      await o.pg.screenshot({ path: path.join(CAPTURES, `vc-bout-annonces-${vp.width}.png`), fullPage: true }).catch(() => {});
      await aller(o.pg, 'ventes', '[data-vc-ventes="lu"]');
      const ve = await o.pg.evaluate(() => [...document.querySelectorAll('[data-vc-vente]')].map((x) => ({ id: x.getAttribute('data-vc-vente'), etape: x.getAttribute('data-vc-vente-etape') })));
      dit(ve.some((x) => x.id === 'V201' && x.etape === 'a-expedier'), 'Ventes · Vestiaire : la vente à expédier écrite par l’extension est là', JSON.stringify(ve));
      await aller(o.pg, 'messages', '[data-vc-messages="lu"]');
      const me = await o.pg.evaluate(() => ({ c: [...document.querySelectorAll('[data-vc-conv]')].map((x) => x.getAttribute('data-vc-conv')), n: (document.querySelector('[data-vc-messages-nonlus]') || { getAttribute: () => null }).getAttribute('data-vc-messages-nonlus') }));
      dit(me.c.includes('C301') && me.n === '3', 'Messages · Vestiaire : la conversation et les 3 non-lus écrits par l’extension sont là', JSON.stringify(me));
      dit(o.errs.length === 0, 'aucune erreur d’app', o.errs.join(' | ').slice(0, 160));
      await o.ctx.close();
    }
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px · B. aucune ligne Vestiaire en base`);
      const o = await ouvrir(b, vp, {}, MOI);
      for (const [t, attr] of ECRANS) {
        await aller(o.pg, t, `[${attr}]:not([${attr}="charge"])`);
        const e = await lireEcran(o.pg, attr);
        dit(e.filtre && e.presse === 'true', `${t} : le filtre « Vestiaire » est là (et choisi), même sans rien de capté`, JSON.stringify({ filtre: e.filtre, presse: e.presse }));
        dit(e.etat === 'jamais' && !e.vide && /vestiaire/i.test(e.txt), `${t} : l’écran dit « pas encore lu » avec le geste — jamais un écran blanc`, `${e.etat} · ${e.txt.slice(0, 120)}`);
        dit(e.sw <= e.cw + 1, `${t} : aucun débordement`, `${e.sw}/${e.cw}`);
      }
      await o.pg.screenshot({ path: path.join(CAPTURES, `vc-bout-vide-${vp.width}.png`), fullPage: true }).catch(() => {});
      // Le filtre doit être là quand un AUTRE site est choisi (l'adresse `site=vestiaire` le forçait toujours).
      for (const t of ['annonces', 'ventes', 'messages', 'achats']) {
        await o.pg.goto(o.pg.url().split('?')[0] + `?tab=${t}&site=vinted`, { waitUntil: 'domcontentloaded' }).catch(() => {});
        await o.pg.waitForSelector('[data-filtre-site]', { timeout: 15000 }).catch(() => {});
        await o.pg.waitForTimeout(1200);
        const f = await o.pg.evaluate(() => ({ v: !!document.querySelector('[data-filtre-site] [data-site="vestiaire"]'), sel: (document.querySelector('[data-filtre-site] [aria-pressed="true"]') || { getAttribute: () => null }).getAttribute('data-site') }));
        dit(f.v, `${t} (Vinted choisi) : le filtre « Vestiaire » est proposé, même sans rien de capté`, JSON.stringify(f));
      }
      if (vp.width > 1000) {
        const rail = await o.pg.evaluate(() => !!document.querySelector('[data-nav-entree="plat_vestiaire"]'));
        dit(rail, 'la colonne porte l’entrée « Vestiaire » (Plateformes), même sans rien de capté', String(rail));
      }
      dit(o.errs.length === 0, 'aucune erreur d’app', o.errs.join(' | ').slice(0, 160));
      await o.ctx.close();
    }
    {
      console.log('── 1512 px · E. la vente Vestiaire à poster compte partout, et son argent est dit');
      const o = await ouvrir(b, { width: 1512, height: 950 }, lignes, MOI);
      await o.pg.goto(o.pg.url().split('?')[0] + '?tab=journee', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await o.pg.waitForSelector('[data-tuile="envoyer"][data-vestiaire]', { timeout: 20000 }).catch(() => {});
      await o.pg.waitForTimeout(1500);
      const j = await o.pg.evaluate(() => {
        const t = document.querySelector('[data-tuile="envoyer"]');
        let pub = null; try { pub = JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null'); } catch (_) {}
        const h = document.querySelector('[data-vendu-mois]');
        return { n: t ? t.getAttribute('data-n') : null, vc: t ? t.getAttribute('data-vestiaire') : null, pub,
          vendu: h ? h.getAttribute('data-vendu-mois') : null, nc: h ? h.getAttribute('data-vendu-non-comptees') : null, partiel: h ? h.getAttribute('data-vendu-partiel') : null };
      });
      dit(j.vc === '1' && Number(j.n) >= 1, 'Ma journée « À envoyer » compte la vente Vestiaire à expédier', JSON.stringify({ n: j.n, vc: j.vc }));
      dit(j.pub && j.pub.vestiaire === 1 && j.pub.total === Number(j.n), 'la cloche (`vrm_colis_aposter`) publie le MÊME nombre, Vestiaire compris', JSON.stringify(j.pub));
      dit(j.nc === '1' && (j.vendu === '' || j.partiel === '1'), '« Vendu en … » : la vente Vestiaire au montant pas sûr n’est pas comptée, elle est NOMMÉE (« au moins »)', JSON.stringify({ vendu: j.vendu, nc: j.nc, partiel: j.partiel }));
      await o.pg.screenshot({ path: path.join(CAPTURES, 'vc-bout-journee-1512.png'), fullPage: true }).catch(() => {});
      await o.pg.goto(o.pg.url().split('?')[0] + '?tab=cat_bord', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await o.pg.waitForSelector('[data-cc-carte][data-site="vestiaire"]', { timeout: 20000 }).catch(() => {});
      const c = await o.pg.evaluate(() => [...document.querySelectorAll('[data-cc-carte][data-site="vestiaire"]')].map((x) => x.getAttribute('data-cc-carte')));
      dit(c.length === 1 && (!j.pub || j.pub.vestiaire === c.length), 'Colis porte la même vente Vestiaire (une carte) : Colis = Ma journée = la cloche', JSON.stringify(c));
      dit(o.errs.length === 0, 'aucune erreur d’app', o.errs.join(' | ').slice(0, 160));
      await o.ctx.close();
    }
    {
      console.log('── 390 px · C. extension connectée à un AUTRE compte VRM');
      const o = await ouvrir(b, { width: 390, height: 844 }, {}, { ok: true, connecte: true, expiree: false, email: 'quelquun@ailleurs.test', user_id: '99999999-8888-7777-6666-555555555555', cloisonne: true });
      for (const [t, attr] of ECRANS.slice(0, 3)) {
        await aller(o.pg, t, '[data-vc-ext]');
        const e = await lireEcran(o.pg, attr);
        dit(e.ext === 'autre-vrm', `${t} : l’écran dit en tête que l’extension écrit dans un AUTRE compte VRM`, String(e.ext));
      }
      const txt = await o.pg.evaluate(() => (document.querySelector('[data-vc-ext]') || {}).innerText || '');
      dit(/quelquun@ailleurs\.test/.test(txt), '… et nomme ce compte', txt.slice(0, 200));
      await o.pg.screenshot({ path: path.join(CAPTURES, 'vc-bout-autre-vrm-390.png'), fullPage: true }).catch(() => {});
      dit(o.errs.length === 0, 'aucune erreur d’app', o.errs.join(' | ').slice(0, 160));
      await o.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.stack || e).slice(0, 300)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ Vestiaire de bout en bout : ${ko} rouge(s)` : '\n✅ Vestiaire de bout en bout : tout est vert');
  process.exit(ko ? 1 : 0);
})();
