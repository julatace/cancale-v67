// ════════════════════════════════════════════════════════════════════════════
//  BANC « ÉQUIPE » — le mode équipe (migration 016), RENDU, à 390 et 1512 px.
//
//  Le vendeur invite un aide qui prépare les colis. La base garantit ce que
//  l'aide voit (audit-equipe-sql.cjs, sur un vrai Postgres) ; ce banc vérifie
//  que l'APP ne lit et ne montre que ça :
//    · un membre (sans boutique à lui) arrive directement sur les colis du
//      vendeur — avant la porte de l'abonnement (un aide ne paie pas) ;
//    · il ne voit que les colis : à expédier (avec l'impression du bordereau),
//      à retirer (avec le code), et AUCUN montant ;
//    · aucune requête de son navigateur vers `main`, `vinted_accounts` ou les
//      transactions ; chaque lecture porte `x-vrm-equipe` ET `owner=eq.` ;
//    · le vendeur voit son app comme avant (aucune requête avec l'en-tête),
//      invite et retire depuis Réglages → Mon compte → Équipe ;
//    · un vendeur qui est AUSSI membre garde sa propre app, et ouvre l'écran de
//      l'équipe sur son clic ;
//    · invitation retirée ⇒ plus rien de la boutique du vendeur ;
//    · base sans la 016 ⇒ « Le mode équipe n'est pas encore activé sur ta base ».
//  Le faux PostgREST applique la RÈGLE de la 016 (liste blanche, en-tête,
//  adhésion active) — sinon le banc mesurerait une fiction (§6.3). Le VRAI
//  api/compte.js est exécuté pour `?mode=equipe` (et `abonnement`).
//  Aucune fixture : tout est inventé ici (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');
let chromium;
try { ({ chromium } = require(path.join(RACINE, 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || 5011);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).split('\n')[0].slice(0, 180)); } };

