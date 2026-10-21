// ════════════════════════════════════════════════════════════════════════════
//  BANC « VÉRIFICATION ANTI-ROBOT » (Cloudflare Turnstile + GoTrue) — 20 octobre.
//
//  Un FAUX GoTrue qui applique la règle de Supabase quand la protection captcha
//  est allumée (lue dans le code de GoTrue : `verifyCaptcha` sur /signup,
//  /token?grant_type=password, /otp, /magiclink, /recover, /resend ; jeton dans
//  `gotrue_meta_security.captcha_token` ; refresh_token / pkce exemptés) — un
//  jeton absent, inconnu ou DÉJÀ servi est refusé. Et un FAUX Turnstile servi à
//  la place de challenges.cloudflare.com (`turnstile.render/reset/remove`, le
//  rappel `onload=` de l'adresse, les rappels `callback`, `before-interactive-
//  callback`, `error-callback`).
//
//  Ce que le banc exige, à 390 px (tactile) ET à 1512 px :
//   A. clé de site VIDE (le build normal, `dist/`) : aucun widget, AUCUNE
//      requête vers Cloudflare, connexion et inscription comme avant, et aucun
//      `gotrue_meta_security` dans les corps envoyés ;
//   B. clé posée (build avec VITE_TURNSTILE_SITE_KEY) : le widget est là, et le
//      jeton part sur les CINQ appels (connexion, inscription, mot de passe
//      oublié, lien de connexion, renvoi de l'email) — un jeton neuf à chaque
//      fois (usage unique) ; GoTrue les accepte tous ;
//   C. défi interactif : tant qu'il n'est pas coché, le bouton est grisé et DIT
//      quoi faire, aucun appel ne part ; coché ⇒ la connexion passe ;
//   D. Cloudflare injoignable : un message clair + « Réessayer », bouton grisé
//      qui le dit ; Cloudflare revenu ⇒ « Réessayer » remet le widget.
//  Aucune fixture : tout est inventé, le banc vit dans le dépôt.
//
//  Le build « clé posée » est fait par le banc lui-même (vite build --outDir
//  dans le dossier temporaire), à partir des sources de l'arbre où il est.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const { cspBanc, bilanCsp } = require('./_vercel.cjs');   // CSP de vercel.json servie et observée (21 oct.)
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');

const RACINE = path.join(__dirname, '..', '..');
const DIST = path.join(RACINE, 'dist');   // jamais un chemin absolu (§6.1)
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 7421;
const CLE_SITE = '1x00000000000000000000AA';   // clé de TEST publiée par Cloudflare
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.zip':'application/zip', '.webmanifest':'application/manifest+json' };
const USER = { id: '11111111-2222-3333-4444-555555555555', email: 'vendeur@exemple.fr' };
const ATTENTE = 'attente@exemple.fr';   // compte dont l'email n'est pas confirmé
const COMPTE = { vinted_user_id: '900000001', login: 'compte-de-banc', access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString() };

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

// ── Le build « clé posée » ───────────────────────────────────────────────────
const DIST_CAPTCHA = path.join(os.tmpdir(), `vrm-banc-captcha-${process.pid}`);
function construireAvecCle() {
  console.log('… build avec une clé de site Turnstile (VITE_TURNSTILE_SITE_KEY)');
  execFileSync(process.execPath, [path.join(path.dirname(require.resolve('vite/package.json', { paths: [RACINE] })), 'bin', 'vite.js'), 'build', '--outDir', DIST_CAPTCHA, '--emptyOutDir'],
    { cwd: RACINE, env: { ...process.env, VITE_TURNSTILE_SITE_KEY: CLE_SITE }, stdio: ['ignore', 'ignore', 'inherit'] });
}

