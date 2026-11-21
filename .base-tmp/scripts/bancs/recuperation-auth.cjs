require('./_porte-banc.cjs');
// Banc de la page « nouveau mot de passe » (/recuperation.html), 8 nov.
// Vraie page, faux service d'authentification à la FORME de Supabase Auth
// (verify, user, token?grant_type=pkce|password, logout, recover) : aucun
// e-mail ni compte réel. Chaque forme de lien qu'un e-mail Supabase peut amener :
//   A  #type=recovery&token_hash=…   (notre modèle)       ⇒ formulaire ⇒ connecté
//   B  ?type=recovery&token_hash=…   (en paramètre)       ⇒ formulaire
//   C  #access_token=…&type=recovery (modèle par défaut)  ⇒ formulaire
//   D  ?code=…  + vérificateur PKCE sur l'appareil       ⇒ formulaire
//   E  ?code=…  sans vérificateur                         ⇒ « ouvre-le sur ton autre appareil » + renvoi
//   F  #error=access_denied&error_code=otp_expired        ⇒ « expiré » + renvoi qui part
//   G  token_hash refusé (403 otp_expired)                ⇒ « expiré »
// Quand le lien marche : aucune voie « colle le lien », aucun renvoi affiché.
// VRM_RECUPERATION_ROOT=<autre public/> rejoue le banc sur un autre arbre.
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { chromium } = require('playwright');
const ROOT = process.env.VRM_RECUPERATION_ROOT || path.join(__dirname, '..', '..', 'public');
const CAPTURES = process.env.BANC_CAPTURES || path.join(__dirname, 'captures', 'recuperation-auth');
const SB = 'https://projet.supabase.co';
const HASH = 'abcdefghijklmnopqrstuvwxyz0123456789';
const CODE = '6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f';
const JWT_RECUP = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.signature-recuperation';
const USER = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'client@exemple.test', user_metadata: {} };
const session = (at) => ({ access_token: at, token_type: 'bearer', expires_in: 3600, expires_at: 1900000000, refresh_token: 'refresh-' + at, user: USER });

