require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
require('./_porte-banc.cjs');
'use strict';
// Outil de regard (pas un banc) : évalue EVAL (un corps de fonction) dans la page URL.
const P = require('./design-passe.cjs');
const { fabriquer } = require('./_base-volume.cjs');
const b = fabriquer({ comptes: 3, ventes: 2000 });
const m = b.main[0].data; const at = '2026-11-01T10:00:00.000Z';
Object.assign(m, { vrm_bienvenue_vue: { at }, vrm_visite_vue: { at }, vrm_je_vends: { choix: 'sneakers', at }, vrm_configuration: { etat: 'fait', at, statut: null, version: 1 },
  vrm_plateformes_affichees: { sites: ['vinted'], at }, vrm_parcours: { etat: 'fini', at }, vrm_bilan_minute: { vu: at, fin: 'vu' } });
(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const o = await P.ouvrir(nav, { W: Number(process.env.W || 390), sombre: false, b, url: process.env.URL });
  await P.pret(o.pg); await o.pg.waitForTimeout(2500);
  console.log(JSON.stringify(await o.pg.evaluate(new Function(process.env.EVAL)), null, 1));
  await nav.close(); P.srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
