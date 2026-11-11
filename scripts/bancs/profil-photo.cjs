require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « PROFIL » (11 nov., lot DJ6, branche claude/profil-photo)
//  Julien : « la photo de profil du compte [doit être] celle du compte Discord,
//  Google si la personne a relié son compte ; vérifie la création de compte avec
//  Discord ; je veux pouvoir téléverser une photo de profil, et masquer le nom ;
//  qu'on ne voie pas les Paramètres mais que quand on clique sur le profil ils
//  apparaissent ».
//  La VRAIE app (dist), une fausse base (Supabase et /api simulés). Données inventées.
//   R1  la photo : téléversée > Discord > Google > initiale (data-avatar-source),
//       dans la colonne (1512) et l'en-tête (390) ;
//   R2  Paramètres n'est plus une entrée (colonne, panneau « Plus ») ; la photo ouvre
//       le menu du profil : Paramètres, Appareils connectés, Se déconnecter ; Paramètres
//       s'ouvre de là, par « g p » et par ?tab=settings ;
//   R3  « Masquer mon nom » : un POST {nomMasque:true} ; la colonne dit « Mon compte »,
//       ni le nom ni l'e-mail ; l'en-tête ne porte plus le nom de l'entreprise ;
//   R4  téléverser (fichier inventé 600×400) : recadrage carré, PNG ≤ 256 px envoyé,
//       la photo devient « téléversée » ; « Retirer ma photo » la retire ;
//   R5  « Continuer avec Discord » (connexion) sans compte VRM : le compte créé en
//       silence est annulé (route serveur), l'écran de connexion le dit, AUCUNE app
//       ouverte, session effacée ; refus du serveur ⇒ la porte d'avant ; inscription
//       explicite ⇒ rien d'annulé ; « Créer un nouveau compte avec Discord » repart en
//       « inscription ».
//   R6  « Relier Discord » quand on est DÉJÀ connecté (Paramètres → Mon compte) : la
//       LIAISON de Supabase (`/auth/v1/user/identities/authorize`, avec SA session),
//       jamais une connexion (`/auth/v1/authorize`, qui créerait un compte) ; « manual
//       linking » éteint ⇒ le dire, rester ; retour de Discord ⇒ le même compte, relié.
//  390 px tactile et 1512 px, clair et sombre. BANC_PORT, BANC_DIST, BANC_CAPTURES.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-profil-photo');
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000d6';
const EMAIL = 'julien.banc@exemple.test';
const SESSION = { access_token: 'jeton-banc-profil', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: EMAIL } };
// Une petite photo PNG (carré uni) pour les avatars Discord/Google servis par le banc.
const PNG_1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + String(d).slice(0, 1500) : ''}`); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png') }); } catch (_) {} };
const json = (r, o, st = 200) => r.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': Array.isArray(o) ? (o.length ? `0-${o.length - 1}/${o.length}` : '*/0') : '0-0/1' }, body: JSON.stringify(o) });

// identites : [{provider, avatar}] ; photo : '' ou data:image/png… (téléversée)
async function ouvrir(b, { largeur, sombre, identites = [], photo = '', url = '/?tab=journee', stock = {} }) {
  const mobile = largeur < 700;
  const ctx = await b.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris', deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 200)));
  const etat = { photo: { image: photo, partageCarte: false, nomMasque: false }, posts: [] };
  await pg.addInitScript(([s, sombre, stock]) => { try { if (!sessionStorage.getItem('banc_init')) {
    localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id);
    localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
    localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
    for (const [k, v] of Object.entries(stock)) { localStorage.setItem(k, v); sessionStorage.setItem(k, v); }
    sessionStorage.setItem('banc_init', '1'); } } catch (_) {} }, [SESSION, !!sombre, stock]);
  const fiche = { id: UID, email: EMAIL, identities: [{ provider: 'email', identity_id: 'e-1', identity_data: {} }, ...identites.map((i, n) => ({ provider: i.provider, identity_id: 'i-' + n, last_sign_in_at: new Date(Date.now() - n * 864e5).toISOString(), identity_data: i.provider === 'google' ? { picture: i.avatar } : { avatar_url: i.avatar } }))] };
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/cdn\.discordapp\.com|googleusercontent\.com/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG_1 });
    return r.abort();
  });
  await pg.route('**/auth/v1/**', (r) => {
    const u = r.request().url();
    if (/\/auth\/v1\/settings/.test(u)) return json(r, { external: { discord: true, google: true }, mailer_autoconfirm: false });
    if (/\/auth\/v1\/user/.test(u)) return json(r, fiche);
    return json(r, { access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user });
  });
  await pg.route('**/rest/v1/**', (r) => { const u = r.request().url(); if (/select=owner&limit=1/.test(u)) return json(r, [{ owner: UID }]); return json(r, []); });
  await pg.route('**/api/**', (r) => json(r, {}));
  await pg.route(/\/api\/compte\?mode=profil-avatar/, (r) => {
    if (r.request().method() === 'POST') {
      const j = JSON.parse(r.request().postData() || '{}'); etat.posts.push(j);
      if (typeof j.nomMasque === 'boolean' && !('image' in j)) etat.photo.nomMasque = j.nomMasque;
      else etat.photo = { ...etat.photo, image: j.retirer ? '' : j.image, partageCarte: !j.retirer && !!j.partageCarte };
    }
    return json(r, { ok: true, ...etat.photo });
  });
  await pg.route(/\/api\/compte\?mode=entreprise/, (r) => json(r, { ok: true }));
  await pg.goto(`http://localhost:${srv.address().port}${url}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(5500);
  return { pg, ctx, errs, etat };
}
const visibles = (pg, sel) => pg.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').length, sel);
const toucher = async (pg, sel, mobile) => { const l = pg.locator(sel).filter({ visible: true }).first(); if (mobile) await l.tap({ timeout: 8000 }); else await l.click({ timeout: 8000 }); };
const porteProfil = (largeur) => largeur < 700 ? '[data-profil-tete]' : '[data-nav-compte]';
const sourceAvatar = (pg, largeur) => pg.evaluate((sel) => { const b = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length); const s = b && b.querySelector('[data-avatar-source]'); return s ? s.getAttribute('data-avatar-source') : null; }, porteProfil(largeur));

