// ════════════════════════════════════════════════════════════════════════════
//  BANC « DOUBLE VÉRIFICATION PROPOSÉE AU PROPRIÉTAIRE » (21 octobre).
//
//  Le compte propriétaire de l'installation (`proprietaire` rendu par
//  /api/compte?mode=abonnement, c'est-à-dire la base) qui n'a AUCUN facteur
//  TOTP vérifié voit au démarrage un écran qui lui propose d'activer la double
//  vérification (le panneau de Réglages). Le banc exige, à 390 px tactile ET à
//  1512 px :
//   A. propriétaire sans facteur : l'écran est proposé, l'activation y marche
//      (code faux refusé, bon code ⇒ « protégé »), « Fermer » le referme ;
//   B. « Plus tard » : refermé, pas reproposé après un rechargement, reproposé
//      quand la date rangée a plus de 7 jours ; AUCUN blocage (l'app est là) ;
//   C. un vendeur qui n'est PAS propriétaire : rien ;
//   D. propriétaire déjà protégé (code passé) : rien ;
//   E. facteurs illisibles (GoTrue /user muet) : rien (« pas su »).
//  Faux GoTrue repris de double-verification.cjs. Aucune fixture.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');   // jamais un chemin absolu (§6.1)
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 8611;
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
  down: false, rest: [], deletes: [], n: 0, proprio: false, userDown: false, abo: 0,
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
    if (chemin === 'user' && m === 'GET') { if (st.userDown) return route.fulfill({ status: 503, contentType: 'text/html', body: '<html>503</html>' }); return json(200, userJson(st)); }
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
  await ctx.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=confidentialite/.test(u)) return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,uid:USER.id})});
    if (/mode=abonnement/.test(u)) { st.abo++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: !!st.proprio, acces: true, obligatoire: false, configure: false }) }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
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
  if (taille === 390) { const l = await pg.$('[data-sous-ouvrir="double"]'); if (l) { await l.click(); await pg.waitForTimeout(400); } }
  return attendre(pg, '[data-mfa-panneau="inactive"], [data-mfa-panneau="active"], [data-mfa-panneau="passu"]', 10000);
}
const panneau = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-mfa-panneau]'); return e ? e.getAttribute('data-mfa-panneau') : null; });
const message = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-mfa-message]'); return e ? e.getAttribute('data-mfa-message') + ' : ' + e.innerText.slice(0, 90) : ''; });

