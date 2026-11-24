// Sonde jetable (style-graphite) : quelles règles CSS touchent un élément ; quels boutons hors famille.
// `ECRAN=ventes SEL='.n-bouton[data-n-variante=plein]' PROPS=background-color STYLE=graphite FORCE=appui`
'use strict';
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const { base, srv, PORT, chromium } = P;
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  const o = await P.ouvrir(nav, { W: Number(process.env.W || 390), sombre: process.env.SOMBRE === '1', b, url: '/?tab=' + (process.env.ECRAN || 'ventes') });
  await o.pg.addInitScript((st) => { localStorage.setItem('vrm_style', JSON.stringify(st)); }, process.env.STYLE || 'graphite');
  await o.pg.reload({ waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {}); await o.pg.waitForTimeout(5000);
  if (process.env.CLIC) { await o.pg.evaluate((s) => { const e = document.querySelector(s); if (e) e.click(); }, process.env.CLIC); await o.pg.waitForTimeout(1500); }
  const r = await o.pg.evaluate(({ sel, props, force }) => {
    const el = [...document.querySelectorAll(sel)].find((x) => x.getBoundingClientRect().height > 0); if (!el) return 'introuvable';
    if (force) el.setAttribute('data-n-force', force);
    const out = [];
    const tour = (rules, ctx) => { for (const r of rules) {
      if (r.cssRules && !r.selectorText) { tour(r.cssRules, ctx + (r.name !== undefined ? ' @layer ' + r.name : r.conditionText ? ' @media ' + r.conditionText : '')); continue; }
      if (!r.selectorText) continue; let m = false; try { m = el.matches(r.selectorText); } catch (_) {}
      if (!m) continue; for (const p of props) { const v = r.style.getPropertyValue(p); if (v) out.push(`${ctx} | ${r.selectorText.slice(0, 140)} { ${p}: ${v}${r.style.getPropertyPriority(p) ? ' !important' : ''} }`); } } };
    for (const s of document.styleSheets) { try { tour(s.cssRules, (s.href || 'inline').split('/').pop()); } catch (_) {} }
    const cs = getComputedStyle(el); return { calc: props.map((p) => p + '=' + cs.getPropertyValue(p)), html: el.outerHTML.slice(0, 300), out };
  }, { sel: process.env.SEL, props: (process.env.PROPS || 'background-color').split(','), force: process.env.FORCE || '' });
  console.log(JSON.stringify(r, null, 1));
  if (process.env.ETRANGERS) {
    const e = await o.pg.evaluate(() => [...document.querySelectorAll('.vrm-main button, .vrm-main [role=button], [data-fiche-paire] button')].filter((x) => x.getBoundingClientRect().height > 0).map((x) => x.className + ' | ' + (x.innerText || x.getAttribute('aria-label') || '').slice(0, 30)));
    console.log([...new Set(e)].join('\n'));
  }
  await nav.close(); srv.close(); process.exit(0);
})();
