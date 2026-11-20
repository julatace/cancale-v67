require('./_porte-banc.cjs');
// ═════════════════════════════════════════════════════════════════════════════
//  BANC « LA FICHE ET LA LISTE NE SE CONTREDISENT PAS » (20 nov., chasse-bugs-2)
//  Une vente rangée dans « À envoyer » (Ventes) ouvrait une fiche qui cochait « En route ✓ · Livrée ✓ ». Mesuré sur la
//  vraie base (lecture seule) : la vente 2432…391, « Bordereau envoyé au vendeur » (`needs_action`), dont la ligne du
//  transporteur dit « en route » SANS prise en charge lue — la liste (règle du départ : `ventesPartiesParPreuve`,
//  prise en charge prouvée) la garde à envoyer, la frise (`preuvesTransporteur`, plus lâche) la disait partie.
//  Règle : la fiche d'une vente que la liste garde « à envoyer » n'a rien de coché après « Bordereau prêt » ; une
//  preuve que la liste n'accepte pas ne coche rien. Base inventée (_base-volume.cjs, ses ventes à la forme de Vinted),
//  aucune donnée réelle. 390 tactile et 1512 ; jusqu'à 8 rangées de « À envoyer » ouvertes chacune.
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require('playwright');
const { fabriquer, repondre } = require('./_base-volume.cjs');
const R = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(R, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => { let f = decodeURIComponent((q.url || '/').split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== '' ? ' — ' + d : ''}`); };
const APRES = ['enroute', 'livree', 'versement'];

(async () => {
  await new Promise((r) => srv.listen(0, r)); const PORT = srv.address().port;
  const base = fabriquer({ volumeReel: true });
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--no-proxy-server'] });
  try {
    for (const W of [390, 1512]) {
      const tactile = W < 600;
      const ctx = await nav.newContext({ viewport: { width: W, height: tactile ? 844 : 950 }, isMobile: tactile, hasTouch: tactile, locale: 'fr-FR', serviceWorkers: 'block' });
      const pg = await ctx.newPage();
      const erreurs = []; pg.on('pageerror', (e) => { if (!/^\s*at <anonymous>/m.test(String(e.stack || '').split('\n')[1] || '')) erreurs.push(e.message); });
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/supabase\.co/.test(r.request().url()) ? r.fallback() : r.abort()));
      await pg.route('**/rest/v1/**', async (route) => {
        const rq = route.request();
        if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }).catch(() => {});
        const h = await rq.allHeaders().catch(() => ({}));
        const rep = repondre(rq.url(), h.range, base);
        return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body: JSON.stringify(rep.body) }).catch(() => {});
      });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: /mode=abonnement/.test(r.request().url()) ? '{"ok":true,"acces":true,"statut":"active","configure":true}' : '{}' }));
      await pg.goto(`http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-vn-rang]', { timeout: 40000 }).catch(() => {});
      await pg.waitForTimeout(2500);
      const cles = await pg.evaluate(() => [...document.querySelectorAll('[data-vn-rang]')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.getAttribute('data-vn-rang')).slice(0, 8));
      dit(cles.length > 0, `[${W}] « À envoyer » a des rangées à ouvrir`, String(cles.length));
      let contredites = [];
      for (const c of cles) {
        await pg.locator(`[data-vn-rang="${c}"]`).first().click({ timeout: 4000 }).catch(() => {});
        await pg.waitForSelector(`[data-vn-etapes="${c}"]`, { timeout: 6000 }).catch(() => {});
        const et = await pg.evaluate((k) => Object.fromEntries([...document.querySelectorAll(`[data-vn-etapes="${k}"] [data-etape]`)].map((e) => [e.getAttribute('data-etape'), e.getAttribute('data-fait')])), c);
        const coches = APRES.filter((k) => et[k] === '1');
        if (coches.length || et.adeposer === '1') contredites.push(`${c} : ${[et.adeposer === '1' ? 'adeposer' : '', ...coches].filter(Boolean).join(',')}`);
        await pg.keyboard.press('Escape').catch(() => {});
        if (tactile) await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=ventes' })));
        await pg.waitForTimeout(600);
      }
      dit(!contredites.length, `[${W}] une vente gardée « À envoyer » : sa fiche ne coche ni « À déposer », ni « En route », ni « Livrée », ni « Versement » (${cles.length} ouvertes)`, contredites.join(' ¦ '));
      dit(!erreurs.length, `[${W}] aucune erreur`, erreurs.join(' ¦ '));
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  console.log(`\n${ok} OK · ${ko} KO`);
  process.exit(ko ? 1 : 0);
})();