let racineServie = DIST;
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(racineServie, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const ecouter = () => new Promise((res, rej) => {
  srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est déjà pris — relance avec BANC_PORT=…`) : e));
  srv.listen(PORT, () => res());
});

// ── Le faux Turnstile (servi à la place de challenges.cloudflare.com) ────────
// mode 'auto' : un jeton arrive tout seul (défi invisible) ; 'interactif' : il
// faut cocher la case [data-faux-turnstile] — exactement ce que fait le vrai.
const fauxTurnstile = (onload, mode) => `
(function(){
  var n = 0, widgets = {};
  function jeton(){ return 'tok-' + Date.now().toString(36) + '-' + (++n); }
  function lancer(id){
    var w = widgets[id]; if (!w) return;
    w.el.innerHTML = '';
    var b = document.createElement('label');
    b.setAttribute('data-faux-turnstile', '${mode}');
    b.style.cssText = 'display:block;border:1px solid #888;padding:14px;font:14px sans-serif';
    b.textContent = 'Faux Turnstile';
    w.el.appendChild(b);
    if ('${mode}' === 'interactif') {
      w.o['before-interactive-callback'] && w.o['before-interactive-callback']();
      b.addEventListener('click', function(){ b.setAttribute('data-coche',''); w.o.callback(jeton()); });
    } else setTimeout(function(){ if (widgets[id]) w.o.callback(jeton()); }, 250);
  }
  window.turnstile = {
    render: function(el, o){ var id = 'w' + (++n); window.__cleVue = o.sitekey; widgets[id] = { el: el, o: o }; lancer(id); return id; },
    reset: function(id){ lancer(id); },
    remove: function(id){ var w = widgets[id]; if (w) w.el.innerHTML = ''; delete widgets[id]; }
  };
  ${onload ? `window['${onload}'] && window['${onload}']();` : ''}
})();`;

const nouvelEtat = (opts = {}) => ({ captchaExige: !!opts.captchaExige, mode: opts.mode || 'auto', bloque: !!opts.bloque,
  cf: 0, vus: new Set(), appels: [], refus: [], rest: 0 });

async function brancher(ctx, st) {
  await ctx.route('**://challenges.cloudflare.com/**', (route) => {
    st.cf++;
    if (st.bloque) return route.abort();
    const onload = new URL(route.request().url()).searchParams.get('onload') || '';
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: fauxTurnstile(onload, st.mode) });
  });
  await ctx.route('**/auth/v1/**', async (route) => {
    const rq = route.request(), u = new URL(rq.url()), m = rq.method(), chemin = u.pathname.replace(/^.*\/auth\/v1\//, '');
    const json = (status, d) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (chemin === 'settings') return json(200, { external: {}, mailer_autoconfirm: true });
    let corps = {}; try { corps = JSON.parse(rq.postData() || '{}'); } catch (_) {}
    const gt = u.searchParams.get('grant_type');
    const protege = ['signup', 'otp', 'magiclink', 'recover', 'resend'].includes(chemin) || (chemin === 'token' && gt === 'password');
    const jeton = corps && corps.gotrue_meta_security && corps.gotrue_meta_security.captcha_token;
    const nom = chemin === 'token' ? 'token:' + gt : chemin;
    if (protege) st.appels.push({ nom, jeton: jeton || null, a: 'gotrue_meta_security' in corps });
    if (protege && st.captchaExige) {
      if (!jeton) { st.refus.push(nom + ' sans jeton'); return json(400, { code: 400, error_code: 'captcha_failed', msg: 'captcha protection: request disallowed (no captcha response)' }); }
      if (st.vus.has(jeton) || !/^tok-/.test(jeton)) { st.refus.push(nom + ' jeton rejoué'); return json(400, { code: 400, error_code: 'captcha_failed', msg: 'captcha protection: request disallowed (timeout-or-duplicate)' }); }
      st.vus.add(jeton);
    }
    if (chemin === 'token') {
      if (gt === 'password' && corps.email === ATTENTE) return json(400, { error: 'invalid_grant', error_description: 'Email not confirmed' });
      return json(200, { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: USER.id, aal: 'aal1' })).toString('base64') + '.s', refresh_token: 'r', expires_in: 3600, token_type: 'bearer', user: { id: USER.id, email: USER.email } });
    }
    if (chemin.startsWith('signup')) return json(200, { id: 'u-neuf', email: corps.email });
    if (['otp', 'recover', 'resend', 'magiclink'].includes(chemin)) return json(200, {});
    if (chemin === 'user') return json(200, { id: USER.id, email: USER.email });
    if (chemin === 'logout') return route.fulfill({ status: 204 });
    return json(404, { msg: 'banc : ' + chemin });
  });
  await ctx.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(route.request().url());
    st.rest++;
    const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/0' }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json([COMPTE]);
    return json([]);
  });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('**://*.vinted.net/**', (r) => r.abort());
}

const ctxDe = async (nav, taille) => { const ctx = await nav.newContext(taille === 390
  ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
  : { viewport: { width: 1512, height: 950 } });
  await cspBanc(ctx, `http://localhost:${PORT}`, 'captcha ' + taille); return ctx; };
const attendre = (pg, sel, ms = 10000) => pg.waitForSelector(sel, { timeout: ms }).then(() => true).catch(() => false);
const statut = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-captcha]'); return e ? e.getAttribute('data-captcha') : null; });
const bouton = (pg) => pg.evaluate(() => { const b = document.querySelector('form button[type=submit]'); return b ? { off: b.disabled, txt: b.innerText.trim() } : null; });
const texte = (pg) => pg.evaluate(() => document.body.innerText);
const clic = (pg, sel) => pg.click(sel, { timeout: 4000 }).then(() => true).catch(() => false);
const clicTexte = (pg, t) => pg.getByRole('button', { name: t }).first().click({ timeout: 4000 }).then(() => true).catch(() => false);
const attendrePret = (pg) => pg.waitForFunction(() => { const e = document.querySelector('[data-captcha]'); return e && e.getAttribute('data-captcha') === 'pret'; }, null, { timeout: 8000 }).then(() => true).catch(() => false);
const sansDebord = (pg) => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function remplir(pg, email, pw) {
  await pg.fill('input[type=email]', email);
  if (pw !== undefined) await pg.fill('input[type=password]', pw);
}

async function scenarios(nav, taille) {
  console.log(`\n══ ${taille} px`);
  // ── A. Clé vide : rien ne change ──────────────────────────────────────────
  racineServie = DIST;
  console.log('── A. Clé de site vide : aucun widget, connexion et inscription comme avant');
  {
    const st = nouvelEtat({ captchaExige: false }), ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await pg.goto(`http://localhost:${PORT}/?inscription`, { waitUntil: 'domcontentloaded' });
    await attendre(pg, 'input[type=password]');
    await pg.waitForTimeout(800);
    dit(!(await pg.$('[data-captcha]')), 'aucun widget anti-robot sur le formulaire');
    await remplir(pg, 'neuf@exemple.fr', 'motdepasse42');
    await clic(pg, 'form button[type=submit]'); await pg.waitForTimeout(1200);
    const insc = st.appels.find((a) => a.nom.startsWith('signup'));
    dit(!!insc && !insc.a, "l'inscription part comme avant, sans `gotrue_meta_security`", JSON.stringify(insc));
    await pg.goto(`http://localhost:${PORT}/?connexion`, { waitUntil: 'domcontentloaded' });
    await attendre(pg, 'input[type=password]');
    await remplir(pg, USER.email, 'motdepasse42');
    await Promise.all([pg.waitForNavigation({ timeout: 12000 }).catch(() => {}), clic(pg, 'form button[type=submit]')]);
    await pg.waitForTimeout(2500);
    const cnx = st.appels.find((a) => a.nom === 'token:password');
    dit(!!cnx && !cnx.a, 'la connexion part comme avant, sans `gotrue_meta_security`', JSON.stringify(cnx));
    dit(!(await pg.$('input[type=password]')) && st.rest > 0, "l'app s'ouvre après la connexion");
    dit(st.cf === 0, 'AUCUNE requête vers challenges.cloudflare.com', st.cf + ' requête(s)');
    await ctx.close();
  }

  // ── B. Clé posée : le jeton part sur les cinq appels ─────────────────────
  racineServie = DIST_CAPTCHA;
  console.log('── B. Clé posée : widget présent, jeton neuf sur chaque appel protégé');
  {
    const st = nouvelEtat({ captchaExige: true }), ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    // Inscription
    await pg.goto(`http://localhost:${PORT}/?inscription`, { waitUntil: 'domcontentloaded' });
    await attendre(pg, 'input[type=password]');
    dit(await attendre(pg, '[data-captcha]', 6000), 'le widget anti-robot est sur le formulaire');
    dit(await attendrePret(pg), 'le défi invisible se valide tout seul (jeton reçu)', String(await statut(pg)));
    dit(await pg.evaluate(() => window.__cleVue) === '1x00000000000000000000AA', 'le widget reçoit la clé de site posée');
    await remplir(pg, 'neuf@exemple.fr', 'motdepasse42');
    await clic(pg, 'form button[type=submit]'); await pg.waitForTimeout(1200);
    // Mot de passe oublié
    await attendrePret(pg);
    await clicTexte(pg, 'J\'ai déjà un compte'); await pg.waitForTimeout(300);
    await clicTexte(pg, 'Mot de passe oublié ?'); await pg.waitForTimeout(300);
    await attendrePret(pg);
    await pg.fill('input[type=email]', USER.email);
    await clic(pg, 'form button[type=submit]'); await pg.waitForTimeout(1200);
    const infoReset = /Si un compte existe/.test(await texte(pg));
    // Connexion d'un compte pas confirmé ⇒ lien de connexion + renvoi de l'email
    await clicTexte(pg, 'Retour'); await pg.waitForTimeout(300);
    await attendrePret(pg);
    await remplir(pg, ATTENTE, 'motdepasse42');
    await clic(pg, 'form button[type=submit]'); await pg.waitForTimeout(1200);
    await attendrePret(pg);
    await clicTexte(pg, 'Recevoir un lien de connexion'); await pg.waitForTimeout(1200);
    await attendrePret(pg);
    await clicTexte(pg, "Renvoyer l'email"); await pg.waitForTimeout(1200);
    // Connexion réussie
    await attendrePret(pg);
    await remplir(pg, USER.email, 'motdepasse42');
    await Promise.all([pg.waitForNavigation({ timeout: 12000 }).catch(() => {}), clic(pg, 'form button[type=submit]')]);
    await pg.waitForTimeout(2500);
    const noms = st.appels.map((a) => a.nom.replace(/\?.*$/, ''));
    for (const n of ['signup', 'recover', 'token:password', 'otp', 'resend']) {
      const a = st.appels.filter((x) => x.nom.replace(/\?.*$/, '') === n);
      dit(a.length > 0 && a.every((x) => x.jeton && /^tok-/.test(x.jeton)), `« ${n} » porte gotrue_meta_security.captcha_token`, a.map((x) => x.jeton).join(', ') || 'appel absent');
    }
    const jetons = st.appels.map((a) => a.jeton).filter(Boolean);
    dit(jetons.length === new Set(jetons).size, 'un jeton neuf à chaque appel (jamais rejoué)', jetons.length + ' jeton(s)');
    dit(st.refus.length === 0, 'GoTrue (protection allumée) a tout accepté', st.refus.join(' · ') || 'aucun refus');
    dit(infoReset, '« mot de passe oublié » répond comme avant');
    dit(!(await pg.$('input[type=password]')) && st.rest > 0, "la connexion ouvre l'app", noms.join(','));
    await ctx.close();
  }

  // ── C. Défi interactif : le bouton dit d'attendre ─────────────────────────
  console.log('── C. Défi à cocher : bouton grisé qui le dit, aucun appel avant');
  {
    const st = nouvelEtat({ captchaExige: true, mode: 'interactif' }), ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await pg.goto(`http://localhost:${PORT}/?connexion`, { waitUntil: 'domcontentloaded' });
    await attendre(pg, 'input[type=password]');
    await attendre(pg, '[data-faux-turnstile]', 6000);
    await remplir(pg, USER.email, 'motdepasse42');
    const b = await bouton(pg);
    dit(b && b.off && /coche|vérification/i.test(b.txt), 'sans jeton, le bouton est grisé et dit de cocher la vérification', JSON.stringify(b));
    await pg.click('form button[type=submit]', { force: true, timeout: 2000 }).catch(() => {}); await pg.waitForTimeout(600);
    dit(st.appels.length === 0, 'aucun appel de connexion ne part sans jeton', st.appels.length + ' appel(s)');
    dit(await sansDebord(pg), 'rien ne déborde');
    await clic(pg, '[data-faux-turnstile]'); await pg.waitForTimeout(300);
    const b2 = await bouton(pg);
    dit(b2 && !b2.off && /Se connecter/.test(b2.txt), 'coché ⇒ le bouton redevient « Se connecter »', JSON.stringify(b2));
    await Promise.all([pg.waitForNavigation({ timeout: 12000 }).catch(() => {}), clic(pg, 'form button[type=submit]')]);
    await pg.waitForTimeout(2000);
    dit(st.appels.length === 1 && st.appels[0].jeton && st.refus.length === 0, 'la connexion passe avec le jeton', JSON.stringify(st.appels));
    await ctx.close();
  }

  // ── D. Cloudflare injoignable ─────────────────────────────────────────────
  console.log('── D. Cloudflare injoignable : message clair, puis « Réessayer »');
  {
    const st = nouvelEtat({ captchaExige: true, bloque: true }), ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await pg.goto(`http://localhost:${PORT}/?connexion`, { waitUntil: 'domcontentloaded' });
    await attendre(pg, 'input[type=password]');
    const err = await attendre(pg, '[data-captcha-erreur]', 15000);
    const t = err ? await pg.evaluate(() => document.querySelector('[data-captcha-erreur]').innerText) : '';
    dit(err && /challenges\.cloudflare\.com/.test(t) && /bloqueur|réseau/i.test(t), 'le message dit ce qui bloque et quoi faire', t.slice(0, 110));
    const b = await bouton(pg);
    dit(b && b.off && /indisponible/i.test(b.txt), 'le bouton est grisé et dit pourquoi (jamais muet)', JSON.stringify(b));
    const r = await pg.evaluate(() => { const e = document.querySelector('[data-captcha-reessayer]'); if (!e) return 0; const x = e.getBoundingClientRect(); return Math.round(x.height); });
    dit(r >= 44, '« Réessayer » se touche au doigt (44 px)', r + ' px');
    dit(await sansDebord(pg), 'rien ne déborde');
    st.bloque = false;
    await clic(pg, '[data-captcha-reessayer]');
    dit(await attendrePret(pg), 'Cloudflare revenu : « Réessayer » remet le widget et le jeton arrive', String(await statut(pg)));
    await ctx.close();
  }
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('dist/ absent — lance `npm run build` d’abord'); process.exit(2); }
  try { construireAvecCle(); } catch (e) { console.error('build avec clé impossible : ' + e.message); process.exit(2); }
  await ecouter();
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const t of [390, 1512]) {
      try { await scenarios(nav, t); } catch (e) { dit(false, `scénarios ${t} px`, e.message); }
    }
  } finally {
    await nav.close(); srv.close();
    try { fs.rmSync(DIST_CAPTCHA, { recursive: true, force: true }); } catch (_) {}
  }
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) en échec' : '✅ tout est vert'}`);
  ko += bilanCsp();
  process.exit(ko ? 1 : 0);
})();
