import test from "node:test";
import assert from "node:assert/strict";
import { idPreuve } from "../../api/_lib/preuve-adresse.js";
import { resoudreProprietaire } from "../../api/_lib/proprietaire-email.js";
const owner = (n) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
const vendeurs = Array.from({ length: 2000 }, (_, i) => ({
  owner: owner(i),
  data: { adresses: { [`vendeur${i}@example.test`]: {} } },
}));
const preuves = vendeurs.map((l, i) => ({
  id: idPreuve(l.owner, `vendeur${i}@example.test`),
  owner: l.owner,
  adresse: `vendeur${i}@example.test`,
  etat: "prouvee",
}));
const { lireRegistreEmails } = await import("../../api/email-inbound.js");
async function avecLectures(lire, suite) {
  const original = global.fetch;
  let pages = 0;
  global.fetch = async (url, opt = {}) => {
    const debut = Number(String(opt.headers?.Range || "0-499").split("-")[0]);
    if (String(url).includes("vrm_email_preuve_")) {
      pages++;
      return lire(debut, opt, pages);
    }
    return Response.json(vendeurs.slice(debut, debut + 500));
  };
  try {
    return await suite(() => pages);
  } finally {
    global.fetch = original;
  }
}
for (const total of ["2000", "*"])
  test(
    "2000 vendeurs : les preuves se lisent jusqu’au dernier malgré une limite de 100 (" +
      total +
      ")",
    async () => {
      await avecLectures(
        (debut) => {
          const p = preuves.slice(debut, debut + 100);
          return Response.json(p, {
            headers: {
              "Content-Range": p.length
                ? `${debut}-${debut + p.length - 1}/${total}`
                : `*/${total}`,
            },
          });
        },
        async (pages) => {
          const r = await lireRegistreEmails(true);
          assert.ok(r);
          assert.equal(Object.keys(r.registre).length, 2000);
          assert.equal(
            resoudreProprietaire(
              ["vendeur1999@example.test"],
              r.registre,
              "",
              r.conflits,
            ).owner,
            owner(1999),
          );
          assert.equal(pages(), total === "*" ? 21 : 20);
        },
      );
    },
  );
test("une seconde page de preuves répétée ne fournit pas de registre partiel", async () => {
  await avecLectures(
    () => Response.json(preuves.slice(0, 500)),
    async () => assert.equal(await lireRegistreEmails(true), null),
  );
});
test("416 ne conclut la lecture des preuves que lorsque son total est exactement confirmé", async () => {
  for (const total of ["500", "501", "*"])
    await avecLectures(
      (debut) =>
        debut === 0
          ? Response.json(preuves.slice(0, 500), {
              headers: { "Content-Range": "0-499/*" },
            })
          : new Response("{}", {
              status: 416,
              headers: { "Content-Range": `*/${total}` },
            }),
      async () =>
        assert.equal(
          (await lireRegistreEmails(true)) !== null,
          total === "500",
        ),
    );
});
test("une plage décalée ou un total incohérent empêche toute attribution", async () => {
  for (const range of ["1-100/2000", "0-98/2000", "0-99/99", "invalide"])
    await avecLectures(
      () =>
        Response.json(preuves.slice(0, 100), {
          headers: { "Content-Range": range },
        }),
      async () => assert.equal(await lireRegistreEmails(true), null),
    );
});
test("une page de preuves en échec ne devient jamais un registre incomplet", async () => {
  await avecLectures(
    (debut) =>
      debut === 0
        ? Response.json(preuves.slice(0, 500))
        : new Response("{}", { status: 503 }),
    async () => assert.equal(await lireRegistreEmails(true), null),
  );
});

test("un registre bloqué est borné, partagé entre appels simultanés et peut être relu ensuite", async () => {
  const originalFetch = global.fetch,
    originalTimeout = AbortSignal.timeout;
  // Raccourcir uniquement l’horloge des délais ; aucun accès à un serveur réel.
  AbortSignal.timeout = (ms) =>
    originalTimeout.call(AbortSignal, ms === 20000 ? 25 : 1000);
  const maintien = setTimeout(() => {}, 1000);
  try {
    for (const phase of ["preuves", "registre"]) {
      let bloque = true,
        appels = 0;
      global.fetch = async (url, opt) => {
        appels++;
        if (!bloque) return Response.json([]);
        if (phase === "registre" && String(url).includes("vrm_email_preuve_"))
          return Response.json([]);
        return await new Promise((resolve, reject) => {
          const fin = () => reject(opt.signal.reason);
          if (opt.signal.aborted) fin();
          else opt.signal.addEventListener("abort", fin, { once: true });
        });
      };
      const r = await Promise.all(
        Array.from({ length: 30 }, () => lireRegistreEmails(true)),
      );
      assert.ok(r.every((x) => x === null));
      assert.equal(appels, phase === "preuves" ? 1 : 2);
      bloque = false;
      assert.ok(await lireRegistreEmails(true));
    }
  } finally {
    clearTimeout(maintien);
    global.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
  }
});

test("2000 vendeurs avec trois adresses chacun ne sont pas tronqués après 100 petites pages", async () => {
  const original = global.fetch;
  const lignes = vendeurs.map((v, i) => ({
    owner: v.owner,
    data: {
      adresses: Object.fromEntries(
        [0, 1, 2].map((n) => [`vendeur${i}-${n}@example.test`, {}]),
      ),
    },
  }));
  const ps = lignes.flatMap((v) =>
    Object.keys(v.data.adresses).map((adresse) => ({
      id: idPreuve(v.owner, adresse),
      owner: v.owner,
      adresse,
      etat: "prouvee",
    })),
  );
  global.fetch = async (url, opt) => {
    const d = Number(opt.headers.Range.split("-")[0]);
    if (String(url).includes("vrm_email_preuve_")) {
      const p = ps.slice(d, d + 25);
      return Response.json(p, {
        headers: { "Content-Range": `${d}-${d + p.length - 1}/${ps.length}` },
      });
    }
    return Response.json(lignes.slice(d, d + 500));
  };
  try {
    const r = await lireRegistreEmails(true);
    assert.ok(r);
    assert.equal(Object.keys(r.registre).length, 6000);
    assert.equal(r.registre["vendeur1999-2@example.test"], owner(1999));
  } finally {
    global.fetch = original;
  }
});
