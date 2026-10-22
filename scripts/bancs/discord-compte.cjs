// ════════════════════════════════════════════════════════════════════════════
//  BANC « DISCORD DANS MON COMPTE » (20 octobre) — RENDU, 1512 px et 390 px
//  tactile (sombre).
//  Julien : « connecter mon compte Discord à mon compte qui est déjà connecté ».
//  Depuis Paramètres → Mon compte, SANS être sur la carte de la communauté :
//    · Discord réglé sur le serveur ⇒ « Se connecter avec Discord » est là ;
//    · le clic part chez Discord, portée « identify » seule, et le retour est
//      demandé vers Mon compte (`ou: compte`) ;
//    · le retour (#discord=…&preuve=…&ou=compte) range le pseudo dans la ligne
//      du COMPTE (`app_data.vrm_discord`, au nom de l'appelant) et l'affiche ;
//    · une preuve faite pour un AUTRE compte VRM est refusée (rien n'est rangé) ;
//    · « Retirer » efface la ligne ;
//    · Discord pas réglé (pas de DISCORD_CLIENT_SECRET) ⇒ pas de bouton.
//  Le VRAI api/compte.js est exécuté ; le faux PostgREST applique RLS (owner =
//  le jeton) sur app_data et la règle de la 019 (`vrm_communaute_discord` exige
//  une présence sur la carte : « invisible »). Aucune fixture : tout est inventé.
//  Preuve par réaffaiblissement : faire rendre `true` à lirePreuve (discord.js)
//  ⇒ « une preuve d'un AUTRE compte est refusée » passe au ROUGE.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
let chromium;
try { ({ chromium } = require(path.join(RACINE, 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || 7461);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + String(d).slice(0, 200) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).split('\n')[0].slice(0, 180)); } };

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const Bu = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (id, email) => `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: id, email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.c2ln`;
const USERS = { [A]: { id: A, email: 'alice@exemple.test' }, [Bu]: { id: Bu, email: 'bruno@exemple.test' } };
const JETONS = {}; for (const u of Object.values(USERS)) JETONS[jwt(u.id, u.email)] = u;
const jetonDe = (id) => Object.keys(JETONS).find((k) => JETONS[k].id === id);
const session = (id) => ({ access_token: jetonDe(id), refresh_token: 'r-' + id, expires_at: Date.now() + 3600e3, user: { id, email: USERS[id].email } });

