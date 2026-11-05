require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « DOUBLE VÉRIFICATION — PLUSIEURS APPAREILS » (22 octobre).
//
//  ⛔ Décision de Julien : PAS de SMS (payant). Le chemin de secours GRATUIT est
//  un SECOND APPAREIL d'authentification (un second facteur TOTP — GoTrue en
//  accepte plusieurs ; le code de n'importe lequel fait passer en aal2).
//
//  Un FAUX GoTrue à la forme documentée, mais plus exigeant que celui de
//  `double-verification.cjs` sur ce qui compte ici :
//   · chaque appareil a SON code (le code du téléphone est faux pour l'iPad) ;
//   · `friendly_name` unique par compte (422 `mfa_factor_name_conflict`) ;
//   · ajouter un facteur quand un autre est vérifié exige aal2 (403) ;
//   · un facteur inconnu répond 404 au défi ; un 429 quand on dépasse la limite ;
//   · supprimer un facteur vérifié exige aal2.
//
//  Ce que le banc exige, à 390 px (tactile) ET à 1512 px :
//   A. deux appareils, il n'a plus que le SECOND : l'écran du code les nomme,
//      dit « celui de n'importe lequel », et le code du second OUVRE l'app (zéro
//      lecture de la base avant) ;
//   B. une liste d'appareils périmée (un appareil retiré ailleurs) : UN seul
//      envoi du bon code ouvre l'app ;
//   C. 429 : « trop d'essais », jamais « ce code ne correspond pas » ;
//   D. Réglages, un seul appareil : la liste le nomme (jamais « VRM 2026-… »),
//      propose un appareil de secours, refuse un nom déjà pris SANS rien créer,
//      crée le second sous SON nom (en aal2), ne l'ajoute qu'après SON code ;
//   E. téléphone perdu : on le retire avec le code de l'iPad — l'iPad reste, le
//      téléphone part, et le code faux ne retire rien ;
//   F. service injoignable pendant l'ajout : rien d'ajouté, c'est dit ;
//   G. aucune proposition de SMS (décision de Julien), aucun débordement.
//   H. retirer un appareil qui n'existe déjà plus (retiré depuis un autre appareil :
//      404 ; ou retrait fait dont la réponse s'est perdue : 503) : jamais « reste
//      enregistré », jamais un formulaire « désactiver » pour l'appareil disparu,
//      la liste relue (l'appareil qui reste) est montrée.
//  Aucune fixture : tout est inventé, le banc vit dans le dépôt.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');   // jamais un chemin absolu (§6.1)
const PORT = Number(process.env.PORT || process.env.BANC_PORT) || 6251;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.zip':'application/zip', '.webmanifest':'application/manifest+json' };
const USER = { id: '22222222-3333-4444-5555-666666666666', email: 'vendeuse@exemple.fr' };
const COMPTE = { vinted_user_id: '900000002', login: 'compte-de-banc', access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString() };
const CODE_TEL = '111111', CODE_IPAD = '222222', CODE_NEUF = '333333', CODE_FAUX = '000000';

