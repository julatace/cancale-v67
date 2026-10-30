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
    source.indexOf("let AUTH_SETTINGS = null;"),
    source.indexOf("const oauthStart ="),
  ) +
  ";globalThis.moyens={charger:loadAuthSettings,etat:etatAuthSettings,abonner:onAuthSettingsChange,active:providerEnabled};";
function banc(fetch) {
  const timers = new Map();
  let n = 0;
  const c = vm.createContext({
    fetch,
    SUPABASE_URL: "https://projet.supabase.co",
    SUPABASE_KEY: "publique",
    AbortController,
    setTimeout: (f) => {
      timers.set(++n, f);
      return n;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  vm.runInContext(code, c);
  return {
    ...c.moyens,
    expirer: () => {
      for (const f of timers.values()) f();
    },
    get timers() {
      return timers.size;
    },
  };
}
const rep = (json) => ({ ok: true, json: async () => json });
test("moyens : demandes partagées, notification à la fin et fournisseurs strictement activés", async () => {
  let appels = 0,
    liberer;
  const b = banc(() => {
    appels++;
    return new Promise((resolve) => {
      liberer = resolve;
    });
  });
  const etats = [];
  const off = b.abonner(() => etats.push(b.etat().statut));
  const p = b.charger();
  assert.equal(p, b.charger());
  await Promise.resolve();
  assert.equal(appels, 1);
  assert.equal(b.etat().statut, "chargement");
  liberer(
    rep({
      external: { google: true, discord: false },
      mailer_autoconfirm: false,
    }),
  );
  await p;
  assert.deepEqual(etats, ["chargement", "pret"]);
  assert.equal(b.active("google"), true);
  assert.equal(b.active("discord"), false);
  assert.equal(b.timers, 0);
  off();
});
test("moyens : réponse vide ou flags mal formés ne proposent pas un fournisseur", async () => {
  for (const json of [
    null,
    {},
    [],
    { external: [] },
    { external: { google: "false" } },
    { external: { discord: 1 } },
    { external: {}, mailer_autoconfirm: "false" },
  ]) {
    const b = banc(async () => rep(json));
    assert.equal(await b.charger(), null);
    assert.equal(b.etat().statut, "erreur");
    assert.equal(b.active("google"), false);
    assert.equal(b.active("discord"), false);
    assert.equal(b.timers, 0);
  }
});
test("moyens : un échec réseau synchrone libère le verrou pour une reprise", async () => {
  let appels = 0;
  const b = banc(() => {
    if (++appels === 1) throw Error("réseau");
    return Promise.resolve(rep({ external: { google: true } }));
  });
  await b.charger();
  assert.equal(b.etat().statut, "erreur");
  await b.charger();
  assert.equal(appels, 2);
  assert.equal(b.etat().statut, "pret");
  assert.equal(b.active("google"), true);
});
test("moyens : interruption bornée, sans AbortSignal.timeout, puis reprise possible", async () => {
  let appels = 0,
    signal;
  const b = banc((_url, o) => {
    signal = o.signal;
    if (++appels === 1)
      return new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(Error("délai"))),
      );
    return Promise.resolve(rep({ external: { discord: true } }));
  });
  const p = b.charger();
  await Promise.resolve();
  b.expirer();
  await p;
  assert.equal(signal.aborted, true);
  assert.equal(b.etat().statut, "erreur");
  assert.equal(b.timers, 0);
  await b.charger();
  assert.equal(b.active("discord"), true);
});
test("moyens : un désabonnement ne reçoit plus les nouvelles lectures", async () => {
  let n = 0;
  const b = banc(async () => rep({ external: {} })),
    off = b.abonner(() => n++);
  off();
  await b.charger();
  assert.equal(n, 0);
  assert.equal(b.etat().statut, "pret");
});
