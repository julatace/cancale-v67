// Repérage : une capture de chaque écran demandé, dans le cadre du film, avec le
// monde inventé — pour REGARDER avant de tourner (aucune vidéo).
//   TABS=journee,cat_bord,garage node scripts/films/reperage.cjs
//   (captures dans FILMS_SORTIE/reperage/)
'use strict';
const path = require('path'), fs = require('fs');
const { Film, lancerNavigateur, fermerServeur, sortie } = require('./_commun.cjs');
const { monde } = require('./_monde.cjs');
(async () => {
  const nav = await lancerNavigateur();
  const dossier = sortie('reperage'); fs.mkdirSync(dossier, { recursive: true });
  const tabs = (process.env.TABS || 'journee').split(',');
  const f = new Film({ nom: 'reperage', format: process.env.FORMAT || 'portrait', monde: monde(), tab: tabs[0] });
  try {
    await f.demarrer(nav);
    for (const tab of tabs) {
      if (tab !== tabs[0]) await f.ouvrir(tab);
      await f.pg.evaluate((e) => window.__appliquer(e), f.etat());
      await f.pg.screenshot({ path: path.join(dossier, `${tab}.png`) });
      // L'app seule, à sa taille (390 px), et la page entière.
      if (process.env.LONG) {
        await f.pg.setViewportSize({ width: 540, height: 2800 });
        await f.pg.evaluate(() => { const e = document.getElementById('monde'); e.style.transform = 'none'; document.querySelector('.ecran').style.height = '2700px'; document.querySelector('.tel').style.height = '2724px'; document.getElementById('app').style.height = '2600px'; document.body.style.height = '2800px'; });
        await f.pg.waitForTimeout(1500);
        await (await f.pg.$('#app')).screenshot({ path: path.join(dossier, `${tab}-long.png`) });
        await f.pg.setViewportSize({ width: f.F.w, height: f.F.h });
        await f.pg.evaluate(() => { document.querySelector('.ecran').style.height = ''; document.querySelector('.tel').style.height = ''; document.getElementById('app').style.height = ''; document.body.style.height = ''; });
      }
      const h = await f.app.evaluate(() => { const m = document.scrollingElement; return m.scrollHeight; });
      // La page entière de l'app (pour voir ce qui est sous le pli).
      await f.app.evaluate(() => 0);
      const el = await f.pg.$('#app');
      const fr = await el.contentFrame();
      const corps = await fr.evaluate(() => document.body.innerText.slice(0, 1500));
      fs.writeFileSync(path.join(dossier, `${tab}.txt`), corps);
      console.log(tab, 'hauteur', h, 'erreurs', f.erreurs.join(' | '));
    }
  } finally { await nav.close(); fermerServeur(); }
})();
