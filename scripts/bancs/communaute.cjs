// ════════════════════════════════════════════════════════════════════════════
//  BANC « COMMUNAUTÉ » — la carte des revendeurs (migration 018), RENDU,
//  à 1512 px (clair) et 390 px tactile (sombre).
//
//  La base garantit les règles (audit-communaute-sql.cjs, sur un vrai
//  Postgres) ; ce banc vérifie que l'APP les rend, avec DEUX personnes :
//    · opt-in : invisible par défaut, « Apparaître sur la carte » sur son geste,
//      « Me retirer » supprime la ligne ;
//    · zéro inscrit : la carte le dit et invite à être le premier (aucun chiffre
//      inventé) ;
//    · la position rangée est ARRONDIE (0,05°), jamais la valeur exacte ;
//      « me localiser » PROPOSE une ville, on confirme ;
//    · un coucou / un message envoyé arrive chez l'autre (texte brut : aucun
//      lien rendu) ; bloqué ⇒ rien ne passe, il ne le sait pas, il disparaît
//      de la carte de celui qui bloque ; le signalement est rangé ;
//    · base sans la 018 ⇒ « La carte de la communauté n'est pas encore activée
//      sur ta base » ; panne ⇒ « pas pu lire », jamais « personne » ;
//    · aucun email, aucun identifiant de compte, aucun compte Vinted d'autrui
//      dans le DOM ni dans les réponses ;
//    · la carte Leaflet (chargée à l'ouverture de l'écran, depuis cdnjs) se
//      dessine ; injoignable ⇒ la même communauté en liste.
//  Le faux PostgREST applique les RÈGLES de la 018 (§6.3). Le VRAI api/compte.js
//  est exécuté pour `?mode=communaute`. Aucune fixture : tout est inventé ici.
//  BANC_MUTATION=bloque-ecrit | opt-in : le faux réaffaiblit une règle ⇒ ROUGE.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const { execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..', '..');
let chromium;
try { ({ chromium } = require(path.join(RACINE, 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || 5031);
const MUTATION = process.env.BANC_MUTATION || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + String(d).slice(0, 200) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).split('\n')[0].slice(0, 180)); } };

// ── Leaflet (le banc le sert à la place de cdnjs) ────────────────────────────
function dossierLeaflet() {
  const cands = [process.env.BANC_LEAFLET_DIR, path.join(RACINE, 'node_modules', 'leaflet', 'dist'), path.join(os.tmpdir(), 'vrm-leaflet-1.9.4', 'package', 'dist')].filter(Boolean);
  for (const d of cands) if (fs.existsSync(path.join(d, 'leaflet.js'))) return d;
  const dir = path.join(os.tmpdir(), 'vrm-leaflet-1.9.4');
  try { fs.mkdirSync(dir, { recursive: true }); execFileSync('npm', ['pack', 'leaflet@1.9.4'], { cwd: dir, stdio: 'ignore' }); execFileSync('tar', ['xzf', 'leaflet-1.9.4.tgz'], { cwd: dir }); } catch (_) {}
  const d = path.join(dir, 'package', 'dist');
  return fs.existsSync(path.join(d, 'leaflet.js')) ? d : null;
}

