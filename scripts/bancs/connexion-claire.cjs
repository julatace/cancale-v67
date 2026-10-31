require("./_porte-banc.cjs");
// Vraie application, faux service d’authentification. Aucun compte réel.
const { chromium } = require("playwright"),
  http = require("http"),
  fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
(async () => {
  const dist = process.env.BANC_DIST || path.join(__dirname, "../../dist");
  const srv = http.createServer((req, res) => {
    let f = new URL(req.url, "http://localhost").pathname;
    if (f === "/") f = "/index.html";
    const p = path.join(dist, f);
    if (!fs.existsSync(p)) {
      res.writeHead(404);
      return res.end();
    }
    res.setHeader(
      "Content-Type",
      p.endsWith(".js")
        ? "text/javascript"
        : p.endsWith(".css")
          ? "text/css"
          : p.endsWith(".html")
            ? "text/html"
            : "application/octet-stream",
    );
    res.end(fs.readFileSync(p));
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const origine = "http://127.0.0.1:" + srv.address().port;
  const nav = await chromium.launch({
    executablePath: process.env.VRM_CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const largeur of [320, 390, 1512]) {
      const p = await nav.newPage({
        viewport: { width: largeur, height: 900 },
      });
      await p.emulateMedia({ reducedMotion: "reduce" });
      let appels = 0,
        liberer,
        compteNonConfirme = false,
        recuperations = 0,
        lecturesMoyens = 0,
        libererMoyens;
      const erreurs = [];
      p.on("pageerror", (e) => erreurs.push(e.message));
      await p.route("**/*", async (r) => {
        const u = r.request().url(),
          json = (status, data) => r.fulfill({ status, json: data });
        if (u.includes("/auth/v1/token")) {
          appels++;
          if (appels === 1)
            await new Promise((resolve) => {
              liberer = resolve;
            });
          return compteNonConfirme
            ? json(400, { msg: "Email not confirmed" })
            : json(200, {});
        }
        if (u.includes("/auth/v1/recover")) {
          recuperations++;
          return json(200, {});
        }
        if (u.includes("/auth/v1/settings")) {
          lecturesMoyens++;
          if (lecturesMoyens === 1) return json(503, {});
          await new Promise((resolve) => {
            libererMoyens = resolve;
          });
          return json(200, {
            external: { google: true, discord: false },
            mailer_autoconfirm: false,
          });
        }
        if (u.includes("/rest/v1/")) {
          assert.equal(r.request().method(), "GET");
          return json(200, []);
        }
        if (u.includes("/api/")) return json(200, {});
        if (u.startsWith(origine + "/")) return r.continue();
        return r.abort();
      });
      await p.addInitScript(() =>
        Object.defineProperty(AbortSignal, "timeout", {
          value: undefined,
          configurable: true,
        }),
      );
      await p.goto(origine + "/?connexion");
      await p.locator("[data-auth-moyens-indisponibles]").waitFor();
      assert.equal(
        await p
          .getByRole("button", { name: "Se connecter", exact: true })
          .isEnabled(),
        true,
        "L’email reste utilisable après une panne de lecture",
      );
      assert.equal(
        await p
          .getByRole("button", { name: "Continuer avec Google", exact: true })
          .count(),
        0,
      );
      await p
        .getByRole("button", {
          name: "Réessayer les moyens de connexion",
          exact: true,
        })
        .click();
      for (let i = 0; i < 100 && !libererMoyens; i++)
        await p.waitForTimeout(20);
      assert.ok(libererMoyens);
      assert.equal(lecturesMoyens, 2);
      assert.equal(
        await p
          .getByRole("button", { name: "Se connecter", exact: true })
          .isEnabled(),
        true,
        "La relecture ne bloque pas le formulaire",
      );
      libererMoyens();
      await p
        .getByRole("button", { name: "Continuer avec Google", exact: true })
        .waitFor();
      assert.equal(
        await p
          .getByRole("button", { name: "Continuer avec Discord", exact: true })
          .count(),
        0,
        "Un fournisseur désactivé reste masqué",
      );
      assert.equal(
        await p.locator("[data-auth-moyens-indisponibles]").count(),
        0,
      );

      await p
        .getByRole("textbox", { name: "Adresse email", exact: true })
        .fill("Client@exemple.test");
      await p.getByLabel("Mot de passe", { exact: true }).fill("Secret123");
      if (largeur < 900) {
        assert.ok(
          (await p
            .locator(".vrm-cx-marque")
            .evaluate((el) => el.getBoundingClientRect().height)) < 280,
          "L’en-tête ne gaspille pas la hauteur du téléphone",
        );
      }
      await p.screenshot({
        path: `/tmp/vrm-connexion-${largeur}.png`,
        fullPage: true,
      });
      await p.evaluate(() => {
        const f = document.querySelector("[data-connexion] form");
        f.requestSubmit();
        f.requestSubmit();
      });
      for (let i = 0; i < 100 && !liberer; i++) await p.waitForTimeout(20);
      assert.ok(liberer);
      assert.equal(appels, 1);
      assert.equal(
        await p
          .getByRole("button", { name: "Mot de passe oublié ?", exact: true })
          .isDisabled(),
        true,
      );
      assert.equal(
        await p
          .getByRole("button", { name: "Créer un compte", exact: true })
          .isDisabled(),
        true,
      );
      liberer();
      await p
        .getByRole("alert")
        .filter({ hasText: "La connexion n’a pas pu être confirmée" })
        .waitFor();
      assert.equal(
        await p.getByLabel("Mot de passe", { exact: true }).inputValue(),
        "Secret123",
      );
      assert.equal(
        await p.evaluate(() => localStorage.getItem("vrm_session")),
        null,
      );
      await p
        .getByRole("button", { name: "Mot de passe oublié ?", exact: true })
        .click();
      assert.equal(
        await p
          .getByRole("button", { name: "Créer un compte", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await p
          .getByRole("textbox", { name: "Adresse email", exact: true })
          .inputValue(),
        "Client@exemple.test",
      );
      await p
        .getByRole("button", { name: "Envoyer le lien", exact: true })
        .click();
      await p
        .getByRole("status")
        .filter({ hasText: "Si un compte existe" })
        .waitFor();
      assert.equal(recuperations, 1);
      await p.getByRole("button", { name: "Retour", exact: true }).click();
      assert.equal(await p.getByRole("status").count(), 0);
      compteNonConfirme = true;
      await p
        .getByRole("button", { name: "Se connecter", exact: true })
        .click();
      await p.locator("[data-auth-renvoyer]").waitFor();
      assert.equal(
        await p.getByRole("alert").count(),
        0,
        "La confirmation attendue n’est pas doublée d’une erreur",
      );
      const aide = p.locator(".vrm-cx-aide-confirmation");
      assert.equal(await aide.getAttribute("open"), null);
      assert.equal(
        await p.getByLabel("Lien de confirmation reçu par email").isVisible(),
        false,
      );
      assert.equal(await p.locator("[data-auth-renvoyer]").isVisible(), true);
      await p.screenshot({
        path: `/tmp/vrm-connexion-confirmation-${largeur}.png`,
        fullPage: true,
      });
      await aide.locator("summary").click();
      assert.equal(
        await p.getByLabel("Lien de confirmation reçu par email").isVisible(),
        true,
      );
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        "L’aide ouverte ne déborde pas",
      );
      await p
        .getByRole("button", { name: "Mot de passe oublié ?", exact: true })
        .click();
      await p.getByRole("button", { name: "Retour", exact: true }).click();
      assert.equal(
        await aide.count(),
        0,
        "Les anciens états sont nettoyés au retour",
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
        `OK connexion ${largeur}px : réponse incomplète refusée, double clic protégé, navigation bloquée pendant la demande, récupération et confirmation lisibles.`,
      );
    }
  } finally {
    await nav.close();
    await new Promise((r) => srv.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
