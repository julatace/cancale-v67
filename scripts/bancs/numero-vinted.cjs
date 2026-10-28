// ════════════════════════════════════════════════════════════════════════════
//  BANC « LE NUMÉRO SUR VINTED » (20 octobre, 5.201). Aucune fixture.
//   A. vinted-capture.js (le VRAI fichier, dans une fausse page Vinted, avec un
//      faux `chrome.runtime`) : sur /items/new l'étiquette « N°74 » est posée
//      JUSTE À CÔTÉ du bouton « Ajouter » ; base illisible ⇒ « pas pu réserver »,
//      aucun numéro inventé ; dans le dressing et les ventes, l'étiquette N° se
//      pose sur les liens connus, rien sur les autres ; page d'annonce : à côté
//      du titre.
//   B. l'app : l'annonce publiée prend le numéro RÉSERVÉ (celui écrit sur le
//      carton), pas le suivant ; une autre annonce neuve ne prend jamais un
//      numéro réservé ; réservations illisibles ⇒ l'annonce neuve attend.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');   // jamais un chemin absolu (§6.1)
const PORT = Number(process.env.BANC_PORT) || 4507;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
const JETON = 'jeton-de-banc';
const SESSION = { access_token: JETON, refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeur@exemple.fr' }, totp: [] };
const UID = '900000001';
const COMPTE = { vinted_user_id: UID, login: 'compte-de-banc', access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString() };
const item = (id, t) => ({ id, title: t || ('Paire ' + id), price: { amount: '40.0', currency_code: 'EUR' }, is_closed: false, photos: [], brand: 'Nike', size: '42' });
const LISTINGS = (ids) => ({ id: `harvest_${UID}_listings`, data: { capturedAt: new Date().toISOString(), payload: { items: ids.map((i) => item(i.id, i.t)) } } });

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const ecouter = () => new Promise((res, rej) => {
  srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est déjà pris — relance ce banc seul`) : e));
  srv.listen(PORT, () => res());
});

// `etat` : { main, listings, ecrits[], ebay: { brouillons, listings } | null, panneEcriture }
async function brancher(pg, etat) {
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: JETON, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const req = r.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200) => r.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/0' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return json([]);
    if (req.method() !== 'GET') {
      try { const b = JSON.parse(req.postData() || '[]'); (Array.isArray(b) ? b : [b]).forEach((row) => { if (row && row.id === 'main' && row.data) { etat.ecrits.push(row.data); if (!etat.panneEcriture && etat.garder) etat.main = { ...etat.main, ...row.data }; } }); } catch (_) {}
      if (etat.panneEcriture && /app_data/.test(u)) return json({ code: '57014', message: 'canceling statement due to statement timeout' }, 500);
      return json([]);
    }
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json([COMPTE]);
    if (/id=eq\.main/.test(u)) {
      if (/vrm_numerotation/.test(u)) return json([{ v: null }]);
      return json([{ id: 'main', data: etat.main }]);
    }
    if (/orders_/.test(u) && /harvest_/.test(u) && etat.ventes) {
      const rows = [{ id: `harvest_${UID}_orders_sold`, data: { capturedAt: new Date().toISOString(), payload: { my_orders: etat.ventes || [] } } }, { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: new Date().toISOString(), payload: { my_orders: [] } } }];
      return json(rows.filter((x) => /like\./.test(u) || u.includes(x.id)).map((x) => ({ ...x, cap: x.data.capturedAt, n: String(x.data.payload.my_orders.length) })));
    }
    if (/_listings/.test(u) && /harvest_/.test(u)) return json([{ ...etat.listings, cap: etat.listings.data.capturedAt }]);
    if (/panel_num_reserves/.test(u)) return etat.resa === 'ko' ? json({ message: 'boom' }, 503) : json(etat.resa ? [{ id: 'panel_num_reserves', data: etat.resa }] : []);
    if (/ebay_brouillons/.test(u)) return json(etat.ebay ? [{ id: 'ebay_brouillons', items: etat.ebay.brouillons }] : []);
    if (/ebay_listings/.test(u)) return json(etat.ebay ? [{ id: 'ebay_listings', items: etat.ebay.listings }] : []);
    return json([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
}
const fichesLocales = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); } catch (_) { return null; } });
const CAPTURE = fs.readFileSync(path.join(__dirname, '..', '..', 'vinted-sync-extension', 'vinted-capture.js'), 'utf8');
const PAGES = {
  '/items/new': '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><form><h2>Vends ton article</h2><input name="title"><div class="actions"><button type="button">Brouillon</button><button type="submit">Ajouter</button></div></form></body></html>',
  '/member/111': '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div class="grid"><a href="/items/10400000001-patta"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="200" height="260"></a><a href="/items/10400000099-autre"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="200" height="260"></a><div class="carte" style="position:relative;width:200px;height:260px;background:#ddd"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="200" height="260"><a href="/items/10400000002-voile" style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end"></a></div><div class="carte2" style="position:relative;width:200px;height:260px;background:#ddd"><a href="/items/10400000003-dessous" style="position:absolute;inset:0;z-index:1"></a><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="200" height="260" style="position:relative;z-index:2;background:#888"></div></div></body></html>',
  '/my_orders/sold': '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><ul><li><a href="/inbox/8000001">Commande traitée — Samba</a></li><li><a href="/inbox/8000099">Commande traitée — inconnue</a></li></ul></body></html>',
  '/items/10400000001-patta': '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h1>Nike Patta taille 43</h1></body></html>',
};
async function pageVinted(nav, chemin, reponses, taille) {
  const ctx = await nav.newContext(taille === 390 ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1512, height: 950 } });
  const pg = await ctx.newPage();
  await pg.route('https://www.vinted.fr/**', (r) => { const p = new URL(r.request().url()).pathname; return r.fulfill({ status: 200, contentType: 'text/html', body: PAGES[p] || '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>' }); });
  await pg.addInitScript((rep) => {
    window.__msgs = [];
    window.chrome = { runtime: { id: 'x', lastError: null, sendMessage: (m, cb) => { window.__msgs.push(m); const r = rep[m.action]; setTimeout(() => cb && cb(typeof r === 'function' ? r(m) : r), 5); } } };
  }, reponses);
  await pg.goto('https://www.vinted.fr' + chemin, { waitUntil: 'domcontentloaded' });
  await pg.addScriptTag({ content: CAPTURE });
  await pg.waitForTimeout(3200);
  return { ctx, pg };
}
(async () => {
  try { await ecouter(); } catch (e) { console.log('  ❌ ' + e.message); process.exit(1); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const taille of [1512, 390]) {
      console.log(`\n── A. Sur Vinted (${taille} px)`);
      const NUMS = { ok: true, items: { '10400000001': '73', '10400000002': 'B528', '10400000003': '88' }, convs: { '8000001': '60' }, txs: {} };
      let o = await pageVinted(nav, '/items/new', { numeroPourPublier: { ok: true, numero: '74' }, numeros: NUMS }, taille);
      const depot = await o.pg.evaluate(() => { const e = document.querySelector('[data-vrm-num-depot]'); const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Ajouter'); return e ? { n: e.getAttribute('data-vrm-num-depot'), t: e.textContent, colle: e.previousElementSibling === b } : null; });
      dit(!!depot && depot.n === '74' && /N°74/.test(depot.t) && depot.colle, 'page de dépôt : « N°74 » juste à côté du bouton « Ajouter »', JSON.stringify(depot));
      const une = await o.pg.evaluate(() => window.__msgs.filter((m) => m.action === 'numeroPourPublier').length);
      dit(une === 1, 'le numéro n\'est demandé (réservé) qu\'une fois par visite', String(une));
      const larg = await o.pg.evaluate(() => document.documentElement.scrollWidth);
      dit(larg <= taille, 'aucun débordement horizontal', String(larg));
      await o.ctx.close();
      o = await pageVinted(nav, '/items/new', { numeroPourPublier: { ok: false, raison: 'lecture' }, numeros: NUMS }, taille);
      const ko = await o.pg.evaluate(() => { const e = document.querySelector('[data-vrm-num-depot]'); return e ? [e.getAttribute('data-vrm-num-depot'), e.textContent] : null; });
      dit(!!ko && ko[0] === 'pas-su' && !/N°\d/.test(ko[1]), 'base illisible : aucun numéro inventé, la raison est dite', JSON.stringify(ko));
      await o.ctx.close();
      o = await pageVinted(nav, '/member/111', { numeros: NUMS }, taille);
      const tuiles = await o.pg.evaluate(() => [...document.querySelectorAll('a')].map((a) => (a.querySelector('[data-vrm-num]') || {}).textContent || ''));
      dit(tuiles[0] === 'N°73' && tuiles[1] === '', 'dressing : N°73 sur SA paire, rien sur une annonce inconnue', JSON.stringify(tuiles));
      // (28 oct., capture de Julien) Une carte dont le lien COUVRE la photo sans la
      // contenir : l'étiquette était étirée en barre sombre en bas de la photo.
      const pil = await o.pg.evaluate(() => { const c = document.querySelector('.carte'); const e = c && c.querySelector('[data-vrm-num]'); if (!e || !c) return null; const r = e.getBoundingClientRect(), q = c.getBoundingClientRect(); return { t: e.textContent, w: Math.round(r.width), dx: Math.round(r.left - q.left), dy: Math.round(r.top - q.top) }; });
      dit(pil && pil.t === 'N°B528' && pil.w < 100 && pil.dx <= 12 && pil.dy <= 12, 'carte au lien superposé : une petite pastille en haut à gauche de la photo, pas une barre étirée', JSON.stringify(pil));
      // (28 oct., « sur Vinted il n'y a plus les numéros ») La photo peinte AU-DESSUS
      // du lien (le lien dans une couche plus basse) : posée dans le lien, la
      // pastille était cachée par la photo. Elle doit être VISIBLE (le point
      // touché en son centre est elle).
      const vis = await o.pg.evaluate(() => { const c = document.querySelector('.carte2'); const e = c && c.querySelector('[data-vrm-num]'); if (!e) return null; e.style.setProperty('pointer-events', 'auto', 'important'); const r = e.getBoundingClientRect(); const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { t: e.textContent, dessus: !!x && (x === e || e.contains(x)) }; });
      dit(vis && vis.t === 'N°88' && vis.dessus, 'photo peinte au-dessus du lien : la pastille reste visible sur la photo', JSON.stringify(vis));
      const uneSeule = await o.pg.evaluate(() => document.querySelectorAll('.carte2 [data-vrm-num]').length);
      dit(uneSeule === 1, 'une seule pastille par carte (pas une de plus à chaque passage)', String(uneSeule));
      await o.ctx.close();
      o = await pageVinted(nav, '/my_orders/sold', { numeros: NUMS }, taille);
      const ventes = await o.pg.evaluate(() => [...document.querySelectorAll('a')].map((a) => (a.querySelector('[data-vrm-num]') || {}).textContent || ''));
      dit(ventes[0] === 'N°60' && ventes[1] === '', 'ventes : « Commande traitée » porte le N° de la paire (par la conversation), rien sur l\'inconnue', JSON.stringify(ventes));
      await o.ctx.close();
      o = await pageVinted(nav, '/items/10400000001-patta', { numeros: NUMS }, taille);
      const titre = await o.pg.evaluate(() => { const e = document.querySelector('h1 [data-vrm-num-page]'); return e ? e.textContent : ''; });
      dit(titre === 'N°73', 'page de l\'annonce : N°73 à côté du titre', titre);
      await o.ctx.close();
    }
    {
      console.log('\n── B. L\'app donne le numéro réservé');
      const etat = { main: { vinted_annonce_numeros: { '4001': { numero: '73', auto: true, numberedAt: '2026-10-14T15:47:09.775Z', title: 'Ancienne de banc' } }, vinted_used_numeros: [1, 2, 3, 73], vinted_accounts_hidden: [] },
        listings: LISTINGS([{ id: 4001, t: 'Ancienne de banc' }, { id: 10499999999, t: 'Publiée de banc' }, { id: 10499999998, t: 'Autre neuve' }]),
        ventes: [], ecrits: [], ebay: null, panneEcriture: false, garder: true,
        resa: { attente: { '75': { at: new Date().toISOString() } }, items: { '10499999999': { numero: '74', at: new Date().toISOString() } } } };
      const ctx = await nav.newContext({ viewport: { width: 1512, height: 950 } });
      await ctx.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
      const pg = await ctx.newPage(); await brancher(pg, etat);
      await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(9000);
      const loc = await fichesLocales(pg) || {};
      dit(String((loc['10499999999'] || {}).numero) === '74', 'l\'annonce publiée prend le N°74 affiché à côté du bouton (pas le suivant)', String((loc['10499999999'] || {}).numero));
      const autre = String((loc['10499999998'] || {}).numero || '');
      dit(!!autre && !['73', '74', '75'].includes(autre), 'l\'autre annonce neuve ne prend aucun numéro réservé (ni 74, ni 75 en attente)', `N°${autre}`);
      await ctx.close();
    }
    {
      console.log('\n── C. Réservations illisibles : l\'annonce neuve attend');
      const etat = { main: { vinted_annonce_numeros: { '4001': { numero: '73', auto: true, numberedAt: '2026-10-14T15:47:09.775Z' } }, vinted_used_numeros: [1, 73], vinted_accounts_hidden: [] },
        listings: LISTINGS([{ id: 4001, t: 'Ancienne' }, { id: 10499999999, t: 'Publiée' }]), ventes: [], ecrits: [], ebay: null, panneEcriture: false, resa: 'ko' };
      const ctx = await nav.newContext({ viewport: { width: 1512, height: 950 } });
      await ctx.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
      const pg = await ctx.newPage(); await brancher(pg, etat);
      await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(8000);
      const loc = await fichesLocales(pg) || {};
      dit(!(loc['10499999999'] && loc['10499999999'].numero), 'aucun numéro donné tant que les réservations ne sont pas lues', JSON.stringify(loc['10499999999'] || null));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ le numéro sur Vinted : ${ko} rouge(s)` : '\n✅ le numéro sur Vinted : tout est vert');
  process.exit(ko ? 1 : 0);
})();