// ── Les personnes (inventées) ────────────────────────────────────────────────
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const Bu = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (id, email) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: id, email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.c2ln`;
const USERS = { [A]: { id: A, email: 'alice.secret@exemple.test', login: 'alice_vinted_secret' }, [Bu]: { id: Bu, email: 'bruno.secret@exemple.test', login: 'bruno_vinted_secret' } };
const JETONS = {}; for (const u of Object.values(USERS)) JETONS[jwt(u.id, u.email)] = u;
const jetonDe = (id) => Object.keys(JETONS).find((k) => JETONS[k].id === id);
const session = (id) => ({ access_token: jetonDe(id), refresh_token: 'r-' + id, expires_at: Date.now() + 3600e3, user: { id, email: USERS[id].email } });
const SECRETS = [A, Bu, ...Object.values(USERS).flatMap((u) => [u.email, u.login])];

// ── La base : les RÈGLES de la 018, en JS ────────────────────────────────────
let B;
const reset = ({ installe = true, panne = false } = {}) => { B = { installe, panne, profils: {}, convs: [], msgs: [], blocages: [], signalements: [], journal: [], reponses: [] }; };
const arr = (x) => Math.round(Math.round(Number(x) * 20) / 20 * 100) / 100;
let nId = 1;
const uuid = () => `00000000-0000-4000-8000-${String(nId++).padStart(12, '0')}`;
const bloque = (qui, cible) => B.blocages.some((b) => b.qui === qui && b.bloque === cible);
const autreDe = (c, moi) => (c.a === moi ? c.b : c.a);
function rpc(fn, args, uid) {
  if (fn === 'vrm_communaute_carte') {
    const moi = B.profils[uid];
    const tous = Object.entries(B.profils);
    if (MUTATION === 'opt-in') for (const u of Object.keys(USERS)) if (!B.profils[u]) tous.push([u, { pid: 'p-' + u.slice(0, 4), pseudo: 'Revendeur', ville: 'Cancale', pays: 'FR', lat: 48.7, lon: -1.85, cree_le: '2026-10-20T00:00:00Z' }]);
    const premier = (p) => !tous.some(([, q]) => q.pays === p.pays && q.ville.toLowerCase() === p.ville.toLowerCase() && q.cree_le < p.cree_le);
    return { acces: true, moi: moi ? { pid: moi.pid, pseudo: moi.pseudo, ville: moi.ville, pays: moi.pays, lat: moi.lat, lon: moi.lon, depuis: moi.cree_le } : null,
      profils: tous.filter(([o]) => !bloque(uid, o)).map(([o, p]) => ({ pid: p.pid, pseudo: p.pseudo, ville: p.ville, pays: p.pays, lat: p.lat, lon: p.lon, moi: o === uid, premier: premier(p) })) };
  }
  if (fn === 'vrm_communaute_rejoindre') {
    const ps = String(args.p_pseudo || '').trim() || 'Revendeur', vi = String(args.p_ville || '').trim();
    if (ps.length > 30 || /[@<>]/.test(ps)) return { ok: false, raison: 'pseudo' };
    if (!vi) return { ok: false, raison: 'ville' };
    const anc = B.profils[uid];
    B.profils[uid] = { pid: anc ? anc.pid : uuid(), pseudo: ps, ville: vi, pays: String(args.p_pays || 'FR').toUpperCase(), lat: arr(args.p_lat), lon: arr(args.p_lon), cree_le: anc ? anc.cree_le : new Date(Date.now() + nId).toISOString() };
    return { ok: true, pid: B.profils[uid].pid };
  }
  if (fn === 'vrm_communaute_quitter') { const f = !!B.profils[uid]; delete B.profils[uid]; return f; }
  if (fn === 'vrm_communaute_ecrire') {
    const t = String(args.p_texte || '').trim();
    if (!t || t.length > 500) return { ok: false, raison: 'texte' };
    if (!B.profils[uid]) return { ok: false, raison: 'invisible' };
    const autre = Object.keys(B.profils).find((o) => B.profils[o].pid === args.p_pid);
    if (!autre) return { ok: false, raison: 'introuvable' };
    if (autre === uid) return { ok: false, raison: 'soi' };
    if (bloque(uid, autre)) return { ok: false, raison: 'tu-as-bloque' };
    let c = B.convs.find((x) => (x.a === uid && x.b === autre) || (x.a === autre && x.b === uid));
    if (!c) { c = { id: uuid(), a: uid, b: autre }; B.convs.push(c); }
    B.msgs.push({ id: nId++, conv: c.id, de: uid, texte: t, le: new Date().toISOString(), lu: false, masque: MUTATION === 'bloque-ecrit' ? false : bloque(autre, uid) });
    return { ok: true, conv: c.id };
  }
  const vus = (c) => B.msgs.filter((m) => m.conv === c.id && (m.de === uid || !m.masque));
  const pub = (o) => { const p = B.profils[o]; return p ? { pid: p.pid, pseudo: p.pseudo, ville: p.ville } : null; };
  if (fn === 'vrm_communaute_conversations') {
    return B.convs.filter((c) => c.a === uid || c.b === uid).map((c) => {
      const v = vus(c); if (!v.length) return null; const d = v[v.length - 1]; const o = autreDe(c, uid); const p = pub(o);
      return { conv: c.id, pid: p && p.pid, pseudo: p && p.pseudo, ville: p && p.ville, bloque: bloque(uid, o), dernier: d.texte, deMoi: d.de === uid, quand: d.le, nonLus: v.filter((m) => m.de !== uid && !m.lu).length };
    }).filter(Boolean);
  }
  const conv = B.convs.find((c) => c.id === args.p_conv && (c.a === uid || c.b === uid));
  if (fn === 'vrm_communaute_fil') {
    if (!conv) return null;
    for (const m of B.msgs) if (m.conv === conv.id && m.de !== uid && !m.masque) m.lu = true;
    const o = autreDe(conv, uid);
    return { conv: conv.id, autre: pub(o), bloque: bloque(uid, o), messages: vus(conv).map((m) => ({ id: m.id, moi: m.de === uid, texte: m.texte, le: m.le })) };
  }
  if (fn === 'vrm_communaute_bloquer') {
    if (!conv) return false; const o = autreDe(conv, uid);
    if (args.p_oui !== false) { if (!bloque(uid, o)) B.blocages.push({ qui: uid, bloque: o }); } else B.blocages = B.blocages.filter((b) => !(b.qui === uid && b.bloque === o));
    return true;
  }
  if (fn === 'vrm_communaute_signaler') {
    if (!conv) return false; const o = autreDe(conv, uid);
    B.signalements.push({ par: uid, contre: o, conv: conv.id, raison: String(args.p_raison || ''), extrait: B.msgs.filter((m) => m.conv === conv.id && m.de === o).slice(-5).map((m) => m.texte) });
    return true;
  }
  return undefined;
}

function fauxSupabase(urlBrut, methode, entetes, corps) {
  const u = decodeURIComponent(String(urlBrut));
  const h = {}; for (const [k, v] of Object.entries(entetes || {})) h[k.toLowerCase()] = v;
  const tok = String(h.authorization || '').replace(/^Bearer\s+/i, '');
  const qui = JETONS[tok];
  const uid = qui ? qui.id : null;
  const json = (b, status = 200, hh = {}) => ({ status, body: b === undefined ? '' : JSON.stringify(b), headers: { 'content-type': 'application/json', ...hh } });
  const [chemin] = u.split('?');
  if (/\/auth\/v1\/user/.test(chemin)) return qui ? json({ id: qui.id, email: qui.email, email_confirmed_at: '2026-10-01T00:00:00Z' }) : json({ msg: 'invalid' }, 401);
  if (/\/auth\/v1\//.test(chemin)) return json(qui ? { access_token: tok, refresh_token: 'r', expires_in: 3600, user: { id: qui.id, email: qui.email } } : {});
  const rest = /\/rest\/v1\/(.+)$/.exec(chemin);
  if (!rest) return json({}, 404);
  const cible = rest[1];
  B.journal.push({ u, depuis: corps && corps.__node ? 'serveur' : 'navigateur' });
  if (cible.startsWith('rpc/')) {
    const fn = cible.slice(4);
    if (fn === 'vrm_acces') return json({ obligatoire: false, proprietaire: false, acces: true });
    if (/^vrm_communaute_/.test(fn)) {
      if (!B.installe) return json({ code: 'PGRST202', message: `Could not find the function public.${fn}` }, 404);
      if (B.panne) return { status: 522, body: '<html>522 Connection timed out</html>', headers: { 'content-type': 'text/html' } };
      if (!uid) return json({ message: 'permission denied' }, 401);
      const args = (corps && corps.json) || {};
      const r = rpc(fn, args, uid);
      if (r === undefined) return json({ code: 'PGRST202' }, 404);
      return json(r);
    }
    return json({ code: 'PGRST202' }, 404);
  }
  if (cible.startsWith('vinted_accounts')) return json(uid ? [{ vinted_user_id: '1' + uid.slice(0, 3), login: USERS[uid].login, owner: uid }] : []);
  return json([], 200, { 'content-range': '0-0/0' });
}

const VILLES = {
  cancale: [{ lat: '48.676543', lon: '-1.851612', name: 'Cancale', address: { town: 'Cancale', county: 'Ille-et-Vilaine', state: 'Bretagne', country_code: 'fr' } }],
};
const fetchReel = global.fetch;
global.fetch = async (url, opts = {}) => {
  const s = String(url);
  if (/supabase\.co\//.test(s)) {
    const r = fauxSupabase(s, opts.method || 'GET', opts.headers || {}, { json: (() => { try { return JSON.parse(opts.body || '{}'); } catch (_) { return {}; } })(), __node: true });
    return new Response(r.body === '' ? null : r.body, { status: r.status, headers: r.headers });
  }
  if (/nominatim\.openstreetmap\.org\/search/.test(s)) { const q = new URL(s).searchParams.get('q').toLowerCase(); return new Response(JSON.stringify(VILLES[q] || []), { status: 200 }); }
  if (/nominatim\.openstreetmap\.org\/reverse/.test(s)) return new Response(JSON.stringify(VILLES.cancale[0]), { status: 200 });
  if (/api\.stripe\.com/.test(s)) return new Response('{}', { status: 404 });
  return fetchReel(url, opts);
};

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

let compte = null, LEAFLET = null;
async function ouvrir(nav, { qui, largeur = 1512, sombre = false, sansLeaflet = false }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, permissions: ['geolocation'], geolocation: { latitude: 48.6781234, longitude: -1.8523456 } });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(({ s, sombre }) => {
    try { localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); } catch (_) {}
    try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {}
  }, { s: session(qui), sombre });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, async (r) => {
    const rq = r.request(), u = rq.url();
    if (/supabase\.co\//.test(u)) {
      const x = fauxSupabase(u, rq.method(), rq.headers(), { json: (() => { try { return JSON.parse(rq.postData() || '{}'); } catch (_) { return {}; } })() });
      return r.fulfill({ status: x.status, headers: x.headers, body: x.body });
    }
    if (/cdnjs\.cloudflare\.com\/ajax\/libs\/leaflet\/1\.9\.4\//.test(u)) {
      if (sansLeaflet || !LEAFLET) return r.abort();
      const f = u.endsWith('.css') ? 'leaflet.css' : 'leaflet.js';
      return r.fulfill({ status: 200, contentType: f.endsWith('.css') ? 'text/css' : 'text/javascript', body: fs.readFileSync(path.join(LEAFLET, f)) });
    }
    return ['image', 'media', 'font'].includes(rq.resourceType()) ? r.abort() : r.fulfill({ status: 404, body: '' });
  });
  await pg.route('**/api/**', async (r) => {
    const rq = r.request(), u = new URL(rq.url());
    const mode = u.searchParams.get('mode');
    if (u.pathname === '/api/compte' && (mode === 'communaute' || mode === 'abonnement')) {
      let corps = null; try { corps = rq.postData() ? JSON.parse(rq.postData()) : null; } catch (_) {}
      const res = { code: 200, corps: null, setHeader() {}, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, end() { return this; } };
      const lecteur = corps ? (async function* () { yield Buffer.from(JSON.stringify(corps)); })() : null;
      const req = { method: rq.method(), query: Object.fromEntries(u.searchParams), headers: rq.headers(), body: corps || undefined, [Symbol.asyncIterator]() { return lecteur ? lecteur[Symbol.asyncIterator]() : (async function* () {})(); } };
      await compte(req, res);
      const body = JSON.stringify(res.corps);
      if (mode === 'communaute') B.reponses.push({ qui, body });
      return r.fulfill({ status: res.code, contentType: 'application/json', body });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=communaute`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const e = document.querySelector('[data-communaute-etat]'); return e && e.getAttribute('data-communaute-etat') !== 'charge'; }, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(800);
  return { ctx, pg, erreurs };
}
const etatDe = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-communaute-etat]'); return e ? e.getAttribute('data-communaute-etat') : null; });
const attr = (pg, sel, a) => pg.evaluate(([s, x]) => { const e = document.querySelector(s); return e ? e.getAttribute(x) : null; }, [sel, a]);
const texte = (pg) => pg.evaluate(() => document.body.innerText);
const sansSecret = (s) => SECRETS.filter((x) => s.includes(x));

