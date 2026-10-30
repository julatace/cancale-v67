require("./_porte-banc.cjs");
// 30 oct. — « Se connecter avec Discord » sur un compte Discord relié à AUCUN
// compte VRM : Supabase en crée un, vide. VRM doit le DIRE avant d'ouvrir
// l'app, et proposer de supprimer ce compte vide (route « Fermer mon compte »).
// L'autre sens : un compte Discord déjà relié (ancien, ou avec identité email)
// entre directement. Et le refus « déjà relié » est dit en français.
const { chromium } = require("playwright"), http = require("node:http"), fs = require("node:fs"), path = require("node:path");
let ko = 0; const dit = (ok, m, d) => { console.log(`  ${ok ? "✅" : "❌"} ${m}${ok ? "" : " — " + (d || "")}`); if (!ok) ko++; };
(async () => {
  const dist = process.env.BANC_DIST || path.join(__dirname, "../../dist");
  const srv = http.createServer((q, r) => { let f = new URL(q.url, "http://x").pathname; if (f === "/") f = "/index.html"; const p = path.join(dist, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.setHeader("Content-Type", p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : p.endsWith(".html") ? "text/html" : "application/octet-stream"); r.end(fs.readFileSync(p)); });
  await new Promise((r) => srv.listen(Number(process.env.BANC_PORT || 0), "127.0.0.1", r));
  const origine = "http://127.0.0.1:" + srv.address().port;
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const cas = async (W, { identites, creeIlYa, erreur }) => {
    const ctx = await nav.newContext({ viewport: { width: W, height: 860 }, ...(W < 600 ? { isMobile: true, hasTouch: true } : {}) });
    const pg = await ctx.newPage();
    const user = { id: "22222222-2222-4222-8222-222222222222", email: "pseudo@discord.test", created_at: new Date(Date.now() - creeIlYa).toISOString(), identities: identites.map((p) => ({ provider: p })) };
    const appels = { fermer: [], token: 0 };
    await pg.addInitScript(() => sessionStorage.setItem("vrm_pkce", "verificateur-de-banc"));
    await pg.route("**/*", (r) => {
      const u = r.request().url();
      if (u.startsWith(origine) && !u.includes("/api/")) return r.continue();
      if (/\/auth\/v1\/settings/.test(u)) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ external: { discord: true, google: true }, mailer_autoconfirm: false }) });
      if (/grant_type=pkce/.test(u)) { appels.token++; return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "jeton", refresh_token: "r", expires_in: 3600, user }) }); }
      if (/\/auth\/v1\/user/.test(u)) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
      if (/\/auth\/v1\/logout/.test(u)) return r.fulfill({ status: 204, body: "" });
      if (/mode=fermer/.test(u)) { appels.fermer.push(JSON.parse(r.request().postData() || "{}")); return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }); }
      if (/\/api\//.test(u)) return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      if (/\/rest\/v1\//.test(u)) return r.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": "0-0/0" }, body: "[]" });
      return r.abort();
    });
    const q = erreur ? `?error=server_error&error_description=${encodeURIComponent(erreur)}` : "?code=code-de-banc";
    await pg.goto(origine + "/" + q, { waitUntil: "domcontentloaded" });
    await pg.waitForTimeout(3500);
    return { ctx, pg, appels };
  };
  try {
    for (const W of [390, 1512]) {
      console.log(`── ${W} px`);
      { // Compte créé à l'instant par Discord, sans email : on le dit.
        const { ctx, pg, appels } = await cas(W, { identites: ["discord"], creeIlYa: 20000 });
        dit(await pg.locator('[data-porte-nouveau-oauth="choix"]').count() === 1, `[${W}] compte neuf par Discord : VRM le dit avant d'ouvrir l'app`);
        dit(/aucun compte VRM/.test(await pg.evaluate(() => document.body.innerText)), `[${W}] la phrase dit qu'il n'était relié à aucun compte`);
        await pg.click('[data-nouveau-oauth="existant"]');
        dit(appels.fermer.length === 0, `[${W}] rien n'est supprimé avant la confirmation`);
        await pg.click('[data-nouveau-oauth="supprimer"]'); await pg.waitForTimeout(800);
        dit(appels.fermer.length === 1 && appels.fermer[0].confirmation === "pseudo@discord.test", `[${W}] la suppression passe par « Fermer mon compte », avec l'adresse de CE compte`, JSON.stringify(appels.fermer));
        dit(await pg.locator('[data-porte-nouveau-oauth="fait"]').count() === 1 && /Connecter Discord/.test(await pg.evaluate(() => document.body.innerText)), `[${W}] puis le geste : se connecter par email et relier Discord`);
        await ctx.close();
      }
      { // « Oui, c'est un nouveau compte » : l'app s'ouvre.
        const { ctx, pg, appels } = await cas(W, { identites: ["discord"], creeIlYa: 20000 });
        await pg.click('[data-nouveau-oauth="continuer"]'); await pg.waitForTimeout(1500);
        dit(await pg.locator("[data-porte-nouveau-oauth]").count() === 0 && appels.fermer.length === 0, `[${W}] « nouveau compte » : l'app s'ouvre, rien supprimé`);
        await ctx.close();
      }
      { // L'autre sens : un compte Discord ancien (relié) entre sans question.
        const { ctx, pg } = await cas(W, { identites: ["discord"], creeIlYa: 5 * 86400000 });
        dit(await pg.locator("[data-porte-nouveau-oauth]").count() === 0, `[${W}] compte Discord déjà existant : aucune question`);
        await ctx.close();
        const c2 = await cas(W, { identites: ["email", "discord"], creeIlYa: 20000 });
        dit(await c2.pg.locator("[data-porte-nouveau-oauth]").count() === 0, `[${W}] Discord relié à un compte email : aucune question`);
        await c2.ctx.close();
      }
      { // Le refus de Supabase au retour d'une liaison : en français.
        const { ctx, pg } = await cas(W, { identites: [], creeIlYa: 0, erreur: "Identity is already linked to another user" });
        const t = await pg.evaluate(() => document.body.innerText);
        dit(/a déjà son propre compte VRM/.test(t) && !/Identity is already/.test(t), `[${W}] « déjà relié » est dit en français, avec le geste`, t.slice(0, 200));
        await ctx.close();
      }
    }
  } finally { await nav.close(); srv.close(); }
  console.log(ko ? `❌ discord-nouveau-compte : ${ko} défaut(s)` : "✅ discord-nouveau-compte : rien à signaler");
  process.exit(ko ? 1 : 0);
})();
