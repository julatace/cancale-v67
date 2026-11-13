require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC — « DÉCOUVRIR AVEC DES EXEMPLES » MIS EN AVANT (13 nov., lot 48).
//  Un visiteur SANS compte voit VRM rempli de données INVENTÉES, d'un geste, depuis
//  la page d'accueil publique ET depuis l'écran de connexion ; rien n'est
//  enregistré ; le bandeau dit « Exemple — rien n'est enregistré · Créer mon compte ».
//  X1  page d'accueil : « Découvrir avec des exemples » dans le PREMIER écran, à côté
//      de « Essayer gratuitement », 44 px, un vrai lien (`/?exemple`), neutre (le
//      seul bouton à l'accent reste « Essayer ») ; aussi en bas de page ;
//  X2  le toucher ouvre l'app en mode exemple : bandeau en tête, « Créer mon
//      compte » que rien ne couvre, des données inventées à l'écran, AUCUNE requête
//      vers la base (lecture comprise), rien dans le stockage réel ;
//  X3  « Créer mon compte » ⇒ l'inscription (`?inscription`), plus de bandeau,
//      toujours aucune session dans le stockage réel ;
//  X4  écran de connexion : le même geste (« Découvrir avec des exemples »), 44 px ⇒
//      l'exemple, bandeau « Créer mon compte » ;
//  X5  un vendeur CONNECTÉ qui entre dans l'exemple depuis l'app garde « Passer à mes
//      vraies données » (sa session n'est pas touchée).
//  Chaque fois : aucune erreur JS, rien ne déborde. `SHOTS=dossier` range les
//  captures (à REGARDER, §6.2). `LARGEURS=390,1512` / `THEMES=clair,sombre`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10181;
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000ee';
const SESSION = { access_token: 'jeton-exemple-banc', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeuse.connectee@exemple.test', totp: [] } };

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// Un appareil. `connecte` : une vraie session dans le stockage. `journal.base` : chaque
// requête qui ATTEINT la base (Supabase) ou /api, avec la phase où elle part.
async function appareil(nav, { W, sombre, connecte = false }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const journal = { erreurs: [], base: [], phase: 'avant' };
  pg.on('pageerror', (e) => journal.erreurs.push(String(e.message || e).slice(0, 240)));
  await pg.addInitScript(([s, sombre, connecte]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        if (connecte) {
          localStorage.setItem('vrm_session', JSON.stringify(s));
          localStorage.setItem('vrm_local_owner', s.user.id);
          localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' }));
          localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        }
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
  }, [SESSION, sombre, connecte]);
  // La phase suit le DOCUMENT : une requête de l'ancien document n'est pas « de l'exemple ».
  pg.on('framenavigated', (f) => { if (f === pg.mainFrame()) journal.phase = journal.prochaine || journal.phase; });
  await pg.route(/supabase\.co/i, (r) => {
    journal.base.push({ phase: journal.phase, m: r.request().method(), u: r.request().url().replace(/^https?:\/\/[^/]+/, '').slice(0, 120) });
    const u = r.request().url();
    if (/\/auth\/v1\/settings/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ external: { email: true }, disable_signup: false }) });
    if (/\/auth\/v1\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/0' }, body: '[]' });
  });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)(?!.*supabase\.co)/i, (r) => r.abort());
  await pg.route('**/api/**', (r) => { journal.base.push({ phase: journal.phase, m: r.request().method(), u: r.request().url().replace(/^https?:\/\/[^/]+/, '').slice(0, 120) }); return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
  return { ctx, pg, journal, tel };
}
async function capture(pg, nom) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png') });
}
const attendre = async (pg, f, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f().catch(() => false)) return true; await pg.waitForTimeout(250); } return false; };
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
// Un bouton : visible, sa taille, son fond, et si rien ne le couvre.
const bouton = (pg, sel) => pg.evaluate((s) => {
  const e = [...document.querySelectorAll(s)].find((x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
  if (!e) return null;
  const b = e.getBoundingClientRect();
  const dessus = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  const cs = getComputedStyle(e);
  return { texte: e.textContent.trim(), h: b.height, top: b.top, bas: b.bottom, vh: window.innerHeight, tag: e.tagName, href: e.getAttribute('href') || '', fond: cs.backgroundColor,
    libre: !!dessus && (dessus === e || e.contains(dessus)) };
}, sel);
const bandeau = (pg) => pg.evaluate(() => {
  const b = document.querySelector('[data-exemple-bandeau]');
  if (!b) return null;
  const g = b.querySelector('[data-exemple-brancher]');
  const r = g ? g.getBoundingClientRect() : null;
  const dessus = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
  return { texte: b.textContent.replace(/\s+/g, ' ').trim(), sansCompte: b.getAttribute('data-exemple-sans-compte'), geste: g ? g.textContent.trim() : '', h: r ? r.height : 0, libre: !!dessus && !!g && (dessus === g || g.contains(dessus)) };
});
// Le VRAI stockage n'est lisible qu'en dehors de l'exemple : on le relit après la sortie.
const vraieSession = (pg) => pg.evaluate(() => { try { return localStorage.getItem('vrm_session'); } catch (_) { return 'illisible'; } });
const exempleActif = (pg) => pg.evaluate(() => (typeof window.__vrmExemple === 'function' ? window.__vrmExemple().actif : false));
const ecranRempli = (pg) => pg.evaluate(() => { const m = document.querySelector('.vrm-main'); return m ? m.textContent.replace(/\s+/g, ' ').length : 0; });

async function entrerDepuis(o, sel, T, X) {
  // Un banc ne meurt pas, il rapporte : sans le geste, on le dit et on s'arrête là.
  if (!(await o.pg.$(sel))) { dit(false, `${T} ${X} le geste « ${sel} » existe`); return false; }
  o.journal.prochaine = 'exemple';
  await Promise.all([o.pg.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}), o.pg.click(sel)]);
  await o.pg.waitForSelector('[data-exemple-bandeau]', { timeout: 25000 }).catch(() => {});
  await o.pg.waitForSelector('.vrm-main', { timeout: 25000 }).catch(() => {});
  await attendre(o.pg, async () => (await ecranRempli(o.pg)) > 400, 12000);
  await o.pg.waitForTimeout(2500);
  dit(await exempleActif(o.pg), `${T} ${X} le geste ouvre l'app EN MODE EXEMPLE`);
  const b = await bandeau(o.pg);
  dit(b && /Exemple — rien n’est enregistré/.test(b.texte) && b.geste === 'Créer mon compte' && b.sansCompte === '1', `${T} ${X} bandeau « Exemple — rien n’est enregistré · Créer mon compte »`, JSON.stringify(b));
  dit(b && b.libre && (!o.tel || b.h >= 43.5), `${T} ${X} « Créer mon compte » : rien ne le couvre${o.tel ? ', 44 px' : ''}`, JSON.stringify(b));
  dit((await ecranRempli(o.pg)) > 400, `${T} ${X} l'écran est rempli de données inventées`);
  const versBase = o.journal.base.filter((r) => r.phase === 'exemple');
  dit(versBase.length === 0, `${T} ${X} AUCUNE requête vers la base ni /api pendant l'exemple (lecture comprise)`, JSON.stringify(versBase.slice(0, 5)));
  dit(!(await deborde(o.pg)), `${T} ${X} rien ne déborde`);
  return true;
}

