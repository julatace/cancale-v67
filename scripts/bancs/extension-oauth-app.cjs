require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « CONTINUER AVEC GOOGLE / DISCORD » DEPUIS L'EXTENSION — côté APP (5.325)
//
//  La fenêtre de l'extension ouvre `vrm.center/?tab=…&lier-extension=<id>&connexion=google`.
//  Vraie app (dist), faux Supabase, faux canal de l'extension. Aucun compte réel.
//   A1  pas connecté + Google activé ⇒ départ DIRECT vers `/auth/v1/authorize?provider=google`
//       en PKCE (code_challenge s256), sans second clic ; `connexion` et `lier-extension`
//       quittent l'adresse ; la liaison est gardée (onglet) et marquée pour un retour
//       dans un NOUVEL onglet (10 min) — jamais un jeton.
//   A2  pas connecté + Discord PAS activé ⇒ pas de départ ; l'écran de connexion
//       normal et la phrase claire.
//   A3  fournisseur inconnu ⇒ rien ne part ; l'adresse est nettoyée.
//   A4  déjà connecté ⇒ aucun départ chez Google ; la liaison part à CETTE extension.
//   A5  retour de Google dans un NOUVEL onglet (`?code=`, sessionStorage vide) : la
//       liaison est retrouvée par la marque (≤ 10 min) et consommée ; trop vieille ⇒
//       la phrase avec le geste.
//  `BANC_DIST` : un autre build (preuve sur le code d'avant).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const UID = '11111111-2222-3333-4444-555555555555';
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