let ko = 0, n = 0;
const dit = (bon, quoi, detail) => { n++; if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

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

// L'état du faux GoTrue. `codes` : le code de CHAQUE facteur (un vrai TOTP a sa
// propre clé : le code du téléphone ne vaut rien pour l'iPad).
const TEL = { id: 'f-tel', factor_type: 'totp', status: 'verified', friendly_name: 'VRM 2026-10-16T10:00', created_at: '2026-10-16T10:00:00Z' };
const IPAD = { id: 'f-ipad', factor_type: 'totp', status: 'verified', friendly_name: 'iPad', created_at: '2026-10-20T09:00:00Z' };
const nouvelEtat = (facteurs) => ({
  factors: facteurs.map((x) => ({ ...x })), codes: { 'f-tel': CODE_TEL, 'f-ipad': CODE_IPAD },
  down: false, limite: Infinity, verifs: [], enrolls: [], deletes: [], rest: [], n: 0,
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
    const aal = aalDe(rq.headers().authorization);
    if (chemin === 'token') {
      const gt = u.searchParams.get('grant_type');
      const niv = gt === 'refresh_token' && String(corps.refresh_token || '').endsWith('aal2') ? 'aal2' : 'aal1';
      return json(200, { access_token: jwt(niv), refresh_token: 'r-' + niv, expires_in: 3600, token_type: 'bearer', user: userJson(st) });
    }
    if (chemin === 'user' && m === 'GET') return json(200, userJson(st));
    if (chemin === 'factors' && m === 'POST') {
      st.enrolls.push({ nom: corps.friendly_name, aal });
      if (st.factors.some((x) => x.status === 'verified') && aal !== 'aal2') return json(403, { code: 'insufficient_aal', msg: 'AAL2 required to enroll a new factor' });
      if (corps.friendly_name && st.factors.some((x) => x.friendly_name === corps.friendly_name)) return json(422, { code: 'mfa_factor_name_conflict', msg: `A factor with the friendly name "${corps.friendly_name}" for this user already exists` });
      const id = 'f-neuf-' + (++st.n);
      st.factors.push({ id, factor_type: 'totp', status: 'unverified', friendly_name: corps.friendly_name || '', created_at: new Date().toISOString() });
      st.codes[id] = CODE_NEUF;
      return json(200, { id, type: 'totp', friendly_name: corps.friendly_name, totp: { qr_code: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="black"/></svg>', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/VRM:vendeuse?secret=JBSWY3DPEHPK3PXP&issuer=VRM' } });
    }
    const mf = /^factors\/([^/]+)(?:\/(challenge|verify))?$/.exec(chemin);
    if (mf) {
      const fac = st.factors.find((x) => x.id === decodeURIComponent(mf[1]));
      if (mf[2] && st.verifs.length >= st.limite) return json(429, { code: 'over_request_rate_limit', msg: 'Too many requests' });
      if (!fac) { if (mf[2] === 'verify') st.verifs.push({ id: decodeURIComponent(mf[1]), ok: false }); return json(404, { code: 'mfa_factor_not_found', msg: 'Factor not found' }); }
      if (mf[2] === 'challenge') return json(200, { id: 'ch-' + (++st.n), type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 300 });
      if (mf[2] === 'verify') {
        const bon = String(corps.code) === st.codes[fac.id];
        st.verifs.push({ id: fac.id, ok: bon });
        if (!bon) return json(422, { code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' });
        fac.status = 'verified';
        return json(200, { access_token: jwt('aal2'), refresh_token: 'r-aal2', expires_in: 3600, token_type: 'bearer', user: userJson(st) });
      }
      if (m === 'DELETE') {
        // « Réponse perdue » : GoTrue retire bien l'appareil, puis la réponse
        // n'arrive pas (une passerelle répond 503 — les incidents 522 du dossier).
        if (st.deletePerdu) { st.factors = st.factors.filter((x) => x !== fac); st.deletes.push({ id: fac.id, aal, perdu: true }); return route.fulfill({ status: 503, contentType: 'text/html', body: '<html>503</html>' }); }
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
    if (aalDe(route.request().headers().authorization)) st.rest.push(u.replace(/^.*\/rest\/v1\//, '').slice(0, 80));
    const json = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/0' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return json([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json([{ ...COMPTE, owner: USER.id }]);
    return json([]);
  });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r.request().url().includes('mode=confidentialite') ? { ok: true, uid: USER.id } : {}) }));
  await ctx.route('**://*.vinted.net/**', (r) => r.abort());
}

const ctxDe = async (nav, taille) => nav.newContext(taille === 390
  ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
  : { viewport: { width: 1512, height: 950 } });
const attendre = (pg, sel, ms = 12000) => pg.waitForSelector(sel, { timeout: ms }).then(() => true).catch(() => false);
const session = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_session') || 'null'); } catch (_) { return null; } });
const coeurMonte = (pg) => pg.evaluate(() => !document.querySelector('[data-porte-mfa]') && !document.querySelector('input[type=password]') && document.body.innerText.length > 200);
const texte = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);
const attr = (pg, sel, a) => pg.evaluate(([s, x]) => { const e = document.querySelector(s); return e ? e.getAttribute(x) : null; }, [sel, a]);
// CAPTURES=<dossier> : des captures aux moments qui comptent (§6.2 : regarder le rendu fait partie du test).
const capture = async (pg, nom) => { if (!process.env.CAPTURES) return; try { const el = (await pg.$('[data-mfa-panneau]')) || (await pg.$('[data-porte-mfa]')); const f = path.join(process.env.CAPTURES, nom + '.png'); if (el) await el.screenshot({ path: f }); else await pg.screenshot({ path: f }); } catch (_) {} };
// Machine partagée (4 cœurs, d'autres bancs tournent) : on attend des CONDITIONS,
// jamais un délai fixe — un délai fixe rend un banc rouge sur une machine lente.
const quand = (pg, fn, arg, ms = 20000) => pg.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);
const porteFermee = (pg) => quand(pg, () => !document.querySelector('[data-porte-mfa]'));
const nouveauMessage = async (pg, avant) => { await quand(pg, (a) => { const e = document.querySelector('[data-mfa-message]'); return !!e && (e.getAttribute('data-mfa-message') + e.innerText) !== a; }, avant, 15000); };
const signature = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-mfa-message]'); return e ? e.getAttribute('data-mfa-message') + e.innerText : ''; });
const erreurPorte = (pg) => quand(pg, () => !!document.querySelector('[data-mfa-erreur]') || !document.querySelector('[data-porte-mfa]') || !!document.querySelector('[data-mfa-injoignable]'), undefined, 15000);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

