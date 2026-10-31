// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES MESSAGES eBAY SANS RÉPONSE DANS MA JOURNÉE (21 octobre)
//        (node scripts/bancs/ebay-messages-journee.cjs — après `npm run build` ;
//         BANC_PORT pour changer de port, 8621 par défaut)
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (le banc vit dans le dépôt). La route range, par compte
// eBay, un résumé `ebay_messages{suffixe}` ({ nonLus, complet, capturedAt }) ;
// Ma journée le LIT, sans appeler eBay. Le banc exige, à 390 px tactile et
// 1512 px :
//   A. deux comptes eBay (2 + 1) et 1 conversation Vinted non lue : la case
//      « Messages » = 1 + 3 (`data-n`, `data-ebay`), l'action « messages eBay
//      sans réponse » compte 3 et NOMME les deux comptes ; AUCUN appel
//      `messages` à eBay à l'ouverture ;
//   B. un seul compte, résumé incomplet (au moins), Vinted à 0 : la case mène
//      à eBay → Messages ; l'action dit « au moins » ;
//   C. résumé illisible : la case dit « pas su » (`data-ebay="passu"`), une
//      ligne le dit UNE fois, aucun « 0 » eBay, aucune action eBay ;
//   D. aucun résumé rangé : rien d'eBay (ni attribut, ni ligne, ni action).
// On juge les attributs et les nombres rendus, jamais une formulation.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 8621;

const MAINTENANT = Date.now();
const H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const CLE2 = '0123456789abcdef';
const conv = (id, unread, h) => ({ id, unread, updated_at: ilYaH(h), description: 'Toujours dispo ?', opposite_user: { id: 5000 + id, login: 'ach_' + id } });
const base = (vintedNonLus) => [
  { id: 'main', data: { vinted_ship_done: {} } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [] } } },
  { id: 'harvest_111_inbox', data: { capturedAt: ilYaH(0.1), payload: { conversations: [conv(301, vintedNonLus > 0, 2), conv(302, false, 3)] } } },
  { id: 'ebay_orders', data: { capturedAt: MAINTENANT - 2 * 60000, orders: [] } },
];
const SCEN = {
  A: [...base(1),
    { id: 'ebay_comptes', data: { comptes: [{ principal: true, cle: 'fedcba9876543210', pseudo: 'boutique_pro' }, { cle: CLE2, pseudo: 'perso_ju' }] } },
    { id: 'ebay_orders_' + CLE2, data: { capturedAt: MAINTENANT - 2 * 60000, orders: [] } },
    { id: 'ebay_messages', data: { nonLus: 2, ids: ['m1', 'm2'], complet: true, capturedAt: MAINTENANT - 5 * 60000 } },
    { id: 'ebay_messages_' + CLE2, data: { nonLus: 1, ids: ['m3'], complet: true, capturedAt: MAINTENANT - 5 * 60000 } }],
  B: [...base(0), { id: 'ebay_messages', data: { nonLus: 2, ids: ['m1', 'm2'], complet: false, capturedAt: MAINTENANT - 5 * 60000 } }],
  C: [...base(1), { id: 'ebay_messages', data: { nonLus: 2, ids: [], complet: true, capturedAt: MAINTENANT } }],
  D: base(1),
};

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

