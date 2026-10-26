require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « RÉESSAIE DANS N SECONDES » — 22 octobre.
//
//  MESURÉ (journaux d'authentification Supabase, 22 oct., lecture seule) : un
//  email redemandé moins d'une minute après le précédent est refusé par GoTrue
//  (429) avec « For security purposes, you can only request this after N
//  seconds. » (4 refus en une minute ce matin-là : 57, 50, 34, 30 s). L'app le
//  montrait tel quel, EN ANGLAIS, sur l'inscription, le renvoi de l'email et le
//  lien de connexion ; « mot de passe oublié » disait « réessaie dans quelques
//  minutes » (faux : 57 secondes) et laissait recliquer.
//
//  Un FAUX GoTrue rend exactement ce refus (forme documentée : 429,
//  `error_code: over_email_send_rate_limit`, `msg` en anglais). Le banc exige, à
//  390 px (tactile) ET à 1512 px :
//   A. inscription : la phrase en FRANÇAIS avec le nombre de secondes, rien en
//      anglais, le bouton grisé qui dit « Réessaie dans N s » — et au bout de
//      l'attente (horloge de la page avancée), le bouton revient et la phrase
//      part ; recliquer pendant l'attente n'envoie RIEN ;
//   B. mot de passe oublié : pareil ; et « Se connecter » n'est PAS grisé par
//      cette attente (elle ne porte que sur ce qui envoie un email) ;
//   C. compte pas confirmé : « Renvoyer l'email » refusé ⇒ phrase française,
//      « Renvoyer » ET « Recevoir un lien de connexion » grisés pendant l'attente.
//   D. (23 oct., revue §7) le compte à rebours ne s'écrit qu'UNE fois : le
//      bouton grisé porte « … dans N s », la phrase dit la cause SANS chiffre —
//      sur l'inscription, le mot de passe oublié, le compte pas confirmé ET la
//      fenêtre « Changer mon email » (session de banc, PUT /user refusé).
//  Aucune fixture : tout est inventé, le banc vit dans le dépôt.
//  Usage : npm run build ; BANC_PORT=6351 node scripts/bancs/attente-email.cjs
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = process.env.BANC_DIST ? path.resolve(process.env.BANC_DIST) : path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 6351;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const ATTENTE = 'attente@exemple.fr';
const ANGLAIS = /for security purposes|only request this/i;
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeuse@exemple.test', factors: [] } };

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function brancher(ctx, st) {
  await ctx.route('**/auth/v1/**', async (route) => {
    const rq = route.request(), u = new URL(rq.url()), m = rq.method(), chemin = u.pathname.replace(/^.*\/auth\/v1\//, '');
    const json = (status, d) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (chemin === 'settings') return json(200, { external: {}, mailer_autoconfirm: false });
    const gt = u.searchParams.get('grant_type');
    let corps = {}; try { corps = JSON.parse(rq.postData() || '{}'); } catch (_) {}
    if (chemin === 'token' && gt === 'password') {
      st.appels.push('token');
      if (corps.email === ATTENTE) return json(400, { error: 'invalid_grant', error_description: 'Email not confirmed' });
      return json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
    }
    if (chemin === 'user' && m === 'GET') return json(200, SESSION.user);
    if (chemin === 'user' && m === 'PUT') { st.appels.push('user-put'); return json(429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'For security purposes, you can only request this after 57 seconds.' }); }
    if (chemin === 'token') return json(200, { access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user });
    if (['signup', 'recover', 'resend', 'otp'].includes(chemin)) {
      st.appels.push(chemin);
      // La forme RÉELLE du refus de GoTrue (journaux du 22 oct. : 429).
      return json(429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'For security purposes, you can only request this after 57 seconds.' });
    }
    return json(404, { msg: 'banc : ' + chemin });
  });
  await ctx.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }));
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('**://challenges.cloudflare.com/**', (r) => r.abort());
}

