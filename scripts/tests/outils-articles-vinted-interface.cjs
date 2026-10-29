const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { build } = require("esbuild"),
  { chromium } = require("playwright");
(async () => {
  const root = path.resolve(__dirname, "../..");
  const bundle = await build({
    stdin: {
      resolveDir: root,
      loader: "jsx",
      contents: `
import React from'react';import{createRoot}from'react-dom/client';import{AnnoncesACompleter,ComparaisonComptesVinted,HistoriqueArticle}from'./src/OutilsArticlesVinted.jsx';
window.owner='a';window.compte='123';window.item='3';window.mode='ok';window.edite='';window.reads=[];const root=createRoot(document.getElementById('root'));
window.afficher=()=>root.render(<><AnnoncesACompleter items={[{id:'3',title:'Ordinateur',price:100,photoCount:0,descLen:0,_acc:{login:'Alice'}},{id:'4',title:'Écran',price:20}]} numeros={{'3':{numero:'7'}}} drafts={{}} ouvrir={id=>window.edite=id} charger={()=>{}}/><ComparaisonComptesVinted rows={[{uid:'123',nom:'Alice',ventes:3,ca:100,benefice:null,couvertes:0,prixManquants:1,stock:2,taches:1}]} periode="Octobre 2026" disponible={false} stockDisponible={false} charger={()=>{}}/><HistoriqueArticle item={window.item} uid={window.compte} owner={window.owner} ownerActuel={()=>window.owner} numeros={{'3':{numero:'7'},'2':{numero:'7'}}} prix={[]} lire={async q=>{window.reads.push(q);const owner=window.owner;if(window.mode==='lent')await new Promise(r=>window.fin=r);if(window.mode==='erreur')throw Error('Lecture indisponible');return q.includes('coffre')?[{id:'coffre_'+window.compte+'_3',owner,item:'3',ancienData:'2',price:'100'},{id:'coffre_'+window.compte+'_2',owner,item:'2',price:'110'}]:[{id:'harvest_'+window.compte+'_conv_9',owner,item:'2'}];}}/></>);window.afficher();`,
    },
    bundle: true,
    write: false,
    outfile: "/tmp/vrm-outils-test.js",
    format: "iife",
    logLevel: "silent",
  });
  const b = await chromium.launch({
    executablePath:
      process.env.VRM_CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  let n = 0;
  const check = (v, m) => {
    assert.ok(v, m);
    n++;
  };
  try {
    for (const width of [320, 390, 1512]) {
      const p = await b.newPage({ viewport: { width, height: 900 } });
      await p.setContent('<div id="root"></div>');
      await p.addStyleTag({
        content: bundle.outputFiles.find((f) => f.path.endsWith(".css")).text,
      });
      await p.addScriptTag({
        content: bundle.outputFiles.find((f) => f.path.endsWith(".js")).text,
      });
      await p.getByText("Conversation de l’article 2 ↗").waitFor();
      check(
        (await p
          .getByRole("link", { name: "Conversation de l’article 2 ↗" })
          .getAttribute("href")) === "https://www.vinted.fr/inbox/9",
        "conversation exact ID",
      );
      check(
        (await p
          .locator('[data-historique-article] a[href*="/items/"]')
          .count()) === 2,
        "explicit native lineage only",
      );
      check(
        await p.evaluate(() =>
          window.reads.every(
            (q) => q.includes("owner=eq.a") && !q.includes("select=*"),
          ),
        ),
        "owner-scoped scalar metadata reads",
      );
      await p.locator("[data-annonces-completer] summary").click();
      await p.getByRole("button", { name: "Compléter", exact: true }).click();
      check(
        (await p.evaluate(() => window.edite)) === "3",
        "opens precise article",
      );
      await p
        .getByRole("button", { name: "Données non récupérées", exact: true })
        .click();
      check(
        (await p.locator(".vrm-outils-liste").innerText()).includes(
          "Non récupéré",
        ),
        "unknown distinct from absent",
      );
      await p.locator("[data-comparer-comptes] summary").click();
      check(
        (await p.locator("table").innerText()).includes("Non calculable"),
        "unknown profit not replaced with zero",
      );
      check(
        (await p.getByRole("status").allTextContents()).some((x) =>
          x.includes("incomplète"),
        ),
        "partial results labelled",
      );
      check(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "no document overflow",
      );
      await p.evaluate(() => {
        window.mode = "lent";
      });
      await p
        .getByRole("button", { name: "Actualiser l’historique", exact: true })
        .click();
      await p.waitForFunction(() => typeof window.fin === "function");
      await p.evaluate(() => {
        const ancien = window.fin;
        window.owner = "b";
        window.compte = "456";
        window.mode = "ok";
        window.afficher();
        ancien();
      });
      await p.waitForTimeout(100);
      check(
        (await p
          .locator('[data-historique-article] a[href*="/inbox/"]')
          .count()) === 1,
        "new owner history only",
      );
      check(
        await p.evaluate(() =>
          window.reads.some((q) => q.includes("owner=eq.b")),
        ),
        "new owner query",
      );
      await p.close();
    }
  } finally {
    await b.close();
  }
  console.log(n + " contrôles interface articles réussis");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
