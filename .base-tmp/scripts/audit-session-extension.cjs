// ════════════════════════════════════════════════════════════════════════════
//  LA SESSION DE L'EXTENSION, FABRIQUÉE PAR LE SERVEUR — la vraie route, exécutée.
//        node scripts/audit-session-extension.cjs [--src dossier]
//        node scripts/audit-session-extension.cjs --local     (GoTrue local)
//
//  L'app passait à l'extension SA PROPRE session : les deux renouvelaient la
//  MÊME famille de jetons. Supabase fait tourner le jeton de renouvellement ;
//  celle qui renouvelle en second rejoue un jeton consommé, refusé
//  (`refresh_token_already_used`) : elle est déconnectée et réessaie — les
//  refus et les rafales de 429 des journaux d'auth (et, selon la configuration,
//  Supabase révoque en plus toute la famille).
//  `POST /api/compte?mode=session-extension` fabrique pour le MÊME vendeur une
//  session indépendante (lien magique généré côté serveur, aussitôt vérifié).
//
//  C'est une route qui FABRIQUE DES SESSIONS avec la clé de service : ce banc
//  vérifie surtout ce qu'elle REFUSE (sans session, jeton forgé, adresse prise
//  dans la requête, session fabriquée pour un autre, secrets de Supabase qui
//  fuiraient dans la réponse ou les journaux) — et l'autre sens : le vendeur
//  connecté reçoit bien SA session, et seulement les cinq champs promis.
//
//  Sans option : faux Supabase (aucun réseau). `--local` : la VRAIE route contre
//  un GoTrue local (jamais la production — l'adresse doit être 127.0.0.1 ou
//  localhost), et la preuve que la session fabriquée vit sa vie : elle se
//  renouvelle seule, porte un autre `session_id`, et survit à la révocation de
//  la famille de l'appelant.
//    Clés locales lues dans l'environnement (jamais écrites dans ce dépôt
//    public) : LOCAL_SUPABASE_URL (défaut http://127.0.0.1:54321),
//    LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_SERVICE_KEY — `supabase status`
//    les affiche.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const LOCAL = process.argv.includes('--local');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 160)); } };

const faireRes = () => {
  const x = { code: null, corps: null, entetes: {} };
  x.status = (n) => { x.code = n; return x; };
  x.json = (o) => { x.corps = o; return x; };
  x.setHeader = (k, v) => { x.entetes[String(k).toLowerCase()] = v; return x; };
  x.end = () => x;
  return x;
};
const CHAMPS_SESSION = ['access_token', 'email', 'expires_at', 'refresh_token', 'user_id'];
// Ce qui ne doit JAMAIS sortir : de quoi rouvrir une session à volonté, et la
// fiche Supabase au-delà des cinq champs.
const INTERDITS = ['hashed_token', 'email_otp', 'action_link', 'identities', 'app_metadata', 'user_metadata', 'verification_type', 'redirect_to'];
const decodeJwt = (t) => { try { return JSON.parse(Buffer.from(String(t).split('.')[1], 'base64url').toString('utf8')); } catch (_) { return null; } };

