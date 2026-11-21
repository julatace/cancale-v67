require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « CONNEXIONS GOOGLE / DISCORD » (11 nov., lot connexions-oauth)
//  Julien : « je veux qu'il n'y ait aucun bug sur les connexions Google ou Discord ».
//  La VRAIE app (dist), un faux Supabase FIDÈLE : chaque réponse reprend le code de
//  Supabase Auth (lu le 11 nov.) — `/authorize` répond 302 vers `redirect_to` avec
//  `?code=` ou `?error=…&error_code=…&error_description=…` (et la même chose après
//  `#`, avec `sb`), `/token?grant_type=pkce` rend la session ou `{error_code,msg}`,
//  `/user/identities/authorize?skip_http_redirect=true` rend `{url}` ou
//  `manual_linking_disabled`, `DELETE /user/identities/{id}` applique sa règle
//  (dernière identité refusée, e-mail remplacé). Données inventées, aucune base réelle.
//  Chaque parcours est JOUÉ par un clic (ou un retour d'adresse), 390 tactile et 1512 :
//   P1  inscription Google, compte neuf : la porte « J'ai déjà un compte VRM ? »
//   P2  inscription Discord, adresse non vérifiée, confirmation allumée : la phrase
//       « e-mail de confirmation parti », jamais l'anglais ni « annulée »
//   P3  Discord sans adresse (« sans e-mail » éteint) : dit, avec le geste
//   P4  connexion Google, compte relié : l'app s'ouvre, adresse propre
//   P5  connexion Google, MÊME adresse qu'un compte NON relié : le même compte
//       (Supabase relie) et c'est DIT ; aucun second compte
//   P6  connexion Discord, adresse différente : compte neuf annulé, « relie Discord »
//   P7  annulé chez Google : « Connexion avec Google annulée » (pas « Discord »)
//   P8  code déjà servi (double retour) : la phrase française
//   P9  retour sans vérificateur (autre appareil) : la phrase nommant le bouton
//   P10 Relier Discord : liaison (identities/authorize), retour ⇒ relié, même compte
//   P11 Relier Discord déjà pris par un autre compte VRM ⇒ le chemin clair
//   P12 Délier Google, seule façon de se connecter ⇒ refusé, rien envoyé
//   P13 Délier Google quand l'e-mail du compte change ⇒ dit AVANT ; puis délié,
//       la photo passe de Google à Discord
//   P14 (bug mesuré en production) liaison Discord puis déconnexion puis « Continuer
//       avec Discord » : du 1er coup ; retour dans une autre fenêtre qui garde un vieux
//       vérificateur (avec et sans l'identifiant de tentative) : connecté
//  Partout : aucun jeton, code ni `error_*` laissé dans l'adresse, aucune erreur d'app.
//  BANC_DIST, BANC_CAPTURES.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os'), crypto = require('crypto');
const defi = (v) => crypto.createHash('sha256').update(String(v)).digest('base64url');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-connexions-oauth');
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}
const UID = '7a1e0c55-2b1d-4c3e-9f00-00000000c0a1', UID_NEUF = '7a1e0c55-2b1d-4c3e-9f00-00000000c0a2';
const PNG_1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const ANGLAIS = /Unverified email|invalid flow state|Identity is already|Error getting user email|denied the request|Signups not allowed/;
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + String(d).slice(0, 900) : ''}`); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const json = (r, o, st = 200) => r.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
const ilYa = (min) => new Date(Date.now() - min * 60000).toISOString();
const ident = (provider, email, { verifie = true, cree = ilYa(60 * 24 * 30), avatar = '', id = provider + '-1' } = {}) => ({ provider, identity_id: id, id, created_at: cree, last_sign_in_at: cree, identity_data: Object.assign({ email, email_verified: verifie }, provider === 'google' ? { picture: avatar } : provider === 'discord' ? { avatar_url: avatar } : {}) });
const AV_G = 'https://lh3.googleusercontent.com/a/banc=s96-c', AV_D = 'https://cdn.discordapp.com/avatars/1/banc.png';
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png') }); } catch (_) {} };

// Un retour de Supabase vers `redirect_to` : succès (code) ou refus (query ET fragment, comme redirectErrors()).
function adresseRetour(redirect, rep) {
  const u = new URL(redirect);
  if (rep.code) { u.searchParams.set('code', rep.code); return u.href; }
  const q = { error: rep.error }; if (rep.description) q.error_description = rep.description; if (rep.error_code) q.error_code = rep.error_code;
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  const h = new URLSearchParams(q); h.set('sb', '');
  u.hash = h.toString();
  return u.href;
}

// sc : { authorize(provider) → {code}|{error…}, token(corps) → {status, body}, fiche, session, url, stock, apiAnnule }
async function ouvrir(b, largeur, sc) {
  const mobile = largeur < 700;
  sc.flux = sc.flux || {}; sc.n = sc.n || 0;
  const ctx = await b.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, locale: 'fr-FR', timezoneId: 'Europe/Paris', deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  const j = { errs: [], authorize: [], lier: [], tokens: [], supprimes: [], annuler: 0, urls: [] };
  pg.on('pageerror', (e) => j.errs.push(String(e.message || e).slice(0, 200)));
  pg.on('framenavigated', (f) => { if (f === pg.mainFrame()) j.urls.push(f.url()); });
  await pg.addInitScript(([s, stock]) => { try { if (!sessionStorage.getItem('banc_init')) {
    if (s) { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); }
    localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
    for (const [k, v] of Object.entries(stock || {})) localStorage.setItem(k, v);
    sessionStorage.setItem('banc_init', '1'); } } catch (_) {} }, [sc.session || null, sc.stock || {}]);
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/cdn\.discordapp\.com|googleusercontent\.com/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG_1 });
    // Chez Discord / Google (liaison) : il autorise, Supabase renvoie vers VRM.
    if (/^https:\/\/(discord\.com|accounts\.google\.com)\//.test(u)) { const red = sc.lienRetour; const rep = sc.retourLiaison || { code: 'code-liaison-' + (++sc.n) }; if (rep.code) sc.flux[rep.code] = sc.defiLiaison; return r.fulfill({ status: 302, headers: { location: adresseRetour(red, rep) } }); }
    return r.abort();
  });
  await ctx.route('**/auth/v1/**', async (r) => {
    const u = new URL(r.request().url()), m = r.request().method();
    if (/\/auth\/v1\/settings$/.test(u.pathname)) return json(r, { external: { email: true, google: true, discord: true }, mailer_autoconfirm: false });
    if (/\/auth\/v1\/user\/identities\/authorize$/.test(u.pathname)) {
      j.lier.push({ url: u.href, auth: r.request().headers().authorization || '' });
      sc.lienRetour = u.searchParams.get('redirect_to'); sc.defiLiaison = u.searchParams.get('code_challenge');
      if (sc.manualOff) return json(r, { code: 422, error_code: 'manual_linking_disabled', msg: 'Manual linking is disabled' }, 422);
      return json(r, { url: `https://discord.com/oauth2/authorize?client_id=banc&state=x` });
    }
    if (/\/auth\/v1\/user\/identities\/[^/]+$/.test(u.pathname) && m === 'DELETE') {
      const id = decodeURIComponent(u.pathname.split('/').pop()); j.supprimes.push(id);
      const f = sc.fiche; if (f.identities.length <= 1) return json(r, { code: 422, error_code: 'single_identity_not_deletable', msg: 'User must have at least 1 identity after unlinking' }, 422);
      const cible = f.identities.find((i) => i.identity_id === id); if (!cible) return json(r, { code: 422, error_code: 'identity_not_found', msg: "Identity doesn't exist" }, 422);
      f.identities = f.identities.filter((i) => i !== cible);
      if (!f.identities.some((i) => i.identity_data.email === f.email)) f.email = (f.identities.find((i) => i.identity_data.email_verified) || f.identities[0]).identity_data.email;
      return json(r, {});
    }
    if (/\/auth\/v1\/user$/.test(u.pathname)) return sc.fiche ? json(r, sc.fiche) : json(r, { msg: 'invalid JWT' }, 401);
    if (/\/auth\/v1\/authorize$/.test(u.pathname)) {
      j.authorize.push(u.href);
      const rep = Object.assign({}, sc.authorize(u.searchParams.get('provider')));
      if (rep.code) { rep.code = rep.code + '-' + (++sc.n); sc.flux[rep.code] = u.searchParams.get('code_challenge'); }
      const loc = adresseRetour(sc.retourSansEssai ? u.searchParams.get('redirect_to').replace(/\?vrm_essai=[^&]*$/, '') : u.searchParams.get('redirect_to'), rep);
      if (sc.retenir) { sc.retenu = loc; return r.fulfill({ status: 204, body: '' }); }
      return r.fulfill({ status: 302, headers: { location: loc } });
    }
    if (/\/auth\/v1\/token$/.test(u.pathname) && u.searchParams.get('grant_type') === 'pkce') {
      const corps = JSON.parse(r.request().postData() || '{}'); j.tokens.push(corps);
      // Comme Supabase (token.go) : le défi de CE flux doit correspondre, sinon 400 et le code reste valable.
      const d = sc.flux[corps.auth_code];
      if (d && defi(corps.code_verifier) !== d) { j.refusVerif = (j.refusVerif || 0) + 1; return json(r, { code: 400, error_code: 'bad_code_verifier', msg: 'code challenge does not match previously saved code verifier' }, 400); }
      if (d) delete sc.flux[corps.auth_code];
      const t = sc.token(corps, j.tokens.length); return json(r, t.body, t.status);
    }
    if (/\/auth\/v1\/token$/.test(u.pathname)) return json(r, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }, 400);
    return json(r, {});
  });
  await ctx.route('**/rest/v1/**', (r) => { const u = r.request().url(); if (/select=owner&limit=1/.test(u)) return json(r, [{ owner: UID }]); return json(r, []); });
  await ctx.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=oauth-sans-compte/.test(u)) { j.annuler++; return sc.apiAnnule ? json(r, { ok: true, annule: true, fournisseur: 'discord' }) : json(r, { ok: false, annule: false, raison: 'pas-vide' }, 409); }
    if (/mode=profil-avatar/.test(u)) return json(r, { ok: true, image: '', partageCarte: false, nomMasque: false });
    return json(r, {});
  });
  await pg.goto(`http://localhost:${srv.address().port}${sc.url || '/'}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(sc.attente || 3000);
  return { pg, ctx, j };
}
const toucher = async (pg, loc, mobile) => { const l = loc.filter({ visible: true }).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); if (mobile) await l.tap({ timeout: 8000 }); else await l.click({ timeout: 8000 }); };
const texte = (pg) => pg.evaluate(() => document.body.innerText);
const adressePropre = (u) => !/[?&#](code|error|error_code|error_description|access_token|refresh_token|sb)=/.test(u);
const sessionDe = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_session') || 'null'); } catch (_) { return null; } });
const tokenDe = (user) => ({ status: 200, body: { access_token: 'jeton-' + user.id.slice(-4), token_type: 'bearer', expires_in: 3600, refresh_token: 'renouv-' + user.id.slice(-4), user } });
const ficheVieille = (ids, email = 'vendeuse@exemple.test') => ({ id: UID, aud: 'authenticated', email, created_at: ilYa(60 * 24 * 90), last_sign_in_at: ilYa(1), identities: ids, app_metadata: { provider: ids[0].provider } });
const SESSION = (email = 'vendeuse@exemple.test') => ({ access_token: 'jeton-banc', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email } });

// Depuis l'écran de connexion : un clic sur le bouton du fournisseur, puis le retour.
async function parBouton(b, largeur, sc, libelle, { inscription = false } = {}) {
  const mobile = largeur < 700;
  const o = await ouvrir(b, largeur, Object.assign({ url: inscription ? '/?inscription' : '/?connexion' }, sc));
  await toucher(o.pg, o.pg.getByRole('button', { name: libelle }), mobile);
  for (let i = 0; i < 40 && !o.j.authorize.length; i++) await o.pg.waitForTimeout(150);
  await o.pg.waitForTimeout(sc.apres || 4000);
  return o;
}

async function parcours(b, largeur) {
  const mobile = largeur < 700, tag = String(largeur);
  const essai = async (nom, fn) => { if (process.env.SEULS && !process.env.SEULS.split(',').some((x) => nom.startsWith(x))) return; try { await fn(); } catch (e) { dit(false, `${tag} · ${nom} : joué jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 500)); } };

  await essai('P1', async () => {
    const neuf = { id: UID_NEUF, email: 'neuve@gmail.test', created_at: ilYa(0.02), last_sign_in_at: ilYa(0.02), identities: [ident('google', 'neuve@gmail.test', { cree: ilYa(0.02) })] };
    const { pg, ctx, j } = await parBouton(b, largeur, { authorize: () => ({ code: 'code-p1' }), token: () => tokenDe(neuf), fiche: neuf }, /Créer mon compte avec Google/, { inscription: true });
    dit(j.authorize.length === 1 && /provider=google/.test(j.authorize[0]) && /code_challenge_method=s256/.test(j.authorize[0]), `${tag} · P1 inscription Google : un seul départ, PKCE s256`, JSON.stringify(j.authorize));
    dit(j.tokens.length === 1 && /^code-p1-/.test(j.tokens[0].auth_code) && (j.tokens[0].code_verifier || '').length >= 43, `${tag} · P1 le code est échangé une fois, avec le vérificateur`, JSON.stringify(j.tokens));
    dit(await pg.locator('[data-porte-nouveau-oauth]').count() >= 1 && j.annuler === 0, `${tag} · P1 compte neuf voulu (inscription) : rien annulé, la porte « déjà un compte ? »`);
    dit(adressePropre(pg.url()) && !j.errs.length, `${tag} · P1 adresse propre, aucune erreur`, pg.url() + ' ' + j.errs.join('|'));
    await capture(pg, `${tag}-p1-inscription-google`); await ctx.close();
  });

  for (const [p, nomP, rep, attendu, cap] of [
    ['P2', 'Discord non vérifiée, confirmation partie', { error: 'access_denied', error_code: 'provider_email_needs_verification', description: 'Unverified email with discord. A confirmation email has been sent to your discord email' }, /Un e-mail de confirmation est parti vers ton adresse Discord\. Ouvre-le, puis reviens te connecter\./, 'p2-discord-non-verifie'],
    ['P3', 'Discord sans adresse', { error: 'server_error', description: 'Error getting user email from external provider' }, /Discord n’a pas donné d’adresse e-mail/, 'p3-discord-sans-email'],
    ['P7', 'annulé chez Google', { error: 'access_denied', description: 'The resource owner or authorization server denied the request' }, /Connexion avec Google annulée\. Rien n’a changé\./, 'p7-google-annule'],
  ]) await essai(p, async () => {
    const f = /Google/.test(nomP) ? 'Google' : 'Discord';
    const { pg, ctx, j } = await parBouton(b, largeur, { authorize: () => rep, token: () => ({ status: 500, body: {} }) }, new RegExp(p === 'P2' ? `Créer mon compte avec ${f}` : `Continuer avec ${f}`), { inscription: p === 'P2' });
    const t = await texte(pg);
    dit(attendu.test(t), `${tag} · ${p} ${nomP} : la phrase française, avec le geste`, t.slice(0, 400));
    dit(!ANGLAIS.test(t) && (p === 'P7' || !/annulée/.test(t)) && (f === 'Google' ? !/Discord a|avec Discord annulée/.test(t) : true), `${tag} · ${p} jamais l’anglais${p === 'P7' ? ', le bon fournisseur' : ', jamais « annulée »'}`, t.slice(0, 300));
    dit(j.tokens.length === 0 && !(await sessionDe(pg)) && adressePropre(pg.url()), `${tag} · ${p} aucun échange, aucune session, adresse propre (ni error ni #sb)`, pg.url());
    const reste = await pg.evaluate(() => [localStorage.getItem('vrm_pkce'), sessionStorage.getItem('vrm_pkce'), localStorage.getItem('vrm_oauth_intention')]);
    dit(reste.every((x) => !x), `${tag} · ${p} le départ est consommé (vérificateur et intention effacés)`, JSON.stringify(reste));
    await capture(pg, `${tag}-${cap}`); await ctx.close();
  });

  await essai('P4', async () => {
    const fiche = ficheVieille([ident('google', 'vendeuse@exemple.test', { avatar: AV_G })]);
    const { pg, ctx, j } = await parBouton(b, largeur, { authorize: () => ({ code: 'code-p4' }), token: () => tokenDe(fiche), fiche, apres: 6000 }, /Continuer avec Google/);
    const s = await sessionDe(pg);
    dit(s && s.user && s.user.id === UID && await pg.locator('.vrm-main').count() >= 1 && j.annuler === 0, `${tag} · P4 compte relié : la boutique s’ouvre, même compte`, JSON.stringify(s && s.user));
    dit(adressePropre(pg.url()) && j.urls.filter((u) => /code=/.test(u)).length <= 1 && !j.errs.length, `${tag} · P4 le code a quitté l’adresse, aucune erreur`, pg.url() + ' ' + j.errs.join('|'));
    await capture(pg, `${tag}-p4-google-relie`); await ctx.close();
  });

  await essai('P5', async () => {
    const fiche = ficheVieille([ident('email', 'vendeuse@exemple.test'), ident('google', 'vendeuse@exemple.test', { cree: ilYa(0.02), avatar: AV_G })]);
    const { pg, ctx, j } = await parBouton(b, largeur, { authorize: () => ({ code: 'code-p5' }), token: () => tokenDe(fiche), fiche, apres: 4500 }, /Continuer avec Google/);
    const s = await sessionDe(pg), t = await texte(pg);
    dit(s && s.user && s.user.id === UID && j.annuler === 0 && await pg.locator('[data-porte-nouveau-oauth],[data-porte-sans-compte]').count() === 0, `${tag} · P5 même adresse, pas relié : le MÊME compte, aucun second compte`, JSON.stringify(s && s.user));
    dit(/Google est maintenant relié à ton compte VRM \(même adresse e-mail\)/.test(t), `${tag} · P5 et c’est DIT : « Google est maintenant relié… »`, t.slice(0, 300));
    await capture(pg, `${tag}-p5-google-meme-adresse`); await ctx.close();
  });

  await essai('P6', async () => {
    const neuf = { id: UID_NEUF, email: 'autre@discord.test', created_at: ilYa(0.02), last_sign_in_at: ilYa(0.02), identities: [ident('discord', 'autre@discord.test', { cree: ilYa(0.02) })] };
    const { pg, ctx, j } = await parBouton(b, largeur, { authorize: () => ({ code: 'code-p6' }), token: () => tokenDe(neuf), fiche: neuf, apiAnnule: true }, /Continuer avec Discord/);
    const t = await texte(pg);
    dit(j.annuler === 1 && await pg.locator('[data-sans-compte="discord"]').count() === 1 && !(await sessionDe(pg)), `${tag} · P6 Discord d’une autre adresse : compte neuf annulé, aucune session`, t.slice(0, 200));
    dit(/relie Discord dans ton profil/.test(t) && !ANGLAIS.test(t), `${tag} · P6 le chemin : se connecter par e-mail, puis Relier`, t.slice(0, 300));
    await capture(pg, `${tag}-p6-discord-autre-adresse`); await ctx.close();
  });

  await essai('P8', async () => {
    const fiche = ficheVieille([ident('google', 'vendeuse@exemple.test')]);
    const { pg, ctx, j } = await parBouton(b, largeur, { authorize: () => ({ code: 'code-p8' }), token: () => ({ status: 404, body: { code: 404, error_code: 'flow_state_not_found', msg: 'invalid flow state, no valid flow state found' } }), fiche }, /Continuer avec Google/);
    const t = await texte(pg);
    dit(/Cette connexion a expiré ou a déjà servi\. Reclique « Continuer avec Google »\./.test(t) && !ANGLAIS.test(t), `${tag} · P8 code déjà servi : la phrase française`, t.slice(0, 300));
    dit(!(await sessionDe(pg)) && adressePropre(pg.url()), `${tag} · P8 aucune session, adresse propre`, pg.url());
    await capture(pg, `${tag}-p8-code-deja-servi`); await ctx.close();
  });

  await essai('P9', async () => {
    const { pg, ctx, j } = await ouvrir(b, largeur, { url: '/?code=code-p9', stock: { vrm_oauth_intention: JSON.stringify({ i: 'connexion', p: 'discord', at: Date.now() - 30000 }) }, authorize: () => ({}), token: () => ({ status: 500, body: {} }) });
    const t = await texte(pg);
    dit(j.tokens.length === 0 && /commencé sur un autre appareil ou a expiré\. Reclique « Continuer avec Discord » ici\./.test(t), `${tag} · P9 retour sans vérificateur : rien échangé, la phrase nomme le bouton`, t.slice(0, 300));
    dit(adressePropre(pg.url()), `${tag} · P9 adresse propre`, pg.url());
    await ctx.close();
  });

  // ── Mon compte : relier / délier ──────────────────────────────────────
  const COMPTE = '/?tab=settings&vue=compte';
  await essai('P10', async () => {
    const fiche = ficheVieille([ident('email', 'vendeuse@exemple.test')]);
    const o = await ouvrir(b, largeur, { session: SESSION(), fiche, url: COMPTE, attente: 5500, authorize: () => ({}), token: (c) => { fiche.identities.push(ident('discord', 'pseudo@discord.test', { cree: ilYa(0.01), avatar: AV_D })); return tokenDe(fiche); } });
    await toucher(o.pg, o.pg.locator('[data-connexion-relier="discord"]'), mobile);
    for (let i = 0; i < 60 && !o.j.tokens.length; i++) await o.pg.waitForTimeout(150);
    await o.pg.waitForTimeout(4500);
    const l = o.j.lier[0] || {};
    dit(o.j.lier.length === 1 && l.auth === 'Bearer jeton-banc' && /provider=discord/.test(l.url) && o.j.authorize.length === 0, `${tag} · P10 Relier Discord : la LIAISON avec SA session, jamais /authorize`, JSON.stringify([o.j.lier, o.j.authorize]));
    const s = await sessionDe(o.pg), t = await texte(o.pg);
    dit(o.j.tokens.length === 1 && s && s.user && s.user.id === UID && /Ton compte Discord est associé à VRM/.test(t), `${tag} · P10 retour : le même compte, « Ton compte Discord est associé »`, t.slice(0, 200));
    dit(await o.pg.locator('[data-connexion-compte="discord"][data-connexion-etat="relie"]').count() >= 1 && adressePropre(o.pg.url()) && !o.j.errs.length, `${tag} · P10 Discord « relié », adresse propre, aucune erreur`, o.pg.url() + ' ' + o.j.errs.join('|'));
    await capture(o.pg, `${tag}-p10-relier-discord`); await o.ctx.close();
  });

  await essai('P11', async () => {
    const fiche = ficheVieille([ident('email', 'vendeuse@exemple.test')]);
    const o = await ouvrir(b, largeur, { session: SESSION(), fiche, url: COMPTE, attente: 5500, retourLiaison: { error: 'server_error', error_code: 'identity_already_exists', description: 'Identity is already linked to another user' }, authorize: () => ({}), token: () => ({ status: 500, body: {} }) });
    await toucher(o.pg, o.pg.locator('[data-connexion-relier="discord"]'), mobile);
    await o.pg.waitForTimeout(6000);
    const t = await texte(o.pg), s = await sessionDe(o.pg);
    dit(/Ce Discord a déjà son propre compte VRM\. 1\. Déconnecte-toi, puis « Continuer avec Discord »\. 2\. Paramètres → Supprimer mon compte : tape SUPPRIMER\. 3\. Reconnecte-toi ici, puis relie Discord\./.test(t) && !ANGLAIS.test(t), `${tag} · P11 Discord pris par un autre compte VRM : le chemin clair`, t.slice(0, 300));
    dit(s && s.user && s.user.id === UID && o.j.tokens.length === 0 && adressePropre(o.pg.url()), `${tag} · P11 il reste connecté à SON compte, rien échangé, adresse propre`, o.pg.url());
    await capture(o.pg, `${tag}-p11-discord-deja-pris`); await o.ctx.close();
  });

  await essai('P12', async () => {
    const fiche = ficheVieille([ident('google', 'vendeuse@exemple.test', { avatar: AV_G })]);
    const o = await ouvrir(b, largeur, { session: SESSION(), fiche, url: COMPTE, attente: 5500, authorize: () => ({}), token: () => ({ status: 500, body: {} }) });
    await toucher(o.pg, o.pg.locator('[data-connexion-delier="google"]'), mobile);
    await o.pg.waitForTimeout(1500);
    const t = await texte(o.pg);
    dit(/Google est ta seule façon de te connecter/.test(t) && o.j.supprimes.length === 0, `${tag} · P12 Délier la seule façon de se connecter : refusé, rien envoyé`, t.slice(0, 200));
    await o.ctx.close();
  });

  await essai('P13', async () => {
    const fiche = ficheVieille([ident('google', 'vendeuse@gmail.test', { avatar: AV_G, cree: ilYa(60 * 24 * 60) }), ident('discord', 'pseudo@discord.test', { avatar: AV_D, cree: ilYa(60 * 24 * 10) })], 'vendeuse@gmail.test');
    fiche.identities[0].last_sign_in_at = ilYa(1);   // Google le plus récent : c'est sa photo
    const o = await ouvrir(b, largeur, { session: SESSION('vendeuse@gmail.test'), fiche, url: COMPTE, attente: 5500, authorize: () => ({}), token: () => ({ status: 500, body: {} }) });
    const sourceAvant = await o.pg.evaluate((sel) => { const b = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length); const x = b && b.querySelector('[data-avatar-source]'); return x ? x.getAttribute('data-avatar-source') : null; }, mobile ? '[data-profil-tete]' : '[data-nav-compte]');
    await toucher(o.pg, o.pg.locator('[data-connexion-delier="google"]'), mobile);
    await o.pg.waitForTimeout(900);
    const t = await texte(o.pg);
    dit(/Ton e-mail de connexion deviendra pseudo@discord\.test/.test(t) && o.j.supprimes.length === 0, `${tag} · P13 avant le clic : « Ton e-mail de connexion deviendra pseudo@… »`, t.slice(-400));
    await capture(o.pg, `${tag}-p13-delier-confirmer`);
    await toucher(o.pg, o.pg.getByRole('button', { name: /^Délier$/ }).last(), mobile);
    await o.pg.waitForTimeout(3500);
    const t2 = await texte(o.pg);
    const sourceApres = await o.pg.evaluate((sel) => { const b = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length); const x = b && b.querySelector('[data-avatar-source]'); return x ? x.getAttribute('data-avatar-source') : null; }, mobile ? '[data-profil-tete]' : '[data-nav-compte]');
    dit(o.j.supprimes.length === 1 && o.j.supprimes[0] === 'google-1' && /Google n’est plus relié à ton compte VRM/.test(t2), `${tag} · P13 délié sur SON clic, une requête, c’est dit`, JSON.stringify(o.j.supprimes));
    dit(await o.pg.locator('[data-connexion-compte="google"][data-connexion-etat="aucun"]').count() >= 1, `${tag} · P13 la ligne Google repasse « Relier »`);
    dit(sourceAvant === 'google' && sourceApres === 'discord', `${tag} · P13 la photo suit : Google avant, Discord après`, `${sourceAvant} → ${sourceApres}`);
    const s13 = await sessionDe(o.pg);
    dit(s13 && s13.user && s13.user.email === 'pseudo@discord.test' && /pseudo@discord\.test/.test(t2), `${tag} · P13 l’e-mail affiché suit celui que Supabase a posé`, JSON.stringify(s13 && s13.user));
    dit(!o.j.errs.length, `${tag} · P13 aucune erreur d’app`, o.j.errs.join('|'));
    await capture(o.pg, `${tag}-p13-delie`); await o.ctx.close();
  });

  // ── P14 : le vérificateur de CETTE tentative (bug mesuré en production le 11 nov.) ──
  await essai('P14 suite', async () => {
    // Relier Discord, se déconnecter, puis « Continuer avec Discord » : du 1er coup.
    const fiche = ficheVieille([ident('email', 'vendeuse@exemple.test')]);
    const sc = { session: SESSION(), fiche, url: COMPTE, attente: 5500, authorize: () => ({ code: 'code-p14' }), token: () => { if (!fiche.identities.some((i) => i.provider === 'discord')) fiche.identities.push(ident('discord', 'pseudo@discord.test', { cree: ilYa(0.01) })); return tokenDe(fiche); } };
    const o = await ouvrir(b, largeur, sc);
    await toucher(o.pg, o.pg.locator('[data-connexion-relier="discord"]'), mobile);
    for (let i = 0; i < 60 && !o.j.tokens.length; i++) await o.pg.waitForTimeout(150);
    await o.pg.waitForTimeout(3500);
    dit(o.j.tokens.length === 1 && !o.j.refusVerif && /Ton compte Discord est associé/.test(await texte(o.pg)), `${tag} · P14 liaison Discord réussie`, JSON.stringify({ t: o.j.tokens.length, r: o.j.refusVerif }));
    // Déconnexion par le menu du profil (le vrai geste), sinon par l'app elle-même.
    let deco = false;
    try {
      await toucher(o.pg, o.pg.locator(mobile ? '[data-profil-tete]' : '[data-nav-compte]'), mobile); await o.pg.waitForTimeout(600);
      await toucher(o.pg, o.pg.locator('[data-profil-menu="deconnexion"]'), mobile); await o.pg.waitForTimeout(800);
      { const ok = o.pg.getByRole('button', { name: /^Se déconnecter$/ }).last(); if (mobile) await ok.tap({ timeout: 8000 }); else await ok.click({ timeout: 8000 }); } await o.pg.waitForTimeout(1500);
      deco = !(await sessionDe(o.pg));
    } catch (e) { await capture(o.pg, `${tag}-p14-deconnexion`); console.log('     (déconnexion : ' + String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').split('\n').slice(0, 3).join(' ') + ')'); }
    dit(deco, `${tag} · P14 déconnecté par « Se déconnecter »`);
    await o.pg.goto(`http://localhost:${srv.address().port}/?connexion`, { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(2500);
    const avant = o.j.tokens.length;
    await toucher(o.pg, o.pg.getByRole('button', { name: /Continuer avec Discord/ }), mobile);
    for (let i = 0; i < 60 && o.j.tokens.length === avant; i++) await o.pg.waitForTimeout(150);
    await o.pg.waitForTimeout(4000);
    const s = await sessionDe(o.pg);
    dit(o.j.tokens.length === avant + 1 && !o.j.refusVerif && s && s.user && s.user.id === UID, `${tag} · P14 puis « Continuer avec Discord » : connecté du 1er coup, un seul échange, aucun refus`, JSON.stringify({ t: o.j.tokens.length - avant, refus: o.j.refusVerif, u: s && s.user, txt: (await texte(o.pg)).slice(0, 160) }));
    dit(/vrm_essai=[a-z0-9]{6,}/.test(decodeURIComponent(o.j.authorize[o.j.authorize.length - 1] || '')) && adressePropre(o.pg.url()) && !/vrm_essai/.test(o.pg.url()), `${tag} · P14 l’adresse de retour porte la tentative, puis la quitte`, o.pg.url());
    await o.ctx.close();
  });
  for (const sansEssai of [false, true]) await essai('P14 autre contexte', async () => {
    // Départ dans un onglet ; le retour arrive dans une AUTRE fenêtre de VRM (app installée qui
    // capte le lien, onglet dupliqué) dont l'onglet garde le vérificateur d'une vieille tentative.
    const fiche = ficheVieille([ident('discord', 'vendeuse@exemple.test')]);
    const sc = { url: '/?connexion', retenir: true, retourSansEssai: sansEssai, authorize: () => ({ code: 'code-p14b' }), token: () => tokenDe(fiche), fiche };
    const o = await ouvrir(b, largeur, sc);
    await toucher(o.pg, o.pg.getByRole('button', { name: /Continuer avec Discord/ }), mobile);
    for (let i = 0; i < 40 && !sc.retenu; i++) await o.pg.waitForTimeout(150);
    const p2 = await o.ctx.newPage();
    const errs2 = []; p2.on('pageerror', (e) => errs2.push(String(e.message || e)));
    await p2.addInitScript(() => { try { if (!sessionStorage.getItem('banc_vieux')) { sessionStorage.setItem('vrm_pkce', 'v'.repeat(64)); sessionStorage.setItem('banc_vieux', '1'); } } catch (_) {} });
    await p2.goto(sc.retenu, { waitUntil: 'domcontentloaded' }); await p2.waitForTimeout(4000);
    const s = await sessionDe(p2), t = await texte(p2);
    dit(s && s.user && s.user.id === UID && !/expiré ou a déjà servi|n’a pas pu aboutir/.test(t), `${tag} · P14 retour dans une autre fenêtre avec un vieux vérificateur${sansEssai ? ' (Supabase sans l’identifiant : Site URL)' : ''} : connecté`, JSON.stringify({ tokens: o.j.tokens.length, refus: o.j.refusVerif, t: t.slice(0, 200) }));
    dit(sansEssai ? o.j.tokens.length <= 3 : (o.j.tokens.length === 1 && !o.j.refusVerif), `${tag} · P14 ${sansEssai ? 'au plus 3 échanges, le bon trouvé' : 'le bon vérificateur du 1er coup (identifiant de la tentative)'}`, JSON.stringify({ tokens: o.j.tokens.length, refus: o.j.refusVerif }));
    const reste = await p2.evaluate(() => [localStorage.getItem('vrm_pkce'), sessionStorage.getItem('vrm_pkce'), localStorage.getItem('vrm_pkce_essais'), sessionStorage.getItem('vrm_pkce_essais')]);
    dit(reste.every((x) => !x) && adressePropre(p2.url()) && !errs2.length, `${tag} · P14 tout vérificateur effacé après l’échange, adresse propre`, JSON.stringify(reste) + ' ' + p2.url());
    await o.ctx.close();
  });

  // ── P15 : « Appareils connectés » regroupés (capture de Julien : 5 Mac · Chrome…) ──
  await essai('P15', async () => {
    const fiche = ficheVieille([ident('email', 'vendeuse@exemple.test')]);
    const ap = (id, appareil, min, ici) => ({ id: `0000000${id}-0000-4000-8000-00000000000${id}`, appareil, creeLe: ilYa(min + 5), actifLe: ilYa(min), ici: !!ici });
    const LISTE = [ap(1, 'Mac · Chrome', 2, true), ap(2, 'Mac · Chrome', 3), ap(3, 'Mac · Chrome', 60), ap(4, 'Mac · Chrome', 61), ap(5, 'Mac · Chrome', 62), ap(6, 'Mac · Firefox', 300), ap(7, 'Mac · Edge', 10), ap(8, 'iPhone · Safari', 120), ap(9, 'Windows · Chrome', 60 * 24 * 45)];
    const o = await ouvrir(b, largeur, { session: SESSION(), fiche, url: '/?tab=settings&section=appareils', attente: 1500, authorize: () => ({}), token: () => ({ status: 500, body: {} }) });
    const posts = [], logouts = [];
    await o.ctx.route('**/api/compte?mode=appareils', (r) => { if (r.request().method() === 'POST') { const c = JSON.parse(r.request().postData() || '{}'); if (c.action) return json(r, { ok: true, nouveaux: 0 }); posts.push(c.session); return json(r, { ok: true, ferme: c.session }); } return json(r, { ok: true, appareils: LISTE }); });
    await o.ctx.route('**/auth/v1/logout**', (r) => { logouts.push(r.request().url()); return r.fulfill({ status: 204, body: '' }); });
    await o.pg.goto(`http://localhost:${srv.address().port}/?tab=settings&vue=compte`, { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(5000);
    await toucher(o.pg, o.pg.locator('[data-sous-ouvrir="appareils"]'), mobile); await o.pg.waitForTimeout(800);
    await o.pg.waitForSelector('[data-appareils="9"]', { timeout: 10000 }).catch(() => {});
    const avant = await o.pg.evaluate(() => ({
      ici: [...document.querySelectorAll('[data-appareils-ici] [data-appareil-groupe]')].map((g) => [g.getAttribute('data-appareil-groupe'), g.getAttribute('data-groupe-n'), g.innerText.replace(/\n/g, ' · ')]),
      autres: document.querySelector('[data-appareils-autres]') ? document.querySelector('[data-appareils-autres]').getAttribute('data-appareils-autres') : null,
      ouvert: !!(document.querySelector('[data-appareils-autres]') || {}).open,
      boutons: [...document.querySelectorAll('[data-appareil-fermer]')].filter((x) => x.getClientRects().length).length,
    }));
    dit(avant.ici.length === 1 && avant.ici[0][0] === 'Mac · Chrome' && avant.ici[0][1] === '5' && /Cet appareil · 5 connexions · dernière il y a 2 min/.test(avant.ici[0][2]), `${tag} · P15 « Mac · Chrome · cet appareil · 5 connexions · dernière il y a 2 min », en tête`, JSON.stringify(avant.ici));
    dit(avant.autres === '3' && !avant.ouvert && avant.boutons === 0, `${tag} · P15 les autres repliés derrière « Voir les appareils (3) », aucun « Déconnecter » par ligne`, JSON.stringify(avant));
    await capture(o.pg, `${tag}-p15-appareils-replies`);
    await toucher(o.pg, o.pg.locator('[data-appareils-autres] > summary'), mobile); await o.pg.waitForTimeout(400);
    const deplie = await o.pg.evaluate(() => ({ groupes: [...document.querySelectorAll('[data-appareils-autres] [data-appareil-groupe]')].map((g) => g.getAttribute('data-appareil-groupe')), anciennes: (document.querySelector('[data-appareils-anciennes]') || {}).getAttribute ? document.querySelector('[data-appareils-anciennes]').getAttribute('data-appareils-anciennes') : null }));
    dit(deplie.groupes.join('|') === 'Mac · Edge|iPhone · Safari|Mac · Firefox' && deplie.anciennes === '1', `${tag} · P15 déplié : un groupe par appareil, du plus récent ; 1 ancienne (> 30 j) à part`, JSON.stringify(deplie));
    await toucher(o.pg, o.pg.locator('[data-appareil-groupe="Mac · Edge"]'), mobile); await o.pg.waitForTimeout(300);
    dit(await o.pg.locator('[data-appareil-fermer]').filter({ visible: true }).count() === 1, `${tag} · P15 le détail par connexion seulement en dépliant un groupe`);
    await capture(o.pg, `${tag}-p15-appareils-deplies`);
    await toucher(o.pg, o.pg.locator('[data-deconnexion-autres]'), mobile); await o.pg.waitForTimeout(700);
    await capture(o.pg, `${tag}-p15-confirmer-autres`);
    { const okb = o.pg.getByRole('button', { name: /^Déconnecter$/ }).last(); if (mobile) await okb.tap({ timeout: 8000 }); else await okb.click({ timeout: 8000 }); }
    await o.pg.waitForTimeout(1200);
    dit(logouts.length === 1 && /\/auth\/v1\/logout\?scope=others$/.test(logouts[0]) && !!(await sessionDe(o.pg)), `${tag} · P15 « Déconnecter les autres appareils » : confirmé, UN appel scope=others, VRM reste ouvert ici`, JSON.stringify(logouts));
    await toucher(o.pg, o.pg.locator('[data-appareils-fermer-anciennes]'), mobile); await o.pg.waitForTimeout(600);
    { const okb = o.pg.getByRole('button', { name: /^Fermer$/ }).last(); if (mobile) await okb.tap({ timeout: 8000 }); else await okb.click({ timeout: 8000 }); }
    await o.pg.waitForTimeout(1200);
    dit(posts.length === 1 && /9$/.test(posts[0]), `${tag} · P15 « Fermer » les anciennes : sur son clic, seulement elles`, JSON.stringify(posts));
    dit(!o.j.errs.length, `${tag} · P15 aucune erreur d’app`, o.j.errs.join('|'));
    await o.ctx.close();
  });
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('  ❌ dist absent — npm run build'); process.exit(1); }
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const l of [390, 1512].filter((x) => !process.env.LARGEURS || process.env.LARGEURS.split(',').includes(String(x)))) { console.log(`\n── ${l}${l < 700 ? ' tactile' : ''}`); await parcours(b, l); }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} connexions-oauth : ${ok} vert(s), ${ko} en échec · captures : ${CAPTURES}`);
  process.exit(ko ? 1 : 0);
})();
