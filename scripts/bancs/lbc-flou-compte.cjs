// Banc : LEBONCOIN — LE COMPTE OUVERT MIS EN AVANT, LES AUTRES ESTOMPÉS (31 oct.)
//
// Julien : « pareil pour leboncoin et vestiaire je veux que comme pour vinted les
// données des comptes ouvert soit mis en avant si un compte est ouvert, les
// autres sont floutees comme pour vinted ».
// Données INVENTÉES (le dépôt est public) : deux comptes Leboncoin à lui —
// `Compte_A` (session vue par l'extension il y a 10 min) et `Compte_B` (session
// vue il y a 3 jours) —, une annonce, une vente, un achat et un compteur de
// messages pour chacun. 390 px tactile et 1512 px.
// Il exige, en jugeant `data-flou` ET le style calculé (jamais un libellé) :
//   1. extension de ce navigateur connectée, A ouvert : sur Annonces, Ventes,
//      Achats, Messages (conversations) et Favoris reçus, la ligne de A est
//      nette, celle de B estompée (flou) — rien n'est caché, les deux sont là ;
//   2. sans extension (lecture seule) : rien n'est flouté ;
//   3. session de A vue il y a 20 h (trop ancienne pour dire « ouvert ») : rien
//      n'est flouté — « pas su » ne floute pas ;
//   4. aucune erreur, aucun débordement.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 8571;

const maintenant = Date.now();
const ilYaH = (h) => new Date(maintenant - h * 3600e3).toISOString();
const A = 'aaaa1111-0000-4000-8000-00000000000a';
const B = 'bbbb2222-0000-4000-8000-00000000000b';
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const lignes = (sessionA) => {
  const ITEMS = {
    '4100000001': { id: '4100000001', subject: 'Annonce du compte A', price: 60, ref: '21', account: A, accountName: 'Compte_A', platform: 'leboncoin', status: 'active', seenAt: ilYaH(0.1), images: [], stats: { favoris: 3, at: ilYaH(1) } },
    '4100000002': { id: '4100000002', subject: 'Annonce du compte B', price: 70, ref: '22', account: 'lbc-account:' + B, accountName: 'Compte_B', platform: 'leboncoin', status: 'active', seenAt: ilYaH(0.1), images: [], stats: { favoris: 5, at: ilYaH(1) } },
  };
  const VENTES = {
    TA: { txId: 'TA', itemId: '4100000091', isSeller: true, account: A, title: 'Vente du compte A', price: 5000, stepStatus: 'paid', stepLabel: 'Paiement effectué', dateVente: ilYaH(30), at: ilYaH(30) },
    TB: { txId: 'TB', itemId: '4100000092', isSeller: true, account: 'lbc-account:' + B, title: 'Vente du compte B', price: 6000, stepStatus: 'paid', stepLabel: 'Paiement effectué', dateVente: ilYaH(40), at: ilYaH(40) },
    AA: { txId: 'AA', itemId: '4100000081', isSeller: false, account: A, title: 'Achat du compte A', price: 3000, stepStatus: 'paid', stepLabel: 'Paiement effectué', dateVente: ilYaH(50), at: ilYaH(50) },
    AB: { txId: 'AB', itemId: '4100000082', isSeller: false, account: B, title: 'Achat du compte B', price: 3500, stepStatus: 'paid', stepLabel: 'Paiement effectué', dateVente: ilYaH(60), at: ilYaH(60) },
  };
  return [
    { id: 'main', data: { vinted_annonce_numeros: {} } },
    { id: 'lbc_listings', data: { items: ITEMS, lectures: { [A]: { at: ilYaH(0.1), total: 1, n: 1 }, [B]: { at: ilYaH(0.1), total: 1, n: 1 } } } },
    { id: 'lbc_accounts', data: { accounts: {
      [A]: { id: A, name: 'Compte_A', type: 'particulier', seenAt: ilYaH(sessionA), sessionAt: ilYaH(sessionA), source: 'session:messagerie' },
      ['lbc-account:' + B]: { id: 'lbc-account:' + B, name: 'Compte_B', type: 'pro', seenAt: ilYaH(72), sessionAt: ilYaH(72), source: 'https://api.leboncoin.fr/api/account/v1/members/me/account', preuveCompte: 'membre-prive-v1' },
    } } },
    { id: 'lbc_ventes', data: { ventes: VENTES } },
    { id: 'lbc_messages', data: { compteurs: { [A]: { unread: 2, at: ilYaH(0.2) }, [B]: { unread: 4, at: ilYaH(0.2) } }, comptes: { [A]: { name: 'Compte_A', pro: false, at: ilYaH(0.2) }, [B]: { name: 'Compte_B', pro: true, at: ilYaH(0.2) } } } },
  ];
};

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
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
    out[alias] = v == null ? null : v;
  }
  return out;
};
// Le pont : une extension à jour, connectée à CE compte VRM (la session de banc
// de `_porte-banc.cjs`), aucun compte Vinted ouvert (le flou Leboncoin ne doit
// pas dépendre de Vinted).
const PONT = () => {
  const version = '5.291.0';
  const post = (m) => window.postMessage(m, '*');
  const vrm = { ok: true, connecte: true, expiree: false, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', cloisonne: false };
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'authEtat') post({ __vmr: 'authEtat:result', reqId: d.reqId, etat: vrm });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: 'ext-banc', vrm, vinted: null, cmds: {}, lbcPause: true, lbcSupprime: true } });
    if (d.__vmr === 'cmd') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'banc' } });
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};

