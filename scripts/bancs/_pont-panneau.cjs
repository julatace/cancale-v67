// ════════════════════════════════════════════════════════════════════════════
//  LE PONT PANNEAU ↔ FOND (22 nov., audit complet de l'extension)
//
//  Les bancs du panneau servaient un faux `chrome.runtime.sendMessage` écrit à la main : il répondait ce que
//  l'auteur du banc CROYAIT que le fond répond. Un bouton dont le message n'a aucun gestionnaire, ou dont la
//  forme n'est pas celle que le fond lit, y passait vert.
//  Ici le VRAI panneau (vrm-ui.js, vrm-mots.js, vrm-depot.js, vrm-badge.js, dans un vrai Chromium) parle au
//  VRAI `background.js` (scripts/_fond-vm.cjs : fausse base à état, faux Vinted qui compte, faux vrm.center
//  avec la VRAIE file des favoris du serveur). `chrome.storage.local` de la page EST celui du fond (les
//  changements reviennent par `onChanged`). Chaque message est noté avec sa réponse :
//    · `muet`  : le fond n'a rien répondu (aucun gestionnaire, ou un `return` sans réponse) ;
//    · `leve`  : le gestionnaire a levé.
//  Tout est inventé (le dépôt est public). `BANC_EXT=<arbre>/vinted-sync-extension` : une autre copie de
//  l'extension (preuve sur le code d'avant, §6.1) — panneau ET fond.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..', '..');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const { faireFond } = require(path.join(RACINE, 'scripts', '_fond-vm.cjs'));
const lireExt = (f) => (fs.existsSync(path.join(EXT, f)) ? fs.readFileSync(path.join(EXT, f), 'utf8') : '');
const LOGO = fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'logo-vrm-96.png'));
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4eechAAUoApeWrujeAAAAAElFTkSuQmCC', 'base64');
const MIN = 60000, H = 3600000, J = 86400000;
const iso = (t) => new Date(t).toISOString();
const UID = '111', OWNER = 'owner-banc';
const MODELES = ['Nike Air Max 90 blanches', 'Adidas Samba OG noires', 'New Balance 550 crème', 'Puma Suede bleues', 'Asics Gel-Kayano 14 argent', 'Nike Dunk Low Panda'];

