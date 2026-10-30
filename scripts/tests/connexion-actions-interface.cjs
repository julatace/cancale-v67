// Vrai AuthScreen, services d’authentification entièrement simulés.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { build } = require("esbuild"),
  { chromium } = require("playwright");
(async () => {
  const root = path.resolve(__dirname, "../.."),
    s = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8"),
    a = s.indexOf("function AuthScreen()"),
    b = s.indexOf("// Carte d'accueil affichée", a);
  assert(a > 0 && b > a);
  const bundle = await build({
    stdin: {
      resolveDir: root,
      loader: "jsx",
      contents: `import React from'react';import{createRoot}from'react-dom/client';
 const C={text:'#223d41',muted:'#647676',bg:'#f2f5f0',card:'#fff',border:'#dce4de',accent:'#315e62',warn:'#946d27',danger:'#a33c36',onAccent:'#fff'},AUTH_REDIRECT=null,CLOISONNE=true,__lier=null;
 const sondeLectureSansCompte=async()=>false,useSecondesRestantes=()=>0,useCaptcha=()=>({statut:'pret'}),captchaActif=()=>false,confirmRequired=()=>false,CaptchaConnexion=()=>null,LiensLegaux=()=>null,BrandMark=()=>null;
 const etatAuthSettings=()=>({statut:'pret'}),onAuthSettingsChange=()=>()=>{},loadAuthSettings=async()=>{};
 const OAUTH_PROVIDERS=[{id:'google',label:'Google'},{id:'discord',label:'Discord'}],providerEnabled=()=>true,delaiDemandeEmail=()=>null,TEXTE_DELAI_EMAIL_BOUTON='',texteDelaiEmail=()=>'',save=()=>{};
 window.appels=[];window.attentes={};const demande=(action)=>{window.appels.push(action);return new Promise((resolve,reject)=>{window.attentes[action]={resolve,reject};});};
 const oauthStart=p=>demande(p),authSignIn=()=>demande('connexion'),authSignUp=()=>demande('inscription'),authReset=()=>demande('reset'),authSetPassword=()=>demande('motdepasse'),authResendConfirm=()=>demande('renvoyer'),authMagicLink=()=>demande('lien'),authConfirmFromLink=()=>demande('confirmer');
 ${s.slice(a, b)}
 const root=createRoot(document.getElementById('root'));let cle=0;window.remonter=()=>{window.appels=[];root.render(<AuthScreen key={++cle}/>);};window.remonter();`,
    },
    bundle: true,
    write: false,
    logLevel: "silent",
  });
  const browser = await chromium.launch({
    executablePath: process.env.VRM_CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [320, 390, 1512]) {
      const p = await browser.newPage({ viewport: { width, height: 900 } });
      p.setDefaultTimeout(6000);
      const erreurs = [];
      p.on("pageerror", (e) => erreurs.push(e.message));
      await p.emulateMedia({ reducedMotion: "reduce" });
      await p.setContent(
        '<style>body{margin:0;font-family:Arial}</style><div id="root"></div>',
      );
      await p.addScriptTag({ content: bundle.outputFiles[0].text });
      const resoudre = async (action, reponse) =>
        p.evaluate(
          ({ action, reponse }) => window.attentes[action].resolve(reponse),
          { action, reponse },
        );
      const appels = () => p.evaluate(() => window.appels);
      await p
        .getByRole("button", { name: "Continuer avec Google", exact: true })
        .waitFor();
      await p.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((b) =>
          b.textContent.includes("Continuer avec Google"),
        );
        b.click();
        b.click();
      });
      await p
        .getByRole("button", { name: "Ouverture de Google…", exact: true })
        .waitFor();
      assert.deepEqual(await appels(), ["google"]);
      assert.equal(
        await p
          .getByRole("button", { name: "Continuer avec Discord", exact: true })
          .isDisabled(),
        true,
      );
      await resoudre("google", { ok: false, error: "Connexion annulée." });
      await p
        .getByRole("alert")
        .filter({ hasText: "Connexion annulée" })
        .waitFor();
      assert.equal(
        await p
          .getByRole("button", { name: "Continuer avec Google", exact: true })
          .isEnabled(),
        true,
      );
      await p
        .getByRole("button", { name: "Continuer avec Discord", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Ouverture de Discord…", exact: true })
        .waitFor();
      await resoudre("discord", { ok: true });
      await p.evaluate(() =>
        window.dispatchEvent(
          new PageTransitionEvent("pageshow", { persisted: true }),
        ),
      );
      assert.equal(
        await p
          .getByRole("button", { name: "Continuer avec Discord", exact: true })
          .isEnabled(),
        true,
      );
      await p
        .getByLabel("Adresse email", { exact: true })
        .fill("client@exemple.test");
      await p.getByLabel("Mot de passe", { exact: true }).fill("Six123");
      await p
        .getByRole("button", { name: "Se connecter", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Connexion…", exact: true })
        .waitFor();
      assert.ok(
        (await appels()).includes("connexion"),
        "Un ancien mot de passe de six caractères atteint le service",
      );
      await resoudre("connexion", {
        ok: false,
        needsConfirm: true,
        error: "Email non confirmé",
      });
      await p.locator("[data-auth-renvoyer]").waitFor();
      await p.evaluate(() => {
        const b = document.querySelector("[data-auth-renvoyer]");
        b.click();
        b.click();
      });
      assert.equal((await appels()).filter((x) => x === "renvoyer").length, 1);
      assert.equal(
        await p.locator("[data-auth-lien-connexion]").isDisabled(),
        true,
      );
      await resoudre("renvoyer", { ok: false, error: "Envoi indisponible." });
      await p
        .getByRole("alert")
        .filter({ hasText: "Envoi indisponible" })
        .waitFor();
      await p.locator("[data-auth-lien-connexion]").click();
      await resoudre("lien", { ok: true });
      await p
        .getByRole("status")
        .filter({ hasText: "Lien de connexion envoyé" })
        .waitFor();
      await p.locator(".vrm-cx-aide-confirmation summary").click();
      await p
        .getByLabel("Lien de confirmation reçu par email")
        .fill("https://exemple.test/?token_hash=fictif");
      await p.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((b) =>
          b.textContent.includes("Confirmer avec ce lien"),
        );
        b.click();
        b.click();
      });
      assert.equal((await appels()).filter((x) => x === "confirmer").length, 1);
      await resoudre("confirmer", { ok: true, connected: false });
      await p
        .getByRole("status")
        .filter({
          hasText: "Adresse confirmée. Tu peux maintenant te connecter",
        })
        .waitFor();
      assert.equal(await p.locator("[data-auth-renvoyer]").count(), 0);
      assert.equal(
        await p
          .getByRole("button", { name: "Se connecter", exact: true })
          .isEnabled(),
        true,
      );
      // Une exception inattendue doit aussi libérer les actions.
      await p
        .getByRole("button", { name: "Se connecter", exact: true })
        .click();
      await p.evaluate(() =>
        window.attentes.connexion.reject(Error("panne simulée")),
      );
      await p
        .getByRole("alert")
        .filter({ hasText: "La demande n’a pas pu être confirmée" })
        .waitFor();
      assert.equal(
        await p
          .getByRole("button", { name: "Se connecter", exact: true })
          .isEnabled(),
        true,
      );
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assert.deepEqual(erreurs, []);
      await p.close();
      console.log(
        "OK audit actions " +
          width +
          "px : OAuth, retour navigateur, ancien mot de passe, renvoi, lien et confirmation, demandes uniques et reprise après exception.",
      );
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
