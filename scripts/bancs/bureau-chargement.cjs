require('./_porte-banc.cjs');
// Build réel, comptes fictifs : aucune connexion ni écriture de production.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const TB = require('./tous-boutons.cjs');
(async () => {
  await TB.demarrer();
  const browser = await chromium.launch({executablePath: process.env.VRM_CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox','--use-angle=swiftshader']});
  try {
    for (const width of [320,390,1024,1280,1512,1920]) {
      const {ctx,pg} = await TB.ouvrirPage(browser,width<768);
      await pg.setViewportSize({width,height:950});
      for (const tab of ['journee','dashboard','settings','annonces']) {
        await pg.goto(`http://localhost:${TB.PORT}/?tab=${tab}`,{waitUntil:'domcontentloaded'});
        await TB.attendreCoque(pg);
        await pg.waitForTimeout(450);
        const box = await pg.evaluate(() => {
          const main=document.querySelector('.vrm-main');
          const day=document.querySelector('.vrm-day-layout');
          const rect=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,width:r.width}:null};
          return {overflow:document.documentElement.scrollWidth>innerWidth+1,main:main?.getBoundingClientRect().width,day:day?.getBoundingClientRect().width,hero:rect('.vrm-fu-tete'),tasks:rect('.vrm-fu-afaire')};
        });
        assert.equal(box.overflow,false,`${width} ${tab} : pas de défilement horizontal de page`);
        if(tab==='journee' && width>=1024) assert.ok(box.day>Math.min(box.main*.85,1300),`${width} : la journée utilise la largeur du bureau`);
        if(tab==='journee' && width>=1280) {
          assert.ok(box.tasks.left>=box.hero.right,`${width} : tâches à côté du résumé, sans chevauchement`);
          assert.ok(Math.abs(box.tasks.top-box.hero.top)<35,`${width} : actions visibles en haut`);
        }
        console.log(`✅ ${width}px ${tab}`);
      }
      await ctx.close();
    }
    for(const reducedMotion of ['no-preference','reduce']) {
      const {ctx,pg}=await TB.ouvrirPage(browser,true);
      await pg.emulateMedia({reducedMotion});
      let release; const gate=new Promise(r=>release=r);
      await pg.route(/\/assets\/App-[^/]+\.js(?:\?.*)?$/,async route=>{await gate;await route.continue()});
      await pg.goto(`http://localhost:${TB.PORT}/?tab=journee`,{waitUntil:'domcontentloaded'});
      try {
        await pg.locator('[data-demarrage-vrm]').waitFor({state:'visible'});
        assert.match(await pg.locator('[role=status]').innerText(),/Ouverture de ton espace/);
        const animation=await pg.locator('.vrm-demarrage-rail > span').evaluate(e=>getComputedStyle(e).animationName);
        assert.equal(animation==='none',reducedMotion==='reduce','respect de la réduction des animations');
        assert.ok(await pg.locator('[data-demarrage-vrm] img').evaluate(e=>e.complete&&e.naturalWidth>0),'logo chargé');
      } finally {release()}
      await TB.attendreCoque(pg);
      await pg.locator('[data-demarrage-vrm]').waitFor({state:'detached'});
      console.log(`✅ chargement réel et arrivée dans l’app (${reducedMotion})`);
      await ctx.close();
    }
  } finally {await browser.close()}
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