async function depuisAccueil(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[accueil ${W}px ${theme}]`;
  const o = await appareil(nav, { W, sombre });
  await o.pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('[data-accueil]', { timeout: 25000 }).catch(() => {});
  await o.pg.waitForTimeout(1200);
  const x = await bouton(o.pg, '[data-cta="exemple"]');
  const essai = await bouton(o.pg, '[data-cta="inscription"]');
  dit(x && x.texte === 'Découvrir avec des exemples' && x.tag === 'A' && x.href === '/?exemple', `${T} X1 « Découvrir avec des exemples » : un vrai lien (/?exemple)`, JSON.stringify(x));
  dit(x && x.bas <= x.vh && x.h >= 43.5 && x.libre, `${T} X1 dans le PREMIER écran, 44 px, rien ne le couvre`, JSON.stringify(x));
  dit(x && essai && x.fond !== essai.fond, `${T} X1 neutre : l'accent reste à « Essayer gratuitement »`, JSON.stringify([x && x.fond, essai && essai.fond]));
  dit(!!(await o.pg.$('[data-section="fin"] [data-cta="exemple-fin"][href="/?exemple"]')), `${T} X1 le même geste en bas de page`);
  dit(!(await deborde(o.pg)), `${T} X1 rien ne déborde`);
  await capture(o.pg, `ex-${W}-${theme}-1-accueil`);
  if (!(await entrerDepuis(o, '[data-cta="exemple"]', T, 'X2'))) { await o.ctx.close(); return; }
  await capture(o.pg, `ex-${W}-${theme}-2-exemple`);
  // X3 — « Créer mon compte » ⇒ l'inscription, l'exemple disparaît.
  o.journal.prochaine = 'apres';
  await Promise.all([o.pg.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}), o.pg.click('[data-exemple-brancher]')]);
  await o.pg.waitForSelector('[data-auth-valider]', { timeout: 25000 }).catch(() => {});
  await o.pg.waitForTimeout(800);
  const titre = await o.pg.evaluate(() => (document.getElementById('vrm-cx-titre-formulaire') || {}).textContent || '');
  dit(/[?&]inscription/.test(o.pg.url()) && !!(await o.pg.$('[data-auth-valider]')) && /Créer/.test(titre), `${T} X3 « Créer mon compte » ⇒ l'inscription`, `${o.pg.url()} · « ${titre} »`);
  dit(!(await o.pg.$('[data-exemple-bandeau]')) && !(await exempleActif(o.pg)), `${T} X3 plus de bandeau, plus d'exemple`);
  dit((await vraieSession(o.pg)) === null, `${T} X3 aucune session dans le VRAI stockage (rien n'a été enregistré)`);
  await capture(o.pg, `ex-${W}-${theme}-3-inscription`);
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

