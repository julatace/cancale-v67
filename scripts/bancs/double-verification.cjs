require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « DOUBLE VÉRIFICATION » — la connexion en deux temps (TOTP), 16 octobre.
//
//  Fonction n° 17 retenue par Julien le 11 octobre. Un FAUX GoTrue sert l'API
//  MFA native de Supabase Auth, à la forme documentée :
//    POST /token (password, refresh_token) · GET /user (porte `factors`, absent
//    quand il n'y en a aucun — omitempty) · POST /factors · POST
//    /factors/{id}/challenge · POST /factors/{id}/verify (rend des jetons aal2)
//    · DELETE /factors/{id} (exige un jeton aal2 pour un facteur vérifié).
//  Le niveau `aal` vit dans le jeton (JWT, signature factice — l'app ne la
//  vérifie pas, Supabase le fait côté serveur).
//
//  Ce que le banc exige, à 390 px (tactile) ET à 1512 px :
//   A. sans double vérification : on se connecte comme avant (le cœur monte,
//      aucun écran de code) — et une session rangée AVANT cette fonction aussi ;
//   B. activer : QR + clé affichés, « activée » SEULEMENT après un premier code
//      juste ; un code faux est refusé et n'active rien ;
//   C. un compte qui l'a activée : après le mot de passe, l'écran du code, et
//      ZÉRO lecture de la base (`/rest/v1/`) tant qu'il n'est pas passé —
//      y compris après un rechargement (session restaurée) ; code faux refusé ;
//   D. désactiver : confirmation + code, DELETE avec un jeton aal2 ;
//   E. GoTrue injoignable : ni « activée », ni déconnexion, et on le dit.
//  Aucune fixture : tout est inventé, le banc vit dans le dépôt.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');   // jamais un chemin absolu (§6.1)
const PORT = Number(process.env.PORT) || 4981;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.zip':'application/zip', '.webmanifest':'application/manifest+json' };
const CODE_JUSTE = '123456', CODE_FAUX = '000000';
const USER = { id: '11111111-2222-3333-4444-555555555555', email: 'vendeur@exemple.fr' };
const COMPTE = { vinted_user_id: '900000001', login: 'compte-de-banc', access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString() };

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (aal) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: USER.id, email: USER.email, aal, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.signature-factice`;
const aalDe = (auth) => { try { return JSON.parse(Buffer.from(String(auth).replace(/^Bearer /, '').split('.')[1], 'base64').toString()).aal; } catch (_) { return null; } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const ecouter = () => new Promise((res, rej) => {
  srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est déjà pris — relance ce banc seul`) : e));
  srv.listen(PORT, () => res());
});

// L'état du faux GoTrue + le journal de ce qui part vers la base.
const nouvelEtat = (verifie) => ({
  factors: verifie ? [{ id: 'f-actif', factor_type: 'totp', status: 'verified', friendly_name: 'VRM', created_at: '2026-10-01T10:00:00Z' }] : [],
  down: false, rest: [], deletes: [], n: 0,
});
const userJson = (st) => Object.assign({ id: USER.id, email: USER.email, aud: 'authenticated' }, st.factors.length ? { factors: st.factors } : {});

