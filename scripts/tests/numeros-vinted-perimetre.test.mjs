import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
const source = fs.readFileSync(
  process.env.VRM_NUMEROS_SOURCE ||
    new URL("../../vinted-sync-extension/background.js", import.meta.url),
  "utf8",
);
const fn = (nom) => {
  const a = source.indexOf("async function " + nom + "(");
  assert.ok(a >= 0, nom + " existe");
  return source.slice(a, source.indexOf("\n}", a) + 2);
};
test("seul le profil du compte connecté est autorisé, jamais l’account_id à sa place", async () => {
  let uid = "900",
    profil = "111";
  const ctx = vm.createContext({
    URL,
    activeAccountId: async () => uid,
    profilIdRange: async () => profil,
  });
  vm.runInContext(fn("numerosPermisDansPage"), ctx);
  const autorise = (url) => ctx.numerosPermisDansPage({ tab: { url } });
  assert.equal(await autorise("https://www.vinted.fr/member/111-moi"), true);
  for (const url of [
    "https://www.vinted.fr/member/222-autre",
    "https://www.vinted.fr/member/900",
    "https://evil.test/member/111",
    "http://www.vinted.fr/member/111",
  ])
    assert.equal(await autorise(url), false);
  profil = null;
  assert.equal(await autorise("https://www.vinted.fr/member/111-moi"), false);
  profil = "111";
  uid = null;
  assert.equal(await autorise("https://www.vinted.fr/member/111-moi"), false);
});
test("la commande de numéros ne lit ni ne renvoie les numéros sur un profil étranger", async () => {
  const a = source.indexOf("          if (msg.action === 'numeros') {"),
    b = source.indexOf(
      "          sendResponse({ ok: false, error: 'action inconnue' });",
      a,
    );
  assert.ok(a >= 0 && b > a);
  let lectures = 0,
    reponse;
  const ctx = vm.createContext({
    msg: { action: "numeros", items: ["10400000001"] },
    sender: { tab: { url: "https://www.vinted.fr/member/222" } },
    numerosPermisDansPage: async () => false,
    numerosPourAffichage: async () => {
      lectures++;
      return { parItem: { 10400000001: "73" }, parConv: {}, parTx: {} };
    },
    sendResponse: (r) => (reponse = r),
  });
  await vm.runInContext("(async()=>{" + source.slice(a, b) + "})()", ctx);
  assert.equal(lectures, 0);
  assert.equal(Object.keys(reponse.items).length, 0);
});
test("le cache de numéros ne traverse pas les propriétaires VRM", async () => {
  let owner = "a";
  const ctx = vm.createContext({
    loadSession: async () => ({ user_id: owner }),
    lireMain: async () => ({
      vinted_annonce_numeros: { 1234: { numero: owner === "a" ? "73" : "88" } },
    }),
    lireResa: async () => ({ items: {} }),
    sbGetTout: async () => [],
    Date,
  });
  vm.runInContext("let _numsAffichage=null;" + fn("numerosPourAffichage"), ctx);
  assert.equal((await ctx.numerosPourAffichage()).parItem["1234"], "73");
  owner = "b";
  assert.equal((await ctx.numerosPourAffichage()).parItem["1234"], "88");
  owner = "";
  assert.equal(await ctx.numerosPourAffichage(), null);
});
