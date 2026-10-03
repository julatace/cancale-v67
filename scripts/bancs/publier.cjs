// Banc : « PUBLIER SUR LEBONCOIN » DEPUIS L'APP (5.130).
//
// Julien, 2 octobre : « c'est l'application qui contrôle l'extension ; il faut
// que l'extension soit allumée, sinon floute les boutons ». Les panneaux sur
// leboncoin.fr sont retirés : le bouton vit sur l'écran « À publier » de l'app.
// Sur des données INVENTÉES (il vit dans le dépôt), il rend l'écran avec le
// VRAI dialogue du pont dans trois situations et exige :
//   · extension à jour : chaque paire a son bouton, le clic envoie `lbcPublier`
//     avec l'IDENTIFIANT seul (jamais un titre ni un prix), et le bouton suit
//     l'étape que l'extension renvoie ;
//   · extension trop ancienne / absente : bouton GRISÉ, jamais caché, et la
//     raison dite UNE fois au-dessus de la liste (§7) ;
//   · plus de lien orange « Déposer une annonce » au bas de l'écran (§7 : un
//     seul accent) ;
//   · la paire sans photo n'a pas de bouton (Leboncoin la refuserait).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4337;
const auj = new Date().toISOString();
const MAIN = { vinted_annonce_numeros: { '7001': { numero: '41', title: 'Salomon XT-6 blanc taille 40' }, '7002': { numero: '42', title: 'Autry blanc taille 36' } } };
const LISTINGS = { payload: { items: [
  { id: 7001, title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', size_title: '40', price: { amount: '99.0' }, photo: { url: 'https://img.test/a.jpg' }, nPhotos: 2 },
  { id: 7002, title: 'Autry blanc taille 36', brand_title: 'Autry', size_title: '36', price: { amount: '24.0' }, nPhotos: 0 },
] }, capturedAt: auj };
const DETAILS = { '7001': { photos: ['https://img.test/a.jpg', 'https://img.test/b.jpg'], description: 'Très bon état, portées deux fois.' } };
const rows = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: LISTINGS },
  { id: 'vinted_item_details', data: DETAILS },
  { id: 'vinted_lbc_posted', data: { ids: [] } },
];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj }];
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
// Le pont simulé : `version` annoncée, et ce que répond la commande.
const PONT = ({ mode, version }) => {
  window.__cmds = [];
  if (mode === 'absente') return;
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {} } });
    if (d.__vmr === 'cmd') {
      window.__cmds.push(Object.keys(d).filter((k) => !['__vmr', 'reqId'].includes(k)).sort().join(',') + '=' + d.cmd + ':' + d.id);
      const jobId = 'lbc:' + d.id;
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, jobId, etape: 'depot' } });
      setTimeout(() => post({ __vmr: 'evt', evt: { type: 'cmd', jobId, etape: 'fait', at: Date.now() } }), 400);
    }
  });
  post({ __vmr: 'ready', version });
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const cas of [{ mode: 'ok', version: '5.130.0' }, { mode: 'ok', version: '5.129.0' }, { mode: 'absente' }]) {
      const nom = cas.mode === 'absente' ? 'extension absente' : 'extension ' + cas.version;
      console.log('── ' + nom);
      const ctx = await b.newContext({ viewport: { width: 1512, height: 950 } });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
      await pg.addInitScript(PONT, cas);
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
      await pg.route('**/rest/v1/**', (route) => {
        const u = decodeURIComponent(metaVersData(route.request().url()));
        const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
        if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
        if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
        const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
        const eq = /id=eq\.([^&]*)/.exec(u);
        if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
        const lk = /id=like\.([^&]*)/.exec(u);
        if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
        return j([]);
      });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
      await pg.goto(`http://localhost:${PORT}/?tab=leboncoin`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(3500);
      const lire = () => pg.evaluate(() => ({
        boutons: [...document.querySelectorAll('[data-bouton-publier]')].map((e) => ({ id: e.getAttribute('data-id'), etat: e.getAttribute('data-bouton-publier'), txt: e.innerText })),
        raisons: document.querySelectorAll('[data-raison-publier]').length,
        orange: [...document.querySelectorAll('a')].some((a) => /Déposer une annonce/.test(a.innerText)),
        texte: document.body.innerText,
      }));
      const v = await lire();
      dit(!errs.length, 'aucune erreur', errs[0]);
      dit(v.boutons.length === 1 && v.boutons[0].id === '7001', 'la paire avec photos a SON bouton, la paire sans photo n\'en a pas', JSON.stringify(v.boutons.map((x) => x.id)));
      dit(!v.orange, 'plus de lien orange « Déposer une annonce » au bas de l\'écran');
      if (cas.version === '5.130.0') {
        dit(v.boutons[0] && v.boutons[0].etat === 'pret', 'extension à jour : le bouton est actif', v.boutons[0] && v.boutons[0].etat);
        dit(v.raisons === 0, 'et aucune raison de blocage affichée');
        await pg.click('[data-bouton-publier="pret"] button');
        await pg.waitForTimeout(900);
        const cmds = await pg.evaluate(() => window.__cmds);
        dit(cmds.length === 1 && cmds[0] === 'cmd,id=lbcPublier:7001', 'le clic commande `lbcPublier` avec l\'identifiant SEUL', JSON.stringify(cmds));
        const apres = await lire();
        dit(apres.boutons[0] && apres.boutons[0].etat === 'fait' && /Publiée/.test(apres.boutons[0].txt), 'et le bouton suit ce que l\'extension renvoie (« Publiée »)', JSON.stringify(apres.boutons[0]));
        await pg.screenshot({ path: path.join(require('os').tmpdir(), 'publier-ok.png') });
      } else {
        dit(v.boutons[0] && v.boutons[0].etat === 'grise', `${nom} : le bouton est GRISÉ, jamais caché`, v.boutons[0] && v.boutons[0].etat);
        dit(v.raisons === 1, 'et la raison est dite UNE fois au-dessus de la liste (§7)', v.raisons + ' fois');
        await pg.click('[data-bouton-publier] button', { force: true });
        await pg.waitForTimeout(400);
        dit((await pg.evaluate(() => window.__cmds.length)) === 0, 'cliquer un bouton grisé n\'envoie rien');
        await pg.screenshot({ path: path.join(require('os').tmpdir(), 'publier-' + cas.mode + (cas.version || '') + '.png') });
      }
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e.message).slice(0, 160)); }
  if (b) await b.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} publier : ${ko ? ko + ' rouge(s)' : 'tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
