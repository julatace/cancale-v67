require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const { ouvrir, base, pret, srv, PORT, chromium } = P;
const OUT = process.env.OUT;
const ECR = (process.env.ECR || 'achats:/?tab=achats,journee:/?tab=journee').split(',').map((x) => x.split(':'));
(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  for (const W of String(process.env.W || '390').split(',').map(Number)) for (const [nom, url] of ECR) {
    const o = await ouvrir(nav, { W, sombre: !!process.env.SOMBRE, b: base(), url });
    await pret(o.pg); await o.pg.waitForTimeout(1500);
    await o.pg.screenshot({ path: `${OUT}/x-${nom}-${W}-haut.png` });
    const info = await o.pg.evaluate(() => {
      const h = document.querySelector('.vrm-app-header');
      const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
      const out = [];
      if (h) h.querySelectorAll('button, a, [role="button"], .vrm-header-logo, .vrm-hdr-titre').forEach((e) => { if (vis(e)) { const r = e.getBoundingClientRect(); out.push([e.tagName, e.className.toString().slice(0, 60), (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]); } });
      const fl = [...document.querySelectorAll('body *')].filter((e) => { const s = getComputedStyle(e); return (s.position === 'fixed') && vis(e); }).map((e) => [e.className.toString().slice(0, 50), e.textContent.trim().slice(0, 30), JSON.stringify(e.getBoundingClientRect().toJSON()).slice(0, 90)]);
      const sh = document.querySelector('.vrm-screen-head');
      return { out, fl, sh: sh && [sh.className, getComputedStyle(sh).display, sh.textContent.slice(0, 60)], fr: [...document.querySelectorAll('[data-fraicheur-unique]')].map((e) => [e.textContent.trim().slice(0, 80), JSON.stringify(e.getBoundingClientRect().toJSON()).slice(0, 90)]) };
    });
    console.log(nom, W, JSON.stringify(info, null, 1));
    await o.pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 600; });
    await o.pg.waitForTimeout(800);
    await o.pg.screenshot({ path: `${OUT}/x-${nom}-${W}-bas.png` });
    await o.ctx.close();
  }
  await nav.close(); srv.close();
})();
