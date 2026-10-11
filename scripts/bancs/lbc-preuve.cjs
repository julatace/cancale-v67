// Banc : LA FILE LEBONCOIN, LA MÊME DES DEUX CÔTÉS (revue du 11 octobre, §11).
//   BANC_PORT=4913 node scripts/bancs/lbc-preuve.cjs
//
// L'écran Leboncoin de l'APP gardait sa propre boucle sur les seules
// transactions ; la file de l'EXTENSION (`buildLbcData`) prouve aussi une vente
// par son BORDEREAU. Une paire vendue (bordereau seul, le cas de la N°553)
// sortait donc de la file de l'extension et restait « à publier » dans l'app —
// et « Publier sur Leboncoin » depuis l'app était refusé par l'extension, qui
// relit SA file.
//
// Données INVENTÉES (il vit dans le dépôt, public). On EXÉCUTE les deux côtés
// sur la MÊME base : le vrai `buildLbcData` (background.js dans un vm) et l'app
// RENDUE (dist/, Chromium) — et on exige la même file :
//   A. bordereau seul (vente vivante) ⇒ la paire sort des DEUX files ;
//   B. transaction figée « Le paiement a été validé » + vente remboursée ⇒ la
//      paire est revenue : elle reste dans les DEUX files ;
//   C. l'autre sens : rien de vendu ⇒ les deux paires dans les deux files.
// On juge les N° proposés (texte « N°12 · ») et le nombre « à publier », jamais
// une formulation seule.
const path = require('path'), fs = require('fs'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const { faireFond, projette } = require(path.join(RACINE, 'scripts/_fond-vm.cjs'));
const { metaVersData } = require('./_meta.cjs');
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4913;

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 160)); return null; } };

const auj = new Date();
const iso = (dj) => new Date(Date.now() + dj * 86400000).toISOString();
const annonce = (id, titre, prix) => ({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, brand_title: titre.split(' ')[0], size_title: (/taille (\d+)/.exec(titre) || [])[1] || '', is_closed: false, is_hidden: false, is_draft: false, photo: { url: 'https://img.test/v' + id + '.jpg' } });
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const MAIN = {
  vinted_annonce_numeros: {
    '5001': { numero: '12', title: 'Nike Air Max 1 olive taille 42', mp: { lbc: true } },
    '5002': { numero: '13', title: 'Salomon XT-6 blanc taille 40', mp: { lbc: true } },
  },
  vinted_accounts: [{ vinted_user_id: '111', login: 'compte_test' }],
};
const base = (cas) => {
  const l = {
    main: MAIN,
    harvest_111_listings: { uid: '111', capturedAt: iso(0), payload: { items: [annonce(5001, 'Nike Air Max 1 olive taille 42', 80), annonce(5002, 'Salomon XT-6 blanc taille 40', 99)] } },
  };
  if (cas === 'A') {
    l.harvest_111_orders_sold = { uid: '111', capturedAt: iso(0), payload: { my_orders: [{ transaction_id: 7000000802, status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: iso(-1), title: 'Salomon XT-6 blanc taille 40' }] } };
    l.harvest_111_label_7000000802 = { uid: '111', tx: '7000000802', item: '5002', capturedAt: iso(0) };
  }
  if (cas === 'B') {
    l.harvest_111_orders_sold = { uid: '111', capturedAt: iso(0), payload: { my_orders: [{ transaction_id: 7000000802, status: 'Remboursement effectué', transaction_user_status: 'failed', date: iso(-3), title: 'Salomon XT-6 blanc taille 40' }] } };
    l.harvest_111_label_7000000802 = { uid: '111', tx: '7000000802', item: '5002', capturedAt: iso(-2) };
    l.harvest_111_txn_7000000802 = { type: 'transaction', uid: '111', capturedAt: iso(-2), payload: { transaction: { id: 7000000802, item_id: 5002, status: 230, status_title: 'Le paiement a été validé' } } };
  }
  if (cas === 'C') l.harvest_111_orders_sold = { uid: '111', capturedAt: iso(0), payload: { my_orders: [] } };
  return l;
};

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, res) => { let fi = q.url.split('?')[0]; if (fi === '/' || !path.extname(fi)) fi = '/index.html'; const p = path.join(DIST, fi); if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); });
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });

async function fileExtension(lignes) {
  const f = faireFond({ src: path.join(RACINE, 'vinted-sync-extension/background.js'), lignes: JSON.parse(JSON.stringify(lignes)), vinted: () => ({ status: 404, body: {} }), lectureKO: () => false, connecte: '111', comptes: ACCS, store: {} });
  const r = await f.ctx.buildLbcData();
  return (r.queue || []).map((a) => String(a.numero)).sort();
}
async function fileApp(b, lignes, vp) {
  const rows = Object.entries(lignes).map(([id, data]) => ({ id, data }));
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (rt) => (['image', 'media', 'font'].includes(rt.request().resourceType()) ? rt.abort() : rt.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (rw) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(rw, sel) : ({ ...rw, updated_at: auj.toISOString(), cap: rw.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((x) => x.id === eq[1]).map(forme));
    const dans = /id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ks = dans[1].split(','); return j(rows.filter((x) => ks.includes(x.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((x) => re.test(x.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=leboncoin`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => /à publier sur Leboncoin/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  const v = await pg.evaluate(() => ({ t: document.body.innerText, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  await ctx.close();
  const m = /(\d+) à publier sur Leboncoin/.exec(v.t);
  const nums = [...new Set((v.t.match(/N°(\d+) ·/g) || []).map((x) => /\d+/.exec(x)[0]))].sort();
  return { n: m ? Number(m[1]) : null, nums, errs, deborde: v.sw > v.cw + 1 };
}

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const ATTENDU = { A: ['12'], B: ['12', '13'], C: ['12', '13'] };
    const NOMS = { A: 'bordereau seul (vente vivante) ⇒ la N°13 est vendue', B: 'transaction figée « payée » + vente remboursée ⇒ la N°13 est revenue', C: 'rien de vendu' };
    for (const cas of ['A', 'B', 'C']) {
      console.log(`── ${cas}. ${NOMS[cas]}`);
      const ext = await essaie('extension ' + cas, () => fileExtension(base(cas)));
      dit(ext && JSON.stringify(ext) === JSON.stringify(ATTENDU[cas]), `extension (buildLbcData) : file = ${JSON.stringify(ATTENDU[cas])}`, JSON.stringify(ext));
      for (const vp of (cas === 'A' ? [{ width: 390, height: 844 }, { width: 1512, height: 950 }] : [{ width: 1512, height: 950 }])) {
        const app = await essaie('app ' + cas, () => fileApp(b, base(cas), vp));
        if (!app) continue;
        dit(JSON.stringify(app.nums) === JSON.stringify(ATTENDU[cas]) && app.n === ATTENDU[cas].length, `${vp.width} px · l'écran Leboncoin de l'app propose la MÊME file que l'extension (§11)`, `app ${JSON.stringify(app.nums)} « ${app.n} à publier » · ext ${JSON.stringify(ext)}`);
        dit(app.errs.length === 0 && !app.deborde, `${vp.width} px · aucune erreur, aucun débordement`, app.errs.join(' | ').slice(0, 140));
      }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ file Leboncoin : ${ko} rouge(s)` : '\n✅ file Leboncoin : la même preuve de vente dans l\'app et dans l\'extension');
  process.exit(ko ? 1 : 0);
})();
