import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const s = fs.readFileSync(
  new URL("../../src/App.jsx", import.meta.url),
  "utf8",
);
const refresh =
  s.slice(
    s.indexOf("let _authRefreshEnVol ="),
    s.indexOf("const sessionFrom ="),
  ) + ";globalThis.renouveler=authRefresh;";
const ancienne = () => ({
    access_token: "ancien",
    refresh_token: "refresh-a",
    user: { id: "a" },
  }),
  valide = () => ({
    access_token: "neuf",
    refresh_token: "refresh-neuf",
    expires_in: 3600,
    user: { id: "a" },
  });
function banc(reponse, { session = ancienne() } = {}) {
  let appels = 0,
    ecritures = 0;
  const c = vm.createContext({
    AUTH: { session },
    authCall: async () => {
      appels++;
      return typeof reponse === "function" ? reponse() : reponse;
    },
    sessionFrom: (j) => j,
    writeSession: (j) => {
      ecritures++;
      c.AUTH.session = j;
    },
  });
  vm.runInContext(refresh, c);
  return {
    renouveler: (o) => c.renouveler(o),
    changer: (j) => {
      c.AUTH.session = j;
    },
    get session() {
      return c.AUTH.session;
    },
    get appels() {
      return appels;
    },
    get ecritures() {
      return ecritures;
    },
  };
}
test("renouvellement : panne, délai et limitation ne sont pas une révocation", async () => {
  for (const status of [0, 408, 425, 429, 500, 503]) {
    const b = banc({ ok: false, status });
    assert.equal(await b.renouveler(), null);
    assert.equal(b.session.access_token, "ancien");
    assert.equal(b.ecritures, 0);
  }
  for (const status of [400, 401, 403]) {
    const b = banc({ ok: false, status });
    assert.equal(await b.renouveler(), false);
  }
});
test("renouvellement : réponse vide, mauvaise identité et expiration invalide ne remplacent pas la session", async () => {
  for (const json of [
    null,
    {},
    [],
    { access_token: "neuf" },
    { ...valide(), refresh_token: "" },
    { ...valide(), user: { id: "b" } },
    { ...valide(), expires_in: -1 },
    { ...valide(), expires_in: "invalide" },
  ]) {
    const b = banc({ ok: true, json });
    assert.equal(await b.renouveler(), null);
    assert.equal(b.ecritures, 0);
    assert.equal(b.session.user.id, "a");
  }
});
test("renouvellement : une réponse tardive, même refusée, ne déconnecte pas la nouvelle session", async () => {
  for (const reponse of [
    { ok: true, json: valide() },
    { ok: false, status: 400 },
  ]) {
    let liberer;
    const b = banc(
      () =>
        new Promise((r) => {
          liberer = r;
        }),
    );
    const p = b.renouveler();
    await Promise.resolve();
    b.changer({
      access_token: "autre",
      refresh_token: "refresh-b",
      user: { id: "b" },
    });
    liberer(reponse);
    assert.equal(await p, null);
    assert.equal(b.session.user.id, "b");
    assert.equal(b.ecritures, 0);
  }
});
test("renouvellement : un jeton changé par une autre action reste prioritaire", async () => {
  let liberer;
  const b = banc(
    () =>
      new Promise((r) => {
        liberer = r;
      }),
  );
  const p = b.renouveler();
  await Promise.resolve();
  b.changer({ ...ancienne(), access_token: "mfa-prioritaire" });
  liberer({ ok: true, json: valide() });
  assert.equal(await p, null);
  assert.equal(b.session.access_token, "mfa-prioritaire");
  assert.equal(b.ecritures, 0);
});
test("renouvellement : demande partagée et reprise après une session sans jeton de renouvellement", async () => {
  let liberer;
  const b = banc(
    () =>
      new Promise((r) => {
        liberer = r;
      }),
  );
  const p = b.renouveler();
  assert.equal(p, b.renouveler());
  await Promise.resolve();
  assert.equal(b.appels, 1);
  liberer({ ok: true, json: valide() });
  assert.equal(await p, true);
  assert.equal(b.ecritures, 1);
  const c = banc(
    { ok: true, json: valide() },
    { session: { access_token: "ancien" } },
  );
  assert.equal(await c.renouveler(), false);
  c.changer(ancienne());
  assert.equal(await c.renouveler(), true);
  assert.equal(c.appels, 1);
});
test("renouvellement : une panne ne provoque pas une rafale de lectures discrètes", async () => {
  const b = banc({ ok: false, status: 429 });
  assert.equal(await b.renouveler(), null);
  assert.equal(await b.renouveler({ discret: true }), null);
  assert.equal(b.appels, 1);
});
const codeMe =
  s.slice(
    s.indexOf("const fetchMe ="),
    s.indexOf("// Changer son adresse email."),
  ) + ";globalThis.lire=fetchMe;";
function identite(reponse, { bloque = false } = {}) {
  let expirer,
    signal,
    nettoye = false;
  const c = vm.createContext({
    SUPABASE_URL: "https://projet.supabase.co",
    SUPABASE_KEY: "publique",
    AbortController,
    setTimeout: (f) => {
      expirer = f;
      return 1;
    },
    clearTimeout: () => {
      nettoye = true;
    },
    totpVerifies: () => [],
    totpNoms: () => ({}),
    fetch: async (_u, o) => {
      signal = o.signal;
      if (bloque)
        return new Promise((_, rej) =>
          signal.addEventListener("abort", () => rej(Error("délai"))),
        );
      return { ok: true, json: async () => reponse };
    },
  });
  vm.runInContext(codeMe, c);
  return {
    lire: () => c.lire("fictif"),
    expirer: () => expirer(),
    get nettoye() {
      return nettoye;
    },
    get signal() {
      return signal;
    },
  };
}
test("identité du lien email : requête bornée, résultat vide refusé, vérification normale conservée", async () => {
  const b = identite(null, { bloque: true }),
    p = b.lire();
  b.expirer();
  assert.equal(await p, null);
  assert.equal(b.signal.aborted, true);
  assert.equal(b.nettoye, true);
  for (const json of [null, {}, [], { id: " " }]) {
    const c = identite(json);
    assert.equal(await c.lire(), null);
    assert.equal(c.nettoye, true);
  }
  const c = identite({ id: "a" });
  assert.equal((await c.lire()).id, "a");
  assert.equal(c.nettoye, true);
});
