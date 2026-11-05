// ════════════════════════════════════════════════════════════════════════════
//  BANC « NUMÉROS À LA RECONNEXION » — un numéro écrit sur un carton ne bouge
//  JAMAIS tout seul (§5), même après une déconnexion.
//
//  Mesuré le 3 octobre sur sa base : 401 numéros, dont 384 « auto ». Trois
//  migrations d'août (`vinted_num_fix1`, `vinted_num_compact_v1`,
//  `vinted_used_cleaned_v1`) réécrivaient les numéros ou le pool « une seule
//  fois » — mais leur drapeau vivait dans le navigateur, et `authSignOut`
//  l'efface. Après une reconnexion, le nuage remplit le navigateur, l'onglet
//  Vinted se monte, et la première EFFAÇAIT tous les numéros auto (la seconde
//  renumérotait les annonces au-dessus de 42, la troisième rétrécissait le
//  pool — donc des numéros déjà écrits sur des cartons redevenaient libres).
//
//  Ce banc rejoue exactement ça : deux ouvertures dans le même navigateur
//  (Ma journée, puis l'onglet Vinted), sans aucun drapeau, et regarde ce qui
//  repart dans le nuage. Aucune fixture : tout est synthétique.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const { routeMain, ecritesMain } = require('./_base-ecritures.cjs');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');   // jamais un chemin absolu (§6.1)
const PORT = Number(process.env.BANC_PORT) || 4503;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
const JETON = 'jeton-de-banc';
const SESSION = { access_token: JETON, refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeur@exemple.fr' } };
const UID = '900000001';
const COMPTE = { vinted_user_id: UID, login: 'compte-de-banc', access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString() };

// 6 annonces en ligne : 1 numéro posé à la main (7), 5 numéros AUTO (50…54, au-dessus de 42).
const IDS = [1001, 1002, 1003, 1004, 1005, 1006];
const NUMEROS = { '1001': { numero: '7' } };
IDS.slice(1).forEach((id, i) => { NUMEROS[String(id)] = { numero: String(50 + i), auto: true }; });
// Le pool : 60 numéros déjà brûlés (des paires passées, écrits sur des cartons).
const POOL = Array.from({ length: 60 }, (_, i) => i + 1);
const MAIN = { vinted_annonce_numeros: NUMEROS, vinted_used_numeros: POOL, vinted_accounts_hidden: [] };
const item = (id) => ({ id, title: 'Paire ' + id, price: { amount: '40.0', currency_code: 'EUR' }, is_closed: false, photos: [], brand: 'Nike', size: '42' });
const LISTINGS = { id: `harvest_${UID}_listings`, data: { capturedAt: new Date().toISOString(), payload: { items: IDS.map(item) } } };

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

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

// (5 nov.) La ligne `main` à la VRAIE forme (`routeMain`, _base-ecritures.cjs) :
// PATCH conditionnel sur `data->>rev`, écriture acceptée GARDÉE et relue par
// l'ouverture suivante, garde-fou 017. Avant, ce banc ne comptait qu'un corps
// `{ id: 'main' }` (l'ancien upsert) : depuis le 1er nov. il jugeait « 0 fautive
// sur 0 » — un contrôle qui ne pouvait plus échouer (§6.1).
const base = { main: JSON.parse(JSON.stringify(MAIN)), maj: new Date(Date.now() - 86400e3).toISOString(), ecritures: [] };
async function ouvrir(ctx, tab) {
  const pg = await ctx.newPage();
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: JETON, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const req = r.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200) => r.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof d === 'string' ? d : JSON.stringify(d) });
    if (/select=owner&limit=1/.test(u)) return json([{ owner: SESSION.user.id }]);   // base cloisonnée (la production)
    const m = routeMain(req, base); if (m) return json(m.body, m.status);
    if (req.method() !== 'GET') return json([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json([COMPTE]);
    if (/_listings/.test(u)) return json([{ ...LISTINGS, cap: LISTINGS.data.capturedAt }]);
    return json([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(8000);
  const local = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); } catch (_) { return null; } });
  await pg.close();
  return { erreurs, local };
}

(async () => {
  try { await ecouter(); } catch (e) { console.log('  ❌ ' + e.message); process.exit(1); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    console.log('\n── Reconnexion : Ma journée d\'abord, puis l\'onglet Vinted (navigateur sans aucun drapeau)');
    const ctx = await nav.newContext({ viewport: { width: 1512, height: 950 } });
    await ctx.addInitScript((s) => { try { if (!localStorage.getItem('vrm_session')) localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
    const a = await ouvrir(ctx, 'journee');
    const b = await ouvrir(ctx, 'plat_vinted');
    await ctx.close();
    const loc = b.local || {};
    const autoLocaux = Object.values(loc).filter((e) => e && e.auto).length;
    dit(autoLocaux === 5, 'les 5 numéros auto sont toujours là dans le navigateur', `${autoLocaux} sur 5`);
    const memes = Object.keys(NUMEROS).every((k) => loc[k] && String(loc[k].numero) === NUMEROS[k].numero);
    dit(memes, 'aucun numéro n\'a changé (7, 50, 51, 52, 53, 54)', JSON.stringify(Object.fromEntries(Object.entries(loc).map(([k, e]) => [k, e && e.numero]))));
    const ecrits = ecritesMain(base);
    dit(ecrits.length > 0, 'des écritures de `main` partent au nuage et sont jugées', `${ecrits.length} écriture(s) : ${base.ecritures.map((e) => e.meth + ' ' + e.resultat).join(', ')}`);
    const mauvais = ecrits.filter((d) => {
      const n = d.vinted_annonce_numeros; const p = d.vinted_used_numeros;
      if (n && Object.keys(NUMEROS).some((k) => !n[k] || String(n[k].numero) !== NUMEROS[k].numero)) return true;
      if (Array.isArray(p) && POOL.some((x) => !p.map(String).includes(String(x)))) return true;
      return false;
    });
    dit(mauvais.length === 0, 'rien de ce qui repart dans le nuage ne perd ni ne change un numéro, ni ne rétrécit le pool', `${mauvais.length} écriture(s) fautive(s) sur ${ecrits.length}`);
    const nuage = (base.main && base.main.vinted_annonce_numeros) || {};
    dit(Object.keys(NUMEROS).every((k) => nuage[k] && String(nuage[k].numero) === NUMEROS[k].numero) && POOL.every((x) => (base.main.vinted_used_numeros || []).map(String).includes(String(x))), 'le nuage, à la fin, porte toujours 7, 50…54 et tout le pool', JSON.stringify(Object.fromEntries(Object.entries(nuage).map(([k, e]) => [k, e && e.numero]))));
    dit(a.erreurs.length + b.erreurs.length === 0, 'aucune erreur d\'app', [...a.erreurs, ...b.erreurs].join(' | '));
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ numéros à la reconnexion : ${ko} rouge(s)` : '\n✅ numéros à la reconnexion : tout est vert');
  process.exit(ko ? 1 : 0);
})();
