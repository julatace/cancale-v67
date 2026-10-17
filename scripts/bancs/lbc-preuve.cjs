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
//   D. (revue du 11 octobre, défaut 12) le cas B face à l'extension PUBLIÉE
//      (la 5.170.0 servie par main, sans la règle de l'instantané) : elle croit
//      la N°13 encore vendue et refuse « Publier ». L'app ne propose donc pas un
//      bouton actif qui échouerait : il est grisé, la raison dite UNE fois
//      (`data-lbc-croit-vendue`) ; avec une extension à jour, rien de tout ça.
//      La file de l'extension publiée est EXÉCUTÉE (son background.js, lu dans
//      l'historique de main — `VRM_GIT` depuis une copie).
const path = require('path'), fs = require('fs'), http = require('http');
// Une extension ≥ CODE_DANS_ETAT (5.171) porte dans son état la version du CODE
// qui tourne (\`code\`) : sans lui, l'app la dit « périmée » (chantier connexion du
// 11 octobre). Le seuil est LU dans l'app, jamais recopié (§11).
const CODE_DANS_ETAT_BANC = (require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8').match(/const CODE_DANS_ETAT = '([0-9.]+)'/) || [])[1] || '5.171.0';
const auMoinsBanc = (v, s) => { const a = String(v || '').split('.').map(Number), b = String(s).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); } return true; };
const codeEtat = (v) => auMoinsBanc(v, CODE_DANS_ETAT_BANC) ? { code: v, ext: 'banc-ext' } : {};
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

