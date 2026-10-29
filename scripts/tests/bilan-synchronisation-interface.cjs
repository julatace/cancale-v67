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
import React from'react';import{createRoot}from'react-dom/client';import Bilan from'./src/BilanSynchronisation.jsx';import Retraits from'./src/VendusAilleurs.jsx';
window.owner='a';window.rev=0;window.montage=0;window.mode='ok';window.prix=20;window.n=1;window.ko=false;window.nav='';window.lectures=0;const root=createRoot(document.getElementById('root'));
const annonce={id:'555',numero:'7',plateforme:'eBay',compte:'Compte Alice',titre:'Ordinateur',active:true,capture:'2026-10-01T00:00:00Z',onglet:'ebay_annonces'};
window.afficher=()=>root.render(<><Bilan owner={window.owner} onNav={k=>window.nav=k} sources={[{id:'ventes',revision:window.rev,libelle:'Ventes',onglet:'cat_ventes',comptes:[{uid:'123',nom:window.owner==='a'?'Alice':'Nouveau compte'}],items:Array.from({length:window.n},(_,i)=>({id:String(i),compte:'123',titre:'Article '+i,valeurs:[i===0?window.prix:10]})),echecs:window.ko?['123']:[]}]}/><Retraits key={window.montage} owner={window.owner} ownerActuel={()=>window.owner} onNav={k=>window.nav=k} charger={async()=>{window.lectures++;if(window.mode==='lent')await new Promise(r=>window.fin=r);if(window.mode==='erreur')throw Error('Échec');return {numeros:{'11':{numero:'7'}},ventes:[{id:'11',numero:'7',plateforme:'Vinted',engagee:true}],annonces:window.mode==='absent'?[]:[{...annonce,active:window.mode!=='inactif'}],manques:window.mode==='absent'?['eBay incomplet']:[]};}}/></>);window.afficher();`,
    },
    bundle: true,
    write: false,
    outfile: "/tmp/bilan-interface.js",
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
      const erreurs = [];
      p.on("pageerror", (e) => erreurs.push(e.message));
      await p.setContent(
        '<style>body{font-family:Arial;margin:12px}</style><div id="root"></div>',
      );
      await p.addStyleTag({
        content: bundle.outputFiles.find((x) => x.path.endsWith(".css")).text,
      });
      await p.addScriptTag({
        content: bundle.outputFiles.find((x) => x.path.endsWith(".js")).text,
      });
      await p.locator("[data-bilan-synchronisation] summary").first().click();
      await p.getByText("Ventes · 1 élément à la première lecture").waitFor();
      check(
        (await p.evaluate(() => window.lectures)) === 0,
        "withdrawal reads are lazy",
      );
      await p.evaluate(() => {
        window.n = 2;
        window.prix = 22;
        window.afficher();
      });
      await p.getByText("Ventes · 1 ajout · 1 modification").waitFor();
      await p.getByText("Éléments concernés", { exact: true }).click();
      check(
        (
          await p.locator("[data-bilan-synchronisation] ul").innerText()
        ).includes("Article 1"),
        "changed items accessible",
      );
      await p.evaluate(() => {
        window.rev++;
        window.afficher();
      });
      await p.getByText("Ventes · 0 ajout · 0 modification").waitFor();
      check(
        (await p.locator("[data-bilan-synchronisation]").innerText()).includes(
          "0 ajout",
        ),
        "new unchanged capture reports zero changes",
      );
      await p.evaluate(() => {
        window.ko = true;
        window.afficher();
      });
      await p
        .getByText("Ventes · Non relu — dernière lecture conservée")
        .waitFor();
      check(
        (await p.locator("[data-bilan-synchronisation]").innerText()).includes(
          "non confirmée",
        ),
        "failed account explicit",
      );
      await p.evaluate(() => {
        window.ko = false;
        window.afficher();
      });
      await p.getByText("Ventes · 0 ajout · 0 modification").waitFor();
      await p.locator("[data-vendus-ailleurs] summary").click();
      await p.getByText("N°7 · Ordinateur").waitFor();
      await p.getByRole("button", { name: "Gérer le retrait" }).click();
      check(
        (await p.evaluate(() => window.nav)) === "ebay_annonces",
        "management route exact",
      );
      await p.evaluate(() => (window.mode = "absent"));
      await p.getByRole("button", { name: "Revérifier les annonces" }).click();
      await p.getByText(/retrait non confirmé sur eBay/).waitFor();
      check(
        (await p.getByText("N°7 · Ordinateur").count()) === 1,
        "partial absent listing does not clear alert",
      );
      await p.evaluate(() => {
        window.montage++;
        window.afficher();
      });
      await p.locator("[data-vendus-ailleurs]>summary").click();
      check(
        await p.getByText("N°7 · Ordinateur").isVisible(),
        "unconfirmed alert survives navigation",
      );
      await p.evaluate(() => (window.mode = "erreur"));
      await p.getByRole("button", { name: "Revérifier les annonces" }).click();
      await p.getByRole("alert").waitFor();
      check(
        (await p.getByText("N°7 · Ordinateur").count()) === 1,
        "failed read retains alert",
      );
      await p.evaluate(() => (window.mode = "inactif"));
      await p.getByRole("button", { name: "Revérifier les annonces" }).click();
      await p
        .getByText(
          "Aucune correspondance à retirer dans les données récupérées.",
        )
        .waitFor();
      check(
        (await p.getByText("N°7 · Ordinateur").count()) === 0,
        "explicit inactive state confirms withdrawal",
      );
      await p.evaluate(() => (window.mode = "lent"));
      await p.getByRole("button", { name: "Revérifier les annonces" }).click();
      await p.waitForFunction(() => typeof window.fin === "function");
      await p.evaluate(() => {
        window.owner = "b";
        window.afficher();
        window.mode = "ok";
        window.fin();
      });
      await p
        .getByText("Nouveau compte", { exact: true })
        .waitFor({ state: "attached" });
      await p.locator("[data-bilan-synchronisation]>summary").click();
      await p.waitForTimeout(100);
      check(
        (await p.getByText("N°7 · Ordinateur").count()) === 0,
        "late old-owner result cannot appear",
      );
      check(
        (await p.getByText("Alice", { exact: true }).count()) === 0,
        "bilan owner isolation",
      );
      check(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "no overflow",
      );
      check(erreurs.length === 0, "no React errors");
      await p.close();
    }
  } finally {
    await b.close();
  }
  console.log(n + " contrôles React bilan et retraits réussis");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
