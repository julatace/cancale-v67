// ════════════════════════════════════════════════════════════════════════════
//  Maquette B « iOS natif » (17 nov.) — captures de la VRAIE app sur base inventée.
//  La maquette n'existe que derrière le réglage de banc `vrm_banc_maquette = b`
//  (localStorage, posé ici) : Julien ne la voit jamais. Sans MAQUETTE=b ⇒ l'app d'aujourd'hui.
//  MAQUETTE=b SHOTS=<dossier> ECRANS=journee,ventes LARGEURS=390,1512 THEMES=clair,sombre DEFILE=1
//  BANC_DIST=<dist> pour un autre build. Base : _base-messages-stock (1 000 paires, 3 comptes).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const OUT = process.env.SHOTS || path.join(require('os').tmpdir(), 'maquette-b');
const MAQ = process.env.MAQUETTE || '';
const ECR = { journee: '/', annonces: '/?tab=annonces', achats: '/?tab=achats', ventes: '/?tab=ventes', argent: '/?tab=compta' };
const voulus = String(process.env.ECRANS || Object.keys(ECR).join(',')).split(',');
const LARG = String(process.env.LARGEURS || '390,1512').split(',').map(Number);
const THEMES = String(process.env.THEMES || 'clair,sombre').split(',');
const DSF = Number(process.env.DSF || 2);
const DEFILE = process.env.DEFILE === '1';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const rapport = [];
  try {
    for (const e of voulus) for (const W of LARG) for (const t of THEMES) {
      if (W > 600 && t === 'sombre' && !process.env.SOMBRE_ORDI) continue;
      const o = await P.ouvrir(nav, { W, sombre: t === 'sombre', b: B.baseVolume(), url: ECR[e], api: B.apiVolume, dsf: W < 600 ? DSF : 1 });
      if (MAQ) { await o.pg.evaluate((m) => { try { localStorage.setItem('vrm_banc_maquette', m); } catch (_) {} }, MAQ); await o.pg.reload({ waitUntil: 'domcontentloaded' }); }
      await P.pret(o.pg);
      // Le message « N nouvelles paires numérotées » de la base inventée : fermé par SON ×, comme Julien le ferait.
      const fermerMessages = () => o.pg.evaluate(() => { for (const b of document.querySelectorAll('button.vrm-toast, .vrm-acc-x')) b.click(); }).catch(() => {});
      for (let k = 0; k < 6; k++) { await fermerMessages(); await o.pg.waitForTimeout(700); }
      const f = path.join(OUT, `${e}-${W}-${t}.png`);
      await o.pg.screenshot({ path: f });
      // Mesures (lues dans la page, jamais un libellé).
      const m = await o.pg.evaluate(() => {
        const r = document.documentElement;
        const tabs = [...document.querySelectorAll('.vrm-tabbar .vrm-tab')].map((b) => { const q = b.getBoundingClientRect(); return { h: Math.round(q.height), w: Math.round(q.width) }; });
        const segs = [...document.querySelectorAll('.vrm-main :is(.vrm-seg, .vv-seg, .vrm-sel-sites, .vrm-compte-puces, .vrm-stock-views)')].filter((x) => x.offsetParent).map((x) => Math.round(x.getBoundingClientRect().height));
        return { maquette: r.getAttribute('data-maquette') || '', tabs, segs };
      });
      rapport.push({ e, W, t, ...m, erreurs: o.erreurs.length });
      if (DEFILE) {
        await o.pg.evaluate(() => { const x = document.querySelector('.vrm-main'); if (x) { x.scrollTop = 420; x.dispatchEvent(new Event('scroll')); } });
        await o.pg.waitForTimeout(1300); await fermerMessages(); await o.pg.waitForTimeout(500);
        await o.pg.screenshot({ path: path.join(OUT, `${e}-${W}-${t}-defile.png`) });
      }
      console.log(f, o.erreurs.length ? 'ERREURS ' + o.erreurs.join(' | ') : '');
      await o.ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }
  fs.writeFileSync(path.join(OUT, 'mesures.json'), JSON.stringify(rapport, null, 1));
})();