const ctxDe = (nav, t) => nav.newContext(t === 390 ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1512, height: 950 } });
const texte = (pg) => pg.evaluate(() => document.body.innerText);
const valider = (pg) => pg.evaluate(() => { const b = document.querySelector('form button[type=submit]'); return b ? { off: b.disabled, txt: b.innerText.trim() } : null; });
const attente = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-auth-attente]'); return e ? { n: Number(e.getAttribute('data-auth-attente')), txt: e.innerText } : null; });
const clicTexte = (pg, t) => pg.getByRole('button', { name: t }).first().click({ timeout: 4000 }).then(() => true).catch(() => false);
// ⚠️ appelée `pause(ms)` ET `pause(pg, ms)` : la première forme valait 0 ms.
const pause = (a, b) => new Promise((r) => setTimeout(r, typeof a === 'number' ? a : b));
// §7 : combien de fois un nombre de SECONDES est écrit à l'écran (phrase,
// boutons). Le compte à rebours doit l'être une fois — jamais deux.
const decomptes = (pg) => pg.evaluate(() => (document.body.innerText.match(/\b\d{1,4}\s*(?:s|secondes?)(?![A-Za-zÀ-ÿ])/g) || []));
const unSeulDecompte = async (pg, ou) => { const d = await decomptes(pg); dit(d.length === 1, `§7 ${ou} : le compte à rebours n'est écrit qu'UNE fois (le bouton), la phrase dit la cause sans chiffre`, JSON.stringify(d)); };
// On attend la RÉPONSE appliquée (la phrase posée), jamais un délai fixe.
const attendrePhrase = (pg) => pg.waitForSelector('[data-auth-attente]', { timeout: 8000 }).then(() => true).catch(() => false);

async function changerEmail(nav, taille) {
  console.log('── D. « Changer mon email » (Réglages → Mon compte) refusé');
  const st = { appels: [] }, ctx = await ctxDe(nav, taille); await brancher(ctx, st);
  const pg = await ctx.newPage();
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_reglages_vue', 'compte'); } catch (_) {} }, SESSION);
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  let o = pg.locator('[data-onglets-reglages] [data-vue="compte"]');
  await o.first().waitFor({ timeout: 12000 }).catch(() => {});
  if (await o.count()) { await o.first().click().catch(() => {}); await pause(pg, 800); }
  const ouvert = await clicTexte(pg, 'Changer mon email');
  await pause(pg, 500);
  await pg.fill('input[type=email]', 'nouvelle@exemple.fr').catch(() => {});
  const envoye = await clicTexte(pg, 'Enregistrer'); await attendrePhrase(pg);
  const a = await attente(pg);
  const b = await pg.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => /Réessaie dans \d+ s/.test(e.innerText)); return x ? { off: x.disabled, txt: x.innerText.trim() } : null; });
  dit(ouvert && envoye && st.appels.includes('user-put'), 'la demande de changement est partie (refusée par le faux GoTrue)', JSON.stringify({ ouvert, envoye, appels: st.appels }));
  dit(!!a && a.n >= 55 && /un instant/.test(a.txt) && !!b && b.off, 'la phrase dit la cause, « Enregistrer » est grisé et dit « Réessaie dans N s »', JSON.stringify({ a, b }));
  await unSeulDecompte(pg, 'changer mon email');
  await ctx.close();
}