async function brancher(ctx, st) {
  await ctx.route('**/auth/v1/**', async (route) => {
    const rq = route.request(), u = new URL(rq.url()), m = rq.method(), chemin = u.pathname.replace(/^.*\/auth\/v1\//, '');
    const json = (status, d) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (chemin === 'settings') return json(200, { external: {}, mailer_autoconfirm: true });
    if (st.down) return route.fulfill({ status: 503, contentType: 'text/html', body: '<html>503</html>' });
    let corps = {}; try { corps = JSON.parse(rq.postData() || '{}'); } catch (_) {}
    if (chemin === 'token') {
      const gt = u.searchParams.get('grant_type');
      const aal = gt === 'refresh_token' && String(corps.refresh_token || '').endsWith('aal2') ? 'aal2' : 'aal1';
      return json(200, { access_token: jwt(aal), refresh_token: 'r-' + aal, expires_in: 3600, token_type: 'bearer', user: userJson(st) });
    }
    if (chemin === 'user' && m === 'GET') return json(200, userJson(st));
    if (chemin === 'factors' && m === 'POST') {
      const id = 'f-neuf-' + (++st.n);
      st.factors.push({ id, factor_type: 'totp', status: 'unverified', friendly_name: corps.friendly_name || '' });
      return json(200, { id, type: 'totp', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="black"/></svg>', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/VRM:vendeur?secret=JBSWY3DPEHPK3PXP&issuer=VRM' } });
    }
    const mf = /^factors\/([^/]+)(?:\/(challenge|verify))?$/.exec(chemin);
    if (mf) {
      const fac = st.factors.find((x) => x.id === decodeURIComponent(mf[1]));
      if (!fac) return json(404, { code: 'mfa_factor_not_found', msg: 'Factor not found' });
      if (mf[2] === 'challenge') return json(200, { id: 'ch-' + (++st.n), type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300 });
      if (mf[2] === 'verify') {
        if (String(corps.code) !== CODE_JUSTE) return json(422, { code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' });
        fac.status = 'verified';
        return json(200, { access_token: jwt('aal2'), refresh_token: 'r-aal2', expires_in: 3600, token_type: 'bearer', user: userJson(st) });
      }
      if (m === 'DELETE') {
        const aal = aalDe(rq.headers().authorization);
        st.deletes.push({ id: fac.id, aal, status: fac.status });
        if (fac.status === 'verified' && aal !== 'aal2') return json(403, { code: 'insufficient_aal', msg: 'AAL2 required to delete verified factor' });
        st.factors = st.factors.filter((x) => x !== fac);
        return json(200, { id: fac.id });
      }
    }
    if (chemin === 'logout') return route.fulfill({ status: 204 });
    return json(404, { msg: 'banc : ' + chemin });
  });
  await ctx.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(route.request().url());
    // Seules comptent les lectures faites AU NOM du vendeur (son jeton) : les
    // sondes anonymes de l'écran de connexion (schéma, « la clé publique
    // lit-elle encore ? ») ne lisent rien de lui — RLS leur rend `[]`.
    if (aalDe(route.request().headers().authorization)) st.rest.push(u.replace(/^.*\/rest\/v1\//, '').slice(0, 80));
    const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/0' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return json([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json([{...COMPTE,owner:USER.id}]);
    return json([]);
  });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('mode=confidentialite')?{ok:true,uid:USER.id}:{}) }));
  await ctx.route('**://*.vinted.net/**', (r) => r.abort());
}

const ctxDe = async (nav, taille) => nav.newContext(taille === 390
  ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
  : { viewport: { width: 1512, height: 950 } });
const attendre = (pg, sel, ms = 12000) => pg.waitForSelector(sel, { timeout: ms }).then(() => true).catch(() => false);
const session = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_session') || 'null'); } catch (_) { return null; } });
const aalSession = (s) => { try { return JSON.parse(Buffer.from(s.access_token.split('.')[1], 'base64').toString()).aal; } catch (_) { return null; } };
const coeurMonte = (pg) => pg.evaluate(() => !document.querySelector('[data-porte-mfa]') && !document.querySelector('input[type=password]') && document.body.innerText.length > 200);

async function seConnecter(pg) {
  await pg.goto(`http://localhost:${PORT}/?connexion`, { waitUntil: 'domcontentloaded' });
  await attendre(pg, 'input[type=password]');
  await pg.fill('input[type=email]', USER.email);
  await pg.fill('input[type=password]', 'motdepasse42');
  await Promise.all([pg.waitForNavigation({ timeout: 15000 }).catch(() => {}), pg.click('form button[type=submit]')]);
  await pg.waitForTimeout(2500);
}
async function ouvrirPanneau(pg, taille) {
  await pg.goto(`http://localhost:${PORT}/?tab=settings&vue=compte`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2500);
  // (29 oct.) Le panneau est une ligne à ouvrir aux deux tailles (plus seulement au téléphone).
  { const l = await pg.$('[data-sous-ouvrir="double"]'); if (l && await l.isVisible()) { await l.click(); await pg.waitForTimeout(400); } }
  return attendre(pg, '[data-mfa-panneau="inactive"], [data-mfa-panneau="active"], [data-mfa-panneau="passu"]', 10000);
}
const panneau = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-mfa-panneau]'); return e ? e.getAttribute('data-mfa-panneau') : null; });
const message = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-mfa-message]'); return e ? e.getAttribute('data-mfa-message') + ' : ' + e.innerText.slice(0, 90) : ''; });

