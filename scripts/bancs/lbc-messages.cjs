// Banc : LEBONCOIN → MESSAGES (4 octobre). Données INVENTÉES (il vit dans le dépôt).
// Trois états, jamais deux (« pas su » ≠ « rien ») :
//   · relevé : chaque compte NOMMÉ avec SON nombre de non-lus, et le lien vers la
//     messagerie de Leboncoin ; un compte lié jamais relevé dit « — », pas « 0 » ;
//   · jamais relevé : aucune ligne à zéro, la consigne (ouvrir leboncoin.fr) ;
//   · lecture ratée (522) : ni zéro ni « jamais », la phrase de panne.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4344;
const auj = new Date();
const MSG = { compteurs: { u1: { unread: 4, at: auj.toISOString() } }, comptes: { u1: { name: 'Compte particulier', pro: false, at: auj.toISOString() }, u2: { name: 'Boutique pro', pro: true, at: auj.toISOString() } } };
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
    for (const etat of ['lu', 'jamais', 'panne']) {
      console.log(`── ${etat}`);
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
      await pg.route('**/rest/v1/**', (route) => {
        const u = decodeURIComponent(metaVersData(route.request().url()));
        const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
        if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
        if (/id=eq\.lbc_messages/.test(u)) {
          if (etat === 'panne') return route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
          return j(etat === 'lu' ? [{ data: MSG }] : []);
        }
        return j([]);
      });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
      await pg.goto(`http://localhost:${PORT}/?tab=plat_leboncoin`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(2000);
      try { await pg.click('[data-section="messages"]', { timeout: 5000 }); } catch (e) { dit(false, 'la section « Messages » existe dans Leboncoin', String(e.message).slice(0, 80)); await ctx.close(); continue; }
      await pg.waitForSelector('[data-messages-lbc]', { timeout: 8000 }).catch(() => {});
      const v = await pg.evaluate(() => { const e = document.querySelector('[data-messages-lbc]'); return e ? { etat: e.getAttribute('data-messages-lbc'), t: e.innerText, comptes: [...e.querySelectorAll('[data-compte-lbc]')].map((x) => ({ id: x.getAttribute('data-compte-lbc'), t: x.innerText })), lien: (e.querySelector('[data-ouvrir-messages-lbc]') || {}).href || '' } : null; });
      if (etat === 'lu') {
        dit(v && v.etat === '4', 'le total des non-lus RELEVÉS', v && v.etat);
        const c1 = v && v.comptes.find((c) => c.id === 'u1'), c2 = v && v.comptes.find((c) => c.id === 'u2');
        dit(c1 && /Compte particulier/.test(c1.t) && /\b4\b/.test(c1.t), 'chaque compte est NOMMÉ avec SON nombre', c1 && c1.t.replace(/\n/g, ' · '));
        dit(c2 && /Boutique pro/.test(c2.t) && /—/.test(c2.t) && !/\b0\b/.test(c2.t), 'un compte jamais relevé dit « — », pas « 0 »', c2 && c2.t.replace(/\n/g, ' · '));
      } else if (etat === 'jamais') {
        dit(v && v.etat === 'jamais' && !v.comptes.length, 'jamais relevé : aucune ligne à zéro, la consigne', v && v.t.slice(0, 80));
      } else {
        dit(v && v.etat === 'pas-su' && !/\b0 non lu/.test(v.t) && !/Pas encore de messages/.test(v.t), 'lecture ratée : ni zéro, ni « jamais relevé »', v && v.t.slice(0, 80));
      }
      dit(v && /^https:\/\/www\.leboncoin\.fr\/messages/.test(v.lien), 'le bouton ouvre la messagerie de Leboncoin', v && v.lien);
      const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 160));
      if (etat === 'lu') await pg.screenshot({ path: path.join(require('os').tmpdir(), 'lbc-messages-390.png') });
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ messages Leboncoin : ${ko} rouge(s)` : '\n✅ messages Leboncoin : tout est vert');
  process.exit(ko ? 1 : 0);
})();
