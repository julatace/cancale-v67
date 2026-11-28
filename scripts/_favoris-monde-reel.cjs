// ════════════════════════════════════════════════════════════════════════════
//  5.455.8 — LE MONDE RÉEL DES FAVORIS, DE BOUT EN BOUT (audit-favoris-envoi-direct, banc favoris-envoi-direct)
//  · la VRAIE route du serveur (api/compte.js → api/_lib/favoris.js → favoris-file.js / favoris-carte.js) sur la fausse base
//    à état de audit-favoris-auto.cjs (projection `select=`, filtres, service / vendeur) ;
//  · le VRAI background.js (scripts/_fond-vm.cjs), ses appels à https://vrm.center/api/compte branchés sur cette route ;
//  · un faux Vinted à la forme mesurée (inquiries → conversation → transaction → offre → réponse, 5.455 « comme Vintex ») ;
//  · le VRAI panneau (vrm-badge.js + vrm-ui.js) dans Chromium : chaque `chrome.runtime.sendMessage` du panneau part au vrai
//    background.js (onglet vinted.fr du compte), chaque changement de `vrmFavorisCarte` lui est signalé.
//  Une horloge commune (le serveur, le fond) que l'appelant avance. Données inventées (le dépôt est public).
//  `racine` : l'arbre jugé (un arbre d'avant pour la preuve §6.1).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), vm = require('vm');
const UID = '123', H = 3600000;
const ITEMS = ['7000000180', '7000000181', '7000000182'], ACH = ['3000000001', '3000000002', '3000000003'];
const UUIDS = ACH.map((a, i) => `0${i}a1fdff-71a1-4c2b-9d3e-0123456789ab`), TX = [6000, 6001, 6002];

function faireBaseServeur(racineScripts) {
  const srcAuto = fs.readFileSync(path.join(racineScripts, 'audit-favoris-auto.cjs'), 'utf8');
  // eslint-disable-next-line no-eval
  return eval('(()=>{const U="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",UID="123";' + srcAuto.slice(srcAuto.indexOf('function lirChemin'), srcAuto.indexOf('// ── Le monde du vendeur')) + ';return {faireBase};})()').faireBase;
}
function appel(handler, b, url, op) {
  const u = new URL(url); const q = Object.fromEntries(u.searchParams.entries()); const corps = op && op.body ? op.body : undefined;
  return new Promise((ok, ko) => {
    let code, body; const res = { setHeader() {}, status(v) { code = v; return this; }, json(v) { body = v; return this; }, end() { return this; } };
    const req = { method: (op && op.method) || 'GET', query: q, headers: { authorization: 'Bearer banc.session.jwt', 'content-type': 'application/json' }, body: corps ? JSON.parse(corps) : undefined,
      on(ev, fn) { if (ev === 'data' && corps) fn(Buffer.from(corps)); if (ev === 'end') fn(); return this; }, [Symbol.asyncIterator]: async function* () { if (corps) yield Buffer.from(corps); } };
    global.fetch = b.fetch;
    Promise.resolve(handler(req, res)).then(() => ok({ code, body }), ko);
  });
}

