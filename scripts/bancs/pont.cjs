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
// Ajouté le 5 octobre (« je ne peux pas appuyer sur le bordereau, ça met que
// l'extension ne répond pas ») :
//   · ORPHELIN + VIVANT : après une mise à jour, l'ancien bridge.js répond
//     « rien » tout de suite, le nouveau répond juste après → l'app doit
//     écouter le VIVANT, pas conclure « muette » ;
//   · ORPHELIN SEUL : là, c'est bien « ne répond pas », et le geste (recharger)
//     est un bouton ;
//   · LENT : un service worker qui se réveille met 4 s à répondre → ce n'est
//     pas « muette » ;
//   · LA SESSION : l'app ne prête plus SA session (même famille de jetons →
//     `refresh_token_already_used`) ; une extension sans session reçoit celle
//     que le serveur fabrique pour elle, et une extension déjà connectée ne
//     reçoit RIEN ;
//   · L'INDICATEUR « Actions possibles / Lecture seule » de l'en-tête, dans
//     chaque situation, avec le geste qui débloque.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
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
  // Ce que l'extension (de l'ordinateur) a écrit en dernier : il y a 5 h, en 5.143.
  { id: 'panel_diag_capture', data: { ver: '5.143.0', verAt: new Date(auj.getTime() - 5 * 3600e3).toISOString(), majAt: new Date(auj.getTime() - 5 * 3600e3).toISOString() } },
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

