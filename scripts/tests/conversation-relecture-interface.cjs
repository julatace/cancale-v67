// En-tête et contrôleur réels, lecteurs simulés : aucune connexion marchande.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { build } = require("esbuild"),
  { chromium } = require("playwright");
(async () => {
  const root = path.resolve(__dirname, "../.."),
    s = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8");
  const a = s.indexOf('            <div className="vrm-chat-head"'),
    b = s.indexOf(
      "            {!openConv.loading&&!openConv.error&&(()=>{const suivi=",
      a,
    );
  const c = s.indexOf("  const actualiserConversation=async()=>{"),
    d = s.indexOf("  // Envoi d'une réponse", c);
  assert(a > 0 && b > a && c > 0 && d > c);
  const bundle = await build({
    stdin: {
      resolveDir: root,
      loader: "jsx",
      contents: `import React from'react';import{createRoot}from'react-dom/client';import{fusionnerConversation}from'./src/conversations.js';import'./src/styles-mineral.css';
 const AUTH={user:{id:'a'}},C={text:'#233c40',muted:'#607074',accent:'#245b61',card:'#fff',border:'#dce3e2'};
 const Icon=()=> <span aria-hidden="true">↻</span>,PhotoVinted=()=>null,accName=()=> 'Mon compte Vinted';
 const fil={id:'91',messages:[{id:'1',entity_type:'message',entity:{body:'Message conservé'}}]};
 function App(){const[openConv,setOpenConv]=React.useState({owner:'a',request:1,convId:'91',acc:{vinted_user_id:'7'},conversation:fil,messages:fil.messages,header:{login:'Un acheteur avec un pseudo très long',title:'Ordinateur portable et accessoires'}});const lectureConversationRequest=React.useRef(0),filAvecOffres=c=>c,normalizeConversationMessages=c=>c.messages;
 const fetchVintedConversationDetail=async()=>await new Promise(r=>window.fin=r);
 ${s.slice(c, d)}
 return <div className="vrm-chat-panel">${s.slice(a, b)}<div data-historique>{openConv.messages[0].entity.body}</div></div>;}
 createRoot(document.getElementById('root')).render(<App/>);`,
    },
    bundle: true,
    write: false,
    outfile: "/tmp/vrm-fil-interface.js",
    logLevel: "silent",
  });
  const browser = await chromium.launch({
    executablePath: process.env.VRM_CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  let n = 0;
  const check = (v, m) => {
    assert.ok(v, m);
    n++;
  };
  try {
    for (const width of [320, 390, 1512]) {
      const p = await browser.newPage({ viewport: { width, height: 800 } }),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.setContent(
        '<style>body{margin:0;font-family:Arial}#root{max-width:560px;margin:auto}</style><div id="root"></div>',
      );
      for (const f of bundle.outputFiles)
        if (f.path.endsWith(".css")) await p.addStyleTag({ content: f.text });
        else await p.addScriptTag({ content: f.text });
      const bouton = p.getByRole("button", {
        name: "Actualiser la conversation",
        exact: true,
      });
      await bouton.click();
      await p
        .getByRole("status")
        .getByText("Actualisation de la conversation…")
        .waitFor();
      check(
        await p
          .getByRole("button", { name: "Actualisation en cours" })
          .isDisabled(),
        "refresh button disabled during read",
      );
      check(
        await p.getByText("Message conservé", { exact: true }).isVisible(),
        "history remains visible during read",
      );
      await p.evaluate(() => window.fin({ ok: false }));
      await p.locator("[data-fil-actualisation-erreur]").waitFor();
      check(await bouton.isEnabled(), "retry enabled after failure");
      check(
        (await p
          .getByRole("link", { name: "Ouvrir sur Vinted ↗" })
          .getAttribute("href")) === "https://www.vinted.fr/inbox/91",
        "link targets exact thread",
      );
      await bouton.click();
      await p.waitForFunction(
        () => !!document.querySelector("[data-fil-actualisation]"),
      );
      await p.evaluate(() =>
        window.fin({
          ok: true,
          source: "extension",
          conversation: {
            id: "91",
            messages: [
              {
                id: "1",
                entity_type: "message",
                entity: { body: "Message récent" },
              },
            ],
          },
        }),
      );
      await p.getByText("Message récent", { exact: true }).waitFor();
      check(
        (await p.locator("[data-fil-actualisation-erreur]").count()) === 0,
        "successful retry clears warning",
      );
      check(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "no horizontal overflow",
      );
      check(errors.length === 0, "no React error");
      await p.close();
    }
  } finally {
    await browser.close();
  }
  console.log(n + " contrôles du fil actualisé réussis");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
