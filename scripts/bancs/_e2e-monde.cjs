// ════════════════════════════════════════════════════════════════════════════
//  LE MONDE DU BANC E2E (11 nov.) — faux vinted.fr, faux Supabase, vrm.center
//
//  Un seul serveur HTTPS LOCAL qui répond sous les VRAIS noms (le DNS de
//  Chromium est redirigé par `--host-resolver-rules`, rien ne sort) :
//    · lgonxzrzjcqthjtbdpzo.supabase.co : GoTrue (mot de passe, renouvellement,
//      `/user`) et un PostgREST À ÉTAT (`_minipgrest.cjs` pour les lectures :
//      projection `select=`, filtres, `or=`, `Range`) ; les écritures portent
//      l'`owner` du jeton (RLS), une lecture ne rend que les lignes du vendeur ;
//    · vrm.center : le vrai `dist/` (l'app construite) et des routes `api/`
//      réduites à ce que l'app attend pour démarrer ;
//    · www.vinted.fr : des pages HTML et l'API v2 à la forme RÉELLE (reprise des
//      audits : `users/current`, `wardrobe/{id}/items`, `my_orders`, `inbox`,
//      `item_upload/items/{id}`). Le compte qui parle est celui du cookie
//      `access_token_web` (JWT, `account_id`) — comme Vinted, et comme la garde
//      de l'extension le lit. Chaque requête est NOTÉE (méthode, chemin, compte
//      du cookie, `Authorization`), avec combien sont EN VOL en même temps.
//  Données INVENTÉES (le dépôt est public). Aucun jeton réel.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), https = require('https');
const { execFileSync } = require('child_process');
const { servir } = require('./_minipgrest.cjs');
const { metaVersData } = require('./_meta.cjs');

const SUPA = 'lgonxzrzjcqthjtbdpzo.supabase.co';
const HOTES = ['vrm.center', SUPA, 'www.vinted.fr', 'images1.vinted.net'];

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (p) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u(p)}.c2lnbmF0dXJl`;
const lireJwt = (t) => { try { return JSON.parse(Buffer.from(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); } catch (_) { return null; } };
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.zip': 'application/zip', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.wasm': 'application/wasm' };

function certificat(dir) {
  const k = path.join(dir, 'cle.pem'), c = path.join(dir, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', k, '-out', c, '-days', '2', '-subj', '/CN=vrm.center',
    '-addext', 'subjectAltName=' + HOTES.map((h) => 'DNS:' + h).join(',')], { stdio: 'ignore' });
  return { key: fs.readFileSync(k), cert: fs.readFileSync(c) };
}

// Le jeton de session Vinted (cookie `access_token_web`) : un JWT dont
// `account_id` est le compte connecté — la seule chose que l'extension en lit.
const jetonVinted = (uid) => jwt({ account_id: Number(uid), sub: String(uid), exp: Math.floor(Date.now() / 1000) + 7200, scope: 'user' });

// ── Les données Vinted inventées, À LA FORME RÉELLE ─────────────────────────
// (formes reprises de audit-baisse-prix, audit-moisson-dressing, audit-forme-capture)
function annonceVinted(id, { titre, prix, uid, login, cree }) {
  return {
    id: Number(id), title: titre, price: { amount: String(prix.toFixed ? prix.toFixed(1) : prix), currency_code: 'EUR' },
    brand_title: 'Nike', size_title: '42', status: 'Très bon état', is_closed: false, is_hidden: false, is_draft: false, is_reserved: false,
    url: `https://www.vinted.fr/items/${id}-annonce`, favourite_count: 3, view_count: 40,
    photos: [{ id: Number(id) * 10, url: `https://images1.vinted.net/t/${id}/f800/photo.jpeg`, full_size_url: `https://images1.vinted.net/t/${id}/f800/photo.jpeg`, is_main: true }],
    user: { id: Number(uid), login }, created_at_ts: cree != null ? cree : Math.floor(Date.now() / 1000) - 86400,
  };
}
function venteVinted(tx, { titre, prix, itemId, statut = 'Commande payée', status = 220 }) {
  return {
    transaction_id: Number(tx), conversation_id: Number(tx) + 1, title: titre, status: statut, transaction_user_status: 'needs_action',
    date: '2026-11-10T09:12:00+01:00', price: { amount: String(prix.toFixed(1)), currency_code: 'EUR' },
    photo: { url: `https://images1.vinted.net/t/${itemId}/f800/photo.jpeg` }, item_id: Number(itemId), status_code: status,
  };
}