(async () => {
  fs.mkdirSync(CAPTURES, { recursive: true });
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    const f = { '/recuperation.html': 'text/html', '/recuperation.js': 'text/javascript', '/recuperation.css': 'text/css', '/vrm-logo-v5-192.png': 'image/png' }[p];
    if (!f || !fs.existsSync(path.join(ROOT, p))) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', f); res.end(fs.readFileSync(path.join(ROOT, p)));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const origine = 'http://127.0.0.1:' + srv.address().port;
  const nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/opt/pw-browsers/chromium'), args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const rapport = []; let rouges = 0;
  const cas = async (nom, fn) => {
    try { await fn(); rapport.push('✓ ' + nom); }
    catch (e) { rouges++; rapport.push('✗ ' + nom + ' — ' + String(e.message || e).split('\n')[0]); }
  };
  // Une page neuve + le faux Supabase ; `journal` garde chaque appel.
  const ouvrir = async ({ width = 390, scheme = 'light', verify = 200, avant } = {}) => {
    const ctx = await nav.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    const journal = []; const erreurs = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    if (avant) await page.addInitScript(avant);
    await page.route('**/*', (r) => {
      const q = r.request(), u = q.url(), m = q.method();
      const corps = (() => { try { return q.postDataJSON(); } catch (_) { return null; } })();
      const auth = q.headers().authorization || '';
      if (u.startsWith(origine + '/api/compte')) return r.fulfill({ json: { ok: true, url: SB, cle: 'publique-banc' } });
      if (!u.startsWith(SB)) return u.startsWith(origine + '/') ? r.continue() : r.abort();
      const chemin = u.slice(SB.length);
      journal.push({ m, chemin, corps, auth });
      if (chemin.startsWith('/auth/v1/verify')) return verify === 200 ? r.fulfill({ json: session('jeton-recuperation') }) : r.fulfill({ status: 403, json: { code: 403, error_code: 'otp_expired', msg: 'Email link is invalid or has expired' } });
      if (chemin.startsWith('/auth/v1/token?grant_type=pkce')) return corps?.auth_code === CODE && corps?.code_verifier === 'verificateur-banc' ? r.fulfill({ json: session('jeton-pkce') }) : r.fulfill({ status: 404, json: { code: 404, error_code: 'flow_state_not_found', msg: 'invalid flow state, no valid flow state found' } });
      if (chemin.startsWith('/auth/v1/token?grant_type=password')) return r.fulfill({ json: session('session-neuve') });
      if (chemin.startsWith('/auth/v1/user')) {
        if (m === 'GET') return auth === 'Bearer ' + JWT_RECUP ? r.fulfill({ json: USER }) : r.fulfill({ status: 401, json: { msg: 'invalid JWT' } });
        return r.fulfill({ json: USER });
      }
      if (chemin.startsWith('/auth/v1/logout')) return r.fulfill({ status: 204, body: '' });
      if (chemin.startsWith('/auth/v1/recover')) return r.fulfill({ json: {} });
      return r.fulfill({ status: 404, json: {} });
    });
    return { ctx, page, journal, erreurs };
  };
  const formulaireVisible = async (page) => {
    await page.locator('#password').waitFor({ state: 'visible' });
    assert.equal(await page.locator('h1').innerText(), 'Choisis un nouveau mot de passe');
    // Le lien marche : aucune voie « coller », aucun renvoi, aucun jargon.
    assert.equal(await page.locator('#autre').isVisible(), false, 'la voie « coller le lien » ne doit pas paraître');
    assert.equal(await page.locator('#renvoi').isVisible(), false, 'le renvoi ne doit pas paraître');
    const texte = await page.locator('body').innerText();
    assert.doesNotMatch(texte, /colle|lien sécurisé|SÉCURITÉ DU COMPTE|nouveau départ/i);
    assert.equal(new URL(page.url()).hash, '', 'le jeton reste dans l’adresse');
    assert.equal(new URL(page.url()).search, '', 'le jeton reste dans l’adresse');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'débordement horizontal');
  };
  const echecAvecRenvoi = async (page, titre, phrase) => {
    await page.locator('#renvoi').waitFor({ state: 'visible' });
    assert.equal(await page.locator('h1').innerText(), titre);
    assert.match(await page.locator('#message').innerText(), phrase);
    assert.equal(await page.locator('#password').isVisible(), false);
    // La voie « coller » n'existe qu'ici, repliée.
    assert.equal(await page.locator('#autre').isVisible(), true);
    assert.equal(await page.locator('#lien').isVisible(), false);
  };
  try {
    for (const [width, scheme] of [[390, 'light'], [390, 'dark'], [1512, 'light']]) {
      await cas(`A ${width}px ${scheme} : #token_hash ⇒ formulaire ⇒ mot de passe changé ⇒ connecté`, async () => {
        const { ctx, page, journal, erreurs } = await ouvrir({ width, scheme });
        await page.goto(origine + `/recuperation.html#token_hash=${HASH}&type=recovery`);
        await formulaireVisible(page);
        assert.deepEqual(journal.find((j) => j.chemin.startsWith('/auth/v1/verify'))?.corps, { type: 'recovery', token_hash: HASH });
        assert.equal(await page.evaluate(() => localStorage.length), 0, 'rien dans le stockage avant le changement');
        if (width === 390) await page.screenshot({ path: path.join(CAPTURES, `formulaire-390-${scheme}.png`), fullPage: true });
        else await page.screenshot({ path: path.join(CAPTURES, 'formulaire-1512.png') });
        await page.locator('#password').fill('MonNouveau123');
        assert.equal(await page.locator('#r-longueur').getAttribute('data-valide'), 'true');
        await page.locator('#voir').click();
        assert.equal(await page.locator('#password').getAttribute('type'), 'text');
        await page.locator('#confirmation').fill('Different123');
        await page.locator('#nouveau [type=submit]').click();
        await page.getByText('ne sont pas les mêmes', { exact: false }).waitFor();
        assert.equal(journal.filter((j) => j.chemin.startsWith('/auth/v1/user') && j.m === 'PUT').length, 0, 'aucune écriture si la confirmation diffère');
        await page.locator('#confirmation').fill('MonNouveau123');
        await page.locator('#nouveau [type=submit]').click();
        await page.locator('#fait').waitFor({ state: 'visible' });
        const puts = journal.filter((j) => j.chemin.startsWith('/auth/v1/user') && j.m === 'PUT');
        assert.equal(puts.length, 1); assert.deepEqual(puts[0].corps, { password: 'MonNouveau123' }); assert.equal(puts[0].auth, 'Bearer jeton-recuperation');
        assert.ok(journal.some((j) => j.chemin === '/auth/v1/logout?scope=global' && j.auth === 'Bearer jeton-recuperation'), 'les anciennes sessions sont fermées');
        const conn = journal.find((j) => j.chemin.startsWith('/auth/v1/token?grant_type=password'));
        assert.deepEqual(conn?.corps, { email: 'client@exemple.test', password: 'MonNouveau123' });
        const s = await page.evaluate(() => JSON.parse(localStorage.getItem('vrm_session') || 'null'));
        assert.equal(s?.access_token, 'session-neuve'); assert.equal(s?.user?.id, USER.id);
        assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ['vrm_session']);
        assert.doesNotMatch(await page.evaluate(() => JSON.stringify(localStorage)), /jeton-recuperation/);
        assert.equal(await page.locator('h1').innerText(), 'C’est fait');
        assert.match(await page.locator('#message').innerText(), /Tu es connecté/);
        assert.equal(await page.locator('#ouvrir').innerText(), 'Ouvrir VRM'); assert.equal(await page.locator('#ouvrir').getAttribute('href'), '/');
        assert.equal(await page.locator('#password').inputValue(), '');
        if (width === 390) await page.screenshot({ path: path.join(CAPTURES, `fait-390-${scheme}.png`), fullPage: true });
        assert.deepEqual(erreurs, []);
        await ctx.close();
      });
    }
    await cas('B ?token_hash en paramètre ⇒ formulaire', async () => {
      const { ctx, page, journal } = await ouvrir();
      await page.goto(origine + `/recuperation.html?token_hash=${HASH}&type=recovery`);
      await formulaireVisible(page);
      assert.equal(journal.filter((j) => j.chemin.startsWith('/auth/v1/verify')).length, 1);
      await ctx.close();
    });
    await cas('C #access_token (modèle par défaut de Supabase) ⇒ formulaire, jeton relu chez Supabase', async () => {
      const { ctx, page, journal } = await ouvrir();
      await page.goto(origine + `/recuperation.html#access_token=${JWT_RECUP}&expires_at=1900000000&expires_in=3600&refresh_token=rt-banc&token_type=bearer&type=recovery`);
      await formulaireVisible(page);
      assert.ok(journal.some((j) => j.m === 'GET' && j.chemin === '/auth/v1/user' && j.auth === 'Bearer ' + JWT_RECUP));
      await page.locator('#password').fill('MonNouveau123'); await page.locator('#confirmation').fill('MonNouveau123');
      await page.locator('#nouveau [type=submit]').click();
      await page.locator('#fait').waitFor({ state: 'visible' });
      assert.equal(journal.find((j) => j.m === 'PUT')?.auth, 'Bearer ' + JWT_RECUP);
      await ctx.close();
    });
    await cas('D ?code (PKCE) avec le vérificateur de cet appareil ⇒ échangé ⇒ formulaire', async () => {
      const { ctx, page, journal } = await ouvrir({ avant: () => { if (!sessionStorage.getItem('banc-pose')) { sessionStorage.setItem('banc-pose', '1'); localStorage.setItem('sb-projet-auth-token-code-verifier', JSON.stringify('verificateur-banc/PASSWORD_RECOVERY')); } } });
      await page.goto(origine + `/recuperation.html?code=${CODE}`);
      await page.locator('#password').waitFor({ state: 'visible' });
      assert.deepEqual(journal.find((j) => j.chemin.startsWith('/auth/v1/token?grant_type=pkce'))?.corps, { auth_code: CODE, code_verifier: 'verificateur-banc' });
      assert.equal(await page.evaluate(() => localStorage.getItem('sb-projet-auth-token-code-verifier')), null, 'le vérificateur sert une fois');
      assert.equal(await page.locator('#autre').isVisible(), false);
      assert.equal(new URL(page.url()).search, '');
      await ctx.close();
    });
    await cas('E ?code sans vérificateur ⇒ « ouvre-le sur ton autre appareil » + renvoi', async () => {
      const { ctx, page, journal } = await ouvrir();
      await page.goto(origine + `/recuperation.html?code=${CODE}`);
      await echecAvecRenvoi(page, 'Ouvre le lien sur ton autre appareil', /l’appareil où tu as demandé l’e-mail/);
      assert.equal(journal.length, 0, 'aucun appel sans vérificateur');
      await ctx.close();
    });
    for (const [width, scheme] of [[390, 'light'], [390, 'dark']]) {
      await cas(`F ${scheme} : #error=otp_expired ⇒ « expiré » + renvoi qui part, 60 s sur le bouton`, async () => {
        const { ctx, page, journal } = await ouvrir({ width, scheme });
        await page.goto(origine + '/recuperation.html#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
        await echecAvecRenvoi(page, 'Ce lien ne marche plus', /a expiré ou a déjà servi/);
        await page.screenshot({ path: path.join(CAPTURES, `expire-390-${scheme}.png`), fullPage: true });
        await page.locator('#email').fill('Client@Exemple.test');
        await page.locator('#renvoi [type=submit]').click();
        await page.getByText('On t’a envoyé un e-mail à client@exemple.test. Ouvre-le sur cet appareil.').waitFor();
        const rec = journal.filter((j) => j.chemin.startsWith('/auth/v1/recover'));
        assert.equal(rec.length, 1); assert.deepEqual(rec[0].corps, { email: 'client@exemple.test' });
        assert.equal(new URL(SB + rec[0].chemin).searchParams.get('redirect_to'), origine + '/recuperation.html');
        const b = page.locator('#renvoi [type=submit]');
        assert.match(await b.innerText(), /^Renvoyer dans \d+ s$/); assert.equal(await b.isDisabled(), true);
        await page.locator('#renvoi').evaluate((f) => f.requestSubmit());
        assert.equal(journal.filter((j) => j.chemin.startsWith('/auth/v1/recover')).length, 1, 'aucun second envoi pendant l’attente');
        if (scheme === 'light') await page.screenshot({ path: path.join(CAPTURES, 'renvoye-390.png'), fullPage: true });
        await ctx.close();
      });
    }
    await cas('G token_hash refusé (403 otp_expired) ⇒ « expiré », jamais une panne', async () => {
      const { ctx, page } = await ouvrir({ verify: 403 });
      await page.goto(origine + `/recuperation.html#token_hash=${HASH}&type=recovery`);
      await echecAvecRenvoi(page, 'Ce lien ne marche plus', /a expiré ou a déjà servi/);
      await ctx.close();
    });
    await cas('H page ouverte sans lien ⇒ « Mot de passe oublié » + renvoi', async () => {
      const { ctx, page } = await ouvrir();
      await page.goto(origine + '/recuperation.html');
      await echecAvecRenvoi(page, 'Mot de passe oublié', /demande un e-mail/);
      await ctx.close();
    });
  } finally { await nav.close(); srv.close(); }
  for (const l of rapport) console.log(l);
  if (rouges) { console.error(`${rouges} cas rouge(s) — racine servie : ${ROOT}`); process.exit(1); }
  console.log(`OK : ${rapport.length} cas — captures dans ${path.relative(process.cwd(), CAPTURES) || CAPTURES}`);
})().catch((e) => { console.error(e); process.exit(1); });