async function seConnecter(pg) {
  await pg.goto(`http://localhost:${PORT}/?connexion`, { waitUntil: 'domcontentloaded' });
  await attendre(pg, 'input[type=password]');
  await pg.fill('input[type=email]', USER.email);
  await pg.fill('input[type=password]', 'motdepasse42');
  await Promise.all([pg.waitForNavigation({ timeout: 15000 }).catch(() => {}), pg.click('form button[type=submit]')]);
  await pg.waitForTimeout(2500);
}
async function passerLeCode(pg, code) {
  if (!(await attendre(pg, '[data-porte-mfa="code"]', 20000))) return false;
  await pg.fill('[data-mfa-code]', code); await pg.click('[data-mfa-valider]');
  return porteFermee(pg);
}
async function ouvrirPanneau(pg, taille) {
  await pg.goto(`http://localhost:${PORT}/?tab=settings&vue=compte`, { waitUntil: 'domcontentloaded' });
  await attendre(pg, '[data-sous-ouvrir="double"], [data-mfa-panneau]', 20000);
  { const l = await pg.$('[data-sous-ouvrir="double"]'); if (l) { await l.click(); } }
  return attendre(pg, '[data-mfa-panneau="inactive"], [data-mfa-panneau="active"], [data-mfa-panneau="passu"]', 20000);
}
const message = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-mfa-message]'); return e ? e.getAttribute('data-mfa-message') + ' : ' + e.innerText.slice(0, 110) : ''; });
const nb = (pg) => attr(pg, '[data-mfa-panneau]', 'data-mfa-nb');

