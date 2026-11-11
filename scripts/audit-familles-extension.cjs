// ════════════════════════════════════════════════════════════════════════════
//  LES RESTES DE LA REVUE DE L'EXTENSION (ext. 5.361, 11 nov., second agent),
//  JOUÉS sur le vrai code : `background.js` dans `_fond-vm.cjs`, le vrai
//  `content.js` (branché sur le MÊME stockage que le fond), le vrai
//  `orion-main.js`, et les vrais scripts de page pour les minuteries.
//   R. hautes de la revue : 21 le message de refus automatique part à la forme
//      RELEVÉE (`reply.body`) et sa place est rendue s'il est refusé ; 23 la
//      boîte aux lettres du relais (navigateur sans `tabs.sendMessage`) n'est
//      prise QUE par l'onglet visé ; 24 un relais qui a dépassé son délai n'est
//      jamais rejoué (la requête a pu partir) ; 25 `evilvinted.net` n'est pas
//      un CDN Vinted ; 26 `photosEnOctets` : hôtes, nombre, taille bornés ;
//   O. le canal privé sur Orion : capteur posé EN LIGNE (constaté) ⇒ sûr ;
//      sinon « douteux » et le fond n'en tire aucune preuve ni aucun état ;
//   puis les MOYENNES par famille, une règle chacune :
//   P. promesses non attrapées (réveils, filet `unhandledrejection`) ;
//   L. alarmes : une période changée est appliquée (jamais une alarme figée) ;
//   M. minuteries de page arrêtées quand l'extension est orpheline ;
//   S. registres `chrome.storage` bornés (les autres comptes aussi) ;
//   N. « pas su » (null) au lieu de `[]` (comptes, sbGet, sbGetTout, comptes
//      supprimés) ;
//   J. aucun `JSON.parse` hors `try` ; T. aucun écouteur `onMessage` qui
//      répond plus tard sans `return true`.
//  Usage : node scripts/audit-familles-extension.cjs [--ext dossier] [--orion dossier] [--prouve]
//  `--ext` : un autre dossier d'extension (preuve sur la branche de départ, §6.1) ;
//  `--orion` : le dossier `scripts/extension-orion` à juger avec ;
//  `--prouve` : chaque mutation (règle réaffaiblie) doit rendre un rouge.
//  Aucune donnée réelle : tout est inventé (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { MessageChannel } = require('worker_threads');
const { faireFond } = require('./_fond-vm.cjs');
const babel = require('@babel/parser');

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : null; };
const EXT = arg('--ext') || path.join(__dirname, '..', 'vinted-sync-extension');
const ORION = arg('--orion') || (arg('--ext') ? path.join(arg('--ext'), '..', 'scripts', 'extension-orion') : path.join(__dirname, 'extension-orion'));
const lire = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return ''; } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const UID = '111';
const ACC = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'j' };

// ── Une conversation avec une offre en attente (même forme que audit-offres-sures) ──
function conv({ item, tx, oid, price, user = 500 }) {
  return { capturedAt: new Date().toISOString(), payload: { conversation: {
    id: 'c' + oid, description: 'Paire', opposite_user: { id: user, login: 'acheteur' }, transaction: { item_id: String(item) },
    messages: [{ entity_type: 'offer_request_message', entity: { user_id: user, current: true, status: 10, status_title: '', price: { amount: String(price), currency_code: 'EUR' }, transaction_id: Number(tx), offer_request_id: Number(oid) } }],
  } } };
}

// ── Le vrai content.js d'un onglet, branché sur le stockage et le fond du banc ──
//    `inject` : ce que fait la page quand content.js lui passe une requête
//    (`CANCALE_VINTED_REQ`) — 'repond' (200) ou 'muet' (jamais de réponse).
function pageContent(S, f, { tabId, url, inject = 'repond', globales = {} }) {
  const ecoutes = {}, onMsg = [], vus = { req: 0 }, envois = [];
  const loc = new URL(url);
  const cw = {
    console: { log() {}, warn() {}, error() {} }, setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 40)), clearTimeout,
    setInterval: () => 0, clearInterval: () => {}, URL, MessageChannel,
    location: { host: loc.host, hostname: loc.hostname, origin: loc.origin, href: loc.href, pathname: loc.pathname },
    document: { visibilityState: 'visible', cookie: '', addEventListener() {}, removeEventListener() {}, createElement: () => ({ remove() {} }), head: { appendChild() {} }, getElementById: () => null, querySelectorAll: () => [] },
    addEventListener(t, fn) { (ecoutes[t] = ecoutes[t] || []).push(fn); }, postMessage() {}, getComputedStyle: () => ({}),
    chrome: {
      runtime: { id: 'x', getURL: (p) => p, lastError: null,
        sendMessage(m, cb) {
          envois.push(m);
          const sender = { tab: { id: tabId, url }, url, frameId: 0, id: 'x' };
          Promise.resolve(f.envoyer(m, sender)).then((r) => { if (typeof cb === 'function') cb(r); });
        },
        onMessage: { addListener(fn) { onMsg.push(fn); } } },
      storage: { local: f.ctx.chrome.storage.local, onChanged: { addListener: (fn) => f.ctx.chrome.storage.onChanged.addListener(fn) } },
    },
    ...globales,
  };
  cw.window = cw; cw.top = cw; cw.globalThis = cw; vm.createContext(cw);
  vm.runInContext(lire(S.content), cw, { filename: 'content.js' });
  // inject.js (côté page) : remet le canal, répond (ou non) aux requêtes.
  const mc = new MessageChannel();
  mc.port1.on('message', (d) => {
    if (d && d.__tag === 'CANCALE_VINTED_REQ') {
      vus.req++;
      if (inject === 'repond') mc.port1.postMessage({ __tag: 'CANCALE_VINTED_REP', id: d.id, status: 200, ok: true, json: { onglet: tabId }, origine: loc.origin });
    }
  });
  const win = vm.runInContext('window', cw);
  for (const fn of ecoutes.message || []) fn({ source: win, origin: loc.origin, data: { __tag: 'CANCALE_VINTED_CANAL' }, ports: [mc.port2] });
  // Message de page relayé (pour O) : passé par le canal, comme inject.js.
  const depuisPage = (m) => mc.port1.postMessage(Object.assign({ __tag: 'CANCALE_VINTED' }, m));
  // L'écouteur `onMessage` de content.js (le fond lui adresse `fetchPage`).
  const adresser = (m) => new Promise((res) => {
    let r = false; for (const fn of onMsg) { const x = fn(m, { id: 'x' }, (v) => res(v)); if (x === true) r = true; }
    if (!r) setTimeout(() => res(undefined), 5);
  });
  const fermer = () => { try { mc.port1.close(); } catch (_) {} };
  return { vus, envois, depuisPage, adresser, fermer, cw };
}