// ── La base inventée : un compte Vinted (111) avec annonces, ventes, conversations, favoris ; un second (222).
function baseInventee(T0 = Date.now()) {
  const items = (uid, n) => Array.from({ length: n }, (_, i) => ({ id: Number(uid) * 1000 + i, title: `${MODELES[i % 6]} ${39 + (i % 6)}`, price: { amount: String(50 + i * 5), currency_code: 'EUR' },
    created_at_ts: Math.floor((T0 - (i + 1) * 3 * J) / 1000), favourite_count: i % 4, view_count: 20 + i * 7, is_closed: false, is_hidden: i === 6, is_draft: i === 7, is_reserved: i === 5,
    brand_title: MODELES[i % 6].split(' ')[0], size_title: String(39 + (i % 6)), status: 'Très bon état', photo: { url: `https://images1.vinted.net/banc/a${i}.jpg` }, photos: [{ url: `https://images1.vinted.net/banc/a${i}.jpg` }, { url: `https://images1.vinted.net/banc/b${i}.jpg` }] }));
  const ventes = (uid, etats) => etats.map((e, i) => ({ transaction_id: Number(uid) * 100000 + i, conversation_id: Number(uid) * 100000 + i + 5000000000, title: `${MODELES[i % 6]} 42`, price: { amount: String(60 + i * 10) + '.0', currency_code: 'EUR' }, item_id: Number(uid) * 1000 + 100 + i, date: iso(T0 - (i + 1) * 5 * H),
    photo: { url: `https://images1.vinted.net/banc/v${i}.jpg` },
    status: e === 'a' ? 'Le paiement a été validé. Envoie le colis avant le 28/11/2026' : e === 'f' ? 'La commande est finalisée.' : e === 'x' ? 'Commande annulée' : 'Colis en route',
    transaction_user_status: e === 'a' ? 'needs_action' : e === 'f' ? 'completed' : e === 'x' ? 'failed' : 'waiting' }));
  const convs = Array.from({ length: 6 }, (_, i) => ({ id: 60000 + i, description: i === 0 ? 'Bonjour, elle est toujours disponible ?' : 'Merci, bonne journée !', unread: i < 2, updated_at: iso(T0 - (i * 3 + 1) * H),
    opposite_user: { id: 900 + i, login: 'acheteuse_' + i, photo: null }, item_photos: [{ url: `https://images1.vinted.net/banc/m${i}.jpg` }], item_count: 1 }));
  const notifs = Array.from({ length: 8 }, (_, i) => ({ id: 'n' + i, user_id: 900 + i, body: `acheteur_${i} a ajouté ton article à ses favoris.`, link: `/items/${111000 + (i % 5)}/conversation/new?from_notification=true`, created_at: iso(T0 - (i * 37 + 5) * MIN) }));
  const nums = {}; for (let i = 0; i < 10; i++) if (i !== 3) nums[111000 + i] = { numero: String(120 + i), accountId: UID, ...(i % 2 ? { min: 45 + i } : {}) };
  nums[222000] = { numero: '900', accountId: '222' };
  return {
    lignes: {
      main: { vinted_annonce_numeros: nums, vinted_buyprice_by_num: { 120: 30 } },
      vinted_listing_dates: {},
      [`harvest_${UID}_listings`]: { type: 'listings', capturedAt: iso(T0 - 20 * MIN), nItems: 10, domain: 'www.vinted.fr', payload: { items: items(UID, 10), pagination: { total_entries: 10 } } },
      harvest_222_listings: { type: 'listings', capturedAt: iso(T0 - H / 2), nItems: 7, payload: { items: items('222', 7), pagination: { total_entries: 7 } } },
      [`harvest_${UID}_orders_sold`]: { type: 'orders_sold', capturedAt: iso(T0 - 10 * MIN), nItems: 5, payload: { my_orders: ventes(UID, ['a', 'a', 'r', 'f', 'x']) } },
      harvest_222_orders_sold: { type: 'orders_sold', capturedAt: iso(T0 - 10 * MIN), nItems: 3, payload: { my_orders: ventes('222', ['f', 'f', 'a']) } },
      [`harvest_${UID}_label_11100000`]: { uid: UID, tx: '11100000', _pdf: true },
      [`harvest_${UID}_inbox`]: { type: 'inbox', capturedAt: iso(T0 - 5 * MIN), nItems: convs.length, payload: { conversations: convs } },
      [`harvest_${UID}_notifications`]: { type: 'notifications', capturedAt: iso(T0 - 4 * MIN), domain: 'www.vinted.fr', payload: { notifications: notifs } },
    },
    notifs, items: items(UID, 10),
  };
}