async function depuisConnexion(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[connexion ${W}px ${theme}]`;
  const o = await appareil(nav, { W, sombre });
  await o.pg.goto(`http://localhost:${PORT}/?connexion`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('[data-auth-valider]', { timeout: 25000 }).catch(() => {});
  await o.pg.waitForTimeout(1200);
  const x = await bouton(o.pg, '[data-cx-exemple-entrer]');
  dit(x && x.texte === 'Découvrir avec des exemples' && x.href === '/?exemple' && x.h >= 43.5 && x.libre, `${T} X4 l'écran de connexion propose « Découvrir avec des exemples » (44 px)`, JSON.stringify(x));
  dit(!(await deborde(o.pg)), `${T} X4 rien ne déborde`);
  await o.pg.evaluate(() => { const e = document.querySelector('[data-cx-exemple-entrer]'); if (e) e.scrollIntoView({ block: 'center' }); });
  await capture(o.pg, `ex-${W}-${theme}-4-connexion`);
  await entrerDepuis(o, '[data-cx-exemple-entrer]', T, 'X4');
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

async function connecte(nav, W, theme) {
  const sombre = theme === 'sombre', T = `[connectée ${W}px ${theme}]`;
  const o = await appareil(nav, { W, sombre, connecte: true });
  await o.pg.addInitScript(() => { try { if (!sessionStorage.getItem('banc_ex')) { sessionStorage.setItem('vrm_mode_exemple', '1'); sessionStorage.setItem('banc_ex', '1'); } } catch (_) {} });
  o.journal.prochaine = 'exemple';
  await o.pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('[data-exemple-bandeau]', { timeout: 25000 }).catch(() => {});
  const b = await bandeau(o.pg);
  dit(b && b.sansCompte === '0' && b.geste === 'Passer à mes vraies données' && /rien n’est enregistré/.test(b.texte), `${T} X5 entré depuis l'app, connectée : « Passer à mes vraies données »`, JSON.stringify(b));
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) {
      await depuisAccueil(nav, W, th);
      await depuisConnexion(nav, W, th);
      await connecte(nav, W, th);
    }
  } catch (e) { ko++; console.log('KO  le banc a planté — ' + (e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
