import assert from "node:assert/strict";
import {
  chaineArticle,
  bilanAnnonce,
  comparerComptes,
  diagnosticConnexion,
} from "../../src/outilsArticlesVinted.js";
let n = 0;
const eg = (a, b) => {
  assert.deepEqual(a, b);
  n++;
};
eg(
  chaineArticle("3", [
    { item: "3", ancien: "2" },
    { item: "2", ancien: "1" },
  ]).ids.sort(),
  ["1", "2", "3"],
);
eg(chaineArticle("3", [], { 3: { numero: "5" }, 2: { numero: "5" } }).ids, [
  "3",
]);
eg(
  chaineArticle("3", [{ item: "3", ancien: "2" }], { 3: { recreeDe: "1" } })
    .conflit,
  true,
);
eg(
  chaineArticle("3", [
    { item: "3", ancien: "2" },
    { item: "2", ancien: "3" },
  ]).conflit,
  true,
);
eg(
  chaineArticle("3", [{ item: "3", ancien: "2" }], {
    3: { numero: "8" },
    2: { numero: "9" },
  }).ids,
  ["3"],
);
eg(chaineArticle("invalid").conflit, true);
eg(
  bilanAnnonce({
    id: "1",
    title: "Ordi",
    price: 120,
    photoCount: 0,
    descLen: 0,
  }).manque,
  ["Photos", "Description"],
);
eg(bilanAnnonce({ id: "1", title: "Ordi", price: 120 }).inconnu, [
  "Photos",
  "Description",
  "Caractéristiques",
]);
eg(
  bilanAnnonce(
    { id: "1", title: "Ordi", price: 120 },
    { id: "2", title: "Autre", price: 1, photos: ["url"], desc: "Autre" },
  ).prepare,
  false,
);
eg(
  bilanAnnonce(
    { id: "1", title: "", price: null },
    {
      id: "1",
      title: "Ordi",
      price: 100,
      photos: ["url"],
      desc: "Description",
      caracteristiques: "32 Go RAM",
    },
  ).manque,
  [],
);
const acc = (uid) => ({ _acc: { vinted_user_id: uid } });
const rows = comparerComptes({
  comptes: [{ uid: "1" }, { uid: "2" }],
  ventes: [
    {
      ...acc("1"),
      date: "2026-10-01",
      price: { amount: "100.00" },
      done: true,
      meta: { buyPrice: "40", fraisComplets: true },
    },
    { ...acc("1"), date: "2026-10-01", price: "20", done: true, meta: {} },
    {
      ...acc("1"),
      date: "2026-10-01",
      price: "50",
      done: true,
      meta: { buyPrice: "55", fraisComplets: true },
    },
    { ...acc("2"), date: "2026-10-01", price: null, done: true, meta: {} },
    { ...acc("2"), date: "2026-09-01", price: "90", done: true, meta: {} },
    { ...acc("2"), done: false, price: 40 },
  ],
  stock: [acc("1"), acc("2")],
  dansPeriode: (o) => o.date === "2026-10-01",
  finalisee: (o) => o.done,
  masquee: () => false,
  meta: (o) => o.meta,
  aFaire: (o) => !o.done,
});
eg(rows[0].ca, 170);
eg(rows[0].benefice, 55);
eg(rows[0].couvertes, 2);
eg(rows[1].prixManquants, 1);
eg(rows[1].benefice, null);
eg(rows[1].taches, 1);
eg(rows[0].stock, 1);
const extension = {
  ok: true,
  vrm: { connecte: true, user_id: "a" },
  vinted: { uid: "1" },
};
eg(
  diagnosticConnexion({ uid: "2", owner: "a", extension }).titre,
  "Compte Vinted différent connecté",
);
eg(
  diagnosticConnexion({ uid: "1", owner: "b", extension }).titre,
  "Autre compte VRM connecté",
);
eg(
  diagnosticConnexion({ uid: "1", owner: "a", extension, reponse: "expiree" })
    .titre,
  "Session expirée (401)",
);
eg(
  diagnosticConnexion({
    uid: "1",
    owner: "a",
    extension,
    reponse: "incomplete",
  }).titre,
  "Lecture incomplète",
);
eg(
  diagnosticConnexion({
    uid: "1",
    owner: "a",
    extension: { ...extension, vinted: {} },
  }).titre,
  "Session Vinted non confirmée",
);
eg(
  diagnosticConnexion({ uid: "1", owner: "a", extension: null }).titre,
  "Extension non joignable",
);
console.log(n + " contrôles articles et comparaison réussis");