// ════════════════════════════════════════════════════════════════════════════
//  1) FAUX SUPABASE — chaque refus, et le bon chemin
// ════════════════════════════════════════════════════════════════════════════
async function faux() {
  // ⚠️ Une adresse qui n'existe pas : même si le faux `fetch` laissait passer
  //    un appel, rien ne partirait vers la production.
  process.env.SUPABASE_URL = 'https://base-de-banc.invalid';
  process.env.SUPABASE_KEY = 'cle-publique-de-banc';
  const SERVICE = 'cle-service-de-banc';
  process.env.SUPABASE_SERVICE_KEY = SERVICE;

  // Les vendeurs que le faux service d'identité connaît. Un jeton a trois
  // morceaux (le contrôle de forme du serveur l'exige) et porte l'id au milieu.
  const vendeurs = new Map();     // id → { id, email, confirme }
  let n = 0;
  const nouveauVendeur = (o = {}) => {
    n++;
    const id = `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const v = { id, email: o.email !== undefined ? o.email : `vendeur${n}@exemple.test`, confirme: o.confirme !== false, jeton: `eyJh.${id}.sig` };
    vendeurs.set(id, v);
    return v;
  };
  const AUTRE = 'bbbbbbbb-0000-4000-8000-000000000999';

  let sc = {};            // scénario du test en cours
  const journal = [];     // { chemin, apikey, auth, corps }
  let nSession = 0;
  const rep = (corps, status = 200, type = 'application/json') =>
    new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': type } });
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    const h = opts.headers || {};
    const corps = (() => { try { return JSON.parse(opts.body || 'null'); } catch (_) { return opts.body || null; } })();
    const chemin = u.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '');
    journal.push({ chemin, url: u, apikey: h.apikey || '', auth: h.Authorization || h.authorization || '', corps });
    if (chemin === '/auth/v1/user') {
      const m = /^Bearer eyJh\.([0-9a-f-]{36})\.sig$/.exec(String(h.Authorization || h.authorization || ''));
      const v = m && vendeurs.get(m[1]);
      if (!v) return rep({ msg: 'invalid JWT' }, 401);
      return rep({ id: v.id, email: v.email, phone: v.email ? '' : '33600000000', email_confirmed_at: v.confirme && v.email ? '2026-10-01T00:00:00Z' : null, identities: [{ provider: 'email' }] });
    }
    if (chemin === '/auth/v1/admin/generate_link') {
      if (sc.lien === 'panne') return rep({ code: 500, msg: 'Database error' }, 500);
      if (sc.lien === 'html') return rep('<html>522</html>', 200, 'text/html');
      if (sc.lien === 'delai') { const e = new Error('The operation was aborted due to timeout'); e.name = 'TimeoutError'; throw e; }
      const cible = [...vendeurs.values()].find((x) => x.email && x.email === (corps && corps.email));
      // Comme GoTrue : une adresse inconnue CRÉE un compte (type « signup »).
      const id = sc.lien === 'autre' ? AUTRE : cible ? cible.id : 'cccccccc-0000-4000-8000-000000000001';
      const type = sc.lien === 'signup' || !cible ? 'signup' : 'magiclink';
      return rep({ id, email: corps && corps.email, aud: 'authenticated', role: 'authenticated', identities: [{ provider: 'email' }], app_metadata: {}, user_metadata: {},
        action_link: `https://base-de-banc.invalid/auth/v1/verify?token=SECRET-LIEN-${id}&type=${type}`, email_otp: '987654', hashed_token: `hache-secret-${id}`, redirect_to: 'http://localhost:3000', verification_type: type });
    }
    if (chemin === '/auth/v1/verify') {
      if (sc.verif === 'panne') return rep({ code: 500, msg: 'Database error' }, 500);
      if (sc.verif === 'delai') { const e = new Error('The operation was aborted due to timeout'); e.name = 'TimeoutError'; throw e; }
      const m = /^hache-secret-([0-9a-f-]{36})$/.exec(String(corps && corps.token_hash));
      if (!m || !corps || corps.type !== 'magiclink') return rep({ code: 403, error_code: 'otp_expired' }, 403);
      nSession++;
      const id = sc.verif === 'autre' ? AUTRE : m[1];
      const s = { access_token: `eyJh.session-${nSession}.sig`, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: `rt-secret-${nSession}`, user: { id, email: 'x@exemple.test', identities: [{ provider: 'email' }], app_metadata: { provider: 'email' }, user_metadata: {} } };
      if (sc.verif === 'sansRenouv') delete s.refresh_token;
      return rep(s);
    }
    if (chemin === '/auth/v1/logout') return rep('', 204);
    return rep({ msg: 'inattendu' }, 404);
  };

  let route;
  await essaie('chargement', async () => { route = await import('file://' + path.join(RACINE, 'api', 'compte.js')); });
  if (!route) { console.log(`\n❌ audit-session-extension : la route n'a pas pu être chargée`); process.exit(1); }

  // Ce que la route écrit dans les journaux pendant l'appel : aucun secret.
  const journaux = [];
  const appeler = async ({ methode = 'POST', jeton, scenario = {}, body, query = {} } = {}) => {
    sc = scenario; journal.length = 0; journaux.length = 0;
    const res = faireRes();
    const orig = { log: console.log, warn: console.warn, error: console.error };
    for (const k of Object.keys(orig)) console[k] = (...a) => journaux.push(a.map(String).join(' '));
    try {
      await route.default({ method: methode, query: { mode: 'session-extension', ...query }, headers: jeton ? { authorization: 'Bearer ' + jeton } : {}, body }, res);
    } finally { Object.assign(console, orig); }
    const texte = JSON.stringify(res.corps || {});
    return {
      code: res.code, corps: res.corps, texte, entetes: res.entetes, journaux: journaux.slice(),
      admin: journal.filter((x) => x.chemin === '/auth/v1/admin/generate_link'),
      verif: journal.filter((x) => x.chemin === '/auth/v1/verify'),
      logout: journal.filter((x) => x.chemin === '/auth/v1/logout'),
      appels: journal.slice(),
    };
  };
  const sansJeton = (o) => !/rt-secret-|eyJh\.session-|access_token|refresh_token/.test(o.texte);
  const sansSecret = (s) => !/hache-secret-|987654|SECRET-LIEN-/.test(s);

  await essaie('GET refusé', async () => {
    const v = nouveauVendeur();
    const o = await appeler({ methode: 'GET', jeton: v.jeton });
    dit(o.code === 405 && o.appels.length === 0, 'GET → 405, aucun appel à Supabase', `code ${o.code}, ${o.appels.length} appel(s)`);
  });

  await essaie('sans session', async () => {
    const o = await appeler({});
    dit(o.code === 401 && o.admin.length === 0 && o.verif.length === 0, 'sans session → 401 et aucun appel d\'administration', `code ${o.code}, generate_link ×${o.admin.length}`);
  });

  await essaie('jeton forgé', async () => {
    const o = await appeler({ jeton: 'eyJh.' + 'dddddddd-0000-4000-8000-000000000001' + '.sig' });
    dit(o.code === 401 && o.admin.length === 0, 'jeton forgé (inconnu de Supabase) → 401, aucun appel d\'administration', `code ${o.code}, generate_link ×${o.admin.length}`);
  });

  await essaie('sans clé de service', async () => {
    const v = nouveauVendeur();
    delete process.env.SUPABASE_SERVICE_KEY;
    let o;
    try { o = await appeler({ jeton: v.jeton }); } finally { process.env.SUPABASE_SERVICE_KEY = SERVICE; }
    dit(o.code === 503 && o.appels.length === 0, 'clé de service absente → 503 sans aucun appel', `code ${o.code}, ${o.appels.length} appel(s)`);
  });

  await essaie('bon chemin', async () => {
    const v = nouveauVendeur();
    const t0 = Date.now();
    const o = await appeler({ jeton: v.jeton });
    const s = o.corps && o.corps.session;
    dit(o.code === 200 && o.corps.ok === true && s && s.user_id === v.id && s.email === v.email,
      'vendeur connecté → 200, une session À LUI (user_id et email du jeton)', `code ${o.code} ${o.texte.slice(0, 120)}`);
    dit(o.code === 200 && JSON.stringify(Object.keys(o.corps).sort()) === '["ok","session"]' && s && JSON.stringify(Object.keys(s).sort()) === JSON.stringify(CHAMPS_SESSION),
      'la réponse ne porte que { ok, session:{ access_token, refresh_token, expires_at, user_id, email } }', o.corps && JSON.stringify(Object.keys(o.corps)) + ' / ' + (s ? JSON.stringify(Object.keys(s)) : '—'));
    const fuites = INTERDITS.filter((k) => o.texte.includes(k));
    dit(o.code === 200 && fuites.length === 0 && sansSecret(o.texte), 'aucun secret de Supabase dans la réponse (hashed_token, email_otp, action_link, fiche…)', fuites.join(', ') || (sansSecret(o.texte) ? '' : 'valeur secrète présente'));
    dit(o.code === 200 && s && /^eyJh\.session-\d+\.sig$/.test(s.access_token) && /^rt-secret-\d+$/.test(s.refresh_token),
      'les jetons rendus sont ceux de la session NEUVE (verify), pas ceux de l\'appelant', s ? s.access_token : '—');
    dit(o.code === 200 && s && s.expires_at >= t0 + 3600 * 1000 - 5000 && s.expires_at <= Date.now() + 3600 * 1000 + 5000,
      'expires_at en millisecondes (Date.now() + expires_in × 1000, comme sessionFrom)', s ? String(s.expires_at) : '—');
    dit(o.code === 200 && String(o.entetes['cache-control'] || '') === 'no-store', 'Cache-Control: no-store', String(o.entetes['cache-control']));
    const gl = o.admin[0];
    dit(o.code === 200 && o.admin.length === 1 && gl.apikey === SERVICE && gl.corps && gl.corps.type === 'magiclink' && gl.corps.email === v.email,
      'generate_link : clé de service, type magiclink, adresse du vendeur', gl ? JSON.stringify(gl.corps) : 'aucun appel');
    const vf = o.verif[0];
    dit(o.code === 200 && o.verif.length === 1 && vf.apikey !== SERVICE && vf.corps && vf.corps.type === 'magiclink' && vf.corps.token_hash === `hache-secret-${v.id}`,
      'verify : clé PUBLIQUE (pas la clé de service), le hash du lien généré', vf ? `apikey ${vf.apikey}` : 'aucun appel');
    dit(o.code === 200 && o.journaux.every(sansSecret) && !o.journaux.some((l) => /rt-secret-|eyJh\.session-/.test(l)), 'rien de secret dans les journaux', o.journaux.join(' | ').slice(0, 160));
  });

  await essaie('adresse prise dans la requête', async () => {
    const v = nouveauVendeur();
    const victime = nouveauVendeur({ email: 'victime@exemple.test' });
    const o = await appeler({ jeton: v.jeton, body: { email: victime.email, user_id: victime.id }, query: { email: victime.email } });
    const gl = o.admin[0];
    const fuite = o.appels.some((x) => JSON.stringify(x).includes(victime.email));
    dit(o.code === 200 && gl && gl.corps.email === v.email && !fuite && o.corps.session.user_id === v.id && o.corps.session.email === v.email,
      'corps et adresse qui nomment une AUTRE adresse : ignorés — generate_link reçoit l\'adresse de /auth/v1/user', gl ? `generate_link email=${gl.corps.email}, victime citée : ${fuite}` : `code ${o.code}`);
  });

  await essaie('sans email', async () => {
    const v = nouveauVendeur({ email: '' });
    const o = await appeler({ jeton: v.jeton });
    dit(o.code === 409 && o.admin.length === 0 && o.corps && /email/i.test(o.corps.message || ''), 'compte sans email (téléphone seul) → 409 en français, aucun appel d\'administration', `code ${o.code}, generate_link ×${o.admin.length}`);
  });

  await essaie('email non confirmé', async () => {
    const v = nouveauVendeur({ confirme: false });
    const o = await appeler({ jeton: v.jeton });
    dit(o.code === 409 && o.admin.length === 0, 'adresse jamais confirmée → 409, aucune session fabriquée', `code ${o.code}, generate_link ×${o.admin.length}`);
  });

  for (const [lien, nom] of [['panne', 'generate_link répond 500'], ['html', 'generate_link répond du HTML'], ['delai', 'generate_link ne répond pas à temps']]) {
    await essaie(nom, async () => {
      const v = nouveauVendeur();
      const o = await appeler({ jeton: v.jeton, scenario: { lien } });
      dit(o.code === 502 && sansJeton(o) && o.verif.length === 0 && /réessaie/i.test((o.corps && o.corps.message) || ''), `${nom} → 502 « réessaie », aucun jeton, aucun verify`, `code ${o.code}, verify ×${o.verif.length}`);
    });
  }

  await essaie('lien pour un autre compte', async () => {
    const v = nouveauVendeur();
    const o = await appeler({ jeton: v.jeton, scenario: { lien: 'autre' } });
    dit(o.code === 502 && sansJeton(o) && o.verif.length === 0, 'generate_link rend un AUTRE compte → refusé, verify jamais appelé', `code ${o.code}, verify ×${o.verif.length}`);
  });

  await essaie('lien de création', async () => {
    const v = nouveauVendeur();
    const o = await appeler({ jeton: v.jeton, scenario: { lien: 'signup' } });
    dit(o.code === 502 && sansJeton(o) && o.verif.length === 0, 'generate_link répond « signup » (un compte CRÉÉ) → refusé, verify jamais appelé', `code ${o.code}, verify ×${o.verif.length}`);
  });

  for (const [verif, nom] of [['panne', 'verify répond 500'], ['delai', 'verify ne répond pas à temps']]) {
    await essaie(nom, async () => {
      const v = nouveauVendeur();
      const o = await appeler({ jeton: v.jeton, scenario: { verif } });
      dit(o.code === 502 && sansJeton(o) && sansSecret(o.texte), `${nom} → 502, aucun jeton, aucune donnée partielle`, `code ${o.code} ${o.texte.slice(0, 80)}`);
    });
  }

  await essaie('session pour un autre', async () => {
    const v = nouveauVendeur();
    const o = await appeler({ jeton: v.jeton, scenario: { verif: 'autre' } });
    dit(o.code === 502 && sansJeton(o), 'verify rend la session d\'un AUTRE compte → refusée, aucun jeton rendu', `code ${o.code} ${o.texte.slice(0, 80)}`);
    dit(o.code === 502 && o.logout.length === 1 && /^Bearer eyJh\.session-\d+\.sig$/.test(o.logout[0].auth), '… et cette session égarée est aussitôt fermée (logout)', `logout ×${o.logout.length}`);
  });

  await essaie('session incomplète', async () => {
    const v = nouveauVendeur();
    const o = await appeler({ jeton: v.jeton, scenario: { verif: 'sansRenouv' } });
    dit(o.code === 502 && sansJeton(o) && o.logout.length === 1, 'verify sans jeton de renouvellement → 502, rien rendu, session fermée', `code ${o.code}, logout ×${o.logout.length}`);
  });

  await essaie('frein', async () => {
    const v = nouveauVendeur();
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await appeler({ jeton: v.jeton })).code);
    const septieme = await appeler({ jeton: v.jeton });
    dit(codes.every((c) => c === 200) && septieme.code === 429 && septieme.admin.length === 0 && Number(septieme.entetes['retry-after']) > 0,
      'au-delà de 6 sessions par heure pour un vendeur → 429 (Retry-After), sans appel d\'administration', `codes ${codes.join(',')} puis ${septieme.code}, generate_link ×${septieme.admin.length}, Retry-After ${septieme.entetes['retry-after']}`);
    dit(septieme.code === 429 && /réessaie/i.test((septieme.corps && septieme.corps.message) || ''), '… avec un message en français', septieme.corps && septieme.corps.message);
    const w = nouveauVendeur();
    const autre = await appeler({ jeton: w.jeton });
    dit(septieme.code === 429 && autre.code === 200, 'le frein est PAR vendeur : un autre vendeur passe toujours', `autre vendeur : ${autre.code}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  2) GoTrue LOCAL — la session fabriquée vit vraiment sa vie
// ════════════════════════════════════════════════════════════════════════════
async function local() {
  const URL_LOCALE = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321';
  const PUB = process.env.LOCAL_SUPABASE_ANON_KEY || '';
  const SRV = process.env.LOCAL_SUPABASE_SERVICE_KEY || '';
  // ⚠️ Jamais la production : ce mode crée et supprime des comptes.
  let hote = '';
  try { hote = new URL(URL_LOCALE).hostname; } catch (_) {}
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(hote)) { console.log(`❌ --local refuse ${URL_LOCALE} : seulement 127.0.0.1 ou localhost.`); process.exit(1); }
  if (!PUB || !SRV) { console.log('❌ --local : poser LOCAL_SUPABASE_ANON_KEY et LOCAL_SUPABASE_SERVICE_KEY (les clés du Supabase LOCAL, `supabase status`).'); process.exit(1); }
  // Les constantes de la route sont figées à l'import : l'environnement est posé AVANT.
  process.env.SUPABASE_URL = URL_LOCALE;
  process.env.SUPABASE_KEY = PUB;
  process.env.SUPABASE_SERVICE_KEY = SRV;
  const B = URL_LOCALE + '/auth/v1';
  const appel = async (chemin, corps, entetes = {}) => {
    const r = await fetch(B + chemin, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json', ...entetes }, body: JSON.stringify(corps || {}) });
    let j = null; try { j = await r.json(); } catch (_) {}
    return { status: r.status, j };
  };
  const renouveler = (rt) => appel('/token?grant_type=refresh_token', { refresh_token: rt });

  let route;
  await essaie('chargement', async () => { route = await import('file://' + path.join(RACINE, 'api', 'compte.js')); });
  if (!route) { console.log(`\n❌ audit-session-extension --local : la route n'a pas pu être chargée`); process.exit(1); }

  const email = `fourche-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  let uid = '';
  try {
    const ins = await appel('/signup', { email, password: 'motdepasse-de-banc-' + Math.random().toString(36).slice(2) });
    dit(ins.status === 200 && ins.j && ins.j.access_token, 'compte jetable créé sur le GoTrue local', `HTTP ${ins.status}`);
    if (!(ins.j && ins.j.access_token)) return;
    uid = ins.j.user.id;
    const AT1 = ins.j.access_token, RT1 = ins.j.refresh_token;

    const res = faireRes();
    await route.default({ method: 'POST', query: { mode: 'session-extension' }, headers: { authorization: 'Bearer ' + AT1 }, body: { email: 'autre@example.test' } }, res);
    const s = res.corps && res.corps.session;
    dit(res.code === 200 && s && s.user_id === uid && s.email === email, 'la vraie route rend une session au MÊME vendeur', `code ${res.code} ${JSON.stringify(res.corps).slice(0, 120)}`);
    if (!s) return;
    const texte = JSON.stringify(res.corps);
    dit(!INTERDITS.some((k) => texte.includes(k)) && JSON.stringify(Object.keys(s).sort()) === JSON.stringify(CHAMPS_SESSION), 'réponse réelle : les cinq champs, aucun secret de GoTrue', JSON.stringify(Object.keys(s)));
    const p1 = decodeJwt(AT1), p2 = decodeJwt(s.access_token);
    dit(p1 && p2 && p2.sub === uid && p1.session_id && p2.session_id && p1.session_id !== p2.session_id,
      'autre session_id que l\'appelant (une autre famille de jetons)', `${p1 && p1.session_id} ≠ ${p2 && p2.session_id}`);
    dit(s.refresh_token !== RT1 && s.access_token !== AT1, 'ni le jeton d\'accès ni celui de renouvellement de l\'appelant');

    // La session fourchée se renouvelle seule.
    const r2 = await renouveler(s.refresh_token);
    dit(r2.status === 200 && r2.j && r2.j.access_token && decodeJwt(r2.j.access_token).session_id === p2.session_id, 'la session de l\'extension se renouvelle seule', `HTTP ${r2.status}`);
    const RT2b = r2.j && r2.j.refresh_token;

    // LE DÉFAUT, REPRODUIT : deux détenteurs d'une MÊME famille. L'app renouvelle
    // deux fois (rotation) ; celui qui a gardé l'ancien jeton le présente après
    // le délai de grâce → `refresh_token_already_used`, l'erreur des journaux de
    // production. (Mesuré sur GoTrue v2.197 : rejouer le PARENT direct du jeton
    // actif est toléré — Supabase rend le jeton actif —, c'est un jeton plus
    // ancien qui est refusé. Selon la configuration, la famille entière est
    // ensuite révoquée.)
    const r1 = await renouveler(RT1);
    const r1b = r1.j && r1.j.refresh_token ? await renouveler(r1.j.refresh_token) : { status: 0, j: null };
    const AT1c = r1b.j && r1b.j.access_token, RT1c = r1b.j && r1b.j.refresh_token;
    dit(r1.status === 200 && r1b.status === 200 && RT1c, 'l\'appelant renouvelle la sienne, deux fois', `HTTP ${r1.status}, ${r1b.status}`);
    console.log('   … 11 s d\'attente (délai de grâce de réutilisation de GoTrue)');
    await new Promise((fin) => setTimeout(fin, 11000));
    const rejeu = await renouveler(RT1);
    dit(rejeu.status !== 200 && rejeu.j && rejeu.j.error_code === 'refresh_token_already_used',
      'famille PARTAGÉE : le détenteur resté sur l\'ancien jeton est rejeté (refresh_token_already_used) — le défaut mesuré', `HTTP ${rejeu.status} ${rejeu.j && (rejeu.j.error_code || rejeu.j.msg)}`);
    const r3 = await renouveler(RT2b);
    dit(r3.status === 200 && r3.j && r3.j.access_token, 'famille FOURCHÉE : la session de l\'extension se renouvelle, quoi que fasse l\'app', `HTTP ${r3.status} ${r3.j && (r3.j.error_code || r3.j.msg || '')}`);

    // L'app se déconnecte (sa session seulement) : celle de l'extension survit.
    const fermeture = AT1c ? await fetch(B + '/logout?scope=local', { method: 'POST', headers: { apikey: PUB, Authorization: 'Bearer ' + AT1c } }) : null;
    const morte = RT1c ? await renouveler(RT1c) : { status: 0 };
    dit(fermeture && fermeture.status < 300 && morte.status !== 200, 'la session de l\'app est fermée pour de bon (son jeton ne se renouvelle plus)', `logout HTTP ${fermeture && fermeture.status}, renouvellement HTTP ${morte.status}`);
    const r4 = r3.j && r3.j.refresh_token ? await renouveler(r3.j.refresh_token) : { status: 0, j: null };
    dit(r4.status === 200 && r4.j && r4.j.access_token, '… et celle de l\'extension se renouvelle toujours', `HTTP ${r4.status} ${r4.j && (r4.j.error_code || r4.j.msg || '')}`);
    const qui = r4.j && r4.j.access_token ? await fetch(B + '/user', { headers: { apikey: PUB, Authorization: 'Bearer ' + r4.j.access_token } }).then((x) => x.json()).catch(() => null) : null;
    dit(qui && qui.id === uid, 'et elle ouvre toujours le compte du même vendeur', qui && qui.id);
  } finally {
    // Le compte jetable ne reste pas dans le GoTrue local.
    if (uid) {
      const del = await fetch(`${B}/admin/users/${uid}`, { method: 'DELETE', headers: { apikey: SRV, ...(SRV.startsWith('eyJ') ? { Authorization: 'Bearer ' + SRV } : {}) } }).catch(() => null);
      console.log(`   (compte jetable ${del && del.ok ? 'supprimé' : 'NON supprimé'})`);
    }
  }
}

(async () => {
  if (LOCAL) await local(); else await faux();
  console.log(`\n${ko ? '❌' : '✅'} audit-session-extension${LOCAL ? ' --local' : ''} : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
