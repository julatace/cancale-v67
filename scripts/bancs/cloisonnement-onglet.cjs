require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC — DEUX VENDEURS DANS LE MÊME ONGLET (11 nov., Julien : « aucun vendeur
//  ne voit jamais rien d'un autre »)
//
//  A (un vendeur INVENTÉ au volume réel : 2 comptes Vinted, annonces, ventes,
//  achats, conversations — `_base-volume.cjs`) est connecté ; il ouvre ses
//  écrans (les copies sur l'appareil, les mémoires du module et le cache se
//  remplissent). Puis, SANS recharger : profil → « Se déconnecter » → confirmer ;
//  l'écran de connexion ; B (un vendeur NEUF, base vide) tape son e-mail et son
//  mot de passe dans le MÊME onglet. B ouvre chaque écran.
//
//  La base du banc applique la RLS : un jeton ne lit et n'écrit que les lignes
//  de SON vendeur (comme Supabase). Ce qui pourrait montrer A à B est donc
//  côté APPAREIL : localStorage, copies IndexedDB (lot K), Cache Storage,
//  mémoires de module, état React qui survit à la déconnexion.
//
//  Relevé de TEXTE (§6.4 : la donnée, jamais un libellé) : l'ensemble des
//  chaînes propres à A (pseudos, titres d'annonces, de ventes, d'achats) ;
//  · contrôle d'abord que A les VOIT (sinon le banc ne mesure rien) ;
//  · puis qu'AUCUNE n'apparaît sur aucun écran de B (texte visible ET attributs
//    title/aria-label/alt), ni dans le localStorage après la connexion de B ;
//  · qu'aucune écriture partie sous le jeton de B ne porte une donnée de A (le
//    cas qui DÉTRUIT : l'appareil repousse les numéros de A chez B).
//  `BANC_MUTATION=base-sans-rls` : la base sert les lignes de A à n'importe qui
//  ⇒ le banc DOIT rougir (preuve qu'il voit une fuite).
//  `SHOTS=dossier` (captures à REGARDER), `LARGEURS=390,1512`, `THEMES=clair,sombre`,
//  `BANC_PORT` (défaut 10291), `BANC_DIST`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { fabriquer, repondre } = require('./_base-volume.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10291;
const SHOTS = process.env.SHOTS || '';
const MUTATION = process.env.BANC_MUTATION || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };

const A = { id: '1a1a1a1a-0000-4000-8000-00000000000a', email: 'vendeuse.a@exemple.test', jeton: 'jeton-banc-A', renouv: 'r-banc-A' };
const B = { id: '2b2b2b2b-0000-4000-8000-00000000000b', email: 'vendeur.b@exemple.test', jeton: 'jeton-banc-B', renouv: 'r-banc-B', mdp: 'MotDePasseB-123' };
const ECRANS = ['journee', 'annonces', 'ventes', 'achats', 'messages', 'compta', 'stockvinted', 'favoris', 'emails', 'invoices', 'garage', 'settings', 'vintedaccounts', 'plat_vinted', 'dashboard'];