async function scenarios(nav, taille) {
  console.log(`\n══ ${taille} px`);
  // ── A. Sans double vérification : comme avant ─────────────────────────────
  console.log('── A. Un compte sans double vérification se connecte comme avant');
  {
    const st = nouvelEtat(false), ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await seConnecter(pg); await pg.waitForTimeout(2500);
    dit(!(await pg.$('[data-porte-mfa]')), 'aucun écran de code après le mot de passe');
    dit(await coeurMonte(pg), "l'app s'ouvre (le cœur est monté)");
    dit(st.rest.length > 0, 'la base est lue comme avant', st.rest.length + ' lecture(s)');
    await ctx.close();
  }
  {
    const st = nouvelEtat(false), ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    // Une session rangée AVANT cette fonction (pas de champ `totp`).
    await ctx.addInitScript((s) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} },
      { access_token: jwt('aal1'), refresh_token: 'r-aal1', expires_at: Date.now() + 3600e3, user: USER });
    const pg = await ctx.newPage();
    await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(5000);
    dit(await coeurMonte(pg), "une session d'avant cette fonction entre aussi, sans code");
    await ctx.close();
  }
  // ── B + D. Activer, puis désactiver ──────────────────────────────────────
  console.log('── B. Activer : QR, puis un premier code — « activée » seulement après');
  {
    const st = nouvelEtat(false), ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await seConnecter(pg);
    const vu = await ouvrirPanneau(pg, taille);
    dit(vu && (await panneau(pg)) === 'inactive', 'le panneau « Double vérification » dit « désactivée »', String(await panneau(pg)));
    if (vu) {
      await pg.click('[data-mfa-activer]').catch(() => {});
      const qr = await attendre(pg, 'img[data-mfa-qr]', 6000);
      dit(qr, 'le code QR est affiché');
      await pg.locator('[data-mfa-cle-manuelle] summary').click();
      const cle = await pg.evaluate(() => (document.querySelector('[data-mfa-cle]') || {}).innerText || '');
      dit(/JBSW\s?Y3DP/.test(cle), 'la clé à recopier est affichée', cle);
      dit((await panneau(pg)) === 'inactive', 'pas encore « activée » avant le premier code', String(await panneau(pg)));
      await pg.fill('[data-mfa-code-activer]', CODE_FAUX); await pg.click('[data-mfa-confirmer]'); await pg.waitForTimeout(900);
      dit((await panneau(pg)) === 'inactive' && /^err/.test(await message(pg)), 'un code faux est refusé et n’active rien', await message(pg));
      await pg.fill('[data-mfa-code-activer]', CODE_JUSTE); await pg.click('[data-mfa-confirmer]');
      const ok = await attendre(pg, '[data-mfa-panneau="active"]', 6000);
      dit(ok, 'le bon code active la double vérification', await message(pg));
      const s = await session(pg);
      dit(s && aalSession(s) === 'aal2' && Array.isArray(s.totp) && s.totp.length === 1, 'la session passe en aal2 et connaît le facteur', s ? `${aalSession(s)} · totp ${JSON.stringify(s.totp)}` : 'pas de session');
      dit(st.factors.filter((f) => f.status === 'verified').length === 1, 'GoTrue a bien un facteur vérifié');

      console.log('── D. Désactiver : confirmation + code, DELETE en aal2');
      await pg.click('[data-mfa-desactiver]').catch(() => {});
      const cf = await attendre(pg, '[data-mfa-code-desactiver]', 4000);
      dit(cf, 'une confirmation avec code est demandée');
      if (cf) {
        await pg.fill('[data-mfa-code-desactiver]', CODE_FAUX); await pg.click('[data-mfa-confirmer-off]'); await pg.waitForTimeout(900);
        dit((await panneau(pg)) === 'active' && st.factors.length === 1, 'un code faux ne désactive rien', await message(pg));
        await pg.fill('[data-mfa-code-desactiver]', CODE_JUSTE); await pg.click('[data-mfa-confirmer-off]');
        const off = await attendre(pg, '[data-mfa-panneau="inactive"]', 6000);
        dit(off && st.factors.length === 0, 'le bon code désactive (facteur supprimé chez GoTrue)', await message(pg));
        dit(st.deletes.some((d) => d.status === 'verified' && d.aal === 'aal2'), 'la suppression est partie avec un jeton aal2', JSON.stringify(st.deletes));
      }
    }
    await ctx.close();
  }
  // ── C. Un compte qui l'a activée ─────────────────────────────────────────
  console.log('── C. Compte protégé : le code avant toute lecture');
  {
    const st = nouvelEtat(true), ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await seConnecter(pg);
    const porte = await attendre(pg, '[data-porte-mfa="code"]', 6000);
    await pg.waitForTimeout(2500);
    dit(porte, "l'écran « Code de ton app d'authentification » s'affiche après le mot de passe");
    dit(st.rest.length === 0, 'ZÉRO lecture de la base avant le code', st.rest.length + ' : ' + st.rest.slice(0, 4).join(' | '));
    const perdu = await pg.evaluate(() => (document.querySelector('[data-mfa-perdu]') || {}).innerText || '');
    dit(/perdu/i.test(perdu) && /(contact|@)/i.test(perdu), "l'écran dit quoi faire en cas de téléphone perdu (le contact de VRM)", perdu.slice(0, 120));
    // Session restaurée au rechargement : toujours la porte.
    await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3500);
    dit(!!(await pg.$('[data-porte-mfa="code"]')) && st.rest.length === 0, 'session restaurée (rechargement) : toujours le code, toujours zéro lecture', st.rest.length + ' lecture(s)');
    if (porte) {
      await pg.fill('[data-mfa-code]', CODE_FAUX); await pg.click('[data-mfa-valider]'); await pg.waitForTimeout(900);
      dit(!!(await pg.$('[data-mfa-erreur]')) && !!(await pg.$('[data-porte-mfa]')) && st.rest.length === 0, 'un code faux est refusé, la porte reste fermée', st.rest.length + ' lecture(s)');
      await pg.fill('[data-mfa-code]', CODE_JUSTE); await pg.click('[data-mfa-valider]');
      await pg.waitForTimeout(4000);
      dit(!(await pg.$('[data-porte-mfa]')) && st.rest.length > 0, "le bon code ouvre l'app, et alors seulement la base est lue", st.rest.length + ' lecture(s)');
      const s = await session(pg);
      dit(s && aalSession(s) === 'aal2', 'la session est en aal2', s ? aalSession(s) : '');
    }
    await ctx.close();
  }
  // ── E. GoTrue injoignable ────────────────────────────────────────────────
  console.log('── E. Service de connexion injoignable : on le dit, sans activer ni déconnecter');
  {
    // E1. pendant la confirmation d'activation
    const st = nouvelEtat(false), ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await seConnecter(pg);
    if (await ouvrirPanneau(pg, taille)) {
      await pg.click('[data-mfa-activer]').catch(() => {});
      await attendre(pg, '[data-mfa-code-activer]', 6000);
      st.down = true;
      await pg.fill('[data-mfa-code-activer]', CODE_JUSTE).catch(() => {}); await pg.click('[data-mfa-confirmer]').catch(() => {}); await pg.waitForTimeout(1500);
      dit((await panneau(pg)) !== 'active' && /^passu/.test(await message(pg)), "activation pendant la panne : pas « activée », et c'est dit", (await panneau(pg)) + ' · ' + (await message(pg)));
      dit(!!(await session(pg)), 'toujours connecté');
    } else dit(false, 'le panneau « Double vérification » est là');
    await ctx.close();
  }
  {
    // E2. sur l'écran du code
    const st = nouvelEtat(true), ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await seConnecter(pg);
    if (await attendre(pg, '[data-porte-mfa="code"]', 6000)) {
      st.down = true;
      await pg.fill('[data-mfa-code]', CODE_JUSTE); await pg.click('[data-mfa-valider]'); await pg.waitForTimeout(1500);
      dit(!!(await pg.$('[data-mfa-injoignable]')) && !!(await pg.$('[data-porte-mfa]')), "code pendant la panne : « le service ne répond pas », la porte reste");
      dit(!!(await session(pg)) && !(await pg.$('input[type=password]')), "pas déconnecté (pas renvoyé à l'écran du mot de passe)");
      st.down = false;
      await pg.click('[data-mfa-valider]'); await pg.waitForTimeout(4000);
      dit(!(await pg.$('[data-porte-mfa]')), "la panne finie, « Réessayer » avec le même code ouvre l'app");
    } else dit(false, "l'écran du code s'affiche");
    await ctx.close();
  }
  {
    // E3. session d'avant cette fonction, on ne sait pas s'il faut un code
    const st = nouvelEtat(true), ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    st.down = true;
    await ctx.addInitScript((s) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} },
      { access_token: jwt('aal1'), refresh_token: 'r-aal1', expires_at: Date.now() + 3600e3, user: USER });
    const pg = await ctx.newPage();
    await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(4000);
    dit(!!(await pg.$('[data-porte-mfa="verifier"][data-mfa-passu="1"]')) && !!(await pg.$('[data-mfa-reessayer]')), "« je n'ai pas pu savoir s'il faut un code » + Réessayer");
    dit(st.rest.length === 0 && !!(await session(pg)), 'aucune lecture, et pas déconnecté', st.rest.length + ' lecture(s)');
    st.down = false;
    await pg.click('[data-mfa-reessayer]').catch(() => {}); await pg.waitForTimeout(1500);
    dit(!!(await pg.$('[data-porte-mfa="code"]')), 'le service revenu : on sait qu’il faut un code, il est demandé');
    await ctx.close();
  }
}

(async () => {
  try { await ecouter(); } catch (e) { console.log('  ❌ ' + e.message); process.exit(1); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const t of [390, 1512]) {
      try { await scenarios(nav, t); } catch (e) { dit(false, `le banc a tourné jusqu'au bout (${t} px)`, String(e && e.message).slice(0, 200)); }
    }
  } finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ double vérification : ${ko} rouge(s)` : '\n✅ double vérification : tout est vert');
  process.exit(ko ? 1 : 0);
})();