async function rejoindreParNom(pg, ville) {
  await pg.click('[data-cm-apparaitre]');
  await pg.fill('[data-cm-ville-q]', ville);
  await pg.click('[data-cm-chercher]');
  await pg.waitForSelector(`[data-cm-ville-choix]`, { timeout: 8000 });
  await pg.click(`[data-cm-ville-choix]`);
  await pg.click('[data-cm-valider]');
  await pg.waitForSelector('[data-cm-moi="visible"]', { timeout: 8000 });
}

(async () => {
  LEAFLET = dossierLeaflet();
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { console.log('❌ api/compte.js ne se charge pas : ' + e.message); process.exit(1); }
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  if (MUTATION) console.log(`(mutation « ${MUTATION} »)`);
  if (!LEAFLET) console.log('⚠️  Leaflet introuvable (BANC_LEAFLET_DIR) : la carte ne peut pas se dessiner au banc.');
  try {
    reset();
    console.log('\n── 1512 px · Alice, zéro inscrit');
    let A1;
    await essaie('zéro inscrit', async () => {
      A1 = await ouvrir(nav, { qui: A });
      const { pg } = A1;
      dit(await etatDe(pg) === 'lu', 'l’écran Communauté s’ouvre par ?tab=communaute (état « lu »)', await etatDe(pg));
      dit(await attr(pg, '[data-cm-moi]', 'data-cm-moi') === 'invisible', 'opt-in : Alice est INVISIBLE par défaut');
      dit(!!(await pg.$('[data-cm-vide]')) && /Personne n’est encore sur la carte/.test(await texte(pg)), 'zéro inscrit : la carte le dit et invite à être le premier');
      dit(!(await pg.$('[data-cm-chiffre]')), 'aucun chiffre affiché quand il n’y a personne');
      await pg.waitForSelector('[data-cm-carte="prete"]', { timeout: 15000 }).catch(() => {});
      dit(await attr(pg, '[data-cm-carte]', 'data-cm-carte') === 'prete', 'la carte (Leaflet) se dessine, chargée à l’ouverture de l’écran');
      dit(/OpenStreetMap/.test(await texte(pg)), 'l’attribution OpenStreetMap est affichée');
      dit((await pg.$$('[data-cm-pin]')).length === 0, 'aucune épingle sur une carte vide (aucun faux utilisateur)');
    });

    console.log('\n── 1512 px · Alice apparaît sur la carte (sa ville, arrondie)');
    await essaie('rejoindre', async () => {
      const { pg } = A1;
      await rejoindreParNom(pg, 'Cancale');
      const p = B.profils[A];
      dit(p && p.lat === 48.7 && p.lon === -1.85, 'la position RANGÉE est arrondie à 0,05° (48,70 / −1,85), jamais 48,676543 / −1,851612', JSON.stringify(p));
      const t = await texte(pg);
      dit(/Tu es sur la carte à Cancale/.test(t), 'l’écran dit où on la voit');
      dit(/Personne d’autre que toi sur la carte/.test(t), 'seule sur la carte : elle le lit (aucun faux utilisateur)');
      dit(!B.reponses.some((x) => /48\.676|1\.8516/.test(x.body)), 'aucune réponse ne porte la position exacte');
      await pg.waitForSelector('[data-cm-pin]', { timeout: 8000 }).catch(() => {});
      const pins = await pg.$$eval('[data-cm-pin]', (e) => e.map((x) => x.className));
      dit(pins.length === 1 && /moi/.test(pins[0]), 'une épingle : la sienne', JSON.stringify(pins));
      if (process.env.BANC_DEBUG) await pg.screenshot({ path: process.env.BANC_DEBUG + '/a1512.png', fullPage: true });
      await A1.ctx.close();
    });

    console.log('\n── 390 px tactile, sombre · Bruno');
    let B1;
    await essaie('bruno voit, n’est pas vu', async () => {
      B1 = await ouvrir(nav, { qui: Bu, largeur: 390, sombre: true });
      const { pg } = B1;
      dit(await attr(pg, '[data-cm-moi]', 'data-cm-moi') === 'invisible', 'Bruno est invisible tant qu’il n’a pas choisi sa ville');
      const n = await pg.evaluate(() => [...document.querySelectorAll('[data-cm-chiffre="total"] b')].map((e) => e.textContent).join(''));
      dit(n === '1', 'il voit 1 revendeur sur la carte (Alice), pas lui-même', n);
      const m = await pg.evaluate(() => {
        const lum = (c) => { const v = (c.match(/[\d.]+/g) || []).map(Number); if (v.length === 4 && v[3] === 0) return null; const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]); };
        const e = document.querySelector('.vrm-communaute'); const c = e && e.querySelector('.vrm-cm-carton');
        return { sombre: e && e.getAttribute('data-dark'), carton: c ? lum(getComputedStyle(c).backgroundColor) : null };
      });
      dit(m.sombre === 'true' && m.carton != null && m.carton < 0.05, 'mode sombre : les cartes sont sombres', JSON.stringify(m));
      const largeur = await pg.evaluate(() => document.documentElement.scrollWidth);
      dit(largeur <= 390, 'aucun débordement horizontal à 390 px', String(largeur));
      await pg.waitForSelector('[data-cm-pin]', { timeout: 15000 });
      if (process.env.BANC_DEBUG) { console.log(await pg.evaluate(() => { const b = document.querySelector('[data-cm-pin]').getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return JSON.stringify(b) + ' ' + (e && e.outerHTML.slice(0, 200)); })); await pg.screenshot({ path: process.env.BANC_DEBUG + '/b390.png', fullPage: true }); }
      await pg.click('[data-cm-pin]');
      await pg.waitForSelector('[data-cm-personnes]', { timeout: 8000 });
      dit(/Mets-toi sur la carte pour lui écrire/.test(await texte(pg)) && !(await pg.$('[data-cm-ecrire]')), 'invisible, il ne peut écrire à personne (et l’écran le dit)');
      await pg.click('.vrm-cm-x');
    });
    await essaie('me localiser', async () => {
      const { pg } = B1;
      await pg.click('[data-cm-apparaitre]');
      await pg.fill('[data-cm-pseudo]', 'Bruno');
      await pg.click('[data-cm-localiser]');
      await pg.waitForSelector('[data-cm-ville-choix="Cancale"][aria-selected="true"]', { timeout: 8000 });
      dit(!B.profils[Bu], '« me localiser » PROPOSE la ville — rien n’est enregistré avant sa confirmation');
      await pg.click('[data-cm-valider]');
      await pg.waitForSelector('[data-cm-moi="visible"]', { timeout: 8000 });
      dit(B.profils[Bu] && B.profils[Bu].lat === 48.7 && B.profils[Bu].lon === -1.85, 'la ville confirmée est rangée arrondie, pas la position du téléphone (48,678 / −1,852)', JSON.stringify(B.profils[Bu]));
      const t = await texte(pg);
      dit(/1\s*autre à Cancale/.test(t.replace(/\n/g, ' ')), '« 1 autre à Cancale » (un chiffre lu, pas inventé)', (t.match(/\d+\s*autres? à \w+/) || [''])[0]);
    });
    await essaie('coucou', async () => {
      const { pg } = B1;
      await pg.waitForSelector('[data-cm-pin]');
      await pg.click('[data-cm-pin]');
      await pg.waitForSelector('[data-cm-personnes]', { timeout: 8000 });
      if (process.env.BANC_DEBUG) { await pg.waitForTimeout(600); console.log(await pg.evaluate(() => { const f = document.querySelector('[data-cm-personnes]'); const cs = getComputedStyle(f); const r = f.getBoundingClientRect(); const e = document.elementFromPoint(r.x + 20, r.y + r.height - 20); const v = f.closest('.vrm-cm-voile'); return JSON.stringify({ bg: cs.backgroundColor, filtre: cs.filter, op: cs.opacity, r, parent: v.parentElement.parentElement.tagName, voileZ: getComputedStyle(v).zIndex, voileBF: getComputedStyle(v).backdropFilter, dessus: e && e.outerHTML.slice(0, 120) }); })); await pg.screenshot({ path: process.env.BANC_DEBUG + '/personnes390.png' }); }
      dit(!!(await pg.$(`[data-cm-premier]`)), 'Alice porte le badge « premier de Cancale » (la première arrivée)');
      await pg.click('[data-cm-coucou]');
      await pg.waitForSelector('[data-cm-toast]', { timeout: 8000 });
      dit(B.msgs.length === 1 && B.msgs[0].de === Bu && /Coucou/.test(B.msgs[0].texte), 'un coucou en un geste : le message part', JSON.stringify(B.msgs.map((m) => m.texte)));
      const dom = await pg.evaluate(() => document.documentElement.outerHTML);
      dit(sansSecret(dom).length === 0, 'aucun email, identifiant de compte ni compte Vinted d’autrui dans le DOM', sansSecret(dom).join(', '));
      await B1.ctx.close();
    });

    console.log('\n── 1512 px · Alice lit, répond, bloque, signale');
    let A2;
    await essaie('alice reçoit', async () => {
      A2 = await ouvrir(nav, { qui: A });
      const { pg } = A2;
      dit(await attr(pg, '[data-cm-nonlus]', 'data-cm-nonlus') === '1', 'le message arrive : 1 non lu');
      await pg.click('[data-cm-conv]');
      await pg.waitForSelector('[data-cm-bulle="autre"]', { timeout: 8000 });
      dit(/Coucou/.test(await pg.$eval('[data-cm-bulle="autre"]', (e) => e.innerText)), 'elle lit le coucou de Bruno');
      await pg.fill('[data-cm-texte]', 'Salut ! <a href="https://pirate.test">clique</a> https://pirate.test');
      await pg.click('[data-cm-envoyer]');
      await pg.waitForFunction(() => document.querySelectorAll('[data-cm-bulle="moi"]').length === 1, null, { timeout: 8000 });
      if (process.env.BANC_DEBUG) await pg.screenshot({ path: process.env.BANC_DEBUG + '/fil1512.png' });
      dit(!(await pg.$('.vrm-cm-bulles a')), 'aucun lien rendu dans une bulle : le texte est écrit tel quel');
      dit(/<a href=/.test(await pg.$eval('[data-cm-bulle="moi"]', (e) => e.innerText)), 'les chevrons sont affichés comme du texte');
      pg.once('dialog', (d) => d.accept());
      await pg.click('[data-cm-bloquer]');
      await pg.waitForSelector('[data-cm-bloque]', { timeout: 8000 });
      dit(B.blocages.length === 1 && B.blocages[0].qui === A, 'elle bloque Bruno (confirmé)');
      pg.once('dialog', (d) => d.accept('insistant'));
      await pg.click('[data-cm-signaler]');
      await pg.waitForFunction(() => /Signalement envoyé/.test(document.body.innerText), null, { timeout: 8000 });
      dit(B.signalements.length === 1 && B.signalements[0].raison === 'insistant' && B.signalements[0].contre === Bu, 'le signalement est rangé (raison, personne signalée, extrait)', JSON.stringify(B.signalements));
      await A2.ctx.close();
    });
    await essaie('bloqué ⇒ rien ne passe', async () => {
      // Bruno écrit encore (par la vraie route) : il ne sait pas qu'il est bloqué.
      const B2 = await ouvrir(nav, { qui: Bu, largeur: 390, sombre: true });
      await B2.pg.click('[data-cm-conv]');
      await B2.pg.waitForSelector('[data-cm-texte]', { timeout: 8000 });
      await B2.pg.fill('[data-cm-texte]', 'tu es là ?');
      await B2.pg.click('[data-cm-envoyer]');
      await B2.pg.waitForFunction(() => [...document.querySelectorAll('[data-cm-bulle="moi"]')].some((e) => /tu es là/.test(e.innerText)), null, { timeout: 8000 }).catch(() => {});
      dit(await B2.pg.evaluate(() => [...document.querySelectorAll('[data-cm-bulle="moi"]')].some((e) => /tu es là/.test(e.innerText))), 'Bruno voit son message parti (il ne sait pas qu’il est bloqué)');
      await B2.ctx.close();
      const A3 = await ouvrir(nav, { qui: A });
      dit(!(await A3.pg.$('[data-cm-nonlus]')), 'chez Alice : aucun non-lu');
      await A3.pg.click('[data-cm-conv]');
      await A3.pg.waitForSelector('[data-cm-messages]', { timeout: 8000 });
      dit(!/tu es là/.test(await A3.pg.$eval('[data-cm-messages]', (e) => e.innerText)), 'le message du bloqué n’arrive PAS chez Alice');
      await A3.pg.click('.vrm-cm-x');
      const n = await attr(A3.pg, '[data-cm-total]', 'data-cm-total');
      dit(n === '1', 'Bruno a disparu de la carte d’Alice (elle seule)', n);
      console.log('\n── 1512 px · Alice se retire');
      await A3.pg.click('[data-cm-quitter]');
      await A3.pg.waitForSelector('[data-cm-moi="invisible"]', { timeout: 8000 });
      dit(!B.profils[A], '« Me retirer de la carte » : sa ligne est SUPPRIMÉE');
      await A3.ctx.close();
    });

    await essaie('aucun secret dans les réponses', async () => {
      const fuites = B.reponses.flatMap((x) => sansSecret(x.body).map((s) => s.slice(0, 12)));
      dit(B.reponses.length > 5 && fuites.length === 0, `aucune réponse de la route (${B.reponses.length}) ne porte un email, un identifiant de compte ou un compte Vinted`, [...new Set(fuites)].join(', '));
    });

    for (const [nom, opts, attendu, phrase] of [
      ['base sans la 018', { installe: false }, 'non-installe', /La carte de la communauté n’est pas encore activée sur ta base/],
      ['panne', { panne: true }, 'pas-su', /pas pu lire la carte/],
    ]) {
      console.log(`\n── 390 px · ${nom}`);
      await essaie(nom, async () => {
        reset(opts);
        const { ctx, pg } = await ouvrir(nav, { qui: A, largeur: 390 });
        dit(await etatDe(pg) === attendu, `${nom} : l’écran est dans l’état « ${attendu} »`, await etatDe(pg));
        const t = await texte(pg);
        dit(phrase.test(t), `${nom} : la phrase est dite`, t.slice(0, 160).replace(/\n/g, ' '));
        dit(!/Personne n’est encore|Personne d’autre/.test(t), `${nom} : jamais « personne » sur une carte qu’on n’a pas lue`);
        await ctx.close();
      });
    }

    console.log('\n── 1512 px · la carte injoignable ⇒ la même communauté en liste');
    await essaie('sans leaflet', async () => {
      reset();
      B.profils[Bu] = { pid: uuid(), pseudo: 'Bruno', ville: 'Cancale', pays: 'FR', lat: 48.7, lon: -1.85, cree_le: '2026-10-20T00:00:00Z' };
      const { ctx, pg } = await ouvrir(nav, { qui: A, sansLeaflet: true });
      await pg.waitForSelector('[data-cm-liste-secours]', { timeout: 20000 }).catch(() => {});
      dit(!!(await pg.$('[data-cm-liste-secours]')) && /Cancale/.test(await pg.$eval('[data-cm-liste-secours]', (e) => e.innerText)), 'Leaflet injoignable : la communauté est listée, rien n’est caché');
      await ctx.close();
    });
  } finally {
    await nav.close(); srv.close();
  }
  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