async function profil(b, largeur, sombre) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'}`;
  // R1 — les sources de la photo.
  for (const [nom, opts, attendu] of [
    ['Discord relié', { identites: [{ provider: 'discord', avatar: 'https://cdn.discordapp.com/avatars/1/a.png' }] }, 'discord'],
    ['Google relié', { identites: [{ provider: 'google', avatar: 'https://lh3.googleusercontent.com/a/x=s96-c' }] }, 'google'],
    ['photo téléversée ET Discord', { identites: [{ provider: 'discord', avatar: 'https://cdn.discordapp.com/avatars/1/a.png' }], photo: 'data:image/png;base64,' + PNG_1.toString('base64') }, 'televersee'],
    ['rien de relié', {}, 'initiale'],
  ]) {
    if (sombre && attendu !== 'discord') continue;   // les quatre sources une fois par largeur ; le sombre sur Discord
    const { pg, ctx, errs } = await ouvrir(b, { largeur, sombre, ...opts });
    try {
      const s = await sourceAvatar(pg, largeur);
      dit(s === attendu, `${tag} · R1 ${nom} : la photo du profil vient de « ${attendu} »`, s);
      if (attendu === 'discord') await capture(pg, `${largeur}-${sombre ? 'sombre' : 'clair'}-coque`);
      if (attendu !== 'discord') { await ctx.close(); continue; }
      // R2 — Paramètres derrière le profil.
      if (mobile) { await toucher(pg, '.vrm-nav-more', true); await pg.waitForTimeout(400); }
      dit(await visibles(pg, '[data-nav-entree="settings"]') === 0, `${tag} · R2 Paramètres n'est plus une entrée de navigation${mobile ? ' (panneau « Plus » ouvert)' : ''}`);
      if (mobile) { await capture(pg, `${largeur}-${sombre ? 'sombre' : 'clair'}-plus`); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); }
      await toucher(pg, porteProfil(largeur), mobile); await pg.waitForTimeout(600);
      const menu = await pg.evaluate(() => { const m = document.querySelector('[data-menu-profil]'); return m ? [...m.querySelectorAll('[data-profil-menu]')].map((e) => e.getAttribute('data-profil-menu')) : null; });
      dit(!!menu && ['masquer', 'parametres', 'appareils', 'deconnexion'].every((x) => menu.includes(x)), `${tag} · R2 la photo ouvre le menu : Masquer mon nom, Paramètres, Appareils connectés, Se déconnecter`, JSON.stringify(menu));
      const cibles = await pg.evaluate(() => [...document.querySelectorAll('[data-menu-profil] [data-profil-menu]')].map((e) => Math.round(e.getBoundingClientRect().height)));
      dit(cibles.length && cibles.every((h) => h >= 44), `${tag} · R2 chaque ligne du menu fait au moins 44 px`, cibles.join(','));
      dit(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${tag} · aucun débordement horizontal`);
      await capture(pg, `${largeur}-${sombre ? 'sombre' : 'clair'}-menu`);
      await toucher(pg, '[data-profil-menu="parametres"]', mobile); await pg.waitForTimeout(1500);
      dit(await pg.locator('.vrm-main[data-ecran="settings"]').count() === 1, `${tag} · R2 « Paramètres » du menu ouvre Paramètres`);
      dit(errs.length === 0, `${tag} · aucune erreur d'app`, errs.join(' | '));
    } catch (e) { dit(false, `${tag} · ${nom} : le scénario a tourné jusqu'au bout`, String(e && e.message).slice(0, 300)); }
    finally { await ctx.close(); }
  }
  if (sombre) return;
  // R3 + R4 — masquer le nom, téléverser, retirer.
  const { pg, ctx, errs, etat } = await ouvrir(b, { largeur, sombre, identites: [{ provider: 'discord', avatar: 'https://cdn.discordapp.com/avatars/1/a.png' }] });
  try {
    const texteCompte = () => pg.evaluate((sel) => { const e = [...document.querySelectorAll(sel)].find((x) => x.getClientRects().length); return e ? e.innerText : ''; }, mobile ? '.vrm-app-header' : '[data-nav-compte]');
    if (!mobile) dit((await texteCompte()).includes(EMAIL), `${tag} · R3 avant : la colonne montre l'e-mail`);
    await toucher(pg, porteProfil(largeur), mobile); await pg.waitForTimeout(500);
    await toucher(pg, '[data-profil-menu="masquer"] input', mobile); await pg.waitForTimeout(700);
    dit(etat.posts.some((p) => p.nomMasque === true && !('image' in p)), `${tag} · R3 « Masquer mon nom » enregistre { nomMasque: true } (et rien d'autre)`, JSON.stringify(etat.posts));
    const menuTxt = await pg.evaluate(() => (document.querySelector('[data-menu-profil]') || {}).innerText || '');
    dit(!menuTxt.includes(EMAIL) && /Nom masqué/.test(menuTxt), `${tag} · R3 le menu dit « Nom masqué », l'e-mail est masqué`, menuTxt.slice(0, 200));
    await capture(pg, `${largeur}-clair-nom-masque`);
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
    const t = await texteCompte();
    dit(!t.includes(EMAIL) && (mobile || /Mon compte/.test(t)), `${tag} · R3 ${mobile ? "l'en-tête" : 'la colonne'} ne montre plus ni nom ni e-mail${mobile ? '' : ' (« Mon compte »)'}`, t.slice(0, 200));
    // R4 — téléverser une photo inventée.
    await toucher(pg, porteProfil(largeur), mobile); await pg.waitForTimeout(900);
    await toucher(pg, '[data-profil-photo]', mobile); await pg.waitForTimeout(300);
    const png = await pg.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const x = c.getContext('2d'); x.fillStyle = '#2a6'; x.fillRect(0, 0, 600, 400); x.fillStyle = '#fff'; x.fillRect(250, 150, 100, 100); return c.toDataURL('image/png').split(',')[1]; });
    await pg.locator('[data-profil-choix-photo] input[type=file]').setInputFiles({ name: 'photo-inventee.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await pg.locator('[data-recadrage]').waitFor({ timeout: 5000 });
    dit(etat.posts.filter((p) => 'image' in p).length === 0, `${tag} · R4 rien n'est envoyé avant « Enregistrer » (recadrage ouvert)`);
    await capture(pg, `${largeur}-clair-recadrage`);
    if (mobile) await toucher(pg, '[data-recadrage-valider]', true); else await pg.locator('[data-recadrage-valider]').evaluate((e) => e.click());
    for (let i = 0; i < 40 && !etat.posts.some((p) => typeof p.image === 'string' && p.image); i++) await pg.waitForTimeout(250);
    await pg.waitForTimeout(500);
    const envoi = etat.posts.find((p) => typeof p.image === 'string' && p.image);
    const dims = envoi ? await pg.evaluate((src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.onerror = () => ok(null); i.src = src; }), envoi.image) : null;
    dit(!!dims && dims[0] === dims[1] && dims[0] <= 256 && /^data:image\/png;base64,/.test(envoi.image) && envoi.image.length < 110000, `${tag} · R4 une photo carrée PNG ≤ 256 px est envoyée (${dims && dims.join('×')})`, JSON.stringify(dims));
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
    dit(await sourceAvatar(pg, largeur) === 'televersee', `${tag} · R4 la photo téléversée passe devant celle de Discord`);
    await toucher(pg, porteProfil(largeur), mobile); await pg.waitForTimeout(900);
    await toucher(pg, '[data-profil-photo]', mobile); await pg.waitForTimeout(300);
    await toucher(pg, '[data-photo-retirer]', mobile); await pg.waitForTimeout(800);
    dit(etat.posts.some((p) => p.retirer === true) && !etat.photo.image, `${tag} · R4 « Retirer ma photo » la retire`);
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
    dit(await sourceAvatar(pg, largeur) === 'discord', `${tag} · R4 retirée : la photo de Discord revient`);
    if (!mobile) {
      await pg.keyboard.press('g'); await pg.keyboard.press('p'); await pg.waitForTimeout(1500);
      dit(await pg.locator('.vrm-main[data-ecran="settings"]').count() === 1, `${tag} · R2 « g p » ouvre toujours Paramètres`);
    }
    dit(errs.length === 0, `${tag} · aucune erreur d'app (masquer, téléverser)`, errs.join(' | '));
  } catch (e) { dit(false, `${tag} · masquer/téléverser : le scénario a tourné jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 1500)); }
  finally { await ctx.close(); }
  // ?tab=settings direct.
  const o = await ouvrir(b, { largeur, sombre, url: '/?tab=settings' });
  dit(await o.pg.locator('.vrm-main[data-ecran="settings"]').count() === 1, `${tag} · R2 ?tab=settings ouvre toujours Paramètres`);
  await o.ctx.close();
}

// R5 — la connexion Discord sans compte VRM.
async function discord(b, largeur, sombre) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'}`;
  const cas = async ({ intention, serveur }) => {
    const ctx = await b.newContext({ viewport: { width: largeur, height: 860 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR' });
    const pg = await ctx.newPage();
    const user = { id: '22222222-2222-4222-8222-2222222222d6', email: 'pseudo@discord.test', created_at: new Date(Date.now() - 20000).toISOString(), last_sign_in_at: new Date(Date.now() - 19000).toISOString(), identities: [{ provider: 'discord' }] };
    const appels = { annuler: 0, supprimer: 0, authorize: null };
    await pg.addInitScript(([intention, sombre]) => { if (sessionStorage.getItem('banc_init')) return; sessionStorage.setItem('banc_init', '1'); sessionStorage.setItem('vrm_pkce', 'verificateur-de-banc'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); if (intention) localStorage.setItem('vrm_oauth_intention', JSON.stringify({ i: intention, p: 'discord', at: Date.now() })); }, [intention, !!sombre]);
    await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
      const u = r.request().url();
      if (/\/auth\/v1\/settings/.test(u)) return json(r, { external: { discord: true, google: true }, mailer_autoconfirm: false });
      if (/grant_type=pkce/.test(u)) return json(r, { access_token: 'jeton', refresh_token: 'r', expires_in: 3600, user });
      if (/\/auth\/v1\/authorize/.test(u)) { appels.authorize = u; return r.fulfill({ status: 204, body: '' }); }   // 204 : la page reste chez VRM, son intention se lit là
      if (/\/auth\/v1\/user/.test(u)) return json(r, user);
      if (/\/rest\/v1\//.test(u)) return json(r, []);
      return r.abort();
    });
    await pg.route('**/api/**', (r) => {
      const u = r.request().url();
      if (/mode=oauth-sans-compte/.test(u)) { appels.annuler++; return serveur === 'annule' ? json(r, { ok: true, annule: true, fournisseur: 'discord' }) : json(r, { ok: false, annule: false, raison: 'pas-vide' }, 409); }
      if (/mode=(supprimer|fermer)/.test(u)) { appels.supprimer++; return json(r, { ok: true }); }
      if (/mode=discord-deja/.test(u)) return json(r, { trouve: false });
      return json(r, {});
    });
    await pg.goto(`http://localhost:${srv.address().port}/?code=code-de-banc`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(3500);
    return { ctx, pg, appels };
  };
  { const { ctx, pg, appels } = await cas({ intention: 'connexion', serveur: 'annule' });
    const t = await pg.evaluate(() => document.body.innerText);
    dit(appels.annuler === 1 && await pg.locator('[data-sans-compte="discord"]').count() === 1, `${tag} · R5 « Continuer avec Discord » sans compte : le compte créé est annulé, l'écran de connexion le dit`, t.slice(0, 200));
    dit(/Aucun compte VRM relié à ce Discord/.test(t) && /relie Discord dans ton profil/.test(t), `${tag} · R5 la phrase : « Aucun compte VRM relié à ce Discord. Connecte-toi d'abord, puis relie Discord dans ton profil »`);
    const sess = await pg.evaluate(() => localStorage.getItem('vrm_session'));
    dit(!sess && await pg.locator('.vrm-main').count() === 0 && await pg.locator('[data-porte-nouveau-oauth]').count() === 0, `${tag} · R5 aucune app ouverte, aucune session gardée`, sess);
    await capture(pg, `${largeur}-${sombre ? 'sombre' : 'clair'}-discord-sans-compte`);
    await toucher(pg, '[data-sans-compte-creer="discord"]', mobile); await pg.waitForTimeout(1200);
    const it = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_oauth_intention') || 'null'); } catch (_) { return null; } });
    dit(!!appels.authorize && /provider=discord/.test(appels.authorize) && it && it.i === 'inscription', `${tag} · R5 « Créer un nouveau compte avec Discord » repart chez Discord en « inscription »`, JSON.stringify([it, appels.authorize, pg.url()]));
    await ctx.close(); }
  { const { ctx, pg, appels } = await cas({ intention: 'connexion', serveur: 'refuse' });
    dit(appels.annuler === 1 && await pg.locator('[data-porte-nouveau-oauth="choix"]').count() === 1 && appels.supprimer === 0, `${tag} · R5 le serveur refuse (compte pas vide) : la porte d'avant, rien supprimé`);
    await ctx.close(); }
  { const { ctx, pg, appels } = await cas({ intention: 'inscription', serveur: 'annule' });
    dit(appels.annuler === 0 && await pg.locator('[data-porte-nouveau-oauth="choix"]').count() === 1, `${tag} · R5 « Créer mon compte avec Discord » (inscription) : rien d'annulé`);
    await ctx.close(); }
}

// R6 — « Relier Discord » depuis un compte DÉJÀ connecté : une liaison, jamais un compte neuf.
async function relier(b, largeur, sombre) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'}`;
  const cas = async (reponse) => {
    const o = await ouvrir(b, { largeur, sombre, url: '/?tab=settings&vue=compte' });
    const appels = { lier: [], connexion: [], discord: '' };
    await o.pg.route('**/auth/v1/authorize**', (r) => { appels.connexion.push(r.request().url()); return r.fulfill({ status: 204, body: '' }); });
    await o.pg.route('**/auth/v1/user/identities/authorize**', (r) => { appels.lier.push({ url: r.request().url(), auth: r.request().headers().authorization || '' }); return reponse === 'off' ? json(r, { code: 404, error_code: 'manual_linking_disabled', msg: 'Manual linking is disabled' }, 404) : json(r, { url: 'https://discord.com/oauth2/authorize?client_id=banc&state=x' }); });
    await o.pg.route(/^https:\/\/discord\.com\//, (r) => { appels.discord = r.request().url(); return r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Discord (banc)</title>' }); });
    return { ...o, appels };
  };
  try {
    const { pg, ctx, appels, errs } = await cas('on');
    const bouton = pg.locator('[data-connexion-relier="discord"]').filter({ visible: true }).first();
    await bouton.waitFor({ timeout: 8000 }).catch(() => {});
    await capture(pg, `${largeur}-${sombre ? 'sombre' : 'clair'}-relier`);
    dit(await bouton.count() === 1, `${tag} · R6 Paramètres → Mon compte propose « Relier Discord »`);
    await bouton.scrollIntoViewIfNeeded().catch(() => {});
    if (mobile) await bouton.tap({ timeout: 8000 }); else await bouton.click({ timeout: 8000 });
    for (let i = 0; i < 30 && !appels.discord; i++) await pg.waitForTimeout(200);
    const l = appels.lier[0];
    dit(appels.lier.length === 1 && /provider=discord/.test(l.url) && l.auth === 'Bearer ' + SESSION.access_token && /code_challenge=/.test(l.url) && /redirect_to=[^&]*tab%3Dsettings/.test(l.url), `${tag} · R6 la LIAISON de Supabase est demandée avec SA session (identities/authorize)`, JSON.stringify(appels.lier));
    dit(appels.connexion.length === 0, `${tag} · R6 aucune connexion Discord (/auth/v1/authorize) : pas de compte neuf`, JSON.stringify(appels.connexion));
    dit(/^https:\/\/discord\.com\/oauth2\/authorize/.test(appels.discord), `${tag} · R6 la page part chez Discord pour autoriser`, appels.discord);
    dit(errs.length === 0, `${tag} · R6 aucune erreur d'app`, errs.join(' | '));
    await ctx.close();
  } catch (e) { dit(false, `${tag} · R6 relier : le scénario a tourné jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 600)); }
  try {
    const { pg, ctx, appels } = await cas('off');
    const bouton = pg.locator('[data-connexion-relier="discord"]').filter({ visible: true }).first();
    await bouton.waitFor({ timeout: 8000 });
    if (mobile) await bouton.tap({ timeout: 8000 }); else await bouton.click({ timeout: 8000 });
    await pg.waitForTimeout(1200);
    const alerte = await pg.evaluate(() => [...document.querySelectorAll('[aria-label="Connexions à VRM"] [role="alert"]')].map((e) => e.innerText).join(' | '));
    dit(/pas encore activée/.test(alerte) && !appels.discord && appels.connexion.length === 0 && /localhost|127\.0\.0\.1/.test(pg.url()), `${tag} · R6 « manual linking » éteint : c'est dit, on reste sur VRM, aucune connexion`, JSON.stringify([alerte, appels, pg.url()]));
    await capture(pg, `${largeur}-${sombre ? 'sombre' : 'clair'}-relier-eteint`);
    await ctx.close();
  } catch (e) { dit(false, `${tag} · R6 éteint : le scénario a tourné jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 600)); }
  // Retour de Discord : le contexte de liaison (même propriétaire) ⇒ le même compte, relié.
  try {
    const liaison = JSON.stringify({ owner: UID, provider: 'discord', verifier: 'verificateur-liaison', at: Date.now() });
    const { pg, ctx, errs } = await ouvrir(b, { largeur, sombre, url: '/?code=code-liaison&tab=settings&vue=compte', identites: [{ provider: 'discord', avatar: 'https://cdn.discordapp.com/avatars/1/a.png' }], stock: { vrm_oauth_liaison: liaison } });
    const t = await pg.evaluate(() => document.body.innerText);
    const sess = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_session') || 'null'); } catch (_) { return null; } });
    dit(/Ton compte Discord est associé à VRM/.test(t) && sess && sess.user && sess.user.id === UID && await pg.locator('[data-porte-sans-compte],[data-porte-nouveau-oauth]').count() === 0, `${tag} · R6 retour de Discord : le même compte VRM, « Ton compte Discord est associé »`, t.slice(0, 200));
    dit(await pg.locator('[data-connexion-compte="discord"][data-connexion-etat="relie"]').count() >= 1, `${tag} · R6 Discord apparaît « relié » (lu sur la fiche)`);
    dit(errs.length === 0, `${tag} · R6 retour : aucune erreur d'app`, errs.join(' | '));
    await capture(pg, `${largeur}-${sombre ? 'sombre' : 'clair'}-relie`);
    await ctx.close();
  } catch (e) { dit(false, `${tag} · R6 retour : le scénario a tourné jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 600)); }
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('  ❌ dist absent — npm run build'); process.exit(1); }
  await new Promise((r) => srv.listen(Number(process.env.BANC_PORT || 0), '127.0.0.1', r));
  const b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const [largeur, sombre] of [[390, true], [390, false], [1512, false], [1512, true]].filter(([l, s]) => !process.env.VUES_SEULES || process.env.VUES_SEULES.split(',').includes(`${l}${s ? 's' : 'c'}`))) {
      console.log(`\n── ${largeur} ${sombre ? 'sombre' : 'clair'}`);
      await profil(b, largeur, sombre);
      await discord(b, largeur, sombre);
      if (!sombre || largeur > 700) await relier(b, largeur, sombre);
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} profil-photo : ${ok} vert(s), ${ko} en échec · captures : ${CAPTURES}`);
  process.exit(ko ? 1 : 0);
})();
