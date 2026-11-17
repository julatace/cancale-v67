require('./_porte-banc.cjs');
const P = require('./design-passe.cjs'); const { ouvrir, base, srv, PORT, chromium } = P;
const TAB = process.env.TAB || 'annonces', CIBLE = process.env.CIBLE || '.vrm-ventes-controles';
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  const { ctx, pg } = await ouvrir(nav, { W: 390, sombre: false, b, url: '/manifest.webmanifest' });
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_design_v2', '1'); } catch (_) {} });
  await pg.route('**/rest/v1/**', async (r) => { const u = r.request().url(); let h = 0; for (const c of u) h = (h * 31 + c.charCodeAt(0)) >>> 0; await new Promise((ok) => setTimeout(ok, 300 + (h % 1500))); return r.fallback(); });
  await pg.goto(`http://localhost:${PORT}/?tab=${TAB}`, { waitUntil: 'domcontentloaded' });
  let avant = '';
  for (let k = 0; k < 64; k++) {
    const s = await pg.evaluate((CIBLE) => { const c = document.querySelector(CIBLE); if (!c) return 'pas de cible';
      const fil = []; let e = c; while (e && e.parentElement && !e.classList.contains('vrm-main')) { const p = e.parentElement; const fr = [...p.children].filter((x) => x.getClientRects().length).map((x) => (x === e ? '>>' : '') + x.tagName + '.' + String(x.className || '').split(' ')[0] + (x.getAttribute('data-v2-bloc') ? '[' + x.getAttribute('data-v2-bloc') + ']' : '') + ':' + Math.round(x.getBoundingClientRect().top) + '+' + Math.round(x.getBoundingClientRect().height)); fil.push(fr.join(' | ')); e = p; if (fil.length > 3) break; }
      return 'top ' + Math.round(c.getBoundingClientRect().top) + '\n    ' + fil.join('\n    '); }, CIBLE);
    if (s !== avant) { console.log(Math.round(k * 250) + ' ms : ' + s); avant = s; }
    await pg.waitForTimeout(250);
  }
  await ctx.close(); await nav.close(); srv.close();
})();
