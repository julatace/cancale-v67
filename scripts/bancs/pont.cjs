// Banc : « C'EST L'APPLICATION QUI CONTRÔLE L'EXTENSION » (Julien, 2 octobre).
//
// À côté de chaque vente à expédier, « Générer le bordereau » COMMANDE
// l'extension. Elle doit être allumée ; sinon les boutons restent VISIBLES mais
// grisés, avec la raison — dite UNE fois quand elle est commune (§7).
// Le banc rejoue le VRAI dialogue du pont (postMessage `ready` / `etat` / `cmd`
// / `evt`) — la seule façon de rendre ces états sans Chrome — sur des ventes
// INVENTÉES (il vit dans le dépôt, qui est public). Cinq situations :
//   · ABSENTE  : aucun pont → tout grisé, une raison commune, aucun bouton actif ;
//   · MUETTE   : le pont dit « ready » mais ne répond plus (extension rechargée)
//                → grisé « ne répond pas », jamais « prêt » ;
//   · BON COMPTE : la vente de CE compte est active ; celle de l'autre compte
//                est grisée et la raison NOMME les deux comptes ;
//                un clic → accusé → l'extension prévient « fait » → le bouton
//                devient l'impression, sans recharger la page ;
//   · TÉLÉPHONE : rien d'actif, « depuis ton ordinateur » ;
//   · et l'AUTRE SENS : « tout griser » passerait tous les contrôles ci-dessus —
//     le cas bon compte exige un bouton ACTIF et un aboutissement.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4336;

const auj = new Date();
const vente = (id, titre, statut) => ({ transaction_id: id, title: titre, price: { amount: '60', currency_code: 'EUR' }, status: statut, date: new Date(auj.getTime() - 3600e3).toISOString() });
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: auj.toISOString() },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: auj.toISOString() },
];
const rows = [
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: [vente(7001, 'Paire test A', 'Le paiement a été validé')] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: [vente(7002, 'Paire test B', 'Le paiement a été validé')] } } },
];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
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

// Le pont simulé, injecté AVANT l'app. `mode` : absente · muette · ok ; `connecte` : uid du cookie Vinted.
const PONT = ({ mode, connecte }) => {
  if (mode === 'absente') return;
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: '5.129.0' });
    if (mode === 'muette') return;                       // orphelin : plus rien derrière
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: '5.129.0', vrm: { ok: true, connecte: true, email: '' },
      vinted: connecte ? { uid: connecte, login: connecte === '111' ? 'compte_a' : 'compte_b' } : null, cmds: {} } });
    if (d.__vmr === 'cmd' && d.cmd === 'ventes') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
    if (d.__vmr === 'cmd' && d.cmd === 'bordereau') {
      const jobId = `bord:${d.uid}:${d.tx}`;
      if (String(d.uid) !== String(connecte)) { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'vinted-autre', actifLogin: 'x' } }); return; }
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, jobId, etape: 'file' } });
      window.__cmdRecu && window.__cmdRecu(String(d.tx));
      setTimeout(() => post({ __vmr: 'evt', evt: { type: 'cmd', jobId, etape: 'generation', at: Date.now() } }), 300);
      setTimeout(() => {
        post({ __vmr: 'evt', evt: { type: 'cmd', jobId, etape: 'fait', at: Date.now() } });
        post({ __vmr: 'evt', evt: { type: 'maj', quoi: 'label', uid: String(d.uid), tx: String(d.tx) } });
      }, 900);
    }
  });
  post({ __vmr: 'ready', version: '5.129.0' });
};