// Le background.js de l'extension servie par main (la version qu'il a installée).
// ⚠️ « L'extension PUBLIÉE sans la règle de l'instantané » n'est plus celle que
// sert main : depuis la 5.172 (`capterPreuvesVente`), main sert des extensions
// qui la portent (5.181, 5.182…), et ce cas D jugeait alors une extension À JOUR
// en la croyant ancienne (rouge sur un code intact). On prend donc, dans
// l'HISTORIQUE publié (`_versions-publiees.cjs`, jamais une liste recopiée), la
// plus récente version servie SANS `capterPreuvesVente` — celle qui peut encore
// tourner chez lui et refuser « Publier ». Historique illisible ⇒ `null`, dit.
function bgPublie() {
  const { versionsPubliees, aLaFonction } = require(path.join(RACINE, 'scripts/_versions-publiees.cjs'));
  const pub = versionsPubliees({ racine: RACINE });
  if (!pub) return null;
  const c = pub.commits.find((x) => x.bg && !aLaFonction(x.bg, 'capterPreuvesVente'));
  if (!c) return null;
  const f = path.join(require('os').tmpdir(), `vrm-bg-publie-${process.pid}.js`); fs.writeFileSync(f, c.bg);
  return { f, version: c.version };
}
async function fileExtension(lignes, src) {
  const f = faireFond({ src: src || path.join(RACINE, 'vinted-sync-extension/background.js'), lignes: JSON.parse(JSON.stringify(lignes)), vinted: () => ({ status: 404, body: {} }), lectureKO: () => false, connecte: '111', comptes: ACCS, store: {} });
  const r = await f.ctx.buildLbcData();
  return (r.queue || []).map((a) => String(a.numero)).sort();
}
// Le pont simulé (le vrai dialogue `ready` / `etat`) : l'extension `version`,
// connectée à VRM, sur le compte 111.
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, ...(o.etatCode || {}), vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_test' }, cmds: {} } });
  });
  post({ __vmr: 'ready', version: o.version });
};
async function fileApp(b, lignes, vp, pont) {
  const rows = Object.entries(lignes).map(([id, data]) => ({ id, data }));
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  if (pont) await pg.addInitScript(PONT, Object.assign({}, pont, { etatCode: codeEtat(pont.version) }));
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
  if (pont) await pg.waitForFunction(() => [...document.querySelectorAll('[data-bouton-publier]')].length > 0 && ![...document.querySelectorAll('[data-bouton-publier]')].some((e) => /verif/.test(e.getAttribute('title') || '')), null, { timeout: 8000 }).catch(() => {});
  if (pont) await pg.waitForTimeout(1200);
  const v = await pg.evaluate(() => ({ t: document.body.innerText, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    boutons: Object.fromEntries([...document.querySelectorAll('[data-bouton-publier]')].map((e) => [e.getAttribute('data-id'), e.getAttribute('data-bouton-publier') + '|' + ((e.querySelector('button') || {}).title || '')])),
    croit: [...document.querySelectorAll('[data-lbc-croit-vendue]')].map((e) => e.getAttribute('data-lbc-croit-vendue')),
    // (17 oct.) La file est une grille de CARTES : chaque paire proposée porte
    // `data-apub` (son N°). Le texte « N°12 · » d'avant reste lu en repli.
    apub: [...document.querySelectorAll('[data-apub]')].map((e) => e.getAttribute('data-apub')) }));
  await ctx.close();
  const m = /(\d+) à publier sur Leboncoin/.exec(v.t);
  const nums = [...new Set([...(v.apub || []), ...(v.t.match(/N°(\d+) ·/g) || []).map((x) => /\d+/.exec(x)[0])])].sort();
  return { n: m ? Number(m[1]) : null, nums, errs, deborde: v.sw > v.cw + 1, boutons: v.boutons, croit: v.croit };
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
    // ── D. Le cas B face à l'extension PUBLIÉE (sans la règle de l'instantané).
    console.log('── D. transaction figée + vente remboursée, extension PUBLIÉE (sans la règle de l\'instantané)');
    await essaie('D', async () => {
      const pub = bgPublie();
      dit(!!pub, 'le background.js de la dernière extension publiée sans la règle de l\'instantané se lit dans l\'historique', pub ? pub.version : 'historique illisible — relance avec VRM_GIT=<dépôt>');
      if (!pub) return;
      const extPub = await fileExtension(base('B'), pub.f);
      const APP = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');
      const attendue = (/const EXT_ATTENDUE = '([^']+)'/.exec(APP) || [])[1];
      const seuil = (/preuves: '([^']+)'/.exec(APP) || [])[1];
      const avant = (a, b2) => { const A = a.split('.').map(Number), B = b2.split('.').map(Number); for (let i = 0; i < 3; i++) if ((A[i] || 0) !== (B[i] || 0)) return (A[i] || 0) < (B[i] || 0); return false; };
      dit(JSON.stringify(extPub) === '["12"]', `l'extension publiée (${pub.version}) croit la N°13 encore vendue : sa file = ["12"] — c'est elle qui refusera « Publier »`, JSON.stringify(extPub));
      dit(!!seuil && avant(pub.version, seuil), `et l'app la sait en retard pour la preuve (${pub.version} < seuil ${seuil})`, String(seuil));
      const vieille = await fileApp(b, base('B'), { width: 1512, height: 950 }, { version: pub.version });
      dit(JSON.stringify(vieille.nums) === '["12","13"]', 'l\'app propose toujours les deux paires (la N°13 est revenue pour VRM)', JSON.stringify(vieille.nums));
      dit(/^grise\|/.test(vieille.boutons['5002'] || '') && /croit encore vendue/.test(vieille.boutons['5002'] || ''), 'mais le « Publier » de la N°13 est GRISÉ, avec la raison (l\'extension refuserait)', String(vieille.boutons['5002']));
      dit(/^pret\|/.test(vieille.boutons['5001'] || ''), 'et la N°12 reste publiable', String(vieille.boutons['5001']));
      dit(JSON.stringify(vieille.croit) === '["1"]', 'la raison est dite UNE fois au-dessus de la liste (§7)', JSON.stringify(vieille.croit));
      const neuve = await fileApp(b, base('B'), { width: 1512, height: 950 }, { version: attendue });
      dit(/^pret\|/.test(neuve.boutons['5002'] || '') && neuve.croit.length === 0, `l'autre sens : extension à jour (${attendue}) ⇒ la N°13 est publiable, aucune phrase`, `${neuve.boutons['5002']} · ${JSON.stringify(neuve.croit)}`);
      dit(vieille.errs.length === 0 && neuve.errs.length === 0, 'aucune erreur de page', vieille.errs.concat(neuve.errs).join(' | ').slice(0, 140));
      try { fs.unlinkSync(pub.f); } catch (_) {}
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ file Leboncoin : ${ko} rouge(s)` : '\n✅ file Leboncoin : la même preuve de vente dans l\'app et dans l\'extension');
  process.exit(ko ? 1 : 0);
})();
