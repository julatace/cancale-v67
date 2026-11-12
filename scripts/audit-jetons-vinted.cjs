// ═══════════════════════════════════════════════════════════════════════════
// AUDIT — AUCUN JETON VINTED NE SORT VERS LE NAVIGATEUR (12 nov., sécurité des comptes)
//        node scripts/audit-jetons-vinted.cjs            (--prouve : mutations ⇒ rouge)
// ═══════════════════════════════════════════════════════════════════════════
// La revue de robustesse (H1, H2) : `api/vinted-proxy.js` renvoyait access_token et
// refresh_token renouvelés à la page (`refreshed`), `api/vinted-connect.js` les rendait
// au navigateur (`tokens`). Ce banc EXÉCUTE les trois routes Vinted sur une fausse base
// et un faux Vinted, dans tous leurs chemins (lecture, jeton expiré renouvelé et rangé,
// écriture ratée, liaison depuis l'app et depuis l'extension, renouvellement global,
// panne), et cherche les jetons — anciens ET neufs — dans CHAQUE réponse.
// Puis l'app : la liste des comptes est lue SANS les jetons (projection), une ligne qui
// en porterait est nettoyée, et plus rien ne réécrit de jeton depuis la page.
// Aucune donnée réelle : jetons et comptes inventés.
'use strict';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-service-banc';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const R = process.env.RACINE || path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };

const VENDEUR = '11111111-1111-4111-8111-111111111111';
const SESSION = { authorization: 'Bearer aa.bb.cc' };
const jwt = (decalage, marque) => 'x.' + Buffer.from(JSON.stringify({ account_id: 42, sub: 42, exp: Math.floor(Date.now() / 1000) + decalage, m: marque })).toString('base64url') + '.y';
const BASE_ACCES = jwt(-3600, 'base'), BASE_REF = 'REF_BASE_SECRET', NEUF_ACCES = jwt(7200, 'neuf'), NEUF_REF = 'REF_NEUF_SECRET', COLLE = jwt(3600, 'colle');
const SECRETS = [BASE_ACCES, BASE_REF, NEUF_ACCES, NEUF_REF, COLLE, 'CSRF_SECRET', 'ANON_SECRET', 'REF_COLLE_SECRET'];
const fuite = (o) => { const s = JSON.stringify(o == null ? null : o); return SECRETS.filter((x) => s.includes(x)); };

let ecritures = 0;
function poserFetch({ expire = false, ecriture = 'ok', panne = false } = {}) {
  ecritures = 0;
  global.fetch = async (url, opts = {}) => {
    const u = String(url), method = String(opts.method || 'GET').toUpperCase(), h = opts.headers || {};
    const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
    if (panne && /vinted\./.test(u)) throw new Error(`socket fermée ${BASE_ACCES} ${BASE_REF}`);
    if (/\/auth\/v1\/user/.test(u)) return String(h.Authorization || h.authorization || '') === 'Bearer aa.bb.cc' ? J({ id: VENDEUR, email: 'v@exemple.test' }) : J({ msg: 'invalid' }, 401);
    if (/\/web\/api\/auth\/refresh$/.test(u)) return J({ access_token: NEUF_ACCES, refresh_token: NEUF_REF });
    if (/vinted\./.test(u)) {
      if (expire && String(h.Authorization || '').includes(BASE_ACCES)) return new Response('expired', { status: 401 });
      return J({ user: { id: 7, login: 'moncompte', account_id: 42 } });
    }
    // (12 nov., intégration) la migration 042 (`vrm_vinted_relier`) n'est pas passée ici : 404 ⇒ le chemin d'avant.
    if (/\/rest\/v1\/rpc\//.test(u)) return new Response('', { status: 404 });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) {
      if (method === 'GET') {
        if (/vinted_user_id=eq\.42/.test(u) || /owner=eq\./.test(u) && !/vinted_user_id=neq/.test(u)) return J([{ owner: VENDEUR, vinted_user_id: '42', access_token: BASE_ACCES, refresh_token: BASE_REF, anon_id: 'ANON_SECRET', csrf_token: 'CSRF_SECRET', domain: 'www.vinted.fr' }]);
        return J([]);
      }
      ecritures++;
      if (ecriture === 'jette') throw new Error(`écriture coupée ${COLLE} ${NEUF_REF}`);
      if (ecriture === 'panne') return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
      return method === 'PATCH' ? J([{ vinted_user_id: '42' }]) : new Response('', { status: 201 });
    }
    return J([]);
  };
}
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; r.send = (o) => { r.corps = o; return r; }; return r; };