// Le pont simulé, injecté AVANT l'app. `mode` : absente · muette (ne répond
// plus du tout) · orphelin (répond « rien » tout de suite, comme un bridge.js
// dont l'extension a été rechargée) · orphelin+ok (l'orphelin ET un pont
// vivant) · lent (répond au bout de 4 s) · ok ; `connecte` : uid du cookie
// Vinted ; `vrm` : ce que l'extension dit de sa session VRM.
const PONT = ({ mode, connecte, vrm, version = '5.143.0', cmdLente = 0 }) => {
  window.__sessions = [];                               // ce que l'app envoie à l'extension
  window.addEventListener('message', (e) => { const d = e.data; if (e.source === window && d && d.__vmr === 'session') window.__sessions.push(d.session || null); });
  if (mode === 'absente') return;
  const post = (m) => window.postMessage(m, '*');
  const orphelin = mode === 'orphelin' || mode === 'orphelin+ok';
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    // L'ancien bridge.js (5.159 et avant) quand il est orphelin : `repondre(null)`.
    if (orphelin && (d.__vmr === 'etat' || d.__vmr === 'cmd') && d.reqId) post({ __vmr: d.__vmr + ':result', reqId: d.reqId, resp: null });
    if (mode === 'muette' || mode === 'orphelin') return;  // plus rien derrière
    // Un pont 5.128 ne connaît pas « état » (arrivé en 5.129) : il ne répond rien.
    if (d.__vmr === 'etat' && version < '5.129.0' && version.split('.')[1].length === 3) return;
    const delai = mode === 'lent' ? 4000 : mode === 'orphelin+ok' ? 300 : 0;
    if (d.__vmr === 'etat') setTimeout(() => post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: vrm || { ok: true, connecte: true, email: '' },
      vinted: connecte ? { uid: connecte, login: connecte === '111' ? 'compte_a' : 'compte_b' } : null, cmds: {} } }), delai);
    if (d.__vmr === 'cmd' && d.cmd === 'ventes') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
    if (d.__vmr === 'cmd' && d.cmd === 'bordereau') {
      const jobId = `bord:${d.uid}:${d.tx}`;
      if (String(d.uid) !== String(connecte)) { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'vinted-autre', actifLogin: 'x' } }); return; }
      setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, jobId, etape: 'file' } }), cmdLente);
      window.__cmdRecu && window.__cmdRecu(String(d.tx));
      setTimeout(() => post({ __vmr: 'evt', evt: { type: 'cmd', jobId, etape: 'generation', at: Date.now() } }), cmdLente + 300);
      setTimeout(() => {
        post({ __vmr: 'evt', evt: { type: 'cmd', jobId, etape: 'fait', at: Date.now() } });
        post({ __vmr: 'evt', evt: { type: 'maj', quoi: 'label', uid: String(d.uid), tx: String(d.tx) } });
      }, cmdLente + 900);
    }
  });
  post({ __vmr: 'ready', version });
};
const SESSION = { access_token: 'jeton-de-l-app', refresh_token: 'jeton-de-renouvellement-de-l-app', expires_at: Date.now() + 3600e3,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeur@exemple.test' } };
const FOURCHE = { access_token: 'jeton-de-l-extension', refresh_token: 'renouvellement-propre-a-l-extension', expires_at: Date.now() + 3600e3,
  user_id: SESSION.user.id, email: SESSION.user.email };

async function rendre(b, { mode, connecte, tel = false, vrm = null, session = false, routeFourche = 200, attente = null, diagKO = false, version = '5.143.0', cmdLente = 0, separee = false, largeur = null }) {
  const vp = tel ? { width: largeur || 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  let labelPret = false; const cmds = [];
  await pg.exposeFunction('__cmdRecu', (tx) => { cmds.push(tx); setTimeout(() => { labelPret = true; }, 600); });
  await pg.addInitScript((sess) => { try { if (sess) localStorage.setItem('vrm_session', JSON.stringify(sess)); else localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} }, session ? SESSION : null);
  await pg.addInitScript(PONT, { mode, connecte, vrm, version, cmdLente });
  // L'appareil a-t-il déjà séparé la session de l'extension (une fois par compte) ?
  if (separee) await pg.addInitScript((uid) => { try { localStorage.setItem('vrm_ext_separee_' + uid, '1'); } catch (_) {} }, SESSION.user.id);
  const fourches = [];
  if (session) await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...SESSION, expires_in: 3600 }) }));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return session ? j([]) : route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (diagKO && /id=eq\.panel_diag_capture/.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
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
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=session-extension/.test(u)) {
      fourches.push({ methode: r.request().method(), auth: r.request().headers().authorization || '' });
      if (routeFourche !== 200) return r.fulfill({ status: routeFourche, contentType: 'application/json', body: '{"erreur":"x"}' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, session: FOURCHE }) });
    }
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, acces: true, statut: 'active' }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(attente != null ? attente : mode === 'muette' ? 17000 : mode === 'orphelin' ? 9000 : mode === 'lent' ? 6000 : 3500);
  const lire = () => pg.evaluate(() => ({
    boutons: [...document.querySelectorAll('[data-bouton-bord]')].map((x) => ({ etat: x.getAttribute('data-bouton-bord'), tx: x.getAttribute('data-tx'), txt: x.innerText })),
    raisons: [...document.querySelectorAll('[data-raison-bord]')].map((x) => x.getAttribute('data-raison-bord') + ' | ' + x.innerText),
    recharger: document.querySelectorAll('[data-raison-bord] [data-recharger]').length,
    surVinted: [...document.querySelectorAll('[data-bord-vinted]')].map((a) => a.getAttribute('href')),
    etat: (() => { const x = document.querySelector('[data-etat-actions]'); return x ? { niveau: x.getAttribute('data-etat-actions'), code: x.getAttribute('data-etat-code'), txt: x.innerText } : null; })(),
    sessions: window.__sessions || [],
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  }));
  // Ouvre le panneau de l'indicateur et renvoie ce qu'il dit.
  // ⚠️ Un banc ne meurt pas, il rapporte : sans indicateur (build d'avant), un
  //    `click` attendrait 30 s puis tuerait le banc avant le bilan.
  const panneau = async () => {
    if (!(await pg.$('[data-etat-actions]'))) return null;
    await pg.click('[data-etat-actions]'); await pg.waitForTimeout(250);
    return pg.evaluate(() => { const p = document.querySelector('[data-etat-panneau]'); if (!p) return null;
      const r = p.getBoundingClientRect();
      return { txt: p.innerText, geste: (p.querySelector('[data-etat-geste]') || {}).getAttribute ? p.querySelector('[data-etat-geste]').getAttribute('data-etat-geste') : null,
        dedans: r.left >= 0 && r.right <= document.documentElement.clientWidth + 1 }; });
  };
  return { ctx, pg, errs, lire, cmds, panneau, fourches };
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
      dit(v.surVinted.length === 2 && new Set(v.surVinted).size === 2, 'chaque vente propose SON repli « sur Vinted ↗ » (une adresse par vente)', JSON.stringify(v.surVinted));
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 120));
      await r.ctx.close(); }

    console.log('── extension MUETTE (rechargée, le pont ne répond plus)');
    { const r = await rendre(b, { mode: 'muette' }); const v = await r.lire();
      dit(v.boutons.length === 2 && v.boutons.every((x) => x.etat === 'grise'), 'rien d’actif : présente n’est pas allumée', JSON.stringify(v.boutons.map((x) => x.etat)));
      dit(v.raisons.length === 1 && /^muette/.test(v.raisons[0]), 'la raison dit qu’elle ne répond pas, et quoi faire', JSON.stringify(v.raisons));
      dit(v.recharger === 1, 'et le geste est un BOUTON « Recharger la page », pas une phrase', `boutons : ${v.recharger}`);
      dit(v.etat && v.etat.niveau === 'lecture' && v.etat.code === 'muette', 'l’en-tête dit « Lecture seule » (extension muette)', JSON.stringify(v.etat));
      const p = await r.panneau();
      dit(p && p.geste === 'recharger', 'son panneau propose de recharger la page', JSON.stringify(p));
      await r.ctx.close(); }

    console.log('── ORPHELIN + VIVANT (après une mise à jour : l’ancien bridge répond « rien », le nouveau répond)');
    { const r = await rendre(b, { mode: 'orphelin+ok', connecte: '111' }); const v = await r.lire();
      const a = v.boutons.find((x) => x.tx === '7001');
      dit(a && a.etat === 'pret', 'la réponse VIDE de l’orphelin n’éteint pas le bouton : on écoute le pont vivant', JSON.stringify(v.boutons.map((x) => x.etat)) + ' ' + JSON.stringify(v.raisons));
      dit(v.etat && v.etat.niveau === 'ok', 'l’en-tête dit « Actions possibles »', JSON.stringify(v.etat));
      await r.ctx.close(); }

    console.log('── ORPHELIN SEUL (extension rechargée, page pas rechargée)');
    { const r = await rendre(b, { mode: 'orphelin', connecte: '111' }); const v = await r.lire();
      dit(v.boutons.every((x) => x.etat === 'grise') && v.raisons.length === 1 && /^muette/.test(v.raisons[0]), 'là, c’est bien « ne répond pas »', JSON.stringify(v.raisons));
      dit(v.recharger === 1, 'avec le bouton « Recharger la page »', `boutons : ${v.recharger}`);
      await r.ctx.close(); }

    console.log('── LENT (le service worker se réveille : 4 s pour répondre)');
    { const r = await rendre(b, { mode: 'lent', connecte: '111' }); const v = await r.lire();
      const a = v.boutons.find((x) => x.tx === '7001');
      dit(a && a.etat === 'pret' && v.raisons.length === 0, 'une réponse lente n’est pas « muette »', JSON.stringify(v.boutons.map((x) => x.etat)) + ' ' + JSON.stringify(v.raisons));
      await r.ctx.close(); }

    console.log('── extension ALLUMÉE, Chrome connecté sur compte_a');
    { const r = await rendre(b, { mode: 'ok', connecte: '111' }); let v = await r.lire();
      const a = v.boutons.find((x) => x.tx === '7001'), bb = v.boutons.find((x) => x.tx === '7002');
      dit(a && a.etat === 'pret' && /Générer le bordereau/.test(a.txt), 'autre sens : la vente de compte_a a un bouton ACTIF « Générer le bordereau »', JSON.stringify(a));
      dit(bb && bb.etat === 'grise' && /compte_a/.test(bb.txt) && /compte_b/.test(bb.txt), 'la vente de compte_b est grisée, et la raison NOMME les deux comptes', JSON.stringify(bb));
      dit(v.raisons.length === 0, 'aucune raison commune : l’extension va bien', JSON.stringify(v.raisons));
      dit(v.etat && v.etat.niveau === 'ok' && /compte_a/.test(v.etat.txt), 'l’en-tête dit « Actions possibles » et NOMME le compte Vinted qui agira', JSON.stringify(v.etat));
      const p = await r.panneau();
      dit(p && /compte_a/.test(p.txt) && /Extension/.test(p.txt) && /Ton compte VRM/.test(p.txt) && p.dedans, 'son panneau dit les trois maillons (extension, compte VRM, compte Vinted), dans l’écran', JSON.stringify(p && p.txt).slice(0, 200));
      await r.pg.keyboard.press('Escape'); await r.pg.waitForTimeout(150);
      // Grisée pour une raison de COMPTE, le geste est de basculer : un lien vers
      // la vente ouvrirait la boîte d'un autre compte. Le repli « sur Vinted »
      // ne sert que quand c'est l'extension qui manque (contrôlé plus bas).
      dit(v.surVinted.length === 0, 'aucun « sur Vinted ↗ » quand l’extension va bien (le geste est de basculer de compte)', JSON.stringify(v.surVinted));
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

    console.log('── ALLUMÉE, mais AUCUN compte Vinted ouvert dans Chrome');
    { const r = await rendre(b, { mode: 'ok', connecte: null }); const v = await r.lire();
      dit(v.etat && v.etat.niveau === 'lecture' && v.etat.code === 'vinted', 'l’en-tête dit « Lecture seule » : rien à faire agir', JSON.stringify(v.etat));
      const p = await r.panneau();
      dit(p && p.geste === 'vinted', 'le geste : ouvrir vinted.fr et s’y connecter', JSON.stringify(p));
      await r.ctx.close(); }

    console.log('── SESSION : l’extension n’en a pas → elle reçoit LA SIENNE, jamais celle de l’app');
    { const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, vrm: { ok: true, connecte: false, email: '' }, attente: 5000 }); const v = await r.lire();
      const propres = v.sessions.filter((x) => x && x.refresh_token === FOURCHE.refresh_token);
      const siennes = v.sessions.filter((x) => x && x.refresh_token === SESSION.refresh_token);
      dit(r.fourches.length >= 1 && r.fourches.every((f) => f.methode === 'POST' && /jeton-de-l-app/.test(f.auth)), 'l’app demande au serveur une session pour l’extension (POST, avec SA connexion)', JSON.stringify(r.fourches));
      dit(propres.length === 1, 'l’extension reçoit UNE session, la sienne', JSON.stringify(v.sessions.map((x) => x && x.refresh_token)));
      dit(siennes.length === 0, 'et JAMAIS le jeton de renouvellement de l’app (même famille → jetons qui s’annulent)', JSON.stringify(v.sessions.map((x) => x && x.refresh_token)));
      await r.ctx.close(); }
    { const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, separee: true, vrm: { ok: true, connecte: true, email: SESSION.user.email, user_id: SESSION.user.id }, attente: 5000 }); const v = await r.lire();
      dit(r.fourches.length === 0 && v.sessions.length === 0, 'autre sens : une extension déjà connectée au bon compte (et déjà séparée) ne reçoit RIEN', `demandes : ${r.fourches.length} · sessions envoyées : ${v.sessions.length}`);
      await r.ctx.close(); }
    // Une extension qui a encore la session donnée par l'app avant le 5 octobre
    // partage sa famille de jetons : on la sépare UNE fois, d'avance.
    { const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, vrm: { ok: true, connecte: true, email: SESSION.user.email, user_id: SESSION.user.id }, attente: 5000 }); const v = await r.lire();
      dit(v.sessions.length === 1 && v.sessions[0] && v.sessions[0].refresh_token === FOURCHE.refresh_token, 'jamais séparée : elle reçoit UNE session à elle (séparation d’avance), pas la nôtre', JSON.stringify(v.sessions.map((x) => x && x.refresh_token)));
      await r.ctx.close(); }
    { const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, routeFourche: 404, vrm: { ok: true, connecte: false, expiree: true, email: SESSION.user.email }, attente: 5000 }); const v = await r.lire();
      dit(v.sessions.filter((x) => x && x.refresh_token === SESSION.refresh_token).length === 0, 'serveur muet + session MORTE : on ne lui redonne pas la nôtre (c’est le cas qui s’entre-tue)', JSON.stringify(v.sessions.map((x) => x && x.refresh_token)));
      await r.ctx.close(); }

    console.log('── EXTENSION 5.128 (ne connaît pas « état ») : « à mettre à jour », jamais « recharge la page »');
    { const r = await rendre(b, { mode: 'ok', connecte: '111', version: '5.128.0', attente: 17000 }); const v = await r.lire();
      dit(v.raisons.length === 1 && /^retard/.test(v.raisons[0]) && v.recharger === 0, 'la raison dit de METTRE À JOUR, sans bouton « recharger » (recharger ne change rien)', JSON.stringify(v.raisons));
      dit(v.etat && v.etat.code === 'retard', 'l’en-tête dit « en retard », pas « muette », même après 17 s', JSON.stringify(v.etat));
      await r.ctx.close(); }

    console.log('── COMMANDE LENTE avec un orphelin (l’accusé du pont vivant met 2,5 s)');
    { const r = await rendre(b, { mode: 'orphelin+ok', connecte: '111', cmdLente: 2500 });
      await r.pg.click('[data-bouton-bord="pret"][data-tx="7001"] button');
      // Juste APRÈS la grâce de 1,5 s et AVANT l'accusé (2,5 s) : c'est là que
      // l'ancienne version disait « n'a pas répondu, réessaie ».
      await r.pg.waitForTimeout(2000);
      const v = await r.lire(); const a = v.boutons.find((x) => x.tx === '7001');
      dit(r.cmds.includes('7001') && a && !/pas répondu/.test(a.txt), 'la réponse vide de l’orphelin n’est pas un échec : on attend l’accusé du pont vivant (pas de « réessaie » → pas de bordereau demandé deux fois)', JSON.stringify(a));
      await r.pg.waitForTimeout(2500);
      const v2 = await r.lire(); const a2 = v2.boutons.find((x) => x.tx === '7001');
      dit(a2 && a2.etat !== 'pret', 'et l’accusé, arrivé à 2,5 s, est bien pris en compte', JSON.stringify(a2));
      await r.ctx.close(); }

    console.log('── iPHONE ÉTROIT (360 px)');
    { const r = await rendre(b, { mode: 'ok', connecte: '111', tel: true, largeur: 360 }); const v = await r.lire();
      dit(v.sw <= v.cw + 1, 'la pastille ne fait pas déborder l’en-tête à 360 px', `${v.sw} > ${v.cw}`);
      await r.pg.screenshot({ path: path.join(require('os').tmpdir(), 'pont-360.png') });
      await r.ctx.close(); }

    console.log('── TÉLÉPHONE, base qui ne rend pas le diagnostic');
    { const r = await rendre(b, { mode: 'ok', connecte: '111', tel: true, diagKO: true });
      const p = await r.panneau(); await r.pg.waitForTimeout(600);
      const der = await r.pg.evaluate(() => { const x = document.querySelector('[data-etat-derniere]'); return x ? { e: x.getAttribute('data-etat-derniere'), t: x.innerText } : null; });
      dit(p && der && der.e === 'passu' && !/il y a/.test(der.t), '« pas su » quand la base ne répond pas — aucune date inventée', JSON.stringify(der));
      await r.ctx.close(); }

    console.log('── TÉLÉPHONE');
    { const r = await rendre(b, { mode: 'ok', connecte: '111', tel: true }); const v = await r.lire();
      dit(!v.boutons.some((x) => x.etat === 'pret'), 'aucun bouton actif sur un téléphone', JSON.stringify(v.boutons.map((x) => x.etat)));
      dit(v.raisons.length === 1 && /^telephone/.test(v.raisons[0]), 'une raison : « depuis ton ordinateur »', JSON.stringify(v.raisons));
      dit(v.etat && v.etat.niveau === 'lecture' && v.etat.code === 'telephone', 'l’en-tête dit « Lecture » sur le téléphone', JSON.stringify(v.etat));
      const p = await r.panneau();
      dit(p && p.dedans && /ordinateur/.test(p.txt) && /colis|bordereaux déjà reçus/.test(p.txt), 'son panneau tient dans l’écran, dit OÙ agir et ce qui marche déjà ici', JSON.stringify(p && p.txt).slice(0, 200));
      // Le seul fait qu'un téléphone puisse savoir de l'extension de l'ordinateur.
      await r.pg.waitForTimeout(600);
      const der = await r.pg.evaluate(() => { const x = document.querySelector('[data-etat-derniere]'); return x ? { e: x.getAttribute('data-etat-derniere'), t: x.innerText } : null; });
      dit(der && der.e === 'lue' && /il y a 5 h/.test(der.t) && /5\.143\.0/.test(der.t), 'et il dit QUAND l’extension (de l’ordinateur) a écrit pour la dernière fois, et sa version', JSON.stringify(der));
      dit(v.sw <= v.cw + 1, 'aucun débordement horizontal', `${v.sw} > ${v.cw}`);
      await r.pg.screenshot({ path: path.join(require('os').tmpdir(), 'pont-390.png') });
      await r.ctx.close(); }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ pont : ${ko} rouge(s)` : '\n✅ pont : tout est vert');
  process.exit(ko ? 1 : 0);
})();
