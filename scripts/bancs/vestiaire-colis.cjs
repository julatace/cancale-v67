// ═══════════════════════════════════════════════════════════════════════════
// BANC : VESTIAIRE DANS COLIS ET MA JOURNÉE (27 octobre, 5.240)
//        (node scripts/bancs/vestiaire-colis.cjs — après `npm run build` ;
//         BANC_PORT pour changer de port, 8051 par défaut)
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES. L'extension a rangé : deux ventes Vestiaire à envoyer
// (V1 référence VRM-401, limite demain, bordereau dispo ; V2 sans référence),
// une vente déjà envoyée (V3), un achat en route (A1, suivi Chronopost), un
// achat livré (A2), 2 messages non lus. Exigé aux deux tailles :
//   1. Colis : « Ventes Vestiaire à envoyer · 2 », V1 = N°401 avec sa limite,
//      V2 « pas reliée » (jamais un titre), V3 absente ; « Achats en route · 1 »
//      avec « Suivre » vers Chronopost (44 px), A2 absent ;
//   2. Ma journée : « 2 ventes Vestiaire à envoyer » (ambre : demain) et
//      « 2 messages Vestiaire non lus » ;
//   3. « pas su » (lecture en 503) : Colis le dit UNE fois, Ma journée ne
//      dit RIEN de Vestiaire (aucun « 0 ») ; jamais lu : rien du tout.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 8051;
const MAINTENANT = Date.now(), H = 3600000, J = 24 * H;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const dansJ = (j) => new Date(MAINTENANT + j * J).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const ROWS_BASE = [
  { id: 'main', data: { vinted_ship_done: {} } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [] } } },
];
const VC = [
  { id: 'vc_ventes', data: { ventes: {
    V1: { productId: '900001', ref: '401', etat: 'awaiting_shipping', aExpedier: true, limite: dansJ(1), etiquette: true, transporteur: 'Mondial Relay', suivi: '' },
    V2: { productId: '900002', ref: '', etat: 'awaiting_shipping', aExpedier: true, limite: '', etiquette: null },
    V3: { productId: '900003', ref: '403', aExpedier: false } } } },
  { id: 'vc_achats', data: { achats: {
    A1: { nom: 'Nike Dunk Low', etat: 'shipped', suivi: 'XW123456789FR', transporteur: 'Chronopost' },
    A2: { nom: 'Adidas Samba', etat: 'delivered', suivi: 'XW999999999FR', transporteur: 'Chronopost' } } } },
  { id: 'vc_messages', data: { compteur: { messages: 2, at: ilYaH(0.5) } } },
  { id: 'vc_listings', data: { liens: {} } },
];
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 140)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT=…)'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};

async function preparer(b, vp, mode) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const ROWS = ROWS_BASE.concat(mode === 'lu' ? VC : []);
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) {
      if (mode === 'panne' && /vc_/.test(inn[1])) return route.fulfill({ status: 503, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>503</html>' });
      const ids = inn[1].split(','); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme));
    }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
async function sain(pg, ecran) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
}
const lire = (pg) => pg.evaluate(() => {
  const bl = document.querySelector('[data-colis-vestiaire]');
  const s = bl && bl.querySelector('[data-suivre-colis]');
  return {
    bloc: bl ? bl.getAttribute('data-colis-vestiaire') : null, route: bl ? bl.getAttribute('data-colis-vestiaire-route') : null,
    ventes: [...document.querySelectorAll('[data-vc-colis]')].map((x) => ({ id: x.getAttribute('data-vc-colis'), num: x.getAttribute('data-vc-colis-num'), lim: x.getAttribute('data-vc-colis-limite'), t: x.innerText })),
    achats: [...document.querySelectorAll('[data-vc-route]')].map((x) => x.getAttribute('data-vc-route')),
    suivre: s ? s.href : '', h: s ? s.getBoundingClientRect().height : 0,
    panne: document.querySelectorAll('[data-colis-vestiaire="passu"]').length,
  };
});
const jobs = (pg) => pg.evaluate(() => ({ env: (document.querySelector('[data-job="vestiaire-envoyer"]') || { getAttribute: () => null }).getAttribute('data-n'),
  msg: (document.querySelector('[data-job="vestiaire-messages"]') || { getAttribute: () => null }).getAttribute('data-n'),
  envTxt: (document.querySelector('[data-job="vestiaire-envoyer"]') || {}).innerText || '',
  vest: /Vestiaire/.test(document.body.innerText) }));

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const mode of ['lu', 'panne', 'jamais']) {
        console.log(`── ${vp.width} px · ${mode}`);
        const { ctx, pg, errs } = await preparer(b, vp, mode);
        await essaie('Colis ' + mode, async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('[data-colis-recap]', { timeout: 15000 });
          await pg.waitForTimeout(3000);
          const c = await lire(pg);
          if (mode === 'lu') {
            dit(c.bloc === '2' && c.ventes.map((v) => v.id).sort().join() === 'V1,V2', 'Colis : les 2 ventes Vestiaire à envoyer, pas celle déjà partie', JSON.stringify(c.ventes.map((v) => v.id)));
            const v1 = c.ventes.find((v) => v.id === 'V1') || {}, v2 = c.ventes.find((v) => v.id === 'V2') || {};
            dit(v1.num === '401' && v1.lim && /demain/.test(v1.t) && /bordereau disponible/.test(v1.t), 'V1 : N°401 (référence VRM), à envoyer demain, bordereau disponible', v1.t);
            dit(v2.num === '' && /Pas reliée/.test(v2.t) && /bordereau : pas su/.test(v2.t), 'V2 : pas reliée (aucun titre deviné), bordereau « pas su »', v2.t);
            dit(c.route === '1' && c.achats.join() === 'A1', 'Colis : l’achat en route, pas celui livré', JSON.stringify(c.achats));
            dit(/chronopost\.fr/.test(c.suivre) && c.h >= 44, 'Suivre l’achat sur Chronopost (44 px)', c.suivre);
          } else if (mode === 'panne') {
            dit(c.panne === 1 && !c.ventes.length, 'pas su : Colis le dit UNE fois, aucune vente inventée', JSON.stringify(c));
          } else dit(c.bloc === null && c.panne === 0, 'jamais lu : rien de Vestiaire dans Colis', JSON.stringify(c));
          await sain(pg, 'Colis');
        });
        await essaie('Ma journée ' + mode, async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('[data-tuile="envoyer"]', { timeout: 15000 });
          await pg.waitForTimeout(3000);
          const t = await jobs(pg);
          if (mode === 'lu') {
            dit(t.env === '2' && /demain/.test(t.envTxt), 'Ma journée : « 2 ventes Vestiaire à envoyer », pressées (demain)', JSON.stringify(t));
            dit(t.msg === '2', 'Ma journée : « 2 messages Vestiaire non lus »', JSON.stringify(t));
          } else dit(t.env == null && t.msg == null, `${mode} : Ma journée ne dit rien de Vestiaire (aucun « 0 »)`, JSON.stringify(t));
          await sain(pg, 'Ma journée');
        });
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
        await ctx.close();
      }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ Vestiaire dans Colis et Ma journée : ${ko} rouge(s)` : '\n✅ Vestiaire dans Colis et Ma journée : tout est vert');
  process.exit(ko ? 1 : 0);
})();
