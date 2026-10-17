// ═══════════════════════════════════════════════════════════════════════════
// BANC : « COMPTE PRO OU PARTICULIER » — affiché sur chaque compte Vinted lié
//        node scripts/bancs/type-compte.cjs   (BANC_PORT pour changer de port)
// ═══════════════════════════════════════════════════════════════════════════
// 17 octobre — Julien : « elle doit être capable de voir si le compte connecté
// est un compte pro ou non ». Le profil `users/current` (rangé par l'extension
// dans `harvest_{uid}_profile`) porte `business` / `business_account(_id)` —
// mesuré sur sa base. L'écran Comptes liés le dit, avec la MÊME règle que
// l'extension (`typeCompteVinted`). Données inventées, 390 et 1512 px :
//   1. un compte pro (business: true) ⇒ « Pro » sur SA carte ;
//   2. un compte particulier (business: false) ⇒ « Particulier » ;
//   3. un profil sans ces champs ⇒ RIEN (pas su — jamais « Particulier ») ;
//   4. l'extension a publié (`panel_comptes_etat.pro`) ⇒ c'est elle qui gagne.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const fs = require('fs'), http = require('http'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');   // ⚠️ JAMAIS un chemin absolu (§6.1)
const PORT = Number(process.env.BANC_PORT) || 4561;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'camille.martin@exemple.test' } };
const maintenant = new Date().toISOString();
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'boutique_pro_banc', domain: 'www.vinted.fr', updated_at: maintenant },
  { id: 2, vinted_user_id: '222', login: 'perso_banc', domain: 'www.vinted.fr', updated_at: maintenant },
  { id: 3, vinted_user_id: '333', login: 'inconnu_banc', domain: 'www.vinted.fr', updated_at: maintenant },
  { id: 4, vinted_user_id: '444', login: 'ext_banc', domain: 'www.vinted.fr', updated_at: maintenant },
];
const prof = (uid, u) => ({ id: `harvest_${uid}_profile`, data: { uid, type: 'profile', capturedAt: maintenant, payload: { code: 0, user: Object.assign({ id: Number(uid), login: 'x', is_account_banned: false }, u) } } });
const PROFILS = [prof('111', { business: true, business_account: { id: 9 }, business_account_id: 9 }), prof('222', { business: false, business_account: null, business_account_id: null }),
  prof('333', {}), prof('444', { business: false, business_account: null })];
// L'extension (5.185) a publié 444 PRO (un changement que le profil capté n'a pas encore).
const ETAT = { comptes: { '444': { etat: 'actif', at: maintenant, preuve: 'champ profil is_account_banned', pro: true } } };

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, vp) {
  const mobile = vp.width < 600;
  const ctx = await nav.newContext({ viewport: vp, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = decodeURIComponent(r.request().url());
    const j = (d) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (r.request().method() !== 'GET') return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (/id=like\.harvest_\*_profile/.test(u)) return j(PROFILS);
    if (/id=eq\.panel_comptes_etat/.test(u)) return j([{ data: ETAT }]);
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=vintedaccounts`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelectorAll('[data-etat-compte]').length >= 4 || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  return { ctx, pg, erreurs };
}

(async () => {
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ ' + e.message); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const vp of [{ width: 390, height: 900 }, { width: 1512, height: 1000 }]) {
      const T = `${vp.width} px :`;
      const { ctx, pg, erreurs } = await ouvrir(nav, vp);
      const r = await pg.evaluate(() => {
        const cartes = {};
        for (const el of document.querySelectorAll('[data-etat-compte]')) {
          const zone = el.parentElement || el;
          const t = zone.querySelector('[data-type-compte]');
          const nom = zone.querySelector('.vrm-sensible');
          const login = ((nom && nom.innerText) || '').trim();
          cartes[login] = t ? t.getAttribute('data-type-compte') : null;
        }
        return { cartes, tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText) };
      });
      dit(!erreurs.length && !r.tombe, `${T} l'écran Comptes liés se rend sans erreur`, erreurs[0] || '');
      dit(r.cartes.boutique_pro_banc === 'pro', `${T} compte avec business: true ⇒ « Pro »`, JSON.stringify(r.cartes));
      dit(r.cartes.perso_banc === 'particulier', `${T} compte avec business: false ⇒ « Particulier »`);
      dit(r.cartes.inconnu_banc === null, `${T} profil sans les champs ⇒ rien (pas su, jamais « Particulier » par défaut)`);
      dit(r.cartes.ext_banc === 'pro', `${T} ce que l'extension a publié (pro) gagne sur le profil capté plus ancien`);
      await ctx.close();
    }
  } catch (e) { ko++; console.log('❌ le banc a levé — ' + (e && e.message)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge.' : '✅ Chaque compte dit s\'il est pro ou particulier — et se tait quand il ne sait pas.'}`);
  process.exit(ko ? 1 : 0);
})();
