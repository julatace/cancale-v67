// Banc : « PRÉPARER SUR VESTIAIRE » DEPUIS L'APP (5.235, 27 octobre).
// Julien : « je veux pouvoir le faire sur VRM directement, pouvoir publier ».
// Données INVENTÉES, le VRAI dialogue du pont, l'écran Vestiaire Collective :
//   · extension à jour : chaque paire en ligne et numérotée a « Préparer sur
//     Vestiaire » ; le clic envoie `vcPreparer` avec l'IDENTIFIANT seul ;
//   · « Déjà publiée » : confirmée, envoie `vcMarque`, la paire sort de la liste
//     (la liste des publiées est relue) ; Annuler n'envoie rien ;
//   · une paire déjà notée publiée n'est pas proposée ;
//   · extension trop ancienne / absente : la raison dite, le clic n'envoie rien ;
//   · l'écran ne dit plus « pas encore reliée ».
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4797;
const auj = new Date().toISOString();
const MAIN = { vinted_annonce_numeros: { '7001': { numero: '41', title: 'Salomon XT-6 blanc taille 40' }, '7002': { numero: '42', title: 'Autry blanc taille 36' }, '7003': { numero: '43', title: 'Nike Air Max 1' } } };
const LISTINGS = { payload: { items: [
  { id: 7001, title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', size_title: '40', price: { amount: '99.0' }, photo: { url: 'https://img.test/a.jpg' }, nPhotos: 5 },
  { id: 7002, title: 'Autry blanc taille 36', brand_title: 'Autry', size_title: '36', price: { amount: '24.0' }, nPhotos: 0 },
  { id: 7003, title: 'Nike Air Max 1', brand_title: 'Nike', size_title: '42', price: { amount: '60.0' }, nPhotos: 3 },
] }, capturedAt: auj };
const DETAILS = { '7001': { photos: ['https://img.test/a.jpg', 'https://img.test/b.jpg'], description: 'Très bon état, portées deux fois.' } };
const rows = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: LISTINGS },
  { id: 'vinted_item_details', data: DETAILS },
  { id: 'vinted_vc_posted', data: { ids: ['7003'] } },
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
const SEUIL_PUBLIER = (/vcpublier:\s*'([^']+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.160.0';
// Le pont simulé : `version` annoncée, et ce que répond la commande.
const PONT = ({ mode, version, suite = 'fait' }) => {
  window.__cmds = [];
  if (mode === 'absente') return;
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {} } });
    if (d.__vmr === 'cmd') {
      window.__cmds.push(Object.keys(d).filter((k) => !['__vmr', 'reqId'].includes(k)).sort().join(',') + '=' + d.cmd + ':' + d.id);
      const jobId = (d.cmd === 'vcMarque' ? 'm:' : 'vc:') + d.id;
      // `suite` : ce que fait l'extension ensuite — `fait` (publiée), `abandon`
      // (l'onglet du dépôt fermé avant la fin), `rien` (le dépôt reste ouvert),
      // `refus` (l'extension refuse, avec sa raison).
      if (suite === 'refus') { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'inconnue', raison: 'Cette paire n’est plus dans la file (vendue ou décochée).' } }); return; }
      // `confirmer` (revue du 11 octobre) : l'extension découvre au clic que le
      // dépôt précédent est abandonné (onglet parti ailleurs) et exige SA
      // confirmation — il a pu le finir à la main.
      if (suite === 'confirmer' && !d.confirme) { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'confirmer', jobId, etape: 'abandonne', raison: 'VRM n’a pas vu la fin du dépôt précédent' } }); return; }
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, jobId, etape: 'depot' } });
      if (suite === 'fait') setTimeout(() => post({ __vmr: 'evt', evt: { type: 'cmd', jobId, etape: 'fait', at: Date.now() } }), 400);
      if (suite === 'abandon' && window.__cmds.length === 1) setTimeout(() => post({ __vmr: 'evt', evt: { type: 'cmd', jobId, etape: 'abandonne', raison: 'onglet-ferme', at: Date.now() } }), 400);
    }
  });
  post({ __vmr: 'ready', version });
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const cas of [{ mode: 'ok', version: SEUIL_PUBLIER, w: 1512 }, { mode: 'ok', version: SEUIL_PUBLIER, w: 390 }, { mode: 'ok', version: '5.234.0', w: 1512 }, { mode: 'absente', w: 1512 }]) {
      const nom = (cas.mode === 'absente' ? 'extension absente' : 'extension ' + cas.version) + ' · ' + cas.w + ' px';
      console.log('── ' + nom);
      const ctx = await b.newContext({ viewport: { width: cas.w, height: 900 } });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
      await pg.addInitScript(PONT, { mode: cas.mode, version: cas.version, suite: 'rien' });
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
      await pg.goto(`http://localhost:${PORT}/?tab=plat_vestiaire`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-vc-publier]', { timeout: 15000 }).catch(() => {});
      await pg.waitForSelector('[data-vc-publier="lu"]', { timeout: 15000 }).catch(() => {});
      const v = await pg.evaluate(() => ({ etat: (document.querySelector('[data-vc-publier]') || {}).getAttribute ? document.querySelector('[data-vc-publier]').getAttribute('data-vc-publier') : null,
        paires: [...document.querySelectorAll('[data-vc-paire]')].map((e) => e.getAttribute('data-vc-paire')),
        raison: (document.querySelector('[data-vc-raison]') || {}).innerText || '', texte: document.body.innerText,
        large: document.documentElement.scrollWidth > window.innerWidth + 1 }));
      dit(!errs.length, 'aucune erreur', errs[0]);
      dit(v.etat === 'lu', 'la liste des paires est lue', v.etat);
      dit(v.paires.includes('7001') && v.paires.includes('7002') && !v.paires.includes('7003'), 'les paires en ligne et numérotées sont proposées, sauf celle déjà notée publiée', JSON.stringify(v.paires));
      dit(!/pas encore reliée/.test(v.texte), 'l\'écran ne dit plus « pas encore reliée »');
      dit(!v.large, 'aucun débordement horizontal');
      if (cas.version === SEUIL_PUBLIER) {
        dit(!v.raison, 'extension à jour : aucune raison de blocage', v.raison);
        await pg.click('[data-vc-preparer="7001"]');
        await pg.waitForFunction(() => window.__cmds && window.__cmds.length > 0, null, { timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(500);
        let cmds = await pg.evaluate(() => window.__cmds);
        dit(cmds.length === 1 && /^cmd,id(,publier)?=vcPreparer:7001$/.test(cmds[0]), 'le clic commande `vcPreparer` avec l\'identifiant seul (et le feu vert de publication), jamais un titre ni un prix', JSON.stringify(cmds));
        const t = await pg.evaluate(() => document.querySelector('[data-vc-preparer="7001"]').innerText);
        dit(/Ouvert sur Vestiaire/.test(t), 'le bouton suit l\'étape renvoyée (« Ouvert sur Vestiaire »)', t);
        await pg.click('[data-vc-marquer="7002"]');
        await pg.waitForTimeout(400);
        const ann = await pg.$('button:has-text("Annuler")');
        if (ann) { await ann.click(); await pg.waitForTimeout(300); }
        cmds = await pg.evaluate(() => window.__cmds);
        dit(!!ann && cmds.length === 1, '« Déjà publiée » DEMANDE d\'abord ; Annuler n\'envoie rien', JSON.stringify(cmds));
        rows.find((r) => r.id === 'vinted_vc_posted').data.ids = ['7003', '7002'];
        await pg.click('[data-vc-marquer="7002"]');
        await pg.waitForTimeout(400);
        await pg.click('button:has-text("Oui, elle est en ligne")');
        await pg.waitForTimeout(900);
        cmds = await pg.evaluate(() => window.__cmds);
        const apres = await pg.evaluate(() => [...document.querySelectorAll('[data-vc-paire]')].map((e) => e.getAttribute('data-vc-paire')));
        dit(cmds.length === 2 && cmds[1] === 'cmd,etat,id=vcMarque:7002', 'confirmé : `vcMarque` part avec l\'identifiant', JSON.stringify(cmds));
        dit(!apres.includes('7002'), 'et la paire sort de la liste', JSON.stringify(apres));
        rows.find((r) => r.id === 'vinted_vc_posted').data.ids = ['7003'];
        await pg.screenshot({ path: path.join(require('os').tmpdir(), 'vc-publier-' + cas.w + '.png'), fullPage: true });
      } else {
        dit(/Mets l'extension à jour|pas détectée/.test(v.raison), nom + ' : la raison est dite', v.raison);
        await pg.click('[data-vc-preparer="7001"]', { force: true });
        await pg.waitForTimeout(400);
        dit((await pg.evaluate(() => window.__cmds ? window.__cmds.length : 0)) === 0, 'le clic n\'envoie rien');
      }
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e.message).slice(0, 160)); }
  if (b) await b.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} vc-publier : ${ko ? ko + ' rouge(s)' : 'tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