async function preparer(b, vp, ROWS, { msgKO = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], appelsEbay = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (msgKO && /id=(eq|like)\.ebay_messages/.test(u)) return route.fulfill({ status: 503, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>503</html>' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => {
    let a = ''; try { a = JSON.parse(r.request().postData() || '{}').action || ''; } catch (_) {}
    if (/\/api\/ebay/.test(r.request().url())) appelsEbay.push(a || r.request().method());
    if (a === 'messages') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, messages: [], page: 1, totalPages: 1 }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  return { ctx, pg, errs, appelsEbay };
}
async function sain(pg, ecran) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
}
const lireJour = (pg) => pg.evaluate(() => {
  const t = document.querySelector('[data-tuile="messages"]');
  const job = document.querySelector('[data-job="messages-ebay"]');
  return { n: t && t.getAttribute('data-n'), eb: t ? t.getAttribute('data-ebay') : null,
    job: job ? job.getAttribute('data-n') : null, jobTxt: job ? job.innerText : '',
    passu: document.querySelectorAll('[data-ebay-msg-passu]').length };
});
async function ouvrirJour(pg) {
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-tuile="messages"]', { timeout: 15000 });
  // (31 oct.) Attendre que la case ait FINI de lire (Vinted lu : `data-n` posé),
  //  pas seulement un délai : sur une machine chargée, 3,5 s ne suffisaient pas
  //  et la case encore « en cours » passait pour un rouge (§6.5).
  await pg.waitForFunction(() => { const t = document.querySelector('[data-tuile="messages"]'); return t && t.getAttribute('data-n') !== ''; }, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1500);
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      { const k = await preparer(b, vp, SCEN.A);
        await essaie('A', async () => {
          await ouvrirJour(k.pg);
          const r = await lireJour(k.pg);
          dit(r.n === '4' && r.eb === '3', 'A : la case « Messages » = 1 Vinted + 3 eBay (deux comptes)', JSON.stringify(r));
          dit(r.job === '3', 'A : l\'action « messages eBay sans réponse » compte 3', String(r.job));
          dit(/boutique_pro/.test(r.jobTxt) && /perso_ju/.test(r.jobTxt), 'A : l\'action nomme les deux comptes eBay', r.jobTxt.replace(/\s+/g, ' ').slice(0, 120));
          dit(!k.appelsEbay.includes('messages'), 'A : aucun appel « messages » à eBay à l\'ouverture (le résumé rangé suffit)', JSON.stringify(k.appelsEbay));
          await k.pg.screenshot({ path: path.join(os.tmpdir(), 'ebay-msg-jour-' + vp.width + '.png'), fullPage: true }).catch(() => {});
          await sain(k.pg, 'A');
        });
        dit(k.errs.length === 0, 'A : aucune erreur de page', k.errs.join(' | ').slice(0, 200)); await k.ctx.close(); }
      { const k = await preparer(b, vp, SCEN.B);
        await essaie('B', async () => {
          await ouvrirJour(k.pg);
          const r = await lireJour(k.pg);
          dit(r.n === '2' && r.eb === '2' && r.job === '2', 'B : un compte, 2 messages eBay (case et action)', JSON.stringify(r));
          dit(/au moins/i.test(r.jobTxt), 'B : résumé incomplet ⇒ « au moins »', r.jobTxt.replace(/\s+/g, ' ').slice(0, 100));
          await k.pg.click('[data-tuile="messages"]');
          const ok = await k.pg.waitForFunction(() => /Messages eBay/.test(document.body.innerText), null, { timeout: 10000 }).then(() => true).catch(() => false);
          dit(ok, 'B : la case mène à eBay → Messages (Vinted n\'a rien)');
          await sain(k.pg, 'B');
        });
        dit(k.errs.length === 0, 'B : aucune erreur de page', k.errs.join(' | ').slice(0, 200)); await k.ctx.close(); }
      { const k = await preparer(b, vp, SCEN.C, { msgKO: true });
        await essaie('C', async () => {
          await ouvrirJour(k.pg);
          const r = await lireJour(k.pg);
          dit(r.eb === 'passu' && r.n === '1', 'C : résumé illisible ⇒ « pas su », la case ne compte que Vinted (aucun « 0 » eBay)', JSON.stringify(r));
          dit(r.passu === 1 && r.job === null, 'C : la panne est dite UNE fois, aucune action eBay', JSON.stringify(r));
          await sain(k.pg, 'C');
        });
        dit(k.errs.length === 0, 'C : aucune erreur de page', k.errs.join(' | ').slice(0, 200)); await k.ctx.close(); }
      { const k = await preparer(b, vp, SCEN.D);
        await essaie('D', async () => {
          await ouvrirJour(k.pg);
          const r = await lireJour(k.pg);
          dit(r.n === '1' && r.eb === null && r.passu === 0 && r.job === null, 'D : aucun résumé rangé ⇒ rien d\'eBay', JSON.stringify(r));
        });
        await k.ctx.close(); }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ messages eBay dans Ma journée : ${ko} rouge(s)` : '\n✅ messages eBay dans Ma journée : tout est vert');
  process.exit(ko ? 1 : 0);
})();