// Une analyse du VRAI code (pour les familles J et T) : AST de @babel/parser.
function marcher(n, fn, anc = []) {
  if (!n || typeof n.type !== 'string') return;
  fn(n, anc);
  for (const k of Object.keys(n)) {
    if (k === 'loc' || k === 'start' || k === 'end' || k === 'extra' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments') continue;
    const v = n[k];
    if (Array.isArray(v)) for (const x of v) marcher(x, fn, anc.concat(n));
    else if (v && typeof v.type === 'string') marcher(v, fn, anc.concat(n));
  }
}
const estFonction = (n) => /Function|ArrowFunction|ObjectMethod|ClassMethod/.test(n.type);
const ast = (src) => babel.parse(src, { sourceType: 'script', errorRecovery: true, allowReturnOutsideFunction: true }).program;
function parseHorsTry(src) {
  const out = [];
  marcher(ast(src), (n, anc) => {
    if (n.type !== 'CallExpression' || n.callee.type !== 'MemberExpression' || n.callee.object.name !== 'JSON' || n.callee.property.name !== 'parse') return;
    // `JSON.parse(JSON.stringify(<constante>))` d'un objet du code : sans risque.
    const a0 = n.arguments[0];
    if (a0 && a0.type === 'CallExpression' && a0.callee.type === 'MemberExpression' && a0.callee.object.name === 'JSON' && a0.arguments[0] && a0.arguments[0].type === 'MemberExpression' && /^[A-Z_]+$/.test(a0.arguments[0].object.name || '')) return;
    for (let i = anc.length - 1; i >= 0; i--) { const a = anc[i]; if (a.type === 'TryStatement' && a.block === (anc[i + 1] || n)) return; if (estFonction(a)) break; }
    out.push(n.loc.start.line);
  });
  return out;
}
function reponsesSansReturnTrue(src) {
  const out = [];
  marcher(ast(src), (n) => {
    if (n.type !== 'CallExpression' || n.callee.type !== 'MemberExpression' || n.callee.property.name !== 'addListener') return;
    const o = n.callee.object; if (o.type !== 'MemberExpression' || !/^onMessage(External)?$/.test(o.property.name || '')) return;
    const fn = n.arguments[0]; if (!fn || !estFonction(fn) || fn.params.length < 3 || fn.params[2].type !== 'Identifier') return;
    const rep = fn.params[2].name;
    marcher(fn.body, (c, anc) => {
      if (c.type !== 'CallExpression') return;
      const appel = c.callee.type === 'Identifier' && c.callee.name === rep;
      const passe = !appel && c.arguments.some((a) => a.type === 'Identifier' && a.name === rep);
      if (!appel && !passe) return;
      let iF = anc.findIndex(estFonction); if (iF < 0 && !passe) return; if (iF < 0) iF = anc.length;
      let bloc = null; for (let i = iF - 1; i >= 0; i--) if (anc[i].type === 'BlockStatement') { bloc = anc[i]; break; }
      const st = (bloc || fn.body).body || [];
      const ok = st.some((s) => s.type === 'ReturnStatement' && s.argument && ((s.argument.type === 'BooleanLiteral' && s.argument.value === true) || s.argument.type === 'CallExpression'));
      if (!ok) out.push(c.loc.start.line);
    });
  });
  return [...new Set(out)];
}

async function auditer(S) {
  const out = []; const dit = (bon, m, d) => out.push({ ok: !!bon, m, d });
  const fond = (o = {}) => faireFond({ src: S.bg, ...o });
  const essaie = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom + ' — a levé', e && (e.stack || e.message)); } };

  // ── R21 : le message de refus automatique ──
  await essaie('R21', async () => {
    const monter = (statutReponse) => {
      const f = fond({ connecte: UID, vinted: (r) => (/\/replies$/.test(r.chemin) ? { status: statutReponse, body: statutReponse === 200 ? { reply: { id: 1 } } : { message: 'refus' } } : { status: 200, body: {} }) });
      return f;
    };
    const f = monter(200);
    const r = await f.ctx.repondreOffre({ uid: UID, tx: '9001', oid: '7001', quoi: 'reject', prix: 10, conv: '555', msg: 'Merci, trop bas' });
    const env = f.j.vinted.find((v) => /\/conversations\/555\/replies$/.test(v.chemin));
    let corps = null; try { corps = JSON.parse(env && env.corps); } catch (_) {}
    dit(r && r.ok && corps && corps.reply && corps.reply.body === 'Merci, trop bas' && corps.message === undefined,
      'R21a le message de refus part à la forme RELEVÉE `{ reply: { body } }` (jamais `{ message }`)', JSON.stringify(corps));
    const nOk = ((f.store.vrmActions || {})[UID] || []).length;
    const g = monter(400);
    const r2 = await g.ctx.repondreOffre({ uid: UID, tx: '9001', oid: '7001', quoi: 'reject', prix: 10, conv: '555', msg: 'Merci, trop bas' });
    const nKo = ((g.store.vrmActions || {})[UID] || []).length;
    dit(r2 && r2.messagePasParti === true && nKo === nOk - 1, 'R21b message refusé par Vinted : sa place est RENDUE et c’est dit (`messagePasParti`)', JSON.stringify({ r2, nOk, nKo }));
  });

  // ── R23 : la boîte aux lettres adressée ──
  await essaie('R23', async () => {
    const f = fond({ retirer: ['tabs.sendMessage'], onglets: [{ id: 7, url: 'https://www.vinted.fr/', status: 'complete' }, { id: 8, url: 'https://www.vinted.com/', status: 'complete' }] });
    f.ctx.setTimeout = (fn, ms) => setTimeout(fn, Math.min(ms || 0, 300));   // le délai du fond (25 s) ramené à 300 ms, plus long que celui du relais
    const p7 = pageContent(S, f, { tabId: 7, url: 'https://www.vinted.fr/inbox' });
    const p8 = pageContent(S, f, { tabId: 8, url: 'https://www.vinted.com/inbox' });
    await attendre(40);
    const r = await f.ctx.fetchParLaPage(7, '/api/v2/inbox', {});
    let j = null; try { j = await r.json(); } catch (_) {}
    await attendre(60);
    dit(p8.vus.req === 0 && p7.vus.req === 1 && r.ok && j && j.onglet === 7,
      'R23 sans `tabs.sendMessage`, la demande de la boîte aux lettres n’est prise QUE par l’onglet visé (pas l’onglet vinted.com d’un autre compte)', JSON.stringify({ p7: p7.vus.req, p8: p8.vus.req, ok: r.ok, j }));
    p7.fermer(); p8.fermer();
  });

  // ── R24 : délai dépassé ≠ pas de relais ──
  await essaie('R24', async () => {
    const f = fond({ onglets: [{ id: 7, url: 'https://www.vinted.fr/', status: 'complete' }] });
    f.ctx.setTimeout = (fn, ms) => setTimeout(fn, Math.min(ms || 0, 300));
    const p7 = pageContent(S, f, { tabId: 7, url: 'https://www.vinted.fr/inbox', inject: 'muet' });
    await attendre(40);
    f.ctx.chrome.tabs.sendMessage = (id, m, cb) => { if (id !== 7) { cb && cb(); return; } p7.adresser(m).then((v) => cb && cb(v)); };
    const r = await f.ctx.fetchParLaPage(7, '/api/v2/transactions/1/offer_requests/2/accept', {});
    await attendre(200);
    dit(p7.vus.req === 1 && r && r.ok === false, 'R24 le relais a dépassé son délai : la MÊME requête n’est PAS renvoyée par la boîte aux lettres (elle a pu partir)', JSON.stringify({ req: p7.vus.req, ok: r && r.ok }));
    p7.fermer();
    // Un relais qui a RÉPONDU « rien » (canal absent, page hors Vinted) : pas de rejeu par la boîte.
    const g = fond({ onglets: [{ id: 7, url: 'https://www.vinted.fr/', status: 'complete' }] });
    g.ctx.setTimeout = (fn, ms) => setTimeout(fn, Math.min(ms || 0, 300));
    let boite = 0; const set0 = g.ctx.chrome.storage.local.set; g.ctx.chrome.storage.local.set = (o, cb) => { if (o && o.vrmPageReq) boite++; return set0(o, cb); };
    g.ctx.chrome.tabs.sendMessage = (id, m, cb) => { setTimeout(() => cb && cb(null), 5); };
    const r2 = await g.ctx.fetchParLaPage(7, '/api/v2/transactions/1/offer_requests/2/accept', {});
    dit(boite === 0 && r2 && r2.ok === false, 'R24b un relais qui a répondu « rien » : la requête ne repart PAS par la boîte aux lettres (seul « aucun destinataire » y passe)', JSON.stringify({ boite }));
  });

  // ── R25-26 : les photos ──
  await essaie('R25', async () => {
    const f = fond();
    const r = await f.envoyer({ from: 'vmr-bridge', action: 'photo', url: 'https://evilvinted.net/x.jpg' }, { origin: 'https://vrm.center', url: 'https://vrm.center/' });
    dit(r && r.ok === false && f.j.ailleurs.length === 0, 'R25 `https://evilvinted.net/` n’est pas le CDN de Vinted : refusé, rien téléchargé', JSON.stringify({ r, ailleurs: f.j.ailleurs }));
    const g = fond({ cdn: () => ({ status: 200, body: 'JPEG' }) });
    const r2 = await g.envoyer({ from: 'vmr-bridge', action: 'photo', url: 'https://images1.vinted.net/t/a/f800/1.jpeg' }, { origin: 'https://vrm.center', url: 'https://vrm.center/' });
    dit(r2 && r2.ok === true && /^data:image\/jpeg;base64,/.test(r2.dataUrl || ''), 'R25b une vraie photo du CDN Vinted passe (image)', JSON.stringify(r2 && { ok: r2.ok, d: String(r2.dataUrl || '').slice(0, 30) }));
  });
  await essaie('R26', async () => {
    const f = fond({ cdn: () => ({ status: 200, body: 'JPEG' }) });
    const urls = ['https://evil.example/a.jpg', 'https://evilvinted.net/b.jpg', 'http://images1.vinted.net/t/a/f800/0.jpeg'].concat(Array.from({ length: 30 }, (_, i) => `https://images1.vinted.net/t/a/f800/${i}.jpeg`));
    const ph = await f.ctx.photosEnOctets(urls, 50);
    const bonnes = (ph || []).filter((p) => p && p.b64).length;
    dit(f.j.ailleurs.length === 0 && (f.j.cdn || 0) <= 15 && bonnes > 0 && bonnes <= 15,
      'R26a `photosEnOctets` : aucun hôte hors des CDN des sites, http refusé, 15 photos au plus (le `max` du message ne dicte rien)', JSON.stringify({ ailleurs: f.j.ailleurs.map((x) => x.url), cdn: f.j.cdn, bonnes }));
    // Une photo annoncée à 50 Mo : jamais téléchargée.
    const g = fond();
    let lu = 0;
    g.ctx.fetch = async () => ({ ok: true, status: 200, headers: { get: (k) => (String(k).toLowerCase() === 'content-length' ? '50000000' : 'image/jpeg') }, arrayBuffer: async () => { lu++; return new ArrayBuffer(8); } });
    const ph2 = await g.ctx.photosEnOctets(['https://images1.vinted.net/t/a/f800/1.jpeg'], 1);
    dit(lu === 0 && ph2 && ph2[0] && !ph2[0].b64, 'R26b une photo annoncée à 50 Mo n’est PAS téléchargée (taille lue avant)', JSON.stringify({ lu, ph2 }));
    // Une réponse qui n'est pas une image.
    const h = fond();
    h.ctx.fetch = async () => ({ ok: true, status: 200, headers: { get: (k) => (String(k).toLowerCase() === 'content-type' ? 'text/html' : null) }, arrayBuffer: async () => new ArrayBuffer(8) });
    const ph3 = await h.ctx.photosEnOctets(['https://images1.vinted.net/t/a/f800/1.jpeg'], 1);
    dit(ph3 && ph3[0] && !ph3[0].b64, 'R26c une réponse `text/html` n’est pas une photo', JSON.stringify(ph3));
  });

  // ── O : le canal privé sur Orion ──
  await essaie('O', async () => {
    const suppr = (f, canalPage, globales) => new Promise(async (ok) => {
      const p = pageContent(S, f, { tabId: 7, url: 'https://www.vinted.fr/', globales });
      await attendre(30);
      p.depuisPage({ kind: 'suppression', itemId: '12345678', status: 200, at: new Date().toISOString(), canal: canalPage });
      await attendre(80); p.fermer(); ok(p);
    });
    const f = fond({ connecte: UID });
    const pf = await suppr(f, 'sur', { __vrmOrionCompat: true });
    const relaye = pf.envois.find((m) => m && m.kind === 'suppression');
    dit(relaye && relaye.canal === 'douteux' && !f.j.diags.includes('suppression_vue') && f.j.diags.some((d) => /^page_canal_douteux_suppression/.test(d)),
      'O1 Orion, capteur posé par `<script src>` : le message est marqué « douteux » par content.js (la page ne le dicte pas) et le fond n’en tire RIEN (suppression)', JSON.stringify({ canal: relaye && relaye.canal, diags: f.j.diags.slice(-4) }));
    const g = fond({ connecte: UID });
    const pg = await suppr(g, 'douteux', { __vrmOrionCompat: true, __vrmCanalInline: true });
    const r2 = pg.envois.find((m) => m && m.kind === 'suppression');
    dit(r2 && r2.canal === 'sur' && g.j.diags.includes('suppression_vue'), 'O2 Orion, capteur posé EN LIGNE avant toute page (constaté) : canal sûr, la suppression est notée', JSON.stringify({ canal: r2 && r2.canal, diags: g.j.diags.slice(-4) }));
    const h = fond({ connecte: UID });
    const ph = await suppr(h, 'douteux', {});
    const r3 = ph.envois.find((m) => m && m.kind === 'suppression');
    dit(r3 && (r3.canal === undefined || r3.canal === 'sur') && h.j.diags.includes('suppression_vue'), 'O3 Chrome (capteur du manifeste, monde MAIN) : canal sûr, rien ne change', JSON.stringify({ canal: r3 && r3.canal }));
    // orion-main.js : le capteur en ligne, constaté.
    const om = lire(path.join(S.orion, 'orion-main.js'));
    const jouer = (inlineOk, scriptsDeLaPage = 0) => {
      const attrs = {}, poses = [];
      const docEl = { setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => (k in attrs ? attrs[k] : null), removeAttribute: (k) => { delete attrs[k]; } };
      const g2 = { location: { hostname: 'www.vinted.fr' }, console: { warn() {} }, MutationObserver: class { observe() {} disconnect() {} } };
      g2.document = { documentElement: docEl, head: { appendChild(s) { poses.push(s); if (s.textContent && inlineOk) { const m = /setAttribute\(("[^"]+"),"1"\)/.exec(s.textContent); if (m) attrs[JSON.parse(m[1])] = '1'; } } },
        createElement: () => ({ remove() {} }), querySelector: (q) => (q === 'script' && scriptsDeLaPage ? {} : null) };
      g2.chrome = { runtime: { getURL: (p) => 'chrome-extension://x/' + p } };
      g2.globalThis = g2; vm.createContext(g2);
      const src = om.replace('null;/*__VRM_SOURCES_PAGE__*/', () => JSON.stringify({ 'inject.js': '/* capteur */' }) + ';');
      vm.runInContext(src, g2);
      return { inline: g2.__vrmCanalInline, srcPose: poses.some((s) => s.src), poses: poses.length };
    };
    const a = jouer(true), b = jouer(false), c = jouer(true, 1);
    dit(a.inline === true && !a.srcPose && b.inline === false && b.srcPose,
      'O4 orion-main.js : capteur EN LIGNE exécuté ⇒ canal sûr, aucune balise `src` ; refusé par la page ⇒ balise `src` et canal « douteux »', JSON.stringify({ a, b }));
    dit(c.inline === false, 'O4b un script de la page est DÉJÀ dans le document (il a pu tourner) : même posé en ligne, le canal reste « douteux »', JSON.stringify(c));
    const zip = require('./zip-extension.cjs');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-orion-src-'));
    try {
      fs.writeFileSync(path.join(tmp, 'orion-main.js'), om); fs.writeFileSync(path.join(tmp, 'inject.js'), lire(S.inject));
      if (typeof zip.sourcesEnLigne !== 'function') dit(false, 'O5 le paquet Orion reçoit la source d’inject.js (`sourcesEnLigne`)');
      else { zip.sourcesEnLigne(path.join(tmp, 'orion-main.js'), tmp); const t = lire(path.join(tmp, 'orion-main.js')); dit(t.includes('CANCALE_VINTED_CANAL') && !t.includes('__VRM_SOURCES_PAGE__'), 'O5 le paquet Orion reçoit la source d’inject.js, posée en ligne'); }
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  // ── P : promesses non attrapées ──
  await essaie('P', async () => {
    const f = fond();
    let rejets = 0; const compter = () => { rejets++; };
    process.on('unhandledRejection', compter);
    try {
      f.ctx.tickPhotos = async () => { throw new Error('panne inventée'); };
      f.ctx.surAlarme({ name: 'vrm-photos' });
      await attendre(40);
    } finally { process.removeListener('unhandledRejection', compter); }
    dit(rejets === 0 && f.j.diags.includes('promesse_photos'), 'P1 une tâche de réveil qui échoue est NOTÉE, jamais un rejet non attrapé', JSON.stringify({ rejets, diags: f.j.diags.slice(-3) }));
    const l = (f.j.globales && f.j.globales.unhandledrejection) || [];
    let empeche = false; for (const fn of l) fn({ preventDefault() { empeche = true; } });
    dit(l.length >= 1 && empeche && f.j.diags.includes('promesse_non_attrapee'), 'P2 filet commun : `unhandledrejection` est écouté, noté et étouffé', JSON.stringify({ n: l.length, empeche }));
  });

  // ── L : alarmes ──
  await essaie('L', async () => {
    const f = fond();
    const crees = [];
    f.ctx.chrome.alarms.get = (nom, cb) => cb({ name: nom, periodInMinutes: 99 });
    f.ctx.chrome.alarms.create = (nom, o) => { crees.push([nom, o && o.periodInMinutes]); };
    f.ctx.alarmeSiAbsente('cancale-sync', { periodInMinutes: 10 });
    const g = fond(); const crees2 = [];
    g.ctx.chrome.alarms.get = (nom, cb) => cb({ name: nom, periodInMinutes: 10 });
    g.ctx.chrome.alarms.create = (nom, o) => { crees2.push(nom); };
    g.ctx.alarmeSiAbsente('cancale-sync', { periodInMinutes: 10 });
    dit(crees.length === 1 && crees[0][1] === 10 && crees2.length === 0, 'L1 une alarme d’une AUTRE période (version précédente) est recréée ; même période ⇒ rien (le réveil n’est pas repoussé)', JSON.stringify({ crees, crees2 }));
  });

  // ── M : minuteries de page orphelines ──
  await essaie('M', async () => {
    const minuteries = []; const arretees = [];
    const runtime = { id: 'x', getURL: (p) => p, lastError: null, sendMessage(m, cb) { if (m && m.from === 'vrm-cookies' && m.action === 'veux') { cb && cb({ ok: true, veux: true }); return; } cb && cb({ ok: true }); }, onMessage: { addListener() {} } };
    const cw = {
      console: { log() {}, warn() {}, error() {} }, setTimeout: () => 0, clearTimeout() {}, URL, MessageChannel,
      setInterval: (fn, ms) => { minuteries.push({ fn, ms, id: minuteries.length + 1 }); return minuteries.length; }, clearInterval: (id) => { arretees.push(id); },
      location: { host: 'www.vinted.fr', hostname: 'www.vinted.fr', origin: 'https://www.vinted.fr', href: 'https://www.vinted.fr/' },
      document: { visibilityState: 'visible', cookie: '', addEventListener() {}, createElement: () => ({}), head: { appendChild() {} }, getElementById: () => null },
      addEventListener() {}, postMessage() {},
      chrome: { runtime, storage: { local: { get(k, cb) { if (cb) cb({}); return Promise.resolve({}); }, set() { return Promise.resolve(); } }, onChanged: { addListener() {} } } },
    };
    cw.window = cw; cw.top = cw; cw.globalThis = cw; vm.createContext(cw);
    vm.runInContext(lire(S.content), cw, { filename: 'content.js' });
    const permanente = minuteries.find((m) => m.ms === 10000);
    delete runtime.id;                               // l'extension est mise à jour : ce content.js est orphelin
    if (permanente) permanente.fn();
    dit(permanente && arretees.includes(permanente.id), 'M1 content.js : la minuterie des cookies (10 s) s’ARRÊTE quand l’extension est orpheline', JSON.stringify({ n: minuteries.length, arretees }));
    // Les autres scripts de page : aucune minuterie permanente nue.
    const nues = [];
    for (const nom of ['vinted-capture.js', 'vinted-infos.js', 'ebay.js', 'vc-depot.js', 'lbc.js', 'content.js']) {
      const src = lire(path.join(S.dossier, nom));
      marcher(ast(src), (n, anc) => {
        if (n.type !== 'CallExpression' || n.callee.type !== 'Identifier' || n.callee.name !== 'setInterval') return;
        const p = anc[anc.length - 1];
        const assigne = p && (p.type === 'AssignmentExpression' || p.type === 'VariableDeclarator');
        const dansAide = anc.some((a) => a.type === 'VariableDeclarator' && a.id && a.id.name === 'minuterieVivante');
        if (!assigne && !dansAide) nues.push(nom + ':' + n.loc.start.line);
      });
    }
    dit(nues.length === 0, 'M2 scripts de page (capture, infos, eBay, Vestiaire, Leboncoin, content) : aucune minuterie permanente qui survit à l’extension', nues.join(' · '));
  });

  // ── S : registres bornés ──
  await essaie('S', async () => {
    const vieux = Date.now() - 3 * 3600e3, recent = Date.now() - 60e3;
    const f = fond({ store: { vrmActions: { 222: [vieux, vieux], 333: [recent] }, vrmLectures: { 222: [vieux], 333: [recent] }, vrmRepubJour: { 222: [Date.now() - 2 * 864e5] } } });
    await f.ctx.compterAction(UID, 50);
    await f.ctx.compterLecture(UID, 20);
    await f.ctx.noterRepubJour(UID);
    const a = f.store.vrmActions || {}, l = f.store.vrmLectures || {}, r = f.store.vrmRepubJour || {};
    dit(!a['222'] && Array.isArray(a['333']) && Array.isArray(a[UID]) && !l['222'] && Array.isArray(l['333']) && !r['222'] && Array.isArray(r[UID]),
      'S1 `vrmActions`, `vrmLectures`, `vrmRepubJour` : les entrées périmées des AUTRES comptes partent à l’écriture (les récentes restent)', JSON.stringify({ a: Object.keys(a), l: Object.keys(l), r: Object.keys(r) }));
    const beaucoup = {}; for (let i = 0; i < 500; i++) beaucoup[String(1000 + i)] = { at: Date.now() - i * 1000, domain: 'www.vinted.fr', raison: 'x' };
    const g = fond({ store: { vrmRefus: beaucoup } });
    await g.ctx.noterRefus(UID, 'www.vinted.fr', 'banc');
    const n = Object.keys(g.store.vrmRefus || {}).length;
    dit(n <= 100 && (g.store.vrmRefus || {})[UID], 'S2 `vrmRefus` : 100 comptes au plus (les plus récents gardés)', `${n} clés`);
  });

  // ── N : « pas su » au lieu de [] ──
  await essaie('N', async () => {
    const f = fond({ vraisComptes: true, lectureKO: (u) => /vinted_accounts/.test(u) });
    const c = await f.ctx.getStoredAccounts({ ouNull: true });
    const r = await f.envoyer({ from: 'vmr-bridge', action: 'exec', uid: UID, method: 'PUT', endpoint: '/api/v2/transactions/1/offer_requests/2/reject' }, { origin: 'https://vrm.center', url: 'https://vrm.center/' });
    const ro = await f.ctx.repondreOffre({ uid: UID, tx: '1', oid: '2', quoi: 'accept' });
    dit(c === null && r && r.code === 'pas-su' && ro && ro.code === 'pas-su' && f.j.vinted.length === 0,
      'N1 comptes illisibles : « pas su » (réessaie), jamais « compte introuvable » ; rien ne part', JSON.stringify({ c, r, ro }));
    const g = fond();
    const f0 = g.ctx.fetch; g.ctx.fetch = (u, o) => (/id=eq\.forme_objet/.test(String(u)) ? Promise.resolve({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ message: 'objet' }) }) : f0(u, o));
    const lu = await g.ctx.sbGet('app_data?id=eq.forme_objet&select=id');
    dit(lu === null, 'N2 `sbGet` : un objet d’erreur n’est pas une liste ⇒ null', JSON.stringify(lu));
    const h = fond();
    h.ctx.fetch = async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => Array.from({ length: 1000 }, (_, i) => ({ id: 'x' + i })) });
    const tout = await h.ctx.sbGetTout('app_data?select=id');
    dit(tout === null, 'N3 `sbGetTout` au-delà du garde-fou : null (jamais une liste tronquée présentée comme complète)', Array.isArray(tout) ? `${tout.length} lignes` : String(tout));
  });
  await essaie('N4', async () => {
    const k = fond({ lectureKO: (u) => /vrm_blocked_accounts/.test(u) });
    const nc = await k.ctx.compteNonCapte(UID);
    dit(nc === true, 'N4 liste des comptes supprimés illisible : la capture n’écrit RIEN (« pas su » ne vaut pas « pas supprimé »)', String(nc));
  });

  // ── J / T : sur le texte du vrai code ──
  {
    const fichiers = fs.readdirSync(S.dossier).filter((x) => /\.js$/.test(x));
    const parse = [], rep = [];
    for (const nom of fichiers) {
      const src = lire(path.join(S.dossier, nom));
      try { for (const l of parseHorsTry(src)) parse.push(nom + ':' + l); } catch (e) { parse.push(nom + ' illisible'); }
      try { for (const l of reponsesSansReturnTrue(src)) rep.push(nom + ':' + l); } catch (e) { rep.push(nom + ' illisible'); }
    }
    dit(parse.length === 0, 'J1 aucun `JSON.parse` hors `try` dans l’extension (une valeur illisible ne fait plus lever une minuterie ni un geste)', parse.join(' · '));
    dit(rep.length === 0, 'T1 aucun écouteur `onMessage` qui répond PLUS TARD sans `return true` (la réponse serait perdue)', rep.join(' · '));
  }
  return out;
}

// ── Mutations : la règle réaffaiblie doit rendre un rouge ──
const MUTATIONS = [
  ['bg', 'le refus part en { message }', 'corpsReponseVinted(msg), { timeoutMs: 12000 });', '{ message: String(msg) }, { timeoutMs: 12000 });', 'R21a'],
  ['bg', 'la place du message refusé n’est pas rendue', 'if (!parti) { if (c2.at) await rendreActions(String(uid), c2.at, 1);', 'if (!parti) { if (false) await rendreActions(String(uid), c2.at, 1);', 'R21b'],
  ['content', 'n’importe quel onglet prend la boîte', '        if (monOnglet == null || req.tab !== monOnglet) return;', '', 'R23'],
  ['bg', 'un relais qui a répondu est rejoué', "          if (err) demandeParStockage(req, fin); else fin(null);", '          demandeParStockage(req, fin);', 'R24b'],
  ['bg', 'liste blanche du pont relâchée', "if (!urlPhotoPermise(msg.url, /^(?:[a-z0-9-]+\\.)*vinted\\.net$/i))", "if (!/^https:\\/\\/[\\w.-]*vinted\\.net\\//i.test(String(msg.url || '')))", 'R25'],
  ['bg', 'photosEnOctets sans liste d’hôtes', "    if (!urlPhotoPermise(u)) { out.push({ url: String(u).slice(0, 200), erreur: 'adresse non autorisée' }); continue; }", '', 'R26a'],
  ['bg', 'photosEnOctets : le max dicté par le message', 'Math.min(PHOTOS_MAX, Math.floor(Number(max)) || 12)', '(Math.floor(Number(max)) || 12)', 'R26a'],
  ['bg', 'taille lue après le téléchargement', "      if (isFinite(annonce) && annonce > PHOTO_MAX_OCTETS) { out.push({ url: u, erreur: 'trop lourde' }); continue; }", '', 'R26b'],
  ['bg', 'n’importe quelle réponse est une photo', "      if (!type) { out.push({ url: u, erreur: 'pas une image' }); continue; }", '', 'R26c'],
  ['content', 'Orion : canal toujours « sûr »', "return !globalThis.__vrmOrionCompat || globalThis.__vrmCanalInline === true;", 'return true;', 'O1'],
  ['bg', 'le fond croit un canal douteux', "if (PAGE_SORTES_PREUVE.has(String(msg.kind || '')) && canalPageDouteux(msg))", 'if (false)', 'O1'],
  ['content', 'le canal n’est plus posé par content.js', "      m.canal = canalSur() ? 'sur' : 'douteux';\n", '', 'O1'],
  ['orion', 'orion-main ne constate rien', "if(enLigne(racine)){globalThis.__vrmCanalInline=vierge;return true;}", 'if(false){}', 'O4'],
  ['orion', 'une page déjà là ne compte pas', "vierge=!document.querySelector('script');", "vierge=true;", 'O4b'],
  ['bg', 'un réveil sans sansRejet', "if (a.name === 'vrm-photos') lance('photos', () => tickPhotos());", "if (a.name === 'vrm-photos') tickPhotos();", 'P1'],
  ['bg', 'plus de filet unhandledrejection', "    self.addEventListener('unhandledrejection', (e) => {", "    (() => {})('unhandledrejection', (e) => {", 'P2'],
  ['bg', 'alarme figée à sa période', "if (!a || (voulue != null && Number(a.periodInMinutes) !== Number(voulue)))", 'if (!a)', 'L1'],
  ['content', 'minuterie de cookies nue', "      minuterieVivante(() => { if (document.visibilityState !== 'hidden') envoyerCookies(); }, 10000);", "      setInterval(() => { if (document.visibilityState !== 'hidden') envoyerCookies(); }, 10000);", 'M1'],
  ['bg', 'vrmActions des autres comptes gardés', "await chrome.storage.local.set({ [cle]: bornerRegistre(cur, 3600000, 200) });\n    if (!/^vc:/.test(String(uid))) await publierActions(uid, list);", "await chrome.storage.local.set({ [cle]: cur });\n    if (!/^vc:/.test(String(uid))) await publierActions(uid, list);", 'S1'],
  ['bg', 'vrmRefus sans borne', 'await chrome.storage.local.set({ vrmRefus: bornerRegistre(cur, 30 * 864e5, 100) });', 'await chrome.storage.local.set({ vrmRefus: cur });', 'S2'],
  ['bg', 'comptes illisibles ⇒ []', "if (accts === null) return { ok: false, code: 'pas-su', error: 'tes comptes n’ont pas pu être relus — rien n’est parti, réessaie' };\n  const acc = accts.find((a) => String(a.vinted_user_id) === String(msg.uid));", "const acc = (accts || []).find((a) => String(a.vinted_user_id) === String(msg.uid));", 'N1'],
  ['bg', 'sbGet croit un objet', "pas une liste ⇒ « pas su ».\n    if (!Array.isArray(rows)) return null;", "pas une liste.", 'N2'],
  ['bg', 'sbGetTout tronqué rendu complet', "if (de > 100000) { noterDiag('sb_tout_tronque'); return null; }", 'if (de > 100000) return out;', 'N3'],
  ['bg', 'comptes supprimés illisibles ⇒ capter', '  if (l == null) return null;\n', '', 'N4'],
  ['inject', 'flushSeen sans try', "    try {\n      conversation = relConvDirty ? JSON.parse(JSON.stringify(relConv)) : null;", "    conversation = relConvDirty ? JSON.parse(JSON.stringify(relConv)) : null;\n    try {\n      void 0;", 'J1'],
  ['bg', 'une réponse tardive sans return true', "    retourSurVinted(sender).then(sendResponse, () => sendResponse({ ok: false }));\n    return true;", "    retourSurVinted(sender).then(sendResponse, () => sendResponse({ ok: false }));", 'T1'],
];

function chemins(dossier, orion) {
  return { dossier, bg: path.join(dossier, 'background.js'), content: path.join(dossier, 'content.js'), inject: path.join(dossier, 'inject.js'), orion };
}

(async () => {
  const S = chemins(EXT, ORION);
  const res = await auditer(S);
  let rouges = 0;
  for (const r of res) { console.log(`${r.ok ? '✅' : '❌'} ${r.m}${r.ok || !r.d ? '' : '\n     ' + String(r.d).slice(0, 600)}`); if (!r.ok) rouges++; }
  console.log(`\n${res.length - rouges}/${res.length} verts`);
  if (process.argv.includes('--prouve')) {
    let tenues = 0;
    for (const [qui, nom, a, b, attendu] of MUTATIONS) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-familles-'));
      const d = path.join(tmp, 'ext'), o = path.join(tmp, 'orion');
      fs.cpSync(EXT, d, { recursive: true }); fs.cpSync(ORION, o, { recursive: true });
      const fichier = qui === 'bg' ? path.join(d, 'background.js') : qui === 'content' ? path.join(d, 'content.js') : qui === 'inject' ? path.join(d, 'inject.js') : path.join(o, 'orion-main.js');
      const src = lire(fichier);
      if (!src.includes(a)) { console.log(`❌ mutation « ${nom} » : texte introuvable`); rouges++; fs.rmSync(tmp, { recursive: true, force: true }); continue; }
      fs.writeFileSync(fichier, src.replace(a, () => b));
      const r = await auditer(chemins(d, o));
      const rouge = r.filter((x) => !x.ok).map((x) => x.m.split(' ')[0]);
      const vise = rouge.some((x) => x === attendu || x.startsWith(attendu));
      console.log(`${vise ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge.length ? 'rouge : ' + rouge.join(', ') : 'TOUT VERT (le contrôle ne la voit pas)'}`);
      if (vise) tenues++; else rouges++;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    console.log(`\n${tenues}/${MUTATIONS.length} mutations rendent leur rouge`);
  }
  process.exit(rouges ? 1 : 0);
})();
