require("./_porte-banc.cjs");
// Vraie application, retour email/OAuth simulé ; aucune écriture de mot de passe.
const { chromium } = require("playwright"),
  http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
(async () => {
  const dist = process.env.BANC_DIST || path.join(__dirname, "../../dist");
  const srv = http.createServer((q, r) => {
    let f = new URL(q.url, "http://localhost").pathname;
    if (f === "/") f = "/index.html";
    const p = path.join(dist, f);
    if (!fs.existsSync(p)) {
      r.writeHead(404);
      return r.end();
    }
    r.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    r.setHeader(
      "Content-Type",
      p.endsWith(".js")
        ? "text/javascript"
        : p.endsWith(".css")
          ? "text/css"
          : p.endsWith(".html")
            ? "text/html"
            : "application/octet-stream",
    );
    r.end(fs.readFileSync(p));
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const origine = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch({
    executablePath: process.env.VRM_CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const width of [320, 390, 1512])
      for (const mode of ["fragment", "pkce"]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
        });
        page.setDefaultTimeout(8000);
        await page.emulateMedia({ reducedMotion: "reduce" });
        const erreurs = [],
          privees = [],
          referents = [];
        let misesAJour = 0;
        page.on("pageerror", (e) => erreurs.push(e.message));
        const user = {
          id: "11111111-1111-4111-8111-111111111111",
          email: "client@exemple.test",
        };
        await page.addInitScript(() =>
          sessionStorage.setItem("vrm_pkce", "verificateur-de-banc"),
        );
        await page.route("**/*", (r) => {
          const ref = r.request().headers().referer || "";
          if (ref) referents.push(ref);
          const u = r.request().url(),
            j = (status, json) => r.fulfill({ status, json });
          if (u.includes("/auth/v1/settings"))
            return j(200, { external: {}, mailer_autoconfirm: false });
          if (u.includes("/auth/v1/token"))
            return j(200, {
              access_token: "jeton-de-banc",
              refresh_token: "refresh-de-banc",
              expires_in: 3600,
              user,
            });
          if (u.includes("/auth/v1/user")) {
            if (r.request().method() !== "GET") misesAJour++;
            return j(200, user);
          }
          if (u.includes("/rest/v1/")) {
            if (!/select=owner&limit=1|select=id&limit=1/.test(u))
              privees.push(u.split("/rest/v1/")[1]);
            return j(200, []);
          }
          if (u.includes("/api/")) return j(200, {});
          if (u.startsWith(origine + "/")) return r.continue();
          return r.abort();
        });
        await page.goto(
          origine +
            (mode === "fragment"
              ? "/#access_token=jeton-de-banc&refresh_token=refresh-de-banc&expires_in=3600&type=recovery"
              : "/?%63ode=code-fictif&type=recovery"),
        );
        await page
          .getByRole("heading", { name: "Nouveau mot de passe", exact: true })
          .waitFor();
        assert.equal(
          await page.getByLabel("Adresse email", { exact: true }).count(),
          0,
        );
        assert.equal(
          await page
            .getByRole("button", { name: "Se connecter", exact: true })
            .count(),
          0,
          "Le retour ne présente pas une connexion ordinaire",
        );
        const u = new URL(page.url());
        assert.equal(u.hash, "");
        assert.equal(u.searchParams.has("code"), false);
        assert.equal(u.searchParams.has("type"), false);
        await page.locator("#vrm-cx-password").fill("NouveauSecret123");
        assert.equal(misesAJour, 0, "Saisir le mot de passe ne l’envoie pas");
        assert.deepEqual(
          privees,
          [],
          "Aucune lecture de stock, ventes ou comptes pendant la récupération",
        );
        assert.equal(
          referents.some(
            (ref) =>
              ref.includes("code-fictif") || ref.includes("jeton-de-banc"),
          ),
          false,
          "Le lien sensible ne doit pas accompagner les requêtes en Referer",
        );
        assert.deepEqual(erreurs, []);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        if (width === 390 && mode === "fragment")
          await page.screenshot({
            path: "/tmp/vrm-recuperation-retour-390.png",
            fullPage: true,
          });
        await page.close();
        console.log(
          `OK retour récupération ${mode} ${width}px : formulaire immédiat, URL nettoyée, aucune lecture de boutique ni écriture de mot de passe.`,
        );
      }
  } finally {
    await browser.close();
    await new Promise((r) => srv.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
