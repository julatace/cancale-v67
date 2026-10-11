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
// Ajouté le 11 octobre (« l'extension est censée être allumée, elle n'est pas
// allumée », « elle ne garde pas les connexions ») :
//   · CODE PÉRIMÉ : le manifeste dit 5.169, le service worker exécute un code
//     d'avant (⟳ jamais cliqué) — l'état sans `code`, une clé qui n'existe plus
//     depuis la 5.159, ou le verdict du pont → « périmé », commandes coupées, le
//     geste ⟳ ; et l'AUTRE SENS : le bon code n'est jamais dit périmé ;
//   · « ACTIONS POSSIBLES · SAUF PUBLIER » quand publier est bloqué alors que le
//     reste marche (deux voix contraires sur le même écran avant) ;
//   · LA SESSION ADRESSÉE : plus rien n'est posté dans la page ; la session va
//     à UNE extension (son identifiant, son nonce) ; une extension trop ancienne
//     ne reçoit rien, et l'app ne promet pas « je réessaie ».
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4791;
const EXT_ID = 'abcdefghijklmnopabcdefghijklmnop';

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
const PONT = ({ mode, connecte, vrm, version = '5.143.0', cmdLente = 0, code = undefined, offresAutoLocal = false, verdict = null, extId, besoin = null, vieux = null }) => {
  // `vieux` : une COPIE ANCIENNE à côté (elle répond au ping, rien d'autre).
  if (vieux) window.addEventListener('message', (e) => { const d = e.data; if (e.source === window && d && d.__vmr === 'ping') window.postMessage({ __vmr: 'ready', version: vieux }, '*'); });
  // `__reparer()` : la page de réparation vient de faire ⟳ — le code est celui
  // du manifeste, et le pont remis à neuf annonce « ready » (comme `reinjecterPont`).
  window.__reparer = () => { verdict = null; code = undefined; window.postMessage({ __vmr: 'ready', version, id: extId }, '*'); };
  window.__sessions = [];                               // ce que l'app poste dans la page (TOUTE extension l'entend)
  window.__externes = [];                               // ce que l'app ADRESSE à une extension (externally_connectable)
  window.__cmds = [];
  window.addEventListener('message', (e) => { const d = e.data; if (e.source === window && d && d.__vmr === 'session') { window.__sessions.push(d.session || null); try { window.__noterPost && window.__noterPost('page:' + (d.session ? 'session' : 'null')); } catch (_) {} } });
  if (mode === 'absente') return;
  const vn = (v) => String(v || '').split('.').map((x) => parseInt(x, 10) || 0);
  const auMoins = (v, r) => { const a = vn(v), b = vn(r); for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return true; };
  const neuf = auMoins(version, '5.169.0');
  // `externally_connectable` : seule une extension ≥ 5.169 l'ouvre à la page.
  if (neuf) {
    window.chrome = { runtime: { lastError: null, sendMessage(id, msg, cb) {
      window.__externes.push({ id, type: msg && msg.type, nonce: msg && msg.nonce, refresh: msg && msg.session ? msg.session.refresh_token : null, raison: msg && msg.raison, force: !!(msg && msg.force) });
      try { window.__noterPost && window.__noterPost('adresse:' + (msg && msg.type)); } catch (_) {}
      let r = { ok: false };
      if (id !== extId) r = undefined;                  // une autre extension : personne ne répond
      else if (msg.type === 'liaison') {
        const b = besoin != null ? besoin : !(vrm && vrm.connecte === true) || msg.raison === 'separer' || msg.force;
        r = b ? { ok: true, besoin: true, nonce: 'n'.repeat(32), raison: 'test' } : { ok: true, besoin: false };
      } else if (msg.type === 'session') r = msg.nonce === 'n'.repeat(32) ? { ok: true, email: 'vendeur@exemple.test' } : { ok: false, code: 'nonce' };
      else if (msg.type === 'deconnexion') r = { ok: true };
      setTimeout(() => cb && cb(r), 5);
    } } };
  }
  const post = (m) => window.postMessage(m, '*');
  const orphelin = mode === 'orphelin' || mode === 'orphelin+ok';
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: neuf ? extId : undefined });
    // L'ancien bridge.js (5.159 et avant) quand il est orphelin : `repondre(null)`.
    if (orphelin && (d.__vmr === 'etat' || d.__vmr === 'cmd') && d.reqId) post({ __vmr: d.__vmr + ':result', reqId: d.reqId, resp: null });
    // Un pont ≥ 5.169 (lu depuis le disque) devant un service worker qui ne
    // connaît même pas « état » : il le dit (`perime`), réponse vide.
    if (verdict && d.__vmr === 'etat' && d.reqId) { post({ __vmr: 'etat:result', reqId: d.reqId, resp: null, perime: verdict }); return; }
    if (mode === 'muette' || mode === 'orphelin') return;  // plus rien derrière
    // Un pont 5.128 ne connaît pas « état » (arrivé en 5.129) : il ne répond rien.
    if (d.__vmr === 'etat' && version < '5.129.0' && version.split('.')[1].length === 3) return;
    const delai = mode === 'lent' ? 4000 : mode === 'orphelin+ok' ? 300 : 0;
    if (d.__vmr === 'etat') setTimeout(() => post({ __vmr: 'etat:result', reqId: d.reqId, resp: Object.assign({ ok: true, version, vrm: vrm || { ok: true, connecte: true, email: '' },
      vinted: connecte ? { uid: connecte, login: connecte === '111' ? 'compte_a' : 'compte_b' } : null, cmds: {} },
      // Depuis la 5.169, l'état porte la version du CODE et l'identifiant de
      // l'extension. `code: null` simule un code d'avant sous un manifeste neuf.
      neuf && code !== null ? { code: code || version, ext: extId } : {},
      offresAutoLocal ? { offresAutoLocal: false } : {}) }), delai);
    if (d.__vmr === 'cmd') window.__cmds.push(d.cmd);
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

