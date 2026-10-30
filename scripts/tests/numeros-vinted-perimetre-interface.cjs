const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  { chromium } = require("playwright");
(async () => {
  const code = fs.readFileSync(
    process.env.VRM_CAPTURE_SOURCE ||
      path.resolve(__dirname, "../../vinted-sync-extension/vinted-capture.js"),
    "utf8",
  );
  const browser = await chromium.launch({
    executablePath: process.env.VRM_CHROMIUM_PATH || (require("fs").existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : "/opt/pw-browsers/chromium"),
    args: ["--no-sandbox"],
  });
  let n = 0;
  try {
    for (const width of [390, 1512]) {
      const p = await browser.newPage({ viewport: { width, height: 850 } });
      await p.route("https://www.vinted.fr/**", (r) =>
        r.fulfill({
          contentType: "text/html",
          body: '<html><body><a href="/items/10400000001-article"><img width="150" height="150"></a></body></html>',
        }),
      );
      await p.goto("https://www.vinted.fr/member/111-moi");
      await p.evaluate(() => {
        window.retarder = false;
        window.appels = [];
        window.chrome = {
          runtime: {
            id: "banc",
            sendMessage: (m, cb) => {
              window.appels.push(m);
              const route = location.pathname;
              if (m.action === "numeros") {
                const r = route.includes("/member/111")
                  ? {
                      ok: true,
                      items: { 10400000001: "73" },
                      convs: {},
                      txs: {},
                    }
                  : {
                      ok: true,
                      items: {},
                      convs: {},
                      txs: {},
                      portee: "hors_compte",
                    };
                if (window.retarder) window.finNumero = () => cb(r);
                else cb(r);
              } else cb({ ok: true });
            },
          },
        };
      });
      await p.addScriptTag({ content: code });
      await p.locator("[data-vrm-num-pour]").waitFor();
      assert.equal(await p.locator("[data-vrm-num-pour]").innerText(), "N°73");
      n++;
      await p.evaluate(() => history.pushState({}, "", "/member/222-autre"));
      await p.waitForTimeout(1500);
      assert.equal(
        await p.locator("[data-vrm-num-pour]").count(),
        0,
        "aucune pastille héritée sur le profil étranger",
      );
      n++;
      await p.evaluate(() => {
        window.retarder = true;
        history.pushState({}, "", "/member/111-moi");
      });
      await p.waitForFunction(() => typeof window.finNumero === "function");
      await p.evaluate(() => {
        history.pushState({}, "", "/member/222-autre");
        window.finNumero();
        window.retarder = false;
      });
      await p.waitForTimeout(1500);
      assert.equal(
        await p.locator("[data-vrm-num-pour]").count(),
        0,
        "une ancienne réponse ne peint pas le nouveau profil",
      );
      n++;
      assert.equal(
        await p.evaluate(() =>
          window.appels.some((x) => x.action === "numeroPourPublier"),
        ),
        false,
        "visiter un profil ne réserve aucun numéro",
      );
      n++;
      await p.close();
    }
  } finally {
    await browser.close();
  }
  console.log(n + " contrôles de périmètre des numéros sur Vinted réussis");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