// opts : n (favoris montrés, 2 par défaut) · dressingAncien · avant(b, horloge) : l'état du serveur à poser avant (file restée
//   active, envoi incertain…) · vinted(e) : une réponse de Vinted à substituer (null ⇒ celle par défaut).
async function monde(racine, opts = {}) {
  const S = path.join(racine, 'scripts');
  const { default: handler } = await import(path.join(racine, 'api', 'compte.js') + '?r=' + Math.random());
  process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  const T0 = Date.parse('2026-11-28T11:00:00Z');
  const h = { t: T0 };
  const vraiNow = Date.now; Date.now = () => h.t;
  const faireBase = faireBaseServeur(S);
  const b = faireBase();
  const n = opts.n || 2;
  const notif = (i) => ({ id: 'jn' + i, user_id: 9000000001, body: 'Quelqu’un a ajouté ton article à ses favoris.', link: `/items/${ITEMS[i]}/want_it/new?offering_id=${ACH[i]}`, created_at: new Date(opts.notifAt ? opts.notifAt(i, T0) : T0 - (i + 1) * H).toISOString() });
  b.poser(`harvest_${UID}_notifications`, { uid: UID, type: 'notifications', domain: 'www.vinted.fr', payload: { notifications: Array.from({ length: n }, (_, i) => notif(i)) } });
  b.poser(`vrm_favoris_reglages_${UID}`, { version: 1, envoisActifs: false, message: 'Bonjour, il te plaît toujours ?', pourcentage: 10, offreMode: 'pct', offreValeur: null, arrondi: false, intervalleMinutes: 0, intervalleMaxMinutes: null });
  b.poser(`harvest_${UID}_listings`, { capturedAt: new Date(T0 - (opts.dressingAncien ? 30 * H : H)).toISOString(), payload: { pagination: { total_entries: n }, items: ITEMS.slice(0, n).map((id) => ({ id: Number(id), title: 'salomon XT-6 ' + id.slice(-3), price: { amount: '55.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, is_reserved: false })) } });
  b.poser('main', { vinted_offres_garde: null });
  const call = (action, extra = {}) => appel(handler, b, 'https://vrm.center/api/compte?mode=favoris&uid=' + UID + (action ? '' : '&carte=1'), action ? { method: 'POST', body: JSON.stringify(Object.assign({ action }, extra, { carte: true })) } : { method: 'GET' });
  if (opts.avant) await opts.avant({ b, call, h, UID, ITEMS, ACH });
  const { faireFond } = require(path.join(S, '_fond-vm.cjs'));
  const ACC = { vinted_user_id: UID, login: 'jujuf38', domain: 'www.vinted.fr', access_token: 'jeton' };
  const vintedDefaut = (e) => {
    if (e.methode === 'POST' && e.chemin === '/messaging/main/inquiries') { const c = JSON.parse(e.corps || '{}'); const i = ACH.indexOf(String(c.receiver_id)); return i < 0 ? { status: 422, body: {} } : { status: 201, body: { inquiry_id: 'q' + i, transaction_id: TX[i], conversation_id: UUIDS[i], read_after_write_token: 'eyJhbGc.x.y' } }; }
    const mc = /^\/messaging\/main\/conversations\/([0-9a-f-]{36})$/.exec(e.chemin.split('?')[0]);
    if (e.methode === 'GET' && mc) { const i = UUIDS.indexOf(mc[1]); return { status: 200, body: { conversation: { id: mc[1], allow_reply: true, opposite_users: [{ id: Number(ACH[i]) }], data: {}, messages: [] } } }; }
    const mt = /^\/api\/v2\/transactions\/(\d+)$/.exec(e.chemin);
    if (e.methode === 'GET' && mt) { const i = TX.indexOf(Number(mt[1])); return { status: 200, body: { transaction: { id: TX[i], item_id: Number(ITEMS[i]), buyer_id: Number(ACH[i]), seller_id: Number(UID), item_title: 'salomon XT-6', item: { id: Number(ITEMS[i]), price: { amount: '55.0', currency_code: 'EUR' } } } } }; }
    if (e.methode === 'POST' && /^\/api\/v2\/transactions\/\d+\/offers$/.test(e.chemin)) return { status: 200, body: { code: 0 } };
    if (e.methode === 'POST' && /^\/messaging\/main\/conversations\/[0-9a-f-]{36}\/replies$/.test(e.chemin)) return { status: 201, body: { ok: true } };
    if (e.methode === 'GET' && e.chemin === '/api/v2/authorization/check/phone_verification') return { status: 200, body: {} };
    return { status: 404, body: {} };
  };
  const f = faireFond({ src: path.join(racine, 'vinted-sync-extension', 'background.js'), connecte: UID, comptes: [ACC],
    // La MÊME base pour le fond et le serveur (comme Supabase) : ce que le fond ne porte pas lui-même (réglages des favoris,
    //    file du serveur…) se lit dans la base du serveur.
    lignes: new Proxy({ main: { vinted_annonce_numeros: Object.fromEntries(ITEMS.map((id, i) => [id, { numero: String(180 + i), min: '40' }])) } }, {
      get: (t, k) => (k in t ? t[k] : typeof k === 'string' ? ([...b.lignes.values()].find((r) => r.id === k) || {}).data : undefined),
      has: (t, k) => k in t || (typeof k === 'string' && [...b.lignes.values()].some((r) => r.id === k)),
      ownKeys: (t) => [...new Set([...Reflect.ownKeys(t), ...[...b.lignes.values()].map((r) => r.id)])],
      getOwnPropertyDescriptor: (t, k) => (k in t ? Reflect.getOwnPropertyDescriptor(t, k) : [...b.lignes.values()].some((r) => r.id === k) ? { configurable: true, enumerable: true, writable: true, value: ([...b.lignes.values()].find((r) => r.id === k) || {}).data } : undefined),
    }),
    store: { __commeBleamDefaut: true, __favorisVintex: true, vrmChoixComptes: { [UID]: { choix: 'oui', login: 'jujuf38', at: 1 } }, vrmSession: { access_token: 'jeton.banc.defaut', refresh_token: 'r', user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'banc@vrm.test', expires_at: Date.now() + 365 * 864e5 } },
    vinted: (e) => (opts.vinted && opts.vinted(e)) || vintedDefaut(e) });
  vm.runInContext('Date.now = () => __h();', Object.assign(f.ctx, { __h: () => h.t }));
  const fetchFond = f.ctx.fetch;
  const vrmAppels = [];
  f.ctx.fetch = async (url, op = {}) => {
    if (String(url).startsWith('https://vrm.center/api/compte')) { const r = await appel(handler, b, url, op); vrmAppels.push((op.body ? JSON.parse(op.body).action : 'GET') + ':' + r.code); return { ok: r.code >= 200 && r.code < 300, status: r.code, json: async () => r.body }; }
    return fetchFond(url, op);
  };
  f.ctx.notifierApp = async () => {};
  f.ctx.__vrmPausesVues = [];
  const sender = { tab: { id: 7, url: 'https://www.vinted.fr/catalog' }, url: 'https://www.vinted.fr/catalog', origin: 'https://www.vinted.fr' };
  const fileServeur = () => [...b.lignes.values()].find((r) => /^favoris_file_/.test(r.id))?.data || null;
  const fin = () => { Date.now = vraiNow; };
  // Les tours de la file de l'extension (le réveil de Chrome) : l'horloge saute à l'heure prévue du prochain.
  async function tours(max = 10, pause = null) {
    const vus = [];
    for (let k = 0; k < max; k++) {
      await f.ctx.tickFavorisCarte();
      if (pause) await pause();
      const st = f.store.vrmFavorisCarte || {};
      vus.push({ actif: st.actif, attente: st.attente || null, quoi: st.quoi || '', jobs: st.jobs || null, prochain: st.prochain ? st.prochain - h.t : null });
      if (!st.actif) break;
      h.t = st.prochain && st.prochain > h.t ? st.prochain + 10 : h.t + 1000;
    }
    return vus;
  }
  return { f, b, call, h, sender, fileServeur, fin, tours, vrmAppels, UID, ITEMS, ACH, UUIDS, TX, T0 };
}

// Le panneau dans Chromium, branché sur le vrai fond du monde `m`.
async function ouvrirPanneau(nav, m, racine, { largeur = 1512, hauteur = 900, scheme = 'light', mobile = false } = {}) {
  const EXT = path.join(racine, 'vinted-sync-extension');
  const ctx = await nav.newContext(Object.assign({ viewport: { width: largeur, height: hauteur }, colorScheme: scheme }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 300)));
  const recus = [];
  await pg.route('**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;font-family:sans-serif"><header style="height:64px;border-bottom:1px solid #ddd;padding:20px">Vinted</header><main style="padding:20px;height:1600px">Annonces…</main></body></html>' }));
  await pg.exposeFunction('__bg', async (msg) => { const r = await m.f.envoyer(msg, m.sender); if (msg && msg.action === 'favorisCarte') recus.push({ quoi: msg.quoi, msg, r: r === undefined ? null : JSON.parse(JSON.stringify(r)) }); return r === undefined ? null : JSON.parse(JSON.stringify(r)); });
  await pg.goto('https://www.vinted.fr/catalog');
  await pg.evaluate(({ js, ui, version }) => {
    const orig = Element.prototype.attachShadow; Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    window.__ecoutes = [];
    const copie = (x) => JSON.parse(JSON.stringify(x));
    window.chrome = { runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version }), lastError: null,
      sendMessage: (msg, cb) => { window.__bg(copie(msg)).then((r) => cb && cb(r === null ? undefined : r)); } },
      storage: { local: { get: (k, cb) => { const S = window.__st = window.__st || {}; const ks = Array.isArray(k) ? k : typeof k === 'string' ? [k] : Object.keys(k || {}); const out = {}; for (const x of ks) if (S[x] !== undefined) out[x] = copie(S[x]); if (cb) setTimeout(() => cb(out), 0); return Promise.resolve(out); }, set: (o, cb) => { window.__st = Object.assign(window.__st || {}, copie(o)); if (cb) setTimeout(cb, 0); return Promise.resolve(); }, remove: (k, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener(fn) { window.__ecoutes.push(fn); } } } };
    const u = document.createElement('script'); u.textContent = ui; document.documentElement.appendChild(u);
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { js: fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8'), ui: fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8'), version: JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version });
  m.f.ctx.chrome.storage.onChanged.addListener((ch) => { const k = Object.keys(ch).filter((x) => /^vrmFavoris(Carte|ListeLue)$/.test(x)); if (k.length) pg.evaluate((ks) => { for (const l of window.__ecoutes) try { l(Object.fromEntries(ks.map((x) => [x, { newValue: 1 }])), 'local'); } catch (_) {} }, k).catch(() => {}); });
  await pg.waitForTimeout(500);
  // Chaque fois que le panneau montre « Tes favoris n'ont pas pu être lus » (même un instant) : noté, avec sa phrase.
  await pg.evaluate(() => { window.__vuLecture = []; const h = document.getElementById('vrm-badge'); const r = h && h.shadowRoot; if (!r) return;
    new MutationObserver(() => { const e = r.querySelector('[data-fav-erreur]'); if (e) window.__vuLecture.push(e.textContent.slice(0, 300)); }).observe(r, { childList: true, subtree: true }); });
  const R = (fn, a) => pg.evaluate(fn, a);
  const clic = async (sel) => { const n = await R((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) { b.click(); return 1; } return 0; }, sel); await pg.waitForTimeout(450); return n; };
  const ouvrirFavoris = async () => {
    const bb = await R(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
    if (mobile) await pg.touchscreen.tap(bb.x, bb.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(bb.x, bb.y); await pg.mouse.click(bb.x, bb.y); }
    await pg.waitForTimeout(500);
    if (!(await clic('.side6 [data-onglet-b="favoris"]'))) await clic('[data-onglet-b="favoris"]');
    await pg.waitForTimeout(1200);
  };
  // Ce que montre le panneau : le texte, les rangées (état, raisons), la phrase d'erreur de lecture.
  const lire = () => R(() => {
    const r = document.getElementById('vrm-badge').shadowRoot, c = r.querySelector('.carte');
    const rangs = Array.from(r.querySelectorAll('.fav6-table .rangs > li[data-fav-qui]'));
    return { texte: c ? c.innerText.replace(/\s+/g, ' ') : '', erreurLecture: !!r.querySelector('[data-fav-erreur]'), tableau: !!r.querySelector('.fav6-table'),
      rangs: Object.fromEntries(rangs.map((li) => [li.getAttribute('data-fav-qui'), { etat: li.getAttribute('data-fav-etat6'), texte: li.innerText.replace(/\s+/g, ' '), refus: (li.querySelector('[data-fav-refus6]') || {}).textContent || '', un: !!li.querySelector('[data-fav6-un]') }])),
      etape: (r.querySelector('.fav6-feuille [data-fav-etape]') || { getAttribute: () => null }).getAttribute('data-fav-etape'),
      lancer: !!r.querySelector('.fav6-feuille [data-fav-lancer]'), html: c ? c.innerHTML : '', vuLecture: (window.__vuLecture || []).slice() };
  });
  return { ctx, pg, erreurs, recus, R, clic, ouvrirFavoris, lire };
}
module.exports = { monde, ouvrirPanneau, UID, ITEMS, ACH };
