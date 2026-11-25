require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';   // l'app telle qu'elle est servie
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN EXTENSION SANS EXTENSION (24 nov., livrable — trouvé par le parcours « débutant ») : à l'ordinateur, dans un
//  Chrome SANS l'extension, l'écran disait « VRM regarde si l'extension est là… / on regarde… » près de 7 s, sans rien à
//  toucher ; au téléphone, l'étape « Un compte Vinted ouvert sur vinte… » était coupée. Récit : 2026-11-24-livrable.md.
//   E1 1512, aucune extension : 4,5 s après l'ouverture, l'écran a CONCLU (`data-ext-nav` n'est plus « verif ») et porte
//      son bouton (`[data-ext-plein]` : installer) — la fenêtre de la poignée de main est de 3,2 s (src/App.jsx) ;
//   E2 390 : chaque étape « Brancher VRM, pas à pas » se lit en entier (titre jamais rogné : largeur de défilement ≤ largeur).
//  `BANC_DIST=…` pour juger un autre build ; `SHOTS=…`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { base, srv, PORT, chromium } = P;
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? ' — ' + String(d).slice(0, 500) : '')); } };
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  try {
    for (const W of [1512, 390]) {
      const { ctx, pg, erreurs } = await P.ouvrir(nav, { W, sombre: false, b, url: '/?tab=extension' });
      try {
        await pg.waitForSelector('[data-ecran-extension]', { timeout: 40000 }).catch(() => {});
        const t0 = await pg.evaluate(() => performance.now());
        await pg.waitForFunction((t) => performance.now() - t > 4500, t0, { timeout: 20000, polling: 100 }).catch(() => {});
        const m = await pg.evaluate(() => {
          const e = document.querySelector('[data-ecran-extension]');
          const etapes = [...document.querySelectorAll('[data-ext-etape]')].map((r) => { const t = r.querySelector('.n-rangee-titre'); return t ? { cle: r.getAttribute('data-ext-etape'), coupe: t.scrollWidth > t.clientWidth + 1 || t.scrollHeight > t.clientHeight + 1 } : null; }).filter(Boolean);
          return { nav: e && e.getAttribute('data-ext-nav'), plein: document.querySelector('[data-ext-plein]') ? document.querySelector('[data-ext-plein]').getAttribute('data-ext-plein') : null, etapes };
        });
        if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(process.env.SHOTS, `extension-${W}.png`) }); }
        if (W === 1512) {
          dit(m.nav && m.nav !== 'verif', `E1 1512 sans extension : à 4,5 s l'écran a conclu (${m.nav})`);
          dit(m.plein === 'installer', `E1 1512 : le bouton pour installer est là (${m.plein})`);
        } else {
          const coupees = m.etapes.filter((x) => x.coupe).map((x) => x.cle);
          dit(m.etapes.length >= 3 && !coupees.length, `E2 390 : les ${m.etapes.length} étapes se lisent en entier`, coupees.join(', '));
        }
        if (erreurs.length) console.log('     erreurs : ' + erreurs.join(' | ').slice(0, 200));
      } finally { await ctx.close(); }
    }
  } catch (e) { dit(false, 'banc', String(e && e.message || e).slice(0, 300)); }
  finally { await nav.close(); srv.close(); }
  console.log(`\n${ko ? '❌' : '✅'} extension-attente : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
