import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const source = fs.readFileSync(
  new URL("../../src/App.jsx", import.meta.url),
  "utf8",
);
const code =
  source.slice(
    source.indexOf("const authSignIn  ="),
    source.indexOf("// ── CONFIRMER EN COLLANT"),
  ) + ";globalThis.connecter=authSignIn;";
function banc(reponse) {
  let session = null,
    demande;
  const c = vm.createContext({
    authCall: async (route, corps) => {
      demande = { route, corps };
      return reponse;
    },
    sessionFrom: (j) => j,
    writeSession: (s) => {
      session = s;
    },
  });
  vm.runInContext(code, c);
  return {
    connecter: () => c.connecter(" Client@exemple.test ", "Secret123"),
    get session() {
      return session;
    },
    get demande() {
      return demande;
    },
  };
}
test("connexion : une réponse 200 incomplète ne crée pas de fausse session", async () => {
  for (const json of [
    null,
    {},
    [],
    { access_token: "jeton" },
    { access_token: " ", user: { id: "client" } },
    { access_token: "jeton", user: {} },
    { access_token: 42, user: { id: "client" } },
  ]) {
    const b = banc({ ok: true, json });
    const r = await b.connecter();
    assert.equal(r.ok, false);
    assert.match(r.error, /pas pu être confirmée/);
    assert.equal(b.session, null);
  }
});
test("connexion : seule une réponse portant le jeton et son utilisateur est enregistrée", async () => {
  const j = { access_token: "jeton", user: { id: "client" } };
  const b = banc({ ok: true, json: j });
  assert.equal((await b.connecter()).ok, true);
  assert.equal(b.session, j);
  assert.equal(b.demande.corps.email, "client@exemple.test");
});
test("connexion : confirmation attendue et identifiants refusés restent distincts", async () => {
  const b = banc({ ok: false, error: "Email not confirmed" });
  assert.equal((await b.connecter()).needsConfirm, true);
  assert.equal(b.session, null);
  const c = banc({ ok: false, error: "Invalid login credentials" });
  assert.equal((await c.connecter()).error, "Email ou mot de passe incorrect.");
  assert.equal(c.session, null);
});