async function rendre(b, { mode, connecte, tel = false }) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  let labelPret = false; const cmds = [];
  await pg.exposeFunction('__cmdRecu', (tx) => { cmds.push(tx); setTimeout(() => { labelPret = true; }, 600); });
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.addInitScript(PONT, { mode, connecte });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(route.request().url());
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    // Les bordereaux captés : vides tant que l'extension n'a pas « rangé » le PDF.
    if (/id=like\.harvest_111_label_/.test(u)) return j(labelPret ? [{ id: 'harvest_111_label_7001', tx: '7001', item: '', capturedAt: auj.toISOString() }] : []);
    if (/id=eq\.harvest_111_label_7001/.test(u)) return j([{ pdfB64: PDF_B64 }]);
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(mode === 'muette' ? 6500 : 3500);
  const lire = () => pg.evaluate(() => ({
    boutons: [...document.querySelectorAll('[data-bouton-bord]')].map((x) => ({ etat: x.getAttribute('data-bouton-bord'), tx: x.getAttribute('data-tx'), txt: x.innerText })),
    raisons: [...document.querySelectorAll('[data-raison-bord]')].map((x) => x.getAttribute('data-raison-bord') + ' | ' + x.innerText),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  }));
  return { ctx, pg, errs, lire, cmds };
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

    console.log('── extension ABSENTE (autre navigateur)');
    { const r = await rendre(b, { mode: 'absente' }); const v = await r.lire();
      dit(v.boutons.length === 2 && v.boutons.every((x) => x.etat === 'grise'), 'les deux ventes gardent leur bouton, GRISÉ (on voit l’action)', JSON.stringify(v.boutons.map((x) => x.etat)));
      dit(v.raisons.length === 1 && /^absente/.test(v.raisons[0]), 'la raison est dite UNE fois, au-dessus de la liste', JSON.stringify(v.raisons));
      dit(v.boutons.every((x) => !/détectée/.test(x.txt)), 'et elle n’est pas répétée sous chaque vente (§7)', JSON.stringify(v.boutons.map((x) => x.txt)));
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 120));
      await r.ctx.close(); }

    console.log('── extension MUETTE (rechargée, le pont ne répond plus)');
    { const r = await rendre(b, { mode: 'muette' }); const v = await r.lire();
      dit(v.boutons.length === 2 && v.boutons.every((x) => x.etat === 'grise'), 'rien d’actif : présente n’est pas allumée', JSON.stringify(v.boutons.map((x) => x.etat)));
      dit(v.raisons.length === 1 && /^muette/.test(v.raisons[0]), 'la raison dit qu’elle ne répond pas, et quoi faire', JSON.stringify(v.raisons));
      await r.ctx.close(); }

    console.log('── extension ALLUMÉE, Chrome connecté sur compte_a');
    { const r = await rendre(b, { mode: 'ok', connecte: '111' }); let v = await r.lire();
      const a = v.boutons.find((x) => x.tx === '7001'), bb = v.boutons.find((x) => x.tx === '7002');
      dit(a && a.etat === 'pret' && /Générer le bordereau/.test(a.txt), 'autre sens : la vente de compte_a a un bouton ACTIF « Générer le bordereau »', JSON.stringify(a));
      dit(bb && bb.etat === 'grise' && /compte_a/.test(bb.txt) && /compte_b/.test(bb.txt), 'la vente de compte_b est grisée, et la raison NOMME les deux comptes', JSON.stringify(bb));
      dit(v.raisons.length === 0, 'aucune raison commune : l’extension va bien', JSON.stringify(v.raisons));
      await r.pg.click('[data-bouton-bord="pret"][data-tx="7001"] button');
      await r.pg.waitForTimeout(400);
      v = await r.lire();
      const pendant = v.boutons.find((x) => x.tx === '7001');
      dit(r.cmds.includes('7001'), 'le clic COMMANDE l’extension (cmd bordereau, transaction 7001)', JSON.stringify(r.cmds));
      dit(pendant && pendant.etat === 'encours', 'pendant le travail, le bouton dit l’étape', JSON.stringify(pendant));
      await r.pg.waitForTimeout(2500);
      v = await r.lire();
      const apres = v.boutons.find((x) => x.tx === '7001');
      dit(apres && apres.etat === 'pdf', '« fait » → le bouton devient l’impression, sans recharger la page', JSON.stringify(apres));
      dit(v.sw <= v.cw + 1, 'aucun débordement horizontal', `${v.sw} > ${v.cw}`);
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 120));
      await r.pg.screenshot({ path: path.join(require('os').tmpdir(), 'pont-1512.png') });
      await r.ctx.close(); }

    console.log('── TÉLÉPHONE');
    { const r = await rendre(b, { mode: 'ok', connecte: '111', tel: true }); const v = await r.lire();
      dit(!v.boutons.some((x) => x.etat === 'pret'), 'aucun bouton actif sur un téléphone', JSON.stringify(v.boutons.map((x) => x.etat)));
      dit(v.raisons.length === 1 && /^telephone/.test(v.raisons[0]), 'une raison : « depuis ton ordinateur »', JSON.stringify(v.raisons));
      dit(v.sw <= v.cw + 1, 'aucun débordement horizontal', `${v.sw} > ${v.cw}`);
      await r.pg.screenshot({ path: path.join(require('os').tmpdir(), 'pont-390.png') });
      await r.ctx.close(); }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ pont : ${ko} rouge(s)` : '\n✅ pont : tout est vert');
  process.exit(ko ? 1 : 0);
})();