async function scenarios(nav, taille) {
  console.log(`\n══ ${taille} px`);
  // ── A. Inscription ─────────────────────────────────────────────────────────
  console.log('── A. Inscription refusée « after 57 seconds »');
  {
    const st = { appels: [] }, ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await pg.clock.install();
    await pg.goto(`http://localhost:${PORT}/?inscription`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('input[type=password]', { timeout: 10000 });
    await pg.fill('input[type=email]', 'neuf@exemple.fr'); await pg.fill('input[type=password]', 'motdepasse42');
    await pg.click('form button[type=submit]'); await attendrePhrase(pg);
    const t = await texte(pg), a = await attente(pg), b = await valider(pg);
    dit(!ANGLAIS.test(t), 'aucun message en anglais', (t.match(ANGLAIS) || [''])[0]);
    dit(!!a && a.n >= 55 && a.n <= 57 && /Par sécurité, un nouvel email ne peut partir que dans un instant/.test(a.txt), 'la phrase française dit la cause et le geste (le nombre est sur le bouton)', a ? `${a.n} · ${a.txt.slice(0, 80)}` : 'aucune phrase');
    const nb = Number((/Réessaie dans (\d+) s/.exec((b && b.txt) || '') || [])[1]);
    dit(!!b && b.off && nb >= 55 && nb <= 57, 'le bouton est grisé et dit « Réessaie dans N s » (57 s refusées)', JSON.stringify(b));
    await unSeulDecompte(pg, 'inscription');
    const avant = st.appels.length;
    await pg.click('form button[type=submit]', { force: true, timeout: 2000 }).catch(() => {}); await pg.keyboard.press('Enter'); await pause(400);
    dit(st.appels.length === avant, 'recliquer (ou Entrée) pendant l\'attente n\'envoie RIEN', `${st.appels.length - avant} appel(s) de plus`);
    await pg.clock.fastForward(30000); await pause(1200);
    const a2 = await attente(pg);
    const b2 = await valider(pg), nb2 = Number((/Réessaie dans (\d+) s/.exec((b2 && b2.txt) || '') || [])[1]);
    dit(!!a2 && a2.n <= 28 && a2.n >= 25 && nb2 <= 28 && nb2 >= 25, 'le bouton suit le temps qui passe', `${a2 ? a2.n : 'disparue'} · ${b2 && b2.txt}`);
    await pg.clock.fastForward(31000); await pause(1200);
    const b3 = await valider(pg), a3 = await attente(pg);
    dit(!!b3 && !b3.off && /Créer mon compte/.test(b3.txt) && !a3, 'l\'attente finie : le bouton revient, la phrase part', JSON.stringify({ b3, a3 }));
    await ctx.close();
  }
  // ── B. Mot de passe oublié ─────────────────────────────────────────────────
  console.log('── B. « Mot de passe oublié » refusé — « Se connecter » reste libre');
  {
    const st = { appels: [] }, ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await pg.clock.install();
    await pg.goto(`http://localhost:${PORT}/?connexion`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('input[type=password]', { timeout: 10000 });
    await clicTexte(pg, 'Mot de passe oublié ?'); await pause(300);
    await pg.fill('input[type=email]', 'vendeur@exemple.fr');
    await pg.click('form button[type=submit]'); await attendrePhrase(pg);
    const t = await texte(pg), a = await attente(pg), b = await valider(pg);
    dit(!ANGLAIS.test(t) && !/quelques minutes/.test(t), 'ni anglais, ni « réessaie dans quelques minutes » (c\'est 57 secondes)', (t.match(/quelques minutes|for security/i) || [''])[0]);
    dit(!!a && a.n >= 55 && a.n <= 57, 'l\'attente porte le nombre de secondes refusé', a ? String(a.n) : 'aucune phrase');
    dit(!!b && b.off && /Réessaie dans \d+ s/.test(b.txt), '« Envoyer le lien » est grisé pendant l\'attente', JSON.stringify(b));
    await unSeulDecompte(pg, 'mot de passe oublié');
    await clicTexte(pg, 'Retour'); await pause(300);
    const b2 = await valider(pg);
    dit(!!b2 && !b2.off && /Se connecter/.test(b2.txt), '« Se connecter » n\'est PAS grisé par cette attente', JSON.stringify(b2));
    await ctx.close();
  }
  // ── C. Compte pas confirmé : renvoyer l'email ──────────────────────────────
  console.log('── C. Compte pas confirmé : « Renvoyer l\'email » refusé');
  {
    const st = { appels: [] }, ctx = await ctxDe(nav, taille); await brancher(ctx, st);
    const pg = await ctx.newPage();
    await pg.clock.install();
    await pg.goto(`http://localhost:${PORT}/?connexion`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('input[type=password]', { timeout: 10000 });
    await pg.fill('input[type=email]', ATTENTE); await pg.fill('input[type=password]', 'motdepasse42');
    await pg.click('form button[type=submit]'); await pause(800);
    const ok1 = await clicTexte(pg, "Renvoyer l'email"); await attendrePhrase(pg);
    const t = await texte(pg), a = await attente(pg);
    const boutons = await pg.evaluate(() => ['[data-auth-renvoyer]', '[data-auth-lien-connexion]'].map((s) => { const b = document.querySelector(s); return b ? { off: b.disabled, txt: b.innerText.trim() } : null; }));
    dit(ok1 && !ANGLAIS.test(t), 'aucun message en anglais après « Renvoyer l\'email »', (t.match(ANGLAIS) || [''])[0]);
    dit(!!a && a.n >= 55, 'l\'attente porte le nombre de secondes refusé', a ? String(a.n) : 'aucune phrase');
    dit(boutons.every((x) => x && x.off), '« Renvoyer » ET « Recevoir un lien de connexion » sont grisés pendant l\'attente', JSON.stringify(boutons));
    await unSeulDecompte(pg, 'compte pas confirmé');
    await pg.clock.fastForward(61000); await pause(1200);
    const apres = await pg.evaluate(() => ['[data-auth-renvoyer]', '[data-auth-lien-connexion]'].map((s) => { const b = document.querySelector(s); return b ? b.disabled : null; }));
    dit(apres.every((x) => x === false), 'l\'attente finie : les deux boutons reviennent', JSON.stringify(apres));
    await ctx.close();
  }
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('dist/ absent — lance `npm run build` d’abord'); process.exit(2); }
  await new Promise((res, rej) => { srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est pris — relance avec BANC_PORT=…`) : e)); srv.listen(PORT, res); })
    .catch((e) => { console.error(e.message); process.exit(2); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const t of [390, 1512]) {
      try { await scenarios(nav, t); } catch (e) { dit(false, `scénarios ${t} px`, e.message); }
      try { await changerEmail(nav, t); } catch (e) { dit(false, `changer mon email ${t} px`, e.message); }
    }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) en échec' : '✅ tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