// ── Les personnes ────────────────────────────────────────────────────────────
const V = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';   // le vendeur
const M = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';   // l'aide (aucune boutique)
const W = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';   // une vendeuse qui aide AUSSI V
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (id, email) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: id, email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.c2ln`;
const USERS = {
  [V]: { id: V, email: 'vendeur@exemple.test' },
  [M]: { id: M, email: 'aide@exemple.test' },
  [W]: { id: W, email: 'vendeuse.w@exemple.test' },
};
const JETONS = {}; for (const u of Object.values(USERS)) JETONS[jwt(u.id, u.email)] = u;
const jetonDe = (id) => Object.keys(JETONS).find((k) => JETONS[k].id === id);
const session = (id) => ({ access_token: jetonDe(id), refresh_token: 'r-' + id, expires_at: Date.now() + 3600e3, user: { id, email: USERS[id].email } });

// ── La base ─────────────────────────────────────────────────────────────────
let PDF_B64 = '';
const metaDe = (id, data) => {
  const m = {};
  if (data && typeof data === 'object') for (const [k, v] of Object.entries(data)) if (v != null && typeof v !== 'object' && String(v).length <= 600) m[k] = String(v);
  if (data && data.pdfB64) m._pdf = 'true';
  return m;
};
const ligne = (owner, id, data) => ({ owner, id, data, meta: metaDe(id, data) });
let B;   // l'état de la base, refait à chaque scénario
const reset = ({ installe = true, statutM = 'actif', W_membre = true } = {}) => {
  B = {
    installe,
    equipe: [
      { id: 'e0000000-0000-4000-8000-000000000001', vendeur: V, email: 'aide@exemple.test', membre: statutM === 'invitee' ? null : M, statut: statutM, role: 'colis', invite_le: '2026-10-15T10:00:00Z' },
      ...(W_membre ? [{ id: 'e0000000-0000-4000-8000-000000000002', vendeur: V, email: 'vendeuse.w@exemple.test', membre: W, statut: 'actif', role: 'colis', invite_le: '2026-10-15T11:00:00Z' }] : []),
    ],
    vinted_accounts: [{ owner: V, vinted_user_id: '111', login: 'boutique_v', access_token: 'tokV' }, { owner: W, vinted_user_id: '333', login: 'boutique_w', access_token: 'tokW' }],
    app_data: [
      ligne(V, 'main', { vinted_ship_done: { 9003: 1760000000000 }, vinted_annonce_numeros: { 1: { buyPrice: 31 } }, vrm_numerotation: { version: 2 } }),
      ligne(V, 'harvest_111_orders_sold', { capturedAt: '2026-10-17T08:00:00Z', payload: { my_orders: [
        { transaction_id: 9001, item_id: 5001, title: 'Nike Air Max 90 blanche taille 42', status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: '2026-10-16T09:00:00Z', price: { amount: '42.00', currency_code: 'EUR' }, photo: { url: 'https://images1.vinted.net/t/banc/f800/1.jpeg' } },
        { transaction_id: 9002, item_id: 5002, title: 'Adidas Samba noire taille 40', status: 'Commande finalisée', transaction_user_status: 'completed', date: '2026-10-01T09:00:00Z', price: { amount: '55.00', currency_code: 'EUR' } },
        { transaction_id: 9003, item_id: 5003, title: 'Salomon XT-6 grise taille 41', status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: '2026-10-15T09:00:00Z', price: { amount: '99.00', currency_code: 'EUR' } },
      ] } }),
      ligne(V, 'harvest_111_orders_purchased', { capturedAt: '2026-10-17T08:00:00Z', payload: { my_orders: [
        { transaction_id: 8001, item_id: 4001, title: 'New Balance 550 taille 43', status: 'Colis déposé en point relais', transaction_user_status: 'needs_action', date: '2026-10-14T09:00:00Z', price: { amount: '25.00', currency_code: 'EUR' } },
      ] } }),
      ligne(V, 'harvest_111_txn_9001', { payload: { transaction: { id: 9001, item_id: 5001, status: 230, status_title: 'Le paiement a été validé', buyer: { login: 'acheteur_secret' }, offer: { price: { amount: '42.00' } } } } }),
      ligne(V, 'harvest_111_billing', { payload: { main: { amount: '281.94' }, escrow: { amount: '2235.80' } } }),
      ligne(V, 'email_bord_9001', { numero: '12', filename: 'bordereau.pdf', transaction: '9001', modele: 'Nike Air Max 90', dateLimite: '23/10/2026', receivedAt: '2026-10-16T10:00:00Z', pdfB64: PDF_B64 }),
      ligne(V, 'panel_colis_relais', { 8001: { code: '734512', lieu: 'Tabac du Port — Cancale' } }),
      ligne(V, 'email_sale_9001', { prix: '42.00', acheteur: 'acheteur_secret' }),
      // W a SA boutique : un bordereau à elle (jamais mêlé à ceux de V).
      ligne(W, 'main', { vrm_prenom: 'Wendy' }),
      ligne(W, 'email_bord_7001', { numero: '3', filename: 'b.pdf', transaction: '7001', modele: 'Converse W', receivedAt: '2026-10-16T10:00:00Z', pdfB64: PDF_B64 }),
    ],
    journal: [],
  };
};
const ID_PERMIS = /^(email_bord_[A-Za-z0-9]{1,40}|harvest_[0-9]{1,20}_label_[A-Za-z0-9]{1,40}|panel_colis_relais|email_track_[a-z0-9]{1,30}_[A-Za-z0-9-]{1,80})$/;
const actif = (uid, vendeur) => B.installe && uid && vendeur && B.equipe.some((e) => e.membre === uid && e.vendeur === vendeur && e.statut === 'actif');
// LA RÈGLE DE LA 016 : ses lignes, ou — demandées par l'en-tête — les lignes de
// colis d'un vendeur dont on est membre actif.
const visible = (row, uid, entete) => row.owner === uid || (B.installe && entete && row.owner === entete && actif(uid, entete) && ID_PERMIS.test(row.id));

const lire = (row, chemin) => {
  const toks = chemin.split(/(->>|->)/);
  let v = toks[0] === 'id' ? row.id : toks[0] === 'owner' ? row.owner : toks[0] === 'meta' ? row.meta : toks[0] === 'data' ? row.data : row[toks[0]];
  let texte = false;
  for (let i = 1; i < toks.length; i += 2) { texte = toks[i] === '->>'; v = v == null ? null : v[toks[i + 1]]; }
  if (texte && v != null && typeof v === 'object') return JSON.stringify(v);
  if (texte && v != null) return String(v);
  return v === undefined ? null : v;
};
const motif = (s) => new RegExp('^' + s.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
const filtre = (row, cle, val) => {
  const x = lire(row, cle);
  if (val.startsWith('eq.')) return x != null && String(x) === val.slice(3);
  if (val.startsWith('like.')) return x != null && motif(val.slice(5)).test(String(x));
  if (val === 'is.null') return x == null;
  if (val === 'not.is.null') return x != null;
  return true;
};
const projette = (row, select) => {
  if (!select) return { id: row.id, owner: row.owner, data: row.data };
  const o = {};
  for (const it of select.split(',')) {
    const [a, p] = it.includes(':') ? it.split(':') : [null, it];
    const alias = a || p.split(/->>|->/).pop();
    o[alias] = lire(row, p);
  }
  return o;
};

function listerPour(uid) {
  const moi = USERS[uid];
  return {
    equipe: B.equipe.filter((x) => x.vendeur === uid).map(({ id, email, statut, role, invite_le }) => ({ id, email, statut, role, invite_le })),
    invitations: B.equipe.filter((x) => x.statut === 'invitee' && x.email === moi.email && x.vendeur !== uid).map((x) => ({ id: x.id, de: USERS[x.vendeur].email, role: x.role, invite_le: x.invite_le })),
    membre_de: B.equipe.filter((x) => x.membre === uid && x.statut === 'actif').map((x) => ({ id: x.id, vendeur: x.vendeur, de: USERS[x.vendeur].email, role: x.role, acces: true })),
  };
}
function colisPour(uid, vendeur) {
  if (!actif(uid, vendeur)) return null;
  const proj = (o, compteUid) => { const j = { uid: compteUid, transaction_id: o.transaction_id, item_id: o.item_id, title: o.title, status: o.status, transaction_user_status: o.transaction_user_status, date: o.date }; if (o.photo && o.photo.url) j.photo = o.photo.url; return j; };
  const ventes = [], achats = [];
  for (const r of B.app_data.filter((r) => r.owner === vendeur)) {
    const m = /^harvest_([0-9]+)_orders_(sold|purchased)$/.exec(r.id); if (!m) continue;
    for (const o of (r.data.payload.my_orders || [])) {
      if (/finalis|annul|rembours/i.test(o.status || '') || o.transaction_user_status === 'completed') continue;
      (m[2] === 'sold' ? ventes : achats).push(proj(o, m[1]));
    }
  }
  const main = B.app_data.find((r) => r.owner === vendeur && r.id === 'main');
  return {
    ventes, achats,
    comptes: Object.fromEntries(B.vinted_accounts.filter((a) => a.owner === vendeur).map((a) => [a.vinted_user_id, a.login])),
    postes: Object.keys((main && main.data.vinted_ship_done) || {}),
    retires: Object.keys((main && main.data.vinted_pickup_done) || {}),
  };
}

// UNE porte pour le navigateur ET pour api/compte.js (exécuté dans ce processus).
// Rend { status, body, headers }.
function fauxSupabase(urlBrut, methode, entetes, corps) {
  const u = decodeURIComponent(String(urlBrut));
  const h = {}; for (const [k, v] of Object.entries(entetes || {})) h[k.toLowerCase()] = v;
  const tok = String(h.authorization || '').replace(/^Bearer\s+/i, '');
  const qui = JETONS[tok];
  const uid = qui ? qui.id : null;
  const entete = h['x-vrm-equipe'] || '';
  const json = (b, status = 200, hh = {}) => ({ status, body: b === undefined ? '' : JSON.stringify(b), headers: { 'content-type': 'application/json', ...hh } });
  const [chemin, qs] = u.split('?');
  if (/\/auth\/v1\/user/.test(chemin)) return qui ? json({ id: qui.id, email: qui.email, email_confirmed_at: '2026-10-01T00:00:00Z' }) : json({ msg: 'invalid' }, 401);
  if (/\/auth\/v1\//.test(chemin)) return json(qui ? { access_token: tok, refresh_token: 'r', expires_in: 3600, user: { id: qui.id, email: qui.email } } : {});
  const rest = /\/rest\/v1\/(.+)$/.exec(chemin);
  if (!rest) return json({}, 404);
  B.journal.push({ u, methode, entete, uid, depuis: corps && corps.__node ? 'serveur' : 'navigateur' });
  const cible = rest[1];
  const args = (() => { try { return typeof corps === 'string' ? JSON.parse(corps || '{}') : (corps && corps.json) || {}; } catch (_) { return {}; } })();
  if (cible.startsWith('rpc/')) {
    const fn = cible.slice(4);
    if (fn === 'vrm_acces') return json({ obligatoire: false, proprietaire: false, acces: true });
    if (/^vrm_equipe_/.test(fn) && !B.installe) return json({ code: 'PGRST202', message: `Could not find the function public.${fn}` }, 404);
    if (!uid) return json({ message: 'JWT' }, 401);
    if (fn === 'vrm_equipe_lister') return json(listerPour(uid));
    if (fn === 'vrm_equipe_colis') return json(colisPour(uid, args.p_vendeur));
    if (fn === 'vrm_equipe_inviter') {
      const e = String(args.p_email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,24}$/.test(e)) return json({ ok: false, raison: 'email' });
      if (e === qui.email) return json({ ok: false, raison: 'soi' });
      const d = B.equipe.find((x) => x.vendeur === uid && x.email === e && x.statut !== 'revoquee');
      if (d) return json({ ok: true, id: d.id, statut: d.statut, deja: true });
      const id = `e0000000-0000-4000-8000-${String(100 + B.equipe.length).padStart(12, '0')}`;
      B.equipe.push({ id, vendeur: uid, email: e, membre: null, statut: 'invitee', role: 'colis', invite_le: new Date().toISOString() });
      return json({ ok: true, id, statut: 'invitee', deja: false });
    }
    if (fn === 'vrm_equipe_accepter') {
      const x = B.equipe.find((y) => y.id === args.p_id && y.statut === 'invitee' && y.email === qui.email && y.vendeur !== uid);
      if (!x) return json(false);
      x.membre = uid; x.statut = 'actif'; return json(true);
    }
    if (fn === 'vrm_equipe_revoquer') {
      const x = B.equipe.find((y) => y.id === args.p_id && y.statut !== 'revoquee' && (y.vendeur === uid || y.membre === uid));
      if (!x) return json(false);
      x.statut = 'revoquee'; return json(true);
    }
    return json({ code: 'PGRST202' }, 404);
  }
  const q = new URLSearchParams(qs || '');
  if (cible.startsWith('vinted_accounts')) {
    // AUCUNE règle d'équipe sur vinted_accounts (016) : seulement les siens.
    let rows = B.vinted_accounts.filter((r) => r.owner === uid);
    const lim = Number(q.get('limit')); if (lim) rows = rows.slice(0, lim);
    return json(rows.map((r) => projette({ ...r, data: r }, q.get('select') === '*' ? null : q.get('select')) ));
  }
  if (cible.startsWith('app_data')) {
    if (methode !== 'GET') return json(methode === 'POST' ? [] : [], 201);
    if (q.get('select') === 'owner') return json([]);
    let rows = B.app_data.filter((r) => visible(r, uid, entete));
    for (const [k, v] of q.entries()) {
      if (['select', 'limit', 'order', 'offset'].includes(k)) continue;
      rows = rows.filter((r) => filtre(r, k, v));
    }
    const lim = Number(q.get('limit')); if (lim) rows = rows.slice(0, lim);
    return json(rows.map((r) => projette(r, q.get('select'))), 200, { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` });
  }
  return json([], 200, { 'content-range': '0-0/0' });
}