async function rendre(b, { mode, connecte, tel = false, vrm = null, session = false, routeFourche = 200, attente = null, diagKO = false, version = '5.143.0', cmdLente = 0, separee = false, largeur = null, code = undefined, offresAutoLocal = false, verdict = null, besoin = null, vieux = null, url = '/?tab=cat_ventes' }) {
  const vp = tel ? { width: largeur || 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  let labelPret = false; const cmds = [];
  await pg.exposeFunction('__cmdRecu', (tx) => { cmds.push(tx); setTimeout(() => { labelPret = true; }, 600); });
  // Ce qui part vers l'extension, noté HORS de la page (un rechargement l'effacerait).
  const notes = []; await pg.exposeFunction('__noterPost', (x) => { notes.push(x); });
  await pg.addInitScript((sess) => { try { if (sess) localStorage.setItem('vrm_session', JSON.stringify(sess)); else localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} }, session ? SESSION : null);
  await pg.addInitScript(PONT, { mode, connecte, vrm, version, cmdLente, code, offresAutoLocal, verdict, extId: EXT_ID, besoin, vieux });
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
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(attente != null ? attente : mode === 'muette' ? 17000 : mode === 'orphelin' ? 9000 : mode === 'lent' ? 6000 : 3500);
  const lire = () => pg.evaluate(() => ({
    boutons: [...document.querySelectorAll('[data-bouton-bord]')].map((x) => ({ etat: x.getAttribute('data-bouton-bord'), tx: x.getAttribute('data-tx'), txt: x.innerText })),
    raisons: [...document.querySelectorAll('[data-raison-bord]')].map((x) => x.getAttribute('data-raison-bord') + ' | ' + x.innerText),
    recharger: document.querySelectorAll('[data-raison-bord] [data-recharger]').length,
    surVinted: [...document.querySelectorAll('[data-bord-vinted]')].map((a) => a.getAttribute('href')),
    etat: (() => { const x = document.querySelector('[data-etat-actions]'); return x ? { niveau: x.getAttribute('data-etat-actions'), code: x.getAttribute('data-etat-code'), txt: x.innerText } : null; })(),
    sessions: window.__sessions || [],
    externes: window.__externes || [],
    cmdsEnvoyees: window.__cmds || [],
    exception: (() => { const x = document.querySelector('[data-etat-actions]'); return x ? x.getAttribute('data-etat-exception') : null; })(),
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
  return { ctx, pg, errs, lire, cmds, panneau, fourches, notes };
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

    console.log('── SESSION (11 octobre) : ADRESSÉE à UNE extension, plus rien dans la page');
    { const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, version: '5.169.0', vrm: { ok: true, connecte: false, email: '' }, attente: 5000 }); const v = await r.lire();
      const liaisons = v.externes.filter((x) => x.type === 'liaison'), envois = v.externes.filter((x) => x.type === 'session');
      dit(liaisons.length >= 1 && liaisons.every((x) => x.id === EXT_ID), 'l’app DEMANDE d’abord à CETTE extension (son identifiant) si elle a besoin d’une session', JSON.stringify(v.externes));
      dit(r.fourches.length === 1 && r.fourches.every((f) => f.methode === 'POST' && /jeton-de-l-app/.test(f.auth)), 'puis fait fabriquer SA session par le serveur (POST, avec la connexion de l’app)', JSON.stringify(r.fourches));
      dit(envois.length === 1 && envois[0].id === EXT_ID && envois[0].nonce === 'n'.repeat(32) && envois[0].refresh === FOURCHE.refresh_token, 'la session part à CETTE extension, avec le nonce qu’elle a émis — la sienne, jamais celle de l’app', JSON.stringify(envois));
      dit(v.sessions.length === 0, 'et RIEN n’est posté dans la page (une copie ancienne à côté l’adoptait : même famille de jetons, révoquée)', JSON.stringify(v.sessions.map((x) => x && x.refresh_token)));
      await r.ctx.close(); }
    { const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, separee: true, version: '5.169.0', vrm: { ok: true, connecte: true, email: SESSION.user.email, user_id: SESSION.user.id }, attente: 5000 }); const v = await r.lire();
      dit(r.fourches.length === 0 && v.externes.filter((x) => x.type === 'session').length === 0 && v.sessions.length === 0, 'autre sens : une extension déjà connectée au bon compte (et déjà séparée) ne reçoit RIEN', `demandes : ${r.fourches.length} · envois : ${JSON.stringify(v.externes)} · page : ${v.sessions.length}`);
      await r.ctx.close(); }
    // Une extension qui a encore la session donnée par l'app avant le 6 octobre
    // partage sa famille de jetons : on la sépare UNE fois, d'avance.
    { const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, version: '5.169.0', vrm: { ok: true, connecte: true, email: SESSION.user.email, user_id: SESSION.user.id }, attente: 5000 }); const v = await r.lire();
      const envois = v.externes.filter((x) => x.type === 'session');
      dit(v.externes.some((x) => x.type === 'liaison' && x.raison === 'separer') && envois.length === 1 && envois[0].refresh === FOURCHE.refresh_token && v.sessions.length === 0, 'jamais séparée : elle reçoit UNE session à elle (séparation d’avance), adressée', JSON.stringify(v.externes));
      await r.ctx.close(); }
    { const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, routeFourche: 404, version: '5.169.0', vrm: { ok: true, connecte: false, expiree: true, email: SESSION.user.email }, attente: 5000 }); const v = await r.lire();
      dit(v.sessions.length === 0 && v.externes.filter((x) => x.type === 'session').length === 0, 'serveur muet + session MORTE : on ne lui redonne JAMAIS la nôtre, ni par la page, ni adressée', JSON.stringify({ page: v.sessions.map((x) => x && x.refresh_token), adressees: v.externes }));
      const p = await r.panneau();
      dit(p && /mot de passe VRM|Se connecter avec VRM/.test(p.txt) && !/réessaie/.test(p.txt), 'et le panneau dit le vrai geste (pas « je réessaie » sans fin)', JSON.stringify(p && p.txt).slice(0, 260));
      await r.ctx.close(); }
    { const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, version: '5.164.0', vrm: { ok: true, connecte: false, email: '' }, attente: 5000 }); const v = await r.lire();
      dit(v.sessions.length === 0 && r.fourches.length === 0, 'une extension 5.164 (pas de canal adressé) : rien dans la page, aucune session fabriquée pour rien', `page : ${v.sessions.length} · demandes : ${r.fourches.length}`);
      const p = await r.panneau();
      dit(p && /mets-la à jour|Mettre à jour/.test(p.txt) && /mot de passe VRM/.test(p.txt) && !/Je réessaie/.test(p.txt), 'et l’app le DIT : la mettre à jour, ou s’y connecter au mot de passe VRM — jamais « je réessaie »', JSON.stringify(p && p.txt).slice(0, 300));
      await r.ctx.close(); }
    { const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, version: '5.128.0', attente: 6000 }); const v = await r.lire();
      dit(v.sessions.length === 0, 'une extension < 5.129 : l’app ne lui prête plus SA session (même famille → l’app perdait la sienne 12 s plus tard)', JSON.stringify(v.sessions.map((x) => x && x.refresh_token)));
      await r.ctx.close(); }

    console.log('── CODE PÉRIMÉ (manifeste 5.169, service worker d’avant)');
    for (const [nom, opts] of [['état SANS code', { version: '5.169.0', code: null }], ['clé disparue depuis la 5.159 (offresAutoLocal)', { version: '5.164.0', offresAutoLocal: true }], ['verdict du pont', { version: '5.169.0', verdict: { code: null, attendu: '5.169.0', raison: 'sans-etat' } }]]) {
      const r = await rendre(b, Object.assign({ mode: 'ok', connecte: '111', attente: 4500 }, opts)); const v = await r.lire();
      dit(v.etat && v.etat.code === 'perime' && v.etat.niveau === 'lecture', `${nom} : l’en-tête dit « périmé » (lecture seule), jamais « Actions possibles »`, JSON.stringify(v.etat));
      dit(v.boutons.length && v.boutons.every((x) => x.etat === 'grise') && v.raisons.length === 1 && /^perime/.test(v.raisons[0]) && /⟳/.test(v.raisons[0]), `${nom} : les boutons sont grisés, la raison dite UNE fois, avec ⟳`, JSON.stringify(v.raisons));
      const p = await r.panneau();
      dit(p && p.geste === 'recharger-extension' && /chrome:\/\/extensions/.test(p.txt), `${nom} : le geste est ⟳ dans chrome://extensions (recharger la page ne change rien)`, JSON.stringify(p && { geste: p.geste }));
      await r.pg.keyboard.press('Escape').catch(() => {});
      await r.pg.click('[data-bouton-bord] button').catch(() => {}); await r.pg.waitForTimeout(400);
      const apres = await r.lire();
      dit(!apres.cmdsEnvoyees.includes('bordereau'), `${nom} : un clic n’envoie AUCUNE commande au code périmé (il n’a pas les garde-fous d’aujourd’hui)`, JSON.stringify(apres.cmdsEnvoyees));
      await r.ctx.close();
    }
    { const r = await rendre(b, { mode: 'ok', connecte: '111', version: '5.169.0', code: '5.169.0', attente: 4500 }); const v = await r.lire();
      dit(v.etat && v.etat.code !== 'perime' && v.etat.niveau === 'ok', 'autre sens : le code du manifeste n’est jamais dit périmé', JSON.stringify(v.etat));
      dit(!v.exception, 'et une extension à jour n’a pas d’exception « sauf publier »', JSON.stringify(v.exception));
      await r.ctx.close(); }

    // ══ REVUE DU 11 OCTOBRE ══════════════════════════════════════════════════
    // Une promesse (« je la reconnecte ») ne s'affiche que si l'app ENVOIE quelque
    // chose — c'est l'envoi qui juge, pas la phrase. Le geste dit est celui qui
    // marche avec l'extension qui répond.
    const AUTRE = { ok: true, connecte: true, user_id: '99999999-8888-7777-6666-555555555555', email: 'autre@exemple.test' };
    console.log('── 5.164 CONNECTÉE AU COMPTE VRM D’UN AUTRE (elle n’entend pas le canal adressé)');
    { const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, version: '5.164.0', vrm: AUTRE, attente: 6000 }); const v = await r.lire();
      const envoye = r.fourches.length + v.externes.length + v.sessions.length;
      dit(v.etat && v.etat.code === 'autre-vrm', 'l’en-tête retient « autre compte VRM »', JSON.stringify(v.etat));
      dit(envoye === 0, 'rien n’est envoyé (ni fabriqué, ni adressé, ni posté) — c’est le fait que la phrase doit suivre', `serveur ${r.fourches.length} · adressés ${v.externes.length} · page ${v.sessions.length}`);
      const raison = v.raisons.join(' ');
      dit(!/je la reconnecte|je la connecte/i.test(raison) && /mets-la à jour/i.test(raison) && /mot de passe VRM/i.test(raison), 'au-dessus des ventes : aucune promesse « je la reconnecte », les vrais gestes (mise à jour, mot de passe VRM)', raison.slice(0, 300));
      const p = await r.panneau();
      dit(p && p.geste === 'deconnecter' && !/je la reconnecte/i.test(p.txt), 'le panneau propose de la DÉCONNECTER d’ici (son icône, connectée, ouvre VRM — pas sa fenêtre)', JSON.stringify(p && { geste: p.geste, fin: p.txt.split('\n').slice(-1)[0] }).slice(0, 300));
      await r.pg.click('[data-etat-geste-deconnecter]').catch(() => {}); await r.pg.waitForTimeout(600);
      const v2 = await r.lire();
      dit(v2.sessions.length === 1 && v2.sessions[0] === null, 'son clic lui fait oublier sa session — l’ancien message (session: null), une fois, seulement sur ce geste', JSON.stringify(v2.sessions));
      await r.ctx.close(); }
    { const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, version: '5.169.0', vrm: AUTRE, attente: 6000 }); const v = await r.lire();
      const p = await r.panneau();
      dit(p && p.geste !== 'deconnecter' && v.sessions.length === 0, 'autre sens : une 5.169 n’a pas ce bouton, et rien n’est posté dans la page', JSON.stringify({ geste: p && p.geste, page: v.sessions }));
      await r.ctx.close(); }

    console.log('── 5.169 PAS CONNECTÉE, LE SERVEUR REFUSE DE FABRIQUER SA SESSION (429, 503)');
    for (const st of [429, 503]) {
      const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, version: '5.169.0', vrm: { ok: true, connecte: false, email: '' }, routeFourche: st, attente: 6000 }); const v = await r.lire();
      const raison = v.raisons.join(' ');
      const p = await r.panneau();
      dit(r.fourches.length >= 1, `HTTP ${st} : l’app a bien demandé (et le serveur a refusé)`, String(r.fourches.length));
      dit(/mot de passe VRM/i.test(raison) && p && /mot de passe VRM/i.test(p.txt), `HTTP ${st} : la liste ET le panneau disent le même geste (le mot de passe VRM)`, JSON.stringify({ raison: raison.slice(-160), panneau: p && p.txt.split('\n').slice(-1)[0] }).slice(0, 400));
      dit(p && p.geste === 'mdp' && !/Se connecter avec VRM|Je la connecte/.test(p.txt), `HTTP ${st} : le panneau ne promet plus « je la connecte » ni « Se connecter avec VRM » (même route, bloquée)`, JSON.stringify(p && { geste: p.geste }));
      await r.ctx.close();
    }

    console.log('── CODE PÉRIMÉ RÉPARÉ, PAGE OUVERTE (sans recharger)');
    { const r = await rendre(b, { mode: 'ok', connecte: '111', version: '5.169.0', code: null, attente: 5000 }); const v = await r.lire();
      dit(v.etat && v.etat.code === 'perime', 'avant : « périmé »', JSON.stringify(v.etat));
      await r.pg.evaluate(() => window.__reparer());
      const t0 = Date.now(); let code = 'perime';
      while (Date.now() - t0 < 12000) { await r.pg.waitForTimeout(250); const x = await r.lire(); code = x.etat && x.etat.code; if (code !== 'perime') break; }
      const dt = Date.now() - t0;
      dit(code !== 'perime' && dt < 4000, 'après la réparation, l’app ne le dit plus périmé en quelques secondes (avant : jusqu’au battement suivant, ~20 s)', `${code} après ${dt} ms`);
      await r.ctx.close(); }

    console.log('── « SE CONNECTER AVEC VRM » BLOQUÉ : une copie ancienne à côté, ou le code périmé');
    { const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, version: '5.169.0', vrm: { ok: true, connecte: false, email: '' }, vieux: '5.77.0', url: '/?tab=cat_ventes&lier-extension=' + EXT_ID, attente: 7000 }); const v = await r.lire();
      const band = await r.pg.evaluate(() => { const x = document.querySelector('[data-liaison]'); return x ? { etat: x.getAttribute('data-liaison'), fermer: !!x.querySelector('button[aria-label="Fermer"]') } : null; });
      dit(v.etat && v.etat.code === 'plusieurs', 'deux extensions répondent : la pastille le dit (les commandes restent coupées)', JSON.stringify(v.etat));
      dit(v.externes.some((x) => x.type === 'session' && x.id === EXT_ID) && v.sessions.length === 0, 'la session part quand même, ADRESSÉE à celle qui a demandé (l’ancienne ne l’entend pas)', JSON.stringify(v.externes.map((x) => x.type + ':' + x.id.slice(0, 4))));
      dit(band && band.etat === 'ok' && band.fermer, 'le bandeau ne reste pas sur « Je connecte… » : il dit le résultat, et se ferme', JSON.stringify(band));
      await r.ctx.close(); }
    { const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, version: '5.169.0', code: null, vrm: { ok: true, connecte: false, email: '' }, url: '/?tab=cat_ventes&lier-extension=' + EXT_ID, attente: 7500 });
      const band = await r.pg.evaluate(() => { const x = document.querySelector('[data-liaison]'); return x ? { etat: x.getAttribute('data-liaison'), bloque: x.getAttribute('data-liaison-bloque'), fermer: !!x.querySelector('button[aria-label="Fermer"]'), txt: x.innerText } : null; });
      dit(band && band.bloque === 'perime' && /⟳/.test(band.txt) && band.fermer, 'code périmé : le bandeau dit pourquoi ça ne part pas et le geste (⟳), avec une croix', JSON.stringify(band));
      await r.ctx.close(); }

    console.log('── LE BANDEAU DE LIAISON N’EST PAS SOUS L’ÎLE (ordinateur)');
    for (const [nom, opts] of [['ok', { routeFourche: 200, lier: EXT_ID }], ['erreur', { routeFourche: 500, lier: EXT_ID }], ['absente', { routeFourche: 200, lier: 'ponmlkjihgfedcbaponmlkjihgfedcba' }]]) {
      const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, version: '5.169.0', vrm: { ok: true, connecte: false, email: '' }, routeFourche: opts.routeFourche, url: '/?tab=cat_ventes&lier-extension=' + opts.lier, attente: 6000 });
      for (const larg of [1512, 1280]) {
        await r.pg.setViewportSize({ width: larg, height: 950 }); await r.pg.waitForTimeout(700);
        const m = await r.pg.evaluate(() => {
          const x = document.querySelector('[data-liaison]'); if (!x) return null;
          const f = x.querySelector('button[aria-label="Fermer"]'); if (!f) return { etat: x.getAttribute('data-liaison'), fermer: null };
          const fr = f.getBoundingClientRect(); const hit = document.elementFromPoint(fr.left + fr.width / 2, fr.top + fr.height / 2);
          const span = x.querySelector('span'); const sr = span.getBoundingClientRect(); let cache = 0;
          for (let px = Math.round(sr.left) + 4; px < sr.right; px += 20) { const h = document.elementFromPoint(px, sr.top + 8); if (h && !x.contains(h)) cache++; }
          return { etat: x.getAttribute('data-liaison'), croix: hit === f || f.contains(hit), cache };
        });
        dit(m && m.croix === true && m.cache === 0, `${nom} @${larg} : la croix se clique, et aucun mot n’est caché sous l’île`, JSON.stringify(m));
      }
      await r.ctx.close();
    }

    console.log('── « SE DÉCONNECTER » DE VRM : l’extension de ce Chrome oublie sa session');
    for (const [ver, attendu] of [['5.164.0', 'page'], ['5.169.0', 'adresse']]) {
      const r = await rendre(b, { mode: 'ok', connecte: '111', session: true, separee: true, version: ver, vrm: { ok: true, connecte: true, user_id: SESSION.user.id, email: SESSION.user.email }, url: '/?tab=settings&vue=compte', attente: 6000 });
      await r.pg.getByText('Se déconnecter', { exact: true }).first().click().catch(() => {});
      await r.pg.waitForTimeout(400);
      let valide = false;
      for (const x of await r.pg.$$('button')) { const t = ((await x.innerText().catch(() => '')) || '').trim(); const st = (await x.getAttribute('style')) || ''; if (t === 'Se déconnecter' && /flex: 2/.test(st)) { await x.click().catch(() => {}); valide = true; break; } }
      await r.pg.waitForTimeout(2500);
      const apres = r.notes.slice();
      if (attendu === 'page') dit(valide && apres.filter((x) => x === 'page:null').length === 1 && !apres.includes('page:session'), `${ver} : « Se déconnecter » lui fait oublier sa session (l’ancien message, qu’elle comprend)`, JSON.stringify({ valide, notes: apres }));
      else dit(valide && !apres.some((x) => /^page:/.test(x)) && apres.includes('adresse:deconnexion'), `${ver} : adressée (canal de la 5.169), rien posté dans la page`, JSON.stringify({ valide, notes: apres }));
      await r.ctx.close();
    }

    console.log('── « ACTIONS POSSIBLES » AU-DESSUS D’UN « PUBLIER » GRISÉ');
    { const r = await rendre(b, { mode: 'ok', connecte: '111', version: '5.143.0', attente: 4000 }); const v = await r.lire();
      dit(v.etat && v.etat.niveau === 'ok' && v.exception === 'publication' && /sauf publier/.test(v.etat.txt), 'bordereaux possibles, publier non : l’en-tête dit « Actions possibles · sauf publier »', JSON.stringify({ etat: v.etat, exception: v.exception }));
      const p = await r.panneau();
      dit(p && /Sauf publier sur Leboncoin/.test(p.txt) && /mets l'extension à jour|Mets l'extension à jour/i.test(p.txt), 'et le panneau dit pourquoi (la même raison que le bouton)', JSON.stringify(p && p.txt).slice(0, 260));
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