(async () => {
  const srv = http.createServer((req, res) => {
    let f = new URL(req.url, 'http://x').pathname;
    if (f === '/') f = '/index.html';
    let p = path.join(DIST, f);
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIST, 'index.html');
    res.setHeader('Content-Type', p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : p.endsWith('.html') ? 'text/html' : p.endsWith('.png') ? 'image/png' : 'application/octet-stream');
    res.end(fs.readFileSync(p));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const ORIG = 'http://127.0.0.1:' + srv.address().port;
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

  // Ouvre l'app à `chemin`. `settings` : ce que Supabase publie. `session` : rangée avant.
  async function ouvrir(chemin, { settings = { external: { google: true, discord: true } }, session = null, avant = null, attente = 2500, capture = null } = {}) {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await ctx.newPage();
    const j = { authorize: [], erreurs: [], extMsgs: [] };
    pg.on('pageerror', (e) => j.erreurs.push(String(e.message || e).slice(0, 160)));
    await pg.route('**/*', async (r) => {
      const u = r.request().url();
      if (/\/auth\/v1\/authorize/.test(u)) { j.authorize.push(u); return r.fulfill({ status: 204, body: '' }); }
      if (/\/auth\/v1\/settings/.test(u)) return r.fulfill({ status: 200, json: settings });
      if (/\/auth\/v1\/user/.test(u)) return r.fulfill({ status: 200, json: { id: UID, email: 'vendeuse@exemple.test', identities: [{ provider: 'google' }] } });
      if (/\/auth\/v1\/token/.test(u)) return r.fulfill({ status: 400, json: { error_description: 'code invalide' } });
      if (/\/auth\/v1\//.test(u)) return r.fulfill({ status: 200, json: {} });
      if (/\/rest\/v1\//.test(u)) return r.fulfill({ status: 200, json: [] });
      if (/\/api\//.test(u)) return r.fulfill({ status: 200, json: /mode=confidentialite/.test(u) ? { ok: true, uid: UID } : {} });
      if (u.startsWith(ORIG + '/')) return r.continue();
      return r.abort();
    });
    await pg.exposeFunction('__extMsg', (id, m) => { j.extMsgs.push({ id, m }); });
    await pg.addInitScript(({ session, ID, avant }) => {
      try {
        if (session) localStorage.setItem('vrm_session', JSON.stringify(session));
        if (avant) avant.forEach(([zone, k, v]) => (zone === 's' ? sessionStorage : localStorage).setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
      } catch (_) {}
      // Le canal adressé de l'extension (externally_connectable) : on note, et elle
      // répond « déjà connectée » (pas besoin d'une session).
      window.chrome = window.chrome || {};
      window.chrome.runtime = { sendMessage: (id, m, cb) => { try { window.__extMsg(id, m); } catch (_) {} setTimeout(() => cb && cb(m && m.type === 'liaison' ? { ok: true, besoin: false } : { ok: true }), 5); } };
    }, { session, ID, avant });
    await pg.goto(ORIG + chemin);
    await pg.waitForTimeout(attente);
    const etat = await pg.evaluate(() => ({
      href: location.href,
      lierS: sessionStorage.getItem('vrm_lier_extension'),
      lierL: localStorage.getItem('vrm_lier_extension_oauth'),
      pkceS: sessionStorage.getItem('vrm_pkce'),
      txt: document.body.innerText,
      mot: (document.querySelector('[data-lier-fournisseur-mot]') || {}).textContent || '',
      perime: !!document.querySelector('[data-lier-retour-perime]'),
      banniere: !!document.querySelector('[data-lier-connexion]'),
    }));
    if (capture && process.env.BANC_CAPTURES) await pg.screenshot({ path: path.join(process.env.BANC_CAPTURES, capture) });
    await ctx.close();
    return Object.assign(j, etat);
  }

  const ARRIVEE = (f) => `/?tab=plat_vinted&lier-extension=${ID}&connexion=${f}`;

  console.log('\n── Pas connecté, Google activé : départ direct');
  await essaie('A1', async () => {
    const r = await ouvrir(ARRIVEE('google'));
    const a = r.authorize[0] || '';
    dit(r.authorize.length === 1 && /\/auth\/v1\/authorize\?provider=google&/.test(a), 'A1 · un seul départ, vers authorize?provider=google, sans second clic', JSON.stringify(r.authorize));
    dit(/code_challenge=[A-Za-z0-9_-]{40,}/.test(a) && /code_challenge_method=s256/.test(a) && /redirect_to=/.test(a), 'A1 · en PKCE (code_challenge s256) et avec le retour vers VRM', a.slice(0, 200));
    dit(!/lier-extension|connexion=|access_token|refresh_token/.test(a), 'A1 · rien de la liaison ni aucun jeton dans l’adresse envoyée à Google', a.slice(0, 200));
    dit(!/connexion=|lier-extension/.test(r.href), 'A1 · `connexion` et `lier-extension` ont quitté l’adresse de VRM', r.href);
    dit(r.lierS && JSON.parse(r.lierS).id === ID && r.lierL && JSON.parse(r.lierL).id === ID && !!r.pkceS, 'A1 · la liaison est gardée (onglet + marque de retour 10 min), le vérificateur aussi', JSON.stringify({ s: r.lierS, l: r.lierL, pkce: !!r.pkceS }));
    dit(!r.erreurs.length, 'A1 · sans erreur', r.erreurs[0]);
  });

  console.log('\n── Pas connecté, Discord pas activé');
  await essaie('A2', async () => {
    const r = await ouvrir(ARRIVEE('discord'), { settings: { external: { google: true, discord: false } }, capture: 'oauth-app-discord-ferme.png' });
    dit(r.authorize.length === 0, 'A2 · aucun départ vers un fournisseur non activé', JSON.stringify(r.authorize));
    dit(/connexion avec Discord n.est pas encore ouverte/.test(r.mot) && /e-mail et ton mot de passe VRM/.test(r.mot), 'A2 · la phrase claire, avec le geste', r.mot);
    dit(r.banniere && /Continuer avec Google/.test(r.txt) && !/Continuer avec Discord/.test(r.txt), 'A2 · l’écran de connexion normal (Google seul proposé), la liaison annoncée', r.txt.replace(/\n/g, ' · ').slice(0, 200));
    dit(!/connexion=/.test(r.href), 'A2 · l’adresse est nettoyée', r.href);
  });
  await essaie('A2 bis — pas su', async () => {
    const r = await ouvrir(ARRIVEE('google'), { settings: null });
    dit(r.authorize.length === 0, 'A2 · réglages illisibles (pas su) : aucun départ', JSON.stringify(r.authorize));
  });

  console.log('\n── Fournisseur inconnu');
  await essaie('A3', async () => {
    const r = await ouvrir(ARRIVEE('facebook'));
    dit(r.authorize.length === 0 && !r.mot, 'A3 · `connexion=facebook` : rien ne part, aucune phrase', JSON.stringify(r.authorize));
    dit(!/connexion=/.test(r.href), 'A3 · et l’adresse est nettoyée', r.href);
    const s = await ouvrir(`/?tab=plat_vinted&connexion=google`);
    dit(s.authorize.length === 0, 'A3 · `connexion=google` SANS `lier-extension` : rien ne part', JSON.stringify(s.authorize));
  });

  console.log('\n── Déjà connecté : la liaison directe');
  await essaie('A4', async () => {
    const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeuse@exemple.test', app_metadata: { provider: 'google' } } };
    const r = await ouvrir(ARRIVEE('google'), { session: SESSION, attente: 6000 });
    dit(r.authorize.length === 0, 'A4 · connecté : on ne repart PAS chez Google', JSON.stringify(r.authorize));
    const m = r.extMsgs.find((x) => x.m && x.m.type === 'liaison');
    dit(!!m && m.id === ID && m.m.pour === UID, 'A4 · la liaison est demandée à CETTE extension, pour CE compte', JSON.stringify(r.extMsgs.slice(0, 3)));
    dit(!/connexion=|lier-extension/.test(r.href), 'A4 · l’adresse est nettoyée', r.href);
  });

  console.log('\n── Retour de Google dans un NOUVEL onglet');
  await essaie('A5', async () => {
    const r = await ouvrir('/?code=abc', { avant: [['l', 'vrm_lier_extension_oauth', { id: ID, at: Date.now() - 60000 }], ['l', 'vrm_pkce', { v: 'x'.repeat(64), at: Date.now() - 60000 }]] });
    dit(r.lierS && JSON.parse(r.lierS).id === ID, 'A5 · la liaison est retrouvée dans le nouvel onglet', String(r.lierS));
    dit(!r.lierL, 'A5 · et la marque est consommée (une fois)', String(r.lierL));
    const v = await ouvrir('/?code=abc', { avant: [['l', 'vrm_lier_extension_oauth', { id: ID, at: Date.now() - 11 * 60000 }]] });
    dit(!v.lierS && v.perime && /reclique « Continuer avec Google »/.test(v.txt), 'A5 · trop vieille : pas de liaison, la phrase dit le geste', v.txt.replace(/\n/g, ' · ').slice(0, 260));
    const n = await ouvrir('/?tab=plat_vinted', { avant: [['l', 'vrm_lier_extension_oauth', { id: ID, at: Date.now() - 60000 }]] });
    dit(!n.lierS && !!n.lierL, 'A5 · sans retour de Google (pas de `code`), la marque n’arme rien', JSON.stringify({ s: n.lierS, l: n.lierL }));
  });

  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} extension-oauth-app : ${ok} vert${ok > 1 ? 's' : ''}, ${ko} rouge${ko > 1 ? 's' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ le banc est tombé :', e && e.stack); process.exit(1); });