// Un banc ne meurt pas, il rapporte (§6) : un bloc qui lève devient UN rouge,
// et les blocs suivants tournent quand même ; chaque contexte est refermé.
// SECTIONS=H (ou A,D,H) : ne rejouer que ces scénarios (preuves par mutation,
// machine partagée). Absent : tout.
async function bloc(nom, fn) {
  const voulu = String(process.env.SECTIONS || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (voulu.length && !nom.split(' ')[0].split('+').some((l) => voulu.includes(l))) return;
  const ouverts = [];
  try { await fn((c) => { ouverts.push(c); return c; }); }
  catch (e) { dit(false, `${nom} a tourné jusqu'au bout`, String(e && e.message).split('\n')[0].slice(0, 160)); }
  finally { for (const c of ouverts) await c.close().catch(() => {}); }
}
async function scenarios(nav, taille) {
  console.log(`\n══ ${taille} px`);
  // ── A. Deux appareils, il n'a plus que le second ─────────────────────────
  console.log("── A. Deux appareils : le code du SECOND ouvre l'app");
  await bloc(`A (${taille} px)`, async (garde) => {
    const st = nouvelEtat([TEL, IPAD]), ctx = garde(await ctxDe(nav, taille)); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await seConnecter(pg);
    const porte = await attendre(pg, '[data-porte-mfa="code"]', 20000);
    dit(porte, "l'écran du code s'affiche après le mot de passe");
    const t = await texte(pg, '[data-porte-mfa]');
    dit((await attr(pg, '[data-mfa-appareils]', 'data-mfa-appareils')) === '2' && /iPad/.test(t) && /Appareil ajouté le 16\/10\/2026/.test(t) && !/VRM 2026-10-16T/.test(t),
      "il nomme les deux appareils (et jamais le nom automatique « VRM 2026-… »)", t.replace(/\s+/g, ' ').slice(0, 220));
    dit(/n'importe lequel/i.test(t), "il dit que le code de n'importe lequel marche");
    dit((await attr(pg, '[data-mfa-perdu]', 'data-mfa-perdu')) === 'autre-appareil', "« appareil perdu » renvoie vers l'AUTRE appareil", (await texte(pg, '[data-mfa-perdu]')).slice(0, 140));
    await capture(pg, `porte-deux-appareils-${taille}`);
    dit(st.rest.length === 0, 'zéro lecture de la base avant le code', String(st.rest.length));
    dit(!(await deborde(pg)), "l'écran du code ne déborde pas");
    if (porte) {
      await pg.fill('[data-mfa-code]', CODE_IPAD); await pg.click('[data-mfa-valider]');
      await erreurPorte(pg); await pg.waitForTimeout(1500);
      const err = await texte(pg, '[data-mfa-erreur]');
      dit(!(await pg.$('[data-porte-mfa]')) && st.rest.length > 0, "le code de l'iPad (second appareil) ouvre l'app", err ? 'refusé : ' + err.slice(0, 80) : st.rest.length + ' lecture(s)');
      const s = await session(pg);
      dit(s && Array.isArray(s.totp) && s.totp.length === 2 && s.totpNoms && s.totpNoms['f-ipad'] === 'iPad', 'la session connaît les deux appareils et leurs noms', s ? JSON.stringify({ totp: s.totp, noms: s.totpNoms }) : '');
    }
  });
  // ── B. Liste périmée ─────────────────────────────────────────────────────
  console.log('── B. Un appareil retiré ailleurs : un seul envoi du bon code suffit');
  await bloc(`B (${taille} px)`, async (garde) => {
    const st = nouvelEtat([IPAD]), ctx = garde(await ctxDe(nav, taille)); await brancher(ctx, st);
    await ctx.addInitScript((s) => { try { if (!localStorage.getItem('vrm_session')) { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); } } catch (_) {} },
      { access_token: jwt('aal1'), refresh_token: 'r-aal1', expires_at: Date.now() + 3600e3, user: USER, totp: ['f-tel-retire'] });
    const pg = await ctx.newPage();
    await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
    const porte = await attendre(pg, '[data-porte-mfa="code"]', 20000);
    dit(porte, "l'écran du code s'affiche (la session croit encore à l'appareil retiré)");
    if (porte) {
      await pg.fill('[data-mfa-code]', CODE_IPAD); await pg.click('[data-mfa-valider]');
      await erreurPorte(pg);
      const err = await texte(pg, '[data-mfa-erreur]');
      dit(!(await pg.$('[data-porte-mfa]')), "UN envoi du bon code ouvre l'app (la liste est relue)", err ? 'refusé : ' + err.slice(0, 90) : '');
    }
  });
  // ── C. Trop d'essais ─────────────────────────────────────────────────────
  console.log("── C. 429 : « trop d'essais », pas « code faux »");
  await bloc(`C (${taille} px)`, async (garde) => {
    const st = nouvelEtat([TEL]), ctx = garde(await ctxDe(nav, taille)); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await seConnecter(pg);
    if (await attendre(pg, '[data-porte-mfa="code"]', 20000)) {
      st.limite = 0;
      await pg.fill('[data-mfa-code]', CODE_TEL); await pg.click('[data-mfa-valider]'); await erreurPorte(pg);
      const err = await texte(pg, '[data-mfa-erreur]');
      dit(/trop d.essais/i.test(err) && !/ne correspond pas/i.test(err) && !!(await pg.$('[data-porte-mfa]')), "« trop d'essais », la porte reste fermée", err.slice(0, 120));
      dit(!!(await session(pg)), 'toujours connecté (pas renvoyé au mot de passe)');
    } else dit(false, "l'écran du code s'affiche");
  });
  // ── D + E. Réglages : ajouter un appareil de secours, puis retirer le perdu ──
  console.log('── D. Réglages : un appareil de secours, nommé, ajouté après SON code');
  await bloc(`D+E (${taille} px)`, async (garde) => {
    const st = nouvelEtat([{ ...TEL, friendly_name: 'Téléphone' }]), ctx = garde(await ctxDe(nav, taille)); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await seConnecter(pg);
    dit(await passerLeCode(pg, CODE_TEL), "connexion avec le code du téléphone");
    const vu = await ouvrirPanneau(pg, taille);
    dit(vu && (await nb(pg)) === '1', 'le panneau dit « activée », un appareil', String(await nb(pg)));
    const liste = await texte(pg, '[data-mfa-liste]');
    dit(/Téléphone/.test(liste), "la liste nomme l'appareil", liste.replace(/\s+/g, ' ').slice(0, 80));
    await capture(pg, `reglages-un-appareil-${taille}`);
    dit(!!(await pg.$('[data-mfa-conseil-secours]')) && !!(await pg.$('[data-mfa-ajouter]')), 'un seul appareil : un appareil de secours est proposé (pas imposé)');
    if (vu) {
      await pg.click('[data-mfa-ajouter]', { timeout: 4000 }); await attendre(pg, '[data-mfa-nom]', 8000);
      let avant = await signature(pg);
      await pg.fill('[data-mfa-nom]', 'téléphone'); await pg.click('[data-mfa-ajouter-continuer]', { timeout: 4000 }); await nouveauMessage(pg, avant);
      dit(/^err/.test(await message(pg)) && st.enrolls.length === 0, 'un nom déjà pris est refusé, et RIEN n’est créé chez GoTrue', (await message(pg)) + ' · ' + st.enrolls.length + ' création(s)');
      await pg.fill('[data-mfa-nom]', 'iPad'); await pg.click('[data-mfa-ajouter-continuer]', { timeout: 4000 });
      const qr = await attendre(pg, 'img[data-mfa-qr]', 20000);
      dit(qr && st.enrolls.length === 1 && st.enrolls[0].nom === 'iPad' && st.enrolls[0].aal === 'aal2', "le second appareil est créé sous SON nom, avec un jeton aal2", JSON.stringify(st.enrolls));
      await capture(pg, `reglages-qr-secours-${taille}`);
      dit(!!(await pg.$('[data-mfa-ajout-consigne]')), "la consigne dit de scanner avec l'AUTRE appareil");
      dit((await pg.$$('[data-mfa-appareil]')).length === 0 && st.factors.filter((x) => x.status === 'verified').length === 1, 'pas encore ajouté avant son premier code');
      avant = await signature(pg);
      await pg.fill('[data-mfa-code-activer]', CODE_TEL); await pg.click('[data-mfa-confirmer]'); await nouveauMessage(pg, avant);
      dit(/^err/.test(await message(pg)) && st.factors.filter((x) => x.status === 'verified').length === 1, "le code du TÉLÉPHONE n'ajoute pas l'iPad", await message(pg));
      await pg.fill('[data-mfa-code-activer]', CODE_NEUF); await pg.click('[data-mfa-confirmer]');
      const deux = await pg.waitForFunction(() => { const e = document.querySelector('[data-mfa-panneau]'); return e && e.getAttribute('data-mfa-nb') === '2'; }, null, { timeout: 20000 }).then(() => true).catch(() => false);
      dit(deux && /^ok/.test(await message(pg)), "le code de l'iPad l'ajoute : deux appareils", await message(pg));
      const s = await session(pg);
      dit(s && Array.isArray(s.totp) && s.totp.length === 2 && Object.values(s.totpNoms || {}).includes('iPad'), 'la session connaît les deux appareils', s ? JSON.stringify(s.totpNoms) : '');
      await capture(pg, `reglages-deux-appareils-${taille}`);
      dit(!(await deborde(pg)), 'le panneau ne déborde pas');

      console.log('── E. Téléphone perdu : retiré avec le code de l’iPad');
      const idIpad = st.factors.find((x) => x.friendly_name === 'iPad').id;
      await pg.click('[data-mfa-retirer="f-tel"]').catch(() => {});
      const cf = await attendre(pg, '[data-mfa-code-desactiver]', 10000);
      await capture(pg, `reglages-retirer-${taille}`);
      dit(cf && /Téléphone/.test(await texte(pg, '[data-mfa-panneau]')), "la confirmation nomme l'appareil à retirer");
      if (cf) {
        avant = await signature(pg);
        await pg.fill('[data-mfa-code-desactiver]', CODE_FAUX); await pg.click('[data-mfa-confirmer-off]'); await nouveauMessage(pg, avant);
        dit(st.deletes.length === 0 && /^err/.test(await message(pg)), 'un code faux ne retire rien', await message(pg));
        const nVerifs = st.verifs.length;
        await pg.fill('[data-mfa-code-desactiver]', CODE_NEUF); await pg.click('[data-mfa-confirmer-off]');
        const un = await pg.waitForFunction(() => { const e = document.querySelector('[data-mfa-panneau]'); return e && e.getAttribute('data-mfa-nb') === '1' && !e.getAttribute('data-mfa-cours'); }, null, { timeout: 20000 }).then(() => true).catch(() => false);
        dit(un && st.deletes.length === 1 && st.deletes[0].id === 'f-tel' && st.deletes[0].aal === 'aal2', 'le téléphone est retiré (DELETE en aal2), et lui seul', JSON.stringify(st.deletes));
        dit(st.factors.length === 1 && st.factors[0].id === idIpad, "l'iPad reste enregistré", st.factors.map((x) => x.friendly_name).join(', '));
        const essais = st.verifs.slice(nVerifs);
        dit(essais.length && essais[0].id === idIpad && essais[0].ok, "le code est d'abord essayé sur l'appareil qu'on GARDE (cas « perdu »)", JSON.stringify(essais));
        const s2 = await session(pg);
        dit(s2 && JSON.stringify(s2.totp) === JSON.stringify([idIpad]), 'la session ne connaît plus que l’iPad', s2 ? JSON.stringify(s2.totp) : '');
        dit(/iPad/.test(await texte(pg, '[data-mfa-liste]')) && !(await pg.$('[data-mfa-appareil="f-tel"]')), 'la liste ne montre plus que l’iPad');
      }
    }
  });
  // ── F. Service injoignable pendant l'ajout ───────────────────────────────
  console.log("── F. Service injoignable pendant l'ajout : rien d'ajouté, c'est dit");
  await bloc(`F (${taille} px)`, async (garde) => {
    const st = nouvelEtat([{ ...TEL, friendly_name: 'Téléphone' }]), ctx = garde(await ctxDe(nav, taille)); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await seConnecter(pg);
    await passerLeCode(pg, CODE_TEL);
    if (await ouvrirPanneau(pg, taille)) {
      await pg.click('[data-mfa-ajouter]', { timeout: 4000 }); await attendre(pg, '[data-mfa-nom]', 8000);
      await pg.fill('[data-mfa-nom]', 'iPad'); await pg.click('[data-mfa-ajouter-continuer]', { timeout: 4000 });
      await attendre(pg, '[data-mfa-code-activer]', 20000);
      st.down = true;
      const avant = await signature(pg);
      await pg.fill('[data-mfa-code-activer]', CODE_NEUF, { timeout: 4000 }).catch(() => {}); await pg.click('[data-mfa-confirmer]', { timeout: 4000 }).catch(() => {}); await nouveauMessage(pg, avant);
      dit(/^passu/.test(await message(pg)) && st.factors.filter((x) => x.status === 'verified').length === 1, "pendant la panne : pas « ajouté », et c'est dit", await message(pg));
      dit(!!(await session(pg)), 'toujours connecté');
    } else dit(false, 'le panneau « Double vérification » est là');
  });
  // ── H. Retirer un appareil qui n'existe déjà plus chez GoTrue ─────────────
  // Deux chemins mènent au même état : il a été retiré DEPUIS UN AUTRE APPAREIL
  // pendant que le formulaire était ouvert (le DELETE répond 404), ou le retrait
  // a été FAIT mais la réponse s'est perdue (503). Dans les deux cas le panneau
  // ne doit ni dire « reste enregistré », ni rester sur un formulaire « retirer /
  // désactiver » qui vise un appareil disparu : la liste relue est montrée.
  console.log('── H. Retirer un appareil déjà parti (retiré ailleurs · réponse perdue)');
  for (const cas of ['ailleurs', 'perdu']) {
    await bloc(`H (${taille} px, ${cas})`, async (garde) => {
      const st = nouvelEtat([{ ...TEL, friendly_name: 'Téléphone' }, IPAD]), ctx = garde(await ctxDe(nav, taille)); await brancher(ctx, st);
      const pg = await ctx.newPage();
      await seConnecter(pg);
      dit(await passerLeCode(pg, CODE_TEL), `connexion (${cas})`);
      if (!(await ouvrirPanneau(pg, taille))) { dit(false, `le panneau « Double vérification » est là (${cas})`); return; }
      await pg.click('[data-mfa-retirer="f-tel"]', { timeout: 4000 });
      if (!(await attendre(pg, '[data-mfa-code-desactiver]', 10000))) { dit(false, `le formulaire « retirer » s'ouvre (${cas})`); return; }
      if (cas === 'ailleurs') st.factors = st.factors.filter((x) => x.id !== 'f-tel');   // retiré depuis un autre appareil
      else st.deletePerdu = true;
      const avant = await signature(pg);
      await pg.fill('[data-mfa-code-desactiver]', CODE_IPAD); await pg.click('[data-mfa-confirmer-off]'); await nouveauMessage(pg, avant);
      // La liste relue (l'iPad seul) arrive ; puis le formulaire doit se refermer.
      await quand(pg, () => { const e = document.querySelector('[data-mfa-panneau]'); return e && e.getAttribute('data-mfa-nb') === '1'; }, undefined, 15000);
      await quand(pg, () => { const e = document.querySelector('[data-mfa-panneau]'); return e && e.getAttribute('data-mfa-nb') === '1' && !e.getAttribute('data-mfa-cours'); }, undefined, 6000);
      const m = await message(pg), panneau = (await texte(pg, '[data-mfa-panneau]')).replace(/\s+/g, ' ');
      await capture(pg, `reglages-retrait-${cas}-${taille}`);
      dit(st.factors.length === 1 && st.factors[0].id === 'f-ipad', `l'iPad reste enregistré chez GoTrue (${cas})`, st.factors.map((x) => x.id).join(', '));
      dit(!/reste enregistr/.test(m), `le message ne dit pas « reste enregistré » d'un appareil qui n'existe plus (${cas})`, m);
      if (cas === 'ailleurs') dit(/^passu/.test(m) && /déjà plus enregistré/.test(m) && /Téléphone/.test(m), 'il dit que « Téléphone » était déjà retiré (pas une erreur)', m);
      else dit(/^passu/.test(m) && /ne sais pas/i.test(m), "réponse perdue : « je ne sais pas », puis la liste relue", m);
      dit(!/Ton mot de passe suffira/.test(panneau) && !(await pg.$('[data-mfa-code-desactiver]')), `aucun formulaire « désactiver » pour un appareil disparu (${cas})`, panneau.slice(0, 160));
      dit(!!(await pg.$('[data-mfa-appareil="f-ipad"]')) && !(await pg.$('[data-mfa-appareil="f-tel"]')), `la liste relue est montrée : l'iPad, plus le téléphone (${cas})`, ((await texte(pg, '[data-mfa-liste]')) || '(pas de liste)').replace(/\s+/g, ' '));
      dit(!!(await pg.$('[data-mfa-desactiver]')) && !!(await pg.$('[data-mfa-ajouter]')), `l'appareil restant garde ses gestes : « Désactiver… », « Ajouter un appareil de secours » (${cas})`);
      if (cas === 'ailleurs') {
        const s = await session(pg);
        dit(s && Array.isArray(s.totp) && !s.totp.includes('f-tel') && !(s.totpNoms && s.totpNoms['f-tel']), 'la session ne connaît plus le téléphone', s ? JSON.stringify({ totp: s.totp, noms: s.totpNoms }) : '');
      }
      dit(!(await deborde(pg)), `le panneau ne déborde pas (${cas})`);
    });
  }
  // ── G. Aucun SMS ─────────────────────────────────────────────────────────
  console.log('── G. Aucune proposition de SMS (décision de Julien : payant)');
  await bloc(`G (${taille} px)`, async (garde) => {
    const st = nouvelEtat([]), ctx = garde(await ctxDe(nav, taille)); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await seConnecter(pg);
    if (await ouvrirPanneau(pg, taille)) {
      const t = await texte(pg, '[data-mfa-panneau]');
      dit(!/\bSMS\b/.test(t) && !(await pg.$('[data-mfa-panneau] input[type=tel]')), 'le panneau ne propose ni SMS ni numéro de téléphone', t.replace(/\s+/g, ' ').slice(0, 100));
      dit(!!(await pg.$('[data-mfa-nom]')) && !!(await pg.$('[data-mfa-activer]')), "premier appareil : on peut le nommer avant d'activer");
    } else dit(false, 'le panneau « Double vérification » est là');
  });
}

(async () => {
  try { await ecouter(); } catch (e) { console.log('  ❌ ' + e.message); process.exit(1); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    // TAILLES=1512 : une seule taille (preuves par mutation, machine partagée).
    for (const t of String(process.env.TAILLES || '390,1512').split(',').map(Number)) {
      try { await scenarios(nav, t); } catch (e) { dit(false, `le banc a tourné jusqu'au bout (${t} px)`, String(e && e.message).slice(0, 200)); }
    }
  } finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ double vérification, plusieurs appareils : ${ko} rouge(s) sur ${n}` : `\n✅ double vérification, plusieurs appareils : ${n} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
