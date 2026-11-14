require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const o = await ouvrir(nav, { W: 390, sombre: false, b: base(), url: '/?tab=annonces' });
  await o.pg.waitForTimeout(5000);
  const t = await o.pg.evaluate(() => {
    const h = [...document.querySelectorAll('.vrm-main h1')].find((x) => x.getBoundingClientRect().height > 0);
    const out = [];
    for (let e = h; e && e !== document.body && out.length < 6; e = e.parentElement) { const c = getComputedStyle(e); out.push([e.tagName, e.className.toString().slice(0, 50), c.display, c.textAlign, c.justifyContent, c.alignItems, c.flexDirection, c.width, c.flexBasis].join(' | ')); }
    const p = h.parentElement.querySelector('.vrm-phrase-ecran'); const pc = p ? getComputedStyle(p) : null;
    return { out, p: p ? [p.className, pc.display, pc.flexBasis, pc.width, JSON.stringify(p.getBoundingClientRect())] : null, sib: [...h.parentElement.children].map((c) => c.tagName + '.' + c.className.toString().slice(0, 30)) };
  });
  console.log(JSON.stringify(t, null, 1));
  await nav.close(); srv.close();
})();
