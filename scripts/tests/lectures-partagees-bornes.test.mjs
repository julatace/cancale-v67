import test from "node:test";
import assert from "node:assert/strict";
import { creerLecturesPartagees } from "../../src/lecturesPartagees.js";
const base = "https://base.example.test",
  url = base + "/rest/v1/app_data?id=eq.main";
test("2000 lectures distinctes bloquées ne conservent pas un cache sans limite", () => {
  const lp = creerLecturesPartagees(() => new Promise(() => {}), base);
  for (let i = 0; i < 2000; i++) void lp.fetch(url + "&page=" + i);
  assert.ok(lp.stats.retenues <= 256);
  assert.equal(lp.stats.parties, 2000);
});
test("les entrées périmées sont libérées même si personne ne rappelle leur URL", () => {
  let maintenant = 0;
  const lp = creerLecturesPartagees(() => new Promise(() => {}), base, {
    maintenant: () => maintenant,
  });
  void lp.fetch(url);
  maintenant = 9000;
  void lp.fetch(url + "&autre=1");
  assert.equal(lp.stats.retenues, 1);
});
test("une éviction ne perd pas la réponse attendue et les appels identiques restants sont partagés", async () => {
  const fins = [];
  let appels = 0;
  const lp = creerLecturesPartagees(
    () => {
      appels++;
      return new Promise((r) => fins.push(r));
    },
    base,
    { maxEntrees: 2, fenetre: 10 },
  );
  const a = lp.fetch(url + "&page=1"),
    b = lp.fetch(url + "&page=2"),
    c = lp.fetch(url + "&page=3"),
    d = lp.fetch(url + "&page=3");
  assert.equal(lp.stats.retenues, 2);
  assert.equal(appels, 3);
  fins.forEach((r, i) => r(Response.json([i + 1])));
  assert.deepEqual(
    await Promise.all(
      [a, b, c, d].map(async (r) => (await (await r).json())[0]),
    ),
    [1, 2, 3, 3],
  );
});
test("un POST Request vers la base invalide une ancienne lecture", async () => {
  let valeur = 1;
  const lp = creerLecturesPartagees(
    async (input, init) => {
      const method = init?.method || input?.method || "GET";
      if (method === "POST") {
        valeur++;
        return Response.json({ ok: true });
      }
      return Response.json([valeur]);
    },
    base,
    { fenetre: 10 },
  );
  assert.deepEqual(await (await lp.fetch(url)).json(), [1]);
  await lp.fetch(
    new Request(base + "/rest/v1/app_data", { method: "POST", body: "{}" }),
  );
  assert.deepEqual(await (await lp.fetch(url)).json(), [2]);
});
test("un POST Request vers une route VRM invalide aussi les lectures au départ et au retour", async () => {
  let valeur = 1,
    fin;
  const lp = creerLecturesPartagees(
    async (input, init) => {
      if ((init?.method || input?.method) === "POST")
        return await new Promise(
          (r) =>
            (fin = () => {
              valeur = 2;
              r(Response.json({ ok: true }));
            }),
        );
      return Response.json([valeur]);
    },
    base,
    { origine: "https://vrm.example.test", fenetre: 10 },
  );
  await lp.fetch(url);
  const ecriture = lp.fetch(
    new Request("https://vrm.example.test/api/ebay", { method: "POST" }),
  );
  assert.equal(lp.stats.retenues, 0);
  assert.deepEqual(await (await lp.fetch(url)).json(), [1]);
  fin();
  await ecriture;
  assert.deepEqual(await (await lp.fetch(url)).json(), [2]);
});
test("les lectures Request restent non partagées et leurs corps indépendants", async () => {
  let n = 0;
  const lp = creerLecturesPartagees(async () => Response.json([++n]), base, {
    fenetre: 10,
  });
  const req = new Request(url);
  const a = await lp.fetch(req),
    b = await lp.fetch(req);
  assert.deepEqual(await a.json(), [1]);
  assert.deepEqual(await b.json(), [2]);
  assert.equal(lp.stats.retenues, 0);
});
test("(31 oct.) une route VRM qui DÉCLARE vider elle-même (vrmInvalideSiChange) garde les lectures ; vers la base, le drapeau ne vaut rien", async () => {
  let appels = 0;
  const lp = creerLecturesPartagees(
    async (input, init) => {
      if ((init?.method || input?.method) === "POST") return Response.json({ ok: true });
      appels++;
      return Response.json([appels]);
    },
    base,
    { origine: "https://vrm.example.test", fenetre: 60000 },
  );
  await lp.fetch(url);
  await lp.fetch("/api/relais?mode=transp", { method: "POST", body: "{}", vrmInvalideSiChange: true });
  assert.deepEqual(await (await lp.fetch(url)).json(), [1], "la lecture est restée partagée");
  // Sans le drapeau, la même route vide tout (la règle générale ne bouge pas).
  await lp.fetch("/api/relais?mode=transp", { method: "POST", body: "{}" });
  assert.deepEqual(await (await lp.fetch(url)).json(), [2]);
  // Vers la BASE, le drapeau n'exempte jamais.
  await lp.fetch(base + "/rest/v1/app_data", { method: "POST", body: "{}", vrmInvalideSiChange: true });
  assert.deepEqual(await (await lp.fetch(url)).json(), [3]);
});
