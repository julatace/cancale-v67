import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  creerGardeLectures,
  garderConversationsNonLues,
} from "../../src/lecturesVinted.js";
const s = fs.readFileSync(
  new URL("../../src/App.jsx", import.meta.url),
  "utf8",
);
const bloc = (debut, fin) => {
  const a = s.indexOf(debut);
  return s.slice(a, s.indexOf(fin, a));
};
const comptes = [{ vinted_user_id: "1" }, { vinted_user_id: "2" }];
function base() {
  let owner = "a";
  const gardesLectures = {
    current: {
      annonces: creerGardeLectures(
        () => owner,
        () => "1,2",
      ),
      messages: creerGardeLectures(
        () => owner,
        () => "1,2",
      ),
    },
  };
  return {
    accounts: comptes,
    gardesLectures,
    entreeCache: () => null,
    cleComptesVinted: () => "1,2",
    putCache: () => {},
    messagesRetires: () => new Set(),
    garderConversationsNonLues,
    owner: (v) => (owner = v),
  };
}
function creerConvs(fetch, ancien = []) {
  const d = base(),
    state = { current: { items: ancien } },
    dernieresConvs = { current: state.current };
  Object.assign(d, {
    fetchVintedConversations: fetch,
    dernieresConvs,
    setConvs: (v) => {
      state.current = v;
    },
  });
  const code = bloc(
    "  const loadConvs = async (force)",
    "  // ⚠️ `bordereaux`",
  );
  return {
    lire: new Function(...Object.keys(d), code + ";return loadConvs;")(
      ...Object.values(d),
    ),
    get etat() {
      return state.current;
    },
    d,
  };
}
test("le vrai lecteur de messages ignore une réponse arrivée après une relecture plus récente", async () => {
  const attentes = [];
  const x = creerConvs(
    (acc) => new Promise((r) => attentes.push({ uid: acc.vinted_user_id, r })),
  );
  const a = x.lire(true),
    b = x.lire(true);
  for (const p of attentes.slice(2))
    p.r({ ok: true, items: [{ id: "nouveau-" + p.uid }] });
  await b;
  for (const p of attentes.slice(0, 2))
    p.r({ ok: true, items: [{ id: "ancien-" + p.uid }] });
  await a;
  assert.deepEqual(
    x.etat.items.map((c) => c.id),
    ["nouveau-1", "nouveau-2"],
  );
});
test("un compte de messages en échec garde seulement ses lignes antérieures, avec son état à vérifier", async () => {
  const ancien = [
    { id: "1", _acc: { vinted_user_id: "1" } },
    { id: "2", _acc: { vinted_user_id: "2" } },
  ];
  const x = creerConvs(async (a) => {
    if (a.vinted_user_id === "2") throw Error("Réseau");
    return { ok: true, items: [{ id: "nouveau" }] };
  }, ancien);
  await x.lire(true);
  assert.deepEqual(
    x.etat.items.map((c) => c.id),
    ["nouveau", "2"],
  );
  assert.deepEqual(
    x.etat.ko.map((a) => a.vinted_user_id),
    ["2"],
  );
  assert.equal(x.etat.loading, false);
});
test("une réponse tardive de messages ne publie rien après changement de propriétaire", async () => {
  const attentes = [];
  const x = creerConvs(() => new Promise((r) => attentes.push(r)));
  const attente = x.lire(true);
  x.d.owner("b");
  for (const r of attentes) r({ ok: true, items: [{ id: "prive-a" }] });
  await attente;
  assert.equal(x.etat.items, null);
});
test("le vrai lecteur d’annonces refuse aussi une réponse périmée après le complément des descriptions", async () => {
  const d = base(),
    etat = { items: [], comptes: "1,2" },
    listingsRef = { current: etat },
    descs = [];
  let lecture = 0;
  Object.assign(d, {
    listingsRef,
    signalPendantLecture: { current: false },
    setListings: (v) => Object.assign(etat, v),
    fetchVintedListings: async (a) => ({
      ok: true,
      items: [{ id: String(++lecture) }],
      soldIds: [],
      lu: Date.now(),
    }),
    noteAcctLive: () => {},
    _harvestSeen: {},
    fetchDescLens: () => new Promise((r) => descs.push(r)),
    setVenduesVinted: () => {},
  });
  const code = bloc(
    "  const loadListings = async (force, silencieux, surSignal)",
    "  const loadConvs = async (force)",
  );
  const lire = new Function(...Object.keys(d), code + ";return loadListings;")(
    ...Object.values(d),
  );
  const ancienne = lire(true);
  await new Promise((r) => setTimeout(r, 0));
  const recente = lire(true);
  await new Promise((r) => setTimeout(r, 0));
  descs[1]({});
  await recente;
  descs[0]({});
  await ancienne;
  assert.deepEqual(
    etat.items.map((x) => x.id),
    ["3", "4"],
  );
  assert.equal(etat.loading, false);
});
