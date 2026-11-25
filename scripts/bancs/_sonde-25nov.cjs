// Sonde jetable (25 nov.) : ouvre un écran à 390 px et liste les squelettes restants.
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
const path = require('path');
const P = require('./design-passe.cjs');
const OUT = process.env.SHOTS_SONDE || '/tmp';
const URL_ = process.env.URL_SONDE || '/?tab=journee';
(async () => {
  const b = P.base();
  if (process.env.EBAY) b.rows.push({ id: 'ebay_comptes', data: { comptes: [{ principal: true, pseudo: 'boutique-ebay', ajouteLe: Date.now() - 9e8 }] } });
  await new Promise((ok) => P.srv.listen(P.PORT, ok));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  if (process.env.SUSPENDU) {   // un morceau dont la réponse n'arrive jamais (réseau bloqué de l'iPhone)
    const nc = nav.newContext.bind(nav);
    nav.newContext = async (o) => { const c = await nc(o); await c.route(new RegExp(process.env.SUSPENDU), () => {}); return c; };
  }
  const { ctx, pg, erreurs } = await P.ouvrir(nav, { W: 390, b, url: URL_, dsf: 2 });
  if (process.env.SUSPENDU) await pg.route(new RegExp(process.env.SUSPENDU), () => {});
  await pg.waitForTimeout(12000);
  const r = await pg.evaluate(() => [...document.querySelectorAll('.vrm-skeleton, .n-os, [data-place-attente], .ebt-squelette, [aria-busy="true"]')].filter((e) => e.getClientRects().length).map((e) => { const ch = []; for (let x = e; x && ch.length < 8; x = x.parentElement) ch.push(x.tagName.toLowerCase() + (x.className && typeof x.className === 'string' ? '.' + x.className.split(' ').slice(0, 2).join('.') : '') + [...x.attributes].filter((a) => a.name.startsWith('data-')).map((a) => '[' + a.name + '=' + a.value.slice(0, 20) + ']').join('')); return ch.join(' < '); }));
  console.log(JSON.stringify(r, null, 1), erreurs);
  await pg.screenshot({ path: path.join(OUT, 'sonde.png'), fullPage: false });
  await ctx.close(); await nav.close(); P.srv.close();
})();