function monde({ tls, port, dist, comptes, journal }) {
  // comptes : { [uid]: { login, annonces:[{id,titre,prix}], ventes:[{tx,titre,prix,itemId}] } }
  const st = {
    tables: { app_data: [], vinted_accounts: [] }, n: 0,
    vinted: [], enVol: 0, maxEnVol: 0,
    // réglages injectables : réponse forcée par chemin (429…)
    forcer: [],                 // [{ m:'PUT', re:/item_upload/, status:429, fois:1 }]
    prix: {},                   // id → prix courant (PUT le change)
    ecritures: [],              // chaque écriture PostgREST (table, ids, src)
    api: [],                    // appels vrm.center/api
  };
  for (const [uid, c] of Object.entries(comptes)) for (const a of c.annonces || []) st.prix[a.id] = a.prix;
  const noter = (e) => { if (journal) journal.push(Object.assign({ t: Date.now() }, e)); };
  const quiParle = (req) => { const o = String(req.headers.origin || ''); return /^chrome-extension:/.test(o) ? 'ext' : /vrm\.center/.test(o) ? 'app' : o || 'serveur'; };
  const qui = (req) => { const p = lireJwt(String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')); return p && p.role === 'authenticated' && p.exp * 1000 > Date.now() ? p : null; };
  const rep = (res, code, corps, en = {}) => {
    if (res.writableEnded || res.destroyed) return;
    const b = typeof corps === 'string' || Buffer.isBuffer(corps) ? corps : JSON.stringify(corps);
    res.writeHead(code, Object.assign({ 'content-type': typeof corps === 'string' && /^\s*</.test(corps) ? 'text/html; charset=utf-8' : 'application/json',
      'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'access-control-expose-headers': 'content-range' }, en));
    res.end(b);
  };
  // ── GoTrue ──
  const USERS = new Map();      // email → { id, email, mdp }
  const session = (u) => ({ access_token: jwt({ sub: u.id, email: u.email, role: 'authenticated', session_id: 's' + (++st.n), exp: Math.floor(Date.now() / 1000) + 3600 }), refresh_token: 'r-' + u.id + '-' + (++st.n), expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {} } });
  const jetons = new Map();     // refresh → user
  const ouvrir = (u) => { const s = session(u); jetons.set(s.refresh_token, u); return s; };
  const cle = (t) => (t === 'vinted_accounts' ? 'vinted_user_id' : 'id');
  const supabase = (req, res, url, corps) => {
    const q = url.searchParams, p = url.pathname, m = req.method, src = quiParle(req);
    if (m === 'OPTIONS') return rep(res, 204, '');
    if (p === '/auth/v1/settings') return rep(res, 200, { external: { email: true, google: false, discord: false }, disable_signup: false });
    if (p === '/auth/v1/token') {
      let j = {}; try { j = JSON.parse(corps || '{}'); } catch (_) {}
      if (q.get('grant_type') === 'password') {
        const u = USERS.get(String(j.email || '').toLowerCase());
        if (!u || u.mdp !== j.password) return rep(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
        noter({ k: 'auth', src, action: 'mot de passe' });
        return rep(res, 200, ouvrir(u));
      }
      if (q.get('grant_type') === 'refresh_token') {
        const u = jetons.get(j.refresh_token);
        if (!u) return rep(res, 400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
        return rep(res, 200, ouvrir(u));
      }
    }
    if (p === '/auth/v1/user') { const u = qui(req); return u ? rep(res, 200, { id: u.sub, email: u.email, aud: 'authenticated', role: 'authenticated', email_confirmed_at: '2026-01-01T00:00:00Z', identities: [], app_metadata: { provider: 'email' }, user_metadata: {} }) : rep(res, 401, { msg: 'invalid JWT' }); }
    if (p.startsWith('/auth/v1/')) return rep(res, 200, {});
    if (p.startsWith('/rest/v1/rpc/')) return rep(res, 200, null);
    const t = p.replace('/rest/v1/', ''), u = qui(req);
    if (!st.tables[t]) st.tables[t] = [];
    const rows = st.tables[t];
    const k = cle(t);
    const miens = () => rows.filter((r) => u && r.owner === u.sub);
    if (m === 'GET' || m === 'HEAD') {
      if (!u) return rep(res, 200, []);
      // `meta->>k` (colonne calculée par la base, migration 004) : relu dans `data`, même règle que le SQL.
      const r = servir(miens(), metaVersData(url.toString()), req.headers);
      noter({ k: 'rest', src, m, t, q: url.search.slice(0, 160), n: r.body.length });
      return rep(res, 200, r.body, { 'content-range': r.range });
    }
    if (!u) return rep(res, 401, { code: '42501', message: 'new row violates row-level security policy' });
    let corpsJ = null; try { corpsJ = corps ? JSON.parse(corps) : null; } catch (_) {}
    if (m === 'POST') {
      const arr = Array.isArray(corpsJ) ? corpsJ : corpsJ ? [corpsJ] : [];
      // `on_conflict=owner,id` (cloisonné) : la ligne est celle du vendeur du jeton.
      const conflit = (q.get('on_conflict') || k).split(',').filter((x) => x !== 'owner')[0] || k;
      for (const r0 of arr) {
        if (!r0 || r0[conflit] == null) continue;
        const i = rows.findIndex((x) => String(x[conflit]) === String(r0[conflit]));
        if (i >= 0 && rows[i].owner !== u.sub) return rep(res, 403, { code: '42501', message: 'row-level security' });
        const ligne = Object.assign({}, i >= 0 ? rows[i] : {}, r0, { owner: u.sub, updated_at: new Date().toISOString() });
        if (i >= 0) rows[i] = ligne; else rows.push(ligne);
        st.ecritures.push({ t, id: String(r0[conflit]), src, at: Date.now() });
      }
      noter({ k: 'rest', src, m, t, ids: arr.map((x) => x && x[conflit]).join(',').slice(0, 200) });
      const pref = String(req.headers.prefer || '');
      return rep(res, 201, /return=representation/.test(pref) ? arr : '');
    }
    if (m === 'PATCH' || m === 'DELETE') {
      const vis = servir(miens(), metaVersData(url.toString()).replace(/([?&])select=[^&]*/, '$1'), {}).body.map((r) => r[k]);
      const touches = rows.filter((r) => r.owner === u.sub && vis.includes(r[k]));
      if (m === 'DELETE') { st.tables[t] = rows.filter((r) => !touches.includes(r)); }
      else for (const r of touches) { Object.assign(r, corpsJ || {}, { owner: u.sub, updated_at: new Date().toISOString() }); st.ecritures.push({ t, id: String(r[k]), src, at: Date.now() }); }
      noter({ k: 'rest', src, m, t, n: touches.length });
      return rep(res, m === 'DELETE' ? 204 : 200, /return=representation/.test(String(req.headers.prefer || '')) ? touches : '');
    }
    return rep(res, 200, []);
  };
  // ── vrm.center ──
  const vrm = (req, res, url, corps) => {
    const p = url.pathname;
    if (p.startsWith('/api/')) {
      st.api.push({ p, q: url.search, m: req.method, src: quiParle(req) });
      if (req.method === 'OPTIONS') return rep(res, 204, '');
      if (p === '/api/sante') return rep(res, 200, { ok: true });
      const u = qui(req);
      if (p === '/api/compte' && url.searchParams.get('mode') === 'session-extension') {
        // Le serveur fabrique une session À PART pour le même compte (lien magique
        // échangé côté serveur en production) : une famille de jetons à elle.
        const usr = u && [...USERS.values()].find((x) => x.id === u.sub);
        if (req.method !== 'POST' || !usr) return rep(res, 401, { erreur: 'session' });
        const s = ouvrir(usr);
        st.sessionsExtension = (st.sessionsExtension || 0) + 1;
        return rep(res, 200, { ok: true, session: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + 3600e3, user_id: usr.id, email: usr.email } });
      }
      if (p === '/api/compte') return rep(res, 200, { ok: true, uid: u ? u.sub : undefined, acces: true, statut: 'active', abonne: true, plan: 'pro', offre: 'pro' });
      return rep(res, 200, { ok: true });
    }
    if (p === '/sw.js') return rep(res, 404, '');
    let f = p; if (f === '/' || !path.extname(f)) f = '/index.html';
    const fp = path.join(dist, f);
    if (!fp.startsWith(dist) || !fs.existsSync(fp)) return rep(res, 404, '');
    res.writeHead(200, { 'content-type': TYPES[path.extname(fp)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(fp).pipe(res);
  };
  // ── www.vinted.fr ──
  const cookieUid = (req) => {
    const c = String(req.headers.cookie || '');
    const m = /(?:^|;\s*)access_token_web=([^;]+)/.exec(c);
    const pl = m && lireJwt(m[1]);
    return pl && pl.account_id ? String(pl.account_id) : null;
  };
  const PAGE = (titre) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${titre} | Vinted</title></head><body><main id="app"><h1>${titre}</h1><p>Faux vinted.fr du banc (aucune donnée réelle).</p></main></body></html>`;
  const vinted = async (req, res, url, corps) => {
    const p = url.pathname, m = req.method;
    // Se connecter sur vinted.fr : le SITE pose le cookie de session (hôte seul,
    // comme Vinted) — `chrome.cookies.onChanged` part comme chez lui.
    if (p === '/banc/connexion') {
      const uid = url.searchParams.get('uid');
      res.writeHead(302, { location: '/', 'set-cookie': [`access_token_web=${jetonVinted(uid)}; Path=/; Secure; HttpOnly; SameSite=Lax`, `refresh_token_web=rt-${uid}-${Date.now()}; Path=/; Secure; HttpOnly; SameSite=Lax`, `anon_id=anon-banc; Path=/; Secure; SameSite=Lax`] });
      return res.end();
    }
    // Le dressing d'un membre : la page (une SPA, comme Vinted) charge ses annonces.
    const mb = /^\/member\/(\d+)/.exec(p);
    if (mb) return rep(res, 200, PAGE('Dressing').replace('</main>', `</main><script>fetch('/api/v2/wardrobe/${mb[1]}/items?page=1&per_page=20&order=relevance',{credentials:'include'});</script>`));
    if (!p.startsWith('/api/')) return rep(res, 200, PAGE(p === '/' ? 'Accueil' : p.split('/')[1] || 'Vinted'));
    const uidCookie = cookieUid(req);
    const e = { m, p, q: url.search, uid: uidCookie, auth: !!req.headers.authorization, origine: String(req.headers.origin || req.headers.referer || ''), corps: corps || '', t: Date.now() };
    st.vinted.push(e); st.enVol++; st.maxEnVol = Math.max(st.maxEnVol, st.enVol);
    const fin = (code, corpsR) => { st.enVol--; e.status = code; rep(res, code, corpsR); };
    await new Promise((r) => setTimeout(r, 40));     // une requête prend un peu de temps : le « en vol » se mesure
    const f = st.forcer.find((x) => x.m === m && x.re.test(p) && x.fois > 0);
    if (f) { f.fois--; return fin(f.status, { message: 'Too Many Requests', code: f.status }); }
    const c = uidCookie && comptes[uidCookie];
    if (!c) return fin(401, { code: 100, message: 'Token is invalid' });
    if (p === '/api/v2/users/current') return fin(200, { user: { id: Number(uidCookie), login: c.login, business: false, item_count: (c.annonces || []).length } });
    let mm = /^\/api\/v2\/wardrobe\/(\d+)\/items$/.exec(p);
    if (mm) {
      const cible = comptes[mm[1]];
      const items = cible ? cible.annonces.map((a) => annonceVinted(a.id, { titre: a.titre, prix: st.prix[a.id], uid: mm[1], login: cible.login, cree: a.cree })) : [];
      return fin(200, { items, pagination: { current_page: 1, total_pages: 1, total_entries: items.length, per_page: 200 } });
    }
    if (p === '/api/v2/my_orders') {
      const type = url.searchParams.get('type');
      const l = type === 'sold' ? (c.ventes || []).map((v) => venteVinted(v.tx, v)) : [];
      return fin(200, { my_orders: l, pagination: { current_page: 1, total_pages: 1, total_entries: l.length, per_page: 100 } });
    }
    if (p === '/api/v2/inbox') return fin(200, { conversations: [], pagination: { current_page: 1, total_pages: 1, total_entries: 0 } });
    mm = /^\/api\/v2\/item_upload\/items\/(\d+)$/.exec(p);
    if (mm) {
      const a = (c.annonces || []).find((x) => String(x.id) === mm[1]);
      if (!a) return fin(404, { code: 404, message: 'not found' });
      if (m === 'PUT') { try { const b = JSON.parse(corps); st.prix[a.id] = Number(b.item.price.amount); } catch (_) {} return fin(200, { item: { id: a.id } }); }
      return fin(200, { item: { id: a.id, title: a.titre, description: 'Très bon état', price: { amount: String(st.prix[a.id]), currency_code: 'EUR' }, photos: [{ id: a.id * 10 }], catalog_id: 1234, user_id: Number(uidCookie) } });
    }
    return fin(200, {});
  };
  const srv = https.createServer(tls, (req, res) => {
    const host = String(req.headers.host || '').split(':')[0];
    const url = new URL(req.url, 'https://' + host);
    let corps = '';
    req.on('data', (ch) => { corps += ch; });
    req.on('end', () => {
      try {
        if (host === SUPA) return supabase(req, res, url, corps);
        if (host === 'vrm.center') return vrm(req, res, url, corps);
        if (host === 'www.vinted.fr') return vinted(req, res, url, corps);
        if (host === 'images1.vinted.net') { res.writeHead(200, { 'content-type': 'image/svg+xml', 'access-control-allow-origin': '*' }); return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#ccc"/></svg>'); }
        return rep(res, 404, '');
      } catch (e2) { try { rep(res, 500, { e: String(e2) }); } catch (_) {} }
    });
  });
  return {
    st, srv, USERS, ouvrir, jwt, lireJwt,
    lignes: (t = 'app_data') => st.tables[t] || [],
    ligne: (id) => (st.tables.app_data || []).find((r) => r.id === id) || null,
    ecouter: () => new Promise((r, x) => { srv.once('error', x); srv.listen(port, '127.0.0.1', r); }),
    fermer: () => new Promise((r) => { srv.closeAllConnections && srv.closeAllConnections(); srv.close(() => r()); }),
  };
}

module.exports = { monde, certificat, jetonVinted, jwt, lireJwt, HOTES, SUPA };