// ── Le faux vrm.center : la VRAIE file des favoris (api/_lib/favoris-file.js) et le VRAI aperçu (favoris-carte.js).
async function serveurVrm(base, T0) {
  const F = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'favoris-file.js')).href);
  const C = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'favoris-carte.js')).href);
  const P = await import(pathToFileURL(path.join(RACINE, 'src', 'favorisProgression.js')).href);
  let d = null, n = 0, prefs = { version: 1, envoisActifs: false, message: 'Bonjour {pseudo}, ça te plaît toujours ?', pourcentage: 10, offreMode: 'pct', offreValeur: null, arrondi: false, intervalleMinutes: 0, intervalleMaxMinutes: null };
  const jeton = () => { n++; return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`; };
  const s = { lancers: [], appels: [], F };
  const apercu = () => { const v = F.vueFile(F.initialiserFile(d), OWNER); return C.apercuCarte({ prefs, capture: { payload: { notifications: base.notifs }, domain: 'www.vinted.fr' }, vue: { jobs: v.jobs || [], active: !!v.active }, dressing: { cap: iso(T0 - H / 2), pg: { total_entries: base.items.length }, items: base.items }, prouve: () => true, maintenant: Date.now() }); };
  s.vrm = async (req) => {
    s.appels.push({ mode: req.mode, methode: req.methode, action: req.corps && req.corps.action });
    if (req.mode !== 'favoris') return null;
    const now = Date.now(), c = req.corps || {};
    const carte = (v) => ({ total: v.jobs.length, envoyes: v.jobs.filter((j) => j.etat === 'envoye').length, active: v.active });
    try {
      if (req.methode === 'GET') { const v = F.vueFile(F.initialiserFile(d), OWNER); return { status: 200, body: { ok: true, uid: UID, vue: v, carte: carte(v), serveur: now } }; }
      if (c.action === 'apercu') return { status: 200, body: { ok: true, uid: UID, apercu: JSON.parse(JSON.stringify(apercu())), serveur: now } };
      if (c.action === 'reglages' || c.action === 'regler') { if (c.reglages) prefs = Object.assign({}, prefs, c.reglages); return { status: 200, body: { ok: true, uid: UID, reglages: prefs, serveur: now } }; }
      let r;
      if (c.action === 'lancer') {
        s.lancers.push((c.selection || []).slice());
        const parId = new Map(base.notifs.map((x) => [x.id, x]));
        const targets = (c.selection || []).filter((id) => parId.has(id)).map((id) => { const x = parId.get(id); return { itemId: String(/items\/(\d+)/.exec(x.link)[1]), recipientId: String(x.user_id), notificationId: id, initiator: 'favourite' }; });
        r = F.lancerFile(d, { owner: OWNER, targets, message: prefs.message, intervalleMinutes: 0, maintenant: now, lot: 'lot' + s.lancers.length });
      } else if (c.action === 'suivant') r = F.reserverFile(d, { owner: OWNER, maintenant: now, jeton: jeton(), suivi: 's' });
      else if (c.action === 'consommer') r = F.consommerFile(d, { owner: OWNER, jeton: c.jeton, maintenant: now });
      else if (c.action === 'verifier') r = F.verifierReservation(d, { owner: OWNER, jeton: c.jeton, maintenant: now });
      else if (c.action === 'terminer') { const t = P.traduireResultatFavori(c.brut); r = F.terminerFile(d, { owner: OWNER, jeton: c.jeton, resultat: t.resultat, raison: t.raison, maintenant: now, ecrits: Number.isInteger(t.ecrits) ? t.ecrits : null, apresMs: Number.isSafeInteger(t.apresMs) ? t.apresMs : null }); }
      else if (c.action === 'arreter') r = F.arreterFile(d, OWNER);
      else if (c.action === 'reprendre') r = F.reprendreFile(d, { owner: OWNER, maintenant: now });
      else return { status: 400, body: { message: 'inconnu' } };
      if (r.data) d = r.data;
      const tri = ['suivant', 'consommer', 'verifier'].includes(c.action);
      const v = tri ? r.valeur.vue : r.valeur;
      return { status: 200, body: Object.assign({ ok: true, uid: UID, serveur: now }, tri ? r.valeur : { vue: r.valeur }, v && v.jobs ? { carte: carte(v) } : {}) };
    } catch (e) { return { status: e.status || 503, body: { message: String(e.message) } }; }
  };
  return s;
}

// ── Le monde : le vrai fond, sa base, son faux Vinted, son faux vrm.center.
async function monde(o = {}) {
  const T0 = Date.now();
  const base = baseInventee(T0);
  const sv = await serveurVrm(base, T0);
  const f = faireFond({ src: path.join(EXT, 'background.js'), connecte: o.connecte === undefined ? UID : o.connecte, lignes: Object.assign(base.lignes, o.lignes || {}), store: Object.assign({}, o.store || {}), vrm: o.vrm || sv.vrm,
    vinted: o.vinted || (() => ({ status: 404, body: {} })), onglets: o.onglets || [{ id: 7, url: o.url || 'https://www.vinted.fr/catalog', status: 'complete', active: true, windowId: 1 }],
    comptes: [{ vinted_user_id: UID, login: 'shop_sophie', domain: 'www.vinted.fr' }, { vinted_user_id: '222', login: 'julien_kicks', domain: 'www.vinted.fr' }] });
  f.ctx.compteConnecte = async () => (o.connecte === undefined ? UID : o.connecte);
  f.ctx.chrome.runtime.getManifest = () => JSON.parse(lireExt('manifest.json'));
  return { f, sv, base, T0 };
}

// ── La page : le vrai panneau, `chrome` relié au fond.
async function ouvrir(nav, m, { largeur = 1512, hauteur = 900, mobile = false, orion = false, scheme = 'light', langue = 'fr', url = 'https://www.vinted.fr/catalog', corps = '' } = {}) {
  const UA_ORION = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1 Orion/1.0';
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, locale: ({ fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT', de: 'de-DE' })[langue] || 'fr-FR', viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}, orion ? { userAgent: UA_ORION } : {}));
  const pg = await ctx.newPage();
  const t = { ctx, pg, erreurs: [], messages: [], ouverts: [] };
  pg.on('pageerror', (e) => t.erreurs.push(String(e && (e.stack || e)).slice(0, 400)));
  pg.on('console', (c) => { if (c.type() === 'error' && !/Failed to load resource|net::ERR/.test(c.text())) t.erreurs.push('console: ' + c.text().slice(0, 300)); });
  await ctx.route('**/*', (r) => {   // au niveau du contexte : un onglet ouvert par un lien est servi par le banc lui aussi (jamais le réseau réel)
    const u = r.request().url();
    if (/logo-vrm(-96)?\.png|icon-\d+\.png/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: LOGO });
    if (/\.(png|jpe?g|webp|gif|svg)(\?|$)/.test(u) || /vinted\.net\//.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
    if (r.request().resourceType() !== 'document') return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><html lang="${langue}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page du site</title></head><body style="margin:0;background:#fff;font-family:sans-serif"><header style="height:64px;border-bottom:1px solid #ddd;padding:20px">Une page du site</header><main style="padding:20px;height:2000px">${corps}</main></body></html>` });
  });
  const sender = () => ({ tab: { id: 7, url: pg.url(), active: true, windowId: 1 }, frameId: 0, url: pg.url(), origin: (() => { try { return new URL(pg.url()).origin; } catch (_) { return ''; } })(), id: 'x' });
  await pg.exposeFunction('__fondEnvoyer', async (msg, pile) => {
    const e = { msg, at: Date.now(), muet: false, leve: null, rep: undefined, pile: pile || '' };
    t.messages.push(e);
    try { e.rep = await Promise.race([m.f.envoyer(msg, sender()), new Promise((ok) => setTimeout(() => ok('__tard'), 8000))]); } catch (x) { e.leve = String(x && (x.stack || x.message)).slice(0, 400); }
    if (e.rep === '__tard') { e.rep = undefined; e.tard = true; }
    if (e.rep === undefined && !e.leve) e.muet = true;
    try { return e.rep === undefined ? { __muet: true } : { v: JSON.parse(JSON.stringify(e.rep)) }; } catch (_) { return { __muet: true }; }
  });
  const sl = m.f.ctx.chrome.storage.local;
  await pg.exposeFunction('__stGet', async (k) => JSON.parse(JSON.stringify(await sl.get(k === null || k === undefined ? Object.keys(m.f.store) : k))));
  await pg.exposeFunction('__stSet', async (o) => { await sl.set(o); return true; });
  await pg.exposeFunction('__stRemove', async (k) => { await sl.remove(k); return true; });
  const surChange = (ch) => { pg.evaluate((c) => { try { window.__stChange && window.__stChange(c); } catch (_) {} }, JSON.parse(JSON.stringify(ch))).catch(() => {}); };
  m.f.ctx.chrome.storage.onChanged.addListener(surChange);
  t.fermer = async () => { try { m.f.ctx.chrome.storage.onChanged.removeListener(surChange); } catch (_) {} await ctx.close().catch(() => {}); };
  await pg.goto(url);
  await pg.evaluate(({ version, fichiers }) => {
    window.__ouverts = []; window.open = (u) => { window.__ouverts.push(String(u)); return null; };
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    const ecoutes = [];
    window.__stChange = (c) => { for (const f of ecoutes.slice()) { try { f(c, 'local'); } catch (e) { console.error('onChanged a levé : ' + (e && e.message)); } } };
    const session = {};
    const zone = (get, set, remove) => ({
      get(k, cb) { const p = get(k); if (typeof cb === 'function') { p.then((v) => cb(v)); return; } return p; },
      set(o, cb) { const p = set(o); if (typeof cb === 'function') { p.then(() => cb()); return; } return p; },
      remove(k, cb) { const p = remove(k); if (typeof cb === 'function') { p.then(() => cb()); return; } return p; },
    });
    window.chrome = {
      runtime: { id: 'ext-banc', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version }), lastError: null,
        onMessage: { addListener(f) { (window.__ecoutesMsg = window.__ecoutesMsg || []).push(f); }, removeListener() {} },
        sendMessage(msg, cb) {
          // D'où part le message (les fonctions du panneau, pas les valeurs) : pour dire QUI a envoyé un message muet.
          let pile = ''; try { pile = new Error().stack.split('\n').slice(2, 7).map((x) => (/at ([^ ]+) /.exec(x) || [])[1] || '?').join(' < '); } catch (_) {}
          const p = window.__fondEnvoyer(JSON.parse(JSON.stringify(msg)), pile).then((r) => (r && r.__muet ? undefined : r.v));
          if (typeof cb === 'function') { p.then((v) => { window.chrome.runtime.lastError = v === undefined ? { message: 'The message port closed before a response was received.' } : null; try { cb(v); } finally { window.chrome.runtime.lastError = null; } }); return; }
          return p;
        } },
      storage: {
        local: zone((k) => window.__stGet(k === undefined ? null : k), (o) => window.__stSet(JSON.parse(JSON.stringify(o))), (k) => window.__stRemove(k)),
        session: zone(async (k) => { const cles = k == null ? Object.keys(session) : [].concat(typeof k === 'object' && !Array.isArray(k) ? Object.keys(k) : k); const out = {}; for (const c of cles) if (session[c] !== undefined) out[c] = JSON.parse(JSON.stringify(session[c])); return out; }, async (o) => { Object.assign(session, JSON.parse(JSON.stringify(o))); }, async (k) => { for (const c of [].concat(k)) delete session[c]; }),
        onChanged: { addListener(f) { ecoutes.push(f); }, removeListener(f) { const i = ecoutes.indexOf(f); if (i >= 0) ecoutes.splice(i, 1); } },
      },
      tabs: { create(o) { window.__ouverts.push('tabs.create:' + (o && o.url)); } },
    };
    for (const js of fichiers) { if (!js) continue; const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s); }
  }, { version: (JSON.parse(lireExt('manifest.json')) || {}).version, fichiers: [lireExt('vrm-ui.js'), lireExt('vrm-mots.js'), lireExt('vrm-depot.js'), lireExt('vrm-badge.js')] });
  await pg.waitForTimeout(350);
  t.montrer = async () => {
    const b = await pg.evaluate(() => { const h = document.getElementById('vrm-badge'); const x = h && h.shadowRoot && h.shadowRoot.querySelector('.btn'); if (!x) return null; const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (!b) return false;
    if (mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
    await pg.waitForTimeout(500);
    if (!mobile && process.env.BANC_SOURIS !== 'reste') await pg.mouse.move(2, 2);   // la souris quitte le logo (elle ne reste pas posée sur le panneau)
    return true;
  };
  return t;
}

// ── La FENÊTRE de l'extension (popup.html) : les vrais fichiers, servis tels quels, `chrome` relié au fond.
//    Elle n'a pas d'onglet (`sender.tab` absent) : c'est une page de l'extension.
async function ouvrirFenetre(nav, m, { largeur = 390, hauteur = 700, mobile = false, scheme = 'light', langue = 'fr', query = '' } = {}) {
  const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, locale: ({ fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT', de: 'de-DE' })[langue] || 'fr-FR', viewport: { width: largeur, height: hauteur } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  const t = { ctx, pg, erreurs: [], messages: [], ouverts: [] };
  pg.on('pageerror', (e) => t.erreurs.push(String(e && (e.stack || e)).slice(0, 400)));
  pg.on('console', (c) => { if (c.type() === 'error' && !/Failed to load resource|net::ERR/.test(c.text())) t.erreurs.push('console: ' + c.text().slice(0, 300)); });
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css', '.json': 'application/json' };
  await ctx.route('**/*', (r) => {   // au niveau du contexte : un onglet ouvert par un lien est servi par le banc lui aussi (jamais le réseau réel)
    const u = new URL(r.request().url());
    if (u.host !== 'ext.banc') return r.fulfill({ status: 404, body: '' });
    const f = path.join(EXT, path.basename(u.pathname));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  const sender = { url: 'chrome-extension://x/popup.html', origin: 'chrome-extension://x', id: 'x' };
  await pg.exposeFunction('__fondEnvoyer', async (msg) => {
    const e = { msg, at: Date.now(), muet: false, leve: null, rep: undefined };
    t.messages.push(e);
    try { e.rep = await Promise.race([m.f.envoyer(msg, sender), new Promise((ok) => setTimeout(() => ok('__tard'), 8000))]); } catch (x) { e.leve = String(x && (x.stack || x.message)).slice(0, 400); }
    if (e.rep === '__tard') { e.rep = undefined; e.tard = true; }
    if (e.rep === undefined && !e.leve) e.muet = true;
    try { return e.rep === undefined ? { __muet: true } : { v: JSON.parse(JSON.stringify(e.rep)) }; } catch (_) { return { __muet: true }; }
  });
  const sl = m.f.ctx.chrome.storage.local;
  await pg.exposeFunction('__stGet', async (k) => JSON.parse(JSON.stringify(await sl.get(k === null || k === undefined ? Object.keys(m.f.store) : k))));
  await pg.exposeFunction('__stSet', async (o) => { await sl.set(o); return true; });
  await pg.exposeFunction('__stRemove', async (k) => { await sl.remove(k); return true; });
  const surChange = (ch) => { pg.evaluate((c) => { try { window.__stChange && window.__stChange(c); } catch (_) {} }, JSON.parse(JSON.stringify(ch))).catch(() => {}); };
  m.f.ctx.chrome.storage.onChanged.addListener(surChange);
  t.fermer = async () => { try { m.f.ctx.chrome.storage.onChanged.removeListener(surChange); } catch (_) {} await ctx.close().catch(() => {}); };
  await pg.addInitScript(({ version, onglets }) => {
    window.__ouverts = []; window.open = (u) => { window.__ouverts.push(String(u)); return null; };
    window.close = () => { window.__ouverts.push('window.close'); };
    const ecoutes = [];
    window.__stChange = (c) => { for (const f of ecoutes.slice()) { try { f(c, 'local'); } catch (e) { console.error('onChanged a levé : ' + (e && e.message)); } } };
    const dual = (p, cb) => { if (typeof cb === 'function') { p.then((v) => cb(v)); return; } return p; };
    window.chrome = {
      runtime: { id: 'ext-banc', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version }), lastError: null, reload() { window.__ouverts.push('runtime.reload'); },
        onMessage: { addListener() {}, removeListener() {} },
        sendMessage(msg, cb) {
          const p = window.__fondEnvoyer(JSON.parse(JSON.stringify(msg))).then((r) => (r && r.__muet ? undefined : r.v));
          if (typeof cb === 'function') { p.then((v) => { window.chrome.runtime.lastError = v === undefined ? { message: 'The message port closed before a response was received.' } : null; try { cb(v); } finally { window.chrome.runtime.lastError = null; } }); return; }
          return p;
        } },
      storage: { local: { get: (k, cb) => dual(window.__stGet(k === undefined ? null : k), cb), set: (o, cb) => dual(window.__stSet(JSON.parse(JSON.stringify(o))), cb), remove: (k, cb) => dual(window.__stRemove(k), cb) },
        onChanged: { addListener(f) { ecoutes.push(f); }, removeListener(f) { const i = ecoutes.indexOf(f); if (i >= 0) ecoutes.splice(i, 1); } } },
      tabs: { create: (o, cb) => { window.__ouverts.push('tabs.create:' + (o && o.url)); return dual(Promise.resolve({ id: 99 }), cb); }, update: (id, o, cb) => { window.__ouverts.push('tabs.update:' + id); return dual(Promise.resolve({ id }), cb); },
        query: (q, cb) => dual(Promise.resolve(onglets), cb), get: (id, cb) => dual(Promise.resolve(onglets.find((x) => x.id === id) || null), cb) },
      windows: { update: (id, o, cb) => dual(Promise.resolve({}), cb) },
      permissions: { request: (q, cb) => { window.__ouverts.push('permissions.request'); return dual(Promise.resolve(true), cb); }, contains: (q, cb) => dual(Promise.resolve(true), cb) },
    };
  }, { version: (JSON.parse(lireExt('manifest.json')) || {}).version, onglets: [{ id: 7, url: 'https://www.vinted.fr/catalog', active: true, windowId: 1 }] });
  await pg.goto('https://ext.banc/popup.html' + (query || ''));
  await pg.waitForTimeout(500);
  t.montrer = async () => true;
  return t;
}

module.exports = { monde, ouvrir, ouvrirFenetre, baseInventee, serveurVrm, EXT, RACINE, UID, OWNER, MIN, H, J };
