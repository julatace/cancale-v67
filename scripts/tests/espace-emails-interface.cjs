// Vrai EmailsSetting et vrais composants, services remplacés par des données inventées.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { build } = require("esbuild"),
  { chromium } = require("playwright");
(async () => {
  const root = path.resolve(__dirname, "../.."),
    s = require(path.join(root, "scripts/_source-app.cjs")).sourceApp(root);
  const a = s.indexOf("function EmailsSetting({onComptes})"),
    b = s.indexOf("function ConnexionsSetting(", a);
  assert(a > 0 && b > a);
  const bundle = await build({
    stdin: {
      resolveDir: root,
      loader: "jsx",
      contents: `import React,{useState,useEffect,useRef}from'react';import{createRoot}from'react-dom/client';import EspaceEmails from'./src/EspaceEmails.jsx';import SuiviReceptionEmails from'./src/ReceptionEmails.jsx';import{normAdresse,ADRESSE_COLLECTRICE}from'./api/_lib/proprietaire-email.js';
const C={text:'#223d41',muted:'#647676',bg:'#f2f5f0',card:'#fff',border:'#dce4de',accent:'#315e62',warn:'#946d27',danger:'#a33c36',onAccent:'#fff'};
const AUTH={user:{id:'a'}},DEMANDE_ADRESSES={on:false},Icon=()=> <span aria-hidden="true">·</span>,REGLAGE_PAS_LU='Lecture indisponible';
const PREUVE_LIGNE={prouvee:{t:'Confirmée'},attente:{t:'À confirmer',geste:'Confirmer'}};
window.q={emails:Array.from({length:13},(_,i)=>({id:'q'+i,sujet:'Colis à retirer '+i,raison:i===12?'Motif exceptionnel':'Adresse à confirmer'})),cloisonnee:true};
const useMisDeCote=()=>window.q,lireMisDeCote=async()=>window.q,lireReglage=async()=>({adresses:{'boutique@example.test':{},'seconde@example.test':{}}}),lireAdressesVues=async()=>[],lirePreuvesAdresses=async()=>({cloisonnee:true,installation:false,adresses:{'boutique@example.test':{etat:'prouvee',retenue:true}}}),sbAuth=()=>({Authorization:'Bearer fictif'}),estRelaisApple=()=>false,toast=()=>{},askConfirm=async()=>false;
window.lectures=0;window.ecritures=0;window.fetch=async(url,o={})=>{if(o.method&&o.method!=='GET'){window.ecritures++;throw Error('Aucune écriture attendue');}window.lectures++;return{ok:true,json:async()=>({ok:true,emails:[{id:'e1',subject:'Bordereau de ta vente',adresses:['boutique@example.test'],compte:{id:'11',nom:'Ma boutique'},etat:'integre',type:'bordereau',at:new Date().toISOString()}],adresses:[{adresse:'boutique@example.test',declaree:true,comptes:[{id:'11',nom:'Ma boutique'}],derniereReception:new Date().toISOString()},{adresse:'seconde@example.test',declaree:true,comptes:[{id:'12',nom:'Seconde boutique'}]}],collecteur:{dernierSucces:new Date().toISOString()}})};};
${s.slice(a, b)}
const root=createRoot(document.getElementById('root'));window.afficher=()=>root.render(<EmailsSetting key={window.vue||'normal'} onComptes={()=>{}}/>);window.afficher();`,
    },
    bundle: true,
    write: false,
    outfile: "/tmp/vrm-espace-email.js",
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
      const p = await browser.newPage({ viewport: { width, height: 900 } }),
        errs = [];
      p.on("pageerror", (e) => errs.push(e.message));
      await p.setContent(
        '<style>body{margin:0;background:#f2f5f0;font-family:Arial}#root{max-width:1000px;margin:24px auto;padding:12px;box-sizing:border-box}button{cursor:pointer}</style><div id="root"></div>',
      );
      for (const f of bundle.outputFiles)
        if (f.path.endsWith(".css")) await p.addStyleTag({ content: f.text });
        else await p.addScriptTag({ content: f.text });
      await p
        .locator(".vrm-reception-liste")
        .getByText("Bordereau de ta vente", { exact: true })
        .waitFor();
      p.setDefaultTimeout(8000);
      const nav = p.getByRole("navigation", { name: "Rubriques des emails" });
      check(
        !(await p.locator("[data-reglage-adresses]").isVisible()),
        "la réception ne mélange plus les réglages",
      );
      check(
        !(await p.locator('[data-email-panneau="a-traiter"]').isVisible()),
        "la quarantaine ne mélange plus la réception",
      );
      await nav.getByRole("button", { name: /Comptes et transfert/ }).click();
      await p.locator("[data-reglage-adresses]").waitFor({ state: "visible" });
      check(
        !(await p
          .getByRole("heading", { name: "Configurer le transfert d’un compte" })
          .isVisible()),
        "le guide ne surcharge pas la liste des comptes",
      );
      await p
        .getByRole("button", {
          name: "Configurer le transfert de boutique@example.test",
          exact: true,
        })
        .click();
      check(
        await p
          .getByRole("heading", { name: "Configurer le transfert d’un compte" })
          .isVisible(),
        "guide dans la rubrique comptes",
      );
      await p.waitForFunction(
        () =>
          document.querySelector(".vrm-reception-parcours select")?.value ===
          "boutique@example.test",
      );
      check(
        (await p
          .getByRole("combobox", { name: "Compte et adresse", exact: true })
          .inputValue()) === "boutique@example.test",
        "le bouton ouvre directement la bonne adresse",
      );
      await p.getByRole('combobox',{name:'Compte et adresse',exact:true}).selectOption('seconde@example.test');
      await p.getByRole('button',{name:'Configurer le transfert de boutique@example.test',exact:true}).click();
      await p.waitForFunction(()=>document.querySelector('.vrm-reception-parcours select')?.value==='boutique@example.test');
      check(await p.getByRole('combobox',{name:'Compte et adresse',exact:true}).inputValue()==='boutique@example.test','configurer depuis une ligne ne conserve pas le mauvais compte');
      await p.getByRole("button", { name: /4\. Activer le transfert/ }).click();
      await p
        .getByRole("combobox", { name: "Ma messagerie", exact: true })
        .selectOption("outlook");
      await nav.getByRole("button", { name: /Réception/ }).click();
      await nav.getByRole("button", { name: /Comptes et transfert/ }).click();
      check(
        (await p
          .getByRole("combobox", { name: "Ma messagerie", exact: true })
          .inputValue()) === "outlook",
        "la configuration conserve sa progression entre rubriques",
      );
      await nav.getByRole("button", { name: /Réception/ }).click();
      await p
        .getByRole("button", { name: "Vérifier les emails mis de côté" })
        .click();
      check(
        (await nav
          .getByRole("button", { name: /À rattacher/ })
          .getAttribute("aria-pressed")) === "true",
        "le raccourci ouvre la bonne rubrique",
      );
      const lignes = p
        .locator("[data-emails-mis-de-cote]")
        .getByRole("button", { name: "C'est à moi", exact: true });
      check((await lignes.count()) === 10, "dix emails lisibles par page");
      await p
        .getByRole("button", { name: "Afficher les suivants (3)" })
        .click();
      check(
        (await lignes.count()) === 13,
        "les autres emails restent accessibles",
      );
      await p
        .getByLabel("Rechercher dans les emails à rattacher")
        .fill("exceptionnel");
      check((await lignes.count()) === 1, "recherche sur le motif");
      await p
        .getByLabel("Rechercher dans les emails à rattacher")
        .fill("introuvable");
      check(
        await p
          .getByText("Aucun email ne correspond à cette recherche.")
          .isVisible(),
        "recherche vide explicitée",
      );
      await p.evaluate(() =>
        window.dispatchEvent(new Event("vrm:ouvrir-adresses")),
      );
      check(
        await p.locator("[data-reglage-adresses]").isVisible(),
        "le raccourci existant ouvre toujours les adresses",
      );
      check(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "aucun débordement horizontal",
      );
      check(
        (await p.evaluate(() => window.ecritures)) === 0,
        "la navigation ne rejoue aucun email",
      );
      check(
        (await p.evaluate(() => window.lectures)) === 1,
        "les rubriques ne multiplient pas les lectures",
      );
      check(errs.length === 0, "aucune erreur React");
      await p.screenshot({
        path: "/tmp/vrm-emails-comptes-" + width + ".png",
        fullPage: true,
      });
      await nav.getByRole("button", { name: /Réception/ }).click();
      await p.screenshot({
        path: "/tmp/vrm-emails-reception-" + width + ".png",
        fullPage: true,
      });
      await p.evaluate(() => {
        window.q = { emails: [], cloisonnee: true };
        window.vue = "vide";
        window.afficher();
      });
      await nav.getByRole("button", { name: /À rattacher/ }).click();
      check(
        await p
          .getByText("Aucun email à rattacher pour le moment.")
          .isVisible(),
        "état vide distinct de la panne",
      );
      await p.evaluate(() => {
        window.q = null;
        window.vue = "panne";
        window.afficher();
      });
      await nav.getByRole("button", { name: /À rattacher/ }).click();
      check(
        await p
          .getByText(/Je n’ai pas pu vérifier|Je n'ai pas pu vérifier/)
          .isVisible(),
        "une panne reste explicitement inconnue",
      );
      await p.close();
    }
  } finally {
    await browser.close();
  }
  console.log(n + " contrôles de l’espace emails réussis");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