// ── La base : app_data sous RLS + les profils de la carte (018/019) ──────────
let B;
const reset = () => { B = { lignes: {}, profils: {}, ecritsRefuses: 0 } };   // lignes[owner][id] = data
function fauxSupabase(urlBrut, methode, entetes, corps) {
  const u = decodeURIComponent(String(urlBrut));
  const h = {}; for (const [k, v] of Object.entries(entetes || {})) h[k.toLowerCase()] = v;
  const tok = String(h.authorization || '').replace(/^Bearer\s+/i, '');
  const qui = JETONS[tok]; const uid = qui ? qui.id : null;
  const json = (b, status = 200, hh = {}) => ({ status, body: b === undefined ? '' : JSON.stringify(b), headers: { 'content-type': 'application/json', ...hh } });
  const [chemin, qs = ''] = u.split('?');
  if (/\/auth\/v1\/user/.test(chemin)) return qui ? json({ id: qui.id, email: qui.email, email_confirmed_at: '2026-10-01T00:00:00Z' }) : json({ msg: 'invalid' }, 401);
  if (/\/auth\/v1\//.test(chemin)) return json(qui ? { access_token: tok, refresh_token: 'r', expires_in: 3600, user: { id: qui.id, email: qui.email } } : {});
  const rest = /\/rest\/v1\/(.+)$/.exec(chemin);
  if (!rest) return json({}, 404);
  const cible = rest[1];
  if (cible.startsWith('rpc/')) {
    const fn = cible.slice(4);
    if (fn === 'vrm_acces') return json({ obligatoire: false, proprietaire: false, acces: true });
    if (!uid) return json({ message: 'permission denied' }, 401);
    if (fn === 'vrm_communaute_discord') {
      if (!B.profils[uid]) return json({ ok: false, raison: 'invisible' });
      const d = String((corps.json || {}).p_discord || '').trim().toLowerCase();
      B.profils[uid].discord = d || null; return json({ ok: true, discord: d || null });
    }
    if (fn === 'vrm_communaute_carte') {
      const p = B.profils[uid];
      return json({ acces: true, moi: p ? { pid: 'p-' + uid.slice(0, 4), pseudo: p.pseudo, discord: p.discord || null } : null, profils: [] });
    }
    return json({ code: 'PGRST202' }, 404);
  }
  if (cible === 'app_data' || cible.startsWith('app_data?')) {
    const q = new URLSearchParams(qs);
    const idF = (q.get('id') || '').replace(/^eq\./, ''), ownF = (q.get('owner') || '').replace(/^eq\./, '');
    // La clé de SERVICE (la preuve Discord en attente) : aucune RLS, filtre owner exigé.
    if (process.env.SUPABASE_SERVICE_KEY && h.apikey === process.env.SUPABASE_SERVICE_KEY && !qui) {
      if (methode === 'POST') { for (const r of (Array.isArray(corps.json) ? corps.json : [corps.json])) { B.lignes[r.owner] = B.lignes[r.owner] || {}; B.lignes[r.owner][r.id] = r.data; } return json(undefined, 201); }
      const d = ownF && B.lignes[ownF] && B.lignes[ownF][idF];
      if (methode === 'GET') return json(d ? [{ data: d }] : []);
      if (methode === 'DELETE') { if (d) delete B.lignes[ownF][idF]; return json(undefined, 204); }
      if (methode === 'PATCH') {
        const att = q.get('data->>essais');
        if (!d || (att != null && att !== 'eq.' + String(d.essais))) return json([]);
        B.lignes[ownF][idF] = corps.json.data; return json([{ data: corps.json.data }]);
      }
    }
    if (methode === 'GET') {
      if (!uid || idF !== 'vrm_discord') return json([], 200, { 'content-range': '0-0/0' });
      // RLS : seulement SES lignes, quel que soit le filtre demandé.
      const proprio = ownF && ownF !== uid ? null : uid;
      const d = proprio && B.lignes[proprio] && B.lignes[proprio].vrm_discord;
      return json(d ? [{ discord: d.discord, at: d.at }] : []);
    }
    if (methode === 'POST') {
      const rows = Array.isArray(corps.json) ? corps.json : [corps.json];
      if (!uid || rows.some((r) => r.owner !== uid)) { B.ecritsRefuses++; return json({ message: 'new row violates row-level security policy' }, 403); }
      for (const r of rows) { B.lignes[uid] = B.lignes[uid] || {}; B.lignes[uid][r.id] = r.data; }
      return json(undefined, 201);
    }
    if (methode === 'DELETE') {
      if (uid && (!ownF || ownF === uid) && B.lignes[uid]) delete B.lignes[uid][idF];
      return json(undefined, 204);
    }
  }
  if (cible.startsWith('vinted_accounts') && /owner\.neq\./.test(u))return json([]);
  if (cible.startsWith('vinted_accounts')) return json(uid ? [{ vinted_user_id: '1' + uid.slice(0, 3), login: 'compte', owner: uid }] : []);
  return json([], 200, { 'content-range': '0-0/0' });
}
const fetchReel = global.fetch;
global.fetch = async (url, opts = {}) => {
  const s = String(url);
  if (/supabase\.co\//.test(s)) {
    const r = fauxSupabase(s, opts.method || 'GET', opts.headers || {}, { json: (() => { try { return JSON.parse(opts.body || 'null'); } catch (_) { return null; } })() || {} });
    return new Response(r.body === '' ? null : r.body, { status: r.status, headers: r.headers });
  }
  if (/api\.stripe\.com/.test(s)) return new Response('{}', { status: 404 });
  return fetchReel(url, opts);
};
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

let compte = null;
async function ouvrir(nav, { qui, largeur = 1512, sombre = false, chemin = '/?tab=settings&vue=compte', fragment = '', ticket = '' }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const appels = [];
  await pg.addInitScript(({ s, sombre, ticket }) => {
    try { localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); localStorage.setItem('vrm_reglages_vue', 'compte'); } catch (_) {}
    try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner',s.user.id); } catch (_) {}
    try { if (ticket && !sessionStorage.getItem('banc_ticket_pose')) { sessionStorage.setItem('banc_ticket_pose', '1'); localStorage.setItem('vrm_discord_ticket', JSON.stringify({ t: ticket, ou: 'compte', at: Date.now() })); } } catch (_) {}
  }, { s: session(qui), sombre, ticket });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, async (r) => {
    const rq = r.request(), u = rq.url();
    if (/supabase\.co\//.test(u)) {
      const x = fauxSupabase(u, rq.method(), rq.headers(), { json: (() => { try { return JSON.parse(rq.postData() || 'null'); } catch (_) { return null; } })() || {} });
      return r.fulfill({ status: x.status, headers: x.headers, body: x.body });
    }
    if (/^https:\/\/discord\.com\//.test(u)) { appels.push(u); return r.fulfill({ status: 200, contentType: 'text/html', body: '<p>discord</p>' }); }
    return ['image', 'media', 'font'].includes(rq.resourceType()) ? r.abort() : r.fulfill({ status: 404, body: '' });
  });
  await pg.route('**/api/**', async (r) => {
    const rq = r.request(), u = new URL(rq.url());
    const mode = u.searchParams.get('mode');
    if (u.pathname === '/api/compte' && ['communaute', 'abonnement', 'discord-debut', 'discord-attente', 'confidentialite'].includes(mode)) {
      let corps = null; try { corps = rq.postData() ? JSON.parse(rq.postData()) : null; } catch (_) {}
      if (mode === 'discord-debut') appels.push('debut:' + JSON.stringify(corps));
      if (mode === 'discord-attente') appels.push('attente:' + JSON.stringify(corps));
      const res = { code: 200, corps: null, setHeader() {}, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, end() { return this; } };
      const lecteur = corps ? (async function* () { yield Buffer.from(JSON.stringify(corps)); })() : null;
      const req = { method: rq.method(), query: Object.fromEntries(u.searchParams), headers: rq.headers(), body: corps || undefined, [Symbol.asyncIterator]() { return lecteur ? lecteur[Symbol.asyncIterator]() : (async function* () {})(); } };
      await compte(req, res);
      return r.fulfill({ status: res.code, contentType: 'application/json', body: JSON.stringify(res.corps) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}${chemin}${fragment}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const e = document.querySelector('[data-discord-compte]'); return e && e.getAttribute('data-discord-compte') !== 'chargement'; }, null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(600);
  return { ctx, pg, appels };
}
const attr = (pg, sel, a) => pg.evaluate(([s, x]) => { const e = document.querySelector(s); return e ? e.getAttribute(x) : null; }, [sel, a]);

(async () => {
  try { compte = (await import('file://' + path.join(RACINE, 'api', 'compte.js'))).default; }
  catch (e) { console.log('❌ api/compte.js ne se charge pas : ' + e.message); process.exit(1); }
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  let discordMod;
  try { discordMod = await import('file://' + path.join(RACINE, 'api', '_lib', 'discord.js')); } catch (_) {}
  process.env.DISCORD_CLIENT_ID = '1562176038098702467';
  process.env.DISCORD_CLIENT_SECRET = 'secret-de-banc-0123456789abcdef';
  try {
    for (const [largeur, sombre] of [[1512, false], [390, true]]) {
      console.log(`\n── ${largeur} px${sombre ? ' tactile, sombre' : ''} · Mon compte, pas sur la carte`);
      await essaie(`mon compte ${largeur}`, async () => {
        reset();
        let o = await ouvrir(nav, { qui: A, largeur, sombre });
        dit(await attr(o.pg, '[data-discord-compte]', 'data-discord-compte') === 'aucun', 'Mon compte dit « Aucun compte Discord relié » (sans être sur la carte)');
        const bouton = await o.pg.$('[data-discord-compte-connecter]');
        dit(!!bouton, 'Discord réglé : « Se connecter avec Discord » est dans Mon compte');
        if (bouton) {
          await bouton.click();
          await o.pg.waitForTimeout(1200);
          const d = o.appels.find((x) => /^https:\/\/discord\.com\/oauth2\/authorize\?/.test(x)) || '';
          dit(/scope=identify(&|$)/.test(d), 'le clic part chez Discord (portée « identify » seule)', d.slice(0, 120));
          dit(o.appels.some((x) => x === 'debut:{"ou":"compte"}'), 'le retour est demandé vers Mon compte (`ou: compte`)', o.appels.filter((x) => x.startsWith('debut')).join(' '));
          // Le state signé désigne Mon compte : la route renverra là.
          const st = d ? new URL(d).searchParams.get('state') : '';
          dit(/\.c\.(?:[0-9a-f]{32}\.)?[0-9a-f]{40}$/.test(String(st)), 'le state signé porte « Mon compte »', st);
        }
        await o.ctx.close();

        const preuveA = discordMod.signerPreuve(A, 'alice.discord');
        o = await ouvrir(nav, { qui: A, largeur, sombre, fragment: '#discord=alice.discord&preuve=' + encodeURIComponent(preuveA) + '&ou=compte' });
        await o.pg.waitForSelector('[data-discord-compte="relie"]', { timeout: 8000 }).catch(() => {});
        const ligne = B.lignes[A] && B.lignes[A].vrm_discord;
        dit(!!ligne && ligne.discord === 'alice.discord' && ligne.verifie === true, 'au retour : le pseudo est rangé dans la ligne du COMPTE (vrm_discord, au nom d’Alice)', JSON.stringify(ligne || null));
        dit(!B.profils[A], 'Alice n’est toujours pas sur la carte (rien ne l’y met toute seule)');
        dit(await attr(o.pg, '[data-discord-compte-pseudo]', 'data-discord-compte-pseudo') === 'alice.discord', 'Mon compte affiche « Discord relié : alice.discord »');
        dit(!/discord=/.test(await o.pg.evaluate(() => location.hash)), 'le fragment est effacé de l’adresse');
        // « Retirer » efface.
        await o.pg.click('[data-discord-compte-retirer]');
        await o.pg.waitForTimeout(700);
        // Le bouton de confirmation a le focus (feuille de l'app) : Entrée confirme.
        await o.pg.keyboard.press('Enter');
        await o.pg.waitForSelector('[data-discord-compte="aucun"]', { timeout: 8000 }).catch(() => {});
        dit(!(B.lignes[A] && B.lignes[A].vrm_discord), '« Retirer » efface la ligne du compte');
        dit(await attr(o.pg, '[data-discord-compte]', 'data-discord-compte') === 'aucun', 'Mon compte redit « Aucun compte Discord relié »');
        await o.ctx.close();

        // Une preuve faite pour un AUTRE compte VRM.
        reset();
        o = await ouvrir(nav, { qui: A, largeur, sombre, fragment: '#discord=pirate.vrm&preuve=' + encodeURIComponent(discordMod.signerPreuve(Bu, 'pirate.vrm')) + '&ou=compte' });
        await o.pg.waitForSelector('[data-discord-compte-msg]', { timeout: 8000 }).catch(() => {});
        dit(!(B.lignes[A] && B.lignes[A].vrm_discord) && !(B.lignes[Bu] && B.lignes[Bu].vrm_discord), 'une preuve faite pour un AUTRE compte VRM est refusée (rien n’est rangé)');
        const msg = await o.pg.$eval('[data-discord-compte-msg]', (e) => e.innerText).catch(() => '');
        dit(/expiré|ne vient pas de toi/.test(msg), 'et c’est dit', msg);
        await o.ctx.close();
      });
    }
    console.log('\n── 1512 px · déjà sur la carte : le pseudo vérifié y va aussi');
    await essaie('sur la carte', async () => {
      reset(); B.profils[A] = { pseudo: 'Alice' };
      const o = await ouvrir(nav, { qui: A, fragment: '#discord=alice.discord&preuve=' + encodeURIComponent(discordMod.signerPreuve(A, 'alice.discord')) + '&ou=compte' });
      await o.pg.waitForSelector('[data-discord-compte="relie"]', { timeout: 8000 }).catch(() => {});
      dit(B.profils[A].discord === 'alice.discord', 'sur la carte : le pseudo Discord vérifié s’y affiche aussi');
      await o.ctx.close();
    });
    // ── TÉLÉPHONE, retour arrivé dans un AUTRE navigateur (revue de sécurité du
    //    21 oct.) : la preuve rangée ne sort qu'avec le code montré là-bas.
    //    Sans lui, quelqu'un qui envoyait SON lien à une autre personne prenait
    //    le pseudo Discord vérifié de celle-ci.
    for (const [largeur, sombre] of [[390, true], [1512, false]]) {
      console.log(`\n── ${largeur} px · Discord sur le téléphone : le code à retaper`);
      await essaie(`code ${largeur}`, async () => {
        reset();
        process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
        const r = { h: {}, corps: null, statusCode: 200, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, status(n) { this.statusCode = n; return this; }, json(x) { this.corps = x; return this; }, end(x) { this.sortie = x; return this; } };
        await discordMod.debutDiscord({}, r, { id: A }, { ou: 'compte' });
        const ticket = r.corps.ticket, state = new URL(r.corps.url).searchParams.get('state');
        const faux = async (url, o) => /oauth2\/token/.test(url) ? { ok: true, json: async () => ({ access_token: 't' }) } : /users\/@me/.test(url) ? { ok: true, json: async () => ({ username: 'alice.discord', discriminator: '0' }) } : global.fetch(url, o);
        const r2 = { h: {}, statusCode: 200, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, end(x) { this.sortie = x; return this; } };
        await discordMod.retourDiscord({ query: { code: 'abcdefghij12', state }, headers: { cookie: '' } }, r2, faux);
        const pageAilleurs = String(r2.sortie || '');
        const code = ((/data-discord-code="">(\d{3}) (\d{3})</.exec(pageAilleurs) || []).slice(1).join(''));
        dit(/^\d{6}$/.test(code), 'la page de l’autre navigateur montre un code à 6 chiffres', pageAilleurs.slice(-300));
        const o = await ouvrir(nav, { qui: A, largeur, sombre, ticket });
        await o.pg.waitForSelector('[data-discord-demande-code]', { timeout: 8000 }).catch(() => {});
        dit(!!(await o.pg.$('[data-discord-demande-code]')), 'de retour dans VRM : une feuille demande le code', o.appels.filter((x) => x.startsWith('attente')).join(' ') + ' · ticket=' + (await o.pg.evaluate(() => localStorage.getItem('vrm_discord_ticket'))));
        dit(!(B.lignes[A] && B.lignes[A].vrm_discord), 'rien n’est relié avant le code');
        await o.pg.fill('[data-discord-code-saisie]', code === '000000' ? '000001' : '000000');
        await o.pg.click('[data-discord-code-valider]');
        await o.pg.waitForSelector('[data-discord-code-erreur]', { timeout: 8000 }).catch(() => {});
        const err = await o.pg.$eval('[data-discord-code-erreur]', (e) => e.innerText).catch(() => '');
        dit(/pas le bon code/i.test(err) && !(B.lignes[A] && B.lignes[A].vrm_discord), 'un mauvais code : dit, et rien n’est relié', err);
        const cible = await o.pg.$('[data-discord-code-saisie]');
        const bb = cible ? await cible.boundingBox() : null;
        const bv = await o.pg.$('[data-discord-code-valider]'); const bbv = bv ? await bv.boundingBox() : null;
        dit(!!bb && bb.height >= 44 && !!bbv && bbv.height >= 44 && bb.x >= 0 && bb.x + bb.width <= largeur, 'champ et bouton à 44 px, dans l’écran', JSON.stringify([bb, bbv]));
        await o.pg.fill('[data-discord-code-saisie]', code.slice(0, 3) + ' ' + code.slice(3));
        await o.pg.click('[data-discord-code-valider]');
        await o.pg.waitForSelector('[data-discord-compte="relie"]', { timeout: 10000 }).catch(() => {});
        const ligne = B.lignes[A] && B.lignes[A].vrm_discord;
        dit(!!ligne && ligne.discord === 'alice.discord' && ligne.verifie === true, 'le bon code (même tapé avec une espace) : Discord est relié au compte', JSON.stringify(ligne || null) + ' · ' + o.pg.url() + ' · ' + o.appels.filter((x) => x.startsWith('NAV')).slice(-2).join(' ').slice(-190));
        dit(!Object.keys(B.lignes['00000000-0000-0000-0000-000000000000']||{}).some(k=>k.startsWith('discord_attente_')), 'la preuve en attente privée est effacée (une seule fois)');
        dit(!(await o.pg.$('[data-discord-demande-code]')), 'la feuille est partie');
        await o.ctx.close();
      });
    }
    console.log('\n── 1512 px · Discord pas réglé sur le serveur');
    await essaie('pas réglé', async () => {
      reset(); delete process.env.DISCORD_CLIENT_SECRET;
      const o = await ouvrir(nav, { qui: A });
      dit(await attr(o.pg, '[data-discord-compte]', 'data-discord-compte') === 'aucun' && !(await o.pg.$('[data-discord-compte-connecter]')), 'Discord pas réglé : pas de bouton (la ligne le dit)');
      await o.ctx.close();
    });
    console.log('\n── la route : le retour revient dans Mon compte');
    await essaie('route', async () => {
      process.env.DISCORD_CLIENT_SECRET = 'secret-de-banc-0123456789abcdef';
      const r = { h: {}, corps: null, statusCode: 200, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, status(n) { this.statusCode = n; return this; }, json(x) { this.corps = x; return this; }, end() { return this; } };
      await discordMod.debutDiscord({}, r, { id: A }, { ou: 'compte' });
      const nonce = (/vrm_discord_etat=([0-9a-f]{32})/.exec(String(r.h['set-cookie'])) || [])[1];
      const state = new URL(r.corps.url).searchParams.get('state');
      const faux = async (url) => /token/.test(url) ? { ok: true, json: async () => ({ access_token: 't' }) } : { ok: true, json: async () => ({ username: 'alice.discord', discriminator: '0' }) };
      const r2 = { h: {}, statusCode: 200, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, end() { return this; } };
      await discordMod.retourDiscord({ query: { code: 'abcdefghij12', state }, headers: { cookie: 'vrm_discord_etat=' + nonce } }, r2, faux);
      const loc = String(r2.h.location || '');
      dit(/^\/\?tab=settings&vue=compte#discord=alice\.discord&preuve=[^&]+&ou=compte$/.test(loc), 'le retour de Discord renvoie à Paramètres → Mon compte', loc);
    });
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