async function ouvrir(b, vp, { ext = true, sessionA = 10 / 60 } = {}, url = '?tab=plat_leboncoin') {
  const rows = lignes(sessionA);
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  if (ext) await pg.addInitScript(PONT);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: ilYaH(0), cap: (r.data || {}).capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/${url}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-market-space', { timeout: 15000 }).catch(() => {});
  return { ctx, pg, errs };
}
// Le flou d'une ligne : son `data-flou` ET son style calculé (le flou se voit).
const etatLigne = (pg, sel) => pg.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const cs = getComputedStyle(e);
  return { attr: e.getAttribute('data-flou'), flou: /blur/.test(cs.filter), op: Number(cs.opacity) };
}, sel);
const net = (x) => !!(x && x.attr === '0' && !x.flou && x.op > 0.9);
const floue = (x) => !!(x && x.attr === '1' && x.flou && x.op < 0.6);
const deborde = (pg) => pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
const section = async (pg, k, attendre) => {
  await pg.click(`[data-section="${k}"]`).catch(() => {});
  await pg.waitForSelector(attendre, { timeout: 12000 }).catch(() => {});
  await pg.waitForTimeout(700);   // la lecture du compte ouvert (lbc_accounts) arrive à côté
};
const SECTIONS = [
  ['annonces', 'Annonces', '[data-lbc-catalog-id="4100000001"]', '[data-lbc-catalog-id="4100000002"]'],
  ['ventes', 'Ventes', '[data-lbc-vente="TA"]', '[data-lbc-vente="TB"]'],
  ['achats', 'Achats', '[data-lbc-achat="AA"]', '[data-lbc-achat="AB"]'],
  ['messages', 'Messages', `[data-compte-lbc="${A}"]`, `[data-compte-lbc="${B}"]`],
];

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px · extension connectée, Compte_A ouvert sur leboncoin.fr (il y a 10 min)`);
      const o = await ouvrir(b, vp);
      for (const [k, nom, selA, selB] of SECTIONS) {
        await section(o.pg, k, selB);
        const a = await etatLigne(o.pg, selA), bb = await etatLigne(o.pg, selB);
        dit(net(a) && floue(bb), `${nom} : la ligne de Compte_A est nette, celle de Compte_B est là mais estompée`, JSON.stringify({ a, b: bb }));
        if (k === 'ventes' || k === 'annonces') await o.pg.screenshot({ path: path.join(os.tmpdir(), `lbc-flou-${k}-${vp.width}.png`), fullPage: true }).catch(() => {});
      }
      await o.pg.click('[data-lbc-zone-favoris]').catch(() => {});
      await o.pg.waitForSelector('[data-favoris-lbc-annonce="4100000002"]', { timeout: 10000 }).catch(() => {});
      await o.pg.waitForTimeout(500);
      const fa = await etatLigne(o.pg, '[data-favoris-lbc-annonce="4100000001"]'), fb = await etatLigne(o.pg, '[data-favoris-lbc-annonce="4100000002"]');
      dit(net(fa) && floue(fb), 'Favoris reçus : l’annonce de Compte_A est nette, celle de Compte_B estompée', JSON.stringify({ a: fa, b: fb }));
      await o.pg.screenshot({ path: path.join(os.tmpdir(), `lbc-flou-favoris-${vp.width}.png`), fullPage: true }).catch(() => {});
      const d = await deborde(o.pg);
      dit(d.sw <= d.cw + 1, 'aucun débordement', `${d.sw}/${d.cw}`);
      dit(o.errs.length === 0, 'aucune erreur d’app', o.errs.join(' | ').slice(0, 160));
      await o.ctx.close();
    }

    for (const [titre, opts] of [['sans extension dans ce navigateur (lecture seule)', { ext: false }], ['session de Compte_A vue il y a 20 h (trop ancienne : pas « ouvert »)', { sessionA: 20 }]]) {
      console.log(`── 390 px · ${titre}`);
      const o = await ouvrir(b, { width: 390, height: 844 }, opts);
      for (const [k, nom, selA, selB] of SECTIONS) {
        await section(o.pg, k, selB);
        const a = await etatLigne(o.pg, selA), bb = await etatLigne(o.pg, selB);
        dit(net(a) && net(bb), `${nom} : rien n’est flouté`, JSON.stringify({ a, b: bb }));
      }
      dit(o.errs.length === 0, 'aucune erreur d’app', o.errs.join(' | ').slice(0, 160));
      await o.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ Leboncoin, flou par compte : ${ko} rouge(s)` : '\n✅ Leboncoin, flou par compte : tout est vert');
  process.exit(ko ? 1 : 0);
})();
