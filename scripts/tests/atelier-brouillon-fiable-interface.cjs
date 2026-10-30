const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { build } = require("esbuild"),
  { chromium } = require("playwright");
(async () => {
  const root = path.resolve(__dirname, "../.."),
    s = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8"),
    a = s.indexOf("function AtelierBrouillon("),
    b = s.indexOf("// ══ ATELIER DE REPUBLICATION", a),
    composant = s.slice(a, b);
  const bundle = await build({
    stdin: {
      resolveDir: root,
      loader: "jsx",
      contents: `import React,{useState,useRef}from'react';import{createRoot}from'react-dom/client';import{centimes}from'./src/beneficePaire.js';
const AUTH={user:{id:'owner-a'}};window.authTest=AUTH;const C={bg:'#f8faf8',card:'#fff',text:'#203c42',muted:'#617575',border:'#dae4e1',accent:'#42786e',warn:'#a65e20'};const load=(k,f)=>f,save=()=>{},PhotoVinted=()=> <span>Photo</span>,Icon=()=>null;function FermeAuRetour({fermer}){const f=useRef(fermer);f.current=fermer;React.useEffect(()=>{const cb=e=>{if(e.type==='popstate'||e.key==='Escape')f.current();};document.addEventListener('keydown',cb);window.addEventListener('popstate',cb);return()=>{document.removeEventListener('keydown',cb);window.removeEventListener('popstate',cb);};},[]);return null;}
${composant}
const root=createRoot(document.getElementById('root'));window.sauves=[];window.mode='ok';window.ouvert=true;window.afficher=()=>root.render(window.ouvert?<AtelierBrouillon key={window.sauves.length} it={{id:'100',title:'Ordinateur',price:20,photo:'https://example.invalid/photo.jpg'}} e={{numero:'7'}} k="7" draft={window.sauves.at(-1)} onSave={v=>{if(window.mode==='erreur')throw Error('Stockage indisponible');window.sauves.push(v);}} onClose={()=>{window.ouvert=false;window.afficher();}}/>:<button onClick={()=>{window.ouvert=true;window.afficher();}}>Rouvrir</button>);window.afficher();`,
    },
    bundle: true,
    write: false,
    format: "iife",
    logLevel: "silent",
  });
  const browser = await chromium.launch({
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
      const p = await browser.newPage({ viewport: { width, height: 900 } });
      const erreurs = [];
      p.on("pageerror", (e) => erreurs.push(e.message));
      await p.setContent(
        '<style>body{font-family:Arial}</style><div id="root"></div>',
      );
      await p.addScriptTag({ content: bundle.outputFiles[0].text });
      await p.getByRole("button", { name: "Fermer", exact: true }).click();
      check(
        (await p.evaluate(() => window.sauves.length)) === 0,
        "unchanged editor does not create a draft",
      );
      await p.getByRole("button", { name: "Rouvrir" }).click();
      await p.locator("[data-atelier-titre]").fill("Ordinateur 32 Go");
      await p
        .getByRole("textbox", { name: "Description du brouillon" })
        .fill("Description conservée");
      await p
        .getByRole("textbox", { name: "Dimensions du brouillon" })
        .fill("30 × 20 cm");
      await p.getByRole("button", { name: "Fermer", exact: true }).click();
      check(
        (await p.evaluate(() => window.sauves.at(-1).title)) ===
          "Ordinateur 32 Go",
        "close saves title",
      );
      check(
        (await p.evaluate(() => window.sauves.at(-1).id)) === "100",
        "exact article ID retained",
      );
      check(
        (await p.evaluate(() => window.sauves.at(-1).dimensions)) ===
          "30 × 20 cm",
        "dimensions retained",
      );
      await p.getByRole("button", { name: "Rouvrir" }).click();
      check(
        (await p
          .getByRole("textbox", { name: "Description du brouillon" })
          .inputValue()) === "Description conservée",
        "prepared text restored",
      );
      await p.locator("[data-atelier-prix]").fill("1e2");
      await p.keyboard.press("Escape");
      check(
        (await p.evaluate(() => window.sauves.at(-1).price)) === null,
        "scientific notation is not a native price",
      );
      await p.getByRole("button", { name: "Rouvrir" }).click();
      check(
        (await p.locator("[data-atelier-prix]").inputValue()) === "1e2",
        "unfinished invalid price restored exactly",
      );
      await p.locator("[data-atelier-prix]").fill("22,45");
      await p.evaluate(() => (window.mode = "erreur"));
      await p.getByRole("button", { name: "Fermer", exact: true }).click();
      await p.getByRole("alert").waitFor();
      check(
        (await p.locator("[data-atelier-brouillon]").count()) === 1,
        "failed write leaves editor open",
      );
      await p.evaluate(() => (window.mode = "ok"));
      await p.evaluate(() => dispatchEvent(new PopStateEvent("popstate")));
      await p.getByRole("button", { name: "Rouvrir" }).waitFor();
      check(
        (await p.evaluate(() => window.sauves.at(-1).price)) === 22.45,
        "back saves a valid decimal price",
      );
      await p.getByRole("button", { name: "Rouvrir" }).click();
      await p
        .getByRole("textbox", { name: "Description du brouillon" })
        .fill("Version explicitement enregistrée");
      await p.locator("[data-atelier-enregistrer]").click();
      await p
        .getByRole("textbox", { name: "Description du brouillon" })
        .fill("Dernière modification avant fermeture");
      await p.getByRole("button", { name: "Rouvrir" }).waitFor();
      check(
        (await p.evaluate(() => window.sauves.at(-1).desc)) ===
          "Dernière modification avant fermeture",
        "late edit before delayed close retained",
      );
      check(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "no horizontal overflow",
      );
      const avantOwner = await p.evaluate(() => window.sauves.length);
      await p.getByRole("button", { name: "Rouvrir" }).click();
      await p
        .locator("[data-atelier-titre]")
        .fill("Texte privé du compte précédent");
      await p.evaluate(() => (window.authTest.user.id = "owner-b"));
      await p.getByRole("button", { name: "Fermer", exact: true }).click();
      check(
        (await p.evaluate(() => window.sauves.length)) === avantOwner,
        "owner switch cannot save a private draft into another account",
      );
      check(erreurs.length === 0, "no editor error");
      await p.close();
    }
  } finally {
    await browser.close();
  }
  console.log(n + " contrôles atelier brouillon réussis");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
