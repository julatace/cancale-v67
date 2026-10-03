// ════════════════════════════════════════════════════════════════════════════
//  BANC « NUMÉROS À LETTRES » — B125, C123… (Julien, 2 octobre : « toutes les
//  personnes n'utilisent pas les mêmes numéros, rends la chose adaptable »).
//
//  Ce qui doit tenir, rendu pour de vrai sur l'écran Annonces :
//   1. un numéro à lettres BRÛLÉ reste dans le pool quand la numérotation
//      automatique le réécrit (avant : `parseInt` le jetait → « B125 » pouvait
//      redevenir libre, le seul risque irréversible de l'app, §5) ;
//   2. « b125 » tapé sur une paire alors qu'une AUTRE paire en ligne porte
//      « B125 » est REFUSÉ (avant : chaînes exactes → deux paires, un carton) ;
//   3. sans réglage, la nouvelle paire reçoit le prochain ENTIER (rien ne change
//      pour qui numérote en chiffres) ; avec la série « B », elle reçoit B1.
//  Aucune fixture : tout est synthétique.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');   // jamais un chemin absolu (§6.1)
const PORT = 4504;
const auj = new Date();
const ann = (id, title) => ({ id, title, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 3, favourite_count: 0, created_at_ts: Math.floor(Date.now() / 1000) - 86400 });
const ITEMS = [ann(9201, 'Nike Air Max 90 blanc taille 42'), ann(9202, 'Salomon XT-6 noir taille 41'), ann(9203, 'Adidas Samba vert taille 40')];
const POOL = [1, 2, 3, 4, 5, 6, 7, 'B125'];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log(`  ❌ le port ${PORT} est pris (${e.code}) — relance le banc seul`); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function rendre(b, main) {
  const rows = [
    { id: 'main', data: main },
    { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS } } },
  ];
  const ecrits = [];
  const ctx = await b.newContext({ viewport: { width: 1512, height: 950 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (req.method() !== 'GET') {
      try { const bd = JSON.parse(req.postData() || '[]'); (Array.isArray(bd) ? bd : [bd]).forEach((row) => { if (row && row.id === 'main' && row.data) ecrits.push(row.data); }); } catch (_) {}
      return j([]);
    }
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(6000);
  return { pg, ctx, errs, ecrits };
}
const local = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    console.log('\n── Numérotation en chiffres (aucun réglage) : B125 est déjà pris par 9201');
    {
      const main = { vinted_annonce_numeros: { '9201': { numero: 'B125' }, '9202': { numero: '7' } }, vinted_used_numeros: POOL };
      const { pg, ctx, errs, ecrits } = await rendre(b, main);
      const nums = (await local(pg, 'vinted_annonce_numeros')) || {};
      dit(String((nums['9203'] || {}).numero) === '8', 'la nouvelle paire reçoit le prochain ENTIER libre (8) — rien ne change en chiffres', JSON.stringify(nums['9203'] || null));
      const pools = [await local(pg, 'vinted_used_numeros'), ...ecrits.map((d) => d.vinted_used_numeros).filter(Array.isArray)];
      const perdu = pools.filter((p) => Array.isArray(p) && !p.map(String).includes('B125'));
      dit(perdu.length === 0, 'B125 reste dans le pool quand la numérotation automatique le réécrit', `${perdu.length} pool(s) sans B125 : ${JSON.stringify(perdu[0] || null)}`);
      // « b125 » sur 9202 : la même boîte que la B125 de 9201, encore en ligne.
      let refuse = false, titre = '';
      try {
        await pg.click('[data-carte-annonce="9202"] [data-edition="numero"]', { timeout: 4000 });
        await pg.keyboard.press('Control+A'); await pg.keyboard.type('b125'); await pg.keyboard.press('Enter');
        await pg.waitForTimeout(1200);
        titre = await pg.evaluate(() => { const t = [...document.querySelectorAll('div,h2,h3')].map((e) => e.textContent || '').find((t) => /déjà pris/i.test(t)); return t ? t.slice(0, 80) : ''; });
        refuse = /déjà pris/i.test(titre);
        if (refuse) { const bt = pg.getByRole('button', { name: /Annuler/ }).first(); await bt.click({ timeout: 3000 }).catch(() => {}); await pg.waitForTimeout(800); }
      } catch (e) { titre = 'clic impossible : ' + String(e.message).slice(0, 80); }
      const apres = (await local(pg, 'vinted_annonce_numeros')) || {};
      const n2 = String((apres['9202'] || {}).numero || '');
      dit(refuse && n2.toUpperCase() !== 'B125', '« b125 » est REFUSÉ quand une autre paire présente porte « B125 » (même carton)', `alerte : « ${titre} » · 9202 = ${n2}`);
      dit(errs.length === 0, 'aucune erreur d\'app', errs.join(' | '));
      await ctx.close();
    }
    console.log('\n── Série « B » choisie dans Réglages');
    {
      const main = { vinted_annonce_numeros: { '9201': { numero: 'B125' }, '9202': { numero: '7' } }, vinted_used_numeros: POOL, vrm_num_prefixe: 'B' };
      const { pg, ctx, errs } = await rendre(b, main);
      const nums = (await local(pg, 'vinted_annonce_numeros')) || {};
      dit(String((nums['9203'] || {}).numero) === 'B1', 'la nouvelle paire reçoit B1 (le premier libre de SA série)', JSON.stringify(nums['9203'] || null));
      dit(String((nums['9201'] || {}).numero) === 'B125' && String((nums['9202'] || {}).numero) === '7', 'les numéros déjà donnés ne bougent pas (B125, 7)');
      dit(errs.length === 0, 'aucune erreur d\'app', errs.join(' | '));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ numéros à lettres : ${ko} rouge(s)` : '\n✅ numéros à lettres : tout est vert');
  process.exit(ko ? 1 : 0);
})();
