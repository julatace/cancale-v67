// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA CONNEXION DE L'EXTENSION TIENT » — 11 octobre
//
//  Julien : « quand j'appuie sur se connecter ça doit envoyer directement dans
//  l'application VRM », « elle ne garde pas les connexions, à chaque fois je
//  dois me reconnecter et mes données ne sont pas bonnes », « l'extension est
//  censée être allumée, elle n'est pas allumée ».
//
//  Un VRAI Chromium, la VRAIE extension chargée depuis son dossier (service
//  worker, pont, page de connexion, `externally_connectable`), le VRAI build de
//  l'app (`dist/`), servis sous leurs vrais noms (vrm.center, supabase.co) par un
//  serveur HTTPS LOCAL — le DNS de Chromium est redirigé, rien ne sort.
//  Un faux GoTrue applique la rotation des jetons comme le VRAI (lu dans
//  supabase/auth, `internal/tokens/service.go`) :
//    · le jeton courant tourne : il est révoqué, un enfant naît ;
//    · le PARENT direct du jeton actif est accepté SANS limite de temps (GoTrue
//      rend alors le jeton actif — le client n'a pas pu ranger sa réponse) ;
//    · un autre jeton révoqué n'est accepté que 10 s après sa révocation ;
//      au-delà, TOUTE la famille est révoquée (« Possible abuse attempt ») et la
//      réponse est 400 `refresh_token_already_used`.
//  Données INVENTÉES (un vendeur, aucun jeton réel) : ce banc vit dans le dépôt.
//
//  Ce qui est mesuré (chaque cas sur un profil Chrome neuf) :
//    A. « Se connecter avec VRM » dans l'extension, l'app connectée : VRM s'ouvre
//       et l'extension reçoit SA session (une autre famille que l'app), seule ;
//    B. le même clic, l'app PAS connectée : écran de connexion de l'app, une
//       connexion, et l'extension est connectée avec ;
//    C. (B9) l'extension a sa session saine, l'app démarre avec une session
//       morte : l'extension GARDE la sienne ;
//    D. une réponse de renouvellement perdue : la session revient en quelques
//       secondes, sans pause de 30 s ;
//    E. une session d'extension morte : l'app ouverte la répare en quelques
//       secondes (avant : au battement suivant, jusqu'à 20 s, et rien sans app) ;
//    F. une extension ANCIENNE (5.164 — il ne peut pas la mettre à jour) seule,
//       sans session, session MORTE ou sur un AUTRE compte VRM : l'app lui donne
//       une session fabriquée POUR ELLE par le serveur (l'ancien message de la
//       page, comme la production 2fed734) — jamais la sienne ; et deux copies
//       (5.164 + 5.174) ne reçoivent RIEN (relecture croisée de la 5.174) ;
//    G. code PÉRIMÉ (dossier remplacé, ⟳ jamais cliqué) : réparé tout seul ;
//    H. l'app et l'extension renouvellent chacune plusieurs fois : aucune ne
//       tue l'autre ;
//    S. « Se déconnecter » de VRM avec une 5.164 connectée : elle oublie sa
//       session — puis, à la reconnexion à VRM, elle la RETROUVE (relecture
//       croisée de la 5.174 : elle restait déconnectée pour de bon).
//
//  Usage : node scripts/bancs/session.cjs [--arbre DOSSIER] [--seul A,C]
//    `--arbre` : un autre arbre (son `dist/` construit et son
//    `vinted-sync-extension/`) — c'est la preuve §6.1 sur le code d'avant.
//  Port : 4794 (`BANC_PORT` pour un autre).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), https = require('https'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const chargerPw = () => { for (const p of [__dirname, process.cwd(), '/home/user/cancale-v67']) { try { return require(require.resolve('playwright', { paths: [p] })); } catch (_) {} } return null; };
const pw = chargerPw();
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = Number(process.env.BANC_PORT) || 4794;
const iA = process.argv.indexOf('--arbre');
const ARBRE = iA > 0 ? path.resolve(process.argv[iA + 1]) : path.join(__dirname, '..', '..');
const iS = process.argv.indexOf('--seul');
const SEULS = iS > 0 ? process.argv[iS + 1].split(',') : null;
const DIST = path.join(ARBRE, 'dist');
const EXT_SRC = path.join(ARBRE, 'vinted-sync-extension');
const DEPOT = (() => { let d = path.join(__dirname, '..', '..'); for (let i = 0; i < 6; i++) { if (fs.existsSync(path.join(d, '.git'))) return d; d = path.dirname(d); } return process.env.VRM_DEPOT || ''; })();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-banc-session-'));
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + det : ''}`); } };

// ── Le certificat du serveur local (jetable, généré ici : rien dans le dépôt) ──
function certificat() {
  const k = path.join(TMP, 'cle.pem'), c = path.join(TMP, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', k, '-out', c, '-days', '2', '-subj', '/CN=vrm.center',
    '-addext', 'subjectAltName=DNS:vrm.center,DNS:lgonxzrzjcqthjtbdpzo.supabase.co,DNS:www.vinted.fr'], { stdio: 'ignore' });
  return { key: fs.readFileSync(k), cert: fs.readFileSync(c) };
}

// ══ LE FAUX SERVEUR : GoTrue (rotation réelle), PostgREST minimal, vrm.center ══
const U = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'vendeur@exemple.test' };
const MDP = 'bon-mot-de-passe';
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (p) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u(p)}.c2lnbmF0dXJl`;
const lireJwt = (t) => { try { return JSON.parse(Buffer.from(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); } catch (_) { return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.zip': 'application/zip', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

function fauxServeur(tls) {
  const st = { sessions: new Map(), jetons: new Map(), n: 0, journal: [], pannes: [], rows: new Map(), fourches: 0, delaiRefresh: new Map() };
  const noter = (e) => st.journal.push(Object.assign({ t: Date.now() }, e));
  const quiParle = (req) => { const o = String(req.headers.origin || ''); return /^chrome-extension:/.test(o) ? 'ext' : /vrm\.center/.test(o) ? 'app' : o || 'serveur'; };
  const acces = (sid, u, exp = 3600) => ({ access_token: jwt({ sub: u.id, email: u.email, role: 'authenticated', session_id: sid, exp: Math.floor(Date.now() / 1000) + exp }), expires_in: exp, token_type: 'bearer', user: { id: u.id, email: u.email } });
  const nouveauJeton = (sid, parent) => { const token = `r-${sid}-${++st.n}`; st.jetons.set(token, { token, sid, parent, revoque: false, maj: Date.now(), cree: st.n }); return st.jetons.get(token); };
  const actif = (sid) => [...st.jetons.values()].filter((t) => t.sid === sid && !t.revoque).sort((a, b) => b.cree - a.cree)[0] || null;
  const nouvelleSession = (via, u = U) => {
    const sid = 's' + (st.sessions.size + 1) + '-' + via;
    st.sessions.set(sid, { sid, via, user: u, revoquee: false, raison: '', sources: new Set() });
    const t = nouveauJeton(sid, null);
    return Object.assign(acces(sid, u), { refresh_token: t.token });
  };
  // La rotation de GoTrue v2.19x, réduite à ce qui compte ici.
  const renouveler = (rt, src) => {
    const t = st.jetons.get(rt);
    if (!t) return { st: 400, j: { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }, action: 'introuvable' };
    const s = st.sessions.get(t.sid); s.sources.add(src);
    let rendu = null, action = 'rotation';
    if (t.revoque) {
      const a = actif(t.sid);
      if (a && a.parent === t.token) { rendu = a; action = 'parent du jeton actif → jeton actif rendu'; }   // accepté, sans limite de temps
      else if (Date.now() > t.maj + 10000) {                           // hors des 10 s : la famille entière tombe
        for (const x of st.jetons.values()) if (x.sid === t.sid) { x.revoque = true; x.maj = Date.now(); }
        s.revoquee = true; s.raison = 'réutilisation par ' + src;
        return { st: 400, j: { code: 400, error_code: 'refresh_token_already_used', msg: 'Invalid Refresh Token: Already Used' }, action: 'REUTILISATION', sid: t.sid };
      }
    }
    if (!rendu) { if (t.revoque) action = 'réutilisation dans les 10 s'; t.revoque = true; t.maj = Date.now(); rendu = nouveauJeton(t.sid, t.token); }
    return { st: 200, j: Object.assign(acces(t.sid, s.user), { refresh_token: rendu.token }), action, sid: t.sid };
  };
  const revoquer = (sid) => { const s = st.sessions.get(sid); if (!s) return; s.revoquee = true; for (const x of st.jetons.values()) if (x.sid === sid) { x.revoque = true; x.maj = Date.now() - 60000; } };
  const qui = (req) => { const p = lireJwt(String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')); return p && p.role === 'authenticated' && p.exp * 1000 > Date.now() ? p : null; };
  const rep = (res, code, corps, h = {}) => {
    if (res.writableEnded || res.destroyed) return;
    const b = typeof corps === 'string' || Buffer.isBuffer(corps) ? corps : JSON.stringify(corps);
    res.writeHead(code, Object.assign({ 'content-type': typeof corps === 'string' && /^</.test(corps) ? 'text/html; charset=utf-8' : 'application/json',
      'access-control-allow-origin': h.origin || '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'access-control-expose-headers': 'content-range' }, h.en || {}));
    res.end(b);
  };
  const chemin = (row, src) => {
    if (src === 'id') return row.id;
    if (src === 'data') return row.data;
    let s = src; if (/^meta->>/.test(s)) s = 'data->>' + s.slice(7);
    let v = row; for (const seg of s.split(/->>|->/)) v = v == null ? null : v[seg];
    return v === undefined ? null : v;
  };
  const projeter = (row, sel) => {
    if (!sel || sel === '*') return { id: row.id, data: row.data };
    const out = {};
    for (const part of sel.split(',')) { const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue; out[m[1] || m[2].split(/->>|->/).pop()] = chemin(row, m[2]); }
    return out;
  };
  const supabase = (req, res, url, corps) => {
    const q = url.searchParams, p = url.pathname, m = req.method, src = quiParle(req);
    if (m === 'OPTIONS') return rep(res, 204, '');
    if (p === '/auth/v1/settings') return rep(res, 200, { external: { email: true, google: false, discord: false }, disable_signup: false });
    if (p === '/auth/v1/token') {
      let j = {}; try { j = JSON.parse(corps || '{}'); } catch (_) {}
      if (q.get('grant_type') === 'password') {
        if (String(j.email || '').toLowerCase() !== U.email || j.password !== MDP) return rep(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
        const s = nouvelleSession(src === 'ext' ? 'ext-mot-de-passe' : 'app-mot-de-passe');
        noter({ k: 'auth', src, action: 'mot de passe', sid: lireJwt(s.access_token).session_id });
        return rep(res, 200, s);
      }
      if (q.get('grant_type') === 'refresh_token') {
        const panne = st.pannes.shift();
        const r = renouveler(j.refresh_token, src);
        noter({ k: 'auth', src, action: r.action, sid: r.sid || '', st: r.st });
        const envoyer = () => rep(res, r.st, r.j);
        // ⚠️ Une connexion COUPÉE ne suffit pas à perdre la réponse : Chrome
        //    rejoue tout seul une requête dont la connexion réutilisée tombe avant
        //    le premier octet (le premier jet de ce banc était vert sur le code
        //    d'avant pour cette raison). La vraie perte, c'est une réponse qui
        //    n'arrive pas à temps : le jeton a tourné, le client a abandonné.
        if (panne && /^lent:/.test(panne) && r.st === 200) { noter({ k: 'auth', src, action: 'PANNE : réponse retardée après la rotation' }); return setTimeout(() => rep(res, r.st, r.j), Number(panne.split(':')[1])); }
        const d = st.delaiRefresh.get(j.refresh_token) || 0;
        return d ? setTimeout(envoyer, d) : envoyer();
      }
    }
    if (p === '/auth/v1/user') { const u = qui(req); return u ? rep(res, 200, { id: u.sub, email: u.email, email_confirmed_at: '2026-01-01T00:00:00Z' }) : rep(res, 401, { msg: 'invalid JWT' }); }
    if (p === '/auth/v1/logout') { const u = qui(req); if (u) revoquer(u.session_id); return rep(res, 204, ''); }
    if (p.startsWith('/auth/v1/')) return rep(res, 200, {});
    const t = p.replace('/rest/v1/', ''), u = qui(req);
    if (t === 'app_data' && q.get('select') === 'owner') return rep(res, 200, []);
    if (t === 'app_data') {
      if (m === 'GET') {
        if (!u) return rep(res, 200, []);
        const id = q.get('id') || '';
        let rows = [...st.rows.values()];
        if (id.startsWith('eq.')) rows = rows.filter((r) => r.id === id.slice(3));
        else if (id.startsWith('like.')) { const re = new RegExp('^' + id.slice(5).replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); rows = rows.filter((r) => re.test(r.id)); }
        const out = rows.map((r) => projeter(r, q.get('select')));
        return rep(res, 200, out, { en: { 'content-range': `0-${Math.max(0, out.length - 1)}/${out.length}` } });
      }
      if (m === 'POST') {
        if (!u) return rep(res, 401, { message: 'rls' });
        let arr = []; try { arr = JSON.parse(corps || '[]'); } catch (_) {}
        for (const r of (Array.isArray(arr) ? arr : [arr])) if (r && r.id) st.rows.set(r.id, { id: r.id, data: r.data });
        return rep(res, 201, []);
      }
      return rep(res, u ? 204 : 401, '');
    }
    if (t === 'vinted_accounts') return rep(res, 200, []);
    return rep(res, 200, []);
  };
  const vrm = (req, res, url) => {
    const p = url.pathname;
    if (p === '/api/compte' && url.searchParams.get('mode') === 'session-extension') {
      const u = qui(req);
      if (req.method !== 'POST' || !u) return rep(res, 401, { erreur: 'session' });
      st.fourches++;
      // Le serveur fabrique une session À PART pour le même compte (lien magique
      // échangé côté serveur en production) : une famille de jetons à elle.
      const s = nouvelleSession('session-extension');
      noter({ k: 'api', action: 'session-extension', sid: lireJwt(s.access_token).session_id });
      return rep(res, 200, { ok: true, session: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + 3600e3, user_id: u.sub, email: u.email } });
    }
    if (p.startsWith('/api/compte')) return rep(res, 200, { ok: true, acces: true, statut: 'active', abonne: true });
    if (p.startsWith('/api/')) return rep(res, 200, { ok: true, pret: true });
    if (p === '/sw.js') return rep(res, 404, '');
    let f = p; if (f === '/' || !path.extname(f)) f = '/index.html';
    const fp = path.join(DIST, f);
    if (!fp.startsWith(DIST) || !fs.existsSync(fp)) return rep(res, 404, '');
    res.writeHead(200, { 'content-type': types[path.extname(fp)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(fp).pipe(res);
  };
  const srv = https.createServer(tls, (req, res) => {
    const host = String(req.headers.host || '').split(':')[0];
    const url = new URL(req.url, 'https://' + host);
    let corps = '';
    req.on('data', (c) => { corps += c; });
    req.on('end', () => {
      try {
        if (host === 'lgonxzrzjcqthjtbdpzo.supabase.co') return supabase(req, res, url, corps);
        if (host === 'vrm.center') return vrm(req, res, url);
        return rep(res, 200, '<!doctype html><title>x</title><body>faux site</body>');
      } catch (e) { try { rep(res, 500, { e: String(e) }); } catch (_) {} }
    });
  });
  return { st, srv, nouvelleSession, revoquer, actif, ecouter: () => new Promise((r, x) => { srv.once('error', x); srv.listen(PORT, '127.0.0.1', r); }), fermer: () => new Promise((r) => srv.close(() => r())) };
}

// ══ CHROMIUM, L'EXTENSION, LE PROFIL ══════════════════════════════════════
const HOTES = ['vrm.center', 'lgonxzrzjcqthjtbdpzo.supabase.co', 'www.vinted.fr'];
const regles = () => HOTES.map((h) => `MAP ${h} 127.0.0.1:${PORT}`).concat(['MAP * ~NOTFOUND']).join(', ');
// L'identifiant d'une extension non empaquetée = empreinte de son CHEMIN.
const extId = (dir) => crypto.createHash('sha256').update(path.resolve(dir)).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
function lancer(udd, dirs) {
  const args = ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors', `--host-resolver-rules=${regles()}`, '--use-angle=swiftshader', '--enable-unsafe-extension-debugging'];
  const l = [].concat(dirs || []);
  if (l.length) args.push(`--disable-extensions-except=${l.join(',')}`, `--load-extension=${l.join(',')}`);
  return pw.chromium.launchPersistentContext(udd, { executablePath: CHROME, headless: true, ignoreDefaultArgs: ['--disable-extensions'], viewport: { width: 1280, height: 900 }, args });
}
// ⚠️ Un service worker « vu » par Playwright n'a pas forcément fini d'évaluer
//    son script : on attend que ses fonctions et `chrome.storage` existent (le
//    premier jet de ce banc lisait un contexte vide : « authLogin is not defined »).
async function sw(ctx, id, ms = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = ctx.serviceWorkers().find((x) => x.url().startsWith(`chrome-extension://${id}/`));
    if (s) {
      const pret = await s.evaluate(() => typeof chrome !== 'undefined' && !!chrome.storage && typeof authToken === 'function').catch(() => false);
      if (pret) return s;
    }
    await attendre(150);
  }
  return null;
}
const appelSW = async (ctx, id, fn, arg) => { const s = await sw(ctx, id, 6000); if (!s) return { erreur: 'pas de service worker' }; return s.evaluate(fn, arg).catch((e) => ({ erreur: String(e.message || e).slice(0, 160) })); };
// La session de l'extension : sa FAMILLE (le `session_id` de GoTrue), jamais un jeton.
const sessionExt = (ctx, id) => appelSW(ctx, id, async () => {
  const g = await chrome.storage.local.get(['vrmSession', 'vrmRenouv']);
  const x = g.vrmSession;
  const lire = (t) => { try { return JSON.parse(atob(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (_) { return null; } };
  const p = x && lire(x.access_token);
  return { session: x ? { sid: p && p.session_id, jeton: String(x.refresh_token || ''), mort: !!x.mort, expireDans: Math.round((Number(x.expires_at) - Date.now()) / 1000) } : null, renouv: g.vrmRenouv || null };
});
// Copie d'un dossier d'extension (git archive) — pour une version ANCIENNE.
function extensionDe(commit, nom) {
  if (!DEPOT) return null;
  const dir = path.join(TMP, nom);
  fs.mkdirSync(dir, { recursive: true });
  const tar = path.join(TMP, nom + '.tar');
  fs.writeFileSync(tar, execFileSync('git', ['-C', DEPOT, 'archive', commit, 'vinted-sync-extension'], { maxBuffer: 64 * 1024 * 1024 }));
  execFileSync('tar', ['-x', '-f', tar, '-C', dir]);
  return path.join(dir, 'vinted-sync-extension');
}
const copier = (src, nom) => { const d = path.join(TMP, nom); fs.cpSync(src, d, { recursive: true }); return d; };
const remplacer = (dir, src) => { for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { recursive: true, force: true }); for (const f of fs.readdirSync(src)) fs.cpSync(path.join(src, f), path.join(dir, f), { recursive: true }); };

// Ce que la page de l'app poste dans `window` (une session, un « oublie tout ») :
// TOUTE extension de la page l'entend. Noté par le banc, rechargement compris.
async function espionnerPage(ctx, postes) {
  await ctx.exposeBinding('__noterPoste', (_src, quoi) => { postes.push(Object.assign({ t: Date.now() }, quoi)); });
  await ctx.addInitScript(() => {
    if (location.origin !== 'https://vrm.center') return;
    window.addEventListener('message', (e) => {
      const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
      if (d.__vmr === 'session') { try { window.__noterPoste({ type: 'session', nul: d.session == null, jeton: d.session ? String(d.session.refresh_token || '') : '' }); } catch (_) {} }
      if (d.__vmr === 'etat:result') { try { window.__noterPoste({ type: 'etat' }); } catch (_) {} }
    });
  });
}
async function poserSessionApp(ctx, s, { separee = true } = {}) {
  await ctx.addInitScript(({ s, u, separee }) => {
    if (location.origin !== 'https://vrm.center') return;
    try {
      localStorage.setItem('schema_cloisonne', '1');
      if (separee) localStorage.setItem('vrm_ext_separee_' + u.id, '1');
      if (s && !sessionStorage.getItem('__banc_pose')) { sessionStorage.setItem('__banc_pose', '1'); localStorage.setItem('vrm_session', JSON.stringify(s)); }
    } catch (_) {}
  }, { s, u: U, separee });
}
const sessionApp = (F, { morte = false } = {}) => {
  const s = F.nouvelleSession('app-mot-de-passe');
  const sid = lireJwt(s.access_token).session_id;
  if (morte) { F.revoquer(sid); return { sid, s: { access_token: jwt({ sub: U.id, email: U.email, role: 'authenticated', session_id: sid, exp: Math.floor(Date.now() / 1000) - 600 }), refresh_token: s.refresh_token, expires_at: Date.now() - 600e3, user: { id: U.id, email: U.email } } }; }
  return { sid, s: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + 3600e3, user: { id: U.id, email: U.email } } };
};
const pageVRM = async (ctx) => { for (let i = 0; i < 60; i++) { const p = ctx.pages().find((x) => /^https:\/\/vrm\.center\//.test(x.url())); if (p) return p; await attendre(200); } return null; };
const attendreQue = async (fn, ms, pas = 250) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return { v, ms: Date.now() - t0 }; await attendre(pas); } return { v: null, ms: Date.now() - t0 }; };

async function cas(nom, fn) {
  if (SEULS && !SEULS.includes(nom[0])) return;
  console.log(`\n── ${nom}`);
  const F = fauxServeur(TLS);
  try { await F.ecouter(); } catch (e) { dit(false, `${nom} : le port ${PORT} est pris (${e.code}) — relance le banc seul`); return; }
  const ctxs = [];
  try { await fn(F, async (dirs, nomProfil) => { const c = await lancer(path.join(TMP, 'profil-' + nomProfil + '-' + Date.now()), dirs); ctxs.push(c); return c; }); }
  catch (e) { dit(false, `${nom} : le banc a tourné jusqu'au bout`, String(e && e.message).slice(0, 200)); }
  finally {
    // BANC_JOURNAL=1 : qui a renouvelé quoi (jamais un jeton complet).
    if (process.env.BANC_JOURNAL) for (const j of F.st.journal) if (j.k !== 'rest') console.log(`     ${new Date(j.t).toISOString().slice(11, 23)} ${j.k} ${j.src || ''} ${j.action} ${j.sid || ''} ${j.st || ''}`);
    for (const c of ctxs) await c.close().catch(() => {}); await F.fermer();
  }
}

let TLS = null;
(async () => {
  if (!pw) { console.log('❌ Playwright introuvable'); process.exit(1); }
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log(`❌ pas de build dans ${DIST} — lance npm run build`); process.exit(1); }
  TLS = certificat();
  const EXT = copier(EXT_SRC, 'ext');      // un dossier à nous : son identifiant ne dépend pas de l'emplacement du dépôt
  const ID = extId(EXT);
  const MANIF = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  console.log(`extension ${MANIF} (${ID.slice(0, 8)}…) · app ${DIST}`);

  // ══ A. « SE CONNECTER AVEC VRM », L'APP CONNECTÉE ══════════════════════════
  await cas('A · « Se connecter avec VRM », l’app connectée', async (F, ouvrir) => {
    const app = sessionApp(F);
    const ctx = await ouvrir([EXT], 'A');
    const postes = []; await espionnerPage(ctx, postes); await poserSessionApp(ctx, app.s);
    if (!(await sw(ctx, ID))) { dit(false, 'A : le service worker de l’extension démarre'); return; }
    await attendre(1500);
    const pop = await ctx.newPage();
    await pop.goto(`chrome-extension://${ID}/popup.html`); await attendre(800);
    const bouton = await pop.$('#lierBtn');
    dit(!!bouton, 'A : la fenêtre de l’extension propose « Se connecter avec VRM »');
    const t0 = Date.now();
    if (bouton) await bouton.click().catch(() => {});
    const vrm = await pageVRM(ctx);
    dit(!!vrm, 'A : un clic OUVRE VRM', vrm ? vrm.url() : 'aucun onglet vrm.center');
    const r = await attendreQue(async () => { const e = await sessionExt(ctx, ID); return e && e.session && !e.session.mort ? e : null; }, 15000);
    const e = r.v;
    dit(!!e && e.session.sid && /session-extension/.test(e.session.sid), 'A : l’extension est connectée, avec une session fabriquée POUR ELLE par le serveur', JSON.stringify(e && e.session && e.session.sid));
    dit(!!e && e.session.sid !== app.sid, 'A : une AUTRE famille de jetons que l’app (elles ne se marchent plus dessus)', `app ${app.sid} · extension ${e && e.session.sid}`);
    dit(!!e && Date.now() - t0 < 12000, 'A : en quelques secondes, rien à taper', `${Date.now() - t0} ms`);
    const band = vrm ? await vrm.evaluate(() => { const x = document.querySelector('[data-liaison]'); return x ? x.getAttribute('data-liaison') : null; }).catch(() => null) : null;
    dit(band === 'ok' || band === 'deja', 'A : VRM le DIT (« Extension connectée à … »)', String(band));
    dit(postes.filter((p) => p.type === 'session').length === 0, 'A : AUCUNE session postée dans la page (toute extension l’entendrait)', JSON.stringify(postes.filter((p) => p.type === 'session')));
    dit(F.st.fourches === 1, 'A : une seule session fabriquée', `${F.st.fourches}`);
  });

  // ══ B. LE MÊME CLIC, L'APP PAS CONNECTÉE ═══════════════════════════════════
  await cas('B · « Se connecter avec VRM », l’app pas connectée', async (F, ouvrir) => {
    const ctx = await ouvrir([EXT], 'B');
    const postes = []; await espionnerPage(ctx, postes); await poserSessionApp(ctx, null);
    if (!(await sw(ctx, ID))) { dit(false, 'B : le service worker démarre'); return; }
    await attendre(1500);
    const pop = await ctx.newPage();
    await pop.goto(`chrome-extension://${ID}/popup.html`); await attendre(800);
    await pop.click('#lierBtn').catch(() => {});
    const vrm = await pageVRM(ctx);
    dit(!!vrm, 'B : un clic OUVRE VRM', vrm ? vrm.url() : 'aucun');
    if (!vrm) return;
    await vrm.waitForSelector('input[type="password"]', { timeout: 15000 }).catch(() => {});
    const note = await vrm.$('[data-lier-connexion]');
    dit(!!note, 'B : l’écran de connexion de VRM dit que l’extension sera connectée en même temps');
    await vrm.fill('input[type="email"]', U.email).catch(() => {});
    await vrm.fill('input[type="password"]', MDP).catch(() => {});
    await vrm.press('input[type="password"]', 'Enter').catch(() => {});
    const r = await attendreQue(async () => { const e = await sessionExt(ctx, ID); return e && e.session && !e.session.mort ? e : null; }, 20000);
    const appSid = (F.st.journal.find((j) => j.k === 'auth' && j.action === 'mot de passe' && j.src === 'app') || {}).sid;
    dit(!!r.v && /session-extension/.test(r.v.session.sid) && r.v.session.sid !== appSid, 'B : UNE connexion (dans VRM) suffit : l’extension est connectée avec sa propre session', JSON.stringify({ ext: r.v && r.v.session.sid, app: appSid }));
    dit(postes.filter((p) => p.type === 'session').length === 0, 'B : aucune session postée dans la page', JSON.stringify(postes.filter((p) => p.type === 'session')));
  });

  // ══ C. (B9) L'APP DÉMARRE AVEC UNE SESSION MORTE ══════════════════════════
  await cas('C · l’extension a sa session, l’app démarre avec une session morte', async (F, ouvrir) => {
    const app = sessionApp(F, { morte: true });
    // Comme en production le 9 octobre à 18:37 : les réglages d'authentification
    // répondent AVANT le renouvellement refusé.
    F.st.delaiRefresh.set(app.s.refresh_token, 600);
    const ctx = await ouvrir([EXT], 'C');
    const postes = []; await espionnerPage(ctx, postes); await poserSessionApp(ctx, app.s);
    if (!(await sw(ctx, ID))) { dit(false, 'C : le service worker démarre'); return; }
    const co = await appelSW(ctx, ID, async (a) => { const r = await authLogin(a.e, a.p); return r && r.ok; }, { e: U.email, p: MDP });
    const avant = await sessionExt(ctx, ID);
    dit(co === true && avant.session && !avant.session.mort, 'C : l’extension est connectée (sa propre famille)', JSON.stringify({ co, avant }));
    const pg = await ctx.newPage();
    await pg.goto('https://vrm.center/?tab=cat_ventes', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await attendre(5000);
    const ecran = await pg.evaluate(() => !!document.querySelector('input[type="password"]')).catch(() => null);
    const apres = await sessionExt(ctx, ID);
    dit(ecran === true, 'C : l’app, elle, montre son écran de connexion (sa session est morte)', String(ecran));
    dit(!!apres.session && apres.session.jeton === avant.session.jeton && !apres.session.mort, 'C : l’extension GARDE sa session — une app qui démarre déconnectée ne lui fait plus rien oublier', JSON.stringify({ avant: avant.session && avant.session.sid, apres: apres.session }));
    dit(postes.filter((p) => p.type === 'session').length === 0, 'C : aucun « oublie tout » (session: null) posté dans la page', JSON.stringify(postes.filter((p) => p.type === 'session')));
  });

  // ══ D. UNE RÉPONSE DE RENOUVELLEMENT PERDUE ═══════════════════════════════
  await cas('D · une réponse de renouvellement perdue', async (F, ouvrir) => {
    const ctx = await ouvrir([EXT], 'D');
    if (!(await sw(ctx, ID))) { dit(false, 'D : le service worker démarre'); return; }
    await appelSW(ctx, ID, async (a) => { await authLogin(a.e, a.p); }, { e: U.email, p: MDP });
    // Le jeton entre dans la marge de renouvellement (moins d'une minute).
    await appelSW(ctx, ID, async () => { const x = await loadSession(); await saveSession(Object.assign({}, x, { expires_at: Date.now() + 30000 })); });
    const avantD = ((await sessionExt(ctx, ID)).session || {}).jeton;
    F.st.pannes.push('lent:15000');       // GoTrue fait tourner le jeton, la réponse n'arrive pas à temps (au-delà des 4 s d'aujourd'hui ET des 10 s d'avant)
    const t0 = Date.now();
    await appelSW(ctx, ID, async () => { await authToken(); });
    const dt = Date.now() - t0;
    const e = await sessionExt(ctx, ID);
    const sid = e.session && e.session.sid;
    const actif = sid ? F.actif(sid) : null;
    const panne = F.st.journal.some((j) => /réponse retardée/.test(j.action || ''));
    dit(panne && !!actif && e.session.jeton === actif.token && e.session.jeton !== avantD, 'D : la réponse n’est pas arrivée à temps APRÈS la rotation, et le jeton ACTIF est quand même rangé (GoTrue le rend au parent qui n’a pas pu ranger sa réponse)', JSON.stringify({ panne, avant: avantD, range: e.session && e.session.jeton, actif: actif && actif.token }));
    dit(!(e.renouv && e.renouv.prochainAt) && dt < 9000, 'D : en quelques secondes, SANS pause de 30 s', `${dt} ms · ${JSON.stringify(e.renouv)}`);
    dit(!(F.st.sessions.get(sid) || {}).revoquee, 'D : la famille reste vivante', JSON.stringify(F.st.sessions.get(sid)));
  });

  // ══ E. LA SESSION DE L'EXTENSION MEURT : L'APP LA RÉPARE ══════════════════
  await cas('E · la session de l’extension meurt, l’app ouverte la répare', async (F, ouvrir) => {
    const app = sessionApp(F);
    const ctx = await ouvrir([EXT], 'E');
    const postes = []; await espionnerPage(ctx, postes); await poserSessionApp(ctx, app.s);
    if (!(await sw(ctx, ID))) { dit(false, 'E : le service worker démarre'); return; }
    await appelSW(ctx, ID, async (a) => { await authLogin(a.e, a.p); }, { e: U.email, p: MDP });
    const avant = await sessionExt(ctx, ID);
    const pg = await ctx.newPage();
    await pg.goto('https://vrm.center/?tab=cat_ventes', { waitUntil: 'domcontentloaded' }).catch(() => {});
    // On attend que l'app ait fait son battement (elle a lu l'état) — juste après,
    // le suivant est dans 20 s : c'est ce délai que l'ancienne app faisait payer.
    await attendreQue(async () => postes.some((p) => p.type === 'etat'), 15000);
    await attendre(1500);
    const n0 = postes.filter((p) => p.type === 'etat').length;
    await attendreQue(async () => postes.filter((p) => p.type === 'etat').length > n0, 25000);
    F.revoquer(avant.session.sid);                 // la famille de l'extension tombe (réutilisation, déconnexion…)
    await appelSW(ctx, ID, async () => { const x = await loadSession(); await saveSession(Object.assign({}, x, { expires_at: Date.now() - 1000 })); });
    const t0 = Date.now();
    await appelSW(ctx, ID, async () => { await authToken(); });
    const morte = await sessionExt(ctx, ID);
    dit(!!morte.session && morte.session.mort, 'E : refus définitif — la session de l’extension est morte (comme en production)', JSON.stringify(morte.session));
    const r = await attendreQue(async () => { const e = await sessionExt(ctx, ID); return e && e.session && !e.session.mort && e.session.sid !== avant.session.sid ? e : null; }, 12000);
    dit(!!r.v && Date.now() - t0 < 7000, 'E : l’app ouverte la reconnecte en quelques secondes (avant : au battement suivant, jusqu’à 20 s)', r.v ? `${Date.now() - t0} ms · ${r.v.session.sid}` : `pas reconnectée en ${r.ms} ms`);
    dit(!r.v || r.v.session.sid !== app.sid, 'E : avec une session à elle, jamais celle de l’app', JSON.stringify(r.v && r.v.session.sid));
    dit(postes.filter((p) => p.type === 'session').length === 0, 'E : aucune session postée dans la page', JSON.stringify(postes.filter((p) => p.type === 'session')));
  });

  // ══ F. UNE EXTENSION ANCIENNE (5.164) SEULE ════════════════════════════════
  // ⚠️⚠️ RELECTURE CROISÉE DE LA 5.174 (12 octobre) : ce cas exigeait l'inverse
  //    (« l'app ne poste AUCUNE session dans la page »). Or Julien NE PEUT PAS
  //    mettre à jour ses extensions — et la production 2fed734 reconnectait une
  //    5.164 sans session, morte, ou sur un autre compte VRM, en un battement.
  //    L'intégration la laissait en « Lecture seule » pour de bon (mesuré, vrai
  //    bridge.js). Ce qui reste interdit, et vérifié : la session de l'APP (même
  //    famille de jetons → révoquée), et tout envoi quand deux copies répondent.
  const V164 = extensionDe('cdc9c1d', 'v5164');
  const sansPagePrete = async (pg) => { for (let i = 0; i < 40; i++) { const c = await pg.evaluate(() => { const b = document.querySelector('[data-etat-actions]'); return b ? b.getAttribute('data-etat-code') : null; }).catch(() => null); if (c && c !== 'verif') return c; await attendre(250); } return null; };
  const casAncienne = async (F, ouvrir, lettre, preparer) => {
    if (!V164) { dit(false, `${lettre} : la 5.164 ne peut pas être reconstituée (dépôt git introuvable)`); return null; }
    const app = sessionApp(F);
    const ID164 = extId(V164);
    const ctx = await ouvrir([V164], lettre);
    const postes = []; await espionnerPage(ctx, postes); await poserSessionApp(ctx, app.s, { separee: false });
    if (!(await sw(ctx, ID164))) { dit(false, `${lettre} : le service worker de la 5.164 démarre`); return null; }
    const avant = preparer ? await preparer(ctx, ID164) : null;
    const pg = await ctx.newPage();
    await pg.goto('https://vrm.center/?tab=cat_ventes', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await pg.bringToFront().catch(() => {});
    const r = await attendreQue(async () => { const e = await sessionExt(ctx, ID164); return e && e.session && !e.session.mort && (!avant || e.session.sid !== avant) ? e : null; }, 20000);
    const sess = postes.filter((p) => p.type === 'session' && !p.nul);
    return { app, ctx, pg, postes, sess, r, ID164 };
  };
  const verdictsAncienne = async (F, lettre, x) => {
    const { app, pg, sess, r } = x;
    dit(!!r.v && /session-extension/.test(r.v.session.sid), `${lettre} : la 5.164 est CONNECTÉE par l’app, avec une session fabriquée POUR ELLE par le serveur`, r.v ? `${r.v.session.sid} en ${r.ms} ms` : `pas connectée après ${r.ms} ms`);
    dit(!!r.v && r.v.session.sid !== app.sid, `${lettre} : une AUTRE famille que l’app (elles ne se marchent pas dessus)`, `app ${app.sid} · ext ${r.v && r.v.session.sid}`);
    dit(sess.length === 1, `${lettre} : UNE session postée (l’ancien message de la page — la seule voie qu’elle entend)`, JSON.stringify(sess));
    dit(!sess.some((p) => p.jeton === app.s.refresh_token), `${lettre} : et JAMAIS le jeton de renouvellement de l’app`, JSON.stringify(sess));
    dit(F.st.fourches === 1, `${lettre} : une seule session fabriquée`, String(F.st.fourches));
    const vrmSess = [...F.st.sessions.values()].filter((s) => s.sources.has('ext') && s.sid === app.sid);
    dit(vrmSess.length === 0, `${lettre} : la famille de l’app n’est jamais utilisée par une extension`, JSON.stringify(vrmSess.map((s) => s.sid)));
    await attendre(1500);
    const code = await sansPagePrete(pg);
    dit(code && code !== 'vrm' && code !== 'autre-vrm', `${lettre} : l’en-tête ne dit plus « Lecture seule · pas connectée »`, String(code));
  };
  await cas('F · une extension 5.164 seule, sans session, l’app connectée', async (F, ouvrir) => {
    const x = await casAncienne(F, ouvrir, 'F'); if (!x) return;
    await verdictsAncienne(F, 'F', x);
  });
  await cas('F2 · une extension 5.164 dont la session est MORTE', async (F, ouvrir) => {
    const x = await casAncienne(F, ouvrir, 'F2', async (ctx, id) => {
      await appelSW(ctx, id, async (a) => { await authLogin(a.e, a.p); }, { e: U.email, p: MDP });
      const av = await sessionExt(ctx, id);
      F.revoquer(av.session.sid);
      await appelSW(ctx, id, async () => { const s = await loadSession(); await saveSession(Object.assign({}, s, { expires_at: Date.now() - 1000 })); await authToken(); });
      const m = await sessionExt(ctx, id);
      dit(!!m.session && m.session.mort, 'F2 : reproduit — refus définitif, sa session est morte', JSON.stringify(m.session));
      return av.session.sid;
    }); if (!x) return;
    await verdictsAncienne(F, 'F2', x);
  });
  await cas('F3 · une extension 5.164 connectée au compte VRM d’un AUTRE', async (F, ouvrir) => {
    const U2 = { id: 'bbbbbbbb-0000-4000-8000-000000000002', email: 'compte-essai@exemple.test' };
    const x = await casAncienne(F, ouvrir, 'F3', async (ctx, id) => {
      const s2 = F.nouvelleSession('ext-autre-compte', U2);
      await appelSW(ctx, id, async (a) => { await saveSession(a); }, { access_token: s2.access_token, refresh_token: s2.refresh_token, expires_at: Date.now() + 3600e3, user_id: U2.id, email: U2.email });
      return lireJwt(s2.access_token).session_id;
    }); if (!x) return;
    await verdictsAncienne(F, 'F3', x);
    const g = await appelSW(x.ctx, x.ID164, async () => (await chrome.storage.local.get('vrmBascule')).vrmBascule || null);
    dit(g && /compte-essai/.test(g.de || '') && /vendeur@/.test(g.vers || ''), 'F3 : et l’extension note la bascule (son petit écran la dit)', JSON.stringify(g));
  });
  // Deux copies : deux anciennes (5.164 + 5.170 de production — la page les
  // atteindrait TOUTES LES DEUX), et une ancienne à côté de la neuve.
  const V170 = extensionDe('2fed734', 'v5170');
  for (const [lettre, nom, dirs] of [['F4', '5.164 + 5.170', () => [V164, V170]], ['F5', '5.164 + la neuve', () => [V164, EXT]]]) {
    await cas(`${lettre} · deux copies (${nom}) : rien ne part`, async (F, ouvrir) => {
      if (!V164 || !V170) { dit(false, `${lettre} : les anciennes ne peuvent pas être reconstituées`); return; }
      const app = sessionApp(F);
      const l = dirs(), ids = l.map((d) => extId(d));
      const ctx = await ouvrir(l, lettre);
      const postes = []; await espionnerPage(ctx, postes); await poserSessionApp(ctx, app.s, { separee: false });
      for (const id of ids) if (!(await sw(ctx, id))) { dit(false, `${lettre} : les deux services workers démarrent`); return; }
      const pg = await ctx.newPage();
      await pg.goto('https://vrm.center/?tab=cat_ventes', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await pg.bringToFront().catch(() => {});
      await attendre(10000);
      const code = await sansPagePrete(pg);
      dit(code === 'plusieurs', `${lettre} : l’app voit deux extensions`, String(code));
      dit(postes.filter((p) => p.type === 'session' && !p.nul).length === 0, `${lettre} : AUCUNE session postée dans la page (les deux l’adopteraient : même famille, révoquée)`, JSON.stringify(postes.filter((p) => p.type === 'session')));
      const es = []; for (const id of ids) es.push((await sessionExt(ctx, id)).session);
      dit(es.every((x) => !x) && F.st.fourches === 0, `${lettre} : ni l’une ni l’autre ne reçoit de session, aucune fabriquée pour rien`, JSON.stringify({ sessions: es, fourches: F.st.fourches }));
    });
  }

  // ══ G. CODE PÉRIMÉ : DOSSIER REMPLACÉ, ⟳ JAMAIS CLIQUÉ ═════════════════════
  //    Comme chez lui : installée UNE fois (« Charger l'extension non empaquetée »),
  //    puis le dossier remplacé sans ⟳ — Chrome relancé garde l'ANCIEN service
  //    worker sous le manifeste neuf.
  await cas('G · code périmé (dossier remplacé, ⟳ jamais cliqué)', async (F) => {
    if (!V164) { dit(false, 'G : la 5.164 ne peut pas être reconstituée'); return; }
    const app = sessionApp(F);
    const dir = copier(V164, 'perime-' + Date.now());
    const udd = path.join(TMP, 'profil-G-' + Date.now());
    let ctx = await lancer(udd, []);
    const br = ctx.browser();
    const bcdp = br ? await br.newBrowserCDPSession() : await ctx.newCDPSession(await ctx.newPage());
    const r = await bcdp.send('Extensions.loadUnpacked', { path: dir }).catch((e) => ({ err: e.message }));
    if (!r || !r.id) { dit(false, 'G : installation non empaquetée (CDP)', JSON.stringify(r)); await ctx.close(); return; }
    await attendre(2500);
    await ctx.close();
    remplacer(dir, EXT_SRC);                                          // le zip dézippé PAR-DESSUS, sans ⟳
    ctx = await lancer(udd, []);
    try {
      const postes = []; await espionnerPage(ctx, postes); await poserSessionApp(ctx, app.s);
      await attendre(2500);
      const avant = await appelSW(ctx, r.id, () => ({ manif: chrome.runtime.getManifest().version, neuf: typeof demanderLiaison === 'function' }));
      dit(avant && avant.manif === MANIF && avant.neuf === false, 'G : reproduit — le manifeste dit ' + MANIF + ' mais le service worker exécute l’ANCIEN code', JSON.stringify(avant));
      const pg = await ctx.newPage();
      await pg.goto('https://vrm.center/?tab=cat_ventes', { waitUntil: 'domcontentloaded' }).catch(() => {});
      const rep = await attendreQue(async () => { const x = await appelSW(ctx, r.id, () => ({ neuf: typeof demanderLiaison === 'function' })); return x && x.neuf ? x : null; }, 30000, 500);
      dit(!!rep.v, 'G : le code est RÉPARÉ tout seul (le pont l’a repéré, la page de réparation a fait ⟳)', rep.v ? `${rep.ms} ms` : `toujours l’ancien code après ${rep.ms} ms`);
      // ⚠️ Revue du 11 octobre : SANS recharger la page, l'app disait encore
      //    « périmé — clique ⟳ » ~20 s après la réparation (commandes coupées),
      //    jusqu'au battement suivant. Le pont remis à neuf annonce « ready » :
      //    elle doit relire tout de suite.
      if (rep.v) {
        const sans = await attendreQue(async () => { const c = await pg.evaluate(() => { const b = document.querySelector('[data-etat-actions]'); return b ? b.getAttribute('data-etat-code') : null; }).catch(() => null); return c && c !== 'perime' ? c : null; }, 15000, 250);
        dit(!!sans.v && sans.ms < 6000, 'G : sans recharger la page, l’app ne le dit plus périmé en quelques secondes (avant : ~20 s)', sans.v ? `${sans.v} après ${sans.ms} ms` : `toujours « périmé » après ${sans.ms} ms`);
      }
      await pg.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await attendre(4000);
      const code = await pg.evaluate(() => { const b = document.querySelector('[data-etat-actions]'); return b ? b.getAttribute('data-etat-code') : null; }).catch(() => null);
      dit(!!rep.v && code !== 'perime' && code !== 'muette', 'G : et l’app ne le dit plus périmé', String(code));
    } finally { await ctx.close().catch(() => {}); }
  });

  // ══ P. CODE PÉRIMÉ : « SE CONNECTER AVEC VRM » DANS LA FENÊTRE DE L'ICÔNE ═══
  //    Revue du 11 octobre, mesuré : l'ancien service worker ne connaît pas
  //    `lierAvecVRM` — le port se fermait, la fenêtre se fermait, RIEN ne se
  //    passait (aucun onglet VRM, code toujours ancien). C'est l'état de 5 de
  //    ses 6 Chrome.
  await cas('P · code périmé : « Se connecter avec VRM » dans la fenêtre de l’icône', async (F) => {
    if (!V164) { dit(false, 'P : la 5.164 ne peut pas être reconstituée'); return; }
    const app = sessionApp(F);
    const dir = copier(V164, 'perime-P-' + Date.now());
    const udd = path.join(TMP, 'profil-P-' + Date.now());
    let ctx = await lancer(udd, []);
    const br = ctx.browser();
    const bcdp = br ? await br.newBrowserCDPSession() : await ctx.newCDPSession(await ctx.newPage());
    const r = await bcdp.send('Extensions.loadUnpacked', { path: dir }).catch((e) => ({ err: e.message }));
    if (!r || !r.id) { dit(false, 'P : installation non empaquetée (CDP)', JSON.stringify(r)); await ctx.close(); return; }
    await attendre(2500);
    await ctx.close();
    remplacer(dir, EXT_SRC);
    ctx = await lancer(udd, []);
    try {
      await poserSessionApp(ctx, app.s);
      await attendre(2000);
      const avant = await appelSW(ctx, r.id, () => ({ manif: chrome.runtime.getManifest().version, neuf: typeof demanderLiaison === 'function' }));
      dit(avant && avant.neuf === false, 'P : reproduit — manifeste ' + MANIF + ', ancien service worker', JSON.stringify(avant));
      const pop = await ctx.newPage();
      await pop.goto(`chrome-extension://${r.id}/popup.html`); await attendre(1200);
      const bouton = await pop.$('#lierBtn');
      dit(!!bouton, 'P : la fenêtre (lue depuis le disque) propose « Se connecter avec VRM »');
      if (bouton) await bouton.click().catch(() => {});
      const vrm = await pageVRM(ctx);
      dit(!!vrm, 'P : le clic OUVRE VRM quand même (l’ancien code ne connaît pas ce message)', vrm ? vrm.url() : JSON.stringify(ctx.pages().map((x) => x.url())));
      const rep = await attendreQue(async () => { const x = await appelSW(ctx, r.id, () => ({ neuf: typeof demanderLiaison === 'function' })); return x && x.neuf ? x : null; }, 20000, 500);
      dit(!!rep.v, 'P : et le code est réparé (⟳ fait par la fenêtre)', rep.v ? `${rep.ms} ms` : `ancien code après ${rep.ms} ms`);
      const co = await attendreQue(async () => { const e = await sessionExt(ctx, r.id); return e && e.session && !e.session.mort ? e : null; }, 30000, 500);
      dit(!!co.v && co.v.session.sid !== app.sid, 'P : au bout du compte, l’extension est CONNECTÉE (sa propre session), sans rien taper', co.v ? `${co.v.session.sid} en ${co.ms} ms` : `pas connectée après ${co.ms} ms`);
    } finally { await ctx.close().catch(() => {}); }
  });

  // ══ S. « SE DÉCONNECTER » DE VRM, UNE EXTENSION 5.164 CONNECTÉE ICI ═══════
  //    Revue du 11 octobre : elle n'entend pas le canal adressé, et l'app ne
  //    lui postait plus rien — elle continuait d'écrire sous ce compte après
  //    « Se déconnecter » (la modale promet le contraire).
  await cas('S · « Se déconnecter » de VRM, extension 5.164 connectée sous ce compte', async (F, ouvrir) => {
    if (!V164) { dit(false, 'S : la 5.164 ne peut pas être reconstituée'); return; }
    const app = sessionApp(F);
    const ID164 = extId(V164);
    const ctx = await ouvrir([V164], 'S');
    await poserSessionApp(ctx, app.s);
    if (!(await sw(ctx, ID164))) { dit(false, 'S : le service worker de la 5.164 démarre'); return; }
    const co = await appelSW(ctx, ID164, async (a) => { const r = await authLogin(a.e, a.p); return r && r.ok; }, { e: U.email, p: MDP });
    const avant = await sessionExt(ctx, ID164);
    dit(co === true && avant.session, 'S : la 5.164 est connectée sous ce compte', JSON.stringify(avant.session && avant.session.sid));
    const pg = await ctx.newPage();
    await pg.goto('https://vrm.center/?tab=settings&vue=compte', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await attendre(5000);
    await pg.getByText('Se déconnecter', { exact: true }).first().click().catch(() => {});
    await attendre(500);
    let valide = false;
    for (const x of await pg.$$('button')) { const t = ((await x.innerText().catch(() => '')) || '').trim(); const st = (await x.getAttribute('style').catch(() => '')) || ''; if (t === 'Se déconnecter' && /flex: 2/.test(st)) { await x.click().catch(() => {}); valide = true; break; } }
    const r = await attendreQue(async () => { const e = await sessionExt(ctx, ID164); return e && !e.session ? e : null; }, 8000, 300);
    dit(valide && !!r.v, 'S : « Se déconnecter » de VRM lui fait OUBLIER sa session (l’ancien message, sur ce geste seulement)', JSON.stringify({ valide, apres: (await sessionExt(ctx, ID164)).session }));
    // ⚠️⚠️ Relecture croisée de la 5.174 : il se RECONNECTE à VRM — la production
    //    la retrouvait connectée ; l'intégration la laissait déconnectée pour de
    //    bon (il devait retaper son mot de passe dans CHACUN de ses Chrome).
    const app2 = sessionApp(F);
    await pg.evaluate((s) => { localStorage.setItem('vrm_session', JSON.stringify(s)); }, app2.s).catch(() => {});
    await pg.goto('https://vrm.center/?tab=cat_ventes', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await pg.bringToFront().catch(() => {});
    const re = await attendreQue(async () => { const e = await sessionExt(ctx, ID164); return e && e.session && !e.session.mort ? e : null; }, 20000);
    dit(!!re.v && /session-extension/.test(re.v.session.sid) && re.v.session.sid !== app2.sid, 'S : il se reconnecte à VRM — la 5.164 retrouve une session À ELLE, sans rien taper', re.v ? `${re.v.session.sid} en ${re.ms} ms` : `toujours déconnectée après ${re.ms} ms`);
  });

  // ══ H. CHACUN SA FAMILLE : PERSONNE NE TUE PERSONNE ══════════════════════
  await cas('H · l’app et l’extension renouvellent chacune plusieurs fois', async (F, ouvrir) => {
    const app = sessionApp(F);
    const ctx = await ouvrir([EXT], 'H');
    const postes = []; await espionnerPage(ctx, postes); await poserSessionApp(ctx, app.s, { separee: false });
    if (!(await sw(ctx, ID))) { dit(false, 'H : le service worker démarre'); return; }
    const pg = await ctx.newPage();
    await pg.goto('https://vrm.center/?tab=cat_ventes', { waitUntil: 'domcontentloaded' }).catch(() => {});
    const r = await attendreQue(async () => { const e = await sessionExt(ctx, ID); return e && e.session && !e.session.mort ? e : null; }, 15000);
    dit(!!r.v && r.v.session.sid !== app.sid, 'H : l’extension sans session reçoit la sienne en ouvrant VRM', JSON.stringify(r.v && r.v.session.sid));
    for (let i = 0; i < 3; i++) {
      await appelSW(ctx, ID, async () => { const x = await loadSession(); await saveSession(Object.assign({}, x, { expires_at: Date.now() - 1000 })); await authToken(); });
      await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('vrm_session')); s.expires_at = Date.now() - 1000; localStorage.setItem('vrm_session', JSON.stringify(s)); }).catch(() => {});
      await pg.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await attendre(2500);
    }
    const e = await sessionExt(ctx, ID);
    const ecran = await pg.evaluate(() => !!document.querySelector('input[type="password"]')).catch(() => null);
    const tuees = [...F.st.sessions.values()].filter((s) => s.revoquee);
    dit(!!e.session && !e.session.mort && ecran === false && tuees.length === 0, 'H : après trois renouvellements de chaque côté, les deux sessions vivent (aucune famille révoquée)', JSON.stringify({ ext: e.session, appDeconnectee: ecran, revoquees: tuees.map((s) => s.sid + ' : ' + s.raison) }));
    dit(postes.filter((p) => p.type === 'session').length === 0, 'H : aucune session postée dans la page', JSON.stringify(postes.filter((p) => p.type === 'session')));
  });

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${ko ? '❌' : '✅'} session : ${ok} vert${ok > 1 ? 's' : ''}, ${ko} rouge${ko > 1 ? 's' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ le banc est tombé :', e && e.message); process.exit(1); });
