require('./_porte-banc.cjs');
// Build réel, comptes fictifs : aucune connexion ni écriture de production.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const TB = require('./tous-boutons.cjs');
(async () => {
  await TB.demarrer();
  const browser = await chromium.launch({executablePath: process.env.VRM_CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox','--use-angle=swiftshader']});
  try {
    for (const width of (process.env.BUREAU_LARGEURS||'320,390,1024,1280,1512,1920').split(',').map(Number)) {
      const {ctx,pg} = await TB.ouvrirPage(browser,width<768);
      await pg.setViewportSize({width,height:950});
      for (const tab of (process.env.BUREAU_ONGLETS||'journee,dashboard,settings,annonces,ventes,achats,messages').split(',')) {
        await pg.goto(`http://localhost:${TB.PORT}/?tab=${tab}`,{waitUntil:'domcontentloaded'});
        await TB.attendreCoque(pg);
        if(process.env.BUREAU_MUTATION==='fil-etroit') await pg.addStyleTag({content:'html body .vrm-message-workspace{grid-template-columns:300px minmax(0,1fr) 280px!important}html body .vrm-message-workspace>.vrm-msg-fiche{display:flex!important}'});
        await pg.waitForTimeout(450);
        const box = await pg.evaluate(() => {
          const main=document.querySelector('.vrm-main');
          const day=document.querySelector('.vrm-day-layout');
          const rect=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,width:r.width}:null};
          return {overflow:document.documentElement.scrollWidth>innerWidth+1,main:main?.getBoundingClientRect().width,day:day?.getBoundingClientRect().width,hero:rect('.vrm-fu-tete'),tasks:rect('.vrm-fu-afaire'),chat:rect('.vrm-chat-column'),fiche:rect('.vrm-msg-fiche'),recherche:rect('.vrm-barre-recherche'),filtres:rect('.vrm-barre-haut-droite')};
        });
        assert.equal(box.overflow,false,`${width} ${tab} : pas de défilement horizontal de page`);
        // (16 nov., parcours-vert) La maquette ordinateur validée (15 nov., studio-journee.css §10) tient Ma journée dans
        // 1 180 px, centrée : au-delà, la règle est « toute la largeur de la maquette, au milieu » (avant : 1 300 px).
        if(tab==='journee' && width>=1024) {
          const centre=await pg.evaluate(()=>{const e=document.querySelector('.vrm-main'),m=e?.getBoundingClientRect(),d=document.querySelector('.vrm-day-layout')?.getBoundingClientRect();if(!m||!d)return 999;const cs=getComputedStyle(e);return Math.abs((d.left-m.left-parseFloat(cs.paddingLeft))-(m.right-parseFloat(cs.paddingRight)-d.right));});
          assert.ok(box.day>=Math.min(box.main*.85,1180)-1&&(box.day>box.main-100||centre<24),`${width} : la journée utilise la largeur du bureau (${Math.round(box.day)} sur ${Math.round(box.main)}, écart au centre ${Math.round(centre)})`);
        }
        if(tab==='journee' && width>=1280) {
          // (16 nov., parcours-vert) Ma journée à l'ordinateur (15 nov., 8e7b78080, maquette validée) : la tête est une
          // bande de titre sur toute la largeur, puis TROIS colonnes (`data-sj-col` c1 le chiffre du jour et le mois ·
          // c2 À envoyer… · c3 À retirer, Messages, À faire). Les règles jugées restent : les gestes à côté du résumé,
          // sans chevauchement, et visibles en haut (sous la tête, dans le premier écran).
          const col=await pg.evaluate(()=>['c1','c2','c3'].map(c=>{const r=document.querySelector(`[data-sj-col="${c}"]`)?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top}:null}));
          assert.ok(col.every(Boolean),`${width} : les trois colonnes de Ma journée sont rendues`);
          assert.ok(col[0].right<=col[1].left+1&&col[1].right<=col[2].left+1,`${width} : tâches à côté du résumé, sans chevauchement`);
          assert.ok(Math.abs(col[1].top-col[0].top)<35&&Math.abs(col[2].top-col[0].top)<35&&col[0].top-(box.hero.top)<120&&col[0].top<475,`${width} : actions visibles en haut`);
          if(box.tasks) assert.ok(box.tasks.left>=col[2].left-1,`${width} : « À faire » dans la colonne des gestes`);
        }
        if(tab==='messages' && width>=1024 && box.chat) {
          assert.ok(box.chat.width>=400,`${width} : le fil garde une largeur lisible`);
          if(width<1440 && box.fiche) assert.equal(box.fiche.width,0,`${width} : la fiche ne comprime pas le fil`);
        }
        if(width>=1024 && box.filtres?.width && box.recherche) assert.ok(box.recherche.right<=box.filtres.left+1,`${width} ${tab} : recherche et filtres séparés`);
        if(tab==='ventes' && width>=1024) {
          assert.ok(await pg.locator('[data-toutes-vente]').count()>0,'les ventes de la fixture sont réellement affichées');
          const meta=await pg.locator('.vrm-toutes-bureau').first().evaluate(e=>getComputedStyle(e).display);
          assert.equal(meta,'contents','les informations des ventes ont leurs colonnes');
          await pg.locator('.vrm-barre-haut-droite').getByRole('button',{name:'Vinted',exact:true}).click();
          await pg.locator('.vrm-sale-row > .vrm-ledger-sale-toggle').first().waitFor();
          const titre=await pg.locator('.vrm-sale-row .vrm-ledger-sale-title').first().evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,clip:getComputedStyle(e).clip}));
          assert.ok(titre.width>100&&titre.height>10&&titre.clip==='auto','le vrai titre reste visible en colonnes');
          const chevauchement=await pg.locator('.vrm-sale-row > .vrm-ledger-sale-toggle').evaluateAll(rows=>rows.some(row=>{
            const nodes=[...row.children].filter(e=>getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden');
            const r=nodes.map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height);
            return r.some((a,i)=>r.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2));
          }));
          assert.equal(chevauchement,false,`${width} : les cellules des ventes ne se chevauchent pas`);
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
        assert.match(await pg.locator('[data-demarrage-vrm] [role=status]').innerText(),/Ouverture de ton espace/);
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
