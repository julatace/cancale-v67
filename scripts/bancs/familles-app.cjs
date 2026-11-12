require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « FAMILLES DE L'APP » (11 nov., second agent) — ce que les familles changent
//  À L'ÉCRAN, rendu. 390 px tactile ET 1512 px, clair ET sombre. Données INVENTÉES
//  (le jeu de `nouveau-vendeur.cjs`, dépôt public).
//   L. Ventes → Leboncoin : une vente finalisée à 30 €, une au prix INCONNU ⇒ la case
//      « CA finalisé » dit « au moins 30 € » (jamais 30 € complet, jamais 0 €), sa valeur
//      machine vaut 30 € (`data-kpi-valeur`), la carte dit le partiel.
//   F. aucun débordement horizontal, aucune erreur de page.
//  §6.1 : sur origin/main (build à part, `BANC_DIST`), L1 rouge (« 30 € » présenté complet).
//  Captures : SHOTS (défaut /tmp/banc-familles-app) — à REGARDER (§6.2).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-familles-app');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 500) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const debord = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

(async () => {
  const NV = require('./nouveau-vendeur.cjs');
  await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const tag = `${W}-${theme}`, sombre = theme === 'sombre';
      const lignes = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
      const hier = new Date(Date.now() - 86400e3).toISOString();
      lignes.find((l) => l.id === 'lbc_ventes').data.ventes = {
        lbc_a: { id: 'lbc_a', txId: 'lbc_a', itemId: 'lbc_a', isSeller: true, subject: 'Adidas Samba inventée', price: 3000, parcelColor: 'finished', status: 'finished', dateVente: hier },
        lbc_b: { id: 'lbc_b', txId: 'lbc_b', itemId: 'lbc_b', isSeller: true, subject: 'Nike Dunk inventée', price: null, parcelColor: 'finished', status: 'finished', dateVente: hier },
      };
      const base = { lignes, comptes: NV.JEU_COMPTES, ecritures: 0 };
      const { ctx, pg, journal } = await NV.ouvrir(nav, { W, sombre, base, tab: 'cat_ventes' });
      try {
        await pg.locator('[data-filtre-site="ventes"] [data-site="leboncoin"]').first().click({ timeout: 20000 });
        await pg.waitForSelector('[data-ventes-kpi="leboncoin"] [data-kpi="ca"]', { timeout: 20000 });
        await attendre(1200);
        const r = await pg.evaluate(() => {
          const e = document.querySelector('[data-ventes-kpi="leboncoin"] [data-kpi="ca"]');
          const carte = document.querySelector('[data-ventes-kpi="leboncoin"]');
          return { v: e && e.getAttribute('data-kpi-valeur'), txt: e && e.innerText.replace(/\s+/g, ' '), carte: carte && carte.innerText.replace(/\s+/g, ' ').slice(0, 400) };
        });
        dit(r.v === '30' && /au moins/i.test(r.txt + ' ' + r.carte), `L1 ${tag} : Leboncoin, un prix inconnu ⇒ « au moins 30 € » (jamais complet, jamais 0 €)`, r);
        dit(!/\b0\s?€/.test(r.txt || ''), `L2 ${tag} : aucun « 0 € » pour le prix inconnu`, r.txt);
        dit(await debord(pg) <= 1 && journal.erreurs.length === 0, `F ${tag} : aucun débordement, aucune erreur`, { d: await debord(pg), e: journal.erreurs });
        await pg.screenshot({ path: path.join(SHOTS, `lbc-ventes-${tag}.png`) });
      } catch (e) { dit(false, `L ${tag} : le parcours`, e.message.split('\n')[0]); await pg.screenshot({ path: path.join(SHOTS, `lbc-ventes-${tag}-ko.png`) }).catch(() => {}); }
      await ctx.close();
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log(ko ? `\nKO  ${ko} rouge(s) — captures : ${SHOTS}` : `\nOK  tout est vert — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