// ── Les deux bases ──────────────────────────────────────────────────────────
const baseA = fabriquer({ comptes: 2 });
// Pseudos rendus propres à A (aucun écran de B ne peut les écrire par hasard).
const remplacer = (o) => JSON.parse(JSON.stringify(o).replace(/vendeur_(\d)/g, 'vendeuseA_$1').replace(/acheteur(\d+)/g, 'acheteurDeA$1'));
baseA.accounts = remplacer(baseA.accounts); baseA.rows = remplacer(baseA.rows); baseA.main = remplacer(baseA.main);
// A est un vendeur installé : « Ma configuration » ne couvre pas ses écrans.
Object.assign(baseA.main[0].data, { vrm_configuration: { etat: 'fait', at: '2026-11-01T10:00:00.000Z', statut: null, version: 1 }, vrm_bienvenue_vue: { at: 'banc' }, vrm_visite_vue: { at: 'banc' } });
const baseB = { accounts: [], rows: [], main: [] };
// Les chaînes de A : pseudos, titres (annonces, ventes, achats), longues d'au moins 8 caractères.
const chainesA = (() => {
  const s = new Set();
  const voir = (v, k) => {
    if (v == null) return;
    if (Array.isArray(v)) { v.forEach((x) => voir(x, k)); return; }
    if (typeof v === 'object') { for (const [kk, vv] of Object.entries(v)) if (kk !== '_pad') voir(vv, kk); return; }
    if (typeof v === 'string' && (k === 'login' || k === 'title') && v.length >= 8 && !/^x+$/.test(v) && !/^Ancienne/.test(v)) s.add(v);
  };
  voir(baseA.accounts); voir(baseA.rows);
  return [...s];
})();

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`); };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

const session = (v) => ({ access_token: v.jeton, refresh_token: v.renouv, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: v.id, email: v.email, email_confirmed_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], factors: [] } });
const qui = (req) => { const h = req.headers(); const t = String(h.authorization || '').replace(/^Bearer\s+/i, ''); return t === A.jeton ? A : t === B.jeton ? B : null; };

async function scenario(nav, W, sombre) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const erreurs = [];
  const ecrituresB = [];
  pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript(([s, sombre]) => {
    try {
      if (!sessionStorage.getItem('banc_init')) {
        localStorage.setItem('vrm_session', JSON.stringify({ ...s, expires_at: Date.now() + 3600e3 }));
        localStorage.setItem('vrm_local_owner', s.user.id);
        localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
  }, [session(A), sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, async (route) => {
    const req = route.request(), u = req.url(), m = req.method();
    const json = (d, st = 200, h = {}) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range', ...h }, body: JSON.stringify(d) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (/\/auth\/v1\/token/.test(u)) {
      let corps = {}; try { corps = JSON.parse(req.postData() || '{}'); } catch (_) {}
      if (/grant_type=password/.test(u)) return String(corps.email || '').toLowerCase() === B.email && corps.password === B.mdp ? json(session(B)) : json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
      const v = corps.refresh_token === A.renouv ? A : corps.refresh_token === B.renouv ? B : null;
      return v ? json(session(v)) : json({ error: 'invalid_grant' }, 400);
    }
    if (/\/auth\/v1\/user/.test(u)) { const v = qui(req); return v ? json(session(v).user) : json({ msg: 'jwt' }, 401); }
    if (/\/auth\/v1\/settings/.test(u)) return json({ external: { email: true, google: false, discord: false }, mailer_autoconfirm: false });
    if (/\/auth\/v1\/(logout|factors)/.test(u)) return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    if (/\/auth\/v1\//.test(u)) return json({});
    if (/\/rest\/v1\//.test(u)) {
      const v = qui(req);
      if (!v) return json([], 401);
      if (m !== 'GET' && m !== 'HEAD') {
        if (v === B) ecrituresB.push({ u, corps: req.postData() || '' });
        return json(m === 'POST' ? [] : [], m === 'POST' ? 201 : 200);
      }
      if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
      // RLS : SA base. La mutation sert celle de A à tout le monde.
      const base = (v === A || MUTATION === 'base-sans-rls') ? baseA : baseB;
      if (/[?&]select=owner(&|$)/.test(u)) return json([]);
      const r = repondre(u, req.headers().range || '', base);
      return json(r.body, r.status, r.headers || {});
    }
    if (/\/api\//.test(u)) {
      const v = qui(req);
      if (/mode=confidentialite/.test(u)) return v ? json({ ok: true, uid: v.id }) : json({ ok: false, raison: 'session' }, 401);
      if (/mode=abonnement/.test(u)) return json({ ok: true, acces: true, proprietaire: false, plan: 'pro', statut: 'active' });
      return json({});
    }
    return route.abort();
  });
  await pg.route(`http://localhost:${PORT}/api/**`, (route) => {
    const req = route.request(), u = req.url(), v = qui(req);
    const json = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(d) });
    if (/mode=confidentialite/.test(u)) return v ? json({ ok: true, uid: v.id }) : json({ ok: false, raison: 'session' }, 401);
    if (/mode=abonnement/.test(u)) return json({ ok: true, acces: true, proprietaire: false, plan: 'pro', statut: 'active' });
    return json({});
  });

  const tag = `${W}-${sombre ? 'sombre' : 'clair'}`;
  const aller = async (ecran) => { await pg.evaluate((e) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: e })), ecran); await pg.waitForTimeout(1600); };
  const texte = () => pg.evaluate(() => {
    const t = [document.body ? document.body.innerText : ''];
    for (const el of document.querySelectorAll('[title],[aria-label],img[alt]')) t.push(el.getAttribute('title') || '', el.getAttribute('aria-label') || '', el.getAttribute('alt') || '');
    return t.join('\n');
  });
  const trouve = (t) => chainesA.filter((c) => t.includes(c));
  const capture = async (nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `${tag}-${nom}.png`) }); };

  // ── 1. A connecté : il VOIT ses données ──
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  const vusParA = new Set();
  for (const e of ['journee', 'annonces', 'ventes', 'achats', 'messages', 'stockvinted']) { await aller(e); trouve(await texte()).forEach((c) => vusParA.add(c)); }
  await capture('1-A-ventes');
  dit(vusParA.size >= 5, `[${tag}] A voit ses propres données (sinon le banc ne mesure rien)`, `${vusParA.size} chaîne(s) de A vues sur ${chainesA.length}`);

  // ── 2. Déconnexion par le geste, sans recharger ──
  await pg.evaluate(() => window.dispatchEvent(new Event('vrm:profil-ouvrir')));
  await pg.waitForTimeout(600);
  const bouton = pg.getByRole('button', { name: 'Se déconnecter', exact: true }).first();
  const okMenu = await bouton.isVisible().catch(() => false);
  dit(okMenu, `[${tag}] le menu du profil propose « Se déconnecter »`);
  if (okMenu) await bouton.click();
  await pg.waitForTimeout(500);
  const confirmer = pg.getByRole('button', { name: 'Se déconnecter', exact: true }).last();
  if (await confirmer.isVisible().catch(() => false)) await confirmer.click();
  await pg.waitForSelector('[data-connexion]', { timeout: 15000 }).catch(() => {});
  await pg.waitForFunction(() => !document.querySelector('.vrm-main'), null, { timeout: 15000 }).catch(() => {});
  const resteApp = await pg.locator('.vrm-main').count();
  dit(resteApp === 0, `[${tag}] après la déconnexion, plus aucun écran de l'app (même onglet, aucun rechargement)`);
  const surCx = trouve(await texte());
  dit(!surCx.length, `[${tag}] l'écran de connexion ne montre rien de A`, surCx.slice(0, 5).join(' · '));
  await capture('2-connexion');

  // ── 3. B se connecte dans le MÊME onglet ──
  const champ = pg.getByRole('textbox', { name: /^Adresse e-?mail$/ });
  if (!(await champ.isVisible().catch(() => false))) { await pg.getByRole('button', { name: /^Se connecter/ }).last().click().catch(() => {}); await pg.getByRole('link', { name: /^Se connecter/ }).last().click().catch(() => {}); }
  await champ.waitFor({ timeout: 10000 }).catch(() => {});
  await champ.fill(B.email).catch(() => {});
  await pg.getByLabel('Mot de passe', { exact: true }).fill(B.mdp).catch(() => {});
  await pg.getByRole('button', { name: 'Se connecter', exact: true }).click().catch(() => {});
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  // Un vendeur neuf : « Ma configuration » et le parcours s'ouvrent — « Plus tard » / ✕ pour voir les écrans.
  for (let i = 0; i < 4; i++) {
    const plusTard = pg.locator('[data-configuration] button:has-text("Plus tard"), [data-parcours-fermer], button:has-text("Plus tard")').first();
    if (!(await plusTard.isVisible().catch(() => false))) break;
    await plusTard.click().catch(() => {}); await pg.waitForTimeout(700);
  }
  const quiConnecte = await pg.evaluate(() => { try { return (JSON.parse(localStorage.getItem('vrm_session') || 'null') || {}).user?.id || ''; } catch (_) { return ''; } });
  dit(quiConnecte === B.id, `[${tag}] B est connecté (session de B rangée)`, quiConnecte || '(aucune)');

  // ── 4. Chaque écran de B : rien de A ──
  for (const e of ECRANS) {
    await aller(e);
    const vus = trouve(await texte());
    dit(!vus.length, `[${tag}] B · écran « ${e} » : aucune donnée de A`, vus.slice(0, 6).join(' · '));
    if (vus.length || ['journee', 'ventes', 'annonces', 'achats'].includes(e)) await capture(`3-B-${e}`);
  }
  // Le localStorage après la connexion de B : rien de A.
  const stock = await pg.evaluate(() => { const o = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o.push(k + '=' + localStorage.getItem(k)); } return o.join('\n'); });
  const dansStock = trouve(stock);
  dit(!dansStock.length, `[${tag}] localStorage après B : aucune donnée de A`, dansStock.slice(0, 4).join(' · '));
  dit(!stock.includes(A.id) || /vrm_local_owner=2b2b/.test(stock) && !stock.replace(/vrm_local_owner=[^\n]*/, '').includes(A.id), `[${tag}] localStorage après B : l'identifiant de A n'y est plus`);
  // Les écritures parties sous le jeton de B : aucune ne porte une donnée de A.
  const fuiteEcrite = ecrituresB.filter((w) => trouve(w.corps).length || w.corps.includes(A.id));
  dit(!fuiteEcrite.length, `[${tag}] aucune écriture de B ne repousse une donnée de A dans SON compte`, fuiteEcrite.slice(0, 2).map((w) => w.u.replace(/^https?:\/\/[^/]+/, '') + ' ← ' + w.corps.slice(0, 160)).join(' | '));
  dit(!erreurs.length, `[${tag}] aucune erreur JavaScript`, erreurs.slice(0, 3).join(' | '));
  await ctx.close();
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('KO  dist/ absent : npm run build d\'abord'); process.exit(1); }
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ ...(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}), args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  console.log(`${chainesA.length} chaînes propres à A relevées${MUTATION ? ` · MUTATION ${MUTATION}` : ''}`);
  try {
    for (const W of LARGEURS) for (const t of THEMES) await scenario(nav, W, t === 'sombre');
  } catch (e) { ko++; console.log('KO  le banc a levé : ' + (e && e.stack || e)); }
  await nav.close(); srv.close();
  console.log(ko ? `\n${ko} KO` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})();