const invite = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-invite-mfa]'); return e ? e.getAttribute('data-invite-mfa') : null; });
async function scenarios(nav, taille) {
  console.log(`\n══ ${taille} px`);
  console.log('── A. Propriétaire sans facteur : proposé, et l\'activation y marche');
  {
    const st = nouvelEtat(false); st.proprio = true;
    const ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await seConnecter(pg);
    const vu = await attendre(pg, '[data-invite-mfa="propose"]', 8000);
    dit(vu, "l'écran « Protège ton compte propriétaire » est proposé au démarrage");
    dit(await pg.evaluate(() => !!document.querySelector('[data-invite-mfa] [data-mfa-panneau="inactive"]')), 'il porte le panneau de Réglages (« désactivée », Activer)');
    if (vu) {
      const bt = await pg.evaluate(() => { const b = document.querySelector('[data-invite-mfa-plus-tard]'); if (!b) return 0; const r = b.getBoundingClientRect(); return Math.round(r.height); });
      dit(bt >= 44, '« Plus tard » se touche au doigt (≥ 44 px)', bt + ' px');
      await pg.click('[data-invite-mfa] [data-mfa-activer]').catch(() => {});
      dit(await attendre(pg, '[data-invite-mfa] img[data-mfa-qr]', 6000), 'le QR est affiché dans l\'écran');
      dit(await pg.locator('[data-mfa-qr]').evaluate(e=>e.complete && e.naturalWidth>0), 'le QR local est une image réellement lisible');
      dit(!(await pg.locator('[data-mfa-cle]').isVisible()), 'la clé secrète est masquée par défaut');
      const ancien=st.factors.find(f=>f.status!=='verified')?.id;
      await pg.click('[data-mfa-recommencer]');
      await pg.waitForTimeout(600);
      dit(!st.factors.some(f=>f.id===ancien) && st.factors.some(f=>f.status!=='verified'), 'remplacer annule l’ancien facteur et en crée un nouveau');
      await pg.fill('[data-mfa-code-activer]', CODE_FAUX); await pg.click('[data-mfa-confirmer]'); await pg.waitForTimeout(900);
      dit((await invite(pg)) === 'propose' && st.factors.filter((f) => f.status === 'verified').length === 0, 'un code faux n\'active rien');
      await pg.fill('[data-mfa-code-activer]', CODE_JUSTE); await pg.click('[data-mfa-confirmer]');
      dit(await attendre(pg, '[data-invite-mfa="active"]', 6000), 'le bon code : « Ton compte est protégé »');
      dit(st.factors.filter((f) => f.status === 'verified').length === 1, 'GoTrue a un facteur vérifié');
      await pg.click('[data-invite-mfa-fermer]').catch(() => {}); await pg.waitForTimeout(500);
      dit(!(await invite(pg)), '« Fermer » referme l\'écran');
      dit(await coeurMonte(pg), 'l\'app est là derrière');
    }
    await ctx.close();
  }
  console.log('── B. « Plus tard » : 7 jours sur l\'appareil, aucun blocage');
  {
    const st = nouvelEtat(false); st.proprio = true;
    const ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await seConnecter(pg);
    const vu = await attendre(pg, '[data-invite-mfa="propose"]', 8000);
    dit(vu, 'proposé');
    if (vu) {
      await pg.click('[data-invite-mfa-plus-tard]'); await pg.waitForTimeout(500);
      dit(!(await invite(pg)), '« Plus tard » referme');
      dit(await coeurMonte(pg) && st.rest.length > 0, 'aucun blocage : l\'app s\'ouvre et lit la base', st.rest.length + ' lecture(s)');
      const cle = await pg.evaluate(() => Object.keys(localStorage).find((k) => k.startsWith('vrm_mfa_plus_tard_')) || '');
      dit(!!cle, 'le report est rangé sur l\'appareil', cle);
      await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(5000);
      dit(!(await invite(pg)), 'rechargé : pas reproposé (moins de 7 jours)');
      await pg.evaluate((k) => localStorage.setItem(k, String(Date.now() - 8 * 86400000)), cle);
      await pg.reload({ waitUntil: 'domcontentloaded' });
      dit(await attendre(pg, '[data-invite-mfa="propose"]', 8000), 'au-delà de 7 jours : reproposé');
    }
    await ctx.close();
  }
  console.log('── C. Un vendeur qui n\'est pas propriétaire : rien');
  {
    const st = nouvelEtat(false); st.proprio = false;
    const ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await seConnecter(pg); await pg.waitForTimeout(2500);
    dit(st.abo > 0, 'l\'abonnement a bien été lu (le banc n\'est pas vacant)', st.abo + ' lecture(s)');
    dit(!(await invite(pg)) && await coeurMonte(pg), 'aucun écran de double vérification, l\'app s\'ouvre comme avant');
    await ctx.close();
  }
  console.log('── D. Propriétaire déjà protégé : rien');
  {
    const st = nouvelEtat(true); st.proprio = true;
    const ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await seConnecter(pg);
    if (await attendre(pg, '[data-porte-mfa="code"]', 6000)) { await pg.fill('[data-mfa-code]', CODE_JUSTE); await pg.click('[data-mfa-valider]'); }
    await pg.waitForTimeout(4500);
    dit(st.abo > 0 && !(await invite(pg)) && await coeurMonte(pg), 'code passé : aucun écran proposé', 'abo ' + st.abo);
    await ctx.close();
  }
  console.log('── E. Facteurs illisibles : rien n\'est proposé (pas su)');
  {
    const st = nouvelEtat(false); st.proprio = true;
    const ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await seConnecter(pg); st.userDown = true;
    await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(5000);
    dit(!(await invite(pg)) && await coeurMonte(pg), 'GoTrue /user muet : aucun écran, l\'app s\'ouvre');
    await ctx.close();
  }
}

(async () => {
  try { await ecouter(); } catch (e) { console.log('  ❌ ' + e.message); process.exit(1); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const t of [390, 1512]) {
      try { await scenarios(nav, t); } catch (e) { dit(false, `le banc a tourné jusqu'au bout (${t} px)`, String(e && e.message).slice(0, 200)); }
    }
  } finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ double vérification du propriétaire : ${ko} rouge(s)` : '\n✅ double vérification du propriétaire : tout est vert');
  process.exit(ko ? 1 : 0);
})();