// api/compte.js tourne ICI : son `fetch` vers Supabase passe par la même base.
const fetchReel = global.fetch;
global.fetch = async (url, opts = {}) => {
  const s = String(url);
  if (/supabase\.co\//.test(s)) {
    const r = fauxSupabase(s, opts.method || 'GET', opts.headers || {}, { json: (() => { try { return JSON.parse(opts.body || '{}'); } catch (_) { return {}; } })(), __node: true });
    return new Response(r.body === '' ? null : r.body, { status: r.status, headers: r.headers });
  }
  if (/api\.stripe\.com/.test(s)) return new Response('{}', { status: 404 });
  return fetchReel(url, opts);
};

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

let compte = null;
async function ouvrir(nav, { qui, largeur = 1512, tab = '', vue = undefined, cache = undefined, sombre = false }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  const popups = []; ctx.on('page', (p) => popups.push(p));
  await pg.addInitScript(({ s, vue, uid, cache, sombre }) => {
    try { if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {}
    try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {}
    try { if (vue !== undefined && !sessionStorage.getItem('banc_init')) { localStorage.setItem('vrm_equipe_vue_' + uid, vue); } } catch (_) {}
    try { if (cache !== undefined && !sessionStorage.getItem('banc_init')) localStorage.setItem('vrm_equipe_cache_' + uid, JSON.stringify(cache)); } catch (_) {}
    try { sessionStorage.setItem('banc_init', '1'); } catch (_) {}
  }, { s: session(qui), vue, uid: qui, cache, sombre });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, async (r) => {
    const rq = r.request(), u = rq.url();
    if (/supabase\.co\//.test(u)) {
      const x = fauxSupabase(u, rq.method(), rq.headers(), rq.postData() || '');
      return r.fulfill({ status: x.status, headers: x.headers, body: x.body });
    }
    return ['image', 'media', 'font'].includes(rq.resourceType()) ? r.abort() : r.fulfill({ status: 404, body: '' });
  });
  await pg.route('**/api/**', async (r) => {
    const rq = r.request(), u = new URL(rq.url());
    const mode = u.searchParams.get('mode');
    if (u.pathname === '/api/compte' && (mode === 'equipe' || mode === 'abonnement')) {
      let corps = null; try { corps = rq.postData() ? JSON.parse(rq.postData()) : null; } catch (_) {}
      const res = { code: 200, corps: null, setHeader() {}, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, end() { return this; } };
      const h = rq.headers();
      await compte({ method: rq.method(), query: Object.fromEntries(u.searchParams), headers: h, body: corps || undefined, async *[Symbol.asyncIterator]() {} }, res);
      return r.fulfill({ status: res.code, contentType: 'application/json', body: JSON.stringify(res.corps) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  B.journal = [];
  await pg.goto(`http://localhost:${PORT}/${tab ? '?tab=' + tab : ''}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4000);
  return { ctx, pg, erreurs, popups };
}
const texte = (pg) => pg.evaluate(() => document.body.innerText);
const nav_ = (journal) => journal.filter((j) => j.depuis === 'navigateur');
const MONTANTS = /€|\b42[.,]00\b|\b55[.,]00\b|\b99[.,]00\b|\b25[.,]00\b|281|2\s?235|acheteur_secret/;

(async () => {
  // Un vrai PDF (une page) pour l'impression.
  try {
    const { PDFDocument } = require(path.join(RACINE, 'node_modules', 'pdf-lib'));
    const d = await PDFDocument.create(); d.addPage([595, 842]); PDF_B64 = Buffer.from(await d.save()).toString('base64');
  } catch (e) { console.log('❌ pdf-lib introuvable : ' + e.message); process.exit(1); }
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { console.log('❌ api/compte.js ne se charge pas : ' + e.message); process.exit(1); }
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    // (17 octobre) L'écran d'équipe est monté hors d'AppCoeur : il restait en
    // clair dans une app choisie en sombre (cartes blanches sur fond noir).
    console.log(`\n── 390 px · l'aide, app en mode sombre`);
    await essaie('membre sombre', async () => {
      reset();
      const { ctx, pg } = await ouvrir(nav, { qui: M, largeur: 390, sombre: true });
      const m = await pg.evaluate(() => {
        const lum = (c) => { const v = (c.match(/[\d.]+/g) || []).slice(0, 4).map(Number); if (v.length === 4 && v[3] === 0) return null; const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]); };
        const e = document.querySelector('[data-colis-equipe]'); if (!e) return null;
        // Les SURFACES (cartes, blocs) seulement : un bouton d'accent bleu n'est pas un fond.
        const fonds = [...e.querySelectorAll('*')].concat([e]).filter((x) => !x.closest('button,a') && x.getBoundingClientRect().width * x.getBoundingClientRect().height > 8000).map((x) => lum(getComputedStyle(x).backgroundColor)).filter((x) => x != null);
        const txt = lum(getComputedStyle(e.querySelector('h1,h2,h3') || e).color);
        return { max: fonds.length ? Math.max(...fonds) : null, txt };
      });
      dit(m && m.max != null && m.max < 0.2, 'mode sombre : aucun fond clair sur l\'écran des colis de l\'équipe', JSON.stringify(m));
      dit(m && m.txt != null && m.txt > 0.4, 'mode sombre : le titre est écrit en clair', JSON.stringify(m));
      await ctx.close();
    });
    for (const L of [390, 1512]) {
      console.log(`\n── ${L} px · l'aide (aucune boutique) arrive sur les colis du vendeur`);
      await essaie(`membre ${L}`, async () => {
        reset();
        const { ctx, pg, erreurs, popups } = await ouvrir(nav, { qui: M, largeur: L });
        const ecran = await pg.evaluate(() => { const e = document.querySelector('[data-colis-equipe]'); return e ? e.getAttribute('data-colis-equipe') : null; });
        dit(ecran === V, 'l’écran des colis de l’équipe s’ouvre, sur le bon vendeur', `rendu ${ecran}`);
        dit(!(await pg.evaluate(() => !!document.querySelector('[data-abonnement-requis]'))), 'aucune porte d’abonnement (un aide ne paie pas)');
        const t = await texte(pg);
        const v = await pg.evaluate(() => [...document.querySelectorAll('[data-equipe-vente]')].map((e) => e.getAttribute('data-equipe-vente')));
        dit(v.length === 1 && v[0] === '9001', 'à expédier : la vente à poster, ni la finalisée ni celle déjà cochée « posté »', JSON.stringify(v));
        dit(/Nike Air Max 90/.test(t) && /N°12/.test(t), 'le titre et le N° du bordereau sont dits');
        const code = await pg.evaluate(() => { const e = document.querySelector('[data-equipe-code="8001"]'); return e ? e.innerText.trim() : ''; });
        dit(code === '734512', 'à retirer : le code de retrait est affiché', code);
        dit(!MONTANTS.test(t), 'AUCUN montant affiché (ni prix, ni solde, ni acheteur)', (t.match(MONTANTS) || [''])[0]);
        const n = nav_(B.journal);
        const interdits = n.filter((j) => /id=eq\.main|vinted_accounts|_txn_|_billing|orders_(sold|purchased)|email_sale_/.test(j.u));
        dit(interdits.length === 0, 'aucune requête de son navigateur vers main, vinted_accounts, les transactions, l’argent', interdits.map((j) => j.u.split('/rest/v1/')[1]).join(' · ').slice(0, 200));
        const lectures = n.filter((j) => /\/rest\/v1\/app_data/.test(j.u) && !/select=owner/.test(j.u));
        dit(lectures.length > 0 && lectures.every((j) => j.entete === V && new RegExp('owner=eq\\.' + V).test(j.u)), 'chaque lecture de colis porte x-vrm-equipe ET owner=eq.<vendeur>', lectures.filter((j) => j.entete !== V || !j.u.includes('owner=eq.' + V)).map((j) => j.u.split('/rest/v1/')[1]).join(' · ').slice(0, 200) || `${lectures.length} lectures`);
        // Imprimer : les octets du PDF partent AVEC l'en-tête.
        const avant = B.journal.length;
        const bouton = pg.locator('[data-equipe-imprimer="9001"]');
        dit(await bouton.count() === 1, 'le bouton « Imprimer le bordereau » est là');
        if (await bouton.count()) {
          await bouton.click(); await pg.waitForTimeout(2500);
          const pdf = B.journal.slice(avant).filter((j) => /pdfB64/.test(j.u));
          dit(pdf.length === 1 && pdf[0].entete === V, 'imprimer lit le PDF avec x-vrm-equipe', pdf.map((j) => j.entete).join(','));
          const m = await pg.evaluate(() => { const e = document.querySelector('[data-equipe-msg="9001"]'); return e ? e.innerText : ''; });
          dit(!m, 'l’impression aboutit (aucun message d’erreur)', m);
          dit(popups.length >= 1 || await pg.evaluate(() => !!document.querySelector('[data-colis-equipe] a[href^="blob:"]')), 'le bordereau est ouvert (onglet, ou lien « Ouvrir »)');
        }
        dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | ').slice(0, 160));
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        dit(deb <= 1, 'aucun débordement horizontal', `${deb}px`);
        await ctx.close();
      });

      console.log(`── ${L} px · invitation retirée ⇒ plus rien`);
      await essaie(`revoque ${L}`, async () => {
        reset({ statutM: 'revoquee' });
        // L'appareil se souvient d'avoir été membre (cache + choix) : la base, elle, dit non.
        const { ctx, pg, erreurs } = await ouvrir(nav, { qui: M, largeur: L, vue: V, cache: { membreDe: [{ id: 'e0000000-0000-4000-8000-000000000001', vendeur: V, de: 'vendeur@exemple.test' }], aBoutique: false } });
        const t = await texte(pg);
        dit(!/Nike Air Max|734512|New Balance/.test(t), 'aucun colis du vendeur n’est affiché', (t.match(/Nike Air Max|734512|New Balance/) || [''])[0]);
        dit(/plus accès/i.test(t), 'l’écran dit que l’accès a été retiré', t.replace(/\n/g, ' ').slice(0, 120));
        dit(!MONTANTS.test(t), 'aucun montant affiché');
        dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | ').slice(0, 160));
        await ctx.close();
      });

      console.log(`── ${L} px · base sans la 016`);
      await essaie(`non installe ${L}`, async () => {
        reset({ installe: false });
        const { ctx, pg, erreurs } = await ouvrir(nav, { qui: M, largeur: L, vue: V });
        const t = await texte(pg);
        dit(/Le mode équipe n'est pas encore activé sur ta base\./.test(t), 'l’écran de l’équipe dit « le mode équipe n’est pas encore activé sur ta base »', t.replace(/\n/g, ' ').slice(0, 120));
        dit(!/PGRST|404|Could not find/i.test(t), 'jamais une erreur brute');
        dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      await essaie(`non installe reglages ${L}`, async () => {
        reset({ installe: false });
        const { ctx, pg } = await ouvrir(nav, { qui: V, largeur: L, tab: 'settings' });
        await ouvrirEquipe(pg, L);
        const e = await pg.evaluate(() => { const x = document.querySelector('[data-equipe-reglage]'); return x ? [x.getAttribute('data-equipe-reglage'), x.innerText] : [null, '']; });
        dit(e[0] === 'non-installe' && /pas encore activé sur ta base/.test(e[1]), 'Réglages → Équipe : la même phrase, aucun bouton « Inviter »', `${e[0]} · ${e[1].slice(0, 80)}`);
        await ctx.close();
      });

      console.log(`── ${L} px · le vendeur : son app comme avant, et son équipe dans Mon compte`);
      await essaie(`vendeur ${L}`, async () => {
        reset();
        const { ctx, pg, erreurs } = await ouvrir(nav, { qui: V, largeur: L, tab: 'settings' });
        dit(!(await pg.evaluate(() => !!document.querySelector('[data-colis-equipe]'))) && await pg.evaluate(() => !!document.querySelector('[data-onglets-reglages]')), 'le vendeur voit SON app (Paramètres rendus), pas l’écran d’équipe');
        dit(!nav_(B.journal).some((j) => j.entete), 'aucune de ses requêtes ne porte x-vrm-equipe');
        await ouvrirEquipe(pg, L);
        const etat = await pg.evaluate(() => { const x = document.querySelector('[data-equipe-reglage]'); return x ? x.getAttribute('data-equipe-reglage') : null; });
        dit(etat === 'lu', 'Réglages → Mon compte → Équipe est lu', etat);
        const tt = await pg.evaluate(() => { const x = document.querySelector('[data-equipe-reglage]'); return x ? x.innerText : ''; });
        dit(/aide@exemple\.test/.test(tt) && /aucun montant/i.test(tt) && /ne peut rien modifier/i.test(tt), 'il voit son équipe et ce qu’un membre voit / ne voit pas', tt.replace(/\n/g, ' ').slice(0, 160));
        await pg.fill('[data-equipe-email]', 'nouvelle@exemple.test');
        await pg.click('[data-equipe-inviter]'); await pg.waitForTimeout(1500);
        const inv = B.equipe.find((x) => x.email === 'nouvelle@exemple.test');
        dit(!!inv && inv.vendeur === V && inv.statut === 'invitee', 'inviter par email crée l’invitation (chez LUI)');
        dit(/nouvelle@exemple\.test/.test(await pg.evaluate(() => document.querySelector('[data-equipe-reglage]').innerText)), 'la liste la montre aussitôt');
        // Retirer l'aide (confirmation dans la feuille de l'app).
        await pg.click('[data-equipe-revoquer="e0000000-0000-4000-8000-000000000001"]'); await pg.waitForTimeout(700);
        // Le bouton de confirmation a le focus (feuille de l'app) : Entrée confirme.
        await pg.keyboard.press('Enter');
        await pg.waitForTimeout(1500);
        dit(B.equipe.find((x) => x.membre === M).statut === 'revoquee', 'retirer l’aide passe son invitation à « retirée » (après confirmation)');
        dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | ').slice(0, 160));
        await ctx.close();
      });
    }

    console.log('\n── Une invitation en attente, côté invité (sans boutique) : accepter d’un clic');
    for (const L of [390, 1512]) await essaie(`accepter ${L}`, async () => {
      reset({ statutM: 'invitee' });
      const { ctx, pg, erreurs } = await ouvrir(nav, { qui: M, largeur: L });
      const inv = await pg.evaluate(() => [...document.querySelectorAll('[data-equipe-invitations] [data-accepter]')].map((e) => e.getAttribute('data-accepter')));
      dit(inv.length === 1, `${L} px : son invitation est proposée avant tout, avec « Accepter »`, JSON.stringify(inv));
      dit(/vendeur@exemple\.test/.test(await texte(pg)), `${L} px : elle dit qui invite`);
      if (inv.length) { await pg.click('[data-accepter]'); await pg.waitForTimeout(3500); }
      dit(B.equipe[0].statut === 'actif' && await pg.evaluate(() => !!document.querySelector('[data-colis-equipe]')), `${L} px : acceptée ⇒ les colis du vendeur s’ouvrent`);
      dit(erreurs.length === 0, `${L} px : aucune erreur de page`, erreurs.join(' | ').slice(0, 160));
      await ctx.close();
    });

    console.log('\n── Une vendeuse qui aide AUSSI : sa propre app, et l’équipe sur son clic');
    await essaie('double casquette', async () => {
      reset();
      const { ctx, pg, erreurs } = await ouvrir(nav, { qui: W, largeur: 1512, tab: 'settings' });
      dit(!(await pg.evaluate(() => !!document.querySelector('[data-colis-equipe]'))), 'elle arrive sur SA boutique, pas sur celle de V');
      dit(!nav_(B.journal).some((j) => j.entete), 'ses écrans ne demandent jamais les lignes de V (aucun x-vrm-equipe)');
      await ouvrirEquipe(pg, 1512);
      const b = pg.locator(`[data-ouvrir-equipe="${V}"]`);
      dit(await b.count() === 1, '« Ouvrir ses colis » est proposé dans Mon compte → Équipe');
      if (await b.count()) { B.journal = []; await b.click(); await pg.waitForTimeout(3500); }
      const ecran = await pg.evaluate(() => { const e = document.querySelector('[data-colis-equipe]'); return e ? e.getAttribute('data-colis-equipe') : null; });
      dit(ecran === V, 'l’écran des colis de V s’ouvre');
      const v = await pg.evaluate(() => [...document.querySelectorAll('[data-equipe-vente]')].map((e) => e.getAttribute('data-equipe-vente')));
      dit(v.length === 1 && v[0] === '9001', 'il montre les colis de V, jamais ceux de W', JSON.stringify(v));
      dit(!/Converse W/.test(await texte(pg)), 'le bordereau de W n’y est pas mêlé');
      const p = pg.locator('[data-equipe-propre]');
      if (await p.count()) { await p.first().click(); await pg.waitForTimeout(2500); }
      dit(!(await pg.evaluate(() => !!document.querySelector('[data-colis-equipe]'))), '« Ma propre boutique » la ramène chez elle');
      dit(erreurs.length === 0, 'aucune erreur de page', erreurs.join(' | ').slice(0, 160));
      await ctx.close();
    });
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();

async function ouvrirEquipe(pg, L) {
  const onglet = pg.locator('[data-onglets-reglages] [data-vue="compte"]');
  if (await onglet.count()) { await onglet.first().click(); await pg.waitForTimeout(1500); }
  if (L < 600) {
    const l = pg.locator('[data-sous-ouvrir="equipe"]');
    if (await l.count()) { await l.first().click(); await pg.waitForTimeout(800); }
  }
  await pg.waitForTimeout(800);
}