(async () => {
  const charge = async (f) => { try { return await import(pathToFileURL(path.join(R, 'api', f)).href); } catch (e) { dit(false, `api/${f} se charge`, String(e && e.message || e).slice(0, 120)); return null; } };
  const proxy = await charge('vinted-proxy.js'), connect = await charge('vinted-connect.js'), refresh = await charge('vinted-refresh.js');
  const scenarios = [];
  const joue = async (nom, route, req, env) => { poserFetch(env); const r = faireRes(); try { await route.default({ query: {}, ...req }, r); } catch (e) { r.code = 'exception'; r.corps = String(e); } scenarios.push({ nom, r }); return r; };

  console.log('\n── Les routes, exécutées');
  if (proxy) {
    const corps = { uid: '42', endpoint: '/api/v2/users/current' };
    const a = await joue('vinted-proxy : lecture', proxy, { method: 'POST', headers: SESSION, body: corps });
    dit(a.code === 200 && a.corps && a.corps.ok === true, 'vinted-proxy lit toujours (le relais marche)', `HTTP ${a.code}`);
    const b = await joue('vinted-proxy : jeton expiré, renouvelé et rangé', proxy, { method: 'POST', headers: SESSION, body: corps }, { expire: true });
    dit(b.corps && b.corps.refreshed && b.corps.refreshed.persiste === true, 'vinted-proxy : jeton renouvelé, RANGÉ par le relais, dit à la page (persiste)', JSON.stringify(b.corps && b.corps.refreshed));
    const c = await joue('vinted-proxy : jeton renouvelé, écriture ratée', proxy, { method: 'POST', headers: SESSION, body: corps }, { expire: true, ecriture: 'panne' });
    dit(c.corps && c.corps.refreshed && c.corps.refreshed.persiste === false, 'vinted-proxy : écriture ratée DITE (persiste: false)', JSON.stringify(c.corps && c.corps.refreshed));
    await joue('vinted-proxy : Vinted injoignable', proxy, { method: 'POST', headers: SESSION, body: corps }, { panne: true });
  }
  if (connect) {
    const d = await joue('vinted-connect : liaison depuis l’app (jeton collé)', connect, { method: 'POST', headers: SESSION, body: { accessToken: COLLE, refreshToken: 'REF_COLLE_SECRET' } });
    dit(d.code === 200 && d.corps && d.corps.ok === true && d.corps.account, 'vinted-connect relie toujours le compte (pseudo rendu)', `HTTP ${d.code} ${JSON.stringify(d.corps).slice(0, 80)}`);
    await joue('vinted-connect : liaison depuis l’extension', connect, { method: 'POST', headers: SESSION, body: { source: 'extension', accessToken: COLLE, refreshToken: 'REF_COLLE_SECRET' } });
    await joue('vinted-connect : base coupée pendant l’écriture', connect, { method: 'POST', headers: SESSION, body: { accessToken: COLLE } }, { ecriture: 'jette' });
    await joue('vinted-connect : Vinted injoignable', connect, { method: 'POST', headers: SESSION, body: { accessToken: COLLE } }, { panne: true });
  }
  if (refresh) {
    await joue('vinted-refresh : renouvellement global', refresh, { method: 'GET', headers: SESSION });
    await joue('vinted-refresh : Vinted injoignable', refresh, { method: 'GET', headers: SESSION }, { panne: true });
  }
  for (const { nom, r } of scenarios) { const f = fuite(r.corps); dit(f.length === 0, `${nom} : aucun jeton dans la réponse (HTTP ${r.code})`, `fuite : ${f.map((x) => x.slice(0, 14)).join(', ')}`); }
  dit(scenarios.length >= 10, `${scenarios.length} réponses relues`);

  console.log('\n── L’app');
  let app = '';
  try { app = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8'); } catch (_) { app = ''; }
  const extraire = (a, b) => { const i = app.indexOf(a); return i < 0 ? '' : app.slice(i, app.indexOf(b, i)); };
  const code = extraire('const fetchVintedAccounts =', '// Retire un compte de');
  let urls = [], liste = null;
  try {
    const c = vm.createContext({ AUTH: { user: { id: VENDEUR }, session: { access_token: 't' } }, SUPABASE_URL: 'https://base.test', encodeURIComponent, sbAuth: () => ({}), memoriserComptesLies: () => {}, horsLigneMaintenant: () => false, comptesCopieHorsLigne: () => [], garderComptesCopie: () => {},   /* (12 nov.) hors ligne (lot hors-ligne) : en ligne ici */ CLE_SUPPRIMES: 'k', localStorage: { setItem() {}, getItem() { return null; } },
      fetch: async (u) => { urls.push(String(u)); return /vinted_accounts/.test(String(u)) ? Response.json([{ owner: VENDEUR, vinted_user_id: '42', login: 'moncompte', access_token: BASE_ACCES, refresh_token: BASE_REF, csrf_token: 'CSRF_SECRET', anon_id: 'ANON_SECRET' }]) : Response.json([]); } });
    vm.runInContext(code + ';globalThis.lire=fetchVintedAccounts;', c);
    liste = await c.lire();
  } catch (e) { dit(false, 'fetchVintedAccounts s’exécute', String(e && e.message || e).slice(0, 120)); }
  const uListe = urls.find((u) => /vinted_accounts/.test(u)) || '';
  const sel = (/[?&]select=([^&]*)/.exec(uListe) || [])[1] || '';
  dit(sel && sel !== '*' && !/token|anon_id/.test(sel), 'la liste des comptes est lue SANS les jetons (projection)', `select=${sel}`);
  dit(Array.isArray(liste) && liste.length === 1 && fuite(liste).length === 0 && liste[0].login === 'moncompte', 'une ligne qui en porterait quand même est nettoyée (le pseudo reste)', JSON.stringify(liste).slice(0, 120));
  const pr = extraire('const persistRefreshedTokens', 'const vintedApiCall');
  dit(pr && !/access_token|refresh_token/.test(pr.replace(/\/\/[^\n]*/g, '')), 'la page ne réécrit plus aucun jeton (persistRefreshedTokens)');
  dit(!/setVintedTokensRefreshedHandler\(/.test(app), 'et ne range plus de jeton dans son état');

  console.log(ko ? `\n❌ ${ko} rouge(s), ${ok} vert(s)` : `\n✅ ${ok} verts, 0 rouge`);
  if (process.argv.includes('--prouve') && !ko) prouver();
  process.exit(ko ? 1 : 0);
})();

function prouver() {
  const MUT = [
    ['api/vinted-proxy.js', 'refreshed = { persiste: n != null && n > 0 };', 'refreshed = { ...nt, persiste: n != null && n > 0 };'],
    ['api/vinted-proxy.js', "res.status(500).json({ error: 'Échec de la requête vers Vinted' });", "res.status(500).json({ error: 'Échec de la requête vers Vinted', detail: String(err) });"],
    ['api/vinted-connect.js', 'res.status(200).json({ ok: true, account });', 'res.status(200).json({ ok: true, account, tokens });'],
    ['api/vinted-connect.js', "res.status(500).json({ error: 'Échec de la connexion à Vinted' });", "res.status(500).json({ error: 'Échec de la connexion à Vinted', detail: String(err) });"],
    ['src/App.jsx', "const SELECT_COMPTES_VINTED = 'id,owner,vinted_user_id,login,domain,created_at,updated_at';", "const SELECT_COMPTES_VINTED = '*';"],
    ['src/App.jsx', 'list = list.map(sansJetonsVinted);', ';'],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jetons-'));
  for (const d of ['src', 'api', 'scripts', 'package.json']) fs.cpSync(path.join(R, d), path.join(tmp, d), { recursive: true });
  let rouges = 0;
  for (const [f, a, b] of MUT) {
    const p = path.join(tmp, f), avant = fs.readFileSync(p, 'utf8');
    if (!avant.includes(a)) { console.log(`  ❌ mutation introuvable : ${f} « ${a.slice(0, 50)} »`); continue; }
    fs.writeFileSync(p, avant.replace(a, b));
    const r = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'audit-jetons-vinted.cjs')], { env: { ...process.env, RACINE: tmp }, encoding: 'utf8' });
    fs.writeFileSync(p, avant);
    if (r.status !== 0) rouges++; else console.log(`  ❌ mutation NON vue : ${f} « ${a.slice(0, 60)} »`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${rouges}/${MUT.length} mutations rendent l’audit rouge`);
  if (rouges !== MUT.length) process.exit(1);
}
